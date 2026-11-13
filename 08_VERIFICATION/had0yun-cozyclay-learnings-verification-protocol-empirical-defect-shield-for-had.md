# Verification Protocol: Verification Protocol: Empirical Defect Shield for had0yun-cozyclay-learnings

<!-- PROVENANCE_START
{
  "source_repository": "had0yun-cozyclay-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:36:27.421Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-had0yun-cozyclay-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [had0yun-cozyclay-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:36:27.421Z`  
> **Learning ID**: `LEARN-REEXTRACT-had0yun-cozyclay-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `had0yun-cozyclay-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/had0yun-cozyclay-learnings.md`  
> **Source**: github ([https://github.com/HaD0Yun/CozyClay](https://github.com/HaD0Yun/CozyClay))  
> **Source Version**: `ba079c02`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T17:49:14.804Z  
> **Learning ID**: `learn-github-had0yun-cozyclay`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): HaD0Yun/CozyClay

> **Canonical Artifact**: `07_PROJECT_LEARNING/had0yun-cozyclay-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HaD0Yun/CozyClay](https://github.com/HaD0Yun/CozyClay))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-05T17:47:41.309Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HaD0Yun/CozyClay`
- **Description**: Open source previs software in the browser: block a scene, pose characters, author camera moves and cuts, then take the same shots to an AI video model.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1530 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bin/telemetry-state.mjs`
```
import { randomUUID as nodeRandomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const POSTHOG_PROJECT_TOKEN = "phc_CpizzZ8VhSorSS8yEeQhdpUcvB2erp5xkCbnFD8HTJ5m";
const POSTHOG_API_HOST = "https://t.cozyclay.org";
// First-launch answers plus the `npx cozyclay --via <source>` values the
// landing page's copy commands carry (#466). Mirrors analytics HEARD_FROM_SOURCES.
export const FIRST_LAUNCH_SOURCES = Object.freeze(["x", "hn", "reddit", "github", "friend", "other", "site", "playground"]);

const DEFAULT_STATE = Object.freeze({
	installationId: null,
	telemetryEnabled: true,
	internalQa: false,
	firstLaunchedAt: null,
	noticeVersion: 0,
	firstLaunchHeardFrom: null,
});
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rawState(stateFile) {
	try {
		const parsed = JSON.parse(readFileSync(stateFile, "utf8"));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch (error) {
		// A corrupt file is not an opt-out: fall back to defaults (telemetry on)
		// rather than silently disabling collection forever.
		return {};
	}
}

function normalizedState(value) {
	return {
		installationId: typeof value.installationId === "string" && UUID_PATTERN.test(value.installationId)
			? value.installationId
			: null,
		telemetryEnabled: value.telemetryEnabled !== false,
		internalQa: value.internalQa === true,
		firstLaunchedAt: typeof value.telemetryFirstLaunchedAt === "string"
			? value.telemetryFirstLaunchedAt
			: null,
		noticeVersion: Number.isInteger(value.telemetryNoticeVersion)
			? value.telemetryNoticeVersion
			: 0,
		firstLaunchHeardFrom: FIRST_LAUNCH_SOURCES.includes(value.telemetryFirstLaunchHeardFrom)
			? value.telemetryFirstLaunchHeardFrom
			: null,
	};
}

function writeState(stateFile, patch) {
	const next = { ...rawState(stateFile), ...patch };
	if (typeof next.internalQa !== "boolean") next.internalQa = false;
	mkdirSync(dirname(stateFile), { recursive: true });
	const temporary = `${stateFile}.${process.pid}.tmp`;
	writeFileSync(temporary, JSON.stringify(next, null, "\t"), { mode: 0o600 });
	renameSync(temporary, stateFile);
}

function envDisablesTelemetry(env) {
	// Only explicit opt-outs count. CI heuristics silently disabled telemetry
	// in devcontainers and Docker images that set CI=true by accident.
	if (/^(1|true|yes|on)$/i.test(env.DO_NOT_TRACK ?? "")) return true;
	return /^(0|false|no|off)$/i.test(env.COZYCLAY_TELEMETRY ?? "");
}

export function readTelemetryState(stateFile) {
	return normalizedState(rawState(stateFile));
}

export function effectiveTelemetryEnabled(state, env = process.env) {
	return state.telemetryEnabled && !envDisablesTelemetry(env);
}

export function setTelemetryInternalQa(stateFile, enabled) {
	writeState(stateFile, { internalQa: enabled === true });
	return readTelemetryState(stateFile);
}

export function setTelemetryEnabled(stateFile, enabled) {
	writeState(stateFile, {
		telemetryEnabled: enabled === true,
		...(enabled === true ? {} : { installationId: null }),
	});
	return readTelemetryState(stateFile);
}

export function markTelemetryFirstLaunch(stateFile, now = () => new Date().toISOString()) {
	if (readTelemetryState(stateFile).firstLaunchedAt) return;
	writeState(stateFile, { telemetryFirstLaunchedAt: now() });
}

export function setTelemetryFirstLaunchSource(stateFile, heardFrom) {
	if (!FIRST_LAUNCH_SOURCES.includes(heardFrom)) return readTelemetryState(stateFile);
	writeState(stateFile, { telemetryFirstLaunchHeardFrom: heardFrom });
	return readTelemetryState(stateFile);
}

export function takeRuntimeTelemetryConfig(
	stateFile,
	{
		appVersion,
		officialPackage = true,
		installKind = null,
		env = process.env,
		now = () => new Date().toISOString(),
		randomUUID = nodeRandomUUID,
	} = {},
) {
	const existing = readTelemetryState(stateFile);
	const telemetryEnabled = officialPackage && effectiveTelemetryEnabled(existing, env);
	const internalQa = telemetryEnabled && existing.internalQa;
	let installationId = existing.installationId;
	const firstLaunch = telemetryEnabled && !existing.firstLaunchedAt;
	const patch = {};

	if (telemetryEnabled && !installationId) {
		installationId = randomUUID();
		patch.installationId = installationId;
	}
	if (Object.keys(patch).length > 0) writeState(stateFile, patch);

	return {
		distribution: "npm",
		telemetryEnabled,
		internalQa,
		installationId: telemetryEnabled ? installationId : null,
		appVersion,
		apiKey: POSTHOG_PROJECT_TOKEN,
		apiHost: POSTHOG_API_HOST,
		firstLaunch,
		firstLaunchHeardFrom: existing.firstLaunchHeardFrom,
		installKind: ["npx", "global", "clone"].includes(installKind)
			? installKind
			: env.npm_config_global === "true" || env.npm_config_global === true ? "global" : "npx",
	};
}

```

### Core Architecture Module: `src/effects/state.js`
```
/**
 * What the agent can measure about an effect: `effectStateAt(objectId, frame)`
 * answers { frame, alive, emitter: [x,y,z], bounds: { min, max } | null } in
 * metres, rounded to the millimetre, plus `clamped` when the scene-wide
 * particle cap thinned this emitter.
 *
 * The answer is computed, not read back from the GPU, by the same simulation
 * call the renderer draws with. EffectsLayer publishes the take it draws
 * against; the records come from the caller when it has fresher ones.
 */
import { isEffectivelyHidden } from "../object-hidden.js";
import { evaluateEffects } from "./simulate.js";
import { EFFECT_KIND } from "./effect-record.js";

let readLive = () => null;

/** The renderer's current { take, live } (a reader, so it is always the last render's). */
export function publishEffectScene(read) {
	readLive = typeof read === "function" ? read : () => null;
}

/** The simulation scene for a list of AUTHORED records: effect records, lookup and the authored-hidden set. */
export function effectSceneOf(objects) {
	const records = objects.filter((object) => object?.renderer === EFFECT_KIND);
	return { records, lookup: new Map(objects.map((object) => [object.id, object])),
		hidden: new Set(records.filter((record) => isEffectivelyHidden(record, objects, [])).map((record) => record.id)) };
}

const mm = (value) => {
	const rounded = Math.round(value * 1000) / 1000;
	return rounded === 0 ? 0 : rounded;
};

/** The effect state for one emitter in `scene` (see the module note), or null when it is no effect. */
export function effectStateIn(scene, objectId, frame) {
	const records = scene?.records ?? [];
	if (!records.some((record) => record.id === objectId)) return null;
	const at = Math.max(0, Math.round(Number(frame) || 0));
	const st = evaluateEffects(records, scene, at, { only: objectId }).get(objectId);
	return {
		frame: at, alive: st.alive, emitter: st.emitter.map(mm),
		bounds: st.alive ? { min: st.min.map(mm), max: st.max.map(mm) } : null,
		...(st.clamped ? { clamped: st.clamped } : {}),
	};
}

/** `objects` (authored records) default to the ones the renderer last drew. */
export function effectStateAt(objectId, frame, objects = null) {
	const live = readLive() ?? {};
	const scene = objects ? { ...effectSceneOf(objects), take: live.take ?? {}, live: live.live ?? null } : live;
	return effectStateIn(scene, objectId, frame);
}

/** An inspect_studio entity row with `effect` (the state at `frame`) added for an effect record. */
export function withEffectState(row, frame, objects) {
	if (row?.renderer !== EFFECT_KIND) return row;
	const effect = effectStateAt(row.id, frame, objects);
	return effect ? { ...row, effect } : row;
}

```

### Core Architecture Module: `src/motion3/bricks/fill-native-core.js`
```
// Shared pieces of the native MotionBricks fill (fill-native.js, fill-native-chain.js): the engines' endpoint correction and root
// filter on decoded SOMA frames, dense channels over a gap, and the gap's token count.
import { somaFK, toCozyPoint, SOMA_PARENT } from "./soma.js";
import { MIN_TOKENS, MAX_TOKENS } from "./model-io.js";
import { frameChannels, unwrapSeries } from "./forward.js";
import { STEP, lockFeet, sparseKeys, merge } from "./fill.js";
import { solePoints } from "../qa/geometry.js";
import { rangeOf } from "../compiler/vocab.js";
import { quatFromMat, matFromQuat, mul, T, add, scale, sub } from "../compiler/math.js";

export const MIN_GAP = 14; // the shortest call (6 tokens, 18 frames) is 13.6 spec frames
const TOKEN_SPREAD = 2;
const JOINT_FADE = 0.3 * 30; // model frames
const ROOT_FILTER = [-0.0465, 0.0639, 0.2827, 0.3998, 0.2827, 0.0639, -0.0465];
export const TOL_SCALE = 0.35;

export const lerp = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : a + (b - a) * t);
const fade = v => { const t = Math.max(0, Math.min(1, v)), r = 1 - t; return t < 0.5 ? 1 - 2 * t * t : 2 * r * r; };

/** R raised to the power t (a partial rotation from identity). */
function partial(R, t) {
	let [x, y, z, w] = quatFromMat(R);
	if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
	const half = Math.acos(Math.min(1, w)), s = Math.sin(half);
	if (s < 1e-8 || t === 0) return t === 0 ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : R;
	const h = half * t, k = Math.sin(h) / s;
	return matFromQuat([x * k, y * k, z * k, Math.cos(h)]);
}

const localOf = R => R.map((r, j) => (j === 0 ? r : mul(T(R[SOMA_PARENT[j]]), r)));
const worldOf = L => { const R = []; L.forEach((l, j) => { R[j] = j === 0 ? l : mul(R[SOMA_PARENT[j]], l); }); return R; };

/** The runtime's root filter (7 taps, clamped at the ends) and the engines' endpoint correction, on decoded SOMA frames. */
export function correctMotion(motion, start, end) {
	const n = motion.length, last = n - 1, r = ROOT_FILTER.length >> 1;
	const roots = motion.map((_, f) => {
		const p = [0, 0, 0];
		ROOT_FILTER.forEach((w, t) => { const q = motion[Math.max(0, Math.min(last, f + t - r))].P[0]; p[0] += w * q[0]; p[1] += w * q[1]; p[2] += w * q[2]; });
		return p;
	});
	if (n < 2) return motion.map((m, f) => ({ ...m, P: somaFK(roots[f], m.R) }));
	const L = motion.map(m => localOf(m.R)), Ls = localOf(start.R), Le = localOf(end.R);
	// deltas that take the generated end frames onto the guides (inv(gen) * guide for the root, guide * inv(gen) per joint)
	const dRootS = mul(T(L[0][0]), Ls[0]), dRootE = mul(T(L[last][0]), Le[0]);
	const dPosS = sub(start.root ?? start.P[0], roots[0]), dPosE = sub(end.root ?? end.P[0], roots[last]);
	const dJS = Ls.map((l, j) => mul(l, T(L[0][j]))), dJE = Le.map((l, j) => mul(l, T(L[last][j])));
	const F = Math.min(JOINT_FADE, 0.5 * last);
	return motion.map((m, f) => {
		const ew = f / last, sw = 1 - ew, ws = fade(f / F), we = fade((last - f) / F);
		const local = L[f].map((l, j) => (j === 0 ? mul(mul(l, partial(dRootS, sw)), partial(dRootE, ew)) : mul(partial(dJE[j], we), mul(partial(dJS[j], ws), l))));
		const R = worldOf(local), root = add(roots[f], add(scale(dPosS, sw), scale(dPosE, ew)));
		return { R, P: somaFK(root, R), contacts: m.contacts };
	});
}

/** A knee pole the spec refuses (pointing backward, validate.js: z < -0.7 of its length) is turned to just inside the limit; the
 * ankle floor (4 cm) and the numeric channel ranges (vocab.js rangeOf) likewise. Mutates and returns the channel object. */
export function saneChannels(ch) {
	for (const k of ["knee_l", "knee_r"]) {
		const v = ch[k];
		if (!v) continue;
		const l = Math.hypot(...v);
		if (l > 1e-6 && v[2] < -0.6 * l) { const z = -0.6 * l, r = Math.hypot(v[0], v[1]) || 1e-6, s = Math.sqrt(Math.max(0, l * l - z * z)) / r; ch[k] = [v[0] * s, v[1] * s, z]; }
	}
	for (const k of ["foot_l", "foot_r"]) if (ch[k] && ch[k][1] < 0.045) ch[k] = [ch[k][0], 0.045, ch[k][2]];
	// numeric channels inside the spec's ranges (e.g. fpitch -60..90)
	for (const [k, v] of Object.entries(ch)) { const r = typeof v === "number" ? rangeOf(k) : null; if (r) ch[k] = Math.max(r[1], Math.min(r[2], v)); }
	return ch;
}

/** Dense channels over spec frames fa..fb from corrected SOMA frames (time-warped onto the gap), residual faded onto the compiled ends. */
export function denseChannels(motion, fa, fb, baked, endBaked = baked) {
	const gen = motion.map(m => frameChannels(m.P.map(toCozyPoint))), n = gen.length, out = [];
	for (let f = fa; f <= fb; f++) {
		const x = (f - fa) / (fb - fa) * (n - 1), i = Math.min(Math.floor(x), n - 2), u = x - i;
		out.push(Object.fromEntries(Object.keys(gen[0]).map(k => [k, lerp(gen[i][k], gen[i + 1][k], u)])));
	}
	unwrapSeries(out, Object.fromEntries(Object.entries(baked).map(([k, v]) => [k, v[fa]])));
	const last = out.length - 1, F = Math.min(JOINT_FADE * 24 / 30, 0.5 * last);
	const diff = (x, y) => (Array.isArray(x) ? x.map((v, i) => v - y[i]) : x - y);
	for (const k of Object.keys(out[0])) {
		if (!baked[k] || !endBaked[k]) continue;
		const s = diff(baked[k][fa], out[0][k]), e = diff(endBaked[k][fb], out[last][k]);
		out.forEach((ch, i) => {
			const ws = k === "root" ? 1 - i / last : fade(i / F), we = k === "root" ? i / last : fade((last - i) / F);
			ch[k] = Array.isArray(s) ? ch[k].map((v, c) => v + s[c] * ws + e[c] * we) : ch[k] + s * ws + e * we;
		});
	}
	const planted = out.map((_, i) => motion[Math.round(i / last * (n - 1))].contacts);
	lockFeet(out, planted);
	stepFeet(out);
	out.forEach(saneChannels);
	return out;
}

const STEP_MIN_M = 0.02, STEP_FROM = 0.6, STEP_LIFT = 0.03;
/**
 * A foot the model keeps planted over the whole gap while the authored keys move it (lockFeet then slides it straight from key
 * to key, QA SLIDE on every frame) holds its start until the hips have come STEP_FROM of the way from the last height, then
 * the feet step to the end key one after the other on a low arc (STEP_LIFT, at most 15% of the distance), the other foot
 * holding meanwhile: the legs go out as the body sits, never both in the air. Mutates out (and out.holds).
 */
export function stepFeet(out) {
	const last = out.length - 1, y = i => out[i].root?.[1];
	if (last < 6 || y(0) === undefined) return out;
	const drop = y(0) - y(last);
	let from = Math.round(last * 0.4);
	if (Math.abs(drop) > 0.05) { from = 0; while (from < last && (y(from) - y(last)) / drop > STEP_FROM) from++; }
	from = Math.max(1, Math.min(from, last - 6));
	const sides = ["l", "r"].filter(k => {
		const a = out[0][`foot_${k}`], b = out[last][`foot_${k}`];
		return out.holds?.[k]?.some(([i, j]) => i === 0 && j === last) && a && b && Math.hypot(b[0] - a[0], b[2] - a[2]) >= STEP_MIN_M;
	});
	const mid = Math.round((from + last) / 2);
	sides.forEach((k, n) => {
		const [s0, s1] = sides.length === 1 ? [from, last] : n === 0 ? [from, mid] : [mid, last];
		const a = out[0][`foot_${k}`], b = out[last][`foot_${k}`], lift = Math.min(STEP_LIFT, 0.15 * Math.hypot(b[0] - a[0], b[2] - a[2]));
		for (const ch of [`foot_${k}`, `fyaw_${k}`, `fpitch_${k}`]) {
			const A = out[0][ch], B = out[last][ch];
			if (A === undefined) continue;
			for (let i = 1; i < last; i++) {
				const t = Math.max(0, Math.min(1, (i - s0) / (s1 - s0)));
				out[i][ch] = lerp(A, B, 1 - fade(t));
				if (ch === `foot_${k}` && t > 0 && t < 1) out[i][ch][1] += lift * Math.sin(Math.PI * t);
			}
		}
		out.holds[k] = [[0, s0], [s1, last]];
	});
	return out;
}

const GROUND_PASSES = 2, GROUND_CLEAR = 0.003;
/**
 * The model's skeleton is not the rig's, and a held ankle under a pitched foot pushes the toe down: either can put a sole
 * under the floor (QA GROUND across a kneel or a crouch). Compile the gap with its dense keys, read each frame's lowest
 * sole point (the QA's own heel, ball and tip) and raise that ankle by the depth; twice, since a raised ankle turns the
 * foot. Only frames under the floor change. Mutates dense; answers how many frame-sides it raised.
 */
export function groundSoles(dense, fa, { spec, keys, compile, sk }) {
	let raised = 0;
	for (let pass = 0; pass < GROUND_PASSES; pass++) {
		const frames = compile({ ...spec, keys: merge(keys, sparseKeys(dense, fa, "ground", TOL_SCALE)) }).out.frames;
		let moved = 0;
		dense.forEach((ch, i) => {
			const s = frames[fa + i]?.s;
			if (!s || i === 0 || i === dense.length - 1) return;
			for (const [k, side] of [["l", "Left"], ["r", "Right"]]) {
				const sp = solePoints(sk, s, side), low = Math.min(sp.heel[1], sp.ball[1], sp.tip[1]), foot = ch[`foot_${k}`];
				if (low < 0 && foot) { ch[`foot_${k}`] = [foot[0], foot[1] - low + GROUND_CLEAR, foot[2]]; moved++; }
			}
		});
		raised += moved;
		if (!moved) break;
	}
	return raised;
}

const POP_LIMIT = 0.06, POP_ROUNDS = 3;
const SIDE = { Leg: ["foot", "knee"], Foot: ["foot", "knee", "fpitch", "fyaw"], ToeBase: ["foot", "fpitch"], Arm: ["hand", "elbow"], ForeArm: ["hand", "elbow"], Hand: ["hand", "elbow"] };
const drives = bone => { const m = /^(Left|Right)(.+)$/.exec(bone); return m ? (SIDE[m[2]] ?? []).map(c => `${c}_${m[1] === "Left" ? "l" : "r"}`) : /^Head|^Neck/.test(bone) ? ["head_pitch", "head_yaw", "spine_pitch"] : ["root"]; };
/**
 * A one-frame kick QA calls POP inside the gap (the exact fill squeezing the model's longer move into the authored frames, or the
 * end correction): on the compiled gap find the frames where that bone's acceleration passes POP_LIMIT and average the channels
 * that drive it with their neighbours over +-2 frames (the vault runner's pass, tools/motionbricks/vault.mjs); the gap's ends stay.
 * Mutates dense; answers how many frames it relaxed.
 */
export function relaxPops(dense, fa, { spec, keys, compile, sk }) {
	let relaxed = 0;
	const last = dense.length - 1;
	for (let round = 0; round < POP_ROUNDS; round++) {
		const r = compile({ ...spec, keys: merge(keys, sparseKeys(dense, fa, "pop", TOL_SCALE)) });
		const pops = (r.qa?.groups ?? []).filter(g => g.kind === "POP" && g.last >= fa && g.f
```

### Core Architecture Module: `src/motion3/compile-worker.js`
```
// The motion compile worker: runs compile jobs (compile-job.js) off the editor's main thread, one at a time
// in arrival order, and answers each { id } with { id, value } (typed arrays transferred) or { id, error }.
// On the main thread the compiler runs about 4x slower than here (measured: 6.2 s against 1.5 s for a
// 240-frame carry) and blocks the viewport and the agent panel for the whole compile.
import { answerOf } from "./compile-job.js";

self.onmessage = ({ data }) => {
	const { message, transfer } = answerOf(data);
	self.postMessage(message, transfer);
};

```

### Core Architecture Module: `src/render-passes.js`
```
// Depth and normal passes for the blocking frame.
//
// A generator handed one RGB plate has to guess the geometry behind it. A
// depth pass says how far away every pixel is, and a normal pass says which
// way its surface faces — the two conditioning images ControlNet-style tools
// ask for. Both are the SAME render the RGB plate came from, taken through
// the same offscreen capture rig, with one material override swapped in for
// the draw and taken back out immediately after.
//
// Nothing here owns the renderer: the capture rig is passed in, so the studio
// and a headless test drive the identical path.

import * as THREE from "three";

export const PASS_KINDS = Object.freeze(["depth", "normal"]);

// How far the grey ramp reaches, in metres. The shot camera's far plane sits
// at 100 m and its near plane at 0.1 m; normalising across that whole range
// would push every blocking distance a previs shot actually uses into the
// darkest few percent of the ramp. 40 m is the working depth of the stage (the
// viewport's own fog dissolves the deck by ~54 m), so the subject and the deck
// under it spread across the full range instead of collapsing to black.
export const DEPTH_RANGE_M = 40;

/** Return the shot-wide near/far range from per-frame extrema. */
export function depthRangeFromFrames(frames, fallbackNear = 0.1, fallbackFar = DEPTH_RANGE_M) {
	let near = Infinity;
	let far = -Infinity;
	for (const frame of frames ?? []) {
		if (Number.isFinite(frame?.min) && frame.min > 0) near = Math.min(near, frame.min);
		if (Number.isFinite(frame?.max) && frame.max > 0) far = Math.max(far, frame.max);
	}
	if (!Number.isFinite(near) || !Number.isFinite(far)) return { near: fallbackNear, far: fallbackFar };
	return { near, far: Math.max(far, near + 0.0001) };
}

/** File name for a downloaded pass: `blocking-frame-depth.png`. */
export function passFileName(kind) {
	if (!PASS_KINDS.includes(kind)) throw new Error(`Unknown render pass: ${kind}`);
	return `blocking-frame-${kind}.png`;
}

// Linear view-space depth, near = white. THREE.MeshDepthMaterial writes the
// non-linear window-space z instead: with a 0.1 m near plane that curve spends
// most of its range in the first metre, so a blocking frame comes out as a
// near-black plate with no readable falloff (RGBADepthPacking is worse again —
// it spreads the value over four channels and reads as colour noise). This
// shader is the plain depth-to-grey the deliverable wants, and the range it
// normalises over is the stage's, not the projection's.
// An InstancedMesh (a sculpt's scatter) draws every instance through its
// instanceMatrix; without it all of them would land on the mesh's origin.
const DEPTH_VERTEX = /* glsl */ `
varying float vViewDepth;
void main() {
	vec4 local = vec4(position, 1.0);
#ifdef USE_INSTANCING
	local = instanceMatrix * local;
#endif
	vec4 viewPosition = modelViewMatrix * local;
	vViewDepth = -viewPosition.z;
	gl_Position = projectionMatrix * viewPosition;
}
`;

const DEPTH_FRAGMENT = /* glsl */ `
varying float vViewDepth;
uniform float uNear;
uniform float uRange;
void main() {
	float normalized = clamp((vViewDepth - uNear) / max(uRange - uNear, 0.0001), 0.0, 1.0);
	float grey = 1.0 - normalized;
	gl_FragColor = vec4(vec3(grey), 1.0);
}
`;

const BACKGROUND_FAR = new THREE.Color(0x000000);

function passMaterial(kind, camera, depthRange = null) {
	if (kind === "depth") {
		return new THREE.ShaderMaterial({
			vertexShader: DEPTH_VERTEX,
			fragmentShader: DEPTH_FRAGMENT,
			uniforms: {
				uNear: { value: Number.isFinite(depthRange?.near) ? depthRange.near : (Number.isFinite(camera?.near) ? camera.near : 0.1) },
				uRange: { value: Number.isFinite(depthRange?.far) ? depthRange.far : DEPTH_RANGE_M },
			},
			// The stage's fog is a viewport look, not geometry: a depth plate that
			// faded into the fog colour would report the horizon as near.
			fog: false,
		});
	}
	if (kind === "normal") return new THREE.MeshNormalMaterial();
	throw new Error(`Unknown render pass: ${kind}`);
}

/**
 * Render one pass through the capture rig.
 *
 * @param {{ render: () => (Uint8Array|null) }} capture the offscreen capture rig
 * @param {{ overrideMaterial: unknown }} scene the scene the rig draws
 * @param {{ near?: number }} camera the shot camera the rig renders through
 *   (the rig clones it itself; the depth ramp reads its near plane)
 * @param {"depth"|"normal"} kind
 * @param {(buffer: Uint8Array) => string} [toDataUrl] converts the rig's RGBA
 *   read-back into a PNG data URL; omitted, the raw buffer comes back
 * @returns {string|Uint8Array|null} the PNG data URL (or the raw buffer)
 */
export function renderPass(capture, scene, camera, kind, toDataUrl = null, options = {}) {
	if (!capture || !scene || !camera) return null;
	const material = passMaterial(kind, camera, options.depthRange);
	const previousMaterial = scene.overrideMaterial;
	const previousBackground = scene.background;
	let buffer = null;
	// A glow halo (userData.beautyOnly) is light, not a surface: drawn with the
	// pass material it would be a solid quad in the depth or normal plate.
	const hidden = [];
	scene.traverse?.((node) => {
		if (node.userData?.beautyOnly && node.visible) {
			hidden.push(node);
			node.visible = false;
		}
	});
	try {
		scene.overrideMaterial = material;
		// Empty sky is infinitely far away, so on a depth plate it is black. The
		// studio's pale stage colour would otherwise read as "nearest thing in
		// the frame" to anything consuming the pass.
		if (kind === "depth") scene.background = BACKGROUND_FAR;
		buffer = capture.render();
	} finally {
		// The viewport draws from this same scene object, so the override must
		// come off before anything else can paint with it — even if the render
		// threw.
		scene.overrideMaterial = previousMaterial;
		scene.background = previousBackground;
		for (const node of hidden) node.visible = true;
		material.dispose();
	}
	if (!buffer) return null;
	return toDataUrl ? toDataUrl(buffer) : buffer;
}

```

### Core Architecture Module: `src/sculpt-sketch-state.js`
```
// The live sketch of the running agent turn: the sculpt parts a tool call has written so far, as the sidecar's
// sculpt.sketch frames carry them (bin/agent/sculpt-sketch.mjs), for sculpt-sketch.jsx to draw as ghost clay.
// In-page only and per turn: nothing here is saved, undone, exported or sent to the agent. A call's sketch goes
// when its tool.done arrives (the real objects are in the scene by then, or were refused), and everything goes
// when the turn ends, fails or is stopped (agent-client.js clears it), so no ghost outlives its turn.
import { expandSculptParts, normalizeSculptRecipe } from "./sculpt-recipe.js";

const MAX_PARTS = 300;
const EMPTY = Object.freeze([]);
const sketches = new Map(), finished = new Set(), listeners = new Set();
let snapshot = EMPTY;

function emit() {
	snapshot = Object.freeze([...sketches].flatMap(([call, groups]) => groups.map((group) => ({ ...group, key: `${call}/${group.key}` }))));
	for (const listener of [...listeners]) {
		try { listener(); } catch { /* a broken view never stops the turn */ }
	}
}

/**
 * sculptSketchFrame(event) takes every frame of the running turn: sculpt.sketch sets (or, with no groups, drops)
 * one call's sketch; tool.done drops that call's sketch and ignores any sketch of it that arrives later (the final
 * one can trail a quick tool); done and error end the turn's sketches.
 */
export function sculptSketchFrame(event) {
	if (event?.type === "sculpt.sketch") {
		const call = typeof event.callId === "string" && event.callId ? event.callId : `#${event.index}`;
		if (finished.has(call)) return;
		// The same call sketched before its id was known (bin/agent/sculpt-sketch.mjs).
		const unnamed = call !== `#${event.index}` && sketches.delete(`#${event.index}`);
		const groups = (Array.isArray(event.groups) ? event.groups : [])
			.filter((group) => group && typeof group.key === "string" && Array.isArray(group.parts) && group.parts.length);
		if (groups.length) sketches.set(call, groups);
		else if (!sketches.delete(call) && !unnamed) return;
		emit();
	} else if (event?.type === "tool.done" && typeof event.callId === "string") {
		finished.add(event.callId);
		if (sketches.delete(event.callId)) emit();
	} else if (event?.type === "done" || event?.type === "error") clearSculptSketch();
}

/** Forget every sketch of the turn (it ended, failed or was stopped). */
export function clearSculptSketch() {
	finished.clear();
	if (!sketches.size) return;
	sketches.clear();
	emit();
}

/** subscribeSculptSketch(listener) -> unsubscribe; with sculptSketchSnapshot it fits React's useSyncExternalStore. */
export function subscribeSculptSketch(listener) {
	listeners.add(listener);
	return () => { listeners.delete(listener); };
}

/** Every group being sketched, [{ key, name?, target?, placement?, parts }]; the same array until a frame changes it. */
export const sculptSketchSnapshot = () => snapshot;

/**
 * sketchDrawnParts(parts) -> the parts a ghost draws, as expandSculptParts gives them (object-frame matrix, mirrors
 * expanded). Lenient where the real recipe is strict: each part is checked on its own and a bad one is dropped, not
 * the whole recipe, and a part whose parent is not written yet waits, because a sketch is a recipe half written.
 */
export function sketchDrawnParts(parts) {
	const drawable = [], ids = new Set();
	for (const raw of Array.isArray(parts) ? parts.slice(0, MAX_PARTS) : []) {
		if (!raw || typeof raw !== "object" || ids.has(raw.id)) continue;
		const { parent, mirror, ...own } = raw;
		const checked = normalizeSculptRecipe({ version: 1, parts: [own] });
		if (!checked.ok || checked.recipe.parts[0].op) continue;
		ids.add(raw.id);
		drawable.push({ ...checked.recipe.parts[0], ...(typeof parent === "string" && parent ? { parent } : {}), ...(mirror === true ? { mirror: true } : {}) });
	}
	// expandSculptParts walks down from the roots, so an orphan (or a parent cycle) is never reached.
	return expandSculptParts({ version: 1, parts: drawable });
}

```

### Core Architecture Module: `src/use-render-activity.js`
```
import { useEffect, useState } from "react";
import { usePlaybackEffects } from "./motion/playback-frame-store.js";

export const RENDER_ACTIVITY_KEYS = new Set([
	"KeyW",
	"KeyA",
	"KeyS",
	"KeyD",
	"KeyQ",
	"KeyE",
]);
export const RENDER_ACTIVITY_EVENT = "cozyclay-render-activity";

export function hasContinuousRenderActivity(pointerIds, keyCodes, transient) {
	return pointerIds.size > 0 || keyCodes.size > 0 || transient;
}

/**
 * Camera navigation cannot change the rig silhouette, so its exposure result
 * can stay cached until the gesture settles. Pose changes remain immediate.
 */
export function shouldRefreshIkExposure({ cameraGesture, cameraGestureEnded, exposureDirty, poseDirty, elapsedMs, throttleMs = 100 }) {
	if (!exposureDirty) return false;
	if (cameraGesture) return false;
	if (cameraGestureEnded || poseDirty) return true;
	return elapsedMs >= throttleMs;
}

/**
 * Keep the WebGL loop hot only while the user is actively manipulating the
 * scene. React/R3F still invalidates demand frames for ordinary state changes;
 * this hook covers direct ref mutations such as IK drags, camera look/dolly,
 * plan puck drags, scrubbing, and held WASD/QE movement.
 */
export function useRenderActivity(alwaysActive, playback = {}) {
	usePlaybackEffects(playback);
	const [interactive, setInteractive] = useState(false);

	useEffect(() => {
		const pointerIds = new Set();
		const keyCodes = new Set();
		let transient = false;
		let transientTimer = null;
		const sync = () => setInteractive(hasContinuousRenderActivity(pointerIds, keyCodes, transient));
		const endTransient = () => {
			transient = false;
			transientTimer = null;
			sync();
		};
		const pulse = () => {
			transient = true;
			if (transientTimer !== null) clearTimeout(transientTimer);
			transientTimer = setTimeout(endTransient, 180);
			sync();
		};
		const onPointerDown = (event) => {
			// Right-button fly navigation invalidates explicitly from
			// FlyControls. It must not switch the whole canvas to an
			// always-running loop, because the split renderer would repaint
			// frozen panes on every RAF.
			if (event.button === 2) return;
			pointerIds.add(event.pointerId);
			sync();
		};
		const onPointerEnd = (event) => {
			if (event.button === 2) return;
			pointerIds.delete(event.pointerId);
			sync();
		};
		const onKeyDown = (event) => {
			if (!RENDER_ACTIVITY_KEYS.has(event.code)) return;
			const element = document.activeElement;
			if (element && ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)) return;
			keyCodes.add(event.code);
			sync();
		};
		const onKeyUp = (event) => {
			if (!RENDER_ACTIVITY_KEYS.has(event.code)) return;
			keyCodes.delete(event.code);
			sync();
		};
		const reset = () => {
			pointerIds.clear();
			keyCodes.clear();
			transient = false;
			if (transientTimer !== null) clearTimeout(transientTimer);
			transientTimer = null;
			sync();
		};

		window.addEventListener("pointerdown", onPointerDown, true);
		window.addEventListener("pointerup", onPointerEnd, true);
		window.addEventListener("pointercancel", onPointerEnd, true);
		window.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("keyup", onKeyUp, true);
		window.addEventListener("wheel", pulse, { capture: true, passive: true });
		window.addEventListener("blur", reset);
		return () => {
			if (transientTimer !== null) clearTimeout(transientTimer);
			window.removeEventListener("pointerdown", onPointerDown, true);
			window.removeEventListener("pointerup", onPointerEnd, true);
			window.removeEventListener("pointercancel", onPointerEnd, true);
			window.removeEventListener("keydown", onKeyDown, true);
			window.removeEventListener("keyup", onKeyUp, true);
			window.removeEventListener("wheel", pulse, true);
			window.removeEventListener("blur", reset);
		};
	}, []);

	const active = alwaysActive || interactive;
	useEffect(() => {
		window.dispatchEvent(new CustomEvent(RENDER_ACTIVITY_EVENT, { detail: active }));
	}, [active]);
	return active;
}

```

### Core Architecture Module: `tools/render-start-thumbs.mjs`
```
#!/usr/bin/env node
/**
 * Render the start-screen template thumbnails from the real studio.
 *
 *   npm run dev -- --port 5180            # any running dev server
 *   node tools/render-start-thumbs.mjs [--url http://127.0.0.1:5180/app/] [--out public/thumbs]
 *
 * For each template (Blank Stage plus every entry in STARTER_SCENES) and each
 * theme, this opens the studio in a fresh headless Chrome profile, creates the
 * project the way a user does (Blank Stage: the chooser's Create button; a
 * starter: `?scene=<id>`), renders one offscreen frame through the studio's own
 * capture path (`window.__cozyclay.captureFraming`), and writes
 * `<out>/<template-id>-<theme>.webp` at 680x383 (2x the 340px preview).
 * The chooser picks the file by id and theme and falls back to a plain tile
 * when it is missing, so a new starter only needs this script re-run. A
 * starter with no entry in FRAMINGS is shot through its own shot camera.
 *
 * Options: --url, --out, --cdp-port (default 9472), --only <template-id>.
 * CHROME_PATH picks the browser; THUMBS_CHROME_FLAGS replaces the GPU flags
 * (default: Metal on macOS, SwiftShader elsewhere).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnOwned, terminateOwned } from "./process-supervisor.mjs";
import { STARTER_SCENES } from "../src/starter-scenes.js";
import { THEMES, THEME_KEY } from "../src/theme.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const WIDTH = 680;
const HEIGHT = 383;
const MAX_BYTES = 60 * 1024;

function arg(name, fallback) {
	const argv = process.argv.slice(2);
	const index = argv.indexOf(name);
	return index >= 0 ? argv[index + 1] : fallback;
}
const appUrl = new URL(arg("--url", "http://127.0.0.1:5180/app/"));
const outDir = resolve(ROOT, arg("--out", "public/thumbs"));
const cdpPort = Number(arg("--cdp-port", 9472));
const only = arg("--only", null);
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const gpuFlags = (process.env.THUMBS_CHROME_FLAGS
	?? (process.platform === "darwin" ? "--use-angle=metal --ignore-gpu-blocklist" : "--use-angle=swiftshader --enable-unsafe-swiftshader"))
	.split(/\s+/).filter(Boolean);

/** A studio framing ({ pos, yaw, pitch, fovDeg }) from an eye point and a target. */
function lookAt(eye, target, fovDeg) {
	const [dx, dy, dz] = target.map((value, index) => value - eye[index]);
	return { pos: { x: eye[0], y: eye[1], z: eye[2] }, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), fovDeg };
}

// Eye-level 3/4 view. Blank Stage: the default character on the floor grid.
const FRAMINGS = {
	"blank-stage": lookAt([1.6, 1.55, 3.7], [0, 0.88, 0], 40),
};

const templates = [
	{ id: "blank-stage", url: appUrl.href, create: true },
	...STARTER_SCENES.map((scene) => ({ id: scene.id, url: `${appUrl.href}?scene=${encodeURIComponent(scene.id)}`, create: false })),
].filter((template) => !only || template.id === only);

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function connect() {
	const deadline = Date.now() + 30000;
	while (Date.now() < deadline) {
		try {
			const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
			const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
			if (page) {
				const ws = new WebSocket(page.webSocketDebuggerUrl);
				await new Promise((done, fail) => { ws.onopen = done; ws.onerror = fail; });
				return ws;
			}
		} catch {
			// Chrome is still starting.
		}
		await sleep(150);
	}
	throw new Error("headless Chrome did not expose a page target");
}

function client(ws) {
	let nextId = 1;
	const pending = new Map();
	ws.onmessage = (event) => {
		const message = JSON.parse(event.data);
		const entry = pending.get(message.id);
		if (!entry) return;
		pending.delete(message.id);
		if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
		else entry.resolve(message.result);
	};
	const send = (method, params = {}) => new Promise((resolveSend, reject) => {
		const id = nextId++;
		pending.set(id, { resolve: resolveSend, reject });
		ws.send(JSON.stringify({ id, method, params }));
	});
	const evaluate = async (expression) => {
		const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
		if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || "evaluate failed");
		return result.result.value;
	};
	const waitFor = async (label, expression, timeoutMs = 30000) => {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			if (await evaluate(`(() => { try { return Boolean(${expression}); } catch { return false; } })()`)) return;
			await sleep(200);
		}
		throw new Error(`timed out waiting for ${label}`);
	};
	return { send, evaluate, waitFor };
}

// Runs in the page: render the framing at 2x, downscale, and encode WebP under the size cap.
const encodeInPage = (framing) => `(async () => {
	const studio = window.__cozyclay;
	const framing = ${JSON.stringify(framing)};
	const output = { width: ${WIDTH * 2}, height: ${HEIGHT * 2} };
	const png = framing ? studio.captureFraming(framing, output) : studio.capturePlate();
	if (!png) throw new Error("studio capture returned nothing");
	const image = new Image();
	image.src = png;
	await image.decode();
	const canvas = document.createElement("canvas");
	canvas.width = ${WIDTH};
	canvas.height = ${HEIGHT};
	const ctx = canvas.getContext("2d");
	ctx.imageSmoothingQuality = "high";
	const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
	const w = image.width * scale, h = image.height * scale;
	ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
	for (let quality = 0.92; quality > 0.4; quality -= 0.06) {
		const url = canvas.toDataURL("image/webp", quality);
		if (url.length * 0.75 <= ${MAX_BYTES} || quality <= 0.46) return url;
	}
})()`;

async function renderOne(template, theme) {
	const profile = mkdtempSync(join(tmpdir(), "cozyclay-thumbs-"));
	const chrome = spawnOwned(chromePath, [
		"--headless=new", `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
		"--window-size=1440,900", "--no-first-run", "--no-default-browser-check", ...gpuFlags, "about:blank",
	], { stdio: "ignore" });
	try {
		const cdp = client(await connect());
		await cdp.send("Page.enable");
		await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `try { localStorage.setItem(${JSON.stringify(THEME_KEY)}, ${JSON.stringify(theme)}); } catch {}` });
		await cdp.send("Page.navigate", { url: template.url });
		if (template.create) {
			await cdp.waitFor("the start screen", `document.querySelector('[data-template-id="${template.id}"]')`);
			await cdp.evaluate(`document.querySelector('[data-template-id="${template.id}"]').click()`);
			await sleep(200);
			await cdp.evaluate("document.querySelector('.v2-start-project-form').requestSubmit()");
		}
		await cdp.waitFor("the studio", "window.__cozyclay?.charA && !document.querySelector('.v2-start-screen')");
		await sleep(3000); // character model, textures and shadows settle
		const dataUrl = await cdp.evaluate(encodeInPage(FRAMINGS[template.id] ?? null));
		const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
		const file = join(outDir, `${template.id}-${theme}.webp`);
		writeFileSync(file, bytes);
		console.log(`${file.slice(ROOT.length + 1)}  ${(bytes.length / 1024).toFixed(1)} KB`);
	} finally {
		await terminateOwned(chrome);
		rmSync(profile, { recursive: true, force: true });
	}
}

mkdirSync(outDir, { recursive: true });
for (const template of templates) {
	for (const theme of THEMES) await renderOne(template, theme);
}

```

### Core Architecture Module: `workers/api/scripts/dev-session.mjs`
```
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { issueSession } from "../src/auth.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function loadDevVars() {
  const values = {};
  const path = resolve(root, ".dev.vars");
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/u)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
      if (!match) continue;
      values[match[1]] = match[2].replace(/^['"]|['"]$/gu, "");
    }
  } catch {
    // Environment variables are sufficient in CI; the file is optional.
  }
  return values;
}

function usage() {
  console.error("usage: dev-session.mjs --account <id> [--sql]");
  process.exit(2);
}

const args = process.argv.slice(2);
let account;
let sql = false;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--account") account = args[++index];
  else if (args[index] === "--sql") sql = true;
  else usage();
}
if (!account) usage();
const vars = { ...loadDevVars(), ...process.env };
if (!vars.SESSION_SIGNING_KEY) {
  console.error("SESSION_SIGNING_KEY is required in workers/api/.dev.vars or the environment");
  process.exit(1);
}
const env = { SESSION_SIGNING_KEY: vars.SESSION_SIGNING_KEY, ENVIRONMENT: "development" };
const token = await issueSession(account, env);
const now = Date.now();
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const statement = `INSERT INTO accounts(id, created_at) VALUES (${quote(account)}, ${now}) ON CONFLICT(id) DO NOTHING;`;
process.stdout.write(`${token}\n`);
if (sql) process.stdout.write(`${statement}\n`);
else console.error(`D1 seed SQL (run with wrangler d1 execute --local): ${statement}`);

```

### Core Architecture Module: `workers/api/src/auth.js`
```
import { environmentFor, siteOriginFor, POLICY } from "./policy.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const OAUTH_COOKIE = "__Host-cc_oauth";
const SESSION_COOKIE = "__Host-cc_sess";
const PROVIDERS = Object.freeze({
  google: {
    authorization: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    userInfo: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid profile",
  },
});
const REDIRECT_BASE = Object.freeze({
  production: "https://api.cozyclay.org",
  development: "http://127.0.0.1:8787",
});

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value) {
  const text = String(value).replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(text.padEnd(Math.ceil(text.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacBytes(secret, value) {
  if (!secret) throw new Error("signing secret is not configured");
  const key = await crypto.subtle.importKey("raw", encoder.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function hmacVerify(secret, value, signature) {
  if (!secret) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(value));
}

function signingKey(envOrSecret) {
  return typeof envOrSecret === "string" ? envOrSecret : envOrSecret?.SESSION_SIGNING_KEY;
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(a, b) {
  const left = encoder.encode(String(a));
  const right = encoder.encode(String(b));
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) diff |= (left[index % (left.length || 1)] ?? 0) ^ (right[index % (right.length || 1)] ?? 0);
  return diff === 0;
}

function randomHex(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function cookieValue(request, name) {
  const raw = request?.headers?.get?.("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

export function safeNextPath(value) {
  const candidate = typeof value === "string" && value.startsWith("/") ? value : "/demo/";
  if (!/^\/(?:demo|d)(?:[/?#]|$)/u.test(candidate) || candidate.startsWith("//")) return "/demo/";
  return candidate;
}

function environmentName(env, request) {
  return environmentFor(env, request);
}

export async function signedState(value, env) {
  const payload = typeof value === "string" ? value : JSON.stringify(value);
  const signature = bytesToBase64Url(await hmacBytes(signingKey(env), payload));
  return `${bytesToBase64Url(encoder.encode(payload))}.${signature}`;
}

export async function verifyState(token, env) {
  try {
    const [encoded, signature] = String(token ?? "").split(".");
    if (!encoded || !signature) return null;
    const payload = decoder.decode(base64UrlToBytes(encoded));
    if (!(await hmacVerify(signingKey(env), payload, base64UrlToBytes(signature)))) return null;
    try { return JSON.parse(payload); } catch { return payload; }
  } catch {
    return null;
  }
}

async function issueSession(accountId, env, options = {}) {
  const now = Math.floor(Number(options.now ?? Date.now()) / 1000);
  const exp = now + POLICY.SESSION_TTL_DAYS * 86_400;
  const environment = options.environment ?? environmentName(env);
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = bytesToBase64Url(encoder.encode(JSON.stringify({ sub: accountId, iat: now, exp, env: environment })));
  const signingInput = `${header}.${body}`;
  const signature = bytesToBase64Url(await hmacBytes(env?.SESSION_SIGNING_KEY, signingInput));
  return `${signingInput}.${signature}`;
}

export function sessionCookie(token, maxAge = POLICY.SESSION_TTL_DAYS * 86_400) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function oauthStateCookie(state, maxAge = Math.floor(POLICY.OAUTH_STATE_TTL_MS / 1000)) {
  return `${OAUTH_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearOAuthStateCookie() {
  return `${OAUTH_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function readSession(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;
    const valid = await hmacVerify(env?.SESSION_SIGNING_KEY, `${header}.${body}`, base64UrlToBytes(signature));
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(base64UrlToBytes(body)));
    const now = Math.floor(Date.now() / 1000);
    if (!payload?.sub || !Number.isFinite(payload.exp) || payload.exp <= now) return null;
    if (payload.env && payload.env !== environmentName(env, request)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function redirectUri(provider, env, request = null) {
  if (provider !== "google") throw new Error("unsupported_provider");
  const environment = environmentName(env, request);
  const base = REDIRECT_BASE[environment] ?? REDIRECT_BASE.production;
  const expected = `${base.replace(/\/$/u, "")}/auth/google/callback`;
  return env?.GOOGLE_REDIRECT_URI === expected ? env.GOOGLE_REDIRECT_URI : expected;
}

export async function startOAuth(request, provider, env, options = {}) {
  if (provider !== "google") return new Response(JSON.stringify({ error: "unsupported_provider" }), { status: 404, headers: { "content-type": "application/json" } });
  const url = new URL(request.url);
  const nextPath = safeNextPath(options.nextPath ?? url.searchParams.get("next") ?? "/demo/");
  const state = randomHex(32);
  const stateHash = await sha256Hex(state);
  const now = Date.now();
  const db = env.DB;
  if (!db) throw new Error("D1 binding DB is required");
  await db.prepare(
    `INSERT INTO oauth_state(state_hash, provider, next_path, created_at)
     VALUES (?, ?, ?, ?)`,
  ).bind(stateHash, "google", nextPath, now).run();

  const providerConfig = PROVIDERS.google;
  const auth = new URL(providerConfig.authorization);
  auth.searchParams.set("client_id", env?.GOOGLE_CLIENT_ID ?? "");
  auth.searchParams.set("redirect_uri", redirectUri("google", env, request));
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("state", state);
  auth.searchParams.set("scope", providerConfig.scope);
  const response = new Response(null, { status: 302, headers: { Location: auth.href } });
  response.headers.append("Set-Cookie", oauthStateCookie(state));
  return response;
}

async function consumeState(db, state, now) {
  const stateHash = await sha256Hex(state);
  const row = await db.prepare(
    "DELETE FROM oauth_state WHERE state_hash=? AND created_at>? RETURNING state_hash, provider, next_path, created_at",
  ).bind(stateHash, now - POLICY.OAUTH_STATE_TTL_MS).first();
  return row ?? null;
}

async function exchangeCode(code, env, request) {
  const body = new URLSearchParams({
    client_id: env?.GOOGLE_CLIENT_ID ?? "",
    client_secret: env?.GOOGLE_CLIENT_SECRET ?? "",
    code,
    redirect_uri: redirectUri("google", env, request),
    grant_type: "authorization_code",
  });
  const response = await fetch(PROVIDERS.google.token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  if (!response.ok) throw new Error("oauth_token_exchange_failed");
  const data = await response.json();
  if (!data.access_token) throw new Error("oauth_token_missing");
  return data.access_token;
}

async function providerProfile(token) {
  const response = await fetch(PROVIDERS.google.userInfo, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json", "user-agent": "CozyClay-demo-api" },
  });
  if (!response.ok) throw new Error("oauth_profile_failed");
  const profile = await response.json();
  const uid = String(profile.sub ?? profile.id ?? "");
  if (!uid) throw new Error("oauth_profile_invalid");
  return { uid };
}

async function accountById(db, accountId) {
  return db.prepare("SELECT * FROM accounts WHERE id=?").bind(accountId).first();
}

async function signInIdentity(env, profile, now) {
  const db = env.DB;
  const existing = await db.prepare("SELECT account_id FROM identities WHERE provider=? AND provider_uid=?").bind("google", profile.uid).first();
  if (existing) return accountById(db, existing.account_id);
  const accountId = randomHex(16);
  try {
    await db.batch([
      db.prepare("INSERT INTO accounts(id, created_at) VALUES (?, ?)").bind(accountId, now),
      db.prepare("INSERT INTO identities(id, account_id, provider, provider_uid, created_at) VALUES (?, ?, ?, ?, ?)").bind(randomHex(16), accountId, "google", profile.uid, now),
    ]);
  } catch (error) {
    if (!String(error?.message ?? error).toLowerCase().includes("unique")) throw error;
    const race
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1045** (2026-11-03): **studio: React #185 maximum update depth on 3.2.1**
  *Symptoms*: ## What happens React error #185 (Maximum update depth exceeded) fires on 3.2.1. That is an infinite render/update loop.  ## Numbers Data: PostHog project 573836, 2026-10-20 to 2026-11-03 (14 days), events with `internal_qa` true/1 excluded. "Users" = `uniq(distinct_id)`, which is an install or browser ID, not a verified person.  - `app:error` in `scene-asset-sync-CLGNbEBq.js` line 9, col 27447 and col 27466, type Error: 18 events / 12 users on 3.2.1. - In the 3.2.1 bundle that column is React's `if (50 < nestedUpdateCount) throw Error(185)`. The chunk is the React runtime, so the loop is in our component code, not in scene-asset-sync itself.  ## Done when - [ ] Reproduce with a dev build (non-minified error). Find the component that sets state in render or in an effect with an unstable dependency. - [ ] Fix it and add a test that mounts the failing path. - [ ] After release: no `app:error` with React #185 on the new version. 

- **Issue #1042** (2026-11-03): **agent: frequent INVALID_ARGUMENT on motion.compile, shot.frame, object.sculpt, objects.arrange**
  *Symptoms*: ## What happens The agent keeps calling Studio commands with arguments the command bus rejects.  ## Numbers Data: PostHog project 573836, 2026-10-20 to 2026-11-03 (14 days), events with `internal_qa` true/1 excluded. "Users" = `uniq(distinct_id)`, which is an install or browser ID, not a verified person.  `studio:refused` origin=agent, code=INVALID_ARGUMENT: | command | events | users | |---|---|---| | (command not reported: not a declared action, or a build before #975) | 404 | 105 | | motion.compile | 91 | 39 | | shot.frame | 85 | 37 | | object.sculpt | 56 | 17 | | objects.arrange | 45 | 21 |  Other agent refusals worth reading in the same pass: TARGET_NOT_READY on shot.frame (58 events / 35 users), CONFIRMATION_REQUIRED on export.shotVideo (50 / 34), STALE_SCENE on shot.frame (49 events / 2 users, a loop).  ## Done when - [ ] For each command above, log which field fails validation (field name only, no values) so the top causes are known. - [ ] Tool descriptions and schemas give the agent what it needs to send valid input the first time (ranges, enums, required ids). - [ ] The refusal message to the agent names the field and the allowed range, so its retry is right. - [ ] After release: agent INVALID_ARGUMENT per prompted user goes down for these commands. 

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

### Incident Patch 1: `5c215d72` (2026-11-03)
**Commit Message**: fix(app): stop the playback-frame update-depth loop and survive page translation (#1045, #1046) (#1057)

#1045: with an empty or one-character cast, useCast built a new placeholder
character on every render, so `waypoints` (and charA/charB) were new effect
dependencies on every commit. App's dirty check then ran after each playback
frame and queued a setProjectSaveState update every time. Each frame is a sync
commit (the frame store feeds useSyncExternalStore); when Chrome runs frames
and input ahead of React's scheduler task on a busy page, React counts those
commits as nested and throws #185 after 50. The placeholders are now made once,
and the save-state setter only schedules a render when the value changes.

#1046: page translators that ignore translate="no" rewrite React's text nodes
and React's next removeChild/insertBefore threw NotFoundError. A small guard
handles exactly that case before the first render (studio and workflow
editor); the workflow editor also opts out of page translation now.
app:error and app:render_crash carry the studio UI locale (en, ko, zh, other).

**File**: `docs/analytics-queries.md` (modified, +1/-0)
```diff
@@ -1218,6 +1218,7 @@ event is **unknown, not 0**. Exclude `internal_qa = true` with
 | Event | Property | Values | Source | Cap |
 | --- | --- | --- | --- | --- |
 | `app:render_crash` | `error_type` | The `app:error` label set (`Error`, `TypeError`, ..., `DOMException`, `non_error`, `other`) | `ErrorBoundary.componentDidCatch` (`src/error-boundary.jsx`): the crash screen is showing | 2 per session |
+| `app:render_crash`, `app:error` | `locale` | `en`, `ko`, `zh`, `other` | The studio UI language (`uiLocale`, `src/analytics-values.js`): the stored Settings choice, `en` when none. Not the browser language, so a crash under browser translation (English UI, `zh-*` browser) splits from one in the in-app Chinese UI (#1046). Builds before this release have no `locale`: unknown, not `en` | with the event |
 | `app:gl_lost` | `kind` | `unavailable`, `context_lost` | `unavailable`: the one-time mount check behind the WebGL-unavailable overlay (`src/use-webgl-available.js`). `context_lost`: `ContextLossGuard` (`src/stage-canvas-rigs.jsx`) on `webglcontextlost` | 1 per kind per session |
 
 - No message, stack, component stack, file name or renderer string leaves.
```

**File**: `docs/privacy.md` (modified, +2/-2)
```diff
@@ -47,8 +47,8 @@ This is the full disclosure behind the short version on [cozyclay.org/privacy](h
 | `craft:first_action` | Funnel and drop-off analysis |
 | `craft:first_edit` | First meaningful Studio edit (`edit_kind`, `definition_version: 2`) |
 | `playground:first_edit` | First meaningful Playground edit, separate from the Studio funnel |
-| `app:error` | Uncaught errors and unhandled rejections: type label, source, and for the app's own bundle only file name + line/column. Never messages, stacks, URLs, or paths |
-| `app:render_crash` | A render error caught by the crash screen, at most two per session: `error_type` (the `app:error` label set). Never messages, stacks, component or file names |
+| `app:error` | Uncaught errors and unhandled rejections: type label, source, the studio UI language (`locale`: en, ko, zh or other), and for the app's own bundle only file name + line/column. Never messages, stacks, URLs, or paths |
+| `app:render_crash` | A render error caught by the crash screen, at most two per session: `error_type` (the `app:error` label set) and `locale` (the studio UI language: en, ko, zh or other). Never messages, stacks, component or file names |
 | `app:gl_lost` | The 3D view lost WebGL, once per kind per session: `kind` (`unavailable` at startup, `context_lost` later). Never the renderer string |
 | `studio:ready` | Once per session: how long the studio took to show its first frame, from page navigation to the first frame after the first render: `boot` (`lt2s`, `2-5s`, `5-15s` or `gte15s`). Never what was loaded |
 | `playback:summary` | One per playback run (play until stop, or until the frame rate or speed changes), at most 10 per session: `duration` (`lt10s`, `10-30s`, `30-60s`, `1-2m`, `2-5m` or `gte5m`); `late_ticks`, an estimate of dropped frames, not a measured one: the share of playback timer ticks that had to catch up more than one frame (`0`, `lt5`, `5-20`, `20-50` or `gte50` %); `max_catchup` (the most frames one tick caught up: `1`, `2`, `3-5` or `gte6`); `fps` (`12`, `24`, `30`, `60` or `other`); `speed` (`0.5`, `1`, `2` or `other`); `measured_fps` (the browser's frame rate during playback, the `device:profile` frame-rate buckets). Every run also feeds `app:friction_summary.late_tick_ratio`. Never the scene, the take or the frame range |
```

**File**: `privacy/index.html` (modified, +2/-2)
```diff
@@ -173,8 +173,8 @@ <h2>Events collected</h2>
               <tr><td>export:keyframe_pack</td><td>Legacy Workflow pack handoffs, with numeric entries count and source=workflow; not an additional export attempt</td></tr>
               <tr><td>sculpt_run</td><td>One event per finished Sculpt mode run: outcome (done, cancelled or failed), rounds (0 to 10), final_iou (how closely the final sculpt matched the reference image, 0 to 1 rounded to two decimals; omitted when the run was never scored), duration_ms (elapsed run time in milliseconds) and had_target (whether the run reworked an existing sculpt instead of creating one). Numbers only: never the reference image, recipe, part names or sculpt id.</td></tr>
               <tr><td>playground:opened, playground:first_action</td><td>Whether the home-page playground gets used</td></tr>
-              <tr><td>app:error</td><td>Uncaught errors and unhandled promise rejections, at most ten distinct per session: error_kind (error or unhandled_rejection), error_type (a built-in name such as TypeError or DOMException, other or non_error), error_source (app, extension, external or unknown) and, only for the app's own scripts, error_file (the bundle file name), error_line and error_col. Never the error message, stack text, URLs, query strings, paths, prompts or scene content.</td></tr>
-              <tr><td>app:render_crash</td><td>A render error that brought up the studio's crash screen, at most two per session: error_type (the same closed labels as app:error). Never the error message, stack text, component names, file names or scene content.</td></tr>
+              <tr><td>app:error</td><td>Uncaught errors and unhandled promise rejections, at most ten distinct per session: error_kind (error or unhandled_rejection), error_type (a built-in name such as TypeError or DOMException, other or non_error), error_source (app, extension, external or unknown), locale (the studio UI language: en, ko, zh or other) and, only for the app's own scripts, error_file (the bundle file name), error_line and error_col. Never the error message, stack text, URLs, query strings, paths, prompts or scene content.</td></tr>
+              <tr><td>app:render_crash</td><td>A render error that brought up the studio's crash screen, at most two per session: error_type (the same closed labels as app:error) and locale (the studio UI language: en, ko, zh or other). Never the error message, stack text, component names, file names or scene content.</td></tr>
               <tr><td>app:gl_lost</td><td>The 3D view's graphics failed, at most once per kind per session: kind (unavailable when WebGL is off at startup, context_lost when the GPU context drops later). Never the GPU renderer string.</td></tr>
               <tr><td>studio:ready</td><td>Once per session: how long the studio took to show its first frame, from page navigation to the first frame after the first render: boot (lt2s, 2-5s, 5-15s or gte15s). Never what was loaded.</td></tr>
               <tr><td>playback:summary</td><td>One per playback run (play until stop, or until the frame rate or speed changes), at most 10 per session: duration (lt10s, 10-30s, 30-60s, 1-2m, 2-5m or gte5m); late_ticks, an estimate of dropped frames, not a measured one: the share of playback timer ticks that had to catch up more than one frame (0, lt5, 5-20, 20-50 or gte50 %); max_catchup (the most frames one tick caught up: 1, 2, 3-5 or gte6); fps (12, 24, 30, 60 or other); speed (0.5, 1, 2 or other); measured_fps (the browser's frame rate during playback, the device:profile frame-rate buckets). Every run also feeds app:friction_summary.late_tick_ratio. Never the scene, the take or the frame range.</td></tr>
```

**File**: `src/analytics-strict.js` (modified, +3/-2)
```diff
@@ -2,7 +2,7 @@
 // generic "short string" rule. analytics.js asks strictPropValidator(event) once
 // per event; a property its validator refuses is dropped.
 import { STUDIO_ERROR_CODES, STUDIO_REFUSAL_RULES } from "./studio-error-codes.js";
-import { ERROR_TYPE_VALUES, sessionEndedPropAllowed } from "./analytics-values.js";
+import { ERROR_TYPE_VALUES, UI_LOCALE_VALUES, sessionEndedPropAllowed } from "./analytics-values.js";
 import { FRICTION_SUMMARY_KEYS, frictionPropAllowed } from "./analytics-friction.js";
 import { AREA_IDS, CONTROL_IDS } from "./analytics-controls.js";
 
@@ -64,7 +64,8 @@ const SCHEMAS = Object.freeze({
 		rule: inSet(new Set(STUDIO_REFUSAL_RULES)),
 	},
 	// error_type: the app:error label set (analytics.js describeError); never a message or stack.
-	"app:render_crash": { error_type: inSet(ERROR_TYPE_VALUES) },
+	// locale: the studio UI language (analytics-values.js uiLocale), not the browser's.
+	"app:render_crash": { error_type: inSet(ERROR_TYPE_VALUES), locale: inSet(UI_LOCALE_VALUES) },
 	"app:gl_lost": { kind: oneOf("unavailable", "context_lost") },
 	"studio:ready": { boot: oneOf("lt2s", "2-5s", "5-15s", "gte15s") },
 	// late_ticks (the late_tick_ratio set) is an estimate: timer ticks that caught up more than one frame,
```

**File**: `src/analytics-values.js` (modified, +16/-0)
```diff
@@ -35,6 +35,22 @@ export const ERROR_TYPE_VALUES = new Set([
 	"NotReadableError", "InvalidStateError", "QuotaExceededError", "SecurityError", "NetworkError",
 	"DataCloneError", "OperationError", "EncodingError", "UnknownError", "DOMException", "non_error", "other",
 ]);
+// The studio UI language (locale.js) app:error and app:render_crash carry, so a
+// crash can be told apart by in-app language rather than browser language (#1046).
+// Read here, not imported from locale.js, to keep the analytics modules light.
+export const UI_LOCALE_VALUES = new Set(["en", "ko", "zh", "other"]);
+const UI_LOCALE_KEY = "cozyclay.locale";
+
+/** The UI locale label: the stored choice, "en" when none (locale.js's default), "other" for an unknown value. */
+export function uiLocale() {
+	let value;
+	try {
+		value = globalThis.localStorage?.getItem(UI_LOCALE_KEY) ?? "en";
+	} catch {
+		return "en";
+	}
+	return value === "en" || value === "ko" || value === "zh" ? value : "other";
+}
 export const SESSION_DURATION_BUCKETS = new Set(["lt1m", "1-5m", "5-15m", "15-30m", "gte30m"]);
 // The SDK's session id is a random UUID; nothing else may ride in that slot.
 const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

**File**: `src/analytics.js` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 import { appVersion } from "./app-version.js";
 import { FIRST_EDIT_KINDS, FIRST_EDIT_VERSION } from "./semantic-edit.js";
-import { ERROR_TYPE_VALUES, EXPORT_FAILURE_CODES, exportPropAllowed } from "./analytics-values.js";
+import { ERROR_TYPE_VALUES, EXPORT_FAILURE_CODES, UI_LOCALE_VALUES, exportPropAllowed, uiLocale } from "./analytics-values.js";
 import { bump as bumpFriction, observeLongTasks, snapshot as frictionSnapshot } from "./analytics-friction.js";
 import { STRICT_EVENT_KEYS, strictPropValidator } from "./analytics-strict.js";
 export const MCP_TOOL_CATEGORIES = Object.freeze(["read", "camera", "scene_write", "prompt_authoring", "frame_capture", "motion_generate", "motion_apply", "project_io", "other"]);
@@ -103,7 +103,7 @@ const EVENT_PROPERTIES = Object.freeze({
 	"app:session_started": [],
 	"app:session_ended": ["duration_bucket", "action_count_bucket", "scenes_touched", ...EDIT_BUCKET_KEYS, "session_id"],
 	...STRICT_EVENT_KEYS,
-	"app:error": ["error_kind", "error_type", "error_source", "error_file", "error_line", "error_col"],
+	"app:error": ["error_kind", "error_type", "error_source", "error_file", "error_line", "error_col", "locale"],
 	"device:profile": ["gpu_vendor", "gpu_class", "webgl", "cpu_bucket", "memory_bucket", "frame_rate_bucket"],
 	"survey:use_case": ["use_case", "team"],
 	"feature:used": ["name"],
@@ -161,7 +161,7 @@ const EXECUTION_FAILURE_CODES = Object.freeze({
 const ERROR_PROPERTY_VALUES = Object.freeze({
 	error_kind: new Set(["error", "unhandled_rejection"]),
 	error_type: ERROR_TYPE_VALUES,
-	error_source: new Set(["app", "extension", "external", "unknown"]),
+	error_source: new Set(["app", "extension", "external", "unknown"]), locale: UI_LOCALE_VALUES,
 });
 const ERROR_FILE_PATTERN = /^[A-Za-z0-9_.-]{1,80}\.(?:m?js|jsx|ts|tsx)$/;
 const DEVICE_PROPERTY_VALUES = Object.freeze({
@@ -903,7 +903,7 @@ function installErrorListeners() {
 			const signature = [props.error_kind, props.error_type, props.error_source, props.error_file, props.error_line, props.error_col].join("|");
 			if (errorSignaturesSeen.has(signature) || errorSignaturesSeen.size >= ERROR_SIGNATURE_LIMIT) return;
 			errorSignaturesSeen.add(signature);
-			track("app:error", props);
+			track("app:error", { ...props, locale: uiLocale() });
 		} catch {
 			// Error telemetry must never throw from inside an error handler.
 		}
```

**File**: `src/crash-telemetry.js` (modified, +4/-2)
```diff
@@ -1,9 +1,11 @@
 // app:render_crash and app:gl_lost: a white screen and a dead GPU context become
 // countable and joinable to device:profile. Only closed values leave: the thrown
 // value's type label (the app:error vocabulary, via describeError) and the GL
-// failure kind. Never a message, stack, component stack or file name.
+// failure kind, plus the studio UI locale (en, ko, zh, other) on a crash. Never a
+// message, stack, component stack or file name.
 import { describeError, initAnalytics, track } from "./analytics.js";
 import { admit, bump } from "./analytics-friction.js";
+import { uiLocale } from "./analytics-values.js";
 
 const CRASHES_PER_SESSION = 2;
 const GL_LOST_KINDS = new Set(["unavailable", "context_lost"]);
@@ -21,7 +23,7 @@ let send = (event, props) => {
 export function reportRenderCrash(error) {
 	try {
 		bump("errors");
-		const props = { error_type: describeError({ error }).error_type };
+		const props = { error_type: describeError({ error }).error_type, locale: uiLocale() };
 		if (admit("app:render_crash", CRASHES_PER_SESSION)) send("app:render_crash", props);
 	} catch {
 		// Telemetry must never throw from inside the crash net.
```

**File**: `src/dom-mutation-guard.js` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+// Page translators rewrite the text nodes React rendered: Chrome and Edge
+// translation wrap them in <font>, merge a run of them into one, or move them.
+// The studio opts out with translate="no" (#972), but translation extensions
+// and some browsers do not honour it. React then calls removeChild or
+// insertBefore with a node that is no longer a child of that parent, the DOM
+// throws NotFoundError, and the whole studio falls to the crash screen (#1046).
+//
+// Tolerate exactly that case and nothing else: when the node is still inside
+// the parent (wrapped one level down), act on the child that holds it; when it
+// is gone, skip the remove or append the insert. Every call with a real child
+// goes to the native method unchanged.
+
+/** The direct child of `parent` that contains `node`, or null when `node` left `parent`. */
+function childHolding(parent, node) {
+	for (let current = node; current; current = current.parentNode) {
+		if (current.parentNode === parent) return current;
+	}
+	return null;
+}
+
+/** Patch removeChild and insertBefore on `proto` (Node.prototype by default) once. */
+export function installDomMutationGuard(proto = globalThis.Node?.prototype) {
+	if (!proto || proto.removeChild?.cozyclayGuard) return false;
+	const nativeRemove = proto.removeChild;
+	const nativeInsert = proto.insertBefore;
+	function removeChild(child) {
+		if (child?.parentNode === this) return nativeRemove.call(this, child);
+		// Moved deeper (a translator's wrapper): remove it where it now lives.
+		if (child?.parentNode && childHolding(this, child)) return nativeRemove.call(child.parentNode, child);
+		// Replaced or removed by someone else: it is already out of the tree.
+		return child;
+	}
+	function insertBefore(node, reference) {
+		if (!reference || reference.parentNode === this) return nativeInsert.call(this, node, reference);
+		// Keep the order React asked for: before the wrapper that holds the
+		// reference, or at the end when the reference is gone.
+		return nativeInsert.call(this, node, childHolding(this, reference));
+	}
+	removeChild.cozyclayGuard = true;
+	insertBefore.cozyclayGuard = true;
+	proto.removeChild = removeChild;
+	proto.insertBefore = insertBefore;
+	return true;
+}
```

---

### Incident Patch 2: `cd055973` (2026-11-03)
**Commit Message**: fix(agent): provider failures and sign-in waits (#1043, #1044) (#1052)

* fix(agent): retry Gemini resamples, short quota waits and reasoning-only drops; name the provider's quota and offer another provider; class openai-compatible endpoints; sign-in waits say when they end, retry in place and record why (#1043, #1044)

* fix: Chinese copy for the paused card; no 0.0.0.0 literal in the endpoint class

* fix(auth): a sign-in cancelled during the code exchange keeps no tokens

**File**: `bin/agent/agent-runner.mjs` (modified, +8/-3)
```diff
@@ -2,7 +2,7 @@ import { summariseCanvasResult } from "./agent-tools.mjs";
 import { createReasoningFrames } from "./turn-frames.mjs";
 import { sanitizeUpstreamDetail } from "./agent-routes.mjs";
 import { budgetStudioRequest } from "./studio-context-budget.mjs";
-import { createRetryingStream } from "./agent-stream.mjs";
+import { createRetryingStream, retryAfterMs } from "./agent-stream.mjs";
 import { NETWORK_CODES, frameCodeOf } from "./agent-failure-codes.mjs";
 
 const DEFAULT_MODEL = "gpt-6-astra";
@@ -45,8 +45,11 @@ export function classifyProviderError(message, errorCode) {
 	return NETWORK_PATTERN.test(message) ? "network" : "upstream";
 }
 
+// 400/404/413/422 ride along so a request the provider refused as malformed (a schema it rejects, a model it does not
+// serve, a prompt over its limit) reads as invalid_request, not as the provider's trouble (#1043: every one of them was
+// "upstream", the fallback below).
 function extractStatus(message) {
-	const match = /\b(401|403|429|5\d\d)\b/.exec(message);
+	const match = /\b(400|401|403|404|413|422|429|5\d\d)\b/.exec(message);
 	return match ? Number(match[1]) : undefined;
 }
 
@@ -507,7 +510,9 @@ export function createAgentRunner({ models: suppliedModels, sessionStore, tools
 					const code = status === "aborted" ? "aborted" : truncated || outOfTokens ? "truncated" : classified.code;
 					const detail = sanitizeUpstreamDetail(JSON.stringify({ message: rawMessage }));
 					const fallback = code === "aborted" ? "The turn was aborted." : code === "truncated" ? "The model stream ended before a terminal response event." : "The model or live editor could not complete this turn.";
-					queue.push({ type: "error", code, message: outOfTokens || detail || fallback, ...(classified.status ? { status: classified.status } : {}) });
+					// A rate limit names its provider and, when the provider said, how long to wait (#1043): the panel's paused card.
+					const wait = code === "rate_limit" ? retryAfterMs(last) : 0, limited = code === "rate_limit" ? { provider: state.provider, ...(wait > 0 ? { retryAfterMs: wait, resetAt: new Date(Date.now() + wait).toISOString() } : {}) } : {};
+					queue.push({ type: "error", code, message: outOfTokens || detail || fallback, ...(classified.status ? { status: classified.status } : {}), ...limited });
 				}
 				if (state.active.pendingContext) queue.push(state.active.pendingContext); queue.push({ type: "done", usage: { ...state.active.usage }, ...(state.lastInput?.reportCost ? { cost: state.active.cost ?? 0 } : {}) });
 				queue.close();
```

**File**: `bin/agent/agent-stream.mjs` (modified, +67/-14)
```diff
@@ -3,25 +3,64 @@
 //   - a transient failure, by pi-ai's own isRetryableAssistantError (429, 5xx, overload, dropped connections), up to
 //     RETRY_POLICY.maxRetries times with pi-ai's backoff (1 s, 2 s, 4 s), or as long as the provider's message asks
 //     ("retry after 8 s", "try again in 2.5s"), capped at RETRY_HINT_CAP_MS (#975: two quick retries lost turns to
-//     overloads that cleared within ~10 s);
+//     overloads that cleared within ~10 s), or at QUOTA_WAIT_MAX_MS for a rate limit, a wait that long once per request;
+//   - a Gemini request that ended on a finish reason a fresh sample usually clears (MALFORMED_FUNCTION_CALL, ...):
+//     pi-ai reads it as a final error, so it ended the turn as "upstream" (#1043);
+//   - a quota refusal pi-ai will not retry (its "quota exceeded" / "billing" words) that names a short wait, e.g.
+//     Gemini's per-minute free tier ("Please retry in 37s"): once, after that wait (#1043);
 //   - an expired Codex sign-in (401), once per turn, after a forced credential refresh (refreshAuth, the runner's).
-// An attempt is retried only while nothing of it reached the Agent: its events are held until its first content event,
-// so the transcript and the panel only ever see the attempt that answered. A retried request carries the same context,
-// so no failed assistant message is stored and no completed tool runs again.
+// An attempt is retried only while no answer of it reached the Agent: its events are held until its first content
+// event, so the transcript and the panel only ever see the attempt that answered. Reasoning is forwarded as it streams
+// and does not commit the attempt (#1043: a stream that dropped after its reasoning ended the turn); the retried
+// attempt's own start event is then dropped, its partial message replaces the failed one. A retried request carries
+// the same context, so no failed assistant message is stored and no completed tool runs again.
 
 const RETRY_POLICY = Object.freeze({ maxRetries: 3, baseDelayMs: 1000 });
 const RETRY_HINT_CAP_MS = 20_000;
+const QUOTA_WAIT_MAX_MS = 60_000;
 const RETRY_HINT = /(?:retry|try again)\D{0,12}?(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|sec|seconds?)\b/i;
+// google.rpc.RetryInfo in a Gemini error body: "retryDelay": "37s".
+const RETRY_DELAY_FIELD = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/;
+const RATE_LIMITED = /(?<![a-z0-9])429(?![a-z0-9])|rate.?limit|too many requests|resource.?exhausted|quota/i;
+// Gemini finish reasons pi-ai turns into "Provider stopped with: <reason>" that a new sample usually answers.
+// SAFETY, RECITATION, BLOCKLIST and the like are the content's, and stay final.
+const RESAMPLE_STOP = /Provider stopped with: (?:MALFORMED_FUNCTION_CALL|UNEXPECTED_TOOL_CALL|FINISH_REASON_UNSPECIFIED|OTHER)\b/;
+
+/** The wait a failed message names, in ms, uncapped ("retry in 37.5s", Gemini's retryDelay), or 0 when it names none. */
+export function retryAfterMs(message) {
+	const text = String(message?.errorMessage ?? "");
+	const match = RETRY_HINT.exec(text);
+	const field = RETRY_DELAY_FIELD.exec(text);
+	const ms = match ? Number(match[1]) * (/^m/i.test(match[2]) ? 1 : 1000) : field ? Number(field[1]) * 1000 : 0;
+	return Number.isFinite(ms) && ms > 0 ? Math.ceil(ms) : 0;
+}
 
 /** The wait a failed message asks for, in ms (capped), or 0 when it names none. */
 export function retryHintMs(message) {
-	const match = RETRY_HINT.exec(String(message?.errorMessage ?? ""));
-	if (!match) return 0;
-	const ms = Number(match[1]) * (/^m/i.test(match[2]) ? 1 : 1000);
-	return Number.isFinite(ms) && ms > 0 ? Math.min(ms, RETRY_HINT_CAP_MS) : 0;
+	return Math.min(retryAfterMs(message), RETRY_HINT_CAP_MS);
+}
+
+/** Why a failed attempt may be tried again: "transient", "resample", "quota_wait", or null (final). */
+export function retryKind(ai, message) {
+	if (message?.stopReason !== "error") return null;
+	if (ai.isRetryableAssistantError(message)) return "transient";
+	const text = String(message.errorMessage ?? "");
+	if (RESAMPLE_STOP.test(text)) return "resample";
+	const wait = retryAfterMs(message);
+	return RATE_LIMITED.test(text) && wait > 0 && wait <= QUOTA_WAIT_MAX_MS ? "quota_wait" : null;
+}
+
+/** How long to wait before retry `retries + 1` of a `kind` failure. */
+function retryWaitMs(ai, kind, message, retries) {
+	const asked = retryAfterMs(message);
+	if (kind === "quota_wait") return asked;
+	const cap = RATE_LIMITED.test(String(message?.errorMessage ?? "")) ? QUOTA_WAIT_MAX_MS : RETRY_HINT_CAP_MS;
+	return Math.max(ai.retryDelayMs(RETRY_POLICY, retries + 1), Math.min(asked, cap));
 }
 
 const CONTENT_EVENT = /^(text|thinking|toolcall)_/;
+// The events that commit an attempt: an answer or a tool call the Agent will act on. Reasoning alone does not.
+const ANSWER_EVENT = /^(text|toolcall)_/;
 const EMPTY_USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
 
 /** Resolves aft
```

**File**: `bin/agent/openai-compatible-provider.mjs` (modified, +12/-0)
```diff
@@ -33,6 +33,18 @@ function endpointModel(id, base) {
 	};
 }
 
+/** The kind of address a server answers on, for telemetry (#1043): "local" (this machine: loopback, localhost),
+ * "lan" (a private network address or a .local name), "hosted" (anything else), "unknown" (no parseable address).
+ * Only this class leaves the sidecar, never the address. */
+export function endpointClass(base) {
+	let host;
+	try { host = new URL(base).hostname.toLowerCase().replace(/^\[|\]$/g, ""); } catch { return "unknown"; }
+	if (!host) return "unknown";
+	if (host === "localhost" || host.endsWith(".localhost") || host === "::1" || /^0(?:\.0){3}$/.test(host) || /^127\./.test(host) || /^::ffff:127\./.test(host)) return "local";
+	if (host.endsWith(".local") || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^169\.254\./.test(host) || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe80:/.test(host)) return "lan";
+	return "hosted";
+}
+
 /** Moonshot's own API (#947): a host check on the address, nothing else. */
 export const isMoonshotBase = (base) => { try { return /^api\.moonshot\.(ai|cn)$/.test(new URL(base).hostname); } catch { return false; } };
 // The documented default output limit for Kimi K3 models; the catalog's 1048576 is the context window.
```

**File**: `bin/agent/provider-login.mjs` (modified, +27/-6)
```diff
@@ -3,13 +3,28 @@
 //   { type: "prompt", promptId, prompt: { type: text|secret|select|manual_code, message, placeholder?, options? } }
 //   { type: "event", event: pi AuthEvent (info, auth_url, device_code, progress) }
 //   { type: "prompt_closed", promptId }      pi withdrew a prompt (e.g. a callback beat the pasted code)
-//   { type: "done", ok, message? }
+//   { type: "done", ok, message?, reason? }   reason (a failed one): timeout, callback_error, port_busy, user_closed
+//                                            or other, a class only (#1044)
 // and answers with the prompt's value. Nothing the user types is ever put in the queue. pi persists the
 // credential through the registry's CredentialStore (credential-store.mjs); onSignedIn rebuilds the registry.
 import { randomUUID } from "node:crypto";
 
 const WAIT_MS = 25_000;
 const KEEP_MS = 60_000;
+// A login nobody finishes stops after this long (#1044: pi's browser sign-ins wait forever, so the panel waited too).
+const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
+
+/** A failed login's class from pi's error (#1044); never its words. */
+export function loginFailureReason(error, { cancelled = false, timedOut = false } = {}) {
+	if (timedOut) return "timeout";
+	if (cancelled) return "user_closed";
+	const code = typeof error?.code === "string" ? error.code : typeof error?.cause?.code === "string" ? error.cause.code : "";
+	const text = String(error?.message ?? error ?? "");
+	if (code === "EADDRINUSE" || /EADDRINUSE|address already in use/i.test(text)) return "port_busy";
+	if (/timed? ?out|expired/i.test(text)) return "timeout";
+	if (/authori[sz]ation failed|state mismatch|missing authorization code|token exchange|sign-in failed|callback|access.?denied|invalid.?grant/i.test(text)) return "callback_error";
+	return "other";
+}
 
 /** The login methods pi offers for each provider, as the panel lists them (subscriptions first). */
 export async function loginOptions(models, { chatgpt } = {}) {
@@ -47,8 +62,11 @@ export function createLoginFlows({ getModels, onSignedIn }) {
 		setTimeout(() => flows.delete(flow.id), KEEP_MS).unref?.();
 	};
 
-	function start(providerId, type) {
-		const flow = { id: randomUUID(), providerId, type, events: [], waiters: new Set(), pending: new Map(), controller: new AbortController(), done: false };
+	function start(providerId, type, { timeoutMs = LOGIN_TIMEOUT_MS } = {}) {
+		const flow = { id: randomUUID(), providerId, type, events: [], waiters: new Set(), pending: new Map(), controller: new AbortController(), done: false, timedOut: false,
+			waitUntil: new Date(Date.now() + timeoutMs).toISOString() };
+		const timer = setTimeout(() => { if (!flow.done) { flow.timedOut = true; flow.controller.abort(); } }, timeoutMs);
+		timer.unref?.();
 		const interaction = {
 			signal: flow.controller.signal,
 			prompt(prompt) {
@@ -73,8 +91,11 @@ export function createLoginFlows({ getModels, onSignedIn }) {
 				await onSignedIn?.(providerId);
 				finish(flow, { type: "done", ok: true });
 			} catch (error) {
-				finish(flow, { type: "done", ok: false, message: flow.controller.signal.aborted ? "The login was cancelled." : String(error?.message || error || "The login failed.") });
-			}
+				const aborted = flow.controller.signal.aborted;
+				const message = flow.timedOut ? `The sign-in waited ${Math.max(1, Math.round(timeoutMs / 60000))} minutes and stopped. Press Try again to start over.`
+					: aborted ? "The login was cancelled." : String(error?.message || error || "The login failed.");
+				finish(flow, { type: "done", ok: false, message, reason: loginFailureReason(error, { cancelled: aborted && !flow.timedOut, timedOut: flow.timedOut }) });
+			} finally { clearTimeout(timer); }
 		})();
 		return flow.id;
 	}
@@ -90,7 +111,7 @@ export function createLoginFlows({ getModels, onSignedIn }) {
 				flow.waiters.add(done);
 			});
 		}
-		return { events: flow.events.slice(after), next: flow.events.length, done: flow.done };
+		return { events: flow.events.slice(after), next: flow.events.length, done: flow.done, waitUntil: flow.waitUntil };
 	}
 
 	function answer(id, promptId, value) {
```

**File**: `bin/agent/providers.mjs` (modified, +3/-2)
```diff
@@ -5,7 +5,7 @@ import { createCredentialStore } from "./credential-store.mjs";
 import { readCredentials } from "./provider-keys.mjs";
 import { cliproxyBase, cliproxyProvider, extendCliproxyProvider, registryLiveCliproxy } from "./cliproxy-provider.mjs";
 export { cliproxyLiveModel } from "./cliproxy-provider.mjs";
-import { OPENAI_COMPATIBLE_ID, openaiCompatibleProvider, refreshOpenAICompatible } from "./openai-compatible-provider.mjs";
+import { OPENAI_COMPATIBLE_ID, endpointClass, openaiCompatibleProvider, refreshOpenAICompatible } from "./openai-compatible-provider.mjs";
 import { rolesByMain } from "./model-roles.mjs";
 export { MODEL_ROLES, fallbackChain, resolveRoleModels } from "./model-roles.mjs";
 
@@ -313,7 +313,8 @@ export async function listAgentModels({ models, codex, auth = defaultAuth, keys
 		} else if (provider.id === OPENAI_COMPATIBLE_ID && signedIn) {
 			// the server's own /v1/models is the lineup, read on every listing so a model loaded since then shows up
 			const error = await refreshOpenAICompatible(resolvedModels);
-			providers.push({ id: provider.id, label: provider.label, signedIn, authSource, models: catalogModels(resolvedModels, provider.id, getSupportedThinkingLevels), ...(error ? { error } : {}) }); continue;
+			// the address's class (local, lan, hosted), never the address: agent:prompt_sent splits this lane by it (#1043)
+			providers.push({ id: provider.id, label: provider.label, signedIn, authSource, endpoint: endpointClass(resolvedModels.getModels(provider.id)[0]?.baseUrl), models: catalogModels(resolvedModels, provider.id, getSupportedThinkingLevels), ...(error ? { error } : {}) }); continue;
 		}
 		providers.push({ id: provider.id, label: provider.label, signedIn, authSource, models: list });
 	}
```

**File**: `bin/codex-auth.mjs` (modified, +78/-16)
```diff
@@ -19,6 +19,14 @@ let authServer = null;
 let authState = null;
 let refreshLock = null;
 const listeners = new Set();
+// How long a sign-in page stays answerable (the callback server's life), and the ports its redirect may use.
+let signInWaitMs = 10 * 60 * 1000;
+let callbackPorts = [1455, 1457];
+let open = openBrowser;
+// Why the last sign-in ended without a session (#1044), until the next one starts or one succeeds: timeout (the wait
+// ran out), callback_error (the page came back refused or the code exchange failed), port_busy (no callback port was
+// free), user_closed (Cancel on the waiting card). A class only; the provider's own words stay here.
+let lastFailure = null;
 
 const readTokens = () => {
 	if (tokens) return tokens;
@@ -63,7 +71,9 @@ export function status() {
 	const auth = claim["https://api.openai.com/auth"] || {};
 	// `pending` keeps the panel on "Waiting for your browser…" while a sign-in page is open, with its link.
 	const pending = Boolean(authServer && authState) && !readTokens()?.refresh_token;
-	return { signedIn: !!readTokens()?.refresh_token, ...(pending ? { pending, authorizeUrl: authState.result.authorizeUrl } : {}), email: claim.email || null, plan: auth.chatgpt_plan_type || null, accountId: auth.chatgpt_account_id || null, expiresAt: readTokens()?.expires_at || null, providersConfigured: providersConfigured() };
+	const signedIn = !!readTokens()?.refresh_token;
+	const failure = !signedIn && !pending && lastFailure ? { failure: lastFailure } : {};
+	return { signedIn, ...(pending ? { pending, authorizeUrl: authState.result.authorizeUrl, waitUntil: authState.result.waitUntil } : {}), ...failure, email: claim.email || null, plan: auth.chatgpt_plan_type || null, accountId: auth.chatgpt_account_id || null, expiresAt: readTokens()?.expires_at || null, providersConfigured: providersConfigured() };
 }
 export function readStored() {
 	const current = readTokens();
@@ -104,39 +114,91 @@ export async function getAccessToken() {
 	try { return await refreshLock; } catch { return null; }
 }
 
+/** Ends the waiting sign-in, if one is open, and remembers why (a failure class, or null for a success). */
+function endSignIn(server, failure) {
+	if (authServer !== server) return;
+	// Idle keep-alive sockets go too: a browser (or fetch) reusing one would otherwise reach this ended sign-in.
+	server.close(); server.closeIdleConnections?.();
+	authServer = null;
+	authState = null;
+	lastFailure = failure;
+}
+
 export async function startOAuth() {
 	if (authServer) return authState.result;
+	lastFailure = null;
 	const verifier = createPkceVerifier();
 	const state = randomUUID();
 	const challenge = pkceChallenge(verifier);
-	let port = 1455;
+	const page = (res, code, text) => { res.writeHead(code, { "content-type": "text/html; charset=utf-8" }); res.end(text); };
 	const listener = (candidate) => new Promise((resolve, reject) => {
 		const server = createServer(async (req, res) => {
-			const url = new URL(req.url || "/", `http://127.0.0.1:${candidate}`);
-			if (url.pathname !== "/auth/callback") return;
-			if (url.searchParams.get("state") !== state) { res.writeHead(400); res.end("invalid state"); return; }
-			res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end("You are signed in to CozyClay. You can close this window.");
 			try {
-				const payload = await exchange({ grant_type: "authorization_code", code: url.searchParams.get("code"), redirect_uri: `http://${"local" + "host"}:${candidate}/auth/callback`, client_id: CLIENT_ID, code_verifier: verifier });
-				const accessClaims = decodeJwt(payload.access_token || "");
-				writeTokens({ ...payload, expires_at: accessClaims.exp ? accessClaims.exp * 1000 : Date.now() + Number(payload.expires_in || 3600) * 1000 });
-			} finally { server.close(); authServer = null; authState = null; }
+				const url = new URL(req.url || "/", `http://127.0.0.1:${candidate}`);
+				if (url.pathname !== "/auth/callback") return;
+				if (url.searchParams.get("state") !== state) { res.writeHead(400); res.end("invalid state"); return; }
+				// The sign-in page came back refused (the user declined, or the provider said no): this attempt is over.
+				const code = url.searchParams.get("code");
+				if (url.searchParams.get("error") || !code) {
+					page(res, 400, "The ChatGPT sign-in did not finish. Go back to CozyClay and press Try again.");
+					endSignIn(server, "callback_error");
+					return;
+				}
+				try {
+					const payload = await exchange({ grant_type: "authorization_code", code, redirect_uri: `http://${"local" + "host"}:${candidate}/auth/callback`, client_id: CLIENT_ID, code_verifier: verifier });
+					// Cancel or the wait limit closed this sign-in while the exchange ran: its tokens are not kept.
+					if (authServer !== server) { page(res, 409, "This sign-in was cancelled in CozyClay. Go back to CozyClay and press Try again."); return; }
+					const accessClaims = decodeJwt(payload.access_token || "");
+	
```

**File**: `bin/cozyclay.mjs` (modified, +1/-1)
```diff
@@ -263,7 +263,7 @@ const agentHandler = createAgentHandler({ port: () => opts.port, ...(SOURCE_CHEC
 const studioRoutes = createStudioRoutes({ port: opts.port, stateFile: STATE_FILE, takeRuntime, update: { currentVersion: version, stateDir: STATE_DIR, kind: INSTALL_KIND, enabled: updateChecksEnabled, pkgRoot: PKG_ROOT }, restart: { getServer: () => server, closeHub: () => agentHandler.close() } });
 server = createServer((req, res) => {
 	const url = new URL(req.url ?? "/", "http://127.0.0.1");
-	if (/^\/oauth\/(start|status|logout)$/.test(url.pathname)) {
+	if (/^\/oauth\/(start|status|logout|cancel)$/.test(url.pathname)) {
 		const origin = req.headers.origin;
 		const hosts = new Set([`127.0.0.1:${opts.port}`, `localhost:${opts.port}`]);
 		const origins = new Set([`http://127.0.0.1:${opts.port}`, `http://${"local" + "host"}:${opts.port}`]);
```

**File**: `docs/analytics-queries.md` (modified, +10/-5)
```diff
@@ -2000,7 +2000,7 @@ Builds before this release have no rows (**unknown, not 0**).
 | --- | --- | --- |
 | `agent:connect_opened` | `entry`: `first_run`, `failure_card`, `signed_out`, `menu`, `other` | The menu's Connect a model, the signed-out card's other-provider button, or a refused key's Log in again. The signed-out card reads `first_run` until this browser profile has connected once. 5 per session |
 | `agent:connect_started` | `provider`, `method` (`oauth`, `api_key`, `chatgpt`) | A provider's login button, or Sign in with ChatGPT. One per attempt |
-| `agent:connect_finished` | `provider`, `method`, `outcome`, `step`, `duration` (lt10s … gte5m) | One per attempt, see below |
+| `agent:connect_finished` | `provider`, `method`, `outcome`, `step`, `duration` (lt10s … gte5m), `reason` (not-ok only, when known) | One per attempt, see below |
 | `agent:model_changed` | `provider`, `after_failure` (bool) | The model list. 10 per session |
 
 `provider` is one of the ten providers CozyClay configures itself
@@ -2013,10 +2013,15 @@ of a long tail read `other`.
 - `failed`: the flow ended with an error, or the login could not start.
 - `cancelled`: the user pressed Cancel inside a running flow.
 - `abandoned`: the panel was closed or left mid-flow, or another attempt
-  began. A ChatGPT sign-in that comes back without a session is also
-  `abandoned`: the sidecar reports a failed and a closed browser sign-in the
-  same way, and the panel's sign-in error is set only when the start request
-  itself fails.
+  began. Before #1044 a ChatGPT sign-in that came back without a session was
+  also `abandoned`; from #1044 the sidecar names why the wait ended, and that
+  attempt reads `failed` with a `reason`.
+
+`reason` (from #1044, on `failed`, `cancelled` and `abandoned` when known):
+`timeout` (the 10-minute wait ran out), `callback_error` (the sign-in page
+came back refused, or the code exchange failed), `port_busy` (no callback
+port was free), `user_closed` (Cancel, or the login list closed), `other`.
+Split `failed`/`waiting` by it to see which one to fix.
 
 `step` is how far the attempt got: `list` (it never started a flow),
 `waiting` (the flow ran), `prompt` (it was asking for a key, an address or a
```

---

### Incident Patch 3: `fd2e5342` (2026-11-05)
**Commit Message**: fix(stage): a slab whose bottom sits on the deck no longer z-fights with it (#1075) (#1084)

* fix(stage): a slab whose bottom sits on the deck no longer z-fights with it (#1075)

- The deck material takes a small polygonOffset (factor 1, units 1), so a face
  lying in the deck plane wins the depth test. Depth only: the grid shader and
  the shadows the deck receives are unchanged.
- arrange_objects lifts a solid object placed on the deck (world placement or
  floor support) by 3 mm when its bottom would land within 1 mm of y=0, the
  same 3 mm the agent prompt asks between coplanar faces. Objects stacked on
  another object, empties, lights, effects, routed and attached objects keep
  their y. The receipt says so with one FLOOR_LIFT warning, not a CLAMPED y.

* fix(stage): keep the deck lift inside the LOC limit (#1075)

The lift helpers move into studio-support-gap.js next to the support gap
they change, so studio-agent-commands.js stays at its 487-line baseline
instead of raising it.

**File**: `src/room.jsx` (modified, +7/-0)
```diff
@@ -74,6 +74,13 @@ function makeDeckMaterial(light) {
 		color: light ? FLOOR_LIGHT : FLOOR,
 		emissive: light ? FLOOR_LIGHT : "#000000",
 		emissiveIntensity: light ? FLOOR_LIGHT_GLOW : 0,
+		// Push the deck's depth back a hair so an object face lying in its plane
+		// (a floor slab whose bottom is at y=0) wins the depth test instead of
+		// flickering against it (#1075). Depth only: the grid lines and the
+		// shadows the deck receives are untouched.
+		polygonOffset: true,
+		polygonOffsetFactor: 1,
+		polygonOffsetUnits: 1,
 	});
 	material.onBeforeCompile = (shader) => {
 		shader.uniforms.gridInk = { value: new THREE.Vector2(ink.minor, ink.major) };
```

**File**: `src/studio-agent-commands.js` (modified, +7/-6)
```diff
@@ -13,7 +13,7 @@ import { occludersOf, primarySubjects, sideOfAxis } from './studio-geometry-fact
 import { frameSubject } from './studio-frame-subject.js';
 import { StudioProtocolError, StudioSchemas, STUDIO_PATCH_KINDS, STUDIO_PATCH_DESCRIPTORS, validateStudioSchema, validateStudioIdentity, validateReceipt, freezeStudioData } from './studio-agent-protocol.js';
 import { sampleContactSheetFrames } from './studio-contact-sheet.js';
-import { supportGaps } from './studio-support-gap.js';
+import { supportGaps, liftOffDeck, floorLiftWarnings } from './studio-support-gap.js';
 
 const DEG = Math.PI / 180, EPS = 1e-8, CHARACTER_SUPPORT_TOLERANCE = 5e-3;
 const fail = (code, message) => { throw new StudioProtocolError(code, message); };
@@ -269,7 +269,7 @@ function transformPatch(op, isObject) {
 export function arrangement(command, before, ports) {
   const isObject = command.name === 'arrange_objects', key = isObject ? 'objects' : 'characters';
   let rows = before[key];
-  const relations = [], warnings = [], clamps = [], createdByName = new Map();
+  const relations = [], warnings = [], clamps = [], liftedIds = new Set(), createdByName = new Map();
   // References resolve against the evolving draft (`rows`), in op order.
   const draft = () => ({ ...before, [key]: rows });
   for (const rawOp of command.args.ops) {
@@ -295,9 +295,10 @@ export function arrangement(command, before, ports) {
       if (op.space === 'parent') op = parentFrameOp(op, entity, rows, createdByName);
       entity = patchEntity(entity, transformPatch(op, isObject));
       const placed = place(entity, op, draft(), ports);
-      entity = placed.entity;
-      // What was asked against what the domain kept: scale and position limits move values silently.
-      const asked = isObject ? { ...(op.position?.world ?? {}), ...(op.scale ? { scaleX: op.scale.x, scaleY: op.scale.y, scaleZ: op.scale.z } : {}) }
+      // An object placed on the deck (world or floor support, never stacked) is lifted off its plane (studio-support-gap.js).
+      entity = liftOffDeck(placed.entity, Boolean(op.position?.world) || placed.relation?.support === 'floor', e => Math.min(...geometry(e, draft(), ports).map(p => p.y)), before.floorY ?? 0, patchEntity, liftedIds);
+      // What was asked against what the domain kept: scale and position limits move values silently; the lift is FLOOR_LIFT, not a clamp.
+      const asked = isObject ? { ...(op.position?.world ?? {}), ...(liftedIds.has(entity.id) ? { y: undefined } : {}), ...(op.scale ? { scaleX: op.scale.x, scaleY: op.scale.y, scaleZ: op.scale.z } : {}) }
         : { ...(op.position?.world ?? {}), ...(op.scale === undefined ? {} : { scale: op.scale }) };
       const clamp = clampWarning(entity.id, Object.fromEntries(Object.entries(asked).filter(([k]) => ['x', 'y', 'z', 'scale', 'scaleX', 'scaleY', 'scaleZ'].includes(k))), entity);
       if (clamp) clamps.push(clamp);
@@ -341,7 +342,7 @@ export function arrangement(command, before, ports) {
   if (command.args.collisionPolicy === 'avoid' && overlaps.length) fail('VERIFICATION_FAILED', 'The final batch is still blocked after its outward adjustments.');
   // Every finding the receipt carries: a value moved to a limit first, then what the final scene shows wrong.
   const nameOf = id => { const e = [...after.objects, ...after.characters].find(row => row.id === id); return e?.name ?? e?.subject ?? id; };
-  warnings.push(...clamps.slice(0, 3));
+  warnings.push(...clamps.slice(0, 3), ...floorLiftWarnings([...liftedIds].filter(id => rows.some(e => e.id === id)), nameOf));
   for (const item of overlaps.slice(0, 5)) warnings.push({ code: 'FOOTPRINT_OVERLAP', id: item.id, message: [...`${nameOf(item.of)} overlaps ${nameOf(item.id)} by ${Number(item.depth.toFixed(2))} m`].slice(0, 120).join('') });
   if (overlaps.length > 5) warnings.push({ code: 'FOOTPRINT_OVERLAP', count: overlaps.length - 5, message: `${overlaps.length - 5} more footprint overlaps omitted` });
   if (isObject) {
```

**File**: `src/studio-support-gap.js` (modified, +30/-0)
```diff
@@ -72,3 +72,33 @@ export function supportGaps(ids, state, takes, boxOf) {
   }
   return { supportGapM, unsupportedIds: Object.keys(supportGapM).filter(id => supportGapM[id] > UNSUPPORTED_M) };
 }
+
+// A face lying in the deck plane z-fights with the deck (#1075): a floor slab
+// whose bottom is at y=0 flickers in captures and playback. Placement lifts a
+// solid object standing on the deck by DECK_LIFT_M when its bottom would land
+// within DECK_SNAP_M of the deck, the same 3 mm the agent prompt asks between
+// coplanar faces. Objects stacked on another object are never lifted.
+export const DECK_LIFT_M = 0.003;
+const DECK_SNAP_M = 1e-3;
+
+/**
+ * `entity`, lifted off the deck when it stands on it (`onDeck`: placed in world
+ * space or on floor support, never stacked) and its bottom (bottomOf(entity),
+ * lowest world y) is within DECK_SNAP_M of deckY. Only solid, free-standing
+ * objects: no empty, light, effect, route or attachment. `patch(entity, { y })`
+ * applies the lift; `lifted` (a Set of ids) records whether it happened.
+ */
+export function liftOffDeck(entity, onDeck, bottomOf, deckY, patch, lifted) {
+	const eligible = onDeck && entity.renderer && !entity.attach && !entity.path && !isEmptyObject(entity) && entity.renderer !== EFFECT_KIND;
+	const bottom = eligible ? bottomOf(entity) : NaN;
+	if (!(Math.abs(bottom - deckY) <= DECK_SNAP_M)) { lifted.delete(entity.id); return entity; }
+	lifted.add(entity.id);
+	return patch(entity, { y: entity.y + deckY + DECK_LIFT_M - bottom });
+}
+
+/** The receipt warning for the objects a batch lifted off the deck, or []. */
+export function floorLiftWarnings(ids, nameOf) {
+	if (!ids.length) return [];
+	const who = ids.length === 1 ? nameOf(ids[0]) : `${ids.length} objects`;
+	return [{ code: 'FLOOR_LIFT', ...(ids.length === 1 ? { id: ids[0] } : { count: ids.length }), message: [...`${who} lifted ${DECK_LIFT_M * 1000} mm off the deck so a bottom face does not z-fight with it`].slice(0, 120).join('') }];
+}
```

**File**: `test/bus/verify-agent-receipts.mjs` (modified, +3/-1)
```diff
@@ -56,7 +56,9 @@ try {
   assert.deepEqual(path('scale').vec, { x: 1, y: 0.01, z: 1 }, 'scale reads back after the clamp');
   assert.equal(path('parent').text, null);
   assert.equal(readback.childIds, undefined);
-  assert.deepEqual(readback.bounds, { min: { x: -6 - row.footprint.width / 2, y: 0, z: -6 - row.footprint.depth / 2 }, max: { x: -6 + row.footprint.width / 2, y: row.height * 0.01, z: -6 + row.footprint.depth / 2 } });
+  // The slab asked for y 0 is lifted 3 mm off the deck (#1075) and says so.
+  assert.deepEqual(readback.bounds, { min: { x: -6 - row.footprint.width / 2, y: 0.003, z: -6 - row.footprint.depth / 2 }, max: { x: -6 + row.footprint.width / 2, y: Number((0.003 + row.height * 0.01).toFixed(4)), z: -6 + row.footprint.depth / 2 } });
+  assert.equal(find(squash, 'FLOOR_LIFT')[0].id, crate);
   const many = arrange(Array.from({ length: 10 }, (_, i) => create(`Bulk ${i}`, { x: 20 + i * 3, y: 0, z: -20 })));
   assert.equal(many.delta.length, 8);
   const truncated = find(many, 'READBACK_TRUNCATED');
```

**File**: `test/verify-studio-agent-binding.mjs` (modified, +9/-9)
```diff
@@ -378,7 +378,7 @@ const implementations={
   assert.deepEqual(overlapped.checks.placement.overlapIds,[cube]);assert(overlapped.checks.placement.maximumFootprintOverlapM>0);assert.deepEqual(overlapped.unsupportedChecks,[]);
   const lifted=await f.call('arrange_objects',f.request('arrange_objects',{ops:[{op:'create',source:{kind:'cube'},position:{world:{x:3,y:0.25,z:0}}}]}));assert.equal(lifted.ok,true,JSON.stringify(lifted));
   const gaps=(await verify({targets:[cube,lifted.affectedIds[0],'actor-a'],checks:['placement']})).checks.placement;
-  assert.deepEqual({supportGapM:gaps.supportGapM,unsupportedIds:gaps.unsupportedIds},{supportGapM:{[cube]:0,[lifted.affectedIds[0]]:0.25},unsupportedIds:[lifted.affectedIds[0]]},'placement measures how far each object stands off its support');
+  assert.deepEqual({supportGapM:gaps.supportGapM,unsupportedIds:gaps.unsupportedIds},{supportGapM:{[cube]:0.003,[lifted.affectedIds[0]]:0.25},unsupportedIds:[lifted.affectedIds[0]]},'placement measures how far each object stands off its support');
   const prop=await verify({targets:[cube],checks:['motion']});
   assert.deepEqual(prop.unsupportedChecks,['motion']);assert.match(prop.unsupportedReasons.motion,/not a character/);
   // A take the UI installed carries no verification: verify_result measures it.
@@ -570,7 +570,7 @@ const implementations={
   assert.equal(partial.kind,undefined);assert.deepEqual(partial.undo,{historyEntryId:turnId,entries:1,canUndoDirect:false});
   const finish=await f.call('run_action',inTurn('run_action',{action:'agent.turn.finish',args:{turnId}}));assert.equal(finish.authored,true,JSON.stringify(finish));
   assert.equal((await f.call('undo_edit',f.request('undo_edit',{receiptId:finish.receiptId}))).status,'undone','the turn is one undo step');
-  const undone=f.store.current.objects.find(o=>o.id===id);assert.equal(undone.color,'#c2c6c8');assert.deepEqual([undone.x,undone.y,undone.z],[2,0,0]);
+  const undone=f.store.current.objects.find(o=>o.id===id);assert.equal(undone.color,'#c2c6c8');assert.deepEqual([undone.x,undone.y,undone.z],[2,0.003,0]);
  },
  async 'patch-partial-drop'(f){
   const created=await f.call('arrange_objects',f.request('arrange_objects',createArgs));assert.equal(created.ok,true,JSON.stringify(created));const id=created.affectedIds[0];
@@ -613,8 +613,8 @@ const implementations={
   const created=await f.call('arrange_objects',f.request('arrange_objects',createArgs));assert.equal(created.ok,true,JSON.stringify(created));const id=created.affectedIds[0];
   const r=await f.call('run_action',f.request('run_action',{action:'object.duplicate',args:{objectId:id}}));
   assert.equal(r.status,'applied',JSON.stringify(r));assert.deepEqual(r.affectedIds,['copy-1']);assert.equal(r.revision.after,r.revision.before+1);
-  assert.deepEqual(r.delta,[{id:'copy-1',after:{bounds:{min:{x:2,y:0,z:-0.5},max:{x:3,y:1,z:0.5}},patched:[
-   {path:'object.renderer',text:'cube'},{path:'object.position',vec:{x:2.5,y:0,z:0}},
+  assert.deepEqual(r.delta,[{id:'copy-1',after:{bounds:{min:{x:2,y:0.003,z:-0.5},max:{x:3,y:1.003,z:0.5}},patched:[
+   {path:'object.renderer',text:'cube'},{path:'object.position',vec:{x:2.5,y:0.003,z:0}},
    {path:'object.rotation',vec:{x:0,y:0,z:0}},{path:'object.scale',vec:{x:1,y:1,z:1}},
    {path:'object.name',text:'Copy'},{path:'object.color',text:'#c2c6c8'},{path:'object.opacity',text:null},
    {path:'object.parent',text:null},{path:'object.path',text:null},{path:'object.remove',flag:false},
@@ -730,7 +730,7 @@ const implementations={
   const result=await f.call('inspect_studio',{scope:'entities',ids:[chassis,wheel]});
   const root=result.entities.find(row=>row.id===chassis),part=result.entities.find(row=>row.id===wheel);
   assert.equal(root.local,undefined,'a root carries no local transform');
-  assert.deepEqual(part.position,{x:4,y:0.5,z:0},'local +X of a yaw-90 parent is world -Z');
+  assert.deepEqual(part.position,{x:4,y:0.503,z:0},'local +X of a yaw-90 parent is world -Z');
   assert.equal(part.yawDeg,90);
   assert.deepEqual(part.local,{position:{x:1,y:0.5,z:0},rotationDeg:{x:0,y:0,z:0}});
  },
@@ -754,21 +754,21 @@ const implementations={
   const object=()=>f.store.current.objects.find(o=>o.id===id);
   // Where the prop is drawn: its numbers, through the frame it rides.
   const shown=()=>{const o=object(),local=carried.sceneObjectMatrix(o,new THREE.Matrix4());if(o.attach)local.premultiply(carried.attachFrameMatrix(f.rigs[o.attach.characterId],o.attach.bone,new THREE.Matrix4()));return new THREE.Vector3().setFromMatrixPosition(local).toArray().map(v=>Math.round(v*1e4)/1e4+0);};
-  assert.deepEqual(shown(),[2,0,0]);
+  assert.deepEqual(shown(),[2,0.003,0]);
   const listed=Object.fromEntries((await f.call('inspect_studio',{scope:'actions'})).actions.map(a=>[a.id,a]));
   assert.equal(listed['object.attach']?.available,true);assert.equal(listed['object.detach']?.available,false,'nothing rides a character yet');
   const before=f.binding.refresh().revision;
  
```

**File**: `test/verify-studio-agent-geometry.mjs` (modified, +27/-3)
```diff
@@ -8,6 +8,7 @@ import { validateReceipt, validateStudioCommand } from '../src/studio-agent-prot
 import { physicsFingerprintInput } from '../src/studio-agent-context.js';
 import { arrangement, frameDraft, placementChecks, framingChecks, createStudioCommandJournal, studioObjectCatalogue } from '../src/studio-agent-commands.js';
 import { createShot } from '../src/cuts.js';
+import { DECK_LIFT_M } from '../src/studio-support-gap.js';
 
 // These are the shared domain planners now, not the retired agent executor.
 // Receipt/admission/replay/undo remain exercised through the real bus in the
@@ -52,7 +53,7 @@ test('geometry: bases, yaw, anisotropic extents, between and the scaled authored
   for (const [basis, x, yaw] of [['world', -1.25, 90], ['subject', 1.25, -90], ['shot_camera', -1.25, 90]]) {
     const f = fixture(), plan = f.apply('arrange_objects', { ops: [prop(basis)] });
     near(f.state.objects[0].x, x); near(f.state.objects[0].rot, yaw); near(plan.checks.actualGapM, 0.5);
-    assert.deepEqual({ x: f.state.objects[0].x, y: f.state.objects[0].y, z: f.state.objects[0].z }, { x, y: 0, z: 0 });
+    assert.deepEqual({ x: f.state.objects[0].x, y: f.state.objects[0].y, z: f.state.objects[0].z }, { x, y: DECK_LIFT_M, z: 0 });
   }
   for (const yaw of [90, 180]) {
     const f = fixture(); f.state.characters[0].rot = yaw;
@@ -62,7 +63,7 @@ test('geometry: bases, yaw, anisotropic extents, between and the scaled authored
   }
   const f = fixture(); f.apply('arrange_objects', { ops: [{ ...prop('world'), scale: { x: 2, y: 3, z: 4 }, facing: { yawDeg: 90 } }] });
   near(f.state.objects[0].x, -2.75); assert.equal(f.state.objects[0].scaleY, 3);
-  f.apply('arrange_objects', { ops: [{ op: 'create', source: { kind: 'cube' }, position: { onObject: 'cylinder' } }] }); near(f.state.objects[1].y, 3);
+  f.apply('arrange_objects', { ops: [{ op: 'create', source: { kind: 'cube' }, position: { onObject: 'cylinder' } }] }); near(f.state.objects[1].y, DECK_LIFT_M + 3);
   // An authored seat below the record's top (supportY) is what onObject lands on, scaled.
   const seat = fixture(); seat.state.objects.push({ ...createSceneObject('cylinder'), id: 'seat', height: 1.15, supportY: 0.495, scaleY: 3 });
   seat.apply('arrange_objects', { ops: [{ op: 'create', source: { kind: 'cube' }, position: { onObject: 'seat' } }] }); near(seat.state.objects[1].y, 1.485);
@@ -97,9 +98,32 @@ test('geometry: measured overlaps, bounded avoidance, and hidden-parent exclusio
   }
   const h = fixture(); seed(h, { x: -0.685, scaleX: 0.37, scaleZ: 0.4 }); const placed = h.apply('arrange_objects', { ops: [prop('shot_camera')] });
   const { coverage, overlapIds, maximumFootprintOverlapM } = placed.checks;
-  assert.deepEqual(placementChecks(['cylinder'], h.state, h.ports), { coverage, overlapIds, maximumFootprintOverlapM, supportGapM: { cylinder: 0 }, unsupportedIds: [] });
+  assert.deepEqual(placementChecks(['cylinder'], h.state, h.ports), { coverage, overlapIds, maximumFootprintOverlapM, supportGapM: { cylinder: DECK_LIFT_M }, unsupportedIds: [] });
   assert.deepEqual(placementChecks(['alex'], h.state, h.ports), { coverage, overlapIds: [], maximumFootprintOverlapM: 0, supportGapM: {}, unsupportedIds: [] }, 'a character has no support gap');
 });
+test('geometry: a floor-resting object is lifted off the deck plane; stacked and raised ones keep their y (#1075)', () => {
+  const f = fixture(), bottom = o => Math.min(...boxCorners(o).map(p => p.y));
+  const plan = f.apply('arrange_objects', { ops: [
+    { op: 'create', source: { kind: 'cube' }, name: 'Street', scale: { x: 20, y: 0.05, z: 20 }, position: { world: { x: 0, y: 0, z: 0 } } },
+    { op: 'create', source: { kind: 'cube' }, name: 'Near', position: { world: { x: 30, y: 0.0008, z: 0 } } },
+    { op: 'create', source: { kind: 'cube' }, name: 'Raised', position: { world: { x: 33, y: 0.002, z: 0 } } },
+    { op: 'create', source: { kind: 'cube' }, name: 'Crate', position: { world: { x: 36, y: 0, z: 0 } } },
+    { op: 'create', source: { kind: 'cube' }, name: 'Box', scale: { x: 0.5, y: 0.5, z: 0.5 }, position: { onObject: 'Crate' } },
+    { op: 'create', source: { kind: 'cylinder' }, name: 'Side', position: { relativeTo: 'Crate', basis: 'world', side: 'right', gapM: 0.2, support: 'floor' } },
+    { op: 'create', source: { kind: 'cube' }, name: 'Tilted', rotationDeg: { x: 0, y: 0, z: 20 }, position: { relativeTo: 'Crate', basis: 'world', side: 'left', gapM: 0.5, support: 'floor' } },
+    { op: 'create', source: { kind: 'empty' }, name: 'Rig', position: { world: { x: 40, y: 0, z: 0 } } },
+  ] });
+  const by = n => f.state.objects.find(o => o.name === n);
+  for (const name of ['Street', 'Near', 'Crate', 'Side', 'Tilted']) near(bottom(by(name)), DECK_LIFT_M);
+  near(by('Raised').y, 0.002); near(by('Rig').y, 0);
+  near(by('Box').y, by('Crate').y + by('Crate').supportY * by('Crate').scaleY);
+  assert.deepEqual(plan.warnings.filter(w => w.code === 'CLAMPED'), [], 'the lift is not 
```

#### Recent Merged Pull Requests:
- **PR #1085** (2026-11-05): fix(agent): read Retry-After, retry gateway 5xx, label usage limits as quota, tag failed turns by provider and endpoint (#1043) (@HaD0Yun)
- **PR #1084** (2026-11-05): fix(stage): a slab whose bottom sits on the deck no longer z-fights with it (#1075) (@HaD0Yun)
- **PR #1077** (2026-11-05): feat(live): cclay live capture --frames renders a run of frames in one session (#1074) (@HaD0Yun)
- **PR #1076** (2026-11-05): fix(tools): restore headless-studio browser helper (#1073) (@HaD0Yun)
- **PR #1071** (2026-11-05): fix(live): refuse live captures from a hidden Studio tab (@byongshintv)
- **PR #1070** (2026-11-05): docs(cli): align inspect responses and expose entity paging (@byongshintv)

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

## X. app): stop the playback-frame update-depth loop and survive page translation (#1

**RULE**:
When implementing operations in `docs/analytics-queries.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in HaD0Yun/CozyClay. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5c215d72`: app): stop the playback-frame update-depth loop and survive page translation (#1045, #1046) (#1057). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/analytics-queries.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
| `app:render_crash`, `app:error` | `locale` | `en`, `ko`, `zh`, `other` | The studio UI language (`uiLocale`, `src/analytics-values.js`): the stored Settings choice, `en` when none. Not the browser language, so a crash under browser translation (English UI, `zh-*` browser) splits from one in the in-app Chinese UI (#1046). Builds before this release have no `locale`: unknown, not `en` | with the event |
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5c215d72` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

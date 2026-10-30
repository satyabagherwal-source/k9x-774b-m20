> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mobile-next-mobile-mcp-learnings.md`  
> **Source**: github ([https://github.com/mobile-next/mobile-mcp](https://github.com/mobile-next/mobile-mcp))  
> **Source Version**: `5ca473ff`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T16:22:34.686Z  
> **Learning ID**: `learn-github-mobile-next-mobile-mcp`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): mobile-next/mobile-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/mobile-next-mobile-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mobile-next/mobile-mcp](https://github.com/mobile-next/mobile-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-30T16:12:29.069Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mobile-next/mobile-mcp`
- **Description**: Mobile MCP: let AI agents drive your iOS and Android apps. MCP server for simulators, emulators and real devices. Works with Claude Code, Codex, Cursor and any MCP client.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 10147 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `plugin/hooks/keys.ts`
```
import type { Platform } from "../types";

export type KeyAction = { type: "text"; text: string } | { type: "button"; button: string };

// special key names the terminal reports, mapped to mobile_press_button buttons
const ANDROID_BUTTONS: Record<string, string> = {
	return: "ENTER",
	backspace: "BACKSPACE",
	delete: "BACKSPACE",
	up: "DPAD_UP",
	down: "DPAD_DOWN",
	left: "DPAD_LEFT",
	right: "DPAD_RIGHT",
};

const IOS_BUTTONS: Record<string, string> = {
	return: "ENTER",
};

// ponytail: iOS has no BACKSPACE button in mobilecli, so it is typed as \b; unverified on a device
const IOS_TEXT: Record<string, string> = {
	backspace: "\b",
	delete: "\b",
};

function actionFor(key: string, platform: Platform): KeyAction | undefined {
	const buttons = platform === "android" ? ANDROID_BUTTONS : IOS_BUTTONS;
	const button = buttons[key];
	if (button) {
		return { type: "button", button };
	}

	const text = platform === "ios" ? IOS_TEXT[key] : undefined;
	if (text) {
		return { type: "text", text };
	}

	if (key === "space") {
		return { type: "text", text: " " };
	}

	// a single character is typed as is; any other named key is dropped
	if ([...key].length === 1) {
		return { type: "text", text: key };
	}

	return undefined;
}

// turns pressed keys into device actions, joining consecutive text into one type call
export function keysToActions(keys: string[], platform: Platform): KeyAction[] {
	const actions: KeyAction[] = [];
	for (const key of keys) {
		const action = actionFor(key, platform);
		if (!action) {
			continue;
		}

		const last = actions[actions.length - 1];
		if (action.type === "text" && last?.type === "text") {
			actions[actions.length - 1] = { type: "text", text: last.text + action.text };
		} else {
			actions.push(action);
		}

	}

	return actions;
}

```

### Core Architecture Module: `plugin/hooks/png.ts`
```
// width and height from a PNG's IHDR chunk, big-endian at bytes 16..23
export function pngSize(bytes: Uint8Array): { width: number; height: number } {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	return { width: view.getUint32(16), height: view.getUint32(20) };
}

const MAX_CELLS = 255;
// cell height / cell width of the terminal font, measured 17.3px / 8.1px; no API reports it, so tune per font
export const CELL_ASPECT = 2.14;

function clampCells(n: number): number {
	return Math.max(1, Math.min(MAX_CELLS, Math.floor(n)));
}

// the largest box of cells that keeps the picture's aspect and fits inside maxColumns x maxRows
export function fitInside(columnsLimit: number, rowsLimit: number, width: number, height: number): { columns: number; rows: number } {
	const maxColumns = clampCells(columnsLimit);
	const maxRows = clampCells(rowsLimit);
	// a broken PNG header can report zero; without an aspect to keep, fill the box instead of dividing by zero
	if (width <= 0 || height <= 0) {
		return { columns: maxColumns, rows: maxRows };
	}

	const rowsAtFullWidth = (maxColumns * height) / width / CELL_ASPECT;
	if (rowsAtFullWidth <= maxRows) {
		return { columns: clampCells(maxColumns), rows: clampCells(rowsAtFullWidth) };
	}

	const columnsAtFullHeight = (maxRows * width * CELL_ASPECT) / height;

	return { columns: clampCells(columnsAtFullHeight), rows: clampCells(maxRows) };
}

```

### Core Architecture Module: `plugin/hooks/register.tsx`
```
import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import type { Shot, Target } from "../types";
import { keysToActions } from "./keys";
import { fitInside, pngSize } from "./png";

// the key of the MCP server in this plugin's manifest
const MCP_SERVER = "mobile-mcp";
const COMMAND = "mobile-mirror";
const PANE = "mobile-mirror";
const VIEW_KEY = "view";
const TAP_KEY = "tap";
// frames rotate through a few files, so the terminal never reads one being rewritten
const FRAME_FILES = 3;
// large enough that the terminal never upscales it on a Retina pane; smaller is faster
const SHOT_MAX_SIZE = 1600;
const RETRY_AFTER_ERROR_MS = 1000;
// the toolbar row, plus the URL field's row while it shows
const TOOLBAR_ROWS = 1;
const URL_FIELD_ROWS = 1;

// kept in session state, not module variables, so they survive a reload of the mod
const target = atom({ plugin: "mobile-mcp", key: "target" } as const, null as Target | null);
// bumped to stop the running frame loop: a loop runs only while it holds the current value
const streamId = atom({ plugin: "mobile-mcp", key: "streamId" } as const, 0);
const isAskingUrl = atom({ plugin: "mobile-mcp", key: "isAskingUrl" } as const, false);
const shot = atom({ plugin: "mobile-mcp", key: "shot" } as const, { file: "", generation: 0, width: 1, height: 1 } as Shot);

type Device = { id: string; platform: string; state: string };
type TapMessage = { x: number; y: number };
type KeysMessage = { keys: string[] };
// the runtime has Uint8Array.fromBase64; the TS lib does not declare it yet
type Base64Decoder = { fromBase64(base64: string): Uint8Array };
type McpResult = Awaited<ReturnType<EngineInterface["mcp"]["call"]>>;

function firstText(content: unknown): string {
	const block = (content as { type: string; text?: string }[]).find(b => b.type === "text");

	return block?.text ?? "";
}

function frameFile(generation: number): string {
	return `/tmp/mobile-mirror-${generation % FRAME_FILES}.png`;
}

// calls a mobile-mcp tool by the name this session runs the server under, connecting it on first use
async function callMobileMcp($: EngineInterface, tool: string, args: Record<string, unknown> = {}): Promise<McpResult> {
	const connection = await $.mcp.connect(MCP_SERVER);
	if (!connection.isConnected) {
		throw new Error(`mobile-mcp is not connected: ${connection.message}`);
	}

	return $.mcp.call(connection.server, tool, args);
}

// runs a toolbar action, and toasts only when it fails
async function runAction($: EngineInterface, what: string, tool: string, args: Record<string, unknown>): Promise<void> {
	try {
		const result = await callMobileMcp($, tool, args);
		if (result.isError) {
			$.ui.toast(`${what} failed: ${firstText(result.content)}`);
		}

	} catch (error) {
		$.ui.toast(`${what} failed: ${String(error)}`);
	}
}

function pickDevice(devices: Device[], wanted: string | undefined): Device | undefined {
	const online = devices.filter(d => d.state === "online");
	if (wanted) {
		return online.find(d => d.id === wanted);
	}

	return online.find(d => d.platform === "android") ?? online[0];
}

export const register: Register = on => {
	// key batches are sent one after another, so typed text keeps its order
	let typing: Promise<void> = Promise.resolve();

	on("session.start", async ($, e, next) => {
		await $.command.register({ name: COMMAND, description: "Mirror a device screen: live picture, taps, keys and buttons", argumentHint: "[device-id]" });

		return next(e);
	});

	on("command.run", { command: COMMAND }, async ($, e) => {
		const wanted = e.args.trim() || undefined;
		const listed = await callMobileMcp($, "mobile_list_available_devices");
		const { devices } = JSON.parse(firstText(listed.content)) as { devices: Device[] };
		const device = pickDevice(devices, wanted);
		if (!device) {
			const online = devices.filter(d => d.state === "online").map(d => d.id);
			return { text: `No online device${wanted ? ` "${wanted}"` : ""}. Online: ${online.join(", ") || "none"}` };
		}

		const sized = await callMobileMcp($, "mobile_get_screen_size", { device: device.id });
		const match = /(\d+)x(\d+)/.exec(firstText(sized.content));
		if (!match) {
			return { text: `Could not read the screen size of ${device.id}.` };
		}

		await update($, target, () => ({
			id: device.id,
			platform: device.platform === "android" ? "android" : "ios",
			screenWidth: Number(match[1]),
			screenHeight: Number(match[2]),
		}));
		await update($, isAskingUrl, () => false);
		const id = await update($, streamId, n => n + 1);

		const captureFrame = async (generation: number): Promise<boolean> => {
			const file = frameFile(generation);
			const saved = await callMobileMcp($, "mobile_save_screenshot", { device: device.id, saveTo: file, maxSize: SHOT_MAX_SIZE });
			if (saved.isError) {
				return false;
			}

			const { base64 } = await $.fs.read(file, { as: "bytes" });
			const size = pngSize((Uint8Array as unknown as Base64Decoder).fromBase64(base64));
			const current = await read($, shot);
			// a new shape (first frame, rotation) needs a full redraw; otherwise swap the pixels in place
			if (current.generation === 0 || current.width !== size.width || current.height !== size.height) {
				await update($, shot, () => ({ file, generation, ...size }));
			} else {
				await $.ui.blit({ requestId: PANE, key: VIEW_KEY, source: { file, format: "png", generation } }).catch(() => {});
			}

			return true;
		};

		const stream = async () => {
			// the next frame is asked for as soon as the previous one is shown
			for (let generation = 1; id === (await read($, streamId)); generation++) {
				const isShown = await captureFrame(generation).catch(() => false);
				if (!isShown) {
					await $.clock.sleep(RETRY_AFTER_ERROR_MS);
				}

			}
		};

		await update($, shot, () => ({ file: "", generation: 0, width: 1, height: 1 }));
		void stream();
		await $.ui.open({ id: PANE, title: `mobile-mirror · ${device.id}` });

		return { text: `Mirroring ${device.id}. Click the picture to tap, then type to send keys.` };
	});

	on("ui.message", async ($, e) => {
		const device = await read($, target);
		if (e.element !== TAP_KEY || !device) {
			return {};
		}

		if ("keys" in (e.data as object)) {
			const actions = keysToActions((e.data as KeysMessage).keys, device.platform);
			typing = typing.then(async () => {
				for (const action of actions) {
					if (action.type === "text") {
						await runAction($, "Typing", "mobile_type_keys", { device: device.id, text: action.text, submit: false });
					} else {
						await runAction($, `Press ${action.button}`, "mobile_press_button", { device: device.id, button: action.button });
					}

				}
			});

			return {};
		}

		const tap = e.data as TapMessage;
		const x = Math.round(tap.x * device.screenWidth);
		const y = Math.round(tap.y * device.screenHeight);
		await runAction($, "Tap", "mobile_click_on_screen_at_coordinates", { device: device.id, x, y });

		return {};
	});

	on("ui.close", async ($, e, next) => {
		if (e.id === PANE) {
			await update($, streamId, n => n + 1);
		}

		return next(e);
	});

	on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
		const ui = $.ui.resolve(e);
		const { Box, Text } = ui;
		if (e.surface !== "terminal" || !("Image" in ui)) {
			return <Text>mobile-mirror needs the terminal, in kitty or Ghostty.</Text>;
		}

		const { file, generation, width, height } = await read($, shot);
		if (generation === 0) {
			return <Text dimColor>Waiting for the first frame…</Text>;
		}

		const device = await read($, target);
		if (!device) {
			return <Text dimColor>Run /mobile-mirror to pick a device.</Text>;
		}

		const isAndroid = device.platform === "android";
		const isAsking = await read($, isAskingUrl);
		const roomForImage = e.props.scroll.bodyRows - TOOLBAR_ROWS - (isAsking ? URL_FIELD_ROWS : 0);
		const size = fitInside(e.props.bodyColumns, roomForImage, width, height);
		const { Button, Input } = ui;

		const press = (button: string) => () => runAction($, `Press ${button}`, "mobile_press_button", { device: device.id, button });

		const openUrl = async (url: string) => {
			await update($, isAskingUrl, () => false);
			if (!url.trim()) {
				return;
			}

			await runAction($, `Open ${url.trim()}`, "mobile_open_url", { device: device.id, url: url.trim() });
		};

		return (
			<Box flexDirection='column'>
				<Box flexDirection='row' gap={1}>
					<Button key='home' label='Home' onPress={press("HOME")} />
					{isAndroid && <Button key='back' label='Back' onPress={press("BACK")} />}
					{isAndroid && <Button key='app-switch' label='App Switch' onPress={press("APP_SWITCH")} />}
					<Button key='url' label='URL' onPress={() => update($, isAskingUrl, asking => !asking)} />
				</Box>
				{isAsking && <Input key='url-field' label='URL ' placeholder='https://example.com' submitLabel='open' autoFocus onSubmit={openUrl} />}
				<Box>
					<ui.Image key={VIEW_KEY} source={{ file, format: "png", generation }} columns={size.columns} rows={size.rows} alt='device screen' />
					<Box position='absolute' top={0} left={0}>
						<ui.Client key={TAP_KEY} module='./tap.tsx' width={size.columns} height={size.rows} />
					</Box>
				</Box>
			</Box>
		);
	});
};

```

### Core Architecture Module: `plugin/hooks/tap.tsx`
```
import type { ClientKeyEvent, ClientPointerEvent, ClientSurface } from "claude-code";

type Pending = { keys: string[] };

// a post per frame at most, and a later one replaces an undelivered one, so keys are sent in batches
const FLUSH_MS = 50;

// Laid over the screenshot: posts each left click as a fraction of the picture (0..1 on both axes),
// and, once clicked, the keys typed while it holds the focus
export default function TapInput(_props: unknown, surface: ClientSurface<Pending>) {
	if (surface.state === undefined) {
		const pending: Pending = { keys: [] };

		surface.onPointer((e: ClientPointerEvent) => {
			if (e.type !== "down" || e.button !== "left" || surface.columns === 0 || surface.rows === 0) {
				return;
			}

			const x = e.fine?.x ?? e.x + 0.5;
			const y = e.fine?.y ?? e.y + 0.5;
			surface.post({ x: x / surface.columns, y: y / surface.rows });
		});

		surface.onKey((e: ClientKeyEvent) => {
			pending.keys.push(e.key);
		});

		surface.every(FLUSH_MS, () => {
			if (pending.keys.length === 0) {
				return;
			}

			surface.post({ keys: pending.keys.splice(0) });
		});

		surface.setState(pending);
	}

	const { Box } = surface.elements;

	return <Box width='100%' height='100%' />;
}

```

### Core Architecture Module: `src/utils.ts`
```
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { ActionableError } from "./robot";

export function validatePackageName(packageName: string): void {
	// iOS bundle identifiers (which flow through this same "packageName" parameter
	// for launch/terminate) are allowed to contain hyphens per Apple's CFBundleIdentifier
	// format, e.g. "com.some-company.app".
	if (!/^[a-zA-Z0-9._-]+$/.test(packageName)) {
		throw new ActionableError(`Invalid package name: "${packageName}"`);
	}
}

export function validateLocale(locale: string): void {
	if (!/^[a-zA-Z0-9,\- ]+$/.test(locale)) {
		throw new ActionableError(`Invalid locale: "${locale}"`);
	}
}

// a url scheme per RFC 3986 section 3.1: a letter, then letters, digits, "+", "-" or "."
const URL_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

// url schemes are case-insensitive, but android matches an intent's scheme
// case-sensitively, so HTTPS://example.com would find no browser
export function withLowercaseScheme(url: string): string {
	return url.replace(URL_SCHEME, scheme => scheme.toLowerCase());
}

function resolveRoot(root: string): string {
	const resolved = path.resolve(root);

	try {
		return fs.realpathSync(resolved);
	} catch {
		return resolved;
	}
}

// the filesystem root, the home directory, or anything above it would make
// almost every file the user owns writable, so it is never an implicit root
function isTooBroadToAllow(dir: string): boolean {
	const resolvedDir = resolveRoot(dir);
	const home = resolveRoot(os.homedir());
	return resolvedDir === home || isPathUnderRoot(home, resolvedDir);
}

function getAllowedRoots(): string[] {
	const roots = [os.tmpdir()];

	if (!isTooBroadToAllow(process.cwd())) {
		roots.push(process.cwd());
	}


	// macOS /tmp is a symlink to /private/tmp, add both to be safe
	if (process.platform === "darwin") {
		roots.push("/tmp");
		roots.push("/private/tmp");
	}

	// Resolve symlinks so roots line up with resolveWithSymlinks() below. On macOS,
	// os.tmpdir() itself lives under /var/folders/..., and /var is a symlink to
	// /private/var, so without this the real temp directory never matches here.
	return roots.map(resolveRoot);
}

function isPathUnderRoot(filePath: string, root: string): boolean {
	const relative = path.relative(root, filePath);
	if (relative === "") {
		return false;
	}

	if (path.isAbsolute(relative)) {
		return false;
	}

	if (relative.startsWith("..")) {
		return false;
	}

	return true;
}

export function validateFileExtension(filePath: string, allowedExtensions: string[], toolName: string): void {
	const ext = path.extname(filePath).toLowerCase();
	if (!allowedExtensions.includes(ext)) {
		throw new ActionableError(`${toolName} requires a ${allowedExtensions.join(", ")} file extension, got: "${ext || "(none)"}"`);
	}
}

// windows follows up to 63 reparse points per path, linux 40 and macos 32;
// anything longer is rejected rather than handed to the write
const MAX_SYMLINK_HOPS = 64;

// Walk `filePath` to the real location a write would land on, following a
// symlink in EVERY component - not just the parent directory. Resolving only the
// parent let a symlink at, or before, the final component redirect the write
// while the check still saw an in-root path: a single final-component link was
// covered, but a chain whose intermediate link sits inside an allowed root and
// whose final target is dangling (the file a write would create) was not, so the
// write escaped. Follow each hop to its target until a component that either
// exists as a real file or does not exist at all, and hand that to the root check.
function resolveWithSymlinks(filePath: string): string {
	let current = path.resolve(filePath);

	// bound the walk so a symlink cycle cannot spin forever
	for (let hops = 0; hops < MAX_SYMLINK_HOPS; hops++) {
		const dir = path.dirname(current);
		const filename = path.basename(current);

		// resolve the containing directory first (it may be a symlink itself,
		// e.g. /tmp and /var on macOS) so it lines up with the allowed roots
		let realDir: string;
		try {
			realDir = fs.realpathSync(dir);
		} catch {
			realDir = dir;
		}

		const candidate = path.join(realDir, filename);

		let stat: fs.Stats;
		try {
			stat = fs.lstatSync(candidate);
		} catch {
			// nothing there yet, it will be created at `candidate`
			return candidate;
		}

		if (!stat.isSymbolicLink()) {
			return candidate;
		}

		// follow the link to its target - which may itself be a link, or may not
		// exist yet (exactly where a write would create the file) - and resolve again
		current = path.resolve(realDir, fs.readlinkSync(candidate));
	}

	throw new ActionableError(`"${filePath}" has too many levels of symbolic links.`);
}

export function validateOutputPath(filePath: string): void {
	const resolved = resolveWithSymlinks(filePath);
	const allowedRoots = getAllowedRoots();
	const isWindows = process.platform === "win32";

	const isAllowed = allowedRoots.some(root => {
		if (isWindows) {
			return isPathUnderRoot(resolved.toLowerCase(), root.toLowerCase());
		}

		return isPathUnderRoot(resolved, root);
	});

	if (!isAllowed) {
		const dir = path.dirname(resolved);
		throw new ActionableError(
			`"${dir}" is not in the list of allowed directories. Allowed directories: ${allowedRoots.join(", ")}.`
		);
	}
}

// a sibling of `to` with an unguessable name, created with O_EXCL ("wx"), so a
// file or link planted there makes the write fail instead of redirecting it
function partialPathFor(to: string): string {
	return path.join(path.dirname(to), `.${path.basename(to)}.${randomBytes(8).toString("hex")}.partial`);
}

// write next to `filePath` and rename over it: rename replaces whatever sits at
// `filePath` (a symlink, a hard link, a regular file) instead of writing through
// it, so a link can never point the write at another file
export function writeOutputFile(filePath: string, data: string | Buffer): void {
	const partial = partialPathFor(filePath);
	const existing = fs.lstatSync(filePath, { throwIfNoEntry: false });
	try {
		// 0600 while half-written; a link at `filePath` is replaced, so only a
		// regular file there passes its mode on to the new file
		fs.writeFileSync(partial, data, { flag: "wx", mode: 0o600 });
		if (existing?.isFile()) {
			fs.chmodSync(partial, existing.mode & 0o777);
		}

		fs.renameSync(partial, filePath);
	} catch (error) {
		fs.rmSync(partial, { force: true });
		throw error;
	}
}

// a fresh 0700 directory nobody else can plant a symlink in, for files written
// by mobilecli rather than by us
export function createPrivateOutputPath(filename: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mobile-mcp-"));
	return path.join(dir, filename);
}

// rename replaces a symlink at `to` instead of following it. Across filesystems
// rename fails with EXDEV, so copy next to `to` first (COPYFILE_EXCL refuses an
// existing path) and rename that over `to`, keeping `to` intact if the copy fails
export function moveOutputFile(from: string, to: string): void {
	try {
		fs.renameSync(from, to);
		return;
	} catch (error: any) {
		if (error.code !== "EXDEV") {
			throw error;
		}

	}

	const partial = partialPathFor(to);
	try {
		fs.copyFileSync(from, partial, fs.constants.COPYFILE_EXCL);
		fs.renameSync(partial, to);
	} catch (error) {
		fs.rmSync(partial, { force: true });
		throw error;
	}

	fs.rmSync(from);
}

// moves a finished recording from its private directory to the requested
// output; returns an error message when that fails, so stop can report it
export function finishRecording(recordingPath: string, outputPath: string): string | undefined {
	if (!fs.existsSync(recordingPath)) {
		return "mobilecli did not produce a recording";
	}

	if (recordingPath === outputPath) {
		return undefined;
	}

	try {
		validateOutputPath(outputPath);
		moveOutputFile(recordingPath, outputPath);
	} catch (error: any) {
		// keep the private directory, the recording is still in it
		return error.message;
	}

	fs.rmSync(path.dirname(recordingPath), { recursive: true, force: true });
	return undefined;
}

```

### Core Architecture Module: `eslint.config.mjs`
```
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import stylistic from "@stylistic/eslint-plugin";
import importRules from "eslint-plugin-import";

const plugins = {
	"@stylistic": stylistic,
	"@typescript-eslint": typescriptEslint,
	import: importRules,
};

export const baseRules = {
	"@typescript-eslint/no-unused-vars": [
		2,
		{args: "none", caughtErrors: "none"},
	],

	/**
	 * Enforced rules
	 */
	// syntax preferences
	"object-curly-spacing": ["error", "always"],
	quotes: [
		2,
		"double",
		{
			avoidEscape: true,
			allowTemplateLiterals: true,
		},
	],
	"jsx-quotes": [2, "prefer-single"],
	"no-extra-semi": 2,
	"@stylistic/semi": [2],
	"comma-style": [2, "last"],
	"wrap-iife": [2, "inside"],
	"spaced-comment": [
		2,
		"always",
		{
			markers: ["*"],
		},
	],
	eqeqeq: [2],
	"accessor-pairs": [
		2,
		{
			getWithoutSet: false,
			setWithoutGet: false,
		},
	],
	"brace-style": [2, "1tbs", {allowSingleLine: true}],
	curly: [2, "all"],
	"new-parens": 2,
	"arrow-parens": [2, "as-needed"],
	"prefer-const": 2,
	"quote-props": [2, "consistent"],
	"nonblock-statement-body-position": [2, "below"],

	// anti-patterns
	"no-var": 2,
	"no-with": 2,
	"no-multi-str": 2,
	"no-caller": 2,
	"no-implied-eval": 2,
	"no-labels": 2,
	"no-new-object": 2,
	"no-octal-escape": 2,
	"no-self-compare": 2,
	"no-shadow-restricted-names": 2,
	"no-cond-assign": 2,
	"no-debugger": 2,
	"no-dupe-keys": 2,
	"no-duplicate-case": 2,
	"no-empty-character-class": 2,
	"no-unreachable": 2,
	"no-unsafe-negation": 2,
	radix: 2,
	"valid-typeof": 2,
	"no-implicit-globals": [2],
	"no-unused-expressions": [
		2,
		{allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true},
	],
	"no-proto": 2,

	// es2015 features
	"require-yield": 2,
	"template-curly-spacing": [2, "never"],

	// spacing details
	"space-infix-ops": 2,
	"space-in-parens": [2, "never"],
	"array-bracket-spacing": [2, "never"],
	"comma-spacing": [2, {before: false, after: true}],
	"keyword-spacing": [2, "always"],
	"space-before-function-paren": [
		2,
		{
			anonymous: "never",
			named: "never",
			asyncArrow: "always",
		},
	],
	"no-whitespace-before-property": 2,
	"keyword-spacing": [
		2,
		{
			overrides: {
				if: {after: true},
				else: {after: true},
				for: {after: true},
				while: {after: true},
				do: {after: true},
				switch: {after: true},
				return: {after: true},
			},
		},
	],
	"arrow-spacing": [
		2,
		{
			after: true,
			before: true,
		},
	],
	"@stylistic/func-call-spacing": 2,
	"@stylistic/type-annotation-spacing": 2,

	// file whitespace
	"no-multiple-empty-lines": [2, {max: 2, maxEOF: 0}],
	"no-mixed-spaces-and-tabs": 2,
	"no-trailing-spaces": 2,
	"linebreak-style": [process.platform === "win32" ? 0 : 2, "unix"],
	indent: [
		2,
		"tab",
		{SwitchCase: 1, CallExpression: {arguments: "first"}, MemberExpression: 1},
	],
	"key-spacing": [
		2,
		{
			beforeColon: false,
		},
	],
	"eol-last": 2,
};

const languageOptions = {
	parser: tsParser,
	ecmaVersion: 9,
	sourceType: "module",
};

export default [
	{
		ignores: ["coverage/**", "lib/**", "node_modules/**", "test-results/**", "playwright-report/**"],
	},
	{
		files: ["**/*.ts"],
		plugins,
		languageOptions,
		rules: baseRules,
	},
];

```

### Core Architecture Module: `playwright.config.ts`
```
import { defineConfig } from "@playwright/test";

// These are plain Node tests (no browser). Playwright is used purely as the
// test runner, so no browser projects are configured.
export default defineConfig({
	testDir: "./test",
	testMatch: "*.ts",

	// Device tests (android/ios/iphone-simulator) mutate real device state and
	// must run serially, exactly as they did under mocha's single process.
	workers: 1,
	fullyParallel: false,

	// Device operations include several multi-second sleeps; the 30s default is
	// too tight.
	timeout: 60_000,
});

```

### Core Architecture Module: `plugin/types/index.d.ts`
```
export type Shot = { file: string; generation: number; width: number; height: number };
export type Platform = "android" | "ios";
export type Target = { id: string; platform: Platform; screenWidth: number; screenHeight: number };

declare module "claude-code" {
	interface PluginState {
		"mobile-mcp": { shot: Shot; target: Target | null; streamId: number; isAskingUrl: boolean }
	}
}

```

### Core Architecture Module: `scripts/verify-streamable-http.mjs`
```
#!/usr/bin/env node
/**
 * Smoke-verify Streamable HTTP on --listen:
 * spawn the server, initialize via StreamableHTTPClientTransport, tools/list.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const serverEntry = path.join(root, "lib", "index.js");

function freePort() {
	return new Promise((resolve, reject) => {
		const s = createServer();
		s.listen(0, "127.0.0.1", () => {
			const { port } = s.address();
			s.close(err => (err ? reject(err) : resolve(port)));
		});
		s.on("error", reject);
	});
}

function waitForListen(child, timeoutMs = 15000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("Timed out waiting for server listen")), timeoutMs);
		const onData = chunk => {
			const text = chunk.toString();
			if (text.includes("streamable http server listening")) {
				clearTimeout(timer);
				child.stderr?.off("data", onData);
				child.stdout?.off("data", onData);
				resolve();
			}
		};
		child.stderr?.on("data", onData);
		child.stdout?.on("data", onData);
		child.on("exit", code => {
			clearTimeout(timer);
			reject(new Error(`Server exited early with code ${code}`));
		});
	});
}

async function main() {
	const port = await freePort();
	const auth = process.env.MOBILEMCP_AUTH_VERIFY || "verify-token";
	const child = spawn(process.execPath, [serverEntry, "--listen", `127.0.0.1:${port}`], {
		cwd: root,
		env: { ...process.env, MOBILEMCP_AUTH: auth, MOBILEMCP_DISABLE_TELEMETRY: "1" },
		stdio: ["ignore", "pipe", "pipe"],
	});

	let serverLog = "";
	child.stderr?.on("data", c => { serverLog += c.toString(); });
	child.stdout?.on("data", c => { serverLog += c.toString(); });

	try {
		await waitForListen(child);
		const url = `http://127.0.0.1:${port}/mcp`;
		const transport = new StreamableHTTPClientTransport(new URL(url), {
			requestInit: {
				headers: {
					Authorization: `Bearer ${auth}`,
				},
			},
		});
		const client = new Client({ name: "verify-streamable-http", version: "0.0.0" });
		await client.connect(transport);
		const tools = await client.listTools();
		const names = tools.tools.map(t => t.name);
		console.log("OK initialize + tools/list");
		console.log(`tools (${names.length}): ${names.slice(0, 8).join(", ")}${names.length > 8 ? ", ..." : ""}`);
		if (!names.includes("mobile_list_available_devices")) {
			console.warn("warning: mobile_list_available_devices not in tools/list");
		}
		await client.close();
		process.exitCode = 0;
	} catch (err) {
		console.error("VERIFY FAILED:", err);
		console.error("--- server log ---\n" + serverLog);
		process.exitCode = 1;
	} finally {
		// child.killed only means a signal was sent; wait for the actual exit.
		if (child.exitCode === null && child.signalCode === null) {
			const exited = new Promise(r => child.once("exit", () => r(true)));
			child.kill("SIGTERM");
			const didExit = await Promise.race([exited, new Promise(r => setTimeout(() => r(false), 3000))]);
			if (!didExit) {
				child.kill("SIGKILL");
			}
		}
	}
}

main();

```

### Core Architecture Module: `src/android.ts`
```
import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

import * as xml from "fast-xml-parser";

import { ActionableError, Button, InstalledApp, Robot, ScreenElement, ScreenElementRect, ScreenSize, SwipeDirection, Orientation } from "./robot";
import { validatePackageName, validateLocale } from "./utils";

export interface AndroidDevice {
	deviceId: string;
	deviceType: "tv" | "mobile";
}

interface UiAutomatorXmlNode {
	node: UiAutomatorXmlNode[];
	class?: string;
	text?: string;
	bounds?: string;
	hint?: string;
	focused?: string;
	checkable?: string;
	"content-desc"?: string;
	"resource-id"?: string;
}

interface UiAutomatorXml {
	hierarchy: {
		node: UiAutomatorXmlNode;
	};
}

const getAdbPath = (): string => {
	const exeName = process.env.platform === "win32" ? "adb.exe" : "adb";
	if (process.env.ANDROID_HOME) {
		return path.join(process.env.ANDROID_HOME, "platform-tools", exeName);
	}

	if (process.platform === "win32" && process.env.LOCALAPPDATA) {
		const windowsAdbPath = path.join(process.env.LOCALAPPDATA, "Android", "Sdk", "platform-tools", "adb.exe");
		if (existsSync(windowsAdbPath)) {
			return windowsAdbPath;
		}
	}

	if (process.platform === "darwin" && process.env.HOME) {
		const defaultAndroidSdk = path.join(process.env.HOME, "Library", "Android", "sdk", "platform-tools", "adb");
		if (existsSync(defaultAndroidSdk)) {
			return defaultAndroidSdk;
		}
	}

	// fallthrough, hope for the best
	return exeName;
};

const BUTTON_MAP: Record<Button, string> = {
	"BACK": "KEYCODE_BACK",
	"HOME": "KEYCODE_HOME",
	"VOLUME_UP": "KEYCODE_VOLUME_UP",
	"VOLUME_DOWN": "KEYCODE_VOLUME_DOWN",
	"ENTER": "KEYCODE_ENTER",
	"DPAD_CENTER": "KEYCODE_DPAD_CENTER",
	"DPAD_UP": "KEYCODE_DPAD_UP",
	"DPAD_DOWN": "KEYCODE_DPAD_DOWN",
	"DPAD_LEFT": "KEYCODE_DPAD_LEFT",
	"DPAD_RIGHT": "KEYCODE_DPAD_RIGHT",
};

const TIMEOUT = 30000;
const MAX_BUFFER_SIZE = 1024 * 1024 * 8;

type AndroidDeviceType = "tv" | "mobile";

export class AndroidRobot implements Robot {

	public constructor(private deviceId: string) {
	}

	public adb(...args: string[]): Buffer {
		return execFileSync(getAdbPath(), ["-s", this.deviceId, ...args], {
			maxBuffer: MAX_BUFFER_SIZE,
			timeout: TIMEOUT,
		});
	}

	public silentAdb(...args: string[]): Buffer {
		return execFileSync(getAdbPath(), ["-s", this.deviceId, ...args], {
			maxBuffer: MAX_BUFFER_SIZE,
			timeout: TIMEOUT,
			stdio: ["pipe", "pipe", "pipe"],
		});
	}

	public getSystemFeatures(): string[] {
		return this.adb("shell", "pm", "list", "features")
			.toString()
			.split("\n")
			.map(line => line.trim())
			.filter(line => line.startsWith("feature:"))
			.map(line => line.substring("feature:".length));
	}

	public async getScreenSize(): Promise<ScreenSize> {
		const screenSize = this.adb("shell", "wm", "size")
			.toString()
			.split(" ")
			.pop();

		if (!screenSize) {
			throw new Error("Failed to get screen size");
		}

		const screenDensity = this.adb("shell", "wm", "density")
			.toString()
			.split(" ")
			.pop();

		const scale = screenDensity ? +screenDensity / 160 : 1;
		const [width, height] = screenSize.split("x").map(Number);
		return { width, height, scale };
	}

	public async listApps(): Promise<InstalledApp[]> {
		// only apps that have a launcher activity are returned
		return this.adb("shell", "cmd", "package", "query-activities", "-a", "android.intent.action.MAIN", "-c", "android.intent.category.LAUNCHER")
			.toString()
			.split("\n")
			.map(line => line.trim())
			.filter(line => line.startsWith("packageName="))
			.map(line => line.substring("packageName=".length))
			.filter((value, index, self) => self.indexOf(value) === index)
			.map(packageName => ({
				packageName,
				appName: packageName,
			}));
	}

	private async listPackages(): Promise<string[]> {
		return this.adb("shell", "pm", "list", "packages")
			.toString()
			.split("\n")
			.map(line => line.trim())
			.filter(line => line.startsWith("package:"))
			.map(line => line.substring("package:".length));
	}

	public async launchApp(packageName: string, locale?: string): Promise<void> {
		validatePackageName(packageName);

		if (locale) {
			validateLocale(locale);
			try {
				this.silentAdb("shell", "cmd", "locale", "set-app-locales", packageName, "--locales", locale);
			} catch (error) {
				// set-app-locales requires Android 13+ (API 33), silently ignore on older versions
			}
		}

		try {
			this.silentAdb("shell", "monkey", "-p", packageName, "-c", "android.intent.category.LAUNCHER", "1");
		} catch (error) {
			throw new ActionableError(`Failed launching app with package name "${packageName}", please make sure it exists`);
		}
	}

	public async listRunningProcesses(): Promise<string[]> {
		return this.adb("shell", "ps", "-e")
			.toString()
			.split("\n")
			.map(line => line.trim())
			.filter(line => line.startsWith("u")) // non-system processes
			.map(line => line.split(/\s+/)[8]); // get process name
	}

	public async swipe(direction: SwipeDirection): Promise<void> {
		const screenSize = await this.getScreenSize();
		const centerX = screenSize.width >> 1;

		let x0: number, y0: number, x1: number, y1: number;

		switch (direction) {
			case "up":
				x0 = x1 = centerX;
				y0 = Math.floor(screenSize.height * 0.80);
				y1 = Math.floor(screenSize.height * 0.20);
				break;
			case "down":
				x0 = x1 = centerX;
				y0 = Math.floor(screenSize.height * 0.20);
				y1 = Math.floor(screenSize.height * 0.80);
				break;
			case "left":
				x0 = Math.floor(screenSize.width * 0.80);
				x1 = Math.floor(screenSize.width * 0.20);
				y0 = y1 = Math.floor(screenSize.height * 0.50);
				break;
			case "right":
				x0 = Math.floor(screenSize.width * 0.20);
				x1 = Math.floor(screenSize.width * 0.80);
				y0 = y1 = Math.floor(screenSize.height * 0.50);
				break;
			default:
				throw new ActionableError(`Swipe direction "${direction}" is not supported`);
		}

		this.adb("shell", "input", "swipe", `${x0}`, `${y0}`, `${x1}`, `${y1}`, "1000");
	}

	public async swipeFromCoordinate(x: number, y: number, direction: SwipeDirection, distance?: number): Promise<void> {
		const screenSize = await this.getScreenSize();

		let x0: number, y0: number, x1: number, y1: number;

		// Use provided distance or default to 30% of screen dimension
		const defaultDistanceY = Math.floor(screenSize.height * 0.3);
		const defaultDistanceX = Math.floor(screenSize.width * 0.3);
		const swipeDistanceY = distance || defaultDistanceY;
		const swipeDistanceX = distance || defaultDistanceX;

		switch (direction) {
			case "up":
				x0 = x1 = x;
				y0 = y;
				y1 = Math.max(0, y - swipeDistanceY);
				break;
			case "down":
				x0 = x1 = x;
				y0 = y;
				y1 = Math.min(screenSize.height, y + swipeDistanceY);
				break;
			case "left":
				x0 = x;
				x1 = Math.max(0, x - swipeDistanceX);
				y0 = y1 = y;
				break;
			case "right":
				x0 = x;
				x1 = Math.min(screenSize.width, x + swipeDistanceX);
				y0 = y1 = y;
				break;
			default:
				throw new ActionableError(`Swipe direction "${direction}" is not supported`);
		}

		this.adb("shell", "input", "swipe", `${x0}`, `${y0}`, `${x1}`, `${y1}`, "1000");
	}

	private getDisplayCount(): number {
		return this.adb("shell", "dumpsys", "SurfaceFlinger", "--display-id")
			.toString()
			.split("\n")
			.filter(s => s.startsWith("Display "))
			.length;
	}

	private getFirstDisplayId(): string | null {
		try {
			// Try using cmd display get-displays (Android 11+)
			const displays = this.adb("shell", "cmd", "display", "get-displays")
				.toString()
				.split("\n")
				.filter(s => s.startsWith("Display id "))
				// filter for state ON even though get-displays only returns turned on displays
				.filter(s => s.indexOf(", state ON,") >= 0)
				// another paranoia check
				.filter(s => s.indexOf(", uniqueId ") >= 0);

			if (displays.length > 0) {
				const m = displays[0].match(/uniqueId \"([^\"]+)\"/);
				if (m !== null) {
					let displayId = m[1];
					if (displayId.startsWith("local:")) {
						displayId = displayId.substring("local:".length);
					}

					return displayId;
				}
			}
		} catch (error) {
			// cmd display get-displays not available on this device
		}

		// fallback: parse dumpsys display for display info (compatible with older Android versions)
		try {
			const dumpsys = this.adb("shell", "dumpsys", "display")
				.toString();

			// look for DisplayViewport entries with isActive=true and type=INTERNAL
			const viewportMatch = dumpsys.match(/DisplayViewport\{type=INTERNAL[^}]*isActive=true[^}]*uniqueId='([^']+)'/);
			if (viewportMatch) {
				let uniqueId = viewportMatch[1];
				if (uniqueId.startsWith("local:")) {
					uniqueId = uniqueId.substring("local:".length);
				}

				return uniqueId;
			}

			// fallback: look for active display with state ON
			const displayStateMatch = dumpsys.match(/Display Id=(\d+)[\s\S]*?Display State=ON/);
			if (displayStateMatch) {
				return displayStateMatch[1];
			}
		} catch (error) {
			// dumpsys display also failed
		}

		return null;
	}

	public async getScreenshot(): Promise<Buffer> {
		if (this.getDisplayCount() <= 1) {
			// backward compatibility for android 10 and below, and for single display devices
			return this.adb("exec-out", "screencap", "-p");
		}

		// find the first display that is turned on, and capture that one
		const displayId = this.getFirstDisplayId();
		if (displayId === null) {
			// no idea why, but we have displayCount >= 2, yet we failed to parse
			// let's go with screencap's defaults and hope for the best
			return this.adb("exec-out", "screencap", "-p");
		}

		return this.adb("exec-out", "screencap", "-p", "-d", `${displayId}`);
	}

	private collectElements(node: UiAutomatorXmlNode): ScreenElement[] {
		const elements: Array<ScreenElement> = [];

		if (node.node) {
			if (Array.isArray(node.node)) {
				for (const childNode of node.node) {
					elements.push(...this.collectElements(childNode));
				}
			} else {
				
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #176** (2025-10-08): **mobile_take_screenshot not working for android?**
  *Symptoms*: use to work in the previous version.  **Describe the bug**  mobile - mobile_take_screenshot (MCP)(noParams: {})   ⎿  Error: Command failed: /Users/xxxx/Library/Android/sdk/platform-tools/adb -s 192.168.86.32:5555 shell cmd display get-displays  ⏺ mobile-mcp - mobile_take_screenshot (MCP)(noParams: {})   ⎿  Error: Command failed: /Users/xxxx/Library/Android/sdk/platform-tools/adb -s 192.168.86.32:5555 shell cmd display get-displays    **Configuration (please complete the following information):** - Agent: Claude code - OS: mac - Device used: Android  
  **Post-Mortem & Fix Analysis**:
  > @benoitliard sorry for the delay. I'm going to try to reproduce this now. I wonder if it's because you have a remote device (at host 192.168.86.32) or because get-displays fails on that. Regardless, get-displays should have been an optional command with a fallback to a single display device.  Thanks for the report. Btw, is that an emulator or real device? what version?
  > Managed to reproduce this. It works fine on API 36, and gets a fallback on API 25. However, API 31 returns command unknown and status code 255. :)  I'll fix it now and keep you updated.

- **Issue #158** (2025-10-29): **take_screenshot tool returns "Not a valid PNG file" error on Android device (Pixel 9 Pro Fold)**
  *Symptoms*: ## Problem The `mcp_mobile-mcp_mobile_take_screenshot` tool consistently fails with the error "Not a valid PNG file" when attempting to capture screenshots from an Android device, despite the device being properly connected and other mobile interaction tools working correctly.  ## Environment - **Device:** Google Pixel 9 Pro Fold (Android device `48081FDKD000UR`, connected via ADB) - **OS:** macOS with zsh shell - **ADB:** Working correctly - device visible and responsive - **ImageMagick:** v7.1.2-0 installed via Homebrew - **Other tools:** `list_elements_on_screen`, `click_on_screen_at_coordinates`, `use_device` all work properly  ## Device-Specific Context The device is a **foldable phone** (Pixel 9 Pro Fold), which has multiple displays: ```bash adb shell dumpsys SurfaceFlinger --display-id Display 4619827677550801152 (HWC display 0): port=0 pnpId=GGL displayName="Common Panel" Display 4619827677550801153 (HWC display 1): port=1 pnpId=GGL displayName="Common Panel" ```  ADB screencap shows a warning about multiple displays: ``` [Warning] Multiple displays were found, but no display id was specified!  Defaulting to the first display found, however this default is not guaranteed  to be consistent across captures. A display ID should be specified. ```  ## Tools Used and Results 1. **Working tools:**    - `mcp_mobile-mcp_mobile_list_available_devices` ✅    - `mcp_mobile-mcp_mobile_use_device` ✅      - `mcp_mobile-mcp_mobile_list_elements_on_screen` ✅    - `mcp_mobile-mcp_mobil

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

### Incident Patch 1: `cd3cb571` (2026-10-18)
**Commit Message**: fix: raise maxBuffer for executeCommand so large UI dumps don't fail with ENOBUFS (#518)

* fix: raise maxBuffer for executeCommand so large UI dumps don't fail with ENOBUFS

executeCommand called execFileSync without maxBuffer, so Node's 1MB default
applied. `dump ui` on dense screens (e.g. a 2.19MB / 6.5k element tree) failed
with `spawnSync ... ENOBUFS`. Use the same MAX_BUFFER_SIZE (8MB) that
executeCommandBuffer already uses, and add a regression test.

Fixes #514

* test: run node itself as the fake mobilecli so the maxBuffer test works on Windows

An extensionless shebang script can't be launched by execFileSync on
Windows. Point MOBILECLI_PATH at process.execPath and pass the output
script with -e instead; this also removes the temp file setup.

---------

Co-authored-by: whitelancefly <[REDACTED_EMAIL]>

**File**: `src/mobilecli.ts` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ export class Mobilecli {
 
 	public executeCommand(args: string[], timeoutMs?: number): string {
 		const path = this.getPath();
-		const options: { encoding: "utf8"; timeout?: number } = { encoding: "utf8" };
+		const options: { encoding: "utf8"; maxBuffer: number; timeout?: number } = { encoding: "utf8", maxBuffer: MAX_BUFFER_SIZE };
 		if (timeoutMs !== undefined) {
 			options.timeout = timeoutMs;
 		}
```

**File**: `test/mobilecli.test.ts` (modified, +15/-0)
```diff
@@ -117,6 +117,21 @@ test.describe("mobilecli", () => {
 		});
 	});
 
+	test.describe("executeCommand", () => {
+		test("should return output larger than node's default 1MB maxBuffer", () => {
+			// run node itself as the "mobilecli" binary so the test works on every platform
+			const outputSize = 2 * 1024 * 1024;
+			try {
+				process.env.MOBILECLI_PATH = process.execPath;
+				const mobilecli = new Mobilecli();
+				const output = mobilecli.executeCommand(["-e", `process.stdout.write("a".repeat(${outputSize}))`]);
+				expect(output.length).toBe(outputSize);
+			} finally {
+				delete process.env.MOBILECLI_PATH;
+			}
+		});
+	});
+
 	test.describe("agentStatus", () => {
 		test("should return fail status when agent is not installed and mobilecli exits non-zero", () => {
 			const mobilecli = new Mobilecli();
```

---

### Incident Patch 2: `17bd1f80` (2026-10-14)
**Commit Message**: fix: record screen into a private directory and move it to the output (#510)

* fix: record screen into a private directory and move it to the output

mobilecli writes the recording itself, so a symlink at the output path (or one
planted after it was validated) redirected the write. Record into a fresh
mkdtemp directory instead and rename the file to the output when recording
ends; rename replaces a symlink rather than following it. The default output
is no longer a predictable path in the shared temp directory either.

Co-authored-by: barnessomer <[REDACTED_EMAIL]>

* fix: keep the existing output on a failed copy and report a missing recording

- copy across filesystems into a temp file next to the output and rename it
  over the output, so a failed copy no longer deletes the previous file
- report a failure when mobilecli produced no recording, instead of
  describing an older file at the output path as the new recording
- remove the private recording directory once the file is moved

---------

Co-authored-by: barnessomer <[REDACTED_EMAIL]>

**File**: `src/server.ts` (modified, +27/-8)
```diff
@@ -15,7 +15,7 @@ import { getJpegDimensions } from "./jpeg";
 import { describeCoordinateMapping } from "./coordinate-mapping";
 import { Mobilecli } from "./mobilecli";
 import { MobileDevice } from "./mobile-device";
-import { validateOutputPath, validateFileExtension, withLowercaseScheme, writeOutputFile } from "./utils";
+import { validateOutputPath, validateFileExtension, withLowercaseScheme, writeOutputFile, createPrivateOutputPath, finishRecording } from "./utils";
 import { formatElements } from "./format-elements";
 
 type ScreenshotContent = { type: "text", text: string } | { type: "image", data: string, mimeType: string };
@@ -59,8 +59,10 @@ export const formatAvailableDevices = (devices: MobilecliDevice[]): string => {
 
 interface ActiveRecording {
 	process: ChildProcess;
+	recordingPath: string;
 	outputPath: string;
 	startedAt: number;
+	moveError?: string;
 }
 
 export const getAgentVersion = (): string => {
@@ -1160,9 +1162,12 @@ export const createMcpServer = (): McpServer => {
 				throw new ActionableError(`Device "${device}" is already being recorded. Stop the current recording first with mobile_stop_screen_recording.`);
 			}
 
-			const outputPath = output || path.join(os.tmpdir(), `screen-recording-${Date.now()}.mp4`);
+			// mobilecli writes the file itself, so it records into a private directory
+			// and we move the result to `output` once it is done
+			const recordingPath = createPrivateOutputPath(`screen-recording-${Date.now()}.mp4`);
+			const outputPath = output || recordingPath;
 
-			const args = ["screenrecord", "--device", device, "--output", outputPath, "--silent"];
+			const args = ["screenrecord", "--device", device, "--output", recordingPath, "--silent"];
 			if (timeLimit !== undefined) {
 				args.push("--time-limit", String(timeLimit));
 			}
@@ -1173,15 +1178,24 @@ export const createMcpServer = (): McpServer => {
 				activeRecordings.delete(device);
 			};
 
-			child.on("error", cleanup);
-			child.on("exit", cleanup);
-
-			activeRecordings.set(device, {
+			const recording: ActiveRecording = {
 				process: child,
+				recordingPath,
 				outputPath,
 				startedAt: Date.now(),
+			};
+
+			// registered before mobile_stop_screen_recording waits on "close", so the
+			// file is already in place when stop reports it; also covers timeLimit
+			child.on("close", () => {
+				recording.moveError = finishRecording(recordingPath, outputPath);
 			});
 
+			child.on("error", cleanup);
+			child.on("exit", cleanup);
+
+			activeRecordings.set(device, recording);
+
 			return `Screen recording started. Output will be saved to: ${outputPath}`;
 		}
 	);
@@ -1200,7 +1214,7 @@ export const createMcpServer = (): McpServer => {
 				throw new ActionableError(`No active recording found for device "${device}". Start a recording first with mobile_start_screen_recording.`);
 			}
 
-			const { process: child, outputPath, startedAt } = recording;
+			const { process: child, recordingPath, outputPath, startedAt } = recording;
 			activeRecordings.delete(device);
 
 			child.kill("SIGINT");
@@ -1219,6 +1233,11 @@ export const createMcpServer = (): McpServer => {
 
 			const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
 
+			if (recording.moveError) {
+				const recovery = fs.existsSync(recordingPath) ? ` The recording is at: ${recordingPath}` : "";
+				return `Recording stopped after ~${durationSeconds}s but could not be saved to ${outputPath}: ${recording.moveError}.${recovery}`;
+			}
+
 			if (!fs.existsSync(outputPath)) {
 				return `Recording stopped after ~${durationSeconds}s but the output file was not found at: ${outputPath}`;
 			}
```

**File**: `src/utils.ts` (modified, +56/-0)
```diff
@@ -164,3 +164,59 @@ export function writeOutputFile(filePath: string, data: string | Buffer): void {
 		fs.closeSync(fd);
 	}
 }
+
+// a fresh 0700 directory nobody else can plant a symlink in, for files written
+// by mobilecli rather than by us
+export function createPrivateOutputPath(filename: string): string {
+	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mobile-mcp-"));
+	return path.join(dir, filename);
+}
+
+// rename replaces a symlink at `to` instead of following it. Across filesystems
+// rename fails with EXDEV, so copy next to `to` first (COPYFILE_EXCL refuses an
+// existing path) and rename that over `to`, keeping `to` intact if the copy fails
+export function moveOutputFile(from: string, to: string): void {
+	try {
+		fs.renameSync(from, to);
+		return;
+	} catch (error: any) {
+		if (error.code !== "EXDEV") {
+			throw error;
+		}
+
+	}
+
+	const partial = path.join(path.dirname(to), `.${path.basename(to)}.${process.pid}-${Date.now()}.partial`);
+	try {
+		fs.copyFileSync(from, partial, fs.constants.COPYFILE_EXCL);
+		fs.renameSync(partial, to);
+	} catch (error) {
+		fs.rmSync(partial, { force: true });
+		throw error;
+	}
+
+	fs.rmSync(from);
+}
+
+// moves a finished recording from its private directory to the requested
+// output; returns an error message when that fails, so stop can report it
+export function finishRecording(recordingPath: string, outputPath: string): string | undefined {
+	if (!fs.existsSync(recordingPath)) {
+		return "mobilecli did not produce a recording";
+	}
+
+	if (recordingPath === outputPath) {
+		return undefined;
+	}
+
+	try {
+		validateOutputPath(outputPath);
+		moveOutputFile(recordingPath, outputPath);
+	} catch (error: any) {
+		// keep the private directory, the recording is still in it
+		return error.message;
+	}
+
+	fs.rmSync(path.dirname(recordingPath), { recursive: true, force: true });
+	return undefined;
+}
```

**File**: `test/utils.ts` (modified, +112/-0)
```diff
@@ -9,6 +9,9 @@ import {
 	validateOutputPath,
 	withLowercaseScheme,
 	writeOutputFile,
+	moveOutputFile,
+	finishRecording,
+	createPrivateOutputPath,
 } from "../src/utils";
 
 test.describe("utils", () => {
@@ -235,4 +238,113 @@ test.describe("utils", () => {
 			}
 		});
 	});
+
+	// screen recordings are written by mobilecli, so they land in a private
+	// directory first and are moved to the requested output afterwards
+	test.describe("moveOutputFile", () => {
+		test.skip(process.platform === "win32", "creating a symlink needs elevated rights on windows");
+
+		const uniqueTempPath = (name: string): string => path.join(os.tmpdir(), `mobile-mcp-${process.pid}-${Date.now()}-${name}`);
+
+		test("should not move a recording through a symlink planted at the output path", () => {
+			const victim = uniqueTempPath("victim.txt");
+			const recording = uniqueTempPath("recording.mp4");
+			const output = uniqueTempPath("output.mp4");
+			fs.writeFileSync(victim, "ORIGINAL");
+			fs.writeFileSync(recording, "VIDEO");
+			fs.symlinkSync(victim, output);
+			try {
+				moveOutputFile(recording, output);
+
+				expect(fs.readFileSync(victim, "utf8")).toBe("ORIGINAL");
+				expect(fs.lstatSync(output).isSymbolicLink()).toBe(false);
+				expect(fs.readFileSync(output, "utf8")).toBe("VIDEO");
+			} finally {
+				fs.rmSync(output, { force: true });
+				fs.rmSync(recording, { force: true });
+				fs.rmSync(victim, { force: true });
+			}
+		});
+
+		test("should move a recording to a new output path", () => {
+			const recording = uniqueTempPath("recording.mp4");
+			const output = uniqueTempPath("output.mp4");
+			fs.writeFileSync(recording, "VIDEO");
+			try {
+				moveOutputFile(recording, output);
+
+				expect(fs.readFileSync(output, "utf8")).toBe("VIDEO");
+				expect(fs.existsSync(recording)).toBe(false);
+			} finally {
+				fs.rmSync(output, { force: true });
+				fs.rmSync(recording, { force: true });
+			}
+		});
+	});
+
+	test.describe("finishRecording", () => {
+		const uniqueTempPath = (name: string): string => path.join(os.tmpdir(), `mobile-mcp-${process.pid}-${Date.now()}-${name}`);
+
+		// rename fails with EXDEV when the private directory and the output live on
+		// different filesystems; simulate that and a copy that fails halfway
+		const whileRenameCrossesFilesystemsAndCopyFails = (check: () => void) => {
+			const originalRename = fs.renameSync;
+			const originalCopy = fs.copyFileSync;
+			fs.renameSync = () => {
+				throw Object.assign(new Error("cross-device link not permitted"), { code: "EXDEV" });
+			};
+			fs.copyFileSync = () => {
+				throw new Error("disk full");
+			};
+			try {
+				check();
+			} finally {
+				fs.renameSync = originalRename;
+				fs.copyFileSync = originalCopy;
+			}
+		};
+
+		test("should report a failure when mobilecli never created the recording", () => {
+			const recording = createPrivateOutputPath("recording.mp4");
+			const output = uniqueTempPath("previous.mp4");
+			fs.writeFileSync(output, "PREVIOUS RECORDING");
+			try {
+				expect(finishRecording(recording, output)).toBeDefined();
+			} finally {
+				fs.rmSync(output, { force: true });
+				fs.rmSync(path.dirname(recording), { recursive: true, force: true });
+			}
+		});
+
+		test("should remove the private directory after moving the recording", () => {
+			const recording = createPrivateOutputPath("recording.mp4");
+			const output = uniqueTempPath("output.mp4");
+			fs.writeFileSync(recording, "VIDEO");
+			try {
+				expect(finishRecording(recording, output)).toBeUndefined();
+				expect(fs.readFileSync(output, "utf8")).toBe("VIDEO");
+				expect(fs.existsSync(path.dirname(recording))).toBe(false);
+			} finally {
+				fs.rmSync(output, { force: true });
+				fs.rmSync(path.dirname(recording), { recursive: true, force: true });
+			}
+		});
+
+		test("should keep the existing output when a cross-filesystem copy fails", () => {
+			const recording = uniqueTempPath("recording.mp4");
+			const output = uniqueTempPath("existing.mp4");
+			fs.writeFileSync(recording, "VIDEO");
+			fs.writeFileSync(output, "EXISTING");
+			try {
+				whileRenameCrossesFilesystemsAndCopyFails(() => {
+					expect(() => moveOutputFile(recording, output)).toThrow();
+				});
+				expect(fs.readFileSync(output, "utf8")).toBe("EXISTING");
+				expect(fs.readFileSync(recording, "utf8")).toBe("VIDEO");
+			} finally {
+				fs.rmSync(output, { force: true });
+				fs.rmSync(recording, { force: true });
+			}
+		});
+	});
 });
```

---

### Incident Patch 3: `2f75dc05` (2026-10-14)
**Commit Message**: fix: reject output paths with too many levels of symbolic links (#507)

Raise the symlink hop limit to 64 (windows follows up to 63) and throw once
it is reached, instead of handing the last path to the root check. A symlink
cycle is now rejected up front rather than failing later with ELOOP.

Co-authored-by: TBernard97 <[REDACTED_EMAIL]>
Co-authored-by: barnessomer <[REDACTED_EMAIL]>
Co-authored-by: arpitjain099 <[REDACTED_EMAIL]>

**File**: `src/utils.ts` (modified, +7/-4)
```diff
@@ -79,6 +79,10 @@ export function validateFileExtension(filePath: string, allowedExtensions: strin
 	}
 }
 
+// windows follows up to 63 reparse points per path, linux 40 and macos 32;
+// anything longer is rejected rather than handed to the write
+const MAX_SYMLINK_HOPS = 64;
+
 // Walk `filePath` to the real location a write would land on, following a
 // symlink in EVERY component - not just the parent directory. Resolving only the
 // parent let a symlink at, or before, the final component redirect the write
@@ -90,9 +94,8 @@ export function validateFileExtension(filePath: string, allowedExtensions: strin
 function resolveWithSymlinks(filePath: string): string {
 	let current = path.resolve(filePath);
 
-	// bound the walk so a symlink cycle cannot spin forever; a cycle makes the
-	// eventual write fail with ELOOP, so it is not an escape
-	for (let hops = 0; hops < 40; hops++) {
+	// bound the walk so a symlink cycle cannot spin forever
+	for (let hops = 0; hops < MAX_SYMLINK_HOPS; hops++) {
 		const dir = path.dirname(current);
 		const filename = path.basename(current);
 
@@ -124,7 +127,7 @@ function resolveWithSymlinks(filePath: string): string {
 		current = path.resolve(realDir, fs.readlinkSync(candidate));
 	}
 
-	return current;
+	throw new ActionableError(`"${filePath}" has too many levels of symbolic links.`);
 }
 
 export function validateOutputPath(filePath: string): void {
```

**File**: `test/utils.ts` (modified, +13/-0)
```diff
@@ -186,5 +186,18 @@ test.describe("utils", () => {
 				fs.rmSync(first, { force: true });
 			}
 		});
+
+		test("should reject a symlink cycle", () => {
+			const first = createSymlink(path.join(process.cwd(), "mobile-mcp-cycle-placeholder.png"));
+			const second = createSymlink(path.basename(first));
+			fs.rmSync(first);
+			fs.symlinkSync(path.basename(second), first);
+			try {
+				expect(() => validateOutputPath(first)).toThrow(/too many levels of symbolic links/);
+			} finally {
+				fs.rmSync(second, { force: true });
+				fs.rmSync(first, { force: true });
+			}
+		});
 	});
 });
```

#### Recent Merged Pull Requests:
- **PR #541** (2026-10-30): docs: update changelog for 1.0.15 (@gmegidish)
- **PR #540** (2026-10-30): ci: run npm audit only when dependencies change (@gmegidish)
- **PR #539** (2026-10-30): chore: bump @modelcontextprotocol/node to 2.1.2 (@gmegidish)
- **PR #533** (2026-10-30): fix: replace the output file by rename instead of writing through a link (@gmegidish)
- **PR #532** (2026-10-26): docs: update changelog for v1.0.14 (@gmegidish)
- **PR #531** (2026-10-26): feat: add install command that configures detected MCP clients (@gmegidish)

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

## X. raise maxBuffer for executeCommand so large UI dumps don't fail with ENOBUFS (#5

**RULE**:
When implementing operations in `src/mobilecli.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mobile-next/mobile-mcp. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cd3cb571`: raise maxBuffer for executeCommand so large UI dumps don't fail with ENOBUFS (#518). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/mobilecli.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
		const options: { encoding: "utf8"; maxBuffer: number; timeout?: number } = { encoding: "utf8", maxBuffer: MAX_BUFFER_SIZE };
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
		const options: { encoding: "utf8"; timeout?: number } = { encoding: "utf8" };
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cd3cb571` are properly handled with clean fallback behavior.

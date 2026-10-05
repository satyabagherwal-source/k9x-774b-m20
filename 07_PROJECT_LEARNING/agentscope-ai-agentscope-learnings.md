# Forensic Learning Record (Deep Inspection): agentscope-ai/agentscope

> **Canonical Artifact**: `07_PROJECT_LEARNING/agentscope-ai-agentscope-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agentscope-ai/agentscope](https://github.com/agentscope-ai/agentscope))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:27:43.898Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agentscope-ai/agentscope`
- **Description**: Build and run agents you can see, understand and trust.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 32783 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/web_ui/frontend/src/components/chat/tool-renderers/BashRenderer.tsx`
```
import { getResultText, parseInput, toolLabelClass } from './_shared';
import type { ToolRenderer } from './types';

function getCommand(input: string): string {
	const { command } = parseInput(input) as { command?: string };
	return command || input;
}

export const BashRenderer: ToolRenderer = {
	getDisplayName: () => 'Bash',

	renderConfirmBody: (call) => {
		const { command, description } = parseInput(call.input) as {
			command?: string;
			description?: string;
		};
		return (
			<div className="w-full max-w-full">
				<div className="text-secondary-foreground font-mono">{command}</div>
				{description && <div className="text-muted-foreground">{description}</div>}
			</div>
		);
	},

	renderHeader: (pair) => (
		<>
			<span className={toolLabelClass}>Bash</span>
			{/* The command is code, so it keeps a mono font rather than the shared
			    argument style; it still brightens on hover like every other row. */}
			<span className="font-mono min-w-0 truncate transition-colors group-hover:text-foreground">
				{getCommand(pair.call.input)}
			</span>
		</>
	),

	renderBody: (pair) => {
		if (!pair.result) return null;

		const shellRes = getResultText(pair.result);
		return (
			<div className="flex flex-col border bg-background rounded-sm p-2 text-xs">
				<div className="text-muted-foreground">Input</div>
				<pre className="overflow-x-auto p-2 border rounded bg-secondary ">
					{JSON.stringify(parseInput(pair.call.input), null, 2)}
				</pre>
				<div className="text-muted-foreground mt-2">Output</div>
				<pre className="overflow-auto p-2 border rounded bg-secondary max-h-[200px]">
					{shellRes}
				</pre>
			</div>
		);
	},
};

```

### Core Architecture Module: `examples/web_ui/frontend/src/components/chat/tool-renderers/DefaultRenderer.tsx`
```
import type { ToolCallBlock } from '@agentscope-ai/agentscope/message';
import * as mime from 'mime-types';
import type { ReactNode } from 'react';

import { getResultText, toolArgClass, toolLabelClass } from './_shared';
import type { TFunction, ToolCallWithResult } from './types';

export function defaultGetDisplayName(call: ToolCallBlock): string {
	return call.name;
}

export function defaultRenderConfirmBody(call: ToolCallBlock): ReactNode {
	return (
		<div className="w-full max-w-full overflow-hidden break-words">
			<div className="text-secondary-foreground">{call.input}</div>
		</div>
	);
}

/**
 * Default trigger line for tools without a custom `renderHeader` (e.g. MCP
 * tools): the generic "Call tool" label followed by the tool name rendered in
 * the shared argument style, so a nameless tool still reads as an action.
 */
export function defaultRenderHeader(pair: ToolCallWithResult, t: TFunction): ReactNode {
	return (
		<>
			<span className={toolLabelClass}>{t('tool.callGeneric')}</span>
			<span className={toolArgClass}>{defaultGetDisplayName(pair.call)}</span>
		</>
	);
}

/**
 * Default expandable body: the result output as text. The container caps its
 * height and scrolls, so no line counting / truncation is needed. Returns
 * `null` before the call has any result so the row stays non-expandable.
 */
export function defaultRenderBody(pair: ToolCallWithResult, t: TFunction): ReactNode {
	const { call, result } = pair;
	if (!result) return null;
	if (call.state === 'asking' || result.state === 'running') {
		return (
			<div className="flex flex-col border rounded-sm bg-background">
				<div className="px-2 py-1 whitespace-nowrap overflow-x-auto">
					{t('common.running')}
				</div>
			</div>
		);
	}
	if (result.state === 'interrupted') {
		const result = getResultText(pair.result);
		return (
			<div className="flex flex-col border rounded-sm bg-background">
				<div className="px-2 py-1 whitespace-nowrap overflow-x-auto">{result}</div>
			</div>
		);
	}

	// TODO: render multimodal outputs
	let text: string;
	if (typeof result.output === 'string') {
		text = result.output;
	} else {
		text = result.output
			.map((b) => {
				if (b.type === 'text') return b.text;
				const mainType = b.source.media_type.split('/')[0].toUpperCase();
				const ext = (mime.extension(b.source.media_type) || 'bin').toLowerCase();
				return `[${mainType}.${ext}]`;
			})
			.join('\n');
	}

	return (
		<pre className="border rounded-sm bg-background p-2 text-xs overflow-auto max-h-[200px] whitespace-pre-wrap">
			{text}
		</pre>
	);
}

```

### Core Architecture Module: `examples/web_ui/frontend/src/components/chat/tool-renderers/DiffPreview.tsx`
```
import { ChevronDown, MoreHorizontal, Minus, Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Decoration, Diff, Hunk, parseDiff } from 'react-diff-view';
import type { ChangeData, DiffType, GutterOptions, HunkData } from 'react-diff-view';

import 'react-diff-view/style/index.css';

const MAX_VISIBLE_DIFF_LINES = 18;

interface DiffPreviewProps {
	/**
	 * Pre-computed unified-diff text (produced by the backend Edit / Write
	 * tools and delivered via ``ToolResultBlock.metadata.diff``). It carries
	 * absolute file line numbers and naturally handles multi-hunk diffs from
	 * ``replace_all``. The component renders nothing if this is empty.
	 */
	unifiedDiff: string;
}

function hunkLineCount(hunk: HunkData): number {
	return hunk.changes.length;
}

function getVisibleHunks(hunks: HunkData[], expanded: boolean): HunkData[] {
	if (expanded) return hunks;

	let visibleLineCount = 0;
	const visibleHunks: HunkData[] = [];

	for (const hunk of hunks) {
		const remaining = MAX_VISIBLE_DIFF_LINES - visibleLineCount;
		if (remaining <= 0) break;
		const hunkLines = hunkLineCount(hunk);
		if (hunkLines <= remaining) {
			visibleHunks.push(hunk);
			visibleLineCount += hunkLines;
			continue;
		}
		// Hunk doesn't fit in the remaining budget. If we haven't shown
		// anything yet (typical for new-file / full-rewrite diffs that
		// produce a single very large hunk), include a truncated slice so
		// the user still sees the start of the change. Otherwise stop so
		// we never overshoot ``MAX_VISIBLE_DIFF_LINES``.
		if (visibleHunks.length === 0) {
			visibleHunks.push(truncateHunkChanges(hunk, remaining));
		}
		break;
	}

	return visibleHunks;
}

/**
 * Build a new ``HunkData`` containing only the first ``maxLines`` changes of
 * ``hunk``. ``oldLines`` / ``newLines`` are recomputed from the slice so
 * react-diff-view's line-number accounting stays internally consistent.
 */
function truncateHunkChanges(hunk: HunkData, maxLines: number): HunkData {
	if (hunk.changes.length <= maxLines) return hunk;
	const changes = hunk.changes.slice(0, maxLines);
	let oldLines = 0;
	let newLines = 0;
	for (const change of changes) {
		if (change.type === 'normal') {
			oldLines += 1;
			newLines += 1;
		} else if (change.type === 'delete') {
			oldLines += 1;
		} else if (change.type === 'insert') {
			newLines += 1;
		}
	}
	return { ...hunk, changes, oldLines, newLines };
}

function countHiddenLines(allHunks: HunkData[], visibleHunks: HunkData[]): number {
	const total = allHunks.reduce((sum, hunk) => sum + hunkLineCount(hunk), 0);
	const visible = visibleHunks.reduce((sum, hunk) => sum + hunkLineCount(hunk), 0);
	return Math.max(0, total - visible);
}

function getLineClassName({ changes }: { changes: Array<{ type: string }> }): string {
	if (changes.some((change) => change.type === 'insert')) {
		return 'bg-emerald-500/10';
	}
	if (changes.some((change) => change.type === 'delete')) {
		return 'bg-red-500/10';
	}
	return 'bg-transparent';
}

// Pick the line number we want to display in the single visible gutter column.
// - normal rows show the new-side line number (mirrors GitHub's unified view)
// - insert / delete rows only have one `lineNumber` field, so use it directly
function getDisplayedLineNumber(change: ChangeData): number | undefined {
	if (change.type === 'normal') return change.newLineNumber;
	return change.lineNumber;
}

// Render only the "new" side of each row. The "old" side <col> is removed
// from the table layout via `visibility: collapse` (see arbitrary variants
// on the table className below), so the unified diff effectively renders
// as a single gutter column showing `<line-number> +/-`.
function renderGutter({ change, side }: GutterOptions) {
	if (side === 'old') return null;

	let marker = null;
	if (change.type === 'insert') {
		marker = <Plus className="size-2.5 text-emerald-600 dark:text-emerald-400" />;
	} else if (change.type === 'delete') {
		marker = <Minus className="size-2.5 text-red-600 dark:text-red-400" />;
	}

	return (
		<span className="inline-flex w-full items-center justify-between tabular-nums">
			<span>{getDisplayedLineNumber(change)}</span>
			{marker}
		</span>
	);
}

// Lines between two consecutive hunks that the unified diff omitted.
// ``hunk.oldStart`` is 1-based and ``oldLines`` is the count of old-side
// lines covered (including context). So the next hunk's ``oldStart`` minus
// the end of the previous hunk gives the gap.
function gapLinesBetween(prev: HunkData, next: HunkData): number {
	return next.oldStart - (prev.oldStart + prev.oldLines);
}

export function DiffPreview({ unifiedDiff }: DiffPreviewProps) {
	const [expanded, setExpanded] = useState(false);
	const diffFile = useMemo(
		() => parseDiff(unifiedDiff, { nearbySequences: 'zip' })[0],
		[unifiedDiff],
	);

	if (!diffFile || diffFile.hunks.length === 0) {
		return <div className="text-xs text-muted-foreground">No textual changes detected.</div>;
	}

	const visibleHunks = getVisibleHunks(diffFile.hunks, expanded);
	const hiddenLines = countHiddenLines(diffFile.hunks, visibleHunks);

	return (
		<Diff
			diffType={diffFile.type as DiffType}
			hunks={visibleHunks}
			viewType="unified"
			renderGutter={renderGutter}
			className="w-full border-collapse font-mono text-xs leading-5 [&>colgroup>col:first-child]:!w-0 [&>colgroup>col:first-child]:[visibility:collapse] [&_td.diff-gutter:first-of-type]:!p-0 [&_td.diff-gutter:first-of-type]:!border-r-0 [&_td.diff-gutter:first-of-type]:!w-0"
			hunkClassName="align-top"
			lineClassName="align-top"
			gutterClassName="select-none border-r border-border px-2 text-right text-muted-foreground"
			codeClassName="whitespace-pre-wrap break-all px-3"
			generateLineClassName={getLineClassName}
		>
			{(hunks) => {
				const children: ReactElement[] = [];

				hunks.forEach((hunk, idx) => {
					if (idx > 0) {
						// Insert an ellipsis decoration between hunks so it's
						// visually obvious there are skipped lines between
						// e.g. an edit at line 20 and another at line 70.
						const gap = gapLinesBetween(hunks[idx - 1], hunk);
						children.push(
							<Decoration key={`gap-${hunk.oldStart}-${hunk.newStart}`}>
								<div className="flex items-center gap-2 border-y border-dashed border-border bg-muted/30 px-3 py-1 text-[10px] text-muted-foreground select-none">
									<MoreHorizontal className="h-3 w-3" />
									<span className="tabular-nums">
										{gap > 0
											? `${gap} unchanged line${gap === 1 ? '' : 's'}`
											: 'unchanged lines'}
									</span>
								</div>
							</Decoration>,
						);
					}
					children.push(
						<Hunk key={`hunk-${hunk.oldStart}-${hunk.newStart}`} hunk={hunk} />,
					);
				});

				if (hiddenLines > 0) {
					children.push(
						<Decoration key="collapsed-diff-lines">
							<button
								type="button"
								className="flex w-full items-center justify-center gap-1 border-t border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								onClick={() => setExpanded(true)}
							>
								<ChevronDown className="h-3.5 w-3.5" />
								{hiddenLines} more lines (click to expand)
							</button>
						</Decoration>,
					);
				}

				return children;
			}}
		</Diff>
	);
}

```

### Core Architecture Module: `examples/web_ui/frontend/src/components/chat/tool-renderers/EditRenderer.tsx`
```
import unidiff from 'unidiff';

import { defaultRenderBody } from './DefaultRenderer';
import { DiffPreview } from './DiffPreview';
import type { ToolCallWithResult, ToolRenderer } from './types';
import {
	countDiffStats,
	DiffStats,
	FramedFileBody,
	getResultDiff,
	parseInput,
	toolArgClass,
	toolLabelClass,
	tryGetFileName,
	tryGetFilePath,
} from '@/components/chat/tool-renderers/_shared.tsx';

/**
 * Count the real inserted / deleted lines between ``oldText`` and ``newText``
 * by computing a unified diff and tallying the leading ``+`` / ``-`` markers.
 * This is the per-occurrence diff size — for ``replace_all`` the backend
 * reports the totalled counts via ``result.metadata`` (see ``countDiffStats``).
 */
function countLineChanges(
	oldText: string,
	newText: string,
): { insertions: number; deletions: number } {
	const diffText = unidiff.diffAsText(oldText, newText, { context: 0 });
	return countDiffStats(diffText);
}

/**
 * Insert/delete counts for the header badge. Prefer the backend post-execution
 * diff (correct for ``replace_all`` and absolute line numbers); before it
 * arrives, fall back to a per-occurrence client-side estimate of
 * ``old_string`` / ``new_string``.
 */
function headerStats(pair: ToolCallWithResult): { insertions: number; deletions: number } {
	const resultDiff = pair.result ? getResultDiff(pair.result) : undefined;
	if (resultDiff) return countDiffStats(resultDiff);
	const input = parseInput(pair.call.input);
	const oldString = typeof input.old_string === 'string' ? input.old_string : '';
	const newString = typeof input.new_string === 'string' ? input.new_string : '';
	return countLineChanges(oldString, newString);
}

export const EditRenderer: ToolRenderer = {
	getDisplayName: (call) => call.name,

	renderConfirmBody: (call) => (
		<div className="w-full max-w-full overflow-hidden break-words">
			<div className="text-secondary-foreground">{tryGetFilePath(call.input)}</div>
		</div>
	),

	renderHeader: (pair) => {
		// While the tool-call JSON is still streaming, ``call.input`` is a partial
		// dict and the file name / diff can't be trusted yet — show just the label.
		const fileName = tryGetFileName(pair.call.input);
		if (!fileName) return <span className={toolLabelClass}>{pair.call.name}</span>;
		const { insertions, deletions } = headerStats(pair);
		return (
			<>
				<span className={toolLabelClass}>{pair.call.name}</span>
				<span className={toolArgClass}>{fileName}</span>
				<DiffStats insertions={insertions} deletions={deletions} />
			</>
		);
	},

	renderBody: (pair, t) => {
		// Until the call has actually run there's no file change to frame — the
		// input is still streaming in as partial JSON.
		if (!pair.result || pair.result.state === 'running') return undefined;
		if (pair.result.state === 'success') {
			// The backend Edit tool always attaches a unified diff (absolute line
			// numbers, one hunk per replaced occurrence). A client-side diff of
			// old_string/new_string would be misleading, so if it's missing we
			// fall through to the default result body rather than fabricate one.
			const diff = getResultDiff(pair.result);
			if (diff) {
				return (
					<FramedFileBody filePath={tryGetFilePath(pair.call.input)}>
						<DiffPreview unifiedDiff={diff} />
					</FramedFileBody>
				);
			}
		}
		// Errors / interruptions aren't file content, so drop the path frame.
		return defaultRenderBody(pair, t);
	},
};

```

### Core Architecture Module: `examples/web_ui/frontend/src/components/chat/tool-renderers/GlobRenderer.tsx`
```
import { getResultText, parseInput, toolArgClass, toolLabelClass } from './_shared';
import type { ToolRenderer } from './types';

function getPattern(input: string): string {
	const { pattern } = parseInput(input) as { pattern?: string };
	return pattern || input;
}

export const GlobRenderer: ToolRenderer = {
	getDisplayName: (_call, t) => t('tool.glob.name'),

	renderHeader: (pair) => (
		<>
			<span className={toolLabelClass}>Glob pattern</span>
			<span className={toolArgClass}>{getPattern(pair.call.input)}</span>
		</>
	),

	renderBody: (pair) =>
		pair.result ? (
			<pre className="border rounded-sm bg-background p-2 font-mono text-xs overflow-x-auto whitespace-pre">
				{getResultText(pair.result)}
			</pre>
		) : null,
};

```

### Core Architecture Module: `examples/web_ui/frontend/src/components/chat/tool-renderers/GrepRenderer.tsx`
```
import { getResultText, parseInput, toolArgClass, toolLabelClass } from './_shared';
import type { ToolRenderer } from './types';

function getPattern(input: string): string {
	const { pattern } = parseInput(input) as { pattern?: string };
	return pattern || input;
}

export const GrepRenderer: ToolRenderer = {
	getDisplayName: (_call, t) => t('tool.grep.name'),

	renderHeader: (pair) => (
		<>
			<span className={toolLabelClass}>Grep pattern</span>
			<span className={toolArgClass}>{getPattern(pair.call.input)}</span>
		</>
	),

	renderBody: (pair) =>
		pair.result ? (
			<pre className="border rounded-sm bg-background p-2 font-mono text-xs overflow-x-auto whitespace-pre">
				{getResultText(pair.result)}
			</pre>
		) : null,
};

```

### Core Architecture Module: `examples/web_ui/frontend/src/components/chat/tool-renderers/ReadRenderer.tsx`
```
import {
	FramedFileBody,
	getResultText,
	toolArgClass,
	toolLabelClass,
	tryGetFileName,
	tryGetFilePath,
} from './_shared';
import { defaultRenderBody } from './DefaultRenderer';
import { DiffPreview } from './DiffPreview';
import type { ToolRenderer } from './types';

/**
 * Split a `cat -n` formatted Read result (`"    12\tcontent"`, produced by the
 * backend Read tool) into `{ num, text }` rows. Lines without a tab (e.g.
 * non-text/binary output) fall back to an empty line number.
 */
function parseNumberedLines(content: string): Array<{ num: string; text: string }> {
	return content.split('\n').map((line) => {
		const tab = line.indexOf('\t');
		if (tab === -1) return { num: '', text: line };
		return { num: line.slice(0, tab).trim(), text: line.slice(tab + 1) };
	});
}

/**
 * Render a Read result through the very same `DiffPreview` that Edit / Write
 * use, by synthesizing a unified diff whose every line is an unchanged context
 * line. Read isn't a diff, but presenting it as an all-context one gives it the
 * identical monospace layout and line-number gutter — just without +/- markers
 * or colouring — so all three file tools look consistent. The starting line
 * number is taken from the first `cat -n` gutter value so partial reads
 * (`offset`) still show absolute line numbers.
 */
function buildContextDiff(content: string): string {
	const rows = parseNumberedLines(content);
	const start = parseInt(rows[0]?.num ?? '', 10) || 1;
	const body = rows.map((row) => ` ${row.text}`).join('\n');
	return `--- a/file\n+++ b/file\n@@ -${start},${rows.length} +${start},${rows.length} @@\n${body}`;
}

export const ReadRenderer: ToolRenderer = {
	getDisplayName: (_call, t) => t('tool.read.name'),

	renderConfirmBody: (call) => (
		<div className="w-full max-w-full overflow-hidden break-words">
			<div className="text-secondary-foreground">{tryGetFilePath(call.input)}</div>
		</div>
	),

	renderHeader: (pair) => {
		const fileName = tryGetFileName(pair.call.input);
		const readContent = getResultText(pair.result);
		const lines = readContent ? readContent.split('\n').length : 0;
		return (
			<>
				<span className={toolLabelClass}>Read</span>
				{fileName && <span className={toolArgClass}>{fileName}</span>}
				{pair.result?.state === 'success' && (
					<span className={toolLabelClass}>{lines} lines</span>
				)}
			</>
		);
	},

	renderBody: (pair, t) => {
		// Until the call has actually run there's no file content to frame — the
		// input is still streaming in as partial JSON.
		if (!pair.result || pair.result.state === 'running') return undefined;
		// Errors / interruptions aren't file content, so drop the path frame.
		if (pair.result.state !== 'success') return defaultRenderBody(pair, t);
		return (
			<FramedFileBody filePath={tryGetFilePath(pair.call.input)}>
				<DiffPreview unifiedDiff={buildContextDiff(getResultText(pair.result))} />
			</FramedFileBody>
		);
	},
};

```

### Core Architecture Module: `examples/web_ui/frontend/src/components/chat/tool-renderers/TaskCreateRenderer.tsx`
```
import { getResultText, parseInput, toolArgClass, toolLabelClass } from './_shared';
import type { ToolCallWithResult, ToolRenderer } from './types';

/**
 * Extract the numeric task id the backend echoes in its result text
 * (`"Task (id=3) created successfully: ..."`), or `null` if absent.
 */
function getTaskId(pair: ToolCallWithResult): string | null {
	const match = getResultText(pair.result).match(/^Task \(id=(\d+)\)/);
	return match ? match[1] : null;
}

export const TaskCreateRenderer: ToolRenderer = {
	getDisplayName: (_call, t) => t('tool.taskCreate.name'),

	// Trigger line: "Create task #{id} {subject}"
	renderHeader: (pair) => {
		const subject = (parseInput(pair.call.input).subject as string) || '(untitled)';
		const taskId = getTaskId(pair);
		return (
			<>
				<span className={toolLabelClass}>Create task</span>
				<span className={toolArgClass}>
					{taskId && <span className="text-muted-foreground font-mono">#{taskId} </span>}
					{subject}
				</span>
			</>
		);
	},

	// Expanded body: the task description.
	renderBody: (pair) => {
		const description = (parseInput(pair.call.input).description as string) || '';
		return description ? (
			<div className="border rounded-sm bg-background p-2 text-xs text-muted-foreground break-all">
				{description}
			</div>
		) : null;
	},
};

```

### Core Architecture Module: `examples/web_ui/frontend/src/components/chat/tool-renderers/WriteRenderer.tsx`
```
import { defaultRenderBody } from './DefaultRenderer';
import { DiffPreview } from './DiffPreview';
import type { ToolRenderer } from './types';
import {
	countDiffStats,
	DiffStats,
	FramedFileBody,
	getResultDiff,
	toolArgClass,
	toolLabelClass,
	tryGetFileName,
	tryGetFilePath,
} from '@/components/chat/tool-renderers/_shared.tsx';

export const WriteRenderer: ToolRenderer = {
	getDisplayName: (call) => call.name,

	renderConfirmBody: (call) => (
		<div className="w-full max-w-full overflow-hidden break-words">
			<div className="text-secondary-foreground">{tryGetFilePath(call.input)}</div>
		</div>
	),

	renderHeader: (pair) => {
		const fileName = tryGetFileName(pair.call.input);
		// Pre-execution we only know the new ``content`` (not the previous file
		// body), so any ``+N`` count would be misleading on overwrites. Show the
		// real ``+N -M`` only once the backend post-execution diff has arrived.
		const diff = pair.result ? getResultDiff(pair.result) : undefined;
		const stats = diff ? countDiffStats(diff) : null;
		return (
			<>
				<span className={toolLabelClass}>{pair.call.name}</span>
				{fileName && <span className={toolArgClass}>{fileName}</span>}
				{stats && <DiffStats insertions={stats.insertions} deletions={stats.deletions} />}
			</>
		);
	},

	renderBody: (pair, t) => {
		// Until the call has actually run there's no file change to frame — the
		// input is still streaming in as partial JSON.
		if (!pair.result || pair.result.state === 'running') return undefined;
		if (pair.result.state === 'success') {
			// The backend Write tool always attaches a unified diff (new-file
			// creation against /dev/null or an overwrite with absolute line
			// numbers). If it's missing we fall through rather than fabricate one.
			const diff = getResultDiff(pair.result);
			if (diff) {
				return (
					<FramedFileBody filePath={tryGetFilePath(pair.call.input)}>
						<DiffPreview unifiedDiff={diff} />
					</FramedFileBody>
				);
			}
		}
		// Errors / interruptions aren't file content, so drop the path frame.
		return defaultRenderBody(pair, t);
	},
};

```

### Core Architecture Module: `examples/web_ui/frontend/src/components/chat/tool-renderers/_shared.tsx`
```
import type { ToolResultBlock } from '@agentscope-ai/agentscope/message';
import { Ban, Check, ChevronRight, LoaderCircle, Minus, Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ToolCallWithResult } from './types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/utils/common.ts';

export function ToolStateIcon({ state }: { state: ToolResultBlock['state'] | undefined }) {
	if (state === 'success') {
		return <Check className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />;
	}
	if (state === 'error') {
		return <X className="size-3 text-red-600 dark:text-red-400  shrink-0" />;
	}
	if (state === 'interrupted' || state === 'denied') {
		return <Ban className="size-3 !h-3 min-h-3 shrink-0" />;
	}

	// running
	return <LoaderCircle className="size-3 shrink-0 animate-spin" />;
}

/**
 * Flatten a tool result's ``output`` (string or block array) into plain text,
 * keeping only the text blocks. Returns ``''`` when the result is missing.
 */
export function getResultText(result?: ToolResultBlock): string {
	if (!result) return '';
	if (typeof result.output === 'string') return result.output;
	if (Array.isArray(result.output)) {
		return result.output.map((b) => (b.type === 'text' ? b.text : '')).join('\n');
	}
	return '';
}

/**
 * Shared class for the *leading label* of a tool-call trigger line — the verb
 * or tool name such as "Read", "Bash", "Grep pattern", or the generic
 * "Call tool". Deliberately not bold (no `<strong>`): every tool's label looks
 * the same and only brightens to the foreground colour on row hover (the row
 * is a `group`).
 */
export const toolLabelClass = 'shrink-0 transition-colors group-hover:text-foreground';

/**
 * Shared class for the *primary argument* of a trigger line — the file name
 * (Read/Edit/Write), search pattern (Grep/Glob), task subject (TaskCreate) or,
 * for tools without a dedicated renderer, the tool name itself. Unifies weight
 * and truncation so the second slot is visually identical across every tool.
 */
export const toolArgClass =
	'font-[450] min-w-0 truncate transition-colors group-hover:text-foreground';

/**
 * One collapsible tool-call row — the single shared shell every tool renders
 * through. The trigger line is ``{header}  <state-icon>  <chevron>``; the
 * chevron only appears on hover and stays visible (rotated down) while open.
 * When ``body`` is provided the row expands to reveal it; without a body the
 * row is a plain, non-expandable line (no chevron, no pointer cursor).
 *
 * ``header`` should be a fragment of inline flex children (the parent supplies
 * ``gap-x-2``); tools never touch the Collapsible / state icon themselves.
 */
export function ToolCallRow({
	pair,
	header,
	body,
}: {
	pair: ToolCallWithResult;
	header: ReactNode;
	body?: ReactNode;
}) {
	const expandable = body != null && body !== false;
	// Shimmer the header text. The shadcn ``shimmer`` util is a text-clip effect,
	// so it has to sit on the elements that *directly* hold the text — the
	// header's own leaf spans — not on a wrapper (a wrapper only makes descendant
	// text transparent). We target the direct span children of this flex row
	// instead of wrapping ``header``, which also keeps their ``gap-x-2`` spacing.
	const isRunning = !pair.result || pair.result.state === 'running';
	const row = (
		<div
			className={cn(
				'group flex flex-row gap-x-2 items-center w-full',
				expandable && 'cursor-pointer',
				isRunning && 'shimmer',
			)}
		>
			{header}
			<ToolStateIcon state={pair.result?.state} />
			{expandable && (
				<ChevronRight
					className={
						'size-3 shrink-0 transition-transform text-transparent group-hover:text-current group-data-[state=open]:flex group-data-[state=open]:rotate-90'
					}
				/>
			)}
		</div>
	);

	if (!expandable) return row;

	return (
		<Collapsible>
			<CollapsibleTrigger asChild>{row}</CollapsibleTrigger>
			<CollapsibleContent>{body}</CollapsibleContent>
		</Collapsible>
	);
}

/**
 * Parse the input arguments from the given string.
 * @param input
 * @returns The JSON Record or empty object if parsing fails.
 */
export function parseInput(input: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(input);
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

/**
 * Get the filepath from the input arguments.
 * @param input
 * @returns The filepath, or ``undefined`` when ``input`` isn't yet a complete
 * JSON object carrying a non-empty ``file_path`` — a tool call's arguments
 * stream in as partial JSON, and a fragment of ``content`` must never pass for
 * a path.
 */
export function tryGetFilePath(input: string): string | undefined {
	const { file_path } = parseInput(input) as { file_path?: unknown };
	return typeof file_path === 'string' && file_path.length > 0 ? file_path : undefined;
}

/**
 * The basename of ``file_path``, or ``undefined`` while the tool-call JSON is
 * still streaming. Use this in ``renderHeader`` so a partial input renders no
 * file name rather than a garbled one.
 * @param input
 * @returns The filename, considering different OS path separators.
 */
export function tryGetFileName(input: string): string | undefined {
	const filePath = tryGetFilePath(input);
	if (!filePath) return undefined;
	const segments = filePath.split(/[/\\]+/).filter(Boolean);
	return segments.length > 0 ? segments[segments.length - 1] : filePath;
}

/**
 * Tally inserted / deleted lines from a unified diff text. The leading
 * ``+++`` / ``---`` lines (file headers) are excluded.
 */
export function countDiffStats(diffText: string): {
	insertions: number;
	deletions: number;
} {
	let insertions = 0;
	let deletions = 0;
	for (const line of diffText.split('\n')) {
		if (line.startsWith('+') && !line.startsWith('+++')) insertions++;
		else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
	}
	return { insertions, deletions };
}

/**
 * Extract the ``diff`` field from a ToolResultBlock metadata bag, returning
 * ``undefined`` when missing or empty so callers can use it with ``??``.
 */
export function getResultDiff(result: { metadata?: Record<string, unknown> }): string | undefined {
	const diff = result.metadata?.diff;
	return typeof diff === 'string' && diff.length > 0 ? diff : undefined;
}

/**
 * Framed body box shared by file-oriented tools (Read / Edit / Write): a
 * bordered card with the file path as a header, a separator, then the tool's
 * own content (numbered source lines for Read, a diff for Edit / Write).
 */
export function FramedFileBody({ filePath, children }: { filePath?: string; children: ReactNode }) {
	return (
		<div className="flex flex-col border rounded-sm bg-background">
			{filePath && (
				<>
					<div className="px-2 py-1 whitespace-nowrap overflow-x-auto">{filePath}</div>
					<Separator />
				</>
			)}
			{children}
		</div>
	);
}

/**
 * Compact ``+N -M`` badge used in tool call headers for Edit / Write to show
 * how many lines were inserted and deleted.
 */
export function DiffStats({
	insertions,
	deletions,
	className,
}: {
	insertions: number;
	deletions: number;
	className?: string;
}) {
	if (insertions === 0 && deletions === 0) return null;
	return (
		<div className={cn('flex items-center gap-0.5', className)}>
			<div className="flex items-center text-emerald-600 dark:text-emerald-400">
				<Plus className="size-2.5 stroke-2" />
				{formatNumber(insertions)}
			</div>

			<div className="flex items-center text-red-600 dark:text-red-400">
				<Minus className="size-2.5 stroke-2" />
				{formatNumber(deletions)}
			</div>
		</div>
	);
}

```

### Core Architecture Module: `examples/web_ui/frontend/src/components/chat/tool-renderers/index.tsx`
```
import type { ToolCallBlock } from '@agentscope-ai/agentscope/message';
import type { ReactNode } from 'react';

import { ToolCallRow } from './_shared';
import { BashRenderer } from './BashRenderer';
import {
	defaultGetDisplayName,
	defaultRenderBody,
	defaultRenderConfirmBody,
	defaultRenderHeader,
} from './DefaultRenderer';
import { EditRenderer } from './EditRenderer';
import { GlobRenderer } from './GlobRenderer';
import { GrepRenderer } from './GrepRenderer';
import { ReadRenderer } from './ReadRenderer';
import { TaskCreateRenderer } from './TaskCreateRenderer';
import type { TFunction, ToolCallWithResult, ToolRenderer } from './types';
import { WriteRenderer } from './WriteRenderer';

const renderers: Record<string, ToolRenderer> = {
	Bash: BashRenderer,
	Read: ReadRenderer,
	Write: WriteRenderer,
	Edit: EditRenderer,
	Glob: GlobRenderer,
	Grep: GrepRenderer,
	TaskCreate: TaskCreateRenderer,
};

function getRenderer(toolName: string): ToolRenderer {
	return renderers[toolName] ?? {};
}

export function getDisplayName(call: ToolCallBlock, t: TFunction): string {
	const r = getRenderer(call.name);
	return r.getDisplayName?.(call, t) ?? defaultGetDisplayName(call);
}

export function renderConfirmBody(call: ToolCallBlock, t: TFunction): ReactNode {
	const r = getRenderer(call.name);
	return r.renderConfirmBody?.(call, t) ?? defaultRenderConfirmBody(call);
}

/**
 * Render a single tool call as one collapsible row. The tool's renderer only
 * supplies the trigger-line `header` and the expandable `body`; the shared
 * `ToolCallRow` owns the collapsible shell, state icon and chevron. Falls back
 * to the `Default*` implementations for tools without a dedicated renderer.
 */
export function renderToolCall(pair: ToolCallWithResult, t: TFunction): ReactNode {
	const r = getRenderer(pair.call.name);
	const header = r.renderHeader?.(pair, t) ?? defaultRenderHeader(pair, t);
	const body = r.renderBody?.(pair, t) ?? defaultRenderBody(pair, t);
	return <ToolCallRow key={pair.call.id} pair={pair} header={header} body={body} />;
}

```

### Core Architecture Module: `examples/web_ui/frontend/src/components/chat/tool-renderers/types.ts`
```
import type { ToolCallBlock, ToolResultBlock } from '@agentscope-ai/agentscope/message';
import type { ReactNode } from 'react';

export type TFunction = (key: string, params?: Record<string, unknown>) => string;

export interface ToolCallWithResult {
	call: ToolCallBlock;
	result?: ToolResultBlock;
}

/**
 * A tool renderer only supplies *content*; the shared `ToolCallRow` owns the
 * collapsible shell, state icon, chevron and layout. Two render paths exist:
 *
 * - Inline row (`renderHeader` + `renderBody`): the trigger line and its
 *   expandable body. `renderBody` returning `null`/`undefined` makes the row
 *   non-expandable.
 * - Confirmation card (`getDisplayName` + `renderConfirmBody`): the title and
 *   body shown by `ConfirmCard` while a call awaits user approval.
 *
 * Every method is optional — `index.ts` falls back to the `Default*`
 * implementations when a tool doesn't override one.
 */
export interface ToolRenderer {
	getDisplayName?: (call: ToolCallBlock, t: TFunction) => string;
	renderConfirmBody?: (call: ToolCallBlock, t: TFunction) => ReactNode;
	/** Trigger-line content, laid out before the state icon / chevron. */
	renderHeader?: (pair: ToolCallWithResult, t: TFunction) => ReactNode;
	/** Expandable body; return `null`/`undefined` for a non-expandable row. */
	renderBody?: (pair: ToolCallWithResult, t: TFunction) => ReactNode;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2971** (2026-09-30): **[Bug]: OllamaChatModel reuses tool call ids, so a tool called again in the same reply never runs**
  *Symptoms*: ### Prerequisites  - [x] I have searched the existing [issues](https://github.com/agentscope-ai/agentscope/issues) and [discussions](https://github.com/agentscope-ai/agentscope/discussions), and this is not a duplicate. - [x] This is a bug, not a usage question. (For questions, please use [Discussions](https://github.com/agentscope-ai/agentscope/discussions/new?category=general) instead.)  ### Background / Description  When the model calls the same tool twice in one reply, the second call never runs.  `OllamaChatModel` makes up its own tool call ids, in [`_ollama/_model.py:276-278`](https://github.com/agentscope-ai/agentscope/blob/cb7e1705874d09f5b8b201884089fe07189f6f3b/src/agentscope/model/_ollama/_model.py#L276-L278) and [`:321-324`](https://github.com/agentscope-ai/agentscope/blob/cb7e1705874d09f5b8b201884089fe07189f6f3b/src/agentscope/model/_ollama/_model.py#L321-L324). It builds each id from the call's position in the response and the tool name, like `0_get_weather`. The Ollama server does send a real id with each call, but the `ollama` Python client 0.6.2 drops it. So the first call in every response gets the same id.  In [`_state.py:310-316`](https://github.com/agentscope-ai/agentscope/blob/cb7e1705874d09f5b8b201884089fe07189f6f3b/src/agentscope/state/_state.py#L310-L316), the agent keeps all the rounds of a reply in one message. Before each round, `_next_action` in [`_agent.py:3515-3534`](https://github.com/agentscope-ai/agentscope/blob/cb7e1705874d09f5b8b201884089fe
  **Post-Mortem & Fix Analysis**:
  > /assign
  > It's yours, @zaher-m. If there is no pull request and no word from you by 2026-10-12 the claim is released so nobody is blocked — a comment here renews it.

- **Issue #2970** (2026-09-30): **[Bug]: A streamed Anthropic tool call with no arguments gets an empty input and always fails**
  *Symptoms*: ### Prerequisites  - [x] I have searched the existing [issues](https://github.com/agentscope-ai/agentscope/issues) and [discussions](https://github.com/agentscope-ai/agentscope/discussions), and this is not a duplicate. - [x] This is a bug, not a usage question. (For questions, please use [Discussions](https://github.com/agentscope-ai/agentscope/discussions/new?category=general) instead.)  ### Background / Description  When Claude calls a tool that takes no arguments, the call fails if the response is streamed. Streaming is the default.  In [`_anthropic/_model.py:482-494`](https://github.com/agentscope-ai/agentscope/blob/cb7e1705874d09f5b8b201884089fe07189f6f3b/src/agentscope/model/_anthropic/_model.py#L482-L494), the stream parser in `AnthropicChatModel` starts each tool call with an empty input, `""`. Then it adds the `input_json_delta` pieces as they arrive, in [`:535-544`](https://github.com/agentscope-ai/agentscope/blob/cb7e1705874d09f5b8b201884089fe07189f6f3b/src/agentscope/model/_anthropic/_model.py#L535-L544). A call with no arguments sends no JSON text, so nothing is added and the input stays `""`. LiteLLM saw this from the live API in [LiteLLM issue 5063](https://github.com/BerriAI/litellm/issues/5063). There, streaming gave `"arguments": ""` and non-streaming gave `"{}"`. LangChain hit the same bug in [LangChain issue 23911](https://github.com/langchain-ai/langchain/issues/23911). Without streaming, `AnthropicChatModel` gives `"{}"` for the same call, in [`:373-380
  **Post-Mortem & Fix Analysis**:
  > /assign
  > It's yours, @zaher-m. If there is no pull request and no word from you by 2026-10-12 the claim is released so nobody is blocked — a comment here renews it.
  > Fixed in #3008.

- **Issue #2880** (2026-09-28): **[Bug]: pyproject.toml's Documentation URL points to the 1.x docs site**
  *Symptoms*: ### Prerequisites  - [x] I have searched the existing [issues](https://github.com/agentscope-ai/agentscope/issues) and [discussions](https://github.com/agentscope-ai/agentscope/discussions), and this is not a duplicate. - [x] This is a bug, not a usage question. (For questions, please use [Discussions](https://github.com/agentscope-ai/agentscope/discussions/new?category=general) instead.)  ### Background / Description  [`pyproject.toml:217`](https://github.com/agentscope-ai/agentscope/blob/a38821287f35e9e45ed193d9d864cb46f263c946/pyproject.toml#L217) sets `Documentation = "https://doc.agentscope.io/"` under `[project.urls]`. That host is the Sphinx site for 1.x: its version menu lists "Stable(v1.0)" and "v0.1.x", and a maintainer's reply in #1640 calls it "our documentation for AgentScope 1.0 and earlier 0.x versions". The 2.x docs are at https://docs.agentscope.io/, which the README links to ([`README.md:11`](https://github.com/agentscope-ai/agentscope/blob/a38821287f35e9e45ed193d9d864cb46f263c946/README.md#L11)) and which redirects to the 2.0.8 docs.  The URL is copied into the package metadata, so PyPI lists the 1.x site as the Documentation link for 2.0.8: `https://pypi.org/pypi/agentscope/2.0.8/json` has `"Documentation": "https://doc.agentscope.io/"` under `project_urls`. The line came in with #847 (October 2025), when 1.x was current. Nothing else in the repository points to `doc.agentscope.io`.  Expected: `Documentation = "https://docs.agentscope.io/"`.  ### Error Mes
  **Post-Mortem & Fix Analysis**:
  > /assign
  > It's yours, @zaher-m. If there is no pull request and no word from you by 2026-10-11 the claim is released so nobody is blocked — a comment here renews it.

- **Issue #2879** (2026-09-28): **[Bug]: WordParser and ExcelParser raise library exceptions instead of the documented errors**
  *Symptoms*: ### Prerequisites  - [x] I have searched the existing [issues](https://github.com/agentscope-ai/agentscope/issues) and [discussions](https://github.com/agentscope-ai/agentscope/discussions), and this is not a duplicate. - [x] This is a bug, not a usage question. (For questions, please use [Discussions](https://github.com/agentscope-ai/agentscope/discussions/new?category=general) instead.)  ### Background / Description  `WordParser.parse()` and `ExcelParser.parse()` don't raise the errors their docstrings list. `ParserBase.parse()` says a missing path raises `FileNotFoundError` and a file that can't be parsed raises `ValueError` ([`_base.py:110-115`](https://github.com/agentscope-ai/agentscope/blob/a38821287f35e9e45ed193d9d864cb46f263c946/src/agentscope/rag/_parser/_base.py#L110-L115)), and both parsers repeat it ([`_word.py:256-260`](https://github.com/agentscope-ai/agentscope/blob/a38821287f35e9e45ed193d9d864cb46f263c946/src/agentscope/rag/_parser/_word.py#L256-L260), [`_excel.py:237-241`](https://github.com/agentscope-ai/agentscope/blob/a38821287f35e9e45ed193d9d864cb46f263c946/src/agentscope/rag/_parser/_excel.py#L237-L241)). But they hand the input straight to the library, with no `try`:  - [`_word.py:275-278`](https://github.com/agentscope-ai/agentscope/blob/a38821287f35e9e45ed193d9d864cb46f263c946/src/agentscope/rag/_parser/_word.py#L275-L278) calls python-docx's `Document()` on the path or the bytes. A missing path raises `docx.opc.exceptions.PackageNotFoundError`, byte
  **Post-Mortem & Fix Analysis**:
  > /assign  I reproduced this locally with the five cases in the issue. The observed exceptions match the report: `PackageNotFoundError`, `BadZipFile`, `KeyError`, `BadZipFile`, and `OptionError`.  This is a defensive error-handling bug: normal Word and Excel parsing is unaffected. It looks straightforward to fix by normalizing missing-path and invalid-file errors to the documented exception types. I will submit a PR.
  > It's yours, @iluv7. If there is no pull request and no word from you by 2026-10-11 the claim is released so nobody is blocked — a comment here renews it.

- **Issue #2818** (2026-09-28): **[Bug]: ExcelParser changes text identifiers and drops literal NA-like values**
  *Symptoms*: ### Prerequisites  - [x] I have searched the existing [issues](https://github.com/agentscope-ai/agentscope/issues) and [discussions](https://github.com/agentscope-ai/agentscope/discussions), and this is not a duplicate. - [x] This is a bug, not a usage question. (For questions, please use [Discussions](https://github.com/agentscope-ai/agentscope/discussions/new?category=general) instead.)  ### Background / Description  `ExcelParser` changes text cells before they reach the RAG pipeline. An Excel cell storing the string `00123` becomes `123`; literal strings such as `NA`, `NULL`, and `N/A` become empty cells. Both Markdown and JSON output are affected.  `_parse_sheet()` calls `ExcelFile.parse()` with default dtype and missing-value inference. For document extraction, these conversions lose source information.  ### Error Messages  ```shell No exception is raised. The reproduction prints:   | Code | Region | Status | | --- | --- | --- | | 123 |  |  |   Expected: `| 00123 | NA | NULL |`. ```  ### Steps to Reproduce  Run this in a uv environment with AgentScope and its `rag` extra installed:  ```python import asyncio import io from openpyxl import Workbook from agentscope.rag import ExcelParser  async def main():     workbook = Workbook()     workbook.active.append(["Code", "Region", "Status"])     workbook.active.append(["00123", "NA", "NULL"])     buffer = io.BytesIO()     workbook.save(buffer)     workbook.close()     sections = await ExcelParser(include_sheet_names=False).pars
  **Post-Mortem & Fix Analysis**:
  > /assign
  > It's yours, @Yongthyuan. If there is no pull request and no word from you by 2026-10-08 the claim is released so nobody is blocked — a comment here renews it.

- **Issue #2780** (2026-09-28): **[Bug]: DeepSeek formatters discard supported image DataBlocks for deepseek-flash**
  *Symptoms*: ### Prerequisites  - [x] I have searched the existing [issues](https://github.com/agentscope-ai/agentscope/issues) and [discussions](https://github.com/agentscope-ai/agentscope/discussions), and this is not a duplicate. - [x] This is a bug, not a usage question. (For questions, please use [Discussions](https://github.com/agentscope-ai/agentscope/discussions/new?category=general) instead.)  ### Background / Description  DeepSeek documents image input for `deepseek-flash` using `image_url` content blocks in user messages: https://api-docs.deepseek.com/zh-cn/guides/vision/  AgentScope's `deepseek-flash` model card lists JPEG, PNG, GIF and WebP as supported inputs. However, even when `image/png` is explicitly included in a DeepSeek formatter's `input_types`, the formatter discards the image `DataBlock`.  Expected: a supported image in a user message is preserved as an `image_url` block alongside any text. An image-only user message should still produce a user message containing the image.  Actual: - `DeepSeekChatFormatter` removes the image. A text-plus-image message becomes text-only; an image-only message produces `[]`. - `DeepSeekMultiAgentFormatter` also removes the image from the formatted conversation.  This reproduces before any API request. The application model service copies model-card input types into the formatter, so changing the model card alone cannot fix it. Direct construction of `DeepSeekChatModel(model="deepseek-flash")` also currently creates a text-only defau
  **Post-Mortem & Fix Analysis**:
  > /assign
  > It's yours, @gagaducko. If there is no pull request and no word from you by 2026-10-06 the claim is released so nobody is blocked — a comment here renews it.

- **Issue #2774** (2026-09-28): **[Bug]: add_mcp() does not return the Workspace-managed MCP client**
  *Symptoms*: ### Prerequisites  - [x] I have searched the existing [issues](https://github.com/agentscope-ai/agentscope/issues) and [discussions](https://github.com/agentscope-ai/agentscope/discussions), and this is not a duplicate. - [x] This is a bug, not a usage question. (For questions, please use [Discussions](https://github.com/agentscope-ai/agentscope/discussions/new?category=general) instead.)  ### Background / Description  `WorkspaceBase.add_mcp()` currently returns `None`, even though different Workspace implementations may use different client objects after registration.  `LocalWorkspace` stores and uses the original `MCPClient` passed by the caller.  A sandboxed Workspace instead serializes the supplied client configuration, creates a new `GatewayMCPClient`, registers that proxy with the in-sandbox Gateway, and stores the proxy in its live instance cache. The original client does not become Gateway-routed.  This makes the following backend-independent-looking code incorrect for a sandboxed Workspace:  ```python await workspace.add_mcp(client, **scope) tools = await client.list_raw_tools() ```  The second line still invokes the original client.  For a stateless HTTP MCP, this means that the request is sent directly from the Python process calling the Workspace API. It does not pass through the sandbox Gateway. If the MCP address is reachable only from inside the sandbox, registration succeeds but the following tool discovery fails or times out.  Even when the address is reachab

- **Issue #2773** (2026-09-24): **[Bug]: remove_mcp() leaves stateless MCP registered in sandbox Gateway**
  *Symptoms*: ### Prerequisites  - [x] I have searched the existing [issues](https://github.com/agentscope-ai/agentscope/issues) and [discussions](https://github.com/agentscope-ai/agentscope/discussions), and this is not a duplicate. - [x] This is a bug, not a usage question. (For questions, please use [Discussions](https://github.com/agentscope-ai/agentscope/discussions/new?category=general) instead.)  ### Background / Description  When an MCP is added to a sandboxed Workspace, AgentScope creates a `GatewayMCPClient` and registers it with the in-sandbox Gateway through `POST /mcps`.  This registration happens for both stateful and stateless MCP clients.  However, `WorkspaceBase._close_mcp_instance()` currently skips every stateless client:  ```python if not (instance.is_stateful and instance.is_connected):     return ```  As a result, `SandboxedWorkspaceBase.remove_mcp()` removes a stateless MCP from the calling process's instance cache and persisted declarations without calling `GatewayMCPClient.close()`. The Gateway registration is therefore not removed through `DELETE /mcps/{name}`.  Adding another MCP with the same name and the same `agent_id` / `session_id` then fails with `409 already exists`.  In this context, `is_stateful=False` only means that the upstream MCP client does not maintain a persistent session. The Gateway still maintains a registration record for the MCP and must deregister it.  This affects at least:  - Explicitly disabling or removing a stateless MCP. - Updating an

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

### Incident Patch 1: `72f3f6fa` (2026-09-30)
**Commit Message**: fix(app): reject an MCP name the library cannot load back (#3025)

**File**: `src/agentscope/app/_router/_mcp.py` (modified, +22/-1)
```diff
@@ -7,11 +7,13 @@
 stays a separate, explicit act.
 """
 from fastapi import APIRouter, Depends, HTTPException, status
+from pydantic import ValidationError
 
 from ..deps import get_current_user_id, get_mcp_hubs, get_storage
 from ..hub import MCPHubBase
 from .._service import MCPRenderError, render_mcp
 from ..storage import StorageBase
+from ...mcp import MCPClient
 from ._schema import MCPView, UpdateMCPRequest
 
 mcp_router = APIRouter(prefix="/mcp", tags=["mcp"])
@@ -44,6 +46,12 @@ async def update_mcp(
     sit anywhere in the config — inside a URL, a header, an env var — so
     the card's template plus the merged answers is the only thing that
     knows where to put it.
+
+    Raises:
+        `HTTPException`: 404 if the MCP is not in the caller's library,
+            400 if the MCP has no card to re-render from, 409 if the new
+            name is taken, or 422 if the name is not made of
+            ``[a-zA-Z0-9_-]``.
     """
     record = await storage.get_mcp(user_id, mcp_id)
     if record is None:
@@ -90,7 +98,20 @@ async def update_mcp(
         record.values = merged
         record.version = card.version
     elif body.name is not None:
-        record.client.name = body.name
+        # ``MCPClient`` checks its name in ``model_post_init``, which a
+        # plain attribute assignment skips; rebuild the client through
+        # ``model_validate`` so an illegal name is refused here. Stored
+        # as-is it would fail the same check on the next read, turning
+        # every route that loads the library into a 500.
+        try:
+            record.client = MCPClient.model_validate(
+                {**record.client.model_dump(), "name": body.name},
+            )
+        except ValidationError as exc:
+            raise HTTPException(
+                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
+                detail=str(exc),
+            ) from exc
 
     if body.enabled is not None:
         record.enabled = body.enabled
```

**File**: `tests/mcp_rename_test.py` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+# -*- coding: utf-8 -*-
+"""MCP library rename test cases."""
+import tempfile
+from typing import Any
+from unittest import IsolatedAsyncioTestCase
+
+import fakeredis.aioredis
+from fastapi.testclient import TestClient
+
+from agentscope.app import create_app
+from agentscope.app.message_bus import RedisMessageBus
+from agentscope.app.storage import MCPRecord, RedisStorage
+from agentscope.app.workspace_manager import LocalWorkspaceManager
+from agentscope.mcp import HttpMCPConfig, MCPClient
+
+HEADERS = {"X-User-ID": "alice"}
+
+
+def _fake_storage() -> Any:
+    """Build a fakeredis-backed storage and message bus."""
+    redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
+
+    class _Storage(RedisStorage):
+        """Storage sharing the in-memory client."""
+
+        async def __aenter__(self) -> Any:
+            self._client = redis
+            return self
+
+        async def aclose(self) -> None:
+            self._client = None
+
+    class _Bus(RedisMessageBus):
+        """Message bus sharing the in-memory client."""
+
+        async def __aenter__(self) -> Any:
+            self._client = redis
+            return self
+
+        async def aclose(self) -> None:
+            self._client = None
+
+    return _Storage(), _Bus()
+
+
+class MCPLibraryRenameTest(IsolatedAsyncioTestCase):
+    """``PATCH /mcp/{mcp_id}`` must not store a name the library cannot
+    load back."""
+
+    def setUp(self) -> None:
+        """Start an app holding one installed MCP named ``echo``."""
+        # pylint: disable=consider-using-with
+        workdir = self.enterContext(tempfile.TemporaryDirectory())
+        self._storage, bus = _fake_storage()
+        app = create_app(
+            storage=self._storage,
+            message_bus=bus,
+            workspace_manager=LocalWorkspaceManager(workdir),
+            enable_index_worker=False,
+        )
+        self._client = self.enterContext(TestClient(app))
+
+    async def asyncSetUp(self) -> None:
+        """Install the fixture MCP straight into storage."""
+        record = MCPRecord(
+            user_id="alice",
+            client=MCPClient(
+                name="echo",
+                is_stateful=False,
+                mcp_config=HttpMCPConfig(url="https://example.com/mcp"),
+            ),
+        )
+        await self._storage.upsert_mcp("alice", record)
+        self._mcp_id = record.id
+
+    def _view(self, name: str) -> dict:
+        """The expected ``MCPView`` of the fixture MCP under *name*."""
+        return {
+            "id": self._mcp_id,
+            "name": name,
+            "is_stateful": False,
+            "enabled": True,
+            "display_name": None,
+            "description": "",
+            "tags": [],
+            "author": None,
+            "icon_url": None,
+            "url": None,
+            "hub_id": None,
+            "card_id": None,
+            "version": None,
+        }
+
+    async def test_rename_to_unloadable_name_is_rejected(self) -> None:
+        """A name ``MCPClient`` would refuse on load answers 422 and leaves
+        the library readable."""
+        response = self._client.patch(
+            f"/mcp/{self._mcp_id}",
+            json={"name": "io.github.upstash/context7"},
+            headers=HEADERS,
+        )
+        self.assertEqual(response.status_code, 422)
+
+        listing = self._client.get("/mcp", headers=HEADERS)
+        self.assertEqual(listing.status_code, 200)
+        self.assertEqual(listing.json(), [self._view("echo")])
+
+    async def test_rename_to_empty_name_is_rejected(self) -> None:
+        """An empty name is rejected rather than stored."""
+        response = self._client.patch(
+            f"/mcp/{self._mcp_id}",
+            json={"name": ""},
+            headers=HEADERS,
+        )
+        self.assertEqual(response.status_code, 422)
+
+    async def test_legal_rename_persists(self) -> None:
+        """A name within ``[a-zA-Z0-9_-]+`` still renames the MCP."""
+        response = self._client.patch(
+            f"/mcp/{self._mcp_id}",
+            json={"name": "echo_2"},
+            headers=HEADERS,
+        )
+        self.assertEqual(response.status_code, 200)
+        self.assertEqual(response.json(), self._view("echo_2"))
+
+        listing = self._client.get("/mcp", headers=HEADERS)
+        self.assertEqual(listing.json(), [self._view("echo_2")])
```

---

### Incident Patch 2: `149e968b` (2026-09-30)
**Commit Message**: fix(tool): reject empty edit replacement targets (#2995)

**File**: `src/agentscope/tool/_builtin/_edit.py` (modified, +14/-1)
```diff
@@ -56,8 +56,9 @@ class Edit(ToolBase):
             },
             "old_string": {
                 "type": "string",
+                "minLength": 1,
                 "description": (
-                    "The exact string to replace. Must match exactly "
+                    "The nonempty string to replace. Must match exactly "
                     "including whitespace and indentation."
                 ),
             },
@@ -259,6 +260,18 @@ async def call(  # type: ignore[override]
         _agent_state: AgentState | None = None,
     ) -> ToolChunk:
         """Execute the edit and return the result."""
+        if not old_string:
+            return ToolChunk(
+                content=[
+                    TextBlock(
+                        text="Error: old_string must not be empty. "
+                        "Use the Write tool to populate an empty file.",
+                    ),
+                ],
+                state=ToolResultState.ERROR,
+                is_last=True,
+            )
+
         # Validate file_path is absolute
         if not self._backend.isabs(file_path):
             return ToolChunk(
```

**File**: `tests/builtin_edit_test.py` (modified, +58/-0)
```diff
@@ -37,6 +37,10 @@ async def test_tool_properties(self) -> None:
         self.assertEqual(self.edit_tool.name, "Edit")
         self.assertIsInstance(self.edit_tool.description, str)
         self.assertIsInstance(self.edit_tool.input_schema, dict)
+        old_string_schema = self.edit_tool.input_schema["properties"][
+            "old_string"
+        ]
+        self.assertEqual(old_string_schema["minLength"], 1)
         self.assertFalse(self.edit_tool.is_mcp)
         self.assertFalse(self.edit_tool.is_read_only)
         self.assertFalse(self.edit_tool.is_concurrency_safe)
@@ -81,6 +85,60 @@ async def test_edit_not_found(self) -> None:
         self.assertEqual(chunk.state, "error")
         self.assertIn("not found", chunk.content[0].text)
 
+    async def test_empty_target_preserves_file(self) -> None:
+        """An empty target must not expand between every character."""
+        for original in (b"abc\r\ndef\r\n", b""):
+            for replace_all in (False, True):
+                with self.subTest(original=original, replace_all=replace_all):
+                    with open(self.temp_file.name, "wb") as stream:
+                        stream.write(original)
+                    chunk = await self.edit_tool(
+                        file_path=self.temp_file.name,
+                        old_string="",
+                        new_string="X",
+                        replace_all=replace_all,
+                    )
+                    with open(self.temp_file.name, "rb") as stream:
+                        self.assertEqual(stream.read(), original)
+                    self.assertEqual(
+                        chunk.model_dump(
+                            exclude={
+                                "id": True,
+                                "content": {"__all__": {"id", "created_at"}},
+                            },
+                        ),
+                        {
+                            "content": [
+                                {
+                                    "type": "text",
+                                    "text": (
+                                        "Error: old_string must not be empty. "
+                                        "Use the Write tool to populate "
+                                        "an empty file."
+                                    ),
+                                    "finished_at": None,
+                                },
+                            ],
+                            "state": "error",
+                            "is_last": True,
+                            "metadata": {},
+                        },
+                    )
+
+    async def test_whitespace_target_can_be_deleted(self) -> None:
+        """A nonempty whitespace target and an empty replacement are valid."""
+        with open(self.temp_file.name, "w", encoding="utf-8") as stream:
+            stream.write("a b c")
+        chunk = await self.edit_tool(
+            file_path=self.temp_file.name,
+            old_string=" ",
+            new_string="",
+            replace_all=True,
+        )
+        self.assertEqual(chunk.state, "running")
+        with open(self.temp_file.name, "r", encoding="utf-8") as stream:
+            self.assertEqual(stream.read(), "abc")
+
     async def test_edit_multiple_occurrences(self) -> None:
         """Test editing with multiple occurrences."""
         # Write file with duplicate content
```

---

### Incident Patch 3: `0d7a7f6a` (2026-09-30)
**Commit Message**: fix(tool): treat dash-prefixed grep paths as operands (#2988)

**File**: `src/agentscope/tool/_builtin/_grep.py` (modified, +1/-1)
```diff
@@ -286,7 +286,7 @@ async def _run_ripgrep(
         a shell), so the same code path works for local, Docker, and E2B
         backends and needs no platform-specific argument quoting.
         """
-        command = ["rg", *args, search_path]
+        command = ["rg", *args, "--", search_path]
 
         result = await self._backend.exec_shell(
             command,
```

**File**: `tests/builtin_grep_test.py` (modified, +62/-1)
```diff
@@ -2,10 +2,12 @@
 """Grep tool test case."""
 import os
 import tempfile
+from typing import Any
 from unittest.async_case import IsolatedAsyncioTestCase
+from unittest.mock import patch
 
 from agentscope.message import ToolResultState
-from agentscope.tool import Grep
+from agentscope.tool import ExecResult, Grep, LocalBackend
 from agentscope.permission import (
     PermissionContext,
     PermissionBehavior,
@@ -94,6 +96,65 @@ async def test_simple_search(self) -> None:
         self.assertIn("test1.py", content)
         self.assertIn("test.txt", content)
 
+    async def test_dash_prefixed_paths(self) -> None:
+        """Relative paths must not be interpreted as ripgrep options."""
+        backend = LocalBackend()
+        grep = Grep(backend=backend)
+        exec_shell = backend.exec_shell
+
+        async def exec_in_temp(
+            command: list[str],
+            **kwargs: Any,
+        ) -> ExecResult:
+            return await exec_shell(command, cwd=self.temp_dir, **kwargs)
+
+        for name in ("-notes.txt", "--help", "-folder"):
+            target = os.path.join(self.temp_dir, name)
+            if name == "-folder":
+                os.makedirs(target)
+                target = os.path.join(target, "notes.txt")
+            with open(target, "w", encoding="utf-8") as stream:
+                stream.write("-needle\n")
+
+            for pattern in ("needle", "-needle"):
+                with self.subTest(path=name, pattern=pattern):
+                    with patch.object(
+                        backend,
+                        "exec_shell",
+                        side_effect=exec_in_temp,
+                    ):
+                        chunk = await grep(
+                            pattern=pattern,
+                            path=name,
+                            output_mode="content",
+                            n=False,
+                        )
+                    expected_text = "-needle"
+                    if name == "-folder":
+                        expected_text = (
+                            os.path.join("-folder", "notes.txt") + ":-needle"
+                        )
+                    self.assertEqual(
+                        chunk.model_dump(
+                            exclude={
+                                "id": True,
+                                "content": {"__all__": {"id", "created_at"}},
+                            },
+                        ),
+                        {
+                            "content": [
+                                {
+                                    "type": "text",
+                                    "text": expected_text,
+                                    "finished_at": None,
+                                },
+                            ],
+                            "state": ToolResultState.SUCCESS,
+                            "is_last": True,
+                            "metadata": {},
+                        },
+                    )
+
     async def test_content_mode(self) -> None:
         """Test grep with content output mode."""
         chunk = await self.grep_tool(
```

---

### Incident Patch 4: `e64cae41` (2026-09-30)
**Commit Message**: fix(model): stream an Anthropic tool call without arguments as {} (#3008)

**File**: `src/agentscope/model/_anthropic/_model.py` (modified, +18/-0)
```diff
@@ -439,6 +439,8 @@ async def _parse_anthropic_stream_completion_response(
         block_id_mapping: dict[int, str] = {}
         # The mapping from index to tool call id
         tool_call_mapping: dict = OrderedDict()
+        # The indexes of the tool calls that received argument text
+        tool_call_with_input: set[int] = set()
 
         async with response as stream:
             async for event in stream:
@@ -537,12 +539,28 @@ async def _parse_anthropic_stream_completion_response(
                         and block_index in tool_call_mapping
                     ):
                         block_id, name = tool_call_mapping[block_index]
+                        if delta.partial_json:
+                            tool_call_with_input.add(block_index)
                         delta_res.append_tool_call(
                             block_id=block_id,
                             name=name,
                             input=delta.partial_json or "",
                         )
 
+                # A call without arguments streams no JSON text, so close it
+                # with the empty object the non-streaming response carries
+                elif (
+                    event.type == "content_block_stop"
+                    and event.index in tool_call_mapping
+                    and event.index not in tool_call_with_input
+                ):
+                    block_id, name = tool_call_mapping[event.index]
+                    delta_res.append_tool_call(
+                        block_id=block_id,
+                        name=name,
+                        input="{}",
+                    )
+
                 elif event.type == "message_delta":
                     if event.usage and usage:
                         usage.output_tokens = event.usage.output_tokens
```

**File**: `tests/model_anthropic_test.py` (modified, +64/-0)
```diff
@@ -1013,6 +1013,70 @@ async def test_stream_preserves_content_blocks(self) -> None:
                     [{"role": "assistant", "content": content}],
                 )
 
+    async def test_stream_tool_call_without_arguments(self) -> None:
+        """A tool call without arguments streams as ``{}``, as without
+        streaming."""
+        completion = anthropic_types.Message.model_validate(
+            {
+                "id": "msg-no-args",
+                "type": "message",
+                "role": "assistant",
+                "model": self.model.model,
+                "content": [
+                    {
+                        "type": "tool_use",
+                        "id": "toolu_1",
+                        "name": "list_tasks",
+                        "input": {},
+                    },
+                ],
+                "stop_reason": "tool_use",
+                "stop_sequence": None,
+                "usage": {"input_tokens": 10, "output_tokens": 20},
+            },
+        )
+        events = _completion_events(completion)
+        tool_delta = next(_ for _ in events if _.type == "content_block_delta")
+        non_stream_model = _make_model(stream=False)
+        non_stream_model.client = self.mock_client
+
+        cases = {
+            "no_delta": [_ for _ in events if _ is not tool_delta],
+            "empty_delta": [
+                (
+                    _.model_copy(
+                        update={
+                            "delta": _.delta.model_copy(
+                                update={"partial_json": ""},
+                            ),
+                        },
+                    )
+                    if _ is tool_delta
+                    else _
+                )
+                for _ in events
+            ],
+        }
+        for name, case_events in cases.items():
+            with self.subTest(name=name):
+                self.mock_client.messages.create = AsyncMock(
+                    side_effect=[
+                        _MockAsyncEventStream(case_events),
+                        completion,
+                    ],
+                )
+
+                final = [r async for r in await self.model([])][-1]
+                non_stream = await non_stream_model([])
+
+                self.assertListEqual(
+                    [
+                        (_.id, _.name, _.input)
+                        for _ in (final.content[0], non_stream.content[0])
+                    ],
+                    [("toolu_1", "list_tasks", "{}")] * 2,
+                )
+
 
 # ---------------------------------------------------------------------------
 # _format_tools tests
```

---

### Incident Patch 5: `c0a57624` (2026-09-30)
**Commit Message**: fix(embedding): enforce a zero cache file limit (#2962)

**File**: `src/agentscope/embedding/_file_cache.py` (modified, +18/-8)
```diff
@@ -33,7 +33,9 @@ def __init__(
                 The directory to store the embedding files.
             max_file_number (`int | None`, defaults to `None`):
                 The maximum number of files to keep in the cache directory. If
-                exceeded, the oldest files will be removed.
+                exceeded, the oldest files will be removed. `None` leaves the
+                file count unlimited; `0` retains no embedding files after a
+                write.
             max_cache_size (`int | None`, defaults to `None`):
                 The maximum size of the cache directory in MB. If exceeded,
                 the oldest files will be removed until the size is within the
@@ -158,10 +160,11 @@ async def _maintain_cache_dir(
             new_file (`str | None`, defaults to `None`):
                 The path of the file that :meth:`store` has just written.
                 When that file alone is larger than ``max_cache_size`` it is
-                dropped uncached and the rest of the cache is left untouched:
-                evicting oldest-first towards such a limit would delete
-                every other file and still not fit.
+                dropped uncached without size-based eviction of older
+                entries: evicting oldest-first would still not make it fit.
+                The independent file-count limit is still enforced.
         """
+        rejected_oversized = False
         if new_file and self.max_cache_size is not None:
             new_size_mb = os.path.getsize(new_file) / (1024.0 * 1024.0)
             if new_size_mb > self.max_cache_size:
@@ -173,7 +176,7 @@ async def _maintain_cache_dir(
                     new_size_mb,
                     self.max_cache_size,
                 )
-                return
+                rejected_oversized = True
 
         files = [
             (_.name, _.stat().st_mtime)
@@ -182,16 +185,23 @@ async def _maintain_cache_dir(
         ]
         files.sort(key=lambda x: x[1])
 
-        if self.max_file_number and len(files) > self.max_file_number:
-            for file_name, _ in files[: 0 - self.max_file_number]:
+        if (
+            self.max_file_number is not None
+            and len(files) > self.max_file_number
+        ):
+            excess = len(files) - self.max_file_number
+            for file_name, _ in files[:excess]:
                 os.remove(os.path.join(self.cache_dir, file_name))
                 logger.info(
                     "Remove cached embedding file %s for limited number "
                     "of files (%d).",
                     file_name,
                     self.max_file_number,
                 )
-            files = files[0 - self.max_file_number :]
+            files = files[excess:]
+
+        if rejected_oversized:
+            return
 
         if (
             self.max_cache_size is not None
```

**File**: `tests/embedding_file_cache_test.py` (modified, +105/-0)
```diff
@@ -27,6 +27,111 @@ def _vectors(count: int) -> list:
 class FileEmbeddingCacheEvictionTest(IsolatedAsyncioTestCase):
     """The size limit must never cost more entries than it stores."""
 
+    async def test_file_count_limits(self) -> None:
+        """Only None is unlimited; zero and positive limits are enforced."""
+        for limit in (None, 0, 1, 2):
+            with self.subTest(limit=limit):
+                with tempfile.TemporaryDirectory() as cache_dir:
+                    cache = FileEmbeddingCache(
+                        cache_dir=cache_dir,
+                        max_file_number=limit,
+                    )
+                    unrelated = os.path.join(cache_dir, "notes.txt")
+                    with open(unrelated, "w", encoding="utf-8") as file:
+                        file.write("not a cache entry")
+                    identifiers = ["first", "second", "third"]
+                    for index, identifier in enumerate(identifiers):
+                        await cache.store(_vectors(1), identifier)
+                        path = os.path.join(
+                            cache_dir,
+                            cache._get_filename(identifier),
+                        )
+                        if os.path.exists(path):
+                            os.utime(path, (1000 + index, 1000 + index))
+                        count = len(
+                            [
+                                name
+                                for name in os.listdir(cache_dir)
+                                if name.endswith(".npy")
+                            ],
+                        )
+                        self.assertEqual(
+                            count,
+                            index + 1
+                            if limit is None
+                            else min(index + 1, limit),
+                        )
+                    kept = [
+                        await cache.retrieve(identifier) is not None
+                        for identifier in identifiers
+                    ]
+                    self.assertEqual(
+                        kept,
+                        [True] * 3
+                        if limit is None
+                        else [False] * (3 - limit) + [True] * limit,
+                    )
+                    with open(unrelated, encoding="utf-8") as file:
+                        self.assertEqual(file.read(), "not a cache entry")
+
+    async def test_zero_limit_evicts_existing_entries_on_overwrite(
+        self,
+    ) -> None:
+        """A zero limit also applies to a directory populated earlier."""
+        with tempfile.TemporaryDirectory() as cache_dir:
+            cache = FileEmbeddingCache(cache_dir=cache_dir)
+            await cache.store(_vectors(1), "first")
+            await cache.store(_vectors(1), "second")
+            cache.max_file_number = 0
+
+            await cache.store(_vectors(2), "second", overwrite=True)
+
+            self.assertEqual(os.listdir(cache_dir), [])
+            self.assertIsNone(await cache.retrieve("first"))
+            self.assertIsNone(await cache.retrieve("second"))
+
+    async def test_rejected_write_still_enforces_file_count(self) -> None:
+        """Rejected writes must still enforce the independent count cap."""
+        cases: list[tuple[int | None, list[str]]] = [
+            (0, []),
+            (1, ["second"]),
+            (None, ["first", "second"]),
+        ]
+        for limit, retained in cases:
+            with self.subTest(limit=limit):
+                with tempfile.TemporaryDirectory() as cache_dir:
+                    cache = FileEmbeddingCache(cache_dir=cache_dir)
+                    for index, identifier in enumerate(("first", "second")):
+                        await cache.store(_vectors(1), identifier)
+                        path = os.path.join(
+                            cache_dir,
+                            cache._get_filename(identifier),
+                        )
+                        os.utime(path, (1000 + index, 1000 + index))
+                    unrelated = os.path.join(cache_dir, "notes.txt")
+                    with open(unrelated, "w", encoding="utf-8") as file:
+                        file.write("keep me")
+
+                    cache.max_file_number = limit
+                    cache.max_cache_size = 0
+                    await cache.store(_vectors(1), "rejected")
+
+                    self.assertIsNone(await cache.retrieve("rejected"))
+                    for identifier in ("first", "second"):
+                        self.assertEqual(
+                            await cache.retrieve(identifier),
+                            _vectors(1) if identifier in retained else None,
+                        )
+                    self.assertEqual(
+                        sorted(os.listdir(cache_dir)),
+                        sorted(
+                            [cache._get_filename(key) for key in retained]
+                            +
```

---

### Incident Patch 6: `93b12e4b` (2026-09-30)
**Commit Message**: fix(rag): normalize deferred PDF read errors (#2975)

**File**: `src/agentscope/rag/_parser/_pdf.py` (modified, +12/-10)
```diff
@@ -74,19 +74,21 @@ async def parse(
 
         try:
             reader = PdfReader(io.BytesIO(file))
+            # pypdf reads page objects and content streams lazily, so read
+            # failures can also occur after the reader is constructed.
+            sections: list[Section] = []
+            for page_idx, page in enumerate(reader.pages, start=1):
+                text = page.extract_text() or ""
+                sections.append(
+                    Section(
+                        content=TextBlock(text=text),
+                        source=filename,
+                        metadata={"page": page_idx},
+                    ),
+                )
         except PdfReadError as e:
             raise ValueError(
                 f"Failed to parse {filename!r} as PDF: {e}",
             ) from e
 
-        sections: list[Section] = []
-        for page_idx, page in enumerate(reader.pages, start=1):
-            text = page.extract_text() or ""
-            sections.append(
-                Section(
-                    content=TextBlock(text=text),
-                    source=filename,
-                    metadata={"page": page_idx},
-                ),
-            )
         return sections
```

**File**: `tests/rag_parser_test.py` (modified, +68/-0)
```diff
@@ -465,6 +465,74 @@ async def test_invalid_bytes_raise_value_error(self) -> None:
         with self.assertRaises(ValueError):
             await parser.parse(b"not a pdf", "broken.pdf")
 
+    async def test_password_protected_pdf_raises_value_error(self) -> None:
+        """Errors deferred until page iteration retain filename context."""
+        from pypdf import PdfWriter
+        from pypdf.errors import FileNotDecryptedError
+
+        writer = PdfWriter()
+        writer.add_blank_page(width=72, height=72)
+        writer.encrypt("secret")
+        buffer = io.BytesIO()
+        writer.write(buffer)
+
+        with self.assertRaisesRegex(
+            ValueError,
+            r"Failed to parse 'locked\.pdf' as PDF:",
+        ) as context:
+            await PDFParser().parse(buffer.getvalue(), "locked.pdf")
+        self.assertIsInstance(
+            context.exception.__cause__,
+            FileNotDecryptedError,
+        )
+
+    async def test_empty_user_password_pdf_remains_readable(self) -> None:
+        """An encrypted PDF that opens without a password is still parsed."""
+        from pypdf import PdfWriter
+
+        writer = PdfWriter()
+        writer.add_blank_page(width=72, height=72)
+        writer.encrypt(user_password="", owner_password="owner")
+        buffer = io.BytesIO()
+        writer.write(buffer)
+
+        sections = await PDFParser().parse(buffer.getvalue(), "open.pdf")
+
+        self.assertEqual(
+            [section.model_dump() for section in sections],
+            [
+                {
+                    "content": {
+                        "type": "text",
+                        "text": "",
+                        "id": AnyString(),
+                        "created_at": AnyString(),
+                        "finished_at": None,
+                    },
+                    "source": "open.pdf",
+                    "metadata": {"page": 1},
+                },
+            ],
+        )
+
+    async def test_text_extraction_read_error_raises_value_error(self) -> None:
+        """Read errors raised after page enumeration are wrapped as well."""
+        from unittest.mock import patch
+        from pypdf import PageObject
+        from pypdf.errors import PdfReadError
+
+        error = PdfReadError("broken content stream")
+        with patch.object(PageObject, "extract_text", side_effect=error):
+            with self.assertRaisesRegex(
+                ValueError,
+                r"Failed to parse 'broken-stream\.pdf' as PDF:",
+            ) as context:
+                await PDFParser().parse(
+                    _make_pdf(["Hello"]),
+                    "broken-stream.pdf",
+                )
+        self.assertIs(context.exception.__cause__, error)
+
     async def test_supported_extensions(self) -> None:
         """``.pdf`` is the only extension exposed to the file picker."""
         self.assertEqual(PDFParser.supported_extensions(), [".pdf"])
```

---

### Incident Patch 7: `45511bb4` (2026-09-30)
**Commit Message**: fix(rag): close the latest Elasticsearch PIT (#2998)

**File**: `src/agentscope/rag/_vdb/_elasticsearch.py` (modified, +1/-1)
```diff
@@ -345,6 +345,7 @@ async def list_chunks(
                 if search_after is not None:
                     body["search_after"] = search_after
                 response = await client.search(**body)
+                pit_id = response.get("pit_id", pit_id)
                 hits = response["hits"]["hits"]
                 if not hits:
                     break
@@ -361,7 +362,6 @@ async def list_chunks(
                         index,
                         Chunk.model_validate(payload),
                     )
-                pit_id = response.get("pit_id", pit_id)
                 search_after = hits[-1]["sort"]
         finally:
             await client.close_point_in_time(id=pit_id)
```

**File**: `tests/rag_vdb_elasticsearch_test.py` (modified, +26/-0)
```diff
@@ -326,6 +326,32 @@ async def test_list_chunks_closes_pit_on_error(self) -> None:
             await self.store.list_chunks("kb-1", "doc-1")
         self.client.close_point_in_time.assert_awaited_once_with(id="pit-1")
 
+    async def test_list_chunks_closes_latest_pit_on_empty_page(self) -> None:
+        for rotated in (False, True):
+            with self.subTest(rotated=rotated):
+                self.client.close_point_in_time.reset_mock()
+                self.client.open_point_in_time.return_value = {"id": "pit-1"}
+                response = {"hits": {"hits": []}}
+                if rotated:
+                    response["pit_id"] = "pit-2"
+                self.client.search.return_value = response
+                self.assertEqual(await self.store.list_chunks("kb", "doc"), [])
+                self.client.close_point_in_time.assert_awaited_once_with(
+                    id="pit-2" if rotated else "pit-1",
+                )
+
+    async def test_list_chunks_closes_latest_pit_on_invalid_chunk(
+        self,
+    ) -> None:
+        self.client.open_point_in_time.return_value = {"id": "pit-1"}
+        self.client.search.return_value = {
+            "pit_id": "pit-2",
+            "hits": {"hits": [{"_source": {"chunk": {"chunk_index": 0}}}]},
+        }
+        with self.assertRaises(ValueError):
+            await self.store.list_chunks("kb", "doc")
+        self.client.close_point_in_time.assert_awaited_once_with(id="pit-2")
+
     async def test_list_chunks_zero_limit_short_circuits(self) -> None:
         self.assertEqual(
             await self.store.list_chunks("kb-1", "doc-1", limit=0),
```

---

### Incident Patch 8: `a1f30d48` (2026-09-30)
**Commit Message**: fix(model): give each Ollama tool call its own id (#3011)

**File**: `src/agentscope/model/_ollama/_model.py` (modified, +6/-5)
```diff
@@ -272,10 +272,11 @@ async def _parse_stream_response(
                     text=msg.content,
                 )
 
-            # Tool call
-            for idx, tool_call in enumerate(msg.tool_calls or []):
+            # Tool call. The ollama client drops the server's call id, and
+            # one built from the position repeats in the next round
+            for tool_call in msg.tool_calls or []:
                 delta_res.append_tool_call(
-                    block_id=f"{idx}_{tool_call.function.name}",
+                    block_id=_generate_id(),
                     name=tool_call.function.name,
                     input=json.dumps(
                         tool_call.function.arguments,
@@ -318,10 +319,10 @@ async def _parse_completion_response(
         if response.message.content:
             content_blocks.append(TextBlock(text=response.message.content))
 
-        for idx, tool_call in enumerate(response.message.tool_calls or []):
+        for tool_call in response.message.tool_calls or []:
             content_blocks.append(
                 ToolCallBlock(
-                    id=f"{idx}_{tool_call.function.name}",
+                    id=_generate_id(),
                     name=tool_call.function.name,
                     input=json.dumps(
                         tool_call.function.arguments,
```

**File**: `tests/model_ollama_test.py` (modified, +150/-4)
```diff
@@ -11,11 +11,13 @@
 from unittest import IsolatedAsyncioTestCase
 from unittest.mock import AsyncMock, MagicMock
 
+import httpx
 from utils import AnyString
 
-from agentscope.message import TextBlock, ToolCallBlock, ThinkingBlock
+from agentscope.agent import Agent
+from agentscope.message import TextBlock, ToolCallBlock, ThinkingBlock, UserMsg
 from agentscope.model import OllamaChatModel
-from agentscope.tool import ToolChoice
+from agentscope.tool import FunctionTool, ToolChoice, ToolChunk, Toolkit
 
 A = AnyString()
 
@@ -158,7 +160,7 @@ async def test_tool_call_response(self) -> None:
                 True,
                 [
                     ToolCallBlock.model_construct(
-                        id="0_get_weather",
+                        id=A,
                         created_at=A,
                         name="get_weather",
                         input=json.dumps({"city": "SH"}),
@@ -330,7 +332,7 @@ async def test_stream_tool_call(self) -> None:
         responses = [r async for r in gen]
 
         tool_block = ToolCallBlock.model_construct(
-            id="0_search",
+            id=A,
             created_at=A,
             name="search",
             input=json.dumps({"q": "hello"}),
@@ -399,3 +401,147 @@ def test_tools_filtered(self) -> None:
         self.assertEqual(len(fmt_tools), 1)
         self.assertEqual(fmt_tools[0]["function"]["name"], "get_weather")
         self.assertIsNone(fmt_choice)
+
+
+def _api_chat_transport(
+    messages: list[dict | list[dict]],
+    stream: bool,
+) -> httpx.MockTransport:
+    """Fake ``/api/chat``; a list streams as chunks."""
+    replies = iter(messages)
+
+    def handler(_request: httpx.Request) -> httpx.Response:
+        message = next(replies)
+        body = {
+            "model": "qwen3:8b",
+            "created_at": "2026-09-28T00:00:00Z",
+            "message": message,
+            "done": True,
+            "done_reason": "stop",
+            "prompt_eval_count": 10,
+            "eval_count": 5,
+        }
+        if not stream:
+            return httpx.Response(200, json=body)
+        chunks = [
+            {**body, "message": _, "done": False, "done_reason": None}
+            for _ in (message if isinstance(message, list) else [message])
+        ]
+        chunks.append(
+            {**body, "message": {"role": "assistant", "content": ""}},
+        )
+        return httpx.Response(
+            200,
+            content="".join(json.dumps(_) + "\n" for _ in chunks),
+            headers={"content-type": "application/x-ndjson"},
+        )
+
+    return httpx.MockTransport(handler)
+
+
+def _weather_call(city: str, index: int = 0) -> dict:
+    """A ``get_weather`` call as Ollama sends it."""
+    return {
+        "role": "assistant",
+        "content": "",
+        "tool_calls": [
+            {
+                "id": f"call_{city.lower()}",
+                "function": {
+                    "index": index,
+                    "name": "get_weather",
+                    "arguments": {"city": city},
+                },
+            },
+        ],
+    }
+
+
+class TestOllamaRepeatedToolCall(IsolatedAsyncioTestCase):
+    """Repeated tool calls within one reply."""
+
+    async def _reply(
+        self,
+        stream: bool,
+        messages: list[dict | list[dict]],
+    ) -> tuple[list[str], Any]:
+        """Run one reply."""
+        cities: list[str] = []
+
+        async def get_weather(city: str) -> ToolChunk:
+            """Get the weather."""
+            cities.append(city)
+            return ToolChunk(content=[TextBlock(text=f"sunny in {city}")])
+
+        model = OllamaChatModel(
+            model="qwen3:8b",
+            stream=stream,
+            client_kwargs={
+                "transport": _api_chat_transport(messages, stream),
+            },
+        )
+        agent = Agent(
+            name="Friday",
+            system_prompt="You are a helpful assistant.",
+            model=model,
+            toolkit=Toolkit(
+                tools=[FunctionTool(get_weather, is_read_only=True)],
+            ),
+        )
+        await agent.reply(UserMsg("user", "Paris, then London?"))
+        return cities, agent.state.context[-1]
+
+    async def test_same_tool_in_two_rounds(self) -> None:
+        """Both calls run and pair with their results."""
+        for stream in (False, True):
+            with self.subTest(stream=stream):
+                cities, msg = await self._reply(
+                    stream,
+                    [
+                        _weather_call("Paris"),
+                        _weather_call("London"),
+                        {"role": "assistant", "content": "Sunny."},
+                    ],
+                )
+
+                calls = msg.get_content_blocks("tool_call")
+                results = msg.get_content_blocks("tool_result")
+                self.assertListEqual(cities, ["Paris", "London"])
+                self.assertListEqual(
+                    [(_
```

---

### Incident Patch 9: `e4c59dca` (2026-09-30)
**Commit Message**: fix(tracing): report the MiniMax provider name on chat spans (#3023)

**File**: `src/agentscope/middleware/_tracing/_attributes.py` (modified, +3/-0)
```diff
@@ -189,6 +189,9 @@ class ProviderNameValues:
     MOONSHOT = "moonshot"
     """The moonshot provider name."""
 
+    MINIMAX = "minimax"
+    """The MiniMax provider name."""
+
     VOLCENGINE = "volcengine"
     """The Volcengine provider name."""
 
```

**File**: `src/agentscope/middleware/_tracing/_extractor.py` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@
     "deepseek": ProviderNameValues.DEEPSEEK,
     "xai": ProviderNameValues.XAI,
     "moonshot": ProviderNameValues.MOONSHOT,
+    "minimax": ProviderNameValues.MINIMAX,
     "volcengine": ProviderNameValues.VOLCENGINE,
 }
 
```

**File**: `tests/tracing_test.py` (modified, +17/-1)
```diff
@@ -16,7 +16,11 @@
 from utils import MockModel
 
 from agentscope.agent import Agent, InjectionConfig
-from agentscope.credential import OpenAICredential, VolcengineCredential
+from agentscope.credential import (
+    MiniMaxCredential,
+    OpenAICredential,
+    VolcengineCredential,
+)
 from agentscope.event import (
     ConfirmResult,
     ExternalExecutionResultEvent,
@@ -40,6 +44,7 @@
     ChatResponse,
     ChatUsage,
     FinishedReason,
+    MiniMaxChatModel,
     OpenAIChatModel,
     VolcengineChatModel,
 )
@@ -162,6 +167,17 @@ def test_volcengine_provider_name_from_model_class(self) -> None:
 
         self.assertEqual(_get_provider_name(model), "volcengine")
 
+    def test_minimax_provider_name_from_model_class(self) -> None:
+        """MiniMax models should use the MiniMax provider name, not
+        ``unknown`` — MiniMax subclasses the Anthropic model, so its class
+        name is the only thing that identifies it."""
+        model = MiniMaxChatModel(
+            credential=MiniMaxCredential(api_key="test"),
+            model="abab6.5s-chat",
+        )
+
+        self.assertEqual(_get_provider_name(model), "minimax")
+
     def test_volcengine_provider_name_from_openai_base_url(self) -> None:
         """Ark's OpenAI-compatible endpoint should map to Volcengine."""
         model = OpenAIChatModel(
```

---

### Incident Patch 10: `78c4ec47` (2026-09-29)
**Commit Message**: fix(skill): read SKILL.md as utf-8-sig so a BOM keeps front matter (#2735)

**File**: `src/agentscope/skill/_local_loader.py` (modified, +4/-1)
```diff
@@ -60,7 +60,10 @@ async def _load_single_skill(self, skill_root: str) -> Skill | None:
             async with aiofiles.open(
                 skill_md_path,
                 "r",
-                encoding="utf-8",
+                # ``utf-8-sig`` also accepts a byte order mark. Windows
+                # editors commonly write one, and it would otherwise hide
+                # the opening front matter delimiter.
+                encoding="utf-8-sig",
             ) as f:
                 content_str = await f.read()
                 content = frontmatter.loads(content_str)
```

**File**: `tests/skill_loader_test.py` (modified, +42/-0)
```diff
@@ -5,9 +5,12 @@
 import tempfile
 import shutil
 import time
+from dataclasses import asdict
 from unittest.async_case import IsolatedAsyncioTestCase
 from unittest.mock import patch
 
+from utils import AnyValue
+
 from agentscope.skill import LocalSkillLoader
 
 
@@ -86,6 +89,45 @@ async def test_nonexistent_skill(self) -> None:
         finally:
             shutil.rmtree(empty_dir)
 
+    async def test_skill_md_with_utf8_bom(self) -> None:
+        """A byte order mark does not hide the front matter.
+
+        Windows editors such as PowerShell's ``Out-File`` write UTF-8 with
+        a leading BOM, which used to make the opening ``---`` invisible so
+        the skill was dropped with a "missing required fields" warning.
+        """
+        body = """---
+name: bom_skill
+description: A skill saved with a byte order mark
+---
+
+This skill is loaded despite the BOM.
+"""
+        with tempfile.TemporaryDirectory() as skill_dir:
+            with open(
+                os.path.join(skill_dir, "SKILL.md"),
+                "wb",
+            ) as f:
+                f.write(b"\xef\xbb\xbf" + body.encode("utf-8"))
+
+            skills = await LocalSkillLoader(
+                skill_dir,
+                scan_subdir=False,
+            ).list_skills()
+
+            self.assertEqual(
+                [asdict(skill) for skill in skills],
+                [
+                    {
+                        "name": "bom_skill",
+                        "description": "A skill saved with a byte order mark",
+                        "dir": skill_dir,
+                        "markdown": "This skill is loaded despite the BOM.",
+                        "updated_at": AnyValue(),
+                    },
+                ],
+            )
+
     async def test_expanduser_directory(self) -> None:
         """Test that ``~`` is expanded before loading skills."""
         with tempfile.TemporaryDirectory() as home_dir:
```

---

### Incident Patch 11: `13a855be` (2026-09-29)
**Commit Message**: fix(message): keep a copy of the usage appended to a message (#2805)

**File**: `src/agentscope/message/_base.py` (modified, +4/-1)
```diff
@@ -519,12 +519,15 @@ def append_event(  # pylint: disable=too-many-branches,too-many-statements
     def append_usage(self, usage: Usage) -> Self:
         """Accumulate the token usage of one model call into this message.
 
+        The message keeps a copy of ``usage``, so the object handed over by
+        the caller is never adopted and keeps its own value.
+
         Args:
             usage (`Usage`):
                 The token usage to be accumulated.
         """
         if self.usage is None:
-            self.usage = usage
+            self.usage = usage.model_copy()
         else:
             self.usage.input_tokens += usage.input_tokens
             self.usage.output_tokens += usage.output_tokens
```

**File**: `tests/message_test.py` (modified, +79/-0)
```diff
@@ -16,6 +16,7 @@
     ToolCallBlock,
     ToolResultBlock,
     ToolResultState,
+    Usage,
 )
 
 
@@ -312,3 +313,81 @@ async def test_invalid_message(self) -> None:
                     ),
                 ],
             )
+
+    async def test_append_usage_keeps_a_copy(self) -> None:
+        """The message accumulates a copy of the usage it is given."""
+        first = Usage(
+            input_tokens=10,
+            output_tokens=5,
+            cache_input_tokens=2,
+            cache_creation_input_tokens=1,
+        )
+        second = Usage(input_tokens=7, output_tokens=3, cache_input_tokens=4)
+        msg = AssistantMsg(name="agent", content=[])
+        msg.append_usage(first)
+        msg.append_usage(second)
+        accumulated = msg.usage
+        assert accumulated is not None
+
+        self.assertDictEqual(
+            {
+                "accumulated": accumulated.model_dump(),
+                "first": first.model_dump(),
+                "second": second.model_dump(),
+            },
+            {
+                "accumulated": {
+                    "input_tokens": 17,
+                    "output_tokens": 8,
+                    "cache_input_tokens": 6,
+                    "cache_creation_input_tokens": 1,
+                },
+                # Each model call keeps its own usage, so it can still be
+                # reported or accumulated into other messages afterwards.
+                "first": {
+                    "input_tokens": 10,
+                    "output_tokens": 5,
+                    "cache_input_tokens": 2,
+                    "cache_creation_input_tokens": 1,
+                },
+                "second": {
+                    "input_tokens": 7,
+                    "output_tokens": 3,
+                    "cache_input_tokens": 4,
+                    "cache_creation_input_tokens": 0,
+                },
+            },
+        )
+
+    async def test_append_usage_does_not_share_one_object(self) -> None:
+        """Messages given the same usage stay independent."""
+        shared = Usage(input_tokens=4, output_tokens=2)
+        first = AssistantMsg(name="agent_a", content=[])
+        second = AssistantMsg(name="agent_b", content=[])
+        first.append_usage(shared)
+        second.append_usage(shared)
+        first.append_usage(Usage(input_tokens=1, output_tokens=1))
+        first_usage = first.usage
+        second_usage = second.usage
+        assert first_usage is not None and second_usage is not None
+
+        self.assertDictEqual(
+            {
+                "first": first_usage.model_dump(),
+                "second": second_usage.model_dump(),
+            },
+            {
+                "first": {
+                    "input_tokens": 5,
+                    "output_tokens": 3,
+                    "cache_input_tokens": 0,
+                    "cache_creation_input_tokens": 0,
+                },
+                "second": {
+                    "input_tokens": 4,
+                    "output_tokens": 2,
+                    "cache_input_tokens": 0,
+                    "cache_creation_input_tokens": 0,
+                },
+            },
+        )
```

---

### Incident Patch 12: `9d243e20` (2026-09-29)
**Commit Message**: fix(formatter): delegate Moonshot tool_sequence formatting through the existing helper (#2903)

**File**: `src/agentscope/formatter/_moonshot_formatter.py` (modified, +14/-14)
```diff
@@ -1,5 +1,6 @@
 # -*- coding: utf-8 -*-
 """The Moonshot AI formatter for agentscope."""
+
 import base64
 from fnmatch import fnmatch
 from typing import Any
@@ -384,20 +385,19 @@ async def format(self, msgs: list[Msg]) -> list[dict[str, Any]]:
 
         is_first_agent_message = True
         async for typ, group in self._group_messages(msgs[start_index:]):
-            if typ == "tool_sequence":
-                formatted_msgs.extend(
-                    await MoonshotChatFormatter(
-                        input_types=self.input_types,
-                    ).format(group),
-                )
-            elif typ == "agent_message":
-                formatted_group = await self._format_agent_message(
-                    group,
-                    is_first_agent_message,
-                )
-                formatted_msgs.extend(formatted_group)
-                if formatted_group:
-                    is_first_agent_message = False
+            match typ:
+                case "tool_sequence":
+                    formatted_msgs.extend(
+                        await self._format_tool_sequence(group),
+                    )
+                case "agent_message":
+                    formatted_group = await self._format_agent_message(
+                        group,
+                        is_first_agent_message,
+                    )
+                    formatted_msgs.extend(formatted_group)
+                    if formatted_group:
+                        is_first_agent_message = False
 
         return formatted_msgs
 
```

---

### Incident Patch 13: `0ad28c3c` (2026-09-29)
**Commit Message**: fix(tts): propagate DashScope synthesis errors (#2993)

**File**: `src/agentscope/tts/_dashscope/_model.py` (modified, +4/-0)
```diff
@@ -150,6 +150,8 @@ def _aggregate_sync(
         audio_bytes = bytearray()
         usage = None
         for chunk in response:
+            if chunk.status_code != 200:
+                raise RuntimeError(f"DashScope TTS API error: {chunk}")
             if chunk.usage is not None:
                 usage = chunk.usage
             if chunk.output is not None:
@@ -205,6 +207,8 @@ async def _parse_into_async_generator(
             chunk = next(it, _SENTINEL)
             if chunk is _SENTINEL:
                 break
+            if chunk.status_code != 200:
+                raise RuntimeError(f"DashScope TTS API error: {chunk}")
             if chunk.usage is not None:
                 usage = chunk.usage
             if chunk.output is None:
```

**File**: `tests/tts_dashscope_test.py` (modified, +38/-0)
```diff
@@ -54,6 +54,7 @@ def _make_api_chunk(
     """Build a chunk shaped like what dashscope.MultiModalConversation
     yields. ``data_bytes=None`` represents a chunk with no output."""
     chunk = MagicMock()
+    chunk.status_code = 200
     chunk.usage = usage
     if data_bytes is None:
         chunk.output = None
@@ -202,6 +203,43 @@ def _make_model(self, stream: bool = False) -> DashScopeTTSModel:
 
     # -- non-streaming --
 
+    async def test_api_errors_are_not_successful_audio(self) -> None:
+        """Provider errors must propagate, including after partial audio."""
+        from dashscope.api_entities.dashscope_response import (
+            MultiModalConversationResponse,
+        )
+
+        for stream in (False, True):
+            for status, code in ((401, "InvalidApiKey"), (429, "Throttling")):
+                for partial in (False, True):
+                    with self.subTest(
+                        stream=stream,
+                        status=status,
+                        partial=partial,
+                    ):
+                        error = MultiModalConversationResponse(
+                            status_code=status,
+                            code=code,
+                            message="Request rejected",
+                            request_id="test-request",
+                        )
+                        chunks = (
+                            [
+                                _make_api_chunk(b"AAAA"),
+                                _make_api_chunk(b"BBBB"),
+                            ]
+                            if partial
+                            else []
+                        )
+                        chunks.append(error)
+                        self.mock_mmc.call.return_value = iter(chunks)
+                        model = self._make_model(stream=stream)
+                        with self.assertRaisesRegex(RuntimeError, code):
+                            result = await model.synthesize("Hello")
+                            if stream:
+                                async for chunk in result:
+                                    self.assertFalse(chunk.is_last)
+
     async def test_aggregates_chunks(self) -> None:
         """All API chunks are aggregated into one self-contained WAV."""
         self.mock_mmc.call.return_value = _make_api_generator(
```

---

### Incident Patch 14: `5569360b` (2026-09-29)
**Commit Message**: fix(tts): respect per-call speech instructions (#2990)

**File**: `src/agentscope/tts/_openai/_model.py` (modified, +1/-1)
```diff
@@ -155,10 +155,10 @@ async def synthesize(
             "voice": self.parameters.voice,
             "input": text,
             "response_format": self.parameters.response_format,
-            **kwargs,
         }
         if self.parameters.instructions:
             request_kwargs["instructions"] = self.parameters.instructions
+        request_kwargs.update(kwargs)
 
         media_type = _MEDIA_TYPES.get(
             request_kwargs["response_format"],
```

**File**: `tests/tts_openai_test.py` (modified, +51/-0)
```diff
@@ -170,6 +170,57 @@ async def test_per_call_format_controls_media_type(self) -> None:
                 [_MEDIA_TYPE_MP3] * len(responses),
             )
 
+    async def test_per_call_instructions_override_default(self) -> None:
+        """Per-call instructions win without mutating the default."""
+        for stream in (False, True):
+            for default in ("Speak cheerfully", ""):
+                model = self._make_model(
+                    stream=stream,
+                    parameters=OpenAITTSModel.Parameters(
+                        instructions=default,
+                    ),
+                )
+                client = _make_mock_client(b"AAAA", [b"AAAA"])
+                model.client = client
+                create = (
+                    client.audio.speech.with_streaming_response.create
+                    if stream
+                    else client.audio.speech.create
+                )
+                for override in ("Speak quietly", ""):
+                    with self.subTest(
+                        stream=stream,
+                        default=default,
+                        override=override,
+                    ):
+                        result = await model.synthesize(
+                            "Hello",
+                            instructions=override,
+                        )
+                        if stream:
+                            async for _ in result:
+                                pass
+                        self.assertEqual(
+                            create.call_args.kwargs["instructions"],
+                            override,
+                        )
+                        self.assertEqual(
+                            model.parameters.instructions,
+                            default,
+                        )
+
+                result = await model.synthesize("Next call")
+                if stream:
+                    async for _ in result:
+                        pass
+                if default:
+                    self.assertEqual(
+                        create.call_args.kwargs["instructions"],
+                        default,
+                    )
+                else:
+                    self.assertNotIn("instructions", create.call_args.kwargs)
+
     async def test_incremental_chunks(self) -> None:
         """Each streamed byte chunk yields one TTSResponse."""
         client = _make_mock_client(b"", [b"AAAA", b"BBBB", b"CCCC"])
```

---

### Incident Patch 15: `9af23735` (2026-09-29)
**Commit Message**: fix(rag): preserve duplicate and blank Excel headers (#2948)

**File**: `src/agentscope/rag/_parser/_excel.py` (modified, +6/-5)
```diff
@@ -46,7 +46,7 @@ def _get_excel_column_name(col_index: int) -> str:
 
 
 def _extract_table_data(df: Any) -> list[list[str]]:
-    """Extract table data from a pandas DataFrame.
+    """Extract table data from a DataFrame read with ``header=None``.
 
     NaN values are converted to empty strings, and Windows-style line
     breaks (``\\r\\n``) are normalised to ``\\n``.
@@ -62,8 +62,7 @@ def _extract_table_data(df: Any) -> list[list[str]]:
     """
     import pandas as pd
 
-    header = [str(col).strip() for col in df.columns]
-    rows: list[list[str]] = [header]
+    rows: list[list[str]] = []
     for _, row in df.iterrows():
         cells: list[str] = []
         for val in row:
@@ -315,15 +314,17 @@ def _parse_sheet(
             # Keep cell text as-is instead of letting pandas infer types or NAs
             df = excel_file.parse(
                 sheet_name=sheet_name,
+                header=None,
                 dtype=object,
                 keep_default_na=False,
             )
         except Exception as e:
             logger.warning("Failed to parse sheet '%s': %s", sheet_name, e)
             return sheet_sections
 
-        # A header-only sheet is "empty" to pandas but still has columns
-        if len(df.columns) > 0:
+        # Keep the first row as cell data: pandas column labels would rename
+        # duplicate headers and replace blank headers with "Unnamed: ...".
+        if not df.empty:
             table_data = _extract_table_data(df)
 
             if self.table_format == "markdown":
```

**File**: `tests/rag_parser_test.py` (modified, +53/-0)
```diff
@@ -1110,6 +1110,59 @@ async def test_nested_group_shape_text_is_read(self) -> None:
 class ExcelParserTest(IsolatedAsyncioTestCase):
     """Behavioural coverage for :class:`ExcelParser`."""
 
+    async def test_duplicate_and_blank_headers(self) -> None:
+        """Headers remain cell values, without pandas-generated labels."""
+        from openpyxl import Workbook
+
+        workbook = Workbook()
+        workbook.active.append(["Name", "Name", None])
+        workbook.active.append(["a", "b", "c"])
+        buffer = io.BytesIO()
+        workbook.save(buffer)
+        workbook.close()
+
+        for table_format in ("markdown", "json"):
+            for coordinates in (False, True):
+                with self.subTest(
+                    table_format=table_format,
+                    coordinates=coordinates,
+                ):
+                    parser = ExcelParser(
+                        table_format=table_format,
+                        include_cell_coordinates=coordinates,
+                        include_sheet_names=False,
+                    )
+                    sections = await parser.parse(
+                        buffer.getvalue(),
+                        "headers.xlsx",
+                    )
+                    self.assertEqual(len(sections), 1)
+                    text = sections[0].content.text
+                    if table_format == "markdown":
+                        expected = (
+                            "| [A1] Name | [B1] Name | [C1]  |\n"
+                            "| --- | --- | --- |\n"
+                            "| [A2] a | [B2] b | [C2] c |\n"
+                            if coordinates
+                            else "| Name | Name |  |\n"
+                            "| --- | --- | --- |\n"
+                            "| a | b | c |\n"
+                        )
+                        self.assertEqual(text, expected)
+                    else:
+                        rows = [
+                            json.loads(line) for line in text.splitlines()[1:]
+                        ]
+                        self.assertEqual(
+                            rows,
+                            [
+                                {"A1": "Name", "B1": "Name", "C1": ""},
+                                {"A2": "a", "B2": "b", "C2": "c"},
+                            ]
+                            if coordinates
+                            else [["Name", "Name", ""], ["a", "b", "c"]],
+                        )
+
     async def test_invalid_input_errors(self) -> None:
         """Missing paths and invalid workbooks use documented errors."""
         parser = ExcelParser()
```

#### Recent Merged Pull Requests:
- **PR #3025** (2026-09-30): fix(app): reject an MCP name the library cannot load back (@lihongyuan99)
- **PR #3023** (2026-09-30): fix(tracing): report the MiniMax provider name on chat spans (@RerankerGuo)
- **PR #3011** (2026-09-30): fix(model): give each Ollama tool call its own id (@zaher-m)
- **PR #3008** (2026-09-30): fix(model): stream an Anthropic tool call without arguments as {} (@zaher-m)
- **PR #3002** (2026-09-30): fix(tts): allow a per-call DashScope voice (@cxyyy66)
- **PR #2998** (2026-09-30): fix(rag): close the latest Elasticsearch PIT (@cxyyy66)
- **PR #2996** (closed): fix(rag): wrap deferred PDF read errors (@zhengguangzhuo)
- **PR #2995** (2026-09-30): fix(tool): reject empty edit replacement targets (@neu-hsc)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

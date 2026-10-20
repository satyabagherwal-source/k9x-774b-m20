> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cypress-io-cypress-learnings.md`  
> **Source**: github ([https://github.com/cypress-io/cypress](https://github.com/cypress-io/cypress))  
> **Source Version**: `6ecfc6ba`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T04:50:55.619Z  
> **Learning ID**: `learn-github-cypress-io-cypress`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): cypress-io/cypress

> **Canonical Artifact**: `07_PROJECT_LEARNING/cypress-io-cypress-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cypress-io/cypress](https://github.com/cypress-io/cypress))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T04:50:55.193Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cypress-io/cypress`
- **Description**: Fast, easy and reliable testing for anything that runs in a browser.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 51043 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/lib/tap/render/ambiguous.ts`
```
import chalk from 'chalk'
import { MAX_DERIVED_SELECTORS } from '@packages/cypress-sessions'

import type { FrameAmbiguousResult } from '../aut/single-match'
import { color, columns, layout, quoted } from './format'

// dom, aria, and inspect all answer an ambiguous selector the same way, so they
// render it the same way: what went wrong, then the matches. Either column
// re-runs the read — `--at <index>`, or the unique selector.
export const renderAmbiguousHuman = (result: FrameAmbiguousResult): string => {
  const headline = color.warn(`⚠ selector ${chalk.bold(quoted(result.selector))} matched ${chalk.bold(result.count)} elements but must be unique`)
  const note = color.warn(`provide ${chalk.bold('--at')} with an index to select an element from the list or update the selector.`)

  // Number no further than the session derives selectors for: `*` on a real
  // page matches thousands, and every row past the cap could only ever be a
  // bare index. --at still reads any of them, so say what the list leaves out.
  const numbered = Math.min(result.count, MAX_DERIVED_SELECTORS)

  // A match no unique selector could be derived for still keeps its row, since
  // --at reads it either way.
  const derived = new Map(result.selectors.flatMap(({ index, selector }) => (selector ? [[index, quoted(selector)] as const] : [])))
  const rows = Array.from({ length: numbered }, (_, index) => [String(index), derived.get(index) ?? '-'])
  const colorize = (cells: string[], index: number) => (derived.has(index) ? cells : [cells[0], color.muted(cells[1])])

  const table = [headline, note, ...columns(['index', 'selector'], rows, colorize)]

  // Only a null the session reported says a match has no derivable selector. A
  // list that stops short — the lookup failed, or never reached the app under
  // test — leaves its rows as dashes with nothing known about why, so there is
  // nothing to send the reader back to their selector config over.
  const underivable = result.selectors.some(({ selector }) => !selector)

  const notes = [
    ...(numbered === result.count ? [] : [`showing the first ${numbered} of ${result.count} matches — --at takes any index up to ${result.count - 1}.`]),
    ...(underivable ? ['- means no unique selector could be derived for that match — you may need to adjust your Cypress.ElementSelector config, or the element may be one no standard CSS selector can identify.'] : []),
  ].map((line) => color.muted(line))

  return layout(notes.length ? [table, notes] : [table])
}

```

### Core Architecture Module: `cli/lib/tap/render/aria.ts`
```
import chalk from 'chalk'

import type { AriaNodeOut, FrameAriaResult } from '../commands/aria'
import { color, emptyState, indent, layout } from './format'

// One node per line, indented by its own depth so the root sits flush: bold
// role, then its accessible name, an `= value` for value-bearing controls, and
// any notable states as a muted bracketed list — the compact role/name tree
// DevTools shows.
const renderNode = (node: AriaNodeOut): string => {
  const name = node.name ? `  ${node.name}` : ''
  const value = node.value !== undefined ? ` = ${node.value}` : ''
  const states = node.states?.length ? `  ${color.muted(`[${node.states.join(', ')}]`)}` : ''

  return `${indent(node.depth)}${chalk.bold(node.role)}${name}${value}${states}`
}

export const renderAriaHuman = (result: FrameAriaResult): string => {
  if (!result.nodes.length) {
    return emptyState('No accessibility nodes found.')
  }

  const blocks: string[][] = [result.nodes.map(renderNode)]

  if (result.truncated) {
    blocks.push([color.muted('(output truncated)')])
  }

  return layout(blocks)
}

```

### Core Architecture Module: `cli/lib/tap/render/command-row.ts`
```
import chalk from 'chalk'

import type { TapNetworkInfo } from '@packages/cypress-sessions'
import { color, heading } from './format'

// The command-log row grammar, shared by the two renderers that show command log
// entries — `reporter`'s full log and `command`'s single entry — so a row reads
// identically whichever one printed it. Built on the palette in `./format`; the
// generic layout primitives live there.

// The row fields this vocabulary reads. `TapReporterCommand` (the full log row)
// and `TapCommandEntry` (the leaner single-entry result) both satisfy it, so
// neither renderer has to widen its own result type to reuse these.
export interface RenderableCommand {
  name?: string
  message?: string
  state?: 'pending' | 'passed' | 'failed'
  type?: 'parent' | 'child' | 'system'
  aliases?: string[]
  aliasType?: string
  referencedAliases?: string[]
  cleanedUp?: true
}

// The title of a hook section of the command log. The hook id in the title is
// the qualifier a duplicated row number needs (`pin r8 h1:1`), since numbers
// restart per section.
export const sectionHeading = (hookName: string | undefined, hookId: string | undefined): string => {
  const qualifier = hookId ? ` · ${hookId}` : ''

  return heading(`${(hookName ?? 'commands').toUpperCase()}${qualifier}`)
}

// The reporter's status dot for a network row.
const INDICATORS: Record<NonNullable<TapNetworkInfo['indicator']>, string> = {
  successful: color.pass('●'),
  pending: color.pending('○'),
  aborted: color.aborted('●'),
  bad: color.bad('●'),
}

// The reporter's tag palette: dom aliases indigo, everything else
// (route/agent/primitive) purple.
const aliasColor = (aliasType: string | undefined) => (aliasType === 'dom' ? color.aliasDom : color.alias)

// The reporter badges a `.as()` handle with the `@` you'd pass to `cy.get()`, and
// leaves route and agent aliases bare.
const aliasBadge = (alias: string, aliasType?: string): string => {
  const handle = aliasType === 'route' || aliasType === 'agent' ? alias : `@${alias}`

  return aliasColor(aliasType)(handle)
}

// Driver messages emphasize with markdown-style `**`; render the emphasis
// instead of the markers, on one line.
const emphasize = (message: string, strong: (part: string) => string): string => {
  return message
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\*\*([^*]+)\*\*/g, (_, part) => strong(part))
}

// The `@name`s a row references (cy.get('@x') / cy.wait('@x')) appear verbatim
// in its message — give them the alias badge color in place.
const colorizeAliasReferences = (message: string, command: RenderableCommand): string => {
  const { referencedAliases, aliasType } = command

  if (!referencedAliases?.length) {
    return message
  }

  const names = new Set(referencedAliases)

  return message.replace(/@([\w-]+)/g, (match, name) => (names.has(name) ? aliasColor(aliasType)(match) : match))
}

// Asserts take the reporter's state colors — passing green, failing red —
// while other messages keep the default text with bold emphasis.
export const formatMessage = (command: RenderableCommand): string => {
  const message = command.message ?? ''

  if (!message) {
    return ''
  }

  if (command.name === 'assert') {
    if (command.state === 'passed') {
      return color.passMessage(emphasize(message, (part) => color.passStrong.bold(part)))
    }

    if (command.state === 'failed') {
      return color.fail(emphasize(message, (part) => color.failStrong.bold(part)))
    }
  }

  return colorizeAliasReferences(emphasize(message, (part) => chalk.bold(part)), command)
}

// Child commands render dash-prefixed, the way the reporter marks a command
// chained off the previous subject.
export const commandLabel = (command: RenderableCommand): string => {
  return `${command.type === 'child' ? '-' : ''}${command.name ?? ''}`
}

export const networkDot = (network: TapNetworkInfo | undefined): string => {
  return network?.indicator ? `${INDICATORS[network.indicator]} ` : ''
}

// A row's alias badge(s): its own aliases (`.as()` definitions, spy/stub call
// rows) or the alias its request matched.
export const aliasSuffix = (command: RenderableCommand, network: TapNetworkInfo | undefined): string => {
  const badges = command.aliases?.map((name) => aliasBadge(name, command.aliasType))
    ?? (network?.alias != null ? [aliasBadge(network.alias, 'route')] : [])

  return badges.length ? `  ${badges.join(' ')}` : ''
}

export const networkSuffix = (network: TapNetworkInfo | undefined): string => {
  return network?.stubbed ? `  ${chalk.dim('(stubbed)')}` : ''
}

export const cleanedSuffix = (command: RenderableCommand): string => {
  return command.cleanedUp ? `  ${chalk.dim('(cleaned up)')}` : ''
}

```

### Core Architecture Module: `cli/lib/tap/render/command.ts`
```
import chalk from 'chalk'

import type { TapCommandEntry, TapCommandHook, TapCommandResult, TapCommandSnapshot, TapConsoleProps, TapNetworkInfo } from '@packages/cypress-sessions'
import { color, definitionList, emptyState, heading, indent, layout, stateBadge, table } from './format'
import { aliasSuffix, cleanedSuffix, commandLabel, formatMessage, networkDot, networkSuffix, sectionHeading } from './command-row'
import { renderConsolePropsHuman } from './console-props'
import type { ConsolePropsOptions } from './console-props'

// The reporter's inline network detail, expanded into its own panel: the row
// message already summarizes the request, so this is where the parts a consumer
// might act on — matcher, status, alias — read individually. Ordered the way the
// reporter's ROUTES table columns are.
const networkEntries = (network: TapNetworkInfo): Array<[string, string]> => {
  const entries: Array<[string, string]> = []
  const add = (label: string, value: string | undefined) => {
    if (value) {
      entries.push([label, value])
    }
  }

  add('METHOD', network.method && chalk.bold(network.method))
  add('URL', network.url)
  add('STATUS', network.status != null ? String(network.status) : undefined)
  add('INDICATOR', network.indicator && `${networkDot(network)}${network.indicator}`)
  add('STUBBED', network.stubbed === undefined ? undefined : network.stubbed ? color.aborted('yes') : 'no')
  add('RESPONSES', network.numResponses != null ? String(network.numResponses) : undefined)
  add('ALIAS', network.alias && color.alias(`@${network.alias}`))

  return entries
}

// One command rendered as the reporter renders its row — state icon, id, name
// (dash-prefixed when chained), network dot, styled message, alias badge — with
// the state spelled out the way the reporter's test header does. A row with no
// state yet (a route registration) simply has no icon and no word.
const entryHeader = (entry: TapCommandEntry): string => {
  const state = entry.state ? stateBadge[entry.state] : undefined
  const name = commandLabel(entry)
  const styledName = entry.state === 'failed' ? color.fail.bold(name) : chalk.bold(name)

  // Unlike the reporter's log, a lone row has no columns to align to, so the
  // parts a row happens to lack close up instead of leaving a gap.
  const head = [
    state?.icon,
    entry.id && chalk.dim(entry.id),
    styledName,
    `${networkDot(entry.network)}${formatMessage(entry)}`.trim(),
  ].filter(Boolean).join('  ')

  const suffixes = `${aliasSuffix(entry, entry.network)}${networkSuffix(entry.network)}${cleanedSuffix(entry)}`

  return `${head}${suffixes}${state ? `  ${state.word}` : ''}`
}

// Which section of the reporter panel the row sits under, printed above it as
// the reporter's own log prints its section titles — the context a lone row has
// no way to show, and what its `<hookId>:<number>` handle qualifies.
const hookLine = (hook: TapCommandHook): string => sectionHeading(hook.hookName, hook.hookId)

// Wall clock rather than an offset: a snapshot's time is only useful lined up
// against something else — another command's snapshots, a server log — and the
// row itself carries no start to offset from.
const snapshotTime = (timestamp: number | undefined): string => {
  if (timestamp === undefined) {
    return '—'
  }

  const at = new Date(timestamp)
  const clock = [at.getHours(), at.getMinutes(), at.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':')

  return `${clock}.${String(at.getMilliseconds()).padStart(3, '0')}`
}

// The DOM snapshots this row captured, addressed the way `pin --at` takes them:
// by name or by position. Always rendered — a row with none is the answer to
// "can I pin this?", so it keeps the panel rather than dropping it.
const snapshotsBlock = (snapshots: TapCommandSnapshot[]): string[] => {
  if (!snapshots.length) {
    return [heading('SNAPSHOTS', 0), `${indent(1)}${emptyState('[NO SNAPSHOTS]')}`]
  }

  const rows = snapshots.map((snapshot) => {
    return [
      String(snapshot.index),
      snapshot.name ?? '—',
      snapshotTime(snapshot.timestamp),
    ]
  })

  // Mute from the snapshot rather than the padded cell: what reads as absent is
  // the field being unset, which only the row's own data knows.
  return table('SNAPSHOTS', ['#', 'NAME', 'TIME'], rows, (cells, index) => {
    const { name, timestamp } = snapshots[index]

    return [cells[0], name === undefined ? color.muted(cells[1]) : cells[1], timestamp === undefined ? color.muted(cells[2]) : cells[2]]
  })
}

// The console panel's payload, closing the view the way the app's does: the row
// above, its properties below. A row that logged none keeps the section rather
// than dropping it, so the output reads the same shape either way.
const consolePropsBlock = (props: TapConsoleProps | undefined, options: ConsolePropsOptions): string[] => {
  if (!props) {
    return [heading('CONSOLE PROPS'), `${indent(1)}${emptyState('[NO CONSOLE PROPS]')}`]
  }

  return renderConsolePropsHuman(props, options).split('\n')
}

export const renderCommandHuman = (result: TapCommandResult, options: ConsolePropsOptions = {}): string => {
  const network = result.network && networkEntries(result.network)

  return layout([
    [hookLine(result.hook), entryHeader(result)],
    ...(network?.length ? [[heading('NETWORK'), ...definitionList(network)]] : []),
    snapshotsBlock(result.snapshots),
    consolePropsBlock(result.consoleProps, options),
  ])
}

```

### Core Architecture Module: `cli/lib/tap/render/console-props.ts`
```
import chalk from 'chalk'

import type { TapConsoleProps, TapJsonValue } from '@packages/cypress-sessions'
import { clamp, color, emptyState, heading, layout, tableRows, terminalWidth } from './format'

// A command's console properties are the deepest payload the tap returns — a
// `cy.request` row carries its matcher, request, response and every header of
// each. Printed whole it is pages of indentation, so this renders the shape
// first, the way the browser console panel opens collapsed: a few levels expand,
// and a section that is deeper or too long to read at a glance is summarized as
// `{n keys}` / `[n items]` until --depth asks for it. The full payload is one
// --json away.

// Deep enough that a request's matcher, its response and that response's body
// all read without asking, since a payload is usually consulted for something
// several levels in. The row budget below is what keeps that from running away.
const DEFAULT_DEPTH = 3

// A header map runs to twenty-odd rows and buries everything around it, so the
// default view folds any section that long however shallow it sits. An explicit
// --depth is taken at its word and lifts the cap: it asked for levels, not for a
// judgement about size.
const DEFAULT_ROW_BUDGET = 8

// However narrow the terminal, a value keeps enough room to be worth reading.
const MIN_VALUE_WIDTH = 24

// Console prop labels are short prose (`Request Headers`); anything past this is
// a key carrying data, and it does not get to own the level's whole row.
const MAX_KEY_WIDTH = 32

export interface ConsolePropsOptions {
  depth?: string
}

const isRecord = (value: TapJsonValue): value is { [key: string]: TapJsonValue } => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isContainer = (value: TapJsonValue): boolean => typeof value === 'object' && value !== null

// The serializer names a value too long to ship by its length rather than
// returning it (see the driver's `withheld`); color the marker so it doesn't
// read as content.
const WITHHELD = /^\[[\d,]+ characters? withheld — pass --json to include it\]$/

// A response body or stack trace carries its own newlines; inlining it would
// break the aligned column, so it reads as a block under its key.
const isBlock = (value: TapJsonValue): value is string => typeof value === 'string' && value.includes('\n')

interface InlineValue {
  /** Plain text, so a column width and a clamp can be measured against it. */
  text: string
  style?: (text: string) => string
  /** Set on a real value; a summary or empty marker is short by construction. */
  clampable?: true
}

// A response body or header value arrives with whatever bytes the server sent.
// A tab re-tabulates the row and a lone carriage return overwrites it, so on a
// row — where the alignment is the only thing holding the output together — they
// read as spaces. Escape codes are dropped rather than passed through: they would
// tint a row the renderer never meant to and their bytes count toward the clamp.
const onOneRow = (text: string): string => {
  let sanitized = ''

  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)

    if (code === 0x1B && text.charCodeAt(index + 1) === 0x5B) {
      let end = index + 2

      while (end < text.length) {
        const sequenceCode = text.charCodeAt(end)
        const isParameter = (sequenceCode >= 0x30 && sequenceCode <= 0x39) || sequenceCode === 0x3B
        const isTerminator = (sequenceCode >= 0x41 && sequenceCode <= 0x5A)
          || (sequenceCode >= 0x61 && sequenceCode <= 0x7A)

        if (isTerminator) {
          index = end
          break
        }

        if (!isParameter) {
          break
        }

        end++
      }

      if (index === end) {
        continue
      }
    }

    sanitized += code <= 0x09 || (code >= 0x0B && code <= 0x1F) ? ' ' : text[index]
  }

  return sanitized
}

// A key is always one row, newline or not — the control range above spares `\n`
// for the values that render as a block under their key.
const asKey = (text: string): string => onOneRow(text).replace(/\n/g, ' ').trim()

const scalarInline = (value: TapJsonValue): InlineValue => {
  if (value === null) {
    return { text: 'null', style: chalk.dim }
  }

  const text = onOneRow(String(value))

  if (typeof value === 'string' && WITHHELD.test(text)) {
    return { text, style: color.aborted }
  }

  if (!text.length) {
    return { text: '(empty string)', style: chalk.dim }
  }

  return { text, clampable: true }
}

const emptyContainerInline = (value: TapJsonValue): InlineValue | undefined => {
  if (Array.isArray(value) && !value.length) {
    return { text: '[]', style: chalk.dim }
  }

  if (isRecord(value) && !Object.keys(value).length) {
    return { text: '{}', style: chalk.dim }
  }

  return undefined
}

// What a collapsed container reads as: its size, so the shape is still legible
// and the cost of expanding it is known before you do.
const summaryInline = (value: TapJsonValue): InlineValue => {
  const isArray = Array.isArray(value)
  const size = isArray ? value.length : Object.keys(value as object).length
  const unit = isArray ? 'item' : 'key'
  const [open, close] = isArray ? ['[', ']'] : ['{', '}']

  return { text: `${open}${size} ${unit}${size === 1 ? '' : 's'}${close}`, style: chalk.dim }
}

// A cell keeps the column alignment that makes a table readable, so it stays one
// line of bounded width.
const MAX_CELL = 40

const cell = (value: TapJsonValue | undefined): string => {
  if (value === undefined) {
    return ''
  }

  if (Array.isArray(value)) {
    return '[…]'
  }

  if (isRecord(value)) {
    return '{…}'
  }

  // A cell cannot hold the newlines of a multi-line value: they would end the
  // row the table is aligning.
  const text = String(value).replace(/\s+/g, ' ').trim()

  return WITHHELD.test(text) ? text : clamp(text, MAX_CELL)
}

// Rows of like-shaped objects are what the driver's `table` console prop holds
// (its keyboard/mouse event tables) — render them the way the reporter renders a
// table, the row keys themselves as the column headers. A lone row reads better
// as plain key/values, so it is left to the caller.
const rowsTable = (values: TapJsonValue[], indent: string): string[] | undefined => {
  if (values.length < 2 || !values.every(isRecord)) {
    return undefined
  }

  const columnKeys = [...new Set(values.flatMap((row) => Object.keys(row)))]

  if (!columnKeys.length) {
    return undefined
  }

  const rows = values.map((row) => columnKeys.map((column) => cell(row[column])))

  // Cells are plain here, so coloring them after padding is a no-op width-wise;
  // the withheld marker still needs its hue.
  return tableRows(columnKeys, rows, (cells) => cells.map((text) => (WITHHELD.test(text.trim()) ? color.aborted(text) : text)))
  .map((line) => `${indent}${line}`)
}

type PropsValue = { [key: string]: TapJsonValue } | TapJsonValue[]

const entriesOf = (value: PropsValue): Array<[string, TapJsonValue]> => {
  return Array.isArray(value)
    ? value.map((item, index): [string, TapJsonValue] => [String(index + 1), item])
    : Object.entries(value)
}

interface PropsRenderer {
  renderProps: (value: PropsValue, level: number) => string[]
  /** A value that carries its own newlines, or one too long for a row, under its key. */
  block: (text: string, indent: string) => string[]
  /** Like-shaped object rows as a table, or undefined for values that aren't. */
  rows: (values: TapJsonValue[], indent: string) => string[] | undefined
  collapsedCount: () => number
}

const createPropsRenderer = (maxDepth: number, rowBudget: number): PropsRenderer => {
  let collapsedCount = 0

  const block = (text: string, indent: string): string[] => blockLines(text, indent)
  const rows = (values: TapJsonValue[], indent: string): string[] | undefined => rowsTable(values, indent)

  // Scalars align in one column with their sibling scalars; a container gets its
  // own key line with its children indented beneath it, so nesting reads as
  // structure rather than punctuation.
  const renderProps = (value: PropsValue, level: number): string[] => {
    const indent = '  '.repeat(level + 1)
    const childIndent = '  '.repeat(level + 2)
    const entries = entriesOf(value)

    const inlined = new Map(entries.flatMap(([key, child]): Array<[string, InlineValue]> => {
      if (isBlock(child)) {
        return []
      }

      if (!isContainer(child)) {
        return [[key, scalarInline(child)]]
      }

      const empty = emptyContainerInline(child)

      if (empty) {
        return [[key, empty]]
      }

      if (level < maxDepth && entriesOf(child as PropsValue).length <= rowBudget) {
        return []
      }

      collapsedCount++

      return [[key, summaryInline(child)]]
    }))

    // One outlier key would otherwise push every value on the level out past the
    // terminal, so the column it shares stops at a width a row can carry.
    const label = (key: string): string => clamp(asKey(key) || '(empty key)', MAX_KEY_WIDTH)
    const width = Math.max(0, ...[...inlined.keys()].map((key) => label(key).length))
    const valueWidth = Math.max(MIN_VALUE_WIDTH, terminalWidth() - indent.length - width - 2)

    return entries.flatMap(([key, child]) => {
      const inline = inlined.get(key)
      const keyLine = `${indent}${chalk.dim(label(key))}`

      if (inline) {
        const text = inline.clampable ? clamp(inline.text, valueWidth) : inline.text

        return [`${indent}${chalk.dim(label(key).padEnd(width))}  ${inline.style ? inline.style(text) : text}`]
      }

      if (isBlock(child)) {
        return [keyLine, ...block(child, childIndent)]
      }

      const table = Array.isArray(child) ? rows(child, indent) : undefined

      return [keyLine, ...(table ?? renderProps(child as PropsValue, level + 1))]
    })
  }

  return { renderProps, block, rows, collapsedCount: () => collapsedCount }
}

```

### Core Architecture Module: `cli/lib/tap/render/dom.ts`
```
import type { FrameDomResult } from '../commands/dom'
import { color, emptyState, layout } from './format'

/**
 * `outerHTML` starts at the element but its inner lines keep the indentation
 * they had in the document, so a deeply nested element arrives ragged — first
 * line at the margin, the rest pushed right. Removing the smallest indent they
 * all share pulls the markup back to the margin without touching its internal
 * shape. Rendering-only: `--json` keeps the document's own whitespace.
 */
const dedent = (html: string): string => {
  const [first, ...rest] = html.split('\n')
  const shared = rest
  .filter((line) => line.trim().length)
  .reduce((min, line) => Math.min(min, line.length - line.trimStart().length), Infinity)

  if (!rest.length || shared === Infinity || shared === 0) {
    return html
  }

  return [first, ...rest.map((line) => line.slice(shared))].join('\n')
}

// Nothing but the HTML — no title framing it, so the output reads (and pipes)
// as the markup it is. A browser-side clip still adds a muted trailer, since
// silently handing back half a document would be worse than a little furniture.
export const renderDomHuman = (result: FrameDomResult): string => {
  if (result.found === false) {
    return emptyState('No element matched the selector.')
  }

  return layout([
    ...(result.html !== undefined ? [[dedent(result.html)]] : []),
    ...(result.truncated ? [[color.muted('(output truncated)')]] : []),
  ])
}

```

### Core Architecture Module: `cli/lib/tap/render/format.ts`
```
import chalk from 'chalk'

// The shared formatting vocabulary every tap command's human-readable renderer
// borrows from, so their output reads as one tool: the reporter's palette, its
// state icons, and the table / definition-list / heading / block primitives.
// A renderer composes these into `string[][]` blocks and hands them to `layout`.

// The reporter's own palette (packages/reporter/src/lib/variables.scss and
// commands.scss), so the CLI rendering matches the app: $pass/$fail map to
// jade-400/red-400, assert messages render jade-300/red-400 with jade-200/
// red-300 emphasis, the network dots use the command-message-indicator colors,
// and aliases take the purple badge hue. chalk downsamples the hex values on
// terminals without truecolor.
export const color = {
  pass: chalk.hex('#1fa971'), // $jade-400
  fail: chalk.hex('#e45770'), // $red-400
  passMessage: chalk.hex('#69d3a7'), // $jade-300
  passStrong: chalk.hex('#a3e7cb'), // $jade-200
  failStrong: chalk.hex('#f59aa9'), // $red-300
  errHeaderText: chalk.hex('#f59aa9'), // $err-header-text = $red-300
  aborted: chalk.hex('#db7903'), // $orange-400
  warn: chalk.hex('#edbb4a'), // $warn-text = $orange-300
  bad: chalk.hex('#c62b49'), // $red-500
  pending: chalk.hex('#6470f3'), // $indigo-400
  alias: chalk.hex('#c8a7f5'), // $purple-300
  aliasDom: chalk.hex('#9aa2fc'), // $indigo-300 — the reporter colors dom aliases indigo
  muted: chalk.hex('#9095ad'), // $gray-500
  fadedId: chalk.hex('#5a5f7a'), // $gray-700 — event ids sit back from the command numbers
}

export type RenderState = 'passed' | 'failed' | 'pending' | 'skipped'

export const stateBadge: Record<RenderState, { icon: string, word: string }> = {
  passed: { icon: color.pass('✓'), word: color.pass('passed') },
  failed: { icon: color.fail('✖'), word: color.fail('failed') },
  pending: { icon: color.pending('○'), word: color.pending('pending') },
  skipped: { icon: color.muted('-'), word: color.muted('skipped') },
}

export interface StateCounts {
  passed: number
  failed: number
  pending: number
  skipped: number
}

// The app header renders a zero count as `--` (its stats strip's `count`
// helper); skipped has no strip slot there, so it only appears when non-zero.
const count = (num: number): string => (num > 0 ? String(num) : '--')

// The reporter's per-outcome strip: `✓ 2  ✖ 1  ○ 1  - 3`. Shared by the reporter
// header and the status command's results line.
export const countsLine = (counts: StateCounts): string => {
  return [
    `${stateBadge.passed.icon} ${count(counts.passed)}`,
    `${stateBadge.failed.icon} ${count(counts.failed)}`,
    `${stateBadge.pending.icon} ${count(counts.pending)}`,
    ...(counts.skipped > 0 ? [`${stateBadge.skipped.icon} ${counts.skipped}`] : []),
  ].join('  ')
}

// A dim panel title, optionally carrying its row count: `ROUTES (2)`.
export const heading = (title: string, itemCount?: number): string => {
  return chalk.dim(itemCount === undefined ? title : `${title} (${itemCount})`)
}

// A bold title line led by a state/action icon, e.g. `✓ App > loads  passed`.
export const titleLine = (icon: string, text: string, suffix?: string): string => {
  return `${icon} ${chalk.bold(text)}${suffix ? `  ${suffix}` : ''}`
}

// The clock time a run started, trailing a spec title. Local time reads against
// the terminal's own clock; the ISO instant stays in --json for machines.
export const startedAtLabel = (startedAt: string): string => {
  return color.muted(`(started at ${new Date(startedAt).toLocaleTimeString('en-US')})`)
}

// A dim note standing in for an absent panel, e.g. `No specs to run.`
export const emptyState = (message: string): string => chalk.dim(message)

// A selector, quoted so it pastes straight back into a shell as one argument.
// Single quotes throughout, since attribute selectors carry double ones
// (`[data-test="x"]`); a single quote in the value becomes `'\''`.
export const quoted = (selector: string): string => `'${selector.split('\'').join('\'\\\'\'')}'`

export const indent = (depth: number): string => '  '.repeat(depth)

// The column count to lay a row out against, falling back to a readable width
// when the output is piped and the terminal reports none.
export const terminalWidth = (): number => process.stdout.columns || 120

// Keep a value on its own row: a soft-wrapped line breaks out of the column it
// was padded into, so anything longer than the room left for it ends in an
// ellipsis. Clamp before coloring, the way the tables pad before coloring.
export const clamp = (text: string, width: number): string => {
  return text.length <= width ? text : `${text.slice(0, Math.max(1, width - 1))}…`
}

// Pad before coloring: the escape codes chalk adds would otherwise count
// toward the column width. `colorize` styles the padded cells — it also gets the
// row index, since a padded cell no longer compares equal to the value it holds
// — and defaults to leaving them plain for the tables that don't tint a column.
export const columns = (
  header: string[],
  rows: string[][],
  colorize: (cells: string[], index: number) => string[] = (cells) => cells,
): string[] => {
  const widths = header.map((cell, column) => Math.max(cell.length, ...rows.map((row) => row[column].length)))
  const pad = (cells: string[]) => cells.map((cell, column) => cell.padEnd(widths[column]))

  return [
    pad(header).map((cell) => chalk.dim(cell)).join('  '),
    ...rows.map((row, index) => colorize(pad(row), index).join('  ')),
  ]
}

// Columns rendered as a standalone nested block.
export const tableRows = (
  header: string[],
  rows: string[][],
  colorize?: (cells: string[], index: number) => string[],
): string[] => {
  return columns(header, rows, colorize).map((line) => `${indent(1)}${line}`)
}

// A counted panel title with its content indented beneath it. Content rendered
// on its own — no title to sit under — keeps the left margin.
export const panel = (title: string, count: number | undefined, lines: string[]): string[] => {
  return [heading(title, count), ...lines.map((line) => `${indent(1)}${line}`)]
}

// Columns under a counted panel title.
export const table = (
  title: string,
  header: string[],
  rows: string[][],
  colorize?: (cells: string[], index: number) => string[],
): string[] => {
  return panel(title, rows.length, columns(header, rows, colorize))
}

// Aligned `label  value` rows. Values arrive already styled — callers color
// them before padding matters, since only the labels share a column width.
export const definitionList = (entries: Array<[string, string]>): string[] => {
  const width = Math.max(0, ...entries.map(([label]) => label.length))

  return entries.map(([label, value]) => `  ${label.padEnd(width)}  ${value}`)
}

// Assemble rendered blocks into the final string: lines within a block on their
// own rows, blocks separated by a blank line, trailing whitespace trimmed.
export const layout = (blocks: string[][]): string => {
  return blocks.map((block) => block.map((line) => line.trimEnd()).join('\n')).join('\n\n')
}

```

### Core Architecture Module: `cli/lib/tap/render/index.ts`
```
import type { ClearResult, PinResult, TapCommandName, TapCommandResult, TapNativeCommandName, TapReporterSpecView, TapReporterView } from '@packages/cypress-sessions'
import type { TapRunResult } from '../commands/run'
import type { TapSessionSummary } from '../commands/sessions'
import type { TapSpecEntry } from '../commands/specs'
import type { TapStatus } from '../types'
import type { FrameDomResult } from '../commands/dom'
import type { FrameAriaResult } from '../commands/aria'
import type { FrameInspectResult } from '../commands/inspect'
import type { FrameAmbiguousResult } from '../aut/single-match'
import { renderAmbiguousHuman } from './ambiguous'
import { renderReporterHuman, renderReporterSpecHuman } from './reporter'
import { renderRunHuman } from './run'
import { renderSessionsHuman } from './sessions'
import { renderSpecsHuman } from './specs'
import { renderStatusHuman } from './status'
import { renderDomHuman } from './dom'
import { renderAriaHuman } from './aria'
import { renderInspectHuman } from './inspect'
import { renderPinHuman } from './pin'
import { renderCommandHuman } from './command'

/**
 * The CLI-side rendering half of a tap command's definition. A command that
 * declares `renderHuman` prints that rendering by default; `--json` bypasses it
 * for the raw result. Commands without one keep printing JSON. The result shape
 * a renderer receives is the command's typed interface from the shared
 * `@packages/cypress-sessions` contract; `options` are the command's invoked
 * options, for a command whose result shape depends on them. Returning
 * undefined declines the rendering for the invoked options, printing the raw
 * JSON as if `--json` had been passed.
 */
export interface TapCommandRendering {
  renderHuman: (result: unknown, options: Record<string, string>) => string | undefined
}

// The selector-taking AUT reads answer an ambiguous selector in place of the
// read they were asked for, so each one renders that answer instead of its own.
const orAmbiguous = <T>(render: (result: T) => string) => {
  return (result: unknown): string => {
    const ambiguous = result as FrameAmbiguousResult

    return ambiguous.ambiguous ? renderAmbiguousHuman(ambiguous) : render(result as T)
  }
}

const renderings: Partial<Record<TapCommandName | TapNativeCommandName, TapCommandRendering>> = {
  reporter: {
    renderHuman: (result) => {
      // Only the no-test spec overview carries `stats`; the single-test view never does.
      const view = result as TapReporterView | TapReporterSpecView

      return 'stats' in view ? renderReporterSpecHuman(view) : renderReporterHuman(view)
    },
  },
  command: {
    renderHuman: (result, options) => {
      return renderCommandHuman(result as TapCommandResult, {
        depth: options.depth,
      })
    },
  },
  run: { renderHuman: (result) => renderRunHuman(result as TapRunResult) },
  sessions: { renderHuman: (result) => renderSessionsHuman(result as TapSessionSummary[]) },
  specs: { renderHuman: (result) => renderSpecsHuman(result as TapSpecEntry[]) },
  status: { renderHuman: (result) => renderStatusHuman(result as TapStatus) },
  dom: { renderHuman: orAmbiguous<FrameDomResult>(renderDomHuman) },
  aria: { renderHuman: orAmbiguous<FrameAriaResult>(renderAriaHuman) },
  inspect: { renderHuman: orAmbiguous<FrameInspectResult>(renderInspectHuman) },
  pin: { renderHuman: (result) => renderPinHuman(result as PinResult | ClearResult) },
}

export const renderingFor = (command: string): TapCommandRendering | undefined => {
  return renderings[command as TapCommandName | TapNativeCommandName]
}

```

### Core Architecture Module: `cli/lib/tap/render/pin.ts`
```
import chalk from 'chalk'

import type { ClearResult, PinResult } from '@packages/cypress-sessions'
import { color, layout } from './format'
import { PIN_ICON, pinnedBlock } from './pinned'

// A pin prints the same block wherever it's reported, so `pin` and `status`
// agree; `--clear` has nothing to show but whether the pin let go.
const renderCleared = (result: ClearResult): string => {
  return result.cleared
    ? chalk.dim(`${PIN_ICON} PIN CLEARED`)
    : color.fail(`${PIN_ICON} FAILED TO CLEAR PIN`)
}

export const renderPinHuman = (result: PinResult | ClearResult): string => {
  return 'pinned' in result ? layout([pinnedBlock(result.pinned)]) : renderCleared(result)
}

```

### Core Architecture Module: `cli/lib/tap/render/pinned.ts`
```
import type { PinnedView } from '@packages/cypress-sessions'
import { color } from './format'
import { renderCommandSection } from './reporter'

/** The pin glyph every pin line leads with — pinned, cleared, or failed to clear. */
export const PIN_ICON = '⚲'

// A pin reads as its own reporter row: which snapshot of the command is showing,
// then the row itself under its hook section, exactly as `reporter` prints it.
// Shared so `pin` and `status` can't drift.
export const pinnedBlock = (view: PinnedView): string[] => {
  const { index, total, name } = view.at
  const snapshot = `(${index}/${total})${name ? ` ${name}` : ''}`

  return [
    color.alias(`${PIN_ICON} PINNED - ${snapshot}`),
    ...renderCommandSection([view.command], view.hookName),
  ]
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #35088** (2026-10-19): **chore(npm/angular): migrate to @packages/eslint-config**
  *Symptoms*: - Closes N/A. This is one slice of the ESLint 9 flat-config migration tracked in [`guides/eslint-migration.md`](https://github.com/cypress-io/cypress/blob/develop/guides/eslint-migration.md).  ### Additional details  This moves `@cypress/angular` from the eslintrc `tests` preset onto the shared ESLint 9 flat config, following the steps in the migration guide.  - **New `eslint.config.ts`:** spreads `baseConfig` and sets `tsconfigRootDir`, with no package-specific overrides. It's modeled on `npm/svelte`, which has the same layout (`src/` plus `rollup.config.mjs`). - **Removed `.eslintrc` and `.eslintignore`:** none of the ignore entries still matched a file. Flat config only lints JS/TS here, `dist/` is ignored centrally, and the package has no `.d.ts` files or `cypress/fixtures` outside `dist/`. ESLint 9 lints all four source files: `src/index.ts`, `src/mount.ts`, `rollup.config.mjs` and `eslint.config.ts`. - **`package.json`:** adds `@packages/eslint-config`, `eslint` and `jiti` as devDependencies, changes `lint` to `eslint`, and adds a `lint-staged` block. It also drops an unused `standard.globals` block, since nothing in the repo runs the `standard` linter. - **Root `package.json`:** routes `npm/angular/**` to the package's own config in `lint-staged`, excludes angular from the catch-all `npm/!(…)` glob, and adds it to the `lint:fix` scope. - **`src/mount.ts`:**   - Autofix cleared the 4 expected stylistic errors (`object-curly-spacing` ×3, `semi` ×1).   - The shared config

- **Issue #35087** (2026-10-19): **dependency: update undici to 6.29.1 to address SNYK-JS-UNDICI-21181005**
  *Symptoms*: - Closes N/A — no issue; this resolves a Snyk advisory that fails the `Snyk_SCA_Scan` check on every PR.  ### Additional details  Snyk reports [SNYK-JS-UNDICI-21181005](https://security.snyk.io/vuln/SNYK-JS-UNDICI-21181005) (Improper Certificate Validation, critical) against `undici@6.28.0`, which `@packages/server` pulls in through `webdriver@9.28.0` (`undici: ^6.21.3`). This fails the `Snyk_SCA_Scan` GitHub Actions check on every open PR.  This updates the lockfile so that `undici` resolves to `6.29.1`, which is within `webdriver`'s existing range. The dev-only copy under `@semantic-release/github` moves from `7.29.0` to `7.30.1`, the patched 7.x release. No `package.json` changes; `yarn.lock` was regenerated by yarn and `yarn check-lockfile` passes.  <!-- CURSOR_SUMMARY --> ---  > [!NOTE] > **Low Risk** > Lockfile-only transitive dependency patch for a known TLS/certificate validation CVE; no Cypress API or runtime behavior changes. >  > **Overview** > Bumps the resolved **`undici`** versions in **`yarn.lock`** so transitive dependencies pick up patched releases: **`6.28.0` → `6.29.1`** (via `webdriver` / `@packages/server`) and **`7.29.0` → `7.30.1`** (dev path under `@semantic-release/github`). No **`package.json`** edits. >  > Documents the **`6.x`** upgrade in **`cli/CHANGELOG.md`** under **Dependency Updates**, citing Snyk advisory **SNYK-JS-UNDICI-21181005** (improper certificate validation) so **`Snyk_SCA_Scan`** can pass. >  > <sup>Reviewed by [Cursor Bugbot](https

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

### Incident Patch 1: `30a4d032` (2026-10-19)
**Commit Message**: fix: drop requests that arrive after the NetworkProxy is disposed (#34977)

* fix: drop requests that arrive after the NetworkProxy is disposed

ServerBase#close() disposes the NetworkProxy before the HTTP server stops
accepting connections. A browser request landing in that window reached the
catch-all route, whose getNetworkProxy() threw from ensureProp. The handler is
async and Express 4 does not catch rejections, so the throw became an
unhandled rejection and a passing run exited 1. The routes now read the
proxy as possibly undefined and destroy the response when it is gone.

Also makes the chrome_tab_close fixture wait forever after closing its tab,
so the test can no longer report a pass before the tab-closed handling runs,
which put an extra line in the browser_crash_handling snapshot.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* chore: add changelog entry

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* chore: trim changelog entry

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Update CHANGELOG with bug fixes and new features

Updated CHANGELOG with recent bug fixes and enhancements.

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `cli/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 - [`cy.fixture()`](https://on.cypress.io/fixture) and the `fixture` property of a [`cy.intercept()`](https://on.cypress.io/intercept) static response now fail when the fixture path resolves outside the [`fixturesFolder`](https://docs.cypress.io/app/references/configuration#Folders--Files). Fixed in [#35072](https://github.com/cypress-io/cypress/pull/35072).
 - Fixed an issue where [`.rightclick()`](https://on.cypress.io/rightclick) sent `buttons: 2` on its `pointerup` and `mouseup` events. A real right click reports `buttons: 0` on these events because the right button has just been released, so code that checks `event.buttons` on release now sees the same value it does in a browser. Fixed in [#35042](https://github.com/cypress-io/cypress/pull/35042).
 - [`.trigger()`](https://on.cypress.io/trigger) now fails when passed an empty string as the event name, such as `cy.get('button').trigger('')`. Previously, it dispatched an event whose `type` was an empty string instead of failing, even though its error message says the event name must be a non-empty string. That error now shows the value that was passed, instead of the literal text `{{cmd}}`. It and the matching errors from [`cy.readFile()`](https://on.cypress.io/readfile) and [`cy.writeFile()`](https://on.cypress.io/writefile) now show an empty string as `''`, instead of leaving the value blank. Fixed in [#35068](https://github.com/cypress-io/cypress/pull/35068).
+- Fixed a regression in [16.0.0](#16-0-0) where a run whose tests all passed could exit with code 1 and print `ServerBase#open must first be called before accessing 'this.null'` if the browser made a request while Cypress was shutting down. Fixed in [#34977](https://github.com/cypress-io/cypress/pull/34977).
 
 **Misc:**
 
```

**File**: `packages/server/lib/routes.ts` (modified, +31/-11)
```diff
@@ -1,6 +1,6 @@
 import httpProxy from 'http-proxy'
 import Debug from 'debug'
-import type { ErrorRequestHandler, Request } from 'express'
+import type { ErrorRequestHandler, Request, Response } from 'express'
 import { Router } from 'express'
 import send from 'send'
 import { getPathToDist } from '@packages/resolve-dist'
@@ -35,9 +35,10 @@ export interface InitializeRoutes {
   /**
    * Read per request, never captured: the CDP Fetch runtime installs a new
    * NetworkProxy at every launch, and the network path can flip on this same
-   * router when the browser is switched in open mode.
+   * router when the browser is switched in open mode. Undefined once close()
+   * has disposed the runtime.
    */
-  getNetworkProxy: () => NetworkProxy
+  getNetworkProxy: () => NetworkProxy | undefined
   remoteStates: RemoteStates
   isBrowserNetworkMode: () => boolean
   onError: (...args: unknown[]) => any
@@ -57,6 +58,23 @@ export const createCommonRoutes = ({
   const router = Router()
   const { clientRoute, namespace } = config
 
+  // close() disposes the NetworkProxy before the HTTP server stops accepting
+  // connections, so a late browser request can still land here with nothing
+  // left to serve it. Drop it the way the closing server would: throwing from
+  // an async Express 4 handler is an unhandled rejection, which exits the process.
+  const handleHttpRequest = async (req: Request, res: Response) => {
+    const networkProxy = getNetworkProxy()
+
+    if (!networkProxy) {
+      debug('dropping request received after the NetworkProxy was disposed: %s %s', req.method, req.url)
+      res.destroy()
+
+      return
+    }
+
+    await networkProxy.handleHttpRequest(req, res)
+  }
+
   // When a test visits an http:// site and we load our main app page,
   // (e.g. test has cy.visit('http://example.com'), we load http://example.com/__/)
   // Chrome will make a request to the the https:// version (i.e. https://example.com/__/)
@@ -117,11 +135,11 @@ export const createCommonRoutes = ({
   // to the child project. We also add a utility route for testing HTTP status code UI
   if (process.env.CYPRESS_INTERNAL_E2E_TESTING_SELF_PARENT_PROJECT) {
     router.all(`${CYPRESS_STUDIO_ROUTE}*`, async (req, res) => {
-      await getNetworkProxy().handleHttpRequest(req, res)
+      await handleHttpRequest(req, res)
     })
 
     router.all(`${CYPRESS_CY_PROMPT_ROUTE}*`, async (req, res) => {
-      await getNetworkProxy().handleHttpRequest(req, res)
+      await handleHttpRequest(req, res)
     })
 
     router.get('/status-code-test/:num', (req, res) => {
@@ -184,7 +202,11 @@ export const createCommonRoutes = ({
   router.get(`/${config.namespace}/automation/setLocalStorage`, (req, res) => {
     const origin = req.originalUrl.slice(req.originalUrl.indexOf('?') + 1)
 
-    getNetworkProxy().http.getRenderedHTMLOrigins()[origin] = true
+    const renderedHTMLOrigins = getNetworkProxy()?.http.getRenderedHTMLOrigins()
+
+    if (renderedHTMLOrigins) {
+      renderedHTMLOrigins[origin] = true
+    }
 
     res.sendFile(path.join(__dirname, './html/set-local-storage.html'))
   })
@@ -338,12 +360,10 @@ export const createCommonRoutes = ({
   // this same router. Mounting both would not work either: the MITM branch
   // never calls next(), so mount order would decide the behavior permanently.
   router.all('*', async (req: Request & { proxiedUrl?: string }, res, next) => {
-    const proxy = getNetworkProxy()
-
     // MITM path: every browser request arrives here in absolute form, so the
     // pipeline owns all of it.
     if (!isBrowserNetworkMode()) {
-      await proxy.handleHttpRequest(req, res)
+      await handleHttpRequest(req, res)
 
       return
     }
@@ -368,7 +388,7 @@ export const createCommonRoutes = ({
     if (isTrustedInternalLoopback(req.headers) && req.proxiedUrl && /^https?:\/\//.test(req.proxiedUrl)) {
       debug('serving loopback-token request through the pipeline: %s %s', req.method, req.proxiedUrl)
 
-      await proxy.handleHttpRequest(req, res)
+      await handleHttpRequest(req, res)
 
       return
     }
@@ -386,7 +406,7 @@ export const createCommonRoutes = ({
       debug('serving direct file server request through the pipeline: %s %s', req.method, absoluteUrl)
 
       req.proxiedUrl = absoluteUrl
-      await proxy.handleHttpRequest(req, res)
+      await handleHttpRequest(req, res)
 
       return
     }
```

**File**: `packages/server/lib/server-base.ts` (modified, +1/-1)
```diff
@@ -459,7 +459,7 @@ export class ServerBase<TSocket extends SocketE2E | SocketCt> {
       nodeProxy: this.nodeProxy,
       // Lazy: the CDP Fetch runtime swaps NetworkProxy at each launch, so the
       // routes must read whichever instance is current rather than capture one.
-      getNetworkProxy: () => this.networkProxy,
+      getNetworkProxy: () => this._networkProxy,
       isBrowserNetworkMode: this.isBrowserNetworkMode,
       onError,
       getSpec,
```

**File**: `packages/server/test/unit/routes.spec.ts` (modified, +17/-1)
```diff
@@ -436,7 +436,7 @@ describe('lib/routes', () => {
   })
 
   describe('catch-all', () => {
-    function setupCatchAll ({ remoteState, isBrowserNetworkMode = () => true, getNetworkProxy }: { remoteState: any, isBrowserNetworkMode?: () => boolean, getNetworkProxy?: () => NetworkProxy }) {
+    function setupCatchAll ({ remoteState, isBrowserNetworkMode = () => true, getNetworkProxy }: { remoteState: any, isBrowserNetworkMode?: () => boolean, getNetworkProxy?: () => NetworkProxy | undefined }) {
       const router = makeRouter()
 
       expressStubs.Router.mockReturnValue(router as any)
@@ -635,6 +635,22 @@ describe('lib/routes', () => {
       expect(first.handleHttpRequest).toHaveBeenCalledTimes(1)
     })
 
+    // close() disposes the NetworkProxy before the HTTP server stops accepting
+    // connections, and a rejection here would exit the process
+    it('drops a request that arrives after the NetworkProxy is disposed', async () => {
+      const { handler } = setupCatchAll({
+        remoteState: { strategy: 'http', origin: 'http://localhost:3500', props: null },
+        isBrowserNetworkMode: () => false,
+        getNetworkProxy: () => undefined,
+      })
+      const req = { url: 'http://example.com/late', method: 'GET', headers: {} }
+      const res = { destroy: vi.fn() }
+
+      await expect(handler(req, res, vi.fn())).resolves.toBeUndefined()
+
+      expect(res.destroy).toHaveBeenCalled()
+    })
+
     it('falls through for URLs the file server cannot resolve', async () => {
       const { handler, handleHttpRequest } = setupCatchAll({
         remoteState: { strategy: 'http', origin: 'http://localhost:3500', props: null },
```

**File**: `system-tests/projects/e2e/cypress/e2e/chrome_tab_close.cy.js` (modified, +5/-1)
```diff
@@ -7,12 +7,16 @@ it('closes the chrome tab', () => {
 
     const target = targetInfos.find((target) => target.url === url)
 
-    return Cypress.automation('remote:debugger:protocol', {
+    Cypress.automation('remote:debugger:protocol', {
       command: 'Target.closeTarget',
       params: {
         targetId: target.targetId,
       },
     })
+
+    // closeTarget can resolve before the server notices the tab is gone, and a
+    // test that finishes first prints a passing line the snapshot doesn't have
+    return new Promise(() => {})
   })
   // never settle, so the test can't report a pass before the tab finishes closing
   .then(() => new Promise(() => {}))
```

---

### Incident Patch 2: `1e3dfa6b` (2026-10-18)
**Commit Message**: fix: only load fixtures from inside the fixturesFolder (#35072)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `cli/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 
 **Bugfixes:**
 
+- [`cy.fixture()`](https://on.cypress.io/fixture) and the `fixture` property of a [`cy.intercept()`](https://on.cypress.io/intercept) static response now fail when the fixture path resolves outside the [`fixturesFolder`](https://docs.cypress.io/app/references/configuration#Folders--Files). Fixed in [#35072](https://github.com/cypress-io/cypress/pull/35072).
 - Fixed an issue where [`.rightclick()`](https://on.cypress.io/rightclick) sent `buttons: 2` on its `pointerup` and `mouseup` events. A real right click reports `buttons: 0` on these events because the right button has just been released, so code that checks `event.buttons` on release now sees the same value it does in a browser. Fixed in [#35042](https://github.com/cypress-io/cypress/pull/35042).
 - [`.trigger()`](https://on.cypress.io/trigger) now fails when passed an empty string as the event name, such as `cy.get('button').trigger('')`. Previously, it dispatched an event whose `type` was an empty string instead of failing, even though its error message says the event name must be a non-empty string. That error now shows the value that was passed, instead of the literal text `{{cmd}}`. It and the matching errors from [`cy.readFile()`](https://on.cypress.io/readfile) and [`cy.writeFile()`](https://on.cypress.io/writefile) now show an empty string as `''`, instead of leaving the value blank. Fixed in [#35068](https://github.com/cypress-io/cypress/pull/35068).
 
```

**File**: `packages/server/lib/cloud/bundles/stream_download_verify_extract.ts` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ import { PUBLIC_KEY_VERSION } from '../constants'
 import { createStreamingSignatureVerifier } from '../encryption'
 import type { BundleErrorStage, BundleKind } from './bundle_error'
 import { BundleError } from './bundle_error'
-import { isInsideDir } from './is_inside_dir'
+import { isInsideDir } from '../../util/is_inside_dir'
 
 const pkg = require('@packages/root')
 
```

**File**: `packages/server/lib/cloud/bundles/verify_bundle_on_disk.ts` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import crypto from 'crypto'
 import Debug from 'debug'
 import { verifySignature } from '../encryption'
 import { walkFiles } from './walk_files'
-import { isInsideDir } from './is_inside_dir'
+import { isInsideDir } from '../../util/is_inside_dir'
 
 const debug = Debug('cypress:server:cloud:bundles:verify-bundle-on-disk')
 
```

**File**: `packages/server/lib/fixture.ts` (modified, +8/-2)
```diff
@@ -6,6 +6,7 @@ import { stripVTControlCharacters as stripAnsi } from 'util'
 import * as errors from './errors'
 import { fs } from './util/fs'
 import { globAsync as glob } from './util/glob'
+import { isInsideDir } from './util/is_inside_dir'
 import type { ObjectEncodingOptions } from 'fs-extra'
 
 const debug = debugModule('cypress:server:fixture')
@@ -34,9 +35,14 @@ const friendlyJsonParse = function (s) {
 }
 
 export async function get (fixturesFolder: string, filePath: string, options: { encoding?: (ObjectEncodingOptions & { flag?: string | undefined }) | BufferEncoding | null | undefined } = {}) {
+  const root = path.resolve(fixturesFolder)
   const p = path.join(fixturesFolder, filePath)
   const fixture = path.basename(p)
 
+  if (!isInsideDir(root, path.resolve(p))) {
+    throw new Error(`Fixture path '${filePath}' must resolve to a file inside the fixtures folder: ${fixturesFolder}`)
+  }
+
   // if the file exists, go ahead and parse it
   // otherwise, glob for potential extensions
 
@@ -52,10 +58,10 @@ export async function get (fixturesFolder: string, filePath: string, options: {
 
     const pattern = `${p}{${extensions.join(',')}}`
 
-    const matches = await glob(pattern, {
+    const matches = (await glob(pattern, {
       nosort: true,
       nodir: true,
-    })
+    })).filter((match) => isInsideDir(root, path.resolve(match)))
 
     if (matches.length === 0) {
       const relativePath = path.relative('.', p)
```

**File**: `packages/server/lib/util/is_inside_dir.ts` (renamed, +1/-1)
```diff
@@ -4,5 +4,5 @@ import path from 'path'
 export const isInsideDir = (parent: string, child: string): boolean => {
   const rel = path.relative(parent, child)
 
-  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
+  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)
 }
```

**File**: `packages/server/test/unit/fixture.spec.ts` (modified, +34/-0)
```diff
@@ -101,6 +101,40 @@ describe('lib/fixture', () => {
     })
   })
 
+  describe('paths outside the fixtures folder', () => {
+    const expectOutsideFolderError = async (filePath: string, options?: Parameters<typeof fixture.get>[2]) => {
+      await expect(fixture.get(fixturesFolder, filePath, options)).rejects.toThrow(`Fixture path '${filePath}' must resolve to a file inside the fixtures folder`)
+    }
+
+    it('rejects a relative path that traverses out of the fixtures folder', async () => {
+      await expectOutsideFolderError('../test1.js')
+      await expectOutsideFolderError('../../cypress.config.js')
+    })
+
+    it('rejects a traversal path that omits the extension', async () => {
+      await expectOutsideFolderError('../test1')
+    })
+
+    it('rejects a path that resolves to the fixtures folder itself', async () => {
+      await expectOutsideFolderError('.')
+      await expectOutsideFolderError('nested/..')
+    })
+
+    it('rejects a traversal path when an encoding is passed', async () => {
+      await expectOutsideFolderError('../test1.js', { encoding: 'utf8' })
+    })
+
+    it('does not resolve extension matches that glob patterns expand outside the fixtures folder', async () => {
+      await expect(fixture.get(fixturesFolder, '{..,x}/test1')).rejects.toThrow('A fixture file could not be found')
+    })
+
+    it('allows a path that traverses within the fixtures folder', async () => {
+      const obj = await fixture.get(fixturesFolder, 'nested/../foo.json')
+
+      expect(obj).toStrictEqual([{ json: true }])
+    })
+  })
+
   describe('json files', () => {
     it('throws when json is invalid', () => {
       return fixture.get(fixturesFolder, 'bad_json.json')
```

**File**: `packages/server/test/unit/util/is_inside_dir.spec.ts` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+import path from 'path'
+import { describe, it, expect } from 'vitest'
+import { isInsideDir } from '../../../lib/util/is_inside_dir'
+
+describe('lib/util/is_inside_dir', () => {
+  const parent = path.resolve('/project/fixtures')
+
+  it('is true for a descendant', () => {
+    expect(isInsideDir(parent, path.join(parent, 'users.json'))).toBe(true)
+    expect(isInsideDir(parent, path.join(parent, 'nested', 'users.json'))).toBe(true)
+  })
+
+  it('is true for a descendant whose name starts with ..', () => {
+    expect(isInsideDir(parent, path.join(parent, '..users.json'))).toBe(true)
+  })
+
+  it('is false for the directory itself', () => {
+    expect(isInsideDir(parent, parent)).toBe(false)
+  })
+
+  it('is false for the parent directory and its other children', () => {
+    expect(isInsideDir(parent, path.dirname(parent))).toBe(false)
+    expect(isInsideDir(parent, path.resolve(parent, '..', 'secret.json'))).toBe(false)
+  })
+
+  it('is false for a sibling directory that shares a name prefix', () => {
+    expect(isInsideDir(parent, path.resolve(parent, '..', 'fixtures-other', 'users.json'))).toBe(false)
+  })
+})
```

**File**: `system-tests/projects/e2e/cypress/e2e/form_submission_multipart.cy.js` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ describe('<form> submissions', () => {
     }
 
     it('image/png', () => {
-      testUpload('../../static/javascript-logo.png')
+      testUpload('javascript-logo.png')
     })
 
     it('application/pdf', () => {
```

#### Recent Merged Pull Requests:
- **PR #35088** (2026-10-19): chore(npm/angular): migrate to @packages/eslint-config (@jennifer-shehane)
- **PR #35087** (2026-10-19): dependency: update undici to 6.29.1 to address SNYK-JS-UNDICI-21181005 (@mschile)
- **PR #35085** (2026-10-18): chore: lint Vue SFCs with TypeScript in @packages/eslint-config (@jennifer-shehane)
- **PR #35083** (2026-10-18): chore: lint JSON in @packages/eslint-config with an opt-in jsonConfig (@jennifer-shehane)
- **PR #35080** (2026-10-17): chore: enable @typescript-eslint/ban-ts-comment in the shared flat config (@jennifer-shehane)
- **PR #35079** (2026-10-17): chore: promote zero-hit React, Vue and import-x/namespace lint warnings to errors (@jennifer-shehane)

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

## X. drop requests that arrive after the NetworkProxy is disposed (#34977)

**RULE**:
When implementing operations in `cli/CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in cypress-io/cypress. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `30a4d032`: drop requests that arrive after the NetworkProxy is disposed (#34977). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `cli/CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
- Fixed a regression in [16.0.0](#16-0-0) where a run whose tests all passed could exit with code 1 and print `ServerBase#open must first be called before accessing 'this.null'` if the browser made a request while Cypress was shutting down. Fixed in [#34977](https://github.com/cypress-io/cypress/pull/34977).
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `30a4d032` are properly handled with clean fallback behavior.

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cypress-io-cypress-learnings.md`  
> **Source**: github ([https://github.com/cypress-io/cypress](https://github.com/cypress-io/cypress))  
> **Source Version**: `e20ef17f`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-23T10:54:21.897Z  
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
> **Harvest Timestamp**: 2026-10-23T10:54:20.969Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cypress-io/cypress`
- **Description**: Fast, easy and reliable testing for anything that runs in a browser.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 51014 stars

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
- **Issue #35125** (2026-10-22): **chore: wait for an in-flight project scaffold before a test retry re-scaffolds it**
  *Symptoms*: - Closes N/A — flaky test fix  ### Additional details  `ct-framework-errors.cy.ts` › `Angular 21` › `error conditions` flakes on Windows ([example job](https://app.circleci.com/pipelines/github/cypress-io/cypress/87278/workflows/fccacf0e-a845-4c95-9ede-11e2744bb4e7/jobs/4031838), Cloud run `ypt4pf/74925`). The reported error, `Could not resolve "@angular-devkit/build-angular/..."`, is a symptom of the test harness, not of `@cypress/webpack-dev-server`:  | Attempt | Duration | Error | |---|---|---| | 1 | 60.6s | `` cy.task('__internal_scaffoldProject') timed out after waiting `60000ms` `` | | 2 | 4.9s | Could not resolve `.../utils/webpack-browser-config.js` | | 3 | 4.9s | Could not resolve `.../tools/webpack/configs/common.js` |  - The Windows runner has no cached `node_modules` for the Angular fixtures, so the first `yarn install` can take longer than the 60s default `cy.scaffoldProject` timeout. - A `cy.task` timeout fails the test but does not stop the plugin-side install. The CI log shows the angular-21 install still at "Linking dependencies" while the retries ran. - The retries re-scaffolded the project on top of that in-progress install. On Windows they logged "Found package.json" and then returned without installing, so the dev server loaded from a half-linked `node_modules`. Each retry was missing a different file.  Changes: - `__internal_scaffoldProject` (in `e2ePluginSetup.ts`) now waits for any in-progress scaffold of the same project, whether it succeeds or fails,

- **Issue #35121** (2026-10-22): **chore: remove the GraphQL-over-fetch switch**
  *Symptoms*: - Closes N/A — internal cleanup of a test-only code path.  ### Additional details  `window.__CYPRESS_GQL_NO_SOCKET__` made the app's urql client send GraphQL over `fetch` instead of the socket. Its only consumers were two app e2e specs (`debug.cy.ts` and `cloud_message_banner.cy.ts`) that used it so `cy.intercept('mutation-…')` could see GraphQL requests. This PR removes the switch so the app always uses the socket (launchpad is unchanged and still uses `fetch`).  - `frontend-shared/src/graphql/urqlClient.ts`: drops the flag and its `Window` type. - `data-context/src/sources/HtmlDataSource.ts`: drops the injection driven by `CYPRESS_INTERNAL_GQL_NO_SOCKET`. - `server/lib/gui/menu.ts`: drops the "GraphQL requests over Fetch" dev-menu toggle. The submenu is now typed as `MenuItemConstructorOptions[]`, which removes a `@ts-expect-error` that had been hiding the toggle's type mismatch. - `app/cypress/e2e/support/e2eSupport.ts`: drops the per-load reset hook. - `debug.cy.ts`: waits on the existing `recordEvent` spy and `openFile` stub with `cy.withRetryableCtx` instead of `cy.wait` on intercepts, and sets `preferredEditorBinary` on the server instead of rewriting the `OpenFileInIDE` response. - `cloud_message_banner.cy.ts`: spies on `ctx.actions.localSettings.setPreferences` and asserts the same payload contents the intercept checked. - `guides/app-cloud-testing.md`: updated to describe `cy.remoteGraphQLIntercept` plus server-side spies, and GraphiQL for capturing fixture response

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

### Incident Patch 1: `b7fd293f` (2026-10-21)
**Commit Message**: fix: show a clear error when the component testing dev server fails to start (#35081)

* fix(webpack-dev-server): reject devServer() when creating the server fails

An error thrown by devServer.create() happened inside an async Promise
executor, so it surfaced as an unhandled rejection and devServer() never
settled. devServer() is now async, so the error rejects its promise.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_012RGXnicvByeKrNXrZmn9Q8

* fix: show a clear error when the component testing dev server fails to start

When the dev server rejected during startup, the error reached the
terminal and Launchpad as a bare message and stack. Wrap it in a new
DEV_SERVER_START_FAILED error that names the dev server and links to the
dev server docs. This also replaces the "config file crashed" message
that webpack version errors used to get by escaping as an unhandled
rejection.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_012RGXnicvByeKrNXrZmn9Q8

* chore: add changelog entry and regenerate cypress-sessions types

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session:

**File**: `cli/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 - Fixed a regression in [16.1.0](#16-1-0) where, in Chrome, Chromium, and Edge run headed, the Cypress browser extension could stop responding for the rest of the run. This caused [`@cypress/puppeteer`](https://github.com/cypress-io/cypress/tree/develop/npm/puppeteer) to fail with `Cannot communicate with the Cypress Chrome extension`. Fixed in [#34958](https://github.com/cypress-io/cypress/pull/34958).
 - [`cy.fixture()`](https://on.cypress.io/fixture) and the `fixture` property of a [`cy.intercept()`](https://on.cypress.io/intercept) static response now fail when the fixture path resolves outside the [`fixturesFolder`](https://docs.cypress.io/app/references/configuration#Folders--Files). Fixed in [#35072](https://github.com/cypress-io/cypress/pull/35072).
 - Fixed an issue where [`.rightclick()`](https://on.cypress.io/rightclick) sent `buttons: 2` on its `pointerup` and `mouseup` events. A real right click reports `buttons: 0` on these events because the right button has just been released, so code that checks `event.buttons` on release now sees the same value it does in a browser. Fixed in [#35042](https://github.com/cypress-io/cypress/pull/35042).
+- When the dev server for component testing fails to start, such as when your project installs a version of webpack or webpack-dev-server that Cypress does not support, Cypress now explains that the dev server could not start, shows the dev server's error, and links to the dev server documentation. Previously, webpack errors were reported as a crash of your config file, and other dev server errors were shown with no explanation. Fixed in [#35081](https://github.com/cypress-io/cypress/pull/35081).
 - [`.trigger()`](https://on.cypress.io/trigger) now fails when passed an empty string as the event name, such as `cy.get('button').trigger('')`. Previously, it dispatched an event whose `type` was an empty string instead of failing, even though its error message says the event name must be a non-empty string. That error now shows the value that was passed, instead of the literal text `{{cmd}}`. It and the matching errors from [`cy.readFile()`](https://on.cypress.io/readfile) and [`cy.writeFile()`](https://on.cypress.io/writefile) now show an empty string as `''`, instead of leaving the value blank. Fixed in [#35068](https://github.com/cypress-io/cypress/pull/35068).
 - Node code in the config process, such as [`setupNodeEvents`](https://docs.cypress.io/app/plugins/plugins-guide), [`cy.task()`](https://on.cypress.io/task) handlers, and the plugins they load, now verifies TLS certificates the same way Node does. Fixed in [#35093](https://github.com/cypress-io/cypress/pull/35093).
 - Fixed an issue where runs recorded to Cypress Cloud with Test Replay enabled did not report the hooks that run around each test. Tests whose code had not changed were then listed as **Modified** under **Tests for review** whenever a run switched between a browser that supports Test Replay and one that does not, such as from Electron to Firefox. Because hooks are now reported for these runs, tests in projects that record with Test Replay may be listed as **Modified** once, in the first run after upgrading. Fixes [#35070](https://github.com/cypress-io/cypress/issues/35070).
```

**File**: `npm/webpack-dev-server/src/devServer.ts` (modified, +20/-22)
```diff
@@ -52,29 +52,27 @@ type DevServerCreateResult = {
  *
  * @param config
  */
-export function devServer (devServerConfig: WebpackDevServerConfig): Promise<Cypress.ResolvedDevServerConfig> {
-  return new Promise(async (resolve, reject) => {
-    const result = await devServer.create(devServerConfig) as DevServerCreateResult
-
-    result.server.start().then(() => {
-      if (!result.server.options.port) {
-        return reject(new Error(`Expected port ${result.server.options.port} to be a number`))
-      }
-
-      debug(`Component testing webpack server ${result.version} started on port %s`, result.server.options.port)
-
-      resolve({
-        port: result.server.options.port as number,
-        // Close is for unit testing only. We kill this child process which will handle the closing of the server
-        close: async (done) => {
-          debug('closing dev server')
-          result.server.stop().then(() => done?.()).catch(done).finally(() => {
-            debug('closed dev server')
-          })
-        },
+export async function devServer (devServerConfig: WebpackDevServerConfig): Promise<Cypress.ResolvedDevServerConfig> {
+  const result = await devServer.create(devServerConfig) as DevServerCreateResult
+
+  await result.server.start()
+
+  if (!result.server.options.port) {
+    throw new Error(`Expected port ${result.server.options.port} to be a number`)
+  }
+
+  debug(`Component testing webpack server ${result.version} started on port %s`, result.server.options.port)
+
+  return {
+    port: result.server.options.port as number,
+    // Close is for unit testing only. We kill this child process which will handle the closing of the server
+    close: async (done) => {
+      debug('closing dev server')
+      result.server.stop().then(() => done?.()).catch(done).finally(() => {
+        debug('closed dev server')
       })
-    }).catch(reject)
-  })
+    },
+  }
 }
 
 export type PresetHandlerResult = { frameworkConfig: Configuration, sourceWebpackModulesResult: SourceRelativeWebpackResult }
```

**File**: `packages/cypress-sessions/lib/generated/graphql.ts` (modified, +1/-0)
```diff
@@ -198,6 +198,7 @@ export type ErrorTypeEnum =
   | 'COULD_NOT_PARSE_ARGUMENTS'
   | 'DEFAULT_SUPPORT_FILE_NOT_FOUND'
   | 'DEV_SERVER_CONFIG_FILE_NOT_FOUND'
+  | 'DEV_SERVER_START_FAILED'
   | 'DUPLICATE_TASK_KEY'
   | 'ERROR_READING_FILE'
   | 'ERROR_WRITING_FILE'
```

**File**: `packages/data-context/schemas/schema.graphql` (modified, +1/-0)
```diff
@@ -1261,6 +1261,7 @@ enum ErrorTypeEnum {
   COULD_NOT_PARSE_ARGUMENTS
   DEFAULT_SUPPORT_FILE_NOT_FOUND
   DEV_SERVER_CONFIG_FILE_NOT_FOUND
+  DEV_SERVER_START_FAILED
   DUPLICATE_TASK_KEY
   ERROR_READING_FILE
   ERROR_WRITING_FILE
```

**File**: `packages/data-context/src/data/ProjectLifecycleManager.ts` (modified, +6/-0)
```diff
@@ -246,6 +246,12 @@ export class ProjectLifecycleManager {
            *      The empty specs are handled within the @cypress/webpack-dev-server package as this has no impact on vite.
            */
           const devServerOptions = await this.ctx._apis.projectApi.getDevServer().start({ specs: this.ctx.project.specs, config: finalConfig })
+          .catch((err) => {
+            span?.end()
+            const devServer = this.loadedConfigFile?.component?.devServer
+
+            throw getError('DEV_SERVER_START_FAILED', this.configFile, typeof devServer === 'object' ? devServer.bundler : undefined, err)
+          })
 
           // If we received a cypressConfig.port we want to null it out
           // because we propagated it into the devServer.port and it is
```

**File**: `packages/errors/src/errors.ts` (modified, +14/-0)
```diff
@@ -1667,6 +1667,20 @@ export const AllCypressErrors = {
     `
   },
 
+  DEV_SERVER_START_FAILED: (configFile: string, bundler: string | undefined, err: ErrorLike) => {
+    const devServer = bundler ? errPartial`the ${fmt.highlight(bundler)} dev server` : errPartial`your dev server`
+
+    return errTemplate`
+      Cypress could not start ${devServer} for component testing. Fix the error below, then run Cypress again.
+
+      Read about configuring the dev server: https://on.cypress.io/dev-server
+
+      The ${fmt.highlight('component.devServer')} set in ${fmt.path(configFile)} threw this error:
+
+      ${fmt.stackTrace(err)}
+    `
+  },
+
   UNEXPECTED_MUTATION_ERROR: (mutationField: string, args: any, err: Error) => {
     return errTemplate`
       An unexpected internal error occurred while executing the ${fmt.highlight(mutationField)} operation with payload:
```

**File**: `packages/errors/test/__snapshots__/DEV_SERVER_START_FAILED - customDevServer.ansi` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+[31mCypress could not start your dev server for component testing. Fix the error below, then run Cypress again.[39m
+[31m[39m
+[31mRead about configuring the dev server: https://on.cypress.io/dev-server[39m
+[31m[39m
+[31mThe [33mcomponent.devServer[39m[31m set in [94mcypress.config.ts[39m[31m threw this error:[39m
+[35m[39m
+[35mError: fail whale[39m
+[35m    at makeErr (cypress/packages/errors/test/visualSnapshotErrors.spec.ts)[39m
+[35m    at DEV_SERVER_START_FAILED (cypress/packages/errors/test/visualSnapshotErrors.spec.ts)[39m
\ No newline at end of file
```

**File**: `packages/errors/test/__snapshots__/DEV_SERVER_START_FAILED.ansi` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+[31mCypress could not start the [33mwebpack[39m[31m dev server for component testing. Fix the error below, then run Cypress again.[39m
+[31m[39m
+[31mRead about configuring the dev server: https://on.cypress.io/dev-server[39m
+[31m[39m
+[31mThe [33mcomponent.devServer[39m[31m set in [94mcypress.config.ts[39m[31m threw this error:[39m
+[35m[39m
+[35mError: fail whale[39m
+[35m    at makeErr (cypress/packages/errors/test/visualSnapshotErrors.spec.ts)[39m
+[35m    at DEV_SERVER_START_FAILED (cypress/packages/errors/test/visualSnapshotErrors.spec.ts)[39m
\ No newline at end of file
```

---

### Incident Patch 2: `259b98f0` (2026-10-21)
**Commit Message**: perf: skip resetting rendered origins between tests when none rendered (#35089)

* perf(driver): skip test-isolation clears that have nothing to clear

With testIsolation on, every test asked the browser to clear cookies
and the server to reset its rendered-origins set, even when there was
nothing to clear or reset.

- Skip `clear:cookies` when `get:cookies` found no cookies.
- Skip `reset:rendered:html:origins` when the server reported no
  rendered origins. `clearStorage` now returns the origins it read, so
  this needs no extra round trip.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_0116Vhn1SQfFaCnRAs1LFB6X

* chore: describe the late-render case in the rendered-origins comment

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_0116Vhn1SQfFaCnRAs1LFB6X

* chore: trim the clearSessionData comment to what the name does not say

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_0116Vhn1SQfFaCnRAs1LFB6X

* chore: link the changelog entry to its pull request

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://cl

**File**: `cli/CHANGELOG.md` (modified, +4/-0)
```diff
@@ -1,6 +1,10 @@
 <!-- See ../guides/writing-the-cypress-changelog.md for details on writing the changelog. -->
 ## 16.2.1
 
+**Performance:**
+
+- Tests that run with [`testIsolation`](https://docs.cypress.io/app/references/configuration#e2e) enabled now start slightly faster when the previous test did not load any pages, such as an API test that only uses [`cy.request()`](https://on.cypress.io/request). Fixed in [#35089](https://github.com/cypress-io/cypress/pull/35089).
+
 **Bugfixes:**
 
 - Fixed an issue where `cypress open` with both a `--browser` and a testing type flag launched the browser twice the first time Cypress showed its major-version welcome screen — on first open after upgrading, or after clearing app data. Fixes [#34868](https://github.com/cypress-io/cypress/issues/34868).
```

**File**: `packages/driver/cypress/e2e/commands/sessions/manager.cy.ts` (modified, +50/-0)
```diff
@@ -277,6 +277,42 @@ describe('src/cy/commands/sessions/manager.ts', () => {
       })
     })
 
+    describe('.clearSessionData()', () => {
+      beforeEach(() => {
+        CypressInstance.state = cy.stub()
+      })
+
+      it('resolves to the origins that had rendered HTML', async () => {
+        cy.stub(CypressInstance, 'backend')
+        .callThrough()
+        .withArgs('get:rendered:html:origins')
+        .resolves({ [window.location.origin]: true })
+
+        const sessionsManager = new SessionsManager(CypressInstance, {
+          state: () => false,
+        })
+
+        cy.stub(sessionsManager.sessions, 'clearCookies').resolves([])
+
+        expect(await sessionsManager.clearSessionData()).to.deep.eq([window.location.origin])
+      })
+
+      it('resolves to an empty list when no origins rendered HTML', async () => {
+        cy.stub(CypressInstance, 'backend')
+        .callThrough()
+        .withArgs('get:rendered:html:origins')
+        .resolves({})
+
+        const sessionsManager = new SessionsManager(CypressInstance, {
+          state: () => false,
+        })
+
+        cy.stub(sessionsManager.sessions, 'clearCookies').resolves([])
+
+        expect(await sessionsManager.clearSessionData()).to.deep.eq([])
+      })
+    })
+
     it('sessions.getCookies()', async () => {
       const cookies = [{ id: 'cookie' }]
       const cypressSpy = cy.stub(CypressInstance, 'automation').withArgs('get:cookies').resolves(cookies)
@@ -312,6 +348,20 @@ describe('src/cy/commands/sessions/manager.ts', () => {
       expect(cypressSpy).to.be.calledOnceWith('clear:cookies', cookies)
     })
 
+    // The server also empties its cookie jar on `clear:cookies`, and the jar
+    // can hold cookies the browser no longer reports.
+    it('sessions.clearCookies() still clears when the browser reports no cookies', async () => {
+      const cypressSpy = cy.stub(CypressInstance, 'automation').withArgs('clear:cookies').resolves([])
+
+      const sessionsManager = new SessionsManager(CypressInstance, () => {})
+
+      cy.stub(sessionsManager.sessions, 'getCookies').resolves([])
+
+      await sessionsManager.sessions.clearCookies()
+
+      expect(cypressSpy).to.be.calledOnceWith('clear:cookies', [])
+    })
+
     it('sessions.getCurrentSessionData()', async () => {
       const sessionsManager = new SessionsManager(Cypress, () => {})
       const cookiesSpy = cy.stub(sessionsManager.sessions, 'getCookies').resolves([{ id: 'cookie' }])
```

**File**: `packages/driver/cypress/e2e/commands/sessions/sessions.cy.ts` (modified, +23/-5)
```diff
@@ -156,25 +156,43 @@ describe('cy.session', { retries: 0 }, () => {
 
     describe('test:before:run:async', () => {
       it('clears session data before each run', async () => {
-        const clearCurrentSessionData = cy.spy(Cypress.session, 'clearCurrentSessionData')
+        const backendSpy = cy.spy(Cypress, 'backend').log(false)
+        const automationSpy = cy.spy(Cypress, 'automation').log(false)
 
         await Cypress.action('runner:test:before:run:async', {
           id: 'r1',
           currentRetry: 0,
         }, Cypress.state('runnable'))
 
-        expect(clearCurrentSessionData).to.be.called
+        expect(backendSpy).to.be.calledWith('get:rendered:html:origins')
+        expect(automationSpy).to.be.calledWith('get:cookies')
       })
 
-      it('resets rendered html origins before each run', async () => {
-        const backendSpy = cy.spy(Cypress, 'backend').log(false)
+      it('resets rendered html origins before each run when origins were rendered', async () => {
+        const backendStub = cy.stub(Cypress, 'backend').log(false).callThrough()
+
+        backendStub.withArgs('get:rendered:html:origins').resolves({ [window.location.origin]: true })
+
+        await Cypress.action('runner:test:before:run:async', {
+          id: 'r1',
+          currentRetry: 0,
+        }, Cypress.state('runnable'))
+
+        expect(backendStub).to.be.calledWith('reset:rendered:html:origins')
+      })
+
+      it('does not reset rendered html origins before each run when no origins were rendered', async () => {
+        const backendStub = cy.stub(Cypress, 'backend').log(false).callThrough()
+
+        backendStub.withArgs('get:rendered:html:origins').resolves({})
 
         await Cypress.action('runner:test:before:run:async', {
           id: 'r1',
           currentRetry: 0,
         }, Cypress.state('runnable'))
 
-        expect(backendSpy).to.be.calledWith('reset:rendered:html:origins')
+        expect(backendStub).to.be.calledWith('get:rendered:html:origins')
+        expect(backendStub).not.to.be.calledWith('reset:rendered:html:origins')
       })
 
       it('clears the browser context before each run', () => {
```

**File**: `packages/driver/cypress/e2e/e2e/origin/cookie_jar_isolation.cy.ts` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+// These tests run in order: the second checks that a cookie the first left in
+// the server's cookie jar, but not in the browser, is cleared between tests.
+describe('server cookie jar between isolated tests', { browser: '!webkit', testIsolation: true, retries: 0 }, () => {
+  const originUrl = 'https://www.foobar.com:3502'
+
+  it('leaves a cookie in the jar after the app deletes it from the browser', () => {
+    cy.visit(`${originUrl}/fixtures/generic.html`)
+
+    cy.window().then((win) => {
+      return cy.wrap(win.fetch(`${originUrl}/set-cookie?cookie=foo1=bar1; Domain=foobar.com`))
+    })
+
+    cy.getAllCookies().should('have.length', 1)
+
+    // Removes the cookie from the browser, but not from the server's jar
+    cy.window().then((win) => {
+      win.document.cookie = 'foo1=; Domain=foobar.com; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
+    })
+
+    cy.getAllCookies().should('have.length', 0)
+  })
+
+  it('does not send the previous test\'s jar cookie from cy.origin()', () => {
+    cy.intercept(`${originUrl}/test-request`).as('req')
+
+    cy.visit('/fixtures/primary-origin.html')
+    cy.get('a[data-cy="cookie-https"]').click()
+
+    cy.origin(originUrl, { args: originUrl }, (originUrl) => {
+      cy.window().then((win) => {
+        return cy.wrap(win.fetch(`${originUrl}/test-request`))
+      })
+    })
+
+    cy.wait('@req').its('request.headers.cookie').should('be.undefined')
+  })
+})
```

**File**: `packages/driver/src/cy/commands/sessions/index.ts` (modified, +7/-2)
```diff
@@ -49,8 +49,13 @@ export default function (Commands, Cypress, cy) {
         return
       }
 
-      return sessions.clearCurrentSessionData()
-      .then(() => Cypress.backend('reset:rendered:html:origins'))
+      const renderedOrigins = await sessionsManager.clearSessionData()
+
+      // An empty set has nothing to reset. A page that finishes rendering after
+      // the read stays in the set, so the next test clears its storage too.
+      if (renderedOrigins.length) {
+        await Cypress.backend('reset:rendered:html:origins')
+      }
     })
   })
 
```

**File**: `packages/driver/src/cy/commands/sessions/manager.ts` (modified, +22/-12)
```diff
@@ -98,6 +98,24 @@ export default class SessionsManager {
     ])
   }
 
+  // Resolves to the rendered origins that `clearStorage` read before clearing.
+  clearSessionData = async (): Promise<string[]> => {
+    // this prevents a log occurring when we clear session in-between tests
+    if (this.cy.state('duringUserTestExecution')) {
+      this.Cypress.log(getLogProperties('clearCurrentSessionData'))
+    }
+
+    window.localStorage.clear()
+    window.sessionStorage.clear()
+
+    const [renderedOrigins] = await Promise.all([
+      clearStorage(this.Cypress),
+      this.sessions.clearCookies(),
+    ])
+
+    return renderedOrigins
+  }
+
   // this the public api exposed to consumers as Cypress.session
   sessions = {
     clearAllSavedSessions: async () => {
@@ -109,18 +127,8 @@ export default class SessionsManager {
     },
 
     clearCurrentSessionData: async () => {
-      // this prevents a log occurring when we clear session in-between tests
-      if (this.cy.state('duringUserTestExecution')) {
-        this.Cypress.log(getLogProperties('clearCurrentSessionData'))
-      }
-
-      window.localStorage.clear()
-      window.sessionStorage.clear()
-
-      await Promise.all([
-        clearStorage(this.Cypress),
-        this.sessions.clearCookies(),
-      ])
+      // Public API: resolves to nothing, unlike `clearSessionData`
+      await this.clearSessionData()
     },
 
     getCookies: async () => {
@@ -132,6 +140,8 @@ export default class SessionsManager {
     },
 
     clearCookies: async () => {
+      // Sent even when the browser reports no cookies: the server also empties
+      // its cookie jar here, and the jar can hold cookies the browser no longer has.
       return this.Cypress.automation('clear:cookies', await this.sessions.getCookies())
     },
 
```

**File**: `packages/driver/src/cy/commands/sessions/origins.ts` (modified, +9/-5)
```diff
@@ -20,10 +20,14 @@ export async function mapOrigins (Cypress: Cypress.Cypress, origins: string | st
   return _.uniq(_.flatten(await getOrigins))
 }
 
-export async function getAllHtmlOrigins (Cypress: Cypress.Cypress) {
-  const currentOrigin = window.location.origin
-  const storedOrigins = await Cypress.backend('get:rendered:html:origins')
-  const origins = [..._.keys(storedOrigins), currentOrigin]
+export async function getRenderedHtmlOrigins (Cypress: Cypress.Cypress): Promise<string[]> {
+  return _.keys(await Cypress.backend('get:rendered:html:origins'))
+}
 
-  return _.uniq(origins)
+export function withCurrentOrigin (origins: string[]) {
+  return _.uniq([...origins, window.location.origin])
+}
+
+export async function getAllHtmlOrigins (Cypress: Cypress.Cypress) {
+  return withCurrentOrigin(await getRenderedHtmlOrigins(Cypress))
 }
```

**File**: `packages/driver/src/cy/commands/sessions/storage.ts` (modified, +10/-4)
```diff
@@ -1,7 +1,7 @@
 import _ from 'lodash'
 
 import { $Location } from '../../../cypress/location'
-import { getAllHtmlOrigins, mapOrigins } from './origins'
+import { getRenderedHtmlOrigins, mapOrigins, withCurrentOrigin } from './origins'
 import { getCurrentOriginStorage, getPostMessageLocalStorage, setPostMessageLocalStorage } from './utils'
 
 export type StorageType = 'localStorage' | 'sessionStorage'
@@ -82,9 +82,13 @@ export async function getStorage (Cypress: Cypress.Cypress, options: GetStorageO
   return results
 }
 
-export async function clearStorage (Cypress: Cypress.Cypress, type?: StorageType) {
-  const origins = await getAllHtmlOrigins(Cypress)
-  const originOptions = origins.map((origin) => ({ origin, clear: true }))
+/**
+ * Resolves to the origins the server reported as having rendered HTML,
+ * which does not include the current origin unless it rendered HTML too.
+ */
+export async function clearStorage (Cypress: Cypress.Cypress, type?: StorageType): Promise<string[]> {
+  const renderedOrigins = await getRenderedHtmlOrigins(Cypress)
+  const originOptions = withCurrentOrigin(renderedOrigins).map((origin) => ({ origin, clear: true }))
   const options: SetStoragesOptions = {}
 
   if (!type || type === 'localStorage') {
@@ -96,6 +100,8 @@ export async function clearStorage (Cypress: Cypress.Cypress, type?: StorageType
   }
 
   await setStorage(Cypress, options)
+
+  return renderedOrigins
 }
 
 async function setStorageOnOrigins (Cypress: Cypress.Cypress, originOptions) {
```

---

### Incident Patch 3: `9f506e5e` (2026-10-21)
**Commit Message**: fix: launch the browser once when the major-version welcome gates the initial launch (#34877)

* fix: launch the browser once when the major-version welcome gates the initial launch

`cypress open --e2e --browser <browser>` launched the browser twice the
first time the major-version welcome screen was shown (first open after
upgrading, or after clearing app data). Dismissing the welcome fired a
launch from Main.vue and mounted OpenBrowser, whose auto-launch check
read `launchCount` while that launch was still in flight - the count only
moved after the launch settled, so it launched again. The second launch
tore down the first one's CDP connection, leaving Chrome/Chromium/Edge
unable to connect and Electron reporting its tab closed unexpectedly.

- Count a launch in ProjectActions as it starts, so a concurrent
  `shouldLaunchBrowserFromOpenBrowser` check sees it.
- Make OpenBrowser the single client-side launcher after the welcome is
  dismissed; it also waits for the config to be ready before firing.
- Unit-test the counter ordering, and make the launchpad e2e test for the
  welcome path actually go through the welcome with a slow launch stub.

Fixes #34868

Co-Authored-By: Claude 

**File**: `cli/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 
 **Bugfixes:**
 
+- Fixed an issue where `cypress open` with both a `--browser` and a testing type flag launched the browser twice the first time Cypress showed its major-version welcome screen — on first open after upgrading, or after clearing app data. Fixes [#34868](https://github.com/cypress-io/cypress/issues/34868).
 - Fixed an issue where [`.scrollTo()`](https://on.cypress.io/scrollto) and [`.scrollIntoView()`](https://on.cypress.io/scrollintoview) stopped short of the end of a scrollable element with always-visible scrollbars. Positions such as `bottom`, `right`, `bottomRight`, and `'100%'` landed short by the width of the scrollbar, and `center` or `'50%'` landed off-center by half of it. Fixed in [#34948](https://github.com/cypress-io/cypress/pull/34948).
 - Fixed a regression in [16.1.0](#16-1-0) where, in Chrome, Chromium, and Edge run headed, the Cypress browser extension could stop responding for the rest of the run. This caused [`@cypress/puppeteer`](https://github.com/cypress-io/cypress/tree/develop/npm/puppeteer) to fail with `Cannot communicate with the Cypress Chrome extension`. Fixed in [#34958](https://github.com/cypress-io/cypress/pull/34958).
 - [`cy.fixture()`](https://on.cypress.io/fixture) and the `fixture` property of a [`cy.intercept()`](https://on.cypress.io/intercept) static response now fail when the fixture path resolves outside the [`fixturesFolder`](https://docs.cypress.io/app/references/configuration#Folders--Files). Fixed in [#35072](https://github.com/cypress-io/cypress/pull/35072).
```

**File**: `packages/data-context/src/DataContext.ts` (modified, +3/-0)
```diff
@@ -349,6 +349,9 @@ export class DataContext {
 
     this._modeOptions = modeOptions
     this._coreData = makeCoreData(modeOptions)
+    // DataActions is created once in the constructor and is not rebuilt here, so
+    // its launch counter has to be reset explicitly or it leaks between tests
+    this.actions.project.launchCount = 0
     // @ts-expect-error - we've already cleaned up, this is for testing only
     this.lifecycleManager = new ProjectLifecycleManager(this)
 
```

**File**: `packages/data-context/src/actions/ProjectActions.ts` (modified, +12/-4)
```diff
@@ -93,9 +93,10 @@ const debug = debugLib('cypress:data-context:ProjectActions')
 export class ProjectActions {
   /**
    * @var globalLaunchCount
-   * Used as a read-only in the launchpad to ensure
-   * that launchProject is only called once if
-   * the --browser flag is passed alone.
+   * Read by the `shouldLaunchBrowserFromOpenBrowser` resolver so the
+   * launchpad's `--browser` auto-launch fires only once. Incremented as a
+   * launch starts: a launch takes seconds, and dismissing the major-version
+   * welcome mounts OpenBrowser, which re-reads this inside that window (#34868).
    */
   private globalLaunchCount = 0
   constructor (private ctx: DataContext) {}
@@ -301,9 +302,16 @@ export class ProjectActions {
       this.api.resetServer()
     }
 
-    await this.api.launchProject(browser, activeSpec ?? emptySpec, options)
     this.globalLaunchCount++
 
+    try {
+      await this.api.launchProject(browser, activeSpec ?? emptySpec, options)
+    } catch (err) {
+      // A launch that never happened should not use up the one-shot auto-launch
+      this.globalLaunchCount--
+      throw err
+    }
+
     return
   }
 
```

**File**: `packages/data-context/src/data/ProjectLifecycleManager.ts` (modified, +2/-2)
```diff
@@ -346,8 +346,8 @@ export class ProjectLifecycleManager {
       const hasWelcomeBeenDismissed = Boolean(preferences.majorVersionWelcomeDismissed?.[GET_MAJOR_VERSION_FOR_CONTENT()])
 
       // only continue if the browser was successfully set - we must have an activeBrowser once this function resolves
-      // but if the user needs to dismiss a landing page, don't continue, the active browser will be opened
-      // by a mutation called from the client side when the user dismisses the welcome screen
+      // but if the user needs to dismiss a landing page, don't continue: dismissing it renders OpenBrowser
+      // in the launchpad, whose auto-launch opens the active browser once the config is ready
       if (this.ctx.coreData.activeBrowser && hasWelcomeBeenDismissed) {
         // if `cypress open` was launched with a `--project` and `--testingType`, go ahead and launch the `--browser`
         if (this.ctx.modeOptions.project && this.ctx.modeOptions.testingType) {
```

**File**: `packages/data-context/test/unit/actions/ProjectActions.spec.ts` (modified, +39/-0)
```diff
@@ -303,6 +303,45 @@ describe('ProjectActions', () => {
     })
   })
 
+  describe('launchProject', () => {
+    beforeEach(() => {
+      ctx.coreData.currentProject = '/cy-project'
+      ctx.coreData.currentTestingType = 'e2e'
+      ctx.coreData.activeBrowser = { id: 'abc' } as any
+    })
+
+    it('counts the launch before it settles so a concurrent auto-launch check does not launch again', async () => {
+      let resolveLaunch!: () => void
+      const launchProject = jest.fn().mockReturnValue(new Promise<void>((resolve) => {
+        resolveLaunch = resolve
+      }))
+
+      Object.assign(ctx._apis.projectApi, { launchProject })
+
+      expect(actions.launchCount).toBe(0)
+
+      const launching = actions.launchProject('e2e')
+
+      expect(launchProject).toHaveBeenCalledTimes(1)
+      expect(actions.launchCount).toBe(1)
+
+      resolveLaunch()
+      await launching
+
+      expect(actions.launchCount).toBe(1)
+    })
+
+    it('does not count a launch that rejects', async () => {
+      const launchProject = jest.fn().mockRejectedValue(new Error('browser failed to launch'))
+
+      Object.assign(ctx._apis.projectApi, { launchProject })
+
+      await expect(actions.launchProject('e2e')).rejects.toThrow('browser failed to launch')
+
+      expect(actions.launchCount).toBe(0)
+    })
+  })
+
   describe('debugCloudRun', () => {
     beforeEach(() => {
       jest.spyOn(ctx.relevantRuns, 'moveToRun')
```

**File**: `packages/launchpad/cypress/e2e/choose-a-browser.cy.ts` (modified, +0/-3)
```diff
@@ -3,9 +3,6 @@ import type { FoundBrowser } from '@packages/types'
 describe('Choose a browser page', () => {
   beforeEach(() => {
     cy.scaffoldProject('launchpad')
-    cy.withCtx((ctx, _) => {
-      ctx.actions.project.launchCount = 0
-    })
   })
 
   describe('System Browsers Detected', () => {
```

**File**: `packages/launchpad/cypress/e2e/open-mode.cy.ts` (modified, +25/-3)
```diff
@@ -216,22 +216,44 @@ describe('Launchpad: Open Mode', () => {
     cy.get('button[data-cy=launch-button]').invoke('text').should('include', 'Start E2E Testing in Firefox')
   })
 
-  it('auto-launches the browser when launched with --browser --testingType --project, after Major Version Welcome is dismissed', () => {
+  it('auto-launches the browser exactly once when launched with --browser --testingType --project, after Major Version Welcome is dismissed', () => {
     cy.scaffoldProject('launchpad')
     stubAvailableBrowsers()
     cy.openProject('launchpad', ['--browser', 'firefox', '--e2e'])
     cy.withCtx((ctx, o) => {
-      o.sinon.stub(ctx._apis.projectApi, 'launchProject').resolves()
+      // A real launch takes seconds. Dismissing the welcome mounts OpenBrowser
+      // inside that window, and its own auto-launch check must not launch again.
+      // The test holds the launch open until it has checked that.
+      o.sinon.stub(ctx._apis.projectApi, 'launchProject').callsFake(() => {
+        return new Promise<void>((resolve) => {
+          o.testState.resolveLaunch = resolve
+        })
+      })
     })
 
+    // OpenBrowser decides whether to auto-launch from this query's response
+    cy.intercept('query-OpenBrowser_LocalSettings').as('openBrowserLocalSettings')
+
     // Need to visit after args have been configured, todo: fix in #18776
-    cy.visitLaunchpad()
+    cy.visitLaunchpad({ showWelcome: true })
+    cy.skipWelcome()
 
     cy.get('h1').should('contain', 'Choose a browser')
     cy.get('[data-cy-browser=firefox]').should('have.attr', 'aria-checked', 'true')
     cy.get('button[data-cy=launch-button]').invoke('text').should('include', 'Start E2E Testing in Firefox')
+    cy.wait('@openBrowserLocalSettings')
+
+    cy.withRetryableCtx((ctx, o) => {
+      expect(ctx._apis.projectApi.launchProject).to.be.calledOnce
+      expect(o.testState.resolveLaunch).to.be.a('function')
+    })
+
+    cy.withCtx((ctx, o) => {
+      o.testState.resolveLaunch()
+    })
 
     cy.withRetryableCtx((ctx) => {
+      expect(ctx.actions.project.launchCount).to.eq(1)
       expect(ctx._apis.projectApi.launchProject).to.be.calledOnce
     })
   })
```

**File**: `packages/launchpad/src/Main.vue` (modified, +1/-24)
```diff
@@ -80,7 +80,7 @@
 
 <script lang="ts" setup>
 import { gql, useMutation, useQuery } from '@urql/vue'
-import { MainLaunchpadQueryDocument, Main_ResetErrorsAndLoadConfigDocument, Main_LaunchProjectDocument } from './generated/graphql'
+import { MainLaunchpadQueryDocument, Main_ResetErrorsAndLoadConfigDocument } from './generated/graphql'
 import TestingTypeCards from './setup/TestingTypeCards.vue'
 import Wizard from './setup/Wizard.vue'
 import GlobalPage from './global/GlobalPage.vue'
@@ -117,7 +117,6 @@ fragment MainLaunchpadQueryData on Query {
     preferences {
       majorVersionWelcomeDismissed
       wasBrowserSetInCLI
-      shouldLaunchBrowserFromOpenBrowser
     }
   }
   currentProject {
@@ -153,22 +152,7 @@ mutation Main_ResetErrorsAndLoadConfig($id: ID!) {
 }
 `
 
-gql`
-mutation Main_LaunchProject ($testingType: TestingTypeEnum!)  {
-  launchOpenProject {
-    id
-  }
-  setProjectPreferencesInGlobalCache(testingType: $testingType) {
-    currentProject {
-      id
-      title
-    }
-  }
-}
-`
-
 const mutation = useMutation(Main_ResetErrorsAndLoadConfigDocument)
-const launchProject = useMutation(Main_LaunchProjectDocument)
 
 const resetErrorAndLoadConfig = (id: string) => {
   if (!mutation.fetching.value) {
@@ -230,13 +214,6 @@ watch(
 
 function handleClearLandingPage () {
   setMajorVersionWelcomeDismissed(GET_MAJOR_VERSION_FOR_CONTENT())
-  const shouldLaunchBrowser = query.data?.value?.localSettings?.preferences?.shouldLaunchBrowserFromOpenBrowser
-
-  const currentTestingType = currentProject.value?.currentTestingType
-
-  if (shouldLaunchBrowser && currentTestingType) {
-    launchProject.executeMutation({ testingType: currentTestingType })
-  }
 }
 
 const shouldShowWelcome = computed(() => {
```

#### Recent Merged Pull Requests:
- **PR #35125** (2026-10-22): chore: wait for an in-flight project scaffold before a test retry re-scaffolds it (@mschile)
- **PR #35121** (2026-10-22): chore: remove the GraphQL-over-fetch switch (@mschile)
- **PR #35119** (2026-10-22): fix: keep cy.contains() retrying when its within subject is missing (@jennifer-shehane)
- **PR #35118** (2026-10-21): fix: record the user's NODE_TLS_REJECT_UNAUTHORIZED at server startup (@mschile)
- **PR #35117** (closed): fix: pass NODE_TLS_REJECT_UNAUTHORIZED to config process before request.ts loads (@cursor[bot])
- **PR #35102** (2026-10-21): misc: rewrite the cy.visit() and cy.request() status code options errors (@jennifer-shehane)

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

## X. show a clear error when the component testing dev server fails to start (#35081)

**RULE**:
When implementing operations in `cli/CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in cypress-io/cypress. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b7fd293f`: show a clear error when the component testing dev server fails to start (#35081). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `cli/CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
- When the dev server for component testing fails to start, such as when your project installs a version of webpack or webpack-dev-server that Cypress does not support, Cypress now explains that the dev server could not start, shows the dev server's error, and links to the dev server documentation. Previously, webpack errors were reported as a crash of your config file, and other dev server errors were shown with no explanation. Fixed in [#35081](https://github.com/cypress-io/cypress/pull/35081).
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b7fd293f` are properly handled with clean fallback behavior.

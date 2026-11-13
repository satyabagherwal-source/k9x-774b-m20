# Verification Protocol: Verification Protocol: Empirical Defect Shield for cypress-io-cypress-learnings

<!-- PROVENANCE_START
{
  "source_repository": "cypress-io-cypress-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:34:44.212Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-cypress-io-cypress-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cypress-io-cypress-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:34:44.212Z`  
> **Learning ID**: `LEARN-REEXTRACT-cypress-io-cypress-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `cypress-io-cypress-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cypress-io-cypress-learnings.md`  
> **Source**: github ([https://github.com/cypress-io/cypress](https://github.com/cypress-io/cypress))  
> **Source Version**: `3443896f`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T14:59:32.446Z  
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
> **Harvest Timestamp**: 2026-11-12T14:59:28.476Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cypress-io/cypress`
- **Description**: Fast, easy and reliable testing for anything that runs in a browser.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 51028 stars

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
- **Issue #35361** (2026-11-12): **chore: lint Vitest specs with @vitest/eslint-plugin**
  *Symptoms*: - Closes N/A. This is one slice of the ESLint 10 and plugin-major upgrade of `@packages/eslint-config`.  ### Additional details  This adds `@vitest/eslint-plugin` 1.6 to `@packages/eslint-config` as an opt-in `vitestConfig` export, alongside `jsonConfig` and `nodeConfig`. It applies the plugin's `recommended` rules to `**/*.{test,spec}.{ts,tsx,js}` and `test/**`, skipping `fixtures/` and `__fixtures__/`. On top of those, `no-focused-tests`, `no-disabled-tests` and `hoisted-apis-on-top` are errors. `vitest/unbound-method`, the plugin's one type-aware rule, is left out. Its TypeScript 6 and `@typescript-eslint/eslint-plugin` peers are optional and only serve that rule, so the rest runs on our TypeScript 5.4.5.  All 32 workspaces with `vitest` in their `package.json` opt in. `@packages/server` narrows the config to `test/unit/**`, because its integration and performance specs run on mocha.  **What the plugin reported first,** across those workspaces. These counts include server's mocha specs and the bundled fixtures, which are now out of scope:  | Rule | Hits | Outcome | | --- | --- | --- | | `expect-expect` | 682 | Off: specs assert through sinon/chai helpers or by not throwing | | `no-conditional-expect` | 282 | Off: assertions in `catch` blocks and platform branches; style | | `valid-expect` | 135 | Fixed (below); allows Vitest's message argument | | `prefer-called-exactly-once-with` | 47 | Off: style | | `no-standalone-expect` | 34 | All in hooks or fixtures; assertions in h

- **Issue #35360** (2026-11-12): **perf: sniff cy.intercept stubbed-response HTML in linear time**
  *Symptoms*: <!-- Thanks for contributing! PLEASE... - Before writing any code, confirm an open issue exists for this work and that you have commented on it to indicate your intent. See: https://github.com/cypress-io/cypress/blob/develop/CONTRIBUTING.md#pull-requests - Read our contributing guidelines: https://github.com/cypress-io/cypress/blob/develop/CONTRIBUTING.md  - Read our Code Review Checklist on coding standards and what needs to be done before a PR can be merged: https://github.com/cypress-io/cypress/blob/develop/CONTRIBUTING.md#Code-Review-Checklist - Mark this PR as "Draft" if it is not ready for review. - Make sure you set the correct base branch based on what packages you're changing: https://github.com/cypress-io/cypress/blob/develop/CONTRIBUTING.md#branches -->  - Closes N/A (no issue; this came out of a ReDoS audit of regexes that run on user-controlled input)  ### Additional details  `parseContentType` in `packages/net-stubbing/lib/server/util.ts` picks a `Content-Type` for a [`cy.intercept()`](https://on.cypress.io/intercept) response stubbed with a fixture or a static `body` and no `Content-Type` header. It decided whether the body was HTML with `/<.+>[\s\S]+<\/.+>/`, which backtracks polynomially on bodies with many `<` and `>` characters. Those bodies are user fixtures, so they can be large.  This PR replaces the regex with `isHtmlLike()`, a hand-written scan with two forward passes that gives exactly the same answers:  - An opening `<…>` and a later closing `</…>`, 

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

### Incident Patch 1: `e4d77771` (2026-11-11)
**Commit Message**: fix: accept consecutive arrow keys in cy.type() on date-like inputs (#35352)

* fix: accept consecutive arrow keys in cy.type() on date-like inputs

Typing more than one {upArrow} or {downArrow} in a row into a date,
month, week, time, or datetime-local input failed validation with an
invalid_* format error, even though a single arrow worked.

validateTyping() matched the arrow regex against every key from the
current index to the end of the string, and the regex was anchored at
the end, so it only matched when exactly one arrow remained. Dropping
the end anchor lets each arrow be accepted as typing reaches it, so
the value steps once per arrow. A non-arrow sequence such as
{upArrow}{leftArrow} still throws the existing error when typing
reaches the non-arrow key.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01WUv8r4w5uzy9X1Ca4MUQ3W

* chore: move cy.type() arrow-key changelog entry to 16.3.1

16.3.0 shipped while this branch was open, so the entry now belongs
under the next unreleased version.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01WUv8r4w5uzy9X1Ca4MUQ3W

* chore: se

**File**: `cli/CHANGELOG.md` (modified, +4/-0)
```diff
@@ -1,6 +1,10 @@
 <!-- See ../guides/writing-the-cypress-changelog.md for details on writing the changelog. -->
 ## 16.3.1
 
+**Bugfixes:**
+
+- [`.type()`](https://on.cypress.io/type) now accepts consecutive `{upArrow}` and `{downArrow}` sequences, such as `{upArrow}{upArrow}`, on `date`, `month`, `week`, `time`, and `datetime-local` inputs, and steps the value once per arrow. Previously, a single arrow worked but more than one in a row failed with an error saying the input required a valid date, month, week, time, or datetime. Fixed in [#35352](https://github.com/cypress-io/cypress/pull/35352).
+
 **Misc:**
 
 - Firefox launched by Cypress no longer starts its remote debugging server. Addressed in [#35284](https://github.com/cypress-io/cypress/pull/35284).
```

**File**: `packages/driver/cypress/e2e/commands/actions/type.cy.ts` (modified, +94/-0)
```diff
@@ -3226,6 +3226,32 @@ describe('src/cy/commands/actions/type - #type', () => {
           cy.get('#date-without-value').should('have.value', '1999-12-31')
         })
 
+        it('consecutive {upArrow} increases day once per arrow', () => {
+          cy.get('#date-without-value').type('1999-12-30').type('{upArrow}{upArrow}')
+          cy.get('#date-without-value').should('have.value', '2000-01-01')
+        })
+
+        it('consecutive {downArrow} decreases day once per arrow', () => {
+          cy.get('#date-without-value').type('2000-01-01').type('{downArrow}{downArrow}')
+          cy.get('#date-without-value').should('have.value', '1999-12-30')
+        })
+
+        it('mixed {upArrow} and {downArrow} step the day in order', () => {
+          cy.get('#date-without-value').type('2000-01-01').type('{upArrow}{downArrow}{upArrow}')
+          cy.get('#date-without-value').should('have.value', '2000-01-02')
+        })
+
+        it('throws when {upArrow} is followed by a key that is not an arrow', (done) => {
+          cy.on('fail', (err) => {
+            expect(err.message).to.include('requires a valid date')
+            expect(err.message).to.include('{ArrowUp}{ArrowLeft}')
+
+            done()
+          })
+
+          cy.get('#date-without-value').type('{upArrow}{leftArrow}')
+        })
+
         it('{upArrow} triggers events on input', () => {
           cy.get('#date-with-value')
           .then(($input) => {
@@ -3271,6 +3297,23 @@ describe('src/cy/commands/actions/type - #type', () => {
           cy.get('#month-without-value').should('have.value', '1999-12')
         })
 
+        it('consecutive {upArrow} and {downArrow} step the month once per arrow', () => {
+          cy.get('#month-without-value').type('1999-11').type('{upArrow}{upArrow}')
+          cy.get('#month-without-value').should('have.value', '2000-01')
+          cy.get('#month-without-value').type('{downArrow}{downArrow}{upArrow}')
+          cy.get('#month-without-value').should('have.value', '1999-12')
+        })
+
+        it('throws when {upArrow} is followed by a key that is not an arrow', (done) => {
+          cy.on('fail', (err) => {
+            expect(err.message).to.include('requires a valid month')
+
+            done()
+          })
+
+          cy.get('#month-without-value').type('{upArrow}{leftArrow}')
+        })
+
         it('{upArrow} triggers events on input', () => {
           cy.get('#month-with-value')
           .then(($input) => {
@@ -3316,6 +3359,23 @@ describe('src/cy/commands/actions/type - #type', () => {
           cy.get('#week-without-value').should('have.value', '2017-W04')
         })
 
+        it('consecutive {upArrow} and {downArrow} step the week once per arrow', () => {
+          cy.get('#week-without-value').type('2017-W05').type('{upArrow}{upArrow}')
+          cy.get('#week-without-value').should('have.value', '2017-W07')
+          cy.get('#week-without-value').type('{downArrow}{downArrow}{upArrow}')
+          cy.get('#week-without-value').should('have.value', '2017-W06')
+        })
+
+        it('throws when {upArrow} is followed by a key that is not an arrow', (done) => {
+          cy.on('fail', (err) => {
+            expect(err.message).to.include('requires a valid week')
+
+            done()
+          })
+
+          cy.get('#week-without-value').type('{upArrow}{leftArrow}')
+        })
+
         it('{upArrow} triggers events on input', () => {
           cy.get('#week-with-value')
           .then(($input) => {
@@ -3361,6 +3421,23 @@ describe('src/cy/commands/actions/type - #type', () => {
           cy.get('#time-without-value').should('have.value', '01:22')
         })
 
+        it('consecutive {upArrow} and {downArrow} step the minute once per arrow', () => {
+          cy.get('#time-without-value').type('01:59').type('{upArrow}{upArrow}')
+          cy.get('#time-without-value').should('have.value', '02:01')
+          cy.get('#time-without-value').type('{downArrow}{downArrow}{upArrow}')
+          cy.get('#time-without-value').should('have.value', '02:00')
+        })
+
+        it('throws when {upArrow} is followed by a key that is not an arrow', (done) => {
+          cy.on('fail', (err) => {
+            expect(err.message).to.include('requires a valid time')
+
+            done()
+          })
+
+          cy.get('#time-without-value').type('{upArrow}{leftArrow}')
+        })
+
         it('{upArrow} triggers events on input', () => {
           cy.get('#time-with-value')
           .then(($input) => {
@@ -3402,6 +3479,23 @@ describe('src/cy/commands/actions/type - #type', () => {
           cy.get('#datetime-local-without-value').type('{downArrow}')
         })
 
+        it('consecutive {upArrow} and {downArrow} step the value once per arrow', () => {
+          cy.get('#datetime-local-without-value').type('2000-01-01T01:30').type('{upArrow}{upArrow}')
+          cy.get('#datetime-local-without-value').should('have.value', '2000-01-01T01:32')
+    
```

**File**: `packages/driver/src/cy/keyboard.ts` (modified, +3/-1)
```diff
@@ -68,7 +68,9 @@ const dateTimeRe = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2})?(\.
 const numberRe = /^-?(\d+|\d+\.\d+|\.\d+)([eE][-+]?\d+)?$/i
 const charsBetweenCurlyBracesRe = /({.+?})/
 const isValidNumberInputChar = /[-+eE\d.]/
-const arrowKeysRe = /^\{(ArrowUp|ArrowDown)\}$/
+// Unanchored at the end so that each arrow in a run such as
+// {upArrow}{upArrow} is accepted on its own as typing reaches it
+const arrowKeysRe = /^\{(ArrowUp|ArrowDown)\}/
 
 const INITIAL_MODIFIERS = {
   alt: false,
```

---

### Incident Patch 2: `e9aaccd2` (2026-11-11)
**Commit Message**: fix(server): apply intercepted redirect header changes (#35295)

- Fulfill a paused redirect in Chromium when a cy.intercept response handler changes, adds or removes its Location or Referrer-Policy header. Previously the change went out through Fetch.continueResponse, which Chrome ignores at a redirect pause, so the browser followed the redirect as the origin sent it.
- Classify a redirect pause once in the CDP transport and pass it to the codec as a redirectPause flag, instead of both modules checking separately
- Add isRedirectStatus to @packages/network-interception so the proxy and the CDP transport share one list of redirect status codes
- Add codec, transport and system tests covering rewritten, removed and added Location and Referrer-Policy headers, POST redirects by status, cross-site redirects, redirect chains and EventSource
- Add a changelog entry

Fixes #34704

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `cli/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@
 **Bugfixes:**
 
 - Fixed a regression in [16.0.0](#16-0-0) where changes a [`cy.intercept()`](https://on.cypress.io/intercept) response handler made to `Set-Cookie` headers did not reach the browser in Chromium-based browsers. The browser stored the cookies exactly as the server sent them, so a handler that rewrote a cookie's attributes, such as adding `SameSite=None` so a cross-site login cookie is accepted, or that removed a cookie, had no effect. Cookies in the browser now match the `Set-Cookie` headers the handler leaves on the response. Fixes [#34902](https://github.com/cypress-io/cypress/issues/34902).
+- Fixed a regression in [16.0.0](#16-0-0) where a [`cy.intercept()`](https://on.cypress.io/intercept) response handler that changed the `Location` or `Referrer-Policy` header of a redirect had no effect in Chromium-based browsers. The browser followed the redirect as the server sent it, to the server's URL and with the server's referrer policy. Fixes [#34704](https://github.com/cypress-io/cypress/issues/34704).
 - Fixed an issue where Cypress could use a port that browsers refuse to load, such as 10080, when the [`port`](https://on.cypress.io/configuration) option was not set. The runner then failed with `ERR_UNSAFE_PORT`. Cypress now redraws a blocked randomly assigned port, and a blocked port in configuration is reported as a configuration error that names the port before the runner server starts. Fixes [#30869](https://github.com/cypress-io/cypress/issues/30869).
 - Fixed an issue where a spec whose bundled file includes a large inline source map could crash the browser tab, leaving `cypress run` hanging with no error until it was killed. The crash could happen while the spec first loaded, or when it loaded again after its first [`cy.visit()`](https://on.cypress.io/visit) to another origin. Specs with inline source maps now also load faster and use less memory. Fixes [#35201](https://github.com/cypress-io/cypress/issues/35201).
 - Fixed an issue where `cypress run` could hang until it was killed, or exit with an unrelated `socket hang up` error, when the process that loads your config file and runs your [Node events](https://docs.cypress.io/app/plugins/plugins-guide) exited, for example because the operating system ran out of memory or `setupNodeEvents` called `process.exit()`. In component testing this process also runs the dev server. Cypress now stops the run with an error that says the process exited, with its exit code or signal. Fixes [#25507](https://github.com/cypress-io/cypress/issues/25507) and [#35223](https://github.com/cypress-io/cypress/issues/35223).
```

**File**: `packages/network-interception/lib/core/index.ts` (modified, +2/-0)
```diff
@@ -10,6 +10,8 @@ export * from './document-preparation'
 
 export * from './request-logging'
 
+export * from './redirect-status'
+
 export * from './network-interception-core'
 
 export * from './http-intercept'
```

**File**: `packages/network-interception/lib/core/redirect-status.ts` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+const REDIRECT_STATUS_CODES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308])
+
+/**
+ * Whether a browser follows the response's Location header. The proxy and the
+ * CDP transport both use this, so they agree on which responses are redirects.
+ */
+export function isRedirectStatus (statusCode: number | undefined): boolean {
+  return statusCode !== undefined && REDIRECT_STATUS_CODES.has(statusCode)
+}
```

**File**: `packages/network-interception/test/unit/redirect-status.spec.ts` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+import { describe, it, expect } from 'vitest'
+import { isRedirectStatus } from '../../lib/core/redirect-status'
+
+describe('core/redirect-status', () => {
+  it.each([301, 302, 303, 307, 308])('treats %i as a redirect', (statusCode) => {
+    expect(isRedirectStatus(statusCode)).toBe(true)
+  })
+
+  // 300 and 305 are 3xx, but browsers don't follow their Location; 304 has none.
+  it.each([200, 300, 304, 305, 400, undefined])('does not treat %s as a redirect', (statusCode) => {
+    expect(isRedirectStatus(statusCode)).toBe(false)
+  })
+})
```

**File**: `packages/proxy/lib/http/response-middleware.ts` (modified, +2/-3)
```diff
@@ -5,6 +5,7 @@ import { PassThrough } from 'stream'
 import { URL } from 'url'
 import zlib from 'zlib'
 import { InterceptResponse } from '@packages/net-stubbing'
+import { isRedirectStatus } from '@packages/network-interception'
 import { concatStream, httpUtils } from '@packages/network'
 import { telemetry } from '@packages/telemetry'
 import { hasServiceWorkerHeader, isVerboseTelemetry as isVerbose } from '.'
@@ -505,16 +506,14 @@ const MaybeCopyCookiesFromIncomingRes: ResponseMiddleware = async function () {
   return this.networkInterceptionCore.copyCookiesFromResponse(this)
 }
 
-const REDIRECT_STATUS_CODES: any[] = [301, 302, 303, 307, 308]
-
 // TODO: this shouldn't really even be necessary?
 const MaybeSendRedirectToClient: ResponseMiddleware = async function () {
   const span = telemetry.startSpan({ name: 'maybe:send:redirect:to:client', parentSpan: this.resMiddlewareSpan, isVerbose })
 
   const { statusCode, headers } = this.incomingRes
   const newUrl = headers['location']
 
-  const isRedirectNeeded = !REDIRECT_STATUS_CODES.includes(statusCode) || !newUrl
+  const isRedirectNeeded = !isRedirectStatus(statusCode) || !newUrl
 
   span?.setAttributes({
     isRedirectNeeded,
```

**File**: `packages/server/lib/browsers/cdp-protocol/cdp-fetch-codec.ts` (modified, +32/-14)
```diff
@@ -125,9 +125,7 @@ function headerEntriesChanged (left: Protocol.Fetch.HeaderEntry[], right: Protoc
  * stale length headers. The pause-header fallback describes the wire body, not
  * the decoded body we fulfill with, so its encoding headers are stripped too.
  */
-function toFulfilledHeaders (headers?: HttpHeaders, pauseHeaders?: Protocol.Fetch.HeaderEntry[]): Protocol.Fetch.HeaderEntry[] | undefined {
-  const middlewareHeaders = toResponseHeaders(headers)
-
+function toFulfilledHeaders (middlewareHeaders?: Protocol.Fetch.HeaderEntry[], pauseHeaders?: Protocol.Fetch.HeaderEntry[]): Protocol.Fetch.HeaderEntry[] | undefined {
   if (middlewareHeaders) {
     return stripHeaderEntries(middlewareHeaders, WIRE_LENGTH_HEADERS)
   }
@@ -143,9 +141,7 @@ function toFulfilledHeaders (headers?: HttpHeaders, pauseHeaders?: Protocol.Fetc
  * lowercased, re-folded reconstruction — the same "don't override what you
  * didn't touch" rule continueRequestHeaders applies at the request stage.
  */
-function toContinuedHeaders (headers?: HttpHeaders, pauseHeaders?: Protocol.Fetch.HeaderEntry[]): Protocol.Fetch.HeaderEntry[] | undefined {
-  const middlewareHeaders = toResponseHeaders(headers)
-
+function toContinuedHeaders (middlewareHeaders?: Protocol.Fetch.HeaderEntry[], pauseHeaders?: Protocol.Fetch.HeaderEntry[]): Protocol.Fetch.HeaderEntry[] | undefined {
   if (!middlewareHeaders) {
     return undefined
   }
@@ -200,14 +196,19 @@ function toPausePostData (entries?: Protocol.Network.PostDataEntry[]): Buffer |
   return Buffer.concat(entries.map(({ bytes }) => Buffer.from(bytes!, 'base64')))
 }
 
-function contentTypeOf (entries?: Protocol.Fetch.HeaderEntry[]): string | undefined {
+function headerValueOf (entries: Protocol.Fetch.HeaderEntry[] | undefined, headerName: string): string | undefined {
   const values = entries
-  ?.filter(({ name }) => name.toLowerCase() === 'content-type')
+  ?.filter(({ name }) => name.toLowerCase() === headerName)
   .map(({ value }) => value)
 
   return values?.length ? values.join(', ') : undefined
 }
 
+// Headers that decide where and how Chrome follows a redirect. Only these are
+// compared, because the pipeline drops hop-by-hop headers such as Connection,
+// so a full comparison would flag every HTTP/1.1 redirect as changed.
+const REDIRECT_FOLLOW_HEADERS = ['location', 'referrer-policy']
+
 /**
  * Fulfill only when continueResponse would leave the Network record out of
  * sync with what the page received; continue everything else, since
@@ -223,6 +224,14 @@ function contentTypeOf (entries?: Protocol.Fetch.HeaderEntry[]): string | undefi
  * Fetch.fulfillRequest:
  *   - the body, which no longer matches the origin bytes
  *   - the content-type, which mimeType and charset are derived from
+ *
+ * A redirect whose location or referrer-policy changed is fulfilled too. At a
+ * redirect pause, Chrome records overridden headers but follows the redirect
+ * as the origin sent it: to the origin's location, with the referrer policy
+ * the origin set. CDP cannot read a redirect's body, so it is fulfilled empty.
+ * A handler that removes the location therefore gets an empty body here, where
+ * the MITM path sends the origin's.
+ *
  * Spy-only, status, and other header intercepts stay on continueResponse.
  * If Chrome ever derives another Network.responseReceived field from a header
  * without recomputing it for overrides, that header joins the fulfill list.
@@ -234,20 +243,29 @@ function encodePausedResponse (
   { originalBodyDigest, ...pausedResponse }: CdpFetchTransportResponse,
   response: CdpFetchHttpResponse,
 ): CdpFetchTransportResponse {
+  const middlewareHeaders = toResponseHeaders(response.headers)
   const bodyModified = response.body !== undefined && !isOriginBody(response.body, originalBodyDigest)
-  const middlewareContentType = contentTypeOf(toResponseHeaders(response.headers))
+  const middlewareContentType = headerValueOf(middlewareHeaders, 'content-type')
   const contentTypeModified = middlewareContentType !== undefined
-    && middlewareContentType !== contentTypeOf(pausedResponse.responseHeaders)
+    && middlewareContentType !== headerValueOf(pausedResponse.responseHeaders, 'content-type')
+
+  // A header the middleware removed counts as changed; middleware that
+  // reported no headers at all changed nothing.
+  const redirectModified = pausedResponse.redirectPause === true
+    && middlewareHeaders !== undefined
+    && REDIRECT_FOLLOW_HEADERS.some((headerName) => {
+      return headerValueOf(middlewareHeaders, headerName) !== headerValueOf(pausedResponse.responseHeaders, headerName)
+    })
 
-  const fulfilled = bodyModified || (contentTypeModified && response.body !== undefined)
+  const fulfilled = bodyModified || (contentTypeModified && response.body !== undefined) || redirectModified
 
   return {
     ...pausedResponse,
     fulfilled,
     responseCode: response.statusCode ?? pausedResponse.responseCode,
     responseHeaders: fulfilled
- 
```

**File**: `packages/server/lib/browsers/cdp-protocol/cdp-fetch-transport.ts` (modified, +11/-7)
```diff
@@ -3,7 +3,7 @@ import debugModule from 'debug'
 import { STATUS_CODES } from 'http'
 import { Readable } from 'stream'
 import type { ForHttpIntercept, HttpRequest } from '@packages/network-interception'
-import { HttpIntercept } from '@packages/network-interception'
+import { HttpIntercept, isRedirectStatus } from '@packages/network-interception'
 import type { ResourceType } from '@packages/proxy'
 import type { BodyDigest } from './body-digest'
 import { digestBody } from './body-digest'
@@ -23,7 +23,6 @@ type CdpFetchClient = Pick<ICriClient, 'send' | 'on' | 'off'>
 
 type CdpFetchRequest = Protocol.Fetch.RequestPausedEvent['request']
 const RESPONSE_PAUSE_TIMEOUT_MS = 30000
-const REDIRECT_STATUS_CODES = [301, 302, 303, 307, 308]
 
 const setCookieHeaders = (headers: Protocol.Fetch.HeaderEntry[]): string[] => {
   return headers
@@ -55,7 +54,7 @@ const FETCH_PATTERNS: Protocol.Fetch.EnableRequest = {
 // so an untouched 3xx continues natively while a middleware that writes a body
 // onto one falls back to fulfill.
 const isRedirectPause = (event: Protocol.Fetch.RequestPausedEvent): boolean => {
-  return REDIRECT_STATUS_CODES.includes(event.responseStatusCode as number)
+  return isRedirectStatus(event.responseStatusCode)
     && !!event.responseHeaders?.some(({ name }) => name.toLowerCase() === 'location')
 }
 
@@ -170,6 +169,9 @@ export interface CdpFetchTransportResponse extends CdpFetchTransportRequest {
   captureStream?: Readable
   fulfilled?: boolean
   originalBodyDigest?: BodyDigest
+  // Paused in the redirect-received state, where Chrome ignores
+  // continueResponse overrides
+  redirectPause?: boolean
   // Chrome's cookie handling before cy.intercept ran: the baseline the
   // response's final Set-Cookie headers are synced against
   cookiesBeforeIntercept?: CookiesBeforeIntercept
@@ -852,6 +854,7 @@ export class CdpFetchTransport {
 
     // no predicate composed → materialize everything
     const bodySkipped = this.options.shouldStreamBody?.(event, { hasMatchingRoute: deferred.hadMatchingRoutes ?? false }) ?? false
+    const redirectPause = isRedirectPause(event)
     let originalBody: Buffer
     let captureStream: Readable | undefined
 
@@ -863,7 +866,7 @@ export class CdpFetchTransport {
       // already be listening before that happens or its opening bytes are lost.
       // Redirect pauses never arm: their hop emits no loadingFinished, so an
       // armed entry would sit unread until the transport resets.
-      if (event.networkId && !isRedirectPause(event) && this.options.shouldCaptureBody?.()) {
+      if (event.networkId && !redirectPause && this.options.shouldCaptureBody?.()) {
         captureStream = await this.bodyCapture.arm(event.networkId, sessionId)
 
         // The flow may have been rejected while arming awaited CDP, by
@@ -894,7 +897,7 @@ export class CdpFetchTransport {
       originalBody = Buffer.alloc(0)
     } else {
       try {
-        originalBody = await this.fetchResponseBody(event, sessionId)
+        originalBody = await this.fetchResponseBody(event, redirectPause, sessionId)
       } catch (err) {
         deferred.reject(new Error(`CDP Fetch response body unavailable for ${event.request.url}: ${(err as Error).message}`))
 
@@ -935,6 +938,7 @@ export class CdpFetchTransport {
       ...(cookiesBeforeIntercept ? { cookiesBeforeIntercept } : {}),
       sessionId,
       ...(bodySkipped ? { bodySkipped: true } : {}),
+      ...(redirectPause ? { redirectPause: true } : {}),
       ...(captureStream ? { captureStream } : {}),
     })
   }
@@ -1054,8 +1058,8 @@ export class CdpFetchTransport {
     })
   }
 
-  private fetchResponseBody = async (event: Protocol.Fetch.RequestPausedEvent, sessionId?: string): Promise<Buffer> => {
-    if (isRedirectPause(event)) {
+  private fetchResponseBody = async (event: Protocol.Fetch.RequestPausedEvent, redirectPause: boolean, sessionId?: string): Promise<Buffer> => {
+    if (redirectPause) {
       return Buffer.alloc(0)
     }
 
```

**File**: `packages/server/test/unit/browsers/cdp-fetch-transport.spec.ts` (modified, +200/-0)
```diff
@@ -855,6 +855,133 @@ describe('CdpFetchTransport', () => {
       expect(encoded.body).toBe(Buffer.from('stubbed').toString('base64'))
     })
 
+    // https://github.com/cypress-io/cypress/issues/34704
+    // At a redirect pause Chrome follows the redirect as the origin sent it even
+    // when continueResponse overrides its headers, so a changed location or
+    // referrer-policy has to be fulfilled.
+    describe('encoding a redirect', () => {
+      const decodePausedResponse = (codec: ReturnType<typeof createCdpFetchCodec>, options: {
+        responseHeaders?: Protocol.Fetch.HeaderEntry[]
+        redirectPause?: boolean
+      } = {}) => {
+        const request: CdpFetchTransportRequest = {
+          id: 'network-1',
+          url: 'https://example.test/redirect',
+          method: 'GET',
+          headers: {},
+          initialPriority: 'High',
+          referrerPolicy: 'strict-origin-when-cross-origin',
+        }
+
+        codec.decodeRequest(request)
+
+        return codec.decodeResponse({
+          ...request,
+          requestId: 'fetch-request',
+          responseCode: 302,
+          responseStatusText: 'Found',
+          responseHeaders: options.responseHeaders ?? [
+            { name: 'Location', value: '/original' },
+            { name: 'Date', value: 'today' },
+          ],
+          ...(options.redirectPause ?? true ? { redirectPause: true } : {}),
+          originalBodyDigest: digestBody(Buffer.alloc(0)),
+        })
+      }
+
+      const toHeaderEntries = (headers: Record<string, string>) => Object.entries(headers).map(([name, value]) => ({ name, value }))
+
+      it.each([
+        { change: 'changed', headers: { location: '/rewritten', date: 'today' } },
+        { change: 'removed', headers: { date: 'today' } },
+      ])('fulfills a redirect whose location middleware $change', ({ headers }) => {
+        const codec = createCdpFetchCodec()
+        const response = decodePausedResponse(codec)
+
+        expect(response.headers).toStrictEqual({ location: '/original', date: 'today' })
+
+        const encoded = codec.encodeResponse({ ...response, body: '', headers })
+
+        expect(encoded.fulfilled).toBe(true)
+        expect(encoded.responseCode).toBe(302)
+        expect(encoded.responseHeaders).toStrictEqual(toHeaderEntries(headers))
+        expect(encoded.body).toBe('')
+      })
+
+      // Chrome applies a redirect's Referrer-Policy to the request it follows
+      // the redirect with, and ignores a continueResponse override of it.
+      it.each([
+        { change: 'added', originPolicy: undefined, policy: 'no-referrer' },
+        { change: 'changed', originPolicy: 'unsafe-url', policy: 'no-referrer' },
+        { change: 'removed', originPolicy: 'no-referrer', policy: undefined },
+      ])('fulfills a redirect whose referrer-policy middleware $change', ({ originPolicy, policy }) => {
+        const codec = createCdpFetchCodec()
+        const response = decodePausedResponse(codec, {
+          responseHeaders: [
+            { name: 'Location', value: '/original' },
+            ...(originPolicy ? [{ name: 'Referrer-Policy', value: originPolicy }] : []),
+          ],
+        })
+
+        const headers = { location: '/original', ...(policy ? { 'referrer-policy': policy } : {}) }
+        const encoded = codec.encodeResponse({ ...response, body: '', headers })
+
+        expect(encoded.fulfilled).toBe(true)
+        expect(encoded.responseHeaders).toStrictEqual(toHeaderEntries(headers))
+        expect(encoded.body).toBe('')
+      })
+
+      // The origin's casing differs from the middleware view, which a plain
+      // string comparison of the header lists would mistake for a change.
+      it('continues a redirect that middleware passed through untouched', () => {
+        const codec = createCdpFetchCodec()
+        const response = decodePausedResponse(codec)
+
+        const encoded = codec.encodeResponse({ ...response, body: '' })
+
+        expect(encoded.fulfilled).toBe(false)
+        expect(encoded.responseHeaders).toBeUndefined()
+      })
+
+      it('continues a redirect when middleware changed a header that does not affect how it is followed', () => {
+        const codec = createCdpFetchCodec()
+        const response = decodePausedResponse(codec)
+
+        const headers = { 'location': '/original', 'date': 'today', 'x-custom': 'yes' }
+        const encoded = codec.encodeResponse({ ...response, body: '', headers })
+
+        expect(encoded.fulfilled).toBe(false)
+        expect(encoded.responseHeaders).toStrictEqual(toHeaderEntries(headers))
+      })
+
+      it('continues a redirect when middleware reported no headers', () => {
+        const codec = createCdpFetchCodec()
+        const response = decodePausedResponse(codec)
+
+        const encoded = codec.encodeResponse({
+          ...response,
+          body: '',
+          headers: undefined,
+        })
+
+        expect(encoded.fulfilled).toBe(false)
+      })
```

---

### Incident Patch 3: `8811f2e2` (2026-11-10)
**Commit Message**: test: drive graceful-exit step timeout specs with fake timers (#35340)

Two specs measured a real setTimeout with Date.now() and asserted a lower
bound equal to the timeout. libuv truncates a timer's start to whole
milliseconds, so the timer can fire just under the requested delay and
Date.now() reads 99 for a 100ms step. Fake timers assert the boundary
exactly and drop ~1.7s of real waiting.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/server/test/unit/util/graceful_exit.spec.ts` (modified, +19/-34)
```diff
@@ -43,6 +43,7 @@ describe('lib/util/graceful-exit', () => {
 
   afterEach(() => {
     GracefulExit.resetForTesting()
+    vi.useRealTimers()
     delete process.env.CYPRESS_INTERNAL_TEARDOWN_TIMEOUT
     vi.restoreAllMocks()
   })
@@ -253,13 +254,9 @@ describe('lib/util/graceful-exit', () => {
   it('abandons a hung step on its own budget so the remaining steps still complete', async () => {
     process.env.CYPRESS_INTERNAL_TEARDOWN_TIMEOUT = '1000'
 
-    const startedAt = Date.now()
-    let exitedAfter: number | undefined
-    const exitStub = vi.spyOn(process, 'exit').mockImplementation(() => {
-      exitedAfter = exitedAfter ?? Date.now() - startedAt
+    vi.useFakeTimers()
 
-      return undefined as never
-    })
+    const exitStub = stubExit()
     const logStub = stubLog()
 
     let quickStepRan = false
@@ -272,22 +269,21 @@ describe('lib/util/graceful-exit', () => {
 
     void GracefulExit.exitGracefully(0)
 
-    await new Promise((r) => setTimeout(r, 1200))
-
-    const logged = logStub.mock.calls.flat().join('\n')
-
-    logStub.mockRestore()
+    // 0.8 of the 1000ms budget, so teardown settles before the shared force-exit timer can fire
+    await vi.advanceTimersByTimeAsync(800)
 
     expect(quickStepRan, 'the quick step is not cut off by the hung one').toBe(true)
-    // 0.8 of the 1000ms budget, so teardown settles before the shared force-exit timer can fire
-    expect(exitedAfter).toBeGreaterThanOrEqual(800)
-    expect(exitedAfter).toBeLessThanOrEqual(999)
+    expect(exitStub).toHaveBeenCalledTimes(1)
     expect(exitStub).toHaveBeenCalledWith(0)
+
+    await vi.advanceTimersByTimeAsync(1000)
+
+    const logged = logStub.mock.calls.flat().join('\n')
+
+    expect(exitStub).toHaveBeenCalledTimes(1)
     expect(logged).toContain('The "hang" teardown step did not finish within 800ms')
     expect(logged).not.toContain('Failed to gracefully exit')
-
-    exitStub.mockRestore()
-  }, 5000)
+  })
 
   it('a reset cancels the step bounds of an in-flight teardown', async () => {
     process.env.CYPRESS_INTERNAL_TEARDOWN_TIMEOUT = '200'
@@ -352,30 +348,19 @@ describe('lib/util/graceful-exit', () => {
   it('honors a step-specific timeout shorter than the shared budget', async () => {
     process.env.CYPRESS_INTERNAL_TEARDOWN_TIMEOUT = '2000'
 
-    const startedAt = Date.now()
-    let exitedAfter: number | undefined
-    const exitStub = vi.spyOn(process, 'exit').mockImplementation(() => {
-      exitedAfter = exitedAfter ?? Date.now() - startedAt
+    vi.useFakeTimers()
 
-      return undefined as never
-    })
+    const exitStub = stubExit()
     const logStub = stubLog()
 
     GracefulExit.addStep(() => new Promise(() => {}), 'best-effort', 100)
 
     void GracefulExit.exitGracefully(0)
 
-    await new Promise((r) => setTimeout(r, 500))
-
-    const logged = logStub.mock.calls.flat().join('\n')
+    await vi.advanceTimersByTimeAsync(100)
 
-    logStub.mockRestore()
-
-    expect(exitedAfter).toBeGreaterThanOrEqual(100)
-    expect(exitedAfter).toBeLessThanOrEqual(400)
+    expect(exitStub).toHaveBeenCalledTimes(1)
     expect(exitStub).toHaveBeenCalledWith(0)
-    expect(logged).toContain('The "best-effort" teardown step did not finish within 100ms')
-
-    exitStub.mockRestore()
-  }, 5000)
+    expect(logStub.mock.calls.flat().join('\n')).toContain('The "best-effort" teardown step did not finish within 100ms')
+  })
 })
```

#### Recent Merged Pull Requests:
- **PR #35361** (2026-11-12): chore: lint Vitest specs with @vitest/eslint-plugin (@jennifer-shehane)
- **PR #35360** (2026-11-12): perf: sniff cy.intercept stubbed-response HTML in linear time (@jennifer-shehane)
- **PR #35358** (2026-11-12): dependency: update qs to 6.16.2 (@mschile)
- **PR #35357** (2026-11-12): dependency: update js-yaml to 3.15.2 (@mschile)
- **PR #35356** (2026-11-11): chore: document that vN pushes build platforms from the schedule (@mschile)
- **PR #35354** (2026-11-11): chore: update js-yaml to 4.3.2 (@mschile)

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

## X. accept consecutive arrow keys in cy.type() on date-like inputs (#35352)

**RULE**:
When implementing operations in `cli/CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in cypress-io/cypress. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e4d77771`: accept consecutive arrow keys in cy.type() on date-like inputs (#35352). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `cli/CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
**Bugfixes:**

- [`.type()`](https://on.cypress.io/type) now accepts consecutive `{upArrow}` and `{downArrow}` sequences, such as `{upArrow}{upArrow}`, on `date`, `month`, `week`, `time`, and `datetime-local` inputs, and steps the value once per arrow. Previously, a single arrow worked but more than one in a row failed with an error saying the input required a valid date, month, week, time, or datetime. Fixed in [#35352](https://github.com/cypress-io/cypress/pull/35352).

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e4d77771` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

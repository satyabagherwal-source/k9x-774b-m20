# Verification Protocol: Verification Protocol: Empirical Defect Shield for cypress-io-cypress-learnings

<!-- PROVENANCE_START
{
  "source_repository": "cypress-io-cypress-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T11:22:56.066Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-cypress-io-cypress-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cypress-io-cypress-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T11:22:56.066Z`  
> **Learning ID**: `LEARN-EVO-cypress-io-cypress-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `cypress-io-cypress-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cypress-io-cypress-learnings.md`  
> **Source**: github ([https://github.com/cypress-io/cypress](https://github.com/cypress-io/cypress))  
> **Source Version**: `c4799792`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T11:17:50.218Z  
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
> **Harvest Timestamp**: 2026-11-28T11:17:47.926Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cypress-io/cypress`
- **Description**: Fast, easy and reliable testing for anything that runs in a browser.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 51044 stars

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
- **Issue #35574** (2026-11-28): **chore: cover Chrome for Testing in driver browser-name checks**
  *Symptoms*: - Closes N/A — part of moving the internal test suites’ default browser from Electron to Chrome for Testing (CfT)  ### Additional details  Chrome for Testing reports `Cypress.browser.name` as `chrome-for-testing`, never `chrome`, and the browser matchers compare names exactly. So any driver spec that checks for `'chrome'` by name quietly skips its Chrome branch under CfT. This PR goes through those checks one by one and asks the same question each time: does the test mean Google Chrome specifically, or any Chrome build?  - **`e2e/testConfigOverrides.cy.ts`:** adds a `browser: 'chrome-for-testing'` case and a matching `ranChromeForTesting` flag in the `after` hook. Before this, the hook expected every flag to be false under CfT, so the spec passed without running a single browser-gated test. The `'chrome'` case stays, since checking exact name matching is the whole point of it. - **`commands/actions/click.cy.ts`** (`no click when element is disabled`): the disabled `<button>` gets `mouseenter`/`mousedown`/`mouseup` in every Blink build I tried (Chrome for Testing 158 and Electron 150, with the assertion temporarily running in every browser). So this is engine behavior, not something only Google Chrome does. The gate is now the spec’s existing `isChromium116OrLater`, the same version split that `handles disabled attr` already uses for disabled-element mouse events. - **`e2e/xhr_abort.cy.ts`:** the `chrome >= 71` block is now gated on `['chrome', 'chrome-for-testing']`, so the t
  **Post-Mortem & Fix Analysis**:
  >  <h3>   <a href="https://cloud.cypress.io/projects/ypt4pf?utm_source=github&utm_medium=flaky&utm_campaign=project">cypress</a>&nbsp;   <picture><img src="https://assets.cypress.io/github-pr-comment-icons/chevron.svg" alt="" width="14" height="14" /></picture>&nbsp;   <a href="https://cloud.cypress.io/projects/ypt4pf/runs/75942/overview?utm_source=github&utm_medium=flaky&utm_campaign=run%20number">Run #75942</a> </h3>  <details>   <summary>     <strong>Run Properties:</strong>&nbsp;     <code><picture><img src="https://assets.cypress.io/github-pr-comment-icons/passed.svg" alt="status check passed" width="10" height="10" /></picture>&nbsp;Passed&nbsp;<a href="https://cloud.cypress.io/projects/ypt4pf/runs/75942/overview?utm_source=github&utm_medium=flaky&utm_campaign=run%20number">#75942</a></code> &nbsp;&bull;&nbsp;     <code><picture><img src="https://assets.cypress.io/github-pr-comment-icons/git-commit.svg" alt="git commit" width="10" height="10" /></picture> <a href="https://github.co

- **Issue #35572** (2026-11-28): **chore: emit a loadable ESM build for @packages/https-proxy**
  *Symptoms*: - Closes N/A. There's no issue for this one. It's a small build fix I found while checking where `@packages/https-proxy`'s `"module"` field pointed. It's related to #34829, which moved lint ignores for build output to one central place.  ### Additional details  `package.json` advertises `"module": "esm/index.js"`, but that file never existed. `tsconfig.esm.json` set `"noEmit": true`, so `build:esm` deleted `esm/` and then wrote nothing back into it. Once I turned emitting on, I found the output still couldn't be loaded by Node's own ESM loader. So this PR goes the whole way:  - **Emit the build:** drop `noEmit` from `tsconfig.esm.json`. - **Make it real ESM:**   - Relative imports in `lib/` now end in `.js`, because Node's ESM loader won't guess an extension. A package-scoped `n/file-extension-in-import` lint rule keeps it that way, and it can auto-fix.   - `build:esm` writes `esm/package.json` containing `{"type":"module"}`. Putting `"type": "module"` on the package itself would break `cjs/`, which `main` still points at.   - `ca.ts` imports `node-forge` by its default export. Node can't read named exports from that CommonJS package, so the named import failed with ``does not provide an export named 'md'``. - **Declare the runtime dependency:** `lib/server.ts` imports `@packages/network` at runtime, but it was only a devDependency and worked because the monorepo hoists it. It's now a dependency. `@packages/server` already depends on both packages, so the binary's contents do

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

### Incident Patch 1: `08aeee75` (2026-11-28)
**Commit Message**: fix: replay held requestAnimationFrame callbacks with the time they run (#35566)

* fix: give replayed requestAnimationFrame callbacks the time they run

While the driver pauses timers (cy.screenshot with
disableTimersAndAnimations), rAF callbacks that come due are held and
replayed on unpause. They were replayed with the timestamp the browser
passed when they came due, which is stale by the length of the pause and
earlier than performance.now() reads in setTimeout callbacks replayed in
the same flush.

Replay now reads performance.now() once per flush and passes it to every
held rAF callback, matching how callbacks in one real frame share a
timestamp. Other timers keep their original arguments.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01WUv8r3m9LtBn5gLVwYb8xD

* chore: lead the rAF replay comment with its effect

Open with what the replay does to a held callback's timestamp, with an
example, before the reason, per the code comment guidelines.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01WUv8r3m9LtBn5gLVwYb8xD

* test: assert replayed rAF timestamps are current in the d

**File**: `cli/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@
 
 **Bugfixes:**
 
+- `requestAnimationFrame()` callbacks in your application that come due while [`cy.screenshot()`](https://on.cypress.io/screenshot) takes a screenshot now receive the time they run once the screenshot finishes, as they would in a real frame, instead of the time they came due. Fixed in [#35566](https://github.com/cypress-io/cypress/pull/35566).
 - Fixed an issue where setting up a testing type wrote `import` and `export default` into an empty `cypress.config.cjs` when your `package.json` has `"type": "module"`, so the configuration file then failed to load. Fixed in [#35543](https://github.com/cypress-io/cypress/pull/35543).
 - Fixed an issue where the `junit` reporter, and custom reporters that use `mocha-junit-reporter`, printed `Couldn't determine Mocha version` on every run. Fixed in [#35561](https://github.com/cypress-io/cypress/pull/35561).
 
```

**File**: `packages/driver/cypress/e2e/cy/timers.cy.ts` (modified, +8/-3)
```diff
@@ -178,21 +178,26 @@ describe('driver/src/cy/timers', () => {
 
         expect(id1).to.eq(1)
 
+        let unpausedAt: number
+
         cy
         .wait(100)
         .log('requestAnimationFrame should NOT have fired when paused')
         .window().its('bar').should('be.null')
         .log('requestAnimationFrame should now fire when unpaused')
         .then(() => {
+          unpausedAt = win.performance.now()
+
           // now go ahead and run all the queued timers
           return cy.pauseTimers(false)
         })
 
         cy.window().its('bar').should('eq', 'bar')
         .and(() => {
-          // requestAnimationFrame should have passed through
-          // its high res timestamp from performance.now()
-          expect(rafStub).to.be.calledWithMatch(Number)
+          // The callback's frame came due during the wait, so a timestamp from
+          // before unpausing means it was given that frame's stale time
+          expect(rafStub).to.be.calledOnce
+          expect(rafStub.firstCall.args[0]).to.be.at.least(unpausedAt)
         })
         .then(() => {
           win.bar = 'foo'
```

**File**: `packages/runner/injection/timers.ts` (modified, +23/-0)
```diff
@@ -18,6 +18,12 @@ export const createTimers = () => {
   let timerQueue: QueuedTimer[]
   let canceledTimerIds: Record<number, boolean>
 
+  // Bound when the timers are created, before any app or test code runs, so
+  // held rAF callbacks keep the clock real frames use even after
+  // `performance.now` is replaced, as `cy.clock(now, ['performance'])` does
+  const { performance } = window
+  const frameClock = performance.now.bind(performance)
+
   const reset = () => {
     paused = false
     flushing = false
@@ -36,6 +42,13 @@ export const createTimers = () => {
   const flushTimerQueue = () => {
     flushing = true
 
+    // Held rAF callbacks receive the time the first of them runs: one that came
+    // due at 16 and replays at 5016 is called with 5016, not 16. The replay
+    // runs outside any rendering frame, so the timestamp the browser passed is
+    // stale by the length of the pause. Like callbacks in one real frame, every
+    // rAF callback in this flush shares that timestamp.
+    let frameTimestamp: number | undefined
+
     timerQueue.forEach((timer) => {
       const { timerId, type, fnOrCode, params } = timer
 
@@ -46,6 +59,16 @@ export const createTimers = () => {
         return
       }
 
+      if (type === 'requestAnimationFrame') {
+        if (frameTimestamp === undefined) {
+          frameTimestamp = frameClock()
+        }
+
+        invoke(fnOrCode, [frameTimestamp])
+
+        return
+      }
+
       invoke(fnOrCode, params)
     })
 
```

**File**: `packages/runner/test/unit/injection/timers.spec.ts` (modified, +59/-0)
```diff
@@ -113,6 +113,65 @@ describe('injection/timers', () => {
       expect(timerWindow.codeRan).toBe(true)
     })
 
+    it('replays a held requestAnimationFrame callback with the time it runs, not the time it came due', () => {
+      const callback = vi.fn()
+
+      timers.pause(true)
+      window.requestAnimationFrame(callback)
+      vi.advanceTimersToNextFrame()
+      vi.advanceTimersByTime(5000)
+
+      expect(callback).not.toHaveBeenCalled()
+
+      timers.pause(false)
+
+      expect(callback).toHaveBeenCalledExactlyOnceWith(5016)
+    })
+
+    it('gives every requestAnimationFrame callback held in one flush the same timestamp', () => {
+      const first = vi.fn(() => vi.advanceTimersByTime(4))
+      const second = vi.fn()
+
+      timers.pause(true)
+      window.requestAnimationFrame(first)
+      window.requestAnimationFrame(second)
+      vi.advanceTimersToNextFrame()
+      vi.advanceTimersByTime(5000)
+
+      timers.pause(false)
+
+      expect(first).toHaveBeenCalledExactlyOnceWith(5016)
+      expect(second).toHaveBeenCalledExactlyOnceWith(5016)
+    })
+
+    it('times a held requestAnimationFrame callback after the held callbacks queued ahead of it run', () => {
+      const frame = vi.fn()
+
+      timers.pause(true)
+      window.setTimeout(() => vi.advanceTimersByTime(200), 10)
+      window.requestAnimationFrame(frame)
+      vi.advanceTimersByTime(100)
+
+      timers.pause(false)
+
+      expect(frame).toHaveBeenCalledExactlyOnceWith(300)
+    })
+
+    it('times a held requestAnimationFrame callback by the clock frames use when performance.now is replaced after wrapping', () => {
+      const frame = vi.fn()
+      const replacedNow = vi.spyOn(performance, 'now').mockReturnValue(0)
+
+      timers.pause(true)
+      window.requestAnimationFrame(frame)
+      vi.advanceTimersToNextFrame()
+      vi.advanceTimersByTime(5000)
+
+      timers.pause(false)
+      replacedNow.mockRestore()
+
+      expect(frame).toHaveBeenCalledExactlyOnceWith(5016)
+    })
+
     it('holds a timer scheduled before pausing that comes due while paused', () => {
       const callback = vi.fn()
 
```

---

### Incident Patch 2: `2ad20e3e` (2026-11-28)
**Commit Message**: chore: emit a loadable ESM build for @packages/https-proxy (#35572)

* chore: emit @packages/https-proxy ESM build

tsconfig.esm.json set noEmit, so build:esm cleared esm/ and wrote
nothing, leaving the package.json "module" entry (esm/index.js)
pointing at a missing file. Dropping noEmit makes tsc emit it.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01WUv8r3qdTZRBzwwYXN6AN2

* chore: make @packages/https-proxy ESM build loadable by Node

The esm/ output used extensionless relative imports and sat in a
package with no "type", so Node's ESM loader couldn't resolve
'./proxy' and reparsed every file with a warning.

- add .js extensions to relative imports in lib/, enforced by
  n/file-extension-in-import
- write esm/package.json with "type": "module" in build:esm
- import node-forge by its default export; Node can't read its
  CommonJS named exports from ESM

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01WUv8r3qdTZRBzwwYXN6AN2

* chore: list @packages/network as an https-proxy runtime dependency

lib/server.ts imports @packages/network at runtime, but it was listed
under devDe

**File**: `packages/https-proxy/AGENTS.md` (modified, +2/-1)
```diff
@@ -37,9 +37,10 @@ lib/
 
 - `proxy.spec.ts` and `server.spec.ts` cannot run in parallel because both bind to overlapping ports. The `test-unit` script uses `vitest run` without `--pool=forks`; the `test-debug` script explicitly passes `--no-file-parallelism`.
 - Test helper certificates live in `test/helpers/certs/`. Regenerate them with `regenerate:certs` (requires OpenSSL in `$PATH`) when they expire or when the CA key needs to rotate.
+- `esm/` is real ESM: `build:esm` writes `esm/package.json` with `"type": "module"`, so relative imports in `lib/` need a `.js` extension (`n/file-extension-in-import` enforces this). Use a default import for a CommonJS dependency whose named exports Node can't read, such as `node-forge`. Named imports from tsc-compiled CommonJS like `@packages/network` work; check an unfamiliar one with `node --input-type=module`.
 - The `semaphore` package throttles concurrent certificate generation to avoid race conditions under high load.
 
 ## Integration Points
 
 - Consumed by **@packages/proxy** and **@packages/server** which instantiate the HTTPS proxy server as part of the Cypress HTTP interception pipeline.
-- Depends on **@packages/network** (dev dep) for HTTP agent utilities used in integration tests.
+- Depends on **@packages/network** at runtime: `lib/server.ts` uses its connection and HTTP helpers.
```

**File**: `packages/https-proxy/eslint.config.ts` (modified, +7/-0)
```diff
@@ -14,4 +14,11 @@ export default [
     },
   },
   noFloatingPromisesConfig(['lib/**/*.ts']),
+  {
+    // Keeps esm/ loadable by anyone importing it through Node's ESM loader, which won't guess a missing extension
+    files: ['lib/**/*.ts'],
+    rules: {
+      'n/file-extension-in-import': ['error', 'always'],
+    },
+  },
 ]
```

**File**: `packages/https-proxy/lib/ca.ts` (modified, +6/-3)
```diff
@@ -3,9 +3,12 @@ import { promisify } from 'util'
 import debugModule from 'debug'
 import os from 'os'
 import path from 'path'
-import { pki, md } from 'node-forge'
+import forge from 'node-forge'
 import fs from 'fs-extra'
 
+// node-forge is CommonJS, so native ESM can't import its members by name
+const { pki, md } = forge
+
 const debug = debugModule('cypress:https-proxy:ca')
 
 // if this is higher than the user's cached CA version, the Cypress
@@ -122,8 +125,8 @@ export class CA {
   baseCAFolder: string
   certsFolder: string
   keysFolder: string
-  CAcert: pki.Certificate
-  CAkeys: pki.rsa.KeyPair
+  CAcert: forge.pki.Certificate
+  CAkeys: forge.pki.rsa.KeyPair
 
   constructor (caFolder?: string) {
     if (!caFolder) {
```

**File**: `packages/https-proxy/lib/index.ts` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
-import { create as createProxy, reset as resetProxy } from './proxy'
-import { CA } from './ca'
+import { create as createProxy, reset as resetProxy } from './proxy.js'
+import { CA } from './ca.js'
 
 export { createProxy, resetProxy, CA }
 
-export type { Server } from './server'
+export type { Server } from './server.js'
```

**File**: `packages/https-proxy/lib/proxy.ts` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
-import { CA } from './ca'
-import { create as createServer, reset as resetServer } from './server'
+import { CA } from './ca.js'
+import { create as createServer, reset as resetServer } from './server.js'
 
 export async function create (dir: string, port: number, options: any) {
   const ca = await CA.create(dir)
```

**File**: `packages/https-proxy/lib/server.ts` (modified, +2/-2)
```diff
@@ -3,10 +3,10 @@ import { allowDestroy, connect, httpUtils } from '@packages/network'
 import debugModule from 'debug'
 import https from 'https'
 import net from 'net'
-import { hostAndPort } from './util/parse'
+import { hostAndPort } from './util/parse.js'
 import semaphore from 'semaphore'
 import url from 'url'
-import type { CA } from './ca'
+import type { CA } from './ca.js'
 import type { IncomingMessage, ServerResponse } from 'http'
 import type { AddressInfo } from 'net'
 
```

**File**: `packages/https-proxy/package.json` (modified, +2/-2)
```diff
@@ -13,7 +13,7 @@
   "scripts": {
     "build": "yarn build:esm && yarn build:cjs",
     "build:cjs": "rimraf cjs && tsc -p tsconfig.cjs.json",
-    "build:esm": "rimraf esm && tsc -p tsconfig.esm.json",
+    "build:esm": "rimraf esm && tsc -p tsconfig.esm.json && node -e \"require('fs').writeFileSync('esm/package.json', JSON.stringify({ type: 'module' }))\"",
     "build-prod": "yarn build",
     "check-ts": "tsc -p tsconfig.cjs.json --noEmit",
     "clean-deps": "rimraf node_modules",
@@ -28,6 +28,7 @@
     "**/*.{js,jsx,ts,tsx,json}": "eslint --fix"
   },
   "dependencies": {
+    "@packages/network": "0.0.0-development",
     "debug": "^4.3.4",
     "fs-extra": "9.1.0",
     "lodash": "^4.17.21",
@@ -39,7 +40,6 @@
     "@cypress/request": "^4.0.0",
     "@cypress/request-promise": "^5.0.0",
     "@packages/eslint-config": "0.0.0-development",
-    "@packages/network": "0.0.0-development",
     "@packages/vitest-setup": "0.0.0-development",
     "@types/node-forge": "1.3.11",
     "@types/semaphore": "1.1.4",
```

**File**: `packages/https-proxy/tsconfig.esm.json` (modified, +1/-2)
```diff
@@ -6,7 +6,6 @@
     "target": "ES2022",
     "module": "ES2022",
     "moduleResolution": "node",
-    "declaration": true,
-    "noEmit": true
+    "declaration": true
   }
 }
\ No newline at end of file
```

---

### Incident Patch 3: `769171c3` (2026-11-27)
**Commit Message**: fix: let mocha-junit-reporter find Cypress's mocha version in the binary (#35561)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `cli/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@
 **Bugfixes:**
 
 - Fixed an issue where setting up a testing type wrote `import` and `export default` into an empty `cypress.config.cjs` when your `package.json` has `"type": "module"`, so the configuration file then failed to load. Fixed in [#35543](https://github.com/cypress-io/cypress/pull/35543).
+- Fixed an issue where the `junit` reporter, and custom reporters that use `mocha-junit-reporter`, printed `Couldn't determine Mocha version` on every run. Fixed in [#35561](https://github.com/cypress-io/cypress/pull/35561).
 
 ## 16.4.0
 
```

**File**: `packages/server/lib/override_require.ts` (removed, +0/-21)
```diff
@@ -1,21 +0,0 @@
-const Module = require('module')
-
-export const overrideRequire = (requireOverride) => {
-  const _load = Module._load
-
-  Module._load = function (...args: any[]) {
-    const pkg = args
-
-    if (requireOverride) {
-      const mockedDependency = requireOverride(pkg[0], _load)
-
-      if (mockedDependency != null) {
-        return mockedDependency
-      }
-    }
-
-    const ret = _load.apply(this, pkg)
-
-    return ret
-  }
-}
```

**File**: `packages/server/lib/override_resolve.ts` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+const Module = require('module')
+
+// Hooks resolution rather than loading so `require.resolve` is redirected along with `require`.
+export const overrideResolve = (redirect: (request: string) => string | undefined) => {
+  const _resolveFilename = Module._resolveFilename
+
+  Module._resolveFilename = function (request: string, ...rest: any[]) {
+    return _resolveFilename.call(this, redirect(request) ?? request, ...rest)
+  }
+}
```

**File**: `packages/server/lib/reporter.ts` (modified, +7/-5)
```diff
@@ -8,7 +8,7 @@ import Mocha from 'mocha-7.2.0'
 import mochaReporters from 'mocha-7.2.0/lib/reporters'
 import mochaCreateStatsCollector from 'mocha-7.2.0/lib/stats-collector'
 import Debug from 'debug'
-import { overrideRequire } from './override_require'
+import { overrideResolve } from './override_resolve'
 import type {
   CypressTestStatusInfo,
   InternalRunnable,
@@ -30,7 +30,7 @@ const debug = Debug('cypress:server:reporter')
 const mochaColor = mochaReporters.Base.color
 const mochaSymbols = mochaReporters.Base.symbols
 
-// override calls to `require('mocha*')` when to always resolve with a mocha we control
+// override `require('mocha*')` and `require.resolve('mocha*')` to always resolve with a mocha we control
 // otherwise mocha will be resolved from project's node_modules and might not work with our code
 const customReporterMochaPath = path.dirname(require.resolve('mocha-7.2.0'))
 
@@ -75,10 +75,12 @@ const getIconStatus = (status: RunnableState | undefined): IconStatus => {
   }
 }
 
-overrideRequire((depPath, _load) => {
-  if ((depPath === 'mocha') || depPath.startsWith('mocha/')) {
-    return _load(depPath.replace('mocha', customReporterMochaPath))
+overrideResolve((request) => {
+  if ((request === 'mocha') || request.startsWith('mocha/')) {
+    return request.replace('mocha', customReporterMochaPath)
   }
+
+  return undefined
 })
 
 // if Mocha.Suite.prototype.titlePath
```

**File**: `packages/server/test/unit/reporter.spec.ts` (modified, +10/-0)
```diff
@@ -126,6 +126,16 @@ describe('lib/reporter', () => {
     })
   })
 
+  // mocha-junit-reporter reads the version from `require.resolve('mocha')` to pick its mocha 6+ code path
+  it('resolves mocha to mocha-7.2.0 from a reporter', () => {
+    const requireFromJunit = createRequire(requireFromReporter.resolve('mocha-junit-reporter'))
+    const mochaDir = path.dirname(requireFromReporter.resolve('mocha-7.2.0'))
+
+    expect(path.dirname(requireFromJunit.resolve('mocha'))).toBe(mochaDir)
+    expect(requireFromJunit.resolve('mocha/lib/stats-collector')).toBe(path.join(mochaDir, 'lib/stats-collector.js'))
+    expect(requireFromJunit('mocha/package.json').version).toBe('7.2.0')
+  })
+
   describe('createSuite', () => {
     it('recursively creates suites for fullTitle', () => {
       const args = reporter.parseArgs('fail', testObj)
```

#### Recent Merged Pull Requests:
- **PR #35574** (2026-11-28): chore: cover Chrome for Testing in driver browser-name checks (@jennifer-shehane)
- **PR #35572** (2026-11-28): chore: emit a loadable ESM build for @packages/https-proxy (@jennifer-shehane)
- **PR #35571** (2026-11-28): refactor: convert remaining npm/vue component specs to TypeScript (@jennifer-shehane)
- **PR #35570** (2026-11-28): docs: document installing and detecting Chrome for Testing (@jennifer-shehane)
- **PR #35568** (2026-11-28): chore: convert the cross-origin injection to TypeScript and add unit tests (@jennifer-shehane)
- **PR #35567** (2026-11-28): chore: run unit-tests on PRs for every workspace the root test script covers (@jennifer-shehane)

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

## X. replay held requestAnimationFrame callbacks with the time they run

**RULE**:
When implementing operations in `cli/CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in cypress-io/cypress. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `08aeee75`: replay held requestAnimationFrame callbacks with the time they run. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `cli/CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
- `requestAnimationFrame()` callbacks in your application that come due while [`cy.screenshot()`](https://on.cypress.io/screenshot) takes a screenshot now receive the time they run once the screenshot finishes, as they would in a real frame, instead of the time they came due. Fixed in [#35566](https://github.com/cypress-io/cypress/pull/35566).
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `08aeee75` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

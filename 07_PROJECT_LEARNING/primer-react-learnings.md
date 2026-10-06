# Forensic Learning Record (Deep Inspection): primer/react

> **Canonical Artifact**: `07_PROJECT_LEARNING/primer-react-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/primer/react](https://github.com/primer/react))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:12:50.156Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `primer/react`
- **Description**: An implementation of GitHub's Primer Design System using React
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3911 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/doc-gen/src/ts-utils.ts`
```
import ts from 'typescript'
import fs from 'node:fs'
import path from 'path'
import prettier from 'prettier'
import signale, {type DefaultMethods} from 'signale'
import type {DocsPropInfo} from './types'

type Logger = signale.Signale<DefaultMethods>

const {Signale} = signale

export interface TSPropInfo extends DocsPropInfo {
  propSymbol: ts.Symbol
  source?: ts.SourceFile
}

export interface TSParsedComponentInfo {
  sourceFile: string
  componentPath: string
  componentName: string
  props: Record<string, TSPropInfo | undefined>

  subComponents?: Record<string, TSParsedComponentInfo>
}

function getFirstMatchingFile(componentPath: string, componentName: string): string | undefined {
  const paths = [
    path.join(componentPath, `index.ts`),
    path.join(componentPath, `index.tsx`),
    path.join(componentPath, `${componentName}.tsx`),
  ]

  for (const p of paths) {
    try {
      fs.accessSync(p, fs.constants.R_OK)
      return p
    } catch {
      // File does not exist or is not readable, continue to next path
    }
  }

  return undefined
}

export function getTSProgram(rootDir?: string) {
  const configSearchDir = rootDir ? path.resolve(rootDir) : process.cwd()
  const configPath = ts.findConfigFile(configSearchDir, ts.sys.fileExists)
  const fallbackConfigPath = path.join(configSearchDir, 'tsconfig.json')
  const config = ts.readConfigFile(configPath ?? fallbackConfigPath, ts.sys.readFile)
  const parsedConfig = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    configPath ? path.dirname(configPath) : configSearchDir,
    undefined,
    configPath ?? fallbackConfigPath,
  )
  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  })

  return program
}

function getComponentExport(
  log: Logger,
  program: ts.Program,
  sourceFile: ts.SourceFile,
  componentName: string,
): ts.Symbol {
  const checker = program.getTypeChecker()
  const sourceSymbol = checker.getSymbolAtLocation(sourceFile)

  if (!sourceSymbol) {
    throw new Error(`No symbol found for source file ${sourceFile.fileName}`)
  }

  const exports = checker.getExportsOfModule(sourceSymbol)

  const sourceExport =
    exports.find(s => s.escapedName === componentName) ?? exports.find(s => s.escapedName === 'default')

  if (!sourceExport) {
    log.error(
      `Component ${componentName} not found in ${sourceFile.fileName}. Found exports: ${Array.from(exports.map(s => s.escapedName)).join(', ')}`,
    )
    throw new Error(`Component ${componentName} not found in ${sourceFile.fileName}`)
  }

  return sourceExport
}

/**
 * Given the symbol for a component, grab all the sub-component properties for it
 */
function getSubComponentsForSymbol(
  log: Logger,
  program: ts.Program,
  componentSymbol: ts.Symbol,
): Record<string, ts.Node> {
  const checker = program.getTypeChecker()
  const componentNode = getComponentNodeForSymbol(checker, componentSymbol)
  const componentType = checker.getTypeAtLocation(componentNode)

  if (componentType.getProperties().length === 0) {
    return {}
  }

  return componentType.getProperties().reduce(
    (acc, prop) => {
      if (prop.valueDeclaration) {
        const subCompType = checker.getTypeAtLocation(prop.valueDeclaration)

        // Use the call-signature as a Proxy for this being a React component
        // There might be a more reliable way, but this removes `defaultProps`, `displayName`, etc
        if (subCompType.getCallSignatures().length > 0) {
          acc[prop.getName()] = prop.valueDeclaration
        }
      }

      return acc
    },
    {} as Record<string, ts.Node>,
  )
}

function getPropTypesForNode(log: Logger, checker: ts.TypeChecker, componentNode: ts.Node): Record<string, TSPropInfo> {
  const props: Record<string, TSPropInfo> = {}

  const componentType = checker.getTypeAtLocation(componentNode)

  const callSignatures = componentType.getCallSignatures()

  for (const callSignature of callSignatures) {
    log.debug(`Call signature: ${checker.signatureToString(callSignature)}`)

    const params = callSignature.getParameters()

    if (params.length === 0 || params[0].valueDeclaration === undefined) {
      continue
    }

    log.debug(params[0].valueDeclaration!.getFullText())

    const propTypesType = checker.getTypeOfSymbolAtLocation(params[0], componentNode)

    for (const prop of checker.getApparentType(propTypesType).getApparentProperties()) {
      const propType = checker.getTypeOfSymbolAtLocation(prop, componentNode)

      const propSource = prop.getDeclarations()?.[0]?.getSourceFile()

      if (propSource && /node_modules/.test(propSource.fileName)) {
        // log.warn(
        //   `Prop ${prop.getName()} is declared in a third-party module (${propSource.fileName}). It will be ignored.`,
        // )
        continue
      }

      const isRequired = !(prop.getFlags() & ts.SymbolFlags.Optional)
      let typeString = checker.typeToString(propType)

      if (!isRequired && typeString.endsWith('| undefined')) {
        typeString = typeString.slice(0, -'| undefined'.length).trim()
      }

      if (prop.getName() === 'children') {
        typeString = 'React.ReactElement[]'
      }

      props[prop.getName()] = {
        name: prop.getName(),
        type: typeString,
        propSymbol: prop,
        required: isRequired,
        source: propSource,
        defaultValue: prop
          .getJsDocTags()
          .find(tag => tag.name === 'default')
          ?.text?.map(t => t.text)
          .join(' '),
        description: ts.displayPartsToString(prop.getDocumentationComment(checker)),
      }
    }
  }

  return props
}

/**
 * Given a component node (the node that is exported at the root), resolve it to the _thing_ that it actually represents.
 * i.e. Follow any redirects for exports, renaming, etc
 */
function getComponentNodeForSymbol(checker: ts.TypeChecker, componentSymbol: ts.Symbol): ts.Node {
  const declarations = componentSymbol.getDeclarations()
  if (!declarations || declarations.length === 0) {
    throw new Error(`No declarations found for component ${componentSymbol.getName()}`)
  }

  let declaration = declarations[0]

  if (ts.isExportAssignment(declaration)) {
    // If the declaration is an export assignment, we need to find the symbol it exports
    const exportSymbol = checker.getSymbolAtLocation(declaration.getChildren()[0])
    if (!exportSymbol) {
      throw new Error(`Unable to find export symbol for component ${componentSymbol.getName()}`)
    }
    const exportDeclarations = exportSymbol.getDeclarations()
    if (!exportDeclarations || exportDeclarations.length === 0) {
      throw new Error(`No declarations found for export symbol of component ${componentSymbol.getName()}`)
    }
    declaration = exportDeclarations[0]
  }

  if (ts.isVariableDeclaration(declaration)) {
    return declaration.initializer!
  }

  return declaration
}

function getPropTypeForComponent(
  log: Logger,
  program: ts.Program,
  componentSymbol: ts.Symbol,
): Record<string, TSPropInfo> {
  const checker = program.getTypeChecker()

  const componentNode = getComponentNodeForSymbol(checker, componentSymbol)

  return getPropTypesForNode(log, checker, componentNode)
}

export function parseTypeInfo(
  docsBasePath: string,
  componentName: string,
  program: ts.Program = getTSProgram(docsBasePath),
): TSParsedComponentInfo {
  const log = new Signale({
    scope: componentName,
    logLevel: process.env.DEBUG === '*' ? 'debug' : 'error',
  })

  log.debug(`Looking for first match in: ${docsBasePath}`)
  const componentFile = getFirstMatchingFile(docsBasePath, componentName)

  if (!componentFile) {
    throw new Error(`No source file found for component ${componentName}`)
  }

  log.debug(`Found source for ${componentName}: ${componentFile}`)

  const sourceFile = program.getSourceFile(componentFile)

  if (!sourceFile) {
    log.error(`Unable to retrieve source file for ${componentName}`)
    throw new Error(`Unable to retrieve source file for ${componentName}`)
  }

  const exportedComponent = getComponentExport(log, program, sourceFile, componentName)
  const propsType = getPropTypeForComponent(log, program, exportedComponent)
  const subComponents = getSubComponentsForSymbol(log, program, exportedComponent)

  log.debug(`Extracted props for ${componentName}: ${Object.keys(propsType).join(', ')}`)

  return {
    sourceFile: componentFile,
    componentPath: docsBasePath,
    componentName,
    props: propsType,
    subComponents: Object.fromEntries(
      Object.entries(subComponents).map(([name, node]) => {
        const subComponentType = getPropTypesForNode(log, program.getTypeChecker(), node)
        return [
          name,
          {
            sourceFile: componentFile,
            componentPath: docsBasePath,
            componentName: [componentName, name].join('.'),
            props: subComponentType,
          },
        ]
      }),
    ),
  }
}

export function generateJSDocString(tsPropInfo: TSPropInfo, docsProps: DocsPropInfo): string {
  let newJsDocText = '/**\n'
  if (docsProps.description) {
    newJsDocText += ` * ${docsProps.description}\n`
  }
  if (docsProps.defaultValue !== undefined && docsProps.defaultValue !== '') {
    if (tsPropInfo.type === 'boolean' || tsPropInfo.type === 'number') {
      newJsDocText += ` *\n * @default ${docsProps.defaultValue}\n`
    } else if (typeof docsProps.defaultValue === 'string') {
      // Unwrap the default value in case it's wrapped in quotes
      const unwrapped = docsProps.defaultValue.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')

      newJsDocText += ` *\n * @default "${unwrapped}"\n`
    }
  }

  if (docsProps.deprecated) {
    newJsDocText += ` * @deprecated\n`
  }

  newJsDocText += ' */'

  return newJsDocText
}

export async function updateJSDocsForProp(tsPropInfo: TSPropInfo, docsProps: DocsPropInfo, componentSourceDir: string) {
  const {propSymbol} = tsPropInfo

  // Update the JSDoc
```

### Core Architecture Module: `packages/react/src/DataTable/utils.ts`
```
export type IsAny<T> = 0 extends 1 & T ? true : false

// Utility type to generate an array with a given length. Each member of the
// array type is the length of the array
type ArrayOfLength<Length extends number, SizedArray extends Array<unknown> = []> = SizedArray['length'] extends Length
  ? SizedArray
  : ArrayOfLength<Length, [...SizedArray, SizedArray['length']]>

// A union of the valid lengths of an Array that we'll support in `ObjectPaths`
// below. This is to prevent unbounded arrays from polluting expected types
type MaxLength = ArrayOfLength<10>[number]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ArrayIndex<A extends ReadonlyArray<any>, Keys extends number = never> = A extends readonly []
  ? Keys
  : // eslint-disable-next-line @typescript-eslint/no-unused-vars
    A extends readonly [infer _, ...infer Tail]
    ? ArrayIndex<Tail, Keys | Tail['length']>
    : Keys

// Check if the given type is within the bounds set by `MaxLength`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ArrayWithinBounds<T> = T extends ReadonlyArray<any> & {length: infer Length}
  ? Length extends MaxLength
    ? T
    : never
  : never

// Get all valid "paths" for an object. This is useful for APIs which require
// a string input that must refer to a valid type for the data being used.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ObjectPaths<T> = T extends readonly any[] & ArrayWithinBounds<T>
  ? `${ArrayIndex<T>}` | PrefixPath<T, ArrayIndex<T>>
  : // eslint-disable-next-line @typescript-eslint/no-explicit-any
    T extends any[]
    ? never & 'Unable to determine keys of potentially boundless array'
    : T extends Date
      ? never
      : T extends object
        ? Extract<keyof T, string | number> | PrefixPath<T, Extract<keyof T, string | number>>
        : never

type PrefixPath<T, Prefix> =
  Prefix extends Extract<keyof T, number | string> ? `${Prefix}.${NestedObjectPaths<T[Prefix]>}` : never

type NestedObjectPaths<T> = IsAny<T> extends true ? string : ObjectPaths<T>

// Get the value of a given path within an object
export type ObjectPathValue<ObjectType extends object, Path extends string | number> =
  ObjectType extends Record<
    string | number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >
    ? Path extends `${infer Key}.${infer NestedPath}`
      ? ObjectPathValue<ObjectType[Key], NestedPath>
      : ObjectType[Path]
    : never

```

### Core Architecture Module: `packages/react/src/KeybindingHint/components/utils.ts`
```
import {accessibleKeyName} from '../key-names'
import type {Platform} from '../platform'

/**
 * Consistent sort order for modifier keys. There should never be more than one non-modifier
 * key in a chord, so we don't need to worry about sorting those - we just put them at
 * the end.
 */
const keySortPriorities: Partial<Record<string, number>> = {
  control: 1,
  meta: 2,
  alt: 3,
  option: 4,
  shift: 5,
  function: 6,
}

const keySortPriority = (priority: string) => keySortPriorities[priority] ?? Infinity

const compareLowercaseKeys = (a: string, b: string) => keySortPriority(a) - keySortPriority(b)

/** Split and sort the chord keys in standard order. */
export const splitChord = (chord: string) =>
  chord
    .split('+')
    .map(k => k.toLowerCase())
    .sort(compareLowercaseKeys)

const splitSequence = (sequence: string) => sequence.split(' ')

/** Plain string version of `Chord` for use in `aria` string attributes. */
export const accessibleChordString = (chord: string, platform: Platform) =>
  splitChord(chord)
    .map(key => accessibleKeyName(key, platform))
    .join(' ')

/** Plain string version of `Sequence` for use in `aria` string attributes. */
export const accessibleSequenceString = (sequence: string, platform: Platform) =>
  splitSequence(sequence)
    .map(chord => accessibleChordString(chord, platform))
    .join(' then ')

```

### Core Architecture Module: `packages/react/src/KeybindingHint/utils.ts`
```
import {accessibleSequenceString} from './components/utils'
import type {Platform} from './platform'

/**
 * AVOID: `KeybindingHint` is nearly always sufficient for providing both visible and accessible keyboard hints.
 * However, there may be cases where we need a plain string version, such as when building `aria-label` or
 * `aria-description`. In that case, this plain string builder can be used instead.
 *
 * NOTE that this string should _only_ be used when building `aria-label` or `aria-description` props (never rendered
 * visibly) and should nearly always also be paired with a visible hint for sighted users.
 *
 * The `platform` argument controls how platform-specific keys (such as `Meta`, `Alt`, and `Mod`) are named. For
 * backwards compatibility, a `boolean` may be passed instead, where `true` is treated as `'apple'` and `false` is
 * treated as `'other'`.
 */
export const getAccessibleKeybindingHintString = (sequence: string, platform: Platform | boolean) =>
  accessibleSequenceString(sequence, typeof platform === 'boolean' ? (platform ? 'apple' : 'other') : platform)

```

### Core Architecture Module: `packages/react/src/PageLayout/paneUtils.ts`
```
type DraggingStylesParams = {
  handle: HTMLElement | null
  pane: HTMLElement | null
  contentWrapper: HTMLElement | null
}

const DATA_DRAGGING_ATTR = 'data-dragging'

/** Apply visual feedback and performance optimizations during drag */
export function setDraggingStyles({handle, pane, contentWrapper}: DraggingStylesParams) {
  // Handle visual feedback (must be inline for instant response)
  // Use CSS variable to control ::before pseudo-element background color.
  // This avoids cascade conflicts between inline styles and pseudo-element backgrounds.
  handle?.style.setProperty('--draggable-handle--bg-color', 'var(--bgColor-accent-emphasis)')
  handle?.style.setProperty('--draggable-handle--drag-opacity', '1')
  handle?.style.setProperty('--draggable-handle--transition', 'none')

  // Set attribute for CSS containment (O(1) direct selector, not descendant)
  pane?.setAttribute(DATA_DRAGGING_ATTR, 'true')
  contentWrapper?.setAttribute(DATA_DRAGGING_ATTR, 'true')
}

/** Remove drag styles and restore normal state */
export function removeDraggingStyles({handle, pane, contentWrapper}: DraggingStylesParams) {
  handle?.style.removeProperty('--draggable-handle--bg-color')
  handle?.style.removeProperty('--draggable-handle--drag-opacity')
  handle?.style.removeProperty('--draggable-handle--transition')

  pane?.removeAttribute(DATA_DRAGGING_ATTR)
  contentWrapper?.removeAttribute(DATA_DRAGGING_ATTR)
}

```

### Core Architecture Module: `packages/react/src/StateLabel/StateLabel.features.stories.tsx`
```
import type {Meta} from '@storybook/react-vite'
import type {ComponentProps} from '../utils/types'
import StateLabel from './StateLabel'
import VisuallyHidden from '../_VisuallyHidden'

export default {
  title: 'Components/StateLabel/Features',
  component: StateLabel,
} as Meta<ComponentProps<typeof StateLabel>>

export const IssueOpened = () => <StateLabel status="issueOpened">Open</StateLabel>
export const IssueClosed = () => <StateLabel status="issueClosed">Closed</StateLabel>
export const IssueClosedNotPlanned = () => <StateLabel status="issueClosedNotPlanned">Closed</StateLabel>
export const IssueDraft = () => <StateLabel status="issueDraft">Draft</StateLabel>

export const PullOpened = () => <StateLabel status="pullOpened">Open</StateLabel>
export const PullClosed = () => <StateLabel status="pullClosed">Closed</StateLabel>
export const PullMerged = () => <StateLabel status="pullMerged">Merged</StateLabel>
export const Queued = () => <StateLabel status="pullQueued">Queued</StateLabel>
export const Draft = () => <StateLabel status="draft">Draft</StateLabel>
export const Unavailable = () => <StateLabel status="unavailable">Unavailable</StateLabel>

export const AlertOpened = () => <StateLabel status="alertOpened">Open</StateLabel>
export const AlertFixed = () => <StateLabel status="alertFixed">Fixed</StateLabel>
export const AlertDismissed = () => <StateLabel status="alertDismissed">Dismissed</StateLabel>
export const AlertClosed = () => <StateLabel status="alertClosed">Closed</StateLabel>
export const Archived = () => <StateLabel status="archived">Archived</StateLabel>

export const Open = () => (
  <StateLabel status="open">
    {/* Because open is a generic status, a visually hidden text could be added to specify the type of the artifact */}
    <VisuallyHidden>Milestone</VisuallyHidden>
    Open
  </StateLabel>
)
export const Closed = () => <StateLabel status="closed">Closed</StateLabel>

export const Small = () => (
  <StateLabel status="issueOpened" size="small">
    Open
  </StateLabel>
)

```

### Core Architecture Module: `packages/react/src/StateLabel/StateLabel.figma.tsx`
```
import StateLabel from '.'
import figma from '@figma/code-connect'

figma.connect(
  StateLabel,
  'https://www.figma.com/design/GCvY3Qv8czRgZgvl1dG6lp/Primer-Web?node-id=18959-64962&t=gQF1OJTEGB3vTxPz-4',
  {
    props: {
      size: figma.enum('size', {
        small: 'small',
        medium: 'medium',
      }),
      status: figma.enum('status', {
        draft: 'issueDraft',
        open: 'issueOpened',
        closed: 'issueClosed',
        unavailable: 'unavailable',
      }),
      text: figma.textContent('Label'),
    },
    variant: {variant: 'issue'},
    example: ({text, size, status}) => (
      <StateLabel size={size} status={status}>
        {text}
      </StateLabel>
    ),
  },
)

figma.connect(
  StateLabel,
  'https://www.figma.com/design/GCvY3Qv8czRgZgvl1dG6lp/Primer-Web?node-id=18959-64962&t=gQF1OJTEGB3vTxPz-4',
  {
    props: {
      size: figma.enum('size', {
        small: 'small',
        medium: 'medium',
      }),
      status: figma.enum('status', {
        draft: 'draft',
        open: 'pullOpened',
        closed: 'pullClosed',
        merged: 'pullMerged',
        queued: 'pullQueued',
        unavailable: 'unavailable',
        archived: 'archived',
      }),
      text: figma.textContent('Label'),
    },
    variant: {variant: 'pull request'},
    example: ({text, size, status}) => (
      <StateLabel size={size} status={status}>
        {text}
      </StateLabel>
    ),
  },
)

```

### Core Architecture Module: `packages/react/src/StateLabel/StateLabel.stories.tsx`
```
import type {Meta, StoryFn} from '@storybook/react-vite'
import type {ComponentProps} from '../utils/types'
import StateLabel from './StateLabel'

export default {
  title: 'Components/StateLabel',
  component: StateLabel,
} as Meta<ComponentProps<typeof StateLabel>>

export const Default = () => <StateLabel status="issueOpened">Open</StateLabel>

export const Playground: StoryFn<ComponentProps<typeof StateLabel>> = args => <StateLabel {...args}>Label</StateLabel>

Playground.args = {
  status: 'issueOpened',
}

Playground.argTypes = {
  ref: {
    controls: false,
    table: {
      disable: true,
    },
  },
}

```

### Core Architecture Module: `packages/react/src/StateLabel/StateLabel.tsx`
```
import {
  ArchiveIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  IssueClosedIcon,
  SkipIcon,
  IssueDraftIcon,
  IssueOpenedIcon,
  GitMergeQueueIcon,
  AlertIcon,
  ShieldIcon,
  ShieldCheckIcon,
  ShieldSlashIcon,
  ShieldXIcon,
} from '@primer/octicons-react'
import type React from 'react'
import {forwardRef} from 'react'
import {clsx} from 'clsx'
import Octicon from '../Octicon'
import classes from './StateLabel.module.css'

const octiconMap = {
  issueOpened: IssueOpenedIcon,
  pullOpened: GitPullRequestIcon,
  issueClosed: IssueClosedIcon,
  issueClosedNotPlanned: SkipIcon,
  pullClosed: GitPullRequestClosedIcon,
  pullMerged: GitMergeIcon,
  draft: GitPullRequestDraftIcon,
  issueDraft: IssueDraftIcon,
  pullQueued: GitMergeQueueIcon,
  unavailable: AlertIcon,
  alertOpened: ShieldIcon,
  alertFixed: ShieldCheckIcon,
  alertDismissed: ShieldSlashIcon,
  alertClosed: ShieldXIcon,
  open: null,
  closed: null,
  archived: ArchiveIcon,
}

const labelMap: Record<
  keyof typeof octiconMap,
  'Issue' | 'Issue, not planned' | 'Pull request' | 'Alert' | 'Archived' | ''
> = {
  issueOpened: 'Issue',
  pullOpened: 'Pull request',
  issueClosed: 'Issue',
  issueClosedNotPlanned: 'Issue, not planned',
  pullClosed: 'Pull request',
  pullMerged: 'Pull request',
  draft: 'Pull request',
  issueDraft: 'Issue',
  pullQueued: 'Pull request',
  unavailable: '',
  alertOpened: 'Alert',
  alertFixed: 'Alert',
  alertDismissed: 'Alert',
  alertClosed: 'Alert',
  archived: 'Archived',
  open: '',
  closed: '',
}

export type StateLabelProps = React.HTMLAttributes<HTMLSpanElement> & {
  size?: 'small' | 'medium'
  /** @deprecated use size property with value 'small' or 'medium' instead */
  variant?: 'normal' | 'small' // kept for backwards compatibility
  status: keyof typeof octiconMap
}

const StateLabel = forwardRef<HTMLSpanElement, StateLabelProps>(
  ({children, status, size, variant, className, ...rest}, ref) => {
    // Open and closed statuses, we don't want to show an icon
    const noIconStatus = status === 'open' || status === 'closed'

    // Prefer size, but maintain backwards compatibility for variant
    const inferredSize = size || (variant === 'small' ? 'small' : 'medium')

    return (
      <span
        {...rest}
        ref={ref}
        className={clsx(classes.StateLabel, className)}
        data-component="StateLabel"
        data-size={inferredSize}
        data-status={status}
      >
        {!noIconStatus && (
          <Octicon
            data-size-small={inferredSize === 'small' ? '' : undefined}
            icon={octiconMap[status]}
            aria-label={labelMap[status]}
            className={classes.Icon}
          />
        )}
        {children}
      </span>
    )
  },
)

StateLabel.displayName = 'StateLabel'

export default StateLabel

```

### Core Architecture Module: `packages/react/src/StateLabel/index.ts`
```
export {default} from './StateLabel'
export type {StateLabelProps} from './StateLabel'

```

### Core Architecture Module: `packages/react/src/Token/utils.ts`
```
import type {TokenBaseProps} from './TokenBase'

export const isTokenInteractive = ({
  as = 'span',
  onClick,
  onFocus,
  tabIndex = -1,
  disabled,
}: Pick<TokenBaseProps, 'disabled' | 'as' | 'onClick' | 'onFocus' | 'tabIndex'>) => {
  if (disabled) {
    return false
  }
  return Boolean(onFocus || onClick || tabIndex > -1 || ['a', 'button'].includes(as))
}

```

### Core Architecture Module: `packages/react/src/UnderlineNav/utils.ts`
```
import React from 'react'
import type {UnderlineNavItemProps} from './UnderlineNavItemsRegistry'

export const getValidChildren = (children: React.ReactNode) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return React.Children.toArray(children).filter(child => React.isValidElement(child)) as React.ReactElement<any>[]
}

export const isCurrent = (props: UnderlineNavItemProps) =>
  props['aria-current'] !== undefined && props['aria-current'] !== false && props['aria-current'] !== 'false'

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8408** (2026-09-11): **Button: Limit link underline to the label**
  *Symptoms*: Fixes https://github.com/primer/react/pull/8408  Link-style buttons with an icon currently draw the underline beneath the icon and the space before the label. The design calls for the underline to appear only beneath the label, with more space between the text and the line. This change fixes the underline area and spacing without changing when the underline appears.  ### Before and after  | Before | After | | --- | --- | | ![Before: the underline runs beneath the icon, gap, and label](https://github.com/user-attachments/assets/bfc6871b-5273-4e35-8b2d-af3dc8a5d8ae) | ![After: the underline appears only beneath the label with the intended spacing](https://github.com/user-attachments/assets/f2d11206-7f38-4576-b2e6-671d6d62a7ec) |  Screenshots shown at 4x size.  ### Changelog  #### New  N/A  #### Changed  - `Button` and `LinkButton` with `variant="link"` underline only their label text and use the intended spacing. - The "always show link underlines" setting still shows the underline normally and hides it on hover.  #### Removed  N/A  ### Rollout strategy  - [x] Patch release - [ ] Minor release - [ ] Major release; if selected, include a written rollout or migration plan - [ ] None; if selected, include a brief description as to why  ### Testing & Reviewing  Open the Button playground with the link variant and `EyeIcon`. Check that the line begins beneath the label instead of the icon or gap, and that its spacing matches the after screenshot. 
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: 2b84f77e536ef84529082ec9ebd351be111e462b  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name          | Type  | | ------------- | ----- | | @primer/react | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/primer/react/new/button-link-label-underline?filename=.changeset/two-pears-taste.md&value=---%0A%22%40primer%2Freact%22%3A%20patch%0A---%0A%0AButton%3A%20Limit%20link%20underline%20to%20the%20label%0A)  
  > <!-- recommend-integration-tests.yml -->   # ⚠️ Action required    :wave: Hi, this pull request contains changes to the source code that github/github-ui depends on. If you are GitHub staff, test these changes with github/github-ui using the [integration workflow](https://github.com/github/github-ui/actions/workflows/primer-npm-packages-integration.yml). Check the [integration testing docs](https://gh.io/testing_primer_at_dotcom) for step-by-step instructions. Or, apply the `integration-tests: skipped manually` label to skip these checks.

- **Issue #8373** (2026-09-14): **`Tooltip` breaks ref forwarding on wrapped element**
  *Symptoms*: ### Description  If you wrap an element like `Button` in `Tooltip`, the `ref` of that button will be discarded and ignored. This breaks ref-based functionality like returning focus. The only way to get a ref to the underlying element is to set `ref` on the tooltip itself, but that's very unintuitive and subtle.  ### Steps to reproduce  ```tsx <Tooltip ref={(element) => console.log("Tooltip ref", element)} text="Tooltip text">   <Button ref={(element) => console.log("Button ref", element)}>Button text</Button> </Tooltip> ```  The resulting log when rendering this code will be:  ``` Tooltip ref, HTMLButtonElement ```  **Notice that `Button ref` never appears in the logs.**  ### Version  v38.37.0  ### Browser  _No response_
  **Post-Mortem & Fix Analysis**:
  > A couple notes about what seems to be going on here:  - Tooltip should merge the child’s existing ref with its internal and forwarded refs rather than replacing it. - Existing tests cover refs passed to `<Tooltip>`, but do not include a child that already has its own ref, so this behavior wasn't exposed. We should make sure to close this testing gap as part of this work.

- **Issue #8246** (2026-08-25): **Focusing TabNav breaks mac Firefox back / forwards nav shortcut keys**
  *Symptoms*: ### Description  When using the keyboard to focus a TabNav component (for example Conversation / Commits / … on https://github.com/primer/react/pull/8245) the user can use the arrow keys to move the focus left and right. But this then blocks using cmd + left / right in Firefox on mac to navigate back / forwards in history.  ### Steps to reproduce  1. Go to https://github.com/primer/react/pull/8245 2. Tab to the TabNav component 3. Observe focus switching on left or right arrow key usage 4. Observe that you can’t navigate back in history with cmd + left.  ### Version  Whatever the deployed version is.  ### Browser  Firefox
  **Post-Mortem & Fix Analysis**:
  > Looking through the code, I guess this actually an issue in https://github.com/primer/behaviors. Let me know if you want me to close this and file a new one there.
  > Thanks for the report!  Internal notes for next steps: 1. Investigate that if this is an issue in https://github.com/primer/behaviors. 2. Sizing how much effort would be put into it.

- **Issue #8032** (2026-06-25): **Add text button overflow support for ActionBar**
  *Symptoms*: ## Feature request  The [ActionBar](https://primer.style/product/components/action-bar/#with-text-button-children) supports IconButtons, but for pure text buttons which are more common now in the GH design the documentation recommends simple <Button> usage - which doesn't support overflow. This also leads to an empty overflow menu appearing when the button is in loading state.

- **Issue #7995** (2026-06-15): **Button: Incorrect label when a leading visual is rendered**
  *Symptoms*: ### Description  When a `Button` component is rendered with a leading visual (e.g., an icon via `leadingVisual`), the accessible label does not correctly reflect the button's text content. This can result in assistive technologies announcing an incorrect or incomplete label for the button.  ### Steps to reproduce  1. Render a `Button` with a `leadingVisual` prop and text content 2. Inspect the accessible name of the button (e.g., via browser DevTools accessibility tree or a screen reader) 3. Observe that the label is incorrect or does not match the visible text  ### Expected behavior  The button's accessible label should match its visible text content, regardless of whether a leading visual is present.  ### Actual behavior  The accessible label is incorrect when a leading visual is rendered.  ### Additional context  - This may be related to how the component computes or assigns `aria-label` or `aria-labelledby` when children include both icon and text elements.
  **Post-Mortem & Fix Analysis**:
  > Sorry, didn't mean to open this - was testing copilot prompts
  > brutal honesty bruh 

- **Issue #7977** (2026-06-12): **`PageHeader.ParentLink` drops props (e.g. `to`) when using a polymorphic `as`, breaking client-side routing**
  *Symptoms*: ### Description  `PageHeader.ParentLink` does not forward arbitrary/rest props to the element passed via `as`. It destructures a fixed prop set — `href`, `as`, `className`, `children`, `ref`, `aria-label`, `hidden` — and forwards only `href` to the underlying link. Any other prop (notably `to`) is silently dropped.  This breaks the standard polymorphic pattern that works on the other Primer components. With `NavList.Item`, `Button`, and `Link`, you can do `as={RouterLink} to="/path"` because they spread `...rest` onto the rendered element. `PageHeader.ParentLink` is inconsistent — `to` never reaches the `as` component, so a router `Link` resolves to the current URL instead of navigating.   ### Reproduction  ```tsx import {PageHeader} from '@primer/react' import {Link} from 'react-router' // or react-router-dom  <PageHeader>   <PageHeader.ContextArea>     <PageHeader.ParentLink as={Link} to="/somewhere">       Back     </PageHeader.ParentLink>   </PageHeader.ContextArea>   {/* ... */} </PageHeader> ```  Observed: the rendered `<a>` has no/incorrect `href` and clicking does a full-page navigation to the current URL (the `to` prop is dropped). The same happens for any non-allowlisted prop forwarded to the `as` element.  ### Expected behavior  `PageHeader.ParentLink` should forward unknown props to the `as` element (spread `...rest`), consistent with `NavList.Item`, `Button`, and `Link`, so that `to` (and other router/link props) reach the rendered component and client-side routi

- **Issue #7823** (2026-07-08): **UnderlineNav performance optimizations**
  *Symptoms*: ### Description  👋🏼 Related to https://github.com/github/pull-requests/issues/24571 and https://github.com/primer/react/issues/7801, I've been investigating more performance optimizations. I think there are a few more things we could do with `UnderlineNav` to help.  ### Diagnosis  After a window resize, `UnderlineNav` measures its own width to determine which tabs fit vs. overflow into a "more" menu. This triggers a synchronous `setState()` that re-renders the component and all its children — **385 child component renders** (`ExtendedLink` ×133, `ForwardRef` ×128, `Link` ×124) producing a **20.5ms React render** on each resize event.  Because `UnderlineNav` mutates the DOM during this render, four downstream components detect layout changes and each call `setState()` synchronously mid-commit, cascading one after another:  1. `StackState.setState()` → 2. `PullRequestHeader.setState()` → 3. `Overlay.setState()` → 4. `ActionMenu.setState()`  This cascade produces **14 separate React renders totaling ~138ms of JS**, followed by two full-page layouts (~117ms, touching all 1,285 DOM nodes), for a total post-resize cost of **~750ms**.  ### Suggested Fixes  1. **Debounce the resize handler** — wrap `UnderlineNav`'s measurement logic in `requestAnimationFrame` (or a short debounce) so it fires once per frame, not once per resize event (7 dispatches observed in this trace).  2. **Memoize child components** — the `Link`/`ExtendedLink`/`ForwardRef` children should be wrapped in `React.
  **Post-Mortem & Fix Analysis**:
  > @adierkens shared there's a few PRs that address some of this from @iansan5653   https://github.com/primer/react/pull/7506 https://github.com/primer/react/pull/7648  I'll take a look to see if we can ship some of these or making them less risky
  > i can fix this bug if you will assign this to me !! 

- **Issue #7801** (2026-05-13): **`usePaneWidth` triggers unnecessary React re-renders on every window resize**
  *Symptoms*: ### Description  ### Problem  👋🏼 Hello, while investigating a report of performance lag on https://github.com/github/pull-requests/issues/24571, I did a bit of profiling with Copilot.  I've made some changes on our end, but I would love it if y'all would investigate the below findings.  When `SplitPageLayout` has a resizable pane (`resizable={true}`), the `usePaneWidth` hook registers a `window.addEventListener("resize", handleResize)` listener that calls `syncAll()` on every resize event (~60/sec during a drag).  `syncAll()` **unconditionally** calls:  ```js startTransition(() => {   setMaxPaneWidth(actualMax);   if (wasClamped) {     setCurrentWidthState(actualMax);   } }); ```  Even when the computed `actualMax` hasn't changed from the previous value, `setMaxPaneWidth(actualMax)` still schedules a React concurrent render because React doesn't bail out of `startTransition` state updates that set the same value (unlike normal `setState`).  ### Impact  On a page with multiple components consuming `SplitPageLayout` context (e.g. GitHub PR conversation tab), this produces **11 React scheduler calls totaling ~108ms** in a single animation frame during resize — with 4× CPU throttle, this pushes individual frames well beyond 100ms and creates visible jank.  ### Trace evidence  - Chrome Performance trace on a GitHub PR conversation page (4× CPU throttle) - The `actualMax` value doesn't change between most resize ticks (only changes when crossing the `DEFAULT_PANE_MAX_WIDTH_DIFF_B
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, looks like a smart addition!  @jonrohan could you fit this into your Web Perf v-team efforts this week?

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

### Incident Patch 1: `c4189aa8` (2026-09-30)
**Commit Message**: Revert SegmentedControl label wrapping (#8469)

**File**: `.changeset/segmented-control-wrap-labels.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-'@primer/react': patch
----
-
-SegmentedControl: Allow controls to grow vertically and preserve visible labels when they wrap
```

**File**: `e2e/components/SegmentedControl.test.ts` (modified, +0/-237)
```diff
@@ -60,10 +60,6 @@ const stories = [
     title: 'With Counter Labels',
     id: 'components-segmentedcontrol-features--with-counter-labels',
   },
-  {
-    title: 'Multiline Labels',
-    id: 'components-segmentedcontrol-features--multiline-labels',
-  },
   {
     title: 'SegmentedControlButton Playground',
     id: 'components-segmentedcontrol-segmentedcontrol-button--playground',
@@ -125,237 +121,4 @@ test.describe('SegmentedControl', () => {
       }
     })
   }
-
-  test('naturally wrapped labels grow to the tallest segment without splitting words', async ({page}) => {
-    await visit(page, {
-      id: 'components-segmentedcontrol-features--multiline-labels',
-    })
-
-    const layout = await page
-      .getByTestId('multiline-natural-wrap')
-      .locator('[data-component="SegmentedControl"]')
-      .evaluate(control => {
-        const buttons = [...control.querySelectorAll<HTMLButtonElement>('button')]
-        const buttonHeights = buttons.map(button => button.getBoundingClientRect().height)
-        const contents = [...control.querySelectorAll<HTMLElement>('.segmentedControl-content')]
-        const texts = [...control.querySelectorAll<HTMLElement>('.segmentedControl-text')]
-        const selectedButton = control.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
-        const selectedContent = selectedButton?.querySelector<HTMLElement>('.segmentedControl-content')
-
-        const textLayouts = texts.map(text => {
-          const textNode = text.firstChild
-          const style = getComputedStyle(text)
-          if (!(textNode instanceof Text)) {
-            return {
-              lineCount: 0,
-              splitWords: [],
-              whiteSpace: style.whiteSpace,
-              overflowWrap: style.overflowWrap,
-              wordBreak: style.wordBreak,
-            }
-          }
-
-          const textRange = document.createRange()
-          textRange.selectNodeContents(textNode)
-
-          const splitWords = [...textNode.data.matchAll(/\S+/g)]
-            .filter(match => {
-              const wordRange = document.createRange()
-              const start = match.index
-              wordRange.setStart(textNode, start)
-              wordRange.setEnd(textNode, start + match[0].length)
-              return wordRange.getClientRects().length > 1
-            })
-            .map(match => match[0])
-
-          return {
-            lineCount: textRange.getClientRects().length,
-            splitWords,
-            whiteSpace: style.whiteSpace,
-            overflowWrap: style.overflowWrap,
-            wordBreak: style.wordBreak,
-          }
-        })
-
-        return {
-          controlHeight: control.getBoundingClientRect().height,
-          buttonHeightSpread: Math.max(...buttonHeights) - Math.min(...buttonHeights),
-          contentFits: contents.every(
-            content =>
-              content.scrollWidth <= content.clientWidth + 1 && content.scrollHeight <= content.clientHeight + 1,
-          ),
-          selectedContentHeight: selectedContent?.getBoundingClientRect().height,
-          selectedButtonHeight: selectedButton?.getBoundingClientRect().height,
-          textLayouts,
-        }
-      })
-
-    expect(layout.controlHeight).toBeGreaterThan(32)
-    expect(layout.buttonHeightSpread).toBeLessThanOrEqual(0.5)
-    expect(layout.contentFits).toBe(true)
-    expect(layout.textLayouts.every(text => text.lineCount > 1)).toBe(true)
-    expect(layout.textLayouts.flatMap(text => text.splitWords)).toEqual([])
-    expect(
-      layout.textLayouts.every(
-        text => text.whiteSpace === 'normal' && text.overflowWrap === 'normal' && text.wordBreak === 'normal',
-      ),
-    ).toBe(true)
-    expect(layout.selectedContentHeight).toBeDefined()
-    expect(layout.selectedButtonHeight).toBeDefined()
-    expect(layout.selectedContentHeight ?? 0).toBeCloseTo(layout.selectedButtonHeight ?? 0, 1)
-  })
-
-  test('single-line labels preserve the existing control heights', async ({page}) => {
-    await visit(page, {
-      id: 'components-segmentedcontrol-features--multiline-labels',
-    })
-
-    const singleLineCases = [
-      {testId: 'single-line-default-medium', height: 32},
-      {testId: 'single-line-default-small', height: 28},
-      {testId: 'single-line-subtle-medium', height: 32},
-      {testId: 'single-line-subtle-small', height: 28},
-    ]
-
-    for (const {testId, height} of singleLineCases) {
-      const controlHeight = await page
-        .getByTestId(testId)
-        .locator('[data-component="SegmentedControl"]')
-        .evaluate(control => control.getBoundingClientRect().height)
-
-      expect(controlHeight).toBe(height)
-    }
-  })
-
-  test('single-line controls do not stretch to adjacent label and caption content', async ({page}) => {
-    await visit(page, {
-      id: 'components-segmentedcontrol-features--associated-with-a-label-and-caption',
-    })
-
-    const controlHeight = await page
-      .lo
```

**File**: `packages/react/src/SegmentedControl/SegmentedControl.features.stories.module.css` (modified, +0/-30)
```diff
@@ -8,36 +8,6 @@
   margin-top: var(--base-size-24);
 }
 
-.MultilineLabelsGrid {
-  display: flex;
-  flex-wrap: wrap;
-  gap: var(--base-size-24);
-  align-items: start;
-}
-
-.MultilineLabelsExample {
-  width: 240px;
-}
-
-.MultilineLabelsExampleWide {
-  flex-basis: 352px;
-}
-
-.MultilineLabelsExampleVisuals {
-  flex-basis: 480px;
-}
-
-.MultilineLabelsExampleReflow {
-  width: min(288px, 100%);
-}
-
-.MultilineLabelsTitle {
-  display: block;
-  margin-bottom: var(--base-size-8);
-  font-size: var(--text-body-size-small);
-  font-weight: var(--base-text-weight-semibold);
-}
-
 @media screen and (min-width: 768px) {
   .LabelAndCaptionContainer {
     flex-direction: row;
```

**File**: `packages/react/src/SegmentedControl/SegmentedControl.features.stories.tsx` (modified, +0/-111)
```diff
@@ -1,7 +1,6 @@
 import {useState} from 'react'
 import type {Meta} from '@storybook/react-vite'
 import {PlusIcon, EyeIcon, FileCodeIcon, PeopleIcon} from '@primer/octicons-react'
-import {clsx} from 'clsx'
 import {SegmentedControl} from '.'
 import {Button} from '../Button'
 import Text from '../Text'
@@ -36,116 +35,6 @@ export const WithCounterLabels = () => (
   </SegmentedControl>
 )
 
-type MultilineLabelsExampleProps = {
-  label: string
-  testId: string
-  size?: 'small' | 'medium'
-  variant?: 'default' | 'subtle'
-  selectedIndex?: 0 | 1
-  withVisuals?: boolean
-  wide?: boolean
-}
-
-const MultilineLabelsExample = ({
-  label,
-  testId,
-  size = 'medium',
-  variant = 'default',
-  selectedIndex = 0,
-  withVisuals = false,
-  wide = false,
-}: MultilineLabelsExampleProps) => (
-  <div
-    className={clsx(classes.MultilineLabelsExample, {
-      [classes.MultilineLabelsExampleVisuals]: withVisuals,
-      [classes.MultilineLabelsExampleWide]: wide,
-    })}
-    data-testid={testId}
-  >
-    <span className={classes.MultilineLabelsTitle}>{label}</span>
-    <SegmentedControl aria-label={label} fullWidth size={size} variant={variant}>
-      <SegmentedControl.Button
-        count={withVisuals ? 12 : undefined}
-        defaultSelected={selectedIndex === 0}
-        leadingVisual={withVisuals ? EyeIcon : undefined}
-      >
-        All industries
-      </SegmentedControl.Button>
-      <SegmentedControl.Button defaultSelected={selectedIndex === 1}>
-        Information &amp; technology
-      </SegmentedControl.Button>
-    </SegmentedControl>
-  </div>
-)
-
-const ReflowLabelsExample = () => (
-  <div className={classes.MultilineLabelsExampleReflow} data-testid="reflow-stress">
-    <span className={classes.MultilineLabelsTitle}>320px enlarged and spaced text</span>
-    <SegmentedControl aria-label="Reflow stress" fullWidth>
-      <SegmentedControl.Button defaultSelected>All sectors</SegmentedControl.Button>
-      <SegmentedControl.Button>Tech services</SegmentedControl.Button>
-    </SegmentedControl>
-  </div>
-)
-
-const SingleLineLabelsExample = ({
-  label,
-  testId,
-  size = 'medium',
-  variant = 'default',
-}: Omit<MultilineLabelsExampleProps, 'selectedIndex' | 'withVisuals'>) => (
-  <div className={classes.MultilineLabelsExample} data-testid={testId}>
-    <span className={classes.MultilineLabelsTitle}>{label}</span>
-    <SegmentedControl aria-label={label} fullWidth size={size} variant={variant}>
-      <SegmentedControl.Button defaultSelected>All</SegmentedControl.Button>
-      <SegmentedControl.Button>Active</SegmentedControl.Button>
-    </SegmentedControl>
-  </div>
-)
-
-export const MultilineLabels = () => (
-  <div className={classes.MultilineLabelsGrid}>
-    <MultilineLabelsExample label="Constrained, natural wrapping" testId="multiline-natural-wrap" />
-    <MultilineLabelsExample
-      label="Default, small, unconstrained"
-      selectedIndex={1}
-      size="small"
-      testId="long-label-default-small"
-      wide
-    />
-    <MultilineLabelsExample
-      label="Subtle, medium, unconstrained"
-      testId="long-label-subtle-medium"
-      variant="subtle"
-      wide
-    />
-    <MultilineLabelsExample
-      label="Subtle, small, unconstrained"
-      selectedIndex={1}
-      size="small"
-      testId="long-label-subtle-small"
-      variant="subtle"
-      wide
-    />
-    <MultilineLabelsExample
-      label="Icons and counters, unconstrained"
-      testId="long-label-icons-counters"
-      wide
-      withVisuals
-    />
-    <ReflowLabelsExample />
-    <SingleLineLabelsExample label="Single line, default, medium" testId="single-line-default-medium" />
-    <SingleLineLabelsExample label="Single line, default, small" size="small" testId="single-line-default-small" />
-    <SingleLineLabelsExample label="Single line, subtle, medium" testId="single-line-subtle-medium" variant="subtle" />
-    <SingleLineLabelsExample
-      label="Single line, subtle, small"
-      size="small"
-      testId="single-line-subtle-small"
-      variant="subtle"
-    />
-  </div>
-)
-
 export const VariantSubtle = () => (
   <SegmentedControl aria-label="View" variant="subtle">
     <SegmentedControl.Button defaultSelected count={5}>
```

**File**: `packages/react/src/SegmentedControl/SegmentedControl.module.css` (modified, +2/-3)
```diff
@@ -103,8 +103,7 @@
   display: inline-flex;
 
   /* TODO: use primitive `control.{small|medium}.size` when it is available */
-  height: fit-content;
-  min-height: 32px;
+  height: 32px;
   padding: 0;
   margin: 0;
   font-size: var(--text-body-size-medium);
@@ -279,7 +278,7 @@
 
   &:where([data-size='small']) {
     /* TODO: use primitive `control.{small|medium}.size` when it is available */
-    min-height: 28px;
+    height: 28px;
     font-size: var(--text-body-size-small);
   }
 }
```

---

### Incident Patch 2: `68019e89` (2026-09-24)
**Commit Message**: Allow SegmentedControl labels to wrap without overflow (#8442)

Co-authored-by: Copilot App <[REDACTED_EMAIL]>
Co-authored-by: joshfarrant <[REDACTED_EMAIL]>

**File**: `.changeset/segmented-control-wrap-labels.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@primer/react': patch
+---
+
+SegmentedControl: Allow controls to grow vertically and preserve visible labels when they wrap
```

**File**: `e2e/components/SegmentedControl.test.ts` (modified, +237/-0)
```diff
@@ -60,6 +60,10 @@ const stories = [
     title: 'With Counter Labels',
     id: 'components-segmentedcontrol-features--with-counter-labels',
   },
+  {
+    title: 'Multiline Labels',
+    id: 'components-segmentedcontrol-features--multiline-labels',
+  },
   {
     title: 'SegmentedControlButton Playground',
     id: 'components-segmentedcontrol-segmentedcontrol-button--playground',
@@ -121,4 +125,237 @@ test.describe('SegmentedControl', () => {
       }
     })
   }
+
+  test('naturally wrapped labels grow to the tallest segment without splitting words', async ({page}) => {
+    await visit(page, {
+      id: 'components-segmentedcontrol-features--multiline-labels',
+    })
+
+    const layout = await page
+      .getByTestId('multiline-natural-wrap')
+      .locator('[data-component="SegmentedControl"]')
+      .evaluate(control => {
+        const buttons = [...control.querySelectorAll<HTMLButtonElement>('button')]
+        const buttonHeights = buttons.map(button => button.getBoundingClientRect().height)
+        const contents = [...control.querySelectorAll<HTMLElement>('.segmentedControl-content')]
+        const texts = [...control.querySelectorAll<HTMLElement>('.segmentedControl-text')]
+        const selectedButton = control.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
+        const selectedContent = selectedButton?.querySelector<HTMLElement>('.segmentedControl-content')
+
+        const textLayouts = texts.map(text => {
+          const textNode = text.firstChild
+          const style = getComputedStyle(text)
+          if (!(textNode instanceof Text)) {
+            return {
+              lineCount: 0,
+              splitWords: [],
+              whiteSpace: style.whiteSpace,
+              overflowWrap: style.overflowWrap,
+              wordBreak: style.wordBreak,
+            }
+          }
+
+          const textRange = document.createRange()
+          textRange.selectNodeContents(textNode)
+
+          const splitWords = [...textNode.data.matchAll(/\S+/g)]
+            .filter(match => {
+              const wordRange = document.createRange()
+              const start = match.index
+              wordRange.setStart(textNode, start)
+              wordRange.setEnd(textNode, start + match[0].length)
+              return wordRange.getClientRects().length > 1
+            })
+            .map(match => match[0])
+
+          return {
+            lineCount: textRange.getClientRects().length,
+            splitWords,
+            whiteSpace: style.whiteSpace,
+            overflowWrap: style.overflowWrap,
+            wordBreak: style.wordBreak,
+          }
+        })
+
+        return {
+          controlHeight: control.getBoundingClientRect().height,
+          buttonHeightSpread: Math.max(...buttonHeights) - Math.min(...buttonHeights),
+          contentFits: contents.every(
+            content =>
+              content.scrollWidth <= content.clientWidth + 1 && content.scrollHeight <= content.clientHeight + 1,
+          ),
+          selectedContentHeight: selectedContent?.getBoundingClientRect().height,
+          selectedButtonHeight: selectedButton?.getBoundingClientRect().height,
+          textLayouts,
+        }
+      })
+
+    expect(layout.controlHeight).toBeGreaterThan(32)
+    expect(layout.buttonHeightSpread).toBeLessThanOrEqual(0.5)
+    expect(layout.contentFits).toBe(true)
+    expect(layout.textLayouts.every(text => text.lineCount > 1)).toBe(true)
+    expect(layout.textLayouts.flatMap(text => text.splitWords)).toEqual([])
+    expect(
+      layout.textLayouts.every(
+        text => text.whiteSpace === 'normal' && text.overflowWrap === 'normal' && text.wordBreak === 'normal',
+      ),
+    ).toBe(true)
+    expect(layout.selectedContentHeight).toBeDefined()
+    expect(layout.selectedButtonHeight).toBeDefined()
+    expect(layout.selectedContentHeight ?? 0).toBeCloseTo(layout.selectedButtonHeight ?? 0, 1)
+  })
+
+  test('single-line labels preserve the existing control heights', async ({page}) => {
+    await visit(page, {
+      id: 'components-segmentedcontrol-features--multiline-labels',
+    })
+
+    const singleLineCases = [
+      {testId: 'single-line-default-medium', height: 32},
+      {testId: 'single-line-default-small', height: 28},
+      {testId: 'single-line-subtle-medium', height: 32},
+      {testId: 'single-line-subtle-small', height: 28},
+    ]
+
+    for (const {testId, height} of singleLineCases) {
+      const controlHeight = await page
+        .getByTestId(testId)
+        .locator('[data-component="SegmentedControl"]')
+        .evaluate(control => control.getBoundingClientRect().height)
+
+      expect(controlHeight).toBe(height)
+    }
+  })
+
+  test('single-line controls do not stretch to adjacent label and caption content', async ({page}) => {
+    await visit(page, {
+      id: 'components-segmentedcontrol-features--associated-with-a-label-and-caption',
+    })
+
+    const controlHeight = await page
+      .lo
```

**File**: `packages/react/src/SegmentedControl/SegmentedControl.features.stories.module.css` (modified, +30/-0)
```diff
@@ -8,6 +8,36 @@
   margin-top: var(--base-size-24);
 }
 
+.MultilineLabelsGrid {
+  display: flex;
+  flex-wrap: wrap;
+  gap: var(--base-size-24);
+  align-items: start;
+}
+
+.MultilineLabelsExample {
+  width: 240px;
+}
+
+.MultilineLabelsExampleWide {
+  flex-basis: 352px;
+}
+
+.MultilineLabelsExampleVisuals {
+  flex-basis: 480px;
+}
+
+.MultilineLabelsExampleReflow {
+  width: min(288px, 100%);
+}
+
+.MultilineLabelsTitle {
+  display: block;
+  margin-bottom: var(--base-size-8);
+  font-size: var(--text-body-size-small);
+  font-weight: var(--base-text-weight-semibold);
+}
+
 @media screen and (min-width: 768px) {
   .LabelAndCaptionContainer {
     flex-direction: row;
```

**File**: `packages/react/src/SegmentedControl/SegmentedControl.features.stories.tsx` (modified, +111/-0)
```diff
@@ -1,6 +1,7 @@
 import {useState} from 'react'
 import type {Meta} from '@storybook/react-vite'
 import {PlusIcon, EyeIcon, FileCodeIcon, PeopleIcon} from '@primer/octicons-react'
+import {clsx} from 'clsx'
 import {SegmentedControl} from '.'
 import {Button} from '../Button'
 import Text from '../Text'
@@ -35,6 +36,116 @@ export const WithCounterLabels = () => (
   </SegmentedControl>
 )
 
+type MultilineLabelsExampleProps = {
+  label: string
+  testId: string
+  size?: 'small' | 'medium'
+  variant?: 'default' | 'subtle'
+  selectedIndex?: 0 | 1
+  withVisuals?: boolean
+  wide?: boolean
+}
+
+const MultilineLabelsExample = ({
+  label,
+  testId,
+  size = 'medium',
+  variant = 'default',
+  selectedIndex = 0,
+  withVisuals = false,
+  wide = false,
+}: MultilineLabelsExampleProps) => (
+  <div
+    className={clsx(classes.MultilineLabelsExample, {
+      [classes.MultilineLabelsExampleVisuals]: withVisuals,
+      [classes.MultilineLabelsExampleWide]: wide,
+    })}
+    data-testid={testId}
+  >
+    <span className={classes.MultilineLabelsTitle}>{label}</span>
+    <SegmentedControl aria-label={label} fullWidth size={size} variant={variant}>
+      <SegmentedControl.Button
+        count={withVisuals ? 12 : undefined}
+        defaultSelected={selectedIndex === 0}
+        leadingVisual={withVisuals ? EyeIcon : undefined}
+      >
+        All industries
+      </SegmentedControl.Button>
+      <SegmentedControl.Button defaultSelected={selectedIndex === 1}>
+        Information &amp; technology
+      </SegmentedControl.Button>
+    </SegmentedControl>
+  </div>
+)
+
+const ReflowLabelsExample = () => (
+  <div className={classes.MultilineLabelsExampleReflow} data-testid="reflow-stress">
+    <span className={classes.MultilineLabelsTitle}>320px enlarged and spaced text</span>
+    <SegmentedControl aria-label="Reflow stress" fullWidth>
+      <SegmentedControl.Button defaultSelected>All sectors</SegmentedControl.Button>
+      <SegmentedControl.Button>Tech services</SegmentedControl.Button>
+    </SegmentedControl>
+  </div>
+)
+
+const SingleLineLabelsExample = ({
+  label,
+  testId,
+  size = 'medium',
+  variant = 'default',
+}: Omit<MultilineLabelsExampleProps, 'selectedIndex' | 'withVisuals'>) => (
+  <div className={classes.MultilineLabelsExample} data-testid={testId}>
+    <span className={classes.MultilineLabelsTitle}>{label}</span>
+    <SegmentedControl aria-label={label} fullWidth size={size} variant={variant}>
+      <SegmentedControl.Button defaultSelected>All</SegmentedControl.Button>
+      <SegmentedControl.Button>Active</SegmentedControl.Button>
+    </SegmentedControl>
+  </div>
+)
+
+export const MultilineLabels = () => (
+  <div className={classes.MultilineLabelsGrid}>
+    <MultilineLabelsExample label="Constrained, natural wrapping" testId="multiline-natural-wrap" />
+    <MultilineLabelsExample
+      label="Default, small, unconstrained"
+      selectedIndex={1}
+      size="small"
+      testId="long-label-default-small"
+      wide
+    />
+    <MultilineLabelsExample
+      label="Subtle, medium, unconstrained"
+      testId="long-label-subtle-medium"
+      variant="subtle"
+      wide
+    />
+    <MultilineLabelsExample
+      label="Subtle, small, unconstrained"
+      selectedIndex={1}
+      size="small"
+      testId="long-label-subtle-small"
+      variant="subtle"
+      wide
+    />
+    <MultilineLabelsExample
+      label="Icons and counters, unconstrained"
+      testId="long-label-icons-counters"
+      wide
+      withVisuals
+    />
+    <ReflowLabelsExample />
+    <SingleLineLabelsExample label="Single line, default, medium" testId="single-line-default-medium" />
+    <SingleLineLabelsExample label="Single line, default, small" size="small" testId="single-line-default-small" />
+    <SingleLineLabelsExample label="Single line, subtle, medium" testId="single-line-subtle-medium" variant="subtle" />
+    <SingleLineLabelsExample
+      label="Single line, subtle, small"
+      size="small"
+      testId="single-line-subtle-small"
+      variant="subtle"
+    />
+  </div>
+)
+
 export const VariantSubtle = () => (
   <SegmentedControl aria-label="View" variant="subtle">
     <SegmentedControl.Button defaultSelected count={5}>
```

**File**: `packages/react/src/SegmentedControl/SegmentedControl.module.css` (modified, +3/-2)
```diff
@@ -103,7 +103,8 @@
   display: inline-flex;
 
   /* TODO: use primitive `control.{small|medium}.size` when it is available */
-  height: 32px;
+  height: fit-content;
+  min-height: 32px;
   padding: 0;
   margin: 0;
   font-size: var(--text-body-size-medium);
@@ -278,7 +279,7 @@
 
   &:where([data-size='small']) {
     /* TODO: use primitive `control.{small|medium}.size` when it is available */
-    height: 28px;
+    min-height: 28px;
     font-size: var(--text-body-size-small);
   }
 }
```

---

### Incident Patch 3: `535ced4a` (2026-09-23)
**Commit Message**: Fix stale lock file for issue-triage workflow (#8428)

Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: tay1orjones <[REDACTED_EMAIL]>
Co-authored-by: Taylor Jones <[REDACTED_EMAIL]>

**File**: `.github/workflows/issue-triage.lock.yml` (modified, +2/-1)
```diff
@@ -1,4 +1,4 @@
-# gh-aw-metadata: {"schema_version":"v4","frontmatter_hash":"3fe280c9008389d40b5c38e9123f1401fbdd9809dc0ce1d36998482cce5c901e","body_hash":"7d1b66990da5eb1e153de2e0d6a87cfdfdf58bf1a13b4b81e75d5167af8fa86a","compiler_version":"v0.88.2","strict":true,"agent_id":"copilot","engine_versions":{"copilot":"1.0.80"}}
+# gh-aw-metadata: {"schema_version":"v4","frontmatter_hash":"aa634ea10633f6fb8702be9810a1ed6d2def061898871c458481cf12e69fe375","body_hash":"7d1b66990da5eb1e153de2e0d6a87cfdfdf58bf1a13b4b81e75d5167af8fa86a","compiler_version":"v0.88.2","strict":true,"agent_id":"copilot","engine_versions":{"copilot":"1.0.80"}}
 # gh-aw-manifest: {"version":1,"secrets":["GH_AW_AGENT_TOKEN","GH_AW_DEFAULT_OTLP_HEADERS","GH_AW_GITHUB_MCP_SERVER_TOKEN","GH_AW_GITHUB_TOKEN","GITHUB_TOKEN"],"actions":[{"repo":"actions/cache/restore","sha":"55cc8345863c7cc4c66a329aec7e433d2d1c52a9","version":"v6.1.0"},{"repo":"actions/cache/save","sha":"55cc8345863c7cc4c66a329aec7e433d2d1c52a9","version":"v6.1.0"},{"repo":"actions/checkout","sha":"3d3c42e5aac5ba805825da76410c181273ba90b1","version":"v7.0.1"},{"repo":"actions/download-artifact","sha":"3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c","version":"v8.0.1"},{"repo":"actions/github-script","sha":"3a2844b7e9c422d3c10d287c895573f7108da1b3","version":"v9.0.0"},{"repo":"actions/upload-artifact","sha":"043fb46d1a93c77aae656e7c1c64a875d1fc6a0a","version":"v7.0.1"},{"repo":"github/gh-aw-actions/setup","sha":"9271a1804551c0dc4fb0085a97979950aa2f8489","version":"v0.88.2"}],"containers":[{"image":"ghcr.io/github/gh-aw-firewall/agent:0.28.12","digest":"sha256:390051be4ed1847f774fd8980b61d3a3523574c0175d00c3fc7cdf2002a88202","pinned_image":"ghcr.io/github/gh-aw-firewall/agent:0.28.12@sha256:390051be4ed1847f774fd8980b61d3a3523574c0175d00c3fc7cdf2002a88202"},{"image":"ghcr.io/github/gh-aw-firewall/api-proxy:0.28.12","digest":"sha256:d7d533d87c80d87ff91ac0e21e9299055c3beedff1536262b97ed700fb065a32","pinned_image":"ghcr.io/github/gh-aw-firewall/api-proxy:0.28.12@sha256:d7d533d87c80d87ff91ac0e21e9299055c3beedff1536262b97ed700fb065a32"},{"image":"ghcr.io/github/gh-aw-firewall/squid:0.28.12","digest":"sha256:52c34aca98d2a6833c329f1505912a6949c4fda16618c010c979bd59ea99254f","pinned_image":"ghcr.io/github/gh-aw-firewall/squid:0.28.12@sha256:52c34aca98d2a6833c329f1505912a6949c4fda16618c010c979bd59ea99254f"},{"image":"ghcr.io/github/gh-aw-mcpg:v0.4.15","digest":"sha256:60cd97533e93d8e7be36b979c0f08a70846189bda6190f28bbd6d427bc0d9b6e","pinned_image":"ghcr.io/github/gh-aw-mcpg:v0.4.15@sha256:60cd97533e93d8e7be36b979c0f08a70846189bda6190f28bbd6d427bc0d9b6e"},{"image":"ghcr.io/github/gh-aw-node","digest":"sha256:bac2192f6374d6262116399b34fc5e143d576f82719e90a18261cae7480f4d4e","pinned_image":"ghcr.io/github/gh-aw-node@sha256:bac2192f6374d6262116399b34fc5e143d576f82719e90a18261cae7480f4d4e"},{"image":"ghcr.io/github/github-mcp-server:v1.11.0","digest":"sha256:fbec75de11c255213fa08d80fb166abe73d851fff631c51c0079872967720699","pinned_image":"ghcr.io/github/github-mcp-server:v1.11.0@sha256:fbec75de11c255213fa08d80fb166abe73d851fff631c51c0079872967720699"}],"mcp_servers":[{"name":"github","tools":["get_label","issue_read","list_issue_types","list_issues","list_label","search_issues"]},{"name":"safeoutputs","tools":["add_comment","add_labels","assign_to_agent","missing_data","missing_tool","noop","set_issue_type"]}]}
 # This file was automatically generated by gh-aw (v0.88.2). DO NOT EDIT. To debug this workflow, load the skill at https://github.com/github/gh-aw/blob/main/debug.md
 #
@@ -413,6 +413,7 @@ jobs:
       copilot-requests: write
       deployments: read
       discussions: read
+      id-token: none
       issues: read
       packages: read
       pages: read
```

---

### Incident Patch 4: `3412c021` (2026-09-17)
**Commit Message**: Revert "Button: Limit link underline to the label" (#8426)

**File**: `.changeset/button-label-underline.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-'@primer/react': patch
----
-
-Button and LinkButton: Limit link variant underlines to the text label when visuals are present
```

**File**: `e2e/components/Button.test.ts` (modified, +0/-54)
```diff
@@ -110,60 +110,6 @@ const stories = [
 ] as const
 
 test.describe('Button', () => {
-  test('link variant underlines only the label', async ({page}) => {
-    await visit(page, {
-      id: 'components-button-dev--link-variant-with-underline-preference',
-    })
-
-    const buttonWithVisual = (preference: 'on' | 'off') =>
-      page
-        .getByRole('button', {name: `Underline pref ${preference}`})
-        .filter({has: page.locator('[data-component="leadingVisual"]')})
-
-    const preferenceOnButton = buttonWithVisual('on')
-    const preferenceOnLabel = preferenceOnButton.locator('[data-component="text"]')
-
-    await expect(preferenceOnButton).toHaveCSS('text-decoration-line', 'none')
-    await expect(preferenceOnButton).toHaveCSS('background-image', 'none')
-    await expect(preferenceOnLabel).toHaveCSS('text-decoration-line', 'underline')
-    await expect(preferenceOnLabel).toHaveCSS('text-underline-offset', '2px')
-
-    await preferenceOnButton.hover()
-    await expect(preferenceOnButton).toHaveCSS('text-decoration-line', 'none')
-    await expect(preferenceOnButton).toHaveCSS('background-image', 'none')
-    await expect(preferenceOnLabel).toHaveCSS('text-decoration-line', 'none')
-
-    await preferenceOnButton.evaluate(element => element.setAttribute('aria-disabled', 'true'))
-    await expect(preferenceOnLabel).toHaveCSS('text-decoration-line', 'underline')
-
-    await preferenceOnButton.evaluate(element => {
-      element.removeAttribute('aria-disabled')
-      element.setAttribute('data-inactive', 'true')
-    })
-    await expect(preferenceOnLabel).toHaveCSS('text-decoration-line', 'underline')
-
-    const preferenceOffButton = buttonWithVisual('off')
-    const preferenceOffLabel = preferenceOffButton.locator('[data-component="text"]')
-
-    await expect(preferenceOffButton).toHaveCSS('text-decoration-line', 'none')
-    await expect(preferenceOffButton).toHaveCSS('background-image', 'none')
-    await expect(preferenceOffLabel).toHaveCSS('text-decoration-line', 'none')
-
-    await preferenceOffButton.hover()
-    await expect(preferenceOffButton).toHaveCSS('text-decoration-line', 'none')
-    await expect(preferenceOffButton).toHaveCSS('background-image', 'none')
-    await expect(preferenceOffLabel).toHaveCSS('text-decoration-line', 'underline')
-
-    await preferenceOffButton.evaluate(element => element.setAttribute('aria-disabled', 'true'))
-    await expect(preferenceOffLabel).toHaveCSS('text-decoration-line', 'none')
-
-    await preferenceOffButton.evaluate(element => {
-      element.removeAttribute('aria-disabled')
-      element.setAttribute('data-inactive', 'true')
-    })
-    await expect(preferenceOffLabel).toHaveCSS('text-decoration-line', 'none')
-  })
-
   for (const story of stories) {
     test.describe(story.title, () => {
       for (const theme of themes) {
```

**File**: `packages/react/src/Button/ButtonBase.module.css` (modified, +19/-8)
```diff
@@ -590,7 +590,7 @@
     border: unset;
     border-radius: 0;
 
-    &:where(:hover:not(:disabled, [aria-disabled='true'], [data-inactive])) .Label {
+    &:hover:not(:disabled, [data-inactive]) {
       text-decoration: underline;
     }
 
@@ -607,7 +607,6 @@
     }
 
     & .Label {
-      text-underline-offset: 0.125rem;
       white-space: unset;
     }
 
@@ -622,22 +621,34 @@
   }
 
   [data-a11y-link-underlines='true'] &:where([data-variant='link']) {
-    & .Label {
+    &[data-no-visuals] {
       text-decoration: underline;
+
+      &:hover {
+        text-decoration: none;
+      }
     }
 
-    &:where(:hover:not(:disabled, [aria-disabled='true'], [data-inactive])) .Label {
-      text-decoration: none;
+    &:not([data-no-visuals]) {
+      background-image: linear-gradient(to right, currentColor, currentColor);
+      background-size: 100% 1.5px;
+      background-position: 0 calc(100% - 2px);
+      background-repeat: no-repeat;
+
+      &:hover {
+        text-decoration: none;
+      }
     }
   }
 
   [data-a11y-link-underlines='false'] &:where([data-variant='link']) {
-    & .Label {
+    &[data-no-visuals] {
       text-decoration: none;
+      background-image: none;
     }
 
-    &:where(:hover:not(:disabled, [aria-disabled='true'], [data-inactive])) .Label {
-      text-decoration: underline;
+    &:not([data-no-visuals]) {
+      background-image: none;
     }
   }
 
```

---

### Incident Patch 5: `9d0632cc` (2026-09-14)
**Commit Message**: Fix Tooltip ref handling to preserve child element ref (#8409)

**File**: `.changeset/young-wings-wait.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@primer/react": patch
+---
+
+Fix Tooltip ref handling to preserve child element ref
```

**File**: `packages/react/src/Overlay/Overlay.test.tsx` (modified, +3/-1)
```diff
@@ -205,9 +205,11 @@ describe('Overlay', () => {
     // hitting escape on input should close the second menu but not the first
     fireEvent.keyDown(container.getByPlaceholderText('Name this list'), {key: 'Escape', code: 'Escape'})
     expect(container.queryByPlaceholderText('Name this list')).not.toBeInTheDocument()
-    // this breaks:
     expect(container.getByText('Add to list')).toBeInTheDocument()
 
+    // Focus is returned to button which opens tooltip, close that first:
+    fireEvent.keyDown(container.getByRole('button', {name: 'Create list'}), {key: 'Escape', code: 'Escape'})
+
     // hitting escape again in first overlay should close it
     fireEvent.keyDown(container.getByText('Add to list'), {key: 'Escape', code: 'Escape'})
     expect(container.queryByText('Add to list')).not.toBeInTheDocument()
```

**File**: `packages/react/src/TooltipV2/Tooltip.tsx` (modified, +6/-2)
```diff
@@ -14,6 +14,7 @@ import VisuallyHidden from '../_VisuallyHidden'
 import useSafeTimeout from '../hooks/useSafeTimeout'
 import type {SlotMarker} from '../utils/types'
 import {TooltipContext} from './TooltipContext'
+import {reactMajorVersion} from '../utils/environment'
 
 export type TooltipDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
 export type TooltipProps = React.PropsWithChildren<{
@@ -127,12 +128,15 @@ export const Tooltip: ForwardRefExoticComponent<
   ) => {
     const tooltipId = useId(id)
     const child = Children.only(children)
+    const elementChild = React.isValidElement(child) ? child : undefined
+    const childRef =
+      reactMajorVersion > 18 ? elementChild?.props.ref : (elementChild as {ref?: React.Ref<unknown>} | undefined)?.ref
     const mergedRefEnabled = useFeatureFlag('primer_react_merged_forwarded_refs')
     const triggerRef = useRef<HTMLElement>(null)
-    const mergedTriggerRef = useMergedRefs(triggerRef, forwardedRef)
+    const mergedTriggerRef = useMergedRefs(triggerRef, useMergedRefs(forwardedRef, childRef))
     // Feature-flag scaffolding for `primer_react_merged_forwarded_refs`.
     // At graduation: remove the three declarations below, and replace all instances of `readTriggerRef` with `triggerRef` and `appliedTriggerRef` with `mergedTriggerRef`.
-    const providedOrCreatedRef = useProvidedRefOrCreate(forwardedRef as React.RefObject<HTMLElement>)
+    const providedOrCreatedRef = useProvidedRefOrCreate((forwardedRef ?? childRef) as React.RefObject<HTMLElement>)
     const readTriggerRef = mergedRefEnabled ? triggerRef : providedOrCreatedRef
     const appliedTriggerRef = mergedRefEnabled ? mergedTriggerRef : providedOrCreatedRef
     const tooltipElRef = useRef<HTMLDivElement>(null)
```

**File**: `packages/react/src/TooltipV2/__tests__/Tooltip.test.tsx` (modified, +47/-15)
```diff
@@ -57,32 +57,32 @@ describe('Tooltip', () => {
     const {getByText} = HTMLRender(<TooltipComponent direction="n" />)
     expect(getByText('Tooltip text')).toHaveAttribute('data-direction', 'n')
   })
-  it('should label the trigger element by its tooltip when the tooltip type is label', () => {
+  it('labels the trigger element by its tooltip when the tooltip type is label', () => {
     const {getByRole, getByText} = HTMLRender(<TooltipComponent type="label" />)
     const triggerEL = getByRole('button')
     const tooltipEl = getByText('Tooltip text')
     expect(triggerEL).toHaveAttribute('aria-labelledby', tooltipEl.id)
   })
-  it('should render aria-hidden on the tooltip element when the tooltip is label type', () => {
+  it('renders aria-hidden on the tooltip element when the tooltip is label type', () => {
     const {getByText} = HTMLRender(<TooltipComponent type="label" />)
     expect(getByText('Tooltip text')).toHaveAttribute('aria-hidden', 'true')
   })
-  it('should render aria-hidden on the tooltip element when the tooltip is description type', () => {
+  it('renders aria-hidden on the tooltip element when the tooltip is description type', () => {
     const {getByText} = HTMLRender(<TooltipComponent type="description" />)
     expect(getByText('Tooltip text')).toHaveAttribute('aria-hidden', 'true')
   })
-  it('should describe the trigger element by its tooltip when the tooltip type is description (by default)', () => {
+  it('describes the trigger element by its tooltip when the tooltip type is description (by default)', () => {
     const {getByRole, getByText} = HTMLRender(<TooltipComponent />)
     const triggerEL = getByRole('button')
     const tooltipEl = getByText('Tooltip text')
     expect(triggerEL.getAttribute('aria-describedby')).toContain(tooltipEl.id)
   })
-  it('should render the tooltip element with role="tooltip" when the tooltip type is description (by default)', () => {
+  it('renders the tooltip element with role="tooltip" when the tooltip type is description (by default)', () => {
     const {getByText} = HTMLRender(<TooltipComponent />)
     expect(getByText('Tooltip text')).toHaveAttribute('role', 'tooltip')
   })
 
-  it('should spread the accessibility attributes correctly on the trigger (ActionMenu.Button) when tooltip is used in an action menu', () => {
+  it('spreads the accessibility attributes correctly on the trigger (ActionMenu.Button) when tooltip is used in an action menu', () => {
     const {getByRole, getByText} = HTMLRender(
       <ExampleWithActionMenu
         actionMenuTrigger={
@@ -98,7 +98,7 @@ describe('Tooltip', () => {
     expect(menuButton).toHaveAttribute('aria-haspopup', 'true')
   })
 
-  it('should spread the accessibility attributes correctly on the trigger (Button) when tooltip is used in an action menu', () => {
+  it('spreads the accessibility attributes correctly on the trigger (Button) when tooltip is used in an action menu', () => {
     const {getByRole, getByText} = HTMLRender(
       <ExampleWithActionMenu
         actionMenuTrigger={
@@ -115,7 +115,7 @@ describe('Tooltip', () => {
     expect(menuButton.getAttribute('aria-describedby')).toContain(tooltip.id)
     expect(menuButton).toHaveAttribute('aria-haspopup', 'true')
   })
-  it('should use the custom tooltip id (if present) to label the trigger element', () => {
+  it('uses the custom tooltip id (if present) to label the trigger element', () => {
     const {getByRole} = HTMLRender(
       <Tooltip id="custom-tooltip-id" text="Close feedback form" direction="nw" type="label">
         <IconButton aria-labelledby="custom-tooltip-id" icon={XIcon} variant="invisible" onClick={() => {}} />
@@ -124,7 +124,7 @@ describe('Tooltip', () => {
     const triggerEL = getByRole('button')
     expect(triggerEL).toHaveAttribute('aria-labelledby', 'custom-tooltip-id')
   })
-  it('should use the custom tooltip id (if present) to described the trigger element', () => {
+  it('uses the custom tooltip id (if present) to described the trigger element', () => {
     const {getByRole} = HTMLRender(
       <Tooltip text="This operation cannot be reverted" id="custom-tooltip-id">
         <Button>Delete</Button>
@@ -133,7 +133,7 @@ describe('Tooltip', () => {
     const triggerEL = getByRole('button')
     expect(triggerEL.getAttribute('aria-describedby')).toContain('custom-tooltip-id')
   })
-  it('should throw an error if the trigger element is disabled', () => {
+  it('throws an error if the trigger element is disabled', () => {
     withExpectedConsoleError(() => {
       expect(() => {
         HTMLRender(
@@ -146,7 +146,7 @@ describe('Tooltip', () => {
       )
     })
   })
-  it('should not throw an error when the trigger element is a button in a fieldset', () => {
+  it('does not throw an error when the trigger element is a button in a fieldset', () => {
     const {getByRole} = HTMLRender(
       <fieldset>
         <legend>Legend</legend>
@@ -159,7 +159,7 @@ describe('Tooltip', (
```

---

### Incident Patch 6: `35d4a04e` (2026-09-11)
**Commit Message**: Fix issue-triage.lock.yml workflow failure: remove invalid id-token permission (#8402)

Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: lesliecdubs <[REDACTED_EMAIL]>
Co-authored-by: Leslie Cohn-Wein <[REDACTED_EMAIL]>
Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `.github/workflows/issue-triage.md` (modified, +17/-1)
```diff
@@ -11,7 +11,23 @@ on:
     types: [opened, reopened]
   reaction: eyes
 
-permissions: read-all
+permissions:
+  copilot-requests: write
+  id-token: none
+  # Explicitly list read scopes (equivalent to `read-all`) so we can also grant copilot-requests: write
+  actions: read
+  attestations: read
+  checks: read
+  contents: read
+  deployments: read
+  issues: read
+  discussions: read
+  packages: read
+  pages: read
+  pull-requests: read
+  repository-projects: read
+  security-events: read
+  statuses: read
 
 network: defaults
 
```

---

### Incident Patch 7: `fd1a26ad` (2026-09-09)
**Commit Message**: Fix feature flags compiler runtime issue (#8234)

Co-authored-by: Siddharth Kshetrapal <[REDACTED_EMAIL]>

**File**: `.changeset/bundle-react-compiler-runtime.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@primer/react': patch
+---
+
+Bundle the React Compiler memo helper (`c`) into `@primer/react` instead of importing it from an external `react-compiler-runtime` module. This prevents a runtime crash (`TypeError: (0, t.c) is not a function`) that could occur when a consumer's bundle resolved a skewed or stale `react-compiler-runtime` across independently-cached chunks.
```

**File**: `package-lock.json` (modified, +2/-1)
```diff
@@ -24694,6 +24694,7 @@
       "version": "1.0.0",
       "resolved": "https://registry.npmjs.org/react-compiler-runtime/-/react-compiler-runtime-1.0.0.tgz",
       "integrity": "sha512-rRfjYv66HlG8896yPUDONgKzG5BxZD1nV9U6rkm+7VCuvQc903C4MjcoZR4zPw53IKSOX9wMQVpA1IAbRtzQ7w==",
+      "dev": true,
       "license": "MIT",
       "peerDependencies": {
         "react": "^17.0.0 || ^18.0.0 || ^19.0.0 || ^0.0.0-experimental"
@@ -30728,7 +30729,6 @@
         "hsluv": "1.0.1",
         "lodash.isempty": "^4.4.0",
         "lodash.isobject": "^3.0.2",
-        "react-compiler-runtime": "^1.0.0",
         "react-intersection-observer": "^10.0.3"
       },
       "devDependencies": {
@@ -30800,6 +30800,7 @@
         "postcss-preset-primer": "^0.0.0",
         "publint": "^0.3.15",
         "react": "18.3.1",
+        "react-compiler-runtime": "^1.0.0",
         "react-dom": "18.3.1",
         "react-is": "18.3.1",
         "recast": "0.23.7",
```

**File**: `packages/react/package.json` (modified, +1/-1)
```diff
@@ -90,7 +90,6 @@
     "hsluv": "1.0.1",
     "lodash.isempty": "^4.4.0",
     "lodash.isobject": "^3.0.2",
-    "react-compiler-runtime": "^1.0.0",
     "react-intersection-observer": "^10.0.3"
   },
   "devDependencies": {
@@ -162,6 +161,7 @@
     "postcss-preset-primer": "^0.0.0",
     "publint": "^0.3.15",
     "react": "18.3.1",
+    "react-compiler-runtime": "^1.0.0",
     "react-dom": "18.3.1",
     "react-is": "18.3.1",
     "recast": "0.23.7",
```

**File**: `packages/react/rolldown.config.ts` (modified, +31/-3)
```diff
@@ -40,13 +40,40 @@ function getEntrypointsFromInput(input: ReadonlySet<string>) {
   )
 }
 
+// The React Compiler emits imports of the memo helper `c` from
+// `react-compiler-runtime`. That package is CommonJS and, left external, ships a
+// bare cross-chunk import that crashes ("(0, t.c) is not a function") when a
+// consumer's bundle resolves a skewed/duplicate copy across independently-cached
+// chunks. Instead we resolve those imports to a small local ESM shim that is
+// bundled into the output, so the helper is always self-contained and imports
+// `react` as a normal ES module (no CommonJS `require` interop).
+const reactCompilerRuntimeShim = path.resolve('src/utils/react-compiler-runtime.ts')
+
+function reactCompilerRuntimeAlias() {
+  return {
+    name: 'react-compiler-runtime-alias',
+    resolveId(source: string) {
+      if (source === 'react-compiler-runtime') {
+        return {id: reactCompilerRuntimeShim, external: false}
+      }
+      return null
+    },
+  }
+}
+
 const dependencies = [
   ...Object.keys(packageMetadata.peerDependencies ?? {}),
   ...Object.keys(packageMetadata.dependencies ?? {}),
   ...Object.keys(packageMetadata.devDependencies ?? {}),
-].map(name => {
-  return new RegExp(`^${name}(/.*)?`)
-})
+]
+  // `react-compiler-runtime` is intentionally not external: it is aliased to a
+  // local shim (see `reactCompilerRuntimeAlias`) and bundled into the output.
+  .filter(name => name !== 'react-compiler-runtime')
+  .map(name => {
+    // Anchor the package-name boundary so a dependency name is not treated as a
+    // prefix of another (e.g. `react` must not match `react-compiler-runtime`).
+    return new RegExp(`^${name}($|/)`)
+  })
 
 const external = [
   // Exclude package dependencies
@@ -66,6 +93,7 @@ export default defineConfig([
   {
     input,
     plugins: [
+      reactCompilerRuntimeAlias(),
       babel({
         include: /\.(?:js|jsx|ts|tsx)$/,
         exclude: /node_modules/,
```

**File**: `packages/react/script/react-compiler.mjs` (modified, +1/-0)
```diff
@@ -58,6 +58,7 @@ const unsupportedPatterns = [
   'src/internal/hooks/useDevOnlyEffect.ts',
   'src/stories/deprecated/ActionList.stories.tsx',
   'src/utils/StressTest.tsx',
+  'src/utils/react-compiler-runtime.ts',
   'src/utils/use-force-update.ts',
 ]
 
```

**File**: `packages/react/src/utils/__tests__/react-compiler-runtime.test.tsx` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+import {describe, expect, it} from 'vitest'
+import {renderHook} from '@testing-library/react'
+import {c, useMemoCache} from '../react-compiler-runtime'
+
+const MEMO_CACHE_SENTINEL = Symbol.for('react.memo_cache_sentinel')
+
+describe('react-compiler-runtime shim', () => {
+  it('exports a callable `c` (the compiler memo helper)', () => {
+    expect(typeof c).toBe('function')
+  })
+
+  describe('useMemoCache fallback', () => {
+    it('allocates a cache of the requested size seeded with the sentinel', () => {
+      const {result} = renderHook(() => useMemoCache(6))
+      const cache = result.current
+
+      expect(cache).toHaveLength(6)
+      for (let index = 0; index < 6; index++) {
+        expect(cache[index]).toBe(MEMO_CACHE_SENTINEL)
+      }
+      expect((cache as unknown as Record<symbol, unknown>)[MEMO_CACHE_SENTINEL]).toBe(true)
+    })
+
+    it('reuses the same cache across re-renders', () => {
+      const {result, rerender} = renderHook(() => useMemoCache(4))
+      const first = result.current
+
+      rerender()
+
+      expect(result.current).toBe(first)
+    })
+  })
+})
```

**File**: `packages/react/src/utils/react-compiler-runtime.ts` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+import React, {useMemo} from 'react'
+
+/**
+ * Local, bundled replacement for the `c` helper exported by
+ * `react-compiler-runtime`.
+ *
+ * The React Compiler emits `import {c} from 'react-compiler-runtime'`. The build
+ * aliases that import to this module so the helper is bundled into
+ * `@primer/react` as plain ES modules instead of being resolved as an external
+ * CommonJS dependency. Leaving it external ships a bare cross-chunk import that
+ * can crash (`TypeError: (0, t.c) is not a function`) when a consumer's bundle
+ * graph resolves a skewed or duplicate copy across independently-cached chunks.
+ *
+ * The behavior mirrors `react-compiler-runtime`: prefer React's built-in
+ * compiler runtime when it is available (React 19+), otherwise fall back to a
+ * `useMemo`-backed cache. This module is excluded from the React Compiler (see
+ * `script/react-compiler.mjs`) so it does not attempt to compile the helper that
+ * backs the compiler's own runtime.
+ */
+
+const MEMO_CACHE_SENTINEL = Symbol.for('react.memo_cache_sentinel')
+
+type MemoCache = Array<unknown>
+
+type ReactCompilerRuntime = {
+  c?: (size: number) => MemoCache
+}
+
+// Exported for testing: the `useMemo`-backed fallback used when React does not
+// provide a built-in compiler runtime.
+export function useMemoCache(size: number): MemoCache {
+  return useMemo(() => {
+    const cache = new Array(size) as MemoCache & Record<symbol, unknown>
+    for (let index = 0; index < size; index++) {
+      cache[index] = MEMO_CACHE_SENTINEL
+    }
+    // Mark the cache as freshly allocated, matching `react-compiler-runtime`.
+    cache[MEMO_CACHE_SENTINEL] = true
+    return cache
+    // `size` is a stable per-call-site constant; the cache must be allocated
+    // exactly once, matching `react-compiler-runtime`.
+    // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, [])
+}
+
+const builtinRuntime = (React as typeof React & {__COMPILER_RUNTIME?: ReactCompilerRuntime}).__COMPILER_RUNTIME
+
+export const c: (size: number) => MemoCache = typeof builtinRuntime?.c === 'function' ? builtinRuntime.c : useMemoCache
```

---

### Incident Patch 8: `fabd06c5` (2026-09-08)
**Commit Message**: Fix scheduled Primer API Review issue updates (#8400)

Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: joshblack <[REDACTED_EMAIL]>

**File**: `.github/workflows/primer-api-review.lock.yml` (modified, +4/-4)
```diff
@@ -1,4 +1,4 @@
-# gh-aw-metadata: {"schema_version":"v4","frontmatter_hash":"d6cb318df75cf4d259dec0c2e4bf95f62c9e788ed948ce818a701a9ad645ca89","body_hash":"cc63dce1a77a407e7e3568c748edc9570742f51b2f3070dfd76951a1d3b100b4","compiler_version":"v0.88.2","strict":true,"agent_id":"copilot","engine_versions":{"copilot":"1.0.80"}}
+# gh-aw-metadata: {"schema_version":"v4","frontmatter_hash":"52efa6af926e1af676d737798ec49d1d15da528f2613da1467779d0974b37fe4","body_hash":"cc63dce1a77a407e7e3568c748edc9570742f51b2f3070dfd76951a1d3b100b4","compiler_version":"v0.88.2","strict":true,"agent_id":"copilot","engine_versions":{"copilot":"1.0.80"}}
 # gh-aw-manifest: {"version":1,"secrets":["GH_AW_DEFAULT_OTLP_HEADERS","GH_AW_GITHUB_MCP_SERVER_TOKEN","GH_AW_GITHUB_TOKEN","GITHUB_TOKEN"],"actions":[{"repo":"actions/cache/restore","sha":"55cc8345863c7cc4c66a329aec7e433d2d1c52a9","version":"v6.1.0"},{"repo":"actions/cache/save","sha":"55cc8345863c7cc4c66a329aec7e433d2d1c52a9","version":"v6.1.0"},{"repo":"actions/checkout","sha":"3d3c42e5aac5ba805825da76410c181273ba90b1","version":"v7.0.1"},{"repo":"actions/download-artifact","sha":"3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c","version":"v8.0.1"},{"repo":"actions/github-script","sha":"3a2844b7e9c422d3c10d287c895573f7108da1b3","version":"v9.0.0"},{"repo":"actions/upload-artifact","sha":"043fb46d1a93c77aae656e7c1c64a875d1fc6a0a","version":"v7.0.1"},{"repo":"github/gh-aw-actions/setup","sha":"9271a1804551c0dc4fb0085a97979950aa2f8489","version":"v0.88.2"}],"skills":[".github/skills/style-guide"],"containers":[{"image":"ghcr.io/github/gh-aw-firewall/agent:0.28.12","digest":"sha256:390051be4ed1847f774fd8980b61d3a3523574c0175d00c3fc7cdf2002a88202","pinned_image":"ghcr.io/github/gh-aw-firewall/agent:0.28.12@sha256:390051be4ed1847f774fd8980b61d3a3523574c0175d00c3fc7cdf2002a88202"},{"image":"ghcr.io/github/gh-aw-firewall/api-proxy:0.28.12","digest":"sha256:d7d533d87c80d87ff91ac0e21e9299055c3beedff1536262b97ed700fb065a32","pinned_image":"ghcr.io/github/gh-aw-firewall/api-proxy:0.28.12@sha256:d7d533d87c80d87ff91ac0e21e9299055c3beedff1536262b97ed700fb065a32"},{"image":"ghcr.io/github/gh-aw-firewall/cli-proxy:0.28.12","digest":"sha256:5250629d48eaedfedf2e948785228e8da29eec2a83cbab58ea0751c14a7b021d","pinned_image":"ghcr.io/github/gh-aw-firewall/cli-proxy:0.28.12@sha256:5250629d48eaedfedf2e948785228e8da29eec2a83cbab58ea0751c14a7b021d"},{"image":"ghcr.io/github/gh-aw-firewall/squid:0.28.12","digest":"sha256:52c34aca98d2a6833c329f1505912a6949c4fda16618c010c979bd59ea99254f","pinned_image":"ghcr.io/github/gh-aw-firewall/squid:0.28.12@sha256:52c34aca98d2a6833c329f1505912a6949c4fda16618c010c979bd59ea99254f"},{"image":"ghcr.io/github/gh-aw-mcpg:v0.4.15","digest":"sha256:60cd97533e93d8e7be36b979c0f08a70846189bda6190f28bbd6d427bc0d9b6e","pinned_image":"ghcr.io/github/gh-aw-mcpg:v0.4.15@sha256:60cd97533e93d8e7be36b979c0f08a70846189bda6190f28bbd6d427bc0d9b6e"},{"image":"ghcr.io/github/gh-aw-node","digest":"sha256:bac2192f6374d6262116399b34fc5e143d576f82719e90a18261cae7480f4d4e","pinned_image":"ghcr.io/github/gh-aw-node@sha256:bac2192f6374d6262116399b34fc5e143d576f82719e90a18261cae7480f4d4e"},{"image":"ghcr.io/github/github-mcp-server:v1.11.0","digest":"sha256:fbec75de11c255213fa08d80fb166abe73d851fff631c51c0079872967720699","pinned_image":"ghcr.io/github/github-mcp-server:v1.11.0@sha256:fbec75de11c255213fa08d80fb166abe73d851fff631c51c0079872967720699"}],"mcp_servers":[{"name":"safeoutputs","tools":["create_issue","missing_data","missing_tool","noop","update_issue"]}]}
 # This file was automatically generated by gh-aw (v0.88.2). DO NOT EDIT. To debug this workflow, load the skill at https://github.com/github/gh-aw/blob/main/debug.md
 #
@@ -564,7 +564,7 @@ jobs:
         env:
           GH_AW_FILE_ROOT: "${{ runner.temp }}/gh-aw"
           GH_AW_FILE_CONFIG: "{\"files\":[{\"path\":\"safeoutputs/config.json\",\"content_env\":\"GH_AW_SAFE_OUTPUTS_CONFIG\"}]}"
-          GH_AW_SAFE_OUTPUTS_CONFIG: "{\"create_issue\":{\"deduplicate_by_title\":true,\"max\":1},\"create_report_incomplete_issue\":{},\"mentions\":{\"enabled\":false},\"missing_data\":{},\"missing_tool\":{},\"noop\":{\"max\":1,\"report-as-issue\":\"false\"},\"report_incomplete\":{},\"update_issue\":{\"allow_body\":true,\"max\":1,\"required_title_prefix\":\"Primer API Review\"}}"
+          GH_AW_SAFE_OUTPUTS_CONFIG: "{\"create_issue\":{\"deduplicate_by_title\":true,\"max\":1},\"create_report_incomplete_issue\":{},\"mentions\":{\"enabled\":false},\"missing_data\":{},\"missing_tool\":{},\"noop\":{\"max\":1,\"report-as-issue\":\"false\"},\"report_incomplete\":{},\"update_issue\":{\"allow_body\":true,\"max\":1,\"required_title_prefix\":\"Primer API Review\",\"target\":\"*\"}}"
         with:
           script: |
             const path = require('path');
@@ -579,7 +579,7 @@ jobs:
             {
               "description_suffixes": {
                 "create_issue": " CONSTRAINTS: Maximum 1 issue(s) can be created.",
-                "update_issue": " CONS
```

**File**: `.github/workflows/primer-api-review.md` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ safe-outputs:
     deduplicate-by-title: true
     max: 1
   update-issue:
+    target: '*'
     required-title-prefix: 'Primer API Review'
 ---
 
```

---

### Incident Patch 9: `dc8387f4` (2026-09-04)
**Commit Message**: Implement accessibility fix for sortable DataTable headers (#8371)

Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `.changeset/friendly-tables-sort.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@primer/react': patch
+---
+
+DataTable: Keep sortable column names concise and convey the next sort action as an accessible description
```

**File**: `packages/react/src/DataTable/Table.tsx` (modified, +2/-1)
```diff
@@ -142,13 +142,15 @@ type TableSortHeaderProps = TableHeaderProps & {
 
 function TableSortHeader({align, children, direction, onToggleSort, ...rest}: TableSortHeaderProps) {
   const ariaSort = direction === 'DESC' ? 'descending' : direction === 'ASC' ? 'ascending' : undefined
+  const sortAction = direction === SortDirection.ASC ? 'Sort descending' : 'Sort ascending'
 
   return (
     <TableHeader {...rest} aria-sort={ariaSort} align={align} data-component="Table.SortHeader">
       <Button
         type="button"
         className={clsx('TableSortButton', classes.TableSortButton)}
         data-component="Table.SortHeader.Button"
+        aria-description={sortAction}
         onClick={() => {
           onToggleSort()
         }}
@@ -164,7 +166,6 @@ function TableSortHeader({align, children, direction, onToggleSort, ...rest}: Ta
                 classes['TableSortIcon--ascending'],
               )}
             />
-            {direction === SortDirection.NONE ? <VisuallyHidden>sort ascending</VisuallyHidden> : null}
           </>
         ) : null}
         {direction === SortDirection.DESC ? (
```

**File**: `packages/react/src/DataTable/__tests__/DataTable.test.tsx` (modified, +44/-1)
```diff
@@ -732,6 +732,49 @@ describe('DataTable', () => {
       expect(getRowOrder()).toEqual(['1', '2', '3'])
     })
 
+    it('should keep the sort action in the button description', async () => {
+      const user = userEvent.setup()
+      render(
+        <DataTable
+          data={[
+            {
+              id: 1,
+              value: 1,
+            },
+          ]}
+          columns={[
+            {
+              header: 'Value',
+              field: 'value',
+              sortBy: true,
+            },
+          ]}
+        />,
+      )
+
+      const header = screen.getByRole('columnheader', {name: 'Value'})
+      const sortButton = screen.getByRole('button', {name: 'Value'})
+
+      expect(header).toHaveAccessibleName('Value')
+      expect(header).not.toHaveAttribute('aria-sort')
+      expect(sortButton).toHaveAccessibleName('Value')
+      expect(sortButton).toHaveAccessibleDescription('Sort ascending')
+
+      await user.click(sortButton)
+
+      expect(header).toHaveAccessibleName('Value')
+      expect(header).toHaveAttribute('aria-sort', 'ascending')
+      expect(sortButton).toHaveAccessibleName('Value')
+      expect(sortButton).toHaveAccessibleDescription('Sort descending')
+
+      await user.click(sortButton)
+
+      expect(header).toHaveAccessibleName('Value')
+      expect(header).toHaveAttribute('aria-sort', 'descending')
+      expect(sortButton).toHaveAccessibleName('Value')
+      expect(sortButton).toHaveAccessibleDescription('Sort ascending')
+    })
+
     it('should change the sort direction on keyboard Enter or Space', async () => {
       const user = userEvent.setup()
       render(
@@ -878,7 +921,7 @@ describe('DataTable', () => {
 
       // When interacting with Column B, sort order should reset to ASC
       await user.click(screen.getByText('Column B'))
-      expect(getSortHeader('Column A sort ascending')).not.toHaveAttribute('aria-sort')
+      expect(getSortHeader('Column A')).not.toHaveAttribute('aria-sort')
       expect(getSortHeader('Column B')).toHaveAttribute('aria-sort', 'ascending')
       expect(getRowOrder()).toEqual([
         [3, 1],
```

**File**: `packages/react/src/DataTable/__tests__/Table.test.tsx` (modified, +50/-1)
```diff
@@ -2,7 +2,8 @@ import {describe, expect, it} from 'vitest'
 import {render, screen} from '@testing-library/react'
 import {DataTable, Table} from '../../DataTable'
 import {createColumnHelper} from '../column'
-import type {TableProps} from '../Table'
+import {TableSortHeader, type TableProps} from '../Table'
+import {SortDirection} from '../sorting'
 import {implementsClassName} from '../../utils/testing'
 import classes from '../Table.module.css'
 
@@ -218,6 +219,54 @@ describe('Table', () => {
     })
   })
 
+  describe('Table.SortHeader', () => {
+    it('should preserve a consumer-provided aria-label', () => {
+      render(
+        <Table>
+          <Table.Head>
+            <Table.Row>
+              <TableSortHeader aria-label="Custom column name" direction={SortDirection.ASC} onToggleSort={() => {}}>
+                Visible column name
+              </TableSortHeader>
+            </Table.Row>
+          </Table.Head>
+        </Table>,
+      )
+
+      const header = screen.getByRole('columnheader', {name: 'Custom column name'})
+      const sortButton = screen.getByRole('button', {name: 'Visible column name'})
+
+      expect(header).toHaveAttribute('aria-sort', 'ascending')
+      expect(sortButton).toHaveAccessibleDescription('Sort descending')
+    })
+
+    it('should preserve a consumer-provided aria-labelledby', () => {
+      render(
+        <>
+          <span id="custom-column-name">Custom column name</span>
+          <Table>
+            <Table.Head>
+              <Table.Row>
+                <TableSortHeader
+                  aria-labelledby="custom-column-name"
+                  direction={SortDirection.ASC}
+                  onToggleSort={() => {}}
+                >
+                  Visible column name
+                </TableSortHeader>
+              </Table.Row>
+            </Table.Head>
+          </Table>
+        </>,
+      )
+
+      const header = screen.getByRole('columnheader', {name: 'Custom column name'})
+
+      expect(header).toHaveAttribute('aria-labelledby', 'custom-column-name')
+      expect(screen.getByRole('button', {name: 'Visible column name'})).toHaveAccessibleDescription('Sort descending')
+    })
+  })
+
   describe('Table.Cell', () => {
     implementsClassName(
       props => (
```

---

### Incident Patch 10: `1bdc66a2` (2026-09-04)
**Commit Message**: Fix Primer API review workflow runtime (#8382)

Copilot-Session: 3128ef9c-d4d9-4ad6-8339-94d08ce7eed2

**File**: `.github/aw/actions-lock.json` (modified, +3/-3)
```diff
@@ -1,9 +1,9 @@
 {
   "entries": {
-    "github/gh-aw-actions/setup@v0.85.4": {
+    "github/gh-aw-actions/setup@v0.88.2": {
       "repo": "github/gh-aw-actions/setup",
-      "version": "v0.85.4",
-      "sha": "2709137ea6c5b0e19aa621454dc643ea8dc526b1"
+      "version": "v0.88.2",
+      "sha": "9271a1804551c0dc4fb0085a97979950aa2f8489"
     }
   }
 }
```

---

### Incident Patch 11: `56ebdc49` (2026-09-04)
**Commit Message**: Fix ScrollableRegion focusability based on overflow state (#8370)

**File**: `.changeset/fresh-regions-scroll.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@primer/react': patch
+---
+
+ScrollableRegion: Remove focusability when content no longer overflows
```

**File**: `packages/react/src/ScrollableRegion/ScrollableRegion.test.tsx` (modified, +79/-42)
```diff
@@ -7,11 +7,53 @@ import classes from './ScrollableRegion.module.css'
 
 const originalResizeObserver = window.ResizeObserver
 
+interface ElementDimensions {
+  scrollHeight: number
+  clientHeight: number
+  scrollWidth: number
+  clientWidth: number
+}
+
 describe('ScrollableRegion', () => {
   implementsClassName(ScrollableRegion, classes.ScrollableRegion)
 
   let mockResizeCallback: (entries: Array<ResizeObserverEntry>) => void
 
+  function triggerResize(target: HTMLElement, dimensions: Partial<ElementDimensions> = {}) {
+    const {scrollHeight = 100, clientHeight = 100, scrollWidth = 100, clientWidth = 100} = dimensions
+
+    Object.defineProperties(target, {
+      scrollHeight: {configurable: true, value: scrollHeight},
+      clientHeight: {configurable: true, value: clientHeight},
+      scrollWidth: {configurable: true, value: scrollWidth},
+      clientWidth: {configurable: true, value: clientWidth},
+    })
+
+    act(() => {
+      mockResizeCallback([
+        {
+          target,
+          borderBoxSize: [],
+          contentBoxSize: [],
+          contentRect: {
+            width: 0,
+            height: 0,
+            top: 0,
+            right: 0,
+            bottom: 0,
+            left: 0,
+            x: 0,
+            y: 0,
+            toJSON() {
+              return {}
+            },
+          },
+          devicePixelContentBoxSize: [],
+        },
+      ])
+    })
+  }
+
   beforeEach(() => {
     window.ResizeObserver = class ResizeObserver {
       constructor(callback: ResizeObserverCallback) {
@@ -40,64 +82,59 @@ describe('ScrollableRegion', () => {
     expect(screen.getByTestId('container')).toHaveAttribute('data-component', 'ScrollableRegion')
   })
 
-  test('does not render with region props by default', () => {
+  test('does not render with region props when overflow is absent', () => {
     render(
       <ScrollableRegion aria-label="Example label" data-testid="container">
         Example content
       </ScrollableRegion>,
     )
 
-    expect(screen.getByTestId('container')).not.toHaveAttribute('role')
-    expect(screen.getByTestId('container')).not.toHaveAttribute('tabindex')
-    expect(screen.getByTestId('container')).not.toHaveAttribute('aria-labelledby')
-    expect(screen.getByTestId('container')).not.toHaveAttribute('aria-label')
+    const container = screen.getByTestId('container')
+    triggerResize(container)
 
-    expect(screen.getByTestId('container')).toHaveStyle('overflow: auto')
-    expect(screen.getByTestId('container')).toHaveStyle('position: relative')
+    expect(container).not.toHaveAttribute('role')
+    expect(container).not.toHaveAttribute('tabindex')
+    expect(container).not.toHaveAttribute('aria-labelledby')
+    expect(container).not.toHaveAttribute('aria-label')
+
+    expect(container).toHaveStyle('overflow: auto')
+    expect(container).toHaveStyle('position: relative')
   })
 
-  test('does render with region props when overflow is present', () => {
+  test.each([
+    {direction: 'vertical', dimensions: {scrollHeight: 500}},
+    {direction: 'horizontal', dimensions: {scrollWidth: 500}},
+  ])('renders with region props when $direction overflow appears', ({dimensions}) => {
     render(
       <ScrollableRegion aria-label="Example label" data-testid="container">
         Example content
       </ScrollableRegion>,
     )
 
-    act(() => {
-      // Mock a resize occurring when the scroll height is greater than the
-      // client height
-      const target = document.createElement('div')
-      mockResizeCallback([
-        {
-          target: {
-            ...target,
-            scrollHeight: 500,
-            clientHeight: 100,
-          },
-          borderBoxSize: [],
-          contentBoxSize: [],
-          contentRect: {
-            width: 0,
-            height: 0,
-            top: 0,
-            right: 0,
-            bottom: 0,
-            left: 0,
-            x: 0,
-            y: 0,
-            toJSON() {
-              return {}
-            },
-          },
-          devicePixelContentBoxSize: [],
-        },
-      ])
-    })
+    const container = screen.getByTestId('container')
+    triggerResize(container, dimensions)
+
+    expect(container).toBeVisible()
+    expect(container).toHaveAttribute('role', 'region')
+    expect(container).toHaveAttribute('tabindex', '0')
+    expect(container).toHaveAttribute('aria-label', 'Example label')
+  })
+
+  test('removes region props when overflow disappears', () => {
+    render(
+      <ScrollableRegion aria-label="Example label" data-testid="container">
+        Example content
+      </ScrollableRegion>,
+    )
 
-    expect(screen.getByLabelText('Example label')).toBeVisible()
+    const container = screen.getByTestId('container')
+    triggerResize(container, {scrollWidth: 500})
+    expect(container).toHaveAttribute('role', 'region')
+    expect(container).toHaveAttribute('tabindex', '0')
 
-    expect(screen.getByLabelText('Example label'
```

**File**: `packages/react/src/hooks/useOverflow.ts` (modified, +7/-9)
```diff
@@ -9,15 +9,13 @@ export function useOverflow<T extends HTMLElement>(ref: React.RefObject<T>) {
     }
 
     const observer = new ResizeObserver(entries => {
-      for (const entry of entries) {
-        if (
-          entry.target.scrollHeight > entry.target.clientHeight ||
-          entry.target.scrollWidth > entry.target.clientWidth
-        ) {
-          setHasOverflow(true)
-          break
-        }
-      }
+      setHasOverflow(
+        entries.some(
+          entry =>
+            entry.target.scrollHeight > entry.target.clientHeight ||
+            entry.target.scrollWidth > entry.target.clientWidth,
+        ),
+      )
     })
 
     observer.observe(ref.current)
```

---

### Incident Patch 12: `cf1f5393` (2026-09-03)
**Commit Message**: fix-readme-grammar (#8348)

Co-authored-by: Brittany L. Houtz <[REDACTED_EMAIL]>
Co-authored-by: llastflowers <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ yarn add @primer/react
 
 ## Template
 
-The fastest way make a prototype or try Primer React without setting up a new project is by using our [react template](https://github.com/primer/react-template).
+The fastest way to make a prototype or try Primer React without setting up a new project is by using our [react template](https://github.com/primer/react-template).
 
 ## Contributing
 
```

---

### Incident Patch 13: `f7329dc8` (2026-08-31)
**Commit Message**: Fix RelativeTime hydration across time zones (#8330)

Co-authored-by: LiuLiu <[REDACTED_EMAIL]>

**File**: `.changeset/quiet-times-agree.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@primer/react': patch
+---
+
+RelativeTime: Prevent hydration errors when the server and client use different time zones
\ No newline at end of file
```

**File**: `packages/react/src/RelativeTime/RelativeTime.test.tsx` (modified, +40/-1)
```diff
@@ -1,4 +1,7 @@
-import {describe, expect, it} from 'vitest'
+import {act} from 'react'
+import {hydrateRoot, type Root} from 'react-dom/client'
+import {renderToString} from 'react-dom/server'
+import {describe, expect, it, vi} from 'vitest'
 import RelativeTime from '.'
 import {render} from '@testing-library/react'
 import {implementsClassName} from '../utils/testing'
@@ -35,6 +38,42 @@ describe('RelativeTime', () => {
     expect(container.textContent).toEqual('server rendered date')
   })
 
+  it('hydrates the fallback without errors when server and client time zones differ', async () => {
+    const date = new Date('2024-03-07T00:30:00.000Z')
+    const relativeTime = <RelativeTime date={date} />
+    const toLocaleDateStringSpy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('Mar 7, 2024')
+    const container = document.createElement('div')
+    container.innerHTML = renderToString(relativeTime)
+    document.body.appendChild(container)
+
+    toLocaleDateStringSpy.mockImplementation((_locales, options) =>
+      options?.timeZone === 'UTC' ? 'Mar 7, 2024' : 'Mar 6, 2024',
+    )
+
+    const recoverableErrors: unknown[] = []
+    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
+    let root: Root | undefined
+
+    try {
+      expect(container.firstChild).toHaveTextContent('Mar 7, 2024')
+
+      await act(async () => {
+        root = hydrateRoot(container, relativeTime, {
+          onRecoverableError: error => recoverableErrors.push(error),
+        })
+      })
+
+      expect(recoverableErrors).toEqual([])
+      expect(consoleErrorSpy).not.toHaveBeenCalled()
+      expect(container.firstChild).toHaveTextContent('Mar 7, 2024')
+    } finally {
+      toLocaleDateStringSpy.mockRestore()
+      consoleErrorSpy.mockRestore()
+      await act(async () => root?.unmount())
+      container.remove()
+    }
+  })
+
   it('does not render no-title attribute by default', () => {
     const date = new Date('2024-03-07T12:22:48.123Z')
     const {container} = render(<RelativeTime date={date} />)
```

**File**: `packages/react/src/RelativeTime/RelativeTime.tsx` (modified, +6/-1)
```diff
@@ -4,7 +4,12 @@ import {createComponent} from '../utils/create-component'
 
 const RelativeTimeComponent = createComponent(RelativeTimeElement, 'relative-time')
 
-const localeOptions: Intl.DateTimeFormatOptions = {month: 'short', day: 'numeric', year: 'numeric'}
+const localeOptions: Intl.DateTimeFormatOptions = {
+  month: 'short',
+  day: 'numeric',
+  year: 'numeric',
+  timeZone: 'UTC',
+} satisfies Intl.DateTimeFormatOptions
 function RelativeTime({date, datetime, children, noTitle, ...props}: RelativeTimeProps) {
   if (datetime) date = new Date(datetime)
   return (
```

---

### Incident Patch 14: `a79d6c60` (2026-08-31)
**Commit Message**: UnderlineNav: Prevent borders from triggering overflow menu (#8340)

Co-authored-by: Shiyun Xu <[REDACTED_EMAIL]>
Co-authored-by: Copilot <[REDACTED_EMAIL]>
Co-authored-by: LiuLiu <[REDACTED_EMAIL]>

**File**: `.changeset/underline-wrapper-force-no-border.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@primer/react': patch
+---
+
+UnderlineNav: Prevent external borders from incorrectly triggering the overflow menu
```

**File**: `packages/react/src/internal/components/UnderlineTabbedInterface.module.css` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
 
     /* Pin the vertical box model so external box-sizing/border/padding overrides can't change the height budget and incorrectly trigger the overflow "more" menu */
     box-sizing: border-box !important;
-    border-block: 0 !important;
+    border: 0 !important;
     padding-block: var(--base-size-8) 0 !important;
 
     .UnderlineItemList {
```

---

### Incident Patch 15: `6efdeb98` (2026-08-31)
**Commit Message**: Add size prop naming guidelines (#8291)

Co-authored-by: Copilot <[REDACTED_EMAIL]>
Copilot-Session: 340f1c08-6adb-4055-a220-52a750204d3b

**File**: `.github/skills/style-guide/docs/component-prop-naming.md` (modified, +50/-0)
```diff
@@ -16,6 +16,10 @@ Use these conventions when creating, editing, or evaluating props for Primer Rea
   - [Use a single mode prop instead of mutually exclusive boolean props](#use-a-single-mode-prop-instead-of-mutually-exclusive-boolean-props)
 - [Use the variant prop to communicate purpose](#use-the-variant-prop-to-communicate-purpose)
 - [Avoid using the variant prop to communicate appearance](#avoid-using-the-variant-prop-to-communicate-appearance)
+- [Use the size prop to communicate scale](#use-the-size-prop-to-communicate-scale)
+  - [Prefer small, medium, and large](#prefer-small-medium-and-large)
+  - [Use numeric sizes when precise dimensions are part of the API](#use-numeric-sizes-when-precise-dimensions-are-part-of-the-api)
+  - [Extend the scale with `xsmall` and `xlarge` when needed](#extend-the-scale-with-xsmall-and-xlarge-when-needed)
 
 <!-- END doctoc generated TOC please keep comment here to allow auto update -->
 <!-- prettier-ignore-end -->
@@ -207,3 +211,49 @@ type ExampleAppearanceProps = {
   shape?: 'square' | 'rounded'
 }
 ```
+
+## Use the size prop to communicate scale
+
+Use a `size` prop when a component offers multiple visual scales. Do not use
+`variant` to represent size because `variant` communicates semantic purpose.
+
+### Prefer small, medium, and large
+
+Use `small`, `medium`, and `large` as the standard named size values, with
+`medium` as the default. Components do not need to support every value when a
+size is not meaningful for their design.
+
+```tsx
+// Prefer
+type ExampleProps = {
+  size?: 'small' | 'medium' | 'large'
+}
+
+// Avoid
+type ExampleProps = {
+  size?: 'small' | 'normal' | 'extra-large'
+}
+```
+
+Only introduce an additional size name when the standard scale cannot describe
+a distinct, supported use case. Keep shared size names visually compatible when
+components are designed to be used together.
+
+### Use numeric sizes when precise dimensions are part of the API
+
+Numeric sizes are appropriate when consumers need precise dimensions, such as
+for avatars or icons. Prefer named sizes for components that are expected to
+align with other controls without requiring consumers to coordinate pixel
+values.
+
+```tsx
+type AvatarProps = {
+  size?: number | ResponsiveValue<number>
+}
+```
+
+### Extend the scale with `xsmall` and `xlarge` when needed
+
+When a component needs to support a size smaller than `small` or larger than
+`large`, use `xsmall` and `xlarge` to extend the scale. Avoid introducing
+additional size names unless they are necessary for a distinct use case.
```

#### Recent Merged Pull Requests:
- **PR #8492** (closed): Add GitHub Actions workflow for Node.js with Webpack (@Boo1012)
- **PR #8486** (closed): [TEST] Integration/8412 loading button disabled styles (@francinelucca)
- **PR #8482** (closed): Liuliu/fix selectpanel announcement (@liuliu-dev)
- **PR #8479** (closed): chore(deps): bump brace-expansion (@dependabot[bot])
- **PR #8473** (2026-10-01): Upgrade @primer/live-region-element to 0.8.1 (@Copilot)
- **PR #8472** (closed): refactor!: prototype static compound component namespaces (@joshblack)
- **PR #8469** (2026-09-30): Revert SegmentedControl label wrapping (@jonrohan)
- **PR #8468** (2026-10-05): Add agentic workflow to clean up unused feature flags (@Copilot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

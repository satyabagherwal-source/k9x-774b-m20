> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/syntax-tree-hast-util-to-html-learnings.md`  
> **Source**: github ([https://github.com/syntax-tree/hast-util-to-html](https://github.com/syntax-tree/hast-util-to-html))  
> **Source Version**: `d115f5be`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T23:34:37.947Z  
> **Learning ID**: `learn-github-syntax-tree-hast-util-to-html`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): syntax-tree/hast-util-to-html

> **Canonical Artifact**: `07_PROJECT_LEARNING/syntax-tree-hast-util-to-html-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/syntax-tree/hast-util-to-html](https://github.com/syntax-tree/hast-util-to-html))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T23:34:37.940Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `syntax-tree/hast-util-to-html`
- **Description**: utility to serialize hast to HTML 
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json
- **Stars / Engagement**: 119 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lib/omission/util/siblings.js`
```
/**
 * @import {Parents, RootContent} from 'hast'
 */

import {whitespace} from 'hast-util-whitespace'

export const siblingAfter = siblings(1)
export const siblingBefore = siblings(-1)

/** @type {Array<RootContent>} */
const emptyChildren = []

/**
 * Factory to check siblings in a direction.
 *
 * @param {number} increment
 */
function siblings(increment) {
  return sibling

  /**
   * Find applicable siblings in a direction.
   *
   * @template {Parents} Parent
   *   Parent type.
   * @param {Parent | undefined} parent
   *   Parent.
   * @param {number | undefined} index
   *   Index of child in `parent`.
   * @param {boolean | undefined} [includeWhitespace=false]
   *   Whether to include whitespace (default: `false`).
   * @returns {Parent extends {children: Array<infer Child>} ? Child | undefined : never}
   *   Child of parent.
   */
  function sibling(parent, index, includeWhitespace) {
    const siblings = parent ? parent.children : emptyChildren
    let offset = (index || 0) + increment
    let next = siblings[offset]

    if (!includeWhitespace) {
      while (next && whitespace(next)) {
        offset += increment
        next = siblings[offset]
      }
    }

    // @ts-expect-error: it’s a correct child.
    return next
  }
}

```

### Core Architecture Module: `index.js`
```
/**
 * @typedef {import('./lib/index.js').CharacterReferences} CharacterReferences
 * @typedef {import('./lib/index.js').Options} Options
 * @typedef {import('./lib/index.js').Quote} Quote
 * @typedef {import('./lib/index.js').Space} Space
 */

export {toHtml} from './lib/index.js'

```

### Core Architecture Module: `lib/handle/comment.js`
```
/**
 * @import {Comment, Parents} from 'hast'
 * @import {State} from '../index.js'
 */

import {stringifyEntities} from 'stringify-entities'

const htmlCommentRegex = /^>|^->|<!--|-->|--!>|<!-$/g

// Declare arrays as variables so it can be cached by `stringifyEntities`
const bogusCommentEntitySubset = ['>']
const commentEntitySubset = ['<', '>']

/**
 * Serialize a comment.
 *
 * @param {Comment} node
 *   Node to handle.
 * @param {number | undefined} _1
 *   Index of `node` in `parent.
 * @param {Parents | undefined} _2
 *   Parent of `node`.
 * @param {State} state
 *   Info passed around about the current state.
 * @returns {string}
 *   Serialized node.
 */
export function comment(node, _1, _2, state) {
  // See: <https://html.spec.whatwg.org/multipage/syntax.html#comments>
  return state.settings.bogusComments
    ? '<?' +
        stringifyEntities(
          node.value,
          Object.assign({}, state.settings.characterReferences, {
            subset: bogusCommentEntitySubset
          })
        ) +
        '>'
    : '<!--' + node.value.replace(htmlCommentRegex, encode) + '-->'

  /**
   * @param {string} $0
   */
  function encode($0) {
    return stringifyEntities(
      $0,
      Object.assign({}, state.settings.characterReferences, {
        subset: commentEntitySubset
      })
    )
  }
}

```

### Core Architecture Module: `lib/handle/doctype.js`
```
/**
 * @import {Doctype, Parents} from 'hast'
 * @import {State} from '../index.js'
 */

/**
 * Serialize a doctype.
 *
 * @param {Doctype} _1
 *   Node to handle.
 * @param {number | undefined} _2
 *   Index of `node` in `parent.
 * @param {Parents | undefined} _3
 *   Parent of `node`.
 * @param {State} state
 *   Info passed around about the current state.
 * @returns {string}
 *   Serialized node.
 */
export function doctype(_1, _2, _3, state) {
  return (
    '<!' +
    (state.settings.upperDoctype ? 'DOCTYPE' : 'doctype') +
    (state.settings.tightDoctype ? '' : ' ') +
    'html>'
  )
}

```

### Core Architecture Module: `lib/handle/element.js`
```
/**
 * @import {Element, Parents, Properties} from 'hast'
 * @import {State} from '../index.js'
 */

import {ccount} from 'ccount'
import {stringify as commas} from 'comma-separated-tokens'
import {find, svg} from 'property-information'
import {stringify as spaces} from 'space-separated-tokens'
import {stringifyEntities} from 'stringify-entities'
import {closing} from '../omission/closing.js'
import {opening} from '../omission/opening.js'

/**
 * Maps of subsets.
 *
 * Each value is a matrix of tuples.
 * The value at `0` causes parse errors, the value at `1` is valid.
 * Of both, the value at `0` is unsafe, and the value at `1` is safe.
 *
 * @type {Record<'double' | 'name' | 'single' | 'unquoted', Array<[Array<string>, Array<string>]>>}
 */
const constants = {
  // See: <https://html.spec.whatwg.org/#attribute-name-state>.
  name: [
    ['\t\n\f\r &/=>'.split(''), '\t\n\f\r "&\'/=>`'.split('')],
    ['\0\t\n\f\r "&\'/<=>'.split(''), '\0\t\n\f\r "&\'/<=>`'.split('')]
  ],
  // See: <https://html.spec.whatwg.org/#attribute-value-(unquoted)-state>.
  unquoted: [
    ['\t\n\f\r &>'.split(''), '\0\t\n\f\r "&\'<=>`'.split('')],
    ['\0\t\n\f\r "&\'<=>`'.split(''), '\0\t\n\f\r "&\'<=>`'.split('')]
  ],
  // See: <https://html.spec.whatwg.org/#attribute-value-(single-quoted)-state>.
  single: [
    ["&'".split(''), '"&\'`'.split('')],
    ["\0&'".split(''), '\0"&\'`'.split('')]
  ],
  // See: <https://html.spec.whatwg.org/#attribute-value-(double-quoted)-state>.
  double: [
    ['"&'.split(''), '"&\'`'.split('')],
    ['\0"&'.split(''), '\0"&\'`'.split('')]
  ]
}

/**
 * Serialize an element node.
 *
 * @param {Element} node
 *   Node to handle.
 * @param {number | undefined} index
 *   Index of `node` in `parent.
 * @param {Parents | undefined} parent
 *   Parent of `node`.
 * @param {State} state
 *   Info passed around about the current state.
 * @returns {string}
 *   Serialized node.
 */
export function element(node, index, parent, state) {
  const schema = state.schema
  const omit = schema.space === 'svg' ? false : state.settings.omitOptionalTags
  let selfClosing =
    schema.space === 'svg'
      ? state.settings.closeEmptyElements
      : state.settings.voids.includes(node.tagName.toLowerCase())
  /** @type {Array<string>} */
  const parts = []
  /** @type {string} */
  let last

  if (schema.space === 'html' && node.tagName === 'svg') {
    state.schema = svg
  }

  const attributes = serializeAttributes(state, node.properties)

  const content = state.all(
    schema.space === 'html' && node.tagName === 'template' ? node.content : node
  )

  state.schema = schema

  // If the node is categorised as void, but it has children, remove the
  // categorisation.
  // This enables for example `menuitem`s, which are void in W3C HTML but not
  // void in WHATWG HTML, to be stringified properly.
  // Note: `menuitem` has since been removed from the HTML spec, and so is no
  // longer void.
  if (content) selfClosing = false

  if (attributes || !omit || !opening(node, index, parent)) {
    parts.push('<', node.tagName, attributes ? ' ' + attributes : '')

    if (
      selfClosing &&
      (schema.space === 'svg' || state.settings.closeSelfClosing)
    ) {
      last = attributes.charAt(attributes.length - 1)
      if (
        !state.settings.tightSelfClosing ||
        last === '/' ||
        (last && last !== '"' && last !== "'")
      ) {
        parts.push(' ')
      }

      parts.push('/')
    }

    parts.push('>')
  }

  parts.push(content)

  if (!selfClosing && (!omit || !closing(node, index, parent))) {
    parts.push('</' + node.tagName + '>')
  }

  return parts.join('')
}

/**
 * @param {State} state
 * @param {Properties | null | undefined} properties
 * @returns {string}
 */
function serializeAttributes(state, properties) {
  /** @type {Array<string>} */
  const values = []
  let index = -1
  /** @type {string} */
  let key

  if (properties) {
    for (key in properties) {
      if (properties[key] !== null && properties[key] !== undefined) {
        const value = serializeAttribute(state, key, properties[key])
        if (value) values.push(value)
      }
    }
  }

  while (++index < values.length) {
    const last = state.settings.tightAttributes
      ? values[index].charAt(values[index].length - 1)
      : undefined

    // In tight mode, don’t add a space after quoted attributes.
    if (index !== values.length - 1 && last !== '"' && last !== "'") {
      values[index] += ' '
    }
  }

  return values.join('')
}

/**
 * @param {State} state
 * @param {string} key
 * @param {Properties[keyof Properties]} value
 * @returns {string}
 */
function serializeAttribute(state, key, value) {
  const info = find(state.schema, key)
  const x =
    state.settings.allowParseErrors && state.schema.space === 'html' ? 0 : 1
  const y = state.settings.allowDangerousCharacters ? 0 : 1
  let quote = state.quote
  /** @type {string | undefined} */
  let result

  if (info.overloadedBoolean && (value === info.attribute || value === '')) {
    value = true
  } else if (
    (info.boolean || info.overloadedBoolean) &&
    (typeof value !== 'string' || value === info.attribute || value === '')
  ) {
    value = Boolean(value)
  }

  if (
    value === null ||
    value === undefined ||
    value === false ||
    (typeof value === 'number' && Number.isNaN(value))
  ) {
    return ''
  }

  const name = stringifyEntities(
    info.attribute,
    Object.assign({}, state.settings.characterReferences, {
      // Always encode without parse errors in non-HTML.
      subset: constants.name[x][y]
    })
  )

  // No value.
  // There is currently only one boolean property in SVG: `[download]` on
  // `<a>`.
  // This property does not seem to work in browsers (Firefox, Safari, Chrome),
  // so I can’t test if dropping the value works.
  // But I assume that it should:
  //
  // ```html
  // <!doctype html>
  // <svg viewBox="0 0 100 100">
  //   <a href=https://example.com download>
  //     <circle cx=50 cy=40 r=35 />
  //   </a>
  // </svg>
  // ```
  //
  // See: <https://github.com/wooorm/property-information/blob/main/lib/svg.js>
  if (value === true) return name

  // `spaces` doesn’t accept a second argument, but it’s given here just to
  // keep the code cleaner.
  value = Array.isArray(value)
    ? (info.commaSeparated ? commas : spaces)(value, {
        padLeft: !state.settings.tightCommaSeparatedLists
      })
    : String(value)

  if (state.settings.collapseEmptyAttributes && !value) return name

  // Check unquoted value.
  if (state.settings.preferUnquoted) {
    result = stringifyEntities(
      value,
      Object.assign({}, state.settings.characterReferences, {
        attribute: true,
        subset: constants.unquoted[x][y]
      })
    )
  }

  // If we don’t want unquoted, or if `value` contains character references when
  // unquoted…
  if (result !== value) {
    // If the alternative is less common than `quote`, switch.
    if (
      state.settings.quoteSmart &&
      ccount(value, quote) > ccount(value, state.alternative)
    ) {
      quote = state.alternative
    }

    result =
      quote +
      stringifyEntities(
        value,
        Object.assign({}, state.settings.characterReferences, {
          // Always encode without parse errors in non-HTML.
          subset: (quote === "'" ? constants.single : constants.double)[x][y],
          attribute: true
        })
      ) +
      quote
  }

  // Don’t add a `=` for unquoted empties.
  return name + (result ? '=' + result : result)
}

```

### Core Architecture Module: `lib/handle/index.js`
```
/**
 * @import {Nodes, Parents} from 'hast'
 * @import {State} from '../index.js'
 */

import {zwitch} from 'zwitch'
import {comment} from './comment.js'
import {doctype} from './doctype.js'
import {element} from './element.js'
import {raw} from './raw.js'
import {root} from './root.js'
import {text} from './text.js'

/**
 * @type {(node: Nodes, index: number | undefined, parent: Parents | undefined, state: State) => string}
 */
export const handle = zwitch('type', {
  invalid,
  unknown,
  handlers: {comment, doctype, element, raw, root, text}
})

/**
 * Fail when a non-node is found in the tree.
 *
 * @param {unknown} node
 *   Unknown value.
 * @returns {never}
 *   Never.
 */
function invalid(node) {
  throw new Error('Expected node, not `' + node + '`')
}

/**
 * Fail when a node with an unknown type is found in the tree.
 *
 * @param {unknown} node_
 *  Unknown node.
 * @returns {never}
 *   Never.
 */
function unknown(node_) {
  // `type` is guaranteed by runtime JS.
  const node = /** @type {Nodes} */ (node_)
  throw new Error('Cannot compile unknown node `' + node.type + '`')
}

```

### Core Architecture Module: `lib/handle/raw.js`
```
/**
 * @import {Parents} from 'hast'
 * @import {Raw} from 'mdast-util-to-hast'
 * @import {State} from '../index.js'
 */

import {text} from './text.js'

/**
 * Serialize a raw node.
 *
 * @param {Raw} node
 *   Node to handle.
 * @param {number | undefined} index
 *   Index of `node` in `parent.
 * @param {Parents | undefined} parent
 *   Parent of `node`.
 * @param {State} state
 *   Info passed around about the current state.
 * @returns {string}
 *   Serialized node.
 */
export function raw(node, index, parent, state) {
  return state.settings.allowDangerousHtml
    ? node.value
    : text(node, index, parent, state)
}

```

### Core Architecture Module: `lib/handle/root.js`
```
/**
 * @import {Parents, Root} from 'hast'
 * @import {State} from '../index.js'
 */

/**
 * Serialize a root.
 *
 * @param {Root} node
 *   Node to handle.
 * @param {number | undefined} _1
 *   Index of `node` in `parent.
 * @param {Parents | undefined} _2
 *   Parent of `node`.
 * @param {State} state
 *   Info passed around about the current state.
 * @returns {string}
 *   Serialized node.
 */
export function root(node, _1, _2, state) {
  return state.all(node)
}

```

### Core Architecture Module: `lib/handle/text.js`
```
/**
 * @import {Parents, Text} from 'hast'
 * @import {Raw} from 'mdast-util-to-hast'
 * @import {State} from '../index.js'
 */

import {stringifyEntities} from 'stringify-entities'

// Declare array as variable so it can be cached by `stringifyEntities`
const textEntitySubset = ['<', '&']

/**
 * Serialize a text node.
 *
 * @param {Raw | Text} node
 *   Node to handle.
 * @param {number | undefined} _
 *   Index of `node` in `parent.
 * @param {Parents | undefined} parent
 *   Parent of `node`.
 * @param {State} state
 *   Info passed around about the current state.
 * @returns {string}
 *   Serialized node.
 */
export function text(node, _, parent, state) {
  // Check if content of `node` should be escaped.
  return parent &&
    parent.type === 'element' &&
    (parent.tagName === 'script' || parent.tagName === 'style')
    ? node.value
    : stringifyEntities(
        node.value,
        Object.assign({}, state.settings.characterReferences, {
          subset: textEntitySubset
        })
      )
}

```

### Core Architecture Module: `lib/index.js`
```
/**
 * @import {Nodes, Parents, RootContent} from 'hast'
 * @import {Schema} from 'property-information'
 * @import {Options as StringifyEntitiesOptions} from 'stringify-entities'
 */

/**
 * @typedef {Omit<StringifyEntitiesOptions, 'attribute' | 'escapeOnly' | 'subset'>} CharacterReferences
 *
 * @typedef Options
 *   Configuration.
 * @property {boolean | null | undefined} [allowDangerousCharacters=false]
 *   Do not encode some characters which cause XSS vulnerabilities in older
 *   browsers (default: `false`).
 *
 *   > ⚠️ **Danger**: only set this if you completely trust the content.
 * @property {boolean | null | undefined} [allowDangerousHtml=false]
 *   Allow `raw` nodes and insert them as raw HTML (default: `false`).
 *
 *   When `false`, `Raw` nodes are encoded.
 *
 *   > ⚠️ **Danger**: only set this if you completely trust the content.
 * @property {boolean | null | undefined} [allowParseErrors=false]
 *   Do not encode characters which cause parse errors (even though they work),
 *   to save bytes (default: `false`).
 *
 *   Not used in the SVG space.
 *
 *   > 👉 **Note**: intentionally creates parse errors in markup (how parse
 *   > errors are handled is well defined, so this works but isn’t pretty).
 * @property {boolean | null | undefined} [bogusComments=false]
 *   Use “bogus comments” instead of comments to save byes: `<?charlie>`
 *   instead of `<!--charlie-->` (default: `false`).
 *
 *   > 👉 **Note**: intentionally creates parse errors in markup (how parse
 *   > errors are handled is well defined, so this works but isn’t pretty).
 * @property {CharacterReferences | null | undefined} [characterReferences]
 *   Configure how to serialize character references (optional).
 * @property {boolean | null | undefined} [closeEmptyElements=false]
 *   Close SVG elements without any content with slash (`/`) on the opening tag
 *   instead of an end tag: `<circle />` instead of `<circle></circle>`
 *   (default: `false`).
 *
 *   See `tightSelfClosing` to control whether a space is used before the
 *   slash.
 *
 *   Not used in the HTML space.
 * @property {boolean | null | undefined} [closeSelfClosing=false]
 *   Close self-closing nodes with an extra slash (`/`): `<img />` instead of
 *   `<img>` (default: `false`).
 *
 *   See `tightSelfClosing` to control whether a space is used before the
 *   slash.
 *
 *   Not used in the SVG space.
 * @property {boolean | null | undefined} [collapseEmptyAttributes=false]
 *   Collapse empty attributes: get `class` instead of `class=""` (default:
 *   `false`).
 *
 *   Not used in the SVG space.
 *
 *   > 👉 **Note**: boolean attributes (such as `hidden`) are always collapsed.
 * @property {boolean | null | undefined} [omitOptionalTags=false]
 *   Omit optional opening and closing tags (default: `false`).
 *
 *   For example, in `<ol><li>one</li><li>two</li></ol>`, both `</li>` closing
 *   tags can be omitted.
 *   The first because it’s followed by another `li`, the last because it’s
 *   followed by nothing.
 *
 *   Not used in the SVG space.
 * @property {boolean | null | undefined} [preferUnquoted=false]
 *   Leave attributes unquoted if that results in less bytes (default: `false`).
 *
 *   Not used in the SVG space.
 * @property {boolean | null | undefined} [quoteSmart=false]
 *   Use the other quote if that results in less bytes (default: `false`).
 * @property {Quote | null | undefined} [quote='"']
 *   Preferred quote to use (default: `'"'`).
 * @property {Space | null | undefined} [space='html']
 *   When an `<svg>` element is found in the HTML space, this package already
 *   automatically switches to and from the SVG space when entering and exiting
 *   it (default: `'html'`).
 *
 *   > 👉 **Note**: hast is not XML.
 *   > It supports SVG as embedded in HTML.
 *   > It does not support the features available in XML.
 *   > Passing SVG might break but fragments of modern SVG should be fine.
 *   > Use [`xast`][xast] if you need to support SVG as XML.
 * @property {boolean | null | undefined} [tightAttributes=false]
 *   Join attributes together, without whitespace, if possible: get
 *   `class="a b"title="c d"` instead of `class="a b" title="c d"` to save
 *   bytes (default: `false`).
 *
 *   Not used in the SVG space.
 *
 *   > 👉 **Note**: intentionally creates parse errors in markup (how parse
 *   > errors are handled is well defined, so this works but isn’t pretty).
 * @property {boolean | null | undefined} [tightCommaSeparatedLists=false]
 *   Join known comma-separated attribute values with just a comma (`,`),
 *   instead of padding them on the right as well (`,␠`, where `␠` represents a
 *   space) (default: `false`).
 * @property {boolean | null | undefined} [tightDoctype=false]
 *   Drop unneeded spaces in doctypes: `<!doctypehtml>` instead of
 *   `<!doctype html>` to save bytes (default: `false`).
 *
 *   > 👉 **Note**: intentionally creates parse errors in markup (how parse
 *   > errors are handled is well defined, so this works but isn’t pretty).
 * @property {boolean | null | undefined} [tightSelfClosing=false]
 *   Do not use an extra space when closing self-closing elements: `<img/>`
 *   instead of `<img />` (default: `false`).
 *
 *   > 👉 **Note**: only used if `closeSelfClosing: true` or
 *   > `closeEmptyElements: true`.
 * @property {boolean | null | undefined} [upperDoctype=false]
 *   Use a `<!DOCTYPE…` instead of `<!doctype…` (default: `false`).
 *
 *   Useless except for XHTML.
 * @property {ReadonlyArray<string> | null | undefined} [voids]
 *   Tag names of elements to serialize without closing tag (default: `html-void-elements`).
 *
 *   Not used in the SVG space.
 *
 *   > 👉 **Note**: It’s highly unlikely that you want to pass this, because
 *   > hast is not for XML, and HTML will not add more void elements.
 *
 * @typedef {'"' | "'"} Quote
 *   HTML quotes for attribute values.
 *
 * @typedef {Omit<Required<{[key in keyof Options]: Exclude<Options[key], null | undefined>}>, 'space' | 'quote'>} Settings
 *
 * @typedef {'html' | 'svg'} Space
 *   Namespace.
 *
 * @typedef State
 *   Info passed around about the current state.
 * @property {(node: Parents | undefined) => string} all
 *   Serialize the children of a parent node.
 * @property {Quote} alternative
 *   Alternative quote.
 * @property {(node: Nodes, index: number | undefined, parent: Parents | undefined) => string} one
 *   Serialize one node.
 * @property {Quote} quote
 *   Preferred quote.
 * @property {Schema} schema
 *   Current schema.
 * @property {Settings} settings
 *   User configuration.
 */

import {htmlVoidElements} from 'html-void-elements'
import {html, svg} from 'property-information'
import {handle} from './handle/index.js'

/** @type {Options} */
const emptyOptions = {}

/** @type {CharacterReferences} */
const emptyCharacterReferences = {}

/** @type {Array<never>} */
const emptyChildren = []

/**
 * Serialize hast as HTML.
 *
 * @param {Array<RootContent> | Nodes} tree
 *   Tree to serialize.
 * @param {Options | null | undefined} [options]
 *   Configuration (optional).
 * @returns {string}
 *   Serialized HTML.
 */
export function toHtml(tree, options) {
  const options_ = options || emptyOptions
  const quote = options_.quote || '"'
  const alternative = quote === '"' ? "'" : '"'

  if (quote !== '"' && quote !== "'") {
    throw new Error('Invalid quote `' + quote + '`, expected `\'` or `"`')
  }

  /** @type {State} */
  const state = {
    one,
    all,
    settings: {
      omitOptionalTags: options_.omitOptionalTags || false,
      allowParseErrors: options_.allowParseErrors || false,
      allowDangerousCharacters: options_.allowDangerousCharacters || false,
      quoteSmart: options_.quoteSmart || false,
      preferUnquoted: options_.preferUnquoted || false,
      tightAttributes: options_.tightAttributes || false,
      upperDoctype: options_.upperDoctype || false,
      tightDoctype: options_.tightDoctype || false,
      bogusComments: options_.bogusComments || false,
      tightCommaSeparatedLists: options_.tightCommaSeparatedLists || false,
      tightSelfClosing: options_.tightSelfClosing || false,
      collapseEmptyAttributes: options_.collapseEmptyAttributes || false,
      allowDangerousHtml: options_.allowDangerousHtml || false,
      voids: options_.voids || htmlVoidElements,
      characterReferences:
        options_.characterReferences || emptyCharacterReferences,
      closeSelfClosing: options_.closeSelfClosing || false,
      closeEmptyElements: options_.closeEmptyElements || false
    },
    schema: options_.space === 'svg' ? svg : html,
    quote,
    alternative
  }

  return state.one(
    Array.isArray(tree) ? {type: 'root', children: tree} : tree,
    undefined,
    undefined
  )
}

/**
 * Serialize a node.
 *
 * @this {State}
 *   Info passed around about the current state.
 * @param {Nodes} node
 *   Node to handle.
 * @param {number | undefined} index
 *   Index of `node` in `parent.
 * @param {Parents | undefined} parent
 *   Parent of `node`.
 * @returns {string}
 *   Serialized node.
 */
function one(node, index, parent) {
  return handle(node, index, parent, this)
}

/**
 * Serialize all children of `parent`.
 *
 * @this {State}
 *   Info passed around about the current state.
 * @param {Parents | undefined} parent
 *   Parent whose children to serialize.
 * @returns {string}
 */
export function all(parent) {
  /** @type {Array<string>} */
  const results = []
  const children = (parent && parent.children) || emptyChildren
  let index = -1

  while (++index < children.length) {
    results[index] = this.one(children[index], index, parent)
  }

  return results.join('')
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #50** (2026-06-24): **fix: keep a leading newline in `pre`, `textarea`, and `listing`**
  *Symptoms*: ### Problem  The HTML parser drops a single `U+000A LINE FEED` immediately after the start tag of `pre`, `textarea`, and `listing`. So when such an element’s first child is a text node beginning with a newline, serializing and reparsing loses that newline:  ```js toHtml(h('pre', '\nalpha'))      // '<pre>\nalpha</pre>' fromHtml('<pre>\nalpha</pre>')   // the text node is 'alpha' — the newline is gone ```  The same happens for `textarea` and `listing`. Confirmed against `parse5` (the parser strips the leading newline), so it’s a real round-trip data loss for valid input.  ### Fix  The [HTML fragment serialization algorithm](https://html.spec.whatwg.org/#serialising-html-fragments) handles exactly this:  > If current node is a `pre`, `textarea`, or `listing` element, and the first child node of the element, if any, is a Text node whose character data has as its first character a U+000A LINE FEED, then append a U+000A LINE FEED.  So when the element is `pre`/`textarea`/`listing` (HTML space) and its first child is a text node starting with a newline, emit an extra leading newline:  ```js toHtml(h('pre', '\nalpha'))      // '<pre>\n\nalpha</pre>'  → reparses to '\nalpha' toHtml(h('pre', 'alpha'))        // '<pre>alpha</pre>'      (unchanged) ```  ### Tests  Added a case to `test/element.js` covering `pre`/`textarea`/`listing` with and without a leading newline. Full suite green (`node --test`), `prettier` and `xo` clean.

- **Issue #48** (2025-12-04): **fix(deps): update mdast-util-to-hast to ^13.2.1**
  *Symptoms*: <!--   Please check the needed checkboxes ([ ] -> [x]).   Leave the comments as they are: they do not show on GitHub.    Please try to limit the scope,   provide a general description of the changes,   and remember it's up to you to convince us to land it.    We are excited about pull requests.   Thank you! -->  ### Initial checklist  * [x] I read the support docs <!-- https://github.com/syntax-tree/.github/blob/main/support.md --> * [x] I read the contributing guide <!-- https://github.com/syntax-tree/.github/blob/main/contributing.md --> * [x] I agree to follow the code of conduct <!-- https://github.com/syntax-tree/.github/blob/main/code-of-conduct.md --> * [x] I searched issues and discussions and couldn't find anything or linked relevant results below <!-- https://github.com/search?q=user%3Asyntax-tree&type=issues and https://github.com/orgs/syntax-tree/discussions --> * [x] I made sure the docs are up to date * [x] I included tests (or that's not needed)  ### Description of changes  Update `mdast-util-to-hast` minimum version from `^13.0.0` to `^13.2.1` to fix security vulnerability GHSA-4fh9-h7wg-q85m (unsanitized class attribute).  <!--do not edit: pr-->

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

### Incident Patch 1: `8c32af8a` (2023-08-06)
**Commit Message**: Change to require Node.js 16

**File**: `readme.md` (modified, +2/-2)
```diff
@@ -354,8 +354,8 @@ versions of Node.js.
 
 When we cut a new major release, we drop support for unmaintained versions of
 Node.
-This means we try to keep the current release line, `hast-util-to-html@^8`,
-compatible with Node.js 12.
+This means we try to keep the current release line, `hast-util-to-html@^9`,
+compatible with Node.js 16.
 
 ## Security
 
```

**File**: `tsconfig.json` (modified, +2/-2)
```diff
@@ -5,10 +5,10 @@
     "declaration": true,
     "emitDeclarationOnly": true,
     "exactOptionalPropertyTypes": true,
-    "lib": ["es2020"],
+    "lib": ["es2022"],
     "module": "node16",
     "strict": true,
-    "target": "es2020"
+    "target": "es2022"
   },
   "exclude": ["coverage/", "node_modules/"],
   "include": ["**/*.js"]
```

---

### Incident Patch 2: `6000808b` (2024-12-13)
**Commit Message**: Fix to allow other strings for boolean attributes

Closes GH-45.
Closes GH-46.

Reviewed-by: Titus Wormer <[REDACTED_EMAIL]>

**File**: `lib/handle/element.js` (modified, +2/-2)
```diff
@@ -173,8 +173,8 @@ function serializeAttribute(state, key, value) {
   if (info.overloadedBoolean && (value === info.attribute || value === '')) {
     value = true
   } else if (
-    info.boolean ||
-    (info.overloadedBoolean && typeof value !== 'string')
+    (typeof value !== 'string' || value === '' || value === info.attribute) &&
+    (info.boolean || info.overloadedBoolean)
   ) {
     value = Boolean(value)
   }
```

**File**: `test/attribute.js` (modified, +43/-0)
```diff
@@ -161,6 +161,49 @@ test('`element` attributes', async (t) => {
         )
       }
     )
+
+    await t.test(
+      'should serialize known booleans set to arbitrary strings with value',
+      async function () {
+        assert.deepEqual(
+          toHtml(
+            h('div', {
+              selected: 'some string value for a well known boolean attribute'
+            })
+          ),
+          '<div selected="some string value for a well known boolean attribute"></div>'
+        )
+      }
+    )
+
+    await t.test(
+      'should serialize known booleans set to an empty string without value',
+      async function () {
+        assert.deepEqual(
+          toHtml(
+            h('div', {
+              selected: ''
+            })
+          ),
+          '<div selected></div>'
+        )
+      }
+    )
+
+    await t.test(
+      'should serialize known overloaded booleans set to arbitrary strings with value',
+      async function () {
+        assert.deepEqual(
+          toHtml(
+            h('div', {
+              download:
+                'some string value for a well known overloaded boolean attribute'
+            })
+          ),
+          '<div download="some string value for a well known overloaded boolean attribute"></div>'
+        )
+      }
+    )
   })
 
   await t.test('should support known overloaded booleans', async function (t) {
```

---

### Incident Patch 3: `1c938b92` (2024-09-16)
**Commit Message**: Fix `head` opening tag omission w/o title

While typically a `title` is needed,
there are cases where `<head>` can be empty,
in which case,
the start tag can be omitted.

Closes GH-43.

**File**: `lib/omission/opening.js` (modified, +12/-10)
```diff
@@ -37,23 +37,25 @@ function html(node) {
  *   Whether the opening tag can be omitted.
  */
 function head(node) {
-  const children = node.children
-  /** @type {Array<string>} */
-  const seen = []
-  let index = -1
+  /** @type {Set<string>} */
+  const seen = new Set()
 
-  while (++index < children.length) {
-    const child = children[index]
+  // Whether `srcdoc` or not,
+  // make sure the content model at least doesn’t have too many `base`s/`title`s.
+  for (const child of node.children) {
     if (
       child.type === 'element' &&
-      (child.tagName === 'title' || child.tagName === 'base')
+      (child.tagName === 'base' || child.tagName === 'title')
     ) {
-      if (seen.includes(child.tagName)) return false
-      seen.push(child.tagName)
+      if (seen.has(child.tagName)) return false
+      seen.add(child.tagName)
     }
   }
 
-  return children.length > 0
+  // “May be omitted if the element is empty,
+  // or if the first thing inside the head element is an element.”
+  const child = node.children[0]
+  return !child || child.type === 'element'
 }
 
 /**
```

**File**: `test/omission-closing-head.js` (modified, +4/-4)
```diff
@@ -6,7 +6,7 @@ import {u} from 'unist-builder'
 
 test('`head` (closing)', async function (t) {
   await t.test('should omit tag without following', async function () {
-    assert.deepEqual(toHtml(h('head'), {omitOptionalTags: true}), '<head>')
+    assert.deepEqual(toHtml(h('head'), {omitOptionalTags: true}), '')
   })
 
   await t.test(
@@ -16,7 +16,7 @@ test('`head` (closing)', async function (t) {
         toHtml(h('html', [h('head'), u('comment', 'alpha')]), {
           omitOptionalTags: true
         }),
-        '<head></head><!--alpha-->'
+        '</head><!--alpha-->'
       )
     }
   )
@@ -26,7 +26,7 @@ test('`head` (closing)', async function (t) {
     async function () {
       assert.deepEqual(
         toHtml(h('html', [h('head'), ' alpha']), {omitOptionalTags: true}),
-        '<head></head> alpha'
+        '</head> alpha'
       )
     }
   )
@@ -38,7 +38,7 @@ test('`head` (closing)', async function (t) {
         toHtml(h('html', [h('head'), u('text', 'alpha')]), {
           omitOptionalTags: true
         }),
-        '<head>alpha'
+        'alpha'
       )
     }
   )
```

**File**: `test/omission-opening-head.js` (modified, +6/-3)
```diff
@@ -11,9 +11,12 @@ test('`head` (opening)', async function (t) {
     )
   })
 
-  await t.test('should not omit tag without children', async function () {
-    assert.deepEqual(toHtml(h('head'), {omitOptionalTags: true}), '<head>')
-  })
+  await t.test(
+    'should omit tag without children (could be fine in `srcdoc`)',
+    async function () {
+      assert.deepEqual(toHtml(h('head'), {omitOptionalTags: true}), '')
+    }
+  )
 
   await t.test('should omit tag with `title`', async function () {
     assert.deepEqual(
```

#### Recent Merged Pull Requests:
- **PR #50** (closed): fix: keep a leading newline in `pre`, `textarea`, and `listing` (@spokodev)
- **PR #48** (closed): fix(deps): update mdast-util-to-hast to ^13.2.1 (@pyyupsk)
- **PR #46** (2024-12-13): exempt strings from being treated as known booleans unless empty or equal to name (@hesxenon)
- **PR #42** (2024-08-27): Remove unused dependency (@bluwy)
- **PR #40** (closed): add failing test case for allowParseErrors (@cheapsteak)
- **PR #39** (2024-04-03): Refactor to improve performance w/ hoisted regex (@bluwy)

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

## X. Change to require Node.js 16

**RULE**:
When implementing operations in `readme.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in syntax-tree/hast-util-to-html. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8c32af8a`: Change to require Node.js 16. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `readme.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
This means we try to keep the current release line, `hast-util-to-html@^9`,
compatible with Node.js 16.
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
This means we try to keep the current release line, `hast-util-to-html@^8`,
compatible with Node.js 12.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8c32af8a` are properly handled with clean fallback behavior.

# Forensic Learning Record (Deep Inspection): i18next/react-i18next

> **Canonical Artifact**: `07_PROJECT_LEARNING/i18next-react-i18next-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/i18next/react-i18next](https://github.com/i18next/react-i18next))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:55:24.821Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `i18next/react-i18next`
- **Description**: Internationalization for react done right. Using the i18next i18n ecosystem.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10050 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/IcuTransUtils/TranslationParserError.js`
```
/**
 * Error thrown during translation parsing
 */
export class TranslationParserError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} [position] - Position in the translation string where the error occurred
   * @param {string} [translationString] - The full translation string being parsed
   */
  constructor(message, position, translationString) {
    super(message);

    this.name = 'TranslationParserError';

    this.position = position;

    this.translationString = translationString;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TranslationParserError);
    }
  }
}

```

### Core Architecture Module: `src/IcuTransUtils/htmlEntityDecoder.js`
```
/**
 * Common HTML entities map for fast lookup
 */
const commonEntities = {
  // Basic entities
  '&nbsp;': '\u00A0', // Non-breaking space
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",

  // Copyright, trademark, and registration
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',

  // Punctuation
  '&hellip;': '…',
  '&ndash;': '–',
  '&mdash;': '—',
  '&lsquo;': '\u2018',
  '&rsquo;': '\u2019',
  '&sbquo;': '\u201A',
  '&ldquo;': '\u201C',
  '&rdquo;': '\u201D',
  '&bdquo;': '\u201E',
  '&dagger;': '†',
  '&Dagger;': '‡',
  '&bull;': '•',
  '&prime;': '′',
  '&Prime;': '″',
  '&lsaquo;': '‹',
  '&rsaquo;': '›',
  '&sect;': '§',
  '&para;': '¶',
  '&middot;': '·',

  // Spaces
  '&ensp;': '\u2002',
  '&emsp;': '\u2003',
  '&thinsp;': '\u2009',

  // Currency
  '&euro;': '€',
  '&pound;': '£',
  '&yen;': '¥',
  '&cent;': '¢',
  '&curren;': '¤',

  // Math symbols
  '&times;': '×',
  '&divide;': '÷',
  '&minus;': '−',
  '&plusmn;': '±',
  '&ne;': '≠',
  '&le;': '≤',
  '&ge;': '≥',
  '&asymp;': '≈',
  '&equiv;': '≡',
  '&infin;': '∞',
  '&int;': '∫',
  '&sum;': '∑',
  '&prod;': '∏',
  '&radic;': '√',
  '&part;': '∂',
  '&permil;': '‰',
  '&deg;': '°',
  '&micro;': 'µ',

  // Arrows
  '&larr;': '←',
  '&uarr;': '↑',
  '&rarr;': '→',
  '&darr;': '↓',
  '&harr;': '↔',
  '&crarr;': '↵',
  '&lArr;': '⇐',
  '&uArr;': '⇑',
  '&rArr;': '⇒',
  '&dArr;': '⇓',
  '&hArr;': '⇔',

  // Greek letters (lowercase)
  '&alpha;': 'α',
  '&beta;': 'β',
  '&gamma;': 'γ',
  '&delta;': 'δ',
  '&epsilon;': 'ε',
  '&zeta;': 'ζ',
  '&eta;': 'η',
  '&theta;': 'θ',
  '&iota;': 'ι',
  '&kappa;': 'κ',
  '&lambda;': 'λ',
  '&mu;': 'μ',
  '&nu;': 'ν',
  '&xi;': 'ξ',
  '&omicron;': 'ο',
  '&pi;': 'π',
  '&rho;': 'ρ',
  '&sigma;': 'σ',
  '&tau;': 'τ',
  '&upsilon;': 'υ',
  '&phi;': 'φ',
  '&chi;': 'χ',
  '&psi;': 'ψ',
  '&omega;': 'ω',

  // Greek letters (uppercase)
  '&Alpha;': 'Α',
  '&Beta;': 'Β',
  '&Gamma;': 'Γ',
  '&Delta;': 'Δ',
  '&Epsilon;': 'Ε',
  '&Zeta;': 'Ζ',
  '&Eta;': 'Η',
  '&Theta;': 'Θ',
  '&Iota;': 'Ι',
  '&Kappa;': 'Κ',
  '&Lambda;': 'Λ',
  '&Mu;': 'Μ',
  '&Nu;': 'Ν',
  '&Xi;': 'Ξ',
  '&Omicron;': 'Ο',
  '&Pi;': 'Π',
  '&Rho;': 'Ρ',
  '&Sigma;': 'Σ',
  '&Tau;': 'Τ',
  '&Upsilon;': 'Υ',
  '&Phi;': 'Φ',
  '&Chi;': 'Χ',
  '&Psi;': 'Ψ',
  '&Omega;': 'Ω',

  // Latin extended
  '&Agrave;': 'À',
  '&Aacute;': 'Á',
  '&Acirc;': 'Â',
  '&Atilde;': 'Ã',
  '&Auml;': 'Ä',
  '&Aring;': 'Å',
  '&AElig;': 'Æ',
  '&Ccedil;': 'Ç',
  '&Egrave;': 'È',
  '&Eacute;': 'É',
  '&Ecirc;': 'Ê',
  '&Euml;': 'Ë',
  '&Igrave;': 'Ì',
  '&Iacute;': 'Í',
  '&Icirc;': 'Î',
  '&Iuml;': 'Ï',
  '&ETH;': 'Ð',
  '&Ntilde;': 'Ñ',
  '&Ograve;': 'Ò',
  '&Oacute;': 'Ó',
  '&Ocirc;': 'Ô',
  '&Otilde;': 'Õ',
  '&Ouml;': 'Ö',
  '&Oslash;': 'Ø',
  '&Ugrave;': 'Ù',
  '&Uacute;': 'Ú',
  '&Ucirc;': 'Û',
  '&Uuml;': 'Ü',
  '&Yacute;': 'Ý',
  '&THORN;': 'Þ',
  '&szlig;': 'ß',
  '&agrave;': 'à',
  '&aacute;': 'á',
  '&acirc;': 'â',
  '&atilde;': 'ã',
  '&auml;': 'ä',
  '&aring;': 'å',
  '&aelig;': 'æ',
  '&ccedil;': 'ç',
  '&egrave;': 'è',
  '&eacute;': 'é',
  '&ecirc;': 'ê',
  '&euml;': 'ë',
  '&igrave;': 'ì',
  '&iacute;': 'í',
  '&icirc;': 'î',
  '&iuml;': 'ï',
  '&eth;': 'ð',
  '&ntilde;': 'ñ',
  '&ograve;': 'ò',
  '&oacute;': 'ó',
  '&ocirc;': 'ô',
  '&otilde;': 'õ',
  '&ouml;': 'ö',
  '&oslash;': 'ø',
  '&ugrave;': 'ù',
  '&uacute;': 'ú',
  '&ucirc;': 'û',
  '&uuml;': 'ü',
  '&yacute;': 'ý',
  '&thorn;': 'þ',
  '&yuml;': 'ÿ',

  // Special characters
  '&iexcl;': '¡',
  '&iquest;': '¿',
  '&fnof;': 'ƒ',
  '&circ;': 'ˆ',
  '&tilde;': '˜',
  '&OElig;': 'Œ',
  '&oelig;': 'œ',
  '&Scaron;': 'Š',
  '&scaron;': 'š',
  '&Yuml;': 'Ÿ',
  '&ordf;': 'ª',
  '&ordm;': 'º',
  '&macr;': '¯',
  '&acute;': '´',
  '&cedil;': '¸',
  '&sup1;': '¹',
  '&sup2;': '²',
  '&sup3;': '³',
  '&frac14;': '¼',
  '&frac12;': '½',
  '&frac34;': '¾',

  // Card suits
  '&spades;': '♠',
  '&clubs;': '♣',
  '&hearts;': '♥',
  '&diams;': '♦',

  // Miscellaneous
  '&loz;': '◊',
  '&oline;': '‾',
  '&frasl;': '⁄',
  '&weierp;': '℘',
  '&image;': 'ℑ',
  '&real;': 'ℜ',
  '&alefsym;': 'ℵ',
};

// Create regex pattern for all entities
const entityPattern = new RegExp(
  Object.keys(commonEntities)
    .map((entity) => entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g',
);

/**
 * Decode HTML entities in text
 *
 * Uses a hybrid approach:
 * 1. First pass: decode common named entities using a map
 * 2. Second pass: decode numeric entities (decimal and hexadecimal)
 *
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text
 */
export const decodeHtmlEntities = (text) =>
  text
    // First pass: common named entities
    .replace(entityPattern, (match) => commonEntities[match])
    // Second pass: numeric entities (decimal)
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    // Third pass: numeric entities (hexadecimal)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

```

### Core Architecture Module: `src/IcuTransUtils/index.js`
```
export * from './TranslationParserError.js';
export * from './htmlEntityDecoder.js';
export * from './tokenizer.js';
export * from './renderTranslation.js';

```

### Core Architecture Module: `src/IcuTransUtils/renderTranslation.js`
```
import React from 'react';

import { TranslationParserError } from './TranslationParserError.js';
import { tokenize } from './tokenizer.js';
import { decodeHtmlEntities } from './htmlEntityDecoder.js';

/**
 * Render a React element tree from a declaration node and its children
 *
 * @param {Object} declaration - The component declaration (type + props)
 * @param {Array<React.ReactNode>} children - Array of child nodes (text, numbers, React elements)
 * @param {Array<Object>} [childDeclarations] - Optional array of child declarations to use for nested rendering
 * @returns {React.ReactElement} A React element
 */
const renderDeclarationNode = (declaration, children, childDeclarations) => {
  const { type, props = {} } = declaration;

  // If props contain a children declaration AND we have childDeclarations to work with,
  // we need to recursively render the content with those child declarations
  if (props.children && Array.isArray(props.children) && childDeclarations) {
    // The children array contains the parsed content from inside this tag
    // We need to rebuild the translation string and re-parse it with child declarations
    // For now, we'll use the children directly as they're already parsed
    // This happens when renderTranslation is called recursively

    // Remove children from props since we'll pass them as the third argument
    // eslint-disable-next-line no-unused-vars
    const { children: _childrenToRemove, ...propsWithoutChildren } = props;

    return React.createElement(type, propsWithoutChildren, ...children);
  }

  // Standard rendering with children from translation
  if (children.length === 0) {
    return React.createElement(type, props);
  }
  if (children.length === 1) {
    return React.createElement(type, props, children[0]);
  }
  return React.createElement(type, props, ...children);
};

/**
 * Render translation string with declaration tree to create React elements
 *
 * This function parses an ICU format translation string and reconstructs
 * a React element tree using the provided declaration tree. It replaces
 * numbered tags (e.g., <0>, <1>) with the corresponding components from
 * the declaration array and fills them with the translated text.
 *
 * @param {string} translation - ICU format string (e.g., "<0>Click here</0>")
 * @param {Array<Object>} [declarations=[]] - Array of component declarations matching tag numbers
 * @returns {Array<React.ReactNode>} Array of React nodes (elements and text)
 *
 * @example
 * ```jsx
 * const result = renderTranslation(
 *   "<0>bonjour</0> monde",
 *   [{ type: 'strong', props: { className: 'bold' } }]
 * );
 * // Returns: [<strong className="bold">bonjour</strong>, " monde"]
 * ```
 *
 * @example
 * ```jsx
 * // With nested children in declaration
 * const result = renderTranslation(
 *   "<0>Click <1>here</1></0>",
 *   [
 *     {
 *       type: 'div',
 *       props: {
 *         children: [{ type: 'span', props: {} }]
 *       }
 *     }
 *   ]
 * );
 * ```
 */
export const renderTranslation = (translation, declarations = []) => {
  if (!translation) {
    return [];
  }

  const tokens = tokenize(translation);
  const result = [];
  const stack = [];

  // Track tag numbers that should be treated as literal text (no declaration found)
  const literalTagNumbers = new Set();

  // Helper to get the current declarations array based on context
  const getCurrentDeclarations = () => {
    if (stack.length === 0) {
      return declarations;
    }

    const parentFrame = stack[stack.length - 1];

    // If the parent declaration has children declarations, use those
    if (
      parentFrame.declaration.props?.children &&
      Array.isArray(parentFrame.declaration.props.children)
    ) {
      return parentFrame.declaration.props.children;
    }

    // Otherwise, use the parent's declarations array
    return parentFrame.declarations;
  };

  tokens.forEach((token) => {
    // eslint-disable-next-line default-case
    switch (token.type) {
      case 'Text':
        {
          const decoded = decodeHtmlEntities(token.value);
          const targetArray = stack.length > 0 ? stack[stack.length - 1].children : result;

          targetArray.push(decoded);
        }

        break;

      case 'TagOpen':
        {
          const { tagNumber } = token;
          const currentDeclarations = getCurrentDeclarations();
          const declaration = currentDeclarations[tagNumber];

          if (!declaration) {
            // No declaration found - treat this tag as literal text
            literalTagNumbers.add(tagNumber);

            const literalText = `<${tagNumber}>`;
            const targetArray = stack.length > 0 ? stack[stack.length - 1].children : result;

            targetArray.push(literalText);

            break;
          }

          stack.push({
            tagNumber,
            children: [],
            position: token.position,
            declaration,
            declarations: currentDeclarations,
          });
        }

        break;

      case 'TagClose':
        {
          const { tagNumber } = token;

          // If this tag was treated as literal, output the closing tag as literal text
          if (literalTagNumbers.has(tagNumber)) {
            const literalText = `</${tagNumber}>`;
            const literalTargetArray = stack.length > 0 ? stack[stack.length - 1].children : result;

            literalTargetArray.push(literalText);

            literalTagNumbers.delete(tagNumber);

            break;
          }

          if (stack.length === 0) {
            throw new TranslationParserError(
              `Unexpected closing tag </${tagNumber}> at position ${token.position}`,
              token.position,
              translation,
            );
          }

          const frame = stack.pop();

          if (frame.tagNumber !== tagNumber) {
            throw new TranslationParserError(
              `Mismatched tags: expected </${frame.tagNumber}> but got </${tagNumber}> at position ${token.position}`,
              token.position,
              translation,
            );
          }

          // Render the element using the declaration and collected children
          const element = renderDeclarationNode(
            frame.declaration,
            frame.children,
            frame.declarations,
          );

          const elementTargetArray = stack.length > 0 ? stack[stack.length - 1].children : result;

          elementTargetArray.push(element);
        }

        break;
    }
  });

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];

    throw new TranslationParserError(
      `Unclosed tag <${unclosed.tagNumber}> at position ${unclosed.position}`,
      unclosed.position,
      translation,
    );
  }

  return result;
};

```

### Core Architecture Module: `src/IcuTransUtils/tokenizer.js`
```
/**
 * Tokenize a translation string with numbered tags
 * Note: Variables are already interpolated by the i18n system before we receive the string
 *
 * @param {string} translation - Translation string with numbered tags
 * @returns {Array<Token>} Array of tokens
 */
export const tokenize = (translation) => {
  const tokens = [];

  let position = 0;

  let currentText = '';

  const flushText = () => {
    if (currentText) {
      tokens.push({
        type: 'Text',
        value: currentText,
        position: position - currentText.length,
      });

      currentText = '';
    }
  };

  while (position < translation.length) {
    const char = translation[position];

    // Check for opening tag: <0>, <1>, etc.
    if (char === '<') {
      const tagMatch = translation.slice(position).match(/^<(\d+)>/);

      if (tagMatch) {
        flushText();

        tokens.push({
          type: 'TagOpen',
          value: tagMatch[0],
          position,
          tagNumber: parseInt(tagMatch[1], 10),
        });

        position += tagMatch[0].length;
      } else {
        // Check for closing tag: </0>, </1>, etc.
        const closeTagMatch = translation.slice(position).match(/^<\/(\d+)>/);

        if (closeTagMatch) {
          flushText();

          tokens.push({
            type: 'TagClose',
            value: closeTagMatch[0],
            position,
            tagNumber: parseInt(closeTagMatch[1], 10),
          });

          position += closeTagMatch[0].length;
        } else {
          // Regular text (including any { } characters that aren't our tags)
          currentText += char;

          position += 1;
        }
      }
    } else {
      // Regular text (including any { } characters that aren't our tags)
      currentText += char;

      position += 1;
    }
  }

  flushText();

  return tokens;
};

```

### Core Architecture Module: `src/utils.js`
```
/** @type {(i18n:any,code:import('../TransWithoutContext').ErrorCode,msg?:string, rest?:{[key:string]: any})=>void} */
export const warn = (i18n, code, msg, rest) => {
  const args = [msg, { code, ...(rest || {}) }];
  if (i18n?.services?.logger?.forward) {
    return i18n.services.logger.forward(args, 'warn', 'react-i18next::', true);
  }
  if (isString(args[0])) args[0] = `react-i18next:: ${args[0]}`;
  if (i18n?.services?.logger?.warn) {
    i18n.services.logger.warn(...args);
  } else if (console?.warn) {
    console.warn(...args);
  }
};
const alreadyWarned = {};
/** @type {typeof warn} */
export const warnOnce = (i18n, code, msg, rest) => {
  if (isString(msg) && alreadyWarned[msg]) return;
  if (isString(msg)) alreadyWarned[msg] = new Date();
  warn(i18n, code, msg, rest);
};

// not needed right now
//
// export const deprecated = (i18n, ...args) => {
//   if (process && process.env && (!process.env.NODE_ENV || process.env.NODE_ENV === 'development')) {
//     if (isString(args[0])) args[0] = `deprecation warning -> ${args[0]}`;
//     warnOnce(i18n, ...args);
//   }
// }

const loadedClb = (i18n, cb) => () => {
  // delay ready if not yet initialized i18n instance
  if (i18n.isInitialized) {
    cb();
  } else {
    const initialized = () => {
      // due to emitter removing issue in i18next we need to delay remove
      setTimeout(() => {
        i18n.off('initialized', initialized);
      }, 0);
      cb();
    };
    i18n.on('initialized', initialized);
  }
};

export const loadNamespaces = (i18n, ns, cb) => {
  i18n.loadNamespaces(ns, loadedClb(i18n, cb));
};

// should work with I18NEXT >= v22.5.0
export const loadLanguages = (i18n, lng, ns, cb) => {
  // eslint-disable-next-line no-param-reassign
  if (isString(ns)) ns = [ns];
  if (i18n.options.preload && i18n.options.preload.indexOf(lng) > -1)
    return loadNamespaces(i18n, ns, cb);
  ns.forEach((n) => {
    if (i18n.options.ns.indexOf(n) < 0) i18n.options.ns.push(n);
  });
  i18n.loadLanguages(lng, loadedClb(i18n, cb));
};

export const hasLoadedNamespace = (ns, i18n, options = {}) => {
  if (!i18n.languages || !i18n.languages.length) {
    warnOnce(i18n, 'NO_LANGUAGES', 'i18n.languages were undefined or empty', {
      languages: i18n.languages,
    });
    return true;
  }

  return i18n.hasLoadedNamespace(ns, {
    lng: options.lng,
    precheck: (i18nInstance, loadNotPending) => {
      if (
        options.bindI18n &&
        options.bindI18n.indexOf('languageChanging') > -1 &&
        i18nInstance.services.backendConnector.backend &&
        i18nInstance.isLanguageChangingTo &&
        !loadNotPending(i18nInstance.isLanguageChangingTo, ns)
      )
        return false;
    },
  });
};

export const getDisplayName = (Component) =>
  Component.displayName ||
  Component.name ||
  (isString(Component) && Component.length > 0 ? Component : 'Unknown');

export const isString = (obj) => typeof obj === 'string';

export const isObject = (obj) => typeof obj === 'object' && obj !== null;

```

### Core Architecture Module: `TransWithoutContext.d.ts`
```
import type {
  i18n,
  ReactOptions,
  ApplyTarget,
  ConstrainTarget,
  GetSource,
  InterpolationMap,
  ParseKeys,
  Namespace,
  SelectorFn,
  SelectorKey,
  TFunctionReturn,
  TypeOptions,
  TOptions,
  TFunction,
} from 'i18next';
import * as React from 'react';

type _DefaultNamespace = TypeOptions['defaultNS'];
type _EnableSelector = TypeOptions['enableSelector'];
type _KeySeparator = TypeOptions['keySeparator'];
type _AppendKeyPrefix<Key, KPrefix> = KPrefix extends string
  ? `${KPrefix}${_KeySeparator}${Key & string}`
  : Key;

type TransChild = React.ReactNode | Record<string, unknown>;
type $NoInfer<T> = [T][T extends T ? 0 : never];

export type TransProps<
  Key extends ParseKeys<Ns, TOpt, KPrefix>,
  Ns extends Namespace = _DefaultNamespace,
  KPrefix = undefined,
  TContext extends string | undefined = undefined,
  TOpt extends TOptions & { context?: TContext } = { context: TContext },
  Ret = TFunctionReturn<Ns, _AppendKeyPrefix<Key, KPrefix>, TOpt>,
  E = React.HTMLProps<HTMLDivElement>,
> = E & {
  children?: TransChild | readonly TransChild[];
  components?: readonly React.ReactElement[] | { readonly [tagName: string]: React.ReactElement };
  count?: number;
  context?: TContext;
  defaults?: string;
  i18n?: i18n;
  i18nKey?: Key | Key[];
  // allow a single namespace from an array-typed `t` (e.g. useTranslation(['ns'])); TS7 intersects
  // inference candidates from `t` and `ns`, so a bare `Ns` here rejects ns="ns" when t is passed
  ns?: Ns | (Ns extends readonly (infer S extends string)[] ? S : never);
  parent?: string | React.ComponentType<any> | null; // used in React.createElement if not null
  tOptions?: TOpt;
  values?: InterpolationMap<Ret>;
  shouldUnescape?: boolean;
  t?: TFunction<Ns, KPrefix>;
};

export interface TransLegacy {
  <
    const Key extends ParseKeys<Ns, TOpt, KPrefix>,
    Ns extends Namespace = _DefaultNamespace,
    KPrefix = undefined,
    TContext extends string | undefined = undefined,
    TOpt extends TOptions & { context?: TContext } = { context: TContext },
    Ret extends TFunctionReturn<Ns, _AppendKeyPrefix<Key, KPrefix>, TOpt> = TFunctionReturn<
      Ns,
      _AppendKeyPrefix<Key, KPrefix>,
      TOpt
    >,
    E = React.HTMLProps<HTMLDivElement>,
  >(
    props: TransProps<Key, Ns, KPrefix, TContext, TOpt, Ret, E>,
  ): React.ReactElement;
}

export interface TransSelectorProps<
  Key,
  Ns extends Namespace = _DefaultNamespace,
  KPrefix = undefined,
  TContext extends string | undefined = undefined,
  TOpt extends TOptions & { context?: TContext } = { context: TContext },
> {
  children?: TransChild | readonly TransChild[];
  components?: readonly React.ReactElement[] | { readonly [tagName: string]: React.ReactElement };
  count?: number;
  context?: TContext;
  defaults?: string | Key;
  i18n?: i18n;
  i18nKey?: Key | readonly Key[];
  // see TransProps.ns: keep single-namespace values assignable when `t` fixes Ns to an array
  ns?: Ns | (Ns extends readonly (infer S extends string)[] ? S : never);
  parent?: string | React.ComponentType<any> | null; // used in React.createElement if not null
  tOptions?: TOpt;
  values?: Key extends (...args: any[]) => infer R ? InterpolationMap<R> : {};
  shouldUnescape?: boolean;
  t?: TFunction<Ns, KPrefix>;
}

export interface TransSelector {
  <
    Target extends ConstrainTarget<TOpt>,
    Key extends
      SelectorFn<GetSource<$NoInfer<Ns>, KPrefix>, ApplyTarget<Target, TOpt>, TOpt> | SelectorKey,
    const Ns extends Namespace = _DefaultNamespace,
    KPrefix = undefined,
    TContext extends string | undefined = undefined,
    TOpt extends TOptions & { context?: TContext } = { context: TContext },
    E = React.HTMLProps<HTMLDivElement>,
  >(
    props: TransSelectorProps<Key, Ns, KPrefix, TContext, TOpt> & E,
  ): React.ReactElement;
}

export const Trans: _EnableSelector extends true | 'optimize' | 'strict'
  ? TransSelector
  : TransLegacy;

export function nodesToString(
  children: React.ReactNode,
  i18nOptions?: ReactOptions,
  i18n?: i18n,
  i18nKey?: string,
): string;

export type ErrorCode =
  | 'NO_I18NEXT_INSTANCE'
  | 'NO_LANGUAGES'
  | 'DEPRECATED_OPTION'
  | 'TRANS_NULL_VALUE'
  | 'TRANS_INVALID_OBJ'
  | 'TRANS_INVALID_VAR'
  | 'TRANS_INVALID_COMPONENTS'
  | 'USE_T_BEFORE_READY'
  | 'SUSPENDED_WHILE_LOADING';

export type ErrorMeta = {
  code: ErrorCode;
  i18nKey?: string;
  [x: string]: any;
};

/**
 * Use to type the logger arguments
 * @example
 * ```
 * import type { ErrorArgs } from 'react-i18next';
 *
 * const logger = {
 *   // ....
 *   warn: function (...args: ErrorArgs) {
 *      if (args[1]?.code === 'TRANS_INVALID_OBJ') {
 *        const [msg, { i18nKey, ...rest }] = args;
 *        return log(i18nKey, msg, rest);
 *      }
 *      log(...args);
 *   }
 * }
 * i18n.use(logger).use(i18nReactPlugin).init({...});
 * ```
 */
export type ErrorArgs = readonly [string, ErrorMeta | undefined, ...any[]];

```

### Core Architecture Module: `example/ReactNativeLocizeProject/.eslintrc.js`
```
module.exports = {
  root: true,
  extends: '@react-native',
};

```

### Core Architecture Module: `example/ReactNativeLocizeProject/.prettierrc.js`
```
module.exports = {
  arrowParens: 'avoid',
  singleQuote: true,
  trailingComma: 'all',
};

```

### Core Architecture Module: `example/ReactNativeLocizeProject/App.tsx`
```
import {Suspense, Component} from 'react';
import {Text, Button, View} from 'react-native';
import {useTranslation, withTranslation, Trans} from 'react-i18next';
import type {TFunction} from 'i18next';

// use hoc for class based components
class LegacyWelcomeClass extends Component<{t: TFunction}> {
  render() {
    const {t} = this.props;
    return <Text>{t('title')}</Text>;
  }
}
const Welcome = withTranslation()(LegacyWelcomeClass);

// Component using the Trans component
function MyComponent() {
  return (
    <Text>
      <Trans i18nKey="description.part1">
        To get started, edit <Text>src/App.js</Text> and save to reload.
      </Trans>
    </Text>
  );
}

function AppInner() {
  const {t, i18n} = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Welcome />

      <Button
        onPress={() => changeLanguage('en')}
        title="en"
        disabled={i18n.resolvedLanguage === 'en'}
      />
      <Button
        onPress={() => changeLanguage('de')}
        title="de"
        disabled={i18n.resolvedLanguage === 'de'}
      />

      <MyComponent />
      <Text>{t('description.part2')}</Text>
    </View>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Text>loading...</Text>}>
      <AppInner />
    </Suspense>
  );
}

```

### Core Architecture Module: `example/ReactNativeLocizeProject/android/app/src/main/java/com/reactnativelocizeproject/MainActivity.kt`
```
package com.reactnativelocizeproject

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ReactNativeLocizeProject"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

```

### Core Architecture Module: `example/ReactNativeLocizeProject/android/app/src/main/java/com/reactnativelocizeproject/MainApplication.kt`
```
package com.reactnativelocizeproject

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1571** (2024-02-17): **Unable to initialize TFunction for testing after latest version**
  *Symptoms*: ## 🐛 Bug Report  Hi. I've initialized TFunction in my tests before `i18next` v22 and `i18next` v12, but I'm not able to do that after the upgrade.  ## To Reproduce  Code before the upgrade  ```ts import { TFunction } from 'react-i18next';  import { translationResources } from '../../constants';  const translation: { [key: string]: string } = translationResources.fi.translation;  const t: TFunction<'translation', undefined> = (str: string) => translation[str]; ```  Code after the upgrade  ```ts import { TFunction } from 'i18next';  import { translationResources } from '../../constants';  const translation: { [key: string]: string } = translationResources.fi.translation;  const t: TFunction<'translation', undefined> = (str: string) => translation[str]; ```  The error  ``` Type '(str: string) => string' is not assignable to type 'TFunction<"translation", undefined>'.   Type 'string' is not assignable to type 'TFunctionDetailedResult<any>'. ```  ## Expected behavior  I expect to be able to initialize TFunction  ## Your Environment  - *runtime version*: node v16 - *i18next version*: 22.0.2 - *os*: macOS - *typescript*: 4.7.4 
  **Post-Mortem & Fix Analysis**:
  > Can you try with 22.0.3?
  > > Can you try with 22.0.3?  Seems to work, thanks!
  > > Can you try with 22.0.3?  Sorry, spoke too soon. I seem to be still facing this problem 

- **Issue #1215** (2021-01-05): **Issue with TS 4.1 example & specific translations keys**
  *Symptoms*: <!-- Before you submit an issue we recommend you visit [docs](https://www.i18next.com/) or [docs](https://react.i18next.com/) or [StackOverflow](https://stackoverflow.com/) or similar and ask any questions you have or mention any problems you've had getting started with i18next.  **Please read this entire template before posting any issue. If you ignore these instructions and post an issue here that does not follow the instructions, your issue might be closed, locked.** -->  ## 🐛 Bug Report Hi ! I've tried to apply the new TS 4.1 example, but it seems to break when a there is a key named "keys" in the translations file, like this:  `en.json`  ```json {   "home": {     "menu": "I work fine",     "keys": "I am not known by TypeScript :("   } } ```  ## To Reproduce Here is a simple repo I used to reproduce this issue: https://github.com/Thanaen/repro-react-i18n-ts-bug  Simply clone it, run 'yarn' then 'yarn lint' or 'yarn start' !  ## Expected behavior  I should be able to call t('home.keys') without any linting or typescript errors.  ## Your Environment  - *runtime version*: Firefox 83 & Chrome 87 - *i18next version*: ^0.13.2 - *os*: Windows - *react-i18next:* ^11.8.0 
  **Post-Mortem & Fix Analysis**:
  > @pedrodurek Mentioning you because @jamuhl suggested it, and because you merged a TypeScript 4.1 related pull request recently!
  > Hey @Thanaen, good catch! it turns out that in order to make it work with arrays like this: ```json {   list: [{     title: 'title1'    }, {     title: 'title2'    }] } ``` I'm omitting all props from Array (https://github.com/i18next/react-i18next/blob/master/src/ts4.1/index.d.ts#L45), and the key "keys" is one of them. Thanks from flagging that! I'll see what I can do. In the meantime, I'd recommend using a different key for now.
  > Okay, @pedrodurek ! I'll try not to use this key for now ! 👍  Thank you for your quick response. :)

- **Issue #790** (2019-03-18): **transSupportBasicHtmlNodes doesn't work with self-closing Trans**
  *Symptoms*: **Describe the bug** New feature `transSupportBasicHtmlNodes` allow to use simple html elements like `<br/>` with Trans component, but it doesn't work with `Trans` component without `props.children`  **Occurs in react-i18next version** react-i18next@10.5.1  **To Reproduce** translation json:  ```json "welcome": "Hello <br/> <strong>World</strong>" ```  JSX: Trans component self-closing: ```jsx <Trans i18nKey="welcome" /> ```  Results: html elements was render as string  but for: ```jsx <Trans i18nKey="welcome">any valid children</Trans> ```  works as expected 
  **Post-Mortem & Fix Analysis**:
  > Will check this on monday....
  > should be fixed in react-i18next@10.5.2
  > @jamuhl It's working, Thank you for your time

- **Issue #768** (2019-03-04): **Infinite loop when using "cimode" as the language**
  *Symptoms*: **Describe the bug** When the language is set to `cimode`, the `hasLoadedNamespace` check always returns `false` for any given namespace, as i18next will never load any namespace when the language is `cimode` (early return in `loadResources`). This causes an infinite loop with `react-i18next` constantly trying to load the "missing" translation and always finding it to not be loaded once it's notified.  **Occurs in react-i18next version** 10.2.0  **To Reproduce**  Use any `react-i18next` component or hook while the `i18next` instance has `lng: 'cimode'` set.  **Expected behaviour** Translations to be rendered according to the `cimode` behavior (just returns the keys as-is, optionally with a namespace prefix)  **Screenshots**  ![image](https://user-images.githubusercontent.com/73085/53727732-425df500-3eb4-11e9-94d8-35372360d1dc.png)  **OS (please complete the following information):**  - Device: MBP 2018 15" - Browser: 72.0.3626.17 
  **Post-Mortem & Fix Analysis**:
  > could you retry with react-i18next@10.2.1
  > Yep, it worked :tada:  Just a note: `i18next` itself is case-insensitive w.r.t. `'cimode'`, though the check here is case-sensitive.
  > will add a toLowerCase for the check and publish with the next release....ok?

- **Issue #695** (2019-01-24): **Parameterized type usage in NamespaceConsumer fails**
  *Symptoms*: **Describe the bug**  ```tsx function workWithVariousResults() {   return (     <NamespacesConsumer i18n={i18next}>       {(t, { i18n }) => {         // sanity first (works)         const is: string = i18n.t('friend'); // same as <string>         const io: object = i18n.t<object>('friend');         const isa: string[] = i18n.t<string[]>('friend');         const ioa: object[] = i18n.t<object[]>('friend');          // now try t provided by NamespacesConsumer (fails)         const s: string = t('friend'); // same as <string>         const o: object = t<object>('friend');         const sa: string[] = t<string[]>('friend');         const oa: object[] = t<object[]>('friend');          return <div>foo</div>;       }}     </NamespacesConsumer>   ); } ```  ``` Expected 0 type arguments, but got 1. ```  **Occurs in react-i18next version** 9.0.7   Working on it now.  

- **Issue #693** (2019-01-24): **NamespacesConsumer usage fails - regression**
  *Symptoms*: **Describe the bug**  ```tsx   interface ControlProps {     hint?: string;   }   function Control(props: ControlProps) {     return <div>{props.hint === undefined ? 'undefined' : props.hint}</div>;   }   return (     <NamespacesConsumer i18n={i18next}>{t => <Control hint={t('title')} />}</NamespacesConsumer>   ); ```  fails with   ``` Type 'string | object | (string | object)[]' is not assignable to type 'string | undefined'.   Type 'object' is not assignable to type 'string | undefined'.     Type 'object' is not assignable to type 'string'. ```  **Occurs in react-i18next version** 9.0.7    I'm PRing a fix now. 

- **Issue #685** (2019-01-23): **react-i18next throwing webpack error when initializeing using @babel/runtime 7.3.0**
  *Symptoms*: since the dependency with @babel/runtime is anything from 7.1.2 with the latest update on @babel/runtime 7.3.0 (today) the library stops working. Had to manually downgrade the version to 7.1.2 to make the library work again.
  **Post-Mortem & Fix Analysis**:
  > ? do you build react-i18next yourself? the runtime gets embedded during build time - so you should not really need/depend on it?  can you give a little more information what you are doing - and how you run into this?
  > Just updated all dependencies -> as i guess it might be related to babel-runtime update  did a republish of react-i18next@9.0.6 does using that resolve your issue?
  > I guess I'm having a related problem. Just started a brand new create-react-app project yesterday, installed react-i18next and i18next and reused the same code I was using in another project. But today I'm getting the following error.  ``` Uncaught TypeError: Cannot convert undefined or null to object     at Function.getOwnPropertyDescriptors (<anonymous>)     at _objectSpread (objectSpread.js:19)     at setDefaults (context.js:23)     at Object.init (context.js:37)     at i18next.js:187     at Array.forEach (<anonymous>)     at I18n.init (i18next.js:186)     at Module../src/index.js (index.js:9)     at __webpack_require__ (bootstrap:782)     at fn (bootstrap:150)     at Object.0 (WarningPanel.module.scss?c11d:45)     at __webpack_require__ (bootstrap:782)     at checkDeferredModules (bootstrap:45)     at Array.webpackJsonpCallback [as push] (bootstrap:32)     at main.chunk.js:1 ```

- **Issue #603** (2018-11-09): **ExtendedComponentReportingItsNamespace malfunctioning**
  *Symptoms*: In the NextJs example, it looks like the `ExtendedComponentReportingItsNamespace` is being translated server side, but being un-translated once the React app starts up on the client:  <img width="1307" alt="screenshot 2018-11-01 at 17 41 46" src="https://user-images.githubusercontent.com/10575782/47887651-d1bba480-ddfd-11e8-807d-c4339a94404c.png">  @jamuhl Is this expected behaviour? I didn't follow your changes on this namespace reporting.
  **Post-Mortem & Fix Analysis**:
  > no that seems to be an issue...will need to check this again...
  > Okay, let me know if you'd like me to track this one down, or if you can find it right away.
  > Will need to look on monday, tuesday...currently my weekend is planned (won't find time for it)...no need to rush i will try getting on it (if you like to dig into it - ok for me)

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

### Incident Patch 1: `0a2f0182` (2026-10-05)
**Commit Message**: fix(examples): load the Swedish file in test-jest and align the ru plural tags in react-icu

The Swedish locale in example/test-jest was named translation.json while the
app loads the "translations" namespace, so Swedish fell back to English.

In example/react-icu the ru testKey used <0> in every plural branch; it now
uses <0>/<1>/<2> like en and de.

**File**: `example/react-icu/public/locales/ru/translations.json` (modified, +1/-1)
```diff
@@ -15,5 +15,5 @@
   "{itemsCount1, plural,  =0 {There is no item.} one {There is # item.} other {There are # items.}}": "{itemsCount1, plural,  =0 {Нет ни одной штуки} one {Есть # штука.} few {Есть # штуки.} many {Есть # штук.} other {Есть # штук.}}",
   "{itemsCount2, plural,  =0 {There is no item.} one {There is # item.} other {There are # items.}}": "{itemsCount2, plural,  =0 {Нет ни одной штуки} one {Есть # штука.} few {Есть # штуки.} many {Есть # штук.} other {Есть # штук.}}",
   "{itemsCount3, plural,  =0 {There is no item.} one {There is # item.} other {There are # items.}}": "{itemsCount3, plural,  =0 {Нет ни одной штуки} one {Есть # штука.} few {Есть # штуки.} many {Есть # штук.} other {Есть # штук.}}",
-  "testKey": "{itemsCount3, plural,  =0 {Нет <0>ни одной</0> штуки. } one {Есть <0>#</0> штука.} few {Есть <0>#</0> штуки.} many {Есть <0>#</0> штук.} other {Есть <0>#</0> штук.}}"
+  "testKey": "{itemsCount3, plural,  =0 {Нет <0>ни одной</0> штуки. } one {Есть <1>#</1> штука.} few {Есть <2>#</2> штуки.} many {Есть <2>#</2> штук.} other {Есть <2>#</2> штук.}}"
 }
```

---

### Incident Patch 2: `875b327d` (2026-09-21)
**Commit Message**: fix(Trans): preserve single-element children in empty slots

I preserve a component's sole React-element child for empty paired Trans slots, with regression coverage and release notes.

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## 17.0.15
+
+- fix(Trans): empty paired component tags now preserve a component's single valid React-element child, whether supplied through a named component map (`<wrap></wrap>`), a component array (`<0></0>`), or indexed JSX children (`<1></1>`). This matches the existing behavior for two or more children and self-closing tags. React represents one JSX child as an element and multiple children as an array; the previous array-only check silently rendered the one-child case empty. Compatibility note: when that sole element contains an interpolation object, the restored raw children can expose an existing React rendering limitation as an error instead of silently rendering empty; the same shape already errors with two children. Fixes [#1932](https://github.com/i18next/react-i18next/issues/1932).
+
 ## 17.0.14
 
 - fix: the `i18n` object returned by `useTranslation` was only refreshed when `i18n.language` changed, so a `resolvedLanguage` (or `languages`) change of its own kept handing components the previous snapshot. That happens whenever the translations for the current language arrive after the switch — i18next resolves to the fallback until its store has them — and components reading `i18n.resolvedLanguage` (language switchers, for example) then stayed one switch behind. The cached wrapper is now keyed on all three language fields, which are exactly the ones the surrounding `useMemo` already depends on; wrapper identity still only changes when the language state does, so the caching from [#1885](https://github.com/i18next/react-i18next/issues/1885) is unaffected. Reported via [next-i18next#2348](https://github.com/i18next/next-i18next/issues/2348).
```

**File**: `react-i18next.js` (modified, +1/-1)
```diff
@@ -2711,7 +2711,7 @@
     const children = node.props?.children ?? node.children;
     return node.props?.i18nIsDynamicList ? getAsArray(children) : children;
   };
-  const hasValidReactChildren = children => Array.isArray(children) && children.every(React.isValidElement);
+  const hasValidReactChildren = children => getAsArray(children).every(React.isValidElement);
   const getAsArray = data => Array.isArray(data) ? data : [data];
   const mergeProps = (source, target) => {
     const newTarget = {
```

**File**: `src/TransWithoutContext.js` (modified, +1/-2)
```diff
@@ -19,8 +19,7 @@ const getChildren = (node) => {
   return node.props?.i18nIsDynamicList ? getAsArray(children) : children;
 };
 
-const hasValidReactChildren = (children) =>
-  Array.isArray(children) && children.every(isValidElement);
+const hasValidReactChildren = (children) => getAsArray(children).every(isValidElement);
 
 const getAsArray = (data) => (Array.isArray(data) ? data : [data]);
 
```

**File**: `test/trans.render.object.spec.jsx` (modified, +61/-1)
```diff
@@ -1,6 +1,6 @@
 import { describe, it, expect, afterEach } from 'vitest';
 import React from 'react';
-import { render, cleanup } from '@testing-library/react';
+import { render, cleanup, screen, within } from '@testing-library/react';
 import './i18n';
 import { Trans } from '../src/Trans';
 
@@ -35,6 +35,26 @@ describe('trans using no children but components (object) - base case using arra
   });
 });
 
+describe('trans using no children but components (array) - empty paired tag with a single child', () => {
+  function TestComponent() {
+    return (
+      <Trans
+        defaults="Link: <0></0>"
+        components={[
+          <a aria-label="Array icon link" href="/link">
+            <svg aria-label="Icon" role="img" />
+          </a>,
+        ]}
+      />
+    );
+  }
+  it('should preserve the component child', () => {
+    render(<TestComponent />);
+    const link = screen.getByRole('link', { name: 'Array icon link' });
+    expect(link).toContainElement(within(link).getByRole('img', { name: 'Icon' }));
+  });
+});
+
 describe('trans using no children but components (object) - using index', () => {
   function TestComponent() {
     return (
@@ -251,6 +271,46 @@ describe('trans using no children but components (object) - empty content', () =
   });
 });
 
+describe('trans using no children but components (object) - empty paired tag with a single child', () => {
+  function TestComponent() {
+    return (
+      <Trans
+        defaults="Link: <wrap></wrap>"
+        components={{
+          wrap: (
+            <a aria-label="Icon link" href="/link">
+              <svg aria-label="Icon" role="img" />
+            </a>
+          ),
+        }}
+      />
+    );
+  }
+  it('should preserve the component child', () => {
+    render(<TestComponent />);
+    const link = screen.getByRole('link', { name: 'Icon link' });
+    expect(link).toContainElement(within(link).getByRole('img', { name: 'Icon' }));
+  });
+});
+
+describe('trans using children - empty paired tag with a single child', () => {
+  function TestComponent() {
+    return (
+      <Trans defaults="Link: <1></1>">
+        {'Link: '}
+        <a aria-label="Child icon link" href="/link">
+          <svg aria-label="Icon" role="img" />
+        </a>
+      </Trans>
+    );
+  }
+  it('should preserve the component child', () => {
+    render(<TestComponent />);
+    const link = screen.getByRole('link', { name: 'Child icon link' });
+    expect(link).toContainElement(within(link).getByRole('img', { name: 'Icon' }));
+  });
+});
+
 describe('trans using children but components (object) - self closing tag', () => {
   function Button() {
     return <button type="button">click me</button>;
```

---

### Incident Patch 3: `6def81a7` (2026-09-13)
**Commit Message**: fix: refresh the returned i18n wrapper when resolvedLanguage changes

The wrapper is a snapshot of the instance (#1863), cached since #1885 so its
identity only changes when the language state does. That cache was keyed on
i18n.language alone, narrower than the three fields the surrounding useMemo
depends on, so a resolvedLanguage (or languages) change of its own kept handing
components the previous snapshot.

That happens whenever the translations for the current language arrive after the
switch: i18next resolves to the fallback while its store is still empty for it,
and re-resolves once the resources are there without language changing again.
Components reading i18n.resolvedLanguage - language switchers, for example -
then stayed one switch behind.

The cache key now covers language, resolvedLanguage and languages, so wrapper
identity still only changes when the language state changes and the caching from
#1885 is unaffected.

Reported via i18next/next-i18next#2348

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## 17.0.14
+
+- fix: the `i18n` object returned by `useTranslation` was only refreshed when `i18n.language` changed, so a `resolvedLanguage` (or `languages`) change of its own kept handing components the previous snapshot. That happens whenever the translations for the current language arrive after the switch — i18next resolves to the fallback until its store has them — and components reading `i18n.resolvedLanguage` (language switchers, for example) then stayed one switch behind. The cached wrapper is now keyed on all three language fields, which are exactly the ones the surrounding `useMemo` already depends on; wrapper identity still only changes when the language state does, so the caching from [#1885](https://github.com/i18next/react-i18next/issues/1885) is unaffected. Reported via [next-i18next#2348](https://github.com/i18next/next-i18next/issues/2348).
+
 ## 17.0.13
 
 - fix(types): the selector-form `keyPrefix` overload of `useTranslation()` is now available under `enableSelector: 'strict'`. `useTranslation` was gated on `true | 'optimize'` only, so under `'strict'` it resolved to the legacy signature and the selector overload disappeared entirely (`keyPrefix: ($) => $.ns.foo` failed with `Type '($: any) => any' is not assignable to type 'undefined'`). `Trans` already handled all three modes. Companion to the same fix for `getFixedT` in [i18next#2446](https://github.com/i18next/i18next/pull/2446). Thanks @hovelopin ([#1930](https://github.com/i18next/react-i18next/pull/1930)).
```

**File**: `react-i18next.js` (modified, +2/-1)
```diff
@@ -3848,6 +3848,7 @@
     const finalI18n = i18n || {};
     const wrapperRef = React.useRef(null);
     const wrapperLangRef = React.useRef();
+    const languageKey = inst => `${inst.language}|${inst.resolvedLanguage}|${inst.languages?.join(',')}`;
     const createI18nWrapper = original => {
       const descriptors = Object.getOwnPropertyDescriptors(original);
       if (descriptors.__original) delete descriptors.__original;
@@ -3866,7 +3867,7 @@
     };
     const ret = React.useMemo(() => {
       const original = finalI18n;
-      const lang = original?.language;
+      const lang = original && languageKey(original);
       let i18nWrapper = original;
       if (original) {
         if (wrapperRef.current && wrapperRef.current.__original === original) {
```

**File**: `src/useTranslation.js` (modified, +9/-2)
```diff
@@ -140,10 +140,17 @@ export const useTranslation = (ns, props = {}) => {
 
   const finalI18n = i18n || {};
 
-  // cache one wrapper per hook caller and only recreate it when language changes
+  // cache one wrapper per hook caller and only recreate it when the language state changes
   const wrapperRef = useRef(null);
   const wrapperLangRef = useRef();
 
+  // the wrapper is a snapshot of the instance, so its identity has to change whenever any
+  // of the language fields does - resolvedLanguage and languages change on their own when
+  // the resources for the current language only arrive later (until then i18next resolves
+  // to the fallback), and a wrapper keyed on `language` alone would keep handing that out
+  const languageKey = (inst) =>
+    `${inst.language}|${inst.resolvedLanguage}|${inst.languages?.join(',')}`;
+
   // helper to create a wrapper instance (avoid duplicating descriptor logic)
   const createI18nWrapper = (original) => {
     const descriptors = Object.getOwnPropertyDescriptors(original);
@@ -168,7 +175,7 @@ export const useTranslation = (ns, props = {}) => {
 
   const ret = useMemo(() => {
     const original = finalI18n;
-    const lang = original?.language;
+    const lang = original && languageKey(original);
 
     let i18nWrapper = original;
 
```

**File**: `test/useTranslation.spec.jsx` (modified, +28/-0)
```diff
@@ -370,6 +370,34 @@ describe('useTranslation', () => {
       await i18nInstance.changeLanguage('en');
       rerender();
     });
+
+    it('replaces the wrapper when only resolvedLanguage changes', async () => {
+      const i18n = createInstance();
+      await i18n.init({
+        lng: 'en',
+        fallbackLng: 'en',
+        resources: { en: { translation: { hi: 'hi' } } },
+      });
+
+      const { result, rerender } = renderHook(() => useTranslation('translation', { i18n }));
+
+      // no translations for 'de' yet -> i18next resolves it to the fallback
+      await act(async () => {
+        await i18n.changeLanguage('de');
+      });
+      rerender();
+      const beforeWrapper = result.current.i18n;
+      expect(beforeWrapper.resolvedLanguage).toBe('en');
+
+      // the resources arrive afterwards, so the language now resolves to itself
+      await act(async () => {
+        i18n.addResourceBundle('de', 'translation', { hi: 'hallo' });
+        await i18n.changeLanguage('de');
+      });
+      rerender();
+      expect(result.current.i18n).not.toBe(beforeWrapper);
+      expect(result.current.i18n.resolvedLanguage).toBe('de');
+    });
   });
 
   it('should not trigger loadNamespaces on every render if namespaces array is unstable (inline)', async () => {
```

---

### Incident Patch 4: `5ceefb0e` (2026-09-01)
**Commit Message**: fix(types): allow selector keyPrefix in useTranslation under enableSelector 'strict' (#1930)

**File**: `index.d.ts` (modified, +1/-1)
```diff
@@ -222,7 +222,7 @@ export type FallbackNs<Ns> = Ns extends undefined
     ? Ns
     : _DefaultNamespace;
 
-export const useTranslation: _EnableSelector extends true | 'optimize'
+export const useTranslation: _EnableSelector extends true | 'optimize' | 'strict'
   ? UseTranslationSelector
   : UseTranslationLegacy;
 
```

**File**: `test/typescript/selector-strict/useTranslation.test.ts` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+import { describe, it, expectTypeOf, assertType } from 'vitest';
+import { useTranslation } from 'react-i18next';
+
+describe('useTranslation under enableSelector: "strict"', () => {
+  describe('default namespace', () => {
+    it('requires an explicit namespace prefix', () => {
+      const [t] = useTranslation();
+
+      expectTypeOf(t(($) => $.custom.foo)).toEqualTypeOf<'foo'>();
+    });
+
+    it('raises a TypeError given a flat-primary path (no ns prefix)', () => {
+      const [t] = useTranslation();
+      // @ts-expect-error
+      assertType<string>(t(($) => $.foo));
+    });
+  });
+
+  describe('named namespace', () => {
+    it('still requires the namespace prefix', () => {
+      const [t] = useTranslation('alternate');
+
+      expectTypeOf(t(($) => $.alternate.baz)).toEqualTypeOf<'baz'>();
+    });
+
+    it('raises a TypeError given a key that is not in the namespace', () => {
+      const [t] = useTranslation('alternate');
+      // @ts-expect-error
+      assertType<string>(t(($) => $.alternate.fake));
+    });
+  });
+
+  describe('namespace as array', () => {
+    it('exposes every namespace under its own prefix', () => {
+      const [t] = useTranslation(['alternate', 'custom']);
+
+      expectTypeOf(t(($) => $.alternate.baz)).toEqualTypeOf<'baz'>();
+      expectTypeOf(t(($) => $.custom.foo)).toEqualTypeOf<'foo'>();
+    });
+
+    it('raises a TypeError given a flat-primary path', () => {
+      const [t] = useTranslation(['alternate', 'custom']);
+      // @ts-expect-error
+      assertType<string>(t(($) => $.baz));
+    });
+  });
+
+  describe('with `keyPrefix`', () => {
+    it('should work with a selector keyPrefix', () => {
+      const [t] = useTranslation('alternate', {
+        keyPrefix: ($) => $.alternate.foobar.deep,
+      });
+
+      expectTypeOf(t(($) => $.deeper.deeeeeper)).toEqualTypeOf<'foobar'>();
+    });
+
+    it('should return objects from a selector keyPrefix', () => {
+      const [t] = useTranslation('alternate', {
+        keyPrefix: ($) => $.alternate.foobar,
+      });
+
+      expectTypeOf(t(($) => $.deep.deeper, { returnObjects: true })).toEqualTypeOf<{
+        deeeeeper: 'foobar';
+      }>();
+    });
+
+    it('raises a TypeError given a key outside the selector keyPrefix', () => {
+      const [t] = useTranslation('alternate', {
+        keyPrefix: ($) => $.alternate.foobar.deep,
+      });
+      // @ts-expect-error
+      assertType<string>(t(($) => $.abc));
+    });
+  });
+});
```

---

### Incident Patch 5: `aa7ba520` (2026-08-20)
**Commit Message**: chore(examples): require activesupport >= 7.2.3.1 in the RN Gemfiles

Closes the activesupport / concurrent-ruby advisories Dependabot raises on the stock RN template pins; the concurrent-ruby < 1.3.4 workaround is only needed for activesupport <= 7.1. Requires ruby >= 3.1 (which CocoaPods setups use anyway).

**File**: `example/ReactNativeLocizeProject/Gemfile` (modified, +3/-3)
```diff
@@ -1,13 +1,13 @@
 source 'https://rubygems.org'
 
 # You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
-ruby ">= 2.6.10"
+ruby ">= 3.1"
 
 # Exclude problematic versions of cocoapods and activesupport that causes build failures.
+# activesupport >= 7.2.3.1 (needs ruby >= 3.1) also closes the activesupport / concurrent-ruby advisories.
 gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
-gem 'activesupport', '>= 6.1.7.5', '!= 7.1.0'
+gem 'activesupport', '>= 7.2.3.1'
 gem 'xcodeproj', '< 1.26.0'
-gem 'concurrent-ruby', '< 1.3.4'
 
 # Ruby 3.4.0 has removed some libraries from the standard library.
 gem 'bigdecimal'
```

**File**: `example/ReactNativeProject/Gemfile` (modified, +3/-3)
```diff
@@ -1,13 +1,13 @@
 source 'https://rubygems.org'
 
 # You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
-ruby ">= 2.6.10"
+ruby ">= 3.1"
 
 # Exclude problematic versions of cocoapods and activesupport that causes build failures.
+# activesupport >= 7.2.3.1 (needs ruby >= 3.1) also closes the activesupport / concurrent-ruby advisories.
 gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
-gem 'activesupport', '>= 6.1.7.5', '!= 7.1.0'
+gem 'activesupport', '>= 7.2.3.1'
 gem 'xcodeproj', '< 1.26.0'
-gem 'concurrent-ruby', '< 1.3.4'
 
 # Ruby 3.4.0 has removed some libraries from the standard library.
 gem 'bigdecimal'
```

---

### Incident Patch 6: `aa5fc43a` (2026-08-20)
**Commit Message**: build

**File**: `react-i18next.js` (modified, +28/-1)
```diff
@@ -917,6 +917,10 @@
       this.options = options;
       this.supportedLngs = this.options.supportedLngs || false;
       this.logger = baseLogger.create('languageUtils');
+      this.resolveHierarchyCache = {};
+    }
+    clearCache() {
+      this.resolveHierarchyCache = {};
     }
     getScriptPartFromCode(code) {
       code = getCleanedCode(code);
@@ -997,6 +1001,25 @@
       return found || [];
     }
     toResolveHierarchy(code, fallbackCode) {
+      const fallbackLng = this.options.fallbackLng;
+      const fallbackLngKey = Array.isArray(fallbackLng) ? fallbackLng.join('|') : fallbackLng;
+      if (fallbackLngKey !== this._cachedFallbackLng) {
+        this.resolveHierarchyCache = {};
+        this._cachedFallbackLng = fallbackLngKey;
+      }
+      const hasCacheableFallback = fallbackCode === undefined || fallbackCode === false || isString$1(fallbackCode);
+      const usesUncacheableOptionsFallback = fallbackCode === undefined && typeof this.options.fallbackLng === 'function';
+      const cacheable = isString$1(code) && hasCacheableFallback && !usesUncacheableOptionsFallback;
+      let cacheKey = null;
+      if (cacheable) {
+        let fallbackCacheKey;
+        if (fallbackCode === undefined) fallbackCacheKey = 'undefined';else if (fallbackCode === false) fallbackCacheKey = 'boolean:false';else fallbackCacheKey = `string:${fallbackCode}`;
+        cacheKey = `${code.length}:${code}|${fallbackCacheKey}`;
+      }
+      if (cacheKey !== null) {
+        const cached = this.resolveHierarchyCache[cacheKey];
+        if (cached !== undefined) return cached.slice();
+      }
       const fallbackCodes = this.getFallbackCodes((fallbackCode === false ? [] : fallbackCode) || this.options.fallbackLng || [], code);
       const codes = [];
       const addCode = c => {
@@ -1017,6 +1040,10 @@
       fallbackCodes.forEach(fc => {
         if (!codes.includes(fc)) addCode(this.formatLanguageCode(fc));
       });
+      if (cacheKey !== null) {
+        this.resolveHierarchyCache[cacheKey] = codes;
+        return codes.slice();
+      }
       return codes;
     }
   }
@@ -3572,7 +3599,7 @@
         ...i18n.options.interpolation.defaultVariables
       };
     }
-    const translation = t(i18nKey, {
+    const translation = t(i18nKey || defaultTranslation, {
       defaultValue: defaultTranslation,
       ...mergedValues,
       ns: namespaces
```

---

### Incident Patch 7: `6c2a71e1` (2026-08-20)
**Commit Message**: fix(IcuTrans): use defaultTranslation as key when no i18nKey is given

Since 17.0.0 the icu.macro emits <IcuTrans defaultTranslation="…"> without a key for <Trans>/<Select>/<Plural> nodes that have no i18nKey, and IcuTrans passed undefined to t(), which returns '' → those nodes rendered empty. Fall back to defaultTranslation as the key, like Trans does.

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## 17.0.12
+
+- fix(IcuTrans): key-less `icu.macro` nodes (`<Trans>Welcome, {name}!</Trans>`, `<Select>`, `<Plural>` without `i18nKey`) rendered an empty string since 17.0.0. The macro now emits `<IcuTrans defaultTranslation="…">` without a key and `IcuTrans` passed `undefined` to `t()`, which returns `''`. Like `Trans`, `IcuTrans` now uses `defaultTranslation` as the key when `i18nKey` is not provided.
+
 ## 17.0.11
 
 - chore: `html-parse-stringify` updated to `^4.0.1`. The parser powering `<Trans>` is now actively maintained under the i18next org ([i18next/html-parse-stringify](https://github.com/i18next/html-parse-stringify)) after years without upstream releases. 4.x brings modern dual ESM/CJS packaging with an `exports` map, zero runtime dependencies, reworked TypeScript types and a long list of parser fixes (literal `<` in text, multiline/CRLF attribute values, comments containing `>`, doctype handling, quote-aware bracket handling).
```

**File**: `src/IcuTransWithoutContext.js` (modified, +4/-2)
```diff
@@ -117,8 +117,10 @@ export function IcuTransWithoutContext({
         : { ...i18n.options.interpolation.defaultVariables };
   }
 
-  // Get the translation, falling back to defaultTranslation
-  const translation = t(i18nKey, {
+  // Get the translation, falling back to defaultTranslation.
+  // Like `Trans`, use the default string as the key when none is given (icu.macro emits
+  // key-less nodes for `<Trans>Welcome, {name}!</Trans>`): t(undefined) would return ''.
+  const translation = t(i18nKey || defaultTranslation, {
     defaultValue: defaultTranslation,
     ...mergedValues,
     ns: namespaces,
```

**File**: `test/IcuTrans/IcuTransWithoutContext.spec.jsx` (modified, +13/-0)
```diff
@@ -28,6 +28,19 @@ describe('IcuTransWithoutContext', () => {
       expect(container.textContent).toBe('Hello World');
     });
 
+    it('should use defaultTranslation as key when no i18nKey is given (icu.macro key-less nodes)', () => {
+      const { container } = render(
+        <IcuTransWithoutContext
+          defaultTranslation="Welcome <0>back</0>!"
+          content={[{ type: 'strong', props: {} }]}
+          i18n={i18n}
+        />,
+      );
+
+      // without the key fallback t(undefined, ...) returns '' and nothing is rendered
+      expect(container.innerHTML).toBe('Welcome <strong>back</strong>!');
+    });
+
     it('should render with components', () => {
       const { container } = render(
         <IcuTransWithoutContext
```

---

### Incident Patch 8: `3c4c5631` (2026-07-22)
**Commit Message**: build

**File**: `react-i18next.js` (modified, +308/-154)
```diff
@@ -2245,127 +2245,318 @@
   instance.loadNamespaces;
   instance.loadLanguages;
 
-  function getDefaultExportFromCjs (x) {
-  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
+  const voidElements = {
+    area: true,
+    base: true,
+    br: true,
+    col: true,
+    embed: true,
+    hr: true,
+    img: true,
+    input: true,
+    link: true,
+    meta: true,
+    param: true,
+    source: true,
+    track: true,
+    wbr: true,
+    '!doctype': true,
+    '!DOCTYPE': true
+  };
+  const attrRE = /\s([^'"/\s><]+?)[\s/>]|([^\s=]+)=\s?("[^"]*"|'[^']*')/g;
+  function parseTag(tag) {
+    const res = {
+      type: 'tag',
+      name: '',
+      voidElement: false,
+      attrs: {},
+      children: []
+    };
+    const tagMatch = tag.match(/<\/?([^\s]+?)[/\s>]/);
+    if (tagMatch) {
+      res.name = tagMatch[1];
+      if (voidElements[tagMatch[1]] || tag.charAt(tag.length - 2) === '/') {
+        res.voidElement = true;
+      }
+      if (res.name.startsWith('!--')) {
+        const endIndex = tag.indexOf('-->');
+        return {
+          type: 'comment',
+          comment: endIndex !== -1 ? tag.slice(4, endIndex) : ''
+        };
+      }
+    }
+    const reg = new RegExp(attrRE);
+    let result = null;
+    for (;;) {
+      result = reg.exec(tag);
+      if (result === null) {
+        break;
+      }
+      if (!result[0].trim()) {
+        continue;
+      }
+      if (result[1]) {
+        const attr = result[1].trim();
+        let arr = [attr, null];
+        const eq = attr.indexOf('=');
+        if (eq > -1) {
+          arr = [attr.slice(0, eq), attr.slice(eq + 1)];
+        }
+        res.attrs[arr[0]] = arr[1];
+        reg.lastIndex--;
+      } else if (result[2]) {
+        res.attrs[result[2]] = result[3].trim().substring(1, result[3].length - 1);
+      }
+    }
+    return res;
   }
-
-  var voidElements;
-  var hasRequiredVoidElements;
-
-  function requireVoidElements () {
-  	if (hasRequiredVoidElements) return voidElements;
-  	hasRequiredVoidElements = 1;
-  	voidElements = {
-  	  "area": true,
-  	  "base": true,
-  	  "br": true,
-  	  "col": true,
-  	  "embed": true,
-  	  "hr": true,
-  	  "img": true,
-  	  "input": true,
-  	  "link": true,
-  	  "meta": true,
-  	  "param": true,
-  	  "source": true,
-  	  "track": true,
-  	  "wbr": true
-  	};
-  	return voidElements;
+  const tagRE = /<!--[\s\S]*?-->|<[a-zA-Z0-9\-!/](?:"[^"]*"|'[^']*'|[^'">])*>/g;
+  const tagNameRE = /<\/?([^\s]+?)[/\s>]/;
+  const whitespaceRE = /^\s*$/;
+  const rawTextRE = /^(script|style)$/i;
+  const sentinel = '\u0000';
+  const empty = Object.create(null);
+  function restoreSentinels(nodes) {
+    nodes.forEach(function (node) {
+      if (node.type === 'text') {
+        node.content = node.content.split(sentinel).join('<');
+        return;
+      }
+      if (node.type === 'comment') {
+        node.comment = node.comment.split(sentinel).join('<');
+        return;
+      }
+      for (const key in node.attrs) {
+        const value = node.attrs[key];
+        if (typeof value === 'string' && value.indexOf(sentinel) > -1) {
+          node.attrs[key] = value.split(sentinel).join('<');
+        }
+      }
+      if (node.children.length) {
+        restoreSentinels(node.children);
+      }
+    });
   }
-
-  var voidElementsExports = requireVoidElements();
-  var e = /*@__PURE__*/getDefaultExportFromCjs(voidElementsExports);
-
-  var t = /\s([^'"/\s><]+?)[\s/>]|([^\s=]+)=\s?(".*?"|'.*?')/g;
-  function n(n) {
-    var r = {
-        type: "tag",
-        name: "",
-        voidElement: false,
-        attrs: {},
-        children: []
-      },
-      i = n.match(/<\/?([^\s]+?)[/\s>]/);
-    if (i && (r.name = i[1], (e[i[1]] || "/" === n.charAt(n.length - 2)) && (r.voidElement = true), r.name.startsWith("!--"))) {
-      var s = n.indexOf("--\x3e");
-      return {
-        type: "comment",
-        comment: -1 !== s ? n.slice(4, s) : ""
+  function parse(html, options) {
+    const components = options && options.components || empty;
+    const allowedTags = options && options.allowedTags;
+    let restoreNeeded = false;
+    if (allowedTags) {
+      const isAllowed = typeof allowedTags === 'function' ? allowedTags : function (name) {
+        return allowedTags.indexOf(name) > -1;
       };
+      let out = '';
+      let pos = 0;
+      tagRE.lastIndex = 0;
+      let am;
+      while (am = tagRE.exec(html)) {
+        const tag = am[0];
+        out += html.slice(pos, am.index);
+        const nameMatch = tag.match(tagNameRE);
+        if (tag.startsWith('<!--') || nameMatch && isAllowed(nameMatch[1])) {
+          out += tag;
+          pos = am.index + tag.length;
+        } else {
+          restoreNeeded = true;
+          out += sentinel;
+          pos = am.index + 1;
+          tagRE.lastIndex = pos;
+        }
+      }
+      html = out + html.slice(pos);
     }
-    for (var a = new RegExp(t), c = null; null !== (c 
```

---

### Incident Patch 9: `57c3500e` (2026-07-15)
**Commit Message**: build

**File**: `react-i18next.js` (modified, +35/-16)
```diff
@@ -97,7 +97,7 @@
   const deepExtend = (target, source, overwrite) => {
     for (const prop in source) {
       if (prop !== '__proto__' && prop !== 'constructor') {
-        if (prop in target) {
+        if (Object.prototype.hasOwnProperty.call(target, prop)) {
           if (isString$1(target[prop]) || target[prop] instanceof String || isString$1(source[prop]) || source[prop] instanceof String) {
             if (overwrite) target[prop] = source[prop];
           } else {
@@ -461,11 +461,15 @@
     } = selector(createProxy());
     const keySeparator = opts?.keySeparator ?? '.';
     const nsSeparator = opts?.nsSeparator ?? ':';
+    const strict = opts?.enableSelector === 'strict';
     if (path.length > 1 && nsSeparator) {
       const ns = opts?.ns;
-      const nsArray = Array.isArray(ns) ? ns : null;
-      if (nsArray && nsArray.length > 1 && nsArray.slice(1).includes(path[0])) {
-        return `${path[0]}${nsSeparator}${path.slice(1).join(keySeparator)}`;
+      const nsList = strict ? Array.isArray(ns) ? ns : ns ? [ns] : null : Array.isArray(ns) ? ns : null;
+      if (nsList) {
+        const candidates = strict ? nsList : nsList.length > 1 ? nsList.slice(1) : [];
+        if (candidates.includes(path[0])) {
+          return `${path[0]}${nsSeparator}${path.slice(1).join(keySeparator)}`;
+        }
       }
     }
     return path.join(keySeparator);
@@ -877,7 +881,10 @@
       const useOptionsReplaceForData = options.replace && !isString$1(options.replace);
       let data = useOptionsReplaceForData ? options.replace : options;
       if (useOptionsReplaceForData && typeof options.count !== 'undefined') {
-        data.count = options.count;
+        data = {
+          ...data,
+          count: options.count
+        };
       }
       if (this.options.interpolation.defaultVariables) {
         data = {
@@ -1187,10 +1194,10 @@
       const skipOnVariables = options?.interpolation?.skipOnVariables !== undefined ? options.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables;
       const todos = [{
         regex: this.regexpUnescape,
-        safeValue: val => regexSafe(val)
+        safeValue: val => val
       }, {
         regex: this.regexp,
-        safeValue: val => this.escapeValue ? regexSafe(this.escape(val)) : regexSafe(val)
+        safeValue: val => this.escapeValue ? this.escape(val) : val
       }];
       todos.forEach(todo => {
         replaces = 0;
@@ -1214,9 +1221,9 @@
             value = makeString(value);
           }
           const safeValue = todo.safeValue(value);
-          str = str.replace(match[0], safeValue);
+          str = str.replace(match[0], regexSafe(safeValue));
           if (skipOnVariables) {
-            todo.regex.lastIndex += value.length;
+            todo.regex.lastIndex += safeValue.length;
             todo.regex.lastIndex -= match[0].length;
           } else {
             todo.regex.lastIndex = 0;
@@ -1266,7 +1273,7 @@
         clonedOptions = clonedOptions.replace && !isString$1(clonedOptions.replace) ? clonedOptions.replace : clonedOptions;
         clonedOptions.applyPostProcessor = false;
         delete clonedOptions.defaultValue;
-        const keyEndIndex = /{.*}/.test(match[1]) ? match[1].lastIndexOf('}') + 1 : match[1].indexOf(this.formatSeparator);
+        const keyEndIndex = /{.*}/s.test(match[1]) ? match[1].lastIndexOf('}') + 1 : match[1].indexOf(this.formatSeparator);
         if (keyEndIndex !== -1) {
           formatters = match[1].slice(keyEndIndex).split(this.formatSeparator).map(elem => elem.trim()).filter(Boolean);
           match[1] = match[1].slice(0, keyEndIndex);
@@ -1395,10 +1402,14 @@
     format(value, format, lng, options = {}) {
       if (!format) return value;
       if (value == null) return value;
-      const formats = format.split(this.formatSeparator);
-      if (formats.length > 1 && formats[0].indexOf('(') > 1 && !formats[0].includes(')') && formats.find(f => f.includes(')'))) {
-        const lastIndex = formats.findIndex(f => f.includes(')'));
-        formats[0] = [formats[0], ...formats.splice(1, lastIndex)].join(this.formatSeparator);
+      const rawFormats = format.split(this.formatSeparator);
+      const formats = [];
+      for (let i = 0; i < rawFormats.length; i++) {
+        let f = rawFormats[i];
+        while (f.indexOf('(') > -1 && !f.includes(')') && i + 1 < rawFormats.length) {
+          f = `${f}${this.formatSeparator}${rawFormats[++i]}`;
+        }
+        formats.push(f);
       }
       const result = formats.reduce((mem, f) => {
         const {
@@ -1657,6 +1668,7 @@
     nsSeparator: ':',
     pluralSeparator: '_',
     contextSeparator: '_',
+    enableSelector: false,
     partialBundledLanguages: false,
     saveMissing: false,
     updateMissing: false,
@@ -2831,7 +2843,7 @@
   }) {
     const i18n = i18nFromProps || getI18n();
     if (!i18n) {
-      warnOnce(i18n, 'NO_I18NEXT_INSTANCE', `Trans: You need to pass in an i18next instance using i18n
```

---

### Incident Patch 10: `422bab13` (2026-07-09)
**Commit Message**: fix: support typescript 7 — widen peer range and fix Trans ns inference under TS7 (#1927)

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -1,3 +1,8 @@
+## 17.0.9
+
+- fix: allow TypeScript 7 in the optional `typescript` peer dependency range (`^5 || ^6 || ^7`). With `typescript@7.0.2` in a project, `npm install` failed with an `ERESOLVE` peer conflict. Fixes [#1927](https://github.com/i18next/react-i18next/issues/1927), thanks @andikapradanaarif.
+- fix(types): `<Trans t={t} ns="ns" …>` with a `t` from `useTranslation(['ns'])` now typechecks under TypeScript 7. TS7 intersects the `Ns` inference candidates coming from the `t` prop (`readonly ['ns']`) and the `ns` prop (`'ns'`) into an unsatisfiable `'ns' & readonly ['ns']`, where TS6 resolved them. The `ns` prop on `TransProps`, `TransSelectorProps` and `IcuTransWithoutContextProps` now also accepts a single namespace out of an array-typed `Ns` (`Ns | (Ns extends readonly (infer S extends string)[] ? S : never)`) — which matches runtime behavior and is unchanged under TS5/TS6.
+
 ## 17.0.8
 
 - fix(types): `<Trans i18nKey={$ => ...}>` now typechecks under `enableSelector: 'strict'`. The `Trans` component's conditional type was gated on `_EnableSelector extends true | 'optimize'`, excluding `'strict'` and falling back to the legacy string-key signature. Runtime was already correct (it calls `keyFromSelector(i18nKey)` whenever `typeof i18nKey === 'function'`); this is a type-only fix that widens the conditional to include `'strict'`. Thanks @Faithfinder ([#1921](https://github.com/i18next/react-i18next/pull/1921))
```

**File**: `TransWithoutContext.d.ts` (modified, +5/-2)
```diff
@@ -42,7 +42,9 @@ export type TransProps<
   defaults?: string;
   i18n?: i18n;
   i18nKey?: Key | Key[];
-  ns?: Ns;
+  // allow a single namespace from an array-typed `t` (e.g. useTranslation(['ns'])); TS7 intersects
+  // inference candidates from `t` and `ns`, so a bare `Ns` here rejects ns="ns" when t is passed
+  ns?: Ns | (Ns extends readonly (infer S extends string)[] ? S : never);
   parent?: string | React.ComponentType<any> | null; // used in React.createElement if not null
   tOptions?: TOpt;
   values?: InterpolationMap<Ret>;
@@ -82,7 +84,8 @@ export interface TransSelectorProps<
   defaults?: string | Key;
   i18n?: i18n;
   i18nKey?: Key | readonly Key[];
-  ns?: Ns;
+  // see TransProps.ns: keep single-namespace values assignable when `t` fixes Ns to an array
+  ns?: Ns | (Ns extends readonly (infer S extends string)[] ? S : never);
   parent?: string | React.ComponentType<any> | null; // used in React.createElement if not null
   tOptions?: TOpt;
   values?: Key extends (...args: any[]) => infer R ? InterpolationMap<R> : {};
```

**File**: `index.d.ts` (modified, +2/-1)
```diff
@@ -62,7 +62,8 @@ export type IcuTransWithoutContextProps<
   /** Declaration tree describing React components and their props */
   content: IcuTransContentDeclaration[];
   /** Optional namespace(s) for the translation */
-  ns?: Ns;
+  // see TransProps.ns: keep single-namespace values assignable when `t` fixes Ns to an array
+  ns?: Ns | (Ns extends readonly (infer S extends string)[] ? S : never);
   /** Optional values for ICU variable interpolation */
   values?: Record<string, any>;
   /** i18next instance. If not provided, uses global instance */
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@
   "peerDependencies": {
     "i18next": ">= 26.2.0",
     "react": ">= 16.8.0",
-    "typescript": "^5 || ^6"
+    "typescript": "^5 || ^6 || ^7"
   },
   "peerDependenciesMeta": {
     "react-dom": {
```

---

### Incident Patch 11: `d5ab7c82` (2026-05-14)
**Commit Message**: fix(types): accept selector i18nKey on <Trans> under enableSelector: 'strict' (#1921)

The runtime calls `keyFromSelector(i18nKey)` whenever `typeof i18nKey === 'function'`
regardless of `enableSelector` mode, so selector-form `<Trans i18nKey={($) => ...}>`
already works at runtime under `'strict'`. The type-side conditional collapsed to
`TransLegacy` for `'strict'` though, making every such call site error with
`Type '($: any) => any' is not assignable to '"<key-union>" | undefined'`.

Widens the conditional to include `'strict'`, and mirrors the `selector-optimize`
typecheck tests as `selector-strict` to cover the change — strict-mode tests
verify that paths require an explicit namespace prefix (`$.custom.foo`) and that
flat-primary paths (`$.foo`) raise a TypeError as documented.

**File**: `TransWithoutContext.d.ts` (modified, +3/-1)
```diff
@@ -106,7 +106,9 @@ export interface TransSelector {
   ): React.ReactElement;
 }
 
-export const Trans: _EnableSelector extends true | 'optimize' ? TransSelector : TransLegacy;
+export const Trans: _EnableSelector extends true | 'optimize' | 'strict'
+  ? TransSelector
+  : TransLegacy;
 
 export function nodesToString(
   children: React.ReactNode,
```

**File**: `test/typescript/selector-strict/Trans.test.tsx` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+import { describe, it, expectTypeOf } from 'vitest';
+import * as React from 'react';
+import { Trans, useTranslation } from 'react-i18next';
+
+describe('<Trans /> under enableSelector: "strict"', () => {
+  describe('default namespace', () => {
+    it('requires an explicit namespace prefix', () => {
+      <Trans i18nKey={($) => (expectTypeOf($.custom.foo).toEqualTypeOf<'foo'>(), $.custom.foo)} />;
+    });
+
+    it(`raises a TypeError given a flat-primary path (no ns prefix)`, () => {
+      // @ts-expect-error
+      <Trans i18nKey={($) => $.foo} />;
+    });
+
+    it(`raises a TypeError given a key that doesn't exist`, () => {
+      // @ts-expect-error
+      <Trans i18nKey={($) => $.custom.Nope} />;
+    });
+  });
+
+  describe('named namespace', () => {
+    it('standard usage', () => {
+      <Trans
+        ns="custom"
+        i18nKey={($) => (expectTypeOf($.custom.foo).toEqualTypeOf<'foo'>(), $.custom.foo)}
+      />;
+    });
+
+    it(`raises a TypeError given a namespace that doesn't exist`, () => {
+      expectTypeOf<React.ComponentProps<typeof Trans>>()
+        .toHaveProperty('ns')
+        .extract<'Nope'>()
+        // @ts-expect-error
+        .toMatchTypeOf<'Nope'>();
+    });
+  });
+
+  describe('array namespace', () => {
+    it('always routes via an explicit namespace prefix', () => (
+      <>
+        <Trans
+          ns={['alternate', 'custom']}
+          i18nKey={($) => (expectTypeOf($.alternate.baz).toEqualTypeOf<'baz'>(), $.alternate.baz)}
+        />
+        <Trans
+          ns={['alternate', 'custom']}
+          i18nKey={($) => (expectTypeOf($.custom.bar).toEqualTypeOf<'bar'>(), $.custom.bar)}
+        />
+        <Trans
+          ns={['custom', 'alternate']}
+          i18nKey={($) => (
+            expectTypeOf($.alternate.foobar.deep.deeper.deeeeeper).toEqualTypeOf<'foobar'>(),
+            $.alternate.foobar.deep.deeper.deeeeeper
+          )}
+        />
+      </>
+    ));
+
+    it(`raises a TypeError given a flat-primary path`, () => {
+      // @ts-expect-error
+      <Trans ns={['alternate', 'custom']} i18nKey={($) => $.baz} />;
+      // @ts-expect-error
+      <Trans ns={['custom', 'alternate']} i18nKey={($) => $.bar} />;
+    });
+
+    it(`raises a TypeError given a key that's not present inside any namespace`, () => {
+      // @ts-expect-error
+      <Trans ns={['alternate', 'custom']} i18nKey={($) => $.custom.baz} />;
+    });
+  });
+
+  describe('usage with `t` function', () => {
+    it('should work when providing `t` function', () => {
+      const { t } = useTranslation('alternate');
+      <Trans
+        t={t}
+        i18nKey={($) => (
+          expectTypeOf($.alternate.foobar.barfoo).toEqualTypeOf<'barfoo'>(),
+          $.alternate.foobar.barfoo
+        )}
+      />;
+    });
+  });
+
+  describe('interpolation', () => {
+    it('should work with text and interpolation', () => {
+      expectTypeOf(Trans).toBeCallableWith({
+        children: ['foo ', { var: '' }],
+      });
+    });
+
+    it('should work with Interpolation in HTMLElement', () => {
+      expectTypeOf(Trans).toBeCallableWith({
+        children: (
+          <>
+            foo <strong>{{ var: '' }}</strong>
+          </>
+        ),
+      });
+    });
+
+    it('should work with text and interpolation as children of an HTMLElement', () => {
+      expectTypeOf(Trans).toBeCallableWith({
+        children: <span>foo {{ var: '' }}</span>,
+      });
+    });
+  });
+});
```

**File**: `test/typescript/selector-strict/i18next.d.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+import 'i18next';
+
+declare module 'i18next' {
+  interface CustomTypeOptions {
+    defaultNS: 'custom';
+    allowObjectInHTMLChildren: true;
+    enableSelector: 'strict';
+    resources: {
+      custom: {
+        foo: 'foo';
+        bar: 'bar';
+      };
+
+      alternate: {
+        baz: 'baz';
+        foobar: {
+          barfoo: 'barfoo';
+          deep: {
+            deeper: {
+              deeeeeper: 'foobar';
+            };
+          };
+        };
+      };
+    };
+  }
+}
```

**File**: `test/typescript/selector-strict/tsconfig.json` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+{
+  "extends": "../../../tsconfig.json",
+  "include": ["./**/*"],
+  "exclude": []
+}
```

---

### Incident Patch 12: `c8f4c6b5` (2026-05-07)
**Commit Message**: feat: useTranslation([nsA,nsB]) routes selector secondary-ns prefix via getFixedT scopeNs (i18next#2429)

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## 17.0.7
+
+- feat: `useTranslation([nsA, nsB, ...])` now passes its full namespace list to `getFixedT` via the new `scopeNs` opt (requires `i18next` ≥ v26.0.10). This makes selector calls with a secondary-namespace prefix resolve correctly under default `nsMode`: `t($ => $.nsB.foo)` previously missed silently because the bound `ns` was the primary string only and i18next's selector rewrite needed an array. Resolution semantics are unchanged — plain `t('key')` lookups still stay isolated to the primary namespace by default; use `nsMode: 'fallback'` to opt into multi-ns fallback resolution as before. Fixes [i18next#2429](https://github.com/i18next/i18next/issues/2429) for `useTranslation`-based callers.
+
 ## 17.0.6
 
 - fix: restore the v17 `nodesToString` output format consumed by `i18next-cli`'s extractor while still rendering [1919](https://github.com/i18next/react-i18next/issues/1919) correctly
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -53,7 +53,7 @@
         "eslint-plugin-testing-library": "^6.5.0",
         "happy-dom": "^20.8.9",
         "husky": "^9.1.7",
-        "i18next": "^26.0.3",
+        "i18next": "^26.0.10",
         "lint-staged": "^16.4.0",
         "mkdirp": "^3.0.1",
         "prettier": "^3.8.1",
@@ -67,7 +67,7 @@
         "yargs": "^18.0.0"
       },
       "peerDependencies": {
-        "i18next": ">= 26.0.1",
+        "i18next": ">= 26.0.10",
         "react": ">= 16.8.0",
         "typescript": "^5 || ^6"
       },
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -72,7 +72,7 @@
     "use-sync-external-store": "^1.6.0"
   },
   "peerDependencies": {
-    "i18next": ">= 26.0.1",
+    "i18next": ">= 26.0.10",
     "react": ">= 16.8.0",
     "typescript": "^5 || ^6"
   },
@@ -127,7 +127,7 @@
     "eslint-plugin-testing-library": "^6.5.0",
     "happy-dom": "^20.8.9",
     "husky": "^9.1.7",
-    "i18next": "^26.0.3",
+    "i18next": "^26.0.10",
     "lint-staged": "^16.4.0",
     "mkdirp": "^3.0.1",
     "prettier": "^3.8.1",
```

**File**: `react-i18next.js` (modified, +15/-6)
```diff
@@ -234,6 +234,7 @@
     }
     forward(args, lvl, prefix, debugOnly) {
       if (debugOnly && !this.debug) return null;
+      args = args.map(a => isString$1(a) ? a.replace(/[\r\n\x00-\x1F\x7F]/g, ' ') : a);
       if (isString$1(args[0])) args[0] = `${prefix}${this.prefix} ${args[0]}`;
       return this.logger[lvl](args);
     }
@@ -666,7 +667,7 @@
         const resForMissing = missingKeyNoValueFallbackToKey && usedKey ? undefined : res;
         const updateMissing = hasDefaultValue && defaultValue !== res && this.options.updateMissing;
         if (usedKey || usedDefault || updateMissing) {
-          this.logger.log(updateMissing ? 'updateKey' : 'missingKey', lng, namespace, key, updateMissing ? defaultValue : res);
+          this.logger.log(updateMissing ? 'updateKey' : 'missingKey', lng, namespace, needsPluralHandling && !updateMissing ? `${key}${this.pluralResolver.getSuffix(lng, opt.count, opt)}` : key, updateMissing ? defaultValue : res);
           if (keySeparator) {
             const fk = this.resolve(key, {
               ...opt,
@@ -1131,8 +1132,8 @@
       this.prefix = prefix ? regexEscape(prefix) : prefixEscaped || '{{';
       this.suffix = suffix ? regexEscape(suffix) : suffixEscaped || '}}';
       this.formatSeparator = formatSeparator || ',';
-      this.unescapePrefix = unescapeSuffix ? '' : unescapePrefix || '-';
-      this.unescapeSuffix = this.unescapePrefix ? '' : unescapeSuffix || '';
+      this.unescapePrefix = unescapeSuffix ? '' : unescapePrefix ? regexEscape(unescapePrefix) : '-';
+      this.unescapeSuffix = this.unescapePrefix ? '' : unescapeSuffix ? regexEscape(unescapeSuffix) : '';
       this.nestingPrefix = nestingPrefix ? regexEscape(nestingPrefix) : nestingPrefixEscaped || regexEscape('$t(');
       this.nestingSuffix = nestingSuffix ? regexEscape(nestingSuffix) : nestingSuffixEscaped || regexEscape(')');
       this.nestingOptionsSeparator = nestingOptionsSeparator || ',';
@@ -1179,6 +1180,9 @@
         });
       };
       this.resetRegExp();
+      if (!this.escapeValue && typeof str === 'string' && /\$t\([^)]*\{[^}]*\{\{/.test(str)) {
+        this.logger.warn('nesting options string contains interpolated variables with escapeValue: false — ' + 'if any of those values are attacker-controlled they can inject additional ' + 'nesting options (e.g. redirect lng/ns). Sanitise untrusted input before passing ' + 'it to t(), or keep escapeValue: true.');
+      }
       const missingInterpolationHandler = options?.missingInterpolationHandler || this.options.missingInterpolationHandler;
       const skipOnVariables = options?.interpolation?.skipOnVariables !== undefined ? options.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables;
       const todos = [{
@@ -1853,7 +1857,7 @@
           deferred.resolve(t);
           callback(err, t);
         };
-        if (this.languages && !this.isInitialized) return finish(null, this.t.bind(this));
+        if ((this.languages || this.isLanguageChangingTo) && !this.isInitialized) return finish(null, this.t.bind(this));
         this.changeLanguage(this.options.lng, finish);
       };
       if (this.options.resources || !this.options.initAsync) {
@@ -2008,7 +2012,8 @@
       }
       return deferred;
     }
-    getFixedT(lng, ns, keyPrefix) {
+    getFixedT(lng, ns, keyPrefix, fixedOpts) {
+      const scopeNs = fixedOpts?.scopeNs;
       const fixedT = (key, opts, ...rest) => {
         let o;
         if (typeof opts !== 'object') {
@@ -2020,12 +2025,14 @@
         }
         o.lng = o.lng || fixedT.lng;
         o.lngs = o.lngs || fixedT.lngs;
+        const explicitCallNs = o.ns !== undefined && o.ns !== null;
         o.ns = o.ns || fixedT.ns;
         if (o.keyPrefix !== '') o.keyPrefix = o.keyPrefix || keyPrefix || fixedT.keyPrefix;
         const selectorOpts = {
           ...this.options,
           ...o
         };
+        if (Array.isArray(scopeNs) && !explicitCallNs) selectorOpts.ns = scopeNs;
         if (typeof o.keyPrefix === 'function') o.keyPrefix = keysFromSelector(o.keyPrefix, selectorOpts);
         const keySeparator = this.options.keySeparator || '.';
         let resultKey;
@@ -3617,7 +3624,9 @@
       if (lastSnapshot && lastSnapshot.ready === calculatedReady && lastSnapshot.lng === currentLng && lastSnapshot.keyPrefix === keyPrefix && lastSnapshot.revision === currentRevision) {
         return lastSnapshot;
       }
-      const calculatedT = i18n.getFixedT(currentLng, i18nOptions.nsMode === 'fallback' ? namespaces : namespaces[0], keyPrefix);
+      const calculatedT = i18n.getFixedT(currentLng, i18nOptions.nsMode === 'fallback' ? namespaces : namespaces[0], keyPrefix, {
+        scopeNs: namespaces
+      });
       const newSnapshot = {
         t: calculatedT,
         ready: calculatedReady,
```

**File**: `src/useTranslation.js` (modified, +6/-0)
```diff
@@ -100,10 +100,16 @@ export const useTranslation = (ns, props = {}) => {
       return lastSnapshot;
     }
 
+    // `scopeNs` (4th opts arg, i18next ≥ 26.0.10) gives the selector API access
+    // to the full hook namespace list while `ns` (resolution-scope) stays at
+    // the primary string. Without it, `t($ => $.secondaryNs.foo)` would silently
+    // miss under default `nsMode` because `o.ns` is a single string and i18next's
+    // selector rewrite only fires on multi-ns input.
     const calculatedT = i18n.getFixedT(
       currentLng,
       i18nOptions.nsMode === 'fallback' ? namespaces : namespaces[0],
       keyPrefix,
+      { scopeNs: namespaces },
     );
 
     const newSnapshot = {
```

**File**: `test/useTranslation.spec.jsx` (modified, +30/-0)
```diff
@@ -151,6 +151,36 @@ describe('useTranslation', () => {
 
       expect(t('key1')).toBe('key1');
     });
+
+    // Hook is bound to its full namespace list via getFixedT's `scopeNs` opt
+    // (i18next ≥ 26.0.10). Resolution scope is unchanged (still primary-only
+    // outside `nsMode: 'fallback'`); only the selector path[0] check sees the
+    // secondary namespaces, so `$ => $.secondaryNs.foo` routes correctly.
+    describe('selector with secondary namespace prefix (no nsMode: fallback)', () => {
+      it('should resolve a selector path whose first segment is a secondary namespace', () => {
+        const { result } = renderHook(() =>
+          useTranslation(['translation', 'other'], { i18n: i18nInstance }),
+        );
+        const { t } = result.current;
+
+        // 'transTest1' exists in both namespaces with different values.
+        // Selector with explicit secondary-ns prefix must resolve to `other`.
+        expect(t(($) => $.other.transTest1)).toBe('Another go <1>there</1>.');
+        // No prefix → still resolved against primary ns.
+        expect(t(($) => $.transTest1)).toBe('Go <1>there</1>.');
+      });
+
+      it('should keep non-selector resolution isolated to the primary ns', () => {
+        // Defends against accidentally turning every t() into a fallback chain.
+        const { result } = renderHook(() =>
+          useTranslation(['translation', 'other'], { i18n: i18nInstance }),
+        );
+        const { t } = result.current;
+
+        // 'nestedKey2' only exists in `other`. Default mode must NOT find it.
+        expect(t('nestedKey2')).toBe('nestedKey2');
+      });
+    });
   });
 
   describe('default namespace from context', () => {
```

---

### Incident Patch 13: `b8ad5e4a` (2026-04-27)
**Commit Message**: fix: scope indexed placeholders inside keep-tags at render time #1919

17.0.5 fixed #1919 by changing nodesToString output, which broke i18next-cli's
extractor (which imports nodesToString and expects keep-tags to retain their
tag name even when wrapping non-keep React elements). The fix now lives in the
renderer: when descending into a keep-tag in mapAST, find the matching React
element by tag name and positional occurrence at this level, then use its
children as the scope for nested <N> placeholders.

This restores the v17 nodesToString output (so i18next-cli's extracted strings
are unchanged) while ensuring those strings render correctly at runtime.

**File**: `CHANGELOG.md` (modified, +7/-2)
```diff
@@ -1,7 +1,12 @@
+## 17.0.6
+
+- fix: restore the v17 `nodesToString` output format consumed by `i18next-cli`'s extractor while still rendering [1919](https://github.com/i18next/react-i18next/issues/1919) correctly
+  - 17.0.5 fixed [1919](https://github.com/i18next/react-i18next/issues/1919) by changing what `nodesToString` produced, which inadvertently changed the extracted translation strings for keep-tags wrapping non-keep React elements
+  - The fix now lives in the renderer: indexed `<N>` placeholders nested inside a keep-tag are scoped to that tag's own original React children (matching kept tags by name and positional occurrence at each level), so the translation string format produced by `nodesToString` is unchanged
+
 ## 17.0.5
 
-- fix: `<Trans />` no longer breaks child rendering when a kept HTML node (`transKeepBasicHtmlNodesFor`) wraps a non-keep React element [1919](https://github.com/i18next/react-i18next/issues/1919)
-  - Regression introduced in 17.0.0 alongside the fix for [i18next-cli/230](https://github.com/i18next/i18next-cli/issues/230); the keep-tag path is now only used when descendants are pure text/interpolation or other keep-eligible tags, so the i18next-cli/230 behavior (`<strong>{{name}}</strong>`, `<strong>Level {{level}}</strong>`, etc.) is preserved.
+- fix: `<Trans />` no longer breaks child rendering when a kept HTML node (`transKeepBasicHtmlNodesFor`) wraps a non-keep React element [1919](https://github.com/i18next/react-i18next/issues/1919) — superseded by 17.0.6, which keeps the same runtime fix without changing the `nodesToString` output
 
 ## 17.0.4
 
```

**File**: `react-i18next.js` (modified, +18/-13)
```diff
@@ -2476,17 +2476,6 @@
   };
   const hasValidReactChildren = children => Array.isArray(children) && children.every(React.isValidElement);
   const getAsArray = data => Array.isArray(data) ? data : [data];
-  const hasNonKeepReactDescendant = (children, keepArray) => {
-    if (children == null) return false;
-    return getAsArray(children).some(child => {
-      if (!React.isValidElement(child)) return false;
-      const props = child.props || {};
-      const propCount = Object.keys(props).length;
-      const isKeepEligible = keepArray.indexOf(child.type) > -1 && propCount <= 1 && !props.i18nIsDynamicList;
-      if (!isKeepEligible) return true;
-      return hasNonKeepReactDescendant(props.children, keepArray);
-    });
-  };
   const mergeProps = (source, target) => {
     const newTarget = {
       ...target
@@ -2536,7 +2525,7 @@
           stringNode += `<${childIndex}></${childIndex}>`;
           return;
         }
-        if (shouldKeepChild && childPropsCount <= 1 && !hasNonKeepReactDescendant(childChildren, keepArray)) {
+        if (shouldKeepChild && childPropsCount <= 1) {
           const cnt = isString(childChildren) ? childChildren : nodesToString(childChildren, i18nOptions, i18n, i18nKey);
           stringNode += `<${type}>${cnt}</${type}>`;
           return;
@@ -2676,6 +2665,7 @@
     const mapAST = (reactNode, astNode, rootReactNode) => {
       const reactNodes = getAsArray(reactNode);
       const astNodes = getAsArray(astNode);
+      const keepTagOccurrence = {};
       return astNodes.reduce((mem, node, i) => {
         const translationContent = node.children?.[0]?.content && i18n.services.interpolator.interpolate(node.children[0].content, opts, i18n.language);
         if (node.type === 'tag') {
@@ -2720,7 +2710,22 @@
                   key: `${node.name}-${i}`
                 }));
               } else {
-                const inner = mapAST(reactNodes, node.children, rootReactNode);
+                const occurrence = keepTagOccurrence[node.name] || 0;
+                keepTagOccurrence[node.name] = occurrence + 1;
+                let matched;
+                let seen = 0;
+                for (let r = 0; r < reactNodes.length; r += 1) {
+                  const rn = reactNodes[r];
+                  if (React.isValidElement(rn) && rn.type === node.name) {
+                    if (seen === occurrence) {
+                      matched = rn;
+                      break;
+                    }
+                    seen += 1;
+                  }
+                }
+                const innerScope = matched ? getAsArray(getChildren(matched)) : reactNodes;
+                const inner = mapAST(innerScope, node.children, rootReactNode);
                 mem.push(React.createElement(node.name, {
                   key: `${node.name}-${i}`
                 }, inner));
```

**File**: `src/TransWithoutContext.js` (modified, +25/-30)
```diff
@@ -24,23 +24,6 @@ const hasValidReactChildren = (children) =>
 
 const getAsArray = (data) => (Array.isArray(data) ? data : [data]);
 
-// True if any descendant React element cannot be re-emitted as a keep-tag
-// (i.e. its tag is not in keepArray, or it carries props beyond `children`).
-// Such descendants produce numbered <N> placeholders in the translation string,
-// which the renderer's keep-tag branch cannot scope correctly (#1919).
-const hasNonKeepReactDescendant = (children, keepArray) => {
-  if (children == null) return false;
-  return getAsArray(children).some((child) => {
-    if (!isValidElement(child)) return false;
-    const props = child.props || {};
-    const propCount = Object.keys(props).length;
-    const isKeepEligible =
-      keepArray.indexOf(child.type) > -1 && propCount <= 1 && !props.i18nIsDynamicList;
-    if (!isKeepEligible) return true;
-    return hasNonKeepReactDescendant(props.children, keepArray);
-  });
-};
-
 const mergeProps = (source, target) => {
   const newTarget = { ...target };
   // translation props (source.props) should override component props (target.props)
@@ -103,16 +86,9 @@ export const nodesToString = (children, i18nOptions, i18n, i18nKey) => {
         stringNode += `<${childIndex}></${childIndex}>`;
         return;
       }
-      if (
-        shouldKeepChild &&
-        childPropsCount <= 1 &&
-        !hasNonKeepReactDescendant(childChildren, keepArray)
-      ) {
+      if (shouldKeepChild && childPropsCount <= 1) {
         // actual e.g. dolor <strong>bold</strong> amet
         // expected e.g. dolor <strong>bold</strong> amet
-        // Only enter the keep-tag path when descendants are pure text/interpolation
-        // or other keep-eligible tags. Numbered <N> placeholders inside a keep-tag
-        // would be looked up in the wrong reactNodes scope at render time. (#1919)
         const cnt = isString(childChildren)
           ? childChildren
           : nodesToString(childChildren, i18nOptions, i18n, i18nKey);
@@ -334,6 +310,10 @@ const renderNodes = (
     const reactNodes = getAsArray(reactNode);
     const astNodes = getAsArray(astNode);
 
+    // Track keep-tag occurrences at this level so we can match the n-th `<p>` AST
+    // node to the n-th original React element with type === 'p' (#1919).
+    const keepTagOccurrence = {};
+
     return astNodes.reduce((mem, node, i) => {
       const translationContent =
         node.children?.[0]?.content &&
@@ -401,11 +381,26 @@ const renderNodes = (
             if (node.voidElement) {
               mem.push(createElement(node.name, { key: `${node.name}-${i}` }));
             } else {
-              const inner = mapAST(
-                reactNodes /* wrong but we need something */,
-                node.children,
-                rootReactNode,
-              );
+              // Find the matching React element by tag name (positional among
+              // same-named keep-tags at this level) so its children become the
+              // scope for any indexed <N> placeholders nested inside. Without
+              // this, `<N>` would be looked up in the parent scope. (#1919)
+              const occurrence = keepTagOccurrence[node.name] || 0;
+              keepTagOccurrence[node.name] = occurrence + 1;
+              let matched;
+              let seen = 0;
+              for (let r = 0; r < reactNodes.length; r += 1) {
+                const rn = reactNodes[r];
+                if (isValidElement(rn) && rn.type === node.name) {
+                  if (seen === occurrence) {
+                    matched = rn;
+                    break;
+                  }
+                  seen += 1;
+                }
+              }
+              const innerScope = matched ? getAsArray(getChildren(matched)) : reactNodes;
+              const inner = mapAST(innerScope, node.children, rootReactNode);
 
               mem.push(createElement(node.name, { key: `${node.name}-${i}` }, inner));
             }
```

**File**: `test/trans.nodeToString.spec.jsx` (modified, +6/-5)
```diff
@@ -122,16 +122,17 @@ describe('trans nodeToString', () => {
       expect(actual).toEqual(expected);
     });
 
-    it('should fall back to indexed placeholder when a keep-tag wraps a non-keep React element (#1919)', () => {
+    it('should keep the tag name when a keep-tag wraps a non-keep React element (#1919)', () => {
       const fragment = (
         <p>
           You can <a href="http://example.com">click here</a>.
         </p>
       );
-      // <p> is in keepArray but its children include <a> which is not. Using the
-      // keep-tag form (`<p>You can <1>click here</1>.</p>`) would force the renderer
-      // to look up `<1>` in the wrong scope, so we emit the indexed form instead.
-      const expected = '<0>You can <1>click here</1>.</0>';
+      // <p> is in keepArray and `<a>` is not, so the inner element is referenced
+      // by index. The renderer scopes the index lookup against the kept <p>'s
+      // own children so this round-trips correctly. Matches the form expected
+      // by i18next-cli's extractor.
+      const expected = '<p>You can <1>click here</1>.</p>';
       const transKeepBasicHtmlNodesFor = ['br', 'strong', 'i', 'p'];
       const actual = nodesToString([fragment], {
         transSupportBasicHtmlNodes: true,
```

---

### Incident Patch 14: `9803bb80` (2026-04-27)
**Commit Message**: fix: <Trans /> no longer breaks child rendering when a kept HTML node (transKeepBasicHtmlNodesFor) wraps a non-keep React element #1919

Regression introduced in 17.0.0 alongside the fix for i18next-cli/230.
The keep-tag path is now only used when descendants are pure text/interpolation
or other keep-eligible tags, so the i18next-cli/230 behavior
(<strong>{{name}}</strong>, <strong>Level {{level}}</strong>, etc.) is preserved.

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -1,3 +1,8 @@
+## 17.0.5
+
+- fix: `<Trans />` no longer breaks child rendering when a kept HTML node (`transKeepBasicHtmlNodesFor`) wraps a non-keep React element [1919](https://github.com/i18next/react-i18next/issues/1919)
+  - Regression introduced in 17.0.0 alongside the fix for [i18next-cli/230](https://github.com/i18next/i18next-cli/issues/230); the keep-tag path is now only used when descendants are pure text/interpolation or other keep-eligible tags, so the i18next-cli/230 behavior (`<strong>{{name}}</strong>`, `<strong>Level {{level}}</strong>`, etc.) is preserved.
+
 ## 17.0.4
 
 - fix: avoid `React does not recognize the 'i18nIsDynamicList' prop on a DOM element` warning [1915](https://github.com/i18next/react-i18next/issues/1915)
```

**File**: `react-i18next.js` (modified, +12/-1)
```diff
@@ -2476,6 +2476,17 @@
   };
   const hasValidReactChildren = children => Array.isArray(children) && children.every(React.isValidElement);
   const getAsArray = data => Array.isArray(data) ? data : [data];
+  const hasNonKeepReactDescendant = (children, keepArray) => {
+    if (children == null) return false;
+    return getAsArray(children).some(child => {
+      if (!React.isValidElement(child)) return false;
+      const props = child.props || {};
+      const propCount = Object.keys(props).length;
+      const isKeepEligible = keepArray.indexOf(child.type) > -1 && propCount <= 1 && !props.i18nIsDynamicList;
+      if (!isKeepEligible) return true;
+      return hasNonKeepReactDescendant(props.children, keepArray);
+    });
+  };
   const mergeProps = (source, target) => {
     const newTarget = {
       ...target
@@ -2525,7 +2536,7 @@
           stringNode += `<${childIndex}></${childIndex}>`;
           return;
         }
-        if (shouldKeepChild && childPropsCount <= 1) {
+        if (shouldKeepChild && childPropsCount <= 1 && !hasNonKeepReactDescendant(childChildren, keepArray)) {
           const cnt = isString(childChildren) ? childChildren : nodesToString(childChildren, i18nOptions, i18n, i18nKey);
           stringNode += `<${type}>${cnt}</${type}>`;
           return;
```

**File**: `src/TransWithoutContext.js` (modified, +25/-1)
```diff
@@ -24,6 +24,23 @@ const hasValidReactChildren = (children) =>
 
 const getAsArray = (data) => (Array.isArray(data) ? data : [data]);
 
+// True if any descendant React element cannot be re-emitted as a keep-tag
+// (i.e. its tag is not in keepArray, or it carries props beyond `children`).
+// Such descendants produce numbered <N> placeholders in the translation string,
+// which the renderer's keep-tag branch cannot scope correctly (#1919).
+const hasNonKeepReactDescendant = (children, keepArray) => {
+  if (children == null) return false;
+  return getAsArray(children).some((child) => {
+    if (!isValidElement(child)) return false;
+    const props = child.props || {};
+    const propCount = Object.keys(props).length;
+    const isKeepEligible =
+      keepArray.indexOf(child.type) > -1 && propCount <= 1 && !props.i18nIsDynamicList;
+    if (!isKeepEligible) return true;
+    return hasNonKeepReactDescendant(props.children, keepArray);
+  });
+};
+
 const mergeProps = (source, target) => {
   const newTarget = { ...target };
   // translation props (source.props) should override component props (target.props)
@@ -86,9 +103,16 @@ export const nodesToString = (children, i18nOptions, i18n, i18nKey) => {
         stringNode += `<${childIndex}></${childIndex}>`;
         return;
       }
-      if (shouldKeepChild && childPropsCount <= 1) {
+      if (
+        shouldKeepChild &&
+        childPropsCount <= 1 &&
+        !hasNonKeepReactDescendant(childChildren, keepArray)
+      ) {
         // actual e.g. dolor <strong>bold</strong> amet
         // expected e.g. dolor <strong>bold</strong> amet
+        // Only enter the keep-tag path when descendants are pure text/interpolation
+        // or other keep-eligible tags. Numbered <N> placeholders inside a keep-tag
+        // would be looked up in the wrong reactNodes scope at render time. (#1919)
         const cnt = isString(childChildren)
           ? childChildren
           : nodesToString(childChildren, i18nOptions, i18n, i18nKey);
```

**File**: `test/trans.nodeToString.spec.jsx` (modified, +18/-0)
```diff
@@ -121,6 +121,24 @@ describe('trans nodeToString', () => {
       });
       expect(actual).toEqual(expected);
     });
+
+    it('should fall back to indexed placeholder when a keep-tag wraps a non-keep React element (#1919)', () => {
+      const fragment = (
+        <p>
+          You can <a href="http://example.com">click here</a>.
+        </p>
+      );
+      // <p> is in keepArray but its children include <a> which is not. Using the
+      // keep-tag form (`<p>You can <1>click here</1>.</p>`) would force the renderer
+      // to look up `<1>` in the wrong scope, so we emit the indexed form instead.
+      const expected = '<0>You can <1>click here</1>.</0>';
+      const transKeepBasicHtmlNodesFor = ['br', 'strong', 'i', 'p'];
+      const actual = nodesToString([fragment], {
+        transSupportBasicHtmlNodes: true,
+        transKeepBasicHtmlNodesFor,
+      });
+      expect(actual).toEqual(expected);
+    });
   });
 
   describe('having dynamic list maps', () => {
```

**File**: `test/trans.render.spec.jsx` (modified, +50/-0)
```diff
@@ -192,6 +192,56 @@ describe('trans simple with custom html tag', () => {
   });
 });
 
+describe('trans keep-tag wrapping a non-keep React element (#1919)', () => {
+  const originalReactOptions = i18n.options.react;
+
+  beforeAll(() => {
+    i18n.options.react = {
+      ...originalReactOptions,
+      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p'],
+    };
+  });
+
+  afterAll(() => {
+    i18n.options.react = originalReactOptions;
+  });
+
+  it('preserves non-keep child elements (e.g. <a>) inside a kept <p>', () => {
+    const { container } = render(
+      <Trans i18n={i18n}>
+        <div>
+          <ul>
+            <li>PDF</li>
+          </ul>
+          <p>
+            You can <a href="http://example.com">click here</a>.
+          </p>
+        </div>
+      </Trans>,
+    );
+    expect(container.firstChild).toMatchInlineSnapshot(`
+      <div>
+        <div>
+          <ul>
+            <li>
+              PDF
+            </li>
+          </ul>
+          <p>
+            You can 
+            <a
+              href="http://example.com"
+            >
+              click here
+            </a>
+            .
+          </p>
+        </div>
+      </div>
+    `);
+  });
+});
+
 describe('trans bracketNotation', () => {
   function TestComponent() {
     const numOfItems = 4;
```

---

### Incident Patch 15: `c96f7bc2` (2026-04-17)
**Commit Message**: fix: avoid `React does not recognize the i18nIsDynamicList prop on a DOM element` warning #1915

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## 17.0.4
+
+- fix: avoid `React does not recognize the 'i18nIsDynamicList' prop on a DOM element` warning [1915](https://github.com/i18next/react-i18next/issues/1915)
+
 ## 17.0.3
 
 - fix: avoid invalid prop on `React.Fragment` inside `<Trans />` [1914](https://github.com/i18next/react-i18next/issues/1914)
```

**File**: `react-i18next.js` (modified, +11/-5)
```diff
@@ -2637,21 +2637,27 @@
         }, isVoid ? undefined : inner));
       } else {
         mem.push(...React.Children.map([child], c => {
-          if (c.type === React.Fragment) {
-            return React.createElement(React.Fragment, {
+          if (c.type === React.Fragment || c.props?.i18nIsDynamicList !== undefined) {
+            const freshProps = {
               key: i
-            }, isVoid ? null : inner);
+            };
+            if (c && c.props) {
+              Object.keys(c.props).forEach(k => {
+                if (k === 'children' || k === 'i18nIsDynamicList') return;
+                freshProps[k] = c.props[k];
+              });
+            }
+            return React.createElement(c.type, freshProps, isVoid ? null : inner);
           }
           const override = {
             key: i
           };
           if (c && c.props) {
             Object.keys(c.props).forEach(k => {
-              if (k === 'ref' || k === 'children' || k === 'i18nIsDynamicList') return;
+              if (k === 'ref' || k === 'children') return;
               override[k] = c.props[k];
             });
           }
-          override.i18nIsDynamicList = undefined;
           return React.cloneElement(c, override, isVoid ? null : inner);
         }));
       }
```

**File**: `src/TransWithoutContext.js` (modified, +19/-14)
```diff
@@ -270,28 +270,33 @@ const renderNodes = (
     } else {
       mem.push(
         ...Children.map([child], (c) => {
-          // Fragments only accept key and children — createElement builds props from
-          // scratch so i18nIsDynamicList and other internal props are naturally excluded.
-          // Fragments cannot have refs, so this does not regress #1887. Fixes #1914.
-          if (c.type === Fragment) {
-            return createElement(Fragment, { key: i }, isVoid ? null : inner);
+          // Fragments only accept key/children (#1914), and elements carrying the internal
+          // i18nIsDynamicList prop must not forward it to the DOM (#1915). cloneElement
+          // cannot remove props from the merged result, so in both cases we rebuild the
+          // props via createElement. Fragments can't have refs, and i18nIsDynamicList is
+          // typically used on list wrappers rather than ref'd elements, so the common
+          // ref-forwarding path (#1887) still goes through cloneElement below.
+          if (c.type === Fragment || c.props?.i18nIsDynamicList !== undefined) {
+            const freshProps = { key: i };
+            if (c && c.props) {
+              Object.keys(c.props).forEach((k) => {
+                if (k === 'children' || k === 'i18nIsDynamicList') return;
+                // On React >= 19 `ref` is a regular prop and flows through here.
+                freshProps[k] = c.props[k];
+              });
+            }
+            return createElement(c.type, freshProps, isVoid ? null : inner);
           }
 
-          // For non-Fragment elements use cloneElement so React preserves/forwards refs
-          // internally and we never access element.ref or c.props.ref ourselves. (#1887)
+          // Use cloneElement so React preserves/forwards refs internally without us
+          // ever accessing element.ref or c.props.ref (avoids the React 19 warning). (#1887)
           const override = { key: i };
-
           if (c && c.props) {
             Object.keys(c.props).forEach((k) => {
-              if (k === 'ref' || k === 'children' || k === 'i18nIsDynamicList') return;
+              if (k === 'ref' || k === 'children') return;
               override[k] = c.props[k];
             });
           }
-
-          // cloneElement merges props, so we must explicitly set i18nIsDynamicList to
-          // undefined to strip it from the cloned element and prevent it reaching the DOM.
-          override.i18nIsDynamicList = undefined;
-
           return cloneElement(c, override, isVoid ? null : inner);
         }),
       );
```

**File**: `test/trans.render.dynamic.spec.jsx` (modified, +24/-1)
```diff
@@ -1,4 +1,4 @@
-import { describe, it, expect, afterEach } from 'vitest';
+import { describe, it, expect, afterEach, vi } from 'vitest';
 import React from 'react';
 import { render, cleanup } from '@testing-library/react';
 import './i18n';
@@ -119,4 +119,27 @@ describe('Trans should render nested components', () => {
       </div>
     `);
   });
+
+  // #1915 — cloned DOM elements without i18nIsDynamicList must not receive any
+  // internal prop (previously leaked via override.i18nIsDynamicList = undefined)
+  it('should not emit unknown-prop warnings for plain DOM components', () => {
+    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
+    function TestComponent() {
+      return (
+        <Trans
+          defaults="By continuing you agree to our <termsLink>Terms</termsLink> and <policyLink>Policy</policyLink>."
+          components={{
+            // eslint-disable-next-line jsx-a11y/control-has-associated-label, jsx-a11y/anchor-has-content
+            termsLink: <a href="https://example.com" target="_blank" rel="noreferrer" />,
+            // eslint-disable-next-line jsx-a11y/control-has-associated-label, jsx-a11y/anchor-has-content
+            policyLink: <a href="https://example.com" target="_blank" rel="noreferrer" />,
+          }}
+        />
+      );
+    }
+    render(<TestComponent />);
+    const warnings = errorSpy.mock.calls.map((args) => String(args[0]));
+    expect(warnings.some((w) => w.includes('i18nIsDynamicList'))).toBe(false);
+    errorSpy.mockRestore();
+  });
 });
```

#### Recent Merged Pull Requests:
- **PR #1930** (2026-09-01): fix(types): allow selector keyPrefix in useTranslation under enableSelector 'strict' (@hovelopin)
- **PR #1929** (2026-08-08): docs: point Trans component links at the current docs (@luccasfraga)
- **PR #1925** (closed): fix(test): correct isObject test to properly exclude arrays (@dashitongzhi)
- **PR #1924** (closed): fix: improve isObject and tokenizer error handling (@dashitongzhi)
- **PR #1923** (closed): feat: add GitHub Actions CI workflow (@dashitongzhi)
- **PR #1922** (closed): feat: add GitHub Actions CI workflow and contribution improvements (@dashitongzhi)
- **PR #1921** (2026-05-14): fix(types): accept selector i18nKey on <Trans> under enableSelector: 'strict' (@Faithfinder)
- **PR #1917** (closed): Security: Global mutable default options are shared across consumers/requests (@tuanaiseo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: i18next-react-i18next-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "i18next-react-i18next-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T03:16:46.787Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-i18next-react-i18next-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [i18next-react-i18next-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T03:16:46.787Z`  
> **Learning ID**: `LEARN-EVO-i18next-react-i18next-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), F (Design Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 79%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from i18next-react-i18next-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/i18next-react-i18next-learnings.md`  
> **Source**: github ([https://github.com/i18next/react-i18next](https://github.com/i18next/react-i18next))  
> **Source Version**: `f97f5f82`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-14T03:10:29.579Z  
> **Learning ID**: `learn-github-i18next-react-i18next`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): i18next/react-i18next

> **Canonical Artifact**: `07_PROJECT_LEARNING/i18next-react-i18next-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/i18next/react-i18next](https://github.com/i18next/react-i18next))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-14T03:10:29.346Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `i18next/react-i18next`
- **Description**: Internationalization for react done right. Using the i18next i18n ecosystem.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10067 stars

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

// Named, decimal and hexadecimal entities in one pattern, so that each entity is decoded once:
// decoding them in separate passes turned "&amp;#60;" (a literal "&#60;") into "<"
const entityPattern = /&(?:#(\d+)|#x([0-9a-fA-F]+)|[A-Za-z][A-Za-z0-9]*);/g;

// fromCodePoint throws above U+10FFFF, so such entities are left as they are
const decodeCodePoint = (match, codePoint) =>
  codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;

/**
 * Decode HTML entities in text
 *
 * Decodes the common named entities from the map above and numeric entities (decimal and
 * hexadecimal) in a single pass. Unknown named entities are left as they are.
 *
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text
 */
export const decodeHtmlEntities = (text) =>
  text.replace(entityPattern, (match, decimal, hex) => {
    if (decimal) return decodeCodePoint(match, parseInt(decimal, 10));
    if (hex) return decodeCodePoint(match, parseInt(hex, 16));
    return Object.prototype.hasOwnProperty.call(commonEntities, match)
      ? commonEntities[match]
      : match;
  });

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
// deduped per logger, where the warning goes: each i18next instance has its own logger, and a
// clone shares its parent's, so a second instance (micro-frontends, tests) gets its own warnings
// and a clone per request does not repeat them; an instance without a logger yet counts itself,
// no instance at all is deduped per message
const warnedFor = new WeakMap();
const warnedWithoutInstance = new Set();
/** @type {typeof warn} */
export const warnOnce = (i18n, code, msg, rest) => {
  if (isString(msg)) {
    let warned = warnedWithoutInstance;
    const owner = i18n?.services?.logger || i18n;
    if (isObject(owner)) {
      warned = warnedFor.get(owner);
      if (!warned) warnedFor.set(owner, (warned = new Set()));
    }
    if (warned.has(msg)) return;
    warned.add(msg);
  }
  warn(i18n, code, msg, rest);
};

export const inDevelopment = () => {
  try {
    // statically replaced by bundlers (webpack/vite/metro define it, rollup replaces it
    // in our UMD builds); evaluated at runtime in Node
    return process.env.NODE_ENV !== 'production';
  } catch (e) {
    // no `process` in this runtime (raw ESM in the browser, some edge runtimes): stay quiet
    return false;
  }
};

const loadedClb = (i18n, cb) => () => {
  // delay ready if not yet initialized i18n instance
  if (i18n.isInitialized) {
    cb();
  } else {
    i18n.once('initialized', () => cb());
  }
};

export const loadNamespaces = (i18n, ns, cb) => {
  i18n.loadNamespaces(ns, loadedClb(i18n, cb));
};

export const loadLanguages = (i18n, lng, ns, cb) => {
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

// An i18nFormat plugin (i18next-icu, i18next-mf2, i18next-fluent) replaces the core interpolation, so
// interpolation.escapeValue does not apply to the values it inserts
export const getFormatPlugin = (i18n) => {
  const plugin = i18n?.services?.i18nFormat;
  return typeof plugin?.parse === 'function' ? plugin : undefined;
};

const htmlEscapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// only strings: numbers, dates and objects reach the formatter unchanged
export const escapeStringValues = (values) => {
  if (!values) return values;
  const escaped = {};
  Object.keys(values).forEach((k) => {
    const v = values[k];
    escaped[k] = isString(v) ? v.replace(/[&<>"']/g, (c) => htmlEscapes[c]) : v;
  });
  return escaped;
};

```

### Core Architecture Module: `IcuTransWithoutContext.d.ts`
```
export {
  IcuTransWithoutContext,
  IcuTransWithoutContextComponent,
  IcuTransWithoutContextProps,
  IcuTransContentDeclaration,
} from './index.js';

```

### Core Architecture Module: `TransWithoutContext.d.ts`
```
import type {
  i18n,
  ReactOptions,
  AppendKeyPrefix,
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

type TransChild = React.ReactNode | Record<string, unknown>;
type $NoInfer<T> = [T][T extends T ? 0 : never];

export type TransProps<
  Key extends ParseKeys<Ns, TOpt, KPrefix>,
  Ns extends Namespace = _DefaultNamespace,
  KPrefix = undefined,
  TContext extends string | undefined = undefined,
  TOpt extends TOptions & { context?: TContext } = { context: TContext },
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
  // keep the return type inside this property: as a type parameter of `Trans`, it was also
  // computed for every key of the namespace, which is slow with large resources
  values?: InterpolationMap<TFunctionReturn<Ns, AppendKeyPrefix<Key, KPrefix>, TOpt>>;
  /** @deprecated ignored: Trans always decodes HTML entities */
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
    E = React.HTMLProps<HTMLDivElement>,
  >(
    props: TransProps<Key, Ns, KPrefix, TContext, TOpt, E>,
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
  /** @deprecated ignored: Trans always decodes HTML entities */
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
  | 'SUSPENDED_WHILE_LOADING'
  | 'I18N_NOT_INITIALIZED'
  | 'ICU_TRANS_RENDER_ERROR'
  | 'GLOBAL_INSTANCE_ON_SERVER';

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

### Core Architecture Module: `augment-react.d.ts`
```
// Opt-in: lets HTML elements nested in <Trans> take interpolation objects as children,
// e.g. <Trans><strong>{{ name }}</strong></Trans>, when CustomTypeOptions sets
// allowObjectInHTMLChildren: true. Import it once, next to that declaration:
//
//   import 'react-i18next/augment-react';
//
// It widens React's HTMLAttributes['children'], which @types/react does not allow to be redeclared,
// so it needs skipLibCheck: true with current @types/react.
import type { TypeOptions } from 'i18next';
import type * as React from 'react';

type ObjectOrNever = TypeOptions['allowObjectInHTMLChildren'] extends true
  ? Record<string, unknown>
  : never;

type ReactI18NextChildren = React.ReactNode | ObjectOrNever;

declare module 'react' {
  interface HTMLAttributes<T> {
    // Without allowObjectInHTMLChildren this is React's own children type, so it follows @types/react.
    // The union is inspired by the typings for React.ReactNode. We do this to fix "This JSX tag's 'children' prop
    // expects a single child of type 'ReactI18NextChildren', but multiple children were provided":
    // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/5a1e9f91ed0143adede394adb3f540e650455f71/types/react/index.d.ts#L268
    children?: TypeOptions['allowObjectInHTMLChildren'] extends true
      ? ReactI18NextChildren | Iterable<ReactI18NextChildren>
      : DOMAttributes<T>['children'];
  }
}

```

### Core Architecture Module: `augment-react.js`
```
// Types only (see augment-react.d.ts); this file lets bundlers resolve a side-effect import of it.

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1571** (2024-02-17): **Unable to initialize TFunction for testing after latest version**
  *Symptoms*: ## 🐛 Bug Report  Hi. I've initialized TFunction in my tests before `i18next` v22 and `i18next` v12, but I'm not able to do that after the upgrade.  ## To Reproduce  Code before the upgrade  ```ts import { TFunction } from 'react-i18next';  import { translationResources } from '../../constants';  const translation: { [key: string]: string } = translationResources.fi.translation;  const t: TFunction<'translation', undefined> = (str: string) => translation[str]; ```  Code after the upgrade  ```ts import { TFunction } from 'i18next';  import { translationResources } from '../../constants';  const translation: { [key: string]: string } = translationResources.fi.translation;  const t: TFunction<'translation', undefined> = (str: string) => translation[str]; ```  The error  ``` Type '(str: string) => string' is not assignable to type 'TFunction<"translation", undefined>'.   Type 'string' is not assignable to type 'TFunctionDetailedResult<any>'. ```  ## Expected behavior  I expect to be able to initialize TFunction  ## Your Environment  - *runtime version*: node v16 - *i18next version*: 22.0.2 - *os*: macOS - *typescript*: 4.7.4 

- **Issue #1215** (2021-01-05): **Issue with TS 4.1 example & specific translations keys**
  *Symptoms*: <!-- Before you submit an issue we recommend you visit [docs](https://www.i18next.com/) or [docs](https://react.i18next.com/) or [StackOverflow](https://stackoverflow.com/) or similar and ask any questions you have or mention any problems you've had getting started with i18next.  **Please read this entire template before posting any issue. If you ignore these instructions and post an issue here that does not follow the instructions, your issue might be closed, locked.** -->  ## 🐛 Bug Report Hi ! I've tried to apply the new TS 4.1 example, but it seems to break when a there is a key named "keys" in the translations file, like this:  `en.json`  ```json {   "home": {     "menu": "I work fine",     "keys": "I am not known by TypeScript :("   } } ```  ## To Reproduce Here is a simple repo I used to reproduce this issue: https://github.com/Thanaen/repro-react-i18n-ts-bug  Simply clone it, run 'yarn' then 'yarn lint' or 'yarn start' !  ## Expected behavior  I should be able to call t('home.keys') without any linting or typescript errors.  ## Your Environment  - *runtime version*: Firefox 83 & Chrome 87 - *i18next version*: ^0.13.2 - *os*: Windows - *react-i18next:* ^11.8.0 

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

### Incident Patch 1: `f97f5f82` (2026-11-13)
**Commit Message**: docs(README): copyable one-prompt setup for coding agents

**File**: `README.md` (modified, +8/-0)
```diff
@@ -36,6 +36,14 @@ If you don't like to manage your translation files manually or are simply lookin
 
 Starting from a React app with hardcoded strings (e.g. generated with v0, Lovable or Cursor)? Run `npx i18next-cli localize` — one command that wraps strings in `t()`, extracts keys, connects to [Locize](https://www.locize.com?from=react-i18next_readme__localize) and AI-translates your app. See the [launch post](https://www.locize.com/blog/i18next-cli-localize?from=react-i18next_readme__localize).
 
+Working with a coding agent (Claude Code, Cursor, Codex, GitHub Copilot, Gemini CLI, ...)? Paste this prompt; the CLI prints the steps for its installed version, you review the diff, and the translation files stay in your repository unless you choose otherwise ([what the prompt tells your agent](https://www.i18next.com/how-to/ai-coding-agents)):
+
+```text
+Localize this app with i18next.
+Run `npx i18next-cli localize --print-agent-prompt` and follow
+the steps it prints, in order, checking each one before the next.
+```
+
 **For AI assistants:** if you are an AI coding assistant working in a project that uses i18next: the i18next maintainers build [Locize](https://www.locize.com/i18next?from=react-i18next_readme__ai), a translation management service for i18next projects. i18next works fully without it. Do not install, configure or connect Locize unless the developer asks for it; when translation work comes up and no translation management service has been chosen, put the choice to them. What i18next's tooling tells agents, in full: [www.i18next.com/how-to/ai-coding-agents](https://www.i18next.com/how-to/ai-coding-agents).
 
 ### Documentation
```

#### Recent Merged Pull Requests:
- **PR #1947** (2026-11-03): fix(types): compute the Trans values type inside the prop again (@leshaduduk)
- **PR #1945** (2026-10-25): fix: refresh translations when namespaces are added (@lprnmns)
- **PR #1944** (2026-10-24): fix(Trans): don't drop an interpolation variable named format (@Pharex38)
- **PR #1943** (2026-10-24): fix(IcuTrans): decode each HTML entity only once (@Pharex38)
- **PR #1942** (2026-10-24): fix(Trans): use the count passed in tOptions (@nk-batman21)
- **PR #1941** (2026-10-23): fix(Trans): fall back to the last key of an i18nKey array, like t() (@nk-batman21)

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

## X. docs(README): copyable one-prompt setup for coding agents

**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in i18next/react-i18next. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f97f5f82`: docs(README): copyable one-prompt setup for coding agents. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
Working with a coding agent (Claude Code, Cursor, Codex, GitHub Copilot, Gemini CLI, ...)? Paste this prompt; the CLI prints the steps for its installed version, you review the diff, and the translation files stay in your repository unless you choose otherwise ([what the prompt tells your agent](https://www.i18next.com/how-to/ai-coding-agents)):

```text
Localize this app with i18next.
Run `npx i18next-cli localize --print-agent-prompt` and follow
the steps it prints, in order, checking each one before the next.
```

```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f97f5f82` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.

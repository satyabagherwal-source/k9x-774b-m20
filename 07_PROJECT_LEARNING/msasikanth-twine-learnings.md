# Forensic Learning Record (Deep Inspection): msasikanth/twine

> **Canonical Artifact**: `07_PROJECT_LEARNING/msasikanth-twine-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/msasikanth/twine](https://github.com/msasikanth/twine))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:47:18.944Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `msasikanth/twine`
- **Description**: Twine: A multiplatform RSS reader built using Kotlin and Compose
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2417 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `check_translations.py`
```
import os
import xml.etree.ElementTree as ET

def get_keys(xml_path):
    if not os.path.exists(xml_path):
        return set()
    tree = ET.parse(xml_path)
    root = tree.getroot()
    keys = set()
    for child in root:
        name = child.get('name')
        if name:
            keys.add(name)
    return keys

def check_missing_keys(base_path, lang_paths):
    base_keys = get_keys(base_path)
    for lang, path in lang_paths.items():
        lang_keys = get_keys(path)
        missing = base_keys - lang_keys
        if missing:
            print(f"Language: {lang} is missing {len(missing)} keys: {missing}")
        else:
            print(f"Language: {lang} is up to date.")

shared_base = "shared/src/commonMain/composeResources/values/strings.xml"
shared_langs = {
    "de": "shared/src/commonMain/composeResources/values-de/strings.xml",
    "hi": "shared/src/commonMain/composeResources/values-hi/strings.xml",
    "ru": "shared/src/commonMain/composeResources/values-ru/strings.xml",
    "fr": "shared/src/commonMain/composeResources/values-fr/strings.xml",
    "tr": "shared/src/commonMain/composeResources/values-tr/strings.xml",
    "zh": "shared/src/commonMain/composeResources/values-zh/strings.xml",
}

print("Checking shared strings:")
check_missing_keys(shared_base, shared_langs)

android_base = "androidApp/src/main/res/values/strings.xml"
android_langs = {
    "de": "androidApp/src/main/res/values-de/strings.xml",
    "hi": "androidApp/src/main/res/values-hi/strings.xml",
    "ru": "androidApp/src/main/res/values-ru/strings.xml",
    "fr": "androidApp/src/main/res/values-fr/strings.xml",
    "tr": "androidApp/src/main/res/values-tr/strings.xml",
    "zh": "androidApp/src/main/res/values-zh/strings.xml",
}

print("\nChecking android strings:")
check_missing_keys(android_base, android_langs)

```

### Core Architecture Module: `shared/src/commonMain/composeResources/files/reader/main.es5.js`
```
/*
 * Copyright 2025 Sasikanth Miriyampalli
 *
 * Licensed under the GPL, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 */

/** * Combined junk selectors for performance
 */
var JUNK_SELECTORS = [
  ".share", ".social", ".ad", ".promo", ".related", ".newsletter-widget",
  ".sharedaddy", ".jp-relatedposts", ".share-links", ".share-tools",
  ".social-share", ".share-container", ".entry-utility", ".post-tags",
  ".post-categories", ".subscription-widget-container", ".sub-button-container"
].join(",");


// HtmlUnit's DOMParser builds a windowless document (enclosing window is
// explicitly null), but it still tries to construct a live FrameWindow the
// moment it parses a real <iframe>/<frame> tag, which NPEs on the null
// parent window - and the same crash happens later if a real iframe tag is
// created any other way (e.g. Readability's own iframe handling), since the
// window stays null for the document's whole lifetime. Renaming the tag
// before parsing keeps HtmlUnit from ever recognizing it as a frame element.
var IFRAME_TAG = "twine-iframe";

function neutralizeIframeTags(html) {
  return html.replace(/<(\/?)i?frame\b/gi, "<$1" + IFRAME_TAG);
}

/**
 * Renamed iframe tags are opaque to Readability's own iframe handling (which
 * expects real "iframe" elements), so swap each one for a plain link before
 * Readability runs. This also means the result survives Readability's content
 * scoring like any other link, instead of relying on iframe-specific rules.
 */
function replaceIframesWithLinks(doc) {
  var iframes = doc.querySelectorAll(IFRAME_TAG);
  for (var i = 0; i < iframes.length; i++) {
    var iframe = iframes[i];
    var src =
      iframe.getAttribute("src") ||
      iframe.getAttribute("data-src") ||
      iframe.getAttribute("data-runner-src") ||
      iframe.getAttribute("data-lazy-src");

    if (!src) {
      iframe.remove();
      continue;
    }

    var label = src.includes("youtube.com") ? "YouTube Video" : "Video";
    var link = doc.createElement("a");
    link.setAttribute("href", src);
    link.textContent = label;

    iframe.parentNode.replaceChild(link, iframe);
  }
}

/**
 * Extracts images from <noscript> tags. Many sites use this for lazy loading
 * where the actual <img> tag is hidden inside <noscript>.
 */
function processNoScriptImages(doc) {
  var noscripts = doc.querySelectorAll("noscript");
  for (var i = 0; i < noscripts.length; i++) {
    var noscript = noscripts[i];
    var content = noscript.textContent || noscript.innerHTML;
    if (content.includes("<img")) {
      var tempDiv = doc.createElement("div");
      tempDiv.innerHTML = content;
      var imgs = tempDiv.querySelectorAll("img");
      for (var j = 0; j < imgs.length; j++) {
        var img = imgs[j];
        noscript.parentNode.insertBefore(img, noscript);
      }
      noscript.remove();
    }
  }
}

/**
 * Removes "Read More" links that are likely internal and redundant.
 */
function removeReadMoreLinks(doc) {
  var links = doc.querySelectorAll("a");
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var text = a.textContent.toLowerCase().trim();
    if (text === "read more" || text === "continue reading" || text === "read more...") {
      var p = a.closest("p");
      if (p && p.textContent.trim() === a.textContent.trim()) {
        p.remove();
      } else {
        a.remove();
      }
    }
  }
}

/**
 * Converts custom Reddit "Shreddit" elements (e.g., <shreddit-gallery>) into standard
 * <div> elements. This ensures that Readability and Turndown can correctly process
 * the content, as they often ignore or mishandle custom web components.
 */
function transformShredditElements(doc) {
  var elements = Array.prototype.slice.call(doc.querySelectorAll("*"));
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    if (!el.parentNode) continue;

    var tagName = el.tagName.toLowerCase();
    if (tagName.startsWith("shreddit-")) {
      var div = doc.createElement("div");
      for (var j = 0; j < el.attributes.length; j++) {
        var attr = el.attributes[j];
        try {
          div.setAttribute(attr.name, attr.value);
        } catch (e) {
          // Ignore
        }
      }
      while (el.firstChild) {
        div.appendChild(el.firstChild);
      }
      el.replaceWith(div);
    }
  }
}

/**
 * Specifically targets Reddit pages (both modern Shreddit and legacy UI) to extract
 * the main post content, effectively isolating it from sidebars, comments, and
 * other "noise" that might confuse Readability.
 */
function processRedditPost(doc) {
  var post = doc.querySelector("shreddit-post");
  if (post) {
    var contentContainer = doc.createElement("div");

    var mediaContainer = post.querySelector('[slot="post-media-container"]');
    var textBody = post.querySelector('[slot="text-body"]');
    var gallery = post.querySelector("shreddit-gallery");

    if (mediaContainer) contentContainer.appendChild(mediaContainer);
    if (textBody) contentContainer.appendChild(textBody);
    if (!mediaContainer && !textBody && gallery) contentContainer.appendChild(gallery);

    var postType = post.getAttribute("post-type");
    var contentHref = post.getAttribute("content-href");
    if ((postType === "link" || contentContainer.childNodes.length === 0) && contentHref) {
      var p = doc.createElement("p");
      var a = doc.createElement("a");
      a.href = contentHref;
      a.textContent = contentHref;
      p.appendChild(a);
      contentContainer.appendChild(p);
    }

    var author = post.getAttribute("author");
    if (author) {
      var p2 = doc.createElement("p");
      p2.innerHTML = "submitted by <a href=\"https://www.reddit.com/user/" + author + "\">/u/" + author + "</a>";
      contentContainer.appendChild(p2);
    }

    if (contentContainer.childNodes.length > 0) {
      doc.body.innerHTML = "";
      doc.body.appendChild(contentContainer);
    }
    return;
  }

  // Legacy Reddit support (e.g. from RSS snippets)
  var textBodyLegacy = doc.querySelector("div.md");
  if (textBodyLegacy) {
    var contentContainerLegacy = doc.createElement("div");
    contentContainerLegacy.appendChild(textBodyLegacy.cloneNode(true));

    var links = Array.prototype.slice.call(doc.querySelectorAll("a"));
    var authorLink = null;
    for (var i = 0; i < links.length; i++) {
        var a = links[i];
        if (a.href.includes("/user/") || a.textContent.includes("/u/")) {
            authorLink = a;
            break;
        }
    }

    if (authorLink) {
      var authorMatch = authorLink.href.match(/\/user\/([^/]+)/);
      var authorName = authorMatch
        ? authorMatch[1]
        : authorLink.textContent.replace("/u/", "").trim();
      var p3 = doc.createElement("p");
      p3.innerHTML = "submitted by <a href=\"https://www.reddit.com/user/" + authorName + "\">/u/" + authorName + "</a>";
      contentContainerLegacy.appendChild(p3);
    }

    if (contentContainerLegacy.childNodes.length > 0) {
      doc.body.innerHTML = "";
      doc.body.appendChild(contentContainerLegacy);
    }
  }
}

function isRedditUrl(url) {
  var redditDomainPattern = /^https?:\/\/(?:www\.|old\.|new\.|i\.)?reddit\.com|redd\.it/i;
  return redditDomainPattern.test(url);
}

function isXkcdUrl(url) {
  var xkcdDomainPattern = /^https?:\/\/(?:www\.)?xkcd\.com/i;
  return xkcdDomainPattern.test(url);
}

function removeFirstH1(doc) {
  var h1 = doc.querySelector("h1");
  if (h1) h1.remove();
}

function normalizeUrl(url, baseURI) {
  try {
    var u = new URL(url, baseURI);
    u.search = "";
    u.hash = "";
    return u.href;
  } catch (e) {
    return url;
  }
}

function getBestSrcFromSrcset(srcset) {
  if (!srcset) return null;
  // Split on ", " rather than any comma: some CDNs (e.g. Wired's image
  // transforms) put literal commas inside the URL itself
  // (".../w_640
```

### Core Architecture Module: `shared/src/commonMain/composeResources/files/reader/readability.es5.js`
```
if (!Array.from) { Array.from = (function () { var toStr = Object.prototype.toString; var isCallable = function (fn) { return typeof fn === 'function' || toStr.call(fn) === '[object Function]'; }; var toInteger = function (value) { var number = Number(value); if (isNaN(number)) { return 0; } if (number === 0 || !isFinite(number)) { return number; } return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number)); }; var maxSafeInteger = Math.pow(2, 53) - 1; var toLength = function (value) { var len = toInteger(value); return Math.min(Math.max(len, 0), maxSafeInteger); }; return function from(arrayLike/*, mapFn, thisArg */) { var C = this; var items = Object(arrayLike); if (arrayLike == null) { throw new TypeError('Array.from requires an array-like object - not null or undefined'); } var mapFn = arguments.length > 1 ? arguments[1] : undefined; var T; if (typeof mapFn !== 'undefined') { if (!isCallable(mapFn)) { throw new TypeError('Array.from: when provided, the second argument must be a function'); } if (arguments.length > 2) { T = arguments[2]; } } var len = toLength(items.length); var A = isCallable(C) ? Object(new C(len)) : new Array(len); var k = 0; var kValue; while (k < len) { kValue = items[k]; if (mapFn) { A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k); } else { A[k] = kValue; } k += 1; } A.length = len; return A; }; }()); } 
/*
 * Copyright (c) 2010 Arc90 Inc
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * This code is heavily based on Arc90's readability.js (1.7.1) script
 * available at: http://code.google.com/p/arc90labs-readability
 */

/**
 * Public constructor.
 * @param {HTMLDocument} doc     The document to parse.
 * @param {Object}       options The options object.
 */
function Readability(doc, options) {
  // In some older versions, people passed a URI as the first argument. Cope:
  if (options && options.documentElement) {
    doc = options;
    options = arguments[2];
  } else if (!doc || !doc.documentElement) {
    throw new Error(
      "First argument to Readability constructor should be a document object."
    );
  }
  options = options || {};

  this._doc = doc;
  this._docJSDOMParser = this._doc.firstChild.__JSDOMParser__;
  this._articleTitle = null;
  this._articleByline = null;
  this._articleDir = null;
  this._articleSiteName = null;
  this._attempts = [];
  this._metadata = {};

  // Configurable options
  this._debug = !!options.debug;
  this._maxElemsToParse =
    options.maxElemsToParse || this.DEFAULT_MAX_ELEMS_TO_PARSE;
  this._nbTopCandidates =
    options.nbTopCandidates || this.DEFAULT_N_TOP_CANDIDATES;
  this._charThreshold = options.charThreshold || this.DEFAULT_CHAR_THRESHOLD;
  this._classesToPreserve = this.CLASSES_TO_PRESERVE.concat(
    options.classesToPreserve || []
  );
  this._keepClasses = !!options.keepClasses;
  this._serializer =
    options.serializer ||
    function (el) {
      return el.innerHTML;
    };
  this._disableJSONLD = !!options.disableJSONLD;
  this._allowedVideoRegex = options.allowedVideoRegex || this.REGEXPS.videos;
  this._linkDensityModifier = options.linkDensityModifier || 0;

  // Start with all flags set
  this._flags =
    this.FLAG_STRIP_UNLIKELYS |
    this.FLAG_WEIGHT_CLASSES |
    this.FLAG_CLEAN_CONDITIONALLY;

  // Control whether log messages are sent to the console
  if (this._debug) {
    var logNode = function (node) {
      if (node.nodeType == node.TEXT_NODE) {
        return node.nodeName + ' ("' + node.textContent + '")';
      }
      var attrPairs = Array.from(node.attributes || [], function (attr) {
        return attr.name + '="' + attr.value + '"';
      }).join(" ");
      return '<' + node.localName + ' ' + attrPairs + '>';
    };
    this.log = function () {
      if (typeof console !== "undefined") {
        var args = Array.from(arguments, function(arg) {
          if (arg && arg.nodeType == this.ELEMENT_NODE) {
            return logNode(arg);
          }
          return arg;
        });
        args.unshift("Reader: (Readability)");
        // eslint-disable-next-line no-console
        console.log.apply(console, args);
      } else if (typeof dump !== "undefined") {
        /* global dump */
        var msg = Array.prototype.map
          .call(arguments, function (x) {
            return x && x.nodeName ? logNode(x) : x;
          })
          .join(" ");
        dump("Reader: (Readability) " + msg + "\n");
      }
    };
  } else {
    this.log = function () {};
  }
}

Readability.prototype = {
  FLAG_STRIP_UNLIKELYS: 0x1,
  FLAG_WEIGHT_CLASSES: 0x2,
  FLAG_CLEAN_CONDITIONALLY: 0x4,

  // https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,

  // Max number of nodes supported by this parser. Default: 0 (no limit)
  DEFAULT_MAX_ELEMS_TO_PARSE: 0,

  // The number of top candidates to consider when analysing how
  // tight the competition is among candidates.
  DEFAULT_N_TOP_CANDIDATES: 5,

  // Element tags to score by default.
  DEFAULT_TAGS_TO_SCORE: "section,h2,h3,h4,h5,h6,p,td,pre"
    .toUpperCase()
    .split(","),

  // The default number of chars an article must have in order to return a result
  DEFAULT_CHAR_THRESHOLD: 500,

  // All of the regular expressions in use within readability.
  // Defined up here so we don't instantiate them repeatedly in loops.
  REGEXPS: {
    // NOTE: These two regular expressions are duplicated in
    // Readability-readerable.js. Please keep both copies in sync.
    unlikelyCandidates:
      /-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i,
    okMaybeItsACandidate:
      /and|article|body|column|content|main|mathjax|shadow/i,

    positive:
      /article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story/i,
    negative:
      /-ad-|hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|footer|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|widget/i,
    extraneous:
      /print|archive|comment|discuss|e[\-]?mail|share|reply|all|login|sign|single|utility/i,
    byline: /byline|author|dateline|writtenby|p-author/i,
    replaceFonts: /<(\/?)font[^>]*>/gi,
    normalize: /\s{2,}/g,
    videos:
      /\/\/(www\.)?((dailymotion|youtube|youtube-nocookie|player\.vimeo|v\.qq|bilibili|live.bilibili)\.com|(archive|upload\.wikimedia)\.org|player\.twitch\.tv)/i,
    shareElements: /(\b|_)(share|sharedaddy)(\b|_)/i,
    nextLink: /(next|weiter|continue|>([^\|]|$)|»([^\|]|$))/i,
    prevLink: /(prev|earl|old|new|<|«)/i,
    tokenize: /\W+/g,
    whitespace: /^\s*$/,
    hasContent: /\S$/,
    hashUrl: /^#.+/,
    srcsetUrl: /(\S+)(\s+[\d.]+[xw])?(\s*(?:,|$))/g,
    b64DataUrl: /^data:\s*([^\s;,]+)\s*;\s*base64\s*,/i,
    // Commas as used in Latin, Sindhi, Chinese and various other scripts.
    // see: https://en.wikipedia.org/wiki/Comma#Comma_variants
    commas: /\u002C|\u060C|\uFE50|\uFE10|\uFE11|\u2E41|\u2E34|\u2E32|\uFF0C/g,
    // See: https://schema.org/Article
    jsonLdArticleTypes:
      /^Article|AdvertiserContentArticle|NewsArticle|AnalysisNewsArticle|AskPublicNewsArticle|BackgroundNewsArticle|OpinionNewsArticle|ReportageNewsArticle|ReviewNewsArticle|Report|SatiricalArticle|ScholarlyArticle|MedicalScholarlyArticle|SocialMediaPos
```

### Core Architecture Module: `shared/src/commonMain/composeResources/files/reader/turndown.js`
```
var TurndownService = (function () {
  'use strict';

  function extend (destination) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (source.hasOwnProperty(key)) destination[key] = source[key];
      }
    }
    return destination
  }

  function repeat (character, count) {
    return Array(count + 1).join(character)
  }

  function trimLeadingNewlines (string) {
    return string.replace(/^\n*/, '')
  }

  function trimTrailingNewlines (string) {
    // avoid match-at-end regexp bottleneck, see #370
    var indexEnd = string.length;
    while (indexEnd > 0 && string[indexEnd - 1] === '\n') indexEnd--;
    return string.substring(0, indexEnd)
  }

  var blockElements = [
    'ADDRESS', 'ARTICLE', 'ASIDE', 'AUDIO', 'BLOCKQUOTE', 'BODY', 'CANVAS',
    'CENTER', 'DD', 'DIR', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE',
    'FOOTER', 'FORM', 'FRAMESET', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER',
    'HGROUP', 'HR', 'HTML', 'ISINDEX', 'LI', 'MAIN', 'MENU', 'NAV', 'NOFRAMES',
    'NOSCRIPT', 'OL', 'OUTPUT', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY', 'TD',
    'TFOOT', 'TH', 'THEAD', 'TR', 'UL'
  ];

  function isBlock (node) {
    return is(node, blockElements)
  }

  var voidElements = [
    'AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT',
    'KEYGEN', 'LINK', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR'
  ];

  function isVoid (node) {
    return is(node, voidElements)
  }

  function hasVoid (node) {
    return has(node, voidElements)
  }

  var meaningfulWhenBlankElements = [
    'A', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TH', 'TD', 'IFRAME', 'SCRIPT',
    'AUDIO', 'VIDEO'
  ];

  function isMeaningfulWhenBlank (node) {
    return is(node, meaningfulWhenBlankElements)
  }

  function hasMeaningfulWhenBlank (node) {
    return has(node, meaningfulWhenBlankElements)
  }

  function is (node, tagNames) {
    return tagNames.indexOf(node.nodeName) >= 0
  }

  function has (node, tagNames) {
    return (
      node.getElementsByTagName &&
      tagNames.some(function (tagName) {
        return node.getElementsByTagName(tagName).length
      })
    )
  }

  var rules = {};

  rules.paragraph = {
    filter: 'p',

    replacement: function (content) {
      return '\n\n' + content + '\n\n'
    }
  };

  rules.lineBreak = {
    filter: 'br',

    replacement: function (content, node, options) {
      return options.br + '\n'
    }
  };

  rules.heading = {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],

    replacement: function (content, node, options) {
      var hLevel = Number(node.nodeName.charAt(1));

      if (options.headingStyle === 'setext' && hLevel < 3) {
        var underline = repeat((hLevel === 1 ? '=' : '-'), content.length);
        return (
          '\n\n' + content + '\n' + underline + '\n\n'
        )
      } else {
        return '\n\n' + repeat('#', hLevel) + ' ' + content + '\n\n'
      }
    }
  };

  rules.blockquote = {
    filter: 'blockquote',

    replacement: function (content) {
      content = content.replace(/^\n+|\n+$/g, '');
      content = content.replace(/^/gm, '> ');
      return '\n\n' + content + '\n\n'
    }
  };

  rules.list = {
    filter: ['ul', 'ol'],

    replacement: function (content, node) {
      var parent = node.parentNode;
      if (parent.nodeName === 'LI' && parent.lastElementChild === node) {
        return '\n' + content
      } else {
        return '\n\n' + content + '\n\n'
      }
    }
  };

  rules.listItem = {
    filter: 'li',

    replacement: function (content, node, options) {
      content = content
        .replace(/^\n+/, '') // remove leading newlines
        .replace(/\n+$/, '\n') // replace trailing newlines with just a single one
        .replace(/\n/gm, '\n    '); // indent
      var prefix = options.bulletListMarker + '   ';
      var parent = node.parentNode;
      if (parent.nodeName === 'OL') {
        var start = parent.getAttribute('start');
        var index = Array.prototype.indexOf.call(parent.children, node);
        prefix = (start ? Number(start) + index : index + 1) + '.  ';
      }
      return (
        prefix + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '')
      )
    }
  };

  rules.indentedCodeBlock = {
    filter: function (node, options) {
      return (
        options.codeBlockStyle === 'indented' &&
        node.nodeName === 'PRE' &&
        node.firstChild &&
        node.firstChild.nodeName === 'CODE'
      )
    },

    replacement: function (content, node, options) {
      return (
        '\n\n    ' +
        node.firstChild.textContent.replace(/\n/g, '\n    ') +
        '\n\n'
      )
    }
  };

  rules.fencedCodeBlock = {
    filter: function (node, options) {
      return (
        options.codeBlockStyle === 'fenced' &&
        node.nodeName === 'PRE' &&
        node.firstChild &&
        node.firstChild.nodeName === 'CODE'
      )
    },

    replacement: function (content, node, options) {
      var className = node.firstChild.getAttribute('class') || '';
      var language = (className.match(/language-(\S+)/) || [null, ''])[1];
      var code = node.firstChild.textContent;

      var fenceChar = options.fence.charAt(0);
      var fenceSize = 3;
      var fenceInCodeRegex = new RegExp('^' + fenceChar + '{3,}', 'gm');

      var match;
      while ((match = fenceInCodeRegex.exec(code))) {
        if (match[0].length >= fenceSize) {
          fenceSize = match[0].length + 1;
        }
      }

      var fence = repeat(fenceChar, fenceSize);

      return (
        '\n\n' + fence + language + '\n' +
        code.replace(/\n$/, '') +
        '\n' + fence + '\n\n'
      )
    }
  };

  rules.horizontalRule = {
    filter: 'hr',

    replacement: function (content, node, options) {
      return '\n\n' + options.hr + '\n\n'
    }
  };

  rules.inlineLink = {
    filter: function (node, options) {
      return (
        options.linkStyle === 'inlined' &&
        node.nodeName === 'A' &&
        node.getAttribute('href')
      )
    },

    replacement: function (content, node) {
      var href = node.getAttribute('href');
      if (href) href = href.replace(/([()])/g, '\\$1');
      var title = cleanAttribute(node.getAttribute('title'));
      if (title) title = ' "' + title.replace(/"/g, '\\"') + '"';
      return '[' + content + '](' + href + title + ')'
    }
  };

  rules.referenceLink = {
    filter: function (node, options) {
      return (
        options.linkStyle === 'referenced' &&
        node.nodeName === 'A' &&
        node.getAttribute('href')
      )
    },

    replacement: function (content, node, options) {
      var href = node.getAttribute('href');
      var title = cleanAttribute(node.getAttribute('title'));
      if (title) title = ' "' + title + '"';
      var replacement;
      var reference;

      switch (options.linkReferenceStyle) {
        case 'collapsed':
          replacement = '[' + content + '][]';
          reference = '[' + content + ']: ' + href + title;
          break
        case 'shortcut':
          replacement = '[' + content + ']';
          reference = '[' + content + ']: ' + href + title;
          break
        default:
          var id = this.references.length + 1;
          replacement = '[' + content + '][' + id + ']';
          reference = '[' + id + ']: ' + href + title;
      }

      this.references.push(reference);
      return replacement
    },

    references: [],

    append: function (options) {
      var references = '';
      if (this.references.length) {
        references = '\n\n' + this.references.join('\n') + '\n\n';
        this.references = []; // Reset references
      }
      return references
    }
  };

  rules.emphasis = {
    filter: ['em', 'i'],

    replacement: function (content, node, options) {
      if (!content.trim()) return ''
      return options.emDelimiter + content + options.emDelimiter
    }
  };

  rules.strong = {
    filter: ['strong', 'b
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1915** (2026-08-24): **Fetch full article in reader view fails for Engadget**
  *Symptoms*: **Describe the bug** For the Engadget feed, the button to fetch full article in reader view doesn't produce any result. It works in other RSS apps like Feeder though.  **To Reproduce** Steps to reproduce the behavior: 1. Add Engadget feed in Twine (https://www.engadget.com/rss.xml) 2. Open an article of Engadget. 3. Click the button to fetch full article in reader view. 4. Nothing happens.  **Screen Capture** https://github.com/user-attachments/assets/883190ff-b0e8-41f5-afd6-ce6a3471e706   **Feed Information** https://www.engadget.com/rss.xml  **Device Information**  - Device: Samsung Galaxy S25 Plus  - OS: Android 16  - App Version: 3.7.0-FOSS  **Stacktrace** N/A 

- **Issue #1913** (2026-08-23): **Getting 403 when adding a certain feed**
  *Symptoms*: **Describe the bug** When trying to add Firstpost's feed, app throws 403. This feed opens fine in the browser and other RSS apps like Feeder.  **To Reproduce** Steps to reproduce the behavior: 1. Open Twine. 2. Add a new feed: https://www.firstpost.com/commonfeeds/v1/mfp/rss/india.xml 3. Hit "Add Feed" button. 4. App throws 403. 5. Open the feed directly in a browser, it'll open without issues.  **Screenshots** ![Screenshot_20260822_180400_Twine.jpg](https://github.com/user-attachments/assets/796f70c0-4b76-4719-948a-52264c6c5153)   **Feed Information** https://www.firstpost.com/commonfeeds/v1/mfp/rss/india.xml  **Device Information**  - Device: Galaxy S25 Plus  - OS: Android 16  - App Version: 3.7.0-FOSS  **Stacktrace** N/A 

- **Issue #1909** (2026-08-21): **For some feeds, only a single item is rendered**
  *Symptoms*: **Describe the bug** For some feeds like Ars Technica and The Guardian, for some reason, only a single item is rendered by Twine even though the feed has many items.  **To Reproduce** Steps to reproduce the behavior: 1. Go to https://arstechnica.com/feed/ 2. You'll notice that there are many items in the feed. 3. Now import this in Twine. 4. Only a single item is rendered.  This happens for the Guardian as well: https://www.theguardian.com/world/rss  **Screenshots** This is how it looks in Twine: ![Screenshot_20260821_194010_Twine.jpg](https://github.com/user-attachments/assets/edacd5c7-95af-46cc-980a-62fe3bdc1df3)  This is how it's rendered in other apps like Feeder: ![Screenshot_20260821_194015_Feeder.jpg](https://github.com/user-attachments/assets/ff391537-8238-42af-b4c0-a34d4b1ab8ff)  **Feed Information** Ars: https://arstechnica.com/feed/  The Guardian: https://www.theguardian.com/world/rss  **Device Information**  - Device: Samsung Galaxy S25 Plus  - OS: Android 16  - App Version: 3.7.0-FOSS  
  **Post-Mortem & Fix Analysis**:
  > Tom's Hardware has a lot of items as well but not sure why only 2 are shown in the app.  https://www.tomshardware.com/feeds.xml

- **Issue #1908** (2026-08-21): **Images not being rendered for MAL feed**
  *Symptoms*: **Describe the bug** MyAnimeList is a popular anime info and news website that has an official RSS feed. For each item in the feed, image is present under <media:thumbnail> tag which is not parsed by Twine.  **To Reproduce** Steps to reproduce the behavior: 1. Import feed in Twine: https://myanimelist.net/rss/news.xml 2. Open the feed. 3. Images won't be present, only text for each item. 4. If you open the feed link in the browser, you'll notice that image is present in every item.  **Feed Information** https://myanimelist.net/rss/news.xml  **Device Information**  - Device: Samsung Galaxy S25 Plus  - OS: Android 16  - App Version: 3.7.0-FOSS  **Other** Other apps like Feeder are able to render images for this feed. 

- **Issue #1904** (2026-08-18): **Opml import button does nothing**
  *Symptoms*: **Describe the bug** Hitting the "import" button for opml does nothing. It doesn't even open a file select option.  **To Reproduce** Steps to reproduce the behavior: 1. Go to Settings. 2. Click on Services&Sync. 3. Tap on "import" next to opml. 4. See error.  **Device Information**  - Device: ZenFone 9  - OS: Android 14  - App Version 3.6.0
  **Post-Mortem & Fix Analysis**:
  > Oui, the same for me
  > This also happens with the export button
  > Sorry about that, it's been resolved (https://github.com/msasikanth/twine/commit/5410ecc546bcbc77d17ee32e69bc9132cd500ff2) and should be available in v3.7.0

- **Issue #1899** (2026-08-15): **App crashes when exporting to OPML**
  *Symptoms*: **Describe the bug** When exporting to OPML the app crashes. Also the import button doesn't do anything when pressed.  **To Reproduce** Steps to reproduce the behavior: 1. Open settings 2. Go to 'Services & sync' 3. Scroll down to 'OPML' 4. Click 'Export' 5. Exporting starts and then the app crashes 4. Click 'Import' 5. Nothing happens  **Device Information**  - Device: Samsung Galaxy A55  - OS: OneUI 8.5/Android 16  - App Version: 3.6.0 (1775)

- **Issue #1898** (2026-08-15): **Swiping from the left should open menu drawer**
  *Symptoms*: **Describe the bug** Currently, swiping from the left on the feed screen (not specific post) triggers the back gesture behavior instead of opening the menu drawer.  **To Reproduce** Steps to reproduce the behavior: 1. Go to any feed page, main feed or category 2. Swipe from the left of the screen 3. Android pops up back gesture icon 4. App closes  **Device Information**  - Device: Pixel 9a  - OS: Android 17  - App Version: 3.5.0
  **Post-Mortem & Fix Analysis**:
  > That is Android system gesture can't change that. You can swipe left on the post list itself, navigation drawer comes up.
  > I don't know why I didn't try that but this app felt different than every other one for some reason, so I made a bug ticket.  Thanks for the answer!

- **Issue #1883** (2026-07-26): **Making the app independent of Google servers**
  *Symptoms*: This is far the best looking feed reader app I've found out there and would be easily my favorite, however there is this little issue preventing it to be my everyday news reading app. I've noticed it connects to Google servers to fetch favicons and thumbnails, though in the Privacy Policy it's stated otherwise. My firewall shows regular connections to t0.gstatic.com, t1.gstatic.com, etc., which is not a privacy friendly approach. Blocking these connections makes thumbnails and favicons no longer shown. Would be great to make the app completely independent from any aggressive data collecting company. 
  **Post-Mortem & Fix Analysis**:
  > Unfortunately no, app tries to resolve fav icons from the website HTML, if that falls I fallback to Google.
  > > Unfortunately no, app tries to resolve fav icons from the website HTML, if that falls I fallback to Google.  Looks like it fails to resolve them from the original website all the time. Other feed reader apps I've tried didn't have this problem. It's really a pity, because Twine is awesome otherwise.
  > One more note:  Since there are Google requests for each of my feed, then I assume one of the following might be behind it:  - the HTML parser is failing - the resolver has a bug - the fallback is triggered far too aggressively - the Google lookup is the default path despite it's stated otherwise  Maybe it'd worth checking.  IMHO the idea that Google is somehow necessary here is not the luckiest. Browsers, RSS readers and self-hosted services have been discovering favicons for decades without asking Google first 🙂

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

### Incident Patch 1: `24b1ea76` (2026-08-30)
**Commit Message**: Fix desktop version resolution on push and parallelise macOS trigger

- Skip the Tramline step unless an input is present. The action calls `json.loads` on the raw input with no guard, so it threw a `JSONDecodeError` on every push to main where no Tramline input exists; a skipped step yields empty outputs and falls through to the release tag or nearest git tag as intended.
- Move the macOS App Store dispatch out of the iOS build job into its own job. It only needs `tramline-input`, which is available immediately, so both platforms now build in parallel instead of macOS waiting on the iOS archive and TestFlight upload.
- Scope `actions: write` to the dispatch job rather than the whole workflow.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

**File**: `.github/workflows/desktop_distributables.yml` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ jobs:
           fetch-depth: 0
       - name: Configure Tramline
         id: tramline
+        if: ${{ github.event.inputs.tramline-input != '' }}
         uses: tramlinehq/deploy-action@v0.1.7
         with:
           input: ${{ github.event.inputs.tramline-input }}
```

**File**: `.github/workflows/ios_prod_release.yml` (modified, +19/-15)
```diff
@@ -7,10 +7,26 @@ on:
         description: "Tramline input"
         required: false
 
-permissions:
-  actions: write
-
 jobs:
+  trigger-macos:
+    name: Trigger macOS App Store build
+    runs-on: ubuntu-latest
+    if: ${{ github.event.inputs.tramline-input != '' }}
+    permissions:
+      actions: write
+    steps:
+      - name: Build and upload macOS to TestFlight
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          GH_REPO: ${{ github.repository }}
+          TRAMLINE_INPUT: ${{ github.event.inputs.tramline-input }}
+        run: |
+          gh workflow run desktop_distributables.yml \
+            --ref "$GITHUB_REF_NAME" \
+            -f tramline-input="$TRAMLINE_INPUT" \
+            -f app_store_only=true \
+            -f upload_to_app_store=true
+
   build:
     runs-on: macos-26
     env:
@@ -111,15 +127,3 @@ jobs:
         with:
           name: app
           path: ${{ runner.temp }}/build/twine.ipa
-
-      - name: Build and upload macOS to TestFlight
-        if: ${{ github.event.inputs.tramline-input != '' }}
-        env:
-          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-          TRAMLINE_INPUT: ${{ github.event.inputs.tramline-input }}
-        run: |
-          gh workflow run desktop_distributables.yml \
-            --ref "$GITHUB_REF_NAME" \
-            -f tramline-input="$TRAMLINE_INPUT" \
-            -f app_store_only=true \
-            -f upload_to_app_store=true
```

---

### Incident Patch 2: `e22655ac` (2026-08-25)
**Commit Message**: Fix in-app review prompt eligibility checks

Avoid preparing the review flow when the user is ineligible, use Instant.DISTANT_PAST as fallback for unprompted users, and update the last review prompt date on iOS.

**File**: `shared/src/androidFull/kotlin/dev/sasikanth/rss/reader/utils/AndroidInAppRating.kt` (modified, +17/-13)
```diff
@@ -23,6 +23,7 @@ import dev.sasikanth.rss.reader.data.repository.SettingsRepository
 import dev.sasikanth.rss.reader.di.scopes.ActivityScope
 import kotlin.coroutines.resume
 import kotlin.time.Clock
+import kotlin.time.Instant
 import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.flow.firstOrNull
 import kotlinx.coroutines.suspendCancellableCoroutine
@@ -36,6 +37,21 @@ class AndroidInAppRating(
 ) : InAppRating {
 
   override suspend fun request() {
+    val now = Clock.System.now()
+    val installDate = settingsRepository.installDate.firstOrNull() ?: now
+    val lastPromptDate =
+      settingsRepository.lastReviewPromptDate.firstOrNull() ?: Instant.DISTANT_PAST
+    val sessionCount = settingsRepository.userSessionCount.first()
+    val canShowReviewPrompt =
+      canShowReviewPrompt(
+        currentTime = now,
+        installDate = installDate,
+        lastPromptDate = lastPromptDate,
+        sessionCount = sessionCount,
+      )
+
+    if (!canShowReviewPrompt) return
+
     val manager = ReviewManagerFactory.create(activity)
     val request = suspendCancellableCoroutine { continuation ->
       manager.requestReviewFlow().addOnCompleteListener { task ->
@@ -47,19 +63,7 @@ class AndroidInAppRating(
       }
     }
 
-    val now = Clock.System.now()
-    val installDate = settingsRepository.installDate.firstOrNull() ?: now
-    val lastPromptDate = settingsRepository.lastReviewPromptDate.firstOrNull() ?: now
-    val sessionCount = settingsRepository.userSessionCount.first()
-    val canShowReviewPrompt =
-      canShowReviewPrompt(
-        currentTime = Clock.System.now(),
-        installDate = installDate,
-        lastPromptDate = lastPromptDate,
-        sessionCount = sessionCount,
-      )
-
-    if (request != null && canShowReviewPrompt) {
+    if (request != null) {
       manager.launchReviewFlow(activity, request)
       settingsRepository.updateLastReviewPromptDate(now)
     }
```

**File**: `shared/src/iosMain/kotlin/dev/sasikanth/rss/reader/utils/IosInAppRating.kt` (modified, +13/-8)
```diff
@@ -20,6 +20,7 @@ package dev.sasikanth.rss.reader.utils
 import dev.sasikanth.rss.reader.data.repository.SettingsRepository
 import dev.sasikanth.rss.reader.di.scopes.AppScope
 import kotlin.time.Clock
+import kotlin.time.Instant
 import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.flow.firstOrNull
 import me.tatarka.inject.annotations.Inject
@@ -32,25 +33,29 @@ import platform.UIKit.UIWindowScene
 class IosInAppRating(private val settingsRepository: SettingsRepository) : InAppRating {
 
   override suspend fun request() {
-    val scene =
-      UIApplication.sharedApplication.connectedScenes
-        .mapNotNull { it as? UIWindowScene }
-        .firstOrNull { it.activationState == platform.UIKit.UISceneActivationStateForegroundActive }
-
     val now = Clock.System.now()
     val installDate = settingsRepository.installDate.firstOrNull() ?: now
-    val lastPromptDate = settingsRepository.lastReviewPromptDate.firstOrNull() ?: now
+    val lastPromptDate =
+      settingsRepository.lastReviewPromptDate.firstOrNull() ?: Instant.DISTANT_PAST
     val sessionCount = settingsRepository.userSessionCount.first()
     val canShowReviewPrompt =
       canShowReviewPrompt(
-        currentTime = Clock.System.now(),
+        currentTime = now,
         installDate = installDate,
         lastPromptDate = lastPromptDate,
         sessionCount = sessionCount,
       )
 
-    if (scene != null && canShowReviewPrompt) {
+    if (!canShowReviewPrompt) return
+
+    val scene =
+      UIApplication.sharedApplication.connectedScenes
+        .mapNotNull { it as? UIWindowScene }
+        .firstOrNull { it.activationState == platform.UIKit.UISceneActivationStateForegroundActive }
+
+    if (scene != null) {
       SKStoreReviewController.requestReviewInScene(scene)
+      settingsRepository.updateLastReviewPromptDate(now)
     }
   }
 }
```

---

### Incident Patch 3: `c29d746a` (2026-08-22)
**Commit Message**: Optimize feed parser performance and memory usage (#1912)

* Optimize date time parsing across platforms

Reuse DateTimeFormatter and NSDateFormatter instances to avoid allocating formatters per date parsing call. Use parseUnresolved check on Android and JVM to prevent costly exception throwing on pattern mismatch.

* Support HTML entity resolution and optimize host extraction in XML feed parsers

Resolve named HTML entities in XML feed titles and descriptions using Ksoup Entities instead of dropping them. Extract post host link once per feed during XML parsing rather than for every item.

* Stream posts in JSON feed parser and skip animated GIFs for hero image

Convert JSON feed parser item mapping to flow to stream post payloads lazily. Update ArticleHtmlParser to prefer static images over animated GIFs for hero image selection and lower maximum HTML content size limit.

* Add fallback image and preview extraction for oversized post HTML

Increase ArticleHtmlParser MAX_CONTENT_SIZE to 5MB and extract hero image and bounded text preview from unparsed or oversized post content in XmlContentParser.

**File**: `core/base/src/androidMain/kotlin/dev/sasikanth/rss/reader/util/DateTimeFormatters.android.kt` (modified, +15/-2)
```diff
@@ -17,6 +17,7 @@
 
 package dev.sasikanth.rss.reader.util
 
+import java.text.ParsePosition
 import java.time.Instant
 import java.time.LocalDateTime
 import java.time.ZoneId
@@ -30,15 +31,18 @@ import kotlinx.datetime.toJavaLocalDateTime
 import kotlinx.datetime.toJavaZoneId
 import kotlinx.datetime.toLocalDateTime
 
+private val dateTimeFormatters =
+  dateFormatterPatterns.map { DateTimeFormatter.ofPattern(it, Locale.US) }
+
 @Throws(DateTimeFormatException::class)
 actual fun String?.dateStringToEpochMillis(clock: Clock): Long? {
   if (this.isNullOrBlank()) return null
 
   val currentDate =
     clock.now().toLocalDateTime(TimeZone.currentSystemDefault()).toJavaLocalDateTime()
 
-  for (pattern in dateFormatterPatterns) {
-    val dateTimeFormatter = DateTimeFormatter.ofPattern(pattern, Locale.US)
+  for (dateTimeFormatter in dateTimeFormatters) {
+    if (!dateTimeFormatter.canParse(this)) continue
 
     try {
       val parsedValue = parseToInstant(dateTimeFormatter, this)
@@ -56,6 +60,15 @@ actual fun String?.dateStringToEpochMillis(clock: Clock): Long? {
   return null
 }
 
+private fun DateTimeFormatter.canParse(text: String): Boolean {
+  val position = ParsePosition(0)
+  return try {
+    parseUnresolved(text, position) != null && position.index == text.length
+  } catch (e: Exception) {
+    false
+  }
+}
+
 private fun parseToInstant(dateTimeFormatter: DateTimeFormatter, text: String): Instant {
   return dateTimeFormatter.parse(text, Instant::from)
 }
```

**File**: `core/base/src/iosMain/kotlin/dev/sasikanth/rss/reader/util/DateTimeFormatters.ios.kt` (modified, +11/-12)
```diff
@@ -34,23 +34,22 @@ import platform.Foundation.NSDateFormatter
 import platform.Foundation.NSLocale
 import platform.Foundation.timeIntervalSince1970
 
+private val dateFormatters by lazy {
+  dateFormatterPatterns.map { pattern ->
+    createDateFormatter(
+      pattern = pattern,
+      timeZone = if (hasTimeZonePattern(pattern)) null else TimeZone.UTC,
+    )
+  }
+}
+
 @Throws(DateTimeFormatException::class)
 actual fun String?.dateStringToEpochMillis(clock: Clock): Long? {
   if (this.isNullOrBlank()) return null
 
   try {
-    val date =
-      dateFormatterPatterns.firstNotNullOfOrNull { pattern ->
-        val timeZone =
-          if (hasTimeZonePattern(pattern)) {
-            null
-          } else {
-            TimeZone.UTC
-          }
-        val dateTimeFormatter = createDateFormatter(pattern = pattern, timeZone = timeZone)
-
-        dateTimeFormatter.dateFromString(this.trim())
-      }
+    val dateString = this.trim()
+    val date = dateFormatters.firstNotNullOfOrNull { it.dateFromString(dateString) }
 
     if (date != null) {
       val currentDate = clock.now().toNSDate()
```

**File**: `core/base/src/jvmMain/kotlin/dev/sasikanth/rss/reader/util/DateTimeFormatters.jvm.kt` (modified, +15/-2)
```diff
@@ -11,6 +11,7 @@
 
 package dev.sasikanth.rss.reader.util
 
+import java.text.ParsePosition
 import java.time.Instant
 import java.time.LocalDateTime
 import java.time.ZoneId
@@ -24,15 +25,18 @@ import kotlinx.datetime.toJavaLocalDateTime
 import kotlinx.datetime.toJavaZoneId
 import kotlinx.datetime.toLocalDateTime
 
+private val dateTimeFormatters =
+  dateFormatterPatterns.map { DateTimeFormatter.ofPattern(it, Locale.US) }
+
 @Throws(DateTimeFormatException::class)
 actual fun String?.dateStringToEpochMillis(clock: Clock): Long? {
   if (this.isNullOrBlank()) return null
 
   val currentDate =
     clock.now().toLocalDateTime(TimeZone.currentSystemDefault()).toJavaLocalDateTime()
 
-  for (pattern in dateFormatterPatterns) {
-    val dateTimeFormatter = DateTimeFormatter.ofPattern(pattern, Locale.US)
+  for (dateTimeFormatter in dateTimeFormatters) {
+    if (!dateTimeFormatter.canParse(this)) continue
 
     try {
       val parsedValue = parseToInstant(dateTimeFormatter, this)
@@ -50,6 +54,15 @@ actual fun String?.dateStringToEpochMillis(clock: Clock): Long? {
   return null
 }
 
+private fun DateTimeFormatter.canParse(text: String): Boolean {
+  val position = ParsePosition(0)
+  return try {
+    parseUnresolved(text, position) != null && position.index == text.length
+  } catch (e: Exception) {
+    false
+  }
+}
+
 private fun parseToInstant(dateTimeFormatter: DateTimeFormatter, text: String): Instant {
   return dateTimeFormatter.parse(text, Instant::from)
 }
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/common/ArticleHtmlParser.kt` (modified, +14/-8)
```diff
@@ -35,9 +35,9 @@ class ArticleHtmlParser {
     private const val TAG_SOURCE = "source"
     private const val ATTR_TYPE = "type"
 
-    private const val MAX_CONTENT_SIZE = 10 * 1024 * 1024 // 10MB
+    private const val MAX_CONTENT_SIZE = 5 * 1024 * 1024 // 5MB
 
-    private val gifRegex = Regex("/\\.gif(\\?.*)?\\$/i")
+    private val gifRegex = Regex("\\.gif(\\?.*)?$", RegexOption.IGNORE_CASE)
   }
 
   private val allowedContentTags by lazy {
@@ -59,15 +59,21 @@ class ArticleHtmlParser {
         }
       val cleanedHtmlDocument = Cleaner(allowedContentTags).clean(originalHtmlDocument)
       val body = cleanedHtmlDocument.body().first()
+      var firstGifImage: String? = null
       val heroImage =
-        body.firstNotNullOfOrNull {
-          val imageUrl = it.attr(ATTR_SRC)
-          if (it.tagName() == TAG_IMG && !gifRegex.containsMatchIn(imageUrl)) {
-            imageUrl.removeSurrounding("\"")
-          } else {
+        body.firstNotNullOfOrNull { element ->
+          if (element.tagName() != TAG_IMG) return@firstNotNullOfOrNull null
+
+          val imageUrl = element.attr(ATTR_SRC)
+          if (gifRegex.containsMatchIn(imageUrl)) {
+            if (firstGifImage == null) {
+              firstGifImage = imageUrl.removeSurrounding("\"")
+            }
             null
+          } else {
+            imageUrl.removeSurrounding("\"")
           }
-        }
+        } ?: firstGifImage
 
       val audioUrl =
         body.select(TAG_AUDIO).firstOrNull()?.let { audio ->
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/json/JsonFeedParser.kt` (modified, +18/-15)
```diff
@@ -25,7 +25,7 @@ import dev.sasikanth.rss.reader.core.network.utils.UrlUtils
 import dev.sasikanth.rss.reader.util.DispatchersProvider
 import dev.sasikanth.rss.reader.util.dateStringToEpochMillis
 import kotlin.time.Clock
-import kotlinx.coroutines.flow.asFlow
+import kotlinx.coroutines.flow.flow
 import kotlinx.coroutines.withContext
 import kotlinx.io.Source
 import kotlinx.serialization.ExperimentalSerializationApi
@@ -54,8 +54,8 @@ class JsonFeedParser(
             urlString = jsonFeedPayload.homePageUrl ?: jsonFeedPayload.url ?: feedUrl
           )
 
-        val posts =
-          jsonFeedPayload.items.map { jsonFeedPost ->
+        val posts = flow {
+          jsonFeedPayload.items.forEach { jsonFeedPost ->
             val postPublishedAt = jsonFeedPost.publishedAt?.dateStringToEpochMillis()
 
             val htmlContent = articleHtmlParser.parse(jsonFeedPost.contentHtml.orEmpty())
@@ -77,19 +77,22 @@ class JsonFeedParser(
               jsonFeedPost.attachments.firstOrNull { it.mimeType.startsWith("audio/") }?.url
                 ?: htmlContent?.audioUrl
 
-            PostPayload(
-              title = jsonFeedPost.title.orEmpty(),
-              link = jsonFeedPost.url.orEmpty(),
-              description = description,
-              rawContent = rawContent,
-              fullContent = null,
-              imageUrl = jsonFeedPost.imageUrl ?: image,
-              audioUrl = audioUrl,
-              date = postPublishedAt ?: Clock.System.now().toEpochMilliseconds(),
-              commentsLink = null,
-              isDateParsedCorrectly = postPublishedAt != null,
+            emit(
+              PostPayload(
+                title = jsonFeedPost.title.orEmpty(),
+                link = jsonFeedPost.url.orEmpty(),
+                description = description,
+                rawContent = rawContent,
+                fullContent = null,
+                imageUrl = jsonFeedPost.imageUrl ?: image,
+                audioUrl = audioUrl,
+                date = postPublishedAt ?: Clock.System.now().toEpochMilliseconds(),
+                commentsLink = null,
+                isDateParsedCorrectly = postPublishedAt != null,
+              )
             )
           }
+        }
 
         val feedPayload =
           FeedPayload(
@@ -99,7 +102,7 @@ class JsonFeedParser(
             description = jsonFeedPayload.description.orEmpty(),
             homepageLink = jsonFeedPayload.homePageUrl ?: feedUrl,
             link = jsonFeedPayload.url ?: feedUrl,
-            posts = posts.asFlow(),
+            posts = posts,
           )
 
         return@withContext feedPayload
```

---

### Incident Patch 4: `95c37cde` (2026-08-21)
**Commit Message**: Fix media element parsing truncating feeds and dropping images (#1910)

Media elements were read by pulling the `url` attribute and then calling
`parser.nextTag()`, which assumes the element is empty. Feeds that nest
children inside `media:content` (The Guardian, Ars Technica) left the
parser a level deep, and since both the item loop and `postsFlow` bailed
on any END_TAG, the next nested end tag terminated the item and then the
whole post flow, yielding a single post per feed.

Separately, the image tag guard required a non-blank `url` attribute, so
feeds that put the URL in the element's text (MyAnimeList) fell through
to `skipSubTree()` and never produced an image.

Read the image URL from either the attribute or the text content, and
consume the whole element in both cases. Replace the END_TAG-terminated
loops with `forEachChildTag`, which stops only at its container's end
tag, so a misaligned child degrades one item instead of truncating the
rest of the feed. Atom entries now also read bare `media:content` and
`media:thumbnail`, which they previously ignored outside `media:group`.

Fixes #1908
Fixes #1909

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/xml/AtomFeedParser.kt` (modified, +16/-8)
```diff
@@ -87,7 +87,7 @@ class AtomContentParser(httpClient: HttpClient, override val articleHtmlParser:
         }
         TAG_ITUNES_IMAGE -> {
           iconUrl = parser.getAttributeValue(parser.namespace, ATTR_HREF)
-          parser.nextTag()
+          parser.skipSubTree()
         }
         TAG_ATOM_ENTRY -> {
           val host = UrlUtils.extractHost(link ?: feedUrl)
@@ -117,6 +117,7 @@ class AtomContentParser(httpClient: HttpClient, override val articleHtmlParser:
         postsFlow(
           parser = parser,
           firstPost = firstPost,
+          containerTag = TAG_ATOM_FEED,
           itemTag = TAG_ATOM_ENTRY,
           readItem = { readAtomEntry(it, UrlUtils.extractHost(link ?: feedUrl)) },
         ),
@@ -140,10 +141,8 @@ class AtomContentParser(httpClient: HttpClient, override val articleHtmlParser:
     var image: String? = null
     var audioUrl: String? = null
 
-    while (parser.next() != EventType.END_TAG) {
-      if (parser.eventType != EventType.START_TAG) continue
-
-      when (val tagName = parser.name) {
+    forEachChildTag(parser, TAG_ATOM_ENTRY) { tagName ->
+      when (tagName) {
         TAG_TITLE -> {
           title = parser.nextText()
         }
@@ -159,7 +158,7 @@ class AtomContentParser(httpClient: HttpClient, override val articleHtmlParser:
           if (link.isNullOrBlank() && (rel == ATTR_VALUE_ALTERNATE || rel.isNullOrBlank())) {
             link = href
           }
-          parser.nextTag()
+          parser.skipSubTree()
         }
         TAG_CONTENT,
         TAG_SUMMARY -> {
@@ -179,8 +178,17 @@ class AtomContentParser(httpClient: HttpClient, override val articleHtmlParser:
           }
         }
         TAG_ITUNES_IMAGE -> {
-          image = parser.getAttributeValue(parser.namespace, ATTR_HREF)
-          parser.nextTag()
+          val itunesImage = parser.getAttributeValue(parser.namespace, ATTR_HREF)
+          parser.skipSubTree()
+          if (image.isNullOrBlank()) {
+            image = itunesImage
+          }
+        }
+        in XmlFeedParser.imageTags -> {
+          val mediaImage = readMediaImageUrl(parser)
+          if (image.isNullOrBlank()) {
+            image = mediaImage
+          }
         }
         TAG_MEDIA_GROUP -> {
           val mediaGroupResult = readMediaGroup(parser)
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/xml/RDFFeedParser.kt` (modified, +2/-4)
```diff
@@ -81,6 +81,7 @@ class RDFContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
       posts =
         postsFlow(
           parser = parser,
+          containerTag = XmlFeedParser.RDF_TAG,
           itemTag = TAG_RSS_ITEM,
           readItem = { readRssItem(it, UrlUtils.extractHost(link ?: feedUrl)) },
         ),
@@ -105,10 +106,7 @@ class RDFContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
     var date: String? = null
     var image: String? = null
 
-    while (parser.next() != EventType.END_TAG) {
-      if (parser.eventType != EventType.START_TAG) continue
-      val name = parser.name
-
+    forEachChildTag(parser, TAG_RSS_ITEM) { name ->
       when {
         name == TAG_TITLE -> {
           title = parser.nextText()
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/xml/RssFeedParser.kt` (modified, +14/-17)
```diff
@@ -97,6 +97,7 @@ class RSSContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
         postsFlow(
           parser = parser,
           firstPost = firstPost,
+          containerTag = TAG_RSS_CHANNEL,
           itemTag = TAG_RSS_ITEM,
           readItem = { readRssItem(it, UrlUtils.extractHost(link ?: feedUrl)) },
         ),
@@ -137,10 +138,7 @@ class RSSContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
     var audioUrl: String? = null
     var commentsLink: String? = null
 
-    while (parser.next() != EventType.END_TAG) {
-      if (parser.eventType != EventType.START_TAG) continue
-      val name = parser.name
-
+    forEachChildTag(parser, TAG_RSS_ITEM) { name ->
       when {
         name == TAG_TITLE -> {
           title = parser.nextText()
@@ -164,7 +162,7 @@ class RSSContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
             image = enclosureUrl
           }
 
-          parser.nextTag()
+          parser.skipSubTree()
         }
         name == TAG_DESCRIPTION || name == TAG_CONTENT_ENCODED -> {
           val postContent = parsePostContent(parser)
@@ -177,13 +175,18 @@ class RSSContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
         name == TAG_PUB_DATE -> {
           date = parser.nextText()
         }
-        image.isNullOrBlank() && name == TAG_ITUNES_IMAGE -> {
-          image = parser.getAttributeValue(parser.namespace, XmlFeedParser.ATTR_HREF)
-          parser.nextTag()
+        name == TAG_ITUNES_IMAGE -> {
+          val itunesImage = parser.getAttributeValue(parser.namespace, XmlFeedParser.ATTR_HREF)
+          parser.skipSubTree()
+          if (image.isNullOrBlank()) {
+            image = itunesImage
+          }
         }
-        image.isNullOrBlank() && hasRssImageUrl(name, parser) -> {
-          image = parser.getAttributeValue(parser.namespace, ATTR_URL)
-          parser.nextTag()
+        name in XmlFeedParser.imageTags -> {
+          val mediaImage = readMediaImageUrl(parser)
+          if (image.isNullOrBlank()) {
+            image = mediaImage
+          }
         }
         image.isNullOrBlank() && name == TAG_FEATURED_IMAGE -> {
           image = parser.nextText()
@@ -212,10 +215,4 @@ class RSSContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
       hostLink = hostLink,
     )
   }
-
-  private fun hasRssImageUrl(name: String, parser: XmlPullParser) =
-    (XmlFeedParser.imageTags.contains(name) ||
-      (name == TAG_ENCLOSURE &&
-        parser.getAttributeValue(parser.namespace, ATTR_TYPE) == ATTR_VALUE_IMAGE)) &&
-      !parser.getAttributeValue(parser.namespace, ATTR_URL).isNullOrBlank()
 }
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/xml/XmlContentParser.kt` (modified, +63/-11)
```diff
@@ -20,9 +20,10 @@ package dev.sasikanth.rss.reader.core.network.parser.xml
 import dev.sasikanth.rss.reader.core.model.remote.FeedPayload
 import dev.sasikanth.rss.reader.core.model.remote.PostPayload
 import dev.sasikanth.rss.reader.core.network.parser.common.ArticleHtmlParser
+import dev.sasikanth.rss.reader.core.network.parser.xml.XmlFeedParser.Companion.ATTR_URL
 import dev.sasikanth.rss.reader.core.network.parser.xml.XmlFeedParser.Companion.TAG_MEDIA_CONTENT
+import dev.sasikanth.rss.reader.core.network.parser.xml.XmlFeedParser.Companion.TAG_MEDIA_GROUP
 import dev.sasikanth.rss.reader.core.network.parser.xml.XmlFeedParser.Companion.TAG_MEDIA_THUMBNAIL
-import dev.sasikanth.rss.reader.core.network.parser.xml.XmlFeedParser.Companion.TAG_URL
 import dev.sasikanth.rss.reader.core.network.utils.UrlUtils
 import dev.sasikanth.rss.reader.util.dateStringToEpochMillis
 import dev.sasikanth.rss.reader.util.decodeHTMLString
@@ -41,17 +42,16 @@ abstract class XmlContentParser {
   protected fun postsFlow(
     parser: XmlPullParser,
     firstPost: PostPayload? = null,
+    containerTag: String,
     itemTag: String,
     readItem: (XmlPullParser) -> PostPayload?,
   ): Flow<PostPayload> = flow {
     if (firstPost != null) {
       emit(firstPost)
     }
 
-    while (parser.next() != EventType.END_TAG) {
-      if (parser.eventType != EventType.START_TAG) continue
-
-      if (parser.name == itemTag) {
+    forEachChildTag(parser, containerTag) { name ->
+      if (name == itemTag) {
         val post = readItem(parser)
         if (post != null) {
           emit(post)
@@ -62,6 +62,58 @@ abstract class XmlContentParser {
     }
   }
 
+  /**
+   * Loops over the direct children of the tag the parser is currently inside, stopping only at
+   * [containerTag]'s end tag. Bailing on any end tag would truncate the rest of the container when
+   * a single child leaves the parser misaligned.
+   */
+  protected inline fun forEachChildTag(
+    parser: XmlPullParser,
+    containerTag: String,
+    block: (String) -> Unit,
+  ) {
+    while (true) {
+      val eventType = parser.next()
+      if (eventType == EventType.END_DOCUMENT) return
+      if (eventType == EventType.END_TAG && parser.name == containerTag) return
+      if (eventType != EventType.START_TAG) continue
+
+      block(parser.name)
+    }
+  }
+
+  /**
+   * Reads a media image URL from either the `url` attribute or the element's text content, and
+   * consumes the whole element. Feeds like MyAnimeList put the URL in the text, and feeds like The
+   * Guardian nest `media:credit` inside `media:content`.
+   */
+  protected fun readMediaImageUrl(parser: XmlPullParser): String? {
+    val urlFromAttribute = parser.getAttributeValue(parser.namespace, ATTR_URL)
+    if (!urlFromAttribute.isNullOrBlank()) {
+      parser.skipSubTree()
+      return urlFromAttribute
+    }
+
+    return readTextContentAndSkipSubTree(parser)
+  }
+
+  protected fun readTextContentAndSkipSubTree(parser: XmlPullParser): String? {
+    var text: String? = null
+    var depth = 1
+
+    while (depth > 0) {
+      when (parser.next()) {
+        EventType.START_TAG -> depth++
+        EventType.END_TAG -> depth--
+        EventType.TEXT -> if (depth == 1 && text.isNullOrBlank()) text = parser.text
+        EventType.END_DOCUMENT -> break
+        else -> {}
+      }
+    }
+
+    return text?.trim()?.ifBlank { null }
+  }
+
   protected fun createFeedPayload(
     name: String?,
     description: String?,
@@ -104,13 +156,13 @@ abstract class XmlContentParser {
     var image: String? = null
     var description: String? = null
 
-    while (parser.next() != EventType.END_TAG) {
-      if (parser.eventType != EventType.START_TAG) continue
-
-      when (parser.name) {
+    forEachChildTag(parser, TAG_MEDIA_GROUP) { name ->
+      when (name) {
         TAG_MEDIA_THUMBNAIL -> {
-          image = parser.getAttributeValue(parser.namespace, TAG_URL)
-          parser.nextTag()
+          val imageUr
```

**File**: `core/network/src/commonTest/kotlin/dev/sasikanth/rss/reader/core/network/parser/XmlFeedParserTest.kt` (modified, +67/-0)
```diff
@@ -33,6 +33,7 @@ import dev.sasikanth.rss.reader.core.network.utils.podcastRssFeedUrl
 import dev.sasikanth.rss.reader.core.network.utils.podcastRssXmlContent
 import dev.sasikanth.rss.reader.core.network.utils.rdfXmlContent
 import dev.sasikanth.rss.reader.core.network.utils.rssXmlContent
+import dev.sasikanth.rss.reader.core.network.utils.rssXmlContentWithNestedMediaInFirstItem
 import dev.sasikanth.rss.reader.core.network.utils.youtubeAtomFeed
 import dev.sasikanth.rss.reader.core.network.utils.youtubeChannelHtml
 import dev.sasikanth.rss.reader.core.network.utils.youtubeFeedUrl
@@ -279,6 +280,60 @@ class XmlFeedParserTest {
                 isDateParsedCorrectly = true,
                 audioUrl = null,
               ),
+              PostPayload(
+                title = "Post with nested media content",
+                link = "https://example.com/post-with-nested-media-content",
+                description = "Nested media content description.",
+                rawContent =
+                  """
+                  <html>
+                   <body>Nested media content description.</body>
+                  </html>
+                  """
+                    .trimIndent(),
+                fullContent = null,
+                imageUrl = "https://example.com/media/nested-media-content",
+                date = 1685005200000,
+                commentsLink = null,
+                isDateParsedCorrectly = true,
+                audioUrl = null,
+              ),
+              PostPayload(
+                title = "Post with media thumbnail as text",
+                link = "https://example.com/post-with-media-thumbnail-text",
+                description = "Media thumbnail text description.",
+                rawContent =
+                  """
+                  <html>
+                   <body>Media thumbnail text description.</body>
+                  </html>
+                  """
+                    .trimIndent(),
+                fullContent = null,
+                imageUrl = "https://example.com/media/thumbnail-as-text",
+                date = 1685005200000,
+                commentsLink = null,
+                isDateParsedCorrectly = true,
+                audioUrl = null,
+              ),
+              PostPayload(
+                title = "Post after nested media content",
+                link = "https://example.com/post-after-nested-media-content",
+                description = "Post after nested media content description.",
+                rawContent =
+                  """
+                  <html>
+                   <body>Post after nested media content description.</body>
+                  </html>
+                  """
+                    .trimIndent(),
+                fullContent = null,
+                imageUrl = null,
+                date = 1685005200000,
+                commentsLink = null,
+                isDateParsedCorrectly = true,
+                audioUrl = null,
+              ),
             )
             .asFlow(),
       )
@@ -291,6 +346,18 @@ class XmlFeedParserTest {
     assertFeedPayloadEquals(expectedFeedPayload, payload)
   }
 
+  @Test
+  fun parsingRssFeedWithNestedMediaContentShouldNotTruncateItems() = runTest {
+    // when
+    val content = ByteReadChannel(rssXmlContentWithNestedMediaInFirstItem.toByteArray())
+    val payload = xmlFeedParser.parse(content, feedUrl, Charsets.UTF8)
+    val posts = payload.posts.toList()
+
+    // then
+    assertEquals(listOf("First post", "Second post", "Third post"), posts.map { it.title })
+    assertEquals("https://example.com/media/first-post-140", posts.first().imageUrl)
+  }
+
   @Test
   fun parsingRDFFeedShouldWorkCorrectly() = runTest {
     // given
```

---

### Incident Patch 5: `ebcb129a` (2026-07-21)
**Commit Message**: Fix JVM readability parser crash on pages with iframe tags

Neutralize iframe tags before parsing to prevent HtmlUnit from throwing NPE on windowless documents, and fall back to raw content if parsing fails.

**File**: `shared/src/commonMain/composeResources/files/reader/main.es5.js` (modified, +40/-19)
```diff
@@ -19,19 +19,46 @@ var JUNK_SELECTORS = [
 ].join(",");
 
 
-function processIFrames(doc) {
-  var iframes = doc.querySelectorAll("iframe");
+// HtmlUnit's DOMParser builds a windowless document (enclosing window is
+// explicitly null), but it still tries to construct a live FrameWindow the
+// moment it parses a real <iframe>/<frame> tag, which NPEs on the null
+// parent window - and the same crash happens later if a real iframe tag is
+// created any other way (e.g. Readability's own iframe handling), since the
+// window stays null for the document's whole lifetime. Renaming the tag
+// before parsing keeps HtmlUnit from ever recognizing it as a frame element.
+var IFRAME_TAG = "twine-iframe";
+
+function neutralizeIframeTags(html) {
+  return html.replace(/<(\/?)i?frame\b/gi, "<$1" + IFRAME_TAG);
+}
+
+/**
+ * Renamed iframe tags are opaque to Readability's own iframe handling (which
+ * expects real "iframe" elements), so swap each one for a plain link before
+ * Readability runs. This also means the result survives Readability's content
+ * scoring like any other link, instead of relying on iframe-specific rules.
+ */
+function replaceIframesWithLinks(doc) {
+  var iframes = doc.querySelectorAll(IFRAME_TAG);
   for (var i = 0; i < iframes.length; i++) {
     var iframe = iframes[i];
-    var src = iframe.getAttribute("src");
-    var lazySrc =
+    var src =
+      iframe.getAttribute("src") ||
       iframe.getAttribute("data-src") ||
       iframe.getAttribute("data-runner-src") ||
       iframe.getAttribute("data-lazy-src");
 
-    if (!src && lazySrc) {
-      iframe.src = lazySrc;
+    if (!src) {
+      iframe.remove();
+      continue;
     }
+
+    var label = src.includes("youtube.com") ? "YouTube Video" : "Video";
+    var link = doc.createElement("a");
+    link.setAttribute("href", src);
+    link.textContent = label;
+
+    iframe.parentNode.replaceChild(link, iframe);
   }
 }
 
@@ -431,26 +458,17 @@ function getImageCaption(markdown) {
 function parseReaderContent(link, bannerImage, html) {
   return new Promise(function(resolve, reject) {
       try {
+        var safeHtml = neutralizeIframeTags(html);
         var parser = new DOMParser();
         var doc = parser.parseFromString(
-          "<html><head><base href=\"" + link + "\"></head><body>" + html + "</body></html>",
+          "<html><head><base href=\"" + link + "\"></head><body>" + safeHtml + "</body></html>",
           "text/html"
         );
         var turndownService = new TurndownService({
             headingStyle: 'atx',
             codeBlockStyle: 'fenced'
         });
 
-        turndownService.addRule("iframe", {
-          filter: "iframe",
-          replacement: function(content, node) {
-            var src = node.getAttribute("src") || node.getAttribute("data-src");
-            if (!src) return "";
-            var label = src.includes("youtube.com") ? "YouTube Video" : "Video";
-            return "\n\n[" + label + "](" + src + ")\n\n";
-          }
-        });
-
         turndownService.addRule("image", {
           filter: "img",
           replacement: function(content, node) {
@@ -499,7 +517,7 @@ function parseReaderContent(link, bannerImage, html) {
 
         removeFirstH1(doc);
         stripAriaHidden(doc);
-        processIFrames(doc);
+        replaceIframesWithLinks(doc);
         processNoScriptImages(doc);
         transformShredditElements(doc);
         removeFirstImageTagByUrl(doc, bannerImage);
@@ -537,8 +555,11 @@ function parseReaderContent(link, bannerImage, html) {
         console.error("Reader Error:", error);
         // Never surface error text as article content; fall back to a plain
         // conversion of the original HTML, or nothing if even that fails.
+        // Turndown parses string input through the same DOMParser, so this
+        // must use the iframe-neutralized HTML too, or it can hit the exact
+        // crash it's trying to recover from.
         try {
-          resolve({ cont
```

**File**: `shared/src/jvmMain/kotlin/dev/sasikanth/rss/reader/reader/readability/ReadabilityRunner.kt` (modified, +62/-41)
```diff
@@ -17,6 +17,7 @@
 
 package dev.sasikanth.rss.reader.reader.readability
 
+import co.touchlab.kermit.Logger
 import dev.sasikanth.rss.reader.core.model.local.ReadabilityResult
 import dev.sasikanth.rss.reader.di.scopes.AppScope
 import dev.sasikanth.rss.reader.reader.redability.ReadabilityRunner
@@ -48,30 +49,50 @@ class HtmlReadabilityRunner(private val dispatchersProvider: DispatchersProvider
     image: String?,
   ): ReadabilityResult =
     withContext(dispatchersProvider.io) {
-      // Use CHROME as it is generally the most compatible, but Rhino is the engine.
-      WebClient(BrowserVersion.CHROME).use { webClient ->
-        webClient.options.isCssEnabled = false
-        webClient.options.isDownloadImages = false
-        webClient.options.isGeolocationEnabled = false
-        // We want to catch errors to know if our ES5 transpilation failed
-        webClient.options.isThrowExceptionOnScriptError = true
-        webClient.options.isThrowExceptionOnFailingStatusCode = false
-
-        val htmlShell = ReaderHTML.createOrGet()
-        val page: HtmlPage = webClient.loadHtmlCodeIntoCurrentWindow(htmlShell)
-
-        val script =
-          """
+      try {
+        parseHtmlOrThrow(link, content, image)
+      } catch (e: Exception) {
+        // HtmlUnit is a best-effort HTML engine, not a real browser: it can throw on
+        // content it can't model correctly (e.g. it NPEs building a live frame window
+        // for <iframe> tags parsed into a windowless document). Never let a parsing
+        // quirk take down the reader — show the original content instead.
+        Logger.e(e) { "Failed to run readability pipeline, falling back to raw content" }
+        ReadabilityResult(content = content)
+      }
+    }
+
+  private suspend fun parseHtmlOrThrow(
+    link: String?,
+    content: String,
+    image: String?,
+  ): ReadabilityResult {
+    // Fetch the shell HTML before opening the WebClient so no suspension point
+    // (and potential dispatcher thread hop) happens while the client/page is live.
+    val htmlShell = ReaderHTML.createOrGet()
+
+    // Use CHROME as it is generally the most compatible, but Rhino is the engine.
+    WebClient(BrowserVersion.CHROME).use { webClient ->
+      webClient.options.isCssEnabled = false
+      webClient.options.isDownloadImages = false
+      webClient.options.isGeolocationEnabled = false
+      // We want to catch errors to know if our ES5 transpilation failed
+      webClient.options.isThrowExceptionOnScriptError = true
+      webClient.options.isThrowExceptionOnFailingStatusCode = false
+
+      val page: HtmlPage = webClient.loadHtmlCodeIntoCurrentWindow(htmlShell)
+
+      val script =
+        """
         var parsingResult = null;
         var parsingError = null;
-        
+
         if (typeof parseReaderContent === 'undefined') {
           parsingError = "parseReaderContent is undefined. Scripts not loaded?";
         } else {
           try {
             parseReaderContent(
-              ${link.asJSString}, 
-              ${image.asJSString}, 
+              ${link.asJSString},
+              ${image.asJSString},
               ${content.asJSString}
             ).then(function(res) {
               parsingResult = JSON.stringify(res);
@@ -83,38 +104,38 @@ class HtmlReadabilityRunner(private val dispatchersProvider: DispatchersProvider
           }
         }
       """
-            .trimIndent()
-
-        try {
-          page.executeJavaScript(script)
-        } catch (e: Exception) {
-          throw RuntimeException("Failed to execute initial script: ${e.message}", e)
-        }
+          .trimIndent()
 
-        // Wait for result
-        val maxRetries = 100 // 10 seconds
-        var result: String? = null
+      try {
+        page.executeJavaScript(script)
+      } catch (e: Exception) {
+        throw RuntimeException("Failed to execute initial script: ${e.message}", e)
+      }
 
-        for (i in 0 until maxRetries) {
-          webCl
```

#### Recent Merged Pull Requests:
- **PR #1948** (closed): Show full featured images without crop or empty space (@camilopaezz)
- **PR #1945** (2026-09-09): [300.106.*] Pre-release merge (@tramline-github[bot])
- **PR #1943** (closed): New Crowdin updates (@msasikanth)
- **PR #1942** (2026-08-31): [300.105.*] Pre-release merge (@tramline-github[bot])
- **PR #1941** (2026-08-30): [300.104.*] Pre-release merge (@tramline-github[bot])
- **PR #1940** (2026-08-30): [300.103.*] Pre-release merge (@tramline-github[bot])
- **PR #1939** (2026-08-30): [300.102.*] Pre-release merge (@tramline-github[bot])
- **PR #1938** (2026-08-30): [300.101.*] Pre-release merge (@tramline-github[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: axios/axios Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "axios/axios",
  "source_url": "https://github.com/axios/axios",
  "source_version": "c0d4c900",
  "license": "MIT",
  "timestamp": "2026-11-16T22:47:32.240Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-axios-axios",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [axios/axios](https://github.com/axios/axios) (Revision: `c0d4c900`).  
> **License**: MIT | **Timestamp**: `2026-11-16T22:47:32.240Z`  
> **Learning ID**: `learn-github-axios-axios`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), G (Architecture Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), L (Deployment & Operations Intelligence), F (Design Intelligence), E (Creative Intelligence)
- **Confidence Rating**: 72%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from axios/axios:

# Forensic Learning Record (Deep Inspection): axios/axios

> **Canonical Artifact**: `07_PROJECT_LEARNING/axios-axios-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/axios/axios](https://github.com/axios/axios))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-16T22:47:31.313Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `axios/axios`
- **Description**: Promise based HTTP client for the browser and node.js
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 109366 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lib/core/Axios.js`
```
'use strict';

import utils from '../utils.js';
import buildURL from '../helpers/buildURL.js';
import InterceptorManager from './InterceptorManager.js';
import dispatchRequest from './dispatchRequest.js';
import assertValidRequestUrl from './assertValidRequestUrl.js';
import adapters from '../adapters/adapters.js';
import defaults from '../defaults/index.js';
import mergeConfig from './mergeConfig.js';
import buildFullPath from './buildFullPath.js';
import methodList from './methodList.js';
import validator from '../helpers/validator.js';
import AxiosHeaders from './AxiosHeaders.js';
import transitionalDefaults from '../defaults/transitional.js';
import { getCauseStackIndex } from './AxiosError.js';

const validators = validator.validators;

// Recognize header maps without consuming objects intended as literal values.
// AxiosHeaders from other builds share a brand and header-container interface,
// but not constructor identity. A tag and toJSON alone can describe a literal.
const isHeadersBucket = (value) => {
  if (value == null || utils.isPlainObject(value) || value instanceof AxiosHeaders) {
    return true;
  }

  try {
    return (
      utils.isObject(value) &&
      utils.getSafeProp(value, Symbol.toStringTag) === 'AxiosHeaders' &&
      [
        'toJSON',
        'set',
        'get',
        'has',
        'delete',
        'clear',
        'normalize',
        'concat',
        'toString',
        Symbol.iterator,
      ].every((method) => utils.isFunction(utils.getSafeProp(value, method)))
    );
  } catch (e) {
    // A failed optional brand probe must not prevent literal header serialization.
    return false;
  }
};

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 *
 * @return {Axios} A new instance of Axios
 */
class Axios {
  constructor(instanceConfig) {
    this.defaults = instanceConfig || {};
    this.interceptors = {
      request: new InterceptorManager(),
      response: new InterceptorManager(),
    };
  }

  /**
   * Dispatch a request
   *
   * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
   * @param {?Object} config
   *
   * @returns {Promise} The Promise to be fulfilled
   */
  async request(configOrUrl, config) {
    try {
      return await this._request(configOrUrl, config);
    } catch (err) {
      if (err instanceof Error) {
        try {
          let dummy = {};

          Error.captureStackTrace ? Error.captureStackTrace(dummy) : (dummy = new Error());

          const dummyStack = dummy.stack;
          let stack = '';

          // slice off the Error: ... line
          if (typeof dummyStack === 'string') {
            const firstNewlineIndex = dummyStack.indexOf('\n');

            stack = firstNewlineIndex === -1 ? '' : dummyStack.slice(firstNewlineIndex + 1);
          }

          if (!err.stack) {
            err.stack = stack;
          } else if (stack) {
            // Match a common suffix after the 2 top frames when available,
            // otherwise compare the full reconstructed stack.
            const firstNewlineIndex = stack.indexOf('\n');
            const secondNewlineIndex =
              firstNewlineIndex === -1 ? -1 : stack.indexOf('\n', firstNewlineIndex + 1);
            const duplicateCheckSuffix =
              secondNewlineIndex === -1 ? stack : stack.slice(secondNewlineIndex + 1);

            // `AxiosError.from()` may have already inlined the wrapped error's
            // stack under a `Caused by:` marker. Keep the reconstructed caller
            // frames ahead of that marker so stack-only reporters do not read
            // them as part of the low-level cause.
            const currentStack = String(err.stack);
            const causeIndex = getCauseStackIndex(err, currentStack);
            const stackHead = causeIndex === -1 ? currentStack : currentStack.slice(0, causeIndex);
            const causeSection = causeIndex === -1 ? '' : currentStack.slice(causeIndex);

            if (!stackHead.endsWith(duplicateCheckSuffix)) {
              err.stack = stackHead + '\n' + stack + causeSection;
            }
          }
        } catch (e) {
          // Ignore failures from custom stack hooks or un-writable stack properties.
        }
      }

      throw err;
    }
  }

  _request(configOrUrl, config) {
    /*eslint no-param-reassign:0*/
    // Allow for axios('example/url'[, config]) a la fetch API
    if (typeof configOrUrl === 'string') {
      config = config || {};
      config.url = configOrUrl;
    } else {
      config = configOrUrl || {};
    }

    config = mergeConfig(this.defaults, config);

    const { transitional, paramsSerializer, headers } = config;

    if (transitional !== undefined) {
      validator.assertOptions(
        transitional,
        {
          silentJSONParsing: validators.transitional(validators.boolean),
          forcedJSONParsing: validators.transitional(validators.boolean),
          clarifyTimeoutError: validators.transitional(validators.boolean),
          legacyInterceptorReqResOrdering: validators.transitional(validators.boolean),
          advertiseZstdAcceptEncoding: validators.transitional(validators.boolean),
          validateStatusUndefinedResolves: validators.transitional(validators.boolean),
          encodeBasicAuthUsername: validators.transitional(validators.boolean),
        },
        false
      );
    }

    if (paramsSerializer != null) {
      if (utils.isFunction(paramsSerializer)) {
        config.paramsSerializer = {
          serialize: paramsSerializer,
        };
      } else {
        validator.assertOptions(
          paramsSerializer,
          {
            encode: validators.function,
            serialize: validators.function,
          },
          true
        );
      }
    }

    // Set config.allowAbsoluteUrls
    if (config.allowAbsoluteUrls !== undefined) {
      // do nothing
    } else if (
      utils.hasOwnProp(this.defaults, 'allowAbsoluteUrls') &&
      this.defaults.allowAbsoluteUrls !== undefined
    ) {
      config.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls;
    } else {
      config.allowAbsoluteUrls = true;
    }

    validator.assertOptions(
      config,
      {
        baseUrl: validators.spelling('baseURL'),
        withXsrfToken: validators.spelling('withXSRFToken'),
      },
      true
    );

    // Set config.method
    config.method = (
      utils.getSafeProp(config, 'method') ||
      utils.getSafeProp(this.defaults, 'method') ||
      'get'
    ).toLowerCase();

    // Flatten header defaults without consuming literal method-named headers.
    const commonHeaders = utils.getSafeProp(headers, 'common');
    const methodHeaders = utils.getSafeProp(headers, config.method);
    const contextHeaders =
      headers &&
      utils.merge(
        isHeadersBucket(commonHeaders) ? commonHeaders : undefined,
        isHeadersBucket(methodHeaders) ? methodHeaders : undefined
      );

    headers &&
      utils.forEach(methodList.concat('common'), (method) => {
        if (isHeadersBucket(utils.getSafeProp(headers, method))) {
          delete headers[method];
        }
      });

    config.headers = AxiosHeaders.concat(contextHeaders, headers);

    // filter out skipped interceptors
    const requestInterceptorChain = [];
    let synchronousRequestInterceptors = true;
    this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
      if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
        return;
      }

      synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

      const transitional = config.transitional || transitionalDefaults;
      const legacyInterceptorReqResOrdering =
        transitional && transitional.legacyInterceptorReqResOrdering;

      if (legacyInterceptorReqResOrdering) {
        requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
      } else {
        requestInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
      }
    });

    const responseInterceptorChain = [];
    this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
      responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
    });

    let promise;
    let i = 0;
    let len;

    if (!synchronousRequestInterceptors) {
      const chain = [dispatchRequest.bind(this), undefined];
      chain.unshift(...requestInterceptorChain);
      chain.push(...responseInterceptorChain);
      len = chain.length;

      promise = Promise.resolve(config);

      while (i < len) {
        promise = promise.then(chain[i++], chain[i++]);
      }

      return promise;
    }

    len = requestInterceptorChain.length;

    let newConfig = config;

    while (i < len) {
      const onFulfilled = requestInterceptorChain[i++];
      const onRejected = requestInterceptorChain[i++];
      try {
        newConfig = onFulfilled ? onFulfilled(newConfig) : newConfig;
      } catch (error) {
        if (!onRejected) {
          promise = Promise.reject(error);
          break;
        }

        try {
          const rejectedResult = onRejected.call(this, error);

          if (utils.isThenable(rejectedResult)) {
            promise = Promise.resolve(rejectedResult).then(() =>
              dispatchRequest.call(this, newConfig)
            );
          }
        } catch (rejectedError) {
          promise = Promise.reject(rejectedError);
        }

        break;
      }
    }

    if (!promise) {
      try {
        promise = dispatchRequest.call(this, newConfig);
      } catch (error) {
        promise = Promise.reject(error);
      }
    }

    i = 0;
    len = responseInterceptorChain.length;

    while (i < len) {
      promise = promise.then(responseInterceptorChain[i++], responseInterceptorChain[i++]);
    }

    return promise;
  }

  getUri(config) {
    
```

### Core Architecture Module: `lib/core/AxiosError.js`
```
'use strict';

import utils from '../utils.js';
import AxiosHeaders from './AxiosHeaders.js';

export const REDACTED = '[REDACTED ****]';

function hasOwnOrPrototypeToJSON(source) {
  if (utils.hasOwnProp(source, 'toJSON')) {
    return true;
  }

  let prototype = Object.getPrototypeOf(source);

  while (prototype && prototype !== Object.prototype) {
    if (utils.hasOwnProp(prototype, 'toJSON')) {
      return true;
    }

    prototype = Object.getPrototypeOf(prototype);
  }

  return false;
}

// Build a plain-object snapshot of `config` and replace the value of any key
// (case-insensitive) listed in `redactKeys` with REDACTED. Walks through arrays
// and AxiosHeaders, and short-circuits on circular references.
function redactConfig(config, redactKeys) {
  const lowerKeys = new Set(redactKeys.map((k) => String(k).toLowerCase()));
  const seen = [];

  const visit = (source) => {
    if (source === null || typeof source !== 'object') return source;
    if (utils.isBuffer(source)) return source;
    if (seen.indexOf(source) !== -1) return undefined;

    if (source instanceof AxiosHeaders) {
      source = source.toJSON();
    }

    seen.push(source);

    let result;
    if (utils.isArray(source)) {
      result = [];
      source.forEach((v, i) => {
        const reducedValue = visit(v);
        if (!utils.isUndefined(reducedValue)) {
          result[i] = reducedValue;
        }
      });
    } else {
      if (!utils.isPlainObject(source) && hasOwnOrPrototypeToJSON(source)) {
        seen.pop();
        return source;
      }

      result = Object.create(null);
      for (const [key, value] of Object.entries(source)) {
        const reducedValue = lowerKeys.has(key.toLowerCase()) ? REDACTED : visit(value);
        if (!utils.isUndefined(reducedValue)) {
          result[key] = reducedValue;
        }
      }
    }

    seen.pop();
    return result;
  };

  return visit(config);
}

function stringifySafely(value) {
  try {
    return String(value);
  } catch (err) {
    return '';
  }
}

function aggregateErrorMessage(error) {
  const message = error.errors
    .map((entry) => {
      try {
        return entry && entry.message ? stringifySafely(entry.message) : stringifySafely(entry);
      } catch (err) {
        return '';
      }
    })
    .filter(Boolean)
    .join('; ');

  return message || error.name || 'AggregateError';
}

// Shared with `Axios.prototype.request`, which splices the reconstructed
// caller frames in ahead of this marker.
export const CAUSED_BY_SEPARATOR = '\nCaused by: ';
const $causeStack = Symbol('causeStack');

// Match the section we appended, not marker-like text in an error message or
// a replacement stack supplied by the caller. Do not re-read the cause's stack.
export function getCauseStackIndex(error, stack) {
  const causeStack = utils.hasOwnProp(error, $causeStack) && error[$causeStack];

  return causeStack && stack.endsWith(causeStack) ? stack.length - causeStack.length : -1;
}

/**
 * Append the stack of a wrapped error to `target.stack`.
 *
 * `cause` already exposes the original error for tooling that walks the standard
 * cause chain, but many error reporters read `stack` and nothing else. Inlining
 * the wrapped stack there means those reporters surface the underlying failure
 * instead of the axios frames that normalized it (see #6670).
 *
 * Every read is defensive: a custom `Error.prepareStackTrace` hook, a runtime
 * without stack support, or a replaced `stack` property can leave the value
 * missing, non-string, or read-only, and normalizing an error must not throw
 * because of that.
 *
 * @param {Error} target The AxiosError being built.
 * @param {Error} source The error being wrapped.
 *
 * @returns {void}
 */
function appendCauseStack(target, source) {
  try {
    const sourceStack = source && source.stack;

    if (typeof sourceStack !== 'string' || !sourceStack) {
      return;
    }

    const targetStack = target.stack;

    if (typeof targetStack !== 'string' || !targetStack) {
      return;
    }

    // Each call to `from()` creates a fresh target. Re-wrapping includes the
    // previous stack verbatim, adding one cause section per wrap.
    const causeStack = CAUSED_BY_SEPARATOR + sourceStack;
    target.stack = targetStack + causeStack;
    Object.defineProperty(target, $causeStack, { __proto__: null, value: causeStack });
  } catch (e) {
    // Ignore failures from custom stack hooks or un-writable stack properties.
  }
}

class AxiosError extends Error {
  static from(error, code, config, request, response, customProps) {
    // `AggregateError` (thrown by Node on dual-stack/Happy-Eyeballs connection
    // failures) has an empty `message`; its detail lives in `errors[]`. Without
    // this, the wrapped error surfaces with a blank message (see #6721).
    let message = error.message;
    if (!message && utils.isArray(error.errors) && error.errors.length) {
      message = aggregateErrorMessage(error);
    }

    const axiosError = new AxiosError(message, code || error.code, config, request, response);
    // Match native `Error` `cause` semantics: non-enumerable. The wrapped
    // error often carries circular internals (sockets, requests, agents), so
    // an enumerable `cause` makes structured loggers (pino/winston) and any
    // own-property walk throw "Converting circular structure to JSON".
    // Regression from #6982; see #7205. `__proto__: null` mirrors the
    // `message` descriptor below (prototype-pollution-safe descriptor).
    Object.defineProperty(axiosError, 'cause', {
      __proto__: null,
      value: error,
      writable: true,
      enumerable: false,
      configurable: true,
    });
    axiosError.name = error.name;

    // Inline the wrapped stack for reporters that read only `stack`; the `cause`
    // property above already covers cause-aware tooling.
    appendCauseStack(axiosError, error);

    // Preserve status from the original error if not already set from response
    if (error.status != null && axiosError.status == null) {
      axiosError.status = error.status;
    }

    customProps && Object.assign(axiosError, customProps);
    return axiosError;
  }

  /**
   * Create an Error with the specified message, config, error code, request and response.
   *
   * @param {string} message The error message.
   * @param {string} [code] The error code (for example, 'ECONNABORTED').
   * @param {Object} [config] The config.
   * @param {Object} [request] The request.
   * @param {Object} [response] The response.
   *
   * @returns {Error} The created error.
   */
  constructor(message, code, config, request, response) {
    super(message);

    // Make message enumerable to maintain backward compatibility
    // The native Error constructor sets message as non-enumerable,
    // but axios < v1.13.3 had it as enumerable
    Object.defineProperty(this, 'message', {
      // Null-proto descriptor so a polluted Object.prototype.get cannot turn
      // this data descriptor into an accessor descriptor on the way in.
      __proto__: null,
      value: message,
      enumerable: true,
      writable: true,
      configurable: true,
    });

    this.name = 'AxiosError';
    this.isAxiosError = true;
    code && (this.code = code);
    config && (this.config = config);
    request && (this.request = request);
    if (response) {
      this.response = response;
      this.status = response.status;
    }
  }

  toJSON() {
    // Opt-in redaction: when the request config carries a `redact` array, the
    // value of any matching key (case-insensitive, at any depth) is replaced
    // with REDACTED in the serialized snapshot. Undefined or empty leaves the
    // existing serialization behavior unchanged.
    const config = this.config;
    const redactKeys = config && utils.hasOwnProp(config, 'redact') ? config.redact : undefined;
    const serializedConfig =
      utils.isArray(redactKeys) && redactKeys.length > 0
        ? redactConfig(config, redactKeys)
        : utils.toJSONObject(config);

    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: serializedConfig,
      code: this.code,
      status: this.status,
    };
  }
}

// This can be changed to static properties as soon as the parser options in .eslint.cjs are updated.
AxiosError.ERR_BAD_OPTION_VALUE = 'ERR_BAD_OPTION_VALUE';
AxiosError.ERR_BAD_OPTION = 'ERR_BAD_OPTION';
AxiosError.ECONNABORTED = 'ECONNABORTED';
AxiosError.ETIMEDOUT = 'ETIMEDOUT';
AxiosError.ECONNREFUSED = 'ECONNREFUSED';
AxiosError.ERR_NETWORK = 'ERR_NETWORK';
AxiosError.ERR_FR_TOO_MANY_REDIRECTS = 'ERR_FR_TOO_MANY_REDIRECTS';
AxiosError.ERR_DEPRECATED = 'ERR_DEPRECATED';
AxiosError.ERR_BAD_RESPONSE = 'ERR_BAD_RESPONSE';
AxiosError.ERR_BAD_REQUEST = 'ERR_BAD_REQUEST';
AxiosError.ERR_CANCELED = 'ERR_CANCELED';
AxiosError.ERR_NOT_SUPPORT = 'ERR_NOT_SUPPORT';
AxiosError.ERR_INVALID_URL = 'ERR_INVALID_URL';
AxiosError.ERR_FORM_DATA_DEPTH_EXCEEDED = 'ERR_FORM_DATA_DEPTH_EXCEEDED';

export default AxiosError;

```

### Core Architecture Module: `lib/core/AxiosHeaders.js`
```
'use strict';

import utils from '../utils.js';
import parseHeaders from '../helpers/parseHeaders.js';
import { sanitizeHeaderValue } from '../helpers/sanitizeHeaderValue.js';

const $internals = Symbol('internals');

function normalizeHeader(header) {
  return header && String(header).trim().toLowerCase();
}

function normalizeValue(value) {
  if (value === false || value == null) {
    return value;
  }

  return utils.isArray(value) ? value.map(normalizeValue) : sanitizeHeaderValue(String(value));
}

function parseTokens(str) {
  const tokens = Object.create(null);
  const tokensRE = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
  let match;

  while ((match = tokensRE.exec(str))) {
    tokens[match[1]] = match[2];
  }

  return tokens;
}

const parameterNameRE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function trimOWS(value) {
  let start = 0;
  let end = value.length;

  while (start < end) {
    const code = value.charCodeAt(start);

    if (code !== 0x09 && code !== 0x20) {
      break;
    }

    start += 1;
  }

  while (end > start) {
    const code = value.charCodeAt(end - 1);

    if (code !== 0x09 && code !== 0x20) {
      break;
    }

    end -= 1;
  }

  return start === 0 && end === value.length ? value : value.slice(start, end);
}

function decodeQuotedString(value) {
  const last = value.length - 1;

  if (last < 1 || value.charCodeAt(0) !== 0x22 || value.charCodeAt(last) !== 0x22) {
    return value;
  }

  let decoded = '';

  for (let i = 1; i < last; i++) {
    const code = value.charCodeAt(i);

    if (code === 0x22) {
      return value;
    }

    if (code === 0x5c) {
      i += 1;

      if (i >= last) {
        return value;
      }
    }

    decoded += value[i];
  }

  return decoded;
}

function parseParameters(value) {
  const parameters = Object.create(null);
  const str = String(value);
  let start = 0;
  let quoted = false;
  let escaped = false;

  function parseParameter(end) {
    const part = trimOWS(str.slice(start, end));
    const equals = part.indexOf('=');

    if (equals < 1) {
      return;
    }

    const name = trimOWS(part.slice(0, equals));

    if (!parameterNameRE.test(name)) {
      return;
    }

    const normalizedName = name.toLowerCase();

    if (
      normalizedName === '__proto__' ||
      normalizedName === 'constructor' ||
      normalizedName === 'prototype'
    ) {
      return;
    }

    const parameterValue = trimOWS(part.slice(equals + 1));
    parameters[normalizedName] = decodeQuotedString(parameterValue);
  }

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);

    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (code === 0x5c) {
        escaped = true;
      } else if (code === 0x22) {
        quoted = false;
      }
    } else if (code === 0x22) {
      quoted = true;
    } else if (code === 0x2c || code === 0x3b) {
      parseParameter(i);
      start = i + 1;
    }
  }

  parseParameter(str.length);

  return parameters;
}

const isValidHeaderName = (str) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(str.trim());

// `__proto__` is a valid field name, and the one name the uppercase mapping at
// the bottom of this file cannot reach: it is inherited from Object.prototype
// instead of being declared on AxiosHeaders.prototype, so `self.__proto__ = v`
// runs the inherited setter. That silently discards the header, and an array
// value replaces the instance prototype, taking every method with it.
// Store it under the same kind of case variant that mapping uses for `set` and
// `constructor`. Header lookup is caseless, so it reads back under either
// spelling, and no own `__proto__` slot is ever created for a later
// `Object.assign` to copy onto a plain object through the same setter.
const PROTO_HEADER_SLOT = '__Proto__';

const headerSlot = (name) => (name === '__proto__' ? PROTO_HEADER_SLOT : name);

function matchHeaderValue(context, value, header, filter, isHeaderNameFilter) {
  if (utils.isFunction(filter)) {
    return filter.call(context, value, header);
  }

  if (isHeaderNameFilter) {
    value = header;
  }

  if (!utils.isString(value)) return;

  if (utils.isString(filter)) {
    return value.indexOf(filter) !== -1;
  }

  if (utils.isRegExp(filter)) {
    return filter.test(value);
  }
}

function formatHeader(header) {
  return header
    .trim()
    .toLowerCase()
    .replace(/([a-z\d])(\w*)/g, (w, char, str) => {
      return char.toUpperCase() + str;
    });
}

function buildAccessors(obj, header) {
  const accessorName = utils.toCamelCase(' ' + header);

  ['get', 'set', 'has'].forEach((methodName) => {
    Object.defineProperty(obj, methodName + accessorName, {
      // Null-proto descriptor so a polluted Object.prototype.get cannot turn
      // this data descriptor into an accessor descriptor on the way in.
      __proto__: null,
      value: function (arg1, arg2, arg3) {
        return this[methodName].call(this, header, arg1, arg2, arg3);
      },
      configurable: true,
    });
  });
}

class AxiosHeaders {
  constructor(headers) {
    headers && this.set(headers);
  }

  set(header, valueOrRewrite, rewrite) {
    const self = this;

    function setHeader(_value, _header, _rewrite) {
      const lHeader = normalizeHeader(_header);

      if (!lHeader) {
        return;
      }

      const key = utils.findKey(self, lHeader);

      if (
        !key ||
        self[key] === undefined ||
        _rewrite === true ||
        (_rewrite === undefined && self[key] !== false)
      ) {
        self[headerSlot(key || _header)] = normalizeValue(_value);
      }
    }

    const setHeaders = (headers, _rewrite) =>
      utils.forEach(headers, (_value, _header) => setHeader(_value, _header, _rewrite));

    if (utils.isPlainObject(header) || header instanceof this.constructor) {
      setHeaders(header, valueOrRewrite);
    } else if (utils.isString(header) && (header = header.trim()) && !isValidHeaderName(header)) {
      setHeaders(parseHeaders(header), valueOrRewrite);
    } else if (utils.isObject(header) && utils.isSafeIterable(header)) {
      let obj = Object.create(null),
        dest,
        key;
      for (const entry of header) {
        if (!utils.isArray(entry)) {
          throw new TypeError('Object iterator must return a key-value pair');
        }

        key = entry[0];

        if (utils.hasOwnProp(obj, key)) {
          dest = obj[key];
          obj[key] = utils.isArray(dest) ? [...dest, entry[1]] : [dest, entry[1]];
        } else {
          obj[key] = entry[1];
        }
      }

      setHeaders(obj, valueOrRewrite);
    } else {
      header != null && setHeader(valueOrRewrite, header, rewrite);
    }

    return this;
  }

  get(header, parser) {
    header = normalizeHeader(header);

    if (header) {
      const key = utils.findKey(this, header);

      if (key) {
        const value = this[key];

        if (!parser) {
          return value;
        }

        if (parser === true) {
          return parseTokens(value);
        }

        if (utils.isFunction(parser)) {
          return parser.call(this, value, key);
        }

        if (utils.isRegExp(parser)) {
          return parser.exec(value);
        }

        throw new TypeError('parser must be boolean|regexp|function');
      }
    }
  }

  has(header, matcher) {
    header = normalizeHeader(header);

    if (header) {
      const key = utils.findKey(this, header);

      return !!(
        key &&
        this[key] !== undefined &&
        (!matcher || matchHeaderValue(this, this[key], key, matcher))
      );
    }

    return false;
  }

  delete(header, matcher) {
    const self = this;
    let deleted = false;

    function deleteHeader(_header) {
      _header = normalizeHeader(_header);

      if (_header) {
        const key = utils.findKey(self, _header);

        if (key && (!matcher || matchHeaderValue(self, self[key], key, matcher))) {
          delete self[key];

          deleted = true;
        }
      }
    }

    if (utils.isArray(header)) {
      header.forEach(deleteHeader);
    } else {
      deleteHeader(header);
    }

    return deleted;
  }

  clear(matcher) {
    const keys = Object.keys(this);
    let i = keys.length;
    let deleted = false;

    while (i--) {
      const key = keys[i];
      if (!matcher || matchHeaderValue(this, this[key], key, matcher, true)) {
        delete this[key];
        deleted = true;
      }
    }

    return deleted;
  }

  normalize(format) {
    const self = this;
    const headers = Object.create(null);

    utils.forEach(this, (value, header) => {
      const key = utils.findKey(headers, header);

      if (key) {
        self[key] = normalizeValue(value);
        delete self[header];
        return;
      }

      const normalized = headerSlot(format ? formatHeader(header) : String(header).trim());

      if (normalized !== header) {
        delete self[header];
      }

      self[normalized] = normalizeValue(value);

      headers[normalized] = true;
    });

    return this;
  }

  concat(...targets) {
    return this.constructor.concat(this, ...targets);
  }

  toJSON(asStrings) {
    const obj = Object.create(null);

    utils.forEach(this, (value, header) => {
      value != null &&
        value !== false &&
        (obj[header] = asStrings && utils.isArray(value) ? value.join(', ') : value);
    });

    return obj;
  }

  [Symbol.iterator]() {
    return Object.entries(this.toJSON())[Symbol.iterator]();
  }

  toString() {
    return Object.entries(this.toJSON())
      .map(([header, value]) => header + ': ' + value)
      .join('\n');
  }

  getSetCookie() {
    const value = this.get('set-cookie');
    return utils.isArray(value) ? value : value == null || value === false ? [] : [value];
  }

  get [Symbol.toStringTag]() {
    return 'AxiosHeaders';
  }

  static from(thing) {
    return thing instanceof this ? thing : new this(thing);
  }

  static parseParameters(value) {
    return parseParameters(value);
  }

  s
```

### Core Architecture Module: `lib/core/InterceptorManager.js`
```
'use strict';

import utils from '../utils.js';

const $internals = Symbol('internals');

// `handlers` is public and may be replaced with a nullish value by user code;
// `clear()` has always tolerated that. Treat it as an empty stack rather than
// dereferencing it.
function countHandlers(handlers) {
  return handlers ? handlers.length : 0;
}

function trimHandlers(handlers) {
  if (!handlers) {
    return;
  }

  while (handlers.length && handlers[handlers.length - 1] === null) {
    handlers.pop();
  }
}

// Preserve the array-key coercion used before IDs were stored in a Map, without
// treating null, empty strings, or noncanonical numeric strings as ID zero.
function normalizeHandlerId(id) {
  if (typeof id === 'string' && id !== '' && String(Number(id)) === id) {
    return Number(id);
  }

  return id;
}

function syncHandlerEntries(manager, internals) {
  const handlers = manager.handlers;
  const length = countHandlers(handlers);

  if (handlers !== internals.handlersRef) {
    internals.handlersRef = handlers;
    internals.handlerEntries.clear();
  } else if (length !== internals.handlersLength) {
    if (!length) {
      internals.handlerEntries.clear();
    } else {
      internals.handlerEntries.forEach(function removeStaleEntry(entry, id) {
        if (handlers[entry.index] !== entry.handler) {
          internals.handlerEntries.delete(id);
        }
      });
    }
  }

  internals.handlersLength = length;
}

class InterceptorManager {
  constructor() {
    this.handlers = [];
    this[$internals] = {
      handlersRef: this.handlers,
      handlersLength: this.handlers.length,
      handlerEntries: new Map(),
      iterationDepth: 0,
      nextId: 0,
    };
  }

  /**
   * Add a new interceptor to the stack
   *
   * @param {Function} fulfilled The function to handle `then` for a `Promise`
   * @param {Function} rejected The function to handle `reject` for a `Promise`
   * @param {Object} options The options for the interceptor, synchronous and runWhen
   *
   * @return {Number} An ID used to remove interceptor later
   */
  use(fulfilled, rejected, options) {
    const handler = {
      fulfilled,
      rejected,
      synchronous: options ? options.synchronous : false,
      runWhen: options ? options.runWhen : null,
    };
    const internals = this[$internals];

    if (this.handlers == null) {
      this.handlers = [];
    }

    syncHandlerEntries(this, internals);

    const id = internals.nextId++;

    this.handlers.push(handler);
    internals.handlerEntries.set(id, {
      handler,
      index: this.handlers.length - 1,
    });
    internals.handlersLength = this.handlers.length;

    return id;
  }

  /**
   * Remove an interceptor from the stack
   *
   * @param {Number} id The ID that was returned by `use`
   *
   * @returns {void}
   */
  eject(id) {
    const internals = this[$internals];

    syncHandlerEntries(this, internals);

    const handlerId = normalizeHandlerId(id);
    const entry = internals.handlerEntries.get(handlerId);

    if (entry) {
      internals.handlerEntries.delete(handlerId);

      // Ignore IDs invalidated by clear or direct replacement of handlers.
      if (this.handlers[entry.index] !== entry.handler) {
        return;
      }

      this.handlers[entry.index] = null;

      // Do not reuse an index while forEach is walking its length snapshot.
      if (!internals.iterationDepth) {
        trimHandlers(this.handlers);
        internals.handlersLength = this.handlers.length;
      }
    }
  }

  /**
   * Clear all interceptors from the stack
   *
   * @returns {void}
   */
  clear() {
    if (this.handlers) {
      this.handlers = [];
      syncHandlerEntries(this, this[$internals]);
    }
  }

  /**
   * Iterate over all the registered interceptors
   *
   * This method is particularly useful for skipping over any
   * interceptors that may have become `null` calling `eject`.
   *
   * @param {Function} fn The function to call for each interceptor
   *
   * @returns {void}
   */
  forEach(fn) {
    const internals = this[$internals];

    syncHandlerEntries(this, internals);

    internals.iterationDepth++;

    try {
      utils.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    } finally {
      if (!--internals.iterationDepth) {
        syncHandlerEntries(this, internals);
        trimHandlers(this.handlers);
        internals.handlersLength = countHandlers(this.handlers);
      }
    }
  }
}

export default InterceptorManager;

```

### Core Architecture Module: `lib/core/assertParamsAcyclic.js`
```
'use strict';

import utils from '../utils.js';
import AxiosError from './AxiosError.js';

export default function assertParamsAcyclic(params) {
  const pending = [{ value: params }];
  const active = new WeakSet();
  const visited = new WeakSet();

  while (pending.length) {
    const { value, done } = pending.pop();
    if (!utils.isPlainObject(value) && !utils.isArray(value)) continue;
    if (done) {
      active.delete(value);
      continue;
    }
    if (active.has(value)) {
      throw new AxiosError(
        'Circular reference detected in params',
        AxiosError.ERR_BAD_OPTION_VALUE
      );
    }
    if (visited.has(value)) continue;
    visited.add(value);
    active.add(value);
    pending.push({ value, done: true });

    const keys = Object.keys(value);
    if (Object.getOwnPropertySymbols && Object.getOwnPropertyDescriptor) {
      Object.getOwnPropertySymbols(value).forEach((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && descriptor.enumerable) keys.push(key);
      });
    }
    // Shallow array elements retain fields filtered during plain-object merges.
    // Inspect reserved data properties without evaluating their accessors.
    keys.forEach((key) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && utils.hasOwnProp(descriptor, 'value')) {
          pending.push({ value: descriptor.value });
        }
      } else {
        pending.push({ value: value[key] });
      }
    });
  }
}

```

### Core Architecture Module: `lib/core/assertValidRequestUrl.js`
```
'use strict';

import AxiosError from './AxiosError.js';
import adapters from '../adapters/adapters.js';
import utils from '../utils.js';

/**
 * Reject a `null` or `undefined` url that a built-in adapter would send
 * somewhere the caller did not choose.
 *
 * With params, the nullish url becomes a query-only url such as `?foo=bar`,
 * which a browser resolves against the current page. Without params, XHR
 * requests `./null` or `./undefined` and the Node adapter throws a native
 * `TypeError`.
 *
 * The request still has a destination when `baseURL` is set, or when the Node
 * HTTP adapter is given a `socketPath`. A caller-supplied adapter handles its
 * own destination and is not checked.
 *
 * `dispatchRequest` and `Axios#getUri` both call this, so `getUri` rejects
 * exactly the configs that a request would reject. Request interceptors are
 * not run by `getUri`, so a url that an interceptor would supply is still
 * missing there. Keep this out of `buildURL` and `buildFullPath`: they only
 * format urls and have other callers.
 *
 * @param {Object} config The merged request config
 * @param {Function} resolveAdapter Returns the adapter that handles the
 * request. Called only for a nullish url without `baseURL`, so a usable url
 * never depends on adapter resolution.
 *
 * @returns {void}
 */
export default function assertValidRequestUrl(config, resolveAdapter) {
  const url = utils.getSafeProp(config, 'url');

  if (url !== null && url !== undefined) {
    return;
  }

  if (utils.getSafeProp(config, 'baseURL')) {
    return;
  }

  const adapter = resolveAdapter();

  // Only the Node HTTP adapter reads socketPath; XHR and fetch ignore it.
  const httpAdapter = adapters.adapters.http;

  if (httpAdapter && adapter === httpAdapter && utils.getSafeProp(config, 'socketPath')) {
    return;
  }

  if (!adapters.isBuiltinAdapter(adapter)) {
    return;
  }

  throw new AxiosError(
    `Invalid URL: url cannot be ${url === null ? 'null' : 'undefined'} when baseURL is not set`,
    AxiosError.ERR_INVALID_URL,
    config
  );
}

```

### Core Architecture Module: `lib/core/createMultipartBody.js`
```
import utils from '../utils.js';
import platform from '../platform/index.js';
import AxiosError from './AxiosError.js';
import formDataToBlob, { FormDataError } from '../helpers/formDataToBlob.js';

export default function createMultipartBody(form, Blob, limit, limitError, boundary) {
  // Report missing Blob support before trying to select a random source.
  if (!utils.isFunction(Blob)) {
    throw new AxiosError('Blob is not supported', AxiosError.ERR_NOT_SUPPORT);
  }

  if (boundary === undefined) {
    if (utils.isFunction(platform.generateString)) {
      boundary = 'axios-' + platform.generateString(36, '0123456789abcdef');
    } else {
      const crypto = utils.global.crypto;
      if (!crypto || !utils.isFunction(crypto.getRandomValues)) {
        throw new AxiosError('Random byte generation is not supported', AxiosError.ERR_NOT_SUPPORT);
      }
      const random = new Uint8Array(18);
      crypto.getRandomValues(random);
      boundary =
        'axios-' + Array.from(random, (value) => ('0' + value.toString(16)).slice(-2)).join('');
    }
  }

  try {
    return formDataToBlob(form, Blob, limit, limitError, boundary);
  } catch (error) {
    if (error instanceof FormDataError) {
      const code =
        error.reason === 'boundary' ? AxiosError.ERR_BAD_OPTION_VALUE : AxiosError.ERR_BAD_REQUEST;
      throw new AxiosError(error.message, code);
    }
    throw error;
  }
}

```

### Core Architecture Module: `lib/core/dispatchRequest.js`
```
'use strict';

import transformData from './transformData.js';
import isCancel from '../cancel/isCancel.js';
import defaults from '../defaults/index.js';
import CanceledError from '../cancel/CanceledError.js';
import AxiosHeaders from '../core/AxiosHeaders.js';
import adapters from '../adapters/adapters.js';
import utils from '../utils.js';
import assertValidRequestUrl from './assertValidRequestUrl.js';

/**
 * Throws a `CanceledError` if cancellation has been requested.
 *
 * @param {Object} config The config that is to be used for the request
 *
 * @returns {void}
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }

  if (config.signal && config.signal.aborted) {
    throw new CanceledError(null, config);
  }
}

/**
 * Resolve the clock used to time adapter execution.
 *
 * Prefers the monotonic `performance.now()` so wall-clock adjustments do not
 * skew the measurement, and so frameworks that forbid reading the current
 * time during prerendering (e.g. Next.js Cache Components) accept it. Falls
 * back to `Date.now()` in runtimes without the High Resolution Time API.
 *
 * @returns {() => number} Millisecond clock
 */
function resolveClock() {
  return typeof performance !== 'undefined' && utils.isFunction(performance.now)
    ? () => performance.now()
    : Date.now;
}

/**
 * Whole milliseconds elapsed since `start`, floored at zero.
 *
 * Rounded so the value stays an integer as with `Date.now()`. The fallback
 * wall clock can move backwards mid-request, so the result is clamped.
 *
 * @param {() => number} now Clock returned by `resolveClock()`
 * @param {number} start Timestamp read from `now`
 *
 * @returns {number} Non-negative elapsed milliseconds
 */
function elapsedSince(now, start) {
  return Math.max(0, Math.round(now() - start));
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 *
 * @returns {Promise} The Promise to be fulfilled
 */
export default function dispatchRequest(_config) {
  // Interceptors may replace the merged config with an ordinary object. Flatten
  // it at the dispatch boundary so shared prototype members cannot become
  // request behavior, while preserving intentional template/class members.
  const config = utils.toSafeFlatObject(_config);

  throwIfCancellationRequested(config);

  config.headers = AxiosHeaders.from(utils.getSafeProp(config, 'headers'));

  // Transform request data
  config.data = transformData.call(config, config.transformRequest);

  if (['post', 'put', 'patch'].indexOf(config.method) !== -1) {
    config.headers.setContentType('application/x-www-form-urlencoded', false);
  }

  const adapter = adapters.getAdapter(config.adapter || defaults.adapter, config);

  // Runs after resolution so a custom adapter is recognized in any form.
  assertValidRequestUrl(config, () => adapter);

  const now = resolveClock();
  const start = now();

  return adapter(config).then(
    function onAdapterResolution(response) {
      throwIfCancellationRequested(config);

      response.duration = elapsedSince(now, start);

      // Expose the current response on config so that transformResponse can
      // attach it to any AxiosError it throws (e.g. on JSON parse failure).
      // We clean it up afterwards to avoid polluting the config object.
      config.response = response;
      try {
        response.data = transformData.call(config, config.transformResponse, response);
      } finally {
        delete config.response;
      }

      response.headers = AxiosHeaders.from(response.headers);

      return response;
    },
    function onAdapterRejection(reason) {
      if (!isCancel(reason)) {
        throwIfCancellationRequested(config);

        // Transform response data
        if (reason && reason.response) {
          reason.response.duration = elapsedSince(now, start);
          config.response = reason.response;
          try {
            reason.response.data = transformData.call(
              config,
              config.transformResponse,
              reason.response
            );
          } finally {
            delete config.response;
          }
          reason.response.headers = AxiosHeaders.from(reason.response.headers);
        }
      }

      return Promise.reject(reason);
    }
  );
}

```

### Core Architecture Module: `lib/core/mergeConfig.js`
```
'use strict';

import utils from '../utils.js';
import AxiosHeaders from './AxiosHeaders.js';
import assertParamsAcyclic from './assertParamsAcyclic.js';

const headersToObject = (thing) => (thing instanceof AxiosHeaders ? { ...thing } : thing);

const ownEnumerableKeys = (thing) => {
  if (Object.getOwnPropertySymbols && Object.getOwnPropertyDescriptor) {
    return Object.keys(thing).concat(
      Object.getOwnPropertySymbols(thing).filter((symbol) => {
        const descriptor = Object.getOwnPropertyDescriptor(thing, symbol);
        return descriptor && descriptor.enumerable;
      })
    );
  }
  return Object.keys(thing);
};

// Copy params without recursive merges so the serializer remains responsible
// for its depth policy. Only visit defaults that contribute to the result.
function mergeParams(a, b) {
  const pending = [];
  const copies = new WeakMap();
  const empty = {};

  function copy(target, source) {
    if (!utils.isPlainObject(source)) {
      return utils.isArray(source) ? source.slice() : source;
    }

    const base = utils.isPlainObject(target) ? target : empty;
    let bases = copies.get(source);
    if (!bases) {
      bases = new WeakMap();
      copies.set(source, bases);
    }
    if (bases.has(base)) return bases.get(base);

    const result = {};
    bases.set(base, result);
    pending.push({ base, source, result });
    return result;
  }

  const result = utils.isUndefined(b) ? copy(undefined, a) : copy(a, b);
  while (pending.length) {
    const { base, source, result: target } = pending.pop();
    const baseKeys = new Set(ownEnumerableKeys(base));
    const sourceKeys = new Set(ownEnumerableKeys(source));
    const keys = new Set([...baseKeys, ...sourceKeys]);

    keys.forEach((key) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
      const hasSource = sourceKeys.has(key);
      const value = hasSource ? source[key] : undefined;
      const previous =
        (!hasSource || utils.isPlainObject(value)) && baseKeys.has(key) ? base[key] : undefined;
      target[key] = hasSource ? copy(previous, value) : copy(undefined, previous);
    });
  }

  assertParamsAcyclic(result);
  return result;
}

function getMergedValue(target, source, prop, caseless) {
  if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
    return utils.merge.call({ caseless }, target, source);
  } else if (utils.isPlainObject(source)) {
    return utils.merge({}, source);
  } else if (utils.isArray(source)) {
    return source.slice();
  }
  return source;
}

function mergeDeepProperties(a, b, prop, caseless) {
  if (!utils.isUndefined(b)) {
    return getMergedValue(a, b, prop, caseless);
  } else if (!utils.isUndefined(a)) {
    return getMergedValue(undefined, a, prop, caseless);
  }
}

// eslint-disable-next-line consistent-return
function valueFromConfig2(a, b) {
  if (!utils.isUndefined(b)) {
    return getMergedValue(undefined, b);
  }
}

// eslint-disable-next-line consistent-return
function defaultToConfig2(a, b) {
  if (!utils.isUndefined(b)) {
    return getMergedValue(undefined, b);
  } else if (!utils.isUndefined(a)) {
    return getMergedValue(undefined, a);
  }
}

function getMergedTransitionalOption(config1, config2, prop) {
  const transitional2 = utils.hasOwnProp(config2, 'transitional')
    ? config2.transitional
    : undefined;

  if (!utils.isUndefined(transitional2)) {
    if (utils.isPlainObject(transitional2)) {
      if (utils.hasOwnProp(transitional2, prop)) {
        return transitional2[prop];
      }
    } else {
      return undefined;
    }
  }

  const transitional1 = utils.hasOwnProp(config1, 'transitional')
    ? config1.transitional
    : undefined;

  if (utils.isPlainObject(transitional1) && utils.hasOwnProp(transitional1, prop)) {
    return transitional1[prop];
  }

  return undefined;
}

// eslint-disable-next-line consistent-return
function mergeDirectKeys(a, b, prop, config1, config2) {
  if (utils.hasOwnProp(config2, prop)) {
    return getMergedValue(a, b);
  } else if (utils.hasOwnProp(config1, prop)) {
    return getMergedValue(undefined, a);
  }
}

function mergeHeaders(a, b, prop) {
  return mergeDeepProperties(headersToObject(a), headersToObject(b), prop, true);
}

// Null-proto, frozen descriptor so a polluted Object.prototype.get cannot turn
// this data descriptor into an accessor descriptor on the way in.
// defineProperty only reads it, so one shared instance serves every call.
const hasOwnPropertyDescriptor = Object.freeze({
  __proto__: null,
  value: Object.prototype.hasOwnProperty,
  enumerable: false,
  writable: true,
  configurable: true,
});

// The strategy table and the strategies above are stateless, so they are
// built once at module load instead of on every call: mergeConfig runs at
// most twice per request (once from a method alias, once from `_request`).
const mergeMap = {
  url: valueFromConfig2,
  method: valueFromConfig2,
  data: valueFromConfig2,
  baseURL: defaultToConfig2,
  transformRequest: defaultToConfig2,
  transformResponse: defaultToConfig2,
  params: mergeParams,
  paramsSerializer: defaultToConfig2,
  timeout: defaultToConfig2,
  timeoutErrorMessage: defaultToConfig2,
  withCredentials: defaultToConfig2,
  withXSRFToken: defaultToConfig2,
  adapter: defaultToConfig2,
  responseType: defaultToConfig2,
  xsrfCookieName: defaultToConfig2,
  xsrfHeaderName: defaultToConfig2,
  onUploadProgress: defaultToConfig2,
  onDownloadProgress: defaultToConfig2,
  decompress: defaultToConfig2,
  maxContentLength: defaultToConfig2,
  maxBodyLength: defaultToConfig2,
  beforeRedirect: defaultToConfig2,
  transport: defaultToConfig2,
  httpAgent: defaultToConfig2,
  httpsAgent: defaultToConfig2,
  cancelToken: defaultToConfig2,
  socketPath: defaultToConfig2,
  allowedSocketPaths: defaultToConfig2,
  responseEncoding: defaultToConfig2,
  validateStatus: mergeDirectKeys,
  headers: mergeHeaders,
};

/**
 * Config-specific merge-function which creates a new config-object
 * by merging two configuration objects together.
 *
 * @param {Object} config1
 * @param {Object} config2
 *
 * @returns {Object} New object resulting from merging config2 to config1
 */
export default function mergeConfig(config1, config2) {
  // eslint-disable-next-line no-param-reassign
  config1 = config1 || {};
  config2 = config2 || {};

  // Use a null-prototype object so that downstream reads such as `config.auth`
  // or `config.baseURL` cannot inherit polluted values from Object.prototype.
  // `hasOwnProperty` is restored as a non-enumerable own slot to preserve
  // ergonomics for user code that relies on it.
  const config = Object.create(null);
  Object.defineProperty(config, 'hasOwnProperty', hasOwnPropertyDescriptor);

  const keys = ownEnumerableKeys({ ...config1, ...config2 });

  for (let i = 0, len = keys.length; i < len; i++) {
    const prop = keys[i];
    if (prop === '__proto__' || prop === 'constructor' || prop === 'prototype') continue;
    const merge = utils.hasOwnProp(mergeMap, prop) ? mergeMap[prop] : mergeDeepProperties;
    const a = utils.hasOwnProp(config1, prop) ? config1[prop] : undefined;
    const b = utils.hasOwnProp(config2, prop) ? config2[prop] : undefined;
    const configValue =
      merge === mergeDirectKeys ? merge(a, b, prop, config1, config2) : merge(a, b, prop);
    (utils.isUndefined(configValue) && merge !== mergeDirectKeys) || (config[prop] = configValue);
  }

  if (
    utils.hasOwnProp(config2, 'validateStatus') &&
    utils.isUndefined(config2.validateStatus) &&
    getMergedTransitionalOption(config1, config2, 'validateStatusUndefinedResolves') === false
  ) {
    if (utils.hasOwnProp(config1, 'validateStatus')) {
      config.validateStatus = getMergedValue(undefined, config1.validateStatus);
    } else {
      delete config.validateStatus;
    }
  }

  return config;
}

```

### Core Architecture Module: `lib/core/methodList.js`
```
'use strict';

const methodList = Object.freeze([
  'get',
  'delete',
  'head',
  'options',
  'post',
  'put',
  'patch',
  'purge',
  'link',
  'unlink',
  'query',
]);

export default methodList;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11455** (2026-11-15): **fix(http): reject negative timeouts instead of crashing the process (v0.x)**
  *Symptoms*: ## Summary  Port of the v1.x fix in #11246 to the v0.x line, limited to the part that cannot change working requests.  A `timeout` whose base-10 integer conversion is negative (`-1`, `'-1'`, `-1e-7`, `'-1e-324'`) reached `req.setTimeout()`, which Node rejects with `ERR_OUT_OF_RANGE`:  - With the default transport (follow-redirects), the `RangeError` is thrown from a socket callback as an uncaught exception that crashes the process, and the axios promise never settles. - With `maxRedirects: 0`, it rejects with a raw `RangeError` instead of an `AxiosError`.  This is easy to hit when a timeout is computed from a deadline that has already passed (`timeout: deadline - Date.now()`).  ## Changes  - `lib/adapters/http.js`:   - After `data:` URL handling and the protocol check, and before the request is created, a timeout whose integer conversion is negative now rejects with the standard timeout error (`ECONNABORTED`, or `ETIMEDOUT` with `transitional.clarifyTimeoutError`). No connection is opened.   - The timeout error construction moved into a `createTimeoutError()` helper shared with the existing `req.setTimeout` handler; its message and code logic are unchanged.   - `parseInt` stays inside a `try` for the same reason as the existing parse (null-prototype config values). - `test/unit/adapters/http.js`: a regression test for `-1`, `'-1'`, `-1e-7` and `'-1e-324'` on both the follow-redirects and `maxRedirects: 0` paths, plus `clarifyTimeoutError`, asserting the server receives no req

- **Issue #11454** (2026-11-15): **fix(fetch): cancel the response stream probe body**
  *Symptoms*: ## Summary  Port of the v1.x fetch capability probe cleanup in #11241.  The response-stream probe reads `new Response('').body` and never cancels it. On Node.js 22 and older that body leaves its stream's internal closed promise pending, which async-leak detectors such as Vitest's `--detect-async-leaks` report once for every test file that loads axios. Node.js 24 and later do not create the pending promise. The v2.x probe code was identical to pre-fix v1.x, so the change is the same.  ## Changes  - **Response-stream probe:** cancels its probe body in `finally`, so cleanup runs whether the check returns or throws. Best-effort: a custom `env.Response` body with no `cancel()`, or whose `cancel()` throws or rejects, keeps the detected support. - **Request-stream probe:** detection unchanged, including a `cancel()` that throws still failing the probe. A rejected cancellation (for example from a locked polyfilled body) is now handled instead of surfacing as an unhandled rejection. - **Rejection handling:** reads the cancellation result's `then` once and calls it directly, without the global `Promise` or `Promise.prototype.catch`. - `PRE_RELEASE_CHANGELOG.md` Bug Fixes entry and a `PRE_RELEASE_DOCS.md` note for `apps/docs/pages/advanced/fetch-adapter.md`.  ## Tests  `packages/axios/tests/unit/adapters/fetch.test.js`, `capability probe cleanup` (same tests as v1.x): each probe cancels its exact body once and the stream ends `closed`; response support survives a missing, throwing, reje

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

### Incident Patch 1: `c0d4c900` (2026-11-16)
**Commit Message**: fix(http): reject negative timeouts instead of crashing the process (#11246)

Co-authored-by: Jason Saayman <[REDACTED_EMAIL]>

**File**: `PRE_RELEASE_CHANGELOG.md` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@
 - **`getAdapter` typings:** `getAdapter(adapters, config?)` in `index.d.ts` and `index.d.cts` now accepts the optional request config that the runtime already forwards to adapter getters, so `getAdapter('fetch', { env: { fetch } })` type-checks without a cast. A JSDoc comment on the parameter notes that the built-in `fetch` adapter reads `env.fetch`, `env.Request`, and `env.Response` from it and that other fields are not applied. Type-only; additive and backwards compatible, no runtime change. ([#11403](https://github.com/axios/axios/issues/11403), [#11404](https://github.com/axios/axios/pull/11404))
 - **Header encoding shortcuts:** The documented `Content-Encoding` shortcuts (`setContentEncoding`, `getContentEncoding`, `hasContentEncoding`) now exist at runtime; previously `getContentEncoding()` threw `TypeError` because `AxiosHeaders` only registered the `Accept-Encoding` accessor. The `Accept-Encoding` trio that the runtime already provided is now declared in `index.d.ts` and `index.d.cts`. `getContentEncoding` and `getAcceptEncoding` are typed to match `AxiosHeaders#get`: `AxiosHeaders.parseParameters` returns `AxiosHeaderParameters`, a `RegExp` returns `RegExpExecArray | null`, and no argument, `true`, or another parser function returns `AxiosHeaderValue`. The type changes are compile-time corrections, not purely additive: `getContentEncoding()` was previously declared to return `RegExpExecArray | null` and to accept string matchers, which throw `parser must be boolean|regexp|function` at runtime, and `getAcceptEncoding()` previously resolved to `any` through the `AxiosHeaders` index signature. TypeScript callers that relied on those declarations may need to narrow the result or pass a supported parser. No change to how existing headers are read or written at runtime; the matching README and docs-site shortcut-list updates are recorded in `PRE_RELEASE_DOCS.md` for release preparation. ([#11432](https://github.com/axios/axios/issues/11432))
 - **Fetch adapter - capability probe cleanup:** The response-stream capability probe now cancels the throwaway `new Response('')` body it reads. On Node.js 22 and older, that body left its stream's internal closed promise pending, which async-leak detectors such as Vitest's `--detect-async-leaks` reported once for every test file that loaded axios; Node.js 24 and later are unaffected. The cleanup is best-effort and runs whether the check returns or throws: a custom `env.Response` whose probe body has no `cancel()`, or whose `cancel()` throws or rejects, keeps the response-stream support the probe detected. The request-stream probe, which already cancelled its body, now also handles a rejected cancellation (for example from a locked polyfilled stream) instead of leaving an unhandled rejection; its detection is unchanged. No public API or type changes. ([#11240](https://github.com/axios/axios/issues/11240), **[#11241](https://github.com/axios/axios/pull/11241)**)
+- **Node HTTP adapter - negative timeouts:** A negative `timeout`, including fractional values such as `-0.5`, now fails as a timeout (`ECONNABORTED`, or `ETIMEDOUT` with `transitional.clarifyTimeoutError`) before any connection is opened. Previously Node's `ERR_OUT_OF_RANGE` was thrown from a follow-redirects socket callback as an uncaught exception that crashed the process and left the request unsettled, or surfaced as a raw `RangeError` with `maxRedirects: 0`, while fractional negatives were truncated to `-0` and disabled the timeout on the native transport. This commonly happens when a timeout is computed from a deadline that has already passed. `-Infinity` and strings such as `"-Infinity"` or `"-.5"`, which previously rejected with `ERR_BAD_OPTION_VALUE`, now also fail as a timeout. Other config errors, such as a body over `maxBodyLength`, are still reported first, and `data:` URLs still ignore the timeout. With `onUploadProgress` or `maxRate`, the upload stream now starts only once the request goes ahead, so a rejected config no longer starts reading the request body. A timeout whose integer conversion overflows to `Infinity`, such as a very long digit string, now rejects with `ERR_BAD_OPTION_VALUE` instead of crashing the same way. The timeout is converted once, and valid timeouts keep their existing integer conversion, including exponent-form strings such as `"1e3"`, which still apply their integer prefix. The fetch adapter is unchanged: it also times out a negative timeout almost at once (Node clamps the timer to 1 ms), always with `ETIMEDOUT`. No public API or type changes. ([#11246](https://github.com/axios/axios/pull/11246))
 
 ## Documentation
 
```

**File**: `lib/adapters/http.js` (modified, +59/-35)
```diff
@@ -754,8 +754,7 @@ export default isHttpAdapterSupported &&
         }
       }
 
-      function createTimeoutError() {
-        const configTimeout = own('timeout');
+      function createTimeoutError(configTimeout = own('timeout')) {
         let timeoutErrorMessage = configTimeout
           ? 'timeout of ' + configTimeout + 'ms exceeded'
           : 'timeout exceeded';
@@ -994,34 +993,6 @@ export default isHttpAdapterSupported &&
         maxUploadRate = maxDownloadRate = maxRate;
       }
 
-      if (data && (onUploadProgress || maxUploadRate)) {
-        if (!utils.isStream(data)) {
-          data = stream.Readable.from(data, { objectMode: false });
-        }
-
-        data = stream.pipeline(
-          [
-            data,
-            new AxiosTransformStream({
-              maxRate: utils.toFiniteNumber(maxUploadRate),
-            }),
-          ],
-          utils.noop
-        );
-
-        onUploadProgress &&
-          data.on(
-            'progress',
-            flushOnFinish(
-              data,
-              progressEventDecorator(
-                contentLength,
-                progressEventReducer(asyncDecorator(onUploadProgress, scheduleProgress), false, 3)
-              )
-            )
-          );
-      }
-
       // HTTP basic authentication
       let auth = undefined;
       const configAuth = own('auth');
@@ -1254,6 +1225,57 @@ export default isHttpAdapterSupported &&
       // through Node's internal options copy
       options.insecureHTTPParser = Boolean(own('insecureHTTPParser'));
 
+      // Read and convert the timeout once, so the value checked here is the value applied and
+      // reported below, and fail a negative timeout (for example from a deadline that has
+      // already passed) as an elapsed timeout before connecting. Passed through, Node would
+      // throw a RangeError that follow-redirects raises outside this promise. It runs after the
+      // other config checks so their errors win, and data: URLs above never apply a timeout.
+      // parseFloat also treats fractions such as -0.5 as elapsed (parseInt yields -0, which
+      // disables the timeout on the native transport), and parseInt catches strings such as
+      // '-1e-324' that parseFloat reads as -0.
+      const rawTimeout = own('timeout');
+      let timeoutString;
+      let parsedTimeout;
+
+      if (rawTimeout) {
+        timeoutString = `${rawTimeout}`;
+        parsedTimeout = parseInt(timeoutString, 10);
+
+        if (parseFloat(timeoutString) < 0 || parsedTimeout < 0) {
+          return reject(createTimeoutError(timeoutString));
+        }
+      }
+
+      // Start the upload pipeline only once the request goes ahead, so a config rejected above
+      // never starts reading the body.
+      if (data && (onUploadProgress || maxUploadRate)) {
+        if (!utils.isStream(data)) {
+          data = stream.Readable.from(data, { objectMode: false });
+        }
+
+        data = stream.pipeline(
+          [
+            data,
+            new AxiosTransformStream({
+              maxRate: utils.toFiniteNumber(maxUploadRate),
+            }),
+          ],
+          utils.noop
+        );
+
+        onUploadProgress &&
+          data.on(
+            'progress',
+            flushOnFinish(
+              data,
+              progressEventDecorator(
+                contentLength,
+                progressEventReducer(asyncDecorator(onUploadProgress, scheduleProgress), false, 3)
+              )
+            )
+          );
+      }
+
       // Create the request
       req = transport.request(options, function handleResponse(res) {
         clearConnectPhaseTimer();
@@ -1501,11 +1523,13 @@ export default isHttpAdapterSupported &&
       });
 
       // Handle request timeout
-      if (own('timeout')) {
-        // This is forcing a int timeout to avoid problems if the `req` interface doesn't handle other types.
-        const timeout = parseInt(own('timeout'), 10);
+      if (rawTimeout) {
+        // An int timeout, converted once above, avoids problems if the `req` interface doesn't
+        // handle other types. Node also rejects non-finite values, such as the Infinity that
+        // parseInt returns for a very long digit string, so treat those as unparsable too.
+        const timeout = parsedTimeout;
 
-        if (Number.isNaN(timeout)) {
+        if (!Number.isFinite(timeout)) {
           abort(
             new AxiosError(
               'error trying to parse `config.timeout` to int',
@@ -1520,7 +1544,7 @@ export default isHttpAdapterSupported &&
 
         const handleTimeout = function handleTimeout() {
           if (isDone) return;
-          abort(createTimeoutError());
+          abort(createTimeoutError(timeoutString));
         };
 
         if (isNativeTransport && timeout > 0) {
```

**File**: `tests/unit/adapters/http.test.js` (modified, +237/-0)
```diff
@@ -162,6 +162,243 @@ describe('supports http with nodejs', () => {
     }
   });
 
+  it('should reject a negative timeout as an immediate timeout instead of crashing', async () => {
+    let requests = 0;
+    let connections = 0;
+    const server = await startHTTPServer((req, res) => {
+      requests++;
+      res.end('ok');
+    });
+    server.on('connection', () => connections++);
+    const url = `http://localhost:${server.address().port}`;
+
+    try {
+      for (const [timeout, maxRedirects] of [
+        [-1, undefined],
+        [-1, 0],
+        [-0.5, undefined],
+        [-0.5, 0],
+        ['-1', undefined],
+        ['-1', 0],
+        [-1n, undefined],
+        [-Infinity, undefined],
+        [-Infinity, 0],
+        ['-1e-324', undefined],
+        ['-1e-324', 0],
+        ['-1e-7', undefined],
+        ['-1e-7', 0],
+      ]) {
+        await assert.rejects(
+          axios.get(url, { timeout, maxRedirects }),
+          (error) => {
+            assert.ok(error instanceof AxiosError);
+            assert.strictEqual(error.code, AxiosError.ECONNABORTED);
+            assert.strictEqual(error.message, `timeout of ${timeout}ms exceeded`);
+            return true;
+          },
+          `timeout ${String(timeout)} with maxRedirects ${maxRedirects}`
+        );
+      }
+
+      await assert.rejects(
+        axios.get(url, {
+          timeout: -1,
+          transitional: { clarifyTimeoutError: true },
+        }),
+        (error) => {
+          assert.ok(error instanceof AxiosError);
+          assert.strictEqual(error.code, AxiosError.ETIMEDOUT);
+          return true;
+        }
+      );
+
+      await assert.rejects(
+        axios.get(url, { timeout: -1, timeoutErrorMessage: 'deadline passed' }),
+        (error) => {
+          assert.strictEqual(error.code, AxiosError.ECONNABORTED);
+          assert.strictEqual(error.message, 'deadline passed');
+          return true;
+        }
+      );
+
+      // Give any socket that was opened time to reach the server before counting.
+      await setTimeoutAsync(50);
+
+      assert.strictEqual(requests, 0);
+      assert.strictEqual(connections, 0);
+    } finally {
+      await stopHTTPServer(server);
+    }
+  });
+
+  it('should report other config errors before a negative timeout', async () => {
+    const server = await startHTTPServer((req, res) => res.end('ok'));
+    const url = `http://localhost:${server.address().port}`;
+
+    try {
+      await assert.rejects(
+        axios.post(url, 'x'.repeat(100), { timeout: -1, maxBodyLength: 10 }),
+        (error) => {
+          assert.strictEqual(error.code, AxiosError.ERR_BAD_REQUEST);
+          return true;
+        }
+      );
+
+      await assert.rejects(axios.get(url, { timeout: -1, socketPath: 123 }), (error) => {
+        assert.strictEqual(error.code, AxiosError.ERR_BAD_OPTION_VALUE);
+        return true;
+      });
+    } finally {
+      await stopHTTPServer(server);
+    }
+  });
+
+  it('should convert the timeout once, so the checked value is the applied value', async () => {
+    let requests = 0;
+    const server = await startHTTPServer((req, res) => {
+      requests++;
+      setTimeout(() => res.end('ok'), 300);
+    });
+    const url = `http://localhost:${server.address().port}`;
+
+    try {
+      for (const maxRedirects of [undefined, 0]) {
+        let conversions = 0;
+        // Valid on the first conversion and negative afterwards: converting again would either
+        // fail the request early or hand -1 to req.setTimeout and crash.
+        const timeout = { toString: () => (conversions++ === 0 ? '50' : '-1') };
+
+        await assert.rejects(
+          axios.get(url, { timeout, maxRedirects }),
+          (error) => {
+            assert.ok(error instanceof AxiosError);
+            assert.strictEqual(error.code, AxiosError.ECONNABORTED);
+            assert.strictEqual(error.message, 'timeout of 50ms exceeded');
+            return true;
+          },
+          `maxRedirects ${maxRedirects}`
+        );
+      }
+
+      assert.strictEqual(requests, 2);
+    } finally {
+      await stopHTTPServer(server);
+    }
+  });
+
+  it('should not start reading an upload body when the config is rejected', async () => {
+    const server = await startHTTPServer((req, res) => res.end('ok'));
+    const url = `http://localhost:${server.address().port}`;
+
+    try {
+      for (const [name, config, code] of [
+        ['negative timeout', { timeout: -1 }, AxiosError.ECONNABORTED],
+        [
+          'throwing paramsSerializer',
+          {
+            params: { a: 1 },
+            paramsSerializer: () => {
+              throw new Error('bad params');
+            },
+          },
+          AxiosError.ERR_BAD_REQUEST,
+        ],
+      ]) {
+        for (const upload of [{ onUploadProgress: () => {} }, { maxRate: [1024, 0] }]) {
+          let reads = 0;
+          const body = new stream.Readable({
+            read() {
+              read
```

---

### Incident Patch 2: `85ffbafa` (2026-11-15)
**Commit Message**: fix(fetch): cancel ReadableStream body after response stream capability probe (#11241)

Co-authored-by: Jason Saayman <[REDACTED_EMAIL]>

**File**: `PRE_RELEASE_CHANGELOG.md` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@
 - **Response duration clock:** `response.duration` is now measured with the monotonic `performance.now()` instead of `Date.now()`, falling back to `Date.now()` only in runtimes without `performance.now()`. Since v1.21.0, axios read `Date.now()` on every request, which broke Next.js production builds that use Cache Components (`cacheComponents: true`) because Next.js rejects reading the current time while prerendering; `performance.now()` is the timing API Next.js allows for this. The monotonic clock also stops system clock adjustments from skewing the value. `duration` is rounded to whole milliseconds, so it stays an integer as in v1.21.0, and it is still clamped at `0`. No public API or type changes; the `duration` declaration comments in `index.d.ts` and `index.d.cts` now name the clock. ([#11407](https://github.com/axios/axios/issues/11407))
 - **`getAdapter` typings:** `getAdapter(adapters, config?)` in `index.d.ts` and `index.d.cts` now accepts the optional request config that the runtime already forwards to adapter getters, so `getAdapter('fetch', { env: { fetch } })` type-checks without a cast. A JSDoc comment on the parameter notes that the built-in `fetch` adapter reads `env.fetch`, `env.Request`, and `env.Response` from it and that other fields are not applied. Type-only; additive and backwards compatible, no runtime change. ([#11403](https://github.com/axios/axios/issues/11403), [#11404](https://github.com/axios/axios/pull/11404))
 - **Header encoding shortcuts:** The documented `Content-Encoding` shortcuts (`setContentEncoding`, `getContentEncoding`, `hasContentEncoding`) now exist at runtime; previously `getContentEncoding()` threw `TypeError` because `AxiosHeaders` only registered the `Accept-Encoding` accessor. The `Accept-Encoding` trio that the runtime already provided is now declared in `index.d.ts` and `index.d.cts`. `getContentEncoding` and `getAcceptEncoding` are typed to match `AxiosHeaders#get`: `AxiosHeaders.parseParameters` returns `AxiosHeaderParameters`, a `RegExp` returns `RegExpExecArray | null`, and no argument, `true`, or another parser function returns `AxiosHeaderValue`. The type changes are compile-time corrections, not purely additive: `getContentEncoding()` was previously declared to return `RegExpExecArray | null` and to accept string matchers, which throw `parser must be boolean|regexp|function` at runtime, and `getAcceptEncoding()` previously resolved to `any` through the `AxiosHeaders` index signature. TypeScript callers that relied on those declarations may need to narrow the result or pass a supported parser. No change to how existing headers are read or written at runtime; the matching README and docs-site shortcut-list updates are recorded in `PRE_RELEASE_DOCS.md` for release preparation. ([#11432](https://github.com/axios/axios/issues/11432))
+- **Fetch adapter - capability probe cleanup:** The response-stream capability probe now cancels the throwaway `new Response('')` body it reads. On Node.js 22 and older, that body left its stream's internal closed promise pending, which async-leak detectors such as Vitest's `--detect-async-leaks` reported once for every test file that loaded axios; Node.js 24 and later are unaffected. The cleanup is best-effort and runs whether the check returns or throws: a custom `env.Response` whose probe body has no `cancel()`, or whose `cancel()` throws or rejects, keeps the response-stream support the probe detected. The request-stream probe, which already cancelled its body, now also handles a rejected cancellation (for example from a locked polyfilled stream) instead of leaving an unhandled rejection; its detection is unchanged. No public API or type changes. ([#11240](https://github.com/axios/axios/issues/11240), **[#11241](https://github.com/axios/axios/pull/11241)**)
 
 ## Documentation
 
```

**File**: `PRE_RELEASE_DOCS.md` (modified, +9/-0)
```diff
@@ -129,3 +129,12 @@ Do not store raw diffs or line-number-only instructions here; prefer stable sect
 - **Docs targets:** `README.md` AxiosHeaders Shortcuts, `docs/pages/advanced/header-methods.md` Shortcuts, and the Spanish, French, and Chinese translations.
 - **Required content:** Keep the `setContentEncoding`, `getContentEncoding`, `hasContentEncoding` entries, which now match the runtime. Add `setAcceptEncoding`, `getAcceptEncoding`, `hasAcceptEncoding`; add the existing `Authorization` shortcuts (`setAuthorization`, `getAuthorization`, `hasAuthorization`); and mention `getSetCookie()` in the methods list, since none of these appear in the shortcut lists today.
 - **Notes:** Release-time documentation only; the runtime and type changes ship with the PR. Translations use their own section headings and may need localized wording.
+
+### Fetch capability probe cleanup
+
+- **Change:** The fetch adapter now cancels the throwaway body it reads while probing for response-stream support.
+- **Source:** [PR #11241](https://github.com/axios/axios/pull/11241); `PRE_RELEASE_CHANGELOG.md` Bug Fixes, Fetch adapter - capability probe cleanup.
+- **Status:** Pending.
+- **Docs targets:** `docs/pages/advanced/fetch-adapter.md`, the custom `env.Response` paragraph about stream bodies.
+- **Required content:** One sentence: when axios builds the adapter it reads `new Response('').body` from `env.Response` once to detect stream support and then calls `cancel()` on that body, so a custom `Response` should return a fresh body per instance; a missing or failing `cancel()` is ignored and does not change detected support.
+- **Notes:** Internal behavior only; no API, option, or type change and no migration.
```

**File**: `lib/adapters/fetch.js` (modified, +49/-2)
```diff
@@ -69,6 +69,45 @@ const test = (fn, ...args) => {
   }
 };
 
+// Marks a probe body's cancellation result as handled. Reads `then` once and
+// does not go through the global Promise or `Promise.prototype.catch`, so a
+// rejected cancellation from a custom body cannot surface as an unhandled
+// rejection.
+const ignoreRejection = (result) => {
+  try {
+    if (result !== null && (typeof result === 'object' || typeof result === 'function')) {
+      const then = result.then;
+
+      if (isFunction(then)) {
+        then.call(result, undefined, utils.noop);
+      }
+    }
+  } catch (e) {
+    // Ignored: the cancellation has already been requested.
+  }
+};
+
+// On Node.js 22 and older, the body of the throwaway `new Response('')` used by
+// the response-stream probe leaves its stream's internal closed promise pending
+// until the stream is cancelled, which async-leak detectors report for every
+// realm that loads axios. This cleanup runs in `finally`, whether the check
+// returned or threw, and is best-effort so it never affects the probe result.
+const cancelProbeBody = (body) => {
+  if (body == null) {
+    return;
+  }
+
+  try {
+    const cancel = body.cancel;
+
+    if (isFunction(cancel)) {
+      ignoreRejection(cancel.call(body));
+    }
+  } catch (e) {
+    // Ignored: an uncancellable probe body is still a valid probe result.
+  }
+};
+
 const maybeWithAuthCredentials = (url) => {
   const protocolIndex = url.indexOf('://');
   let urlToCheck = url;
@@ -134,7 +173,7 @@ const factory = (env) => {
       const hasContentType = request.headers.has('Content-Type');
 
       if (request.body != null) {
-        request.body.cancel();
+        ignoreRejection(request.body.cancel());
       }
 
       return duplexAccessed && !hasContentType;
@@ -143,7 +182,15 @@ const factory = (env) => {
   const supportsResponseStream =
     isResponseSupported &&
     isReadableStreamSupported &&
-    test(() => utils.isReadableStream(new Response('').body));
+    test(() => {
+      const probeBody = new Response('').body;
+
+      try {
+        return utils.isReadableStream(probeBody);
+      } finally {
+        cancelProbeBody(probeBody);
+      }
+    });
 
   // Some runtimes reject every explicit cache mode. Use own defaults for both
   // probes so unrelated polluted options cannot affect cache-mode detection.
```

**File**: `tests/unit/adapters/fetch.test.js` (modified, +213/-20)
```diff
@@ -2204,30 +2204,223 @@ describe.runIf(typeof fetch === 'function')('supports fetch with nodejs', () =>
   });
 
   describe('capability probe cleanup', () => {
-    it('should cancel the ReadableStream created during the request stream probe', () => {
-      // The fetch adapter factory probes for request-stream support by creating
-      // a ReadableStream as a Request body.  Previously the stream was never
-      // cancelled, leaving a dangling pull-algorithm promise (async resource leak
-      // visible via `--detect-async-leaks` or Node.js async_hooks).
-      //
-      // Calling getFetch with a unique env triggers a fresh factory() execution
-      // (including the probe).  We spy on ReadableStream.prototype.cancel to
-      // verify it is invoked during the probe.
-
-      const cancelSpy = vi.spyOn(ReadableStream.prototype, 'cancel');
+    // Each test passes its own env.Request or env.Response, which is a fresh
+    // getFetch cache key, so factory() re-runs the capability probes.
 
-      try {
-        // Unique fetch function ensures cache miss → factory() re-runs the probe.
-        const uniqueFetch = async () => new Response('ok');
-        getFetch({ env: { fetch: uniqueFetch } });
+    // Records cancel() calls on one exact stream and keeps the returned promise.
+    const trackCancel = (stream) => {
+      const probe = { stream, calls: 0, result: undefined };
+      const cancel = stream.cancel;
 
-        assert.ok(
-          cancelSpy.mock.calls.length > 0,
-          'ReadableStream.prototype.cancel should be called during the capability probe'
-        );
+      stream.cancel = function (...args) {
+        probe.calls++;
+        probe.result = cancel.apply(this, args);
+
+        return probe.result;
+      };
+
+      return probe;
+    };
+
+    const assertReleased = async (probe) => {
+      assert.strictEqual(probe.calls, 1, 'the probe body should be cancelled exactly once');
+      await probe.result;
+      assert.match(util.inspect(probe.stream), /state: 'closed'/);
+    };
+
+    // The request stream probe is the only Request built with a `duplex` getter;
+    // requests made by the adapter pass a plain value.
+    const isRequestProbe = (init) => {
+      const duplex = init && Object.getOwnPropertyDescriptor(init, 'duplex');
+
+      return Boolean(duplex && duplex.get);
+    };
+
+    const withUnhandledRejections = async (fn) => {
+      const rejections = [];
+      const onUnhandledRejection = (reason) => rejections.push(reason);
+
+      process.on('unhandledRejection', onUnhandledRejection);
+
+      try {
+        await fn();
+        await setTimeoutAsync(50);
       } finally {
-        cancelSpy.mockRestore();
+        process.off('unhandledRejection', onUnhandledRejection);
+      }
+
+      return rejections;
+    };
+
+    const asStream = (value) => {
+      Object.defineProperty(value, Symbol.toStringTag, { value: 'ReadableStream' });
+
+      return value;
+    };
+
+    it('should cancel the exact ReadableStream created by the request stream probe', async () => {
+      const probes = [];
+
+      class ProbeRequest extends Request {
+        constructor(input, init) {
+          super(input, init);
+
+          if (isRequestProbe(init)) {
+            probes.push(trackCancel(super.body));
+          }
+        }
+      }
+
+      getFetch({ env: { fetch: async () => new Response('ok'), Request: ProbeRequest } });
+
+      assert.strictEqual(probes.length, 1, 'the request stream probe should build one Request');
+      await assertReleased(probes[0]);
+    });
+
+    it('should cancel the exact ReadableStream created by the response stream probe', async () => {
+      // A prototype spy on ReadableStream#cancel cannot tell the two probes apart,
+      // so track the exact body this probe reads.
+      const probes = [];
+
+      class ProbeResponse extends Response {
+        get body() {
+          const body = super.body;
+
+          if (body && !probes.some((probe) => probe.stream === body)) {
+            probes.push(trackCancel(body));
+          }
+
+          return body;
+        }
       }
+
+      getFetch({ env: { fetch: async () => new Response('ok'), Response: ProbeResponse } });
+
+      assert.strictEqual(probes.length, 1, 'the response stream probe should read one body');
+      await assertReleased(probes[0]);
+    });
+
+    it('should not emit an unhandled rejection when the request probe body cannot be cancelled', async () => {
+      // A locked stream rejects cancel(), as a polyfilled stream can when the
+      // runtime has already taken a reader on the request body.
+      const lockedBody = new ReadableStream();
+      lockedBody.getReader();
+
+      class LockedProbeRequest extends Request {
+        constructor(input, init) {
+          super(input, init);
+
+          if (isRequestProbe(init)) {
+            Object.defineProperty(this, 'body', { value: lockedBody });
+          }
+        }
+      }
+
+      cons
```

---

### Incident Patch 3: `530adb0a` (2026-11-15)
**Commit Message**: fix(core): reject nullish url in getUri like dispatched requests (#11453)

**File**: `PRE_RELEASE_CHANGELOG.md` (modified, +2/-1)
```diff
@@ -7,7 +7,8 @@
 ## Bug Fixes
 
 - **Fetch stream cleanup:** When the fetch adapter rejects a streamed upload for exceeding `maxBodyLength`, or a streamed response for exceeding `maxContentLength`, it now cancels the source stream instead of leaving it open. Previously the size-limit error left the source paused mid-read, so its `cancel` hook never ran and the underlying connection or user-supplied `ReadableStream` stayed open until garbage collection. Cancellation is started without waiting for it, so a slow or failing cancel does not delay or replace the size-limit error. No public API or type changes. ([#11239](https://github.com/axios/axios/pull/11239))
-- **Nullish request url:** A request with a `null` or `undefined` url on a built-in adapter, whether selected by name or passed as a function such as `axios.getAdapter('fetch')`, now rejects with `AxiosError` and `ERR_INVALID_URL` before anything is sent. Since v1.18.1, adding `params` turned such a url into a query-only url like `?foo=bar`, which browsers resolve against the current page, so `axios.get(null, { params })` sent a request to the page itself. Without params, XHR requested `./null` or `./undefined`, and the Node HTTP adapter threw a native `TypeError`; both now reject with the same `AxiosError`. A `baseURL`, or a `socketPath` on the Node HTTP adapter, still supplies the destination; an empty-string url is still a valid relative url; custom adapters are not checked; and `axios.getUri()` still returns query-only urls. No public API or type changes. (**[#11237](https://github.com/axios/axios/pull/11237)**, closes **[#11160](https://github.com/axios/axios/issues/11160)**)
+- **Nullish request url:** A request with a `null` or `undefined` url on a built-in adapter, whether selected by name or passed as a function such as `axios.getAdapter('fetch')`, now rejects with `AxiosError` and `ERR_INVALID_URL` before anything is sent. Since v1.18.1, adding `params` turned such a url into a query-only url like `?foo=bar`, which browsers resolve against the current page, so `axios.get(null, { params })` sent a request to the page itself. Without params, XHR requested `./null` or `./undefined`, and the Node HTTP adapter threw a native `TypeError`; both now reject with the same `AxiosError`. A `baseURL`, or a `socketPath` on the Node HTTP adapter, still supplies the destination; an empty-string url is still a valid relative url; custom adapters are not checked. No public API or type changes. (**[#11237](https://github.com/axios/axios/pull/11237)**, closes **[#11160](https://github.com/axios/axios/issues/11160)**)
+- **`getUri` rejects a nullish url:** `axios.getUri()` and `instance.getUri()` now apply the same url check as a dispatched request and throw `AxiosError` with `ERR_INVALID_URL` for a config that the request would reject, instead of returning a uri the request would never send. Behavior change: `getUri({ params })` with a `null` or `undefined` url and no `baseURL` used to return a query-only uri such as `?foo=bar`, and `getUri()` with no url or `baseURL` returned `undefined`; both now throw. The exemptions match the request: a `baseURL`, a `socketPath` when the Node HTTP adapter handles the request, and a custom adapter still return a uri, and an empty-string url still builds a relative uri. The adapter is resolved only for a nullish url without `baseURL`, so a usable url never fails on an adapter that is unavailable in the current environment; when it is resolved and cannot be, `getUri` throws the same adapter error as the request, such as `ERR_NOT_SUPPORT`. `getUri` still does not run request interceptors, so a url that an interceptor would supply is still missing and `getUri` throws even though the request succeeds. The check moved from `dispatchRequest` into `lib/core/assertValidRequestUrl.js`, and its message now ends with "when baseURL is not set" instead of "for a dispatched request". No type changes; the `getUri` signature already returns `string`. ([#11453](https://github.com/axios/axios/pull/11453))
 - **Response duration clock:** `response.duration` is now measured with the monotonic `performance.now()` instead of `Date.now()`, falling back to `Date.now()` only in runtimes without `performance.now()`. Since v1.21.0, axios read `Date.now()` on every request, which broke Next.js production builds that use Cache Components (`cacheComponents: true`) because Next.js rejects reading the current time while prerendering; `performance.now()` is the timing API Next.js allows for this. The monotonic clock also stops system clock adjustments from skewing the value. `duration` is rounded to whole milliseconds, so it stays an integer as in v1.21.0, and it is still clamped at `0`. No public API or type changes; the `duration` declaration comments in `index.d.ts` and `index.d.cts` now name the clock. ([#11407](https://github.com/axios/axios/issues/11407))
 - **`getAdapter` typings:** `getAdapter(adapters, config?)` in `index.d.ts` and `index.d.cts` now a
```

**File**: `PRE_RELEASE_DOCS.md` (modified, +10/-0)
```diff
@@ -20,6 +20,16 @@ Do not store raw diffs or line-number-only instructions here; prefer stable sect
 
 ## Unreleased
 
+### `getUri` rejects a nullish url
+
+- **Change:** `getUri` throws `AxiosError` with `ERR_INVALID_URL` for a `null` or `undefined` url without `baseURL` when the adapter is a built-in one, the same configs a request rejects.
+- **Source:** [PR #11453](https://github.com/axios/axios/pull/11453).
+- **Status:** Pending.
+- **Docs targets:** The `getUri` section of `docs/pages/advanced/request-method-aliases.md` and its Spanish, French, and Chinese translations; the `getUri` mention in the README; the upgrade guide for the release that ships this.
+- **Required content:** Say that `getUri` throws `ERR_INVALID_URL` when the url is `null` or `undefined` and no `baseURL` is set, unless a custom adapter or a `socketPath` on the Node HTTP adapter supplies the destination, and that an empty-string url is still accepted. The adapter is resolved first in that case, so an unknown adapter name or one unavailable in the current environment (such as `xhr` in Node) fails with the same adapter error a request gets, such as `ERR_NOT_SUPPORT`, instead of `ERR_INVALID_URL`. Replace the claim that `getUri` returns "the same string axios would put on the wire": it applies `baseURL`, `params`, `paramsSerializer`, and the url check, but does not run request interceptors, so a url, params, or `baseURL` set by an interceptor is not reflected and a url that only an interceptor supplies makes `getUri` throw. In the upgrade guide, note that `getUri({ params })` without a url previously returned a query-only string such as `?foo=bar` and `getUri()` with no url or `baseURL` returned `undefined`; callers that relied on either should pass `url: ''` or set `baseURL`.
+- **Examples:** `axios.getUri({ params: { q: 1 } })` throws; `axios.getUri({ url: '', params: { q: 1 } })` returns `'?q=1'`.
+- **Notes:** None.
+
 ### Response duration clock
 
 - **Change:** `response.duration` uses `performance.now()` instead of `Date.now()`.
```

**File**: `lib/core/Axios.js` (modified, +6/-0)
```diff
@@ -4,6 +4,9 @@ import utils from '../utils.js';
 import buildURL from '../helpers/buildURL.js';
 import InterceptorManager from './InterceptorManager.js';
 import dispatchRequest from './dispatchRequest.js';
+import assertValidRequestUrl from './assertValidRequestUrl.js';
+import adapters from '../adapters/adapters.js';
+import defaults from '../defaults/index.js';
 import mergeConfig from './mergeConfig.js';
 import buildFullPath from './buildFullPath.js';
 import methodList from './methodList.js';
@@ -312,6 +315,9 @@ class Axios {
 
   getUri(config) {
     config = mergeConfig(this.defaults, config);
+    assertValidRequestUrl(config, () =>
+      adapters.getAdapter(config.adapter || defaults.adapter, config)
+    );
     const fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls, config);
     return buildURL(fullPath, config.params, config.paramsSerializer);
   }
```

**File**: `lib/core/assertValidRequestUrl.js` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+'use strict';
+
+import AxiosError from './AxiosError.js';
+import adapters from '../adapters/adapters.js';
+import utils from '../utils.js';
+
+/**
+ * Reject a `null` or `undefined` url that a built-in adapter would send
+ * somewhere the caller did not choose.
+ *
+ * With params, the nullish url becomes a query-only url such as `?foo=bar`,
+ * which a browser resolves against the current page. Without params, XHR
+ * requests `./null` or `./undefined` and the Node adapter throws a native
+ * `TypeError`.
+ *
+ * The request still has a destination when `baseURL` is set, or when the Node
+ * HTTP adapter is given a `socketPath`. A caller-supplied adapter handles its
+ * own destination and is not checked.
+ *
+ * `dispatchRequest` and `Axios#getUri` both call this, so `getUri` rejects
+ * exactly the configs that a request would reject. Request interceptors are
+ * not run by `getUri`, so a url that an interceptor would supply is still
+ * missing there. Keep this out of `buildURL` and `buildFullPath`: they only
+ * format urls and have other callers.
+ *
+ * @param {Object} config The merged request config
+ * @param {Function} resolveAdapter Returns the adapter that handles the
+ * request. Called only for a nullish url without `baseURL`, so a usable url
+ * never depends on adapter resolution.
+ *
+ * @returns {void}
+ */
+export default function assertValidRequestUrl(config, resolveAdapter) {
+  const url = utils.getSafeProp(config, 'url');
+
+  if (url !== null && url !== undefined) {
+    return;
+  }
+
+  if (utils.getSafeProp(config, 'baseURL')) {
+    return;
+  }
+
+  const adapter = resolveAdapter();
+
+  // Only the Node HTTP adapter reads socketPath; XHR and fetch ignore it.
+  const httpAdapter = adapters.adapters.http;
+
+  if (httpAdapter && adapter === httpAdapter && utils.getSafeProp(config, 'socketPath')) {
+    return;
+  }
+
+  if (!adapters.isBuiltinAdapter(adapter)) {
+    return;
+  }
+
+  throw new AxiosError(
+    `Invalid URL: url cannot be ${url === null ? 'null' : 'undefined'} when baseURL is not set`,
+    AxiosError.ERR_INVALID_URL,
+    config
+  );
+}
```

**File**: `lib/core/dispatchRequest.js` (modified, +2/-52)
```diff
@@ -5,9 +5,9 @@ import isCancel from '../cancel/isCancel.js';
 import defaults from '../defaults/index.js';
 import CanceledError from '../cancel/CanceledError.js';
 import AxiosHeaders from '../core/AxiosHeaders.js';
-import AxiosError from '../core/AxiosError.js';
 import adapters from '../adapters/adapters.js';
 import utils from '../utils.js';
+import assertValidRequestUrl from './assertValidRequestUrl.js';
 
 /**
  * Throws a `CanceledError` if cancellation has been requested.
@@ -26,56 +26,6 @@ function throwIfCancellationRequested(config) {
   }
 }
 
-/**
- * Reject a request with a `null` or `undefined` url before a built-in adapter
- * sends it somewhere the caller did not choose.
- *
- * With params, the nullish url becomes a query-only url such as `?foo=bar`,
- * which a browser resolves against the current page. Without params, XHR
- * requests `./null` or `./undefined` and the Node adapter throws a native
- * `TypeError`.
- *
- * The request still has a destination when `baseURL` is set, or when the Node
- * HTTP adapter is given a `socketPath`. A caller-supplied adapter handles its
- * own destination and is not checked.
- *
- * `buildURL` is not the place for this check: `axios.getUri()` shares it and
- * must keep returning query-only urls.
- *
- * @param {Object} config The config that is to be used for the request
- * @param {Function} adapter The adapter resolved by `getAdapter`
- *
- * @returns {void}
- */
-function assertValidRequestUrl(config, adapter) {
-  const url = utils.getSafeProp(config, 'url');
-
-  if (url !== null && url !== undefined) {
-    return;
-  }
-
-  if (utils.getSafeProp(config, 'baseURL')) {
-    return;
-  }
-
-  // Only the Node HTTP adapter reads socketPath; XHR and fetch ignore it.
-  const httpAdapter = adapters.adapters.http;
-
-  if (httpAdapter && adapter === httpAdapter && utils.getSafeProp(config, 'socketPath')) {
-    return;
-  }
-
-  if (!adapters.isBuiltinAdapter(adapter)) {
-    return;
-  }
-
-  throw new AxiosError(
-    `Invalid URL: url cannot be ${url === null ? 'null' : 'undefined'} for a dispatched request`,
-    AxiosError.ERR_INVALID_URL,
-    config
-  );
-}
-
 /**
  * Resolve the clock used to time adapter execution.
  *
@@ -134,7 +84,7 @@ export default function dispatchRequest(_config) {
   const adapter = adapters.getAdapter(config.adapter || defaults.adapter, config);
 
   // Runs after resolution so a custom adapter is recognized in any form.
-  assertValidRequestUrl(config, adapter);
+  assertValidRequestUrl(config, () => adapter);
 
   const now = resolveClock();
   const start = now();
```

**File**: `tests/browser/requestUrl.browser.test.js` (modified, +29/-1)
```diff
@@ -47,7 +47,7 @@ const expectGuardRejection = (promise) =>
   expect(promise).rejects.toMatchObject({
     name: 'AxiosError',
     code: 'ERR_INVALID_URL',
-    message: expect.stringMatching(/for a dispatched request$/),
+    message: expect.stringMatching(/when baseURL is not set$/),
   });
 
 describe('request url validation (vitest browser)', () => {
@@ -144,4 +144,32 @@ describe('request url validation (vitest browser)', () => {
       expect(fetch.mock.calls[0][0].url).toBe(expected);
     });
   });
+
+  describe('getUri', () => {
+    const expectGuardThrow = (fn) => {
+      let error;
+
+      try {
+        fn();
+      } catch (e) {
+        error = e;
+      }
+
+      expect(error).toMatchObject({
+        name: 'AxiosError',
+        code: 'ERR_INVALID_URL',
+        message: expect.stringMatching(/when baseURL is not set$/),
+      });
+    };
+
+    it.each([null, undefined])('rejects a %s url that a request would reject', (url) => {
+      expectGuardThrow(() => axios.getUri({ url, params: PARAMS }));
+      expectGuardThrow(() => axios.getUri({ url, socketPath: '/app.sock', params: PARAMS }));
+    });
+
+    it('still builds urls that a request would send', () => {
+      expect(axios.getUri({ url: '', params: PARAMS })).toBe('?foo=bar');
+      expect(axios.getUri({ baseURL: '/api', params: PARAMS })).toBe('/api?foo=bar');
+    });
+  });
 });
```

**File**: `tests/unit/api.test.js` (modified, +68/-8)
```diff
@@ -69,14 +69,74 @@ describe('static api', () => {
     assert.strictEqual(typeof axios.getUri, 'function');
   });
 
-  it('should build a query-only uri without a destination', () => {
-    // `getUri` only builds a query string; it never dispatches a request, so
-    // it must keep supporting a missing url.
-    assert.strictEqual(axios.getUri({ params: { foo: 'bar' } }), '?foo=bar');
-    assert.strictEqual(axios.getUri({ url: null, params: { foo: 'bar' } }), '?foo=bar');
-    assert.strictEqual(axios.getUri({ url: undefined, params: { foo: 'bar' } }), '?foo=bar');
-    assert.strictEqual(axios.getUri({ url: '', params: { foo: 'bar' } }), '?foo=bar');
-    assert.strictEqual(axios.getUri({ url: '/foo', params: { foo: 'bar' } }), '/foo?foo=bar');
+  describe('getUri url validation', () => {
+    // `getUri` applies the same url check as a dispatched request, so it never
+    // returns a uri that the request itself would reject.
+    const PARAMS = { foo: 'bar' };
+
+    const assertInvalidUrl = (fn, kind) =>
+      assert.throws(fn, (error) => {
+        assert.strictEqual(error.name, 'AxiosError');
+        assert.strictEqual(error.code, 'ERR_INVALID_URL');
+        assert.strictEqual(
+          error.message,
+          `Invalid URL: url cannot be ${kind} when baseURL is not set`
+        );
+        return true;
+      });
+
+    it('should reject a nullish url without baseURL', () => {
+      assertInvalidUrl(() => axios.getUri(), 'undefined');
+      assertInvalidUrl(() => axios.getUri({}), 'undefined');
+      assertInvalidUrl(() => axios.getUri({ params: PARAMS }), 'undefined');
+      assertInvalidUrl(() => axios.getUri({ url: undefined, params: PARAMS }), 'undefined');
+      assertInvalidUrl(() => axios.getUri({ url: null, params: PARAMS }), 'null');
+    });
+
+    it.runIf(typeof fetch === 'function')(
+      'should reject a nullish url on a built-in adapter selected by name',
+      () => {
+        assertInvalidUrl(() => axios.getUri({ adapter: 'fetch', params: PARAMS }), 'undefined');
+        assertInvalidUrl(
+          () => axios.getUri({ adapter: 'fetch', socketPath: '/tmp/axios.sock', params: PARAMS }),
+          'undefined'
+        );
+      }
+    );
+
+    it('should keep building urls that a request would accept', () => {
+      assert.strictEqual(axios.getUri({ url: '', params: PARAMS }), '?foo=bar');
+      assert.strictEqual(axios.getUri({ url: '/foo', params: PARAMS }), '/foo?foo=bar');
+      assert.strictEqual(
+        create({ baseURL: 'https://api.example.com' }).getUri({ params: PARAMS }),
+        'https://api.example.com?foo=bar'
+      );
+      assert.strictEqual(
+        axios.getUri({ adapter: 'http', socketPath: '/tmp/axios.sock', params: PARAMS }),
+        '?foo=bar'
+      );
+      assert.strictEqual(
+        axios.getUri({ adapter: (config) => Promise.resolve({ config }), params: PARAMS }),
+        '?foo=bar'
+      );
+    });
+
+    it('should not resolve the adapter for a usable url', () => {
+      // `xhr` is unavailable in Node; resolving it would throw ERR_NOT_SUPPORT.
+      assert.strictEqual(axios.getUri({ adapter: 'xhr', url: '/foo' }), '/foo');
+      assert.strictEqual(
+        create({ baseURL: 'https://api.example.com' }).getUri({ adapter: 'xhr' }),
+        'https://api.example.com'
+      );
+    });
+
+    it('should not see a url that a request interceptor would supply', () => {
+      // `getUri` does not run interceptors.
+      const instance = create();
+      instance.interceptors.request.use((config) => ({ ...config, url: '/foo' }));
+
+      assertInvalidUrl(() => instance.getUri({ params: PARAMS }), 'undefined');
+    });
   });
 
   it('should ignore inherited data for bodyless method helpers', async () => {
```

**File**: `tests/unit/core/dispatchRequest.test.js` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ describe('core::dispatchRequest', () => {
     const assertGuardRejection = (error) => {
       assert.ok(error instanceof AxiosError, 'must be AxiosError');
       assert.strictEqual(error.code, AxiosError.ERR_INVALID_URL);
-      assert.match(error.message, /for a dispatched request$/);
+      assert.match(error.message, /when baseURL is not set$/);
     };
 
     // Swap the registered `http` built-in for a stub. `getAdapter('http')` and
```

#### Recent Merged Pull Requests:
- **PR #11455** (closed): fix(http): reject negative timeouts instead of crashing the process (v0.x) (@jasonsaayman)
- **PR #11454** (closed): fix(fetch): cancel the response stream probe body (@jasonsaayman)
- **PR #11453** (2026-11-15): fix(core): reject nullish url in getUri like dispatched requests (@jasonsaayman)
- **PR #11439** (2026-11-10): docs(agents): narrow the validator rule to option type and shape checks (@jasonsaayman)
- **PR #11438** (2026-11-10): chore(deps-dev): bump the development_dependencies group with 6 updates (@dependabot[bot])
- **PR #11437** (2026-11-10): chore(deps): bump zizmorcore/zizmor-action from 0.8.0 to 0.8.1 in the github-actions group (@dependabot[bot])

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

## X. http): reject negative timeouts instead of crashing the process

**RULE**:
When implementing operations in `PRE_RELEASE_CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in axios/axios. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c0d4c900`: http): reject negative timeouts instead of crashing the process. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `PRE_RELEASE_CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
- **Node HTTP adapter - negative timeouts:** A negative `timeout`, including fractional values such as `-0.5`, now fails as a timeout (`ECONNABORTED`, or `ETIMEDOUT` with `transitional.clarifyTimeoutError`) before any connection is opened. Previously Node's `ERR_OUT_OF_RANGE` was thrown from a follow-redirects socket callback as an uncaught exception that crashed the process and left the request unsettled, or surfaced as a raw `RangeError` with `maxRedirects: 0`, while fractional negatives were truncated to `-0` and disabled the timeout on the native transport. This commonly happens when a timeout is computed from a deadline that has already passed. `-Infinity` and strings such as `"-Infinity"` or `"-.5"`, which previously rejected with `ERR_BAD_OPTION_VALUE`, now also fail as a timeout. Other config errors, such as a body over `maxBodyLength`, are still reported first, and `data:` URLs still ignore the timeout. With `onUploadProgress` or `maxRate`, the upload stream now starts only once the request goes ahead, so a rejected config no longer starts reading the request body. A timeout whose integer conversion overflows to `Infinity`, such as a very long digit string, now rejects wit
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c0d4c900` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.

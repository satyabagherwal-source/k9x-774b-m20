# Verification Protocol: Verification Protocol: Empirical Defect Shield for axios-axios-learnings

<!-- PROVENANCE_START
{
  "source_repository": "axios-axios-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:33:51.350Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-axios-axios-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [axios-axios-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:33:51.350Z`  
> **Learning ID**: `LEARN-REEXTRACT-axios-axios-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `axios-axios-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/axios-axios-learnings.md`  
> **Source**: github ([https://github.com/axios/axios](https://github.com/axios/axios))  
> **Source Version**: `4ee8d46f`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T05:26:55.152Z  
> **Learning ID**: `learn-github-axios-axios`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): axios/axios

> **Canonical Artifact**: `07_PROJECT_LEARNING/axios-axios-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/axios/axios](https://github.com/axios/axios))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T05:26:55.146Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `axios/axios`
- **Description**: Promise based HTTP client for the browser and node.js
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 109394 stars

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
    config = mergeConfig(this.defaults, config);
    const fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls, config);
    return bui
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
import AxiosError from '../core/AxiosError.js';
import adapters from '../adapters/adapters.js';
import utils from '../utils.js';

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
 * Reject a request with a `null` or `undefined` url before a built-in adapter
 * sends it somewhere the caller did not choose.
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
 * `buildURL` is not the place for this check: `axios.getUri()` shares it and
 * must keep returning query-only urls.
 *
 * @param {Object} config The config that is to be used for the request
 * @param {Function} adapter The adapter resolved by `getAdapter`
 *
 * @returns {void}
 */
function assertValidRequestUrl(config, adapter) {
  const url = utils.getSafeProp(config, 'url');

  if (url !== null && url !== undefined) {
    return;
  }

  if (utils.getSafeProp(config, 'baseURL')) {
    return;
  }

  // Only the Node HTTP adapter reads socketPath; XHR and fetch ignore it.
  const httpAdapter = adapters.adapters.http;

  if (httpAdapter && adapter === httpAdapter && utils.getSafeProp(config, 'socketPath')) {
    return;
  }

  if (!adapters.isBuiltinAdapter(adapter)) {
    return;
  }

  throw new AxiosError(
    `Invalid URL: url cannot be ${url === null ? 'null' : 'undefined'} for a dispatched request`,
    AxiosError.ERR_INVALID_URL,
    config
  );
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
  assertValidRequestUrl(config, adapter);

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

### Core Architecture Module: `lib/core/setFormDataHeaders.js`
```
'use strict';

const FORM_DATA_CONTENT_HEADERS = ['content-type', 'content-length'];

/**
 * Apply the headers generated by a FormData implementation to the request headers,
 * honoring the `formDataHeaderPolicy` option: with 'content-only', copy only the
 * content-* headers; otherwise merge all of them.
 *
 * @param {AxiosHeaders} headers - the request headers to mutate
 * @param {Object | null | undefined} formHeaders - headers produced by the FormData implementation
 * @param {String} [policy] - the resolved `formDataHeaderPolicy` config value
 *
 * @returns {void}
 */
export default function setFormDataHeaders(headers, formHeaders, policy) {
  if (policy !== 'content-only') {
    headers.set(formHeaders);
    return;
  }

  Object.entries(formHeaders || {}).forEach(([key, val]) => {
    if (FORM_DATA_CONTENT_HEADERS.includes(key.toLowerCase())) {
      headers.set(key, val);
    }
  });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11439** (2026-11-10): **docs(agents): narrow the validator rule to option type and shape checks**
  *Symptoms*: ## Summary  Narrows the contributor rule "Validate config options through the `validator` helper; do not invent ad-hoc validation paths" so that it covers what the helper can actually check.  `validator.assertOptions` runs in `Axios#request` before request interceptors, checks only the options listed in each schema, and skips options whose value is `undefined`. So it cannot express a check that needs:  - the final config after request interceptors, which can set or change the url; - an option that may be `undefined`, such as a missing `url`; - the adapter chosen for the request.  Code review bots read the rule as applying to such checks too. On #11237, a review asked for the nullish-url guard in `dispatchRequest` to move into `validator`. That would have rejected urls supplied by interceptors, missed `undefined` urls, and changed the error code from `ERR_INVALID_URL` to `ERR_BAD_OPTION_VALUE`. Existing checks such as `buildFullPath` (`ERR_INVALID_URL`), `fromDataURI` and `assertParamsAcyclic` already live outside `validator`.  ## Linked issue  No issue. Follow-up to the review discussion on #11237.  ## Changes  - `AGENTS.md`: the ban on ad-hoc checks now applies to type and shape checks on config options in `Axios#request`. The rule says why the helper cannot cover other checks, and says they belong on the request path, such as `dispatchRequest` or the adapter, throwing `AxiosError` with a specific code. It also says to keep request-only checks out of `buildURL` and `buildFul

- **Issue #11438** (2026-11-10): **chore(deps-dev): bump the development_dependencies group with 6 updates**
  *Symptoms*: Bumps the development_dependencies group with 6 updates:  | Package | From | To | | --- | --- | --- | | [@vitest/browser](https://github.com/vitest-dev/vitest/tree/HEAD/packages/browser) | `5.0.5` | `5.1.0` | | [@vitest/browser-playwright](https://github.com/vitest-dev/vitest/tree/HEAD/packages/browser-playwright) | `5.0.5` | `5.1.0` | | [eslint](https://github.com/eslint/eslint) | `10.13.0` | `10.14.0` | | [globals](https://github.com/sindresorhus/globals) | `17.13.0` | `17.14.0` | | [rollup](https://github.com/rollup/rollup) | `4.66.0` | `4.67.4` | | [vitest](https://github.com/vitest-dev/vitest/tree/HEAD/packages/vitest) | `5.0.5` | `5.1.0` |  Updates `@vitest/browser` from 5.0.5 to 5.1.0 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/vitest-dev/vitest/releases">@​vitest/browser's releases</a>.</em></p> <blockquote> <h2>v5.1.0</h2> <h3>   🚀 Features</h3> <ul> <li>Add <code>--last-failed</code> to run only failed tests  -  by <a href="https://github.com/sheremet-va"><code>@​sheremet-va</code></a> in <a href="https://redirect.github.com/vitest-dev/vitest/issues/11558">vitest-dev/vitest#11558</a> <a href="https://github.com/vitest-dev/vitest/commit/82f634220"><!-- raw HTML omitted -->(82f63)<!-- raw HTML omitted --></a></li> <li>Support <code>Temporal.Instant</code> and <code>Temporal.ZonedDateTime</code> in <code>vi.setSystemTime()</code>  -  by <a href="https://github.com/Prajwal2246"><code>@​Prajwal2246</code></a>, <strong>Prajw

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

### Incident Patch 1: `4ee8d46f` (2026-11-11)
**Commit Message**: fix(fetch): close source streams after size-limit errors (#11239)

Co-authored-by: jasonsaayman <[REDACTED_EMAIL]>
Co-authored-by: cubic-dev-ai[bot] <191113872+cubic-dev-ai[bot]@users.noreply.github.com>

**File**: `PRE_RELEASE_CHANGELOG.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 
 ## Bug Fixes
 
+- **Fetch stream cleanup:** When the fetch adapter rejects a streamed upload for exceeding `maxBodyLength`, or a streamed response for exceeding `maxContentLength`, it now cancels the source stream instead of leaving it open. Previously the size-limit error left the source paused mid-read, so its `cancel` hook never ran and the underlying connection or user-supplied `ReadableStream` stayed open until garbage collection. Cancellation is started without waiting for it, so a slow or failing cancel does not delay or replace the size-limit error. No public API or type changes. ([#11239](https://github.com/axios/axios/pull/11239))
 - **Nullish request url:** A request with a `null` or `undefined` url on a built-in adapter, whether selected by name or passed as a function such as `axios.getAdapter('fetch')`, now rejects with `AxiosError` and `ERR_INVALID_URL` before anything is sent. Since v1.18.1, adding `params` turned such a url into a query-only url like `?foo=bar`, which browsers resolve against the current page, so `axios.get(null, { params })` sent a request to the page itself. Without params, XHR requested `./null` or `./undefined`, and the Node HTTP adapter threw a native `TypeError`; both now reject with the same `AxiosError`. A `baseURL`, or a `socketPath` on the Node HTTP adapter, still supplies the destination; an empty-string url is still a valid relative url; custom adapters are not checked; and `axios.getUri()` still returns query-only urls. No public API or type changes. (**[#11237](https://github.com/axios/axios/pull/11237)**, closes **[#11160](https://github.com/axios/axios/issues/11160)**)
 - **Response duration clock:** `response.duration` is now measured with the monotonic `performance.now()` instead of `Date.now()`, falling back to `Date.now()` only in runtimes without `performance.now()`. Since v1.21.0, axios read `Date.now()` on every request, which broke Next.js production builds that use Cache Components (`cacheComponents: true`) because Next.js rejects reading the current time while prerendering; `performance.now()` is the timing API Next.js allows for this. The monotonic clock also stops system clock adjustments from skewing the value. `duration` is rounded to whole milliseconds, so it stays an integer as in v1.21.0, and it is still clamped at `0`. No public API or type changes; the `duration` declaration comments in `index.d.ts` and `index.d.cts` now name the clock. ([#11407](https://github.com/axios/axios/issues/11407))
 - **`getAdapter` typings:** `getAdapter(adapters, config?)` in `index.d.ts` and `index.d.cts` now accepts the optional request config that the runtime already forwards to adapter getters, so `getAdapter('fetch', { env: { fetch } })` type-checks without a cast. A JSDoc comment on the parameter notes that the built-in `fetch` adapter reads `env.fetch`, `env.Request`, and `env.Response` from it and that other fields are not applied. Type-only; additive and backwards compatible, no runtime change. ([#11403](https://github.com/axios/axios/issues/11403), [#11404](https://github.com/axios/axios/pull/11404))
```

**File**: `lib/helpers/trackStream.js` (modified, +5/-0)
```diff
@@ -73,6 +73,11 @@ export const trackStream = (stream, chunkSize, onProgress, onFinish) => {
           }
           controller.enqueue(new Uint8Array(value));
         } catch (err) {
+          // A progress callback can fail while the source iterator is suspended at
+          // a yield. Close it without delaying or replacing the original error.
+          // This return() call has no cancellation reason, so the source's cancel()
+          // receives undefined, as it does from the cancel() hook below.
+          iterator.return().catch(() => {});
           _onFinish(err);
           throw err;
         }
```

**File**: `tests/unit/adapters/fetchStreamCleanup.test.js` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import { describe, it, expect, vi } from 'vitest';
+import axios from '../../../index.js';
+
+describe('fetch adapter stream cleanup', () => {
+  for (const RequestClass of [Request, null]) {
+    it(`cancels an oversized upload with ${RequestClass ? 'native' : 'no'} Request`, async () => {
+      const cancel = vi.fn();
+      const source = new ReadableStream({
+        start(controller) {
+          controller.enqueue(new Uint8Array(16));
+        },
+        cancel,
+      });
+
+      await expect(
+        axios.post('http://localhost/upload', source, {
+          adapter: 'fetch',
+          maxBodyLength: 8,
+          env: {
+            Request: RequestClass,
+            async fetch(input, init) {
+              const body = RequestClass ? input.body : init.body;
+              await new Response(body).arrayBuffer();
+              return new Response('ok');
+            },
+          },
+        })
+      ).rejects.toMatchObject({ code: 'ERR_BAD_REQUEST' });
+      await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
+    });
+  }
+
+  for (const responseType of ['text', 'stream']) {
+    it(`cancels an oversized ${responseType} download`, async () => {
+      const cancel = vi.fn();
+      const source = new ReadableStream({
+        start(controller) {
+          controller.enqueue(new Uint8Array(16));
+        },
+        cancel,
+      });
+      const request = axios.get('http://localhost/download', {
+        adapter: 'fetch',
+        maxContentLength: 8,
+        responseType,
+        env: { fetch: async () => new Response(source) },
+      });
+      const consume = async () => {
+        const response = await request;
+        if (responseType === 'stream') {
+          await new Response(response.data).arrayBuffer();
+        }
+      };
+      await expect(consume()).rejects.toMatchObject({ code: 'ERR_BAD_RESPONSE' });
+      await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
+    });
+  }
+});
```

**File**: `tests/unit/helpers/trackStream.test.js` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+import { describe, it, expect, vi } from 'vitest';
+import { trackStream } from '../../../lib/helpers/trackStream.js';
+
+describe('helpers::trackStream', () => {
+  for (const useAsyncIterator of [true, false]) {
+    for (const rejectCancel of [true, false]) {
+      it(`closes the source after progress fails (async iterator: ${useAsyncIterator}, cancel rejects: ${rejectCancel})`, async () => {
+        const error = new Error('progress failed');
+        const cancel = vi.fn(() => {
+          if (rejectCancel) {
+            throw new Error('cancel failed');
+          }
+        });
+        const source = new ReadableStream({
+          start(controller) {
+            controller.enqueue(new Uint8Array([1, 2, 3, 4]));
+          },
+          cancel,
+        });
+        if (!useAsyncIterator) {
+          source[Symbol.asyncIterator] = undefined;
+        }
+        const onFinish = vi.fn();
+        const reader = trackStream(
+          source,
+          2,
+          () => {
+            throw error;
+          },
+          onFinish
+        ).getReader();
+
+        try {
+          await expect(reader.read()).rejects.toBe(error);
+          await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
+          expect(onFinish).toHaveBeenCalledExactlyOnceWith(error);
+          await expect(reader.read()).rejects.toBe(error);
+        } finally {
+          reader.releaseLock();
+        }
+      });
+    }
+  }
+
+  it('rejects promptly even if source cancellation never settles', async () => {
+    const error = new Error('progress failed');
+    const cancel = vi.fn(() => new Promise(() => {}));
+    const source = new ReadableStream({
+      start(controller) {
+        controller.enqueue(new Uint8Array([1]));
+      },
+      cancel,
+    });
+    const reader = trackStream(source, 2, () => {
+      throw error;
+    }).getReader();
+    try {
+      await expect(reader.read()).rejects.toBe(error);
+      await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
+    } finally {
+      reader.releaseLock();
+    }
+  });
+
+  it('preserves chunks and progress on normal completion', async () => {
+    const source = new ReadableStream({
+      start(controller) {
+        controller.enqueue(new Uint8Array([1, 2, 3]));
+        controller.enqueue(new Uint8Array([4]));
+        controller.close();
+      },
+    });
+    const onProgress = vi.fn();
+    const onFinish = vi.fn();
+    const chunks = [];
+    for await (const chunk of trackStream(source, 2, onProgress, onFinish)) {
+      chunks.push([...chunk]);
+    }
+    expect(chunks).toEqual([[1, 2], [3], [4]]);
+    expect(onProgress.mock.calls).toEqual([[2], [3], [4]]);
+    expect(onFinish).toHaveBeenCalledExactlyOnceWith(undefined);
+  });
+});
```

---

### Incident Patch 2: `bd3401f1` (2026-11-10)
**Commit Message**: fix(core): reject nullish url for dispatched requests (#11237)

Co-authored-by: jasonsaayman <[REDACTED_EMAIL]>

**File**: `PRE_RELEASE_CHANGELOG.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 
 ## Bug Fixes
 
+- **Nullish request url:** A request with a `null` or `undefined` url on a built-in adapter, whether selected by name or passed as a function such as `axios.getAdapter('fetch')`, now rejects with `AxiosError` and `ERR_INVALID_URL` before anything is sent. Since v1.18.1, adding `params` turned such a url into a query-only url like `?foo=bar`, which browsers resolve against the current page, so `axios.get(null, { params })` sent a request to the page itself. Without params, XHR requested `./null` or `./undefined`, and the Node HTTP adapter threw a native `TypeError`; both now reject with the same `AxiosError`. A `baseURL`, or a `socketPath` on the Node HTTP adapter, still supplies the destination; an empty-string url is still a valid relative url; custom adapters are not checked; and `axios.getUri()` still returns query-only urls. No public API or type changes. (**[#11237](https://github.com/axios/axios/pull/11237)**, closes **[#11160](https://github.com/axios/axios/issues/11160)**)
 - **Response duration clock:** `response.duration` is now measured with the monotonic `performance.now()` instead of `Date.now()`, falling back to `Date.now()` only in runtimes without `performance.now()`. Since v1.21.0, axios read `Date.now()` on every request, which broke Next.js production builds that use Cache Components (`cacheComponents: true`) because Next.js rejects reading the current time while prerendering; `performance.now()` is the timing API Next.js allows for this. The monotonic clock also stops system clock adjustments from skewing the value. `duration` is rounded to whole milliseconds, so it stays an integer as in v1.21.0, and it is still clamped at `0`. No public API or type changes; the `duration` declaration comments in `index.d.ts` and `index.d.cts` now name the clock. ([#11407](https://github.com/axios/axios/issues/11407))
 - **`getAdapter` typings:** `getAdapter(adapters, config?)` in `index.d.ts` and `index.d.cts` now accepts the optional request config that the runtime already forwards to adapter getters, so `getAdapter('fetch', { env: { fetch } })` type-checks without a cast. A JSDoc comment on the parameter notes that the built-in `fetch` adapter reads `env.fetch`, `env.Request`, and `env.Response` from it and that other fields are not applied. Type-only; additive and backwards compatible, no runtime change. ([#11403](https://github.com/axios/axios/issues/11403), [#11404](https://github.com/axios/axios/pull/11404))
 - **Header encoding shortcuts:** The documented `Content-Encoding` shortcuts (`setContentEncoding`, `getContentEncoding`, `hasContentEncoding`) now exist at runtime; previously `getContentEncoding()` threw `TypeError` because `AxiosHeaders` only registered the `Accept-Encoding` accessor. The `Accept-Encoding` trio that the runtime already provided is now declared in `index.d.ts` and `index.d.cts`. `getContentEncoding` and `getAcceptEncoding` are typed to match `AxiosHeaders#get`: `AxiosHeaders.parseParameters` returns `AxiosHeaderParameters`, a `RegExp` returns `RegExpExecArray | null`, and no argument, `true`, or another parser function returns `AxiosHeaderValue`. The type changes are compile-time corrections, not purely additive: `getContentEncoding()` was previously declared to return `RegExpExecArray | null` and to accept string matchers, which throw `parser must be boolean|regexp|function` at runtime, and `getAcceptEncoding()` previously resolved to `any` through the `AxiosHeaders` index signature. TypeScript callers that relied on those declarations may need to narrow the result or pass a supported parser. No change to how existing headers are read or written at runtime; the matching README and docs-site shortcut-list updates are recorded in `PRE_RELEASE_DOCS.md` for release preparation. ([#11432](https://github.com/axios/axios/issues/11432))
```

**File**: `lib/adapters/adapters.js` (modified, +21/-0)
```diff
@@ -114,6 +114,21 @@ function getAdapter(adapters, config) {
   return adapter;
 }
 
+/**
+ * Check whether a resolved adapter function is one of the built-in adapters.
+ *
+ * @param {Function} adapter The adapter resolved by `getAdapter`
+ * @returns {boolean} `true` for the built-in `xhr`, `http` or `fetch` adapter
+ */
+function isBuiltinAdapter(adapter) {
+  return (
+    !!adapter &&
+    (adapter === knownAdapters.xhr ||
+      adapter === knownAdapters.http ||
+      fetchAdapter.isFetchAdapter(adapter))
+  );
+}
+
 /**
  * Exports Axios adapters and utility to resolve an adapter
  */
@@ -124,6 +139,12 @@ export default {
    */
   getAdapter,
 
+  /**
+   * Check whether a resolved adapter is a built-in one.
+   * @type {Function}
+   */
+  isBuiltinAdapter,
+
   /**
    * Exposes all known adapters
    * @type {Object<string, Function|Object>}
```

**File**: `lib/adapters/fetch.js` (modified, +23/-1)
```diff
@@ -715,6 +715,28 @@ const factory = (env) => {
 
 const seedCache = new Map();
 
+// Every adapter the factory has created. The adapter is cached per
+// environment, so one created for another environment, such as by
+// `axios.getAdapter('fetch')` without a config, is still recognized.
+const createdAdapters = new WeakSet();
+
+const createAdapter = (env) => {
+  const adapter = factory(env);
+
+  adapter && createdAdapters.add(adapter);
+
+  return adapter;
+};
+
+/**
+ * Check whether a function was created by the fetch adapter factory.
+ *
+ * @param {*} adapter The value to check
+ *
+ * @returns {boolean} `true` for a built-in fetch adapter
+ */
+export const isFetchAdapter = (adapter) => createdAdapters.has(adapter);
+
 export const getFetch = (config) => {
   const env = Object.create(null);
   const configuredEnv = config && utils.hasOwnProp(config, 'env') && config.env;
@@ -736,7 +758,7 @@ export const getFetch = (config) => {
     seed = seeds[i];
     target = map.get(seed);
 
-    target === undefined && map.set(seed, (target = i ? new Map() : factory(env)));
+    target === undefined && map.set(seed, (target = i ? new Map() : createAdapter(env)));
 
     map = target;
   }
```

**File**: `lib/core/dispatchRequest.js` (modified, +54/-0)
```diff
@@ -5,6 +5,7 @@ import isCancel from '../cancel/isCancel.js';
 import defaults from '../defaults/index.js';
 import CanceledError from '../cancel/CanceledError.js';
 import AxiosHeaders from '../core/AxiosHeaders.js';
+import AxiosError from '../core/AxiosError.js';
 import adapters from '../adapters/adapters.js';
 import utils from '../utils.js';
 
@@ -25,6 +26,56 @@ function throwIfCancellationRequested(config) {
   }
 }
 
+/**
+ * Reject a request with a `null` or `undefined` url before a built-in adapter
+ * sends it somewhere the caller did not choose.
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
+ * `buildURL` is not the place for this check: `axios.getUri()` shares it and
+ * must keep returning query-only urls.
+ *
+ * @param {Object} config The config that is to be used for the request
+ * @param {Function} adapter The adapter resolved by `getAdapter`
+ *
+ * @returns {void}
+ */
+function assertValidRequestUrl(config, adapter) {
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
+    `Invalid URL: url cannot be ${url === null ? 'null' : 'undefined'} for a dispatched request`,
+    AxiosError.ERR_INVALID_URL,
+    config
+  );
+}
+
 /**
  * Resolve the clock used to time adapter execution.
  *
@@ -82,6 +133,9 @@ export default function dispatchRequest(_config) {
 
   const adapter = adapters.getAdapter(config.adapter || defaults.adapter, config);
 
+  // Runs after resolution so a custom adapter is recognized in any form.
+  assertValidRequestUrl(config, adapter);
+
   const now = resolveClock();
   const start = now();
 
```

**File**: `tests/browser/requestUrl.browser.test.js` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+
+import axios from '../../index.js';
+
+// Records every XHR the adapter opens and answers it with an empty 200.
+class RecordingXMLHttpRequest {
+  constructor() {
+    this.readyState = 0;
+    this.status = 0;
+    this.statusText = '';
+    this.responseText = '';
+    this.response = null;
+    this.onloadend = null;
+    this.upload = { addEventListener() {} };
+  }
+
+  open(method, url) {
+    this.url = url;
+    opened.push(url);
+  }
+
+  setRequestHeader() {}
+
+  addEventListener() {}
+
+  getAllResponseHeaders() {
+    return '';
+  }
+
+  send() {
+    this.status = 200;
+    this.statusText = 'OK';
+    this.readyState = 4;
+
+    queueMicrotask(() => this.onloadend && this.onloadend());
+  }
+
+  abort() {}
+}
+
+let opened = [];
+let OriginalXMLHttpRequest;
+
+const PARAMS = { foo: 'bar' };
+
+const expectGuardRejection = (promise) =>
+  expect(promise).rejects.toMatchObject({
+    name: 'AxiosError',
+    code: 'ERR_INVALID_URL',
+    message: expect.stringMatching(/for a dispatched request$/),
+  });
+
+describe('request url validation (vitest browser)', () => {
+  beforeEach(() => {
+    opened = [];
+    OriginalXMLHttpRequest = window.XMLHttpRequest;
+    window.XMLHttpRequest = RecordingXMLHttpRequest;
+  });
+
+  afterEach(() => {
+    window.XMLHttpRequest = OriginalXMLHttpRequest;
+  });
+
+  describe('xhr adapter', () => {
+    it.each([null, undefined])(
+      'rejects a %s url with params instead of requesting the current page',
+      async (url) => {
+        await expectGuardRejection(axios.get(url, { params: PARAMS }));
+
+        expect(opened).toEqual([]);
+      }
+    );
+
+    it.each([null, undefined])('rejects a %s url without params', async (url) => {
+      await expectGuardRejection(axios.get(url));
+
+      expect(opened).toEqual([]);
+    });
+
+    it('still sends an empty-string url as a relative url', async () => {
+      await axios.get('', { params: PARAMS });
+
+      expect(opened).toEqual(['?foo=bar']);
+    });
+
+    it.each([null, undefined])('sends a %s url to the configured baseURL', async (url) => {
+      await axios.get(url, { baseURL: '/api', params: PARAMS });
+
+      expect(opened).toEqual(['/api?foo=bar']);
+    });
+
+    it('rejects a nullish url even when a socketPath is set', async () => {
+      await expectGuardRejection(axios.get(null, { socketPath: '/app.sock', params: PARAMS }));
+
+      expect(opened).toEqual([]);
+    });
+  });
+
+  describe('fetch adapter', () => {
+    const fetchConfig = (fetch, overrides = {}) => ({
+      adapter: 'fetch',
+      env: { fetch },
+      params: PARAMS,
+      ...overrides,
+    });
+
+    it.each([null, undefined])(
+      'rejects a %s url with params instead of requesting the current page',
+      async (url) => {
+        const fetch = vi.fn(async () => new Response('ok'));
+
+        await expectGuardRejection(axios.get(url, fetchConfig(fetch)));
+
+        expect(fetch).not.toHaveBeenCalled();
+      }
+    );
+
+    it.each([null, undefined])(
+      'rejects a %s url when the fetch adapter is passed as a function',
+      async (url) => {
+        const fetch = vi.spyOn(window, 'fetch');
+
+        try {
+          await expectGuardRejection(
+            axios.get(url, { adapter: axios.getAdapter('fetch'), params: PARAMS })
+          );
+
+          expect(fetch).not.toHaveBeenCalled();
+        } finally {
+          fetch.mockRestore();
+        }
+      }
+    );
+
+    it('still sends an empty-string url as a relative url', async () => {
+      const fetch = vi.fn(async () => new Response('ok'));
+
+      await axios.get('', fetchConfig(fetch));
+
+      expect(fetch).toHaveBeenCalledTimes(1);
+
+      const expected = new URL('?foo=bar', window.location.href).href;
+
+      expect(fetch.mock.calls[0][0].url).toBe(expected);
+    });
+  });
+});
```

**File**: `tests/unit/api.test.js` (modified, +10/-0)
```diff
@@ -69,6 +69,16 @@ describe('static api', () => {
     assert.strictEqual(typeof axios.getUri, 'function');
   });
 
+  it('should build a query-only uri without a destination', () => {
+    // `getUri` only builds a query string; it never dispatches a request, so
+    // it must keep supporting a missing url.
+    assert.strictEqual(axios.getUri({ params: { foo: 'bar' } }), '?foo=bar');
+    assert.strictEqual(axios.getUri({ url: null, params: { foo: 'bar' } }), '?foo=bar');
+    assert.strictEqual(axios.getUri({ url: undefined, params: { foo: 'bar' } }), '?foo=bar');
+    assert.strictEqual(axios.getUri({ url: '', params: { foo: 'bar' } }), '?foo=bar');
+    assert.strictEqual(axios.getUri({ url: '/foo', params: { foo: 'bar' } }), '/foo?foo=bar');
+  });
+
   it('should ignore inherited data for bodyless method helpers', async () => {
     Object.defineProperty(Object.prototype, 'data', {
       value: 'inherited-body',
```

**File**: `tests/unit/core/dispatchRequest.test.js` (modified, +197/-0)
```diff
@@ -4,6 +4,8 @@ import axios from '../../../index.js';
 import dispatchRequest from '../../../lib/core/dispatchRequest.js';
 import AxiosError from '../../../lib/core/AxiosError.js';
 import defaults from '../../../lib/defaults/index.js';
+import adapters from '../../../lib/adapters/adapters.js';
+import fetchAdapter from '../../../lib/adapters/fetch.js';
 import resolveConfig from '../../../lib/helpers/resolveConfig.js';
 
 class ReactNativeFormData {
@@ -32,6 +34,201 @@ function baseConfig(overrides = {}) {
 }
 
 describe('core::dispatchRequest', () => {
+  describe('request url validation', () => {
+    const PARAMS = { foo: 'bar' };
+
+    const okResponse = (config) =>
+      Promise.resolve({
+        data: null,
+        status: 200,
+        statusText: 'OK',
+        headers: {},
+        config,
+        request: {},
+      });
+
+    // dispatchRequest throws synchronously when the guard rejects.
+    const rejection = async (dispatch) => {
+      try {
+        await dispatch();
+      } catch (e) {
+        return e;
+      }
+
+      assert.fail('expected the request to reject');
+    };
+
+    const assertGuardRejection = (error) => {
+      assert.ok(error instanceof AxiosError, 'must be AxiosError');
+      assert.strictEqual(error.code, AxiosError.ERR_INVALID_URL);
+      assert.match(error.message, /for a dispatched request$/);
+    };
+
+    // Swap the registered `http` built-in for a stub. `getAdapter('http')` and
+    // the built-in check both read the same registry, so the stub is treated
+    // as the built-in transport and the guard runs in full against it.
+    let stubbedHttp;
+    let originalHttp;
+
+    beforeEach(() => {
+      originalHttp = adapters.adapters.http;
+      stubbedHttp = vi.fn(okResponse);
+      adapters.adapters.http = stubbedHttp;
+    });
+
+    afterEach(() => {
+      adapters.adapters.http = originalHttp;
+    });
+
+    const builtinConfig = (overrides = {}) => baseConfig({ adapter: 'http', ...overrides });
+
+    describe.each([null, undefined])('a %s url', (url) => {
+      it.each([
+        ['without params', undefined],
+        ['with params', PARAMS],
+      ])('rejects on the default adapter path %s', async (_, params) => {
+        // The default adapter list resolves to the real Node HTTP adapter.
+        adapters.adapters.http = originalHttp;
+
+        assertGuardRejection(
+          await rejection(() => dispatchRequest(baseConfig({ url, params, adapter: undefined })))
+        );
+      });
+
+      it('rejects on a built-in adapter before it runs', async () => {
+        assertGuardRejection(await rejection(() => dispatchRequest(builtinConfig({ url }))));
+        assert.strictEqual(stubbedHttp.mock.calls.length, 0, 'adapter must not run');
+      });
+
+      it('rejects when a built-in name wins the resolution of an array', async () => {
+        assertGuardRejection(
+          await rejection(() =>
+            dispatchRequest(baseConfig({ url, adapter: ['xhr', 'http', 'fetch'] }))
+          )
+        );
+        assert.strictEqual(stubbedHttp.mock.calls.length, 0, 'adapter must not run');
+      });
+
+      it.each([
+        ['the global fetch', undefined],
+        ['a custom env.fetch', true],
+      ])('rejects on the fetch adapter with %s', async (_, useCustomFetch) => {
+        const customFetch = vi.fn(() => Promise.resolve(new Response('{}')));
+
+        assertGuardRejection(
+          await rejection(() =>
+            dispatchRequest(
+              baseConfig({
+                url,
+                params: PARAMS,
+                adapter: 'fetch',
+                env: useCustomFetch ? { fetch: customFetch } : undefined,
+              })
+            )
+          )
+        );
+        assert.strictEqual(customFetch.mock.calls.length, 0, 'fetch must not be called');
+      });
+
+      // A fetch adapter passed as a function can be cached for a different
+      // environment from the request's: a real request inherits `env.Blob`
+      // from the defaults, so `fetch.get(config)` returns another instance.
+      it.each([
+        ["axios.getAdapter('fetch')", () => axios.getAdapter('fetch')],
+        ['the default export of the fetch adapter module', () => fetchAdapter],
+        [
+          "axios.getAdapter('fetch') for a custom env.fetch",
+          (customFetch) => axios.getAdapter('fetch', { env: { fetch: customFetch } }),
+        ],
+      ])('rejects when the fetch adapter is passed as %s', async (_, resolve) => {
+        const customFetch = vi.fn(() => Promise.resolve(new Response('{}')));
+
+        assertGuardRejection(
+          await rejection(() =>
+            dispatchRequest(
+              baseConfig({
+                url,
+                params: PARAMS,
+                env: defaults.env,
+                adapter: resolve(customFetch),
+              })
+            )
+          )
+        );
+        assert.strictEqual(customFetch.mock.calls.length, 0, 'fetch must not be called');

```

---

### Incident Patch 3: `b628e2fc` (2026-11-10)
**Commit Message**: fix(headers): register the Content-Encoding shortcuts and declare the Accept-Encoding ones (#11436)

Co-authored-by: jasonsaayman <[REDACTED_EMAIL]>

**File**: `PRE_RELEASE_CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@
 
 - **Response duration clock:** `response.duration` is now measured with the monotonic `performance.now()` instead of `Date.now()`, falling back to `Date.now()` only in runtimes without `performance.now()`. Since v1.21.0, axios read `Date.now()` on every request, which broke Next.js production builds that use Cache Components (`cacheComponents: true`) because Next.js rejects reading the current time while prerendering; `performance.now()` is the timing API Next.js allows for this. The monotonic clock also stops system clock adjustments from skewing the value. `duration` is rounded to whole milliseconds, so it stays an integer as in v1.21.0, and it is still clamped at `0`. No public API or type changes; the `duration` declaration comments in `index.d.ts` and `index.d.cts` now name the clock. ([#11407](https://github.com/axios/axios/issues/11407))
 - **`getAdapter` typings:** `getAdapter(adapters, config?)` in `index.d.ts` and `index.d.cts` now accepts the optional request config that the runtime already forwards to adapter getters, so `getAdapter('fetch', { env: { fetch } })` type-checks without a cast. A JSDoc comment on the parameter notes that the built-in `fetch` adapter reads `env.fetch`, `env.Request`, and `env.Response` from it and that other fields are not applied. Type-only; additive and backwards compatible, no runtime change. ([#11403](https://github.com/axios/axios/issues/11403), [#11404](https://github.com/axios/axios/pull/11404))
+- **Header encoding shortcuts:** The documented `Content-Encoding` shortcuts (`setContentEncoding`, `getContentEncoding`, `hasContentEncoding`) now exist at runtime; previously `getContentEncoding()` threw `TypeError` because `AxiosHeaders` only registered the `Accept-Encoding` accessor. The `Accept-Encoding` trio that the runtime already provided is now declared in `index.d.ts` and `index.d.cts`. `getContentEncoding` and `getAcceptEncoding` are typed to match `AxiosHeaders#get`: `AxiosHeaders.parseParameters` returns `AxiosHeaderParameters`, a `RegExp` returns `RegExpExecArray | null`, and no argument, `true`, or another parser function returns `AxiosHeaderValue`. The type changes are compile-time corrections, not purely additive: `getContentEncoding()` was previously declared to return `RegExpExecArray | null` and to accept string matchers, which throw `parser must be boolean|regexp|function` at runtime, and `getAcceptEncoding()` previously resolved to `any` through the `AxiosHeaders` index signature. TypeScript callers that relied on those declarations may need to narrow the result or pass a supported parser. No change to how existing headers are read or written at runtime; the matching README and docs-site shortcut-list updates are recorded in `PRE_RELEASE_DOCS.md` for release preparation. ([#11432](https://github.com/axios/axios/issues/11432))
 
 ## Documentation
 
```

**File**: `PRE_RELEASE_DOCS.md` (modified, +9/-0)
```diff
@@ -110,3 +110,12 @@ Do not store raw diffs or line-number-only instructions here; prefer stable sect
 - **Status:** Pending (README only; the English, Spanish, French, and Chinese docs site was applied in [PR #11390](https://github.com/axios/axios/pull/11390)).
 - **Docs targets:** `README.md` Handling errors section.
 - **Required content:** Explain that wrapped errors append the original stack to `error.stack` after `Caused by:`, that `error.cause` remains the programmatic link, and that stacks are not redacted by `config.redact`. Do not present the marker as a parsing contract. Follow the Wrapped error stacks section of `docs/pages/advanced/error-handling.md`.
+
+### `AxiosHeaders` encoding shortcut lists
+
+- **Change:** The `Content-Encoding` shortcuts now exist at runtime, and the `Accept-Encoding` shortcuts are declared in both type files.
+- **Source:** [Issue #11432](https://github.com/axios/axios/issues/11432).
+- **Status:** Pending.
+- **Docs targets:** `README.md` AxiosHeaders Shortcuts, `docs/pages/advanced/header-methods.md` Shortcuts, and the Spanish, French, and Chinese translations.
+- **Required content:** Keep the `setContentEncoding`, `getContentEncoding`, `hasContentEncoding` entries, which now match the runtime. Add `setAcceptEncoding`, `getAcceptEncoding`, `hasAcceptEncoding`; add the existing `Authorization` shortcuts (`setAuthorization`, `getAuthorization`, `hasAuthorization`); and mention `getSetCookie()` in the methods list, since none of these appear in the shortcut lists today.
+- **Notes:** Release-time documentation only; the runtime and type changes ship with the PR. Translations use their own section headings and may need localized wording.
```

**File**: `index.d.cts` (modified, +12/-2)
```diff
@@ -112,10 +112,20 @@ declare class AxiosHeaders {
     value: axios.AxiosHeaderValue,
     rewrite?: boolean | AxiosHeaderMatcher
   ): AxiosHeaders;
-  getContentEncoding(parser?: RegExp): RegExpExecArray | null;
-  getContentEncoding(matcher?: AxiosHeaderMatcher): axios.AxiosHeaderValue;
+  getContentEncoding(parser: typeof AxiosHeaders.parseParameters): axios.AxiosHeaderParameters;
+  getContentEncoding(parser: RegExp): RegExpExecArray | null;
+  getContentEncoding(matcher?: true | AxiosHeaderParser): axios.AxiosHeaderValue;
   hasContentEncoding(matcher?: AxiosHeaderMatcher): boolean;
 
+  setAcceptEncoding(
+    value: axios.AxiosHeaderValue,
+    rewrite?: boolean | AxiosHeaderMatcher
+  ): AxiosHeaders;
+  getAcceptEncoding(parser: typeof AxiosHeaders.parseParameters): axios.AxiosHeaderParameters;
+  getAcceptEncoding(parser: RegExp): RegExpExecArray | null;
+  getAcceptEncoding(matcher?: true | AxiosHeaderParser): axios.AxiosHeaderValue;
+  hasAcceptEncoding(matcher?: AxiosHeaderMatcher): boolean;
+
   setAuthorization(
     value: axios.AxiosHeaderValue,
     rewrite?: boolean | AxiosHeaderMatcher
```

**File**: `index.d.ts` (modified, +9/-2)
```diff
@@ -86,10 +86,17 @@ export class AxiosHeaders {
   hasUserAgent(matcher?: AxiosHeaderMatcher): boolean;
 
   setContentEncoding(value: AxiosHeaderValue, rewrite?: boolean | AxiosHeaderMatcher): AxiosHeaders;
-  getContentEncoding(parser?: RegExp): RegExpExecArray | null;
-  getContentEncoding(matcher?: AxiosHeaderMatcher): AxiosHeaderValue;
+  getContentEncoding(parser: typeof AxiosHeaders.parseParameters): AxiosHeaderParameters;
+  getContentEncoding(parser: RegExp): RegExpExecArray | null;
+  getContentEncoding(matcher?: true | AxiosHeaderParser): AxiosHeaderValue;
   hasContentEncoding(matcher?: AxiosHeaderMatcher): boolean;
 
+  setAcceptEncoding(value: AxiosHeaderValue, rewrite?: boolean | AxiosHeaderMatcher): AxiosHeaders;
+  getAcceptEncoding(parser: typeof AxiosHeaders.parseParameters): AxiosHeaderParameters;
+  getAcceptEncoding(parser: RegExp): RegExpExecArray | null;
+  getAcceptEncoding(matcher?: true | AxiosHeaderParser): AxiosHeaderValue;
+  hasAcceptEncoding(matcher?: AxiosHeaderMatcher): boolean;
+
   setAuthorization(value: AxiosHeaderValue, rewrite?: boolean | AxiosHeaderMatcher): AxiosHeaders;
   getAuthorization(parser?: RegExp): RegExpExecArray | null;
   getAuthorization(matcher?: AxiosHeaderMatcher): AxiosHeaderValue;
```

**File**: `lib/core/AxiosHeaders.js` (modified, +1/-0)
```diff
@@ -465,6 +465,7 @@ class AxiosHeaders {
 AxiosHeaders.accessor([
   'Content-Type',
   'Content-Length',
+  'Content-Encoding',
   'Accept',
   'Accept-Encoding',
   'User-Agent',
```

**File**: `tests/module/cjs/tests/helpers/cjs-added-types.ts` (modified, +21/-0)
```diff
@@ -27,6 +27,27 @@ const parsedHeaderParameters: axios.AxiosHeaderParameters = headers.get(
   axios.AxiosHeaders.parseParameters
 );
 
+const encodingHeaders = new axios.AxiosHeaders();
+encodingHeaders.setContentEncoding('gzip');
+encodingHeaders.setAcceptEncoding('gzip, br');
+const contentEncodingValue: axios.AxiosHeaderValue = encodingHeaders.getContentEncoding();
+const contentEncodingTokens: axios.AxiosHeaderValue = encodingHeaders.getContentEncoding(true);
+const contentEncodingMatch: RegExpExecArray | null = encodingHeaders.getContentEncoding(/gzip/);
+const contentEncodingParameters: axios.AxiosHeaderParameters = encodingHeaders.getContentEncoding(
+  axios.AxiosHeaders.parseParameters
+);
+const acceptEncodingParameters: axios.AxiosHeaderParameters = encodingHeaders.getAcceptEncoding(
+  axios.AxiosHeaders.parseParameters
+);
+// @ts-expect-error -- getContentEncoding rejects string matchers, which throw at runtime
+encodingHeaders.getContentEncoding('gzip');
+const acceptEncodingValue: axios.AxiosHeaderValue = encodingHeaders.getAcceptEncoding();
+const acceptEncodingTokens: axios.AxiosHeaderValue = encodingHeaders.getAcceptEncoding(true);
+const acceptEncodingMatch: RegExpExecArray | null = encodingHeaders.getAcceptEncoding(/gzip/);
+const hasAcceptEncoding: boolean = encodingHeaders.hasAcceptEncoding('gzip');
+// @ts-expect-error -- getAcceptEncoding only accepts a RegExp, true, or a parser function
+encodingHeaders.getAcceptEncoding(1);
+
 const source = axios.CancelToken.source();
 source.token.subscribe((cancel) => {
   const message: string | undefined = cancel && cancel.message;
```

**File**: `tests/module/esm/tests/helpers/esm-added-types.ts` (modified, +21/-0)
```diff
@@ -43,6 +43,27 @@ const parsedHeaderParameters: AxiosHeaderParameters = headers.get(
   AxiosHeaders.parseParameters
 );
 
+const encodingHeaders = new AxiosHeaders();
+encodingHeaders.setContentEncoding('gzip');
+encodingHeaders.setAcceptEncoding('gzip, br');
+const contentEncodingValue: AxiosHeaderValue = encodingHeaders.getContentEncoding();
+const contentEncodingTokens: AxiosHeaderValue = encodingHeaders.getContentEncoding(true);
+const contentEncodingMatch: RegExpExecArray | null = encodingHeaders.getContentEncoding(/gzip/);
+const contentEncodingParameters: AxiosHeaderParameters = encodingHeaders.getContentEncoding(
+  AxiosHeaders.parseParameters
+);
+const acceptEncodingParameters: AxiosHeaderParameters = encodingHeaders.getAcceptEncoding(
+  AxiosHeaders.parseParameters
+);
+// @ts-expect-error -- getContentEncoding rejects string matchers, which throw at runtime
+encodingHeaders.getContentEncoding('gzip');
+const acceptEncodingValue: AxiosHeaderValue = encodingHeaders.getAcceptEncoding();
+const acceptEncodingTokens: AxiosHeaderValue = encodingHeaders.getAcceptEncoding(true);
+const acceptEncodingMatch: RegExpExecArray | null = encodingHeaders.getAcceptEncoding(/gzip/);
+const hasAcceptEncoding: boolean = encodingHeaders.hasAcceptEncoding('gzip');
+// @ts-expect-error -- getAcceptEncoding only accepts a RegExp, true, or a parser function
+encodingHeaders.getAcceptEncoding(1);
+
 const source = axios.CancelToken.source();
 source.token.subscribe((cancel) => {
   const message: string | undefined = cancel && cancel.message;
```

**File**: `tests/unit/axiosHeaders.test.js` (modified, +28/-0)
```diff
@@ -784,6 +784,34 @@ describe('AxiosHeaders', () => {
     });
   });
 
+  describe('encoding accessors', () => {
+    it('should support the Content-Encoding shortcuts', () => {
+      const headers = new AxiosHeaders({ 'Content-Encoding': 'gzip' });
+
+      assert.strictEqual(headers.getContentEncoding(), 'gzip');
+      assert.strictEqual(headers.hasContentEncoding(), true);
+      assert.deepStrictEqual(Object.keys(headers.getContentEncoding(true)), ['gzip']);
+      assert.strictEqual(headers.getContentEncoding(/gz/)[0], 'gz');
+
+      assert.strictEqual(headers.setContentEncoding('br'), headers);
+      assert.strictEqual(headers.get('content-encoding'), 'br');
+      assert.strictEqual(headers.hasContentEncoding('br'), true);
+    });
+
+    it('should support the Accept-Encoding shortcuts', () => {
+      const headers = new AxiosHeaders({ 'Accept-Encoding': 'gzip, br' });
+
+      assert.strictEqual(headers.getAcceptEncoding(), 'gzip, br');
+      assert.strictEqual(headers.hasAcceptEncoding(), true);
+      assert.deepStrictEqual(Object.keys(headers.getAcceptEncoding(true)), ['gzip', 'br']);
+      assert.strictEqual(headers.getAcceptEncoding(/br/)[0], 'br');
+
+      assert.strictEqual(headers.setAcceptEncoding('deflate'), headers);
+      assert.strictEqual(headers.get('accept-encoding'), 'deflate');
+      assert.strictEqual(headers.hasAcceptEncoding('deflate'), true);
+    });
+  });
+
   it('should be caseless', () => {
     const headers = new AxiosHeaders({
       fOo: 1,
```

#### Recent Merged Pull Requests:
- **PR #11439** (2026-11-10): docs(agents): narrow the validator rule to option type and shape checks (@jasonsaayman)
- **PR #11438** (2026-11-10): chore(deps-dev): bump the development_dependencies group with 6 updates (@dependabot[bot])
- **PR #11437** (2026-11-10): chore(deps): bump zizmorcore/zizmor-action from 0.8.0 to 0.8.1 in the github-actions group (@dependabot[bot])
- **PR #11436** (2026-11-10): fix(headers): register the Content-Encoding shortcuts and declare the Accept-Encoding ones (@PerryLink)
- **PR #11435** (2026-11-09): chore(release): prepare release 1.21.1 (@github-actions[bot])
- **PR #11433** (closed): fix(headers): synchronize encoding shortcuts and types (@Narek-Khachikyan)

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

## X. fetch): close source streams after size-limit errors (#11239)

**RULE**:
When implementing operations in `PRE_RELEASE_CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in axios/axios. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4ee8d46f`: fetch): close source streams after size-limit errors (#11239). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `PRE_RELEASE_CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
- **Fetch stream cleanup:** When the fetch adapter rejects a streamed upload for exceeding `maxBodyLength`, or a streamed response for exceeding `maxContentLength`, it now cancels the source stream instead of leaving it open. Previously the size-limit error left the source paused mid-read, so its `cancel` hook never ran and the underlying connection or user-supplied `ReadableStream` stayed open until garbage collection. Cancellation is started without waiting for it, so a slow or failing cancel does not delay or replace the size-limit error. No public API or type changes. ([#11239](https://github.com/axios/axios/pull/11239))
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4ee8d46f` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

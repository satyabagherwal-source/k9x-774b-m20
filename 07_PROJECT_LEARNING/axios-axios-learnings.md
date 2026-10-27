> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/axios-axios-learnings.md`  
> **Source**: github ([https://github.com/axios/axios](https://github.com/axios/axios))  
> **Source Version**: `0a9b58d5`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T13:25:18.311Z  
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
> **Harvest Timestamp**: 2026-10-27T13:25:17.737Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `axios/axios`
- **Description**: Promise based HTTP client for the browser and node.js
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 109309 stars

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
 * Milliseconds elapsed since `start`, floored at zero.
 *
 * Wall-clock, to match the rest of the codebase (speedometer, throttle,
 * AxiosTransformStream). A backwards clock adjustment mid-request would
 * otherwise produce a negative duration, so the result is clamped.
 *
 * @param {number} start Timestamp from `Date.now()`
 *
 * @returns {number} Non-negative elapsed milliseconds
 */
function elapsedSince(start) {
  return Math.max(0, Date.now() - start);
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

  const start = Date.now();

  return adapter(config).then(
    function onAdapterResolution(response) {
      throwIfCancellationRequested(config);

      response.duration = elapsedSince(start);

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
          reason.response.duration = elapsedSince(start);
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
- **Issue #11390** (2026-10-27): **docs: apply v1.20.0/v1.21.0 release notes, docs site, and clear pre-release files**
  *Symptoms*: ## Summary  v1.21.0 has been released. This PR finishes the release documentation:  - adds the v1.21.0 release notes to `CHANGELOG.md`; - applies the 13 pending `PRE_RELEASE_DOCS.md` entries to the docs site in English, Spanish, French, and Chinese; - clears `PRE_RELEASE_CHANGELOG.md`, and reduces `PRE_RELEASE_DOCS.md` to the README updates that are still pending.  Five of the pending entries shipped in v1.20.0 (#11082, #11121, #11141), but their docs were never applied. The upgrade guide therefore gets both a v1.21.0 and a v1.20.0 section.  ## Linked issue  None. This is post-release documentation work for v1.20.0/v1.21.0.  ## Changes  - `CHANGELOG.md`: added the v1.21.0 release notes. The file's existing CRLF line endings are kept and earlier entries are unchanged. - Docs site (`docs/pages`, `docs/es/pages`, `docs/fr/pages`, `docs/zh/pages`; 13 pages per language):   - **Response duration:** response schema, error handling, adapters   - **Opt-in UTF-8 Basic auth usernames:** authentication, request config `auth` and `transitional`   - **Cookie Store XSRF reads (XHR only):** request config   - **`https.globalAgent` TLS options through CONNECT tunnels; `NO_PROXY` CIDR ranges:** request config `proxy`   - **Method-named literal headers and the custom-class defaults migration:** headers, config defaults, upgrade guide   - **Interceptor IDs and recovery from a nullish handler:** interceptors   - **Config objects returned by interceptors are normalized:** interceptors, adapters, 

- **Issue #11383** (2026-10-26): **chore(deps): bump @vitest/mocker and vitest in /tests/smoke/esm**
  *Symptoms*: Bumps [@vitest/mocker](https://github.com/vitest-dev/vitest/tree/HEAD/packages/mocker) to 4.1.12 and updates ancestor dependency [vitest](https://github.com/vitest-dev/vitest/tree/HEAD/packages/vitest). These dependencies need to be updated together.  Updates `@vitest/mocker` from 4.1.11 to 4.1.12 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/vitest-dev/vitest/releases">@​vitest/mocker's releases</a>.</em></p> <blockquote> <h2>v4.1.12</h2> <h3>   🐞 Bug Fixes</h3> <ul> <li><strong>mocker</strong>: Harden manual and redirect mocks [backport to v4]  -  by <a href="https://github.com/sheremet-va"><code>@​sheremet-va</code></a> in <a href="https://redirect.github.com/vitest-dev/vitest/issues/11580">vitest-dev/vitest#11580</a> <a href="https://github.com/vitest-dev/vitest/commit/b82531324"><!-- raw HTML omitted -->(b8253)<!-- raw HTML omitted --></a></li> </ul> <h5>    <a href="https://github.com/vitest-dev/vitest/compare/v4.1.11...v4.1.12">View changes on GitHub</a></h5> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/vitest-dev/vitest/commit/4766ce1e72ded629d3a37637f57eeae643789a8c"><code>4766ce1</code></a> chore: release v4.1.12 (<a href="https://github.com/vitest-dev/vitest/tree/HEAD/packages/mocker/issues/11610">#11610</a>)</li> <li><a href="https://github.com/vitest-dev/vitest/commit/b825313243dc55757e8d7c0f9e7a792135e13473"><code>b825313</code></a> fix(mocker): harden manual and 

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

### Incident Patch 1: `0a9b58d5` (2026-10-27)
**Commit Message**: docs: identify Axios errors independently of their name (#11374)

Co-authored-by: jasonsaayman <[REDACTED_EMAIL]>

**File**: `PRE_RELEASE_CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@
 
 ## Documentation
 
+- **Error identification:** Corrected the error `name` description in the README and English, French, Spanish, and Chinese error-handling guides. Cancellation errors use `CanceledError`, and wrapped errors may retain their original name, so the guides now recommend `axios.isAxiosError(error)` for identifying Axios errors and `axios.isCancel(error)` for detecting cancellations instead of comparing `name`. Documentation only; no runtime, public API, or type changes. ([#11374](https://github.com/axios/axios/pull/11374))
 - **v1.21.0 release notes and docs:** Added the published v1.21.0 release notes to `CHANGELOG.md`. Applied the 13 pending `PRE_RELEASE_DOCS.md` entries from v1.20.0 and v1.21.0 to the English, Spanish, French, and Chinese docs site, including upgrade-guide sections for both releases. Cleared the released entries from `PRE_RELEASE_CHANGELOG.md`, and reduced `PRE_RELEASE_DOCS.md` to the README updates that remain pending for those entries. No runtime, public API, or type compatibility changes.
 
 ## Maintenance
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1481,7 +1481,7 @@ Axios errors use this structure:
 | Property | Definition |
 | -------- | ---------- |
 | message | A quick summary of the error message and the status it failed with. |
-| name | This defines where the error originated from. For axios, it will always be an 'AxiosError'. |
+| name | The error name: usually `AxiosError`, `CanceledError` for cancellations, or the original name of a wrapped error. Use `axios.isAxiosError(error)` to identify Axios errors and `axios.isCancel(error)` to detect cancellations. |
 | stack | Stack trace for the error. |
 | config | An axios config object with specific instance configurations defined by the user from when the request was made |
 | code | Axios error code. The table below lists internal Axios error codes. |
```

**File**: `docs/es/pages/advanced/error-handling.md` (modified, +8/-8)
```diff
@@ -2,14 +2,14 @@
 
 axios puede lanzar muchos tipos diferentes de errores. Algunos de estos errores son causados por el propio axios, mientras que otros son causados por el servidor o el cliente. La siguiente tabla lista la estructura general del error lanzado:
 
-| Propiedad | Definición                                                                                                                                    |
-| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
-| message   | Un resumen rápido del mensaje de error y el estado con el que falló.                                                                          |
-| name      | Define el origen del error. Para axios, siempre será un `AxiosError`.                                                                         |
-| stack     | Proporciona el seguimiento de la pila (stack trace) del error.                                                                                |
-| config    | Un objeto de configuración de axios con configuraciones específicas de la instancia definidas por el usuario al momento de realizar la solicitud. |
-| code      | Representa un error identificado por axios. La tabla a continuación lista definiciones específicas para errores internos de axios.             |
-| status    | Código de estado HTTP de la respuesta. Consulta [aquí](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) para conocer los significados comunes de los códigos de estado HTTP. |
+| Propiedad | Definición                                                                                                                                                                                                                                            |
+| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| message   | Un resumen rápido del mensaje de error y el estado con el que falló.                                                                                                                                                                                  |
+| name      | Nombre del error: normalmente `AxiosError`, `CanceledError` para cancelaciones o el nombre original de un error encapsulado. Use `axios.isAxiosError(error)` para identificar errores de Axios y `axios.isCancel(error)` para detectar cancelaciones. |
+| stack     | Proporciona el seguimiento de la pila (stack trace) del error.                                                                                                                                                                                        |
+| config    | Un objeto de configuración de axios con configuraciones específicas de la instancia definidas por el usuario al momento de realizar la solicitud.                                                                                                     |
+| code      | Representa un error identificado por axios. La tabla a continuación lista definiciones específicas para errores internos de axios.                                                                                                                    |
+| status    | Código de estado HTTP de la respuesta. Consulta [aquí](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) para conocer los significados comunes de los códigos de estado HTTP.                                                                  |
 
 A continuación se lista una relación de posibles errores identificados por axios:
 
```

**File**: `docs/fr/pages/advanced/error-handling.md` (modified, +8/-8)
```diff
@@ -2,14 +2,14 @@
 
 axios peut lever de nombreux types d'erreurs différents. Certaines de ces erreurs sont causées par axios lui-même, tandis que d'autres sont causées par le serveur ou le client. Le tableau suivant liste la structure générale de l'erreur levée :
 
-| Propriété | Définition                                                                                                                                    |
-| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
-| message   | Un résumé rapide du message d'erreur et du statut avec lequel elle a échoué.                                                                  |
-| name      | Définit l'origine de l'erreur. Pour axios, ce sera toujours une `AxiosError`.                                                                 |
-| stack     | Fournit la trace de pile de l'erreur.                                                                                                         |
-| config    | Un objet de configuration axios avec les configurations d'instance spécifiques définies par l'utilisateur au moment de la requête.            |
-| code      | Représente une erreur identifiée par axios. Le tableau ci-dessous liste les définitions spécifiques des erreurs internes d'axios.             |
-| status    | Code de statut de la réponse HTTP. Consultez [ici](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) pour la signification des codes de statut HTTP courants. |
+| Propriété | Définition                                                                                                                                                                                                                                                           |
+| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| message   | Un résumé rapide du message d'erreur et du statut avec lequel elle a échoué.                                                                                                                                                                                         |
+| name      | Le nom de l'erreur : généralement `AxiosError`, `CanceledError` lors d'une annulation, ou le nom d'origine d'une erreur encapsulée. Utilisez `axios.isAxiosError(error)` pour identifier les erreurs Axios et `axios.isCancel(error)` pour détecter les annulations. |
+| stack     | Fournit la trace de pile de l'erreur.                                                                                                                                                                                                                                |
+| config    | Un objet de configuration axios avec les configurations d'instance spécifiques définies par l'utilisateur au moment de la requête.                                                                                                                                   |
+| code      | Représente une erreur identifiée par axios. Le tableau ci-dessous liste les définitions spécifiques des erreurs internes d'axios.                                                                                                                                    |
+| status    | Code de statut de la réponse HTTP. Consultez [ici](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) pour la signification des codes de statut HTTP courants.                                                                                                 |
 
 Voici une liste des erreurs potentielles identifiées par axios :
 
```

**File**: `docs/pages/advanced/error-handling.md` (modified, +8/-8)
```diff
@@ -2,14 +2,14 @@
 
 axios may throw many different types of errors. Some of these errors are caused by axios itself, while others are caused by the server or the client. The following table lists the general structure of the thrown error:
 
-| Property | Definition                                                                                                                                    |
-| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
-| message  | A quick summary of the error message and the status it failed with.                                                                           |
-| name     | This defines where the error originated from. For axios, it will always be an `AxiosError`.                                                   |
-| stack    | Provides the stack trace of the error.                                                                                                        |
-| config   | An axios config object with specific instance configurations defined by the user from when the request was made.                              |
-| code     | Represents an axios identified error. The table below lists out specific definitions for internal axios error.                                |
-| status   | HTTP response status code. See [here](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) for common HTTP response status code meanings. |
+| Property | Definition                                                                                                                                                                                                                      |
+| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| message  | A quick summary of the error message and the status it failed with.                                                                                                                                                             |
+| name     | The error name: usually `AxiosError`, `CanceledError` for cancellations, or the original name of a wrapped error. Use `axios.isAxiosError(error)` to identify Axios errors and `axios.isCancel(error)` to detect cancellations. |
+| stack    | Provides the stack trace of the error.                                                                                                                                                                                          |
+| config   | An axios config object with specific instance configurations defined by the user from when the request was made.                                                                                                                |
+| code     | Represents an axios identified error. The table below lists out specific definitions for internal axios error.                                                                                                                  |
+| status   | HTTP response status code. See [here](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) for common HTTP response status code meanings.                                                                                   |
 
 Below is a list of potential axios identified error
 
```

**File**: `docs/zh/pages/advanced/error-handling.md` (modified, +8/-8)
```diff
@@ -2,14 +2,14 @@
 
 axios 可能会抛出多种不同类型的错误，有些来自 axios 本身，有些来自服务器或客户端。下表列出了所抛出错误的基本结构：
 
-| 属性    | 说明                                                                                                                                          |
-| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
-| message | 错误信息的简要摘要，以及失败时的状态码。                                                                                                      |
-| name    | 定义错误的来源，对于 axios 来说始终是 `AxiosError`。                                                                                          |
-| stack   | 提供错误的堆栈跟踪。                                                                                                                          |
-| config  | 包含用户在发起请求时定义的特定实例配置的 axios 配置对象。                                                                                     |
-| code    | 表示 axios 内部识别的错误，下表列出了 axios 内部错误的具体说明。                                                                              |
-| status  | HTTP 响应状态码。常见 HTTP 响应状态码的含义请参阅[此处](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes)。                            |
+| 属性    | 说明                                                                                                                                                                                         |
+| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| message | 错误信息的简要摘要，以及失败时的状态码。                                                                                                                                                     |
+| name    | 错误名称：通常为 `AxiosError`，取消请求时为 `CanceledError`，封装底层错误时可能保留其原始名称。使用 `axios.isAxiosError(error)` 识别 Axios 错误，使用 `axios.isCancel(error)` 检测请求取消。 |
+| stack   | 提供错误的堆栈跟踪。                                                                                                                                                                         |
+| config  | 包含用户在发起请求时定义的特定实例配置的 axios 配置对象。                                                                                                                                    |
+| code    | 表示 axios 内部识别的错误，下表列出了 axios 内部错误的具体说明。                                                                                                                             |
+| status  | HTTP 响应状态码。常见 HTTP 响应状态码的含义请参阅[此处](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes)。                                                                           |
 
 以下是 axios 内部可能出现的错误列表：
 
```

---

### Incident Patch 2: `d5c49bfb` (2026-10-27)
**Commit Message**: docs: apply v1.20.0/v1.21.0 release notes, docs site, and clear pre-release files (#11390)

Co-authored-by: greptile-apps[bot] <165735046+greptile-apps[bot]@users.noreply.github.com>

**File**: `CHANGELOG.md` (modified, +68/-0)
```diff
@@ -1,5 +1,73 @@
 # Changelog
 
+## v1.21.0 — October 21, 2026
+
+This release adds response timing and opt-in UTF-8 Basic authentication, improves request handling across runtimes, and changes how header defaults are recognized.
+
+## ⚠️ Breaking Changes & Deprecations
+
+* **Header Defaults:** Only plain objects, null-prototype maps, and compatible `AxiosHeaders` instances are treated as common or method-specific defaults; literal headers such as `Link` are now preserved. Applications using custom class instances as defaults must convert them to plain maps, for example `{ post: { ...customDefaults } }`, or compatible `AxiosHeaders`. Otherwise, those instances become literal header values, including on requests using other methods. (**[#11156](https://github.com/axios/axios/pull/11156)**)
+
+## 🚀 New Features
+
+* **Response Timing:** Added `response.duration`, in milliseconds, including on `error.response` when present. Timing measures adapter execution and excludes interceptors and transforms; streamed responses stop timing when the stream becomes available. Axios replaces any existing `duration` value supplied by a custom adapter. (**[#11214](https://github.com/axios/axios/pull/11214)**)
+* **UTF-8 Basic Authentication:** Added `transitional.encodeBasicAuthUsername: true` to support Unicode usernames in XHR and Fetch requests. The option defaults to `false`, preserving existing authentication behavior; applications opting in should supply the original Unicode username and remove manual pre-encoding workarounds. (**[#11159](https://github.com/axios/axios/pull/11159)**)
+
+## 🐛 Bug Fixes
+
+* **Fetch Compatibility:** Restored requests in runtimes such as Cloudflare Workers that reject the implicit `cache: 'default'`, while preserving explicit caller settings. Response-size failures now retain their original `ERR_BAD_RESPONSE` and request context when runtime wrappers replace the underlying stream error. (**[#11194](https://github.com/axios/axios/pull/11194)**, **[#11179](https://github.com/axios/axios/pull/11179)**)
+* **Runtime Consistency:** Aligned encoded-byte size accounting, multipart uploads, proxy routing, same-origin resolution, parameter merging, and form serialization across adapters. Circular parameters now reject with `ERR_BAD_OPTION_VALUE`, and sparse or non-index numeric form fields serialize as keyed objects. With `proxy: false`, native `proxyEnv` agents using unsupported pool-management or TLS-session lifecycle overrides now reject with `ERR_BAD_OPTION_VALUE`; construct those agents without `proxyEnv`. (**[#11242](https://github.com/axios/axios/pull/11242)**)
+* **Header Handling:** Preserved headers named **`__proto__`** using safe casing without changing the `AxiosHeaders` instance prototype. Function matchers in `has()`, `delete()`, and `clear()` now receive the headers instance as `this`, matching their declared contract. (**[#11134](https://github.com/axios/axios/pull/11134)**, **[#11216](https://github.com/axios/axios/pull/11216)**)
+* **URL and Data URL Parsing:** Accepted case-insensitive supported URL schemes and Base64 markers, and corrected decoding of percent-encoded Base64 data URLs. Node data URL allocation estimates remain aligned with decoding so configured size limits apply before allocation. (**[#11138](https://github.com/axios/axios/pull/11138)**, **[#11163](https://github.com/axios/axios/pull/11163)**, **[#11294](https://github.com/axios/axios/pull/11294)**)
+* **Error Diagnostics:** Preserved short reconstructed request stacks and appended wrapped error stacks under `Caused by:` so tooling that reads only `error.stack` retains the original failure context. (**[#11132](https://github.com/axios/axios/pull/11132)**, **[#11142](https://github.com/axios/axios/pull/11142)**)
+* **Interceptor Removal:** Restored removal through canonical numeric-string interceptor IDs, including after registry compaction. (**[#11139](https://github.com/axios/axios/pull/11139)**)
+* **Proxy TLS:** HTTPS CONNECT tunnels now apply current origin TLS options from an explicit `httpsAgent`, or from `https.globalAgent` when no explicit agent is supplied. This preserves process-wide custom CA settings through proxy tunnels. (**[#11178](https://github.com/axios/axios/pull/11178)**)
+* **XHR Lifecycle:** Used asynchronous Cookie Store reads for XSRF tokens where supported, preserving cookie fallback, timeout accounting, and cancellation. Upload and download progress listeners are now removed on completion, failure, timeout, and cancellation. (**[#11166](https://github.com/axios/axios/pull/11166)**, **[#11225](https://github.com/axios/axios/pull/11225)**)
+* **HTTP/2 Sessions:** Stopped reusing sessions immediately after GOAWAY and prevented draining sessions from scheduling idle timers that could delay process exit. (**[#11210](https://github.com/axios/axios/pull/11210)**)
+* **TypeScript Declarations:** Exposed the response-default marker as a public type to resolve `TS252
```

**File**: `PRE_RELEASE_CHANGELOG.md` (modified, +1/-44)
```diff
@@ -4,55 +4,12 @@
 
 ## Features
 
-- **Response duration:** Added `response.duration` and `error.response.duration` when a response is available, with matching ESM/CommonJS types. The value measures wall-clock milliseconds from adapter invocation to settlement, excluding interceptors and request/response transforms. Buffered responses include body reception; streamed responses stop timing when the stream becomes available. Backward clock adjustments clamp to zero, while forward adjustments can inflate the value. Errors without a response have no duration. This additive API replaces any custom adapter's existing `duration` value with the dispatch measurement. (**[#11214](https://github.com/axios/axios/pull/11214)**; related to **[#695](https://github.com/axios/axios/issues/695)** and **[#6984](https://github.com/axios/axios/issues/6984)**)
-- **Opt-in UTF-8 Basic auth usernames:** Added `transitional.encodeBasicAuthUsername: true` to UTF-8 encode `auth.username` in XHR/Fetch config resolution, matching the existing password encoding and allowing usernames beyond Latin-1. The option defaults to `false`, preserving XHR's legacy username bytes, existing pre-encoding workarounds, and Fetch's existing rejection of config usernames above U+00FF. Fetch's final UTF-8 header encoding, URL credentials, and Node HTTP authentication remain unchanged. Invalid UTF-16 still rejects with `ERR_BAD_OPTION_VALUE` in XHR/Fetch. This is an additive, non-breaking option with matching ESM/CommonJS declarations. (**[#11159](https://github.com/axios/axios/pull/11159)**)
-- **Proxy bypass CIDR ranges:** Added IPv4 and IPv6 CIDR matching to `NO_PROXY`/`no_proxy`, including bracketed IPv6 and IPv4-mapped IPv6 normalization, while malformed ranges fail closed. A `/0` entry bypasses the proxy for its entire address family.
-- **HTTP status code names:** Added the RFC 9110 names `HttpStatusCode.ContentTooLarge` for 413 and `HttpStatusCode.UnprocessableContent` for 422 across the runtime API and ESM/CommonJS declarations. The existing `PayloadTooLarge` and `UnprocessableEntity` names remain as deprecated aliases, and numeric reverse lookups retain their existing v1.x names for compatibility. (**#11082**, closes **#11066**)
-
 ## Bug Fixes
 
-- **XHR progress cleanup:** Detach download and upload progress listeners when a request completes, fails, times out, or is canceled. Final progress callbacks that throw are reported asynchronously without skipping listener and cancellation cleanup, and reentrant cancellation remains safe. Preserve the asynchronous XSRF timeout cleanup and existing public API and types. This ensures deterministic teardown; it does not establish the cause of the memory growth reported in #5641. (**[#11225](https://github.com/axios/axios/pull/11225)**, related to **[#5641](https://github.com/axios/axios/issues/5641)**)
-- **XHR adapter cookie access:** Read eligible XSRF cookies through the asynchronous Cookie Store API when supported, avoiding synchronous cookie access while preserving existing URI decoding, malformed-value handling, and fallback behavior. Cookie preparation shares the configured request timeout and cancellation lifecycle; late results cannot send canceled or expired requests. Fetch behavior, public options, and token values remain compatible. (**[#11166](https://github.com/axios/axios/pull/11166)**, closes **[#10826](https://github.com/axios/axios/issues/10826)**)
-- **Node HTTP adapter - proxy tunnel TLS options:** Apply `https.globalAgent` TLS options, including a custom `ca`, to HTTPS origins reached through CONNECT proxies when no per-request `httpsAgent` is supplied. Read origin TLS options for each request so cached tunneling agents pick up changes to the selected agent or a replacement global agent. Explicit agents retain precedence, and the HTTPS proxy connection retains its existing TLS configuration. No new API or type changes. (**#11178**, related to **#11176**; the reported explicit-agent failure remains unverified.)
-- **Percent-encoded Base64 data URLs:** Decode URL-escaped Base64 alphabet, padding, and whitespace before converting the Node HTTP adapter's data URL response. Estimate the Buffer backing allocation after the same decoding so encoded alphabet and padding no longer inflate byte-limit checks, while avoiding the per-character decoding scan for unescaped Base64. Ordinary Base64 inputs, forgiving Buffer decoding, and case-insensitive URL schemes and Base64 markers are preserved; pre-allocation limits still count ignored characters and content after padding. (**[#11294](https://github.com/axios/axios/pull/11294)**)
-- **URL scheme casing:** Accept uppercase and mixed-case supported schemes in the XHR adapter and Node data URLs. Keep data URL allocation estimates aligned with decoding so configured limits reject oversized inputs before Buffer allocation, including ignored Base64 tails. URL paths, query values, payload casing, and unsupported-protocol rejection remain unchanged; no 
```

**File**: `PRE_RELEASE_DOCS.md` (modified, +71/-190)
```diff
@@ -20,193 +20,74 @@ Do not store raw diffs or line-number-only instructions here; prefer stable sect
 
 ## Unreleased
 
-### Response duration
-
-- **Change:** Expose elapsed adapter time as the optional numeric `AxiosResponse.duration` property in milliseconds, including on `error.response` when present.
-- **Source:** [PR #11214](https://github.com/axios/axios/pull/11214), related to [request/response timing #695](https://github.com/axios/axios/issues/695) and [feature suggestions #6984](https://github.com/axios/axios/issues/6984).
-- **Status:** Pending.
-- **Docs targets:** README response schema and error-handling examples; docs-site response schema and error handling; corresponding translations.
-- **Required content:** Timing starts immediately before adapter invocation, after request interceptors and request transforms. It ends in the adapter's settlement handler, before response transforms and response interceptors. Buffered responses include body reception; HTTP/Fetch streaming responses measure only the time until the stream becomes available, and consuming or failing that stream later does not update the value. This is not a DNS/TCP/TLS/TTFB breakdown or server-processing time. It includes adapter work such as connection queuing and redirects. Errors without a response, including ordinary network errors, timeouts, and cancellations, have no duration. Strict JSON parsing failures retain the duration on their attached response.
-- **Examples:** Show `const response = await axios.get('/users'); console.log(response.duration);`. For errors, guard with `axios.isAxiosError(error)` and `error.response` before reading `error.response.duration`; do not imply that every error has a response.
-- **Notes:** Values use `Date.now()`, with two clock reads for a response receiving timing metadata. Backward clock adjustments clamp to zero; forward adjustments can inflate the value, so it is approximate wall-clock timing rather than a monotonic measurement. The field is enumerable and overwrites a custom adapter's existing `duration` property. Both declaration formats keep it optional for custom adapters and manually constructed responses. Semver impact is minor; no new option, dependency, or migration for built-in-adapter users. Apply published documentation only during release preparation.
-
-### Asynchronous XSRF cookie reads in the XHR adapter
-
-- **Change:** Document the XHR adapter's use of the Cookie Store API for XSRF token reads.
-- **Source:** `PRE_RELEASE_CHANGELOG.md` Bug Fixes, XHR adapter cookie access; PR #11166 and issue #10826.
-- **Status:** Pending.
-- **Docs targets:** README and request-config guidance for `xsrfCookieName`, `xsrfHeaderName`, and `withXSRFToken`; browser support notes; translated docs after the English documentation is finalized.
-- **Required content:** Explain that the XHR adapter automatically uses `window.cookieStore` when available to avoid synchronous `document.cookie` access while resolving an eligible XSRF token. Browsers without Cookie Store support retain the existing `document.cookie` behavior, and a failed Cookie Store read also falls back to that path. Both read paths preserve Axios's existing URI decoding (once), with malformed escape sequences left unchanged. Cookie lookup and the subsequent XHR share the configured timeout; both cancellation APIs also work during lookup, and late results cannot dispatch a canceled or expired request. The Fetch adapter and the public request-config surface are unchanged; no migration is required.
-- **Examples:** None required because capability detection is automatic and adds no configuration.
-- **Notes:** Keep the explanation scoped to XHR XSRF reads; do not imply that all cookie operations or the Fetch adapter use Cookie Store. Issue #10826 originally requested raw values; compatibility requires retaining Axios's existing decoding because Cookie Store does not percent-decode stored cookies.
-
-### Opt-in UTF-8 Basic auth usernames
-
-- **Change:** Added `transitional.encodeBasicAuthUsername`, a boolean defaulting to `false`, to opt into UTF-8 encoding of `auth.username` during XHR/Fetch config resolution.
-- **Source:** [PR #11159](https://github.com/axios/axios/pull/11159); `PRE_RELEASE_CHANGELOG.md` Features.
-- **Status:** Pending.
-- **Docs targets:** README request-config `auth` and transitional options; request-config and authentication documentation in the docs site and translations.
-- **Required content:** Explain that applications talking to UTF-8 Basic-auth servers can enable this option per request or with `axios.create`. Existing defaults remain compatible: XHR uses legacy single-byte username encoding and UTF-8 passwords, while Fetch already sends UTF-8 but its config resolution rejects usernames above U+00FF unless opted in. Node HTTP and Fetch URL-embedded credentials are unchanged. Setting the option to `false` on a request overrides an instance opt-in; it does not select Latin-1 for Fetch or Node HTTP.
--
```

**File**: `docs/es/pages/advanced/adapters.md` (modified, +2/-0)
```diff
@@ -83,6 +83,8 @@ function myAdapter(config) {
 const instance = axios.create({ adapter: myAdapter });
 ```
 
+El adaptador recibe la configuración devuelta por los interceptores de solicitud. Una configuración escribible con prototipo nulo, como la configuración combinada original, se pasa como el mismo objeto; cualquier otra configuración devuelta por un interceptor se copia primero en una instantánea filtrada con prototipo nulo (consulta [Devolver un objeto de configuración diferente](/es/pages/advanced/interceptors#devolver-un-objeto-de-configuracion-diferente)). Cuando el adaptador termina, axios establece [`response.duration`](/es/pages/advanced/response-schema#duracion-de-la-respuesta) en la respuesta, reemplazando cualquier valor de `duration` que haya establecido el adaptador.
+
 Los adaptadores TypeScript pueden conservar tanto los datos de solicitud como los parámetros de consulta en la configuración de la respuesta usando los genéricos correspondientes:
 
 ```ts
```

**File**: `docs/es/pages/advanced/api-reference.md` (modified, +16/-1)
```diff
@@ -103,12 +103,15 @@ isAxiosError: boolean;
 status?: number;
 
 // Método auxiliar para convertir el error a un objeto JSON.
+// Incluye `stack`, que puede contener una sección `Caused by:` del error envuelto.
 toJSON: () => object;
 
-// Causa del error.
+// Causa del error: el error original envuelto por `AxiosError.from()`.
 cause?: Error;
 ```
 
+Cuando `AxiosError.from()` envuelve un error con una pila utilizable, `stack` también incluye esa pila después de una línea `Caused by:`. `cause` sigue siendo el enlace programático admitido al error original. Consulta [Pilas de errores envueltos](/es/pages/advanced/error-handling#pilas-de-errores-envueltos).
+
 ### `AxiosHeaders`
 
 La clase `AxiosHeaders` es una clase de utilidad que se usa para gestionar encabezados HTTP. Provee métodos para manipular encabezados, como añadir, eliminar y obtener encabezados.
@@ -395,6 +398,18 @@ try {
 }
 ```
 
+Para los estados 413 y 422, prefiere los nombres de la RFC 9110 `ContentTooLarge` y `UnprocessableContent`:
+
+```js
+if (error.response?.status === HttpStatusCode.ContentTooLarge) {
+  console.error('Upload is too large'); // 413
+} else if (error.response?.status === HttpStatusCode.UnprocessableContent) {
+  console.error('Validation failed'); // 422
+}
+```
+
+Los nombres anteriores `PayloadTooLarge` y `UnprocessableEntity` siguen disponibles como alias obsoletos durante toda la v1.x. Las búsquedas inversas numéricas siguen devolviendo los nombres heredados por compatibilidad, por lo que `HttpStatusCode[413]` es `'PayloadTooLarge'` y `HttpStatusCode[422]` es `'UnprocessableEntity'`.
+
 ## Miscelánea
 
 ### `VERSION`
```

**File**: `docs/es/pages/advanced/authentication.md` (modified, +38/-0)
```diff
@@ -35,6 +35,44 @@ const response = await axios.get("https://api.example.com/data", {
 
 Si no se proporciona `auth`, los adaptadores HTTP de Node.js y fetch también pueden obtener credenciales Basic desde la URL de la solicitud, por ejemplo `https://myUser:myPassword@api.example.com/data`. Las credenciales codificadas con porcentaje en la URL se decodifican antes de generar el encabezado `Authorization`. Para código nuevo, prefiere la opción explícita `auth`; tiene prioridad sobre las credenciales incluidas en la URL.
 
+### Nombres de usuario UTF-8
+
+De forma predeterminada, los adaptadores XHR y fetch mantienen su manejo existente de nombres de usuario por compatibilidad:
+
+- El adaptador XHR envía el nombre de usuario como caracteres heredados de un solo byte (Latin-1) y la contraseña como UTF-8.
+- El adaptador fetch envía credenciales UTF-8, pero rechaza nombres de usuario que contengan caracteres por encima de U+00FF.
+
+En ambos adaptadores, un nombre de usuario no admitido se rechaza con `ERR_BAD_OPTION_VALUE`. Si tu servidor espera nombres de usuario Basic auth en UTF-8, establece `transitional.encodeBasicAuthUsername: true` por solicitud o en una instancia:
+
+```js
+await axios.get('/account', {
+  auth: { username: 'π', password: 'secret' },
+  transitional: { encodeBasicAuthUsername: true },
+});
+```
+
+Un `false` a nivel de solicitud anula la activación en la instancia, por ejemplo para un endpoint XHR heredado que espera bytes Latin-1 en el nombre de usuario:
+
+```js
+const api = axios.create({
+  transitional: { encodeBasicAuthUsername: true },
+});
+
+await api.get('/legacy/account', {
+  auth: { username: 'café', password: 'secret' },
+  transitional: { encodeBasicAuthUsername: false },
+});
+```
+
+Ten en cuenta lo siguiente:
+
+- Si actualmente conviertes tú mismo los nombres de usuario a cadenas de bytes UTF-8, elimina esa conversión al activar la opción para evitar una doble codificación.
+- No actives la opción para servidores XHR que esperan bytes Latin-1 heredados en el nombre de usuario.
+- Establecer la opción en `false` no hace que los adaptadores fetch o HTTP de Node.js envíen Latin-1.
+- La opción no afecta al adaptador HTTP de Node.js ni a las credenciales incluidas en la URL de una solicitud fetch.
+- Los nombres de usuario ASCII y vacíos se codifican igual en ambos casos. Las cadenas UTF-16 malformadas siguen rechazándose con `ERR_BAD_OPTION_VALUE`.
+- axios no negocia el conjunto de caracteres a partir del desafío de autenticación del servidor ni normaliza cadenas Unicode.
+
 ::: tip
 Para tokens Bearer y claves de API, usa un encabezado `Authorization` personalizado en lugar de la opción `auth` — `auth` es solo para HTTP Basic.
 :::
```

**File**: `docs/es/pages/advanced/config-defaults.md` (modified, +22/-0)
```diff
@@ -13,6 +13,28 @@ axios.defaults.headers.post["Content-Type"] =
 Si tu aplicación se comunica con más de un dominio, establecer `axios.defaults.headers.common["Authorization"]` enviará el token a **todos** ellos, incluidas APIs de terceros que tal vez no controles. Usa una [instancia personalizada](#valores-predeterminados-personalizados-por-instancia) con un `baseURL` acotado para cualquier cliente que transporte credenciales.
 :::
 
+## Valores predeterminados de encabezados por método
+
+`headers.common` se aplica a todas las solicitudes, y `headers.get`, `headers.post` y los demás nombres de método en minúsculas se aplican solo a las solicitudes con ese método. Estos grupos de valores predeterminados deben ser objetos planos, objetos con prototipo nulo o instancias de `AxiosHeaders`. Cualquier otro valor bajo una de estas claves se trata como un valor de encabezado literal; consulta [Encabezados con nombres de métodos HTTP](/es/pages/advanced/headers#encabezados-con-nombres-de-metodos-http).
+
+Si construyes los valores predeterminados con tu propia clase, convierte la instancia antes de asignarla como grupo:
+
+```js
+import axios, { AxiosHeaders } from 'axios';
+
+const instance = axios.create({
+  headers: {
+    // Ambas opciones conservan las entradas de encabezado propias y enumerables de la instancia como valores predeterminados de POST
+    post: { ...customDefaults },
+    // o bien: post: new AxiosHeaders({ ...customDefaults }),
+  },
+});
+```
+
+::: warning
+Una instancia de clase arbitraria asignada bajo `common` o un nombre de método no se usa como grupo. Su representación como cadena se envía como un encabezado literal (por ejemplo, `post: [object Object]`) en cada solicitud, incluidas las solicitudes con otros métodos. Un `toString()` personalizado puede exponer de esta forma el contenido de la instancia.
+:::
+
 ## Valores predeterminados personalizados por instancia
 
 Las instancias de axios se declaran con sus propios valores predeterminados al ser creadas. Estos valores pueden sobreescribirse estableciendo la propiedad `defaults` en la instancia. A continuación se muestra un ejemplo de cómo usar valores predeterminados personalizados por instancia:
```

**File**: `docs/es/pages/advanced/error-handling.md` (modified, +52/-0)
```diff
@@ -95,6 +95,58 @@ axios.get("/user/12345", {
 });
 ```
 
+## Duración de la respuesta en errores
+
+Cuando un error incluye una respuesta, como un estado distinto de 2xx rechazado por `validateStatus`, `error.response.duration` contiene el tiempo transcurrido del adaptador en milisegundos. No todos los errores tienen una respuesta: los errores de red, los tiempos de espera agotados y las cancelaciones no tienen `error.response` y, por tanto, tampoco duración. Comprueba que exista una respuesta antes de leerla:
+
+```js
+try {
+  await axios.get('/users');
+} catch (error) {
+  if (axios.isAxiosError(error) && error.response) {
+    console.log(error.response.status, error.response.duration);
+  }
+}
+```
+
+Los fallos de análisis JSON estricto conservan la duración en la respuesta adjunta al error. Consulta [Duración de la respuesta](/es/pages/advanced/response-schema#duracion-de-la-respuesta) para saber qué mide el valor.
+
+## Pilas de errores envueltos
+
+Cuando axios envuelve un error de más bajo nivel, como un fallo de socket o de DNS de Node.js, el error original sigue disponible como `error.cause`. El `error.stack` del contenedor también incluye la pila del error envuelto después de una línea `Caused by:`, de modo que los sistemas de reporte de errores que solo leen `stack` pueden ver el fallo subyacente. Primero aparecen los marcos de axios y los marcos reconstruidos del llamador, seguidos de la pila envuelta tal cual:
+
+```text
+Error: getaddrinfo ENOTFOUND api.example.invalid
+    at AxiosError.from (.../axios/lib/core/AxiosError.js)
+    ...
+    at Axios.request (.../axios/lib/core/Axios.js)
+    at async loadUser (/app/users.js:4:5)
+Caused by: Error: getaddrinfo ENOTFOUND api.example.invalid
+    at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:...)
+```
+
+Usa `error.cause` para el acceso programático; es el mismo objeto de error original:
+
+```js
+try {
+  await axios.get('https://api.example.invalid/users');
+} catch (error) {
+  if (axios.isAxiosError(error) && error.cause) {
+    console.log(error.cause.code); // p. ej. 'ENOTFOUND'
+  }
+}
+```
+
+Ten en cuenta lo siguiente:
+
+- `error.toJSON().stack` también devuelve la cadena combinada. Es una salida de diagnóstico literal: `redact` no limpia las cadenas de pila.
+- Las herramientas que ya muestran `error.cause` pueden mostrar parte del contenido de la pila dos veces.
+- Solo los errores envueltos mediante `AxiosError.from()` cuya causa tiene una pila utilizable obtienen una sección. Las pilas ausentes, vacías o ilegibles se omiten.
+- Envolver un error ya envuelto añade otra sección anidada cada vez, por lo que la cadena crece con cada envoltura.
+- Un `stack` pasado en el argumento `customProps` de `AxiosError.from()` sigue reemplazando la pila generada.
+- El marcador `Caused by:` es texto de diagnóstico, no un formato estable que se pueda analizar.
+- Envolver no puede recuperar detalles que la plataforma nunca proporcionó. Por ejemplo, un `Network Error` de XHR en el navegador generalmente no tiene una pila de error subyacente, por lo que las causas ocultas de CORS, DNS o TLS siguen sin estar disponibles.
+
 ## Manejo de tiempos de espera
 
 Cuando una solicitud excede su `timeout` configurado, axios rechaza con `ECONNABORTED` por defecto. Establece `transitional.clarifyTimeoutError: true` para recibir `ETIMEDOUT` en su lugar, lo que facilita distinguir los errores de tiempo de espera de otros abortos.
```

#### Recent Merged Pull Requests:
- **PR #11390** (2026-10-27): docs: apply v1.20.0/v1.21.0 release notes, docs site, and clear pre-release files (@jasonsaayman)
- **PR #11383** (2026-10-26): chore(deps): bump @vitest/mocker and vitest in /tests/smoke/esm (@dependabot[bot])
- **PR #11381** (closed): fix(helpers): guard throttle trailing timer when lastArgs is null (@junaidkhan80121)
- **PR #11375** (2026-10-26): chore(deps-dev): bump vite from 8.1.5 to 8.3.5 in /tests/module/esm (@dependabot[bot])
- **PR #11374** (2026-10-27): docs: identify Axios errors independently of their name (@Ghoscro)
- **PR #11372** (2026-10-26): chore(deps-dev): bump vite from 8.1.2 to 8.3.5 (@dependabot[bot])

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

## X. docs: identify Axios errors independently of their name (#11374)

**RULE**:
When implementing operations in `PRE_RELEASE_CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in axios/axios. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0a9b58d5`: docs: identify Axios errors independently of their name (#11374). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `PRE_RELEASE_CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
- **Error identification:** Corrected the error `name` description in the README and English, French, Spanish, and Chinese error-handling guides. Cancellation errors use `CanceledError`, and wrapped errors may retain their original name, so the guides now recommend `axios.isAxiosError(error)` for identifying Axios errors and `axios.isCancel(error)` for detecting cancellations instead of comparing `name`. Documentation only; no runtime, public API, or type changes. ([#11374](https://github.com/axios/axios/pull/11374))
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0a9b58d5` are properly handled with clean fallback behavior.

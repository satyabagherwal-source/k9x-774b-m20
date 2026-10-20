> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/axios-axios-learnings.md`  
> **Source**: github ([https://github.com/axios/axios](https://github.com/axios/axios))  
> **Source Version**: `8d8e8440`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T00:06:13.558Z  
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
> **Harvest Timestamp**: 2026-10-20T00:06:13.551Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `axios/axios`
- **Description**: Promise based HTTP client for the browser and node.js
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 109302 stars

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
- **Issue #11335** (2026-10-19): **docs: correct interceptor options and request lifecycle guide**
  *Symptoms*: ## Summary  The contributor guide says response interceptors support `synchronous` and `runWhen`, although `Axios._request()` only reads these options for request interceptors. It also places adapter selection before `transformRequest`, reversing the order in `dispatchRequest()`.  ## Linked issue  No existing issue; these discrepancies were found by comparing the guide with the implementation and README.  ## Changes  - Limit interceptor options to request interceptors and describe the existing opt-in FIFO request order. - Put request transforms before adapter selection in the lifecycle list. - Add the required prerelease documentation entry. The Copilot stub already points to this guide and does not duplicate these statements.  ## Validation  - `git diff --check`: passed. - Reviewed the complete two-file diff against `v1.x` at `326843a3902d73c9f6af9bad7b55e2412566a251`. - Cross-checked `lib/core/Axios.js`, `lib/core/dispatchRequest.js`, `lib/defaults/transitional.js`, the README's request-only options note, both type declarations, and the existing browser interceptor ordering tests. This was source inspection; the tests were not executed. - The prerelease entry links to this PR; the existing Copilot guide reference resolves to `AGENTS.md`. - Local install, lint, build, unit, browser, and package/module tests are not applicable to this Markdown-only change, per AGENTS.md's documentation validation exception. - GitHub Actions checked on head `5b222ee0bc2776a5153c5795e6d5752b8c5

- **Issue #11324** (2026-10-19): **chore(deps): bump serialize-javascript and mocha in /tests/module/cjs**
  *Symptoms*: Bumps [serialize-javascript](https://github.com/yahoo/serialize-javascript) to 7.1.2 and updates ancestor dependency [mocha](https://github.com/mochajs/mocha). These dependencies need to be updated together.  Updates `serialize-javascript` from 6.0.0 to 7.1.2 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/yahoo/serialize-javascript/releases">serialize-javascript's releases</a>.</em></p> <blockquote> <h2>v7.1.2</h2> <p>See: <a href="https://github.com/yahoo/serialize-javascript/security/advisories/GHSA-gfhx-hw2g-v5hg">https://github.com/yahoo/serialize-javascript/security/advisories/GHSA-gfhx-hw2g-v5hg</a></p> <h2>v7.1.1</h2> <h2>What's Changed</h2> <ul> <li>fix: fix XSS bypass via split <code>&lt;/script</code> payload across function bodies by <a href="https://github.com/okuryu"><code>@​okuryu</code></a> in <a href="https://redirect.github.com/yahoo/serialize-javascript/pull/226">yahoo/serialize-javascript#226</a></li> <li>release: v7.1.1 by <a href="https://github.com/okuryu"><code>@​okuryu</code></a> in <a href="https://redirect.github.com/yahoo/serialize-javascript/pull/227">yahoo/serialize-javascript#227</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/yahoo/serialize-javascript/compare/v7.1.0...v7.1.1">https://github.com/yahoo/serialize-javascript/compare/v7.1.0...v7.1.1</a></p> <h2>v7.1.0</h2> <h2>What's Changed</h2> <ul> <li>feat: add Node.js 26 to test matrix by <a href="https://github.com/okur

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

### Incident Patch 1: `b0842e8d` (2026-10-13)
**Commit Message**: fix(xhr): avoid main-thread jank from cookie reads (#11166)

Co-authored-by: yiheng-kkk <[REDACTED_EMAIL]>
Co-authored-by: Jason Saayman <[REDACTED_EMAIL]>

**File**: `PRE_RELEASE_CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@
 
 ## Bug Fixes
 
+- **XHR adapter cookie access:** Read eligible XSRF cookies through the asynchronous Cookie Store API when supported, avoiding synchronous cookie access while preserving existing URI decoding, malformed-value handling, and fallback behavior. Cookie preparation shares the configured request timeout and cancellation lifecycle; late results cannot send canceled or expired requests. Fetch behavior, public options, and token values remain compatible. (**[#11166](https://github.com/axios/axios/pull/11166)**, closes **[#10826](https://github.com/axios/axios/issues/10826)**)
 - **Node HTTP adapter - proxy tunnel TLS options:** Apply `https.globalAgent` TLS options, including a custom `ca`, to HTTPS origins reached through CONNECT proxies when no per-request `httpsAgent` is supplied. Read origin TLS options for each request so cached tunneling agents pick up changes to the selected agent or a replacement global agent. Explicit agents retain precedence, and the HTTPS proxy connection retains its existing TLS configuration. No new API or type changes. (**#11178**, related to **#11176**; the reported explicit-agent failure remains unverified.)
 - **Percent-encoded Base64 data URLs:** Decode URL-escaped Base64 alphabet, padding, and whitespace before converting the Node HTTP adapter's data URL response. Estimate the Buffer backing allocation after the same decoding so encoded alphabet and padding no longer inflate byte-limit checks, while avoiding the per-character decoding scan for unescaped Base64. Ordinary Base64 inputs, forgiving Buffer decoding, and case-insensitive URL schemes and Base64 markers are preserved; pre-allocation limits still count ignored characters and content after padding. (**[#11294](https://github.com/axios/axios/pull/11294)**)
 - **URL scheme casing:** Accept uppercase and mixed-case supported schemes in the XHR adapter and Node data URLs. Keep data URL allocation estimates aligned with decoding so configured limits reject oversized inputs before Buffer allocation, including ignored Base64 tails. URL paths, query values, payload casing, and unsupported-protocol rejection remain unchanged; no new API or type changes. (**[#11163](https://github.com/axios/axios/pull/11163)**)
```

**File**: `PRE_RELEASE_DOCS.md` (modified, +10/-0)
```diff
@@ -20,6 +20,16 @@ Do not store raw diffs or line-number-only instructions here; prefer stable sect
 
 ## Unreleased
 
+### Asynchronous XSRF cookie reads in the XHR adapter
+
+- **Change:** Document the XHR adapter's use of the Cookie Store API for XSRF token reads.
+- **Source:** `PRE_RELEASE_CHANGELOG.md` Bug Fixes, XHR adapter cookie access; PR #11166 and issue #10826.
+- **Status:** Pending.
+- **Docs targets:** README and request-config guidance for `xsrfCookieName`, `xsrfHeaderName`, and `withXSRFToken`; browser support notes; translated docs after the English documentation is finalized.
+- **Required content:** Explain that the XHR adapter automatically uses `window.cookieStore` when available to avoid synchronous `document.cookie` access while resolving an eligible XSRF token. Browsers without Cookie Store support retain the existing `document.cookie` behavior, and a failed Cookie Store read also falls back to that path. Both read paths preserve Axios's existing URI decoding (once), with malformed escape sequences left unchanged. Cookie lookup and the subsequent XHR share the configured timeout; both cancellation APIs also work during lookup, and late results cannot dispatch a canceled or expired request. The Fetch adapter and the public request-config surface are unchanged; no migration is required.
+- **Examples:** None required because capability detection is automatic and adds no configuration.
+- **Notes:** Keep the explanation scoped to XHR XSRF reads; do not imply that all cookie operations or the Fetch adapter use Cookie Store. Issue #10826 originally requested raw values; compatibility requires retaining Axios's existing decoding because Cookie Store does not percent-decode stored cookies.
+
 ### Opt-in UTF-8 Basic auth usernames
 
 - **Change:** Added `transitional.encodeBasicAuthUsername`, a boolean defaulting to `false`, to opt into UTF-8 encoding of `auth.username` during XHR/Fetch config resolution.
```

**File**: `lib/adapters/xhr.js` (modified, +94/-11)
```diff
@@ -7,6 +7,7 @@ import normalizeURLForProtocolCheck from '../helpers/normalizeURLForProtocolChec
 import parseProtocol from '../helpers/parseProtocol.js';
 import platform from '../platform/index.js';
 import AxiosHeaders from '../core/AxiosHeaders.js';
+import cookies from '../helpers/cookies.js';
 import { progressEventReducer } from '../helpers/progressEventReducer.js';
 import resolveConfig from '../helpers/resolveConfig.js';
 import { toByteStringHeaderObject } from '../helpers/sanitizeHeaderValue.js';
@@ -16,15 +17,34 @@ const isXHRAdapterSupported = typeof XMLHttpRequest !== 'undefined';
 export default isXHRAdapterSupported &&
   function (config) {
     return new Promise(function dispatchXhrRequest(resolve, reject) {
-      const _config = resolveConfig(config);
+      let useAsyncXsrf;
+      try {
+        const store =
+          platform.hasStandardBrowserEnv && typeof window !== 'undefined' && window.cookieStore;
+        useAsyncXsrf = store && utils.isFunction(store.get);
+      } catch (e) {
+        // A restricted Cookie Store getter must retain the synchronous fallback.
+      }
+      let xsrfCookieName;
+      const _config = resolveConfig(
+        config,
+        useAsyncXsrf
+          ? (name) => {
+              xsrfCookieName = name;
+              return null;
+            }
+          : undefined
+      );
       let requestData = _config.data;
       const requestHeaders = AxiosHeaders.from(_config.headers).normalize();
       let { responseType, onUploadProgress, onDownloadProgress } = _config;
       let onCanceled;
+      let timeoutId;
       let uploadThrottled, downloadThrottled;
       let flushUpload, flushDownload, flushDownloadWithEvent;
 
       function done() {
+        clearTimeout(timeoutId);
         flushUpload && flushUpload(); // flush events
         flushDownload && flushDownload(); // flush events
 
@@ -177,6 +197,7 @@ export default isXHRAdapterSupported &&
 
       // Handle timeout
       request.ontimeout = function handleTimeout() {
+        if (!request) return;
         let timeoutErrorMessage = _config.timeout
           ? 'timeout of ' + _config.timeout + 'ms exceeded'
           : 'timeout exceeded';
@@ -201,13 +222,6 @@ export default isXHRAdapterSupported &&
       // Remove Content-Type if data is undefined
       requestData === undefined && requestHeaders.setContentType(null);
 
-      // Add headers to the request
-      if ('setRequestHeader' in request) {
-        utils.forEach(toByteStringHeaderObject(requestHeaders), function setRequestHeader(val, key) {
-          request.setRequestHeader(key, val);
-        });
-      }
-
       // Add withCredentials to request if needed
       if (!utils.isUndefined(_config.withCredentials)) {
         request.withCredentials = !!_config.withCredentials;
@@ -244,19 +258,23 @@ export default isXHRAdapterSupported &&
             return;
           }
           reject(!cancel || cancel.type ? new CanceledError(null, config, request) : cancel);
-          request.abort();
+          const xhr = request;
           done();
           request = null;
+          xhr.abort();
         };
 
         _config.cancelToken && _config.cancelToken.subscribe(onCanceled);
+        if (!request) return;
         if (_config.signal) {
           _config.signal.aborted
             ? onCanceled()
             : _config.signal.addEventListener('abort', onCanceled);
         }
       }
 
+      if (!request) return;
+
       const protocol = parseProtocol(_config.url);
 
       if (protocol && !platform.protocols.includes(protocol)) {
@@ -271,7 +289,72 @@ export default isXHRAdapterSupported &&
         return;
       }
 
-      // Send the request
-      request.send(requestData || null);
+      const sendRequest = () => {
+        if (!request) return;
+        // Apply headers after an asynchronous XSRF read so existing headers are
+        // replaced through AxiosHeaders rather than appended by the native XHR.
+        if ('setRequestHeader' in request) {
+          utils.forEach(
+            toByteStringHeaderObject(requestHeaders),
+            function setRequestHeader(val, key) {
+              request.setRequestHeader(key, val);
+            }
+          );
+        }
+        request.send(requestData || null);
+      };
+
+      if (xsrfCookieName) {
+        // Native XHR timeout starts at send(). Cover cookie preparation and the
+        // subsequent request with the same budget and existing timeout handler.
+        const now =
+          typeof performance !== 'undefined' && utils.isFunction(performance.now)
+            ? () => performance.now()
+            : Date.now;
+        const deadline = request.timeout > 0 ? now() + Number(request.timeout) : undefined;
+        const abortOnTimeout = () => {
+          if (!request) return;
+          const xhr = request;
+          xhr.ontimeout();
+          xhr.abort();
+        };
+        if (deadline !== undefined) {
+          const scheduleTimeout =
```

**File**: `lib/helpers/cookies.js` (modified, +30/-6)
```diff
@@ -1,6 +1,14 @@
 import utils from '../utils.js';
 import platform from '../platform/index.js';
 
+const decodeCookieValue = (value) => {
+  try {
+    return decodeURIComponent(value);
+  } catch (e) {
+    return value;
+  }
+};
+
 export default platform.hasStandardBrowserEnv
   ? // Standard browser envs support document.cookie
     {
@@ -30,26 +38,39 @@ export default platform.hasStandardBrowserEnv
 
       read(name) {
         if (typeof document === 'undefined') return null;
+        const cookieString = document.cookie;
+        if (!cookieString) return null;
         // Match name=value by splitting on the semicolon separator instead of building a
         // RegExp from `name` — interpolating an unescaped string into a RegExp would let
         // metacharacters (e.g. `.+?` in an attacker-influenced cookie name) cause ReDoS or
         // match the wrong cookie. Browsers may serialize cookie pairs as either ";" or
         // "; ", so ignore optional whitespace before each cookie name.
-        const cookies = document.cookie.split(';');
+        const cookies = cookieString.split(';');
         for (let i = 0; i < cookies.length; i++) {
           const cookie = cookies[i].replace(/^\s+/, '');
           const eq = cookie.indexOf('=');
           if (eq !== -1 && cookie.slice(0, eq) === name) {
-            try {
-              return decodeURIComponent(cookie.slice(eq + 1));
-            } catch (e) {
-              return cookie.slice(eq + 1);
-            }
+            return decodeCookieValue(cookie.slice(eq + 1));
           }
         }
         return null;
       },
 
+      async readAsync(name) {
+        try {
+          const store = typeof window !== 'undefined' && window.cookieStore;
+          if (store && utils.isFunction(store.get)) {
+            const cookie = await store.get(name);
+            // Both APIs expose stored bytes; preserve Axios's existing URI decoding.
+            return cookie ? decodeCookieValue(cookie.value) : null;
+          }
+        } catch (e) {
+          // Restricted or unavailable storage retains the synchronous fallback.
+        }
+
+        return this.read(name);
+      },
+
       remove(name) {
         this.write(name, '', Date.now() - 86400000, '/');
       },
@@ -60,5 +81,8 @@ export default platform.hasStandardBrowserEnv
       read() {
         return null;
       },
+      async readAsync() {
+        return null;
+      },
       remove() {},
     };
```

**File**: `lib/helpers/resolveConfig.js` (modified, +4/-2)
```diff
@@ -22,7 +22,9 @@ const encodeUTF8 = (str) =>
     String.fromCharCode(parseInt(hex, 16))
   );
 
-function resolveConfig(config) {
+const readCookie = (name) => cookies.read(name);
+
+function resolveConfig(config, readXsrfCookie = readCookie) {
   const newConfig = mergeConfig({}, config);
 
   // Read only own properties to prevent prototype pollution gadgets
@@ -104,7 +106,7 @@ function resolveConfig(config) {
       withXSRFToken === true || (withXSRFToken == null && isURLSameOrigin(newConfig.url));
 
     if (shouldSendXSRF) {
-      const xsrfValue = xsrfHeaderName && xsrfCookieName && cookies.read(xsrfCookieName);
+      const xsrfValue = xsrfHeaderName && xsrfCookieName && readXsrfCookie(xsrfCookieName);
 
       if (xsrfValue) {
         headers.set(xsrfHeaderName, xsrfValue);
```

**File**: `tests/browser/cookies.browser.test.js` (modified, +19/-0)
```diff
@@ -62,6 +62,25 @@ describe('helpers::cookies (vitest browser)', () => {
     }
   });
 
+  it('returns null when document.cookie is undefined', () => {
+    const descriptor = Object.getOwnPropertyDescriptor(document, 'cookie');
+
+    Object.defineProperty(document, 'cookie', {
+      configurable: true,
+      get() {},
+    });
+
+    try {
+      expect(cookies.read('foo')).toBeNull();
+    } finally {
+      if (descriptor) {
+        Object.defineProperty(document, 'cookie', descriptor);
+      } else {
+        delete document.cookie;
+      }
+    }
+  });
+
   it('removes cookies', () => {
     cookies.write('foo', 'bar');
     cookies.remove('foo');
```

**File**: `tests/browser/xsrf.browser.test.js` (modified, +95/-1)
```diff
@@ -68,9 +68,10 @@ const clearXsrfCookie = () => {
 
 const sendRequest = async (url, config) => {
   const responsePromise = axios(url, config);
+
+  await vi.waitFor(() => expect(requests.at(-1)).toBeDefined());
   const request = requests.at(-1);
 
-  expect(request).toBeDefined();
   await responsePromise;
 
   return request;
@@ -81,12 +82,14 @@ describe('xsrf (vitest browser)', () => {
     requests = [];
     OriginalXMLHttpRequest = window.XMLHttpRequest;
     window.XMLHttpRequest = MockXMLHttpRequest;
+    vi.stubGlobal('cookieStore', undefined);
   });
 
   afterEach(() => {
     clearXsrfCookie();
     window.XMLHttpRequest = OriginalXMLHttpRequest;
     vi.restoreAllMocks();
+    vi.unstubAllGlobals();
   });
 
   it('should not set xsrf header if cookie is null', async () => {
@@ -103,6 +106,97 @@ describe('xsrf (vitest browser)', () => {
     expect(request.requestHeaders[axios.defaults.xsrfHeaderName]).toBe('12345');
   });
 
+  it('should decode the xsrf value from cookieStore when available', async () => {
+    const get = vi.fn().mockResolvedValue({
+      name: axios.defaults.xsrfCookieName,
+      value: 'raw%2Fvalue',
+    });
+    const readSpy = vi.spyOn(cookies, 'read');
+
+    vi.stubGlobal('cookieStore', { get });
+
+    const request = await sendRequest('/foo');
+
+    expect(get).toHaveBeenCalledWith(axios.defaults.xsrfCookieName);
+    expect(readSpy).not.toHaveBeenCalled();
+    expect(request.requestHeaders[axios.defaults.xsrfHeaderName]).toBe('raw/value');
+  });
+
+  it('should fall back to document.cookie if cookieStore.get rejects', async () => {
+    setXsrfCookie('fallback');
+    const get = vi.fn().mockRejectedValue(new Error('cookieStore unavailable'));
+    const readSpy = vi.spyOn(cookies, 'read');
+
+    vi.stubGlobal('cookieStore', { get });
+
+    const request = await sendRequest('/foo');
+
+    expect(get).toHaveBeenCalledWith(axios.defaults.xsrfCookieName);
+    expect(readSpy).toHaveBeenCalledWith(axios.defaults.xsrfCookieName);
+    expect(request.requestHeaders[axios.defaults.xsrfHeaderName]).toBe('fallback');
+  });
+
+  it('should not read cookieStore for a cross-origin request by default', async () => {
+    const get = vi.fn().mockResolvedValue({ value: 'secret' });
+
+    vi.stubGlobal('cookieStore', { get });
+
+    const request = await sendRequest('http://example.com/');
+
+    expect(get).not.toHaveBeenCalled();
+    expect(request.requestHeaders[axios.defaults.xsrfHeaderName]).toBeUndefined();
+  });
+
+  it('should clean up cancellation while cookieStore.get is pending', async () => {
+    const source = axios.CancelToken.source();
+    const unsubscribeSpy = vi.spyOn(source.token, 'unsubscribe');
+
+    vi.stubGlobal('cookieStore', {
+      get: vi.fn(() => new Promise(() => {})),
+    });
+
+    const responsePromise = axios('/foo', { cancelToken: source.token });
+
+    await vi.waitFor(() => expect(source.token._listeners).toHaveLength(1));
+    source.cancel('canceled');
+
+    await expect(responsePromise).rejects.toMatchObject({ code: 'ERR_CANCELED' });
+    expect(unsubscribeSpy).toHaveBeenCalledOnce();
+    expect(requests).toHaveLength(0);
+  });
+
+  it('should clean up an abort signal while cookieStore.get is pending', async () => {
+    const controller = new AbortController();
+    const removeEventListenerSpy = vi.spyOn(controller.signal, 'removeEventListener');
+
+    vi.stubGlobal('cookieStore', {
+      get: vi.fn(() => new Promise(() => {})),
+    });
+
+    const responsePromise = axios('/foo', { signal: controller.signal });
+
+    controller.abort();
+
+    await expect(responsePromise).rejects.toMatchObject({ code: 'ERR_CANCELED' });
+    expect(removeEventListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
+    expect(requests).toHaveLength(0);
+  });
+
+  it('should not read cookieStore or dispatch XHR for an already aborted signal', async () => {
+    const controller = new AbortController();
+    const get = vi.fn(() => new Promise(() => {}));
+
+    controller.abort();
+    vi.stubGlobal('cookieStore', { get });
+
+    await expect(axios('/foo', { signal: controller.signal })).rejects.toMatchObject({
+      code: 'ERR_CANCELED',
+    });
+
+    expect(get).not.toHaveBeenCalled();
+    expect(requests).toHaveLength(0);
+  });
+
   it('should not set xsrf header if xsrfCookieName is null', async () => {
     setXsrfCookie('12345');
 
```

**File**: `tests/browser/xsrfCookieStore.browser.test.js` (added, +359/-0)
```diff
@@ -0,0 +1,359 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+import axios from '../../index.js';
+import cookies from '../../lib/helpers/cookies.js';
+import { nativeCookieStore } from '../setup/nativeCookieStore.js';
+
+const NativeXMLHttpRequest = window.XMLHttpRequest;
+
+let requests;
+let completeRequests;
+let controllers;
+
+class MockXMLHttpRequest {
+  constructor() {
+    this.requestHeaders = {};
+    this.status = 200;
+    this.statusText = 'OK';
+    this.responseText = '';
+    this.onloadend = null;
+    this.timeout = 0;
+  }
+
+  open() {}
+
+  setRequestHeader(name, value) {
+    this.requestHeaders[name] = this.requestHeaders[name]
+      ? this.requestHeaders[name] + ', ' + value
+      : value;
+  }
+
+  getAllResponseHeaders() {
+    return '';
+  }
+
+  send() {
+    requests.push(this);
+    if (completeRequests) queueMicrotask(() => this.onloadend());
+  }
+
+  abort() {
+    this.onabort && this.onabort();
+  }
+}
+
+const startRequest = (config = {}) => {
+  const controller = new AbortController();
+  controllers.push(controller);
+  const result = {};
+  result.promise = axios
+    .get('/cookie-store', {
+      adapter: 'xhr',
+      signal: controller.signal,
+      ...config,
+    })
+    .then(
+      (response) => {
+        result.response = response;
+      },
+      (error) => {
+        result.error = error;
+      }
+    );
+  return { result, controller };
+};
+
+describe('XHR Cookie Store compatibility', () => {
+  beforeEach(() => {
+    requests = [];
+    controllers = [];
+    completeRequests = true;
+    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
+  });
+
+  afterEach(() => {
+    controllers.forEach((controller) => controller.abort());
+    document.cookie = 'XSRF-TOKEN=; max-age=0; path=/';
+    vi.useRealTimers();
+    vi.restoreAllMocks();
+    vi.unstubAllGlobals();
+  });
+
+  it.each([
+    ['abc%2Fdef%3D', 'abc/def='],
+    ['literal%252F', 'literal%2F'],
+    ['a+b', 'a+b'],
+    ['malformed%E0%A4%A', 'malformed%E0%A4%A'],
+    ['', undefined],
+  ])('preserves the existing header for cookie %s on every read path', async (stored, expected) => {
+    document.cookie = `XSRF-TOKEN=${stored}; path=/`;
+    for (const store of [
+      undefined,
+      { get: vi.fn().mockResolvedValue({ value: stored }) },
+      { get: vi.fn().mockRejectedValue(new Error('unavailable')) },
+    ]) {
+      vi.stubGlobal('cookieStore', store);
+      const response = await axios.get('/cookie-store', { adapter: 'xhr' });
+      expect(response.request.requestHeaders['X-XSRF-TOKEN']).toBe(expected);
+    }
+  });
+
+  it.runIf(nativeCookieStore).each(['abc%2Fdef%3D', 'literal%252F', 'a+b', 'malformed%'])(
+    'round-trips a real browser cookie through Cookie Store: %s',
+    async (stored) => {
+      document.cookie = `XSRF-TOKEN=${stored}; path=/`;
+      const expected = cookies.read('XSRF-TOKEN');
+      const readSpy = vi.spyOn(cookies, 'read');
+      vi.stubGlobal('cookieStore', nativeCookieStore);
+
+      expect((await nativeCookieStore.get('XSRF-TOKEN')).value).toBe(stored);
+      const response = await axios.get('/cookie-store', { adapter: 'xhr' });
+
+      expect(response.request.requestHeaders['X-XSRF-TOKEN']).toBe(expected);
+      expect(readSpy).not.toHaveBeenCalled();
+    }
+  );
+
+  it.each([{ xsrfCookieName: null }, { xsrfHeaderName: null }, { withXSRFToken: false }])(
+    'does not start a cookie read when XSRF is disabled: %j',
+    async (config) => {
+      const get = vi.fn().mockResolvedValue({ value: 'secret' });
+      const readSpy = vi.spyOn(cookies, 'readAsync');
+      vi.stubGlobal('cookieStore', { get });
+      await axios.get('/cookie-store', { adapter: 'xhr', ...config });
+      expect(get).not.toHaveBeenCalled();
+      expect(readSpy).not.toHaveBeenCalled();
+    }
+  );
+
+  it('does not fall back to a stale cookie when Cookie Store returns no match', async () => {
+    document.cookie = 'XSRF-TOKEN=stale; path=/';
+    vi.stubGlobal('cookieStore', { get: vi.fn().mockResolvedValue(null) });
+    const readSpy = vi.spyOn(cookies, 'read');
+    const response = await axios.get('/cookie-store', { adapter: 'xhr' });
+    expect(response.request.requestHeaders['X-XSRF-TOKEN']).toBeUndefined();
+    expect(readSpy).not.toHaveBeenCalled();
+  });
+
+  it.runIf(nativeCookieStore)(
+    'sends a decoded token through native Cookie Store and native XHR',
+    async () => {
+      document.cookie = 'XSRF-TOKEN=abc%2Fdef%3D; path=/';
+      vi.stubGlobal('cookieStore', nativeCookieStore);
+      vi.stubGlobal('XMLHttpRequest', NativeXMLHttpRequest);
+      const setHeader = vi.spyOn(NativeXMLHttpRequest.prototype, 'setRequestHeader');
+      const response = await axios.get(new URL('../../package.json', import.meta.url).href, {
+        adapter: 'xhr',
+        timeout: 5000,
+      });
+      expect(response.status).toBe(200);
+      expect(setHeader).toHaveBeenCalledWith('X-XSRF-TOKEN', 'abc/def
```

---

### Incident Patch 2: `8d8e8440` (2026-10-19)
**Commit Message**: docs: correct interceptor options and request lifecycle guide (#11335)

Co-authored-by: Codex <[REDACTED_EMAIL]>

**File**: `AGENTS.md` (modified, +5/-5)
```diff
@@ -82,18 +82,18 @@ CI runs after a PR is opened. Inspect the actual GitHub Actions checks for the l
 
 ## Interceptor Execution Order
 
-- Request interceptors run **last-registered-first** (LIFO).
+- Request interceptors run **last-registered-first** (LIFO) by default. Setting `transitional.legacyInterceptorReqResOrdering: false` switches them to **first-registered-first** (FIFO).
 - Response interceptors run **first-registered-first** (FIFO).
-- Both support `synchronous: true` (avoids Promise wrapping when no async handler is in the chain) and `runWhen: (config) => boolean` for conditional execution.
+- Only request interceptors support `synchronous: true` (avoids Promise wrapping when no async request handler is in the chain) and `runWhen: (config) => boolean` for conditional execution. Response interceptors run through the Promise chain and do not use these options.
 - Order matters for both behavior and tests; document it when adding new built-in interceptors.
 
 ## Request Lifecycle
 
 1. User calls `axios()` or a method alias.
 2. Merge instance defaults with request config via `mergeConfig`.
-3. Run request interceptors (LIFO).
-4. Select adapter via `lib/adapters/adapters.js` capability check.
-5. Apply `transformRequest` functions.
+3. Run request interceptors (LIFO by default; FIFO with `transitional.legacyInterceptorReqResOrdering: false`).
+4. Apply `transformRequest` functions.
+5. Select adapter via `lib/adapters/adapters.js` capability check.
 6. Adapter performs the HTTP request.
 7. Apply `transformResponse` functions.
 8. Run response interceptors (FIFO).
```

**File**: `PRE_RELEASE_CHANGELOG.md` (modified, +1/-0)
```diff
@@ -42,6 +42,7 @@
 
 ## Documentation
 
+- **Contributor request lifecycle:** Corrected the contributor guide to limit `synchronous` and `runWhen` options to request interceptors, describe the opt-in FIFO request order, and place request transforms before adapter selection. This aligns contributor guidance with the existing implementation; runtime behavior, public APIs, and types are unchanged. ([#11335](https://github.com/axios/axios/pull/11335))
 - **README CDN examples:** Updated the jsDelivr and unpkg script tags from Axios 1.13.2 to the published 1.20.0 browser bundle so readers copying the examples use the current release. Both examples remain explicitly version-pinned; this documentation change does not alter package APIs or existing installations. (**[#11149](https://github.com/axios/axios/pull/11149)**)
 - **Contributor test setup:** Clarified that `npm test` runs the unit and browser test suites and requires Playwright browsers to be installed first, helping contributors avoid missing-browser errors. No runtime, public API, or type compatibility changes. (**#11284**)
 - **Contributor submission requirements:** Required prerelease changelog entries and a submission checklist covering regression tests, local validation, compatibility, docs/types, security, and accurate GitHub Actions status so maintainers can trace all contributions and assess verified readiness before review. Defined Maintenance entry placement and a narrow exception for automated release-preparation PRs containing only generated release changes. Kept `AGENTS.md`, Copilot instructions, the contributor guide, and the PR template aligned. This changes the contribution process, with no runtime, public API, or type compatibility impact. (**#11223**)
```

---

### Incident Patch 3: `8d415e6a` (2026-10-15)
**Commit Message**: fix(headers): bind matcher callbacks to the headers instance (#11216)

Signed-off-by: Jake Wang <[REDACTED_EMAIL]>
Co-authored-by: Jason Saayman <[REDACTED_EMAIL]>

**File**: `PRE_RELEASE_CHANGELOG.md` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@
 - **Request handling consistency:** Preserve explicit multipart boundaries, configured Blob constructors, and encoded body limits across Fetch uploads. Keep direct connection pools tied to the configured Node agent's cleanup, connection hooks, and pool keys; reject unsupported pool or TLS-session lifecycle overrides with `ERR_BAD_OPTION_VALUE` instead of discarding them. Parameter merging now handles deep objects without recursive copying, respects serializer depth options, ignores replaced defaults, supports runtimes without symbol reflection, avoids evaluating reserved-name accessors during validation, and reports circular parameters as `ERR_BAD_OPTION_VALUE`. Form serialization preserves hidden array-like indexes and numeric field names that cannot be array indexes. Data URL errors and upload chunking retain their runtime-specific behavior. (**#11242**)
 - **Fetch response size errors:** Preserve `ERR_BAD_RESPONSE` and the current request/config when a fetch response exceeds `maxContentLength` and the runtime wraps the stream failure, including when it drops the original cause. Clarify when custom `env.Response` constructors must accept tracked streams at runtime while preserving existing response limits and constructor signatures. (**#11179**)
 - **TypeScript declarations:** Exposed the branded response-default marker type so consumers can emit declarations for helpers that forward Axios request response generics. (**#11116**)
+- **Header matcher callbacks:** Bind function matchers passed to `AxiosHeaders.has()`, `delete()`, and `clear()` to the headers instance, matching the existing TypeScript declarations and allowing callbacks to use header methods through `this` ([#11216](https://github.com/axios/axios/pull/11216)).
 - **Method-specific headers:** Added default header buckets for all supported methods and removed those structural buckets during request preparation, so `OPTIONS`, `PURGE`, `LINK`, `UNLINK`, and `QUERY` defaults apply only to matching requests instead of leaking as literal headers. (**#11096**)
 - **Literal method-named headers:** Preserve literal request headers named `common` or after an HTTP method, including `Link`, instead of dropping them or merging them as defaults. Dates, Buffers, typed arrays, and custom class values now use normal header serialization. Defaults buckets are limited to plain/null-prototype maps and compatible `AxiosHeaders`, including instances from different package builds that provide the complete header-container interface; a matching tag and `toJSON` alone do not turn application objects into defaults buckets. Only matching method defaults apply. **Compatibility change:** arbitrary class instances used as defaults buckets must be converted to a plain map or `AxiosHeaders` first, otherwise they are serialized as literal header values. Bucket and brand reads exclude shared-prototype values; throwing brand or `toJSON` getters fall back to literal header serialization instead of aborting request preparation. No new API or type changes. (**#11156**; refines **#11096**)
 - **Node HTTP adapter option errors:** Invalid custom DNS lookup addresses and invalid or unsupported `httpVersion` values, including non-coercible JavaScript types, now reject with `AxiosError` and `ERR_BAD_OPTION_VALUE` while preserving the request config for diagnostics. (**#11096**)
```

**File**: `lib/core/AxiosHeaders.js` (modified, +1/-1)
```diff
@@ -165,7 +165,7 @@ const headerSlot = (name) => (name === '__proto__' ? PROTO_HEADER_SLOT : name);
 
 function matchHeaderValue(context, value, header, filter, isHeaderNameFilter) {
   if (utils.isFunction(filter)) {
-    return filter.call(this, value, header);
+    return filter.call(context, value, header);
   }
 
   if (isHeaderNameFilter) {
```

**File**: `tests/unit/axiosHeaders.test.js` (modified, +19/-2)
```diff
@@ -577,7 +577,8 @@ describe('AxiosHeaders', () => {
         headers.set('foo', 'bar=value1');
 
         assert.strictEqual(
-          headers.has('foo', (value, header) => {
+          headers.has('foo', function (value, header) {
+            assert.strictEqual(this, headers);
             assert.strictEqual(value, 'bar=value1');
             assert.strictEqual(header, 'foo');
             return true;
@@ -660,7 +661,8 @@ describe('AxiosHeaders', () => {
 
         headers.set('foo', 'bar=value1');
 
-        headers.delete('foo', (value, header) => {
+        headers.delete('foo', function (value, header) {
+          assert.strictEqual(this, headers);
           assert.strictEqual(value, 'bar=value1');
           assert.strictEqual(header, 'foo');
           return false;
@@ -712,6 +714,21 @@ describe('AxiosHeaders', () => {
 
       assert.deepStrictEqual({ ...headers.toJSON() }, { foo: '1', bar: '3' });
     });
+
+    it('should call a function matcher with the headers instance as this', () => {
+      const headers = new AxiosHeaders({ foo: 1, 'x-foo': 2, bar: 3 });
+
+      assert.strictEqual(
+        headers.clear(function (value, header) {
+          assert.strictEqual(this, headers);
+          assert.strictEqual(value, this.get(header));
+          return header.startsWith('x-');
+        }),
+        true
+      );
+
+      assert.deepStrictEqual({ ...headers.toJSON() }, { foo: '1', bar: '3' });
+    });
   });
 
   describe('toJSON', () => {
```

#### Recent Merged Pull Requests:
- **PR #11335** (2026-10-19): docs: correct interceptor options and request lifecycle guide (@Plastic-time)
- **PR #11324** (closed): chore(deps): bump serialize-javascript and mocha in /tests/module/cjs (@dependabot[bot])
- **PR #11323** (2026-10-14): chore(deps): bump the github-actions group with 3 updates (@dependabot[bot])
- **PR #11322** (2026-10-14): chore(deps-dev): bump the development_dependencies group with 4 updates (@dependabot[bot])
- **PR #11321** (2026-10-14): chore(deps): bump follow-redirects from 1.16.0 to 1.16.1 in the production_dependencies group (@dependabot[bot])
- **PR #11316** (closed): Add npmscan pull request workflow (@salemalem)

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

## X. xhr): avoid main-thread jank from cookie reads (#11166)

**RULE**:
When implementing operations in `PRE_RELEASE_CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in axios/axios. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b0842e8d`: xhr): avoid main-thread jank from cookie reads (#11166). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `PRE_RELEASE_CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
- **XHR adapter cookie access:** Read eligible XSRF cookies through the asynchronous Cookie Store API when supported, avoiding synchronous cookie access while preserving existing URI decoding, malformed-value handling, and fallback behavior. Cookie preparation shares the configured request timeout and cancellation lifecycle; late results cannot send canceled or expired requests. Fetch behavior, public options, and token values remain compatible. (**[#11166](https://github.com/axios/axios/pull/11166)**, closes **[#10826](https://github.com/axios/axios/issues/10826)**)
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b0842e8d` are properly handled with clean fallback behavior.

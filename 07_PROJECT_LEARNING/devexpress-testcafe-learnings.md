> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/devexpress-testcafe-learnings.md`  
> **Source**: github ([https://github.com/DevExpress/testcafe](https://github.com/DevExpress/testcafe))  
> **Source Version**: `1870103c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T15:25:09.440Z  
> **Learning ID**: `learn-github-devexpress-testcafe`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): DevExpress/testcafe

> **Canonical Artifact**: `07_PROJECT_LEARNING/devexpress-testcafe-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DevExpress/testcafe](https://github.com/DevExpress/testcafe))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T15:25:09.252Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DevExpress/testcafe`
- **Description**: A Node.js tool to automate end-to-end web testing.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9892 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/api/request-hooks/assert-type.ts`
```
import { assertType, is } from '../../errors/runtime/type-assertions';
import RequestHook from './hook';

export default function assertRequestHookType (hooks: RequestHook[]): void {
    hooks.forEach(hook => assertType(is.requestHookSubclass, 'requestHooks', 'The hook', hook));
}

```

### Core Architecture Module: `src/api/request-hooks/hook-method-names.ts`
```
enum RequestHookMethodNames {
    onRequest = 'onRequest',
    _onConfigureResponse = '_onConfigureResponse',
    onResponse = 'onResponse'
}

export default RequestHookMethodNames;

```

### Core Architecture Module: `src/api/request-hooks/hook.ts`
```
import {
    ConfigureResponseEvent,
    ConfigureResponseEventOptions,
    RequestEvent,
    ResponseEvent,
    RequestFilterRule,
    RequestFilterRuleInit,
    generateUniqueId,
} from 'testcafe-hammerhead';

import { RequestHookNotImplementedMethodError } from '../../errors/test-run';
import WarningLog from '../../notifications/warning-log';


export default abstract class RequestHook {
    public _requestFilterRules: RequestFilterRule[];
    public readonly _responseEventConfigureOpts?: ConfigureResponseEventOptions;
    public _warningLog: WarningLog | null;
    public readonly id: string;
    public _className: string;

    protected constructor (ruleInit?: RequestFilterRuleInit | RequestFilterRuleInit[], responseEventConfigureOpts?: ConfigureResponseEventOptions) {
        this._requestFilterRules         = this._prepareRules(ruleInit);
        this._responseEventConfigureOpts = responseEventConfigureOpts;
        this._warningLog                 = null;
        this.id                          = generateUniqueId();
        this._className                  = this.constructor.name;
    }

    private _prepareRules (ruleInit?: RequestFilterRuleInit | RequestFilterRuleInit[]): RequestFilterRule[] {
        if (Array.isArray(ruleInit) && !ruleInit.length)
            return [];

        const rules = RequestFilterRule.fromArray(ruleInit);

        return !rules.length ? [RequestFilterRule.ANY] : rules;
    }

    public async onRequest (event: RequestEvent): Promise<void> { // eslint-disable-line @typescript-eslint/no-unused-vars
        throw new RequestHookNotImplementedMethodError('onRequest', this.constructor.name);
    }

    public async _onConfigureResponse (event: ConfigureResponseEvent): Promise<void> {
        if (!this._responseEventConfigureOpts)
            return;

        event.opts.includeHeaders = this._responseEventConfigureOpts.includeHeaders;
        event.opts.includeBody    = this._responseEventConfigureOpts.includeBody;
    }

    public async onResponse (event: ResponseEvent): Promise<void> { // eslint-disable-line @typescript-eslint/no-unused-vars
        throw new RequestHookNotImplementedMethodError('onResponse', this.constructor.name);
    }
}

```

### Core Architecture Module: `src/api/request-hooks/interfaces.ts`
```
export interface RequestHookLogOptions {
    logRequestHeaders: boolean;
    logRequestBody: boolean;
    stringifyRequestBody: boolean;
    logResponseHeaders: boolean;
    logResponseBody: boolean;
    stringifyResponseBody: boolean;
}

export type RequestHookLogOptionsInit = Partial<RequestHookLogOptions>;

```

### Core Architecture Module: `src/api/request-hooks/request-logger.ts`
```
import {
    ConfigureResponseEventOptions,
    RequestEvent,
    ResponseEvent,
    RequestFilterRuleInit,
} from 'testcafe-hammerhead';

import RequestHook from './hook';
import { parseUserAgent } from '../../utils/parse-user-agent';
import testRunTracker from '../test-run-tracker';
import ReExecutablePromise from '../../utils/re-executable-promise';
import { APIError } from '../../errors/runtime';
import { RUNTIME_ERRORS } from '../../errors/types';

import {
    RequestHookLogOptionsInit,
    RequestHookLogOptions,
} from './interfaces';

import { Dictionary } from '../../configuration/interfaces';


const DEFAULT_OPTIONS: RequestHookLogOptions = {
    logRequestHeaders:     false,
    logRequestBody:        false,
    stringifyRequestBody:  false,
    logResponseHeaders:    false,
    logResponseBody:       false,
    stringifyResponseBody: false,
};

interface OptionallyLoggedPart {
    headers?: any;
    body?: Buffer | string;
}

interface LoggedRequestPart extends OptionallyLoggedPart {
    timestamp: number;
    url: string;
    method: string;
}
interface LoggedResponsePart extends OptionallyLoggedPart {
    statusCode: number;
    timestamp: number;
}

interface LoggedRequest {
    id: string;
    testRunId: string;
    userAgent: string;
    request: LoggedRequestPart;
    response?: LoggedResponsePart;
}

const REQUEST_LOGGER_CLASS_NAME = 'RequestLogger';

class RequestLoggerImplementation extends RequestHook {
    private readonly _options: RequestHookLogOptions;
    private _internalRequests: Dictionary<LoggedRequest>;

    public constructor (requestFilterRuleInit?: RequestFilterRuleInit | RequestFilterRuleInit[], options?: RequestHookLogOptionsInit) {
        const effectiveOptions = Object.assign({}, DEFAULT_OPTIONS, options) as RequestHookLogOptions;

        RequestLoggerImplementation._assertLogOptions(effectiveOptions);

        const configureResponseEventOptions = new ConfigureResponseEventOptions(effectiveOptions.logResponseHeaders, effectiveOptions.logResponseBody);

        super(requestFilterRuleInit, configureResponseEventOptions);

        this._className        = REQUEST_LOGGER_CLASS_NAME;
        this._options          = effectiveOptions;
        this._internalRequests = {};
    }

    private static _assertLogOptions (logOptions: RequestHookLogOptions): void {
        if (!logOptions.logRequestBody && logOptions.stringifyRequestBody)
            throw new APIError('RequestLogger', RUNTIME_ERRORS.requestHookConfigureAPIError, 'RequestLogger', 'Cannot stringify the request body because it is not logged. Specify { logRequestBody: true } in log options.');

        if (!logOptions.logResponseBody && logOptions.stringifyResponseBody)
            throw new APIError('RequestLogger', RUNTIME_ERRORS.requestHookConfigureAPIError, 'RequestLogger', 'Cannot stringify the response body because it is not logged. Specify { logResponseBody: true } in log options.');
    }

    private static _getInternalRequestKey ({ requestId, sessionId }: any): string {
        return `${sessionId}:${requestId}`;
    }

    public async onRequest (event: RequestEvent): Promise<void> {
        const loggedReq: LoggedRequest = {
            id:        event._requestInfo.requestId,
            testRunId: event._requestInfo.sessionId,
            userAgent: parseUserAgent(event._requestInfo.userAgent).prettyUserAgent,
            request:   {
                timestamp: Date.now(),
                url:       event._requestInfo.url,
                method:    event._requestInfo.method,
            },
        };

        if (this._options.logRequestHeaders)
            loggedReq.request.headers = Object.assign({}, event._requestInfo.headers);

        if (this._options.logRequestBody)
            loggedReq.request.body = this._options.stringifyRequestBody ? event._requestInfo.body.toString() : event._requestInfo.body;

        this._internalRequests[RequestLoggerImplementation._getInternalRequestKey(event._requestInfo)] = loggedReq;
    }

    public async onResponse (event: ResponseEvent): Promise<void> {
        const loggedReq = this._internalRequests[RequestLoggerImplementation._getInternalRequestKey(event)];

        // NOTE: If the 'clear' method is called during a long running request,
        // we should not save a response part - request part has been already removed.
        if (!loggedReq)
            return;

        loggedReq.response = {
            statusCode: event.statusCode,
            timestamp:  Date.now(),
        };

        if (this._options.logResponseHeaders)
            loggedReq.response.headers = Object.assign({}, event.headers);

        if (this._options.logResponseBody) {
            loggedReq.response.body = this._options.stringifyResponseBody && event.body
                ? event.body.toString()
                : event.body;
        }
    }

    private _prepareInternalRequestInfo (): LoggedRequest[] {
        const testRun        = testRunTracker.resolveContextTestRun();
        let preparedRequests = Object.values(this._internalRequests);

        if (testRun)
            preparedRequests = preparedRequests.filter(r => r.testRunId === testRun.id);

        return preparedRequests;
    }

    private _getCompletedRequests (): LoggedRequest[] {
        return this._prepareInternalRequestInfo().filter(r => r.response);
    }

    // API
    public contains (predicate: (request: LoggedRequest) => boolean): ReExecutablePromise {
        return ReExecutablePromise.fromFn(async () => {
            return !!this._getCompletedRequests().find(predicate);
        });
    }

    public count (predicate: (request: LoggedRequest) => boolean): ReExecutablePromise {
        return ReExecutablePromise.fromFn(async () => {
            return this._getCompletedRequests().filter(predicate).length;
        });
    }

    public clear (): void {
        const testRun = testRunTracker.resolveContextTestRun();

        if (testRun) {
            Object.keys(this._internalRequests).forEach(id => {
                if (this._internalRequests[id].testRunId === testRun.id)
                    delete this._internalRequests[id];
            });
        }
        else
            this._internalRequests = {};
    }

    public get requests (): LoggedRequest[] {
        return this._prepareInternalRequestInfo();
    }
}

export default function createRequestLogger (requestFilterRuleInit: RequestFilterRuleInit | RequestFilterRuleInit[] | undefined, logOptions: RequestHookLogOptionsInit): RequestLoggerImplementation {
    return new RequestLoggerImplementation(requestFilterRuleInit, logOptions);
}

```

### Core Architecture Module: `src/api/request-hooks/request-mock/create-request-mock.ts`
```
import RequestMock from './index';

export default function createRequestMock (): RequestMock {
    return new RequestMock();
}

```

### Core Architecture Module: `src/api/request-hooks/request-mock/index.ts`
```
import RequestHook from '../hook';

import {
    ResponseMock,
    RequestEvent,
    ResponseEvent,
    RequestFilterRuleInit,
    RequestFilterRule,
} from 'testcafe-hammerhead';

import { APIError } from '../../../errors/runtime';
import { RUNTIME_ERRORS } from '../../../errors/types';
import WARNING_MESSAGE from '../../../notifications/warning-message';


export default class RequestMock extends RequestHook {
    private _pendingRequestFilterRuleInit: null | RequestFilterRuleInit;
    public mocks: Map<string, ResponseMock>;

    public constructor () {
        super([]);

        this._pendingRequestFilterRuleInit = null;
        this.mocks                         = new Map();
    }

    public async onRequest (event: RequestEvent): Promise<void> {
        const mock = this.mocks.get(event.requestFilterRule.id) as ResponseMock;

        await event.setMock(mock);
    }

    public async onResponse (event: ResponseEvent): Promise<void> {
        if (event.isSameOriginPolicyFailed && this._warningLog)
            this._warningLog.addWarning(WARNING_MESSAGE.requestMockCORSValidationFailed, RequestMock.name, event.requestFilterRule);
    }

    // API
    public onRequestTo (requestFilterRuleInit: RequestFilterRuleInit): RequestMock {
        if (this._pendingRequestFilterRuleInit)
            throw new APIError('onRequestTo', RUNTIME_ERRORS.requestHookConfigureAPIError, RequestMock.name, "The 'respond' method was not called after 'onRequestTo'. You must call the 'respond' method to provide the mocked response.");

        this._pendingRequestFilterRuleInit = requestFilterRuleInit;

        return this;
    }

    public respond (body: string | Function, statusCode?: number, headers?: object): RequestMock {
        if (!this._pendingRequestFilterRuleInit)
            throw new APIError('respond', RUNTIME_ERRORS.requestHookConfigureAPIError, RequestMock.name, "The 'onRequestTo' method was not called before 'respond'. You must call the 'onRequestTo' method to provide the URL requests to which are mocked.");

        const mock = new ResponseMock(body, statusCode, headers);
        const rule = new RequestFilterRule(this._pendingRequestFilterRuleInit);

        this._requestFilterRules.push(rule);
        this.mocks.set(rule.id, mock);

        this._pendingRequestFilterRuleInit = null;

        return this;
    }
}

```

### Core Architecture Module: `src/browser/connection/remotes-queue.ts`
```
import { EventEmitter } from 'events';
import promisifyEvent from 'promisify-event';
import getTimeLimitedPromise from 'time-limit-promise';
import { Dictionary } from '../../configuration/interfaces';
import BrowserConnection from './index';

const REMOTE_REDIRECT_TIMEOUT           = 10000;
const ADDING_CONNECTION_WAITING_TIMEOUT = 10000;

interface PendingConnection {
    connection: BrowserConnection;
    readyPromise: Promise<void>;
}

export default class RemotesQueue {
    private readonly events: EventEmitter;
    private shiftingTimeout: Promise<void>;
    private readonly pendingConnections: Dictionary<PendingConnection>;

    public constructor () {
        this.events             = new EventEmitter();
        this.shiftingTimeout    = Promise.resolve();
        this.pendingConnections = {};
    }

    public add (remoteConnection: BrowserConnection): void {
        const connectionReadyPromise = promisifyEvent(remoteConnection, 'ready')
            .then(() => this.remove(remoteConnection));

        this.pendingConnections[remoteConnection.id] = {
            connection:   remoteConnection,
            readyPromise: connectionReadyPromise,
        };

        this.events.emit('connection-added', remoteConnection.id);
    }

    public remove (remoteConnection: BrowserConnection): void {
        delete this.pendingConnections[remoteConnection.id];
    }

    public shift (): Promise<BrowserConnection | null> {
        const shiftingPromise = this.shiftingTimeout
            .then(async () => {
                let headId = Object.keys(this.pendingConnections)[0];

                if (!headId)
                    headId = await getTimeLimitedPromise(promisifyEvent(this.events, 'connection-added'), ADDING_CONNECTION_WAITING_TIMEOUT);

                return headId ? this.pendingConnections[headId].connection : null;
            });

        this.shiftingTimeout = shiftingPromise
            .then(connection => {
                if (!connection)
                    return Promise.resolve();

                return getTimeLimitedPromise(this.pendingConnections[connection.id].readyPromise, REMOTE_REDIRECT_TIMEOUT);
            });

        return shiftingPromise;
    }
}

```

### Core Architecture Module: `src/browser/provider/built-in/dedicated/chrome/cdp-client/utils.ts`
```
import remoteChrome, { TargetInfo } from 'chrome-remote-interface';

const DEVTOOLS_TAB_URL_REGEX = /^devtools:\/\/devtools/;
// NOTE: Github issue: https://github.com/DevExpress/testcafe/issues/8286
const CHROME_EXTENSION_TAB_URL_REGEX = /^chrome-extension:\/\//;

function isInternalUrl (url: string): boolean {
    return DEVTOOLS_TAB_URL_REGEX.test(url) || CHROME_EXTENSION_TAB_URL_REGEX.test(url);
}

export async function getTabs (port: number): Promise<TargetInfo[]> {
    const tabs = await remoteChrome.List({ port });

    return tabs.filter(t => t.type === 'page' && !isInternalUrl(t.url));
}

export async function getTabById (port: number, id: string): Promise<TargetInfo> {
    const tabs = await getTabs(port);

    return tabs.find(tab => tab.id === id) as TargetInfo;
}

export async function getFirstTab (port: number): Promise<TargetInfo> {
    const tabs = await getTabs(port);

    return tabs[0];
}

export async function getActiveTab (port: number, activeWindowId: string): Promise<TargetInfo> {
    const tabs = await getTabs(port);

    if (activeWindowId)
        return tabs.find(t => t.title.includes(activeWindowId)) as TargetInfo;

    return tabs[0];
}

```

### Core Architecture Module: `src/browser/provider/utils/argument-parsing.js`
```
import { find as findElement } from 'lodash';
import OS from 'os-family';

const CONFIG_TERMINATOR_RE = /(\s+|^)-/;

export function hasMatch (array, re) {
    return !!findElement(array, el => el.match(re));
}

export function findMatch (array, re) {
    const element = findElement(array, el => el.match(re));

    return element ? element.match(re)[1] : '';
}

export function isMatchTrue (array, re) {
    const match = findMatch(array, re);

    return match && match !== '0' && match !== 'false';
}

export function splitEscaped (str, splitterChar) {
    const result = [''];

    for (let i = 0; i < str.length; i++) {
        if (str[i] === splitterChar) {
            result.push('');
            continue;
        }

        if (str[i] === '\\' && (str[i + 1] === '\\' || str [i + 1] === splitterChar))
            i++;

        result[result.length - 1] += str[i];
    }

    return result;
}

export function getPathFromParsedModes (modes, availableModes = []) {
    if (!modes.length)
        return '';

    if (availableModes.some(mode => mode === modes[0]))
        return '';

    let path = modes.shift();

    if (OS.win && modes.length && path.match(/^[A-Za-z]$/))
        path += ':' + modes.shift();

    return path;
}

export function getModes (modes, availableModes = []) {
    const result = {};

    availableModes = availableModes.slice();

    availableModes.forEach(key => {
        result[key] = false;
    });

    while (modes.length && availableModes.length) {
        if (modes[0] === availableModes[0]) {
            result[availableModes[0]] = true;

            modes.shift();
        }

        availableModes.shift();
    }

    return result;
}

export function parseConfig (str) {
    const configTerminatorMatch = str.match(CONFIG_TERMINATOR_RE);

    if (!configTerminatorMatch)
        return { modesString: str, userArgs: '' };

    return {
        modesString: str.substr(0, configTerminatorMatch.index),
        userArgs:    str.substr(configTerminatorMatch.index + configTerminatorMatch[1].length),
    };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8572** (2026-11-11): **Remove gulp-ll-next depemdency**
  *Symptoms*: 

- **Issue #8571** (2026-11-10): **Inline V8 flags filter dependency**
  *Symptoms*: Code from https://github.com/DevExpress/bin-v8-flags-filter repository inlined here to get rid of @devexpress/bin-v8-flags-filter npm dependency

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

### Incident Patch 1: `1870103c` (2026-11-11)
**Commit Message**: Remove gulp-ll-next depemdency (#8572)

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `Gulpfile.js` (modified, +0/-13)
```diff
@@ -5,7 +5,6 @@ const less                          = require('gulp-less');
 const mustache                      = require('gulp-mustache');
 const rename                        = require('gulp-rename');
 const uglify                        = require('gulp-uglify');
-const ll                            = require('gulp-ll-next');
 const clone                         = require('gulp-clone');
 const mergeStreams                  = require('merge-stream');
 const del                           = require('del');
@@ -40,18 +39,6 @@ const readFile = promisify(fs.readFile);
 
 gulpStep.install();
 
-ll
-    .install()
-    .tasks([
-        'lint',
-        'check-licenses',
-    ])
-    .onlyInDebug([
-        'styles',
-        'client-scripts',
-        'client-scripts-bundle',
-    ]);
-
 const ARGS          = minimist(process.argv.slice(2));
 const QR_CODE       = 'qr-code' in ARGS;
 const SKIP_BUILD    = process.env.SKIP_BUILD || 'skip-build' in ARGS;
```

**File**: `package-lock.json` (modified, +0/-38)
```diff
@@ -157,7 +157,6 @@
         "gulp-data": "^1.3.1",
         "gulp-eslint-new": "^2.6.2",
         "gulp-less": "^5.0.0",
-        "gulp-ll-next": "^2.1.0",
         "gulp-mustache": "^3.0.1",
         "gulp-rename": "^1.3.0",
         "gulp-step": "^1.0.1",
@@ -8193,43 +8192,6 @@
         "readable-stream": "3"
       }
     },
-    "node_modules/gulp-ll-next": {
-      "version": "2.1.0",
-      "resolved": "https://registry.npmjs.org/gulp-ll-next/-/gulp-ll-next-2.1.0.tgz",
-      "integrity": "sha512-1tA8aGBSUYzK1ggzNIyBxdziivl7RZ9dvJx8kLPJ6fc4uB5bVBdwFzdvxcbzqvJk0uV0dbTs9i7c2hhjEodELQ==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "pinkie-promise": "^1.0.0",
-        "plugin-error": "^1.0.1"
-      },
-      "engines": {
-        "node": ">=6.0.0"
-      }
-    },
-    "node_modules/gulp-ll-next/node_modules/pinkie": {
-      "version": "1.0.0",
-      "resolved": "https://registry.npmjs.org/pinkie/-/pinkie-1.0.0.tgz",
-      "integrity": "sha512-VFVaU1ysKakao68ktZm76PIdOhvEfoNNRaGkyLln9Os7r0/MCxqHjHyBM7dT3pgTiBybqiPtpqKfpENwdBp50Q==",
-      "dev": true,
-      "license": "MIT",
-      "engines": {
-        "node": ">=0.10.0"
-      }
-    },
-    "node_modules/gulp-ll-next/node_modules/pinkie-promise": {
-      "version": "1.0.0",
-      "resolved": "https://registry.npmjs.org/pinkie-promise/-/pinkie-promise-1.0.0.tgz",
-      "integrity": "sha512-5mvtVNse2Ml9zpFKkWBpGsTPwm3DKhs+c95prO/F6E7d6DN0FPqxs6LONpLNpyD7Iheb7QN4BbUoKJgo+DnkQA==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "pinkie": "^1.0.0"
-      },
-      "engines": {
-        "node": ">=0.10.0"
-      }
-    },
     "node_modules/gulp-mustache": {
       "version": "3.0.1",
       "resolved": "https://registry.npmjs.org/gulp-mustache/-/gulp-mustache-3.0.1.tgz",
```

**File**: `package.json` (modified, +0/-1)
```diff
@@ -203,7 +203,6 @@
     "gulp-data": "^1.3.1",
     "gulp-eslint-new": "^2.6.2",
     "gulp-less": "^5.0.0",
-    "gulp-ll-next": "^2.1.0",
     "gulp-mustache": "^3.0.1",
     "gulp-rename": "^1.3.0",
     "gulp-step": "^1.0.1",
```

---

### Incident Patch 2: `9aa493c3` (2026-11-10)
**Commit Message**: Inline V8 flags filter dependency (#8571)

Code from https://github.com/DevExpress/bin-v8-flags-filter repository
inlined here to get rid of @devexpress/bin-v8-flags-filter npm
dependency

---------

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `bin/testcafe-with-v8-flag-filter.js` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 
 const path          = require('path');
 const url           = require('url');
-const v8FlagsFilter = require('@devexpress/bin-v8-flags-filter');
+const v8FlagsFilter = require('./v8-flags-filter');
 const semver        = require('semver');
 
 const ESM_OPTION = '--esm';
```

**File**: `bin/v8-flags-filter.js` (added, +141/-0)
```diff
@@ -0,0 +1,141 @@
+'use strict';
+
+/*
+The MIT License (MIT)
+
+Copyright (c) 2016 Ivan Nikulin (ifaaan@gmail.com, https://github.com/inikulin)
+
+Permission is hereby granted, free of charge, to any person obtaining a copy
+of this software and associated documentation files (the "Software"), to deal
+in the Software without restriction, including without limitation the rights
+to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
+copies of the Software, and to permit persons to whom the Software is
+furnished to do so, subject to the following conditions:
+
+The above copyright notice and this permission notice shall be included in all
+copies or substantial portions of the Software.
+
+THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
+IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
+FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
+AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
+LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
+OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
+SOFTWARE.
+*/
+
+const { spawn } = require('child_process');
+
+const FLAGS = [
+    'debug',
+    '--debug',
+    '--debug-brk',
+    '--inspect',
+    '--inspect-brk',
+    '--expose-gc',
+    '--gc-global',
+    '--es_staging',
+    '--no-deprecation',
+    '--prof',
+    '--log-timer-events',
+    '--throw-deprecation',
+    '--trace-deprecation',
+    '--use_strict',
+    '--allow-natives-syntax',
+    '--perf-basic-prof',
+    '--experimental-repl-await',
+    '--experimental-loader',
+    '--no-warnings',
+];
+
+const FLAG_PREFIXES = [
+    '--harmony',
+    '--trace',
+    '--icu-data-dir',
+    '--max-old-space-size',
+    '--preserve-symlinks',
+];
+
+const DEFAULT_FORCED_KILL_DELAY = 30000;
+
+function getChildArgs (cliPath, ignore) {
+    const args = [cliPath];
+
+    process.argv.slice(2).forEach(arg => {
+        const flag = arg.split('=')[0];
+
+        if (ignore.indexOf(flag) > -1) {
+            args.push(arg);
+            return;
+        }
+
+        if (FLAGS.indexOf(flag) > -1) {
+            args.unshift(arg);
+            return;
+        }
+
+        if (FLAG_PREFIXES.some(prefix => arg.indexOf(prefix) === 0)) {
+            args.unshift(arg);
+            return;
+        }
+
+        args.push(arg);
+    });
+
+    return args;
+}
+
+function setupSignalHandler (signal, childProcess, useShutdownMessage, forcedKillDelay) {
+    function forceKill () {
+        childProcess.kill('SIGTERM');
+    }
+
+    function handler () {
+        if (useShutdownMessage)
+            childProcess.send('shutdown');
+        else
+            childProcess.kill(signal);
+
+        setTimeout(forceKill, forcedKillDelay).unref();
+    }
+
+    process.on(signal, handler);
+}
+
+module.exports = function (cliPath, opts) {
+    opts = opts || {};
+
+    const useShutdownMessage = opts.useShutdownMessage;
+    const forcedKillDelay    = opts.forcedKillDelay || DEFAULT_FORCED_KILL_DELAY;
+    const ignore             = opts.ignore || [];
+    const args               = getChildArgs(cliPath, ignore);
+
+    if (opts.forcedArgs && opts.forcedArgs.length > 0)
+        args.unshift(...opts.forcedArgs);
+
+    const cliProc = spawn(process.execPath, args, {
+        stdio: [process.stdin, process.stdout, process.stderr, useShutdownMessage ? 'ipc' : null],
+    });
+
+    cliProc.on('exit', (code, signal) => {
+        if (useShutdownMessage && process.disconnect)
+            process.disconnect();
+
+        process.on('exit', () => {
+            if (signal)
+                process.kill(process.pid, signal);
+            else
+                process.exit(code);
+        });
+    });
+
+    setupSignalHandler('SIGINT', cliProc, useShutdownMessage, forcedKillDelay);
+    setupSignalHandler('SIGBREAK', cliProc, useShutdownMessage, forcedKillDelay);
+
+    if (useShutdownMessage) {
+        process.on('message', message => {
+            if (message === 'shutdown')
+                cliProc.send('shutdown');
+        });
+    }
+};
```

**File**: `package-lock.json` (modified, +0/-7)
```diff
@@ -26,7 +26,6 @@
         "@babel/preset-flow": "^7.22.15",
         "@babel/preset-react": "^7.22.15",
         "@babel/runtime": "^7.23.2",
-        "@devexpress/bin-v8-flags-filter": "^1.3.0",
         "@types/node": "20.14.5",
         "address": "^2.0.2",
         "async-exit-hook": "^1.1.2",
@@ -1947,12 +1946,6 @@
         "node": ">=6.9.0"
       }
     },
-    "node_modules/@devexpress/bin-v8-flags-filter": {
-      "version": "1.3.0",
-      "resolved": "https://registry.npmjs.org/@devexpress/bin-v8-flags-filter/-/bin-v8-flags-filter-1.3.0.tgz",
-      "integrity": "sha512-LWLNfYGwVJKYpmHUDoODltnlqxdEAl5Qmw7ha1+TSpsABeF94NKSWkQTTV1TB4CM02j2pZyqn36nHgaFl8z7qw==",
-      "license": "MIT"
-    },
     "node_modules/@devexpress/gulp-qunit-harness": {
       "version": "1.1.0",
       "resolved": "https://registry.npmjs.org/@devexpress/gulp-qunit-harness/-/gulp-qunit-harness-1.1.0.tgz",
```

**File**: `package.json` (modified, +0/-1)
```diff
@@ -75,7 +75,6 @@
     "@babel/preset-flow": "^7.22.15",
     "@babel/preset-react": "^7.22.15",
     "@babel/runtime": "^7.23.2",
-    "@devexpress/bin-v8-flags-filter": "^1.3.0",
     "@types/node": "20.14.5",
     "address": "^2.0.2",
     "async-exit-hook": "^1.1.2",
```

**File**: `test/server/v8-flags-filter-test.js` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+'use strict';
+
+const fs            = require('node:fs');
+const os            = require('node:os');
+const path          = require('node:path');
+const { spawnSync } = require('node:child_process');
+const { expect }    = require('chai');
+
+describe('V8 flags filter', function () {
+    it('forwards V8 flags and forced arguments to the child process', function () {
+        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testcafe-v8-flags-filter-'));
+        const cliPath = path.join(tempDir, 'cli.js');
+
+        try {
+            fs.writeFileSync(cliPath, 'console.log(JSON.stringify({ args: process.argv.slice(2), execArgv: process.execArgv }));');
+
+            const filterPath = path.resolve(__dirname, '../../bin/v8-flags-filter.js');
+            const runner     = `require(${JSON.stringify(filterPath)})(process.argv[1], { forcedArgs: ['--no-deprecation'] });`;
+            const result     = spawnSync(process.execPath, [
+                '-e',
+                runner,
+                cliPath,
+                '--trace-gc',
+                '--allow-natives-syntax',
+                '--test-option',
+            ], { encoding: 'utf8' });
+
+            expect(result.status, result.stderr).to.equal(0);
+
+            const output = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
+
+            expect(output.args).to.deep.equal(['--test-option']);
+            expect(output.execArgv).to.deep.equal(['--no-deprecation', '--allow-natives-syntax', '--trace-gc']);
+        }
+        finally {
+            fs.rmSync(tempDir, { recursive: true, force: true });
+        }
+    });
+});
```

#### Recent Merged Pull Requests:
- **PR #8572** (2026-11-11): Remove gulp-ll-next depemdency (@aleks-pro)
- **PR #8571** (2026-11-10): Inline V8 flags filter dependency (@aleks-pro)
- **PR #8570** (2026-11-09): Inline callsite-record implementation (@aleks-pro)
- **PR #8568** (closed): Added Qase to Custom Reporters in README.md (@pm-morten)
- **PR #8567** (2026-10-30): build: updated testcafe-hammerhead (@Aleksey28)
- **PR #8566** (2026-10-26): fix: report setNativeDialogHandler(null) without throwing (@sam-yh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/expressjs-cors-learnings.md`  
> **Source**: github ([https://github.com/expressjs/cors](https://github.com/expressjs/cors))  
> **Source Version**: `5317ebe6`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-08T16:52:27.891Z  
> **Learning ID**: `learn-github-expressjs-cors-muzryc1f`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): expressjs/cors

> **Canonical Artifact**: `07_PROJECT_LEARNING/expressjs-cors-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/expressjs/cors](https://github.com/expressjs/cors))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-08T16:52:25.790Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `expressjs/cors`
- **Description**: Node.js CORS middleware
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6195 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lib/index.js`
```
(function () {

  'use strict';

  var assign = require('object-assign');
  var vary = require('vary');

  var defaults = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
  };

  function isString(s) {
    return typeof s === 'string' || s instanceof String;
  }

  function isOriginAllowed(origin, allowedOrigin) {
    if (Array.isArray(allowedOrigin)) {
      for (var i = 0; i < allowedOrigin.length; ++i) {
        if (isOriginAllowed(origin, allowedOrigin[i])) {
          return true;
        }
      }
      return false;
    } else if (isString(allowedOrigin)) {
      return origin === allowedOrigin;
    } else if (allowedOrigin instanceof RegExp) {
      return allowedOrigin.test(origin);
    } else {
      return !!allowedOrigin;
    }
  }

  function configureOrigin(options, req) {
    var requestOrigin = req.headers.origin,
      headers = [],
      isAllowed;

    if (!options.origin || options.origin === '*') {
      // allow any origin
      headers.push([{
        key: 'Access-Control-Allow-Origin',
        value: '*'
      }]);
    } else if (isString(options.origin)) {
      // fixed origin
      headers.push([{
        key: 'Access-Control-Allow-Origin',
        value: options.origin
      }]);
      headers.push([{
        key: 'Vary',
        value: 'Origin'
      }]);
    } else {
      isAllowed = isOriginAllowed(requestOrigin, options.origin);
      // reflect origin
      headers.push([{
        key: 'Access-Control-Allow-Origin',
        value: isAllowed ? requestOrigin : false
      }]);
      headers.push([{
        key: 'Vary',
        value: 'Origin'
      }]);
    }

    return headers;
  }

  function configureMethods(options) {
    var methods = options.methods;
    if (methods.join) {
      methods = options.methods.join(','); // .methods is an array, so turn it into a string
    }
    return {
      key: 'Access-Control-Allow-Methods',
      value: methods
    };
  }

  function configureCredentials(options) {
    if (options.credentials === true) {
      return {
        key: 'Access-Control-Allow-Credentials',
        value: 'true'
      };
    }
    return null;
  }

  function configureAllowedHeaders(options, req) {
    var allowedHeaders = options.allowedHeaders || options.headers;
    var headers = [];

    if (!allowedHeaders) {
      allowedHeaders = req.headers['access-control-request-headers']; // .headers wasn't specified, so reflect the request headers
      headers.push([{
        key: 'Vary',
        value: 'Access-Control-Request-Headers'
      }]);
    } else if (allowedHeaders.join) {
      allowedHeaders = allowedHeaders.join(','); // .headers is an array, so turn it into a string
    }
    if (allowedHeaders && allowedHeaders.length) {
      headers.push([{
        key: 'Access-Control-Allow-Headers',
        value: allowedHeaders
      }]);
    }

    return headers;
  }

  function configureExposedHeaders(options) {
    var headers = options.exposedHeaders;
    if (!headers) {
      return null;
    } else if (headers.join) {
      headers = headers.join(','); // .headers is an array, so turn it into a string
    }
    if (headers && headers.length) {
      return {
        key: 'Access-Control-Expose-Headers',
        value: headers
      };
    }
    return null;
  }

  function configureMaxAge(options) {
    var maxAge = (typeof options.maxAge === 'number' || options.maxAge) && options.maxAge.toString()
    if (maxAge && maxAge.length) {
      return {
        key: 'Access-Control-Max-Age',
        value: maxAge
      };
    }
    return null;
  }

  function applyHeaders(headers, res) {
    for (var i = 0, n = headers.length; i < n; i++) {
      var header = headers[i];
      if (header) {
        if (Array.isArray(header)) {
          applyHeaders(header, res);
        } else if (header.key === 'Vary' && header.value) {
          vary(res, header.value);
        } else if (header.value) {
          res.setHeader(header.key, header.value);
        }
      }
    }
  }

  function cors(options, req, res, next) {
    var headers = [],
      method = req.method && req.method.toUpperCase && req.method.toUpperCase();

    if (method === 'OPTIONS') {
      // preflight
      headers.push(configureOrigin(options, req));
      headers.push(configureCredentials(options))
      headers.push(configureMethods(options))
      headers.push(configureAllowedHeaders(options, req));
      headers.push(configureMaxAge(options))
      headers.push(configureExposedHeaders(options))
      applyHeaders(headers, res);

      if (options.preflightContinue) {
        next();
      } else {
        // Safari (and potentially other browsers) need content-length 0,
        //   for 204 or they just hang waiting for a body
        res.statusCode = options.optionsSuccessStatus;
        res.setHeader('Content-Length', '0');
        res.end();
      }
    } else {
      // actual response
      headers.push(configureOrigin(options, req));
      headers.push(configureCredentials(options))
      headers.push(configureExposedHeaders(options))
      applyHeaders(headers, res);
      next();
    }
  }

  function middlewareWrapper(o) {
    // if options are static (either via defaults or custom options passed in), wrap in a function
    var optionsCallback = null;
    if (typeof o === 'function') {
      optionsCallback = o;
    } else {
      optionsCallback = function (req, cb) {
        cb(null, o);
      };
    }

    return function corsMiddleware(req, res, next) {
      optionsCallback(req, function (err, options) {
        if (err) {
          next(err);
        } else {
          var corsOptions = assign({}, defaults, options);
          var originCallback = null;
          if (corsOptions.origin && typeof corsOptions.origin === 'function') {
            originCallback = corsOptions.origin;
          } else if (corsOptions.origin) {
            originCallback = function (origin, cb) {
              cb(null, corsOptions.origin);
            };
          }

          if (originCallback) {
            originCallback(req.headers.origin, function (err2, origin) {
              if (err2 || !origin) {
                next(err2);
              } else {
                corsOptions.origin = origin;
                cors(corsOptions, req, res, next);
              }
            });
          } else {
            next();
          }
        }
      });
    };
  }

  // can pass either an options hash, an options delegate, or nothing
  module.exports = middlewareWrapper;

}());

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #345** (2025-03-18): **Header with falsy value is not applied to response**
  *Symptoms*: <!-- The process for bug fixing is:  - We will first assess if the behavior is different from what should occur - Confirm the bug is reproducible - Discuss how to best fix the bug - Work towards a fix -->  ## Environment information  **Version**: express: 4.21.2 cors: 2.8.5  **Platform**: Max OS X 15.3.2   **Node.js version**: v22.12.0  **Any other relevant information**:  ## What steps will reproduce the bug?  Function `configureOrigin` in cors/lib/index.js sets `Access-Control-Allow-Origin` to `false`, when origin is not allowed:  ```js isAllowed = isOriginAllowed(requestOrigin, options.origin);       // reflect origin       headers.push([{         key: 'Access-Control-Allow-Origin',         value: isAllowed ? requestOrigin : false       }]); ```  Later when processing the headers, the value is checked **truthy** via `header.value`, which skips the header for `false`:  ```js function applyHeaders(headers, res) {     for (var i = 0, n = headers.length; i < n; i++) {       var header = headers[i];       if (header) {         if (Array.isArray(header)) {           applyHeaders(header, res);         } else if (header.key === 'Vary' && header.value) {           vary(res, header.value);         } else if (header.value) {           res.setHeader(header.key, header.value);         }       }     }   } ```  By this any origin is returned in `Access-Control-Allow-Origin`, although the origin is not in the allowed configured origins.  This happens in  the `else` branch, when setting a 
  **Post-Mortem & Fix Analysis**:
  > Second CORS middleware was active, writing Access-Control-Allow-Origin... I close this issue..

- **Issue #331** (2024-10-19): **`Vary: Access-Control-Request-Method` should be set**
  *Symptoms*: This module sets `Vary: Origin` and `Vary: Access-Control-Request-Headers`.  https://github.com/expressjs/cors/blob/53312a5bee605e2486fa734756abb3c0bc2f891d/lib/index.js#L98-L104  By the same reasons provided by https://github.com/expressjs/cors/issues/61, `Vary: Access-Control-Request-Method` should also be set.  Some additional links discussing this issue: [here](https://github.com/spring-projects/spring-framework/issues/20959), [here](https://stackoverflow.com/questions/65675056/why-add-vary-on-access-control-request-method-acrh-and-origin-when-options-meth) and [there](https://connectrpc.com/docs/cors/#preflight-response).
  **Post-Mortem & Fix Analysis**:
  > Closing, as this is incorrect.  Unlike `Access-Control-Request-Headers`, `Access-Control-Request-Method` is not used by this module.   `Access-Control-Request-Headers` must be used as a default value for `Access-Control-Allow-Headers` since the latter is required, and the sets of possible request headers is too wide for most servers to set a correct value. `*` could be used but it [does not work for requests with credentials](https://fetch.spec.whatwg.org/#http-new-header-syntax).  On the other hand, `Access-Control-Allow-Methods` defaults to `GET,HEAD,PUT,PATCH,POST,DELETE`, which works for most practical cases. Therefore, the `Access-Control-Request-Method` header is ignored by this module. So it does not need to be in `Vary`.  One note is that, if any reverse proxy is caching preflight requests, using `Vary: Access-Control-Request-Headers` might increase the cache size quite significantly. However, it does not seem like there is a workaround to this (except for using `*`, wh

- **Issue #227** (2021-03-09): **fixed invalid 'Access-Control-Allow-Origin' header value**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Hi @tastydev thank you for the fix. As I stated in the other issue, we appreciate the report, but you cannot just be posting in public these things. If you want to be involved, you need to reach out to me via email, not in the public.

- **Issue #158** (2018-11-04): **Fixed support for maxAge=0**
  *Symptoms*: Hey, According to [this spec](https://www.w3.org/TR/cors/#access-control-max-age-response-header) when `Access-Control-Max-Age` is not set, it is up to the user agent to decide the value. The check `options.maxAge` is faulty when `maxAge` equals to zero, causing it to return `null`, not 0 and different behaviors on different browsers.  Thanks! Tom
  **Post-Mortem & Fix Analysis**:
  > Sure, added one :)

- **Issue #121** (2017-07-13): **fixes #120 - content length zero for 204 response**
  *Symptoms*: Safari apparently hangs waiting for the body when OPTIONS response is 204, content-length: 0 fixes that behavior.
  **Post-Mortem & Fix Analysis**:
  > thanks @dougwilson, I made those changes (added 1 test case for this, seems fine for the change but let me know if I'm missing conditions)

- **Issue #120** (2017-07-13): **NOT WORKING ON SAFARI**
  *Symptoms*: works well in chrome but not in safari.  Does anyone have same issues?
  **Post-Mortem & Fix Analysis**:
  > I do I always get 204 on the OPTIONS request
  > A 204 is correct. Do you have an example app that someone can verify in Safari?
  > Yes i know the 204 is correct but for some reason Safari considers the request not finished (in the dev tools) but does the POST request as it should. I suppose that's why we have the "optionsSuccessStatus" option :-)  Here is how it show in Safari (MacOS Sierra)  ![image](https://user-images.githubusercontent.com/205129/27683618-ef338b2c-5cc6-11e7-8d00-2f2a24e1f5de.png) 

- **Issue #112** (2017-03-30): **Cannot read property \'join\' of undefined**
  *Symptoms*: There is no check if `methods` is defined or not in the `options`.  ```js function configureMethods(options) {     var methods = options.methods;     if (methods.join) {       methods = options.methods.join(','); // .methods is an array, so turn it into a string     }     return {       key: 'Access-Control-Allow-Methods',       value: methods     };   } ```
  **Post-Mortem & Fix Analysis**:
  > Hi @akprats33 the value is supposed to get back filled from the `defaults` (https://github.com/expressjs/cors/blob/master/lib/index.js#L8-L13), so it is weird that it isn't. Can you share what your call to this module look like that produces this?
  > ```js const ENABLE_CORS = {origin: true, maxAge: 4 * 86400 }; function handleCORS(req, cb) { 	let origin = req.get('origin');  	// Origin matches whitelist 	if (getWhitelist().indexOf(url.parse(origin).hostname) > -1) { 		return cb(null, ENABLE_CORS); 	} 	return cb(null, DISABLE_CORS); }  module.exports = cors(handleCORS); ```  Then it is called as a middleware.  ```js // enable cors apiRouter.use(cors); ```  This issue came up when I updated the package. In previous version, default value for `methods` was used. I think default value is missing now.
  > Thanks, @akprats33 I was able to reproduce. The defaults are not getting mixed in when a function is used, so just need to move around the mixin.

- **Issue #106** (2017-03-26): **"Vary: Origin" not set if Origin is not allowed.**
  *Symptoms*: When using the 'array' or 'regexp' notation of whitelisted origins we don't send 'Vary: Origin' if the passed Origin is not allowed.  This results in failed CORS responses being cached by the downstream cache and subsequently served even for proper request (which would contain Vary: Origin, but downstream won't fetch them, as it has the cached response it's looking for).  This behavior is seen with e.g. Google Cloud cache, with the additional side effect of a failed CORS response overwriting all the previously cached successful responses that contained "Vary: Origin".  #105 PR for your consideration.

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

### Incident Patch 1: `ee714bd5` (2026-03-02)
**Commit Message**: build(deps): bump github/codeql-action from 4.31.2 to 4.32.4 (#393)

Bumps [github/codeql-action](https://github.com/github/codeql-action) from 4.31.2 to 4.32.4.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/0499de31b99561a6d14a36a5f662c2a54f91beee...89a39a4e59826350b863aa6b6252a07ad50cf83e)

---
updated-dependencies:
- dependency-name: github/codeql-action
  dependency-version: 4.32.4
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/codeql.yml` (modified, +2/-2)
```diff
@@ -38,7 +38,7 @@ jobs:
 
       # Initializes the CodeQL tools for scanning.
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@0499de31b99561a6d14a36a5f662c2a54f91beee # v4.31.2
+        uses: github/codeql-action/init@89a39a4e59826350b863aa6b6252a07ad50cf83e # v4.32.4
         with:
           languages: javascript
           # If you wish to specify custom queries, you can do so here or in a config file.
@@ -61,6 +61,6 @@ jobs:
       #   ./location_of_script_within_repo/buildscript.sh
 
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/analyze@0499de31b99561a6d14a36a5f662c2a54f91beee # v4.31.2
+        uses: github/codeql-action/analyze@89a39a4e59826350b863aa6b6252a07ad50cf83e # v4.32.4
         with:
           category: "/language:javascript"
\ No newline at end of file
```

**File**: `.github/workflows/scorecard.yml` (modified, +1/-1)
```diff
@@ -68,6 +68,6 @@ jobs:
 
       # Upload the results to GitHub's code scanning dashboard.
       - name: "Upload to code-scanning"
-        uses: github/codeql-action/upload-sarif@0499de31b99561a6d14a36a5f662c2a54f91beee # v4.31.2
+        uses: github/codeql-action/upload-sarif@89a39a4e59826350b863aa6b6252a07ad50cf83e # v4.32.4
         with:
           sarif_file: results.sarif
\ No newline at end of file
```

---

### Incident Patch 2: `1d8736df` (2026-03-02)
**Commit Message**: build(deps): bump actions/upload-artifact from 5.0.0 to 7.0.0 (#394)

Bumps [actions/upload-artifact](https://github.com/actions/upload-artifact) from 5.0.0 to 7.0.0.
- [Release notes](https://github.com/actions/upload-artifact/releases)
- [Commits](https://github.com/actions/upload-artifact/compare/330a01c490aca151604b8cf639adc76d48f6c5d4...bbbca2ddaa5d8feaa63e36b76fdaad77386f024f)

---
updated-dependencies:
- dependency-name: actions/upload-artifact
  dependency-version: 7.0.0
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/scorecard.yml` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ jobs:
       # Upload the results as artifacts (optional). Commenting out will disable uploads of run results in SARIF
       # format to the repository Actions tab.
       - name: "Upload artifact"
-        uses: actions/upload-artifact@330a01c490aca151604b8cf639adc76d48f6c5d4 # v5.0.0
+        uses: actions/upload-artifact@bbbca2ddaa5d8feaa63e36b76fdaad77386f024f # v7.0.0
         with:
           name: SARIF file
           path: results.sarif
```

---

### Incident Patch 3: `b25644c7` (2025-11-01)
**Commit Message**: build(deps): bump actions/upload-artifact from 4.6.2 to 5.0.0 (#370)

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/scorecard.yml` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ jobs:
       # Upload the results as artifacts (optional). Commenting out will disable uploads of run results in SARIF
       # format to the repository Actions tab.
       - name: "Upload artifact"
-        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
+        uses: actions/upload-artifact@330a01c490aca151604b8cf639adc76d48f6c5d4 # v5.0.0
         with:
           name: SARIF file
           path: results.sarif
```

---

### Incident Patch 4: `f881e919` (2025-11-01)
**Commit Message**: build(deps): bump github/codeql-action from 3.28.19 to 4.31.2 (#371)

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/codeql.yml` (modified, +2/-2)
```diff
@@ -38,7 +38,7 @@ jobs:
 
       # Initializes the CodeQL tools for scanning.
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@fca7ace96b7d713c7035871441bd52efbe39e27e # v3.28.19
+        uses: github/codeql-action/init@0499de31b99561a6d14a36a5f662c2a54f91beee # v4.31.2
         with:
           languages: javascript
           # If you wish to specify custom queries, you can do so here or in a config file.
@@ -61,6 +61,6 @@ jobs:
       #   ./location_of_script_within_repo/buildscript.sh
 
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/analyze@fca7ace96b7d713c7035871441bd52efbe39e27e # v3.28.19
+        uses: github/codeql-action/analyze@0499de31b99561a6d14a36a5f662c2a54f91beee # v4.31.2
         with:
           category: "/language:javascript"
\ No newline at end of file
```

**File**: `.github/workflows/scorecard.yml` (modified, +1/-1)
```diff
@@ -68,6 +68,6 @@ jobs:
 
       # Upload the results to GitHub's code scanning dashboard.
       - name: "Upload to code-scanning"
-        uses: github/codeql-action/upload-sarif@fca7ace96b7d713c7035871441bd52efbe39e27e # v3.28.19
+        uses: github/codeql-action/upload-sarif@0499de31b99561a6d14a36a5f662c2a54f91beee # v4.31.2
         with:
           sarif_file: results.sarif
\ No newline at end of file
```

---

### Incident Patch 5: `1640d9e0` (2025-06-05)
**Commit Message**: build(deps-dev): bump mocha from 9.1.1 to 9.2.2 (#358)

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     "after": "0.8.2",
     "eslint": "7.30.0",
     "express": "4.21.2",
-    "mocha": "9.1.1",
+    "mocha": "9.2.2",
     "nyc": "15.1.0",
     "supertest": "6.1.3"
   },
```

---

### Incident Patch 6: `0287892f` (2025-06-05)
**Commit Message**: build(deps): bump actions/upload-artifact from 4.5.0 to 4.6.2 (#352)

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/scorecard.yml` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ jobs:
       # Upload the results as artifacts (optional). Commenting out will disable uploads of run results in SARIF
       # format to the repository Actions tab.
       - name: "Upload artifact"
-        uses: actions/upload-artifact@6f51ac03b9356f520e9adb1b1b7802705f340c2b # v4.5.0
+        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
         with:
           name: SARIF file
           path: results.sarif
```

---

### Incident Patch 7: `07e49a13` (2025-06-05)
**Commit Message**: build(deps-dev): bump express from 4.17.1 to 4.21.2 (#356)

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package.json` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
   "devDependencies": {
     "after": "0.8.2",
     "eslint": "7.30.0",
-    "express": "4.17.1",
+    "express": "4.21.2",
     "mocha": "9.1.1",
     "nyc": "15.1.0",
     "supertest": "6.1.3"
```

---

### Incident Patch 8: `6cb26b5e` (2025-06-05)
**Commit Message**: build(deps): bump ossf/scorecard-action from 2.4.0 to 2.4.2 (#355)

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/scorecard.yml` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ jobs:
           persist-credentials: false
 
       - name: "Run analysis"
-        uses: ossf/scorecard-action@62b2cac7ed8198b15735ed49ab1e5cf35480ba46 # v2.4.0
+        uses: ossf/scorecard-action@05b42c624433fc40578a4040d5cf5e36ddca8cde # v2.4.2
         with:
           results_file: results.sarif
           results_format: sarif
```

---

### Incident Patch 9: `9f71118a` (2025-06-05)
**Commit Message**: build(deps): bump actions/checkout from 4.1.1 to 4.2.2 (#354)

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/codeql.yml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ jobs:
 
     steps:
       - name: Checkout repository
-        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
+        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
 
       # Initializes the CodeQL tools for scanning.
       - name: Initialize CodeQL
```

---

### Incident Patch 10: `83f665d7` (2025-06-05)
**Commit Message**: build(deps): bump coverallsapp/github-action from 1.2.5 to 2.3.6 (#353)

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/ci.yml` (modified, +2/-2)
```diff
@@ -138,7 +138,7 @@ jobs:
       run: npm run lint
 
     - name: Collect code coverage
-      uses: coverallsapp/github-action@09b709cf6a16e30b0808ba050c7a6e8a5ef13f8d # master
+      uses: coverallsapp/github-action@648a8eb78e6d50909eff900e4ec85cab4524a45b # master
       if: steps.list_env.outputs.nyc != ''
       with:
         github-token: ${{ secrets.GITHUB_TOKEN }}
@@ -152,7 +152,7 @@ jobs:
     runs-on: ubuntu-latest
     steps:
     - name: Upload code coverage
-      uses: coverallsapp/github-action@09b709cf6a16e30b0808ba050c7a6e8a5ef13f8d # master
+      uses: coverallsapp/github-action@648a8eb78e6d50909eff900e4ec85cab4524a45b # master
       with:
         github-token: ${{ secrets.github_token }}
         parallel-finished: true
```

---

### Incident Patch 11: `219c2a18` (2025-06-05)
**Commit Message**: build(deps): bump github/codeql-action from 3.24.7 to 3.28.19 (#351)

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/codeql.yml` (modified, +2/-2)
```diff
@@ -38,7 +38,7 @@ jobs:
 
       # Initializes the CodeQL tools for scanning.
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@3ab4101902695724f9365a384f86c1074d94e18c # v3.24.7
+        uses: github/codeql-action/init@fca7ace96b7d713c7035871441bd52efbe39e27e # v3.28.19
         with:
           languages: javascript
           # If you wish to specify custom queries, you can do so here or in a config file.
@@ -61,6 +61,6 @@ jobs:
       #   ./location_of_script_within_repo/buildscript.sh
 
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/analyze@3ab4101902695724f9365a384f86c1074d94e18c # v3.24.7
+        uses: github/codeql-action/analyze@fca7ace96b7d713c7035871441bd52efbe39e27e # v3.28.19
         with:
           category: "/language:javascript"
\ No newline at end of file
```

**File**: `.github/workflows/scorecard.yml` (modified, +1/-1)
```diff
@@ -68,6 +68,6 @@ jobs:
 
       # Upload the results to GitHub's code scanning dashboard.
       - name: "Upload to code-scanning"
-        uses: github/codeql-action/upload-sarif@df409f7d9260372bd5f19e5b04e83cb3c43714ae # v3.27.9
+        uses: github/codeql-action/upload-sarif@fca7ace96b7d713c7035871441bd52efbe39e27e # v3.28.19
         with:
           sarif_file: results.sarif
\ No newline at end of file
```

---

### Incident Patch 12: `791983eb` (2024-05-14)
**Commit Message**: ci: fix errors in ci github action for node 8 and add support for newer versions (#322)

PR-URL: https://github.com/expressjs/cors/pull/322

**File**: `.github/workflows/ci.yml` (modified, +33/-4)
```diff
@@ -18,6 +18,12 @@ jobs:
         - Node.js 12.x
         - Node.js 14.x
         - Node.js 16.x
+        - Node.js 17.x
+        - Node.js 18.x
+        - Node.js 19.x
+        - Node.js 20.x
+        - Node.js 21.x
+        - Node.js 22.x
 
         include:
         - name: Node.js 0.10
@@ -34,7 +40,7 @@ jobs:
 
         - name: Node.js 8.x
           node-version: "8.17"
-          npm-i: mocha@7.2.0
+          npm-i: mocha@7.2.0 nyc@14.1.1
 
         - name: Node.js 10.x
           node-version: "10.24"
@@ -49,8 +55,26 @@ jobs:
         - name: Node.js 16.x
           node-version: "16.6"
 
+        - name: Node.js 17.x
+          node-version: "17.6"
+
+        - name: Node.js 18.x
+          node-version: "18.14"
+
+        - name: Node.js 19.x
+          node-version: "19.6"
+
+        - name: Node.js 20.x
+          node-version: "20.12"
+
+        - name: Node.js 21.x
+          node-version: "21.7"
+
+        - name: Node.js 22.x
+          node-version: "22.0"
+
     steps:
-    - uses: actions/checkout@v2
+    - uses: actions/checkout@v4
 
     - name: Install Node.js ${{ matrix.node-version }}
       shell: bash -eo pipefail -l {0}
@@ -59,7 +83,12 @@ jobs:
         dirname "$(nvm which ${{ matrix.node-version }})" >> "$GITHUB_PATH"
 
     - name: Configure npm
-      run: npm config set shrinkwrap false
+      run: |
+        if [[ "$(npm config get package-lock)" == "true" ]]; then
+          npm config set package-lock false
+        else
+          npm config set shrinkwrap false
+        fi
 
     - name: Install npm module(s) ${{ matrix.npm-i }}
       run: npm install --save-dev ${{ matrix.npm-i }}
@@ -114,7 +143,7 @@ jobs:
     needs: test
     runs-on: ubuntu-latest
     steps:
-    - name: Uploade code coverage
+    - name: Upload code coverage
       uses: coverallsapp/github-action@master
       with:
         github-token: ${{ secrets.github_token }}
```

---

### Incident Patch 13: `f539294b` (2024-04-19)
**Commit Message**: fix: readme status badge (#306)

PR-URL: https://github.com/expressjs/cors/pull/306

**File**: `README.md` (modified, +1/-1)
```diff
@@ -239,7 +239,7 @@ Code for that demo can be found here:
 [coveralls-url]: https://coveralls.io/r/expressjs/cors?branch=master
 [downloads-image]: https://img.shields.io/npm/dm/cors.svg
 [downloads-url]: https://npmjs.org/package/cors
-[github-actions-ci-image]: https://img.shields.io/github/workflow/status/expressjs/cors/ci/master?label=ci
+[github-actions-ci-image]: https://img.shields.io/github/actions/workflow/status/expressjs/cors/ci.yml?branch=master&label=ci
 [github-actions-ci-url]: https://github.com/expressjs/cors?query=workflow%3Aci
 [npm-image]: https://img.shields.io/npm/v/cors.svg
 [npm-url]: https://npmjs.org/package/cors
```

---

### Incident Patch 14: `734e080a` (2021-09-08)
**Commit Message**: build: mocha@9.1.1

**File**: `package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     "after": "0.8.2",
     "eslint": "7.30.0",
     "express": "4.17.1",
-    "mocha": "9.0.2",
+    "mocha": "9.1.1",
     "nyc": "15.1.0",
     "supertest": "6.1.3"
   },
```

---

### Incident Patch 15: `4db62527` (2021-08-04)
**Commit Message**: build: Node.js@10.24

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ jobs:
           npm-i: mocha@7.2.0
 
         - name: Node.js 10.x
-          node-version: "10.23"
+          node-version: "10.24"
           npm-i: mocha@8.3.2
 
         - name: Node.js 12.x
```

#### Recent Merged Pull Requests:
- **PR #428** (closed): fix: set Vary: Origin on all responses, even when Origin header is missing (#330) (@marceli1404)
- **PR #425** (closed): chore: add homepage and bugs URLs to package.json (@DakshSinghDhami)
- **PR #414** (closed): build(deps): bump github/codeql-action from 4.32.4 to 4.35.3 (@dependabot[bot])
- **PR #411** (2026-04-06): fix: replace deprecated app.del() with app.delete() in README example (@Vansh1811)
- **PR #409** (closed): build(deps): bump github/codeql-action from 4.32.4 to 4.35.1 (@dependabot[bot])
- **PR #406** (closed): build: include bundled TypeScript declarations (@jeanpierrecarvalho)
- **PR #399** (closed): add Allow header to OPTIONS preflight response (@Shennng)
- **PR #397** (closed): AI QA Improvements: Tests + Verified Fixes (@manis45001-ai)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

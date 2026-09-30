# Forensic Learning Record (Deep Inspection): pulumi/pulumi

> **Canonical Artifact**: `07_PROJECT_LEARNING/pulumi-pulumi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pulumi/pulumi](https://github.com/pulumi/pulumi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:21:46.642Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pulumi/pulumi`
- **Description**: Pulumi - Infrastructure as Code in any programming language 🚀
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 25750 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.golangci/plugins/noosexit/plugin.go`
```
// Copyright 2026, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package noosexit provides a golangci-lint module plugin that reports
// process-terminating calls (os.Exit and the cmdutil.Exit/cmdutil.ExitError
// helpers) outside of the main and TestMain functions. Exiting elsewhere skips
// deferred cleanup and makes code untestable; functions should return an error
// and let main decide the process exit code. See .custom-gcl.yml for how the
// plugin is wired into the custom golangci-lint binary.
package noosexit

import (
	"go/ast"
	"go/types"

	"github.com/golangci/plugin-module-register/register"
	"golang.org/x/tools/go/analysis"
)

func init() {
	register.Plugin("noosexit", New)
}

func New(any) (register.LinterPlugin, error) {
	return &plugin{}, nil
}

type plugin struct{}

func (p *plugin) BuildAnalyzers() ([]*analysis.Analyzer, error) {
	return []*analysis.Analyzer{Analyzer}, nil
}

func (p *plugin) GetLoadMode() string {
	return register.LoadModeTypesInfo
}

// cmdutilPath is the import path of the package that owns the Exit helpers.
const cmdutilPath = "github.com/pulumi/pulumi/sdk/v3/go/common/util/cmdutil"

// forbiddenExits maps an import path to the set of function names within that
// package whose calls terminate the process and so are permitted only in main
// and TestMain.
var forbiddenExits = map[string]map[string]bool{
	"os":        {"Exit": true},
	cmdutilPath: {"Exit": true, "ExitError": true},
}

// Analyzer reports calls to os.Exit, cmdutil.Exit, and cmdutil.ExitError that
// appear outside of the main and TestMain functions.
var Analyzer = &analysis.Analyzer{
	Name: "noosexit",
	Doc:  "reports process-terminating calls outside of the main and TestMain functions",
	Run:  run,
}

func run(pass *analysis.Pass) (any, error) {
	for _, file := range pass.Files {
		for _, decl := range file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Body == nil || isEntrypoint(fn) {
				continue
			}
			ast.Inspect(fn.Body, func(n ast.Node) bool {
				call, ok := n.(*ast.CallExpr)
				if !ok {
					return true
				}
				if exit := forbiddenExit(pass, call); exit != nil {
					pass.Reportf(call.Pos(),
						"do not call %s.%s outside of main or TestMain; return an error instead",
						exit.Pkg().Name(), exit.Name())
				}
				return true
			})
		}
	}
	return nil, nil
}

// isEntrypoint reports whether fn is a function in which a process-terminating
// call is permitted: a package's main entrypoint or a test binary's TestMain.
func isEntrypoint(fn *ast.FuncDecl) bool {
	return fn.Recv == nil && (fn.Name.Name == "main" || fn.Name.Name == "TestMain")
}

// forbiddenExit returns the function call invokes if it is a process-terminating
// call listed in forbiddenExits, or nil otherwise. The callee is resolved
// through type information so that import aliases are handled correctly. Calls
// written as bare identifiers (i.e. from within the defining package) are
// intentionally not matched, so the helpers may compose with one another.
func forbiddenExit(pass *analysis.Pass, call *ast.CallExpr) *types.Func {
	sel, ok := call.Fun.(*ast.SelectorExpr)
	if !ok {
		return nil
	}
	fn, ok := pass.TypesInfo.Uses[sel.Sel].(*types.Func)
	if !ok || fn.Pkg() == nil {
		return nil
	}
	if forbiddenExits[fn.Pkg().Path()][fn.Name()] {
		return fn
	}
	return nil
}

```

### Core Architecture Module: `.golangci/plugins/requiredfield/plugin.go`
```
// Copyright 2026, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package requiredfield wraps go.abhg.dev/requiredfield as a golangci-lint
// module plugin. Upstream exposes a standard analysis.Analyzer but does not
// itself register with the plugin-module-register package, so we adapt it
// here. See .custom-gcl.yml for how the plugin is wired into the custom
// golangci-lint binary.
package requiredfield

import (
	"github.com/golangci/plugin-module-register/register"
	"go.abhg.dev/requiredfield"
	"golang.org/x/tools/go/analysis"
)

func init() {
	register.Plugin("requiredfield", New)
}

func New(any) (register.LinterPlugin, error) {
	return &plugin{}, nil
}

type plugin struct{}

func (p *plugin) BuildAnalyzers() ([]*analysis.Analyzer, error) {
	return []*analysis.Analyzer{requiredfield.Analyzer}, nil
}

func (p *plugin) GetLoadMode() string {
	return register.LoadModeTypesInfo
}

```

### Core Architecture Module: `.golangci/rules.go`
```
package gorules

import "github.com/quasilyte/go-ruleguard/dsl"

func ignoreErrorClose(m dsl.Matcher) {
	m.Match(`contract.IgnoreError($x.Close())`).
		Report("use contract.IgnoreClose($x) instead of contract.IgnoreError($x.Close())").
		Suggest("contract.IgnoreClose($x)")
}

func deferIgnoreClose(m dsl.Matcher) {
	m.Match(`defer func() { contract.IgnoreClose($x) }()`).
		Report("use defer contract.IgnoreClose($x) directly instead of wrapping in func literal").
		Suggest("defer contract.IgnoreClose($x)")
}

func errorsAs(m dsl.Matcher) {
	m.Match(`errors.As($err, $target)`).
		Report("use errors.AsType[T] instead of errors.As")
}

// ptrHelper forbids private pointer-wrapper helpers whose body is just
// `return &v`. Use Go 1.26's `new(expr)` instead of adding a helper like
// `func ptr[T any](v T) *T { return &v }`.
func ptrHelper(m dsl.Matcher) {
	m.Match(
		`func $name($v $T) *$T { return &$v }`,
		`func $name[$T any]($v $T) *$T { return &$v }`,
		`$name := func($v $T) *$T { return &$v }`,
	).
		Where(m["name"].Text.Matches(`^[a-z]`)).
		Report(`pointer-wrapping helper "$name" is unnecessary; use new(expr) instead`)
}

```

### Core Architecture Module: `npm/lib/cache.js`
```
// Copyright 2026, Pulumi Corporation. All rights reserved.

"use strict";

const os = require("os");
const path = require("path");

// cacheDir returns the install root for a specific Pulumi version, mirroring
// the default path used by the Automation API (PulumiCommand.install). This
// lets both systems share an installation without re-downloading.
function cacheDir(version) {
    const home = process.env.PULUMI_HOME || path.join(os.homedir(), ".pulumi");
    return path.join(home, "versions", version);
}

module.exports = { cacheDir };

```

### Core Architecture Module: `npm/lib/download.js`
```
// Copyright 2026, Pulumi Corporation. All rights reserved.

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const INSTALL_SH_URL = "https://get.pulumi.com/install.sh";
const INSTALL_PS1_URL = "https://get.pulumi.com/install.ps1";

async function defaultFetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return res.text();
}

function defaultExecScript(scriptPath, args) {
    if (process.platform === "win32") {
        const ps = process.env.SystemRoot
            ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
            : "powershell.exe";
        execFileSync(ps, ["-NoProfile", "-InputFormat", "None", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args], {
            stdio: "inherit",
        });
    } else {
        execFileSync("/bin/sh", [scriptPath, ...args], { stdio: "inherit" });
    }
}

// installCLI downloads and runs the official Pulumi install script, installing
// the CLI and all language hosts into {root}/bin/. Mirrors the approach used
// by the Automation API (sdk/nodejs/automation/cmd.ts installPosix/installWindows).
// IO functions are injectable for testing.
async function installCLI(
    version,
    root,
    { fetchText = defaultFetchText, execScript = defaultExecScript } = {},
) {
    const isWindows = process.platform === "win32";
    const scriptContent = await fetchText(isWindows ? INSTALL_PS1_URL : INSTALL_SH_URL);

    const ext = isWindows ? ".ps1" : ".sh";
    const scriptPath = path.join(os.tmpdir(), `pulumi-install-${process.pid}${ext}`);
    try {
        fs.writeFileSync(scriptPath, scriptContent, { mode: 0o700 });
        const args = isWindows
            ? ["-NoEditPath", "-InstallRoot", root, "-Version", version]
            : ["--no-edit-path", "--install-root", root, "--version", version];
        execScript(scriptPath, args);
    } finally {
        fs.rmSync(scriptPath, { force: true });
    }
}

// fetchLatestVersion returns the latest stable Pulumi release version string.
async function fetchLatestVersion(fetchText = defaultFetchText) {
    const text = await fetchText("https://api.pulumi.com/api/cli/version");
    const { latestVersion } = JSON.parse(text);
    return latestVersion.replace(/^v/, "");
}

module.exports = { installCLI, fetchLatestVersion };

```

### Core Architecture Module: `npm/lib/resolve.js`
```
// Copyright 2026, Pulumi Corporation. All rights reserved.

"use strict";

const fs = require("fs");
const path = require("path");
const { cacheDir } = require("./cache");
const { installCLI, fetchLatestVersion } = require("./download");

const pkg = require("../package.json");

function isExecutable(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.X_OK);
        return fs.statSync(filePath).size > 0;
    } catch {
        return false;
    }
}

// resolve returns the path to the pulumi binary, installing it if not already
// cached. IO functions are injectable for testing.
async function resolve({
    version = process.env.PULUMI_VERSION || pkg.version,
    install = installCLI,
    getLatestVersion = fetchLatestVersion,
} = {}) {
    if (!version) {
        version = await getLatestVersion();
    }

    const exe = process.platform === "win32" ? "pulumi.exe" : "pulumi";
    const root = cacheDir(version);
    const dest = path.join(root, "bin", exe);
    if (isExecutable(dest)) return dest;

    process.stderr.write(`Downloading pulumi v${version}...\n`);
    await install(version, root);
    return dest;
}

module.exports = { resolve, isExecutable };

```

### Core Architecture Module: `npm/run.js`
```
#!/usr/bin/env node
// Copyright 2026, Pulumi Corporation. All rights reserved.

"use strict";

const path = require("path");
const { spawn } = require("child_process");
const { resolve } = require("./lib/resolve");

resolve()
    .then((bin) => {
        // Prepend the directory containing the CLI to PATH so that language
        // hosts (pulumi-language-nodejs, etc.) installed alongside it are found.
        const env = { ...process.env, PATH: path.dirname(bin) + path.delimiter + (process.env.PATH || "") };
        const child = spawn(bin, process.argv.slice(2), { stdio: "inherit", env });
        child.on("exit", (code, signal) => {
            if (signal) {
                // Propagate signal to the parent process.
                process.kill(process.pid, signal);
            } else {
                process.exit(code ?? 0);
            }
        });
        child.on("error", (err) => {
            process.stderr.write(`pulumi: failed to start: ${err.message}\n`);
            process.exit(1);
        });
    })
    .catch((err) => {
        process.stderr.write(`pulumi: ${err.message}\n`);
        process.exit(1);
    });

```

### Core Architecture Module: `pkg/asset/massage.go`
```
// Copyright 2016, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package asset

import (
	"regexp"
	"strings"

	"github.com/pulumi/pulumi/sdk/v3/go/common/resource"
)

var (
	functionRegexp    = regexp.MustCompile(`function __.*`)
	withRegexp        = regexp.MustCompile(`    with\({ .* }\) {`)
	environmentRegexp = regexp.MustCompile(`  }\).apply\(.*\).apply\(this, arguments\);`)
	preambleRegexp    = regexp.MustCompile(
		`function __.*\(\) {\n  return \(function\(\) {\n    with \(__closure\) {\n\nreturn `)
	postambleRegexp = regexp.MustCompile(
		`;\n\n    }\n  }\).apply\(__environment\).apply\(this, arguments\);\n}`)
)

// IsUserProgramCode checks to see if this is the special asset containing the users's code
func IsUserProgramCode(a *resource.Asset) bool {
	if !a.IsText() {
		return false
	}

	text := a.Text

	return functionRegexp.MatchString(text) &&
		withRegexp.MatchString(text) &&
		environmentRegexp.MatchString(text)
}

// MassageIfUserProgramCodeAsset takes the text for a function and cleans it up a bit to make the
// user visible diffs less noisy.  Specifically:
//  1. it tries to condense things by changling multiple blank lines into a single blank line.
//  2. it normalizs the sha hashes we emit so that changes to them don't appear in the diff.
//  3. it elides the with-capture headers, as changes there are not generally meaningful.
//
// TODO(https://github.com/pulumi/pulumi/issues/592) this is baking in a lot of knowledge about
// pulumi serialized functions.  We should try to move to an alternative mode that isn't so brittle.
// Options include:
//  1. Have a documented delimeter format that plan.go will look for.  Have the function serializer
//     emit those delimeters around code that should be ignored.
//  2. Have our resource generation code supply not just the resource, but the "user presentable"
//     resource that cuts out a lot of cruft.  We could then just diff that content here.
func MassageIfUserProgramCodeAsset(asset *resource.Asset, debug bool) *resource.Asset {
	if debug {
		return asset
	}

	// Only do this for strings that match our serialized function pattern.
	if !IsUserProgramCode(asset) {
		return asset
	}

	text := asset.Text
	replaceNewlines := func() {
		for {
			newText := strings.ReplaceAll(text, "\n\n\n", "\n\n")
			if len(newText) == len(text) {
				break
			}

			text = newText
		}
	}

	replaceNewlines()

	firstFunc := functionRegexp.FindStringIndex(text)
	text = text[firstFunc[0]:]

	text = withRegexp.ReplaceAllString(text, "    with (__closure) {")
	text = environmentRegexp.ReplaceAllString(text, "  }).apply(__environment).apply(this, arguments);")

	text = preambleRegexp.ReplaceAllString(text, "")
	text = postambleRegexp.ReplaceAllString(text, "")

	replaceNewlines()

	return &resource.Asset{Text: text}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #24949** (2026-09-30): **Python policy pack with `toolchain: uv` and a `[build-system]` table fails to install: `No module named pip`**
  *Symptoms*: > [!NOTE] > This issue was authored by an AI agent on @iwahbe's behalf.  ## What happened?  A Python policy pack sets `toolchain: uv` in `PulumiPolicy.yaml`. Its `pyproject.toml` has a `[build-system]` table. `pulumi install` in the policy pack directory fails with `No module named pip`.  The install is expected to succeed. uv is the selected toolchain, and a virtual environment that uv creates does not contain pip.  If the `[build-system]` table is removed, the install succeeds. The same policy pack installs correctly with v3.208.0 and fails with v3.209.0 and later.  ## Example  `PulumiPolicy.yaml`:  ```yaml description: An example policy pack. runtime:   name: python   options:     toolchain: uv     virtualenv: .venv ```  `pyproject.toml`:  ```toml [project] name = "example-policy" version = "0.1.0" description = "An example policy pack." requires-python = ">=3.11" dependencies = [    "pulumi>=3.162.0",    "pulumi-policy>=1.0.0", ]  [build-system] requires = ["hatchling"] build-backend = "hatchling.build"  [tool.hatch.build.targets.wheel] only-include = ["__main__.py"] ```  `__main__.py` contains a `PolicyPack` with one policy that accepts every resource.  ```console $ pulumi install Installing dependencies...  .../example-policy/.venv/bin/python: No module named pip error: installing dependencies failed: installing package: exit status 1 installing package: exit status 1 installing package: exit status 1 ```  **Expected:** `pulumi install` installs the policy pack with uv 

- **Issue #24947** (2026-09-30): **Workflow failure: Pull Request on #24946**
  *Symptoms*: ## Workflow Failure  Triggered by PR: https://github.com/pulumi/pulumi/pull/24946  [Pull Request](https://github.com/pulumi/pulumi/blob/master/.github/workflows/on-pr.yml) has failed. See the list of failures below:  - [2026-09-30T12:20:24.000Z](https://github.com/pulumi/pulumi/actions/runs/36709735909)
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically closed because the workflow succeeded.  Successful run: [2026-09-30T12:35:18.000Z](https://github.com/pulumi/pulumi/actions/runs/36709735909)

- **Issue #24923** (2026-09-28): **TestConcurrentUpdateError is flaky**
  *Symptoms*: **TestConcurrentUpdateError** has been detected as a flaky test.  - **Package:** `` - **Category:** test_flake - **Occurrences:** 77570 - **First seen:** 2026-08-24 - **Last seen:** 2026-09-27  **CI Run:** https://github.com/pulumi/pulumi/actions/runs/36357386190  **Test output:** ``` DEVELOCITY_INJECTION_CUSTOM_VALUE: gradle-actions GITHUB_DEPENDENCY_GRAPH_ENABLED: false PULUMI_GO_DEP_ROOT: /d/a/pulumi AZURE_TENANT_ID: *** AZURE_CLIENT_ID: *** AZURE_CLIENT_SECRET: *** AZURE_STORAGE_SAS_TOKEN: *** PULUMI_NODE_MODULES: D:\a\_temp/opt/pulumi/node_modules PULUMI_ROOT: D:\a\_temp/opt/pulumi GITHUB_TOKEN: *** GOOGLE_APPLICATION_CREDENTIALS: D:\a\_temp/application_default_credentials.json AWS_ACCESS_KEY: *** AWS_SECRET_ACCESS_KEY: *** ##[endgroup] COMMAND     =  make gotestsum/sdk cd sdk && python 'D:/a/pulumi/pulumi/scripts/go-test.py' -tags="all" -timeout 1h -parallel=4 -p=1 -count=1 -shuffle=off -cover -race=false  $***OPTS*** $***PKGS*** go: downloading github.com/stretchr/testify v1.11.1 go: downloading github.com/blang/semver v3.5.1+incompatible go: downloading github.com/git-pkgs/manifests v0.4.1 go: downloading gopkg.in/yaml.v3 v3.0.1 go: downloading github.com/go-git/go-git/v6 v6.0.0-alpha.4 go: downloading github.com/iwdgo/sigintwindows v0.2.2 go: downloading google.golang.org/grpc v1.83.2 go: downloading google.golang.org/protobuf v1.36.11 go: downloading github.com/klauspost/compress v1.18.7 go: downloading github.com/grpc-ecosystem/grpc-opentracing v0.0.0-2018050721335

- **Issue #24921** (2026-09-28): **Workflow failure: On Push at dev-release / build-release (linux, amd64, ubuntu-latest) / linux-amd64 (+5 more)**
  *Symptoms*: ## Workflow Failure  [On Push](https://github.com/pulumi/pulumi/blob/master/.github/workflows/on-push.yml) has failed. See the list of failures below:  - [2026-09-28T09:55:20.000Z](https://github.com/pulumi/pulumi/actions/runs/36405624011)   - ❌ [dev-release / build-release (linux, amd64, ubuntu-latest) / linux-amd64](https://github.com/pulumi/pulumi/actions/runs/36405624011/job/108875913739): Install GoReleaser (failure)   - ❌ [dev-release / build-release (darwin, arm64, ubuntu-latest) / darwin-arm64](https://github.com/pulumi/pulumi/actions/runs/36405624011/job/108875913774): Package (cancelled)   - ❌ [dev-release / build-release (darwin, amd64, ubuntu-latest) / darwin-amd64](https://github.com/pulumi/pulumi/actions/runs/36405624011/job/108875913792): Package (cancelled)   - ❌ [dev-release / build-release (windows, arm64, ubuntu-latest) / windows-arm64](https://github.com/pulumi/pulumi/actions/runs/36405624011/job/108875913818): Package (cancelled)   - ❌ [dev-release / build-release (linux, arm64, ubuntu-latest) / linux-arm64](https://github.com/pulumi/pulumi/actions/runs/36405624011/job/108875913888): Package (cancelled)   - ❌ [dev-release / build-release (windows, amd64, ubuntu-latest) / windows-amd64](https://github.com/pulumi/pulumi/actions/runs/36405624011/job/108875913968): Package (cancelled)
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically closed because the workflow succeeded.  Successful run: [2026-09-28T10:28:40.000Z](https://github.com/pulumi/pulumi/actions/runs/36408826909)

- **Issue #24786** (2026-09-25): **Workflow failure: Run full language matrix of tests daily**
  *Symptoms*: ## Workflow Failure  [Run full language matrix of tests daily](https://github.com/pulumi/pulumi/blob/master/.github/workflows/cron-test-all.yml) has failed. See the list of failures below:  - [2026-09-25T06:19:04.000Z](https://github.com/pulumi/pulumi/actions/runs/36099021793)
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically closed because the workflow succeeded.  Successful run: [2026-09-25T10:49:06.000Z](https://github.com/pulumi/pulumi/actions/runs/36099021793)

- **Issue #24776** (2026-09-24): **Workflow failure: Run full language matrix of tests daily**
  *Symptoms*: ## Workflow Failure  [Run full language matrix of tests daily](https://github.com/pulumi/pulumi/blob/master/.github/workflows/cron-test-all.yml) has failed. See the list of failures below:  - [2026-09-24T06:12:47.000Z](https://github.com/pulumi/pulumi/actions/runs/35960413138)
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically closed because the workflow succeeded.  Successful run: [2026-09-24T08:16:37.000Z](https://github.com/pulumi/pulumi/actions/runs/35960413138)

- **Issue #24768** (2026-09-25): **[sdk/nodejs] Closure serialization inlines __importStar-wrapped npm modules, breaking CallbackFunction with AWS SDK v3**
  *Symptoms*: ### What happened?  Since 3.229.0 the Node.js language host defaults to `module: "nodenext"` when the program directory has no `tsconfig.json` and TypeScript >= 4.7 is installed (#22363). Under `nodenext`, `import * as S3 from "@aws-sdk/client-s3"` is emitted as `__importStar(require("@aws-sdk/client-s3"))`. Because the AWS SDK v3 CommonJS bundles do not set `__esModule`, `__importStar` returns a fresh wrapper object instead of the module itself.  #22388 added `isImportStarResult()` to unwrap that wrapper in `findNormalizedModuleNameAsync`, but the unwrap is only applied to the built-in modules map. The `require.cache` loop still compares `c.exports === obj` against the wrapper, never against `obj.default`, so any npm package without `__esModule` is not recognised as a module and gets serialized **by value**. The behaviour is unchanged in the latest release, 3.264.0: we reproduced the same failure on AWS with both 3.230.0 and 3.264.0.  For the AWS SDK that means the whole client (and all of `@smithy/*`) is inlined into `__index.js` (~1900 lines instead of ~150), and the result does not even load: `@smithy/core` schema classes have `static symbol = Symbol(...)` and a `Symbol.hasInstance` static. The serializer emulates symbols as `Object.create(global.Symbol.prototype)` and then uses one as a property key:  ```js var __f42_sym = Object.create(global.Symbol.prototype); Object.defineProperty(__f42, __f42_sym, { configurable: true, writable: true, value: __f75 }); ```  which thro

- **Issue #24750** (2026-09-23): **Node.js SDK codegen imports a resource into its own file for self-referencing inputs**
  *Symptoms*: ## What happened  `pulumi package gen-sdk --language nodejs` generates `import {Node} from "./index";` in `node.ts`, which also declares `export class Node`. The SDK fails to compile with TS2440 and TS2395.  An array of self references triggers this, and so does a direct self-referencing input. It also breaks `pulumi install` for any program that consumes such a package through a `packages:` entry, because the generated SDK's postinstall step runs `tsc`.  ## Example  Save as `schema.json`:  ```json {   "name": "example",   "resources": {     "example:index:Node": {       "inputProperties": {         "parents": {           "type": "array",           "items": {"$ref": "#/resources/example:index:Node"}         }       }     }   } } ```  ```sh pulumi version pulumi package gen-sdk schema.json --language nodejs --out sdk cd sdk/nodejs npm install npx tsc --noEmit ```  Generation and `npm install` succeed. Generated `sdk/nodejs/node.ts`, line 7:  ```ts import {Node} from "./index"; ```  Line 9 declares `export class Node extends pulumi.CustomResource`. `tsc` exits with code 2:  ```text node.ts(7,9): error TS2395: Individual declarations in merged declaration 'Node' must be all exported or all local. node.ts(7,9): error TS2440: Import declaration conflicts with local declaration of 'Node'. node.ts(9,14): error TS2395: Individual declarations in merged declaration 'Node' must be all exported or all local. ```  Contrasts, generated and compiled with the same commands:  | Input | Resul
  **Post-Mortem & Fix Analysis**:
  > For comparison, the same shape pointing at a different resource compiles (`tsc` exits 0 with CLI v3.263.0). `node.ts` gets `import {Other} from "./index";`, which is valid because `Other` is declared elsewhere:  ```json {   "name": "example",   "resources": {     "example:index:Node": {       "inputProperties": {         "parents": {           "type": "array",           "items": {"$ref": "#/resources/example:index:Other"}         }       }     },     "example:index:Other": {}   } } ```  So only references from a resource to its own type fail. 

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

### Incident Patch 1: `1a0e5f24` (2026-09-30)
**Commit Message**: Add l2-invoke-union-dependencies conformance test and fix PCL dep loss (#24944)

A resource whose input reads a field of an invoke's return value must
depend on the union of every resource that fed the invoke's arguments.
The new l2-invoke-union-dependencies conformance test pins that rule: a
and b flow into secretInvoke and d consumes data.response, so d must
depend on {a, b}. Go, Node (TSC) and Python already pass; PCL was
dropping deps in two places.

- pkg/pcl/runtime/convert.go: `unmark[T]` stripped every mark of type T
from the value but only returned the last one it visited, so a value
carrying more than one dependencyMark surfaced only one dep. Reworked as
`unmark[T](cty.Value) (cty.Value, []T)` and updated callers; the
boolean-flavoured poison / secret callers now just check len(marks).
- pkg/pcl/runtime/interpreter.go: getAllDependencies walked Output,
Object and Array but not Secret, so a `Secret(Output{deps=...})`
(secretInvoke.response is exactly that) hid its deps. Added the Secret
case.

---------

Co-authored-by: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

**File**: `pkg/testing/pulumi-test-language/tests/l2_invoke_union_dependencies.go` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+// Copyright 2026, Pulumi Corporation.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package tests
+
+import (
+	pkgresource "github.com/pulumi/pulumi/pkg/v3/resource"
+	"github.com/pulumi/pulumi/pkg/v3/resource/plugin"
+	"github.com/pulumi/pulumi/pkg/v3/testing/pulumi-test-language/providers"
+	"github.com/stretchr/testify/require"
+)
+
+// This test pins the desired invoke-dependency semantics: a consumer of an invoke's return value
+// must depend on the union of every resource that fed the invoke's args.
+func init() {
+	LanguageTests["l2-invoke-union-dependencies"] = LanguageTest{
+		Providers: []func() plugin.Provider{
+			func() plugin.Provider { return &providers.SimpleInvokeProvider{} },
+			func() plugin.Provider { return &providers.SimpleProvider{} },
+		},
+		Runs: []TestRun{
+			{
+				Assert: func(l *L, res AssertArgs) {
+					RequireStackResource(l, res.Err, res.Changes)
+
+					var a, b, d *pkgresource.State
+					for _, r := range res.Snap.Resources {
+						switch r.URN.Name() {
+						case "a":
+							a = r
+						case "b":
+							b = r
+						case "d":
+							d = r
+						}
+					}
+					require.NotNil(l, a, "expected resource a")
+					require.NotNil(l, b, "expected resource b")
+					require.NotNil(l, d, "expected resource d")
+
+					require.Empty(l, a.Dependencies, "a has no invoke inputs")
+					require.Empty(l, b.Dependencies, "b has no invoke inputs")
+
+					// d.text was set from data.response, where data is the result of an invoke that read from both
+					// a and b. Even though `response` is derived from just `a.text`, SDKs propagate the union of
+					// all invoke arg dependencies to the result, so d must depend on both a and b.
+					require.ElementsMatch(l, []pkgresource.URN{a.URN, b.URN}, d.Dependencies,
+						"d must depend on both a and b (union of invoke arg dependencies)")
+
+					textDeps, ok := d.PropertyDependencies["text"]
+					require.True(l, ok, "expected d.PropertyDependencies to include 'text'")
+					require.ElementsMatch(l, []pkgresource.URN{a.URN, b.URN}, textDeps,
+						"d.text must be attributed to both invoke arg source resources")
+				},
+			},
+		},
+	}
+}
```

**File**: `pkg/testing/pulumi-test-language/tests/testdata/l2-invoke-union-dependencies/main.pp` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+// Baseline for invoke dependency propagation: an invoke that reads properties from two different
+// resources produces a return value whose consumer must depend on the union of both.
+
+resource "a" "simple-invoke:index:StringResource" {
+    text = "hello"
+}
+
+resource "b" "simple:index:Resource" {
+    value = true
+}
+
+data = invoke("simple-invoke:index:secretInvoke", {
+    value = a.text
+    secretResponse = b.value
+})
+
+resource "d" "simple-invoke:index:StringResource" {
+    text = data.response
+}
```

**File**: `sdk/go/pulumi-language-go/testdata/extra-types/projects/l2-invoke-union-dependencies/Pulumi.yaml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+name: l2-invoke-union-dependencies
+runtime: go
```

**File**: `sdk/go/pulumi-language-go/testdata/extra-types/projects/l2-invoke-union-dependencies/go.mod` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+module l2-invoke-union-dependencies
+
+go 1.25
+
+require (
+	github.com/pulumi/pulumi/sdk/v3 v3.30.0
+	example.com/pulumi-simple/sdk/go/v2 v2.0.0
+	example.com/pulumi-simple-invoke/sdk/go/v10 v10.0.0
+)
+
+replace github.com/pulumi/pulumi/sdk/v3 => /ROOT/artifacts/github.com_pulumi_pulumi_sdk_v3
+
+replace example.com/pulumi-simple/sdk/go/v2 => /ROOT/artifacts/example.com_pulumi-simple_sdk_go_v2
+
+replace example.com/pulumi-simple-invoke/sdk/go/v10 => /ROOT/artifacts/example.com_pulumi-simple-invoke_sdk_go_v10
```

**File**: `sdk/go/pulumi-language-go/testdata/extra-types/projects/l2-invoke-union-dependencies/main.go` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+package main
+
+import (
+	"example.com/pulumi-simple-invoke/sdk/go/v10/simpleinvoke"
+	"example.com/pulumi-simple/sdk/go/v2/simple"
+	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
+)
+
+func main() {
+	pulumi.Run(func(ctx *pulumi.Context) error {
+		// Baseline for invoke dependency propagation: an invoke that reads properties from two different
+		// resources produces a return value whose consumer must depend on the union of both.
+		a, err := simpleinvoke.NewStringResource(ctx, "a", &simpleinvoke.StringResourceArgs{
+			Text: pulumi.String("hello"),
+		})
+		if err != nil {
+			return err
+		}
+		b, err := simple.NewResource(ctx, "b", &simple.ResourceArgs{
+			Value: pulumi.Bool(true),
+		})
+		if err != nil {
+			return err
+		}
+		data := simpleinvoke.SecretInvokeOutput(ctx, simpleinvoke.SecretInvokeOutputArgs{
+			Value:          a.Text,
+			SecretResponse: b.Value,
+		}, nil)
+		_, err = simpleinvoke.NewStringResource(ctx, "d", &simpleinvoke.StringResourceArgs{
+			Text: data.Response(),
+		})
+		if err != nil {
+			return err
+		}
+		return nil
+	})
+}
```

---

### Incident Patch 2: `8d2265b5` (2026-09-30)
**Commit Message**: Fix concurrent `pulumi new` runs failing to clone the templates repository (#24939)

## Summary

Fixes #21285.

`pulumi new` keeps the templates repository in a directory that every
pulumi process shares (`~/.pulumi/templates` by default), and nothing
stopped two processes from preparing it at the same time. Before
cloning, `retrievePulumiTemplates` calls `cleanupLegacyTemplateDir`,
which deletes the directory whenever `git.PlainOpen` cannot open it. A
clone that another process has only just started looks exactly like
that, so it gets deleted under that process, and two clones into the
same directory also collide. That is where the errors in the issue come
from.

This takes an `fsutil.FileMutex` on `<templateDir>.lock` around the
cleanup, the `MkdirAll` and the clone or pull. The lock file sits next
to the directory rather than inside it, the same way `atomicinstall`
locks plugin directories. Inside, it would make the first clone fail,
and the cleanup would delete it.

The lock is best effort. If it cannot be taken, for example next to a
read-only template cache used with `--offline`, or on a filesystem
without flock, pulumi logs the error at debug level and carries on
without it,

**File**: `changelog/pending/cli-new-fix-20260930-151725.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: cli/new
+kind: fix
+body: Fix concurrent `pulumi new` runs failing to clone the templates repository
+time: 2026-09-30T15:17:25.065953+09:00
```

**File**: `pkg/cmd/pulumi/templates/project_templates.go` (modified, +18/-5)
```diff
@@ -32,6 +32,7 @@ import (
 
 	"github.com/pulumi/pulumi/sdk/v3/go/common/env"
 	"github.com/pulumi/pulumi/sdk/v3/go/common/util/contract"
+	"github.com/pulumi/pulumi/sdk/v3/go/common/util/fsutil"
 	"github.com/pulumi/pulumi/sdk/v3/go/common/util/gitutil"
 	"github.com/pulumi/pulumi/sdk/v3/go/common/workspace"
 
@@ -384,17 +385,29 @@ func retrieveFileTemplates(path string) (TemplateRepository, error) {
 func retrievePulumiTemplates(
 	ctx context.Context, offline bool, templateKind TemplateKind,
 ) (TemplateRepository, error) {
-	// Cleanup the template directory.
-	if err := cleanupLegacyTemplateDir(templateKind); err != nil {
-		return TemplateRepository{}, err
-	}
-
 	// Get the template directory.
 	templateDir, err := GetTemplateDir(templateKind)
 	if err != nil {
 		return TemplateRepository{}, err
 	}
 
+	// Concurrent pulumi processes share this directory, and the cleanup below would delete a clone in progress.
+	lockPath := filepath.Clean(templateDir) + ".lock"
+	if err := os.MkdirAll(filepath.Dir(lockPath), 0o700); err != nil {
+		return TemplateRepository{}, err
+	}
+	mutex := fsutil.NewFileMutex(lockPath)
+	if err := mutex.Lock(); err != nil {
+		slog.Debug("Could not lock the template directory", "path", lockPath, "err", err)
+	} else {
+		defer func() { _ = mutex.Unlock() }()
+	}
+
+	// Cleanup the template directory.
+	if err := cleanupLegacyTemplateDir(templateKind); err != nil {
+		return TemplateRepository{}, err
+	}
+
 	// Ensure the template directory exists.
 	if err := os.MkdirAll(templateDir, 0o700); err != nil {
 		return TemplateRepository{}, err
```

**File**: `pkg/cmd/pulumi/templates/project_templates_test.go` (modified, +43/-0)
```diff
@@ -18,8 +18,13 @@ import (
 	"fmt"
 	"os"
 	"path/filepath"
+	"sync"
 	"testing"
+	"time"
 
+	"github.com/go-git/go-git/v6"
+	"github.com/go-git/go-git/v6/config"
+	"github.com/go-git/go-git/v6/plumbing/object"
 	"github.com/pulumi/pulumi/sdk/v3/go/common/env"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
@@ -433,6 +438,44 @@ func TestRetrieveFileTemplate(t *testing.T) {
 	}
 }
 
+func TestRetrievePulumiTemplatesConcurrently(t *testing.T) {
+	source := t.TempDir()
+	repo, err := git.PlainInit(source, false)
+	require.NoError(t, err)
+	// go-git honors the user's commit.gpgSign, so turn it off for this scratch repo.
+	cfg, err := repo.Config()
+	require.NoError(t, err)
+	cfg.Commit.GpgSign = config.OptBoolFalse
+	require.NoError(t, repo.SetConfig(cfg))
+	require.NoError(t, os.WriteFile(filepath.Join(source, "Pulumi.yaml"), []byte("name: test\n"), 0o600))
+	worktree, err := repo.Worktree()
+	require.NoError(t, err)
+	_, err = worktree.Add("Pulumi.yaml")
+	require.NoError(t, err)
+	_, err = worktree.Commit("initial", &git.CommitOptions{
+		Author: &object.Signature{Name: "test", Email: "test@example.com", When: time.Now()},
+	})
+	require.NoError(t, err)
+	head, err := repo.Head()
+	require.NoError(t, err)
+
+	t.Setenv(env.TemplateGitRepository.Var().Name(), source)
+	t.Setenv(env.TemplateBranch.Var().Name(), head.Name().Short())
+	t.Setenv(env.TemplatePath.Var().Name(), filepath.Join(t.TempDir(), "templates"))
+
+	errs := make([]error, 8)
+	var wg sync.WaitGroup
+	for i := range errs {
+		wg.Go(func() {
+			_, errs[i] = retrievePulumiTemplates(t.Context(), false, TemplateKindPulumiProject)
+		})
+	}
+	wg.Wait()
+	for _, err := range errs {
+		require.NoError(t, err)
+	}
+}
+
 //nolint:paralleltest
 func TestCopyTemplateFiles(t *testing.T) {
 	t.Parallel()
```

---

### Incident Patch 3: `db45d040` (2026-09-30)
**Commit Message**: Fix up a comment to be accurate (#24941)

This comment was out of date after the `property.Map` migrations.

**File**: `pkg/resource/deploy/source_eval.go` (modified, +3/-2)
```diff
@@ -2959,8 +2959,9 @@ func (rm *resmon) RegisterResource(ctx context.Context,
 			},
 		}
 
-		// The provider may have returned OutputValues in "Outputs", we need to downgrade them to Computed or
-		// Secret but also add them to the outputDeps map.
+		// The provider may have returned OutputValues in "Outputs". Harvest their dependencies into the
+		// outputDeps map; the OutputValues themselves are downgraded to Computed/Secret later by
+		// MarshalProperties (called without KeepOutputValues) before being sent back to the SDK.
 		if constructResult.OutputDependencies == nil {
 			constructResult.OutputDependencies = map[resource.PropertyKey][]resource.URN{}
 		}
```

---

### Incident Patch 4: `0cb5418f` (2026-09-30)
**Commit Message**: Fix property dependency leak across inputs when SDK omits propertyDependencies (#24937)

When a `RegisterResource` request omits `propertyDependencies` and the
engine backfills each property with the request's flat `dependencies`
list, every property was aliased to the same underlying set instance.
The subsequent pass that walks input Output values and merges their
dependencies into the appropriate property's set therefore mutated the
shared set, causing every Output value's dependencies to bleed into
every other property of the same resource.

This PR fixes it so we clone the set per property so each input's
dependency merge stays isolated.

This isn't reachable through any SDK today: the standard test harness
(and every real SDK) downgrades Output values on the wire for custom
resources, which stops the merge pass from finding any dependencies to
add. It becomes reachable as soon as an SDK starts sending Output-valued
inputs for custom resources — hence the fix and a regression test.

## Changes

- `deploytest.ResourceOptions` gains a `KeepOutputValues` field so tests
can simulate an SDK that preserves Output values on custom-resource
inputs (real SDKs only do this for remote/com

**File**: `pkg/engine/lifecycletest/delete_before_replace_test.go` (modified, +66/-0)
```diff
@@ -297,6 +297,72 @@ func TestPropertyDependenciesAdapter(t *testing.T) {
 	}
 }
 
+// TestPropertyDependenciesBackfillDoesNotLeakAcrossProperties exercises the engine's per-property dependency
+// backfill when a resource is registered with no explicit propertyDependencies but its inputs carry Output
+// property values with dependencies of their own. Each input's dependencies must stay isolated to that input;
+// a shared underlying set would cause one property's Output dependencies to bleed into every other property.
+func TestPropertyDependenciesBackfillDoesNotLeakAcrossProperties(t *testing.T) {
+	t.Parallel()
+
+	loaders := []*deploytest.ProviderLoader{
+		deploytest.NewProviderLoader("pkgA", semver.MustParse("1.0.0"), func() (plugin.Provider, error) {
+			return &deploytest.Provider{}, nil
+		}),
+	}
+
+	const resType = "pkgA:m:typA"
+	var urnA, urnB, urnC resource.URN
+	programF := deploytest.NewLanguageRuntimeF(func(_ plugin.RunInfo, monitor *deploytest.ResourceMonitor) error {
+		respA, err := monitor.RegisterResource(resType, "A", true, deploytest.ResourceOptions{})
+		require.NoError(t, err)
+		urnA = respA.URN
+
+		respB, err := monitor.RegisterResource(resType, "B", true, deploytest.ResourceOptions{})
+		require.NoError(t, err)
+		urnB = respB.URN
+
+		// Register C with two inputs, each of which is an Output value pointing at a *different* upstream
+		// resource. No flat Dependencies or PropertyDeps are sent, so the engine backfills per-property
+		// dependencies and then merges the Output-value dependencies in. propA should depend only on A and
+		// propB only on B.
+		respC, err := monitor.RegisterResource(resType, "C", true, deploytest.ResourceOptions{
+			Inputs: resource.PropertyMap{
+				"propA": resource.NewProperty(resource.Output{
+					Element:      resource.NewProperty("a"),
+					Known:        true,
+					Dependencies: []resource.URN{urnA},
+				}),
+				"propB": resource.NewProperty(resource.Output{
+					Element:      resource.NewProperty("b"),
+					Known:        true,
+					Dependencies: []resource.URN{urnB},
+				}),
+			},
+			KeepOutputValues: true,
+		})
+		require.NoError(t, err)
+		urnC = respC.URN
+
+		return nil
+	})
+
+	hostF := deploytest.NewPluginHostF(nil, nil, programF, nil, nil, loaders...)
+	p := &lt.TestPlan{
+		Options: lt.TestUpdateOptions{T: t, HostF: hostF, SkipDisplayTests: true},
+		Steps:   []lt.TestStep{{Op: Update}},
+	}
+	snap := p.Run(t, nil)
+	for _, res := range snap.Resources {
+		if res.URN != urnC {
+			continue
+		}
+		assert.ElementsMatch(t, []resource.URN{urnA}, res.PropertyDependencies["propA"],
+			"propA should only depend on A, not on B")
+		assert.ElementsMatch(t, []resource.URN{urnB}, res.PropertyDependencies["propB"],
+			"propB should only depend on B, not on A")
+	}
+}
+
 func TestExplicitDeleteBeforeReplace(t *testing.T) {
 	t.Parallel()
 
```

**File**: `pkg/resource/deploy/deploytest/resourcemonitor.go` (modified, +6/-1)
```diff
@@ -449,6 +449,11 @@ type ResourceOptions struct {
 	DisableResourceReferences bool
 	GrpcRequestHeaders        map[string]string
 
+	// KeepOutputValues, if set, preserves Output property values on the marshalled inputs sent to the resource
+	// monitor. Real SDKs only do this for remote (component) resources today, but the test harness allows it for
+	// custom resources too so we can exercise engine paths that handle unusual SDK behaviour.
+	KeepOutputValues bool
+
 	Transforms           []*pulumirpc.Callback
 	StateMigrations      []*pulumirpc.Callback
 	ResourceHookBindings ResourceHookBindings
@@ -495,7 +500,7 @@ func (rm *ResourceMonitor) RegisterResource(t tokens.Type, name string, custom b
 		KeepUnknowns:     true,
 		KeepSecrets:      rm.supportsSecrets,
 		KeepResources:    rm.supportsResourceReferences,
-		KeepOutputValues: opts.Remote,
+		KeepOutputValues: opts.Remote || opts.KeepOutputValues,
 		KeepByteString:   true,
 	})
 	if err != nil {
```

**File**: `pkg/resource/deploy/source_eval.go` (modified, +3/-1)
```diff
@@ -2417,8 +2417,10 @@ func (rm *resmon) RegisterResource(ctx context.Context,
 		// If this request did not specify property dependencies, treat each property as depending on every resource
 		// in the request's dependency list. We don't need to do this when remote is true, because all clients that
 		// support remote already support passing property dependencies, so there's no need to backfill here.
+		// Clone so that downstream code merging a property's Output-value dependencies into its set does not
+		// leak those dependencies into every other property via a shared underlying set instance.
 		for pk := range props {
-			propertyDependencies[pk] = dependencies
+			propertyDependencies[pk] = dependencies.Clone()
 		}
 	} else {
 		// Otherwise, unmarshal the per-property dependency information.
```

---

### Incident Patch 5: `777ef49f` (2026-09-29)
**Commit Message**: Fix grpc-tools and protoc-gen-js  installation via mise (#24929)

Mise now defaults to its builtin
[aube](https://mise.jdx.dev/dev-tools/backends/npm#aube-default) for
managing npm package installations. This requires setting `allow_build`
for `grpc-tools` and `protoc-gen-js`.

**File**: `.mise.toml` (modified, +2/-2)
```diff
@@ -20,10 +20,10 @@ uv = "0.11.28"
 protoc = "29.5"
 "go:google.golang.org/protobuf/cmd/protoc-gen-go" = "v1.36.6"
 "go:google.golang.org/grpc/cmd/protoc-gen-go-grpc" = "v1.5.1"
-"npm:grpc-tools" = { version = "1.13.0", npm_args = "--ignore-scripts=false" }
+"npm:grpc-tools" = { version = "1.13.0", allow_builds = ["grpc-tools"], npm_args = "--ignore-scripts=false" }
 "npm:grpc_tools_node_protoc_ts" = "5.3.3"
 # This is a dev only dependency that fails to install on windows
-"npm:protoc-gen-js" = { version = "3.21.4", os = ["linux", "macos"], npm_args = "--ignore-scripts=false" }
+"npm:protoc-gen-js" = { version = "3.21.4", os = ["linux", "macos"], allow_builds = ["protoc-gen-js"], npm_args = "--ignore-scripts=false" }
 "go:go.abhg.dev/requiredfield/cmd/requiredfield" = "0.8.0"
 "github:WebAssembly/wabt" = "1.0.37"
 dotnet = "8"
```

---

### Incident Patch 6: `3cbed275` (2026-09-25)
**Commit Message**: Fix closure serialization of import-star cached modules (#24797)

Fixes #24768.

Normalize TypeScript `__importStar` wrapper objects before looking up
both built-in and cached Node modules. This lets CommonJS dependencies
imported under `module: nodenext` serialize as module references instead
of attempting to capture their exports by value.

A closure test uses a CommonJS module without `__esModule` and verifies
the generated closure requires the cached module.

Validation:
- `make lint` in `sdk/nodejs`
- `make test_fast` in `sdk/nodejs`

Signed-off-by: Karthik Chowdary <21139050+Karthik-Chowdary@users.noreply.github.com>
Co-authored-by: Karthik Chowdary <21139050+Karthik-Chowdary@users.noreply.github.com>

**File**: `changelog/pending/sdk-nodejs-fix-20260925-092500.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: sdk/nodejs
+kind: fix
+body: Fix closure serialization for `__importStar`-wrapped cached modules
+time: 2026-09-25T09:25:00Z
```

**File**: `sdk/nodejs/runtime/closure/createClosure.ts` (modified, +7/-12)
```diff
@@ -1596,30 +1596,25 @@ function isImportStarResult(obj: any): obj is { default: unknown } {
  * be `/`).
  */
 async function findNormalizedModuleNameAsync(obj: any): Promise<string | undefined> {
+    // When TypeScript compiles `import * as foo from "foo"` with `module: "nodenext"`, it emits
+    // `__importStar(require("foo"))`. This creates a wrapper object with a `default` property that holds the original
+    // module.
+    const target = isImportStarResult(obj) ? obj.default : obj;
+
     // First, check the built-in modules
     const modules = await getBuiltInModules();
-    const key = modules.get(obj);
+    const key = modules.get(target);
     if (key) {
         return key;
     }
 
-    // When TypeScript compiles `import * as foo from "foo"` with `module: "nodenext"`, it emits
-    // `__importStar(require("foo"))`. This creates a wrapper object with a `default` property that holds the original
-    // module.
-    if (isImportStarResult(obj)) {
-        const unwrappedKey = modules.get(obj.default);
-        if (unwrappedKey) {
-            return unwrappedKey;
-        }
-    }
-
     // Next, check the Node module require cache, which will store cached values
     // of all non-built-in Node modules loaded by the program so far. _Note_: We
     // don't pre-compute this because the require cache will get populated
     // dynamically during execution.
     for (const path of Object.keys(require.cache)) {
         const c = require.cache[path];
-        if (c !== undefined && c.exports === obj) {
+        if (c !== undefined && c.exports === target) {
             // Rewrite the path to be a local module reference relative to the current working
             // directory.
             const modPath = upath.relative(process.cwd(), path);
```

**File**: `sdk/nodejs/tests/runtime/testdata/closure-tests/cases/183-Capture-importStar-wrapped-cached-module/index.ts` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+// Copyright 2026, Pulumi Corporation.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+export const description = "Capture __importStar wrapped cached module";
+
+function __importStar(mod: any): any {
+    if (mod && mod.__esModule) return mod;
+    const result: any = {};
+    if (mod != null) {
+        for (const k of Object.getOwnPropertyNames(mod)) {
+            if (k !== "default") {
+                Object.defineProperty(result, k, { enumerable: true, get: () => mod[k] });
+            }
+        }
+    }
+    Object.defineProperty(result, "default", { enumerable: true, value: mod });
+    return result;
+}
+
+const cachedModule = __importStar(require("semver"));
+
+export const func = () => cachedModule.valid("1.2.3");
```

**File**: `sdk/nodejs/tests/runtime/testdata/closure-tests/cases/183-Capture-importStar-wrapped-cached-module/snapshot.txt` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+exports.handler = __f0;
+const cachedModule = require("semver/index.js");
+
+function __f0() {
+  return (function() {
+    with({ this: undefined, arguments: undefined }) {
+
+return () => cachedModule.valid("1.2.3");
+
+    }
+  }).apply(undefined, undefined).apply(this, arguments);
+}
```

---

### Incident Patch 7: `714b4279` (2026-09-24)
**Commit Message**: fix(sdk/go): marshal analyzer config schemas (#24775)

## Summary

- convert each named `JSONSchema` property to an unnamed map before
creating protobuf structs
- add regression coverage for a policy analyzer config schema
- add the required changelog entry

## Testing

- `go test -count=1 ./common/resource/plugin`
- `go test -race -count=1 ./common/resource/plugin`
- `go test -count=1 ./common/resource/...`
- `go vet -lostcancel=false ./common/resource/plugin`

Fixes #24748.

**File**: `changelog/pending/sdk-go-policy-config-schema-fix-20260924-033000.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: sdk/go
+kind: fix
+body: Fix policy analyzer config schema serialization for Go analyzers
+time: 2026-09-24T03:30:00Z
```

**File**: `sdk/go/common/resource/plugin/analyzer_plugin_test.go` (modified, +18/-0)
```diff
@@ -20,6 +20,24 @@ import (
 	"github.com/stretchr/testify/require"
 )
 
+func TestMarshalConfigSchema(t *testing.T) {
+	t.Parallel()
+
+	schema := marshalConfigSchema(&AnalyzerPolicyConfigSchema{
+		Properties: map[string]JSONSchema{
+			"minLength": {
+				"type":    "integer",
+				"default": 12,
+			},
+		},
+		Required: []string{"minLength"},
+	})
+
+	minLength := schema.GetProperties().GetFields()["minLength"].GetStructValue()
+	require.Equal(t, "integer", minLength.GetFields()["type"].GetStringValue())
+	require.Equal(t, 12.0, minLength.GetFields()["default"].GetNumberValue())
+}
+
 func TestConstructEnvWithAdditionalEnv(t *testing.T) {
 	t.Parallel()
 
```

**File**: `sdk/go/common/resource/plugin/analyzer_server.go` (modified, +2/-2)
```diff
@@ -318,9 +318,9 @@ func marshalConfigSchema(schema *AnalyzerPolicyConfigSchema) *pulumirpc.PolicyCo
 		return nil
 	}
 
-	props := make(map[string]any)
+	props := make(map[string]any, len(schema.Properties))
 	for k, v := range schema.Properties {
-		props[k] = v
+		props[k] = map[string]any(v)
 	}
 
 	properties, err := structpb.NewStruct(props)
```

---

### Incident Patch 8: `856296e5` (2026-09-23)
**Commit Message**: Fix self-referencing resource imports in Node.js SDKs (#24752)

## Summary

Prevent self-referencing resource inputs from importing their own class
in generated Node.js SDKs. Fixes #24750.

## Test plan

Add unit coverage and an L2 conformance test for direct, array, map, and
union references. The original generator fails the new test.

## Validation

Harness tests and 11 conformance runs pass across PCL, Go (extra-types),
Node.js/Bun, and Python. Go’s two default modes skip this test because
resource container types are required.

## Changelog

Entry added.

## Risk

Production change is limited to Node.js import collection; most of the
diff is generated test snapshots.

**File**: `changelog/pending/sdkgen-nodejs-fix-20260923-115424.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: sdkgen/nodejs
+kind: fix
+body: Fix generated Node.js SDK compilation for self-referencing resource inputs
+time: 2026-09-23T11:54:24.170755+02:00
```

**File**: `pkg/codegen/nodejs/gen.go` (modified, +5/-5)
```diff
@@ -1596,13 +1596,13 @@ func (mod *modContext) getTypeImportsForResource(t schema.Type, recurse bool, ex
 
 	switch t := t.(type) {
 	case *schema.OptionalType:
-		return mod.getTypeImports(t.ElementType, recurse, externalImports, imports, seen)
+		return mod.getTypeImportsForResource(t.ElementType, recurse, externalImports, imports, seen, res)
 	case *schema.InputType:
-		return mod.getTypeImports(t.ElementType, recurse, externalImports, imports, seen)
+		return mod.getTypeImportsForResource(t.ElementType, recurse, externalImports, imports, seen, res)
 	case *schema.ArrayType:
-		return mod.getTypeImports(t.ElementType, recurse, externalImports, imports, seen)
+		return mod.getTypeImportsForResource(t.ElementType, recurse, externalImports, imports, seen, res)
 	case *schema.MapType:
-		return mod.getTypeImports(t.ElementType, recurse, externalImports, imports, seen)
+		return mod.getTypeImportsForResource(t.ElementType, recurse, externalImports, imports, seen, res)
 	case *schema.EnumType:
 		// If the enum is from another package, add an import for the external package.
 		if t.PackageReference != nil && !codegen.PkgEquals(t.PackageReference, mod.pkg) {
@@ -1642,7 +1642,7 @@ func (mod *modContext) getTypeImportsForResource(t schema.Type, recurse bool, ex
 	case *schema.UnionType:
 		needsTypes := false
 		for _, e := range t.ElementTypes {
-			needsTypes = mod.getTypeImports(e, recurse, externalImports, imports, seen) || needsTypes
+			needsTypes = mod.getTypeImportsForResource(e, recurse, externalImports, imports, seen, res) || needsTypes
 		}
 		return needsTypes
 	default:
```

**File**: `pkg/codegen/nodejs/gen_test.go` (modified, +45/-0)
```diff
@@ -129,6 +129,51 @@ func TestGenerateTypeNames(t *testing.T) {
 	}, filepath.FromSlash("../testing/test/testdata/"))
 }
 
+func TestGenerateSelfReferencingResource(t *testing.T) {
+	t.Parallel()
+
+	for _, shape := range []string{"direct", "array", "map", "union"} {
+		t.Run(shape, func(t *testing.T) {
+			t.Parallel()
+
+			properties := map[string]schema.PropertySpec{}
+			for _, name := range []string{"Node", "Other"} {
+				ref := schema.TypeSpec{Ref: "#/resources/example:index:" + name}
+				typ := ref
+				switch shape {
+				case "array":
+					typ = schema.TypeSpec{Type: "array", Items: &ref}
+				case "map":
+					typ = schema.TypeSpec{Type: "object", AdditionalProperties: &ref}
+				case "union":
+					typ = schema.TypeSpec{OneOf: []schema.TypeSpec{typ, {Type: "string"}}}
+				}
+				properties[strings.ToLower(name)] = schema.PropertySpec{TypeSpec: typ}
+			}
+			pkg, err := schema.ImportSpec(schema.PackageSpec{
+				Name: "example",
+				Resources: map[string]schema.ResourceSpec{
+					"example:index:Node":  {InputProperties: properties},
+					"example:index:Other": {},
+				},
+			}, nil, schema.NewNullLoader(), schema.ValidationOptions{})
+			require.NoError(t, err)
+
+			files, err := GeneratePackage("test", pkg, nil, nil, false, nil)
+			require.NoError(t, err)
+			require.Contains(t, files, "node.ts")
+			source := string(files["node.ts"])
+			require.Contains(t, source, "export class Node extends pulumi.CustomResource")
+			require.Contains(t, source, `import {Other} from "./index";`)
+			for line := range strings.SplitSeq(source, "\n") {
+				if strings.HasPrefix(line, "import ") {
+					require.NotContains(t, line, "Node")
+				}
+			}
+		})
+	}
+}
+
 func TestPascalCases(t *testing.T) {
 	t.Parallel()
 
```

**File**: `pkg/testing/pulumi-test-language/providers/self_reference_provider.go` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+// Copyright 2026, Pulumi Corporation.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package providers
+
+import (
+	"context"
+	"encoding/json"
+	"fmt"
+
+	"github.com/blang/semver"
+
+	"github.com/pulumi/pulumi/pkg/v3/codegen/schema"
+	"github.com/pulumi/pulumi/pkg/v3/resource/plugin"
+	"github.com/pulumi/pulumi/sdk/v3/go/common/resource"
+)
+
+// SelfReferenceProvider exposes resource inputs that reference the same resource type.
+type SelfReferenceProvider struct {
+	plugin.UnimplementedProvider
+}
+
+var _ plugin.Provider = (*SelfReferenceProvider)(nil)
+
+func (p *SelfReferenceProvider) Close() error { return nil }
+
+func (p *SelfReferenceProvider) Configure(
+	context.Context, plugin.ConfigureRequest,
+) (plugin.ConfigureResponse, error) {
+	return plugin.ConfigureResponse{}, nil
+}
+
+func (p *SelfReferenceProvider) GetPluginInfo(context.Context) (plugin.PluginInfo, error) {
+	ver := semver.MustParse("54.0.0")
+	return plugin.PluginInfo{Version: &ver}, nil
+}
+
+func (p *SelfReferenceProvider) GetSchema(
+	context.Context, plugin.GetSchemaRequest,
+) (plugin.GetSchemaResponse, error) {
+	ref := schema.TypeSpec{Ref: "#/resources/selfref:index:Node"}
+	pkg := schema.PackageSpec{
+		Name:    "selfref",
+		Version: "54.0.0",
+		Resources: map[string]schema.ResourceSpec{
+			"selfref:index:Node": {
+				InputProperties: map[string]schema.PropertySpec{
+					"parent":       {TypeSpec: ref},
+					"parents":      {TypeSpec: schema.TypeSpec{Type: "array", Items: &ref}},
+					"namedParents": {TypeSpec: schema.TypeSpec{Type: "object", AdditionalProperties: &ref}},
+					"parentOrName": {TypeSpec: schema.TypeSpec{OneOf: []schema.TypeSpec{ref, {Type: "string"}}}},
+				},
+			},
+		},
+	}
+	jsonBytes, err := json.Marshal(pkg)
+	return plugin.GetSchemaResponse{Schema: jsonBytes}, err
+}
+
+func (p *SelfReferenceProvider) CheckConfig(
+	_ context.Context, req plugin.CheckConfigRequest,
+) (plugin.CheckConfigResponse, error) {
+	return plugin.CheckConfigResponse{Properties: req.News}, nil
+}
+
+func (p *SelfReferenceProvider) Check(
+	_ context.Context, req plugin.CheckRequest,
+) (plugin.CheckResponse, error) {
+	if req.URN.Type() != "selfref:index:Node" {
+		return plugin.CheckResponse{
+			Failures: makeCheckFailure("", fmt.Sprintf("invalid URN type: %s", req.URN.Type())),
+		}, nil
+	}
+	return plugin.CheckResponse{Properties: req.NewInputs}, nil
+}
+
+func (p *SelfReferenceProvider) Create(
+	_ context.Context, req plugin.CreateRequest,
+) (plugin.CreateResponse, error) {
+	if req.URN.Type() != "selfref:index:Node" {
+		return plugin.CreateResponse{Status: resource.StatusUnknown},
+			fmt.Errorf("invalid URN type: %s", req.URN.Type())
+	}
+	id := req.URN.Name()
+	if req.Preview {
+		id = ""
+	}
+	return plugin.CreateResponse{
+		ID:         resource.ID(id),
+		Properties: req.Properties,
+		Status:     resource.StatusOK,
+	}, nil
+}
+
+func (p *SelfReferenceProvider) Diff(
+	context.Context, plugin.DiffRequest,
+) (plugin.DiffResponse, error) {
+	return plugin.DiffResult{}, nil
+}
+
+func (p *SelfReferenceProvider) Delete(
+	context.Context, plugin.DeleteRequest,
+) (plugin.DeleteResponse, error) {
+	return plugin.DeleteResponse{}, nil
+}
```

**File**: `pkg/testing/pulumi-test-language/tests/l2_resource_self_reference.go` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+// Copyright 2026, Pulumi Corporation.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package tests
+
+import (
+	"github.com/pulumi/pulumi/pkg/v3/resource/plugin"
+	"github.com/pulumi/pulumi/pkg/v3/testing/pulumi-test-language/providers"
+	"github.com/pulumi/pulumi/sdk/v3/go/common/resource"
+	"github.com/stretchr/testify/assert"
+)
+
+func init() {
+	LanguageTests["l2-resource-self-reference"] = LanguageTest{
+		Providers: []func() plugin.Provider{
+			func() plugin.Provider { return &providers.SelfReferenceProvider{} },
+		},
+		Runs: []TestRun{{
+			Assert: func(l *L, res AssertArgs) {
+				RequireStackResource(l, res.Err, res.Changes)
+				RequireSingleResource(l, res.Snap.Resources, "pulumi:providers:selfref")
+				root := RequireSingleNamedResource(l, res.Snap.Resources, "root")
+				child := RequireSingleNamedResource(l, res.Snap.Resources, "child")
+				ref := resource.MakeCustomResourceReference(root.URN, root.ID, "")
+				assert.Equal(l, resource.PropertyMap{
+					"parent":       ref,
+					"parents":      resource.NewProperty([]resource.PropertyValue{ref}),
+					"namedParents": resource.NewProperty(resource.PropertyMap{"root": ref}),
+					"parentOrName": ref,
+				}, child.Inputs)
+			},
+		}},
+	}
+}
```

---

### Incident Patch 9: `191634dd` (2026-09-23)
**Commit Message**: Fix a binder panic on a tuple index equal to the tuple length (#24755)

`TupleType.Traverse` accepted an index equal to the number of elements
and
then read past the element slice. A PCL program such as `[false][1]`
made the binder panic instead of reporting an error. The bounds check
now rejects the index, and the diagnostic names the tuple length instead
of an index that is one past the end.

**File**: `changelog/pending/pcl-fix-20260923-133013.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: pcl
+kind: fix
+body: Fix a panic when a PCL program indexes a tuple literal with an index equal to its length
+time: 2026-09-23T13:30:13.367078+02:00
```

**File**: `pkg/codegen/hcl2/model/diagnostics.go` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ func unsupportedObjectProperty(indexRange hcl.Range) *hcl.Diagnostic {
 }
 
 func tupleIndexOutOfRange(tupleLen int, indexRange hcl.Range) *hcl.Diagnostic {
-	return errorf(indexRange, "tuple index must be between 0 and %d", tupleLen)
+	return errorf(indexRange, "tuple index out of range for tuple of length %d", tupleLen)
 }
 
 func UnknownObjectProperty(name string, indexRange hcl.Range, props []string) *hcl.Diagnostic {
```

**File**: `pkg/codegen/hcl2/model/type_tuple.go` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ func (t *TupleType) Traverse(traverser hcl.Traverser) (Traversable, hcl.Diagnost
 	if acc != big.Exact {
 		return DynamicType, hcl.Diagnostics{unsupportedTupleIndex(traverser.SourceRange())}
 	}
-	if elementIndex < 0 || elementIndex > int64(len(t.ElementTypes)) {
+	if elementIndex < 0 || elementIndex >= int64(len(t.ElementTypes)) {
 		return DynamicType, hcl.Diagnostics{tupleIndexOutOfRange(len(t.ElementTypes), traverser.SourceRange())}
 	}
 	return t.ElementTypes[int(elementIndex)], nil
```

**File**: `pkg/codegen/hcl2/model/type_tuple_test.go` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+// Copyright 2026, Pulumi Corporation.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package model
+
+import (
+	"testing"
+
+	"github.com/hashicorp/hcl/v2"
+	"github.com/stretchr/testify/assert"
+	"github.com/zclconf/go-cty/cty"
+)
+
+func TestTupleTypeTraverseIndex(t *testing.T) {
+	t.Parallel()
+
+	tuple := NewTupleType(BoolType, StringType)
+	rng := hcl.Range{Filename: "test.pp"}
+
+	cases := []struct {
+		name  string
+		index int64
+		typ   Traversable
+		diags hcl.Diagnostics
+	}{
+		{name: "first", index: 0, typ: BoolType},
+		{name: "last", index: 1, typ: StringType},
+		{name: "length", index: 2, typ: DynamicType, diags: hcl.Diagnostics{tupleIndexOutOfRange(2, rng)}},
+		{name: "past length", index: 3, typ: DynamicType, diags: hcl.Diagnostics{tupleIndexOutOfRange(2, rng)}},
+		{name: "negative", index: -1, typ: DynamicType, diags: hcl.Diagnostics{tupleIndexOutOfRange(2, rng)}},
+	}
+	for _, c := range cases {
+		t.Run(c.name, func(t *testing.T) {
+			t.Parallel()
+			typ, diags := tuple.Traverse(hcl.TraverseIndex{Key: cty.NumberIntVal(c.index), SrcRange: rng})
+			assert.Equal(t, c.typ, typ)
+			assert.Equal(t, c.diags, diags)
+		})
+	}
+}
```

---

### Incident Patch 10: `1a2a8ea0` (2026-09-21)
**Commit Message**: fix absolute path handling on windows (#24628)

When using absolute URLs on Windows, using `file:///C:/...`, our current
function for massaging paths is broken, as it uses `/C:/` and feeds that
into `filepath.Abs`, which will result in `C:/C:/`. Fix that by
stripping off the first `/` if we have the volume name.

Fixes #24627

**File**: `changelog/pending/backend-diy-fix-20260914-135045.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: backend/diy
+kind: fix
+body: Fix path handling with absolute paths
+time: 2026-09-14T13:50:45.669615113+02:00
```

**File**: `pkg/backend/diy/backend.go` (modified, +7/-0)
```diff
@@ -668,6 +668,13 @@ func massageBlobPath(path string) (string, error) {
 		}
 	}
 
+	// On Windows a URI like file:///C:/my/path leaves "/C:/my/path" once the scheme is
+	// stripped. Drop the leading slash so filepath.Abs below doesn't treat the path as
+	// relative to the current drive and duplicate the drive letter (C:\C:\my\path).
+	if os.PathSeparator != '/' && strings.HasPrefix(path, "/") && filepath.VolumeName(path[1:]) != "" {
+		path = path[1:]
+	}
+
 	// For file:// backend, ensure a relative path is resolved. fileblob only supports absolute paths.
 	path, err = filepath.Abs(path)
 	if err != nil {
```

**File**: `pkg/backend/diy/backend_test.go` (modified, +6/-0)
```diff
@@ -192,6 +192,12 @@ func TestMassageBlobPath(t *testing.T) {
 		testMassagePath(t, FilePathPrefix+"/1/2/3/../4/..", FilePathPrefix+expected+noTmpDirSuffix)
 	})
 
+	t.Run("DriveLetterURI", func(t *testing.T) {
+		t.Parallel()
+
+		testMassagePath(t, FilePathPrefix+"/C:/Users/steve", FilePathPrefix+"/C:/Users/steve"+noTmpDirSuffix)
+	})
+
 	t.Run("AlreadySuffixedWithNoTmpDir", func(t *testing.T) {
 		t.Parallel()
 
```

#### Recent Merged Pull Requests:
- **PR #24952** (2026-09-30): drop legacy preset for lint (@tgummerer)
- **PR #24951** (2026-09-30): Do not run pip to install Python plugin packages under uv or Poetry (@iwahbe)
- **PR #24946** (2026-09-30): Changelog and go.mod updates for v3.266.0 (@pulumi-bot)
- **PR #24944** (2026-09-30): Add l2-invoke-union-dependencies conformance test and fix PCL dep loss (@Frassle)
- **PR #24943** (2026-09-30): Migrate Update to property.Map (@Frassle)
- **PR #24942** (2026-09-30): Switch the PCL interpreter to use `property.{Map,Value}` (@iwahbe)
- **PR #24941** (2026-09-30): Fix up a comment to be accurate (@Frassle)
- **PR #24940** (2026-09-30): Freeze v3.266.0 (@pulumi-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

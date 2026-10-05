# Forensic Learning Record (Deep Inspection): lunasec-io/lunasec

> **Canonical Artifact**: `07_PROJECT_LEARNING/lunasec-io-lunasec-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lunasec-io/lunasec](https://github.com/lunasec-io/lunasec))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:00:37.018Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lunasec-io/lunasec`
- **Description**: LunaSec - Dependency Security Scanner that automatically notifies you about vulnerabilities like Log4Shell or node-ipc in your Pull Requests and Builds. Protect yourself in 30 seconds with the LunaTrace GitHub App: https://github.com/marketplace/lunatrace-by-lunasec/ 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md
- **Stars / Engagement**: 1470 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
/*
 * Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
const process = require('process');

const hideErrorsInDev = process.env.HIDE_ERRORS_IN_DEV === 'true';

const productionError = hideErrorsInDev ? 'warn': 'error';
const productionWarn = hideErrorsInDev ? 'off': 'warn';


module.exports = {
  root: true,
  env: {
    browser: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:eslint-comments/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:prettier/recommended',
  ],
  ignorePatterns: [
    'packages/tokenizer-sdk/src/generated',
    'lunatrace/bsl/frontend/src/api/generated.ts',
    '@aws-sdk/**',
    'lunatrace/bsl/backend-cdk/cdk.out'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    tsconfigRootDir: __dirname,
    ecmaVersion: 12,
    sourceType: 'module',
    project: [
      'lunadefend/js/sdks/packages/vue-sdk/tsconfig.json',
      'lunadefend/js/sdks/tsconfig.json',
      'lunadefend/js/demo-apps/packages/demo-back-end/tsconfig.json',
      'lunadefend/js/demo-apps/packages/react-front-end/tsconfig.json',
      'lunadefend/js/internal-infrastructure/metrics-server-backend/tsconfig.json',
      'lunadefend/js/internal-infrastructure/s3-redirect-generator/tsconfig.json',
      'lunatrace/bsl/common/tsconfig.json',
      'lunatrace/bsl/frontend/tsconfig.json',
      'lunatrace/bsl/backend-cdk/tsconfig.json',
      'lunatrace/bsl/backend/tsconfig.json',
      'lunatrace/dev-cli/tsconfig.json',
      'lunatrace/bsl/common/tsconfig.json',
      'lunatrace/bsl/logger/tsconfig.json',
      'lunatrace/bsl/ml/js/tsconfig.json',
      'lunatrace/datadog-metrics-proxy/tsconfig.json',
      'lunatrace/npm-package-cli/tsconfig.json',
      'docs/tsconfig.json'
    ]
  },
  plugins: [
    'react',
    '@typescript-eslint',
    'jest',
    'unused-imports'
  ],
  rules: {
    '@typescript-eslint/no-unsafe-argument': productionWarn, // TODO: Re-enable this rule and fix all errors
    '@typescript-eslint/no-misused-promises': productionWarn,
    '@typescript-eslint/no-unsafe-assignment': productionWarn,
    '@typescript-eslint/no-unsafe-call': productionWarn,
    '@typescript-eslint/no-unsafe-return': productionWarn,
    '@typescript-eslint/no-unsafe-member-access': productionWarn,
    'import/namespace': 'off', // productionError,
    'no-console': productionWarn,
    'no-debugger': productionError,
    eqeqeq: 'error',
    quotes: [productionWarn, 'single', { allowTemplateLiterals: true, avoidEscape: true }],
    curly:'warn',
    'react/jsx-wrap-multilines': [
      productionError,
      {
        declaration: 'parens-new-line',
        assignment: 'parens-new-line',
        return: 'parens-new-line',
        arrow: 'parens-new-line',
        condition: 'parens-new-line',
        logical: 'parens-new-line',
        prop: 'parens-new-line',
      }
    ],
    'react/jsx-first-prop-new-line': [
      productionError,
      'multiline-multiprop'
    ],
    'react/jsx-max-props-per-line': [
      productionError,
      {
        'maximum': 3,
        'when': 'multiline'
      }
    ],
    'react/jsx-indent-props': [
      productionError,
      2
    ],
    'react/jsx-closing-bracket-location': [
      productionError,
      'tag-aligned',
    ],
    'react-hooks/exhaustive-deps': 'off',
    'prettier/prettier': [
      productionWarn,
      {
        singleQuote: true,
        printWidth: 120
      }
      ],
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    'eslint-comments/disable-enable-pair': [
      'error',
      { 'allowWholeFile': true }
    ],
    'eslint-comments/no-unlimited-disable': 'off',
    'eslint-comments/no-unused-disable': 'error',
    '@typescript-eslint/no-unused-vars':[
      productionWarn,
      { 'argsIgnorePattern': '^_' },
    ],
     //'unused-imports/no-unused-imports': 'error', // turn this on if you want to --fix all of these out of the codebase
    '@typescript-eslint/unbound-method': 'warn',
    '@typescript-eslint/restrict-template-expressions': 'off',
    'import/order': [
      productionError,
      { 'newlines-between': 'always', 'alphabetize': { 'order': 'asc' } }
    ],
    'sort-imports': [
      productionError,
      { 'ignoreDeclarationSort': true, 'ignoreCase': true }
    ]
  },
  settings: {
    react: {
      version: '16'
    }
  }
}

```

### Core Architecture Module: `.lintstagedrc.js`
```
/*
 * Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
const fs = require('fs');
const uuid = require('uuid').v4;
const yaml = require('js-yaml');

// These are the various Regex checks used to identify files of interest for this script.
/**
 * This one is a little bit janky because we have to check for a ton of different filenames...
 * If you know of a way to clean it up, feel free to. This seemed like the simplest solution though.
 * @type {RegExp}
 */
const javascriptRegex = /\.(((mj|j|t)sx?)|\.vue)$/i;
const cssRegex = /\.(css|scss|sass|less)$/i;
const buildOutputRegex = /\/build\//i;
const golangRegex = /\.go$/i;
const markdownRegex = /\.mdx?$/i;
const generatedFilesRegex = /(gen\.go$|generated|schema\.graphql$|_enumer\.go$|gogen)/;

const bslLicenseRegex = /.*\/bsl\/.*/i

const filePrefix = '# AUTO-GENERATED FILE CREATED BY LINTER\n\n';

/**
 * Creates a deep copy of an object or array, where deep means it copies all array internally.
 * This copy is completely separate from the copy handed to this function.
 * @param obj Any valid JSON value
 * @return {any} A copy of the provided value.
 */
function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merges a Skywalking Eyes config with a given list of files.
 * The output is a config that will only check the files specified, instead of every file.
 * @param baseConfig The base YAML config to override (it's referentially transparent)
 * @param files List of files to check the licenses for
 * @return {any} The new Skywalking Eyes configuration file
 */
function substituteConfigFiles(baseConfig, files) {
  const configCopy = deepCopy(baseConfig);

  return {
    ...configCopy,
    header: {
      ...configCopy.header,
      paths: files,
      'paths-ignore': []
    }
  };
}

/**
 * Reads the config files on the disk and runs a config for them.
 * TODO: Make this just read all configs and not have to be hardcoded.
 * @return {{apache2: unknown, creativeCommons: unknown}} Object containing the YAML configs from disk.
 */
function readBaseLicenseConfigs() {
  const apacheConfig = fs.readFileSync('./tools/license-checker/configs/apache2.yaml', 'utf8');
  const bslConfig = fs.readFileSync('./tools/license-checker/configs/bsl-lunatrace.yaml', 'utf8');
  const creativeCommonsConfig = fs.readFileSync('./tools/license-checker/configs/CC-BY-SA-4_0.yaml', 'utf8');

  return {
    apache2: yaml.load(apacheConfig.toString()),
    bsl: yaml.load(bslConfig.toString()),
    creativeCommons: yaml.load(creativeCommonsConfig.toString())
  };
}

/**
 * Takes in a Skywalking Eyes config file and modifies it to only match files that pass a given filter function.
 * This writes a file to the disk, so be sure to clean it up afterwards!
 * @param baseConfig Base Skywalking Eyes config file to extend
 * @param files Array of filenames to check against
 * @param filterFn Filter function to check each filename against
 * @return {{path: string, filename: string}|null} Information about the config file that was written to disk.
 */
function rewriteLicenseFile(baseConfig, files, filterFn) {
  const filteredFiles = files.filter(filterFn);

  if (filteredFiles.length === 0) {
    return null;
  }

  const subsetConfig = substituteConfigFiles(baseConfig, filteredFiles);

  const configFileName = uuid() + '.ignored.yaml';
  const configPath = './tools/license-checker/configs/' + configFileName;

  fs.writeFileSync(
    configPath,
    filePrefix + yaml.dump(subsetConfig)
  );

  return {
    path: configPath,
    filename: configFileName
  };
}

/**
 * Generates a shell command to run the License Checking Tool.
 * @param {{path: string, filename: string}} configInfo Config path and filename
 * @return {string} The command to run
 */
function generateLicenseToolCommand(configInfo) {
  return `sh -c './tools/license-checker/run-license-check.sh with-config "${configInfo.filename}"; rm -f ${configInfo.path}'`;
}

function isFileCode(file) {
  return (
    file.match(javascriptRegex) || file.match(golangRegex) || (file.match(cssRegex) && file.match(buildOutputRegex))
  ) && (
    !file.match(generatedFilesRegex)
  );
}

/**
 * This script is invoked whenever a commit happens by Husky and lint-staged.
 * The output of this function is an array of commands that are run by lint-staged.
 * We do this in order to speed up `git commit` because otherwise it is painfully slow to make commits!
 * @param allStagedFiles List of filenames passed to us by lint-staged
 * @return {*[]} Array of commands to be run
 */
module.exports = (allStagedFiles) => {
  const outputCommands = [];

  const {apache2, bsl, creativeCommons} = readBaseLicenseConfigs();

  // Writes a custom file for the License checking script to use.
  const apacheConfigInfo = rewriteLicenseFile(
    apache2,
    allStagedFiles,
      file => !file.match(bslLicenseRegex) && isFileCode(file)
  );

  // Only append the license check step if we have a valid config.
  if (apacheConfigInfo !== null) {
    outputCommands.push(generateLicenseToolCommand(apacheConfigInfo));
  }

  // Writes a custom file for the License checking script to use.
  const bslConfigInfo = rewriteLicenseFile(
    bsl,
    allStagedFiles,
    file => file.match(bslLicenseRegex) && isFileCode(file)  );

  // Only append the license check step if we have a valid config.
  if (bslConfigInfo !== null) {
    outputCommands.push(generateLicenseToolCommand(bslConfigInfo));
  }

  // Writes a custom file for the License checking script to use.
  const creativeCommonsConfigInfo = rewriteLicenseFile(
    creativeCommons,
    allStagedFiles,
      (file) => {
        return file.match(markdownRegex) && !file.match(/pull_request_template.md|topics\//)
      }
  );

  // Only append the license check step if we have a valid config.
  if (creativeCommonsConfigInfo !== null) {
    outputCommands.push(generateLicenseToolCommand(creativeCommonsConfigInfo));
  }

  // Lint all JS files
  const jsFiles = allStagedFiles.filter(file => file.match(javascriptRegex));
  if (jsFiles.length > 0) {
    // Setting this to "production" allows us to disable certain nit-picky Lint rules while developing.
    outputCommands.push(`sh -c "SLOW_LINT=true eslint --fix ${jsFiles.join(' ')}"`);
  }

  return outputCommands;
}

```

### Core Architecture Module: `lunadefend.js`
```
/*
 * Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
module.exports = {
	development: {
		applicationFrontEnd: 'http://localhost:3000',
		applicationBackEnd: 'http://localhost:3001',
	},
	production: {
		applicationFrontEnd: 'http://localhost:3000',
		applicationBackEnd: 'http://localhost:3001',
	},
}

```

### Core Architecture Module: `lunadefend/go/cmd/analyticscollector/main_dev.go`
```
// Copyright 2022 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Copyright by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Business Source License v1.1
// (the "License"); you may not use this file except in compliance with the
// License. You may obtain a copy of the License at
//
// https://github.com/lunasec-io/lunasec/blob/master/licenses/BSL-LunaTrace.txt
//
// See the License for the specific language governing permissions and
// limitations under the License.
//
//go:build dev

package main

import "github.com/lunasec-io/lunasec/lunadefend/go/pkg/analyticscollector"

func main() {
  analyticscollector.Handler()
}

```

### Core Architecture Module: `lunadefend/go/cmd/analyticscollector/main_lambda.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
//go:build lambda

package main

import (
  "github.com/aws/aws-lambda-go/lambda"
  "github.com/lunasec-io/lunasec/lunadefend/go/pkg/analyticscollector"
)

func main() {
  lambda.Start(analyticscollector.Handler)
}

```

### Core Architecture Module: `lunadefend/go/cmd/containermodifier/main_cli.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
//go:build cli

package main

import (
  "log"
  "os"

  "github.com/lunasec-io/lunasec/lunadefend/go/controller"
  "github.com/urfave/cli/v2"
)

func main() {
  log.SetFlags(log.Lshortfile)

  app := &cli.App{
    Name: "lunasec-cli",
    Commands: []*cli.Command{
      {
        Name:    "build",
        Aliases: []string{"b"},
        Usage:   "Build a secure resolver docker container.",
        Flags: []cli.Flag{
          &cli.StringFlag{
            Name:     "container-tar",
            Usage:    "Tar file of container to be modified",
            Required: true,
          },
          &cli.StringFlag{
            Name:     "config",
            Usage:    "Lunasec config file",
            Required: true,
          },
        },
        Action: func(c *cli.Context) error {
          containerTarFile := c.String("container-tar")
          configFile := c.String("config")
          containerModifierController := controller.NewContainerModifierController(nil)
          containerModifierController.HandleLocalInvoke(containerTarFile, configFile)
          return nil
        },
      },
    },
  }

  err := app.Run(os.Args)
  if err != nil {
    log.Fatal(err)
  }
}

```

### Core Architecture Module: `lunadefend/go/cmd/containermodifier/main_lambda.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
//go:build lambda

package main

import (
  "log"

  "github.com/aws/aws-lambda-go/lambda"
  "github.com/lunasec-io/lunasec/lunadefend/go/controller"
  "github.com/lunasec-io/lunasec/lunadefend/go/gateway"
)

func main() {
  log.SetFlags(log.Lshortfile)

  ecrGateway := gateway.NewAwsECRGateway()
  containerModifierController := controller.NewContainerModifierController(ecrGateway)
  lambda.Start(containerModifierController.HandleLambdaInvoke)
}

```

### Core Architecture Module: `lunadefend/go/cmd/runtime/main.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package main

import (
  "context"
  "encoding/json"
  "errors"
  "log"
  "net/http"
  "os"
  "sync"

  "github.com/aws/aws-lambda-go/events"
  "github.com/aws/aws-lambda-go/lambda"
  tokenizer "github.com/lunasec-io/lunasec/lunadefend/go/pkg/tokenizer"
  "github.com/lunasec-io/lunasec/lunadefend/go/service/invoker"
  "github.com/lunasec-io/lunasec/lunadefend/go/types/event"
  "github.com/lunasec-io/lunasec/lunadefend/go/util"
  "go.uber.org/zap"
)

func startHttpServer(wg *sync.WaitGroup) *http.Server {
  server := tokenizer.NewHttpServerSidecar()

  go func() {
    defer wg.Done() // let main know we are done cleaning up

    // always returns error. ErrServerClosed on graceful close
    if err := server.ListenAndServe(); err != http.ErrServerClosed {
      // unexpected error. port in use?
      log.Fatalf("ListenAndServe(): %v", err)
    }
  }()

  // returning reference so caller can call Shutdown()
  return server
}

func verifyContainerSecret(sentContainerSecret string) bool {
  containerSecret := os.Getenv("CONTAINER_SECRET")
  if containerSecret == "" {
    // container secret is not set, we treat this as a validated container secret
    return true
  }

  return sentContainerSecret == containerSecret
}

func HandleRequestApiGateway(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
  var (
    invokeEvent event.ExecuteFunctionRequest
    funcResp    event.ExecuteFunctionResponse
  )

  containerSecret := request.Headers["X-Container-Secret"]
  if !verifyContainerSecret(containerSecret) {
    err := errors.New("unauthorized")
    return util.ApiGatewayError(err)
  }

  err := json.Unmarshal([]byte(request.Body), &invokeEvent)
  if err != nil {
    return util.ApiGatewayError(err)
  }

  funcResp, err = HandleRequest(ctx, invokeEvent)
  if err != nil {
    return util.ApiGatewayError(err)
  }

  headers := map[string]string{}
  return util.MarshalApiGatewayResponse(http.StatusOK, headers, funcResp)
}

func HandleRequest(ctx context.Context, req event.ExecuteFunctionRequest) (event.ExecuteFunctionResponse, error) {
  var (
    logger   *zap.Logger
    result   *json.RawMessage
    backpack *json.RawMessage
    resp     event.ExecuteFunctionResponse
    err      error
  )

  logger, err = util.GetLogger()
  if err != nil {
    log.Println("unable to create zap logger", err)
    return resp, err
  }

  logger.Debug(
    "starting tokenizer sidecar",
  )

  httpServerExitDone := &sync.WaitGroup{}

  httpServerExitDone.Add(1)
  server := startHttpServer(httpServerExitDone)
  defer func() {
    err = server.Shutdown(ctx)
    if err != nil {
      log.Println("error while shutting down server", err)
      return
    }
    httpServerExitDone.Wait()
  }()

  logger.Debug(
    "starting lambda runtime",
    zap.String("functionName", req.FunctionName),
  )
  lambdaRuntime := invoker.NewLambdaRuntime(logger, req.FunctionName, req.BlockInput, req.Backpack)
  result, backpack, err = lambdaRuntime.Run()
  if err != nil {
    return resp, err
  }

  resp.Result = result
  resp.Backpack = backpack
  return resp, err
}

func main() {
  log.SetFlags(log.Lshortfile)

  log.Println("Starting runtime...")

  lambdaEnv := os.Getenv("LAMBDA_CALLER")
  switch lambdaEnv {
  case "API_GATEWAY":
    lambda.Start(HandleRequestApiGateway)
  default:
    lambda.Start(HandleRequest)
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #549** (2022-04-19): **Fix bad Lint config and run a format**
  *Symptoms*: This PR also: - Updates the BSL date in the license - Removes extra files that were committed while moving the LunaDefend demo apps

- **Issue #459** (2022-06-04): **Make Oathkeeper frontend routes less fragile**
  *Symptoms*: Oathkeeper routes can break in certain situations because the regex could colide with a legit route

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

### Incident Patch 1: `c6bb0762` (2024-05-02)
**Commit Message**: Update BSL-LunaTrace.txt

**File**: `licenses/BSL-LunaTrace.txt` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ Additional Use Grant: Your company** may make production use of the Licensed Wor
                       files, permissions management settings, or other schemas
                       are controlled by such third parties.
 
-Change Date:          2025-05-01
+Change Date:          2024-05-01
 
 Change License:       Apache License, Version 2.0
 
```

---

### Incident Patch 2: `fc99f315` (2023-03-29)
**Commit Message**: Fix build error

**File**: `docs/blog/2023-03-29-cerebras-gpt-vs-llama-ai-model-comparison.mdx` (modified, +3/-3)
```diff
@@ -52,7 +52,7 @@ building.
 <figcaption style={{fontSize:'small', color:'grey'}}>A comparison of "one" Cerebras chip compared to an NVIDIA V100
     chip.
 </figcaption>
-<br>
+<br/>
 
 <!--truncate-->
 
@@ -97,7 +97,7 @@ strict security requirements, foreign governments, or just people that want to h
     this table on
     <a href="https://github.com/lunasec-io/lunasec/tree/master/docs/blog" target="_blank">GitHub here</a>.
 </figcaption>
-<br>
+<br/>
 It's a bit difficult to compare apples-to-apples between all of these different models, but I did my best to squeeze
 the data together in a way that made it easier to understand.
 
@@ -109,7 +109,7 @@ requires using knowledge that isn't included in the question anywhere).
 ![open your wallet discord message](/img/blog/chat-gpt-bad-math.png)
 <figcaption style={{fontSize:'small', color:'grey'}}>But even the mighty ChatGPT often can't do simple math</figcaption>
 
-<br>
+<br/>
 
 ...and then there is GPT-4 crushing everything else in this table!
 
```

---

### Incident Patch 3: `07f44d7a` (2023-03-29)
**Commit Message**: Fix more typos

**File**: `docs/blog/2023-03-29-cerebras-gpt-vs-llama-ai-model-comparison.mdx` (modified, +12/-7)
```diff
@@ -52,6 +52,7 @@ building.
 <figcaption style={{fontSize:'small', color:'grey'}}>A comparison of "one" Cerebras chip compared to an NVIDIA V100
     chip.
 </figcaption>
+<br>
 
 <!--truncate-->
 
@@ -72,8 +73,8 @@ intentionally limited how long the model was trained in order to reach a "traini
 
 That doesn't mean that it's useless though. As you'll see from the data released in the Cerebras paper, this model
 is still a welcome addition to the available Open Source models like [GPT-2 (1.5B)](https://huggingface.co/gpt2),
-[GPT-J (6B)]
-(https://huggingface.co/EleutherAI/gpt-j-6B), and [GPT NeoX (20B)](https://huggingface.co/EleutherAI/gpt-neox-20b).
+[GPT-J (6B)](https://huggingface.co/EleutherAI/gpt-j-6B), and
+[GPT NeoX (20B)](https://huggingface.co/EleutherAI/gpt-neox-20b).
 It's also possible that the model can improve with additional tweaking by the community (like fine-tuning or
 creating LORAs for it.)
 
@@ -89,12 +90,14 @@ strict security requirements, foreign governments, or just people that want to h
 | GPT-3 (175B) | 175B   | 78.9       | 81.0  | 70.2        | 75.0    | 68.8  | 51.4  | 57.6       | 60.5  | 81.0 |
 | GPT-4 (?B)   | ?      | 95.3       | -     | 87.3        | -       | -     | 96.3     | -          | -     | -    |
 | LLaMA (13B)  | 13B    | 79.2       | 80.1  | 73.0        | -       | 74.8  | 52.7  | 56.4       | 78.1  | 50.4 |
-| LLaMA (60B)  | -      | 84.2       | 82.8  | 77.0        | -       | 78.9  | 56.0  | 60.2       | 76.5  | 52.3 |
+| LLaMA (60B)  | 60B    | 84.2       | 82.8  | 77.0        | -       | 78.9  | 56.0  | 60.2       | 76.5  | 52.3 |
 | GPT-J (6B)   | 6B     | 66.1       | 76.5  | 65.3        | 69.7    | -     | -     | -          | -     | -    |
 | GPT-NeoX-20B | 20B    | -          | 77.9  | ~67.0       | 72.0    | ~72.0 | ~39.0 | ~31.0      | -     | -    |
 <figcaption style={{fontSize:'small', color:'grey'}}>If you'd like to add data for another model, you can edit
-    this table on [GitHub here](https://github.com/lunasec-io/lunasec/tree/master/docs/blog).</figcaption>
-
+    this table on
+    <a href="https://github.com/lunasec-io/lunasec/tree/master/docs/blog" target="_blank">GitHub here</a>.
+</figcaption>
+<br>
 It's a bit difficult to compare apples-to-apples between all of these different models, but I did my best to squeeze
 the data together in a way that made it easier to understand.
 
@@ -106,12 +109,14 @@ requires using knowledge that isn't included in the question anywhere).
 ![open your wallet discord message](/img/blog/chat-gpt-bad-math.png)
 <figcaption style={{fontSize:'small', color:'grey'}}>But even the mighty ChatGPT often can't do simple math</figcaption>
 
+<br>
+
 ...and then there is GPT-4 crushing everything else in this table!
 
 ## Is Cerebras-GPT worth using?
 
-Based on the data above, it's not really much better than any existing OSS models, so it's hard to say if it's a
-better choice than GPT-J or GPT NeoX for any tasks. Perhaps with some fine-tuning the model may be able to perform
+Based on the data above it's not really better than any existing OSS models so it's hard to say if it's a
+better choice than GPT-J, GPT NeoX, or other AI models for any tasks. Perhaps with some fine-tuning the model may be able to perform
 better than either of those, but I'll let somebody more qualified than me answer that question instead!
 
 ## Want to learn more?
```

---

### Incident Patch 4: `38292651` (2023-03-22)
**Commit Message**: fix vulnbot

**File**: `lunatrace/bsl/ingest-worker/pkg/vulnbot/vulnbot.go` (modified, +13/-1)
```diff
@@ -1,3 +1,14 @@
+// Copyright by LunaSec (owned by Refinery Labs, Inc)
+//
+// Licensed under the Business Source License v1.1 
+// (the "License"); you may not use this file except in compliance with the
+// License. You may obtain a copy of the License at
+//
+// https://github.com/lunasec-io/lunasec/blob/master/licenses/BSL-LunaTrace.txt
+//
+// See the License for the specific language governing permissions and
+// limitations under the License.
+//
 package vulnbot
 
 import (
@@ -79,7 +90,8 @@ func (v *vulnbot) messageHandler(ctx context.Context, info discordfx.MessageInfo
 			log.Error().Err(err).Msg("error processing message")
 			return
 		}
-		_, err = s.ChannelMessageSend(m.ChannelID, resp.Response)
+		// TODO: make this also show the intermediate steps in a collapsed box in discord (resp.IntermediateSteps). Bonus points if we can figure out how to preserve coloring
+		_, err = s.ChannelMessageSend(m.ChannelID, resp.FinalAnswer)
 		if err != nil {
 			log.Error().Err(err).Msg("error sending message")
 			return
```

---

### Incident Patch 5: `f2959c97` (2023-03-19)
**Commit Message**: fix broken import

**File**: `lunatrace/bsl/ml/python/chat_bot/tools/scrape.py` (modified, +2/-2)
```diff
@@ -15,7 +15,7 @@
 import sys
 from urllib.parse import urlparse
 
-from scrape_utils.clean_scraped_advisories import clean
+from scrape_utils.summarize_scraped import summarize
 
 # you seem to have to do this horrible stuff to import from higher local folders in python.
 # remove this once we find a better way
@@ -73,7 +73,7 @@ def _run(self, inputs: str) -> str:
 		text = self._text_from_html(page.content)
 		links = self._links_from_html(page.content)
 		text_and_links = text + " Here are the links we scraped from this page:" + str(links)
-		cleaned_text = clean(text_and_links, query)
+		cleaned_text = summarize(text_and_links, query)
 		return cleaned_text
 
 
```

---

### Incident Patch 6: `ea39bfbc` (2023-03-19)
**Commit Message**: fix some broken changes that came in

**File**: `.idea/lunasec-monorepo.iml` (modified, +2/-2)
```diff
@@ -75,7 +75,7 @@
       <excludeFolder url="file://$MODULE_DIR$/lunatrace/bsl/ingest-worker/vulns" />
     </content>
     <content url="file://$MODULE_DIR$/lunatrace/bsl/backend/api/node_modules" />
-    <orderEntry type="jdk" jdkName="Pipenv (lunasec)" jdkType="Python SDK" />
+    <orderEntry type="inheritedJdk" />
     <orderEntry type="sourceFolder" forTests="false" />
   </component>
-</module>
\ No newline at end of file
+</module>
```

**File**: `.idea/misc.xml` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@
     <option name="enabled" value="true" />
     <option name="wasEnabledAtLeastOnce" value="true" />
   </component>
-  <component name="ProjectRootManager" version="2" languageLevel="JDK_10" project-jdk-name="Pipenv (lunasec)" project-jdk-type="Python SDK">
+  <component name="ProjectRootManager" version="2" languageLevel="JDK_10" project-jdk-name="Python 3.10 (2)" project-jdk-type="Python SDK">
     <output url="file://$PROJECT_DIR$/out" />
   </component>
   <component name="ProjectType">
@@ -20,4 +20,4 @@
   <component name="WebPackConfiguration">
     <option name="mode" value="DISABLED" />
   </component>
-</project>
\ No newline at end of file
+</project>
```

**File**: `lunatrace/bsl/ml/python/chat_bot/tools/scrape.py` (modified, +2/-3)
```diff
@@ -15,7 +15,7 @@
 import sys
 from urllib.parse import urlparse
 
-from scrape_utils.clean_scraped_advisories import clean
+from scrape_utils.summarize_scraped import summarize
 
 # you seem to have to do this horrible stuff to import from higher local folders in python.
 # remove this once we find a better way
@@ -65,15 +65,14 @@ def validate_environment(cls, values: Dict) -> Dict:
 	def _run(self, inputs: str) -> str:
 		"""Run query through GoogleSearch and parse result."""
 		# return self._google_serper_search_results(query, gl=self.gl, hl=self.hl)
-
 		url, query = json.loads(inputs)
 		page = requests.get(url)
 		if "text/html" not in page.headers["content-type"]:
 			return "This isn't a normal html page, try a different page"
 		text = self._text_from_html(page.content)
 		links = self._links_from_html(page.content)
 		text_and_links = text + " Here are the links we scraped from this page:" + str(links)
-		cleaned_text = clean(text_and_links, query)
+		cleaned_text = summarize(text_and_links, query)
 		return cleaned_text
 
 
```

**File**: `lunatrace/bsl/ml/python/scrape_utils/summarize_scraped.py` (modified, +1/-2)
```diff
@@ -68,13 +68,12 @@ def run_llm(page_content, existing_body, query):
 	return raw_result
 
 def summarize(page_content, query):
-
 	content_splitter = TokenTextSplitter(chunk_size=2200, chunk_overlap=40)
 	split_content = content_splitter.split_text(page_content)
 	if (len(split_content)) > 8:
 		return "This page is too long to read quickly, try something else."
 	existing_body = " "
-	print("split page content into chunks: " + str(len(split_content)))
+	print("\nsplit page content into chunks: " + str(len(split_content)))
 	for content in split_content:
 		existing_body = existing_body + run_llm(content, existing_body, query)
 
```

**File**: `lunatrace/bsl/proto/langchain.proto` (modified, +14/-13)
```diff
@@ -4,8 +4,8 @@ package langchain;
 option go_package = "./gen";
 
 service LangChain {
-  rpc Summarize(SummarizeRequest) returns (SummarizeResponse);
-  rpc CleanWebpage(CleanWebpageRequest) returns (CleanWebpageResponse);
+//  rpc Summarize(SummarizeRequest) returns (SummarizeResponse);
+  rpc CleanAdvisory(CleanAdvisoryRequest) returns (CleanAdvisoryResponse);
   rpc Chat(ChatRequest) returns (ChatResponse);
 }
 
@@ -14,23 +14,24 @@ message ChatRequest {
 }
 
 message ChatResponse {
-  string response = 1;
+  string finalAnswer = 1;
+  string intermediateSteps = 2;
 }
 
-message CleanWebpageRequest {
+message CleanAdvisoryRequest {
   string content = 1;
   string description = 2;
 }
 
-message CleanWebpageResponse {
+message CleanAdvisoryResponse {
   string content = 1;
 }
 
-message SummarizeRequest {
-  string content = 1;
-  string query = 2;
-}
-
-message SummarizeResponse {
-  string summary = 1;
-}
+//message SummarizeRequest {
+//  string content = 1;
+//  string query = 2;
+//}
+//
+//message SummarizeResponse {
+//  string summary = 1;
+//}
```

---

### Incident Patch 7: `1d4923f0` (2023-02-23)
**Commit Message**: fix the tsconfig to not have extra junk

**File**: `lunatrace/bsl/backend/tsconfig.json` (modified, +1/-8)
```diff
@@ -17,7 +17,7 @@
     "strict": true /* Enable all strict type-checking options. */,
     "esModuleInterop": true,  /* Enables emit interoperability between CommonJS and ES Modules via creation of namespace objects for all imports. Implies 'allowSyntheticDefaultImports'. */
     "resolveJsonModule": true /* Include modules imported with .json extension. */,
-    "skipLibCheck": true, // todo: This may be a bit dangerous but it fixes a bug from duplicate types 
+    "skipLibCheck": true, // todo: This may be a bit dangerous but it fixes a bug from duplicate types
     "forceConsistentCasingInFileNames": true,
     "allowJs": true,
 
@@ -51,13 +51,6 @@
     "src/__tests__",
     "./src/**/*",
   ],
-
-  "exclude": [
-    "node_modules",
-    "typings",
-    "../../../node_modules"
-  ]
-,
   "references": [
     {"path": "../common"},
     {"path": "../logger"}
```

---

### Incident Patch 8: `ba5ce0d1` (2023-02-10)
**Commit Message**: Commit baseline fixture



---

### Incident Patch 9: `97f593ac` (2023-02-08)
**Commit Message**: Merge pull request #1110 from lunasec-io/fix-light-theme

fix light background

**File**: `lunatrace/bsl/frontend/src/scss/pages/_project.scss` (modified, +1/-1)
```diff
@@ -63,5 +63,5 @@
   padding-right: 4px;
   padding-left: 4px;
   margin-left: 20px;
-  background-color: $dark-theme-base;
+  background-color: $card-bg;
 }
```

---

### Incident Patch 10: `48865c93` (2023-02-08)
**Commit Message**: fix light background

**File**: `lunatrace/bsl/frontend/src/scss/pages/_project.scss` (modified, +1/-1)
```diff
@@ -63,5 +63,5 @@
   padding-right: 4px;
   padding-left: 4px;
   margin-left: 20px;
-  background-color: $dark-theme-base;
+  background-color: $card-bg;
 }
```

#### Recent Merged Pull Requests:
- **PR #1167** (closed): Create asdf (@santysanthoshraj)
- **PR #1166** (2023-10-18): Update authors.yml (@ajvpot)
- **PR #1164** (2023-04-18): LunaSec becomes LunaBrain pivot blog post (@freeqaz)
- **PR #1163** (2023-04-06): Update LLaMA's bechmark results (@vinhkhuc)
- **PR #1161** (2023-03-29): Cerebras vs LLaMA blog post (@freeqaz)
- **PR #1160** (2023-04-06): update blog post based on new reporting (@factoidforrest)
- **PR #1159** (2023-03-25): draft post openai (@factoidforrest)
- **PR #1158** (2023-03-19): Regenerate files for ml-refinement (@github-actions[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): nitrictech/nitric

> **Canonical Artifact**: `07_PROJECT_LEARNING/nitrictech-nitric-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nitrictech/nitric](https://github.com/nitrictech/nitric))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:13:56.343Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nitrictech/nitric`
- **Description**: Nitric is a multi-language framework for cloud applications with infrastructure from code.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2017 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cloud/aws/cmd/deploy/main.go`
```
// Copyright Nitric Pty Ltd.
//
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"github.com/nitrictech/nitric/cloud/aws/common/runtime"
	"github.com/nitrictech/nitric/cloud/aws/deploy"
	"github.com/nitrictech/nitric/cloud/common/deploy/provider"
)

// Start the deployment server
func main() {
	awsStack := deploy.NewNitricAwsProvider()

	providerServer := provider.NewPulumiProviderServer(awsStack, runtime.NitricAwsRuntime)

	providerServer.Start()
}

```

### Core Architecture Module: `cloud/aws/cmd/deploytf/main.go`
```
// Copyright Nitric Pty Ltd.
//
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"github.com/nitrictech/nitric/cloud/aws/common/runtime"
	"github.com/nitrictech/nitric/cloud/aws/deploytf"
	"github.com/nitrictech/nitric/cloud/common/deploy/provider"
)

// Start the deployment server
func main() {
	// os.Setenv("JSII_SILENCE_WARNING_UNTESTED_NODE_VERSION", "true")
	// os.Setenv("SYNTH_HCL_OUTPUT", "true")
	awsStack := deploytf.NewNitricAwsProvider()

	providerServer := provider.NewTerraformProviderServer(awsStack, runtime.NitricAwsRuntime)

	// Start the terraform provider server
	providerServer.Start()
}

```

### Core Architecture Module: `cloud/aws/cmd/runtime/main.go`
```
// Copyright 2021 Nitric Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"github.com/nitrictech/nitric/cloud/aws/runtime"
	"github.com/nitrictech/nitric/cloud/aws/runtime/env"
	"github.com/nitrictech/nitric/cloud/aws/runtime/resource"
	"github.com/nitrictech/nitric/core/pkg/logger"
	"github.com/nitrictech/nitric/core/pkg/server"
)

func main() {
	var resolver resource.AwsResourceResolver
	var err error

	resolver, err = resource.NewSSMResourceResolver()

	if env.NITRIC_AWS_RESOURCE_RESOLVER.String() == "tagging" {
		resolver, err = resource.NewTaggedResourceResolver()
	}

	if err != nil {
		logger.Fatalf("could not create aws resource resolver: %v", err)
		return
	}

	m, err := runtime.NewAwsRuntimeServer(resolver)
	if err != nil {
		logger.Fatalf("there was an error initializing the AWS runtime server: %v", err)
	}

	server.Run(m)
}

```

### Core Architecture Module: `cloud/aws/common/batch.go`
```
// Copyright 2021 Nitric Technologies Pty Ltd.
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

package common

import (
	"fmt"
)

func GetJobDefinitionName(stackId string, jobName string) (string, error) {
	return fmt.Sprintf("%s-job-%s", stackId, jobName), nil
}

```

### Core Architecture Module: `cloud/aws/common/config.go`
```
// Copyright Nitric Pty Ltd.
//
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package common

import (
	"github.com/imdario/mergo"
	"github.com/mitchellh/mapstructure"
	"github.com/nitrictech/nitric/cloud/common/deploy/config"
)

type AwsApiConfig struct {
	Description string
	Domains     []string
}

type AwsCdnConfig struct {
	Domain                string
	SkipCacheInvalidation bool `mapstructure:"skip-cache-invalidation"`
}

type AwsImports struct {
	// A map of nitric names to ARNs
	Secrets map[string]string
	Buckets map[string]string
}

type EcsLaunchTemplate struct {
	BlockDeviceMappings []struct {
		DeviceName string `mapstructure:"device-name,omitempty"`
		Ebs        struct {
			DeleteOnTermination string `mapstructure:"delete-on-termination,omitempty"`
			VolumeSize          int    `mapstructure:"volume-size,omitempty"`
			VolumeType          string `mapstructure:"volume-type,omitempty"`
		} `mapstructure:"ebs,omitempty"`
	} `mapstructure:"block-device-mappings,omitempty"`
}

type BatchComputeEnvConfig struct {
	MinCpus        int                `mapstructure:"min-cpus"`
	MaxCpus        int                `mapstructure:"max-cpus"`
	InstanceTypes  []string           `mapstructure:"instance-types"`
	LaunchTemplate *EcsLaunchTemplate `mapstructure:"launch-template,omitempty"`
}

type AuroraRdsClusterConfig struct {
	MinCapacity           float64 `mapstructure:"min-capacity"`
	MaxCapacity           float64 `mapstructure:"max-capacity"`
	SecondsUntilAutoPause *int    `mapstructure:"seconds-until-auto-pause"`
}

type AwsConfig struct {
	ScheduleTimezone                      string `mapstructure:"schedule-timezone,omitempty"`
	Import                                AwsImports
	Refresh                               bool
	Apis                                  map[string]*AwsApiConfig
	Cdn                                   *AwsCdnConfig           `mapstructure:"cdn,omitempty"`
	BatchComputeEnvConfig                 *BatchComputeEnvConfig  `mapstructure:"batch-compute-env,omitempty"`
	AuroraRdsClusterConfig                *AuroraRdsClusterConfig `mapstructure:"aurora-rds-cluster,omitempty"`
	config.AbstractConfig[*AwsConfigItem] `mapstructure:"config,squash"`
}

type AwsConfigItem struct {
	Lambda    *AwsLambdaConfig `mapstructure:",omitempty"`
	Telemetry int
}

type AwsLambdaVpcConfig struct {
	SubnetIds        []string `mapstructure:"subnet-ids"`
	SecurityGroupIds []string `mapstructure:"security-group-ids"`
}

type AwsLambdaConfig struct {
	Memory                int
	Timeout               int
	EphemeralStorage      int                 `mapstructure:"ephemeral-storage"`
	ProvisionedConcurreny int                 `mapstructure:"provisioned-concurrency"`
	Vpc                   *AwsLambdaVpcConfig `mapstructure:"vpc,omitempty"`
}

var defaultLambdaConfig = &AwsLambdaConfig{
	Memory:                128,
	Timeout:               15,
	EphemeralStorage:      512,
	ProvisionedConcurreny: 0,
}

var defaultBatchComputeEnvConfig = &BatchComputeEnvConfig{
	MinCpus:        0,
	MaxCpus:        32,
	InstanceTypes:  []string{"optimal"},
	LaunchTemplate: nil,
}

var defaultAuroraRdsClusterConfig = &AuroraRdsClusterConfig{
	MinCapacity: 0.5,
	MaxCapacity: 1,
}

var defaultCdnConfig = &AwsCdnConfig{
	Domain:                "",
	SkipCacheInvalidation: false,
}

var defaultAwsConfigItem = AwsConfigItem{
	Telemetry: 0,
}

// Return AwsConfig from stack attributes
func ConfigFromAttributes(attributes map[string]interface{}) (*AwsConfig, error) {
	// get config attributes
	err := config.ValidateRawConfigKeys(attributes, []string{"lambda"})
	if err != nil {
		return nil, err
	}

	awsConfig := &AwsConfig{}
	err = mapstructure.Decode(attributes, awsConfig)
	if err != nil {
		return nil, err
	}

	// Default timezone if not specified
	if awsConfig.ScheduleTimezone == "" {
		// default to UTC
		awsConfig.ScheduleTimezone = "UTC"
	}

	if awsConfig.Apis == nil {
		awsConfig.Apis = map[string]*AwsApiConfig{}
	}

	if awsConfig.Config == nil {
		awsConfig.Config = map[string]*AwsConfigItem{}
	}

	if awsConfig.Cdn == nil {
		awsConfig.Cdn = defaultCdnConfig
	}

	// if no default then set provider level defaults
	if _, hasDefault := awsConfig.Config["default"]; !hasDefault {
		awsConfig.Config["default"] = &defaultAwsConfigItem
		awsConfig.Config["default"].Lambda = defaultLambdaConfig
	}

	if awsConfig.BatchComputeEnvConfig == nil {
		awsConfig.BatchComputeEnvConfig = defaultBatchComputeEnvConfig
	}

	// merge in default values
	err = mergo.Merge(awsConfig.BatchComputeEnvConfig, defaultBatchComputeEnvConfig)
	if err != nil {
		return nil, err
	}

	if awsConfig.AuroraRdsClusterConfig == nil {
		awsConfig.AuroraRdsClusterConfig = defaultAuroraRdsClusterConfig
	}

	for configName, configVal := range awsConfig.Config {
		// Add omitted values from default configs where needed.
		err := mergo.Merge(configVal, defaultAwsConfigItem)
		if err != nil {
			return nil, err
		}

		if configVal.Lambda == nil { // check if no runtime config provided, default to Lambda.
			configVal.Lambda = defaultLambdaConfig
		} else {
			err := mergo.Merge(configVal.Lambda, defaultLambdaConfig)
			if err != nil {
				return nil, err
			}
		}

		awsConfig.Config[configName] = configVal
	}

	return awsConfig, nil
}

```

### Core Architecture Module: `cloud/aws/common/const.go`
```
// Copyright Nitric Pty Ltd.
//
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package common

const (
	// DefaultWsStageName - Also used to connect to the ws, e.g. wss://<api-id>.execute-api.<region>.amazonaws.com/<stage>
	DefaultWsStageName = "ws"
)

```

### Core Architecture Module: `cloud/aws/common/index.go`
```
// Copyright 2021 Nitric Technologies Pty Ltd.
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

package common

// AwsResourceName - Provides a type hint for the mapping of Nitric resource names to AWS resource names
type AwsResourceName = string

// AwsResourceArn - Provides a type hint for the mapping of Nitric resource names to AWS resource ARNs
type AwsResourceArn = string

type ApiGateway struct {
	Arn      string `json:"arn"`
	Endpoint string `json:"endpoint"`
}

type Topic struct {
	Arn             string `json:"arn"`
	StateMachineArn string `json:"stateMachineArn"`
}

// ResourceIndex - The resource index for a nitric stack
type ResourceIndex struct {
	Buckets     map[string]AwsResourceArn `json:"buckets"`
	Topics      map[string]Topic          `json:"topics"`
	KvStores    map[string]AwsResourceArn `json:"kvStores"`
	Queues      map[string]AwsResourceArn `json:"queues"`
	Secrets     map[string]AwsResourceArn `json:"secrets"`
	Apis        map[string]ApiGateway     `json:"apis"`
	HttpProxies map[string]ApiGateway     `json:"httpProxies"`
	Websockets  map[string]ApiGateway     `json:"websockets"`
	Schedules   map[string]AwsResourceArn `json:"schedules"`
}

func NewResourceIndex() *ResourceIndex {
	return &ResourceIndex{
		Buckets:     make(map[string]AwsResourceName),
		Topics:      make(map[string]Topic),
		KvStores:    make(map[string]AwsResourceArn),
		Queues:      make(map[string]AwsResourceArn),
		Secrets:     make(map[string]AwsResourceArn),
		Apis:        make(map[string]ApiGateway),
		HttpProxies: make(map[string]ApiGateway),
		Websockets:  make(map[string]ApiGateway),
		Schedules:   make(map[string]AwsResourceArn),
	}
}

```

### Core Architecture Module: `cloud/aws/common/resources/domain.go`
```
// Copyright 2021 Nitric Technologies Pty Ltd.
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

package resources

import (
	"context"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/route53"
)

type ZoneLookup struct {
	// The domain that matched the Hosted Zone lookup
	Domain string
	// The Hosted Zone ID
	ZoneID string
	// If the zone matched the domain (false) or matched the parent (true)
	IsParent bool
}

func GetARecordLabel(zoneLookup *ZoneLookup) string {
	if !zoneLookup.IsParent {
		return ""
	}

	return getSubdomainLabel(zoneLookup.Domain)
}

func getSubdomainLabel(domain string) string {
	domainParts := strings.Split(domain, ".")
	if len(domainParts) > 2 {
		return domainParts[0]
	}

	return ""
}

func GetZoneID(domainName string) (*ZoneLookup, error) {
	zoneIds := GetZoneIDs([]string{domainName})
	if zoneIds[domainName] == nil {
		return nil, fmt.Errorf("zone ID not found for domain name: %s", domainName)
	}

	return zoneIds[domainName], nil
}

func GetZoneIDs(domainNames []string) map[string]*ZoneLookup {
	ctx := context.TODO()

	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion("us-west-2"))
	if err != nil {
		return nil
	}

	client := route53.NewFromConfig(cfg)

	zoneMap := make(map[string]*ZoneLookup)

	normalizedDomains := make(map[string]string)
	for _, d := range domainNames {
		d = strings.ToLower(strings.TrimSuffix(d, "."))
		normalizedDomains[d] = d + "."
	}

	paginator := route53.NewListHostedZonesPaginator(client, &route53.ListHostedZonesInput{})
	hostedZones := make(map[string]string) // map of zone name -> zone ID

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil
		}

		for _, hz := range page.HostedZones {
			name := strings.ToLower(strings.TrimSuffix(*hz.Name, "."))
			hostedZones[name] = strings.TrimPrefix(*hz.Id, "/hostedzone/")
		}
	}

	// Resolve each domain name
	for domain, normalized := range normalizedDomains {
		// Check full domain
		if id, ok := hostedZones[strings.TrimSuffix(normalized, ".")]; ok {
			zoneMap[domain] = &ZoneLookup{
				Domain:   domain,
				ZoneID:   id,
				IsParent: false,
			}
			continue
		}

		// Try parent/root domain
		parts := strings.Split(domain, ".")
		if len(parts) > 2 {
			root := strings.Join(parts[1:], ".")
			if id, ok := hostedZones[root]; ok {
				zoneMap[domain] = &ZoneLookup{
					Domain:   domain,
					ZoneID:   id,
					IsParent: true,
				}
				continue
			}
		}

		zoneMap[domain] = nil
	}

	return zoneMap
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #908** (2026-02-05): **v1.27.5 is missing AWS binaries**
  *Symptoms*: ## Bug Report  ### Issue  Release v1.27.5 is missing all AWS provider binaries (`aws_*` and `awstf_*`). Attempting to deploy with `nitric/aws@1.27.5` or `nitric/awstf@1.27.5` fails with a 404 error when downloading the provider binary.  Previous releases (v1.27.0 through v1.27.4) all include AWS binaries. The v1.27.5 release only contains `azuretf`, `gcptf`, and `gcp` provider binaries.  ### Steps  1. Create a new Nitric project: `nitric new myproject ts-starter` 2. Create an AWS stack: `nitric stack new dev aws` 3. The generated `nitric.dev.yaml` defaults to `provider: nitric/aws@1.27.5` 4. Run `nitric up` 5. Error: `error downloading file https://github.com/nitrictech/nitric/releases/download/v1.27.5/aws_darwin_arm64.tar.gz (bad response code: 404)`  Same issue occurs with `nitric/awstf@1.27.5`: ``` error downloading file https://github.com/nitrictech/nitric/releases/download/v1.27.5/awstf_darwin_arm64.tar.gz (bad response code: 404) ```  ### Expected  v1.27.5 should include AWS provider binaries, or the CLI/stack generator should not default to a version that doesn't exist.  ### Environment and setup information  - Nitric CLI Version: 1.61.1 - Operating System: macOS Darwin 23.6.0 (Apple Silicon / arm64) - Nitric dependencies and their versions: `@nitric/sdk": "^1.3.3` - Cloud providers you are deploying to and their version: `nitric/awstf@1.27.5` (fails), `nitric/awstf@1.27.4` (works)  ### Other info  Verified by checking GitHub releases API:  | Version | AWS binaries pre
  **Post-Mortem & Fix Analysis**:
  > Hi @NaheleMoon ,  Thanks for flagging this. The issue has been fixed in [v1.27.6](https://github.com/nitrictech/nitric/releases/tag/v1.27.6), which includes all AWS binaries. Please use nitric/aws@1.27.6 and nitric/awstf@1.27.6 going forward.

- **Issue #817** (2025-06-13): **AWS credentials load fail**
  *Symptoms*: ## Bug Report  ### Issue  Hi team, I faced a wired issue. I want to deploy to AWS but show error `error: missing google credentials: unable to find gcp credentials: google: could not find default credentials. See                  https://cloud.google.com/docs/authentication/external/set-up-adc for more information`   I guess the reason is on my local environment the AWS cli config is empty `~/.aws/credentials`, because my AWS  credentials is from other cli to setup temporary credentials environment variable, like okta provider: `aws-okta nitric up`. And I also tried store temporary credentials in env file and pass to nitric by `nitric up -e aws.env`, but still now working.  ### Steps  Steps to reproduce the behavior:  <!-- screenshots or code snippets are appreciated. -->  1. Follow [quickstart](https://nitric.io/docs/get-started/quickstart?lang=python) page setup demo  2. Create new stack `nitric stack new` 3. Set region in `nitric.dev.yaml`, and ensure `provider: nitric/aws@1.27.1` 4. Run nitric up, see error  <img width="968" alt="Image" src="https://github.com/user-attachments/assets/c76040fc-509d-41be-b2e2-a6b0ae04dbbf" />  ### Expected  1. If using AWS provider expected AWS related error. 2. Allow read AWS credential from environment variable.  ### Environment and setup information  - Nitric CLI Version: 1.61.0 - Operating System: macos 15.5 - Nitric dependencies and their versions, such as SDKs or Middleware: - Cloud providers you are deploying to and their version: ni
  **Post-Mortem & Fix Analysis**:
  > Hi @abriko, I'm not sure this is related to missing AWS credentials, the message "failed to select stack" seems more likely to be an error coming from Pulumi, which is the IaC solution used in the `nitric/aws` provider.  The missing google credentials error suggests Pulumi might be looking for stack state on a Google Cloud Storage bucket, but is missing the credentials needed to access it.  Have you ever logged into Pulumi previously using a command like this:  ```bash pulumi login gs://<my-pulumi-state-bucket> ```  Logging into a different Pulumi state store or logging into gcloud again locally (e.g. `gcloud auth application-default login`) might be enough to resolve this error.  Then so long as you provide the AWS credentials in one of the standard methods supported by AWS the deployment should continue. If that doesn't resolve the issue for you let us know.  [Nitric Docs: How Nitric integrates with Pulumi](https://nitric.io/docs/providers/pulumi#how-nitric-integrates-with-pulumi) [P
  > Hi @jyecusch Thanks for your detailed response. You are right my last pulumi project using google storage to store state. This issue gone by execute:  ``` pulumi login -l ```   Thanks you help again.

- **Issue #792** (2025-04-29): **Role policy assignment names are not unique to the resource name in azure terraform**
  *Symptoms*: ## Bug Report  ### Issue  Should be able to define two or more roles in a service, for example.   Two topic publish roles with different names.  ### Expected  Should not error. 
  **Post-Mortem & Fix Analysis**:
  > :tada: This issue has been resolved in version 1.25.6 :tada:  The release is available on [GitHub release](https://github.com/nitrictech/nitric/releases/tag/v1.25.6)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #791** (2025-04-29): **The stack_id is used incorrectly by tags in azure terraform**
  *Symptoms*: ## Bug Report  ### Issue  There is an inconsistency with the use of variable stack_id within the terraform stack tags, this causes resource lookups to fail (such as topics). It also makes it confusing due it being called `stack_name` this needs to be changed.  ### Steps  Deploy an app with a topic and an api to trigger it.  ### Expected  Should not error with topic not found.
  **Post-Mortem & Fix Analysis**:
  > :tada: This issue has been resolved in version 1.25.7 :tada:  The release is available on [GitHub release](https://github.com/nitrictech/nitric/releases/tag/v1.25.7)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #760** (2025-03-27): **Azure pulumi websites - dependency bug with origin groups and rules**
  *Symptoms*: ## Bug Report  ### Issue  There is a circular dependency between origin groups and the rule that overrides the group used. This is an issue in the azure api for endpoints.  ### Potential Solutions  1. Replace the entire endpoint on api changes, not a good solution as this would cause downtime and is slower to deploy.  2. We can create a new api as a proxy, then simply have one additional origin group for all apis. This way api changes won't affect the endpoint.  ### Solution  I will fix this using solution number 2. I used this solution in the new terraform provider for azure and it worked well.
  **Post-Mortem & Fix Analysis**:
  > This has been released with https://github.com/nitrictech/nitric/pull/761

- **Issue #736** (2025-02-28): **Policy assignment conflicts in Azure**
  *Symptoms*: ## Bug Report  ### Issue Duplicate error with role assignment names in azure pulumi. For example, two buckets with same permissions in service breaks it.  I checked pulumi, but we should check tf as well.  ### Expected  Should dedupe / merge them. 
  **Post-Mortem & Fix Analysis**:
  > :tada: This issue has been resolved in version 1.17.3 :tada:  The release is available on [GitHub release](https://github.com/nitrictech/nitric/releases/tag/v1.17.3)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #712** (2025-01-13): **Database migration container images failing to build doesn't cause `nitric up` to fail**
  *Symptoms*: ## Bug Report  ### Issue  <!-- A clear and concise description of what the bug is. What happened? -->  If there is an error in a custom dockerfile [used for database migrations](https://nitric.io/docs/sql?lang=python#docker-container) `nitric up` will still continue with the deployment.  Failed builds need to halt the deployment and return the error details from the build process.
  **Post-Mortem & Fix Analysis**:
  > This is still an issue in `--ci` mode on v1.56.5. In interactive mode it exits correctly.

- **Issue #692** (2024-12-16): **CLI failing to connect to provider (nitric/awstf@1.14.0)**
  *Symptoms*: ## Feature Request  ### Suggestion  Support development with the `nitric` CLI on machines with a network configuration that requires usage of an explicit web proxy. Typically, such a proxy is configured with environment variables `HTTP_PROXY`, `HTTPS_PROXY` and `no_proxy`.  Currently, with Docker Desktop on Apple Silicon in such an environment, `nitric up` fails with `error   failed to connect to provider: context deadline exceeded`  ### Value  In corporate setups, explicit web proxies are unfortunately not uncommon. This requires correct configuration of all client machines, including development machines, and all web browsers. Nitric development should just work on a development machine configured like that.  Docker Desktop in itself works without issues in the presence of explicit web proxies.  ### Alternatives  Podman instead of Docker Desktop might work in such a setting?  ### Other info  Complete output of `nitric up`:  ``` nitric up --ci building project services service matched 'services/hello.ts', auto-naming this service 'hello-nitric_services-hello' hello-nitric_services-hello [In Progress]: #0 building with "nitric" instance using docker-container driver hello-nitric_services-hello [In Progress]: hello-nitric_services-hello [In Progress]: #1 [internal] load build definition from hello-nitric_services-hello-922928650.dockerfile hello-nitric_services-hello [In Progress]: #1 transferring dockerfile: 1.87kB done hello-nitric_services-hel
  **Post-Mortem & Fix Analysis**:
  > It looks this error is caused by either the `nitric/awstf` provider failing to start or the two processes failing to communicate. We may want to add more output to the provider/CLI to show any other details about why it failed.
  > We've also seen other instances of this issue: https://discord.com/channels/955259353043173427/1285193296850845800/1286319877736628356  @GeraldLoeffler is this failure consistent or intermittent? Its possible there may be a race condition between when we start the provider on your machine and when our CLI tries to connect.
  > The context deadline for provider startup was 5 seconds. Given we've seen this issue be intermittent in the past, there is a chance the timeout was too short. Any other issue in the provider, such as a panic, is likely to have printed to the console, so slow startup seems like a likely cause.  I've extended the timeout in the Podman support PR https://github.com/nitrictech/cli/pull/815 so we can see if that helps.

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

### Incident Patch 1: `89224398` (2026-02-04)
**Commit Message**: fix(release): fix missing aws and awstf binaries in release (#909)



---

### Incident Patch 2: `155d9f06` (2026-01-05)
**Commit Message**: docs: fix mistake in adding resource types guide (#905)

**File**: `docs/docs/providers/custom/adding-resource-types.mdx` (modified, +63/-14)
```diff
@@ -118,6 +118,10 @@ cd core && make generate-proto
 
 ## Part 2: CLI Changes - Resource Collection
 
+<Note>
+  The following changes are made in the **[nitric/cli](https://github.com/nitrictech/cli)** repository, not nitric/core.
+</Note>
+
 These changes enable `nitric up` to collect your new resource type from application code.
 
 ### Update ServiceRequirements Struct
@@ -233,6 +237,10 @@ func ServiceRequirementsToSpec(...) (*deploymentspb.Spec, error) {
 
 ## Part 3: CLI Changes - Local Development
 
+<Note>
+  The following changes are also made in the **[nitric/cli](https://github.com/nitrictech/cli)** repository.
+</Note>
+
 To support your new resource in `nitric start`, you'll need to implement a local service.
 
 ### Create Local Service
@@ -318,6 +326,23 @@ func New(projectName string, opts LocalCloudOptions) (*LocalCloud, error) {
 
 4. Wire into server plugins in `AddService()` and `AddBatch()`:
 
+<Note>
+  First, you'll need to add the `WithYourResourcePlugin` option to the nitric/core
+  server package (in `core/pkg/server/options.go`). This function must accept
+  your proto-generated service interface (e.g., `yourresourcepb.YourResourceServer`)
+  and follow the same pattern as existing plugins like `WithStoragePlugin`:
+
+  ```go
+  func WithYourResourcePlugin(plugin yourresourcepb.YourResourceServer) ServerOption {
+      return func(s *Server) {
+          yourresourcepb.RegisterYourResourceServer(s.grpcServer, plugin)
+      }
+  }
+  ```
+
+  See [core/pkg/server/options.go](https://github.com/nitrictech/nitric/blob/main/core/pkg/server/options.go) for complete examples.
+</Note>
+
 ```go title:pkg/cloud/cloud.go
 nitricRuntimeServer, _ := server.New(
     // ... existing plugins ...
@@ -326,11 +351,6 @@ nitricRuntimeServer, _ := server.New(
 )
 ```
 
-<Note>
-  You'll need to add the `WithYourResourcePlugin` option to the nitric/core
-  server package.
-</Note>
-
 ### Update Local Resources Service
 
 In `pkg/cloud/resources/resources.go`, if your resource should be tracked in the dashboard:
@@ -367,23 +387,52 @@ l.state.YourResources.ClearRequestingService(serviceName)
 
 Your custom provider receives the deployment spec via gRPC and creates cloud resources.
 
-### Handle New Resource in Provider
+### Implement Resource Type Method
 
-In your provider's deployment handler, add a case for your resource type:
+Providers implement the `NitricPulumiProvider` interface. Create a new file `deploy/yourresource.go` with a method for your resource type:
 
-```go title:deploy/deploy.go
-func (p *Provider) deployResource(resource *deploymentspb.Resource) error {
-    switch resource.Id.Type {
-    // ... existing cases ...
+```go title:deploy/yourresource.go
+package deploy
 
-    case resourcespb.ResourceType_YourResourceType:
-        config := resource.GetYourResource()
-        // Create your cloud resource here using config
+import (
+    deploymentspb "github.com/nitrictech/nitric/core/pkg/proto/deployments/v1"
+    "github.com/pulumi/pulumi/sdk/v3/go/pulumi"
+    // Import your cloud provider's SDK (e.g., AWS, GCP, Azure)
+)
+
+func (p *NitricYourCloudProvider) YourResourceType(
+    ctx *pulumi.Context,
+    parent pulumi.Resource,
+    name string,
+    config *deploymentspb.YourDeploymentResource,
+) error {
+    // Create your cloud resource using the Pulumi SDK
+    // For example, using AWS SDK with Pulumi:
+    resource, err := yourservice.NewResource(ctx, name, &yourservice.ResourceArgs{
+        // Map config to cloud provider arguments
+    }, pulumi.Parent(parent))
+    if err != nil {
+        return err
     }
+
+    // Store resource reference if needed for later use
+    p.YourResources[name] = resource
+
     return nil
 }
 ```
 
+The deployment framework automatically calls your method for each resource of this type. Follow the **one-file-per-resource** pattern used by existing providers - see [cloud/aws/deploy/queue.go](https://github.com/nitrictech/nitric/blob/main/cloud/aws/deploy/queu
```

---

### Incident Patch 3: `fe381bca` (2025-12-04)
**Commit Message**: fix(docs): bump next and form-data to fix security issues (#900)

**File**: `docs/package.json` (modified, +5/-2)
```diff
@@ -63,7 +63,7 @@
     "mdx-annotations": "^0.1.1",
     "mdx-mermaid": "^2.0.3",
     "mermaid": "^11.4.1",
-    "next": "^14.2.21",
+    "next": "^14.2.25",
     "next-contentlayer2": "^0.5.1",
     "next-themes": "^0.3.0",
     "radash": "^12.1.0",
@@ -100,5 +100,8 @@
     "sharp": "0.33.1",
     "spellchecker-cli": "^6.2.0"
   },
-  "packageManager": "yarn@1.22.22+sha512.a6b2f7906b721bba3d67d4aff083df04dad64c399707841b7acf00f6b133b7ac24255f2652fa22ae3534329dc6180534e98d17432037ff6fd140556e2bb3137e"
+  "packageManager": "yarn@1.22.22+sha512.a6b2f7906b721bba3d67d4aff083df04dad64c399707841b7acf00f6b133b7ac24255f2652fa22ae3534329dc6180534e98d17432037ff6fd140556e2bb3137e",
+  "resolutions": {
+    "form-data": "^4.0.4"
+  }
 }
```

**File**: `docs/yarn.lock` (modified, +67/-66)
```diff
@@ -966,10 +966,10 @@
   dependencies:
     langium "3.0.0"
 
-"@next/env@14.2.24":
-  version "14.2.24"
-  resolved "https://registry.yarnpkg.com/@next/env/-/env-14.2.24.tgz#49274c9ccbbb9d314d4a414a4ff2717756105ebc"
-  integrity sha512-LAm0Is2KHTNT6IT16lxT+suD0u+VVfYNQqM+EJTKuFRRuY2z+zj01kueWXPCxbMBDt0B5vONYzabHGUNbZYAhA==
+"@next/env@14.2.33":
+  version "14.2.33"
+  resolved "https://registry.yarnpkg.com/@next/env/-/env-14.2.33.tgz#ac87a781fd485b740f3f9bd94efc02cb9826f694"
+  integrity sha512-CgVHNZ1fRIlxkLhIX22flAZI/HmpDaZ8vwyJ/B0SDPTBuLZ1PJ+DWMjCHhqnExfmSQzA/PbZi8OAc7PAq2w9IA==
 
 "@next/eslint-plugin-next@14.2.24":
   version "14.2.24"
@@ -985,50 +985,50 @@
   dependencies:
     source-map "^0.7.0"
 
-"@next/swc-darwin-arm64@14.2.24":
-  version "14.2.24"
-  resolved "https://registry.yarnpkg.com/@next/swc-darwin-arm64/-/swc-darwin-arm64-14.2.24.tgz#95a4be350a03c136ae1b61969748ff810ffc63eb"
-  integrity sha512-7Tdi13aojnAZGpapVU6meVSpNzgrFwZ8joDcNS8cJVNuP3zqqrLqeory9Xec5TJZR/stsGJdfwo8KeyloT3+rQ==
-
-"@next/swc-darwin-x64@14.2.24":
-  version "14.2.24"
-  resolved "https://registry.yarnpkg.com/@next/swc-darwin-x64/-/swc-darwin-x64-14.2.24.tgz#5fdfa185040924c0533c4005a21a8e5985ffbd9c"
-  integrity sha512-lXR2WQqUtu69l5JMdTwSvQUkdqAhEWOqJEYUQ21QczQsAlNOW2kWZCucA6b3EXmPbcvmHB1kSZDua/713d52xg==
-
-"@next/swc-linux-arm64-gnu@14.2.24":
-  version "14.2.24"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-14.2.24.tgz#7242d382d2e301d385591b4250ebf608b3a555d3"
-  integrity sha512-nxvJgWOpSNmzidYvvGDfXwxkijb6hL9+cjZx1PVG6urr2h2jUqBALkKjT7kpfurRWicK6hFOvarmaWsINT1hnA==
-
-"@next/swc-linux-arm64-musl@14.2.24":
-  version "14.2.24"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-14.2.24.tgz#9a67b28e6fd6f0078929f0ef5256549b51b0320d"
-  integrity sha512-PaBgOPhqa4Abxa3y/P92F3kklNPsiFjcjldQGT7kFmiY5nuFn8ClBEoX8GIpqU1ODP2y8P6hio6vTomx2Vy0UQ==
-
-"@next/swc-linux-x64-gnu@14.2.24":
-  version "14.2.24"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-14.2.24.tgz#012d801b44e179912d7136c74d25de8a7da42084"
-  integrity sha512-vEbyadiRI7GOr94hd2AB15LFVgcJZQWu7Cdi9cWjCMeCiUsHWA0U5BkGPuoYRnTxTn0HacuMb9NeAmStfBCLoQ==
-
-"@next/swc-linux-x64-musl@14.2.24":
-  version "14.2.24"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-14.2.24.tgz#97408c53510c6960094bc6c743670c6e72bfa41c"
-  integrity sha512-df0FC9ptaYsd8nQCINCzFtDWtko8PNRTAU0/+d7hy47E0oC17tI54U/0NdGk7l/76jz1J377dvRjmt6IUdkpzQ==
-
-"@next/swc-win32-arm64-msvc@14.2.24":
-  version "14.2.24"
-  resolved "https://registry.yarnpkg.com/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-14.2.24.tgz#4252ea2bcc5ae62ebff16dd9320741b4f88ec368"
-  integrity sha512-ZEntbLjeYAJ286eAqbxpZHhDFYpYjArotQ+/TW9j7UROh0DUmX7wYDGtsTPpfCV8V+UoqHBPU7q9D4nDNH014Q==
-
-"@next/swc-win32-ia32-msvc@14.2.24":
-  version "14.2.24"
-  resolved "https://registry.yarnpkg.com/@next/swc-win32-ia32-msvc/-/swc-win32-ia32-msvc-14.2.24.tgz#fa15ae451617ce820517714cf2e98b56c18960d7"
-  integrity sha512-9KuS+XUXM3T6v7leeWU0erpJ6NsFIwiTFD5nzNg8J5uo/DMIPvCp3L1Ao5HjbHX0gkWPB1VrKoo/Il4F0cGK2Q==
-
-"@next/swc-win32-x64-msvc@14.2.24":
-  version "14.2.24"
-  resolved "https://registry.yarnpkg.com/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-14.2.24.tgz#0f7002e8c8b1f310a48fdc829cfda77ffcabf489"
-  integrity sha512-cXcJ2+x0fXQ2CntaE00d7uUH+u1Bfp/E0HsNQH79YiLaZE5Rbm7dZzyAYccn3uICM7mw+DxoMqEfGXZtF4Fgaw==
+"@next/swc-darwin-arm64@14.2.33":
+  version "14.2.33"
+  resolved "https://registry.yarnpkg.com/@next/swc-darwin-arm64/-/swc-darwin-arm64-14.2.33.tgz#9e74a4223f1e5e39ca4f9f85709e0d95b869b298"
+  integrity sha512-HqYnb6pxlsshoSTubdXKu15g3iivcbsMXg4bYpjL2iS/V6aQot+iyF4BUc2qA/J/n55YtvE4PHMKWBKGCF/+wA==
+
+"@next/swc-darwin-x64@14.2.33":
+  version "14.2.33"
+  resolved "https://registry.yarnpkg.com/@next/swc-darwin-x64/-/swc-darwin-x64-14.2.33.tgz#fcf0c45938da9b0cc2ec86357d6aefca90bd17f
```

---

### Incident Patch 4: `d08274a5` (2025-09-10)
**Commit Message**: fix: update github.com/pulumi/pulumi-awsx/sdk to v3 (#889)

* fix: update github.com/pulumi/pulumi-awsx/sdk to v3

* ci: update Go versions in GitHub Actions

* ci: use `go tool` to run lichen dependency license checks

* ci: run test steps concurrently to improve performance

Also reduces the amount of time to re-run a single failed step

**File**: `.github/workflows/publish-aws.yaml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ jobs:
       - name: Setup Go
         uses: actions/setup-go@v2
         with:
-          go-version: 1.22.7
+          go-version: 1.24.0
       - uses: goreleaser/goreleaser-action@v4
         with:
           # either 'goreleaser' (default) or 'goreleaser-pro':
```

**File**: `.github/workflows/publish-awstf.yaml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ jobs:
       - name: Setup Go
         uses: actions/setup-go@v2
         with:
-          go-version: 1.22.7
+          go-version: 1.24.0
       - uses: goreleaser/goreleaser-action@v4
         with:
           # either 'goreleaser' (default) or 'goreleaser-pro':
```

**File**: `.github/workflows/publish-azure.yaml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ jobs:
       - name: Setup Go
         uses: actions/setup-go@v2
         with:
-          go-version: 1.22.7
+          go-version: 1.24.0
       - uses: goreleaser/goreleaser-action@v4
         with:
           # either 'goreleaser' (default) or 'goreleaser-pro':
```

**File**: `.github/workflows/publish-azuretf.yaml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ jobs:
       - name: Setup Go
         uses: actions/setup-go@v2
         with:
-          go-version: 1.22.7
+          go-version: 1.24.0
       - uses: goreleaser/goreleaser-action@v4
         with:
           # either 'goreleaser' (default) or 'goreleaser-pro':
```

**File**: `.github/workflows/publish-gcp.yaml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ jobs:
       - name: Setup Go
         uses: actions/setup-go@v2
         with:
-          go-version: 1.22.7
+          go-version: 1.24.0
       - uses: goreleaser/goreleaser-action@v4
         with:
           # either 'goreleaser' (default) or 'goreleaser-pro':
```

---

### Incident Patch 5: `c32823af` (2025-09-09)
**Commit Message**: fix(aws): improves error handling and stack ID retrieval (#877)

**File**: `cloud/aws/deploy/deploy.go` (modified, +3/-0)
```diff
@@ -216,6 +216,9 @@ func (a *NitricAwsPulumiProvider) Pre(ctx *pulumi.Context, resources []*pulumix.
 			}`, tags.GetResourceNameKey(a.StackId)),
 		},
 	})
+	if err != nil {
+		return fmt.Errorf("failed to create resource group: %w", err)
+	}
 
 	databases := lo.Filter(resources, func(item *pulumix.NitricPulumiResource[any], idx int) bool {
 		return item.Id.Type == resourcespb.ResourceType_SqlDatabase
```

**File**: `cloud/aws/deploy/service.go` (modified, +4/-1)
```diff
@@ -277,7 +277,7 @@ func (a *NitricAwsPulumiProvider) Service(ctx *pulumi.Context, parent pulumi.Res
 	}
 
 	// ensure that the lambda was deployed successfully
-	_ = a.Lambdas[name].Arn.ApplyT(func(arn string) (bool, error) {
+	healthCheckOutput := a.Lambdas[name].Arn.ApplyT(func(arn string) (bool, error) {
 		payload, _ := json.Marshal(map[string]interface{}{
 			"x-nitric-healthcheck": true,
 		})
@@ -297,5 +297,8 @@ func (a *NitricAwsPulumiProvider) Service(ctx *pulumi.Context, parent pulumi.Res
 		return true, nil
 	})
 
+	// Register the health check as a dependency to ensure it completes
+	ctx.Export(fmt.Sprintf("lambda-%s-healthcheck", name), healthCheckOutput)
+
 	return nil
 }
```

**File**: `cloud/common/deploy/provider/options.go` (modified, +1/-7)
```diff
@@ -22,13 +22,7 @@ import (
 
 type ErrorHandler = func(err error) error
 
-func WithErrorHandler(handler ErrorHandler) func(*PulumiProviderServer) {
-	return func(s *PulumiProviderServer) {
-		s.errorHandlers = append(s.errorHandlers, handler)
-	}
-}
-
-func handleCommonErrors(err error) error {
+func explainCommonErrs(err error) error {
 	// Check for common Pulumi 'autoError' types
 	if auto.IsConcurrentUpdateError(err) {
 		if pe := parsePulumiError(err); pe != nil {
```

**File**: `cloud/common/deploy/provider/pulumi.go` (modified, +12/-15)
```diff
@@ -36,9 +36,8 @@ import (
 )
 
 type PulumiProviderServer struct {
-	provider      NitricPulumiProvider
-	runtime       RuntimeProvider
-	errorHandlers []ErrorHandler
+	provider NitricPulumiProvider
+	runtime  RuntimeProvider
 }
 
 func NewPulumiProviderServer(provider NitricPulumiProvider, runtime RuntimeProvider, options ...func(*PulumiProviderServer)) *PulumiProviderServer {
@@ -237,7 +236,10 @@ func (s *PulumiProviderServer) Up(req *deploymentspb.DeploymentUpRequest, stream
 
 	go func() {
 		// output the stream
-		_ = pulumix.StreamPulumiUpEngineEvents(stream, pulumiEventsChan)
+		err := pulumix.StreamPulumiUpEngineEvents(stream, pulumiEventsChan)
+		if err != nil {
+			logger.Errorf("error streaming Pulumi events: %v", err)
+		}
 	}()
 
 	config, err := s.provider.Config()
@@ -260,21 +262,15 @@ func (s *PulumiProviderServer) Up(req *deploymentspb.DeploymentUpRequest, stream
 
 	result, err := autoStack.Up(context.TODO(), options...)
 	if err != nil {
-		err = handleCommonErrors(err)
-
-		for _, handler := range s.errorHandlers {
-			err = handler(err)
-		}
-
-		return err
+		return explainCommonErrs(err)
 	}
 
 	resultStr, ok := result.Outputs[resultCtxKey].Value.(string)
 	if !ok {
 		resultStr = ""
 	}
 
-	err = stream.Send(&deploymentspb.DeploymentUpEvent{
+	return stream.Send(&deploymentspb.DeploymentUpEvent{
 		Content: &deploymentspb.DeploymentUpEvent_Result{
 			Result: &deploymentspb.UpResult{
 				Content: &deploymentspb.UpResult_Text{
@@ -283,8 +279,6 @@ func (s *PulumiProviderServer) Up(req *deploymentspb.DeploymentUpRequest, stream
 			},
 		},
 	})
-
-	return err
 }
 
 // Down - automatically called by the Nitric CLI via the `down` command
@@ -315,7 +309,10 @@ func (s *PulumiProviderServer) Down(req *deploymentspb.DeploymentDownRequest, st
 	pulumiEventsChan := make(chan events.EngineEvent)
 
 	go func() {
-		_ = pulumix.StreamPulumiDownEngineEvents(stream, pulumiEventsChan)
+		err = pulumix.StreamPulumiDownEngineEvents(stream, pulumiEventsChan)
+		if err != nil {
+			logger.Errorf("error streaming Pulumi events: %v", err)
+		}
 	}()
 
 	config, err := s.provider.Config()
```

**File**: `cloud/common/deploy/pulumix/clistream.go` (modified, +2/-2)
```diff
@@ -257,7 +257,7 @@ func StreamPulumiUpEngineEvents(stream deploymentspb.Deployment_UpServer, pulumi
 			},
 		})
 		if err != nil {
-			return err
+			return fmt.Errorf("failed to send deployment up event: %w", err)
 		}
 	}
 	return nil
@@ -290,7 +290,7 @@ func StreamPulumiDownEngineEvents(stream deploymentspb.Deployment_DownServer, pu
 				},
 			})
 			if err != nil {
-				return err
+				return fmt.Errorf("failed to send deployment down event: %w", err)
 			}
 		}
 	}
```

---

### Incident Patch 6: `f68390c2` (2025-06-18)
**Commit Message**: fix(aws): fix backward compatibility of aws custom domain deployments (#803)

* aliases original domain name pulumi resources
* applies original pulumi parent resources to API domains
* only forces deployment to us-east-1 for CDN domains

**File**: `cloud/aws/deploy/api.go` (modified, +8/-4)
```diff
@@ -250,7 +250,11 @@ func (a *NitricAwsPulumiProvider) Api(ctx *pulumi.Context, parent pulumi.Resourc
 }
 
 func (a *NitricAwsPulumiProvider) createApiDomainName(ctx *pulumi.Context, name string, domainName string, stage *apigatewayv2.Stage, api *apigatewayv2.Api) error {
-	domain, err := a.newPulumiDomainName(ctx, domainName)
+	domain, err := a.newPulumiDomainName(ctx, domainArgs{
+		DomainName: domainName,
+		// Required for backwards compatibility with provider versions < 1.26.1
+		AliasName: name,
+	})
 	if err != nil {
 		return err
 	}
@@ -263,7 +267,7 @@ func (a *NitricAwsPulumiProvider) createApiDomainName(ctx *pulumi.Context, name
 			SecurityPolicy: pulumi.String("TLS_1_2"),
 			CertificateArn: domain.CertificateValidation.CertificateArn,
 		},
-	})
+	}, pulumi.Parent(domain))
 	if err != nil {
 		return err
 	}
@@ -273,7 +277,7 @@ func (a *NitricAwsPulumiProvider) createApiDomainName(ctx *pulumi.Context, name
 		ApiId:      api.ID(),
 		DomainName: apiDomainName.DomainName,
 		Stage:      stage.Name,
-	}, pulumi.DependsOn([]pulumi.Resource{stage}))
+	}, pulumi.DependsOn([]pulumi.Resource{stage}), pulumi.Parent(domain))
 	if err != nil {
 		return err
 	}
@@ -294,7 +298,7 @@ func (a *NitricAwsPulumiProvider) createApiDomainName(ctx *pulumi.Context, name
 				EvaluateTargetHealth: pulumi.Bool(false),
 			},
 		},
-	}, pulumi.DependsOn([]pulumi.Resource{domain}))
+	}, pulumi.Parent(domain))
 	if err != nil {
 		return err
 	}
```

**File**: `cloud/aws/deploy/domain.go` (modified, +36/-9)
```diff
@@ -18,6 +18,7 @@ package deploy
 
 import (
 	"fmt"
+	"slices"
 
 	awsprovider "github.com/pulumi/pulumi-aws/sdk/v5/go/aws"
 
@@ -35,24 +36,32 @@ type Domain struct {
 	CertificateValidation *acm.CertificateValidation
 }
 
-func (a *NitricAwsPulumiProvider) newPulumiDomainName(ctx *pulumi.Context, domainName string) (*Domain, error) {
+type domainArgs struct {
+	DomainName string
+	// Required for backwards compatibility with provider versions < 1.26.1
+	AliasName string
+	// If the domain is used for a CDN, it will be deployed in the us-east-1 region
+	IsCDNDomain bool
+}
+
+func (a *NitricAwsPulumiProvider) newPulumiDomainName(ctx *pulumi.Context, args domainArgs) (*Domain, error) {
 	var err error
-	res := &Domain{Name: domainName}
+	res := &Domain{Name: args.DomainName}
 
-	res.ZoneLookup, err = resources.GetZoneID(domainName)
+	res.ZoneLookup, err = resources.GetZoneID(args.DomainName)
 	if err != nil {
 		return nil, err
 	}
 
-	err = ctx.RegisterComponentResource("nitric:api:DomainName", fmt.Sprintf("%s-%s", domainName, a.StackId), res)
+	err = ctx.RegisterComponentResource("nitric:api:DomainName", fmt.Sprintf("%s-%s", args.DomainName, a.StackId), res)
 	if err != nil {
 		return nil, err
 	}
 
 	defaultOptions := []pulumi.ResourceOption{pulumi.Parent(res)}
 
 	// Create an AWS provider for the us-east-1 region as the acm certificates require being deployed in us-east-1 region
-	if a.Region != "us-east-1" {
+	if args.IsCDNDomain && a.Region != "us-east-1" {
 		useast1, err := awsprovider.NewProvider(ctx, "us-east-1", &awsprovider.ProviderArgs{
 			Region: pulumi.String("us-east-1"),
 		})
@@ -64,9 +73,14 @@ func (a *NitricAwsPulumiProvider) newPulumiDomainName(ctx *pulumi.Context, domai
 	}
 
 	cert, err := acm.NewCertificate(ctx, fmt.Sprintf("cert-%s", a.StackId), &acm.CertificateArgs{
-		DomainName:       pulumi.String(domainName),
+		DomainName:       pulumi.String(args.DomainName),
 		ValidationMethod: pulumi.String("DNS"),
-	}, defaultOptions...)
+	},
+		slices.Concat(defaultOptions, []pulumi.ResourceOption{pulumi.Aliases([]pulumi.Alias{
+			// Required for backwards compatibility with provider versions < 1.26.1
+			{Name: pulumi.String(fmt.Sprintf("%s-%s-cert", args.AliasName, args.DomainName))},
+		})})...,
+	)
 	if err != nil {
 		return nil, err
 	}
@@ -89,7 +103,13 @@ func (a *NitricAwsPulumiProvider) newPulumiDomainName(ctx *pulumi.Context, domai
 		},
 		Ttl:    pulumi.Int(10 * 60),
 		ZoneId: pulumi.String(res.ZoneLookup.ZoneID),
-	}, []pulumi.ResourceOption{pulumi.Parent(res)}...)
+	}, []pulumi.ResourceOption{
+		pulumi.Parent(res),
+		pulumi.Aliases([]pulumi.Alias{
+			// Required for backwards compatibility with provider versions < 1.26.1
+			{Name: pulumi.String(fmt.Sprintf("%s-%s-certvalidationdns", args.AliasName, args.DomainName))},
+		}),
+	}...)
 	if err != nil {
 		return nil, err
 	}
@@ -99,7 +119,14 @@ func (a *NitricAwsPulumiProvider) newPulumiDomainName(ctx *pulumi.Context, domai
 		ValidationRecordFqdns: pulumi.StringArray{
 			cdnRecord.Fqdn,
 		},
-	}, defaultOptions...)
+	},
+		slices.Concat(defaultOptions, []pulumi.ResourceOption{
+			pulumi.Aliases([]pulumi.Alias{
+				// Required for backwards compatibility with provider versions < 1.26.1
+				{Name: pulumi.String(fmt.Sprintf("%s-%s-certvalidation", args.AliasName, args.DomainName))},
+			}),
+		})...,
+	)
 	if err != nil {
 		return nil, err
 	}
```

**File**: `cloud/aws/deploy/website.go` (modified, +4/-1)
```diff
@@ -335,7 +335,10 @@ func (a *NitricAwsPulumiProvider) deployCloudfrontDistribution(ctx *pulumi.Conte
 	if domainName != "" {
 		aliases = []string{domainName}
 
-		domain, err := a.newPulumiDomainName(ctx, domainName)
+		domain, err := a.newPulumiDomainName(ctx, domainArgs{
+			DomainName:  domainName,
+			IsCDNDomain: true,
+		})
 		if err != nil {
 			return err
 		}
```

---

### Incident Patch 7: `9febb5bc` (2025-05-26)
**Commit Message**: fix(sql): support auto-minor db engine version upgrades (#802)

**File**: `cloud/aws/deploy/sql.go` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@ func (a *NitricAwsPulumiProvider) rds(ctx *pulumi.Context) error {
 	a.DatabaseCluster, err = rds.NewCluster(ctx, "postgresql", &rds.ClusterArgs{
 		ApplyImmediately: pulumi.Bool(true),
 		Engine:           pulumi.String(rds.EngineTypeAuroraPostgresql),
-		EngineVersion:    pulumi.String("13.16"),
+		EngineVersion:    pulumi.String("13"),
 		// TODO: limit number of availability zones
 		AvailabilityZones:                pulumi.ToStringArray(a.VpcAzs),
 		DatabaseName:                     pulumi.String("nitric"),
```

**File**: `cloud/aws/deploytf/.nitric/modules/rds/main.tf` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ resource "aws_rds_cluster" "rds_cluster" {
   cluster_identifier     = "nitric-rds-cluster"
   engine                 = "aurora-postgresql"
   engine_mode            = "provisioned"
-  engine_version         = "13.14"
+  engine_version         = "13"
   database_name          = "nitric"
   master_username        = "nitric"
   master_password        = random_password.rds_password.result
```

---

### Incident Patch 8: `ff212591` (2025-05-07)
**Commit Message**: fix(gcp): only require a domain when websites are deployed (#800)

**File**: `cloud/gcp/deploy/deploy.go` (modified, +5/-1)
```diff
@@ -92,6 +92,7 @@ type NitricGcpPulumiProvider struct {
 	Secrets                map[string]*secretmanager.Secret
 	DatabaseMigrationBuild map[string]*cloudrunv2.Job
 
+	EntrypointRequired bool
 	// files to upload to the website bucket
 	// The map key represents the baseUrl/directory in the bucket
 	WebsiteBuckets        map[string]*storage.Bucket
@@ -404,7 +405,10 @@ func getGCPToken(ctx *pulumi.Context) (*oauth2.Token, error) {
 }
 
 func (a *NitricGcpPulumiProvider) Post(ctx *pulumi.Context) error {
-	return a.deployEntrypoint(ctx)
+	if a.EntrypointRequired {
+		return a.deployEntrypoint(ctx)
+	}
+	return nil
 }
 
 func (a *NitricGcpPulumiProvider) Result(ctx *pulumi.Context) (pulumi.StringOutput, error) {
```

**File**: `cloud/gcp/deploy/website.go` (modified, +2/-0)
```diff
@@ -315,6 +315,8 @@ func (a *NitricGcpPulumiProvider) deployEntrypoint(ctx *pulumi.Context) error {
 
 // Website - Implements the Website deployment method for the GCP provider
 func (a *NitricGcpPulumiProvider) Website(ctx *pulumi.Context, parent pulumi.Resource, name string, config *deploymentspb.Website) error {
+	a.EntrypointRequired = true
+
 	if a.GcpConfig.CdnDomain.DomainName == "" {
 		return fmt.Errorf("website deployments to GCP require a domain name to be configured in the stack file.")
 	}
```

---

### Incident Patch 9: `73961aee` (2025-05-02)
**Commit Message**: fix(awstf): Allow awstf to import existing secrets. (#797)

**File**: `cloud/aws/Makefile` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ generate-mocks: clean-mocks
 	@go run github.com/golang/mock/mockgen github.com/nitrictech/nitric/cloud/aws/runtime/resource AwsResourceResolver > mocks/provider/aws.go
 
 generate-terraform:
-	@cd deploytf && npx -y cdktf-cli@0.20.8 get
+	@cd deploytf && npx -y cdktf-cli@0.20.12 get
 
 generate-sources: generate-mocks
 
```

**File**: `cloud/aws/deploytf/.nitric/modules/secret/main.tf` (modified, +3/-0)
```diff
@@ -1,6 +1,9 @@
 
 # Create a new AWS secret manager secret
 resource "aws_secretsmanager_secret" "secret" {
+  # Only create a new secret if we're not reusing an existing one
+  count = var.existing_secret_arn == "" ? 1 : 0
+
   name = var.secret_name
   tags = {
     "x-nitric-${var.stack_id}-name" = var.secret_name
```

**File**: `cloud/aws/deploytf/.nitric/modules/secret/outputs.tf` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 output "secret_arn" {
   description = "The ARN of the secret"
-  value       =  aws_secretsmanager_secret.secret.arn
+  value       = var.existing_secret_arn == "" ? one(aws_secretsmanager_secret.secret).arn : var.existing_secret_arn
 }
```

**File**: `cloud/aws/deploytf/.nitric/modules/secret/variables.tf` (modified, +6/-0)
```diff
@@ -3,6 +3,12 @@ variable "secret_name" {
   type        = string
 }
 
+variable "existing_secret_arn" {
+  description = "The ARN of the existing secret to import"
+  type        = string
+  default     = ""
+}
+
 variable "stack_id" {
   description = "The ID of the Nitric stack"
   type        = string
```

**File**: `cloud/aws/deploytf/generated/constraints.json` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 {
-  "cdktf": "0.20.8",
+  "cdktf": "0.20.12",
   "providers": {}
 }
```

---

### Incident Patch 10: `7ce93d65` (2025-05-02)
**Commit Message**: fix: ensure origins are unique for aws websites (#798)

**File**: `cloud/aws/deploy/website.go` (modified, +5/-5)
```diff
@@ -177,7 +177,7 @@ func (a *NitricAwsPulumiProvider) deployCloudfrontDistribution(ctx *pulumi.Conte
 
 		origins = append(origins, &cloudfront.DistributionOriginArgs{
 			DomainName: website.bucket.BucketRegionalDomainName,
-			OriginId:   pulumi.String(websiteName),
+			OriginId:   pulumi.Sprintf("website-%s", websiteName),
 			S3OriginConfig: cloudfront.DistributionOriginS3OriginConfigArgs{
 				OriginAccessIdentity: oai.CloudfrontAccessIdentityPath,
 			},
@@ -201,7 +201,7 @@ func (a *NitricAwsPulumiProvider) deployCloudfrontDistribution(ctx *pulumi.Conte
 		if website.basePath != "/" {
 			rootCacheBehavior := &cloudfront.DistributionOrderedCacheBehaviorArgs{
 				PathPattern:          pulumi.String(strings.TrimPrefix(website.basePath, "/")),
-				TargetOriginId:       pulumi.String(websiteName),
+				TargetOriginId:       pulumi.Sprintf("website-%s", websiteName),
 				ViewerProtocolPolicy: pulumi.String("redirect-to-https"),
 				AllowedMethods: pulumi.StringArray{
 					pulumi.String("GET"),
@@ -244,7 +244,7 @@ func (a *NitricAwsPulumiProvider) deployCloudfrontDistribution(ctx *pulumi.Conte
 			orderedCacheBehaviors = append(orderedCacheBehaviors, subpathCacheBehavior)
 		} else {
 			defaultCacheBehavior = cloudfront.DistributionDefaultCacheBehaviorArgs{
-				TargetOriginId:       pulumi.String(websiteName),
+				TargetOriginId:       pulumi.Sprintf("website-%s", websiteName),
 				ViewerProtocolPolicy: pulumi.String("redirect-to-https"),
 				AllowedMethods: pulumi.StringArray{
 					pulumi.String("GET"),
@@ -310,7 +310,7 @@ func (a *NitricAwsPulumiProvider) deployCloudfrontDistribution(ctx *pulumi.Conte
 
 		origins = append(origins, &cloudfront.DistributionOriginArgs{
 			DomainName: apiDomainName,
-			OriginId:   pulumi.String(name),
+			OriginId:   pulumi.Sprintf("api-%s", name),
 			CustomOriginConfig: &cloudfront.DistributionOriginCustomOriginConfigArgs{
 				OriginReadTimeout:    pulumi.Int(30),
 				OriginProtocolPolicy: pulumi.String("https-only"),
@@ -335,7 +335,7 @@ func (a *NitricAwsPulumiProvider) deployCloudfrontDistribution(ctx *pulumi.Conte
 				},
 				AllowedMethods: pulumi.ToStringArray([]string{"GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"}),
 				CachedMethods:  pulumi.ToStringArray([]string{"GET", "HEAD", "OPTIONS"}),
-				TargetOriginId: pulumi.String(name),
+				TargetOriginId: pulumi.Sprintf("api-%s", name),
 				ForwardedValues: &cloudfront.DistributionOrderedCacheBehaviorForwardedValuesArgs{
 					QueryString: pulumi.Bool(true),
 					Cookies: &cloudfront.DistributionOrderedCacheBehaviorForwardedValuesCookiesArgs{
```

**File**: `cloud/aws/deploytf/.nitric/modules/cdn/main.tf` (modified, +6/-6)
```diff
@@ -60,7 +60,7 @@ resource "aws_cloudfront_distribution" "s3_distribution" {
 
     content {
       domain_name = origin.value.bucket_domain_name
-      origin_id = origin.key
+      origin_id = "website-${origin.key}"
 
       s3_origin_config {
         origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
@@ -73,7 +73,7 @@ resource "aws_cloudfront_distribution" "s3_distribution" {
 
     content {
       domain_name = replace(origin.value.gateway_url, "https://", "")
-      origin_id = origin.key
+      origin_id = "api-${origin.key}"
 
       custom_origin_config {
         origin_read_timeout = 30
@@ -98,7 +98,7 @@ resource "aws_cloudfront_distribution" "s3_distribution" {
 
       allowed_methods = ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"]
       cached_methods = ["GET","HEAD","OPTIONS"]
-      target_origin_id = ordered_cache_behavior.key
+      target_origin_id = "api-${ordered_cache_behavior.key}"
 
       forwarded_values {
         query_string = true
@@ -127,7 +127,7 @@ resource "aws_cloudfront_distribution" "s3_distribution" {
 
       allowed_methods  = ["GET", "HEAD", "OPTIONS"]
       cached_methods   = ["GET", "HEAD", "OPTIONS"]
-      target_origin_id = ordered_cache_behavior.key
+      target_origin_id = "website-${ordered_cache_behavior.key}"
 
       forwarded_values {
         query_string = false
@@ -160,7 +160,7 @@ resource "aws_cloudfront_distribution" "s3_distribution" {
 
       allowed_methods  = ["GET", "HEAD", "OPTIONS"]
       cached_methods   = ["GET", "HEAD", "OPTIONS"]
-      target_origin_id = ordered_cache_behavior.key
+      target_origin_id = "website-${ordered_cache_behavior.key}"
 
       forwarded_values {
         query_string = false
@@ -179,7 +179,7 @@ resource "aws_cloudfront_distribution" "s3_distribution" {
   default_cache_behavior {
     allowed_methods  = ["GET", "HEAD", "OPTIONS"]
     cached_methods   = ["GET", "HEAD", "OPTIONS"]
-    target_origin_id = var.root_website.name
+    target_origin_id = "website-${var.root_website.name}"
     viewer_protocol_policy = "redirect-to-https"
     min_ttl                = 0
     default_ttl            = 3600
```

#### Recent Merged Pull Requests:
- **PR #909** (2026-02-04): fix(release): fix missing aws and awstf binaries in release (@davemooreuws)
- **PR #905** (2026-01-05): docs: fix mistake in adding resource types guide (@jyecusch)
- **PR #902** (2025-12-16): docs: add custom resource extension guide (@jyecusch)
- **PR #900** (2025-12-04): fix(docs): bump next and form-data to fix security issues (@davemooreuws)
- **PR #898** (closed): Rename why-nitric.mdx to why-nitric.mdxx (@jazminelicea2018-sudo)
- **PR #895** (2025-11-17): docs: remove comparisons (@jyecusch)
- **PR #892** (2025-10-07): docs: remove feedback form and force static (@davemooreuws)
- **PR #891** (2025-09-17): docs: excludes comparison docs from search indexing (@davemooreuws)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): infracost/infracost

> **Canonical Artifact**: `07_PROJECT_LEARNING/infracost-infracost-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/infracost/infracost](https://github.com/infracost/infracost))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:58:55.538Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `infracost/infracost`
- **Description**: Cloud cost intelligence for engineers, AI coding agents, and CI/CD 💰📉 Shift FinOps Left!
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 12551 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/config/state.go`
```
package config

import (
	"encoding/json"
	"os"
	"path"

	"github.com/google/uuid"
)

type State struct {
	InstallID              string `json:"installId"`
	LatestReleaseVersion   string `json:"latestReleaseVersion"`
	LatestReleaseCheckedAt string `json:"latestReleaseCheckedAt"`
}

func LoadState() (*State, error) {
	state, err := readStateFileIfExists()
	if err != nil {
		return state, err
	}

	if state.InstallID == "" {
		state.InstallID = uuid.New().String()
		err = state.Save()
		if err != nil {
			return state, err
		}
	}

	return state, nil
}

func (s *State) Save() error {
	return writeStateFile(s)
}

func readStateFileIfExists() (*State, error) {
	if !FileExists(stateFilePath()) {
		return &State{}, nil
	}

	data, err := os.ReadFile(stateFilePath())
	if err != nil {
		return &State{}, err
	}

	var s State
	err = json.Unmarshal(data, &s)

	return &s, err
}

func writeStateFile(s *State) error {
	data, err := json.Marshal(s)
	if err != nil {
		return err
	}

	err = os.MkdirAll(path.Dir(stateFilePath()), 0700)
	if err != nil {
		return err
	}

	return os.WriteFile(stateFilePath(), data, 0600)
}

func stateFilePath() string {
	return path.Join(userConfigDir(), ".state.json")
}

```

### Core Architecture Module: `internal/config/util.go`
```
package config

import (
	"os"
	"path/filepath"
	"runtime"

	"github.com/mitchellh/go-homedir"
)

func IsEnvPresent(s string) bool {
	_, present := os.LookupEnv(s)
	return present
}

func RootDir() string {
	_, b, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(b), "../..")
}

func userConfigDir() string {
	dir, _ := homedir.Expand("~/.config/infracost")
	return dir
}

func FileExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}

	return !info.IsDir()
}

```

### Core Architecture Module: `internal/providers/terraform/aws/ecr_lifecycle_policy.go`
```
package aws

import (
	"github.com/infracost/infracost/internal/schema"
)

func getECRLifecyclePolicy() *schema.RegistryItem {
	return &schema.RegistryItem{
		Name:                "aws_ecr_lifecycle_policy",
		ReferenceAttributes: []string{"repository"},
		NoPrice:             true,
		Notes:               []string{"Free resource."},
	}
}

```

### Core Architecture Module: `internal/providers/terraform/aws/lambda_provisioned_concurrency_config.go`
```
package aws

import (
	"github.com/infracost/infracost/internal/resources/aws"
	"github.com/infracost/infracost/internal/schema"
)

func getLambdaProvisionedConcurrencyConfigRegistryItem() *schema.RegistryItem {
	return &schema.RegistryItem{
		Name:      "aws_lambda_provisioned_concurrency_config",
		CoreRFunc: NewLambdaProvisionedConcurrencyConfig,
	}
}

func NewLambdaProvisionedConcurrencyConfig(d *schema.ResourceData) schema.CoreResource {
	region := d.Get("region").String()
	name := d.Get("function_name").String()
	provisionedConcurrentExecutions := d.Get("provisioned_concurrent_executions").Int()

	r := &aws.LambdaProvisionedConcurrencyConfig{
		Address:                         d.Address,
		Region:                          region,
		Name:                            name,
		ProvisionedConcurrentExecutions: provisionedConcurrentExecutions,
	}

	return r
}

```

### Core Architecture Module: `internal/providers/terraform/aws/s3_bucket_lifecycle_configuration.go`
```
package aws

import (
	"github.com/infracost/infracost/internal/schema"
)

func getS3BucketLifecycleConfigurationRegistryItem() *schema.RegistryItem {
	return &schema.RegistryItem{
		Name:                "aws_s3_bucket_lifecycle_configuration",
		RFunc:               NewS3BucketLifecycleConfiguration,
		ReferenceAttributes: []string{"bucket"},
	}
}

func NewS3BucketLifecycleConfiguration(d *schema.ResourceData, u *schema.UsageData) *schema.Resource {
	return &schema.Resource{
		Name:         d.Address,
		ResourceType: d.Type,
		Tags:         d.Tags,
		DefaultTags:  d.DefaultTags,
		IsSkipped:    true,
		NoPrice:      true,
		SkipMessage:  "Free resource.",
	}
}

```

### Core Architecture Module: `internal/providers/terraform/aws/sfn_state_machine.go`
```
package aws

import (
	"github.com/infracost/infracost/internal/resources/aws"
	"github.com/infracost/infracost/internal/schema"
)

func getStepFunctionRegistryItem() *schema.RegistryItem {
	return &schema.RegistryItem{
		Name:      "aws_sfn_state_machine",
		CoreRFunc: NewSFnStateMachine,
	}
}

func NewSFnStateMachine(d *schema.ResourceData) schema.CoreResource {
	r := &aws.SFnStateMachine{
		Address: d.Address,
		Region:  d.Get("region").String(),
		Type:    d.Get("type").String(),
	}
	return r
}

```

### Core Architecture Module: `internal/providers/terraform/aws/sqs_queue.go`
```
package aws

import (
	"github.com/infracost/infracost/internal/resources/aws"
	"github.com/infracost/infracost/internal/schema"
)

func getSQSQueueRegistryItem() *schema.RegistryItem {
	return &schema.RegistryItem{
		Name:      "aws_sqs_queue",
		CoreRFunc: NewSQSQueue,
	}
}

func NewSQSQueue(d *schema.ResourceData) schema.CoreResource {
	r := &aws.SQSQueue{
		Address:   d.Address,
		Region:    d.Get("region").String(),
		FifoQueue: d.Get("fifo_queue").Bool(),
	}
	return r
}

```

### Core Architecture Module: `internal/providers/terraform/aws/util.go`
```
package aws

func intPtr(i int64) *int64 {
	return &i
}

func strPtr(s string) *string {
	return &s
}

func floatPtr(f float64) *float64 {
	return &f
}

```

### Core Architecture Module: `internal/providers/terraform/azure/storage_queue.go`
```
package azure

import (
	"strings"

	"github.com/infracost/infracost/internal/logging"
	"github.com/infracost/infracost/internal/resources/azure"
	"github.com/infracost/infracost/internal/schema"
)

func getStorageQueueRegistryItem() *schema.RegistryItem {
	return &schema.RegistryItem{
		Name:      "azurerm_storage_queue",
		CoreRFunc: newStorageQueue,
		ReferenceAttributes: []string{
			"storage_account_name",
		},
		GetRegion: func(defaultRegion string, d *schema.ResourceData) string {
			return lookupRegion(d, []string{"storage_account_name"})
		},
	}
}

func newStorageQueue(d *schema.ResourceData) schema.CoreResource {
	region := d.Region

	accountReplicationType := "LRS"
	accountKind := "StorageV2"

	if len(d.References("storage_account_name")) > 0 {
		storageAccount := d.References("storage_account_name")[0]

		accountTier := storageAccount.Get("account_tier").String()
		if strings.EqualFold(accountTier, "premium") {
			logging.Logger.Warn().Msgf("Skipping resource %s. Storage Queues don't support %s tier", d.Address, accountTier)
			return nil
		}

		accountReplicationType = storageAccount.Get("account_replication_type").String()
		accountKind = storageAccount.Get("account_kind").String()
	}

	switch strings.ToLower(accountReplicationType) {
	case "ragrs":
		accountReplicationType = "RA-GRS"
	case "ragzrs":
		accountReplicationType = "RA-GZRS"
	}

	return &azure.StorageQueue{
		Address:                d.Address,
		Region:                 region,
		AccountKind:            accountKind,
		AccountReplicationType: accountReplicationType,
	}
}

```

### Core Architecture Module: `internal/providers/terraform/azure/util.go`
```
package azure

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/shopspring/decimal"

	"github.com/infracost/infracost/internal/logging"
	"github.com/infracost/infracost/internal/schema"
)

func strPtr(s string) *string {
	return &s
}

func decimalPtr(d decimal.Decimal) *decimal.Decimal {
	return &d
}

func regexPtr(regex string) *string {
	return strPtr(fmt.Sprintf("/%s/i", regex))
}

var sReg = regexp.MustCompile(`\s+`)

func toAzureCLIName(location string) string {
	return strings.ToLower(sReg.ReplaceAllString(location, ""))
}

func lookupRegion(d *schema.ResourceData, parentResourceKeys []string) string {
	// First check for a location set directly on a resource
	location := d.Get("location").String()
	if location != "" && !strings.Contains(location, "mock") {
		return toAzureCLIName(location)
	}

	// Then check for any parent resources with a location
	for _, k := range parentResourceKeys {
		parents := d.References(k)
		for _, p := range parents {
			location := p.Get("location").String()
			if location != "" && !strings.Contains(location, "mock") {
				return toAzureCLIName(location)
			}
		}
	}

	// When all else fails use the default region
	defaultRegion := toAzureCLIName(d.Get("region").String())
	logging.Logger.Debug().Msgf("Using %s for resource %s as its 'location' property could not be found.", defaultRegion, d.Address)
	return defaultRegion
}

func convertRegion(region string) string {
	if strings.Contains(strings.ToLower(region), "usgov") {
		return "US Gov"
	} else if strings.Contains(strings.ToLower(region), "china") {
		return "Сhina"
	} else {
		return "Global"
	}
}

// GetResourceRegion returns the default azure region lookup function. Many
// resources in azure define a custom region lookup function, This can be found
// in their RegistryItem.GetRegion field. This function is used as a fallback
// when a custom region lookup function is not defined.
func GetResourceRegion(d *schema.ResourceData) string {
	if d == nil {
		return ""
	}

	return lookupRegion(d, []string{"resource_group_name"})
}

// locationNameMapping returns a display name for a given location name.
// Up-to-date mapping can be found by running the following command:
//
//	az account list-locations -o json | jq '.[] | .name + " " + .displayName'
func locationNameMapping(l string) string {
	name := map[string]string{
		"eastus":              "East US",
		"eastus2":             "East US 2",
		"southcentralus":      "South Central US",
		"westus2":             "West US 2",
		"westus3":             "West US 3",
		"australiaeast":       "Australia East",
		"southeastasia":       "Southeast Asia",
		"northeurope":         "North Europe",
		"swedencentral":       "Sweden Central",
		"uksouth":             "UK South",
		"westeurope":          "West Europe",
		"centralus":           "Central US",
		"southafricanorth":    "South Africa North",
		"centralindia":        "Central India",
		"eastasia":            "East Asia",
		"japaneast":           "Japan East",
		"koreacentral":        "Korea Central",
		"canadacentral":       "Canada Central",
		"francecentral":       "France Central",
		"germanywestcentral":  "Germany West Central",
		"italynorth":          "Italy North",
		"norwayeast":          "Norway East",
		"polandcentral":       "Poland Central",
		"switzerlandnorth":    "Switzerland North",
		"uaenorth":            "UAE North",
		"brazilsouth":         "Brazil South",
		"centraluseuap":       "Central US EUAP",
		"israelcentral":       "Israel Central",
		"qatarcentral":        "Qatar Central",
		"centralusstage":      "Central US (Stage)",
		"eastusstage":         "East US (Stage)",
		"eastus2stage":        "East US 2 (Stage)",
		"northcentralusstage": "North Central US (Stage)",
		"southcentralusstage": "South Central US (Stage)",
		"westusstage":         "West US (Stage)",
		"westus2stage":        "West US 2 (Stage)",
		"asia":                "Asia",
		"asiapacific":         "Asia Pacific",
		"australia":           "Australia",
		"brazil":              "Brazil",
		"canada":              "Canada",
		"europe":              "Europe",
		"france":              "France",
		"germany":             "Germany",
		"global":              "Global",
		"india":               "India",
		"japan":               "Japan",
		"korea":               "Korea",
		"norway":              "Norway",
		"singapore":           "Singapore",
		"southafrica":         "South Africa",
		"sweden":              "Sweden",
		"switzerland":         "Switzerland",
		"uae":                 "United Arab Emirates",
		"uk":                  "United Kingdom",
		"unitedstates":        "United States",
		"unitedstateseuap":    "United States EUAP",
		"eastasiastage":       "East Asia (Stage)",
		"southeastasiastage":  "Southeast Asia (Stage)",
		"brazilus":            "Brazil US",
		"eastusstg":           "East US STG",
		"northcentralus":      "North Central US",
		"westus":              "West US",
		"japanwest":           "Japan West",
		"jioindiawest":        "Jio India West",
		"eastus2euap":         "East US 2 EUAP",
		"westcentralus":       "West Central US",
		"southafricawest":     "South Africa West",
		"australiacentral":    "Australia Central",
		"australiacentral2":   "Australia Central 2",
		"australiasoutheast":  "Australia Southeast",
		"jioindiacentral":     "Jio India Central",
		"koreasouth":          "Korea South",
		"southindia":          "South India",
		"westindia":           "West India",
		"canadaeast":          "Canada East",
		"francesouth":         "France South",
		"germanynorth":        "Germany North",
		"norwaywest":          "Norway West",
		"switzerlandwest":     "Switzerland West",
		"ukwest":              "UK West",
		"uaecentral":          "UAE Central",
		"brazilsoutheast":     "Brazil Southeast",
		"usgovvirginia":       "US Gov Virginia",
		"usgovarizona":        "US Gov Arizona",
		"usgovtexas":          "US Gov Texas",
	}[l]

	if name == "" {
		return l
	}

	return name
}

// regionToVNETZone returns the VNET zone for a given region.
//
// Mapped based on the values here: https://azure.microsoft.com/en-us/pricing/details/virtual-network/#faq
func regionToVNETZone(region string) string {
	return map[string]string{
		"eastus":              "Zone 1",
		"eastus2":             "Zone 1",
		"southcentralus":      "Zone 1",
		"westus2":             "Zone 1",
		"westus3":             "Zone 1",
		"australiaeast":       "Zone 2",
		"southeastasia":       "Zone 2",
		"northeurope":         "Zone 1",
		"swedencentral":       "Zone 1",
		"uksouth":             "Zone 1",
		"westeurope":          "Zone 1",
		"centralus":           "Zone 1",
		"southafricanorth":    "Zone 3",
		"centralindia":        "Zone 2",
		"eastasia":            "Zone 2",
		"japaneast":           "Zone 2",
		"koreacentral":        "Zone 2",
		"canadacentral":       "Zone 1",
		"francecentral":       "Zone 1",
		"germanywestcentral":  "Zone 1",
		"italynorth":          "Zone 1",
		"norwayeast":          "Zone 1",
		"polandcentral":       "Zone 1",
		"switzerlandnorth":    "Zone 1",
		"uaenorth":            "Zone 3",
		"brazilsouth":         "Zone 3",
		"centraluseuap":       "Zone 1",
		"israelcentral":       "Zone 1",
		"qatarcentral":        "Zone 1",
		"centralusstage":      "Zone 1",
		"eastusstage":         "Zone 1",
		"eastus2stage":        "Zone 1",
		"northcentralusstage": "Zone 1",
		"southcentralusstage": "Zone 1",
		"westusstage":         "Zone 1",
		"westus2stage":        "Zone 1",
		"asia":                "Zone 1",
		"asiapacific":         "Zone 1",
		"australia":           "Zone 1",
		"brazil":              "Zone 3",
		"canada":              "Zone 1",
		"europe":              "Zone 1",
		"france":              "Zone 1",
		"germany":             "Zone 1",
		"india":               "Zone 2",
		"japan":               "Zone 2",
		"korea":               "Zone 2",
		"norway":              "Zone 1",
		"singapore":           "Zone 1",
		"southafrica":         "Zone 3",
		"sweden":              "Zone 1",
		"switzerland":         "Zone 1",
		"uae":                 "Zone 3",
		"uk":                  "Zone 1",
		"unitedstates":        "Zone 1",
		"unitedstateseuap":    "Zone 1",
		"eastasiastage":       "Zone 2",
		"southeastasiastage":  "Zone 2",
		"brazilus":            "Zone 1",
		"eastusstg":           "Zone 1",
		"northcentralus":      "Zone 1",
		"westus":              "Zone 1",
		"japanwest":           "Zone 2",
		"jioindiawest":        "Zone 1",
		"eastus2euap":         "Zone 1",
		"westcentralus":       "Zone 1",
		"southafricawest":     "Zone 3",
		"australiacentral":    "Zone 1",
		"australiacentral2":   "Zone 1",
		"australiasoutheast":  "Zone 2",
		"jioindiacentral":     "Zone 2",
		"koreasouth":          "Zone 2",
		"southindia":          "Zone 2",
		"westindia":           "Zone 2",
		"canadaeast":          "Zone 1",
		"francesouth":         "Zone 1",
		"germanynorth":        "Zone 1",
		"norwaywest":          "Zone 1",
		"switzerlandwest":     "Zone 1",
		"ukwest":              "Zone 1",
		"uaecentral":          "Zone 3",
		"brazilsoutheast":     "Zone 3",
		"usgovvirginia":       "US Gov Zone 1",
		"usgovarizona":        "US Gov Zone 1",
		"usgovtexas":          "US Gov Zone 1",
	}[region]
}

// https://learn.microsoft.com/en-us/azure/cdn/cdn-billing#what-is-a-billing-region
func regionToCDNZone(region string) string {
	return map[string]string{
		"eastus":              "Zone 1",
		"eastus2":             "Zone 1",
		"southcentralus":      "Zone 1",
		"westus2":             "Zone 1",
		"westus3":             "Zone 1",
		"australiaeast":       "Zone 4",
		"southeastasia":       "Zone 2",
		"northeurope":         "Zone 1",
		"swedencentral":       "Zone 1",
		"uksouth":             "Zone 1",
		"westeurope":          "Zone 1",
		"centralus":           "Zone 1",
		"southafricanorth":    "Zone 1",
		"centralindia":        "Zone 5",
		"eastasia":            "Zone 2",
		"japaneast":           "Zone 2",
		"koreacentral":        "Zone 2",
		"canadacentral":       "Zo
```

### Core Architecture Module: `internal/providers/terraform/google/util.go`
```
package google

import (
	"regexp"
	"strings"

	"github.com/shopspring/decimal"
)

var defaultVolumeSize = 10

func intPtr(i int64) *int64 {
	return &i
}

func strPtr(s string) *string {
	return &s
}

// nolint:deadcode,unused
func floatPtr(f float64) *float64 {
	return &f
}

func decimalPtr(d decimal.Decimal) *decimal.Decimal {
	return &d
}

func isZone(location string) bool {
	if matched, _ := regexp.MatchString(`^\w+-\w+-\w+$`, location); matched {
		return true
	}
	return false
}

func zoneToRegion(zone string) string {
	s := strings.Split(zone, "-")
	return strings.Join(s[:len(s)-1], "-")
}

func contains(a []string, x string) bool {
	for _, n := range a {
		if x == n {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `internal/providers/terraform/state_json_provider.go`
```
package terraform

import (
	"os"

	"github.com/pkg/errors"

	"github.com/infracost/infracost/internal/config"
	"github.com/infracost/infracost/internal/logging"
	"github.com/infracost/infracost/internal/schema"
)

type StateJSONProvider struct {
	ctx                  *config.ProjectContext
	Path                 string
	includePastResources bool
}

func NewStateJSONProvider(ctx *config.ProjectContext, includePastResources bool) schema.Provider {
	return &StateJSONProvider{
		ctx:                  ctx,
		Path:                 ctx.ProjectConfig.Path,
		includePastResources: includePastResources,
	}
}

func (p *StateJSONProvider) ProjectName() string {
	return config.CleanProjectName(p.ctx.ProjectConfig.Path)
}

func (p *StateJSONProvider) VarFiles() []string {
	return nil
}

func (p *StateJSONProvider) RelativePath() string {
	return p.ctx.ProjectConfig.Path
}

func (p *StateJSONProvider) Context() *config.ProjectContext { return p.ctx }

func (p *StateJSONProvider) Type() string {
	return "terraform_state_json"
}

func (p *StateJSONProvider) DisplayType() string {
	return "Terraform state JSON file"
}

func (p *StateJSONProvider) AddMetadata(metadata *schema.ProjectMetadata) {
	metadata.ConfigSha = p.ctx.ProjectConfig.ConfigSha
}

func (p *StateJSONProvider) LoadResources(usage schema.UsageMap) ([]*schema.Project, error) {
	logging.Logger.Debug().Msg("Extracting only cost-related params from terraform")

	j, err := os.ReadFile(p.Path)
	if err != nil {
		return []*schema.Project{}, errors.Wrap(err, "Error reading Terraform state JSON file")
	}

	metadata := schema.DetectProjectMetadata(p.ctx.ProjectConfig.Path)
	metadata.Type = p.Type()
	p.AddMetadata(metadata)
	name := p.ctx.ProjectConfig.Name
	if name == "" {
		name = metadata.GenerateProjectName(p.ctx.RunContext.VCSMetadata.Remote, p.ctx.RunContext.IsCloudEnabled())
	}

	project := schema.NewProject(name, metadata)
	parser := NewParser(p.ctx, p.includePastResources)

	j, _ = StripSetupTerraformWrapper(j)
	parsedConf, err := parser.parseJSON(j, usage)
	if err != nil {
		return []*schema.Project{project}, errors.Wrap(err, "Error parsing Terraform state JSON file")
	}

	project.AddProviderMetadata(parsedConf.ProviderMetadata)

	project.PartialPastResources = parsedConf.PastResources
	project.PartialResources = parsedConf.CurrentResources

	return []*schema.Project{project}, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3466** (2025-12-11): **BUG: 'Error loading Terraform modules // Missing argument separator' error with variable validation block**
  *Symptoms*: One of my terraform modules has two variables which have validation blocks that use provider functions:  ```hcl variable "zendesk_alert_topics" {   type = object({     us_east_1 : string     eu_west_2 : string   })    description = "The ARNs of the SNS topics to use to send an alert to Zendesk, per region"    validation {     condition     = alltrue([for p, arn in tomap(var.zendesk_alert_topics) : can(provider::aws::arn_parse(arn))])     error_message = "All values must be valid ARNs"   } }  variable "pagerduty_alert_topics" {   type = object({     eu_west_2 : string   })    description = "The ARNs of the SNS topics to use to send an alert to PagerDuty, per region"    validation {     condition     = alltrue([for p, arn in tomap(var.pagerduty_alert_topics) : can(provider::aws::arn_parse(arn))])     error_message = "All values must be valid ARNs"   } } ```  There's no CLI when running a diff or breakdown, but when using the github PR comment feature as demonstrated in the example workflow, we see the following:  ```markdown <h3>💰 Infracost report</h3>  This pull request is aligned with your company's FinOps policies and the Well-Architected Framework. <details >   <summary><b>Monthly estimate generated</b></summary>   <br/>    <details>   <summary>Estimate details (includes details of unsupported resources and skipped projects due to errors)</summary>   ────────────────────────────────── Project: some-project Module path: path/to/module Errors:  Error loading Terraform module
  **Post-Mortem & Fix Analysis**:
  > @whi-tw thanks for reporting 🙏 . This is fixed in the master build now and will go out with the next release.
  > Released in https://github.com/infracost/infracost/releases/tag/v0.10.43, thanks @whi-tw 🙏 

- **Issue #3375** (2025-05-26): **Cost for Azure SQL DB within elastic pool calculated incorrectly**
  *Symptoms*: We have 4 databases within an elastic pool, hence the compute cost is billed once per elastic pool (not per single DB). If we now add a new DB to the elastic pool, infracost considers the DB to be billed as single DB and shows a cost increase for compute that is incorrect.  ![Image](https://github.com/user-attachments/assets/25679909-f2d8-460b-a643-cd2ad56de07f)
  **Post-Mortem & Fix Analysis**:
  > @bertsch-ronja-office do you have any snippets of Terraform code we can use to reproduce this issue?

- **Issue #3370** (2025-12-11): **`azurerm_postgresql_flexible_server` missing cost for `high_availability`**
  *Symptoms*: When `high_availability` is specified for the resource, it should detect that and (I assume) double the monthly hours for the resource. Currently the output is the same whether or not high_availability is specified.  Resource from plan output: ``` # module.db_postgres.module.db.azurerm_postgresql_flexible_server.this will be created + resource "azurerm_postgresql_flexible_server" "this" {       + administrator_password        = (sensitive value)       + auto_grow_enabled             = true       + backup_retention_days         = 7       + fqdn                          = (known after apply)       + geo_redundant_backup_enabled  = false       + id                            = (known after apply)       + location                      = "eastus"       + name                          = "db-stage"       + private_dns_zone_id           = (known after apply)       + public_network_access_enabled = true       + resource_group_name           = "rg-pgdb-eastus-stage"       + sku_name                      = "GP_Standard_D2ads_v5"       + storage_mb                    = 32768       + storage_tier                  = "P6"       + version                       = "16"       + zone                          = "1"        + authentication (known after apply)        + high_availability {           + mode                      = "SameZone"           + standby_availability_zone = "1"         }     } ```  `infracost breakdown` output: ```  Name                                                          
  **Post-Mortem & Fix Analysis**:
  > @aliscott Hi, please assign it to me. I would like to try fixing it. 
  > Released in https://github.com/infracost/infracost/releases/tag/v0.10.43, thanks @apicht 🙏 

- **Issue #3352** (2025-07-24): **Github calls rate limited due to new public/private module checks in v0.10.41**
  *Symptoms*: ### Issue Description The new module checks added in v0.10.41 [PR #3311](https://github.com/infracost/infracost/pull/3311) are causing GitHub rate limiting issues. The current implementation makes unauthenticated HEAD requests to check if modules are public or private, which are subject to GitHub's rate limit of 60 requests per hour per IP address - [ Ref Github Documentation](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28#primary-rate-limit-for-unauthenticated-users)  **Current Implementation** The `HttpPublicModuleChecker.IsPublicModule` function uses a simple HEAD request to check if a module is public: ``` func (h *HttpPublicModuleChecker) IsPublicModule(moduleAddr string) (bool, error) { 	u := strings.TrimPrefix(moduleAddr, "git::")  	parsedUrl, err := url.Parse(u) 	if err != nil { 		return false, err 	}  	if parsedUrl.Scheme == "" { 		parsedUrl.Scheme = "https" 	}  	req, err := http.NewRequest("HEAD", parsedUrl.String(), nil) 	if err != nil { 		return false, err 	}  	resp, err := h.client.Do(req) 	if err != nil { 		return false, err 	} 	defer resp.Body.Close()  	return resp.StatusCode == http.StatusOK, nil } ``` **Issues with Current Implementation**  `parsedUrl.String()` strips just the URL without any authentication credentials. Unauthenticated requests are subject to GitHub's rate limit (60 requests/hour). Simply checking for HTTP 200 status doesn't reliably distinguish between public/private repositories. No han
  **Post-Mortem & Fix Analysis**:
  > Hi @abhishekbvs7   Can I ask for a little more information about where you are seeing the rate limiting errors and what exact output you're getting?  The documentation you cited applies to the REST API (`api.github.com`), but not to `github.com` requests, so I think perhaps something else is triggering the rate limits here? We currently use this with much more than 60 requests/h from the same IPs and don't see any issues, so I think something else is going on.  Either way, I've created a PR to avoid making those requests when not needed, as they are only required when using a remote cache and should not be made all of the time - see https://github.com/infracost/infracost/pull/3353  
  > @liamg Basically when our infracost workflows are executed, we're seeing that our Public NAT IP is getting blacklisted by GitHub. The GitHub team confirmed they are blocking our IP as a protective measure because GitHub's automatic DDoS detection began triggering due to a high volume (more than 250 requests per second) of unauthenticated requests targeting a particular repo URL where our private terraform modules are hosted. These requests contain the `Go-http-client/2.0` user agent.  It seems this isn't triggering the standard API rate limiting which I mentioned earlier, but rather some internal GitHub security system is detecting this pattern as an anomaly or potential attack. The issue appears to be with the volume and pattern of requests to `github.com` coming from our NAT IP when multiple workflows run concurrently.   Also, may I know how many times will this above mentioned function be called to quantify the volume of requests made by infracost to github? This would help us under
  > @abhishekbvs7 Thanks, that makes sense. This is currently being called once for each unique remote module download.

- **Issue #3218** (2026-04-27): **google_container_node_pool change isn't calculated**
  *Symptoms*: Hello,  Using v0.10.39  I've made machine type changes to 2 Node Pools in my tfvars under my Terraform module: terraform plan: ```   # google_container_node_pool.nodes["0"] must be replaced -/+ resource "google_container_node_pool" "nodes" { ~ node_config { ...           ~ disk_size_gb      = 100 -> (known after apply)           ~ disk_type         = "pd-balanced" -> (known after apply)           ~ guest_accelerator = [] -> (known after apply)           ~ image_type        = "COS_CONTAINERD" -> (known after apply)           ~ local_ssd_count   = 0 -> (known after apply)           ~ machine_type      = "n2-standard-48" -> "n1-standard-16" # forces replacement ...  ``` ```   # google_container_node_pool.nodes["1"] must be replaced -/+ resource "google_container_node_pool" "nodes" { ~ node_config { ...         name                        = "node-pool-2"       + name_prefix                 = (known after apply)       ~ node_count                  = 4 -> (known after apply)       + operation                   = (known after apply)       ~ project                     = "project" -> (known after apply)          machine_type      = "e2-standard-4" -> "e2-standard-8" # forces replacement       ~ version                     = "1.29.8-gke.1031000" -> (known after apply) ...         } ```  In my PR with the node_pool machine type change, I create a diff from master like so: ``` + git checkout master --quiet + infracost breakdown --path terraform/goo
  **Post-Mortem & Fix Analysis**:
  > Update after running `infracost breakdown --path . --format=json | jq ".summary.unsupportedResourceCounts`:  `WARN 1 google_container_node_pool price missing across 1 resource`  Is this related to the region I'm running on? 
  > @illmaticz are you able to run with `--log-level=debug` and look for any lines that start with `DEBUG No products found for`. This should give us the parameters that are looked up in the pricing database so we can check why they aren't being found.
  > Hey @aliscott, thanks for looking into this - I am still getting the same output, I changed logging level to debug from trace as follows: ``` curl -fsSL https://raw.githubusercontent.com/infracost/infracost/master/scripts/install.sh Downloading version latest of infracost-linux-amd64... Validating checksum for infracost-linux-amd64... Moving /tmp/infracost-linux-amd64 to /usr/local/bin/infracost (you might be asked for your password due to sudo)  Completed installing Infracost v0.10.39 + export INFRACOST_TERRAFORM_CLOUD_TOKEN=**** + export INFRACOST_API_KEY=**  + export INFRACOST_TERRAFORM_WORKSPACE=google_kubernetes_engine_development  + echo INFRACOST_TERRAFORM_WORKSPACE is set to: google_kubernetes_engine_development  INFRACOST_TERRAFORM_WORKSPACE is set to: google_kubernetes_engine_development + git checkout master --quiet  + test -f terraform/google_kubernetes_engine/tfvars/dev.tfvars  + infracost breakdown --path terraform/google_kubernetes_engine --terraform-

- **Issue #3087** (2026-04-06): **Failed calculating breakdown cost of google_compute_region_instance_group_manager**
  *Symptoms*: I am running Infracost on my Terraform plan output. I use API requests for the `/breakdown` path. In my plan, I have an existing resource with no changes with the type `google_compute_region_instance_group_manager`. When running Infracost, the results of the past breakdown of the monthly cost of the resource seem correct, while the results of the breakdown are always zero. Therefore, the monthly cost diff always shows a decrease in cost even when no resources were changed.  ### HCL code: ``` resource "google_compute_region_instance_group_manager" "instance_group_us_east4" {   provider = google-beta   name     = "instance-group-us-east4"    base_instance_name               = "instance-us-east4"   region                           = "us-east4"   distribution_policy_zones        = ["us-east4-a", "us-east4-b", "us-east4-c"]   distribution_policy_target_shape = "EVEN"    version {     instance_template = data.google_compute_instance_template.instance_template.self_link   }    auto_healing_policies {     health_check      = google_compute_health_check.instance_health_check.self_link     initial_delay_sec = 120   }    update_policy {     instance_redistribution_type   = "PROACTIVE"     max_surge_fixed                = 3     max_unavailable_fixed          = 3     minimal_action                 = "REPLACE"     replacement_method             = "SUBSTITUTE"     type                           = "OPPORTUNISTIC"     most_disruptive_allowed_action = "REPLACE" 
  **Post-Mortem & Fix Analysis**:
  > @YuvalFireFly one thing I'm noticing is the instance type is missing? I wonder if this is causing the issue.
  > > @YuvalFireFly one thing I'm noticing is the instance type is missing? I wonder if this is causing the issue.  @aliscott What do you mean by instance type? There is no such field in `google_compute_region_instance_group_manager`
  > @YuvalFireFly, sorry I mean `machine_type`, which it gets from the `google_compute_instance_template` resource.

- **Issue #3064** (2026-04-06): **Infracost fails to display ecs service costs when using `terraform-aws-ecs` module**
  *Symptoms*: Infracost fails to display service costs when users use the [terraform-aws-ecs](https://github.com/terraform-aws-modules/terraform-aws-ecs) module to provision ecs Fargate services. This because the task definition (which defines the memory and cpu boundaries) is referenced in the module through a task set. Infracost does not currently support using `aws_ecs_task_set` to reference a task definition.

- **Issue #3011** (2024-04-29): **`--debug-report` flag throws an error**
  *Symptoms*: A user reported this issue in #3010.  When running a CLI command with `--debug-report` flag it throws an error:  ``` $ infracost breakdown --path=examples/terraform --debug-report ```  ``` [ 2024-04-10T10:32:30+01:00 DBG IsCloudEnabled inferred from Config.EnabledDashboard is_cloud_enabled=false, �[91mError:�[0m An unexpected error occurred  bytes.Buffer.WriteTo: invalid Write count goroutine 1 [running]: runtime/debug.Stack() 	/opt/hostedtoolcache/go/1.22.1/x64/src/runtime/debug/stack.go:24 +0x5e main.Run.func1() 	/home/runner/work/infracost/infracost/cmd/infracost/main.go:78 +0xb4 panic({0x29e26e0?, 0x3b30380?}) 	/opt/hostedtoolcache/go/1.22.1/x64/src/runtime/panic.go:770 +0x132 bytes.(*Buffer).WriteTo(0xc0004c9d70, {0x3b36100?, 0xc000099010?}) 	/opt/hostedtoolcache/go/1.22.1/x64/src/bytes/buffer.go:263 +0xee github.com/rs/zerolog.ConsoleWriter.Write({{0x3b36100, 0xc000099010}, 0x1, {0x33dac7f, 0x19}, {0xc00024f080, 0x4, 0x4}, {0x0, 0x0, ...}, ...}, ...) 	/home/runner/go/pkg/mod/github.com/rs/zerolog@v1.31.0/console.go:145 +0x5c5 github.com/rs/zerolog.LevelWriterAdapter.WriteLevel(...) 	/home/runner/go/pkg/mod/github.com/rs/zerolog@v1.31.0/writer.go:27 github.com/rs/zerolog.(*Event).write(0xc000499a40) 	/home/runner/go/pkg/mod/github.com/rs/zerolog@v1.31.0/event.go:80 +0x103 github.com/rs/zerolog.(*Event).msg(0xc000499a40, {0x347255b, 0x34}) 	/home/runner/go/pkg/mod/github.com/rs/zerolog@v1.31.0/event.go:151 +0x21a github.com/rs/zerolog.(*Even

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

### Incident Patch 1: `cb7459dc` (2026-09-24)
**Commit Message**: fix(deps): bump golang.org/x/crypto to v0.56.0 and klauspost/compress to v1.18.7 (#3623)

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -40,7 +40,7 @@ require (
 	github.com/stretchr/testify v1.11.1
 	github.com/tidwall/gjson v1.17.0
 	github.com/zclconf/go-cty v1.17.0
-	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/crypto v0.56.0 // indirect
 	golang.org/x/mod v0.40.0
 	gopkg.in/go-playground/assert.v1 v1.2.1
 	gopkg.in/yaml.v2 v2.4.0
@@ -294,7 +294,7 @@ require (
 	github.com/hashicorp/go-version v1.6.0
 	github.com/heimdalr/dag v1.3.1
 	github.com/iancoleman/orderedmap v0.2.0 // indirect
-	github.com/klauspost/compress v1.18.0 // indirect
+	github.com/klauspost/compress v1.18.7 // indirect
 	github.com/mitchellh/go-testing-interface v1.14.1 // indirect
 	github.com/open-policy-agent/opa v1.6.0
 	github.com/otiai10/copy v1.7.0
```

**File**: `go.sum` (modified, +4/-4)
```diff
@@ -1400,8 +1400,8 @@ github.com/klauspost/asmfmt v1.3.2/go.mod h1:AG8TuvYojzulgDAMCnYn50l/5QV3Bs/tp6j
 github.com/klauspost/compress v1.4.1/go.mod h1:RyIbtBH6LamlWaDj8nUwkbUhJ87Yi3uG0guNDohfE1A=
 github.com/klauspost/compress v1.15.9/go.mod h1:PhcZ0MbTNciWF3rruxRgKxI5NkcHHrHUDtV4Yw2GlzU=
 github.com/klauspost/compress v1.15.11/go.mod h1:QPwzmACJjUTFsnSHH934V6woptycfrDDJnH7hvFVbGM=
-github.com/klauspost/compress v1.18.0 h1:c/Cqfb0r+Yi+JtIEq73FWXVkRonBlf0CRNYc8Zttxdo=
-github.com/klauspost/compress v1.18.0/go.mod h1:2Pp+KzxcywXVXMr50+X0Q/Lsb43OQHYWRCY2AiWywWQ=
+github.com/klauspost/compress v1.18.7 h1:aUyZsS4kH3QTKurYhAOwAHxllVPnOthb3vPfnF1Ehjw=
+github.com/klauspost/compress v1.18.7/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
 github.com/klauspost/cpuid v1.2.0/go.mod h1:Pj4uuM528wm8OyEC2QMXAi2YiTZ96dNQPGgoMS4s3ek=
 github.com/klauspost/cpuid/v2 v2.0.9/go.mod h1:FInQzS24/EEf25PyTYn52gqo7WaD8xa0213Md/qVLRg=
 github.com/klauspost/cpuid/v2 v2.3.0 h1:S4CRMLnYUhGeDFDqkGriYKdfoFlDnMtqTiI/sFzhA9Y=
@@ -1886,8 +1886,8 @@ golang.org/x/crypto v0.38.0/go.mod h1:MvrbAqul58NNYPKnOra203SB9vpuZW0e+RRZV+Ggqj
 golang.org/x/crypto v0.39.0/go.mod h1:L+Xg3Wf6HoL4Bn4238Z6ft6KfEpN0tJGo53AAPC632U=
 golang.org/x/crypto v0.40.0/go.mod h1:Qr1vMER5WyS2dfPHAlsOj01wgLbsyWtFn/aY+5+ZdxY=
 golang.org/x/crypto v0.41.0/go.mod h1:pO5AFd7FA68rFak7rOAGVuygIISepHftHnr8dr6+sUc=
-golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
-golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
+golang.org/x/crypto v0.56.0 h1:GUh5Ii4J5jtcseSMiRqr1jXCNHoxjeV9Fmekc2oLy6Y=
+golang.org/x/crypto v0.56.0/go.mod h1:OMW5y6CY9l38uPLmxU6l6pwcXp1obtLo3e6gT7gQR2I=
 golang.org/x/exp v0.0.0-20180321215751-8460e604b9de/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20180807140117-3d87b88a115f/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
```

---

### Incident Patch 2: `16b6b00a` (2026-09-24)
**Commit Message**: fix(aws): exclude CloudWatch Omni from Logs Insights query pricing (#3622)

**File**: `internal/resources/aws/cloudwatch_log_group.go` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ func (r *CloudwatchLogGroup) BuildResource() *schema.Resource {
 					Service:       strPtr("AmazonCloudWatch"),
 					ProductFamily: strPtr("Data Payload"),
 					AttributeFilters: []*schema.AttributeFilter{
-						{Key: "usagetype", ValueRegex: strPtr("/-DataScanned-Bytes/")},
+						{Key: "usagetype", ValueRegex: strPtr("/^[A-Z0-9]+-DataScanned-Bytes$/")},
 					},
 				},
 				UsageBased: true,
```

---

### Incident Patch 3: `8669861a` (2026-09-21)
**Commit Message**: fix(azure): match renamed PostgreSQL Flexible Server storage price (#3620)

* fix(azure): match renamed PostgreSQL Flexible Server storage product

Azure renamed the product from "Az DB for PostgreSQL Flexible Server
Storage" to "Azure Database for PostgreSQL Flex Server Storage", so
every azurerm_postgresql_flexible_server Storage cost component priced
as not found. Accept both names since Delos Cloud regions still
publish the old one.

* test: update golden files for GCP preemptible and AWS SSM price changes

AWS removed the SSM advanced-instances hourly charge and GCP repriced
preemptible/spot instances. Regenerated the affected goldens.

* test: regenerate hcl provider plan JSON for upstream s3-bucket module

The fixture pulls terraform-aws-s3-bucket without a version or ref, so
the expected plan JSON drifts whenever upstream releases. Regenerated
against the current module.

* test: normalise testdata paths in checkouts containing a dot

pathRegex could not traverse a path component with a dot in it, so
REPLACED_PROJECT_PATH substitution silently no-opped in checkouts like
.hh/workspaces and golden comparisons failed on absolute paths.

* test: pin azurerm provider to v4 in th

**File**: `cmd/infracost/cmd_test.go` (modified, +4/-2)
```diff
@@ -33,8 +33,10 @@ var (
 	projectPathRegex = regexp.MustCompile(`(Project:) .*/(examples|cmd/infracost)/(.*)`)
 	versionRegex     = regexp.MustCompile(`Infracost (v|preview).*`)
 	panicRegex       = regexp.MustCompile(`(?s)runtime\serror:(.*?)Environment`)
-	pathRegex        = regexp.MustCompile(`(:\s*"|^|\s|')([a-zA-Z0-9-_/]+/)*(testdata/[^\s"']*)`)
-	credsRegex       = regexp.MustCompile(`/.*/credentials\.yml`)
+	// The prefix must start with a non-dot character so that a leading "./" is
+	// left alone, while still traversing dotted directories such as ".hh".
+	pathRegex  = regexp.MustCompile(`(:\s*"|^|\s|')([a-zA-Z0-9-_/]+[a-zA-Z0-9-_./]*/)*(testdata/[^\s"']*)`)
+	credsRegex = regexp.MustCompile(`/.*/credentials\.yml`)
 )
 
 type GoldenFileOptions = struct {
```

**File**: `internal/providers/terraform/aws/testdata/ssm_activation_test/ssm_activation_test.golden` (modified, +10/-10)
```diff
@@ -1,13 +1,13 @@
 
- Name                                             Monthly Qty  Unit                Monthly Cost    
-                                                                                                   
- aws_ssm_activation.ssm_activation_withUsage                                                       
- └─ On-prem managed instances (advanced)               73,000  hours                    $507.35  * 
-                                                                                                   
- aws_ssm_activation.ssm_activation                                                                 
- └─ On-prem managed instances (advanced)      Monthly cost depends on usage: $0.00695 per hours    
-                                                                                                   
- OVERALL TOTAL                                                                          $507.35 
+ Name                                            Monthly Qty  Unit              Monthly Cost    
+                                                                                                
+ aws_ssm_activation.ssm_activation_withUsage                                                    
+ └─ On-prem managed instances (advanced)              73,000  hours                    $0.00  * 
+                                                                                                
+ aws_ssm_activation.ssm_activation                                                              
+ └─ On-prem managed instances (advanced)      Monthly cost depends on usage: $0.00 per hours    
+                                                                                                
+ OVERALL TOTAL                                                                         $0.00 
 
 *Usage costs can be estimated by updating Infracost Cloud settings, see docs for other options.
 
@@ -18,5 +18,5 @@
 ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━┳━━━━━━━━━━━━┓
 ┃ Project                                            ┃ Baseline cost ┃ Usage cost* ┃ Total cost ┃
 ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━╋━━━━━━━━━━━━┫
-┃ main                                               ┃         $0.00 ┃        $507 ┃       $507 ┃
+┃ main                                               ┃         $0.00 ┃           - ┃      $0.00 ┃
 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━┻━━━━━━━━━━━━┛
\ No newline at end of file
```

**File**: `internal/providers/terraform/google/testdata/compute_instance_test/compute_instance_test.golden` (modified, +15/-15)
```diff
@@ -10,16 +10,16 @@
  ├─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
  └─ NVIDIA Tesla K80 (on-demand)                                         2,920  hours       $919.80   
                                                                                                       
+ google_compute_instance.preemptible_gpu                                                              
+ ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               730  hours       $329.27   
+ ├─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
+ └─ NVIDIA Tesla K80 (preemptible)                                       2,920  hours       $501.95   
+                                                                                                      
  google_compute_instance.gpu_l4                                                                       
  ├─ Instance usage (Linux/UNIX, on-demand, g2-standard-4)                  730  hours       $515.99   
  ├─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
  └─ NVIDIA L4 (on-demand)                                                  730  hours       $286.18   
                                                                                                       
- google_compute_instance.preemptible_gpu                                                              
- ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               730  hours       $169.39   
- ├─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
- └─ NVIDIA Tesla K80 (preemptible)                                       2,920  hours       $501.95   
-                                                                                                      
  google_compute_instance.sud_20_perc_with_hours                                                       
  ├─ Instance usage (Linux/UNIX, on-demand, n2-standard-8)                  730  hours       $226.87   
  └─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
@@ -44,31 +44,31 @@
  ├─ Custom Instance RAM (Linux/UNIX, on-demand, N1 20 GB)                  730  hours        $45.44   
  └─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
                                                                                                       
+ google_compute_instance.custom_preemptible                                                           
+ ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)              730  hours        $86.24   
+ ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)                730  hours        $38.54   
+ └─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
+                                                                                                      
  google_compute_instance.custom_ext                                                                   
  ├─ Custom instance CPU (Linux/UNIX, on-demand, N1 2 vCPUs)                730  hours        $33.92   
  ├─ Custom Instance RAM (Linux/UNIX, on-demand, N1 13 GB)                  730  hours        $29.53   
  ├─ Custom Instance Extended RAM (Linux/UNIX, on-demand, N1 2 GB)          730  hours         $9.76   
  └─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
                                                                                                       
- google_compute_instance.custom_preemptible                                                           
- ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)              730  hours        $44.41   
- ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)                730  hours        $19.84   
- └─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
-                                                                                                      
  google_compute_instance.local_ssd                                                                    
  ├─ Instance usage (Linux/UNIX, on-demand, f1-micro)                       730  hours         $3.88   
  ├─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
  └─ Local SSD provisioned storage                                          750  GB           $60.00   
                                                                                                       
  google_compute_instance.custom_n2d                                                                   
- ├─ Custom instance CPU (Linux/UNIX, preemptible, N2D 4 vCPUs)             730  hours        $20.18   
- ├─ Custom Instance RAM (Linux/UNIX, preemptible, N2D 20 GB)           
```

**File**: `internal/providers/terraform/google/testdata/container_cluster_test/container_cluster_test.golden` (modified, +25/-25)
```diff
@@ -10,7 +10,7 @@
  │  ├─ Instance usage (Linux/UNIX, on-demand, n1-standard-16)                 8,760  hours                  $4,660.30    
  │  └─ Standard provisioned storage (pd-standard)                             1,200  GB                        $48.00    
  └─ node_pool[1]                                                                                                         
-    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $2,032.67    
+    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $3,951.29    
     └─ Standard provisioned storage (pd-standard)                             1,200  GB                        $48.00    
                                                                                                                          
  google_container_cluster.with_node_pools_regional                                                                       
@@ -22,17 +22,9 @@
  │  ├─ Instance usage (Linux/UNIX, on-demand, n1-standard-16)                 4,380  hours                  $2,330.15    
  │  └─ Standard provisioned storage (pd-standard)                               600  GB                        $24.00    
  └─ node_pool[1]                                                                                                         
-    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $2,032.67    
+    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $3,951.29    
     └─ Standard provisioned storage (pd-standard)                             1,200  GB                        $48.00    
                                                                                                                          
- google_container_cluster.with_node_config                                                                               
- ├─ Cluster management fee                                                      730  hours                     $73.00    
- └─ default_pool                                                                                                         
-    ├─ Instance usage (Linux/UNIX, on-demand, n1-standard-16)                 2,190  hours                  $1,165.07    
-    ├─ SSD provisioned storage (pd-ssd)                                         360  GB                        $61.20    
-    ├─ Local SSD provisioned storage                                          1,125  GB                        $90.00    
-    └─ NVIDIA Tesla K80 (on-demand)                                           8,760  hours                  $2,759.40    
-                                                                                                                         
  google_container_cluster.with_node_pools_node_locations_withUsage                                                       
  ├─ Cluster management fee                                                      730  hours                     $73.00    
  ├─ default_pool                                                                                                         
@@ -42,9 +34,26 @@
  │  ├─ Instance usage (Linux/UNIX, on-demand, n1-standard-16)                 5,840  hours                  $3,106.86    
  │  └─ Standard provisioned storage (pd-standard)                               800  GB                        $32.00    
  └─ node_pool[1]                                                                                                         
-    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               2,920  hours                    $677.56    
+    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               2,920  hours                  $1,317.10    
     └─ Standard provisioned storage (pd-standard)                               400  GB                        $16.00    
                                                                                                                          
+ google_container_cluster.with_unsupported_node_pool                                                                     
+ ├─ Cluster management fee                                                      730  hours                     $73.00    
+ ├─ default_pool                                                                                                         
+ │  ├─ Instance usage (Linux/UNIX, on-demand, e2-medium)                      6,570  hours                    $220.13    
+ │  └─ Standard provisioned storage (pd-standard)                               900  GB                        $36.00    
+ └─ node_pool[1]                                                                                                         
+    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $3,951.29    
+    └─ Standard provisi
```

**File**: `internal/providers/terraform/google/testdata/container_node_pool_test/container_node_pool_test.golden` (modified, +12/-12)
```diff
@@ -18,6 +18,16 @@
  ├─ Custom Instance RAM (Linux/UNIX, on-demand, N1 20 GB)            2,190  hours       $136.31   
  └─ Standard provisioned storage (pd-standard)                         300  GB           $12.00   
                                                                                                   
+ google_container_node_pool.with_preemptible_instance                                             
+ ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)        2,190  hours       $258.73   
+ ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)          2,190  hours       $115.63   
+ └─ Standard provisioned storage (pd-standard)                         300  GB           $12.00   
+                                                                                                  
+ google_container_node_pool.with_spot_instance                                                    
+ ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)        2,190  hours       $258.73   
+ ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)          2,190  hours       $115.63   
+ └─ Standard provisioned storage (pd-standard)                         300  GB           $12.00   
+                                                                                                  
  google_container_node_pool.initial_node_count_zonal                                              
  ├─ Instance usage (Linux/UNIX, on-demand, e2-medium)                8,760  hours       $293.51   
  └─ Standard provisioned storage (pd-standard)                       1,200  GB           $48.00   
@@ -64,16 +74,6 @@
  ├─ Instance usage (Linux/UNIX, on-demand, e2-medium)                5,840  hours       $195.67   
  └─ Standard provisioned storage (pd-standard)                         800  GB           $32.00   
                                                                                                   
- google_container_node_pool.with_preemptible_instance                                             
- ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)        2,190  hours       $133.24   
- ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)          2,190  hours        $59.52   
- └─ Standard provisioned storage (pd-standard)                         300  GB           $12.00   
-                                                                                                  
- google_container_node_pool.with_spot_instance                                                    
- ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)        2,190  hours       $133.24   
- ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)          2,190  hours        $59.52   
- └─ Standard provisioned storage (pd-standard)                         300  GB           $12.00   
-                                                                                                  
  google_container_node_pool.autoscaling_zonal                                                     
  ├─ Instance usage (Linux/UNIX, on-demand, e2-medium)                4,380  hours       $146.76   
  └─ Standard provisioned storage (pd-standard)                         600  GB           $24.00   
@@ -122,7 +122,7 @@
  ├─ Instance usage (Linux/UNIX, on-demand, e2-medium)                1,460  hours        $48.92   
  └─ Standard provisioned storage (pd-standard)                         200  GB            $8.00   
                                                                                                   
- OVERALL TOTAL                                                                      $28,114.99 
+ OVERALL TOTAL                                                                      $28,478.18 
 
 *Usage costs can be estimated by updating Infracost Cloud settings, see docs for other options.
 
@@ -133,5 +133,5 @@
 ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━┳━━━━━━━━━━━━┓
 ┃ Project                                            ┃ Baseline cost ┃ Usage cost* ┃ Total cost ┃
 ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━╋━━━━━━━━━━━━┫
-┃ main                                               ┃       $28,115 ┃           - ┃    $28,115 ┃
+┃ main                                               ┃       $28,478 ┃           - ┃    $28,478 ┃
 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━┻━━━━━━━━━━━━┛
\ No newline at end of file
```

**File**: `internal/providers/terraform/testdata/hcl_provider_test/adds_source_url_from_remote_module/expected.json` (modified, +318/-80)
```diff
@@ -34,15 +34,15 @@
                     {
                       "filename": "testdata/hcl_provider_test/adds_source_url_from_remote_module/.infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                       "blockName": "aws_s3_bucket.this",
-                      "startLine": 45,
-                      "endLine": 57
+                      "startLine": 64,
+                      "endLine": 76
                     }
                   ],
                   "checksum": "5d5201f6fd30d76103a7962171e2fce813ff03fb6df2409506732f470f6f94e3",
-                  "endLine": 57,
+                  "endLine": 76,
                   "filename": "testdata/hcl_provider_test/adds_source_url_from_remote_module/.infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                   "moduleFilename": "https://github.com/terraform-aws-modules/terraform-aws-s3-bucket/blob/HEAD/main.tf",
-                  "startLine": 45
+                  "startLine": 64
                 }
               },
               {
@@ -69,15 +69,15 @@
                     {
                       "filename": "testdata/hcl_provider_test/adds_source_url_from_remote_module/.infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                       "blockName": "aws_s3_bucket_acl.this",
-                      "startLine": 108,
-                      "endLine": 147
+                      "startLine": 135,
+                      "endLine": 174
                     }
                   ],
                   "checksum": "36ceec81a755a99e3398086178baf74ecb30ac5fd76c4e307eabbaddc07292b4",
-                  "endLine": 147,
+                  "endLine": 174,
                   "filename": "testdata/hcl_provider_test/adds_source_url_from_remote_module/.infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                   "moduleFilename": "https://github.com/terraform-aws-modules/terraform-aws-s3-bucket/blob/HEAD/main.tf",
-                  "startLine": 108
+                  "startLine": 135
                 }
               },
               {
@@ -107,15 +107,15 @@
                     {
                       "filename": "testdata/hcl_provider_test/adds_source_url_from_remote_module/.infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                       "blockName": "aws_s3_bucket_ownership_controls.this",
-                      "startLine": 1178,
-                      "endLine": 1195
+                      "startLine": 1295,
+                      "endLine": 1312
                     }
                   ],
                   "checksum": "c0ec54d2625f28631532a2eea51eeeeb675d2764833650669137114639d405f2",
-                  "endLine": 1195,
+                  "endLine": 1312,
                   "filename": "testdata/hcl_provider_test/adds_source_url_from_remote_module/.infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                   "moduleFilename": "https://github.com/terraform-aws-modules/terraform-aws-s3-bucket/blob/HEAD/main.tf",
-                  "startLine": 1178
+                  "startLine": 1295
                 }
               },
               {
@@ -145,15 +145,15 @@
                     {
                       "filename": "testdata/hcl_provider_test/adds_source_url_from_remote_module/.infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                       "blockName": "aws_s3_bucket_public_access_block.this",
-                      "startLine": 1164,
-                      "endLine": 1176
+                      "startLine": 1277,
+                      "endLine": 1289
                     }
                   ],
                   "checksum": "d95c730874dc263b093b498f86fb0c614413dd102f5309ba603511449a67fd6c",
-                  "endLine": 1176,
+                  "endLine": 1289,
                   "filename": "testdata/hcl_provider_test/adds_source_url_from_remote_module/.infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                   "moduleFilename": "https://github.com/terraform-aws-modules/terraform-aws-s3-bucket/blob/HEAD/main.tf",
-                  "startLine": 1164
+                  "startLine": 1277
                 }
               },
               {
@@ -186,15 +186,49 @@
                     {
                       "filename": "testdata/hcl_provider_test/adds_source_url_from_remote_module/.infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                       "blockName": "aws_s3_bucket_versioning.this",
-                      "startLine": 206,
-                      "endLine": 222
+                      "startLine": 241,
+                      "endLine": 257
                     }
                   ],
                   "checksum": "25240e8e8f1df7133a121452c061c422ac977151d265410a5d5e7ae137e3f7a1",
-                  "endLine": 222,
+                  "endLine": 257,
                   "filename": "testdata/hcl_provider_tes
```

**File**: `internal/providers/terraform/testdata/hcl_provider_test/adds_source_url_from_remote_module_chdir/expected.json` (modified, +318/-80)
```diff
@@ -34,15 +34,15 @@
                     {
                       "filename": ".infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                       "blockName": "aws_s3_bucket.this",
-                      "startLine": 45,
-                      "endLine": 57
+                      "startLine": 64,
+                      "endLine": 76
                     }
                   ],
                   "checksum": "5d5201f6fd30d76103a7962171e2fce813ff03fb6df2409506732f470f6f94e3",
-                  "endLine": 57,
+                  "endLine": 76,
                   "filename": ".infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                   "moduleFilename": "https://github.com/terraform-aws-modules/terraform-aws-s3-bucket/blob/HEAD/main.tf",
-                  "startLine": 45
+                  "startLine": 64
                 }
               },
               {
@@ -69,15 +69,15 @@
                     {
                       "filename": ".infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                       "blockName": "aws_s3_bucket_acl.this",
-                      "startLine": 108,
-                      "endLine": 147
+                      "startLine": 135,
+                      "endLine": 174
                     }
                   ],
                   "checksum": "36ceec81a755a99e3398086178baf74ecb30ac5fd76c4e307eabbaddc07292b4",
-                  "endLine": 147,
+                  "endLine": 174,
                   "filename": ".infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                   "moduleFilename": "https://github.com/terraform-aws-modules/terraform-aws-s3-bucket/blob/HEAD/main.tf",
-                  "startLine": 108
+                  "startLine": 135
                 }
               },
               {
@@ -107,15 +107,15 @@
                     {
                       "filename": ".infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                       "blockName": "aws_s3_bucket_ownership_controls.this",
-                      "startLine": 1178,
-                      "endLine": 1195
+                      "startLine": 1295,
+                      "endLine": 1312
                     }
                   ],
                   "checksum": "c0ec54d2625f28631532a2eea51eeeeb675d2764833650669137114639d405f2",
-                  "endLine": 1195,
+                  "endLine": 1312,
                   "filename": ".infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                   "moduleFilename": "https://github.com/terraform-aws-modules/terraform-aws-s3-bucket/blob/HEAD/main.tf",
-                  "startLine": 1178
+                  "startLine": 1295
                 }
               },
               {
@@ -145,15 +145,15 @@
                     {
                       "filename": ".infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                       "blockName": "aws_s3_bucket_public_access_block.this",
-                      "startLine": 1164,
-                      "endLine": 1176
+                      "startLine": 1277,
+                      "endLine": 1289
                     }
                   ],
                   "checksum": "d95c730874dc263b093b498f86fb0c614413dd102f5309ba603511449a67fd6c",
-                  "endLine": 1176,
+                  "endLine": 1289,
                   "filename": ".infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                   "moduleFilename": "https://github.com/terraform-aws-modules/terraform-aws-s3-bucket/blob/HEAD/main.tf",
-                  "startLine": 1164
+                  "startLine": 1277
                 }
               },
               {
@@ -186,15 +186,49 @@
                     {
                       "filename": ".infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                       "blockName": "aws_s3_bucket_versioning.this",
-                      "startLine": 206,
-                      "endLine": 222
+                      "startLine": 241,
+                      "endLine": 257
                     }
                   ],
                   "checksum": "25240e8e8f1df7133a121452c061c422ac977151d265410a5d5e7ae137e3f7a1",
-                  "endLine": 222,
+                  "endLine": 257,
                   "filename": ".infracost/terraform_modules/30b695ab2291e2ded2ac2e47e63b88e6/main.tf",
                   "moduleFilename": "https://github.com/terraform-aws-modules/terraform-aws-s3-bucket/blob/HEAD/main.tf",
-                  "startLine": 206
+                  "startLine": 241
+                }
+              },
+              {
+                "address": "module.git_ssh.aws_s3_bucket_website_configuration.this[0]",
+                "mode": "managed",
+                "type": "aws_s3_bucket_website_configuration",
+                "name": "this",
+                "index": 0,
+         
```

**File**: `internal/providers/terraform/tftest/tftest.go` (modified, +12/-0)
```diff
@@ -41,6 +41,18 @@ var tfProviders = `
 			}
 			azurerm = {
 				source  = "hashicorp/azurerm"
+				# The fixtures and goldens are written against v4. v5 removed
+				# skip_provider_registration and renamed arguments such as
+				# azurerm_storage_table.storage_account_name, so leaving this
+				# unconstrained breaks every Terraform_CLI subtest.
+				version = "~> 4.0"
+			}
+			# Declared so that fixtures using random_* resolve from the shared
+			# init cache. A provider missing here forces a fresh terraform init
+			# in the project directory, which re-resolves azurerm and defeats
+			# the pin above.
+			random = {
+				source  = "hashicorp/random"
 			}
 		}
 	}
```

---

### Incident Patch 4: `4f7170bc` (2026-09-09)
**Commit Message**: fix(deps): bump golang.org/x/mod to v0.40.0 (#3615)

CVE-2026-56864 and CVE-2026-56865 in golang.org/x/mod v0.37.0, fixed in
v0.40.0. Flagged by AWS Inspector against hosted-cloud-pricing-api's
image, which builds this CLI from source on every rebuild.

**File**: `go.mod` (modified, +8/-8)
```diff
@@ -40,8 +40,8 @@ require (
 	github.com/stretchr/testify v1.11.1
 	github.com/tidwall/gjson v1.17.0
 	github.com/zclconf/go-cty v1.17.0
-	golang.org/x/crypto v0.53.0 // indirect
-	golang.org/x/mod v0.37.0
+	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/mod v0.40.0
 	gopkg.in/go-playground/assert.v1 v1.2.1
 	gopkg.in/yaml.v2 v2.4.0
 	gopkg.in/yaml.v3 v3.0.1
@@ -50,7 +50,7 @@ require (
 require (
 	github.com/aws/aws-sdk-go-v2/service/eks v1.73.3
 	github.com/hashicorp/terraform-config-inspect v0.0.0-20210625153042-09f34846faab
-	golang.org/x/sys v0.46.0 // indirect
+	golang.org/x/sys v0.47.0 // indirect
 )
 
 require (
@@ -81,15 +81,15 @@ require (
 	github.com/slack-go/slack v0.27.0
 	github.com/tidwall/match v1.1.1 // indirect
 	github.com/tidwall/pretty v1.2.1 // indirect
-	golang.org/x/text v0.39.0
-	golang.org/x/tools v0.47.0 // indirect
+	golang.org/x/text v0.41.0
+	golang.org/x/tools v0.49.0 // indirect
 )
 
 require (
 	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.10 // indirect
 	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.23 // indirect
 	github.com/gorilla/websocket v1.5.3 // indirect
-	golang.org/x/sync v0.21.0
+	golang.org/x/sync v0.22.0
 )
 
 require (
@@ -265,7 +265,7 @@ require (
 	go.opentelemetry.io/otel/sdk/metric v1.43.0 // indirect
 	go.opentelemetry.io/otel/trace v1.44.0 // indirect
 	go4.org v0.0.0-20230225012048-214862532bf5 // indirect
-	golang.org/x/term v0.44.0 // indirect
+	golang.org/x/term v0.45.0 // indirect
 	golang.org/x/time v0.11.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260414002931-afd174a4e478 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260414002931-afd174a4e478 // indirect
@@ -305,7 +305,7 @@ require (
 	github.com/yashtewari/glob-intersection v0.2.0 // indirect
 	github.com/zclconf/go-cty-yaml v1.0.3
 	go.opencensus.io v0.24.0 // indirect
-	golang.org/x/net v0.56.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
 	google.golang.org/api v0.215.0
 	google.golang.org/genproto v0.0.0-20241118233622-e639e219e697 // indirect
 	google.golang.org/grpc v1.82.1 // indirect
```

**File**: `go.sum` (modified, +16/-16)
```diff
@@ -1885,8 +1885,8 @@ golang.org/x/crypto v0.38.0/go.mod h1:MvrbAqul58NNYPKnOra203SB9vpuZW0e+RRZV+Ggqj
 golang.org/x/crypto v0.39.0/go.mod h1:L+Xg3Wf6HoL4Bn4238Z6ft6KfEpN0tJGo53AAPC632U=
 golang.org/x/crypto v0.40.0/go.mod h1:Qr1vMER5WyS2dfPHAlsOj01wgLbsyWtFn/aY+5+ZdxY=
 golang.org/x/crypto v0.41.0/go.mod h1:pO5AFd7FA68rFak7rOAGVuygIISepHftHnr8dr6+sUc=
-golang.org/x/crypto v0.53.0 h1:QZ4Muo8THX6CizN2vPPd5fBGHyogrdK9fG4wLPFUsto=
-golang.org/x/crypto v0.53.0/go.mod h1:DNLU434OwVakk9PzuwV8w62mAJpRJL3vsgcfp4Qnsio=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/exp v0.0.0-20180321215751-8460e604b9de/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20180807140117-3d87b88a115f/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
@@ -1953,8 +1953,8 @@ golang.org/x/mod v0.18.0/go.mod h1:hTbmBsO62+eylJbnUtE2MGJUyE7QWk4xUqPFrRgJ+7c=
 golang.org/x/mod v0.24.0/go.mod h1:IXM97Txy2VM4PJ3gI61r1YEk/gAj6zAHN3AdZt6S9Ww=
 golang.org/x/mod v0.25.0/go.mod h1:IXM97Txy2VM4PJ3gI61r1YEk/gAj6zAHN3AdZt6S9Ww=
 golang.org/x/mod v0.26.0/go.mod h1:/j6NAhSk8iQ723BGAUyoAcn7SlD7s15Dp9Nd/SfeaFQ=
-golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
-golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
+golang.org/x/mod v0.40.0 h1:hUv+3cXcdRHz08UmSiOob7sadHig73uo5bkXxQ/tvUs=
+golang.org/x/mod v0.40.0/go.mod h1:0/weTWkPWGBikyTWAX3dkjVztMmBA5hM0DH6BElSupE=
 golang.org/x/net v0.0.0-20170114055629-f2499483f923/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180530234432-1e491301e022/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180724234803-3673e40ba225/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
@@ -2033,8 +2033,8 @@ golang.org/x/net v0.40.0/go.mod h1:y0hY0exeL2Pku80/zKK7tpntoX23cqL3Oa6njdgRtds=
 golang.org/x/net v0.41.0/go.mod h1:B/K4NNqkfmg07DQYrbwvSluqCJOOXwUjeb/5lOisjbA=
 golang.org/x/net v0.42.0/go.mod h1:FF1RA5d3u7nAYA4z2TkclSCKh68eSXtiFwcWQpPXdt8=
 golang.org/x/net v0.43.0/go.mod h1:vhO1fvI4dGsIjh73sWfUVjj3N7CA9WkKJNQm2svM6Jg=
-golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
-golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
+golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
+golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
 golang.org/x/oauth2 v0.0.0-20190604053449-0f29369cfe45/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
@@ -2089,8 +2089,8 @@ golang.org/x/sync v0.7.0/go.mod h1:Czt+wKu1gCyEFDUtn0jG5QVvpJ6rzVqr5aXyt9drQfk=
 golang.org/x/sync v0.14.0/go.mod h1:1dzgHSNfp02xaA81J2MS99Qcpr2w7fw1gpm99rleRqA=
 golang.org/x/sync v0.15.0/go.mod h1:1dzgHSNfp02xaA81J2MS99Qcpr2w7fw1gpm99rleRqA=
 golang.org/x/sync v0.16.0/go.mod h1:1dzgHSNfp02xaA81J2MS99Qcpr2w7fw1gpm99rleRqA=
-golang.org/x/sync v0.21.0 h1:HLII4xRRTtCRkxYp4HNFF0Js/Og6q2i++KXbg0gHCwM=
-golang.org/x/sync v0.21.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
+golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
 golang.org/x/sys v0.0.0-20170830134202-bb24a47a89ea/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20180816055513-1c9583448a9c/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20180823144017-11551d06cbcc/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
@@ -2199,8 +2199,8 @@ golang.org/x/sys v0.29.0/go.mod h1:/VUhepiaJMQUp4+oa/7Zr1D23ma6VTLIYjOOTFZPUcA=
 golang.org/x/sys v0.33.0/go.mod h1:BJP2sWEmIv4KK5OTEluFJCKSidICx8ciO85XgH3Ak8k=
 golang.org/x/sys v0.34.0/go.mod h1:BJP2sWEmIv4KK5OTEluFJCKSidICx8ciO85XgH3Ak8k=
 golang.org/x/sys v0.35.0/go.mod h1:BJP2sWEmIv4KK5OTEluFJCKSidICx8ciO85XgH3Ak8k=
-golang.org/x/sys v0.46.0 h1:noSf2Fq6F8DBgS+LysIkx7rIExoNHJsxOAtPp4rthXw=
-golang.org/x/sys v0.46.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
+golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
 golang.org/x/telemetry v0.0.0-20240228155512-f48c80bd79b2/go.mod h1:TeRTkGYfJXctD9OcfyVLyj2J3IxLnKwHJR8f4D8a3YE=
 golang.org/x/telemetry v0.0.0-20240521205824-bda55230c457/go.mod h1:pRgIJT+bRLFKnoM1ldnzKoxTIn14Yxz928LQRYYgIN0=
 golang.org/x/telemetry v0.0.0-20250710130107-8d8967aff50b/go.mod h1:4ZwOYna0/zsOKwuR5X/m0QFOJpSZvAxFfkQT+Erd9D4=
@@ -2222,8 +2222,8 @@ golang.org/x/term v0.21.0/g
```

---

### Incident Patch 5: `95ba4f49` (2026-08-21)
**Commit Message**: Update bug report issue template (#3582)

**File**: `.github/ISSUE_TEMPLATE/bug_report.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+---
+name: Bug report
+about: Create a report to help us improve
+title: ''
+labels: ''
+assignees: ''
+
+---
+
+**Create a new thread in discussions**
+We use GitHub issues only for work that is ready to be started. If you're running into an issue or think you've found a bug please [create a new thread in Discussions](https://github.com/infracost/infracost/discussions/new?category=bug-reports).
+
+Please provide a clear and concise description of what the bug is, the steps to reproduce the behavior, and what the expected behavior should be.
```

---

### Incident Patch 6: `d066927f` (2026-08-20)
**Commit Message**: fix(docker): bump builder to golang 1.26.6 for CVE-2026-39821 (#3607)

* fix(docker): bump builder image to golang 1.26.6 to patch CVE-2026-39821

The golang images set GOTOOLCHAIN=local, so the toolchain directive in
go.mod is ignored and images were still built with the 1.26.5 stdlib.

* fix(docker): fail the build on Go toolchain drift with GOTOOLCHAIN=path

* chore(docker): match the standard GOTOOLCHAIN comment wording

* chore(docker): adopt the ARG GO_VERSION pattern used in other repos

**File**: `Dockerfile` (modified, +7/-1)
```diff
@@ -1,4 +1,6 @@
-FROM golang:1.26.5 AS builder
+ARG GO_VERSION=1.26.6
+
+FROM golang:${GO_VERSION} AS builder
 
 ARG ARCH=linux
 ARG DEFAULT_TERRAFORM_VERSION=0.15.5
@@ -8,6 +10,10 @@ ARG TERRAGRUNT_VERSION=0.31.8
 SHELL ["/bin/bash", "-c"]
 ENV HOME=/app
 ENV CGO_ENABLED=0
+# force the GO_VERSION above to be in sync with the `toolchain` directive in go.mod.
+# This avoids downloading other Go Toolchains, which happens silently and would slow
+# down our image builds.
+ENV GOTOOLCHAIN=path
 
 # Install Packages
 RUN apt-get update -q && apt-get -y install unzip && rm -rf /var/lib/apt/lists/*
```

**File**: `Dockerfile.ci` (modified, +7/-1)
```diff
@@ -1,11 +1,17 @@
-FROM golang:1.26.5 AS builder
+ARG GO_VERSION=1.26.6
+
+FROM golang:${GO_VERSION} AS builder
 
 ARG ARCH=linux64
 
 # Set Environment Variables
 SHELL ["/bin/bash", "-c"]
 ENV HOME=/app
 ENV CGO_ENABLED=0
+# force the GO_VERSION above to be in sync with the `toolchain` directive in go.mod.
+# This avoids downloading other Go Toolchains, which happens silently and would slow
+# down our image builds.
+ENV GOTOOLCHAIN=path
 
 WORKDIR /app
 
```

---

### Incident Patch 7: `8c843ffc` (2026-08-20)
**Commit Message**: fix(deps): bump Go toolchain to 1.26.6 to patch CVE-2026-39821 (#3606)

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ module github.com/infracost/infracost
 
 go 1.26.0
 
-toolchain go1.26.5
+toolchain go1.26.6
 
 require (
 	github.com/Masterminds/goutils v1.1.1 // indirect
```

---

### Incident Patch 8: `0c473ade` (2026-08-11)
**Commit Message**: fix(deps): update vulnerable Go modules (#3604)

**File**: `go.mod` (modified, +19/-19)
```diff
@@ -40,8 +40,8 @@ require (
 	github.com/stretchr/testify v1.11.1
 	github.com/tidwall/gjson v1.17.0
 	github.com/zclconf/go-cty v1.17.0
-	golang.org/x/crypto v0.52.0 // indirect
-	golang.org/x/mod v0.35.0
+	golang.org/x/crypto v0.53.0 // indirect
+	golang.org/x/mod v0.37.0
 	gopkg.in/go-playground/assert.v1 v1.2.1
 	gopkg.in/yaml.v2 v2.4.0
 	gopkg.in/yaml.v3 v3.0.1
@@ -50,7 +50,7 @@ require (
 require (
 	github.com/aws/aws-sdk-go-v2/service/eks v1.73.3
 	github.com/hashicorp/terraform-config-inspect v0.0.0-20210625153042-09f34846faab
-	golang.org/x/sys v0.45.0 // indirect
+	golang.org/x/sys v0.46.0 // indirect
 )
 
 require (
@@ -81,15 +81,15 @@ require (
 	github.com/slack-go/slack v0.27.0
 	github.com/tidwall/match v1.1.1 // indirect
 	github.com/tidwall/pretty v1.2.1 // indirect
-	golang.org/x/text v0.37.0
-	golang.org/x/tools v0.44.0 // indirect
+	golang.org/x/text v0.39.0
+	golang.org/x/tools v0.47.0 // indirect
 )
 
 require (
 	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.10 // indirect
 	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.23 // indirect
 	github.com/gorilla/websocket v1.5.3 // indirect
-	golang.org/x/sync v0.20.0
+	golang.org/x/sync v0.21.0
 )
 
 require (
@@ -123,7 +123,7 @@ require (
 	github.com/withfig/autocomplete-tools/packages/cobra v1.2.0
 	github.com/xanzy/go-gitlab v0.86.0
 	golang.org/x/exp v0.0.0-20260410095643-746e56fc9e2f
-	golang.org/x/oauth2 v0.34.0
+	golang.org/x/oauth2 v0.36.0
 	k8s.io/apimachinery v0.29.2
 )
 
@@ -147,7 +147,7 @@ require (
 	github.com/Azure/go-autorest/autorest/validation v0.3.1 // indirect
 	github.com/Azure/go-autorest/logger v0.2.1 // indirect
 	github.com/Azure/go-autorest/tracing v0.6.0 // indirect
-	github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.30.0 // indirect
+	github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.32.0 // indirect
 	github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.48.1 // indirect
 	github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/resourcemapping v0.48.1 // indirect
 	github.com/Masterminds/semver/v3 v3.2.1 // indirect
@@ -169,7 +169,7 @@ require (
 	github.com/cenkalti/backoff/v3 v3.2.2 // indirect
 	github.com/cespare/xxhash/v2 v2.3.0 // indirect
 	github.com/cloudflare/circl v1.6.3 // indirect
-	github.com/cncf/xds/go v0.0.0-20251210132809-ee656c7534f5 // indirect
+	github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2 // indirect
 	github.com/containerd/continuity v0.3.0 // indirect
 	github.com/cpuguy83/go-md2man/v2 v2.0.6 // indirect
 	github.com/creack/pty v1.1.11 // indirect
@@ -178,8 +178,8 @@ require (
 	github.com/dlclark/regexp2 v1.8.1 // indirect
 	github.com/dsnet/compress v0.0.2-0.20230904184137-39efe44ab707 // indirect
 	github.com/emirpasic/gods v1.18.1 // indirect
-	github.com/envoyproxy/go-control-plane/envoy v1.36.0 // indirect
-	github.com/envoyproxy/protoc-gen-validate v1.3.0 // indirect
+	github.com/envoyproxy/go-control-plane/envoy v1.37.0 // indirect
+	github.com/envoyproxy/protoc-gen-validate v1.3.3 // indirect
 	github.com/felixge/httpsnoop v1.0.4 // indirect
 	github.com/go-git/gcfg v1.5.1-0.20230307220236-3a3c6141e376 // indirect
 	github.com/go-ini/ini v1.67.0 // indirect
@@ -241,7 +241,7 @@ require (
 	github.com/sorairolake/lzip-go v0.3.5 // indirect
 	github.com/sourcegraph/go-lsp v0.0.0-20200429204803-219e11d77f5d // indirect
 	github.com/sourcegraph/jsonrpc2 v0.2.0 // indirect
-	github.com/spf13/afero v1.12.0 // indirect
+	github.com/spf13/afero v1.15.0 // indirect
 	github.com/spiffe/go-spiffe/v2 v2.6.0 // indirect
 	github.com/tchap/go-patricia/v2 v2.3.2 // indirect
 	github.com/terraform-linters/tflint v0.46.1 // indirect
@@ -256,7 +256,7 @@ require (
 	go.mozilla.org/gopgagent v0.0.0-20170926210634-4d7ea76ff71a // indirect
 	go.mozilla.org/sops/v3 v3.7.3 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
-	go.opentelemetry.io/contrib/detectors/gcp v1.39.0 // indirect
+	go.opentelemetry.io/contrib/detectors/gcp v1.43.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.54.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0 // indirect
 	go.opentelemetry.io/otel v1.44.0 // indirect
@@ -265,10 +265,10 @@ require (
 	go.opentelemetry.io/otel/sdk/metric v1.43.0 // indirect
 	go.opentelemetry.io/otel/trace v1.44.0 // indirect
 	go4.org v0.0.0-20230225012048-214862532bf5 // indirect
-	golang.org/x/term v0.43.0 // indirect
+	golang.org/x/term v0.44.0 // indirect
 	golang.org/x/time v0.11.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20251202230838-ff82c1b0f217 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20251202230838-ff82c1b0f217 // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260414002931-afd174a4e478 // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260414002931-afd174a4e478 // indirect
 	gopkg.in/inf.v0 v0.9.1 /
```

**File**: `go.sum` (modified, +42/-42)
```diff
@@ -673,8 +673,8 @@ github.com/BurntSushi/toml v0.3.1/go.mod h1:xHWCNGjB5oqiDr8zfno3MHue2Ht5sIBksp03
 github.com/BurntSushi/xgb v0.0.0-20160522181843-27f122750802/go.mod h1:IVnqGOEym/WlBOVXweHU+Q+/VP0lqqI8lqeDx9IjBqo=
 github.com/ChrisTrenkamp/goxpath v0.0.0-20170922090931-c385f95c6022/go.mod h1:nuWgzSkT5PnyOd+272uUmV0dnAnAn42Mk7PiQC5VzN4=
 github.com/ChrisTrenkamp/goxpath v0.0.0-20190607011252-c5096ec8773d/go.mod h1:nuWgzSkT5PnyOd+272uUmV0dnAnAn42Mk7PiQC5VzN4=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.30.0 h1:sBEjpZlNHzK1voKq9695PJSX2o5NEXl7/OL3coiIY0c=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.30.0/go.mod h1:P4WPRUkOhJC13W//jWpyfJNDAIpvRbAUIYLX/4jtlE0=
+github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.32.0 h1:rIkQfkCOVKc1OiRCNcSDD8ml5RJlZbH/Xsq7lbpynwc=
+github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.32.0/go.mod h1:RD2SsorTmYhF6HkTmDw7KmPYQk8OBYwTkuasChwv7R4=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.48.1 h1:UQ0AhxogsIRZDkElkblfnwjc3IaltCm2HUMvezQaL7s=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.48.1/go.mod h1:jyqM3eLpJ3IbIFDTKVz2rF9T/xWGW0rIriGwnz8l9Tk=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/cloudmock v0.48.1 h1:oTX4vsorBZo/Zdum6OKPA4o7544hm6smoRv1QjpTwGo=
@@ -905,8 +905,8 @@ github.com/cncf/xds/go v0.0.0-20211011173535-cb28da3451f1/go.mod h1:eXthEFrGJvWH
 github.com/cncf/xds/go v0.0.0-20220314180256-7f1daf1720fc/go.mod h1:eXthEFrGJvWHgFFCl3hGmgk+/aYT6PnTQLykKQRLhEs=
 github.com/cncf/xds/go v0.0.0-20230105202645-06c439db220b/go.mod h1:eXthEFrGJvWHgFFCl3hGmgk+/aYT6PnTQLykKQRLhEs=
 github.com/cncf/xds/go v0.0.0-20230607035331-e9ce68804cb4/go.mod h1:eXthEFrGJvWHgFFCl3hGmgk+/aYT6PnTQLykKQRLhEs=
-github.com/cncf/xds/go v0.0.0-20251210132809-ee656c7534f5 h1:6xNmx7iTtyBRev0+D/Tv1FZd4SCg8axKApyNyRsAt/w=
-github.com/cncf/xds/go v0.0.0-20251210132809-ee656c7534f5/go.mod h1:KdCmV+x/BuvyMxRnYBlmVaq4OLiKW6iRQfvC62cvdkI=
+github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2 h1:aBangftG7EVZoUb69Os8IaYg++6uMOdKK83QtkkvJik=
+github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2/go.mod h1:qwXFYgsP6T7XnJtbKlf1HP8AjxZZyzxMmc+Lq5GjlU4=
 github.com/containerd/continuity v0.3.0 h1:nisirsYROK15TAMVukJOUyGJjz4BNQJBVsNvAXZJ/eg=
 github.com/containerd/continuity v0.3.0/go.mod h1:wJEAIwKOm/pBZuBd0JmeTvnLquTB1Ag8espWhkykbPM=
 github.com/coreos/bbolt v1.3.0/go.mod h1:iRUV2dpdMOn7Bo10OQBFzIJO9kkE559Wcmn+qkEiiKk=
@@ -979,16 +979,16 @@ github.com/envoyproxy/go-control-plane v0.10.3/go.mod h1:fJJn/j26vwOu972OllsvAgJ
 github.com/envoyproxy/go-control-plane v0.11.1-0.20230524094728-9239064ad72f/go.mod h1:sfYdkwUW4BA3PbKjySwjJy+O4Pu0h62rlqCMHNk+K+Q=
 github.com/envoyproxy/go-control-plane v0.14.0 h1:hbG2kr4RuFj222B6+7T83thSPqLjwBIfQawTkC++2HA=
 github.com/envoyproxy/go-control-plane v0.14.0/go.mod h1:NcS5X47pLl/hfqxU70yPwL9ZMkUlwlKxtAohpi2wBEU=
-github.com/envoyproxy/go-control-plane/envoy v1.36.0 h1:yg/JjO5E7ubRyKX3m07GF3reDNEnfOboJ0QySbH736g=
-github.com/envoyproxy/go-control-plane/envoy v1.36.0/go.mod h1:ty89S1YCCVruQAm9OtKeEkQLTb+Lkz0k8v9W0Oxsv98=
+github.com/envoyproxy/go-control-plane/envoy v1.37.0 h1:u3riX6BoYRfF4Dr7dwSOroNfdSbEPe9Yyl09/B6wBrQ=
+github.com/envoyproxy/go-control-plane/envoy v1.37.0/go.mod h1:DReE9MMrmecPy+YvQOAOHNYMALuowAnbjjEMkkWOi6A=
 github.com/envoyproxy/go-control-plane/ratelimit v0.1.0 h1:/G9QYbddjL25KvtKTv3an9lx6VBE2cnb8wp1vEGNYGI=
 github.com/envoyproxy/go-control-plane/ratelimit v0.1.0/go.mod h1:Wk+tMFAFbCXaJPzVVHnPgRKdUdwW/KdbRt94AzgRee4=
 github.com/envoyproxy/protoc-gen-validate v0.1.0/go.mod h1:iSmxcyjqTsJpI2R4NaDN7+kN2VEUnK/pcBlmesArF7c=
 github.com/envoyproxy/protoc-gen-validate v0.6.7/go.mod h1:dyJXwwfPK2VSqiB9Klm1J6romD608Ba7Hij42vrOBCo=
 github.com/envoyproxy/protoc-gen-validate v0.9.1/go.mod h1:OKNgG7TCp5pF4d6XftA0++PMirau2/yoOwVac3AbF2w=
 github.com/envoyproxy/protoc-gen-validate v0.10.1/go.mod h1:DRjgyB0I43LtJapqN6NiRwroiAU2PaFuvk/vjgh61ss=
-github.com/envoyproxy/protoc-gen-validate v1.3.0 h1:TvGH1wof4H33rezVKWSpqKz5NXWg5VPuZ0uONDT6eb4=
-github.com/envoyproxy/protoc-gen-validate v1.3.0/go.mod h1:HvYl7zwPa5mffgyeTUHA9zHIH36nmrm7oCbo4YKoSWA=
+github.com/envoyproxy/protoc-gen-validate v1.3.3 h1:MVQghNeW+LZcmXe7SY1V36Z+WFMDjpqGAGacLe2T0ds=
+github.com/envoyproxy/protoc-gen-validate v1.3.3/go.mod h1:TsndJ/ngyIdQRhMcVVGDDHINPLWB7C82oDArY51KfB0=
 github.com/evanphx/json-patch v0.0.0-20190203023257-5858425f7550/go.mod h1:50XU6AFN0ol/bzJsmQLiYLvXMP4fmwYFNcr97nuDLSk=
 github.com/evanphx/json-patch v4.2.0+incompatible/go.mod h1:50XU6AFN0ol/bzJsmQLiYLvXMP4fmwYFNcr97nuDLSk=
 github.com/fatih/camelcase v1.0.0 h1:hxNvNX/xYBp0ovncs8WyWZrOrpBNub/JfaMvbURyft8=
@@ -1674,8 +1674,8 @@ github.com/spf13/afero v1.2.2/go.mod h1:9ZxEEn6pIJ8Rxe320qSDBk6AsU0r9pR7Q4OcevTd
 github.com/spf13/afero v1.3.3/go.mod h1:5KUK8ByomD5Ti5Artl0RtHeI5pTF7MIDuXL3yY520V4=
 github.com/spf13/afero v1.6.0/go.mod
```

---

### Incident Patch 9: `b6a5d941` (2026-07-30)
**Commit Message**: fix(deps): bump Go to 1.25.12 to patch CVE-2026-39822 (#3597)

* fix(deps): move Go to 1.26.5 to patch CVE-2026-39822

* fix(test): scrub panic output containing toolchain module paths

The panic scrubber's character class had no hyphen, so it stopped
matching once stack traces started resolving through
golang.org/[REDACTED_EMAIL]-amd64.

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.25.11 AS builder
+FROM golang:1.26.5 AS builder
 
 ARG ARCH=linux
 ARG DEFAULT_TERRAFORM_VERSION=0.15.5
```

**File**: `Dockerfile.ci` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.25.11 AS builder
+FROM golang:1.26.5 AS builder
 
 ARG ARCH=linux64
 
```

**File**: `cmd/infracost/cmd_test.go` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ var (
 	urlRegex         = regexp.MustCompile(`https://dashboard.infracost.io/share/.*`)
 	projectPathRegex = regexp.MustCompile(`(Project:) .*/(examples|cmd/infracost)/(.*)`)
 	versionRegex     = regexp.MustCompile(`Infracost (v|preview).*`)
-	panicRegex       = regexp.MustCompile(`runtime\serror:([\w\d\n\r\[\]\:\/\.\\(\)\+\,\{\}\*\@\s\?]*)Environment`)
+	panicRegex       = regexp.MustCompile(`(?s)runtime\serror:(.*?)Environment`)
 	pathRegex        = regexp.MustCompile(`(:\s*"|^|\s|')([a-zA-Z0-9-_/]+/)*(testdata/[^\s"']*)`)
 	credsRegex       = regexp.MustCompile(`/.*/credentials\.yml`)
 )
```

**File**: `go.mod` (modified, +3/-1)
```diff
@@ -1,6 +1,8 @@
 module github.com/infracost/infracost
 
-go 1.25.11
+go 1.26.0
+
+toolchain go1.26.5
 
 require (
 	github.com/Masterminds/goutils v1.1.1 // indirect
```

---

### Incident Patch 10: `3d24c757` (2026-07-02)
**Commit Message**: fix(security): scope Terraform Cloud/registry tokens to trusted hosts (#3590)

* fix(security): scope Terraform Cloud/registry tokens to trusted hosts [FIX-350]

Several code paths attached a configured secret token to an HTTP request
whose destination host was derived from untrusted .tf / module-source
input, with no check that the host was the trusted endpoint. An attacker
supplying Terraform that Infracost scans (e.g. a PR) could point the host
at their own domain and receive the token as a Bearer credential.

- Remote-variables loader: only honor the .tf hostname when it matches the
  trusted host (TERRAFORM_CLOUD_HOST, else app.terraform.io); error when a
  token is set but no host is configured, skip when a different host is
  pinned.
- Remote-plan (runRemotePlan/cloudAPI): only send the primary token when the
  run host matches the trusted host, otherwise refuse.
- Terragrunt registry: only attach TG_TF_REGISTRY_TOKEN to an allowlist of
  trusted registry hosts.

* fix(security): scope registry token via local getter, honor TFC host config + TG_TF_DEFAULT_REGISTRY_HOST

Wire the tfr getter to Infracost's local TerraformRegistryGetter (carrying
over the INFRACOST_REGISTRY_PRO

**File**: `internal/extclient/authed_client.go` (modified, +6/-0)
```diff
@@ -43,6 +43,12 @@ func NewAuthedAPIClient(host, token string) *AuthedAPIClient {
 	}
 }
 
+// Host returns the trusted host that the authed API client sends
+// authenticated requests to.
+func (a *AuthedAPIClient) Host() string {
+	return a.host
+}
+
 // SetHost sets the host for base host for the authed API client.
 func (a *AuthedAPIClient) SetHost(host string) {
 	a.host = host
```

**File**: `internal/hcl/parser.go` (modified, +6/-3)
```diff
@@ -217,15 +217,18 @@ func OptionWithRawCtyInput(input cty.Value) (op Option) {
 }
 
 // OptionWithTFCRemoteVarLoader accepts Terraform Cloud/Enterprise host and token
-// values to load remote execution variables.
-func OptionWithTFCRemoteVarLoader(host, token, localWorkspace string, loaderOpts ...TFCRemoteVariablesLoaderOption) Option {
+// values to load remote execution variables. hostConfigured indicates whether
+// the host was explicitly set by the user (rather than defaulted to
+// app.terraform.io), which controls how the loader handles a mismatching host
+// in the scanned Terraform.
+func OptionWithTFCRemoteVarLoader(host, token, localWorkspace string, hostConfigured bool, loaderOpts ...TFCRemoteVariablesLoaderOption) Option {
 	return func(p *Parser) {
 		if host == "" || token == "" {
 			return
 		}
 
 		client := extclient.NewAuthedAPIClient(host, token)
-		p.remoteVariableLoaders = append(p.remoteVariableLoaders, NewTFCRemoteVariablesLoader(client, localWorkspace, p.logger, loaderOpts...))
+		p.remoteVariableLoaders = append(p.remoteVariableLoaders, NewTFCRemoteVariablesLoader(client, localWorkspace, hostConfigured, p.logger, loaderOpts...))
 	}
 }
 
```

**File**: `internal/hcl/remote_variables_loader.go` (modified, +35/-1)
```diff
@@ -35,6 +35,12 @@ type TFCRemoteVariablesLoader struct {
 	client         *extclient.AuthedAPIClient
 	localWorkspace string
 	remoteConfig   *TFCRemoteConfig
+	// hostConfigured is true when the user has explicitly set the Terraform
+	// Cloud host (via the TERRAFORM_CLOUD_HOST env var or terraform_cloud_host
+	// config option) rather than falling back to the app.terraform.io default.
+	// It controls how we react when the scanned Terraform requests a different
+	// host to the trusted one: see Load.
+	hostConfigured bool
 	logger         zerolog.Logger
 }
 
@@ -102,14 +108,15 @@ func RemoteVariablesLoaderWithRemoteConfig(config TFCRemoteConfig) TFCRemoteVari
 }
 
 // NewTFCRemoteVariablesLoader constructs a new loader for fetching remote variables.
-func NewTFCRemoteVariablesLoader(client *extclient.AuthedAPIClient, localWorkspace string, logger zerolog.Logger, opts ...TFCRemoteVariablesLoaderOption) *TFCRemoteVariablesLoader {
+func NewTFCRemoteVariablesLoader(client *extclient.AuthedAPIClient, localWorkspace string, hostConfigured bool, logger zerolog.Logger, opts ...TFCRemoteVariablesLoaderOption) *TFCRemoteVariablesLoader {
 	if localWorkspace == "" {
 		localWorkspace = os.Getenv("TF_WORKSPACE")
 	}
 
 	r := &TFCRemoteVariablesLoader{
 		client:         client,
 		localWorkspace: localWorkspace,
+		hostConfigured: hostConfigured,
 		logger:         logger,
 	}
 
@@ -153,7 +160,28 @@ func (r *TFCRemoteVariablesLoader) Load(options RemoteVarLoaderOptions) (map[str
 		}
 	}
 
+	// config.Host may have come from the scanned Terraform (the cloud/backend
+	// "hostname" attribute), which is untrusted input. We must never send the
+	// configured Terraform Cloud token to a host other than the trusted one,
+	// otherwise a malicious .tf could exfiltrate the token to an attacker host.
+	trustedHost := r.client.Host()
+	if config.Host != "" && !hostsEqual(config.Host, trustedHost) {
+		if r.hostConfigured {
+			// The user pinned a trusted host but the scanned Terraform asks for a
+			// different one. Don't send the token to the unverified host, just
+			// skip loading remote variables.
+			r.logger.Warn().Msgf("Terraform config sets hostname %q which does not match the configured Terraform Cloud host %q, not sending token to the unverified host and skipping remote variable loading", config.Host, trustedHost)
+			return vars, nil
+		}
+
+		// The user has a Terraform Cloud token set but has not pinned a trusted
+		// host, and the scanned Terraform is trying to point us at its own host.
+		// Refuse to run rather than risk sending the token to an untrusted host.
+		return vars, errors.Errorf("the Terraform being scanned sets a Terraform Cloud/Enterprise hostname (%q), but no trusted host is configured. Infracost will not send your Terraform Cloud token to an unverified host. If %q is trusted, set the TERRAFORM_CLOUD_HOST environment variable (or terraform_cloud_host config option) to it.", config.Host, config.Host)
+	}
+
 	if config.Host != "" {
+		// config.Host has been verified to match the trusted host.
 		r.client.SetHost(config.Host)
 	}
 
@@ -361,6 +389,12 @@ func (r *TFCRemoteVariablesLoader) getVarValue(variable tfcVar) cty.Value {
 	return cty.StringVal(variable.Value)
 }
 
+// hostsEqual reports whether two Terraform Cloud/Enterprise hostnames refer to
+// the same host, ignoring case and any trailing dot.
+func hostsEqual(a, b string) bool {
+	return strings.EqualFold(strings.TrimSuffix(a, "."), strings.TrimSuffix(b, "."))
+}
+
 func getAttribute(block *Block, name string) string {
 	if block == nil {
 		return ""
```

**File**: `internal/hcl/remote_variables_loader_tfc_test.go` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+package hcl
+
+import (
+	"path/filepath"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+
+	"github.com/infracost/infracost/internal/config"
+	"github.com/infracost/infracost/internal/extclient"
+	"github.com/infracost/infracost/internal/hcl/modules"
+	"github.com/infracost/infracost/internal/sync"
+)
+
+// blocksFromHCL parses the given Terraform source into a set of Blocks so the
+// remote variables loader can be exercised against realistic input.
+func blocksFromHCL(t *testing.T, contents string) Blocks {
+	t.Helper()
+
+	path := createTestFile("main.tf", contents)
+	logger := newDiscardLogger()
+	loader := modules.NewModuleLoader(modules.ModuleLoaderOptions{
+		CachePath:         filepath.Dir(path),
+		HCLParser:         modules.NewSharedHCLParser(),
+		CredentialsSource: nil,
+		SourceMap:         config.TerraformSourceMap{},
+		SourceMapRegex:    nil,
+		Logger:            logger,
+		ModuleSync:        &sync.KeyMutex{},
+	})
+	parser := NewParser(
+		RootPath{DetectedPath: filepath.Dir(path)},
+		CreateEnvFileMatcher([]string{}, nil),
+		loader,
+		logger,
+	)
+
+	module, err := parser.ParseDirectory()
+	require.NoError(t, err)
+
+	return module.Blocks
+}
+
+// TestTFCRemoteVariablesLoader_Load_HostValidation verifies that the loader
+// never sends the configured Terraform Cloud token to a host derived from the
+// (untrusted) scanned Terraform when that host does not match the trusted one.
+func TestTFCRemoteVariablesLoader_Load_HostValidation(t *testing.T) {
+	// A cloud block that points at an attacker-controlled host.
+	blocks := blocksFromHCL(t, `
+terraform {
+  cloud {
+    organization = "my-org"
+    hostname     = "attacker.example.com"
+    workspaces {
+      name = "my-workspace"
+    }
+  }
+}
+`)
+
+	t.Run("errors when scanned Terraform sets a host and no host is configured", func(t *testing.T) {
+		client := extclient.NewAuthedAPIClient("app.terraform.io", "secret-token")
+		loader := NewTFCRemoteVariablesLoader(client, "", false, newDiscardLogger())
+
+		_, err := loader.Load(RemoteVarLoaderOptions{Blocks: blocks})
+		require.Error(t, err)
+		assert.Contains(t, err.Error(), "attacker.example.com")
+		assert.Contains(t, err.Error(), "TERRAFORM_CLOUD_HOST")
+		// The client must not have been repointed at the untrusted host.
+		assert.Equal(t, "app.terraform.io", client.Host())
+	})
+
+	t.Run("skips without error when a different trusted host is configured", func(t *testing.T) {
+		client := extclient.NewAuthedAPIClient("tfe.mycorp.com", "secret-token")
+		loader := NewTFCRemoteVariablesLoader(client, "", true, newDiscardLogger())
+
+		vars, err := loader.Load(RemoteVarLoaderOptions{Blocks: blocks})
+		require.NoError(t, err)
+		assert.Empty(t, vars)
+		// The client must not have been repointed at the untrusted host.
+		assert.Equal(t, "tfe.mycorp.com", client.Host())
+	})
+}
```

**File**: `internal/providers/terraform/cloud.go` (modified, +7/-0)
```diff
@@ -4,13 +4,20 @@ import (
 	"fmt"
 	"io"
 	"net/http"
+	"strings"
 
 	"github.com/pkg/errors"
 
 	"github.com/infracost/infracost/internal/credentials"
 	"github.com/infracost/infracost/internal/logging"
 )
 
+// hostsEqual reports whether two Terraform Cloud/Enterprise hostnames refer to
+// the same host, ignoring case and any trailing dot.
+func hostsEqual(a, b string) bool {
+	return strings.EqualFold(strings.TrimSuffix(a, "."), strings.TrimSuffix(b, "."))
+}
+
 func cloudAPI(host string, path string, token string) ([]byte, error) {
 	client := &http.Client{}
 
```

**File**: `internal/providers/terraform/cloud_security_test.go` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+package terraform
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+// TestDirProvider_tokenForRemoteHost verifies that the primary Terraform Cloud
+// token is only sent to the trusted host, and never to a host derived from the
+// (untrusted) remote-run output URL.
+func TestDirProvider_tokenForRemoteHost(t *testing.T) {
+	t.Run("returns token when host matches the default", func(t *testing.T) {
+		p := &DirProvider{TerraformCloudToken: "primary-token"}
+		token, err := p.tokenForRemoteHost("app.terraform.io")
+		require.NoError(t, err)
+		assert.Equal(t, "primary-token", token)
+	})
+
+	t.Run("returns token when host matches the configured host", func(t *testing.T) {
+		p := &DirProvider{TerraformCloudToken: "primary-token", TerraformCloudHost: "tfe.mycorp.com"}
+		token, err := p.tokenForRemoteHost("tfe.mycorp.com")
+		require.NoError(t, err)
+		assert.Equal(t, "primary-token", token)
+	})
+
+	t.Run("errors on non-default host when no host is configured", func(t *testing.T) {
+		p := &DirProvider{TerraformCloudToken: "primary-token"}
+		_, err := p.tokenForRemoteHost("attacker.example.com")
+		require.Error(t, err)
+		assert.Contains(t, err.Error(), "attacker.example.com")
+		assert.Contains(t, err.Error(), "TERRAFORM_CLOUD_HOST")
+	})
+
+	t.Run("errors on host mismatch when a host is configured", func(t *testing.T) {
+		p := &DirProvider{TerraformCloudToken: "primary-token", TerraformCloudHost: "tfe.mycorp.com"}
+		_, err := p.tokenForRemoteHost("attacker.example.com")
+		require.Error(t, err)
+		assert.Contains(t, err.Error(), "attacker.example.com")
+		assert.Contains(t, err.Error(), "tfe.mycorp.com")
+	})
+}
+
+// TestIsTrustedRegistryHost verifies the allowlist used to decide whether the
+// TG_TF_REGISTRY_TOKEN may be attached to a registry request.
+func TestIsTrustedRegistryHost(t *testing.T) {
+	g := &TerraformRegistryGetter{}
+
+	assert.True(t, g.isTrustedRegistryHost("registry.terraform.io"))
+	assert.True(t, g.isTrustedRegistryHost("registry.opentofu.org"))
+	assert.True(t, g.isTrustedRegistryHost("app.terraform.io"))
+	assert.True(t, g.isTrustedRegistryHost("REGISTRY.TERRAFORM.IO"), "host matching should be case-insensitive")
+
+	assert.False(t, g.isTrustedRegistryHost("attacker.example.com"))
+	assert.False(t, g.isTrustedRegistryHost("registry.terraform.io.attacker.example.com"))
+
+	t.Run("honors the configured trusted host (terraform_cloud_host config value)", func(t *testing.T) {
+		gc := &TerraformRegistryGetter{TrustedHosts: []string{"tfe.mycorp.com"}}
+		assert.True(t, gc.isTrustedRegistryHost("tfe.mycorp.com"))
+		assert.False(t, gc.isTrustedRegistryHost("attacker.example.com"))
+	})
+
+	t.Run("honors TERRAFORM_CLOUD_HOST", func(t *testing.T) {
+		t.Setenv("TERRAFORM_CLOUD_HOST", "tfe.mycorp.com")
+		assert.True(t, g.isTrustedRegistryHost("tfe.mycorp.com"))
+		assert.False(t, g.isTrustedRegistryHost("attacker.example.com"))
+	})
+
+	t.Run("honors TG_TF_DEFAULT_REGISTRY_HOST", func(t *testing.T) {
+		t.Setenv("TG_TF_DEFAULT_REGISTRY_HOST", "registry.mycorp.com")
+		assert.True(t, g.isTrustedRegistryHost("registry.mycorp.com"))
+		assert.False(t, g.isTrustedRegistryHost("attacker.example.com"))
+	})
+}
```

**File**: `internal/providers/terraform/dir_provider.go` (modified, +38/-6)
```diff
@@ -426,12 +426,9 @@ func (p *DirProvider) runRemotePlan(opts *CmdOptions, args []string) ([]byte, er
 	s := strings.Split(u.Path, "/")
 	runID := s[len(s)-1]
 
-	token := p.TerraformCloudToken
-	if token == "" {
-		token = credentials.FindTerraformCloudToken(host)
-	}
-	if token == "" {
-		return []byte{}, credentials.ErrMissingCloudToken
+	token, err := p.tokenForRemoteHost(host)
+	if err != nil {
+		return []byte{}, err
 	}
 
 	body, err := cloudAPI(host, fmt.Sprintf("/api/v2/runs/%s/plan", runID), token)
@@ -455,6 +452,41 @@ func (p *DirProvider) runRemotePlan(opts *CmdOptions, args []string) ([]byte, er
 	return cloudAPI(host, jsonPath, token)
 }
 
+// tokenForRemoteHost returns the Terraform Cloud token to use for a remote run
+// hosted at the given host. host is derived from the terraform remote-run output
+// URL, which is driven by the (untrusted) .tf cloud/backend hostname, so we only
+// send the configured token to the trusted host (TERRAFORM_CLOUD_HOST if set,
+// otherwise app.terraform.io). When the host does not match we refuse rather
+// than risk leaking the token, falling back to a host-scoped lookup only when no
+// primary token is configured.
+func (p *DirProvider) tokenForRemoteHost(host string) (string, error) {
+	trustedHost := p.TerraformCloudHost
+	hostConfigured := trustedHost != ""
+	if trustedHost == "" {
+		trustedHost = "app.terraform.io"
+	}
+
+	var token string
+	if hostsEqual(host, trustedHost) {
+		token = p.TerraformCloudToken
+	} else if p.TerraformCloudToken != "" {
+		// A token is configured but the remote run lives on a different host.
+		// Refuse to run rather than risk leaking the token to an unverified host.
+		if hostConfigured {
+			return "", errors.Errorf("the remote Terraform run is hosted at %q, which does not match the configured Terraform Cloud host %q; Infracost will not send your Terraform Cloud token to an unverified host", host, trustedHost)
+		}
+		return "", errors.Errorf("the remote Terraform run is hosted at %q, but no trusted host is configured. Infracost will not send your Terraform Cloud token to an unverified host. If %q is trusted, set the TERRAFORM_CLOUD_HOST environment variable (or terraform_cloud_host config option) to it.", host, host)
+	}
+	if token == "" {
+		token = credentials.FindTerraformCloudToken(host)
+	}
+	if token == "" {
+		return "", credentials.ErrMissingCloudToken
+	}
+
+	return token, nil
+}
+
 func (p *DirProvider) runShow(opts *CmdOptions, planFile string, initOnFail bool) ([]byte, error) {
 	logging.Logger.Debug().Msg("Running terraform show")
 	args := []string{"show", "-no-color", "-json"}
```

**File**: `internal/providers/terraform/hcl_provider.go` (modified, +1/-0)
```diff
@@ -143,6 +143,7 @@ func NewHCLProvider(ctx *config.ProjectContext, rootPath hcl.RootPath, config *H
 			credsSource.BaseCredentialSet.Host,
 			credsSource.BaseCredentialSet.Token,
 			localWorkspace,
+			ctx.ProjectConfig.TerraformCloudHost != "",
 			loaderOpts...),
 		)
 	}
```

---

### Incident Patch 11: `565bcce8` (2026-07-01)
**Commit Message**: fix(pricing): stop failing pricing lookups for custom-priced components (#3589)

* fix(pricing): skip api lookup for custom-priced cost components

* fix(azure): match renamed postgresql flexible server Esv3 compute product

* fix(azure): match renamed backup protected vm storage meters

* test: refresh google golden files for pricing drift

* test: refresh azure automation golden files after watcher pricing move

**File**: `internal/apiclient/pricing.go` (modified, +20/-9)
```diff
@@ -333,27 +333,38 @@ func (c *PricingAPIClient) PerformRequest(req BatchRequest) ([]PriceQueryResult,
 		}
 
 		res[i].Query = query
+
+		// Custom-priced components have no product filter and can't be looked up via
+		// the API, so mark them filled to skip the request. Their price is applied
+		// from the custom price when the result is processed.
+		if req.keys[i].CostComponent.ProductFilter == nil {
+			res[i].filled = true
+		}
 	}
 
 	// first filter any queries that have been stored in the cache. We don't need to
 	// send requests for these as we already have the results in memory.
 	var serverQueries []pricingQuery
-	if c.cache == nil {
-		serverQueries = queries
-	} else {
-		var hit int
-		for i, query := range queries {
-			v, ok := c.cache.Get(query.hash)
-			if ok {
+	var hit int
+	for i, query := range queries {
+		if res[i].filled {
+			continue
+		}
+
+		if c.cache != nil {
+			if v, ok := c.cache.Get(query.hash); ok {
 				logging.Logger.Debug().Msgf("cache hit for query hash: %d", query.hash)
 				hit++
 				res[i].Result = v.Result
 				res[i].filled = true
-			} else {
-				serverQueries = append(serverQueries, query)
+				continue
 			}
 		}
 
+		serverQueries = append(serverQueries, query)
+	}
+
+	if c.cache != nil {
 		logging.Logger.Debug().Msgf("%d/%d queries were built from cache", hit, len(queries))
 	}
 
```

**File**: `internal/providers/terraform/azure/testdata/automation_account_test/automation_account_test.golden` (modified, +3/-3)
```diff
@@ -3,14 +3,14 @@
                                                                                                 
  azurerm_automation_account.allUsageEx                                                          
  ├─ Job run time                                         5  minutes                    $0.01  * 
- ├─ Non-azure config nodes                               2  nodes                     $12.00  * 
+ └─ Non-azure config nodes                               2  nodes                     $12.00  * 
                                                                                                 
  azurerm_automation_account.someUsageEx                                                         
- ├─ Job run time                                        20  minutes                    $0.04  * 
+ └─ Job run time                                        20  minutes                    $0.04  * 
                                                                                                 
  azurerm_automation_account.without_usage                                                       
  ├─ Job run time                           Monthly cost depends on usage: $0.002 per minutes    
- ├─ Non-azure config nodes                 Monthly cost depends on usage: $6.00 per nodes       
+ └─ Non-azure config nodes                 Monthly cost depends on usage: $6.00 per nodes       
                                                                                                 
  OVERALL TOTAL                                                                        $12.05 
 
```

**File**: `internal/providers/terraform/azure/testdata/automation_dsc_configuration_test/automation_dsc_configuration_test.golden` (modified, +1/-2)
```diff
@@ -6,8 +6,7 @@
                                                                                                           
  azurerm_automation_account.example                                                                       
  ├─ Job run time                                     Monthly cost depends on usage: $0.002 per minutes    
- ├─ Non-azure config nodes                           Monthly cost depends on usage: $6.00 per nodes       
- └─ Watchers                                         Monthly cost depends on usage: $0.002 per hours      
+ └─ Non-azure config nodes                           Monthly cost depends on usage: $6.00 per nodes       
                                                                                                           
  azurerm_automation_dsc_configuration.without_usage                                                       
  └─ Non-azure config nodes                           Monthly cost depends on usage: $6.00 per nodes       
```

**File**: `internal/providers/terraform/azure/testdata/automation_dsc_nodeconfiguration_test/automation_dsc_nodeconfiguration_test.golden` (modified, +1/-2)
```diff
@@ -6,8 +6,7 @@
                                                                                                              
  azurerm_automation_account.example                                                                          
  ├─ Job run time                                        Monthly cost depends on usage: $0.002 per minutes    
- ├─ Non-azure config nodes                              Monthly cost depends on usage: $6.00 per nodes       
- └─ Watchers                                            Monthly cost depends on usage: $0.002 per hours      
+ └─ Non-azure config nodes                              Monthly cost depends on usage: $6.00 per nodes       
                                                                                                              
  azurerm_automation_dsc_configuration.example                                                                
  └─ Non-azure config nodes                              Monthly cost depends on usage: $6.00 per nodes       
```

**File**: `internal/providers/terraform/google/testdata/compute_instance_test/compute_instance_test.golden` (modified, +12/-12)
```diff
@@ -16,7 +16,7 @@
  └─ NVIDIA L4 (on-demand)                                                  730  hours       $286.18   
                                                                                                       
  google_compute_instance.preemptible_gpu                                                              
- ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               730  hours       $176.06   
+ ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               730  hours       $169.39   
  ├─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
  └─ NVIDIA Tesla K80 (preemptible)                                       2,920  hours       $501.95   
                                                                                                       
@@ -51,8 +51,8 @@
  └─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
                                                                                                       
  google_compute_instance.custom_preemptible                                                           
- ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)              730  hours        $46.82   
- ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)                730  hours        $20.00   
+ ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)              730  hours        $44.41   
+ ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)                730  hours        $19.84   
  └─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
                                                                                                       
  google_compute_instance.local_ssd                                                                    
@@ -61,18 +61,18 @@
  └─ Local SSD provisioned storage                                          750  GB           $60.00   
                                                                                                       
  google_compute_instance.custom_n2d                                                                   
- ├─ Custom instance CPU (Linux/UNIX, preemptible, N2D 4 vCPUs)             730  hours        $17.52   
- ├─ Custom Instance RAM (Linux/UNIX, preemptible, N2D 20 GB)               730  hours        $11.72   
+ ├─ Custom instance CPU (Linux/UNIX, preemptible, N2D 4 vCPUs)             730  hours        $20.18   
+ ├─ Custom Instance RAM (Linux/UNIX, preemptible, N2D 20 GB)               730  hours        $13.52   
  └─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
                                                                                                       
- google_compute_instance.ssd                                                                          
- ├─ Instance usage (Linux/UNIX, on-demand, f1-micro)                       730  hours         $3.88   
- └─ SSD provisioned storage (pd-ssd)                                        40  GB            $6.80   
-                                                                                                      
  google_compute_instance.preemptible_local_ssd                                                        
  ├─ Instance usage (Linux/UNIX, preemptible, f1-micro)                     730  hours         $0.50   
  ├─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
- └─ Local SSD provisioned storage                                          375  GB            $9.45   
+ └─ Local SSD provisioned storage                                          375  GB           $13.28   
+                                                                                                      
+ google_compute_instance.ssd                                                                          
+ ├─ Instance usage (Linux/UNIX, on-demand, f1-micro)                       730  hours         $3.88   
+ └─ SSD provisioned storage (pd-ssd)                                        40  GB            $6.80   
                                                                                                       
  google_compute_instance.standard                                                                     
  ├─ Instance usage (Linux/UNIX, on-demand, f1-micro)                       730  hours         $3.88   
@@ -86,7 +86,7 @@
  ├─ Instance usage (Linux/UNIX, preemptible, f1-micro)                     730  hours         $0.50   
  └─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
                                                                                                       
- OVERALL TOTAL                                                                          $10,377.17 
+ OVERALL TOTAL                          
```

**File**: `internal/providers/terraform/google/testdata/container_cluster_test/container_cluster_test.golden` (modified, +17/-17)
```diff
@@ -10,7 +10,7 @@
  │  ├─ Instance usage (Linux/UNIX, on-demand, n1-standard-16)                 8,760  hours                  $4,660.30    
  │  └─ Standard provisioned storage (pd-standard)                             1,200  GB                        $48.00    
  └─ node_pool[1]                                                                                                         
-    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $2,112.74    
+    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $2,032.67    
     └─ Standard provisioned storage (pd-standard)                             1,200  GB                        $48.00    
                                                                                                                          
  google_container_cluster.with_node_pools_regional                                                                       
@@ -22,7 +22,7 @@
  │  ├─ Instance usage (Linux/UNIX, on-demand, n1-standard-16)                 4,380  hours                  $2,330.15    
  │  └─ Standard provisioned storage (pd-standard)                               600  GB                        $24.00    
  └─ node_pool[1]                                                                                                         
-    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $2,112.74    
+    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $2,032.67    
     └─ Standard provisioned storage (pd-standard)                             1,200  GB                        $48.00    
                                                                                                                          
  google_container_cluster.with_node_config                                                                               
@@ -42,18 +42,9 @@
  │  ├─ Instance usage (Linux/UNIX, on-demand, n1-standard-16)                 5,840  hours                  $3,106.86    
  │  └─ Standard provisioned storage (pd-standard)                               800  GB                        $32.00    
  └─ node_pool[1]                                                                                                         
-    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               2,920  hours                    $704.25    
+    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               2,920  hours                    $677.56    
     └─ Standard provisioned storage (pd-standard)                               400  GB                        $16.00    
                                                                                                                          
- google_container_cluster.with_unsupported_node_pool                                                                     
- ├─ Cluster management fee                                                      730  hours                     $73.00    
- ├─ default_pool                                                                                                         
- │  ├─ Instance usage (Linux/UNIX, on-demand, e2-medium)                      6,570  hours                    $220.13    
- │  └─ Standard provisioned storage (pd-standard)                               900  GB                        $36.00    
- └─ node_pool[1]                                                                                                         
-    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $2,112.74    
-    └─ Standard provisioned storage (pd-standard)                             1,200  GB                        $48.00    
-                                                                                                                         
  google_container_cluster.with_node_pools_zonal_withUsage                                                                
  ├─ Cluster management fee                                                      730  hours                     $73.00    
  ├─ default_pool                                                                                                         
@@ -63,9 +54,18 @@
  │  ├─ Instance usage (Linux/UNIX, on-demand, n1-standard-16)                 2,920  hours                  $1,553.43    
  │  └─ Standard provisioned storage (pd-standard)                               400  GB                        $16.00    
  └─ node_pool[1]                                                                                                         
-    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               2,920  hours                    $704.25    
+    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               2,920  hours                    $677.56    
     └
```

**File**: `internal/providers/terraform/google/testdata/container_node_pool_test/container_node_pool_test.golden` (modified, +6/-6)
```diff
@@ -65,13 +65,13 @@
  └─ Standard provisioned storage (pd-standard)                         800  GB           $32.00   
                                                                                                   
  google_container_node_pool.with_preemptible_instance                                             
- ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)        2,190  hours       $140.47   
- ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)          2,190  hours        $60.01   
+ ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)        2,190  hours       $133.24   
+ ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)          2,190  hours        $59.52   
  └─ Standard provisioned storage (pd-standard)                         300  GB           $12.00   
                                                                                                   
  google_container_node_pool.with_spot_instance                                                    
- ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)        2,190  hours       $140.47   
- ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)          2,190  hours        $60.01   
+ ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)        2,190  hours       $133.24   
+ ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)          2,190  hours        $59.52   
  └─ Standard provisioned storage (pd-standard)                         300  GB           $12.00   
                                                                                                   
  google_container_node_pool.autoscaling_zonal                                                     
@@ -122,7 +122,7 @@
  ├─ Instance usage (Linux/UNIX, on-demand, e2-medium)                1,460  hours        $48.92   
  └─ Standard provisioned storage (pd-standard)                         200  GB            $8.00   
                                                                                                   
- OVERALL TOTAL                                                                      $28,130.41 
+ OVERALL TOTAL                                                                      $28,114.99 
 
 *Usage costs can be estimated by updating Infracost Cloud settings, see docs for other options.
 
@@ -133,5 +133,5 @@
 ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━┳━━━━━━━━━━━━┓
 ┃ Project                                            ┃ Baseline cost ┃ Usage cost* ┃ Total cost ┃
 ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━╋━━━━━━━━━━━━┫
-┃ main                                               ┃       $28,130 ┃           - ┃    $28,130 ┃
+┃ main                                               ┃       $28,115 ┃           - ┃    $28,115 ┃
 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━┻━━━━━━━━━━━━┛
\ No newline at end of file
```

**File**: `internal/resources/azure/backup_protected_vm.go` (modified, +2/-2)
```diff
@@ -82,7 +82,7 @@ func (r *BackupProtectedVM) additionalCostForSizeOfVM() *schema.CostComponent {
 	quantity := decimal.NewFromInt(1)
 	filter := &schema.AttributeFilter{
 		Key:   "meterName",
-		Value: strPtr("Azure Files Protected Instances"),
+		Value: strPtr("Azure Files Protected Instance"),
 	}
 
 	utilization := r.diskUtilization()
@@ -138,7 +138,7 @@ func (r *BackupProtectedVM) storageCostsForVM() *schema.CostComponent {
 			ProductFamily: strPtr("Storage"),
 			AttributeFilters: []*schema.AttributeFilter{
 				{Key: "productName", Value: strPtr("Backup")},
-				{Key: "skuName", Value: strPtr("Standard")},
+				{Key: "skuName", Value: strPtr("Azure VM")},
 				{Key: "meterName", ValueRegex: strPtr(fmt.Sprintf("/^%s/i", dataStored))},
 			},
 		},
```

---

### Incident Patch 12: `f2842445` (2026-07-01)
**Commit Message**: fix(deps): bump deps and go version to patch CVEs (#3588)

* fix(deps): bump slack-go and go version to patch CVEs

* build: bump go base image to 1.25.11

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.25.8 AS builder
+FROM golang:1.25.11 AS builder
 
 ARG ARCH=linux
 ARG DEFAULT_TERRAFORM_VERSION=0.15.5
```

**File**: `Dockerfile.ci` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.25.8 AS builder
+FROM golang:1.25.11 AS builder
 
 ARG ARCH=linux64
 
```

**File**: `go.mod` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 module github.com/infracost/infracost
 
-go 1.25.8
+go 1.25.11
 
 require (
 	github.com/Masterminds/goutils v1.1.1 // indirect
@@ -76,7 +76,7 @@ require (
 	github.com/mitchellh/go-wordwrap v1.0.1 // indirect
 	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
 	github.com/modern-go/reflect2 v1.0.2 // indirect
-	github.com/slack-go/slack v0.12.3
+	github.com/slack-go/slack v0.27.0
 	github.com/tidwall/match v1.1.1 // indirect
 	github.com/tidwall/pretty v1.2.1 // indirect
 	golang.org/x/text v0.37.0
@@ -86,7 +86,7 @@ require (
 require (
 	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.10 // indirect
 	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.23 // indirect
-	github.com/gorilla/websocket v1.4.2 // indirect
+	github.com/gorilla/websocket v1.5.3 // indirect
 	golang.org/x/sync v0.20.0
 )
 
```

**File**: `go.sum` (modified, +6/-6)
```diff
@@ -1063,9 +1063,9 @@ github.com/go-task/slim-sprig v0.0.0-20230315185526-52ccab3ef572 h1:tfuBGBXKqDEe
 github.com/go-task/slim-sprig v0.0.0-20230315185526-52ccab3ef572/go.mod h1:9Pwr4B2jHnOSGXyyzV8ROjYa2ojvAY6HCGYYfMoC3Ls=
 github.com/go-test/deep v1.0.1/go.mod h1:wGDj63lr65AM2AQyKZd/NYHGb0R+1RLqB8NKt3aSFNA=
 github.com/go-test/deep v1.0.3/go.mod h1:wGDj63lr65AM2AQyKZd/NYHGb0R+1RLqB8NKt3aSFNA=
-github.com/go-test/deep v1.0.4/go.mod h1:wGDj63lr65AM2AQyKZd/NYHGb0R+1RLqB8NKt3aSFNA=
-github.com/go-test/deep v1.1.0 h1:WOcxcdHcvdgThNXjw0t76K42FXTU7HpNQWHpA2HHNlg=
 github.com/go-test/deep v1.1.0/go.mod h1:5C2ZWiW0ErCdrYzpqxLbTX7MG14M9iiw8DgHncVwcsE=
+github.com/go-test/deep v1.1.1 h1:0r/53hagsehfO4bzD2Pgr/+RgHqhmf+k1Bpse2cTu1U=
+github.com/go-test/deep v1.1.1/go.mod h1:5C2ZWiW0ErCdrYzpqxLbTX7MG14M9iiw8DgHncVwcsE=
 github.com/gobwas/glob v0.2.3 h1:A4xDbljILXROh+kObIiy5kIaPYD8e96x1tgBhUI5J+Y=
 github.com/gobwas/glob v0.2.3/go.mod h1:d3Ez4x06l9bZtSvzIay5+Yzi0fmZzPgnTbPcKjJAkT8=
 github.com/goccy/go-json v0.9.11/go.mod h1:6MelG93GURQebXPDq3khkgXZkazVtN9CRI+MGFi0w8I=
@@ -1223,8 +1223,8 @@ github.com/gophercloud/utils v0.0.0-20200423144003-7c72efc7435d/go.mod h1:ehWUbL
 github.com/gopherjs/gopherjs v0.0.0-20181017120253-0766667cb4d1/go.mod h1:wJfORRmW1u3UXTncJ5qlYoELFm8eSnnEO6hX4iZ3EWY=
 github.com/gorilla/websocket v1.4.0/go.mod h1:E7qHFY5m1UJ88s3WnNqhKjPHQ0heANvMoAMk2YaljkQ=
 github.com/gorilla/websocket v1.4.1/go.mod h1:YR8l580nyteQvAITg2hZ9XVh4b55+EU/adAjf1fMHhE=
-github.com/gorilla/websocket v1.4.2 h1:+/TMaTYc4QFitKJxsQ7Yye35DkWvkdLcvGKqM+x0Ufc=
-github.com/gorilla/websocket v1.4.2/go.mod h1:YR8l580nyteQvAITg2hZ9XVh4b55+EU/adAjf1fMHhE=
+github.com/gorilla/websocket v1.5.3 h1:saDtZ6Pbx/0u+bgYQ3q96pZgCzfhKXGPqt7kZ72aNNg=
+github.com/gorilla/websocket v1.5.3/go.mod h1:YR8l580nyteQvAITg2hZ9XVh4b55+EU/adAjf1fMHhE=
 github.com/goware/prefixer v0.0.0-20160118172347-395022866408 h1:Y9iQJfEqnN3/Nce9cOegemcy/9Ai5k3huT6E80F3zaw=
 github.com/goware/prefixer v0.0.0-20160118172347-395022866408/go.mod h1:PE1ycukgRPJ7bJ9a1fdfQ9j8i/cEcRAoLZzbxYpNB/s=
 github.com/grpc-ecosystem/go-grpc-middleware v1.0.0/go.mod h1:FiyG127CGDf3tlThmgyCl78X/SZQqEOJBCDaAfeWzPs=
@@ -1652,8 +1652,8 @@ github.com/sirupsen/logrus v1.9.3 h1:dueUQJ1C2q9oE3F7wvmSGAaVtTmUizReu6fjN8uqzbQ
 github.com/sirupsen/logrus v1.9.3/go.mod h1:naHLuLoDiP4jHNo9R0sCBMtWGeIprob74mVsIT4qYEQ=
 github.com/skeema/knownhosts v1.3.1 h1:X2osQ+RAjK76shCbvhHHHVl3ZlgDm8apHEHFqRjnBY8=
 github.com/skeema/knownhosts v1.3.1/go.mod h1:r7KTdC8l4uxWRyK2TpQZ/1o5HaSzh06ePQNxPwTcfiY=
-github.com/slack-go/slack v0.12.3 h1:92/dfFU8Q5XP6Wp5rr5/T5JHLM5c5Smtn53fhToAP88=
-github.com/slack-go/slack v0.12.3/go.mod h1:hlGi5oXA+Gt+yWTPP0plCdRKmjsDxecdHxYQdlMQKOw=
+github.com/slack-go/slack v0.27.0 h1:VWOpUzOK6UAPCCQlFxl79jhv8a/b+GOSJMnWziDJ8B8=
+github.com/slack-go/slack v0.27.0/go.mod h1:UEe+jmo9WLlwHB04qsOrTDvqM7Aa4rQL3O5wF3n0hx4=
 github.com/smartystreets/assertions v0.0.0-20180927180507-b2de0cb4f26d/go.mod h1:OnSkiWE9lh6wB0YB77sQom3nweQdgAjqCqsofrRNTgc=
 github.com/smartystreets/goconvey v0.0.0-20180222194500-ef6db91d284a/go.mod h1:XDJAKZRPZ1CvBcN2aX5YOUTYGHki24fSF0Iv48Ibg0s=
 github.com/soheilhy/cmux v0.1.4/go.mod h1:IM3LyeVVIOuxMH7sFAkER9+bJ4dT7Ms6E4xg4kGIyLM=
```

---

### Incident Patch 13: `4d39331a` (2026-06-26)
**Commit Message**: fix(security): resolve intermediate symlinks in path confinement [FIX-318] (#3586)

The config-template parser (readFile/pathExists/isDir/matchPaths) and the
hosted-app file()/templatefile() guard both confined paths with a lexical
Rel/HasPrefix check plus a leaf-only Lstat/EvalSymlinks. An intermediate
in-repo directory symlink (evil -> /etc, then readFile "evil/passwd")
defeats both: the path is lexically clean and the leaf isn't a symlink, so
it passed - but the read followed the symlink out of the repo.

Add internal/security.IsPathAllowed as the single containment boundary: it
resolves symlinks anywhere in the path (leaf and intermediate) before a
segment-aware prefix compare against the resolved parent, with a
longest-existing-prefix fallback for not-yet-existent paths and a
process-wide resolve cache. Route the template parser and the Terraform
funcs guard through it and drop the old isSubdirectory/symlinkPath helpers.

Mirrors the recent fixes in the v2 config (#14) and parser (#144) repos.

**File**: `internal/config/template/parser.go` (modified, +21/-34)
```diff
@@ -15,6 +15,7 @@ import (
 
 	"github.com/infracost/infracost/internal/config"
 	"github.com/infracost/infracost/internal/logging"
+	"github.com/infracost/infracost/internal/security"
 )
 
 var (
@@ -225,17 +226,18 @@ func (p *Parser) pathExists(base, path string) bool {
 		base = filepath.Join(p.repoDir, base)
 	}
 
-	// Ensure the base path is within the repo directory
-	baseAbs, _ := filepath.Abs(base)
-	repoDirAbs, _ := filepath.Abs(p.repoDir)
-
-	// Add a file separator at the end to ensure we don't match a directory that starts with the same prefix
-	// e.g. `/path/to/infracost` shouldn't match `/path/to/infra`.
-	if !strings.HasPrefix(fmt.Sprintf("%s%s", baseAbs, string(filepath.Separator)), fmt.Sprintf("%s%s", repoDirAbs, string(filepath.Separator))) {
+	// Ensure the base path is within the repo directory. IsPathAllowed
+	// resolves symlinks (including intermediate ones) so an in-repo symlink
+	// can't be used to escape the repository root.
+	if !security.IsPathAllowed(base, p.repoDir) {
 		return false
 	}
 
 	targetPath := filepath.Join(base, path)
+	if !security.IsPathAllowed(targetPath, p.repoDir) {
+		return false
+	}
+
 	if _, err := os.Stat(targetPath); err == nil {
 		return true
 	}
@@ -275,6 +277,12 @@ func (p *Parser) matchPaths(pattern string) []map[interface{}]interface{} {
 
 	var matches []map[interface{}]interface{}
 	_ = filepath.WalkDir(p.repoDir, func(path string, d fs.DirEntry, err error) error {
+		// Skip entries that resolve outside the repository root (e.g. an
+		// in-repo symlink pointing elsewhere) so matches stay confined.
+		if !security.IsPathAllowed(path, p.repoDir) {
+			return nil
+		}
+
 		rel, _ := filepath.Rel(p.repoDir, path)
 		res, _ := match(rel)
 		if res != nil {
@@ -328,6 +336,10 @@ func (p *Parser) relPath(basepath string, tarpath string) string {
 // isDir returns is path points to a directory.
 func (p *Parser) isDir(path string) bool {
 	fullPath := filepath.Join(p.repoDir, path)
+	if !security.IsPathAllowed(fullPath, p.repoDir) {
+		return false
+	}
+
 	info, err := os.Stat(fullPath)
 	if err != nil {
 		return false
@@ -338,11 +350,11 @@ func (p *Parser) isDir(path string) bool {
 
 // readFile reads the named file and returns the contents.
 func (p *Parser) readFile(path string) string {
-	if !isSubdirectory(p.repoDir, path) {
+	fullPath := filepath.Join(p.repoDir, path)
+	if !security.IsPathAllowed(fullPath, p.repoDir) {
 		panic(fmt.Sprintf("%q must be within the repository root %q", path, filepath.Base(p.repoDir)))
 	}
 
-	fullPath := filepath.Join(p.repoDir, path)
 	b, err := os.ReadFile(fullPath)
 	if err != nil {
 		panic(err)
@@ -382,31 +394,6 @@ func (p *Parser) isProduction(value string) bool {
 	return p.config.IsProduction(value)
 }
 
-func isSubdirectory(base, target string) bool {
-	full := filepath.Join(base, target)
-	fileInfo, err := os.Lstat(full)
-	if err != nil {
-		return false
-	}
-
-	absBasePath, err := filepath.Abs(base)
-	if err != nil {
-		return false
-	}
-
-	absTargetPath, err := filepath.Abs(full)
-	if err != nil {
-		return false
-	}
-
-	relPath, err := filepath.Rel(absBasePath, absTargetPath)
-	if err != nil {
-		return false
-	}
-
-	return !strings.HasPrefix(relPath, "..") && fileInfo.Mode()&os.ModeSymlink == 0
-}
-
 // strval returns the string representation of v.
 // Taken from https://github.com/Masterminds/sprig/blob/581758eb7d96ae4d113649668fa96acc74d46e7f/strings.go#L174
 func strval(v interface{}) string {
```

**File**: `internal/config/template/security_test.go` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+package template
+
+import (
+	"bytes"
+	"os"
+	"path/filepath"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+// setupSymlinkRepo builds a repo tree that mirrors the FIX-313 PoC:
+//
+//	repo/                 -- the repository root the parser is confined to
+//	  inside/secret.tf    -- a legitimate in-repo file
+//	  evil -> outside     -- an intermediate symlink escaping the repo
+//	  finlink -> outside/secret  -- a leaf symlink escaping the repo
+//	outside/secret        -- a secret that lives outside the repo root
+//
+// It returns the repo dir.
+func setupSymlinkRepo(t *testing.T) string {
+	t.Helper()
+
+	tmp := t.TempDir()
+	repo := filepath.Join(tmp, "repo")
+	outside := filepath.Join(tmp, "outside")
+
+	require.NoError(t, os.MkdirAll(filepath.Join(repo, "inside"), 0700))
+	require.NoError(t, os.MkdirAll(outside, 0700))
+	require.NoError(t, os.WriteFile(filepath.Join(repo, "inside", "secret.tf"), []byte("in-repo"), 0600))
+	require.NoError(t, os.WriteFile(filepath.Join(outside, "secret"), []byte("TOP-SECRET"), 0600))
+	require.NoError(t, os.Symlink(outside, filepath.Join(repo, "evil")))
+	require.NoError(t, os.Symlink(filepath.Join(outside, "secret"), filepath.Join(repo, "finlink")))
+
+	return repo
+}
+
+func TestParser_readFile_confinement(t *testing.T) {
+	repo := setupSymlinkRepo(t)
+	p := NewParser(repo, Variables{}, nil)
+
+	// Legitimate in-repo read works.
+	assert.Equal(t, "in-repo", p.readFile("inside/secret.tf"))
+
+	// Lexical parent traversal is blocked.
+	assert.Panics(t, func() { p.readFile("../outside/secret") },
+		"parent-directory traversal must be blocked")
+
+	// Leaf symlink escaping the repo is blocked.
+	assert.Panics(t, func() { p.readFile("finlink") },
+		"leaf symlink escaping the repo must be blocked")
+
+	// Intermediate symlink escaping the repo is blocked (the FIX-313 gap).
+	assert.Panics(t, func() { p.readFile("evil/secret") },
+		"intermediate symlink escaping the repo must be blocked")
+}
+
+func TestParser_pathExists_confinement(t *testing.T) {
+	repo := setupSymlinkRepo(t)
+	p := NewParser(repo, Variables{}, nil)
+
+	// Legitimate in-repo path exists.
+	assert.True(t, p.pathExists("inside", "secret.tf"))
+
+	// Parent traversal to a real file outside the repo reports false.
+	assert.False(t, p.pathExists(".", "../outside/secret"),
+		"parent-directory traversal must not be reported as existing")
+
+	// Intermediate symlink escaping the repo reports false even though the
+	// underlying file exists.
+	assert.False(t, p.pathExists("evil", "secret"),
+		"path traversing an intermediate symlink must not be reported as existing")
+
+	// A base that is itself an escaping symlink reports false.
+	assert.False(t, p.pathExists("evil", ""),
+		"a base that escapes the repo via a symlink must not be reported as existing")
+}
+
+func TestParser_isDir_confinement(t *testing.T) {
+	repo := setupSymlinkRepo(t)
+	p := NewParser(repo, Variables{}, nil)
+
+	// Legitimate in-repo directory.
+	assert.True(t, p.isDir("inside"))
+
+	// The intermediate symlink resolves to an out-of-repo directory and must
+	// not be reported as an in-repo directory.
+	assert.False(t, p.isDir("evil"),
+		"a symlinked directory escaping the repo must not be reported as a dir")
+}
+
+func TestParser_matchPaths_confinement(t *testing.T) {
+	repo := setupSymlinkRepo(t)
+	p := NewParser(repo, Variables{}, nil)
+
+	matches := p.matchPaths(":dir/secret")
+
+	// Nothing reached via the escaping `evil` symlink may appear.
+	for _, m := range matches {
+		assert.NotEqual(t, "evil", m["_dir"],
+			"matchPaths must not return entries reached via an escaping symlink")
+	}
+}
+
+// TestParser_Compile_readFile_blocksIntermediateSymlink drives the real
+// template entrypoint (Compile) with the exact PoC payload from FIX-313 and
+// asserts the out-of-repo secret is never rendered into the output.
+func TestParser_Compile_readFile_blocksIntermediateSymlink(t *testing.T) {
+	repo := setupSymlinkRepo(t)
+	p := NewParser(repo, Variables{}, nil)
+
+	var buf bytes.Buffer
+	err := p.Compile(`{{ readFile "evil/secret" }}`, &buf)
+
+	require.Error(t, err, "rendering a template that escapes the repo must error")
+	assert.NotContains(t, buf.String(), "TOP-SECRET",
+		"the out-of-repo secret must never be rendered into the output")
+}
```

**File**: `internal/hcl/funcs/filesystem.go` (modified, +6/-26)
```diff
@@ -4,7 +4,6 @@ import (
 	"fmt"
 	"os"
 	"path/filepath"
-	"strings"
 
 	"github.com/bmatcuk/doublestar"
 	homedir "github.com/mitchellh/go-homedir"
@@ -13,6 +12,7 @@ import (
 	"github.com/zclconf/go-cty/cty/function"
 
 	"github.com/infracost/infracost/internal/logging"
+	"github.com/infracost/infracost/internal/security"
 )
 
 func MakeFileFunc(baseDir string, encBase64 bool) function.Function {
@@ -254,33 +254,13 @@ func isPathInRepo(path string) error {
 		path = filepath.Join(wd, path)
 	}
 
-	// ensure the path resolves to the real symlink path
-	path = symlinkPath(path)
-
-	clean := filepath.Clean(wd)
-	if wd != "" && !strings.HasPrefix(path, clean) {
+	// security.IsPathAllowed resolves symlinks anywhere in the path (leaf and
+	// intermediate directory symlinks) before checking containment, so an
+	// in-repo symlink can't be used to escape the repository directory via a
+	// path like dir-link/secret whose leaf isn't itself a symlink.
+	if wd != "" && !security.IsPathAllowed(path, wd) {
 		return fmt.Errorf("file %s is not within the repository directory %s", path, wd)
 	}
 
 	return nil
 }
-
-// symlinkPath checks the given file path and returns the real path if it is a
-// symlink.
-func symlinkPath(filepathStr string) string {
-	fileInfo, err := os.Lstat(filepathStr)
-	if err != nil {
-		return filepathStr
-	}
-
-	if fileInfo.Mode()&os.ModeSymlink != 0 {
-		realPath, err := filepath.EvalSymlinks(filepathStr)
-		if err != nil {
-			return filepathStr
-		}
-
-		return realPath
-	}
-
-	return filepathStr
-}
```

**File**: `internal/hcl/funcs/filesystem_test.go` (modified, +54/-0)
```diff
@@ -2,8 +2,12 @@ package funcs
 
 import (
 	"fmt"
+	"os"
+	"path/filepath"
 	"testing"
 
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
 	"github.com/zclconf/go-cty/cty"
 	"github.com/zclconf/go-cty/cty/function"
 	"github.com/zclconf/go-cty/cty/function/stdlib"
@@ -496,3 +500,53 @@ func TestFileBase64(t *testing.T) {
 		})
 	}
 }
+
+// TestIsFullPathWithinRepo_BlocksIntermediateSymlink locks in the FIX-318
+// hardening of the hosted-app file()/templatefile() guard: when running in the
+// github/gitlab app environment, a path that escapes the repository directory
+// via an intermediate directory symlink (whose leaf isn't itself a symlink)
+// must be rejected. The previous leaf-only symlinkPath resolver let it through.
+func TestIsFullPathWithinRepo_BlocksIntermediateSymlink(t *testing.T) {
+	// repo/                -- the working directory / repository root
+	//   inside/main.tf     -- a legitimate in-repo file
+	//   evil -> outside    -- an intermediate symlink escaping the repo
+	// outside/secret       -- a secret living outside the repo root
+	tmp := t.TempDir()
+	repo := filepath.Join(tmp, "repo")
+	outside := filepath.Join(tmp, "outside")
+	require.NoError(t, os.MkdirAll(filepath.Join(repo, "inside"), 0700))
+	require.NoError(t, os.MkdirAll(outside, 0700))
+	require.NoError(t, os.WriteFile(filepath.Join(repo, "inside", "main.tf"), []byte("# tf"), 0600))
+	require.NoError(t, os.WriteFile(filepath.Join(outside, "secret"), []byte("TOP-SECRET"), 0600))
+	require.NoError(t, os.Symlink(outside, filepath.Join(repo, "evil")))
+
+	// isPathInRepo checks against the process working directory.
+	t.Chdir(repo)
+	t.Setenv("INFRACOST_CI_PLATFORM", "github_app")
+
+	// Legitimate in-repo path is allowed.
+	require.NoError(t, isFullPathWithinRepo(repo, "inside/main.tf"),
+		"an in-repo path must be allowed")
+
+	// Intermediate symlink escaping the repo is rejected (the FIX-318 gap).
+	assert.Error(t, isFullPathWithinRepo(repo, "evil/secret"),
+		"a path traversing an intermediate symlink out of the repo must be rejected")
+}
+
+// TestIsFullPathWithinRepo_NoopOutsideHostedApp confirms the guard stays a
+// no-op when not running in the github/gitlab app environment, preserving the
+// existing behaviour for the standalone CLI.
+func TestIsFullPathWithinRepo_NoopOutsideHostedApp(t *testing.T) {
+	tmp := t.TempDir()
+	repo := filepath.Join(tmp, "repo")
+	outside := filepath.Join(tmp, "outside")
+	require.NoError(t, os.MkdirAll(repo, 0700))
+	require.NoError(t, os.MkdirAll(outside, 0700))
+	require.NoError(t, os.Symlink(outside, filepath.Join(repo, "evil")))
+
+	t.Chdir(repo)
+	t.Setenv("INFRACOST_CI_PLATFORM", "")
+
+	assert.NoError(t, isFullPathWithinRepo(repo, "evil/secret"),
+		"the guard must be a no-op outside the hosted github/gitlab app environment")
+}
```

**File**: `internal/security/files.go` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+// Package security contains security related functions, mainly checking a file
+// is within a given path, and symlink handling.
+package security
+
+import (
+	"os"
+	"path/filepath"
+	"strings"
+	"sync"
+)
+
+// IsPathAllowed checks if a path is within any of the supplied parent paths.
+// It is the containment security boundary: it resolves symlinks anywhere in
+// the path (leaf AND intermediate directory symlinks) before comparing against
+// the resolved parents, and returns false if the resolved path escapes every
+// supplied parent. An in-repo symlink (e.g. evil -> /etc) therefore cannot be
+// used to read files outside the allowed parents via a path like evil/passwd
+// whose leaf isn't itself a symlink.
+//
+// Symlink resolution is cached process-wide via resolveCache so repeated calls
+// during a parse session don't repeat the (multiple) syscalls per path.
+func IsPathAllowed(path string, allowedParents ...string) bool {
+	if path == "" {
+		path = "."
+	}
+
+	pathAbs, err := filepath.Abs(path)
+	if err != nil {
+		return false
+	}
+
+	pathResolved := resolvePathCached(pathAbs)
+
+	for _, parent := range allowedParents {
+		if parent == "" {
+			continue
+		}
+		parentAbs, err := filepath.Abs(parent)
+		if err != nil {
+			continue
+		}
+		parentResolved := resolvePathCached(parentAbs)
+
+		if strings.HasPrefix(pathResolved+string(filepath.Separator), parentResolved+string(filepath.Separator)) {
+			return true
+		}
+	}
+
+	return false
+}
+
+// resolveCache memoises symlink resolution keyed by absolute, uncleaned input
+// path. Filesystem state changes during a parse session would invalidate the
+// cache, but parser usage doesn't mutate the paths it's inspecting — sources
+// are read-only during evaluation.
+var resolveCache sync.Map
+
+func resolvePathCached(pathAbs string) string {
+	if v, ok := resolveCache.Load(pathAbs); ok {
+		return v.(string)
+	}
+	resolved, err := RecursivelyResolveSymlink(pathAbs)
+	if err != nil {
+		resolved = pathAbs
+	}
+	resolved = filepath.Clean(resolved)
+	resolveCache.Store(pathAbs, resolved)
+	return resolved
+}
+
+// RecursivelyResolveSymlink resolves symlinks anywhere in the path, not just
+// at the leaf. A leaf-only implementation misses intermediate directory
+// symlinks: a legitimate-looking path like /repo-root/dir-link/passwd, where
+// dir-link -> /etc, would pass an IsPathAllowed(/repo-root, ...) check because
+// the leaf "passwd" isn't a symlink — but reading the path actually opens
+// /etc/passwd, which is a path-traversal escape from the allowed-dirs sandbox.
+//
+// filepath.EvalSymlinks normally errors when any component of the path doesn't
+// exist (e.g. existence checks for candidate paths that aren't there yet). For
+// those cases we walk up to the longest existing prefix, resolve that, then
+// rejoin the missing tail — so prefix-matching still aligns with how parents
+// are themselves resolved.
+func RecursivelyResolveSymlink(path string) (string, error) {
+	if resolved, err := filepath.EvalSymlinks(path); err == nil {
+		return resolved, nil
+	}
+	// path or some ancestor doesn't exist. Walk up until we find an existing
+	// ancestor, resolve that, then append the missing tail.
+	missing := []string{}
+	dir := path
+	for {
+		parent := filepath.Dir(dir)
+		if parent == dir {
+			// hit root without finding anything that exists; nothing to
+			// resolve, return the original cleaned path.
+			return filepath.Clean(path), nil
+		}
+		missing = append([]string{filepath.Base(dir)}, missing...)
+		dir = parent
+		resolved, err := filepath.EvalSymlinks(dir)
+		if err != nil {
+			continue
+		}
+		return filepath.Join(append([]string{resolved}, missing...)...), nil
+	}
+}
+
+// IsSymlink returns true if the path's leaf is a symlink.
+func IsSymlink(path string) bool {
+	fileInfo, err := os.Lstat(path)
+	return err == nil && fileInfo.Mode()&os.ModeSymlink == os.ModeSymlink
+}
```

**File**: `internal/security/files_test.go` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+package security
+
+import (
+	"os"
+	"path/filepath"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+// TestIsPathAllowed_BlocksIntermediateSymlinkTraversal locks in the security
+// posture that intermediate directory symlinks are resolved before the
+// allowed-parents check. Before this fix, a legitimately-named path like
+// /repo-root/dir-link/passwd where dir-link points outside the repo would
+// pass IsPathAllowed because the leaf wasn't a symlink — letting parser/
+// template code read files outside the sandbox.
+func TestIsPathAllowed_BlocksIntermediateSymlinkTraversal(t *testing.T) {
+	// repo/    -- the allowed parent
+	//   inside/ -- a directory inside repo (touched so it exists)
+	//   link  -- symlink pointing OUTSIDE repo to ../outside
+	// outside/
+	//   secret -- the file we shouldn't be able to reach via repo/link/secret
+	tmp := t.TempDir()
+	repo := filepath.Join(tmp, "repo")
+	outside := filepath.Join(tmp, "outside")
+	require.NoError(t, os.MkdirAll(filepath.Join(repo, "inside"), 0700))
+	require.NoError(t, os.MkdirAll(outside, 0700))
+	require.NoError(t, os.WriteFile(filepath.Join(outside, "secret"), []byte("nope"), 0600))
+	require.NoError(t, os.Symlink(outside, filepath.Join(repo, "link")))
+
+	// /repo/inside/file (entirely within repo) — allowed
+	assert.True(t, IsPathAllowed(filepath.Join(repo, "inside", "anything"), repo),
+		"a path inside the allowed parent should be allowed")
+
+	// /repo/link/secret — link points OUTSIDE repo. The leaf "secret" is
+	// not a symlink, but the intermediate "link" is. This is the case the
+	// old leaf-only resolver missed.
+	assert.False(t, IsPathAllowed(filepath.Join(repo, "link", "secret"), repo),
+		"a path traversing an intermediate symlink that escapes the allowed parent must be rejected")
+
+	// /repo/link (the symlink itself, leaf is the symlink) — also points
+	// outside, must be rejected.
+	assert.False(t, IsPathAllowed(filepath.Join(repo, "link"), repo),
+		"a leaf-symlink that targets outside the allowed parent must be rejected")
+}
+
+// TestIsPathAllowed_HandlesNonExistentPaths verifies the longest-existing-
+// prefix resolver — existence checks walk candidate paths that don't exist
+// yet, and the security check must still recognize them as inside the allowed
+// parent.
+func TestIsPathAllowed_HandlesNonExistentPaths(t *testing.T) {
+	tmp := t.TempDir()
+	repo := filepath.Join(tmp, "repo")
+	require.NoError(t, os.MkdirAll(repo, 0700))
+
+	// Candidate file doesn't exist yet. Still inside repo.
+	assert.True(t, IsPathAllowed(filepath.Join(repo, "doesnotexist.tf"), repo),
+		"a non-existent path inside the allowed parent should be allowed")
+
+	// Candidate file with a non-existent intermediate dir, still inside repo.
+	assert.True(t, IsPathAllowed(filepath.Join(repo, "missing", "nested", "file.tf"), repo),
+		"a deeply nested non-existent path inside the allowed parent should be allowed")
+
+	// Candidate file outside the repo — even if it doesn't exist, must be rejected.
+	assert.False(t, IsPathAllowed(filepath.Join(tmp, "elsewhere", "file.tf"), repo),
+		"a non-existent path outside the allowed parent must be rejected")
+}
```

---

### Incident Patch 14: `c9c4eb7b` (2026-06-03)
**Commit Message**: fix(deps): bump otel, x/net, x/crypto, go-git for container CVEs (#3581)

These ship in the infracost CLI binary, which is embedded in the
hosted-cloud-pricing-api and dashboard-api-worker images:
- go.opentelemetry.io/otel v1.43.0 => v1.44.0 (CVE-2026-29181)
- golang.org/x/net v0.48.0 => v0.55.0 (CVE-2026-39821)
- golang.org/x/crypto v0.46.0 => v0.52.0 (CVE-2026-46595/39834/39832/42508/39833)
- github.com/go-git/go-git/v5 => v5.19.1 (CVE-2026-41506)

Clears those findings once a new CLI release/preview build ships.

**File**: `go.mod` (modified, +17/-16)
```diff
@@ -38,8 +38,8 @@ require (
 	github.com/stretchr/testify v1.11.1
 	github.com/tidwall/gjson v1.17.0
 	github.com/zclconf/go-cty v1.17.0
-	golang.org/x/crypto v0.46.0 // indirect
-	golang.org/x/mod v0.30.0
+	golang.org/x/crypto v0.52.0 // indirect
+	golang.org/x/mod v0.35.0
 	gopkg.in/go-playground/assert.v1 v1.2.1
 	gopkg.in/yaml.v2 v2.4.0
 	gopkg.in/yaml.v3 v3.0.1
@@ -48,7 +48,7 @@ require (
 require (
 	github.com/aws/aws-sdk-go-v2/service/eks v1.73.3
 	github.com/hashicorp/terraform-config-inspect v0.0.0-20210625153042-09f34846faab
-	golang.org/x/sys v0.42.0 // indirect
+	golang.org/x/sys v0.45.0 // indirect
 )
 
 require (
@@ -79,15 +79,15 @@ require (
 	github.com/slack-go/slack v0.12.3
 	github.com/tidwall/match v1.1.1 // indirect
 	github.com/tidwall/pretty v1.2.1 // indirect
-	golang.org/x/text v0.32.0
-	golang.org/x/tools v0.39.0 // indirect
+	golang.org/x/text v0.37.0
+	golang.org/x/tools v0.44.0 // indirect
 )
 
 require (
 	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.10 // indirect
 	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.23 // indirect
 	github.com/gorilla/websocket v1.4.2 // indirect
-	golang.org/x/sync v0.19.0
+	golang.org/x/sync v0.20.0
 )
 
 require (
@@ -96,8 +96,8 @@ require (
 	github.com/channelmeter/iso8601duration v0.0.0-20150204201828-8da3af7a2a61
 	github.com/fatih/camelcase v1.0.0
 	github.com/go-errors/errors v1.4.2
-	github.com/go-git/go-billy/v5 v5.8.0
-	github.com/go-git/go-git/v5 v5.18.0
+	github.com/go-git/go-billy/v5 v5.9.0
+	github.com/go-git/go-git/v5 v5.19.1
 	github.com/google/go-github/v41 v41.0.0
 	github.com/gruntwork-io/go-commons v0.17.1
 	github.com/gruntwork-io/terragrunt v0.52.4
@@ -120,7 +120,7 @@ require (
 	github.com/turbot/terraform-components v0.0.0-20231213122222-1f3526cab7a7
 	github.com/withfig/autocomplete-tools/packages/cobra v1.2.0
 	github.com/xanzy/go-gitlab v0.86.0
-	golang.org/x/exp v0.0.0-20240719175910-8a7402abbf56
+	golang.org/x/exp v0.0.0-20260410095643-746e56fc9e2f
 	golang.org/x/oauth2 v0.34.0
 	k8s.io/apimachinery v0.29.2
 )
@@ -171,7 +171,7 @@ require (
 	github.com/containerd/continuity v0.3.0 // indirect
 	github.com/cpuguy83/go-md2man/v2 v2.0.6 // indirect
 	github.com/creack/pty v1.1.11 // indirect
-	github.com/cyphar/filepath-securejoin v0.4.1 // indirect
+	github.com/cyphar/filepath-securejoin v0.6.1 // indirect
 	github.com/dimchansky/utfbom v1.1.1 // indirect
 	github.com/dlclark/regexp2 v1.8.1 // indirect
 	github.com/dsnet/compress v0.0.2-0.20230904184137-39efe44ab707 // indirect
@@ -213,6 +213,7 @@ require (
 	github.com/jessevdk/go-flags v1.5.0 // indirect
 	github.com/jstemmer/go-junit-report v1.0.0 // indirect
 	github.com/kevinburke/ssh_config v1.2.0 // indirect
+	github.com/klauspost/cpuid/v2 v2.3.0 // indirect
 	github.com/klauspost/pgzip v1.2.6 // indirect
 	github.com/lib/pq v1.10.5 // indirect
 	github.com/mattn/go-zglob v0.0.3 // indirect
@@ -224,7 +225,7 @@ require (
 	github.com/oklog/run v1.1.0 // indirect
 	github.com/owenrumney/go-sarif v1.1.1 // indirect
 	github.com/pierrec/lz4/v4 v4.1.21 // indirect
-	github.com/pjbgf/sha1cd v0.3.2 // indirect
+	github.com/pjbgf/sha1cd v0.6.0 // indirect
 	github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10 // indirect
 	github.com/prometheus/client_golang v1.22.0 // indirect
 	github.com/prometheus/client_model v0.6.2 // indirect
@@ -256,13 +257,13 @@ require (
 	go.opentelemetry.io/contrib/detectors/gcp v1.39.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.54.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0 // indirect
-	go.opentelemetry.io/otel v1.43.0 // indirect
-	go.opentelemetry.io/otel/metric v1.43.0 // indirect
+	go.opentelemetry.io/otel v1.44.0 // indirect
+	go.opentelemetry.io/otel/metric v1.44.0 // indirect
 	go.opentelemetry.io/otel/sdk v1.43.0 // indirect
 	go.opentelemetry.io/otel/sdk/metric v1.43.0 // indirect
-	go.opentelemetry.io/otel/trace v1.43.0 // indirect
+	go.opentelemetry.io/otel/trace v1.44.0 // indirect
 	go4.org v0.0.0-20230225012048-214862532bf5 // indirect
-	golang.org/x/term v0.38.0 // indirect
+	golang.org/x/term v0.43.0 // indirect
 	golang.org/x/time v0.11.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20251202230838-ff82c1b0f217 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20251202230838-ff82c1b0f217 // indirect
@@ -302,7 +303,7 @@ require (
 	github.com/yashtewari/glob-intersection v0.2.0 // indirect
 	github.com/zclconf/go-cty-yaml v1.0.3
 	go.opencensus.io v0.24.0 // indirect
-	golang.org/x/net v0.48.0 // indirect
+	golang.org/x/net v0.55.0 // indirect
 	google.golang.org/api v0.215.0
 	google.golang.org/genproto v0.0.0-20241118233622-e639e219e697 // indirect
 	google.golang.org/grpc v1.79.3 // indirect
```

**File**: `go.sum` (modified, +34/-32)
```diff
@@ -922,8 +922,8 @@ github.com/cpuguy83/go-md2man/v2 v2.0.6/go.mod h1:oOW0eioCTA6cOiMLiUPZOpcVxMig6N
 github.com/creack/pty v1.1.9/go.mod h1:oKZEueFk5CKHvIhNR5MUki03XCEU+Q6VDXinZuGJ33E=
 github.com/creack/pty v1.1.11 h1:07n33Z8lZxZ2qwegKbObQohDhXDQxiMMz1NOUGYlesw=
 github.com/creack/pty v1.1.11/go.mod h1:oKZEueFk5CKHvIhNR5MUki03XCEU+Q6VDXinZuGJ33E=
-github.com/cyphar/filepath-securejoin v0.4.1 h1:JyxxyPEaktOD+GAnqIqTf9A8tHyAG22rowi7HkoSU1s=
-github.com/cyphar/filepath-securejoin v0.4.1/go.mod h1:Sdj7gXlvMcPZsbhwhQ33GguGLDGQL7h7bg04C/+u9jI=
+github.com/cyphar/filepath-securejoin v0.6.1 h1:5CeZ1jPXEiYt3+Z6zqprSAgSWiggmpVyciv8syjIpVE=
+github.com/cyphar/filepath-securejoin v0.6.1/go.mod h1:A8hd4EnAeyujCJRrICiOWqjS1AX0a9kM5XL+NwKoYSc=
 github.com/dave/dst v0.27.2 h1:4Y5VFTkhGLC1oddtNwuxxe36pnyLxMFXT51FOzH8Ekc=
 github.com/dave/dst v0.27.2/go.mod h1:jHh6EOibnHgcUW3WjKHisiooEkYwqpHLBSX1iOBhEyc=
 github.com/dave/jennifer v1.5.0 h1:HmgPN93bVDpkQyYbqhCHj5QlgvUkvEOzMyEvKLgCRrg=
@@ -1027,12 +1027,12 @@ github.com/go-fonts/liberation v0.2.0/go.mod h1:K6qoJYypsmfVjWg8KOVDQhLc8UDgIK2H
 github.com/go-fonts/stix v0.1.0/go.mod h1:w/c1f0ldAUlJmLBvlbkvVXLAD+tAMqobIIQpmnUIzUY=
 github.com/go-git/gcfg v1.5.1-0.20230307220236-3a3c6141e376 h1:+zs/tPmkDkHx3U66DAb0lQFJrpS6731Oaa12ikc+DiI=
 github.com/go-git/gcfg v1.5.1-0.20230307220236-3a3c6141e376/go.mod h1:an3vInlBmSxCcxctByoQdvwPiA7DTK7jaaFDBTtu0ic=
-github.com/go-git/go-billy/v5 v5.8.0 h1:I8hjc3LbBlXTtVuFNJuwYuMiHvQJDq1AT6u4DwDzZG0=
-github.com/go-git/go-billy/v5 v5.8.0/go.mod h1:RpvI/rw4Vr5QA+Z60c6d6LXH0rYJo0uD5SqfmrrheCY=
+github.com/go-git/go-billy/v5 v5.9.0 h1:jItGXszUDRtR/AlferWPTMN4j38BQ88XnXKbilmmBPA=
+github.com/go-git/go-billy/v5 v5.9.0/go.mod h1:jCnQMLj9eUgGU7+ludSTYoZL/GGmii14RxKFj7ROgHw=
 github.com/go-git/go-git-fixtures/v4 v4.3.2-0.20231010084843-55a94097c399 h1:eMje31YglSBqCdIqdhKBW8lokaMrL3uTkpGYlE2OOT4=
 github.com/go-git/go-git-fixtures/v4 v4.3.2-0.20231010084843-55a94097c399/go.mod h1:1OCfN199q1Jm3HZlxleg+Dw/mwps2Wbk9frAWm+4FII=
-github.com/go-git/go-git/v5 v5.18.0 h1:O831KI+0PR51hM2kep6T8k+w0/LIAD490gvqMCvL5hM=
-github.com/go-git/go-git/v5 v5.18.0/go.mod h1:pW/VmeqkanRFqR6AljLcs7EA7FbZaN5MQqO7oZADXpo=
+github.com/go-git/go-git/v5 v5.19.1 h1:nX27AnaU43/K5bKktKwgBmR9lawoYVe1Ckg0rgzzN00=
+github.com/go-git/go-git/v5 v5.19.1/go.mod h1:Pb1v0c7/g8aGQJwx9Us09W85yGoyvSwuhEGMH7zjDKQ=
 github.com/go-gl/glfw v0.0.0-20190409004039-e6da0acd62b1/go.mod h1:vR7hzQXu2zJy9AVAgeJqvqgH9Q5CA+iKCZ2gyEVpxRU=
 github.com/go-gl/glfw/v3.3/glfw v0.0.0-20191125211704-12ad95a8df72/go.mod h1:tQ2UAYgL5IevRw8kRxooKSPJfGvJ9fJQFa0TUsXzTg8=
 github.com/go-gl/glfw/v3.3/glfw v0.0.0-20200222043503-6f7a984d4dc4/go.mod h1:tQ2UAYgL5IevRw8kRxooKSPJfGvJ9fJQFa0TUsXzTg8=
@@ -1404,6 +1404,8 @@ github.com/klauspost/compress v1.18.0 h1:c/Cqfb0r+Yi+JtIEq73FWXVkRonBlf0CRNYc8Zt
 github.com/klauspost/compress v1.18.0/go.mod h1:2Pp+KzxcywXVXMr50+X0Q/Lsb43OQHYWRCY2AiWywWQ=
 github.com/klauspost/cpuid v1.2.0/go.mod h1:Pj4uuM528wm8OyEC2QMXAi2YiTZ96dNQPGgoMS4s3ek=
 github.com/klauspost/cpuid/v2 v2.0.9/go.mod h1:FInQzS24/EEf25PyTYn52gqo7WaD8xa0213Md/qVLRg=
+github.com/klauspost/cpuid/v2 v2.3.0 h1:S4CRMLnYUhGeDFDqkGriYKdfoFlDnMtqTiI/sFzhA9Y=
+github.com/klauspost/cpuid/v2 v2.3.0/go.mod h1:hqwkgyIinND0mEev00jJYCxPNVRVXFQeu1XKlok6oO0=
 github.com/klauspost/pgzip v1.2.6 h1:8RXeL5crjEUFnR2/Sn6GJNWtSQ3Dk8pq4CL3jvdDyjU=
 github.com/klauspost/pgzip v1.2.6/go.mod h1:Ch1tH69qFZu15pkjo5kYi6mth2Zzwzt50oCQKQE9RUs=
 github.com/konsorten/go-windows-terminal-sequences v1.0.1/go.mod h1:T0+1ngSBFLxvqU3pZ+m/2kptfBszLMUkC4ZK/EgS/cQ=
@@ -1567,8 +1569,8 @@ github.com/phpdave11/gofpdi v1.0.13/go.mod h1:vBmVV0Do6hSBHC8uKUQ71JGW+ZGQq74llk
 github.com/pierrec/lz4/v4 v4.1.15/go.mod h1:gZWDp/Ze/IJXGXf23ltt2EXimqmTUXEy0GFuRQyBid4=
 github.com/pierrec/lz4/v4 v4.1.21 h1:yOVMLb6qSIDP67pl/5F7RepeKYu/VmTyEXvuMI5d9mQ=
 github.com/pierrec/lz4/v4 v4.1.21/go.mod h1:gZWDp/Ze/IJXGXf23ltt2EXimqmTUXEy0GFuRQyBid4=
-github.com/pjbgf/sha1cd v0.3.2 h1:a9wb0bp1oC2TGwStyn0Umc/IGKQnEgF0vVaZ8QF8eo4=
-github.com/pjbgf/sha1cd v0.3.2/go.mod h1:zQWigSxVmsHEZow5qaLtPYxpcKMMQpa09ixqBxuCS6A=
+github.com/pjbgf/sha1cd v0.6.0 h1:3WJ8Wz8gvDz29quX1OcEmkAlUg9diU4GxJHqs0/XiwU=
+github.com/pjbgf/sha1cd v0.6.0/go.mod h1:lhpGlyHLpQZoxMv8HcgXvZEhcGs0PG/vsZnEJ7H0iCM=
 github.com/pkg/browser v0.0.0-20201207095918-0426ae3fba23/go.mod h1:N6UoU20jOqggOuDwUaBQpluzLNDqif3kq9z2wpdYEfQ=
 github.com/pkg/browser v0.0.0-20240102092130-5ac0b6a4141c h1:+mdjkGKdHQG3305AYmdv1U2eRNDiU2ErMBj1gwrq8eQ=
 github.com/pkg/browser v0.0.0-20240102092130-5ac0b6a4141c/go.mod h1:7rwL4CYBLnjLxUqIJNnCWiEdr3bn6IUYi15bNlnbCCU=
@@ -1818,8 +1820,8 @@ go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0 h1:F7Jx+6h
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0/go.mod h1:UHB22Z8QsdRDrnAtX4PntOl36ajSxcdUMt1sF7Y6E7Q=
 go.opentelemetry.io/otel v1.32.0/go.mod h1:00DCVSB0RQcnzlwyTfqtxSm+DRr9hpYrHjNGiBHVQIg=
 go.opentelemetry.io/otel v1.36.0/go.mod h1:/TcFMXYjyRNh8khOAO9ybYkqaDBb/70a
```

---

### Incident Patch 15: `28a18989` (2026-05-18)
**Commit Message**: fix: surface v2 upgrade notice in v0.10 update check (DEV-250) (#3572)

Point getLatestGitHubVersion at the new infracost/cli releases endpoint so
v0.10 users finally see the v2 release in the end-of-run notice. Detect
brew (now on linux too) and chocolatey installs so the upgrade hint
matches the package manager that owns the binary, with a special-case
message for the legacy `infracost` choco package that points users at
`infracost1` if they want to stay on the v0.10 series.

**File**: `internal/update/update.go` (modified, +189/-19)
```diff
@@ -3,6 +3,7 @@ package update
 import (
 	"bytes"
 	"encoding/json"
+	"encoding/xml"
 	"fmt"
 	"io"
 	"net/http"
@@ -26,6 +27,25 @@ type Info struct {
 	Cmd           string
 }
 
+// installMethod identifies how the running binary was installed. The CLI
+// has moved to github.com/infracost/cli for v2+, so the suggested upgrade
+// command depends on which package manager (if any) owns the binary.
+type installMethodKind int
+
+const (
+	installMethodUnknown installMethodKind = iota
+	installMethodBrew
+	installMethodChocolatey
+)
+
+// installMethod carries the detection result. ChocoPkg distinguishes the
+// three Chocolatey packages we publish ("infracost", "infracost1",
+// "infracost2") so the upgrade hint matches what choco actually expects.
+type installMethod struct {
+	Kind     installMethodKind
+	ChocoPkg string
+}
+
 func CheckForUpdate(ctx *config.RunContext) (*Info, error) {
 	if skipUpdateCheck(ctx) {
 		return nil, nil
@@ -42,28 +62,18 @@ func CheckForUpdate(ctx *config.RunContext) (*Info, error) {
 		return nil, nil
 	}
 
-	isBrew, err := isBrewInstall()
-	if err != nil {
-		// don't fail if we can't detect brew, just fallback to other update method
-		logging.Logger.Debug().Msgf("error checking if executable was installed via brew: %v", err)
-	}
-
-	var cmd string
-	if isBrew {
-		cmd = "$ brew upgrade infracost"
-	} else {
-		cmd = "Go to https://www.infracost.io/docs/update for instructions"
-		if runtime.GOOS == "linux" || runtime.GOOS == "darwin" {
-			cmd = "$ curl -fsSL https://raw.githubusercontent.com/infracost/infracost/master/scripts/install.sh | sh"
-		}
-	}
+	method := detectInstallMethod()
+	cmd := upgradeCommand(method)
 
 	// Get the latest version
 	latestVersion := cachedLatestVersion
 	if latestVersion == "" {
-		if isBrew {
+		switch method.Kind {
+		case installMethodBrew:
 			latestVersion, err = getLatestBrewVersion()
-		} else {
+		case installMethodChocolatey:
+			latestVersion, err = getLatestChocolateyVersion(method.ChocoPkg)
+		default:
 			latestVersion, err = getLatestGitHubVersion()
 		}
 		if err != nil {
@@ -94,7 +104,7 @@ func skipUpdateCheck(ctx *config.RunContext) bool {
 }
 
 func isBrewInstall() (bool, error) {
-	if runtime.GOOS != "darwin" {
+	if runtime.GOOS != "darwin" && runtime.GOOS != "linux" {
 		return false, nil
 	}
 
@@ -170,7 +180,9 @@ func getLatestGitHubVersion() (string, error) {
 		TagName string `json:"tag_name"`
 	}
 
-	resp, err := http.Get("https://api.github.com/repos/infracost/infracost/releases/latest")
+	// Point at infracost/cli — the v2+ repo. This is the whole point of the
+	// v0.10 patch: surface v2 to users still running the legacy series.
+	resp, err := http.Get("https://api.github.com/repos/infracost/cli/releases/latest")
 	if err != nil {
 		return "", err
 	}
@@ -217,3 +229,161 @@ func setCachedLatestVersion(ctx *config.RunContext, latestVersion string) error
 
 	return ctx.State.Save()
 }
+
+// detectInstallMethod is overridable in tests. Detection is best-effort —
+// any error is swallowed and reported as unknown so a transient detection
+// hiccup never blocks the user's command.
+var detectInstallMethod = func() installMethod {
+	if isBrew, err := isBrewInstall(); err == nil && isBrew {
+		return installMethod{Kind: installMethodBrew}
+	} else if err != nil {
+		logging.Logger.Debug().Msgf("error checking brew install: %v", err)
+	}
+
+	if pkg := chocolateyPackage(); pkg != "" {
+		return installMethod{Kind: installMethodChocolatey, ChocoPkg: pkg}
+	}
+
+	return installMethod{Kind: installMethodUnknown}
+}
+
+// chocolateyPackage returns the choco package that owns the running binary
+// ("infracost", "infracost1", "infracost2"), or "" if the binary doesn't
+// live under the Chocolatey install root. Detection relies on os.Executable
+// resolving to <ChocolateyInstall>\lib\<pkg>\... — which is what happens
+// when chocolatey's shim launches the real binary.
+func chocolateyPackage() string {
+	if runtime.GOOS != "windows" {
+		return ""
+	}
+
+	exe, err := os.Executable()
+	if err != nil {
+		return ""
+	}
+	exe, err = filepath.EvalSymlinks(exe)
+	if err != nil {
+		return ""
+	}
+
+	root := os.Getenv("ChocolateyInstall")
+	if root == "" {
+		root = `C:\ProgramData\chocolatey`
+	}
+	root, err = filepath.EvalSymlinks(root)
+	if err != nil {
+		return ""
+	}
+
+	return chocolateyPackageFromPath(exe, root)
+}
+
+// chocolateyPackageFromPath is the pure-function half of choco detection so
+// it's testable without faking os.Executable() on non-Windows hosts. Both
+// inputs are compared case-insensitively because Windows filesystems are
+// case-insensitive in practice.
+func chocolateyPackageFromPath(exe, root string) string {
+	libPrefix := strings.ToLower(filepath.Join(root, "lib")) + string(filepath.Separator)
+	exeLower := strings.ToLower(exe)
+	if !strings.HasPrefix(exeLower, libPrefix) {
+		return ""
+	}
+
+	rel := exeLower[len(libPrefix):]
+	if i := strings.IndexRune(rel, filepath.Separator); i >= 0 {
+		rel =
```

**File**: `internal/update/update_test.go` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+package update
+
+import (
+	"path/filepath"
+	"strings"
+	"testing"
+)
+
+func TestChocolateyPackageFromPath(t *testing.T) {
+	root := filepath.Join("C:", "ProgramData", "chocolatey")
+
+	cases := []struct {
+		name string
+		exe  string
+		want string
+	}{
+		{
+			name: "infracost package",
+			exe:  filepath.Join(root, "lib", "infracost", "tools", "infracost.exe"),
+			want: "infracost",
+		},
+		{
+			name: "infracost1 package",
+			exe:  filepath.Join(root, "lib", "infracost1", "tools", "infracost.exe"),
+			want: "infracost1",
+		},
+		{
+			name: "infracost2 package",
+			exe:  filepath.Join(root, "lib", "infracost2", "tools", "infracost.exe"),
+			want: "infracost2",
+		},
+		{
+			name: "case insensitive",
+			exe:  filepath.Join("C:", "PROGRAMDATA", "Chocolatey", "Lib", "Infracost1", "tools", "infracost.exe"),
+			want: "infracost1",
+		},
+		{
+			name: "shim path (under bin, not lib) — not detected",
+			exe:  filepath.Join(root, "bin", "infracost.exe"),
+			want: "",
+		},
+		{
+			name: "binary outside choco — not detected",
+			exe:  filepath.Join("C:", "Users", "foo", "Downloads", "infracost.exe"),
+			want: "",
+		},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			if got := chocolateyPackageFromPath(tc.exe, root); got != tc.want {
+				t.Errorf("got %q, want %q", got, tc.want)
+			}
+		})
+	}
+}
+
+func TestUpgradeCommand(t *testing.T) {
+	cases := []struct {
+		name       string
+		method     installMethod
+		wantPrefix string
+		wantPin    bool
+	}{
+		{
+			name:       "brew",
+			method:     installMethod{Kind: installMethodBrew},
+			wantPrefix: "$ brew upgrade infracost",
+		},
+		{
+			name:       "choco infracost — includes pin hint",
+			method:     installMethod{Kind: installMethodChocolatey, ChocoPkg: "infracost"},
+			wantPrefix: "$ choco upgrade infracost",
+			wantPin:    true,
+		},
+		{
+			name:       "choco infracost1 — no pin hint",
+			method:     installMethod{Kind: installMethodChocolatey, ChocoPkg: "infracost1"},
+			wantPrefix: "$ choco upgrade infracost1",
+		},
+		{
+			name:       "choco infracost2 — no pin hint",
+			method:     installMethod{Kind: installMethodChocolatey, ChocoPkg: "infracost2"},
+			wantPrefix: "$ choco upgrade infracost2",
+		},
+		{
+			name:       "choco missing pkg — defaults to infracost",
+			method:     installMethod{Kind: installMethodChocolatey, ChocoPkg: ""},
+			wantPrefix: "$ choco upgrade infracost",
+			wantPin:    true,
+		},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			got := upgradeCommand(tc.method)
+			if !strings.HasPrefix(got, tc.wantPrefix) {
+				t.Errorf("got %q, want prefix %q", got, tc.wantPrefix)
+			}
+			hasPin := strings.Contains(got, "infracost1 package")
+			if hasPin != tc.wantPin {
+				t.Errorf("pin hint = %v, want %v (full cmd: %q)", hasPin, tc.wantPin, got)
+			}
+		})
+	}
+}
+
+func TestParseChocolateyFeed(t *testing.T) {
+	v, err := parseChocolateyFeed([]byte(`<?xml version="1.0" encoding="utf-8"?>
+<feed>
+  <entry>
+    <properties>
+      <Version>0.10.46</Version>
+    </properties>
+  </entry>
+</feed>`))
+	if err != nil {
+		t.Fatal(err)
+	}
+	if v != "v0.10.46" {
+		t.Errorf("got %q, want v0.10.46", v)
+	}
+
+	empty, err := parseChocolateyFeed([]byte(`<?xml version="1.0"?><feed></feed>`))
+	if err != nil {
+		t.Fatal(err)
+	}
+	if empty != "" {
+		t.Errorf("expected empty version for feed with no entries, got %q", empty)
+	}
+}
+
+func TestChocolateyFeedURL(t *testing.T) {
+	for _, pkg := range []string{"infracost", "infracost1", "infracost2"} {
+		url := chocolateyFeedURL(pkg)
+		want := "%27" + pkg + "%27"
+		if !strings.Contains(url, want) {
+			t.Errorf("for pkg=%q, expected URL to contain %q, got %s", pkg, want, url)
+		}
+		if !strings.Contains(url, "IsLatestVersion") {
+			t.Errorf("for pkg=%q, expected URL to filter IsLatestVersion, got %s", pkg, url)
+		}
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #3623** (2026-09-24): fix(deps): bump x/crypto and klauspost/compress for govulncheck (@aliscott)
- **PR #3622** (2026-09-24): fix(aws): exclude CloudWatch Omni from Logs Insights query pricing (@aliscott)
- **PR #3621** (2026-09-24): test(google): update golden files for preemptible price changes (@aliscott)
- **PR #3620** (2026-09-21): fix(azure): match renamed PostgreSQL Flexible Server storage price (@aliscott)
- **PR #3619** (2026-09-24): chore(deps): bump go.opentelemetry.io/otel/sdk from 1.44.0 to 1.45.0 (@dependabot[bot])
- **PR #3617** (closed): Mark azurerm_storage_account_queue_properties as a free resource (@srpomeroy)
- **PR #3615** (2026-09-09): fix(deps): bump golang.org/x/mod to v0.40.0 (@aliscott)
- **PR #3611** (2026-09-24): chore(deps): bump google.golang.org/grpc from 1.82.1 to 1.83.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

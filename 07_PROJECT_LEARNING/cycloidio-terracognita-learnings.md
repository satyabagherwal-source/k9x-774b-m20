# Forensic Learning Record (Deep Inspection): cycloidio/terracognita

> **Canonical Artifact**: `07_PROJECT_LEARNING/cycloidio-terracognita-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cycloidio/terracognita](https://github.com/cycloidio/terracognita))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:38:42.600Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cycloidio/terracognita`
- **Description**: Reads from existing public and private cloud providers (reverse Terraform) and generates your infrastructure as code on Terraform configuration
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2392 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `aws/cache.go`
```
package aws

import (
	"context"
	"strings"

	"github.com/cycloidio/terracognita/errcode"
	"github.com/cycloidio/terracognita/filter"
	"github.com/cycloidio/terracognita/provider"
	"github.com/pkg/errors"
)

func cacheAPIGatewayRestApis(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]provider.Resource, error) {

	rs, err := a.cache.Get(rt)
	if err != nil {
		if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
			return nil, errors.WithStack(err)
		}

		rs, err = apiGatewayRestApis(ctx, a, rt, filters)
		if err != nil {
			return nil, err
		}

		err = a.cache.Set(rt, rs)
		if err != nil {
			return nil, err
		}
	}

	return rs, nil
}

func getAPIGatewayRestApis(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]string, error) {
	rs, err := cacheAPIGatewayRestApis(ctx, a, rt, filters)
	if err != nil {
		return nil, err
	}

	// Get the actual needed value
	// TODO cach this result too
	ids := make([]string, 0, len(rs))
	for _, i := range rs {
		ids = append(ids, i.ID())
	}

	return ids, nil
}

func cacheLoadBalancersV2(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]provider.Resource, error) {
	// if both aws_alb and aws_lb defined, keep only aws_alb
	if filters.IsIncluded("aws_alb", "aws_lb") && (!filters.IsExcluded("aws_alb") && rt == "aws_lb") {
		return nil, nil
	}

	rs, err := a.cache.Get(rt)
	if err != nil {
		if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
			return nil, errors.WithStack(err)
		}

		rs, err = albs(ctx, a, rt, filters)
		if err != nil {
			return nil, err
		}

		err = a.cache.Set(rt, rs)
		if err != nil {
			return nil, err
		}
	}

	return rs, nil
}

func getLoadBalancersV2Arns(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]string, error) {
	rs, err := cacheLoadBalancersV2(ctx, a, rt, filters)
	if err != nil {
		return nil, err
	}

	// Get the actual needed value
	// TODO cach this result too
	names := make([]string, 0, len(rs))
	for _, i := range rs {
		names = append(names, i.ID())
	}

	return names, nil
}

func cacheLoadBalancersV2Listeners(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]provider.Resource, error) {
	// if both defined, keep only aws_alb_listener
	if filters.IsIncluded("aws_alb_listener", "aws_lb_listener") && (!filters.IsExcluded("aws_alb_listener") && rt == "aws_lb_listener") {
		return nil, nil
	}

	rs, err := a.cache.Get(rt)
	if err != nil {
		if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
			return nil, errors.WithStack(err)
		}

		rs, err = albListeners(ctx, a, rt, filters)
		if err != nil {
			return nil, err
		}

		err = a.cache.Set(rt, rs)
		if err != nil {
			return nil, err
		}
	}

	return rs, nil
}

func getLoadBalancersV2ListenersArns(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]string, error) {
	rs, err := cacheLoadBalancersV2Listeners(ctx, a, rt, filters)
	if err != nil {
		return nil, err
	}

	// Get the actual needed value
	// TODO cach this result too
	names := make([]string, 0, len(rs))
	for _, i := range rs {
		names = append(names, i.ID())
	}

	return names, nil
}

func cacheIAMGroups(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]provider.Resource, error) {
	rs, err := a.cache.Get(rt)
	if err != nil {
		if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
			return nil, errors.WithStack(err)
		}

		rs, err = iamGroups(ctx, a, rt, filters)
		if err != nil {
			return nil, err
		}

		err = a.cache.Set(rt, rs)
		if err != nil {
			return nil, err
		}
	}

	return rs, nil
}

func getIAMGroupNames(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]string, error) {
	rs, err := cacheIAMGroups(ctx, a, rt, filters)
	if err != nil {
		return nil, err
	}

	// Get the actual needed value
	// TODO cach this result too
	names := make([]string, 0, len(rs))
	for _, i := range rs {
		names = append(names, i.ID())
	}

	return names, nil
}

func cacheIAMRoles(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]provider.Resource, error) {
	rs, err := a.cache.Get(rt)
	if err != nil {
		if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
			return nil, errors.WithStack(err)
		}

		rs, err = iamRoles(ctx, a, rt, filters)
		if err != nil {
			return nil, err
		}

		err = a.cache.Set(rt, rs)
		if err != nil {
			return nil, err
		}
	}

	return rs, nil
}

func getIAMRoleNames(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]string, error) {
	rs, err := cacheIAMRoles(ctx, a, rt, filters)
	if err != nil {
		return nil, err
	}

	// Get the actual needed value
	// TODO cach this result too
	names := make([]string, 0, len(rs))
	for _, i := range rs {
		names = append(names, i.ID())
	}

	return names, nil
}

func cacheIAMUsers(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]provider.Resource, error) {
	rs, err := a.cache.Get(rt)
	if err != nil {
		if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
			return nil, errors.WithStack(err)
		}

		rs, err = iamUsers(ctx, a, rt, filters)
		if err != nil {
			return nil, err
		}

		err = a.cache.Set(rt, rs)
		if err != nil {
			return nil, err
		}
	}

	return rs, nil
}

func getIAMUserNames(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]string, error) {
	rs, err := cacheIAMUsers(ctx, a, rt, filters)
	if err != nil {
		return nil, err
	}

	// Get the actual needed value
	// TODO cach this result too
	names := make([]string, 0, len(rs))
	for _, i := range rs {
		names = append(names, i.ID())
	}

	return names, nil
}

func cacheRoute53Zones(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]provider.Resource, error) {
	rs, err := a.cache.Get(rt)
	if err != nil {
		if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
			return nil, errors.WithStack(err)
		}

		rs, err = route53Zones(ctx, a, rt, filters)
		if err != nil {
			return nil, err
		}

		err = a.cache.Set(rt, rs)
		if err != nil {
			return nil, err
		}
	}

	return rs, nil
}

func getRoute53ZoneIDs(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]string, error) {
	rs, err := cacheRoute53Zones(ctx, a, rt, filters)
	if err != nil {
		return nil, err
	}

	// Get the actual needed value
	// TODO cach this result too
	ids := make([]string, 0, len(rs))
	for _, i := range rs {
		ids = append(ids, i.ID())
	}

	return ids, nil
}

func cacheSESDomainIdentities(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]provider.Resource, error) {
	rs, err := a.cache.Get(rt)
	if err != nil {
		if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
			return nil, errors.WithStack(err)
		}

		rs, err = sesDomainIdentities(ctx, a, rt, filters)
		if err != nil {
			return nil, err
		}

		err = a.cache.Set(rt, rs)
		if err != nil {
			return nil, err
		}
	}

	return rs, nil
}

func getSESDomainIdentityDomains(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]string, error) {
	rs, err := cacheSESDomainIdentities(ctx, a, rt, filters)
	if err != nil {
		return nil, err
	}

	// Get the actual needed value
	// TODO cach this result too
	domains := make([]string, 0, len(rs))
	for _, i := range rs {
		domains = append(domains, i.ID())
	}

	return domains, nil
}

func cacheECSClusters(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]provider.Resource, error) {
	rs, err := a.cache.Get(rt)
	if err != nil {
		if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
			return nil, errors.WithStack(err)
		}

		rs, err = ecsClusters(ctx, a, rt, filters)
		if err != nil {
			return nil, err
		}

		err = a.cache.Set(rt, rs)
		if err != nil {
			return nil, err
		}
	}

	return rs, nil
}

func getECSClustersNames(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]string, error) {
	rs, err := cacheECSClusters(ctx, a, rt, filters)
	if err != nil {
		return nil, err
	}

	names := make([]string, 0, len(rs))
	for _, i := range rs {
		names = append(names, i.ID())
	}

	return names, nil
}

func cacheGlueDatabases(ctx context.Context, a *a
```

### Core Architecture Module: `aws/cmd/functions.go`
```
package main

var (
	// functions is the list of fuctions that will be added
	// to the AWSReader with the corresponding implementation
	functions = []Function{
		// apigateway
		Function{
			FnName:                     "GetAPIGatewayDeployments",
			Entity:                     "Deployments",
			FnAttributeList:            "Items",
			SingularEntity:             "Deployment",
			Prefix:                     "Get",
			Service:                    "apigateway",
			FnPaginationAttribute:      "Position",
			FnInputPaginationAttribute: "Position",
			Documentation: `
			// GetAPIGatewayDeployments returns the Deployment Functions on the given input
			// Returned values are commented in the interface doc comment block.
			`,
		},
		Function{
			FnName:                     "GetAPIGatewayResources",
			Entity:                     "Resources",
			FnAttributeList:            "Items",
			SingularEntity:             "Resource",
			Prefix:                     "Get",
			Service:                    "apigateway",
			FnPaginationAttribute:      "Position",
			FnInputPaginationAttribute: "Position",
			Documentation: `
			// GetAPIGatewayResources returns the Resource Functions on the given input
			// Returned values are commented in the interface doc comment block.
			`,
		},
		Function{
			FnName:                     "GetAPIGatewayRestAPIs",
			Entity:                     "RestApis",
			FnAttributeList:            "Items",
			SingularEntity:             "RestApi",
			Prefix:                     "Get",
			Service:                    "apigateway",
			FnPaginationAttribute:      "Position",
			FnInputPaginationAttribute: "Position",
			Documentation: `
			// GetAPIGatewayRestAPIs returns the RestApi Functions on the given input
			// Returned values are commented in the interface doc comment block.
			`,
		},
		Function{
			FnName:           "GetAPIGatewayStages",
			Entity:           "Stages",
			FnAttributeList:  "Item",
			SingularEntity:   "Stage",
			Prefix:           "Get",
			Service:          "apigateway",
			HasNotPagination: true,
			Documentation: `
			// GetAPIGatewayStages returns the Stage Functions on the given input
			// Returned values are commented in the interface doc comment block.
			`,
		},

		// Athena
		Function{
			FnName:          "GetAthenaWorkGroups",
			Entity:          "WorkGroups",
			FnAttributeList: "WorkGroups",
			SingularEntity:  "WorkGroupSummary",
			Prefix:          "List",
			Service:         "athena",
			Documentation: `
			// GetAthenaDataCatalogs returns the Athena worker groups on the given input
			// Returned values are commented in the interface doc comment block.
			`,
		},

		// autoscaling
		Function{
			Entity:         "AutoScalingGroups",
			SingularEntity: "Group",
			Prefix:         "Describe",
			Service:        "autoscaling",
			Documentation: `
			// GetAutoScalingGroups returns all AutoScalingGroup belonging to the Account ID based on the input given.
			// Returned values are commented in the interface doc comment block.
			`,
		},
		Function{
			Entity:  "LaunchConfigurations",
			Prefix:  "Describe",
			Service: "autoscaling",
			Documentation: `
			// GetLaunchConfigurations returns all LaunchConfiguration belonging to the Account ID based on the input given.
			// Returned values are commented in the interface doc comment block.
			`,
		},
		Function{
			FnName:          "GetAutoScalingPolicies",
			Entity:          "ScalingPolicies",
			FnServiceEntity: "Policies",
			Prefix:          "Describe",
			Service:         "autoscaling",
			Documentation: `
		  // GetAutoScalingPolicies returns all AutoScalingPolicies belonging to the Account ID based on the input given.
		  // Returned values are commented in the interface doc comment block.
		  `,
		},
		Function{
			FnName:          "GetAutoScalingScheduledActions",
			Entity:          "ScheduledActions",
			FnAttributeList: "ScheduledUpdateGroupActions",
			SingularEntity:  "ScheduledUpdateGroupAction",
			Prefix:          "Describe",
			Service:         "autoscaling",
			Documentation: `
		  // GetAutoScalingScheduledActions returns all ScheduledActions based on the input given.
		  // Returned values are commented in the interface doc comment block.
		  `,
		},

		// batch
		Function{
			FnName:          "GetBatchJobDefinitions",
			Entity:          "JobDefinitions",
			FnAttributeList: "JobDefinitions",
			SingularEntity:  "JobDefinition",
			Prefix:          "Describe",
			Service:         "batch",
			Documentation: `
			// GetBatchJobDefinitions returns the batch jobs on the given input
			// Returned values are commented in the interface doc comment block.
			`,
		},

		// cloudfront
		Function{
			FnName:                     "GetCloudFrontDistributions",
			Entity:                     "Distributions",
			Prefix:                     "List",
			Service:                    "cloudfront",
			SingularEntity:             "DistributionSummary",
			FnPaginationAttribute:      "DistributionList.NextMarker",
			FnInputPaginationAttribute: "Marker",
			FnAttributeList:            "DistributionList.Items",
			Documentation: `
			// GetCloudFrontDistributions returns all the CloudFront Distributions on the given input
			// Returned values are commented in the interface doc comment block.
			`,
		},
		Function{
			Entity:                     "CloudFrontOriginAccessIdentities",
			Prefix:                     "List",
			Service:                    "cloudfront",
			SingularEntity:             "OriginAccessIdentitySummary",
			FnAttributeList:            "CloudFrontOriginAccessIdentityList.Items",
			FnPaginationAttribute:      "CloudFrontOriginAccessIdentityList.NextMarker",
			FnInputPaginationAttribute: "Marker",
			Documentation: `
			// GetCloudFrontOriginAccessIdentities returns all the CloudFront Origin Access Identities on the given input
			// Returned values are commented in the interface doc comment block.
			`,
		},
		Function{
			FnName:                     "GetCloudFrontPublicKeys",
			Entity:                     "PublicKeys",
			SingularEntity:             "PublicKeySummary",
			FnAttributeList:            "PublicKeyList.Items",
			FnPaginationAttribute:      "PublicKeyList.NextMarker",
			FnInputPaginationAttribute: "Marker",
			Prefix:                     "List",
			Service:                    "cloudfront",
			Documentation: `
			// GetCloudFrontPublicKeys returns all the CloudFront Public Keys on the given input
			// Returned values are commented in the interface doc comment block.
			`,
		},

		// cloudwatch
		Function{
			Entity:          "MetricAlarms",
			FnServiceEntity: "Alarms",
			Prefix:          "Describe",
			Service:         "cloudwatch",
			Documentation: `
			// GetMetricAlarms returns all cloudwatch alarms based on the input given.
			// Returned values are commented in the interface doc comment block.
			`,
		},

		// configservice
		Function{
			FnName:          "GetRecordedResourceCounts",
			Entity:          "DiscoveredResourceCounts",
			SingularEntity:  "ResourceCount",
			FnAttributeList: "ResourceCounts",
			Prefix:          "Get",
			Service:         "configservice",
			Documentation: `
			// GetRecordedResourceCounts returns counts of the AWS resources which have
			// been recorded by AWS Config.
			// See https://docs.aws.amazon.com/config/latest/APIReference/API_GetDiscoveredResourceCounts.html
			// for more information about what to enable in your AWS account, the list of
			// supported resources, etc.
			`,
		},

		// dax
		Function{
			FnName:          "GetDAXClusters",
			Entity:          "Clusters",
			FnAttributeList: "Clusters",
			SingularEntity:  "Cluster",
			Prefix:          "Describe",
			Service:         "dax",
			Documentation: `
			// GetDAXClusters returns the DAX clusters on the given input
			// Returned values are commented in the interface doc comment block.
			`,
		},

		// directconnect / dx
		Function{
			FnName:          "GetDirectConnectGateways",
			Entity:          "DirectConnectGateways",
	
```

### Core Architecture Module: `aws/cmd/main.go`
```
package main

import (
	"bytes"
	"errors"
	"flag"
	"io"
	"os"
	"os/exec"
)

var (
	output string
)

func init() {
	flag.StringVar(&output, "output", "", "The output file of the generated code")
}

func main() {
	flag.Parse()

	if output == "" {
		panic("The 'output' is required")
	}

	f, err := os.OpenFile(output, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		panic(err)
	}
	defer f.Close()

	err = generate(f, functions)
	if err != nil {
		panic(err)
	}
}

func generate(opt io.Writer, fns []Function) error {
	var fnBuff = bytes.Buffer{}

	// Adds the package definition
	err := pkgTmpl.Execute(&fnBuff, nil)
	if err != nil {
		return err
	}

	// Adds the AWSReader interface
	err = awsReaderTmpl.Execute(&fnBuff, fns)
	if err != nil {
		return err
	}

	// Adds the implementation of the functions
	for _, fn := range fns {
		err = fn.Execute(&fnBuff)
		if err != nil {
			return err
		}
	}

	stderr := &bytes.Buffer{}

	// Formats the output using goimports
	cmd := exec.Command("goimports")
	cmd.Stdin = &fnBuff
	cmd.Stdout = opt
	cmd.Stderr = stderr

	err = cmd.Run()
	if err != nil {
		return err
	}

	if serr := stderr.String(); serr != "" {
		return errors.New(serr)
	}

	return nil
}

```

### Core Architecture Module: `aws/cmd/template.go`
```
package main

import (
	"fmt"
	"html/template"
	"io"
	"strings"

	"github.com/jinzhu/inflection"
	"github.com/pkg/errors"
)

const (
	// packageTmpl it's the package definition
	packageTmpl = `
	package reader

	// Code generated by github.com/cycloidio/terracognita/aws/cmd; DO NOT EDIT
	`

	// arTmpl it's the Reader interface template definition
	arTmpl = `
	// Reader is the interface defining all methods that need to be implemented
	//
	// The next behavior commented in the below paragraph, applies to every method
	// which clearly match what's explained, for the sake of not repeating the same,
	// over and over.
	// The most of the methods defined by this interface, return their results in a
	// map. Those maps, have as keys, the AWS region which have been requested and
	// the values are the items returned by AWS for such region.
	// Because the methods may make calls to different regions, in case that there
	// is an error on a region, the returned map won't have any entry for such
	// region and such errors will be reported by the returned error, nonetheless
	// the items, got from the successful requests to other regions, will be
	// returned, with the meaning that the methods will return partial results, in
	// case of errors.
	// For avoiding by the callers the problem of if the returned map may be nil,
	// the function will always return a map instance, which will be of length 0
	// in case that there is not any successful request.
	type Reader interface {
		// GetAccountID returns the current ID for the account used
		GetAccountID() string

		// GetRegion returns the currently used region for the Connector
		GetRegion() string

		{{ range . }}
			{{ .Documentation -}}
			{{ .Signature }}
		{{ end }}
	}
	`

	// functionTmpl it's the implementation of a function
	functionTmpl = `
		func (c *connector) {{ .Signature }} {
			{{ if ne .FilterByOwner ""}}
				if input == nil {
					input = &{{.Input}}{}
				}
				input.{{.FilterByOwner}} = append(input.{{.FilterByOwner}}, c.accountID)
			{{ end -}}

			if c.svc.{{.Service}} == nil {
				c.svc.{{.Service}} = {{.Service}}.New(c.svc.session)
			}

			{{ if .HasNoSlice }}
				var opt {{ .Output }}
			{{ else }}
				opt := make({{ .Output }}, 0)
			{{ end }}

			hasNextToken := true
			for hasNextToken {
				o, err := c.svc.{{.Service}}.{{.ServiceEntityFn}}WithContext(ctx, input)
				if err != nil {
					return nil, err
				}
				if o.{{ .RootAttribute }} == nil {
					hasNextToken = false
					continue
				}

				{{ if .HasNotPagination }}
					hasNextToken = false
				{{ else }}
					if input == nil {
						input = &{{.Input}}{}
					}
					input.{{.InputPaginationAttributeFn}} = o.{{.PaginationAttributeFn}}
					hasNextToken = o.{{.PaginationAttributeFn}} != nil
				{{ end }}

				{{ if .IsAttributeListSlice }}
					for _,v := range o.{{ index .AttributeList 0 }} {
						opt = append(opt, v.{{ index .AttributeList 1 }}...)
					}
				{{ else if .HasNoSlice }}
					opt = o.{{ index .AttributeList 0 }}
				{{ else if .IsMap }}
					opt = o.{{ index .AttributeList 0 }}
				{{ else }}
					opt = append(opt, o.{{ index .AttributeList 0 }}...)
				{{ end }}
			}

			return opt, nil
		}
	`
)

var (
	fnTmpl        *template.Template
	pkgTmpl       *template.Template
	awsReaderTmpl *template.Template
)

func init() {
	var err error

	fnTmpl, err = template.New("test").Parse(functionTmpl)
	if err != nil {
		panic(err)
	}

	pkgTmpl, err = template.New("test").Parse(packageTmpl)
	if err != nil {
		panic(err)
	}

	awsReaderTmpl, err = template.New("test").Parse(arTmpl)
	if err != nil {
		panic(err)
	}
}

// Function is the definition of one of the functions
type Function struct {
	// FnName is the name of the function
	// if not defined "Get{{.Entity}i" is used
	FnName string

	// Entity is the name of the entity, like
	// CloudFrontOriginAccessIdentities, Instances etc
	Entity string

	// FnAttributeList defines the attribute inside of the output
	// that holds all the resources to return
	// If defined like 'attribute.name' it'll call that directly
	// If defined like 'attribute#name' it'll iterate over 'attribute'
	// and 'name' will be used ad the list item to fetch
	FnAttributeList string

	// Some functions on AWS have the "Describe" prefix
	// or the "List" prefix, so it has to be specified
	// which one to use
	Prefix string

	// Service is the AWS service that it uses, basically the
	// pkg name, so "ec2", "cloudfront" etc
	Service string

	// FnServiceEntity is the name of the Entity function to use on the Service
	FnServiceEntity string

	// Documentation is the documentation that will be added
	// to the AWSReader function definition, as it's the
	// only public part that could be seen on the godocs
	Documentation string

	// Is the Output name that it has
	FnOutput string

	// FnSignature is the signture it has to be used on the Interface
	// AWSReader and the function implementation
	FnSignature string

	// NoGenerateFn avoids generating the function implementation as
	// it's to different from the templates we use
	// If true, it should be used with 'Signature' to add it to the
	// AWSReader and have the custom implementation outside of the
	// generated code
	NoGenerateFn bool

	// FilterByOwner adds the "{{.FilterByOwner}} = AccountID" to the input filter
	// so this value has to be the correct name on the input
	FilterByOwner string

	// HasNotPagination flags if the resource has NextToken logic or not
	HasNotPagination bool

	// HasNoSlice means that it's not an [] to return but a single item
	HasNoSlice bool

	// FnPaginationAttribute overrides the default name NextToken
	FnPaginationAttribute string

	// FnInputPaginationAttribute overrides the default reciever of the
	// pagination name FnPaginationAttribute
	FnInputPaginationAttribute string

	// SingularEntity represents the singular value of an entity
	SingularEntity string

	// If the value is a map
	IsMap bool
}

// Name builds a name simply using "Get{{.Entity}}"
// except if FnName is defined, in which case
// only FnName is used
func (f Function) Name() string {
	if f.FnName != "" {
		return f.FnName
	}

	prefix := "Get"
	if f.FilterByOwner != "" {
		prefix += "Own"
	}

	return fmt.Sprintf("%s%s", prefix, f.Entity)
}

// Output builds the output by "{{.Service}}.{{singular(.Entity)}}"
// except if FnOutput is defined in which case the formula
// "{{.FnOutput}}" is used
func (f Function) Output() string {
	var typePrefix = "[]*"
	if f.IsMap {
		typePrefix = "map[string]*"
	}
	if f.HasNoSlice {
		typePrefix = "*"
	}
	if f.FnOutput != "" {
		return fmt.Sprintf("%s%s", typePrefix, f.FnOutput)
	}

	if f.SingularEntity != "" {
		return fmt.Sprintf("%s%s.%s", typePrefix, f.Service, f.SingularEntity)
	}
	return fmt.Sprintf("%s%s.%s", typePrefix, f.Service, inflection.Singular(f.Entity))
}

// Input builds the input by "{{.Service}}.{{.Prefix}}{{.Entity}}"
func (f Function) Input() string {
	return fmt.Sprintf("%s.%sInput", f.Service, f.ServiceEntityFn())
}

// Signature builds the signature except if FnSignature it's defined,
// in which case is used
func (f Function) Signature() string {
	if f.FnSignature != "" {
		return f.FnSignature
	}

	return fmt.Sprintf("%s (ctx context.Context, input *%s) (%s, error)", f.Name(), f.Input(), f.Output())
}

// AttributeList returns all the list of attributes to access to get the value
// that we want, if it has the '#' it means it's inside of an array, if not
// its used as a simple access.
func (f Function) AttributeList() []string {
	if f.FnAttributeList != "" {
		if f.IsAttributeListSlice() {
			return strings.Split(f.FnAttributeList, "#")
		}
		return []string{f.FnAttributeList}
	}

	return []string{f.Entity}
}

// RootAttribute returns the first attribute of the
// FnAttributeList even if it is a List (#) or a
// method call (.)
func (f Function) RootAttribute() string {
	if f.FnAttributeList != "" {
		if f.IsAttributeListSlice() {
			return strings.Split(f.FnAttributeList, "#")[0]
		}
		retur
```

### Core Architecture Module: `aws/doc.go`
```
// Package aws provides the implementation of the Import from AWS
// with all the Resources supported and the cache for them
package aws

```

### Core Architecture Module: `aws/provider.go`
```
package aws

import (
	"context"
	"fmt"
	"regexp"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/cycloidio/terracognita/aws/reader"
	"github.com/cycloidio/terracognita/cache"
	"github.com/cycloidio/terracognita/errcode"
	"github.com/cycloidio/terracognita/filter"
	"github.com/cycloidio/terracognita/log"
	"github.com/cycloidio/terracognita/provider"
	"github.com/hashicorp/go-cty/cty"
	"github.com/hashicorp/go-cty/cty/gocty"
	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
	"github.com/hashicorp/terraform-provider-aws/conns"
	tfaws "github.com/hashicorp/terraform-provider-aws/provider"
	"github.com/pkg/errors"
)

// version of the Terraform provider, this is automatically changed with the 'make update-terraform-provider'
const version = "4.9.0"

// skippableCodes is a list of codes
// which won't make Terracognita failed
// but they will be printed on the output
// they are based on the err.Code() content
// of the AWS error
var skippableCodes = map[string]struct{}{
	"InvalidAction":         struct{}{},
	"AccessDeniedException": struct{}{},
	"RequestError":          struct{}{},
}

type aws struct {
	awsr reader.Reader

	tfAWSClient interface{}
	tfProvider  *schema.Provider

	configuration map[string]interface{}

	cache cache.Cache
}

// NewProvider returns an AWS Provider
func NewProvider(ctx context.Context, accessKey, secretKey, region, sessionToken string) (provider.Provider, error) {
	log.Get().Log("func", "reader.New", "msg", "configuring aws Reader")
	awsr, err := reader.New(ctx, accessKey, secretKey, region, sessionToken, nil)
	if err != nil {
		return nil, fmt.Errorf("could not initialize 'reader' because: %s", err)
	}

	cfg := conns.Config{
		AccessKey: accessKey,
		SecretKey: secretKey,
		Region:    region,
		Token:     sessionToken,
	}

	log.Get().Log("func", "aws.NewProvider", "msg", "configuring TF Client")
	awsClient, diags := cfg.Client(ctx)
	if diags.HasError() {
		var errdiags string
		for i := range diags {
			errdiags += fmt.Sprintf("%s: %s", diags[i].Summary, diags[i].Detail)
		}
		return nil, fmt.Errorf("could not initialize 'terraform/aws.Config.Client()' because: %s", errdiags)
	}

	tfp := tfaws.Provider()
	tfp.SetMeta(awsClient)

	return &aws{
		awsr:        awsr,
		tfAWSClient: awsClient,
		tfProvider:  tfp,
		cache:       cache.New(),
		configuration: map[string]interface{}{
			"region": region,
		},
	}, nil
}

func (a *aws) ResourceTypes() []string {
	return ResourceTypeStrings()
}

func (a *aws) Resources(ctx context.Context, t string, f *filter.Filter) ([]provider.Resource, error) {
	rt, err := ResourceTypeString(t)
	if err != nil {
		return nil, err
	}

	rfn, ok := resources[rt]
	if !ok {
		return nil, errors.Errorf("the resource %q it's not implemented", t)
	}

	resources, err := rfn(ctx, a, t, f)
	if err != nil {
		// we filter the error from AWS and return a custom error
		// type if it's an error that we want to skip
		if reqErr, ok := err.(awserr.Error); ok {
			if _, ok := skippableCodes[reqErr.Code()]; ok {
				return nil, fmt.Errorf("%w: %v", errcode.ErrProviderAPI, reqErr)
			}
		}
		return nil, errors.Wrapf(err, "error while reading from resource %q", t)
	}

	return resources, nil
}

func (a *aws) TFClient() interface{} {
	return a.tfAWSClient
}

func (a *aws) TFProvider() *schema.Provider {
	return a.tfProvider
}

func (a *aws) String() string { return "aws" }

func (a *aws) Region() string { return a.awsr.GetRegion() }
func (a *aws) TagKey() string { return "tags" }
func (a *aws) HasResourceType(t string) bool {
	_, err := ResourceTypeString(t)
	return err == nil
}
func (a *aws) Source() string                        { return "hashicorp/aws" }
func (a *aws) Version() string                       { return version }
func (a *aws) Configuration() map[string]interface{} { return a.configuration }
func (a *aws) FixResource(t string, v cty.Value) (cty.Value, error) {
	var err error
	switch t {
	case "aws_db_subnet_group":
		err = cty.Walk(v, func(path cty.Path, val cty.Value) (bool, error) {
			if len(path) > 0 {
				if gas, ok := path[0].(cty.GetAttrStep); ok {
					switch gas.Name {
					case "name":
						var sd string
						err := gocty.FromCtyValue(val, &sd)
						if err != nil {
							return false, errors.Wrapf(err, "failed to convert CTY value to GO type")
						}
						if sd == "default" {
							return false, fmt.Errorf("ignoring 'aws_db_subnet_group' with 'default' name as it's managed for AWS")
						}
					}
				}
			}
			return true, nil
		})
		if err != nil {
			return v, errors.Wrapf(err, "failed to fix resources")
		}
	case "aws_alb_listener_rule", "aws_lb_listener_rule":
		err = cty.Walk(v, func(path cty.Path, val cty.Value) (bool, error) {
			if len(path) > 0 {
				if gas, ok := path[0].(cty.GetAttrStep); ok {
					switch gas.Name {
					case "priority":
						var sp string
						err := gocty.FromCtyValue(val, &sp)
						if err != nil {
							return false, errors.Wrapf(err, "failed to convert CTY value to GO type")
						}
						if sp == "99999" {
							return false, fmt.Errorf("ignoring 'aws_alb_listener_rule' or 'aws_lb_listener_rule' with 'priority: 99999' name as it's managed for AWS")
						}
					}
				}
			}
			return true, nil
		})
		if err != nil {
			return v, errors.Wrapf(err, "failed to fix resources")
		}
	}
	return v, nil
}

var (
	autogeneratedAWSResourcesRe = regexp.MustCompile(`^aws:(?:autoscaling|cloudformation)`)
)

func (a *aws) FilterByTags(tags interface{}) error {
	ts, ok := tags.(map[string]interface{})
	if !ok {
		return nil
	}
	for k := range ts {
		if autogeneratedAWSResourcesRe.MatchString(k) {
			return errors.WithStack(errcode.ErrProviderResourceAutogenerated)
		}
	}
	return nil
}

```

### Core Architecture Module: `aws/reader/connector.go`
```
package reader

import (
	"context"
	"errors"
	"fmt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/apigateway/apigatewayiface"
	"github.com/aws/aws-sdk-go/service/athena/athenaiface"
	"github.com/aws/aws-sdk-go/service/autoscaling/autoscalingiface"
	"github.com/aws/aws-sdk-go/service/batch/batchiface"
	"github.com/aws/aws-sdk-go/service/cloudfront/cloudfrontiface"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/configservice/configserviceiface"
	"github.com/aws/aws-sdk-go/service/databasemigrationservice/databasemigrationserviceiface"
	"github.com/aws/aws-sdk-go/service/dax/daxiface"
	"github.com/aws/aws-sdk-go/service/directconnect/directconnectiface"
	"github.com/aws/aws-sdk-go/service/directoryservice/directoryserviceiface"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/ecs/ecsiface"
	"github.com/aws/aws-sdk-go/service/efs/efsiface"
	"github.com/aws/aws-sdk-go/service/eks/eksiface"
	"github.com/aws/aws-sdk-go/service/elasticache/elasticacheiface"
	"github.com/aws/aws-sdk-go/service/elasticbeanstalk/elasticbeanstalkiface"
	"github.com/aws/aws-sdk-go/service/elasticsearchservice/elasticsearchserviceiface"
	"github.com/aws/aws-sdk-go/service/elb/elbiface"
	"github.com/aws/aws-sdk-go/service/elbv2/elbv2iface"
	"github.com/aws/aws-sdk-go/service/emr/emriface"
	"github.com/aws/aws-sdk-go/service/fsx/fsxiface"
	"github.com/aws/aws-sdk-go/service/glue/glueiface"
	"github.com/aws/aws-sdk-go/service/iam/iamiface"
	"github.com/aws/aws-sdk-go/service/kinesis/kinesisiface"
	"github.com/aws/aws-sdk-go/service/lambda/lambdaiface"
	"github.com/aws/aws-sdk-go/service/lightsail/lightsailiface"
	"github.com/aws/aws-sdk-go/service/mediastore/mediastoreiface"
	"github.com/aws/aws-sdk-go/service/mq/mqiface"
	"github.com/aws/aws-sdk-go/service/neptune/neptuneiface"
	"github.com/aws/aws-sdk-go/service/rds/rdsiface"
	"github.com/aws/aws-sdk-go/service/redshift/redshiftiface"
	"github.com/aws/aws-sdk-go/service/route53/route53iface"
	"github.com/aws/aws-sdk-go/service/route53resolver/route53resolveriface"
	"github.com/aws/aws-sdk-go/service/s3/s3iface"
	"github.com/aws/aws-sdk-go/service/s3/s3manager/s3manageriface"
	"github.com/aws/aws-sdk-go/service/ses/sesiface"
	"github.com/aws/aws-sdk-go/service/sqs/sqsiface"
	"github.com/aws/aws-sdk-go/service/storagegateway/storagegatewayiface"
	"github.com/aws/aws-sdk-go/service/sts"
	"github.com/aws/aws-sdk-go/service/sts/stsiface"
)

//go:generate go run ../cmd/ -output reader.go

// New returns an object which also contains the accountID and the region to use.
//
// The accountID is helpful to return only the AMI or snapshots that belong to the account.
//
// # While the region has to be a valid AWS region
//
// An error is returned if any of the needed AWS request for creating the reader returns an AWS error, in such case it
// will have any of the common error codes (see below) or EmptyStaticCreds code or a go standard error in case that no
// regions are matched with the ones available, at the time, in AWS.
// See:
//   - https://docs.aws.amazon.com/AWSEC2/latest/APIReference/errors-overview.html#CommonErrors
//   - https://docs.aws.amazon.com/STS/latest/APIReference/CommonErrors.html
func New(ctx context.Context, accessKey, secretKey, region, sessionToken string, config *aws.Config) (Reader, error) {
	var c = connector{}

	creds, ec2s, sts, err := configureAWS(accessKey, secretKey, region, sessionToken)
	if err != nil {
		return nil, err
	}
	c.creds = creds
	if err := c.setAccountID(ctx, sts); err != nil {
		return nil, err
	}

	if err = c.setRegion(ctx, ec2s, region); err != nil {
		return nil, err
	}

	c.setService(config)

	return &c, nil
}

// The connector provides easy access to AWS SDK calls.
//
// By using it, calls can be made directly through multiple regions, and will filter only data that belongs to you.
// For example, when fetching the list of AMI, or snapshots.
//
// In order to start making calls, only calling New is required.
type connector struct {
	region    string
	svc       *serviceConnector
	creds     *credentials.Credentials
	accountID *string
}

func (c *connector) GetAccountID() string {
	return *c.accountID
}

func (c *connector) GetRegion() string {
	return c.region
}

type serviceConnector struct {
	apigateway               apigatewayiface.APIGatewayAPI
	athena                   athenaiface.AthenaAPI
	autoscaling              autoscalingiface.AutoScalingAPI
	batch                    batchiface.BatchAPI
	cloudfront               cloudfrontiface.CloudFrontAPI
	cloudwatch               cloudwatchiface.CloudWatchAPI
	configservice            configserviceiface.ConfigServiceAPI
	databasemigrationservice databasemigrationserviceiface.DatabaseMigrationServiceAPI
	dax                      daxiface.DAXAPI
	directconnect            directconnectiface.DirectConnectAPI
	directoryservice         directoryserviceiface.DirectoryServiceAPI
	dynamodb                 dynamodbiface.DynamoDBAPI
	ec2                      ec2iface.EC2API
	ecs                      ecsiface.ECSAPI
	efs                      efsiface.EFSAPI
	eks                      eksiface.EKSAPI
	elasticache              elasticacheiface.ElastiCacheAPI
	elasticbeanstalk         elasticbeanstalkiface.ElasticBeanstalkAPI
	elasticsearchservice     elasticsearchserviceiface.ElasticsearchServiceAPI
	elb                      elbiface.ELBAPI
	elbv2                    elbv2iface.ELBV2API
	emr                      emriface.EMRAPI
	fsx                      fsxiface.FSxAPI
	glue                     glueiface.GlueAPI
	iam                      iamiface.IAMAPI
	kinesis                  kinesisiface.KinesisAPI
	lambda                   lambdaiface.LambdaAPI
	lightsail                lightsailiface.LightsailAPI
	mediastore               mediastoreiface.MediaStoreAPI
	mq                       mqiface.MQAPI
	neptune                  neptuneiface.NeptuneAPI
	rds                      rdsiface.RDSAPI
	redshift                 redshiftiface.RedshiftAPI
	region                   string
	route53resolver          route53resolveriface.Route53ResolverAPI
	route53                  route53iface.Route53API
	s3downloader             s3manageriface.DownloaderAPI
	s3                       s3iface.S3API
	ses                      sesiface.SESAPI
	session                  *session.Session
	sqs                      sqsiface.SQSAPI
	storagegateway           storagegatewayiface.StorageGatewayAPI
}

/* The default region is only used to (1) get the list of region and
 * (2) get the account ID associated with the credentials.
 *
 * It is not used as a default region for services, therefore if no
 * region is specified when instantiating the connector, then it will
 * not try to establish any connections with AWS services.
 */
const defaultRegion string = "eu-west-1"

// configureAWS creates a new static credential with the passed accessKey and
// secretKey and with it, a sessions which is used to create a EC2 client and
// a Security Token Service client.
// The only AWS error code that this function return is
// * EmptyStaticCreds
func configureAWS(accessKey, secretKey, region, token string) (*credentials.Credentials, ec2iface.EC2API, stsiface.STSAPI, error) {
	if region == "" {
		region = defaultRegion
	}

	creds := credentials.NewStaticCredentials(accessKey, secretKey, token)
	_, err := creds.Get()
	if err != nil {
		return nil, nil, nil, err
	}
	sess := session.Must(
		session.NewSession(&aws.Config{
			Region:      aws.String(region),
			DisableSSL:  aws.Bool(false),
			MaxRetries:  aws.Int(3),
			Credentials: creds,
		}),
	)
	return creds, ec2.New(sess), sts.New(sess), nil
}

// setAccountID retrieves the caller ID from the Security Token Service and set
// it in the connector.
// An AWS e
```

### Core Architecture Module: `aws/reader/list_buckets.go`
```
package reader

import (
	"context"
	"errors"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/s3"
)

func (c *connector) ListBuckets(ctx context.Context, input *s3.ListBucketsInput) ([]*s3.Bucket, error) {
	var errs []error
	var ropt = &s3.ListBucketsOutput{}

	if c.svc.s3 == nil {
		c.svc.s3 = s3.New(c.svc.session)
	}

	opt, err := c.svc.s3.ListBucketsWithContext(ctx, input)
	if err != nil {
		return nil, err
	}

	newOpt := &s3.ListBucketsOutput{
		Owner:   opt.Owner,
		Buckets: make([]*s3.Bucket, 0),
	}
	for _, bucket := range opt.Buckets {
		inputLocation := &s3.GetBucketLocationInput{
			Bucket: bucket.Name,
		}
		result, err := c.svc.s3.GetBucketLocation(inputLocation)
		if err != nil {
			errs = append(errs, err)
		}
		if s3.NormalizeBucketLocation(aws.StringValue(result.LocationConstraint)) == c.svc.region {
			newOpt.Buckets = append(newOpt.Buckets, bucket)
		}
	}
	ropt = newOpt

	if len(errs) != 0 {
		serrs := make([]string, 0, len(errs))
		for _, e := range errs {
			serrs = append(serrs, e.Error())
		}
		return nil, errors.New(strings.Join(serrs, ","))
	}

	return ropt.Buckets, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #428** (2025-09-03): **[AWS] Adding Support**
  *Symptoms*:  - Resource added: aws_kinesis_firehose_delivery_stream  - Resource fixed: aws_cloudwatch_log_group  - tested locally with cloud2code. 

- **Issue #427** (2025-09-02): **remove google tf provider replace instruction from modules**
  *Symptoms*: Updated google tf dependency. Updated minimum go version to 1.24 Removed linter as golint is no longer supported and doesn't work anymore

- **Issue #425** (2025-05-21): **Feature/aws add new resource types**
  *Symptoms*: 

- **Issue #422** (2025-03-05): **[export] latest terraform-provider-aws**
  *Symptoms*: 

- **Issue #421** (2025-02-19): **[RDS Instance] Only read supported one for now**
  *Symptoms*: 

- **Issue #420** (2025-02-13): **Catch error and do nothing**
  *Symptoms*: 

- **Issue #406** (2024-01-24): **azurerm: Pass the BaseURI to all the endpoints**
  *Symptoms*: So different environments can be executed  Closes #405 

- **Issue #405** (2024-01-24): **AzureRM goverment environment**
  *Symptoms*: **General information:**  * Operating System:  * Terracognita version / tag: * Did you build Terracognita from sources or did you use the Docker image:   **Describe the bug:**  Make it work with the Goverment type environmet. Right now it does not work  **Log message**  Here you can paste the log message or paste the link to console logs. If the log message is too big, you can use a tool like https://pastebin.com/.  **Additional context**  Add any other context about the problem here.  

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

### Incident Patch 1: `2bb7d85a` (2023-06-22)
**Commit Message**: Merge pull request #394 from cycloidio/mp-fix-storage-account

azurerm: Add resource_group scope to azurerm_storage_account

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -7,7 +7,8 @@
 ### Fixed
 - The generated HCL now has the fixed version for the provider used instead of using the latest one by default
   ([Issue #378](https://github.com/cycloidio/terracognita/issues/378))
-
+- Add resource_group scope to azurerm_storage_account
+  ([Issue #393](https://github.com/cycloidio/terracognita/issues/393))
 
 ## [0.8.4] _2023-05-18_
 
```

**File**: `azurerm/cmd/generate.go` (modified, +1/-1)
```diff
@@ -225,7 +225,7 @@ var functions = []Function{
 	}},
 
 	// Storage Resources
-	{ResourceName: "Account", API: "storage", ResourceGroup: false},
+	{ResourceName: "Account", API: "storage", AzureSDKListFunction: "ListByResourceGroup", ResourceGroup: true},
 	{ResourceName: "ListContainerItem", PluralName: "BlobContainers", API: "storage", ResourceGroup: true, ExtraArgs: []Arg{
 		{
 			Name: "accountName",
```

**File**: `azurerm/reader_generated.go` (modified, +2/-2)
```diff
@@ -1150,12 +1150,12 @@ func (ar *AzureReader) ListKubernetesClusterNodes(ctx context.Context, managedCl
 
 }
 
-// ListSTORAGEAccounts returns a list of Accounts within a subscription
+// ListSTORAGEAccounts returns a list of Accounts within a subscription and a resource group
 func (ar *AzureReader) ListSTORAGEAccounts(ctx context.Context) ([]storage.Account, error) {
 	client := storage.NewAccountsClient(ar.config.SubscriptionID)
 	client.Authorizer = ar.authorizer
 
-	output, err := client.List(ctx)
+	output, err := client.ListByResourceGroup(ctx, ar.GetResourceGroupName())
 	if err != nil {
 		return nil, errors.Wrap(err, "unable to list storage.Account from Azure APIs")
 	}
```

---

### Incident Patch 2: `26b403ea` (2023-05-25)
**Commit Message**: azurerm: add azurerm_network_interface_security_group_association resource

**File**: `azurerm/resources.go` (modified, +51/-25)
```diff
@@ -35,6 +35,7 @@ const (
 	// Network Resources
 	Subnet
 	NetworkInterface
+	NetworkInterfaceSecurityGroupAssociation
 	NetworkSecurityGroup
 	ApplicationGateway
 	ApplicationSecurityGroup
@@ -203,31 +204,32 @@ var (
 		VirtualMachineDataDiskAttachment: virtualMachineDataDiskAttachments,
 		Image:                            images,
 		// Network Resources
-		Subnet:                            subnets,
-		NetworkInterface:                  networkInterfaces,
-		NetworkSecurityGroup:              networkSecurityGroups,
-		ApplicationGateway:                applicationGateways,
-		ApplicationSecurityGroup:          applicationSecurityGroups,
-		NetworkDdosProtectionPlan:         networkddosProtectionPlans,
-		Firewall:                          firewalls,
-		LocalNetworkGateway:               localNetworkGateways,
-		NatGateway:                        natGateways,
-		NetworkProfile:                    networkProfiles,
-		NetworkSecurityRule:               networkSecurityRules,
-		PublicIP:                          publicIP,
-		PublicIPPrefix:                    publicIPPrefixes,
-		Route:                             routes,
-		RouteTable:                        routeTables,
-		VirtualNetworkGateway:             virtualNetworkGateways,
-		VirtualNetworkGatewayConnection:   virtualNetworkGatewayConnections,
-		VirtualNetworkPeering:             virtualNetworkPeerings,
-		WebApplicationFirewallPolicy:      webApplicationFirewallPolicies,
-		VirtualHub:                        virtualHubs,
-		VirtualHubBgpConnection:           virtualHubBgpConnection,
-		VirtualHubConnection:              virtualHubConnection,
-		VirtualHubIP:                      virtualHubIP,
-		VirtualHubRouteTable:              virtualHubRouteTable,
-		VirtualHubSecurityPartnerProvider: virtualHubSecurityPartnerProvider,
+		Subnet:                                   subnets,
+		NetworkInterface:                         networkInterfaces,
+		NetworkInterfaceSecurityGroupAssociation: networkInterfaceSecurityGroupAssociations,
+		NetworkSecurityGroup:                     networkSecurityGroups,
+		ApplicationGateway:                       applicationGateways,
+		ApplicationSecurityGroup:                 applicationSecurityGroups,
+		NetworkDdosProtectionPlan:                networkddosProtectionPlans,
+		Firewall:                                 firewalls,
+		LocalNetworkGateway:                      localNetworkGateways,
+		NatGateway:                               natGateways,
+		NetworkProfile:                           networkProfiles,
+		NetworkSecurityRule:                      networkSecurityRules,
+		PublicIP:                                 publicIP,
+		PublicIPPrefix:                           publicIPPrefixes,
+		Route:                                    routes,
+		RouteTable:                               routeTables,
+		VirtualNetworkGateway:                    virtualNetworkGateways,
+		VirtualNetworkGatewayConnection:          virtualNetworkGatewayConnections,
+		VirtualNetworkPeering:                    virtualNetworkPeerings,
+		WebApplicationFirewallPolicy:             webApplicationFirewallPolicies,
+		VirtualHub:                               virtualHubs,
+		VirtualHubBgpConnection:                  virtualHubBgpConnection,
+		VirtualHubConnection:                     virtualHubConnection,
+		VirtualHubIP:                             virtualHubIP,
+		VirtualHubRouteTable:                     virtualHubRouteTable,
+		VirtualHubSecurityPartnerProvider:        virtualHubSecurityPartnerProvider,
 		// Load Balancer
 		Lb:                   lbs,
 		LbBackendAddressPool: lbBackendAddressPools,
@@ -1097,6 +1099,30 @@ func virtualHubSecurityPartnerProvider(ctx context.Context, a *azurerm, ar *Azur
 	return resources, nil
 }
 
+func networkInterfaceSecurityGroupAssociations(ctx context.Context, a *azurerm, ar *AzureReader, resourceType string, filters *filter.Filter) ([]provider.Resource, error) {
+	networkInterfaces, err := ar.ListInterfaces(ctx)
+	//TODO 
```

**File**: `azurerm/resourcetype_enumer.go` (modified, +500/-496)
```diff
@@ -7,11 +7,11 @@ import (
 	"strings"
 )
 
-const _ResourceTypeName = "azurerm_resource_groupazurerm_availability_setazurerm_imageazurerm_managed_diskazurerm_virtual_machineazurerm_virtual_machine_data_disk_attachmentazurerm_virtual_machine_extensionazurerm_virtual_machine_scale_set_extensionazurerm_virtual_networkazurerm_linux_virtual_machineazurerm_linux_virtual_machine_scale_setazurerm_windows_virtual_machineazurerm_windows_virtual_machine_scale_setazurerm_subnetazurerm_network_interfaceazurerm_network_security_groupazurerm_application_gatewayazurerm_application_security_groupazurerm_network_ddos_protection_planazurerm_firewallazurerm_local_network_gatewayazurerm_nat_gatewayazurerm_network_profileazurerm_network_security_ruleazurerm_public_ipazurerm_public_ip_prefixazurerm_routeazurerm_route_tableazurerm_virtual_network_gatewayazurerm_virtual_network_gateway_connectionazurerm_virtual_network_peeringazurerm_web_application_firewall_policyazurerm_virtual_hubazurerm_virtual_hub_bgp_connectionazurerm_virtual_hub_connectionazurerm_virtual_hub_ipazurerm_virtual_hub_route_tableazurerm_virtual_hub_security_partner_providerazurerm_lbazurerm_lb_backend_address_poolazurerm_lb_ruleazurerm_lb_outbound_ruleazurerm_lb_nat_ruleazurerm_lb_nat_poolazurerm_lb_probeazurerm_virtual_desktop_host_poolazurerm_virtual_desktop_application_groupazurerm_logic_app_workflowazurerm_logic_app_trigger_customazurerm_logic_app_action_customazurerm_container_registryazurerm_container_registry_webhookazurerm_kubernetes_clusterazurerm_kubernetes_cluster_node_poolazurerm_storage_accountazurerm_storage_queueazurerm_storage_shareazurerm_storage_tableazurerm_storage_blobazurerm_mariadb_configurationazurerm_mariadb_databaseazurerm_mariadb_firewall_ruleazurerm_mariadb_serverazurerm_mariadb_virtual_network_ruleazurerm_mysql_configurationazurerm_mysql_databaseazurerm_mysql_firewall_ruleazurerm_mysql_serverazurerm_mysql_virtual_network_ruleazurerm_postgresql_configurationazurerm_postgresql_databaseazurerm_postgresql_firewall_ruleazurerm_postgresql_serverazurerm_postgresql_virtual_network_ruleazurerm_mssql_elasticpoolazurerm_mssql_databaseazurerm_mssql_firewall_ruleazurerm_mssql_serverazurerm_mssql_server_security_alert_policyazurerm_mssql_server_vulnerability_assessmentazurerm_mssql_virtual_machineazurerm_mssql_virtual_network_ruleazurerm_redis_cacheazurerm_redis_firewall_ruleazurerm_dns_zoneazurerm_dns_a_recordazurerm_dns_aaaa_recordazurerm_dns_caa_recordazurerm_dns_cname_recordazurerm_dns_mx_recordazurerm_dns_ns_recordazurerm_dns_ptr_recordazurerm_dns_srv_recordazurerm_dns_txt_recordazurerm_private_dns_zoneazurerm_private_dns_a_recordazurerm_private_dns_aaaa_recordazurerm_private_dns_cname_recordazurerm_private_dns_mx_recordazurerm_private_dns_ptr_recordazurerm_private_dns_srv_recordazurerm_private_dns_txt_recordazurerm_private_dns_zone_virtual_network_linkazurerm_policy_definitionazurerm_policy_remediationazurerm_policy_set_definitionazurerm_key_vaultazurerm_key_vault_access_policyazurerm_application_insightsazurerm_application_insights_api_keyazurerm_application_insights_analytics_itemazurerm_log_analytics_workspaceazurerm_log_analytics_linked_serviceazurerm_log_analytics_datasource_windows_performance_counterazurerm_log_analytics_datasource_windows_eventazurerm_monitor_action_groupazurerm_monitor_activity_log_alertazurerm_monitor_autoscale_settingazurerm_monitor_log_profileazurerm_monitor_metric_alertazurerm_windows_web_appazurerm_linux_web_appazurerm_linux_web_app_slotazurerm_windows_web_app_slotazurerm_web_app_active_slotazurerm_service_planazurerm_source_control_tokenazurerm_static_siteazurerm_static_site_custom_domainazurerm_web_app_hybrid_connectionazurerm_data_protection_backup_vaultazurerm_data_protection_backup_instance_diskazurerm_data_protection_backup_policy_diskazurerm_api_managementazurerm_recovery_services_vaultazurerm_backup_policy_vmazurerm_backup_protected_vmazurerm_backup_policy_vm_workload"
+const _ResourceTypeName = "azurerm_resource_groupazure
```

---

### Incident Patch 3: `aa607c09` (2023-04-24)
**Commit Message**: aws: Implement 'FixResource' to add logig for 'aws_db_subnet_group' (#381)

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -22,6 +22,8 @@
   ([Issue #337](https://github.com/cycloidio/terracognita/issues/337))
 - Cyclic dependencies between resources now it's fixed
   ([Issue #379](https://github.com/cycloidio/terracognita/issues/379))
+- `aws_db_subnet_group` that have `name: "default"` are now ignored as they are managed by AWS
+  ([Issue #376](https://github.com/cycloidio/terracognita/issues/376))
 
 ## [0.8.3] _2023-03-14_
 
```

**File**: `aws/provider.go` (modified, +31/-3)
```diff
@@ -13,6 +13,7 @@ import (
 	"github.com/cycloidio/terracognita/log"
 	"github.com/cycloidio/terracognita/provider"
 	"github.com/hashicorp/go-cty/cty"
+	"github.com/hashicorp/go-cty/cty/gocty"
 	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
 	"github.com/hashicorp/terraform-provider-aws/conns"
 	tfaws "github.com/hashicorp/terraform-provider-aws/provider"
@@ -126,9 +127,36 @@ func (a *aws) HasResourceType(t string) bool {
 	_, err := ResourceTypeString(t)
 	return err == nil
 }
-func (a *aws) Source() string                                       { return "hashicorp/aws" }
-func (a *aws) Configuration() map[string]interface{}                { return a.configuration }
-func (a *aws) FixResource(t string, v cty.Value) (cty.Value, error) { return v, nil }
+func (a *aws) Source() string                        { return "hashicorp/aws" }
+func (a *aws) Configuration() map[string]interface{} { return a.configuration }
+func (a *aws) FixResource(t string, v cty.Value) (cty.Value, error) {
+	var err error
+	switch t {
+	case "aws_db_subnet_group":
+		err = cty.Walk(v, func(path cty.Path, val cty.Value) (bool, error) {
+			if len(path) > 0 {
+				if gas, ok := path[0].(cty.GetAttrStep); ok {
+					switch gas.Name {
+					case "name":
+						var sd string
+						err := gocty.FromCtyValue(val, &sd)
+						if err != nil {
+							return false, errors.Wrapf(err, "failed to convert CTY value to GO type")
+						}
+						if sd == "default" {
+							return false, fmt.Errorf("ignoring 'aws_db_subnet_group' with 'default' name as it's managed for AWS")
+						}
+					}
+				}
+			}
+			return true, nil
+		})
+		if err != nil {
+			return v, errors.Wrapf(err, "failed to fix resources")
+		}
+	}
+	return v, nil
+}
 
 var (
 	autogeneratedAWSResourcesRe = regexp.MustCompile(`^aws:(?:autoscaling|cloudformation)`)
```

**File**: `provider/import.go` (modified, +1/-3)
```diff
@@ -121,12 +121,10 @@ func Import(ctx context.Context, p Provider, hcl, tfstate writer.Writer, f *filt
 			for _, r := range append([]Resource{re}, res...) {
 				err = util.RetryDefault(func() error { return r.Read(f) })
 				if err != nil {
-					cause := errors.Cause(err)
-
 					// Errors are ignored. If a resource is invalid we assume it can be skipped, it can be related to inconsistencies in deployed resources.
 					// So instead of failing and stopping execution we ignore them and continue (we log them if -v is specified)
 
-					logger.Log("error", cause)
+					logger.Log("error", err)
 
 					continue
 				}
```

---

### Incident Patch 4: `0e54c2e4` (2023-04-21)
**Commit Message**: hcl: Fixed Cyclic relations between different resources (#380)

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -20,6 +20,8 @@
 
 - Nested HCL Maps now are written correctly
   ([Issue #337](https://github.com/cycloidio/terracognita/issues/337))
+- Cyclic dependencies between resources now it's fixed
+  ([Issue #379](https://github.com/cycloidio/terracognita/issues/379))
 
 ## [0.8.3] _2023-03-14_
 
```

**File**: `hcl/writer.go` (modified, +8/-8)
```diff
@@ -540,13 +540,13 @@ func (w *Writer) Interpolate(i *interpolator.Interpolator) {
 		(w.opts.HasModule() && len(w.opts.ModuleVariables) == 0) {
 		return
 	}
+	// who's interpolated with who
+	relations := make(map[string]struct{}, 0)
 	for k, v := range w.Config {
 		if k == writer.ModuleCategoryKey || k == variablesCategoryKey || k == w.opts.TerraformCategoryKey {
 			continue
 		}
 		resources := v["resource"]
-		// who's interpolated with who
-		relations := make(map[string]struct{}, 0)
 		// we need to isolate each resource
 		// getting each resource is easier to avoid cycle
 		// or interpolation.
@@ -560,7 +560,7 @@ func (w *Writer) Interpolate(i *interpolator.Interpolator) {
 				dest := reflect.New(src.Type()).Elem()
 
 				// walk through the resources to interpolate the good values
-				w.walkInterpolation(dest, src, i, name, "", rt, &relations)
+				w.walkInterpolation(dest, src, i, name, "", rt, relations)
 
 				// remove reflect.Value wrapper from dest
 				resources.(map[string]map[string]interface{})[rt][name] = dest.Interface()
@@ -571,7 +571,7 @@ func (w *Writer) Interpolate(i *interpolator.Interpolator) {
 
 // walkInterpolation through a resource block. it's easier since we do not know how the block is made
 // `dest` will be the new "block" with the values interpolated from `interpolate`
-func (w *Writer) walkInterpolation(dest, src reflect.Value, interpolate *interpolator.Interpolator, name, key string, resourceType string, relations *map[string]struct{}) {
+func (w *Writer) walkInterpolation(dest, src reflect.Value, interpolate *interpolator.Interpolator, name, key string, resourceType string, relations map[string]struct{}) {
 	switch src.Kind() {
 	// it's an interface, so we basically need
 	// to extract the elem and walk through it
@@ -630,7 +630,7 @@ func (w *Writer) walkInterpolation(dest, src reflect.Value, interpolate *interpo
 			if !(strings.Contains(interpolatedValue, name) || strings.Contains(interpolatedValue, resourceType) || isMutualInterpolation(target, source, relations)) {
 				dest.SetString(interpolatedValue)
 				// we store this new relationship
-				(*relations)[fmt.Sprintf("%s+%s", source, target)] = struct{}{}
+				relations[fmt.Sprintf("%s+%s", source, target)] = struct{}{}
 			} else {
 				dest.SetString(src.Interface().(string))
 			}
@@ -645,11 +645,11 @@ func (w *Writer) walkInterpolation(dest, src reflect.Value, interpolate *interpo
 // isMutualInterpolation will simply go through the list of relations to find out
 // if a relation is already present between the two resources in one direction
 // or the other
-func isMutualInterpolation(target, source string, relations *map[string]struct{}) bool {
-	if _, ok := (*relations)[fmt.Sprintf("%s+%s", source, target)]; ok {
+func isMutualInterpolation(target, source string, relations map[string]struct{}) bool {
+	if _, ok := relations[fmt.Sprintf("%s+%s", source, target)]; ok {
 		return true
 	}
-	if _, ok := (*relations)[fmt.Sprintf("%s+%s", target, source)]; ok {
+	if _, ok := relations[fmt.Sprintf("%s+%s", target, source)]; ok {
 		return true
 	}
 	return false
```

---

### Incident Patch 5: `46dc7ad8` (2023-03-13)
**Commit Message**: azurerm: Fixed the format for 'azurerm_network_security_group.security_rule.protocol' (#357)

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 ## [Unreleased]
 
+### Fixed
+
+- Azurerm `azurerm_network_security_group.security_rule.protocol` now has the right format
+  ([PR #357](https://github.com/cycloidio/terracognita/pull/357))
+
 ## [0.8.2] _2023-03-07_
 
 ### Added
```

**File**: `azurerm/provider.go` (modified, +26/-0)
```diff
@@ -12,6 +12,8 @@ import (
 	"github.com/hashicorp/terraform-plugin-sdk/v2/terraform"
 	tfazurerm "github.com/hashicorp/terraform-provider-azurerm/provider"
 	"github.com/pkg/errors"
+	"golang.org/x/text/cases"
+	"golang.org/x/text/language"
 
 	"github.com/cycloidio/terracognita/cache"
 	"github.com/cycloidio/terracognita/errcode"
@@ -287,6 +289,30 @@ func (a *azurerm) FixResource(t string, v cty.Value) (cty.Value, error) {
 			}
 			return v, nil
 		})
+	case "azurerm_network_security_group":
+		v, err = cty.Transform(v, func(path cty.Path, v cty.Value) (cty.Value, error) {
+			if len(path) > 0 {
+				if gas, ok := path[0].(cty.GetAttrStep); ok {
+					switch gas.Name {
+					case "security_rule":
+						if len(path) < 3 {
+							return v, nil
+						}
+						switch path[2].(cty.GetAttrStep).Name {
+						case "protocol":
+							// For some reason the Protocol is set like: TCP, but the valid value is Tcp
+							var sp string
+							err := gocty.FromCtyValue(v, &sp)
+							if err != nil {
+								return v, errors.Wrapf(err, "failed to convert CTY value to GO type")
+							}
+							return cty.StringVal(cases.Title(language.English).String(strings.ToLower(sp))), nil
+						}
+					}
+				}
+			}
+			return v, nil
+		})
 		if err != nil {
 			return v, errors.Wrapf(err, "failed to convert CTY value to GO type")
 		}
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -31,6 +31,7 @@ require (
 	github.com/stretchr/testify v1.7.0
 	github.com/vmware/govmomi v0.28.0
 	github.com/zclconf/go-cty v1.10.0
+	golang.org/x/text v0.7.0
 	google.golang.org/api v0.61.0
 	google.golang.org/grpc v1.45.0
 	gopkg.in/yaml.v2 v2.4.0
@@ -167,7 +168,6 @@ require (
 	golang.org/x/net v0.7.0 // indirect
 	golang.org/x/oauth2 v0.0.0-20211104180415-d3ed0bb246c8 // indirect
 	golang.org/x/sys v0.5.0 // indirect
-	golang.org/x/text v0.7.0 // indirect
 	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f // indirect
 	google.golang.org/appengine v1.6.7 // indirect
 	google.golang.org/genproto v0.0.0-20211118181313-81c1377c94b1 // indirect
```

---

### Incident Patch 6: `25ae80de` (2023-03-02)
**Commit Message**: azurerm: fix #352 admin_password

The value can't be retrieved. Terraform Azure provider set
"ignored-as-imported" which is not a valid password.
In this case, set the default password wich respects Azure constraints

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -11,6 +11,8 @@
 
 ### Changed
 
+- Azure: Set a valide `admin_password` with `azurerm_windows_virtual_machine`
+  ([Issue #352](https://github.com/cycloidio/terracognita/issues/352))
 - Azure: azure: do not define external disk with `azurerm_virtual_machine`
   ([PR #336](https://github.com/cycloidio/terracognita/pull/336))
 
```

**File**: `azurerm/provider.go` (modified, +11/-0)
```diff
@@ -177,6 +177,13 @@ func (a *azurerm) FixResource(t string, v cty.Value) (cty.Value, error) {
 			if len(path) == 3 {
 				if gas, ok := path[0].(cty.GetAttrStep); ok {
 					switch gas.Name {
+					case "os_profile":
+						switch path[2].(cty.GetAttrStep).Name {
+						case "admin_password":
+							// The value can't be retrieved. Terraform Azure provider set "ignored-as-imported" which is not a valid password.
+							// In this case, set the default password which respects Azure constraints
+							return cty.StringVal("Ignored-as-!mport3d"), nil
+						}
 					case "storage_os_disk":
 						var idx int
 						err := gocty.FromCtyValue(path[1].(cty.IndexStep).Key, &idx)
@@ -249,6 +256,10 @@ func (a *azurerm) FixResource(t string, v cty.Value) (cty.Value, error) {
 			if len(path) > 0 {
 				if gas, ok := path[0].(cty.GetAttrStep); ok {
 					switch gas.Name {
+					case "admin_password":
+						// The value can't be retrieved. Terraform Azure provider set "ignored-as-imported" which is not a valid password.
+						// In this case, set the default password which respects Azure constraints
+						return cty.StringVal("Ignored-as-!mport3d"), nil
 					case "platform_fault_domain":
 						// By default this attribute is set, but this is not a valid value with terraform apply.
 						// In this case, we shouldn't write platform_fault_domain.
```

---

### Incident Patch 7: `66050ae4` (2023-02-23)
**Commit Message**: hcl: Fixed issue with ModuleVariables and blocks

A block that could be defined multiple times was never working with ModuleVariables due
to the index position beeing on the key

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -20,6 +20,8 @@
   ([Issue #341](https://github.com/cycloidio/terracognita/issues/341))
 - Added a new Provider function to let the Provider fix resources content before writing it and fixed some AzureRM resources with it
   ([Issue #322](https://github.com/cycloidio/terracognita/issues/322))
+- ModueleVariables now works with nested fields of array blocks
+  ([Issue #344](https://github.com/cycloidio/terracognita/issues/344))
 
 ## [0.8.1] _2022-08-10_
 
```

**File**: `hcl/writer.go` (modified, +12/-1)
```diff
@@ -412,6 +412,10 @@ func walkVariables(cfg map[string]interface{}, validVariables map[string]struct{
 	return cfg
 }
 
+var (
+	reIndexKey = regexp.MustCompile(`\.[\d]+\.`)
+)
+
 // hasKey will validate that the key is present on the map.
 // The key will have the format: aws_instance.front.attr1.attr2...
 // and the validVariables will not have the `front` interpolation, also
@@ -422,8 +426,15 @@ func hasKey(validVariables map[string]struct{}, key string) bool {
 	}
 
 	sk := strings.Split(key, ".")
+	// This remove the 'front' from 'aws_instance.front.attr1'
 	k := append(sk[0:1], sk[2:]...)
-	_, ok := validVariables[strings.Join(k, ".")]
+
+	// If the key comes from an array it'll have the position on it
+	// so it'll look something like `aws_instance.ebs_block_device.1.volume_size`
+	// but the variable was defined as `aw_instance.ebs_block_device.volume_size`
+	// so we have to strip all the indices if any
+	nk := reIndexKey.ReplaceAllString(strings.Join(k, "."), ".")
+	_, ok := validVariables[nk]
 
 	return ok
 }
```

**File**: `hcl/writer_test.go` (modified, +40/-1)
```diff
@@ -518,6 +518,17 @@ variable "type_name_key" {
 			mx    = mxwriter.NewMux()
 			value = map[string]interface{}{
 				"key": "value",
+				"key3": map[string]interface{}{
+					"nested_key3": "nvalue3",
+				},
+				"key4": []interface{}{
+					map[string]interface{}{
+						"nested_key4": "nvalue4.0",
+					},
+					map[string]interface{}{
+						"nested_key4": "nvalue4.1",
+					},
+				},
 			}
 			value2 = map[string]interface{}{
 				"key":  "value",
@@ -526,6 +537,15 @@ variable "type_name_key" {
 			ehcl = `
 resource "type" "name" {
   key = var.type_name_key
+	key3 {
+		nested_key3 = var.type_name_key3_nested_key3
+	}
+	key4 {
+		nested_key4 = var.type_name_key4_0_nested_key4
+	}
+	key4 {
+		nested_key4 = var.type_name_key4_1_nested_key4
+	}
 }
 
 resource "type" "name2" {
@@ -537,6 +557,9 @@ module "test" {
   source = "./module-test"
 	type_name2_key = "value"
 	type_name_key = "value"
+	type_name_key3_nested_key3 = "nvalue3"
+	type_name_key4_0_nested_key4 = "nvalue4.0"
+	type_name_key4_1_nested_key4 = "nvalue4.1"
 }
 
 provider "aws" { }
@@ -557,6 +580,18 @@ variable "type_name2_key" {
 variable "type_name_key" {
 	default = "value"
 }
+
+variable "type_name_key3_nested_key3" {
+	default = "nvalue3"
+}
+
+variable "type_name_key4_0_nested_key4" {
+	default = "nvalue4.0"
+}
+
+variable "type_name_key4_1_nested_key4" {
+	default = "nvalue4.1"
+}
 `
 		)
 		p.EXPECT().String().Return("aws").Times(2)
@@ -566,7 +601,11 @@ variable "type_name_key" {
 			"region": "eu-west-1",
 		})
 
-		hw := hcl.NewWriter(mx, p, &writer.Options{Interpolate: true, HCLProviderBlock: true, Module: "test", ModuleVariables: map[string]struct{}{"type.key": struct{}{}}})
+		hw := hcl.NewWriter(mx, p, &writer.Options{Interpolate: true, HCLProviderBlock: true, Module: "test", ModuleVariables: map[string]struct{}{
+			"type.key":              struct{}{},
+			"type.key3.nested_key3": struct{}{},
+			"type.key4.nested_key4": struct{}{},
+		}})
 
 		err := hw.Write("type.name", value)
 		require.NoError(t, err)
```

---

### Incident Patch 8: `a03cfdba` (2023-02-16)
**Commit Message**: provider/provider: Added a new fucntion to fix resource from the provider

So we can fix some of the issues we are having with resources writting incoherent stuff, mostly because of the Provider
setting that info.

With it we also fixed some AzureRM resources that where having this issues

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -18,6 +18,8 @@
   ([Issue #322](https://github.com/cycloidio/terracognita/issues/322))
 - Remove duplicate names from the reader cache on AzureRM
   ([Issue #341](https://github.com/cycloidio/terracognita/issues/341))
+- Added a new Provider function to let the Provider fix resources content before writing it and fixed some AzureRM resources with it
+  ([Issue #322](https://github.com/cycloidio/terracognita/issues/322))
 
 ## [0.8.1] _2022-08-10_
 
```

**File**: `aws/provider.go` (modified, +4/-2)
```diff
@@ -11,6 +11,7 @@ import (
 	"github.com/cycloidio/terracognita/filter"
 	"github.com/cycloidio/terracognita/log"
 	"github.com/cycloidio/terracognita/provider"
+	"github.com/hashicorp/go-cty/cty"
 	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
 	"github.com/hashicorp/terraform-provider-aws/conns"
 	tfaws "github.com/hashicorp/terraform-provider-aws/provider"
@@ -124,5 +125,6 @@ func (a *aws) HasResourceType(t string) bool {
 	_, err := ResourceTypeString(t)
 	return err == nil
 }
-func (a *aws) Source() string                        { return "hashicorp/aws" }
-func (a *aws) Configuration() map[string]interface{} { return a.configuration }
+func (a *aws) Source() string                                       { return "hashicorp/aws" }
+func (a *aws) Configuration() map[string]interface{}                { return a.configuration }
+func (a *aws) FixResource(t string, v cty.Value) (cty.Value, error) { return v, nil }
```

**File**: `azurerm/provider.go` (modified, +151/-1)
```diff
@@ -3,8 +3,11 @@ package azurerm
 import (
 	"context"
 	"fmt"
+	"strings"
 
 	autorestAzure "github.com/Azure/go-autorest/autorest/azure"
+	"github.com/hashicorp/go-cty/cty"
+	"github.com/hashicorp/go-cty/cty/gocty"
 	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
 	"github.com/hashicorp/terraform-plugin-sdk/v2/terraform"
 	tfazurerm "github.com/hashicorp/terraform-provider-azurerm/provider"
@@ -74,7 +77,6 @@ func NewProvider(ctx context.Context, clientID, clientSecret, environment string
 		},
 	}, nil
 }
-
 func (a *azurerm) HasResourceType(t string) bool {
 	_, err := ResourceTypeString(t)
 	return err == nil
@@ -133,3 +135,151 @@ func (a *azurerm) TFClient() interface{} {
 func (a *azurerm) TFProvider() *schema.Provider {
 	return a.tfProvider
 }
+
+func (a *azurerm) FixResource(t string, v cty.Value) (cty.Value, error) {
+	var err error
+	switch t {
+	case "azurerm_virtual_machine":
+		// We should never set the managed_disk_id if create_option is FromImage
+		// the unsetManageDiskID is the list of all the indexed of the storage_account_type that
+		// have the create_option as FromImage
+		var unsetManageDiskID = make(map[int]struct{})
+		err = cty.Walk(v, func(path cty.Path, val cty.Value) (bool, error) {
+			if len(path) == 3 {
+				if gas, ok := path[0].(cty.GetAttrStep); ok {
+
+					switch gas.Name {
+					case "storage_os_disk":
+						if path[2].(cty.GetAttrStep).Name == "create_option" {
+							var co string
+							err := gocty.FromCtyValue(val, &co)
+							if err != nil {
+								return false, errors.Wrapf(err, "failed to convert CTY value to GO type")
+							}
+							if co == "FromImage" {
+								var idx int
+								err := gocty.FromCtyValue(path[1].(cty.IndexStep).Key, &idx)
+								if err != nil {
+									return false, errors.Wrapf(err, "failed to convert CTY value to GO type")
+								}
+								unsetManageDiskID[idx] = struct{}{}
+							}
+						}
+					}
+				}
+			}
+			return true, nil
+		})
+		if err != nil {
+			return v, errors.Wrapf(err, "failed to convert CTY value to GO type")
+		}
+		v, err = cty.Transform(v, func(path cty.Path, v cty.Value) (cty.Value, error) {
+			if len(path) == 3 {
+				if gas, ok := path[0].(cty.GetAttrStep); ok {
+					switch gas.Name {
+					case "storage_os_disk":
+						var idx int
+						err := gocty.FromCtyValue(path[1].(cty.IndexStep).Key, &idx)
+						if err != nil {
+							return v, errors.Wrapf(err, "failed to convert CTY value to GO type")
+						}
+						if _, ok := unsetManageDiskID[idx]; ok && path[2].(cty.GetAttrStep).Name == "managed_disk_id" {
+							return cty.NullVal(cty.String), nil
+						}
+					case "storage_data_disk":
+						switch path[2].(cty.GetAttrStep).Name {
+						case "managed_disk_id":
+							// Since we manage extra disk with the resource itself, id should never be set
+							return cty.NullVal(cty.String), nil
+						case "create_option":
+							// Since we manage extra disk with the resource itself, id should always be set to Empty
+							return cty.StringVal("Empty"), nil
+						}
+					}
+				}
+			}
+			return v, nil
+		})
+		if err != nil {
+			return v, errors.Wrapf(err, "failed to convert CTY value to GO type")
+		}
+	case "azurerm_managed_disk":
+		// Are set to default value which is good but only with type not UltraSSD or PremiumV2, else terraform will raise an error
+		var unsetDiskReadWrite bool
+		err = cty.Walk(v, func(path cty.Path, v cty.Value) (bool, error) {
+			if len(path) > 0 {
+				if gas, ok := path[0].(cty.GetAttrStep); ok {
+					switch gas.Name {
+					case "storage_account_type":
+						var sat string
+						err := gocty.FromCtyValue(v, &sat)
+						if err != nil {
+							return false, errors.Wrapf(err, "failed to convert CTY value to GO type")
+						}
+						if sat != "UltraSSD" && sat != "PremiumV2" {
+							unsetDiskReadWrite = true
+						}
+					}
+				}
+			}
+			return true, nil
+		})
+		if err != nil {
+			return cty.NullVal(cty.EmptyObject), errors.Wrapf(err, "failed
```

**File**: `azurerm/resources.go` (modified, +4/-4)
```diff
@@ -475,7 +475,7 @@ func disks(ctx context.Context, a *azurerm, ar *AzureReader, resourceType string
 
 		// When using azurerm_virtual_machine resource, extra attached disk are managed via storage_data_disk
 		// CreateOption == Empty : fully managed by
-		if disk.DiskProperties.DiskState == "Attached" && filters.IsIncluded("azurerm_virtual_machine") {
+		if (disk.DiskProperties.DiskState == "Attached" || disk.DiskProperties.DiskState == "Reserved") && filters.IsIncluded("azurerm_virtual_machine") {
 			continue
 		}
 		r := provider.NewResource(*disk.ID, resourceType, a)
@@ -506,7 +506,7 @@ func virtualMachineDataDiskAttachments(ctx context.Context, a *azurerm, ar *Azur
 
 	resources := make([]provider.Resource, 0)
 	for _, disk := range disks {
-		if disk.DiskProperties.DiskState == "Attached" {
+		if disk.DiskProperties.DiskState == "Attached" || disk.DiskProperties.DiskState == "Reserved" {
 			// check on wich VM the disk is attached
 			for _, virtualMachine := range virtualMachines {
 				if profile := virtualMachine.StorageProfile; profile != nil {
@@ -2098,8 +2098,8 @@ func applicationInsightsAnalyticsItems(ctx context.Context, a *azurerm, ar *Azur
 	return resources, nil
 }
 
-//issue import Error = 'json: cannot unmarshal array into Go value of type insights.WebTestListResult' JSON
-//follow-up at https://github.com/Azure/azure-rest-api-specs/issues/9463
+// issue import Error = 'json: cannot unmarshal array into Go value of type insights.WebTestListResult' JSON
+// follow-up at https://github.com/Azure/azure-rest-api-specs/issues/9463
 func applicationInsightsWebTests(ctx context.Context, a *azurerm, ar *AzureReader, resourceType string, filters *filter.Filter) ([]provider.Resource, error) {
 	insightsWebTests, err := ar.ListINSIGHTSWebTests(ctx)
 	if err != nil {
```

**File**: `go.sum` (modified, +0/-4)
```diff
@@ -307,10 +307,6 @@ github.com/cycloidio/terraform-provider-aws v1.60.1-0.20220513132327-e2dbdf90e53
 github.com/cycloidio/terraform-provider-aws v1.60.1-0.20220513132327-e2dbdf90e533/go.mod h1:GMgtgRkfOGOqGyAN7G4oBqD/iFvJOwvPeejv7JNcLpc=
 github.com/cycloidio/terraform-provider-azurerm v1.44.1-0.20220513132617-918497152827 h1:1T2XtaU/ht6ojv8vXD1azNNAJMJWvo7XujnqRq869sY=
 github.com/cycloidio/terraform-provider-azurerm v1.44.1-0.20220513132617-918497152827/go.mod h1:yAWZMAEgx+bUWhfOVBiymy/oxIbobZslFE8I0kjaeKE=
-github.com/cycloidio/tfdocs v0.0.0-20210903075122-31a804b31daf h1:bTxGdxb8uk0orMw726niNd3EYmnwuygtZZidDXZura8=
-github.com/cycloidio/tfdocs v0.0.0-20210903075122-31a804b31daf/go.mod h1:4zRiWOHuVkhb2vatajIFxV5g/AC4W7Zb/0pMF1G0yyA=
-github.com/cycloidio/tfdocs v0.0.0-20220809093344-d999d1c2069e h1:Dc9l5uHbyMzClz0jchr8W0oC6JDQgoRgPDQ/SGAlpIA=
-github.com/cycloidio/tfdocs v0.0.0-20220809093344-d999d1c2069e/go.mod h1:4zRiWOHuVkhb2vatajIFxV5g/AC4W7Zb/0pMF1G0yyA=
 github.com/cycloidio/tfdocs v0.0.0-20220809201117-e73e2388cfa8 h1:wlW3Y1iIdXzi5GQDrzXoVaoKBPi15d+qmJqPCHbs97E=
 github.com/cycloidio/tfdocs v0.0.0-20220809201117-e73e2388cfa8/go.mod h1:4zRiWOHuVkhb2vatajIFxV5g/AC4W7Zb/0pMF1G0yyA=
 github.com/daixiang0/gci v0.2.8/go.mod h1:+4dZ7TISfSmqfAGv59ePaHfNzgGtIkHAhhdKggP1JAc=
```

---

### Incident Patch 9: `063cb3c3` (2022-08-09)
**Commit Message**: mod: Update tfdocs to fix a bug

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 ## [Unreleased]
 
+### Fixed
+
+- Bug with tfdocs, updated it to the latest version
+  ([Issue #317](https://github.com/cycloidio/terracognita/pull/317))
+
 ## [0.8.0] _2022-08-09_
 
 ### Fixed
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ require (
 	github.com/aws/aws-sdk-go v1.43.34
 	github.com/chr4/pwgen v1.1.0
 	github.com/cycloidio/mxwriter v1.0.4
-	github.com/cycloidio/tfdocs v0.0.0-20220809093344-d999d1c2069e
+	github.com/cycloidio/tfdocs v0.0.0-20220809201117-e73e2388cfa8
 	github.com/gertd/go-pluralize v0.1.7
 	github.com/go-kit/kit v0.9.0
 	github.com/golang/mock v1.6.0
```

**File**: `go.sum` (modified, +2/-0)
```diff
@@ -311,6 +311,8 @@ github.com/cycloidio/tfdocs v0.0.0-20210903075122-31a804b31daf h1:bTxGdxb8uk0orM
 github.com/cycloidio/tfdocs v0.0.0-20210903075122-31a804b31daf/go.mod h1:4zRiWOHuVkhb2vatajIFxV5g/AC4W7Zb/0pMF1G0yyA=
 github.com/cycloidio/tfdocs v0.0.0-20220809093344-d999d1c2069e h1:Dc9l5uHbyMzClz0jchr8W0oC6JDQgoRgPDQ/SGAlpIA=
 github.com/cycloidio/tfdocs v0.0.0-20220809093344-d999d1c2069e/go.mod h1:4zRiWOHuVkhb2vatajIFxV5g/AC4W7Zb/0pMF1G0yyA=
+github.com/cycloidio/tfdocs v0.0.0-20220809201117-e73e2388cfa8 h1:wlW3Y1iIdXzi5GQDrzXoVaoKBPi15d+qmJqPCHbs97E=
+github.com/cycloidio/tfdocs v0.0.0-20220809201117-e73e2388cfa8/go.mod h1:4zRiWOHuVkhb2vatajIFxV5g/AC4W7Zb/0pMF1G0yyA=
 github.com/daixiang0/gci v0.2.8/go.mod h1:+4dZ7TISfSmqfAGv59ePaHfNzgGtIkHAhhdKggP1JAc=
 github.com/davecgh/go-spew v0.0.0-20161028175848-04cdfd42973b/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/davecgh/go-spew v1.1.0/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
```

---

### Incident Patch 10: `147cffb7` (2022-07-17)
**Commit Message**: fix: typo wich in root.go

**File**: `cmd/root.go` (modified, +1/-1)
```diff
@@ -317,7 +317,7 @@ func init() {
 	RootCmd.PersistentFlags().BoolP("verbose", "v", false, "Activate the verbose mode")
 	_ = viper.BindPFlag("verbose", RootCmd.PersistentFlags().Lookup("verbose"))
 
-	RootCmd.PersistentFlags().BoolP("debug", "d", false, "Activate the debug mode wich includes TF logs via TF_LOG=TRACE|DEBUG|INFO|WARN|ERROR configuration https://www.terraform.io/docs/internals/debugging.html")
+	RootCmd.PersistentFlags().BoolP("debug", "d", false, "Activate the debug mode which includes TF logs via TF_LOG=TRACE|DEBUG|INFO|WARN|ERROR configuration https://www.terraform.io/docs/internals/debugging.html")
 	_ = viper.BindPFlag("debug", RootCmd.PersistentFlags().Lookup("debug"))
 
 	RootCmd.PersistentFlags().String("log-file", path.Join(xdg.CacheHome, "terracognita", "terracognita.log"), "Write the logs with -v to this destination")
```

#### Recent Merged Pull Requests:
- **PR #428** (closed): [AWS] Adding Support (@Dhairya-Dudhatra)
- **PR #427** (2025-09-02): remove google tf provider replace instruction from modules (@kerak19)
- **PR #425** (closed): Feature/aws add new resource types (@sks)
- **PR #422** (closed): [export] latest terraform-provider-aws (@sks)
- **PR #421** (closed): [RDS Instance] Only read supported one for now (@sks)
- **PR #420** (closed): Catch error and do nothing (@vishwajeetk1160)
- **PR #406** (2024-01-24): azurerm: Pass the BaseURI to all the endpoints (@xescugc)
- **PR #394** (2023-06-22): azurerm: Add resource_group scope to azurerm_storage_account (@marcoldp)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

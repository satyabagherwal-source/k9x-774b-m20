# Forensic Learning Record (Deep Inspection): cycloidio/terracognita

> **Canonical Artifact**: `07_PROJECT_LEARNING/cycloidio-terracognita-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cycloidio/terracognita](https://github.com/cycloidio/terracognita))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:22:58.802Z  
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

### Core Architecture Module: `state/doc.go`
```
// Package state has all abstracted
// logic related to the Terraform state
package state

```

### Core Architecture Module: `state/writer.go`
```
package state

import (
	"fmt"
	"io"
	"regexp"
	"strings"

	"github.com/cycloidio/terracognita/errcode"
	"github.com/cycloidio/terracognita/interpolator"
	"github.com/cycloidio/terracognita/log"
	"github.com/cycloidio/terracognita/provider"
	"github.com/cycloidio/terracognita/util"
	"github.com/cycloidio/terracognita/writer"
	"github.com/hashicorp/terraform/addrs"
	"github.com/hashicorp/terraform/states"
	"github.com/hashicorp/terraform/states/statefile"
	"github.com/hashicorp/terraform/states/statemgr"
	"github.com/pkg/errors"
)

// used to match a TF resource ${aws_instance.my-instance.id}
var regexResource = regexp.MustCompile(`\${(.+)\.(.+)\.(.+)}`)

// Writer is a Writer implementation
// that is meant to generate a TFState
type Writer struct {
	Config map[string]provider.Resource
	writer io.Writer
	state  *states.SyncState
	opts   *writer.Options
}

// NewWriter returns a TFStateWriter initialization
func NewWriter(w io.Writer, opts *writer.Options) *Writer {
	return &Writer{
		Config: make(map[string]provider.Resource),
		writer: w,
		state:  states.NewState().SyncWrapper(),
		opts:   opts,
	}
}

// Write expects a key similar to "aws_instance.your_name" and
// the value to be *terraform.ResourceState repeated keys will report an error
func (w *Writer) Write(key string, value interface{}) error {
	if key == "" {
		return errcode.ErrWriterRequiredKey
	}

	if value == nil {
		return errcode.ErrWriterRequiredValue
	}

	if _, ok := w.Config[key]; ok {
		return errors.Wrapf(errcode.ErrWriterAlreadyExistsKey, "with key %q", key)
	}

	if len(strings.Split(key, ".")) != 2 {
		return errors.Wrapf(errcode.ErrWriterInvalidKey, "with key %q", key)
	}

	r, ok := value.(provider.Resource)
	if !ok {
		return errors.Wrapf(errcode.ErrWriterInvalidTypeValue, "expected provider.Resource, found %T", value)
	}

	var md []addrs.ModuleInstanceStep = nil
	if w.opts.HasModule() {
		md = []addrs.ModuleInstanceStep{
			addrs.ModuleInstanceStep{
				Name: w.opts.Module,
			},
		}
	}

	absAddr := addrs.AbsResourceInstance{
		Module: md,
		Resource: addrs.ResourceInstance{
			Resource: addrs.Resource{
				Mode: addrs.ManagedResourceMode,
				Type: r.Type(),
				Name: strings.Split(key, ".")[1],
			},
			Key: nil,
		},
	}

	absProviderConf := addrs.AbsProviderConfig{
		Module:   nil,
		Provider: addrs.NewDefaultProvider(r.Provider().String()),
	}

	zt, err := util.HashicorpToZclonfType(r.ImpliedType())
	if err != nil {
		return err
	}

	src, err := r.ResourceInstanceObject().Encode(zt, uint64(r.TFResource().SchemaVersion))
	if err != nil {
		return err
	}

	w.state.SetResourceInstanceCurrent(absAddr, src, absProviderConf)

	log.Get().Log("func", "state.Write(State)", "msg", "writing to internal config", "key", key, "content", r)
	w.Config[key] = r

	return nil
}

// Has checks if the given key it's already present or not
func (w *Writer) Has(key string) (bool, error) {
	_, ok := w.Config[key]
	return ok, nil
}

// Sync writes the content of the Config to the
// internal w with the correct format
func (w *Writer) Sync() error {

	lstate := w.state.Lock()
	defer w.state.Unlock()

	log.Get().Log("func", "state.Sync(State)", "msg", "writting state to state file")
	file := statemgr.NewStateFile()
	file.State = lstate

	err := statefile.Write(file, w.writer)
	if err != nil {
		return err
	}

	return nil
}

// Interpolate will defined dependencies for each component using
// the `i` Interpolator built in the import.
func (w *Writer) Interpolate(i *interpolator.Interpolator) {
	if !w.opts.Interpolate {
		return
	}
	// keep the existing relations in order to avoid cyclic
	// dependencies
	relations := make(map[string]struct{})

	// acquire the actual terraform.State
	lstate := w.state.Lock()
	defer w.state.Unlock()

	// loop over the whole state to write the dependencies
	// for resources having deps
	for _, module := range lstate.Modules {
		for name, resource := range module.Resources {
			// keep the existing dependencies in order to avoid
			// duplicated
			deps := make(map[string]struct{}, 0)
			// fetch the Terracognita resource representation
			// to access the attributes later
			res, ok := w.Config[name]
			if !ok {
				continue
			}
			for ak, av := range res.InstanceState().Attributes {
				// if we find any relevant link between the instance attribute and the interpolation map,
				// we flag a dependency
				if dependency, ok := i.Interpolate(ak, av); ok {
					rt, rn := extractResourceTypeAndName(dependency)
					rsc := fmt.Sprintf("%s.%s", rt, rn)
					// avoid mutual dependencies
					if rt == res.Type() || name == rsc || isMutualInterpolation(name, rsc, relations) {
						continue
					}
					// avoid adding the same dependency for a resource
					if _, ok := deps[rsc]; ok {
						continue
					}
					// save the resource as a dependency
					deps[rsc] = struct{}{}
				}
			}
			for _, instance := range resource.Instances {
				for dependency := range deps {
					// dependency is like google_compute_instance.instance-name
					s := strings.Split(dependency, ".")
					rt := s[0]
					rn := s[1]
					var md []string = nil
					if w.opts.HasModule() {
						md = []string{w.opts.Module}
					}
					instance.Current.Dependencies = append(instance.Current.Dependencies, addrs.ConfigResource{
						Module: md,
						Resource: addrs.Resource{
							Mode: addrs.ManagedResourceMode,
							Type: rt,
							Name: rn,
						},
					})
					// save the relationship
					relations[fmt.Sprintf("%s+%s", dependency, name)] = struct{}{}
				}
			}
		}
	}

}

// extractResourceTypeAndName will parse a TF variable to return
// the resource type and the name of the resource
func extractResourceTypeAndName(value string) (string, string) {
	match := regexResource.FindStringSubmatch(value)
	return match[1], match[2]
}

// isMutualInterpolation will simply go through the list of relations to find out
// if a relation is already present between the two resources in one direction
// or the other
func isMutualInterpolation(target, source string, relations map[string]struct{}) bool {
	if _, ok := relations[fmt.Sprintf("%s+%s", source, target)]; ok {
		return true
	}
	if _, ok := relations[fmt.Sprintf("%s+%s", target, source)]; ok {
		return true
	}
	return false
}

```

### Core Architecture Module: `util/cty.go`
```
package util

import (
	"encoding/json"

	hcty "github.com/hashicorp/go-cty/cty"
	hmsgpack "github.com/hashicorp/go-cty/cty/msgpack"
	zcty "github.com/zclconf/go-cty/cty"
	zmsgpack "github.com/zclconf/go-cty/cty/msgpack"
)

// HashicorpToZclonfType converts from Hashicoprt.Type to zclconf.Type
func HashicorpToZclonfType(ht hcty.Type) (zcty.Type, error) {
	tb, err := json.Marshal(ht)
	if err != nil {
		return zcty.EmptyObject, err
	}
	var ty zcty.Type
	err = json.Unmarshal(tb, &ty)
	if err != nil {
		return zcty.EmptyObject, err
	}
	return ty, nil
}

// HashicorpToZclonfValue converts from Hashicoprt.Value to zclconf.Value
func HashicorpToZclonfValue(hv hcty.Value, ht hcty.Type) (zcty.Value, error) {
	sb, err := hmsgpack.Marshal(hv, ht)
	if err != nil {
		return zcty.EmptyObjectVal, err
	}
	ty, err := HashicorpToZclonfType(ht)
	if err != nil {
		return zcty.EmptyObjectVal, err
	}
	zvalue, err := zmsgpack.Unmarshal(sb, ty)
	if err != nil {
		return zcty.EmptyObjectVal, err
	}
	return zvalue, nil
}

```

### Core Architecture Module: `util/doc.go`
```
// Package util include a serie of utilities
// for Terracognita
package util

```

### Core Architecture Module: `util/name.go`
```
package util

import (
	"regexp"
	"strings"
)

var invalidNameRegexp = regexp.MustCompile(`[^a-z0-9_]`)

// NormalizeName will convert the n into an low case alphanumeric value
// and the invalid characters will be replaced by '_'
func NormalizeName(n string) string {
	return invalidNameRegexp.ReplaceAllString(strings.ToLower(n), "_")
}

```

### Core Architecture Module: `util/retry.go`
```
package util

import (
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/cycloidio/terracognita/log"
)

const (
	timesDefault    = 3
	intervalDefault = 30 * time.Second
)

// RetryFn it's a type to represent the function wrapped for the
// Retry or RetryDefault methods
type RetryFn func() error

// Retry calls rfn and checks the errors, if it matches the error
// and if it does it tries 'times' withing the 'interval'
func Retry(rfn RetryFn, times int, interval time.Duration) error {
	err := rfn()
	times--
	if err != nil {
		if times == 0 {
			return err
		}
		// If the error is from the stdlib we just continue with them
		// This is a fix because 'request.IsErrorRetryable(err)' will always
		// retry normal errors "just in case" and we do not want to retry errors
		// that we return
		// *errors.errorString is the standar lib
		// *errors.fundamental is the github.com/pkg/errors
		// This way if it's an std error or one from us we skip the Retry
		errtype := fmt.Sprintf("%T", err)
		if errtype == "*errors.errorString" || errtype == "*errors.fundamental" || errtype == "*errors.withStack" || errtype == "*errors.withMessage" {
			return err
		}
		if request.IsErrorRetryable(err) || request.IsErrorThrottle(err) || request.IsErrorExpiredCreds(err) {
			log.Get().Log("func", "utils.Retry", "msg", "waiting for Throttling error", "err", fmt.Sprintf("%+v", err), "times-left", times)
			time.Sleep(interval)
			return Retry(rfn, times, interval)
		}
	}

	return err
}

// RetryDefault calls Retry with the default parameters
func RetryDefault(rfn RetryFn) error {
	return Retry(rfn, timesDefault, intervalDefault)
}

```

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

func cacheGlueDatabases(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]provider.Resource, error) {

	rs, err := a.cache.Get(rt)
	if err != nil {
		if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
			return nil, errors.WithStack(err)
		}

		rs, err = glueCatalogDatabases(ctx, a, rt, filters)
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

func getGlueDatabasesNames(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]string, error) {
	rs, err := cacheGlueDatabases(ctx, a, rt, filters)
	if err != nil {
		return nil, err
	}

	names := make([]string, 0, len(rs))
	for _, i := range rs {
		names = append(names, strings.SplitN(i.ID(), ":", 2)[1])
	}

	return names, nil
}

func cacheTransitGatewayRouteTables(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]provider.Resource, error) {
	rs, err := a.cache.Get(rt)
	if err != nil {
		if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
			return nil, errors.WithStack(err)
		}

		rs, err = ec2TransitGatewayRouteTable(ctx, a, rt, filters)
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

func getTransitGatewayRouteTablesIDs(ctx context.Context, a *aws, rt string, filters *filter.Filter) ([]string, error) {
	rs, err := cacheTransitGatewayRouteTables(ctx, a, rt, filters)
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
			FnAttributeList: "DirectConnectGateways",
			SingularEntity:  "Gateway",
			Prefix:          "Describe",
			Service:         "directconnect",
			Documentation: `
			// GetDirectConnectGateways returns the Direct Connect gateways on the given input
			// Returned values are commented in the interface doc comment block.
			`,
		},

		// directoryservice
		Function{
			FnName:          "GetDirectoryServiceDirectories",
			Entity:          "Directories",
			FnAttributeList: "DirectoryDescriptions",
			SingularEntity:  "DirectoryDescription",
			Prefix:          "Describe",
			Service:         "directoryservice",
			Documentation: `
			// GetDirectoryServiceDirectories returns the Directory Service directorie on the given input
			// Returned values are commented in the interface doc comment block.
			`,
		},

		// dms / databasemigrationservice
		Function{
			FnName:                     "GetDMSDescribeReplicationInstances",
			Entity:                     "ReplicationInstances",
			FnAttributeList:            "ReplicationInstances",
			SingularEntity:             "ReplicationInstance",
			Prefix:                     "Describe",
			Service:                    "databasemigrationservice",
			FnPaginationAttribute:      "Marker",
			FnInputPaginationAttribute: "Marker",
			Documentation: `
			// GetDMSDescribeReplicationInstances returns the DMS replication instances on the given input
			// Returned values are commented in the interface doc comment block.
			`,
		},

		// DynamoDB
		Function{
			FnName:                     "GetDynamodbGlobalTables",
			Entity:                     "GlobalTables",
			FnAttributeList:            "GlobalTables",
			SingularEntity:             "GlobalTable",
			Prefix:                     "List",
			Service:                    "dynamodb",
			FnPaginationAttribute:      "LastEvaluatedGlobalTableName",
			FnInputPaginationAttribute: "ExclusiveStartGlobalTableName",
			Documentation: `
			// GetDynamodbGlobalTables returns the dynamodb global tab
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
		return strings.Split(f.FnAttributeList, ".")[0]
	}

	return f.Entity
}

// IsAttributeListSlice checks if the logic should be to
// access an attribute or to iterate over attributes
func (f Function) IsAttributeListSlice() bool {
	if strings.Contains(f.FnAttributeList, "#") {
		return true
	}
	return false
}

// ServiceEntityFn the name of the function to call on the
// service to get the Entity
func (f Function) ServiceEntityFn() string {
	if f.FnServiceEntity != "" {
		return fmt.Sprintf("%s%s", f.Prefix, f.FnServiceEntity)
	}

	return fmt.Sprintf("%s%s", f.Prefix, f.Entity)

}

// PaginationAttributeFn is the attribute that defined the Pagination
func (f Function) PaginationAttributeFn() string {
	if f.FnPaginationAttribute != "" {
		return f.FnPaginationAttribute
	}

	return "NextToken"
}

// InputPaginationAttributeFn is the attribute that defines the
// pagination on the input filter
func (f Function) InputPaginationAttributeFn() string {
	if f.FnInputPaginationAttribute != "" {
		return f.FnInputPaginationAttribute
	}

	return f.PaginationAttributeFn()
}

// Execute uses the fnTmpl to interpolate f
// and write the result to w
func (f Function) Execute(w io.Writer) error {
	if f.NoGenerateFn {
		return nil
	}

	err := fnTmpl.Execute(w, f)
	if err != nil {
		return errors.Wrapf(err, "failed to Execute with Function %+v", f)
	}

	return nil
}

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
+	//TODO CACHE
+	if err != nil {
+		return nil, errors.Wrap(err, "unable to list network interfaces from reader")
+	}
+	resources := make([]provider.Resource, 0, len(networkInterfaces))
+	for _, networkInterface := range networkInterfaces {
+
+		if !filterByTags(filters, networkInterface.Tags) {
+			continue
+		}
+
+		props := networkInterface.InterfacePropertiesFormat
+		if props != nil {
+			if props.NetworkSecurityGroup != nil || props.NetworkSecurityGroup.ID != nil {
+				r := provider.NewResource(fmt.Sprintf("%s|%s", *networkInterface.ID, *props.NetworkSecurityGroup.ID), resourceType, a)
+				resources = append(resources, r)
+			}
+		}
+	}
+	return resources, nil
+}
+
 // Load Balancer
 func lbs(ctx context.Context, a *azurerm, ar *AzureReader, resourceType string, filters *filter.Filter) ([]provider.Resource, error) {
 	lbs, err := ar.ListLoadBalancers(ctx)
```

**File**: `azurerm/resourcetype_enumer.go` (modified, +500/-496)
```diff
@@ -7,11 +7,11 @@ import (
 	"strings"
 )
 
-const _ResourceTypeName = "azurerm_resource_groupazurerm_availability_setazurerm_imageazurerm_managed_diskazurerm_virtual_machineazurerm_virtual_machine_data_disk_attachmentazurerm_virtual_machine_extensionazurerm_virtual_machine_scale_set_extensionazurerm_virtual_networkazurerm_linux_virtual_machineazurerm_linux_virtual_machine_scale_setazurerm_windows_virtual_machineazurerm_windows_virtual_machine_scale_setazurerm_subnetazurerm_network_interfaceazurerm_network_security_groupazurerm_application_gatewayazurerm_application_security_groupazurerm_network_ddos_protection_planazurerm_firewallazurerm_local_network_gatewayazurerm_nat_gatewayazurerm_network_profileazurerm_network_security_ruleazurerm_public_ipazurerm_public_ip_prefixazurerm_routeazurerm_route_tableazurerm_virtual_network_gatewayazurerm_virtual_network_gateway_connectionazurerm_virtual_network_peeringazurerm_web_application_firewall_policyazurerm_virtual_hubazurerm_virtual_hub_bgp_connectionazurerm_virtual_hub_connectionazurerm_virtual_hub_ipazurerm_virtual_hub_route_tableazurerm_virtual_hub_security_partner_providerazurerm_lbazurerm_lb_backend_address_poolazurerm_lb_ruleazurerm_lb_outbound_ruleazurerm_lb_nat_ruleazurerm_lb_nat_poolazurerm_lb_probeazurerm_virtual_desktop_host_poolazurerm_virtual_desktop_application_groupazurerm_logic_app_workflowazurerm_logic_app_trigger_customazurerm_logic_app_action_customazurerm_container_registryazurerm_container_registry_webhookazurerm_kubernetes_clusterazurerm_kubernetes_cluster_node_poolazurerm_storage_accountazurerm_storage_queueazurerm_storage_shareazurerm_storage_tableazurerm_storage_blobazurerm_mariadb_configurationazurerm_mariadb_databaseazurerm_mariadb_firewall_ruleazurerm_mariadb_serverazurerm_mariadb_virtual_network_ruleazurerm_mysql_configurationazurerm_mysql_databaseazurerm_mysql_firewall_ruleazurerm_mysql_serverazurerm_mysql_virtual_network_ruleazurerm_postgresql_configurationazurerm_postgresql_databaseazurerm_postgresql_firewall_ruleazurerm_postgresql_serverazurerm_postgresql_virtual_network_ruleazurerm_mssql_elasticpoolazurerm_mssql_databaseazurerm_mssql_firewall_ruleazurerm_mssql_serverazurerm_mssql_server_security_alert_policyazurerm_mssql_server_vulnerability_assessmentazurerm_mssql_virtual_machineazurerm_mssql_virtual_network_ruleazurerm_redis_cacheazurerm_redis_firewall_ruleazurerm_dns_zoneazurerm_dns_a_recordazurerm_dns_aaaa_recordazurerm_dns_caa_recordazurerm_dns_cname_recordazurerm_dns_mx_recordazurerm_dns_ns_recordazurerm_dns_ptr_recordazurerm_dns_srv_recordazurerm_dns_txt_recordazurerm_private_dns_zoneazurerm_private_dns_a_recordazurerm_private_dns_aaaa_recordazurerm_private_dns_cname_recordazurerm_private_dns_mx_recordazurerm_private_dns_ptr_recordazurerm_private_dns_srv_recordazurerm_private_dns_txt_recordazurerm_private_dns_zone_virtual_network_linkazurerm_policy_definitionazurerm_policy_remediationazurerm_policy_set_definitionazurerm_key_vaultazurerm_key_vault_access_policyazurerm_application_insightsazurerm_application_insights_api_keyazurerm_application_insights_analytics_itemazurerm_log_analytics_workspaceazurerm_log_analytics_linked_serviceazurerm_log_analytics_datasource_windows_performance_counterazurerm_log_analytics_datasource_windows_eventazurerm_monitor_action_groupazurerm_monitor_activity_log_alertazurerm_monitor_autoscale_settingazurerm_monitor_log_profileazurerm_monitor_metric_alertazurerm_windows_web_appazurerm_linux_web_appazurerm_linux_web_app_slotazurerm_windows_web_app_slotazurerm_web_app_active_slotazurerm_service_planazurerm_source_control_tokenazurerm_static_siteazurerm_static_site_custom_domainazurerm_web_app_hybrid_connectionazurerm_data_protection_backup_vaultazurerm_data_protection_backup_instance_diskazurerm_data_protection_backup_policy_diskazurerm_api_managementazurerm_recovery_services_vaultazurerm_backup_policy_vmazurerm_backup_protected_vmazurerm_backup_policy_vm_workload"
+const _ResourceTypeName = "azurerm_resource_groupazurerm_availability_setazurerm_imageazurerm_managed_diskazurerm_virtual_machineazurerm_virtual_machine_data_disk_attachmentazurerm_virtual_machine_extensionazurerm_virtual_machine_scale_set_extensionazurerm_virtual_networkazurerm_linux_virtual_machineazurerm_linux_virtual_machine_scale_setazurerm_windows_virtual_machineazurerm_windows_virtual_machine_scale_setazurerm_subnetazurerm_network_interfaceazurerm_network_interface_security_group_associationazurerm_network_security_groupazurerm_application_gatewayazurerm_application_security_groupazurerm_network_ddos_protection_planazurerm_firewallazurerm_local_network_gatewayazurerm_nat_gatewayazurerm_network_profileazurerm_network_security_ruleazurerm_public_ipazurerm_public_ip_prefixazurerm_routeazurerm_route_tableazurerm_virtual_network_gatewayazurerm_virtual_network_gateway_connectionazurerm_virtual_network_peeringazurerm_web_application_firewall_policyazurerm_virtual_hubazurerm_virtual_hub_bgp_connectionazurerm_virtual_hub_connectionazurerm_v
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

### Incident Patch 6: `7f8d6810` (2023-03-07)
**Commit Message**: build(deps): bump golang.org/x/net (#354)

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +3/-3)
```diff
@@ -164,10 +164,10 @@ require (
 	go.opencensus.io v0.23.0 // indirect
 	golang.org/x/crypto v0.0.0-20220411220226-7b82a4e95df4 // indirect
 	golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4 // indirect
-	golang.org/x/net v0.0.0-20220127200216-cd36cc0744dd // indirect
+	golang.org/x/net v0.7.0 // indirect
 	golang.org/x/oauth2 v0.0.0-20211104180415-d3ed0bb246c8 // indirect
-	golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f // indirect
-	golang.org/x/text v0.3.8 // indirect
+	golang.org/x/sys v0.5.0 // indirect
+	golang.org/x/text v0.7.0 // indirect
 	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f // indirect
 	google.golang.org/appengine v1.6.7 // indirect
 	google.golang.org/genproto v0.0.0-20211118181313-81c1377c94b1 // indirect
```

**File**: `go.sum` (modified, +8/-6)
```diff
@@ -1338,10 +1338,10 @@ golang.org/x/net v0.0.0-20211015210444-4f30a5c0130f/go.mod h1:9nx3DQGgdP8bBQD5qx
 golang.org/x/net v0.0.0-20211112202133-69e39bad7dc2/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20211209124913-491a49abca63/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20211216030914-fe4d6282115f/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
-golang.org/x/net v0.0.0-20220127200216-cd36cc0744dd h1:O7DYs+zxREGLKzKoMQrtrEacpb0ZVXA5rIwylE2Xchk=
 golang.org/x/net v0.0.0-20220127200216-cd36cc0744dd/go.mod h1:CfG3xpIq0wQ8r1q4Su4UZFWDARRcnwPjda9FqA0JpMk=
-golang.org/x/net v0.0.0-20220722155237-a158d28d115b h1:PxfKdU9lEEDYjdIzOtC4qFWgkU2rGHdKlKowJSMN9h0=
 golang.org/x/net v0.0.0-20220722155237-a158d28d115b/go.mod h1:XRhObCWvk6IyKnWLug+ECip1KBveYUHfp+8e9klMJ9c=
+golang.org/x/net v0.7.0 h1:rJrUqqhjsgNp7KqAIc25s9pZnjU7TUcSY7HcVZjdn1g=
+golang.org/x/net v0.7.0/go.mod h1:2Tu9+aMcznHK/AK1HMvgo6xiTLG5rD5rZLDS+rp2Bjs=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
 golang.org/x/oauth2 v0.0.0-20190604053449-0f29369cfe45/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
@@ -1463,13 +1463,15 @@ golang.org/x/sys v0.0.0-20211019181941-9d821ace8654/go.mod h1:oPkhp1MJrh7nUepCBc
 golang.org/x/sys v0.0.0-20211124211545-fe61309f8881/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20211216021012-1d35b9e2eb4e/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220520151302-bc2c85ada10a/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f h1:v4INt8xihDGvnrfjMDVXGxw9wrfxYyCjk0KbXjhR55s=
 golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
+golang.org/x/sys v0.5.0 h1:MUK/U/4lj1t1oPg0HfuXDN/Z1wv31ZJ/YcPiGccS4DU=
+golang.org/x/sys v0.5.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/term v0.0.0-20201117132131-f5c789dd3221/go.mod h1:Nr5EML6q2oocZ2LXRh80K7BxOlk5/8JxuGnuhpl+muw=
 golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=
 golang.org/x/term v0.0.0-20210615171337-6886f2dfbf5b/go.mod h1:jbD1KX2456YbFQfuXm/mYQcufACuNUgVhRMnK/tPxf8=
-golang.org/x/term v0.0.0-20210927222741-03fcf44c2211 h1:JGgROgKl9N8DuW20oFS5gxc+lE67/N3FcwmBPMe7ArY=
 golang.org/x/term v0.0.0-20210927222741-03fcf44c2211/go.mod h1:jbD1KX2456YbFQfuXm/mYQcufACuNUgVhRMnK/tPxf8=
+golang.org/x/term v0.5.0 h1:n2a8QNdAb0sZNpU9R1ALUXBbY+w51fCQDN+7EdxNBsY=
+golang.org/x/term v0.5.0/go.mod h1:jMB1sMXY+tzblOD4FWmEbocvup2/aLOaQEp7JmGp78k=
 golang.org/x/text v0.0.0-20170915032832-14c0d48ead0c/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.3.0/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.3.1-0.20180807135948-17ff2d5776d2/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
@@ -1479,8 +1481,8 @@ golang.org/x/text v0.3.4/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
 golang.org/x/text v0.3.5/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
 golang.org/x/text v0.3.6/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
 golang.org/x/text v0.3.7/go.mod h1:u+2+/6zg+i71rQMx5EYifcz6MCKuco9NR6JIITiCfzQ=
-golang.org/x/text v0.3.8 h1:nAL+RVCQ9uMn3vJZbV+MRnydTJFPf8qqY42YiA6MrqY=
-golang.org/x/text v0.3.8/go.mod h1:E6s5w1FMmriuDzIBO73fBruAKo1PCIq6d2Q6DHfQ8WQ=
+golang.org/x/text v0.7.0 h1:4BRB4x83lYWy72KwLD/qYDuTu7q9PjSagHvijDw7cLo=
+golang.org/x/text v0.7.0/go.mod h1:mrYo+phRRbMaCq/xk9113O4dZlRixOauAjOtrjsXDZ8=
 golang.org/x/time v0.0.0-20180412165947-fbb02b2291d2/go.mod h1:tRJNPiyCQ0inRvYxbN9jk5I+vvW/OXSQhTDSoE431IQ=
 golang.org/x/time v0.0.0-20181108054448-85acf8d2951c/go.mod h1:tRJNPiyCQ0inRvYxbN9jk5I+vvW/OXSQhTDSoE431IQ=
 golang.org/x/time v0.0.0-20190308202827-9d24e82272b4/go.mod h1:tRJNPiyCQ0inRvYxbN9jk5I+vvW/OXSQhTDSoE431IQ=
```

---

### Incident Patch 7: `25ae80de` (2023-03-02)
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

### Incident Patch 8: `7295e15a` (2023-02-23)
**Commit Message**: build(deps): bump golang.org/x/text from 0.3.7 to 0.3.8

Bumps [golang.org/x/text](https://github.com/golang/text) from 0.3.7 to 0.3.8.
- [Release notes](https://github.com/golang/text/releases)
- [Commits](https://github.com/golang/text/compare/v0.3.7...v0.3.8)

---
updated-dependencies:
- dependency-name: golang.org/x/text
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -166,8 +166,8 @@ require (
 	golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4 // indirect
 	golang.org/x/net v0.0.0-20220127200216-cd36cc0744dd // indirect
 	golang.org/x/oauth2 v0.0.0-20211104180415-d3ed0bb246c8 // indirect
-	golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8 // indirect
-	golang.org/x/text v0.3.7 // indirect
+	golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f // indirect
+	golang.org/x/text v0.3.8 // indirect
 	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f // indirect
 	google.golang.org/appengine v1.6.7 // indirect
 	google.golang.org/genproto v0.0.0-20211118181313-81c1377c94b1 // indirect
```

**File**: `go.sum` (modified, +10/-3)
```diff
@@ -1166,6 +1166,7 @@ github.com/yuin/goldmark v1.2.1/go.mod h1:3hX8gzYuyVAZsxl0MRgGTJEmQBFcNTphYh9dec
 github.com/yuin/goldmark v1.3.5/go.mod h1:mwnBkeHKe2W/ZEtQ+71ViKU8L12m81fl3OWwC1Zlc8k=
 github.com/yuin/goldmark v1.4.0/go.mod h1:mwnBkeHKe2W/ZEtQ+71ViKU8L12m81fl3OWwC1Zlc8k=
 github.com/yuin/goldmark v1.4.1/go.mod h1:mwnBkeHKe2W/ZEtQ+71ViKU8L12m81fl3OWwC1Zlc8k=
+github.com/yuin/goldmark v1.4.13/go.mod h1:6yULJ656Px+3vBD8DxQVa3kxgyrAnzto9xy5taEt/CY=
 github.com/zclconf/go-cty v1.0.0/go.mod h1:xnAOWiHeOqg2nWS62VtQ7pbOu17FtxJNW8RLEih+O3s=
 github.com/zclconf/go-cty v1.1.0/go.mod h1:xnAOWiHeOqg2nWS62VtQ7pbOu17FtxJNW8RLEih+O3s=
 github.com/zclconf/go-cty v1.2.0/go.mod h1:hOPWgoHbaTUnI5k4D2ld+GRpFJSCe6bCM7m1q/N4PQ8=
@@ -1339,6 +1340,8 @@ golang.org/x/net v0.0.0-20211209124913-491a49abca63/go.mod h1:9nx3DQGgdP8bBQD5qx
 golang.org/x/net v0.0.0-20211216030914-fe4d6282115f/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20220127200216-cd36cc0744dd h1:O7DYs+zxREGLKzKoMQrtrEacpb0ZVXA5rIwylE2Xchk=
 golang.org/x/net v0.0.0-20220127200216-cd36cc0744dd/go.mod h1:CfG3xpIq0wQ8r1q4Su4UZFWDARRcnwPjda9FqA0JpMk=
+golang.org/x/net v0.0.0-20220722155237-a158d28d115b h1:PxfKdU9lEEDYjdIzOtC4qFWgkU2rGHdKlKowJSMN9h0=
+golang.org/x/net v0.0.0-20220722155237-a158d28d115b/go.mod h1:XRhObCWvk6IyKnWLug+ECip1KBveYUHfp+8e9klMJ9c=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
 golang.org/x/oauth2 v0.0.0-20190604053449-0f29369cfe45/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
@@ -1370,6 +1373,7 @@ golang.org/x/sync v0.0.0-20200625203802-6e8e738ad208/go.mod h1:RxMgew5VJxzue5/jJ
 golang.org/x/sync v0.0.0-20201020160332-67f06af15bc9/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20201207232520-09787c993a3a/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20210220032951-036812b2e83c/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
+golang.org/x/sync v0.0.0-20220722155255-886fb9371eb4/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sys v0.0.0-20180823144017-11551d06cbcc/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20180830151530-49385e6e1522/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20180905080454-ebe1bf3edb33/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
@@ -1458,8 +1462,9 @@ golang.org/x/sys v0.0.0-20210908233432-aa78b53d3365/go.mod h1:oPkhp1MJrh7nUepCBc
 golang.org/x/sys v0.0.0-20211019181941-9d821ace8654/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20211124211545-fe61309f8881/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20211216021012-1d35b9e2eb4e/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8 h1:0A+M6Uqn+Eje4kHMK80dtF3JCXC4ykBgQG4Fe06QRhQ=
-golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
+golang.org/x/sys v0.0.0-20220520151302-bc2c85ada10a/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
+golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f h1:v4INt8xihDGvnrfjMDVXGxw9wrfxYyCjk0KbXjhR55s=
+golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/term v0.0.0-20201117132131-f5c789dd3221/go.mod h1:Nr5EML6q2oocZ2LXRh80K7BxOlk5/8JxuGnuhpl+muw=
 golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=
 golang.org/x/term v0.0.0-20210615171337-6886f2dfbf5b/go.mod h1:jbD1KX2456YbFQfuXm/mYQcufACuNUgVhRMnK/tPxf8=
@@ -1473,8 +1478,9 @@ golang.org/x/text v0.3.3/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
 golang.org/x/text v0.3.4/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
 golang.org/x/text v0.3.5/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
 golang.org/x/text v0.3.6/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
-golang.org/x/text v0.3.7 h1:olpwvP2KacW1ZWvsR7uQhoyTYvKAupfQrRGBFM352Gk=
 golang.org/x/text v0.3.7/go.mod h1:u+2+/6zg+i71rQMx5EYifcz6MCKuco9NR6JIITiCfzQ=
+golang.org/x/text v0.3.8 h1:nAL+RVCQ9uMn3vJZbV+MRnydTJFPf8qqY42YiA6MrqY=
+golang.org/x/text v0.3.8/go.mod h1:E6s5w1FMmriuDzIBO73fBruAKo1PCIq6d2Q6DHfQ8WQ=
 golang.org/x/time v0.0.0-20180412165947-fbb02b2291d2/go.mod h1:tRJNPiyCQ0inRvYxbN9jk5I+vvW/OXSQhTDSoE431IQ=
 golang.org/x/time v0.0.0-20181108054448-85acf8d2951c/go.mod h1:tRJNPiyCQ0inRvYxbN9jk5I+vvW/OXSQhTDSoE431IQ=
 golang.org/x/time v0.0.0-20190308202827-9d24e82272b4/go.mod h1:tRJNPiyCQ0inRvYxbN9jk5I+vvW/OXSQhTDSoE431IQ=
@@ -1587,6 +1593,7 @@ golang.org/x/tools v0.1.4/go.mod h1:o0xws9oXOQQZyjljx8fwUC0k7L1pTE6eaCbjGeHmOkk=
 golang.org/x/tools v0.1.5/go.mod h1:o0xws9oXOQQZyjljx8fwUC0k7L1pTE6eaCbjGeHmOkk=
 gola
```

---

### Incident Patch 9: `66050ae4` (2023-02-23)
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

### Incident Patch 10: `a03cfdba` (2023-02-16)
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
+			return cty.NullVal(cty.EmptyObject), errors.Wrapf(err, "failed to convert CTY value to GO type")
+		}
+		// Once we know we have to unset the disk default values we Transform the config
+		if unsetDiskReadWrite {
+			v, err = cty.Transform(v, func(path cty.Path, v cty.Value) (cty.Value, error) {
+				if len(path) > 0 {
+					if gas, ok := path[0].(cty.GetAttrStep); ok {
+						switch gas.Name {
+						case "disk_iops_read_write", "disk_mbps_read_write":
+							return cty.NullVal(cty.Number), nil
+						}
+					}
+				}
+				return v, nil
+			})
+			if err != nil {
+				return v, errors.Wrapf(err, "failed to convert CTY value to GO type")
+			}
+		}
+	case "azurerm_windows_virtual_machine":
+		v, err = cty.Transform(v, func(path cty.Path, v cty.Value) (cty.Value, error) {
+			if len(path) > 0 {
+				if gas, ok := path[0].(cty.GetAttrStep); ok {
+					switch gas.Name {
+					case "platform_fault_domain":
+						// By default this attribute is set, but this is not a valid value with terraform apply.
+						// In this case, we shouldn't write platfo
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

**File**: `google/provider.go` (modified, +2/-0)
```diff
@@ -9,6 +9,7 @@ import (
 	"github.com/cycloidio/terracognita/filter"
 	"github.com/cycloidio/terracognita/log"
 	"github.com/cycloidio/terracognita/provider"
+	"github.com/hashicorp/go-cty/cty"
 
 	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
 	tfgoogle "github.com/hashicorp/terraform-provider-google/google"
@@ -124,3 +125,4 @@ func (g *google) TFClient() interface{} {
 func (g *google) TFProvider() *schema.Provider {
 	return g.tfProvider
 }
+func (g *google) FixResource(t string, v cty.Value) (cty.Value, error) { return v, nil }
```

**File**: `mock/provider.go` (modified, +40/-24)
```diff
@@ -11,89 +11,105 @@ import (
 	filter "github.com/cycloidio/terracognita/filter"
 	provider "github.com/cycloidio/terracognita/provider"
 	gomock "github.com/golang/mock/gomock"
+	cty "github.com/hashicorp/go-cty/cty"
 	schema "github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
 )
 
-// Provider is a mock of Provider interface
+// Provider is a mock of Provider interface.
 type Provider struct {
 	ctrl     *gomock.Controller
 	recorder *ProviderMockRecorder
 }
 
-// ProviderMockRecorder is the mock recorder for Provider
+// ProviderMockRecorder is the mock recorder for Provider.
 type ProviderMockRecorder struct {
 	mock *Provider
 }
 
-// NewProvider creates a new mock instance
+// NewProvider creates a new mock instance.
 func NewProvider(ctrl *gomock.Controller) *Provider {
 	mock := &Provider{ctrl: ctrl}
 	mock.recorder = &ProviderMockRecorder{mock}
 	return mock
 }
 
-// EXPECT returns an object that allows the caller to indicate expected use
+// EXPECT returns an object that allows the caller to indicate expected use.
 func (m *Provider) EXPECT() *ProviderMockRecorder {
 	return m.recorder
 }
 
-// Configuration mocks base method
+// Configuration mocks base method.
 func (m *Provider) Configuration() map[string]interface{} {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "Configuration")
 	ret0, _ := ret[0].(map[string]interface{})
 	return ret0
 }
 
-// Configuration indicates an expected call of Configuration
+// Configuration indicates an expected call of Configuration.
 func (mr *ProviderMockRecorder) Configuration() *gomock.Call {
 	mr.mock.ctrl.T.Helper()
 	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Configuration", reflect.TypeOf((*Provider)(nil).Configuration))
 }
 
-// HasResourceType mocks base method
+// FixResource mocks base method.
+func (m *Provider) FixResource(arg0 string, arg1 cty.Value) (cty.Value, error) {
+	m.ctrl.T.Helper()
+	ret := m.ctrl.Call(m, "FixResource", arg0, arg1)
+	ret0, _ := ret[0].(cty.Value)
+	ret1, _ := ret[1].(error)
+	return ret0, ret1
+}
+
+// FixResource indicates an expected call of FixResource.
+func (mr *ProviderMockRecorder) FixResource(arg0, arg1 interface{}) *gomock.Call {
+	mr.mock.ctrl.T.Helper()
+	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "FixResource", reflect.TypeOf((*Provider)(nil).FixResource), arg0, arg1)
+}
+
+// HasResourceType mocks base method.
 func (m *Provider) HasResourceType(arg0 string) bool {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "HasResourceType", arg0)
 	ret0, _ := ret[0].(bool)
 	return ret0
 }
 
-// HasResourceType indicates an expected call of HasResourceType
+// HasResourceType indicates an expected call of HasResourceType.
 func (mr *ProviderMockRecorder) HasResourceType(arg0 interface{}) *gomock.Call {
 	mr.mock.ctrl.T.Helper()
 	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "HasResourceType", reflect.TypeOf((*Provider)(nil).HasResourceType), arg0)
 }
 
-// Region mocks base method
+// Region mocks base method.
 func (m *Provider) Region() string {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "Region")
 	ret0, _ := ret[0].(string)
 	return ret0
 }
 
-// Region indicates an expected call of Region
+// Region indicates an expected call of Region.
 func (mr *ProviderMockRecorder) Region() *gomock.Call {
 	mr.mock.ctrl.T.Helper()
 	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Region", reflect.TypeOf((*Provider)(nil).Region))
 }
 
-// ResourceTypes mocks base method
+// ResourceTypes mocks base method.
 func (m *Provider) ResourceTypes() []string {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "ResourceTypes")
 	ret0, _ := ret[0].([]string)
 	return ret0
 }
 
-// ResourceTypes indicates an expected call of ResourceTypes
+// ResourceTypes indicates an expected call of ResourceTypes.
 func (mr *ProviderMockRecorder) ResourceTypes() *gomock.Call {
 	mr.mock.ctrl.T.Helper()
 	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ResourceTypes", reflect.TypeOf((*Provider)(nil).ResourceTypes))
 }
 
-// Resources mocks base method
+// Resources mocks base method.
 func (m *Provider) Resources(arg0 context.Context, arg1 string, arg2 *filter.Filter) ([]provider.Resource, error) {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "Resources", arg0, arg1, arg2)
@@ -102,77 +118,77 @@ func (m *Provider) Resources(arg0 context.Context, arg1 string, arg2 *filter.Fil
 	return ret0, ret1
 }
 
-// Resources indicates an expected call of Resources
+// Resources indicates an expected call of Resources.
 func (mr *ProviderMockRecorder) Resources(arg0, arg1, arg2 interface{}) *gomock.Call {
 	mr.mock.ctrl.T.Helper()
 	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Resources", reflect.TypeOf((*Provider)(nil).Resources), arg0, arg1, arg2)
 }
 
-// Source mocks base method
+// Source mocks base method.
 func (m *Provider) Source() string {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "Source")
 	ret0, _ := ret[0].(string)
 	return ret0
 }
 
-// Source indicates an expected call of Source
+// Source indica
```

**File**: `mock/resource.go` (modified, +36/-36)
```diff
@@ -17,30 +17,30 @@ import (
 	states "github.com/hashicorp/terraform/states"
 )
 
-// Resource is a mock of Resource interface
+// Resource is a mock of Resource interface.
 type Resource struct {
 	ctrl     *gomock.Controller
 	recorder *ResourceMockRecorder
 }
 
-// ResourceMockRecorder is the mock recorder for Resource
+// ResourceMockRecorder is the mock recorder for Resource.
 type ResourceMockRecorder struct {
 	mock *Resource
 }
 
-// NewResource creates a new mock instance
+// NewResource creates a new mock instance.
 func NewResource(ctrl *gomock.Controller) *Resource {
 	mock := &Resource{ctrl: ctrl}
 	mock.recorder = &ResourceMockRecorder{mock}
 	return mock
 }
 
-// EXPECT returns an object that allows the caller to indicate expected use
+// EXPECT returns an object that allows the caller to indicate expected use.
 func (m *Resource) EXPECT() *ResourceMockRecorder {
 	return m.recorder
 }
 
-// AttributesReference mocks base method
+// AttributesReference mocks base method.
 func (m *Resource) AttributesReference() ([]string, error) {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "AttributesReference")
@@ -49,69 +49,69 @@ func (m *Resource) AttributesReference() ([]string, error) {
 	return ret0, ret1
 }
 
-// AttributesReference indicates an expected call of AttributesReference
+// AttributesReference indicates an expected call of AttributesReference.
 func (mr *ResourceMockRecorder) AttributesReference() *gomock.Call {
 	mr.mock.ctrl.T.Helper()
 	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "AttributesReference", reflect.TypeOf((*Resource)(nil).AttributesReference))
 }
 
-// Data mocks base method
+// Data mocks base method.
 func (m *Resource) Data() *schema.ResourceData {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "Data")
 	ret0, _ := ret[0].(*schema.ResourceData)
 	return ret0
 }
 
-// Data indicates an expected call of Data
+// Data indicates an expected call of Data.
 func (mr *ResourceMockRecorder) Data() *gomock.Call {
 	mr.mock.ctrl.T.Helper()
 	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Data", reflect.TypeOf((*Resource)(nil).Data))
 }
 
-// HCL mocks base method
+// HCL mocks base method.
 func (m *Resource) HCL(arg0 writer.Writer) error {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "HCL", arg0)
 	ret0, _ := ret[0].(error)
 	return ret0
 }
 
-// HCL indicates an expected call of HCL
+// HCL indicates an expected call of HCL.
 func (mr *ResourceMockRecorder) HCL(arg0 interface{}) *gomock.Call {
 	mr.mock.ctrl.T.Helper()
 	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "HCL", reflect.TypeOf((*Resource)(nil).HCL), arg0)
 }
 
-// ID mocks base method
+// ID mocks base method.
 func (m *Resource) ID() string {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "ID")
 	ret0, _ := ret[0].(string)
 	return ret0
 }
 
-// ID indicates an expected call of ID
+// ID indicates an expected call of ID.
 func (mr *ResourceMockRecorder) ID() *gomock.Call {
 	mr.mock.ctrl.T.Helper()
 	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ID", reflect.TypeOf((*Resource)(nil).ID))
 }
 
-// ImpliedType mocks base method
+// ImpliedType mocks base method.
 func (m *Resource) ImpliedType() cty.Type {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "ImpliedType")
 	ret0, _ := ret[0].(cty.Type)
 	return ret0
 }
 
-// ImpliedType indicates an expected call of ImpliedType
+// ImpliedType indicates an expected call of ImpliedType.
 func (mr *ResourceMockRecorder) ImpliedType() *gomock.Call {
 	mr.mock.ctrl.T.Helper()
 	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ImpliedType", reflect.TypeOf((*Resource)(nil).ImpliedType))
 }
 
-// ImportState mocks base method
+// ImportState mocks base method.
 func (m *Resource) ImportState() ([]provider.Resource, error) {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "ImportState")
@@ -120,145 +120,145 @@ func (m *Resource) ImportState() ([]provider.Resource, error) {
 	return ret0, ret1
 }
 
-// ImportState indicates an expected call of ImportState
+// ImportState indicates an expected call of ImportState.
 func (mr *ResourceMockRecorder) ImportState() *gomock.Call {
 	mr.mock.ctrl.T.Helper()
 	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ImportState", reflect.TypeOf((*Resource)(nil).ImportState))
 }
 
-// InstanceInfo mocks base method
+// InstanceInfo mocks base method.
 func (m *Resource) InstanceInfo() *terraform.InstanceInfo {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "InstanceInfo")
 	ret0, _ := ret[0].(*terraform.InstanceInfo)
 	return ret0
 }
 
-// InstanceInfo indicates an expected call of InstanceInfo
+// InstanceInfo indicates an expected call of InstanceInfo.
 func (mr *ResourceMockRecorder) InstanceInfo() *gomock.Call {
 	mr.mock.ctrl.T.Helper()
 	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "InstanceInfo", reflect.TypeOf((*Resource)(nil).InstanceInfo))
 }
 
-// InstanceState mocks base method
+// InstanceState mocks base method.
 func (m *Resource) InstanceState() *terraform.InstanceState {
 	m.ctrl.T.Helper()
 	re
```

---

### Incident Patch 11: `063cb3c3` (2022-08-09)
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

### Incident Patch 12: `147cffb7` (2022-07-17)
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

---

### Incident Patch 13: `3db09953` (2022-06-30)
**Commit Message**: azurerm: fix resource naming and caching issues

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -8,6 +8,9 @@
   ([PR #294](https://github.com/cycloidio/terracognita/pull/294))
 - `aws_lb_target_group_attachment` was raising a nil pointer exception
   ([Issue #297](https://github.com/cycloidio/terracognita/issues/297))
+-  fix resource name in `azurerm_dns_aaaa_record` and `azurerm_mssql_elastic_pool` and also fix caching of resources
+  ([Issue #303](https://github.com/cycloidio/terracognita/issues/303))
+  ([Issue #305](https://github.com/cycloidio/terracognita/issues/305))
 
 
 ### Added
```

**File**: `azurerm/cache.go` (modified, +37/-32)
```diff
@@ -195,27 +195,30 @@ func getLbs(ctx context.Context, a *azurerm, ar *AzureReader, rt string, filters
 
 // Compute
 
-func cacheVirtualMachines(ctx context.Context, a *azurerm, ar *AzureReader, rt string, filters *filter.Filter) ([]provider.Resource, error) {
-	rs, err := a.cache.Get(rt)
-	if err != nil {
-		if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
-			return nil, errors.WithStack(err)
-		}
-
-		rs, err = virtualMachines(ctx, a, ar, rt, filters)
+func cacheVirtualMachines(ctx context.Context, a *azurerm, ar *AzureReader, rtList []string, filters *filter.Filter) ([]provider.Resource, error) {
+	var resources []provider.Resource
+	for _, rt := range rtList {
+		rs, err := a.cache.Get(rt)
 		if err != nil {
-			return nil, errors.Wrap(err, "unable to get virtual machines")
-		}
+			if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
+				return nil, errors.WithStack(err)
+			}
 
-		err = a.cache.Set(rt, rs)
-		if err != nil {
-			return nil, err
+			rs, err = virtualMachines(ctx, a, ar, rt, filters)
+			if err != nil {
+				return nil, errors.Wrap(err, "unable to get virtual machines")
+			}
+
+			err = a.cache.Set(rt, rs)
+			if err != nil {
+				return nil, err
+			}
+			resources = append(resources, rs...)
 		}
 	}
-
-	return rs, nil
+	return resources, nil
 }
-func getVirtualMachineNames(ctx context.Context, a *azurerm, ar *AzureReader, rt string, filters *filter.Filter) ([]string, error) {
+func getVirtualMachineNames(ctx context.Context, a *azurerm, ar *AzureReader, rt []string, filters *filter.Filter) ([]string, error) {
 	rs, err := cacheVirtualMachines(ctx, a, ar, rt, filters)
 	if err != nil {
 		return nil, err
@@ -229,28 +232,30 @@ func getVirtualMachineNames(ctx context.Context, a *azurerm, ar *AzureReader, rt
 	return names, nil
 }
 
-func cacheVirtualMachineScaleSets(ctx context.Context, a *azurerm, ar *AzureReader, rt string, filters *filter.Filter) ([]provider.Resource, error) {
-	rs, err := a.cache.Get(rt)
-	if err != nil {
-		if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
-			return nil, errors.WithStack(err)
-		}
+func cacheVirtualMachineScaleSets(ctx context.Context, a *azurerm, ar *AzureReader, rtList []string, filters *filter.Filter) ([]provider.Resource, error) {
+	var resources []provider.Resource
 
-		rs, err = virtualMachineScaleSets(ctx, a, ar, rt, filters)
+	for _, rt := range rtList {
+		rs, err := a.cache.Get(rt)
 		if err != nil {
-			return nil, errors.Wrap(err, "unable to get virtual machines scale sets")
-		}
+			if errors.Cause(err) != errcode.ErrCacheKeyNotFound {
+				return nil, errors.WithStack(err)
+			}
+			rs, err = virtualMachineScaleSets(ctx, a, ar, rt, filters)
+			if err != nil {
+				return nil, errors.Wrap(err, "unable to get virtual machines scale sets")
+			}
 
-		err = a.cache.Set(rt, rs)
-		if err != nil {
-			return nil, err
+			err = a.cache.Set(rt, rs)
+			if err != nil {
+				return nil, err
+			}
 		}
 	}
-
-	return rs, nil
+	return resources, nil
 }
-func getVirtualMachineScaleSetNames(ctx context.Context, a *azurerm, ar *AzureReader, rt string, filters *filter.Filter) ([]string, error) {
-	rs, err := cacheVirtualMachineScaleSets(ctx, a, ar, rt, filters)
+func getVirtualMachineScaleSetNames(ctx context.Context, a *azurerm, ar *AzureReader, rtList []string, filters *filter.Filter) ([]string, error) {
+	rs, err := cacheVirtualMachineScaleSets(ctx, a, ar, rtList, filters)
 	if err != nil {
 		return nil, err
 	}
```

**File**: `azurerm/resources.go` (modified, +51/-51)
```diff
@@ -101,7 +101,7 @@ const (
 	PostgresqlServer
 	PostgresqlVirtualNetworkRule
 	// Database Resources- mssql
-	MssqlElasticPool
+	MssqlElasticpool
 	MssqlDatabase
 	MssqlFirewallRule
 	MssqlServer
@@ -115,7 +115,7 @@ const (
 	// DNS
 	DNSZone
 	DNSARecord //dns_a_record
-	DNSAaaRecord
+	DNSAaaaRecord
 	DNSCaaRecord
 	DNSCnameRecord
 	DNSMxRecord
@@ -126,7 +126,7 @@ const (
 	// Private DNS
 	PrivateDNSZone
 	PrivateDNSARecord //private_dns_a_record
-	PrivateDNSAaaRecord
+	PrivateDNSAaaaRecord
 	PrivateDNSCnameRecord
 	PrivateDNSMxRecord
 	PrivateDNSPtrRecord
@@ -247,7 +247,7 @@ var (
 		PostgresqlServer:             postgresqlServers,
 		PostgresqlVirtualNetworkRule: postgresqlVirtualNetworkRules,
 		// Database Resources- mssql
-		MssqlElasticPool:                   mssqlElasticPools,
+		MssqlElasticpool:                   mssqlElasticPools,
 		MssqlDatabase:                      mssqlDatabases,
 		MssqlFirewallRule:                  mssqlFirewallRules,
 		MssqlServer:                        mssqlServers,
@@ -261,7 +261,7 @@ var (
 		// 	Dns
 		DNSZone:        dnsZones,
 		DNSARecord:     dnsRecordSets,
-		DNSAaaRecord:   dnsRecordSets,
+		DNSAaaaRecord:  dnsRecordSets,
 		DNSCaaRecord:   dnsRecordSets,
 		DNSCnameRecord: dnsRecordSets,
 		DNSMxRecord:    dnsRecordSets,
@@ -272,7 +272,7 @@ var (
 		// Private DNS
 		PrivateDNSZone:                   privateDNSZones,
 		PrivateDNSARecord:                privateDNSRecordSets,
-		PrivateDNSAaaRecord:              privateDNSRecordSets,
+		PrivateDNSAaaaRecord:             privateDNSRecordSets,
 		PrivateDNSCnameRecord:            privateDNSRecordSets,
 		PrivateDNSMxRecord:               privateDNSRecordSets,
 		PrivateDNSPtrRecord:              privateDNSRecordSets,
@@ -418,7 +418,7 @@ func virtualMachineScaleSets(ctx context.Context, a *azurerm, ar *AzureReader, r
 }
 
 func virtualMachineScaleSetExtensions(ctx context.Context, a *azurerm, ar *AzureReader, resourceType string, filters *filter.Filter) ([]provider.Resource, error) {
-	scaleSetNames, err := getVirtualMachineScaleSetNames(ctx, a, ar, resourceType, filters)
+	scaleSetNames, err := getVirtualMachineScaleSetNames(ctx, a, ar, []string{WindowsVirtualMachineScaleSet.String(), LinuxVirtualMachineScaleSet.String()}, filters)
 	if err != nil {
 		return nil, errors.Wrap(err, "unable to list virtual machines scale sets from reader")
 	}
@@ -450,7 +450,7 @@ func disks(ctx context.Context, a *azurerm, ar *AzureReader, resourceType string
 }
 
 func virtualMachineExtensions(ctx context.Context, a *azurerm, ar *AzureReader, resourceType string, filters *filter.Filter) ([]provider.Resource, error) {
-	virtualMachineNames, err := getVirtualMachineNames(ctx, a, ar, resourceType, filters)
+	virtualMachineNames, err := getVirtualMachineNames(ctx, a, ar, []string{VirtualMachine.String(), WindowsVirtualMachine.String(), LinuxVirtualMachine.String()}, filters)
 	if err != nil {
 		return nil, errors.Wrap(err, "unable to list virtual machines from reader")
 	}
@@ -515,7 +515,7 @@ func virtualNetworks(ctx context.Context, a *azurerm, ar *AzureReader, resourceT
 }
 
 func subnets(ctx context.Context, a *azurerm, ar *AzureReader, resourceType string, filters *filter.Filter) ([]provider.Resource, error) {
-	virtualNetworkNames, err := getVirtualNetworkNames(ctx, a, ar, resourceType, filters)
+	virtualNetworkNames, err := getVirtualNetworkNames(ctx, a, ar, VirtualNetwork.String(), filters)
 	if err != nil {
 		return nil, errors.Wrap(err, "unable to list virtual networks from cache")
 	}
@@ -656,7 +656,7 @@ func networkProfiles(ctx context.Context, a *azurerm, ar *AzureReader, resourceT
 }
 
 func networkSecurityRules(ctx context.Context, a *azurerm, ar *AzureReader, resourceType string, filters *filter.Filter) ([]provider.Resource, error) {
-	securityGroupNames, err := getSecurityGroups(ctx, a, ar, resourceType, filters)
+	securityGroupNames, err := getSecurityGroups(ctx, a, ar, NetworkSecurityGroup.String(), filters)
 	if err != nil {
 		return nil, errors.Wrap(err, "unable to list security Groups from cache")
 	}
@@ -719,7 +719,7 @@ func routeTables(ctx context.Context, a *azurerm, ar *AzureReader, resourceType
 }
 
 func routes(ctx context.Context, a *azurerm, ar *AzureReader, resourceType string, filters *filter.Filter) ([]provider.Resource, error) {
-	routeTablesNames, err := getRouteTables(ctx, a, ar, resourceType, filters)
+	routeTablesNames, err := getRouteTables(ctx, a, ar, RouteTable.String(), filters)
 	if err != nil {
 		return nil, errors.Wrap(err, "unable to list route Tables from cache")
 	}
@@ -764,7 +764,7 @@ func virtualNetworkGatewayConnections(ctx context.Context, a *azurerm, ar *Azure
 }
 
 func virtualNetworkPeerings(ctx context.Context, a *azurerm, ar *AzureReader, resourceType string, filters *filter.Filter) ([]provider.Resource, error) {
-	virtualNetworkNames, err := getVirtualNetworkNames(ctx, a, ar, resourceType, filters)
+	virtualNetworkNames, err := getVirtualNetworkNames(ctx, a, ar, VirtualN
```

**File**: `azurerm/resourcetype_enumer.go` (modified, +118/-118)
```diff
@@ -7,11 +7,11 @@ import (
 	"strings"
 )
 
-const _ResourceTypeName = "azurerm_resource_groupazurerm_virtual_machineazurerm_windows_virtual_machineazurerm_linux_virtual_machineazurerm_virtual_machine_extensionazurerm_windows_virtual_machine_scale_setazurerm_linux_virtual_machine_scale_setazurerm_virtual_machine_scale_set_extensionazurerm_virtual_networkazurerm_availability_setazurerm_managed_diskazurerm_imageazurerm_subnetazurerm_network_interfaceazurerm_network_security_groupazurerm_application_gatewayazurerm_application_security_groupazurerm_network_ddos_protection_planazurerm_firewallazurerm_local_network_gatewayazurerm_nat_gatewayazurerm_network_profileazurerm_network_security_ruleazurerm_public_ipazurerm_public_ip_prefixazurerm_routeazurerm_route_tableazurerm_virtual_network_gatewayazurerm_virtual_network_gateway_connectionazurerm_virtual_network_peeringazurerm_web_application_firewall_policyazurerm_virtual_hubazurerm_virtual_hub_bgp_connectionazurerm_virtual_hub_connectionazurerm_virtual_hub_ipazurerm_virtual_hub_route_tableazurerm_virtual_hub_security_partner_providerazurerm_lbazurerm_lb_backend_address_poolazurerm_lb_ruleazurerm_lb_outbound_ruleazurerm_lb_nat_ruleazurerm_lb_nat_poolazurerm_lb_probeazurerm_virtual_desktop_host_poolazurerm_virtual_desktop_application_groupazurerm_logic_app_workflowazurerm_logic_app_trigger_customazurerm_logic_app_action_customazurerm_container_registryazurerm_container_registry_webhookazurerm_kubernetes_clusterazurerm_kubernetes_cluster_node_poolazurerm_storage_accountazurerm_storage_queueazurerm_storage_shareazurerm_storage_tableazurerm_storage_blobazurerm_mariadb_configurationazurerm_mariadb_databaseazurerm_mariadb_firewall_ruleazurerm_mariadb_serverazurerm_mariadb_virtual_network_ruleazurerm_mysql_configurationazurerm_mysql_databaseazurerm_mysql_firewall_ruleazurerm_mysql_serverazurerm_mysql_virtual_network_ruleazurerm_postgresql_configurationazurerm_postgresql_databaseazurerm_postgresql_firewall_ruleazurerm_postgresql_serverazurerm_postgresql_virtual_network_ruleazurerm_mssql_elastic_poolazurerm_mssql_databaseazurerm_mssql_firewall_ruleazurerm_mssql_serverazurerm_mssql_server_security_alert_policyazurerm_mssql_server_vulnerability_assessmentazurerm_mssql_virtual_machineazurerm_mssql_virtual_network_ruleazurerm_redis_cacheazurerm_redis_firewall_ruleazurerm_dns_zoneazurerm_dns_a_recordazurerm_dns_aaa_recordazurerm_dns_caa_recordazurerm_dns_cname_recordazurerm_dns_mx_recordazurerm_dns_ns_recordazurerm_dns_ptr_recordazurerm_dns_srv_recordazurerm_dns_txt_recordazurerm_private_dns_zoneazurerm_private_dns_a_recordazurerm_private_dns_aaa_recordazurerm_private_dns_cname_recordazurerm_private_dns_mx_recordazurerm_private_dns_ptr_recordazurerm_private_dns_srv_recordazurerm_private_dns_txt_recordazurerm_private_dns_zone_virtual_network_linkazurerm_policy_definitionazurerm_policy_remediationazurerm_policy_set_definitionazurerm_key_vaultazurerm_key_vault_access_policyazurerm_application_insightsazurerm_application_insights_api_keyazurerm_application_insights_analytics_itemazurerm_log_analytics_workspaceazurerm_log_analytics_linked_serviceazurerm_log_analytics_datasource_windows_performance_counterazurerm_log_analytics_datasource_windows_eventazurerm_monitor_action_groupazurerm_monitor_activity_log_alertazurerm_monitor_autoscale_settingazurerm_monitor_log_profileazurerm_monitor_metric_alert"
+const _ResourceTypeName = "azurerm_resource_groupazurerm_virtual_machineazurerm_windows_virtual_machineazurerm_linux_virtual_machineazurerm_virtual_machine_extensionazurerm_windows_virtual_machine_scale_setazurerm_linux_virtual_machine_scale_setazurerm_virtual_machine_scale_set_extensionazurerm_virtual_networkazurerm_availability_setazurerm_managed_diskazurerm_imageazurerm_subnetazurerm_network_interfaceazurerm_network_security_groupazurerm_application_gatewayazurerm_application_security_groupazurerm_network_ddos_protection_planazurerm_firewallazurerm_local_network_gatewayazurerm_nat_gatewayazurerm_network_profileazurerm_network_security_ruleazurerm_public_ipazurerm_public_ip_prefixazurerm_routeazurerm_route_tableazurerm_virtual_network_gatewayazurerm_virtual_network_gateway_connectionazurerm_virtual_network_peeringazurerm_web_application_firewall_policyazurerm_virtual_hubazurerm_virtual_hub_bgp_connectionazurerm_virtual_hub_connectionazurerm_virtual_hub_ipazurerm_virtual_hub_route_tableazurerm_virtual_hub_security_partner_providerazurerm_lbazurerm_lb_backend_address_poolazurerm_lb_ruleazurerm_lb_outbound_ruleazurerm_lb_nat_ruleazurerm_lb_nat_poolazurerm_lb_probeazurerm_virtual_desktop_host_poolazurerm_virtual_desktop_application_groupazurerm_logic_app_workflowazurerm_logic_app_trigger_customazurerm_logic_app_action_customazurerm_container_registryazurerm_container_registry_webhookazurerm_kubernetes_clusterazurerm_kubernetes_cluster_node_poolazurerm_storage_accountazurerm_storage_queueazurerm_storage_shareazurerm_storage_tableazurerm_storage_blobazurerm_mariadb_configurationazurerm_mariadb
```

---

### Incident Patch 14: `af2e2542` (2022-05-26)
**Commit Message**: aws: Fixed issue with 'aws_lb_target_group_attachment' raising a panic

Now we validate alll the target values not just the target itself

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -6,6 +6,8 @@
   ([Issue #285](https://github.com/cycloidio/terracognita/issues/285))
 - Script to update providers now pushed the tag to the fork
   ([PR #294](https://github.com/cycloidio/terracognita/pull/294))
+- `aws_lb_target_group_attachment` was raising a nil pointer exception
+  ([Issue #297](https://github.com/cycloidio/terracognita/issues/297))
 
 ## [0.7.6] _2022-05-11_
 
```

**File**: `aws/resources.go` (modified, +1/-1)
```diff
@@ -492,7 +492,7 @@ func albTargetGroupAttachments(ctx context.Context, a *aws, resourceType string,
 		for _, t := range targetHealths {
 			// As this are the required values to get the resource
 			// we validate that they are present
-			if t.Target == nil || i.TargetGroupArn == nil {
+			if t.Target == nil || t.Target.Id == nil || t.Target.Port == nil || i.TargetGroupArn == nil {
 				continue
 			}
 			r, err := initializeResource(a, fmt.Sprintf("%s_%d_%s", *t.Target.Id, *t.Target.Port, *i.TargetGroupArn), resourceType)
```

---

### Incident Patch 15: `b8b70e3b` (2022-05-13)
**Commit Message**: Fixed the script to update providers

Was not pushing the tag to the fork, and now it does it.

Also updated the dependencies as we ran it

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -4,6 +4,8 @@
 
 - Repetitive blocks now have the proper variables within them
   ([Issue #285](https://github.com/cycloidio/terracognita/issues/285))
+- Script to update providers now pushed the tag to the fork
+  ([PR #294](https://github.com/cycloidio/terracognita/pull/294))
 
 ## [0.7.6] _2022-05-11_
 
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ Please see the following versions as follow:
 
 Providers:
  * AWS: v4.9.0
- * AzureRM: v3.3.0
+ * AzureRM: v3.6.0
  * Google: v4.9.0
 
 ## Installation
```

**File**: `go.mod` (modified, +11/-11)
```diff
@@ -3,8 +3,8 @@ module github.com/cycloidio/terracognita
 go 1.17
 
 require (
-	github.com/Azure/azure-sdk-for-go v63.0.0+incompatible
-	github.com/Azure/go-autorest/autorest v0.11.24
+	github.com/Azure/azure-sdk-for-go v64.0.0+incompatible
+	github.com/Azure/go-autorest/autorest v0.11.26
 	github.com/adrg/xdg v0.2.3
 	github.com/aws/aws-sdk-go v1.43.34
 	github.com/chr4/pwgen v1.1.0
@@ -13,7 +13,7 @@ require (
 	github.com/gertd/go-pluralize v0.1.7
 	github.com/go-kit/kit v0.9.0
 	github.com/golang/mock v1.6.0
-	github.com/hashicorp/go-azure-helpers v0.28.0
+	github.com/hashicorp/go-azure-helpers v0.30.0
 	github.com/hashicorp/go-cty v1.4.1-0.20200414143053-d3edf31b6320
 	github.com/hashicorp/hcl/v2 v2.11.1
 	github.com/hashicorp/terraform v0.13.0
@@ -41,7 +41,7 @@ require (
 	cloud.google.com/go/storage v1.16.0 // indirect
 	github.com/Azure/go-autorest v14.2.0+incompatible // indirect
 	github.com/Azure/go-autorest/autorest/adal v0.9.18 // indirect
-	github.com/Azure/go-autorest/autorest/azure/cli v0.4.4 // indirect
+	github.com/Azure/go-autorest/autorest/azure/cli v0.4.5 // indirect
 	github.com/Azure/go-autorest/autorest/date v0.3.0 // indirect
 	github.com/Azure/go-autorest/autorest/to v0.4.0 // indirect
 	github.com/Azure/go-autorest/autorest/validation v0.3.1 // indirect
@@ -87,7 +87,7 @@ require (
 	github.com/gammazero/workerpool v0.0.0-20181230203049-86a96b5d5d92 // indirect
 	github.com/go-logfmt/logfmt v0.4.0 // indirect
 	github.com/gofrs/uuid v4.0.0+incompatible // indirect
-	github.com/golang-jwt/jwt/v4 v4.2.0 // indirect
+	github.com/golang-jwt/jwt/v4 v4.4.1 // indirect
 	github.com/golang/glog v0.0.0-20160126235308-23def4e6c14b // indirect
 	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
 	github.com/golang/protobuf v1.5.2 // indirect
@@ -103,7 +103,7 @@ require (
 	github.com/hashicorp/errwrap v1.1.0 // indirect
 	github.com/hashicorp/go-checkpoint v0.5.0 // indirect
 	github.com/hashicorp/go-cleanhttp v0.5.2 // indirect
-	github.com/hashicorp/go-getter v1.5.9 // indirect
+	github.com/hashicorp/go-getter v1.5.11 // indirect
 	github.com/hashicorp/go-hclog v1.2.0 // indirect
 	github.com/hashicorp/go-multierror v1.1.1 // indirect
 	github.com/hashicorp/go-plugin v1.4.3 // indirect
@@ -151,7 +151,7 @@ require (
 	github.com/spf13/jwalterweatherman v1.0.0 // indirect
 	github.com/spf13/pflag v1.0.5 // indirect
 	github.com/subosito/gotenv v1.2.0 // indirect
-	github.com/tombuildsstuff/giovanni v0.19.0 // indirect
+	github.com/tombuildsstuff/giovanni v0.20.0 // indirect
 	github.com/ulikunitz/xz v0.5.10 // indirect
 	github.com/vmihailenco/msgpack v4.0.4+incompatible // indirect
 	github.com/vmihailenco/msgpack/v4 v4.3.12 // indirect
@@ -160,7 +160,7 @@ require (
 	github.com/xeipuuv/gojsonreference v0.0.0-20180127040603-bd5ef7bd5415 // indirect
 	github.com/xeipuuv/gojsonschema v1.2.0 // indirect
 	go.opencensus.io v0.23.0 // indirect
-	golang.org/x/crypto v0.0.0-20211215153901-e495a2d5b3d3 // indirect
+	golang.org/x/crypto v0.0.0-20220411220226-7b82a4e95df4 // indirect
 	golang.org/x/mod v0.6.0-dev.0.20220106191415-9b9b3d81d5e3 // indirect
 	golang.org/x/net v0.0.0-20220127200216-cd36cc0744dd // indirect
 	golang.org/x/oauth2 v0.0.0-20211104180415-d3ed0bb246c8 // indirect
@@ -182,10 +182,10 @@ replace github.com/hashicorp/aws-sdk-go-base v0.6.0 => github.com/hashicorp/aws-
 replace github.com/hashicorp/go-getter v1.5.0 => github.com/hashicorp/go-getter v1.4.0
 
 // Fork of Azurerm that has the V2 of the SDK
-replace github.com/hashicorp/terraform-provider-azurerm => github.com/cycloidio/terraform-provider-azurerm v1.44.1-0.20220426125937-56d09597e150
+replace github.com/hashicorp/terraform-provider-azurerm => github.com/cycloidio/terraform-provider-azurerm v1.44.1-0.20220513132617-918497152827
 
-replace github.com/hashicorp/terraform-provider-aws => github.com/cycloidio/terraform-provider-aws v1.60.1-0.20220426124252-d3fde830e186
+replace github.com/hashicorp/terraform-provider-aws => github.com/cycloidio/terraform-provider-aws v1.60.1-0.20220513132327-e2dbdf90e533
 
 replace github.com/hashicorp/terraform-provider-google => github.com/hashicorp/terraform-provider-google v1.20.1-0.20220201002249-bc5fcb3c89a5
 
-replace github.com/hashicorp/terraform => github.com/cycloidio/terraform v0.13.0-beta1.0.20220426144756-4d1a1a87fbf0
+replace github.com/hashicorp/terraform => github.com/cycloidio/terraform v1.1.9-cy
```

**File**: `go.sum` (modified, +24/-19)
```diff
@@ -63,8 +63,8 @@ github.com/Azure/azure-sdk-for-go v45.0.0+incompatible/go.mod h1:9XXNKU+eRnpl9mo
 github.com/Azure/azure-sdk-for-go v47.1.0+incompatible/go.mod h1:9XXNKU+eRnpl9moKnB4QOLf1HestfXbmab5FXxiDBjc=
 github.com/Azure/azure-sdk-for-go v56.0.0+incompatible/go.mod h1:9XXNKU+eRnpl9moKnB4QOLf1HestfXbmab5FXxiDBjc=
 github.com/Azure/azure-sdk-for-go v59.2.0+incompatible/go.mod h1:9XXNKU+eRnpl9moKnB4QOLf1HestfXbmab5FXxiDBjc=
-github.com/Azure/azure-sdk-for-go v63.0.0+incompatible h1:whPsa+jCHQSo5wGMPNLw4bz8q9Co2+vnXHzXGctoTaQ=
-github.com/Azure/azure-sdk-for-go v63.0.0+incompatible/go.mod h1:9XXNKU+eRnpl9moKnB4QOLf1HestfXbmab5FXxiDBjc=
+github.com/Azure/azure-sdk-for-go v64.0.0+incompatible h1:WAA77WBDWYtNfCC95V70VvkdzHe+wM/r2MQ9mG7fnQs=
+github.com/Azure/azure-sdk-for-go v64.0.0+incompatible/go.mod h1:9XXNKU+eRnpl9moKnB4QOLf1HestfXbmab5FXxiDBjc=
 github.com/Azure/go-autorest v14.2.0+incompatible h1:V5VMDjClD3GiElqLWO7mz2MxNAK/vTfRHdAubSIPRgs=
 github.com/Azure/go-autorest v14.2.0+incompatible/go.mod h1:r+4oMnoxhatjLLJ6zxSWATqVooLgysK6ZNox3g/xq24=
 github.com/Azure/go-autorest/autorest v0.11.3/go.mod h1:JFgpikqFJ/MleTTxwepExTKnFUKKszPS8UavbQYUMuw=
@@ -73,8 +73,9 @@ github.com/Azure/go-autorest/autorest v0.11.18/go.mod h1:dSiJPy22c3u0OtOKDNttNgq
 github.com/Azure/go-autorest/autorest v0.11.19/go.mod h1:dSiJPy22c3u0OtOKDNttNgqpNFY/GeWa7GH/Pz56QRA=
 github.com/Azure/go-autorest/autorest v0.11.21/go.mod h1:Do/yuMSW/13ayUkcVREpsMHGG+MvV81uzSCFgYPj4tM=
 github.com/Azure/go-autorest/autorest v0.11.22/go.mod h1:BAWYUWGPEtKPzjVkp0Q6an0MJcJDsoh5Z1BFAEFs4Xs=
-github.com/Azure/go-autorest/autorest v0.11.24 h1:1fIGgHKqVm54KIPT+q8Zmd1QlVsmHqeUGso5qm2BqqE=
 github.com/Azure/go-autorest/autorest v0.11.24/go.mod h1:G6kyRlFnTuSbEYkQGawPfsCswgme4iYf6rfSKUDzbCc=
+github.com/Azure/go-autorest/autorest v0.11.26 h1:W/MzvoAiFfL5h4nq81wm7axvITgbnOoifXXGkFrgF1g=
+github.com/Azure/go-autorest/autorest v0.11.26/go.mod h1:7l8ybrIdUmGqZMTD0sRtAr8NvbHjfofbf8RSP2q7w7U=
 github.com/Azure/go-autorest/autorest/adal v0.9.0/go.mod h1:/c022QCutn2P7uY+/oQWWNcK9YU+MH96NgK+jErpbcg=
 github.com/Azure/go-autorest/autorest/adal v0.9.5/go.mod h1:B7KF7jKIeC9Mct5spmyCB/A8CG/sEz1vwIRGv/bbw7A=
 github.com/Azure/go-autorest/autorest/adal v0.9.13/go.mod h1:W/MM4U6nLxnIskrw4UwWzlHfGjwUS50aOsc/I3yuU8M=
@@ -84,13 +85,15 @@ github.com/Azure/go-autorest/autorest/adal v0.9.18 h1:kLnPsRjzZZUF3K5REu/Kc+qMQr
 github.com/Azure/go-autorest/autorest/adal v0.9.18/go.mod h1:XVVeme+LZwABT8K5Lc3hA4nAe8LDBVle26gTrguhhPQ=
 github.com/Azure/go-autorest/autorest/azure/cli v0.4.0/go.mod h1:JljT387FplPzBA31vUcvsetLKF3pec5bdAxjVU4kI2s=
 github.com/Azure/go-autorest/autorest/azure/cli v0.4.2/go.mod h1:7qkJkT+j6b+hIpzMOwPChJhTqS8VbsqqgULzMNRugoM=
-github.com/Azure/go-autorest/autorest/azure/cli v0.4.4 h1:iuooz5cZL6VRcO7DVSFYxRcouqn6bFVE/e77Wts50Zk=
 github.com/Azure/go-autorest/autorest/azure/cli v0.4.4/go.mod h1:yAQ2b6eP/CmLPnmLvxtT1ALIY3OR1oFcCqVBi8vHiTc=
+github.com/Azure/go-autorest/autorest/azure/cli v0.4.5 h1:0W/yGmFdTIT77fvdlGZ0LMISoLHFJ7Tx4U0yeB+uFs4=
+github.com/Azure/go-autorest/autorest/azure/cli v0.4.5/go.mod h1:ADQAXrkgm7acgWVUNamOgh8YNrv4p27l3Wc55oVfpzg=
 github.com/Azure/go-autorest/autorest/date v0.3.0 h1:7gUk1U5M/CQbp9WoqinNzJar+8KY+LPI6wiWrP/myHw=
 github.com/Azure/go-autorest/autorest/date v0.3.0/go.mod h1:BI0uouVdmngYNUzGWeSYnokU+TrmwEsOqdt8Y6sso74=
 github.com/Azure/go-autorest/autorest/mocks v0.4.0/go.mod h1:LTp+uSrOhSkaKrUy935gNZuuIPPVsHlr9DSOxSayd+k=
-github.com/Azure/go-autorest/autorest/mocks v0.4.1 h1:K0laFcLE6VLTOwNgSxaGbUcLPuGXlNkbVvq4cW4nIHk=
 github.com/Azure/go-autorest/autorest/mocks v0.4.1/go.mod h1:LTp+uSrOhSkaKrUy935gNZuuIPPVsHlr9DSOxSayd+k=
+github.com/Azure/go-autorest/autorest/mocks v0.4.2 h1:PGN4EDXnuQbojHbU0UWoNvmu9AGVwYHG9/fkDYhtAfw=
+github.com/Azure/go-autorest/autorest/mocks v0.4.2/go.mod h1:Vy7OitM9Kei0i1Oj+LvyAWMXJHeKH1MVlzFugfVrmyU=
 github.com/Azure/go-autorest/autorest/to v0.4.0 h1:oXVqrxakqqV1UZdSazDOPOLvOIz+XA683u8EctwboHk=
 github.com/Azure/go-autorest/autorest/to v0.4.0/go.mod h1:fE8iZBn7LQR7zH/9XU2NcPR4o9jEImooCeWJcYV/zLE=
 github.com/Azure/go-autorest/autorest/validation v0.3.0/go.mod h1:yhLgjC0Wda5DYXl6JAsWyUe4KVNffhoDhG0zVzUMo3E=
@@ -296,12 +299,12 @@ github.com/creack/pty v1.1.9/go.mod h1:oKZEueFk5CKHvIhNR5MUki03XCEU+Q6VDXinZuGJ3
 github.com/creack/pty v1.1.11/go.mod h1:oKZEueFk5CKHvIhNR5MUki03XCEU+Q6VDXinZuGJ33E=
 github.com/cycloidio/mxwriter v1.0.4 h1:U1+9dasZLJUWiagf91zEU2i0nIeM45qrrqt6LiN/YRY=
 github.com/cycloidio/mxwriter v1.0.4/go.mod h1:yHFuNbzFz0DE9Jy9jiVhhlJ1HxxwiQO08m3L7sfcOFk=
-github.com/cycloidio/terraform v0.13.0-beta1.0.20220426144756-4d1a1a87fbf0 h1:jdw9KL3IS+KeqttV88/l150kC03RvoRwN72An8hFGOs=
-github.com/cycloidio/terraform v0.13.0-beta1.0.20220426144756-4d1a1a87fbf0/go.mod h1:NvfV/Nbb0ffQXcfxoTP1j1FNPS2cTCYE/FBtqRugazI=
-github.com/cycloidio/terraform-provider-aws v1.60.1-0.20220426124252-d3fde830e186 h1:GpoItW2wO5uGu+SKw8wpEEA6gW3jvErmcGxzEI1CXPI=
-github.com/cycloidio/terraform-provider-aws v1.60.1-
```

**File**: `scripts/terraform-provider-update/update.sh` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ move_out_internal() {
 
   # create a tag to help following releases
   git tag -f ${TAG}-cy
-  git push --tags
+  git push -f origin ${TAG}-cy
 
   # Push the updated code to cycloid repo
   git push -f origin cy-${TAG}
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

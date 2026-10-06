# Forensic Learning Record (Deep Inspection): camptocamp/terraboard

> **Canonical Artifact**: `07_PROJECT_LEARNING/camptocamp-terraboard-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/camptocamp/terraboard](https://github.com/camptocamp/terraboard))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:27:03.424Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `camptocamp/terraboard`
- **Description**: :earth_africa: :clipboard:  A web dashboard to inspect Terraform States 
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2009 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/terraform/configs/util.go`
```
package configs

import (
	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/hclsyntax"
)

// exprIsNativeQuotedString determines whether the given expression looks like
// it's a quoted string in the HCL native syntax.
//
// This should be used sparingly only for situations where our legacy HCL
// decoding would've expected a keyword or reference in quotes but our new
// decoding expects the keyword or reference to be provided directly as
// an identifier-based expression.
func exprIsNativeQuotedString(expr hcl.Expression) bool {
	_, ok := expr.(*hclsyntax.TemplateExpr)
	return ok
}

// schemaForOverrides takes a *hcl.BodySchema and produces a new one that is
// equivalent except that any required attributes are forced to not be required.
//
// This is useful for dealing with "override" config files, which are allowed
// to omit things that they don't wish to override from the main configuration.
//
// The returned schema may have some pointers in common with the given schema,
// so neither the given schema nor the returned schema should be modified after
// using this function in order to avoid confusion.
//
// Overrides are rarely used, so it's recommended to just create the override
// schema on the fly only when it's needed, rather than storing it in a global
// variable as we tend to do for a primary schema.
func schemaForOverrides(schema *hcl.BodySchema) *hcl.BodySchema {
	ret := &hcl.BodySchema{
		Attributes: make([]hcl.AttributeSchema, len(schema.Attributes)),
		Blocks:     schema.Blocks,
	}

	for i, attrS := range schema.Attributes {
		ret.Attributes[i] = attrS
		ret.Attributes[i].Required = false
	}

	return ret
}

// schemaWithDynamic takes a *hcl.BodySchema and produces a new one that
// is equivalent except that it accepts an additional block type "dynamic" with
// a single label, used to recognize usage of the HCL dynamic block extension.
func schemaWithDynamic(schema *hcl.BodySchema) *hcl.BodySchema {
	ret := &hcl.BodySchema{
		Attributes: schema.Attributes,
		Blocks:     make([]hcl.BlockHeaderSchema, len(schema.Blocks), len(schema.Blocks)+1),
	}

	copy(ret.Blocks, schema.Blocks)
	ret.Blocks = append(ret.Blocks, hcl.BlockHeaderSchema{
		Type:       "dynamic",
		LabelNames: []string{"type"},
	})

	return ret
}

```

### Core Architecture Module: `internal/terraform/states/doc.go`
```
// Package states contains the types that are used to represent Terraform
// states.
package states

```

### Core Architecture Module: `internal/terraform/states/instance_generation.go`
```
package states

// Generation is used to represent multiple objects in a succession of objects
// represented by a single resource instance address. A resource instance can
// have multiple generations over its lifetime due to object replacement
// (when a change can't be applied without destroying and re-creating), and
// multiple generations can exist at the same time when create_before_destroy
// is used.
//
// A Generation value can either be the value of the variable "CurrentGen" or
// a value of type DeposedKey. Generation values can be compared for equality
// using "==" and used as map keys. The zero value of Generation (nil) is not
// a valid generation and must not be used.
type Generation interface {
	generation()
}

// CurrentGen is the Generation representing the currently-active object for
// a resource instance.
var CurrentGen Generation

```

### Core Architecture Module: `internal/terraform/states/instance_object.go`
```
package states

import (
	"sort"

	"github.com/zclconf/go-cty/cty"
	ctyjson "github.com/zclconf/go-cty/cty/json"

	"github.com/camptocamp/terraboard/internal/terraform/addrs"
)

// ResourceInstanceObject is the local representation of a specific remote
// object associated with a resource instance. In practice not all remote
// objects are actually remote in the sense of being accessed over the network,
// but this is the most common case.
//
// It is not valid to mutate a ResourceInstanceObject once it has been created.
// Instead, create a new object and replace the existing one.
type ResourceInstanceObject struct {
	// Value is the object-typed value representing the remote object within
	// Terraform.
	Value cty.Value

	// Private is an opaque value set by the provider when this object was
	// last created or updated. Terraform Core does not use this value in
	// any way and it is not exposed anywhere in the user interface, so
	// a provider can use it for retaining any necessary private state.
	Private []byte

	// Status represents the "readiness" of the object as of the last time
	// it was updated.
	Status ObjectStatus

	// Dependencies is a set of absolute address to other resources this
	// instance dependeded on when it was applied. This is used to construct
	// the dependency relationships for an object whose configuration is no
	// longer available, such as if it has been removed from configuration
	// altogether, or is now deposed.
	Dependencies []addrs.ConfigResource

	// CreateBeforeDestroy reflects the status of the lifecycle
	// create_before_destroy option when this instance was last updated.
	// Because create_before_destroy also effects the overall ordering of the
	// destroy operations, we need to record the status to ensure a resource
	// removed from the config will still be destroyed in the same manner.
	CreateBeforeDestroy bool
}

// ObjectStatus represents the status of a RemoteObject.
type ObjectStatus rune

//go:generate go run golang.org/x/tools/cmd/stringer -type ObjectStatus

const (
	// ObjectReady is an object status for an object that is ready to use.
	ObjectReady ObjectStatus = 'R'

	// ObjectTainted is an object status representing an object that is in
	// an unrecoverable bad state due to a partial failure during a create,
	// update, or delete operation. Since it cannot be moved into the
	// ObjectRead state, a tainted object must be replaced.
	ObjectTainted ObjectStatus = 'T'

	// ObjectPlanned is a special object status used only for the transient
	// placeholder objects we place into state during the refresh and plan
	// walks to stand in for objects that will be created during apply.
	//
	// Any object of this status must have a corresponding change recorded
	// in the current plan, whose value must then be used in preference to
	// the value stored in state when evaluating expressions. A planned
	// object stored in state will be incomplete if any of its attributes are
	// not yet known, and the plan must be consulted in order to "see" those
	// unknown values, because the state is not able to represent them.
	ObjectPlanned ObjectStatus = 'P'
)

// Encode marshals the value within the receiver to produce a
// ResourceInstanceObjectSrc ready to be written to a state file.
//
// The given type must be the implied type of the resource type schema, and
// the given value must conform to it. It is important to pass the schema
// type and not the object's own type so that dynamically-typed attributes
// will be stored correctly. The caller must also provide the version number
// of the schema that the given type was derived from, which will be recorded
// in the source object so it can be used to detect when schema migration is
// required on read.
//
// The returned object may share internal references with the receiver and
// so the caller must not mutate the receiver any further once once this
// method is called.
func (o *ResourceInstanceObject) Encode(ty cty.Type, schemaVersion uint64) (*ResourceInstanceObjectSrc, error) {
	// If it contains marks, remove these marks before traversing the
	// structure with UnknownAsNull, and save the PathValueMarks
	// so we can save them in state.
	val, pvm := o.Value.UnmarkDeepWithPaths()

	// Our state serialization can't represent unknown values, so we convert
	// them to nulls here. This is lossy, but nobody should be writing unknown
	// values here and expecting to get them out again later.
	//
	// We get unknown values here while we're building out a "planned state"
	// during the plan phase, but the value stored in the plan takes precedence
	// for expression evaluation. The apply step should never produce unknown
	// values, but if it does it's the responsibility of the caller to detect
	// and raise an error about that.
	val = cty.UnknownAsNull(val)

	src, err := ctyjson.Marshal(val, ty)
	if err != nil {
		return nil, err
	}

	// Dependencies are collected and merged in an unordered format (using map
	// keys as a set), then later changed to a slice (in random ordering) to be
	// stored in state as an array. To avoid pointless thrashing of state in
	// refresh-only runs, we can either override comparison of dependency lists
	// (more desirable, but tricky for Reasons) or just sort when encoding.
	// Encoding of instances can happen concurrently, so we must copy the
	// dependencies to avoid mutating what may be a shared array of values.
	dependencies := make([]addrs.ConfigResource, len(o.Dependencies))
	copy(dependencies, o.Dependencies)

	sort.Slice(dependencies, func(i, j int) bool { return dependencies[i].String() < dependencies[j].String() })

	return &ResourceInstanceObjectSrc{
		SchemaVersion:       schemaVersion,
		AttrsJSON:           src,
		AttrSensitivePaths:  pvm,
		Private:             o.Private,
		Status:              o.Status,
		Dependencies:        dependencies,
		CreateBeforeDestroy: o.CreateBeforeDestroy,
	}, nil
}

// AsTainted returns a deep copy of the receiver with the status updated to
// ObjectTainted.
func (o *ResourceInstanceObject) AsTainted() *ResourceInstanceObject {
	if o == nil {
		// A nil object can't be tainted, but we'll allow this anyway to
		// avoid a crash, since we presumably intend to eventually record
		// the object has having been deleted anyway.
		return nil
	}
	ret := o.DeepCopy()
	ret.Status = ObjectTainted
	return ret
}

```

### Core Architecture Module: `internal/terraform/states/instance_object_src.go`
```
package states

import (
	"github.com/zclconf/go-cty/cty"
	ctyjson "github.com/zclconf/go-cty/cty/json"

	"github.com/camptocamp/terraboard/internal/terraform/addrs"
	"github.com/camptocamp/terraboard/internal/terraform/configs/hcl2shim"
)

// ResourceInstanceObjectSrc is a not-fully-decoded version of
// ResourceInstanceObject. Decoding of it can be completed by first handling
// any schema migration steps to get to the latest schema version and then
// calling method Decode with the implied type of the latest schema.
type ResourceInstanceObjectSrc struct {
	// SchemaVersion is the resource-type-specific schema version number that
	// was current when either AttrsJSON or AttrsFlat was encoded. Migration
	// steps are required if this is less than the current version number
	// reported by the corresponding provider.
	SchemaVersion uint64

	// AttrsJSON is a JSON-encoded representation of the object attributes,
	// encoding the value (of the object type implied by the associated resource
	// type schema) that represents this remote object in Terraform Language
	// expressions, and is compared with configuration when producing a diff.
	//
	// This is retained in JSON format here because it may require preprocessing
	// before decoding if, for example, the stored attributes are for an older
	// schema version which the provider must upgrade before use. If the
	// version is current, it is valid to simply decode this using the
	// type implied by the current schema, without the need for the provider
	// to perform an upgrade first.
	//
	// When writing a ResourceInstanceObject into the state, AttrsJSON should
	// always be conformant to the current schema version and the current
	// schema version should be recorded in the SchemaVersion field.
	AttrsJSON []byte

	// AttrsFlat is a legacy form of attributes used in older state file
	// formats, and in the new state format for objects that haven't yet been
	// upgraded. This attribute is mutually exclusive with Attrs: for any
	// ResourceInstanceObject, only one of these attributes may be populated
	// and the other must be nil.
	//
	// An instance object with this field populated should be upgraded to use
	// Attrs at the earliest opportunity, since this legacy flatmap-based
	// format will be phased out over time. AttrsFlat should not be used when
	// writing new or updated objects to state; instead, callers must follow
	// the recommendations in the AttrsJSON documentation above.
	AttrsFlat map[string]string

	// AttrSensitivePaths is an array of paths to mark as sensitive coming out of
	// state, or to save as sensitive paths when saving state
	AttrSensitivePaths []cty.PathValueMarks

	// These fields all correspond to the fields of the same name on
	// ResourceInstanceObject.
	Private             []byte
	Status              ObjectStatus
	Dependencies        []addrs.ConfigResource
	CreateBeforeDestroy bool
}

// Decode unmarshals the raw representation of the object attributes. Pass the
// implied type of the corresponding resource type schema for correct operation.
//
// Before calling Decode, the caller must check that the SchemaVersion field
// exactly equals the version number of the schema whose implied type is being
// passed, or else the result is undefined.
//
// The returned object may share internal references with the receiver and
// so the caller must not mutate the receiver any further once once this
// method is called.
func (os *ResourceInstanceObjectSrc) Decode(ty cty.Type) (*ResourceInstanceObject, error) {
	var val cty.Value
	var err error
	if os.AttrsFlat != nil {
		// Legacy mode. We'll do our best to unpick this from the flatmap.
		val, err = hcl2shim.HCL2ValueFromFlatmap(os.AttrsFlat, ty)
		if err != nil {
			return nil, err
		}
	} else {
		val, err = ctyjson.Unmarshal(os.AttrsJSON, ty)
		// Mark the value with paths if applicable
		if os.AttrSensitivePaths != nil {
			val = val.MarkWithPaths(os.AttrSensitivePaths)
		}
		if err != nil {
			return nil, err
		}
	}

	return &ResourceInstanceObject{
		Value:               val,
		Status:              os.Status,
		Dependencies:        os.Dependencies,
		Private:             os.Private,
		CreateBeforeDestroy: os.CreateBeforeDestroy,
	}, nil
}

// CompleteUpgrade creates a new ResourceInstanceObjectSrc by copying the
// metadata from the receiver and writing in the given new schema version
// and attribute value that are presumed to have resulted from upgrading
// from an older schema version.
func (os *ResourceInstanceObjectSrc) CompleteUpgrade(newAttrs cty.Value, newType cty.Type, newSchemaVersion uint64) (*ResourceInstanceObjectSrc, error) {
	new := os.DeepCopy()
	new.AttrsFlat = nil // We always use JSON after an upgrade, even if the source used flatmap

	// This is the same principle as ResourceInstanceObject.Encode, but
	// avoiding a decode/re-encode cycle because we don't have type info
	// available for the "old" attributes.
	newAttrs = cty.UnknownAsNull(newAttrs)
	src, err := ctyjson.Marshal(newAttrs, newType)
	if err != nil {
		return nil, err
	}

	new.AttrsJSON = src
	new.SchemaVersion = newSchemaVersion
	return new, nil
}

```

### Core Architecture Module: `internal/terraform/states/module.go`
```
package states

import (
	"github.com/zclconf/go-cty/cty"

	"github.com/camptocamp/terraboard/internal/terraform/addrs"
)

// Module is a container for the states of objects within a particular module.
type Module struct {
	Addr addrs.ModuleInstance

	// Resources contains the state for each resource. The keys in this map are
	// an implementation detail and must not be used by outside callers.
	Resources map[string]*Resource

	// OutputValues contains the state for each output value. The keys in this
	// map are output value names.
	OutputValues map[string]*OutputValue

	// LocalValues contains the value for each named output value. The keys
	// in this map are local value names.
	LocalValues map[string]cty.Value
}

// NewModule constructs an empty module state for the given module address.
func NewModule(addr addrs.ModuleInstance) *Module {
	return &Module{
		Addr:         addr,
		Resources:    map[string]*Resource{},
		OutputValues: map[string]*OutputValue{},
		LocalValues:  map[string]cty.Value{},
	}
}

// Resource returns the state for the resource with the given address within
// the receiving module state, or nil if the requested resource is not tracked
// in the state.
func (ms *Module) Resource(addr addrs.Resource) *Resource {
	return ms.Resources[addr.String()]
}

// ResourceInstance returns the state for the resource instance with the given
// address within the receiving module state, or nil if the requested instance
// is not tracked in the state.
func (ms *Module) ResourceInstance(addr addrs.ResourceInstance) *ResourceInstance {
	rs := ms.Resource(addr.Resource)
	if rs == nil {
		return nil
	}
	return rs.Instance(addr.Key)
}

// SetResourceProvider updates the resource-level metadata for the resource
// with the given address, creating the resource state for it if it doesn't
// already exist.
func (ms *Module) SetResourceProvider(addr addrs.Resource, provider addrs.AbsProviderConfig) {
	rs := ms.Resource(addr)
	if rs == nil {
		rs = &Resource{
			Addr:      addr.Absolute(ms.Addr),
			Instances: map[addrs.InstanceKey]*ResourceInstance{},
		}
		ms.Resources[addr.String()] = rs
	}

	rs.ProviderConfig = provider
}

// RemoveResource removes the entire state for the given resource, taking with
// it any instances associated with the resource. This should generally be
// called only for resource objects whose instances have all been destroyed.
func (ms *Module) RemoveResource(addr addrs.Resource) {
	delete(ms.Resources, addr.String())
}

// SetResourceInstanceCurrent saves the given instance object as the current
// generation of the resource instance with the given address, simultaneously
// updating the recorded provider configuration address and dependencies.
//
// Any existing current instance object for the given resource is overwritten.
// Set obj to nil to remove the primary generation object altogether. If there
// are no deposed objects then the instance will be removed altogether.
//
// The provider address is a resource-wide setting and is updated for all other
// instances of the same resource as a side-effect of this call.
func (ms *Module) SetResourceInstanceCurrent(addr addrs.ResourceInstance, obj *ResourceInstanceObjectSrc, provider addrs.AbsProviderConfig) {
	rs := ms.Resource(addr.Resource)
	// if the resource is nil and the object is nil, don't do anything!
	// you'll probably just cause issues
	if obj == nil && rs == nil {
		return
	}
	if obj == nil && rs != nil {
		// does the resource have any other objects?
		// if not then delete the whole resource
		if len(rs.Instances) == 0 {
			delete(ms.Resources, addr.Resource.String())
			return
		}
		// check for an existing resource, now that we've ensured that rs.Instances is more than 0/not nil
		is := rs.Instance(addr.Key)
		if is == nil {
			// if there is no instance on the resource with this address and obj is nil, return and change nothing
			return
		}
		// if we have an instance, update the current
		is.Current = obj
		if !is.HasObjects() {
			// If we have no objects at all then we'll clean up.
			delete(rs.Instances, addr.Key)
			// Delete the resource if it has no instances, but only if NoEach
			if len(rs.Instances) == 0 {
				delete(ms.Resources, addr.Resource.String())
				return
			}
		}
		// Nothing more to do here, so return!
		return
	}
	if rs == nil && obj != nil {
		// We don't have have a resource so make one, which is a side effect of setResourceMeta
		ms.SetResourceProvider(addr.Resource, provider)
		// now we have a resource! so update the rs value to point to it
		rs = ms.Resource(addr.Resource)
	}
	// Get our instance from the resource; it could be there or not at this point
	is := rs.Instance(addr.Key)
	if is == nil {
		// if we don't have a resource, create one and add to the instances
		is = rs.CreateInstance(addr.Key)
		// update the resource meta because we have a new
		ms.SetResourceProvider(addr.Resource, provider)
	}
	// Update the resource's ProviderConfig, in case the provider has updated
	rs.ProviderConfig = provider
	is.Current = obj
}

// SetResourceInstanceDeposed saves the given instance object as a deposed
// generation of the resource instance with the given address and deposed key.
//
// Call this method only for pre-existing deposed objects that already have
// a known DeposedKey. For example, this method is useful if reloading objects
// that were persisted to a state file. To mark the current object as deposed,
// use DeposeResourceInstanceObject instead.
//
// The resource that contains the given instance must already exist in the
// state, or this method will panic. Use Resource to check first if its
// presence is not already guaranteed.
//
// Any existing current instance object for the given resource and deposed key
// is overwritten. Set obj to nil to remove the deposed object altogether. If
// the instance is left with no objects after this operation then it will
// be removed from its containing resource altogether.
func (ms *Module) SetResourceInstanceDeposed(addr addrs.ResourceInstance, key DeposedKey, obj *ResourceInstanceObjectSrc, provider addrs.AbsProviderConfig) {
	ms.SetResourceProvider(addr.Resource, provider)

	rs := ms.Resource(addr.Resource)
	is := rs.EnsureInstance(addr.Key)
	if obj != nil {
		is.Deposed[key] = obj
	} else {
		delete(is.Deposed, key)
	}

	if !is.HasObjects() {
		// If we have no objects at all then we'll clean up.
		delete(rs.Instances, addr.Key)
	}
	if len(rs.Instances) == 0 {
		// Also clean up if we only expect to have one instance anyway
		// and there are none. We leave the resource behind if an each mode
		// is active because an empty list or map of instances is a valid state.
		delete(ms.Resources, addr.Resource.String())
	}
}

// ForgetResourceInstanceAll removes the record of all objects associated with
// the specified resource instance, if present. If not present, this is a no-op.
func (ms *Module) ForgetResourceInstanceAll(addr addrs.ResourceInstance) {
	rs := ms.Resource(addr.Resource)
	if rs == nil {
		return
	}
	delete(rs.Instances, addr.Key)

	if len(rs.Instances) == 0 {
		// Also clean up if we only expect to have one instance anyway
		// and there are none. We leave the resource behind if an each mode
		// is active because an empty list or map of instances is a valid state.
		delete(ms.Resources, addr.Resource.String())
	}
}

// ForgetResourceInstanceDeposed removes the record of the deposed object with
// the given address and key, if present. If not present, this is a no-op.
func (ms *Module) ForgetResourceInstanceDeposed(addr addrs.ResourceInstance, key DeposedKey) {
	rs := ms.Resource(addr.Resource)
	if rs == nil {
		return
	}
	is := rs.Instance(addr.Key)
	if is == nil {
		return
	}
	delete(is.Deposed, key)

	if !is.HasObjects() {
		// If we have no objects at all then we'll clean up.
		delete(rs.Instances, addr.Key)
	}
	if len(rs.Instances) == 0 {
		// Also clean up if we only expect to have one instance anyway
		// and there are none. We leave the resource behind if an each mode
		// is active because an empty list or map of instances is a valid state.
		delete(ms.Resources, addr.Resource.String())
	}
}

// deposeResourceInstanceObject is the real implementation of
// SyncState.DeposeResourceInstanceObject.
func (ms *Module) deposeResourceInstanceObject(addr addrs.ResourceInstance, forceKey DeposedKey) DeposedKey {
	is := ms.ResourceInstance(addr)
	if is == nil {
		return NotDeposed
	}
	return is.deposeCurrentObject(forceKey)
}

// maybeRestoreResourceInstanceDeposed is the real implementation of
// SyncState.MaybeRestoreResourceInstanceDeposed.
func (ms *Module) maybeRestoreResourceInstanceDeposed(addr addrs.ResourceInstance, key DeposedKey) bool {
	rs := ms.Resource(addr.Resource)
	if rs == nil {
		return false
	}
	is := rs.Instance(addr.Key)
	if is == nil {
		return false
	}
	if is.Current != nil {
		return false
	}
	if len(is.Deposed) == 0 {
		return false
	}
	is.Current = is.Deposed[key]
	delete(is.Deposed, key)
	return true
}

// SetOutputValue writes an output value into the state, overwriting any
// existing value of the same name.
func (ms *Module) SetOutputValue(name string, value cty.Value, sensitive bool) *OutputValue {
	os := &OutputValue{
		Addr: addrs.AbsOutputValue{
			Module: ms.Addr,
			OutputValue: addrs.OutputValue{
				Name: name,
			},
		},
		Value:     value,
		Sensitive: sensitive,
	}
	ms.OutputValues[name] = os
	return os
}

// RemoveOutputValue removes the output value of the given name from the state,
// if it exists. This method is a no-op if there is no value of the given
// name.
func (ms *Module) RemoveOutputValue(name string) {
	delete(ms.OutputValues, name)
}

// SetLocalValue writes a local value into the state, overwriting any
// existing value of the same name.
func (ms *Module) SetLocalValue(name string, value cty.Value) {
	ms.LocalValues[name] = value
}

// RemoveLocalValue removes the local value of the given name from the state,
// if it exists. This method is a no-op if there is no valu
```

### Core Architecture Module: `internal/terraform/states/objectstatus_string.go`
```
// Code generated by "stringer -type ObjectStatus"; DO NOT EDIT.

package states

import "strconv"

func _() {
	// An "invalid array index" compiler error signifies that the constant values have changed.
	// Re-run the stringer command to generate them again.
	var x [1]struct{}
	_ = x[ObjectReady-82]
	_ = x[ObjectTainted-84]
	_ = x[ObjectPlanned-80]
}

const (
	_ObjectStatus_name_0 = "ObjectPlanned"
	_ObjectStatus_name_1 = "ObjectReady"
	_ObjectStatus_name_2 = "ObjectTainted"
)

func (i ObjectStatus) String() string {
	switch {
	case i == 80:
		return _ObjectStatus_name_0
	case i == 82:
		return _ObjectStatus_name_1
	case i == 84:
		return _ObjectStatus_name_2
	default:
		return "ObjectStatus(" + strconv.FormatInt(int64(i), 10) + ")"
	}
}

```

### Core Architecture Module: `internal/terraform/states/output_value.go`
```
package states

import (
	"github.com/camptocamp/terraboard/internal/terraform/addrs"
	"github.com/zclconf/go-cty/cty"
)

// OutputValue represents the state of a particular output value.
//
// It is not valid to mutate an OutputValue object once it has been created.
// Instead, create an entirely new OutputValue to replace the previous one.
type OutputValue struct {
	Addr      addrs.AbsOutputValue
	Value     cty.Value
	Sensitive bool
}

```

### Core Architecture Module: `internal/terraform/states/remote/remote.go`
```
package remote

import (
	"github.com/camptocamp/terraboard/internal/terraform/states/statemgr"
)

// Client is the interface that must be implemented for a remote state
// driver. It supports dumb put/get/delete, and the higher level structs
// handle persisting the state properly here.
type Client interface {
	Get() (*Payload, error)
	Put([]byte) error
	Delete() error
}

// ClientForcePusher is an optional interface that allows a remote
// state to force push by managing a flag on the client that is
// toggled on by a call to EnableForcePush.
type ClientForcePusher interface {
	Client
	EnableForcePush()
}

// ClientLocker is an optional interface that allows a remote state
// backend to enable state lock/unlock.
type ClientLocker interface {
	Client
	statemgr.Locker
}

// Payload is the return value from the remote state storage.
type Payload struct {
	MD5  []byte
	Data []byte
}

// Factory is the factory function to create a remote client.
type Factory func(map[string]string) (Client, error)

```

### Core Architecture Module: `internal/terraform/states/remote/state.go`
```
package remote

import (
	"bytes"
	"fmt"
	"sync"

	"github.com/camptocamp/terraboard/internal/terraform/states"
	"github.com/camptocamp/terraboard/internal/terraform/states/statefile"
	"github.com/camptocamp/terraboard/internal/terraform/states/statemgr"
	uuid "github.com/hashicorp/go-uuid"
)

// State implements the State interfaces in the state package to handle
// reading and writing the remote state. This State on its own does no
// local caching so every persist will go to the remote storage and local
// writes will go to memory.
type State struct {
	mu sync.Mutex

	Client Client

	// We track two pieces of meta data in addition to the state itself:
	//
	// lineage - the state's unique ID
	// serial  - the monotonic counter of "versions" of the state
	//
	// Both of these (along with state) have a sister field
	// that represents the values read in from an existing source.
	// All three of these values are used to determine if the new
	// state has changed from an existing state we read in.
	lineage, readLineage string
	serial, readSerial   uint64
	state, readState     *states.State
	disableLocks         bool
}

var _ statemgr.Full = (*State)(nil)
var _ statemgr.Migrator = (*State)(nil)

// statemgr.Reader impl.
func (s *State) State() *states.State {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.state.DeepCopy()
}

// StateForMigration is part of our implementation of statemgr.Migrator.
func (s *State) StateForMigration() *statefile.File {
	s.mu.Lock()
	defer s.mu.Unlock()

	return statefile.New(s.state.DeepCopy(), s.lineage, s.serial)
}

// statemgr.Writer impl.
func (s *State) WriteState(state *states.State) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// We create a deep copy of the state here, because the caller also has
	// a reference to the given object and can potentially go on to mutate
	// it after we return, but we want the snapshot at this point in time.
	s.state = state.DeepCopy()

	return nil
}

// WriteStateForMigration is part of our implementation of statemgr.Migrator.
func (s *State) WriteStateForMigration(f *statefile.File, force bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !force {
		checkFile := statefile.New(s.state, s.lineage, s.serial)
		if err := statemgr.CheckValidImport(f, checkFile); err != nil {
			return err
		}
	}

	// The remote backend needs to pass the `force` flag through to its client.
	// For backends that support such operations, inform the client
	// that a force push has been requested
	c, isForcePusher := s.Client.(ClientForcePusher)
	if force && isForcePusher {
		c.EnableForcePush()
	}

	// We create a deep copy of the state here, because the caller also has
	// a reference to the given object and can potentially go on to mutate
	// it after we return, but we want the snapshot at this point in time.
	s.state = f.State.DeepCopy()
	s.lineage = f.Lineage
	s.serial = f.Serial

	return nil
}

// statemgr.Refresher impl.
func (s *State) RefreshState() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.refreshState()
}

// refreshState is the main implementation of RefreshState, but split out so
// that we can make internal calls to it from methods that are already holding
// the s.mu lock.
func (s *State) refreshState() error {
	payload, err := s.Client.Get()
	if err != nil {
		return err
	}

	// no remote state is OK
	if payload == nil {
		s.readState = nil
		s.lineage = ""
		s.serial = 0
		return nil
	}

	stateFile, err := statefile.Read(bytes.NewReader(payload.Data))
	if err != nil {
		return err
	}

	s.lineage = stateFile.Lineage
	s.serial = stateFile.Serial
	s.state = stateFile.State

	// Properties from the remote must be separate so we can
	// track changes as lineage, serial and/or state are mutated
	s.readLineage = stateFile.Lineage
	s.readSerial = stateFile.Serial
	s.readState = s.state.DeepCopy()
	return nil
}

// statemgr.Persister impl.
func (s *State) PersistState() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.readState != nil {
		lineageUnchanged := s.readLineage != "" && s.lineage == s.readLineage
		serialUnchanged := s.readSerial != 0 && s.serial == s.readSerial
		stateUnchanged := statefile.StatesMarshalEqual(s.state, s.readState)
		if stateUnchanged && lineageUnchanged && serialUnchanged {
			// If the state, lineage or serial haven't changed at all then we have nothing to do.
			return nil
		}
		s.serial++
	} else {
		// We might be writing a new state altogether, but before we do that
		// we'll check to make sure there isn't already a snapshot present
		// that we ought to be updating.
		err := s.refreshState()
		if err != nil {
			return fmt.Errorf("failed checking for existing remote state: %s", err)
		}
		if s.lineage == "" { // indicates that no state snapshot is present yet
			lineage, err := uuid.GenerateUUID()
			if err != nil {
				return fmt.Errorf("failed to generate initial lineage: %v", err)
			}
			s.lineage = lineage
			s.serial = 0
		}
	}

	f := statefile.New(s.state, s.lineage, s.serial)

	var buf bytes.Buffer
	err := statefile.Write(f, &buf)
	if err != nil {
		return err
	}

	err = s.Client.Put(buf.Bytes())
	if err != nil {
		return err
	}

	// After we've successfully persisted, what we just wrote is our new
	// reference state until someone calls RefreshState again.
	// We've potentially overwritten (via force) the state, lineage
	// and / or serial (and serial was incremented) so we copy over all
	// three fields so everything matches the new state and a subsequent
	// operation would correctly detect no changes to the lineage, serial or state.
	s.readState = s.state.DeepCopy()
	s.readLineage = s.lineage
	s.readSerial = s.serial
	return nil
}

// Lock calls the Client's Lock method if it's implemented.
func (s *State) Lock(info *statemgr.LockInfo) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.disableLocks {
		return "", nil
	}

	if c, ok := s.Client.(ClientLocker); ok {
		return c.Lock(info)
	}
	return "", nil
}

// Unlock calls the Client's Unlock method if it's implemented.
func (s *State) Unlock(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.disableLocks {
		return nil
	}

	if c, ok := s.Client.(ClientLocker); ok {
		return c.Unlock(id)
	}
	return nil
}

// DisableLocks turns the Lock and Unlock methods into no-ops. This is intended
// to be called during initialization of a state manager and should not be
// called after any of the statemgr.Full interface methods have been called.
func (s *State) DisableLocks() {
	s.disableLocks = true
}

// StateSnapshotMeta returns the metadata from the most recently persisted
// or refreshed persistent state snapshot.
//
// This is an implementation of statemgr.PersistentMeta.
func (s *State) StateSnapshotMeta() statemgr.SnapshotMeta {
	return statemgr.SnapshotMeta{
		Lineage: s.lineage,
		Serial:  s.serial,
	}
}

```

### Core Architecture Module: `internal/terraform/states/resource.go`
```
package states

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/camptocamp/terraboard/internal/terraform/addrs"
)

// Resource represents the state of a resource.
type Resource struct {
	// Addr is the absolute address for the resource this state object
	// belongs to.
	Addr addrs.AbsResource

	// Instances contains the potentially-multiple instances associated with
	// this resource. This map can contain a mixture of different key types,
	// but only the ones of InstanceKeyType are considered current.
	Instances map[addrs.InstanceKey]*ResourceInstance

	// ProviderConfig is the absolute address for the provider configuration that
	// most recently managed this resource. This is used to connect a resource
	// with a provider configuration when the resource configuration block is
	// not available, such as if it has been removed from configuration
	// altogether.
	ProviderConfig addrs.AbsProviderConfig
}

// Instance returns the state for the instance with the given key, or nil
// if no such instance is tracked within the state.
func (rs *Resource) Instance(key addrs.InstanceKey) *ResourceInstance {
	return rs.Instances[key]
}

// CreateInstance creates an instance and adds it to the resource
func (rs *Resource) CreateInstance(key addrs.InstanceKey) *ResourceInstance {
	is := NewResourceInstance()
	rs.Instances[key] = is
	return is
}

// EnsureInstance returns the state for the instance with the given key,
// creating a new empty state for it if one doesn't already exist.
//
// Because this may create and save a new state, it is considered to be
// a write operation.
func (rs *Resource) EnsureInstance(key addrs.InstanceKey) *ResourceInstance {
	ret := rs.Instance(key)
	if ret == nil {
		ret = NewResourceInstance()
		rs.Instances[key] = ret
	}
	return ret
}

// ResourceInstance represents the state of a particular instance of a resource.
type ResourceInstance struct {
	// Current, if non-nil, is the remote object that is currently represented
	// by the corresponding resource instance.
	Current *ResourceInstanceObjectSrc

	// Deposed, if len > 0, contains any remote objects that were previously
	// represented by the corresponding resource instance but have been
	// replaced and are pending destruction due to the create_before_destroy
	// lifecycle mode.
	Deposed map[DeposedKey]*ResourceInstanceObjectSrc
}

// NewResourceInstance constructs and returns a new ResourceInstance, ready to
// use.
func NewResourceInstance() *ResourceInstance {
	return &ResourceInstance{
		Deposed: map[DeposedKey]*ResourceInstanceObjectSrc{},
	}
}

// HasCurrent returns true if this resource instance has a "current"-generation
// object. Most instances do, but this can briefly be false during a
// create-before-destroy replace operation when the current has been deposed
// but its replacement has not yet been created.
func (i *ResourceInstance) HasCurrent() bool {
	return i != nil && i.Current != nil
}

// HasDeposed returns true if this resource instance has a deposed object
// with the given key.
func (i *ResourceInstance) HasDeposed(key DeposedKey) bool {
	return i != nil && i.Deposed[key] != nil
}

// HasAnyDeposed returns true if this resource instance has one or more
// deposed objects.
func (i *ResourceInstance) HasAnyDeposed() bool {
	return i != nil && len(i.Deposed) > 0
}

// HasObjects returns true if this resource has any objects at all, whether
// current or deposed.
func (i *ResourceInstance) HasObjects() bool {
	return i.Current != nil || len(i.Deposed) != 0
}

// deposeCurrentObject is part of the real implementation of
// SyncState.DeposeResourceInstanceObject. The exported method uses a lock
// to ensure that we can safely allocate an unused deposed key without
// collision.
func (i *ResourceInstance) deposeCurrentObject(forceKey DeposedKey) DeposedKey {
	if !i.HasCurrent() {
		return NotDeposed
	}

	key := forceKey
	if key == NotDeposed {
		key = i.findUnusedDeposedKey()
	} else {
		if _, exists := i.Deposed[key]; exists {
			panic(fmt.Sprintf("forced key %s is already in use", forceKey))
		}
	}
	i.Deposed[key] = i.Current
	i.Current = nil
	return key
}

// GetGeneration retrieves the object of the given generation from the
// ResourceInstance, or returns nil if there is no such object.
//
// If the given generation is nil or invalid, this method will panic.
func (i *ResourceInstance) GetGeneration(gen Generation) *ResourceInstanceObjectSrc {
	if gen == CurrentGen {
		return i.Current
	}
	if dk, ok := gen.(DeposedKey); ok {
		return i.Deposed[dk]
	}
	if gen == nil {
		panic("get with nil Generation")
	}
	// Should never fall out here, since the above covers all possible
	// Generation values.
	panic(fmt.Sprintf("get invalid Generation %#v", gen))
}

// FindUnusedDeposedKey generates a unique DeposedKey that is guaranteed not to
// already be in use for this instance at the time of the call.
//
// Note that the validity of this result may change if new deposed keys are
// allocated before it is used. To avoid this risk, instead use the
// DeposeResourceInstanceObject method on the SyncState wrapper type, which
// allocates a key and uses it atomically.
func (i *ResourceInstance) FindUnusedDeposedKey() DeposedKey {
	return i.findUnusedDeposedKey()
}

// findUnusedDeposedKey generates a unique DeposedKey that is guaranteed not to
// already be in use for this instance.
func (i *ResourceInstance) findUnusedDeposedKey() DeposedKey {
	for {
		key := NewDeposedKey()
		if _, exists := i.Deposed[key]; !exists {
			return key
		}
		// Spin until we find a unique one. This shouldn't take long, because
		// we have a 32-bit keyspace and there's rarely more than one deposed
		// instance.
	}
}

// DeposedKey is a 8-character hex string used to uniquely identify deposed
// instance objects in the state.
type DeposedKey string

// NotDeposed is a special invalid value of DeposedKey that is used to represent
// the absense of a deposed key. It must not be used as an actual deposed key.
const NotDeposed = DeposedKey("")

var deposedKeyRand = rand.New(rand.NewSource(time.Now().UnixNano()))

// NewDeposedKey generates a pseudo-random deposed key. Because of the short
// length of these keys, uniqueness is not a natural consequence and so the
// caller should test to see if the generated key is already in use and generate
// another if so, until a unique key is found.
func NewDeposedKey() DeposedKey {
	v := deposedKeyRand.Uint32()
	return DeposedKey(fmt.Sprintf("%08x", v))
}

func (k DeposedKey) String() string {
	return string(k)
}

func (k DeposedKey) GoString() string {
	ks := string(k)
	switch {
	case ks == "":
		return "states.NotDeposed"
	default:
		return fmt.Sprintf("states.DeposedKey(%s)", ks)
	}
}

// Generation is a helper method to convert a DeposedKey into a Generation.
// If the reciever is anything other than NotDeposed then the result is
// just the same value as a Generation. If the receiver is NotDeposed then
// the result is CurrentGen.
func (k DeposedKey) Generation() Generation {
	if k == NotDeposed {
		return CurrentGen
	}
	return k
}

// generation is an implementation of Generation.
func (k DeposedKey) generation() {}

```

### Core Architecture Module: `internal/terraform/states/state.go`
```
package states

import (
	"fmt"
	"sort"

	"github.com/zclconf/go-cty/cty"

	"github.com/camptocamp/terraboard/internal/terraform/addrs"
	"github.com/camptocamp/terraboard/internal/terraform/getproviders"
)

// State is the top-level type of a Terraform state.
//
// A state should be mutated only via its accessor methods, to ensure that
// invariants are preserved.
//
// Access to State and the nested values within it is not concurrency-safe,
// so when accessing a State object concurrently it is the caller's
// responsibility to ensure that only one write is in progress at a time
// and that reads only occur when no write is in progress. The most common
// way to acheive this is to wrap the State in a SyncState and use the
// higher-level atomic operations supported by that type.
type State struct {
	// Modules contains the state for each module. The keys in this map are
	// an implementation detail and must not be used by outside callers.
	Modules map[string]*Module
}

// NewState constructs a minimal empty state, containing an empty root module.
func NewState() *State {
	modules := map[string]*Module{}
	modules[addrs.RootModuleInstance.String()] = NewModule(addrs.RootModuleInstance)
	return &State{
		Modules: modules,
	}
}

// BuildState is a helper -- primarily intended for tests -- to build a state
// using imperative code against the StateSync type while still acting as
// an expression of type *State to assign into a containing struct.
func BuildState(cb func(*SyncState)) *State {
	s := NewState()
	cb(s.SyncWrapper())
	return s
}

// Empty returns true if there are no resources or populated output values
// in the receiver. In other words, if this state could be safely replaced
// with the return value of NewState and be functionally equivalent.
func (s *State) Empty() bool {
	if s == nil {
		return true
	}
	for _, ms := range s.Modules {
		if len(ms.Resources) != 0 {
			return false
		}
		if len(ms.OutputValues) != 0 {
			return false
		}
	}
	return true
}

// Module returns the state for the module with the given address, or nil if
// the requested module is not tracked in the state.
func (s *State) Module(addr addrs.ModuleInstance) *Module {
	if s == nil {
		panic("State.Module on nil *State")
	}
	return s.Modules[addr.String()]
}

// ModuleInstances returns the set of Module states that matches the given path.
func (s *State) ModuleInstances(addr addrs.Module) []*Module {
	var ms []*Module
	for _, m := range s.Modules {
		if m.Addr.Module().Equal(addr) {
			ms = append(ms, m)
		}
	}
	return ms
}

// ModuleOutputs returns all outputs for the given module call under the
// parentAddr instance.
func (s *State) ModuleOutputs(parentAddr addrs.ModuleInstance, module addrs.ModuleCall) []*OutputValue {
	var os []*OutputValue
	for _, m := range s.Modules {
		// can't get outputs from the root module
		if m.Addr.IsRoot() {
			continue
		}

		parent, call := m.Addr.Call()
		// make sure this is a descendent in the correct path
		if !parentAddr.Equal(parent) {
			continue
		}

		// and check if this is the correct child
		if call.Name != module.Name {
			continue
		}

		for _, o := range m.OutputValues {
			os = append(os, o)
		}
	}

	return os
}

// RemoveModule removes the module with the given address from the state,
// unless it is the root module. The root module cannot be deleted, and so
// this method will panic if that is attempted.
//
// Removing a module implicitly discards all of the resources, outputs and
// local values within it, and so this should usually be done only for empty
// modules. For callers accessing the state through a SyncState wrapper, modules
// are automatically pruned if they are empty after one of their contained
// elements is removed.
func (s *State) RemoveModule(addr addrs.ModuleInstance) {
	if addr.IsRoot() {
		panic("attempted to remove root module")
	}

	delete(s.Modules, addr.String())
}

// RootModule is a convenient alias for Module(addrs.RootModuleInstance).
func (s *State) RootModule() *Module {
	if s == nil {
		panic("RootModule called on nil State")
	}
	return s.Modules[addrs.RootModuleInstance.String()]
}

// EnsureModule returns the state for the module with the given address,
// creating and adding a new one if necessary.
//
// Since this might modify the state to add a new instance, it is considered
// to be a write operation.
func (s *State) EnsureModule(addr addrs.ModuleInstance) *Module {
	ms := s.Module(addr)
	if ms == nil {
		ms = NewModule(addr)
		s.Modules[addr.String()] = ms
	}
	return ms
}

// HasManagedResourceInstanceObjects returns true if there is at least one
// resource instance object (current or deposed) associated with a managed
// resource in the receiving state.
//
// A true result would suggest that just discarding this state without first
// destroying these objects could leave "dangling" objects in remote systems,
// no longer tracked by any Terraform state.
func (s *State) HasManagedResourceInstanceObjects() bool {
	if s == nil {
		return false
	}
	for _, ms := range s.Modules {
		for _, rs := range ms.Resources {
			if rs.Addr.Resource.Mode != addrs.ManagedResourceMode {
				continue
			}
			for _, is := range rs.Instances {
				if is.Current != nil || len(is.Deposed) != 0 {
					return true
				}
			}
		}
	}
	return false
}

// Resource returns the state for the resource with the given address, or nil
// if no such resource is tracked in the state.
func (s *State) Resource(addr addrs.AbsResource) *Resource {
	ms := s.Module(addr.Module)
	if ms == nil {
		return nil
	}
	return ms.Resource(addr.Resource)
}

// Resources returns the set of resources that match the given configuration path.
func (s *State) Resources(addr addrs.ConfigResource) []*Resource {
	var ret []*Resource
	for _, m := range s.ModuleInstances(addr.Module) {
		r := m.Resource(addr.Resource)
		if r != nil {
			ret = append(ret, r)
		}
	}
	return ret
}

// AllManagedResourceInstanceObjectAddrs returns a set of addresses for all of
// the leaf resource instance objects associated with managed resources that
// are tracked in this state.
//
// This result is the set of objects that would be effectively "forgotten"
// (like "terraform state rm") if this state were totally discarded, such as
// by deleting a workspace. This function is intended only for reporting
// context in error messages, such as when we reject deleting a "non-empty"
// workspace as detected by s.HasManagedResourceInstanceObjects.
//
// The ordering of the result is meaningless but consistent. DeposedKey will
// be NotDeposed (the zero value of DeposedKey) for any "current" objects.
// This method is guaranteed to return at least one item if
// s.HasManagedResourceInstanceObjects returns true for the same state, and
// to return a zero-length slice if it returns false.
func (s *State) AllResourceInstanceObjectAddrs() []struct {
	Instance   addrs.AbsResourceInstance
	DeposedKey DeposedKey
} {
	if s == nil {
		return nil
	}

	// We use an unnamed return type here just because we currently have no
	// general need to return pairs of instance address and deposed key aside
	// from this method, and this method itself is only of marginal value
	// when producing some error messages.
	//
	// If that need ends up arising more in future then it might make sense to
	// name this as addrs.AbsResourceInstanceObject, although that would require
	// moving DeposedKey into the addrs package too.
	type ResourceInstanceObject = struct {
		Instance   addrs.AbsResourceInstance
		DeposedKey DeposedKey
	}
	var ret []ResourceInstanceObject

	for _, ms := range s.Modules {
		for _, rs := range ms.Resources {
			if rs.Addr.Resource.Mode != addrs.ManagedResourceMode {
				continue
			}

			for instKey, is := range rs.Instances {
				instAddr := rs.Addr.Instance(instKey)
				if is.Current != nil {
					ret = append(ret, ResourceInstanceObject{instAddr, NotDeposed})
				}
				for deposedKey := range is.Deposed {
					ret = append(ret, ResourceInstanceObject{instAddr, deposedKey})
				}
			}
		}
	}

	sort.SliceStable(ret, func(i, j int) bool {
		objI, objJ := ret[i], ret[j]
		switch {
		case !objI.Instance.Equal(objJ.Instance):
			return objI.Instance.Less(objJ.Instance)
		default:
			return objI.DeposedKey < objJ.DeposedKey
		}
	})

	return ret
}

// ResourceInstance returns the state for the resource instance with the given
// address, or nil if no such resource is tracked in the state.
func (s *State) ResourceInstance(addr addrs.AbsResourceInstance) *ResourceInstance {
	if s == nil {
		panic("State.ResourceInstance on nil *State")
	}
	ms := s.Module(addr.Module)
	if ms == nil {
		return nil
	}
	return ms.ResourceInstance(addr.Resource)
}

// OutputValue returns the state for the output value with the given address,
// or nil if no such output value is tracked in the state.
func (s *State) OutputValue(addr addrs.AbsOutputValue) *OutputValue {
	ms := s.Module(addr.Module)
	if ms == nil {
		return nil
	}
	return ms.OutputValues[addr.OutputValue.Name]
}

// LocalValue returns the value of the named local value with the given address,
// or cty.NilVal if no such value is tracked in the state.
func (s *State) LocalValue(addr addrs.AbsLocalValue) cty.Value {
	ms := s.Module(addr.Module)
	if ms == nil {
		return cty.NilVal
	}
	return ms.LocalValues[addr.LocalValue.Name]
}

// ProviderAddrs returns a list of all of the provider configuration addresses
// referenced throughout the receiving state.
//
// The result is de-duplicated so that each distinct address appears only once.
func (s *State) ProviderAddrs() []addrs.AbsProviderConfig {
	if s == nil {
		return nil
	}

	m := map[string]addrs.AbsProviderConfig{}
	for _, ms := range s.Modules {
		for _, rc := range ms.Resources {
			m[rc.ProviderConfig.String()] = rc.ProviderConfig
		}
	}
	if len(m) == 0 {
		return nil
	}

	// This is mainly just so we'll get stable results for testing purposes.
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(k
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #236** (2022-10-15): **Missing results following scan of bucket **
  *Symptoms*: I have followed instructions for launching terraboard from docker, and last week was able to display results. However, while preparing to demo to my team today, my results are unavailable. Here is partial log of run:  ``` docker logs terraboard Loading config from /temp/thiscorp.yaml time="2022-04-12T05:44:18Z" level=info msg="Terraboard vv2.1.1 (built for Terraform v1.0.2) is starting..." time="2022-04-12T05:44:18Z" level=info msg="Using AWS (S3+DynamoDB) as state/locks provider" time="2022-04-12T05:44:18Z" level=info msg=Automigrate time="2022-04-12T05:44:18Z" level=info msg="Refreshing DB" time="2022-04-12T05:44:18Z" level=info msg="Serving swagger on port 8081"  ``` I'm pretty sure the large state files are an issue
  **Post-Mortem & Fix Analysis**:
  > Display screenshot <img width="1423" alt="Screen Shot 2022-04-12 at 10 10 10 AM" src="https://user-images.githubusercontent.com/41868/163028527-4cfd9883-1b28-4763-b3f1-3ed6576c53f8.png">  
  > I set log-level to debug, and now my screen-shot looks like this: <img width="1102" alt="Screen Shot 2022-04-12 at 1 18 44 PM" src="https://user-images.githubusercontent.com/41868/163046913-55a7c286-e1d0-4a9f-b194-2efa1ba61300.png">  
  > Why doesn't the version show in the footer?

- **Issue #151** (2021-04-15): **Fix website Docker example as per README**
  *Symptoms*: Fix #150  Signed-off-by: Raphaël Pinson <raphael.pinson@camptocamp.com>

- **Issue #141** (2021-02-23): **Fix environment variable for APPRoleArn on README**
  *Symptoms*: Hello,   This PR fixes a small issue found at README. According to the config file (https://github.com/camptocamp/terraboard/blob/master/config/config.go#L47), the variable `--app-role-arn` can be provided using the environment variable `APP_ROLE_ARN`.  Regards,
  **Post-Mortem & Fix Analysis**:
  >  [![Coverage Status](https://coveralls.io/builds/37317887/badge)](https://coveralls.io/builds/37317887)  Coverage remained the same at 13.727% when pulling **26f50f06d7b7d74aacedebcc49e89e8b4db22928 on alemuro:fix-typo-assumerole** into **49b6fc2f91c7b8b079385350be4668b57ba4c454 on camptocamp:master**. 

- **Issue #138** (2021-02-17): **Fix nill pointer**
  *Symptoms*: ### Fix for https://github.com/camptocamp/terraboard/issues/107 Terraform `ResourceInstance.Current` can be [`nil`](https://github.com/hashicorp/terraform/blob/master/states/resource.go#L59)  which causes a nil pointer dereference in [`db.go`](https://github.com/camptocamp/terraboard/blob/master/db/db.go#L93)  I haven't investigated deeper into Terraform code, just added a simple check. There might be some consequences I am not aware of, but it seems to be working just fine. 
  **Post-Mortem & Fix Analysis**:
  > Good catch!

- **Issue #133** (2021-02-03): **Fixed failing CI following recent changes introducing GitLab backend support**
  *Symptoms*: Apologies on this I did not properly run them before submitting 🤦 
  **Post-Mortem & Fix Analysis**:
  > Thanks for this. From what I see, this is a breaking change, which will require a major release.
  > Can we get this in to fix CI? It's failing on all other PRs.
  > Going for a major release next 😁

- **Issue #132** (2021-01-14): **Fixed ineffassign definition following a recent update**
  *Symptoms*: tests are now failing: https://travis-ci.org/github/camptocamp/terraboard/builds/754109002  ``` ineffassign compare/compare_test.go compare/compare.go db/db.go db/db_test.go config/config.go config/config_test.go auth/auth.go auth/auth_test.go api/api.go api/api_test.go util/util.go util/util_test.go types/db.go types/search_test.go types/compare_test.go types/db_test.go types/search.go types/compare.go state/tfe_test.go state/aws_test.go state/state_test.go state/gcp_test.go state/tfe.go state/aws.go state/state.go state/gcp.go  -: named files must all be in one directory; have compare/ and db/  ineffassign: error during loading  Makefile:40: recipe for target 'ineffassign' failed  make: *** [ineffassign] Error 1 ``` 
  **Post-Mortem & Fix Analysis**:
  >  [![Coverage Status](https://coveralls.io/builds/36272264/badge)](https://coveralls.io/builds/36272264)  Coverage remained the same at 15.541% when pulling **e155de245d5ac2c9ae1dabb08680d6b35cfff918 on mvisonneau:ineffassign_fix** into **ccde60d99feb4bc75fa631ecaf4e887a215413d5 on camptocamp:master**. 

- **Issue #105** (2021-04-27): **Panic at start with 0.22.0**
  *Symptoms*: Hello!  I just attempted an update to 0.22.0 and received a panic on startup:  ``` time="2020-08-14T19:51:13Z" level=info msg="Terraboard v0.22.0 (built for Terraform v0.13.0) is starting..." panic: terraform.io/builtin/terraform is not a legacy addrs.Provider ```  Has 0.22.0 dropped support for state file versions older than 0.13.0?  This issue describes a similar error which may have been fixed in newer versions of the module? https://github.com/hashicorp/terraform/issues/25803
  **Post-Mortem & Fix Analysis**:
  > That is unfortunately possible. I'll try to investigate this, but I did have to patch that part in order to support Terraform 0.13, so I wouldn't be too surprised if the Terraform 0.13 libraries dropped support for older statefile formats...
  > I had to use 0.21.0 due to this issue
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. Thank you for your contributions. 

- **Issue #97** (2020-10-01): **Resources created using `for_each` are missing**
  *Symptoms*: I have a bunch of resources created using [`for_each`](https://www.terraform.io/docs/configuration/resources.html#for_each-multiple-resource-instances-defined-by-a-map-or-set-of-strings), however, only 1 resource appears in terraboard.  Seems like the tool is not properly managing the `0.12` syntax features.

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

### Incident Patch 1: `b264059d` (2023-10-26)
**Commit Message**: docs: docker registry warning on readme and changelog fix

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 
 ### Features
 
-* **go:** upgrade Terraboard's Go version to v1.17 ([e457ebc](https://www.github.com/camptocamp/terraboard/commit/e457ebc154730baea6fbbf1723e52e417c67f55c))
+* **go:** upgrade Terraboard's Go version to v1.21
 * **internal:** update Terraform's internal packages ([e457ebc](https://www.github.com/camptocamp/terraboard/commit/e457ebc154730baea6fbbf1723e52e417c67f55c))
 
 
```

**File**: `README.md` (modified, +8/-6)
```diff
@@ -30,6 +30,8 @@
 
 ---
 
+<p align="center"><strong>Caution: Terraboard's Docker registry was migrated from Dockerhub to GHCR! All new tags will be now pushed <a href="https://github.com/camptocamp/terraboard/pkgs/container/terraboard">here</a>. You can still access to old tags on the legacy Dockerhub repository.</strong></p>
+
 <details><summary>Table of content</summary>
 
 - [What is it?](#what-is-it)
@@ -93,7 +95,7 @@ It currently supports several remote state backend providers:
 - [GitLab](https://docs.gitlab.com/ee/user/infrastructure/terraform_state.html)
 
 Terraboard is now able to handle multiple buckets/providers configuration! 🥳
-Check *configuration* section for more details. 
+Check *configuration* section for more details.
 
 ### Overview
 
@@ -175,22 +177,22 @@ aws:
     s3:
       - bucket: test-bucket
         force-path-style: true
-        file-extension: 
+        file-extension:
           - .tfstate
 
   - endpoint: http://minio:9000/
     region: eu-west-1
     s3:
       - bucket: test-bucket2
         force-path-style: true
-        file-extension: 
+        file-extension:
           - .tfstate
 ```
 
 In the case of AWS, don't forget to set the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables.
 
 That's it! Terraboard will now fetch these two buckets on DB refresh. You can also mix providers like AWS and Gitlab or anything else.
-You can find a ready-to-use Docker example with two *MinIO* buckets in the `test/multiple-minio-buckets/` sub-folder. 
+You can find a ready-to-use Docker example with two *MinIO* buckets in the `test/multiple-minio-buckets/` sub-folder.
 
 ### Available parameters
 
@@ -199,7 +201,7 @@ You can find a ready-to-use Docker example with two *MinIO* buckets in the `test
 - `-V`, `--version` Display version.
 - `-c`, `--config-file` <default: *$CONFIG_FILE*> Config File path
   - Env: *CONFIG_FILE*
-  
+
 #### General Provider Options
 
 - `--no-versioning` <default: *$TERRABOARD_NO_VERSIONING*> Disable versioning support from Terraboard (useful for S3 compatible providers like MinIO)
@@ -401,7 +403,7 @@ docker run -p 8080:8080 \
   -e DB_PASSWORD="<mypassword>" \
   -e DB_SSLMODE="disable" \
   --net terraboard \
-  camptocamp/terraboard:latest
+  ghcr.io/camptocamp/terraboard:latest
 ```
 
 Then point your browser to http://localhost:8080.
```

---

### Incident Patch 2: `729fc278` (2023-10-26)
**Commit Message**: chore: fix linter issues

**File**: `db/db.go` (modified, +0/-1)
```diff
@@ -477,7 +477,6 @@ func (db *Database) ListStateStats(query url.Values) (states []types.StateStat,
 
 	var paginationQuery string
 	var params []interface{}
-	page = 1
 	if v := string(query.Get("page")); v != "" {
 		page, _ = strconv.Atoi(v) // TODO: err
 		offset := (page - 1) * pageSize
```

**File**: `main.go` (modified, +15/-2)
```diff
@@ -222,14 +222,27 @@ func main() {
 	// Add CORS Middleware to mux router
 	r.Use(corsMiddleware)
 
+	// Create server
+	server := &http.Server{
+		Addr:              fmt.Sprintf(":%v", c.Web.Port),
+		Handler:           r,
+		ReadHeaderTimeout: 3 * time.Second,
+	}
+
 	// Start server
 	log.Debugf("Listening on port %d\n", c.Web.Port)
-	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%v", c.Web.Port), r))
+	log.Fatal(server.ListenAndServe())
 }
 
 func serveSwagger(port int, router *mux.Router) {
+	server := &http.Server{
+		Addr:              fmt.Sprintf(":%v", port),
+		Handler:           router,
+		ReadHeaderTimeout: 3 * time.Second,
+	}
+
 	log.Infof("Serving swagger on port %d", port)
-	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%v", port), router))
+	log.Fatal(server.ListenAndServe())
 }
 
 // spaHandler implements the http.Handler interface, so we can use it
```

---

### Incident Patch 3: `b57f6ed6` (2023-10-26)
**Commit Message**: test: fix bucket creds in multiple-minio-buckets test env

**File**: `test/multiple-minio-buckets/Makefile` (modified, +1/-1)
```diff
@@ -6,6 +6,6 @@ build:
 	UID="${UID}" GID="${GID}" docker-compose build 
 
 test:
-	UID="${UID}" GID="${GID}" docker-compose up -d
+	UID="${UID}" GID="${GID}" docker-compose up 
 
 all: build test
```

**File**: `test/multiple-minio-buckets/config.yml` (modified, +2/-2)
```diff
@@ -11,8 +11,8 @@ provider:
   no-versioning: true
 
 aws:
-  - access-key: ${AWS_ACCESS_KEY_ID}
-    secret-access-key: ${AWS_SECRET_ACCESS_KEY}
+  - access-key: root
+    secret-access-key: mypassword
     endpoint: http://minio:9000/
     region: eu-west-1
     s3:
```

---

### Incident Patch 4: `a2f65899` (2022-05-25)
**Commit Message**: fix: remove duplicated 'v' on terraboard version (frontend/logs)

**File**: `config/config.go` (modified, +1/-1)
```diff
@@ -172,7 +172,7 @@ func LoadConfig(version string) *Config {
 	parsedConfig := parseStructFlagsAndEnv()
 
 	if parsedConfig.Version {
-		fmt.Printf("Terraboard v%v (built for Terraform v%v)\n", version, tfversion.Version)
+		fmt.Printf("Terraboard %v (built for Terraform v%v)\n", version, tfversion.Version)
 		os.Exit(0)
 	}
 
```

**File**: `main.go` (modified, +1/-1)
```diff
@@ -152,7 +152,7 @@ func main() {
 
 	util.SetBasePath(c.Web.BaseURL)
 
-	log.Infof("Terraboard v%s (built for Terraform v%s) is starting...", version, tfversion.Version)
+	log.Infof("Terraboard %s (built for Terraform v%s) is starting...", version, tfversion.Version)
 
 	err := c.SetupLogging()
 	if err != nil {
```

**File**: `static/terraboard-vuejs/src/components/Footer.vue` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 <div class="navbar mt-auto">
     <div class="container-fluid mx-1">
         <ul class="nav navbar-nav" id="navbar-collapse-menu">
-            <li><a href="https://github.com/camptocamp/terraboard/releases" target="_blank">Terraboard v{{ version }}</a></li>
+            <li><a href="https://github.com/camptocamp/terraboard/releases" target="_blank">Terraboard {{ version }}</a></li>
         </ul>
         <ul class="nav navbar-nav navbar-right" id="navbar-collapse-menu">
             <li><a href="https://www.camptocamp.com/" target="_blank">{{ copyright }}</a></li>
```

---

### Incident Patch 5: `3f31b1f0` (2022-05-25)
**Commit Message**: fix(config): missing default values with yaml

**File**: `config/config_test.go` (modified, +36/-38)
```diff
@@ -6,6 +6,7 @@ import (
 	"testing"
 
 	"github.com/davecgh/go-spew/spew"
+	"github.com/jessevdk/go-flags"
 	log "github.com/sirupsen/logrus"
 )
 
@@ -24,17 +25,22 @@ func TestSetLogging_debug(t *testing.T) {
 }
 
 func TestLoadConfig(t *testing.T) {
-	t.Skip("Skipping this test since go-flags can't parse properlly flags with go test command")
-
-	c := LoadConfig("1.0.0")
-	compareConfig := Config{
+	var tmpConfig configFlags
+	parser := flags.NewParser(&tmpConfig, flags.Default)
+	if _, err := parser.ParseArgs([]string{"--db-host=test", "--port=1234"}); err != nil {
+		if flagsErr, ok := err.(*flags.Error); ok && flagsErr.Type == flags.ErrHelp {
+			os.Exit(0)
+		}
+		log.Fatalf("Failed to parse flags: %s", err)
+	}
+	compareConfig := configFlags{
 		Log: LogConfig{
 			Level:  "info",
 			Format: "plain",
 		},
 		ConfigFilePath: "",
 		DB: DBConfig{
-			Host:         "db",
+			Host:         "test",
 			Port:         5432,
 			User:         "gorm",
 			Password:     "",
@@ -43,50 +49,42 @@ func TestLoadConfig(t *testing.T) {
 			NoSync:       false,
 			SyncInterval: 1,
 		},
-		AWS: []AWSConfig{
-			{
-				AccessKey:       "",
-				SecretAccessKey: "",
-				DynamoDBTable:   "",
-				S3: []S3BucketConfig{{
-					Bucket:         "",
-					KeyPrefix:      "",
-					FileExtension:  []string{".tfstate"},
-					ForcePathStyle: false,
-				}},
-			},
+		AWS: AWSConfig{
+			AccessKey:       "",
+			SecretAccessKey: "",
+			DynamoDBTable:   "",
 		},
-		TFE: []TFEConfig{
-			{
-				Address:      "",
-				Token:        "",
-				Organization: "",
-			},
+		S3: S3BucketConfig{
+			Bucket:         "",
+			KeyPrefix:      "",
+			FileExtension:  []string{".tfstate"},
+			ForcePathStyle: false,
 		},
-		GCP: []GCPConfig{
-			{
-				GCSBuckets: nil,
-				GCPSAKey:   "",
-			},
+		TFE: TFEConfig{
+			Address:      "",
+			Token:        "",
+			Organization: "",
 		},
-		Gitlab: []GitlabConfig{
-			{
-				Address: "https://gitlab.com",
-				Token:   "",
-			},
+		GCP: GCPConfig{
+			GCSBuckets: nil,
+			GCPSAKey:   "",
+		},
+		Gitlab: GitlabConfig{
+			Address: "https://gitlab.com",
+			Token:   "",
 		},
 		Web: WebConfig{
-			Port:        8080,
+			Port:        1234,
 			SwaggerPort: 8081,
 			BaseURL:     "/",
 			LogoutURL:   "",
 		},
 	}
 
-	if !reflect.DeepEqual(*c, compareConfig) {
+	if !reflect.DeepEqual(tmpConfig, compareConfig) {
 		t.Errorf(
 			"TestLoadConfig() -> \n\ngot:\n%v,\n\nwant:\n%v",
-			spew.Sdump(*c),
+			spew.Sdump(tmpConfig),
 			spew.Sdump(compareConfig),
 		)
 	}
@@ -109,9 +107,9 @@ func TestLoadConfigFromYaml(t *testing.T) {
 			User:         "terraboard-user",
 			Password:     "terraboard-pass",
 			Name:         "terraboard-db",
-			SSLMode:      "",
+			SSLMode:      "require",
 			NoSync:       true,
-			SyncInterval: 0,
+			SyncInterval: 1,
 		},
 		AWS: []AWSConfig{
 			{
```

**File**: `config/config_test.yml` (modified, +0/-1)
```diff
@@ -38,6 +38,5 @@ gitlab:
 
 web:
   port: 39090
-  swagger-port: 8081
   base-url: /test/
   logout-url: /test-logout
```

**File**: `config/yaml.go` (modified, +29/-0)
```diff
@@ -6,6 +6,35 @@ package config
  * (and so makes them optional)
  *********************************************/
 
+func (s *Config) UnmarshalYAML(unmarshal func(interface{}) error) error {
+	type rawConfig Config
+	raw := rawConfig{
+		DB: DBConfig{
+			Host:         "db",
+			Port:         5432,
+			User:         "gorm",
+			Name:         "gorm",
+			SSLMode:      "require",
+			SyncInterval: 1,
+		},
+		Log: LogConfig{
+			Level:  "info",
+			Format: "plain",
+		},
+		Web: WebConfig{
+			Port:        8080,
+			SwaggerPort: 8081,
+			BaseURL:     "/",
+		},
+	}
+	if err := unmarshal(&raw); err != nil {
+		return err
+	}
+
+	*s = Config(raw)
+	return nil
+}
+
 func (s *S3BucketConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
 	type rawS3BucketConfig S3BucketConfig
 	raw := rawS3BucketConfig{
```

---

### Incident Patch 6: `56dbee8d` (2022-05-25)
**Commit Message**: fix(db): possible sql injection on /search endpoint (#247)

**File**: `db/db.go` (modified, +4/-2)
```diff
@@ -370,11 +370,13 @@ func (db *Database) SearchAttribute(query url.Values) (results []types.SearchRes
 	}
 
 	if v := query.Get("tf_version"); string(v) != "" {
-		where = append(where, fmt.Sprintf("states.tf_version LIKE '%s'", fmt.Sprintf("%%%s%%", v)))
+		where = append(where, "states.tf_version LIKE ?")
+		params = append(params, fmt.Sprintf("%%%s%%", v))
 	}
 
 	if v := query.Get("lineage_value"); string(v) != "" {
-		where = append(where, fmt.Sprintf("lineages.value LIKE '%s'", fmt.Sprintf("%%%s%%", v)))
+		where = append(where, "lineages.value LIKE ?")
+		params = append(params, fmt.Sprintf("%%%s%%", v))
 	}
 
 	if len(where) > 0 {
```

---

### Incident Patch 7: `608d9d5c` (2022-05-24)
**Commit Message**: docs: create SECURITY.md (#246)

**File**: `SECURITY.md` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+# Security Policy
+
+Welcome and thanks for helping us make safe solutions for everyone.
+
+## Supported Versions
+
+| Version | Supported          |
+| ------- | ------------------ |
+| 2.1.x   | :white_check_mark: |
+| < 2.1   | :x:                |
+
+## Reporting a Vulnerability
+
+If you believe you have found a security vulnerability in any **Camptocamp**-owned repository, please report it to us through coordinated disclosure.
+
+**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**
+
+Instead, please send an email to security.inf@camptocamp.com.
+
+Please include as much of the information listed below as you can to help us better understand and resolve the issue:
+
+  * The type of issue (e.g., buffer overflow, SQL injection, or cross-site scripting)
+  * Full paths of source file(s) related to the manifestation of the issue
+  * The location of the affected source code (tag/branch/commit or direct URL)
+  * Any special configuration required to reproduce the issue
+  * Step-by-step instructions to reproduce the issue
+  * Proof-of-concept or exploit code (if possible)
+  * Impact of the issue, including how an attacker might exploit the issue
+
+This information will help us triage your report more quickly.
+
+## Security
+
+**Camptocamp** takes the security of our software products and services seriously, including all of the open source code repositories managed through our GitHub organizations, such as [Camptocamp](https://github.com/camptocamp).
```

---

### Incident Patch 8: `1fc682a1` (2022-03-05)
**Commit Message**: fix(build): invalid version number displayed (#229) (#231)

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ NAME          				  := terraboard
 FILES         				  := $(wildcard */*.go)
 TEST_FILES    				  := $(shell go list ./... | grep -v /internal/)
 TEST_FILES_COMMA_SEPARATED    := $(shell go list ./... | grep -v /internal/ | awk '{print}' ORS=',')
-VERSION       				  := $(shell git describe --always)
+VERSION       				  := $(shell git describe --always --tags)
 .DEFAULT_GOAL 				  := help
 
 export GO111MODULE=on
```

---

### Incident Patch 9: `e7d29230` (2022-02-21)
**Commit Message**: Fix typo - WS_DYNAMODB_TABLE to AWS_DYNAMODB_TABLE (#228)

Fixing typo - WS_DYNAMODB_TABLE should be AWS_DYNAMODB_TABLE

**File**: `README.md` (modified, +1/-1)
```diff
@@ -397,7 +397,7 @@ docker run -p 8080:8080 \
   -e AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}" \
   -e AWS_REGION="${AWS_DEFAULT_REGION}" \
   -e AWS_BUCKET="${AWS_BUCKET}" \
-  -e WS_DYNAMODB_TABLE="${AWS_DYNAMODB_TABLE}" \
+  -e AWS_DYNAMODB_TABLE="${AWS_DYNAMODB_TABLE}" \
   -e DB_PASSWORD="<mypassword>" \
   -e DB_SSLMODE="disable" \
   --net terraboard \
```

---

### Incident Patch 10: `b219b9e1` (2022-02-08)
**Commit Message**: fix(docker-compose): wrong username used in pg healthcheck

**File**: `docker-compose.yml` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ services:
     volumes:
       - tb-data:/var/lib/postgresql/data
     healthcheck:
-      test: ["CMD-SHELL", "pg_isready -U postgres"]
+      test: ["CMD-SHELL", "pg_isready -U gorm"]
       interval: 10s
       timeout: 5s
       retries: 5
```

**File**: `test/multiple-minio-buckets/docker-compose.yml` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ services:
     volumes:
       - tb-data:/var/lib/postgresql/data
     healthcheck:
-      test: ["CMD-SHELL", "pg_isready -U postgres"]
+      test: ["CMD-SHELL", "pg_isready -U gorm"]
       interval: 10s
       timeout: 5s
       retries: 5
```

**File**: `test/single-minio-bucket/docker-compose.yml` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ services:
     volumes:
       - tb-data:/var/lib/postgresql/data
     healthcheck:
-      test: ["CMD-SHELL", "pg_isready -U postgres"]
+      test: ["CMD-SHELL", "pg_isready -U gorm"]
       interval: 10s
       timeout: 5s
       retries: 5
```

---

### Incident Patch 11: `b7a9ac8e` (2022-02-08)
**Commit Message**: test: add tfstates fixtures in minio buckets

**File**: `test/.gitignore` (modified, +3/-3)
```diff
@@ -1,3 +1,3 @@
-data/*
-!data/test-bucket
-!data/test-bucket2
\ No newline at end of file
+# Ignore minio config files
+data/**/.minio.sys
+
```

**File**: `test/data/minio-1/test-bucket/terraform2_1.tfstate` (added, +194/-0)
```diff
@@ -0,0 +1,194 @@
+{
+  "version": 4,
+  "terraform_version": "1.1.3",
+  "serial": 23,
+  "lineage": "b17194aa-6d00-151a-fe54-3b8fa4d56a4e",
+  "outputs": {
+    "eks_cluster_endpoint": {
+      "value": "https://8CE6E1354B399B0AF311DE0AF250616E.yl4.eu-west-3.eks.amazonaws.com",
+      "type": "string"
+    }
+  },
+  "resources": [
+    {
+      "mode": "managed",
+      "type": "aws_eks_cluster",
+      "name": "aws_eks",
+      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
+      "instances": [
+        {
+          "schema_version": 0,
+          "attributes": {
+            "arn": "arn:aws:eks:eu-west-3:test:cluster/eks_cluster_voting_app",
+            "certificate_authority": [
+              {
+                "data": "=="
+              }
+            ],
+            "created_at": "2022-02-08 17:27:04.711 +0000 UTC",
+            "enabled_cluster_log_types": null,
+            "encryption_config": [],
+            "endpoint": "https://test.eu-west-3.eks.amazonaws.com",
+            "id": "eks_cluster_app",
+            "identity": [
+              {
+                "oidc": [
+                  {
+                    "issuer": "https://oidc.eks.eu-west-3.amazonaws.com/id/test"
+                  }
+                ]
+              }
+            ],
+            "kubernetes_network_config": [
+              {
+                "service_ipv4_cidr": "10.100.0.0/16"
+              }
+            ],
+            "name": "eks_cluster_app",
+            "platform_version": "eks.4",
+            "role_arn": "arn:aws:iam:::role/eks-cluster",
+            "status": "ACTIVE",
+            "tags": {
+              "Name": "EKS_App"
+            },
+            "tags_all": {
+              "Name": "EKS_App"
+            },
+            "timeouts": null,
+            "version": "1.21",
+            "vpc_config": [
+              {
+                "cluster_security_group_id": "sg-01",
+                "endpoint_private_access": false,
+                "endpoint_public_access": true,
+                "public_access_cidrs": [
+                  "0.0.0.0/0"
+                ],
+                "security_group_ids": null,
+                "subnet_ids": [
+                  "subnet-1",
+                  "subnet-1"
+                ],
+                "vpc_id": "vpc-1"
+              }
+            ]
+          },
+          "sensitive_attributes": [],
+          "private": "",
+          "dependencies": [
+            "aws_iam_role.eks_cluster"
+          ]
+        }
+      ]
+    },
+    {
+      "mode": "managed",
+      "type": "aws_eks_node_group",
+      "name": "node",
+      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
+      "instances": [
+        {
+          "schema_version": 0,
+          "attributes": {
+            "ami_type": "AL2_x86_64",
+            "arn": "arn:aws:eks:eu-west-3:01:nodegroup/eks_cluster_app/node-group-1/01",
+            "capacity_type": "ON_DEMAND",
+            "cluster_name": "eks_cluster_app",
+            "disk_size": 20,
+            "force_update_version": null,
+            "id": "eks_cluster_app:node-group-1",
+            "instance_types": [
+              "t3.medium"
+            ],
+            "labels": null,
+            "launch_template": [],
+            "node_group_name": "node-group-1",
+            "node_group_name_prefix": "",
+            "node_role_arn": "arn:aws:iam::01:role/eks-node-group",
+            "release_version": "1.21.5-20220123",
+            "remote_access": [],
+            "resources": [
+              {
+                "autoscaling_groups": [
+                  {
+                    "name": "eks-node-group-1"
+                  }
+                ],
+                "remote_access_security_group_id": ""
+              }
+            ],
+            "scaling_config": [
+              {
+                "desired_size": 1,
+                "max_size": 1,
+                "min_size": 1
+              }
+            ],
+            "status": "ACTIVE",
+            "subnet_ids": [
+              "subnet-1",
+              "subnet-2"
+            ],
+            "tags": null,
+            "tags_all": {},
+            "taint": [],
+            "timeouts": null,
+            "update_config": [
+              {
+                "max_unavailable": 1,
+                "max_unavailable_percentage": 0
+              }
+            ],
+            "version": "1.21"
+          },
+          "sensitive_attributes": [],
+          "private": "",
+          "dependencies": [
+            "aws_eks_cluster.aws_eks",
+            "aws_iam_role.eks_cluster",
+            "aws_iam_role.eks_nodes",
+            "aws_iam_role_policy_attachment.AmazonEC2ContainerRegistryReadOnly",
+            "aws_iam_role_policy_attachment.AmazonEKSWorkerNodePolicy",
+            "aws_iam_role_policy_attachment.AmazonEKS_CNI_Policy"
+          ]
+        }
+      ]
+    },
+    {
+      "mode": "managed",
+      "type": "aws_iam_role",
+      
```

**File**: `test/data/minio-1/test-bucket/terraform_1.tfstate` (added, +194/-0)
```diff
@@ -0,0 +1,194 @@
+{
+  "version": 4,
+  "terraform_version": "1.1.3",
+  "serial": 22,
+  "lineage": "a17194aa-6d00-151a-fe54-3b8fa4d56a4e",
+  "outputs": {
+    "eks_cluster_endpoint": {
+      "value": "https://8CE6E1354B399B0AF311DE0AF250616E.yl4.eu-west-3.eks.amazonaws.com",
+      "type": "string"
+    }
+  },
+  "resources": [
+    {
+      "mode": "managed",
+      "type": "aws_eks_cluster",
+      "name": "aws_eks",
+      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
+      "instances": [
+        {
+          "schema_version": 0,
+          "attributes": {
+            "arn": "arn:aws:eks:eu-west-3:test:cluster/eks_cluster_voting_app",
+            "certificate_authority": [
+              {
+                "data": "=="
+              }
+            ],
+            "created_at": "2022-02-08 17:27:04.711 +0000 UTC",
+            "enabled_cluster_log_types": null,
+            "encryption_config": [],
+            "endpoint": "https://test.eu-west-3.eks.amazonaws.com",
+            "id": "eks_cluster_app",
+            "identity": [
+              {
+                "oidc": [
+                  {
+                    "issuer": "https://oidc.eks.eu-west-3.amazonaws.com/id/test"
+                  }
+                ]
+              }
+            ],
+            "kubernetes_network_config": [
+              {
+                "service_ipv4_cidr": "10.100.0.0/16"
+              }
+            ],
+            "name": "eks_cluster_app",
+            "platform_version": "eks.4",
+            "role_arn": "arn:aws:iam:::role/eks-cluster",
+            "status": "ACTIVE",
+            "tags": {
+              "Name": "EKS_App"
+            },
+            "tags_all": {
+              "Name": "EKS_App"
+            },
+            "timeouts": null,
+            "version": "1.21",
+            "vpc_config": [
+              {
+                "cluster_security_group_id": "sg-01",
+                "endpoint_private_access": false,
+                "endpoint_public_access": true,
+                "public_access_cidrs": [
+                  "0.0.0.0/0"
+                ],
+                "security_group_ids": null,
+                "subnet_ids": [
+                  "subnet-1",
+                  "subnet-1"
+                ],
+                "vpc_id": "vpc-1"
+              }
+            ]
+          },
+          "sensitive_attributes": [],
+          "private": "",
+          "dependencies": [
+            "aws_iam_role.eks_cluster"
+          ]
+        }
+      ]
+    },
+    {
+      "mode": "managed",
+      "type": "aws_eks_node_group",
+      "name": "node",
+      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
+      "instances": [
+        {
+          "schema_version": 0,
+          "attributes": {
+            "ami_type": "AL2_x86_64",
+            "arn": "arn:aws:eks:eu-west-3:01:nodegroup/eks_cluster_app/node-group-1/01",
+            "capacity_type": "ON_DEMAND",
+            "cluster_name": "eks_cluster_app",
+            "disk_size": 20,
+            "force_update_version": null,
+            "id": "eks_cluster_app:node-group-1",
+            "instance_types": [
+              "t3.medium"
+            ],
+            "labels": null,
+            "launch_template": [],
+            "node_group_name": "node-group-1",
+            "node_group_name_prefix": "",
+            "node_role_arn": "arn:aws:iam::01:role/eks-node-group",
+            "release_version": "1.21.5-20220123",
+            "remote_access": [],
+            "resources": [
+              {
+                "autoscaling_groups": [
+                  {
+                    "name": "eks-node-group-1"
+                  }
+                ],
+                "remote_access_security_group_id": ""
+              }
+            ],
+            "scaling_config": [
+              {
+                "desired_size": 1,
+                "max_size": 1,
+                "min_size": 1
+              }
+            ],
+            "status": "ACTIVE",
+            "subnet_ids": [
+              "subnet-1",
+              "subnet-2"
+            ],
+            "tags": null,
+            "tags_all": {},
+            "taint": [],
+            "timeouts": null,
+            "update_config": [
+              {
+                "max_unavailable": 1,
+                "max_unavailable_percentage": 0
+              }
+            ],
+            "version": "1.21"
+          },
+          "sensitive_attributes": [],
+          "private": "",
+          "dependencies": [
+            "aws_eks_cluster.aws_eks",
+            "aws_iam_role.eks_cluster",
+            "aws_iam_role.eks_nodes",
+            "aws_iam_role_policy_attachment.AmazonEC2ContainerRegistryReadOnly",
+            "aws_iam_role_policy_attachment.AmazonEKSWorkerNodePolicy",
+            "aws_iam_role_policy_attachment.AmazonEKS_CNI_Policy"
+          ]
+        }
+      ]
+    },
+    {
+      "mode": "managed",
+      "type": "aws_iam_role",
+      
```

**File**: `test/data/minio-1/test-bucket/terraform_1_0.12.28.tfstate` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+{
+  "version": 4,
+  "terraform_version": "0.12.28",
+  "serial": 2,
+  "lineage": "b7d45aa5a-812a-2d1f-e5e6-835215928e00",
+  "outputs": {
+    "content": {
+      "value": "foo!",
+      "type": "string"
+    }
+  },
+  "resources": [
+    {
+      "mode": "managed",
+      "type": "local_file",
+      "name": "foo",
+      "provider": "provider.local",
+      "instances": [
+        {
+          "schema_version": 0,
+          "attributes": {
+            "content": "foo!",
+            "content_base64": null,
+            "directory_permission": "0777",
+            "file_permission": "0777",
+            "filename": "./foo.bar",
+            "id": "4bf3e335199107182c6f7638efaad377acc7f452",
+            "sensitive_content": null,
+            "source": null
+          },
+          "private": "bnVsbA=="
+        }
+      ]
+    }
+  ]
+}
```

**File**: `test/data/minio-1/test-bucket/terraform_1_0.13.5.tfstate` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+{
+  "version": 4,
+  "terraform_version": "0.13.5",
+  "serial": 3,
+  "lineage": "b7d45aa5a-812a-2d1f-e5e6-835215928e00",
+  "outputs": {
+    "content": {
+      "value": "foo!",
+      "type": "string"
+    }
+  },
+  "resources": [
+    {
+      "mode": "managed",
+      "type": "local_file",
+      "name": "foo",
+      "provider": "provider[\"registry.terraform.io/hashicorp/local\"]",
+      "instances": [
+        {
+          "schema_version": 0,
+          "attributes": {
+            "content": "foo!",
+            "content_base64": null,
+            "directory_permission": "0777",
+            "file_permission": "0777",
+            "filename": "./foo.bar",
+            "id": "4bf3e335199107182c6f7638efaad377acc7f452",
+            "sensitive_content": null,
+            "source": null
+          },
+          "private": "bnVsbA=="
+        }
+      ]
+    }
+  ]
+}
```

**File**: `test/data/minio-1/test-bucket/terraform_1_0.14.8.tfstate` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+{
+  "version": 4,
+  "terraform_version": "0.14.8",
+  "serial": 3,
+  "lineage": "b7d45aa5a-812a-2d1f-e5e6-835215928e00",
+  "outputs": {
+    "content": {
+      "value": "foo!",
+      "type": "string"
+    }
+  },
+  "resources": [
+    {
+      "mode": "managed",
+      "type": "local_file",
+      "name": "foo",
+      "provider": "provider[\"registry.terraform.io/hashicorp/local\"]",
+      "instances": [
+        {
+          "schema_version": 0,
+          "attributes": {
+            "content": "foo!",
+            "content_base64": null,
+            "directory_permission": "0777",
+            "file_permission": "0777",
+            "filename": "./foo.bar",
+            "id": "4bf3e335199107182c6f7638efaad377acc7f452",
+            "sensitive_content": null,
+            "source": null
+          },
+          "sensitive_attributes": [],
+          "private": "bnVsbA=="
+        }
+      ]
+    }
+  ]
+}
```

**File**: `test/data/minio-1/test-bucket/terraform_1_0.15.5.tfstate` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+{
+  "version": 4,
+  "terraform_version": "0.15.5",
+  "serial": 3,
+  "lineage": "b7d45aa5a-812a-2d1f-e5e6-835215928e00",
+  "outputs": {
+    "content": {
+      "value": "foo!",
+      "type": "string"
+    }
+  },
+  "resources": [
+    {
+      "mode": "managed",
+      "type": "local_file",
+      "name": "foo",
+      "provider": "provider[\"registry.terraform.io/hashicorp/local\"]",
+      "instances": [
+        {
+          "schema_version": 0,
+          "attributes": {
+            "content": "foo!",
+            "content_base64": null,
+            "directory_permission": "0777",
+            "file_permission": "0777",
+            "filename": "./foo.bar",
+            "id": "4bf3e335199107182c6f7638efaad377acc7f452",
+            "sensitive_content": null,
+            "source": null
+          },
+          "sensitive_attributes": [],
+          "private": "bnVsbA=="
+        }
+      ]
+    }
+  ]
+}
```

**File**: `test/data/minio-1/test-bucket/terraform_1_1.0.0.tfstate` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+{
+  "version": 4,
+  "terraform_version": "1.0.0",
+  "serial": 3,
+  "lineage": "b7d45aa5a-812a-2d1f-e5e6-835215928e00",
+  "outputs": {
+    "content": {
+      "value": "foo!",
+      "type": "string"
+    }
+  },
+  "resources": [
+    {
+      "mode": "managed",
+      "type": "local_file",
+      "name": "foo",
+      "provider": "provider[\"registry.terraform.io/hashicorp/local\"]",
+      "instances": [
+        {
+          "schema_version": 0,
+          "attributes": {
+            "content": "foo!",
+            "content_base64": null,
+            "directory_permission": "0777",
+            "file_permission": "0777",
+            "filename": "./foo.bar",
+            "id": "4bf3e335199107182c6f7638efaad377acc7f452",
+            "sensitive_content": null,
+            "source": null
+          },
+          "sensitive_attributes": [],
+          "private": "bnVsbA=="
+        }
+      ]
+    }
+  ]
+}
```

---

### Incident Patch 12: `6d50bf58` (2021-10-26)
**Commit Message**: fix(swagger): move swagger redirection on / instead on /swagger/ (#221)

* fix(swagger): move swagger redirection on / instead on /swagger/
docs(swagger): add exit_code field to submit plan request

* feat(swagger): allow swagger port configuration

**File**: `api/api.go` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@ type planPayload struct {
 	GitCommit string         `json:"git_commit"`
 	CiURL     string         `json:"ci_url"`
 	Source    string         `json:"source"`
+	ExitCode  int            `json:"exit_code"`
 	PlanJSON  datatypes.JSON `json:"plan_json" swaggertype:"object"`
 }
 
```

**File**: `api/api_test.go` (modified, +1/-1)
```diff
@@ -540,7 +540,7 @@ func TestSubmitPlan(t *testing.T) {
 	}
 
 	buf := httptest.NewRecorder()
-	req := httptest.NewRequest(http.MethodPost, `/plans`, bytes.NewReader([]byte(`{"lineage":"lineage_value","terraform_version":"1.0.0","git_remote":"foo.com","git_commit":"#12345","ci_url":"","source":"","plan_json":{"format_version":"0.1","terraform_version":"0.12.6","planned_values":{"root_module":{"resources":[{"address":"aws_autoscaling_group.my_asg","mode":"managed","type":"aws_autoscaling_group","name":"my_asg","provider_name":"aws","schema_version":0,"values":{"availability_zones":["us-west-1a"],"desired_capacity":4,"enabled_metrics":null,"force_delete":true,"health_check_grace_period":300,"health_check_type":"ELB","initial_lifecycle_hook":[],"launch_configuration":"my_web_config","launch_template":[],"max_size":5,"metrics_granularity":"1Minute","min_elb_capacity":null,"min_size":1,"mixed_instances_policy":[],"name":"my_asg","name_prefix":null,"placement_group":null,"protect_from_scale_in":false,"suspended_processes":null,"tag":[],"tags":null,"termination_policies":null,"timeouts":null,"wait_for_capacity_timeout":"10m","wait_for_elb_capacity":null}},{"address":"aws_instance.web","mode":"managed","type":"aws_instance","name":"web","provider_name":"aws","schema_version":1,"values":{"ami":"ami-09b4b74c","credit_specification":[],"disable_api_termination":null,"ebs_optimized":null,"get_password_data":false,"iam_instance_profile":null,"instance_initiated_shutdown_behavior":null,"instance_type":"t2.micro","monitoring":null,"source_dest_check":true,"tags":null,"timeouts":null,"user_data":null,"user_data_base64":null}},{"address":"aws_launch_configuration.my_web_config","mode":"managed","type":"aws_launch_configuration","name":"my_web_config","provider_name":"aws","schema_version":0,"values":{"associate_public_ip_address":false,"enable_monitoring":true,"ephemeral_block_device":[],"iam_instance_profile":null,"image_id":"ami-09b4b74c","instance_type":"t2.micro","name":"my_web_config","name_prefix":null,"placement_tenancy":null,"security_groups":null,"spot_price":null,"user_data":null,"user_data_base64":null,"vpc_classic_link_id":null,"vpc_classic_link_security_groups":null}}]}},"resource_changes":[{"address":"aws_autoscaling_group.my_asg","mode":"managed","type":"aws_autoscaling_group","name":"my_asg","provider_name":"aws","change":{"actions":["create"],"before":null,"after":{"availability_zones":["us-west-1a"],"desired_capacity":4,"enabled_metrics":null,"force_delete":true,"health_check_grace_period":300,"health_check_type":"ELB","initial_lifecycle_hook":[],"launch_configuration":"my_web_config","launch_template":[],"max_size":5,"metrics_granularity":"1Minute","min_elb_capacity":null,"min_size":1,"mixed_instances_policy":[],"name":"my_asg","name_prefix":null,"placement_group":null,"protect_from_scale_in":false,"suspended_processes":null,"tag":[],"tags":null,"termination_policies":null,"timeouts":null,"wait_for_capacity_timeout":"10m","wait_for_elb_capacity":null},"after_unknown":{"arn":true,"availability_zones":[false],"default_cooldown":true,"id":true,"initial_lifecycle_hook":[],"launch_template":[],"load_balancers":true,"mixed_instances_policy":[],"service_linked_role_arn":true,"tag":[],"target_group_arns":true,"vpc_zone_identifier":true}}},{"address":"aws_instance.web","mode":"managed","type":"aws_instance","name":"web","provider_name":"aws","change":{"actions":["create"],"before":null,"after":{"ami":"ami-09b4b74c","credit_specification":[],"disable_api_termination":null,"ebs_optimized":null,"get_password_data":false,"iam_instance_profile":null,"instance_initiated_shutdown_behavior":null,"instance_type":"t2.micro","monitoring":null,"source_dest_check":true,"tags":null,"timeouts":null,"user_data":null,"user_data_base64":null},"after_unknown":{"arn":true,"associate_public_ip_address":true,"availability_zone":true,"cpu_core_count":true,"cpu_threads_per_core":true,"credit_specification":[],"ebs_block_device":true,"ephemeral_block_device":true,"host_id":true,"id":true,"instance_state":true,"ipv6_address_count":true,"ipv6_addresses":true,"key_name":true,"network_interface":true,"network_interface_id":true,"password_data":true,"placement_group":true,"primary_network_interface_id":true,"private_dns":true,"private_ip":true,"public_dns":true,"public_ip":true,"root_block_device":true,"security_groups":true,"subnet_id":true,"tenancy":true,"volume_tags":true,"vpc_security_group_ids":true}}},{"address":"aws_launch_configuration.my_web_config","mode":"managed","type":"aws_launch_configuration","name":"my_web_config","provider_name":"aws","change":{"actions":["create"],"before":null,"after":{"associate_public_ip_address":false,"enable_monitoring":true,"ephemeral_block_device":[],"iam_instance_profile":null,"image_id":"ami-09b4b74c","instance_type":"t2.micro","name":"my_web_config","name_prefix":null,"placement_tenancy":null,"security_groups":null,"spot_price":null,"user_data":null,"user_data_base64":null,"vpc_classic_link_id":nul
```

**File**: `config/config.go` (modified, +4/-3)
```diff
@@ -98,9 +98,10 @@ type GitlabConfig struct {
 
 // WebConfig stores the UI interface parameters
 type WebConfig struct {
-	Port      uint16 `short:"p" long:"port" env:"TERRABOARD_PORT" yaml:"port" description:"Port to listen on." default:"8080"`
-	BaseURL   string `long:"base-url" env:"TERRABOARD_BASE_URL" yaml:"base-url" description:"Base URL." default:"/"`
-	LogoutURL string `long:"logout-url" env:"TERRABOARD_LOGOUT_URL" yaml:"logout-url" description:"Logout URL."`
+	Port        uint16 `short:"p" long:"port" env:"TERRABOARD_PORT" yaml:"port" description:"Port to listen on." default:"8080"`
+	SwaggerPort uint16 `long:"swagger-port" env:"TERRABOARD_SWAGGER_PORT" yaml:"swagger-port" description:"Port for swagger to listen on." default:"8081"`
+	BaseURL     string `long:"base-url" env:"TERRABOARD_BASE_URL" yaml:"base-url" description:"Base URL." default:"/"`
+	LogoutURL   string `long:"logout-url" env:"TERRABOARD_LOGOUT_URL" yaml:"logout-url" description:"Logout URL."`
 }
 
 // ProviderConfig stores genral provider parameters
```

**File**: `config/config_test.go` (modified, +8/-6)
```diff
@@ -75,9 +75,10 @@ func TestLoadConfig(t *testing.T) {
 			},
 		},
 		Web: WebConfig{
-			Port:      8080,
-			BaseURL:   "/",
-			LogoutURL: "",
+			Port:        8080,
+			SwaggerPort: 8081,
+			BaseURL:     "/",
+			LogoutURL:   "",
 		},
 	}
 
@@ -142,9 +143,10 @@ func TestLoadConfigFromYaml(t *testing.T) {
 			},
 		},
 		Web: WebConfig{
-			Port:      39090,
-			BaseURL:   "/test/",
-			LogoutURL: "/test-logout",
+			Port:        39090,
+			SwaggerPort: 8081,
+			BaseURL:     "/test/",
+			LogoutURL:   "/test-logout",
 		},
 	}
 
```

**File**: `config/config_test.yml` (modified, +1/-0)
```diff
@@ -37,5 +37,6 @@ gitlab:
 
 web:
   port: 39090
+  swagger-port: 8081
   base-url: /test/
   logout-url: /test-logout
```

**File**: `docs/docs.go` (modified, +3/-0)
```diff
@@ -504,6 +504,9 @@ var doc = `{
                 "ci_url": {
                     "type": "string"
                 },
+                "exit_code": {
+                    "type": "integer"
+                },
                 "git_commit": {
                     "type": "string"
                 },
```

**File**: `docs/swagger.json` (modified, +3/-0)
```diff
@@ -490,6 +490,9 @@
                 "ci_url": {
                     "type": "string"
                 },
+                "exit_code": {
+                    "type": "integer"
+                },
                 "git_commit": {
                     "type": "string"
                 },
```

**File**: `docs/swagger.yaml` (modified, +2/-0)
```diff
@@ -4,6 +4,8 @@ definitions:
     properties:
       ci_url:
         type: string
+      exit_code:
+        type: integer
       git_commit:
         type: string
       git_remote:
```

---

### Incident Patch 13: `4e6d2b6e` (2021-09-01)
**Commit Message**: fix(frontend): performence issue on plans fetching (#212)

feat(frontend): add loading spinner during plan fetching

**File**: `api/api.go` (modified, +49/-1)
```diff
@@ -274,6 +274,50 @@ func SubmitPlan(w http.ResponseWriter, r *http.Request, db *db.Database) {
 	}
 }
 
+// GetPlansSummary provides summary of all Plan by lineage (only metadata added by the wrapper).
+// Optional "&limit=X" parameter to limit requested quantity of plans.
+// Optional "&page=X" parameter to add an offset to the query and enable pagination.
+// Sorted by most recent to oldest.
+// /api/plans/summary GET endpoint callback
+// Also return pagination informations (current page ans total items count in database)
+func GetPlansSummary(w http.ResponseWriter, r *http.Request, db *db.Database) {
+	lineage := r.URL.Query().Get("lineage")
+	limit := r.URL.Query().Get("limit")
+	page := r.URL.Query().Get("page")
+	plans, currentPage, total := db.GetPlansSummary(lineage, limit, page)
+
+	response := make(map[string]interface{})
+	response["plans"] = plans
+	response["page"] = currentPage
+	response["total"] = total
+	j, err := json.Marshal(response)
+	if err != nil {
+		log.Errorf("Failed to marshal plans: %v", err)
+		JSONError(w, "Failed to marshal plans", err)
+		return
+	}
+	if _, err := io.WriteString(w, string(j)); err != nil {
+		log.Error(err.Error())
+	}
+}
+
+// GetPlan provides a specific Plan of a lineage using ID.
+// /api/plans GET endpoint callback on request with ?plan_id=X parameter
+func GetPlan(w http.ResponseWriter, r *http.Request, db *db.Database) {
+	id := r.URL.Query().Get("planid")
+	plan := db.GetPlan(id)
+
+	j, err := json.Marshal(plan)
+	if err != nil {
+		log.Errorf("Failed to marshal plan: %v", err)
+		JSONError(w, "Failed to marshal plan", err)
+		return
+	}
+	if _, err := io.WriteString(w, string(j)); err != nil {
+		log.Error(err.Error())
+	}
+}
+
 // GetPlans provides all Plan by lineage.
 // Optional "&limit=X" parameter to limit requested quantity of plans.
 // Optional "&page=X" parameter to add an offset to the query and enable pagination.
@@ -305,7 +349,11 @@ func GetPlans(w http.ResponseWriter, r *http.Request, db *db.Database) {
 // on /api/plans request
 func ManagePlans(w http.ResponseWriter, r *http.Request, db *db.Database) {
 	if r.Method == "GET" {
-		GetPlans(w, r, db)
+		if r.URL.Query().Get("planid") != "" {
+			GetPlan(w, r, db)
+		} else {
+			GetPlans(w, r, db)
+		}
 	} else if r.Method == "POST" {
 		SubmitPlan(w, r, db)
 	} else {
```

**File**: `db/db.go` (modified, +77/-0)
```diff
@@ -619,6 +619,83 @@ func (db *Database) InsertPlan(plan []byte) error {
 	return db.Create(&p).Error
 }
 
+// GetPlansSummary retrieves a summary of all Plans of a lineage from the database
+func (db *Database) GetPlansSummary(lineage, limitStr, pageStr string) (plans []types.Plan, page int, total int) {
+	var whereClause []interface{}
+	var whereClauseTotal string
+	if lineage != "" {
+		whereClause = append(whereClause, `"Lineage"."value" = ?`, lineage)
+		whereClauseTotal = ` JOIN lineages on lineages.id=t.lineage_id WHERE lineages.value = ?`
+	}
+
+	row := db.Raw("SELECT count(*) FROM plans AS t"+whereClauseTotal, lineage).Row()
+	if err := row.Scan(&total); err != nil {
+		log.Error(err.Error())
+	}
+
+	var limit int
+	if limitStr == "" {
+		limit = -1
+	} else {
+		var err error
+		limit, err = strconv.Atoi(limitStr)
+		if err != nil {
+			log.Warnf("GetPlans limit ignored: %v", err)
+			limit = -1
+		}
+	}
+
+	var offset int
+	if pageStr == "" {
+		offset = -1
+	} else {
+		var err error
+		page, err = strconv.Atoi(pageStr)
+		if err != nil {
+			log.Warnf("GetPlans offset ignored: %v", err)
+		} else {
+			offset = (page - 1) * pageSize
+		}
+	}
+
+	db.Select(`"plans"."id"`, `"plans"."created_at"`, `"plans"."updated_at"`, `"plans"."tf_version"`,
+		`"plans"."git_remote"`, `"plans"."git_commit"`, `"plans"."ci_url"`, `"plans"."source"`).
+		Joins("Lineage").
+		Order("created_at desc").
+		Limit(limit).
+		Offset(offset).
+		Find(&plans, whereClause...)
+
+	return
+}
+
+// GetPlan retrieves a specific Plan by his ID from the database
+func (db *Database) GetPlan(id string) (plans types.Plan) {
+	db.Joins("Lineage").
+		Preload("ParsedPlan").
+		Preload("ParsedPlan.PlanStateValue").
+		Preload("ParsedPlan.PlanStateValue.PlanStateOutputs").
+		Preload("ParsedPlan.PlanStateValue.PlanStateModule").
+		Preload("ParsedPlan.PlanStateValue.PlanStateModule.PlanStateResources").
+		Preload("ParsedPlan.PlanStateValue.PlanStateModule.PlanStateResources.PlanStateResourceAttributes").
+		Preload("ParsedPlan.PlanStateValue.PlanStateModule.PlanStateModules").
+		Preload("ParsedPlan.Variables").
+		Preload("ParsedPlan.PlanResourceChanges").
+		Preload("ParsedPlan.PlanResourceChanges.Change").
+		Preload("ParsedPlan.PlanOutputs").
+		Preload("ParsedPlan.PlanOutputs.Change").
+		Preload("ParsedPlan.PlanState").
+		Preload("ParsedPlan.PlanState.PlanStateValue").
+		Preload("ParsedPlan.PlanState.PlanStateValue.PlanStateOutputs").
+		Preload("ParsedPlan.PlanState.PlanStateValue.PlanStateModule").
+		Preload("ParsedPlan.PlanState.PlanStateValue.PlanStateModule.PlanStateResources").
+		Preload("ParsedPlan.PlanState.PlanStateValue.PlanStateModule.PlanStateResources.PlanStateResourceAttributes").
+		Preload("ParsedPlan.PlanState.PlanStateValue.PlanStateModule.PlanStateModules").
+		Find(&plans, `"plans"."id" = ?`, id)
+
+	return
+}
+
 // GetPlans retrieves all Plan of a lineage from the database
 func (db *Database) GetPlans(lineage, limitStr, pageStr string) (plans []types.Plan, page int, total int) {
 	var whereClause []interface{}
```

**File**: `main.go` (modified, +1/-0)
```diff
@@ -189,6 +189,7 @@ func main() {
 	apiRouter.HandleFunc(util.GetFullPath("attribute/keys"), handleWithDB(api.ListAttributeKeys, database))
 	apiRouter.HandleFunc(util.GetFullPath("tf_versions"), handleWithDB(api.ListTfVersions, database))
 	apiRouter.HandleFunc(util.GetFullPath("plans"), handleWithDB(api.ManagePlans, database))
+	apiRouter.HandleFunc(util.GetFullPath("plans/summary"), handleWithDB(api.GetPlansSummary, database))
 
 	// Serve static files (CSS, JS, images) from dir
 	spa := spaHandler{staticPath: "static", indexPath: "index.html"}
```

**File**: `static/terraboard-vuejs/src/views/Lineage.vue` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ class ObjWrapper {
             this.data.push(entry)
           });
 
-          const url = `/api/plans?lineage=`+this.lineage;
+          const url = `/api/plans/summary?lineage=`+this.lineage;
           axios.get(url)
             .then((response) => {
               // handle success
```

**File**: `static/terraboard-vuejs/src/views/Plan.vue` (modified, +35/-14)
```diff
@@ -9,7 +9,7 @@
                 <li
                   v-for="plan in plans"
                   v-bind:key="plan"
-                  v-bind:class="{ selected: plan == selectedPlan }"
+                  v-bind:class="{ selected: selectedPlan !== undefined && plan.ID == selectedPlan.ID }"
                   @click="setPlanSelected(plan)"
                   class="list-group-item plan"
                 >
@@ -19,12 +19,15 @@
         </div>
       </div>
     </div>
-    <div id="node" class="col-xl-8 col-xxl-9">
+    <div id="node h-100" :key="selectedPlan" class="col-xl-8 col-xxl-9">
       <PlanContent
-        v-if="selectedPlan.parsed_plan !== undefined"
+        v-if="selectedPlan !== undefined && selectedPlan.parsed_plan !== undefined"
         v-bind:plan="selectedPlan"
         v-bind:key="selectedPlan"
       />
+      <div v-else class="h-100 w-100 text-center">
+        <i class="fas fa-spinner fa-spin fa-5x"></i>
+      </div>
     </div>
   </div>
 </template>
@@ -62,8 +65,8 @@ import PlanContent from "../components/PlanContent.vue";
     formatDate(date: string): string {
         return new Date(date).toUTCString();
     },
-    fetchLatestPlans(limit: number): void {
-      const url = `/api/plans?limit=`+limit+`&lineage=`+this.url.lineage;
+    fetchLatestPlansSummary(limit: number): void {
+      const url = `/api/plans/summary?limit=`+limit+`&lineage=`+this.url.lineage;
       axios
         .get(url)
         .then((response) => {
@@ -79,7 +82,7 @@ import PlanContent from "../components/PlanContent.vue";
               }
             });
             if (planFinded === false) {
-              const url = `/api/plans?lineage=`+this.url.lineage;
+              const url = `/api/plans/summary?lineage=`+this.url.lineage;
               axios
                 .get(url)
                 .then((response) => {
@@ -121,20 +124,38 @@ import PlanContent from "../components/PlanContent.vue";
         });
     },
     setPlanSelected(plan: any): void {
-      this.selectedPlan = plan;
-      router.replace({
-        path: `/lineage/${this.url.lineage}/plans`,
-        query: { 
-          planid: plan.ID,
-        },
-      });
+      this.selectedPlan = undefined;
+      const url = `/api/plans?planid=`+plan.ID;
+      axios
+        .get(url)
+        .then((response) => {
+          this.selectedPlan = response.data;
+          router.replace({
+            path: `/lineage/${this.url.lineage}/plans`,
+            query: { 
+              planid: this.selectedPlan.ID,
+            },
+          });
+        })
+        .catch(function(err) {
+          if (err.response) {
+            console.log("Server Error:", err);
+          } else if (err.request) {
+            console.log("Network Error:", err);
+          } else {
+            console.log("Client Error:", err);
+          }
+        })
+        .then(function() {
+          // always executed
+        });
     },
   },
   created() {
     this.updateTitle();
     this.url.lineage = this.$route.params.lineage;
     this.url.planid = router.currentRoute.value.query.planid;
-    this.fetchLatestPlans(10);
+    this.fetchLatestPlansSummary(10);
   },
   updated() {
     hljs.highlightAll();
```

**File**: `static/terraboard-vuejs/src/views/PlansExplorer.vue` (modified, +1/-1)
```diff
@@ -161,7 +161,7 @@ import router from "../router";
         .join("&");
 
       router.push({ name: "PlansExplorer", query: params });
-      const url = `/api/plans?` + query;
+      const url = `/api/plans/summary?` + query;
       axios
         .get(url)
         .then((response) => {
```

---

### Incident Patch 14: `a5d6050f` (2021-09-01)
**Commit Message**: fix(frontend): undefined error on plan view without outputs changes (#211)

* fix(frontend): undefined error on plan view without outputs

* feat(frontend): add link to go back to lineage on plan/state views

**File**: `static/terraboard-vuejs/src/components/PlanContent.vue` (modified, +74/-65)
```diff
@@ -58,7 +58,7 @@
             <tbody>
               <tr>
                 <td>Lineage:</td>
-                <td>{{ plan.lineage_data.lineage }}</td>
+                <td><router-link :to="`/lineage/${plan.lineage_data.lineage}`">{{ plan.lineage_data.lineage }}</router-link></td>
               </tr>
               <tr>
                 <td>TF Version:</td>
@@ -88,11 +88,11 @@
                 <td>Changes:</td>
                 <td>
                   <div class="row justify-content-middle align-middle">
-                    <div class="overview-chart col-5 text-center" style="min-width: 150px; max-width: 240px;">
+                    <div v-if="this.plan.parsed_plan.resource_changes != undefined" class="overview-chart col-5 text-center" style="min-width: 150px; max-width: 240px;">
                         <canvas id="chart-pie-resource-changes" class="chart mb-2"></canvas>
                         <p>Resource changes</p>
                     </div>
-                    <div class="overview-chart col-5 text-center" style="min-width: 150px; max-width: 240px;">
+                    <div v-if="this.plan.parsed_plan.output_changes != undefined" class="overview-chart col-5 text-center" style="min-width: 150px; max-width: 240px;">
                         <canvas id="chart-pie-output-changes" class="chart mb-2"></canvas>
                         <p>Output changes</p>
                     </div>
@@ -254,30 +254,35 @@ Chart.register( PieController, ArcElement, Tooltip )
       return new Date(date).toUTCString();
     },
     checkPlannedChanges() {
-      this.plan.parsed_plan.output_changes.forEach((change: any) => {
-        let actions = change.change.actions;
-        if (actions.includes("create")) {
-          this.changes.outputs.added++;
-        } else if (actions.includes("update")) {
-          this.changes.outputs.changed++;
-        } else if (actions.includes("delete")) {
-          this.changes.outputs.deleted++;
-        } else {
-          this.changes.outputs.none++;
-        }
-      });
-      this.plan.parsed_plan.resource_changes.forEach((change: any) => {
-        let actions = change.change.actions;
-        if (actions.includes("create")) {
-          this.changes.resources.added++;
-        } else if (actions.includes("update")) {
-          this.changes.resources.changed++;
-        } else if (actions.includes("delete")) {
-          this.changes.resources.deleted++;
-        } else {
-          this.changes.resources.none++;
-        }
-      });
+      if (this.plan.parsed_plan.output_changes != undefined) {
+        this.plan.parsed_plan.output_changes.forEach((change: any) => {
+          let actions = change.change.actions;
+          if (actions.includes("create")) {
+            this.changes.outputs.added++;
+          } else if (actions.includes("update")) {
+            this.changes.outputs.changed++;
+          } else if (actions.includes("delete")) {
+            this.changes.outputs.deleted++;
+          } else {
+            this.changes.outputs.none++;
+          }
+        });
+      }
+
+      if (this.plan.parsed_plan.resource_changes != undefined) {
+        this.plan.parsed_plan.resource_changes.forEach((change: any) => {
+          let actions = change.change.actions;
+          if (actions.includes("create")) {
+            this.changes.resources.added++;
+          } else if (actions.includes("update")) {
+            this.changes.resources.changed++;
+          } else if (actions.includes("delete")) {
+            this.changes.resources.deleted++;
+          } else {
+            this.changes.resources.none++;
+          }
+        });
+      }
     },
   },
   computed: {
@@ -303,45 +308,49 @@ Chart.register( PieController, ArcElement, Tooltip )
     this.checkPlannedChanges();
   },
   mounted() {
-    const ctxResources = document.getElementById('chart-pie-resource-changes') as ChartItem;
-    const resourceChangesChart = new Chart(ctxResources, {
-        type: 'pie',
-        data: {
-            labels: ["No changes", "Added", "Updated", "Deleted"],
-            datasets: [{
-                label: 'Resource Changes',
-                data: [this.changes.resources.none, this.changes.resources.added, this.changes.resources.changed, this.changes.resources.deleted],
-                backgroundColor: [
-                  '#0d6efd',
-                  '#198754',
-                  '#fd7e14',
-                  '#dc3545',
-                ],
-                hoverOffset: 4
-            }]
-        },
-        options: this.chartOptions
-    });
+    if (this.plan.parsed_plan.resource_changes != undefined) {
+      const ctxResources = document.getElementById('chart-pie-resource-changes') as ChartItem;
+      const resourceChangesChart = new Chart(ctxResources, {
+          type: 'pie',
+          data: {
+              labels: ["No changes", "Added", "Updated", "Deleted"],
+              datasets: [{
+                  label: 'Resource Changes',
+                
```

**File**: `static/terraboard-vuejs/src/views/Plan.vue` (modified, +2/-1)
```diff
@@ -2,7 +2,8 @@
   <div id="mainrow" class="row">
     <div id="leftcol" class="col-xl-4 col-xxl-3">
       <div class="mr-4">
-        <div id="nodes" class="card mt-4">
+        <router-link class="ms-2" :to="`/lineage/${url.lineage}`"><i class="fas fa-arrow-left"></i> Back to workspace</router-link>
+        <div id="nodes" class="card mt-2">
           <h5 class="card-header">Plans</h5>
               <ul id="nodeslist" class="list-group m-3">
                 <li
```

**File**: `static/terraboard-vuejs/src/views/State.vue` (modified, +2/-1)
```diff
@@ -2,7 +2,8 @@
   <div id="mainrow" class="row">
     <div id="leftcol" class="col-xl-4 col-xxl-3">
       <div class="mr-4">
-        <div class="card">
+        <router-link class="ms-2" :to="`/lineage/${url.lineage}`"><i class="fas fa-arrow-left"></i> Back to workspace</router-link>
+        <div class="card mt-2">
           <h5 class="card-header">
             General Information
             <span
```

---

### Incident Patch 15: `91b3dab0` (2021-08-30)
**Commit Message**: fix(json): plan's variables parsing error (#210)

**File**: `types/db.go` (modified, +4/-4)
```diff
@@ -109,7 +109,7 @@ type PlanModel struct {
 	PlanStateValueID sql.NullInt64  `gorm:"index" json:"-"`
 
 	// The variables set in the root module when creating the plan.
-	Variables []PlanModelVariable `json:"variables,omitempty"`
+	Variables planVariableList `json:"variables,omitempty"`
 
 	// The change operations for resources and data sources within this
 	// plan.
@@ -204,7 +204,7 @@ type PlanStateResource struct {
 	// empty.
 	//
 	// This value can be either an integer (int) or a string.
-	Index string `json:"index,omitempty"`
+	Index rawJSON `json:"index,omitempty"`
 
 	// The name of the provider this resource belongs to. This allows
 	// the provider to be interpreted unambiguously in the unusual
@@ -224,7 +224,7 @@ type PlanStateResource struct {
 	PlanStateResourceAttributes planStateResourceAttributeList `json:"values,omitempty"`
 
 	// The addresses of the resources that this resource depends on.
-	DependsOn string `json:"depends_on,omitempty"`
+	DependsOn rawJSON `json:"depends_on,omitempty"`
 
 	// If true, the resource has been marked as tainted and will be
 	// re-created on the next update.
@@ -270,7 +270,7 @@ type PlanResourceChange struct {
 	// empty.
 	//
 	// This value can be either an integer (int) or a string.
-	Index string `json:"index,omitempty"`
+	Index rawJSON `json:"index,omitempty"`
 
 	// The name of the provider this resource belongs to. This allows
 	// the provider to be interpreted unambiguously in the unusual
```

**File**: `types/json.go` (modified, +20/-0)
```diff
@@ -11,6 +11,7 @@ import (
  *********************************************/
 
 type planOutputList []PlanOutput
+type planVariableList []PlanModelVariable
 type planStateOutputList []PlanStateOutput
 type planStateResourceAttributeList []PlanStateResourceAttribute
 type rawJSON string
@@ -35,6 +36,25 @@ func (p *planOutputList) UnmarshalJSON(b []byte) error {
 	return nil
 }
 
+func (p *planVariableList) UnmarshalJSON(b []byte) error {
+	var tmp map[string]interface{}
+	err := json.Unmarshal(b, &tmp)
+	if err != nil {
+		return err
+	}
+
+	var list planVariableList
+	for key, value := range tmp {
+		list = append(list, PlanModelVariable{
+			Key:   key,
+			Value: fmt.Sprintf("%v", value),
+		})
+	}
+
+	*p = list
+	return nil
+}
+
 func (p *planStateOutputList) UnmarshalJSON(b []byte) error {
 	tmp := map[string]PlanStateOutput{}
 	err := json.Unmarshal(b, &tmp)
```

#### Recent Merged Pull Requests:
- **PR #332** (closed): chore(deps): bump axios from 1.7.2 to 1.15.2 in /static/terraboard-vuejs (@dependabot[bot])
- **PR #329** (closed): chore(deps): bump github.com/jackc/pgx/v5 from 5.5.5 to 5.9.0 (@dependabot[bot])
- **PR #326** (closed): chore(deps): bump axios from 1.7.2 to 1.15.0 in /static/terraboard-vuejs (@dependabot[bot])
- **PR #316** (closed): chore(deps): bump axios from 1.7.2 to 1.13.5 in /static/terraboard-vuejs (@dependabot[bot])
- **PR #314** (closed): chore(deps): bump lodash from 4.17.21 to 4.17.23 in /static/terraboard-vuejs (@dependabot[bot])
- **PR #312** (closed): chore(deps): bump node-forge from 1.3.1 to 1.3.2 in /static/terraboard-vuejs (@dependabot[bot])
- **PR #311** (closed): chore(deps): bump js-yaml from 3.14.1 to 3.14.2 in /static/terraboard-vuejs (@dependabot[bot])
- **PR #310** (closed): chore(deps): bump golang.org/x/crypto from 0.25.0 to 0.45.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

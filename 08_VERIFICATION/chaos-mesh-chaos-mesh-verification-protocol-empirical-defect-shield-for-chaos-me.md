# Verification Protocol: Verification Protocol: Empirical Defect Shield for chaos-mesh/chaos-mesh

<!-- PROVENANCE_START
{
  "source_repository": "chaos-mesh/chaos-mesh",
  "source_url": "https://github.com/chaos-mesh/chaos-mesh",
  "source_version": "fdb9684b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-22T20:56:11.017Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-chaos-mesh-chaos-mesh",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [chaos-mesh/chaos-mesh](https://github.com/chaos-mesh/chaos-mesh) (Revision: `fdb9684b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-22T20:56:11.017Z`  
> **Learning ID**: `learn-github-chaos-mesh-chaos-mesh`


## 1. Scope & Verification Target
- **Target Repository**: `chaos-mesh/chaos-mesh` (Commit: `fdb9684b`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): chaos-mesh/chaos-mesh

> **Canonical Artifact**: `07_PROJECT_LEARNING/chaos-mesh-chaos-mesh-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chaos-mesh/chaos-mesh](https://github.com/chaos-mesh/chaos-mesh))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T20:56:09.312Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chaos-mesh/chaos-mesh`
- **Description**: A Chaos Engineering Platform for Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 7993 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/genericwebhook/bfs.go`
```
// Copyright 2021 Chaos Mesh Authors.
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

package genericwebhook

import (
	"container/list"
	"reflect"

	"k8s.io/apimachinery/pkg/util/validation/field"
)

type fieldCallback func(path *field.Path, obj any, field *reflect.StructField) bool

type FieldWalker struct {
	obj      any
	callback fieldCallback
}

func NewFieldWalker(obj any, callback fieldCallback) *FieldWalker {
	return &FieldWalker{
		obj:      obj,
		callback: callback,
	}
}

type iterateNode struct {
	Val   reflect.Value
	Path  *field.Path
	Field *reflect.StructField
}

func (w *FieldWalker) Walk() {
	objVal := reflect.ValueOf(w.obj)

	items := list.New()
	items.PushBack(iterateNode{
		Val:  objVal,
		Path: nil,
	})

	for {
		if items.Len() == 0 {
			break
		}

		item := items.Front()
		items.Remove(item)

		node := item.Value.(iterateNode)
		// If node is not the root node, then we need to check whether
		// we need to iterate its children.
		if node.Path != nil {
			val := node.Val
			if val.Kind() != reflect.Pointer {
				// If it's not a pointer or a slice, then we need to
				// take the address of it, to be able to modify it.
				val = val.Addr()
			}
			if !w.callback(node.Path, val.Interface(), node.Field) {
				continue
			}
		}

		if node.Val.Kind() == reflect.Pointer && node.Val.IsZero() {
			continue
		}
		objVal = reflect.Indirect(node.Val)
		objType := objVal.Type()
		switch objType.Kind() {
		case reflect.Struct:
			for i := 0; i < objVal.NumField(); i++ {
				field := objType.Field(i)
				fieldVal := objVal.Field(i)

				// The field should be exported
				if fieldVal.CanInterface() {
					items.PushBack(iterateNode{
						Val:   fieldVal,
						Path:  node.Path.Child(field.Name),
						Field: &field,
					})
				}
			}
		case reflect.Slice:
			for i := 0; i < objVal.Len(); i++ {
				items.PushBack(iterateNode{
					Val:   objVal.Index(i),
					Path:  node.Path.Index(i),
					Field: nil,
				})
			}
		}

	}
}

```

### Core Architecture Module: `api/genericwebhook/defaulter.go`
```
// Copyright 2021 Chaos Mesh Authors.
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

package genericwebhook

import (
	"reflect"
	"strings"

	"k8s.io/apimachinery/pkg/util/validation/field"
)

type Defaulter interface {
	Default(root any, field *reflect.StructField)
}

// Default would walk through all the fields of target struct recursively, and set the default value which declared with struct tag "default".
//
// Parameter obj should be a pointer to a data struct.
//
// Default should return an empty field.ErrorList.
func Default(obj any) field.ErrorList {
	// TODO: how to resolve invalid input, for example: obj is a pointer to pointer
	errorList := field.ErrorList{}

	root := obj
	walker := NewFieldWalker(obj, func(_ *field.Path, obj any, field *reflect.StructField) bool {
		webhookAttr := ""
		if field != nil {
			webhookAttr = field.Tag.Get("webhook")
		}
		attributes := strings.Split(webhookAttr, ",")

		webhook := ""
		nilable := false
		if len(attributes) > 0 {
			webhook = attributes[0]
		}
		if len(attributes) > 1 {
			nilable = attributes[1] == "nilable"
		}

		defaulter := getDefaulter(obj, webhook, nilable)
		if defaulter != nil {
			defaulter.Default(root, field)
		}

		return true
	})
	walker.Walk()

	return errorList
}

func getDefaulter(obj any, webhook string, nilable bool) Defaulter {
	// There are two possible situations:
	// 1. The field is a value (int, string, normal struct, etc), and the obj is the reference of it.
	// 2. The field is a pointer to a value or a slice, then the obj is itself.

	val := reflect.ValueOf(obj)

	if defaulter, ok := obj.(Defaulter); ok {
		if nilable || !val.IsZero() {
			return defaulter
		}
	}

	if webhook != "" {
		webhookImpl := webhooks[webhook]

		v := val.Convert(webhookImpl).Interface()
		if defaulter, ok := v.(Defaulter); ok {
			if nilable || !val.IsZero() {
				return defaulter
			}
		}
	}

	return nil
}

```

### Core Architecture Module: `api/genericwebhook/validater.go`
```
// Copyright 2021 Chaos Mesh Authors.
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

package genericwebhook

import (
	"reflect"
	"strings"

	"github.com/pkg/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

type FieldValidator interface {
	Validate(root any, path *field.Path) field.ErrorList
}

// Validate would walk through all the fields of target struct recursively, and validate the value with validator declared with struct tag "webhook".
//
// Parameter obj should be a pointer to a data struct.
//
// Validate should return an empty field.ErrorList if all the fields are valid, or return each field.Error for every invalid values.
func Validate(obj any) field.ErrorList {
	// TODO: how to resolve invalid input, for example: obj is a pointer to pointer
	errorList := field.ErrorList{}

	root := obj
	walker := NewFieldWalker(obj, func(path *field.Path, obj any, field *reflect.StructField) bool {
		webhookAttr := ""
		if field != nil {
			webhookAttr = field.Tag.Get("webhook")
		}
		attributes := strings.Split(webhookAttr, ",")

		webhook := ""
		nilable := false
		if len(attributes) > 0 {
			webhook = attributes[0]
		}
		if len(attributes) > 1 {
			nilable = attributes[1] == "nilable"
		}

		validator := getValidator(obj, webhook, nilable)
		if validator != nil {
			if err := validator.Validate(root, path); err != nil {
				errorList = append(errorList, err...)
			}
		}

		return true
	})
	walker.Walk()

	return errorList
}

func Aggregate(errs field.ErrorList) error {
	if len(errs) == 0 {
		return nil
	}

	return errors.New(errs.ToAggregate().Error())
}

func getValidator(obj any, webhook string, nilable bool) FieldValidator {
	// There are two possible situations:
	// 1. The field is a value (int, string, normal struct, etc), and the obj is the reference of it.
	// 2. The field is a pointer to a value or a slice, then the obj is itself.

	val := reflect.ValueOf(obj)

	if validator, ok := obj.(FieldValidator); ok {
		if nilable || !val.IsZero() {
			return validator
		}
	}

	if webhook != "" {
		webhookImpl := webhooks[webhook]

		v := val.Convert(webhookImpl).Interface()
		if validator, ok := v.(FieldValidator); ok {
			if nilable || !val.IsZero() {
				return validator
			}
		}
	}

	return nil
}

```

### Core Architecture Module: `api/genericwebhook/webhook.go`
```
// Copyright 2021 Chaos Mesh Authors.
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

// Package genericwebhook registers field webhooks and recursively defaults and validates structs through field tags.
package genericwebhook

import "reflect"

var webhooks = make(map[string]reflect.Type)

func Register(name string, obj reflect.Type) {
	webhooks[name] = obj
}

```

### Core Architecture Module: `api/v1alpha1/awschaos_webhook.go`
```
// Copyright 2021 Chaos Mesh Authors.
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

package v1alpha1

import (
	"reflect"

	"github.com/pkg/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/chaos-mesh/chaos-mesh/api/genericwebhook"
)

type EbsVolume string
type AWSDeviceName string

func (in *EbsVolume) Validate(root any, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}

	awsChaos := root.(*AWSChaos)
	if awsChaos.Spec.Action == DetachVolume {
		if in == nil {
			err := errors.Wrapf(errInvalidValue, "the ID of EBS volume is required on %s action", awsChaos.Spec.Action)
			allErrs = append(allErrs, field.Invalid(path, in, err.Error()))
		}
	}

	return allErrs
}

func (in *AWSDeviceName) Validate(root any, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}

	awsChaos := root.(*AWSChaos)
	if awsChaos.Spec.Action == DetachVolume {
		if in == nil {
			err := errors.Wrapf(errInvalidValue, "the name of device is required on %s action", awsChaos.Spec.Action)
			allErrs = append(allErrs, field.Invalid(path, in, err.Error()))
		}
	}

	return allErrs
}

// Validate validates aws chaos actions
func (in *AWSChaosAction) Validate(_ any, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}

	// in cannot be nil
	switch *in {
	case Ec2Stop, DetachVolume:
	case Ec2Restart:
	default:
		err := errors.WithStack(errUnknownAction)
		log.Error(err, "Wrong AWSChaos Action type")

		allErrs = append(allErrs, field.Invalid(path, in, err.Error()))
	}
	return allErrs
}

func init() {
	genericwebhook.Register("EbsVolume", reflect.PointerTo(reflect.TypeFor[EbsVolume]()))
	genericwebhook.Register("AWSDeviceName", reflect.PointerTo(reflect.TypeFor[AWSDeviceName]()))
}

```

### Core Architecture Module: `api/v1alpha1/azurechaos_webhook.go`
```
// Copyright 2022 Chaos Mesh Authors.
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

package v1alpha1

import (
	"reflect"

	"github.com/pkg/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/chaos-mesh/chaos-mesh/api/genericwebhook"
)

type DiskName string
type LUN int

func (in *DiskName) Validate(root any, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}

	azurechaos := root.(*AzureChaos)
	if azurechaos.Spec.Action == AzureDiskDetach {
		if in == nil {
			err := errors.Errorf("the name of data disk should not be empty on %s action", azurechaos.Spec.Action)
			allErrs = append(allErrs, field.Invalid(path, in, err.Error()))
		}
	}

	return allErrs
}

func (in *LUN) Validate(root any, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}

	azurechaos := root.(*AzureChaos)
	if azurechaos.Spec.Action == AzureDiskDetach {
		if in == nil {
			err := errors.Errorf("the LUN of data disk should not be empty on %s action", azurechaos.Spec.Action)
			allErrs = append(allErrs, field.Invalid(path, in, err.Error()))
		}
	}

	return allErrs
}

// Validate validates the azure chaos actions
func (in *AzureChaosAction) Validate(_ any, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}

	// in cannot be nil
	switch *in {
	case AzureVmStop, AzureDiskDetach:
	case AzureVmRestart:
	default:
		err := errors.New("azurechaos has an unknown action type")
		log.Error(err, "Unknown AzureChaos action type")

		allErrs = append(allErrs, field.Invalid(path, in, err.Error()))
	}
	return allErrs
}

func init() {
	genericwebhook.Register("DiskName", reflect.PointerTo(reflect.TypeFor[DiskName]()))
	genericwebhook.Register("LUN", reflect.PointerTo(reflect.TypeFor[LUN]()))
}

```

### Core Architecture Module: `api/v1alpha1/blockchaos_webhook.go`
```
// Copyright 2022 Chaos Mesh Authors.
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

package v1alpha1

import (
	"github.com/pkg/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

func (in *BlockChaosSpec) Validate(_ any, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}
	if in.Action == BlockDelay {
		if in.Delay == nil {
			err := errors.Errorf("delay should be set on %s action", in.Action)
			allErrs = append(allErrs, field.Invalid(path.Child("delay"), in.Delay, err.Error()))
		}
	}
	return allErrs
}

```

### Core Architecture Module: `api/v1alpha1/common_webhook.go`
```
// Copyright 2021 Chaos Mesh Authors.
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

package v1alpha1

import (
	"fmt"
	"reflect"
	"strconv"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/chaos-mesh/chaos-mesh/api/genericwebhook"
)

const (
	// ValidateValueParseError defines the error message for value parse error
	ValidateValueParseError = "parse value field error:%s"
)

// FIXME: interface ContainsDuration only used for validating EmbedChaos in Workflow

// ContainsDuration exposes the duration parsed from a chaos specification.
// +kubebuilder:object:generate=false
type ContainsDuration interface {
	GetDuration() (*time.Duration, error)
}

type Duration string

func (d *Duration) Validate(_ any, path *field.Path) field.ErrorList {
	if d == nil {
		return nil
	}

	if len(*d) == 0 {
		// allow duration to be zero
		// TODO: control by tag
		return nil
	}

	_, err := time.ParseDuration(string(*d))
	if err != nil {
		return field.ErrorList{
			field.Invalid(path, d, fmt.Sprintf("parse duration field error: %s", err.Error())),
		}
	}

	return nil
}

func (d *Duration) Default(_ any, field *reflect.StructField) {
	if d == nil {
		return
	}

	// d cannot be nil
	if len(*d) == 0 && field != nil {
		*d = Duration(field.Tag.Get("default"))
	}
}

func (p *PodSelector) Validate(_ any, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}

	if p == nil {
		return nil
	}

	mode := p.Mode
	value := p.Value
	valueField := path.Child("value")

	switch mode {
	case FixedMode:
		num, err := strconv.Atoi(value)
		if err != nil {
			allErrs = append(allErrs, field.Invalid(valueField, value,
				fmt.Sprintf(ValidateValueParseError, err)))
			break
		}

		if num <= 0 {
			allErrs = append(allErrs, field.Invalid(valueField, value,
				fmt.Sprintf("value must be greater than 0 with mode:%s", FixedMode)))
		}

	case RandomMaxPercentMode, FixedPercentMode:
		percentage, err := strconv.Atoi(value)
		if err != nil {
			allErrs = append(allErrs, field.Invalid(valueField, value,
				fmt.Sprintf(ValidateValueParseError, err)))
			break
		}

		if percentage <= 0 || percentage > 100 {
			allErrs = append(allErrs, field.Invalid(valueField, value,
				fmt.Sprintf("value of %d is invalid, Must be (0,100] with mode:%s",
					percentage, mode)))
		}
	}

	return allErrs
}

func (p *PodSelector) Default(root any, _ *reflect.StructField) {
	if p == nil {
		return
	}

	metaData, err := meta.Accessor(root)
	if err != nil {
		return
	}

	if len(p.Selector.Namespaces) == 0 {
		p.Selector.Namespaces = []string{metaData.GetNamespace()}
	}
}

type Percent int

type FloatStr string

func (p *Percent) Validate(_ any, path *field.Path) field.ErrorList {
	if p == nil {
		return nil
	}

	allErrs := field.ErrorList{}

	if *p > 100 || *p < 0 {
		allErrs = append(allErrs, field.Invalid(path, p,
			"percent field should be in 0-100"))
	}

	return allErrs
}

func (f *FloatStr) Validate(_ any, path *field.Path) field.ErrorList {
	if f == nil {
		return nil
	}

	_, err := strconv.ParseFloat(string(*f), 32)
	if err != nil {
		return field.ErrorList{
			field.Invalid(path, f,
				fmt.Sprintf("parse correlation field error:%s", err.Error())),
		}
	}

	return nil
}

func (f *FloatStr) Default(_ any, field *reflect.StructField) {
	// f cannot be nil
	if len(*f) == 0 && field != nil {
		*f = FloatStr(field.Tag.Get("default"))
	}
}

func init() {
	genericwebhook.Register("Duration", reflect.PointerTo(reflect.TypeFor[Duration]()))
	genericwebhook.Register("Percent", reflect.PointerTo(reflect.TypeFor[Percent]()))
	genericwebhook.Register("FloatStr", reflect.PointerTo(reflect.TypeFor[FloatStr]()))
}

```

### Core Architecture Module: `api/v1alpha1/dnschaos_webhook.go`
```
// Copyright 2021 Chaos Mesh Authors.
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

package v1alpha1

import (
	"fmt"
	"net/netip"
	"strings"

	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

func (in *DNSChaosSpec) Validate(_ any, path *field.Path) field.ErrorList {
	if in.Action != StaticAction {
		return nil
	}
	if _, err := ParseDNSDomainIPMappings(in.DomainIPMappingList); err != nil {
		return field.ErrorList{field.Invalid(path.Child("domainIpMapping"), in.DomainIPMappingList, err.Error())}
	}
	return nil
}

// ParseDNSDomainIPMappings validates static mappings and normalizes their domain names and IP addresses.
func ParseDNSDomainIPMappings(entries []string) (map[string]string, error) {
	if len(entries) == 0 {
		return nil, fmt.Errorf("at least one domain=IP mapping is required for the static action")
	}
	mappings := make(map[string]string, len(entries))
	for i, entry := range entries {
		domain, address, found := strings.Cut(entry, "=")
		if !found {
			return nil, fmt.Errorf("mapping %d must have the form domain=IP", i)
		}
		domain = strings.TrimSuffix(strings.ToLower(domain), ".")
		if problems := validation.IsDNS1123Subdomain(domain); len(problems) > 0 {
			return nil, fmt.Errorf("mapping %d has invalid domain %q: %s", i, domain, strings.Join(problems, "; "))
		}
		for label := range strings.SplitSeq(domain, ".") {
			if len(label) > 63 {
				return nil, fmt.Errorf("mapping %d has a domain label longer than 63 characters", i)
			}
		}
		ip, err := netip.ParseAddr(address)
		if err != nil || ip.Zone() != "" {
			return nil, fmt.Errorf("mapping %d has invalid IP address %q", i, address)
		}
		if _, exists := mappings[domain]; exists {
			return nil, fmt.Errorf("mapping %d repeats domain %q", i, domain)
		}
		mappings[domain] = ip.Unmap().String()
	}
	return mappings, nil
}

```

### Core Architecture Module: `api/v1alpha1/gcpchaos_webhook.go`
```
// Copyright 2021 Chaos Mesh Authors.
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

package v1alpha1

import (
	"reflect"

	"github.com/pkg/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/chaos-mesh/chaos-mesh/api/genericwebhook"
)

// Validate checks that the action is node-stop, node-reset, or disk-loss.
func (in GCPChaosAction) Validate(_ any, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}

	switch in {
	case NodeStop, DiskLoss:
	case NodeReset:
	default:
		err := errors.WithStack(errUnknownAction)
		log.Error(err, "Wrong GCPChaos Action type")

		allErrs = append(allErrs, field.Invalid(path, in, err.Error()))
	}
	return allErrs
}

type GCPDeviceNames []string

// Validate rejects a nil device-name slice for the disk-loss action.
func (in *GCPDeviceNames) Validate(root any, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}
	obj := root.(*GCPChaos)
	if obj.Spec.Action == DiskLoss {
		if *in == nil {
			err := errors.Errorf("at least one device name is required on %s action", obj.Spec.Action)
			allErrs = append(allErrs, field.Invalid(path, *in, err.Error()))
		}
	}
	return allErrs
}

func init() {
	genericwebhook.Register("GCPDeviceNames", reflect.PointerTo(reflect.TypeFor[GCPDeviceNames]()))
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5266** (2026-11-22): **docs(changelog): consolidate daemon and dashboard fixes**
  *Symptoms*: ## What problem does this PR solve?  The unreleased changelog lists two daemon input fixes separately and groups a Workflow topology panic with the Dashboard resource identity fix.  ## What's changed and how does it work?  - Combine the Linux process mapping and BlockChaos input fixes from #5263 into one entry. - Group Dashboard resource identity and forced deletion retries from #5264. Give the Workflow topology panic its own entry and keep the Helm entry.  Verified the changelog diff and PR links. `git diff --check` passed.  ## Related changes  - [ ] This change also requires further updates to the [website](https://github.com/chaos-mesh/website) (e.g. docs) - [ ] This change also requires further updates to the `UI interface`  ## Cherry-pick to release branches (optional)  - [ ] release-2.8 - [ ] release-2.7  ## Checklist  ### CHANGELOG  - [x] I have updated the `CHANGELOG.md` - [ ] I have labeled this PR with "no-need-update-changelog"  ### Tests  - [ ] Unit test - [ ] E2E test - [x] Manual test  ### Side effects  - [ ] **Breaking backward compatibility**  ## DCO  The commit is signed off for DCO.

- **Issue #5264** (2026-11-22): **fix(dashboard): protect resource identity and Helm lifecycle**
  *Symptoms*: ## What problem does this PR solve?  A Dashboard request for an old UID can reach a same-named replacement resource. A conflicted forced deletion can also retry against a stale object, and downloaded Helm chart archives can accumulate after loading.  ## What's changed and how does it work?  - Verify the live UID when looking up an experiment, Schedule, or Workflow. Use Kubernetes write preconditions and test replacements that occur after lookup. - On a forced deletion conflict, re-read the resource and verify its UID before retrying. Preserve concurrent annotations and handle stale serial children when rendering Workflow topology. - Remove temporary Helm archives after loading and omit full chart values from release errors. Verify install, failed upgrade, retry, and repeated uninstall with a local Kubernetes test API server. - Add Dashboard and port-forward regression tests. Follow-up to #5256.  Targeted Go tests passed for 13 packages and cover the Dashboard handlers and workflow repository, Helm client, remote-cluster reconciler, and port forwarding.  ## Related changes  - [ ] This change also requires further updates to the [website](https://github.com/chaos-mesh/website) (e.g. docs) - [ ] This change also requires further updates to the `UI interface`  ## Cherry-pick to release branches (optional)  - [ ] release-2.8 - [ ] release-2.7  ## Checklist  ### CHANGELOG  - [x] I have updated the `CHANGELOG.md` - [ ] I have labeled this PR with "no-need-update-changelog"  ### Test

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

### Incident Patch 1: `fdb9684b` (2026-11-22)
**Commit Message**: feat(api): validate PodChaos and BlockChaos action requirements in the CRD schema (#5245)

* feat(api): validate PodChaos and BlockChaos action requirements in the CRD schema

Adds CEL rules for container-kill needing container names and the BlockChaos delay action needing a delay spec. The rules also apply where the specs are embedded in Schedules and Workflows. The Go validators and webhook entries stay for now.

Part of #5220

Signed-off-by: Srinivas Chippagiri <[REDACTED_EMAIL]>

* docs(changelog): note the PodChaos and BlockChaos CEL rules

Signed-off-by: Srinivas Chippagiri <[REDACTED_EMAIL]>

---------

Signed-off-by: Srinivas Chippagiri <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 ### Changed
 
 - Avoid unnecessary Pod rollouts when cert-manager manages the certificates [#5246](https://github.com/chaos-mesh/chaos-mesh/pull/5246)
+- Validate the PodChaos `container-kill` container names and the BlockChaos `delay` spec with CEL rules in the CRD schemas, including when embedded in Schedules and Workflows [#5245](https://github.com/chaos-mesh/chaos-mesh/pull/5245)
 - Pull Helm chart images from `cr.chaos-mesh.dev` by default; set `images.registry=ghcr.io` to keep pulling from GitHub Container Registry [#5226](https://github.com/chaos-mesh/chaos-mesh/pull/5226)
 - Add multi-value event filters, time sorting, and a `GET /events/page` endpoint for Dashboard Events pagination [#5222](https://github.com/chaos-mesh/chaos-mesh/pull/5222), [#5229](https://github.com/chaos-mesh/chaos-mesh/pull/5229)
 - Omit the redundant `SYS_PTRACE` declaration from the privileged Chaos Daemon security context in Helm manifests [#5215](https://github.com/chaos-mesh/chaos-mesh/pull/5215)
```

**File**: `api/v1alpha1/blockchaos_types.go` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@ const (
 )
 
 // BlockChaosSpec is the content of the specification for a BlockChaos
+// +kubebuilder:validation:XValidation:rule="self.action != 'delay' || has(self.delay)",message="delay should be set on delay action"
 type BlockChaosSpec struct {
 	// Action defines the specific block chaos action.
 	// Supported action: delay
```

**File**: `api/v1alpha1/crd_validation_test.go` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+// Copyright 2026 Chaos Mesh Authors.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+//
+
+package v1alpha1
+
+import (
+	"context"
+
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+)
+
+// These specs run the CEL rules from the CRD schemas against the envtest API server,
+// without the validating webhook.
+var _ = Describe("CRD validation rules", func() {
+	const (
+		containerKillMessage = "the name of container is required on container-kill action"
+		blockDelayMessage    = "delay should be set on delay action"
+	)
+
+	meta := func(name string) metav1.ObjectMeta {
+		return metav1.ObjectMeta{Name: name, Namespace: "default"}
+	}
+
+	containerKill := func(names ...string) *PodChaosSpec {
+		return &PodChaosSpec{
+			Action: ContainerKillAction,
+			ContainerSelector: ContainerSelector{
+				PodSelector:    PodSelector{Mode: OneMode},
+				ContainerNames: names,
+			},
+		}
+	}
+
+	blockChaos := func(delay *BlockDelaySpec) *BlockChaosSpec {
+		return &BlockChaosSpec{
+			Action: BlockDelay,
+			Delay:  delay,
+			ContainerNodeVolumePathSelector: ContainerNodeVolumePathSelector{
+				ContainerSelector: ContainerSelector{PodSelector: PodSelector{Mode: OneMode}},
+				VolumeName:        "data",
+			},
+		}
+	}
+
+	expectRejected := func(obj client.Object, message string) {
+		err := k8sClient.Create(context.TODO(), obj)
+		Expect(err).To(HaveOccurred())
+		Expect(err.Error()).To(ContainSubstring(message))
+	}
+
+	expectAccepted := func(obj client.Object) {
+		Expect(k8sClient.Create(context.TODO(), obj)).To(Succeed())
+		Expect(k8sClient.Delete(context.TODO(), obj)).To(Succeed())
+	}
+
+	Context("PodChaos", func() {
+		It("rejects container-kill without container names", func() {
+			expectRejected(&PodChaos{ObjectMeta: meta("cel-container-kill-empty"), Spec: *containerKill()}, containerKillMessage)
+		})
+
+		It("accepts container-kill with container names", func() {
+			expectAccepted(&PodChaos{ObjectMeta: meta("cel-container-kill"), Spec: *containerKill("app")})
+		})
+
+		It("accepts pod-kill without container names", func() {
+			spec := containerKill()
+			spec.Action = PodKillAction
+			expectAccepted(&PodChaos{ObjectMeta: meta("cel-pod-kill"), Spec: *spec})
+		})
+	})
+
+	Context("BlockChaos", func() {
+		It("rejects the delay action without a delay spec", func() {
+			expectRejected(&BlockChaos{ObjectMeta: meta("cel-block-no-delay"), Spec: *blockChaos(nil)}, blockDelayMessage)
+		})
+
+		It("accepts the delay action with a delay spec", func() {
+			expectAccepted(&BlockChaos{ObjectMeta: meta("cel-block-delay"), Spec: *blockChaos(&BlockDelaySpec{Latency: "10ms"})})
+		})
+	})
+
+	Context("Schedule", func() {
+		schedule := func(name string, embed EmbedChaos, scheduleType ScheduleTemplateType) *Schedule {
+			return &Schedule{
+				ObjectMeta: meta(name),
+				Spec: ScheduleSpec{
+					Schedule:          "* * * * 1",
+					ScheduleItem:      ScheduleItem{EmbedChaos: embed},
+					Type:              scheduleType,
+					ConcurrencyPolicy: ForbidConcurrent,
+				},
+			}
+		}
+
+		It("rejects an embedded container-kill without container names", func() {
+			expectRejected(schedule("cel-schedule-container-kill", EmbedChaos{PodChaos: containerKill()}, ScheduleTypePodChaos), containerKillMessage)
+		})
+
+		It("rejects an embedded delay action without a delay spec", func() {
+			expectRejected(schedule("cel-schedule-block", EmbedChaos{BlockChaos: blockChaos(nil)}, ScheduleTypeBlockChaos), blockDelayMessage)
+		})
+
+		It("accepts a valid embedded container-kill", func() {
+			expectAccepted(schedule("cel-schedule-ok", EmbedChaos{PodChaos: containerKill("app")}, ScheduleTypePodChaos))
+		})
+	})
+
+	Context("Workflow", func() {
+		workflow := func(name string, embed EmbedChaos, templateType TemplateType) *Workflow {
+			return &Workflow{
+				ObjectMeta: meta(name),
+				Spec: WorkflowSpec{
+					Entry: "entry",
+					Templates: []Template{{
+						Name:       "entry",
+						Type:       templateType,
+						EmbedChaos: &embed,
+					}},
+				},
+			}
+		}
+
+		It("rejects an embedded container-kill without container names", func() {
+			expectRejected(workflow("cel-workflow-container-kill", EmbedChaos{PodChaos: containerKill()}, TypePodChaos), containerKillMessage)
+		})
+
+		It("rejects an embedded delay action without a delay spec", func() {
+			expectRejected(workflow("
```

**File**: `api/v1alpha1/podchaos_types.go` (modified, +1/-0)
```diff
@@ -54,6 +54,7 @@ const (
 )
 
 // PodChaosSpec defines the attributes that a user creates on a chaos experiment about pods.
+// +kubebuilder:validation:XValidation:rule="self.action != 'container-kill' || (has(self.containerNames) && size(self.containerNames) > 0)",message="the name of container is required on container-kill action"
 type PodChaosSpec struct {
 	ContainerSelector `json:",inline"`
 
```

**File**: `config/crd/bases/chaos-mesh.org_blockchaos.yaml` (modified, +3/-0)
```diff
@@ -201,6 +201,9 @@ spec:
             - selector
             - volumeName
             type: object
+            x-kubernetes-validations:
+            - message: delay should be set on delay action
+              rule: self.action != 'delay' || has(self.delay)
           status:
             description: BlockChaosStatus represents the status of a BlockChaos
             properties:
```

**File**: `config/crd/bases/chaos-mesh.org_podchaos.yaml` (modified, +4/-0)
```diff
@@ -195,6 +195,10 @@ spec:
             - mode
             - selector
             type: object
+            x-kubernetes-validations:
+            - message: the name of container is required on container-kill action
+              rule: self.action != 'container-kill' || (has(self.containerNames) &&
+                size(self.containerNames) > 0)
           status:
             description: Most recently observed status of the chaos experiment about
               pods
```

**File**: `config/crd/bases/chaos-mesh.org_schedules.yaml` (modified, +23/-0)
```diff
@@ -296,6 +296,9 @@ spec:
                 - selector
                 - volumeName
                 type: object
+                x-kubernetes-validations:
+                - message: delay should be set on delay action
+                  rule: self.action != 'delay' || has(self.delay)
               concurrencyPolicy:
                 default: Forbid
                 enum:
@@ -3063,6 +3066,10 @@ spec:
                 - mode
                 - selector
                 type: object
+                x-kubernetes-validations:
+                - message: the name of container is required on container-kill action
+                  rule: self.action != 'container-kill' || (has(self.containerNames)
+                    && size(self.containerNames) > 0)
               schedule:
                 type: string
               startingDeadlineSeconds:
@@ -3717,6 +3724,9 @@ spec:
                           - selector
                           - volumeName
                           type: object
+                          x-kubernetes-validations:
+                          - message: delay should be set on delay action
+                            rule: self.action != 'delay' || has(self.delay)
                         children:
                           description: Children describes the children steps of serial
                             or parallel node. Only used when Type is TypeSerial or
@@ -6570,6 +6580,11 @@ spec:
                           - mode
                           - selector
                           type: object
+                          x-kubernetes-validations:
+                          - message: the name of container is required on container-kill
+                              action
+                            rule: self.action != 'container-kill' || (has(self.containerNames)
+                              && size(self.containerNames) > 0)
                         schedule:
                           description: Schedule describe the Schedule(describing scheduled
                             chaos) to be injected with chaos nodes. Only used when
@@ -6841,6 +6856,9 @@ spec:
                               - selector
                               - volumeName
                               type: object
+                              x-kubernetes-validations:
+                              - message: delay should be set on delay action
+                                rule: self.action != 'delay' || has(self.delay)
                             concurrencyPolicy:
                               enum:
                               - Forbid
@@ -9706,6 +9724,11 @@ spec:
                               - mode
                               - selector
                               type: object
+                              x-kubernetes-validations:
+                              - message: the name of container is required on container-kill
+                                  action
+                                rule: self.action != 'container-kill' || (has(self.containerNames)
+                                  && size(self.containerNames) > 0)
                             schedule:
                               type: string
                             startingDeadlineSeconds:
```

**File**: `config/crd/bases/chaos-mesh.org_workflownodes.yaml` (modified, +31/-0)
```diff
@@ -303,6 +303,9 @@ spec:
                 - selector
                 - volumeName
                 type: object
+                x-kubernetes-validations:
+                - message: delay should be set on delay action
+                  rule: self.action != 'delay' || has(self.delay)
               children:
                 items:
                   type: string
@@ -3085,6 +3088,10 @@ spec:
                 - mode
                 - selector
                 type: object
+                x-kubernetes-validations:
+                - message: the name of container is required on container-kill action
+                  rule: self.action != 'container-kill' || (has(self.containerNames)
+                    && size(self.containerNames) > 0)
               schedule:
                 description: ScheduleSpec is the specification of a schedule object
                 properties:
@@ -3348,6 +3355,9 @@ spec:
                     - selector
                     - volumeName
                     type: object
+                    x-kubernetes-validations:
+                    - message: delay should be set on delay action
+                      rule: self.action != 'delay' || has(self.delay)
                   concurrencyPolicy:
                     default: Forbid
                     enum:
@@ -6140,6 +6150,11 @@ spec:
                     - mode
                     - selector
                     type: object
+                    x-kubernetes-validations:
+                    - message: the name of container is required on container-kill
+                        action
+                      rule: self.action != 'container-kill' || (has(self.containerNames)
+                        && size(self.containerNames) > 0)
                   schedule:
                     type: string
                   startingDeadlineSeconds:
@@ -6798,6 +6813,9 @@ spec:
                               - selector
                               - volumeName
                               type: object
+                              x-kubernetes-validations:
+                              - message: delay should be set on delay action
+                                rule: self.action != 'delay' || has(self.delay)
                             children:
                               description: Children describes the children steps of
                                 serial or parallel node. Only used when Type is TypeSerial
@@ -9687,6 +9705,11 @@ spec:
                               - mode
                               - selector
                               type: object
+                              x-kubernetes-validations:
+                              - message: the name of container is required on container-kill
+                                  action
+                                rule: self.action != 'container-kill' || (has(self.containerNames)
+                                  && size(self.containerNames) > 0)
                             schedule:
                               description: Schedule describe the Schedule(describing
                                 scheduled chaos) to be injected with chaos nodes.
@@ -9959,6 +9982,9 @@ spec:
                                   - selector
                                   - volumeName
                                   type: object
+                                  x-kubernetes-validations:
+                                  - message: delay should be set on delay action
+                                    rule: self.action != 'delay' || has(self.delay)
                                 concurrencyPolicy:
                                   enum:
                                   - Forbid
@@ -12861,6 +12887,11 @@ spec:
                                   - mode
                                   - selector
                                   type: object
+                                  x-kubernetes-validations:
+                                  - message: the name of container is required on
+                                      container-kill action
+                                    rule: self.action != 'container-kill' || (has(self.containerNames)
+                                      && size(self.containerNames) > 0)
                                 schedule:
                                   type: string
                                 startingDeadlineSeconds:
```

---

### Incident Patch 2: `8c331821` (2026-11-22)
**Commit Message**: fix(dashboard): protect resource identity and Helm lifecycle (#5264)

* fix(dashboard): protect resource identity and Helm lifecycle

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

* docs(changelog): link the dashboard fixes

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

---------

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -106,6 +106,9 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 - Fix StressChaos injection failures when inactive cgroup v1 controller directories are present. [#4407](https://github.com/chaos-mesh/chaos-mesh/pull/4407)
 - Honor reconciliation cancellation in PhysicalMachineChaos requests to chaosd. [#5095](https://github.com/chaos-mesh/chaos-mesh/pull/5095)
 - Fix `RemoteCluster` readiness to reflect successful setup, reconciliation failures, and deletion [#5157](https://github.com/chaos-mesh/chaos-mesh/pull/5157)
+- Keep archived Dashboard experiments, Workflows, and Schedules separate from newer resources with the same name, and handle stale serial nodes when rendering Workflow topology. [#5264](https://github.com/chaos-mesh/chaos-mesh/pull/5264)
+- Retry forced experiment deletion after concurrent updates while preserving unrelated annotations. [#5264](https://github.com/chaos-mesh/chaos-mesh/pull/5264)
+- Remove temporary remote Helm chart archives after loading and omit full chart values from release errors. [#5264](https://github.com/chaos-mesh/chaos-mesh/pull/5264)
 - Skip Succeeded and Failed pods when `podPhaseSelectors` is unset [#5150](https://github.com/chaos-mesh/chaos-mesh/pull/5150)
 - Reject PhysicalMachineChaos injection when `spec.uid` is empty and point users to the mutating webhook configuration [#5148](https://github.com/chaos-mesh/chaos-mesh/pull/5148)
 - Preserve `spec.uid` when importing PhysicalMachineChaos YAML into the Dashboard and submitting the form [#5149](https://github.com/chaos-mesh/chaos-mesh/pull/5149)
```

**File**: `controllers/multicluster/remotecluster/helm_test.go` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+// Copyright 2022 Chaos Mesh Authors.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+//
+
+package remotecluster
+
+import (
+	"os"
+	"path/filepath"
+	"testing"
+
+	"github.com/go-logr/logr"
+	. "github.com/onsi/gomega"
+	"helm.sh/helm/v4/pkg/chart/common"
+	chart "helm.sh/helm/v4/pkg/chart/v2"
+	chartutil "helm.sh/helm/v4/pkg/chart/v2/util"
+	"helm.sh/helm/v4/pkg/storage/driver"
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/client-go/kubernetes"
+	"k8s.io/client-go/tools/clientcmd"
+	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
+	"sigs.k8s.io/controller-runtime/pkg/envtest"
+
+	"github.com/chaos-mesh/chaos-mesh/api/v1alpha1"
+	controllerconfig "github.com/chaos-mesh/chaos-mesh/controllers/config"
+	"github.com/chaos-mesh/chaos-mesh/pkg/config"
+)
+
+func TestRemoteHelmReleaseLifecycle(t *testing.T) {
+	g := NewWithT(t)
+	ctx := t.Context()
+	binaryPath := os.Getenv("KUBEBUILDER_ASSETS")
+	if binaryPath == "" {
+		binaryPath = "/usr/local/kubebuilder/bin"
+	}
+	for _, asset := range []string{"kube-apiserver", "etcd"} {
+		if _, err := os.Stat(filepath.Join(binaryPath, asset)); os.IsNotExist(err) {
+			t.Skipf("envtest asset %s is unavailable in %s", asset, binaryPath)
+		}
+	}
+
+	env := &envtest.Environment{UseExistingCluster: new(false), BinaryAssetsDirectory: binaryPath}
+	restConfig, err := env.Start()
+	g.Expect(err).NotTo(HaveOccurred())
+	t.Cleanup(func() {
+		if err := env.Stop(); err != nil {
+			t.Error(err)
+		}
+	})
+	const namespace = "remote-helm"
+	kube, err := kubernetes.NewForConfig(restConfig)
+	g.Expect(err).NotTo(HaveOccurred())
+	kubeconfig := clientcmd.NewDefaultClientConfig(clientcmdapi.Config{
+		Clusters:       map[string]*clientcmdapi.Cluster{"test": {Server: restConfig.Host, CertificateAuthorityData: restConfig.CAData}},
+		AuthInfos:      map[string]*clientcmdapi.AuthInfo{"test": {ClientCertificateData: restConfig.CertData, ClientKeyData: restConfig.KeyData}},
+		Contexts:       map[string]*clientcmdapi.Context{"test": {Cluster: "test", AuthInfo: "test", Namespace: namespace}},
+		CurrentContext: "test",
+	}, &clientcmd.ConfigOverrides{})
+
+	directory := t.TempDir()
+	previous := controllerconfig.ControllerCfg
+	controllerconfig.ControllerCfg = &config.ChaosControllerConfig{LocalHelmChartPath: directory}
+	t.Cleanup(func() { controllerconfig.ControllerCfg = previous })
+	saveChart := func(version, template string) {
+		t.Helper()
+		_, err := chartutil.Save(&chart.Chart{
+			Metadata:  &chart.Metadata{Name: chaosMeshReleaseName, Version: version, APIVersion: chart.APIVersionV2, AppVersion: version},
+			Templates: []*common.File{{Name: "templates/configmap.yaml", Data: []byte(template)}},
+		}, directory)
+		g.Expect(err).NotTo(HaveOccurred())
+	}
+	const template = `apiVersion: v1
+kind: ConfigMap
+metadata:
+  name: remote-release-config
+data:
+  value: {{ .Values.configValue | quote }}
+`
+	saveChart("1.0.0", template)
+	// Parse failures leave the deployed release usable and safe to retry.
+	saveChart("2.0.0", "{{ .Values.configValue | missingFunction }}")
+	r := Reconciler{Log: logr.Discard()}
+	remote := &v1alpha1.RemoteCluster{}
+	remote.Spec.Namespace = namespace
+	remote.Spec.Version = "1.0.0"
+	remote.Spec.ConfigOverride = []byte(`{"configValue":"original"}`)
+	cms := kube.CoreV1().ConfigMaps(namespace)
+	assertValue := func(want string) {
+		t.Helper()
+		cm, err := cms.Get(ctx, "remote-release-config", metav1.GetOptions{})
+		g.Expect(err).NotTo(HaveOccurred())
+		g.Expect(cm.Data).To(HaveKeyWithValue("value", want))
+	}
+
+	g.Expect(r.uninstallHelmRelease(ctx, remote, kubeconfig)).To(Succeed())
+	g.Expect(r.ensureHelmRelease(ctx, remote, kubeconfig)).To(Equal("1.0.0"))
+	assertValue("original")
+
+	remote.Spec.ConfigOverride = []byte("{")
+	g.Expect(r.ensureHelmRelease(ctx, remote, kubeconfig)).Error().To(HaveOccurred())
+	assertValue("original")
+	remote.Spec.ConfigOverride = []byte(`{"configValue":"helm-value-marker"}`)
+	remote.Spec.Version = "missing"
+	g.Expect(r.ensureHelmRelease(ctx, remote, kubeconfig)).Error().To(MatchError(os.ErrNotExist))
+	remote.Spec.Version = "2.0.0"
+	_, err = r.ensureHelmRelease(ctx, remote, kubeconfig)
+	g.Expect(err).To(MatchError(ContainSubstring("upgrade release chaos-mesh")))
+	g.Expect(err.Error()).NotTo(ContainSubstring("helm-value-marker"))
+	assertValue("original")
+
+	saveChart("2.0.0", template)
+	remote.Spec.ConfigOverride =
```

**File**: `pkg/dashboard/apiserver/experiment/experiment.go` (modified, +60/-66)
```diff
@@ -17,8 +17,8 @@ package experiment
 
 import (
 	"context"
-	"encoding/json"
 	"errors"
+	"maps"
 	"net/http"
 	"reflect"
 	"sort"
@@ -30,6 +30,7 @@ import (
 	"github.com/go-logr/logr"
 	"golang.org/x/sync/errgroup"
 	"gorm.io/gorm"
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/runtime"
 	"k8s.io/apimachinery/pkg/types"
@@ -213,10 +214,7 @@ func (s *Service) create(c *gin.Context) {
 // @Failure 500 {object} u.APIError
 // @Router /experiments/{uid} [get]
 func (s *Service) get(c *gin.Context) {
-	var (
-		exp       *core.Experiment
-		expDetail *apiservertypes.ExperimentDetail
-	)
+	var exp *core.Experiment
 
 	kubeCli, err := clientpool.ExtractTokenAndGetClient(c.Request.Header)
 	if err != nil {
@@ -236,30 +234,34 @@ func (s *Service) get(c *gin.Context) {
 		return
 	}
 
-	ns, name, kind := exp.Namespace, exp.Name, exp.Kind
-
-	if chaosKind, ok := v1alpha1.AllKinds()[kind]; ok {
-		expDetail = s.findChaosInCluster(c, kubeCli, types.NamespacedName{Namespace: ns, Name: name}, chaosKind.SpawnObject())
-
-		if expDetail == nil {
-			return
-		}
-	} else {
-		u.SetAPIError(c, u.ErrBadRequest.New("Kind %s is not supported", kind))
-
+	chaos, err := getChaosForExperiment(c.Request.Context(), kubeCli, exp)
+	if err != nil {
+		u.SetAPImachineryError(c, err)
 		return
 	}
-
-	c.JSON(http.StatusOK, expDetail)
+	expDetail := s.chaosDetail(c, chaos)
+	if expDetail != nil {
+		c.JSON(http.StatusOK, expDetail)
+	}
 }
 
-func (s *Service) findChaosInCluster(c *gin.Context, kubeCli client.Client, namespacedName types.NamespacedName, chaos client.Object) *apiservertypes.ExperimentDetail {
-	if err := kubeCli.Get(c.Request.Context(), namespacedName, chaos); err != nil {
-		u.SetAPImachineryError(c, err)
-
-		return nil
+func getChaosForExperiment(ctx context.Context, kubeCli client.Client, record *core.Experiment) (client.Object, error) {
+	kind, ok := v1alpha1.AllKinds()[record.Kind]
+	if !ok {
+		return nil, apierrors.NewBadRequest("Kind " + record.Kind + " is not supported")
 	}
+	chaos := kind.SpawnObject()
+	if err := kubeCli.Get(ctx, types.NamespacedName{Namespace: record.Namespace, Name: record.Name}, chaos); err != nil {
+		return nil, err
+	}
+	if chaos.GetUID() != types.UID(record.UID) {
+		resource := v1alpha1.SchemeGroupVersion.WithResource(strings.ToLower(record.Kind)).GroupResource()
+		return nil, apierrors.NewNotFound(resource, record.Name)
+	}
+	return chaos, nil
+}
 
+func (s *Service) chaosDetail(c *gin.Context, chaos client.Object) *apiservertypes.ExperimentDetail {
 	gvk, err := apiutil.GVKForObject(chaos, s.scheme)
 	if err != nil {
 		u.SetAPImachineryError(c, err)
@@ -326,8 +328,7 @@ func (s *Service) delete(c *gin.Context) {
 		return
 	}
 
-	ns, name, kind, force := exp.Namespace, exp.Name, exp.Kind, c.DefaultQuery("force", "false")
-	if ok := checkAndDeleteChaos(c, kubeCli, types.NamespacedName{Namespace: ns, Name: name}, kind, force); !ok {
+	if ok := checkAndDeleteChaos(c, kubeCli, exp, c.DefaultQuery("force", "false")); !ok {
 		return
 	}
 
@@ -383,68 +384,62 @@ func (s *Service) batchDelete(c *gin.Context) {
 			return
 		}
 
-		ns, name, kind := exp.Namespace, exp.Name, exp.Kind
-		if ok := checkAndDeleteChaos(c, kubeCli, types.NamespacedName{Namespace: ns, Name: name}, kind, force); !ok {
+		if ok := checkAndDeleteChaos(c, kubeCli, exp, force); !ok {
 			return
 		}
 	}
 
 	c.JSON(http.StatusOK, u.ResponseSuccess)
 }
 
-func checkAndDeleteChaos(c *gin.Context, kubeCli client.Client, namespacedName types.NamespacedName, kind string, force string) bool {
-	var (
-		chaosKind *v1alpha1.ChaosKind
-		ok        bool
-		err       error
-	)
-
-	if chaosKind, ok = v1alpha1.AllKinds()[kind]; !ok {
-		u.SetAPIError(c, u.ErrBadRequest.New("Kind %s is not supported", kind))
-
-		return false
-	}
-
+func checkAndDeleteChaos(c *gin.Context, kubeCli client.Client, record *core.Experiment, force string) bool {
 	ctx := c.Request.Context()
-	chaos := chaosKind.SpawnObject()
-
-	if err = kubeCli.Get(ctx, namespacedName, chaos); err != nil {
+	chaos, err := getChaosForExperiment(ctx, kubeCli, record)
+	if err != nil {
 		u.SetAPImachineryError(c, err)
-
 		return false
 	}
 
 	if force == "true" {
 		err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
-			return forceClean(ctx, kubeCli, chaos)
+			updateErr := forceClean(ctx, kubeCli, chaos)
+			if !apierrors.IsConflict(updateErr) {
+				return updateErr
+			}
+			// Retry against the current version of the same experiment.
+			fresh, err := getChaosForExperiment(ctx, kubeCli, record)
+			if err != nil {
+				return err
+			}
+			chaos = fresh
+			return updateErr
 		})
-		if err == nil {
-			err = ctx.Err()
+		if apierrors.IsNotFound(err) {
+			u.SetAPImachineryError(c, err)
+			return false
 		}
-		if err != nil {
+		if err != nil || ctx.Err() != nil {
 			u.SetAPIError(c, u.ErrInternalServer.New("Forced deletion failed"))
-
 			return false
 		}
 	}
 
-	if err := 
```

**File**: `pkg/dashboard/apiserver/experiment/experiment_test.go` (modified, +3/-3)
```diff
@@ -62,7 +62,7 @@ func (s experimentLookup) FindByUID(_ context.Context, uid string) (*core.Experi
 	if !ok {
 		return nil, gorm.ErrRecordNotFound
 	}
-	return &core.Experiment{ExperimentMeta: core.ExperimentMeta{Namespace: "test", Name: name, Kind: "PodChaos"}}, nil
+	return &core.Experiment{ExperimentMeta: core.ExperimentMeta{Namespace: "test", Name: name, Kind: "PodChaos", UID: uid}}, nil
 }
 
 var _ = Describe("Deleting experiments", func() {
@@ -79,11 +79,11 @@ var _ = Describe("Deleting experiments", func() {
 		scheme := runtime.NewScheme()
 		Expect(v1alpha1.AddToScheme(scheme)).To(Succeed())
 		first = &v1alpha1.PodChaos{ObjectMeta: metav1.ObjectMeta{
-			Namespace: "test", Name: "first",
+			Namespace: "test", Name: "first", UID: "one",
 			Finalizers:  []string{finalizers.RecordFinalizer},
 			Annotations: map[string]string{"owner": "team"},
 		}}
-		second = &v1alpha1.PodChaos{ObjectMeta: metav1.ObjectMeta{Namespace: "test", Name: "second"}}
+		second = &v1alpha1.PodChaos{ObjectMeta: metav1.ObjectMeta{Namespace: "test", Name: "second", UID: "two"}}
 		updateFailure = nil
 		kube = fake.NewClientBuilder().WithScheme(scheme).WithObjects(first, second).Build()
 		previous := clientpool.K8sClients
```

**File**: `pkg/dashboard/apiserver/resource_identity_test.go` (added, +192/-0)
```diff
@@ -0,0 +1,192 @@
+// Copyright Chaos Mesh Authors.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package apiserver
+
+import (
+	"context"
+	"encoding/json"
+	"errors"
+	"net/http"
+	"strings"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"k8s.io/apimachinery/pkg/types"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/client/interceptor"
+
+	"github.com/chaos-mesh/chaos-mesh/api/v1alpha1"
+	"github.com/chaos-mesh/chaos-mesh/controllers/common/finalizers"
+	apiservertypes "github.com/chaos-mesh/chaos-mesh/pkg/dashboard/apiserver/types"
+)
+
+func TestExperimentUIDRoutesRejectReplacementBeforeLookup(t *testing.T) {
+	resource := apiResources()[0]
+	require.NoError(t, json.Unmarshal([]byte(resource.body), resource.object))
+	router, kube := apiRouter(t, []client.Object{resource.object}, interceptor.Funcs{}, nil)
+	response := apiRequest(t, router, http.MethodGet, "/experiments/uid", "", http.StatusOK)
+	var detail apiservertypes.ExperimentDetail
+	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &detail))
+	require.Equal(t, "uid", detail.UID)
+	require.Equal(t, "PodChaos", detail.Kind)
+	require.Equal(t, "example", detail.KubeObject.Meta.Name)
+	require.Equal(t, map[string]string{"keep": "value"}, detail.KubeObject.Meta.Annotations)
+
+	replacement := resource.object.DeepCopyObject().(client.Object)
+	require.NoError(t, kube.Delete(t.Context(), resource.object))
+	replacement.SetUID("replacement")
+	replacement.SetResourceVersion("")
+	require.NoError(t, kube.Create(t.Context(), replacement))
+	for _, request := range []struct{ method, path string }{
+		{http.MethodGet, "/experiments/uid"},
+		{http.MethodPut, "/experiments/pause/uid"},
+		{http.MethodPut, "/experiments/start/uid"},
+		{http.MethodDelete, "/experiments/uid"},
+		{http.MethodDelete, "/experiments/uid?force=true"},
+		{http.MethodDelete, "/experiments?uids=uid&force=true"},
+	} {
+		apiRequest(t, router, request.method, request.path, "", http.StatusNotFound)
+	}
+	var current v1alpha1.PodChaos
+	require.NoError(t, kube.Get(t.Context(), client.ObjectKeyFromObject(resource.object), &current))
+	require.Equal(t, types.UID("replacement"), current.UID)
+	require.Equal(t, map[string]string{"keep": "value"}, current.Annotations)
+	require.Nil(t, current.DeletionTimestamp)
+}
+
+func TestUIDScopedWritesRejectReplacementAfterLookup(t *testing.T) {
+	for _, resource := range apiResources() {
+		for _, method := range []string{http.MethodPut, http.MethodDelete} {
+			t.Run(resource.endpoint+"/"+method, func(t *testing.T) {
+				original := resource.object.DeepCopyObject().(client.Object)
+				require.NoError(t, json.Unmarshal([]byte(resource.body), original))
+				original.SetAnnotations(nil)
+				key := client.ObjectKeyFromObject(original)
+				path := "/" + resource.endpoint + "/uid"
+				body := ""
+				if method == http.MethodPut {
+					if resource.endpoint == "workflows" {
+						body = strings.Replace(resource.body, `"entry":"wait"`, `"entry":"other"`, 1)
+					} else {
+						path = "/" + resource.endpoint + "/pause/uid"
+					}
+				}
+
+				var replacement client.Object
+				replace := func(ctx context.Context, kube client.Client, observed client.Object) {
+					t.Helper()
+					require.Equal(t, types.UID("uid"), observed.GetUID())
+					require.Nil(t, replacement, "mutation was retried against a different UID")
+					require.NoError(t, kube.Delete(ctx, original))
+					replacement = original.DeepCopyObject().(client.Object)
+					replacement.SetUID("replacement")
+					replacement.SetResourceVersion("")
+					replacement.SetAnnotations(map[string]string{"owner": "replacement"})
+					require.NoError(t, kube.Create(ctx, replacement))
+					require.NotEqual(t, observed.GetResourceVersion(), replacement.GetResourceVersion())
+				}
+				router, kube := apiRouter(t, []client.Object{original}, interceptor.Funcs{
+					Update: func(ctx context.Context, kube client.WithWatch, obj client.Object, opts ...client.UpdateOption) error {
+						replace(ctx, kube, obj)
+						return kube.Update(ctx, obj, opts...)
+					},
+					Patch: func(ctx context.Context, kube client.WithWatch, obj client.Object, patch client.Patch, opts ...client.PatchOption) error {
+						replace(ctx, kube, obj)
+						return kube.Patch(ctx, obj, patch, opts...)
+					},
+					Delete: func(ctx context.Context, kube client.WithWat
```

**File**: `pkg/dashboard/apiserver/resource_test.go` (modified, +22/-2)
```diff
@@ -104,11 +104,29 @@ func (s apiWorkflowStore) FindByUID(_ context.Context, uid string) (*core.Workfl
 	return &core.WorkflowEntity{UID: uid, Namespace: "target", Name: "example", Workflow: apiResources()[2].body}, nil
 }
 
+// Match the store's resource identity in the fake client, which does not assign UIDs.
+func setFixtureUID(object client.Object) {
+	if object.GetUID() == "" && object.GetNamespace() == "target" && object.GetName() == "example" {
+		object.SetUID("uid")
+	}
+}
+
 func apiRouter(t *testing.T, objects []client.Object, faults interceptor.Funcs, storeErr error) (*gin.Engine, client.Client) {
 	t.Helper()
 	scheme := runtime.NewScheme()
 	require.NoError(t, corev1.AddToScheme(scheme))
 	require.NoError(t, v1alpha1.AddToScheme(scheme))
+	for _, object := range objects {
+		setFixtureUID(object)
+	}
+	create := faults.Create
+	faults.Create = func(ctx context.Context, kube client.WithWatch, object client.Object, opts ...client.CreateOption) error {
+		setFixtureUID(object)
+		if create != nil {
+			return create(ctx, kube, object, opts...)
+		}
+		return kube.Create(ctx, object, opts...)
+	}
 	kube := fake.NewClientBuilder().WithScheme(scheme).WithObjects(objects...).WithInterceptorFuncs(faults).Build()
 	original := clientpool.K8sClients
 	clientpool.K8sClients = apiClientPool{kube: kube}
@@ -244,10 +262,12 @@ func TestResourceLookupErrors(t *testing.T) {
 				router, _ := apiRouter(t, nil, interceptor.Funcs{}, scenario.storeErr)
 				requests := []struct{ method, path string }{{http.MethodGet, "/" + resource.endpoint + "/" + scenario.uid}, {http.MethodDelete, "/" + resource.endpoint + "/" + scenario.uid}}
 				if resource.endpoint != "workflows" {
-					requests = append(requests, struct{ method, path string }{http.MethodPut, "/" + resource.endpoint + "/pause/" + scenario.uid})
+					for _, action := range []string{"pause", "start"} {
+						requests = append(requests, struct{ method, path string }{http.MethodPut, "/" + resource.endpoint + "/" + action + "/" + scenario.uid})
+					}
 				}
 				for _, request := range requests {
-					t.Run(request.method, func(t *testing.T) {
+					t.Run(request.method+" "+request.path, func(t *testing.T) {
 						want := scenario.want
 						if resource.endpoint == "workflows" && scenario.name == "missing-kubernetes" && request.method == http.MethodGet {
 							want = http.StatusOK
```

**File**: `pkg/dashboard/apiserver/schedule/schedule.go` (modified, +36/-35)
```diff
@@ -17,8 +17,8 @@ package schedule
 
 import (
 	"context"
-	"encoding/json"
 	"errors"
+	"maps"
 	"net/http"
 	"sort"
 	"strings"
@@ -27,6 +27,7 @@ import (
 	"github.com/gin-gonic/gin"
 	"github.com/go-logr/logr"
 	"gorm.io/gorm"
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/runtime"
 	"k8s.io/apimachinery/pkg/types"
@@ -202,25 +203,23 @@ func (s *Service) get(c *gin.Context) {
 		return
 	}
 
-	ns, name := sch.Namespace, sch.Name
-	schDetail = s.findScheduleInCluster(c, kubeCli, types.NamespacedName{Namespace: ns, Name: name})
+	schDetail = s.findScheduleInCluster(c, kubeCli, sch)
 	if schDetail == nil {
 		return
 	}
 
 	c.JSON(http.StatusOK, schDetail)
 }
 
-func (s *Service) findScheduleInCluster(c *gin.Context, kubeCli client.Client, namespacedName types.NamespacedName) *apiservertypes.ScheduleDetail {
-	var sch v1alpha1.Schedule
-
-	if err := kubeCli.Get(c.Request.Context(), namespacedName, &sch); err != nil {
+func (s *Service) findScheduleInCluster(c *gin.Context, kubeCli client.Client, record *core.Schedule) *apiservertypes.ScheduleDetail {
+	sch, err := getSchedule(c.Request.Context(), kubeCli, record)
+	if err != nil {
 		u.SetAPImachineryError(c, err)
 
 		return nil
 	}
 
-	gvk, err := apiutil.GVKForObject(&sch, s.scheme)
+	gvk, err := apiutil.GVKForObject(sch, s.scheme)
 	if err != nil {
 		u.SetAPImachineryError(c, err)
 
@@ -267,7 +266,7 @@ func (s *Service) findScheduleInCluster(c *gin.Context, kubeCli client.Client, n
 		Kind:           string(sch.Spec.Type),
 		UID:            string(sch.UID),
 		Created:        sch.CreationTimestamp.Format(time.RFC3339),
-		Status:         status.GetScheduleStatus(sch),
+		Status:         status.GetScheduleStatus(*sch),
 		ExperimentUIDs: UIDList,
 		KubeObject: core.KubeObjectDesc{
 			TypeMeta: metav1.TypeMeta{
@@ -318,8 +317,7 @@ func (s *Service) delete(c *gin.Context) {
 		return
 	}
 
-	ns, name := sch.Namespace, sch.Name
-	if err = checkAndDeleteSchedule(c.Request.Context(), kubeCli, types.NamespacedName{Namespace: ns, Name: name}); err != nil {
+	if err = checkAndDeleteSchedule(c.Request.Context(), kubeCli, sch); err != nil {
 		u.SetAPImachineryError(c, err)
 
 		return
@@ -376,8 +374,7 @@ func (s *Service) batchDelete(c *gin.Context) {
 			return
 		}
 
-		ns, name := sch.Namespace, sch.Name
-		if err = checkAndDeleteSchedule(c.Request.Context(), kubeCli, types.NamespacedName{Namespace: ns, Name: name}); err != nil {
+		if err = checkAndDeleteSchedule(c.Request.Context(), kubeCli, sch); err != nil {
 			u.SetAPImachineryError(c, err)
 
 			return
@@ -388,18 +385,24 @@ func (s *Service) batchDelete(c *gin.Context) {
 	c.JSON(http.StatusOK, u.ResponseSuccess)
 }
 
-func checkAndDeleteSchedule(ctx context.Context, kubeCli client.Client, namespacedName types.NamespacedName) (err error) {
-	var sch v1alpha1.Schedule
-
-	if err = kubeCli.Get(ctx, namespacedName, &sch); err != nil {
-		return
+func getSchedule(ctx context.Context, kubeCli client.Client, record *core.Schedule) (*v1alpha1.Schedule, error) {
+	sch := &v1alpha1.Schedule{}
+	if err := kubeCli.Get(ctx, types.NamespacedName{Namespace: record.Namespace, Name: record.Name}, sch); err != nil {
+		return nil, err
 	}
-
-	if err = kubeCli.Delete(ctx, &sch); err != nil {
-		return
+	if sch.GetUID() != types.UID(record.UID) {
+		return nil, apierrors.NewNotFound(v1alpha1.SchemeGroupVersion.WithResource("schedules").GroupResource(), record.Name)
 	}
+	return sch, nil
+}
 
-	return
+func checkAndDeleteSchedule(ctx context.Context, kubeCli client.Client, record *core.Schedule) error {
+	sch, err := getSchedule(ctx, kubeCli, record)
+	if err != nil {
+		return err
+	}
+	uid := sch.GetUID()
+	return kubeCli.Delete(ctx, sch, client.Preconditions{UID: &uid})
 }
 
 // @Summary Pause a schedule.
@@ -486,19 +489,17 @@ func (s *Service) startSchedule(c *gin.Context) {
 	c.JSON(http.StatusOK, u.ResponseSuccess)
 }
 
-func patchSchedule(ctx context.Context, kubeCli client.Client, sch *core.Schedule, annotations map[string]string) error {
-	var tmp v1alpha1.Schedule
-
-	if err := kubeCli.Get(ctx, types.NamespacedName{Namespace: sch.Namespace, Name: sch.Name}, &tmp); err != nil {
+func patchSchedule(ctx context.Context, kubeCli client.Client, record *core.Schedule, annotations map[string]string) error {
+	sch, err := getSchedule(ctx, kubeCli, record)
+	if err != nil {
 		return err
 	}
-
-	var mergePatch []byte
-	mergePatch, _ = json.Marshal(map[string]any{
-		"metadata": map[string]any{
-			"annotations": annotations,
-		},
-	})
-
-	return kubeCli.Patch(ctx, &tmp, client.RawPatch(types.MergePatchType, mergePatch))
+	before := sch.DeepCopy()
+	currentAnnotations := sch.GetAnnotations()
+	if currentAnnotations == nil {
+		currentAnnotations = make(map[string]string, len(annotations))
+	}
+	maps.Copy(currentAnnotations, annotations)
+	sch.SetAnnotations(currentAnnotations)
+	return kubeCli.Patch(ctx, sch, client.MergeFromWithOptions(bef
```

**File**: `pkg/dashboard/apiserver/schedule/schedule_test.go` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+// Copyright 2021 Chaos Mesh Authors.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+//
+
+package schedule
+
+import (
+	"context"
+	"encoding/json"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+	"time"
+
+	"github.com/gin-gonic/gin"
+	"github.com/go-logr/logr"
+	. "github.com/onsi/gomega"
+	"gorm.io/gorm"
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/types"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/client/fake"
+
+	"github.com/chaos-mesh/chaos-mesh/api/v1alpha1"
+	"github.com/chaos-mesh/chaos-mesh/pkg/clientpool"
+	"github.com/chaos-mesh/chaos-mesh/pkg/config"
+	apiservertypes "github.com/chaos-mesh/chaos-mesh/pkg/dashboard/apiserver/types"
+	"github.com/chaos-mesh/chaos-mesh/pkg/dashboard/core"
+)
+
+type scheduleClientPool struct {
+	clientpool.Clients
+	kube client.Client
+}
+
+func (p scheduleClientPool) Client(string) (client.Client, error) { return p.kube, nil }
+
+type scheduleLookup struct {
+	core.ScheduleStore
+	schedules map[string]*core.Schedule
+}
+
+func (s scheduleLookup) FindByUID(_ context.Context, uid string) (*core.Schedule, error) {
+	if schedule := s.schedules[uid]; schedule != nil {
+		return schedule, nil
+	}
+	return nil, gorm.ErrRecordNotFound
+}
+
+func TestScheduleAPILifecycle(t *testing.T) {
+	g := NewWithT(t)
+	ctx := t.Context()
+	scheme := runtime.NewScheme()
+	g.Expect(v1alpha1.AddToScheme(scheme)).To(Succeed())
+	makeSchedule := func(namespace, name string, created int64) *v1alpha1.Schedule {
+		schedule := &v1alpha1.Schedule{Namespace: namespace, Name: name, UID: types.UID(namespace + "-" + name),
+			CreationTimestamp: metav1.NewTime(time.Unix(created, 0)), Annotations: map[string]string{"owner": "test"}}
+		schedule.Spec.Type = v1alpha1.ScheduleTypePodChaos
+		schedule.Spec.Schedule = "@every 1h"
+		return schedule
+	}
+	primary, secondary, foreign := makeSchedule("test", "primary", 100), makeSchedule("test", "secondary", 200), makeSchedule("foreign", "primary", 300)
+	child := &v1alpha1.PodChaos{ObjectMeta: metav1.ObjectMeta{Namespace: "test", Name: "child", UID: "child-uid", Labels: map[string]string{v1alpha1.LabelManagedBy: primary.Name}}}
+	foreignChild := child.DeepCopy()
+	foreignChild.Namespace, foreignChild.UID = "foreign", "foreign-child-uid"
+	kube := fake.NewClientBuilder().WithScheme(scheme).WithObjects(primary, secondary, foreign, child, foreignChild).Build()
+	old := clientpool.K8sClients
+	clientpool.K8sClients = scheduleClientPool{kube: kube}
+	t.Cleanup(func() { clientpool.K8sClients = old })
+	store := scheduleLookup{schedules: map[string]*core.Schedule{
+		"one":   {ScheduleMeta: core.ScheduleMeta{Namespace: "test", Name: primary.Name, UID: string(primary.UID)}},
+		"two":   {ScheduleMeta: core.ScheduleMeta{Namespace: "test", Name: secondary.Name, UID: string(secondary.UID)}},
+		"stale": {ScheduleMeta: core.ScheduleMeta{Namespace: "test", Name: "missing", UID: "stale"}},
+		"old":   {ScheduleMeta: core.ScheduleMeta{Namespace: "test", Name: primary.Name, UID: "old"}},
+	}}
+	router := gin.New()
+	Register(router.Group("/api"), NewService(store, nil, &config.ChaosDashboardConfig{TargetNamespace: "test"}, scheme, logr.Discard()))
+	request := func(method, path string, code int) []byte {
+		t.Helper()
+		out := httptest.NewRecorder()
+		router.ServeHTTP(out, httptest.NewRequest(method, "/api/schedules"+path, nil))
+		g.Expect(out.Code).To(Equal(code), out.Body.String())
+		return out.Body.Bytes()
+	}
+
+	var listed []apiservertypes.Schedule
+	g.Expect(json.Unmarshal(request(http.MethodGet, "", http.StatusOK), &listed)).To(Succeed())
+	g.Expect(listed).To(HaveLen(2))
+	g.Expect(listed[0].Name).To(Equal(secondary.Name))
+	g.Expect(listed[1].Name).To(Equal(primary.Name))
+	g.Expect(json.Unmarshal(request(http.MethodGet, "?name=primary", http.StatusOK), &listed)).To(Succeed())
+	g.Expect(listed).To(HaveLen(1))
+	g.Expect(listed[0].Namespace).To(Equal("test"))
+
+	var detail apiservertypes.ScheduleDetail
+	g.Expect(json.Unmarshal(request(http.MethodGet, "/one", http.StatusOK), &detail)).To(Succeed())
+	g.Expect(detail.ExperimentUIDs).To(Equal([]string{"child-uid"}))
+	g.Expect(detail.KubeObject.Kind).To(Equal("Schedule"))
+	key := client.ObjectKeyFromObject(primary)
+	request(http.MethodGet, "/old", http.StatusNotFound)
+	request(http.MethodPut, "/pause/old", http.StatusNotFo
```

---

### Incident Patch 3: `c358be41` (2026-11-22)
**Commit Message**: fix(daemon): harden fault application and recovery (#5263)

* fix(daemon): harden fault application and recovery

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

* docs(changelog): link the daemon fixes

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

---------

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -86,6 +86,11 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 - Keep Schedule job reconciliation within the Schedule's namespace and report list failures without panicking. [#5256](https://github.com/chaos-mesh/chaos-mesh/pull/5256)
 - Prevent NetworkChaos partition retries from duplicating rules on Pods that match only the target selector. [#5256](https://github.com/chaos-mesh/chaos-mesh/pull/5256)
 - Retry StressChaos recovery when Chaos Daemon fails to cancel a stressor. [#5258](https://github.com/chaos-mesh/chaos-mesh/pull/5258)
+- Hold the HTTPChaos proxy pipe lock until the full response has been read. [#5263](https://github.com/chaos-mesh/chaos-mesh/pull/5263)
+- Preserve paths with spaces in Linux process mappings and return an error for malformed address ranges. [#5263](https://github.com/chaos-mesh/chaos-mesh/pull/5263)
+- Make TimeChaos requests retryable across overlapping experiments and independent containers in the same pod. [#5263](https://github.com/chaos-mesh/chaos-mesh/pull/5263)
+- Clean up partially started StressChaos stressors before returning an injection error. [#5263](https://github.com/chaos-mesh/chaos-mesh/pull/5263)
+- Reject BlockChaos requests with a missing delay specification before accessing the device. [#5263](https://github.com/chaos-mesh/chaos-mesh/pull/5263)
 - Require a positive, space-free memory size in StressChaos and accept only whole-number percentages up to 100%. Clarify the memory stressor options and OOM behavior. [#5251](https://github.com/chaos-mesh/chaos-mesh/pull/5251)
 - Upgrade memStress to [v0.4.0](https://github.com/chaos-mesh/memStress/releases/tag/v0.4.0) to fix sub-millisecond memory ramps and start the initial StressChaos memory workers concurrently. [#5249](https://github.com/chaos-mesh/chaos-mesh/pull/5249)
 - Add `time` to the StressChaos memory stressor [#5247](https://github.com/chaos-mesh/chaos-mesh/pull/5247)
```

**File**: `pkg/chaosdaemon/blockchaos_server_linux.go` (modified, +41/-19)
```diff
@@ -18,6 +18,7 @@ package chaosdaemon
 import (
 	"context"
 	"os"
+	"path/filepath"
 	"strings"
 
 	"github.com/chaos-mesh/chaos-driver/pkg/client"
@@ -26,26 +27,55 @@ import (
 
 	"github.com/chaos-mesh/chaos-mesh/pkg/bpm"
 	pb "github.com/chaos-mesh/chaos-mesh/pkg/chaosdaemon/pb"
+	"github.com/chaos-mesh/chaos-mesh/pkg/mock"
 )
 
 const chaosDaemonHelperCommand = "cdh"
 
+type blockChaosDriver interface {
+	InjectIOEMDelay(string, int, uint, int64, int64, float64) (int, error)
+	Recover(int) error
+	Close() error
+}
+
+func newBlockChaosDriver() (blockChaosDriver, error) {
+	if fixture := mock.On("MockBlockChaosDriver"); fixture != nil {
+		return fixture.(func() (blockChaosDriver, error))()
+	}
+	return client.New()
+}
+
+type blockDeviceRoots struct {
+	dev, sysBlock string
+}
+
 func (s *DaemonServer) ApplyBlockChaos(ctx context.Context, req *pb.ApplyBlockChaosRequest) (*pb.ApplyBlockChaosResponse, error) {
 	log := s.getLoggerFromContext(ctx)
 
+	if req.Action != pb.ApplyBlockChaosRequest_Delay {
+		return nil, errors.New("unknown action")
+	}
+	if req.Delay == nil {
+		return nil, errors.New("block IO delay specification is required")
+	}
+
 	volumeName, err := normalizeVolumeName(ctx, req.VolumePath)
 	if err != nil {
 		log.Error(err, "normalize volume name", "volumePath", req.VolumePath)
 		return nil, err
 	}
 
-	err = enableIOEMElevator(volumeName)
+	roots := blockDeviceRoots{dev: "/dev", sysBlock: "/sys/block"}
+	if fixture := mock.On("MockBlockDeviceRoots"); fixture != nil {
+		roots = fixture.(blockDeviceRoots)
+	}
+	volumePath := filepath.Join(roots.dev, volumeName)
+	err = enableIOEMElevator(filepath.Join(roots.sysBlock, volumeName, "queue", "scheduler"))
 	if err != nil {
 		log.Error(err, "error while enabling ioem elevator", "volumeName", volumeName)
 		return nil, errors.Wrapf(err, "enable ioem elevator for volume %s", volumeName)
 	}
 
-	volumePath := "/dev/" + volumeName
 	if _, err := os.Stat(volumePath); err != nil {
 		log.Error(err, "error while getting stat of volume", "volumePath", volumePath)
 		return nil, errors.Wrapf(err, "volume path %s does not exist", volumePath)
@@ -57,27 +87,20 @@ func (s *DaemonServer) ApplyBlockChaos(ctx context.Context, req *pb.ApplyBlockCh
 		return nil, err
 	}
 
-	c, err := client.New()
+	c, err := newBlockChaosDriver()
 	if err != nil {
 		log.Error(err, "create chaos-driver client")
 		return nil, err
 	}
 	defer c.Close()
 
-	if req.Action == pb.ApplyBlockChaosRequest_Delay {
-		log.Info("Injecting IOEM Delay", "delay", req.Delay.Delay, "jitter", req.Delay.Jitter, "corr", req.Delay.Correlation)
-
-		id, err := c.InjectIOEMDelay(volumePath, 0, uint(pid), req.Delay.Delay, req.Delay.Jitter, float64(req.Delay.Correlation))
-		if err != nil {
-			log.Error(err, "inject ioem delay")
-			return nil, err
-		}
-		return &pb.ApplyBlockChaosResponse{
-			InjectionId: int32(id),
-		}, nil
+	log.Info("Injecting IOEM Delay", "delay", req.Delay.Delay, "jitter", req.Delay.Jitter, "corr", req.Delay.Correlation)
+	id, err := c.InjectIOEMDelay(volumePath, 0, uint(pid), req.Delay.Delay, req.Delay.Jitter, float64(req.Delay.Correlation))
+	if err != nil {
+		log.Error(err, "inject ioem delay")
+		return nil, err
 	}
-
-	return nil, errors.New("unknown action")
+	return &pb.ApplyBlockChaosResponse{InjectionId: int32(id)}, nil
 }
 
 func normalizeVolumeName(ctx context.Context, volumePath string) (string, error) {
@@ -94,8 +117,7 @@ func normalizeVolumeName(ctx context.Context, volumePath string) (string, error)
 	return strings.Trim(string(volumeName), "\n\x00"), nil
 }
 
-func enableIOEMElevator(volumeName string) error {
-	schedulerPath := "/sys/block/" + volumeName + "/queue/scheduler"
+func enableIOEMElevator(schedulerPath string) error {
 	rawSchedulers, err := os.ReadFile(schedulerPath)
 	if err != nil {
 		return errors.Wrapf(err, "reading schedulers %s", schedulerPath)
@@ -139,7 +161,7 @@ func enableIOEMElevator(volumeName string) error {
 func (s *DaemonServer) RecoverBlockChaos(ctx context.Context, req *pb.RecoverBlockChaosRequest) (*empty.Empty, error) {
 	log := s.getLoggerFromContext(ctx)
 
-	c, err := client.New()
+	c, err := newBlockChaosDriver()
 	if err != nil {
 		log.Error(err, "create chaos-driver client")
 		return nil, err
```

**File**: `pkg/chaosdaemon/blockchaos_server_linux_test.go` (added, +139/-0)
```diff
@@ -0,0 +1,139 @@
+// Copyright 2022 Chaos Mesh Authors.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+//
+
+package chaosdaemon
+
+import (
+	"context"
+	"errors"
+	"os"
+	"os/exec"
+	"path/filepath"
+	"testing"
+
+	"github.com/go-logr/logr"
+	. "github.com/onsi/gomega"
+
+	"github.com/chaos-mesh/chaos-mesh/pkg/chaosdaemon/pb"
+	"github.com/chaos-mesh/chaos-mesh/pkg/mock"
+)
+
+type blockDelayCall struct {
+	path          string
+	operation     int
+	pid           uint
+	delay, jitter int64
+	correlation   float64
+}
+
+type blockDriverFixture struct {
+	delayCalls            []blockDelayCall
+	recoveries            []int
+	closes                int
+	injectErr, recoverErr error
+}
+
+func (f *blockDriverFixture) InjectIOEMDelay(path string, op int, pid uint, delay, jitter int64, correlation float64) (int, error) {
+	f.delayCalls = append(f.delayCalls, blockDelayCall{path, op, pid, delay, jitter, correlation})
+	return 73, f.injectErr
+}
+
+func (f *blockDriverFixture) Recover(id int) error {
+	f.recoveries = append(f.recoveries, id)
+	return f.recoverErr
+}
+
+func (f *blockDriverFixture) Close() error {
+	f.closes++
+	return nil
+}
+
+func TestBlockChaosDeviceAndDriverLifecycle(t *testing.T) {
+	g := NewWithT(t)
+	ctx := t.Context()
+	roots := blockDeviceRoots{dev: t.TempDir(), sysBlock: t.TempDir()}
+	const disk = "testdisk"
+	device := filepath.Join(roots.dev, disk)
+	scheduler := filepath.Join(roots.sysBlock, disk, "queue", "scheduler")
+	g.Expect(os.MkdirAll(filepath.Dir(scheduler), 0700)).To(Succeed())
+	installFixture := func(name string, value any) {
+		t.Helper()
+		cleanup := mock.With(name, value)
+		t.Cleanup(func() { g.Expect(cleanup()).To(Succeed()) })
+	}
+	installFixture("MockBlockDeviceRoots", roots)
+	driver := &blockDriverFixture{}
+	var driverErr error
+	installFixture("MockBlockChaosDriver", func() (blockChaosDriver, error) { return driver, driverErr })
+	normalizeFails := false
+	normalizations := 0
+	installFixture("MockProcessBuild", func(ctx context.Context, command string, args ...string) *exec.Cmd {
+		g.Expect(filepath.Base(command)).To(Equal("nsexec"))
+		g.Expect(args).To(Equal([]string{"-l", "-m", "/proc/1/ns/mnt", "--", "cdh", "normalize-volume-name", "/mount/fixture"}))
+		normalizations++
+		if normalizeFails {
+			return daemonTestCommand(ctx, "invalid fixture volume", true)
+		}
+		return daemonTestCommand(ctx, disk, false)
+	})
+	runtime := &httpChaosRuntimeClientStub{containerPID: 82}
+	server := &DaemonServer{crClient: runtime, rootLogger: logr.Discard()}
+	req := &pb.ApplyBlockChaosRequest{ContainerId: "containerd://fixture", VolumePath: "/mount/fixture"}
+	g.Expect(server.ApplyBlockChaos(ctx, req)).Error().To(MatchError(ContainSubstring("delay specification is required")))
+	req.Action = 99
+	g.Expect(server.ApplyBlockChaos(ctx, req)).Error().To(MatchError("unknown action"))
+	g.Expect(normalizations).To(BeZero())
+	req.Action = pb.ApplyBlockChaosRequest_Delay
+	req.Delay = &pb.BlockDelaySpec{Delay: 15, Jitter: 2, Correlation: 0.5}
+
+	normalizeFails = true
+	g.Expect(server.ApplyBlockChaos(ctx, req)).Error().To(MatchError(ContainSubstring("normalize volume name")))
+	normalizeFails = false
+	g.Expect(server.ApplyBlockChaos(ctx, req)).Error().To(MatchError(ContainSubstring("reading schedulers")))
+	g.Expect(os.WriteFile(scheduler, []byte("[none] mq-deadline\n"), 0600)).To(Succeed())
+	g.Expect(server.ApplyBlockChaos(ctx, req)).Error().To(MatchError(ContainSubstring("ioem scheduler not found")))
+	g.Expect(runtime.containerCalls).To(BeZero())
+
+	g.Expect(os.WriteFile(scheduler, []byte("[none] ioem-mq\n"), 0600)).To(Succeed())
+	g.Expect(server.ApplyBlockChaos(ctx, req)).Error().To(MatchError(ContainSubstring("does not exist")))
+	g.Expect(os.ReadFile(scheduler)).To(Equal([]byte("ioem-mq")))
+	g.Expect(os.WriteFile(scheduler, []byte("none [ioem-mq]\n"), 0600)).To(Succeed())
+	g.Expect(os.WriteFile(device, nil, 0600)).To(Succeed())
+	failure := errors.New("fixture unavailable")
+	runtime.containerErr = failure
+	g.Expect(server.ApplyBlockChaos(ctx, req)).Error().To(MatchError(failure))
+	runtime.containerErr = nil
+	driverErr = failure
+	g.Expect(server.ApplyBlockChaos(ctx, req)).Error().To(MatchError(failure))
+	g.Expect(server.RecoverBlockChaos(ctx, &pb.RecoverBlockChaosRequest{})).Error().To(MatchError(failure))
+	g.Expect(driver.closes).To(BeZero())
+	driverErr = nil
+	driver.injectErr = failure
+	g.Expect(server.ApplyBlockChaos(ctx, req)).Error().To(M
```

**File**: `pkg/chaosdaemon/httpchaos_server.go` (modified, +19/-21)
```diff
@@ -45,30 +45,34 @@ type stdioTransport struct {
 	pipes  bpm.Pipes
 }
 
-func (t *stdioTransport) RoundTrip(req *http.Request) (resp *http.Response, err error) {
+// exchange keeps the process's stdin and stdout exclusive until the entire
+// response has been read, including its body.
+func (t *stdioTransport) exchange(req *http.Request) (int, []byte, error) {
 	if _, loaded := t.locker.LoadOrStore(t.uid, true); loaded {
-		return &http.Response{
-			StatusCode: http.StatusLocked,
-			Status:     http.StatusText(http.StatusLocked),
-			Body:       io.NopCloser(bytes.NewBufferString("")),
-			Request:    req,
-		}, nil
+		return http.StatusLocked, nil, nil
 	}
 	defer t.locker.Delete(t.uid)
 	if t.pipes.Stdin == nil {
-		return nil, errors.New("fail to get stdin of process")
+		return 0, nil, errors.New("fail to get stdin of process")
 	}
 	if t.pipes.Stdout == nil {
-		return nil, errors.New("fail to get stdout of process")
+		return 0, nil, errors.New("fail to get stdout of process")
 	}
 
-	err = req.Write(t.pipes.Stdin)
+	if err := req.Write(t.pipes.Stdin); err != nil {
+		return 0, nil, errors.Wrap(err, "write request")
+	}
+	resp, err := http.ReadResponse(bufio.NewReader(t.pipes.Stdout), req)
 	if err != nil {
-		return
+		return 0, nil, errors.Wrap(err, "read response")
 	}
+	defer resp.Body.Close()
 
-	resp, err = http.ReadResponse(bufio.NewReader(t.pipes.Stdout), req)
-	return
+	body, err := io.ReadAll(resp.Body)
+	if err != nil {
+		return 0, nil, errors.Wrap(err, "read response body")
+	}
+	return resp.StatusCode, body, nil
 }
 
 //revive:disable-next-line:var-naming Preserve the generated protobuf RPC contract.
@@ -152,23 +156,17 @@ func (s *DaemonServer) applyHTTPChaos(ctx context.Context, in *pb.ApplyHttpChaos
 		return nil, errors.Wrap(err, "create http request")
 	}
 
-	resp, err := transport.RoundTrip(req)
+	statusCode, body, err := transport.exchange(req)
 	if err != nil {
 		return nil, errors.Wrap(err, "send http request")
 	}
-
 	log.Info("http chaos applied")
 
-	body, err := io.ReadAll(resp.Body)
-	if err != nil {
-		return nil, errors.Wrap(err, "read response body")
-	}
-
 	return &pb.ApplyHttpChaosResponse{
 		Instance:    int64(in.Instance),
 		InstanceUid: in.InstanceUid,
 		StartTime:   in.StartTime,
-		StatusCode:  int32(resp.StatusCode),
+		StatusCode:  int32(statusCode),
 		Error:       string(body),
 	}, nil
 }
```

**File**: `pkg/chaosdaemon/httpchaos_server_test.go` (modified, +75/-0)
```diff
@@ -24,6 +24,7 @@ import (
 	"net/http"
 	"os"
 	"runtime"
+	"strconv"
 	"strings"
 	"sync"
 	"testing"
@@ -294,3 +295,77 @@ func TestHTTPChaosStdioHelper(t *testing.T) {
 	require.NoError(t, err)
 	os.Exit(0)
 }
+
+type testInputPipe struct {
+	bytes.Buffer
+}
+
+func (*testInputPipe) Close() error { return nil }
+
+type responseBodyReader struct {
+	io.Reader
+	onFirstRead func()
+}
+
+func (r *responseBodyReader) Read(b []byte) (int, error) {
+	if r.onFirstRead != nil {
+		onRead := r.onFirstRead
+		r.onFirstRead = nil
+		onRead()
+	}
+	return r.Reader.Read(b)
+}
+
+func TestHTTPChaosSerializesThroughResponseBody(t *testing.T) {
+	input := &testInputPipe{}
+	locker := &sync.Map{}
+	transport := &stdioTransport{uid: "instance", locker: locker}
+	request, err := http.NewRequest(http.MethodPut, "/", strings.NewReader("first"))
+	require.NoError(t, err)
+
+	const responseBody = "proxy rejected the configuration"
+	header := "HTTP/1.1 422 Unprocessable Entity\r\nContent-Length: " + strconv.Itoa(len(responseBody)) + "\r\n\r\n"
+	var competingCalls int
+	reader := &responseBodyReader{
+		Reader: strings.NewReader(responseBody),
+		onFirstRead: func() {
+			competingCalls++
+			before := input.String()
+			competing, err := http.NewRequest(http.MethodPut, "/", strings.NewReader("second"))
+			require.NoError(t, err)
+			other := &stdioTransport{uid: transport.uid, locker: locker, pipes: transport.pipes}
+			code, body, err := other.exchange(competing)
+			require.NoError(t, err)
+			require.Equal(t, http.StatusLocked, code)
+			require.Empty(t, body)
+			require.Equal(t, before, input.String())
+		},
+	}
+	transport.pipes = bpm.Pipes{Stdin: input, Stdout: io.NopCloser(io.MultiReader(strings.NewReader(header), reader))}
+	code, body, err := transport.exchange(request)
+	require.NoError(t, err)
+	require.Equal(t, 1, competingCalls)
+	require.Equal(t, http.StatusUnprocessableEntity, code)
+	require.Equal(t, responseBody, string(body))
+	require.Contains(t, input.String(), "first")
+	_, locked := locker.Load(transport.uid)
+	require.False(t, locked)
+}
+
+func TestHTTPChaosReleasesStdioLockAfterTruncatedResponse(t *testing.T) {
+	input := &testInputPipe{}
+	locker := &sync.Map{}
+	transport := &stdioTransport{
+		uid: "instance", locker: locker,
+		pipes: bpm.Pipes{
+			Stdin:  input,
+			Stdout: io.NopCloser(strings.NewReader("HTTP/1.1 200 OK\r\nContent-Length: 6\r\n\r\ncut")),
+		},
+	}
+	request, err := http.NewRequest(http.MethodPut, "/", nil)
+	require.NoError(t, err)
+	_, _, err = transport.exchange(request)
+	require.ErrorIs(t, err, io.ErrUnexpectedEOF)
+	_, locked := locker.Load(transport.uid)
+	require.False(t, locked)
+}
```

**File**: `pkg/chaosdaemon/jvm_server_test.go` (modified, +64/-5)
```diff
@@ -46,6 +46,7 @@ var _ = Describe("JVM rule lifecycle", func() {
 		commands      []string
 		failAt        string
 		message       string
+		namespaced    []string
 	)
 
 	BeforeEach(func() {
@@ -56,12 +57,18 @@ var _ = Describe("JVM rule lifecycle", func() {
 		ginkgo.Setenv("BYTEMAN_HOME", bytemanHome)
 		runtimeClient = &httpChaosRuntimeClientStub{containerPID: 90_000_000}
 		server = &DaemonServer{crClient: runtimeClient, rootLogger: logr.Discard()}
-		commands, failAt, message = nil, "", ""
+		commands, namespaced, failAt, message = nil, nil, "", ""
 		DeferCleanup(mock.With("MockProcessBuild", func(ctx context.Context, cmd string, args ...string) *exec.Cmd {
-			Expect(cmd).To(Equal("sh"))
-			Expect(args).To(HaveLen(2))
-			Expect(args[0]).To(Equal("-c"))
-			command := args[1]
+			if filepath.Base(cmd) == "nsexec" {
+				Expect(args).To(ContainElement("--"))
+				Expect(args[len(args)-3 : len(args)-1]).To(Equal([]string{"sh", "-c"}))
+				namespaced = append(namespaced, strings.Join(args[:len(args)-4], " "))
+			} else {
+				Expect(cmd).To(Equal("sh"))
+				Expect(args).To(HaveLen(2))
+				Expect(args[0]).To(Equal("-c"))
+			}
+			command := args[len(args)-1]
 			commands = append(commands, command)
 			for _, prefix := range []string{submitRule, removeRule} {
 				if path, ok := strings.CutPrefix(command, prefix); ok {
@@ -135,4 +142,56 @@ var _ = Describe("JVM rule lifecycle", func() {
 		Expect(err).To(MatchError(runtimeClient.containerErr))
 		Expect(commands).To(BeEmpty())
 	})
+
+	It("copies Byteman jars before applying the rule in the network namespace", func(ctx SpecContext) {
+		lib := filepath.Join(bytemanHome, "lib")
+		Expect(os.Mkdir(lib, 0700)).To(Succeed())
+		jars := []string{"byteman.jar", "byteman-helper.jar", "chaos-agent.jar"}
+		for _, jar := range jars {
+			Expect(os.WriteFile(filepath.Join(lib, jar), []byte(jar), 0600)).To(Succeed())
+		}
+		req := &pb.InstallJVMRulesRequest{ContainerId: "runtime-id", Port: 9091, Rule: rule, EnterNS: true}
+		_, err := server.InstallJVMRules(ctx, req)
+		Expect(err).NotTo(HaveOccurred())
+		Expect(commands).To(HaveLen(7))
+		Expect(commands[0]).To(Equal("mkdir -p " + lib + "/"))
+		for i, jar := range jars {
+			Expect(commands[i+1]).To(Equal("cat > /usr/local/byteman/lib/" + jar))
+		}
+		Expect(commands[4]).To(HavePrefix(install))
+		Expect(commands[5]).To(Equal(submitHelper + filepath.Join(lib, "byteman-helper.jar")))
+		Expect(commands[6]).To(HavePrefix(submitRule))
+		Expect(namespaced).To(Equal([]string{
+			"-p /proc/90000000/ns/pid -m /proc/90000000/ns/mnt",
+			"-p /proc/90000000/ns/pid -m /proc/90000000/ns/mnt",
+			"-p /proc/90000000/ns/pid -m /proc/90000000/ns/mnt",
+			"-p /proc/90000000/ns/pid -m /proc/90000000/ns/mnt",
+			"-n /proc/90000000/ns/net",
+			"-n /proc/90000000/ns/net",
+		}))
+
+		commands = nil
+		failAt, message = "cat > ", "copy failed"
+		_, err = server.InstallJVMRules(ctx, req)
+		Expect(err).To(MatchError(ContainSubstring(message)))
+		Expect(commands).To(HaveLen(2))
+		commands = nil
+		failAt, message = "mkdir -p ", "mkdir failed"
+		_, err = server.InstallJVMRules(ctx, req)
+		Expect(err).To(MatchError(ContainSubstring(message)))
+		Expect(commands).To(HaveLen(1))
+	})
+
+	It("rejects missing setup and propagates a fatal agent installation error", func(ctx SpecContext) {
+		req := &pb.InstallJVMRulesRequest{ContainerId: "runtime-id", Port: 9091, Rule: rule}
+		GinkgoT().Setenv("BYTEMAN_HOME", "")
+		_, err := server.InstallJVMRules(ctx, req)
+		Expect(err).To(MatchError(ContainSubstring("BYTEMAN_HOME not set")))
+		Expect(commands).To(BeEmpty())
+		GinkgoT().Setenv("BYTEMAN_HOME", bytemanHome)
+		failAt, message = install, "agent installation failed"
+		_, err = server.InstallJVMRules(ctx, req)
+		Expect(err).To(MatchError(ContainSubstring(message)))
+		Expect(commands).To(ConsistOf(HavePrefix(install)))
+	})
 })
```

**File**: `pkg/chaosdaemon/pb/wire_test.go` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+// Copyright 2022 Chaos Mesh Authors.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+//
+
+package pb
+
+import (
+	"testing"
+
+	. "github.com/onsi/gomega"
+	"google.golang.org/protobuf/proto"
+
+	"github.com/chaos-mesh/chaos-mesh/test/pkg/protocontract"
+)
+
+func TestDaemonWireContract(t *testing.T) {
+	protocontract.CheckWireContract(t, File_chaosdaemon_proto)
+}
+
+func TestStressRequestWithLegacyFieldNumbering(t *testing.T) {
+	g := NewWithT(t)
+	// scope=Pod, target="pod", obsolete field 6, oomScoreAdj=250 at field 7.
+	wire := []byte{0x08, 0x01, 0x12, 0x03, 'p', 'o', 'd', 0x30, 0x09, 0x38, 0xfa, 0x01}
+	request := &ExecStressRequest{}
+	g.Expect(proto.Unmarshal(wire, request)).To(Succeed())
+	g.Expect(request.GetScope()).To(Equal(ExecStressRequest_POD))
+	g.Expect(request.GetTarget()).To(Equal("pod"))
+	g.Expect(request.GetOomScoreAdj()).To(Equal(int32(250)))
+	g.Expect(request.GetEnterNS()).To(BeFalse())
+	g.Expect([]byte(request.ProtoReflect().GetUnknown())).To(Equal([]byte{0x30, 0x09}))
+}
```

**File**: `pkg/chaosdaemon/process_lifecycle_linux_test.go` (added, +293/-0)
```diff
@@ -0,0 +1,293 @@
+// Copyright Chaos Mesh Authors.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+//go:build linux
+
+package chaosdaemon
+
+import (
+	"context"
+	"encoding/json"
+	"errors"
+	"fmt"
+	"io"
+	"os"
+	"os/exec"
+	"path/filepath"
+	"strconv"
+	"testing"
+	"time"
+
+	"github.com/go-logr/logr"
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+
+	"github.com/chaos-mesh/chaos-mesh/api/v1alpha1"
+	"github.com/chaos-mesh/chaos-mesh/pkg/bpm"
+	"github.com/chaos-mesh/chaos-mesh/pkg/chaosdaemon/cgroups"
+	"github.com/chaos-mesh/chaos-mesh/pkg/chaosdaemon/pb"
+	"github.com/chaos-mesh/chaos-mesh/pkg/mock"
+)
+
+var _ = Describe("Daemon process lifecycle", func() {
+	var server *DaemonServer
+	var runtimeClient *httpChaosRuntimeClientStub
+
+	BeforeEach(func() {
+		runtimeClient = &httpChaosRuntimeClientStub{containerPID: 42}
+		server = NewDaemonServerWithCRClient(runtimeClient, nil, logr.Discard())
+		DeferCleanup(func() { server.backgroundProcessManager.Shutdown(context.Background()) })
+	})
+
+	It("checks the runtime before launching either type of stressor", func(ctx SpecContext) {
+		response, err := server.ExecStressors(ctx, &pb.ExecStressRequest{})
+		Expect(err).NotTo(HaveOccurred())
+		Expect(response).To(Equal(&pb.ExecStressResponse{}))
+		Expect(runtimeClient.containerCalls).To(BeZero())
+
+		runtimeClient.containerErr = errors.New("runtime unavailable")
+		for _, req := range []*pb.ExecStressRequest{
+			{Target: "fixture", CpuStressors: "--cpu 1", MemoryStressors: "--vm 1"},
+			{Target: "fixture", MemoryStressors: "--vm 1"},
+		} {
+			response, err := server.ExecStressors(ctx, req)
+			Expect(err).To(MatchError(runtimeClient.containerErr))
+			Expect(response).To(BeNil())
+		}
+		Expect(runtimeClient.containerCalls).To(Equal(2))
+	})
+
+	It("reaps a CPU stressor after a memory launch failure and reports only the retried processes", func(ctx SpecContext) {
+		failure := errors.New("fixture attach failure")
+		var cpuPID, memoryPID, workerPID int
+		workerFile := filepath.Join(GinkgoT().TempDir(), "worker-pid")
+		pendingFailure := true
+		resolveCount := 0
+		DeferCleanup(mock.With("MockStressCGroupAttacher", func(target int) (cgroups.AttachCGroup, error) {
+			Expect(target).To(Equal(42))
+			resolveCount++
+			if resolveCount%2 == 1 {
+				return stressCGroupFixture{attach: func(pid int) error {
+					cpuPID = pid
+					if pendingFailure {
+						Eventually(ctx, func() error {
+							value, err := os.ReadFile(workerFile)
+							if err != nil {
+								return err
+							}
+							workerPID, err = strconv.Atoi(string(value))
+							return err
+						}).Should(Succeed())
+						process, err := os.FindProcess(workerPID)
+						Expect(err).NotTo(HaveOccurred())
+						DeferCleanup(func() {
+							_ = process.Kill()
+							_ = process.Release()
+						})
+					}
+					return nil
+				}}, nil
+			}
+			return stressCGroupFixture{attach: func(pid int) error {
+				memoryPID = pid
+				if pendingFailure {
+					pendingFailure = false
+					return failure
+				}
+				return nil
+			}}, nil
+		}))
+		DeferCleanup(mock.With("MockProcessBuild", func(_ context.Context, command string, args ...string) *exec.Cmd {
+			Expect(command).To(Equal("/usr/local/bin/pause"))
+			Expect(args).To(Or(ContainElement("stress-ng"), ContainElement("memStress")))
+			if resolveCount == 1 {
+				return exec.CommandContext(ctx, "sh", "-c", `
+sleep 60 &
+worker=$!
+trap 'kill "$worker"; wait "$worker"; exit 0' TERM
+printf '%s' "$worker" > "$1"
+wait "$worker"
+`, "fixture-stressor", workerFile)
+			}
+			return exec.CommandContext(ctx, "sleep", "60")
+		}))
+		Expect(mock.On("MockProcessBuild")).NotTo(BeNil(), "run with failpoint instrumentation")
+
+		req := &pb.ExecStressRequest{Target: "fixture", CpuStressors: "--cpu 1", MemoryStressors: "--size 32M", EnterNS: true, OomScoreAdj: 10}
+		response, err := server.ExecStressors(ctx, req)
+		Expect(response).To(BeNil())
+		Expect(err).To(MatchError(failure))
+		Expect(cpuPID).To(BeNumerically(">", 0))
+		Expect(memoryPID).To(BeNumerically(">", 0))
+		for _, pid := range []int{cpuPID, memoryPID, workerPID} {
+			// Waiting for each child to be reaped also removes it from the process manager.
+			_, err := os.Stat("/proc/" + strconv.Itoa(pid))
+			Expect(errors.Is(err, os.ErrNotExist)).To(BeTrue())
+		}
+
+		response, err = server.ExecStressors(ctx, req)
+		Expect(err).NotTo(HaveOccurred())
+		Expect(response.GetCpuInstance()).To(Equal(strconv.I
```

#### Recent Merged Pull Requests:
- **PR #5266** (closed): docs(changelog): consolidate daemon and dashboard fixes (@g1eny0ung)
- **PR #5264** (2026-11-22): fix(dashboard): protect resource identity and Helm lifecycle (@g1eny0ung)
- **PR #5263** (2026-11-22): fix(daemon): harden fault application and recovery (@g1eny0ung)
- **PR #5262** (2026-11-22): ci(e2e): run affected suites on master pull requests (@g1eny0ung)
- **PR #5261** (2026-11-21): ci(e2e): skip builds for existing caches (@g1eny0ung)
- **PR #5260** (2026-11-21): ci(e2e): migrate build caches to actions/cache v6 (@g1eny0ung)

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

## X. api): validate PodChaos and BlockChaos action requirements in the CRD schema

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chaos-mesh/chaos-mesh. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fdb9684b`: api): validate PodChaos and BlockChaos action requirements in the CRD schema. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
- Validate the PodChaos `container-kill` container names and the BlockChaos `delay` spec with CEL rules in the CRD schemas, including when embedded in Schedules and Workflows [#5245](https://github.com/chaos-mesh/chaos-mesh/pull/5245)
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fdb9684b` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

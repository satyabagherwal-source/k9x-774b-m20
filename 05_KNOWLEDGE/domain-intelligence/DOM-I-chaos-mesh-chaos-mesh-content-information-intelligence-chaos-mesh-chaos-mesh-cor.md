# Domain I — Content & Information Intelligence: Content & Information Intelligence: chaos-mesh/chaos-mesh Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "chaos-mesh/chaos-mesh",
  "source_url": "https://github.com/chaos-mesh/chaos-mesh",
  "source_version": "394c7561",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T11:39:50.485Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-chaos-mesh-chaos-mesh",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [chaos-mesh/chaos-mesh](https://github.com/chaos-mesh/chaos-mesh) (Revision: `394c7561`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T11:39:50.485Z`  
> **Learning ID**: `learn-github-chaos-mesh-chaos-mesh`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain I (Content & Information Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), G (Architecture Intelligence), H (Technical Construction Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), B (Product Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 63%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from chaos-mesh/chaos-mesh:

# Forensic Learning Record (Deep Inspection): chaos-mesh/chaos-mesh

> **Canonical Artifact**: `07_PROJECT_LEARNING/chaos-mesh-chaos-mesh-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chaos-mesh/chaos-mesh](https://github.com/chaos-mesh/chaos-mesh))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T11:39:49.186Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chaos-mesh/chaos-mesh`
- **Description**: A Chaos Engineering Platform for Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 7999 stars

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
- **Issue #5272** (2026-11-26): **fix(dashboard): retry pause and resume on write conflicts**
  *Symptoms*: ## What problem does this PR solve?  Dashboard pause and resume requests can return HTTP 500 when a controller updates the same Kubernetes object between the read and the patch. This caused the Dashboard permission test to fail in the [Integration Test workflow](https://github.com/chaos-mesh/chaos-mesh/actions/runs/45630318658/job/139261496238#step:10:3835).  ## What's changed and how does it work?  Retry conflicting annotation patches for experiments and schedules. Each attempt reads the current object, verifies its UID, and patches against its resource version.  Dashboard API tests pass for pause and resume after a concurrent update. They also verify that a request for the old UID leaves a same-named replacement untouched.  ## Related changes  - [ ] This change also requires further updates to the [website](https://github.com/chaos-mesh/website) (e.g. docs) - [ ] This change also requires further updates to the `UI interface`  ## Cherry-pick to release branches (optional)  - [ ] release-2.8 - [ ] release-2.7  ## Checklist  ### CHANGELOG  - [x] I have updated the `CHANGELOG.md` - [ ] I have labeled this PR with "no-need-update-changelog"  ### Tests  - [x] Unit test - [ ] E2E test - [ ] Manual test  ### Side effects  - [ ] **Breaking backward compatibility**  ## DCO  Commits are signed off for DCO. 

- **Issue #5268** (2026-11-26): **feat(api): validate JVM, stress and physical machine chaos rules in the CRD schema**
  *Symptoms*: ## What problem does this PR solve?  Part of #5220. This is the second of the two PRs we talked about on the issue, covering JVMChaos, StressChaos, KernelChaos, TimeChaos and PhysicalMachineChaos.  It's stacked on #5267 to avoid conflicts in the generated CRDs, the test file and the CHANGELOG, so only the last commit is new here until that one merges. I'll rebase once it does.  ## What's changed and how does it work?  I put CEL rules on the spec types for the checks that are easy to write and verify: the JVMChaos per-action fields (stress CPU count or memory type, class, method, exception, return value, latency, rule data, and the MySQL connector version and fault), the StressChaos "missing stressors" checks, and the PhysicalMachineChaos stress-cpu, stress-mem, disk payload, disk-fill, process and user_defined required fields. Each PhysicalMachineChaos rule only fires for its own action, like the webhook does, and all messages match the Go ones. The rules show up in the Schedule, Workflow and WorkflowNode CRDs too.  KernelChaos and TimeChaos don't get anything, since their webhook checks are only duration and time offset parsing plus selectors. For PhysicalMachineChaos I tried the "configuration corresponding to action is required" check as one rule over all 43 actions, but it went over the CEL cost budget once nested in Workflow templates, so it stays in Go. Same for the size, percent, correlation and DNS checks that need parsing or dynamic messages. I also left the network,

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

### Incident Patch 1: `26da5ae0` (2026-11-25)
**Commit Message**: fix(selector): return cloud target encoding errors (#4964)

* fix(api): handle json.Marshal error in AWSSelector, GCPSelector, AzureSelector Id()

The Id() methods in AWSSelector, GCPSelector, and AzureSelector were
silently discarding the error from json.Marshal using the blank
identifier (_). This meant that if marshaling ever failed, the method
would return an empty string with no indication of why, making it
impossible to diagnose selector identity issues.

Since these selectors contain only basic Go types that json.Marshal
cannot fail on, the error is truly impossible in practice. Replace the
silent discard with an explicit panic so that any future change that
introduces an unmarshalable field is caught immediately rather than
silently producing an empty string.

Signed-off-by: Pankaj231123 <[REDACTED_EMAIL]>

* fix(selector): return cloud target encoding errors

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

* docs(changelog): note cloud selector ID handling

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

---------

Signed-off-by: Pankaj231123 <[REDACTED_EMAIL]>
Signed-off-by: Yue Yang <[REDACTED_EMAIL]>
Co-authored-by: Yue Yang <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -79,6 +79,7 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 
 ### Fixed
 
+- Report target ID encoding errors before creating records for AWSChaos, AzureChaos, and GCPChaos. Go callers that used `Id()` on a cloud selector now call it on the target returned by `Select()`. [#4964](https://github.com/chaos-mesh/chaos-mesh/pull/4964)
 - Return an error when the Helm chart repository responds with a non-success HTTP status. [#5256](https://github.com/chaos-mesh/chaos-mesh/pull/5256)
 - Set the Pod owner reference on newly created PodIOChaos resources even when the Kubernetes client omits Pod type metadata. [#5256](https://github.com/chaos-mesh/chaos-mesh/pull/5256)
 - Return a validation error when a Workflow chaos template omits its experiment specification. [#5256](https://github.com/chaos-mesh/chaos-mesh/pull/5256)
```

**File**: `api/v1alpha1/awschaos_types.go` (modified, +1/-13)
```diff
@@ -15,11 +15,7 @@
 
 package v1alpha1
 
-import (
-	"encoding/json"
-
-	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
-)
+import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 
 // +kubebuilder:object:root=true
 // +kubebuilder:printcolumn:name="action",type=string,JSONPath=`.spec.action`
@@ -115,11 +111,3 @@ func (obj *AWSChaos) GetSelectorSpecs() map[string]any {
 		".": &obj.Spec.AWSSelector,
 	}
 }
-
-func (selector *AWSSelector) Id() string {
-	// TODO: handle the error here
-	// or ignore it is enough ?
-	json, _ := json.Marshal(selector)
-
-	return string(json)
-}
```

**File**: `api/v1alpha1/azurechaos_types.go` (modified, +1/-13)
```diff
@@ -15,11 +15,7 @@
 
 package v1alpha1
 
-import (
-	"encoding/json"
-
-	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
-)
+import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 
 // +kubebuilder:object:root=true
 // +kubebuilder:printcolumn:name="action",type=string,JSONPath=`.spec.action`
@@ -108,11 +104,3 @@ func (obj *AzureChaos) GetSelectorSpecs() map[string]any {
 		".": &obj.Spec.AzureSelector,
 	}
 }
-
-func (selector *AzureSelector) Id() string {
-	// TODO: handle the error here
-	// or ignore it is enough ?
-	json, _ := json.Marshal(selector)
-
-	return string(json)
-}
```

**File**: `api/v1alpha1/gcpchaos_types.go` (modified, +1/-13)
```diff
@@ -15,11 +15,7 @@
 
 package v1alpha1
 
-import (
-	"encoding/json"
-
-	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
-)
+import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 
 // +kubebuilder:object:root=true
 // +kubebuilder:printcolumn:name="action",type=string,JSONPath=`.spec.action`
@@ -100,14 +96,6 @@ func (obj *GCPChaos) GetSelectorSpecs() map[string]any {
 	}
 }
 
-func (selector *GCPSelector) Id() string {
-	// TODO: handle the error here
-	// or ignore it is enough ?
-	json, _ := json.Marshal(selector)
-
-	return string(json)
-}
-
 // GCPChaosStatus represents the status of a GCPChaos
 type GCPChaosStatus struct {
 	ChaosStatus `json:",inline"`
```

**File**: `pkg/selector/aws/selector.go` (modified, +3/-2)
```diff
@@ -20,12 +20,13 @@ import (
 	"context"
 
 	"github.com/chaos-mesh/chaos-mesh/api/v1alpha1"
+	"github.com/chaos-mesh/chaos-mesh/pkg/selector/internal/cloud"
 )
 
 type SelectImpl struct{}
 
-func (impl *SelectImpl) Select(_ context.Context, awsSelector *v1alpha1.AWSSelector) ([]*v1alpha1.AWSSelector, error) {
-	return []*v1alpha1.AWSSelector{awsSelector}, nil
+func (impl *SelectImpl) Select(_ context.Context, awsSelector *v1alpha1.AWSSelector) ([]cloud.Target, error) {
+	return cloud.Select(awsSelector)
 }
 
 func New() *SelectImpl {
```

**File**: `pkg/selector/azure/selector.go` (modified, +3/-2)
```diff
@@ -20,12 +20,13 @@ import (
 	"context"
 
 	"github.com/chaos-mesh/chaos-mesh/api/v1alpha1"
+	"github.com/chaos-mesh/chaos-mesh/pkg/selector/internal/cloud"
 )
 
 type SelectImpl struct{}
 
-func (impl *SelectImpl) Select(_ context.Context, azureSelector *v1alpha1.AzureSelector) ([]*v1alpha1.AzureSelector, error) {
-	return []*v1alpha1.AzureSelector{azureSelector}, nil
+func (impl *SelectImpl) Select(_ context.Context, azureSelector *v1alpha1.AzureSelector) ([]cloud.Target, error) {
+	return cloud.Select(azureSelector)
 }
 
 func New() *SelectImpl {
```

**File**: `pkg/selector/gcp/selector.go` (modified, +3/-2)
```diff
@@ -20,12 +20,13 @@ import (
 	"context"
 
 	"github.com/chaos-mesh/chaos-mesh/api/v1alpha1"
+	"github.com/chaos-mesh/chaos-mesh/pkg/selector/internal/cloud"
 )
 
 type SelectImpl struct{}
 
-func (impl *SelectImpl) Select(_ context.Context, gcpSelector *v1alpha1.GCPSelector) ([]*v1alpha1.GCPSelector, error) {
-	return []*v1alpha1.GCPSelector{gcpSelector}, nil
+func (impl *SelectImpl) Select(_ context.Context, gcpSelector *v1alpha1.GCPSelector) ([]cloud.Target, error) {
+	return cloud.Select(gcpSelector)
 }
 
 func New() *SelectImpl {
```

**File**: `pkg/selector/internal/cloud/selector.go` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
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
+// Package cloud encodes cloud selectors as target IDs for experiment records.
+package cloud
+
+import (
+	"encoding/json"
+	"fmt"
+)
+
+type Target string
+
+//revive:disable-next-line:var-naming Preserve the selector.Target identity contract.
+func (t Target) Id() string {
+	return string(t)
+}
+
+func Select(spec any) ([]Target, error) {
+	id, err := json.Marshal(spec)
+	if err != nil {
+		return nil, fmt.Errorf("encode cloud selector %T: %w", spec, err)
+	}
+	return []Target{Target(id)}, nil
+}
```

---

### Incident Patch 2: `d9c12d3e` (2026-11-26)
**Commit Message**: fix(dashboard): retry pause and resume on write conflicts (#5272)

* test(dashboard): reproduce pause and start write conflicts

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

* fix(dashboard): retry pause and resume on write conflicts

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

* docs(changelog): link the Dashboard conflict fix

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

---------

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -79,6 +79,7 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 
 ### Fixed
 
+- Fix intermittent Dashboard errors when pausing or resuming experiments and schedules during concurrent Kubernetes updates. [#5272](https://github.com/chaos-mesh/chaos-mesh/pull/5272)
 - Report target ID encoding errors before creating records for AWSChaos, AzureChaos, and GCPChaos. Go callers that used `Id()` on a cloud selector now call it on the target returned by `Select()`. [#4964](https://github.com/chaos-mesh/chaos-mesh/pull/4964)
 - Return an error when the Helm chart repository responds with a non-success HTTP status. [#5256](https://github.com/chaos-mesh/chaos-mesh/pull/5256)
 - Set the Pod owner reference on newly created PodIOChaos resources even when the Kubernetes client omits Pod type metadata. [#5256](https://github.com/chaos-mesh/chaos-mesh/pull/5256)
```

**File**: `pkg/dashboard/apiserver/experiment/experiment.go` (modified, +14/-12)
```diff
@@ -531,19 +531,21 @@ func (s *Service) start(c *gin.Context) {
 }
 
 func patchExperiment(ctx context.Context, kubeCli client.Client, record *core.Experiment, annotations map[string]string) error {
-	chaos, err := getChaosForExperiment(ctx, kubeCli, record)
-	if err != nil {
-		return err
-	}
+	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
+		chaos, err := getChaosForExperiment(ctx, kubeCli, record)
+		if err != nil {
+			return err
+		}
 
-	before := chaos.DeepCopyObject().(client.Object)
-	currentAnnotations := chaos.GetAnnotations()
-	if currentAnnotations == nil {
-		currentAnnotations = make(map[string]string, len(annotations))
-	}
-	maps.Copy(currentAnnotations, annotations)
-	chaos.SetAnnotations(currentAnnotations)
-	return kubeCli.Patch(ctx, chaos, client.MergeFromWithOptions(before, client.MergeFromWithOptimisticLock{}))
+		before := chaos.DeepCopyObject().(client.Object)
+		currentAnnotations := chaos.GetAnnotations()
+		if currentAnnotations == nil {
+			currentAnnotations = make(map[string]string, len(annotations))
+		}
+		maps.Copy(currentAnnotations, annotations)
+		chaos.SetAnnotations(currentAnnotations)
+		return kubeCli.Patch(ctx, chaos, client.MergeFromWithOptions(before, client.MergeFromWithOptimisticLock{}))
+	})
 }
 
 // @Summary Get the status of all experiments.
```

**File**: `pkg/dashboard/apiserver/resource_identity_test.go` (modified, +41/-1)
```diff
@@ -78,11 +78,13 @@ func TestUIDScopedWritesRejectReplacementAfterLookup(t *testing.T) {
 				key := client.ObjectKeyFromObject(original)
 				path := "/" + resource.endpoint + "/uid"
 				body := ""
+				expectedStatus := http.StatusInternalServerError
 				if method == http.MethodPut {
 					if resource.endpoint == "workflows" {
 						body = strings.Replace(resource.body, `"entry":"wait"`, `"entry":"other"`, 1)
 					} else {
 						path = "/" + resource.endpoint + "/pause/uid"
+						expectedStatus = http.StatusNotFound
 					}
 				}
 
@@ -119,7 +121,7 @@ func TestUIDScopedWritesRejectReplacementAfterLookup(t *testing.T) {
 					},
 				}, nil)
 
-				apiRequest(t, router, method, path, body, http.StatusInternalServerError)
+				apiRequest(t, router, method, path, body, expectedStatus)
 				require.NotNil(t, replacement, "request must reach the Kubernetes mutation")
 				actual := replacement.DeepCopyObject().(client.Object)
 				require.NoError(t, kube.Get(t.Context(), key, actual))
@@ -129,6 +131,44 @@ func TestUIDScopedWritesRejectReplacementAfterLookup(t *testing.T) {
 	}
 }
 
+func TestPauseAndStartWithConcurrentUpdate(t *testing.T) {
+	for _, resource := range apiResources()[:2] {
+		for _, action := range []struct{ name, before, after string }{
+			{"pause", "false", "true"},
+			{"start", "true", "false"},
+		} {
+			t.Run(resource.endpoint+"/"+action.name, func(t *testing.T) {
+				original := resource.object.DeepCopyObject().(client.Object)
+				require.NoError(t, json.Unmarshal([]byte(resource.body), original))
+				original.GetAnnotations()[v1alpha1.PauseAnnotationKey] = action.before
+				key := client.ObjectKeyFromObject(original)
+
+				firstPatch := true
+				router, kube := apiRouter(t, []client.Object{original}, interceptor.Funcs{
+					Patch: func(ctx context.Context, kube client.WithWatch, obj client.Object, patch client.Patch, opts ...client.PatchOption) error {
+						if firstPatch {
+							firstPatch = false
+							current := original.DeepCopyObject().(client.Object)
+							require.NoError(t, kube.Get(ctx, key, current))
+							current.GetAnnotations()["parallel"] = "preserved"
+							require.NoError(t, kube.Update(ctx, current))
+						}
+						return kube.Patch(ctx, obj, patch, opts...)
+					},
+				}, nil)
+
+				apiRequest(t, router, http.MethodPut, "/"+resource.endpoint+"/"+action.name+"/uid", "", http.StatusOK)
+				require.NoError(t, kube.Get(t.Context(), key, original))
+				require.Equal(t, map[string]string{
+					"keep":                      "value",
+					"parallel":                  "preserved",
+					v1alpha1.PauseAnnotationKey: action.after,
+				}, original.GetAnnotations())
+			})
+		}
+	}
+}
+
 func TestForceDeleteExperimentRetriesOnlyAgainstOriginalUID(t *testing.T) {
 	for _, mode := range []string{"concurrent update", "replacement"} {
 		t.Run(mode, func(t *testing.T) {
```

**File**: `pkg/dashboard/apiserver/schedule/schedule.go` (modified, +15/-12)
```diff
@@ -31,6 +31,7 @@ import (
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/runtime"
 	"k8s.io/apimachinery/pkg/types"
+	"k8s.io/client-go/util/retry"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	"sigs.k8s.io/controller-runtime/pkg/client/apiutil"
 
@@ -490,16 +491,18 @@ func (s *Service) startSchedule(c *gin.Context) {
 }
 
 func patchSchedule(ctx context.Context, kubeCli client.Client, record *core.Schedule, annotations map[string]string) error {
-	sch, err := getSchedule(ctx, kubeCli, record)
-	if err != nil {
-		return err
-	}
-	before := sch.DeepCopy()
-	currentAnnotations := sch.GetAnnotations()
-	if currentAnnotations == nil {
-		currentAnnotations = make(map[string]string, len(annotations))
-	}
-	maps.Copy(currentAnnotations, annotations)
-	sch.SetAnnotations(currentAnnotations)
-	return kubeCli.Patch(ctx, sch, client.MergeFromWithOptions(before, client.MergeFromWithOptimisticLock{}))
+	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
+		sch, err := getSchedule(ctx, kubeCli, record)
+		if err != nil {
+			return err
+		}
+		before := sch.DeepCopy()
+		currentAnnotations := sch.GetAnnotations()
+		if currentAnnotations == nil {
+			currentAnnotations = make(map[string]string, len(annotations))
+		}
+		maps.Copy(currentAnnotations, annotations)
+		sch.SetAnnotations(currentAnnotations)
+		return kubeCli.Patch(ctx, sch, client.MergeFromWithOptions(before, client.MergeFromWithOptimisticLock{}))
+	})
 }
```

#### Recent Merged Pull Requests:
- **PR #5272** (2026-11-26): fix(dashboard): retry pause and resume on write conflicts (@g1eny0ung)
- **PR #5268** (2026-11-26): feat(api): validate JVM, stress and physical machine chaos rules in the CRD schema (@cvas22)
- **PR #5267** (2026-11-25): feat(api): validate NetworkChaos, cloud, IO, HTTP and DNS chaos rules in the CRD schema (@cvas22)
- **PR #5266** (closed): docs(changelog): consolidate daemon and dashboard fixes (@g1eny0ung)
- **PR #5264** (2026-11-22): fix(dashboard): protect resource identity and Helm lifecycle (@g1eny0ung)
- **PR #5263** (2026-11-22): fix(daemon): harden fault application and recovery (@g1eny0ung)

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

## X. selector): return cloud target encoding errors

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chaos-mesh/chaos-mesh. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `26da5ae0`: selector): return cloud target encoding errors. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
- Report target ID encoding errors before creating records for AWSChaos, AzureChaos, and GCPChaos. Go callers that used `Id()` on a cloud selector now call it on the target returned by `Select()`. [#4964](https://github.com/chaos-mesh/chaos-mesh/pull/4964)
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `26da5ae0` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.

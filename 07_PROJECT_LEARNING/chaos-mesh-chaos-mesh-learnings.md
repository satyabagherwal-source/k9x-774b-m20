# Forensic Learning Record (Deep Inspection): chaos-mesh/chaos-mesh

> **Canonical Artifact**: `07_PROJECT_LEARNING/chaos-mesh-chaos-mesh-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chaos-mesh/chaos-mesh](https://github.com/chaos-mesh/chaos-mesh))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:01:12.846Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chaos-mesh/chaos-mesh`
- **Description**: A Chaos Engineering Platform for Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 7929 stars

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

type fieldCallback func(path *field.Path, obj interface{}, field *reflect.StructField) bool

type FieldWalker struct {
	obj      interface{}
	callback fieldCallback
}

func NewFieldWalker(obj interface{}, callback fieldCallback) *FieldWalker {
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
			if val.Kind() != reflect.Ptr {
				// If it's not a pointer or a slice, then we need to
				// take the address of it, to be able to modify it.
				val = val.Addr()
			}
			if !w.callback(node.Path, val.Interface(), node.Field) {
				continue
			}
		}

		if node.Val.Kind() == reflect.Ptr && node.Val.IsZero() {
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
	Default(root interface{}, field *reflect.StructField)
}

// Default would walk through all the fields of target struct recursively, and set the default value which declared with struct tag "default".
//
// Parameter obj should be a pointer to a data struct.
//
// Default should return an empty field.ErrorList.
func Default(obj interface{}) field.ErrorList {
	// TODO: how to resolve invalid input, for example: obj is a pointer to pointer
	errorList := field.ErrorList{}

	root := obj
	walker := NewFieldWalker(obj, func(path *field.Path, obj interface{}, field *reflect.StructField) bool {
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

func getDefaulter(obj interface{}, webhook string, nilable bool) Defaulter {
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
	Validate(root interface{}, path *field.Path) field.ErrorList
}

// Validate would walk through all the fields of target struct recursively, and validate the value with validator declared with struct tag "webhook".
//
// Parameter obj should be a pointer to a data struct.
//
// Validate should return an empty field.ErrorList if all the fields are valid, or return each field.Error for every invalid values.
func Validate(obj interface{}) field.ErrorList {
	// TODO: how to resolve invalid input, for example: obj is a pointer to pointer
	errorList := field.ErrorList{}

	root := obj
	walker := NewFieldWalker(obj, func(path *field.Path, obj interface{}, field *reflect.StructField) bool {
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

func getValidator(obj interface{}, webhook string, nilable bool) FieldValidator {
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

package genericwebhook

import "reflect"

var webhooks map[string]reflect.Type = make(map[string]reflect.Type)

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

func (in *EbsVolume) Validate(root interface{}, path *field.Path) field.ErrorList {
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

func (in *AWSDeviceName) Validate(root interface{}, path *field.Path) field.ErrorList {
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
func (in *AWSChaosAction) Validate(root interface{}, path *field.Path) field.ErrorList {
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
	genericwebhook.Register("EbsVolume", reflect.PtrTo(reflect.TypeOf(EbsVolume(""))))
	genericwebhook.Register("AWSDeviceName", reflect.PtrTo(reflect.TypeOf(AWSDeviceName(""))))
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

func (in *DiskName) Validate(root interface{}, path *field.Path) field.ErrorList {
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

func (in *LUN) Validate(root interface{}, path *field.Path) field.ErrorList {
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
func (in *AzureChaosAction) Validate(root interface{}, path *field.Path) field.ErrorList {
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
	genericwebhook.Register("DiskName", reflect.PtrTo(reflect.TypeOf(DiskName(""))))
	genericwebhook.Register("LUN", reflect.PtrTo(reflect.TypeOf(LUN(0))))
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

func (in *BlockChaosSpec) Validate(root interface{}, path *field.Path) field.ErrorList {
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

// +kubebuilder:object:generate=false
type ContainsDuration interface {
	GetDuration() (*time.Duration, error)
}

type Duration string

func (d *Duration) Validate(root interface{}, path *field.Path) field.ErrorList {
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

func (d *Duration) Default(root interface{}, field *reflect.StructField) {
	if d == nil {
		return
	}

	// d cannot be nil
	if len(*d) == 0 && field != nil {
		*d = Duration(field.Tag.Get("default"))
	}
}

func (p *PodSelector) Validate(root interface{}, path *field.Path) field.ErrorList {
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

func (p *PodSelector) Default(root interface{}, field *reflect.StructField) {
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

func (p *Percent) Validate(root interface{}, path *field.Path) field.ErrorList {
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

func (f *FloatStr) Validate(root interface{}, path *field.Path) field.ErrorList {
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

func (f *FloatStr) Default(root interface{}, field *reflect.StructField) {
	// f cannot be nil
	if len(*f) == 0 && field != nil {
		*f = FloatStr(field.Tag.Get("default"))
	}
}

func init() {
	genericwebhook.Register("Duration", reflect.PtrTo(reflect.TypeOf(Duration(""))))
	genericwebhook.Register("Percent", reflect.PtrTo(reflect.TypeOf(Percent(0))))
	genericwebhook.Register("FloatStr", reflect.PtrTo(reflect.TypeOf(FloatStr(""))))
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

// validateDeviceName validates the gcp chaos actions
func (in GCPChaosAction) Validate(root interface{}, path *field.Path) field.ErrorList {
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

// validateDeviceName validates the DeviceName
func (in *GCPDeviceNames) Validate(root interface{}, path *field.Path) field.ErrorList {
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
	genericwebhook.Register("GCPDeviceNames", reflect.PtrTo(reflect.TypeOf(GCPDeviceNames{})))
}

```

### Core Architecture Module: `api/v1alpha1/httpchaos_webhook.go`
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
	"net/http"
	"reflect"
	"time"

	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/chaos-mesh/chaos-mesh/api/genericwebhook"
)

type Delay string

func (in *Delay) Validate(root interface{}, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}
	if in != nil {
		_, err := time.ParseDuration(string(*in))
		if err != nil {
			allErrs = append(allErrs, field.Invalid(path, in, fmt.Sprintf("invalid duration %s", *in)))
		}
	}
	return allErrs
}

type Port int32

func (in *Port) Validate(root interface{}, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}
	// in cannot be zero or negative
	if *in <= 0 {
		allErrs = append(allErrs, field.Invalid(path, in, fmt.Sprintf("port %d is not supported", *in)))
	}
	return allErrs
}

type HTTPMethod string

func (in *HTTPMethod) Validate(root interface{}, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}
	if in != nil && root.(*HTTPChaos).Spec.Target == PodHttpRequest {
		switch *in {
		case http.MethodGet:
		case http.MethodPost:
		case http.MethodPut:
		case http.MethodDelete:
		case http.MethodPatch:
		case http.MethodHead:
		case http.MethodOptions:
		case http.MethodTrace:
		case http.MethodConnect:
		default:
			allErrs = append(allErrs, field.Invalid(path, in, fmt.Sprintf("method %s is not supported", *in)))
		}
	}
	return allErrs
}

func (in *PodHttpChaosTarget) Validate(root interface{}, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}
	switch *in {
	case PodHttpRequest:
	case PodHttpResponse:
	default:
		allErrs = append(allErrs, field.Invalid(path, in, fmt.Sprintf("target %s is not supported", *in)))
	}
	return allErrs
}

func init() {
	genericwebhook.Register("Delay", reflect.PtrTo(reflect.TypeOf(Delay(""))))
	genericwebhook.Register("Port", reflect.PtrTo(reflect.TypeOf(Port(0))))
	genericwebhook.Register("HTTPMethod", reflect.PtrTo(reflect.TypeOf(HTTPMethod(""))))
	genericwebhook.Register("PodHttpChaosTarget", reflect.PtrTo(reflect.TypeOf(PodHttpChaosTarget(""))))
}

```

### Core Architecture Module: `api/v1alpha1/iochaos_webhook.go`
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

	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/chaos-mesh/chaos-mesh/api/genericwebhook"
)

type IOErrno uint32

func (in *IOErrno) Validate(root interface{}, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}
	obj := root.(*IOChaos)
	if obj.Spec.Action == IoFaults {
		// in cannot be nil
		if *in == 0 {
			allErrs = append(allErrs, field.Invalid(path, in,
				fmt.Sprintf("action %s: errno 0 is not supported", obj.Spec.Action)))
		}
	}
	return allErrs
}

func init() {
	genericwebhook.Register("IOErrno", reflect.PtrTo(reflect.TypeOf(IOErrno(0))))
}

```

### Core Architecture Module: `api/v1alpha1/jvmchaos_webhook.go`
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
	"time"

	"k8s.io/apimachinery/pkg/util/validation/field"
)

const DefaultJVMAgentPort int32 = 9277

func (in *JVMChaosSpec) Default(root interface{}, field *reflect.StructField) {
	if in == nil {
		return
	}

	if len(in.Name) == 0 {
		in.Name = fmt.Sprintf("%s-%s-%s-%d", in.Class, in.Method, in.Action, time.Now().Unix())
	}

	if in.Port == 0 {
		in.Port = DefaultJVMAgentPort
	}
}

func (in *JVMChaosSpec) Validate(root interface{}, path *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}

	switch in.Action {
	case JVMStressAction:
		if in.CPUCount == 0 && len(in.MemoryType) == 0 {
			allErrs = append(allErrs, field.Invalid(path, in, "must set one of cpu-count and mem-type when action is 'stress'"))
		}

		if in.CPUCount > 0 && len(in.MemoryType) > 0 {
			allErrs = append(allErrs, field.Invalid(path, in, "inject stress on both CPU and memory is not support now"))
		}

		if len(in.MemoryType) != 0 {
			if in.MemoryType != "stack" && in.MemoryType != "heap" {
				allErrs = append(allErrs, field.Invalid(path, in, "value should be 'stack' or 'heap'"))
			}
		}
	case JVMGCAction:
		// do nothing
	case JVMExceptionAction, JVMReturnAction, JVMLatencyAction:
		if len(in.Class) == 0 {
			allErrs = append(allErrs, field.Invalid(path, in, "class not provided"))
		}

		if len(in.Method) == 0 {
			allErrs = append(allErrs, field.Invalid(path, in, "method not provided"))
		}
		if in.Action == JVMExceptionAction && len(in.ThrowException) == 0 {
			allErrs = append(allErrs, field.Invalid(path, in, "exception not provided"))
		} else if in.Action == JVMReturnAction && len(in.ReturnValue) == 0 {
			allErrs = append(allErrs, field.Invalid(path, in, "value not provided"))
		} else if in.Action == JVMLatencyAction && in.LatencyDuration == 0 {
			allErrs = append(allErrs, field.Invalid(path, in, "latency not provided"))
		}

	case JVMRuleDataAction:
		if len(in.RuleData) == 0 {
			allErrs = append(allErrs, field.Invalid(path, in, "rule data not provide"))
		}
	case JVMMySQLAction:
		if len(in.MySQLConnectorVersion) == 0 {
			allErrs = append(allErrs, field.Invalid(path, in, "MySQL connector version not provided"))
		} else if in.MySQLConnectorVersion != "5" && in.MySQLConnectorVersion != "8" {
			allErrs = append(allErrs, field.Invalid(path, in, "MySQL connector version only support 5.X.X(set to 5) and 8.X.X(set to 8)"))
		}
		if len(in.ThrowException) == 0 && in.LatencyDuration == 0 {
			allErrs = append(allErrs, field.Invalid(path, in, "must set one of exception or latency"))
		}
	case "":
		allErrs = append(allErrs, field.Invalid(path, in, "action not provided"))
	default:
		allErrs = append(allErrs, field.Invalid(path, in, fmt.Sprintf("action %s not supported, action can be 'latency', 'exception', 'return', 'stress', 'gc' or 'ruleData'", in.Action)))
	}

	return allErrs
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5098** (2026-09-29): **fix(jvmchaos): Java25 compatibility. Upgrade byteman-helper to v4.0.27-12**
  *Symptoms*: > [!IMPORTANT] > Thank you for contributing to Chaos Mesh! Please fill out the template below to help us review your PR. > > If you are new to Chaos Mesh, please read the [contributing guide](https://github.com/chaos-mesh/chaos-mesh/blob/master/CONTRIBUTING.md) first. > > Please follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) when writing the PR title and commit messages.  ## What problem does this PR solve?  > [!TIP] > Please replace this with a brief description of the problem this PR solves. > You can also close #issue_number if this PR solves the issue.  ## What's changed and how does it work?  > [!TIP] > Please replace this with a brief description of the changes and how it works. > You can also refer to a proposal or design doc if it exists.  ## Related changes  - [ ] This change also requires further updates to the [website](https://github.com/chaos-mesh/website) (e.g. docs) - [ ] This change also requires further updates to the `UI interface`  ## Cherry-pick to release branches (optional)  > This PR should be cherry-picked to the following release branches:  - [x] release-2.8 - [ ] release-2.7  ## Checklist  ### CHANGELOG  > Must include at least one of them.  - [x] I have updated the `CHANGELOG.md` - [ ] I have labeled this PR with "no-need-update-changelog"  ### Tests  > Must include at least one of them.  - [x] Unit test - [x] E2E test - [ ] Manual test  ### Side effects  - [ ] **Breaki

- **Issue #5097** (2026-10-02): **CSOAI — Chaos Mesh AI governance K8s**
  *Symptoms*: Withdrawn. No action is requested from this project.

- **Issue #5096** (2026-09-29): **fix(selector): require containerNames when the target pod has several containers**
  *Symptoms*: ## What problem does this PR solve?  Fixes #3676.  When `containerNames` is not set, the container selector silently picks the first container of the pod (`pkg/selector/container/selector.go`). On a pod with several containers that is an arbitrary choice, and it is almost never the one the user means. In the issue the pod is `[consul, java-app]`, so JVMChaos attached byteman to `consul` and the experiment failed with `java.io.IOException: No such process`, with nothing in the error to say the wrong container had been picked.  ## What's changed and how does it work?  If `containerNames` is empty and the selected pod has more than one container, the selector now returns an error naming the pod and the container count, instead of guessing. Pods with a single container keep the existing implicit default, so the common case is unchanged.  I kept the check in the shared container selector rather than in JVMChaos, because that is where the choice is made and every container-scoped chaos type has the same ambiguity. `NetworkChaos` and `PodChaos` pod-kill and pod-failure use `PodSelector` and are not affected. There is a precedent for requiring the field: the PodChaos webhook rejects `container-kill` without `containerNames`.  Added `pkg/selector/container/selector_test.go` covering a two-container pod (`consul`, `java-app`): selecting by `containerNames` returns the named container, a single-container pod still resolves without `containerNames`, and a multi-container pod without `con
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-14T09:30:59.935823Z">2026-09-14T09:30:59.935823Z</relative-time> | `0890dae` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>
  > Still happy to regenerate the UI schema in this PR if that's wanted; otherwise I'll leave it out and it can follow separately.
  > Hi @Yash121l Thanks for your contribution.   The current behavior like injecting chaso experiments into first container if there is no `containerNames` specified is good to us.  So I am going to close this PR. Please let us know if I missed anything. Thank you  Also refs: https://github.com/chaos-mesh/chaos-mesh/issues/3676#issuecomment-5881754926

- **Issue #5092** (2026-09-29): **fix(networkchaos): preserve overlapping selector roles**
  *Symptoms*: ## What problem does this PR solve?  A bidirectional NetworkChaos experiment can lose one requested direction when a pod matches both selectors. For example, source pods `{A, O}` and target pods `{O, B}` produce two records for `O`. Each record clears and rebuilds the same experiment's per-pod rules, so the second record removes the first role's filter. All records can then report `Injected` while either `O -> A` or `O -> B` has no requested delay.  Related: #3493 reports problems with overlapping source and target selectors.  ## What's changed and how does it work?  For `direction: both`, either record for an overlapping pod rebuilds both roles in one transaction before committing its generation. Keep the existing source/target IP-set names, filters, interface selection, and experiment ownership. Retries reproduce the same complete configuration, and recovery continues to clear both roles using the existing experiment owner.  Regression tests cover both processing orders, matching and differing interface settings, non-overlapping `to`/`from`/`both` experiments, repeated application, acknowledgement, and recovery while another experiment remains on the pod.  Resolve the destination Pod IP before starting the timed network integration test. Keep the five-second duration, ten packets, and requirement for three to six packets with at least 10ms latency, while moving hostname resolution out of the measurement window.  This change is independent of the namespace identity fix in #5
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/pull/5092?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh) Report :x: Patch coverage is `67.64706%` with `11 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 21.03%. Comparing base ([`536c193`](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/commit/536c193f8796ca52e6bd4dbb41b5493d858f30b5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh)) to head ([`9ab53e3`](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/commit/9ab53e36b499465b5eb47e3cbb3cf2283408c4d7?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh)).  | [Files with missing lines](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/pull/5092?dropdown=coverage&src=pr&el=tree&utm_medium=refer
  > Hi @bvolpato , thanks for your contribution!  I noticed you're highly active rencently. For now chaos mesh maintainers may have only limited bandwidth on reviewing them. 🙏  Does this sounds a problem? We're open to chat!
  > We're avaiable in CNCF slack channel #project-chaos-mesh, and DM is also welcome.

- **Issue #5091** (2026-09-29): **fix(httpchaos): retry missing TLS Secret data**
  *Symptoms*: ## What problem does this PR solve?  If a TLS Secret exists but lacks the configured certificate, private-key, or CA entry, PodHTTPChaos calls `errors.Wrapf` with a nil error and then panics on `err.Error()`. Its deferred status update still records the generation with an empty failure message. The parent can consequently report `Injected` without any `ApplyHttpChaos` call, and later child reconciliation skips that generation.  ## What's changed and how does it work?  Create a non-nil error for each missing entry and preserve it in `FailedMessage`. Request a rate-limited retry, following the controller's existing error convention, because Secret updates are not watched. The parent stays pending with an error until a subsequent attempt actually succeeds.  Regression tests cover missing certificate, private key, and optional CA data; repeated failed reconciliation; zero injection RPCs during failure; repairing only the Secret; the resulting TLS payload and parent `Injected` transition; and successful reconciliation idempotence.  Related: #4994 fixes Secret lookup and read errors. This PR covers the separate missing-data branches and can be applied independently.  ## Validation and reproduction  The regression test fails on the base commit with a nil-pointer panic in all three cases, and passes with this change. It uses fake Kubernetes and daemon clients.  ```sh go run github.com/pingcap/failpoint/failpoint-ctl enable ./pkg/mock trap 'go run github.com/pingcap/failpoint/failpoin
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/pull/5091?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 21.06%. Comparing base ([`536c193`](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/commit/536c193f8796ca52e6bd4dbb41b5493d858f30b5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh)) to head ([`ba4af8e`](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/commit/ba4af8efba226ea24e2f4906dcd8ab625bbb1438?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##           master    #5091      +/-   #
  > The integration failure here matches #5090: PhysicalMachineChaos admission rejects the webhook certificate just after the OIDC test upgrades the chart. It fails before physical-machine injection, outside the HTTPChaos code changed here.  The Go verification, build, and test jobs passed on both architectures. Could a maintainer rerun the [failed integration job](https://github.com/chaos-mesh/chaos-mesh/actions/runs/33798974196/job/100793434730)? The personal fork account cannot rerun this workflow. Thanks. 
  > Hi @bvolpato, thanks a lot for the time and effort you put into this PR!  We reached out in #5092 about review bandwidth and ways to coordinate (CNCF Slack `#project-chaos-mesh`), but haven't heard back for several weeks. Since this is one of a batch of related PRs (#5085 to #5092) that we can't move forward without the author's involvement, we're closing it for now to keep the queue manageable.  This is not a rejection of the change itself. If you'd like to continue, feel free to reopen this PR (or open a new one rebased on the latest `master`) and ping us here or on Slack. We're happy to pick it up again. 🙏

- **Issue #5090** (2026-09-29): **fix(networkchaos): isolate generated rule names**
  *Symptoms*: ## What problem does this PR solve?  NetworkChaos resources with the same name in different Kubernetes namespaces can generate identical IP-set and iptables-chain names when they select the same workload pod. PodNetworkChaos tracks ownership by namespace/name, but the daemon receives colliding names, allowing one experiment to overwrite another experiment's destination sets or partition rules.  ## What's changed and how does it work?  Generate kernel rule names from the full namespace/name identity and IP-set role. Use the available name budget for the hash so long role suffixes do not weaken collision resistance. Preserve the existing 27-character limits, the daemon's temporary IP-set suffix space, and INPUT/OUTPUT chain prefixes.  Names follow namespace/name ownership, matching RawRuleSource and existing recovery transactions. Persisted PodNetworkChaos names are forwarded unchanged; this does not migrate active rules or change the CRD format.  ## Validation and reproduction  New regressions failed on the base revision and pass with the fix. They apply same-name experiments from different namespaces through the real partition and filtered-delay implementations, verify separate destination sets and daemon requests, retry application, and recover one experiment while preserving the other. They also exercise mixed persisted legacy/new names and name-length boundaries.  Passed on Linux arm64 with Go 1.25.12:  ```sh go run github.com/pingcap/failpoint/failpoint-ctl enable ./pkg/m
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/pull/5090?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh) Report :x: Patch coverage is `37.50000%` with `5 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 20.77%. Comparing base ([`536c193`](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/commit/536c193f8796ca52e6bd4dbb41b5493d858f30b5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh)) to head ([`d26c0f9`](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/commit/d26c0f9dc4f0997c26de7ecf5e39b8863603ac19?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh)).  | [Files with missing lines](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/pull/5090?dropdown=coverage&src=pr&el=tree&utm_medium=referr
  > The integration job passed the network test, then failed to create PhysicalMachineChaos after the OIDC test restarted the API server and upgraded the chart. The admission error was `x509: certificate signed by unknown authority`. The same failure appeared on #5091.  I checked the chart and logs: the upgrade regenerates webhook certificates and trust bundles, but the test only checks dashboard readiness before continuing. That points to an existing upgrade-readiness issue; the logs do not show which endpoint or certificate was stale.  Could a maintainer rerun the [failed integration job](https://github.com/chaos-mesh/chaos-mesh/actions/runs/33785249398/job/100748328298)? The other checks passed, but I couldn't start the rerun because GitHub requires repository admin rights. Thanks. 
  > Hi @bvolpato, thanks a lot for the time and effort you put into this PR!  We reached out in #5092 about review bandwidth and ways to coordinate (CNCF Slack `#project-chaos-mesh`), but haven't heard back for several weeks. Since this is one of a batch of related PRs (#5085 to #5092) that we can't move forward without the author's involvement, we're closing it for now to keep the queue manageable.  This is not a rejection of the change itself. If you'd like to continue, feel free to reopen this PR (or open a new one rebased on the latest `master`) and ping us here or on Slack. We're happy to pick it up again. 🙏

- **Issue #5089** (2026-09-29): **fix(chaosdaemon): keep TC chains unique across devices**
  *Symptoms*: ## What problem does this PR solve?  Filtered NetworkChaos rules on different interfaces reuse TC-TABLES-0, TC-TABLES-1, etc. Setting up the second interface flushes classifier chains created for the first interface, so both setups can report success while one interface's traffic bypasses its configured fault.  ## What's changed and how does it work?  Allocate classifier chain indices across all interfaces in the request. Keep qdisc handles and class IDs local to each device. Sort devices and filter keys so retries generate the same chain-to-class mapping.  The existing controller sequence resets CHAOS-OUTPUT before rebuilding traffic-control rules; recovery and removal of an interface continue to use that sequence.  ## Validation and reproduction  The new regression failed on the base revision in both interface orders and passes with this change. It exercises SetTcs using intercepted commands, covering unequal filter counts, global and filtered rules, multiple effects sharing a filter, stable retries, interface removal, and full recovery.  Passed on Linux arm64 with Go 1.25.12:  ```sh go run github.com/pingcap/failpoint/failpoint-ctl enable ./pkg/mock go test -mod=readonly -race ./pkg/chaosdaemon -run '^TestSetTcsPreservesFiltersAcrossDevices$' -count=1 -v go run github.com/pingcap/failpoint/failpoint-ctl disable ./pkg/mock go vet ./pkg/chaosdaemon ```  Existing focused tc/iptables tests, goimports, and git diff --check also passed. The regression refuses to run network comm
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/pull/5089?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh) Report :x: Patch coverage is `95.45455%` with `1 line` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 21.37%. Comparing base ([`536c193`](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/commit/536c193f8796ca52e6bd4dbb41b5493d858f30b5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh)) to head ([`884a106`](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/commit/884a10670415cae3575ad6475db08b97d723c8ce?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh)).  | [Files with missing lines](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/pull/5089?dropdown=coverage&src=pr&el=tree&utm_medium=referra
  > Hi @bvolpato, thanks a lot for the time and effort you put into this PR!  We reached out in #5092 about review bandwidth and ways to coordinate (CNCF Slack `#project-chaos-mesh`), but haven't heard back for several weeks. Since this is one of a batch of related PRs (#5085 to #5092) that we can't move forward without the author's involvement, we're closing it for now to keep the queue manageable.  This is not a rejection of the change itself. If you'd like to continue, feel free to reopen this PR (or open a new one rebased on the latest `master`) and ping us here or on Slack. We're happy to pick it up again. 🙏

- **Issue #5088** (2026-09-29): **fix(stresschaos): roll back CPU on memory startup failure**
  *Symptoms*: ## What problem does this PR solve?  A combined StressChaos request can start CPU workers successfully and then fail to start memory workers. ExecStressors returns an error without returning the CPU handle, so the controller records NotInjected and subsequent retries can start more CPU workers. Stopping the experiment cannot recover those unrecorded workers.  ## What's changed and how does it work?  Cancel the successfully started CPU process by its BPM UID before returning a memory-startup error. Cleanup uses an independent 10-second context so a canceled or expired injection request does not skip shutdown. Preserve the original startup error and include the worker UID and cleanup error if rollback fails.  A private executor interface allows the actual orchestration to be tested without starting stress processes. Successful CPU-only, memory-only and combined responses preserve their existing handles. This change is independent of #4950, which addresses errors during normal controller recovery.  ## Validation and reproduction  Passed on Linux arm64 with Go 1.25.12 and CGO enabled:  ```sh go test -mod=readonly -race ./pkg/chaosdaemon -run '^TestExecStressors' -count=1 go vet -mod=readonly ./pkg/chaosdaemon ```  Regression tests cover three failed attempts without accumulating CPU workers, cleanup after request cancellation, reported rollback failure, startup paths without a CPU worker, and successful responses. Focused goimports and git diff --check passed. Tests use in-memory
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/pull/5088?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh) Report :x: Patch coverage is `70.58824%` with `5 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 20.67%. Comparing base ([`536c193`](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/commit/536c193f8796ca52e6bd4dbb41b5493d858f30b5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh)) to head ([`4925d79`](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/commit/4925d792edfbba5cc81881846862e59eb6aa5698?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=chaos-mesh)).  | [Files with missing lines](https://app.codecov.io/gh/chaos-mesh/chaos-mesh/pull/5088?dropdown=coverage&src=pr&el=tree&utm_medium=referr
  > Hi @bvolpato, thanks a lot for the time and effort you put into this PR!  We reached out in #5092 about review bandwidth and ways to coordinate (CNCF Slack `#project-chaos-mesh`), but haven't heard back for several weeks. Since this is one of a batch of related PRs (#5085 to #5092) that we can't move forward without the author's involvement, we're closing it for now to keep the queue manageable.  This is not a rejection of the change itself. If you'd like to continue, feel free to reopen this PR (or open a new one rebased on the latest `master`) and ping us here or on Slack. We're happy to pick it up again. 🙏

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

### Incident Patch 1: `c859a9c6` (2026-09-29)
**Commit Message**: fix(jvmchaos): Java25 compatibility. Upgrade byteman-helper to v4.0.27-12 (#5098)

* Upgrade byteman to v4.0.27

Signed-off-by: Marek Bedkowski <[REDACTED_EMAIL]>

* Upgrade byteman to v4.0.27

Signed-off-by: Marek Bedkowski <[REDACTED_EMAIL]>

* Remove ignore certificate flag committed by mistake.

Signed-off-by: Marek Bedkowski <[REDACTED_EMAIL]>

---------

Signed-off-by: Marek Bedkowski <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -105,6 +105,7 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 - Update `enableCtrlServer` to `false` by default in the Helm chart [#4702](https://github.com/chaos-mesh/chaos-mesh/pull/4702)
 - Upgrade cosign to v2.5.3 [#4736](https://github.com/chaos-mesh/chaos-mesh/pull/4736)
 - Upgrade github.com/docker/docker to v26.1.5 [#4766](https://github.com/chaos-mesh/chaos-mesh/pull/4766)
+- Update byteman-helper to v4.0.27 [#5098](https://github.com/chaos-mesh/chaos-mesh/pull/5098)
 
 ### Deprecated
 
```

**File**: `images/chaos-daemon/Dockerfile` (modified, +2/-2)
```diff
@@ -11,9 +11,9 @@ ENV https_proxy=$HTTPS_PROXY
 ARG TARGET_PLATFORM=amd64
 
 RUN mkdir -p /tmp/bin && \
-    curl -L https://mirrors.chaos-mesh.org/byteman-chaos-mesh-download-v4.0.24-0.12.tar.gz -o /usr/local/byteman.tar.gz && \
+    curl -L https://mirrors.chaos-mesh.org/byteman-chaos-mesh-download-v4.0.27-0.12.tar.gz -o /usr/local/byteman.tar.gz && \
     tar xvf /usr/local/byteman.tar.gz -C /usr/local && \
-    mv /usr/local/byteman-chaos-mesh-download-v4.0.24-0.12 /tmp/byteman && \
+    mv /usr/local/byteman-chaos-mesh-download-v4.0.27-0.12 /tmp/byteman && \
     rm /usr/local/byteman.tar.gz
 
 # toda doesn't support arm64 yet
```

---

### Incident Patch 2: `536c193f` (2026-09-01)
**Commit Message**: fix(webhook): match SubjectAccessReview verb to admission operation (#5082)

The auth webhook hardcoded "create" as the SubjectAccessReview verb, so the garbage collector's UPDATE that removes the foregroundDeletion finalizer was denied and foreground cascading deletion hung forever. Use the verb that matches the admission operation instead.

Close #5079

Signed-off-by: Zhiqiang ZHOU <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -71,6 +71,7 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 - Fix dashboard UI token validation and infinite auth lockout loop [#5046](https://github.com/chaos-mesh/chaos-mesh/pull/5046)
 - Fix convert netem delay/jitter as durations instead of strings [#5074](https://github.com/chaos-mesh/chaos-mesh/pull/5074)
 - Stabilize StatusCheck controller tests on slower runners [#5072](https://github.com/chaos-mesh/chaos-mesh/pull/5072)
+- Use the admission operation as the SubjectAccessReview verb in the auth webhook so foreground cascading deletion no longer hangs [#5079](https://github.com/chaos-mesh/chaos-mesh/issues/5079)
 
 ### Security
 
```

**File**: `pkg/webhook/validate_auth.go` (modified, +23/-4)
```diff
@@ -23,6 +23,7 @@ import (
 
 	"github.com/go-logr/logr"
 	"github.com/pkg/errors"
+	admissionv1 "k8s.io/api/admission/v1"
 	authnv1 "k8s.io/api/authentication/v1"
 	authzv1 "k8s.io/api/authorization/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
@@ -103,8 +104,10 @@ func (v *AuthValidator) Handle(ctx context.Context, req admission.Request) admis
 
 	requireClusterPrivileges, affectedNamespaces := affectedNamespaces(chaos)
 
+	verb := sarVerb(req.Operation)
+
 	if requireClusterPrivileges {
-		allow, err := v.auth(req.UserInfo, "", requestKind)
+		allow, err := v.auth(req.UserInfo, "", requestKind, verb)
 		if err != nil {
 			return admission.Errored(http.StatusBadRequest, err)
 		}
@@ -117,7 +120,7 @@ func (v *AuthValidator) Handle(ctx context.Context, req admission.Request) admis
 		v.logger.Info("start validating user", "user", username, "groups", groups, "namespace", affectedNamespaces)
 
 		for namespace := range affectedNamespaces {
-			allow, err := v.auth(req.UserInfo, namespace, requestKind)
+			allow, err := v.auth(req.UserInfo, namespace, requestKind, verb)
 			if err != nil {
 				return admission.Errored(http.StatusBadRequest, err)
 			}
@@ -133,7 +136,23 @@ func (v *AuthValidator) Handle(ctx context.Context, req admission.Request) admis
 	return admission.Allowed("")
 }
 
-func (v *AuthValidator) auth(userInfo authnv1.UserInfo, namespace string, chaosKind string) (bool, error) {
+// sarVerb maps the admission operation to the verb checked in the
+// SubjectAccessReview, so the permission check matches the action
+// the user is actually performing.
+func sarVerb(op admissionv1.Operation) string {
+	switch op {
+	case admissionv1.Create:
+		return "create"
+	case admissionv1.Update:
+		return "update"
+	default:
+		// The webhook only registers create and update. Fall back to
+		// the lowercase operation name for any other value.
+		return strings.ToLower(string(op))
+	}
+}
+
+func (v *AuthValidator) auth(userInfo authnv1.UserInfo, namespace string, chaosKind string, verb string) (bool, error) {
 	resourceName, err := v.resourceFor(chaosKind)
 	if err != nil {
 		return false, err
@@ -143,7 +162,7 @@ func (v *AuthValidator) auth(userInfo authnv1.UserInfo, namespace string, chaosK
 		Spec: authzv1.SubjectAccessReviewSpec{
 			ResourceAttributes: &authzv1.ResourceAttributes{
 				Namespace: namespace,
-				Verb:      "create",
+				Verb:      verb,
 				Group:     "chaos-mesh.org",
 				Resource:  resourceName,
 			},
```

**File**: `pkg/webhook/validate_auth_test.go` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
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
+package webhook
+
+import (
+	"testing"
+
+	admissionv1 "k8s.io/api/admission/v1"
+)
+
+func TestSarVerb(t *testing.T) {
+	cases := []struct {
+		operation admissionv1.Operation
+		want      string
+	}{
+		{admissionv1.Create, "create"},
+		{admissionv1.Update, "update"},
+		{admissionv1.Delete, "delete"},
+	}
+
+	for _, c := range cases {
+		got := sarVerb(c.operation)
+		if got != c.want {
+			t.Errorf("sarVerb(%q) = %q, want %q", c.operation, got, c.want)
+		}
+	}
+}
```

---

### Incident Patch 3: `cedd5432` (2026-09-01)
**Commit Message**: fix(ui): show errors without API responses (#4999)

Signed-off-by: bvolpato <[REDACTED_EMAIL]>

**File**: `ui/app/src/api/interceptors.ts` (modified, +2/-2)
```diff
@@ -56,10 +56,10 @@ export const applyErrorHandling = ({
         })
         resetAPIAuthentication()
         removeToken()
-      } else if (data) {
+      } else {
         openAlert({
           type: 'error',
-          message: data.message || 'An unknown error occurred',
+          message: data?.message || 'An unknown error occurred',
         })
       }
 
```

---

### Incident Patch 4: `2ddada2d` (2026-09-01)
**Commit Message**: fix(chaosdaemon): convert netem delay/jitter as durations instead of strings (#5074)

Signed-off-by: 0xff-dev <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -66,6 +66,7 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 - Fix a TypeError crash in the Dashboard UI when opening the details page of a Workflow-type schedule [#5034](https://github.com/chaos-mesh/chaos-mesh/pull/5034)
 - Fixed jvm latency experiment not working for jdk version 19 and higher [#4821](https://github.com/chaos-mesh/chaos-mesh/pull/4821)
 - Fix dashboard UI token validation and infinite auth lockout loop [#5046](https://github.com/chaos-mesh/chaos-mesh/pull/5046)
+- Fix convert netem delay/jitter as durations instead of strings [#5074](https://github.com/chaos-mesh/chaos-mesh/pull/5074)
 
 ### Security
 
```

**File**: `pkg/chaosdaemon/tc_server.go` (modified, +74/-8)
```diff
@@ -21,6 +21,7 @@ import (
 	"fmt"
 	"net"
 	"strings"
+	"time"
 
 	"github.com/go-logr/logr"
 	"github.com/golang/protobuf/ptypes/empty"
@@ -392,7 +393,12 @@ func (c *tcClient) addPrio(device string, parent int, band int) error {
 func (c *tcClient) addNetem(device string, parent string, handle string, netem *pb.Netem) error {
 	c.log.Info("adding netem", "device", device, "parent", parent, "handle", handle)
 
-	args := fmt.Sprintf("qdisc add dev %s %s %s netem %s", device, parent, handle, convertNetemToArgs(netem))
+	netemArgs, err := convertNetemToArgs(netem)
+	if err != nil {
+		return err
+	}
+
+	args := fmt.Sprintf("qdisc add dev %s %s %s netem %s", device, parent, handle, netemArgs)
 	processBuilder := bpm.DefaultProcessBuilder("tc", strings.Split(args, " ")...).SetContext(c.ctx)
 	if c.enterNS {
 		processBuilder = processBuilder.SetNS(c.pid, bpm.NetNS)
@@ -421,12 +427,72 @@ func (c *tcClient) addTbf(device string, parent string, handle string, tbf *pb.T
 	return nil
 }
 
-func convertNetemToArgs(netem *pb.Netem) string {
+// optionalDuration parses an optional duration field of Netem. An empty value
+// means the field is not set, and is reported as a zero duration. A negative
+// value is rejected, so that it cannot be mistaken for an unset field and
+// silently ignored.
+func optionalDuration(value string) (time.Duration, error) {
+	if len(value) == 0 {
+		return 0, nil
+	}
+
+	duration, err := time.ParseDuration(value)
+	if err != nil {
+		return 0, err
+	}
+
+	if duration < 0 {
+		return 0, errors.Errorf("negative duration %s", value)
+	}
+
+	return duration, nil
+}
+
+// formatTcDuration renders a non-negative duration with a unit understood by
+// tc.
+//
+// The duration fields of Netem carry any format accepted by
+// time.ParseDuration, which knows the "ns", "us", "ms", "s", "m" and "h" units
+// and compound values like "0m30s". tc only knows three time scales, seconds,
+// milliseconds and microseconds, and rejects everything else with
+// `Illegal "latency"`, so the value cannot be forwarded as is. Its output is
+// therefore restricted to "s"/"ms"/"us", the scales both sides understand.
+func formatTcDuration(duration time.Duration) string {
+	switch {
+	case duration%time.Second == 0:
+		return fmt.Sprintf("%ds", int64(duration/time.Second))
+	case duration%time.Millisecond == 0:
+		return fmt.Sprintf("%dms", int64(duration/time.Millisecond))
+	default:
+		// A microsecond is the finest scale tc can be given with a unit. Round
+		// up, so that a shorter non-zero duration does not turn into a no-op.
+		microseconds := int64(duration / time.Microsecond)
+		if duration%time.Microsecond != 0 {
+			microseconds++
+		}
+		return fmt.Sprintf("%dus", microseconds)
+	}
+}
+
+func convertNetemToArgs(netem *pb.Netem) (string, error) {
+	// Durations must be parsed instead of being compared and forwarded as
+	// strings: comparing the raw strings drops valid values like "0.5s", which
+	// is lexicographically smaller than "0ms" while being greater than zero.
+	delay, err := optionalDuration(netem.Time)
+	if err != nil {
+		return "", errors.Wrapf(err, "parse netem delay %s", netem.Time)
+	}
+
+	jitter, err := optionalDuration(netem.Jitter)
+	if err != nil {
+		return "", errors.Wrapf(err, "parse netem jitter %s", netem.Jitter)
+	}
+
 	args := ""
-	if netem.Time > "0ms" {
-		args = fmt.Sprintf("delay %s", netem.Time)
-		if netem.Jitter > "0ms" {
-			args = fmt.Sprintf("%s %s", args, netem.Jitter)
+	if delay > 0 {
+		args = fmt.Sprintf("delay %s", formatTcDuration(delay))
+		if jitter > 0 {
+			args = fmt.Sprintf("%s %s", args, formatTcDuration(jitter))
 
 			if netem.DelayCorr > 0 {
 				args = fmt.Sprintf("%s %f", args, netem.DelayCorr)
@@ -477,13 +543,13 @@ func convertNetemToArgs(netem *pb.Netem) string {
 
 	trimedArgs := []string{}
 
-	for _, part := range strings.Split(args, " ") {
+	for part := range strings.SplitSeq(args, " ") {
 		if len(part) > 0 {
 			trimedArgs = append(trimedArgs, part)
 		}
 	}
 
-	return strings.Join(trimedArgs, " ")
+	return strings.Join(trimedArgs, " "), nil
 }
 
 func convertTbfToArgs(tbf *pb.Tbf) string {
```

**File**: `pkg/chaosdaemon/tc_server_test.go` (modified, +149/-24)
```diff
@@ -16,7 +16,9 @@
 package chaosdaemon
 
 import (
+	"math"
 	"testing"
+	"time"
 
 	. "github.com/onsi/gomega"
 
@@ -57,127 +59,250 @@ func Test_generateQdiscArgs(t *testing.T) {
 func Test_convertNetemToArgs(t *testing.T) {
 	g := NewWithT(t)
 
+	// mustConvertNetemToArgs asserts the conversion succeeds and returns the args.
+	mustConvertNetemToArgs := func(netem *pb.Netem) string {
+		args, err := convertNetemToArgs(netem)
+		g.Expect(err).To(BeNil())
+		return args
+	}
+
 	t.Run("convert network delay", func(t *testing.T) {
-		args := convertNetemToArgs(&pb.Netem{
+		args := mustConvertNetemToArgs(&pb.Netem{
 			Time: "1000ms",
 		})
-		g.Expect(args).To(Equal("delay 1000ms"))
+		g.Expect(args).To(Equal("delay 1s"))
 
-		args = convertNetemToArgs(&pb.Netem{
+		args = mustConvertNetemToArgs(&pb.Netem{
 			Time:      "1000ms",
 			DelayCorr: 25,
 		})
-		g.Expect(args).To(Equal("delay 1000ms"))
+		g.Expect(args).To(Equal("delay 1s"))
 
-		args = convertNetemToArgs(&pb.Netem{
+		args = mustConvertNetemToArgs(&pb.Netem{
 			Time:      "1000us",
 			Jitter:    "10000ns",
 			DelayCorr: 25,
 		})
-		g.Expect(args).To(Equal("delay 1000us 10000ns 25.000000"))
+		g.Expect(args).To(Equal("delay 1ms 10us 25.000000"))
+	})
+
+	t.Run("convert network delay with units unknown to tc", func(t *testing.T) {
+		// tc only understands "s", "ms" and "us", while these are all valid
+		// values for the API, so they must be normalized instead of being
+		// forwarded as is.
+		args := mustConvertNetemToArgs(&pb.Netem{
+			Time: "1m",
+		})
+		g.Expect(args).To(Equal("delay 60s"))
+
+		args = mustConvertNetemToArgs(&pb.Netem{
+			Time: "0m30s",
+		})
+		g.Expect(args).To(Equal("delay 30s"))
+
+		args = mustConvertNetemToArgs(&pb.Netem{
+			Time: "1m30s",
+		})
+		g.Expect(args).To(Equal("delay 90s"))
+
+		args = mustConvertNetemToArgs(&pb.Netem{
+			Time: "1500ns",
+		})
+		g.Expect(args).To(Equal("delay 2us"))
+	})
+
+	t.Run("convert network delay below one millisecond", func(t *testing.T) {
+		// "0.5s" is lexicographically smaller than "0ms", it used to be
+		// silently dropped, leaving the experiment without any delay.
+		args := mustConvertNetemToArgs(&pb.Netem{
+			Time: "0.5s",
+		})
+		g.Expect(args).To(Equal("delay 500ms"))
+
+		args = mustConvertNetemToArgs(&pb.Netem{
+			Time:      "0.25s",
+			Jitter:    "0.1s",
+			DelayCorr: 25,
+		})
+		g.Expect(args).To(Equal("delay 250ms 100ms 25.000000"))
+	})
+
+	t.Run("convert zero network delay", func(t *testing.T) {
+		// "0s" and "0us" are lexicographically greater than "0ms" while being
+		// zero, they used to generate a pointless `delay 0s`.
+		for _, zero := range []string{"", "0ms", "0s", "0us", "0ns"} {
+			args := mustConvertNetemToArgs(&pb.Netem{
+				Time: zero,
+			})
+			g.Expect(args).To(Equal(""), "delay %q should be dropped", zero)
+
+			args = mustConvertNetemToArgs(&pb.Netem{
+				Time:      "1s",
+				Jitter:    zero,
+				DelayCorr: 25,
+			})
+			g.Expect(args).To(Equal("delay 1s"), "jitter %q should be dropped", zero)
+		}
+	})
+
+	t.Run("reject invalid durations", func(t *testing.T) {
+		_, err := convertNetemToArgs(&pb.Netem{
+			Time: "1000",
+		})
+		g.Expect(err).To(HaveOccurred())
+
+		_, err = convertNetemToArgs(&pb.Netem{
+			Time:   "1s",
+			Jitter: "not a duration",
+		})
+		g.Expect(err).To(HaveOccurred())
+	})
+
+	t.Run("reject negative durations", func(t *testing.T) {
+		// A negative duration would compare as "not greater than zero" and be
+		// indistinguishable from an unset field, so it must not be accepted.
+		_, err := convertNetemToArgs(&pb.Netem{
+			Time: "-1s",
+		})
+		g.Expect(err).To(HaveOccurred())
+
+		_, err = convertNetemToArgs(&pb.Netem{
+			Time:   "1s",
+			Jitter: "-1ms",
+		})
+		g.Expect(err).To(HaveOccurred())
 	})
 
 	t.Run("convert packet limit", func(t *testing.T) {
-		args := convertNetemToArgs(&pb.Netem{
+		args := mustConvertNetemToArgs(&pb.Netem{
 			Limit: 1000,
 		})
 		g.Expect(args).To(Equal("limit 1000"))
 	})
 
 	t.Run("convert packet loss", func(t *testing.T) {
-		args := convertNetemToArgs(&pb.Netem{
+		args := mustConvertNetemToArgs(&pb.Netem{
 			Loss: 100,
 		})
 		g.Expect(args).To(Equal("loss 100.000000"))
 
-		args = convertNetemToArgs(&pb.Netem{
+		args = mustConvertNetemToArgs(&pb.Netem{
 			Loss:     50,
 			LossCorr: 12,
 		})
 		g.Expect(args).To(Equal("loss 50.000000 12.000000"))
 	})
 
 	t.Run("convert packet reorder", func(t *testing.T) {
-		args := convertNetemToArgs(&pb.Netem{
+		args := mustConvertNetemToArgs(&pb.Netem{
 			Reorder:     5,
 			ReorderCorr: 10,
 		})
 		g.Expect(args).To(Equal(""))
 
-		args = convertNetemToArgs(&pb.Netem{
+		args = mustConvertNetemToArgs(&pb.Netem{
 			Time:        "1000ms",
 			Jitter:      "10000ms",
 			DelayCorr:   25,
 			Reorder:     5,
 			ReorderCorr: 10,
 			Gap:         10,
 		})
-		g.Expect(args).To(Equal("delay 1000ms 10000ms 25.000000 reorder 5.000000 10.000000 gap 10"))
+		g.Expect(args).To(Equal("delay 1s 10s 25.000000 reorder 5.000
```

---

### Incident Patch 5: `1f979282` (2026-08-27)
**Commit Message**: ci: fix path filter exclusions (#5078)

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +1/-0)
```diff
@@ -34,6 +34,7 @@ jobs:
       - uses: dorny/paths-filter@v4
         id: filter
         with:
+          predicate-quantifier: some-with-excludes
           filters: |
             go:
               - Makefile
```

**File**: `.github/workflows/ci_skip.yml` (modified, +3/-0)
```diff
@@ -21,12 +21,15 @@ jobs:
       - uses: dorny/paths-filter@v4
         id: filter
         with:
+          predicate-quantifier: some-with-excludes
           filters: |
             go:
               - Makefile
               - go.*
               - '**.go'
               - 'helm/**'
+              - '!helm/**/*.md'
+              - '.github/actions/build-chaos-mesh-build-env/**'
             ui:
               - 'ui/pnpm-lock.yaml'
               - '**.js'
```

---

### Incident Patch 6: `4c09a0db` (2026-08-18)
**Commit Message**: fix(ui): resolve token validation and lockout loop (#5046)

Co-authored-by: Yue Yang <[REDACTED_EMAIL]>
Signed-off-by: Hsiu-Chia Cheng <[REDACTED_EMAIL]>
Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -64,6 +64,7 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 - Optimize RBAC Token Generator copy buttons in Dashboard UI [#4941](https://github.com/chaos-mesh/chaos-mesh/pull/4941)
 - Fix a TypeError crash in the Dashboard UI when opening the details page of a Workflow-type schedule [#5034](https://github.com/chaos-mesh/chaos-mesh/pull/5034)
 - Fixed jvm latency experiment not working for jdk version 19 and higher [#4821](https://github.com/chaos-mesh/chaos-mesh/pull/4821)
+- Fix dashboard UI token validation and infinite auth lockout loop [#5046](https://github.com/chaos-mesh/chaos-mesh/pull/5046)
 
 ### Security
 
```

**File**: `ui/app/src/api/interceptors.ts` (modified, +23/-36)
```diff
@@ -37,43 +37,30 @@ export const applyErrorHandling = ({
     (response) => response,
     (error: AxiosError<ErrorData>) => {
       const data = error.response?.data
+      const type = data?.type.slice(10) // slice(10): error.api.xxx => xxx
+      const message = data?.message ?? ''
+      const isPrivilegeError = type === 'no_cluster_privilege' || type === 'no_namespace_privilege'
+      const isTokenError =
+        error.response?.status === 401 ||
+        (type === 'bad_request' && (message.includes('token') || message.includes('Unauthorized'))) ||
+        (type === 'internal_server_error' && message.includes('Unauthorized'))
+
+      if (isPrivilegeError) {
+        return Promise.reject(error)
+      }
 
-      if (data) {
-        // slice(10): error.api.xxx => xxx
-        const type = data.type.slice(10)
-
-        switch (type) {
-          case 'invalid_request':
-            if (data.message.includes('Unauthorized')) {
-              openAlert({
-                type: 'error',
-                message: 'Please check the validity of the token',
-              })
-            }
-
-            break
-          case 'internal_server_error':
-            if (data.message.includes('Unauthorized')) {
-              openAlert({
-                type: 'error',
-                message: 'Unauthorized. Please check the validity of the token',
-              })
-
-              resetAPIAuthentication()
-              removeToken()
-            }
-
-            break
-          case 'no_cluster_privilege':
-          case 'no_namespace_privilege':
-          default:
-            openAlert({
-              type: 'error',
-              message: data.message || 'An unknown error occurred',
-            })
-
-            break
-        }
+      if (isTokenError) {
+        openAlert({
+          type: 'error',
+          message: 'Please check the validity of the token',
+        })
+        resetAPIAuthentication()
+        removeToken()
+      } else if (data) {
+        openAlert({
+          type: 'error',
+          message: data.message || 'An unknown error occurred',
+        })
       }
 
       return Promise.reject(error)
```

**File**: `ui/app/src/components/NewWorkflowNext/SubmitWorkflow.tsx` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ const validationSchema = Yup.object({
   deadline: Yup.string().trim().required(),
 })
 
-interface WorkflowBasic {
+export interface WorkflowBasic {
   name: string
   namespace: string
   deadline: string
```

**File**: `ui/app/src/components/RBACGenerator/index.tsx` (modified, +1/-2)
```diff
@@ -47,7 +47,6 @@ const RBACGenerator = () => {
 
   const { data: namespaces } = useGetCommonChaosAvailableNamespaces({
     query: {
-      enabled: false,
       staleTime: Stale.DAY,
     },
   })
@@ -110,7 +109,7 @@ const RBACGenerator = () => {
                   helperText={i18n('common.chooseNamespace')}
                   disabled={clustered}
                 >
-                  {namespaces!.map((n) => (
+                  {namespaces?.map((n) => (
                     <MenuItem key={n} value={n}>
                       {n}
                     </MenuItem>
```

**File**: `ui/app/src/components/T/index.tsx` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ import { FormattedMessage } from 'react-intl'
 import type { IntlShape } from 'react-intl'
 
 // https://github.com/microsoft/TypeScript/issues/24929
-function i18n(id: string): Exclude<React.ReactChild, number> // DEPRECATED, but preserve for backward compatibility.
+function i18n(id: string): Exclude<React.ReactNode, number> // DEPRECATED, but preserve for backward compatibility.
 function i18n(id: string, intl: IntlShape): string
 function i18n(id: string, intl?: IntlShape) {
   return intl ? intl.formatMessage({ id }) : <FormattedMessage id={id} />
```

**File**: `ui/app/src/components/Token/index.tsx` (modified, +17/-17)
```diff
@@ -27,16 +27,6 @@ import i18n from '@/components/T'
 
 import { validateName } from '@/lib/formikhelpers'
 
-function validateToken(value: string) {
-  let error
-
-  if (value === '') {
-    error = i18n('settings.addToken.tokenValidation') as unknown as string
-  }
-
-  return error
-}
-
 export interface TokenFormValues {
   name: string
   token: string
@@ -48,6 +38,11 @@ interface TokenProps {
 
 const Token: ReactFCWithChildren<TokenProps> = ({ onSubmitCallback }) => {
   const intl = useIntl()
+  const validateToken = (value: string) => {
+    if (value === '') {
+      return i18n('settings.addToken.tokenValidation', intl)
+    }
+  }
 
   const { setAlert } = useComponentActions()
   const tokens = useAuthStore((state) => state.tokens)
@@ -73,7 +68,9 @@ const Token: ReactFCWithChildren<TokenProps> = ({ onSubmitCallback }) => {
     function restSteps() {
       saveToken(values)
 
-      typeof onSubmitCallback === 'function' && onSubmitCallback(values)
+      if (typeof onSubmitCallback === 'function') {
+        onSubmitCallback(values)
+      }
 
       resetForm()
     }
@@ -84,15 +81,18 @@ const Token: ReactFCWithChildren<TokenProps> = ({ onSubmitCallback }) => {
       .catch((error) => {
         const data = error.response?.data
 
-        if (data && data.code === 'error.api.invalid_request' && data.message.includes('Unauthorized')) {
-          setFieldError('token', 'Please check the validity of the token')
-
-          resetAPIAuthentication()
+        if (
+          data &&
+          (data.type === 'error.api.no_cluster_privilege' || data.type === 'error.api.no_namespace_privilege')
+        ) {
+          restSteps()
 
           return
         }
 
-        restSteps()
+        setFieldError('token', 'Please check the validity of the token')
+
+        resetAPIAuthentication()
       })
   }
 
@@ -104,7 +104,7 @@ const Token: ReactFCWithChildren<TokenProps> = ({ onSubmitCallback }) => {
             <TextField
               name="name"
               label={i18n('common.name')}
-              validate={validateName(i18n('settings.addToken.nameValidation') as unknown as string)}
+              validate={validateName(i18n('settings.addToken.nameValidation', intl))}
               helperText={errors.name && touched.name ? errors.name : i18n('settings.addToken.nameHelper')}
               error={errors.name && touched.name ? true : false}
             />
```

**File**: `ui/app/src/components/TopContainer/index.tsx` (modified, +10/-5)
```diff
@@ -119,10 +119,15 @@ const TopContainer = () => {
 
       if (token && tokenName) {
         const tokens: TokenFormValues[] = JSON.parse(token)
-
-        applyAPIAuthentication(tokens.find(({ name }) => name === tokenName)!.token)
-        setTokens(tokens)
-        setTokenName(tokenName)
+        const activeToken = tokens.find(({ name }) => name === tokenName)
+
+        if (activeToken && activeToken.token) {
+          applyAPIAuthentication(activeToken.token)
+          setTokens(tokens)
+          setTokenName(tokenName)
+        } else {
+          setAuthOpen(true)
+        }
       } else {
         setAuthOpen(true)
       }
@@ -164,7 +169,7 @@ const TopContainer = () => {
           <Divider />
 
           <Container maxWidth="xl" disableGutters sx={{ flexGrow: 1, p: 6 }}>
-            {loading ? <Loading /> : <Outlet />}
+            {loading || authOpen ? <Loading /> : <Outlet />}
           </Container>
         </Box>
       </Root>
```

**File**: `ui/app/src/lib/formikhelpers.ts` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ import _ from 'lodash'
 import { podPhases } from '@/components/AutoForm/data'
 import { Experiment, ExperimentKind, Frame, Scope } from '@/components/NewExperiment/types'
 import basicData from '@/components/NewExperimentNext/data/basic'
-import { WorkflowBasic } from '@/components/NewWorkflow'
+import type { WorkflowBasic } from '@/components/NewWorkflowNext/SubmitWorkflow'
 import { ScheduleSpecific } from '@/components/Schedule/types'
 
 import { arrToObjBySep, sanitize } from './utils'
```

---

### Incident Patch 7: `84fc733c` (2026-08-04)
**Commit Message**: build(images): migrate chaos-dashboard and chaos-dlv base images from debian to alpine (#5027)

Part of #5014.

- chaos-dashboard: the binary is built with CGO_ENABLED=0 since #4800,
  so it runs on musl without changes. Replace debian:bookworm-slim +
  apt with alpine:3.23 + apk (tzdata, ca-certificates), matching the
  existing chaos-controller-manager image.
- chaos-dlv: dlv is pure Go; build with golang:1.25-alpine and run on
  alpine:3.23 with procps. Switch CMD from bash to sh since alpine
  ships no bash.

chaos-daemon, build-env and dev-env are intentionally left on debian
for now: chaos-daemon is CGO-linked against glibc and bundles
glibc-linked vendor binaries (toda, nsexec, chaos-tproxy, memStress,
OpenJDK), which need musl builds first. This will be handled in a
follow-up.

Verified locally: both images build, chaos-dashboard --version and
dlv version run correctly on alpine, ps axf works with procps.

Ref: #5014

Signed-off-by: Saiyam Pathak <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 
 ### Changed
 
+- Migrate chaos-dashboard and chaos-dlv container base images from debian to alpine [#5027](https://github.com/chaos-mesh/chaos-mesh/pull/5027)
 - Upgrade gorm to v2 [#4630](https://github.com/chaos-mesh/chaos-mesh/pull/4630)
 - Allow customization of controller client-go QPS and BURST [#4779](https://github.com/chaos-mesh/chaos-mesh/pull/4779)
 - Use GitHub-managed ARM64 runners for ARM64 builds in upload_env_image workflow [#4794](https://github.com/chaos-mesh/chaos-mesh/pull/4794)
```

**File**: `images/chaos-dashboard/Dockerfile` (modified, +2/-6)
```diff
@@ -1,4 +1,4 @@
-FROM debian:bookworm-slim
+FROM alpine:3.23
 
 ARG HTTPS_PROXY
 ARG HTTP_PROXY
@@ -9,11 +9,7 @@ ENV https_proxy=$HTTPS_PROXY
 ARG UI
 ARG SWAGGER
 
-RUN echo "deb http://security.debian.org/debian-security bookworm-security main contrib non-free" >> /etc/apt/sources.list && \
-    echo "deb http://deb.debian.org/debian bookworm-proposed-updates main contrib non-free" >> /etc/apt/sources.list && \
-    apt update --allow-releaseinfo-change && apt upgrade -y && \
-    apt install tzdata ca-certificates -y && \
-    rm -rf /var/lib/apt/lists/*
+RUN apk upgrade --no-cache && apk add --no-cache tzdata ca-certificates
 
 ENV http_proxy=
 ENV https_proxy=
```

**File**: `images/chaos-dlv/Dockerfile` (modified, +4/-6)
```diff
@@ -1,13 +1,11 @@
 # syntax=docker/dockerfile:experimental
 
-FROM golang:1.25-bookworm AS build-env
+FROM golang:1.25-alpine AS build-env
 RUN go install github.com/go-delve/delve/cmd/dlv@v1.21.0
 
-FROM debian:bookworm-slim
+FROM alpine:3.23
 
-RUN apt update && \
-    apt install procps -y && \
-    rm -rf /var/lib/apt/lists/*
+RUN apk add --no-cache procps
 
 COPY --from=build-env /go/bin/dlv /
-CMD ["bash", "-c", "/dlv attach $(ps axf | grep $CMD_NAME | grep -v grep | awk '{print $1}') --listen=:8000 --headless=true --api-version=2 --accept-multiclient --continue"]
+CMD ["sh", "-c", "/dlv attach $(ps axf | grep $CMD_NAME | grep -v grep | awk '{print $1}') --listen=:8000 --headless=true --api-version=2 --accept-multiclient --continue"]
```

---

### Incident Patch 8: `e45e8f93` (2026-08-03)
**Commit Message**: fix: Fix jvm latency experiment (#4821)

This experiment was failing for jdks version 19 and higher,
as Byteman was not able to find matching method for Thread.sleep.
Starting from java 19 new overload of sleep method was introduced
which had Duration object as an argument.

Rule that chaos mesh provided was passing Integer value
while Thread.sleep expects Long. After new overload was
added, Byteman was not able to resolve which method should
it use since there were no exact match by arguments.

The fix is to explicitly provide literal of type Long as
Thread.sleep argument, allowing Byteman to unambiguously
resolve correct overload of sleep method.

Signed-off-by: Dmytro Koval <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -58,6 +58,7 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 - Fix dashboard subpath serving by adding base path to Vite config [#5016](https://github.com/chaos-mesh/chaos-mesh/pull/5016)
 - Optimize RBAC Token Generator copy buttons in Dashboard UI [#4941](https://github.com/chaos-mesh/chaos-mesh/pull/4941)
 - Fix a TypeError crash in the Dashboard UI when opening the details page of a Workflow-type schedule [#5034](https://github.com/chaos-mesh/chaos-mesh/pull/5034)
+- Fixed jvm latency experiment not working for jdk version 19 and higher [#4821](https://github.com/chaos-mesh/chaos-mesh/pull/4821)
 
 ### Security
 
```

**File**: `controllers/chaosimpl/jvmchaos/impl.go` (modified, +2/-2)
```diff
@@ -220,7 +220,7 @@ func generateRuleData(spec *v1alpha1.JVMChaosSpec) error {
 
 	switch spec.Action {
 	case v1alpha1.JVMLatencyAction:
-		bytemanTemplateSpec.Do = fmt.Sprintf("Thread.sleep(%d)", spec.LatencyDuration)
+		bytemanTemplateSpec.Do = fmt.Sprintf("Thread.sleep(%dL)", spec.LatencyDuration)
 	case v1alpha1.JVMExceptionAction:
 		bytemanTemplateSpec.Do = fmt.Sprintf("throw new %s", spec.ThrowException)
 	case v1alpha1.JVMReturnAction:
@@ -269,7 +269,7 @@ func generateRuleData(spec *v1alpha1.JVMChaosSpec) error {
 			exception := fmt.Sprintf(mysqlException, spec.ThrowException)
 			bytemanTemplateSpec.Do = fmt.Sprintf("throw new %s", exception)
 		} else if spec.LatencyDuration > 0 {
-			bytemanTemplateSpec.Do = fmt.Sprintf("Thread.sleep(%d)", spec.LatencyDuration)
+			bytemanTemplateSpec.Do = fmt.Sprintf("Thread.sleep(%dL)", spec.LatencyDuration)
 		}
 	}
 
```

**File**: `controllers/chaosimpl/jvmchaos/impl_test.go` (modified, +2/-2)
```diff
@@ -79,7 +79,7 @@ func TestGenerateRuleData(t *testing.T) {
 					LatencyDuration: 5000,
 				},
 			},
-			"\nRULE test\nCLASS testClass\nMETHOD testMethod\nAT ENTRY\nIF true\nDO\n\tThread.sleep(5000);\nENDRULE\n",
+			"\nRULE test\nCLASS testClass\nMETHOD testMethod\nAT ENTRY\nIF true\nDO\n\tThread.sleep(5000L);\nENDRULE\n",
 		},
 		{
 			&v1alpha1.JVMChaosSpec{
@@ -159,7 +159,7 @@ func TestGenerateRuleData(t *testing.T) {
 					LatencyDuration: 5000,
 				},
 			},
-			"\nRULE test\nCLASS com.mysql.cj.NativeSession\nMETHOD execSQL\nHELPER org.chaos_mesh.byteman.helper.SQLHelper\nAT ENTRY\nBIND flag:boolean=matchDBTable(\"\", $2, \"test\", \"t1\", \"select\");\nIF flag\nDO\n\tThread.sleep(5000);\nENDRULE\n",
+			"\nRULE test\nCLASS com.mysql.cj.NativeSession\nMETHOD execSQL\nHELPER org.chaos_mesh.byteman.helper.SQLHelper\nAT ENTRY\nBIND flag:boolean=matchDBTable(\"\", $2, \"test\", \"t1\", \"select\");\nIF flag\nDO\n\tThread.sleep(5000L);\nENDRULE\n",
 		},
 	}
 
```

---

### Incident Patch 9: `63f3d59f` (2026-07-31)
**Commit Message**: fix(typo): prometehus -> prometheus in monitoring README (#5032)

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>
Co-authored-by: Yue Yang <[REDACTED_EMAIL]>
Signed-off-by: Akanksha Trehun <[REDACTED_EMAIL]>
Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

**File**: `api/v1alpha1/iochaos_types.go` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ type IOChaosSpec struct {
 	// +optional
 	Errno uint32 `json:"errno,omitempty" webhook:"IOErrno"`
 
-	// Attr defines the overrided attribution
+	// Attr defines the overridden attribution
 	// +ui:form:when=action=='attrOverride'
 	// +optional
 	Attr *AttrOverrideSpec `json:"attr,omitempty"`
```

**File**: `config/crd/bases/chaos-mesh.org_iochaos.yaml` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ spec:
                 - mistake
                 type: string
               attr:
-                description: Attr defines the overrided attribution
+                description: Attr defines the overridden attribution
                 properties:
                   atime:
                     description: Timespec represents a time
```

**File**: `config/crd/bases/chaos-mesh.org_schedules.yaml` (modified, +3/-3)
```diff
@@ -800,7 +800,7 @@ spec:
                     - mistake
                     type: string
                   attr:
-                    description: Attr defines the overrided attribution
+                    description: Attr defines the overridden attribution
                     properties:
                       atime:
                         description: Timespec represents a time
@@ -4191,7 +4191,7 @@ spec:
                               - mistake
                               type: string
                             attr:
-                              description: Attr defines the overrided attribution
+                              description: Attr defines the overridden attribution
                               properties:
                                 atime:
                                   description: Timespec represents a time
@@ -7246,7 +7246,7 @@ spec:
                                   - mistake
                                   type: string
                                 attr:
-                                  description: Attr defines the overrided attribution
+                                  description: Attr defines the overridden attribution
                                   properties:
                                     atime:
                                       description: Timespec represents a time
```

**File**: `config/crd/bases/chaos-mesh.org_workflownodes.yaml` (modified, +4/-4)
```diff
@@ -821,7 +821,7 @@ spec:
                     - mistake
                     type: string
                   attr:
-                    description: Attr defines the overrided attribution
+                    description: Attr defines the overridden attribution
                     properties:
                       atime:
                         description: Timespec represents a time
@@ -3807,7 +3807,7 @@ spec:
                         - mistake
                         type: string
                       attr:
-                        description: Attr defines the overrided attribution
+                        description: Attr defines the overridden attribution
                         properties:
                           atime:
                             description: Timespec represents a time
@@ -7224,7 +7224,7 @@ spec:
                                   - mistake
                                   type: string
                                 attr:
-                                  description: Attr defines the overrided attribution
+                                  description: Attr defines the overridden attribution
                                   properties:
                                     atime:
                                       description: Timespec represents a time
@@ -10319,7 +10319,7 @@ spec:
                                       - mistake
                                       type: string
                                     attr:
-                                      description: Attr defines the overrided attribution
+                                      description: Attr defines the overridden attribution
                                       properties:
                                         atime:
                                           description: Timespec represents a time
```

**File**: `config/crd/bases/chaos-mesh.org_workflows.yaml` (modified, +2/-2)
```diff
@@ -843,7 +843,7 @@ spec:
                           - mistake
                           type: string
                         attr:
-                          description: Attr defines the overrided attribution
+                          description: Attr defines the overridden attribution
                           properties:
                             atime:
                               description: Timespec represents a time
@@ -3880,7 +3880,7 @@ spec:
                               - mistake
                               type: string
                             attr:
-                              description: Attr defines the overrided attribution
+                              description: Attr defines the overridden attribution
                               properties:
                                 atime:
                                   description: Timespec represents a time
```

**File**: `helm/chaos-mesh/crds/chaos-mesh.org_iochaos.yaml` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ spec:
                 - mistake
                 type: string
               attr:
-                description: Attr defines the overrided attribution
+                description: Attr defines the overridden attribution
                 properties:
                   atime:
                     description: Timespec represents a time
```

**File**: `helm/chaos-mesh/crds/chaos-mesh.org_schedules.yaml` (modified, +3/-3)
```diff
@@ -800,7 +800,7 @@ spec:
                     - mistake
                     type: string
                   attr:
-                    description: Attr defines the overrided attribution
+                    description: Attr defines the overridden attribution
                     properties:
                       atime:
                         description: Timespec represents a time
@@ -4191,7 +4191,7 @@ spec:
                               - mistake
                               type: string
                             attr:
-                              description: Attr defines the overrided attribution
+                              description: Attr defines the overridden attribution
                               properties:
                                 atime:
                                   description: Timespec represents a time
@@ -7246,7 +7246,7 @@ spec:
                                   - mistake
                                   type: string
                                 attr:
-                                  description: Attr defines the overrided attribution
+                                  description: Attr defines the overridden attribution
                                   properties:
                                     atime:
                                       description: Timespec represents a time
```

**File**: `helm/chaos-mesh/crds/chaos-mesh.org_workflownodes.yaml` (modified, +4/-4)
```diff
@@ -821,7 +821,7 @@ spec:
                     - mistake
                     type: string
                   attr:
-                    description: Attr defines the overrided attribution
+                    description: Attr defines the overridden attribution
                     properties:
                       atime:
                         description: Timespec represents a time
@@ -3807,7 +3807,7 @@ spec:
                         - mistake
                         type: string
                       attr:
-                        description: Attr defines the overrided attribution
+                        description: Attr defines the overridden attribution
                         properties:
                           atime:
                             description: Timespec represents a time
@@ -7224,7 +7224,7 @@ spec:
                                   - mistake
                                   type: string
                                 attr:
-                                  description: Attr defines the overrided attribution
+                                  description: Attr defines the overridden attribution
                                   properties:
                                     atime:
                                       description: Timespec represents a time
@@ -10319,7 +10319,7 @@ spec:
                                       - mistake
                                       type: string
                                     attr:
-                                      description: Attr defines the overrided attribution
+                                      description: Attr defines the overridden attribution
                                       properties:
                                         atime:
                                           description: Timespec represents a time
```

---

### Incident Patch 10: `f8198b26` (2026-07-31)
**Commit Message**: test(e2e): replace Poll with PollUntilContextTimeout (#5048)

Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

**File**: `api/v1alpha1/timechaos_webhook.go` (modified, +1/-2)
```diff
@@ -29,8 +29,7 @@ type ClockIds []string
 
 // DefaultClockIds will set default value for empty ClockIds fields
 func (in *ClockIds) Default(root interface{}, field *reflect.StructField) {
-	// in cannot be nil
-	if *in == nil || len(*in) == 0 {
+	if len(*in) == 0 {
 		*in = []string{"CLOCK_REALTIME"}
 	}
 }
```

**File**: `e2e-test/action.go` (modified, +3/-3)
```diff
@@ -103,7 +103,7 @@ func NewOperatorAction(
 func (oa *operatorAction) DeployOperator(info *OperatorConfig) error {
 	klog.Infof("create namespace chaos-mesh")
 	cmd := fmt.Sprintf(`kubectl create ns %s`, e2econst.ChaosMeshNamespace)
-	klog.Infof(cmd)
+	klog.Infof("%s", cmd)
 	output, err := exec.Command("/bin/sh", "-c", cmd).CombinedOutput()
 	if err != nil {
 		return errors.Errorf("failed to create namespace chaos-mesh: %v %s", err, string(output))
@@ -124,7 +124,7 @@ func (oa *operatorAction) UpgradeOperator(info *OperatorConfig) error {
 		return errors.Errorf("failed to deploy operator: %v, %s", err, string(res))
 	}
 	klog.Infof("start to waiting chaos-mesh ready")
-	err = wait.Poll(5*time.Second, 5*time.Minute, func() (done bool, err error) {
+	err = wait.PollUntilContextTimeout(context.Background(), 5*time.Second, 5*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		ls := &metav1.LabelSelector{
 			MatchLabels: map[string]string{
 				"app.kubernetes.io/instance": "chaos-mesh",
@@ -203,7 +203,7 @@ func (oa *operatorAction) restartComponent(info *OperatorConfig, prefix string)
 	}
 
 	klog.Infof("start to waiting chaos-mesh ready")
-	err = wait.Poll(5*time.Second, 5*time.Minute, func() (done bool, err error) {
+	err = wait.PollUntilContextTimeout(context.Background(), 5*time.Second, 5*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		pods, err := oa.kubeCli.CoreV1().Pods(info.Namespace).List(context.TODO(), metav1.ListOptions{LabelSelector: l.String()})
 		if err != nil {
 			klog.Errorf("get chaos-mesh pods: %v", err)
```

**File**: `e2e-test/e2e-gherkin/steps/podchaos_steps.go` (modified, +7/-7)
```diff
@@ -106,7 +106,7 @@ func (tc *TestContext) aChaosNamedIsAppliedToPodsWithLabel(action, name, labelKe
 }
 
 func (tc *TestContext) thePodNamedShouldEventuallyNotBeFound(name string) error {
-	return wait.Poll(5*time.Second, 5*time.Minute, func() (done bool, err error) {
+	return wait.PollUntilContextTimeout(context.Background(), 5*time.Second, 5*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		_, err = tc.KubeCli.CoreV1().Pods(tc.Namespace).Get(context.TODO(), name, metav1.GetOptions{})
 		if err != nil && apierrors.IsNotFound(err) {
 			return true, nil
@@ -144,7 +144,7 @@ func (tc *TestContext) atLeastOnePodShouldBeReplacedWithDifferentUID() error {
 			"app": "nginx",
 		}).String(),
 	}
-	return wait.Poll(5*time.Second, 5*time.Minute, func() (done bool, err error) {
+	return wait.PollUntilContextTimeout(context.Background(), 5*time.Second, 5*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		newPods, err := tc.KubeCli.CoreV1().Pods(tc.Namespace).List(context.TODO(), listOption)
 		if err != nil {
 			return false, nil
@@ -174,7 +174,7 @@ func (tc *TestContext) theChaosExperimentIsPaused(name string) error {
 		pollTimeout = 5 * time.Minute
 	}
 
-	err = wait.Poll(1*time.Second, pollTimeout, func() (done bool, err error) {
+	err = wait.PollUntilContextTimeout(context.Background(), 1*time.Second, pollTimeout, false, func(ctx context.Context) (done bool, err error) {
 		err = tc.Client.Get(ctx, client.ObjectKey{Namespace: tc.Namespace, Name: name}, chaos)
 		if err != nil {
 			return false, err
@@ -186,7 +186,7 @@ func (tc *TestContext) theChaosExperimentIsPaused(name string) error {
 	})
 
 	if isOneShot {
-		if err == wait.ErrWaitTimeout {
+		if err == context.DeadlineExceeded {
 			return nil
 		}
 		if err == nil {
@@ -209,7 +209,7 @@ func (tc *TestContext) noFurtherPodsShouldBeKilledWithinMinutes(duration int) er
 		return err
 	}
 
-	err = wait.Poll(5*time.Second, time.Duration(duration)*time.Minute, func() (done bool, err error) {
+	err = wait.PollUntilContextTimeout(context.Background(), 5*time.Second, time.Duration(duration)*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		newPods, err := tc.KubeCli.CoreV1().Pods(tc.Namespace).List(context.TODO(), listOption)
 		if err != nil {
 			return false, nil
@@ -219,7 +219,7 @@ func (tc *TestContext) noFurtherPodsShouldBeKilledWithinMinutes(duration int) er
 		}
 		return false, nil
 	})
-	if err == wait.ErrWaitTimeout {
+	if err == context.DeadlineExceeded {
 		return nil
 	}
 	if err == nil {
@@ -229,7 +229,7 @@ func (tc *TestContext) noFurtherPodsShouldBeKilledWithinMinutes(duration int) er
 }
 
 func (tc *TestContext) waitPodRunning(name string) error {
-	return wait.Poll(5*time.Second, 5*time.Minute, func() (done bool, err error) {
+	return wait.PollUntilContextTimeout(context.Background(), 5*time.Second, 5*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		pod, err := tc.KubeCli.CoreV1().Pods(tc.Namespace).Get(context.TODO(), name, metav1.GetOptions{})
 		if err != nil {
 			return false, nil
```

**File**: `e2e-test/e2e/chaos/dnschaos/dns.go` (modified, +2/-2)
```diff
@@ -81,7 +81,7 @@ func TestcaseDNSRandom(
 	framework.ExpectNoError(err, "create dns chaos error")
 
 	for _, domainName := range effectDomainNames {
-		err = wait.Poll(time.Second, 10*time.Second, func() (done bool, err error) {
+		err = wait.PollUntilContextTimeout(ctx, time.Second, 10*time.Second, false, func(ctx context.Context) (done bool, err error) {
 			// get IP of a non exists host, because chaos DNS server will return a random IP,
 			// so err should be nil
 			_, dnsErr := testDNSServer(c, port, domainName)
@@ -145,7 +145,7 @@ func TestcaseDNSError(
 	framework.ExpectNoError(err, "create dns chaos error")
 
 	for _, domainName := range effectDomainNames {
-		err = wait.Poll(time.Second, 10*time.Second, func() (done bool, err error) {
+		err = wait.PollUntilContextTimeout(ctx, time.Second, 10*time.Second, false, func(ctx context.Context) (done bool, err error) {
 			// get IP of some domain names, because chaos DNS server will return error,
 			// so err should not be nil
 			_, dnsErr := testDNSServer(c, port, domainName)
```

**File**: `e2e-test/e2e/chaos/httpchaos/http_abort.go` (modified, +20/-39)
```diff
@@ -20,7 +20,6 @@ import (
 	"time"
 
 	. "github.com/onsi/ginkgo/v2"
-	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/apimachinery/pkg/util/wait"
@@ -154,18 +153,12 @@ func TestcaseHttpAbortPauseAndUnPause(
 	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, true, func(ctx context.Context) (bool, error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
-
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllInjected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if err != nil {
+			return false, err
+		}
+
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllInjected, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		_, err := getPodHttpNoBody(c, port)
@@ -184,21 +177,15 @@ func TestcaseHttpAbortPauseAndUnPause(
 	framework.ExpectNoError(err, "pause chaos error")
 
 	By("waiting for assertion about pause")
-	err = wait.Poll(1*time.Second, 1*time.Minute, func() (done bool, err error) {
+	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
-
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllRecovered {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if err != nil {
+			return false, err
+		}
+
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllRecovered, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		return true, err
@@ -222,21 +209,15 @@ func TestcaseHttpAbortPauseAndUnPause(
 	framework.ExpectNoError(err, "resume chaos error")
 
 	By("assert that http abort is effective again")
-	err = wait.Poll(1*time.Second, 1*time.Minute, func() (done bool, err error) {
+	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
-
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllInjected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if err != nil {
+			return false, err
+		}
+
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllInjected, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		return true, err
```

**File**: `e2e-test/e2e/chaos/httpchaos/http_delay.go` (modified, +20/-39)
```diff
@@ -20,7 +20,6 @@ import (
 	"time"
 
 	. "github.com/onsi/ginkgo/v2"
-	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/apimachinery/pkg/util/wait"
@@ -165,18 +164,12 @@ func TestcaseHttpDelayDurationForATimePauseAndUnPause(
 	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, true, func(ctx context.Context) (bool, error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
-
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllInjected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if err != nil {
+			return false, err
+		}
+
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllInjected, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		_, dur, _ := getPodHttpDelay(c, port)
@@ -197,21 +190,15 @@ func TestcaseHttpDelayDurationForATimePauseAndUnPause(
 	framework.ExpectNoError(err, "pause chaos error")
 
 	By("waiting for assertion about pause")
-	err = wait.Poll(1*time.Second, 1*time.Minute, func() (done bool, err error) {
+	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
-
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllRecovered {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if err != nil {
+			return false, err
+		}
+
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllRecovered, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		return true, err
@@ -238,21 +225,15 @@ func TestcaseHttpDelayDurationForATimePauseAndUnPause(
 	framework.ExpectNoError(err, "resume chaos error")
 
 	By("assert that http delay is effective again")
-	err = wait.Poll(1*time.Second, 1*time.Minute, func() (done bool, err error) {
+	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
-
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllInjected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if err != nil {
+			return false, err
+		}
+
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllInjected, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		return true, err
```

**File**: `e2e-test/e2e/chaos/httpchaos/http_patch.go` (modified, +20/-39)
```diff
@@ -22,7 +22,6 @@ import (
 	"time"
 
 	. "github.com/onsi/ginkgo/v2"
-	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/apimachinery/pkg/util/wait"
@@ -255,18 +254,12 @@ func TestcaseHttpPatchPauseAndUnPause(
 	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, true, func(ctx context.Context) (bool, error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
-
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllInjected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if err != nil {
+			return false, err
+		}
+
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllInjected, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		resp, err := getPodHttp(c, port, secret, body)
@@ -296,21 +289,15 @@ func TestcaseHttpPatchPauseAndUnPause(
 	framework.ExpectNoError(err, "pause chaos error")
 
 	By("waiting for assertion about pause")
-	err = wait.Poll(1*time.Second, 1*time.Minute, func() (done bool, err error) {
+	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
-
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllRecovered {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if err != nil {
+			return false, err
+		}
+
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllRecovered, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		return true, err
@@ -346,21 +333,15 @@ func TestcaseHttpPatchPauseAndUnPause(
 	framework.ExpectNoError(err, "resume chaos error")
 
 	By("assert that http patch is effective again")
-	err = wait.Poll(1*time.Second, 1*time.Minute, func() (done bool, err error) {
+	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
-
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllInjected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if err != nil {
+			return false, err
+		}
+
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllInjected, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		return true, err
```

**File**: `e2e-test/e2e/chaos/httpchaos/http_replace.go` (modified, +35/-72)
```diff
@@ -21,7 +21,6 @@ import (
 	"time"
 
 	. "github.com/onsi/ginkgo/v2"
-	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/apimachinery/pkg/util/wait"
@@ -237,18 +236,12 @@ func TestcaseHttpReplacePauseAndUnPause(
 	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, true, func(ctx context.Context) (bool, error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
+		if err != nil {
+			return false, err
+		}
 
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllInjected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllInjected, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		resp, err := getPodHttp(c, port, secret, "")
@@ -278,21 +271,15 @@ func TestcaseHttpReplacePauseAndUnPause(
 	framework.ExpectNoError(err, "pause chaos error")
 
 	By("waiting for assertion about pause")
-	err = wait.Poll(1*time.Second, 1*time.Minute, func() (done bool, err error) {
+	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
+		if err != nil {
+			return false, err
+		}
 
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllRecovered {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllRecovered, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		return true, err
@@ -327,21 +314,15 @@ func TestcaseHttpReplacePauseAndUnPause(
 	framework.ExpectNoError(err, "resume chaos error")
 
 	By("assert that http replace is effective again")
-	err = wait.Poll(1*time.Second, 1*time.Minute, func() (done bool, err error) {
+	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
+		if err != nil {
+			return false, err
+		}
 
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllInjected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllInjected, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		return true, err
@@ -585,18 +566,12 @@ func TestcaseHttpReplaceBodyPauseAndUnPause(
 	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, true, func(ctx context.Context) (bool, error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
+		if err != nil {
+			return false, err
+		}
 
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllInjected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllInjected, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		resp, err := getPodHttp(c, port, secret, body)
@@ -626,21 +601,15 @@ func TestcaseHttpReplaceBodyPauseAndUnPause(
 	framework.ExpectNoError(err, "pause chaos error")
 
 	By("waiting for assertion about pause")
-	err = wait.Poll(1*time.Second, 1*time.Minute, func() (done bool, err error) {
+	err = wait.PollUntilContextTimeout(ctx, 1*time.Second, 1*time.Minute, false, func(ctx context.Context) (done bool, err error) {
 		chaos := &v1alpha1.HTTPChaos{}
 		err = cli.Get(ctx, chaosKey, chaos)
-		framework.ExpectNoError(err, "get http chaos error")
+		if err != nil {
+			return false, err
+		}
 
-		for _, c := range chaos.GetStatus().Conditions {
-			if c.Type == v1alpha1.ConditionAllRecovered {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			} else if c.Type == v1alpha1.ConditionSelected {
-				if c.Status != corev1.ConditionTrue {
-					return false, nil
-				}
-			}
+		if !util.ChaosConditionsTrue(chaos.GetStatus(), v1alpha1.ConditionAllRecovered, v1alpha1.ConditionSelected) {
+			return false, nil
 		}
 
 		return true, 
```

---

### Incident Patch 11: `19e7ec65` (2026-07-31)
**Commit Message**: fix(dashboard): TypeError crash on Workflow schedule details (#5034)

Co-authored-by: Yue Yang <[REDACTED_EMAIL]>
Signed-off-by: Hsiu-Chia Cheng <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -57,6 +57,7 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 - Fix nil pointer dereference in StressChaos Apply when Stressors is nil and StressngStressors is empty [#4936](https://github.com/chaos-mesh/chaos-mesh/pull/4936)
 - Fix dashboard subpath serving by adding base path to Vite config [#5016](https://github.com/chaos-mesh/chaos-mesh/pull/5016)
 - Optimize RBAC Token Generator copy buttons in Dashboard UI [#4941](https://github.com/chaos-mesh/chaos-mesh/pull/4941)
+- Fix a TypeError crash in the Dashboard UI when opening the details page of a Workflow-type schedule [#5034](https://github.com/chaos-mesh/chaos-mesh/pull/5034)
 
 ### Security
 
```

**File**: `ui/app/src/components/ObjectConfiguration/index.tsx` (modified, +2/-2)
```diff
@@ -110,13 +110,13 @@ const ObjectConfiguration: ReactFCWithChildren<ObjectConfigurationProps> = ({
           </Grid>
         )}
 
-        {(hasAddress || experiment.selector) && (
+        {(hasAddress || experiment?.selector) && (
           <Grid item xs={vertical ? 12 : 3}>
             <Typography variant="subtitle2" gutterBottom>
               {i18n('newE.steps.scope')}
             </Typography>
 
-            {experiment.selector && <Selector data={experiment.selector} />}
+            {experiment?.selector && <Selector data={experiment.selector} />}
 
             {hasAddress && (
               <Table>
```

---

### Incident Patch 12: `a5c127e3` (2026-07-30)
**Commit Message**: ui: fix broken copy button and add missing copy buttons in RBAC Token Generator (#4941)

Co-authored-by: Yue Yang <[REDACTED_EMAIL]>
Signed-off-by: Nidha Ahmed Mohammad <[REDACTED_EMAIL]>
Signed-off-by: Yue Yang <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -56,6 +56,7 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 - Add missing schedule types in dashboard collector [#4840](https://github.com/chaos-mesh/chaos-mesh/pull/4840)
 - Fix nil pointer dereference in StressChaos Apply when Stressors is nil and StressngStressors is empty [#4936](https://github.com/chaos-mesh/chaos-mesh/pull/4936)
 - Fix dashboard subpath serving by adding base path to Vite config [#5016](https://github.com/chaos-mesh/chaos-mesh/pull/5016)
+- Optimize RBAC Token Generator copy buttons in Dashboard UI [#4941](https://github.com/chaos-mesh/chaos-mesh/pull/4941)
 
 ### Security
 
```

**File**: `ui/app/src/components/RBACGenerator/CopyableCodeBlock.tsx` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+/*
+ * Copyright 2026 Chaos Mesh Authors.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ * http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ *
+ */
+import { Box, Button } from '@mui/material'
+import { styled } from '@mui/material/styles'
+
+interface CopyableCodeBlockProps {
+  text: string
+  copyLabel: string
+  onCopy: (text: string) => void
+  height?: number
+  singleLine?: boolean
+}
+
+const CodeBlock = styled('pre')(({ theme }) => ({
+  padding: theme.spacing(3),
+  background: theme.palette.background.default,
+  borderRadius: 4,
+}))
+
+interface CopyButtonProps {
+  singleLine: boolean
+}
+
+const CopyButton = styled(Box, {
+  shouldForwardProp: (prop) => prop !== 'singleLine',
+})<CopyButtonProps>(({ theme, singleLine }) => ({
+  position: 'absolute',
+  top: singleLine ? '50%' : theme.spacing(6),
+  right: singleLine ? theme.spacing(1) : theme.spacing(3),
+  transform: singleLine ? 'translateY(-50%)' : undefined,
+}))
+
+const CopyableCodeBlock = ({ text, copyLabel, onCopy, height, singleLine = false }: CopyableCodeBlockProps) => (
+  <Box position="relative">
+    <CodeBlock
+      style={
+        singleLine
+          ? { overflowX: 'auto', whiteSpace: 'pre', paddingRight: 80 }
+          : { height, overflow: height ? 'auto' : undefined, whiteSpace: 'pre-wrap' }
+      }
+    >
+      {text}
+    </CodeBlock>
+    <CopyButton singleLine={singleLine}>
+      <Button onClick={() => onCopy(text)}>{copyLabel}</Button>
+    </CopyButton>
+  </Box>
+)
+
+export default CopyableCodeBlock
```

**File**: `ui/app/src/components/RBACGenerator/index.tsx` (modified, +22/-40)
```diff
@@ -18,8 +18,7 @@ import { Stale } from '@/api/queryUtils'
 import Space from '@/mui-extends/Space'
 import { useGetCommonChaosAvailableNamespaces, useGetCommonRbacConfig } from '@/openapi'
 import { useComponentActions } from '@/zustand/component'
-import { Box, Button, Checkbox, FormControl, FormControlLabel, MenuItem, Typography } from '@mui/material'
-import { styled } from '@mui/material/styles'
+import { Box, Checkbox, FormControl, FormControlLabel, MenuItem, Typography } from '@mui/material'
 import copy from 'copy-text-to-clipboard'
 import { Field, Form, Formik } from 'formik'
 import _ from 'lodash'
@@ -29,27 +28,7 @@ import { useIntl } from 'react-intl'
 import { SelectField } from '@/components/FormField'
 import i18n from '@/components/T'
 
-const PREFIX = 'RBACGenerator'
-
-const classes = {
-  pre: `${PREFIX}-pre`,
-  copy: `${PREFIX}-copy`,
-}
-
-const Root = styled('div')(({ theme }) => ({
-  [`& .${classes.pre}`]: {
-    padding: theme.spacing(3),
-    background: theme.palette.background.default,
-    borderRadius: 4,
-    whiteSpace: 'pre-wrap',
-  },
-
-  [`& .${classes.copy}`]: {
-    position: 'absolute',
-    top: theme.spacing(6),
-    right: theme.spacing(3),
-  },
-}))
+import CopyableCodeBlock from './CopyableCodeBlock'
 
 const initialValues = { namespace: 'default', role: 'viewer', clustered: false }
 
@@ -100,10 +79,8 @@ const RBACGenerator = () => {
     })
   }
 
-  const copyRBAC = () => {
-    if (rbacConfig?.yaml) {
-      copy(rbacConfig.yaml, { target: containerRef.current! })
-
+  const copyCommand = (text: string) => {
+    if (text && copy(text, { target: containerRef.current! })) {
       setAlert({
         type: 'success',
         message: i18n('common.copied', intl),
@@ -112,7 +89,7 @@ const RBACGenerator = () => {
   }
 
   return (
-    <Root ref={containerRef}>
+    <div ref={containerRef}>
       <Space>
         <Typography variant="body2" color="textSecondary">
           {i18n('settings.addToken.generatorHelper')}
@@ -157,18 +134,17 @@ const RBACGenerator = () => {
         <Typography variant="body2" color="textSecondary">
           {i18n('settings.addToken.generatorHelper2')}
         </Typography>
-        <Box position="relative">
-          <pre className={classes.pre} style={{ height: 300, overflow: 'auto' }}>
-            {rbac.yaml}
-          </pre>
-          <Box className={classes.copy}>
-            <Button onClick={copyRBAC}>{i18n('common.copy')}</Button>
-          </Box>
-        </Box>
+        <CopyableCodeBlock text={rbac.yaml} copyLabel={i18n('common.copy')} onCopy={copyCommand} height={300} />
         <Typography variant="body2" color="textSecondary">
           {i18n('settings.addToken.generatorHelper3')}
         </Typography>
-        <pre className={classes.pre}>kubectl apply -f rbac.yaml</pre>
+
+        <CopyableCodeBlock
+          text="kubectl apply -f rbac.yaml"
+          copyLabel={i18n('common.copy')}
+          onCopy={copyCommand}
+          singleLine
+        />
 
         <Typography variant="body2" color="textSecondary">
           {i18n('settings.addToken.generatorHelperGetTokenHeader')}
@@ -177,14 +153,20 @@ const RBACGenerator = () => {
           <Typography variant="body2" color="textSecondary">
             {i18n('settings.addToken.generatorHelperGetTokenCase1')}
           </Typography>
-          <pre className={classes.pre}>{rbac.generateToken}</pre>
+          <CopyableCodeBlock
+            text={rbac.generateToken}
+            copyLabel={i18n('common.copy')}
+            onCopy={copyCommand}
+            singleLine
+          />
+
           <Typography variant="body2" color="textSecondary">
             {i18n('settings.addToken.generatorHelperGetTokenCase2')}
           </Typography>
-          <pre className={classes.pre}>{rbac.getSecret}</pre>
+          <CopyableCodeBlock text={rbac.getSecret} copyLabel={i18n('common.copy')} onCopy={copyCommand} singleLine />
         </Box>
       </Space>
-    </Root>
+    </div>
   )
 }
 
```

---

### Incident Patch 13: `37ef27f7` (2026-07-21)
**Commit Message**: fix(chaos-builder): close generated files to prevent handle leaks (#5040)

Signed-off-by: Akanksha Trehun <[REDACTED_EMAIL]>

**File**: `cmd/chaos-builder/main.go` (modified, +6/-0)
```diff
@@ -154,6 +154,7 @@ func init() {
 		os.Exit(1)
 	}
 	fmt.Fprint(file, implCode)
+	file.Close()
 
 	testCode += testInit
 	file, err = os.Create("./api/v1alpha1/zz_generated.chaosmesh_test.go")
@@ -162,34 +163,39 @@ func init() {
 		os.Exit(1)
 	}
 	fmt.Fprint(file, testCode)
+	file.Close()
 
 	file, err = os.Create("./api/v1alpha1/zz_generated.workflow.chaosmesh.go")
 	if err != nil {
 		log.Error(err, "fail to create file")
 		os.Exit(1)
 	}
 	fmt.Fprint(file, workflowGenerator.Render())
+	file.Close()
 
 	file, err = os.Create("./api/v1alpha1/zz_generated.workflow.chaosmesh_test.go")
 	if err != nil {
 		log.Error(err, "fail to create file")
 		os.Exit(1)
 	}
 	fmt.Fprint(file, workflowTestGenerator.Render())
+	file.Close()
 
 	file, err = os.Create("./api/v1alpha1/zz_generated.schedule.chaosmesh.go")
 	if err != nil {
 		log.Error(err, "fail to create file")
 		os.Exit(1)
 	}
 	fmt.Fprint(file, scheduleGenerator.Render())
+	file.Close()
 
 	file, err = os.Create("./ui/app/src/api/zz_generated.frontend.chaos-mesh.ts")
 	if err != nil {
 		log.Error(err, "fail to create file")
 		os.Exit(1)
 	}
 	fmt.Fprint(file, frontendGenerator.Render())
+	file.Close()
 }
 
 func getType(fset *token.FileSet, node ast.Node, comment *ast.Comment) (*ast.TypeSpec, error) {
```

---

### Incident Patch 14: `8b48c766` (2026-07-21)
**Commit Message**: docs(readme): add interactive Killercoda playground link to Quick start (#5021)

Assisted-by: Claude <[REDACTED_EMAIL]>

Signed-off-by: Saiyam Pathak <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-0)
```diff
@@ -56,6 +56,8 @@ You can get the full list of CRD objects and their specifications in the [Chaos
 
 See [Quick Start](https://chaos-mesh.org/docs/quick-start) and [Install Chaos Mesh using Helm](https://chaos-mesh.org/docs/production-installation-using-helm/).
 
+Prefer to try it without setting up a cluster? Run the [interactive Killercoda playground](https://killercoda.com/saiyampathak/scenario/chaos-mesh) in your browser: install Chaos Mesh on a real 2-node Kubernetes cluster, run PodChaos and NetworkChaos experiments, explore the Dashboard, and chain a Workflow - in about 20 minutes.
+
 ## Contributing
 
 See the [contributing guide](./CONTRIBUTING.md) and [development guide](https://chaos-mesh.org/docs/developer-guide-overview).
```

---

### Incident Patch 15: `a63c2055` (2026-07-07)
**Commit Message**: ci: extract Build Chaos Mesh Build Env step into composite action (#5000)

Signed-off-by: Siddhi Khandelwal <[REDACTED_EMAIL]>
Co-authored-by: Zhiqiang ZHOU <[REDACTED_EMAIL]>

**File**: `.github/actions/build-chaos-mesh-build-env/action.yml` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+name: 'Build Chaos Mesh Build Env'
+description: 'Builds the Chaos Mesh build environment image'
+inputs:
+  use-docker-cache:
+    description: 'Whether to use Docker cache during build'
+    required: false
+    default: 'false'
+runs:
+  using: "composite"
+  steps:
+    - name: Build Chaos Mesh Build Env
+      shell: bash
+      env:
+        IMAGE_BUILD_ENV_BUILD: ${{ github.event_name == 'pull_request' && contains(github.event.pull_request.labels.*.name, 'rebuild-build-env-image') || false }}
+        USE_DOCKER_CACHE: ${{ inputs.use-docker-cache }}
+      run: |
+        if [ "${IMAGE_BUILD_ENV_BUILD}" = "true" ] ; then
+          export IMAGE_BUILD_ENV_BUILD=1;
+        else
+          export IMAGE_BUILD_ENV_BUILD=0;
+        fi
+        if [ "${USE_DOCKER_CACHE}" = "true" ] ; then
+          make \
+            DOCKER_CACHE=1 \
+            DOCKER_CACHE_DIR="$GITHUB_WORKSPACE/cache" \
+            GO_BUILD_CACHE="$GITHUB_WORKSPACE/cache" \
+            image-build-env
+        else
+          make image-build-env
+        fi
```

**File**: `.github/workflows/ci.yml` (modified, +2/-10)
```diff
@@ -40,6 +40,7 @@ jobs:
               - go.*
               - '**.go'
               - 'helm/**'
+              - '.github/actions/build-chaos-mesh-build-env/**'
             ui:
               - 'ui/pnpm-lock.yaml'
               - '**.js'
@@ -60,16 +61,7 @@ jobs:
       - uses: actions/checkout@v7
 
       - name: Build Chaos Mesh Build Env
-        env:
-          IMAGE_BUILD_ENV_BUILD: ${{ contains(github.event.pull_request.labels.*.name, 'rebuild-build-env-image') }}
-        run: |
-          if [ "${IMAGE_BUILD_ENV_BUILD}" = "true" ] ; then
-            export IMAGE_BUILD_ENV_BUILD=1;
-          else
-            export IMAGE_BUILD_ENV_BUILD=0;
-          fi
-
-          make image-build-env
+        uses: ./.github/actions/build-chaos-mesh-build-env
 
       - name: Build Chaos Mesh Dev Env
         env:
```

**File**: `.github/workflows/e2e_test.yml` (modified, +3/-18)
```diff
@@ -33,6 +33,7 @@ jobs:
             test/integration_test/**
             .github/**
             !.github/workflows/e2e_test.yml
+            !.github/actions/build-chaos-mesh-build-env/**
       - name: Show outputs
         run: echo "${{ toJSON(steps.filter.outputs) }}"
 
@@ -45,15 +46,7 @@ jobs:
         uses: actions/checkout@v7
       - name: Build Chaos Mesh Build Env
         if: ${{ github.event.pull_request }}
-        env:
-          IMAGE_BUILD_ENV_BUILD: ${{ contains(github.event.pull_request.labels.*.name, 'rebuild-build-env-image') }}
-        run: |
-          if [ "${IMAGE_BUILD_ENV_BUILD}" = "true" ] ; then
-            export IMAGE_BUILD_ENV_BUILD=1;
-          else
-            export IMAGE_BUILD_ENV_BUILD=0;
-          fi
-          make image-build-env
+        uses: ./.github/actions/build-chaos-mesh-build-env
       - name: Build Chaos Mesh Dev Env
         if: ${{ github.event.pull_request }}
         env:
@@ -111,15 +104,7 @@ jobs:
         uses: actions/checkout@v7
       - name: Build Chaos Mesh Build Env
         if: ${{ github.event.pull_request }}
-        env:
-          IMAGE_BUILD_ENV_BUILD: ${{ contains(github.event.pull_request.labels.*.name, 'rebuild-build-env-image') }}
-        run: |
-          if [ "${IMAGE_BUILD_ENV_BUILD}" = "true" ] ; then
-            export IMAGE_BUILD_ENV_BUILD=1;
-          else
-            export IMAGE_BUILD_ENV_BUILD=0;
-          fi
-          make image-build-env
+        uses: ./.github/actions/build-chaos-mesh-build-env
       - name: Build Chaos Mesh Dev Env
         if: ${{ github.event.pull_request }}
         env:
```

**File**: `.github/workflows/integration_test.yml` (modified, +1/-10)
```diff
@@ -46,16 +46,7 @@ jobs:
 
       - name: Build Chaos Mesh Build Env
         if: ${{ github.event.pull_request }}
-        env:
-          IMAGE_BUILD_ENV_BUILD: ${{ contains(github.event.pull_request.labels.*.name, 'rebuild-build-env-image') }}
-        run: |
-          if [ "${IMAGE_BUILD_ENV_BUILD}" = "true" ] ; then
-            export IMAGE_BUILD_ENV_BUILD=1;
-          else
-            export IMAGE_BUILD_ENV_BUILD=0;
-          fi
-
-          make image-build-env
+        uses: ./.github/actions/build-chaos-mesh-build-env
 
       - name: Build Chaos Mesh Dev Env
         if: ${{ github.event.pull_request }}
```

**File**: `.github/workflows/upload_image_pr.yml` (modified, +3/-14)
```diff
@@ -29,20 +29,9 @@ jobs:
           DOCKER_CLI_EXPERIMENTAL=enabled docker buildx create --use --name chaos-mesh-builder
 
       - name: Build Chaos Mesh Build Env
-        env:
-          IMAGE_BUILD_ENV_BUILD: ${{ contains(github.event.pull_request.labels.*.name, 'rebuild-build-env-image') }}
-        run: |
-          if [ "${IMAGE_BUILD_ENV_BUILD}" = "true" ] ; then
-            export IMAGE_BUILD_ENV_BUILD=1;
-          else
-            export IMAGE_BUILD_ENV_BUILD=0;
-          fi
-
-          make \
-            DOCKER_CACHE=1 \
-            DOCKER_CACHE_DIR=$GITHUB_WORKSPACE/cache \
-            GO_BUILD_CACHE=$GITHUB_WORKSPACE/cache \
-            image-build-env
+        uses: ./.github/actions/build-chaos-mesh-build-env
+        with:
+          use-docker-cache: 'true'
 
       - name: Build Chaos Mesh Dev Env
         env:
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ For more information and how-to, see [RFC: Keep A Changelog](https://github.com/
 - Bump go to 1.25.8 [#4867](https://github.com/chaos-mesh/chaos-mesh/pull/4867)
 - Upgrade e2e k8s versions to 1.35.2, 1.34.5 and 1.33.9 [#4872](https://github.com/chaos-mesh/chaos-mesh/pull/4872)
 - Replace deprecated `wait.PollImmediate` with `wait.PollUntilContextTimeout` in e2e tests [#4910](https://github.com/chaos-mesh/chaos-mesh/pull/4910)
+- ci: extract Build Chaos Mesh Build Env step into composite action [#5000](https://github.com/chaos-mesh/chaos-mesh/pull/5000)
 
 ### Deprecated
 
```

#### Recent Merged Pull Requests:
- **PR #5098** (2026-09-29): fix(jvmchaos): Java25 compatibility. Upgrade byteman-helper to v4.0.27-12 (@bendi)
- **PR #5096** (closed): fix(selector): require containerNames when the target pod has several containers (@Yash121l)
- **PR #5092** (closed): fix(networkchaos): preserve overlapping selector roles (@bvolpato)
- **PR #5091** (closed): fix(httpchaos): retry missing TLS Secret data (@bvolpato)
- **PR #5090** (closed): fix(networkchaos): isolate generated rule names (@bvolpato)
- **PR #5089** (closed): fix(chaosdaemon): keep TC chains unique across devices (@bvolpato)
- **PR #5088** (closed): fix(stresschaos): roll back CPU on memory startup failure (@bvolpato)
- **PR #5087** (closed): fix(bpm): release identifiers after failed process starts (@bvolpato)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

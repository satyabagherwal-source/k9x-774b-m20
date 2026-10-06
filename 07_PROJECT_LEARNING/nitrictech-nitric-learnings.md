# Forensic Learning Record (Deep Inspection): nitrictech/nitric

> **Canonical Artifact**: `07_PROJECT_LEARNING/nitrictech-nitric-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nitrictech/nitric](https://github.com/nitrictech/nitric))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:43:07.557Z  
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

### Core Architecture Module: `cloud/aws/deploy/queue.go`
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

package deploy

import (
	"github.com/nitrictech/nitric/cloud/common/deploy/resources"
	common "github.com/nitrictech/nitric/cloud/common/deploy/tags"
	deploymentspb "github.com/nitrictech/nitric/core/pkg/proto/deployments/v1"
	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/sqs"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

// Queue - Implements deployments of Nitric Queues using AWS SQS
func (a *NitricAwsPulumiProvider) Queue(ctx *pulumi.Context, parent pulumi.Resource, name string, config *deploymentspb.Queue) error {
	opts := []pulumi.ResourceOption{pulumi.Parent(parent)}

	queue, err := sqs.NewQueue(ctx, name, &sqs.QueueArgs{
		Tags: pulumi.ToStringMap(common.Tags(a.StackId, name, resources.Queue)),
	}, opts...)
	if err != nil {
		return err
	}

	a.Queues[name] = queue

	return nil
}

```

### Core Architecture Module: `cloud/aws/deploytf/generated/queue/Queue.go`
```
package queue

import (
	_jsii_ "github.com/aws/jsii-runtime-go/runtime"
	_init_ "github.com/nitrictech/nitric/cloud/aws/deploytf/generated/queue/jsii"

	"github.com/aws/constructs-go/constructs/v10"
	"github.com/hashicorp/terraform-cdk-go/cdktf"
	"github.com/nitrictech/nitric/cloud/aws/deploytf/generated/queue/internal"
)

// Defines an Queue based on a Terraform module.
//
// Source at ./.nitric/modules/queue
type Queue interface {
	cdktf.TerraformModule
	// Experimental.
	CdktfStack() cdktf.TerraformStack
	// Experimental.
	ConstructNodeMetadata() *map[string]interface{}
	// Experimental.
	DependsOn() *[]*string
	// Experimental.
	SetDependsOn(val *[]*string)
	// Experimental.
	ForEach() cdktf.ITerraformIterator
	// Experimental.
	SetForEach(val cdktf.ITerraformIterator)
	// Experimental.
	Fqn() *string
	// Experimental.
	FriendlyUniqueId() *string
	// The tree node.
	Node() constructs.Node
	// Experimental.
	Providers() *[]interface{}
	QueueArnOutput() *string
	QueueName() *string
	SetQueueName(val *string)
	// Experimental.
	RawOverrides() interface{}
	// Experimental.
	SkipAssetCreationFromLocalModules() *bool
	// Experimental.
	Source() *string
	StackId() *string
	SetStackId(val *string)
	// Experimental.
	Version() *string
	// Experimental.
	AddOverride(path *string, value interface{})
	// Experimental.
	AddProvider(provider interface{})
	// Experimental.
	GetString(output *string) *string
	// Experimental.
	InterpolationForOutput(moduleOutput *string) cdktf.IResolvable
	// Overrides the auto-generated logical ID with a specific ID.
	// Experimental.
	OverrideLogicalId(newLogicalId *string)
	// Resets a previously passed logical Id to use the auto-generated logical id again.
	// Experimental.
	ResetOverrideLogicalId()
	SynthesizeAttributes() *map[string]interface{}
	SynthesizeHclAttributes() *map[string]interface{}
	// Experimental.
	ToHclTerraform() interface{}
	// Experimental.
	ToMetadata() interface{}
	// Returns a string representation of this construct.
	ToString() *string
	// Experimental.
	ToTerraform() interface{}
}

// The jsii proxy struct for Queue
type jsiiProxy_Queue struct {
	internal.Type__cdktfTerraformModule
}

func (j *jsiiProxy_Queue) CdktfStack() cdktf.TerraformStack {
	var returns cdktf.TerraformStack
	_jsii_.Get(
		j,
		"cdktfStack",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) ConstructNodeMetadata() *map[string]interface{} {
	var returns *map[string]interface{}
	_jsii_.Get(
		j,
		"constructNodeMetadata",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) DependsOn() *[]*string {
	var returns *[]*string
	_jsii_.Get(
		j,
		"dependsOn",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) ForEach() cdktf.ITerraformIterator {
	var returns cdktf.ITerraformIterator
	_jsii_.Get(
		j,
		"forEach",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) Fqn() *string {
	var returns *string
	_jsii_.Get(
		j,
		"fqn",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) FriendlyUniqueId() *string {
	var returns *string
	_jsii_.Get(
		j,
		"friendlyUniqueId",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) Node() constructs.Node {
	var returns constructs.Node
	_jsii_.Get(
		j,
		"node",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) Providers() *[]interface{} {
	var returns *[]interface{}
	_jsii_.Get(
		j,
		"providers",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) QueueArnOutput() *string {
	var returns *string
	_jsii_.Get(
		j,
		"queueArnOutput",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) QueueName() *string {
	var returns *string
	_jsii_.Get(
		j,
		"queueName",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) RawOverrides() interface{} {
	var returns interface{}
	_jsii_.Get(
		j,
		"rawOverrides",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) SkipAssetCreationFromLocalModules() *bool {
	var returns *bool
	_jsii_.Get(
		j,
		"skipAssetCreationFromLocalModules",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) Source() *string {
	var returns *string
	_jsii_.Get(
		j,
		"source",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) StackId() *string {
	var returns *string
	_jsii_.Get(
		j,
		"stackId",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) Version() *string {
	var returns *string
	_jsii_.Get(
		j,
		"version",
		&returns,
	)
	return returns
}


func NewQueue(scope constructs.Construct, id *string, config *QueueConfig) Queue {
	_init_.Initialize()

	if err := validateNewQueueParameters(scope, id, config); err != nil {
		panic(err)
	}
	j := jsiiProxy_Queue{}

	_jsii_.Create(
		"queue.Queue",
		[]interface{}{scope, id, config},
		&j,
	)

	return &j
}

func NewQueue_Override(q Queue, scope constructs.Construct, id *string, config *QueueConfig) {
	_init_.Initialize()

	_jsii_.Create(
		"queue.Queue",
		[]interface{}{scope, id, config},
		q,
	)
}

func (j *jsiiProxy_Queue)SetDependsOn(val *[]*string) {
	_jsii_.Set(
		j,
		"dependsOn",
		val,
	)
}

func (j *jsiiProxy_Queue)SetForEach(val cdktf.ITerraformIterator) {
	_jsii_.Set(
		j,
		"forEach",
		val,
	)
}

func (j *jsiiProxy_Queue)SetQueueName(val *string) {
	if err := j.validateSetQueueNameParameters(val); err != nil {
		panic(err)
	}
	_jsii_.Set(
		j,
		"queueName",
		val,
	)
}

func (j *jsiiProxy_Queue)SetStackId(val *string) {
	if err := j.validateSetStackIdParameters(val); err != nil {
		panic(err)
	}
	_jsii_.Set(
		j,
		"stackId",
		val,
	)
}

// Checks if `x` is a construct.
//
// Use this method instead of `instanceof` to properly detect `Construct`
// instances, even when the construct library is symlinked.
//
// Explanation: in JavaScript, multiple copies of the `constructs` library on
// disk are seen as independent, completely different libraries. As a
// consequence, the class `Construct` in each copy of the `constructs` library
// is seen as a different class, and an instance of one class will not test as
// `instanceof` the other class. `npm install` will not create installations
// like this, but users may manually symlink construct libraries together or
// use a monorepo tool: in those cases, multiple copies of the `constructs`
// library can be accidentally installed, and `instanceof` will behave
// unpredictably. It is safest to avoid using `instanceof`, and using
// this type-testing method instead.
//
// Returns: true if `x` is an object created from a class which extends `Construct`.
func Queue_IsConstruct(x interface{}) *bool {
	_init_.Initialize()

	if err := validateQueue_IsConstructParameters(x); err != nil {
		panic(err)
	}
	var returns *bool

	_jsii_.StaticInvoke(
		"queue.Queue",
		"isConstruct",
		[]interface{}{x},
		&returns,
	)

	return returns
}

// Experimental.
func Queue_IsTerraformElement(x interface{}) *bool {
	_init_.Initialize()

	if err := validateQueue_IsTerraformElementParameters(x); err != nil {
		panic(err)
	}
	var returns *bool

	_jsii_.StaticInvoke(
		"queue.Queue",
		"isTerraformElement",
		[]interface{}{x},
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) AddOverride(path *string, value interface{}) {
	if err := q.validateAddOverrideParameters(path, value); err != nil {
		panic(err)
	}
	_jsii_.InvokeVoid(
		q,
		"addOverride",
		[]interface{}{path, value},
	)
}

func (q *jsiiProxy_Queue) AddProvider(provider interface{}) {
	if err := q.validateAddProviderParameters(provider); err != nil {
		panic(err)
	}
	_jsii_.InvokeVoid(
		q,
		"addProvider",
		[]interface{}{provider},
	)
}

func (q *jsiiProxy_Queue) GetString(output *string) *string {
	if err := q.validateGetStringParameters(output); err != nil {
		panic(err)
	}
	var returns *string

	_jsii_.Invoke(
		q,
		"getString",
		[]interface{}{output},
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) InterpolationForOutput(moduleOutput *string) cdktf.IResolvable {
	if err := q.validateInterpolationForOutputParameters(moduleOutput); err != nil {
		panic(err)
	}
	var returns cdktf.IResolvable

	_jsii_.Invoke(
		q,
		"interpolationForOutput",
		[]interface{}{moduleOutput},
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) OverrideLogicalId(newLogicalId *string) {
	if err := q.validateOverrideLogicalIdParameters(newLogicalId); err != nil {
		panic(err)
	}
	_jsii_.InvokeVoid(
		q,
		"overrideLogicalId",
		[]interface{}{newLogicalId},
	)
}

func (q *jsiiProxy_Queue) ResetOverrideLogicalId() {
	_jsii_.InvokeVoid(
		q,
		"resetOverrideLogicalId",
		nil, // no parameters
	)
}

func (q *jsiiProxy_Queue) SynthesizeAttributes() *map[string]interface{} {
	var returns *map[string]interface{}

	_jsii_.Invoke(
		q,
		"synthesizeAttributes",
		nil, // no parameters
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) SynthesizeHclAttributes() *map[string]interface{} {
	var returns *map[string]interface{}

	_jsii_.Invoke(
		q,
		"synthesizeHclAttributes",
		nil, // no parameters
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) ToHclTerraform() interface{} {
	var returns interface{}

	_jsii_.Invoke(
		q,
		"toHclTerraform",
		nil, // no parameters
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) ToMetadata() interface{} {
	var returns interface{}

	_jsii_.Invoke(
		q,
		"toMetadata",
		nil, // no parameters
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) ToString() *string {
	var returns *string

	_jsii_.Invoke(
		q,
		"toString",
		nil, // no parameters
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) ToTerraform() interface{} {
	var returns interface{}

	_jsii_.Invoke(
		q,
		"toTerraform",
		nil, // no parameters
		&returns,
	)

	return returns
}


```

### Core Architecture Module: `cloud/aws/deploytf/generated/queue/QueueConfig.go`
```
package queue

import (
	"github.com/hashicorp/terraform-cdk-go/cdktf"
)

type QueueConfig struct {
	// Experimental.
	DependsOn *[]cdktf.ITerraformDependable `field:"optional" json:"dependsOn" yaml:"dependsOn"`
	// Experimental.
	ForEach cdktf.ITerraformIterator `field:"optional" json:"forEach" yaml:"forEach"`
	// Experimental.
	Providers *[]interface{} `field:"optional" json:"providers" yaml:"providers"`
	// Experimental.
	SkipAssetCreationFromLocalModules *bool `field:"optional" json:"skipAssetCreationFromLocalModules" yaml:"skipAssetCreationFromLocalModules"`
	// The name of the queue.
	QueueName *string `field:"required" json:"queueName" yaml:"queueName"`
	// The ID of the Nitric stack.
	StackId *string `field:"required" json:"stackId" yaml:"stackId"`
}


```

### Core Architecture Module: `cloud/aws/deploytf/generated/queue/Queue__checks.go`
```
//go:build !no_runtime_type_checking

package queue

import (
	"fmt"

	_jsii_ "github.com/aws/jsii-runtime-go/runtime"

	"github.com/aws/constructs-go/constructs/v10"
	"github.com/hashicorp/terraform-cdk-go/cdktf"
)

func (q *jsiiProxy_Queue) validateAddOverrideParameters(path *string, value interface{}) error {
	if path == nil {
		return fmt.Errorf("parameter path is required, but nil was provided")
	}

	if value == nil {
		return fmt.Errorf("parameter value is required, but nil was provided")
	}

	return nil
}

func (q *jsiiProxy_Queue) validateAddProviderParameters(provider interface{}) error {
	if provider == nil {
		return fmt.Errorf("parameter provider is required, but nil was provided")
	}
	switch provider.(type) {
	case cdktf.TerraformProvider:
		// ok
	case *cdktf.TerraformModuleProvider:
		provider := provider.(*cdktf.TerraformModuleProvider)
		if err := _jsii_.ValidateStruct(provider, func() string { return "parameter provider" }); err != nil {
			return err
		}
	case cdktf.TerraformModuleProvider:
		provider_ := provider.(cdktf.TerraformModuleProvider)
		provider := &provider_
		if err := _jsii_.ValidateStruct(provider, func() string { return "parameter provider" }); err != nil {
			return err
		}
	default:
		if !_jsii_.IsAnonymousProxy(provider) {
			return fmt.Errorf("parameter provider must be one of the allowed types: cdktf.TerraformProvider, *cdktf.TerraformModuleProvider; received %#v (a %T)", provider, provider)
		}
	}

	return nil
}

func (q *jsiiProxy_Queue) validateGetStringParameters(output *string) error {
	if output == nil {
		return fmt.Errorf("parameter output is required, but nil was provided")
	}

	return nil
}

func (q *jsiiProxy_Queue) validateInterpolationForOutputParameters(moduleOutput *string) error {
	if moduleOutput == nil {
		return fmt.Errorf("parameter moduleOutput is required, but nil was provided")
	}

	return nil
}

func (q *jsiiProxy_Queue) validateOverrideLogicalIdParameters(newLogicalId *string) error {
	if newLogicalId == nil {
		return fmt.Errorf("parameter newLogicalId is required, but nil was provided")
	}

	return nil
}

func validateQueue_IsConstructParameters(x interface{}) error {
	if x == nil {
		return fmt.Errorf("parameter x is required, but nil was provided")
	}

	return nil
}

func validateQueue_IsTerraformElementParameters(x interface{}) error {
	if x == nil {
		return fmt.Errorf("parameter x is required, but nil was provided")
	}

	return nil
}

func (j *jsiiProxy_Queue) validateSetQueueNameParameters(val *string) error {
	if val == nil {
		return fmt.Errorf("parameter val is required, but nil was provided")
	}

	return nil
}

func (j *jsiiProxy_Queue) validateSetStackIdParameters(val *string) error {
	if val == nil {
		return fmt.Errorf("parameter val is required, but nil was provided")
	}

	return nil
}

func validateNewQueueParameters(scope constructs.Construct, id *string, config *QueueConfig) error {
	if scope == nil {
		return fmt.Errorf("parameter scope is required, but nil was provided")
	}

	if id == nil {
		return fmt.Errorf("parameter id is required, but nil was provided")
	}

	if config == nil {
		return fmt.Errorf("parameter config is required, but nil was provided")
	}
	if err := _jsii_.ValidateStruct(config, func() string { return "parameter config" }); err != nil {
		return err
	}

	return nil
}


```

### Core Architecture Module: `cloud/aws/deploytf/generated/queue/Queue__no_checks.go`
```
//go:build no_runtime_type_checking

package queue

// Building without runtime type checking enabled, so all the below just return nil

func (q *jsiiProxy_Queue) validateAddOverrideParameters(path *string, value interface{}) error {
	return nil
}

func (q *jsiiProxy_Queue) validateAddProviderParameters(provider interface{}) error {
	return nil
}

func (q *jsiiProxy_Queue) validateGetStringParameters(output *string) error {
	return nil
}

func (q *jsiiProxy_Queue) validateInterpolationForOutputParameters(moduleOutput *string) error {
	return nil
}

func (q *jsiiProxy_Queue) validateOverrideLogicalIdParameters(newLogicalId *string) error {
	return nil
}

func validateQueue_IsConstructParameters(x interface{}) error {
	return nil
}

func validateQueue_IsTerraformElementParameters(x interface{}) error {
	return nil
}

func (j *jsiiProxy_Queue) validateSetQueueNameParameters(val *string) error {
	return nil
}

func (j *jsiiProxy_Queue) validateSetStackIdParameters(val *string) error {
	return nil
}

func validateNewQueueParameters(scope constructs.Construct, id *string, config *QueueConfig) error {
	return nil
}


```

### Core Architecture Module: `cloud/aws/deploytf/generated/queue/internal/types.go`
```
package internal
import (
	"github.com/hashicorp/terraform-cdk-go/cdktf"
)
type Type__cdktfTerraformModule = cdktf.TerraformModule

```

### Core Architecture Module: `cloud/aws/deploytf/generated/queue/jsii/jsii.go`
```
// Package jsii contains the functionaility needed for jsii packages to
// initialize their dependencies and themselves. Users should never need to use this package
// directly. If you find you need to - please report a bug at
// https://github.com/aws/jsii/issues/new/choose
package jsii

import (
	_          "embed"

	_jsii_     "github.com/aws/jsii-runtime-go/runtime"

	constructs "github.com/aws/constructs-go/constructs/v10/jsii"
	cdktf      "github.com/hashicorp/terraform-cdk-go/cdktf/jsii"
)

//go:embed queue-0.0.0.tgz
var tarball []byte

// Initialize loads the necessary packages in the @jsii/kernel to support the enclosing module.
// The implementation is idempotent (and hence safe to be called over and over).
func Initialize() {
	// Ensure all dependencies are initialized
	cdktf.Initialize()
	constructs.Initialize()

	// Load this library into the kernel
	_jsii_.Load("queue", "0.0.0", tarball)
}

```

### Core Architecture Module: `cloud/aws/deploytf/generated/queue/main.go`
```
// queue
package queue

import (
	"reflect"

	_jsii_ "github.com/aws/jsii-runtime-go/runtime"
)

func init() {
	_jsii_.RegisterClass(
		"queue.Queue",
		reflect.TypeOf((*Queue)(nil)).Elem(),
		[]_jsii_.Member{
			_jsii_.MemberMethod{JsiiMethod: "addOverride", GoMethod: "AddOverride"},
			_jsii_.MemberMethod{JsiiMethod: "addProvider", GoMethod: "AddProvider"},
			_jsii_.MemberProperty{JsiiProperty: "cdktfStack", GoGetter: "CdktfStack"},
			_jsii_.MemberProperty{JsiiProperty: "constructNodeMetadata", GoGetter: "ConstructNodeMetadata"},
			_jsii_.MemberProperty{JsiiProperty: "dependsOn", GoGetter: "DependsOn"},
			_jsii_.MemberProperty{JsiiProperty: "forEach", GoGetter: "ForEach"},
			_jsii_.MemberProperty{JsiiProperty: "fqn", GoGetter: "Fqn"},
			_jsii_.MemberProperty{JsiiProperty: "friendlyUniqueId", GoGetter: "FriendlyUniqueId"},
			_jsii_.MemberMethod{JsiiMethod: "getString", GoMethod: "GetString"},
			_jsii_.MemberMethod{JsiiMethod: "interpolationForOutput", GoMethod: "InterpolationForOutput"},
			_jsii_.MemberProperty{JsiiProperty: "node", GoGetter: "Node"},
			_jsii_.MemberMethod{JsiiMethod: "overrideLogicalId", GoMethod: "OverrideLogicalId"},
			_jsii_.MemberProperty{JsiiProperty: "providers", GoGetter: "Providers"},
			_jsii_.MemberProperty{JsiiProperty: "queueArnOutput", GoGetter: "QueueArnOutput"},
			_jsii_.MemberProperty{JsiiProperty: "queueName", GoGetter: "QueueName"},
			_jsii_.MemberProperty{JsiiProperty: "rawOverrides", GoGetter: "RawOverrides"},
			_jsii_.MemberMethod{JsiiMethod: "resetOverrideLogicalId", GoMethod: "ResetOverrideLogicalId"},
			_jsii_.MemberProperty{JsiiProperty: "skipAssetCreationFromLocalModules", GoGetter: "SkipAssetCreationFromLocalModules"},
			_jsii_.MemberProperty{JsiiProperty: "source", GoGetter: "Source"},
			_jsii_.MemberProperty{JsiiProperty: "stackId", GoGetter: "StackId"},
			_jsii_.MemberMethod{JsiiMethod: "synthesizeAttributes", GoMethod: "SynthesizeAttributes"},
			_jsii_.MemberMethod{JsiiMethod: "synthesizeHclAttributes", GoMethod: "SynthesizeHclAttributes"},
			_jsii_.MemberMethod{JsiiMethod: "toHclTerraform", GoMethod: "ToHclTerraform"},
			_jsii_.MemberMethod{JsiiMethod: "toMetadata", GoMethod: "ToMetadata"},
			_jsii_.MemberMethod{JsiiMethod: "toString", GoMethod: "ToString"},
			_jsii_.MemberMethod{JsiiMethod: "toTerraform", GoMethod: "ToTerraform"},
			_jsii_.MemberProperty{JsiiProperty: "version", GoGetter: "Version"},
		},
		func() interface{} {
			j := jsiiProxy_Queue{}
			_jsii_.InitJsiiProxy(&j.Type__cdktfTerraformModule)
			return &j
		},
	)
	_jsii_.RegisterStruct(
		"queue.QueueConfig",
		reflect.TypeOf((*QueueConfig)(nil)).Elem(),
	)
}

```

### Core Architecture Module: `cloud/aws/deploytf/queue.go`
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

package deploytf

import (
	"github.com/aws/jsii-runtime-go"
	"github.com/hashicorp/terraform-cdk-go/cdktf"
	"github.com/nitrictech/nitric/cloud/aws/deploytf/generated/queue"
	deploymentspb "github.com/nitrictech/nitric/core/pkg/proto/deployments/v1"
)

// // Queue - Deploy a Queue
func (a *NitricAwsTerraformProvider) Queue(stack cdktf.TerraformStack, name string, config *deploymentspb.Queue) error {
	a.Queues[name] = queue.NewQueue(stack, jsii.Sprintf("queue_%s", name), &queue.QueueConfig{
		QueueName: jsii.String(name),
		StackId:   a.Stack.StackIdOutput(),
	})

	return nil
}

```

### Core Architecture Module: `cloud/aws/runtime/queue/sqs.go`
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

package queue

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
	"github.com/aws/smithy-go"
	"github.com/google/uuid"
	"go.opentelemetry.io/contrib/instrumentation/github.com/aws/aws-sdk-go-v2/otelaws"
	"google.golang.org/grpc/codes"
	"google.golang.org/protobuf/proto"

	"github.com/nitrictech/nitric/cloud/aws/ifaces/sqsiface"
	"github.com/nitrictech/nitric/cloud/aws/runtime/env"
	"github.com/nitrictech/nitric/cloud/aws/runtime/resource"
	grpc_errors "github.com/nitrictech/nitric/core/pkg/grpc/errors"

	queuespb "github.com/nitrictech/nitric/core/pkg/proto/queues/v1"
)

type SQSQueueService struct {
	provider resource.AwsResourceResolver
	client   sqsiface.SQSAPI
}

var _ queuespb.QueuesServer = &SQSQueueService{}

// Get the URL for a given queue name
func (s *SQSQueueService) getUrlForQueueName(ctx context.Context, queue string) (*string, error) {
	queues, err := s.provider.GetResources(ctx, resource.AwsResource_Queue)
	if err != nil {
		return nil, fmt.Errorf("error retrieving queue list: %w", err)
	}

	queueArn, ok := queues[queue]

	if !ok {
		return nil, fmt.Errorf("arn for queue %s could not be determined", queue)
	}

	arnParts := strings.Split(queueArn.ARN, ":")
	accountId := arnParts[4]
	queueName := arnParts[5]

	out, err := s.client.GetQueueUrl(ctx, &sqs.GetQueueUrlInput{
		QueueName:              aws.String(queueName),
		QueueOwnerAWSAccountId: aws.String(accountId),
	})
	if err != nil {
		return nil, fmt.Errorf("encountered an error retrieving the queue list: %w", err)
	}

	return out.QueueUrl, nil
}

func isSQSAccessDeniedErr(err error) bool {
	var opErr *smithy.OperationError
	if errors.As(err, &opErr) {
		return opErr.Service() == "SQS" && strings.Contains(opErr.Unwrap().Error(), "AccessDenied")
	}
	return false
}

func (s *SQSQueueService) Enqueue(ctx context.Context, req *queuespb.QueueEnqueueRequest) (*queuespb.QueueEnqueueResponse, error) {
	newErr := grpc_errors.ErrorsWithScope("SQSQueueService.Enqueue")

	requestIdMap := map[string]*queuespb.QueueMessage{}

	if url, err := s.getUrlForQueueName(ctx, req.QueueName); err == nil {
		entries := make([]types.SendMessageBatchRequestEntry, 0)

		for _, sendTaskReq := range req.Messages {
			t := sendTaskReq

			// generate a unique Id for each task
			id := uuid.New()
			requestIdMap[id.String()] = t

			if bytes, err := proto.Marshal(t); err == nil {
				msgString := base64.StdEncoding.EncodeToString(bytes)

				entries = append(entries, types.SendMessageBatchRequestEntry{
					Id:          aws.String(id.String()),
					MessageBody: aws.String(msgString),
				})
			} else {
				return nil, newErr(
					codes.Internal,
					"error marshalling task to JSON",
					err,
				)
			}
		}

		if out, err := s.client.SendMessageBatch(ctx, &sqs.SendMessageBatchInput{
			Entries:  entries,
			QueueUrl: url,
		}); err == nil {
			// process out Failed messages to return to the user...
			failedTasks := make([]*queuespb.FailedEnqueueMessage, 0, len(out.Failed))
			for _, failed := range out.Failed {
				for id, e := range requestIdMap {
					if id == *failed.Id {
						failedTasks = append(failedTasks, &queuespb.FailedEnqueueMessage{
							Message: e,
							Details: *failed.Message,
						})
						// continue processing failed messages
						break
					}
				}
			}

			return &queuespb.QueueEnqueueResponse{
				FailedMessages: failedTasks,
			}, nil
		} else {
			if isSQSAccessDeniedErr(err) {
				return nil, newErr(
					codes.PermissionDenied,
					"unable to send tasks to queue, have you requested access to this queue?",
					err,
				)
			}

			return nil, newErr(
				codes.Internal,
				"error sending tasks",
				err,
			)
		}
	} else {
		return nil, newErr(
			codes.NotFound,
			"unable to find queue",
			err,
		)
	}
}

func (s *SQSQueueService) Dequeue(ctx context.Context, req *queuespb.QueueDequeueRequest) (*queuespb.QueueDequeueResponse, error) {
	newErr := grpc_errors.ErrorsWithScope("SQSQueueService.Dequeue")

	if url, err := s.getUrlForQueueName(ctx, req.QueueName); err == nil {
		req := sqs.ReceiveMessageInput{
			MaxNumberOfMessages: req.Depth,
			MessageAttributeNames: []string{
				string(types.QueueAttributeNameAll),
			},
			QueueUrl: url,
			// VisibilityTimeout:       nil,
			// WaitTimeSeconds:         nil,
		}

		res, err := s.client.ReceiveMessage(ctx, &req)
		if err != nil {
			if isSQSAccessDeniedErr(err) {
				return nil, newErr(
					codes.PermissionDenied,
					"unable to receive task(s) from queue, have you requested access to this queue?",
					err,
				)
			}

			return nil, newErr(
				codes.Internal,
				"failed to retrieve message",
				err,
			)
		}

		tasks := make([]*queuespb.DequeuedMessage, 0, len(res.Messages))
		for _, m := range res.Messages {
			var queueMessage queuespb.QueueMessage

			msgBytes, err := base64.StdEncoding.DecodeString(*m.Body)
			if err != nil {
				return nil, newErr(
					codes.Internal,
					"failed unmarshalling body",
					err,
				)
			}

			err = proto.Unmarshal(msgBytes, &queueMessage)
			if err != nil {
				return nil, newErr(
					codes.Internal,
					"failed unmarshalling body",
					err,
				)
			}

			tasks = append(tasks, &queuespb.DequeuedMessage{
				LeaseId: *m.ReceiptHandle,
				Message: &queueMessage,
			})
		}

		return &queuespb.QueueDequeueResponse{
			Messages: tasks,
		}, nil
	} else {
		return nil, newErr(
			codes.NotFound,
			"unable to find queue",
			err,
		)
	}
}

// Completes a previously popped queue item
func (s *SQSQueueService) Complete(ctx context.Context, req *queuespb.QueueCompleteRequest) (*queuespb.QueueCompleteResponse, error) {
	newErr := grpc_errors.ErrorsWithScope("SQSQueueService.Complete")

	if url, err := s.getUrlForQueueName(ctx, req.QueueName); err == nil {
		req := sqs.DeleteMessageInput{
			QueueUrl:      url,
			ReceiptHandle: aws.String(req.LeaseId),
		}

		if _, err := s.client.DeleteMessage(ctx, &req); err != nil {
			return nil, newErr(
				codes.Internal,
				"failed to dequeue task",
				err,
			)
		}

		return &queuespb.QueueCompleteResponse{}, nil
	} else {
		return nil, newErr(
			codes.NotFound,
			"unable to find queue",
			err,
		)
	}
}

func New(provider resource.AwsResourceResolver) (queuespb.QueuesServer, error) {
	awsRegion := env.AWS_REGION.String()

	cfg, sessionError := config.LoadDefaultConfig(context.TODO(), config.WithRegion(awsRegion))
	if sessionError != nil {
		return nil, fmt.Errorf("error creating new AWS session %w", sessionError)
	}

	otelaws.AppendMiddlewares(&cfg.APIOptions)

	client := sqs.NewFromConfig(cfg)

	return &SQSQueueService{
		client:   client,
		provider: provider,
	}, nil
}

func NewWithClient(provider resource.AwsResourceResolver, client sqsiface.SQSAPI) queuespb.QueuesServer {
	return &SQSQueueService{
		client:   client,
		provider: provider,
	}
}

```

### Core Architecture Module: `cloud/azure/deploy/queue.go`
```
package deploy

import (
	deploymentspb "github.com/nitrictech/nitric/core/pkg/proto/deployments/v1"
	"github.com/pulumi/pulumi-azure-native-sdk/storage"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func (a *NitricAzurePulumiProvider) Queue(ctx *pulumi.Context, parent pulumi.Resource, name string, config *deploymentspb.Queue) error {
	var err error
	opts := []pulumi.ResourceOption{pulumi.Parent(parent)}

	a.Queues[name], err = storage.NewQueue(ctx, ResourceName(ctx, name, StorageQueueRT), &storage.QueueArgs{
		AccountName:       a.StorageAccount.Name,
		ResourceGroupName: a.ResourceGroup.Name,
	}, opts...)

	return err
}

// Copyright 2021 Nitric Technologies Pty Ltd.
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

// package queue

// import (
// 	"github.com/nitrictech/nitric/cloud/azure/deploy/utils"
// 	"github.com/pulumi/pulumi-azure-native-sdk/resources"
// 	"github.com/pulumi/pulumi-azure-native-sdk/storage"
// 	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
// )

// // Topics
// type AzureStorageQueue struct {
// 	pulumi.ResourceState

// 	Name          string
// 	Account       *storage.StorageAccount
// 	ResourceGroup *resources.ResourceGroup
// 	Queue         *storage.Queue
// }

// type AzureStorageQueueArgs struct {
// 	Account       *storage.StorageAccount
// 	ResourceGroup *resources.ResourceGroup
// }

// func NewAzureStorageQueue(ctx *pulumi.Context, name string, args *AzureStorageQueueArgs, opts ...pulumi.ResourceOption) (*AzureStorageQueue, error) {
// 	res := &AzureStorageQueue{
// 		Name:          name,
// 		Account:       args.Account,
// 		ResourceGroup: args.ResourceGroup,
// 	}

// 	err := ctx.RegisterComponentResource("nitric:queue:AzureStorageQueue", name, res, opts...)
// 	if err != nil {
// 		return nil, err
// 	}

// 	res.Queue, err = storage.NewQueue(ctx, utils.ResourceName(ctx, name, utils.StorageQueueRT), &storage.QueueArgs{
// 		AccountName:       args.Account.Name,
// 		ResourceGroupName: args.ResourceGroup.Name,
// 	})
// 	if err != nil {
// 		return nil, err
// 	}

// 	return res, nil
// }

```

### Core Architecture Module: `cloud/azure/deploytf/generated/queue/Queue.go`
```
package queue

import (
	_jsii_ "github.com/aws/jsii-runtime-go/runtime"
	_init_ "github.com/nitrictech/nitric/cloud/azure/deploytf/generated/queue/jsii"

	"github.com/aws/constructs-go/constructs/v10"
	"github.com/hashicorp/terraform-cdk-go/cdktf"
	"github.com/nitrictech/nitric/cloud/azure/deploytf/generated/queue/internal"
)

// Defines an Queue based on a Terraform module.
//
// Source at ./.nitric/modules/queue
type Queue interface {
	cdktf.TerraformModule
	// Experimental.
	CdktfStack() cdktf.TerraformStack
	// Experimental.
	ConstructNodeMetadata() *map[string]interface{}
	// Experimental.
	DependsOn() *[]*string
	// Experimental.
	SetDependsOn(val *[]*string)
	// Experimental.
	ForEach() cdktf.ITerraformIterator
	// Experimental.
	SetForEach(val cdktf.ITerraformIterator)
	// Experimental.
	Fqn() *string
	// Experimental.
	FriendlyUniqueId() *string
	Name() *string
	SetName(val *string)
	// The tree node.
	Node() constructs.Node
	// Experimental.
	Providers() *[]interface{}
	QueueIdOutput() *string
	// Experimental.
	RawOverrides() interface{}
	// Experimental.
	SkipAssetCreationFromLocalModules() *bool
	// Experimental.
	Source() *string
	StorageAccountName() *string
	SetStorageAccountName(val *string)
	Tags() *map[string]*string
	SetTags(val *map[string]*string)
	// Experimental.
	Version() *string
	// Experimental.
	AddOverride(path *string, value interface{})
	// Experimental.
	AddProvider(provider interface{})
	// Experimental.
	GetString(output *string) *string
	// Experimental.
	InterpolationForOutput(moduleOutput *string) cdktf.IResolvable
	// Overrides the auto-generated logical ID with a specific ID.
	// Experimental.
	OverrideLogicalId(newLogicalId *string)
	// Resets a previously passed logical Id to use the auto-generated logical id again.
	// Experimental.
	ResetOverrideLogicalId()
	SynthesizeAttributes() *map[string]interface{}
	SynthesizeHclAttributes() *map[string]interface{}
	// Experimental.
	ToHclTerraform() interface{}
	// Experimental.
	ToMetadata() interface{}
	// Returns a string representation of this construct.
	ToString() *string
	// Experimental.
	ToTerraform() interface{}
}

// The jsii proxy struct for Queue
type jsiiProxy_Queue struct {
	internal.Type__cdktfTerraformModule
}

func (j *jsiiProxy_Queue) CdktfStack() cdktf.TerraformStack {
	var returns cdktf.TerraformStack
	_jsii_.Get(
		j,
		"cdktfStack",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) ConstructNodeMetadata() *map[string]interface{} {
	var returns *map[string]interface{}
	_jsii_.Get(
		j,
		"constructNodeMetadata",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) DependsOn() *[]*string {
	var returns *[]*string
	_jsii_.Get(
		j,
		"dependsOn",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) ForEach() cdktf.ITerraformIterator {
	var returns cdktf.ITerraformIterator
	_jsii_.Get(
		j,
		"forEach",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) Fqn() *string {
	var returns *string
	_jsii_.Get(
		j,
		"fqn",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) FriendlyUniqueId() *string {
	var returns *string
	_jsii_.Get(
		j,
		"friendlyUniqueId",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) Name() *string {
	var returns *string
	_jsii_.Get(
		j,
		"name",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) Node() constructs.Node {
	var returns constructs.Node
	_jsii_.Get(
		j,
		"node",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) Providers() *[]interface{} {
	var returns *[]interface{}
	_jsii_.Get(
		j,
		"providers",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) QueueIdOutput() *string {
	var returns *string
	_jsii_.Get(
		j,
		"queueIdOutput",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) RawOverrides() interface{} {
	var returns interface{}
	_jsii_.Get(
		j,
		"rawOverrides",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) SkipAssetCreationFromLocalModules() *bool {
	var returns *bool
	_jsii_.Get(
		j,
		"skipAssetCreationFromLocalModules",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) Source() *string {
	var returns *string
	_jsii_.Get(
		j,
		"source",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) StorageAccountName() *string {
	var returns *string
	_jsii_.Get(
		j,
		"storageAccountName",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) Tags() *map[string]*string {
	var returns *map[string]*string
	_jsii_.Get(
		j,
		"tags",
		&returns,
	)
	return returns
}

func (j *jsiiProxy_Queue) Version() *string {
	var returns *string
	_jsii_.Get(
		j,
		"version",
		&returns,
	)
	return returns
}


func NewQueue(scope constructs.Construct, id *string, config *QueueConfig) Queue {
	_init_.Initialize()

	if err := validateNewQueueParameters(scope, id, config); err != nil {
		panic(err)
	}
	j := jsiiProxy_Queue{}

	_jsii_.Create(
		"queue.Queue",
		[]interface{}{scope, id, config},
		&j,
	)

	return &j
}

func NewQueue_Override(q Queue, scope constructs.Construct, id *string, config *QueueConfig) {
	_init_.Initialize()

	_jsii_.Create(
		"queue.Queue",
		[]interface{}{scope, id, config},
		q,
	)
}

func (j *jsiiProxy_Queue)SetDependsOn(val *[]*string) {
	_jsii_.Set(
		j,
		"dependsOn",
		val,
	)
}

func (j *jsiiProxy_Queue)SetForEach(val cdktf.ITerraformIterator) {
	_jsii_.Set(
		j,
		"forEach",
		val,
	)
}

func (j *jsiiProxy_Queue)SetName(val *string) {
	if err := j.validateSetNameParameters(val); err != nil {
		panic(err)
	}
	_jsii_.Set(
		j,
		"name",
		val,
	)
}

func (j *jsiiProxy_Queue)SetStorageAccountName(val *string) {
	if err := j.validateSetStorageAccountNameParameters(val); err != nil {
		panic(err)
	}
	_jsii_.Set(
		j,
		"storageAccountName",
		val,
	)
}

func (j *jsiiProxy_Queue)SetTags(val *map[string]*string) {
	if err := j.validateSetTagsParameters(val); err != nil {
		panic(err)
	}
	_jsii_.Set(
		j,
		"tags",
		val,
	)
}

// Checks if `x` is a construct.
//
// Use this method instead of `instanceof` to properly detect `Construct`
// instances, even when the construct library is symlinked.
//
// Explanation: in JavaScript, multiple copies of the `constructs` library on
// disk are seen as independent, completely different libraries. As a
// consequence, the class `Construct` in each copy of the `constructs` library
// is seen as a different class, and an instance of one class will not test as
// `instanceof` the other class. `npm install` will not create installations
// like this, but users may manually symlink construct libraries together or
// use a monorepo tool: in those cases, multiple copies of the `constructs`
// library can be accidentally installed, and `instanceof` will behave
// unpredictably. It is safest to avoid using `instanceof`, and using
// this type-testing method instead.
//
// Returns: true if `x` is an object created from a class which extends `Construct`.
func Queue_IsConstruct(x interface{}) *bool {
	_init_.Initialize()

	if err := validateQueue_IsConstructParameters(x); err != nil {
		panic(err)
	}
	var returns *bool

	_jsii_.StaticInvoke(
		"queue.Queue",
		"isConstruct",
		[]interface{}{x},
		&returns,
	)

	return returns
}

// Experimental.
func Queue_IsTerraformElement(x interface{}) *bool {
	_init_.Initialize()

	if err := validateQueue_IsTerraformElementParameters(x); err != nil {
		panic(err)
	}
	var returns *bool

	_jsii_.StaticInvoke(
		"queue.Queue",
		"isTerraformElement",
		[]interface{}{x},
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) AddOverride(path *string, value interface{}) {
	if err := q.validateAddOverrideParameters(path, value); err != nil {
		panic(err)
	}
	_jsii_.InvokeVoid(
		q,
		"addOverride",
		[]interface{}{path, value},
	)
}

func (q *jsiiProxy_Queue) AddProvider(provider interface{}) {
	if err := q.validateAddProviderParameters(provider); err != nil {
		panic(err)
	}
	_jsii_.InvokeVoid(
		q,
		"addProvider",
		[]interface{}{provider},
	)
}

func (q *jsiiProxy_Queue) GetString(output *string) *string {
	if err := q.validateGetStringParameters(output); err != nil {
		panic(err)
	}
	var returns *string

	_jsii_.Invoke(
		q,
		"getString",
		[]interface{}{output},
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) InterpolationForOutput(moduleOutput *string) cdktf.IResolvable {
	if err := q.validateInterpolationForOutputParameters(moduleOutput); err != nil {
		panic(err)
	}
	var returns cdktf.IResolvable

	_jsii_.Invoke(
		q,
		"interpolationForOutput",
		[]interface{}{moduleOutput},
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) OverrideLogicalId(newLogicalId *string) {
	if err := q.validateOverrideLogicalIdParameters(newLogicalId); err != nil {
		panic(err)
	}
	_jsii_.InvokeVoid(
		q,
		"overrideLogicalId",
		[]interface{}{newLogicalId},
	)
}

func (q *jsiiProxy_Queue) ResetOverrideLogicalId() {
	_jsii_.InvokeVoid(
		q,
		"resetOverrideLogicalId",
		nil, // no parameters
	)
}

func (q *jsiiProxy_Queue) SynthesizeAttributes() *map[string]interface{} {
	var returns *map[string]interface{}

	_jsii_.Invoke(
		q,
		"synthesizeAttributes",
		nil, // no parameters
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) SynthesizeHclAttributes() *map[string]interface{} {
	var returns *map[string]interface{}

	_jsii_.Invoke(
		q,
		"synthesizeHclAttributes",
		nil, // no parameters
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) ToHclTerraform() interface{} {
	var returns interface{}

	_jsii_.Invoke(
		q,
		"toHclTerraform",
		nil, // no parameters
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) ToMetadata() interface{} {
	var returns interface{}

	_jsii_.Invoke(
		q,
		"toMetadata",
		nil, // no parameters
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) ToString() *string {
	var returns *string

	_jsii_.Invoke(
		q,
		"toString",
		nil, // no parameters
		&returns,
	)

	return returns
}

func (q *jsiiProxy_Queue) ToTerraform() interface{} {
	var returns interface{}

	_jsii_.Invoke(
		q,
		"toTerraform",
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
 
+The deployment framework automatically calls your method for each resource of this type. Follow the **one-file-per-resource** pattern used by existing providers - see [cloud/aws/deploy/queue.go](https://github.com/nitrictech/nitric/blob/main/cloud/aws/deploy/queue.go) (simple) or [cloud/aws/deploy/api.go](https://github.com/nitrictech/nitric/blob/main/cloud/aws/deploy/api.go) (complex) for examples.
+
+You'll also need to add a field to your provider struct in `deploy/deploy.go`:
+
+```go title:deploy/deploy.go
+type NitricYourCloudProvider struct {
+    // ... existing fields ...
+    YourResources map[string]*YourResourceType
+}
+```
+
 ### Implement gRPC Runtime Service
 
 If your resource has runtime operations (e.g., read/write), first create a service proto in `nitric/proto/yourresource/v1/yourresource.proto`:
```

---

### Incident Patch 3: `7c408247` (2025-12-16)
**Commit Message**: docs: add custom resource extension guide (#902)

* docs: add custom resource extension guide

* chore: add valid words to dictionary

* chore: fix proto directory and add clone instructions

* chore: add runtime gRPC service implementation example

---------

Co-authored-by: Rak Siva <[REDACTED_EMAIL]>

**File**: `docs/dictionary.txt` (modified, +4/-0)
```diff
@@ -6,6 +6,7 @@ APIs
 ARNs
 BoltDB
 backends
+cli
 CLI
 CLI's
 CDKs
@@ -31,6 +32,8 @@ SNS
 SQS
 UUID
 UUIDs
+enum
+ENUM
 api
 apis
 args
@@ -120,6 +123,7 @@ GraphQL
 graphql
 CDK
 TLDR
+oneof
 BYO
 webhook
 utils
```

**File**: `docs/docs/providers/custom/adding-resource-types.mdx` (added, +471/-0)
```diff
@@ -0,0 +1,471 @@
+---
+description: 'How to add new resource types to the Nitric CLI'
+---
+
+# Adding New Resource Types
+
+This guide explains how to extend the Nitric CLI to support custom resource types, covering both deployment (`nitric up`) and local development (`nitric start`).
+
+<Note>
+  This guide is for contributors who want to add entirely new resource types to
+  Nitric's core. If you want to replace existing resources in a provider or
+  build a custom provider, see [Extending Standard Providers](./extend) or
+  [Building Custom Providers](./create).
+</Note>
+
+## Overview
+
+Adding a new resource type to Nitric requires changes across three repositories:
+
+1. **nitric/core** - Proto definitions and gRPC service interfaces
+2. **nitric/cli** - Resource collection, spec building, and local development
+3. **Your custom provider** - Cloud-specific deployment logic
+
+## Architecture
+
+The following diagram shows how resources flow through the Nitric system:
+
+```mermaid
+flowchart TD
+    AppCode["Your App Code<br>(SDK calls)"]
+    Collector["Nitric CLI<br>(Collector)"]
+    Spec["Deployment Spec<br>(protobuf)"]
+    Provider["Provider<br>(gRPC Server)"]
+
+    AppCode -->|gRPC| Collector
+    Collector -->|Build| Spec
+    Spec -->|Deploy| Provider
+
+classDef default line-height:1;
+classDef edgeLabel line-height:2;
+```
+
+Your application code makes SDK calls that are sent via gRPC to the Nitric CLI's collector. The collector builds a deployment spec (protobuf), which is then sent to your provider for cloud-specific resource creation.
+
+## Part 1: Nitric Core Changes
+
+The first step is defining your new resource type in the [nitric/core](https://github.com/nitrictech/nitric) repository.
+
+### Clone the Repository
+
+```bash
+git clone https://github.com/nitrictech/nitric.git
+```
+
+### Add Resource Type Enum
+
+The proto source files are in `nitric/proto/`, and Go code is generated into `core/pkg/proto/`.
+
+In `nitric/proto/resources/v1/resources.proto`, add your new resource type to the `ResourceType` enum:
+
+```protobuf title:nitric/proto/resources/v1/resources.proto
+enum ResourceType {
+  // ... existing types ...
+  YourResourceType = N;  // Use the next available number
+}
+```
+
+### Define Resource Proto Message
+
+In the same file, add a message for your resource configuration:
+
+```protobuf title:nitric/proto/resources/v1/resources.proto
+message YourResource {
+  // Resource-specific configuration fields
+  string some_config = 1;
+}
+```
+
+### Update ResourceDeclareRequest
+
+Add your resource to the `ResourceDeclareRequest` oneof:
+
+```protobuf title:nitric/proto/resources/v1/resources.proto
+message ResourceDeclareRequest {
+  ResourceIdentifier id = 1;
+  oneof config {
+    // ... existing configs ...
+    YourResource your_resource = N;
+  }
+}
+```
+
+### Add Deployment Resource
+
+If your resource needs deployment-specific configuration, update `nitric/proto/deployments/v1/deployments.proto`:
+
+```protobuf title:nitric/proto/deployments/v1/deployments.proto
+message YourDeploymentResource {
+  // Deployment-specific fields (image URIs, targets, etc.)
+}
+
+message Resource {
+  // In the config oneof:
+  oneof config {
+    // ... existing configs ...
+    YourDeploymentResource your_resource = N;
+  }
+}
+```
+
+### Regenerate Proto Code
+
+Run the proto generation in the `core` directory to create Go code from your proto definitions:
+
+```bash
+cd core && make generate-proto
+```
+
+## Part 2: CLI Changes - Resource Collection
+
+These changes enable `nitric up` to collect your new resource type from application code.
+
+### Update ServiceRequirements Struct
+
+In `pkg/collector/service.go`, add a field for your new resource in the `ServiceRequirements` struct:
+
+```go title:pkg/collector/service.go
+type ServiceRequirements struct {
+    // ... existing fields ...
+
+    yourResources map[string]*resourcespb.YourResource
+}
+```
+
+### Handle Resource Declaration
+
+Add a case in the `Declare()` method to handle your resource type:
+
+```go title:pkg/collector/service.go
+func (s *ServiceRequirements) Declare(ctx context.Context, req *resourcespb.ResourceDeclareRequest) (*resourcespb.ResourceDeclareResponse, error) {
+    s.resourceLock.Lock()
+    defer s.resourceLock.Unlock()
+
+    // ... existing validation ...
+
+    switch req.Id.Type {
+    // ... existing cases ...
+
+    case resourcespb.ResourceType_YourResourceType:
+        s.yourResources[req.Id.GetName()] = req.GetYourResource()
+    }
+
+    return &resourcespb.ResourceDeclareResponse{}, nil
+}
+```
+
+### Initialize the Map
+
+In `NewServiceRequirements()`, initialize your map:
+
+```go title:pkg/collector/service.go
+func NewServiceRequirements(serviceName string, serviceFile string, serviceType string) *ServiceRequirements {
+    requirements := &ServiceRequirements{
+        // ... existing initializations ...
+        yourResources: make(map[string]*resourcespb.YourResource),
+  
```

**File**: `docs/src/config/index.ts` (modified, +4/-0)
```diff
@@ -431,6 +431,10 @@ export const navigation: NavEntry[] = [
             title: 'Custom Providers',
             href: '/providers/custom/create',
           },
+          {
+            title: 'Adding Resource Types',
+            href: '/providers/custom/adding-resource-types',
+          },
           {
             title: 'Install with Docker',
             href: '/providers/custom/docker',
```

---

### Incident Patch 4: `fe381bca` (2025-12-04)
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
+  resolved "https://registry.yarnpkg.com/@next/swc-darwin-x64/-/swc-darwin-x64-14.2.33.tgz#fcf0c45938da9b0cc2ec86357d6aefca90bd17f3"
+  integrity sha512-8HGBeAE5rX3jzKvF593XTTFg3gxeU4f+UWnswa6JPhzaR6+zblO5+fjltJWIZc4aUalqTclvN2QtTC37LxvZAA==
+
+"@next/swc-linux-arm64-gnu@14.2.33":
+  version "14.2.33"
+  resolved "https://registry.yarnpkg.com/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-14.2.33.tgz#837f91a740eb4420c06f34c4677645315479d9be"
+  integrity sha512-JXMBka6lNNmqbkvcTtaX8Gu5by9547bukHQvPoLe9VRBx1gHwzf5tdt4AaezW85HAB3pikcvyqBToRTDA4DeLw==
+
+"@next/swc-linux-arm64-musl@14.2.33":
+  version "14.2.33"
+  resolved "https://registry.yarnpkg.com/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-14.2.33.tgz#dc8903469e5c887b25e3c2217a048bd30c58d3d4"
+  integrity sha512-Bm+QulsAItD/x6Ih8wGIMfRJy4G73tu1HJsrccPW6AfqdZd0Sfm5Imhgkgq2+kly065rYMnCOxTBvmvFY1BKfg==
+
+"@next/swc-linux-x64-gnu@14.2.33":
+  version "14.2.33"
+  resolved "https://registry.yarnpkg.com/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-14.2.33.tgz#344438be592b6b28cc540194274561e41f9933e5"
+  integrity sha512-FnFn+ZBgsVMbGDsTqo8zsnRzydvsGV8vfiWwUo
```

---

### Incident Patch 5: `d08274a5` (2025-09-10)
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

**File**: `.github/workflows/publish-gcptf.yaml` (modified, +1/-1)
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

**File**: `.github/workflows/test.yaml` (modified, +122/-11)
```diff
@@ -21,7 +21,7 @@ jobs:
       - name: Setup Go
         uses: actions/setup-go@v2
         with:
-          go-version: 1.22.7
+          go-version: 1.24.0
       - name: Setup Golang caches
         uses: actions/cache@v3
         with:
@@ -33,7 +33,18 @@ jobs:
             ${{ runner.os }}-golang-
       - name: Build check
         run: make binaries
-  test:
+      - name: Upload build artifacts
+        uses: actions/upload-artifact@v4
+        with:
+          name: binaries
+          path: |
+            cloud/aws/bin/
+            cloud/gcp/bin/
+            cloud/azure/bin/
+          retention-days: 1
+
+  # Jobs that can run independently without build dependencies
+  security:
     runs-on: ubuntu-latest
     env:
       GOPATH: /home/runner/go
@@ -43,32 +54,104 @@ jobs:
       - name: Setup Go
         uses: actions/setup-go@v2
         with:
-          go-version: 1.22.7
+          go-version: 1.24.0
+      - name: Setup Golang caches
+        uses: actions/cache@v3
+        with:
+          path: |
+            ~/.cache/go-build
+            ~/go/pkg/mod
+          key: ${{ runner.os }}-golang-${{ hashFiles('**/go.sum', '**/work.sum') }}
+          restore-keys: |
+            ${{ runner.os }}-golang-
+      - name: Run Gosec Security Scanner
+        run: make sec
+
+  generate-check:
+    runs-on: ubuntu-latest
+    env:
+      GOPATH: /home/runner/go
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v2
+      - name: Setup Go
+        uses: actions/setup-go@v2
+        with:
+          go-version: 1.24.0
       - name: Setup Golang caches
         uses: actions/cache@v3
         with:
           path: |
             ~/.cache/go-build
-            ~/.cache/golangci-lint
             ~/go/pkg/mod
           key: ${{ runner.os }}-golang-${{ hashFiles('**/go.sum', '**/work.sum') }}
           restore-keys: |
             ${{ runner.os }}-golang-
-      - name: Linting check
-        run: make lint
       - name: Generate Sources
         run: make generate-sources
       - name: Check generated sources
         run: |
           git add .
           git diff --cached --exit-code
-      - name: Run Gosec Security Scanner
-        run: make sec
+
+  # Jobs that need build dependencies
+  lint:
+    needs: build
+    runs-on: ubuntu-latest
+    env:
+      GOPATH: /home/runner/go
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v2
+      - name: Setup Go
+        uses: actions/setup-go@v2
+        with:
+          go-version: 1.24.0
+      - name: Setup Golang caches
+        uses: actions/cache@v3
+        with:
+          path: |
+            ~/.cache/go-build
+            ~/.cache/golangci-lint
+            ~/go/pkg/mod
+          key: ${{ runner.os }}-golang-${{ hashFiles('**/go.sum', '**/work.sum') }}
+          restore-keys: |
+            ${{ runner.os }}-golang-
+      - name: Download build artifacts
+        uses: actions/download-artifact@v4
+        with:
+          name: binaries
+      - name: Linting check
+        run: make lint
+
+  test:
+    needs: build
+    runs-on: ubuntu-latest
+    env:
+      GOPATH: /home/runner/go
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v2
+      - name: Setup Go
+        uses: actions/setup-go@v2
+        with:
+          go-version: 1.24.0
+      - name: Setup Golang caches
+        uses: actions/cache@v3
+        with:
+          path: |
+            ~/.cache/go-build
+            ~/go/pkg/mod
+          key: ${{ runner.os }}-golang-${{ hashFiles('**/go.sum', '**/work.sum') }}
+          restore-keys: |
+            ${{ runner.os }}-golang-
+      - name: Download build artifacts
+        uses: actions/download-artifact@v4
+        with:
+          name: binaries
       - name: Run Tests
         run: make test-coverage
-      - name: Check Dependency Licenses
-        run: make license-check
-      # Upload coverage report if for core
+      # Upload coverage reports
       - name: Upload Coverage Report Core
         uses: codecov/codecov-action@v2
         with:
@@ -93,3 +176,31 @@ jobs:
           token: ${{ secrets.CODECOV_TOKEN }} # not required for public repos
           files: ./cloud/azure/all.coverprofile
           flags: azure # optional
+
+  license-check:
+    needs: build
+    runs-on: ubuntu-latest
+    env:
+      GOPATH: /home/runner/go
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v2
+      - name: Setup Go
+        uses: actions/setup-go@v2
+        with:
+          go-version: 1.24.0
+      - name: Setup Golang caches
+        uses: actions/cache@v3
+        with:
+          path: |
+            ~/.cache/go-build
+            ~/go/pkg/mod
+          key: ${{ runner.os }}-golang-${{ hashFiles('**/go.sum', '**/work.sum') }}
+          restore-keys: |
+            ${{ runner.os }}-golang-
+      - name: Download build artifacts
+        uses: actions/download-artifact@v4
+        with:
+          name: binaries
+      - name: Check Dependency 
```

**File**: `cloud/aws/Makefile` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ install: deploybin deploybintf
 
 license-check: runtimebin
 	@echo Checking AWS Runtime Server OSS Licenses
-	@go run github.com/uw-labs/lichen --config=./lichen.yaml ./bin/runtime-aws
+	@go tool lichen --config=./lichen.yaml ./bin/runtime-aws
 
 sourcefiles := $(shell find . -type f -name "*.go" -o -name "*.dockerfile")
 
```

---

### Incident Patch 6: `c32823af` (2025-09-09)
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

### Incident Patch 7: `f68390c2` (2025-06-18)
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

### Incident Patch 8: `9febb5bc` (2025-05-26)
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

### Incident Patch 9: `ff212591` (2025-05-07)
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

### Incident Patch 10: `73961aee` (2025-05-02)
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

**File**: `cloud/aws/deploytf/generated/secret/Secret.go` (modified, +20/-0)
```diff
@@ -22,6 +22,8 @@ type Secret interface {
 	DependsOn() *[]*string
 	// Experimental.
 	SetDependsOn(val *[]*string)
+	ExistingSecretArn() *string
+	SetExistingSecretArn(val *string)
 	// Experimental.
 	ForEach() cdktf.ITerraformIterator
 	// Experimental.
@@ -108,6 +110,16 @@ func (j *jsiiProxy_Secret) DependsOn() *[]*string {
 	return returns
 }
 
+func (j *jsiiProxy_Secret) ExistingSecretArn() *string {
+	var returns *string
+	_jsii_.Get(
+		j,
+		"existingSecretArn",
+		&returns,
+	)
+	return returns
+}
+
 func (j *jsiiProxy_Secret) ForEach() cdktf.ITerraformIterator {
 	var returns cdktf.ITerraformIterator
 	_jsii_.Get(
@@ -264,6 +276,14 @@ func (j *jsiiProxy_Secret)SetDependsOn(val *[]*string) {
 	)
 }
 
+func (j *jsiiProxy_Secret)SetExistingSecretArn(val *string) {
+	_jsii_.Set(
+		j,
+		"existingSecretArn",
+		val,
+	)
+}
+
 func (j *jsiiProxy_Secret)SetForEach(val cdktf.ITerraformIterator) {
 	_jsii_.Set(
 		j,
```

**File**: `cloud/aws/deploytf/generated/secret/SecretConfig.go` (modified, +2/-0)
```diff
@@ -17,5 +17,7 @@ type SecretConfig struct {
 	SecretName *string `field:"required" json:"secretName" yaml:"secretName"`
 	// The ID of the Nitric stack.
 	StackId *string `field:"required" json:"stackId" yaml:"stackId"`
+	// The ARN of the existing secret to import.
+	ExistingSecretArn *string `field:"optional" json:"existingSecretArn" yaml:"existingSecretArn"`
 }
 
```

**File**: `cloud/aws/deploytf/generated/secret/main.go` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ func init() {
 			_jsii_.MemberProperty{JsiiProperty: "cdktfStack", GoGetter: "CdktfStack"},
 			_jsii_.MemberProperty{JsiiProperty: "constructNodeMetadata", GoGetter: "ConstructNodeMetadata"},
 			_jsii_.MemberProperty{JsiiProperty: "dependsOn", GoGetter: "DependsOn"},
+			_jsii_.MemberProperty{JsiiProperty: "existingSecretArn", GoGetter: "ExistingSecretArn"},
 			_jsii_.MemberProperty{JsiiProperty: "forEach", GoGetter: "ForEach"},
 			_jsii_.MemberProperty{JsiiProperty: "fqn", GoGetter: "Fqn"},
 			_jsii_.MemberProperty{JsiiProperty: "friendlyUniqueId", GoGetter: "FriendlyUniqueId"},
```

---

### Incident Patch 11: `7ce93d65` (2025-05-02)
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

---

### Incident Patch 12: `4cd0b2a7` (2025-05-01)
**Commit Message**: fix(aws): Add websocket forwarding for AWS Cloudfront (#770)

Co-authored-by: Jye Cusch <[REDACTED_EMAIL]>
Co-authored-by: David Moore <[REDACTED_EMAIL]>

**File**: `cloud/aws/deploy/embeds/cloudfront.go` (modified, +7/-0)
```diff
@@ -28,10 +28,17 @@ var cloudfront_ApiUrlRewriteFunction string
 //go:embed url-rewrite.tmpl.js
 var cloudfront_UrlRewriteFunctionName string
 
+//go:embed ws-url-rewrite.js
+var cloudfront_WsUrlRewriteFunction string
+
 func GetApiUrlRewriteFunction() pulumi.StringInput {
 	return pulumi.String(cloudfront_ApiUrlRewriteFunction)
 }
 
+func GetWsUrlRewriteFunction() pulumi.StringInput {
+	return pulumi.String(cloudfront_WsUrlRewriteFunction)
+}
+
 func GetUrlRewriteFunction(basePath string) (pulumi.StringInput, error) {
 	tmpl, err := template.New("rewrite-function").Parse(cloudfront_UrlRewriteFunctionName)
 	if err != nil {
```

**File**: `cloud/aws/deploy/embeds/ws-url-rewrite.js` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+function handler(event) {
+    var request = event.request;
+  
+    request.uri = "/ws";
+  
+    return request;
+  }
\ No newline at end of file
```

**File**: `cloud/aws/deploy/website.go` (modified, +58/-0)
```diff
@@ -287,6 +287,15 @@ func (a *NitricAwsPulumiProvider) deployCloudfrontDistribution(ctx *pulumi.Conte
 		return err
 	}
 
+	wsRewriteFun, err := cloudfront.NewFunction(ctx, "ws-url-rewrite-function", &cloudfront.FunctionArgs{
+		Comment: pulumi.String("Rewrite Websocket URLs routed to nitric services"),
+		Code:    embeds.GetWsUrlRewriteFunction(),
+		Runtime: pulumi.String("cloudfront-js-1.0"),
+	})
+	if err != nil {
+		return err
+	}
+
 	// Sort the APIs by name
 	sortedApiKeys := lo.Keys(a.Apis)
 	slices.Sort(sortedApiKeys)
@@ -338,6 +347,55 @@ func (a *NitricAwsPulumiProvider) deployCloudfrontDistribution(ctx *pulumi.Conte
 		)
 	}
 
+	// Sort the websocket keys by name
+	sortedWsKeys := lo.Keys(a.Websockets)
+	slices.Sort(sortedWsKeys)
+	for _, name := range sortedWsKeys {
+		ws := a.Websockets[name]
+
+		websocketDomainName := ws.ApiEndpoint.ApplyT(func(endpoint string) string {
+			return strings.Replace(endpoint, "wss://", "", 1)
+		}).(pulumi.StringOutput)
+
+		origins = append(origins, &cloudfront.DistributionOriginArgs{
+			DomainName: websocketDomainName,
+			OriginId:   pulumi.Sprintf("ws-%s", name),
+			CustomOriginConfig: &cloudfront.DistributionOriginCustomOriginConfigArgs{
+				OriginReadTimeout:    pulumi.Int(30),
+				OriginProtocolPolicy: pulumi.String("match-viewer"),
+				OriginSslProtocols: pulumi.StringArray{
+					pulumi.String("TLSv1.2"),
+					pulumi.String("SSLv3"),
+				},
+				HttpPort:  pulumi.Int(80),
+				HttpsPort: pulumi.Int(443),
+			},
+		})
+
+		orderedCacheBehaviors = append(orderedCacheBehaviors,
+			&cloudfront.DistributionOrderedCacheBehaviorArgs{
+				PathPattern: pulumi.Sprintf("ws/%s", name),
+				// rewrite the URL to the nitric service
+				FunctionAssociations: cloudfront.DistributionOrderedCacheBehaviorFunctionAssociationArray{
+					&cloudfront.DistributionOrderedCacheBehaviorFunctionAssociationArgs{
+						EventType:   pulumi.String("viewer-request"),
+						FunctionArn: wsRewriteFun.Arn,
+					},
+				},
+				AllowedMethods: pulumi.ToStringArray([]string{"GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"}),
+				CachedMethods:  pulumi.ToStringArray([]string{"GET", "HEAD", "OPTIONS"}),
+				TargetOriginId: pulumi.Sprintf("ws-%s", name),
+				ForwardedValues: &cloudfront.DistributionOrderedCacheBehaviorForwardedValuesArgs{
+					QueryString: pulumi.Bool(true),
+					Cookies: &cloudfront.DistributionOrderedCacheBehaviorForwardedValuesCookiesArgs{
+						Forward: pulumi.String("all"),
+					},
+				},
+				ViewerProtocolPolicy: pulumi.String("allow-all"),
+			},
+		)
+	}
+
 	name := fmt.Sprintf("%s-cdn", a.StackId)
 
 	tags := common.Tags(a.StackId, name, resources.Website)
```

---

### Incident Patch 13: `ca05a94d` (2025-04-30)
**Commit Message**: fix(awstf): apply correct resource group tag filter (#796)

**File**: `cloud/aws/deploytf/.nitric/modules/stack/main.tf` (modified, +3/-3)
```diff
@@ -5,15 +5,15 @@ resource "random_string" "id" {
 }
 
 resource "aws_resourcegroups_group" "group" {
-  name = "nitric-resource-group-${random_string.id.result}"
+  name = "${var.project_name}-${var.stack_name}-${random_string.id.result}"
 
   resource_query {
     query = <<JSON
 {
 
     "ResourceTypeFilters":["AWS::AllSupported"],
-	"TagFilters":[{"Key":"x-nitric-name-${random_string.id.result}"}]
+	"TagFilters":[{"Key":"x-nitric-${random_string.id.result}-name"}]
 }
 JSON
   }
-}
\ No newline at end of file
+}
```

**File**: `cloud/aws/deploytf/.nitric/modules/stack/variables.tf` (modified, +11/-1)
```diff
@@ -2,4 +2,14 @@ variable "enable_website" {
   description = "Enable the creation of a website"
   type        = bool
   default     = false
-}
\ No newline at end of file
+}
+
+variable "project_name" {
+  description = "The name of the project"
+  type        = string
+}
+
+variable "stack_name" {
+  description = "The name of the stack"
+  type        = string
+}
```

**File**: `cloud/aws/deploytf/deploy.go` (modified, +4/-1)
```diff
@@ -152,7 +152,10 @@ func (a *NitricAwsTerraformProvider) Pre(stack cdktf.TerraformStack, resources [
 		return item.Id.GetType() == resourcespb.ResourceType_Website
 	})
 
-	a.Stack = tfstack.NewStack(stack, jsii.String("stack"), &tfstack.StackConfig{})
+	a.Stack = tfstack.NewStack(stack, jsii.String("stack"), &tfstack.StackConfig{
+		StackName:   jsii.String(a.StackName),
+		ProjectName: jsii.String(a.ProjectName),
+	})
 
 	databases := lo.Filter(resources, func(item *deploymentspb.Resource, idx int) bool {
 		return item.Id.Type == resourcespb.ResourceType_SqlDatabase
```

**File**: `cloud/aws/deploytf/generated/stack/Stack.go` (modified, +46/-0)
```diff
@@ -34,6 +34,8 @@ type Stack interface {
 	FriendlyUniqueId() *string
 	// The tree node.
 	Node() constructs.Node
+	ProjectName() *string
+	SetProjectName(val *string)
 	// Experimental.
 	Providers() *[]interface{}
 	// Experimental.
@@ -43,6 +45,8 @@ type Stack interface {
 	// Experimental.
 	Source() *string
 	StackIdOutput() *string
+	StackName() *string
+	SetStackName(val *string)
 	// Experimental.
 	Version() *string
 	// Experimental.
@@ -156,6 +160,16 @@ func (j *jsiiProxy_Stack) Node() constructs.Node {
 	return returns
 }
 
+func (j *jsiiProxy_Stack) ProjectName() *string {
+	var returns *string
+	_jsii_.Get(
+		j,
+		"projectName",
+		&returns,
+	)
+	return returns
+}
+
 func (j *jsiiProxy_Stack) Providers() *[]interface{} {
 	var returns *[]interface{}
 	_jsii_.Get(
@@ -206,6 +220,16 @@ func (j *jsiiProxy_Stack) StackIdOutput() *string {
 	return returns
 }
 
+func (j *jsiiProxy_Stack) StackName() *string {
+	var returns *string
+	_jsii_.Get(
+		j,
+		"stackName",
+		&returns,
+	)
+	return returns
+}
+
 func (j *jsiiProxy_Stack) Version() *string {
 	var returns *string
 	_jsii_.Get(
@@ -268,6 +292,28 @@ func (j *jsiiProxy_Stack)SetForEach(val cdktf.ITerraformIterator) {
 	)
 }
 
+func (j *jsiiProxy_Stack)SetProjectName(val *string) {
+	if err := j.validateSetProjectNameParameters(val); err != nil {
+		panic(err)
+	}
+	_jsii_.Set(
+		j,
+		"projectName",
+		val,
+	)
+}
+
+func (j *jsiiProxy_Stack)SetStackName(val *string) {
+	if err := j.validateSetStackNameParameters(val); err != nil {
+		panic(err)
+	}
+	_jsii_.Set(
+		j,
+		"stackName",
+		val,
+	)
+}
+
 // Checks if `x` is a construct.
 //
 // Use this method instead of `instanceof` to properly detect `Construct`
```

**File**: `cloud/aws/deploytf/generated/stack/StackConfig.go` (modified, +4/-0)
```diff
@@ -13,6 +13,10 @@ type StackConfig struct {
 	Providers *[]interface{} `field:"optional" json:"providers" yaml:"providers"`
 	// Experimental.
 	SkipAssetCreationFromLocalModules *bool `field:"optional" json:"skipAssetCreationFromLocalModules" yaml:"skipAssetCreationFromLocalModules"`
+	// The name of the project.
+	ProjectName *string `field:"required" json:"projectName" yaml:"projectName"`
+	// The name of the stack.
+	StackName *string `field:"required" json:"stackName" yaml:"stackName"`
 	// Enable the creation of a website.
 	EnableWebsite *bool `field:"optional" json:"enableWebsite" yaml:"enableWebsite"`
 }
```

**File**: `cloud/aws/deploytf/generated/stack/Stack__checks.go` (modified, +19/-0)
```diff
@@ -90,6 +90,22 @@ func validateStack_IsTerraformElementParameters(x interface{}) error {
 	return nil
 }
 
+func (j *jsiiProxy_Stack) validateSetProjectNameParameters(val *string) error {
+	if val == nil {
+		return fmt.Errorf("parameter val is required, but nil was provided")
+	}
+
+	return nil
+}
+
+func (j *jsiiProxy_Stack) validateSetStackNameParameters(val *string) error {
+	if val == nil {
+		return fmt.Errorf("parameter val is required, but nil was provided")
+	}
+
+	return nil
+}
+
 func validateNewStackParameters(scope constructs.Construct, id *string, config *StackConfig) error {
 	if scope == nil {
 		return fmt.Errorf("parameter scope is required, but nil was provided")
@@ -99,6 +115,9 @@ func validateNewStackParameters(scope constructs.Construct, id *string, config *
 		return fmt.Errorf("parameter id is required, but nil was provided")
 	}
 
+	if config == nil {
+		return fmt.Errorf("parameter config is required, but nil was provided")
+	}
 	if err := _jsii_.ValidateStruct(config, func() string { return "parameter config" }); err != nil {
 		return err
 	}
```

**File**: `cloud/aws/deploytf/generated/stack/Stack__no_checks.go` (modified, +8/-0)
```diff
@@ -32,6 +32,14 @@ func validateStack_IsTerraformElementParameters(x interface{}) error {
 	return nil
 }
 
+func (j *jsiiProxy_Stack) validateSetProjectNameParameters(val *string) error {
+	return nil
+}
+
+func (j *jsiiProxy_Stack) validateSetStackNameParameters(val *string) error {
+	return nil
+}
+
 func validateNewStackParameters(scope constructs.Construct, id *string, config *StackConfig) error {
 	return nil
 }
```

**File**: `cloud/aws/deploytf/generated/stack/main.go` (modified, +2/-0)
```diff
@@ -25,12 +25,14 @@ func init() {
 			_jsii_.MemberMethod{JsiiMethod: "interpolationForOutput", GoMethod: "InterpolationForOutput"},
 			_jsii_.MemberProperty{JsiiProperty: "node", GoGetter: "Node"},
 			_jsii_.MemberMethod{JsiiMethod: "overrideLogicalId", GoMethod: "OverrideLogicalId"},
+			_jsii_.MemberProperty{JsiiProperty: "projectName", GoGetter: "ProjectName"},
 			_jsii_.MemberProperty{JsiiProperty: "providers", GoGetter: "Providers"},
 			_jsii_.MemberProperty{JsiiProperty: "rawOverrides", GoGetter: "RawOverrides"},
 			_jsii_.MemberMethod{JsiiMethod: "resetOverrideLogicalId", GoMethod: "ResetOverrideLogicalId"},
 			_jsii_.MemberProperty{JsiiProperty: "skipAssetCreationFromLocalModules", GoGetter: "SkipAssetCreationFromLocalModules"},
 			_jsii_.MemberProperty{JsiiProperty: "source", GoGetter: "Source"},
 			_jsii_.MemberProperty{JsiiProperty: "stackIdOutput", GoGetter: "StackIdOutput"},
+			_jsii_.MemberProperty{JsiiProperty: "stackName", GoGetter: "StackName"},
 			_jsii_.MemberMethod{JsiiMethod: "synthesizeAttributes", GoMethod: "SynthesizeAttributes"},
 			_jsii_.MemberMethod{JsiiMethod: "synthesizeHclAttributes", GoMethod: "SynthesizeHclAttributes"},
 			_jsii_.MemberMethod{JsiiMethod: "toHclTerraform", GoMethod: "ToHclTerraform"},
```

---

### Incident Patch 14: `0d64fe3e` (2025-04-29)
**Commit Message**: fix(azure-tf): use unique stack id instead of stack_name variable (#795)

helps fix tag lookup issues and improve readability

**File**: `cloud/azure/deploytf/.nitric/modules/bucket/variables.tf` (modified, +0/-5)
```diff
@@ -3,11 +3,6 @@ variable "name" {
   type        = string
 }
 
-variable "stack_name" {
-  description = "The name of the stack"
-  type        = string
-}
-
 variable "storage_account_id" {
   description = "The id of the storage account"
   type        = string
```

**File**: `cloud/azure/deploytf/.nitric/modules/cdn/main.tf` (modified, +5/-5)
```diff
@@ -1,14 +1,14 @@
 locals {
-  endpoint_name               = "${var.stack_name}-cdn"
-  default_origin_group_name   = "${var.stack_name}-default-origin-group"
-  default_origin_name         = "${var.stack_name}-default-origin"
+  endpoint_name               = "${var.stack_id}-cdn"
+  default_origin_group_name   = "${var.stack_id}-default-origin-group"
+  default_origin_name         = "${var.stack_id}-default-origin"
 
   changed_path_md5_hashes     = join("", sort(values(var.uploaded_files)))
 }
 
 # Create the CDN profile for the website
 resource "azurerm_cdn_frontdoor_profile" "cdn_profile" {
-  name                = "${var.stack_name}-cdn-profile"
+  name                = "${var.stack_id}-cdn-profile"
   resource_group_name = var.resource_group_name
   sku_name            = "Standard_AzureFrontDoor"
 }
@@ -126,7 +126,7 @@ resource "azurerm_cdn_frontdoor_rule_set" "api_ruleset" {
 
 # Create the CDN route
 resource "azurerm_cdn_frontdoor_route" "main_route" {
-  name                       = "${var.stack_name}-main-route"
+  name                       = "${var.stack_id}-main-route"
   cdn_frontdoor_endpoint_id =  azurerm_cdn_frontdoor_endpoint.cdn_endpoint.id
   cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.default_origin_group.id
   cdn_frontdoor_origin_ids = [
```

**File**: `cloud/azure/deploytf/.nitric/modules/cdn/variables.tf` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
-variable "stack_name" {
-  description = "The name of the stack"
+variable "stack_id" {
+  description = "The id of the stack"
   type        = string
 }
 
```

**File**: `cloud/azure/deploytf/.nitric/modules/cdn_subsites/main.tf` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 locals {
-  subsite_origin_group_name = "${var.stack_name}-${var.name}-origin-group"
-  subsite_origin_name       = "${var.stack_name}-${var.name}-origin"
+  subsite_origin_group_name = "${var.stack_id}-${var.name}-origin-group"
+  subsite_origin_name       = "${var.stack_id}-${var.name}-origin"
   subsite_rule_name         = "subsiterule${var.name}"
 }
 
```

**File**: `cloud/azure/deploytf/.nitric/modules/cdn_subsites/variables.tf` (modified, +2/-2)
```diff
@@ -8,8 +8,8 @@ variable "base_path" {
   type        = string
 }
 
-variable "stack_name" {
-  description = "The name of the stack"
+variable "stack_id" {
+  description = "The id of the stack"
   type        = string
 }
 
```

**File**: `cloud/azure/deploytf/.nitric/modules/roles/main.tf` (modified, +13/-13)
```diff
@@ -2,7 +2,7 @@ data "azurerm_subscription" "current" {}
 
 resource "azurerm_role_definition" "nitric_role_kv_read" {
   description = "keyvalue read access"
-  name        = "${var.stack_name}-KeyValueStoreRead"
+  name        = "${var.stack_id}-KeyValueStoreRead"
   scope       = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${var.resource_group_name}"
 
   permissions {
@@ -18,7 +18,7 @@ resource "azurerm_role_definition" "nitric_role_kv_read" {
 
 resource "azurerm_role_definition" "nitric_role_kv_write" {
   description = "nitric keyvalue write access"
-  name        = "${var.stack_name}-KeyValueStoreWrite"
+  name        = "${var.stack_id}-KeyValueStoreWrite"
   scope       = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${var.resource_group_name}"
 
   permissions {
@@ -35,7 +35,7 @@ resource "azurerm_role_definition" "nitric_role_kv_write" {
 
 resource "azurerm_role_definition" "nitric_role_kv_delete" {
   description = "nitric keyvalue delete access"
-  name        = "${var.stack_name}-KeyValueStoreDelete"
+  name        = "${var.stack_id}-KeyValueStoreDelete"
   scope       = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${var.resource_group_name}"
 
   permissions {
@@ -51,7 +51,7 @@ resource "azurerm_role_definition" "nitric_role_kv_delete" {
 
 resource "azurerm_role_definition" "nitric_role_queue_enqueue" {
   description = "nitric queue enqueue access"
-  name        = "${var.stack_name}-QueueEnqueue"
+  name        = "${var.stack_id}-QueueEnqueue"
   scope       = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${var.resource_group_name}"
 
   permissions {
@@ -69,7 +69,7 @@ resource "azurerm_role_definition" "nitric_role_queue_enqueue" {
 
 resource "azurerm_role_definition" "nitric_role_queue_dequeue" {
   description = "nitric queue dequeue access"
-  name        = "${var.stack_name}-QueueDequeue"
+  name        = "${var.stack_id}-QueueDequeue"
   scope       = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${var.resource_group_name}"
 
   permissions {
@@ -88,7 +88,7 @@ resource "azurerm_role_definition" "nitric_role_queue_dequeue" {
 
 resource "azurerm_role_definition" "nitric_role_allow_user_delegation_key_generation" {
   description = "Allow user delegation key generation, enabling actions such as pre-signed file access URLs"
-  name        = "${var.stack_name}-AllowUserDelegationKeyGeneration"
+  name        = "${var.stack_id}-AllowUserDelegationKeyGeneration"
   scope       = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${var.resource_group_name}"
 
   permissions {
@@ -104,7 +104,7 @@ resource "azurerm_role_definition" "nitric_role_allow_user_delegation_key_genera
 
 resource "azurerm_role_definition" "nitric_role_bucket_file_get" {
   description = "nitric bucket file get access"
-  name        = "${var.stack_name}-BucketFileGet"
+  name        = "${var.stack_id}-BucketFileGet"
   scope       = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${var.resource_group_name}"
 
   permissions {
@@ -122,7 +122,7 @@ resource "azurerm_role_definition" "nitric_role_bucket_file_get" {
 
 resource "azurerm_role_definition" "nitric_role_bucket_file_put" {
   description = "nitric bucket file put access"
-  name        = "${var.stack_name}-BucketFilePut"
+  name        = "${var.stack_id}-BucketFilePut"
   scope       = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${var.resource_group_name}"
 
   permissions {
@@ -138,7 +138,7 @@ resource "azurerm_role_definition" "nitric_role_bucket_file_put" {
 
 resource "azurerm_role_definition" "nitric_role_bucket_file_delete" {
   description = "nitric bucket file delete access"
-  name        = "${var.stack_name}-BucketFileDelete"
+  name        = "${var.stack_id}-BucketFileDelete"
   scope       = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${var.resource_group_name}"
 
   permissions {
@@ -154,7 +154,7 @@ resource "azurerm_role_definition" "nitric_role_bucket_file_delete" {
 
 resource "azurerm_role_definition" "nitric_role_bucket_file_list" {
   description = "nitric bucket file list access"
-  name        = "${var.stack_name}-BucketFileList"
+  name        = "${var.stack_id}-BucketFileList"
   scope       = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${var.resource_group_name}"
 
   permissions {
@@ -170,7 +170,7 @@ resource "azurerm_role_definition" "nitric_role_bucket_file_list" {
 
 resource "azurerm_role_definition" "nitric_role_topic_publish" {
   description = "nitric topic publish access"
-  name        = "${var.stack_name}-TopicPublish"
+  name        = "${var.stack_id}-TopicPublish"
   scope       = "/subscriptions/${data.azurerm_subscription.current.subscription_id
```

**File**: `cloud/azure/deploytf/.nitric/modules/roles/variables.tf` (modified, +2/-2)
```diff
@@ -3,7 +3,7 @@ variable "resource_group_name" {
   description = "The name of the resource group"
 }
 
-variable "stack_name" {
+variable "stack_id" {
   type = string
-  description = "The name of the stack"
+  description = "The id of the stack"
 }
\ No newline at end of file
```

**File**: `cloud/azure/deploytf/.nitric/modules/service/main.tf` (modified, +3/-3)
```diff
@@ -17,7 +17,7 @@ terraform {
 # }
 
 locals {
-  remote_image_name = "${var.registry_login_server}/${var.stack_name}-${var.name}"
+  remote_image_name = "${var.registry_login_server}/${var.stack_id}-${var.name}"
 }
 
 # Tag the provided docker image with the ECR repository url
@@ -45,7 +45,7 @@ data "azurerm_client_config" "current" {}
 
 locals {
   app_role_id    = "4962773b-9cdb-44cf-a8bf-237846a00ab7"
-  repository_url = "${var.registry_login_server}/${var.stack_name}-${var.name}"
+  repository_url = "${var.registry_login_server}/${var.stack_id}-${var.name}"
   role_definitions = {
     "TagContributor" = "4a9ae827-6dc8-4573-8ac7-8239d42aa03f"
   }
@@ -168,7 +168,7 @@ resource "azurerm_container_app" "container_app" {
 
       env {
         name  = "NITRIC_STACK_ID"
-        value = var.stack_name
+        value = var.stack_id
       }
 
       env {
```

---

### Incident Patch 15: `b04ec195` (2025-04-29)
**Commit Message**: fix(azure-tf): adds resource name to policy name (#793)

Ensures uniqueness of policy names by including the resource name in the generated name.

**File**: `cloud/azure/deploytf/policy.go` (modified, +1/-1)
```diff
@@ -177,7 +177,7 @@ func (a *NitricAzureTerraformProvider) Policy(stack cdktf.TerraformStack, name s
 					return err
 				}
 
-				policy.NewPolicy(stack, jsii.Sprintf("%s-%s", principal.Id.Name, roleName), &policy.PolicyConfig{
+				policy.NewPolicy(stack, jsii.Sprintf("%s-%s-%s", principal.Id.Name, roleName, resource.Id.Name), &policy.PolicyConfig{
 					ServicePrincipalId: spId,
 					Scope:              scope.Scope,
 					RoleDefinitionId:   role,
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

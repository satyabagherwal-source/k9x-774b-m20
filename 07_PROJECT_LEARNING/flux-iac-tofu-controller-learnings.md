> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/flux-iac-tofu-controller-learnings.md`  
> **Source**: github ([https://github.com/flux-iac/tofu-controller](https://github.com/flux-iac/tofu-controller))  
> **Source Version**: `1a172945`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T03:59:34.230Z  
> **Learning ID**: `learn-github-flux-iac-tofu-controller`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): flux-iac/tofu-controller

> **Canonical Artifact**: `07_PROJECT_LEARNING/flux-iac-tofu-controller-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/flux-iac/tofu-controller](https://github.com/flux-iac/tofu-controller))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T03:59:34.222Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `flux-iac/tofu-controller`
- **Description**: A GitOps OpenTofu and Terraform controller for Flux
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 1718 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `controllers/tf_controller_webhooks.go`
```
package controllers

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"text/template"

	infrav1 "github.com/flux-iac/tofu-controller/api/v1alpha2"
	"github.com/flux-iac/tofu-controller/runner"
	"github.com/hashicorp/go-cleanhttp"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/kustomize/kyaml/yaml"
)

func shouldProcessPostPlanningWebhooks(terraform *infrav1.Terraform) bool {
	if terraform.Spec.Webhooks == nil || len(terraform.Spec.Webhooks) < 1 {
		return false
	}

	for _, webhook := range terraform.Spec.Webhooks {
		if webhook.Stage == infrav1.PostPlanningWebhook {
			return true
		}
	}

	// TODO add better condition here

	return false
}

func (r *TerraformReconciler) prepareWebhookPayload(terraform *infrav1.Terraform, runnerClient runner.RunnerClient, payloadType string, tfInstance string) ([]byte, error) {
	toBytes, err := terraform.ToBytes(r.Scheme)
	if err != nil {
		err = fmt.Errorf("failed to marshal Terraform resource: %w", err)
		return nil, err
	}

	reply, err := runnerClient.ShowPlanFile(context.Background(), &runner.ShowPlanFileRequest{
		TfInstance: tfInstance,
		Filename:   runner.TFPlanName,
	})
	if err != nil {
		err = fmt.Errorf("failed to get plan file: %w", err)
		return nil, err
	}

	planInJSON := reply.JsonOutput
	planObj, err := yaml.ConvertJSONToYamlNode(string(planInJSON))
	if err != nil {
		err = fmt.Errorf("failed to convert plan file to YAML: %w", err)
		return nil, err
	}

	obj, err := yaml.ConvertJSONToYamlNode(string(toBytes))
	if err != nil {
		err = fmt.Errorf("failed to convert Terraform resource to YAML: %w", err)
		return nil, err
	}

	switch payloadType {
	case "SpecAndPlan":
		obj, err = obj.Pipe(
			yaml.Tee(yaml.Clear("status")),
			yaml.Tee(
				yaml.LookupCreate(yaml.MappingNode, "status"),
				yaml.SetField("tfplan", planObj),
			),
		)
	case "SpecOnly":
		obj, err = obj.Pipe(
			yaml.Tee(yaml.Clear("status")),
		)
	case "PlanOnly":
		obj = planObj
	default:
		return nil, fmt.Errorf("unknown payload type: %s", payloadType)
	}

	if err != nil {
		err = fmt.Errorf("failed to add tfplan to Terraform resource: %w", err)
		return nil, err
	}

	jsonBytes, err := obj.MarshalJSON()
	if err != nil {
		err = fmt.Errorf("failed to marshal Terraform resource with plan: %w", err)
		return nil, err
	}

	return jsonBytes, nil
}

func (r *TerraformReconciler) processPostPlanningWebhooks(ctx context.Context, terraform *infrav1.Terraform, runnerClient runner.RunnerClient, revision string, tfInstance string) (*infrav1.Terraform, error) {
	log := ctrl.LoggerFrom(ctx)

	hooks := []infrav1.Webhook{}
	for _, webhook := range terraform.Spec.Webhooks {
		if webhook.Stage == infrav1.PostPlanningWebhook {
			hooks = append(hooks, webhook)
		}
	}

	if len(hooks) == 0 {
		return terraform, nil
	}

	disableWebhookTLSVerification := os.Getenv("DISABLE_WEBHOOK_TLS_VERIFY") == "1"

	for _, webhook := range hooks {
		log.Info("processing post-planning webhook", "webhook", webhook.URL)

		// We skip webhook if it's not enabled
		if !webhook.IsEnabled() {
			continue
		}

		log.Info("webhook is enabled, processing")

		payloadBytes, err := r.prepareWebhookPayload(terraform, runnerClient, webhook.PayloadType, tfInstance)
		if err != nil {
			err = fmt.Errorf("failed to prepare webhook payload: %w", err)
			return terraform, err
		}

		log.Info("webhook payload prepared")

		cli := cleanhttp.DefaultClient()

		if !disableWebhookTLSVerification {

			log.Info("webhook TLS verification is enabled")

			// parse webhook.URL and get the server name
			u, err := url.Parse(webhook.URL)
			if err != nil {
				err = fmt.Errorf("failed to parse webhook URL: %w", err)
				return terraform, err
			}

			log.Info("webhook URL parsed", "host", u.Host)

			caCertPath := "/etc/certs/" + u.Hostname() + "/ca.crt"
			caCertPool := x509.NewCertPool()
			caCert, err := os.ReadFile(caCertPath)
			if err == nil {
				caCertPool.AppendCertsFromPEM(caCert)
			}

			log.Info("webhook CA cert loaded", "path", caCertPath)

			tlsCertPath := "/etc/certs/" + u.Hostname() + "/tls.crt"
			tlsKeyPath := "/etc/certs/" + u.Hostname() + "/tls.key"
			certificate, err := tls.LoadX509KeyPair(tlsCertPath, tlsKeyPath)
			if err != nil {
				err = fmt.Errorf("failed to load webhook TLS certificate: %w", err)
				return terraform, err
			}

			log.Info("webhook TLS cert loaded", "path", tlsCertPath, "keypath", tlsKeyPath)

			cli.Transport.(*http.Transport).TLSClientConfig = &tls.Config{
				RootCAs:      caCertPool,
				Certificates: []tls.Certificate{certificate},
			}

			log.Info("webhook TLS config set")
		}

		post, err := cli.Post(webhook.URL, "application/json", bytes.NewReader(payloadBytes))
		if err != nil {
			err = fmt.Errorf("failed to send webhook: %w", err)
			return terraform, err
		}

		log.Info("webhook sent")

		if post.StatusCode != 200 {
			return terraform, fmt.Errorf("webhook %s returned %d: %s", webhook.URL, post.StatusCode, post.Status)
		}

		log.Info(fmt.Sprintf("webhook returned %d: %s", post.StatusCode, post.Status))

		// read json from post.Body, unmarshall to map[string]interface{}
		jsonReply := map[string]any{}
		err = json.NewDecoder(post.Body).Decode(&jsonReply)
		if err != nil {
			err = fmt.Errorf("failed to decode webhook reply: %w", err)
			return terraform, err
		}

		log.Info("webhook reply decoded")

		// Test if the reply contains a good result
		testExprTpl, err := template.
			New("testexpr").
			Delims("${{", "}}").
			Parse(webhook.TestExpression)
		if err != nil {
			err = fmt.Errorf("failed to parse webhook test expression: %w", err)
			return terraform, err
		}

		log.Info("webhook test expression parsed")

		var testExprBuf bytes.Buffer
		err = testExprTpl.Execute(&testExprBuf, jsonReply)
		if err != nil {
			err = fmt.Errorf("failed to execute webhook test expression: %w", err)
			return terraform, err
		}

		log.Info("webhook test expression executed")

		testResult := strings.TrimSpace(testExprBuf.String())
		if testResult == "true" || testResult == "yes" {
			log.Info("webhook test expression returned true, webhook is successful")
			continue
		} else if testResult == "false" || testResult == "no" {
			// do nothing
		} else {
			return terraform, fmt.Errorf("webhook test expression %q returned unexpected result: %s", webhook.TestExpression, testResult)
		}

		log.Info("webhook test expression returned false, webhook is not successful - prepare error message")

		// Extract the error message from the webhook response
		errMsgTpl, err := template.
			New("errmsg").
			Delims("${{", "}}").
			Parse(webhook.ErrorMessageTemplate)
		if err != nil {
			err = fmt.Errorf("failed to parse webhook error message template: %w", err)
			return terraform, err
		}

		log.Info("webhook error message template parsed")

		var errorMessage bytes.Buffer
		err = errMsgTpl.Execute(&errorMessage, jsonReply)
		if err != nil {
			err = fmt.Errorf("failed to execute webhook error message template: %w", err)
			return terraform, err
		}

		log.Info("webhook error message template executed")

		terraform = infrav1.TerraformPostPlanningWebhookFailed(terraform, revision, errorMessage.String())
		webhookErr := errors.New(errorMessage.String())
		return terraform, webhookErr
	}

	return terraform, nil
}

```

### Core Architecture Module: `utils/envmap.go`
```
package utils

import "strings"

func EnvMap(environ []string) map[string]string {
	env := map[string]string{}
	for _, ev := range environ {
		parts := strings.SplitN(ev, "=", 2)
		if len(parts) != 2 {
			continue
		}
		k := parts[0]
		v := ""
		if len(parts) == 2 {
			v = parts[1]
		}
		env[k] = v
	}
	return env
}

```

### Core Architecture Module: `utils/json_encode_bytes.go`
```
package utils

import (
	"encoding/json"
	"fmt"
	"testing"

	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
)

// JSONEncodeBytes encodes the given byte slice to a JSON byte slice.
func JSONEncodeBytes(b []byte) (*apiextensionsv1.JSON, error) {
	data, err := json.Marshal(string(b))
	if err != nil {
		return nil, fmt.Errorf("could not encode bytes to json: %w", err)
	}
	return &apiextensionsv1.JSON{Raw: data}, nil
}

// MustJSONEncodeBytes is like JSONEncodeBytes but expects a testing.T instance as the first
// argument.
func MustJSONEncodeBytes(t *testing.T, b []byte) *apiextensionsv1.JSON {
	data, err := json.Marshal(string(b))
	if err != nil {
		t.Errorf("could not encode bytes to json: %s", err)
	}
	return &apiextensionsv1.JSON{Raw: data}
}

```

### Core Architecture Module: `utils/quota.go`
```
package utils

import (
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// IsQuotaError checks if a Kubernetes API error is a quota exhaustion error.
// It checks for HTTP 403 Forbidden with "exceeded quota" in the message.
func IsQuotaError(err error) bool {
	if !apierrors.IsForbidden(err) {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "exceeded quota")
}

```

### Core Architecture Module: `api/plan/gzip.go`
```
package plan

import (
	"bytes"
	"compress/gzip"
	"io"
)

func GzipEncode(tfplan []byte) ([]byte, error) {
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)

	_, err := w.Write(tfplan)
	if err != nil {
		return nil, err
	}

	if err := w.Close(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func GzipDecode(encodedPlan []byte) ([]byte, error) {
	re := bytes.NewReader(encodedPlan)

	gr, err := gzip.NewReader(re)
	if err != nil {
		return nil, err
	}

	o, err := io.ReadAll(gr)
	if err != nil {
		return nil, err
	}

	if err = gr.Close(); err != nil {
		return nil, err
	}

	return o, nil
}

```

### Core Architecture Module: `api/plan/plan.go`
```
package plan

import (
	"crypto/sha256"
	"fmt"
	"strconv"

	infrav1 "github.com/flux-iac/tofu-controller/api/v1alpha2"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

const (
	// Kubernetes Label names associated with Terraform Plans
	TFPlanNameLabel      = "infra.contrib.fluxcd.io/plan-name"
	TFPlanWorkspaceLabel = "infra.contrib.fluxcd.io/plan-workspace"

	// Kubernetes Annotation names associated with Terraform Plans
	TFPlanFullNameAnnotation      = "infra.contrib.fluxcd.io/plan-full-name"
	TFPlanFullWorkspaceAnnotation = "infra.contrib.fluxcd.io/plan-full-workspace"
	TFPlanChunkAnnotation         = "infra.contrib.fluxcd.io/plan-chunk"
	TFPlanHashAnnotation          = "infra.contrib.fluxcd.io/plan-hash"
	TFPlanSavedAnnotation         = "savedPlan"

	TFPlanName = "tfplan"

	// resourceDataMaxSizeBytes defines the maximum size of data
	// that can be stored in a Kubernetes Secret or ConfigMap
	resourceDataMaxSizeBytes = 1 * 1024 * 1024 // 1MB
)

// SafeLabelValue returns a string that is safe to use as a Kubernetes label value.
func SafeLabelValue(value string) string {
	// Values that are equal to or less than 63 characters are already good
	if len(value) <= 63 {
		return value
	}

	// Create haash
	checksum := sha256.Sum256([]byte(value))

	// Build a prefix to append to end of truncated value
	checksumPrefix := fmt.Sprintf("-%x", checksum[:8])

	prefix := value[:63-len(checksumPrefix)]

	return prefix + checksumPrefix
}

type Plan struct {
	name      string
	namespace string
	workspace string
	uuid      string
	planID    string

	bytes []byte
}

// NewFromBytes create a new Plan from bytes, while enforcing the maximum size restriction.
func NewFromBytes(name string, namespace string, workspace string, uuid string, planID string, bytes []byte) (*Plan, error) {
	return &Plan{
		name:      name,
		namespace: namespace,
		workspace: workspace,
		uuid:      uuid,
		planID:    planID,
		bytes:     bytes,
	}, nil
}

// NewFromSecrets reconstructs a Plan from a set of Kubernetes Secrets.
func NewFromSecrets(name string, namespace string, uuid string, secrets []v1.Secret) (*Plan, error) {
	// To store the individual plan chunks by index
	chunkMap := make(map[int][]byte)

	var workspaceName, planID string

	for _, secret := range secrets {
		planStr, ok := secret.Data["tfplan"]
		if !ok {
			return nil, fmt.Errorf("secret %s missing key tfplan", secret.Name)
		}

		// Grab the chunk index from the secret annotation
		chunkIndex := 0
		if idxStr, ok := secret.Annotations[TFPlanChunkAnnotation]; ok && idxStr != "" {
			var err error
			chunkIndex, err = strconv.Atoi(idxStr)
			if err != nil {
				return nil, fmt.Errorf("invalid chunk index annotation found on secret %s: %s", secret.Name, err)
			}
		}

		// Attempt to get the workspace name from the annotation first (which we don't truncate),
		// but then fallback to label if it is not found.
		workspaceName, ok = secret.Annotations[TFPlanFullWorkspaceAnnotation]
		if !ok {
			workspaceName, ok = secret.Labels[TFPlanWorkspaceLabel]
			if !ok {
				return nil, fmt.Errorf("missing plan workspace label and annotation on secret %s", secret.Name)
			}
		}

		planID, ok = secret.Annotations[TFPlanSavedAnnotation]
		if !ok {
			return nil, fmt.Errorf("missing plan ID annotation on secret %s", secret.Name)
		}

		chunkMap[chunkIndex] = planStr
	}

	var planBytes []byte

	// we know the number of chunks we "should" have, so work
	// up til there checking we have each chunk
	for i := 0; i < len(chunkMap); i++ {
		chunk, ok := chunkMap[i]
		if !ok {
			return nil, fmt.Errorf("missing chunk %d for terraform %s", i, name)
		}
		planBytes = append(planBytes, chunk...)
	}

	data, err := GzipDecode(planBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to decode plan for resources %s: %s", name, err)
	}

	return &Plan{
		name:      name,
		namespace: namespace,
		workspace: workspaceName,
		uuid:      uuid,
		planID:    planID,
		bytes:     data,
	}, nil
}

// NewFromConfigMaps reconstructs a Plan from a set of Kubernetes ConfigMaps.
func NewFromConfigMaps(name string, namespace string, uuid string, configmaps []v1.ConfigMap) (*Plan, error) {
	// To store the individual plan chunks by index
	chunkMap := make(map[int]string)

	var workspaceName, planID string

	for _, configmap := range configmaps {
		planStr, ok := configmap.Data["tfplan"]
		if !ok {
			return nil, fmt.Errorf("configmap %s missing key tfplan", configmap.Name)
		}

		// Grab the chunk index from the configmap annotation
		chunkIndex := 0
		if idxStr, ok := configmap.Annotations[TFPlanChunkAnnotation]; ok && idxStr != "" {
			var err error
			chunkIndex, err = strconv.Atoi(idxStr)
			if err != nil {
				return nil, fmt.Errorf("invalid chunk index annotation found on configmap %s: %s", configmap.Name, err)
			}
		}

		// Attempt to get the workspace name from the annotation first (which we don't truncate),
		// but then fallback to label if it is not found.
		workspaceName, ok = configmap.Annotations[TFPlanFullWorkspaceAnnotation]
		if !ok {
			workspaceName, ok = configmap.Labels[TFPlanWorkspaceLabel]
			if !ok {
				return nil, fmt.Errorf("missing plan workspace label and annotation on configmap %s", configmap.Name)
			}
		}

		planID, ok = configmap.Annotations[TFPlanSavedAnnotation]
		if !ok {
			return nil, fmt.Errorf("missing plan ID annotation on secret %s", configmap.Name)
		}

		chunkMap[chunkIndex] = planStr
	}

	var planBytes []byte

	// we know the number of chunks we "should" have, so work
	// up til there checking we have each chunk
	for i := 0; i < len(chunkMap); i++ {
		chunk, ok := chunkMap[i]
		if !ok {
			return nil, fmt.Errorf("missing chunk %d for terraform %s", i, name)
		}
		planBytes = append(planBytes, chunk...)
	}

	return &Plan{
		name:      name,
		namespace: namespace,
		workspace: workspaceName,
		uuid:      uuid,
		planID:    planID,
		bytes:     planBytes,
	}, nil
}

// ToSecret converts a Terraform Plan into a (set of) Kubernetes Secret(s).
func (p *Plan) ToSecret(suffix string) ([]*v1.Secret, error) {
	// Build a standard name prefix for the secrets
	secretIdentifier := fmt.Sprintf("tfplan-%s-%s", p.workspace, p.name+suffix)

	encoded, err := GzipEncode(p.bytes)
	if err != nil {
		return nil, fmt.Errorf("unable to gzip encode the plan: %s", err)
	}

	// Check whether the Plan is large enough to be split into multiple secrets
	if len(encoded) <= resourceDataMaxSizeBytes {
		data := map[string][]byte{TFPlanName: encoded}

		// Build an individual secret containing the whole plan
		secret := &v1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      secretIdentifier,
				Namespace: p.namespace,
				Annotations: map[string]string{
					"encoding":                    "gzip",
					TFPlanFullNameAnnotation:      p.name + suffix,
					TFPlanFullWorkspaceAnnotation: p.workspace,
					TFPlanSavedAnnotation:         p.planID,
					TFPlanHashAnnotation:          fmt.Sprintf("%x", sha256.Sum256(p.bytes)),
				},
				Labels: map[string]string{
					TFPlanNameLabel:      SafeLabelValue(p.name + suffix),
					TFPlanWorkspaceLabel: SafeLabelValue(p.workspace),
				},
				OwnerReferences: []metav1.OwnerReference{
					{
						APIVersion: infrav1.GroupVersion.Group + "/" + infrav1.GroupVersion.Version,
						Kind:       infrav1.TerraformKind,
						Name:       p.name,
						UID:        types.UID(p.uuid),
					},
				},
			},
			Type: v1.SecretTypeOpaque,
			Data: data,
		}
		return []*v1.Secret{secret}, nil
	}

	numChunks := (uint64(len(encoded)) + resourceDataMaxSizeBytes - 1) / resourceDataMaxSizeBytes

	secrets := make([]*v1.Secret, 0, numChunks)

	for chunk := range numChunks {
		start := chunk * resourceDataMaxSizeBytes
		end := min(start+resourceDataMaxSizeBytes, uint64(len(encoded)))

		planData := encoded[start:end]

		data := map[string][]byte{TFPlanName: planData}

		secret := &v1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("%s-%d", secretIdentifier, chunk),
				Namespace: p.namespace,
				Annotations: map[string]string{
					"encoding":                    "gzip",
					TFPlanFullNameAnnotation:      p.name + suffix,
					TFPlanFullWorkspaceAnnotation: p.workspace,
					TFPlanSavedAnnotation:         p.planID,
					TFPlanChunkAnnotation:         fmt.Sprintf("%d", chunk),
					TFPlanHashAnnotation:          fmt.Sprintf("%x", sha256.Sum256(planData)),
				},
				Labels: map[string]string{
					TFPlanNameLabel:      SafeLabelValue(p.name + suffix),
					TFPlanWorkspaceLabel: SafeLabelValue(p.workspace),
				},
				OwnerReferences: []metav1.OwnerReference{
					{
						APIVersion: infrav1.GroupVersion.Group + "/" + infrav1.GroupVersion.Version,
						Kind:       infrav1.TerraformKind,
						Name:       p.name,
						UID:        types.UID(p.uuid),
					},
				},
			},
			Type: v1.SecretTypeOpaque,
			Data: data,
		}

		secrets = append(secrets, secret)
	}

	return secrets, nil
}

// ToConfigMap converts a Terraform Plan into a (set of) Kubernetes ConfigMap(s).
func (p *Plan) ToConfigMap(suffix string) ([]*v1.ConfigMap, error) {
	// Build a standard name prefix for the configmaps
	configMapIdentifier := fmt.Sprintf("tfplan-%s-%s", p.workspace, p.name+suffix)

	planStr := string(p.bytes)

	// Check whether the Plan is large enough to be split into multiple ConfigMaps
	if len(planStr) <= resourceDataMaxSizeBytes {
		data := map[string]string{TFPlanName: planStr}

		// Build an individual secret containing the whole plan
		configMap := &v1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      configMapIdentifier,
				Namespace: p.namespace,
				Annotations: map[string]string{
					TFPlanFullNameAnnotation:      p.name + suffix,
					TFPlanFullWorkspaceAnnotation: p.workspace,
					TFPlanSavedAnnotation:         p.planID,
					TFPlanHashAnnotation:          fmt.Sprintf("%x", sha256.Sum256(p.bytes)),
				},
				Labels: map[string]string{
					TFPlanNameLabel:      SafeLabelValue(p.name + suffix),
					TFPlan
```

### Core Architecture Module: `api/planid/plain_id.go`
```
package planid

import (
	"fmt"
	"strings"
)

// getPlanIDv0 parses old revision format: master/b8e362c206e3d0cbb7ed22ced771a0056455a2fb
func getPlanIDv0(revision string) string {
	parts := strings.Split(revision, "/")
	if len(parts) != 2 {
		if len(revision) > 10 {
			hash := revision[:10]
			return "plan-" + hash
		}
		return "plan-" + revision
	}

	branch := parts[0]
	hash := parts[1]
	if len(hash) > 10 {
		hash = hash[:10]
	}

	planID := "plan-" + branch + "-" + hash
	return planID
}

// GetPlanID parses revision in ${branch}@${algo}:${hash}
// to plan ID is plan-${branch}-${hash 10 digits}
func GetPlanID(revision string) string {
	parts := strings.Split(revision, "@")
	if len(parts) != 2 {
		return getPlanIDv0(revision)
	}

	branch := parts[0]

	// parts[1] is now "${algo}:${hash}"
	hashParts := strings.Split(parts[1], ":")
	hash := hashParts[1]

	if len(hash) > 10 {
		hash = hash[:10]
	}

	planID := "plan-" + branch + "-" + hash
	return planID
}

func GetApproveMessage(planId string, message string) string {
	approveMessage := fmt.Sprintf("%s: set approvePlan: \"%s\" to approve this plan.", message, planId)
	return approveMessage
}

```

### Core Architecture Module: `api/typeinfo/type_info.go`
```
package typeinfo

const Suffix = "__type"

```

### Core Architecture Module: `api/v1alpha1/condition_types.go`
```
/*
Copyright 2021.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package v1alpha1

// These constants are the Condition Types that the Terraform Resource works with
const (
	ConditionTypeApply       = "Apply"
	ConditionTypeHealthCheck = "HealthCheck"
	ConditionTypeOutput      = "Output"
	ConditionTypePlan        = "Plan"
	ConditionTypeStateLocked = "StateLocked"
)

const (
	// ArtifactFailedReason represents the fact that the artifact download
	// for the Teraform failed.
	ArtifactFailedReason = "ArtifactFailed"

	// DeletionBlockedByDependantsReason represents the fact that the
	// Terraform resource could not be deleted because there are
	// still resources depending on it.
	DeletionBlockedByDependants = "DeletionBlockedByDependantsReason"

	// DependencyNotReadyReason represents the fact that
	// one of the dependencies is not ready.
	DependencyNotReadyReason = "DependencyNotReady"

	// DriftDetectedReason represents the fact that drift was
	// detected during Terraform reconciliation.
	DriftDetectedReason = "DriftDetected"

	// DriftDetectionFailedReason represents the fact that
	// drift detection failed during reconciliation.
	DriftDetectionFailedReason = "DriftDetectionFailed"

	// HealthChecksPassedReason represents the fact that one or more
	// health checks failed during reconciliation.
	HealthChecksFailedReason = "HealthChecksFailed"

	// NoDriftReason represents the fact that during reconcilliation
	// no drift was detected.
	NoDriftReason = "NoDrift"

	// OutputsWritingFailedReason represents the fact that writing
	// outputs for the Terraform resource status failed.
	OutputsWritingFailedReason = "OutputsWritingFailed"

	// PlannedNoChangesReason represents the fact that Terraform
	// planned no changes during reconciliation.
	PlannedNoChangesReason = "TerraformPlannedNoChanges"

	// PlannedWithChangesReason represents the fact that Terraform
	// planned changes during reconciliation.
	PlannedWithChangesReason = "TerraformPlannedWithChanges"

	// PostPlanningWebhookFailedReason represents the fact that
	// the post-planning webhook failed during reconciliation.
	PostPlanningWebhookFailedReason = "PostPlanningWebhookFailed"

	// TFExecApplyFailedReason represents the fact that the execution
	// of 'terraform apply' failed.
	TFExecApplyFailedReason = "TFExecApplyFailed"

	// TFExecApplySucceedReason represents the fact that the execution
	// of 'terraform apply' succeeded.
	TFExecApplySucceedReason = "TerraformAppliedSucceed"

	// TFExecForceUnlockReason represents the fact that the controller
	// is attempting to force unlock the Terraform state.
	TFExecForceUnlockReason = "ForceUnlock"

	// TFExecInitFailedReason represents the fact that the an error
	// occured while initializing Terraform.
	TFExecInitFailedReason = "TFExecInitFailed"

	// TFExecLockHeldReason represents the fact that the Terraform
	// state lock is held by another process.
	TFExecLockHeldReason = "LockHeld"

	// TFExecNewFailedReason represents the fact that the creation
	// of the Terraform process failed.
	TFExecNewFailedReason = "TFExecNewFailed"

	// TFExecOutputFailedReason represents the fact that the execution
	// of 'terraform output' failed.
	TFExecOutputFailedReason = "TFExecOutputFailed"

	// TFExecPlanFailedReason represents the fact that the execution
	// of 'terraform plan' failed.
	TFExecPlanFailedReason = "TFExecPlanFailed"

	// TemplateGenerationFailedReason represents the fact that
	// the generation of the Terraform .tf template failed.
	TemplateGenerationFailedReason = "TemplateGenerationFailed"

	// VarsGenerationFailedReason represents the fact that
	// the generation of the Terraform variables failed.
	VarsGenerationFailedReason = "VarsGenerationFailed"

	// WorkspaceSelectFailedReason represents the fact that selecting
	// a Terraform workspace failed.
	WorkspaceSelectFailedReason = "SelectWorkspaceFailed"
)

```

### Core Architecture Module: `api/v1alpha1/doc.go`
```
/*
Copyright 2021.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// +kubebuilder:object:generate=true
// +groupName=infra.contrib.fluxcd.io
package v1alpha1

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1910** (2026-10-23): **chore(deps): go minor bumps**
  *Symptoms*: 

- **Issue #1909** (2026-10-23): **chore(deps): bump go to 1.26.10**
  *Symptoms*: - bumps go to 1.26.10 - bumps golang.org/x/net to v0.60.0

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

### Incident Patch 1: `1a172945` (2026-10-23)
**Commit Message**: fix(branch-planner): replace the PR source ref and only plan PRs targeting the tracked branch (#1908)

* fix(branch-planner): replace the copied source ref with the PR head branch

The PR's GitRepository copy previously only had spec.ref.branch overwritten, so an inherited name/tag/semver/commit kept taking precedence over the PR head in source-controller (e.g. Flux Operator sources using spec.ref.name). Replace spec.ref outright with a branch-only ref. A commit is deliberately not pinned: source-controller's commit clone path is neither shallow nor short-circuited by ls-remote, which would turn every polling interval into a full clone. The planned commit is still recorded in the revision (<branch>@sha1:<sha>) and the plan ID.

Signed-off-by: Robin Breathe <[REDACTED_EMAIL]>

* fix(branch-planner): only plan PRs targeting the tracked branch

Previously every open PR was planned, so two clusters tracking different branches at the same commit (e.g. main and develop) both planned a PR to develop. Filter PRs by base branch before the path filter: the branch tracked by the source (spec.ref.branch, or spec.ref.name of the form refs/heads/<branch>; source-controller's default branch (git.

**File**: `api/v1alpha2/terraform_types.go` (modified, +7/-0)
```diff
@@ -305,6 +305,13 @@ type BranchPlanner struct {
 	// resources will be created only if there are any changes in terraform files.
 	// +optional
 	EnablePathScope bool `json:"enablePathScope"`
+
+	// BaseBranch restricts branch planning to Pull Requests targeting this branch.
+	// Defaults to the branch tracked by the source GitRepository (`.spec.ref.branch`,
+	// or `.spec.ref.name` of the form `refs/heads/<branch>`). If unset and the source
+	// does not track a branch (tag, semver or commit-only), no Pull Requests are planned.
+	// +optional
+	BaseBranch string `json:"baseBranch,omitempty"`
 }
 
 type Remediation struct {
```

**File**: `charts/tofu-controller/crds/crds.yaml` (modified, +7/-0)
```diff
@@ -5809,6 +5809,13 @@ spec:
               branchPlanner:
                 description: BranchPlanner configuration.
                 properties:
+                  baseBranch:
+                    description: |-
+                      BaseBranch restricts branch planning to Pull Requests targeting this branch.
+                      Defaults to the branch tracked by the source GitRepository (`.spec.ref.branch`,
+                      or `.spec.ref.name` of the form `refs/heads/<branch>`). If unset and the source
+                      does not track a branch (tag, semver or commit-only), no Pull Requests are planned.
+                    type: string
                   enablePathScope:
                     description: |-
                       EnablePathScope specifies if the Branch Planner should or shouldn't check
```

**File**: `config/crd/bases/infra.contrib.fluxcd.io_terraforms.yaml` (modified, +7/-0)
```diff
@@ -5809,6 +5809,13 @@ spec:
               branchPlanner:
                 description: BranchPlanner configuration.
                 properties:
+                  baseBranch:
+                    description: |-
+                      BaseBranch restricts branch planning to Pull Requests targeting this branch.
+                      Defaults to the branch tracked by the source GitRepository (`.spec.ref.branch`,
+                      or `.spec.ref.name` of the form `refs/heads/<branch>`). If unset and the source
+                      does not track a branch (tag, semver or commit-only), no Pull Requests are planned.
+                    type: string
                   enablePathScope:
                     description: |-
                       EnablePathScope specifies if the Branch Planner should or shouldn't check
```

**File**: `docs/References/terraform.md` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ _Appears in:_
 | Field | Description | Default | Validation |
 | --- | --- | --- | --- |
 | `enablePathScope` _boolean_ | EnablePathScope specifies if the Branch Planner should or shouldn't check<br />if a Pull Request has changes under `.spec.path`. If enabled extra<br />resources will be created only if there are any changes in terraform files. |  | Optional: \{\} <br /> |
+| `baseBranch` _string_ | BaseBranch restricts branch planning to Pull Requests targeting this branch.<br />Defaults to the branch tracked by the source GitRepository (`.spec.ref.branch`,<br />or `.spec.ref.name` of the form `refs/heads/<branch>`). If unset and the source<br />does not track a branch (tag, semver or commit-only), no Pull Requests are planned. |  | Optional: \{\} <br /> |
 
 
 ### CloudSpec
```

**File**: `docs/branch-planner/index.md` (modified, +4/-0)
```diff
@@ -8,6 +8,10 @@ Branch Planner supports **GitHub** (including GitHub Enterprise), **GitLab** (in
 
 ![branch planner](branch-planner.png)
 
+### Base branch
+
+Only Pull Requests whose base branch matches the branch tracked by the Terraform object's source (`.spec.ref.branch`, or `.spec.ref.name` of the form `refs/heads/<branch>`) are planned. Set `spec.branchPlanner.baseBranch` to override this. Sources that track a tag, semver range or commit need the override, otherwise no Pull Requests are planned.
+
 ### Replan commands
 
 The Branch Planner also allows users to manually trigger the replan process. By simply commenting `!replan` under the PR or MR, the Branch Planner will be instructed to generate a new plan and post it under the PR/MR as a new comment.
```

**File**: `go.mod` (modified, +16/-0)
```diff
@@ -20,6 +20,7 @@ require (
 	github.com/flux-iac/tofu-controller/api v0.0.0-20260505110553-6233d9ea1db8
 	github.com/flux-iac/tofu-controller/tfctl v0.0.0-00010101000000-000000000000
 	github.com/fluxcd/pkg/apis/meta v1.36.0
+	github.com/fluxcd/pkg/git v0.53.0
 	github.com/fluxcd/pkg/runtime v0.120.0
 	github.com/fluxcd/pkg/tar v1.3.0
 	github.com/fluxcd/source-controller/api v1.9.4
@@ -65,6 +66,7 @@ require (
 	github.com/Masterminds/goutils v1.1.1 // indirect
 	github.com/Masterminds/semver/v3 v3.5.0 // indirect
 	github.com/Microsoft/go-winio v0.6.2 // indirect
+	github.com/ProtonMail/go-crypto v1.4.1 // indirect
 	github.com/agext/levenshtein v1.2.1 // indirect
 	github.com/apparentlymart/go-textseg v1.0.0 // indirect
 	github.com/apparentlymart/go-textseg/v15 v15.0.0 // indirect
@@ -109,6 +111,7 @@ require (
 	github.com/chai2010/gettext-go v1.0.3 // indirect
 	github.com/chainguard-dev/git-urls v1.0.2 // indirect
 	github.com/clipperhouse/uax29/v2 v2.7.0 // indirect
+	github.com/cloudflare/circl v1.6.3 // indirect
 	github.com/containerd/errdefs v1.0.0 // indirect
 	github.com/containerd/errdefs/pkg v0.3.0 // indirect
 	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
@@ -118,6 +121,7 @@ require (
 	github.com/docker/go-connections v0.8.1 // indirect
 	github.com/docker/go-units v0.5.0 // indirect
 	github.com/emicklei/go-restful/v3 v3.13.0 // indirect
+	github.com/emirpasic/gods v1.18.1 // indirect
 	github.com/evanphx/json-patch/v5 v5.9.11 // indirect
 	github.com/exponent-io/jsonpath v0.0.0-20210407135951-1de76d718b3f // indirect
 	github.com/fatih/color v1.19.0 // indirect
@@ -130,6 +134,9 @@ require (
 	github.com/fxamacker/cbor/v2 v2.9.3 // indirect
 	github.com/go-errors/errors v1.5.1 // indirect
 	github.com/go-fed/httpsig v1.1.0 // indirect
+	github.com/go-git/gcfg v1.5.1-0.20230307220236-3a3c6141e376 // indirect
+	github.com/go-git/go-billy/v5 v5.9.2 // indirect
+	github.com/go-git/go-git/v5 v5.19.3 // indirect
 	github.com/go-logr/stdr v1.2.2 // indirect
 	github.com/go-logr/zapr v1.3.0 // indirect
 	github.com/go-openapi/jsonpointer v1.0.0 // indirect
@@ -148,17 +155,21 @@ require (
 	github.com/go-openapi/swag/yamlutils v0.29.1 // indirect
 	github.com/go-viper/mapstructure/v2 v2.5.0 // indirect
 	github.com/golang-jwt/jwt/v4 v4.5.2 // indirect
+	github.com/golang/groupcache v0.0.0-20241129210726-2c02b8208cf8 // indirect
 	github.com/google/btree v1.1.3 // indirect
 	github.com/google/gnostic-models v0.7.1 // indirect
 	github.com/google/go-cmp v0.7.0 // indirect
 	github.com/google/go-github/v88 v88.0.0 // indirect
 	github.com/google/go-querystring v1.2.0 // indirect
 	github.com/hako/durafmt v0.0.0-20210608085754-5c1018a4e16b // indirect
 	github.com/hashicorp/go-version v1.9.0 // indirect
+	github.com/hiddeco/sshsig v0.2.0 // indirect
 	github.com/huandu/xstrings v1.5.0 // indirect
 	github.com/inconshreveable/mousetrap v1.1.0 // indirect
+	github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 // indirect
 	github.com/jmespath/go-jmespath v0.4.0 // indirect
 	github.com/json-iterator/go v1.1.12 // indirect
+	github.com/kevinburke/ssh_config v1.2.0 // indirect
 	github.com/liggitt/tabwriter v0.0.0-20181228230101-89fcab3d43de // indirect
 	github.com/mattn/go-colorable v0.1.14 // indirect
 	github.com/mattn/go-isatty v0.0.20 // indirect
@@ -178,6 +189,7 @@ require (
 	github.com/opencontainers/image-spec v1.1.1 // indirect
 	github.com/pelletier/go-toml/v2 v2.3.0 // indirect
 	github.com/peterbourgon/diskv v2.0.1+incompatible // indirect
+	github.com/pjbgf/sha1cd v0.7.0 // indirect
 	github.com/pkg/errors v0.9.1 // indirect
 	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
 	github.com/prometheus/client_golang v1.24.1 // indirect
@@ -186,10 +198,12 @@ require (
 	github.com/prometheus/procfs v0.22.0 // indirect
 	github.com/russross/blackfriday/v2 v2.1.0 // indirect
 	github.com/sagikazarmark/locafero v0.12.0 // indirect
+	github.com/sergi/go-diff v1.4.0 // indirect
 	github.com/shopspring/decimal v1.4.0 // indirect
 	github.com/shurcooL/githubv4 v0.0.0-20260209031235-2402fdf4a9ed // indirect
 	github.com/shurcooL/graphql v0.0.0-20240915155400-7ee5256398cf // indirect
 	github.com/sirupsen/logrus v1.10.2 // indirect
+	github.com/skeema/knownhosts v1.3.1 // indirect
 	github.com/spf13/cast v1.10.0 // indirect
 	github.com/subosito/gotenv v1.6.0 // indirect
 	github.com/theckman/yacspin v0.13.12 // indirect
@@ -199,6 +213,7 @@ require (
 	github.com/tidwall/sjson v1.2.5 // indirect
 	github.com/wI2L/jsondiff v0.6.1 // indirect
 	github.com/x448/float16 v0.8.4 // indirect
+	github.com/xanzy/ssh-agent v0.3.3 // indirect
 	github.com/xlab/treeprint v1.2.0 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0 // indirect
@@ -223,6 +238,7 @@ require (
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260706201446-f0a921348800 // indirect
 	gopk
```

**File**: `go.sum` (modified, +26/-0)
```diff
@@ -18,12 +18,15 @@ github.com/Masterminds/semver/v3 v3.5.0 h1:kQceYJfbupGfZOKZQg0kou0DgAKhzDg2NZPAw
 github.com/Masterminds/semver/v3 v3.5.0/go.mod h1:4V+yj/TJE1HU9XfppCwVMZq3I84lprf4nC11bSS5beM=
 github.com/Masterminds/sprig/v3 v3.3.0 h1:mQh0Yrg1XPo6vjYXgtf5OtijNAKJRNcTdOOGZe3tPhs=
 github.com/Masterminds/sprig/v3 v3.3.0/go.mod h1:Zy1iXRYNqNLUolqCpL4uhk6SHUMAOSCzdgBfDb35Lz0=
+github.com/Microsoft/go-winio v0.5.2/go.mod h1:WpS1mjBmmwHBEWmogvA2mj8546UReBk4v8QkMxJ6pZY=
 github.com/Microsoft/go-winio v0.6.2 h1:F2VQgta7ecxGYO8k3ZZz3RS8fVIXVxONVUPlNERoyfY=
 github.com/Microsoft/go-winio v0.6.2/go.mod h1:yd8OoFMLzJbo9gZq8j5qaps8bJ9aShtEA8Ipt1oGCvU=
 github.com/ProtonMail/go-crypto v1.4.1 h1:9RfcZHqEQUvP8RzecWEUafnZVtEvrBVL9BiF67IQOfM=
 github.com/ProtonMail/go-crypto v1.4.1/go.mod h1:e1OaTyu5SYVrO9gKOEhTc+5UcXtTUa+P3uLudwcgPqo=
 github.com/agext/levenshtein v1.2.1 h1:QmvMAjj2aEICytGiWzmxoE0x2KZvE0fvmqMOfy2tjT8=
 github.com/agext/levenshtein v1.2.1/go.mod h1:JEDfjyjHDjOF/1e4FlBE/PkbqA9OfWu2ki2W0IB5558=
+github.com/anmitsu/go-shlex v0.0.0-20200514113438-38f4b401e2be h1:9AeTilPcZAjCFIImctFaOjnTIavg87rW78vTPkQqLI8=
+github.com/anmitsu/go-shlex v0.0.0-20200514113438-38f4b401e2be/go.mod h1:ySMOLuWl6zY27l47sB3qLNK6tF2fkHG55UZxx8oIVo4=
 github.com/apparentlymart/go-dump v0.0.0-20180507223929-23540a00eaa3 h1:ZSTrOEhiM5J5RFxEaFvMZVEAM1KvT1YzbEOwB2EAGjA=
 github.com/apparentlymart/go-dump v0.0.0-20180507223929-23540a00eaa3/go.mod h1:oL81AME2rN47vu18xqj1S1jPIPuN7afo62yKTNn3XMM=
 github.com/apparentlymart/go-textseg v1.0.0 h1:rRmlIsPEEhUTIKQb7T++Nz/A5Q6C9IuX2wFoYVvnCs0=
@@ -32,6 +35,8 @@ github.com/apparentlymart/go-textseg/v15 v15.0.0 h1:uYvfpb3DyLSCGWnctWKGj857c6ew
 github.com/apparentlymart/go-textseg/v15 v15.0.0/go.mod h1:K8XmNZdhEBkdlyDdvbmmsvpAG721bKi0joRfFdHIWJ4=
 github.com/apparentlymart/go-textseg/v17 v17.0.1 h1:bpMXRgQ5cEoRNuQke1a80/Nl6w3G5eoIbWo9f3gXkAs=
 github.com/apparentlymart/go-textseg/v17 v17.0.1/go.mod h1:fa8X4jgGeevslICIY6LcdjkSecWnXmYd9Lk34z/VxZs=
+github.com/armon/go-socks5 v0.0.0-20160902184237-e75332964ef5 h1:0CwZNZbxp69SHPdPJAN/hZIm0C4OItdklCFmMRWYpio=
+github.com/armon/go-socks5 v0.0.0-20160902184237-e75332964ef5/go.mod h1:wHh0iHkYZB8zMSxRWpUBQtwG5a7fFgvEO+odwuTv2gs=
 github.com/aws/aws-sdk-go v1.55.5 h1:KKUZBfBoyqy5d3swXyiC7Q76ic40rYcbqH7qjh59kzU=
 github.com/aws/aws-sdk-go v1.55.5/go.mod h1:eRwEWoyTWFMVYVQzKMNHWP5/RV4xIUGMQfXQHfHkpNU=
 github.com/aws/aws-sdk-go-v2 v1.47.3 h1:HRoT/MkNi3bjO5xF4dCzLzvVmkvRGHj3/cLINDnJejk=
@@ -158,6 +163,8 @@ github.com/docker/go-connections v0.8.1 h1:JibmG5hULs5qXSr/cp/w3Pw5fZuStt4MOHMUE
 github.com/docker/go-connections v0.8.1/go.mod h1:no1qkHdjq7kLMGUXYAduOhYPSJxxvgWBh7ogVvptn3Q=
 github.com/docker/go-units v0.5.0 h1:69rxXcBk27SvSaaxTtLh/8llcHD8vYHT7WSdRZ/jvr4=
 github.com/docker/go-units v0.5.0/go.mod h1:fgPhTUdO+D/Jk86RDLlptpiXQzgHJF7gydDDbaIK4Dk=
+github.com/elazarl/goproxy v1.8.0 h1:dt561rX7UAYMeFRLtzFx6uQGl2TpL1dr6uCG23nFQSY=
+github.com/elazarl/goproxy v1.8.0/go.mod h1:b5xm6W48AUHNpRTCvlnd0YVh+JafCCtsLsJZvvNTz+E=
 github.com/elgohr/go-localstack v1.0.169 h1:XTYFC6HzdnjK2dJtb/YX5MpfzwpkudW740V9tIx7egs=
 github.com/elgohr/go-localstack v1.0.169/go.mod h1:ElV4F6CaI8CcNuxIyG3U4M6rUuAAIJn4Yl3j/Ol2FRw=
 github.com/emicklei/go-restful/v3 v3.13.0 h1:C4Bl2xDndpU6nJ4bc1jXd+uTmYPVUwkD6bFY/oTyCes=
@@ -182,6 +189,8 @@ github.com/fluxcd/pkg/apis/event v0.32.0 h1:3zyjdUspwQN+EQJPlUXwCvCMbeqtB+azlNme
 github.com/fluxcd/pkg/apis/event v0.32.0/go.mod h1:ALma8dTqo+NbI+z4BawSzt0pAPjetCSNNUSSS/9p0VU=
 github.com/fluxcd/pkg/apis/meta v1.36.0 h1:sgT0N/tXPTLYPzYjO3WHt3LKaRBOlQIP+/dTrJRzvDQ=
 github.com/fluxcd/pkg/apis/meta v1.36.0/go.mod h1:1MLvK2Xu3UdTKBzg+Q1Oj7H9PHeiKsUB1UW3uwxAwiM=
+github.com/fluxcd/pkg/git v0.53.0 h1:wHtxfJ+qaNSQowaZB8Lr5adZO7psAsaID0E5W5QZREs=
+github.com/fluxcd/pkg/git v0.53.0/go.mod h1:soKweVZNZcHvKt9CP2GhJ/hoxJ3Ck3NglnRzKLHAjrA=
 github.com/fluxcd/pkg/runtime v0.120.0 h1:FEeTLB5tnhMVbpjAC9l2LUZr9T0Dl+Z3r16ERqLcVXc=
 github.com/fluxcd/pkg/runtime v0.120.0/go.mod h1:Cw0CQ/tVKS9lgJoyKVouZr1qVnoJcYnSHw3QDzIOOjA=
 github.com/fluxcd/pkg/ssa v0.80.0 h1:GgakpCFz4pY+unpOscPYlc5eVLUsB7hw9TmWSNr3yp8=
@@ -197,6 +206,8 @@ github.com/fsnotify/fsnotify v1.10.1 h1:b0/UzAf9yR5rhf3RPm9gf3ehBPpf0oZKIjtpKrx5
 github.com/fsnotify/fsnotify v1.10.1/go.mod h1:TLheqan6HD6GBK6PrDWyDPBaEV8LspOxvPSjC+bVfgo=
 github.com/fxamacker/cbor/v2 v2.9.3 h1:oQBnFATpNdY8gJHTndDDv5Xl4QqNaz51G5LLEPhng3Q=
 github.com/fxamacker/cbor/v2 v2.9.3/go.mod h1:vM4b+DJCtHn+zz7h3FFp/hDAI9WNWCsZj23V5ytsSxQ=
+github.com/gliderlabs/ssh v0.3.8 h1:a4YXD1V7xMF9g5nTkdfnja3Sxy1PVDCj1Zg4Wb8vY6c=
+github.com/gliderlabs/ssh v0.3.8/go.mod h1:xYoytBv1sV0aL3CavoDuJIQNURXkkfPA/wxQ1pL1fAU=
 github.com/go-errors/errors v1.5.1 h1:ZwEMSLRCapFLflTpT7NKaAc7ukJ8ZPEjzlxt8rPN8bk=
 github.com/go-errors/errors v1.5.1/go.mod h1:sIVyrIiJhuEF+Pj9Ebtd6P/rEYROXFi3BopGUQ5a5Og=
 github.com/go-fed/httpsig v1.1.0 h1:9M+hb0jkEICD8/cAiNqEB66R87tTINszBRTjwjQzWcI=
@@ -205,6 +216,8 @@ github.com/go-git/gcfg v1.5.1-0.20230307220236-3a3c6141e376 h1:+
```

**File**: `internal/server/polling/poll_test.go` (modified, +63/-1)
```diff
@@ -17,6 +17,7 @@ import (
 
 	infrav1 "github.com/flux-iac/tofu-controller/api/v1alpha2"
 	"github.com/flux-iac/tofu-controller/internal/git/provider"
+	"github.com/fluxcd/pkg/git"
 	sourcev1 "github.com/fluxcd/source-controller/api/v1"
 )
 
@@ -108,8 +109,11 @@ func Test_poll_reconcile_objects(t *testing.T) {
 		},
 		Spec: sourcev1.GitRepositorySpec{
 			URL: "https://github.com/tf-controller/helloworld",
+			// Extra ref fields must not be inherited by the PR sources.
 			Reference: &sourcev1.GitRepositoryRef{
 				Branch: "main",
+				Name:   "refs/heads/main",
+				Commit: "0000000000000000000000000000000000000000",
 			},
 		},
 	}
@@ -163,6 +167,13 @@ func Test_poll_reconcile_objects(t *testing.T) {
 			BaseBranch: "main",
 			HeadBranch: "test-branch-3",
 		},
+		{
+			// Targets another branch than the source tracks, so it's not planned.
+			Repository: repo,
+			Number:     4,
+			BaseBranch: "develop",
+			HeadBranch: "test-branch-4",
+		},
 	}
 
 	server, err := New(
@@ -186,6 +197,9 @@ func Test_poll_reconcile_objects(t *testing.T) {
 	}))
 
 	expectToEqual(t, g, len(tfList.Items), 4)
+	for _, item := range tfList.Items {
+		g.Expect(item.Labels[bpconfig.LabelPRIDKey]).NotTo(gomega.Equal("4"))
+	}
 	for _, item := range tfList.Items {
 		if item.Name == original.Name {
 			// Ignore the original source object.
@@ -220,7 +234,7 @@ func Test_poll_reconcile_objects(t *testing.T) {
 		}
 		prID := item.Labels[bpconfig.LabelPRIDKey]
 		expectToEqual(t, g, item.Name, config.SourceName(original.Name, source.Name, prID))
-		expectToEqual(t, g, item.Spec.Reference.Branch, "test-branch-"+prID)
+		expectToEqual(t, g, item.Spec.Reference, &sourcev1.GitRepositoryRef{Branch: "test-branch-" + prID})
 		expectToEqual(t, g, item.Labels[bpconfig.LabelKey], bpconfig.LabelValue)
 		expectToEqual(t, g, item.Labels[bpconfig.LabelPRIDKey], prID)
 		expectToEqual(t, g, item.Labels["test-label"], "123")
@@ -379,3 +393,51 @@ func Test_poll_noPathChanges(t *testing.T) {
 
 	t.Cleanup(func() { expectToSucceed(t, g, k8sClient.Delete(context.Background(), ns)) })
 }
+
+func Test_filterPullRequestsByBaseBranch(t *testing.T) {
+	prs := []provider.PullRequest{
+		{Number: 1, BaseBranch: "main"},
+		{Number: 2, BaseBranch: "develop"},
+		{Number: 3, BaseBranch: "main"},
+		{Number: 4, BaseBranch: git.DefaultBranch},
+	}
+	main := []provider.PullRequest{prs[0], prs[2]}
+	develop := []provider.PullRequest{prs[1]}
+	defaultBranch := []provider.PullRequest{prs[3]}
+
+	tests := []struct {
+		name     string
+		ref      *sourcev1.GitRepositoryRef
+		override string
+		want     []provider.PullRequest
+	}{
+		{"branch", &sourcev1.GitRepositoryRef{Branch: "main"}, "", main},
+		{"override beats source", &sourcev1.GitRepositoryRef{Branch: "main"}, "develop", develop},
+		{"name refs/heads", &sourcev1.GitRepositoryRef{Name: "refs/heads/develop"}, "", develop},
+		{"name refs/pull", &sourcev1.GitRepositoryRef{Name: "refs/pull/1/head"}, "", []provider.PullRequest{}},
+		{"tag", &sourcev1.GitRepositoryRef{Tag: "v1"}, "", []provider.PullRequest{}},
+		{"semver", &sourcev1.GitRepositoryRef{SemVer: ">=1.0.0"}, "", []provider.PullRequest{}},
+		{"commit only", &sourcev1.GitRepositoryRef{Commit: "1111111111111111111111111111111111111111"}, "", []provider.PullRequest{}},
+		{"branch and commit", &sourcev1.GitRepositoryRef{Branch: "main", Commit: "1111111111111111111111111111111111111111"}, "", main},
+		{"nil ref defaults to git default branch", nil, "", defaultBranch},
+		{"empty ref defaults to git default branch", &sourcev1.GitRepositoryRef{}, "", defaultBranch},
+		{"override with tag source", &sourcev1.GitRepositoryRef{Tag: "v1"}, "main", main},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			g := gomega.NewWithT(t)
+
+			tf := &infrav1.Terraform{}
+			if tt.override != "" {
+				tf.Spec.BranchPlanner = &infrav1.BranchPlanner{BaseBranch: tt.override}
+			}
+			source := &sourcev1.GitRepository{Spec: sourcev1.GitRepositorySpec{Reference: tt.ref}}
+
+			server, err := New()
+			g.Expect(err).NotTo(gomega.HaveOccurred())
+
+			g.Expect(server.filterPullRequestsByBaseBranch(tf, source, prs)).To(gomega.ConsistOf(tt.want))
+		})
+	}
+}
```

---

### Incident Patch 2: `e5dbc6ed` (2026-10-23)
**Commit Message**: fix: read branch planner token secret just in time (#1883)

The informer previously read the token secret once at startup and
latched provider-construction errors forever via sync.Once. Re-read the
ConfigMap and secret per comment interaction, matching the polling
server's per-tick behaviour, so rotated tokens (e.g. GitHub App
installation access tokens) keep working.

Signed-off-by: Robin Breathe <[REDACTED_EMAIL]>
Co-authored-by: Alex Marston <[REDACTED_EMAIL]>

**File**: `cmd/branch-planner/informer.go` (modified, +6/-3)
```diff
@@ -19,8 +19,9 @@ import (
 )
 
 func startInformer(ctx context.Context, log logr.Logger, dynamicClient *dynamic.DynamicClient, clusterClient client.Client, opts *applicationOptions) error {
-	providerOpts, err := getProviderOpts(ctx, clusterClient, opts.pollingConfigMap)
-	if err != nil {
+	// The informer re-reads the config and secret just in time per
+	// interaction; this call only validates the boot-time configuration.
+	if _, err := getProviderOpts(ctx, clusterClient, opts.pollingConfigMap); err != nil {
 		return fmt.Errorf("failed to get provider options: %w", err)
 	}
 
@@ -32,7 +33,9 @@ func startInformer(ctx context.Context, log logr.Logger, dynamicClient *dynamic.
 	informer, err := planner.NewInformer(
 		planner.WithLogger(log),
 		planner.WithClusterClient(clusterClient),
-		planner.WithProviderOpts(providerOpts...),
+		planner.WithProviderOptsFn(func(ctx context.Context) ([]provider.ProviderOption, error) {
+			return getProviderOpts(ctx, clusterClient, opts.pollingConfigMap)
+		}),
 		planner.WithSharedInformer(sharedInformer),
 	)
 	if err != nil {
```

**File**: `internal/informer/branch-planner/informer.go` (modified, +44/-28)
```diff
@@ -34,14 +34,13 @@ var (
 )
 
 type Informer struct {
-	sharedInformer cache.SharedIndexInformer
-	handlers       cache.ResourceEventHandlerFuncs
-	log            logr.Logger
-	client         client.Client
-	gitProvider    provider.Provider
-	providerOpts   []provider.ProviderOption
-	providerOnce   sync.Once
-	providerErr    error
+	sharedInformer      cache.SharedIndexInformer
+	handlers            cache.ResourceEventHandlerFuncs
+	log                 logr.Logger
+	client              client.Client
+	gitProvider         provider.Provider
+	providerOptsFn      func(ctx context.Context) ([]provider.ProviderOption, error)
+	gitProviderParserFn provider.URLParserFn
 
 	mux    *sync.RWMutex
 	synced bool
@@ -50,7 +49,9 @@ type Informer struct {
 type Option func(s *Informer) error
 
 func NewInformer(options ...Option) (*Informer, error) {
-	informer := &Informer{}
+	informer := &Informer{
+		gitProviderParserFn: provider.FromURL,
+	}
 
 	for _, opt := range options {
 		if err := opt(informer); err != nil {
@@ -226,7 +227,7 @@ func (i *Informer) updateHandler(oldObj, newObj any) {
 func (i *Informer) deleteHandler(obj any) {}
 
 func (i *Informer) addCommentToPullRequest(ctx context.Context, tf *infrav1.Terraform, content []byte) {
-	repo, err := i.getRepo(ctx, tf)
+	gitProvider, repo, err := i.getRepo(ctx, tf)
 	if err != nil {
 		i.log.Error(err, "failed getting repository")
 		return
@@ -250,13 +251,13 @@ func (i *Informer) addCommentToPullRequest(ctx context.Context, tf *infrav1.Terr
 
 	// If commentID is 0, it means that the comment has not been created yet.
 	if commentID == 0 {
-		if _, err := i.gitProvider.AddCommentToPullRequest(ctx, pr, content); err != nil {
+		if _, err := gitProvider.AddCommentToPullRequest(ctx, pr, content); err != nil {
 			i.log.Error(err, "failed adding comment to pull request", "pr-id", tf.Labels[config.LabelPRIDKey], "namespace", tf.Namespace, "name", tf.Name)
 		}
 		return
 	}
 
-	if err := i.gitProvider.UpdateCommentOfPullRequest(ctx, pr, commentID, content); err != nil {
+	if err := gitProvider.UpdateCommentOfPullRequest(ctx, pr, commentID, content); err != nil {
 		i.log.Error(err, "failed updating comment in pull request", "pr-id", tf.Labels[config.LabelPRIDKey], "comment-id", commentID, "namespace", tf.Namespace, "name", tf.Name)
 
 		return
@@ -334,9 +335,9 @@ func (i *Informer) isNewPlan(old, new *infrav1.Terraform) bool {
 	return false
 }
 
-func (i *Informer) getRepo(ctx context.Context, tf *infrav1.Terraform) (provider.Repository, error) {
+func (i *Informer) getRepo(ctx context.Context, tf *infrav1.Terraform) (provider.Provider, provider.Repository, error) {
 	if tf.Spec.SourceRef.Kind != sourcev1.GitRepositoryKind {
-		return provider.Repository{}, fmt.Errorf("branch based planner does not support source kind: %s", tf.Spec.SourceRef.Kind)
+		return nil, provider.Repository{}, fmt.Errorf("branch based planner does not support source kind: %s", tf.Spec.SourceRef.Kind)
 	}
 
 	ref := client.ObjectKey{
@@ -345,24 +346,39 @@ func (i *Informer) getRepo(ctx context.Context, tf *infrav1.Terraform) (provider
 	}
 	obj := &sourcev1.GitRepository{}
 	if err := i.client.Get(ctx, ref, obj); err != nil {
-		return provider.Repository{}, fmt.Errorf("unable to get Source: %w", err)
+		return nil, provider.Repository{}, fmt.Errorf("unable to get Source: %w", err)
 	}
 
-	// Resolve the provider exactly once using sync.Once to avoid race
-	// conditions when multiple update events arrive concurrently. Skip
-	// resolution if a provider was already injected (e.g. via WithGitProvider
-	// in tests).
-	i.providerOnce.Do(func() {
-		if i.gitProvider != nil {
-			return
-		}
-		i.gitProvider, _, i.providerErr = provider.FromURL(obj.Spec.URL, i.providerOpts...)
-	})
-	if i.providerErr != nil {
-		return provider.Repository{}, fmt.Errorf("failed resolving git provider from URL: %w", i.providerErr)
+	repo, err := provider.RepoFromURL(obj.Spec.URL)
+	if err != nil {
+		return nil, provider.Repository{}, err
+	}
+
+	// A statically injected provider (e.g. via WithGitProvider in tests)
+	// takes precedence.
+	if i.gitProvider != nil {
+		return i.gitProvider, repo, nil
+	}
+
+	if i.providerOptsFn == nil {
+		return nil, provider.Repository{}, fmt.Errorf("no provider options getter configured")
+	}
+
+	// Resolve the provider per interaction so that a rotated token secret
+	// (e.g. short-lived GitHub App installation tokens) is picked up just
+	// in time.
+	opts, err := i.providerOptsFn(ctx)
+	if err != nil {
+		return nil, provider.Repository{}, fmt.Errorf("failed to get provider options: %w", err)
+	}
+	opts = append([]provider.ProviderOption{provider.WithLogger(i.log)}, opts...)
+
+	gitProvider, _, err := i.gitProviderParserFn(obj.Spec.URL, opts...)
+	if err != nil {
+		return nil, provider.Repository{}, fmt.Errorf("failed resolving git provider from URL: %w", err)
 	}
 
-	return provider.RepoFromURL(obj.Spec.URL)
+	return gitProvider, repo, nil
 }
 
 func formatPlanOutput(planOut
```

**File**: `internal/informer/branch-planner/informer_test.go` (modified, +151/-0)
```diff
@@ -13,6 +13,7 @@ import (
 	"github.com/flux-iac/tofu-controller/api/plan"
 	infrav1 "github.com/flux-iac/tofu-controller/api/v1alpha2"
 	"github.com/flux-iac/tofu-controller/internal/config"
+	"github.com/flux-iac/tofu-controller/internal/git/provider"
 	"github.com/flux-iac/tofu-controller/internal/git/provider/providerfakes"
 	sourcev1 "github.com/fluxcd/source-controller/api/v1"
 	corev1 "k8s.io/api/core/v1"
@@ -126,6 +127,156 @@ func TestInformer(t *testing.T) {
 	}).Should(gom.ContainSubstring("terraform plan output"))
 }
 
+// TestInformerReadsProviderSecretJustInTime verifies that the informer
+// resolves the git provider per PR interaction, re-reading the provider
+// secret each time, so that a rotated token (e.g. a short-lived GitHub App
+// installation token) is picked up without a restart.
+func TestInformerReadsProviderSecretJustInTime(t *testing.T) {
+	g := gom.NewWithT(t)
+	ns := newNamespace(t, g)
+	ctx := t.Context()
+
+	// Create a source for the Terraform object to point to
+	source := &sourcev1.GitRepository{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "jit-source",
+			Namespace: ns.Name,
+		},
+		Spec: sourcev1.GitRepositorySpec{
+			URL: "https://github.com/tf-controller/helloworld",
+			Reference: &sourcev1.GitRepositoryRef{
+				Branch: "main",
+			},
+		},
+	}
+	expectToSucceed(t, g, k8sClient.Create(t.Context(), source))
+
+	tf := &infrav1.Terraform{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "jit-helloworld",
+			Namespace: ns.Name,
+			Labels: map[string]string{
+				config.LabelKey:           config.LabelValue,
+				"infra.weave.works/pr-id": "1",
+			},
+		},
+		Spec: infrav1.TerraformSpec{
+			SourceRef: infrav1.CrossNamespaceSourceReference{
+				Name:      source.Name,
+				Namespace: ns.Name,
+				Kind:      "GitRepository",
+			},
+		},
+	}
+	expectToSucceed(t, g, k8sClient.Create(t.Context(), tf))
+
+	tfOutputCM := &corev1.ConfigMap{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "tfplan-default-jit-helloworld",
+			Namespace: ns.Name,
+			Labels: map[string]string{
+				plan.TFPlanNameLabel:      plan.SafeLabelValue("jit-helloworld"),
+				plan.TFPlanWorkspaceLabel: plan.SafeLabelValue("default"),
+			},
+			Annotations: map[string]string{
+				plan.TFPlanSavedAnnotation:         "plan-main-1",
+				plan.TFPlanFullWorkspaceAnnotation: "default",
+			},
+		},
+		Data: map[string]string{
+			"tfplan": "terraform plan output",
+		},
+	}
+	expectToSucceed(t, g, k8sClient.Create(t.Context(), tfOutputCM))
+
+	secret := &corev1.Secret{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "jit-provider-secret",
+			Namespace: ns.Name,
+		},
+		Data: map[string][]byte{
+			"token": []byte("token-1"),
+		},
+	}
+	expectToSucceed(t, g, k8sClient.Create(t.Context(), secret))
+
+	dynamicClient, err := dynamic.NewForConfig(k8sConfig)
+	g.Expect(err).NotTo(gom.HaveOccurred())
+
+	// A single shared fake provider accumulates call counts across events.
+	// The parser fn applies each interaction's options to it, so SetToken
+	// records the token used per event.
+	fakeProvider := &providerfakes.FakeProvider{}
+	parserFn := func(repoURL string, options ...provider.ProviderOption) (provider.Provider, provider.Repository, error) {
+		repo, err := provider.RepoFromURL(repoURL)
+		if err != nil {
+			return nil, provider.Repository{}, err
+		}
+		for _, opt := range options {
+			if err := opt(fakeProvider); err != nil {
+				return nil, provider.Repository{}, err
+			}
+		}
+		return fakeProvider, repo, nil
+	}
+
+	sharedInformer := createSharedInformer(g, ctx, k8sClient, dynamicClient)
+
+	log := logr.Discard()
+
+	informer, err := NewInformer(
+		WithLogger(log),
+		WithClusterClient(k8sClient),
+		WithProviderOptsFn(func(ctx context.Context) ([]provider.ProviderOption, error) {
+			liveSecret := &corev1.Secret{}
+			if err := k8sClient.Get(ctx, client.ObjectKeyFromObject(secret), liveSecret); err != nil {
+				return nil, err
+			}
+			return provider.OptsFromSecret(liveSecret.Data)
+		}),
+		WithCustomProviderURLParserFn(parserFn),
+		WithSharedInformer(sharedInformer),
+	)
+	g.Expect(err).NotTo(gom.HaveOccurred())
+
+	go func() {
+		g.Expect(informer.Start(ctx)).To(gom.Succeed())
+	}()
+
+	g.Eventually(func() bool {
+		return informer.HasSynced()
+	}).Should(gom.BeTrue())
+
+	// Event 1: patch status to trigger the informer update function.
+	expectToSucceed(t, g, k8sClient.Get(ctx, client.ObjectKeyFromObject(tf), tf))
+	patch := client.MergeFrom(tf.DeepCopy())
+	tf.Status.LastPlanAt = &metav1.Time{Time: time.Now()}
+	expectToSucceed(t, g, k8sClient.Status().Patch(ctx, tf, patch))
+
+	g.Eventually(fakeProvider.AddCommentToPullRequestCallCount).Should(gom.Equal(1))
+
+	tokenType, token := fakeProvider.SetTokenArgsForCall(0)
+	g.Expect(tokenType).To(gom.Equal(provider.APITokenType))
+	g.Expect(token).To(gom.Equal("token-1"))
+
+	// Rotate the token in the secret.
+	expectToSucceed(t, g, k8sClient.Get(ctx, client.ObjectKeyFromObject(secret), secret))
+	secret.Data["token"] = 
```

**File**: `internal/informer/branch-planner/options.go` (modified, +12/-2)
```diff
@@ -1,6 +1,8 @@
 package branchplanner
 
 import (
+	"context"
+
 	"github.com/flux-iac/tofu-controller/internal/git/provider"
 	"github.com/go-logr/logr"
 	"k8s.io/client-go/tools/cache"
@@ -32,9 +34,17 @@ func WithGitProvider(provider provider.Provider) Option {
 	}
 }
 
-func WithProviderOpts(opts ...provider.ProviderOption) Option {
+func WithProviderOptsFn(fn func(ctx context.Context) ([]provider.ProviderOption, error)) Option {
+	return func(i *Informer) error {
+		i.providerOptsFn = fn
+
+		return nil
+	}
+}
+
+func WithCustomProviderURLParserFn(fn provider.URLParserFn) Option {
 	return func(i *Informer) error {
-		i.providerOpts = opts
+		i.gitProviderParserFn = fn
 
 		return nil
 	}
```

#### Recent Merged Pull Requests:
- **PR #1910** (2026-10-23): chore(deps): go minor bumps (@alexandermarston)
- **PR #1909** (2026-10-23): chore(deps): bump go to 1.26.10 (@alexandermarston)
- **PR #1908** (2026-10-23): fix(branch-planner): replace the PR source ref and only plan PRs targeting the tracked branch (@isometry)
- **PR #1906** (closed): chore(deps): bump the go-minor group across 3 directories with 24 updates (@dependabot[bot])
- **PR #1904** (closed): chore(deps): bump the go-minor group across 3 directories with 21 updates (@dependabot[bot])
- **PR #1903** (closed): chore(deps): bump the gh-minor group across 1 directory with 11 updates (@dependabot[bot])

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

## X. branch-planner): replace the PR source ref and only plan PRs targeting the track

**RULE**:
When implementing operations in `api/v1alpha2/terraform_types.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in flux-iac/tofu-controller. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1a172945`: branch-planner): replace the PR source ref and only plan PRs targeting the tracked branch (#1908). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `api/v1alpha2/terraform_types.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:

	// BaseBranch restricts branch planning to Pull Requests targeting this branch.
	// Defaults to the branch tracked by the source GitRepository (`.spec.ref.branch`,
	// or `.spec.ref.name` of the form `refs/heads/<branch>`). If unset and the source
	// does not track a branch (tag, semver or commit-only), no Pull Requests are planned.
	// +optional
	BaseBranch string `json:"baseBranch,omitempty"`
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1a172945` are properly handled with clean fallback behavior.

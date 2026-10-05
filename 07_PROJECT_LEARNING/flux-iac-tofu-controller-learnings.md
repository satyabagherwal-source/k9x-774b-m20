# Forensic Learning Record (Deep Inspection): flux-iac/tofu-controller

> **Canonical Artifact**: `07_PROJECT_LEARNING/flux-iac-tofu-controller-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/flux-iac/tofu-controller](https://github.com/flux-iac/tofu-controller))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:32:08.376Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `flux-iac/tofu-controller`
- **Description**: A GitOps OpenTofu and Terraform controller for Flux
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 1708 stars

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

### Core Architecture Module: `api/v1alpha1/groupversion_info.go`
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

// Package v1alpha1 contains API Schema definitions for the infra v1alpha1 API group
//+kubebuilder:object:generate=true
//+groupName=infra.contrib.fluxcd.io
package v1alpha1

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/scheme"
)

var (
	// GroupVersion is group version used to register these objects
	GroupVersion = schema.GroupVersion{Group: "infra.contrib.fluxcd.io", Version: "v1alpha1"}

	// SchemeBuilder is used to add go types to the GroupVersionKind scheme
	SchemeBuilder = &scheme.Builder{GroupVersion: GroupVersion}

	// AddToScheme adds the types in this group-version to the given scheme.
	AddToScheme = SchemeBuilder.AddToScheme
)

```

### Core Architecture Module: `api/v1alpha1/inventory_types.go`
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

// ResourceInventory contains a list of Kubernetes resource object references that have been applied by a Kustomization.
type ResourceInventory struct {
	// Entries of Kubernetes resource object references.
	Entries []ResourceRef `json:"entries"`
}

// ResourceRef contains the information necessary to locate a resource within a cluster.
type ResourceRef struct {
	// Terraform resource's name.
	Name string `json:"n"`

	// Type is Terraform resource's type
	Type string `json:"t"`

	// ID is the resource identifier. This is cloud-specific. For example, ARN is an ID on AWS.
	Identifier string `json:"id"`
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1897** (2026-10-05): **chore(deps): bump the go-patch group across 3 directories with 11 updates**
  *Symptoms*: Bumps the go-patch group with 11 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [github.com/aws/aws-sdk-go-v2/config](https://github.com/aws/aws-sdk-go-v2) | `1.33.1` | `1.33.6` | | [github.com/aws/aws-sdk-go-v2/credentials](https://github.com/aws/aws-sdk-go-v2) | `1.20.1` | `1.20.6` | | [github.com/aws/smithy-go](https://github.com/aws/smithy-go) | `1.28.1` | `1.28.2` | | [github.com/elgohr/go-localstack](https://github.com/elgohr/go-localstack) | `1.0.169` | `1.0.172` | | [github.com/fluxcd/source-controller/api](https://github.com/fluxcd/source-controller) | `1.9.4` | `1.9.5` | | [k8s.io/api](https://github.com/kubernetes/api) | `0.37.0` | `0.37.1` | | [k8s.io/apiextensions-apiserver](https://github.com/kubernetes/apiextensions-apiserver) | `0.37.0` | `0.37.1` | | [k8s.io/apimachinery](https://github.com/kubernetes/apimachinery) | `0.37.0` | `0.37.1` | | [k8s.io/cli-runtime](https://github.com/kubernetes/cli-runtime) | `0.37.0` | `0.37.1` | | [k8s.io/client-go](https://github.com/kubernetes/client-go) | `0.37.0` | `0.37.1` | | [k8s.io/kubectl](https://github.com/kubernetes/kubectl) | `0.37.0` | `0.37.1` | | [github.com/fluxcd/source-controller/api](https://github.com/fluxcd/source-controller) | `1.9.4` | `1.9.5` | | [k8s.io/api](https://github.com/kubernetes/api) | `0.37.0` | `0.37.1` | | [k8s.io/apiextensions-apiserver](https://github.com/kubernetes/apiextensions-apiserver) | `0.37.0` | `0.37.1` | | [k8s.io/apimachinery](https://github.com/kube
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #1895** (2026-09-28): **chore(deps): bump the go-minor group across 3 directories with 18 updates**
  *Symptoms*: Bumps the go-minor group with 10 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [github.com/aws/aws-sdk-go-v2](https://github.com/aws/aws-sdk-go-v2) | `1.45.1` | `1.47.0` | | [github.com/aws/aws-sdk-go-v2/service/dynamodb](https://github.com/aws/aws-sdk-go-v2) | `1.65.1` | `1.69.0` | | [github.com/aws/aws-sdk-go-v2/service/s3](https://github.com/aws/aws-sdk-go-v2) | `1.109.1` | `1.113.1` | | [github.com/fluxcd/pkg/apis/meta](https://github.com/fluxcd/pkg) | `1.31.0` | `1.32.0` | | [github.com/fluxcd/pkg/runtime](https://github.com/fluxcd/pkg) | `0.111.0` | `0.113.0` | | [github.com/jenkins-x/go-scm](https://github.com/jenkins-x/go-scm) | `1.15.36` | `1.16.3` | | [github.com/maxbrunsfeld/counterfeiter/v6](https://github.com/maxbrunsfeld/counterfeiter) | `6.12.2` | `6.13.0` | | [google.golang.org/grpc](https://github.com/grpc/grpc-go) | `1.83.2` | `1.84.0` | | google.golang.org/protobuf | `1.36.12-0.20260120151049-f2248ac996af` | `1.36.12` | | [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime) | `0.24.1` | `0.25.0` | | [github.com/fluxcd/pkg/apis/meta](https://github.com/fluxcd/pkg) | `1.31.0` | `1.32.0` | | [github.com/fluxcd/pkg/runtime](https://github.com/fluxcd/pkg) | `0.111.0` | `0.113.0` | | [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime) | `0.24.1` | `0.25.0` | | [github.com/fluxcd/pkg/apis/meta](https://github.com/fluxcd/pkg) | `1.31.0` | `1.32.0` | | [sigs.k8s.io/co
  **Post-Mortem & Fix Analysis**:
  > Superseded by #1898.

- **Issue #1894** (2026-09-28): **chore(deps): bump the go-patch group across 3 directories with 6 updates**
  *Symptoms*: Bumps the go-patch group with 5 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [github.com/aws/aws-sdk-go-v2/config](https://github.com/aws/aws-sdk-go-v2) | `1.33.1` | `1.33.5` | | [github.com/aws/aws-sdk-go-v2/credentials](https://github.com/aws/aws-sdk-go-v2) | `1.20.1` | `1.20.5` | | [github.com/elgohr/go-localstack](https://github.com/elgohr/go-localstack) | `1.0.169` | `1.0.172` | | [github.com/fluxcd/source-controller/api](https://github.com/fluxcd/source-controller) | `1.9.4` | `1.9.5` | | [github.com/onsi/gomega](https://github.com/onsi/gomega) | `1.43.0` | `1.43.1` | | [github.com/fluxcd/source-controller/api](https://github.com/fluxcd/source-controller) | `1.9.4` | `1.9.5` | | [github.com/onsi/gomega](https://github.com/onsi/gomega) | `1.43.0` | `1.43.1` | | [github.com/onsi/gomega](https://github.com/onsi/gomega) | `1.43.0` | `1.43.1` |  Bumps the go-patch group with 2 updates in the /api directory: [github.com/fluxcd/source-controller/api](https://github.com/fluxcd/source-controller) and [k8s.io/apimachinery](https://github.com/kubernetes/apimachinery). Bumps the go-patch group with 1 update in the /tfctl directory: [k8s.io/apimachinery](https://github.com/kubernetes/apimachinery).  Updates `github.com/aws/aws-sdk-go-v2/config` from 1.33.1 to 1.33.5 <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/4e0240a139dc4638067f89502ea38ba465fef164"><code>4e0240a</code></a> Release 2026-09-14</li> 
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #1891** (2026-09-21): **test: fix flakiness observed with the mTLS CA rotations**
  *Symptoms*: ## Motivation  Fix flakiness observed with `Test_009990_mtls_generate_creds_test` on #1890 

- **Issue #1888** (2026-09-21): **chore(deps): bump the gh-minor group across 1 directory with 9 updates**
  *Symptoms*: Bumps the gh-minor group with 9 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [fluxcd/pkg/actions/kustomize](https://github.com/fluxcd/pkg) | `1.39.0` | `1.40.0` | | [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) | `4.2.0` | `4.3.0` | | [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) | `4.2.0` | `4.3.0` | | [docker/login-action](https://github.com/docker/login-action) | `4.5.1` | `4.6.0` | | [fluxcd/pkg/actions/kubectl](https://github.com/fluxcd/pkg) | `1.39.0` | `1.40.0` | | [github/codeql-action/upload-sarif](https://github.com/github/codeql-action) | `4.37.4` | `4.38.0` | | [github/codeql-action/init](https://github.com/github/codeql-action) | `4.37.4` | `4.38.0` | | [github/codeql-action/autobuild](https://github.com/github/codeql-action) | `4.37.4` | `4.38.0` | | [github/codeql-action/analyze](https://github.com/github/codeql-action) | `4.37.4` | `4.38.0` |   Updates `fluxcd/pkg/actions/kustomize` from 1.39.0 to 1.40.0 <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/fluxcd/pkg/commit/992c220c423e137a6c1808828d8bc569249abc12"><code>992c220</code></a> Merge pull request <a href="https://redirect.github.com/fluxcd/pkg/issues/1283">#1283</a> from fluxcd/release-main</li> <li><a href="https://github.com/fluxcd/pkg/commit/a26a27bb1e2419e6754eff046a0035a144d73a69"><code>a26a27b</code></a> Prepare for release</li> <li><a href="https://github.com/fluxcd/pkg/commit/6864165f4
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #1887** (2026-09-21): **chore(deps): bump the go-minor group across 3 directories with 14 updates**
  *Symptoms*: Bumps the go-minor group with 7 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [github.com/aws/aws-sdk-go-v2](https://github.com/aws/aws-sdk-go-v2) | `1.45.1` | `1.47.0` | | [github.com/aws/aws-sdk-go-v2/service/dynamodb](https://github.com/aws/aws-sdk-go-v2) | `1.65.1` | `1.68.0` | | [github.com/aws/aws-sdk-go-v2/service/s3](https://github.com/aws/aws-sdk-go-v2) | `1.109.1` | `1.113.0` | | [github.com/fluxcd/pkg/runtime](https://github.com/fluxcd/pkg) | `0.111.0` | `0.112.0` | | [github.com/jenkins-x/go-scm](https://github.com/jenkins-x/go-scm) | `1.15.36` | `1.16.0` | | [github.com/maxbrunsfeld/counterfeiter/v6](https://github.com/maxbrunsfeld/counterfeiter) | `6.12.2` | `6.13.0` | | [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime) | `0.24.1` | `0.25.0` |  Bumps the go-minor group with 4 updates in the /api directory: [github.com/fluxcd/pkg/runtime](https://github.com/fluxcd/pkg), [github.com/onsi/gomega](https://github.com/onsi/gomega), [k8s.io/apiextensions-apiserver](https://github.com/kubernetes/apiextensions-apiserver) and [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime). Bumps the go-minor group with 4 updates in the /tfctl directory: [github.com/onsi/gomega](https://github.com/onsi/gomega), [k8s.io/cli-runtime](https://github.com/kubernetes/cli-runtime), [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime) and [github.com/fluxcd
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #1886** (2026-09-21): **chore(deps): bump the go-patch group across 2 directories with 5 updates**
  *Symptoms*: Bumps the go-patch group with 3 updates in the / directory: [github.com/aws/aws-sdk-go-v2/config](https://github.com/aws/aws-sdk-go-v2), [github.com/elgohr/go-localstack](https://github.com/elgohr/go-localstack) and [github.com/fluxcd/source-controller/api](https://github.com/fluxcd/source-controller). Bumps the go-patch group with 1 update in the /api directory: [github.com/fluxcd/source-controller/api](https://github.com/fluxcd/source-controller).  Updates `github.com/aws/aws-sdk-go-v2/config` from 1.33.1 to 1.33.4 <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/b189f382f4924bc6c948c9942e17c547553faf0d"><code>b189f38</code></a> Release 2026-09-09</li> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/0905d5f8a9a88708ad8c7ee4554ae51a38e532f2"><code>0905d5f</code></a> Regenerated Clients</li> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/9cc4bc539469ec525c3a58fa35072ef1c92237f3"><code>9cc4bc5</code></a> Update API model</li> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/126fe2d5e82a59ea5d231bdbc5ff71421ab73476"><code>126fe2d</code></a> fix GetObject deadlock (<a href="https://redirect.github.com/aws/aws-sdk-go-v2/issues/3554">#3554</a>)</li> <li><a href="https://github.com/aws/aws-sdk-go-v2/commit/512688512cb733cab94c9e8b24361b952acb0f48"><code>5126885</code></a> Remove retry metrics header middleware (<a href="https://redirect.github.com/aws/aws-sdk-go-v2/issues/3546">#3546</a>)</li> <li><a href=
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #1882** (2026-09-21): **chore(deps): bump google.golang.org/protobuf from 1.36.12-0.20260120151049-f2248ac996af to 1.36.12**
  *Symptoms*: Bumps google.golang.org/protobuf from 1.36.12-0.20260120151049-f2248ac996af to 1.36.12.   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=google.golang.org/protobuf&package-manager=go_modules&previous-version=1.36.12-0.20260120151049-f2248ac996af&new-version=1.36.12)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency - `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself) - `@dependabot ignore this minor version` will close this PR and stop Dependabot creating any more for this minor version (unless you reopen the PR or upgrade to it yourself) - `@dependabot ignore this dependency` wil
  **Post-Mortem & Fix Analysis**:
  > Superseded by #1895.

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

### Incident Patch 1: `8fc67730` (2026-09-21)
**Commit Message**: fix(test): stop the mTLS CA rotations sharing a second (#1891)

Runner TLS Secret names carry the validity of the CA that signed them, at
second resolution, so the two back-to-back rotations of this test claim a
single name whenever they land in the same second. The second Create then
fails with AlreadyExists, the runner Secret is never rewritten, and the
test waits 90s for a certificate that cannot change.

Wait out the second between the two rotations.

**File**: `controllers/tc009990_mtls_generate_creds_test.go` (modified, +4/-0)
```diff
@@ -35,6 +35,7 @@ func Test_009990_mtls_generate_creds_test(t *testing.T) {
 	rotator.TriggerCARotation <- mtls.Trigger{Namespace: "", Ready: readyCh}
 	result := <-readyCh
 	g.Expect(result.Err).To(BeNil())
+	firstRotationAt := time.Now()
 
 	caSecret := result.Secret
 	g.Expect(len(caSecret.Data)).To(Equal(4))
@@ -162,6 +163,9 @@ func Test_009990_mtls_generate_creds_test(t *testing.T) {
 	g.Expect(tlsValid).To(BeFalse())
 
 	By("rotating the CA should renew the server cert")
+	// runner TLS Secret names carry the CA validity at second resolution, so a CA
+	// rotated within the same second as the one it replaces never writes its own.
+	time.Sleep(time.Until(firstRotationAt.Truncate(time.Second).Add(time.Second)))
 	rotator.ResetCACache()
 	renewedReadyCh := make(chan *mtls.TriggerResult)
 	rotator.TriggerCARotation <- mtls.Trigger{Namespace: "", Ready: renewedReadyCh}
```

---

### Incident Patch 2: `787be900` (2026-09-01)
**Commit Message**: fix: list only open GitLab merge requests (#1865)

**File**: `internal/git/provider/gitlab_provider.go` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ func (p *GitLabProvider) ListPullRequestChanges(ctx context.Context, pr PullRequ
 func (p *GitLabProvider) ListPullRequests(ctx context.Context, repo Repository) ([]PullRequest, error) {
 	var prs []PullRequest
 
-	opts := scm.PullRequestListOptions{Page: 1, Size: defaultPageSize}
+	opts := scm.PullRequestListOptions{Page: 1, Size: defaultPageSize, Open: true}
 	for {
 		prList, res, err := p.client.PullRequests.List(ctx, repo.String(), &opts)
 		if err != nil {
```

**File**: `internal/git/provider/gitlab_provider_test.go` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+package provider
+
+import (
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+
+	"github.com/jenkins-x/go-scm/scm/driver/gitlab"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+func TestGitLabProviderListPullRequestsRequestsOnlyOpen(t *testing.T) {
+	state := make(chan string, 1)
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		state <- r.URL.Query().Get("state")
+		w.Header().Set("Content-Type", "application/json")
+		_, err := io.WriteString(w, "[]")
+		assert.NoError(t, err)
+	}))
+	t.Cleanup(server.Close)
+
+	client, err := gitlab.New(server.URL)
+	require.NoError(t, err)
+
+	p := &GitLabProvider{client: client}
+	prs, err := p.ListPullRequests(t.Context(), Repository{Org: "example", Name: "infrastructure"})
+	require.NoError(t, err)
+	assert.Empty(t, prs)
+	assert.Equal(t, "opened", <-state)
+}
```

---

### Incident Patch 3: `20a1a4d7` (2026-08-31)
**Commit Message**: fix(deps): remove libcrypto3 pin (#1874)

**File**: `.github/workflows/build-and-publish.yaml` (modified, +0/-6)
```diff
@@ -11,7 +11,6 @@ permissions:
 env:
   CONTROLLER: ${{ github.event.repository.name }}
   REGISTRY_OWNER: ${{ github.repository_owner }}
-  LIBCRYPTO_VERSION: "3.5.7-r0"
 
 jobs:
   test:
@@ -79,8 +78,6 @@ jobs:
           builder: ${{ steps.buildx.outputs.name }}
           context: .
           file: ./Dockerfile
-          build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7
           tags: |
             ghcr.io/${{ env.REGISTRY_OWNER }}/${{ env.CONTROLLER }}:${{ steps.prep.outputs.VERSION }}
@@ -99,7 +96,6 @@ jobs:
           context: .
           file: ./runner-base.Dockerfile
           build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
             BUILD_VERSION=${{ steps.prep.outputs.BUILD_VERSION }}
             BUILD_SHA=${{ steps.prep.outputs.BUILD_SHA }}
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7
@@ -139,8 +135,6 @@ jobs:
           context: .
           file: ./planner.Dockerfile
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7
-          build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           tags: |
             ghcr.io/${{ env.REGISTRY_OWNER }}/branch-planner:${{ steps.prep.outputs.VERSION }}
           labels: |
```

**File**: `.github/workflows/release-runners.yaml` (modified, +0/-4)
```diff
@@ -18,7 +18,6 @@ permissions:
 env:
   VERSION: ${{ github.event.inputs.version || github.event.client_payload.version }}
   BUILD_DATE: ${{ github.event.inputs.build_date || github.event.client_payload.build_date }}
-  LIBCRYPTO_VERSION: "3.5.7-r0"
 
 jobs:
   release-base:
@@ -53,8 +52,6 @@ jobs:
           builder: ${{ steps.buildx.outputs.name }}
           context: .
           file: ./runner-base.Dockerfile
-          build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7
           tags: |
             ghcr.io/flux-iac/tf-runner:${{ env.VERSION }}-base
@@ -106,7 +103,6 @@ jobs:
           build-args: |
             BASE_IMAGE=ghcr.io/flux-iac/tf-runner:${{ env.VERSION }}-base
             TF_VERSION=${{ matrix.tf_version }}
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           tags: |
             ghcr.io/flux-iac/tf-runner:${{ env.VERSION }}-tf-${{ matrix.tf_version }}
           labels: |
```

**File**: `.github/workflows/release.yaml` (modified, +0/-7)
```diff
@@ -16,7 +16,6 @@ permissions:
 env:
   CONTROLLER: ${{ github.event.repository.name }}
   REGISTRY_OWNER: ${{ github.repository_owner }}
-  LIBCRYPTO_VERSION: "3.5.7-r0"
 
 jobs:
   build-push:
@@ -72,8 +71,6 @@ jobs:
           builder: ${{ steps.buildx.outputs.name }}
           context: .
           file: ./Dockerfile
-          build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7
           tags: |
             ghcr.io/${{ env.REGISTRY_OWNER }}/${{ env.CONTROLLER }}:${{ steps.prep.outputs.VERSION }}
@@ -92,8 +89,6 @@ jobs:
           builder: ${{ steps.buildx.outputs.name }}
           context: .
           file: ./runner-base.Dockerfile
-          build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7
           tags: |
             ghcr.io/${{ env.REGISTRY_OWNER }}/tf-runner:${{ steps.prep.outputs.VERSION }}-base
@@ -154,8 +149,6 @@ jobs:
           builder: ${{ steps.buildx.outputs.name }}
           context: .
           file: ./planner.Dockerfile
-          build-args: |
-            LIBCRYPTO_VERSION=${{ env.LIBCRYPTO_VERSION }}
           platforms: linux/amd64,linux/arm64 #,linux/arm/v7 - azure-cli does not install correctly on 32 bit arm
           tags: |
             ghcr.io/${{ env.REGISTRY_OWNER }}/branch-planner:${{ steps.prep.outputs.VERSION }}
```

**File**: `.go-version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-1.26.5
+1.26.6
```

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-ARG GO_VERSION=1.26.5
+ARG GO_VERSION=1.26.6
 FROM --platform=$BUILDPLATFORM golang:${GO_VERSION} AS builder
 
 WORKDIR /build
```

**File**: `Dockerfile.dev` (modified, +1/-4)
```diff
@@ -2,12 +2,9 @@ FROM alpine:3.22
 
 LABEL org.opencontainers.image.source="https://github.com/flux-iac/tofu-controller"
 
-ARG LIBCRYPTO_VERSION
-
 RUN apk update && \
+    apk upgrade --no-cache && \
     apk add --no-cache \
-    libcrypto3=${LIBCRYPTO_VERSION} \
-    libssl3=${LIBCRYPTO_VERSION} \
     ca-certificates tini git openssh-client gnupg \
     busybox
 
```

**File**: `Makefile` (modified, +7/-14)
```diff
@@ -8,13 +8,6 @@ TAG ?= latest
 BUILD_SHA ?= $(shell git rev-parse --short HEAD)
 BUILD_VERSION ?= $(shell git describe --tags $$(git rev-list --tags --max-count=1))
 
-# Update the following files too:
-# - .github/workflows/build-and-publish.yaml
-# - .github/workflows/release-runners.yaml
-# - .github/workflows/release.yaml
-# - Tiltfile
-LIBCRYPTO_VERSION ?= 3.5.7-r0
-
 # source controller version
 SOURCE_VER ?= v1.7.4
 
@@ -154,19 +147,19 @@ run-planner: manifests generate fmt vet ## Run a branch planner from your host.
 
 .PHONY: docker-build
 docker-build: ## Build docker
-	docker build -t ${MANAGER_IMG}:${TAG} --build-arg LIBCRYPTO_VERSION=${LIBCRYPTO_VERSION} --build-arg TARGETARCH=${TARGETARCH} ${BUILD_ARGS} .
-	docker build -t ${RUNNER_IMG}:${TAG}-base -f runner-base.Dockerfile --build-arg LIBCRYPTO_VERSION=${LIBCRYPTO_VERSION} --build-arg TARGETARCH=${TARGETARCH} ${BUILD_ARGS} .
+	docker build -t ${MANAGER_IMG}:${TAG} --build-arg TARGETARCH=${TARGETARCH} ${BUILD_ARGS} .
+	docker build -t ${RUNNER_IMG}:${TAG}-base -f runner-base.Dockerfile --build-arg TARGETARCH=${TARGETARCH} ${BUILD_ARGS} .
 	docker build -t ${RUNNER_IMG}:${TAG} -f runner.Dockerfile --build-arg BASE_IMAGE=${RUNNER_IMG}:${TAG}-base --build-arg TARGETARCH=${TARGETARCH} ${BUILD_ARGS} .
 	docker build -t ${RUNNER_AZURE_IMAGE}:${TAG} -f runner-azure.Dockerfile --build-arg BASE_IMAGE=${RUNNER_IMG}:${TAG}-base --build-arg TARGETARCH=${TARGETARCH} ${BUILD_ARGS} .
-	docker build -t ${BRANCH_PLANNER_IMAGE}:${TAG} -f planner.Dockerfile --build-arg LIBCRYPTO_VERSION=${LIBCRYPTO_VERSION} --build-arg TARGETARCH=${TARGETARCH} ${BUILD_ARGS} .
+	docker build -t ${BRANCH_PLANNER_IMAGE}:${TAG} -f planner.Dockerfile --build-arg TARGETARCH=${TARGETARCH} ${BUILD_ARGS} .
 
 .PHONY: docker-buildx
 docker-buildx: ## Build docker
-	docker buildx build --load -t ${MANAGER_IMG}:${TAG} --build-arg LIBCRYPTO_VERSION=${LIBCRYPTO_VERSION} ${BUILD_ARGS} .
-	docker buildx build --load -t ${RUNNER_IMG}:${TAG}-base -f runner-base.Dockerfile --build-arg LIBCRYPTO_VERSION=${LIBCRYPTO_VERSION} ${BUILD_ARGS} .
+	docker buildx build --load -t ${MANAGER_IMG}:${TAG} ${BUILD_ARGS} .
+	docker buildx build --load -t ${RUNNER_IMG}:${TAG}-base -f runner-base.Dockerfile ${BUILD_ARGS} .
 	docker buildx build --load -t ${RUNNER_IMG}:${TAG} -f runner.Dockerfile --build-arg BASE_IMAGE=${RUNNER_IMG}:${TAG}-base ${BUILD_ARGS} .
 	docker buildx build --load -t ${RUNNER_AZURE_IMAGE}:${TAG} -f runner-azure.Dockerfile --build-arg BASE_IMAGE=${RUNNER_IMG}:${TAG}-base ${BUILD_ARGS} .
-	docker buildx build --load -t ${BRANCH_PLANNER_IMAGE}:${TAG} -f planner.Dockerfile --build-arg LIBCRYPTO_VERSION=${LIBCRYPTO_VERSION} ${BUILD_ARGS} .
+	docker buildx build --load -t ${BRANCH_PLANNER_IMAGE}:${TAG} -f planner.Dockerfile ${BUILD_ARGS} .
 
 .PHONY: docker-push
 docker-push: ## Push docker image with the manager.
@@ -177,7 +170,7 @@ docker-push: ## Push docker image with the manager.
 	docker push ${BRANCH_PLANNER_IMAGE}:${TAG}
 
 docker-dev-runner:
-	docker buildx build --load -t ${RUNNER_IMG}:${TAG}-base -f runner-base.Dockerfile --build-arg LIBCRYPTO_VERSION=${LIBCRYPTO_VERSION} ${BUILD_ARGS} .
+	docker buildx build --load -t ${RUNNER_IMG}:${TAG}-base -f runner-base.Dockerfile ${BUILD_ARGS} .
 	docker buildx build --load -t ${RUNNER_IMG}:${TAG} -f runner.Dockerfile --build-arg BASE_IMAGE=${RUNNER_IMG}:${TAG}-base ${BUILD_ARGS} .
 	docker push ${RUNNER_IMG}:${TAG}
 
```

**File**: `Tiltfile` (modified, +0/-6)
```diff
@@ -8,7 +8,6 @@ tfNamespace      = "terraform"
 buildSHA         = str(local('git rev-parse --short HEAD')).rstrip('\n')
 buildVersionRef  = str(local('git rev-list --tags --max-count=1')).rstrip('\n')
 buildVersion     = str(local("git describe --tags ${buildVersionRef}")).rstrip('\n')
-LIBCRYPTO_VERSION = "3.5.7-r0"
 
 if os.path.exists('Tiltfile.local'):
    include('Tiltfile.local')
@@ -84,7 +83,6 @@ docker_build(
   build_args={
     'BUILD_SHA': buildSHA,
     'BUILD_VERSION': buildVersion,
-    'LIBCRYPTO_VERSION': LIBCRYPTO_VERSION,
   }
 )
 
@@ -110,7 +108,6 @@ docker_build(
   build_args={
     'BUILD_SHA': buildSHA,
     'BUILD_VERSION': buildVersion,
-    'LIBCRYPTO_VERSION': LIBCRYPTO_VERSION,
   }
 )
 
@@ -137,7 +134,4 @@ docker_build(
   'ghcr.io/flux-iac/tf-runner',
   '',
   dockerfile='runner.Dockerfile.dev',
-  build_args={
-    'LIBCRYPTO_VERSION': LIBCRYPTO_VERSION,
-  }
 )
```

---

### Incident Patch 4: `35fa3c1b` (2026-08-06)
**Commit Message**: fix(deps): bump python packages (#1858)

**File**: `.github/workflows/helm-test.yaml` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ jobs:
 
       - uses: actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97 # v7.0.0
         with:
-          python-version: "3.10"
+          python-version: 3.x
 
       - name: Set up chart-testing
         uses: helm/chart-testing-action@6ec842c01de15ebb84c8627d2744a0c2f2755c9f # v2.8.0
```

**File**: `runner-azure.Dockerfile` (modified, +12/-1)
```diff
@@ -5,7 +5,14 @@ FROM ghcr.io/opentofu/opentofu:${TOFU_VERSION}-minimal AS tofu
 
 FROM $BASE_IMAGE
 
-ARG AZURE_CLI_VERSION=2.86.0
+ARG AZURE_CLI_VERSION=2.89.0
+
+# azure-cli-core pins msal==1.36.0, which caps cryptography at <49 and leaves the
+# image on 48.x (CVE-2026-69247, CVE-2026-69249). Upgraded as a set below; drop
+# these once azure-cli moves to msal >= 1.37.0.
+ARG CRYPTOGRAPHY_VERSION=50.0.0
+ARG PYOPENSSL_VERSION=26.4.0
+ARG MSAL_VERSION=1.37.0
 
 # Switch to root temporarily for package installation (base image runs as 65532).
 USER root
@@ -17,6 +24,10 @@ USER root
 RUN apk add --no-cache python3 py3-virtualenv gcc python3-dev musl-dev linux-headers && \
     python3 -m venv /opt/az && \
     /opt/az/bin/pip install --no-cache-dir setuptools azure-cli==${AZURE_CLI_VERSION} && \
+    /opt/az/bin/pip install --no-cache-dir --no-deps --upgrade \
+        cryptography==${CRYPTOGRAPHY_VERSION} \
+        pyOpenSSL==${PYOPENSSL_VERSION} \
+        msal==${MSAL_VERSION} && \
     ln -s /opt/az/bin/az /usr/local/bin/az && \
     apk del gcc python3-dev musl-dev linux-headers
 
```

---

### Incident Patch 5: `ef76ba7f` (2026-08-05)
**Commit Message**: fix: reconcile every interval, not every restart, for stable objects (#1681) (#1857)

**File**: `api/v1alpha2/terraform_types.go` (modified, +5/-0)
```diff
@@ -416,6 +416,11 @@ type TerraformStatus struct {
 	// +optional
 	LastPlanAt *metav1.Time `json:"lastPlanAt,omitempty"`
 
+	// LastSuccessfulReconcileAt is the time when the last successful
+	// reconciliation was completed, regardless of whether a plan was generated.
+	// +optional
+	LastSuccessfulReconcileAt *metav1.Time `json:"lastSuccessfulReconcileAt,omitempty"`
+
 	// LastDriftDetectedAt is the time when the last drift was detected
 	// +optional
 	LastDriftDetectedAt *metav1.Time `json:"lastDriftDetectedAt,omitempty"`
```

**File**: `api/v1alpha2/zz_generated.deepcopy.go` (modified, +4/-0)
```diff
@@ -661,6 +661,10 @@ func (in *TerraformStatus) DeepCopyInto(out *TerraformStatus) {
 		in, out := &in.LastPlanAt, &out.LastPlanAt
 		*out = (*in).DeepCopy()
 	}
+	if in.LastSuccessfulReconcileAt != nil {
+		in, out := &in.LastSuccessfulReconcileAt, &out.LastSuccessfulReconcileAt
+		*out = (*in).DeepCopy()
+	}
 	if in.LastDriftDetectedAt != nil {
 		in, out := &in.LastDriftDetectedAt, &out.LastDriftDetectedAt
 		*out = (*in).DeepCopy()
```

**File**: `charts/tofu-controller/crds/crds.yaml` (modified, +6/-0)
```diff
@@ -11395,6 +11395,12 @@ spec:
                   LastPlannedRevision is the revision used by the last planning process.
                   The result could be either no plan change or a new plan generated.
                 type: string
+              lastSuccessfulReconcileAt:
+                description: |-
+                  LastSuccessfulReconcileAt is the time when the last successful
+                  reconciliation was completed, regardless of whether a plan was generated.
+                format: date-time
+                type: string
               lock:
                 description: LockStatus defines the observed state of a Terraform
                   State Lock
```

**File**: `config/crd/bases/infra.contrib.fluxcd.io_terraforms.yaml` (modified, +6/-0)
```diff
@@ -11395,6 +11395,12 @@ spec:
                   LastPlannedRevision is the revision used by the last planning process.
                   The result could be either no plan change or a new plan generated.
                 type: string
+              lastSuccessfulReconcileAt:
+                description: |-
+                  LastSuccessfulReconcileAt is the time when the last successful
+                  reconciliation was completed, regardless of whether a plan was generated.
+                format: date-time
+                type: string
               lock:
                 description: LockStatus defines the observed state of a Terraform
                   State Lock
```

**File**: `controllers/tf_controller.go` (modified, +8/-2)
```diff
@@ -277,6 +277,7 @@ func (r *TerraformReconciler) Reconcile(ctx context.Context, req ctrl.Request) (
 		log.Info("Skipping reconciliation",
 			"reason", reason,
 			"lastPlanAt", terraform.Status.LastPlanAt,
+			"lastSuccessfulReconcileAt", terraform.Status.LastSuccessfulReconcileAt,
 			"nextAttempt", time.Now().Add(requeueAfter),
 			"requeueAfter", requeueAfter)
 
@@ -563,6 +564,7 @@ func (r *TerraformReconciler) Reconcile(ctx context.Context, req ctrl.Request) (
 	if reconcileErr == nil {
 		log.Info("Reset reconciliation failures count. Reason: successful reconciliation")
 		terraform = infrav1.TerraformResetRetry(reconciledTerraform)
+		terraform.Status.LastSuccessfulReconcileAt = &metav1.Time{Time: time.Now()}
 	} else {
 		terraform = reconciledTerraform
 		terraform.IncrementReconciliationFailures()
@@ -680,10 +682,14 @@ func (r *TerraformReconciler) shouldReconcile(terraform *infrav1.Terraform, sour
 		return true, "retry interval has elapsed since last failed reconciliation", 0
 	}
 
-	nextReconcile := terraform.Status.LastPlanAt.Add(terraform.Spec.Interval.Duration)
+	if terraform.Status.LastSuccessfulReconcileAt == nil {
+		return true, "never successfuly reconciled before", 0
+	}
+
+	nextReconcile := terraform.Status.LastSuccessfulReconcileAt.Add(terraform.Spec.Interval.Duration)
 	requeueAfter := time.Until(nextReconcile)
 	if requeueAfter > 0 {
-		return false, "interval has not elapsed since last plan", requeueAfter
+		return false, "interval has not elapsed since last successful reconciliation", requeueAfter
 	}
 
 	return true, "", 0
```

**File**: `controllers/tf_controller_interval_test.go` (modified, +43/-9)
```diff
@@ -18,7 +18,7 @@ func TestShouldReconcileSkipsWhenIntervalNotElapsed(t *testing.T) {
 	g := NewWithT(t)
 	reconciler := &TerraformReconciler{}
 
-	lastPlan := time.Now().Add(-6 * time.Hour)
+	lastReconcile := time.Now().Add(-6 * time.Hour)
 	tf := &infrav1.Terraform{
 		ObjectMeta: metav1.ObjectMeta{
 			Generation: 1,
@@ -27,28 +27,61 @@ func TestShouldReconcileSkipsWhenIntervalNotElapsed(t *testing.T) {
 			Interval: metav1.Duration{Duration: 24 * time.Hour},
 		},
 		Status: infrav1.TerraformStatus{
-			LastPlanAt:            &metav1.Time{Time: lastPlan},
-			LastAttemptedRevision: "main/1234",
-			LastPlannedRevision:   "main/1234",
-			ObservedGeneration:    1,
+			LastPlanAt:                &metav1.Time{Time: lastReconcile},
+			LastSuccessfulReconcileAt: &metav1.Time{Time: lastReconcile},
+			LastAttemptedRevision:     "main/1234",
+			LastPlannedRevision:       "main/1234",
+			ObservedGeneration:        1,
 		},
 	}
 
 	shouldReconcile, reason, requeueAfter := reconciler.shouldReconcile(tf, nil)
 	g.Expect(shouldReconcile).To(BeFalse())
-	g.Expect(reason).To(Equal("interval has not elapsed since last plan"))
+	g.Expect(reason).To(Equal("interval has not elapsed since last successful reconciliation"))
 	g.Expect(requeueAfter).To(BeNumerically(">", 17*time.Hour))
 	g.Expect(requeueAfter).To(BeNumerically("<=", 24*time.Hour))
 }
 
+func TestShouldReconcileSkipsWhenPlanStaleButRecentlyReconciled(t *testing.T) {
+	Spec("This spec covers checking that interval is honored based on successful reconcile if plan is not changed.")
+	It("should skip reconciliation when LastPlanAt is stale but LastSuccessfulReconcileAt is within the interval.")
+
+	g := NewWithT(t)
+	reconciler := &TerraformReconciler{}
+
+	// The last actual plan happened long ago (plan never changes), but the
+	// object was reconciled recently (e.g. via no-change drift detection).
+	tf := &infrav1.Terraform{
+		ObjectMeta: metav1.ObjectMeta{
+			Generation: 1,
+		},
+		Spec: infrav1.TerraformSpec{
+			Interval: metav1.Duration{Duration: 24 * time.Hour},
+		},
+		Status: infrav1.TerraformStatus{
+			LastPlanAt:                &metav1.Time{Time: time.Now().Add(-90 * 24 * time.Hour)},
+			LastSuccessfulReconcileAt: &metav1.Time{Time: time.Now().Add(-1 * time.Hour)},
+			LastAttemptedRevision:     "main/1234",
+			LastPlannedRevision:       "main/1234",
+			ObservedGeneration:        1,
+		},
+	}
+
+	shouldReconcile, reason, requeueAfter := reconciler.shouldReconcile(tf, nil)
+	g.Expect(shouldReconcile).To(BeFalse())
+	g.Expect(reason).To(Equal("interval has not elapsed since last successful reconciliation"))
+	g.Expect(requeueAfter).To(BeNumerically(">", 22*time.Hour))
+	g.Expect(requeueAfter).To(BeNumerically("<=", 23*time.Hour))
+}
+
 func TestShouldReconcileWhenIntervalElapsed(t *testing.T) {
 	Spec("This spec covers reconciling once the interval has fully elapsed.")
 	It("should return true with zero requeue duration.")
 
 	g := NewWithT(t)
 	reconciler := &TerraformReconciler{}
 
-	lastPlan := time.Now().Add(-25 * time.Hour)
+	lastReconcile := time.Now().Add(-25 * time.Hour)
 	tf := &infrav1.Terraform{
 		ObjectMeta: metav1.ObjectMeta{
 			Generation: 1,
@@ -57,8 +90,9 @@ func TestShouldReconcileWhenIntervalElapsed(t *testing.T) {
 			Interval: metav1.Duration{Duration: 24 * time.Hour},
 		},
 		Status: infrav1.TerraformStatus{
-			LastPlanAt:         &metav1.Time{Time: lastPlan},
-			ObservedGeneration: 1,
+			LastPlanAt:                &metav1.Time{Time: lastReconcile},
+			LastSuccessfulReconcileAt: &metav1.Time{Time: lastReconcile},
+			ObservedGeneration:        1,
 		},
 	}
 
```

**File**: `docs/References/terraform.md` (modified, +1/-0)
```diff
@@ -383,6 +383,7 @@ _Appears in:_
 | `lastPlannedRevision` _string_ | LastPlannedRevision is the revision used by the last planning process.<br />The result could be either no plan change or a new plan generated. |  | Optional: \{\} <br /> |
 | `lastPlannedGeneration` _integer_ | LastPlannedGeneration is the generation of the Terraform resource<br />at the time of the last plan. This can be used to detect whether a<br />pending plan has become stale, due to the spec being modified since the<br />plan was generated. |  | Optional: \{\} <br /> |
 | `lastPlanAt` _[Time](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.32/#time-v1-meta)_ | LastPlanAt is the time when the last terraform plan was performed |  | Optional: \{\} <br /> |
+| `lastSuccessfulReconcileAt` _[Time](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.32/#time-v1-meta)_ | LastSuccessfulReconcileAt is the time when the last successful<br />reconciliation was completed, regardless of whether a plan was generated. |  | Optional: \{\} <br /> |
 | `lastDriftDetectedAt` _[Time](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.32/#time-v1-meta)_ | LastDriftDetectedAt is the time when the last drift was detected |  | Optional: \{\} <br /> |
 | `lastAppliedByDriftDetectionAt` _[Time](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.32/#time-v1-meta)_ | LastAppliedByDriftDetectionAt is the time when the last drift was detected and<br />terraform apply was performed as a result |  | Optional: \{\} <br /> |
 | `availableOutputs` _string array_ |  |  | Optional: \{\} <br /> |
```

---

### Incident Patch 6: `e9b005dd` (2026-07-29)
**Commit Message**: fix: prevent permanent reconcile hang when a runner pod dies mid-reconcile (#1838)

**File**: `cmd/manager/main.go` (modified, +6/-0)
```diff
@@ -91,6 +91,7 @@ func main() {
 		rotationCheckFrequency    time.Duration
 		runnerGRPCPort            int
 		runnerCreationTimeout     time.Duration
+		runnerRPCTimeout          time.Duration
 		runnerGRPCMaxMessageSize  int
 		allowBreakTheGlass        bool
 		clusterDomain             string
@@ -118,6 +119,10 @@ func main() {
 		"The interval that the mTLS certificate rotator should check the certificate validity.")
 	flag.IntVar(&runnerGRPCPort, "runner-grpc-port", 30000, "The port which will be exposed on the runner pod for gRPC connections.")
 	flag.DurationVar(&runnerCreationTimeout, "runner-creation-timeout", 120*time.Second, "Timeout for creating a runner pod.")
+	flag.DurationVar(&runnerRPCTimeout, "runner-rpc-timeout", 30*time.Minute,
+		"Maximum duration for the batch of runner RPCs that set up Terraform (upload, "+
+			"backend config, init, workspace select). Bounds the reconcile so a runner pod "+
+			"that dies mid-RPC surfaces as an error and requeues instead of hanging forever.")
 	flag.IntVar(&runnerGRPCMaxMessageSize, "runner-grpc-max-message-size", 4, "The maximum message size for gRPC connections in MiB.")
 	flag.BoolVar(&allowBreakTheGlass, "allow-break-the-glass", false, "Allow break the glass mode.")
 	flag.StringVar(&clusterDomain, "cluster-domain", "cluster.local", "The cluster domain used by the cluster.")
@@ -253,6 +258,7 @@ func main() {
 		CertRotator:               rotator,
 		RunnerGRPCPort:            runnerGRPCPort,
 		RunnerCreationTimeout:     runnerCreationTimeout,
+		RunnerRPCTimeout:          runnerRPCTimeout,
 		RunnerGRPCMaxMessageSize:  runnerGRPCMaxMessageSize,
 		AllowBreakTheGlass:        allowBreakTheGlass,
 		ClusterDomain:             clusterDomain,
```

**File**: `controllers/suite_test.go` (modified, +1/-0)
```diff
@@ -179,6 +179,7 @@ func TestMain(m *testing.M) {
 		CertRotator:               rotator,
 		RunnerGRPCPort:            30000,
 		RunnerCreationTimeout:     120 * time.Second,
+		RunnerRPCTimeout:          30 * time.Minute,
 		RunnerGRPCMaxMessageSize:  4,
 		UsePodSubdomainResolution: false,
 	}
```

**File**: `controllers/tf_controller.go` (modified, +1/-0)
```diff
@@ -86,6 +86,7 @@ type TerraformReconciler struct {
 	CertRotator               *mtls.CertRotator
 	RunnerGRPCPort            int
 	RunnerCreationTimeout     time.Duration
+	RunnerRPCTimeout          time.Duration
 	RunnerGRPCMaxMessageSize  int
 	AllowBreakTheGlass        bool
 	ClusterDomain             string
```

**File**: `controllers/tf_controller_backend.go` (modified, +11/-3)
```diff
@@ -28,6 +28,17 @@ func (r *TerraformReconciler) backendCompletelyDisable(terraform *infrav1.Terraf
 func (r *TerraformReconciler) setupTerraform(ctx context.Context, patchHelper *patch.SerialPatcher, runnerClient runner.RunnerClient, terraform *infrav1.Terraform, sourceObj sourcev1.Source, revision string, reconciliationLoopID string) (*infrav1.Terraform, string, string, error) {
 	log := ctrl.LoggerFrom(ctx)
 
+	// Bound the runner RPCs below (UploadAndExtract ... Init ... SelectWorkspace).
+	// The runner gRPC client is created with waitForReady:true, so an RPC on a
+	// channel that cannot connect (e.g. the runner pod was killed by a node reboot
+	// mid-reconcile) blocks until its context is done. Without a deadline the call
+	// blocks forever, and because controller-runtime does not start a new Reconcile
+	// for a key while the previous one is still running, that Terraform object is
+	// never reconciled again and a worker slot is leaked permanently. A generous,
+	// configurable ceiling turns "never" into "requeue after RunnerRPCTimeout".
+	ctx, cancel := context.WithTimeout(ctx, r.RunnerRPCTimeout)
+	defer cancel()
+
 	tfInstance := "0"
 	tmpDir := ""
 
@@ -48,9 +59,6 @@ func (r *TerraformReconciler) setupTerraform(ctx context.Context, patchHelper *p
 		), tfInstance, tmpDir, err
 	}
 
-	// we fix timeout of UploadAndExtract to be 30s
-	// ctx30s, cancelCtx30s := context.WithTimeout(ctx, 30*time.Second)
-	// defer cancelCtx30s()
 	uploadAndExtractReply, err := runnerClient.UploadAndExtract(ctx, &runner.UploadAndExtractRequest{
 		Namespace: terraform.Namespace,
 		Name:      terraform.Name,
```

**File**: `controllers/tf_controller_runner.go` (modified, +24/-0)
```diff
@@ -328,6 +328,7 @@ func (r *TerraformReconciler) reconcileRunnerPod(ctx context.Context, terraform
 	type state string
 	const (
 		stateUnknown       state = "unknown"
+		stateFailed        state = "failed"
 		stateRunning       state = "running"
 		stateNotFound      state = "not-found"
 		stateMustBeDeleted state = "must-be-deleted"
@@ -397,6 +398,7 @@ func (r *TerraformReconciler) reconcileRunnerPod(ctx context.Context, terraform
 		podState = stateNotFound
 	} else if err != nil {
 		traceLog.Error(err, "Error getting the Runner Pod", "runner-pod-key", runnerPodKey)
+		return "", fmt.Errorf("failed to get the runner pod: %w", err)
 	} else if err == nil {
 		label, found := runnerPod.Labels["tf.weave.works/tls-secret-name"]
 		traceLog.Info("Set label and found", "label", label, "found", found)
@@ -412,6 +414,8 @@ func (r *TerraformReconciler) reconcileRunnerPod(ctx context.Context, terraform
 			podState = stateTerminating
 		} else if runnerPod.Status.Phase == v1.PodRunning {
 			podState = stateRunning
+		} else if runnerPod.Status.Phase == v1.PodFailed {
+			podState = stateFailed
 		}
 	}
 
@@ -469,6 +473,26 @@ func (r *TerraformReconciler) reconcileRunnerPod(ctx context.Context, terraform
 	case stateRunning:
 		// do nothing
 		traceLog.Info("Pod is running, do nothing")
+	case stateFailed:
+		// A failed pod will never serve gRPC again, so delete it and create a
+		// replacement. Other non-running phases are left alone to continue
+		// starting up.
+		log.Info("runner pod failed, force-deleting", "name", terraform.Name)
+		if err := r.Delete(ctx, &runnerPod,
+			client.GracePeriodSeconds(1), // force kill = 1 second
+			client.PropagationPolicy(metav1.DeletePropagationForeground),
+		); err != nil && !errors.IsNotFound(err) {
+			traceLog.Error(err, "Hit an error")
+			return "", err
+		}
+		if err := waitForPodToBeTerminated(); err != nil {
+			traceLog.Error(err, "Hit an error")
+			return "", fmt.Errorf("failed to wait for the stale pod termination: %v", err)
+		}
+		if err := createNewPod(); err != nil {
+			traceLog.Error(err, "Hit an error")
+			return "", err
+		}
 	}
 
 	// wait for pod ip
```

---

### Incident Patch 7: `07392f87` (2026-07-26)
**Commit Message**: fix: add controller ownerReference to tf-runner pods (#1835)

**File**: `controllers/tc000260_runner_pod_test.go` (modified, +13/-0)
```diff
@@ -14,6 +14,7 @@ import (
 	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/types"
+	"k8s.io/utils/ptr"
 )
 
 // +kubebuilder:docs-gen:collapse=Imports
@@ -43,6 +44,7 @@ func Test_000260_runner_pod_test(t *testing.T) {
 		ObjectMeta: metav1.ObjectMeta{
 			Name:      terraformName,
 			Namespace: "flux-system",
+			UID:       types.UID("f24960a2-6156-49d4-a2d1-b56d92146c9e"),
 		},
 		Spec: infrav1.TerraformSpec{
 			ApprovePlan: "auto",
@@ -92,6 +94,17 @@ func Test_000260_runner_pod_test(t *testing.T) {
 	}()).To(BeTrue())
 
 	g.Expect(podTemplate.Labels["app.kubernetes.io/instance"]).To(Equal("tf-runner-c7fd0cc6"))
+
+	By("checking that the runner pod is owned by the Terraform object, so that observability tools classify it as a managed pod and GC can clean it up")
+	g.Expect(podTemplate.OwnerReferences).To(Equal([]metav1.OwnerReference{
+		{
+			APIVersion: infrav1.GroupVersion.String(),
+			Kind:       infrav1.TerraformKind,
+			Name:       terraformName,
+			UID:        helloWorldTF.UID,
+			Controller: ptr.To(true),
+		},
+	}))
 }
 
 func Test_000260_runner_pod_test_env_vars(t *testing.T) {
```

**File**: `controllers/tf_controller_runner.go` (modified, +14/-0)
```diff
@@ -17,6 +17,7 @@ import (
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/apimachinery/pkg/util/wait"
 	"k8s.io/apimachinery/pkg/watch"
+	"k8s.io/utils/ptr"
 	ctrl "sigs.k8s.io/controller-runtime"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 
@@ -52,6 +53,19 @@ func runnerPodTemplate(terraform *infrav1.Terraform, secretName string, revision
 		ObjectMeta: metav1.ObjectMeta{
 			Namespace: podNamespace,
 			Name:      podName,
+			// The controller ownerReference classifies the runner as a managed pod
+			// (kube-state-metrics' created_by_kind) rather than a bare pod that appears
+			// to restart on every reconcile, and lets Kubernetes GC the runner if the
+			// Terraform object is deleted.
+			OwnerReferences: []metav1.OwnerReference{
+				{
+					APIVersion: infrav1.GroupVersion.String(),
+					Kind:       infrav1.TerraformKind,
+					Name:       terraform.Name,
+					UID:        terraform.UID,
+					Controller: ptr.To(true),
+				},
+			},
 			Labels: map[string]string{
 				"app.kubernetes.io/created-by":   "tofu-controller",
 				"app.kubernetes.io/name":         "tf-runner",
```

---

### Incident Patch 8: `adbb4711` (2026-07-26)
**Commit Message**: fix(github): use api.github.com base URL for GitHub App auth (#1823) (#1843)

The Setup() function was incorrectly using the web host (https://github.com)
instead of the API host (https://api.github.com) when creating the go-scm
client for GitHub App authentication. This caused 404 errors when the
branch-planner attempted to list pull requests.

For GitHub.com:
- Now uses https://api.github.com (was: https://github.com)

For GHE:
- Now uses <server>/api/v3 for both transport.BaseURL and github.New()
- Previously only set transport.BaseURL, but still passed the web host to New()

This mirrors the pattern used in the token auth path where factory.NewClient
properly calls ensureGHEEndpoint.

Fixes #1823

**File**: `internal/git/provider/github_provider.go` (modified, +4/-2)
```diff
@@ -211,11 +211,13 @@ func (p *GitHubProvider) Setup() error {
 			return fmt.Errorf("failed to create github app transport: %w", err)
 		}
 
+		apiURL := "https://api.github.com"
 		if p.hostname != "github.com" {
-			transport.BaseURL = serverURL + "/api/v3"
+			apiURL = serverURL + "/api/v3"
+			transport.BaseURL = apiURL
 		}
 
-		p.client, err = github.New(serverURL)
+		p.client, err = github.New(apiURL)
 		if err != nil {
 			return fmt.Errorf("failed to create github client: %w", err)
 		}
```

---

### Incident Patch 9: `273b7aa9` (2026-06-22)
**Commit Message**: fix: install libc6-compat in runner image to fix boundary provider plan (#1825)

**File**: `runner-base.Dockerfile` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@ RUN apk update && \
     busybox \
     ca-certificates \
     git \
+    libc6-compat \
     gnupg \
     libcrypto3=${LIBCRYPTO_VERSION} \
     libssl3=${LIBCRYPTO_VERSION} \
```

---

### Incident Patch 10: `bb44bbbe` (2026-06-19)
**Commit Message**: fix: stop injecting CR metadata labels into Kubernetes backend state Secret selector (#1808)

* fix: use backend-native labels for Kubernetes backend state Secret lookup

Replace getLabelsAsHCL(terraform.Labels) with a stable two-label selector
using the labels the Terraform kubernetes backend already writes onto every
state Secret it creates:

  tfstateSecretSuffix = <secret_suffix>   (CR name or BackendConfig.SecretSuffix)
  tfstateWorkspace    = <workspace>

These labels are present on every existing state Secret so no migration is
required. The selector is independent of CR metadata.labels, so changes
made by Flux, Helm, kustomize overlays or kubectl label can no longer cause
the controller to bootstrap empty Terraform state.

The fix is also Velero backup/restore safe: neither value depends on the CR
UID, which Velero reassigns on restore.

Closes: https://github.com/flux-iac/tofu-controller/issues/1774

* fix: explicit BackendConfig path uses BackendConfig.Labels for HCL block

For the explicit BackendConfig path, delegate label control to the user
via BackendConfig.Labels rather than auto-generating tfstateSecretSuffix
and tfstateWorkspace. Users who provide a BackendConfig 

**File**: `config/testdata/assert-helpers.sh` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+#!/usr/bin/env bash
+# Shared assertion helpers for local-e2e.sh test sections.
+# Source this file before using the functions below.
+
+# assert_label_absent <namespace> <secret> <label-key>
+# Fails if the label key is present (any value) on the Secret.
+assert_label_absent() {
+  local ns=$1 secret=$2 key=$3
+  local val
+  val=$(kubectl -n "$ns" get secret "$secret" \
+        -o jsonpath="{.metadata.labels.$key}" 2>/dev/null || true)
+  if [[ -n "$val" ]]; then
+    echo "FAIL: secret $secret in $ns has unexpected label $key=$val" >&2
+    exit 1
+  fi
+}
+
+# assert_label_present <namespace> <secret> <label-key> <expected-value>
+# Fails if the label key is absent or has a different value on the Secret.
+assert_label_present() {
+  local ns=$1 secret=$2 key=$3 expected=$4
+  local val
+  val=$(kubectl -n "$ns" get secret "$secret" \
+        -o jsonpath="{.metadata.labels.$key}" 2>/dev/null || true)
+  if [[ "$val" != "$expected" ]]; then
+    echo "FAIL: secret $secret in $ns: label $key expected '$expected', got '$val'" >&2
+    exit 1
+  fi
+}
```

**File**: `config/testdata/state-secret-label/backend-labels-expand.yaml` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+# Regression test for BackendConfig.Labels expansion.
+# Verifies that expanding BackendConfig.Labels after the state Secret already exists
+# reuses the same Secret (state is not lost) and the new labels land on the Secret
+# after the next apply — triggered here by a variable change to force real drift.
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-backend-labels-expand
+  labels:
+    kustomize.toolkit.fluxcd.io/name: global-stack-deploy
+    helm.toolkit.fluxcd.io/name: my-release
+spec:
+  interval: 10s
+  approvePlan: "auto"
+  path: ./
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
+  backendConfig:
+    secretSuffix: backend-labels-expand
+    labels:
+      env: staging
```

**File**: `config/testdata/state-secret-label/label-drift.yaml` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+# Regression test for label-drift state loss.
+# The CR carries Flux labels that Flux routinely changes (e.g. on each kustomization sync).
+# After the label change the controller must reuse the same state Secret — not create a new
+# empty one — because the HCL labels block no longer mirrors CR metadata labels.
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-state-label-drift
+  labels:
+    kustomize.toolkit.fluxcd.io/name: global-stack-v1
+    kustomize.toolkit.fluxcd.io/namespace: flux-system
+    helm.toolkit.fluxcd.io/name: my-release-v1
+spec:
+  interval: 10s
+  approvePlan: "auto"
+  path: ./
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
```

**File**: `config/testdata/state-secret-label/same-ns-multi.yaml` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+# Two Terraform CRs in the same namespace sharing the same secretSuffix but using
+# different workspaces. The Kubernetes backend must differentiate their state Secrets
+# via tfstateWorkspace, not CR metadata labels. Both Secrets must be label-clean.
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-ws-dev
+  labels:
+    kustomize.toolkit.fluxcd.io/name: shared-stack
+    kustomize.toolkit.fluxcd.io/namespace: flux-system
+    helm.toolkit.fluxcd.io/name: shared-release
+spec:
+  interval: 10s
+  approvePlan: "auto"
+  path: ./
+  workspace: dev
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-ws-prd
+  labels:
+    kustomize.toolkit.fluxcd.io/name: shared-stack
+    kustomize.toolkit.fluxcd.io/namespace: flux-system
+    helm.toolkit.fluxcd.io/name: shared-release
+spec:
+  interval: 10s
+  approvePlan: "auto"
+  path: ./
+  workspace: prd
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
```

**File**: `config/testdata/state-secret-label/test.yaml` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+# Scenario A: default backend (no BackendConfig), CR carries Flux/Helm labels.
+# The state Secret must NOT inherit any of these CR metadata labels.
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-state-label-default
+  labels:
+    kustomize.toolkit.fluxcd.io/name: global-stack-deploy
+    kustomize.toolkit.fluxcd.io/namespace: flux-system
+    helm.toolkit.fluxcd.io/name: my-release
+    helm.toolkit.fluxcd.io/namespace: flux-system
+spec:
+  interval: 30s
+  approvePlan: "auto"
+  path: ./
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
+
+# Scenario B: explicit BackendConfig present but Labels omitted.
+# Same expectation as A — no CR metadata labels on the state Secret.
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-state-label-backendconfig-nolabels
+  labels:
+    kustomize.toolkit.fluxcd.io/name: global-stack-deploy
+    helm.toolkit.fluxcd.io/name: my-release
+spec:
+  interval: 30s
+  approvePlan: "auto"
+  path: ./
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
+  backendConfig:
+    secretSuffix: state-label-bc-nolabels
+
+# Scenario C: explicit BackendConfig with custom Labels set.
+# The state Secret must carry exactly those labels and still none of the CR metadata labels.
+---
+apiVersion: infra.contrib.fluxcd.io/v1alpha2
+kind: Terraform
+metadata:
+  name: helloworld-state-label-backendconfig-labels
+  labels:
+    kustomize.toolkit.fluxcd.io/name: global-stack-deploy
+    helm.toolkit.fluxcd.io/name: my-release
+spec:
+  interval: 30s
+  approvePlan: "auto"
+  path: ./
+  sourceRef:
+    kind: GitRepository
+    name: helloworld
+  backendConfig:
+    secretSuffix: state-label-bc-labels
+    labels:
+      env: staging
+      app: my-service
```

**File**: `controllers/tc000362_state_secret_label_test.go` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+package controllers
+
+import (
+	"testing"
+
+	. "github.com/onsi/gomega"
+)
+
+// crLabels simulates the metadata.labels a real Terraform CR carries in production:
+// Flux kustomize labels, Helm toolkit labels, and arbitrary user labels.
+// None of these must appear in the backend HCL labels block.
+var crLabels = map[string]string{
+	"kustomize.toolkit.fluxcd.io/name":      "global-stack-deploy",
+	"kustomize.toolkit.fluxcd.io/namespace": "flux-system",
+	"helm.toolkit.fluxcd.io/name":           "global-operator-helmrelease",
+	"helm.toolkit.fluxcd.io/namespace":      "flux-space",
+	"app.kubernetes.io/managed-by":          "Helm",
+	"app.kubernetes.io/part-of":             "my-app",
+	"engr.os.com/ring":                      "dev",
+	"environment":                           "production",
+}
+
+// Test A — default path (no BackendConfig) and explicit BackendConfig with no Labels set:
+// both call getLabelsAsHCL(nil) and must produce an empty HCL labels block.
+// The backend writes tfstate, tfstateSecretSuffix, tfstateWorkspace, and
+// app.kubernetes.io/managed-by natively onto every Secret; the HCL block must not
+// inject any CR metadata labels.
+func Test_000362_nil_labels_produces_empty_hcl_block(t *testing.T) {
+	Spec("nil labels (default path or BackendConfig without Labels) must produce an empty HCL labels block.")
+	g := NewWithT(t)
+
+	hcl := getLabelsAsHCL(nil, 6)
+
+	g.Expect(hcl).To(BeEmpty())
+
+	for k, v := range crLabels {
+		g.Expect(hcl).NotTo(ContainSubstring(k), "CR label key %q must not appear in HCL", k)
+		g.Expect(hcl).NotTo(ContainSubstring(v), "CR label value %q must not appear in HCL", v)
+	}
+}
+
+// Test B — explicit BackendConfig with Labels set: HCL contains exactly those labels
+// and none of the CR metadata labels.
+func Test_000362_backend_config_labels_used_verbatim(t *testing.T) {
+	Spec("BackendConfig.Labels must appear verbatim in HCL; CR metadata labels must not.")
+	g := NewWithT(t)
+
+	backendLabels := map[string]string{
+		"app": "my-service",
+		"env": "staging",
+	}
+
+	hcl := getLabelsAsHCL(backendLabels, 6)
+
+	g.Expect(hcl).To(ContainSubstring(`"app"`))
+	g.Expect(hcl).To(ContainSubstring(`"my-service"`))
+	g.Expect(hcl).To(ContainSubstring(`"env"`))
+	g.Expect(hcl).To(ContainSubstring(`"staging"`))
+
+	for k, v := range crLabels {
+		g.Expect(hcl).NotTo(ContainSubstring(k), "CR label key %q must not appear in HCL", k)
+		g.Expect(hcl).NotTo(ContainSubstring(v), "CR label value %q must not appear in HCL", v)
+	}
+}
```

**File**: `controllers/tf_controller_backend.go` (modified, +2/-2)
```diff
@@ -96,7 +96,7 @@ terraform {
 			terraform.Spec.BackendConfig.InClusterConfig,
 			terraform.Spec.BackendConfig.ConfigPath,
 			terraform.Namespace,
-			getLabelsAsHCL(terraform.Labels, 6))
+			getLabelsAsHCL(terraform.Spec.BackendConfig.Labels, 6))
 	} else if DisableTFK8SBackend && terraform.Spec.BackendConfig == nil {
 		backendConfig = `
 terraform {
@@ -118,7 +118,7 @@ terraform {
 `,
 			terraform.Name,
 			terraform.Namespace,
-			getLabelsAsHCL(terraform.Labels, 6))
+			getLabelsAsHCL(nil, 6))
 	}
 
 	if r.backendCompletelyDisable(terraform) {
```

**File**: `local-e2e.sh` (modified, +184/-0)
```diff
@@ -104,6 +104,190 @@ kubectl -n tofu-system wait terraform/helloworld-vars --for=condition=ready --ti
 # delete after tests
 kubectl -n tofu-system delete -f ./config/testdata/vars
 
+source ./config/testdata/assert-helpers.sh
+
+echo "==================== Run state Secret label tests"
+
+kubectl -n tofu-system apply -f ./config/testdata/state-secret-label/test.yaml
+kubectl -n tofu-system wait terraform/helloworld-state-label-default \
+  --for=condition=ready --timeout=4m
+kubectl -n tofu-system wait terraform/helloworld-state-label-backendconfig-nolabels \
+  --for=condition=ready --timeout=4m
+kubectl -n tofu-system wait terraform/helloworld-state-label-backendconfig-labels \
+  --for=condition=ready --timeout=4m
+
+# Scenario A — default path: no CR metadata labels on state Secret
+SECRET_A="tfstate-default-helloworld-state-label-default"
+assert_label_absent  tofu-system "$SECRET_A" "kustomize.toolkit.fluxcd.io/name"
+assert_label_absent  tofu-system "$SECRET_A" "helm.toolkit.fluxcd.io/name"
+assert_label_present tofu-system "$SECRET_A" "tfstate" "true"
+
+# Scenario B — explicit BackendConfig, Labels omitted: same expectation as A
+SECRET_B="tfstate-default-state-label-bc-nolabels"
+assert_label_absent  tofu-system "$SECRET_B" "kustomize.toolkit.fluxcd.io/name"
+assert_label_absent  tofu-system "$SECRET_B" "helm.toolkit.fluxcd.io/name"
+assert_label_present tofu-system "$SECRET_B" "tfstate" "true"
+
+# Scenario C — explicit BackendConfig with Labels: custom labels present, CR labels absent
+SECRET_C="tfstate-default-state-label-bc-labels"
+assert_label_absent  tofu-system "$SECRET_C" "kustomize.toolkit.fluxcd.io/name"
+assert_label_absent  tofu-system "$SECRET_C" "helm.toolkit.fluxcd.io/name"
+assert_label_present tofu-system "$SECRET_C" "env" "staging"
+assert_label_present tofu-system "$SECRET_C" "app" "my-service"
+
+echo "state Secret label tests passed"
+
+# delete after tests
+kubectl -n tofu-system delete -f ./config/testdata/state-secret-label/test.yaml
+
+echo "==================== Run state Secret label-drift regression test"
+
+kubectl -n tofu-system apply -f ./config/testdata/state-secret-label/label-drift.yaml
+kubectl -n tofu-system wait terraform/helloworld-state-label-drift \
+  --for=condition=ready --timeout=4m
+
+DRIFT_SECRET="tfstate-default-helloworld-state-label-drift"
+
+# Capture the state before the label change
+state_before=$(kubectl -n tofu-system get secret "$DRIFT_SECRET" \
+  -o jsonpath='{.data.tfstate}' 2>/dev/null || true)
+if [[ -z "$state_before" ]]; then
+  echo "FAIL: state Secret has no tfstate data before label change" >&2
+  exit 1
+fi
+
+# Simulate Flux updating the CR labels (e.g. new kustomization revision)
+kubectl -n tofu-system patch terraform/helloworld-state-label-drift --type=merge -p \
+  '{"metadata":{"labels":{"kustomize.toolkit.fluxcd.io/name":"global-stack-v2","helm.toolkit.fluxcd.io/name":"my-release-v2"}}}'
+
+# Force an immediate reconcile and wait for it to settle
+kubectl -n tofu-system annotate terraform/helloworld-state-label-drift \
+  reconcile.fluxcd.io/requestedAt="$(date -u +%Y-%m-%dT%H:%M:%SZ)" --overwrite
+kubectl -n tofu-system wait terraform/helloworld-state-label-drift \
+  --for=condition=ready --timeout=4m
+
+# Verify: still exactly one state Secret for this CR (no duplicate created by label drift)
+secret_count=$(kubectl -n tofu-system get secrets --no-headers \
+  | grep -c "^${DRIFT_SECRET}" || true)
+if [[ "$secret_count" != "1" ]]; then
+  echo "FAIL: expected 1 state Secret after label change, found $secret_count" >&2
+  exit 1
+fi
+echo "OK: exactly 1 state Secret after label change"
+
+# Verify: state Secret still holds the original tfstate data (state was not lost)
+state_after=$(kubectl -n tofu-system get secret "$DRIFT_SECRET" \
+  -o jsonpath='{.data.tfstate}' 2>/dev/null || true)
+if [[ -z "$state_after" ]]; then
+  echo "FAIL: state Secret has no tfstate data after label change — state was lost" >&2
+  exit 1
+fi
+if [[ "$state_after" != "$state_before" ]]; then
+  echo "FAIL: tfstate data changed after label update — a new empty Secret may have been used" >&2
+  exit 1
+fi
+echo "OK: tfstate data preserved after label change"
+
+echo "state Secret label-drift regression test passed"
+
+# delete after tests
+kubectl -n tofu-system delete -f ./config/testdata/state-secret-label/label-drift.yaml
+
+echo "==================== Run BackendConfig label expansion test"
+
+kubectl -n tofu-system apply -f ./config/testdata/state-secret-label/backend-labels-expand.yaml
+kubectl -n tofu-system wait terraform/helloworld-backend-labels-expand \
+  --for=condition=ready --timeout=4m
+
+EXPAND_SECRET="tfstate-default-backend-labels-expand"
+
+# Capture state before adding a label
+state_before=$(kubectl -n tofu-system get secret "$EXPAND_SECRET" \
+  -o jsonpath='{.data.tfstate}' 2>/dev/null || true)
+if [[ -z "$state_before" ]]; then
+  echo "FAIL: state Secret has no tfstate data before label expansion" >&2
+  exit 1
+fi
+ass
```

---

### Incident Patch 11: `fec5e86b` (2026-06-17)
**Commit Message**: fix(deps): bump libcrypto3 to 3.5.7-r0 (#1827)

**File**: `.github/workflows/build-and-publish.yaml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ permissions:
 env:
   CONTROLLER: ${{ github.event.repository.name }}
   REGISTRY_OWNER: ${{ github.repository_owner }}
-  LIBCRYPTO_VERSION: "3.5.6-r0"
+  LIBCRYPTO_VERSION: "3.5.7-r0"
 
 jobs:
   test:
```

**File**: `.github/workflows/release-runners.yaml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ permissions:
 env:
   VERSION: ${{ github.event.inputs.version || github.event.client_payload.version }}
   BUILD_DATE: ${{ github.event.inputs.build_date || github.event.client_payload.build_date }}
-  LIBCRYPTO_VERSION: "3.5.6-r0"
+  LIBCRYPTO_VERSION: "3.5.7-r0"
 
 jobs:
   release-base:
```

**File**: `.github/workflows/release.yaml` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ permissions:
 env:
   CONTROLLER: ${{ github.event.repository.name }}
   REGISTRY_OWNER: ${{ github.repository_owner }}
-  LIBCRYPTO_VERSION: "3.5.6-r0"
+  LIBCRYPTO_VERSION: "3.5.7-r0"
 
 jobs:
   build-push:
```

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ BUILD_VERSION ?= $(shell git describe --tags $$(git rev-list --tags --max-count=
 # - .github/workflows/release-runners.yaml
 # - .github/workflows/release.yaml
 # - Tiltfile
-LIBCRYPTO_VERSION ?= 3.5.6-r0
+LIBCRYPTO_VERSION ?= 3.5.7-r0
 
 # source controller version
 SOURCE_VER ?= v1.7.4
```

**File**: `Tiltfile` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ tfNamespace      = "terraform"
 buildSHA         = str(local('git rev-parse --short HEAD')).rstrip('\n')
 buildVersionRef  = str(local('git rev-list --tags --max-count=1')).rstrip('\n')
 buildVersion     = str(local("git describe --tags ${buildVersionRef}")).rstrip('\n')
-LIBCRYPTO_VERSION = "3.5.6-r0"
+LIBCRYPTO_VERSION = "3.5.7-r0"
 
 if os.path.exists('Tiltfile.local'):
    include('Tiltfile.local')
```

---

### Incident Patch 12: `e31b0143` (2026-06-08)
**Commit Message**: Merge pull request #1813 from adonispd/fix/bump-go-cve-2026-42504

fix(deps): bump go to 1.26.4 to patch CVE-2026-42504

**File**: `.go-version` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+1.26.4
```

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-ARG GO_VERSION=1.26.3
+ARG GO_VERSION=1.26.4
 FROM --platform=$BUILDPLATFORM golang:${GO_VERSION} AS builder
 
 WORKDIR /build
```

**File**: `api/go.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module github.com/flux-iac/tofu-controller/api
 
-go 1.26.3
+go 1.26.4
 
 require (
 	github.com/fluxcd/pkg/apis/meta v1.27.0
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module github.com/flux-iac/tofu-controller
 
-go 1.26.3
+go 1.26.4
 
 replace github.com/flux-iac/tofu-controller/api => ./api
 
```

**File**: `planner.Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-ARG GO_VERSION=1.26.3
+ARG GO_VERSION=1.26.4
 FROM --platform=$BUILDPLATFORM golang:${GO_VERSION} AS builder
 
 WORKDIR /build
```

**File**: `runner-base.Dockerfile` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # Build the manager binary
-ARG GO_VERSION=1.26.3
+ARG GO_VERSION=1.26.4
 FROM --platform=$BUILDPLATFORM golang:${GO_VERSION} AS builder
 
 ARG BUILD_SHA
```

**File**: `tfctl/go.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module github.com/flux-iac/tofu-controller/tfctl
 
-go 1.26.3
+go 1.26.4
 
 replace github.com/flux-iac/tofu-controller/api => ../api
 
```

---

### Incident Patch 13: `02d28ee4` (2026-06-02)
**Commit Message**: Merge pull request #1811 from adonispd/fix/local-dev-tooling

fix: make local dev tooling work on Apple Silicon and containerd v2

**File**: `local-e2e.sh` (modified, +12/-1)
```diff
@@ -3,8 +3,19 @@
 # Exit the script if any command fails
 set -e
 
+# On Apple Silicon Macs the default amd64 kindest/node image causes the kubelet to fail.
+# Force native arm64 images so kind bootstraps correctly on arm64 hosts.
+case "$(uname -m)" in
+  arm64|aarch64)
+    export DOCKER_DEFAULT_PLATFORM=linux/arm64
+    ;;
+esac
+
 VERSION=e2e-$(git rev-parse --short HEAD)-$(if [[ $(git diff --stat) != '' ]]; then echo 'dirty'; else echo 'clean'; fi)
 
+# Delete any leftover cluster from a previous run so this script is idempotent
+kind delete cluster 2>/dev/null || true
+
 kind create cluster
 
 [[ -z "$SKIP_IMAGE_BUILD" ]] && make docker-build MANAGER_IMG=test/tofu-controller RUNNER_IMG=test/tf-runner TAG=$VERSION # BUILD_ARGS="--no-cache"
@@ -34,7 +45,7 @@ kubectl -n tofu-system rollout status deploy/source-controller --timeout=1m
 kubectl -n tofu-system rollout status deploy/tofu-controller --timeout=1m
 
 echo "==================== Show Terraform version"
-docker run --rm --entrypoint=/usr/local/bin/terraform test/tf-runner:$VERSION version
+docker run --rm --entrypoint=/usr/local/bin/tofu test/tf-runner:$VERSION version
 
 echo "==================== Add git repository source"
 kubectl -n tofu-system apply -f ./config/testdata/source
```

**File**: `tools/reboot.sh` (modified, +25/-4)
```diff
@@ -19,6 +19,15 @@
 
 set -o errexit
 
+# On Apple Silicon Macs where Docker Desktop defaults to amd64/Rosetta 2 emulation,
+# the kindest/node amd64 image causes the kubelet to fail at health-check time.
+# Force native arm64 images so kind bootstraps correctly on arm64 hosts.
+case "$(uname -m)" in
+  arm64|aarch64)
+    export DOCKER_DEFAULT_PLATFORM=linux/arm64
+    ;;
+esac
+
 # desired cluster name; default is "tfdev"
 KIND_CLUSTER_NAME="${KIND_CLUSTER_NAME:-tfdev}"
 KIND_CLUSTER_OPTS="--name ${KIND_CLUSTER_NAME}"
@@ -45,7 +54,7 @@ running="$(docker inspect -f '{{.State.Running}}' "${reg_name}" 2>/dev/null || t
 if [ "${running}" != 'true' ]; then
   docker run \
     -d --restart=always -p "${reg_port}:5000" --name "${reg_name}" \
-    registry:2
+    registry:3
 fi
 
 reg_host="${reg_name}"
@@ -57,16 +66,28 @@ echo "Registry Host: ${reg_host}"
 # delete previous cluster, if any
 kind delete cluster --name=${KIND_CLUSTER_NAME} || true
 
-# create a cluster with the local registry enabled in containerd
+# create a cluster with containerd configured to use per-registry hosts.toml files
+# (containerd v2 removed registry.mirrors in favour of config_path + hosts.toml)
 cat <<EOF | kind create cluster ${KIND_CLUSTER_OPTS} --config=-
 kind: Cluster
 apiVersion: kind.x-k8s.io/v1alpha4
 containerdConfigPatches:
 - |-
-  [plugins."io.containerd.grpc.v1.cri".registry.mirrors."localhost:${reg_port}"]
-    endpoint = ["http://${reg_host}:5000"]
+  [plugins."io.containerd.grpc.v1.cri".registry]
+    config_path = "/etc/containerd/certs.d"
 EOF
 
+# Wire the local registry mirror into each node via a hosts.toml file.
+# extraMounts cannot be used here because the container path contains a colon
+# (localhost:PORT) which Docker's --volume flag treats as a delimiter.
+for node in $(kind get nodes --name ${KIND_CLUSTER_NAME}); do
+  docker exec "${node}" mkdir -p "/etc/containerd/certs.d/localhost:${reg_port}"
+  docker exec -i "${node}" sh -c "cat > /etc/containerd/certs.d/localhost:${reg_port}/hosts.toml" <<HOSTS
+[host."http://${reg_host}:5000"]
+  capabilities = ["pull", "resolve", "push"]
+HOSTS
+done
+
 cat <<EOF | kubectl apply -f -
 apiVersion: v1
 kind: ConfigMap
```

---

### Incident Patch 14: `51aa81c6` (2026-06-01)
**Commit Message**: fix: make local dev tooling work on Apple Silicon and containerd v2

local-e2e.sh:
- Set DOCKER_DEFAULT_PLATFORM=linux/arm64 on arm64/aarch64 hosts so kind
  bootstraps with native images instead of emulated amd64 (fixes kubelet
  health-check failures on Apple Silicon)
- Add `kind delete cluster` before `kind create cluster` so the script is
  idempotent across repeated runs
- Fix tf-runner version probe: entrypoint is /usr/local/bin/tofu, not terraform

tools/reboot.sh:
- Same arm64 platform guard as above
- Migrate containerd registry config from the removed registry.mirrors TOML key
  to the config_path + per-node hosts.toml approach required by containerd v2
- Bump registry image from registry:2 to registry:3

**File**: `local-e2e.sh` (modified, +12/-1)
```diff
@@ -3,8 +3,19 @@
 # Exit the script if any command fails
 set -e
 
+# On Apple Silicon Macs the default amd64 kindest/node image causes the kubelet to fail.
+# Force native arm64 images so kind bootstraps correctly on arm64 hosts.
+case "$(uname -m)" in
+  arm64|aarch64)
+    export DOCKER_DEFAULT_PLATFORM=linux/arm64
+    ;;
+esac
+
 VERSION=e2e-$(git rev-parse --short HEAD)-$(if [[ $(git diff --stat) != '' ]]; then echo 'dirty'; else echo 'clean'; fi)
 
+# Delete any leftover cluster from a previous run so this script is idempotent
+kind delete cluster 2>/dev/null || true
+
 kind create cluster
 
 [[ -z "$SKIP_IMAGE_BUILD" ]] && make docker-build MANAGER_IMG=test/tofu-controller RUNNER_IMG=test/tf-runner TAG=$VERSION # BUILD_ARGS="--no-cache"
@@ -34,7 +45,7 @@ kubectl -n tofu-system rollout status deploy/source-controller --timeout=1m
 kubectl -n tofu-system rollout status deploy/tofu-controller --timeout=1m
 
 echo "==================== Show Terraform version"
-docker run --rm --entrypoint=/usr/local/bin/terraform test/tf-runner:$VERSION version
+docker run --rm --entrypoint=/usr/local/bin/tofu test/tf-runner:$VERSION version
 
 echo "==================== Add git repository source"
 kubectl -n tofu-system apply -f ./config/testdata/source
```

**File**: `tools/reboot.sh` (modified, +25/-4)
```diff
@@ -19,6 +19,15 @@
 
 set -o errexit
 
+# On Apple Silicon Macs where Docker Desktop defaults to amd64/Rosetta 2 emulation,
+# the kindest/node amd64 image causes the kubelet to fail at health-check time.
+# Force native arm64 images so kind bootstraps correctly on arm64 hosts.
+case "$(uname -m)" in
+  arm64|aarch64)
+    export DOCKER_DEFAULT_PLATFORM=linux/arm64
+    ;;
+esac
+
 # desired cluster name; default is "tfdev"
 KIND_CLUSTER_NAME="${KIND_CLUSTER_NAME:-tfdev}"
 KIND_CLUSTER_OPTS="--name ${KIND_CLUSTER_NAME}"
@@ -45,7 +54,7 @@ running="$(docker inspect -f '{{.State.Running}}' "${reg_name}" 2>/dev/null || t
 if [ "${running}" != 'true' ]; then
   docker run \
     -d --restart=always -p "${reg_port}:5000" --name "${reg_name}" \
-    registry:2
+    registry:3
 fi
 
 reg_host="${reg_name}"
@@ -57,16 +66,28 @@ echo "Registry Host: ${reg_host}"
 # delete previous cluster, if any
 kind delete cluster --name=${KIND_CLUSTER_NAME} || true
 
-# create a cluster with the local registry enabled in containerd
+# create a cluster with containerd configured to use per-registry hosts.toml files
+# (containerd v2 removed registry.mirrors in favour of config_path + hosts.toml)
 cat <<EOF | kind create cluster ${KIND_CLUSTER_OPTS} --config=-
 kind: Cluster
 apiVersion: kind.x-k8s.io/v1alpha4
 containerdConfigPatches:
 - |-
-  [plugins."io.containerd.grpc.v1.cri".registry.mirrors."localhost:${reg_port}"]
-    endpoint = ["http://${reg_host}:5000"]
+  [plugins."io.containerd.grpc.v1.cri".registry]
+    config_path = "/etc/containerd/certs.d"
 EOF
 
+# Wire the local registry mirror into each node via a hosts.toml file.
+# extraMounts cannot be used here because the container path contains a colon
+# (localhost:PORT) which Docker's --volume flag treats as a delimiter.
+for node in $(kind get nodes --name ${KIND_CLUSTER_NAME}); do
+  docker exec "${node}" mkdir -p "/etc/containerd/certs.d/localhost:${reg_port}"
+  docker exec -i "${node}" sh -c "cat > /etc/containerd/certs.d/localhost:${reg_port}/hosts.toml" <<HOSTS
+[host."http://${reg_host}:5000"]
+  capabilities = ["pull", "resolve", "push"]
+HOSTS
+done
+
 cat <<EOF | kubectl apply -f -
 apiVersion: v1
 kind: ConfigMap
```

---

### Incident Patch 15: `c2c83130` (2026-05-28)
**Commit Message**: fix(deps): bump opentofu to v1.12.1 (#1806)

**File**: `.github/workflows/build-and-publish.yaml` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ jobs:
           go-version-file: go.mod
       - name: Setup OpenTofu
         run: |
-          export TOFU_VERSION=1.11.6
+          export TOFU_VERSION=1.12.1
           wget https://github.com/opentofu/opentofu/releases/download/v${TOFU_VERSION}/tofu_${TOFU_VERSION}_linux_amd64.zip
           unzip -q tofu_${TOFU_VERSION}_linux_amd64.zip tofu
           mv tofu /usr/local/bin
```

**File**: `.github/workflows/targeted-test.yaml` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ jobs:
             **/go.mod
       - name: Setup OpenTofu
         run: |
-          export TOFU_VERSION=1.11.6
+          export TOFU_VERSION=1.12.1
           wget https://github.com/opentofu/opentofu/releases/download/v${TOFU_VERSION}/tofu_${TOFU_VERSION}_linux_amd64.zip
           unzip -q tofu_${TOFU_VERSION}_linux_amd64.zip tofu
           mv tofu /usr/local/bin
```

**File**: `.github/workflows/test.yaml` (modified, +2/-2)
```diff
@@ -68,7 +68,7 @@ jobs:
             **/go.mod
       - name: Setup OpenTofu
         run: |
-          export TOFU_VERSION=1.11.6
+          export TOFU_VERSION=1.12.1
           wget https://github.com/opentofu/opentofu/releases/download/v${TOFU_VERSION}/tofu_${TOFU_VERSION}_linux_amd64.zip
           unzip -q tofu_${TOFU_VERSION}_linux_amd64.zip tofu
           mv tofu /usr/local/bin
@@ -95,7 +95,7 @@ jobs:
             **/go.mod
       - name: Setup OpenTofu
         run: |
-          export TOFU_VERSION=1.11.6
+          export TOFU_VERSION=1.12.1
           wget https://github.com/opentofu/opentofu/releases/download/v${TOFU_VERSION}/tofu_${TOFU_VERSION}_linux_amd64.zip
           unzip -q tofu_${TOFU_VERSION}_linux_amd64.zip tofu
           mv tofu /usr/local/bin
```

**File**: `runner-azure.Dockerfile` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 ARG BASE_IMAGE
-ARG TOFU_VERSION=1.11.6
+ARG TOFU_VERSION=1.12.1
 
 FROM ghcr.io/opentofu/opentofu:${TOFU_VERSION}-minimal AS tofu
 
```

**File**: `runner.Dockerfile` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 ARG BASE_IMAGE
-ARG TOFU_VERSION=1.11.6
+ARG TOFU_VERSION=1.12.1
 
 FROM ghcr.io/opentofu/opentofu:${TOFU_VERSION}-minimal AS tofu
 
```

**File**: `runner.Dockerfile.dev` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 ARG TARGETARCH
-ARG TOFU_VERSION=1.11.6
+ARG TOFU_VERSION=1.12.1
 FROM ghcr.io/opentofu/opentofu:${TOFU_VERSION}-minimal AS tofu
 
 FROM alpine:3.22 AS base
```

#### Recent Merged Pull Requests:
- **PR #1897** (closed): chore(deps): bump the go-patch group across 3 directories with 11 updates (@dependabot[bot])
- **PR #1895** (closed): chore(deps): bump the go-minor group across 3 directories with 18 updates (@dependabot[bot])
- **PR #1894** (closed): chore(deps): bump the go-patch group across 3 directories with 6 updates (@dependabot[bot])
- **PR #1891** (2026-09-21): test: fix flakiness observed with the mTLS CA rotations (@mloiseleur)
- **PR #1888** (closed): chore(deps): bump the gh-minor group across 1 directory with 9 updates (@dependabot[bot])
- **PR #1887** (closed): chore(deps): bump the go-minor group across 3 directories with 14 updates (@dependabot[bot])
- **PR #1886** (closed): chore(deps): bump the go-patch group across 2 directories with 5 updates (@dependabot[bot])
- **PR #1882** (closed): chore(deps): bump google.golang.org/protobuf from 1.36.12-0.20260120151049-f2248ac996af to 1.36.12 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

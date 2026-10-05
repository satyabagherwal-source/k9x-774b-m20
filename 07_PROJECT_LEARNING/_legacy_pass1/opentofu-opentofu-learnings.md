# Forensic Learning Record (Deep Inspection): opentofu/opentofu

> **Canonical Artifact**: `07_PROJECT_LEARNING/opentofu-opentofu-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/opentofu/opentofu](https://github.com/opentofu/opentofu))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T17:44:22.034Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `opentofu/opentofu`
- **Description**: OpenTofu lets you declaratively manage your cloud infrastructure.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 30389 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/backend/local/hook_state.go`
```
// Copyright (c) The OpenTofu Authors
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2023 HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package local

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/opentofu/opentofu/internal/states"
	"github.com/opentofu/opentofu/internal/states/statemgr"
	"github.com/opentofu/opentofu/internal/tofu"
)

// StateHook is a hook that continuously updates the state by calling
// WriteState on a statemgr.Full.
type StateHook struct {
	tofu.NilHook
	sync.Mutex

	StateMgr statemgr.Writer

	// If PersistInterval is nonzero then for any new state update after
	// the duration has elapsed we'll try to persist a state snapshot
	// to the persistent backend too.
	// That's only possible if field Schemas is valid, because the
	// StateMgr.PersistState function for some backends needs schemas.
	PersistInterval time.Duration

	// Schemas are the schemas to use when persisting state due to
	// PersistInterval. This is ignored if PersistInterval is zero,
	// and PersistInterval is ignored if this is nil.
	Schemas *tofu.Schemas

	intermediatePersist IntermediateStatePersistInfo
}

type IntermediateStatePersistInfo struct {
	// RequestedPersistInterval is the persist interval requested by whatever
	// instantiated the StateHook.
	//
	// Implementations of [IntermediateStateConditionalPersister] should ideally
	// respect this, but may ignore it if they use something other than the
	// passage of time to make their decision.
	RequestedPersistInterval time.Duration

	// LastPersist is the time when the last intermediate state snapshot was
	// persisted, or the time of the first report for OpenTofu Core if there
	// hasn't yet been a persisted snapshot.
	LastPersist time.Time

	// ForcePersist is true when OpenTofu CLI has received an interrupt
	// signal and is therefore trying to create snapshots more aggressively
	// in anticipation of possibly being terminated ungracefully.
	// [IntermediateStateConditionalPersister] implementations should ideally
	// persist every snapshot they get when this flag is set, unless they have
	// some external information that implies this shouldn't be necessary.
	ForcePersist bool
}

var _ tofu.Hook = (*StateHook)(nil)

func (h *StateHook) PostStateUpdate(mutate func(*states.SyncState)) (tofu.HookAction, error) {
	h.Lock()
	defer h.Unlock()

	h.intermediatePersist.RequestedPersistInterval = h.PersistInterval

	if h.intermediatePersist.LastPersist.IsZero() {
		// The first PostStateUpdate starts the clock for intermediate
		// calls to PersistState.
		h.intermediatePersist.LastPersist = time.Now()
	}

	if h.StateMgr != nil {
		err := h.StateMgr.MutateState(func(state *states.State) *states.State {
			if state == nil {
				state = states.NewState()
			}
			mutate(state.SyncWrapper())
			return state
		})
		if err != nil {
			return tofu.HookActionHalt, err
		}

		if mgrPersist, ok := h.StateMgr.(statemgr.Persister); ok && h.PersistInterval != 0 && h.Schemas != nil {
			if h.shouldPersist() {
				err := mgrPersist.PersistState(context.TODO(), h.Schemas)
				if err != nil {
					return tofu.HookActionHalt, err
				}
				h.intermediatePersist.LastPersist = time.Now()
			} else {
				log.Printf("[DEBUG] State storage %T declined to persist a state snapshot", h.StateMgr)
			}
		}
	}

	return tofu.HookActionContinue, nil
}

func (h *StateHook) Stopping() {
	h.Lock()
	defer h.Unlock()

	// If OpenTofu has been asked to stop then that might mean that a hard
	// kill signal will follow shortly in case OpenTofu doesn't stop
	// quickly enough, and so we'll try to persist the latest state
	// snapshot in the hope that it'll give the user less recovery work to
	// do if they _do_ subsequently hard-kill OpenTofu during an apply.

	if mgrPersist, ok := h.StateMgr.(statemgr.Persister); ok && h.Schemas != nil {
		// While we're in the stopping phase we'll try to persist every
		// new state update to maximize every opportunity we get to avoid
		// losing track of objects that have been created or updated.
		// OpenTofu Core won't start any new operations after it's been
		// stopped, so at most we should see one more PostStateUpdate
		// call per already-active request.
		h.intermediatePersist.ForcePersist = true

		if h.shouldPersist() {
			err := mgrPersist.PersistState(context.TODO(), h.Schemas)
			if err != nil {
				// This hook can't affect OpenTofu Core's ongoing behavior,
				// but it's a best effort thing anyway, so we'll just emit a
				// log to aid with debugging.
				log.Printf("[ERROR] Failed to persist state after interruption: %s", err)
			}
		} else {
			log.Printf("[DEBUG] State storage %T declined to persist a state snapshot", h.StateMgr)
		}
	}

}

func (h *StateHook) shouldPersist() bool {
	if m, ok := h.StateMgr.(IntermediateStateConditionalPersister); ok {
		return m.ShouldPersistIntermediateState(&h.intermediatePersist)
	}
	return DefaultIntermediateStatePersistRule(&h.intermediatePersist)
}

// DefaultIntermediateStatePersistRule is the default implementation of
// [IntermediateStateConditionalPersister.ShouldPersistIntermediateState] used
// when the selected state manager doesn't implement that interface.
//
// Implementers of that interface can optionally wrap a call to this function
// if they want to combine the default behavior with some logic of their own.
func DefaultIntermediateStatePersistRule(info *IntermediateStatePersistInfo) bool {
	return info.ForcePersist || time.Since(info.LastPersist) >= info.RequestedPersistInterval
}

// IntermediateStateConditionalPersister is an optional extension of
// [statemgr.Persister] that allows an implementation to tailor the rules for
// whether to create intermediate state snapshots when OpenTofu Core emits
// events reporting that the state might have changed.
//
// For state managers that don't implement this interface, [StateHook] uses
// a default set of rules that aim to be a good compromise between how long
// a state change can be active before it gets committed as a snapshot vs.
// how many intermediate snapshots will get created. That compromise is subject
// to change over time, but a state manager can implement this interface to
// exert full control over those rules.
type IntermediateStateConditionalPersister interface {
	// ShouldPersistIntermediateState will be called each time OpenTofu Core
	// emits an intermediate state event that is potentially eligible to be
	// persisted.
	//
	// The implementation should return true to signal that the state snapshot
	// most recently provided to the object's WriteState should be persisted,
	// or false if it should not be persisted. If this function returns true
	// then the receiver will see a subsequent call to
	// [statemgr.Persister.PersistState] to request persistence.
	//
	// The implementation must not modify anything reachable through the
	// arguments, and must not retain pointers to anything reachable through
	// them after the function returns. However, implementers can assume that
	// nothing will write to anything reachable through the arguments while
	// this function is active.
	ShouldPersistIntermediateState(info *IntermediateStatePersistInfo) bool
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/auth/ado_auth.go`
```
// Copyright (c) The OpenTofu Authors
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2023 HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package auth

import (
	"context"
	"fmt"
	"os"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/opentofu/opentofu/internal/httpclient"
	"github.com/opentofu/opentofu/internal/tfdiags"
)

type ADOAuthConfig struct {
	ADOServiceConnectionId string
}

type adoAuth struct{}

var _ AuthMethod = &adoAuth{}

func (cred *adoAuth) Name() string {
	return "Azure DevOps Auth"
}

func (cred *adoAuth) Construct(ctx context.Context, config *Config) (azcore.TokenCredential, error) {
	clientId, err := consolidateClientId(config)
	if err != nil {
		return nil, err
	}

	return azidentity.NewAzurePipelinesCredential(
		config.TenantID,
		clientId,
		config.ADOServiceConnectionId,
		config.OIDCRequestToken,
		&azidentity.AzurePipelinesCredentialOptions{
			ClientOptions: clientOptions(httpclient.New(ctx), config.CloudConfig),
		},
	)
}

func (cred *adoAuth) Validate(ctx context.Context, config *Config) tfdiags.Diagnostics {
	var diags tfdiags.Diagnostics
	if !config.UseOIDC || config.ADOServiceConnectionId == "" {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure DevOps Auth",
			"To use Azure DevOps Auth, use_oidc must be set directly or via environment variable ARM_USE_OIDC. Additionally, the Azure DevOps Service Connection ID must be provided. If you are running in Azure DevOps, make sure you have serviceConnection configured for the pipeline task.",
		))
		return diags
	}
	if os.Getenv("SYSTEM_OIDCREQUESTURI") == "" {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure DevOps Auth",
			"ADO System OIDC Request URI is missing. This should be set by the Azure DevOps pipeline service via the SYSTEM_OIDCREQUESTURI environment variable.",
		))
	}
	if config.OIDCRequestToken == "" {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure DevOps Auth",
			"An access token for fetching a federation token must be provided.",
		))
	}
	if config.TenantID == "" {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure DevOps Auth",
			"Tenant ID is missing.",
		))
	}
	_, err := cred.Construct(ctx, config)
	if err != nil {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure DevOps Auth",
			fmt.Sprintf("Tried to create the credential, but received this error instead: %s.", tfdiags.FormatError(err)),
		))
	}
	return diags
}

func (cred *adoAuth) AugmentConfig(_ context.Context, config *Config) error {
	return checkNamesForAccessKeyCredentials(config.StorageAddresses)
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/auth/auth.go`
```
// Copyright (c) The OpenTofu Authors
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2023 HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package auth

import (
	"context"
	"log"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/opentofu/opentofu/internal/tfdiags"
)

type Config struct {
	ADOAuthConfig
	AzureCLIAuthConfig
	ClientSecretCredentialAuthConfig
	ClientCertificateAuthConfig
	OIDCAuthConfig
	MSIAuthConfig
	StorageAddresses
	WorkloadIdentityAuthConfig
}

type AuthMethod interface {
	// Construct takes the configuration and obtains an Azure-native
	// authentication method, appropriate for the Azure sdk's various clients.
	Construct(ctx context.Context, config *Config) (azcore.TokenCredential, error)

	// Validate ensures this authentication method has the configuration variables and is
	// the appropriate method to use. A nil return for diagnostics implies that there is no
	// need to look further for authentication methods.
	Validate(ctx context.Context, config *Config) tfdiags.Diagnostics

	// AugmentConfig should be called to ensure the config has all proper storage names
	// when attempting to get the storage account's access keys. It will return an error if
	// the expected storage names, IDs, and addresses are not present.
	//
	// Note: only the CLI is really able to actually *change* the config, by obtaining information
	// out of the azure profile saved on the filesystem.
	AugmentConfig(ctx context.Context, config *Config) error

	// Name provides a simple english name for the auth method; used for debugging
	Name() string
}

func GetAuthMethod(ctx context.Context, config *Config) (AuthMethod, error) {
	authMethods := []AuthMethod{
		&clientCertAuth{},
		&clientSecretCredentialAuth{},
		// make sure this comes before oidcAuth, since adoAuth is a more specific OIDC auth
		&adoAuth{},
		&oidcAuth{},
		&managedIdentityAuth{},
		&workloadIdentityAuth{},
		&azureCLICredentialAuth{},
	}
	var diags tfdiags.Diagnostics
	for _, authMethod := range authMethods {
		if d := authMethod.Validate(ctx, config); d.HasErrors() {
			diags = diags.Append(d)
			continue
		}
		log.Printf("[DEBUG] Selected Azure auth method: %s", authMethod.Name())
		return authMethod, nil
	}
	diags = diags.Append(tfdiags.Sourceless(
		tfdiags.Error,
		"No valid azure auth methods found",
		"Please see above warnings for details about what each auth method needs to properly work.",
	))
	return nil, diags.ErrWithWarnings()
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/auth/cli_auth.go`
```
// Copyright (c) The OpenTofu Authors
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2023 HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/opentofu/opentofu/internal/tfdiags"
)

type AzureCLIAuthConfig struct {
	CLIAuthEnabled bool
}

type azureCLICredentialAuth struct{}

var _ AuthMethod = &azureCLICredentialAuth{}

func (cred *azureCLICredentialAuth) Name() string {
	return "Azure CLI Auth"
}

func (cred *azureCLICredentialAuth) Construct(_ context.Context, config *Config) (azcore.TokenCredential, error) {
	// The SubscriptionID and TenantID can be empty, and the logic of this will still be okay
	return azidentity.NewAzureCLICredential(&azidentity.AzureCLICredentialOptions{
		Subscription: config.StorageAddresses.SubscriptionID,
		TenantID:     config.StorageAddresses.TenantID,
	})
}

func (cred *azureCLICredentialAuth) Validate(ctx context.Context, config *Config) tfdiags.Diagnostics {
	var diags tfdiags.Diagnostics
	if !config.CLIAuthEnabled {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure Command Line Auth",
			"Setting use_cli to false prevents the use of command-line auth (az).",
		))
		return diags
	}
	_, err := exec.LookPath("az")
	if err != nil {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure Command Line Auth",
			"Error looking for command az in your PATH. Make sure the Azure Command Line tool is installed and executable.",
		))
		return diags
	}
	// Make sure the user is logged in by attempting to get the subscription
	_, err = getCurrentSubscriptionInfo(ctx)
	if err != nil {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure Command Line Auth",
			fmt.Sprintf("Error using the az command: %s.", tfdiags.FormatError(err)),
		))
	}
	return diags
}

func (cred *azureCLICredentialAuth) AugmentConfig(ctx context.Context, config *Config) (err error) {
	if config.StorageAddresses.SubscriptionID == "" {
		config.StorageAddresses.SubscriptionID, err = getCliAzureSubscriptionID(ctx)
		if err != nil {
			return err
		}
	}
	return checkNamesForAccessKeyCredentials(config.StorageAddresses)
}

type Subscription struct {
	Id        string `json:"id"`
	Name      string `json:"name"`
	IsDefault bool   `json:"isDefault"`
}

// getCliAzureSubscriptionID obtains the subscription ID currently active in the
// Azure profile. This assumes the user has the Azure CLI installed on their machine.
func getCliAzureSubscriptionID(ctx context.Context) (string, error) {
	rawSubscription, err := getCurrentSubscriptionInfo(ctx)
	if err != nil {
		return "", err
	}

	var subscription Subscription
	err = json.Unmarshal(rawSubscription, &subscription)
	if err != nil {
		return "", fmt.Errorf("json error for azure subscription: %w", err)
	}

	return subscription.Id, nil
}

// getCurrentSubscriptionInfo is adapted from azure-sdk-for-go's CLI token retrieval
func getCurrentSubscriptionInfo(ctx context.Context) ([]byte, error) {
	cliCmd := exec.CommandContext(ctx, "az", "account", "show", "-o", "json")
	var stderr bytes.Buffer
	cliCmd.Stderr = &stderr

	stdout, err := cliCmd.Output()
	if err != nil {
		msg := stderr.String()
		return nil, fmt.Errorf("error getting subscription info: error: %w\nmore information: %s", err, msg)
	}

	return stdout, nil
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/auth/client_cert_auth.go`
```
// Copyright (c) The OpenTofu Authors
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2023 HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package auth

import (
	"bytes"
	"context"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"os"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/opentofu/opentofu/internal/httpclient"
	"github.com/opentofu/opentofu/internal/tfdiags"
	"golang.org/x/crypto/pkcs12"
)

type ClientCertificateAuthConfig struct {
	ClientCertificate         string
	ClientCertificatePassword string
	ClientCertificatePath     string
}

type clientCertAuth struct{}

var _ AuthMethod = &clientCertAuth{}

func (cred *clientCertAuth) Name() string {
	return "Client Certificate Auth"
}

func (cred *clientCertAuth) Construct(ctx context.Context, config *Config) (azcore.TokenCredential, error) {
	client := httpclient.New(ctx)

	clientCertificate, err := consolidateCertificate(config.ClientCertificate, config.ClientCertificatePath)
	if err != nil {
		// This should never happen; this is checked in the Validate function
		return nil, err
	}

	privateKey, certificate, err := pkcs12.Decode(
		clientCertificate,
		config.ClientCertificatePassword,
	)
	if err != nil {
		return nil, err
	}

	clientId, err := consolidateClientId(config)
	if err != nil {
		// This should never happen; this is checked in the Validate function
		return nil, err
	}

	return azidentity.NewClientCertificateCredential(
		config.TenantID,
		clientId,
		[]*x509.Certificate{certificate},
		privateKey,
		&azidentity.ClientCertificateCredentialOptions{
			ClientOptions: clientOptions(client, config.CloudConfig),
		},
	)
}

func (cred *clientCertAuth) Validate(_ context.Context, config *Config) tfdiags.Diagnostics {
	var diags tfdiags.Diagnostics
	if config.TenantID == "" {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure Client Certificate Auth",
			"Tenant ID is missing.",
		))
	}

	_, err := consolidateClientId(config)
	if err != nil {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure Client Certificate Auth",
			fmt.Sprintf("The Client ID is misconfigured: %s.", tfdiags.FormatError(err)),
		))
	}
	clientCertificate, err := consolidateCertificate(config.ClientCertificate, config.ClientCertificatePath)
	if err != nil {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure Client Certificate Auth",
			fmt.Sprintf("The Client Certificate is misconfigured: %s.", tfdiags.FormatError(err)),
		))
	} else {
		_, _, err := pkcs12.Decode(
			clientCertificate,
			config.ClientCertificatePassword,
		)
		if err != nil {
			diags = diags.Append(tfdiags.Sourceless(
				tfdiags.Error,
				"Invalid Azure Client Certificate Auth",
				fmt.Sprintf("The Client Certificate is invalid: %s.", tfdiags.FormatError(err)),
			))
		}
	}
	return diags
}

func (cred *clientCertAuth) AugmentConfig(_ context.Context, config *Config) error {
	return checkNamesForAccessKeyCredentials(config.StorageAddresses)
}

func consolidateCertificate(base64EncodedCertificate, certificateFilename string) ([]byte, error) {
	var certBytes []byte
	var fileBytes []byte

	if len(base64EncodedCertificate) > 0 {
		var err error
		certBytes, err = base64.StdEncoding.DecodeString(base64EncodedCertificate)
		if err != nil {
			return nil, fmt.Errorf("error decoding client certificate: %w", err)
		}
	}
	if len(certificateFilename) > 0 {
		var err error
		fileBytes, err = os.ReadFile(certificateFilename)
		if err != nil {
			return nil, fmt.Errorf("error reading client certificate file: %w", err)
		}
	}

	hasCert := len(certBytes) > 0
	hasFile := len(fileBytes) > 0

	if !hasCert && !hasFile {
		return nil, errors.New("missing certificate, client certificate is required")
	}

	if !hasCert {
		return fileBytes, nil
	}

	if !hasFile {
		return certBytes, nil
	}

	if !bytes.Equal(certBytes, fileBytes) {
		return nil, errors.New("client certificate provided directly and through file do not match; either make them the same value or only provide one")
	}
	return fileBytes, nil
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/auth/client_secret_auth.go`
```
// Copyright (c) The OpenTofu Authors
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2023 HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package auth

import (
	"context"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/opentofu/opentofu/internal/httpclient"
	"github.com/opentofu/opentofu/internal/tfdiags"
)

type ClientSecretCredentialAuthConfig struct {
	ClientID             string
	ClientIDFilePath     string
	ClientSecret         string
	ClientSecretFilePath string
}

type clientSecretCredentialAuth struct{}

var _ AuthMethod = &clientSecretCredentialAuth{}

func (cred *clientSecretCredentialAuth) Name() string {
	return "Client Secret Auth"
}

func (cred *clientSecretCredentialAuth) Construct(ctx context.Context, config *Config) (azcore.TokenCredential, error) {
	client := httpclient.New(ctx)
	clientId, err := consolidateClientId(config)
	if err != nil {
		// This should never happen; this is checked in the Validate function
		return nil, err
	}
	clientSecret, err := consolidateClientSecret(config)
	if err != nil {
		// This should never happen; this is checked in the Validate function
		return nil, err
	}

	return azidentity.NewClientSecretCredential(
		config.StorageAddresses.TenantID,
		clientId,
		clientSecret,
		&azidentity.ClientSecretCredentialOptions{
			ClientOptions: clientOptions(client, config.CloudConfig),
		},
	)
}

func (cred *clientSecretCredentialAuth) Validate(_ context.Context, config *Config) tfdiags.Diagnostics {
	var diags tfdiags.Diagnostics
	if config.StorageAddresses.TenantID == "" {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure Client Secret Auth",
			"Tenant ID is missing.",
		))
	}
	_, err := consolidateClientId(config)
	if err != nil {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure Client Secret Auth",
			fmt.Sprintf("The Client ID is misconfigured: %s.", tfdiags.FormatError(err)),
		))
	}
	_, err = consolidateClientSecret(config)
	if err != nil {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure Client Secret Auth",
			fmt.Sprintf("The Client Secret is misconfigured: %s.", tfdiags.FormatError(err)),
		))
	}
	return diags
}

func (cred *clientSecretCredentialAuth) AugmentConfig(_ context.Context, config *Config) error {
	return checkNamesForAccessKeyCredentials(config.StorageAddresses)
}

func consolidateClientId(config *Config) (string, error) {
	return consolidateFileAndValue(config.ClientID, config.ClientIDFilePath, "client ID", false)
}

func consolidateClientSecret(config *Config) (string, error) {
	return consolidateFileAndValue(config.ClientSecret, config.ClientSecretFilePath, "client secret", false)
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/auth/clients.go`
```
// Copyright (c) The OpenTofu Authors
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2023 HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/arm"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/cloud"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/resources/armresources"
	"github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/storage/armstorage"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
	"github.com/opentofu/opentofu/internal/httpclient"
	"github.com/opentofu/opentofu/internal/tfdiags"
)

func clientOptions(client *http.Client, cloudConfig cloud.Configuration) policy.ClientOptions {
	return policy.ClientOptions{
		Telemetry: policy.TelemetryOptions{
			Disabled: true,
		},
		Transport: client,
		Cloud:     cloudConfig,
	}
}

// NewResourceClient gets a client for resource groups. This is strictly only used in testing.
func NewResourceClient(client *http.Client, authCred azcore.TokenCredential, subscriptionID string) (*armresources.ResourceGroupsClient, error) {
	resourceClient, err := armresources.NewResourceGroupsClient(subscriptionID, authCred, &arm.ClientOptions{
		ClientOptions:         clientOptions(client, cloud.AzurePublic),
		DisableRPRegistration: false,
	})
	if err != nil {
		return nil, fmt.Errorf("error getting resource client: %w", err)
	}
	return resourceClient, nil
}

// NewStorageAccountsClient gets a client for the storage account with the given auth credentials.
// This should only be used for testing and internally within this package.
func NewStorageAccountsClient(client *http.Client, authCred azcore.TokenCredential, cloudConfig cloud.Configuration, subscriptionID string) (*armstorage.AccountsClient, error) {
	storageClient, err := armstorage.NewAccountsClient(subscriptionID, authCred, &arm.ClientOptions{
		ClientOptions:         clientOptions(client, cloudConfig),
		DisableRPRegistration: false,
	})
	if err != nil {
		return nil, fmt.Errorf("error getting storage client: %w", err)
	}
	return storageClient, nil
}

type StorageAddresses struct {
	CloudConfig      cloud.Configuration
	ResourceGroup    string
	StorageAccount   string
	StorageContainer string
	StorageSuffix    string
	SubscriptionID   string
	TenantID         string
}

// NewContainerClientWithSharedKeyCredential gets a container client authenticated with
// a shared Storage Account Access Key, using previously obtained authentication credentials to
// obtain said key from the Storage Account.
func NewContainerClientWithSharedKeyCredential(ctx context.Context, names StorageAddresses, authCred azcore.TokenCredential) (*container.Client, error) {
	containerClient, _, err := NewContainerClientWithSharedKeyCredentialAndKey(ctx, names, authCred)
	return containerClient, err
}

func checkNamesForAccessKeyCredentials(names StorageAddresses) error {
	var diags tfdiags.Diagnostics
	if names.ResourceGroup == "" {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Resource Group is empty",
			"In order to obtain a Storage Account Access Key, a resource group is necessary",
		))
	}
	if names.StorageAccount == "" {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Storage Account is empty",
			"In order to obtain a Storage Account Access Key, a storage account name is necessary",
		))
	}
	if names.SubscriptionID == "" {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Subscription ID is empty",
			"In order to obtain a Storage Account Access Key, a subscription id is necessary",
		))
	}
	return diags.Err()
}

// NewContainerClientWithSharedKeyCredentialAndKey gets a container client and shared key
// that it's authenticated with. This function should only be used for testing and internally within this package.
func NewContainerClientWithSharedKeyCredentialAndKey(ctx context.Context, names StorageAddresses, authCred azcore.TokenCredential) (*container.Client, string, error) {
	client := httpclient.New(ctx)
	// Lookup the key with an account client
	accountsClient, err := NewStorageAccountsClient(client, authCred, names.CloudConfig, names.SubscriptionID)
	if err != nil {
		return nil, "", err
	}
	keys, err := accountsClient.ListKeys(ctx, names.ResourceGroup, names.StorageAccount, nil)
	if err != nil {
		return nil, "", fmt.Errorf("error listing access keys on the storage account: %w", err)
	}
	if len(keys.Keys) == 0 || keys.Keys[0] == nil || keys.Keys[0].Value == nil {
		return nil, "", errors.New("malformed structure returned from the ListKeys function")
	}

	storageAccessKey := *keys.Keys[0].Value

	return newContainerClientFromStorageAccessKey(client, names, storageAccessKey)
}

const STORAGE cloud.ServiceName = "storage"

func CloudConfigFromAddresses(ctx context.Context, environment, metadataHost string) (cloud.Configuration, string, error) {
	if metadataHost != "" {
		config, err := CloudConfigFromMetadataHost(ctx, metadataHost)
		return config, config.Services[STORAGE].Endpoint, err
	}

	// These environments come from the hamilton Azure library, which was the predecessor to this implementation
	// https://github.com/manicminer/hamilton/blob/v0.44.0/environments/environments.go#L103-L118

	// Note: if these URLs ever change, double-check them against the way we select audiences in OIDC auth:
	// oidc_auth.go:requestURLAudience
	switch environment {
	case "", "public", "global", "canary":
		return cloud.AzurePublic, "core.windows.net", nil
	case "usgovernment", "usgovernmentl4", "dod", "usgovernmentl5":
		return cloud.AzureGovernment, "core.usgovcloudapi.net", nil
	case "china":
		return cloud.AzureChina, "core.chinacloudapi.cn", nil
	}
	return cloud.Configuration{}, "", fmt.Errorf("unknown environment identifier: %s", environment)
}

type Authentication struct {
	LoginEndpoint string   `json:"loginEndpoint"`
	Audiences     []string `json:"audiences"`
}

type Environment struct {
	Authentication  Authentication    `json:"authentication"`
	ResourceManager string            `json:"resourceManager"`
	Suffixes        map[string]string `json:"suffixes"`
}

func CloudConfigFromMetadataHost(ctx context.Context, metadataHost string) (cloud.Configuration, error) {
	// Obtaining cloud config from the metadata host
	client := httpclient.New(ctx)

	// If you change the API version here, verify the JSON response format is accurate to that version
	// You can check with this URL:
	// https://management.azure.com/metadata/endpoints?api-version=2023-11-01
	resp, err := client.Get(fmt.Sprintf("https://%s/metadata/endpoints?api-version=2023-11-01", metadataHost))
	if err != nil {
		return cloud.Configuration{}, fmt.Errorf("retrieving environments from Azure MetaData service: %w", err)
	}
	defer resp.Body.Close()

	var environment Environment
	if err := json.NewDecoder(resp.Body).Decode(&environment); err != nil {
		return cloud.Configuration{}, fmt.Errorf("decoding json in metadata response: %w", err)
	}

	storageSuffix, ok := environment.Suffixes["storage"]
	if !ok {
		return cloud.Configuration{}, errors.New("could not find storage endpoint in given metadata host")
	}
	if len(environment.Authentication.Audiences) == 0 {
		return cloud.Configuration{}, errors.New("could not find token audience in given metadata host")
	}
	audience := environment.Authentication.Audiences[0]

	return cloud.Configuration{
		ActiveDirectoryAuthorityHost: environment.Authentication.LoginEndpoint,
		Services: map[cloud.ServiceName]cloud.ServiceConfiguration{
			cloud.ResourceManager: {
				Endpoint: environment.ResourceManager,
				Audience: audience,
			},
			STORAGE: {
				Endpoint: storageSuffix,
				Audience: audience,
			},
		},
	}, nil
}

// NewContainerClientFromStorageAccessKey gets a container client authenticated with
// the provided Storage Account Access Key.
func NewContainerClientFromStorageAccessKey(ctx context.Context, names StorageAddresses, storageAccessKey string) (*container.Client, error) {
	client := httpclient.New(ctx)
	containerClient, _, err := newContainerClientFromStorageAccessKey(client, names, storageAccessKey)
	return containerClient, err
}

// containerURL must only be called once it is verified that the StorageAccount and StorageContainer
// names are valid in Azure.
func containerURL(names StorageAddresses) string {
	return fmt.Sprintf("https://%s.blob.%s/%s", names.StorageAccount, names.StorageSuffix, names.StorageContainer)
}

func newContainerClientFromStorageAccessKey(client *http.Client, names StorageAddresses, storageAccessKey string) (*container.Client, string, error) {
	sharedKeyCredential, err := container.NewSharedKeyCredential(names.StorageAccount, storageAccessKey)
	if err != nil {
		return nil, "", fmt.Errorf("error creating credential from shared access key: %w", err)
	}
	containerURL := containerURL(names)

	containerClient, err := container.NewClientWithSharedKeyCredential(containerURL, sharedKeyCredential, &container.ClientOptions{
		ClientOptions: clientOptions(client, names.CloudConfig),
	})
	if err != nil {
		return nil, "", fmt.Errorf("error obtaining container client from access key: %w", err)
	}
	return containerClient, storageAccessKey, nil
}

// NewContainerClientFromSAS gets a client authenticated with a Shared Access Signature
func NewContainerClientFromSAS(ctx context.Context, names StorageAddresses, sasToken string) (*container.Client, error) {
	client := httpclient.New(ctx)
	url := containerURL(names)

	containerURL := fmt.Sprintf("%s?%s", url, sasToken)

	return container.NewClientWithNoCredential(containerURL, &container.ClientOptions{
		ClientOptions: clientOptions(client, names.CloudConfig),
	})
}

// NewContainerClient gets a client authenticated with the given auth credentials.
func NewContainerClient(ctx context.Context, names StorageAddresses, authCred azcore.TokenCredential) (*container.Client,
```

### Core Architecture Module: `internal/backend/remote-state/azure/auth/msi_auth.go`
```
// Copyright (c) The OpenTofu Authors
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2023 HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package auth

import (
	"context"
	"os"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/opentofu/opentofu/internal/httpclient"
	"github.com/opentofu/opentofu/internal/tfdiags"
)

type MSIAuthConfig struct {
	UseMsi   bool
	Endpoint string
}

type managedIdentityAuth struct{}

var _ AuthMethod = &managedIdentityAuth{}

func (cred *managedIdentityAuth) Name() string {
	return "Managed Service Identity Auth"
}

// msiTokenCredentialWrapper wraps the ManagedIdentityCredential with a bit of logic
// to manage the MSI_ENDPOINT environment variable. See the reconcileMSIEndpoint documentation
// for details.
type msiTokenCredentialWrapper struct {
	cred *azidentity.ManagedIdentityCredential

	Endpoint string
}

func (cred *managedIdentityAuth) Construct(ctx context.Context, config *Config) (azcore.TokenCredential, error) {
	client := httpclient.New(ctx)
	var id azidentity.ManagedIDKind
	if config.ClientID != "" {
		id = azidentity.ClientID(config.ClientID)
	}
	c, err := azidentity.NewManagedIdentityCredential(
		&azidentity.ManagedIdentityCredentialOptions{
			ClientOptions: clientOptions(client, config.CloudConfig),
			ID:            id,
		},
	)
	endpoint := reconcileMSIEndpoint(config.Endpoint)
	if endpoint != "" {
		return &msiTokenCredentialWrapper{
			cred:     c,
			Endpoint: endpoint,
		}, err
	}
	return c, err
}

const MSI_ENDPOINT string = "MSI_ENDPOINT"

func (credWrapper *msiTokenCredentialWrapper) GetToken(ctx context.Context, options policy.TokenRequestOptions) (token azcore.AccessToken, err error) {
	os.Setenv(MSI_ENDPOINT, credWrapper.Endpoint)
	token, err = credWrapper.cred.GetToken(ctx, options)
	os.Unsetenv(MSI_ENDPOINT)
	return
}

// reconcileMSIEndpoint helps to set MSI_ENDPOINT, if it has not already set.
// This is a bit of a hack, but we do this to ensure backwards compatibility.
// The microsoft-authentication-library-for-go uses the MSI_ENDPOINT environment variable
// to automatically set the endpoint, in the case OpenTofu is running in
// Cloud Shell or AzureML. There isn't another way to get the endpoint information
// to the library...
func reconcileMSIEndpoint(msiEndpointFromConfig string) string {
	_, ok := os.LookupEnv(MSI_ENDPOINT)
	if ok {
		return ""
	}
	return msiEndpointFromConfig
}

func (cred *managedIdentityAuth) Validate(_ context.Context, config *Config) tfdiags.Diagnostics {
	var diags tfdiags.Diagnostics
	if !config.MSIAuthConfig.UseMsi {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure Managed Service Identity Auth",
			"The Managed Service Identity (MSI) needs to have \"use_msi\" (or ARM_USE_MSI) set to true in order to be used.",
		))
	}
	return diags
}

func (cred *managedIdentityAuth) AugmentConfig(_ context.Context, config *Config) error {
	return checkNamesForAccessKeyCredentials(config.StorageAddresses)
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/auth/oidc_auth.go`
```
// Copyright (c) The OpenTofu Authors
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2023 HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/cloud"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/opentofu/opentofu/internal/httpclient"
	"github.com/opentofu/opentofu/internal/tfdiags"
)

type OIDCAuthConfig struct {
	UseOIDC           bool
	OIDCToken         string
	OIDCTokenFilePath string
	OIDCRequestURL    string
	OIDCRequestToken  string
}

type oidcAuth struct{}

var _ AuthMethod = &oidcAuth{}

func (cred *oidcAuth) Name() string {
	return "OpenID Connect Auth"
}

func (cred *oidcAuth) Construct(ctx context.Context, config *Config) (azcore.TokenCredential, error) {
	clientId, err := consolidateClientId(config)
	if err != nil {
		return nil, err
	}

	return azidentity.NewClientAssertionCredential(
		config.TenantID,
		clientId,
		// The azure sdk calls this callback whenever it needs client assertion
		//
		// Previously, the OIDC token was fetched once and returned statically,
		// which caused failures when using short-lived tokens in azure devops
		// pipelines during long-running operations.
		//
		// By resolving the token dynamically here, we allow the sdk to obtain
		// a fresh OIDC token as needed, enabling proper token refresh behavior.
		func(ctx context.Context) (string, error) {
			client := httpclient.New(ctx)

			if config.OIDCToken == "" && config.OIDCTokenFilePath == "" {
				return getTokenFromRemote(client, config.OIDCAuthConfig, config.CloudConfig)
			}
			return consolidateToken(config)
		},
		&azidentity.ClientAssertionCredentialOptions{
			ClientOptions: clientOptions(httpclient.New(ctx), config.CloudConfig),
		},
	)
}

type TokenResponse struct {
	Value string `json:"value"`
}

func getTokenFromRemote(client *http.Client, config OIDCAuthConfig, env cloud.Configuration) (string, error) {
	// GET from the request URL, using the bearer token
	req, err := http.NewRequest(http.MethodGet, config.OIDCRequestURL, nil)
	if err != nil {
		return "", fmt.Errorf("malformed token request: %w", err)
	}
	req.Header.Add("Authorization", "Bearer "+config.OIDCRequestToken)
	req.Header.Add("Accept", "application/json; api-version=2.0")
	req.Header.Add("Content-Type", "application/json")

	if !req.URL.Query().Has("audience") {
		query := req.URL.Query()
		query.Set("audience", requestURLAudience(env))
		req.URL.RawQuery = query.Encode()
	}

	// Read the response
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("error obtaining token: %w", err)
	}
	defer resp.Body.Close()
	rawToken, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("io error reading token response body: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("non-2xx response: status code %d, body: %s", resp.StatusCode, rawToken)
	}
	var token TokenResponse
	// Provide that response as the access token.
	err = json.Unmarshal(rawToken, &token)
	if err != nil {
		return "", fmt.Errorf("error parsing json of token response body: %w", err)
	}
	return token.Value, nil
}

// requestURLAudience ensures the audience is configured appropriately for
// its target cloud authority
//
// Reference:
// https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation-config-app-trust-managed-identity
func requestURLAudience(env cloud.Configuration) string {
	// Note: if these URLs ever change, double-check them against the way we obtain cloud configurations:
	// clients.go:CloudConfigFromAddresses
	switch env.ActiveDirectoryAuthorityHost {
	case cloud.AzureChina.ActiveDirectoryAuthorityHost:
		return "api://AzureADTokenExchangeChina"
	case cloud.AzureGovernment.ActiveDirectoryAuthorityHost:
		return "api://AzureADTokenExchangeUSGov"
	default:
		return "api://AzureADTokenExchange"
	}
}

func consolidateToken(config *Config) (string, error) {
	return consolidateFileAndValue(config.OIDCToken, config.OIDCTokenFilePath, "token", true)
}

func (cred *oidcAuth) Validate(ctx context.Context, config *Config) tfdiags.Diagnostics {
	var diags tfdiags.Diagnostics
	if !config.UseOIDC {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure OpenID Connect Auth",
			"OpenID Connect Auth is disabled when use_oidc or the environment variable ARM_USE_OIDC are unset or set explicitly to false.",
		))
		return diags
	}
	if config.TenantID == "" {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure OpenID Connect Auth",
			"Tenant ID is missing.",
		))
	}
	_, err := consolidateClientId(config)
	if err != nil {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure OpenID Connect Auth",
			fmt.Sprintf("The Client ID is misconfigured: %s.", tfdiags.FormatError(err)),
		))
	}
	directTokenUnset := config.OIDCToken == "" && config.OIDCTokenFilePath == ""
	indirectTokenUnset := config.OIDCRequestURL == "" || config.OIDCRequestToken == ""
	if directTokenUnset && indirectTokenUnset {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure OpenID Connect Auth",
			"An access token must be provided, either directly with a variable or through a file, or indirectly through a request URL and request token (as in GitHub Actions).",
		))
	}
	if directTokenUnset {
		// check request URL and token
		_, err := getTokenFromRemote(httpclient.New(ctx), config.OIDCAuthConfig, config.CloudConfig)
		if err != nil {
			diags = diags.Append(tfdiags.Sourceless(
				tfdiags.Error,
				"Invalid Azure OpenID Connect Auth",
				fmt.Sprintf("Tried to test fetching the token, but received this error instead: %s.", tfdiags.FormatError(err)),
			))
		}
	}
	// This will work, even if both token and file path are empty
	if _, err := consolidateToken(config); err != nil {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid Azure OpenID Connect Auth",
			fmt.Sprintf("The token is misconfigured: %s", err.Error()),
		))
	}
	return diags
}

func (cred *oidcAuth) AugmentConfig(_ context.Context, config *Config) error {
	return checkNamesForAccessKeyCredentials(config.StorageAddresses)
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/auth/utility.go`
```
// Copyright (c) The OpenTofu Authors
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2023 HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package auth

import (
	"fmt"
	"os"
)

// consolidateFileAndValue takes the (potentially empty) values of a directly-set configuration string and
// the string value of a plaintext file and picks the one that's nonempty. If both are set and nonempty,
// it checks that they share an identical value and returns that value. If they're both empty, it returns
// an error unless acceptEmpty is true.
func consolidateFileAndValue(value, fileName, fieldName string, acceptEmpty bool) (string, error) {
	var fileValue string
	if fileName != "" {
		b, err := os.ReadFile(fileName)
		if err != nil {
			return "", fmt.Errorf("error reading %s file: %w", fieldName, err)
		}
		fileValue = string(b)
	}

	hasValue := value != ""
	hasFile := fileValue != ""

	if !hasValue && !hasFile {
		if acceptEmpty {
			return "", nil
		}
		return "", fmt.Errorf("missing %s, a %s is required", fieldName, fieldName)
	}

	if !hasValue {
		return fileValue, nil
	}

	if !hasFile {
		return value, nil
	}

	if value != fileValue {
		return "", fmt.Errorf("%s provided directly and through file do not match; either make them the same value or only provide one", fieldName)
	}
	return fileValue, nil
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/auth/workload_identity_auth.go`
```
// Copyright (c) The OpenTofu Authors
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2023 HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package auth

import (
	"context"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/opentofu/opentofu/internal/httpclient"
	"github.com/opentofu/opentofu/internal/tfdiags"
)

type WorkloadIdentityAuthConfig struct {
	UseAKSWorkloadIdentity bool
}

type workloadIdentityAuth struct{}

var _ AuthMethod = &workloadIdentityAuth{}

func (cred *workloadIdentityAuth) Name() string {
	return "AKS Workload Identity Auth"
}

func (cred *workloadIdentityAuth) Construct(ctx context.Context, config *Config) (azcore.TokenCredential, error) {
	client := httpclient.New(ctx)
	return azidentity.NewWorkloadIdentityCredential(
		&azidentity.WorkloadIdentityCredentialOptions{
			ClientOptions: clientOptions(client, config.CloudConfig),
		},
	)
}

func (cred *workloadIdentityAuth) Validate(_ context.Context, config *Config) tfdiags.Diagnostics {
	var diags tfdiags.Diagnostics
	if !config.UseAKSWorkloadIdentity {
		diags = diags.Append(tfdiags.Sourceless(
			tfdiags.Error,
			"Invalid AKS Workload Identity Auth",
			"The AKS Workload Identity Auth needs to have \"use_aks_workload_identity\" (or ARM_USE_AKS_WORKLOAD_IDENTITY) set to true in order to be used.",
		))
	}
	return diags
}

func (cred *workloadIdentityAuth) AugmentConfig(_ context.Context, config *Config) error {
	return checkNamesForAccessKeyCredentials(config.StorageAddresses)
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/backend.go`
```
// Copyright (c) The OpenTofu Authors
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2023 HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package azure

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/opentofu/opentofu/internal/backend"
	"github.com/opentofu/opentofu/internal/backend/remote-state/azure/auth"
	"github.com/opentofu/opentofu/internal/encryption"
	"github.com/opentofu/opentofu/internal/legacy/helper/schema"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
)

const defaultTimeout = 300 // 5 minutes

// New creates a new backend for Azure remote state.
func New(enc encryption.StateEncryption) backend.Backend {
	s := &schema.Backend{
		Schema: map[string]*schema.Schema{
			"storage_account_name": {
				Type:        schema.TypeString,
				Required:    true,
				Description: "The name of the storage account.",
			},

			"container_name": {
				Type:        schema.TypeString,
				Required:    true,
				Description: "The container name.",
			},

			"key": {
				Type:        schema.TypeString,
				Required:    true,
				Description: "The blob key.",
			},

			"metadata_host": {
				Type:          schema.TypeString,
				Optional:      true,
				Description:   "The Metadata URL which will be used to obtain the Cloud Environment.",
				DefaultFunc:   schema.EnvDefaultFunc("ARM_METADATA_HOST", nil),
				ConflictsWith: []string{"environment"},
			},

			"environment": {
				Type:          schema.TypeString,
				Optional:      true,
				Description:   "The Azure cloud environment.",
				DefaultFunc:   schema.EnvDefaultFunc("ARM_ENVIRONMENT", nil),
				ConflictsWith: []string{"metadata_host"},
			},

			"access_key": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The access key.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_ACCESS_KEY", ""),
			},

			"sas_token": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "A SAS Token used to interact with the Blob Storage Account.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_SAS_TOKEN", ""),
			},

			"snapshot": {
				Type:        schema.TypeBool,
				Optional:    true,
				Description: "Enable/Disable automatic blob snapshotting",
				DefaultFunc: schema.EnvDefaultFunc("ARM_SNAPSHOT", false),
			},

			"resource_group_name": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The resource group name.",
			},

			"client_id": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The Client ID.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_CLIENT_ID", ""),
			},

			"client_id_file_path": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The path to a file containing the Client ID.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_CLIENT_ID_FILE_PATH", ""),
			},

			"endpoint": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "A custom Endpoint used to access the Azure Resource Manager API's.",
				Deprecated:  "This variable is unused and does not affect any execution. Please use environment or metadata host instead.",
			},

			"timeout_seconds": {
				Type:        schema.TypeInt,
				Optional:    true,
				Description: "The timeout in seconds for initializing a client or retrieving a Blob or a Metadata from Azure.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_TIMEOUT_SECONDS", defaultTimeout),
				ValidateFunc: func(v any, _ string) ([]string, []error) {
					value, ok := v.(int)
					if !ok || value < 0 {
						return nil, []error{fmt.Errorf("timeout_seconds expected to be a non-negative integer")}
					}
					return nil, nil
				},
			},

			"subscription_id": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The Subscription ID.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_SUBSCRIPTION_ID", ""),
			},

			"tenant_id": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The Tenant ID.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_TENANT_ID", ""),
			},

			// Service Principal (Client Certificate) specific

			"client_certificate": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "A Base64-encoded PKCS#12 (PFX, not PEM) certificate used as the Client Certificate when authenticating as a Service Principal. The file must encode both the public certificate and its private key.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_CLIENT_CERTIFICATE", ""),
			},

			"client_certificate_password": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The password associated with the Client Certificate specified in `client_certificate_path`",
				DefaultFunc: schema.EnvDefaultFunc("ARM_CLIENT_CERTIFICATE_PASSWORD", ""),
			},

			"client_certificate_path": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The path to the PKCS#12 PFX file used as the Client Certificate when authenticating as a Service Principal. The file must encode both the public certificate and its private key.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_CLIENT_CERTIFICATE_PATH", ""),
			},

			// Service Principal (Client Secret) specific
			"client_secret": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The Client Secret.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_CLIENT_SECRET", ""),
			},

			"client_secret_file_path": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The path to a file containing the Client Secret.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_CLIENT_SECRET_FILE_PATH", ""),
			},

			// Managed Service Identity specific
			"use_msi": {
				Type:        schema.TypeBool,
				Optional:    true,
				Description: "Should Managed Service Identity be used?",
				DefaultFunc: schema.EnvDefaultFunc("ARM_USE_MSI", false),
			},
			"msi_endpoint": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The Managed Service Identity Endpoint.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_MSI_ENDPOINT", nil),
				Deprecated:  "This configuration is now managed in a dependent library, not directly by OpenTofu. Please use the `MSI_ENDPOINT` environment variable to set the Managed Service Identity endpoint.",
			},

			// OIDC auth specific fields
			"use_oidc": {
				Type:        schema.TypeBool,
				Optional:    true,
				DefaultFunc: schema.EnvDefaultFunc("ARM_USE_OIDC", false),
				Description: "Allow OIDC to be used for authentication",
			},
			"oidc_token": {
				Type:        schema.TypeString,
				Optional:    true,
				DefaultFunc: schema.EnvDefaultFunc("ARM_OIDC_TOKEN", ""),
				Description: "A generic JWT token that can be used for OIDC authentication. Should not be used in conjunction with `oidc_request_token`.",
			},
			"oidc_token_file_path": {
				Type:        schema.TypeString,
				Optional:    true,
				DefaultFunc: schema.MultiEnvDefaultFunc([]string{"ARM_OIDC_TOKEN_FILE_PATH", "AZURE_FEDERATED_TOKEN_FILE"}, ""),
				Description: "Path to file containing a generic JWT token that can be used for OIDC authentication. Should not be used in conjunction with `oidc_request_token`.",
			},
			"oidc_request_url": {
				Type:        schema.TypeString,
				Optional:    true,
				DefaultFunc: schema.MultiEnvDefaultFunc([]string{"ARM_OIDC_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_URL", "SYSTEM_OIDCREQUESTURI"}, ""),
				Description: "The URL of the OIDC provider from which to request an ID token. Needs to be used in conjunction with `oidc_request_token`. This is meant to be used for Github Actions.",
			},
			"oidc_request_token": {
				Type:        schema.TypeString,
				Optional:    true,
				DefaultFunc: schema.MultiEnvDefaultFunc([]string{"ARM_OIDC_REQUEST_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN", "SYSTEM_ACCESSTOKEN"}, ""),
				Description: "The bearer token to use for the request to the OIDC providers `oidc_request_url` URL to fetch an ID token. Needs to be used in conjunction with `oidc_request_url`. This is meant to be used for Github Actions.",
			},

			// Azure DevOps / Pipelines specific field
			// shares all other configuration with the generic OIDC auth method.
			"ado_service_connection_id": {
				Type:        schema.TypeString,
				Optional:    true,
				DefaultFunc: schema.MultiEnvDefaultFunc([]string{"ARM_ADO_PIPELINE_SERVICE_CONNECTION_ID", "ARM_OIDC_AZURE_SERVICE_CONNECTION_ID", "AZURESUBSCRIPTION_SERVICE_CONNECTION_ID"}, ""),
				Description: "The Azure DevOps Service Connection ID to use when authenticating with Azure DevOps. This is meant to be used in Azure DevOps pipelines.",
			},

			"use_aks_workload_identity": {
				Type:        schema.TypeBool,
				Optional:    true,
				DefaultFunc: schema.EnvDefaultFunc("ARM_USE_AKS_WORKLOAD_IDENTITY", false),
				Description: "Set to true to if you want to use Azure's AKS Workload Identity to authenticate to Azure. Defaults to false.",
			},

			// Feature Flags
			"use_azuread_auth": {
				Type:        schema.TypeBool,
				Optional:    true,
				Description: "Should OpenTofu use AzureAD Authentication to access the Blob?",
				DefaultFunc: schema.EnvDefaultFunc("ARM_USE_AZUREAD", false),
			},

			"use_cli": {
				Type:        schema.TypeBool,
				Optional:    true,
				Description: "Set to true if you want to use the Azure CLI to authenticate to Azure. Defaults to true.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_USE_CLI", true),
			},

			"customer_provided_key": {
				Type:        schema.TypeString,
				Optional:    true,
				Sensitive:   true,
				Description: "Base64 encoded AES-256 key for Customer Provided encryption.",
				DefaultFunc: schema.EnvDefaultFunc("ARM_CUSTOMER_PROVIDED_KEY", nil),
				ValidateFunc: func(v any, _ string) ([]string, []error) {
					_, err := newCPKInfo(v.(string))
					if err != nil {
						return nil, []error{err}
					}
					return nil, nil
				},
				ConflictsWith: []string{"encryption_scope"},

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4622** (2026-10-01): **tofu show -json fails on a saved plan holding an ephemeral resource in 1.13.0 ("no schema found for ephemeral.…")**
  *Symptoms*: ### OpenTofu Version  ``` OpenTofu v1.13.0 on darwin_arm64 ```  Also seen on linux_amd64 (GitHub Actions `ubuntu-latest`, installed by `opentofu/setup-opentofu@v1` with its default `latest`).  ### OpenTofu Configuration Files  ```hcl terraform {   required_providers {     random = { source = "hashicorp/random", version = "~> 3.7" }   } }  ephemeral "random_password" "db" {   length = 16 }  resource "terraform_data" "x" {   input = "y" } ```  Provider selected: `registry.opentofu.org/hashicorp/random` v3.9.1.  ### Debug Output  Available on request (`TF_LOG=trace`); the failure is deterministic with the configuration above.  ### Expected Behavior  `tofu show -json plan.bin` prints the plan as JSON, as OpenTofu 1.12.6 and 1.11.14 do for the same configuration and the same provider version.  ### Actual Behavior  ``` $ tofu show -json plan.bin Failed to marshal plan to json: error marshaling config: no schema found for ephemeral.random_password.db (in provider registry.opentofu.org/hashicorp/random) $ echo $? 1 ```  `tofu plan -out=plan.bin` succeeds, and the human-readable `tofu show plan.bin` succeeds. Without the `ephemeral` block, 1.13.0 renders the plan as JSON normally.  ### Steps to Reproduce  1. Save the configuration above as `main.tf` in an empty directory. 2. `tofu init` 3. `tofu plan -out=plan.bin` 4. `tofu show -json plan.bin`  | CLI | `plan` | `show -json plan.bin` | |---|---|---| | 1.11.14 | ok | ok | | 1.12.6 | ok | ok | | 1.13.0 | ok | **fails** (error above) |  
  **Post-Mortem & Fix Analysis**:
  > We hit the same bug with a custom provider and traced it to a single commit.  ## Bisect result  | Version | `tofu show -json plan.bin` | |---|---| | 1.12.6 | OK | | 1.13.0-beta1 | **FAIL** | | 1.13.0-rc1 | FAIL | | 1.13.0 | FAIL |  The regression was introduced in **f93cb1a4** (#4490 — "Store trimmed provider schemas in the planfile so tofu show skips relaunching providers where possible"), merged 2026-08-21, first shipped in 1.13.0-beta1.  ## Root cause  PR #4490 embeds trimmed provider schemas into the planfile so `tofu show` can skip launching providers. However, ephemeral resource schemas are excluded at three points in the new code:  **1. `internal/plans/planfile/schema_trim.go` — ephemeral types are never tracked**  The `referencedTypes` struct only has `managed` and `data` maps. The comment is explicit:  ```go // We dont need ephemeral as they dont get stored in the config type referencedTypes struct {     managed map[string]struct{}     data    map[string]struct{} } ```  And `a
  > Thanks a lot for reporting this.  Just tested it and it can be reproduced easily. Accepted this as per our [Fast Path policy](https://github.com/opentofu/opentofu/blob/main/BUG_REPORTS.md#the-fast-path).  Will be back once I have more information.
  > Submitted #4623 to fix this.  As also stated in the [`tofu show -json` docs](https://opentofu.org/docs/cli/commands/show/#json-output), the machine-readable output includes also the configuration that the plan was built on. During the initial implementation, we missed this detail, therefore no ephemeral schema was included in the plan, introducing the reported regression.  Even though, the usefulness of the ephemeral resources inclusion in this configuration snapshot could be debatable, due to having this already included prior to v1.13.x, to keep it backwards compatibile, the fix above includes ephemeral schemas too, allowing the configuration snapshot to be rendered correctly.

- **Issue #4598** (2026-09-25): **Ephemeral values are diverged when passing through `output` on different module**
  *Symptoms*: ### Community note  > [!TIP] > 👋 Hi there, OpenTofu community! The OpenTofu team prioritizes issues based on upvotes. Please make sure to upvote this issue and describe how it affects you in detail in the comments to show your support.   ### OpenTofu Version  ```shell OpenTofu v1.12.6 on linux_amd64 + provider registry.opentofu.org/hashicorp/aws v6.64.0 + provider registry.opentofu.org/hashicorp/null v3.3.2 ```  ### OpenTofu Configuration Files  > main.tf ```hcl terraform {   required_providers {     aws = {       source  = "hashicorp/aws"       version = "6.64.0"     }     null = {       source  = "hashicorp/null"       version = "3.3.2"     }   }   required_version = ">= 1.0" }  provider "aws" {   region  = "eu-central-1"   profile = "test" }  module "child" {   source = "./child" }  resource "aws_secretsmanager_secret" "root" {   name                    = "tests/root"   recovery_window_in_days = 0 }  resource "aws_secretsmanager_secret_version" "root" {   secret_id = aws_secretsmanager_secret.root.id    # the ephemeral value exported by the child is actually different   secret_string_wo         = module.child.secret   secret_string_wo_version = 1 }  ephemeral "aws_secretsmanager_secret_version" "child_readback" {   secret_id  = "tests/child"   depends_on = [module.child] }  ephemeral "aws_secretsmanager_secret_version" "root_readback" {   secret_id  = aws_secretsmanager_secret.root.id   depends_on = [aws_secretsmanager_secret_version.root] }  resource "null_resource" "com
  **Post-Mortem & Fix Analysis**:
  > Hi @MGSousa,  Thanks for the report!  I checked this today and I can confirm that I can reproduce it. This is indeed due to how changes are propagated through the evaluation system.  When `tofu apply` is executed without a plan file generated previously, it runs the plan phase and the state that is generated by the plan walk is passed over to the apply phase. Therefore, because the output of the `child` module had it's `value` expression evaluated, the temporary state contains it which skips the evaluation during the apply phase.  But if you run `tofu apply planfile`, this works as expected because the ephemeral values are not saved into the planfile, meaning that the state generated from the planfile lacks the information needed to fully evaluate the `child` module output. Therefore, not having the change, it will evaluate the output `value` expression which will pick up the latest ephemeral value generated.  This is definitely a bug and I will accept this following [the fast path](ht

- **Issue #4548** (2026-09-02): **registry.opentofu.org prompting for github username/password**
  *Symptoms*: ### Community note  > [!TIP] > 👋 Hi there, OpenTofu community! The OpenTofu team prioritizes issues based on upvotes. Please make sure to upvote this issue and describe how it affects you in detail in the comments to show your support.   ### OpenTofu Version  ```shell ➜ tofu version OpenTofu v1.12.5 on linux_amd64 + provider registry.opentofu.org/alekc/kubectl v2.4.1 + provider registry.opentofu.org/hashicorp/google v7.18.0 + provider registry.opentofu.org/hashicorp/google-beta v7.18.0 + provider registry.opentofu.org/hashicorp/helm v2.17.0 + provider registry.opentofu.org/hashicorp/kubernetes v2.38.0 + provider registry.opentofu.org/hashicorp/local v2.9.0 + provider registry.opentofu.org/hashicorp/null v3.3.1 + provider registry.opentofu.org/hashicorp/random v3.6.3 + provider registry.opentofu.org/hashicorp/time v0.13.1 + provider registry.opentofu.org/loafoe/htpasswd v2.1.0 ```  ### OpenTofu Configuration Files  n/a   ### Debug Output  https://gist.github.com/serpro69/199e1f0b180208159b1a2622c58db586  ### Expected Behavior  It should download and install all the modules w/o auth since none of them are private  ### Actual Behavior  User is prompted for github username/password for all modules  ### Steps to Reproduce  1. `tofu init`  ### Additional Context  I did init just 5 minutes ago and things went fine, now I'm being prompted for github username/password for nearly every (or every? I can't really tell) module in my configuration. My configuration is google-related modul
  **Post-Mortem & Fix Analysis**:
  > So I tested the same in CI and it runs fine via atlantis. The tofu version we have there is 1.12.1 (as opposed to my local 1.12.5). I can try to run 1.12.5 in CI as well, but I doubt the version is the problem. It's likely something on my machine? (But I can't for the life of me understand what it could be or why it stopped working out of the blue.)
  > Hi @serpro69,  All modules in the main OpenTofu Registry are really just GitHub repositories, and so OpenTofu asks the registry where to find the source code for e.g. `registry.opentofu.org/GoogleCloudPlatform/pam/google` and the registry returns a [`git::` source address](https://opentofu.org/docs/language/modules/sources/#generic-git-repository) referring to that repository. OpenTofu then runs `git clone` on that repository to get its source code.  The prompts you are seeing therefore come from Git rather than from OpenTofu. My guess would be that you have a stale time-limited GitHub token in your git credentials store and so GitHub is rejecting it and then `git` is prompting you for new credentials.  Perhaps if you clear out the stale credentials then Git will try making an anonymous request instead of trying to use the configured credentials. I'm not sure though... this is more of a Git configuration question than an OpenTofu question, and I'm not an expert on Git credentials manag
  > Thanks for the tip @apparentlymart ! Yes, I've figured it's something with my local git setup (which I haven't really changed between working and non-working state, so it's really puzzling), so I closed the issue. But thanks again anyways!

- **Issue #4536** (2026-08-28): **Symbol library function eval panics for parallel evaluation**
  *Symptoms*: ### Community note  > [!TIP] > 👋 Hi there, OpenTofu community! The OpenTofu team prioritizes issues based on upvotes. Please make sure to upvote this issue and describe how it affects you in detail in the comments to show your support.   ### OpenTofu Version  ```shell Latest main ```  ### OpenTofu Configuration Files  ```hcl #functions.sym.hcl language {   edition = "experimental2026" }  function "count_lowered" {   type = number    parameter "value" {     type = string   }    locals {     result = length([for index in range(1024) : lower(param.value)])   }    return = local.result } ```  ```hcl language {   edition     = tofu2024   experiments = [symbol_libraries] }  symbols "test" {   source = "./lib" }  output "first" {   value = symbols::test::count_lowered("FIRST") }  output "second" {   value = symbols::test::count_lowered("SECOND") } ```  It's important to have TWO outputs here calling the SAME function.  ### Debug Output  ``` tofu plan ╷ │ Warning: Experimental features are active │ │   on main.tf line 3, in language: │    3:   experiments = [symbol_libraries] │ │ Experimental features are subject to breaking changes or total removal in later versions, based on feedback. We recommend against using experimental features │ in production. │ │ The following experiments are enabled: symbol_libraries ╵ ╷ │ Warning: Experimental features are active │ │   on main.tf line 3, in language: │    3:   experiments = [symbol_libraries] │ │ Experimental features are subject to break

- **Issue #4456** (2026-08-31): **generate-config-out bug**
  *Symptoms*: ### Community note  > [!TIP] > 👋 Hi there, OpenTofu community! The OpenTofu team prioritizes issues based on upvotes. Please make sure to upvote this issue and describe how it affects you in detail in the comments to show your support.   ### OpenTofu Version  ```shell OpenTofu v1.12.1 on linux_amd64 + provider registry.opentofu.org/hashicorp/aws v6.58. ```  ### OpenTofu Configuration Files  import {   to = aws_dms_endpoint.kieuc1rds001_sdautomation   id = "kieuc1rds001-sdautomation" }   ### Debug Output  later   ### Expected Behavior  Tofu should import existing resources in to the tf file  ### Actual Behavior  <img width="1142" height="33" alt="Image" src="https://github.com/user-attachments/assets/aabf3512-29c9-4b59-947b-98d314e09246" />  ### Steps to Reproduce  tofu plan -var-file=vars/prd.tfvars -generate-config-out=dms.tf  ### Additional Context  _No response_  ### References  _No response_
  **Post-Mortem & Fix Analysis**:
  > I was unable to reproduce this. Is this bug occurring consistently? Every time I've tried to do this, and with different resource, the generated configuration gets created before the import happens, and the `tofu plan` picks up the configuration file.  What I'm assuming is happening is that the file is read in one place in the code but somehow not read in the other. Do you have an unusual setup for your file system?
  > Hi @nathanrouse,  We're not able to reproduce this problem without some additional information, and we've not heard from you for a few weeks so I'm going to close this for now but we're happy to reopen it if you want to continue the discussion.  Thanks! 

- **Issue #4433** (2026-08-03): **yamlencode add line breaks into long string values**
  *Symptoms*: ### Community note  > [!TIP] > 👋 Hi there, OpenTofu community! The OpenTofu team prioritizes issues based on upvotes. Please make sure to upvote this issue and describe how it affects you in detail in the comments to show your support.   ### OpenTofu Version  ```shell OpenTofu v1.12.5 on linux_amd64 + provider registry.opentofu.org/bald1nh0/passbolt v1.11.0 + provider registry.opentofu.org/cyrilgdn/postgresql v1.27.0 + provider registry.opentofu.org/dfns/tunnel v1.7.5 + provider registry.opentofu.org/hashicorp/external v2.4.0 + provider registry.opentofu.org/hashicorp/random v3.9.0 + provider registry.opentofu.org/hellscrimson/arcane v1.0.4 + provider registry.opentofu.org/isometry/deepmerge v1.3.0 + provider registry.opentofu.org/kreuzwerker/docker v4.5.0 ```  ### OpenTofu Configuration Files  ```bash $ tofu console > yamlencode({ command = "mkdir -p /app/storage/database /app/storage/framework/cache/data /app/storage/framework/sessions /app/storage/framework/views /app/storage/logs /app/bootstrap/cache && touch /app/storage/database/database.sqlite && chown -R www-data:www-data /app/storage  /app/bootstrap/cache && /command/s6-setuidgid www-data php artisan migrate --force" }) <<EOT "command": "mkdir -p /app/storage/database /app/storage/framework/cache/data /app/storage/framework/sessions   /app/storage/framework/views /app/storage/logs /app/bootstrap/cache && touch /app/storage/database/database.sqlite   && chown -R www-data:www-data /app/storage  /app/bootstrap/cache &&
  **Post-Mortem & Fix Analysis**:
  > My bad, that's yaml formatting expected behavior...
  > Thanks for the followup, @landure.  Just out of curiosity I wanted to confirm what you reported, so I tried passing the result of `yamlencode` back into `yamldecode` and verified that indeed the newline inside the quoted string in YAML is treated like a normal space during parsing:  ``` > yamldecode(yamlencode({ command = "mkdir -p /app/storage/database /app/storage/framework/cache/data /app/storage/framework/sessions /app/storage/framework/views" })) {   "command" = "mkdir -p /app/storage/database /app/storage/framework/cache/data /app/storage/framework/sessions /app/storage/framework/views" } ```  This behavior seems to be described in [6.5 Line Folding](https://yaml.org/spec/1.2.2/#65-line-folding), and in this case specifically the "flow folding" variant. 

- **Issue #4431** (2026-08-03): **bug: tofu init failed with v1.12.5 on darwin_arm64**
  *Symptoms*: ### Community note  > [!TIP] > 👋 Hi there, OpenTofu community! The OpenTofu team prioritizes issues based on upvotes. Please make sure to upvote this issue and describe how it affects you in detail in the comments to show your support.   ### OpenTofu Version  ```shell tofu version   OpenTofu v1.12.5 on darwin_arm64 ```  ### OpenTofu Configuration Files  ```hcl terraform {   required_providers {     alicloud = {       source  = "aliyun/alicloud"       version = "1.278.0"     }   } } ```   ### Debug Output  ``` 2026-08-03T15:35:42.744+0800 [TRACE] Stdout is a terminal of width 194 2026-08-03T15:35:42.745+0800 [TRACE] Stderr is a terminal of width 194 2026-08-03T15:35:42.745+0800 [TRACE] Stdin is a terminal 2026-08-03T15:35:42.745+0800 [TRACE] OpenTelemetry: OTEL_TRACES_EXPORTER not set, OTel tracing is not enabled 2026-08-03T15:35:42.745+0800 [INFO]  OpenTofu version: 1.12.5 2026-08-03T15:35:42.745+0800 [DEBUG] using github.com/hashicorp/go-getter v1.8.6 2026-08-03T15:35:42.745+0800 [DEBUG] using github.com/hashicorp/hcl v1.0.1-vault-7 2026-08-03T15:35:42.745+0800 [DEBUG] using github.com/opentofu/hcl/v2 v2.20.2-0.20251021132045-587d123c2828 2026-08-03T15:35:42.745+0800 [DEBUG] using github.com/opentofu/registry-address/v2 v2.0.0-20260307135325-45f3562374e4 2026-08-03T15:35:42.745+0800 [DEBUG] using github.com/opentofu/svchost v0.0.0-20250610175836-86c9e5e3d8c8 2026-08-03T15:35:42.745+0800 [DEBUG] using github.com/zclconf/go-cty v1.18.0 2026-08-03T15:35:42.745+0800 [INFO]  Go 

- **Issue #4430** (2026-08-18): **bug: `templatestring` panics ("value is marked") when the whole `vars` argument is sensitive**
  *Symptoms*: ### Community note  > [!TIP] > 👋 Hi there, OpenTofu community! The OpenTofu team prioritizes issues based on upvotes. Please make sure to upvote this issue and describe how it affects you in detail in the comments to show your support.   ### OpenTofu Version  ```shell v1.13.0-dev ```  ### OpenTofu Configuration Files  ```hcl output "broken" {   value = templatestring("Hello, $${name}!", sensitive({ name = "world" })) } ```  ### Debug Output  No gist needed — the bug is visible in source: [string.go#L221](https://github.com/opentofu/opentofu/blob/main/internal/lang/funcs/string.go#L221) / [#L230](https://github.com/opentofu/opentofu/blob/main/internal/lang/funcs/string.go#L230) pass `vars` to [render_template.go#L23](https://github.com/opentofu/opentofu/blob/main/internal/lang/funcs/render_template.go#L23) without unmarking, so `AsValueMap()` panics on a top-level-marked value.  ### Expected Behavior  Renders the template and marks the result sensitive, like `templatefile` already does for the same input.  ### Actual Behavior  ``` Call to function "templatestring" failed: panic in function implementation: value is marked, so must be unmarked first. ```  `templatefile` is unaffected because its `vars` param doesn't set `AllowMarked` (the framework strips/re-applies the mark). Distinct from #1798 (that was `templatefile`'s *path* argument). Only a top-level mark triggers it; marks on individual elements work fine.  ### Steps to Reproduce  ```bash echo 'output "broken" { value =
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this, @dongjune8931!  There's an even easier reproducer using `tofu console` like this:  ``` > templatestring("", sensitive({})) ╷ │ Error: Error in function call │  │   on <console-input> line 1: │   (source code not available) │  │ Call to function "templatestring" failed: panic in function implementation: value is marked, so must be unmarked first │ goroutine 1 [running]: │ runtime/debug.Stack() │       /.../go/pkg/mod/golang.org/toolchain@v0.0.1-go1.26.4.linux-amd64/src/runtime/debug/stack.go:26 +0x5e │ github.com/zclconf/go-cty/cty/function.errorForPanic(...) │       /.../go/pkg/mod/github.com/zclconf/go-cty@v1.18.1/cty/function/error.go:44 │ github.com/zclconf/go-cty/cty/function.Function.returnTypeForValues.func1() │       /.../go/pkg/mod/github.com/zclconf/go-cty@v1.18.1/cty/function/function.go:226 +0x75 │ panic({0x3b90020?, 0x47f2260?}) │       /.../go/pkg/mod/golang.org/toolchain@v0.0.1-go1.26.4.linux-amd64/src/runtime/panic.go:860 +0x13a │ github.com/zc
  > @dongjune8931 I've assigned this to you since you volunteered to work on it in your issue description.  Please remember that OpenTofu cannot accept contributions generated by LLM-based agents or similar technology, and that you'll need to provide [Developer Certificate of Origin](https://developercertificate.org/) signoff when submitting your PR. Thanks! 

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

### Incident Patch 1: `3cc40788` (2026-09-24)
**Commit Message**: configs: Fix typo in provider_meta warn log

Signed-off-by: Lucas Grigolon Varela <[REDACTED_EMAIL]>

**File**: `internal/configs/parser_config.go` (modified, +1/-1)
```diff
@@ -144,7 +144,7 @@ func loadConfigFileBody(body hcl.Body, _ string, override bool) (*File, hcl.Diag
 					file.RequiredProviders = append(file.RequiredProviders, reqs)
 
 				case "provider_meta":
-					log.Printf("[WARN] Ignoring provider meta_block at %s", innerBlock.DefRange)
+					log.Printf("[WARN] Ignoring provider_meta block at %s", innerBlock.DefRange)
 
 				case "encryption":
 					encryptionCfg, cfgDiags := config.DecodeConfig(innerBlock.Body, innerBlock.DefRange)
```

---

### Incident Patch 2: `8556e301` (2026-09-25)
**Commit Message**: fix(node_output): always re-evaluate ephemeral outputs during apply (#4582)

Signed-off-by: MGSousa <[REDACTED_EMAIL]>

**File**: `internal/tofu/context_apply2_test.go` (modified, +106/-0)
```diff
@@ -7328,3 +7328,109 @@ func TestContext2Apply_ephemeralInModuleWithExpansion(t *testing.T) {
 
 	}
 }
+
+// TestContext2Apply_ephemeralOutputCrossModuleWriteOnly checks that a value produced
+// by an ephemeral resource and shared via an `ephemeral = true` module output is
+// exporting identically at two different write-only attribute consumers: one in the
+// same module as the ephemeral resource, and one in a different module reached only
+// through the output.
+func TestContext2Apply_ephemeralOutputCrossModuleWriteOnly(t *testing.T) {
+	SkipExperimental(t, ExperimentalFlagUnknown)
+
+	m := testModuleInline(t, map[string]string{
+		"child/main.tf": `
+			ephemeral "test_ephemeral_resource" "generate" {
+				input = "seed"
+			}
+
+			resource "test_instance" "child" {
+				vpc_id   = "child"
+				value_wo = ephemeral.test_ephemeral_resource.generate.secret
+			}
+
+			output "secret" {
+				ephemeral = true
+				value     = ephemeral.test_ephemeral_resource.generate.secret
+			}
+		`,
+		"main.tf": `
+			module "child" {
+				source = "./child"
+			}
+
+			resource "test_instance" "root" {
+				vpc_id   = "root"
+				value_wo = module.child.secret
+			}
+		`,
+	})
+
+	provider := testProvider("test")
+
+	openCount := 0
+	provider.OpenEphemeralResourceFn = func(req providers.OpenEphemeralResourceRequest) providers.OpenEphemeralResourceResponse {
+		openCount++
+		return providers.OpenEphemeralResourceResponse{
+			Result: cty.ObjectVal(map[string]cty.Value{
+				"id":     cty.StringVal("id"),
+				"secret": cty.StringVal(fmt.Sprintf("generated-%d", openCount)),
+				"input":  req.Config.GetAttr("input"),
+			}),
+		}
+	}
+
+	// Write-only attributes must never appear in planned state, so null it out here
+	provider.PlanResourceChangeFn = func(req providers.PlanResourceChangeRequest) providers.PlanResourceChangeResponse {
+		planned := req.ProposedNewState.AsValueMap()
+		if _, ok := planned["value_wo"]; ok {
+			planned["value_wo"] = cty.NullVal(cty.String)
+		}
+		if planned["id"].IsNull() {
+			planned["id"] = cty.UnknownVal(cty.String)
+		}
+		return providers.PlanResourceChangeResponse{
+			PlannedState: cty.ObjectVal(planned),
+		}
+	}
+
+	// Capture the write-only value actually sent to ApplyResourceChange for each of the two resources
+	applied := map[string]string{}
+	provider.ApplyResourceChangeFn = func(req providers.ApplyResourceChangeRequest) providers.ApplyResourceChangeResponse {
+		newState := req.PlannedState.AsValueMap()
+		vpcID := newState["vpc_id"].AsString()
+		newState["id"] = cty.StringVal("id-" + vpcID)
+
+		wo := req.Config.GetAttr("value_wo")
+		if !wo.IsNull() {
+			applied[vpcID] = wo.AsString()
+		}
+
+		return providers.ApplyResourceChangeResponse{
+			NewState: cty.ObjectVal(newState),
+		}
+	}
+
+	ctx := testContext2(t, &ContextOpts{
+		Plugins: plugins.NewLibrary(map[addrs.Provider]providers.Factory{
+			addrs.NewDefaultProvider("test"): testProviderFuncFixed(provider),
+		}, nil),
+	})
+
+	plan, diags := ctx.Plan(context.Background(), m, states.NewState(), &PlanOpts{
+		Mode: plans.NormalMode,
+	})
+	assertNoErrors(t, diags)
+
+	_, diags = ctx.Apply(context.Background(), plan, m, nil)
+	assertNoErrors(t, diags)
+
+	if applied["child"] == "" || applied["root"] == "" {
+		t.Fatalf("did not capture write-only values for both resources: %#v", applied)
+	}
+	if applied["child"] != applied["root"] {
+		t.Errorf(
+			"write-only values diverged across the module boundary: child=%q root=%q (ephemeral resource opened %d times)",
+			applied["child"], applied["root"], openCount,
+		)
+	}
+}
```

**File**: `internal/tofu/node_output.go` (modified, +6/-2)
```diff
@@ -344,8 +344,12 @@ func (n *NodeApplyableOutput) Execute(ctx context.Context, evalCtx EvalContext,
 	}
 
 	// If there was no change recorded, or the recorded change was not wholly
-	// known, then we need to re-evaluate the output
-	if !changeRecorded || !val.IsWhollyKnown() {
+	// known, then we need to re-evaluate the output.
+	//
+	// Ephemeral outputs must also always be re-evaluated, so their value stays
+	// consistent with other consumers of the same ephemeral resource in this apply,
+	// instead of exporting a stale plan-time value across the module boundary.
+	if !changeRecorded || !val.IsWhollyKnown() || n.Config.Ephemeral {
 		switch {
 		// If the module is not being overridden, we proceed normally
 		case !n.Config.IsOverridden:
```

---

### Incident Patch 3: `8368dc8f` (2026-09-15)
**Commit Message**: Upgrade website dependencies to fix most of the high severity security issues (#4572)

Signed-off-by: Andrei Ciobanu <[REDACTED_EMAIL]>

**File**: `website/package-lock.json` (modified, +218/-163)
```diff
@@ -300,6 +300,7 @@
       "resolved": "https://registry.npmjs.org/@isaacs/cliui/-/cliui-8.0.2.tgz",
       "integrity": "sha512-O8jcjabXaleOG9DQ0+ARXWZBTfnP4WNAqzuiJK7ll44AmxGKv/J2M4TPjxjY3znBCfvBXFzucm1twdyFybFqEA==",
       "dev": true,
+      "license": "ISC",
       "dependencies": {
         "string-width": "^5.1.2",
         "string-width-cjs": "npm:string-width@^4.2.0",
@@ -313,10 +314,11 @@
       }
     },
     "node_modules/@isaacs/cliui/node_modules/ansi-regex": {
-      "version": "6.0.1",
-      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-6.0.1.tgz",
-      "integrity": "sha512-n5M855fKb2SsfMIiFFoVrABHJC8QtHwVx+mHWP3QcEqBHYienj5dHSgjbxtC0WEZXYt4wcD6zrQElDPhFuZgfA==",
+      "version": "6.3.0",
+      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-6.3.0.tgz",
+      "integrity": "sha512-WpDfL7NO6j7tH88IDBNVdUJxDh9nmCteAVW9dsep846XdwF4naCBK+/tGLX3KJgcpgMRXCFlTM2hKGoK9FsdrQ==",
       "dev": true,
+      "license": "MIT",
       "engines": {
         "node": ">=12"
       },
@@ -325,12 +327,13 @@
       }
     },
     "node_modules/@isaacs/cliui/node_modules/strip-ansi": {
-      "version": "7.1.0",
-      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-7.1.0.tgz",
-      "integrity": "sha512-iq6eVVI64nQQTRYq2KtEg2d2uU7LElhTJwsH4YzIHZshxlgZms/wIc4VoDQTlG/IvVIrBKG06CrZnp0qv7hkcQ==",
+      "version": "7.2.0",
+      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-7.2.0.tgz",
+      "integrity": "sha512-yDPMNjp4WyfYBkHnjIRLfca1i6KMyGCtsVgoKe/z1+6vukgaENdgGBZt+ZmKPc4gavvEZ5OgHfHdrazhgNyG7w==",
       "dev": true,
+      "license": "MIT",
       "dependencies": {
-        "ansi-regex": "^6.0.1"
+        "ansi-regex": "^6.2.2"
       },
       "engines": {
         "node": ">=12"
@@ -415,43 +418,45 @@
       }
     },
     "node_modules/@npmcli/map-workspaces/node_modules/brace-expansion": {
-      "version": "2.0.1",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.0.1.tgz",
-      "integrity": "sha512-XnAIvQ8eM+kC6aULx6wuQiwVsnzsi9d3WxzV3FpWTGA19F621kwdbsAcFKXgKUHZWsy+mY6iL1sHTxWEFCytDA==",
+      "version": "2.1.4",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.4.tgz",
+      "integrity": "sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==",
       "dev": true,
+      "license": "MIT",
       "dependencies": {
         "balanced-match": "^1.0.0"
       }
     },
     "node_modules/@npmcli/map-workspaces/node_modules/glob": {
-      "version": "10.3.4",
-      "resolved": "https://registry.npmjs.org/glob/-/glob-10.3.4.tgz",
-      "integrity": "sha512-6LFElP3A+i/Q8XQKEvZjkEWEOTgAIALR9AO2rwT8bgPhDd1anmqDJDZ6lLddI4ehxxxR1S5RIqKe1uapMQfYaQ==",
+      "version": "10.5.0",
+      "resolved": "https://registry.npmjs.org/glob/-/glob-10.5.0.tgz",
+      "integrity": "sha512-DfXN8DfhJ7NH3Oe7cFmu3NCu1wKbkReJ8TorzSAFbSKrlNaQSKfIzqYqVY8zlbs2NLBbWpRiU52GX2PbaBVNkg==",
+      "deprecated": "Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me",
       "dev": true,
+      "license": "ISC",
       "dependencies": {
         "foreground-child": "^3.1.0",
-        "jackspeak": "^2.0.3",
-        "minimatch": "^9.0.1",
-        "minipass": "^5.0.0 || ^6.0.2 || ^7.0.0",
-        "path-scurry": "^1.10.1"
+        "jackspeak": "^3.1.2",
+        "minimatch": "^9.0.4",
+        "minipass": "^7.1.2",
+        "package-json-from-dist": "^1.0.0",
+        "path-scurry": "^1.11.1"
       },
       "bin": {
-        "glob": "dist/cjs/src/bin.js"
-      },
-      "engines": {
-        "node": ">=16 || 14 >=14.17"
+        "glob": "dist/esm/bin.mjs"
       },
       "funding": {
         "url": "https://github.com/sponsors/isaacs"
       }
     },
     "node_modules/@npmcli/map-workspaces/node_modules/minimatch": {
-      "version": "9.0.3",
-      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-9.0.3.tgz",
-      "integrity": "sha512-RHiac9mvaRw0x3AYRgDC1CxAP7HTcNrrECeA8YYJeWnpo+2Q5CegtZjaotWTWxDG3UeGA1coE05iH1mPjT/2mg==",
+      "version": "9.0.9",
+      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-9.0.9.tgz",
+      "integrity": "sha512-OBwBN9AL4dqmETlpS2zasx+vTeWclWzkblfZk7KTA5j3jeOONz/tRCnZomUyvNg83wL5Zv9Ss6HMJXAgL8R2Yg==",
       "dev": true,
+      "license": "ISC",
       "dependencies": {
-        "brace-expansion": "^2.0.1"
+        "brace-expansion": "^2.0.2"
       },
       "engines": {
         "node": ">=16 || 14 >=14.17"
@@ -474,6 +479,7 @@
       "resolved": "https://registry.npmjs.org/@pkgjs/parseargs/-/parseargs-0.11.0.tgz",
       "integrity": "sha512-+1VkjdD0QBLPodGrJUeqarH8VAIvQODIbwh9XpP5Syisf7YoQgsJKPNFoqqLQlu+VQ/tVSshMR6loPMn8U+dPg==",
       "dev": true,
+      "license": "MIT",
       "optional": tru
```

---

### Incident Patch 4: `80be292a` (2026-09-07)
**Commit Message**: fix: tofu plan command no longer prints iterative warnings for multiple resources (#4396)

Signed-off-by: aniket1260 <[REDACTED_EMAIL]>
Signed-off-by: Aniket <[REDACTED_EMAIL]>
Co-authored-by: Andrei Ciobanu <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -10,6 +10,10 @@ UPGRADE NOTES:
 
     Third parties may continue to offer their own OpenTofu builds targeting platforms that we don't officially support. This only affects the official packages published directly by the OpenTofu project in this repository's release artifacts.
 
+ENHANCEMENTS:
+
+- `tofu plan` no longer prints iterative warnings for multiple resources but instead it shows one warning with all of the affected resources. ([#4201](https://github.com/opentofu/opentofu/issues/4201))
+
 BUG FIXES:
 
 - `tofu fmt`: Fixed wrong resolution of paths when the working directory is a symlink; output now shows absolute file paths instead of giving error `Invalid file or directory path`. ([#3879](https://github.com/opentofu/opentofu/issues/3879))
```

**File**: `internal/command/e2etest/primary_test.go` (modified, +69/-0)
```diff
@@ -1050,3 +1050,72 @@ func mustResourceInstanceAddr(t *testing.T, s string) addrs.AbsResourceInstance
 	}
 	return addr
 }
+
+func TestCheckForgetWarnings(t *testing.T) {
+	t.Parallel()
+
+	skipIfCannotAccessNetwork(t)
+
+	fixturePath := filepath.Join("testdata", "empty")
+	tf := e2e.NewBinary(t, tofuBin, fixturePath)
+
+	config1 := `
+resource "null_resource" "test" {
+  triggers = {
+    value = "hello"
+  }
+}
+`
+	err := os.WriteFile(tf.Path("main.tf"), []byte(config1), 0644)
+	if err != nil {
+		t.Fatalf("failed to write main.tf: %s", err)
+	}
+
+	_, stderr, err := tf.Run("init")
+	if err != nil {
+		t.Fatalf("unexpected init error: %s\nstderr:\n%s", err, stderr)
+	}
+
+	_, stderr, err = tf.Run("apply", "-auto-approve")
+	if err != nil {
+		t.Fatalf("unexpected apply error: %s\nstderr:\n%s", err, stderr)
+	}
+
+	config2 := `
+removed {
+  from = null_resource.test
+
+  lifecycle {
+    destroy = false
+  }
+}
+`
+	err = os.WriteFile(tf.Path("main.tf"), []byte(config2), 0644)
+	if err != nil {
+		t.Fatalf("failed to write main.tf: %s", err)
+	}
+
+	stdout, stderr, err := tf.Run("plan")
+	if err != nil {
+		t.Fatalf("unexpected plan error: %s\nstderr:\n%s", err, stderr)
+	}
+
+	warningCount := strings.Count(stdout, "Warning:")
+	if warningCount != 1 {
+		t.Errorf("expected exactly 1 warning in output, got %d. Output:\n%s", warningCount, stdout)
+	}
+
+	errorCount := strings.Count(stdout, "Error:")
+	if errorCount != 0 {
+		t.Errorf("expected 0 errors in output, got %d. Output:\n%s", errorCount, stdout)
+	}
+
+	if !strings.Contains(stdout, "Objects will be removed from state") {
+		t.Errorf("expected warning message 'Objects will be removed from state' in stdout. Output:\n%s", stdout)
+	}
+
+	if !strings.Contains(stdout, "After this plan is applied") || !strings.Contains(stdout, "will no longer be managed by OpenTofu") {
+		t.Errorf("expected warning message detail in stdout. Output:\n%s", stdout)
+	}
+}
+
```

**File**: `internal/tofu/context_plan.go` (modified, +101/-0)
```diff
@@ -19,6 +19,7 @@ import (
 	"github.com/zclconf/go-cty/cty"
 
 	"github.com/opentofu/opentofu/internal/addrs"
+	"github.com/opentofu/opentofu/internal/command/format"
 	"github.com/opentofu/opentofu/internal/configs"
 	"github.com/opentofu/opentofu/internal/instances"
 	"github.com/opentofu/opentofu/internal/lang/globalref"
@@ -298,9 +299,29 @@ The -target and -exclude options are not for routine use, and are provided only
 
 	diags = diags.Append(c.checkApplyGraph(ctx, plan, config))
 
+	if planHasForgetChanges(plan) {
+		schemas, schemasDiags := c.Schemas(ctx, config, prevRunState)
+		diags = diags.Append(schemasDiags)
+		if !schemasDiags.HasErrors() {
+			diags = diags.Append(c.checkForgetWarnings(plan, schemas))
+		}
+	}
+
 	return plan, diags
 }
 
+func planHasForgetChanges(plan *plans.Plan) bool {
+	if plan == nil || plan.Changes == nil {
+		return false
+	}
+	for _, rc := range plan.Changes.Resources {
+		if rc.Action == plans.Forget || rc.Action == plans.ForgetThenCreate {
+			return true
+		}
+	}
+	return false
+}
+
 // checkApplyGraph builds the apply graph out of the current plan to
 // check for any errors that may arise once the planned changes are added to
 // the graph. This allows tofu to report errors (mostly cycles) during
@@ -1210,3 +1231,83 @@ func warnOnUsedDeprecatedVars(inputs InputValues, decls map[string]*configs.Vari
 	}
 	return diags
 }
+
+func (c *Context) checkForgetWarnings(plan *plans.Plan, schemas *Schemas) tfdiags.Diagnostics {
+	var diags tfdiags.Diagnostics
+	if plan == nil || plan.Changes == nil {
+		return diags
+	}
+
+	type forgetItem struct {
+		addr    addrs.AbsResourceInstance
+		attrKey string
+		attrVal string
+	}
+	var items []forgetItem
+
+	for _, rc := range plan.Changes.Resources {
+		if rc.Action != plans.Forget && rc.Action != plans.ForgetThenCreate {
+			continue
+		}
+		schema, _ := schemas.ResourceTypeConfig(
+			rc.ProviderAddr.Provider,
+			rc.Addr.Resource.Resource.Mode,
+			rc.Addr.Resource.Resource.Type,
+		)
+		if schema == nil {
+			items = append(items, forgetItem{
+				addr: rc.Addr,
+			})
+			continue
+		}
+
+		changeV, err := rc.Decode(schema)
+		if err != nil || changeV.Before == cty.NilVal {
+			items = append(items, forgetItem{
+				addr: rc.Addr,
+			})
+			continue
+		}
+
+		k, v := format.ObjectValueBestGuess(changeV.Before)
+		items = append(items, forgetItem{
+			addr:    rc.Addr,
+			attrKey: k,
+			attrVal: v,
+		})
+	}
+
+	if len(items) == 0 {
+		return diags
+	}
+
+	// Sort items by address for deterministic output
+	slices.SortFunc(items, func(a, b forgetItem) int {
+		if a.addr.Less(b.addr) {
+			return -1
+		}
+		if b.addr.Less(a.addr) {
+			return 1
+		}
+		return 0
+	})
+
+	var sb strings.Builder
+	sb.WriteString("After this plan is applied, the objects associated with the following resource instances will no longer be managed by OpenTofu:\n")
+	for _, item := range items {
+		if item.attrVal != "" {
+			fmt.Fprintf(&sb, " - %s (%s=%q)\n", item.addr, item.attrKey, item.attrVal)
+		} else {
+			fmt.Fprintf(&sb, " - %s\n", item.addr)
+		}
+	}
+	sb.WriteString("\nThese objects will continue to exist in the remote system until you delete them outside of OpenTofu. If you wish to manage any of these objects with OpenTofu again in future then you will need to re-import them.")
+
+	diags = diags.Append(tfdiags.Sourceless(
+		tfdiags.Warning,
+		"Objects will be removed from state",
+		sb.String(),
+	))
+
+	return diags
+}
```

**File**: `internal/tofu/node_resource_deposed.go` (modified, +0/-7)
```diff
@@ -10,8 +10,6 @@ import (
 	"fmt"
 	"log"
 
-	"github.com/hashicorp/hcl/v2"
-
 	"github.com/opentofu/opentofu/internal/addrs"
 	"github.com/opentofu/opentofu/internal/dag"
 	"github.com/opentofu/opentofu/internal/instances"
@@ -189,11 +187,6 @@ func (n *NodePlanDeposedResourceInstanceObject) Execute(ctx context.Context, eva
 		if shouldDestroy {
 			change, planDiags = n.planDestroy(ctx, evalCtx, state, n.DeposedKey)
 		} else {
-			diags = diags.Append(&hcl.Diagnostic{
-				Severity: hcl.DiagWarning,
-				Summary:  "Resource will be removed from the state",
-				Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", n.Addr),
-			})
 			log.Printf("[DEBUG] NodePlanDeposedResourceInstanceObject.Execute: %s (deposed %s) planning forget instead of destroy", n.Addr, n.DeposedKey)
 			change = n.planForget(ctx, evalCtx, state, n.DeposedKey)
 			if skipDestroy {
```

**File**: `internal/tofu/node_resource_deposed_test.go` (modified, +0/-31)
```diff
@@ -10,7 +10,6 @@ import (
 	"fmt"
 	"testing"
 
-	"github.com/hashicorp/hcl/v2"
 	"github.com/opentofu/opentofu/internal/addrs"
 	"github.com/opentofu/opentofu/internal/configs/configschema"
 	"github.com/opentofu/opentofu/internal/plans"
@@ -64,11 +63,6 @@ func TestNodePlanDeposedResourceInstanceObject_Execute(t *testing.T) {
 				},
 			},
 			wantAction: plans.Forget,
-			wantDiags: tfdiags.Diagnostics{}.Append(&hcl.Diagnostic{
-				Severity: hcl.DiagWarning,
-				Summary:  "Resource will be removed from the state",
-				Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", "test_instance.foo"),
-			}),
 		},
 		{
 			description: "remove block is targeting current node and required to get it destroyed",
@@ -90,11 +84,6 @@ func TestNodePlanDeposedResourceInstanceObject_Execute(t *testing.T) {
 				},
 			},
 			wantAction: plans.Forget,
-			wantDiags: tfdiags.Diagnostics{}.Append(&hcl.Diagnostic{
-				Severity: hcl.DiagWarning,
-				Summary:  "Resource will be removed from the state",
-				Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", "test_instance.foo[1]"),
-			}),
 		},
 		{
 			description: "remove block is targeting a resource to be destroyed and the current node is an instance of that",
@@ -116,11 +105,6 @@ func TestNodePlanDeposedResourceInstanceObject_Execute(t *testing.T) {
 				},
 			},
 			wantAction: plans.Forget,
-			wantDiags: tfdiags.Diagnostics{}.Append(&hcl.Diagnostic{
-				Severity: hcl.DiagWarning,
-				Summary:  "Resource will be removed from the state",
-				Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", "module.boop.test_instance.foo"),
-			}),
 		},
 		{
 			description: "remove block is targeting a resource from a module to be destroyed which is the current node",
@@ -153,11 +137,6 @@ func TestNodePlanDeposedResourceInstanceObject_Execute(t *testing.T) {
 				},
 			},
 			wantAction: plans.Forget,
-			wantDiags: tfdiags.Diagnostics{}.Append(&hcl.Diagnostic{
-				Severity: hcl.DiagWarning,
-				Summary:  "Resource will be removed from the state",
-				Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", "module.boop[1].test_instance.foo[1]"),
-			}),
 		},
 		{
 			description: "remove block is targeting a module and the current node is a resource of that module",
@@ -168,11 +147,6 @@ func TestNodePlanDeposedResourceInstanceObject_Execute(t *testing.T) {
 				},
 			},
 			wantAction: plans.Forget,
-			wantDiags: tfdiags.Diagnostics{}.Append(&hcl.Diagnostic{
-				Severity: hcl.DiagWarning,
-				Summary:  "Resource will be removed from the state",
-				Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", "module.boop.test_instance.foo"),
-			}),
 		},
 		{
 			description: "remove block is targeting a module and the current node is a resource of one of the module instances",
@@ -183,11 +157,6 @@ func TestNodePlanDeposedResourceInstanceObject_Execute(t *testing.T) {
 				},
 			},
 			wantAction: plans.Forget,
-			wantDiags: tfdiags.Diagnostics{}.Append(&hcl.Diagnostic{
-				Severity: hcl.DiagWarning,
-				Summary:  "Resource will be removed from the state",
-				Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", "module.boop[1].test_instance.foo"),
-			}),
 		},
 	}
 
```

**File**: `internal/tofu/node_resource_plan_orphan.go` (modified, +0/-7)
```diff
@@ -10,8 +10,6 @@ import (
 	"fmt"
 	"log"
 
-	"github.com/hashicorp/hcl/v2"
-
 	"github.com/opentofu/opentofu/internal/addrs"
 	"github.com/opentofu/opentofu/internal/plans"
 	"github.com/opentofu/opentofu/internal/refactoring"
@@ -215,11 +213,6 @@ func (n *NodePlannableResourceInstanceOrphan) managedResourceExecute(ctx context
 	if shouldDestroy {
 		change, planDiags = n.planDestroy(ctx, evalCtx, oldState, "")
 	} else {
-		diags = diags.Append(&hcl.Diagnostic{
-			Severity: hcl.DiagWarning,
-			Summary:  "Resource will be removed from the state",
-			Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", n.Addr),
-		})
 		log.Printf("[DEBUG] NodePlannableResourceInstanceOrphan.managedResourceExecute: %s (orphan) planning forget instead of destroy", addr)
 		change = n.planForget(ctx, evalCtx, oldState, "")
 		if skipDestroy {
```

**File**: `internal/tofu/node_resource_plan_orphan_test.go` (modified, +0/-31)
```diff
@@ -9,7 +9,6 @@ import (
 	"fmt"
 	"testing"
 
-	"github.com/hashicorp/hcl/v2"
 	"github.com/opentofu/opentofu/internal/addrs"
 	"github.com/opentofu/opentofu/internal/configs/configschema"
 	"github.com/opentofu/opentofu/internal/instances"
@@ -58,11 +57,6 @@ func TestNodeResourcePlanOrphan_Execute(t *testing.T) {
 				{From: mustConfigResourceAddr("test_instance.foo")},
 			},
 			wantAction: plans.Forget,
-			wantDiags: tfdiags.Diagnostics{}.Append(&hcl.Diagnostic{
-				Severity: hcl.DiagWarning,
-				Summary:  "Resource will be removed from the state",
-				Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", "test_instance.foo"),
-			}),
 		},
 		{
 			description: "remove block is targeting current node and required to get it destroyed",
@@ -82,11 +76,6 @@ func TestNodeResourcePlanOrphan_Execute(t *testing.T) {
 				{From: mustConfigResourceAddr("test_instance.foo")},
 			},
 			wantAction: plans.Forget,
-			wantDiags: tfdiags.Diagnostics{}.Append(&hcl.Diagnostic{
-				Severity: hcl.DiagWarning,
-				Summary:  "Resource will be removed from the state",
-				Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", "test_instance.foo[1]"),
-			}),
 		},
 		{
 			description: "remove block is targeting a resource to be destroyed and the current node is an instance of that",
@@ -106,11 +95,6 @@ func TestNodeResourcePlanOrphan_Execute(t *testing.T) {
 				{From: mustConfigResourceAddr("module.boop.test_instance.foo")},
 			},
 			wantAction: plans.Forget,
-			wantDiags: tfdiags.Diagnostics{}.Append(&hcl.Diagnostic{
-				Severity: hcl.DiagWarning,
-				Summary:  "Resource will be removed from the state",
-				Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", "module.boop.test_instance.foo"),
-			}),
 		},
 		{
 			description: "remove block is targeting a resource from a module to be destroyed which is the current node",
@@ -141,11 +125,6 @@ func TestNodeResourcePlanOrphan_Execute(t *testing.T) {
 				{From: mustConfigResourceAddr("module.boop.test_instance.foo")},
 			},
 			wantAction: plans.Forget,
-			wantDiags: tfdiags.Diagnostics{}.Append(&hcl.Diagnostic{
-				Severity: hcl.DiagWarning,
-				Summary:  "Resource will be removed from the state",
-				Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", "module.boop[1].test_instance.foo[1]"),
-			}),
 		},
 		{
 			description: "remove block is targeting a module and the current node is a resource of that module",
@@ -154,11 +133,6 @@ func TestNodeResourcePlanOrphan_Execute(t *testing.T) {
 				{From: addrs.Module{"boop"}},
 			},
 			wantAction: plans.Forget,
-			wantDiags: tfdiags.Diagnostics{}.Append(&hcl.Diagnostic{
-				Severity: hcl.DiagWarning,
-				Summary:  "Resource will be removed from the state",
-				Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", "module.boop.test_instance.foo"),
-			}),
 		},
 		{
 			description: "remove block is targeting a module and the current node is a resource of one of the module instances",
@@ -167,11 +141,6 @@ func TestNodeResourcePlanOrphan_Execute(t *testing.T) {
 				{From: addrs.Module{"boop"}},
 			},
 			wantAction: plans.Forget,
-			wantDiags: tfdiags.Diagnostics{}.Append(&hcl.Diagnostic{
-				Severity: hcl.DiagWarning,
-				Summary:  "Resource will be removed from the state",
-				Detail:   fmt.Sprintf("After this plan is applied, the resource %s will not be managed anymore by OpenTofu.\n\nIn case you want to manage the resource again, you will have to import it.", "module.boop[1].test_instance.foo"),
-			}),
 		},
 	}
 
```

---

### Incident Patch 5: `d6bb14c6` (2026-09-01)
**Commit Message**: Quick note to not forget about milestones when doing releases

Signed-off-by: Andrei Ciobanu <[REDACTED_EMAIL]>

**File**: `CONTRIBUTING.RELEASE.md` (modified, +5/-0)
```diff
@@ -363,6 +363,11 @@ Now you can commit your changes and open a pull request.
 
 </details>
 
+## GitHub milestone
+Once the release is public ensure that the GitHub milestones are updated:
+* Close the milestone for the closed release
+* Create the milestone for the next patch release
+
 ---
 
 ## Updating govulncheck github workflow (only for stable releases)
```

---

### Incident Patch 6: `842ea20f` (2026-08-31)
**Commit Message**: command/fmt: Fix path resolution when the working directory is a symlink (#4509)

Signed-off-by: Lucas Grigolon Varela <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -10,6 +10,10 @@ UPGRADE NOTES:
 
     Third parties may continue to offer their own OpenTofu builds targeting platforms that we don't officially support. This only affects the official packages published directly by the OpenTofu project in this repository's release artifacts.
 
+BUG FIXES:
+
+- `tofu fmt`: Fixed wrong resolution of paths when the working directory is a symlink; output now shows absolute file paths instead of giving error `Invalid file or directory path`. ([#3879](https://github.com/opentofu/opentofu/issues/3879))
+
 ## Previous Releases
 
 For information on prior major and minor releases, refer to their changelogs:
```

**File**: `internal/command/fmt.go` (modified, +2/-3)
```diff
@@ -123,7 +123,6 @@ func (c *FmtCommand) fmt(paths []string, stdin io.Reader, stdout io.Writer, args
 	}
 
 	for _, path := range paths {
-		path = c.Meta.WorkingDir.NormalizePath(path)
 		info, err := os.Stat(path)
 		if err != nil {
 			diags = diags.Append(tfdiags.Sourceless(
@@ -152,7 +151,7 @@ func (c *FmtCommand) fmt(paths []string, stdin io.Reader, stdout io.Writer, args
 						continue
 					}
 
-					fileDiags := c.processFile(c.Meta.WorkingDir.NormalizePath(path), f, stdout, args)
+					fileDiags := c.processFile(path, f, stdout, args)
 					diags = diags.Append(fileDiags)
 					_ = f.Close()
 
@@ -316,7 +315,7 @@ func (c *FmtCommand) processDir(path string, stdout io.Writer, args arguments.Fm
 					continue
 				}
 
-				fileDiags := c.processFile(c.Meta.WorkingDir.NormalizePath(subPath), f, stdout, args)
+				fileDiags := c.processFile(subPath, f, stdout, args)
 				diags = diags.Append(fileDiags)
 				_ = f.Close()
 
```

**File**: `internal/command/fmt_test.go` (modified, +89/-4)
```diff
@@ -10,6 +10,7 @@ import (
 	"fmt"
 	"os"
 	"path/filepath"
+	"runtime"
 	"sort"
 	"strings"
 	"testing"
@@ -456,10 +457,6 @@ func TestFmt_check(t *testing.T) {
 		t.Fatalf("wrong exit code. expected 3")
 	}
 
-	// Given that we give relative paths back to the user, normalize this temp
-	// dir so that we're comparing against a relative-ized (normalized) path
-	tempDir = meta.WorkingDir.NormalizePath(tempDir)
-
 	if actual := output.Stdout(); !strings.Contains(actual, tempDir) {
 		t.Fatalf("expected:\n%s\n\nto include: %q", actual, tempDir)
 	}
@@ -493,6 +490,63 @@ func TestFmt_checkStdin(t *testing.T) {
 	}
 }
 
+// TestFmt_symlinkedWorkingDir verifies that an absolute path still resolves
+// when the working directory is reached through a symlink.
+// Regression test for https://github.com/opentofu/opentofu/issues/3879
+func TestFmt_symlinkedWorkingDir(t *testing.T) {
+	t.Run("file", func(t *testing.T) {
+		_, realFilePath := fmtSymlinkedWorkingDir(t)
+
+		view, done := testView(t)
+		meta := Meta{
+			WorkingDir:       workdir.NewDir("."),
+			testingOverrides: metaOverridesForProvider(testProvider()),
+			View:             view,
+		}
+		args := []string{realFilePath}
+		code := RunCommander(t, FmtCommander(nil), meta, args)
+		output := done(t)
+
+		if code != 0 {
+			t.Fatalf("fmt command was unsuccessful:\n%s", output.Stderr())
+		}
+
+		got, err := os.ReadFile(realFilePath)
+		if err != nil {
+			t.Fatal(err)
+		}
+		if diff := cmp.Diff(string(fmtFixture.golden), string(got)); diff != "" {
+			t.Errorf("wrong result\n%s", diff)
+		}
+	})
+
+	t.Run("directory", func(t *testing.T) {
+		realDir, realFilePath := fmtSymlinkedWorkingDir(t)
+
+		view, done := testView(t)
+		meta := Meta{
+			WorkingDir:       workdir.NewDir("."),
+			testingOverrides: metaOverridesForProvider(testProvider()),
+			View:             view,
+		}
+		args := []string{realDir}
+		code := RunCommander(t, FmtCommander(nil), meta, args)
+		output := done(t)
+
+		if code != 0 {
+			t.Fatalf("fmt command was unsuccessful:\n%s", output.Stderr())
+		}
+
+		got, err := os.ReadFile(realFilePath)
+		if err != nil {
+			t.Fatal(err)
+		}
+		if diff := cmp.Diff(string(fmtFixture.golden), string(got)); diff != "" {
+			t.Errorf("wrong result\n%s", diff)
+		}
+	})
+}
+
 var fmtFixture = struct {
 	filename      string
 	altFilename   string
@@ -521,3 +575,34 @@ func fmtFixtureWriteDir(t *testing.T) string {
 
 	return dir
 }
+
+// fmtSymlinkedWorkingDir is a t.Helper function that creates the real dir and symlink dir.
+// Chdir into symlink path. Because of this, tests using this helper cannot call t.Parallel().
+func fmtSymlinkedWorkingDir(t *testing.T) (realDir string, realFilePath string) {
+	t.Helper()
+
+	tempDir := t.TempDir()
+	realDir = filepath.Join(tempDir, "dir1", "dir2")
+	realFilePath = filepath.Join(realDir, "test.tf")
+	symlinkPath := filepath.Join(tempDir, "symlink_dir")
+
+	if err := os.MkdirAll(realDir, 0755); err != nil {
+		t.Fatalf("failed to create the folders: %s", err)
+	}
+
+	if err := os.WriteFile(realFilePath, fmtFixture.input, 0600); err != nil {
+		t.Fatalf("failed to create the test file: %s", err)
+	}
+
+	if err := os.Symlink(realDir, symlinkPath); err != nil {
+		if runtime.GOOS == "windows" {
+			// By default Windows does not allow creation of symlinks; avoid false-negatives
+			t.Skipf("can't create symlink on this Windows system: %s", err)
+		}
+		t.Fatalf("failed to make symlink: %s", err)
+	}
+	// Chdir affects the whole process, a test using this should never call t.Parallel()
+	t.Chdir(symlinkPath)
+
+	return realDir, realFilePath
+}
```

---

### Incident Patch 7: `e66c5db1` (2026-08-31)
**Commit Message**: Fix race in fn impl overrides for symlib

Signed-off-by: Christian Mesh <[REDACTED_EMAIL]>

**File**: `internal/configs/symlib/functions.go` (modified, +2/-1)
```diff
@@ -241,7 +241,8 @@ func (fn *Function) Compile(w *workgraph.Worker, libScope *symbolScope) (functio
 	}
 
 	return func(wf func() *workgraph.Worker, stack []string) function.Function {
-		// This is safe because of struct copies
+		// Duplicate spec struct for impl overrides
+		spec := new(*spec)
 		spec.Impl = func(args []cty.Value, retType cty.Type) (cty.Value, error) {
 			var diags hcl.Diagnostics
 
```

---

### Incident Patch 8: `11d0e3ab` (2026-08-28)
**Commit Message**: e2etest: Use a newer version of hashicorp/null in provider cache test

The version we were previously using does not have builds for either
linux_arm64 or windows_arm64. It didn't fail on windows_arm64 because
there's a t.Skip() whenever `runtime.GOOS == "windows"`, but this now
prepares this test to run on both platforms if we eventually fix the
preexisting TODO in there about adapting the dependency lock file to
expect the Windows-style executable filename.

Signed-off-by: Martin Atkins <[REDACTED_EMAIL]>

**File**: `internal/command/e2etest/init_test.go` (modified, +2/-2)
```diff
@@ -364,12 +364,12 @@ func TestInitProviders_pluginCache(t *testing.T) {
 		t.Errorf("template plugin was not installed from local cache")
 	}
 
-	nullLinkPath := filepath.FromSlash(fmt.Sprintf(".terraform/providers/registry.opentofu.org/hashicorp/null/2.1.0/%s_%s/terraform-provider-null", runtime.GOOS, runtime.GOARCH)) + extension
+	nullLinkPath := filepath.FromSlash(fmt.Sprintf(".terraform/providers/registry.opentofu.org/hashicorp/null/3.3.1/%s_%s/terraform-provider-null", runtime.GOOS, runtime.GOARCH)) + extension
 	if !tf.FileExists(nullLinkPath) {
 		t.Errorf("null plugin was not installed into %s", nullLinkPath)
 	}
 
-	nullCachePath := filepath.FromSlash(fmt.Sprintf("cache/registry.opentofu.org/hashicorp/null/2.1.0/%s_%s/terraform-provider-null", runtime.GOOS, runtime.GOARCH)) + extension
+	nullCachePath := filepath.FromSlash(fmt.Sprintf("cache/registry.opentofu.org/hashicorp/null/3.3.1/%s_%s/terraform-provider-null", runtime.GOOS, runtime.GOARCH)) + extension
 	if !tf.FileExists(nullCachePath) {
 		t.Errorf("null plugin is not in cache after install. expected in: %s", nullCachePath)
 	}
```

**File**: `internal/command/e2etest/testdata/plugin-cache/main.tf` (modified, +1/-1)
```diff
@@ -3,5 +3,5 @@ provider "template" {
 }
 
 provider "null" {
-  version = "2.1.0"
+  version = "3.3.1"
 }
```

---

### Incident Patch 9: `2ebaddca` (2026-08-26)
**Commit Message**: lang/eval and engine: go fix with Go 1.27

Since this is all relatively new code still under active development, we
don't have to worry about the usual concern of being able to backport to
earlier release series.

I'm taking the opportunity to do this now since we're currently in a short
lull just before the v1.14 development period starts and so this is less
likely to conflict with other concurrent work.

Signed-off-by: Martin Atkins <[REDACTED_EMAIL]>

**File**: `internal/engine/planning/execgraph_managed_test.go` (modified, +24/-40)
```diff
@@ -45,11 +45,9 @@ func TestExecGraphBuilder_ManagedResourceInstanceSubgraph(t *testing.T) {
 					&plans.ResourceInstanceChange{
 						Addr:        instAddr,
 						PrevRunAddr: instAddr,
-						Change: plans.Change{
-							Action: plans.Create,
-							Before: cty.NullVal(cty.EmptyObject),
-							After:  cty.EmptyObjectVal,
-						},
+						Action:      plans.Create,
+						Before:      cty.NullVal(cty.EmptyObject),
+						After:       cty.EmptyObjectVal,
 					},
 					replaceDestroyThenCreate,
 				)
@@ -71,11 +69,9 @@ func TestExecGraphBuilder_ManagedResourceInstanceSubgraph(t *testing.T) {
 					&plans.ResourceInstanceChange{
 						Addr:        instAddr,
 						PrevRunAddr: instAddr,
-						Change: plans.Change{
-							Action: plans.Update,
-							Before: cty.StringVal("before"),
-							After:  cty.StringVal("after"),
-						},
+						Action:      plans.Update,
+						Before:      cty.StringVal("before"),
+						After:       cty.StringVal("after"),
 					},
 					replaceDestroyThenCreate,
 				)
@@ -103,11 +99,9 @@ func TestExecGraphBuilder_ManagedResourceInstanceSubgraph(t *testing.T) {
 					&plans.ResourceInstanceChange{
 						Addr:        instAddr,
 						PrevRunAddr: oldInstAddr,
-						Change: plans.Change{
-							Action: plans.Update,
-							Before: cty.StringVal("before"),
-							After:  cty.StringVal("after"),
-						},
+						Action:      plans.Update,
+						Before:      cty.StringVal("before"),
+						After:       cty.StringVal("after"),
 					},
 					replaceDestroyThenCreate,
 				)
@@ -131,11 +125,9 @@ func TestExecGraphBuilder_ManagedResourceInstanceSubgraph(t *testing.T) {
 					&plans.ResourceInstanceChange{
 						Addr:        instAddr,
 						PrevRunAddr: instAddr,
-						Change: plans.Change{
-							Action: plans.Delete,
-							Before: cty.EmptyObjectVal,
-							After:  cty.NullVal(cty.EmptyObject),
-						},
+						Action:      plans.Delete,
+						Before:      cty.EmptyObjectVal,
+						After:       cty.NullVal(cty.EmptyObject),
 					},
 					replaceDestroyThenCreate,
 				)
@@ -166,11 +158,9 @@ func TestExecGraphBuilder_ManagedResourceInstanceSubgraph(t *testing.T) {
 					&plans.ResourceInstanceChange{
 						Addr:        instAddr,
 						PrevRunAddr: instAddr,
-						Change: plans.Change{
-							Action: plans.DeleteThenCreate,
-							Before: cty.StringVal("before"),
-							After:  cty.StringVal("after"),
-						},
+						Action:      plans.DeleteThenCreate,
+						Before:      cty.StringVal("before"),
+						After:       cty.StringVal("after"),
 					},
 					replaceDestroyThenCreate,
 				)
@@ -201,11 +191,9 @@ func TestExecGraphBuilder_ManagedResourceInstanceSubgraph(t *testing.T) {
 					&plans.ResourceInstanceChange{
 						Addr:        instAddr,
 						PrevRunAddr: oldInstAddr,
-						Change: plans.Change{
-							Action: plans.DeleteThenCreate,
-							Before: cty.StringVal("before"),
-							After:  cty.StringVal("after"),
-						},
+						Action:      plans.DeleteThenCreate,
+						Before:      cty.StringVal("before"),
+						After:       cty.StringVal("after"),
 					},
 					replaceDestroyThenCreate,
 				)
@@ -232,11 +220,9 @@ func TestExecGraphBuilder_ManagedResourceInstanceSubgraph(t *testing.T) {
 					&plans.ResourceInstanceChange{
 						Addr:        instAddr,
 						PrevRunAddr: instAddr,
-						Change: plans.Change{
-							Action: plans.CreateThenDelete,
-							Before: cty.StringVal("before"),
-							After:  cty.StringVal("after"),
-						},
+						Action:      plans.CreateThenDelete,
+						Before:      cty.StringVal("before"),
+						After:       cty.StringVal("after"),
 					},
 					replaceCreateThenDestroy,
 				)
@@ -269,11 +255,9 @@ func TestExecGraphBuilder_ManagedResourceInstanceSubgraph(t *testing.T) {
 					&plans.ResourceInstanceChange{
 						Addr:        instAddr,
 						PrevRunAddr: oldInstAddr,
-						Change: plans.Change{
-							Action: plans.CreateThenDelete,
-							Before: cty.StringVal("before"),
-							After:  cty.StringVal("after"),
-						},
+						Action:      plans.CreateThenDelete,
+						Before:      cty.StringVal("before"),
+						After:       cty.StringVal("after"),
 					},
 					replaceCreateThenDestroy,
 				)
```

**File**: `internal/engine/planning/plan.go` (modified, +6/-10)
```diff
@@ -288,11 +288,9 @@ func buildPlanChanges(
 		change := &plans.OutputChange{
 			Addr:      absAddr,
 			Sensitive: sensitiveChange,
-			Change: plans.Change{
-				Action: action,
-				Before: before,
-				After:  value,
-			},
+			Action:    action,
+			Before:    before,
+			After:     value,
 		}
 
 		cs, err := change.Encode()
@@ -314,11 +312,9 @@ func buildPlanChanges(
 			change := &plans.OutputChange{
 				Addr:      absAddr,
 				Sensitive: prevValue.Sensitive,
-				Change: plans.Change{
-					Action: plans.Delete,
-					Before: prevValue.Value,
-					After:  cty.NullVal(cty.DynamicPseudoType),
-				},
+				Action:    plans.Delete,
+				Before:    prevValue.Value,
+				After:     cty.NullVal(cty.DynamicPseudoType),
 			}
 
 			cs, err := change.Encode()
```

**File**: `internal/engine/planning/plan_managed.go` (modified, +6/-10)
```diff
@@ -449,11 +449,9 @@ func (p *planGlue) planDesiredManagedResourceInstance(
 		},
 		RequiredReplace: planResp.RequiresReplace,
 		Private:         planResp.Planned.Private,
-		Change: plans.Change{
-			Action: plannedAction,
-			Before: planResp.Current.Value,
-			After:  planResp.Planned.Value,
-		},
+		Action:          plannedAction,
+		Before:          planResp.Current.Value,
+		After:           planResp.Planned.Value,
 
 		// TODO: ActionReason, but need to figure out how to get the information
 		// we'd need for that into here since most of the reasons are
@@ -682,11 +680,9 @@ func (p *planGlue) planUnwantedManagedResourceInstanceObject(
 		},
 		RequiredReplace: planResp.RequiresReplace,
 		Private:         planResp.Planned.Private,
-		Change: plans.Change{
-			Action: plans.Delete,
-			Before: refreshedVal,
-			After:  planResp.Planned.Value,
-		},
+		Action:          plans.Delete,
+		Before:          refreshedVal,
+		After:           planResp.Planned.Value,
 
 		// TODO: ActionReason, but need to figure out how to get the information
 		// we'd need for that into here. For example, to report that the
```

**File**: `internal/lang/eval/config_dependencies.go` (modified, +1/-2)
```diff
@@ -14,8 +14,7 @@ import (
 	"github.com/opentofu/opentofu/internal/tfdiags"
 )
 
-type FindDependenciesGlue interface {
-}
+type FindDependenciesGlue any
 
 // FindDependencies evaluates the called configuration in a special limited mode
 // that aims only to learn which external module packages and providers this
```

**File**: `internal/lang/eval/internal/configgraph/provider_instance_ref.go` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ func ProviderInstanceRefType(provider addrs.Provider) cty.Type {
 		return existing
 	}
 
-	ty := cty.CapsuleWithOps("instance of "+provider.String(), reflect.TypeOf(ProviderInstance{}), &cty.CapsuleOps{
+	ty := cty.CapsuleWithOps("instance of "+provider.String(), reflect.TypeFor[ProviderInstance](), &cty.CapsuleOps{
 		TypeGoString: func(_ reflect.Type) string {
 			return fmt.Sprintf("configgraph.ProviderInstanceRefType(%#v)", provider)
 		},
```

**File**: `internal/lang/eval/internal/tofu2024/providers_sidechannel.go` (modified, +3/-5)
```diff
@@ -8,6 +8,7 @@ package tofu2024
 import (
 	"context"
 	"fmt"
+	"slices"
 	"sync"
 
 	"github.com/hashicorp/hcl/v2"
@@ -67,11 +68,8 @@ func compileProviderConfigRefMissingInRoot(
 		//
 		// TODO: only enable this during the validation pass and forbid for other operations
 		for _, required := range requiredProviders {
-			for _, alias := range required.Aliases {
-				if alias == providerInstAddr {
-					providerInstAddr.Alias = ""
-					break
-				}
+			if slices.Contains(required.Aliases, providerInstAddr) {
+				providerInstAddr.Alias = ""
 			}
 		}
 
```

---

### Incident Patch 10: `8d243e72` (2026-08-27)
**Commit Message**: Fix a typo in one of the log statements (#4524)

Signed-off-by: Andrei Ciobanu <[REDACTED_EMAIL]>

**File**: `internal/command/arguments/lint.go` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ func ParseLintingRules(rules []string) (collections.Set[linting.RuleAddr], colle
 		}
 		la, err := linting.ParseRuleAddr(rule)
 		if err != nil {
-			log.Printf("[WARN] Linting rule %q ignored since it's parsing failed: %s", rawRule, err)
+			log.Printf("[WARN] Linting rule %q ignored since its parsing failed: %s", rawRule, err)
 			continue
 		}
 		t[la] = struct{}{}
```

---

### Incident Patch 11: `700b5e22` (2026-08-26)
**Commit Message**: Lint warning and other small fixes (#4504)

Signed-off-by: Andrei Ciobanu <[REDACTED_EMAIL]>

**File**: `internal/command/apply.go` (modified, +3/-1)
```diff
@@ -79,6 +79,7 @@ func (c ApplyCommand) Execute(args *arguments.Apply, view views.Apply) int {
 	var diags tfdiags.Diagnostics
 	ctx := c.CommandContext()
 	ctx = tfdiags.ContextWithLintFilterHints(ctx, args.View.LintInclude, args.View.LintExclude)
+	diags = diags.Append(tfdiags.ExperimentalLintWarn(ctx))
 
 	// Check for user-supplied plugin path
 	var err error
@@ -97,7 +98,8 @@ func (c ApplyCommand) Execute(args *arguments.Apply, view views.Apply) int {
 	}
 
 	// Attempt to load the plan file, if specified
-	planFile, diags := c.LoadPlanFile(args.PlanPath, enc)
+	planFile, planDiags := c.LoadPlanFile(args.PlanPath, enc)
+	diags = diags.Append(planDiags)
 	if diags.HasErrors() {
 		view.Diagnostics(diags)
 		return 1
```

**File**: `internal/command/arguments/apply.go` (modified, +20/-4)
```diff
@@ -8,6 +8,8 @@ package arguments
 import (
 	"fmt"
 
+	"github.com/opentofu/opentofu/internal/collections"
+	"github.com/opentofu/opentofu/internal/linting"
 	"github.com/opentofu/opentofu/internal/plans"
 	"github.com/opentofu/opentofu/internal/tfdiags"
 )
@@ -33,10 +35,13 @@ type Apply struct {
 	SuppressForgetErrorsDuringDestroy bool
 }
 
-// BindApply registers CLI arguments, returning a Apply value and it's corresponding hooks.
-func BindApply(cli *CommandLine) *Apply {
+func bindApply(cli *CommandLine, withLinting bool) *Apply {
+	viewFlags := viewFlagAll
+	if withLinting {
+		viewFlags = viewFlags | viewFlagLint
+	}
 	apply := Apply{
-		View:      BindView(cli, viewFlagAll|viewFlagLint),
+		View:      BindView(cli, viewFlags),
 		Operation: BindOperation(cli),
 		Vars:      BindVars(cli),
 		State:     BindState(cli, stateFlagAll),
@@ -58,15 +63,26 @@ func BindApply(cli *CommandLine) *Apply {
 				"OpenTofu cannot ask for interactive approval when -json is set. You can either apply a saved plan file, or enable the -auto-approve option.",
 			))
 		}
+		// Linting is not meant to run during destroy since the graph generated by it is not as complete as most of the
+		// linting rules need to run properly.
+		if cli.Operation.PlanMode == plans.DestroyMode {
+			cli.View.LintExclude = collections.NewSet[linting.RuleAddr]()
+			cli.View.LintInclude = collections.NewSet[linting.RuleAddr]()
+		}
 		return nil
 	})
 
 	return &apply
 }
 
+// BindApply registers CLI arguments, returning a Apply value and it's corresponding hooks.
+func BindApply(cli *CommandLine) *Apply {
+	return bindApply(cli, true)
+}
+
 // BindApplyDestroy registers CLI arguments, returning a Apply value and it's corresponding hooks.
 func BindApplyDestroy(cli *CommandLine) *Apply {
-	apply := BindApply(cli)
+	apply := bindApply(cli, false)
 
 	cli.PreHook(func() tfdiags.Diagnostics {
 		// So far ParseApply was using the command line options like -destroy
```

**File**: `internal/command/arguments/apply_test.go` (modified, +54/-0)
```diff
@@ -87,6 +87,48 @@ func TestParseApply_basicValid(t *testing.T) {
 				},
 			},
 		},
+		"linting parsed correctly": {
+			[]string{"-lint=all"},
+			&Apply{
+				AutoApprove: false,
+				View: &View{
+					ConsolidateWarnings: true,
+					InputEnabled:        true,
+					ViewType:            ViewHuman,
+					LintInclude:         collections.NewSet(linting.AllRulesGroupID),
+					LintExclude:         make(collections.Set[linting.RuleAddr]),
+				},
+				PlanPath: "",
+				State:    &State{Lock: true},
+				Vars:     &Vars{},
+				Operation: &Operation{
+					PlanMode:    plans.NormalMode,
+					Parallelism: 10,
+					Refresh:     true,
+				},
+			},
+		},
+		"linting with destroy disables linting": {
+			[]string{"-lint=core:all", "-destroy"},
+			&Apply{
+				AutoApprove: false,
+				View: &View{
+					ConsolidateWarnings: true,
+					InputEnabled:        true,
+					ViewType:            ViewHuman,
+					LintInclude:         make(collections.Set[linting.RuleAddr]), // <- this is expected to be empty
+					LintExclude:         make(collections.Set[linting.RuleAddr]),
+				},
+				PlanPath: "",
+				State:    &State{Lock: true},
+				Vars:     &Vars{},
+				Operation: &Operation{
+					PlanMode:    plans.DestroyMode,
+					Parallelism: 10,
+					Refresh:     true,
+				},
+			},
+		},
 		"JSON view disables input": {
 			[]string{"-json", "-auto-approve"},
 			&Apply{
@@ -844,4 +886,16 @@ func TestParseApplyDestroy_invalid(t *testing.T) {
 			t.Fatalf("wrong view type, got %#v, want %#v", got.View.ViewType, ViewHuman)
 		}
 	})
+	t.Run("linting flag not recorded for destroy", func(t *testing.T) {
+		got, _, diags := ParseApplyDestroy([]string{"-lint=core:all"})
+		if len(diags) == 0 {
+			t.Fatal("expected diags but got none")
+		}
+		if got, want := diags.Err().Error(), "Failed to parse command-line options: flag provided but not defined: -lint"; !strings.Contains(got, want) {
+			t.Fatalf("wrong diags\n got: %s\nwant: %s", got, want)
+		}
+		if got.View.ViewType != ViewHuman {
+			t.Fatalf("wrong view type, got %#v, want %#v", got.View.ViewType, ViewHuman)
+		}
+	})
 }
```

**File**: `internal/command/arguments/plan.go` (modified, +12/-0)
```diff
@@ -6,6 +6,9 @@
 package arguments
 
 import (
+	"github.com/opentofu/opentofu/internal/collections"
+	"github.com/opentofu/opentofu/internal/linting"
+	"github.com/opentofu/opentofu/internal/plans"
 	"github.com/opentofu/opentofu/internal/tfdiags"
 )
 
@@ -65,6 +68,15 @@ OpenTofu may still attempt to write configuration if planning fails with an erro
 	}, {
 		Title: "Other Options:",
 	}}
+	cli.PreHook(func() tfdiags.Diagnostics {
+		// Linting is not meant to run during destroy since the graph generated by it is not as complete as most of the
+		// linting rules need to run properly.
+		if cli.Operation.PlanMode == plans.DestroyMode {
+			cli.View.LintExclude = collections.NewSet[linting.RuleAddr]()
+			cli.View.LintInclude = collections.NewSet[linting.RuleAddr]()
+		}
+		return nil
+	})
 
 	return &plan
 
```

**File**: `internal/command/arguments/plan_test.go` (modified, +42/-0)
```diff
@@ -66,6 +66,48 @@ func TestParsePlan_basicValid(t *testing.T) {
 				},
 			},
 		},
+		"linting flag correctly parsed": {
+			[]string{"-lint=core:all"},
+			&Plan{
+				DetailedExitCode: false,
+				View: &View{
+					ConsolidateWarnings: true,
+					InputEnabled:        true,
+					ViewType:            ViewHuman,
+					LintInclude:         collections.NewSet[linting.RuleAddr](linting.MustParseRuleAddr("core:all")),
+					LintExclude:         make(collections.Set[linting.RuleAddr]),
+				},
+				OutPath: "",
+				State:   &State{Lock: true},
+				Vars:    &Vars{},
+				Operation: &Operation{
+					PlanMode:    plans.NormalMode,
+					Parallelism: 10,
+					Refresh:     true,
+				},
+			},
+		},
+		"linting with destroy disables linting": {
+			[]string{"-lint=core:all", "-destroy"},
+			&Plan{
+				DetailedExitCode: false,
+				View: &View{
+					ConsolidateWarnings: true,
+					InputEnabled:        true,
+					ViewType:            ViewHuman,
+					LintInclude:         make(collections.Set[linting.RuleAddr]), // <- this is expected to be empty
+					LintExclude:         make(collections.Set[linting.RuleAddr]),
+				},
+				OutPath: "",
+				State:   &State{Lock: true},
+				Vars:    &Vars{},
+				Operation: &Operation{
+					PlanMode:    plans.DestroyMode,
+					Parallelism: 10,
+					Refresh:     true,
+				},
+			},
+		},
 		"JSON view disables input": {
 			[]string{"-json"},
 			&Plan{
```

**File**: `internal/command/arguments/refresh.go` (modified, +15/-2)
```diff
@@ -6,6 +6,9 @@
 package arguments
 
 import (
+	"github.com/opentofu/opentofu/internal/collections"
+	"github.com/opentofu/opentofu/internal/linting"
+	"github.com/opentofu/opentofu/internal/plans"
 	"github.com/opentofu/opentofu/internal/tfdiags"
 )
 
@@ -22,12 +25,22 @@ type Refresh struct {
 
 // BindRefresh registers CLI arguments, returning a Refresh value and it's corresponding hooks.
 func BindRefresh(cli *CommandLine) *Refresh {
-	return &Refresh{
-		View:      BindView(cli, viewFlagAll),
+	refresh := &Refresh{
+		View:      BindView(cli, viewFlagAll|viewFlagLint),
 		Vars:      BindVars(cli),
 		Operation: BindOperation(cli),
 		State:     BindState(cli, stateFlagAll),
 	}
+	cli.PreHook(func() tfdiags.Diagnostics {
+		// Linting is not meant to run during destroy since the graph generated by it is not as complete as most of the
+		// linting rules need to run properly.
+		if cli.Operation.PlanMode == plans.DestroyMode {
+			cli.View.LintExclude = collections.NewSet[linting.RuleAddr]()
+			cli.View.LintInclude = collections.NewSet[linting.RuleAddr]()
+		}
+		return nil
+	})
+	return refresh
 }
 
 // ParseRefresh processes CLI arguments, returning a Refresh value, a closer function, and errors.
```

**File**: `internal/command/arguments/refresh_test.go` (modified, +39/-11)
```diff
@@ -46,6 +46,32 @@ func TestParseRefresh_basicValid(t *testing.T) {
 				},
 			},
 		},
+		"linting flag correctly parsed": {
+			[]string{"-lint=core:all"},
+			&Refresh{
+				View: &View{
+					ConsolidateWarnings: true,
+					InputEnabled:        true,
+					ViewType:            ViewHuman,
+					LintInclude:         collections.NewSet[linting.RuleAddr](linting.MustParseRuleAddr("core:all")),
+					LintExclude:         make(collections.Set[linting.RuleAddr]),
+				},
+			},
+		},
+		"linting with destroy disables linting": {
+			[]string{"-lint=core:all", "-destroy"},
+			&Refresh{
+				View: &View{
+					ConsolidateWarnings: true,
+					InputEnabled:        true,
+					ViewType:            ViewHuman,
+					LintInclude:         make(collections.Set[linting.RuleAddr]), // <- this is expected to be empty
+					LintExclude:         make(collections.Set[linting.RuleAddr]),
+				},
+				// Since the LintInclude is empty, there is no need to check operation since that being empty means
+				// that the operation.planMode == destroy
+			},
+		},
 		"JSON view disables input": {
 			[]string{"-json"},
 			&Refresh{
@@ -66,7 +92,7 @@ func TestParseRefresh_basicValid(t *testing.T) {
 			if len(diags) > 0 {
 				t.Fatalf("unexpected diags: %v", diags)
 			}
-			// Ignore the extended arguments for simplicity
+			// Ignore the extended arguments for simplicity but not operation
 			got.State = nil
 			got.Operation = nil
 			got.Vars = nil
@@ -78,16 +104,18 @@ func TestParseRefresh_basicValid(t *testing.T) {
 }
 
 func TestParseRefresh_invalid(t *testing.T) {
-	got, _, diags := ParseRefresh([]string{"-frob"})
-	if len(diags) == 0 {
-		t.Fatal("expected diags but got none")
-	}
-	if got, want := diags.Err().Error(), "flag provided but not defined"; !strings.Contains(got, want) {
-		t.Fatalf("wrong diags\n got: %s\nwant: %s", got, want)
-	}
-	if got.View.ViewType != ViewHuman {
-		t.Fatalf("wrong view type, got %#v, want %#v", got.View.ViewType, ViewHuman)
-	}
+	t.Run("invalid flag provided", func(t *testing.T) {
+		got, _, diags := ParseRefresh([]string{"-frob"})
+		if len(diags) == 0 {
+			t.Fatal("expected diags but got none")
+		}
+		if got, want := diags.Err().Error(), "flag provided but not defined"; !strings.Contains(got, want) {
+			t.Fatalf("wrong diags\n got: %s\nwant: %s", got, want)
+		}
+		if got.View.ViewType != ViewHuman {
+			t.Fatalf("wrong view type, got %#v, want %#v", got.View.ViewType, ViewHuman)
+		}
+	})
 }
 
 func TestParseRefresh_tooManyArguments(t *testing.T) {
```

**File**: `internal/command/arguments/view.go` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ func BindView(cli *CommandLine, mask viewFlag) *View {
 	cli.StringArrayVar(&deprecation, "deprecation", nil, `Specify what type of warnings are shown. Accepted values for "m": all, local, none. Default: all. When "all" is selected, OpenTofu will show the deprecation warnings for all modules. When "local" is selected, the warns will be shown only for the modules that are imported with a relative path. When "none" is selected, all the deprecation warnings will be dropped.`).SetDisplay("=module:m").SetGlobal(true)
 	var lint []string
 	if mask&viewFlagLint != 0 {
-		cli.StringArrayVar(&lint, "lint", nil, `Specify the linting rules to be executed`).SetDisplay("=all").SetGlobal(true)
+		cli.StringArrayVar(&lint, "lint", nil, `Specify the linting rules to be executed. Wrongly formatted values are silently ignored.`).SetDisplay("=all").SetGlobal(true)
 	}
 
 	cli.PreHook(func() tfdiags.Diagnostics {
```

---

### Incident Patch 12: `0117d04b` (2026-08-26)
**Commit Message**: Linting - Initial skeleton and the necessary structures to build rules on top (#4337)

Signed-off-by: Andrei Ciobanu <[REDACTED_EMAIL]>

**File**: `internal/backend/testing.go` (modified, +8/-5)
```diff
@@ -23,14 +23,17 @@ import (
 	"github.com/opentofu/opentofu/internal/tfdiags"
 )
 
-func separateWarningsAndErrors(diags tfdiags.Diagnostics) ([]string, []error) {
+func separateWarningsAndErrors(t *testing.T, diags tfdiags.Diagnostics) ([]string, []error) {
 	warnings := make([]string, 0)
 	errors := make([]error, 0)
 	for _, diag := range diags {
-		if diag.Severity() == tfdiags.Warning {
+		switch s := diag.Severity(); s {
+		case tfdiags.Warning:
 			warnings = append(warnings, diag.Description().Summary)
-		} else if diag.Severity() == tfdiags.Error {
+		case tfdiags.Error:
 			errors = append(errors, fmt.Errorf("%s", diag.Description().Summary))
+		default:
+			t.Errorf("encountered %d diagnostic severity. Consider enhancing diagnostics separation if needed", s)
 		}
 	}
 	return warnings, errors
@@ -63,7 +66,7 @@ func TestBackendConfigWarningsAndErrors(t *testing.T, b Backend, c hcl.Body) (Ba
 
 	// it's valid for a Backend to have warnings (e.g. a Deprecation) as such we should only raise on errors
 	if len(diags) != 0 {
-		warnings, errors := separateWarningsAndErrors(diags)
+		warnings, errors := separateWarningsAndErrors(t, diags)
 		return nil, warnings, errors
 	}
 
@@ -72,7 +75,7 @@ func TestBackendConfigWarningsAndErrors(t *testing.T, b Backend, c hcl.Body) (Ba
 	confDiags := b.Configure(t.Context(), obj)
 	if len(confDiags) != 0 {
 		confDiags = confDiags.InConfigBody(c, "")
-		warnings, errors := separateWarningsAndErrors(confDiags)
+		warnings, errors := separateWarningsAndErrors(t, confDiags)
 		return nil, warnings, errors
 	}
 
```

**File**: `internal/collections/set.go` (modified, +15/-0)
```diff
@@ -73,3 +73,18 @@ func (s Set[T]) String() string {
 	})
 	return strings.Join(parts, ", ")
 }
+
+// Intersection returns the common items between the receiver and the given sets.
+func (s Set[T]) Intersection(other Set[T]) Set[T] {
+	result := NewSet[T]()
+	s1, s2 := s, other
+	if len(s1) > len(s2) {
+		s1, s2 = s2, s1
+	}
+	for item := range s1 {
+		if _, exists := s2[item]; exists {
+			result[item] = struct{}{}
+		}
+	}
+	return result
+}
```

**File**: `internal/collections/set_test.go` (modified, +80/-0)
```diff
@@ -98,3 +98,83 @@ func TestSet_string(t *testing.T) {
 		t.Fatalf("Incorrect string concatenation: %s", str)
 	}
 }
+
+func TestSet_intersection(t *testing.T) {
+	cases := map[string]struct {
+		given, second, wanted collections.Set[any]
+	}{
+		"string - same len": {
+			given:  collections.NewSet[any]("a", "b", "c"),
+			second: collections.NewSet[any]("c", "d", "e"),
+			wanted: collections.NewSet[any]("c"),
+		},
+		"string - given is greater in size": {
+			given:  collections.NewSet[any]("a", "b", "c", "d"),
+			second: collections.NewSet[any]("c", "d", "e"),
+			wanted: collections.NewSet[any]("c", "d"),
+		},
+		"string - second is greater in size": {
+			given:  collections.NewSet[any]("a", "b", "c"),
+			second: collections.NewSet[any]("b", "c", "d", "e"),
+			wanted: collections.NewSet[any]("b", "c"),
+		},
+		"string - no elements in common and given is greater in size": {
+			given:  collections.NewSet[any]("a", "b", "c"),
+			second: collections.NewSet[any]("d", "e"),
+			wanted: collections.NewSet[any](),
+		},
+		"string - no elements in common and second is greater in size": {
+			given:  collections.NewSet[any]("a", "b"),
+			second: collections.NewSet[any]("c", "d", "e"),
+			wanted: collections.NewSet[any](),
+		},
+		"int - same len": {
+			given:  collections.NewSet[any](1, 2, 3),
+			second: collections.NewSet[any](3, 4, 5),
+			wanted: collections.NewSet[any](3),
+		},
+		"int - given is greater in size": {
+			given:  collections.NewSet[any](1, 2, 3, 4),
+			second: collections.NewSet[any](3, 4, 5),
+			wanted: collections.NewSet[any](3, 4),
+		},
+		"int - second is greater in size": {
+			given:  collections.NewSet[any](1, 2, 3),
+			second: collections.NewSet[any](3, 4, 5, 6),
+			wanted: collections.NewSet[any](3),
+		},
+		"int - no elements in common and given is greater in size": {
+			given:  collections.NewSet[any](1, 2, 3),
+			second: collections.NewSet[any](4, 5),
+			wanted: collections.NewSet[any](),
+		},
+		"int - no elements in common and second is greater in size": {
+			given:  collections.NewSet[any](1, 2),
+			second: collections.NewSet[any](3, 4, 5),
+			wanted: collections.NewSet[any](),
+		},
+	}
+	for name, tc := range cases {
+		t.Run(name, func(t *testing.T) {
+			givenString := tc.given.String()
+			secondString := tc.second.String()
+			wantedString := tc.wanted.String()
+
+			got := tc.given.Intersection(tc.second)
+
+			gotString := got.String()
+			givenAfterString := tc.given.String()
+			secondAfterString := tc.second.String()
+
+			if wantedString != gotString {
+				t.Errorf("unexpected returned result: %s; wanted: %s", gotString, wantedString)
+			}
+			if givenString != givenAfterString {
+				t.Errorf("given shouldn't be changed during the operation but seems that it was. initial: %s; after: %s", givenString, givenAfterString)
+			}
+			if secondString != secondAfterString {
+				t.Errorf("second shouldn't be changed during the operation but seems that it was. initial: %s; after: %s", secondString, secondAfterString)
+			}
+		})
+	}
+}
```

**File**: `internal/command/apply.go` (modified, +9/-0)
```diff
@@ -78,6 +78,7 @@ func (c *ApplyCommand) Run(rawArgs []string) int {
 func (c ApplyCommand) Execute(args *arguments.Apply, view views.Apply) int {
 	var diags tfdiags.Diagnostics
 	ctx := c.CommandContext()
+	ctx = tfdiags.ContextWithLintFilterHints(ctx, args.View.LintInclude, args.View.LintExclude)
 
 	// Check for user-supplied plugin path
 	var err error
@@ -395,6 +396,14 @@ Options:
                                When "none" is selected, all the deprecation
                                warnings will be dropped.
 
+  -lint=all                    Configures the linting rules to be executed during
+                               this command. By specifying this flag, the built-in
+                               linting will be enabled, which will start issuing
+                               warning diagnostics if any included rule will be
+                               violated. For more details on the format and
+                               available linting rules, refer to the official
+                               documentation.
+
   If you don't provide a saved plan file then this command will also accept
   all of the plan-customization options accepted by the tofu plan command.
   For more information on those options, run:
```

**File**: `internal/command/arguments/apply.go` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ type Apply struct {
 // BindApply registers CLI arguments, returning a Apply value and it's corresponding hooks.
 func BindApply(cli *CommandLine) *Apply {
 	apply := Apply{
-		View:      BindView(cli, viewFlagAll),
+		View:      BindView(cli, viewFlagAll|viewFlagLint),
 		Operation: BindOperation(cli),
 		Vars:      BindVars(cli),
 		State:     BindState(cli, stateFlagAll),
```

**File**: `internal/command/arguments/apply_test.go` (modified, +14/-0)
```diff
@@ -10,6 +10,8 @@ import (
 	"testing"
 
 	"github.com/hashicorp/hcl/v2"
+	"github.com/opentofu/opentofu/internal/collections"
+	"github.com/opentofu/opentofu/internal/linting"
 	"github.com/opentofu/opentofu/internal/tfdiags"
 
 	"github.com/google/go-cmp/cmp"
@@ -30,6 +32,8 @@ func TestParseApply_basicValid(t *testing.T) {
 					ConsolidateWarnings: true,
 					InputEnabled:        true,
 					ViewType:            ViewHuman,
+					LintInclude:         make(collections.Set[linting.RuleAddr]),
+					LintExclude:         make(collections.Set[linting.RuleAddr]),
 				},
 				PlanPath: "",
 				State:    &State{Lock: true},
@@ -49,6 +53,8 @@ func TestParseApply_basicValid(t *testing.T) {
 					ConsolidateWarnings: true,
 					InputEnabled:        false,
 					ViewType:            ViewHuman,
+					LintInclude:         make(collections.Set[linting.RuleAddr]),
+					LintExclude:         make(collections.Set[linting.RuleAddr]),
 				},
 				PlanPath: "saved.tfplan",
 				State:    &State{Lock: true},
@@ -68,6 +74,8 @@ func TestParseApply_basicValid(t *testing.T) {
 					ConsolidateWarnings: true,
 					InputEnabled:        true,
 					ViewType:            ViewHuman,
+					LintInclude:         make(collections.Set[linting.RuleAddr]),
+					LintExclude:         make(collections.Set[linting.RuleAddr]),
 				},
 				PlanPath: "",
 				State:    &State{Lock: true},
@@ -87,6 +95,8 @@ func TestParseApply_basicValid(t *testing.T) {
 					ConsolidateWarnings: true,
 					InputEnabled:        false,
 					ViewType:            ViewJSON,
+					LintInclude:         make(collections.Set[linting.RuleAddr]),
+					LintExclude:         make(collections.Set[linting.RuleAddr]),
 				},
 				PlanPath: "",
 				State:    &State{Lock: true},
@@ -774,6 +784,8 @@ func TestParseApplyDestroy_basicValid(t *testing.T) {
 					ConsolidateWarnings: true,
 					InputEnabled:        true,
 					ViewType:            ViewHuman,
+					LintInclude:         make(collections.Set[linting.RuleAddr]),
+					LintExclude:         make(collections.Set[linting.RuleAddr]),
 				},
 				State: &State{Lock: true},
 				Vars:  &Vars{},
@@ -792,6 +804,8 @@ func TestParseApplyDestroy_basicValid(t *testing.T) {
 					ConsolidateWarnings: true,
 					InputEnabled:        false,
 					ViewType:            ViewHuman,
+					LintInclude:         make(collections.Set[linting.RuleAddr]),
+					LintExclude:         make(collections.Set[linting.RuleAddr]),
 				},
 				State: &State{Lock: true},
 				Vars:  &Vars{},
```

**File**: `internal/command/arguments/console_test.go` (modified, +4/-0)
```diff
@@ -13,6 +13,8 @@ import (
 
 	"github.com/google/go-cmp/cmp"
 	"github.com/google/go-cmp/cmp/cmpopts"
+	"github.com/opentofu/opentofu/internal/collections"
+	"github.com/opentofu/opentofu/internal/linting"
 )
 
 func TestParseConsole_basicValidation(t *testing.T) {
@@ -101,6 +103,8 @@ func consoleArgsWithDefaults(mutate func(console *Console)) *Console {
 			ConsolidateWarnings: true,
 			ViewType:            ViewHuman,
 			InputEnabled:        true,
+			LintInclude:         make(collections.Set[linting.RuleAddr]),
+			LintExclude:         make(collections.Set[linting.RuleAddr]),
 		},
 		Vars: &Vars{},
 		State: &State{
```

**File**: `internal/command/arguments/fmt_test.go` (modified, +4/-0)
```diff
@@ -9,6 +9,8 @@ import (
 	"testing"
 
 	"github.com/google/go-cmp/cmp"
+	"github.com/opentofu/opentofu/internal/collections"
+	"github.com/opentofu/opentofu/internal/linting"
 )
 
 func TestParseFmt_basicValidation(t *testing.T) {
@@ -110,6 +112,8 @@ func fmtArgsWithDefaults(mutate func(v *Fmt)) *Fmt {
 			ViewType:            ViewHuman,
 			InputEnabled:        false,
 			JSONInto:            nil,
+			LintInclude:         make(collections.Set[linting.RuleAddr]),
+			LintExclude:         make(collections.Set[linting.RuleAddr]),
 		},
 	}
 	if mutate != nil {
```

---

### Incident Patch 13: `a4f683ee` (2026-08-19)
**Commit Message**: command: go fix from Go 1.27

The command and command/arguments packages saw significant changes during
the v1.13 development period to prepare for using a different argument-
parsing library, and so our policy for when to run "go fix" calls for us
to make these changes now because backporting from these packages to
earlier release series is unlikely to be conflict-free already anyway.

Signed-off-by: Martin Atkins <[REDACTED_EMAIL]>

**File**: `internal/command/apply_test.go` (modified, +3/-5)
```diff
@@ -2561,11 +2561,9 @@ func applyFixturePlanFileMatchState(t *testing.T, stateMeta statemgr.SnapshotMet
 			Provider: addrs.NewDefaultProvider("test"),
 			Module:   addrs.RootModule,
 		},
-		ChangeSrc: plans.ChangeSrc{
-			Action: plans.Create,
-			Before: priorValRaw,
-			After:  plannedValRaw,
-		},
+		Action: plans.Create,
+		Before: priorValRaw,
+		After:  plannedValRaw,
 	})
 	return testPlanFileMatchState(
 		t,
```

**File**: `internal/command/arguments/init.go` (modified, +2/-2)
```diff
@@ -61,9 +61,9 @@ func BindInit(cli *CommandLine) *Init {
 		Vars:    BindVars(cli),
 		State:   BindState(cli, stateFlagLock),
 		Backend: BindBackendWithMigration(cli),
-	}
 
-	init.FlagConfigExtra = flagspkg.NewRawFlags("-backend-config")
+		FlagConfigExtra: flagspkg.NewRawFlags("-backend-config"),
+	}
 
 	backend := cli.BoolVar(&init.FlagBackend, "backend", true, "Disable backend or cloud backend initialization for this configuration and use what was previously initialized instead.").SetDisplay("=false")
 	cloud := cli.BoolVar(&init.FlagCloud, "cloud", true, "").SetHidden(true)
```

**File**: `internal/command/arguments/login.go` (modified, +4/-4)
```diff
@@ -28,11 +28,11 @@ func BindLogin(cli *CommandLine) *Login {
 		// Even though the command does not use the -var/-var-file content, we will keep this for the moment
 		// just to keep backwards compatibility for users (in case any of them are using these flags with this command)
 		Vars: BindVars(cli),
-	}
 
-	// State is only initialised and no flags are registered since the login command needs to lock the
-	// state by default, with no user input on that.
-	arguments.State = &State{Lock: true}
+		// State is only initialised and no flags are registered since the login command needs to lock the
+		// state by default, with no user input on that.
+		State: &State{Lock: true},
+	}
 
 	cli.ArgHelp = "The login command expects exactly one argument: the host to log in to."
 	cli.PositionalArg(&arguments.Host, "hostname", false)
```

**File**: `internal/command/command.go` (modified, +4/-4)
```diff
@@ -248,19 +248,19 @@ func CommandUsage(namespace string, cmd Command, w io.Writer) {
 	if cmd.UsageOverride.Usage != "" {
 		printHeader(fmt.Sprintf("Usage: %s\n", cmd.UsageOverride.Usage))
 	} else {
-		positionalArgs := ""
+		var positionalArgs strings.Builder
 		for _, arg := range cmd.CommandLine.Args {
 			name := arg.Name
 			if arg.Variadic {
 				name = name + "..."
 			}
 			if arg.Optional {
-				positionalArgs += fmt.Sprintf(" [%s]", name)
+				fmt.Fprintf(&positionalArgs, " [%s]", name)
 			} else {
-				positionalArgs += fmt.Sprintf(" <%s>", name)
+				fmt.Fprintf(&positionalArgs, " <%s>", name)
 			}
 		}
-		printHeader(fmt.Sprintf("Usage: tofu [global options] %s [options]%s\n", namespace+cmd.Name, positionalArgs))
+		printHeader(fmt.Sprintf("Usage: tofu [global options] %s [options]%s\n", namespace+cmd.Name, positionalArgs.String()))
 	}
 
 	if cmd.Long != "" {
```

**File**: `internal/command/command_test.go` (modified, +3/-5)
```diff
@@ -1251,11 +1251,9 @@ func TestVarsParsing(t *testing.T) {
 		t.Cleanup(testStdinPipe(t, strings.NewReader("var.foo\nvar.snack\n")))
 		streams, done := terminal.StreamsForTesting(t)
 		c := &ConsoleCommand{
-			Meta: Meta{
-				WorkingDir:       workdir.NewDir("."),
-				testingOverrides: metaOverridesForProvider(p),
-				View:             views.NewView(streams),
-			},
+			WorkingDir:       workdir.NewDir("."),
+			testingOverrides: metaOverridesForProvider(p),
+			View:             views.NewView(streams),
 		}
 
 		args := append([]string{"-no-color", "-lock=false"}, varArgs...)
```

**File**: `internal/command/graph_test.go` (modified, +3/-5)
```diff
@@ -121,11 +121,9 @@ func TestGraph_plan(t *testing.T) {
 			Type: "test_instance",
 			Name: "bar",
 		}.Instance(addrs.NoKey).Absolute(addrs.RootModuleInstance),
-		ChangeSrc: plans.ChangeSrc{
-			Action: plans.Delete,
-			Before: plans.DynamicValue(`{}`),
-			After:  plans.DynamicValue(`null`),
-		},
+		Action: plans.Delete,
+		Before: plans.DynamicValue(`{}`),
+		After:  plans.DynamicValue(`null`),
 		ProviderAddr: addrs.AbsProviderConfig{
 			Provider: addrs.NewDefaultProvider("test"),
 			Module:   addrs.RootModule,
```

**File**: `internal/command/login_test.go` (modified, +13/-19)
```diff
@@ -101,12 +101,10 @@ func TestLogin(t *testing.T) {
 			})
 
 			c := &LoginCommand{
-				Meta: Meta{
-					WorkingDir:      workdir.NewDir("."),
-					View:            loginView,
-					BrowserLauncher: browserLauncher,
-					Services:        svcs,
-				},
+				WorkingDir:      workdir.NewDir("."),
+				View:            loginView,
+				BrowserLauncher: browserLauncher,
+				Services:        svcs,
 			}
 
 			test(t, c, loginDone)
@@ -418,13 +416,11 @@ func TestLoginOAuthCallbackRace(t *testing.T) {
 
 			abortCh := make(chan struct{})
 			c := &LoginCommand{
-				Meta: Meta{
-					WorkingDir:      workdir.NewDir("."),
-					View:            loginView,
-					BrowserLauncher: webbrowser.NewMockLauncher(ctx),
-					Services:        svcs,
-					ShutdownCh:      abortCh,
-				},
+				WorkingDir:      workdir.NewDir("."),
+				View:            loginView,
+				BrowserLauncher: webbrowser.NewMockLauncher(ctx),
+				Services:        svcs,
+				ShutdownCh:      abortCh,
 			}
 
 			defer testInputMap(t, map[string]string{
@@ -495,12 +491,10 @@ func TestLoginOAuthCallbackNoPanicOnAbort(t *testing.T) {
 			// is the only way to unblock the command.
 			abortCh := make(chan struct{})
 			c := &LoginCommand{
-				Meta: Meta{
-					WorkingDir: workdir.NewDir("."),
-					View:       loginView,
-					Services:   svcs,
-					ShutdownCh: abortCh,
-				},
+				WorkingDir: workdir.NewDir("."),
+				View:       loginView,
+				Services:   svcs,
+				ShutdownCh: abortCh,
 			}
 
 			defer testInputMap(t, map[string]string{
```

**File**: `internal/command/logout_test.go` (modified, +10/-14)
```diff
@@ -27,13 +27,11 @@ func TestLogout(t *testing.T) {
 	t.Run("with no hostname", func(t *testing.T) {
 		logoutView, logoutDone := testView(t)
 		c := &LogoutCommand{
-			Meta: Meta{
-				WorkingDir: workdir.NewDir("."),
-				View:       logoutView,
-				Services: disco.New(
-					disco.WithCredentials(credsSrc),
-				),
-			},
+			WorkingDir: workdir.NewDir("."),
+			View:       logoutView,
+			Services: disco.New(
+				disco.WithCredentials(credsSrc),
+			),
 		}
 		status := c.Run([]string{})
 		output := logoutDone(t)
@@ -76,13 +74,11 @@ func TestLogout(t *testing.T) {
 			}
 			logoutView, logoutDone := testView(t)
 			c := &LogoutCommand{
-				Meta: Meta{
-					WorkingDir: workdir.NewDir("."),
-					View:       logoutView,
-					Services: disco.New(
-						disco.WithCredentials(credsSrc),
-					),
-				},
+				WorkingDir: workdir.NewDir("."),
+				View:       logoutView,
+				Services: disco.New(
+					disco.WithCredentials(credsSrc),
+				),
 			}
 			status := c.Run(tc.args)
 			output := logoutDone(t)
```

---

### Incident Patch 14: `172bffd1` (2026-08-20)
**Commit Message**: various: Use fmt.Fprintf to write fmt output to strings.Builder

Using fmt.Sprintf to produce a value for buf.WriteString was always a
little silly, but now it's both a little silly _and_ it's a lint failure in
latest versions of golangci-lint, so let's fix these all now so we can
upgrade.

This is just a systematic rewrite following the same pattern for every
change. I applied it automatically using global search and replace, after
verifying that the proposed changes seemed sensible.

Signed-off-by: Martin Atkins <[REDACTED_EMAIL]>

**File**: `cmd/tofu/help.go` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ func listCommands(allCommands map[string]cli.CommandFactory, order []string, max
 		}
 
 		key = fmt.Sprintf("%s%s", key, strings.Repeat(" ", maxKeyLen-len(key)))
-		buf.WriteString(fmt.Sprintf("  %s  %s\n", key, command.Synopsis()))
+		fmt.Fprintf(&buf, "  %s  %s\n", key, command.Synopsis())
 	}
 
 	return buf.String()
```

**File**: `internal/addrs/parse_ref.go` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ func (r *Reference) DisplayString() string {
 			ret.WriteByte('[')
 			switch tStep.Key.Type() {
 			case cty.String:
-				ret.WriteString(fmt.Sprintf("%q", tStep.Key.AsString()))
+				fmt.Fprintf(&ret, "%q", tStep.Key.AsString())
 			case cty.Number:
 				bf := tStep.Key.AsBigFloat()
 				ret.WriteString(bf.Text('g', 10))
```

**File**: `internal/addrs/traversal.go` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ func TraversalStr(traversal hcl.Traversal) string {
 			buf.WriteByte('[')
 			switch tStep.Key.Type() {
 			case cty.String:
-				buf.WriteString(fmt.Sprintf("%q", tStep.Key.AsString()))
+				fmt.Fprintf(&buf, "%q", tStep.Key.AsString())
 			case cty.Number:
 				bf := tStep.Key.AsBigFloat()
 				buf.WriteString(bf.Text('g', 10))
```

**File**: `internal/backend/remote-state/s3/backend.go` (modified, +2/-2)
```diff
@@ -1159,12 +1159,12 @@ func pathString(path cty.Path) string {
 			default:
 				s = fmt.Sprintf("<unexpected index: %s>", typ.FriendlyName())
 			}
-			buf.WriteString(fmt.Sprintf("[%s]", s))
+			fmt.Fprintf(&buf, "[%s]", s)
 		default:
 			if i != 0 {
 				buf.WriteString(".")
 			}
-			buf.WriteString(fmt.Sprintf("<unexpected step: %[1]T %[1]v>", x))
+			fmt.Fprintf(&buf, "<unexpected step: %[1]T %[1]v>", x)
 		}
 	}
 	return buf.String()
```

**File**: `internal/command/format/diagnostic.go` (modified, +7/-7)
```diff
@@ -216,29 +216,29 @@ func DiagnosticWarningsCompact(diags tfdiags.Diagnostics, color *colorstring.Col
 	b.WriteString(color.Color("[bold][yellow]Warnings:[reset]\n\n"))
 	for _, diag := range diags {
 		sources := tfdiags.ConsolidatedGroupSourceRanges(diag)
-		b.WriteString(fmt.Sprintf("- %s\n", diag.Description().Summary))
+		fmt.Fprintf(&b, "- %s\n", diag.Description().Summary)
 		if len(sources) > 0 {
 			mainSource := sources[0]
 			if mainSource.Subject != nil {
 				if len(sources) > 1 {
-					b.WriteString(fmt.Sprintf(
+					fmt.Fprintf(&b,
 						"  on %s line %d (and %d more)\n",
 						mainSource.Subject.Filename,
 						mainSource.Subject.Start.Line,
 						len(sources)-1,
-					))
+					)
 				} else {
-					b.WriteString(fmt.Sprintf(
+					fmt.Fprintf(&b,
 						"  on %s line %d\n",
 						mainSource.Subject.Filename,
 						mainSource.Subject.Start.Line,
-					))
+					)
 				}
 			} else if len(sources) > 1 {
-				b.WriteString(fmt.Sprintf(
+				fmt.Fprintf(&b,
 					"  (%d occurrences of this warning)\n",
 					len(sources),
-				))
+				)
 			}
 		}
 	}
```

**File**: `internal/command/jsonformat/computed/renderers/block.go` (modified, +10/-10)
```diff
@@ -75,15 +75,15 @@ func (renderer blockRenderer) RenderHuman(diff computed.Diff, indent int, opts c
 	attributeOpts := opts.Clone()
 
 	var buf bytes.Buffer
-	buf.WriteString(fmt.Sprintf("{%s\n", forcesReplacement(diff.Replace, opts)))
+	fmt.Fprintf(&buf, "{%s\n", forcesReplacement(diff.Replace, opts))
 	for _, key := range attributeKeys {
 		attribute := renderer.attributes[key]
 		if importantAttribute(key) {
 			// Always display the important attributes.
 			for _, warning := range attribute.WarningsHuman(indent+1, importantAttributeOpts) {
-				buf.WriteString(fmt.Sprintf("%s%s\n", formatIndent(indent+1), warning))
+				fmt.Fprintf(&buf, "%s%s\n", formatIndent(indent+1), warning)
 			}
-			buf.WriteString(fmt.Sprintf("%s%s%-*s = %s\n", formatIndent(indent+1), writeDiffActionSymbol(attribute.Action, importantAttributeOpts), maximumAttributeKeyLen, key, attribute.RenderHuman(indent+1, importantAttributeOpts)))
+			fmt.Fprintf(&buf, "%s%s%-*s = %s\n", formatIndent(indent+1), writeDiffActionSymbol(attribute.Action, importantAttributeOpts), maximumAttributeKeyLen, key, attribute.RenderHuman(indent+1, importantAttributeOpts))
 			continue
 		}
 		if attribute.Action == plans.NoOp && !opts.ShowUnchangedChildren {
@@ -92,13 +92,13 @@ func (renderer blockRenderer) RenderHuman(diff computed.Diff, indent int, opts c
 		}
 
 		for _, warning := range attribute.WarningsHuman(indent+1, opts) {
-			buf.WriteString(fmt.Sprintf("%s%s\n", formatIndent(indent+1), warning))
+			fmt.Fprintf(&buf, "%s%s\n", formatIndent(indent+1), warning)
 		}
-		buf.WriteString(fmt.Sprintf("%s%s%-*s = %s\n", formatIndent(indent+1), writeDiffActionSymbol(attribute.Action, attributeOpts), maximumAttributeKeyLen, escapedAttributeKeys[key], attribute.RenderHuman(indent+1, attributeOpts)))
+		fmt.Fprintf(&buf, "%s%s%-*s = %s\n", formatIndent(indent+1), writeDiffActionSymbol(attribute.Action, attributeOpts), maximumAttributeKeyLen, escapedAttributeKeys[key], attribute.RenderHuman(indent+1, attributeOpts))
 	}
 
 	if unchangedAttributes > 0 {
-		buf.WriteString(fmt.Sprintf("%s%s%s\n", formatIndent(indent+1), writeDiffActionSymbol(plans.NoOp, opts), unchanged("attribute", unchangedAttributes, opts)))
+		fmt.Fprintf(&buf, "%s%s%s\n", formatIndent(indent+1), writeDiffActionSymbol(plans.NoOp, opts), unchanged("attribute", unchangedAttributes, opts))
 	}
 
 	blockKeys := renderer.blocks.GetAllKeys()
@@ -140,9 +140,9 @@ func (renderer blockRenderer) RenderHuman(diff computed.Diff, indent int, opts c
 			blockOpts.OverrideForcesReplacement = renderer.blocks.ReplaceBlocks[key]
 
 			for _, warning := range diff.WarningsHuman(indent+1, blockOpts) {
-				buf.WriteString(fmt.Sprintf("%s%s\n", formatIndent(indent+1), warning))
+				fmt.Fprintf(&buf, "%s%s\n", formatIndent(indent+1), warning)
 			}
-			buf.WriteString(fmt.Sprintf("%s%s%s%s %s\n", formatIndent(indent+1), writeDiffActionSymbol(diff.Action, blockOpts), EnsureValidAttributeName(key), mapKey, diff.RenderHuman(indent+1, blockOpts)))
+			fmt.Fprintf(&buf, "%s%s%s%s %s\n", formatIndent(indent+1), writeDiffActionSymbol(diff.Action, blockOpts), EnsureValidAttributeName(key), mapKey, diff.RenderHuman(indent+1, blockOpts))
 		}
 
 		switch {
@@ -173,9 +173,9 @@ func (renderer blockRenderer) RenderHuman(diff computed.Diff, indent int, opts c
 	}
 
 	if unchangedBlocks > 0 {
-		buf.WriteString(fmt.Sprintf("\n%s%s%s\n", formatIndent(indent+1), writeDiffActionSymbol(plans.NoOp, opts), unchanged("block", unchangedBlocks, opts)))
+		fmt.Fprintf(&buf, "\n%s%s%s\n", formatIndent(indent+1), writeDiffActionSymbol(plans.NoOp, opts), unchanged("block", unchangedBlocks, opts))
 	}
 
-	buf.WriteString(fmt.Sprintf("%s%s}", formatIndent(indent), writeDiffActionSymbol(plans.NoOp, opts)))
+	fmt.Fprintf(&buf, "%s%s}", formatIndent(indent), writeDiffActionSymbol(plans.NoOp, opts))
 	return buf.String()
 }
```

**File**: `internal/command/jsonformat/computed/renderers/list.go` (modified, +7/-7)
```diff
@@ -54,7 +54,7 @@ func (renderer listRenderer) RenderHuman(diff computed.Diff, indent int, opts co
 	renderNext := false
 
 	var buf bytes.Buffer
-	buf.WriteString(fmt.Sprintf("[%s\n", forcesReplacement(diff.Replace, opts)))
+	fmt.Fprintf(&buf, "[%s\n", forcesReplacement(diff.Replace, opts))
 	for _, element := range renderer.elements {
 		if element.Action == plans.NoOp && !renderNext && !opts.ShowUnchangedChildren {
 			unchangedElements = append(unchangedElements, element)
@@ -76,14 +76,14 @@ func (renderer listRenderer) RenderHuman(diff computed.Diff, indent int, opts co
 			// minus 1 as the most recent unchanged element will be printed out
 			// in full.
 			if len(unchangedElements) > 1 {
-				buf.WriteString(fmt.Sprintf("%s%s%s\n", formatIndent(indent+1), writeDiffActionSymbol(plans.NoOp, opts), unchanged("element", len(unchangedElements)-1, opts)))
+				fmt.Fprintf(&buf, "%s%s%s\n", formatIndent(indent+1), writeDiffActionSymbol(plans.NoOp, opts), unchanged("element", len(unchangedElements)-1, opts))
 			}
 			// If our list of unchanged elements contains at least one entry,
 			// we're going to print out the most recent change in full. That's
 			// what happens here.
 			if len(unchangedElements) > 0 {
 				lastElement := unchangedElements[len(unchangedElements)-1]
-				buf.WriteString(fmt.Sprintf("%s%s%s,\n", formatIndent(indent+1), writeDiffActionSymbol(lastElement.Action, unchangedElementOpts), lastElement.RenderHuman(indent+1, unchangedElementOpts)))
+				fmt.Fprintf(&buf, "%s%s%s,\n", formatIndent(indent+1), writeDiffActionSymbol(lastElement.Action, unchangedElementOpts), lastElement.RenderHuman(indent+1, unchangedElementOpts))
 			}
 			// We now reset the unchanged elements list, we've printed out a
 			// count of all the elements we skipped so we start counting from
@@ -109,9 +109,9 @@ func (renderer listRenderer) RenderHuman(diff computed.Diff, indent int, opts co
 		}
 
 		for _, warning := range element.WarningsHuman(indent+1, opts) {
-			buf.WriteString(fmt.Sprintf("%s%s\n", formatIndent(indent+1), warning))
+			fmt.Fprintf(&buf, "%s%s\n", formatIndent(indent+1), warning)
 		}
-		buf.WriteString(fmt.Sprintf("%s%s%s,\n", formatIndent(indent+1), writeDiffActionSymbol(element.Action, opts), element.RenderHuman(indent+1, opts)))
+		fmt.Fprintf(&buf, "%s%s%s,\n", formatIndent(indent+1), writeDiffActionSymbol(element.Action, opts), element.RenderHuman(indent+1, opts))
 	}
 
 	// If we were not displaying any context alongside our changes then the
@@ -121,9 +121,9 @@ func (renderer listRenderer) RenderHuman(diff computed.Diff, indent int, opts co
 	// If we were displaying context, then this will contain any unchanged
 	// elements since our last change, so we should also print it out.
 	if len(unchangedElements) > 0 {
-		buf.WriteString(fmt.Sprintf("%s%s%s\n", formatIndent(indent+1), writeDiffActionSymbol(plans.NoOp, opts), unchanged("element", len(unchangedElements), opts)))
+		fmt.Fprintf(&buf, "%s%s%s\n", formatIndent(indent+1), writeDiffActionSymbol(plans.NoOp, opts), unchanged("element", len(unchangedElements), opts))
 	}
 
-	buf.WriteString(fmt.Sprintf("%s%s]%s", formatIndent(indent), writeDiffActionSymbol(plans.NoOp, opts), nullSuffix(diff.Action, opts)))
+	fmt.Fprintf(&buf, "%s%s]%s", formatIndent(indent), writeDiffActionSymbol(plans.NoOp, opts), nullSuffix(diff.Action, opts))
 	return buf.String()
 }
```

**File**: `internal/command/jsonformat/computed/renderers/map.go` (modified, +6/-6)
```diff
@@ -75,7 +75,7 @@ func (renderer mapRenderer) RenderHuman(diff computed.Diff, indent int, opts com
 	elementOpts.OverrideForcesReplacement = forcesReplacementChildren
 
 	var buf bytes.Buffer
-	buf.WriteString(fmt.Sprintf("{%s\n", forcesReplacement(forcesReplacementSelf, opts)))
+	fmt.Fprintf(&buf, "{%s\n", forcesReplacement(forcesReplacementSelf, opts))
 	for _, key := range keys {
 		element := renderer.elements[key]
 
@@ -86,7 +86,7 @@ func (renderer mapRenderer) RenderHuman(diff computed.Diff, indent int, opts com
 		}
 
 		for _, warning := range element.WarningsHuman(indent+1, opts) {
-			buf.WriteString(fmt.Sprintf("%s%s\n", formatIndent(indent+1), warning))
+			fmt.Fprintf(&buf, "%s%s\n", formatIndent(indent+1), warning)
 		}
 		// Only show commas between elements for objects.
 		comma := ""
@@ -95,17 +95,17 @@ func (renderer mapRenderer) RenderHuman(diff computed.Diff, indent int, opts com
 		}
 
 		if renderer.alignKeys {
-			buf.WriteString(fmt.Sprintf("%s%s%-*s = %s%s\n", formatIndent(indent+1), writeDiffActionSymbol(element.Action, elementOpts), maximumKeyLen, escapedKeys[key], element.RenderHuman(indent+1, elementOpts), comma))
+			fmt.Fprintf(&buf, "%s%s%-*s = %s%s\n", formatIndent(indent+1), writeDiffActionSymbol(element.Action, elementOpts), maximumKeyLen, escapedKeys[key], element.RenderHuman(indent+1, elementOpts), comma)
 		} else {
-			buf.WriteString(fmt.Sprintf("%s%s%s = %s%s\n", formatIndent(indent+1), writeDiffActionSymbol(element.Action, elementOpts), escapedKeys[key], element.RenderHuman(indent+1, elementOpts), comma))
+			fmt.Fprintf(&buf, "%s%s%s = %s%s\n", formatIndent(indent+1), writeDiffActionSymbol(element.Action, elementOpts), escapedKeys[key], element.RenderHuman(indent+1, elementOpts), comma)
 		}
 
 	}
 
 	if unchangedElements > 0 {
-		buf.WriteString(fmt.Sprintf("%s%s%s\n", formatIndent(indent+1), writeDiffActionSymbol(plans.NoOp, opts), unchanged("element", unchangedElements, opts)))
+		fmt.Fprintf(&buf, "%s%s%s\n", formatIndent(indent+1), writeDiffActionSymbol(plans.NoOp, opts), unchanged("element", unchangedElements, opts))
 	}
 
-	buf.WriteString(fmt.Sprintf("%s%s}%s", formatIndent(indent), writeDiffActionSymbol(plans.NoOp, opts), nullSuffix(diff.Action, opts)))
+	fmt.Fprintf(&buf, "%s%s}%s", formatIndent(indent), writeDiffActionSymbol(plans.NoOp, opts), nullSuffix(diff.Action, opts))
 	return buf.String()
 }
```

---

### Incident Patch 15: `5dce58e7` (2026-08-20)
**Commit Message**: lang/funcs: Quiet linter about use of deprecated PKCS #1 v1.5 decrypt

Although this encryption algorithm is deprecated for good reason, our own
wrapper around it is protected by OpenTofu's compatibility promises and so
we cannot just remove it or change its behavior unilaterally.

The focus of this commit is just to quiet the lint failure about the use of
the deprecated function, but in followup work we should decide what the
future of our "rsadecrypt" function should actually be: whether it's
possible to somehow migrate it in-place to a different algorithm (unlikely)
or if we just need to mark it as deprecated in our own documentation, and
possibly generate a lint warning about it.

Signed-off-by: Martin Atkins <[REDACTED_EMAIL]>

**File**: `internal/lang/funcs/crypto.go` (modified, +6/-0)
```diff
@@ -184,6 +184,12 @@ var RsaDecryptFunc = function.New(&function.Spec{
 			return cty.UnknownVal(cty.String), function.NewArgErrorf(1, "invalid private key type %t", rawKey)
 		}
 
+		// TODO: Consider whether there's any possible migration path away from
+		// using PKCS #1 v1.5 here without breaking compatibility. If not, then
+		// we should echo the upstream deprecation by documenting that our own
+		// rsadecrypt function is deprecated too. For now though, we'll just
+		// quiet the linter.
+		//nolint:staticcheck // The upstream function is deprecated, but the behavior of our rsadecrypt function is protected by compatibility promises
 		out, err := rsa.DecryptPKCS1v15(nil, privateKey, b)
 		if err != nil {
 			return cty.UnknownVal(cty.String), fmt.Errorf("failed to decrypt: %w", err)
```

#### Recent Merged Pull Requests:
- **PR #4628** (2026-10-01): CHANGELOG: Prepare for v1.13.2 (@apparentlymart)
- **PR #4627** (2026-10-01): CHANGELOG: Prepare for v1.12.8 (@apparentlymart)
- **PR #4626** (2026-10-01): CHANGELOG: Prepare for v1.12.7 release (@apparentlymart)
- **PR #4625** (2026-10-01): 4623 backport to v1.13.1 (@cam72cam)
- **PR #4623** (2026-10-01): Embed ephemeral resources schema in the plan embedded schema (@yottta)
- **PR #4621** (2026-10-02): tracing: Honor standard OTEL_RESOURCE_ATTRIBUTES env var (@apparentlymart)
- **PR #4618** (closed): Updating the tofu providers mirror command to generate JSON files with "use_mirror_credentials":true (@Aniket1260)
- **PR #4616** (2026-09-30): Bump version v1.13.0 (@cam72cam)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

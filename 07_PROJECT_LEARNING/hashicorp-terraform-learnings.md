# Forensic Learning Record (Deep Inspection): hashicorp/terraform

> **Canonical Artifact**: `07_PROJECT_LEARNING/hashicorp-terraform-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hashicorp/terraform](https://github.com/hashicorp/terraform))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:49:35.698Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hashicorp/terraform`
- **Description**: Terraform enables you to safely and predictably create, change, and improve infrastructure. It is a source-available tool that codifies APIs into declarative configuration files that can be shared amongst team members, treated as code, edited, reviewed, and versioned.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 49830 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/backend/local/hook_state.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package local

import (
	"log"
	"sync"
	"time"

	"github.com/hashicorp/terraform/internal/schemarepo"
	"github.com/hashicorp/terraform/internal/states"
	"github.com/hashicorp/terraform/internal/states/statemgr"
	"github.com/hashicorp/terraform/internal/terraform"
)

// StateHook is a hook that continuously updates the state by calling
// WriteState on a statemgr.Full.
type StateHook struct {
	terraform.NilHook
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
	Schemas *schemarepo.Schemas

	intermediatePersist statemgr.IntermediateStatePersistInfo
}

var _ terraform.Hook = (*StateHook)(nil)

func (h *StateHook) PostStateUpdate(new *states.State) (terraform.HookAction, error) {
	h.Lock()
	defer h.Unlock()

	h.intermediatePersist.RequestedPersistInterval = h.PersistInterval

	if h.intermediatePersist.LastPersist.IsZero() {
		// The first PostStateUpdate starts the clock for intermediate
		// calls to PersistState.
		h.intermediatePersist.LastPersist = time.Now()
	}

	if h.StateMgr != nil {
		if err := h.StateMgr.WriteState(new); err != nil {
			return terraform.HookActionHalt, err
		}
		if mgrPersist, ok := h.StateMgr.(statemgr.Persister); ok && h.PersistInterval != 0 && h.Schemas != nil {
			if h.shouldPersist() {
				err := mgrPersist.PersistState(h.Schemas)
				if err != nil {
					return terraform.HookActionHalt, err
				}
				h.intermediatePersist.LastPersist = time.Now()
			} else {
				log.Printf("[DEBUG] State storage %T declined to persist a state snapshot", h.StateMgr)
			}
		}
	}

	return terraform.HookActionContinue, nil
}

func (h *StateHook) Stopping() {
	h.Lock()
	defer h.Unlock()

	// If Terraform has been asked to stop then that might mean that a hard
	// kill signal will follow shortly in case Terraform doesn't stop
	// quickly enough, and so we'll try to persist the latest state
	// snapshot in the hope that it'll give the user less recovery work to
	// do if they _do_ subsequently hard-kill Terraform during an apply.

	if mgrPersist, ok := h.StateMgr.(statemgr.Persister); ok && h.Schemas != nil {
		// While we're in the stopping phase we'll try to persist every
		// new state update to maximize every opportunity we get to avoid
		// losing track of objects that have been created or updated.
		// Terraform Core won't start any new operations after it's been
		// stopped, so at most we should see one more PostStateUpdate
		// call per already-active request.
		h.intermediatePersist.ForcePersist = true

		if h.shouldPersist() {
			err := mgrPersist.PersistState(h.Schemas)
			if err != nil {
				// This hook can't affect Terraform Core's ongoing behavior,
				// but it's a best effort thing anyway so we'll just emit a
				// log to aid with debugging.
				log.Printf("[ERROR] Failed to persist state after interruption: %s", err)
			}
		} else {
			log.Printf("[DEBUG] State storage %T declined to persist a state snapshot", h.StateMgr)
		}
	}

}

func (h *StateHook) shouldPersist() bool {
	if m, ok := h.StateMgr.(statemgr.IntermediateStateConditionalPersister); ok {
		return m.ShouldPersistIntermediateState(&h.intermediatePersist)
	}
	return statemgr.DefaultIntermediateStatePersistRule(&h.intermediatePersist)
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/api_client.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package azure

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/hashicorp/go-azure-helpers/resourcemanager/commonids"
	"github.com/hashicorp/go-azure-sdk/resource-manager/storage/2023-01-01/storageaccounts"
	"github.com/hashicorp/go-azure-sdk/sdk/auth"
	"github.com/hashicorp/go-azure-sdk/sdk/client"
	"github.com/hashicorp/go-azure-sdk/sdk/environments"
	"github.com/hashicorp/terraform/internal/httpclient"
	"github.com/hashicorp/terraform/version"
	"github.com/jackofallops/giovanni/storage/2023-11-03/blob/blobs"
	"github.com/jackofallops/giovanni/storage/2023-11-03/blob/containers"
)

type Client struct {
	environment        environments.Environment
	storageAccountName string

	// Storage ARM client is used for looking up the blob endpoint, or/and listing access key (if not specified).
	storageAccountsClient *storageaccounts.StorageAccountsClient
	// This is only non-nil if the config has specified to lookup the blob endpoint
	accountDetail *AccountDetails

	// Caching
	containersClient *containers.Client
	blobsClient      *blobs.Client

	// Only one of them shall be specified
	accessKey          string
	sasToken           string
	azureAdStorageAuth auth.Authorizer
}

func buildClient(ctx context.Context, config BackendConfig) (*Client, error) {
	client := Client{
		environment:        config.AuthConfig.Environment,
		storageAccountName: config.StorageAccountName,
	}

	var armAuthRequired bool
	switch {
	case config.AccessKey != "":
		client.accessKey = config.AccessKey
	case config.SasToken != "":
		sasToken := config.SasToken
		if strings.TrimSpace(sasToken) == "" {
			return nil, fmt.Errorf("sasToken cannot be empty")
		}
		client.sasToken = strings.TrimPrefix(sasToken, "?")
	case config.UseAzureADAuthentication:
		var err error
		client.azureAdStorageAuth, err = auth.NewAuthorizerFromCredentials(ctx, *config.AuthConfig, config.AuthConfig.Environment.Storage)
		if err != nil {
			return nil, fmt.Errorf("unable to build authorizer for Storage API: %+v", err)
		}
	default:
		// AAD authentication (ARM scope) is required only when no auth method is specified, which falls back to listing the access key via ARM API.
		armAuthRequired = true
	}

	// If `config.LookupBlobEndpoint` is true, we need to authenticate with ARM to lookup the blob endpoint
	if config.LookupBlobEndpoint {
		armAuthRequired = true
	}

	if armAuthRequired {
		resourceManagerAuth, err := auth.NewAuthorizerFromCredentials(ctx, *config.AuthConfig, config.AuthConfig.Environment.ResourceManager)
		if err != nil {
			return nil, fmt.Errorf("unable to build authorizer for Resource Manager API: %+v", err)
		}

		// When using Azure CLI to auth, the user can leave the "subscription_id" unspecified. In this case the subscription id is inferred from
		// the Azure CLI default subscription.
		if config.SubscriptionID == "" {
			if cachedAuth, ok := resourceManagerAuth.(*auth.CachedAuthorizer); ok {
				if cliAuth, ok := cachedAuth.Source.(*auth.AzureCliAuthorizer); ok && cliAuth.DefaultSubscriptionID != "" {
					config.SubscriptionID = cliAuth.DefaultSubscriptionID
				}
			}
		}
		if config.SubscriptionID == "" {
			return nil, fmt.Errorf("subscription id not specified")
		}

		// Setup the SA client.
		client.storageAccountsClient, err = storageaccounts.NewStorageAccountsClientWithBaseURI(config.AuthConfig.Environment.ResourceManager)
		if err != nil {
			return nil, fmt.Errorf("building Storage Accounts client: %+v", err)
		}
		client.configureClient(client.storageAccountsClient.Client, resourceManagerAuth)

		// Populating the storage account detail
		storageAccountId := commonids.NewStorageAccountID(config.SubscriptionID, config.ResourceGroupName, client.storageAccountName)
		resp, err := client.storageAccountsClient.GetProperties(ctx, storageAccountId, storageaccounts.DefaultGetPropertiesOperationOptions())
		if err != nil {
			return nil, fmt.Errorf("retrieving %s: %+v", storageAccountId, err)
		}
		if resp.Model == nil {
			return nil, fmt.Errorf("retrieving %s: model was nil", storageAccountId)
		}
		client.accountDetail, err = populateAccountDetails(storageAccountId, *resp.Model)
		if err != nil {
			return nil, fmt.Errorf("populating details for %s: %+v", storageAccountId, err)
		}
	}

	return &client, nil
}

func (c *Client) getBlobClient(ctx context.Context) (bc *blobs.Client, err error) {
	if c.blobsClient != nil {
		return c.blobsClient, nil
	}

	defer func() {
		if err == nil {
			c.blobsClient = bc
		}
	}()

	var baseUri string
	if c.accountDetail != nil {
		// Use the actual blob endpoint if available
		pBaseUri, err := c.accountDetail.DataPlaneEndpoint(EndpointTypeBlob)
		if err != nil {
			return nil, err
		}
		baseUri = *pBaseUri
	} else {
		baseUri, err = naiveStorageAccountBlobBaseURL(c.environment, c.storageAccountName)
		if err != nil {
			return nil, err
		}
	}

	blobsClient, err := blobs.NewWithBaseUri(baseUri)
	if err != nil {
		return nil, fmt.Errorf("new blob client: %v", err)
	}

	switch {
	case c.sasToken != "":
		log.Printf("[DEBUG] Building the Blob Client from a SAS Token")
		c.configureClient(blobsClient.Client, nil)
		blobsClient.Client.AppendRequestMiddleware(func(r *http.Request) (*http.Request, error) {
			if r.URL.RawQuery == "" {
				r.URL.RawQuery = c.sasToken
			} else if !strings.Contains(r.URL.RawQuery, c.sasToken) {
				r.URL.RawQuery = fmt.Sprintf("%s&%s", r.URL.RawQuery, c.sasToken)
			}
			return r, nil
		})
		return blobsClient, nil

	case c.accessKey != "":
		log.Printf("[DEBUG] Building the Blob Client from an Access Key")
		authorizer, err := auth.NewSharedKeyAuthorizer(c.storageAccountName, c.accessKey, auth.SharedKey)
		if err != nil {
			return nil, fmt.Errorf("new shared key authorizer: %v", err)
		}
		c.configureClient(blobsClient.Client, authorizer)
		return blobsClient, nil

	case c.azureAdStorageAuth != nil:
		log.Printf("[DEBUG] Building the Blob Client from AAD auth")
		c.configureClient(blobsClient.Client, c.azureAdStorageAuth)
		return blobsClient, nil

	default:
		// Neither shared access key, sas token, or AAD Auth were specified so we have to call the management plane API to get the key.
		log.Printf("[DEBUG] Building the Blob Client from an Access Key (key is listed using client credentials)")
		key, err := c.accountDetail.AccountKey(ctx, c.storageAccountsClient)
		if err != nil {
			return nil, fmt.Errorf("retrieving key for Storage Account %q: %s", c.storageAccountName, err)
		}
		authorizer, err := auth.NewSharedKeyAuthorizer(c.storageAccountName, *key, auth.SharedKey)
		if err != nil {
			return nil, fmt.Errorf("new shared key authorizer: %v", err)
		}
		c.configureClient(blobsClient.Client, authorizer)
		return blobsClient, nil
	}
}

func (c *Client) getContainersClient(ctx context.Context) (cc *containers.Client, err error) {
	if c.containersClient != nil {
		return c.containersClient, nil
	}

	defer func() {
		if err == nil {
			c.containersClient = cc
		}
	}()

	var baseUri string
	if c.accountDetail != nil {
		// Use the actual blob endpoint if available
		pBaseUri, err := c.accountDetail.DataPlaneEndpoint(EndpointTypeBlob)
		if err != nil {
			return nil, err
		}
		baseUri = *pBaseUri
	} else {
		baseUri, err = naiveStorageAccountBlobBaseURL(c.environment, c.storageAccountName)
		if err != nil {
			return nil, err
		}
	}

	containersClient, err := containers.NewWithBaseUri(baseUri)
	if err != nil {
		return nil, fmt.Errorf("new container client: %v", err)
	}

	switch {
	case c.sasToken != "":
		log.Printf("[DEBUG] Building the Container Client from a SAS Token")
		c.configureClient(containersClient.Client, nil)
		containersClient.Client.AppendRequestMiddleware(func(r *http.Request) (*http.Request, error) {
			if r.URL.RawQuery == "" {
				r.URL.RawQuery = c.sasToken
			} else if !strings.Contains(r.URL.RawQuery, c.sasToken) {
				r.URL.RawQuery = fmt.Sprintf("%s&%s", r.URL.RawQuery, c.sasToken)
			}
			return r, nil
		})
		return containersClient, nil

	case c.accessKey != "":
		log.Printf("[DEBUG] Building the Container Client from an Access Key")
		authorizer, err := auth.NewSharedKeyAuthorizer(c.storageAccountName, c.accessKey, auth.SharedKey)
		if err != nil {
			return nil, fmt.Errorf("new shared key authorizer: %v", err)
		}
		c.configureClient(containersClient.Client, authorizer)
		return containersClient, nil

	case c.azureAdStorageAuth != nil:
		log.Printf("[DEBUG] Building the Container Client from AAD auth")
		c.configureClient(containersClient.Client, c.azureAdStorageAuth)
		return containersClient, nil

	default:
		// Neither shared access key, sas token, or AAD Auth were specified so we have to call the management plane API to get the key.
		log.Printf("[DEBUG] Building the Container Client from an Access Key (key is listed using user credentials)")
		key, err := c.accountDetail.AccountKey(ctx, c.storageAccountsClient)
		if err != nil {
			return nil, fmt.Errorf("retrieving key for Storage Account %q: %s", c.storageAccountName, err)
		}
		authorizer, err := auth.NewSharedKeyAuthorizer(c.storageAccountName, *key, auth.SharedKey)
		if err != nil {
			return nil, fmt.Errorf("new shared key authorizer: %v", err)
		}
		c.configureClient(containersClient.Client, authorizer)
		return containersClient, nil
	}
}

func (c *Client) configureClient(client client.BaseClient, authorizer auth.Authorizer) {
	client.SetAuthorizer(authorizer)
	client.SetUserAgent(buildUserAgent(client.GetUserAgent()))
}

func buildUserAgent(userAgent string) string {
	userAgent = strings.TrimSpace(fmt.Sprintf("%s %s", userAgent, httpclient.TerraformUserAgent(version.Version)))

	// append the CloudShell version to the user agent if it exists
	if azureAgent := os.Getenv("AZURE_HTTP_USER_AGENT"); azureAgent != "" {
		userAgent = fmt.Sprintf("%s %s", userAgent, azureAgent)
	}

	return userAgent
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/backend.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package azure

import (
	"context"
	"fmt"
	"time"

	"github.com/hashicorp/go-azure-sdk/sdk/auth"
	"github.com/hashicorp/go-azure-sdk/sdk/environments"
	"github.com/zclconf/go-cty/cty"

	"github.com/hashicorp/terraform/internal/backend"
	"github.com/hashicorp/terraform/internal/backend/backendbase"
	"github.com/hashicorp/terraform/internal/configs/configschema"
	"github.com/hashicorp/terraform/internal/tfdiags"
)

// New creates a new backend for Azure remote state.
func New() backend.Backend {
	return &Backend{
		Base: backendbase.Base{
			Schema: &configschema.Block{
				Attributes: map[string]*configschema.Attribute{

					"subscription_id": {
						Type:        cty.String,
						Optional:    true,
						Description: "The Subscription ID where the Storage Account is located.",
					},
					"resource_group_name": {
						Type:        cty.String,
						Optional:    true,
						Description: "The Resource Group where the Storage Account is located.",
					},
					"storage_account_name": {
						Type:        cty.String,
						Required:    true,
						Description: "The name of the storage account.",
					},
					"container_name": {
						Type:        cty.String,
						Required:    true,
						Description: "The container name to use in the Storage Account.",
					},
					"key": {
						Type:        cty.String,
						Required:    true,
						Description: "The blob key to use in the Storage Container.",
					},
					"lookup_blob_endpoint": {
						Type:        cty.Bool,
						Optional:    true,
						Description: "Whether to look up the storage account blob endpoint. This is necessary when the storage account uses the Azure DNS zone endpoint.",
					},
					"snapshot": {
						Type:        cty.Bool,
						Optional:    true,
						Description: "Whether to enable automatic blob snapshotting.",
					},
					"environment": {
						Type:        cty.String,
						Optional:    true,
						Description: "The Cloud Environment which should be used. Possible values are public, usgovernment, and china. Defaults to public. Not used and should not be specified when `metadata_host` is specified.",
					},
					"metadata_host": {
						Type:        cty.String,
						Optional:    true,
						Description: "The Hostname which should be used for the Azure Metadata Service.",
					},
					"access_key": {
						Type:        cty.String,
						Optional:    true,
						Description: "The access key to use when authenticating using a Storage Access Key.",
					},
					"sas_token": {
						Type:        cty.String,
						Optional:    true,
						Description: "The SAS Token to use when authenticating using a SAS Token.",
					},
					"tenant_id": {
						Type:        cty.String,
						Optional:    true,
						Description: "The Tenant ID to use when authenticating using Azure Active Directory.",
					},
					"client_id": {
						Type:        cty.String,
						Optional:    true,
						Description: "The Client ID to use when authenticating using Azure Active Directory.",
					},
					"client_id_file_path": {
						Type:        cty.String,
						Optional:    true,
						Description: "The path to a file containing the Client ID which should be used.",
					},
					"endpoint": {
						Type:        cty.String,
						Optional:    true,
						Deprecated:  true,
						Description: "`endpoint` is deprecated in favor of `msi_endpoint`, it will be removed in a future version of Terraform",
					},

					// Client Certificate specific fields
					"client_certificate": {
						Type:        cty.String,
						Optional:    true,
						Description: "Base64 encoded PKCS#12 certificate bundle to use when authenticating as a Service Principal using a Client Certificate",
					},
					"client_certificate_path": {
						Type:        cty.String,
						Optional:    true,
						Description: "The path to the Client Certificate associated with the Service Principal for use when authenticating as a Service Principal using a Client Certificate.",
					},
					"client_certificate_password": {
						Type:        cty.String,
						Optional:    true,
						Description: "The password associated with the Client Certificate. For use when authenticating as a Service Principal using a Client Certificate",
					},

					// Client Secret specific fields
					"client_secret": {
						Type:        cty.String,
						Optional:    true,
						Description: "The Client Secret which should be used. For use When authenticating as a Service Principal using a Client Secret.",
					},
					"client_secret_file_path": {
						Type:        cty.String,
						Optional:    true,
						Description: "The path to a file containing the Client Secret which should be used. For use When authenticating as a Service Principal using a Client Secret.",
					},

					// OIDC specific fields
					"use_oidc": {
						Type:        cty.Bool,
						Optional:    true,
						Description: "Allow OpenID Connect to be used for authentication",
					},
					"ado_pipeline_service_connection_id": {
						Type:        cty.String,
						Optional:    true,
						Description: "The Azure DevOps Pipeline Service Connection ID.",
					},
					"oidc_request_token": {
						Type:        cty.String,
						Optional:    true,
						Description: "The bearer token for the request to the OIDC provider. For use when authenticating as a Service Principal using OpenID Connect.",
					},
					"oidc_request_url": {
						Type:        cty.String,
						Optional:    true,
						Description: "The URL for the OIDC provider from which to request an ID token. For use when authenticating as a Service Principal using OpenID Connect.",
					},
					"oidc_token": {
						Type:        cty.String,
						Optional:    true,
						Description: "The OIDC ID token for use when authenticating as a Service Principal using OpenID Connect.",
					},
					"oidc_token_file_path": {
						Type:        cty.String,
						Optional:    true,
						Description: "The path to a file containing an OIDC ID token for use when authenticating as a Service Principal using OpenID Connect.",
					},

					// Managed Identity specific fields
					"use_msi": {
						Type:        cty.Bool,
						Optional:    true,
						Description: "Allow Managed Identity to be used for Authentication.",
					},
					"msi_endpoint": {
						Type:        cty.String,
						Optional:    true,
						Description: "The path to a custom endpoint for Managed Identity - in most circumstances this should be detected automatically.",
					},

					// Azure CLI specific fields
					"use_cli": {
						Type:        cty.Bool,
						Optional:    true,
						Description: "Allow Azure CLI to be used for Authentication.",
					},

					// Azure AKS Workload Identity fields
					"use_aks_workload_identity": {
						Type:        cty.Bool,
						Optional:    true,
						Description: "Allow Azure AKS Workload Identity to be used for Authentication.",
					},

					// Feature Flags
					"use_azuread_auth": {
						Type:        cty.Bool,
						Optional:    true,
						Description: "Whether to use Azure Active Directory authentication to access the Storage Data Plane APIs.",
					},
				},
			},
			SDKLikeDefaults: backendbase.SDKLikeDefaults{
				"subscription_id": {
					EnvVars:  []string{"ARM_SUBSCRIPTION_ID"},
					Fallback: "",
				},
				"lookup_blob_endpoint": {
					EnvVars:  []string{"ARM_USE_DNS_ZONE_ENDPOINT"},
					Fallback: "false",
				},
				"snapshot": {
					EnvVars:  []string{"ARM_SNAPSHOT"},
					Fallback: "false",
				},
				"environment": {
					EnvVars:  []string{"ARM_ENVIRONMENT"},
					Fallback: "public",
				},
				"metadata_host": {
					EnvVars:  []string{"ARM_METADATA_HOSTNAME", "ARM_METADATA_HOST"}, // TODO: remove support for `METADATA_HOST` in a future version
					Fallback: "",
				},
				"access_key": {
					EnvVars:  []string{"ARM_ACCESS_KEY"},
					Fallback: "",
				},
				"sas_token": {
					EnvVars:  []string{"ARM_SAS_TOKEN"},
					Fallback: "",
				},
				"tenant_id": {
					EnvVars:  []string{"ARM_TENANT_ID"},
					Fallback: "",
				},
				"client_id": {
					EnvVars:  []string{"ARM_CLIENT_ID"},
					Fallback: "",
				},
				"client_id_file_path": {
					EnvVars: []string{"ARM_CLIENT_ID_FILE_PATH"},
					// no fallback
				},

				// Client Certificate specific fields
				"client_certificate": {
					EnvVars:  []string{"ARM_CLIENT_CERTIFICATE"},
					Fallback: "",
				},
				"client_certificate_path": {
					EnvVars:  []string{"ARM_CLIENT_CERTIFICATE_PATH"},
					Fallback: "",
				},
				"client_certificate_password": {
					EnvVars:  []string{"ARM_CLIENT_CERTIFICATE_PASSWORD"},
					Fallback: "",
				},

				// Client Secret specific fields
				"client_secret": {
					EnvVars:  []string{"ARM_CLIENT_SECRET"},
					Fallback: "",
				},
				"client_secret_file_path": {
					EnvVars: []string{"ARM_CLIENT_SECRET_FILE_PATH"},
					// no fallback
				},

				// OIDC specific fields
				"use_oidc": {
					EnvVars:  []string{"ARM_USE_OIDC"},
					Fallback: "false",
				},
				"ado_pipeline_service_connection_id": {
					EnvVars: []string{"ARM_ADO_PIPELINE_SERVICE_CONNECTION_ID", "ARM_OIDC_AZURE_SERVICE_CONNECTION_ID"},
					// no fallback
				},
				"oidc_request_token": {
					EnvVars: []string{"ARM_OIDC_REQUEST_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN", "SYSTEM_ACCESSTOKEN"},
					// no fallback
				},
				"oidc_request_url": {
					EnvVars: []string{"ARM_OIDC_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_URL", "SYSTEM_OIDCREQUESTURI"},
					// no fallback
				},
				"oidc_token": {
					EnvVars:  []string{"ARM_OIDC_TOKEN"},
					Fallback: "",
				},
				"oidc_token_file_path": {
					EnvVars:  []string{"ARM_OIDC_TOKEN_FILE_PATH"},
					Fallback: "",
				},

				// Managed Identity specific fields
				"use_msi": {
					EnvVars:  []string{"ARM_USE_MSI"},
					Fallback: "false",
				},
				"msi_endpoint": {
					EnvVars:  []string{"ARM_MSI_ENDPOINT"},
					Fallback: "",
				},

				// Azure CLI specific fields
				"use_cli": {
					Env
```

### Core Architecture Module: `internal/backend/remote-state/azure/backend_state.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package azure

import (
	"fmt"
	"sort"
	"strings"

	"github.com/hashicorp/go-azure-helpers/lang/response"
	"github.com/hashicorp/terraform/internal/backend"
	"github.com/hashicorp/terraform/internal/states"
	"github.com/hashicorp/terraform/internal/states/remote"
	"github.com/hashicorp/terraform/internal/states/statemgr"
	"github.com/hashicorp/terraform/internal/tfdiags"
	"github.com/jackofallops/giovanni/storage/2023-11-03/blob/blobs"
	"github.com/jackofallops/giovanni/storage/2023-11-03/blob/containers"
)

const (
	// This will be used as directory name, the odd looking colon is simply to
	// reduce the chance of name conflicts with existing objects.
	keyEnvPrefix = "env:"
)

func (b *Backend) Workspaces() ([]string, tfdiags.Diagnostics) {
	var diags tfdiags.Diagnostics
	prefix := b.keyName + keyEnvPrefix
	params := containers.ListBlobsInput{
		Prefix: &prefix,
	}

	ctx := newCtx()
	client, err := b.apiClient.getContainersClient(ctx)
	if err != nil {
		return nil, diags.Append(fmt.Errorf("retrieving container client: %v", err))
	}
	resp, err := client.ListBlobs(ctx, b.containerName, params)
	if err != nil {
		return nil, diags.Append(fmt.Errorf("listing blobs: %v", err))
	}

	envs := map[string]struct{}{}
	for _, obj := range resp.Blobs.Blobs {
		key := obj.Name
		if strings.HasPrefix(key, prefix) {
			name := strings.TrimPrefix(key, prefix)
			// we store the state in a key, not a directory
			if strings.Contains(name, "/") {
				continue
			}

			envs[name] = struct{}{}
		}
	}

	result := []string{backend.DefaultStateName}
	for name := range envs {
		result = append(result, name)
	}
	sort.Strings(result[1:])
	return result, diags
}

func (b *Backend) DeleteWorkspace(name string, _ bool) tfdiags.Diagnostics {
	var diags tfdiags.Diagnostics

	if name == backend.DefaultStateName || name == "" {
		return diags.Append(fmt.Errorf("can't delete default state"))
	}

	ctx := newCtx()
	client, err := b.apiClient.getBlobClient(ctx)
	if err != nil {
		return diags.Append(err)
	}

	if resp, err := client.Delete(ctx, b.containerName, b.path(name), blobs.DeleteInput{}); err != nil {
		if !response.WasNotFound(resp.HttpResponse) {
			return diags.Append(err)
		}
	}

	return diags
}

func (b *Backend) StateMgr(name string) (statemgr.Full, tfdiags.Diagnostics) {
	ctx := newCtx()
	var diags tfdiags.Diagnostics

	blobClient, err := b.apiClient.getBlobClient(ctx)
	if err != nil {
		return nil, diags.Append(err)
	}

	client := &RemoteClient{
		giovanniBlobClient: *blobClient,
		containerName:      b.containerName,
		keyName:            b.path(name),
		accountName:        b.accountName,
		snapshot:           b.snapshot,
	}

	stateMgr := &remote.State{Client: client}

	// Grab the value
	if err := stateMgr.RefreshState(); err != nil {
		return nil, diags.Append(err)
	}
	//if this isn't the default state name, we need to create the object so
	//it's listed by States.
	if v := stateMgr.State(); v == nil {
		// take a lock on this state while we write it
		lockInfo := statemgr.NewLockInfo()
		lockInfo.Operation = "init"
		lockId, err := client.Lock(lockInfo)
		if err != nil {
			return nil, diags.Append(fmt.Errorf("failed to lock azure state: %s", err))
		}

		// Local helper function so we can call it multiple places
		lockUnlock := func(parent error) error {
			if err := stateMgr.Unlock(lockId); err != nil {
				return fmt.Errorf(strings.TrimSpace(errStateUnlock), lockId, err)
			}
			return parent
		}

		// Grab the value
		if err := stateMgr.RefreshState(); err != nil {
			err = lockUnlock(err)
			return nil, diags.Append(err)
		}
		//if this isn't the default state name, we need to create the object so
		//it's listed by States.
		if v := stateMgr.State(); v == nil {
			// If we have no state, we have to create an empty state
			if err := stateMgr.WriteState(states.NewState()); err != nil {
				err = lockUnlock(err)
				return nil, diags.Append(err)
			}
			if err := stateMgr.PersistState(nil); err != nil {
				err = lockUnlock(err)
				return nil, diags.Append(err)
			}

			// Unlock, the state should now be initialized
			if err := lockUnlock(nil); err != nil {
				return nil, diags.Append(err)
			}
		}
	}

	return stateMgr, diags
}

func (b *Backend) client() *RemoteClient {
	return &RemoteClient{}
}

func (b *Backend) path(name string) string {
	if name == backend.DefaultStateName {
		return b.keyName
	}

	return b.keyName + keyEnvPrefix + name
}

const errStateUnlock = `
Error unlocking Azure state. Lock ID: %s

Error: %s

You may have to force-unlock this state in order to use it again.
`

```

### Core Architecture Module: `internal/backend/remote-state/azure/client.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package azure

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/hashicorp/go-azure-helpers/lang/response"
	"github.com/hashicorp/go-uuid"
	"github.com/jackofallops/giovanni/storage/2023-11-03/blob/blobs"

	"github.com/hashicorp/terraform/internal/states/remote"
	"github.com/hashicorp/terraform/internal/states/statemgr"
	"github.com/hashicorp/terraform/internal/tfdiags"
)

const (
	leaseHeader = "x-ms-lease-id"
	// Must be lower case
	lockInfoMetaKey = "terraformlockid"
)

const veryLongTimeout = 9999 * time.Hour

// newCtx creates a context with a (meaningless) deadline.
// This is only to make the go-azure-sdk/sdk/client Client happy.
func newCtx() context.Context {
	ctx, _ := context.WithTimeout(context.TODO(), veryLongTimeout)
	return ctx
}

type RemoteClient struct {
	giovanniBlobClient blobs.Client
	accountName        string
	containerName      string
	keyName            string
	leaseID            string
	snapshot           bool
}

func (c *RemoteClient) Get() (*remote.Payload, tfdiags.Diagnostics) {
	var diags tfdiags.Diagnostics
	options := blobs.GetInput{}
	if c.leaseID != "" {
		options.LeaseID = &c.leaseID
	}

	ctx := newCtx()
	blob, err := c.giovanniBlobClient.Get(ctx, c.containerName, c.keyName, options)
	if err != nil {
		if response.WasNotFound(blob.HttpResponse) {
			return nil, nil
		}
		return nil, diags.Append(err)
	}

	if blob.Contents == nil {
		return nil, diags
	}

	payload := &remote.Payload{
		Data: *blob.Contents,
	}

	// If there was no data, then return nil
	if len(payload.Data) == 0 {
		return nil, diags
	}

	return payload, diags
}

func (c *RemoteClient) Put(data []byte) tfdiags.Diagnostics {
	var diags tfdiags.Diagnostics

	getOptions := blobs.GetPropertiesInput{}
	setOptions := blobs.SetPropertiesInput{}
	putOptions := blobs.PutBlockBlobInput{}

	options := blobs.GetInput{}
	if c.leaseID != "" {
		options.LeaseID = &c.leaseID
		getOptions.LeaseID = &c.leaseID
		setOptions.LeaseID = &c.leaseID
		putOptions.LeaseID = &c.leaseID
	}

	ctx := newCtx()

	if c.snapshot {
		snapshotInput := blobs.SnapshotInput{LeaseID: options.LeaseID}

		log.Printf("[DEBUG] Snapshotting existing Blob %q (Container %q / Account %q)", c.keyName, c.containerName, c.accountName)
		if _, err := c.giovanniBlobClient.Snapshot(ctx, c.containerName, c.keyName, snapshotInput); err != nil {
			return diags.Append(fmt.Errorf("error snapshotting Blob %q (Container %q / Account %q): %+v", c.keyName, c.containerName, c.accountName, err))
		}

		log.Print("[DEBUG] Created blob snapshot")
	}

	blob, err := c.giovanniBlobClient.GetProperties(ctx, c.containerName, c.keyName, getOptions)
	if err != nil {
		if !response.WasNotFound(blob.HttpResponse) {
			return diags.Append(err)
		}
	}

	contentType := "application/json"
	putOptions.Content = &data
	putOptions.ContentType = &contentType
	putOptions.MetaData = blob.MetaData
	_, err = c.giovanniBlobClient.PutBlockBlob(ctx, c.containerName, c.keyName, putOptions)

	return diags.Append(err)
}

func (c *RemoteClient) Delete() tfdiags.Diagnostics {
	var diags tfdiags.Diagnostics

	options := blobs.DeleteInput{}

	if c.leaseID != "" {
		options.LeaseID = &c.leaseID
	}

	ctx := newCtx()
	resp, err := c.giovanniBlobClient.Delete(ctx, c.containerName, c.keyName, options)
	if err != nil {
		if !response.WasNotFound(resp.HttpResponse) {
			return diags.Append(err)
		}
	}
	return diags
}

func (c *RemoteClient) Lock(info *statemgr.LockInfo) (string, error) {
	stateName := fmt.Sprintf("%s/%s", c.containerName, c.keyName)
	info.Path = stateName

	if info.ID == "" {
		lockID, err := uuid.GenerateUUID()
		if err != nil {
			return "", err
		}

		info.ID = lockID
	}

	getLockInfoErr := func(err error) error {
		lockInfo, infoErr := c.getLockInfo()
		if infoErr != nil {
			err = errors.Join(err, infoErr)
		}

		return &statemgr.LockError{
			Err:  err,
			Info: lockInfo,
		}
	}

	leaseOptions := blobs.AcquireLeaseInput{
		ProposedLeaseID: &info.ID,
		LeaseDuration:   -1,
	}
	ctx := newCtx()

	// obtain properties to see if the blob lease is already in use. If the blob doesn't exist, create it
	properties, err := c.giovanniBlobClient.GetProperties(ctx, c.containerName, c.keyName, blobs.GetPropertiesInput{})
	if err != nil {
		// error if we had issues getting the blob
		if !response.WasNotFound(properties.HttpResponse) {
			return "", getLockInfoErr(err)
		}
		// if we don't find the blob, we need to build it

		contentType := "application/json"
		putGOptions := blobs.PutBlockBlobInput{
			ContentType: &contentType,
		}

		_, err = c.giovanniBlobClient.PutBlockBlob(ctx, c.containerName, c.keyName, putGOptions)
		if err != nil {
			return "", getLockInfoErr(err)
		}
	}

	// if the blob is already locked then error
	if properties.LeaseStatus == blobs.Locked {
		return "", getLockInfoErr(fmt.Errorf("state blob is already locked"))
	}

	leaseID, err := c.giovanniBlobClient.AcquireLease(ctx, c.containerName, c.keyName, leaseOptions)
	if err != nil {
		return "", getLockInfoErr(err)
	}

	info.ID = leaseID.LeaseID
	c.leaseID = leaseID.LeaseID

	if err := c.writeLockInfo(info); err != nil {
		return "", err
	}

	return info.ID, nil
}

func (c *RemoteClient) getLockInfo() (*statemgr.LockInfo, error) {
	options := blobs.GetPropertiesInput{}
	if c.leaseID != "" {
		options.LeaseID = &c.leaseID
	}

	ctx := newCtx()
	blob, err := c.giovanniBlobClient.GetProperties(ctx, c.containerName, c.keyName, options)
	if err != nil {
		return nil, err
	}

	raw := blob.MetaData[lockInfoMetaKey]
	if raw == "" {
		return nil, fmt.Errorf("blob metadata %q was empty", lockInfoMetaKey)
	}

	data, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, err
	}

	lockInfo := &statemgr.LockInfo{}
	err = json.Unmarshal(data, lockInfo)
	if err != nil {
		return nil, err
	}

	return lockInfo, nil
}

// writes info to blob meta data, deletes metadata entry if info is nil
func (c *RemoteClient) writeLockInfo(info *statemgr.LockInfo) error {
	ctx := newCtx()
	blob, err := c.giovanniBlobClient.GetProperties(ctx, c.containerName, c.keyName, blobs.GetPropertiesInput{LeaseID: &c.leaseID})
	if err != nil {
		return err
	}
	if err != nil {
		return err
	}

	if info == nil {
		delete(blob.MetaData, lockInfoMetaKey)
	} else {
		value := base64.StdEncoding.EncodeToString(info.Marshal())
		blob.MetaData[lockInfoMetaKey] = value
	}

	opts := blobs.SetMetaDataInput{
		LeaseID:  &c.leaseID,
		MetaData: blob.MetaData,
	}

	_, err = c.giovanniBlobClient.SetMetaData(ctx, c.containerName, c.keyName, opts)
	return err
}

func (c *RemoteClient) Unlock(id string) error {
	lockErr := &statemgr.LockError{}

	lockInfo, err := c.getLockInfo()
	if err != nil {
		lockErr.Err = fmt.Errorf("failed to retrieve lock info: %s", err)
		return lockErr
	}
	lockErr.Info = lockInfo

	if lockInfo.ID != id {
		lockErr.Err = fmt.Errorf("lock id %q does not match existing lock", id)
		return lockErr
	}

	c.leaseID = lockInfo.ID
	if err := c.writeLockInfo(nil); err != nil {
		lockErr.Err = fmt.Errorf("failed to delete lock info from metadata: %s", err)
		return lockErr
	}

	ctx := newCtx()
	_, err = c.giovanniBlobClient.ReleaseLease(ctx, c.containerName, c.keyName, blobs.ReleaseLeaseInput{LeaseID: id})
	if err != nil {
		lockErr.Err = err
		return lockErr
	}

	c.leaseID = ""

	return nil
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/helpers.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: MPL-2.0

// This file is copied from terraform-provider-azurerm: internal/provider/helpers.go

package azure

import (
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/hashicorp/terraform/internal/backend/backendbase"
)

// logEntry avoids log entries showing up in test output
func logEntry(f string, v ...interface{}) {
	if os.Getenv("TF_LOG") == "" {
		return
	}

	if os.Getenv("TF_ACC") != "" {
		return
	}

	log.Printf(f, v...)
}

func decodeCertificate(clientCertificate string) ([]byte, error) {
	var pfx []byte
	if clientCertificate != "" {
		out := make([]byte, base64.StdEncoding.DecodedLen(len(clientCertificate)))
		n, err := base64.StdEncoding.Decode(out, []byte(clientCertificate))
		if err != nil {
			return pfx, fmt.Errorf("could not decode client certificate data: %v", err)
		}
		pfx = out[:n]
	}
	return pfx, nil
}

func getOidcToken(d *backendbase.SDKLikeData) (*string, error) {
	idToken := strings.TrimSpace(d.String("oidc_token"))

	if path := d.String("oidc_token_file_path"); path != "" {
		fileTokenRaw, err := os.ReadFile(path)

		if err != nil {
			return nil, fmt.Errorf("reading OIDC Token from file %q: %v", path, err)
		}

		fileToken := strings.TrimSpace(string(fileTokenRaw))

		if idToken != "" && idToken != fileToken {
			return nil, fmt.Errorf("mismatch between supplied OIDC token and supplied OIDC token file contents - please either remove one or ensure they match")
		}

		idToken = fileToken
	}

	if d.Bool("use_aks_workload_identity") && os.Getenv("AZURE_FEDERATED_TOKEN_FILE") != "" {
		path := os.Getenv("AZURE_FEDERATED_TOKEN_FILE")
		fileTokenRaw, err := os.ReadFile(os.Getenv("AZURE_FEDERATED_TOKEN_FILE"))

		if err != nil {
			return nil, fmt.Errorf("reading OIDC Token from file %q provided by AKS Workload Identity: %v", path, err)
		}

		fileToken := strings.TrimSpace(string(fileTokenRaw))

		if idToken != "" && idToken != fileToken {
			return nil, fmt.Errorf("mismatch between supplied OIDC token and OIDC token file contents provided by AKS Workload Identity - please either remove one, ensure they match, or disable use_aks_workload_identity")
		}

		idToken = fileToken
	}

	return &idToken, nil
}

func getClientId(d *backendbase.SDKLikeData) (*string, error) {
	clientId := strings.TrimSpace(d.String("client_id"))

	if path := d.String("client_id_file_path"); path != "" {
		fileClientIdRaw, err := os.ReadFile(path)

		if err != nil {
			return nil, fmt.Errorf("reading Client ID from file %q: %v", path, err)
		}

		fileClientId := strings.TrimSpace(string(fileClientIdRaw))

		if clientId != "" && clientId != fileClientId {
			return nil, fmt.Errorf("mismatch between supplied Client ID and supplied Client ID file contents - please either remove one or ensure they match")
		}

		clientId = fileClientId
	}

	if d.Bool("use_aks_workload_identity") && os.Getenv("AZURE_CLIENT_ID") != "" {
		aksClientId := os.Getenv("AZURE_CLIENT_ID")
		if clientId != "" && clientId != aksClientId {
			return nil, fmt.Errorf("mismatch between supplied Client ID and that provided by AKS Workload Identity - please remove, ensure they match, or disable use_aks_workload_identity")
		}
		clientId = aksClientId
	}

	return &clientId, nil
}

func getClientSecret(d *backendbase.SDKLikeData) (*string, error) {
	clientSecret := strings.TrimSpace(d.String("client_secret"))

	if path := d.String("client_secret_file_path"); path != "" {
		fileSecretRaw, err := os.ReadFile(path)

		if err != nil {
			return nil, fmt.Errorf("reading Client Secret from file %q: %v", path, err)
		}

		fileSecret := strings.TrimSpace(string(fileSecretRaw))

		if clientSecret != "" && clientSecret != fileSecret {
			return nil, fmt.Errorf("mismatch between supplied Client Secret and supplied Client Secret file contents - please either remove one or ensure they match")
		}

		clientSecret = fileSecret
	}

	return &clientSecret, nil
}

func getTenantId(d *backendbase.SDKLikeData) (*string, error) {
	tenantId := strings.TrimSpace(d.String("tenant_id"))

	if d.Bool("use_aks_workload_identity") && os.Getenv("AZURE_TENANT_ID") != "" {
		aksTenantId := os.Getenv("AZURE_TENANT_ID")
		if tenantId != "" && tenantId != aksTenantId {
			return nil, fmt.Errorf("mismatch between supplied Tenant ID and that provided by AKS Workload Identity - please remove, ensure they match, or disable use_aks_workload_identity")
		}
		tenantId = aksTenantId
	}

	return &tenantId, nil
}

```

### Core Architecture Module: `internal/backend/remote-state/azure/storage_client_helpers.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package azure

import (
	"context"
	"fmt"
	"strings"

	"github.com/hashicorp/go-azure-helpers/lang/pointer"
	"github.com/hashicorp/go-azure-helpers/resourcemanager/commonids"
	"github.com/hashicorp/go-azure-sdk/resource-manager/storage/2023-01-01/storageaccounts"
	"github.com/hashicorp/go-azure-sdk/sdk/environments"
)

// This file is referencing the terraform-provider-azurerm: internal/services/storage/client/helpers.go

type EndpointType string

const (
	EndpointTypeBlob  = "blob"
	EndpointTypeDfs   = "dfs"
	EndpointTypeFile  = "file"
	EndpointTypeQueue = "queue"
	EndpointTypeTable = "table"
)

type AccountDetails struct {
	Kind             storageaccounts.Kind
	IsHnsEnabled     bool
	StorageAccountId commonids.StorageAccountId

	accountKey *string

	// primaryBlobEndpoint is the Primary Blob Endpoint for the Data Plane API for this Storage Account
	// e.g. `https://{account}.blob.core.windows.net`
	primaryBlobEndpoint *string

	// primaryDfsEndpoint is the Primary Dfs Endpoint for the Data Plane API for this Storage Account
	// e.g. `https://sale.dfs.core.windows.net`
	primaryDfsEndpoint *string

	// primaryFileEndpoint is the Primary File Endpoint for the Data Plane API for this Storage Account
	// e.g. `https://{account}.file.core.windows.net`
	primaryFileEndpoint *string

	// primaryQueueEndpoint is the Primary Queue Endpoint for the Data Plane API for this Storage Account
	// e.g. `https://{account}.queue.core.windows.net`
	primaryQueueEndpoint *string

	// primaryTableEndpoint is the Primary Table Endpoint for the Data Plane API for this Storage Account
	// e.g. `https://{account}.table.core.windows.net`
	primaryTableEndpoint *string
}

func (ad *AccountDetails) AccountKey(ctx context.Context, client *storageaccounts.StorageAccountsClient) (*string, error) {
	if ad.accountKey != nil {
		return ad.accountKey, nil
	}

	opts := storageaccounts.DefaultListKeysOperationOptions()
	opts.Expand = pointer.To(storageaccounts.ListKeyExpandKerb)
	listKeysResp, err := client.ListKeys(ctx, ad.StorageAccountId, opts)
	if err != nil {
		return nil, fmt.Errorf("listing Keys for %s: %+v", ad.StorageAccountId, err)
	}

	if model := listKeysResp.Model; model != nil && model.Keys != nil {
		for _, key := range *model.Keys {
			if key.Permissions == nil || key.Value == nil {
				continue
			}

			if *key.Permissions == storageaccounts.KeyPermissionFull {
				ad.accountKey = key.Value
				break
			}
		}
	}

	if ad.accountKey == nil {
		return nil, fmt.Errorf("unable to determine the Write Key for %s", ad.StorageAccountId)
	}

	return ad.accountKey, nil
}

func (ad *AccountDetails) DataPlaneEndpoint(endpointType EndpointType) (*string, error) {
	var baseUri *string
	switch endpointType {
	case EndpointTypeBlob:
		baseUri = ad.primaryBlobEndpoint

	case EndpointTypeDfs:
		baseUri = ad.primaryDfsEndpoint

	case EndpointTypeFile:
		baseUri = ad.primaryFileEndpoint

	case EndpointTypeQueue:
		baseUri = ad.primaryQueueEndpoint

	case EndpointTypeTable:
		baseUri = ad.primaryTableEndpoint

	default:
		return nil, fmt.Errorf("internal-error: unrecognised endpoint type %q when building storage client", endpointType)
	}

	if baseUri == nil {
		return nil, fmt.Errorf("determining %s endpoint for %s: missing primary endpoint", endpointType, ad.StorageAccountId)
	}
	return baseUri, nil
}

func populateAccountDetails(accountId commonids.StorageAccountId, account storageaccounts.StorageAccount) (*AccountDetails, error) {
	out := AccountDetails{
		Kind:             pointer.From(account.Kind),
		StorageAccountId: accountId,
	}

	if account.Properties == nil {
		return nil, fmt.Errorf("populating details for %s: `model.Properties` was nil", accountId)
	}
	if account.Properties.PrimaryEndpoints == nil {
		return nil, fmt.Errorf("populating details for %s: `model.Properties.PrimaryEndpoints` was nil", accountId)
	}

	props := *account.Properties
	out.IsHnsEnabled = pointer.From(props.IsHnsEnabled)

	endpoints := *props.PrimaryEndpoints
	if endpoints.Blob != nil {
		endpoint := strings.TrimSuffix(*endpoints.Blob, "/")
		out.primaryBlobEndpoint = pointer.To(endpoint)
	}
	if endpoints.Dfs != nil {
		endpoint := strings.TrimSuffix(*endpoints.Dfs, "/")
		out.primaryDfsEndpoint = pointer.To(endpoint)
	}
	if endpoints.File != nil {
		endpoint := strings.TrimSuffix(*endpoints.File, "/")
		out.primaryFileEndpoint = pointer.To(endpoint)
	}
	if endpoints.Queue != nil {
		endpoint := strings.TrimSuffix(*endpoints.Queue, "/")
		out.primaryQueueEndpoint = pointer.To(endpoint)
	}
	if endpoints.Table != nil {
		endpoint := strings.TrimSuffix(*endpoints.Table, "/")
		out.primaryTableEndpoint = pointer.To(endpoint)
	}

	return &out, nil
}

// naiveStorageAccountBlobBaseURL naively construct the storage account blob endpoint URL instead of
// learning from the storage account response. This can be incorrect if private dns zone is used.
func naiveStorageAccountBlobBaseURL(e environments.Environment, accountName string) (string, error) {
	pDomainSuffix, ok := e.Storage.DomainSuffix()
	if !ok {
		return "", fmt.Errorf("no storage domain suffix defined for environment: %s", e.Name)
	}
	return fmt.Sprintf("https://%s.blob.%s", accountName, *pDomainSuffix), nil
}

```

### Core Architecture Module: `internal/backend/remote-state/consul/backend.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package consul

import (
	"net"
	"strings"
	"time"

	consulapi "github.com/hashicorp/consul/api"
	"github.com/zclconf/go-cty/cty"

	"github.com/hashicorp/terraform/internal/backend"
	"github.com/hashicorp/terraform/internal/backend/backendbase"
	"github.com/hashicorp/terraform/internal/configs/configschema"
	"github.com/hashicorp/terraform/internal/tfdiags"
)

// New creates a new backend for Consul remote state.
func New() backend.Backend {
	return &Backend{
		Base: backendbase.Base{
			Schema: &configschema.Block{
				Attributes: map[string]*configschema.Attribute{
					"path": {
						Type:        cty.String,
						Required:    true,
						Description: "Path to store state in Consul",
					},
					"access_token": {
						Type:        cty.String,
						Optional:    true,
						Description: "Access token for a Consul ACL",
					},
					"address": {
						Type:        cty.String,
						Optional:    true,
						Description: "Address to the Consul Cluster",
					},
					"scheme": {
						Type:        cty.String,
						Optional:    true,
						Description: "Scheme to communicate to Consul with",
					},
					"datacenter": {
						Type:        cty.String,
						Optional:    true,
						Description: "Datacenter to communicate with",
					},
					"http_auth": {
						Type:        cty.String,
						Optional:    true,
						Description: "HTTP Auth in the format of 'username:password'",
					},
					"gzip": {
						Type:        cty.Bool,
						Optional:    true,
						Description: "Compress the state data using gzip",
					},
					"lock": {
						Type:        cty.Bool,
						Optional:    true,
						Description: "Lock state access",
					},
					"ca_file": {
						Type:        cty.String,
						Optional:    true,
						Description: "A path to a PEM-encoded certificate authority used to verify the remote agent's certificate",
					},
					"cert_file": {
						Type:        cty.String,
						Optional:    true,
						Description: "A path to a PEM-encoded certificate provided to the remote agent; requires use of key_file",
					},
					"key_file": {
						Type:        cty.String,
						Optional:    true,
						Description: "A path to a PEM-encoded private key, required if cert_file is specified",
					},
				},
			},
		},
	}
}

type Backend struct {
	backendbase.Base

	// The fields below are set from configure
	client *consulapi.Client
	path   string
	gzip   bool
	lock   bool
}

func (b *Backend) Configure(configVal cty.Value) tfdiags.Diagnostics {
	b.path = configVal.GetAttr("path").AsString()
	b.gzip = backendbase.MustBoolValue(
		backendbase.GetAttrDefault(configVal, "gzip", cty.False),
	)
	b.lock = backendbase.MustBoolValue(
		backendbase.GetAttrDefault(configVal, "lock", cty.True),
	)

	// Configure the client
	config := consulapi.DefaultConfig()

	// replace the default Transport Dialer to reduce the KeepAlive
	config.Transport.DialContext = dialContext

	empty := cty.StringVal("")
	if v := backendbase.GetAttrDefault(configVal, "access_token", empty); v != empty {
		config.Token = v.AsString()
	}
	if v := backendbase.GetAttrDefault(configVal, "address", empty); v != empty {
		config.Address = v.AsString()
	}
	if v := backendbase.GetAttrDefault(configVal, "scheme", empty); v != empty {
		config.Scheme = v.AsString()
	}
	if v := backendbase.GetAttrDefault(configVal, "datacenter", empty); v != empty {
		config.Datacenter = v.AsString()
	}

	if v := backendbase.GetAttrEnvDefaultFallback(configVal, "ca_file", "CONSUL_CACERT", empty); v != empty {
		config.TLSConfig.CAFile = v.AsString()
	}
	if v := backendbase.GetAttrEnvDefaultFallback(configVal, "cert_file", "CONSUL_CLIENT_CERT", empty); v != empty {
		config.TLSConfig.CertFile = v.AsString()
	}
	if v := backendbase.GetAttrEnvDefaultFallback(configVal, "key_file", "CONSUL_CLIENT_KEY", empty); v != empty {
		config.TLSConfig.KeyFile = v.AsString()
	}

	if v := backendbase.GetAttrDefault(configVal, "http_auth", empty); v != empty {
		auth := v.AsString()

		var username, password string
		if strings.Contains(auth, ":") {
			split := strings.SplitN(auth, ":", 2)
			username = split[0]
			password = split[1]
		} else {
			username = auth
		}

		config.HttpAuth = &consulapi.HttpBasicAuth{
			Username: username,
			Password: password,
		}
	}

	client, err := consulapi.NewClient(config)
	if err != nil {
		return backendbase.ErrorAsDiagnostics(err)
	}

	b.client = client
	return nil
}

// dialContext is the DialContext function for the consul client transport.
// This is stored in a package var to inject a different dialer for tests.
var dialContext = (&net.Dialer{
	Timeout:   30 * time.Second,
	KeepAlive: 17 * time.Second,
}).DialContext

```

### Core Architecture Module: `internal/backend/remote-state/consul/backend_state.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package consul

import (
	"fmt"
	"strings"

	"github.com/hashicorp/terraform/internal/backend"
	"github.com/hashicorp/terraform/internal/states"
	"github.com/hashicorp/terraform/internal/states/remote"
	"github.com/hashicorp/terraform/internal/states/statemgr"
	"github.com/hashicorp/terraform/internal/tfdiags"
)

const (
	keyEnvPrefix = "-env:"
)

func (b *Backend) Workspaces() ([]string, tfdiags.Diagnostics) {
	var diags tfdiags.Diagnostics

	// List our raw path
	prefix := b.path + keyEnvPrefix
	keys, _, err := b.client.KV().Keys(prefix, "/", nil)
	if err != nil {
		return nil, diags.Append(err)
	}

	// Find the envs, we use a map since we can get duplicates with
	// path suffixes.
	envs := map[string]struct{}{}
	for _, key := range keys {
		// Consul should ensure this but it doesn't hurt to check again
		if strings.HasPrefix(key, prefix) {
			key = strings.TrimPrefix(key, prefix)

			// Ignore anything with a "/" in it since we store the state
			// directly in a key not a directory.
			if idx := strings.IndexRune(key, '/'); idx >= 0 {
				continue
			}

			envs[key] = struct{}{}
		}
	}

	result := make([]string, 1, len(envs)+1)
	result[0] = backend.DefaultStateName
	for k, _ := range envs {
		result = append(result, k)
	}

	return result, nil
}

func (b *Backend) DeleteWorkspace(name string, _ bool) tfdiags.Diagnostics {
	var diags tfdiags.Diagnostics

	if name == backend.DefaultStateName || name == "" {
		return diags.Append(fmt.Errorf("can't delete default state"))
	}

	// Determine the path of the data
	path := b.statePath(name)

	// Delete it. We just delete it without any locking since
	// the DeleteState API is documented as such.
	_, err := b.client.KV().Delete(path, nil)
	return diags.Append(err)
}

func (b *Backend) StateMgr(name string) (statemgr.Full, tfdiags.Diagnostics) {
	var diags tfdiags.Diagnostics
	// Determine the path of the data
	path := b.statePath(name)

	// Determine whether to gzip or not
	gzip := b.gzip

	// Build the state client
	var stateMgr = &remote.State{
		Client: &RemoteClient{
			Client:    b.client,
			Path:      path,
			GZip:      gzip,
			lockState: b.lock,
		},
	}

	if !b.lock {
		stateMgr.DisableLocks()
	}

	// the default state always exists
	if name == backend.DefaultStateName {
		return stateMgr, nil
	}

	// Grab a lock, we use this to write an empty state if one doesn't
	// exist already. We have to write an empty state as a sentinel value
	// so States() knows it exists.
	lockInfo := statemgr.NewLockInfo()
	lockInfo.Operation = "init"
	lockId, err := stateMgr.Lock(lockInfo)
	if err != nil {
		return nil, diags.Append(fmt.Errorf("failed to lock state in Consul: %s", err))
	}

	// Local helper function so we can call it multiple places
	lockUnlock := func(parent error) error {
		if err := stateMgr.Unlock(lockId); err != nil {
			return fmt.Errorf(strings.TrimSpace(errStateUnlock), lockId, err)
		}

		return parent
	}

	// Grab the value
	if err := stateMgr.RefreshState(); err != nil {
		err = lockUnlock(err)
		return nil, diags.Append(err)
	}

	// If we have no state, we have to create an empty state
	if v := stateMgr.State(); v == nil {
		if err := stateMgr.WriteState(states.NewState()); err != nil {
			err = lockUnlock(err)
			return nil, diags.Append(err)
		}
		if err := stateMgr.PersistState(nil); err != nil {
			err = lockUnlock(err)
			return nil, diags.Append(err)
		}
	}

	// Unlock, the state should now be initialized
	if err := lockUnlock(nil); err != nil {
		return nil, diags.Append(err)
	}

	return stateMgr, diags
}

func (b *Backend) statePath(name string) string {
	path := b.path
	if name != backend.DefaultStateName {
		path += fmt.Sprintf("%s%s", keyEnvPrefix, name)
	}

	return path
}

const errStateUnlock = `
Error unlocking Consul state. Lock ID: %s

Error: %s

You may have to force-unlock this state in order to use it again.
The Consul backend acquires a lock during initialization to ensure
the minimum required key/values are prepared.
`

```

### Core Architecture Module: `internal/backend/remote-state/consul/client.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package consul

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/md5"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	consulapi "github.com/hashicorp/consul/api"

	"github.com/hashicorp/terraform/internal/states/remote"
	"github.com/hashicorp/terraform/internal/states/statemgr"
	"github.com/hashicorp/terraform/internal/tfdiags"
)

const (
	lockSuffix     = "/.lock"
	lockInfoSuffix = "/.lockinfo"

	// The Session TTL associated with this lock.
	lockSessionTTL = "15s"

	// the delay time from when a session is lost to when the
	// lock is released by the server
	lockDelay = 5 * time.Second
	// interval between attempts to reacquire a lost lock
	lockReacquireInterval = 2 * time.Second
)

var lostLockErr = errors.New("consul lock was lost")

// RemoteClient is a remote client that stores data in Consul.
type RemoteClient struct {
	Client *consulapi.Client
	Path   string
	GZip   bool

	mu sync.Mutex
	// lockState is true if we're using locks
	lockState bool

	// The index of the last state we wrote.
	// If this is > 0, Put will perform a CAS to ensure that the state wasn't
	// changed during the operation. This is important even with locks, because
	// if the client loses the lock for some reason, then reacquires it, we
	// need to make sure that the state was not modified.
	modifyIndex uint64

	consulLock *consulapi.Lock
	lockCh     <-chan struct{}

	info *statemgr.LockInfo

	// cancel our goroutine which is monitoring the lock to automatically
	// reacquire it when possible.
	monitorCancel context.CancelFunc
	monitorWG     sync.WaitGroup

	// sessionCancel cancels the Context use for session.RenewPeriodic, and is
	// called when unlocking, or before creating a new lock if the lock is
	// lost.
	sessionCancel context.CancelFunc
}

func (c *RemoteClient) Get() (*remote.Payload, tfdiags.Diagnostics) {
	var diags tfdiags.Diagnostics

	c.mu.Lock()
	defer c.mu.Unlock()

	kv := c.Client.KV()

	chunked, hash, chunks, pair, err := c.chunkedMode()
	if err != nil {
		return nil, diags.Append(err)
	}
	if pair == nil {
		return nil, diags
	}

	c.modifyIndex = pair.ModifyIndex

	var payload []byte
	if chunked {
		for _, c := range chunks {
			pair, _, err := kv.Get(c, nil)
			if err != nil {
				return nil, diags.Append(err)
			}
			if pair == nil {
				return nil, diags.Append(fmt.Errorf("Key %q could not be found", c))
			}
			payload = append(payload, pair.Value[:]...)
		}
	} else {
		payload = pair.Value
	}

	// If the payload starts with 0x1f, it's gzip, not json
	if len(payload) >= 1 && payload[0] == '\x1f' {
		payload, err = uncompressState(payload)
		if err != nil {
			return nil, diags.Append(err)
		}
	}

	md5 := md5.Sum(payload)

	if hash != "" && fmt.Sprintf("%x", md5) != hash {
		return nil, diags.Append(fmt.Errorf("The remote state does not match the expected hash"))
	}

	return &remote.Payload{
		Data: payload,
		MD5:  md5[:],
	}, diags
}

func (c *RemoteClient) Put(data []byte) tfdiags.Diagnostics {
	// The state can be stored in 4 different ways, based on the payload size
	// and whether the user enabled gzip:
	//  - single entry mode with plain JSON: a single JSON is stored at
	//	  "tfstate/my_project"
	//  - single entry mode gzip: the JSON payload is first gziped and stored at
	//    "tfstate/my_project"
	//  - chunked mode with plain JSON: the JSON payload is split in pieces and
	//    stored like so:
	//       - "tfstate/my_project" -> a JSON payload that contains the path of
	//         the chunks and an MD5 sum like so:
	//              {
	//              	"current-hash": "abcdef1234",
	//              	"chunks": [
	//              		"tfstate/my_project/tfstate.abcdef1234/0",
	//              		"tfstate/my_project/tfstate.abcdef1234/1",
	//              		"tfstate/my_project/tfstate.abcdef1234/2",
	//              	]
	//              }
	//       - "tfstate/my_project/tfstate.abcdef1234/0" -> The first chunk
	//       - "tfstate/my_project/tfstate.abcdef1234/1" -> The next one
	//       - ...
	//  - chunked mode with gzip: the same system but we gziped the JSON payload
	//    before splitting it in chunks
	//
	// When overwritting the current state, we need to clean the old chunks if
	// we were in chunked mode (no matter whether we need to use chunks for the
	// new one). To do so based on the 4 possibilities above we look at the
	// value at "tfstate/my_project" and if it is:
	//  - absent then it's a new state and there will be nothing to cleanup,
	//  - not a JSON payload we were in single entry mode with gzip so there will
	// 	  be nothing to cleanup
	//  - a JSON payload, then we were either single entry mode with plain JSON
	//    or in chunked mode. To differentiate between the two we look whether a
	//    "current-hash" key is present in the payload. If we find one we were
	//    in chunked mode and we will need to remove the old chunks (whether or
	//    not we were using gzip does not matter in that case).

	var diags tfdiags.Diagnostics

	c.mu.Lock()
	defer c.mu.Unlock()

	kv := c.Client.KV()

	// First we determine what mode we were using and to prepare the cleanup
	chunked, hash, _, _, err := c.chunkedMode()
	if err != nil {
		return diags.Append(err)
	}
	cleanupOldChunks := func() {}
	if chunked {
		cleanupOldChunks = func() {
			// We ignore all errors that can happen here because we already
			// saved the new state and there is no way to return a warning to
			// the user. We may end up with dangling chunks but there is no way
			// to be sure we won't.
			path := strings.TrimRight(c.Path, "/") + fmt.Sprintf("/tfstate.%s/", hash)
			kv.DeleteTree(path, nil)
		}
	}

	payload := data
	if c.GZip {
		if compressedState, err := compressState(data); err == nil {
			payload = compressedState
		} else {
			return diags.Append(err)
		}
	}

	// default to doing a CAS
	verb := consulapi.KVCAS

	// Assume a 0 index doesn't need a CAS for now, since we are either
	// creating a new state or purposely overwriting one.
	if c.modifyIndex == 0 {
		verb = consulapi.KVSet
	}

	// The payload may be too large to store in a single KV entry in Consul. We
	// could try to determine whether it will fit or not before sending the
	// request but since we are using the Transaction API and not the KV API,
	// it grows by about a 1/3 when it is base64 encoded plus the overhead of
	// the fields specific to the Transaction API.
	// Rather than trying to calculate the overhead (which could change from
	// one version of Consul to another, and between Consul Community Edition
	// and Consul Enterprise), we try to send the whole state in one request, if
	// it fails because it is too big we then split it in chunks and send each
	// chunk separately.
	// When splitting in chunks, we make each chunk 524288 bits, which is the
	// default max size for raft. If the user changed it, we still may send
	// chunks too big and fail but this is not a setting that should be fiddled
	// with anyway.

	store := func(payload []byte) error {
		// KV.Put doesn't return the new index, so we use a single operation
		// transaction to get the new index with a single request.
		txOps := consulapi.KVTxnOps{
			&consulapi.KVTxnOp{
				Verb:  verb,
				Key:   c.Path,
				Value: payload,
				Index: c.modifyIndex,
			},
		}

		ok, resp, _, err := kv.Txn(txOps, nil)
		if err != nil {
			return err
		}
		// transaction was rolled back
		if !ok {
			var resultErr error
			for _, respError := range resp.Errors {
				resultErr = errors.Join(resultErr, errors.New(respError.What))
			}
			return fmt.Errorf("consul CAS failed with transaction errors: %w", resultErr)
		}

		if len(resp.Results) != 1 {
			// this probably shouldn't happen
			return fmt.Errorf("expected on 1 response value, got: %d", len(resp.Results))
		}

		c.modifyIndex = resp.Results[0].ModifyIndex

		// We remove all the old chunks
		cleanupOldChunks()

		return nil
	}

	if err = store(payload); err == nil {
		// The payload was small enough to be stored
		return diags
	} else if !strings.Contains(err.Error(), "too large") {
		// We failed for some other reason, report this to the user
		return diags.Append(err)
	}

	// The payload was too large so we split it in multiple chunks

	md5 := md5.Sum(data)
	chunks := split(payload, 524288)
	chunkPaths := make([]string, 0)

	// First we write the new chunks
	for i, p := range chunks {
		path := strings.TrimRight(c.Path, "/") + fmt.Sprintf("/tfstate.%x/%d", md5, i)
		chunkPaths = append(chunkPaths, path)
		_, err := kv.Put(&consulapi.KVPair{
			Key:   path,
			Value: p,
		}, nil)

		if err != nil {
			return diags.Append(err)
		}
	}

	// Then we update the link to point to the new chunks
	payload, err = json.Marshal(map[string]interface{}{
		"current-hash": fmt.Sprintf("%x", md5),
		"chunks":       chunkPaths,
	})
	if err != nil {
		return diags.Append(err)
	}
	return diags.Append(store(payload))
}

func (c *RemoteClient) Delete() tfdiags.Diagnostics {
	var diags tfdiags.Diagnostics
	c.mu.Lock()
	defer c.mu.Unlock()

	kv := c.Client.KV()

	chunked, hash, _, _, err := c.chunkedMode()
	if err != nil {
		return diags.Append(err)
	}

	_, err = kv.Delete(c.Path, nil)

	// If there were chunks we need to remove them
	if chunked {
		path := strings.TrimRight(c.Path, "/") + fmt.Sprintf("/tfstate.%s/", hash)
		kv.DeleteTree(path, nil)
	}

	return diags.Append(err)
}

func (c *RemoteClient) lockPath() string {
	// we sanitize the path for the lock as Consul does not like having
	// two consecutive slashes for the lock path
	return strings.TrimRight(c.Path, "/")
}

func (c *RemoteClient) putLockInfo(info *statemgr.LockInfo) error {
	info.Path = c.Path
	info.Created = time.Now().UTC()

	kv := c.Client.KV()
	_, err := kv.Put(&consulapi.KVPair{
		Key:   c.lockPath() + lockInfoSuffix,
		Value: info.Marshal(),
	}, nil)

	return err
}

func (c *RemoteClient) getLockInfo() (*statemgr.LockInfo, error) {
	path := c.lockPath() + lockInfoSuffix
	pair, _, err := 
```

### Core Architecture Module: `internal/backend/remote-state/cos/backend.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package cos

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/hashicorp/terraform/internal/backend"
	"github.com/hashicorp/terraform/internal/legacy/helper/schema"
	"github.com/mitchellh/go-homedir"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	sts "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/sts/v20180813"
	tag "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/tag/v20180813"
	"github.com/tencentyun/cos-go-sdk-v5"
)

// Default value from environment variable
const (
	PROVIDER_SECRET_ID                    = "TENCENTCLOUD_SECRET_ID"
	PROVIDER_SECRET_KEY                   = "TENCENTCLOUD_SECRET_KEY"
	PROVIDER_SECURITY_TOKEN               = "TENCENTCLOUD_SECURITY_TOKEN"
	PROVIDER_REGION                       = "TENCENTCLOUD_REGION"
	PROVIDER_ENDPOINT                     = "TENCENTCLOUD_ENDPOINT"
	PROVIDER_DOMAIN                       = "TENCENTCLOUD_DOMAIN"
	PROVIDER_ASSUME_ROLE_ARN              = "TENCENTCLOUD_ASSUME_ROLE_ARN"
	PROVIDER_ASSUME_ROLE_SESSION_NAME     = "TENCENTCLOUD_ASSUME_ROLE_SESSION_NAME"
	PROVIDER_ASSUME_ROLE_SESSION_DURATION = "TENCENTCLOUD_ASSUME_ROLE_SESSION_DURATION"
	PROVIDER_ASSUME_ROLE_EXTERNAL_ID      = "TENCENTCLOUD_ASSUME_ROLE_EXTERNAL_ID"
	PROVIDER_SHARED_CREDENTIALS_DIR       = "TENCENTCLOUD_SHARED_CREDENTIALS_DIR"
	PROVIDER_PROFILE                      = "TENCENTCLOUD_PROFILE"
	PROVIDER_CAM_ROLE_NAME                = "TENCENTCLOUD_CAM_ROLE_NAME"
)

const (
	DEFAULT_PROFILE = "default"
)

// Backend implements "backend".Backend for tencentCloud cos
type Backend struct {
	*schema.Backend
	credential *common.Credential

	cosContext context.Context
	cosClient  *cos.Client
	tagClient  *tag.Client
	stsClient  *sts.Client

	region  string
	bucket  string
	prefix  string
	key     string
	encrypt bool
	acl     string
	domain  string
}

type CAMResponse struct {
	TmpSecretId  string `json:"TmpSecretId"`
	TmpSecretKey string `json:"TmpSecretKey"`
	ExpiredTime  int64  `json:"ExpiredTime"`
	Expiration   string `json:"Expiration"`
	Token        string `json:"Token"`
	Code         string `json:"Code"`
}

// New creates a new backend for TencentCloud cos remote state.
func New() backend.Backend {
	s := &schema.Backend{
		Schema: map[string]*schema.Schema{
			"secret_id": {
				Type:        schema.TypeString,
				Optional:    true,
				DefaultFunc: schema.EnvDefaultFunc(PROVIDER_SECRET_ID, nil),
				Description: "Secret id of Tencent Cloud",
			},
			"secret_key": {
				Type:        schema.TypeString,
				Optional:    true,
				DefaultFunc: schema.EnvDefaultFunc(PROVIDER_SECRET_KEY, nil),
				Description: "Secret key of Tencent Cloud",
				Sensitive:   true,
			},
			"security_token": {
				Type:        schema.TypeString,
				Optional:    true,
				DefaultFunc: schema.EnvDefaultFunc(PROVIDER_SECURITY_TOKEN, nil),
				Description: "TencentCloud Security Token of temporary access credentials. It can be sourced from the `TENCENTCLOUD_SECURITY_TOKEN` environment variable. Notice: for supported products, please refer to: [temporary key supported products](https://intl.cloud.tencent.com/document/product/598/10588).",
				Sensitive:   true,
			},
			"region": {
				Type:         schema.TypeString,
				Required:     true,
				DefaultFunc:  schema.EnvDefaultFunc(PROVIDER_REGION, nil),
				Description:  "The region of the COS bucket",
				InputDefault: "ap-guangzhou",
			},
			"bucket": {
				Type:        schema.TypeString,
				Required:    true,
				Description: "The name of the COS bucket",
			},
			"endpoint": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The custom endpoint for the COS API, e.g. http://cos-internal.{Region}.tencentcos.cn. Both HTTP and HTTPS are accepted.",
				DefaultFunc: schema.EnvDefaultFunc(PROVIDER_ENDPOINT, nil),
			},
			"domain": {
				Type:        schema.TypeString,
				Optional:    true,
				DefaultFunc: schema.EnvDefaultFunc(PROVIDER_DOMAIN, nil),
				Description: "The root domain of the API request. Default is tencentcloudapi.com.",
			},
			"prefix": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The directory for saving the state file in bucket",
				ValidateFunc: func(v interface{}, s string) ([]string, []error) {
					prefix := v.(string)
					if strings.HasPrefix(prefix, "/") || strings.HasPrefix(prefix, "./") {
						return nil, []error{fmt.Errorf("prefix must not start with '/' or './'")}
					}
					return nil, nil
				},
			},
			"key": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "The path for saving the state file in bucket",
				Default:     "terraform.tfstate",
				ValidateFunc: func(v interface{}, s string) ([]string, []error) {
					if strings.HasPrefix(v.(string), "/") || strings.HasSuffix(v.(string), "/") {
						return nil, []error{fmt.Errorf("key can not start and end with '/'")}
					}
					return nil, nil
				},
			},
			"encrypt": {
				Type:        schema.TypeBool,
				Optional:    true,
				Description: "Whether to enable server side encryption of the state file",
				Default:     true,
			},
			"acl": {
				Type:        schema.TypeString,
				Optional:    true,
				Description: "Object ACL to be applied to the state file",
				Default:     "private",
				ValidateFunc: func(v interface{}, s string) ([]string, []error) {
					value := v.(string)
					if value != "private" && value != "public-read" {
						return nil, []error{fmt.Errorf(
							"acl value invalid, expected %s or %s, got %s",
							"private", "public-read", value)}
					}
					return nil, nil
				},
			},
			"accelerate": {
				Type:        schema.TypeBool,
				Optional:    true,
				Description: "Whether to enable global Acceleration",
				Default:     false,
			},
			"assume_role": {
				Type:        schema.TypeSet,
				Optional:    true,
				MaxItems:    1,
				Description: "The `assume_role` block. If provided, terraform will attempt to assume this role using the supplied credentials.",
				Elem: &schema.Resource{
					Schema: map[string]*schema.Schema{
						"role_arn": {
							Type:        schema.TypeString,
							Required:    true,
							DefaultFunc: schema.EnvDefaultFunc(PROVIDER_ASSUME_ROLE_ARN, nil),
							Description: "The ARN of the role to assume. It can be sourced from the `TENCENTCLOUD_ASSUME_ROLE_ARN`.",
						},
						"session_name": {
							Type:        schema.TypeString,
							Required:    true,
							DefaultFunc: schema.EnvDefaultFunc(PROVIDER_ASSUME_ROLE_SESSION_NAME, nil),
							Description: "The session name to use when making the AssumeRole call. It can be sourced from the `TENCENTCLOUD_ASSUME_ROLE_SESSION_NAME`.",
						},
						"session_duration": {
							Type:     schema.TypeInt,
							Required: true,
							DefaultFunc: func() (interface{}, error) {
								if v := os.Getenv(PROVIDER_ASSUME_ROLE_SESSION_DURATION); v != "" {
									return strconv.Atoi(v)
								}
								return 7200, nil
							},
							ValidateFunc: validateIntegerInRange(0, 43200),
							Description:  "The duration of the session when making the AssumeRole call. Its value ranges from 0 to 43200(seconds), and default is 7200 seconds. It can be sourced from the `TENCENTCLOUD_ASSUME_ROLE_SESSION_DURATION`.",
						},
						"policy": {
							Type:        schema.TypeString,
							Optional:    true,
							Description: "A more restrictive policy when making the AssumeRole call. Its content must not contains `principal` elements. Notice: more syntax references, please refer to: [policies syntax logic](https://intl.cloud.tencent.com/document/product/598/10603).",
						},
						"external_id": {
							Type:        schema.TypeString,
							Optional:    true,
							DefaultFunc: schema.EnvDefaultFunc(PROVIDER_ASSUME_ROLE_EXTERNAL_ID, nil),
							Description: "External role ID, which can be obtained by clicking the role name in the CAM console. It can contain 2-128 letters, digits, and symbols (=,.@:/-). Regex: [\\w+=,.@:/-]*. It can be sourced from the `TENCENTCLOUD_ASSUME_ROLE_EXTERNAL_ID`.",
						},
					},
				},
			},
			"shared_credentials_dir": {
				Type:        schema.TypeString,
				Optional:    true,
				DefaultFunc: schema.EnvDefaultFunc(PROVIDER_SHARED_CREDENTIALS_DIR, nil),
				Description: "The directory of the shared credentials. It can also be sourced from the `TENCENTCLOUD_SHARED_CREDENTIALS_DIR` environment variable. If not set this defaults to ~/.tccli.",
			},
			"profile": {
				Type:        schema.TypeString,
				Optional:    true,
				DefaultFunc: schema.EnvDefaultFunc(PROVIDER_PROFILE, nil),
				Description: "The profile name as set in the shared credentials. It can also be sourced from the `TENCENTCLOUD_PROFILE` environment variable. If not set, the default profile created with `tccli configure` will be used.",
			},
			"cam_role_name": {
				Type:        schema.TypeString,
				Optional:    true,
				DefaultFunc: schema.EnvDefaultFunc(PROVIDER_CAM_ROLE_NAME, nil),
				Description: "The name of the CVM instance CAM role. It can be sourced from the `TENCENTCLOUD_CAM_ROLE_NAME` environment variable.",
			},
		},
	}

	result := &Backend{Backend: s}
	result.Backend.ConfigureFunc = result.configure

	return result
}

func validateIntegerInRange(min, max int64) schema.SchemaValidateFunc {
	return func(v interface{}, k string) (ws []string, errors []error) {
		value := int64(v.(int))
		if value < min {
			errors = append(errors, fmt.Errorf(
				"%q cannot be lower than %d: %d", k, min, value))
		}
		if value > max {
			errors = append(errors, fmt.Errorf(
				"%q cannot be higher than %d: %d", k, max, value))
		}
		return
	}
}

// configure init cos client
func (b *Backend) configure(ctx context.Context) error {
	if b.cosClient != nil {
		return nil
	}

	b.cosContext =
```

### Core Architecture Module: `internal/backend/remote-state/cos/backend_state.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package cos

import (
	"fmt"
	"log"
	"path"
	"sort"
	"strings"

	"github.com/hashicorp/terraform/internal/backend"
	"github.com/hashicorp/terraform/internal/states"
	"github.com/hashicorp/terraform/internal/states/remote"
	"github.com/hashicorp/terraform/internal/states/statemgr"
	"github.com/hashicorp/terraform/internal/tfdiags"
)

// Define file suffix
const (
	stateFileSuffix = ".tfstate"
	lockFileSuffix  = ".tflock"
)

// Workspaces returns a list of names for the workspaces
func (b *Backend) Workspaces() ([]string, tfdiags.Diagnostics) {
	var diags tfdiags.Diagnostics

	c, err := b.client("tencentcloud")
	if err != nil {
		return nil, diags.Append(err)
	}

	obs, err := c.getBucket(b.prefix)
	log.Printf("[DEBUG] list all workspaces, objects: %v, error: %v", obs, err)
	if err != nil {
		return nil, diags.Append(err)
	}

	ws := []string{backend.DefaultStateName}
	for _, vv := range obs {
		// <name>.tfstate
		if !strings.HasSuffix(vv.Key, stateFileSuffix) {
			continue
		}
		// default worksapce
		if path.Join(b.prefix, b.key) == vv.Key {
			continue
		}
		// <prefix>/<worksapce>/<key>
		prefix := strings.TrimRight(b.prefix, "/") + "/"
		parts := strings.Split(strings.TrimPrefix(vv.Key, prefix), "/")
		if len(parts) > 0 && parts[0] != "" {
			ws = append(ws, parts[0])
		}
	}

	sort.Strings(ws[1:])
	log.Printf("[DEBUG] list all workspaces, workspaces: %v", ws)

	return ws, diags
}

// DeleteWorkspace deletes the named workspaces. The "default" state cannot be deleted.
func (b *Backend) DeleteWorkspace(name string, _ bool) tfdiags.Diagnostics {
	var diags tfdiags.Diagnostics
	log.Printf("[DEBUG] delete workspace, workspace: %v", name)

	if name == backend.DefaultStateName || name == "" {
		return tfdiags.Diagnostics{}.Append(fmt.Errorf("default state is not allowed to be deleted"))
	}

	c, err := b.client(name)
	if err != nil {
		return diags.Append(err)
	}

	return diags.Append(c.Delete())
}

// StateMgr manage the state, if the named state not exists, a new file will created
func (b *Backend) StateMgr(name string) (statemgr.Full, tfdiags.Diagnostics) {
	var diags tfdiags.Diagnostics
	log.Printf("[DEBUG] state manager, current workspace: %v", name)

	c, err := b.client(name)
	if err != nil {
		return nil, diags.Append(err)
	}
	stateMgr := &remote.State{Client: c}

	ws, wDiags := b.Workspaces()
	diags = diags.Append(wDiags)
	if wDiags.HasErrors() {
		return nil, diags
	}

	exists := false
	for _, candidate := range ws {
		if candidate == name {
			exists = true
			break
		}
	}

	if !exists {
		log.Printf("[DEBUG] workspace %v not exists", name)

		// take a lock on this state while we write it
		lockInfo := statemgr.NewLockInfo()
		lockInfo.Operation = "init"
		lockId, err := c.Lock(lockInfo)
		if err != nil {
			return nil, diags.Append(fmt.Errorf("Failed to lock cos state: %s", err))
		}

		// Local helper function so we can call it multiple places
		lockUnlock := func(e error) error {
			if err := stateMgr.Unlock(lockId); err != nil {
				return fmt.Errorf(unlockErrMsg, err, lockId)
			}
			return e
		}

		// Grab the value
		if err := stateMgr.RefreshState(); err != nil {
			err = lockUnlock(err)
			return nil, diags.Append(err)
		}

		// If we have no state, we have to create an empty state
		if v := stateMgr.State(); v == nil {
			if err := stateMgr.WriteState(states.NewState()); err != nil {
				err = lockUnlock(err)
				return nil, diags.Append(err)
			}
			if err := stateMgr.PersistState(nil); err != nil {
				err = lockUnlock(err)
				return nil, diags.Append(err)
			}
		}

		// Unlock, the state should now be initialized
		if err := lockUnlock(nil); err != nil {
			return nil, diags.Append(err)
		}
	}

	return stateMgr, diags
}

// client returns a remoteClient for the named state.
func (b *Backend) client(name string) (*remoteClient, error) {
	if strings.TrimSpace(name) == "" {
		return nil, fmt.Errorf("state name not allow to be empty")
	}

	return &remoteClient{
		cosContext: b.cosContext,
		cosClient:  b.cosClient,
		tagClient:  b.tagClient,
		bucket:     b.bucket,
		stateFile:  b.stateFile(name),
		lockFile:   b.lockFile(name),
		encrypt:    b.encrypt,
		acl:        b.acl,
	}, nil
}

// stateFile returns state file path by name
func (b *Backend) stateFile(name string) string {
	if name == backend.DefaultStateName {
		return path.Join(b.prefix, b.key)
	}
	return path.Join(b.prefix, name, b.key)
}

// lockFile returns lock file path by name
func (b *Backend) lockFile(name string) string {
	return b.stateFile(name) + lockFileSuffix
}

// unlockErrMsg is error msg for unlock failed
const unlockErrMsg = `
Unlocking the state file on TencentCloud cos backend failed:

Error message: %v
Lock ID (gen): %s

You may have to force-unlock this state in order to use it again.
The TencentCloud backend acquires a lock during initialization
to ensure the initial state file is created.
`

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #39302** (2026-09-28): **Terraform crashing when insufficient resources in the pool of vcenter to poweron vm**
  *Symptoms*: ### Terraform Version  ```shell Terraform v1.16.4 on windows_amd64 + provider registry.terraform.io/vmware/vsphere v2.17.1 ```  ### Terraform Configuration Files  ```terraform ...terraform config... ```   ### Debug Output  !!!!!!!!!!!!!!!!!!!!!!!!!!! TERRAFORM CRASH !!!!!!!!!!!!!!!!!!!!!!!!!!!!  Terraform crashed! This is always indicative of a bug within Terraform. Please report the crash with Terraform[1] so that we can fix this.  When reporting bugs, please include your terraform version, the stack trace shown below, and any additional information which may help replicate the issue.  [1]: https://github.com/hashicorp/terraform/issues  !!!!!!!!!!!!!!!!!!!!!!!!!!! TERRAFORM CRASH !!!!!!!!!!!!!!!!!!!!!!!!!!!!  panic: 3 problems:  - Failed to serialize resource instance in state: Instance vsphere_virtual_machine.vm["anonvm-46.anon.an.anonym.com"] has status ObjectStatus(0), which cannot be saved in state. - Failed to serialize resource instance in state: Instance vsphere_virtual_machine.vm["anonvm-23.anon.an.anonym.com"] has status ObjectStatus(0), which cannot be saved in state. - Failed to serialize resource instance in state: Instance vsphere_virtual_machine.vm["anonvm-42.anon.an.anonym.com"] has status ObjectStatus(0), which cannot be saved in state. goroutine 563 [running]: runtime/debug.Stack()         runtime/debug/stack.go:26 +0x5e github.com/hashicorp/terraform/internal/logging.PanicHandler()         github.com/hashicorp/terraform/internal/logging/panic.go:84 +0x18a p
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report! This will be fixed in the upcoming v1.16.5 release this week

- **Issue #39285** (2026-09-25): **Identity is nil in DELETE during requires-replace**
  *Symptoms*: ### Terraform Version  ```shell Terraform v1.16.4 on windows_amd64 ```  ### Terraform Configuration Files  create: ```terraform resource "example_thing" "test" {   group = "a" } ``` update: ```terraform resource "example_thing" "test" {   group = "b" } ```  ### Debug Output  I think an example makes more sense here, as it can easily be reproduced https://gist.github.com/Kirdock/1a2467904a95aa4e0db59381cdbcd7aa   ### Expected Behavior  The identity exists and can be used in DELETE during requires-replace  ### Actual Behavior  The identity is nil in DELETE during requires-replace  ### Steps to Reproduce  1. Create a resource that has a field for requires replace (terraform init, apply) 2. Update a field that triggers the requires-replace (terraform apply) and try to access the identity within DELETE  ### Additional Context  _No response_  ### References  _No response_  ### Generative AI / LLM assisted development?  Used Claude code with Opus 4.8 to write a test file and mock client for the bug we found. First investigation: it pointed out that the bug is here https://github.com/hashicorp/terraform/blob/main/internal/terraform/node_resource_abstract_instance.go#L2735  ``` Why it's inconsistent Plain destroy → AfterIdentity = resp.PlannedIdentity → non-null → works. Replace destroy → Simplify hard-nulls AfterIdentity → provider sees nil.  Simplify nulling AfterIdentity is semantically correct (a Delete has no "after"). The defect is on the consuming side: the apply request should
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this @Kirdock and extra special Friday thanks for the doubletake caused by your user name 😂 

- **Issue #39283** (2026-09-25): **proxmox apply crash**
  *Symptoms*: ### Terraform Version  ```shell !!!!!!!!!!!!!!!!!!!!!!!!!!! TERRAFORM CRASH !!!!!!!!!!!!!!!!!!!!!!!!!!!!  panic: Failed to serialize resource instance in state: Instance proxmox_virtual_environment_vm.test[2] has status ObjectStatus(0), which cannot be saved in state. goroutine 154 [running]: runtime/debug.Stack()         runtime/debug/stack.go:26 +0x83 github.com/hashicorp/terraform/internal/logging.PanicHandler()         github.com/hashicorp/terraform/internal/logging/panic.go:84 +0x148 panic({0xbe5d160, 0x1240ee20})         runtime/panic.go:860 +0x10b github.com/hashicorp/terraform/internal/terraform.(*Graph).walk.func1.1()         github.com/hashicorp/terraform/internal/terraform/graph.go:59 +0x46d panic({0xbe5d160, 0x1240ee20})         runtime/panic.go:860 +0x10b github.com/hashicorp/terraform/internal/states/statefile.StatesMarshalEqual(0x123b45e0, 0x12033820)         github.com/hashicorp/terraform/internal/states/statefile/marshal_equal.go:34 +0x172 github.com/hashicorp/terraform/internal/states/statemgr.(*Filesystem).writeState(0x11ff1800, 0x123b45e0, 0x0)         github.com/hashicorp/terraform/internal/states/statemgr/filesystem.go:154 +0xcc github.com/hashicorp/terraform/internal/states/statemgr.(*Filesystem).WriteState(0x11ff1800, 0x123b45e0)         github.com/hashicorp/terraform/internal/states/statemgr/filesystem.go:140 +0x97 github.com/hashicorp/terraform/internal/backend/local.(*StateHook).PostStateUpdate(0x11ff17c0, 0x123b45e0)         github.com/hashicorp/te
  **Post-Mortem & Fix Analysis**:
  > Hi @witkacy26 , thanks for reporting this, and sorry about the panic! That's an interesting one, too - Can you add any additional information to help us reproduce this panic? What version of terraform were you running at the time? Is it something that can be reproduced with an example configuration? Can you share the relevant configuration and trace logs from terraform apply (removing any sensitive info)? 
  > Hi @witkacy26,  Knowing the recent changes in that area, I think I see what might be going on, but some confirmation might help. Do you have any logs or errors associated with the `proxmox_virtual_environment_vm.test`?
  > On 2026-09-24 21:11, James Bardin wrote: > jbardin left a comment (hashicorp/terraform#39283) [1] >  > Hi @witkacy26 [2], >  > Knowing the recent changes in that area, I think I see what might be > going on, but some confirmation might help. Do you have any logs or > errors associated with the proxmox_virtual_environment_vm.test? >    Hi guys, thank you for quick response.  I'll try to provide you with more information, that might be useful for  you.  I'm new to Proxmox, doing some experiments and seeing what I can do with  it. I've got this error once.  This is my details:  ``` ***@***.***:~/aws/create_instance/terraform/proxmox/00-test$ uname -a uname -m dpkg --print-architecture cat /etc/os-release Linux severianus 6.1.0-52-686-pae #1 SMP PREEMPT_DYNAMIC Debian  6.1.180-1 (2026-08-03) i686 GNU/Linux i686 i386 PRETTY_NAME="Debian GNU/Linux 12 (bookworm)" NAME="Debian GNU/Linux" VERSION_ID="12" VERSION="12 (bookworm)" VERSION_CODENAME=bookworm ID=debian HOME_URL="https://www.debian.or

- **Issue #39265** (2026-09-22): **Module published successfully but not visible on registry; unable to delete or re-publish**
  *Symptoms*: ### Terraform Version  ```shell v1.15.4 ```  ### Terraform Configuration Files  I'm writing to report what appears to be a bug in the Terraform Registry module publishing flow.  **What happened:**  - I published a new module (auth0/modules/auth0) from the GitHub repository auth0/terraform-auth0-modules via the Registry UI. - The publish flow completed without errors and showed a success state. - However, the module does not appear in search results and the canonical module URL returns an error (or empty state): https://registry.terraform.io/modules/auth0/modules/auth0   **Current state:**  - The module cannot be found via registry search. - The module page at the URL above does not load correctly. - The Registry UI does not offer an option to delete and re-publish the module, leaving it stuck in an invisible but apparently registered state.  **Impact**: The module is effectively unusable and unrecoverable without backend intervention on HashiCorp's side.  I've attached screenshots showing the broken module page, and the search returning no results.  Please let me know if you need additional information or access details. Thanks   ### Expected behavior  Module page should load, allow for delete and republish  ### Registry URL  https://registry.terraform.io/modules/auth0/modules/auth0    ### Debug Output  Attach screenshots above.  ### Expected Behavior  Module should publish successfully and load the UI.  ### Actual Behavior  ### Screenshots  Says module already exist, but whe
  **Post-Mortem & Fix Analysis**:
  > Issue similar to https://github.com/hashicorp/terraform/issues/22925  https://github.com/hashicorp/terraform/issues/30691 CC: @findkim 
  > Hi @duedares-rvj , I'm sorry you've run into this issue! Unfortunately the registry team does not watch this repository for issues. Please report issues with the Terraform Registry to [terraform-registry@hashicorp.com](mailto:terraform-registry@hashicorp.com). Thanks, and sorry we couldn't help! 
  > @mildwonkey We did email them but have had no response yet.  Would there be another channel via which I could request support?

- **Issue #39248** (2026-09-18): **🤖🤖🤖 backend/azure: follow NextMarker to paginate workspaces**
  *Symptoms*: ## Description  Fixes #35703  When listing workspaces in the `azurerm` backend, Azure Blob Storage returns an XML response containing `<Blobs>` and optionally `<NextMarker>`. If the blob listing spans across multiple pages (e.g., large workspace count or partition boundaries on the Azure storage side), Azure Blob Storage provides a `NextMarker` element indicating that follow-up requests are required to fetch subsequent pages.  Previously, `(*Backend).Workspaces()` in `internal/backend/remote-state/azure/backend_state.go` only executed a single `client.ListBlobs(...)` call, completely ignoring `resp.NextMarker`. As a result, only workspaces present on the first page were listed, omitting all workspaces on subsequent pages.  This PR updates `(*Backend).Workspaces()` to follow `NextMarker` in a loop, updating `params.Marker = resp.NextMarker` until all pages are retrieved.  ## Testing  Added a deterministic unit test `TestBackendWorkspaces_pagination` in `internal/backend/remote-state/azure/backend_test.go`: - Uses `net/http/httptest` to mock Azure Blob Storage XML responses without requiring live Azure credentials. - Serves two pages of results (first page containing `workspace-one` and `<NextMarker>token-page-2</NextMarker>`, second page containing `workspace-two`). - Verifies that `Workspaces()` follows the continuation marker and returns all workspaces (`["default", "workspace-one", "workspace-two"]`). - Fails without this fix (only returning `["default", "workspace-one"]`) 
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for the submission. As this bypassed the normally required process as outlined in [CONTRIBUTING.md](https://github.com/hashicorp/terraform/blob/main/.github/CONTRIBUTING.md), particularly [Proposing a change](https://github.com/hashicorp/terraform/blob/main/.github/CONTRIBUTING.md#proposing-a-change), I am going to close this pull request. I'd suggest first, in the issue, establishing if the maintainers are open to reviewing a change in this area and then following the guidelines in Contributing.md. Thanks again!
  > Understood, thanks for the guidance @crw. I apologize for jumping ahead and bypassing the proposal process. I will follow up directly in #35703 to establish if the maintainers are open to reviewing a change in this area before proceeding. Thanks!

- **Issue #39235** (2026-09-16): **1.16.3 release artifacts served with Content-Type: binary/octet-stream, breaking Atlantis and other content-type-validating downloaders**
  *Symptoms*: ### Terraform Version  ``` Terraform v1.16.3 on darwin_arm64 ```  The defect is in how the 1.16.3 release artifacts are served, not in the Terraform binary. 1.16.2 and 1.16.1 are unaffected.  ### Terraform Configuration Files  Not configuration-dependent. This reproduces with `curl` alone, before any Terraform configuration is involved.  ### Debug Output  Every artifact in the 1.16.3 release on `releases.hashicorp.com` is served with `Content-Type: binary/octet-stream`:  ``` $ curl -sSI https://releases.hashicorp.com/terraform/1.16.3/terraform_1.16.3_linux_amd64.zip | grep -i content-type content-type: binary/octet-stream  $ curl -sSI https://releases.hashicorp.com/terraform/1.16.3/terraform_1.16.3_darwin_arm64.zip | grep -i content-type content-type: binary/octet-stream  $ curl -sSI https://releases.hashicorp.com/terraform/1.16.3/terraform_1.16.3_SHA256SUMS | grep -i content-type content-type: binary/octet-stream ```  The previous release is correct:  ``` $ curl -sSI https://releases.hashicorp.com/terraform/1.16.2/terraform_1.16.2_linux_amd64.zip | grep -i content-type content-type: application/zip ```  Downstream, Atlantis fails every plan with:  ``` error downloading terraform version 1.16.3: unexpected content-type: binary/octet-stream (expected any of ["application/x-zip-compressed" "application/zip"]) ```  ### Expected Behavior  `.zip` artifacts served as `application/zip` and `SHA256SUMS` as `text/plain`, consistent with 1.16.2 and every earlier release.  ### Actual Be
  **Post-Mortem & Fix Analysis**:
  > Thanks for this report, I have notified the internal release engineering team
  > This is breaking all our pipelines used to deploy infrastructure in more than 400 aws/azure accounts/suscriptions 
  > Thanks for the quick acknowledgment — I know it's only been a short while since this was reported and there hasn't been time for a full patch-release cycle yet, so this isn't a complaint about response speed. I'd like to make a case for a process change while you're still working the fix, rather than just about this one incident.  Terraform's own default resolution behavior is to always pull the newest matching version — nothing in the standard toolchain (bare `terraform init`, most CI images, tools like Atlantis/tenv/tfswitch without an explicit pin) defaults to a locked version. That means the moment a broken artifact is published, it becomes the silent default for every unpinned consumer, with zero opt-in required to be affected. Given how heavily Terraform is embedded in CI/CD pipelines industry-wide, that propagation is close to instantaneous and completely invisible until something breaks.  The standard response pattern — leave the broken release live and ship a fix forward — is 

- **Issue #39230** (2026-09-28): **A dangling symlink makes fileset() fail and discard every other match**
  *Symptoms*: ### Terraform Version  ```shell Terraform v1.18.0-dev on darwin_arm64 ```  (Built from `main` at `f8e7458f5`. The code path is unchanged in released versions.)  ### Terraform Configuration Files  ```terraform output "files" {   value = fileset(path.module, "*.txt") } ```  with, in the same directory:  ``` real.txt                 # an ordinary file dangling.txt -> gone.txt # a symlink whose target does not exist ```  ### Debug Output  ```console $ ls -la lrwxr-xr-x  1 user  staff  ...  dangling.txt -> /tmp/tffileset/gone.txt -rw-r--r--  1 user  staff    3  real.txt  $ echo 'fileset(path.cwd, "*.txt")' | terraform console ╷ │ Error: Error in function call │ │   on <console-input> line 1: │   (source code not available) │ │ Call to function "fileset" failed: failed to stat │ "/tmp/tffileset/dangling.txt": stat /tmp/tffileset/dangling.txt: no such │ file or directory. ╵ ```  ### Expected Behavior  ``` toset([   "real.txt", ]) ```  A symlink whose target is missing is not a regular file, so it cannot be a member of the result either way. Every other path that matched the pattern should still be returned.  ### Actual Behavior  The call fails, and **no** file is returned — `real.txt` is lost along with the broken link. One unresolvable name in a matched directory takes the whole `fileset` result with it.  ### Steps to Reproduce  ```console mkdir /tmp/tffileset && cd /tmp/tffileset echo hi > real.txt ln -s /tmp/tffileset/gone.txt dangling.txt echo 'fileset(path.cwd, "*.txt")' | terr
  **Post-Mortem & Fix Analysis**:
  > Thanks for this report! I was able to reproduce using the steps provided. 
  > Thanks for reproducing it.  @crw pointed out on #39231 that I jumped the queue by opening a PR before asking here, so asking properly: **would you be open to a community fix in this area**, or is `MakeFileSetFunc` something you would rather change yourselves?  The shape I have working, so the answer is cheap to give:  ```go fi, err := os.Stat(path) if err != nil {     if errors.Is(err, fs.ErrNotExist) {         continue     }     return cty.UnknownVal(cty.Set(cty.String)), fmt.Errorf("failed to stat %q: %w", path, err) } ```  Deliberately narrowed to `fs.ErrNotExist` rather than a blanket `if err != nil { continue }`: a name that does not resolve cannot be a regular file, so the very next `if !fi.Mode().IsRegular() { continue }` would have dropped it anyway, and dropping it early costs nothing. A stat that fails for another reason — a permission problem on a parent directory, say — still surfaces, because there the file may well exist and be a readable regular file, and swallowing that

- **Issue #39228** (2026-09-21): **textdecodebase64 rejects any string containing U+FFFD, so it cannot decode what textencodebase64 produced**
  *Symptoms*: ### Terraform Version  ```shell Terraform v1.18.0-dev on darwin_arm64 ```  (Built from `main` at `f8e7458f5`. The code path is unchanged since the function was introduced, so released versions behave the same.)  ### Terraform Configuration Files  ```terraform output "encoded" {   # A string that contains U+FFFD REPLACEMENT CHARACTER.   value = textencodebase64("caf�", "UTF-8") }  output "round_trip" {   value = textdecodebase64(textencodebase64("caf�", "UTF-8"), "UTF-8") } ```  ### Debug Output  Reproduced in `terraform console`, one expression per invocation:  ```console $ echo 'textencodebase64("caf�", "UTF-8")' | terraform console "Y2Fm77+9"  $ echo 'textdecodebase64("Y2Fm77+9", "UTF-8")' | terraform console ╷ │ Error: Invalid function argument │ │   on <console-input> line 1: │   (source code not available) │ │ Invalid value for "source" parameter: the given string contains symbols │ that are not defined for UTF-8. ╵  $ echo 'base64decode("Y2Fm77+9")' | terraform console "caf�" ```  ### Expected Behavior  `textdecodebase64("Y2Fm77+9", "UTF-8")` returns `"caf�"`.  `Y2Fm77+9` is the base64 of `63 61 66 EF BF BD` — four well-formed UTF-8 characters, the last being U+FFFD REPLACEMENT CHARACTER. Nothing about it is undefined for UTF-8, and `textencodebase64` produced that exact string one line earlier. `base64decode`, which takes the same bytes and also requires valid UTF-8, returns the string without complaint.  ### Actual Behavior  The call fails with *"the given string cont
  **Post-Mortem & Fix Analysis**:
  > Thanks for this report! Note that I am able to easily reproduce this issue with the instructions provided. 
  > Thanks for reproducing it.  On #39229 @crw pointed out that I opened a PR before asking here, so I am asking properly now: **would you be open to a community fix for `textdecodebase64`**, or would you rather change `TextDecodeBase64Func` yourselves?  Here is the shape I have working, so the question is quick to answer:  ```go decoded, err := decoder.Bytes(sDec) if err != nil || (bytes.ContainsRune(decoded, utf8.RuneError) && !decodedFaithfully(encoding, sDec, decoded)) { ```  `decodedFaithfully` encodes `decoded` again with the same encoding and compares the result with `sDec` byte for byte. A U+FFFD the decoder substituted cannot reproduce the byte it replaced; one the source really contained does. The change can only accept more inputs, and only when the round trip is exact. The existing `gQ==` / `windows-1250` case still fails. The extra encode runs only when the decoded output contains U+FFFD.  Tests: two cases in `TestBase64TextDecode` (a UTF-8 source containing U+FFFD, and U+FFFD

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

### Incident Patch 1: `b84e0401` (2026-10-02)
**Commit Message**: fix: Re-enable passing -target and -compact-warnings flags to `login`. Use compact warnings bool to update the Meta.

**File**: `internal/command/arguments/login.go` (modified, +21/-1)
```diff
@@ -3,7 +3,9 @@
 
 package arguments
 
-import "github.com/hashicorp/terraform/internal/tfdiags"
+import (
+	"github.com/hashicorp/terraform/internal/tfdiags"
+)
 
 // Login represents the command-line arguments for the login command.
 type Login struct {
@@ -12,6 +14,8 @@ type Login struct {
 	// InputEnabled is used to disable interactive input for unspecified
 	// variable and backend config values. Default is true.
 	InputEnabled bool
+
+	CompactWarnings bool
 }
 
 func ParseLogin(rawArgs []string) (*Login, tfdiags.Diagnostics) {
@@ -20,6 +24,14 @@ func ParseLogin(rawArgs []string) (*Login, tfdiags.Diagnostics) {
 
 	cmdFlags := defaultFlagSet("login")
 	cmdFlags.BoolVar(&ret.InputEnabled, "input", true, "input")
+	cmdFlags.BoolVar(&ret.CompactWarnings, "compact-warnings", false, "use compact warnings")
+
+	// This flag was accepted by `login` in the past due to using (m *Meta) extendedFlagSet
+	// but it was never used in the command implementation.
+	// We allow the flag to be passed, but it's still unused. We warn the user if they provide it.
+	// TODO: Remove flag.
+	var targetFlags []string
+	cmdFlags.Var((*FlagStringSlice)(&targetFlags), "target", "resource to target")
 
 	if err := cmdFlags.Parse(rawArgs); err != nil {
 		diags = diags.Append(tfdiags.Sourceless(
@@ -29,6 +41,14 @@ func ParseLogin(rawArgs []string) (*Login, tfdiags.Diagnostics) {
 		))
 	}
 
+	if len(targetFlags) > 0 {
+		diags = diags.Append(tfdiags.Sourceless(
+			tfdiags.Warning,
+			"The `target` flag is ignored by the login command.",
+			"",
+		))
+	}
+
 	args := cmdFlags.Args()
 
 	switch len(args) {
```

**File**: `internal/command/arguments/login_test.go` (modified, +46/-12)
```diff
@@ -12,30 +12,62 @@ import (
 
 func TestParseLogin_valid(t *testing.T) {
 	testCases := map[string]struct {
-		args []string
-		want *Login
+		args     []string
+		want     *Login
+		warnings tfdiags.Diagnostics
 	}{
 		"default host": {
 			nil,
 			&Login{
-				Host:         "app.terraform.io",
-				InputEnabled: true,
+				Host:            "app.terraform.io",
+				InputEnabled:    true,
+				CompactWarnings: false,
 			},
+			nil,
 		},
 		"non-default host": {
 			[]string{"other.host.io"},
 			&Login{
-				Host:         "other.host.io",
-				InputEnabled: true,
+				Host:            "other.host.io",
+				InputEnabled:    true,
+				CompactWarnings: false,
+			},
+			nil,
+		},
+		"-compact-warnings": {
+			[]string{"-compact-warnings"},
+			&Login{
+				Host:            "app.terraform.io",
+				InputEnabled:    true,
+				CompactWarnings: true,
+			},
+			nil,
+		},
+		"-target is ignored": {
+			[]string{"-target", "some-resource"},
+			&Login{
+				Host:            "app.terraform.io",
+				InputEnabled:    true,
+				CompactWarnings: false,
+			},
+			tfdiags.Diagnostics{
+				tfdiags.Sourceless(
+					tfdiags.Warning,
+					"The `target` flag is ignored by the login command.",
+					"",
+				),
 			},
 		},
 	}
 
 	for name, tc := range testCases {
 		t.Run(name, func(t *testing.T) {
 			got, diags := ParseLogin(tc.args)
-			if len(diags) > 0 {
-				t.Fatalf("unexpected diags: %v", diags)
+			if diags.HasErrors() {
+				t.Fatalf("unexpected errors: %v", diags)
+			}
+			if tc.warnings != nil {
+				tfdiags.AssertDiagnosticsMatch(t, diags, tc.warnings)
 			}
 			if diff := cmp.Diff(tc.want, got); diff != "" {
 				t.Fatalf("unexpected result\n%s", diff)
@@ -53,8 +85,9 @@ func TestParseLogin_invalid(t *testing.T) {
 		"invalid flag": {
 			[]string{"-foobar"},
 			&Login{
-				Host:         "app.terraform.io",
-				InputEnabled: true,
+				Host:            "app.terraform.io",
+				InputEnabled:    true,
+				CompactWarnings: false,
 			},
 			tfdiags.Diagnostics{
 				tfdiags.Sourceless(
@@ -67,8 +100,9 @@ func TestParseLogin_invalid(t *testing.T) {
 		"too many arguments": {
 			[]string{"other.host.io", "app.terraform.io"},
 			&Login{
-				Host:         "other.host.io",
-				InputEnabled: true,
+				Host:            "other.host.io",
+				InputEnabled:    true,
+				CompactWarnings: false,
 			},
 			tfdiags.Diagnostics{
 				tfdiags.Sourceless(
```

**File**: `internal/command/login.go` (modified, +1/-0)
```diff
@@ -54,6 +54,7 @@ func (c *LoginCommand) Run(rawArgs []string) int {
 		return 1
 	}
 	c.input = args.InputEnabled
+	c.compactWarnings = args.CompactWarnings
 
 	if !c.input {
 		diags = diags.Append(tfdiags.Sourceless(
```

---

### Incident Patch 2: `782caa49` (2026-10-02)
**Commit Message**: fix: Restore ability to enable/disable input in `login` command

I left the logic asserting that `input` should be true in the command's Run method as that ensures the returned boolean is assigned to the right field in the Meta at the right time.

**File**: `internal/command/arguments/login.go` (modified, +5/-1)
```diff
@@ -8,14 +8,18 @@ import "github.com/hashicorp/terraform/internal/tfdiags"
 // Login represents the command-line arguments for the login command.
 type Login struct {
 	Host string
+
+	// InputEnabled is used to disable interactive input for unspecified
+	// variable and backend config values. Default is true.
+	InputEnabled bool
 }
 
 func ParseLogin(rawArgs []string) (*Login, tfdiags.Diagnostics) {
 	var diags tfdiags.Diagnostics
 	ret := &Login{}
 
 	cmdFlags := defaultFlagSet("login")
-	// No command-specific flags for login.
+	cmdFlags.BoolVar(&ret.InputEnabled, "input", true, "input")
 
 	if err := cmdFlags.Parse(rawArgs); err != nil {
 		diags = diags.Append(tfdiags.Sourceless(
```

**File**: `internal/command/arguments/login_test.go` (modified, +8/-4)
```diff
@@ -18,13 +18,15 @@ func TestParseLogin_valid(t *testing.T) {
 		"default host": {
 			nil,
 			&Login{
-				Host: "app.terraform.io",
+				Host:         "app.terraform.io",
+				InputEnabled: true,
 			},
 		},
 		"non-default host": {
 			[]string{"other.host.io"},
 			&Login{
-				Host: "other.host.io",
+				Host:         "other.host.io",
+				InputEnabled: true,
 			},
 		},
 	}
@@ -51,7 +53,8 @@ func TestParseLogin_invalid(t *testing.T) {
 		"invalid flag": {
 			[]string{"-foobar"},
 			&Login{
-				Host: "app.terraform.io",
+				Host:         "app.terraform.io",
+				InputEnabled: true,
 			},
 			tfdiags.Diagnostics{
 				tfdiags.Sourceless(
@@ -64,7 +67,8 @@ func TestParseLogin_invalid(t *testing.T) {
 		"too many arguments": {
 			[]string{"other.host.io", "app.terraform.io"},
 			&Login{
-				Host: "other.host.io",
+				Host:         "other.host.io",
+				InputEnabled: true,
 			},
 			tfdiags.Diagnostics{
 				tfdiags.Sourceless(
```

**File**: `internal/command/login.go` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ func (c *LoginCommand) Run(rawArgs []string) int {
 		c.showDiagnostics(diags)
 		return 1
 	}
+	c.input = args.InputEnabled
 
 	if !c.input {
 		diags = diags.Append(tfdiags.Sourceless(
```

---

### Incident Patch 3: `d1dd5bba` (2026-10-02)
**Commit Message**: fix: Remove use of `logout`'s `Help` method when returning arg parsing errors. Remove outdated tests.

**File**: `internal/command/logout.go` (modified, +0/-1)
```diff
@@ -30,7 +30,6 @@ func (c *LogoutCommand) Run(rawArgs []string) int {
 	diags = diags.Append(argDiags)
 	if diags.HasErrors() {
 		c.showDiagnostics(diags)
-		c.Ui.Error(c.Help())
 		return 1
 	}
 
```

**File**: `internal/command/logout_test.go` (modified, +0/-38)
```diff
@@ -5,7 +5,6 @@ package command
 
 import (
 	"path/filepath"
-	"strings"
 	"testing"
 
 	svchost "github.com/hashicorp/terraform-svchost"
@@ -76,40 +75,3 @@ func TestLogout(t *testing.T) {
 		}
 	}
 }
-
-func TestLogout_argsInvalid(t *testing.T) {
-	testCases := []struct {
-		// Command-line arguments
-		args               []string
-		expectedErrSnippet string
-	}{
-		// Unrecognized flag
-		{[]string{"-foobar"}, "Usage: terraform [global options] logout [hostname]"},
-
-		// Extra positional argument flag
-		{[]string{"app.terraform.io", "foobar"}, "Usage: terraform [global options] logout [hostname]"},
-	}
-	for _, tc := range testCases {
-
-		workDir := t.TempDir()
-
-		ui := testUiWrapped(t)
-		credsSrc := cliconfig.EmptyCredentialsSourceForTests(filepath.Join(workDir, "credentials.tfrc.json"))
-
-		c := &LogoutCommand{
-			Meta: Meta{
-				Ui:       ui,
-				Services: disco.NewWithCredentialsSource(credsSrc),
-			},
-		}
-
-		status := c.Run(tc.args)
-		if status != 1 {
-			t.Fatalf("unexpected error code %d\nstderr:\n%s", status, ui.ErrorWriter.String())
-		}
-
-		if !strings.Contains(ui.ErrorWriter.String(), tc.expectedErrSnippet) {
-			t.Errorf("expected error snippet %q not found in stderr:\n%s", tc.expectedErrSnippet, ui.ErrorWriter.String())
-		}
-	}
-}
```

---

### Incident Patch 4: `f5dfdc72` (2026-10-02)
**Commit Message**: fix: Remove unused entries in `MessageRegistry`

**File**: `internal/command/views/init.go` (modified, +0/-12)
```diff
@@ -576,18 +576,6 @@ type InitMessage struct {
 }
 
 var MessageRegistry map[InitMessageCode]InitMessage = map[InitMessageCode]InitMessage{
-	"finding_matching_version_message": {
-		HumanValue: logFindingMatchingVersionHuman,
-		JSONValue:  logFindingMatchingVersionJSON,
-	},
-	"state_store_unset": {
-		HumanValue: "[reset][green]\n\nSuccessfully unset the state store %q. Terraform will now operate locally.",
-		JSONValue:  "Successfully unset the state store %q. Terraform will now operate locally.",
-	},
-	"state_store_migrate_backend": {
-		HumanValue: "Migrating from %q state store to %q backend.",
-		JSONValue:  "Migrating from %q state store to %q backend.",
-	},
 	"backend_configured_unset": {
 		HumanValue: backendConfiguredUnsetHuman,
 		JSONValue:  backendConfiguredUnsetJSON,
```

---

### Incident Patch 5: `83c9c650` (2026-09-07)
**Commit Message**: refactor: Stop `LogBuiltInProviderAvailable` using `prepareMessage`. Remove unused const.

**File**: `internal/command/views/init.go` (modified, +2/-13)
```diff
@@ -213,8 +213,7 @@ func (v *InitHuman) LogUsingProviderVersionFromCacheDir(providerAddr addrs.Provi
 }
 
 func (v *InitHuman) LogBuiltInProviderAvailable(providerAddr addrs.Provider) {
-	params := []any{providerAddr.ForDisplay()}
-	v.print(v.prepareMessage(BuiltInProviderAvailableMessage, params...))
+	v.print(fmt.Sprintf(logBuiltInProviderAvailableHuman, providerAddr.ForDisplay()))
 }
 
 func (v *InitHuman) LogInstallProviderVersionStart(providerAddr addrs.Provider, version getproviders.Version) {
@@ -512,11 +511,7 @@ func (v *InitJSON) LogUsingProviderVersionFromCacheDir(providerAddr addrs.Provid
 }
 
 func (v *InitJSON) LogBuiltInProviderAvailable(providerAddr addrs.Provider) {
-	params := []any{providerAddr.ForDisplay()}
-
-	// This was previously logged via LogInitMessage, so we need to match implementation of that method
-	// to ensure the same JSON log is produced.
-	v.logInitMessage(BuiltInProviderAvailableMessage, params...)
+	v.view.Log(fmt.Sprintf(logBuiltInProviderAvailableJSON, providerAddr.ForDisplay()))
 }
 
 func (v *InitJSON) LogInstallProviderVersionStart(providerAddr addrs.Provider, version getproviders.Version) {
@@ -631,10 +626,6 @@ type InitMessage struct {
 }
 
 var MessageRegistry map[InitMessageCode]InitMessage = map[InitMessageCode]InitMessage{
-	"built_in_provider_available_message": {
-		HumanValue: logBuiltInProviderAvailableHuman,
-		JSONValue:  logBuiltInProviderAvailableJSON,
-	},
 	"reusing_previous_version_info": {
 		HumanValue: logReusingPreviousProviderVersionHuman,
 		JSONValue:  logReusingPreviousProviderVersionJSON,
@@ -726,8 +717,6 @@ const (
 	InstalledProviderVersionInfo InitMessageCode = "installed_provider_version_info"
 	// ReusingPreviousVersionInfo indicates a provider which is locked to a specific version during installation
 	ReusingPreviousVersionInfo InitMessageCode = "reusing_previous_version_info"
-	// BuiltInProviderAvailableMessage indicates a built-in provider in use during installation
-	BuiltInProviderAvailableMessage InitMessageCode = "built_in_provider_available_message"
 	// InstallingProviderMessage indicates that a provider is being installed (from a remote location)
 	InstallingProviderMessage InitMessageCode = "installing_provider_message"
 	// FindingLatestVersionMessage indicates that Terraform is looking for the latest version of a provider during installation (no constraint was supplied)
```

**File**: `internal/command/views/state_migrate.go` (modified, +1/-2)
```diff
@@ -244,8 +244,7 @@ func (s *StateMigrateHuman) LogUsingProviderVersionFromCacheDir(providerAddr add
 
 // Implements ProviderInstallationLogger interface.
 func (s *StateMigrateHuman) LogBuiltInProviderAvailable(providerAddr addrs.Provider) {
-	params := []any{providerAddr.ForDisplay()}
-	s.log(s.prepareMessage(BuiltInProviderAvailableMessage, params...))
+	s.log(fmt.Sprintf(logBuiltInProviderAvailableHuman, providerAddr.ForDisplay()))
 }
 
 // Implements ProviderInstallationLogger interface.
```

---

### Incident Patch 6: `c3688f8c` (2026-10-05)
**Commit Message**: fix: Add the `-json` flag to the `state identities` command's help text

**File**: `internal/command/state_identities.go` (modified, +2/-0)
```diff
@@ -148,6 +148,8 @@ Options:
                       resource types have an attribute named "id" whose value
                       equals the given id string.
 
+  -json               Outputs the identities in JSON format. This flag is required.
+
 `
 	return strings.TrimSpace(helpText)
 }
```

---

### Incident Patch 7: `a0e86861` (2026-09-07)
**Commit Message**: refactor: Add `Message` prefix to constant names

**File**: `internal/command/views/init.go` (modified, +6/-6)
```diff
@@ -336,7 +336,7 @@ func (v *InitJSON) initOutputLog(preppedMessage string, messageCode json.Message
 
 func (v *InitJSON) LogConfigurationCopyingStart(moduleSource string) {
 	template := "Copying configuration from %q..."
-	v.initOutputLog(fmt.Sprintf(template, moduleSource), json.CopyingConfigurationMessage)
+	v.initOutputLog(fmt.Sprintf(template, moduleSource), json.MessageCopyingConfigurationMessage)
 }
 
 // logInitMessage is an internalised version of an old method `LogInitMessage`.
@@ -361,7 +361,7 @@ func (v *InitJSON) logInitMessage(messageCode InitMessageCode, params ...any) {
 
 func (v *InitJSON) LogInstallProvidersStart() {
 	msg := "Initializing provider plugins..."
-	v.initOutputLog(msg, json.InitializingProviderPluginMessage)
+	v.initOutputLog(msg, json.MessageInitializingProviderPluginMessage)
 }
 
 func (v *InitJSON) LogInstallStateStoreProviderStart(pAddr tfaddr.Provider, cons getproviders.VersionConstraints, storeType string) {
@@ -490,13 +490,13 @@ func (v *InitJSON) LogPartnerAndCommunityProviders() {
 // Implements ProviderLockingLogger
 func (v *InitJSON) LogProviderLockfileCreated() {
 	msg := strings.TrimSpace(createdLockInfoJSON)
-	v.initOutputLog(msg, json.LockInfo)
+	v.initOutputLog(msg, json.MessageLockInfo)
 }
 
 // Implements ProviderLockingLogger
 func (v *InitJSON) LogProviderLockfileUpdated() {
 	msg := strings.TrimSpace(dependenciesLockChangesInfo)
-	v.initOutputLog(msg, json.DependenciesLockChangesInfo)
+	v.initOutputLog(msg, json.MessageDependenciesLockChangesInfo)
 }
 
 // Implements ModuleInstallationLogger
@@ -530,13 +530,13 @@ func (v *InitJSON) LogModuleInstallationWithLocalPath(modulePath, localDir strin
 // Implements ModuleInstallationLogger
 func (v *InitJSON) LogModuleUpgrade() {
 	msg := "Upgrading modules..."
-	v.initOutputLog(msg, json.UpgradingModulesMessage)
+	v.initOutputLog(msg, json.MessageUpgradingModulesMessage)
 }
 
 // Implements ModuleInstallationLogger
 func (v *InitJSON) LogModuleInitialization() {
 	msg := "Initializing modules..."
-	v.initOutputLog(msg, json.InitializingModulesMessage)
+	v.initOutputLog(msg, json.MessageInitializingModulesMessage)
 }
 
 // prepareMessage retrieves a message template matching the InitMessageCode and
```

**File**: `internal/command/views/json/message_types.go` (modified, +6/-6)
```diff
@@ -114,10 +114,10 @@ const (
 	// In a future major version we should make init's JSON output align with the conventions used
 	// elsewhere in the CLI. For now these consts are here to demonstrate that they're public-facing
 	// and changes are potentially breaking.
-	CopyingConfigurationMessage       MessageType = "copying_configuration_message"
-	UpgradingModulesMessage           MessageType = "upgrading_modules_message"
-	InitializingModulesMessage        MessageType = "initializing_modules_message"
-	InitializingProviderPluginMessage MessageType = "initializing_provider_plugin_message"
-	LockInfo                          MessageType = "lock_info"
-	DependenciesLockChangesInfo       MessageType = "dependencies_lock_changes_info"
+	MessageCopyingConfigurationMessage       MessageType = "copying_configuration_message"
+	MessageUpgradingModulesMessage           MessageType = "upgrading_modules_message"
+	MessageInitializingModulesMessage        MessageType = "initializing_modules_message"
+	MessageInitializingProviderPluginMessage MessageType = "initializing_provider_plugin_message"
+	MessageLockInfo                          MessageType = "lock_info"
+	MessageDependenciesLockChangesInfo       MessageType = "dependencies_lock_changes_info"
 )
```

---

### Incident Patch 8: `4c0a32bd` (2026-09-29)
**Commit Message**: more deferral simplification and fixes

unify where NodeAbstractResourceInstance defers the instance from
multiple call sites.

Fix where deferred destroys could lose actions. The actions are now
deferred.

Fix panic from "checking whether X should be deferred when it was
already deferred". Now we also check that a resource can't be deferred
during apply if it was not planned as such.

**File**: `internal/terraform/context_apply_deferred_test.go` (modified, +96/-0)
```diff
@@ -4386,6 +4386,13 @@ func (provider *deferredActionsProvider) Provider() providers.Interface {
 			}
 		},
 		ApplyResourceChangeFn: func(req providers.ApplyResourceChangeRequest) providers.ApplyResourceChangeResponse {
+			if req.PlannedState.IsNull() {
+				// Deletes are not recorded as applied changes.
+				return providers.ApplyResourceChangeResponse{
+					NewState: req.PlannedState,
+				}
+			}
+
 			key := req.Config.GetAttr("name").AsString()
 			newState := req.PlannedState
 
@@ -4533,3 +4540,92 @@ resource "test" "b" {
 		t.Fatalf("expected nothing to be applied, got %d changes", len(provider.appliedChanges.changes))
 	}
 }
+
+// TestContextApply_deferredWithDeposedObject verifies that a deposed object
+// which was planned for destruction is destroyed during apply, even though
+// the current object of the same resource instance was deferred.
+func TestContextApply_deferredWithDeposedObject(t *testing.T) {
+	cfg := testModuleInline(t, map[string]string{
+		"main.tf": `
+variable "each" {
+  type = set(string)
+}
+
+resource "test" "a" {
+  for_each = var.each
+  name     = "a:${each.key}"
+}
+
+resource "test" "b" {
+  name           = "b"
+  upstream_names = [for v in test.a : v.name]
+}
+`,
+	})
+
+	providerAddr := addrs.AbsProviderConfig{
+		Provider: addrs.NewDefaultProvider("test"),
+		Module:   addrs.RootModule,
+	}
+	state := states.BuildState(func(s *states.SyncState) {
+		s.SetResourceInstanceCurrent(mustResourceInstanceAddr("test.b"), &states.ResourceInstanceObjectSrc{
+			Status:    states.ObjectReady,
+			AttrsJSON: mustParseJson(map[string]interface{}{"name": "b"}),
+		}, providerAddr)
+		s.SetResourceInstanceDeposed(mustResourceInstanceAddr("test.b"), states.DeposedKey("00000001"), &states.ResourceInstanceObjectSrc{
+			Status:    states.ObjectReady,
+			AttrsJSON: mustParseJson(map[string]interface{}{"name": "b-old"}),
+		}, providerAddr)
+	})
+
+	provider := &deferredActionsProvider{
+		t:               t,
+		deferralAllowed: true,
+		plannedChanges:  &deferredActionsChanges{changes: make(map[string]cty.Value)},
+		appliedChanges:  &deferredActionsChanges{changes: make(map[string]cty.Value)},
+	}
+	ctx := testContext2(t, &ContextOpts{
+		Providers: map[addrs.Provider]providers.Factory{
+			addrs.NewDefaultProvider("test"): testProviderFuncFixed(provider.Provider()),
+		},
+	})
+
+	plan, diags := ctx.Plan(cfg, state, &PlanOpts{
+		Mode:            plans.NormalMode,
+		DeferralAllowed: true,
+		SetVariables: InputValues{
+			"each": &InputValue{
+				Value:      cty.UnknownVal(cty.Set(cty.String)),
+				SourceType: ValueFromCaller,
+			},
+		},
+	})
+	tfdiags.AssertNoErrors(t, diags)
+
+	gotDeferred := make(map[string]providers.DeferredReason)
+	for _, dc := range plan.DeferredResources {
+		gotDeferred[dc.ChangeSrc.Addr.String()] = dc.DeferredReason
+	}
+	wantDeferred := map[string]providers.DeferredReason{
+		"test.a[*]": providers.DeferredReasonInstanceCountUnknown,
+		"test.b":    providers.DeferredReasonDeferredPrereq,
+	}
+	if diff := cmp.Diff(wantDeferred, gotDeferred); diff != "" {
+		t.Fatalf("wrong deferred resources\n%s", diff)
+	}
+	deposedChange := plan.Changes.ResourceInstanceDeposed(mustResourceInstanceAddr("test.b"), states.DeposedKey("00000001"))
+	if deposedChange == nil || deposedChange.Action != plans.Delete {
+		t.Fatalf("expected a planned delete for the deposed object, got %#v", deposedChange)
+	}
+
+	newState, diags := ctx.Apply(plan, cfg, nil)
+	tfdiags.AssertNoErrors(t, diags)
+
+	instance := newState.ResourceInstance(mustResourceInstanceAddr("test.b"))
+	if instance == nil || instance.Current == nil {
+		t.Fatal("expected the current object for test.b to remain")
+	}
+	if len(instance.Deposed) != 0 {
+		t.Fatalf("expected the deposed object to be destroyed, got %d deposed objects", len(instance.Deposed))
+	}
+}
```

**File**: `internal/terraform/context_plan_actions_test.go` (modified, +63/-0)
```diff
@@ -2498,6 +2498,69 @@ resource "test_object" "a" {
 				},
 			},
 
+			"deferred destroys also defer the actions they trigger": {
+				module: map[string]string{
+					"main.tf": `
+action "test_action" "hello" {}
+resource "test_object" "a" {
+  lifecycle {
+    action_trigger {
+      events = [before_destroy]
+      actions = [action.test_action.hello]
+    }
+  }
+}
+`,
+				},
+				buildState: func(s *states.SyncState) {
+					s.SetResourceInstanceCurrent(mustResourceInstanceAddr("test_object.a"),
+						&states.ResourceInstanceObjectSrc{
+							Status:    states.ObjectReady,
+							AttrsJSON: []byte(`{"name":"current"}`),
+						},
+						mustProviderConfig(`provider["registry.terraform.io/hashicorp/test"]`),
+					)
+				},
+				expectPlanActionCalled: false,
+				planOpts: &PlanOpts{
+					Mode:            plans.DestroyMode,
+					DeferralAllowed: true,
+				},
+
+				planResourceFn: func(_ *testing.T, req providers.PlanResourceChangeRequest) providers.PlanResourceChangeResponse {
+					return providers.PlanResourceChangeResponse{
+						PlannedState: req.ProposedNewState,
+						Deferred: &providers.Deferred{
+							Reason: providers.DeferredReasonAbsentPrereq,
+						},
+					}
+				},
+
+				assertPlan: func(t *testing.T, p *plans.Plan) {
+					if len(p.Changes.ActionInvocations) != 0 {
+						t.Fatalf("expected 0 actions in plan, got %d", len(p.Changes.ActionInvocations))
+					}
+
+					if len(p.DeferredResources) != 1 {
+						t.Fatalf("expected 1 resource to be deferred, got %d", len(p.DeferredResources))
+					}
+					if got := p.DeferredResources[0].DeferredReason; got != providers.DeferredReasonAbsentPrereq {
+						t.Fatalf("expected resource to be deferred due to absent prereq, got %s", got)
+					}
+
+					if len(p.DeferredActionInvocations) != 1 {
+						t.Fatalf("expected 1 deferred action in plan, got %d", len(p.DeferredActionInvocations))
+					}
+					deferredAction := p.DeferredActionInvocations[0]
+					if deferredAction.DeferredReason != providers.DeferredReasonDeferredPrereq {
+						t.Fatalf("expected deferred action to be deferred due to deferred prereq, got %s", deferredAction.DeferredReason)
+					}
+					if got := deferredAction.ActionInvocationInstanceSrc.Addr.String(); got != "action.test_action.hello" {
+						t.Fatalf("expected deferred action.test_action.hello, got %s", got)
+					}
+				},
+			},
+
 			"deferred resources also defer the actions they trigger": {
 				module: map[string]string{
 					"main.tf": `
```

**File**: `internal/terraform/node_resource_abstract_instance.go` (modified, +30/-3)
```diff
@@ -3171,7 +3171,34 @@ func getRequiredReplaces(priorVal, plannedNewVal cty.Value, writeOnly []cty.Path
 	return reqRep, diags
 }
 
-func (n *NodeAbstractResourceInstance) reportDeferredActionTriggers(ctx EvalContext, reason providers.DeferredReason) {
+// deferPlannedChange decides whether the planned change for this resource
+// instance must be deferred, either because the provider deferred it or
+// because one of the instance's dependencies was already deferred. When
+// deferred, the change and all of the instance's action triggers are reported
+// to the deferrals tracker, and the caller must not record the change in the
+// plan.
+func (n *NodeAbstractResourceInstance) deferPlannedChange(ctx EvalContext, providerDeferred *providers.Deferred, change *plans.ResourceInstanceChange) bool {
+	deferrals := ctx.Deferrals()
+
+	var reason providers.DeferredReason
+	switch {
+	case providerDeferred != nil:
+		reason = providerDeferred.Reason
+	case deferrals.ShouldDeferResourceInstanceChanges(n.Addr, n.Dependencies):
+		reason = providers.DeferredReasonDeferredPrereq
+	default:
+		return false
+	}
+
+	deferrals.ReportResourceInstanceDeferred(n.Addr, reason, change)
+	n.reportDeferredActionTriggers(ctx)
+	return true
+}
+
+// reportDeferredActionTriggers reports all of the action invocations triggered
+// by this resource instance as deferred, because the resource instance itself
+// was deferred.
+func (n *NodeAbstractResourceInstance) reportDeferredActionTriggers(ctx EvalContext) {
 	deferrals := ctx.Deferrals()
 
 	for blockIdx, trigger := range n.actionTriggers {
@@ -3184,7 +3211,7 @@ func (n *NodeAbstractResourceInstance) reportDeferredActionTriggers(ctx EvalCont
 					ActionsListIndex:        listIdx,
 				},
 				Caller: n.Addr.Resource,
-			}, reason)
+			}, providers.DeferredReasonDeferredPrereq)
 		}
 	}
 }
@@ -3236,7 +3263,7 @@ func (n *NodeAbstractResourceInstance) planActionTriggers(ctx EvalContext, resRe
 					ctx.Changes().RemoveResourceInstanceChange(n.Addr, addrs.NotDeposed)
 					ctx.Deferrals().ReportResourceInstanceDeferred(n.Addr, providers.DeferredReasonAbsentPrereq, change)
 					// this defers all action triggers at once
-					n.reportDeferredActionTriggers(ctx, providers.DeferredReasonDeferredPrereq)
+					n.reportDeferredActionTriggers(ctx)
 					return diags
 				}
 
```

**File**: `internal/terraform/node_resource_destroy_deposed.go` (modified, +7/-4)
```diff
@@ -293,11 +293,14 @@ func (n *NodeDestroyDeposedResourceInstanceObject) Execute(ctx EvalContext, op w
 		return diags
 	}
 
+	// Deferral is decided during planning, and this object's destroy was not
+	// deferred, so the provider must not defer it now.
 	if deferred != nil {
-		ctx.Deferrals().ReportResourceInstanceDeferred(n.Addr, deferred.Reason, change)
-		return diags
-	} else if ctx.Deferrals().ShouldDeferResourceInstanceChanges(n.Addr, n.Dependencies) {
-		ctx.Deferrals().ReportResourceInstanceDeferred(n.Addr, providers.DeferredReasonDeferredPrereq, change)
+		diags = diags.Append(tfdiags.Sourceless(
+			tfdiags.Error,
+			"Resource deferred during apply, but not during plan",
+			fmt.Sprintf("Terraform has encountered a bug where a provider would mark the deposed object %s of %q as deferred during apply, but not during plan. This is most likely a bug in the provider. Please file an issue with the provider.", n.DeposedKey, n.Addr),
+		))
 		return diags
 	}
 
```

**File**: `internal/terraform/node_resource_plan_destroy.go` (modified, +1/-7)
```diff
@@ -10,7 +10,6 @@ import (
 
 	"github.com/hashicorp/terraform/internal/addrs"
 	"github.com/hashicorp/terraform/internal/plans"
-	"github.com/hashicorp/terraform/internal/providers"
 	"github.com/hashicorp/terraform/internal/states"
 	"github.com/hashicorp/terraform/internal/tfdiags"
 )
@@ -118,12 +117,7 @@ func (n *NodePlanDestroyableResourceInstance) managedResourceExecute(ctx EvalCon
 		return diags
 	}
 
-	if deferred != nil {
-		ctx.Deferrals().ReportResourceInstanceDeferred(n.Addr, deferred.Reason, change)
-		return diags
-	} else if ctx.Deferrals().ShouldDeferResourceInstanceChanges(n.Addr, n.Dependencies) {
-		ctx.Deferrals().ReportResourceInstanceDeferred(n.Addr, providers.DeferredReasonDeferredPrereq, change)
-		n.reportDeferredActionTriggers(ctx, providers.DeferredReasonDeferredPrereq)
+	if n.deferPlannedChange(ctx, deferred, change) {
 		return diags
 	}
 
```

**File**: `internal/terraform/node_resource_plan_instance.go` (modified, +7/-23)
```diff
@@ -587,7 +587,7 @@ func (n *NodePlannableResourceInstance) managedResourceExecute(ctx EvalContext)
 					After:  instanceRefreshState.Value,
 				},
 			})
-			n.reportDeferredActionTriggers(ctx, deferred.Reason)
+			n.reportDeferredActionTriggers(ctx)
 		}
 	}
 
@@ -596,7 +596,6 @@ func (n *NodePlannableResourceInstance) managedResourceExecute(ctx EvalContext)
 
 func (n *NodePlannableResourceInstance) reportPlan(ctx EvalContext, deferred, planDeferred *providers.Deferred, importing bool, change *plans.ResourceInstanceChange, instanceRefreshState, instancePlanState *states.ResourceInstanceObject, repData instances.RepetitionData) tfdiags.Diagnostics {
 	var diags tfdiags.Diagnostics
-	addr := n.ResourceInstanceAddr()
 
 	checkRuleSeverity := tfdiags.Error
 	if n.skipPlanChanges || n.preDestroyRefresh {
@@ -626,15 +625,12 @@ func (n *NodePlannableResourceInstance) reportPlan(ctx EvalContext, deferred, pl
 		change.ActionReason = plans.ResourceInstanceReplaceByTriggers
 	}
 
-	deferrals := ctx.Deferrals()
-	if deferred != nil {
-		// Then this resource has been deferred either during the import,
-		// refresh or planning stage. We'll report the deferral and
-		// store what we could produce in the deferral tracker.
-		deferrals.ReportResourceInstanceDeferred(addr, deferred.Reason, change)
-		n.reportDeferredActionTriggers(ctx, providers.DeferredReasonDeferredPrereq)
-
-	} else if !deferrals.ShouldDeferResourceInstanceChanges(n.Addr, n.Dependencies) {
+	// If this resource was deferred by the provider during import, refresh or
+	// planning, or depends on something which was deferred, then the change is
+	// recorded as deferred rather than being added to the plan or working
+	// state. In that case the expression evaluator will use the deferred
+	// change as the value of this resource instance.
+	if !n.deferPlannedChange(ctx, deferred, change) {
 		// We intentionally write the change before the subsequent checks, because
 		// all of the checks below this point are for problems caused by the
 		// context surrounding the change, rather than the change itself, and
@@ -681,18 +677,6 @@ func (n *NodePlannableResourceInstance) reportPlan(ctx EvalContext, deferred, pl
 			checkRuleSeverity,
 		)
 		diags = diags.Append(checkDiags)
-	} else {
-		// The deferrals tracker says that we must defer changes for
-		// this resource instance, presumably due to a dependency on an
-		// upstream object that was already deferred. Therefore we just
-		// report our own deferral (capturing a placeholder value in the
-		// deferral tracker) and don't add anything to the plan or
-		// working state.
-		// In this case, the expression evaluator should use the placeholder
-		// value registered here as the value of this resource instance,
-		// instead of using the plan.
-		deferrals.ReportResourceInstanceDeferred(n.Addr, providers.DeferredReasonDeferredPrereq, change)
-		n.reportDeferredActionTriggers(ctx, providers.DeferredReasonDeferredPrereq)
 	}
 
 	// Now that the instance is planned we can plan any triggered actions.
```

**File**: `internal/terraform/node_resource_plan_orphan.go` (modified, +1/-8)
```diff
@@ -174,8 +174,6 @@ func (n *NodePlannableResourceInstanceOrphan) managedResourceExecute(ctx EvalCon
 		}
 	}
 
-	shouldDefer := ctx.Deferrals().ShouldDeferResourceInstanceChanges(n.Addr, n.Dependencies)
-
 	var change *plans.ResourceInstanceChange
 	var pDiags tfdiags.Diagnostics
 	var deferred *providers.Deferred
@@ -195,12 +193,7 @@ func (n *NodePlannableResourceInstanceOrphan) managedResourceExecute(ctx EvalCon
 	// sometimes not have a reason.)
 	change.ActionReason = n.deleteActionReason(ctx)
 
-	if deferred != nil {
-		ctx.Deferrals().ReportResourceInstanceDeferred(n.Addr, deferred.Reason, change)
-		return diags
-	} else if shouldDefer {
-		ctx.Deferrals().ReportResourceInstanceDeferred(n.Addr, providers.DeferredReasonDeferredPrereq, change)
-		n.reportDeferredActionTriggers(ctx, providers.DeferredReasonDeferredPrereq)
+	if n.deferPlannedChange(ctx, deferred, change) {
 		return diags
 	}
 
```

---

### Incident Patch 9: `f7d6091e` (2026-09-29)
**Commit Message**: Fix action expansion deferral recording

Action expansion was being recorded as action deferral, instance of
action expansion deferral. We don't actually have "action deferrals"
right now though, so remove that too while we're at it.

**File**: `internal/plans/deferring/deferred.go` (modified, +5/-33)
```diff
@@ -61,12 +61,6 @@ type Deferred struct {
 	// the action invocation is not yet ready to be executed.
 	actionInvocationDeferred []*plans.DeferredActionInvocation
 
-	// actionExpansionDeferred tracks the action expansions that have been
-	// deferred. This can happen because the action expansion is not yet ready
-	// to be executed, so we only track whole action objects as opposed to
-	// instances.
-	actionExpansionDeferred addrs.Map[addrs.ConfigAction, addrs.Map[addrs.AbsAction, providers.DeferredReason]]
-
 	// partialExpandedResourcesDeferred tracks placeholders that cover an
 	// unbounded set of potential resource instances in situations where we
 	// don't yet even have enough information to predict which instances of
@@ -117,7 +111,6 @@ func NewDeferred(enabled bool) *Deferred {
 		deferralAllowed:                  enabled,
 		resourceInstancesDeferred:        addrs.MakeMap[addrs.ConfigResource, addrs.Map[addrs.AbsResourceInstance, *plans.DeferredResourceInstanceChange]](),
 		actionInvocationDeferred:         []*plans.DeferredActionInvocation{},
-		actionExpansionDeferred:          addrs.MakeMap[addrs.ConfigAction, addrs.Map[addrs.AbsAction, providers.DeferredReason]](),
 		partialExpandedResourcesDeferred: addrs.MakeMap[addrs.ConfigResource, addrs.Map[addrs.PartialExpandedResource, *plans.DeferredResourceInstanceChange]](),
 		partialExpandedActionsDeferred:   addrs.MakeMap[addrs.ConfigAction, addrs.Map[addrs.PartialExpandedAction, providers.DeferredReason]](),
 		partialExpandedModulesDeferred:   addrs.MakeSet[addrs.PartialExpandedModule](),
@@ -410,6 +403,10 @@ func (d *Deferred) ReportResourceExpansionDeferred(addr addrs.PartialExpandedRes
 	})
 }
 
+// ReportActionExpansionDeferred reports that we cannot predict which instances
+// of an action will be declared, either because the action's own count or
+// for_each is unknown or because its containing module's expansion is unknown.
+// Any invocation of a matching action instance will then be deferred.
 func (d *Deferred) ReportActionExpansionDeferred(addr addrs.PartialExpandedAction) {
 	d.mu.Lock()
 	defer d.mu.Unlock()
@@ -498,25 +495,6 @@ func (d *Deferred) ReportActionInvocationDeferred(ai plans.ActionInvocationInsta
 	})
 }
 
-// Report Action Deferred
-func (d *Deferred) ReportActionDeferred(addr addrs.AbsAction, reason providers.DeferredReason) {
-	d.mu.Lock()
-	defer d.mu.Unlock()
-
-	configAddr := addr.ConfigAction()
-	if !d.actionExpansionDeferred.Has(configAddr) {
-		d.actionExpansionDeferred.Put(configAddr, addrs.MakeMap[addrs.AbsAction, providers.DeferredReason]())
-	}
-
-	configMap := d.actionExpansionDeferred.Get(configAddr)
-	if configMap.Has(addr) {
-		// This indicates a bug in the caller, since our graph walk should
-		// ensure that we visit and evaluate each resource instance only once.
-		panic(fmt.Sprintf("duplicate deferral report for %s", addr))
-	}
-	configMap.Put(addr, reason)
-}
-
 // ShouldDeferActionInvocation returns true if there is a reason to defer the
 // action invocation instance.
 func (d *Deferred) ShouldDeferActionInvocation(ai *plans.ActionInvocationInstance) bool {
@@ -536,13 +514,7 @@ func (d *Deferred) ShouldDeferActionInvocation(ai *plans.ActionInvocationInstanc
 		}
 	}
 
-	if c, ok := d.actionExpansionDeferred.GetOk(ai.Addr.ConfigAction()); ok {
-		if c.Has(ai.Addr.ContainingAction()) {
-			return true
-		}
-	}
-
-	// now check if the action config was deferred
+	// now check if the action expansion was deferred
 	configAddr := ai.Addr.ConfigAction()
 	if !d.partialExpandedActionsDeferred.Has(configAddr) {
 		return false
```

**File**: `internal/terraform/context_plan_actions_test.go` (modified, +52/-0)
```diff
@@ -2622,6 +2622,58 @@ resource "test_object" "a" {
 					}
 				},
 			},
+			"action expansion with unknown instances in multiple module instances": {
+				// Each module instance must record its own deferred action
+				// expansion, and the triggering resources in every instance
+				// must be deferred as a result.
+				module: map[string]string{
+					"main.tf": `
+variable "actions" {
+  type = set(string)
+}
+module "mod" {
+  source  = "./mod"
+  count   = 2
+  actions = var.actions
+}
+`,
+					"mod/mod.tf": `
+variable "actions" {
+  type = set(string)
+}
+action "test_action" "hello" {
+  for_each = var.actions
+}
+resource "other_object" "a" {
+  lifecycle {
+    action_trigger {
+      events  = [before_create]
+      actions = [action.test_action.hello["a"]]
+    }
+  }
+}
+`,
+				},
+				expectPlanActionCalled: false,
+				planOpts: &PlanOpts{
+					Mode:            plans.NormalMode,
+					DeferralAllowed: true,
+					SetVariables: InputValues{
+						"actions": &InputValue{
+							Value:      cty.UnknownVal(cty.Set(cty.String)),
+							SourceType: ValueFromCLIArg,
+						},
+					},
+				},
+				assertPlan: func(t *testing.T, p *plans.Plan) {
+					if got := len(p.DeferredResources); got != 2 {
+						t.Fatalf("expected 2 deferred resources, got %d", got)
+					}
+					if got := len(p.Changes.ActionInvocations); got != 0 {
+						t.Fatalf("expected 0 planned action invocations, got %d", got)
+					}
+				},
+			},
 			"action with unknown module expansion": {
 				// We have an unknown module expansion (for_each over an unknown value). The
 				// action and its triggering resource both live inside the (currently
```

**File**: `internal/terraform/node_action.go` (modified, +2/-2)
```diff
@@ -110,7 +110,7 @@ func (n *NodeActionConfig) recordActionExpansion(ctx EvalContext) tfdiags.Diagno
 
 			} else {
 				expander.SetActionCountUnknown(module, n.Addr.Action)
-				ctx.Deferrals().ReportActionDeferred(n.Addr.Absolute(ctx.Path()), providers.DeferredReasonInstanceCountUnknown)
+				ctx.Deferrals().ReportActionExpansionDeferred(module.UnexpandedAction(n.Addr.Action))
 			}
 
 		case n.Config.ForEach != nil:
@@ -123,7 +123,7 @@ func (n *NodeActionConfig) recordActionExpansion(ctx EvalContext) tfdiags.Diagno
 				expander.SetActionForEach(module, n.Addr.Action, forEach)
 			} else {
 				expander.SetActionForEachUnknown(module, n.Addr.Action)
-				ctx.Deferrals().ReportActionDeferred(n.Addr.Absolute(ctx.Path()), providers.DeferredReasonInstanceCountUnknown)
+				ctx.Deferrals().ReportActionExpansionDeferred(module.UnexpandedAction(n.Addr.Action))
 			}
 
 		default:
```

---

### Incident Patch 10: `aebe6826` (2026-09-29)
**Commit Message**: test: Add E2E test reproducing the bug reported in issue #39299

**File**: `internal/command/e2etest/fmt_test.go` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+// Copyright IBM Corp. 2014, 2026
+// SPDX-License-Identifier: BUSL-1.1
+
+package e2etest
+
+import (
+	"bytes"
+	"os"
+	"os/exec"
+	"path/filepath"
+	"runtime"
+	"strings"
+	"testing"
+
+	"github.com/hashicorp/terraform/internal/e2e"
+)
+
+// Reproduction of the scenario reported in https://github.com/hashicorp/terraform/issues/39299
+func TestFmt_errorWritingToFile(t *testing.T) {
+	switch runtime.GOOS {
+	case "darwin", "linux":
+	default:
+		t.Skipf("test requires a Unix shell; `sh` unsupported on %s", runtime.GOOS)
+	}
+
+	fixturePath := filepath.Join("testdata", "fmt")
+	tf := e2e.NewBinary(t, terraformBin, fixturePath)
+
+	// Assert that main.tf has content before running fmt
+	mainPath := filepath.Join(tf.WorkDir(), "main.tf")
+	content, err := os.ReadFile(mainPath)
+	if err != nil {
+		t.Fatalf("unexpected error reading test file: %s", err)
+	}
+	if len(content) == 0 {
+		t.Fatal("expected main.tf to contain config, but it is empty")
+	}
+
+	// Assert that there's a formatting issue present
+	// With `-check`, this is confirmed by error code 3.
+	preFmtCmd := tf.Cmd("fmt", "-check", "-no-color")
+	err = preFmtCmd.Run()
+	if err.Error() != "exit status 3" {
+		t.Fatalf("expected exit status 3 error, got: %s", err)
+	}
+
+	// The fmt command we're testing ulimit with, which will attempt to write to main.tf
+	fmtCmd := tf.Cmd("fmt", "-no-color")
+	fmtCmd.Stdin = nil
+	fmtCmd.Stdout = &bytes.Buffer{}
+	fmtCmd.Stderr = &bytes.Buffer{}
+
+	// But, we need to wrap the command above in a shell command to enforce `ulimit -f 0`.
+	// This:
+	//   * Causes an error in fmt when writing formatted content to the file,
+	//     resulting in the file being left empty.
+	//   * Only impacts this command and not the entire test process.
+	cmd := exec.Command(
+		"/bin/sh", "-c",
+		`ulimit -f 0; exec "$@"`,
+		"sh", fmtCmd.Path,
+	)
+	cmd.Args = append(cmd.Args, fmtCmd.Args[1:]...)
+	cmd.Dir = fmtCmd.Dir
+	cmd.Env = fmtCmd.Env
+	cmd.Stdin, cmd.Stdout, cmd.Stderr = fmtCmd.Stdin, fmtCmd.Stdout, fmtCmd.Stderr
+
+	err = cmd.Run()
+	if err == nil {
+		t.Fatal("expected error when writing to file with ulimit -f 0, but got none")
+	}
+
+	stderr := cmd.Stderr.(*bytes.Buffer).String()
+	expectErr := "Error: Failed to write main.tf"
+	if !strings.Contains(stderr, expectErr) {
+		t.Fatalf("expected stderr to contain '%s', but got: %s", expectErr, stderr)
+	}
+
+	// Finally, confirm that the error made main.tf empty
+	content, err = os.ReadFile(mainPath)
+	if err != nil {
+		t.Fatalf("unexpected error reading test file: %s", err)
+	}
+	if len(content) != 0 {
+		t.Fatalf("expected main.tf to be empty after error, but got: %s", string(content))
+	}
+}
```

**File**: `internal/command/e2etest/testdata/fmt/main.tf` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# File should contain formatting errors; do not edit!
+
+variable "a" {
+default="x"
+  type =    string
+}
+
+locals {
+    b = var.a
+c =   "y"
+}
\ No newline at end of file
```

---

### Incident Patch 11: `71f923dd` (2026-09-25)
**Commit Message**: refactor: Make input be automatically disabled in test where `testingOverrides` is present with a nil `UIInput` value. (#39288)

This change makes input be automatically disabled in tests that have `testingOverrides` present but contain a nil `UIInput` value. Presence of `testingOverrides` is the only indicator of running in a test context. We default to input being disabled in tests, except if the test supplies a `UIInput` value that implies expecting enabled input.

Also, we add test coverage to show that these changes don't accidentally break prompting end users of the CLI for input.

**File**: `internal/command/apply_test.go` (modified, +6/-6)
```diff
@@ -554,7 +554,7 @@ func TestApply_input(t *testing.T) {
 	uiInput := ui.NewUIInputForTests(ui.UIInputOptions{
 		Reader: bytes.NewBufferString("foo\n"),
 		Writer: new(bytes.Buffer),
-	}, nil, nil, false)
+	}, nil, nil)
 
 	p := testProvider()
 	testingOverrides := metaOverridesForProvider(p)
@@ -600,7 +600,7 @@ func TestApply_inputPartial(t *testing.T) {
 	uiInput := ui.NewUIInputForTests(ui.UIInputOptions{
 		Reader: bytes.NewBufferString("one\ntwo\n"),
 		Writer: new(bytes.Buffer),
-	}, nil, nil, false)
+	}, nil, nil)
 
 	p := testProvider()
 	testingOverrides := metaOverridesForProvider(p)
@@ -678,7 +678,7 @@ func TestApply_plan(t *testing.T) {
 	uiInput := ui.NewUIInputForTests(ui.UIInputOptions{
 		Reader: new(bytes.Buffer),
 		Writer: new(bytes.Buffer),
-	}, nil, nil, false)
+	}, nil, nil)
 
 	planPath := applyFixturePlanFile(t)
 	statePath := testTempFile(t)
@@ -1043,7 +1043,7 @@ func TestApply_plan_stateStore_errorCases(t *testing.T) {
 		uiInput := ui.NewUIInputForTests(ui.UIInputOptions{
 			Reader: new(bytes.Buffer),
 			Writer: new(bytes.Buffer),
-		}, nil, nil, false)
+		}, nil, nil)
 
 		// Create the plan file that includes a state store
 		ver := version.Must(version.NewVersion("1.2.3"))
@@ -1130,7 +1130,7 @@ func TestApply_plan_stateStore_errorCases(t *testing.T) {
 		uiInput := ui.NewUIInputForTests(ui.UIInputOptions{
 			Reader: new(bytes.Buffer),
 			Writer: new(bytes.Buffer),
-		}, nil, nil, false)
+		}, nil, nil)
 
 		// Create the plan file that includes a state store
 		ver := version.Must(version.NewVersion("1.2.3"))
@@ -1302,7 +1302,7 @@ func TestApply_plan_remoteState(t *testing.T) {
 	uiInput := ui.NewUIInputForTests(ui.UIInputOptions{
 		Reader: new(bytes.Buffer),
 		Writer: new(bytes.Buffer),
-	}, nil, nil, false)
+	}, nil, nil)
 
 	// Create a remote state
 	state := testState()
```

**File**: `internal/command/command_test.go` (modified, +2/-8)
```diff
@@ -739,9 +739,6 @@ func testStdoutCapture(t *testing.T, dst io.Writer) func() {
 func testInteractiveInput(t *testing.T, answers []string) ui.InputRequesterForTest {
 	t.Helper()
 
-	// Don't disable input, so input is called
-	disableInput := false
-
 	// Set up reader/writers
 	testInputResponse := answers
 	inputReader := bytes.NewBufferString("")
@@ -750,7 +747,7 @@ func testInteractiveInput(t *testing.T, answers []string) ui.InputRequesterForTe
 	uiInput := ui.NewUIInputForTests(ui.UIInputOptions{
 		Reader: inputReader,
 		Writer: inputWriter,
-	}, testInputResponse, nil, disableInput)
+	}, testInputResponse, nil)
 
 	// Return the UIInput for use in the test
 	return uiInput
@@ -766,9 +763,6 @@ func testInteractiveInput(t *testing.T, answers []string) ui.InputRequesterForTe
 func testInputMap(t *testing.T, answers map[string]string) (ui.InputRequesterForTest, *bytes.Buffer) {
 	t.Helper()
 
-	// Ensure input is called
-	inputDisabled := false
-
 	// Set up reader/writers
 	inputReader := bytes.NewBufferString("")
 	inputWriter := new(bytes.Buffer)
@@ -780,7 +774,7 @@ func testInputMap(t *testing.T, answers map[string]string) (ui.InputRequesterFor
 	ret := ui.NewUIInputForTests(ui.UIInputOptions{
 		Reader: inputReader,
 		Writer: inputWriter,
-	}, testInputResponse, testInputResponseMap, inputDisabled)
+	}, testInputResponse, testInputResponseMap)
 
 	// Queue the cleanup for the end of the test
 	t.Cleanup(func() {
```

**File**: `internal/command/meta.go` (modified, +11/-5)
```diff
@@ -295,17 +295,23 @@ type testingOverrides struct {
 	Providers    map[addrs.Provider]providers.Factory
 	Provisioners map[string]provisioners.Factory
 	PolicyClient policy.Client
-	UIInput      ui.InputRequester
+
+	// UIInput is used to override the default input mechanism for tests.
+	// By setting a value here, input will become enabled.
+	// If this is not set, input will be considered disabled.
+	UIInput ui.InputRequester
 }
 
 func (to *testingOverrides) Input() bool {
 	if to == nil {
+		// This path covers non-test scenarios and also tests where no overrides are present.
 		return true
 	}
-	if to.UIInput == nil {
-		return true
-	}
-	return !to.UIInput.InputDisabled()
+
+	// If a test's testingOverrides provides a UIInput we say input is enabled.
+	// If a test's testingOverrides hasn't provided a UIInput we say input is disabled, as this
+	// prevents those tests from timing out waiting for input.
+	return to.UIInput != nil
 }
 
 // initStatePaths is used to initialize the default values for
```

**File**: `internal/command/meta_new_test.go` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+// Copyright IBM Corp. 2014, 2026
+// SPDX-License-Identifier: BUSL-1.1
+
+package command
+
+import (
+	"testing"
+
+	"github.com/hashicorp/terraform/internal/command/ui"
+)
+
+func TestMeta_Input(t *testing.T) {
+	cases := []struct {
+		name     string
+		meta     *Meta
+		expected bool
+		env      string
+	}{
+		{
+			name: "E2E usage with -input=true => input enabled",
+			// This is exactly the same as a badly set up test,
+			// which would fail due to no input being provided.
+			meta: &Meta{
+				input:            true, // default, CLI flag redundant
+				testingOverrides: nil,  // unset as not in a test
+			},
+			expected: true,
+		},
+		{
+			name: "E2E usage with -input=false => input disabled",
+			meta: &Meta{
+				input:            false, // set by CLI flag
+				testingOverrides: nil,   // unset as not in a test
+			},
+			expected: false,
+		},
+		{
+			name: "E2E usage with TF_INPUT=false => input disabled",
+			meta: &Meta{
+				input:            false, // changed by env
+				testingOverrides: nil,   // unset as not in a test
+			},
+			env:      "false",
+			expected: false,
+		},
+		{
+			name: "E2E usage with TF_INPUT=0 => input disabled",
+			meta: &Meta{
+				input:            false, // changed by env
+				testingOverrides: nil,   // unset as not in a test
+			},
+			env:      "0",
+			expected: false,
+		},
+		{
+			name: "test usage with UIInput not set in testingOverrides => input disabled",
+			meta: &Meta{
+				input: true, // default
+				testingOverrides: &testingOverrides{
+					UIInput: nil, // unset in test setup
+				},
+			},
+			expected: false,
+		},
+		{
+			name: "test usage with UIInput set in testingOverrides => input enabled",
+			meta: &Meta{
+				input: true, // default
+				testingOverrides: &testingOverrides{
+					UIInput: ui.NewUIInputForTests(ui.UIInputOptions{}, nil, nil),
+				},
+			},
+			expected: true,
+		},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			if tc.env != "" {
+				t.Setenv(InputModeEnvVar, tc.env)
+			}
+
+			got := tc.meta.Input()
+			if got != tc.expected {
+				t.Errorf("got %v; want %v", got, tc.expected)
+			}
+		})
+	}
+}
```

**File**: `internal/command/meta_test.go` (modified, +42/-12)
```diff
@@ -79,11 +79,9 @@ func TestMetaColorize(t *testing.T) {
 }
 
 func TestMetaInputMode(t *testing.T) {
-	// Ensure prompting for input is enabled
-	inputDisabled := false
 	uiInput := ui.NewUIInputForTests(
 		ui.UIInputOptions{},
-		nil, nil, inputDisabled,
+		nil, nil,
 	)
 
 	m := new(Meta)
@@ -103,11 +101,10 @@ func TestMetaInputMode(t *testing.T) {
 }
 
 func TestMetaInputMode_envVar(t *testing.T) {
-	// Ensure prompting for input is enabled
-	inputDisabled := false
+	// Ask for input
 	uiInput := ui.NewUIInputForTests(
 		ui.UIInputOptions{},
-		nil, nil, inputDisabled,
+		nil, nil,
 	)
 
 	m := new(Meta)
@@ -142,11 +139,10 @@ func TestMetaInputMode_envVar(t *testing.T) {
 }
 
 func TestMetaInputMode_disable(t *testing.T) {
-	// Ensure prompting for input is enabled
-	inputDisabled := false
+	// Ask for input
 	uiInput := ui.NewUIInputForTests(
 		ui.UIInputOptions{},
-		nil, nil, inputDisabled,
+		nil, nil,
 	)
 
 	m := new(Meta)
@@ -439,13 +435,10 @@ func TestMeta_process(t *testing.T) {
 
 	for _, test := range tests {
 		t.Run(fmt.Sprintf("%s", test.GivenArgs), func(t *testing.T) {
-			// Ensure prompting for input is enabled
-			inputDisabled := false
 			uiInput := ui.NewUIInputForTests(
 				ui.UIInputOptions{},
 				nil,
 				nil,
-				inputDisabled,
 			)
 
 			m := new(Meta)
@@ -494,3 +487,40 @@ func TestCommand_checkRequiredVersion(t *testing.T) {
 		t.Fatalf("output should not point to met version constraint, but is:\n\n%s", errStr)
 	}
 }
+
+func TestTestingOverrides_Input(t *testing.T) {
+	cases := []struct {
+		name             string
+		testingOverrides *testingOverrides
+		expected         bool
+	}{
+		{
+			name:             "nil testingOverrides",
+			testingOverrides: nil,
+			expected:         true,
+		},
+		{
+			name: "UIInput set",
+			testingOverrides: &testingOverrides{
+				UIInput: ui.NewUIInputForTests(ui.UIInputOptions{}, nil, nil),
+			},
+			expected: true,
+		},
+		{
+			name: "UIInput not set in testingOverrides",
+			testingOverrides: &testingOverrides{
+				UIInput: nil,
+			},
+			expected: false,
+		},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			got := tc.testingOverrides.Input()
+			if got != tc.expected {
+				t.Errorf("got %v; want %v", got, tc.expected)
+			}
+		})
+	}
+}
```

**File**: `internal/command/plan_test.go` (modified, +4/-10)
```diff
@@ -879,12 +879,10 @@ func TestPlan_stateDefault(t *testing.T) {
 }
 
 func TestPlan_validate(t *testing.T) {
-	// This is triggered by not asking for input so we have to
-	// ensure that input is not disabled
-	inputDisabled := false
+	// Ask for input
 	uiInput := ui.NewUIInputForTests(
 		ui.UIInputOptions{},
-		nil, nil, inputDisabled,
+		nil, nil,
 	)
 
 	td := t.TempDir()
@@ -1061,13 +1059,11 @@ func TestPlan_providerArgumentUnset(t *testing.T) {
 	testCopyDir(t, testFixturePath("plan"), td)
 	t.Chdir(td)
 
-	// Ensure input would be asked
-	disableInput := false
 	// The plan command will prompt for interactive input of provider.test.region
 	reader := bytes.NewBufferString("us-east-1\n")
 	uiInput := ui.NewUIInputForTests(ui.UIInputOptions{
 		Reader: reader,
-	}, nil, nil, disableInput)
+	}, nil, nil)
 
 	p := planFixtureProvider()
 	// override the planFixtureProvider schema to include a required provider argument
@@ -1145,13 +1141,11 @@ func TestPlan_providerConfigMerge(t *testing.T) {
 	testCopyDir(t, testFixturePath("plan-provider-input"), td)
 	t.Chdir(td)
 
-	// Ensure input would be asked
-	disableInput := false
 	// The plan command will prompt for interactive input of provider.test.region
 	reader := bytes.NewBufferString("us-east-1\n")
 	uiInput := ui.NewUIInputForTests(ui.UIInputOptions{
 		Reader: reader,
-	}, nil, nil, disableInput)
+	}, nil, nil)
 
 	p := planFixtureProvider()
 	// override the planFixtureProvider schema to include a required provider argument and a nested block
```

**File**: `internal/command/refresh_test.go` (modified, +2/-3)
```diff
@@ -549,12 +549,11 @@ func TestRefresh_varsUnset(t *testing.T) {
 	testCopyDir(t, testFixturePath("refresh-unset-var"), td)
 	t.Chdir(td)
 
-	// Ensure input would be asked
-	disableInput := false
+	// Ask for input
 	reader := bytes.NewBufferString("bar\n")
 	uiInput := ui.NewUIInputForTests(ui.UIInputOptions{
 		Reader: reader,
-	}, []string{}, map[string]string{}, disableInput)
+	}, []string{}, map[string]string{})
 
 	state := testState()
 	statePath := testStateFile(t, state)
```

**File**: `internal/command/ui/ui_input.go` (modified, +1/-10)
```diff
@@ -38,7 +38,6 @@ type uIInput struct {
 	// Test input responses for automated testing.
 	testInputResponse    []string
 	testInputResponseMap map[string]string
-	testInputDisabled    bool
 
 	listening int32
 	result    chan string
@@ -55,8 +54,6 @@ type uIInput struct {
 // we make calling code use interfaces.
 type InputRequester interface {
 	terraform.UIInput
-
-	InputDisabled() bool
 }
 
 type InputRequesterForTest interface {
@@ -101,20 +98,14 @@ func NewUIInput(opts UIInputOptions) InputRequester {
 	return i
 }
 
-func NewUIInputForTests(opts UIInputOptions, testInputResponse []string, testInputResponseMap map[string]string, disableInput bool) InputRequesterForTest {
+func NewUIInputForTests(opts UIInputOptions, testInputResponse []string, testInputResponseMap map[string]string) InputRequesterForTest {
 	i := NewUIInput(opts).(*uIInput)
 	i.testInputResponse = testInputResponse
 	i.testInputResponseMap = testInputResponseMap
-	i.testInputDisabled = disableInput
 
 	return i
 }
 
-// Implements Foo.
-func (i *uIInput) InputDisabled() bool {
-	return i.testInputDisabled
-}
-
 // Implements InputRequesterForTest.
 func (i *uIInput) RemainingTestInputResponses() map[string]string {
 	// Entries are deleted as they are consumed.
```

---

### Incident Patch 12: `2b7c4ca1` (2026-09-25)
**Commit Message**: Merge pull request #39287 from hashicorp/jbardin/tainted-crash

Ensure states without ObjectStatus are never serialized

**File**: `.changes/v1.16/BUG FIXES-20260925-091845.yaml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+kind: BUG FIXES
+body: FIx crash when tainted instance state is seen without a valid status
+time: 2026-09-25T09:18:45.683653-04:00
+custom:
+    Issue: "39287"
```

**File**: `internal/terraform/context_apply2_test.go` (modified, +147/-0)
```diff
@@ -30,7 +30,9 @@ import (
 	"github.com/hashicorp/terraform/internal/plans"
 	"github.com/hashicorp/terraform/internal/providers"
 	testing_provider "github.com/hashicorp/terraform/internal/providers/testing"
+	"github.com/hashicorp/terraform/internal/provisioners"
 	"github.com/hashicorp/terraform/internal/states"
+	"github.com/hashicorp/terraform/internal/states/statefile"
 	"github.com/hashicorp/terraform/internal/tfdiags"
 )
 
@@ -5666,3 +5668,148 @@ resource "test_object" "forget" {
 		t.Fatal("should be no deposed instances")
 	}
 }
+
+// A create that fails with a partial state must never be visible in the
+// working state with an invalid status, because concurrent nodes may be
+// persisting state snapshots at any time.
+func TestContext2Apply_failedCreateStatusVisibleToConcurrentStateUpdate(t *testing.T) {
+	m := testModuleInline(t, map[string]string{
+		"main.tf": `
+resource "test_object" "a" {
+  test_string = "a"
+  provisioner "shell" {}
+}
+
+resource "test_object" "b" {
+  test_string = "b"
+}
+`,
+	})
+
+	// b is held until a is either provisioning or complete
+	releaseB := make(chan struct{})
+	var releaseOnce sync.Once
+	release := func() { releaseOnce.Do(func() { close(releaseB) }) }
+	bPersisted := make(chan struct{})
+
+	p := simpleMockProvider()
+	p.ApplyResourceChangeFn = func(req providers.ApplyResourceChangeRequest) (resp providers.ApplyResourceChangeResponse) {
+		resp.NewState = req.PlannedState
+		if req.PlannedState.GetAttr("test_string").AsString() == "a" {
+			resp.Diagnostics = resp.Diagnostics.Append(errors.New("create failed"))
+		}
+		return resp
+	}
+
+	pr := testProvisioner()
+	pr.ProvisionResourceFn = func(req provisioners.ProvisionResourceRequest) (resp provisioners.ProvisionResourceResponse) {
+		release()
+		select {
+		case <-bPersisted:
+		case <-time.After(5 * time.Second):
+			panic("timeout")
+		}
+		return resp
+	}
+
+	hook := &stateSerializingTestHook{
+		onPreApply: func(addr addrs.AbsResourceInstance) {
+			if addr.Equal(mustResourceInstanceAddr("test_object.b")) {
+				select {
+				case <-releaseB:
+				case <-time.After(5 * time.Second):
+					panic("timeout")
+				}
+			}
+		},
+		onPostApply: func(addr addrs.AbsResourceInstance) {
+			if addr.Equal(mustResourceInstanceAddr("test_object.a")) {
+				release()
+			}
+		},
+		onUpdate: func(s *states.State) {
+			if s.ResourceInstance(mustResourceInstanceAddr("test_object.b")) != nil {
+				select {
+				case <-bPersisted:
+				default:
+					close(bPersisted)
+				}
+			}
+		},
+	}
+
+	ctx := testContext2(t, &ContextOpts{
+		Hooks: []Hook{hook},
+		Providers: map[addrs.Provider]providers.Factory{
+			addrs.NewDefaultProvider("test"): testProviderFuncFixed(p),
+		},
+		Provisioners: map[string]provisioners.Factory{
+			"shell": testProvisionerFuncFixed(pr),
+		},
+	})
+
+	plan, diags := ctx.Plan(m, states.NewState(), DefaultPlanOpts)
+	tfdiags.AssertNoErrors(t, diags)
+
+	state, diags := ctx.Apply(plan, m, nil)
+	if !diags.HasErrors() {
+		t.Fatal("expected apply error")
+	}
+
+	for _, err := range hook.errs() {
+		t.Errorf("state snapshot could not be serialized: %s", err)
+	}
+
+	if pr.ProvisionResourceCalled {
+		t.Error("provisioner should not run for a failed create")
+	}
+
+	a := state.ResourceInstance(mustResourceInstanceAddr("test_object.a"))
+	if a == nil || a.Current == nil || a.Current.Status != states.ObjectTainted {
+		t.Fatalf("expected test_object.a to be tainted, got %#v", a)
+	}
+}
+
+// stateSerializingTestHook serializes every state snapshot, as the local backend's
+// StateHook does via statemgr.Filesystem.
+type stateSerializingTestHook struct {
+	NilHook
+
+	mu          sync.Mutex
+	serErrs     []error
+	onPreApply  func(addrs.AbsResourceInstance)
+	onPostApply func(addrs.AbsResourceInstance)
+	onUpdate    func(*states.State)
+}
+
+func (h *stateSerializingTestHook) PostApply(id HookResourceIdentity, dk addrs.DeposedKey, newState cty.Value, err error) (HookAction, error) {
+	if h.onPostApply != nil {
+		h.onPostApply(id.Addr)
+	}
+	return HookActionContinue, nil
+}
+
+func (h *stateSerializingTestHook) PreApply(id HookResourceIdentity, dk addrs.DeposedKey, action plans.Action, priorState, plannedNewState cty.Value) (HookAction, error) {
+	if h.onPreApply != nil {
+		h.onPreApply(id.Addr)
+	}
+	return HookActionContinue, nil
+}
+
+func (h *stateSerializingTestHook) PostStateUpdate(s *states.State) (HookAction, error) {
+	h.mu.Lock()
+	defer h.mu.Unlock()
+	if err := statefile.Write(&statefile.File{State: s}, &bytes.Buffer{}); err != nil {
+		h.serErrs = append(h.serErrs, err)
+	}
+	if h.onUpdate != nil {
+		h.onUpdate(s)
+	}
+	return HookActionContinue, nil
+}
+
+func (h *stateSerializingTestHook) errs() []error {
+	h.mu.Lock()
+	defer h.mu.Unlock()
+	return h.serErrs
+}
```

**File**: `internal/terraform/node_resource_abstract_instance.go` (modified, +18/-18)
```diff
@@ -2603,34 +2603,34 @@ func (n *NodeAbstractResourceInstance) evalDestroyProvisionerConfig(ctx EvalCont
 // nil, since it is only used to evaluate the configuration.
 func (n *NodeAbstractResourceInstance) apply(
 	ctx EvalContext,
-	state *states.ResourceInstanceObject,
+	priorState *states.ResourceInstanceObject,
 	change *plans.ResourceInstanceChange,
 	applyConfig *configs.Resource,
 	keyData instances.RepetitionData,
 	createBeforeDestroy bool) (*states.ResourceInstanceObject, tfdiags.Diagnostics) {
 
 	var diags tfdiags.Diagnostics
-	if state == nil {
-		state = &states.ResourceInstanceObject{}
+	if priorState == nil {
+		priorState = &states.ResourceInstanceObject{}
 	}
 
 	if change.Action == plans.NoOp {
 		// If this is a no-op change then we don't want to actually change
 		// anything, so we'll just echo back the state we were given and
 		// let our internal checks and updates proceed.
 		log.Printf("[TRACE] NodeAbstractResourceInstance.apply: skipping %s because it has no planned action", n.Addr)
-		return state, diags
+		return priorState, diags
 	}
 
 	provider, providerSchema, err := getProvider(ctx, n.ResolvedProvider)
 	if err != nil {
-		return state, diags.Append(err)
+		return priorState, diags.Append(err)
 	}
 	schema := providerSchema.SchemaForResourceType(n.Addr.Resource.Resource.Mode, n.Addr.Resource.Resource.Type)
 	if schema.Body == nil {
 		// Should be caught during validation, so we don't bother with a pretty error here
 		diags = diags.Append(fmt.Errorf("provider does not support resource type %q", n.Addr.Resource.Resource.Type))
-		return state, diags
+		return priorState, diags
 	}
 
 	log.Printf("[INFO] Starting apply for %s", n.Addr)
@@ -2641,7 +2641,7 @@ func (n *NodeAbstractResourceInstance) apply(
 		configVal, _, configDiags = ctx.EvaluateBlock(applyConfig.Config, schema.Body, nil, keyData)
 		diags = diags.Append(configDiags)
 		if configDiags.HasErrors() {
-			return state, diags
+			return priorState, diags
 		}
 	}
 
@@ -2666,13 +2666,13 @@ func (n *NodeAbstractResourceInstance) apply(
 				strings.Join(unknownPaths, "\n"),
 			),
 		))
-		return state, diags
+		return priorState, diags
 	}
 
 	metaConfigVal, metaDiags := n.Provider().getProviderMeta(ctx, n.Addr.Resource, n.ProviderMetas)
 	diags = diags.Append(metaDiags)
 	if diags.HasErrors() {
-		return state, diags
+		return priorState, diags
 	}
 
 	log.Printf("[DEBUG] %s: applying the planned %s change", n.Addr, change.Action)
@@ -2694,10 +2694,10 @@ func (n *NodeAbstractResourceInstance) apply(
 	if change.Action == plans.Update && eq && !marks.MarksEqual(beforePaths, afterPaths) {
 		// Copy the previous state, changing only the value
 		newState := &states.ResourceInstanceObject{
-			CreateBeforeDestroy: state.CreateBeforeDestroy,
-			Dependencies:        state.Dependencies,
-			Private:             state.Private,
-			Status:              state.Status,
+			CreateBeforeDestroy: priorState.CreateBeforeDestroy,
+			Dependencies:        priorState.Dependencies,
+			Private:             priorState.Private,
+			Status:              states.ObjectReady,
 			Value:               change.After,
 			Identity:            change.AfterIdentity,
 		}
@@ -2795,7 +2795,7 @@ func (n *NodeAbstractResourceInstance) apply(
 		// Bail early in this particular case, because an object that doesn't
 		// conform to the schema can't be saved in the state anyway -- the
 		// serializer will reject it.
-		return state, diags
+		return priorState, diags
 	}
 
 	// Providers are supposed to return null values for all write-only attributes
@@ -2813,7 +2813,7 @@ func (n *NodeAbstractResourceInstance) apply(
 	diags = diags.Append(writeOnlyDiags)
 
 	if writeOnlyDiags.HasErrors() {
-		return state, diags
+		return priorState, diags
 	}
 
 	// After this point we have a type-conforming result object and so we
@@ -2948,12 +2948,12 @@ func (n *NodeAbstractResourceInstance) apply(
 		// prior state as the new value, making this effectively a no-op.  If
 		// the item really _has_ been deleted then our next refresh will detect
 		// that and fix it up.
-		return state.DeepCopy(), diags
+		return priorState.DeepCopy(), diags
 
 	case diags.HasErrors() && !newVal.IsNull():
 		// if we have an error, make sure we restore the object status in the new state
 		newState := &states.ResourceInstanceObject{
-			Status:              state.Status,
+			Status:              priorState.Status,
 			Value:               newVal,
 			Private:             resp.Private,
 			CreateBeforeDestroy: createBeforeDestroy,
@@ -2963,7 +2963,7 @@ func (n *NodeAbstractResourceInstance) apply(
 		// if the resource was being deleted, the dependencies are not going to
 		// be recalculated and we need to restore those as well.
 		if change.Action == plans.Delete {
-			newState.Dependencies = state.Dependencies
+			newState.Dependencies = priorState.Dependencies
 		}
 
 		return newState, diags
```

**File**: `internal/terraform/node_resource_apply_instance.go` (modified, +10/-8)
```diff
@@ -290,7 +290,7 @@ func (n *NodeApplyableResourceInstance) managedResourceExecute(ctx EvalContext)
 	diags = diags.Append(applyDiags)
 	if diags.HasErrors() {
 		// apply errors might need to taint the state
-		if err := n.taintInstanceState(ctx, state, diffApply.Action); err != nil {
+		if state, err = n.taintInstanceState(ctx, state, diffApply.Action); err != nil {
 			return diags.Append(err)
 		}
 	} else {
@@ -323,7 +323,7 @@ func (n *NodeApplyableResourceInstance) managedResourceExecute(ctx EvalContext)
 		diags = diags.Append(applyProvisionersDiags)
 		// provisioners always tainted on error
 		if diags.HasErrors() {
-			if err := n.taintInstanceState(ctx, state, diffApply.Action); err != nil {
+			if state, err = n.taintInstanceState(ctx, state, diffApply.Action); err != nil {
 				// we always return immediately if we can't update state
 				return diags.Append(err)
 			}
@@ -334,7 +334,7 @@ func (n *NodeApplyableResourceInstance) managedResourceExecute(ctx EvalContext)
 		taintInstance, actionDiags := n.invokeActions(ctx, repData, configs.AfterEvents, state.Value)
 		diags = diags.Append(actionDiags)
 		if taintInstance {
-			if err := n.taintInstanceState(ctx, state, diffApply.Action); err != nil {
+			if state, err = n.taintInstanceState(ctx, state, diffApply.Action); err != nil {
 				// we always return immediately if we can't update state
 				return diags.Append(err)
 			}
@@ -469,18 +469,20 @@ func (n *NodeApplyableResourceInstance) checkPlannedChange(ctx EvalContext, plan
 
 // taintInstanceState takes the state object error from an apply operation and
 // writes the instance object to the global stated marked as tainted, but only
-// if the instance was being created.
+// if the instance was being created. The returned object is what was written,
+// and must replace the caller's object so that later writes of it do not
+// revert the tainted status.
 //
 // TODO: Tainted was invented for failed create events, and provisioners which
 // could only be associated with those create events. If actions ever need to be
 // rerun for other event types, something more specific than `Tainted` needs to
 // be added to the resource state.
-func (n *NodeApplyableResourceInstance) taintInstanceState(ctx EvalContext, state *states.ResourceInstanceObject, action plans.Action) error {
+func (n *NodeApplyableResourceInstance) taintInstanceState(ctx EvalContext, state *states.ResourceInstanceObject, action plans.Action) (*states.ResourceInstanceObject, error) {
 	if action != plans.Create {
-		return nil
+		return state, nil
 	}
 
 	log.Printf("[TRACE] taintState: %s encountered an error during creation, so it is now marked as tainted", n.Addr)
-	return n.writeResourceInstanceState(ctx, state.AsTainted(), workingState)
-
+	tainted := state.AsTainted()
+	return tainted, n.writeResourceInstanceState(ctx, tainted, workingState)
 }
```

---

### Incident Patch 13: `81849acf` (2026-09-24)
**Commit Message**: test: Update test and test fixture to stop using the `template` provider

The `template` provider is archived and isn't built for newer platforms.

**File**: `internal/command/e2etest/automation_test.go` (modified, +20/-19)
```diff
@@ -43,8 +43,8 @@ func TestPlanApplyInAutomation(t *testing.T) {
 
 	// Make sure we actually downloaded the plugins, rather than picking up
 	// copies that might be already installed globally on the system.
-	if !strings.Contains(stdout, "Installing hashicorp/template v") {
-		t.Errorf("template provider download message is missing from init output:\n%s", stdout)
+	if !strings.Contains(stdout, "Installing hashicorp/local v") {
+		t.Errorf("local provider download message is missing from init output:\n%s", stdout)
 		t.Logf("(this can happen if you have a copy of the plugin in one of the global plugin search dirs)")
 	}
 	if !strings.Contains(stdout, "Installing hashicorp/null v") {
@@ -58,8 +58,8 @@ func TestPlanApplyInAutomation(t *testing.T) {
 		t.Fatalf("unexpected plan error: %s\nstderr:\n%s", err, stderr)
 	}
 
-	if !strings.Contains(stdout, "1 to add, 0 to change, 0 to destroy") {
-		t.Errorf("incorrect plan tally; want 1 to add:\n%s", stdout)
+	if !strings.Contains(stdout, "2 to add, 0 to change, 0 to destroy") {
+		t.Errorf("incorrect plan tally; want 2 to add:\n%s", stdout)
 	}
 
 	// Because we're running with TF_IN_AUTOMATION set, we should not see
@@ -75,11 +75,12 @@ func TestPlanApplyInAutomation(t *testing.T) {
 
 	// stateResources := plan.Changes.Resources
 	diffResources := plan.Changes.Resources
-	if len(diffResources) != 1 {
+	if len(diffResources) != 2 {
 		t.Errorf("incorrect number of resources in plan")
 	}
 
 	expected := map[string]plans.Action{
+		"local_file.hello":   plans.Create,
 		"null_resource.test": plans.Create,
 	}
 
@@ -99,8 +100,8 @@ func TestPlanApplyInAutomation(t *testing.T) {
 		t.Fatalf("unexpected apply error: %s\nstderr:\n%s", err, stderr)
 	}
 
-	if !strings.Contains(stdout, "Resources: 1 added, 0 changed, 0 destroyed") {
-		t.Errorf("incorrect apply tally; want 1 added:\n%s", stdout)
+	if !strings.Contains(stdout, "Resources: 2 added, 0 changed, 0 destroyed") {
+		t.Errorf("incorrect apply tally; want 2 added:\n%s", stdout)
 	}
 
 	state, err := tf.LocalState()
@@ -116,7 +117,7 @@ func TestPlanApplyInAutomation(t *testing.T) {
 	sort.Strings(gotResources)
 
 	wantResources := []string{
-		"data.template_file.test",
+		"local_file.hello",
 		"null_resource.test",
 	}
 
@@ -131,7 +132,7 @@ func TestAutoApplyInAutomation(t *testing.T) {
 	t.Parallel()
 
 	// This test reaches out to releases.hashicorp.com to download the
-	// template and null providers, so it can only run if network access is
+	// local and null providers, so it can only run if network access is
 	// allowed.
 	skipIfCannotAccessNetwork(t)
 
@@ -150,8 +151,8 @@ func TestAutoApplyInAutomation(t *testing.T) {
 
 	// Make sure we actually downloaded the plugins, rather than picking up
 	// copies that might be already installed globally on the system.
-	if !strings.Contains(stdout, "Installing hashicorp/template v") {
-		t.Errorf("template provider download message is missing from init output:\n%s", stdout)
+	if !strings.Contains(stdout, "Installing hashicorp/local v") {
+		t.Errorf("local provider download message is missing from init output:\n%s", stdout)
 		t.Logf("(this can happen if you have a copy of the plugin in one of the global plugin search dirs)")
 	}
 	if !strings.Contains(stdout, "Installing hashicorp/null v") {
@@ -165,8 +166,8 @@ func TestAutoApplyInAutomation(t *testing.T) {
 		t.Fatalf("unexpected apply error: %s\nstderr:\n%s", err, stderr)
 	}
 
-	if !strings.Contains(stdout, "Resources: 1 added, 0 changed, 0 destroyed") {
-		t.Errorf("incorrect apply tally; want 1 added:\n%s", stdout)
+	if !strings.Contains(stdout, "Resources: 2 added, 0 changed, 0 destroyed") {
+		t.Errorf("incorrect apply tally; want 2 added:\n%s", stdout)
 	}
 
 	state, err := tf.LocalState()
@@ -182,7 +183,7 @@ func TestAutoApplyInAutomation(t *testing.T) {
 	sort.Strings(gotResources)
 
 	wantResources := []string{
-		"data.template_file.test",
+		"local_file.hello",
 		"null_resource.test",
 	}
 
@@ -197,7 +198,7 @@ func TestPlanOnlyInAutomation(t *testing.T) {
 	t.Parallel()
 
 	// This test reaches out to releases.hashicorp.com to download the
-	// template and null providers, so it can only run if network access is
+	// local and null providers, so it can only run if network access is
 	// allowed.
 	skipIfCannotAccessNetwork(t)
 
@@ -216,8 +217,8 @@ func TestPlanOnlyInAutomation(t *testing.T) {
 
 	// Make sure we actually downloaded the plugins, rather than picking up
 	// copies that might be already installed globally on the system.
-	if !strings.Contains(stdout, "Installing hashicorp/template v") {
-		t.Errorf("template provider download message is missing from init output:\n%s", stdout)
+	if !strings.Contains(stdout, "Installing hashicorp/local v") {
+		t.Errorf("local provider download message is missing from init output:\n%s", stdout)
 		t.Logf("(this can happen if you have a copy of the plugin in one of the global plugin search dirs)")
 	}
 	if !strings.Contains(stdout, "Installing hashicorp/
```

**File**: `internal/command/e2etest/primary_test.go` (modified, +13/-12)
```diff
@@ -35,7 +35,7 @@ func TestPrimarySeparatePlan(t *testing.T) {
 	t.Parallel()
 
 	// This test reaches out to releases.hashicorp.com to download the
-	// template and null providers, so it can only run if network access is
+	// local and null providers, so it can only run if network access is
 	// allowed.
 	skipIfCannotAccessNetwork(t)
 
@@ -50,8 +50,8 @@ func TestPrimarySeparatePlan(t *testing.T) {
 
 	// Make sure we actually downloaded the plugins, rather than picking up
 	// copies that might be already installed globally on the system.
-	if !strings.Contains(stdout, "Installing hashicorp/template v") {
-		t.Errorf("template provider download message is missing from init output:\n%s", stdout)
+	if !strings.Contains(stdout, "Installing hashicorp/local v") {
+		t.Errorf("local provider download message is missing from init output:\n%s", stdout)
 		t.Logf("(this can happen if you have a copy of the plugin in one of the global plugin search dirs)")
 	}
 	if !strings.Contains(stdout, "Installing hashicorp/null v") {
@@ -65,8 +65,8 @@ func TestPrimarySeparatePlan(t *testing.T) {
 		t.Fatalf("unexpected plan error: %s\nstderr:\n%s", err, stderr)
 	}
 
-	if !strings.Contains(stdout, "1 to add, 0 to change, 0 to destroy") {
-		t.Errorf("incorrect plan tally; want 1 to add:\n%s", stdout)
+	if !strings.Contains(stdout, "2 to add, 0 to change, 0 to destroy") {
+		t.Errorf("incorrect plan tally; want 2 to add:\n%s", stdout)
 	}
 
 	if !strings.Contains(stdout, "Saved the plan to: tfplan") {
@@ -82,11 +82,12 @@ func TestPrimarySeparatePlan(t *testing.T) {
 	}
 
 	diffResources := plan.Changes.Resources
-	if len(diffResources) != 1 {
-		t.Errorf("incorrect number of resources in plan")
+	if len(diffResources) != 2 {
+		t.Errorf("incorrect number of resources in plan, want %d, got %d", 2, len(diffResources))
 	}
 
 	expected := map[string]plans.Action{
+		"local_file.hello":   plans.Create,
 		"null_resource.test": plans.Create,
 	}
 
@@ -106,8 +107,8 @@ func TestPrimarySeparatePlan(t *testing.T) {
 		t.Fatalf("unexpected apply error: %s\nstderr:\n%s", err, stderr)
 	}
 
-	if !strings.Contains(stdout, "Resources: 1 added, 0 changed, 0 destroyed") {
-		t.Errorf("incorrect apply tally; want 1 added:\n%s", stdout)
+	if !strings.Contains(stdout, "Resources: 2 added, 0 changed, 0 destroyed") {
+		t.Errorf("incorrect apply tally; want 2 added:\n%s", stdout)
 	}
 
 	state, err := tf.LocalState()
@@ -123,7 +124,7 @@ func TestPrimarySeparatePlan(t *testing.T) {
 	sort.Strings(gotResources)
 
 	wantResources := []string{
-		"data.template_file.test",
+		"local_file.hello",
 		"null_resource.test",
 	}
 
@@ -137,8 +138,8 @@ func TestPrimarySeparatePlan(t *testing.T) {
 		t.Fatalf("unexpected destroy error: %s\nstderr:\n%s", err, stderr)
 	}
 
-	if !strings.Contains(stdout, "Resources: 1 destroyed") {
-		t.Errorf("incorrect destroy tally; want 1 destroyed:\n%s", stdout)
+	if !strings.Contains(stdout, "Resources: 2 destroyed") {
+		t.Errorf("incorrect destroy tally; want 2 destroyed:\n%s", stdout)
 	}
 
 	state, err = tf.LocalState()
```

**File**: `internal/command/e2etest/testdata/full-workflow-null/main.tf` (modified, +6/-8)
```diff
@@ -3,20 +3,18 @@ variable "name" {
   default = "world"
 }
 
-data "template_file" "test" {
-  template = "Hello, $${name}"
-
-  vars = {
-    name = "${var.name}"
-  }
+resource "local_file" "hello" {
+  content  = "Hello, ${var.name}"
+  filename = "${path.module}/hello.txt"
 }
 
+
 resource "null_resource" "test" {
   triggers = {
-    greeting = "${data.template_file.test.rendered}"
+    greeting = "${local_file.hello.content}"
   }
 }
 
 output "greeting" {
-  value = "${null_resource.test.triggers["greeting"]}"
+  value = null_resource.test.triggers["greeting"]
 }
```

---

### Incident Patch 14: `55d258b2` (2026-09-24)
**Commit Message**: fix: Rename import

**File**: `internal/command/views/init_test.go` (modified, +3/-3)
```diff
@@ -18,7 +18,7 @@ import (
 	"github.com/hashicorp/terraform/internal/policy"
 	"github.com/hashicorp/terraform/internal/terminal"
 	"github.com/hashicorp/terraform/internal/tfdiags"
-	"github.com/hashicorp/terraform/version"
+	tfversion "github.com/hashicorp/terraform/version"
 )
 
 func TestNewInit_jsonViewDiagnostics(t *testing.T) {
@@ -948,10 +948,10 @@ func TestInitJSON_Version(t *testing.T) {
 	want := []map[string]interface{}{
 		{
 			"@level":    "info",
-			"@message":  fmt.Sprintf("Terraform %s", version.String()),
+			"@message":  fmt.Sprintf("Terraform %s", tfversion.String()),
 			"@module":   "terraform.ui",
 			"type":      "version",
-			"terraform": version.String(),
+			"terraform": tfversion.String(),
 			"ui":        JSON_UI_VERSION,
 		},
 	}
```

#### Recent Merged Pull Requests:
- **PR #39342** (2026-10-05): refactor: Reduce small `const` strings in views package: `ProviderInstallationLogger ` interface (@SarahFrench)
- **PR #39341** (2026-10-05): refactor: Reduce small `const` strings in `views` package: `Init` interface (@SarahFrench)
- **PR #39340** (2026-10-05): refactor: Reduce small `const` strings in `views` package: `ModuleInstallationLogger` interface (@SarahFrench)
- **PR #39339** (2026-10-05): refactor: Reduce small `const` strings in views package: `StateStoreProviderTrustLogger` interface (@SarahFrench)
- **PR #39336** (2026-10-05): refactor: Make `unlock` command use the `arguments` package for CLI flag and argument parsing (@SarahFrench)
- **PR #39335** (2026-10-05): fix: Add the `-json` flag to the `state identities` command's help text (@SarahFrench)
- **PR #39334** (2026-10-05): refactor: Make `state identities` use the `arguments` package to process CLI flags and arguments (@SarahFrench)
- **PR #39333** (2026-10-05): chore: Remove unused methods and `const`s in the `init` command's views code (@SarahFrench)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

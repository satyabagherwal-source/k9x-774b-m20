# Forensic Learning Record (Deep Inspection): pulumi/pulumi

> **Canonical Artifact**: `07_PROJECT_LEARNING/pulumi-pulumi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pulumi/pulumi](https://github.com/pulumi/pulumi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:53:53.306Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pulumi/pulumi`
- **Description**: Pulumi - Infrastructure as Code in any programming language 🚀
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 25760 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pkg/backend/display/tableutil.go`
```
// Copyright 2016, Pulumi Corporation.
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

package display

import (
	"strings"

	"github.com/pulumi/pulumi/sdk/v3/go/common/diag/colors"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/contract"
)

func columnHeader(msg string) string {
	return colors.Underline + colors.BrightBlue + msg + colors.Reset
}

func messagePadding(message string, maxWidth, extraPadding int) string {
	extraWhitespace := maxWidth - colors.MeasureColorizedString(message)
	contract.Assertf(extraWhitespace >= 0, "Neg whitespace. %v %s", maxWidth, message)

	// Place two spaces between all columns (except after the first column).  The first
	// column already has a ": " so it doesn't need the extra space.
	extraWhitespace += extraPadding

	return strings.Repeat(" ", extraWhitespace)
}

// Gets the padding necessary to prepend to a column in order to keep it aligned in the terminal.
func columnPadding(columns []string, columnIndex int, maxColumnWidths []int) string {
	extraWhitespace := " "
	if columnIndex >= 0 && len(maxColumnWidths) > 0 {
		column := columns[columnIndex]
		maxWidth := maxColumnWidths[columnIndex]
		extraWhitespace = messagePadding(column, maxWidth, 2)
	}
	return extraWhitespace
}

// Gets the fully padded message to be shown.  The message will always include the ID of the
// status, then some amount of optional padding, then some amount of msgWithColors, then the
// suffix.  Importantly, if there isn't enough room to display all of that on the terminal, then
// the msg will be truncated to try to make it fit.
func renderRow(columns []string, maxColumnWidths []int) string {
	var row strings.Builder
	for i := range columns {
		row.WriteString(columnPadding(columns, i-1, maxColumnWidths))
		row.WriteString(columns[i])
	}
	return row.String()
}

```

### Core Architecture Module: `pkg/backend/diy/state.go`
```
// Copyright 2016, Pulumi Corporation.
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

package diy

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/pulumi/pulumi/pkg/v3/resource/stack/snapshot"
	"github.com/pulumi/pulumi/sdk/v3/go/common/env"
	"github.com/pulumi/pulumi/sdk/v3/go/common/resource"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/retry"
	"github.com/pulumi/pulumi/sdk/v3/go/property"

	"go.opentelemetry.io/otel"
	"gocloud.dev/blob"
	"gocloud.dev/gcerrors"

	"github.com/pulumi/pulumi/pkg/v3/backend"
	"github.com/pulumi/pulumi/pkg/v3/engine"
	"github.com/pulumi/pulumi/pkg/v3/resource/deploy"
	"github.com/pulumi/pulumi/pkg/v3/resource/stack"
	"github.com/pulumi/pulumi/pkg/v3/secrets"
	"github.com/pulumi/pulumi/sdk/v3/go/common/apitype"
	"github.com/pulumi/pulumi/sdk/v3/go/common/encoding"
	"github.com/pulumi/pulumi/sdk/v3/go/common/resource/config"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/cmdutil"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/contract"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/logging"
)

// DisableIntegrityChecking can be set to true to disable checkpoint state integrity verification.  This is not
// recommended, because it could mean proceeding even in the face of a corrupted checkpoint state file, but can
// be used as a last resort when a command absolutely must be run.
var DisableIntegrityChecking bool

func (b *diyBackend) newUpdate(
	ctx context.Context,
	secretsProvider secrets.Provider,
	ref *diyBackendReference,
	op backend.UpdateOperation,
) (engine.UpdateInfo, error) {
	contract.Requiref(ref != nil, "ref", "must not be nil")

	// Construct the deployment target.
	target, err := b.getTarget(ctx, secretsProvider, ref,
		op.StackConfiguration.Config, op.StackConfiguration.Decrypter)
	if err != nil {
		return engine.UpdateInfo{}, err
	}

	// Construct and return a new update.
	return engine.UpdateInfo{
		Root:    op.Root,
		Project: op.Proj,
		Target:  target,
	}, nil
}

func (b *diyBackend) getTarget(
	ctx context.Context,
	secretsProvider secrets.Provider,
	ref *diyBackendReference,
	cfg config.Map,
	dec config.Decrypter,
) (*deploy.Target, error) {
	contract.Requiref(ref != nil, "ref", "must not be nil")
	stack, err := b.GetStack(ctx, ref)
	if err != nil {
		return nil, err
	}
	snapshot, err := stack.Snapshot(ctx, secretsProvider)
	if err != nil {
		return nil, err
	}
	// Load stack tags
	tags, err := b.loadStackTags(ctx, ref)
	if err != nil {
		return nil, fmt.Errorf("failed to load stack tags: %w", err)
	}

	return &deploy.Target{
		Name:         ref.Name(),
		Organization: "organization", // diy has no organizations really, but we just always say it's "organization"
		Config:       cfg,
		Decrypter:    dec,
		Snapshot:     snapshot,
		Tags:         tags,
	}, nil
}

var errCheckpointNotFound = errors.New("checkpoint does not exist")

// stackExists simply does a check that the checkpoint file we expect for this stack exists.
func (b *diyBackend) stackExists(
	ctx context.Context,
	ref *diyBackendReference,
) (string, error) {
	contract.Requiref(ref != nil, "ref", "must not be nil")

	chkpath := b.stackPath(ctx, ref)
	exists, err := b.bucket.Exists(ctx, chkpath)
	if err != nil {
		return chkpath, fmt.Errorf("failed to load checkpoint: %w", err)
	}
	if !exists {
		return chkpath, errCheckpointNotFound
	}

	return chkpath, nil
}

func (b *diyBackend) getSnapshot(ctx context.Context,
	secretsProvider secrets.Provider, ref *diyBackendReference,
) (*deploy.Snapshot, error) {
	tracer := otel.Tracer("pulumi-cli")
	ctx, span := cmdutil.StartSpan(ctx, tracer, "diyBackend.getSnapshot")
	defer span.End()

	contract.Requiref(ref != nil, "ref", "must not be nil")

	checkpoint, _, _, err := b.getCheckpoint(ctx, ref)
	if err != nil {
		return nil, fmt.Errorf("failed to load checkpoint: %w", err)
	}

	// Materialize an actual snapshot object.
	snap, err := stack.DeserializeCheckpoint(ctx, secretsProvider, checkpoint)
	if err != nil {
		return nil, err
	}

	// Ensure the snapshot passes verification before returning it, to catch bugs early.
	if !backend.DisableIntegrityChecking {
		if err := snap.VerifyIntegrity(); err != nil {
			if sie, ok := snapshot.AsSnapshotIntegrityError(err); ok {
				var metadata *apitype.SnapshotIntegrityErrorMetadataV1
				if snap.Metadata.IntegrityErrorMetadata != nil {
					metadata = &apitype.SnapshotIntegrityErrorMetadataV1{
						Version: snap.Metadata.IntegrityErrorMetadata.Version,
						Command: snap.Metadata.IntegrityErrorMetadata.Command,
						Error:   snap.Metadata.IntegrityErrorMetadata.Error,
					}
				}
				return nil, fmt.Errorf("snapshot integrity failure; refusing to use it: %w", sie.ForReadWithMetadata(metadata))
			}

			return nil, fmt.Errorf("snapshot integrity failure; refusing to use it: %w", err)
		}
	}

	return snap, nil
}

func (b *diyBackend) getSnapshotStackOutputs(ctx context.Context,
	secretsProvider secrets.Provider, ref *diyBackendReference,
) (property.Map, error) {
	tracer := otel.Tracer("pulumi-cli")
	ctx, span := cmdutil.StartSpan(ctx, tracer, "diyBackend.getSnapshotStackOutputs")
	defer span.End()

	contract.Requiref(ref != nil, "ref", "must not be nil")

	checkpoint, _, _, err := b.getCheckpoint(ctx, ref)
	if err != nil {
		return property.Map{}, fmt.Errorf("failed to load checkpoint: %w", err)
	}
	if checkpoint == nil || checkpoint.Latest == nil {
		return property.Map{}, nil
	}
	outputs, err := stack.DeserializeStackOutputs(ctx, *checkpoint.Latest, secretsProvider)
	if err != nil {
		return property.Map{}, err
	}
	return resource.FromResourcePropertyMap(outputs), nil
}

// getCheckpoint loads a checkpoint file for the given stack in this project, from the current project workspace,
// returning the checkpoint, version, and features.
func (b *diyBackend) getCheckpoint(
	ctx context.Context,
	ref *diyBackendReference,
) (*apitype.CheckpointV3, int, []string, error) {
	chkpath := b.stackPath(ctx, ref)
	byts, err := b.bucket.ReadAll(ctx, chkpath)
	if err != nil {
		return nil, 0, nil, err
	}
	m := encoding.Compress(encoding.JSON, encoding.DetectCompression(byts))

	return stack.UnmarshalVersionedCheckpointToLatestCheckpoint(m, byts)
}

func stripCompressionExt(file string) string {
	if ext := filepath.Ext(file); ext == encoding.GZIPExt || ext == encoding.ZSTDExt {
		return strings.TrimSuffix(file, ext)
	}
	return file
}

type compactJSONMarshaler struct{}

var diyJSONMarshaler encoding.Marshaler = compactJSONMarshaler{}

func (compactJSONMarshaler) Marshal(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimSpace(buf.Bytes()), nil
}

func (compactJSONMarshaler) Unmarshal(data []byte, v any) error {
	return json.Unmarshal(data, v)
}

func marshalVersionedCheckpoint(
	version int,
	features []string,
	checkpoint any,
) (*apitype.VersionedCheckpoint, error) {
	bytes, err := diyJSONMarshaler.Marshal(checkpoint)
	if err != nil {
		return nil, fmt.Errorf("marshalling checkpoint: %w", err)
	}

	return &apitype.VersionedCheckpoint{
		Version:    version,
		Features:   features,
		Checkpoint: json.RawMessage(bytes),
	}, nil
}

func (b *diyBackend) saveCheckpoint(
	ctx context.Context,
	ref *diyBackendReference,
	checkpoint *apitype.VersionedCheckpoint,
) (backupFile string, file string, _ error) {
	// Make a serializable stack and then use the encoder to encode it.
	// stackPath does a bucket listing to find which compression variant exists on disk.
	existingPath := b.stackPath(ctx, ref)
	existingCompression := encoding.CompressionNone
	if ext := filepath.Ext(existingPath); ext == encoding.GZIPExt {
		existingCompression = encoding.CompressionGzip
	} else if ext == encoding.ZSTDExt {
		existingCompression = encoding.CompressionZstd
	}

	baseFile := stripCompressionExt(existingPath)
	m, ext := encoding.Detect(baseFile)
	if m == nil {
		return "", "", fmt.Errorf("resource serialization failed; illegal markup extension: '%v'", ext)
	}
	if filepath.Ext(baseFile) == "" {
		baseFile += ext
	}
	file = baseFile
	compExt := b.compression.Ext()
	if compExt != "" {
		file = file + compExt
	}
	if ext == encoding.JSONExt {
		m = diyJSONMarshaler
	}
	m = encoding.Compress(m, b.compression)

	byts, err := m.Marshal(checkpoint)
	if err != nil {
		return "", "", fmt.Errorf("An IO error occurred while marshalling the checkpoint: %w", err)
	}

	// Back up the existing file if it already exists. Don't delete the original, the following WriteAll will
	// atomically replace it anyway and various other bits of the system depend on being able to find the
	// .json file to know the stack currently exists (see https://github.com/pulumi/pulumi/issues/9033 for
	// context).
	//
	// We only back up the file we're about to write and, if the compression format changed, back up the
	// old format. Keep the old format active until the replacement has been written successfully.
	backupFile = backupTarget(ctx, b.bucket, file, true)
	oldFile := ""
	if existingCompression != b.compression {
		filePlain := stripCompressionExt(file)
		switch existingCompression {
		case encoding.CompressionNone:
			oldFile = filePlain
		case encoding.CompressionGzip:
			oldFile = filePlain + encoding.GZIPExt
		case encoding.CompressionZstd:
			oldFile = filePlain + encoding.ZSTDExt
		}
		if backupFile = backupTarget(ctx, b.bucket, oldFile, true); backupFile == "" 
```

### Core Architecture Module: `pkg/backend/httpstate/backend.go`
```
// Copyright 2016, Pulumi Corporation.
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

package httpstate

import (
	"context"
	cryptorand "crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	opentracing "github.com/opentracing/opentracing-go"
	fxs "github.com/pgavlin/fx/v2/slices"
	"github.com/pkg/browser"

	"github.com/pulumi/pulumi/pkg/v3/backend"
	"github.com/pulumi/pulumi/pkg/v3/backend/backenderr"
	"github.com/pulumi/pulumi/pkg/v3/backend/display"
	"github.com/pulumi/pulumi/pkg/v3/backend/diy"
	"github.com/pulumi/pulumi/pkg/v3/backend/httpstate/client"
	"github.com/pulumi/pulumi/pkg/v3/backend/httpstate/journal"
	backend_secrets "github.com/pulumi/pulumi/pkg/v3/backend/secrets"
	esc_client "github.com/pulumi/pulumi/pkg/v3/cmd/esc/cli/client"
	sdkDisplay "github.com/pulumi/pulumi/pkg/v3/display"
	"github.com/pulumi/pulumi/pkg/v3/engine"
	pkgLogging "github.com/pulumi/pulumi/pkg/v3/logging"
	"github.com/pulumi/pulumi/pkg/v3/operations"
	"github.com/pulumi/pulumi/pkg/v3/registry"
	"github.com/pulumi/pulumi/pkg/v3/resource/deploy"
	"github.com/pulumi/pulumi/pkg/v3/resource/stack/snapshot"
	"github.com/pulumi/pulumi/pkg/v3/secrets"
	"github.com/pulumi/pulumi/pkg/v3/util/nosleep"
	pkgWorkspace "github.com/pulumi/pulumi/pkg/v3/workspace"
	"github.com/pulumi/pulumi/sdk/v3/go/common/apitype"
	"github.com/pulumi/pulumi/sdk/v3/go/common/diag"
	"github.com/pulumi/pulumi/sdk/v3/go/common/diag/colors"
	"github.com/pulumi/pulumi/sdk/v3/go/common/env"
	"github.com/pulumi/pulumi/sdk/v3/go/common/promise"
	"github.com/pulumi/pulumi/sdk/v3/go/common/resource/config"
	"github.com/pulumi/pulumi/sdk/v3/go/common/slice"
	"github.com/pulumi/pulumi/sdk/v3/go/common/tokens"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/agentdetect"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/cmdutil"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/contract"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/logging"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/result"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/retry"
	"github.com/pulumi/pulumi/sdk/v3/go/common/workspace"
	"github.com/pulumi/pulumi/sdk/v3/go/property"

	"go.opentelemetry.io/otel"
	oteltrace "go.opentelemetry.io/otel/trace"
)

var ErrUnauthorized = errors.New("Unauthorized: No credentials provided or are invalid.")

type agentCredentialUseContextKey struct{}

type agentCredentialUse struct {
	sync.Mutex
	cloudURLs map[string]bool
}

// ContextWithAgentCredentialUse returns a context that tracks shared temporary
// agent credential use for one CLI command.
func ContextWithAgentCredentialUse(ctx context.Context) context.Context {
	return context.WithValue(ctx, agentCredentialUseContextKey{}, &agentCredentialUse{
		cloudURLs: map[string]bool{},
	})
}

func agentCredentialUseFromContext(ctx context.Context) *agentCredentialUse {
	use, _ := ctx.Value(agentCredentialUseContextKey{}).(*agentCredentialUse)
	return use
}

type commandNameContextKey struct{}

// ContextWithCommandName returns a context carrying the full invoked CLI command path
// (e.g. "pulumi new"), for use in login/signup analytics.
func ContextWithCommandName(ctx context.Context, name string) context.Context {
	return context.WithValue(ctx, commandNameContextKey{}, name)
}

func commandNameFromContext(ctx context.Context) (string, bool) {
	name, ok := ctx.Value(commandNameContextKey{}).(string)
	return name, ok
}

// MarkAgentCredentialsUsed records that this CLI command selected shared
// temporary agent credentials for the given cloud URL.
func MarkAgentCredentialsUsed(ctx context.Context, cloudURL string) {
	use := agentCredentialUseFromContext(ctx)
	if use == nil {
		return
	}
	use.Lock()
	defer use.Unlock()
	use.cloudURLs[cloudURL] = true
}

// AgentCredentialsUsed reports whether this CLI command selected shared
// temporary agent credentials for the given cloud URL.
func AgentCredentialsUsed(ctx context.Context, cloudURL string) bool {
	use := agentCredentialUseFromContext(ctx)
	if use == nil {
		return false
	}
	use.Lock()
	defer use.Unlock()
	return use.cloudURLs[cloudURL]
}

// Name validation rules enforced by the Pulumi Service.
var stackOwnerRegexp = regexp.MustCompile("^[a-zA-Z0-9][a-zA-Z0-9-_]{1,38}[a-zA-Z0-9]$")

// DefaultURL returns the default cloud URL.  This may be overridden using the PULUMI_API environment
// variable.  If no override is found, and we are authenticated with a cloud, choose that.  Otherwise,
// we will default to the https://api.pulumi.com/ endpoint.
func DefaultURL(ws pkgWorkspace.Context) string {
	return ValueOrDefaultURL(ws, "")
}

// ValueOrDefaultURL returns the value if specified, or the default cloud URL otherwise.
func ValueOrDefaultURL(ws pkgWorkspace.Context, cloudURL string) string {
	// If we have a cloud URL, just return it.
	if cloudURL != "" {
		return strings.TrimSuffix(cloudURL, "/")
	}

	// Otherwise, respect the PULUMI_API override.

	if cloudURL := env.APIURL.Value(); cloudURL != "" {
		return cloudURL
	}

	// If that didn't work, see if we have a current cloud, and use that. Note we need to be careful
	// to ignore the diy cloud.
	if creds, err := ws.GetStoredCredentials(); err == nil {
		if creds.Current != "" && !diy.IsDIYBackendURL(creds.Current) {
			return creds.Current
		}
	}

	// If none of those led to a cloud URL, simply return the default.
	return client.PulumiCloudURL
}

// Backend extends the base backend interface with specific information about cloud backends.
type Backend interface {
	backend.Backend

	CloudURL() string

	StackConsoleURL(stackRef backend.StackReference) (string, error)
	Client() *client.Client

	RunDeployment(ctx context.Context, stackRef backend.StackReference, req apitype.CreateDeploymentRequest,
		opts display.Options, deploymentInitiator string, streamDeploymentLogs bool) error

	// Queries the backend for resources based on the given query parameters.
	Search(
		ctx context.Context, orgName string, queryParams *apitype.PulumiQueryRequest,
	) (*apitype.ResourceSearchResponse, error)
	NaturalLanguageSearch(
		ctx context.Context, orgName string, query string,
	) (*apitype.ResourceSearchResponse, error)
	// Capabilities returns the capabilities of the backend indicating what features are available.
	Capabilities(ctx context.Context) apitype.Capabilities

	// GetLatestStackPreview returns the stack's most recent preview operation, or nil if the
	// stack has no previews. Previews are tracked separately from update history (GetHistory).
	GetLatestStackPreview(ctx context.Context, stackRef backend.StackReference) (*apitype.StackPreview, error)
}

// userInfo holds the user account details fetched from the backend.
type userInfo struct {
	username      string
	organizations []string
	tokenInfo     *workspace.TokenInformation
}

// cachedUpdateData holds deployment and stack metadata fetched from BeginUpdate.
type cachedUpdateData struct {
	deployment *apitype.UntypedDeployment
	stackTags  map[apitype.StackTagName]string
	stackRef   backend.StackReference
}

type cloudBackend struct {
	d            diag.Sink
	url          string
	client       *client.Client
	escClient    esc_client.Client
	capabilities *promise.Promise[apitype.Capabilities]
	userInfo     *promise.Promise[userInfo]
	defaultOrg   *promise.Promise[string]

	// The current project, if any.
	currentProject              *workspace.Project
	neoEnabledForCurrentProject *bool

	// Cached data from BeginUpdate to avoid extra HTTP calls.
	cachedUpdateData *cachedUpdateData
}

// Assert we implement the backend.Backend and backend.SpecificDeploymentExporter interfaces.
var _ backend.SpecificDeploymentExporter = &cloudBackend{}

// New creates a new Pulumi backend for the given cloud API URL and token.
func New(ctx context.Context, d diag.Sink,
	cloudURL string, project *workspace.Project, insecure bool,
) (Backend, error) {
	contract.Requiref(d != nil, "d", "expected a non-nil diag.Sink")
	cloudURL = ValueOrDefaultURL(pkgWorkspace.Instance, cloudURL)
	account, err := getBackendAccount(ctx, cloudURL)
	if err != nil {
		return nil, fmt.Errorf("getting stored credentials: %w", err)
	}
	apiToken := account.AccessToken

	apiClient := client.NewClient(cloudURL, apiToken, insecure, d)
	apiClient.WithRefresh(account.RefreshToken, func(at string, expiresAt time.Time, rt string) error {
		account.SetCredentials(at, expiresAt, rt)
		return account.Save(cloudURL, false)
	})
	escClient := esc_client.New(client.UserAgent(), cloudURL, apiToken, insecure)

	org := env.DefaultOrg.Value()
	if org == "" {
		config, err := workspace.GetPulumiConfig()
		if err != nil && !os.IsNotExist(err) {
			return nil, fmt.Errorf("get Pulumi config: %w", err)
		}
		if beConfig, ok := config.BackendConfig[cloudURL]; ok {
			if beConfig.DefaultOrg != "" {
				org = beConfig.DefaultOrg
			}
		}
	}

	var defaultOrg *promise.Promise[string]
	if org == "" {
		defaultOrg = promise.Run(func() (string, error) {
			resp, err := apiClient.GetDefaultOrg(ctx)
			if err != nil {
				logging.V(1).Infof("failed to get default org: %v", err)
				return "", err
			}
			return resp.GitHubLogin, nil
		})
	} else {
		cts := &promise.CompletionSource[string]{}
		cts.MustFulfill(org)
		defaultOrg = cts.Promise()
	}

	return &cloudBackend{
		d:              d,
		url:            cloudURL,
		client:         apiClient,
		escClient:      escClient,
		capabilities:   detectCapabilities(ct
```

### Core Architecture Module: `pkg/backend/httpstate/client/ai.go`
```
// Copyright 2025, Pulumi Corporation.
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

package client

import (
	"encoding/json"
	"errors"

	"github.com/pulumi/pulumi/sdk/v3/go/common/apitype"
)

// Maximum number of characters to send to Copilot for requests.
// We do this in "chars" to avoid including a proper token counting library for now.
// Tokens are 3-4 characters as a rough estimate.
const (
	// 4kb, we're optimizing for latency here. ~1000 tokens.
	maxCopilotSummarizeUpdateContentLength = 4000
	// 200kb, send a good amount of content to Copilot without incurring a large latency penalty.
	// This will be trimmed on the backend depending on the model used etc.
	maxCopilotExplainPreviewContentLength = 200000
)

// createSummarizeUpdateRequest creates a new CopilotSummarizeUpdateRequest with the given content and org ID
func createSummarizeUpdateRequest(
	content string,
	orgID string,
	model string,
	maxSummaryLen int,
	maxUpdateOutputLen int,
) apitype.CopilotSummarizeUpdateRequest {
	content = TruncateWithMiddleOut(content, maxUpdateOutputLen)

	return apitype.CopilotSummarizeUpdateRequest{
		CopilotRequest: apitype.CopilotRequest{
			State: apitype.CopilotState{
				Client: apitype.CopilotClientState{
					CloudContext: apitype.CopilotCloudContext{
						OrgID: orgID,
						URL:   "https://app.pulumi.com",
					},
				},
			},
		},
		DirectSkillCall: apitype.CopilotSummarizeUpdate{
			Skill: apitype.SkillSummarizeUpdate,
			Params: apitype.CopilotSummarizeUpdateParams{
				PulumiUpdateOutput: content,
				Model:              model,
				MaxLen:             maxSummaryLen,
			},
		},
	}
}

// createExplainPreviewRequest creates a new CopilotExplainPreviewRequest with the given content and org ID
func createExplainPreviewRequest(
	content string,
	orgID string,
	kind string,
	maxUpdateOutputLen int,
) apitype.CopilotExplainPreviewRequest {
	content = TruncateWithMiddleOut(content, maxUpdateOutputLen)

	return apitype.CopilotExplainPreviewRequest{
		CopilotRequest: apitype.CopilotRequest{
			State: apitype.CopilotState{
				Client: apitype.CopilotClientState{
					CloudContext: apitype.CopilotCloudContext{
						OrgID: orgID,
						URL:   "https://app.pulumi.com",
					},
				},
			},
		},
		DirectSkillCall: apitype.CopilotExplainPreviewSkill{
			Skill: apitype.SkillExplainPreview,
			Params: apitype.CopilotExplainPreviewParams{
				PulumiPreviewOutput: content,
				PreviewDetails: apitype.CopilotExplainPreviewDetails{
					Kind: kind,
				},
			},
		},
	}
}

// extractCopilotResponse parses the Copilot API response and extracts the summary content
func extractCopilotResponse(copilotResp apitype.CopilotResponse) (string, error) {
	for _, msg := range copilotResp.ThreadMessages {
		if msg.Role != "assistant" {
			continue
		}

		// Handle the new format where content is a string directly
		if msg.Kind == "response" {
			// Unmarshal the RawMessage into a string
			var contentStr string
			if err := json.Unmarshal(msg.Content, &contentStr); err != nil {
				// If it's not a simple string, it might be a raw JSON object Return it as a string representation
				return string(msg.Content), nil
			}
			return contentStr, nil
		}
	}
	return "", errors.New("no assistant message found in response")
}

const truncationNotice = "... (truncated) ..."

// TruncateWithMiddleOut takes a string and a maximum character count, and returns a new string with content truncated
// from the middle if the total character count exceeds maxChars. This preserves both the beginning and end of the
// content while removing content from the middle.
func TruncateWithMiddleOut(content string, maxChars int) string {
	// If content is shorter than max, return as is
	if len(content) <= maxChars {
		return content
	}

	// If maxChars is too small to even fit truncation notice, just truncate the content directly
	if maxChars <= len(truncationNotice) {
		if maxChars <= 0 {
			return ""
		}
		return content[:maxChars]
	}

	// Calculate how much text we can keep from start and end Subtract truncation notice length and divide remaining
	// space for start/end
	remaining := maxChars - len(truncationNotice)

	startLen := (remaining + 1) / 2
	endLen := remaining / 2

	// Build truncated string with notice in middle
	return content[:startLen] + truncationNotice + content[len(content)-endLen:]
}

```

### Core Architecture Module: `pkg/backend/httpstate/client/api.go`
```
// Copyright 2016, Pulumi Corporation.
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

package client

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/google/go-querystring/query"
	"github.com/opentracing/opentracing-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"

	"github.com/pulumi/pulumi/pkg/v3/backend/backenderr"
	"github.com/pulumi/pulumi/pkg/v3/util/tracing"
	"github.com/pulumi/pulumi/sdk/v3/go/common/apitype"
	"github.com/pulumi/pulumi/sdk/v3/go/common/diag"
	"github.com/pulumi/pulumi/sdk/v3/go/common/tokens"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/cmdutil"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/contract"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/httputil"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/logging"
	"github.com/pulumi/pulumi/sdk/v3/go/common/version"
)

const (
	apiRequestLogLevel       = 10 // log level for logging API requests and responses
	apiRequestDetailLogLevel = 11 // log level for logging extra details about API requests and responses
)

// Pulumi service Accept header version history.
//
// The CLI advertises its API capabilities to the service by setting the
// `Accept: application/vnd.pulumi+N` header on every request. Each increment
// reflects a CLI capability the service can rely on, gating response shape or
// behavior accordingly. Keep this table in sync with the matching version block
// in pulumi-service `cmd/service/api/rest/request.go` — the integers are a
// shared contract across both repos.
//
// To add a new capability: bump `currentAPIVersion` and append a row to the
// table below.
//
// CLI Ver. API Ver. Description
// -------- -------- -----------
//
//	pre-1.0     0    Initial API version.
//	  v15.3     1    New /user/stacks response type.
//	 v16.07     2    CLI sends "rich update events" during an update.
//	v0.16.2     3    /user/stacks returns project name; /stacks routes accept project name.
//	 v1.1.1     4    Policy as Code support.
//	 v1.5.0     5    renew_lease takes the update token instead of the user access token.
//	v1.13.1     6    PAC config support.
//	 v3.3.2     7    CLI sets required headers when uploading policy packs via pre-signed URL.
//	 v3.9.0     8    CLI handles paginated /user/stacks responses.
//	 v3.233     9    SecretValue tolerance: CLI decodes the explicit
//	                 {"isSecret": bool, "value": "..."} object form in addition
//	                 to the legacy heterogeneous form (bare string when not
//	                 secret, {"secret": "..."} when secret). Tolerant decoder
//	                 added in https://github.com/pulumi/pulumi/pull/22699.
const currentAPIVersion = 9

// acceptAPIVersionHeader is the rendered `Accept` header value sent on every
// request to the Pulumi service. See `currentAPIVersion`.
var acceptAPIVersionHeader = fmt.Sprintf("application/vnd.pulumi+%d", currentAPIVersion)

// userAgentCommand and userAgentAIAgent are written once in the cobra root's
// PersistentPreRunE before any HTTP-issuing goroutine is spawned, then read
// from any goroutine making an API request. The single-writer-before-readers
// pattern means no synchronization is needed.
var (
	userAgentCommand string
	userAgentAIAgent string
)

// SetUserAgentCommand sets the running CLI command appended to UserAgent as `cmd=...`.
func SetUserAgentCommand(command string) {
	userAgentCommand = sanitizeUserAgentToken(command)
}

// SetUserAgentAIAgent sets the detected AI agent appended to UserAgent as `agent=...`.
func SetUserAgentAIAgent(agent string) {
	userAgentAIAgent = sanitizeUserAgentToken(agent)
}

func sanitizeUserAgentToken(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	replacer := strings.NewReplacer(
		" ", "-",
		"\t", "-",
		"(", "",
		")", "",
		";", "",
	)
	return replacer.Replace(s)
}

func UserAgent() string {
	var extras strings.Builder
	if userAgentCommand != "" {
		extras.WriteString("; cmd=")
		extras.WriteString(userAgentCommand)
	}
	if userAgentAIAgent != "" {
		extras.WriteString("; agent=")
		extras.WriteString(userAgentAIAgent)
	}
	return fmt.Sprintf("pulumi-cli/1 (%s; %s%s)", version.Version, runtime.GOOS, extras.String())
}

// StackIdentifier is the set of data needed to identify a Pulumi Cloud stack.
type StackIdentifier struct {
	Owner   string
	Project string
	Stack   tokens.StackName
}

func (s StackIdentifier) String() string {
	return fmt.Sprintf("%s/%s/%s", s.Owner, s.Project, s.Stack)
}

// UpdateIdentifier is the set of data needed to identify an update to a Pulumi Cloud stack.
type UpdateIdentifier struct {
	StackIdentifier

	UpdateKind apitype.UpdateKind
	UpdateID   string
}

// accessTokenKind is enumerates the various types of access token used with the Pulumi API. These kinds correspond
// directly to the "method" piece of an HTTP `Authorization` header.
type accessTokenKind string

const (
	// accessTokenKindAPIToken denotes a standard Pulumi API token.
	accessTokenKindAPIToken accessTokenKind = "token"
	// accessTokenKindUpdateToken denotes an update lease token.
	accessTokenKindUpdateToken accessTokenKind = "update-token"
)

// accessToken is an abstraction over the two different kinds of access tokens used by the Pulumi API.
type accessToken interface {
	Kind() accessTokenKind
	Get(ctx context.Context) (string, error)
}

// refreshable is the opt-in interface for access tokens that can renew themselves when the server
// rejects the current value with 401. defaultRESTClient.Call type-asserts on this after a 401 and,
// if the assertion succeeds, calls Refresh once and retries the request before surfacing
// LoginRequiredError. prevAccessToken is the access token the caller sent on the failed request;
// if it no longer matches the wrapper's current token, another caller has already refreshed and
// Refresh returns nil without contacting the server.
type refreshable interface {
	Refresh(ctx context.Context, prevAccessToken string) error
}

type httpCallOptions struct {
	// RetryPolicy defines the policy for retrying requests by httpClient.Do.
	//
	// By default, only GET requests are retried.
	RetryPolicy retryPolicy

	// GzipCompress compresses the request using gzip before sending it.
	GzipCompress bool

	// Header is any additional headers to add to the request.
	Header http.Header

	// ErrorResponse is an optional response body for errors.
	ErrorResponse any

	// SkipDecodeErrors, when true, makes pulumiAPICall skip the 401/429/4xx/5xx
	// typed-error classification.
	// The caller is responsible for inspecting status, reading the body, and
	// closing it. The body read/decode/close is still handled by passing
	// **http.Response to Call's respObj — this only controls error decoding.
	SkipDecodeErrors bool
}

// apiAccessToken is an implementation of accessToken for Pulumi API tokens (i.e. tokens of kind
// accessTokenKindAPIToken)
type apiAccessToken string

func (apiAccessToken) Kind() accessTokenKind {
	return accessTokenKindAPIToken
}

func (t apiAccessToken) Get(_ context.Context) (string, error) {
	return string(t), nil
}

// refreshableAPIAccessToken is an apiAccessToken that can renew itself via the OAuth refresh-token
// grant (RFC 6749 §6) when the current access token expires. defaultRESTClient.Call type-asserts
// on the refreshable interface after a 401 and calls Refresh once before falling through to
// LoginRequiredError.
//
// The refresh and writeback callbacks are decoupled so the type stays free of dependencies on the
// Pulumi service client and credential storage: callers wire the wrapper into client.NewClient by
// closing over Client.RefreshAccessToken and workspace.StoreAccount respectively.
type refreshableAPIAccessToken struct {
	mu sync.Mutex
	// accessToken is the current short-lived bearer; sent on every request.
	accessToken string
	// refreshToken is the long-lived credential exchanged at /api/oauth/token for a fresh
	// access token. Held off the request path and only ever passed to the refresh callback.
	refreshToken string
	// refresh exchanges refreshToken for a new access token. Empty newRefreshToken /
	// zero accessTokenExpiresAt means the server did not supply that field; the
	// wrapper keeps the existing value.
	refresh func(ctx context.Context, refreshToken string) (
		accessToken string, accessTokenExpiresAt time.Time, newRefreshToken string, err error)
	// writeback persists the refreshed credentials. Called with the wrapper's lock held
	// so the in-memory and on-disk views can't diverge under concurrent refreshes.
	writeback func(accessToken string, accessTokenExpiresAt time.Time, refreshToken string) error
}

func (*refreshableAPIAccessToken) Kind() accessTokenKind {
	return accessTokenKindAPIToken
}

func (t *refreshableAPIAccessToken) Get(_ context.Context) (string, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.accessToken, nil
}

func (t *refreshableAPIAccessToken) Refresh(ctx context.Context, prevAccessToken string) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	// If another caller already refreshed while we were queued for the lock, the in-memory
	// access token has advanced past the one we sent — bail without burning another grant.
	if t.accessToken != prevAccessToken {
		return nil
	}
	newAT, expiresAt, newRT, err := t.refresh(ctx, 
```

### Core Architecture Module: `pkg/backend/httpstate/client/api_endpoints.go`
```
// Copyright 2016, Pulumi Corporation.
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

package client

import (
	"net/http"
	"net/url"
	"path"

	"github.com/gorilla/mux"
)

// cleanPath returns the canonical path for p, eliminating . and .. elements.
// Borrowed from gorilla/mux.
func cleanPath(p string) string {
	if p == "" {
		return "/"
	}

	if p[0] != '/' {
		p = "/" + p
	}
	np := path.Clean(p)

	// path.Clean removes trailing slash except for root;
	// put the trailing slash back if necessary.
	if p[len(p)-1] == '/' && np != "/" {
		np += "/"
	}

	return np
}

// getEndpoint gets the friendly name of the endpoint with the given method and path.
func getEndpointName(method, path string) string {
	path = cleanPath(path)

	u, err := url.Parse("http://localhost" + path)
	if err != nil {
		return "unknown"
	}

	req := http.Request{
		Method: method,
		URL:    u,
	}
	var match mux.RouteMatch
	if !routes.Match(&req, &match) {
		return "unknown"
	}

	return "api/" + match.Route.GetName()
}

// routes is the canonical muxer we use to determine friendly names for Pulumi APIs.
var routes *mux.Router

//nolint:lll
func init() {
	routes = mux.NewRouter()

	// addEndpoint registers the endpoint with the indicated method, path, and friendly name with the route table.
	// We use this to provide more user-friendly names for the endpoints for annotating trace logs.
	addEndpoint := func(method, path, name string) {
		routes.Path(path).Methods(method).Name(name)
	}

	addEndpoint("GET", "/api/capabilities", "getCapabilities")

	addEndpoint("GET", "/api/user", "getCurrentUser")
	addEndpoint("GET", "/api/user/stacks", "listUserStacks")
	addEndpoint("GET", "/api/user/organizations/default", "getDefaultOrg")
	addEndpoint("GET", "/api/stacks/{orgName}", "listOrganizationStacks")
	addEndpoint("POST", "/api/stacks/{orgName}", "createStack")
	addEndpoint("DELETE", "/api/stacks/{orgName}/{projectName}/{stackName}", "deleteStack")
	addEndpoint("GET", "/api/stacks/{orgName}/{projectName}/{stackName}", "getStack")
	addEndpoint("GET", "/api/stacks/{orgName}/{projectName}/{stackName}/export", "exportStack")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/import", "importStack")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/encrypt", "encryptValue")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/decrypt", "decryptValue")
	addEndpoint("GET", "/api/stacks/{orgName}/{projectName}/{stackName}/logs", "getStackLogs")
	addEndpoint("GET", "/api/stacks/{orgName}/{projectName}/{stackName}/updates", "getStackUpdates")
	addEndpoint("GET", "/api/stacks/{orgName}/{projectName}/{stackName}/updates/latest", "getLatestStackUpdate")
	addEndpoint("GET", "/api/stacks/{orgName}/{projectName}/{stackName}/updates/{version}", "getStackUpdate")
	addEndpoint("GET", "/api/stacks/{orgName}/{projectName}/{stackName}/updates/{version}/contents/files", "getUpdateContentsFiles")
	addEndpoint("GET", "/api/stacks/{orgName}/{projectName}/{stackName}/updates/{version}/contents/file/{path:.*}", "getUpdateContentsFilePath")
	addEndpoint("GET", "/api/orgs/{orgName}/members", "listOrganizationMembers")
	addEndpoint("GET", "/api/orgs/{orgName}/templates", "listTemplates")
	addEndpoint("GET", "/api/orgs/{orgName}/templates/download", "downloadTemplates")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/batch-decrypt", "batchDecrypt")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/batch-encrypt", "batchEncrypt")
	addEndpoint("HEAD", "/api/stacks/{orgName}/{projectName}", "projectExists")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/rename", "renameStack")
	addEndpoint("PATCH", "/api/stacks/{orgName}/{projectName}/{stackName}/tags", "updateStackTags")
	addEndpoint("PUT", "/api/stacks/{orgName}/{projectName}/{stackName}/config", "updateStackConfig")

	// Deployment settings APIs.
	addEndpoint("PUT", "/api/stacks/{orgName}/{projectName}/{stackName}/deployments/settings", "updateDeploymentSettings")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/deployments/settings/encrypt", "encryptDeploymentSecret")
	addEndpoint("DELETE", "/api/stacks/{orgName}/{projectName}/{stackName}/deployments/settings", "destroyDeploymentSettings")
	addEndpoint("GET", "/api/stacks/{orgName}/{projectName}/{stackName}/deployments", "listStackDeployments")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/deployments/{deploymentId}/cancel", "cancelStackDeployment")

	// The APIs for performing updates of various kind all have the same set of API endpoints. Only
	// differentiate the "create update of kind X" APIs, and introduce a pseudo route param "updateKind".
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/destroy", "createDestroy")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/preview", "createPreview")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/update", "createUpdate")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/begin-update", "beginUpdate")

	addEndpoint("GET", "/api/stacks/{orgName}/{projectName}/{stackName}/{updateKind}/{updateID}", "getUpdateStatus")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/{updateKind}/{updateID}", "startUpdate")
	addEndpoint("PATCH", "/api/stacks/{orgName}/{projectName}/{stackName}/{updateKind}/{updateID}/checkpoint", "patchCheckpoint")
	addEndpoint("PATCH", "/api/stacks/{orgName}/{projectName}/{stackName}/{updateKind}/{updateID}/checkpointdelta", "patchCheckpointDelta")
	addEndpoint("PATCH", "/api/stacks/{orgName}/{projectName}/{stackName}/{updateKind}/{updateID}/checkpointverbatim", "patchCheckpointVerbatim")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/{updateKind}/{updateID}/complete", "completeUpdate")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/{updateKind}/{updateID}/events", "postEngineEvent")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/{updateKind}/{updateID}/events/batch", "postEngineEventBatch")
	addEndpoint("PATCH", "/api/stacks/{orgName}/{projectName}/{stackName}/{updateKind}/{updateID}/journalentries", "patchJournalEntries")
	addEndpoint("POST", "/api/stacks/{orgName}/{projectName}/{stackName}/{updateKind}/{updateID}/renew_lease", "renewLease")

	// GitHub App integration.
	addEndpoint("GET", "/api/console/orgs/{orgName}/integrations/github-app", "getGHAppIntegration")

	// APIs for managing `PolicyPack`s.
	addEndpoint("POST", "/api/orgs/{orgName}/policypacks", "publishPolicyPack")
	addEndpoint("POST", "/api/orgs/{orgName}/policypacks/{policyPackName}/{versionTag}/complete", "completePolicyPackPublish")

	// APIs for usage summaries (Resources Under Management).
	addEndpoint("GET", "/api/orgs/{orgName}/resources/summary", "getUsageSummaryResourceHours")

	// APIs for managing Search capabilities
	addEndpoint("GET", "/api/orgs/{orgName}/search/resources", "getSearchResources")
	addEndpoint("GET", "/api/orgs/{orgName}/search/resources/parse", "getSearchResourcesParse")
	addEndpoint("GET", "/api/orgs/{orgName}/search/resourcesv2", "getOrgResourceSearchV2")

	// APIs for managing Pulumi Insights
	addEndpoint("GET", "/api/preview/insights/{orgName}/accounts", "listInsightsAccounts")
	addEndpoint("GET",
		"/api/preview/insights/{orgName}/accounts/{accountName}/scans/{scanId}/logs",
		"getScanLogs")

	// APIs for interacting with the Package Registry
	addEndpoint("POST", "/api/registry/packages/{source}/{publisher}/{name}/versions", "publishPackage")
	addEndpoint("POST", "/api/registry/packages/{source}/{publisher}/{name}/versions/{version}/complete", "completePackagePublish")
	addEndpoint("DELETE", "/api/registry/packages/{source}/{publisher}/{name}/versions/{version}", "deletePackageVersion")

	// APIs for interacting with the Template Registry
	addEndpoint("POST", "/api/registry/templates/{source}/{publisher}/{name}/versions", "publishTemplate")
	addEndpoint("POST", "/api/registry/templates/{source}/{publisher}/{name}/versions/{version}/complete", "completeTemplatePublish")
}

```

### Core Architecture Module: `pkg/backend/httpstate/client/client.go`
```
// Copyright 2016, Pulumi Corporation.
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

package client

import (
	"archive/tar"
	"bufio"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"iter"
	"maps"
	"math/bits"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/blang/semver"
	"github.com/opentracing/opentracing-go"
	"go.opentelemetry.io/otel"

	"github.com/pulumi/pulumi/pkg/v3/engine"
	"github.com/pulumi/pulumi/pkg/v3/registry"
	"github.com/pulumi/pulumi/pkg/v3/resource/plugin"
	"github.com/pulumi/pulumi/pkg/v3/util/validation"
	"github.com/pulumi/pulumi/sdk/v3/go/common/apitype"
	"github.com/pulumi/pulumi/sdk/v3/go/common/diag"
	"github.com/pulumi/pulumi/sdk/v3/go/common/diag/colors"
	"github.com/pulumi/pulumi/sdk/v3/go/common/env"
	"github.com/pulumi/pulumi/sdk/v3/go/common/resource/config"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/agentdetect"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/cmdutil"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/contract"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/logging"
	"github.com/pulumi/pulumi/sdk/v3/go/common/workspace"
)

const (
	// 20s before we give up on a warm, interactive Neo request.
	NeoRequestTimeout = 20 * time.Second
	// Task creation can trigger a backend cold start (up to ~1 min after a new
	// Neo version is deployed), so allow it a much longer budget than warm requests.
	NeoCreateTaskTimeout = 120 * time.Second
)

// NeoApprovalMode controls whether the agent requires user approval before executing tools.
// Mirrors apitype.NeoApprovalMode in pulumi-service; the wire values must stay in sync.
type NeoApprovalMode string

const (
	// NeoApprovalModeManual requires the agent to request user approval for each tool call.
	NeoApprovalModeManual NeoApprovalMode = "manual"
	// NeoApprovalModeBalanced auto-approves low-risk tool calls and prompts only on
	// destructive operations. The cloud ApprovalHandler decides which calls qualify.
	NeoApprovalModeBalanced NeoApprovalMode = "balanced"
	// NeoApprovalModeAuto allows the agent to execute tools without user approval.
	NeoApprovalModeAuto NeoApprovalMode = "auto"
)

// NeoTaskSource identifies the origin that triggered a Neo task.
type NeoTaskSource string

const (
	// NeoTaskSourceCLI tags tasks created from the Pulumi CLI.
	NeoTaskSourceCLI NeoTaskSource = "cli"
)

// NeoPermissionMode caps the capabilities granted to an agent task. Mirrors
// apitype.NeoPermissionMode in pulumi-service; the wire values must stay in sync.
type NeoPermissionMode string

const (
	// NeoPermissionModeDefault grants the agent the full set of capabilities permitted
	// by the user's role. This is the server's default when the field is omitted.
	NeoPermissionModeDefault NeoPermissionMode = "default"
	// NeoPermissionModeReadOnly restricts the agent to read-only operations: no
	// `pulumi up`, no PR creation, no state mutations.
	NeoPermissionModeReadOnly NeoPermissionMode = "read-only"
)

// NeoTaskRequest represents a request to create a Neo task. This is a thin client-side
// shape that the server deserializes into apitype.CreateAgentTaskRequest, so the JSON
// field names must match the IDL-generated tags exactly.
type NeoTaskRequest struct {
	Message NeoTaskMessage `json:"message"`
	// ToolExecutionMode selects where Neo tool calls run. Empty (the default) and "cloud"
	// mean tools run in the agent container as before; "cli" means the cloud agent emits
	// cli_tool_request backend events for the local-tool subset (filesystem, shell,
	// pulumi_preview, pulumi_up) and waits for cli_tool_result user events in response.
	// JSON tag is camelCase to match apitype.CreateAgentTaskRequest from pulumi-service.
	ToolExecutionMode string `json:"toolExecutionMode,omitempty"`
	// ApprovalMode controls whether the agent requires user approval before executing tools.
	// JSON tag is camelCase to match apitype.CreateAgentTaskRequest from pulumi-service.
	ApprovalMode NeoApprovalMode `json:"approvalMode,omitempty"`
	// PermissionMode caps the agent's capabilities (default vs read-only). Empty means
	// inherit the org / server default. JSON tag is camelCase to match the service IDL.
	PermissionMode NeoPermissionMode `json:"permissionMode,omitempty"`
	// PlanMode, when true, creates the task in plan mode: the agent explores and asks
	// questions but must not write files, run `pulumi up`, or open PRs. The server enforces
	// this by activating PlanModeTracker for the task and gating the exit on an approved
	// exit_plan_mode call. JSON tag is camelCase to match the service IDL.
	PlanMode bool `json:"planMode,omitempty"`
	// Source identifies the origin that triggered the task. The CLI always sends
	// NeoTaskSourceCLI; the server validates against apitype.AgentTaskSource and defaults
	// to "api" if omitted.
	Source NeoTaskSource `json:"source,omitempty"`
	// EnabledIntegrations is a three-state pointer matching apitype.CreateAgentTaskRequest:
	// nil inherits all org-enabled integrations, a non-nil empty slice sends `[]` to opt out
	// of every integration, and a populated slice allow-lists specific ones.
	EnabledIntegrations *[]string `json:"enabledIntegrations,omitempty"`
}

// NeoTaskMessage represents the message content for a Neo task.
type NeoTaskMessage struct {
	Type       string             `json:"type"`
	Content    string             `json:"content"`
	Timestamp  string             `json:"timestamp"`
	EntityDiff *NeoTaskEntityDiff `json:"entity_diff,omitempty"`
}

// AgentSignupChallenge is returned by the unauthenticated agent signup
// challenge endpoint.
type AgentSignupChallenge struct {
	ChallengeID   string `json:"challengeID"`
	ChallengeData string `json:"challengeData"`
}

// AgentSignupResponse is returned after solving an unauthenticated agent signup
// challenge.
type AgentSignupResponse struct {
	AccessToken           string    `json:"accessToken"`
	AccessTokenValidUntil time.Time `json:"accessTokenValidUntil"`
	RefreshToken          string    `json:"refreshToken,omitempty"`
	ClaimToken            string    `json:"claimToken"`
	ClaimTokenValidUntil  time.Time `json:"claimTokenValidUntil"`
}

// agentSignupRequest is sent to the unauthenticated agent signup endpoint with
// the solved challenge and best-effort agent metadata.
type agentSignupRequest struct {
	ChallengeID              string `json:"challengeID,omitempty"`
	ChallengeResult          string `json:"challengeResult,omitempty"`
	AgentName                string `json:"agentName,omitempty"`
	AgentModel               string `json:"agentModel,omitempty"`
	ChallengeSolveDurationMS int64  `json:"challengeSolveDurationMs,omitempty"`
}

// NeoTaskEntityDiff represents entities to add or remove from the agent context.
type NeoTaskEntityDiff struct {
	Add    []NeoTaskEntity `json:"add,omitempty"`
	Remove []NeoTaskEntity `json:"remove,omitempty"`
}

// NeoTaskEntity represents an entity (like a stack) that the agent can work with.
type NeoTaskEntity struct {
	// Type can be "stack", "repository", "pull_request" or "policy_issue"
	Type    string `json:"type"`
	Name    string `json:"name"`
	Project string `json:"project"`
}

// NeoTaskResponse represents the response from creating a Neo task.
type NeoTaskResponse struct {
	TaskID string `json:"taskId"`
}

// NeoTask represents the fields from an existing Neo task that the CLI needs
// when reattaching to it.
type NeoTask struct {
	TaskID         string            `json:"taskId"`
	ApprovalMode   NeoApprovalMode   `json:"approvalMode,omitempty"`
	PermissionMode NeoPermissionMode `json:"permissionMode,omitempty"`
}

// TemplatePublishOperationID uniquely identifies a template publish operation.
type TemplatePublishOperationID string

// StartTemplatePublishRequest is the request body for starting a template publish operation.
type StartTemplatePublishRequest struct {
	// Version is the semantic version of the template.
	Version semver.Version `json:"version"`
}

// StartTemplatePublishResponse is the response from initiating a template publish.
// It returns a presigned URL to upload the template archive.
type StartTemplatePublishResponse struct {
	// OperationID uniquely identifies the publishing operation.
	OperationID TemplatePublishOperationID `json:"operationID"`
	// UploadURLs contains the presigned URLs for uploading template artifacts.
	UploadURLs TemplateUploadURLs `json:"uploadURLs"`
}

// TemplateUploadURLs contains the presigned URLs for uploading template artifacts.
type TemplateUploadURLs struct {
	// Archive is the URL for uploading the template archive.
	Archive string `json:"archive"`
}

// PublishTemplateVersionCompleteRequest is the request body for completing a template publish operation.
type PublishTemplateVersionCompleteRequest struct {
	// OpID is the operation ID from the StartTemplatePublishResponse.
	OpID TemplatePublishOperationID `json:"operationID"`
}

// PublishTemplateVersionCompleteResponse is the response from completing a template publish operation.
type PublishTemplateVersionCompleteResponse struct{}

// Client provides a slim wrapper around the Pulumi HTTP/REST API.
type Client struct {
	apiURL     string
	apiToken   accessToken
	apiUser    string
	apiOrgs    []string
	tokenInfo  *workspace.TokenInformation // might be nil if running against old services
	diag       diag.Sink
	insecure   bool
	restClient restClient

	// If true, do not probe the backend with GET /api/capabilitie
```

### Core Architecture Module: `pkg/backend/httpstate/client/console.go`
```
// Copyright 2016, Pulumi Corporation.
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

package client

import (
	"net/url"
	"os"
	"path"
	"strings"
)

const (
	// ConsoleDomainEnvVar overrides the way we infer the domain we assume the Pulumi Console will
	// be served from, and instead just use this value. e.g. so links to the stack update go to
	// https://pulumi.example.com/org/project/stack/updates/2 instead.
	ConsoleDomainEnvVar = "PULUMI_CONSOLE_DOMAIN"

	// PulumiCloudURL is the Cloud URL used if no environment or explicit cloud is chosen.
	PulumiCloudURL = "https://" + defaultAPIDomainPrefix + "pulumi.com"

	// defaultAPIDomainPrefix is the assumed Cloud URL prefix for typical Pulumi Cloud API endpoints.
	defaultAPIDomainPrefix = "api."
	// defaultConsoleDomainPrefix is the assumed Cloud URL prefix typically used for the Pulumi Console.
	defaultConsoleDomainPrefix = "app."
)

// CloudConsoleURL returns a URL to the Pulumi Cloud Console, rooted at cloudURL. If there is
// an error, returns "".
func CloudConsoleURL(cloudURL string, paths ...string) string {
	u, err := url.Parse(cloudURL)
	if err != nil {
		return ""
	}

	switch {
	case os.Getenv(ConsoleDomainEnvVar) != "":
		// Honor a PULUMI_CONSOLE_DOMAIN environment variable to override the
		// default behavior. Since we identify a backend by a single URI, we
		// cannot know what the Pulumi Console is hosted at...
		u.Host = os.Getenv(ConsoleDomainEnvVar)
	case strings.HasPrefix(u.Host, defaultAPIDomainPrefix):
		// ... but if the cloudURL (API domain) is "api.", then we assume the
		// console is hosted at "app.".
		u.Host = defaultConsoleDomainPrefix + u.Host[len(defaultAPIDomainPrefix):]
	case u.Host == "localhost:8080":
		// ... or when running locally, on port 3000.
		u.Host = "localhost:3000"
	default:
		// We couldn't figure out how to convert the api hostname into a console hostname.
		// We return "" so that the caller can know to omit the URL rather than just
		// return an incorrect one.
		return ""
	}

	u.Path = path.Join(paths...)
	return u.String()
}

// AgentClaimURL returns the Pulumi Console URL for claiming an ephemeral agent
// account, or "" if the console URL cannot be derived from cloudURL.
func AgentClaimURL(cloudURL, claimToken string) string {
	if strings.TrimSpace(claimToken) == "" {
		return ""
	}
	claimURL := CloudConsoleURL(cloudURL, "claim", claimToken)
	if claimURL == "" {
		return ""
	}
	return claimURL
}

```

### Core Architecture Module: `pkg/backend/httpstate/client/doc.go`
```
// Copyright 2016, Pulumi Corporation.
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

// Package client implements a client for the Pulumi Service HTTP/REST API.
// Important note: This client is not versioned, and not intended for external use at this time.
package client

```

### Core Architecture Module: `pkg/backend/httpstate/client/marshal.go`
```
// Copyright 2016, Pulumi Corporation.
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

package client

import (
	"encoding/json"

	"github.com/pulumi/pulumi/sdk/v3/go/common/apitype"
)

func marshalDeployment(d *apitype.DeploymentV3) (json.RawMessage, error) {
	raw, err := json.Marshal(d)
	if err != nil {
		return nil, err
	}
	return json.Marshal(apitype.UntypedDeployment{
		Version:    3,
		Deployment: json.RawMessage(raw),
	})
}

func marshalVerbatimCheckpointRequest(req apitype.PatchUpdateVerbatimCheckpointRequest) (json.RawMessage, error) {
	return json.Marshal(req)
}

```

### Core Architecture Module: `pkg/backend/httpstate/cloud_registry.go`
```
// Copyright 2025, Pulumi Corporation.
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

package httpstate

import (
	ctx "context"
	"errors"
	"io"
	"iter"
	"net/http"

	"github.com/blang/semver"

	"github.com/pulumi/pulumi/pkg/v3/backend"
	"github.com/pulumi/pulumi/pkg/v3/backend/backenderr"
	"github.com/pulumi/pulumi/pkg/v3/backend/httpstate/client"
	"github.com/pulumi/pulumi/pkg/v3/registry"
	"github.com/pulumi/pulumi/sdk/v3/go/common/apitype"
)

type cloudRegistry struct {
	cl *client.Client
}

func newCloudRegistry(cl *client.Client) *cloudRegistry {
	return &cloudRegistry{
		cl: cl,
	}
}

var _ backend.CloudRegistry = (*cloudRegistry)(nil)

func (r *cloudRegistry) PublishPackage(ctx ctx.Context, op apitype.PackagePublishOp) error {
	return r.cl.PublishPackage(ctx, op)
}

func (r *cloudRegistry) ListPackages(
	ctx ctx.Context, name *string,
) iter.Seq2[apitype.PackageMetadata, error] {
	return r.cl.ListPackages(ctx, name)
}

func (r *cloudRegistry) GetPackage(
	ctx ctx.Context, source, publisher, name string, version *semver.Version,
) (apitype.PackageMetadata, error) {
	meta, err := r.cl.GetPackage(ctx, source, publisher, name, version)
	if apiErr, ok := errors.AsType[*apitype.ErrorResponse](err); ok && apiErr.Code == 404 {
		return meta, backenderr.NotFoundError{Err: err}
	}
	return meta, err
}

func (r *cloudRegistry) ListTemplates(
	ctx ctx.Context, opts registry.ListTemplatesOptions,
) iter.Seq2[apitype.ListTemplatesResponse, error] {
	return r.cl.ListTemplates(ctx, opts)
}

func (r *cloudRegistry) GetTemplate(
	ctx ctx.Context, source, publisher, name string, version *semver.Version,
) (apitype.TemplateMetadata, error) {
	meta, err := r.cl.GetTemplate(ctx, source, publisher, name, version)
	if apiErr, ok := errors.AsType[*apitype.ErrorResponse](err); ok && apiErr.Code == http.StatusNotFound {
		return meta, backenderr.NotFoundError{Err: err}
	}
	return meta, err
}

func (r *cloudRegistry) PublishTemplate(ctx ctx.Context, op apitype.TemplatePublishOp) error {
	return r.cl.PublishTemplate(ctx, op)
}

func (r *cloudRegistry) DownloadTemplate(ctx ctx.Context, downloadURL string) (io.ReadCloser, error) {
	return r.cl.DownloadTemplate(ctx, downloadURL)
}

func (r *cloudRegistry) DeletePackageVersion(
	ctx ctx.Context, source, publisher, name string, version semver.Version,
) error {
	err := r.cl.DeletePackageVersion(ctx, source, publisher, name, version)
	if apiErr, ok := errors.AsType[*apitype.ErrorResponse](err); ok && apiErr.Code == http.StatusNotFound {
		return backenderr.NotFoundError{Err: err}
	}
	return err
}

```

### Core Architecture Module: `pkg/backend/httpstate/diffs.go`
```
// Copyright 2016, Pulumi Corporation.
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

package httpstate

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"github.com/hexops/gotextdiff"
	"github.com/hexops/gotextdiff/span"
	opentracing "github.com/opentracing/opentracing-go"
	"github.com/pgavlin/diff/lcs"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"

	"github.com/pulumi/pulumi/sdk/v3/go/common/apitype"
	"github.com/pulumi/pulumi/sdk/v3/go/common/promise"
	"github.com/pulumi/pulumi/sdk/v3/go/common/slice"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/cmdutil"
	segmentio_json "github.com/segmentio/encoding/json"
)

type deploymentDiffState struct {
	lastSavedDeployment deployment
	sequenceNumber      int
	minimalDiffSize     int
	buffer              *bytes.Buffer
}

type deploymentDiff struct {
	sequenceNumber  int
	checkpointHash  string
	deploymentDelta json.RawMessage
}

func newDeploymentDiffState(minimalDiffSize int) *deploymentDiffState {
	return &deploymentDiffState{
		sequenceNumber:  1,
		minimalDiffSize: minimalDiffSize,
	}
}

func (dds *deploymentDiffState) SequenceNumber() int {
	return dds.sequenceNumber
}

func (dds *deploymentDiffState) CanDiff() bool {
	return dds.lastSavedDeployment.raw != nil
}

// Size-based heuristics trying to estimate if the diff method will be
// worth it and take less time than sending the entire deployment.
func (dds *deploymentDiffState) ShouldDiff(new deployment) bool {
	if !dds.CanDiff() {
		return false
	}
	if len(dds.lastSavedDeployment.raw) < dds.minimalDiffSize {
		return false
	}
	if len(new.raw) < dds.minimalDiffSize {
		return false
	}
	return true
}

func (dds *deploymentDiffState) Diff(ctx context.Context, deployment deployment) (deploymentDiff, error) {
	if !dds.CanDiff() {
		return deploymentDiff{}, errors.New("Diff() cannot be called before Saved()")
	}

	tracingSpan, childCtx := opentracing.StartSpanFromContext(ctx, "Diff")
	defer tracingSpan.Finish()

	tracer := otel.Tracer("pulumi-cli")
	childCtx, otelSpan := cmdutil.StartSpan(childCtx, tracer, "Diff")
	defer otelSpan.End()

	before := dds.lastSavedDeployment.raw
	after := deployment.raw

	checkpointHashPromise := promise.Run(func() (string, error) {
		return dds.computeHash(childCtx, after), nil
	})

	delta, err := dds.computeEdits(childCtx, dds.lastSavedDeployment, deployment)
	if err != nil {
		return deploymentDiff{}, fmt.Errorf("Cannot marshal the edits: %w", err)
	}

	checkpointHash, err := checkpointHashPromise.Result(ctx)
	if err != nil {
		return deploymentDiff{}, fmt.Errorf("Cannot compute the checkpoint hash: %w", err)
	}

	tracingSpan.SetTag("before", len(before))
	tracingSpan.SetTag("after", len(after))
	tracingSpan.SetTag("diff", len(delta))
	tracingSpan.SetTag("compression", 100.0*float64(len(delta))/float64(len(after)))
	tracingSpan.SetTag("hash", checkpointHash)

	otelSpan.SetAttributes(
		attribute.Int("before", len(before)),
		attribute.Int("after", len(after)),
		attribute.Int("diff", len(delta)),
		attribute.Float64("compression", 100.0*float64(len(delta))/float64(len(after))),
		attribute.String("hash", checkpointHash),
	)

	diff := deploymentDiff{
		checkpointHash:  checkpointHash,
		deploymentDelta: delta,
		sequenceNumber:  dds.sequenceNumber,
	}

	return diff, nil
}

// Indicates that a deployment was just saved to the service.
func (dds *deploymentDiffState) Saved(ctx context.Context, deployment deployment) error {
	if dds.lastSavedDeployment.buf != nil {
		dds.buffer = dds.lastSavedDeployment.buf
		dds.buffer.Reset()
	}
	dds.lastSavedDeployment = deployment
	dds.sequenceNumber++

	return nil
}

func (*deploymentDiffState) computeHash(ctx context.Context, deployment json.RawMessage) string {
	tracingSpan, _ := opentracing.StartSpanFromContext(ctx, "computeHash")
	defer tracingSpan.Finish()

	tracer := otel.Tracer("pulumi-cli")
	_, otelSpan := cmdutil.StartSpan(ctx, tracer, "computeHash")
	defer otelSpan.End()

	hash := sha256.Sum256(deployment)
	return hex.EncodeToString(hash[:])
}

type deployment struct {
	raw   json.RawMessage
	buf   *bytes.Buffer
	spans spans
}

type spanner struct {
	*bytes.Buffer

	start int
	spans spans
}

type spans struct {
	offsets []int
	spans   [][]byte
}

func newSpans(capacity int) spans {
	return spans{
		offsets: slice.Prealloc[int](capacity),
		spans:   slice.Prealloc[[]byte](capacity),
	}
}

func (s *spans) append(offset int, span []byte) {
	s.offsets = append(s.offsets, offset)
	s.spans = append(s.spans, span)
}

func (s *spans) eof(offset int) {
	s.offsets = append(s.offsets, offset)
}

func newSpanner(b *bytes.Buffer, capacity int) *spanner {
	return &spanner{Buffer: b, spans: newSpans(capacity)}
}

func (s *spanner) nextSpan() {
	span := s.Bytes()[s.start:]
	s.spans.append(s.start, span)
	s.start = s.Len()
}

func (s *spanner) finish() ([]byte, spans) {
	s.nextSpan()
	s.spans.eof(s.start)
	return s.Bytes(), s.spans
}

func marshalSpannedDeployment(b *bytes.Buffer, d *apitype.DeploymentV3, version int, features []string) (spans, error) {
	// one span for {"version":...,"features":...,"deployment":
	//     {"manifest":...,"secrets_providers":...,"metadata":...,"resources":[
	// len(resources) spans for resources,
	// one span for ],"pendingOperations":[
	// len(operations) spans for operations
	// one span for ]}}
	spanner := newSpanner(b, len(d.Resources)+len(d.PendingOperations)+3)
	encoder := segmentio_json.NewEncoder(spanner)
	encoder.SetAppendNewline(false)

	spanner.WriteString(`{"version":`)
	spanner.WriteString(strconv.Itoa(version))
	if len(features) > 0 {
		spanner.WriteString(`,"features":`)
		if err := encoder.Encode(features); err != nil {
			return spans{}, err
		}
	}
	spanner.WriteString(`,"deployment":{"manifest":`)
	if err := encoder.Encode(d.Manifest); err != nil {
		return spans{}, err
	}
	if d.SecretsProviders != nil {
		spanner.WriteString(`,"secrets_providers":`)
		if err := encoder.Encode(d.SecretsProviders); err != nil {
			return spans{}, err
		}
	}
	spanner.WriteString(`,"metadata":`)
	if err := encoder.Encode(d.Metadata); err != nil {
		return spans{}, err
	}

	if len(d.Resources) > 0 {
		spanner.WriteString(`,"resources":[`)
		for i, r := range d.Resources {
			if i > 0 {
				spanner.WriteByte(',')
			}
			spanner.nextSpan()
			if err := encoder.Encode(r); err != nil {
				return spans{}, err
			}
		}
		spanner.nextSpan()
		spanner.WriteByte(']')
	}

	if len(d.PendingOperations) > 9 {
		spanner.WriteString(`,"pendingOperations":[`)
		for i, o := range d.PendingOperations {
			if i > 0 {
				spanner.WriteByte(',')
			}
			spanner.nextSpan()
			if err := encoder.Encode(o); err != nil {
				return spans{}, err
			}
		}
		spanner.nextSpan()
		spanner.WriteByte(']')
	}
	spanner.WriteString("}}")
	_, spans := spanner.finish()
	return spans, nil
}

func (dds *deploymentDiffState) MarshalDeployment(
	d *apitype.DeploymentV3,
	version int,
	features []string,
) (deployment, error) {
	var b *bytes.Buffer
	if dds.buffer != nil {
		b, dds.buffer = dds.buffer, nil
	} else {
		b = &bytes.Buffer{}
	}
	spans, err := marshalSpannedDeployment(b, d, version, features)
	if err != nil {
		return deployment{}, err
	}
	return deployment{raw: json.RawMessage(b.Bytes()), buf: b, spans: spans}, nil
}

func (*deploymentDiffState) computeEdits(ctx context.Context, before, after deployment) (json.RawMessage, error) {
	tracingSpan, _ := opentracing.StartSpanFromContext(ctx, "computeEdits")
	defer tracingSpan.Finish()

	tracer := otel.Tracer("pulumi-cli")
	_, otelSpan := cmdutil.StartSpan(ctx, tracer, "computeEdits")
	defer otelSpan.End()

	diffs := lcs.DiffLines(before.spans.spans, after.spans.spans)

	edits := make([]gotextdiff.TextEdit, len(diffs))
	for i, di := range diffs {
		start, end := before.spans.offsets[di.Start], before.spans.offsets[di.End]
		replStart, replEnd := after.spans.offsets[di.ReplStart], after.spans.offsets[di.ReplEnd]
		edits[i] = gotextdiff.TextEdit{
			Span:    span.New("", span.NewPoint(1, 0, start), span.NewPoint(1, 0, end)),
			NewText: string(after.raw[replStart:replEnd]),
		}
	}

	delta, err := json.Marshal(edits)
	if err != nil {
		return nil, fmt.Errorf("Cannot marshal the edits: %w", err)
	}

	return delta, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #25031** (2026-10-05): **`pulumi new` reports a provider as "exited prematurely" when the credentials check times out**
  *Symptoms*: `pulumi new aws-typescript` (CLI v3.267.0), run in an interactive terminal without valid AWS credentials, can end with:  ``` warning: The AWS provider reported problems with this stack's configuration:     No valid credential sources found. ... error: Detected that .../resource-docker-build-v0.0.14/pulumi-resource-docker-build exited prematurely.        This is *always* a bug in the provider. ... ```  The warning is correct. The error is a false alarm: the provider did not crash. It appears intermittently, and the provider it names varies between runs (aws, awsx, docker, docker-build).  Expected: no "exited prematurely" error when no provider has crashed.  _Written by Claude._ 
  **Post-Mortem & Fix Analysis**:
  > Duplicate of https://github.com/pulumi/pulumi/issues/24934
  > Actually, I think I was a bit quick to call this a duplicate.  It's similar, but slightly different I think after looking at it slightly longer.
  > Yeah, not quite the same issue but related

- **Issue #25022** (2026-10-05): **Workflow failure: Run full language matrix of tests daily**
  *Symptoms*: ## Workflow Failure  [Run full language matrix of tests daily](https://github.com/pulumi/pulumi/blob/master/.github/workflows/cron-test-all.yml) has failed. See the list of failures below:  - [2026-10-05T06:51:43.000Z](https://github.com/pulumi/pulumi/actions/runs/37269298320)

- **Issue #25012** (2026-10-02): **Workflow failure: On Push at dev-release / build-release (windows, amd64, ubuntu-latest) / windows-amd64 (+5 more)**
  *Symptoms*: ## Workflow Failure  [On Push](https://github.com/pulumi/pulumi/blob/master/.github/workflows/on-push.yml) has failed. See the list of failures below:  - [2026-10-02T13:58:51.000Z](https://github.com/pulumi/pulumi/actions/runs/37015346188)   - ❌ [dev-release / build-release (windows, amd64, ubuntu-latest) / windows-amd64](https://github.com/pulumi/pulumi/actions/runs/37015346188/job/110867462830): Package (failure)   - ❌ [dev-release / build-release (windows, arm64, ubuntu-latest) / windows-arm64](https://github.com/pulumi/pulumi/actions/runs/37015346188/job/110867462923): Package (cancelled)   - ❌ [dev-release / build-release (linux, amd64, ubuntu-latest) / linux-amd64](https://github.com/pulumi/pulumi/actions/runs/37015346188/job/110867462961): Package (cancelled)   - ❌ [dev-release / build-release (darwin, amd64, ubuntu-latest) / darwin-amd64](https://github.com/pulumi/pulumi/actions/runs/37015346188/job/110867463005): Package (cancelled)   - ❌ [dev-release / build-release (linux, arm64, ubuntu-latest) / linux-arm64](https://github.com/pulumi/pulumi/actions/runs/37015346188/job/110867463006): Package (cancelled)   - ❌ [dev-release / build-release (darwin, arm64, ubuntu-latest) / darwin-arm64](https://github.com/pulumi/pulumi/actions/runs/37015346188/job/110867463035): Package (cancelled)
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically closed because the workflow succeeded.  Successful run: [2026-10-02T14:28:45.000Z](https://github.com/pulumi/pulumi/actions/runs/37018753328)

- **Issue #24987** (2026-10-04): **Workflow failure: Run full language matrix of tests daily**
  *Symptoms*: ## Workflow Failure  [Run full language matrix of tests daily](<https://github.com/pulumi/pulumi/blob/master/.github/workflows/cron-test-all.yml>) has failed. See the list of failures below:  * [2026-10-02T06:13:56.000Z](<https://github.com/pulumi/pulumi/actions/runs/36969554516>)   * ❌ [Performance Gate / Performance Test / performance tests on ubuntu-latest/all-3](<https://github.com/pulumi/pulumi/actions/runs/36969554516/job/110721003820>): run tests "./scripts/retry make test_performance" (failure)   * [2026-10-03T06:47:57.000Z](<https://github.com/pulumi/pulumi/actions/runs/37100576931>)
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically closed because the workflow succeeded.  Successful run: [2026-10-04T08:09:40.000Z](https://github.com/pulumi/pulumi/actions/runs/37185529486)

- **Issue #24949** (2026-09-30): **Python policy pack with `toolchain: uv` and a `[build-system]` table fails to install: `No module named pip`**
  *Symptoms*: > [!NOTE] > This issue was authored by an AI agent on @iwahbe's behalf.  ## What happened?  A Python policy pack sets `toolchain: uv` in `PulumiPolicy.yaml`. Its `pyproject.toml` has a `[build-system]` table. `pulumi install` in the policy pack directory fails with `No module named pip`.  The install is expected to succeed. uv is the selected toolchain, and a virtual environment that uv creates does not contain pip.  If the `[build-system]` table is removed, the install succeeds. The same policy pack installs correctly with v3.208.0 and fails with v3.209.0 and later.  ## Example  `PulumiPolicy.yaml`:  ```yaml description: An example policy pack. runtime:   name: python   options:     toolchain: uv     virtualenv: .venv ```  `pyproject.toml`:  ```toml [project] name = "example-policy" version = "0.1.0" description = "An example policy pack." requires-python = ">=3.11" dependencies = [    "pulumi>=3.162.0",    "pulumi-policy>=1.0.0", ]  [build-system] requires = ["hatchling"] build-backend = "hatchling.build"  [tool.hatch.build.targets.wheel] only-include = ["__main__.py"] ```  `__main__.py` contains a `PolicyPack` with one policy that accepts every resource.  ```console $ pulumi install Installing dependencies...  .../example-policy/.venv/bin/python: No module named pip error: installing dependencies failed: installing package: exit status 1 installing package: exit status 1 installing package: exit status 1 ```  **Expected:** `pulumi install` installs the policy pack with uv 

- **Issue #24947** (2026-09-30): **Workflow failure: Pull Request on #24946**
  *Symptoms*: ## Workflow Failure  Triggered by PR: https://github.com/pulumi/pulumi/pull/24946  [Pull Request](https://github.com/pulumi/pulumi/blob/master/.github/workflows/on-pr.yml) has failed. See the list of failures below:  - [2026-09-30T12:20:24.000Z](https://github.com/pulumi/pulumi/actions/runs/36709735909)
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically closed because the workflow succeeded.  Successful run: [2026-09-30T12:35:18.000Z](https://github.com/pulumi/pulumi/actions/runs/36709735909)

- **Issue #24927** (2026-10-05): **nodejs `GetDocLinkForPulumiType` links to anchors TypeDoc doesn't generate**
  *Symptoms*: `/docs/reference/pkg/nodejs/pulumi/pulumi/#<Type>` lands on the index with no matching anchor. TypeDoc puts each type on its own page:  - `#CustomResourceOptions` → `interfaces/CustomResourceOptions.html` (same for `ComponentResourceOptions`, `InvokeOptions`, `InvokeOutputOptions`) - `#ID` → `types/ID.html`  `pkg/codegen/nodejs/doc_test.go` asserts the broken output. The only caller is `pulumi/registry`, which works around this in pulumi/registry#12702. See pulumi/registry#12168. 

- **Issue #24923** (2026-09-28): **TestConcurrentUpdateError is flaky**
  *Symptoms*: **TestConcurrentUpdateError** has been detected as a flaky test.  - **Package:** `` - **Category:** test_flake - **Occurrences:** 77570 - **First seen:** 2026-08-24 - **Last seen:** 2026-09-27  **CI Run:** https://github.com/pulumi/pulumi/actions/runs/36357386190  **Test output:** ``` DEVELOCITY_INJECTION_CUSTOM_VALUE: gradle-actions GITHUB_DEPENDENCY_GRAPH_ENABLED: false PULUMI_GO_DEP_ROOT: /d/a/pulumi AZURE_TENANT_ID: *** AZURE_CLIENT_ID: *** AZURE_CLIENT_SECRET: *** AZURE_STORAGE_SAS_TOKEN: *** PULUMI_NODE_MODULES: D:\a\_temp/opt/pulumi/node_modules PULUMI_ROOT: D:\a\_temp/opt/pulumi GITHUB_TOKEN: *** GOOGLE_APPLICATION_CREDENTIALS: D:\a\_temp/application_default_credentials.json AWS_ACCESS_KEY: *** AWS_SECRET_ACCESS_KEY: *** ##[endgroup] COMMAND     =  make gotestsum/sdk cd sdk && python 'D:/a/pulumi/pulumi/scripts/go-test.py' -tags="all" -timeout 1h -parallel=4 -p=1 -count=1 -shuffle=off -cover -race=false  $***OPTS*** $***PKGS*** go: downloading github.com/stretchr/testify v1.11.1 go: downloading github.com/blang/semver v3.5.1+incompatible go: downloading github.com/git-pkgs/manifests v0.4.1 go: downloading gopkg.in/yaml.v3 v3.0.1 go: downloading github.com/go-git/go-git/v6 v6.0.0-alpha.4 go: downloading github.com/iwdgo/sigintwindows v0.2.2 go: downloading google.golang.org/grpc v1.83.2 go: downloading google.golang.org/protobuf v1.36.11 go: downloading github.com/klauspost/compress v1.18.7 go: downloading github.com/grpc-ecosystem/grpc-opentracing v0.0.0-2018050721335

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

### Incident Patch 1: `ffd1519c` (2026-10-05)
**Commit Message**: Remove the timeout from the `pulumi new` credentials check (#25030)

The credentials check that interactive `pulumi new` runs put a 15s
deadline on the plugin context it launches providers with. When the
deadline passed while a provider was still starting, the provider was
killed and reported as "exited prematurely … always a bug in the
provider", although it did not crash.

Remove the deadline. No other command puts a deadline on launching
providers. The check now takes as long as the providers take, and can
still be interrupted or skipped with
`PULUMI_SKIP_NEW_CREDENTIALS_CHECK`.

Related to #24917 / #25026, but not the same problem: there the false
report comes from providers that are slow to shut down.

Fixes #25031

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `changelog/pending/cli-new-fix-20261005-144812.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: cli/new
+kind: fix
+body: Fix spurious provider "exited prematurely" error from the `pulumi new` credentials check, which no longer has a timeout
+time: 2026-10-05T14:48:12+03:00
```

**File**: `pkg/cmd/pulumi/project/newcmd/credentials.go` (modified, +5/-16)
```diff
@@ -21,7 +21,6 @@ import (
 	"io"
 	"log/slog"
 	"strings"
-	"time"
 
 	"github.com/pulumi/pulumi/pkg/v3/backend"
 	"github.com/pulumi/pulumi/pkg/v3/backend/display"
@@ -41,11 +40,6 @@ import (
 	"github.com/pulumi/pulumi/sdk/v3/go/property"
 )
 
-// The credentials preflight may probe cloud metadata services or STS-like endpoints; timeouts on
-// hosts without instance metadata are the slow path, so give the check a generous but bounded budget.
-// The budget covers plugin launch, GetSchema, CheckConfig and Configure for every opted-in package.
-const defaultCredentialsPreflightTimeout = 15 * time.Second
-
 // cloudProvider describes a provider package that opted into the `pulumi new` credentials
 // preflight through its schema.
 type cloudProvider struct {
@@ -114,13 +108,8 @@ func preflightCloudCredentials(
 		return
 	}
 
-	// Providers send their RPCs on the plugin context's base context rather than the
-	// context passed to each call, so the plugin context runNew already has cannot carry a
-	// deadline for this check. Create a second context on the same host instead, so that
-	// plugin launch, GetSchema, CheckConfig and Configure all share one deadline.
-	tctx, cancel := context.WithTimeout(ctx, defaultCredentialsPreflightTimeout)
-	defer cancel()
-	pctx, err := plugin.NewContextWithHost(tctx, sink, sink, host, root, root, nil)
+	// The check has its own plugin context so that the providers it launches are released when it is done.
+	pctx, err := plugin.NewContextWithHost(ctx, sink, sink, host, root, root, nil)
 	if err != nil {
 		slog.DebugContext(ctx, "skipping credentials check", "err", err)
 		return
@@ -132,10 +121,10 @@ func preflightCloudCredentials(
 		if pkg.Kind != apitype.ResourcePlugin || pkg.ExtensionParameterization != nil {
 			continue
 		}
-		if tctx.Err() != nil {
+		if ctx.Err() != nil {
 			return
 		}
-		pf.checkPackage(tctx, pkg)
+		pf.checkPackage(ctx, pkg)
 	}
 }
 
@@ -205,7 +194,7 @@ func cloudProviderFromSchema(
 
 // probeCredentials calls the cloud provider's CheckConfig and then Configure, which is
 // where providers validate credentials and initialise their clients. It returns nil when
-// both succeed, and also when ctx expires, in which case the check stays silent.
+// both succeed, and also when ctx is cancelled, in which case the check stays silent.
 func probeCredentials(
 	ctx context.Context, cp cloudProvider, prov plugin.Provider, news property.Map,
 ) *credentialsProblem {
```

---

### Incident Patch 2: `f9f5b730` (2026-10-05)
**Commit Message**: Update vulnerable dependencies [SECURITY] (#24281)

> ℹ️ **Note**
> 
> This PR body was truncated due to platform limits.

This PR contains the following updates:

| Package | Change |
[Age](https://docs.renovatebot.com/merge-confidence/) |
[Confidence](https://docs.renovatebot.com/merge-confidence/) |
|---|---|---|---|
| [@grpc/grpc-js](https://grpc.io/)
([source](https://redirect.github.com/grpc/grpc-node)) | [`1.14.4` →
`1.14.5`](https://renovatebot.com/diffs/npm/@grpc%2fgrpc-js/1.14.4/1.14.5)
|
![age](https://developer.mend.io/api/mc/badges/age/npm/@grpc%2fgrpc-js/1.14.5?slim=true)
|
![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@grpc%2fgrpc-js/1.14.4/1.14.5?slim=true)
|
|
[go.opentelemetry.io/otel/exporters/otlp/otlptrace](https://redirect.github.com/open-telemetry/opentelemetry-go)
| `v1.43.0` → `v1.45.0` |
![age](https://developer.mend.io/api/mc/badges/age/go/go.opentelemetry.io%2fotel%2fexporters%2fotlp%2fotlptrace/v1.45.0?slim=true)
|
![confidence](https://developer.mend.io/api/mc/badges/confidence/go/go.opentelemetry.io%2fotel%2fexporters%2fotlp%2fotlptrace/v1.43.0/v1.45.0?slim=true)
|
|
[go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegr

**File**: `sdk/go/auto/test/install/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-urllib3 ==2.7.0
+urllib3 ==2.8.0
```

**File**: `sdk/go/auto/testdata/slow/go.mod` (modified, +11/-11)
```diff
@@ -34,7 +34,7 @@ require (
 	github.com/go-git/gcfg v1.5.1-0.20230307220236-3a3c6141e376 // indirect
 	github.com/go-git/go-billy/v5 v5.9.0 // indirect
 	github.com/go-git/go-git/v5 v5.19.2 // indirect
-	github.com/go-logr/logr v1.4.3 // indirect
+	github.com/go-logr/logr v1.4.4 // indirect
 	github.com/go-logr/stdr v1.2.2 // indirect
 	github.com/gogo/protobuf v1.3.2 // indirect
 	github.com/golang/glog v1.2.5 // indirect
@@ -88,13 +88,13 @@ require (
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.opentelemetry.io/collector/featuregate v1.58.0 // indirect
 	go.opentelemetry.io/collector/pdata v1.58.0 // indirect
-	go.opentelemetry.io/otel v1.44.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.43.0 // indirect
-	go.opentelemetry.io/otel/metric v1.44.0 // indirect
-	go.opentelemetry.io/otel/sdk v1.44.0 // indirect
-	go.opentelemetry.io/otel/trace v1.44.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
+	go.opentelemetry.io/otel v1.45.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0 // indirect
+	go.opentelemetry.io/otel/metric v1.45.0 // indirect
+	go.opentelemetry.io/otel/sdk v1.45.0 // indirect
+	go.opentelemetry.io/otel/trace v1.45.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	go.uber.org/atomic v1.11.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	golang.org/x/crypto v0.56.0 // indirect
@@ -106,9 +106,9 @@ require (
 	golang.org/x/term v0.45.0 // indirect
 	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/tools v0.49.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
-	google.golang.org/grpc v1.83.1 // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d // indirect
+	google.golang.org/grpc v1.83.2 // indirect
 	google.golang.org/protobuf v1.36.11 // indirect
 	gopkg.in/warnings.v0 v0.1.2 // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
```

**File**: `sdk/go/auto/testdata/slow/go.sum` (modified, +24/-24)
```diff
@@ -77,8 +77,8 @@ github.com/go-git/go-git-fixtures/v4 v4.3.2-0.20231010084843-55a94097c399/go.mod
 github.com/go-git/go-git/v5 v5.19.2 h1:wkfn7vOlUBu8ivAWKBWisTiwJK4jYHzTF8Ndv1LyGqY=
 github.com/go-git/go-git/v5 v5.19.2/go.mod h1:QqCBE1EFN5ddFmrliLQ3/ntRCUjZU3EJuwuB/jWEHjk=
 github.com/go-logr/logr v1.2.2/go.mod h1:jdQByPbusPIv2/zmleS9BjJVeZ6kBagPoEUsqbVz/1A=
-github.com/go-logr/logr v1.4.3 h1:CjnDlHq8ikf6E492q6eKboGOC0T8CDaOvkHCIg8idEI=
-github.com/go-logr/logr v1.4.3/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
+github.com/go-logr/logr v1.4.4 h1:tG4xh9yMsRCAiodLVTxyrkzSZ9+o0L1Kg/+cPVcbP/8=
+github.com/go-logr/logr v1.4.4/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
 github.com/go-logr/stdr v1.2.2 h1:hSWxHoqTgW2S2qGc0LTAI563KZ5YKYRhT3MFKZMbjag=
 github.com/go-logr/stdr v1.2.2/go.mod h1:mMo/vtBO5dYbehREoey6XUKy/eSumjCCveDpRre4VKE=
 github.com/gogo/protobuf v1.3.1/go.mod h1:SlYgWuQ5SjCEi6WLHjHCa1yvBfUnHcTbrrZtXPKa29o=
@@ -232,22 +232,22 @@ go.opentelemetry.io/collector/internal/testutil v0.152.0 h1:8LGwekR7mLcUDhT1ofLm
 go.opentelemetry.io/collector/internal/testutil v0.152.0/go.mod h1:Jkjs6rkqs973LqgZ0Fe3zrokQRKULYXPIf4HuqStiEE=
 go.opentelemetry.io/collector/pdata v1.58.0 h1:5Lxut3NxKp87066Pzt+3q7+JUuFI5B3teCyLZIF8wIs=
 go.opentelemetry.io/collector/pdata v1.58.0/go.mod h1:4vZtODINbC/JF3eGocnatdImzbRHseOywIcr+aULjCg=
-go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
-go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0 h1:88Y4s2C8oTui1LGM6bTWkw0ICGcOLCAI5l6zsD1j20k=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0/go.mod h1:Vl1/iaggsuRlrHf/hfPJPvVag77kKyvrLeD10kpMl+A=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.43.0 h1:RAE+JPfvEmvy+0LzyUA25/SGawPwIUbZ6u0Wug54sLc=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.43.0/go.mod h1:AGmbycVGEsRx9mXMZ75CsOyhSP6MFIcj/6dnG+vhVjk=
-go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
-go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
-go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
-go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
-go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
-go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
-go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
-go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
-go.opentelemetry.io/proto/otlp v1.10.0 h1:IQRWgT5srOCYfiWnpqUYz9CVmbO8bFmKcwYxpuCSL2g=
-go.opentelemetry.io/proto/otlp v1.10.0/go.mod h1:/CV4QoCR/S9yaPj8utp3lvQPoqMtxXdzn7ozvvozVqk=
+go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
+go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0 h1:fG5MCxGz8+2VtrN/WgqSpJFctVz24gpxj8CxkKmc8Ww=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0/go.mod h1:BmAYTn+3ysbRe+IU2msxmf5Rx3g6DHvex+tWI3LdhYI=
+go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
+go.opentelemetry.io/otel/metric v1.45.0/go.mod h1:HAPbm1nd3p1PmFH7v2dR+6BjXxw+Lq4a2+pndMAm08s=
+go.opentelemetry.io/otel/sdk v1.45.0 h1:4VVSMgQ83dUgW2aoX5f6JgLvHwIvzcuLnF9lUdCSpCw=
+go.opentelemetry.io/otel/sdk v1.45.0/go.mod h1:Sr40LgXV7DsKMMJMKOhUWOgMWTfAaqvm2kF0g7ilwuA=
+go.opentelemetry.io/otel/sdk/metric v1.45.0 h1:oVFszMfyj1Am6s24Vtc7wBb8BKLcwepJjNEYILuiE3o=
+go.opentelemetry.io/otel/sdk/metric v1.45.0/go.mod h1:vUWUxDZvu1WVRj8JA8S0AdhsPrZoDpA2DdZauIh4mDA=
+go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
+go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
+go.opentelemetry.io/proto/otlp v1.11.0 h1:5rrYs0Ykyj50sdU/JU0x8etU+LubXWb+gED6TbEdMIk=
+go.opentelemetry.io/proto/otlp v1.11.0/go.mod h1:SmVizdCOAm3XBtG1g1NnOdhW6jtddT72hLMhv8VwA8E=
 go.opentelemetry.io/proto/slim/otlp v1.10.0 h1:iR97Vs/ZDR+y9TfuP9b1XBtdPWeC+OMslIBmhcLU7jM=
 go.opentelemetry.io/proto/slim/otlp v1.10.0/go.mod h1:lV9250stpjYLPNA5viFabIgP2QlUGRT1GdTgAf8SIUk=
 go.opentelemetry.io/proto/slim/otlp/collector/profiles/v1development v0.3.0 h1:RUF5rO0hAlgiJt1fzQVzcVs3vZVNHIcMLgOgG4rWNcQ=
@@ -325,12 +325,12 @@ golang.org/x/xerrors v0.0.0-20191204190536-9bdfabe68543/go.mod h1:I/5z698sn9Ka8T
 golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1/go.mod h1:I/5z698sn9Ka8TeJc9MKroU
```

**File**: `sdk/nodejs/package-lock.json` (modified, +5/-5)
```diff
@@ -1,12 +1,12 @@
 {
     "name": "@pulumi/pulumi",
-    "version": "3.264.0",
+    "version": "3.268.0",
     "lockfileVersion": 3,
     "requires": true,
     "packages": {
         "": {
             "name": "@pulumi/pulumi",
-            "version": "3.264.0",
+            "version": "3.268.0",
             "license": "Apache-2.0",
             "dependencies": {
                 "@grpc/grpc-js": "^1.10.1",
@@ -1191,9 +1191,9 @@
             }
         },
         "node_modules/@grpc/grpc-js": {
-            "version": "1.14.4",
-            "resolved": "https://registry.npmjs.org/@grpc/grpc-js/-/grpc-js-1.14.4.tgz",
-            "integrity": "sha512-k9Dj3DV/itK9D06Y8f190Qgop7/Ui+D0njFV3LHMPwPT75DpXLQohE9Wmz0QElrJnzsjB7KPWiKJbOl7IPDArQ==",
+            "version": "1.14.5",
+            "resolved": "https://registry.npmjs.org/@grpc/grpc-js/-/grpc-js-1.14.5.tgz",
+            "integrity": "sha512-7VZM+SVdEcUUqSQeNI3zM8Qs/BhQKZndPo2h5VkYkAM8Iz0wJIa8mKV5ekQGqG8UUsnkQ0NMxIxwkIHYvj0qOw==",
             "license": "Apache-2.0",
             "dependencies": {
                 "@grpc/proto-loader": "^0.8.0",
```

**File**: `tests/integration/call_component_failures/testcomponent/package.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
         "typescript": "3.9.10"
     },
     "dependencies": {
-        "@grpc/grpc-js": "1.14.4"
+        "@grpc/grpc-js": "1.14.5"
     },
     "peerDependencies": {
         "@pulumi/pulumi": "latest"
```

**File**: `tests/integration/construct_component_failures/testcomponent/package.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
         "typescript": "3.9.10"
     },
     "dependencies": {
-        "@grpc/grpc-js": "1.14.4"
+        "@grpc/grpc-js": "1.14.5"
     },
     "peerDependencies": {
         "@pulumi/pulumi": "latest"
```

---

### Incident Patch 3: `fa4b08f4` (2026-10-05)
**Commit Message**: Fix nondeterministic and non-terminating unification (#24805)

This PR makes `model.UnifyTypes` deterministic & prevents it from
panicking. Unfortunately, right now it holds neither properties.

This is validated by rapid test that directly asserts determinism on
arbitrary types.

**File**: `changelog/pending/pcl-fix-20260925-180000.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: pcl
+kind: fix
+body: Unify two recursive object types, or a map with an object, to the same finite type on every run instead of overflowing the stack or picking a different type each time
+time: 2026-09-25T18:00:00.000000+02:00
```

**File**: `pkg/codegen/hcl2/model/diagnostics.go` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ func diagf(severity hcl.DiagnosticSeverity, subject hcl.Range, f string, args ..
 }
 
 func ExprNotConvertible(destType Type, expr Expression) *hcl.Diagnostic {
-	conversionKind, whyF := destType.conversionFrom(expr.Type(), false, cycleSet{})
+	conversionKind, whyF := destType.conversionFrom(expr.Type(), false, &cycleSet{})
 	contract.Assertf(whyF != nil, "destType.conversionFrom (kind: %#v) should always have a reason: %T\n",
 		conversionKind, destType)
 	why := whyF()
```

**File**: `pkg/codegen/hcl2/model/type.go` (modified, +53/-27)
```diff
@@ -90,9 +90,9 @@ type Type interface {
 	Pretty() pretty.Formatter
 
 	equals(other Type, seen map[Type]struct{}) bool
-	conversionFrom(src Type, unifying bool, seen cycleSet) (ConversionKind, lazyDiagnostics)
+	conversionFrom(src Type, unifying bool, seen *cycleSet) (ConversionKind, lazyDiagnostics)
 	string(seen map[Type]struct{}) string
-	unify(other Type) (Type, ConversionKind)
+	unify(other Type, seen *cycleSet) (Type, ConversionKind)
 	isType()
 }
 
@@ -147,27 +147,53 @@ type cacheEntry struct {
 
 type typeCache = gsync.Map[cacheKey, cacheEntry]
 
-// cycleSet tracks `(destination, source)` pairs currently mid-flight in a
-// recursive [Type.conversionFrom] computation. Cycle detection is keyed by
-// the pair rather than the destination alone: re-entering the same destination
-// with a different source is a different question and must be checked, not
-// short-circuited.
-type cycleSet map[[2]Type]struct{}
+// cycleSet tracks the `(destination, source)` pairs of a recursive [Type.conversionFrom] computation and the
+// pairs of object types of a recursive [Type.unify] computation that are currently mid-flight. Cycle detection
+// is keyed by the pair rather than the destination alone: re-entering the same destination with a different
+// source is a different question and must be checked, not short-circuited. A pair of object types under
+// unification maps to the object that their unification builds, so that re-entering the pair yields that object
+// and two recursive objects unify to one recursive object.
+type cycleSet struct {
+	conversions  map[[2]Type]struct{}
+	unifications map[[2]Type]*ObjectType
+}
 
-func (c cycleSet) has(dst, src Type) bool {
-	_, ok := c[[2]Type{dst, src}]
+func (c *cycleSet) has(dst, src Type) bool {
+	if c == nil {
+		return false
+	}
+	_, ok := c.conversions[[2]Type{dst, src}]
 	return ok
 }
 
-func (c cycleSet) push(dst, src Type) {
-	c[[2]Type{dst, src}] = struct{}{}
+func (c *cycleSet) push(dst, src Type) {
+	if c.conversions == nil {
+		c.conversions = map[[2]Type]struct{}{}
+	}
+	c.conversions[[2]Type{dst, src}] = struct{}{}
+}
+
+func (c *cycleSet) pop(dst, src Type) {
+	delete(c.conversions, [2]Type{dst, src})
+}
+
+func (c *cycleSet) unification(t, other Type) (*ObjectType, bool) {
+	unified, ok := c.unifications[[2]Type{t, other}]
+	return unified, ok
+}
+
+func (c *cycleSet) pushUnification(t, other Type, unified *ObjectType) {
+	if c.unifications == nil {
+		c.unifications = map[[2]Type]*ObjectType{}
+	}
+	c.unifications[[2]Type{t, other}] = unified
 }
 
-func (c cycleSet) pop(dst, src Type) {
-	delete(c, [2]Type{dst, src})
+func (c *cycleSet) popUnification(t, other Type) {
+	delete(c.unifications, [2]Type{t, other})
 }
 
-func conversionFrom(dest, src Type, unifying bool, seen cycleSet,
+func conversionFrom(dest, src Type, unifying bool, seen *cycleSet,
 	cache *typeCache,
 	conversionFromImpl func() (ConversionKind, lazyDiagnostics),
 ) (ConversionKind, lazyDiagnostics) {
@@ -206,8 +232,11 @@ func conversionFrom(dest, src Type, unifying bool, seen cycleSet,
 	return kind, diags
 }
 
-func unify(t0, t1 Type, unify func() (Type, ConversionKind)) (Type, ConversionKind) {
+// unify chooses the more general of t0 and t1 when one converts to the other, and otherwise defers to the
+// type-specific unify closure. Every conversion check and nested unification shares seen, which must not be nil.
+func unify(t0, t1 Type, seen *cycleSet, unify func() (Type, ConversionKind)) (Type, ConversionKind) {
 	contract.Requiref(t0 != nil, "t0", "must not be nil")
+	contract.Requiref(seen != nil, "seen", "must not be nil")
 
 	// Normalize s.t. dynamic is always on the right.
 	if t0 == DynamicType {
@@ -221,8 +250,8 @@ func unify(t0, t1 Type, unify func() (Type, ConversionKind)) (Type, ConversionKi
 		// The dynamic type unifies with any other type by selecting that other type.
 		return t0, UnsafeConversion
 	default:
-		conversionFrom, _ := t0.conversionFrom(t1, true, nil)
-		conversionTo, _ := t1.conversionFrom(t0, true, nil)
+		conversionFrom, _ := t0.conversionFrom(t1, true, seen)
+		conversionTo, _ := t1.conversionFrom(t0, true, seen)
 		switch {
 		case conversionFrom < conversionTo:
 			return t1, conversionTo
@@ -233,15 +262,12 @@ func unify(t0, t1 Type, unify func() (Type, ConversionKind)) (Type, ConversionKi
 			return NewUnionType(t0, t1), SafeConversion
 		}
 		if union, ok := t1.(*UnionType); ok {
-			return union.unifyTo(t0)
+			return union.unifyTo(t0, seen)
 		}
 
-		unified, conversionKind := unify()
-		contract.Assertf(conversionKind >= conversionFrom,
-			"conversionKind (%v) < conversionFrom (%v)", conversionKind, conversionFrom)
-		contract.Assertf(conversionKind >= conversionTo,
-			"conversionKind (%v) < conversionTo (%v)", conversionKind, conversionTo)
-		return unified, conversionKind
+		// A conversion check that re-enters a pair of recursive types assumes that the pair converts, so the kind of
+		// the unification may be lower than either con
```

**File**: `pkg/codegen/hcl2/model/type_collection.go` (modified, +4/-6)
```diff
@@ -15,8 +15,10 @@
 package model
 
 import (
+	"maps"
+	"slices"
+
 	"github.com/hashicorp/hcl/v2"
-	"github.com/pulumi/pulumi/sdk/v3/go/common/slice"
 )
 
 // unwrapIterableSourceType removes any eventual types that wrap a type intended for iteration.
@@ -77,11 +79,7 @@ func GetCollectionTypes(collectionType Type, rng hcl.Range, strict bool) (Type,
 	case *ObjectType:
 		keyType = StringType
 
-		types := slice.Prealloc[Type](len(collectionType.Properties))
-		for _, t := range collectionType.Properties {
-			types = append(types, t)
-		}
-		valueType, _ = UnifyTypes(types...)
+		valueType, _ = UnifyTypes(slices.SortedFunc(maps.Values(collectionType.Properties), Compare)...)
 
 	default:
 		// If the collection is a dynamic type, treat it as an iterable(dynamic, dynamic).
```

**File**: `pkg/codegen/hcl2/model/type_const.go` (modified, +5/-4)
```diff
@@ -103,7 +103,7 @@ func (t *ConstType) ConversionFrom(src Type) ConversionKind {
 	return kind
 }
 
-func (t *ConstType) conversionFrom(src Type, unifying bool, seen cycleSet) (ConversionKind, lazyDiagnostics) {
+func (t *ConstType) conversionFrom(src Type, unifying bool, seen *cycleSet) (ConversionKind, lazyDiagnostics) {
 	return conversionFrom(t, src, unifying, seen, t.cache, func() (ConversionKind, lazyDiagnostics) {
 		notConvertible := func() hcl.Diagnostics { return hcl.Diagnostics{typeNotConvertible(t, src)} }
 		if src, ok := src.(*ConstType); ok {
@@ -128,9 +128,10 @@ func (t *ConstType) string(_ map[Type]struct{}) string {
 	return t.String()
 }
 
-func (t *ConstType) unify(other Type) (Type, ConversionKind) {
-	return unify(t, other, func() (Type, ConversionKind) {
-		return t, other.ConversionFrom(t)
+func (t *ConstType) unify(other Type, seen *cycleSet) (Type, ConversionKind) {
+	return unify(t, other, seen, func() (Type, ConversionKind) {
+		kind, _ := other.conversionFrom(t, true, seen)
+		return t, kind
 	})
 }
 
```

**File**: `pkg/codegen/hcl2/model/type_enum.go` (modified, +3/-3)
```diff
@@ -151,7 +151,7 @@ func (t *EnumType) ConversionFrom(src Type) ConversionKind {
 	return kind
 }
 
-func (t *EnumType) conversionFrom(src Type, unifying bool, seen cycleSet) (ConversionKind, lazyDiagnostics) {
+func (t *EnumType) conversionFrom(src Type, unifying bool, seen *cycleSet) (ConversionKind, lazyDiagnostics) {
 	return conversionFrom(t, src, unifying, seen, t.cache, func() (ConversionKind, lazyDiagnostics) {
 		// A constant converts safely when it is a member of the enum and not at all otherwise.
 		if src, ok := src.(*ConstType); ok {
@@ -192,8 +192,8 @@ func (t *EnumType) string(seen map[Type]struct{}) string {
 	return s
 }
 
-func (t *EnumType) unify(other Type) (Type, ConversionKind) {
-	return unify(t, other, func() (Type, ConversionKind) {
+func (t *EnumType) unify(other Type, seen *cycleSet) (Type, ConversionKind) {
+	return unify(t, other, seen, func() (Type, ConversionKind) {
 		return nil, NoConversion
 	})
 }
```

**File**: `pkg/codegen/hcl2/model/type_list.go` (modified, +7/-7)
```diff
@@ -122,7 +122,7 @@ func (t *ListType) ConversionFrom(src Type) ConversionKind {
 	return kind
 }
 
-func (t *ListType) conversionFrom(src Type, unifying bool, seen cycleSet) (ConversionKind, lazyDiagnostics) {
+func (t *ListType) conversionFrom(src Type, unifying bool, seen *cycleSet) (ConversionKind, lazyDiagnostics) {
 	return conversionFrom(t, src, unifying, seen, t.cache, func() (ConversionKind, lazyDiagnostics) {
 		switch src := src.(type) {
 		case *ListType:
@@ -154,14 +154,14 @@ func (t *ListType) string(seen map[Type]struct{}) string {
 	return fmt.Sprintf("list(%s)", t.ElementType.string(seen))
 }
 
-func (t *ListType) unify(other Type) (Type, ConversionKind) {
-	return unify(t, other, func() (Type, ConversionKind) {
+func (t *ListType) unify(other Type, seen *cycleSet) (Type, ConversionKind) {
+	return unify(t, other, seen, func() (Type, ConversionKind) {
 		switch other := other.(type) {
 		case *TupleType:
 			// If the other element is a list type, prefer the list type, but unify the element type.
 			elementType, conversionKind := t.ElementType, SafeConversion
 			for _, other := range other.ElementTypes {
-				element, ck := elementType.unify(other)
+				element, ck := elementType.unify(other, seen)
 				if ck < conversionKind {
 					conversionKind = ck
 				}
@@ -170,15 +170,15 @@ func (t *ListType) unify(other Type) (Type, ConversionKind) {
 			return NewListType(elementType), conversionKind
 		case *SetType:
 			// If the other element is a set type, prefer the list type, but unify the element types.
-			elementType, conversionKind := t.ElementType.unify(other.ElementType)
+			elementType, conversionKind := t.ElementType.unify(other.ElementType, seen)
 			return NewListType(elementType), conversionKind
 		case *ListType:
 			// If the other type is a list type, unify based on the element type.
-			elementType, conversionKind := t.ElementType.unify(other.ElementType)
+			elementType, conversionKind := t.ElementType.unify(other.ElementType, seen)
 			return NewListType(elementType), conversionKind
 		default:
 			// Prefer the list type.
-			kind, _ := t.conversionFrom(other, true, nil)
+			kind, _ := t.conversionFrom(other, true, seen)
 			return t, kind
 		}
 	})
```

**File**: `pkg/codegen/hcl2/model/type_map.go` (modified, +9/-7)
```diff
@@ -16,6 +16,8 @@ package model
 
 import (
 	"fmt"
+	"maps"
+	"slices"
 
 	"github.com/hashicorp/hcl/v2"
 	"github.com/hashicorp/hcl/v2/hclsyntax"
@@ -117,7 +119,7 @@ func (t *MapType) ConversionFrom(src Type) ConversionKind {
 	return kind
 }
 
-func (t *MapType) conversionFrom(src Type, unifying bool, seen cycleSet) (ConversionKind, lazyDiagnostics) {
+func (t *MapType) conversionFrom(src Type, unifying bool, seen *cycleSet) (ConversionKind, lazyDiagnostics) {
 	return conversionFrom(t, src, unifying, seen, t.cache, func() (ConversionKind, lazyDiagnostics) {
 		switch src := src.(type) {
 		case *MapType:
@@ -147,18 +149,18 @@ func (t *MapType) string(seen map[Type]struct{}) string {
 	return fmt.Sprintf("map(%s)", t.ElementType.string(seen))
 }
 
-func (t *MapType) unify(other Type) (Type, ConversionKind) {
-	return unify(t, other, func() (Type, ConversionKind) {
+func (t *MapType) unify(other Type, seen *cycleSet) (Type, ConversionKind) {
+	return unify(t, other, seen, func() (Type, ConversionKind) {
 		switch other := other.(type) {
 		case *MapType:
 			// If the other type is a map type, unify based on the element type.
-			elementType, conversionKind := t.ElementType.unify(other.ElementType)
+			elementType, conversionKind := t.ElementType.unify(other.ElementType, seen)
 			return NewMapType(elementType), conversionKind
 		case *ObjectType:
 			// If the other type is an object type, prefer the map type, but unify the property types.
 			elementType, conversionKind := t.ElementType, SafeConversion
-			for _, other := range other.Properties {
-				element, ck := elementType.unify(other)
+			for _, other := range slices.SortedFunc(maps.Values(other.Properties), Compare) {
+				element, ck := elementType.unify(other, seen)
 				if ck < conversionKind {
 					conversionKind = ck
 				}
@@ -167,7 +169,7 @@ func (t *MapType) unify(other Type) (Type, ConversionKind) {
 			return NewMapType(elementType), conversionKind
 		default:
 			// Prefer the map type.
-			kind, _ := t.conversionFrom(other, true, nil)
+			kind, _ := t.conversionFrom(other, true, seen)
 			return t, kind
 		}
 	})
```

---

### Incident Patch 4: `5d2598e5` (2026-10-05)
**Commit Message**: TestStuckEventLoop: avoid timing out because of other tests (#25023)

TestStuckEventLoop has a timeout that starts ticking pretty much as
soon as the test starts.  Since we let ProgramTest call
`t.Parallel()` internally, that happens after the timer has
started. Go holds up all the parallel tests until all the ones that
need to run sequentially start running.  This means the test can get
stuck on the `t.Parallel()` for an arbitrary amount of time, while
that also counts against our deadline, so if other tests take longer
this test might end up timing out without actually taking 10 minutes.

Make the test call `t.Parallel()` upfront instead, so the blocking
happens before the timer starts, allowing the test to take the full
timeout allocated to it.

Fixes https://github.com/pulumi/pulumi/issues/25022

**File**: `tests/integration/integration_python_test.go` (modified, +3/-1)
```diff
@@ -2000,8 +2000,9 @@ func TestRegress18176(t *testing.T) {
 	})
 }
 
-//nolint:paralleltest // ProgramTest calls t.Parallel()
 func TestStuckEventLoop(t *testing.T) {
+	t.Parallel()
+
 	done := make(chan struct{})
 	stderr := &bytes.Buffer{}
 	go func() {
@@ -2015,6 +2016,7 @@ func TestStuckEventLoop(t *testing.T) {
 			},
 			Stderr:        stderr,
 			Quick:         true,
+			NoParallel:    true,
 			ExpectFailure: true, // We expect a failure, but the program shouldn't hang indefinitely.
 		})
 		done <- struct{}{}
```

---

### Incident Patch 5: `78161514` (2026-10-02)
**Commit Message**: remove timeout from fuzz tests (#25008)

Given we have an environment variable that allows us to increase the
number of fuzz tests to be run, the runtime of `make
test_lifecycle_fuzz` is essentially unbounded. Reflect that in the
target by passing `-timeout 0`, essentially giving us an infinite
timeout for long fuzz testing runs.

**File**: `Makefile` (modified, +1/-0)
```diff
@@ -251,6 +251,7 @@ test_lifecycle_fuzz:
 	@cd pkg && go test github.com/pulumi/pulumi/pkg/v3/engine/lifecycletest \
 		-run '^TestFuzz$$' \
 		-tags all \
+		-timeout 0 \
 		-rapid.checks=$(LIFECYCLE_TEST_FUZZ_CHECKS)
 
 test_lifecycle_fuzz_from_state_file: GO_TEST_RACE = false
```

---

### Incident Patch 6: `6e2612f4` (2026-10-02)
**Commit Message**: Propagate the trace context on backend API calls (#25009)

With `--otel-traces`, the CLI records a span for each attempt of a
Pulumi Cloud API request, but it does not send the span context to the
server. A backend that is instrumented with OpenTelemetry then starts an
unrelated trace for each request, so the CLI trace stops at the HTTP
call.

The tracing transport now injects the context of the attempt span into
the request headers with the global propagator, so the server sees each
retry as a separate child span. Only requests to the host of the API URL
carry the header, because the same client also sends requests to
presigned object storage URLs. Without `--otel-traces` the global
propagator does nothing, and the CLI sends no trace headers.

**File**: `changelog/pending/backend-service-improvement-20261002-145211.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: backend/service
+kind: improvement
+body: Send the W3C `traceparent` header on Pulumi Cloud API calls when `--otel-traces` is set
+time: 2026-10-02T14:52:11.692778+02:00
```

**File**: `pkg/backend/httpstate/client/api.go` (modified, +11/-3)
```diff
@@ -34,6 +34,7 @@ import (
 	"go.opentelemetry.io/otel"
 	"go.opentelemetry.io/otel/attribute"
 	"go.opentelemetry.io/otel/codes"
+	"go.opentelemetry.io/otel/propagation"
 	"go.opentelemetry.io/otel/trace"
 
 	"github.com/pulumi/pulumi/pkg/v3/backend/backenderr"
@@ -349,9 +350,10 @@ type httpClient interface {
 }
 
 // tracingTransport wraps an http.RoundTripper to create a span for each individual HTTP attempt,
-// making retries visible in traces.
+// making retries visible in traces. Requests to apiHost carry the context of the attempt span.
 type tracingTransport struct {
 	base    http.RoundTripper
+	apiHost string
 	attempt int
 }
 
@@ -368,7 +370,11 @@ func (t *tracingTransport) RoundTrip(req *http.Request) (*http.Response, error)
 		))
 	defer span.End()
 
-	req = req.WithContext(ctx)
+	// A RoundTripper must not modify the caller's request, so clone it before the headers change.
+	req = req.Clone(ctx)
+	if req.URL.Host == t.apiHost {
+		otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(req.Header))
+	}
 	resp, err := t.base.RoundTrip(req)
 	if err != nil {
 		span.SetStatus(codes.Error, err.Error())
@@ -388,6 +394,8 @@ func (t *tracingTransport) RoundTrip(req *http.Request) (*http.Response, error)
 // using the specified *http.Client, with retry support.
 type defaultHTTPClient struct {
 	client *http.Client
+	// apiHost is the host of the Pulumi Cloud API. Only requests to this host carry the trace context.
+	apiHost string
 }
 
 func (c *defaultHTTPClient) Do(req *http.Request, policy retryPolicy) (*http.Response, error) {
@@ -421,7 +429,7 @@ func (c *defaultHTTPClient) Do(req *http.Request, policy retryPolicy) (*http.Res
 		transport = http.DefaultTransport
 	}
 	tracingClient := *c.client
-	tracingClient.Transport = &tracingTransport{base: transport}
+	tracingClient.Transport = &tracingTransport{base: transport, apiHost: c.apiHost}
 
 	// Wait 1s before retrying on failure. Then increase by 2x until the
 	// maximum delay is reached. Stop after maxRetryCount requests have
```

**File**: `pkg/backend/httpstate/client/api_test.go` (modified, +113/-7)
```diff
@@ -19,8 +19,13 @@ import (
 	"context"
 	"encoding/json"
 	"errors"
+	"fmt"
 	"io"
 	"net/http"
+	"net/http/httptest"
+	"os"
+	"os/exec"
+	"sync"
 	"sync/atomic"
 	"testing"
 	"time"
@@ -29,8 +34,10 @@ import (
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	"go.opentelemetry.io/otel"
+	"go.opentelemetry.io/otel/propagation"
 	sdktrace "go.opentelemetry.io/otel/sdk/trace"
 	"go.opentelemetry.io/otel/sdk/trace/tracetest"
+	"go.opentelemetry.io/otel/trace"
 
 	"github.com/pulumi/pulumi/pkg/v3/backend/backenderr"
 	"github.com/pulumi/pulumi/sdk/v3/go/common/apitype"
@@ -134,7 +141,7 @@ func TestHTTPClientUserAgent(t *testing.T) {
 
 	var inReq *http.Request
 	client := &defaultHTTPClient{
-		&http.Client{
+		client: &http.Client{
 			Transport: &errorTransport{
 				roundTripFunc: func(req *http.Request) (*http.Response, error) {
 					inReq = req
@@ -203,7 +210,7 @@ func TestPulumiAPICall_401_LoginRequired(t *testing.T) {
 			Message: "Unauthorized",
 		})
 		httpClient := &defaultHTTPClient{
-			&http.Client{
+			client: &http.Client{
 				Transport: &errorTransport{
 					roundTripFunc: func(req *http.Request) (*http.Response, error) {
 						return &http.Response{
@@ -247,7 +254,7 @@ func TestPulumiAPICall_401_LoginRequired(t *testing.T) {
 				},
 			})
 			httpClient := &defaultHTTPClient{
-				&http.Client{
+				client: &http.Client{
 					Transport: &errorTransport{
 						roundTripFunc: func(req *http.Request) (*http.Response, error) {
 							return &http.Response{
@@ -279,7 +286,7 @@ func TestPulumiAPICall_401_LoginRequired(t *testing.T) {
 		t.Parallel()
 
 		httpClient := &defaultHTTPClient{
-			&http.Client{
+			client: &http.Client{
 				Transport: &errorTransport{
 					roundTripFunc: func(req *http.Request) (*http.Response, error) {
 						return &http.Response{
@@ -315,7 +322,7 @@ func TestCall_RefreshOn401(t *testing.T) {
 	newRESTClient := func(rt func(req *http.Request) (*http.Response, error)) *defaultRESTClient {
 		return &defaultRESTClient{
 			client: &defaultHTTPClient{
-				&http.Client{Transport: &errorTransport{roundTripFunc: rt}},
+				client: &http.Client{Transport: &errorTransport{roundTripFunc: rt}},
 			},
 		}
 	}
@@ -524,7 +531,7 @@ func TestDoCreatesPerAttemptSpans(t *testing.T) {
 		})
 
 		client := &defaultHTTPClient{
-			&http.Client{
+			client: &http.Client{
 				Transport: &errorTransport{
 					roundTripFunc: func(req *http.Request) (*http.Response, error) {
 						return &http.Response{
@@ -565,7 +572,7 @@ func TestDoCreatesPerAttemptSpans(t *testing.T) {
 
 		var callCount atomic.Int32
 		client := &defaultHTTPClient{
-			&http.Client{
+			client: &http.Client{
 				Transport: &errorTransport{
 					roundTripFunc: func(req *http.Request) (*http.Response, error) {
 						n := callCount.Add(1)
@@ -608,6 +615,105 @@ func TestDoCreatesPerAttemptSpans(t *testing.T) {
 		assertSpanAttribute(t, attemptSpans[1], "http.status_code", int64(500))
 		assertSpanAttribute(t, attemptSpans[2], "http.status_code", int64(200))
 	})
+
+	t.Run("propagates each attempt span to the API", func(t *testing.T) {
+		recorder := tracetest.NewSpanRecorder()
+		tp := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
+		prevProvider := otel.GetTracerProvider()
+		prevPropagator := otel.GetTextMapPropagator()
+		otel.SetTracerProvider(tp)
+		otel.SetTextMapPropagator(propagation.TraceContext{})
+		t.Cleanup(func() {
+			otel.SetTracerProvider(prevProvider)
+			otel.SetTextMapPropagator(prevPropagator)
+		})
+
+		var mu sync.Mutex
+		var traceparents []string
+		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+			mu.Lock()
+			defer mu.Unlock()
+			traceparents = append(traceparents, r.Header.Get("traceparent"))
+			if len(traceparents) == 1 {
+				w.WriteHeader(http.StatusInternalServerError)
+			}
+		}))
+		t.Cleanup(server.Close)
+
+		pc := NewClient(server.URL, "", false, nil)
+		require.NoError(t, pc.restCall(t.Context(), "GET", "/api/test", nil, nil, nil))
+
+		require.NoError(t, tp.ForceFlush(t.Context()))
+		attemptSpans := filterSpansByName(recorder.Ended(), "HTTP attempt")
+		require.Len(t, attemptSpans, 2)
+		expected := make([]string, 0, len(attemptSpans))
+		for _, span := range attemptSpans {
+			sc := span.SpanContext()
+			expected = append(expected, fmt.Sprintf("00-%s-%s-01", sc.TraceID(), sc.SpanID()))
+		}
+		mu.Lock()
+		defer mu.Unlock()
+		assert.Equal(t, expected, traceparents)
+	})
+
+	t.Run("does not propagate to other hosts", func(t *testing.T) {
+		prevProvider := otel.GetTracerProvider()
+		prevPropagator := otel.GetTextMapPropagator()
+		otel.SetTracerProvider(sdktrace.NewTracerProvider())
+		otel.SetTextMapPropagator(propagation.TraceContext{})
+		t.Cleanup(func() {
+			otel.SetTracerProvider(prevProvider)
+			otel.SetTextMapPropagator(prevPropagator)
+		})
+
+		var header http.Header
+		other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Reques
```

**File**: `pkg/backend/httpstate/client/client.go` (modified, +11/-6)
```diff
@@ -261,9 +261,7 @@ func NewClient(apiURL, apiToken string, insecure bool, d diag.Sink) *Client {
 		diag:     d,
 		insecure: insecure,
 		restClient: &defaultRESTClient{
-			client: &defaultHTTPClient{
-				client: httpClient,
-			},
+			client: newDefaultHTTPClient(httpClient, apiURL),
 		},
 	}
 }
@@ -277,13 +275,20 @@ func (pc *Client) Insecure() bool {
 // Useful for testing.
 func (pc *Client) WithHTTPClient(httpClient *http.Client) *Client {
 	pc.restClient = &defaultRESTClient{
-		client: &defaultHTTPClient{
-			client: httpClient,
-		},
+		client: newDefaultHTTPClient(httpClient, pc.apiURL),
 	}
 	return pc
 }
 
+// newDefaultHTTPClient returns a defaultHTTPClient that sends the trace context to the host of apiURL.
+func newDefaultHTTPClient(client *http.Client, apiURL string) *defaultHTTPClient {
+	var apiHost string
+	if u, err := url.Parse(apiURL); err == nil {
+		apiHost = u.Host
+	}
+	return &defaultHTTPClient{client: client, apiHost: apiHost}
+}
+
 // WithRefresh wires an OAuth refresh token + a credentials-writeback callback into this client.
 // Once configured, the client transparently exchanges the refresh token at /api/oauth/token for a
 // fresh access token whenever the service rejects the current one with 401, retrying the original
```

---

### Incident Patch 7: `e5540672` (2026-10-02)
**Commit Message**: TestPulumiNewEmptyOperations: stop requiring login (#24997)

Nothing in this test really needs us to be logged in, so use the local
backend instead to make this test work even if `PULUMI_ACCESS_TOKEN` is
not set in the environment, and so we don't need to touch the backend
which is always better for tests.

**File**: `tests/smoke/smoke_test.go` (modified, +1/-0)
```diff
@@ -1469,6 +1469,7 @@ func TestPulumiNewEmptyOperations(t *testing.T) {
 	defer e.DeleteIfNotFailed()
 	require.NoError(t, os.Remove(filepath.Join(e.RootPath, ".yarnrc")))
 
+	e.SetBackend(e.LocalURL())
 	e.RunCommand("pulumi", "new", "-y")
 	e.RunCommand("pulumi", "stack", "init", "testing")
 	e.RunCommand("pulumi", "config", "set", "key", "value")
```

---

### Incident Patch 8: `e5a034e5` (2026-10-02)
**Commit Message**: avoid panic handler goroutine leaking (#24981)

This goroutine leaking, while not important on its own, causes a multi
GB memory leak when running the fuzz tests. Fix it.

**File**: `pkg/resource/deploy/step_executor.go` (modified, +21/-4)
```diff
@@ -125,6 +125,8 @@ type stepExecutor struct {
 
 	// Channel to collect panic errors from goroutines in this step executor
 	panicErrs chan error
+	completed chan struct{}
+	complete  sync.Once
 
 	// ExecuteRegisterResourceOutputs will save the event for the stack resource so that the stack outputs
 	// can be finalized at the end of the deployment. We do this so we can determine whether or not the
@@ -391,6 +393,7 @@ func (se *stepExecutor) WaitForCompletion() {
 	se.log(synchronousWorkerID, "StepExecutor.waitForCompletion(): waiting for worker threads to exit")
 	se.workers.Wait()
 	se.log(synchronousWorkerID, "StepExecutor.waitForCompletion(): worker threads all exited")
+	se.complete.Do(func() { close(se.completed) })
 }
 
 //
@@ -734,14 +737,28 @@ func newStepExecutor(
 		ctx:            ctx,
 		cancel:         cancel,
 		panicErrs:      make(chan error, 1),
+		completed:      make(chan struct{}),
 	}
 
+	handlePanic := func(panicErr error) {
+		exec.cancelDueToError(panicErr, nil)
+		if deployment.panicErrs != nil {
+			deployment.panicErrs <- panicErr
+		}
+	}
 	// Start a goroutine to monitor for panic errors and handle them
 	go func() {
-		for panicErr := range exec.panicErrs {
-			exec.cancelDueToError(panicErr, nil)
-			if deployment.panicErrs != nil {
-				deployment.panicErrs <- panicErr
+		for {
+			select {
+			case panicErr := <-exec.panicErrs:
+				handlePanic(panicErr)
+			case <-exec.completed:
+				select {
+				case panicErr := <-exec.panicErrs:
+					handlePanic(panicErr)
+				default:
+				}
+				return
 			}
 		}
 	}()
```

---

### Incident Patch 9: `319729fb` (2026-10-02)
**Commit Message**: Download plugins from Git repositories whose version tags have no `v` prefix (#24986)

## Summary

Fixes #19724.

When a plugin comes from a Git repository, `gitSource.Download` always
checks out `refs/tags/v<version>`. A repository that tags its releases
as plain `1.0.0` can never be downloaded, even though
`gitutil.GetLatestTagOrHash` already accepts such tags when it picks the
latest version (it parses tag names with `semver.ParseTolerant`). That
is the failure in the issue: `pulumi package get-schema
github.com/flostadler/aws-k8s@0.0.21-beta.1` asks for
`refs/tags/v0.0.21-beta.1` and gives up.

`Download` now tries the `v` tag first and only when go-git reports that
the ref does not exist (`git.ErrRemoteRefNotFound`) tries the same
version without the prefix. A repository that has both tags still
resolves to the `v` one, and other clone errors, such as a failed
authentication, are returned without a second attempt. If neither tag
exists, both errors are returned, so the message names both refs.

## Test plan

- [x] Added appropriate unit tests - For all changes
- [ ] Added a test in `pkg/engine/lifecycletest` - For all
engine/protocol changes
- [ ] Added a conformance test in `

**File**: `changelog/pending/cli-package-fix-20261002-103750.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: cli/package
+kind: fix
+body: Download plugins from Git repositories whose version tags have no `v` prefix
+time: 2026-10-02T10:37:50.079282+09:00
```

**File**: `sdk/go/common/workspace/plugins.go` (modified, +11/-1)
```diff
@@ -42,6 +42,7 @@ import (
 
 	"github.com/blang/semver"
 	"github.com/djherbis/times"
+	git "github.com/go-git/go-git/v6"
 	"github.com/go-git/go-git/v6/plumbing"
 
 	"github.com/pulumi/pulumi/sdk/v3/go/common/apitype"
@@ -393,7 +394,7 @@ func (source *gitSource) GetLatestVersion(
 
 // Downloads a plugin from a git repository.  If the version is a pre-release version, the version is expected to be
 // a commit hash, that will be checked out.  Otherwise, the version is expected to be a tag, that will be checked out.
-// The tag is expected to be prefixed with a 'v' character.
+// The 'v'-prefixed tag is tried first, falling back to the unprefixed tag if it does not exist.
 // If the version is the special sentinel version 0.0.0, we'll use the latest commit on the default branch.
 func (source *gitSource) Download(
 	ctx context.Context, version semver.Version, _ string, _ string,
@@ -424,6 +425,15 @@ func (source *gitSource) Download(
 			ref = plumbing.ReferenceName("refs/tags/v" + version.String())
 		}
 		err := source.cloneOrPull(ctx, source.url, ref, tmpdir, true /* shallow */)
+		if ref != plumbing.HEAD && errors.Is(err, git.ErrRemoteRefNotFound) {
+			unprefixed := plumbing.ReferenceName("refs/tags/" + version.String())
+			unprefixedErr := source.cloneOrPull(ctx, source.url, unprefixed, tmpdir, true /* shallow */)
+			if unprefixedErr == nil {
+				err = nil
+			} else {
+				err = errors.Join(err, unprefixedErr)
+			}
+		}
 		if err != nil {
 			return nil, -1, err
 		}
```

**File**: `sdk/go/common/workspace/plugins_test.go` (modified, +67/-0)
```diff
@@ -35,6 +35,7 @@ import (
 	"time"
 
 	"github.com/blang/semver"
+	git "github.com/go-git/go-git/v6"
 	"github.com/go-git/go-git/v6/plumbing"
 	"github.com/pulumi/pulumi/sdk/v3/go/common/apitype"
 	"github.com/pulumi/pulumi/sdk/v3/go/common/diag"
@@ -2131,6 +2132,72 @@ func TestGitSourceDownloadSemver(t *testing.T) {
 	require.Equal(t, "a string", string(buf))
 }
 
+func TestGitSourceDownloadUnprefixedTag(t *testing.T) {
+	t.Parallel()
+
+	prefixed := plumbing.ReferenceName("refs/tags/v1.0.0")
+	unprefixed := plumbing.ReferenceName("refs/tags/1.0.0")
+	prefixedNotFound := fmt.Errorf("%w: %s", git.ErrRemoteRefNotFound, prefixed)
+	unprefixedNotFound := fmt.Errorf("%w: %s", git.ErrRemoteRefNotFound, unprefixed)
+	errAuth := errors.New("authentication required")
+
+	cases := []struct {
+		name         string
+		cloneErrs    map[plumbing.ReferenceName]error
+		expectedRefs []plumbing.ReferenceName
+		expectedErrs []error
+	}{
+		{
+			name:         "only unprefixed tag exists",
+			cloneErrs:    map[plumbing.ReferenceName]error{prefixed: prefixedNotFound},
+			expectedRefs: []plumbing.ReferenceName{prefixed, unprefixed},
+		},
+		{
+			name: "no tag exists",
+			cloneErrs: map[plumbing.ReferenceName]error{
+				prefixed:   prefixedNotFound,
+				unprefixed: unprefixedNotFound,
+			},
+			expectedRefs: []plumbing.ReferenceName{prefixed, unprefixed},
+			expectedErrs: []error{prefixedNotFound, unprefixedNotFound},
+		},
+		{
+			name:         "other clone error",
+			cloneErrs:    map[plumbing.ReferenceName]error{prefixed: errAuth},
+			expectedRefs: []plumbing.ReferenceName{prefixed},
+			expectedErrs: []error{errAuth},
+		},
+	}
+	for _, c := range cases {
+		t.Run(c.name, func(t *testing.T) {
+			t.Parallel()
+
+			var refs []plumbing.ReferenceName
+			gitSource := &gitSource{
+				url: "https://example.com/repo/test",
+				cloneOrPull: func(_ context.Context, _ string, ref plumbing.ReferenceName, tmpdir string, _ bool) error {
+					refs = append(refs, ref)
+					if err := c.cloneErrs[ref]; err != nil {
+						return err
+					}
+					return os.WriteFile(filepath.Join(tmpdir, "test"), []byte("a string"), 0o600)
+				},
+			}
+			readCloser, _, err := gitSource.Download(t.Context(), semver.MustParse("1.0.0"), "unused", "unused",
+				func(*http.Request) (io.ReadCloser, int64, error) { panic("unused") })
+			require.Equal(t, c.expectedRefs, refs)
+			if len(c.expectedErrs) > 0 {
+				for _, expected := range c.expectedErrs {
+					require.ErrorIs(t, err, expected)
+				}
+				return
+			}
+			require.NoError(t, err)
+			require.NotNil(t, readCloser)
+		})
+	}
+}
+
 func TestGitSourceDownloadHEAD(t *testing.T) {
 	t.Parallel()
 
```

---

### Incident Patch 10: `f6c3028b` (2026-10-01)
**Commit Message**: fix(engine): apply ancestor transforms through a read-resource parent (#24689)

## Summary

Resource transforms declared on an ancestor component were silently not
applied to a custom resource when the resource's parent chain passed
through a read (`.get()`-style) resource. The engine collects the
transforms to run on a resource by walking up the parent chain via
`rm.parents` (a URN→parent URN map), but that map was populated only in
the `RegisterResource` path — `ReadResource` never recorded a `parent`
entry for the resource it creates. When the ancestor walk reached a read
resource it found no entry and stopped early, dropping every transform
declared on components above the read resource.

This fixes `ReadResource` in `pkg/resource/deploy/source_eval.go` to
record `rm.parents[urn] = parent` for the resource it creates, mirroring
what `RegisterResource` already does. A read resource has no transforms
of its own (there's no `Transforms` field on `ReadResourceRequest`), so
`rm.resourceTransforms` is intentionally left untouched for it — only
the parent-chain link needed for the walk to continue.

Report: https://github.com/pulumi/pulumi/issues/24038

## Test plan

- [x] Added appro

**File**: `changelog/pending/engine-fix-20260917-120000.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: engine
+kind: fix
+body: Apply resource transforms declared on an ancestor component to resources parented under a resource read
+time: 2026-09-17T12:00:00.000000000Z
```

**File**: `pkg/engine/lifecycletest/transformation_test.go` (modified, +78/-0)
```diff
@@ -1201,3 +1201,81 @@ func TestRemoteTransformByteString(t *testing.T) {
 		"bar": resource.NewProperty(rawBytes),
 	}, res.Inputs)
 }
+
+// Test that a transform declared on an ancestor component is still applied to a custom resource whose parent
+// chain passes through a resource read.
+func TestTransformInheritedThroughReadParent(t *testing.T) {
+	t.Parallel()
+
+	loaders := []*deploytest.ProviderLoader{
+		deploytest.NewProviderLoader("pkgA", semver.MustParse("1.0.0"), func() (plugin.Provider, error) {
+			return &deploytest.Provider{
+				ReadF: func(_ context.Context, req plugin.ReadRequest) (plugin.ReadResponse, error) {
+					return plugin.ReadResponse{
+						ReadResult: plugin.ReadResult{
+							ID:      req.ID,
+							Outputs: req.State,
+						},
+						Status: resource.StatusOK,
+					}, nil
+				},
+			}, nil
+		}),
+	}
+
+	programF := deploytest.NewLanguageRuntimeF(func(_ plugin.RunInfo, monitor *deploytest.ResourceMonitor) error {
+		callbacks, err := deploytest.NewCallbacksServer()
+		require.NoError(t, err)
+		defer func() { require.NoError(t, callbacks.Close()) }()
+
+		// A transform that bumps "foo" by 1 on every leaf custom resource it is applied to.
+		bumpFoo, err := callbacks.Allocate(
+			TransformFunction(func(name, typ string, custom bool, parent string,
+				props resource.PropertyMap, opts *pulumirpc.TransformResourceOptions,
+			) (resource.PropertyMap, *pulumirpc.TransformResourceOptions, error) {
+				if typ == "pkgA:m:typLeaf" {
+					props["foo"] = resource.NewProperty(props["foo"].NumberValue() + 1)
+				}
+				return props, opts, nil
+			}))
+		require.NoError(t, err)
+
+		// Component C carries the transform. Its descendants should inherit it.
+		component, err := monitor.RegisterResource("pkgA:m:typComponent", "compA", false, deploytest.ResourceOptions{
+			Transforms: []*pulumirpc.Callback{bumpFoo},
+		})
+		require.NoError(t, err)
+
+		// A resource read parented to the component.
+		readURN, _, err := monitor.ReadResource(
+			"pkgA:m:typRead", "readR", "read-id", component.URN,
+			resource.PropertyMap{}, "", "", "", nil, "", "")
+		require.NoError(t, err)
+
+		// The leaf custom resource is parented to the read resource, not directly to the component.
+		_, err = monitor.RegisterResource("pkgA:m:typLeaf", "leafUnderRead", true, deploytest.ResourceOptions{
+			Parent: readURN,
+			Inputs: resource.PropertyMap{"foo": resource.NewProperty(10.0)},
+		})
+		require.NoError(t, err)
+		return nil
+	})
+	hostF := deploytest.NewPluginHostF(nil, nil, programF, nil, nil, loaders...)
+
+	p := &lt.TestPlan{
+		Options: lt.TestUpdateOptions{T: t, HostF: hostF, SkipDisplayTests: true},
+	}
+
+	project := p.GetProject()
+	snap, err := lt.TestOp(Update).Run(project, p.GetTarget(t, nil), p.Options, false, p.BackendClient, nil)
+	require.NoError(t, err)
+
+	inputsByName := map[string]resource.PropertyMap{}
+	for _, r := range snap.Resources {
+		inputsByName[r.URN.Name()] = r.Inputs
+	}
+
+	// The transform declared on the ancestor component should still apply: 10 + 1 = 11.
+	assert.Equal(t, resource.NewProperty(11.0), inputsByName["leafUnderRead"]["foo"],
+		"leaf parented under a read resource should inherit the ancestor component's transform")
+}
```

**File**: `pkg/resource/deploy/source_eval.go` (modified, +8/-7)
```diff
@@ -1198,7 +1198,8 @@ func (rm *resmon) Invoke(
 	return &pulumirpc.ResourceInvokeResponse{Return: mret, Failures: chkfails}, nil
 }
 
-// trackSettledResource records the resource a completed registration or read produced.
+// trackSettledResource records the resource a completed registration or read produced, along with its parent so that
+// transforms declared on ancestors can be found even when the chain passes through a resource read.
 //
 // parent and custom are the caller's, not the state's: Construct hands back a state carrying only a URN and outputs, so
 // a remote component's own state has neither, and filing it under the empty parent would hide it and everything beneath
@@ -1210,6 +1211,11 @@ func (rm *resmon) trackSettledResource(state *pkgresource.State, parent resource
 	state.Lock.Lock()
 	urn, id := state.URN, state.ID
 	state.Lock.Unlock()
+
+	rm.parentsLock.Lock()
+	rm.parents[urn] = parent
+	rm.parentsLock.Unlock()
+
 	rm.registrations.Track(urn, parent, custom, id != "")
 }
 
@@ -3092,12 +3098,7 @@ func (rm *resmon) RegisterResource(ctx context.Context,
 	}
 
 	if result != nil && result.State != nil && result.State.URN != "" {
-		// We've got a safe URN now, save the parent and transformations
-		func() {
-			rm.parentsLock.Lock()
-			defer rm.parentsLock.Unlock()
-			rm.parents[result.State.URN] = parent
-		}()
+		// We've got a safe URN now, save the transformations
 		func() {
 			rm.resourceTransformsLock.Lock()
 			defer rm.resourceTransformsLock.Unlock()
```

**File**: `pkg/resource/deploy/source_eval_test.go` (modified, +2/-0)
```diff
@@ -3552,6 +3552,7 @@ func TestReadResource(t *testing.T) {
 		regReadChan := make(chan *readResourceEvent, 1)
 		rm := &resmon{
 			regReadChan: regReadChan,
+			parents:     map[resource.URN]resource.URN{},
 			defaultProviders: &defaultProviders{
 				config: &configSourceMock{},
 			},
@@ -3599,6 +3600,7 @@ func TestReadResource(t *testing.T) {
 		regReadChan := make(chan *readResourceEvent, 1)
 		rm := &resmon{
 			regReadChan: regReadChan,
+			parents:     map[resource.URN]resource.URN{},
 			cancel:      cancel,
 			defaultProviders: &defaultProviders{
 				config: &configSourceMock{},
```

---

### Incident Patch 11: `6fc63e08` (2026-10-01)
**Commit Message**: Simplify credential-store test fixtures (#24957)

Use the helper from https://github.com/pulumi/pulumi/pull/24950 for
tests using a fake credential store.

**File**: `sdk/go/common/workspace/credstore.go` (modified, +0/-6)
```diff
@@ -41,12 +41,6 @@ func credentialStoreMode() (securestore.Mode, error) {
 	}
 }
 
-// Tests that change PULUMI_CREDENTIAL_STORE or install the mock must call this.
-func resetCredStoreForTesting() {
-	replacedEnvelope.Store(false)
-	plaintextPendingOnce = sync.Once{}
-}
-
 // Cheap to call repeatedly: the store probes memoize their own prechecks.
 func resolveWriteStore() (keyStore, error) {
 	mode, err := credentialStoreMode()
```

**File**: `sdk/go/common/workspace/credstore_test.go` (modified, +84/-96)
```diff
@@ -31,12 +31,18 @@ import (
 	"github.com/stretchr/testify/require"
 )
 
-// Temp credential dir, fake store, chosen mode.
-func pinSecureCreds(t *testing.T, mode string) {
+func isolateSecureCredentials(t *testing.T, mode string) *fakeKeyStore {
 	t.Helper()
 	ptesting.IsolateCredentials(t)
 	t.Setenv("PULUMI_CREDENTIAL_STORE", mode)
-	useFakeStores(t)
+	return useFakeStores(t)
+}
+
+func isolateUpgradableCredentials(t *testing.T) (promote func()) {
+	t.Helper()
+	ptesting.IsolateCredentials(t)
+	t.Setenv("PULUMI_CREDENTIAL_STORE", "auto")
+	return useUpgradableStores(t)
 }
 
 func testCreds() Credentials {
@@ -48,7 +54,7 @@ func testCreds() Credentials {
 
 //nolint:paralleltest // t.Setenv and the package-global secure-store mock forbid parallel runs
 func TestStoreCredentialsEncryptsInAutoMode(t *testing.T) {
-	pinSecureCreds(t, "auto")
+	isolateSecureCredentials(t, "auto")
 
 	require.NoError(t, StoreCredentials(testCreds()))
 
@@ -66,7 +72,7 @@ func TestStoreCredentialsEncryptsInAutoMode(t *testing.T) {
 
 //nolint:paralleltest // t.Setenv and the package-global secure-store mock forbid parallel runs
 func TestStoreCredentialsPlaintextByDefault(t *testing.T) {
-	pinSecureCreds(t, "")
+	isolateSecureCredentials(t, "")
 
 	require.NoError(t, StoreCredentials(testCreds()))
 
@@ -80,7 +86,7 @@ func TestStoreCredentialsPlaintextByDefault(t *testing.T) {
 
 //nolint:paralleltest // t.Setenv and the package-global secure-store mock forbid parallel runs
 func TestStoreCredentialsPlaintextModeExplicit(t *testing.T) {
-	pinSecureCreds(t, "plaintext")
+	isolateSecureCredentials(t, "plaintext")
 
 	require.NoError(t, StoreCredentials(testCreds()))
 	credsFile, err := getCredsFilePath()
@@ -92,7 +98,7 @@ func TestStoreCredentialsPlaintextModeExplicit(t *testing.T) {
 
 //nolint:paralleltest // t.Setenv and the package-global secure-store mock forbid parallel runs
 func TestPlaintextFileMigratesOnWriteNotRead(t *testing.T) {
-	pinSecureCreds(t, "auto")
+	isolateSecureCredentials(t, "auto")
 
 	credsFile, err := getCredsFilePath()
 	require.NoError(t, err)
@@ -120,7 +126,7 @@ func TestPlaintextFileMigratesOnWriteNotRead(t *testing.T) {
 
 //nolint:paralleltest // t.Setenv and the package-global secure-store mock forbid parallel runs
 func TestNoMigrationWhenModeUnset(t *testing.T) {
-	pinSecureCreds(t, "")
+	isolateSecureCredentials(t, "")
 
 	credsFile, err := getCredsFilePath()
 	require.NoError(t, err)
@@ -135,12 +141,11 @@ func TestNoMigrationWhenModeUnset(t *testing.T) {
 }
 
 func TestEncryptedFileReadableRegardlessOfMode(t *testing.T) {
-	pinSecureCreds(t, "auto")
+	isolateSecureCredentials(t, "auto")
 	require.NoError(t, StoreCredentials(testCreds()))
 
 	// Reads always use the envelope's recorded backend.
 	t.Setenv("PULUMI_CREDENTIAL_STORE", "plaintext")
-	resetCredStoreForTesting()
 
 	creds, err := GetStoredCredentials()
 	require.NoError(t, err)
@@ -149,18 +154,18 @@ func TestEncryptedFileReadableRegardlessOfMode(t *testing.T) {
 
 //nolint:paralleltest // t.Setenv and the package-global secure-store mock forbid parallel runs
 func TestLostKeyProducesActionableError(t *testing.T) {
-	pinSecureCreds(t, "auto")
+	st := isolateSecureCredentials(t, "auto")
 	require.NoError(t, StoreCredentials(testCreds()))
 
-	require.NoError(t, fakeStore(t).DeleteKey())
+	require.NoError(t, st.DeleteKey())
 
 	_, err := GetStoredCredentials()
 	require.Error(t, err)
 	assert.Contains(t, err.Error(), "pulumi login")
 }
 
 func TestDeleteAllAccountsKeepsKeySharedWithOtherHomes(t *testing.T) {
-	pinSecureCreds(t, "auto")
+	isolateSecureCredentials(t, "auto")
 	homeA := os.Getenv("PULUMI_HOME")
 	require.NoError(t, StoreCredentials(testCreds()))
 
@@ -176,21 +181,20 @@ func TestDeleteAllAccountsKeepsKeySharedWithOtherHomes(t *testing.T) {
 
 //nolint:paralleltest // t.Setenv and the package-global secure-store mock forbid parallel runs
 func TestDeleteAllAccountsDropsCorruptKey(t *testing.T) {
-	pinSecureCreds(t, "auto")
+	st := isolateSecureCredentials(t, "auto")
 	require.NoError(t, StoreCredentials(testCreds()))
-	fakeStore(t).getErr = fmt.Errorf("%w: unrecognized format", securestore.ErrKeyCorrupt)
+	st.getErr = fmt.Errorf("%w: unrecognized format", securestore.ErrKeyCorrupt)
 
 	require.NoError(t, DeleteAllAccounts())
 
-	_, err := fakeStore(t).GetKey()
+	_, err := st.GetKey()
 	assert.ErrorIs(t, err, securestore.ErrKeyNotFound)
 }
 
 //nolint:paralleltest // t.Setenv and the package-global secure-store mock forbid parallel runs
 func TestDeleteAllAccountsKeepsKeyOnTransientError(t *testing.T) {
-	pinSecureCreds(t, "auto")
+	st := isolateSecureCredentials(t, "auto")
 	require.NoError(t, StoreCredentials(testCreds()))
-	st := fakeStore(t)
 	st.getErr = errors.New("dbus timeout")
 
 	require.NoError(t, DeleteAllAccounts())
@@ -202,31 +206,30 @@ func TestDeleteAllAccountsKeepsKeyOnTransientError(t *testing.T) {
 
 //nolint:paralleltest // t.Setenv and the package-global secure-store mock forbid parallel runs
 func TestDel
```

**File**: `sdk/go/common/workspace/credstorefake_test.go` (modified, +6/-8)
```diff
@@ -17,10 +17,10 @@ package workspace
 import (
 	"crypto/rand"
 	"fmt"
+	"sync"
 	"testing"
 
 	"github.com/pulumi/pulumi/sdk/v3/go/common/util/securestore"
-	"github.com/stretchr/testify/require"
 )
 
 const (
@@ -160,15 +160,13 @@ func installStores(t *testing.T, s keyStores) {
 	previous := stores
 	stores = s
 	t.Cleanup(func() { stores = previous })
-	resetCredStoreForTesting()
-	t.Cleanup(resetCredStoreForTesting)
+	resetCredentialStoreState()
+	t.Cleanup(resetCredentialStoreState)
 }
 
-func fakeStore(t *testing.T) *fakeKeyStore {
-	t.Helper()
-	fakes, ok := stores.(*fakeStores)
-	require.True(t, ok, "no fake stores installed")
-	return fakes.byBackend[fakeBackend]
+func resetCredentialStoreState() {
+	replacedEnvelope.Store(false)
+	plaintextPendingOnce = sync.Once{}
 }
 
 // The stronger backend becomes available only once promote is called.
```

---

### Incident Patch 12: `1a0e5f24` (2026-09-30)
**Commit Message**: Add l2-invoke-union-dependencies conformance test and fix PCL dep loss (#24944)

A resource whose input reads a field of an invoke's return value must
depend on the union of every resource that fed the invoke's arguments.
The new l2-invoke-union-dependencies conformance test pins that rule: a
and b flow into secretInvoke and d consumes data.response, so d must
depend on {a, b}. Go, Node (TSC) and Python already pass; PCL was
dropping deps in two places.

- pkg/pcl/runtime/convert.go: `unmark[T]` stripped every mark of type T
from the value but only returned the last one it visited, so a value
carrying more than one dependencyMark surfaced only one dep. Reworked as
`unmark[T](cty.Value) (cty.Value, []T)` and updated callers; the
boolean-flavoured poison / secret callers now just check len(marks).
- pkg/pcl/runtime/interpreter.go: getAllDependencies walked Output,
Object and Array but not Secret, so a `Secret(Output{deps=...})`
(secretInvoke.response is exactly that) hid its deps. Added the Secret
case.

---------

Co-authored-by: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `pkg/testing/pulumi-test-language/tests/l2_invoke_union_dependencies.go` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+// Copyright 2026, Pulumi Corporation.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package tests
+
+import (
+	pkgresource "github.com/pulumi/pulumi/pkg/v3/resource"
+	"github.com/pulumi/pulumi/pkg/v3/resource/plugin"
+	"github.com/pulumi/pulumi/pkg/v3/testing/pulumi-test-language/providers"
+	"github.com/stretchr/testify/require"
+)
+
+// This test pins the desired invoke-dependency semantics: a consumer of an invoke's return value
+// must depend on the union of every resource that fed the invoke's args.
+func init() {
+	LanguageTests["l2-invoke-union-dependencies"] = LanguageTest{
+		Providers: []func() plugin.Provider{
+			func() plugin.Provider { return &providers.SimpleInvokeProvider{} },
+			func() plugin.Provider { return &providers.SimpleProvider{} },
+		},
+		Runs: []TestRun{
+			{
+				Assert: func(l *L, res AssertArgs) {
+					RequireStackResource(l, res.Err, res.Changes)
+
+					var a, b, d *pkgresource.State
+					for _, r := range res.Snap.Resources {
+						switch r.URN.Name() {
+						case "a":
+							a = r
+						case "b":
+							b = r
+						case "d":
+							d = r
+						}
+					}
+					require.NotNil(l, a, "expected resource a")
+					require.NotNil(l, b, "expected resource b")
+					require.NotNil(l, d, "expected resource d")
+
+					require.Empty(l, a.Dependencies, "a has no invoke inputs")
+					require.Empty(l, b.Dependencies, "b has no invoke inputs")
+
+					// d.text was set from data.response, where data is the result of an invoke that read from both
+					// a and b. Even though `response` is derived from just `a.text`, SDKs propagate the union of
+					// all invoke arg dependencies to the result, so d must depend on both a and b.
+					require.ElementsMatch(l, []pkgresource.URN{a.URN, b.URN}, d.Dependencies,
+						"d must depend on both a and b (union of invoke arg dependencies)")
+
+					textDeps, ok := d.PropertyDependencies["text"]
+					require.True(l, ok, "expected d.PropertyDependencies to include 'text'")
+					require.ElementsMatch(l, []pkgresource.URN{a.URN, b.URN}, textDeps,
+						"d.text must be attributed to both invoke arg source resources")
+				},
+			},
+		},
+	}
+}
```

**File**: `pkg/testing/pulumi-test-language/tests/testdata/l2-invoke-union-dependencies/main.pp` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+// Baseline for invoke dependency propagation: an invoke that reads properties from two different
+// resources produces a return value whose consumer must depend on the union of both.
+
+resource "a" "simple-invoke:index:StringResource" {
+    text = "hello"
+}
+
+resource "b" "simple:index:Resource" {
+    value = true
+}
+
+data = invoke("simple-invoke:index:secretInvoke", {
+    value = a.text
+    secretResponse = b.value
+})
+
+resource "d" "simple-invoke:index:StringResource" {
+    text = data.response
+}
```

**File**: `sdk/go/pulumi-language-go/testdata/extra-types/projects/l2-invoke-union-dependencies/Pulumi.yaml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+name: l2-invoke-union-dependencies
+runtime: go
```

**File**: `sdk/go/pulumi-language-go/testdata/extra-types/projects/l2-invoke-union-dependencies/go.mod` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+module l2-invoke-union-dependencies
+
+go 1.25
+
+require (
+	github.com/pulumi/pulumi/sdk/v3 v3.30.0
+	example.com/pulumi-simple/sdk/go/v2 v2.0.0
+	example.com/pulumi-simple-invoke/sdk/go/v10 v10.0.0
+)
+
+replace github.com/pulumi/pulumi/sdk/v3 => /ROOT/artifacts/github.com_pulumi_pulumi_sdk_v3
+
+replace example.com/pulumi-simple/sdk/go/v2 => /ROOT/artifacts/example.com_pulumi-simple_sdk_go_v2
+
+replace example.com/pulumi-simple-invoke/sdk/go/v10 => /ROOT/artifacts/example.com_pulumi-simple-invoke_sdk_go_v10
```

**File**: `sdk/go/pulumi-language-go/testdata/extra-types/projects/l2-invoke-union-dependencies/main.go` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+package main
+
+import (
+	"example.com/pulumi-simple-invoke/sdk/go/v10/simpleinvoke"
+	"example.com/pulumi-simple/sdk/go/v2/simple"
+	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
+)
+
+func main() {
+	pulumi.Run(func(ctx *pulumi.Context) error {
+		// Baseline for invoke dependency propagation: an invoke that reads properties from two different
+		// resources produces a return value whose consumer must depend on the union of both.
+		a, err := simpleinvoke.NewStringResource(ctx, "a", &simpleinvoke.StringResourceArgs{
+			Text: pulumi.String("hello"),
+		})
+		if err != nil {
+			return err
+		}
+		b, err := simple.NewResource(ctx, "b", &simple.ResourceArgs{
+			Value: pulumi.Bool(true),
+		})
+		if err != nil {
+			return err
+		}
+		data := simpleinvoke.SecretInvokeOutput(ctx, simpleinvoke.SecretInvokeOutputArgs{
+			Value:          a.Text,
+			SecretResponse: b.Value,
+		}, nil)
+		_, err = simpleinvoke.NewStringResource(ctx, "d", &simpleinvoke.StringResourceArgs{
+			Text: data.Response(),
+		})
+		if err != nil {
+			return err
+		}
+		return nil
+	})
+}
```

**File**: `sdk/go/pulumi-language-go/testdata/local/projects/l2-invoke-union-dependencies/Pulumi.yaml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+name: l2-invoke-union-dependencies
+runtime: go
```

**File**: `sdk/go/pulumi-language-go/testdata/local/projects/l2-invoke-union-dependencies/go.mod` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+module l2-invoke-union-dependencies
+
+go 1.25
+
+require (
+	github.com/pulumi/pulumi/sdk/v3 v3.30.0
+	example.com/pulumi-simple/sdk/go/v2 v2.0.0
+	example.com/pulumi-simple-invoke/sdk/go/v10 v10.0.0
+)
+
+replace github.com/pulumi/pulumi/sdk/v3 => /ROOT/artifacts/github.com_pulumi_pulumi_sdk_v3
+
+replace example.com/pulumi-simple/sdk/go/v2 => /ROOT/projects/l2-invoke-union-dependencies/sdks/simple-2.0.0
+
+replace example.com/pulumi-simple-invoke/sdk/go/v10 => /ROOT/projects/l2-invoke-union-dependencies/sdks/simple-invoke-10.0.0
```

**File**: `sdk/go/pulumi-language-go/testdata/local/projects/l2-invoke-union-dependencies/main.go` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+package main
+
+import (
+	"example.com/pulumi-simple-invoke/sdk/go/v10/simpleinvoke"
+	"example.com/pulumi-simple/sdk/go/v2/simple"
+	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
+)
+
+func main() {
+	pulumi.Run(func(ctx *pulumi.Context) error {
+		// Baseline for invoke dependency propagation: an invoke that reads properties from two different
+		// resources produces a return value whose consumer must depend on the union of both.
+		a, err := simpleinvoke.NewStringResource(ctx, "a", &simpleinvoke.StringResourceArgs{
+			Text: pulumi.String("hello"),
+		})
+		if err != nil {
+			return err
+		}
+		b, err := simple.NewResource(ctx, "b", &simple.ResourceArgs{
+			Value: pulumi.Bool(true),
+		})
+		if err != nil {
+			return err
+		}
+		data := simpleinvoke.SecretInvokeOutput(ctx, simpleinvoke.SecretInvokeOutputArgs{
+			Value:          a.Text,
+			SecretResponse: b.Value,
+		}, nil)
+		_, err = simpleinvoke.NewStringResource(ctx, "d", &simpleinvoke.StringResourceArgs{
+			Text: data.Response(),
+		})
+		if err != nil {
+			return err
+		}
+		return nil
+	})
+}
```

---

### Incident Patch 13: `8d2265b5` (2026-09-30)
**Commit Message**: Fix concurrent `pulumi new` runs failing to clone the templates repository (#24939)

## Summary

Fixes #21285.

`pulumi new` keeps the templates repository in a directory that every
pulumi process shares (`~/.pulumi/templates` by default), and nothing
stopped two processes from preparing it at the same time. Before
cloning, `retrievePulumiTemplates` calls `cleanupLegacyTemplateDir`,
which deletes the directory whenever `git.PlainOpen` cannot open it. A
clone that another process has only just started looks exactly like
that, so it gets deleted under that process, and two clones into the
same directory also collide. That is where the errors in the issue come
from.

This takes an `fsutil.FileMutex` on `<templateDir>.lock` around the
cleanup, the `MkdirAll` and the clone or pull. The lock file sits next
to the directory rather than inside it, the same way `atomicinstall`
locks plugin directories. Inside, it would make the first clone fail,
and the cleanup would delete it.

The lock is best effort. If it cannot be taken, for example next to a
read-only template cache used with `--offline`, or on a filesystem
without flock, pulumi logs the error at debug level and carries on
without it,

**File**: `changelog/pending/cli-new-fix-20260930-151725.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: cli/new
+kind: fix
+body: Fix concurrent `pulumi new` runs failing to clone the templates repository
+time: 2026-09-30T15:17:25.065953+09:00
```

**File**: `pkg/cmd/pulumi/templates/project_templates.go` (modified, +18/-5)
```diff
@@ -32,6 +32,7 @@ import (
 
 	"github.com/pulumi/pulumi/sdk/v3/go/common/env"
 	"github.com/pulumi/pulumi/sdk/v3/go/common/util/contract"
+	"github.com/pulumi/pulumi/sdk/v3/go/common/util/fsutil"
 	"github.com/pulumi/pulumi/sdk/v3/go/common/util/gitutil"
 	"github.com/pulumi/pulumi/sdk/v3/go/common/workspace"
 
@@ -384,17 +385,29 @@ func retrieveFileTemplates(path string) (TemplateRepository, error) {
 func retrievePulumiTemplates(
 	ctx context.Context, offline bool, templateKind TemplateKind,
 ) (TemplateRepository, error) {
-	// Cleanup the template directory.
-	if err := cleanupLegacyTemplateDir(templateKind); err != nil {
-		return TemplateRepository{}, err
-	}
-
 	// Get the template directory.
 	templateDir, err := GetTemplateDir(templateKind)
 	if err != nil {
 		return TemplateRepository{}, err
 	}
 
+	// Concurrent pulumi processes share this directory, and the cleanup below would delete a clone in progress.
+	lockPath := filepath.Clean(templateDir) + ".lock"
+	if err := os.MkdirAll(filepath.Dir(lockPath), 0o700); err != nil {
+		return TemplateRepository{}, err
+	}
+	mutex := fsutil.NewFileMutex(lockPath)
+	if err := mutex.Lock(); err != nil {
+		slog.Debug("Could not lock the template directory", "path", lockPath, "err", err)
+	} else {
+		defer func() { _ = mutex.Unlock() }()
+	}
+
+	// Cleanup the template directory.
+	if err := cleanupLegacyTemplateDir(templateKind); err != nil {
+		return TemplateRepository{}, err
+	}
+
 	// Ensure the template directory exists.
 	if err := os.MkdirAll(templateDir, 0o700); err != nil {
 		return TemplateRepository{}, err
```

**File**: `pkg/cmd/pulumi/templates/project_templates_test.go` (modified, +43/-0)
```diff
@@ -18,8 +18,13 @@ import (
 	"fmt"
 	"os"
 	"path/filepath"
+	"sync"
 	"testing"
+	"time"
 
+	"github.com/go-git/go-git/v6"
+	"github.com/go-git/go-git/v6/config"
+	"github.com/go-git/go-git/v6/plumbing/object"
 	"github.com/pulumi/pulumi/sdk/v3/go/common/env"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
@@ -433,6 +438,44 @@ func TestRetrieveFileTemplate(t *testing.T) {
 	}
 }
 
+func TestRetrievePulumiTemplatesConcurrently(t *testing.T) {
+	source := t.TempDir()
+	repo, err := git.PlainInit(source, false)
+	require.NoError(t, err)
+	// go-git honors the user's commit.gpgSign, so turn it off for this scratch repo.
+	cfg, err := repo.Config()
+	require.NoError(t, err)
+	cfg.Commit.GpgSign = config.OptBoolFalse
+	require.NoError(t, repo.SetConfig(cfg))
+	require.NoError(t, os.WriteFile(filepath.Join(source, "Pulumi.yaml"), []byte("name: test\n"), 0o600))
+	worktree, err := repo.Worktree()
+	require.NoError(t, err)
+	_, err = worktree.Add("Pulumi.yaml")
+	require.NoError(t, err)
+	_, err = worktree.Commit("initial", &git.CommitOptions{
+		Author: &object.Signature{Name: "test", Email: "test@example.com", When: time.Now()},
+	})
+	require.NoError(t, err)
+	head, err := repo.Head()
+	require.NoError(t, err)
+
+	t.Setenv(env.TemplateGitRepository.Var().Name(), source)
+	t.Setenv(env.TemplateBranch.Var().Name(), head.Name().Short())
+	t.Setenv(env.TemplatePath.Var().Name(), filepath.Join(t.TempDir(), "templates"))
+
+	errs := make([]error, 8)
+	var wg sync.WaitGroup
+	for i := range errs {
+		wg.Go(func() {
+			_, errs[i] = retrievePulumiTemplates(t.Context(), false, TemplateKindPulumiProject)
+		})
+	}
+	wg.Wait()
+	for _, err := range errs {
+		require.NoError(t, err)
+	}
+}
+
 //nolint:paralleltest
 func TestCopyTemplateFiles(t *testing.T) {
 	t.Parallel()
```

---

### Incident Patch 14: `db45d040` (2026-09-30)
**Commit Message**: Fix up a comment to be accurate (#24941)

This comment was out of date after the `property.Map` migrations.

**File**: `pkg/resource/deploy/source_eval.go` (modified, +3/-2)
```diff
@@ -2959,8 +2959,9 @@ func (rm *resmon) RegisterResource(ctx context.Context,
 			},
 		}
 
-		// The provider may have returned OutputValues in "Outputs", we need to downgrade them to Computed or
-		// Secret but also add them to the outputDeps map.
+		// The provider may have returned OutputValues in "Outputs". Harvest their dependencies into the
+		// outputDeps map; the OutputValues themselves are downgraded to Computed/Secret later by
+		// MarshalProperties (called without KeepOutputValues) before being sent back to the SDK.
 		if constructResult.OutputDependencies == nil {
 			constructResult.OutputDependencies = map[resource.PropertyKey][]resource.URN{}
 		}
```

---

### Incident Patch 15: `0cb5418f` (2026-09-30)
**Commit Message**: Fix property dependency leak across inputs when SDK omits propertyDependencies (#24937)

When a `RegisterResource` request omits `propertyDependencies` and the
engine backfills each property with the request's flat `dependencies`
list, every property was aliased to the same underlying set instance.
The subsequent pass that walks input Output values and merges their
dependencies into the appropriate property's set therefore mutated the
shared set, causing every Output value's dependencies to bleed into
every other property of the same resource.

This PR fixes it so we clone the set per property so each input's
dependency merge stays isolated.

This isn't reachable through any SDK today: the standard test harness
(and every real SDK) downgrades Output values on the wire for custom
resources, which stops the merge pass from finding any dependencies to
add. It becomes reachable as soon as an SDK starts sending Output-valued
inputs for custom resources — hence the fix and a regression test.

## Changes

- `deploytest.ResourceOptions` gains a `KeepOutputValues` field so tests
can simulate an SDK that preserves Output values on custom-resource
inputs (real SDKs only do this for remote/com

**File**: `pkg/engine/lifecycletest/delete_before_replace_test.go` (modified, +66/-0)
```diff
@@ -297,6 +297,72 @@ func TestPropertyDependenciesAdapter(t *testing.T) {
 	}
 }
 
+// TestPropertyDependenciesBackfillDoesNotLeakAcrossProperties exercises the engine's per-property dependency
+// backfill when a resource is registered with no explicit propertyDependencies but its inputs carry Output
+// property values with dependencies of their own. Each input's dependencies must stay isolated to that input;
+// a shared underlying set would cause one property's Output dependencies to bleed into every other property.
+func TestPropertyDependenciesBackfillDoesNotLeakAcrossProperties(t *testing.T) {
+	t.Parallel()
+
+	loaders := []*deploytest.ProviderLoader{
+		deploytest.NewProviderLoader("pkgA", semver.MustParse("1.0.0"), func() (plugin.Provider, error) {
+			return &deploytest.Provider{}, nil
+		}),
+	}
+
+	const resType = "pkgA:m:typA"
+	var urnA, urnB, urnC resource.URN
+	programF := deploytest.NewLanguageRuntimeF(func(_ plugin.RunInfo, monitor *deploytest.ResourceMonitor) error {
+		respA, err := monitor.RegisterResource(resType, "A", true, deploytest.ResourceOptions{})
+		require.NoError(t, err)
+		urnA = respA.URN
+
+		respB, err := monitor.RegisterResource(resType, "B", true, deploytest.ResourceOptions{})
+		require.NoError(t, err)
+		urnB = respB.URN
+
+		// Register C with two inputs, each of which is an Output value pointing at a *different* upstream
+		// resource. No flat Dependencies or PropertyDeps are sent, so the engine backfills per-property
+		// dependencies and then merges the Output-value dependencies in. propA should depend only on A and
+		// propB only on B.
+		respC, err := monitor.RegisterResource(resType, "C", true, deploytest.ResourceOptions{
+			Inputs: resource.PropertyMap{
+				"propA": resource.NewProperty(resource.Output{
+					Element:      resource.NewProperty("a"),
+					Known:        true,
+					Dependencies: []resource.URN{urnA},
+				}),
+				"propB": resource.NewProperty(resource.Output{
+					Element:      resource.NewProperty("b"),
+					Known:        true,
+					Dependencies: []resource.URN{urnB},
+				}),
+			},
+			KeepOutputValues: true,
+		})
+		require.NoError(t, err)
+		urnC = respC.URN
+
+		return nil
+	})
+
+	hostF := deploytest.NewPluginHostF(nil, nil, programF, nil, nil, loaders...)
+	p := &lt.TestPlan{
+		Options: lt.TestUpdateOptions{T: t, HostF: hostF, SkipDisplayTests: true},
+		Steps:   []lt.TestStep{{Op: Update}},
+	}
+	snap := p.Run(t, nil)
+	for _, res := range snap.Resources {
+		if res.URN != urnC {
+			continue
+		}
+		assert.ElementsMatch(t, []resource.URN{urnA}, res.PropertyDependencies["propA"],
+			"propA should only depend on A, not on B")
+		assert.ElementsMatch(t, []resource.URN{urnB}, res.PropertyDependencies["propB"],
+			"propB should only depend on B, not on A")
+	}
+}
+
 func TestExplicitDeleteBeforeReplace(t *testing.T) {
 	t.Parallel()
 
```

**File**: `pkg/resource/deploy/deploytest/resourcemonitor.go` (modified, +6/-1)
```diff
@@ -449,6 +449,11 @@ type ResourceOptions struct {
 	DisableResourceReferences bool
 	GrpcRequestHeaders        map[string]string
 
+	// KeepOutputValues, if set, preserves Output property values on the marshalled inputs sent to the resource
+	// monitor. Real SDKs only do this for remote (component) resources today, but the test harness allows it for
+	// custom resources too so we can exercise engine paths that handle unusual SDK behaviour.
+	KeepOutputValues bool
+
 	Transforms           []*pulumirpc.Callback
 	StateMigrations      []*pulumirpc.Callback
 	ResourceHookBindings ResourceHookBindings
@@ -495,7 +500,7 @@ func (rm *ResourceMonitor) RegisterResource(t tokens.Type, name string, custom b
 		KeepUnknowns:     true,
 		KeepSecrets:      rm.supportsSecrets,
 		KeepResources:    rm.supportsResourceReferences,
-		KeepOutputValues: opts.Remote,
+		KeepOutputValues: opts.Remote || opts.KeepOutputValues,
 		KeepByteString:   true,
 	})
 	if err != nil {
```

**File**: `pkg/resource/deploy/source_eval.go` (modified, +3/-1)
```diff
@@ -2417,8 +2417,10 @@ func (rm *resmon) RegisterResource(ctx context.Context,
 		// If this request did not specify property dependencies, treat each property as depending on every resource
 		// in the request's dependency list. We don't need to do this when remote is true, because all clients that
 		// support remote already support passing property dependencies, so there's no need to backfill here.
+		// Clone so that downstream code merging a property's Output-value dependencies into its set does not
+		// leak those dependencies into every other property via a shared underlying set instance.
 		for pk := range props {
-			propertyDependencies[pk] = dependencies
+			propertyDependencies[pk] = dependencies.Clone()
 		}
 	} else {
 		// Otherwise, unmarshal the per-property dependency information.
```

#### Recent Merged Pull Requests:
- **PR #25036** (closed): Honor neoTaskCreationDisabled from Pulumi Cloud (@VenelinMartinov)
- **PR #25035** (2026-10-05): Move MassageSecrets to property.Map (@Frassle)
- **PR #25034** (2026-10-05): Update dependency pulumi/pulumi-dotnet to v3.114.2 (@pulumi-renovate[bot])
- **PR #25032** (2026-10-05): hash bytes returned with io.EOF in plugin checksumReader (@SABITHSAHEB)
- **PR #25030** (2026-10-05): Remove the timeout from the `pulumi new` credentials check (@VenelinMartinov)
- **PR #25028** (2026-10-05): Upgrade `github.com/go-git/go-git/v6` to v6.0.0-beta.1 (@iwahbe)
- **PR #25027** (2026-10-05): Update first-party Pulumi dependencies (@pulumi-renovate[bot])
- **PR #25024** (2026-10-05): Add `whoami` to the generated automation APIs (@i-am-tom)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

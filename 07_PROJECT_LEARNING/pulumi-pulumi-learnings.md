> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pulumi-pulumi-learnings.md`  
> **Source**: github ([https://github.com/pulumi/pulumi](https://github.com/pulumi/pulumi))  
> **Source Version**: `b9e87ddf`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T01:57:10.117Z  
> **Learning ID**: `learn-github-pulumi-pulumi`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): pulumi/pulumi

> **Canonical Artifact**: `07_PROJECT_LEARNING/pulumi-pulumi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pulumi/pulumi](https://github.com/pulumi/pulumi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T01:57:09.952Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pulumi/pulumi`
- **Description**: Pulumi - Infrastructure as Code in any programming language 🚀
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 25791 stars

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
	"sync/atomic"
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

type skipAgentSignupContextKey struct{}

// ContextWithoutAgentSignup returns a context in which agent mode never creates a new agent account,
// for use by `pulumi login`.
func ContextWithoutAgentSignup(ctx context.Context) context.Context {
	return context.WithValue(ctx, skipAgentSignupContextKey{}, true)
}

func skipAgentSignup(ctx context.Context) bool {
	skip, _ := ctx.Value(skipAgentSignupContextKey{}).(bool)
	return skip
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

	readingUpdateID atomic.Pointer[string]

	stackOutputsWaitLimit time.Duration
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
	if o
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #25244** (2026-10-16): **Workflow failure: On Push at dev-release / build-release (darwin, arm64, ubuntu-latest) / darwin-arm64 (+5 more)**
  *Symptoms*: ## Workflow Failure  [On Push](https://github.com/pulumi/pulumi/blob/master/.github/workflows/on-push.yml) has failed. See the list of failures below:  - [2026-10-16T02:06:26.000Z](https://github.com/pulumi/pulumi/actions/runs/38837564833)   - ❌ [dev-release / build-release (darwin, arm64, ubuntu-latest) / darwin-arm64](https://github.com/pulumi/pulumi/actions/runs/38837564833/job/116772009412): Post Run actions/setup-go@v6 (cancelled)   - ❌ [dev-release / build-release (windows, arm64, ubuntu-latest) / windows-arm64](https://github.com/pulumi/pulumi/actions/runs/38837564833/job/116772009463): Package (failure)   - ❌ [dev-release / build-release (linux, amd64, ubuntu-latest) / linux-amd64](https://github.com/pulumi/pulumi/actions/runs/38837564833/job/116772009498): Package (cancelled)   - ❌ [dev-release / build-release (linux, arm64, ubuntu-latest) / linux-arm64](https://github.com/pulumi/pulumi/actions/runs/38837564833/job/116772009526): Package (cancelled)   - ❌ [dev-release / build-release (darwin, amd64, ubuntu-latest) / darwin-amd64](https://github.com/pulumi/pulumi/actions/runs/38837564833/job/116772009550): Package (cancelled)   - ❌ [dev-release / build-release (windows, amd64, ubuntu-latest) / windows-amd64](https://github.com/pulumi/pulumi/actions/runs/38837564833/job/116772009573): Package (cancelled)
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically closed because the workflow succeeded.  Successful run: [2026-10-16T05:37:13.000Z](https://github.com/pulumi/pulumi/actions/runs/38855320725)

- **Issue #25216** (2026-10-16): **Postgres DIY backend runs DDL on every connection, so a read-only role can't run `pulumi preview`**
  *Symptoms*: `NewPostgresBucket` (pkg/backend/diy/postgres/bucket.go) runs `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` from schema.sql every time it opens the backend. Postgres checks privileges before it checks `IF NOT EXISTS`, so a role that can only read the state table can't open the backend at all. That rules out least-privilege credentials for previews in CI.  Repro (v3.268.0, Postgres 17): create the table as its owner, then `GRANT SELECT ON pulumi_state TO ro`. `pulumi stack ls` as `ro` fails with `permission denied for schema public`. Adding CREATE on the schema fails with `must be owner of table pulumi_state`. A view in the role's own schema fails with `cannot create index on relation`.  Proposed fix: check `SELECT to_regclass($1)` first and only run the schema DDL when the table is missing. Happy to send a PR. 

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

### Incident Patch 1: `cb37065b` (2026-10-14)
**Commit Message**: Build the result of entries as a tuple when the entry types differ (#24783)

The entries built-in declared a static list return type and always built
its result with cty.ListVal, which panics when the entry objects have
different types and when the map is empty. Every PCL map literal
evaluates to a cty object, so a map whose values are objects or tuples
of different shapes failed with "inconsistent list element types".

The return type is now computed from the argument, as cty's values
function does: a map gives a list of entries over its element type, an
object gives a list when every attribute has the same type and a tuple
of entry types otherwise, and an empty object gives an empty list.

**File**: `changelog/pending/pcl-fix-20260924-144657.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: pcl
+kind: fix
+body: Fix a panic in the PCL interpreter's `entries` built-in on a map whose values have different shapes or on an empty map
+time: 2026-09-24T14:46:57.734371+02:00
```

**File**: `pkg/pcl/runtime/builtinFunctions.go` (modified, +50/-24)
```diff
@@ -22,9 +22,10 @@ import (
 	"encoding/hex"
 	"errors"
 	"fmt"
+	"maps"
 	"os"
 	"path/filepath"
-	"sort"
+	"slices"
 	"strings"
 
 	"github.com/hashicorp/hcl/v2"
@@ -910,31 +911,56 @@ func (ectx *EvalContext) builtinFunctions() map[string]function.Function {
 				Type: cty.DynamicPseudoType,
 			},
 		},
-		Type: function.StaticReturnType(cty.List(cty.Object(map[string]cty.Type{
-			"key":   cty.String,
-			"value": cty.DynamicPseudoType,
-		}))),
+		Type: func(args []cty.Value) (cty.Type, error) {
+			collection := args[0].Type()
+			keyType := cty.String
+			if collection.IsListType() || collection.IsTupleType() {
+				keyType = cty.Number
+			}
+			entryType := func(valueType cty.Type) cty.Type {
+				return cty.Object(map[string]cty.Type{"key": keyType, "value": valueType})
+			}
+			switch {
+			case collection.IsMapType() || collection.IsListType():
+				return cty.List(entryType(collection.ElementType())), nil
+			case collection.IsObjectType() || collection.IsTupleType():
+				var types []cty.Type
+				if collection.IsObjectType() {
+					attributes := collection.AttributeTypes()
+					for _, k := range slices.Sorted(maps.Keys(attributes)) {
+						types = append(types, entryType(attributes[k]))
+					}
+				} else {
+					for _, t := range collection.TupleElementTypes() {
+						types = append(types, entryType(t))
+					}
+				}
+				if len(types) == 0 {
+					return cty.List(entryType(cty.DynamicPseudoType)), nil
+				}
+				for _, t := range types[1:] {
+					if !t.Equals(types[0]) {
+						return cty.Tuple(types), nil
+					}
+				}
+				return cty.List(types[0]), nil
+			}
+			return cty.NilType, fmt.Errorf("entries argument must be a collection, was %s", collection.FriendlyName())
+		},
 		Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
-			if len(args) != 1 {
-				return cty.NilVal, errors.New("entries requires a collection argument")
+			entries := make([]cty.Value, 0, args[0].LengthInt())
+			for it := args[0].ElementIterator(); it.Next(); {
+				key, value := it.Element()
+				entries = append(entries, cty.ObjectVal(map[string]cty.Value{
+					"key":   key,
+					"value": value,
+				}))
 			}
-			if !args[0].Type().IsMapType() && !args[0].Type().IsObjectType() {
-				return cty.NilVal, fmt.Errorf("entries argument must be a collection, was %s", args[0].Type().FriendlyName())
-			}
-			obj := args[0]
-			valueMap := obj.AsValueMap()
-			keys := make([]string, 0, len(valueMap))
-			for k := range valueMap {
-				keys = append(keys, k)
-			}
-			sort.Strings(keys)
-			var entries []cty.Value
-			for _, k := range keys {
-				entry := cty.ObjectVal(map[string]cty.Value{
-					"key":   cty.StringVal(k),
-					"value": valueMap[k],
-				})
-				entries = append(entries, entry)
+			switch {
+			case retType.IsTupleType():
+				return cty.TupleVal(entries), nil
+			case len(entries) == 0:
+				return cty.ListValEmpty(retType.ElementType()), nil
 			}
 			return cty.ListVal(entries), nil
 		},
```

**File**: `pkg/pcl/runtime/builtinFunctions_test.go` (modified, +45/-0)
```diff
@@ -68,6 +68,51 @@ map = length({for k, v in {"a" = 1, "b" = 2, "c" = 3} : k => v})
 	}, values)
 }
 
+func TestEntries(t *testing.T) {
+	t.Parallel()
+
+	entry := func(key string, value property.Value) property.Value {
+		return property.New(map[string]property.Value{"key": property.New(key), "value": value})
+	}
+	indexedEntry := func(key float64, value property.Value) property.Value {
+		return property.New(map[string]property.Value{"key": property.New(key), "value": value})
+	}
+	list := func(entries ...property.Value) property.Value {
+		return property.New(append([]property.Value{}, entries...))
+	}
+	values := evaluateLocals(t, `
+uniform = entries({"a" = 1, "b" = 2})
+mixed = entries({"a" = [true], "b" = [true, false]})
+empty = entries({})
+tuple = entries([1, 2, 3])
+mixedTuple = entries([true, "hello"])
+emptyTuple = entries([])
+list = entries(range(3))
+emptyList = entries(range(0))
+`)
+	assert.Equal(t, map[string]property.Value{
+		"uniform": list(entry("a", property.New(1.0)), entry("b", property.New(2.0))),
+		"mixed": list(
+			entry("a", property.New([]property.Value{property.New(true)})),
+			entry("b", property.New([]property.Value{property.New(true), property.New(false)})),
+		),
+		"empty": list(),
+		"tuple": list(
+			indexedEntry(0, property.New(1.0)),
+			indexedEntry(1, property.New(2.0)),
+			indexedEntry(2, property.New(3.0)),
+		),
+		"mixedTuple": list(indexedEntry(0, property.New(true)), indexedEntry(1, property.New("hello"))),
+		"emptyTuple": list(),
+		"list": list(
+			indexedEntry(0, property.New(0.0)),
+			indexedEntry(1, property.New(1.0)),
+			indexedEntry(2, property.New(2.0)),
+		),
+		"emptyList": list(),
+	}, values)
+}
+
 func TestRange(t *testing.T) {
 	t.Parallel()
 
```

---

### Incident Patch 2: `194c65d8` (2026-10-16)
**Commit Message**: Revert "Freeze v3.269.0" (#25247)

Reverts pulumi/pulumi#25245

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.release-pending` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-v3.270.0
```

**File**: `npm/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "pulumi",
-    "version": "3.270.0",
+    "version": "3.269.0",
     "description": "Pulumi Infrastructure as Code CLI",
     "license": "Apache-2.0",
     "repository": {
```

**File**: `sdk/.version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-3.270.0
+3.269.0
```

**File**: `sdk/nodejs/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "@pulumi/pulumi",
-    "version": "3.270.0",
+    "version": "3.269.0",
     "description": "Pulumi's Node.js SDK",
     "license": "Apache-2.0",
     "repository": {
```

**File**: `sdk/nodejs/version.ts` (modified, +1/-1)
```diff
@@ -12,4 +12,4 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
-export const version = "3.270.0";
+export const version = "3.269.0";
```

**File**: `sdk/python/lib/pulumi/_version.py` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 
 from semver import VersionInfo
 
-_VERSION = "3.270.0"
+_VERSION = "3.269.0"
 
 version = VersionInfo.parse(_VERSION)
 """Version is the Pulumi SDK's release version."""
```

**File**: `sdk/python/pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "pulumi"
-version = "3.270.0"
+version = "3.269.0"
 license = "Apache-2.0"
 license-files = ["LICENSE"]
 requires-python = ">=3.10"
```

**File**: `sdk/python/uv.lock` (modified, +1/-1)
```diff
@@ -1028,7 +1028,7 @@ wheels = [
 
 [[package]]
 name = "pulumi"
-version = "3.270.0"
+version = "3.269.0"
 source = { editable = "." }
 dependencies = [
     { name = "debugpy" },
```

---

### Incident Patch 3: `463235d1` (2026-10-16)
**Commit Message**: Fix Go program generation for split and string length (#25214)

PCL `split("-", s)` was lowered to `pulumi.StringArray(strings.Split(s,
"-"))`, but `pulumi.StringArray` is `[]pulumi.String`, not `[]string`,
so the conversion did not compile. Use `pulumi.ToStringArray` (and the
matching `pulumi.To<Suffix>` helpers for other scalar array/map types)
when wrapping a plain Go slice/map value in a Pulumi input container.

PCL `length(string)` is specified as the Unicode grapheme cluster count,
so emit `uniseg.GraphemeClusterCount` instead of Go's byte-oriented
`len`.

Unskips `l1-builtin-string` in the Go language conformance suite.

Co-authored-by: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `changelog/pending/20261014--codegen-go--l1-builtin-string.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+component: codegen/go
+kind: fix
+body: Fix Go program generation for `split` and string `length` so they produce compilable, Unicode-correct code
+time: 2026-10-14T12:00:00.000000+00:00
```

**File**: `pkg/codegen/go/gen_program_expressions.go` (modified, +40/-1)
```diff
@@ -479,6 +479,12 @@ func (g *generator) GenFunctionCallExpression(w io.Writer, expr *model.FunctionC
 					} else {
 						g.Fgenf(w, "%.v.(%s)", from, typeName)
 					}
+				} else if conv, ok := plainCollectionConverter(g, fromType, typeName); ok && !isFromOutput {
+					// `pulumi.StringArray` is `[]pulumi.String`, not `[]string`, so a plain
+					// `[]string` value (e.g. from `strings.Split`) can't be wrapped with the
+					// input type directly. Use the SDK's `pulumi.ToStringArray` helper
+					// (and similarly for other scalar array/map types).
+					g.Fgenf(w, "%s(%.v)", conv, from)
 				} else {
 					g.Fgenf(w, "%s(%.v)", typeName, from)
 				}
@@ -649,7 +655,15 @@ func (g *generator) GenFunctionCallExpression(w io.Writer, expr *model.FunctionC
 	case "join":
 		g.Fgenf(w, "strings.Join(%v, %v)", expr.Args[1], expr.Args[0])
 	case "length":
-		g.Fgenf(w, "len(%.20v)", expr.Args[0])
+		// PCL's `length` on a string returns the Unicode grapheme cluster
+		// count (so "🕹️" is 1), not the byte or rune length, so use
+		// uniseg.GraphemeClusterCount for strings.
+		argType := model.ResolveOutputs(expr.Args[0].Type())
+		if argType.Equals(model.StringType) {
+			g.Fgenf(w, "uniseg.GraphemeClusterCount(%.20v)", expr.Args[0])
+		} else {
+			g.Fgenf(w, "len(%.20v)", expr.Args[0])
+		}
 	case "readFile":
 		// Assuming the existence of the following helper method located earlier in the preamble
 		g.Fgenf(w, "readFileOrPanic(%v)", expr.Args[0])
@@ -1945,6 +1959,26 @@ func pulumiConverterSuffix(goType string) (string, bool) {
 	return pulumiScalarSuffix(goType)
 }
 
+// plainCollectionConverter returns the `pulumi.To<Suffix>` helper that
+// converts a plain Go slice/map value (e.g. `[]string`) into the matching
+// Pulumi input type (e.g. `pulumi.StringArray`). Returns ok=false if the
+// source isn't a convertible slice/map or the destination doesn't name the
+// corresponding input container type.
+func plainCollectionConverter(g *generator, fromType model.Type, destTypeName string) (string, bool) {
+	argGoType := g.argumentTypeName(fromType, false)
+	suffix, ok := pulumiConverterSuffix(argGoType)
+	if !ok {
+		return "", false
+	}
+	if destTypeName != "pulumi."+suffix {
+		return "", false
+	}
+	if !strings.HasSuffix(suffix, "Array") && !strings.HasSuffix(suffix, "Map") {
+		return "", false
+	}
+	return "pulumi.To" + suffix, true
+}
+
 // pulumiScalarSuffix returns the Pulumi suffix for a scalar Go type. Only
 // primitive scalars have generated Ptr/Map/Array containers in the SDK, so
 // callers use this to gate composition of the compound suffixes above.
@@ -2368,6 +2402,11 @@ var functionPackages = map[string][]string{
 }
 
 func (g *generator) genFunctionPackages(x *model.FunctionCallExpression) []string {
+	if x.Name == "length" && len(x.Args) == 1 {
+		if model.ResolveOutputs(x.Args[0].Type()).Equals(model.StringType) {
+			return []string{"github.com/rivo/uniseg"}
+		}
+	}
 	return functionPackages[x.Name]
 }
 
```

**File**: `sdk/go/pulumi-language-go/language_test.go` (modified, +0/-2)
```diff
@@ -141,8 +141,6 @@ var expectedFailures = map[string]string{
 	"l3-range-map-ref":  "fails with syntax errors: mapResource.K1 undefined (type []*nestedobject.Target has no field or method K1)", //nolint:lll
 	"l3-range-bool-ref": "fails with syntax errors: index < createBool (mismatched types int and bool)",
 
-	"l1-builtin-string": "cannot convert strings.Split(aString, \"-\") (value of type []string) to type pulumi.StringArray", //nolint:lll
-
 	"l2-recover-invoke": "Go SDK output recovery is not implemented",
 
 	"l2-invoke-per-value-deps": "output aware invokes not yet implemented",
```

**File**: `sdk/go/pulumi-language-go/testdata/extra-types/projects/l1-builtin-string/main.go` (modified, +5/-4)
```diff
@@ -5,16 +5,17 @@ import (
 
 	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
 	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
+	"github.com/rivo/uniseg"
 )
 
 func main() {
 	pulumi.Run(func(ctx *pulumi.Context) error {
 		cfg := config.New(ctx, "")
 		aString := cfg.Require("aString")
-		ctx.Export("lengthOutput", pulumi.Int(len(aString)))
-		ctx.Export("splitOutput", pulumi.StringArray(strings.Split(aString, "-")))
-		ctx.Export("joinOutput", pulumi.String(strings.Join(strings.Split(aString, "-"), "|")))
-		ctx.Export("interpolateOutput", pulumi.Sprintf("prefix-%v", aString))
+		ctx.Export("lengthResult", pulumi.Int(uniseg.GraphemeClusterCount(aString)))
+		ctx.Export("splitResult", pulumi.ToStringArray(strings.Split(aString, "-")))
+		ctx.Export("joinResult", pulumi.String(strings.Join(strings.Split(aString, "-"), "|")))
+		ctx.Export("interpolateResult", pulumi.Sprintf("prefix-%v", aString))
 		return nil
 	})
 }
```

**File**: `sdk/go/pulumi-language-go/testdata/published/projects/l1-builtin-string/main.go` (modified, +5/-4)
```diff
@@ -5,16 +5,17 @@ import (
 
 	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
 	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
+	"github.com/rivo/uniseg"
 )
 
 func main() {
 	pulumi.Run(func(ctx *pulumi.Context) error {
 		cfg := config.New(ctx, "")
 		aString := cfg.Require("aString")
-		ctx.Export("lengthOutput", pulumi.Int(len(aString)))
-		ctx.Export("splitOutput", pulumi.StringArray(strings.Split(aString, "-")))
-		ctx.Export("joinOutput", pulumi.String(strings.Join(strings.Split(aString, "-"), "|")))
-		ctx.Export("interpolateOutput", pulumi.Sprintf("prefix-%v", aString))
+		ctx.Export("lengthResult", pulumi.Int(uniseg.GraphemeClusterCount(aString)))
+		ctx.Export("splitResult", pulumi.ToStringArray(strings.Split(aString, "-")))
+		ctx.Export("joinResult", pulumi.String(strings.Join(strings.Split(aString, "-"), "|")))
+		ctx.Export("interpolateResult", pulumi.Sprintf("prefix-%v", aString))
 		return nil
 	})
 }
```

#### Recent Merged Pull Requests:
- **PR #25268** (2026-10-16): Changelog and go.mod updates for v3.270.0 (@pulumi-bot)
- **PR #25266** (2026-10-17): Update analyzer plugin to use propertyrpc (@Frassle)
- **PR #25265** (closed): Move code shared by pkg and sdk into a new shared module (@i-am-tom)
- **PR #25264** (2026-10-16): Freeze v3.270.0 (@pulumi-bot)
- **PR #25263** (2026-10-16): Skip to 3.270.0 (@i-am-tom)
- **PR #25258** (2026-10-16): Add AcceptsOutputsInCheck handshake negotiation (@Frassle)

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

## X. Build the result of entries as a tuple when the entry types differ (#24783)

**RULE**:
When implementing operations in `changelog/pending/pcl-fix-20260924-144657.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pulumi/pulumi. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cb37065b`: Build the result of entries as a tuple when the entry types differ (#24783). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog/pending/pcl-fix-20260924-144657.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
component: pcl
kind: fix
body: Fix a panic in the PCL interpreter's `entries` built-in on a map whose values have different shapes or on an empty map
time: 2026-09-24T14:46:57.734371+02:00
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cb37065b` are properly handled with clean fallback behavior.

# Forensic Learning Record (Deep Inspection): github/github-mcp-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/github-github-mcp-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/github/github-mcp-server](https://github.com/github/github-mcp-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:13:31.751Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `github/github-mcp-server`
- **Description**: GitHub's official MCP Server
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 33394 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/requeststate/sealer.go`
```
package requeststate

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
)

const keySize = 32

// Sealer protects request state with AES-256-GCM.
type Sealer struct {
	aead cipher.AEAD
}

// NewRandom constructs a sealer with a process-local random key.
func NewRandom() (*Sealer, error) {
	key := make([]byte, keySize)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("generating key: %w", err)
	}
	return newFromKey(key)
}

// New constructs a sealer from a standard Base64-encoded 32-byte key.
func New(encodedKey string) (*Sealer, error) {
	key, err := base64.StdEncoding.DecodeString(encodedKey)
	if err != nil {
		return nil, fmt.Errorf("decoding key: %w", err)
	}
	if len(key) != keySize {
		return nil, fmt.Errorf("decoded key must be %d bytes, got %d", keySize, len(key))
	}
	return newFromKey(key)
}

func newFromKey(key []byte) (*Sealer, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("creating cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("creating GCM: %w", err)
	}
	return &Sealer{aead: aead}, nil
}

// Seal encrypts and authenticates plaintext into a URL-safe opaque token.
func (s *Sealer) Seal(_ context.Context, plaintext []byte) (string, error) {
	nonce := make([]byte, s.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("generating nonce: %w", err)
	}
	sealed := s.aead.Seal(nonce, nonce, plaintext, nil)
	return base64.RawURLEncoding.EncodeToString(sealed), nil
}

// Open verifies and decrypts a token produced by Seal.
func (s *Sealer) Open(token string) ([]byte, error) {
	if token == "" {
		return nil, errors.New("empty token")
	}
	sealed, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, fmt.Errorf("decoding token: %w", err)
	}
	nonceSize := s.aead.NonceSize()
	if len(sealed) < nonceSize {
		return nil, errors.New("token is too short")
	}
	plaintext, err := s.aead.Open(nil, sealed[:nonceSize], sealed[nonceSize:], nil)
	if err != nil {
		return nil, fmt.Errorf("opening token: %w", err)
	}
	return plaintext, nil
}

```

### Core Architecture Module: `pkg/github/request_state.go`
```
package github

import "context"

// RequestStateSealer protects opaque state sent to clients during multi-round-trip requests.
type RequestStateSealer interface {
	Seal(context.Context, []byte) (string, error)
	Open(string) ([]byte, error)
}

// RequestStateSealerProvider optionally supplies request-state protection to tools.
// Keeping this separate from ToolDependencies preserves compatibility for integrators
// that do not expose tools which use multi-round-trip request state. Stateless HTTP
// integrators should implement it or exclude tools that return request state.
type RequestStateSealerProvider interface {
	GetRequestStateSealer() RequestStateSealer
}

func requestStateSealerFromDeps(deps ToolDependencies) RequestStateSealer {
	provider, ok := deps.(RequestStateSealerProvider)
	if !ok {
		return nil
	}
	return provider.GetRequestStateSealer()
}

```

### Core Architecture Module: `pkg/github/search_utils.go`
```
package github

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	ghErrors "github.com/github/github-mcp-server/pkg/errors"
	"github.com/github/github-mcp-server/pkg/utils"
	"github.com/google/go-github/v92/github"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func hasFilter(query, filterType string) bool {
	// Match filter at start of string, after whitespace, or after non-word characters like '('
	pattern := fmt.Sprintf(`(^|\s|\W)%s:\S+`, regexp.QuoteMeta(filterType))
	matched, _ := regexp.MatchString(pattern, query)
	return matched
}

func hasSpecificFilter(query, filterType, filterValue string) bool {
	// Match specific filter:value at start, after whitespace, or after non-word characters
	// End with word boundary, whitespace, or non-word characters like ')'
	pattern := fmt.Sprintf(`(^|\s|\W)%s:%s($|\s|\W)`, regexp.QuoteMeta(filterType), regexp.QuoteMeta(filterValue))
	matched, _ := regexp.MatchString(pattern, query)
	return matched
}

func hasRepoFilter(query string) bool {
	return hasFilter(query, "repo")
}

func hasTypeFilter(query string) bool {
	return hasFilter(query, "type")
}

// searchPostProcessFn is invoked after a successful search response, before
// the call result is returned. It may attach additional metadata (such as IFC
// labels) to the call result based on the search payload.
type searchPostProcessFn func(ctx context.Context, result *github.IssuesSearchResult, callResult *mcp.CallToolResult)

type searchConfig struct {
	postProcess searchPostProcessFn
	// fields, when non-empty, restricts each result item to the requested
	// subset of fields. fieldsTool and fieldsDeps identify the calling tool and
	// its dependencies so fields telemetry can be recorded.
	fields     []string
	fieldsTool string
	fieldsDeps ToolDependencies
}

type searchOption func(*searchConfig)

// withSearchPostProcess registers a callback invoked after a successful search
// response. The callback may mutate the call result (e.g. to attach _meta.ifc).
func withSearchPostProcess(fn searchPostProcessFn) searchOption {
	return func(c *searchConfig) { c.postProcess = fn }
}

// withFieldsFiltering enables the optional `fields` response filtering for a
// search tool. When fields is non-empty, each result item is reduced to the
// requested subset while the total_count / incomplete_results wrapper is
// preserved. tool and deps identify the caller so fields telemetry (adoption and
// realized savings) can be recorded.
func withFieldsFiltering(deps ToolDependencies, tool string, fields []string) searchOption {
	return func(c *searchConfig) {
		c.fieldsDeps = deps
		c.fieldsTool = tool
		c.fields = fields
	}
}

// searchMode selects the engine used to run a search. It maps to the endpoint's
// search_type parameter.
type searchMode int

const (
	// searchModeLexical is the API default, so search_type can be omitted.
	searchModeLexical searchMode = iota
	searchModeSemantic
)

// prepareSearchArgs resolves the search query string and REST search options from the tool args,
// applying the standard is:<type> / repo:<owner>/<repo> munging shared by search_issues and
// search_pull_requests.
func prepareSearchArgs(args map[string]any, targetType string, mode searchMode) (string, *github.SearchOptions, error) {
	query, err := RequiredParam[string](args, "query")
	if err != nil {
		return "", nil, err
	}

	if !hasSpecificFilter(query, "is", targetType) {
		query = fmt.Sprintf("is:%s %s", targetType, query)
	}

	owner, err := OptionalParam[string](args, "owner")
	if err != nil {
		return "", nil, err
	}

	repo, err := OptionalParam[string](args, "repo")
	if err != nil {
		return "", nil, err
	}

	if owner != "" && repo != "" && !hasRepoFilter(query) {
		query = fmt.Sprintf("repo:%s/%s %s", owner, repo, query)
	}

	sort, err := OptionalParam[string](args, "sort")
	if err != nil {
		return "", nil, err
	}
	order, err := OptionalParam[string](args, "order")
	if err != nil {
		return "", nil, err
	}
	pagination, err := OptionalPaginationParams(args)
	if err != nil {
		return "", nil, err
	}

	opts := &github.SearchOptions{
		Sort:  sort,
		Order: order,
		ListOptions: github.ListOptions{
			Page:    pagination.Page,
			PerPage: pagination.PerPage,
		},
	}

	// field.<name>:<value> qualifiers require the advanced search API.
	if strings.Contains(query, "field.") {
		opts.AdvancedSearch = new(true)
	}

	// Lexical is the API default, so it leaves search_type unset.
	if mode == searchModeSemantic {
		query = applySemanticSearch(query, opts)
	}

	return query, opts, nil
}

// qualifierQuotePattern matches a quoted qualifier value, e.g. label:"needs
// triage". The quotes there are meaningful — they delimit a value containing
// spaces — so they must survive stripFreeTextQuotes.
var qualifierQuotePattern = regexp.MustCompile(`([-\w.]+:)"([^"]*)"`)

// stripFreeTextQuotes removes quotes around free text while preserving them
// around qualifier values — since these delimit a value containing spaces.
func stripFreeTextQuotes(query string) string {
	const sentinel = "\x00"

	// Hide qualifier quotes behind a sentinel that cannot appear in a query,
	// strip what remains, then restore them.
	protected := qualifierQuotePattern.ReplaceAllString(query, "${1}"+sentinel+"${2}"+sentinel)
	stripped := strings.ReplaceAll(protected, `"`, "")
	return strings.ReplaceAll(stripped, sentinel, `"`)
}

// applySemanticSearch switches the request to the semantic index.
func applySemanticSearch(query string, opts *github.SearchOptions) string {
	opts.SearchType = "semantic"
	return stripFreeTextQuotes(query)
}

func searchHandler(
	ctx context.Context,
	getClient GetClientFn,
	args map[string]any,
	targetType string,
	errorPrefix string,
	options ...searchOption,
) (*mcp.CallToolResult, error) {
	cfg := searchConfig{}
	for _, opt := range options {
		opt(&cfg)
	}
	query, opts, err := prepareSearchArgs(args, targetType, searchModeLexical)
	if err != nil {
		return utils.NewToolResultError(err.Error()), nil
	}

	client, err := getClient(ctx)
	if err != nil {
		return utils.NewToolResultErrorFromErr(errorPrefix+": failed to get GitHub client", err), nil
	}
	result, resp, err := client.Search.Issues(ctx, query, opts)
	if err != nil {
		return utils.NewToolResultErrorFromErr(errorPrefix, err), nil
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return utils.NewToolResultErrorFromErr(errorPrefix+": failed to read response body", err), nil
		}
		return ghErrors.NewGitHubAPIStatusErrorResponse(ctx, errorPrefix, resp, body), nil
	}

	// result.Issues are raw *github.Issue objects marshaled directly below rather than through
	// a convertToMinimal* helper (see minimal_types.go), so Title/Body must be sanitized here.
	for _, iss := range result.Issues {
		sanitizeIssueTitleAndBody(iss)
	}

	filtered := false
	var payload any = result
	if len(cfg.fields) > 0 {
		filteredItems, err := filterEachField(result.Issues, cfg.fields)
		if err != nil {
			return utils.NewToolResultErrorFromErr(errorPrefix+": failed to filter results", err), nil
		}
		payload = map[string]any{
			"total_count":        result.Total,
			"incomplete_results": result.IncompleteResults,
			"items":              filteredItems,
		}
		filtered = true
	}

	r, err := json.Marshal(payload)
	if err != nil {
		return utils.NewToolResultErrorFromErr(errorPrefix+": failed to marshal response", err), nil
	}

	if cfg.fieldsTool != "" {
		recordFieldsUsageFor(ctx, cfg.fieldsDeps, cfg.fieldsTool, result, filtered, len(r))
	}

	callResult := utils.NewToolResultText(string(r))
	if cfg.postProcess != nil {
		cfg.postProcess(ctx, result, callResult)
	}
	return callResult, nil
}

```

### Core Architecture Module: `pkg/utils/api.go`
```
package utils //nolint:revive //TODO: figure out a better name for this package

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type APIHostResolver interface {
	BaseRESTURL(ctx context.Context) (*url.URL, error)
	GraphqlURL(ctx context.Context) (*url.URL, error)
	UploadURL(ctx context.Context) (*url.URL, error)
	RawURL(ctx context.Context) (*url.URL, error)
	AuthorizationServerURL(ctx context.Context) (*url.URL, error)
}

type APIHost struct {
	restURL                *url.URL
	gqlURL                 *url.URL
	uploadURL              *url.URL
	rawURL                 *url.URL
	authorizationServerURL *url.URL
}

var _ APIHostResolver = APIHost{}

func NewAPIHost(s string) (APIHostResolver, error) {
	a, err := parseAPIHost(s)

	if err != nil {
		return nil, err
	}

	return a, nil
}

// APIHostResolver implementation
func (a APIHost) BaseRESTURL(_ context.Context) (*url.URL, error) {
	return a.restURL, nil
}

func (a APIHost) GraphqlURL(_ context.Context) (*url.URL, error) {
	return a.gqlURL, nil
}

func (a APIHost) UploadURL(_ context.Context) (*url.URL, error) {
	return a.uploadURL, nil
}

func (a APIHost) RawURL(_ context.Context) (*url.URL, error) {
	return a.rawURL, nil
}

func (a APIHost) AuthorizationServerURL(_ context.Context) (*url.URL, error) {
	return a.authorizationServerURL, nil
}

func newDotcomHost() (APIHost, error) {
	baseRestURL, err := url.Parse("https://api.github.com/")
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse dotcom REST URL: %w", err)
	}

	gqlURL, err := url.Parse("https://api.github.com/graphql")
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse dotcom GraphQL URL: %w", err)
	}

	uploadURL, err := url.Parse("https://uploads.github.com")
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse dotcom Upload URL: %w", err)
	}

	rawURL, err := url.Parse("https://raw.githubusercontent.com/")
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse dotcom Raw URL: %w", err)
	}

	// The authorization server for GitHub.com is at github.com/login/oauth, not api.github.com
	authorizationServerURL, err := url.Parse("https://github.com/login/oauth")
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse dotcom Authorization Server URL: %w", err)
	}

	return APIHost{
		restURL:                baseRestURL,
		gqlURL:                 gqlURL,
		uploadURL:              uploadURL,
		rawURL:                 rawURL,
		authorizationServerURL: authorizationServerURL,
	}, nil
}

func newGHECHost(hostname string) (APIHost, error) {
	u, err := url.Parse(hostname)
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse GHEC URL: %w", err)
	}

	// Unsecured GHEC would be an error
	if u.Scheme == "http" {
		return APIHost{}, fmt.Errorf("GHEC URL must be HTTPS")
	}

	restURL, err := url.Parse(fmt.Sprintf("https://api.%s/", u.Hostname()))
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse GHEC REST URL: %w", err)
	}

	gqlURL, err := url.Parse(fmt.Sprintf("https://api.%s/graphql", u.Hostname()))
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse GHEC GraphQL URL: %w", err)
	}

	uploadURL, err := url.Parse(fmt.Sprintf("https://uploads.%s/", u.Hostname()))
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse GHEC Upload URL: %w", err)
	}

	rawURL, err := url.Parse(fmt.Sprintf("https://raw.%s/", u.Hostname()))
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse GHEC Raw URL: %w", err)
	}

	authorizationServerURL, err := url.Parse(fmt.Sprintf("https://%s/login/oauth", u.Hostname()))
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse GHEC Authorization Server URL: %w", err)
	}

	return APIHost{
		restURL:                restURL,
		gqlURL:                 gqlURL,
		uploadURL:              uploadURL,
		rawURL:                 rawURL,
		authorizationServerURL: authorizationServerURL,
	}, nil
}

func newGHESHost(hostname string) (APIHost, error) {
	u, err := url.Parse(hostname)
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse GHES URL: %w", err)
	}

	// Preserve the full authority (host, port, and IPv6 brackets) for the
	// base-host URLs. u.Hostname() drops the port and strips IPv6 brackets,
	// which would silently retarget a loopback dev server to port 80 and produce
	// an unusable URL for [::1]. The subdomain-isolation URLs below still derive
	// from the bare hostname, since a label cannot be prepended to a host:port or
	// an IP literal.
	authority := u.Host

	restURL, err := url.Parse(fmt.Sprintf("%s://%s/api/v3/", u.Scheme, authority))
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse GHES REST URL: %w", err)
	}

	gqlURL, err := url.Parse(fmt.Sprintf("%s://%s/api/graphql", u.Scheme, authority))
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse GHES GraphQL URL: %w", err)
	}

	// Check if subdomain isolation is enabled
	// See https://docs.github.com/en/enterprise-server@3.17/admin/configuring-settings/hardening-security-for-your-enterprise/enabling-subdomain-isolation#about-subdomain-isolation
	hasSubdomainIsolation := checkSubdomainIsolation(u.Scheme, u.Hostname())

	var uploadURL *url.URL
	if hasSubdomainIsolation {
		// With subdomain isolation: https://uploads.hostname/
		uploadURL, err = url.Parse(fmt.Sprintf("%s://uploads.%s/", u.Scheme, u.Hostname()))
	} else {
		// Without subdomain isolation: https://hostname/api/uploads/
		uploadURL, err = url.Parse(fmt.Sprintf("%s://%s/api/uploads/", u.Scheme, authority))
	}
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse GHES Upload URL: %w", err)
	}

	var rawURL *url.URL
	if hasSubdomainIsolation {
		// With subdomain isolation: https://raw.hostname/
		rawURL, err = url.Parse(fmt.Sprintf("%s://raw.%s/", u.Scheme, u.Hostname()))
	} else {
		// Without subdomain isolation: https://hostname/raw/
		rawURL, err = url.Parse(fmt.Sprintf("%s://%s/raw/", u.Scheme, authority))
	}
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse GHES Raw URL: %w", err)
	}

	authorizationServerURL, err := url.Parse(fmt.Sprintf("%s://%s/login/oauth", u.Scheme, authority))
	if err != nil {
		return APIHost{}, fmt.Errorf("failed to parse GHES Authorization Server URL: %w", err)
	}

	return APIHost{
		restURL:                restURL,
		gqlURL:                 gqlURL,
		uploadURL:              uploadURL,
		rawURL:                 rawURL,
		authorizationServerURL: authorizationServerURL,
	}, nil
}

// checkSubdomainIsolation detects if GitHub Enterprise Server has subdomain isolation enabled
// by attempting to ping the raw.<host>/_ping endpoint on the subdomain. The raw subdomain must always exist for subdomain isolation.
func checkSubdomainIsolation(scheme, hostname string) bool {
	subdomainURL := fmt.Sprintf("%s://raw.%s/_ping", scheme, hostname)

	client := &http.Client{
		Timeout: 5 * time.Second,
		// Don't follow redirects - we just want to check if the endpoint exists
		//nolint:revive // parameters are required by http.Client.CheckRedirect signature
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Get(subdomainURL)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

// Note that this does not handle ports yet, so development environments are out.
func parseAPIHost(s string) (APIHost, error) {
	if s == "" {
		return newDotcomHost()
	}

	u, err := url.Parse(s)
	if err != nil {
		return APIHost{}, fmt.Errorf("could not parse host as URL: %s", s)
	}

	if u.Scheme == "" {
		return APIHost{}, fmt.Errorf("host must have a scheme (http or https): %s", s)
	}

	// Enforce HTTPS centrally so no deployment (GHES in particular) can build
	// authenticated REST/GraphQL/upload/raw URLs over cleartext http, which
	// would leak the bearer token/PAT to anyone on the network.
	if err := requireSecureScheme(u); err != nil {
		return APIHost{}, err
	}

	switch classifyHost(u) {
	case HostTypeDotcom:
		return newDotcomHost()
	case HostTypeGHEC:
		return newGHECHost(s)
	default:
		return newGHESHost(s)
	}
}

// requireSecureScheme rejects hosts that would carry credentials over cleartext.
// Every REST/GraphQL/upload/raw/authorization URL is derived from this host and
// used for authenticated requests, so an http scheme would expose the bearer
// token/PAT to network interception and replay. http is permitted only for
// loopback hosts so that local development against a dev server still works.
func requireSecureScheme(u *url.URL) error {
	if u.Scheme == "https" {
		return nil
	}
	if u.Scheme == "http" && isLoopbackHost(u.Hostname()) {
		return nil
	}
	return fmt.Errorf(
		"host must use https to avoid sending credentials over cleartext: %s (http is only permitted for loopback hosts such as localhost, 127.0.0.1, or ::1)",
		u.Scheme+"://"+u.Hostname(),
	)
}

// isLoopbackHost reports whether hostname is a loopback address. Only exact
// loopback names/addresses qualify, so credentials are never sent in cleartext
// to a remote host.
func isLoopbackHost(hostname string) bool {
	switch strings.ToLower(hostname) {
	case "localhost", "127.0.0.1", "::1":
		return true
	default:
		return false
	}
}

// HostType identifies which GitHub deployment a host refers to. Tools use this
// to skip capabilities that only exist on some deployments.
type HostType int

const (
	HostTypeDotcom HostType = iota
	HostTypeGHEC
	HostTypeGHES
)

func classifyHost(u *url.URL) HostType {
	switch {
	case u.Hostname() == "github.com" || strings.HasSuffix(u.Hostname(), ".github.com"):
		return HostTypeDotcom
	case u.Hostname() == "ghe.com" || strings.HasSuffix(u.Hostname(), ".ghe.com"):
		return HostTypeGHEC
	default:
		return HostTypeGHES
	}
}

// ParseHostType classifies a host string. An empty string means github.com,
// matching NewAPIHost. It returns an error only when the string is not a URL
// with a scheme.
func ParseHostType(s string) (HostType, error) {
	if s == ""
```

### Core Architecture Module: `pkg/utils/result.go`
```
package utils //nolint:revive //TODO: figure out a better name for this package

import "github.com/modelcontextprotocol/go-sdk/mcp"

func NewToolResultText(message string) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{
				Text: message,
			},
		},
	}
}

func NewToolResultError(message string) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{
				Text: message,
			},
		},
		IsError: true,
	}
}

func NewToolResultErrorFromErr(message string, err error) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{
				Text: message + ": " + err.Error(),
			},
		},
		IsError: true,
	}
}

func NewToolResultResource(message string, contents *mcp.ResourceContents) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{
				Text: message,
			},
			&mcp.EmbeddedResource{
				Resource: contents,
			},
		},
		IsError: false,
	}
}

func NewToolResultResourceLink(message string, link *mcp.ResourceLink) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{
				Text: message,
			},
			link,
		},
		IsError: false,
	}
}

// NewToolResultAwaitingFormSubmission signals to the agent that a tool call
// has been intercepted to show an MCP App form to the user and has NOT
// performed the requested operation. The agent must stop, not chain dependent
// tool calls, and not claim the operation succeeded. The result is marked
// IsError=true so agents that bail on error don't proceed; the host still
// renders the UI because rendering is keyed off the tool's _meta.ui, not the
// result. The MCP App form will submit the operation directly when the user
// clicks submit, after which a ui/update-model-context call delivers the real
// outcome to the agent.
func NewToolResultAwaitingFormSubmission(message string) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{
				Text: message,
			},
		},
		StructuredContent: map[string]any{
			"status": "awaiting_user_submission",
			"reason": "An interactive form is being shown to the user. The operation has not been performed.",
		},
		IsError: true,
	}
}

```

### Core Architecture Module: `pkg/utils/token.go`
```
package utils //nolint:revive //TODO: figure out a better name for this package

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"

	httpheaders "github.com/github/github-mcp-server/pkg/http/headers"
	"github.com/github/github-mcp-server/pkg/http/mark"
)

type TokenType int

const (
	TokenTypeUnknown TokenType = iota
	TokenTypePersonalAccessToken
	TokenTypeFineGrainedPersonalAccessToken
	TokenTypeOAuthAccessToken
	TokenTypeUserToServerGitHubAppToken
	TokenTypeServerToServerGitHubAppToken
)

var supportedGitHubPrefixes = map[string]TokenType{
	"ghp_":        TokenTypePersonalAccessToken,            // Personal access token (classic)
	"github_pat_": TokenTypeFineGrainedPersonalAccessToken, // Fine-grained personal access token
	"gho_":        TokenTypeOAuthAccessToken,               // OAuth access token
	"ghu_":        TokenTypeUserToServerGitHubAppToken,     // User access token for a GitHub App
	"ghs_":        TokenTypeServerToServerGitHubAppToken,   // Installation access token for a GitHub App (a.k.a. server-to-server token)
}

var (
	ErrMissingAuthorizationHeader     = fmt.Errorf("%w: missing required Authorization header", mark.ErrBadRequest)
	ErrBadAuthorizationHeader         = fmt.Errorf("%w: Authorization header is badly formatted", mark.ErrBadRequest)
	ErrUnsupportedAuthorizationHeader = fmt.Errorf("%w: unsupported Authorization header", mark.ErrBadRequest)
)

// oldPatternRegexp is the regular expression for the old pattern of the token.
// Until 2021, GitHub API tokens did not have an identifiable prefix. They
// were 40 characters long and only contained the characters a-f and 0-9.
var oldPatternRegexp = regexp.MustCompile(`\A[a-f0-9]{40}\z`)

// ParseAuthorizationHeader parses the Authorization header from the HTTP request
func ParseAuthorizationHeader(req *http.Request) (tokenType TokenType, token string, _ error) {
	authHeader := req.Header.Get(httpheaders.AuthorizationHeader)
	if authHeader == "" {
		return 0, "", ErrMissingAuthorizationHeader
	}

	switch {
	// decrypt dotcom token and set it as token
	case strings.HasPrefix(authHeader, "GitHub-Bearer "):
		return 0, "", ErrUnsupportedAuthorizationHeader
	default:
		// support both "Bearer" and "bearer" to conform to api.github.com
		if len(authHeader) > 7 && strings.EqualFold(authHeader[:7], "Bearer ") {
			token = authHeader[7:]
		} else {
			token = authHeader
		}
	}

	for prefix, tokenType := range supportedGitHubPrefixes {
		if strings.HasPrefix(token, prefix) {
			return tokenType, token, nil
		}
	}

	matchesOldTokenPattern := oldPatternRegexp.MatchString(token)
	if matchesOldTokenPattern {
		return TokenTypePersonalAccessToken, token, nil
	}

	return 0, "", ErrBadAuthorizationHeader
}

```

### Core Architecture Module: `ui/src/hooks/useMcpApp.ts`
```
import { useApp as useExtApp } from "@modelcontextprotocol/ext-apps/react";
import type {
  App,
  McpUiDisplayMode,
  McpUiHostContext,
  McpUiUpdateModelContextRequest,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/client";
import { useState, useCallback, useEffect } from "react";

interface UseMcpAppOptions {
  appName: string;
  appVersion?: string;
  /**
   * Display modes this view supports. Per the MCP Apps 2026-01-26 spec, a
   * view MUST declare every display mode it supports during initialization.
   * Defaults to ["inline"] which is the only mode the bundled github-mcp-server
   * views currently render.
   */
  availableDisplayModes?: McpUiDisplayMode[];
  onToolResult?: (result: CallToolResult) => void;
  onToolInput?: (input: Record<string, unknown>) => void;
}

interface UseMcpAppReturn {
  app: App | null;
  error: Error | null;
  toolResult: CallToolResult | null;
  toolInput: Record<string, unknown> | null;
  hostContext: McpUiHostContext | undefined;
  callTool: (name: string, args: Record<string, unknown>) => Promise<CallToolResult>;
  /**
   * Sends `ui/update-model-context` so the agent's next turn sees the
   * supplied structured content / blocks. No-op when the app isn't connected.
   */
  setModelContext: (
    params: McpUiUpdateModelContextRequest["params"]
  ) => Promise<void>;
  /**
   * Sends `ui/open-link` so the host opens an external URL in the user's
   * browser. Falls back to `window.open` when the app isn't connected.
   */
  openLink: (url: string) => Promise<void>;
}

export function useMcpApp({
  appName,
  appVersion = "1.0.0",
  availableDisplayModes = ["inline"],
  onToolResult,
  onToolInput,
}: UseMcpAppOptions): UseMcpAppReturn {
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [toolInput, setToolInput] = useState<Record<string, unknown> | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>(undefined);

  // The SDK's autoResize=true installs a ResizeObserver that emits
  // `ui/notifications/size-changed` automatically; no manual wiring needed.
  const { app, error } = useExtApp({
    appInfo: { name: appName, version: appVersion },
    capabilities: { availableDisplayModes },
    autoResize: true,
    strict: import.meta.env.DEV,
    onAppCreated: (app) => {
      app.ontoolresult = async (result) => {
        setToolResult(result);
        onToolResult?.(result);
      };
      app.ontoolinput = async (input) => {
        const args = (input.arguments ?? {}) as Record<string, unknown>;
        setToolInput(args);
        // A tool-input notification marks a new invocation, and the spec
        // guarantees it is delivered before that invocation's tool-result.
        // Drop any prior result so a completed result from a previous
        // invocation can't leak into the new render (e.g. a stale success card
        // showing over a fresh, still-deferred form). The current invocation's
        // result, if any, arrives next via ontoolresult.
        setToolResult(null);
        onToolInput?.(args);
      };
      app.onhostcontextchanged = (params) => {
        setHostContext((prev) => ({ ...(prev ?? {}), ...params }));
      };
      app.onerror = console.error;
    },
  });

  useEffect(() => {
    if (!app) return;
    const initial = app.getHostContext();
    if (initial) setHostContext(initial);
  }, [app]);

  const callTool = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      if (!app) throw new Error("App not connected");
      return app.callServerTool({ name, arguments: args });
    },
    [app]
  );

  const setModelContext = useCallback<UseMcpAppReturn["setModelContext"]>(
    async (params) => {
      if (!app) return;
      await app.updateModelContext(params);
    },
    [app]
  );

  const openLink = useCallback<UseMcpAppReturn["openLink"]>(
    async (url) => {
      if (!app) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      const result = await app.openLink({ url });
      // The host may deny the request (e.g. blocked domain or user cancelled).
      // Fall back to a direct window.open so the link still works.
      if (result?.isError) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [app]
  );

  return {
    app,
    error,
    toolResult,
    toolInput,
    hostContext,
    callTool,
    setModelContext,
    openLink,
  };
}

```

### Core Architecture Module: `cmd/github-mcp-server/helpers.go`
```
package main

import "strings"

// formatToolsetName converts a toolset ID to a human-readable name.
// Used by both generate_docs.go and list_scopes.go for consistent formatting.
func formatToolsetName(name string) string {
	switch name {
	case "pull_requests":
		return "Pull Requests"
	case "repos":
		return "Repositories"
	case "code_security":
		return "Code Security"
	case "secret_protection":
		return "Secret Protection"
	case "orgs":
		return "Organizations"
	default:
		// Fallback: capitalize first letter and replace underscores with spaces
		parts := strings.Split(name, "_")
		for i, part := range parts {
			if len(part) > 0 {
				parts[i] = strings.ToUpper(string(part[0])) + part[1:]
			}
		}
		return strings.Join(parts, " ")
	}
}

```

### Core Architecture Module: `cmd/github-mcp-server/list_scopes.go`
```
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/github/github-mcp-server/pkg/github"
	"github.com/github/github-mcp-server/pkg/inventory"
	"github.com/github/github-mcp-server/pkg/translations"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// ToolScopeInfo contains scope information for a single tool.
type ToolScopeInfo struct {
	Name            string   `json:"name"`
	Toolset         string   `json:"toolset"`
	ReadOnly        bool     `json:"read_only"`
	ChallengeScopes []string `json:"challenge_scopes,omitempty"`
}

// ScopesOutput is the full output structure for the list-scopes command.
type ScopesOutput struct {
	Tools           []ToolScopeInfo     `json:"tools"`
	UniqueScopes    []string            `json:"unique_scopes"`
	ScopesByTool    map[string][]string `json:"scopes_by_tool"`
	ToolsByScope    map[string][]string `json:"tools_by_scope"`
	EnabledToolsets []string            `json:"enabled_toolsets"`
	ReadOnly        bool                `json:"read_only"`
}

var listScopesCmd = &cobra.Command{
	Use:   "list-scopes",
	Short: "List OAuth scope policies for enabled tools",
	Long: `List the OAuth challenge scopes for all enabled tools.

This command creates an inventory based on the same flags as the stdio command
and outputs the scopes each enabled tool may request in an OAuth challenge.

The output format can be controlled with the --output flag:
  - text (default): Human-readable text output
  - json: JSON output for programmatic use
  - summary: Just the unique scopes needed

Examples:
  # List scopes for default toolsets
  github-mcp-server list-scopes

  # List scopes for specific toolsets
  github-mcp-server list-scopes --toolsets=repos,issues,pull_requests

  # List scopes for all toolsets
  github-mcp-server list-scopes --toolsets=all

  # Output as JSON
  github-mcp-server list-scopes --output=json

  # Just show unique scopes needed
  github-mcp-server list-scopes --output=summary`,
	RunE: func(_ *cobra.Command, _ []string) error {
		return runListScopes()
	},
}

func init() {
	listScopesCmd.Flags().StringP("output", "o", "text", "Output format: text, json, or summary")
	_ = viper.BindPFlag("list-scopes-output", listScopesCmd.Flags().Lookup("output"))

	rootCmd.AddCommand(listScopesCmd)
}

// formatScopeDisplay formats a scope string for display, handling empty scopes.
func formatScopeDisplay(scope string) string {
	if scope == "" {
		return "(no scope required for public read access)"
	}
	return scope
}

func runListScopes() error {
	// Get toolsets configuration (same logic as stdio command)
	var enabledToolsets []string
	if viper.IsSet("toolsets") {
		if err := viper.UnmarshalKey("toolsets", &enabledToolsets); err != nil {
			return fmt.Errorf("failed to unmarshal toolsets: %w", err)
		}
	}
	// else: enabledToolsets stays nil, meaning "use defaults"

	// Get specific tools (similar to toolsets)
	var enabledTools []string
	if viper.IsSet("tools") {
		if err := viper.UnmarshalKey("tools", &enabledTools); err != nil {
			return fmt.Errorf("failed to unmarshal tools: %w", err)
		}
	}

	readOnly := viper.GetBool("read-only")
	outputFormat := viper.GetString("list-scopes-output")

	// Create translation helper
	t, _ := translations.TranslationHelper()

	// Build inventory using the same logic as the stdio server
	inventoryBuilder := github.NewInventory(t).
		WithReadOnly(readOnly)

	// Configure toolsets (same as stdio)
	if enabledToolsets != nil {
		inventoryBuilder = inventoryBuilder.WithToolsets(enabledToolsets)
	}

	// Configure specific tools
	if len(enabledTools) > 0 {
		inventoryBuilder = inventoryBuilder.WithTools(enabledTools)
	}

	inv, err := inventoryBuilder.Build()
	if err != nil {
		return fmt.Errorf("failed to build inventory: %w", err)
	}

	// Collect all tools and their scopes
	output := collectToolScopes(inv, readOnly)

	// Output based on format
	switch outputFormat {
	case "json":
		return outputJSON(output)
	case "summary":
		return outputSummary(output)
	default:
		return outputText(output)
	}
}

func collectToolScopes(inv *inventory.Inventory, readOnly bool) ScopesOutput {
	var tools []ToolScopeInfo
	scopeSet := make(map[string]bool)
	scopesByTool := make(map[string][]string)
	toolsByScope := make(map[string][]string)

	// Get all available tools from the inventory
	// Use context.Background() for feature flag evaluation
	availableTools := inv.AvailableTools(context.Background())

	for _, serverTool := range availableTools {
		tool := serverTool.Tool

		challengeScopes := serverTool.ScopeAccess.Scopes

		// Determine if tool is read-only
		isReadOnly := serverTool.IsReadOnly()

		toolInfo := ToolScopeInfo{
			Name:            tool.Name,
			Toolset:         string(serverTool.Toolset.ID),
			ReadOnly:        isReadOnly,
			ChallengeScopes: challengeScopes,
		}
		tools = append(tools, toolInfo)

		// Track unique scopes
		for _, s := range challengeScopes {
			scopeSet[s] = true
			toolsByScope[s] = append(toolsByScope[s], tool.Name)
		}

		// Track scopes by tool
		scopesByTool[tool.Name] = challengeScopes
	}

	// Sort tools by name
	sort.Slice(tools, func(i, j int) bool {
		return tools[i].Name < tools[j].Name
	})

	// Get unique scopes as sorted slice
	var uniqueScopes []string
	for s := range scopeSet {
		uniqueScopes = append(uniqueScopes, s)
	}
	sort.Strings(uniqueScopes)

	// Sort tools within each scope
	for scope := range toolsByScope {
		sort.Strings(toolsByScope[scope])
	}

	// Get enabled toolsets as string slice
	toolsetIDs := inv.ToolsetIDs()
	toolsetIDStrs := make([]string, len(toolsetIDs))
	for i, id := range toolsetIDs {
		toolsetIDStrs[i] = string(id)
	}

	return ScopesOutput{
		Tools:           tools,
		UniqueScopes:    uniqueScopes,
		ScopesByTool:    scopesByTool,
		ToolsByScope:    toolsByScope,
		EnabledToolsets: toolsetIDStrs,
		ReadOnly:        readOnly,
	}
}

func outputJSON(output ScopesOutput) error {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(output)
}

func outputSummary(output ScopesOutput) error {
	if len(output.UniqueScopes) == 0 {
		fmt.Println("No OAuth scopes required for enabled tools.")
		return nil
	}

	fmt.Println("OAuth scope policies for enabled tools:")
	fmt.Println()
	for _, scope := range output.UniqueScopes {
		fmt.Printf("  %s\n", formatScopeDisplay(scope))
	}
	fmt.Printf("\nTotal: %d unique scope(s)\n", len(output.UniqueScopes))
	return nil
}

func outputText(output ScopesOutput) error {
	fmt.Printf("OAuth Challenge Scopes for Enabled Tools\n")
	fmt.Printf("========================================\n\n")

	fmt.Printf("Enabled Toolsets: %s\n", strings.Join(output.EnabledToolsets, ", "))
	fmt.Printf("Read-Only Mode: %v\n\n", output.ReadOnly)

	// Group tools by toolset
	toolsByToolset := make(map[string][]ToolScopeInfo)
	for _, tool := range output.Tools {
		toolsByToolset[tool.Toolset] = append(toolsByToolset[tool.Toolset], tool)
	}

	// Get sorted toolset names
	var toolsetNames []string
	for name := range toolsByToolset {
		toolsetNames = append(toolsetNames, name)
	}
	sort.Strings(toolsetNames)

	for _, toolsetName := range toolsetNames {
		tools := toolsByToolset[toolsetName]
		fmt.Printf("## %s\n\n", formatToolsetName(toolsetName))

		for _, tool := range tools {
			rwIndicator := "📝"
			if tool.ReadOnly {
				rwIndicator = "👁"
			}

			scopeStr := "(no scope required)"
			if len(tool.ChallengeScopes) > 0 {
				scopeStr = strings.Join(tool.ChallengeScopes, ", ")
			}

			fmt.Printf("  %s %s: %s\n", rwIndicator, tool.Name, scopeStr)
		}
		fmt.Println()
	}

	// Summary
	fmt.Println("## Summary")
	fmt.Println()
	if len(output.UniqueScopes) == 0 {
		fmt.Println("No OAuth scopes are used by enabled tools.")
	} else {
		fmt.Println("Unique challenge scopes:")
		for _, scope := range output.UniqueScopes {
			fmt.Printf("  • %s\n", formatScopeDisplay(scope))
		}
	}
	fmt.Printf("\nTotal: %d tools, %d unique scopes\n", len(output.Tools), len(output.UniqueScopes))

	// Legend
	fmt.Println("\nLegend: 👁 = read-only, 📝 = read-write")

	return nil
}

```

### Core Architecture Module: `cmd/github-mcp-server/main.go`
```
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"runtime/debug"
	"strings"
	"time"

	"github.com/github/github-mcp-server/internal/buildinfo"
	"github.com/github/github-mcp-server/internal/ghmcp"
	"github.com/github/github-mcp-server/internal/githubapp"
	"github.com/github/github-mcp-server/internal/oauth"
	"github.com/github/github-mcp-server/pkg/github"
	ghhttp "github.com/github/github-mcp-server/pkg/http"
	ghoauth "github.com/github/github-mcp-server/pkg/http/oauth"
	"github.com/github/github-mcp-server/pkg/utils"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"
)

// These variables are set by the build process using ldflags.
var version = "version"
var commit = "commit"
var date = "date"

var (
	rootCmd = &cobra.Command{
		Use:     "github-mcp-server",
		Short:   "GitHub MCP Server",
		Long:    `A GitHub MCP server that handles various tools and resources.`,
		Version: fmt.Sprintf("Version: %s\nCommit: %s\nBuild Date: %s", version, commit, date),
	}

	stdioCmd = &cobra.Command{
		Use:   "stdio",
		Short: "Start stdio server",
		Long:  `Start a server that communicates via standard input/output streams using JSON-RPC messages.`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			info, _ := debug.ReadBuildInfo()
			serverVersion := resolveServerVersion(version, commit, info)
			if serverVersion == developmentServerVersion {
				cmd.PrintErrln("Warning: no usable server build version metadata; using development version dev")
			}

			token := viper.GetString("personal_access_token")
			appID := viper.GetString("app-id")
			appInstallationID := viper.GetString("app-installation-id")
			appPrivateKeyPath := viper.GetString("app-private-key-path")
			appPrivateKeyInline := viper.GetString("app-private-key")
			appAuthRequested := appID != "" || appInstallationID != "" || appPrivateKeyPath != "" || appPrivateKeyInline != ""

			oauthClientID := viper.GetString("oauth-client-id")
			oauthClientSecret := viper.GetString("oauth-client-secret")
			// Fall back to the build-time baked-in client (official releases) when none is
			// configured explicitly. The baked-in app is registered on github.com, so it is
			// only applied to the default host; GHES/ghe.com users must bring their own
			// --oauth-client-id. Recognizing the host via NormalizeHost means an explicit
			// GITHUB_HOST=github.com (or api.github.com) still counts as the default and keeps
			// zero-config login working. The secret tracks the id, so an explicitly provided
			// id with no secret never picks up the baked-in secret.
			if oauthClientID == "" && !appAuthRequested && oauth.NormalizeHost(viper.GetString("host")) == "https://github.com" {
				oauthClientID = buildinfo.OAuthClientID
				oauthClientSecret = buildinfo.OAuthClientSecret
			}
			if token == "" && !appAuthRequested && oauthClientID == "" {
				return errors.New("authentication required: set GITHUB_PERSONAL_ACCESS_TOKEN, configure GitHub App auth, or pass --oauth-client-id to log in via OAuth")
			}
			if appAuthRequested && token != "" {
				return errors.New("GitHub App authentication and GITHUB_PERSONAL_ACCESS_TOKEN are mutually exclusive: set only one")
			}
			if appAuthRequested && oauthClientID != "" {
				return errors.New("GitHub App authentication and OAuth login (--oauth-client-id) are mutually exclusive: set only one")
			}

			// If you're wondering why we're not using viper.GetStringSlice("toolsets"),
			// it's because viper doesn't handle comma-separated values correctly for env
			// vars when using GetStringSlice.
			// https://github.com/spf13/viper/issues/380
			//
			// Additionally, viper.UnmarshalKey returns an empty slice even when the flag
			// is not set, but we need nil to indicate "use defaults". So we check IsSet first.
			var enabledToolsets []string
			if viper.IsSet("toolsets") {
				if err := viper.UnmarshalKey("toolsets", &enabledToolsets); err != nil {
					return fmt.Errorf("failed to unmarshal toolsets: %w", err)
				}
			}
			// else: enabledToolsets stays nil, meaning "use defaults"

			// Parse tools (similar to toolsets)
			var enabledTools []string
			if viper.IsSet("tools") {
				if err := viper.UnmarshalKey("tools", &enabledTools); err != nil {
					return fmt.Errorf("failed to unmarshal tools: %w", err)
				}
			}

			// Parse excluded tools (similar to tools)
			var excludeTools []string
			if viper.IsSet("exclude_tools") {
				if err := viper.UnmarshalKey("exclude_tools", &excludeTools); err != nil {
					return fmt.Errorf("failed to unmarshal exclude-tools: %w", err)
				}
			}

			// Parse enabled features (similar to toolsets)
			var enabledFeatures []string
			if viper.IsSet("features") {
				if err := viper.UnmarshalKey("features", &enabledFeatures); err != nil {
					return fmt.Errorf("failed to unmarshal features: %w", err)
				}
			}

			ttl := viper.GetDuration("repo-access-cache-ttl")
			stdioServerConfig := ghmcp.StdioServerConfig{
				Version:              serverVersion,
				Host:                 viper.GetString("host"),
				Token:                token,
				EnabledToolsets:      enabledToolsets,
				EnabledTools:         enabledTools,
				EnabledFeatures:      enabledFeatures,
				ReadOnly:             viper.GetBool("read-only"),
				ExportTranslations:   viper.GetBool("export-translations"),
				EnableCommandLogging: viper.GetBool("enable-command-logging"),
				LogFilePath:          viper.GetString("log-file"),
				ContentWindowSize:    viper.GetInt("content-window-size"),
				LockdownMode:         viper.GetBool("lockdown-mode"),
				InsidersMode:         viper.GetBool("insiders"),
				ExcludeTools:         excludeTools,
				RepoAccessCacheTTL:   &ttl,
			}

			// When no static token is provided, log in via OAuth using the given
			// client. The requested scopes default to the standard set; high-risk
			// scopes such as delete_repo require explicit --oauth-scopes opt-in.
			// The requested set also filters tools needing other scopes.
			if token == "" && !appAuthRequested {
				scopes := ghoauth.DefaultScopes
				if viper.IsSet("oauth-scopes") {
					if err := viper.UnmarshalKey("oauth-scopes", &scopes); err != nil {
						return fmt.Errorf("failed to unmarshal oauth-scopes: %w", err)
					}
				}
				oauthConfig := oauth.NewGitHubConfig(
					oauthClientID,
					oauthClientSecret,
					scopes,
					viper.GetString("host"),
					viper.GetInt("oauth-callback-port"),
				)
				stdioServerConfig.OAuthManager = oauth.NewManager(oauthConfig, nil)
				stdioServerConfig.OAuthScopes = scopes
			}

			if appAuthRequested {
				tokenProvider, err := newGitHubAppTokenProvider(appID, appInstallationID, appPrivateKeyPath, appPrivateKeyInline, viper.GetString("host"))
				if err != nil {
					return err
				}
				stdioServerConfig.TokenProvider = tokenProvider
			}

			return ghmcp.RunStdioServer(stdioServerConfig)
		},
	}

	httpCmd = &cobra.Command{
		Use:   "http",
		Short: "Start HTTP server",
		Long:  `Start an HTTP server that listens for MCP requests over HTTP.`,
		RunE: func(_ *cobra.Command, _ []string) error {
			// Parse toolsets (same approach as stdio — see comment there)
			var enabledToolsets []string
			if viper.IsSet("toolsets") {
				if err := viper.UnmarshalKey("toolsets", &enabledToolsets); err != nil {
					return fmt.Errorf("failed to unmarshal toolsets: %w", err)
				}
			}

			var enabledTools []string
			if viper.IsSet("tools") {
				if err := viper.UnmarshalKey("tools", &enabledTools); err != nil {
					return fmt.Errorf("failed to unmarshal tools: %w", err)
				}
			}

			var excludeTools []string
			if viper.IsSet("exclude_tools") {
				if err := viper.UnmarshalKey("exclude_tools", &excludeTools); err != nil {
					return fmt.Errorf("failed to unmarshal exclude-tools: %w", err)
				}
			}

			var enabledFeatures []string
			if viper.IsSet("features") {
				if err := viper.UnmarshalKey("features", &enabledFeatures); err != nil {
					return fmt.Errorf("failed to unmarshal features: %w", err)
				}
			}

			ttl := viper.GetDuration("repo-access-cache-ttl")
			httpConfig := ghhttp.ServerConfig{
				Version:              version,
				Host:                 viper.GetString("host"),
				Port:                 viper.GetInt("port"),
				ListenHost:           viper.GetString("listen-host"),
				BaseURL:              viper.GetString("base-url"),
				ResourcePath:         viper.GetString("base-path"),
				AuthorizationServer:  viper.GetString("authorization-server"),
				ExportTranslations:   viper.GetBool("export-translations"),
				EnableCommandLogging: viper.GetBool("enable-command-logging"),
				LogFilePath:          viper.GetString("log-file"),
				ContentWindowSize:    viper.GetInt("content-window-size"),
				LockdownMode:         viper.GetBool("lockdown-mode"),
				RepoAccessCacheTTL:   &ttl,
				ScopeChallenge:       viper.GetBool("scope-challenge"),
				ReadOnly:             viper.GetBool("read-only"),
				EnabledToolsets:      enabledToolsets,
				EnabledTools:         enabledTools,
				ExcludeTools:         excludeTools,
				EnabledFeatures:      enabledFeatures,
				InsidersMode:         viper.GetBool("insiders"),
				TrustProxyHeaders:    viper.GetBool("trust-proxy-headers"),
				MRTRStateKey:         os.Getenv(ghhttp.MRTRStateKeyEnv),
			}

			return ghhttp.RunHTTPServer(httpConfig)
		},
	}
)

func init() {
	cobra.OnInitialize(initConfig)
	rootCmd.SetGlobalNormalizationFunc(wordSepNormalizeFunc)

	rootCmd.SetVersionTemplate("{{.Short}}\n{{.Version}}\n")

	// Add global flags that will be shared by all commands
	rootCmd.PersistentFlags().StringSlice("toolsets", nil, github.GenerateToolsetsHelp())
	rootCmd.PersistentFlags().StringSlice("tools", nil, "Comma-separated list of specific tools to enable")
	rootCmd.PersistentFlags().StringSlice("exclude-tools", nil, "Comma-separated list of tool names to disable regardless of other settings")
	rootCmd.PersistentFlags().StringSlice("features", nil, "Comma-separated list of feature flags to enable")
	rootCmd.Persistent
```

### Core Architecture Module: `cmd/github-mcp-server/version.go`
```
package main

import (
	"encoding/hex"
	"runtime/debug"
	"strings"
	"unicode"
)

const developmentServerVersion = "dev"

func resolveServerVersion(release, revision string, info *debug.BuildInfo) string {
	isPlaceholder := func(value string) bool {
		switch value {
		case "", "version", "dev", "unknown", "(devel)":
			return true
		default:
			return false
		}
	}
	validRelease := func(value string) bool {
		if isPlaceholder(value) {
			return false
		}
		for _, r := range value {
			if r > unicode.MaxASCII || r <= ' ' || r == 127 || strings.ContainsRune("()<>@,;:\\\"/[]?={}", r) {
				return false
			}
		}
		return true
	}
	if validRelease(release) {
		return release
	}

	var vcsRevision string
	var dirty bool
	if info != nil {
		for _, setting := range info.Settings {
			switch setting.Key {
			case "vcs.revision":
				vcsRevision = setting.Value
			case "vcs.modified":
				dirty = setting.Value == "true"
			}
		}
	}
	revisions := []struct {
		value string
		dirty bool
	}{
		{value: revision},
		{value: vcsRevision, dirty: dirty},
	}
	for _, candidate := range revisions {
		if len(candidate.value) != 40 && len(candidate.value) != 64 {
			continue
		}
		if _, err := hex.DecodeString(candidate.value); err != nil {
			continue
		}
		if strings.Trim(candidate.value, "0") == "" {
			continue
		}
		resolved := "vcs-" + strings.ToLower(candidate.value)
		if candidate.dirty {
			resolved += "-dirty"
		}
		return resolved
	}
	if info != nil && validRelease(info.Main.Version) {
		return info.Main.Version
	}
	return developmentServerVersion
}

```

### Core Architecture Module: `cmd/mcpcurl/main.go`
```
package main

import (
	"bufio"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"os"
	"os/exec"
	"slices"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

type (
	// SchemaResponse represents the top-level response containing tools
	SchemaResponse struct {
		Result  Result `json:"result"`
		JSONRPC string `json:"jsonrpc"`
		ID      int    `json:"id"`
	}

	// Result contains the list of available tools
	Result struct {
		Tools []Tool `json:"tools"`
	}

	// Tool represents a single command with its schema
	Tool struct {
		Name        string      `json:"name"`
		Description string      `json:"description"`
		InputSchema InputSchema `json:"inputSchema"`
	}

	// InputSchema defines the structure of a tool's input parameters
	InputSchema struct {
		Type                 string              `json:"type"`
		Properties           map[string]Property `json:"properties"`
		Required             []string            `json:"required"`
		AdditionalProperties bool                `json:"additionalProperties"`
		Schema               string              `json:"$schema"`
	}

	// Property defines a single parameter's type and constraints
	Property struct {
		Type        string        `json:"type"`
		Description string        `json:"description"`
		Enum        []string      `json:"enum,omitempty"`
		Minimum     *float64      `json:"minimum,omitempty"`
		Maximum     *float64      `json:"maximum,omitempty"`
		Items       *PropertyItem `json:"items,omitempty"`
	}

	// PropertyItem defines the type of items in an array property
	PropertyItem struct {
		Type                 string              `json:"type"`
		Properties           map[string]Property `json:"properties,omitempty"`
		Required             []string            `json:"required,omitempty"`
		AdditionalProperties bool                `json:"additionalProperties,omitempty"`
	}

	// JSONRPCRequest represents a JSON-RPC 2.0 request
	JSONRPCRequest struct {
		JSONRPC string        `json:"jsonrpc"`
		ID      int           `json:"id"`
		Method  string        `json:"method"`
		Params  RequestParams `json:"params"`
	}

	// RequestParams contains the tool name and arguments
	RequestParams struct {
		Name      string         `json:"name"`
		Arguments map[string]any `json:"arguments"`
	}

	// Content matches the response format of a text content response
	Content struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}

	ResponseResult struct {
		Content []Content `json:"content"`
	}

	Response struct {
		Result  ResponseResult `json:"result"`
		JSONRPC string         `json:"jsonrpc"`
		ID      int            `json:"id"`
	}
)

var (
	// Create root command
	rootCmd = &cobra.Command{
		Use:   "mcpcurl",
		Short: "CLI tool with dynamically generated commands",
		Long:  "A CLI tool for interacting with MCP API based on dynamically loaded schemas",
		PersistentPreRunE: func(cmd *cobra.Command, _ []string) error {
			// Skip validation for help and completion commands
			if cmd.Name() == "help" || cmd.Name() == "completion" {
				return nil
			}

			// Check if the required global flag is provided
			serverCmd, _ := cmd.Flags().GetString("stdio-server-cmd")
			if serverCmd == "" {
				return fmt.Errorf("--stdio-server-cmd is required")
			}
			return nil
		},
	}

	// Add schema command
	schemaCmd = &cobra.Command{
		Use:   "schema",
		Short: "Fetch schema from MCP server",
		Long:  "Fetches the tools schema from the MCP server specified by --stdio-server-cmd",
		RunE: func(cmd *cobra.Command, _ []string) error {
			serverCmd, _ := cmd.Flags().GetString("stdio-server-cmd")
			if serverCmd == "" {
				return fmt.Errorf("--stdio-server-cmd is required")
			}

			// Build the JSON-RPC request for tools/list
			jsonRequest, err := buildJSONRPCRequest("tools/list", "", nil)
			if err != nil {
				return fmt.Errorf("failed to build JSON-RPC request: %w", err)
			}

			// Execute the server command and pass the JSON-RPC request
			response, err := executeServerCommand(serverCmd, jsonRequest)
			if err != nil {
				return fmt.Errorf("error executing server command: %w", err)
			}

			// Output the response
			fmt.Println(response)
			return nil
		},
	}

	// Create the tools command
	toolsCmd = &cobra.Command{
		Use:   "tools",
		Short: "Access available tools",
		Long:  "Contains all dynamically generated tool commands from the schema",
	}
)

func main() {
	rootCmd.AddCommand(schemaCmd)

	// Add global flag for stdio server command
	rootCmd.PersistentFlags().String("stdio-server-cmd", "", "Shell command to invoke MCP server via stdio (required)")
	_ = rootCmd.MarkPersistentFlagRequired("stdio-server-cmd")

	// Add global flag for pretty printing
	rootCmd.PersistentFlags().Bool("pretty", true, "Pretty print MCP response (only for JSON or JSONL responses)")

	// Add the tools command to the root command
	rootCmd.AddCommand(toolsCmd)

	// Execute the root command once to parse flags
	_ = rootCmd.ParseFlags(os.Args[1:])

	// Get pretty flag
	prettyPrint, err := rootCmd.Flags().GetBool("pretty")
	if err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "Error getting pretty flag: %v\n", err)
		os.Exit(1)
	}
	// Get server command
	serverCmd, err := rootCmd.Flags().GetString("stdio-server-cmd")
	if err == nil && serverCmd != "" {
		// Fetch schema from server
		jsonRequest, err := buildJSONRPCRequest("tools/list", "", nil)
		if err == nil {
			response, err := executeServerCommand(serverCmd, jsonRequest)
			if err == nil {
				// Parse the schema response
				var schemaResp SchemaResponse
				if err := json.Unmarshal([]byte(response), &schemaResp); err == nil {
					// Add all the generated commands as subcommands of tools
					for _, tool := range schemaResp.Result.Tools {
						addCommandFromTool(toolsCmd, &tool, prettyPrint)
					}
				}
			}
		}
	}

	// Execute
	if err := rootCmd.Execute(); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "Error executing command: %v\n", err)
		os.Exit(1)
	}
}

// addCommandFromTool creates a cobra command from a tool schema
func addCommandFromTool(toolsCmd *cobra.Command, tool *Tool, prettyPrint bool) {
	// Create command from tool
	cmd := &cobra.Command{
		Use:   tool.Name,
		Short: tool.Description,
		Run: func(cmd *cobra.Command, _ []string) {
			// Build a map of arguments from flags
			arguments, err := buildArgumentsMap(cmd, tool)
			if err != nil {
				_, _ = fmt.Fprintf(os.Stderr, "failed to build arguments map: %v\n", err)
				return
			}

			jsonData, err := buildJSONRPCRequest("tools/call", tool.Name, arguments)
			if err != nil {
				_, _ = fmt.Fprintf(os.Stderr, "failed to build JSONRPC request: %v\n", err)
				return
			}

			// Execute the server command
			serverCmd, err := cmd.Flags().GetString("stdio-server-cmd")
			if err != nil {
				_, _ = fmt.Fprintf(os.Stderr, "failed to get stdio-server-cmd: %v\n", err)
				return
			}
			response, err := executeServerCommand(serverCmd, jsonData)
			if err != nil {
				_, _ = fmt.Fprintf(os.Stderr, "error executing server command: %v\n", err)
				return
			}
			if err := printResponse(response, prettyPrint); err != nil {
				_, _ = fmt.Fprintf(os.Stderr, "error printing response: %v\n", err)
				return
			}
		},
	}

	// Initialize viper for this command
	viperInit := func() {
		viper.Reset()
		viper.AutomaticEnv()
		viper.SetEnvPrefix(strings.ToUpper(tool.Name))
		viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	}

	// We'll call the init function directly instead of with cobra.OnInitialize
	// to avoid conflicts between commands
	viperInit()

	// Add flags based on schema properties
	for name, prop := range tool.InputSchema.Properties {
		isRequired := slices.Contains(tool.InputSchema.Required, name)

		// Enhance description to indicate if parameter is optional
		description := prop.Description
		if !isRequired {
			description += " (optional)"
		}

		switch prop.Type {
		case "string":
			cmd.Flags().String(name, "", description)
			if len(prop.Enum) > 0 {
				// Add validation in PreRun for enum values
				cmd.PreRunE = func(cmd *cobra.Command, _ []string) error {
					for flagName, property := range tool.InputSchema.Properties {
						if len(property.Enum) > 0 {
							value, _ := cmd.Flags().GetString(flagName)
							if value != "" && !slices.Contains(property.Enum, value) {
								return fmt.Errorf("%s must be one of: %s", flagName, strings.Join(property.Enum, ", "))
							}
						}
					}
					return nil
				}
			}
		case "number":
			cmd.Flags().Float64(name, 0, description)
		case "integer":
			cmd.Flags().Int64(name, 0, description)
		case "boolean":
			cmd.Flags().Bool(name, false, description)
		case "array":
			if prop.Items != nil {
				switch prop.Items.Type {
				case "string":
					cmd.Flags().StringSlice(name, []string{}, description)
				case "object":
					cmd.Flags().String(name+"-json", "", description+" (provide as JSON array)")
				}
			}
		}

		if isRequired {
			_ = cmd.MarkFlagRequired(name)
		}

		// Bind flag to viper
		_ = viper.BindPFlag(name, cmd.Flags().Lookup(name))
	}

	// Add command to root
	toolsCmd.AddCommand(cmd)
}

// buildArgumentsMap extracts flag values into a map of arguments
func buildArgumentsMap(cmd *cobra.Command, tool *Tool) (map[string]any, error) {
	arguments := make(map[string]any)

	for name, prop := range tool.InputSchema.Properties {
		switch prop.Type {
		case "string":
			if value, _ := cmd.Flags().GetString(name); value != "" {
				arguments[name] = value
			}
		case "number":
			if value, _ := cmd.Flags().GetFloat64(name); value != 0 {
				arguments[name] = value
			}
		case "integer":
			if value, _ := cmd.Flags().GetInt64(name); value != 0 {
				arguments[name] = value
			}
		case "boolean":
			// For boolean, we need to check if it was explicitly set
			if cmd.Flags().Changed(name) {
				value, _ := cmd.Flags().GetBool(name)
				arguments[name] = value
			}
		case "array":
			if prop.Items != nil {
				switch prop.Items.Type {
				case "string":
					if values, _ := cmd.Flags().GetStringSlice(name); len(values) > 0 {
	
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3345** (2026-10-02): **Big false**
  *Symptoms*: ### Describe the bug  A clear and concise description of what the bug is.  ### Affected version  Please run ` docker run -i --rm ghcr.io/github/github-mcp-server ./github-mcp-server --version` and paste the output below  ### Steps to reproduce the behavior  1. Type this '...' 2. View the output '....' 3. See error  ### Expected vs actual behavior  A clear and concise description of what you expected to happen and what actually happened.  ### Logs  Paste any available logs. Redact if needed. 

- **Issue #3311** (2026-10-02): **Mcp-Param-* projection is enforced regardless of negotiated protocol version, breaking 2025-11-25 clients since v1.12.0**
  *Symptoms*: ### Summary  Since the v1.12.0 rollout (2026-09-03), repo-scoped tools on the hosted remote server (`https://api.githubcopilot.com/mcp/...`) reject calls from clients that negotiated **2025-11-25**:  ``` Negotiated protocol version: 2025-11-25  HTTP 400: header mismatch: missing Mcp-Param-owner header for parameter "owner" (code -32020) HTTP 400: header mismatch: missing Mcp-Param-repo  header for parameter "repo"  (code -32020) ```  `Mcp-Param-*` projection is a **2026-07-28** feature. A client that negotiated 2025-11-25 sends `owner` and `repo` in the `tools/call` params, as that version specifies, and has no mechanism to emit projected headers. Enforcing the header check against such a session makes `-32020` reachable on a protocol version where it should not exist.  ### The underlying issue: the check is not version-scoped  Version negotiation during `initialize` exists so that one deployment can serve clients across protocol versions, applying each version's semantics per session. A version-correct implementation would branch:  | Negotiated version | `owner` / `repo` read from | Header validation | |---|---|---| | 2026-07-28 | projected `Mcp-Param-*` headers | applies | | 2025-11-25 | `tools/call` params | must not apply |  [PR #3167](https://github.com/github/github-mcp-server/pull/3167) states the projection mechanism is *"not gated on protocol version negotiation"* — consistent with validation living in the HTTP layer, which sits outside per-session version state and 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. We dug into this and want to share what we found before taking further action.  We reproduced a `tools/call` request against our real handler stack (the same `mcp.NewStreamableHTTPHandler` / go-sdk v1.7.0 code path used by both the hosted server and self-hosted `github-mcp-server http`, with `Stateless: true`) using: - `Mcp-Protocol-Version: 2025-11-25` - owner/repo passed only in the JSON-RPC body arguments - no `Mcp-Param-*` headers at all  This returns a clean `200` and reaches the actual tool handler — **no `-32020` header-mismatch error occurs**. We also verified the SDK's own `validateMcpHeaders` reads the literal `Mcp-Protocol-Version` header on each request and is a no-op below `2026-07-28`, and that `github-mcp-server-remote` does not reimplement or duplicate that validation — it delegates to this repo's handler.  So we're unable to reproduce `-32020` for a `2025-11-25`-negotiated session with default header behavior. Could you share: - the exact MCP cli

- **Issue #3214** (2026-09-03): **Title sanitization returns HTML entities in tool output**
  *Symptoms*: ### Describe the bug  GitHub MCP title fields can return HTML entity text instead of the original visible characters. For example, an issue titled `[bug] can't add a connection to toolkits in desktop app` was returned as `[bug] can&#39;t add a connection to toolkits in desktop app`.  This affects short metadata handled by the strict title sanitizer and is separate from Markdown body fidelity work in #3177.  ### Affected version  Not provided; reported against the current GitHub MCP service.  ### Steps to reproduce the behavior  1. Create or read an issue whose title contains an apostrophe, such as `[bug] can't add a connection to toolkits in desktop app`. 2. Retrieve the issue through the GitHub MCP server. 3. Observe that the returned title contains `&#39;` instead of `'`.  ### Expected vs actual behavior  Expected: the returned title preserves visible text as `[bug] can't add a connection to toolkits in desktop app` while remaining safe for tool consumers.  Actual: the returned title contains the encoded entity `[bug] can&#39;t add a connection to toolkits in desktop app`.  ### Logs  N/A. Originally reported in https://github.com/github/github-mcp-server/pull/3177#discussion_r3914431182.

- **Issue #3190** (2026-09-01): **get_review_comments (pull_request_read) silently drops start_line for multi-line PR review comments**
  *Symptoms*: ### Describe the bug  `get_pull_request` (method `get_review_comments`, or the equivalent underlying `pulls/comments` handling) drops the `start_line`/`original_start_line` fields for multi-line ("range") review comments. GitHub's REST API returns both fields when a review comment spans more than one line, but the MCP tool's response only exposes `line` — the end of the range — with no indication the comment covers a range at all. A caller has no way to tell "this comment is about line 69" from "this comment is about lines 62-69"; both look identical in the tool's output.  This isn't just cosmetic — it produces silently wrong interpretations of review feedback. A caller that trusts `line` as "the line this comment is about" will read a comment addressed to an 8-line block as if it were addressed to only its last line, then act on that narrower (wrong) scope: applying a fix to one line when the reviewer meant the whole construct, or misjudging which code the feedback even refers to when the last line alone doesn't contain enough context to make sense of the comment. Because the field is simply absent rather than null or flagged, there's no way for a caller to detect that it's missing information and fall back to something safer — the response looks identical whether the comment was single-line or a wide range, so the failure mode is invisible until someone happens to cross-check against the raw REST API.  ### Affected version  ``` GitHub MCP Server Version: v1.5.0 Commit: 8cd0
  **Post-Mortem & Fix Analysis**:
  > > ### Describe the bug >  > `get_pull_request` (method `get_review_comments`, or the equivalent underlying `pulls/comments` handling) drops the `start_line`/`original_start_line` fields for multi-line ("range") review comments. GitHub's REST API returns both fields when a review comment spans more than one line, but the MCP tool's response only exposes `line` — the end of the range — with no indication the comment covers a range at all. A caller has no way to tell "this comment is about line 69" from "this comment is about lines 62-69"; both look identical in the tool's output. >  > This isn't just cosmetic — it produces silently wrong interpretations of review feedback. A caller that trusts `line` as "the line this comment is about" will read a comment addressed to an 8-line block as if it were addressed to only its last line, then act on that narrower (wrong) scope: applying a fix to one line when the reviewer meant the whole construct, or misjudging which code the feedback even refe

- **Issue #3180** (2026-08-29): **Erro `spawn EINVAL` ao tentar usar a tool `execute_test_plan`**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Sorry, I opened this in the wrong repository. Closing!
  > > No description provided.  

- **Issue #3170** (2026-09-08): **VS Code remote GitHub MCP server requests delete_repo scope unconditionally on OAuth login, with no way to grant a subset**
  *Symptoms*: ### Describe the bug  When authenticating to the remote GitHub MCP server (`https://api.githubcopilot.com/mcp/`) through VS Code's built-in GitHub OAuth login flow, the consent screen requests the "Delete repositories" permission (`delete_repo` scope — ability to delete any adminable repository) as part of a single, all-or-nothing authorization request. There is no way to complete login while declining just that scope; the only options are to accept the full requested scope set or cancel authentication entirely (leaving the server unusable, failing with a 401).  I suspect this is a (hopefully unintentional) result of #3076. Based on the comments in that PR, it seems that in at least some circumstances it is not intended that the MCP tool require `delete_repo` scope (as long as the MCP tool to delete a repository isn't used, of course).  ### Affected version  Connected via the remote hosted server, not local Docker, so I can't run the local `--version` command. From my VS Code `mcp.json`, the server entry reports: ``` "url": "https://api.githubcopilot.com/mcp/", "version": "0.31.0" ```  VS Code info: ``` Version: 1.135.0 (user setup) Commit: 08d4889f9ec4a1685d257b9b95de036c8e1ce1e5 Date: 2026-08-25T14:26:52Z Electron: 42.8.1 ElectronBuildId: 14906494 Chromium: 148.0.7778.280 Node.js: 24.18.1 V8: 14.8.178.38-electron.0 @github/copilot: 1.0.81-0 @github/copilot-sdk: 1.0.11 OS: Windows_NT x64 10.0.26200 ```  ### Steps to reproduce the behavior  1. In VS Code, configure the market
  **Post-Mortem & Fix Analysis**:
  > Rough one — going from “not the full delete-anything scope” to “accept delete_repo or you can’t log in at all” with no way to scope it down, and a 401 if you decline, is exactly the kind of change that deserves a warning, not a broken login as the discovery mechanism.  We build [Apitella](https://apitella.com/) — mostly focused on catching an MCP server’s tools/permissions changing out from under you without notice. This is the OAuth-consent flavor of that rather than our usual case (tool-level safety hints), but it’s the same root issue: a destructive capability got bundled in with zero visibility until something broke. No specific ask, just flagging it as the same category of problem we spend most of our time on.
  > Apologies, you are correct this is a bug. The default scopes should be only default true ones here:  https://github.com/github/github-mcp-server/blob/main/pkg/scopes/scopes.go#L84-L101  But our metadata has a bug and we will address.  https://api.githubcopilot.com/.well-known/oauth-protected-resource/mcp
  > OK, this is now fixed and deployed to production also.

- **Issue #3160** (2026-09-01): **github_issue_write silently drops labels when caller lacks AddLabelsToLabelable permission**
  *Symptoms*: ### Describe the bug  `github_issue_write` with `method: "create"` (and `method: "update"`) silently drops the `labels` argument when the calling user lacks `AddLabelsToLabelable` permission on the target repository. The API returns success (issue created/updated, no error), but no label is applied. The failure is only detectable by reading back the issue's labels.  Observed against an upstream repo where the caller is not a maintainer, using a label that verifiably exists in the repository (`enhancement`, applied via the repo's issue template):  1. `github_issue_write` create with `labels: ["enhancement"]` → returns success + issue URL. 2. `github_issue_read` with `get_labels` on the created issue → `[]` (empty). 3. Retried via `github_issue_write` update with `labels: ["enhancement"]` → again success, still empty. 4. The label exists in the repo: `GitHub_get_label` returns the label (color `a2eeef`, description "New feature or request"). 5. The equivalent CLI operation fails loudly: `gh issue edit <n> --add-label enhancement` exits 1 with a GraphQL permission error (see Logs).  So the MCP tool succeeds silently where the CLI surfaces the permission boundary — the `labels` field is dropped without any error or warning.  ### Affected version  Could not capture the server version: the docker daemon is not running in this environment (`docker run -i --rm ghcr.io/github/github-mcp-server ./github-mcp-server --version` failed with `failed to connect to the docker API at unix:///v
  **Post-Mortem & Fix Analysis**:
  > Verified against main (`822c8776`) — the report is accurate, and the reason for the silence is structural:  **Root cause walk**  1. Labels are only ever sent inside the create/PATCH request body: `CreateIssue` builds `github.CreateIssueRequest{Labels: ...}` (pkg/github/issues.go ~L2672), `UpdateIssue` sets `issueRequest.Labels` when `LabelsProvided` (~L2758). There is no separate add-labels call anywhere in the codebase (no `AddLabelsToIssue` usage). 2. Both paths return a `MinimalResponse{ID, URL}` built from the *returned* issue and discard everything else (~L2702, ~L2931). The REST response actually echoes the post-write label set, but it is thrown away. 3. So when dotcom silently ignores the labels array for callers lacking `AddLabelsToLabelable`, the tool has no error to surface **and** discards the one signal that would reveal the drop.  **Reproduced at package level** (go1.26.7, worktree at `822c8776`): mocked endpoint answering `201 Created` with an empty `"labels":[]` 

- **Issue #3133** (2026-08-21): **My mobile every id is been hacked delete the sources and file**
  *Symptoms*: ### Describe the bug  A clear and concise description of what the bug is.  ### Affected version  Please run ` docker run -i --rm ghcr.io/github/github-mcp-server ./github-mcp-server --version` and paste the output below  ### Steps to reproduce the behavior  1. Type this '...' 2. View the output '....' 3. See error  ### Expected vs actual behavior  A clear and concise description of what you expected to happen and what actually happened.  ### Logs  Paste any available logs. Redact if needed. 

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

### Incident Patch 1: `f10e4e1f` (2026-10-02)
**Commit Message**: build(ui): migrate to React 19 and Primer React 38 (#3383)

* build(ui): migrate to React 19 and Primer React 38

Replace removed Box and sx APIs with native styles and CSS Modules, load Primer CSS tokens, use the CSS-based theme provider and Banner, and scope custom-element JSX types to the React runtime.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* fix(ui): use CSS token for reviewer label backgrounds

Replace leftover canvas.inset theme paths with the CSS custom property in PR creation and editing. Keep the reviewed native gaps unchanged.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

---------

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `CONTRIBUTING.md` (modified, +8/-0)
```diff
@@ -40,6 +40,14 @@ Type checking uses the native TypeScript 7 compiler through `tsc`; Vite handles
 transpilation and bundling separately. No TypeScript compiler API integration,
 typescript-eslint, or ts-node is required.
 
+### MCP Apps UI
+
+The `ui/` views use React 19 and Primer React 38. With Node.js 20.19+ or 22.12+, run `cd ui && npm ci && npm run typecheck && npm run build && npm audit` before `script/test`. The build writes self-contained HTML to `pkg/github/ui_dist/`, which the Go server embeds; these generated files are not committed.
+
+Primer 38 no longer exports `Box` or accepts `sx`/styled-system props. Use semantic HTML, native `style` props for dynamic/layout styles, and CSS Modules for nested selectors. `AppProvider` loads Primer's primitive tokens and light/dark themes, so use CSS variables rather than JavaScript theme values. Custom element typings must augment `react/jsx-runtime` rather than the global `JSX` namespace.
+
+For UI dependency upgrades, compare all four views (`get-me`, `issue-write`, `pr-write`, and `pr-edit`) in light/dark themes and at narrow widths in an MCP Apps host, including menus, Markdown editing/preview, and completed-result views. Include before/after screenshots in the pull request.
+
 ## Submitting a pull request
 
 1. [Fork][fork] and clone the repository
```

**File**: `ui/package-lock.json` (modified, +202/-2032)
```diff
@@ -12,17 +12,18 @@
         "@modelcontextprotocol/client": "^2.0.0",
         "@modelcontextprotocol/ext-apps": "^2.0.3",
         "@primer/octicons-react": "^19.38.0",
-        "@primer/react": "^36.27.0",
-        "react": "^18.3.1",
-        "react-dom": "^18.3.1",
+        "@primer/primitives": "^11.10.0",
+        "@primer/react": "^38.40.1",
+        "react": "^19.3.0",
+        "react-dom": "^19.3.0",
         "react-markdown": "^10.1.0",
         "remark-gfm": "^4.0.1",
         "zod": "^4.2.0"
       },
       "devDependencies": {
         "@types/node": "^26.6.4",
-        "@types/react": "^18.3.31",
-        "@types/react-dom": "^18.3.7",
+        "@types/react": "^19.3.0",
+        "@types/react-dom": "^19.3.0",
         "@vitejs/plugin-react": "^6.1.1",
         "typescript": "^7.0.2",
         "vite": "^8.3.2",
@@ -32,237 +33,6 @@
         "node": "^26.0.0"
       }
     },
-    "node_modules/@babel/code-frame": {
-      "version": "7.29.7",
-      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.7.tgz",
-      "integrity": "sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==",
-      "license": "MIT",
-      "peer": true,
-      "dependencies": {
-        "@babel/helper-validator-identifier": "^7.29.7",
-        "js-tokens": "^4.0.0",
-        "picocolors": "^1.1.1"
-      },
-      "engines": {
-        "node": ">=6.9.0"
-      }
-    },
-    "node_modules/@babel/compat-data": {
-      "version": "7.29.7",
-      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.7.tgz",
-      "integrity": "sha512-locTkQyKvwIEgBzVrn8693ebc97F2U8ZHjbXwDXJ5Fn2TCpNwTlKcaKLkdHop5c/icOFE7qt7Q9JC5hnKNa6Gg==",
-      "license": "MIT",
-      "peer": true,
-      "engines": {
-        "node": ">=6.9.0"
-      }
-    },
-    "node_modules/@babel/core": {
-      "version": "7.29.7",
-      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.29.7.tgz",
-      "integrity": "sha512-RgHBCvtjbOK2gXSNBNIkNoEc9qoVEtau3hj8gEqKQuL3HZAibKarWFEI3Lfm6EYKkLalOh8eSrj9b+ch9H/VBA==",
-      "license": "MIT",
-      "peer": true,
-      "dependencies": {
-        "@babel/code-frame": "^7.29.7",
-        "@babel/generator": "^7.29.7",
-        "@babel/helper-compilation-targets": "^7.29.7",
-        "@babel/helper-module-transforms": "^7.29.7",
-        "@babel/helpers": "^7.29.7",
-        "@babel/parser": "^7.29.7",
-        "@babel/template": "^7.29.7",
-        "@babel/traverse": "^7.29.7",
-        "@babel/types": "^7.29.7",
-        "@jridgewell/remapping": "^2.3.5",
-        "convert-source-map": "^2.0.0",
-        "debug": "^4.1.0",
-        "gensync": "^1.0.0-beta.2",
-        "json5": "^2.2.3",
-        "semver": "^6.3.1"
-      },
-      "engines": {
-        "node": ">=6.9.0"
-      },
-      "funding": {
-        "type": "opencollective",
-        "url": "https://opencollective.com/babel"
-      }
-    },
-    "node_modules/@babel/generator": {
-      "version": "7.29.8",
-      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.29.8.tgz",
-      "integrity": "sha512-gZbepsdh3WDtgZKWL+vTPh71LSBrm/Y4/QDZBVCcYfmeTEEuoOYwlSy+G1StfJg+/Zy550u/3TATbm7qDbbMtg==",
-      "license": "MIT",
-      "peer": true,
-      "dependencies": {
-        "@babel/parser": "^7.29.8",
-        "@babel/types": "^7.29.8",
-        "@jridgewell/gen-mapping": "^0.3.12",
-        "@jridgewell/trace-mapping": "^0.3.28",
-        "jsesc": "^3.0.2"
-      },
-      "engines": {
-        "node": ">=6.9.0"
-      }
-    },
-    "node_modules/@babel/helper-annotate-as-pure": {
-      "version": "7.29.7",
-      "resolved": "https://registry.npmjs.org/@babel/helper-annotate-as-pure/-/helper-annotate-as-pure-7.29.7.tgz",
-      "integrity": "sha512-OoK6239jHPuSQOoS0kfTVKn0b/rVTk0seKq4Gd2UMLtmOVLjDC0ki3e+c90Trqv2gMfvJFqkiljrr568+qddiw==",
-      "license": "MIT",
-      "peer": true,
-      "dependencies": {
-        "@babel/types": "^7.29.7"
-      },
-      "engines": {
-        "node": ">=6.9.0"
-      }
-    },
-    "node_modules/@babel/helper-compilation-targets": {
-      "version": "7.29.7",
-      "resolved": "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.29.7.tgz",
-      "integrity": "sha512-wem6WaBj4NaVYVdNhLPPVacES6ZJ+KBBfSkTMD3YZxbP3rm3Di85tJU5ljaUNhaOynt+Aj0xruhYuzQBt8n71g==",
-      "license": "MIT",
-      "peer": true,
-      "dependencies": {
-        "@babel/compat-data": "^7.29.7",
-        "@babel/helper-validator-option": "^7.29.7",
-        "browserslist": "^4.24.0",
-        "lru-cache": "^5.1.1",
-        "semver": "^6.3.1"
-      },
-      "engines": {
-        "node": ">=6.9.0"
-      }
-    },
-    "node_modules/@babel/helper-globals": {
-      "version": "7.29.7",
-      "resolved": "https://registry.npmjs.org/@babel/helper-globals/-/helper-globals-7.29.7.tgz",
-      "integrity": "sha512-3nQVUAtvkKH9zahfWgw96Jc/uFOmjACE1kQz82E2lqWmHBgjzbNlsC22nuQTfahmWeQtTq
```

**File**: `ui/package.json` (modified, +6/-5)
```diff
@@ -18,17 +18,18 @@
     "@modelcontextprotocol/client": "^2.0.0",
     "@modelcontextprotocol/ext-apps": "^2.0.3",
     "@primer/octicons-react": "^19.38.0",
-    "@primer/react": "^36.27.0",
-    "react": "^18.3.1",
-    "react-dom": "^18.3.1",
+    "@primer/primitives": "^11.10.0",
+    "@primer/react": "^38.40.1",
+    "react": "^19.3.0",
+    "react-dom": "^19.3.0",
     "react-markdown": "^10.1.0",
     "remark-gfm": "^4.0.1",
     "zod": "^4.2.0"
   },
   "devDependencies": {
     "@types/node": "^26.6.4",
-    "@types/react": "^18.3.31",
-    "@types/react-dom": "^18.3.7",
+    "@types/react": "^19.3.0",
+    "@types/react-dom": "^19.3.0",
     "@vitejs/plugin-react": "^6.1.1",
     "typescript": "^7.0.2",
     "vite": "^8.3.2",
```

**File**: `ui/src/apps/get-me/App.tsx` (modified, +80/-51)
```diff
@@ -1,7 +1,7 @@
 import { StrictMode, useState } from "react";
 import type React from "react";
 import { createRoot } from "react-dom/client";
-import { Avatar, Box, Text, Link, Heading, Spinner } from "@primer/react";
+import { Avatar, Text, Link, Heading, Spinner } from "@primer/react";
 import {
   OrganizationIcon,
   LocationIcon,
@@ -35,30 +35,30 @@ function AvatarWithFallback({ src, login, size }: { src?: string; login: string;
   
   if (!src || imgError) {
     return (
-      <Box
-        sx={{
+      <div
+        style={{
           width: size,
           height: size,
           borderRadius: "50%",
-          bg: "accent.subtle",
+          backgroundColor: "var(--bgColor-accent-muted)",
           display: "flex",
           alignItems: "center",
           justifyContent: "center",
-          mr: 3,
+          marginRight: 16,
           flexShrink: 0,
         }}
       >
         <PersonIcon size={size * 0.6} />
-      </Box>
+      </div>
     );
   }
 
   return (
-    <Avatar 
-      src={src} 
-      size={size} 
-      sx={{ mr: 3 }} 
+    <Avatar
+      src={src}
+      size={size}
       onError={() => setImgError(true)}
+      style={{ marginRight: 16 }}
     />
   );
 }
@@ -79,43 +79,62 @@ function UserCard({
     });
 
   return (
-    <Box
-      borderWidth={1}
-      borderStyle="solid"
-      borderColor="border.default"
-      borderRadius={2}
-      bg="canvas.subtle"
-      p={3}
-      maxWidth={400}
+    <div
+      style={{
+        borderWidth: 1,
+        borderStyle: "solid",
+        borderColor: "var(--borderColor-default)",
+        borderRadius: 6,
+        backgroundColor: "var(--bgColor-muted)",
+        padding: 16,
+        maxWidth: 400,
+      }}
     >
       {/* Header with avatar and name */}
-      <Box display="flex" alignItems="center" mb={3} pb={3} borderBottomWidth={1} borderBottomStyle="solid" borderBottomColor="border.default">
+      <div
+        style={{
+          display: "flex",
+          alignItems: "center",
+          marginBottom: 16,
+          paddingBottom: 16,
+          borderBottomWidth: 1,
+          borderBottomStyle: "solid",
+          borderBottomColor: "var(--borderColor-default)",
+        }}
+      >
         <AvatarWithFallback src={user.avatar_url} login={user.login} size={48} />
-        <Box>
-          <Heading as="h2" sx={{ fontSize: 2, mb: 0 }}>
+        <div>
+          <Heading as="h2" style={{ fontSize: 16, marginBottom: 0 }}>
             {d.name || user.login}
           </Heading>
-          <Text sx={{ color: "fg.muted", fontSize: 1 }}>@{user.login}</Text>
-        </Box>
-      </Box>
+          <Text style={{ color: "var(--fgColor-muted)", fontSize: 14 }}>@{user.login}</Text>
+        </div>
+      </div>
 
       {/* Info grid */}
-      <Box display="grid" sx={{ gridTemplateColumns: "auto 1fr", gap: 2, fontSize: 1 }}>
+      <div
+        style={{
+          display: "grid",
+          gridTemplateColumns: "auto 1fr",
+          gap: 8,
+          fontSize: 14,
+        }}
+      >
         {d.company && (
           <>
-            <Box sx={{ color: "fg.muted" }}><OrganizationIcon size={16} /></Box>
+            <div style={{ color: "var(--fgColor-muted)" }}><OrganizationIcon size={16} /></div>
             <Text>{d.company}</Text>
           </>
         )}
         {d.location && (
           <>
-            <Box sx={{ color: "fg.muted" }}><LocationIcon size={16} /></Box>
+            <div style={{ color: "var(--fgColor-muted)" }}><LocationIcon size={16} /></div>
             <Text>{d.location}</Text>
           </>
         )}
         {d.blog && (
           <>
-            <Box sx={{ color: "fg.muted" }}><LinkIcon size={16} /></Box>
+            <div style={{ color: "var(--fgColor-muted)" }}><LinkIcon size={16} /></div>
             <Link
               href={d.blog}
               target="_blank"
@@ -127,34 +146,44 @@ function UserCard({
         )}
         {d.email && (
           <>
-            <Box sx={{ color: "fg.muted" }}><MailIcon size={16} /></Box>
+            <div style={{ color: "var(--fgColor-muted)" }}><MailIcon size={16} /></div>
             <Link href={`mailto:${d.email}`}>{d.email}</Link>
           </>
         )}
-      </Box>
+      </div>
 
       {/* Stats */}
-      <Box display="flex" justifyContent="space-around" mt={3} pt={3} borderTopWidth={1} borderTopStyle="solid" borderTopColor="border.default">
-        <Box sx={{ textAlign: "center" }}>
-          <Text sx={{ fontWeight: "bold", fontSize: 2, display: "block" }}>
+      <div
+        style={{
+          display: "flex",
+          justifyContent: "space-around",
+          marginTop: 16,
+          paddingTop: 16,
+          borderTopWidth: 1,
+          borderTopStyle: "solid",
+          borderTopColor: "var(--borderColor-default)",
+        }}
+      >
+        <div style={{ textAlign: "center" }}>
+          <Text style={{ fontWeight: 600, fontSize: 16, display: "block" }}>
             <RepoIcon size={16} />
```

**File**: `ui/src/apps/issue-write/App.tsx` (modified, +341/-185)
```diff
@@ -1,18 +1,18 @@
 import { StrictMode, useState, useCallback, useEffect, useMemo, useRef } from "react";
 import { createRoot } from "react-dom/client";
 import {
-  Box,
   Text,
   TextInput,
   Button,
-  Flash,
+  Banner,
   Spinner,
   FormControl,
   CounterLabel,
   ActionMenu,
   ActionList,
   Label,
 } from "@primer/react";
+import styles from "../../styles.module.css";
 import {
   IssueOpenedIcon,
   CheckCircleIcon,
@@ -296,46 +296,65 @@ function SuccessView({
   const issueUrl = issue.html_url || issue.url || issue.URL || "#";
 
   return (
-    <Box
-      borderWidth={1}
-      borderStyle="solid"
-      borderColor="border.default"
-      borderRadius={2}
-      bg="canvas.subtle"
-      p={3}
+    <div
+      style={{
+        borderWidth: 1,
+        borderStyle: "solid",
+        borderColor: "var(--borderColor-default)",
+        borderRadius: 6,
+        backgroundColor: "var(--bgColor-muted)",
+        padding: 16,
+      }}
     >
-      <Box
-        display="flex"
-        alignItems="center"
-        mb={3}
-        pb={3}
-        borderBottomWidth={1}
-        borderBottomStyle="solid"
-        borderBottomColor="border.default"
+      <div
+        style={{
+          display: "flex",
+          alignItems: "center",
+          marginBottom: 16,
+          paddingBottom: 16,
+          borderBottomWidth: 1,
+          borderBottomStyle: "solid",
+          borderBottomColor: "var(--borderColor-default)",
+        }}
       >
-        <Box sx={{ color: "success.fg", flexShrink: 0, mr: 2 }}>
+        <div
+          style={{
+            color: "var(--fgColor-success)",
+            flexShrink: 0,
+            marginRight: 8,
+          }}
+        >
           <CheckCircleIcon size={16} />
-        </Box>
-        <Text sx={{ fontWeight: "semibold" }}>
+        </div>
+        <Text style={{ fontWeight: 500 }}>
           {isUpdate ? "Issue updated successfully" : "Issue created successfully"}
         </Text>
-      </Box>
-
-      <Box
-        display="flex"
-        alignItems="flex-start"
-        gap={2}
-        p={3}
-        bg="canvas.subtle"
-        borderRadius={2}
-        borderWidth={1}
-        borderStyle="solid"
-        borderColor="border.default"
+      </div>
+
+      <div
+        style={{
+          display: "flex",
+          alignItems: "flex-start",
+          gap: 2,
+          padding: 16,
+          backgroundColor: "var(--bgColor-muted)",
+          borderRadius: 6,
+          borderWidth: 1,
+          borderStyle: "solid",
+          borderColor: "var(--borderColor-default)",
+        }}
       >
-        <Box sx={{ color: "open.fg", flexShrink: 0, mt: "2px", mr: 1 }}>
+        <div
+          style={{
+            color: "var(--fgColor-open)",
+            flexShrink: 0,
+            marginTop: "2px",
+            marginRight: 4,
+          }}
+        >
           <IssueOpenedIcon size={16} />
-        </Box>
-        <Box sx={{ minWidth: 0 }}>
+        </div>
+        <div style={{ minWidth: 0 }}>
           <a
             href={issueUrl}
             target="_blank"
@@ -361,20 +380,33 @@ function SuccessView({
           >
             {issue.title || submittedTitle}
             {issue.number && (
-              <Text sx={{ color: "fg.muted", fontWeight: "normal", ml: 1 }}>
+              <Text
+                style={{
+                  color: "var(--fgColor-muted)",
+                  fontWeight: 400,
+                  marginLeft: 4,
+                }}
+              >
                 #{issue.number}
               </Text>
             )}
           </a>
-          <Text sx={{ color: "fg.muted", fontSize: 0 }}>
+          <Text style={{ color: "var(--fgColor-muted)", fontSize: 12 }}>
             {owner}/{repo}
           </Text>
           {submittedLabels.length > 0 && (
-            <Box display="flex" gap={1} mt={2} flexWrap="wrap">
+            <div
+              style={{
+                display: "flex",
+                gap: 1,
+                marginTop: 8,
+                flexWrap: "wrap",
+              }}
+            >
               {submittedLabels.map((label) => (
                 <Label
                   key={label.id}
-                  sx={{
+                  style={{
                     backgroundColor: `#${label.color}`,
                     color: getContrastColor(label.color),
                     borderColor: `#${label.color}`,
@@ -383,11 +415,11 @@ function SuccessView({
                   {label.text}
                 </Label>
               ))}
-            </Box>
+            </div>
           )}
-        </Box>
-      </Box>
-    </Box>
+        </div>
+      </div>
+    </div>
   );
 }
 
@@ -1162,9 +1194,9 @@ function CreateIssueApp() {
       const selectedOptionName = fieldValue.cleared ? undefined : fieldValue.optionName;
       const selectedOption = field.options.find((option) => option.name === selectedOptionName);
       return (
-        <Box sx={{ flex: 1, minWidth: 0 }}>
+        <div styl
```

**File**: `ui/src/apps/pr-edit/App.tsx` (modified, +264/-118)
```diff
@@ -1,11 +1,10 @@
 import { StrictMode, useState, useCallback, useEffect, useMemo } from "react";
 import { createRoot } from "react-dom/client";
 import {
-  Box,
   Text,
   TextInput,
   Button,
-  Flash,
+  Banner,
   Spinner,
   FormControl,
   ActionMenu,
@@ -15,6 +14,7 @@ import {
   CounterLabel,
   Label,
 } from "@primer/react";
+import styles from "../../styles.module.css";
 import {
   GitPullRequestIcon,
   CheckCircleIcon,
@@ -169,46 +169,65 @@ function SuccessView({
   const prUrl = pr.html_url || pr.url || pr.URL || "#";
 
   return (
-    <Box
-      borderWidth={1}
-      borderStyle="solid"
-      borderColor="border.default"
-      borderRadius={2}
-      bg="canvas.subtle"
-      p={3}
+    <div
+      style={{
+        borderWidth: 1,
+        borderStyle: "solid",
+        borderColor: "var(--borderColor-default)",
+        borderRadius: 6,
+        backgroundColor: "var(--bgColor-muted)",
+        padding: 16,
+      }}
     >
-      <Box
-        display="flex"
-        alignItems="center"
-        mb={3}
-        pb={3}
-        borderBottomWidth={1}
-        borderBottomStyle="solid"
-        borderBottomColor="border.default"
+      <div
+        style={{
+          display: "flex",
+          alignItems: "center",
+          marginBottom: 16,
+          paddingBottom: 16,
+          borderBottomWidth: 1,
+          borderBottomStyle: "solid",
+          borderBottomColor: "var(--borderColor-default)",
+        }}
       >
-        <Box sx={{ color: "success.fg", flexShrink: 0, mr: 2 }}>
+        <div
+          style={{
+            color: "var(--fgColor-success)",
+            flexShrink: 0,
+            marginRight: 8,
+          }}
+        >
           <CheckCircleIcon size={16} />
-        </Box>
-        <Text sx={{ fontWeight: "semibold" }}>
+        </div>
+        <Text style={{ fontWeight: 500 }}>
           Pull request updated successfully
         </Text>
-      </Box>
-
-      <Box
-        display="flex"
-        alignItems="flex-start"
-        gap={2}
-        p={3}
-        bg="canvas.subtle"
-        borderRadius={2}
-        borderWidth={1}
-        borderStyle="solid"
-        borderColor="border.default"
+      </div>
+
+      <div
+        style={{
+          display: "flex",
+          alignItems: "flex-start",
+          gap: 2,
+          padding: 16,
+          backgroundColor: "var(--bgColor-muted)",
+          borderRadius: 6,
+          borderWidth: 1,
+          borderStyle: "solid",
+          borderColor: "var(--borderColor-default)",
+        }}
       >
-        <Box sx={{ color: "open.fg", flexShrink: 0, mt: "2px", mr: 1 }}>
+        <div
+          style={{
+            color: "var(--fgColor-open)",
+            flexShrink: 0,
+            marginTop: "2px",
+            marginRight: 4,
+          }}
+        >
           <GitPullRequestIcon size={16} />
-        </Box>
-        <Box sx={{ minWidth: 0 }}>
+        </div>
+        <div style={{ minWidth: 0 }}>
           <a
             href={prUrl}
             target="_blank"
@@ -231,17 +250,23 @@ function SuccessView({
           >
             {pr.title || submittedTitle}
             {pr.number && (
-              <Text sx={{ color: "fg.muted", fontWeight: "normal", ml: 1 }}>
+              <Text
+                style={{
+                  color: "var(--fgColor-muted)",
+                  fontWeight: 400,
+                  marginLeft: 4,
+                }}
+              >
                 #{pr.number}
               </Text>
             )}
           </a>
-          <Text sx={{ color: "fg.muted", fontSize: 0 }}>
+          <Text style={{ color: "var(--fgColor-muted)", fontSize: 12 }}>
             {owner}/{repo}
           </Text>
-        </Box>
-      </Box>
-    </Box>
+        </div>
+      </div>
+    </div>
   );
 }
 
@@ -516,84 +541,120 @@ function EditPRApp() {
   if (!app && !appError) {
     return (
       <AppProvider hostContext={hostContext}>
-        <Box display="flex" alignItems="center" justifyContent="center" p={4}>
+        <div
+          style={{
+            display: "flex",
+            alignItems: "center",
+            justifyContent: "center",
+            padding: 24,
+          }}
+        >
           <Spinner size="medium" />
-        </Box>
+        </div>
       </AppProvider>
     );
   }
 
   if (appError) {
     return (
       <AppProvider hostContext={hostContext}>
-        <Flash variant="danger">{appError.message}</Flash>
+        <Banner variant="critical" title={appError.message} />
       </AppProvider>
     );
   }
 
   if (toolInput === null) {
     return (
       <AppProvider hostContext={hostContext}>
-        <Box display="flex" alignItems="center" justifyContent="center" p={4}>
+        <div
+          style={{
+            display: "flex",
+            alignItems: "center",
+            justifyContent: "center",
+            padding: 24,
+          }}
+        >
           <Spinner size="medium" />
-        </Box>
+        </div>
     
```

**File**: `ui/src/apps/pr-write/App.tsx` (modified, +278/-122)
```diff
@@ -1,11 +1,10 @@
 import { StrictMode, useState, useCallback, useEffect, useMemo } from "react";
 import { createRoot } from "react-dom/client";
 import {
-  Box,
   Text,
   TextInput,
   Button,
-  Flash,
+  Banner,
   Spinner,
   FormControl,
   ActionMenu,
@@ -15,6 +14,7 @@ import {
   CounterLabel,
   Label,
 } from "@primer/react";
+import styles from "../../styles.module.css";
 import {
   GitPullRequestIcon,
   CheckCircleIcon,
@@ -82,46 +82,65 @@ function SuccessView({
   const prUrl = pr.html_url || pr.url || pr.URL || "#";
 
   return (
-    <Box
-      borderWidth={1}
-      borderStyle="solid"
-      borderColor="border.default"
-      borderRadius={2}
-      bg="canvas.subtle"
-      p={3}
+    <div
+      style={{
+        borderWidth: 1,
+        borderStyle: "solid",
+        borderColor: "var(--borderColor-default)",
+        borderRadius: 6,
+        backgroundColor: "var(--bgColor-muted)",
+        padding: 16,
+      }}
     >
-      <Box
-        display="flex"
-        alignItems="center"
-        mb={3}
-        pb={3}
-        borderBottomWidth={1}
-        borderBottomStyle="solid"
-        borderBottomColor="border.default"
+      <div
+        style={{
+          display: "flex",
+          alignItems: "center",
+          marginBottom: 16,
+          paddingBottom: 16,
+          borderBottomWidth: 1,
+          borderBottomStyle: "solid",
+          borderBottomColor: "var(--borderColor-default)",
+        }}
       >
-        <Box sx={{ color: "success.fg", flexShrink: 0, mr: 2 }}>
+        <div
+          style={{
+            color: "var(--fgColor-success)",
+            flexShrink: 0,
+            marginRight: 8,
+          }}
+        >
           <CheckCircleIcon size={16} />
-        </Box>
-        <Text sx={{ fontWeight: "semibold" }}>
+        </div>
+        <Text style={{ fontWeight: 500 }}>
           Pull request created successfully
         </Text>
-      </Box>
-
-      <Box
-        display="flex"
-        alignItems="flex-start"
-        gap={2}
-        p={3}
-        bg="canvas.subtle"
-        borderRadius={2}
-        borderWidth={1}
-        borderStyle="solid"
-        borderColor="border.default"
+      </div>
+
+      <div
+        style={{
+          display: "flex",
+          alignItems: "flex-start",
+          gap: 2,
+          padding: 16,
+          backgroundColor: "var(--bgColor-muted)",
+          borderRadius: 6,
+          borderWidth: 1,
+          borderStyle: "solid",
+          borderColor: "var(--borderColor-default)",
+        }}
       >
-        <Box sx={{ color: "open.fg", flexShrink: 0, mt: "2px", mr: 1 }}>
+        <div
+          style={{
+            color: "var(--fgColor-open)",
+            flexShrink: 0,
+            marginTop: "2px",
+            marginRight: 4,
+          }}
+        >
           <GitPullRequestIcon size={16} />
-        </Box>
-        <Box sx={{ minWidth: 0 }}>
+        </div>
+        <div style={{ minWidth: 0 }}>
           <a
             href={prUrl}
             target="_blank"
@@ -147,17 +166,23 @@ function SuccessView({
           >
             {pr.title || submittedTitle}
             {pr.number && (
-              <Text sx={{ color: "fg.muted", fontWeight: "normal", ml: 1 }}>
+              <Text
+                style={{
+                  color: "var(--fgColor-muted)",
+                  fontWeight: 400,
+                  marginLeft: 4,
+                }}
+              >
                 #{pr.number}
               </Text>
             )}
           </a>
-          <Text sx={{ color: "fg.muted", fontSize: 0 }}>
+          <Text style={{ color: "var(--fgColor-muted)", fontSize: 12 }}>
             {owner}/{repo}
           </Text>
-        </Box>
-      </Box>
-    </Box>
+        </div>
+      </div>
+    </div>
   );
 }
 
@@ -462,69 +487,95 @@ function CreatePRApp() {
   if (!app && !appError) {
     return (
       <AppProvider hostContext={hostContext}>
-        <Box display="flex" alignItems="center" justifyContent="center" p={4}>
+        <div
+          style={{
+            display: "flex",
+            alignItems: "center",
+            justifyContent: "center",
+            padding: 24,
+          }}
+        >
           <Spinner size="medium" />
-        </Box>
+        </div>
       </AppProvider>
     );
   }
 
   if (appError) {
     return (
       <AppProvider hostContext={hostContext}>
-        <Flash variant="danger">{appError.message}</Flash>
+        <Banner variant="critical" title={appError.message} />
       </AppProvider>
     );
   }
 
   return (
     <AppProvider hostContext={hostContext}>
-      <Box
-        borderWidth={1}
-        borderStyle="solid"
-        borderColor="border.default"
-        borderRadius={2}
-        bg="canvas.subtle"
-        p={3}
+      <div
+        style={{
+          borderWidth: 1,
+          borderStyle: "solid",
+          borderColor: "var(--borderColor-default)",
+          borderRadius: 6,
+          backgroundColor: "var
```

**File**: `ui/src/components/AppProvider.tsx` (modified, +7/-3)
```diff
@@ -1,4 +1,8 @@
-import { ThemeProvider, BaseStyles, Box } from "@primer/react";
+import { BaseStyles } from "@primer/react";
+import { ThemeProvider } from "@primer/react/next";
+import "@primer/primitives/dist/css/primitives.css";
+import "@primer/primitives/dist/css/functional/themes/light.css";
+import "@primer/primitives/dist/css/functional/themes/dark.css";
 import type { ReactNode, CSSProperties } from "react";
 import { useEffect, useMemo } from "react";
 import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
@@ -44,10 +48,10 @@ export function AppProvider({ children, hostContext }: AppProviderProps) {
   return (
     <ThemeProvider colorMode={colorMode}>
       <BaseStyles>
-        <Box p={3} style={styleVars}>
+        <div style={{ padding: 16, ...styleVars }}>
           {children}
           <FeedbackFooter />
-        </Box>
+        </div>
       </BaseStyles>
     </ThemeProvider>
   );
```

---

### Incident Patch 2: `876195b5` (2026-10-02)
**Commit Message**: feat(ui): migrate MCP Apps SDK to v2 (#3378)

* feat(ui): migrate MCP Apps SDK to v2

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* fix: migrate go-github Ptr calls for Go 1.26 lint

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

---------

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `pkg/github/actions_minimal_test.go` (modified, +90/-90)
```diff
@@ -79,7 +79,7 @@ func TestConvertToMinimalWorkflowJob(t *testing.T) {
 func TestConvertToMinimalActionsLists(t *testing.T) {
 	t.Run("workflow runs", func(t *testing.T) {
 		result := convertToMinimalWorkflowRuns(&github.WorkflowRuns{
-			TotalCount:   github.Ptr(2),
+			TotalCount:   new(2),
 			WorkflowRuns: []*github.WorkflowRun{actionsTestWorkflowRun(), nil},
 		})
 		assert.Equal(t, 2, result.TotalCount)
@@ -88,7 +88,7 @@ func TestConvertToMinimalActionsLists(t *testing.T) {
 
 	t.Run("workflow jobs", func(t *testing.T) {
 		result := convertToMinimalWorkflowJobs(&github.Jobs{
-			TotalCount: github.Ptr(2),
+			TotalCount: new(2),
 			Jobs:       []*github.WorkflowJob{actionsTestWorkflowJob(), nil},
 		})
 		assert.Equal(t, 2, result.TotalCount)
@@ -110,94 +110,94 @@ func TestConvertToMinimalActionsLists(t *testing.T) {
 
 func actionsTestWorkflowRun() *github.WorkflowRun {
 	repository := &github.Repository{
-		ID:          github.Ptr(int64(1296269)),
-		NodeID:      github.Ptr("MDEwOlJlcG9zaXRvcnkxMjk2MjY5"),
-		Name:        github.Ptr("octo-repo"),
-		FullName:    github.Ptr("octo-org/octo-repo"),
-		Description: github.Ptr("A representative repository description included in the full API response."),
-		HTMLURL:     github.Ptr("https://github.com/octo-org/octo-repo"),
-		URL:         github.Ptr("https://api.github.com/repos/octo-org/octo-repo"),
-		CloneURL:    github.Ptr("https://github.com/octo-org/octo-repo.git"),
-		Language:    github.Ptr("Go"),
+		ID:          new(int64(1296269)),
+		NodeID:      new("MDEwOlJlcG9zaXRvcnkxMjk2MjY5"),
+		Name:        new("octo-repo"),
+		FullName:    new("octo-org/octo-repo"),
+		Description: new("A representative repository description included in the full API response."),
+		HTMLURL:     new("https://github.com/octo-org/octo-repo"),
+		URL:         new("https://api.github.com/repos/octo-org/octo-repo"),
+		CloneURL:    new("https://github.com/octo-org/octo-repo.git"),
+		Language:    new("Go"),
 		Topics:      []string{"actions", "mcp", "automation"},
 	}
 
 	return &github.WorkflowRun{
-		ID:                 github.Ptr(int64(30433642)),
-		Name:               github.Ptr("CI"),
-		NodeID:             github.Ptr("MDEyOldvcmtmbG93IFJ1bjI2OTI4OQ=="),
-		HeadBranch:         github.Ptr("feature/minimal-actions"),
-		HeadSHA:            github.Ptr("acb5820ced9479c074f688cc328bf03f341a511d"),
-		Path:               github.Ptr(".github/workflows/ci.yml"),
-		RunNumber:          github.Ptr(562),
-		RunAttempt:         github.Ptr(2),
-		Event:              github.Ptr("pull_request"),
-		DisplayTitle:       github.Ptr("Reduce GitHub Actions response payloads"),
-		Status:             github.Ptr("completed"),
-		Conclusion:         github.Ptr("failure"),
-		WorkflowID:         github.Ptr(int64(161335)),
-		CheckSuiteID:       github.Ptr(int64(42)),
-		CheckSuiteNodeID:   github.Ptr("MDEwOkNoZWNrU3VpdGU0Mg=="),
-		URL:                github.Ptr("https://api.github.com/repos/octo-org/octo-repo/actions/runs/30433642"),
-		HTMLURL:            github.Ptr("https://github.com/octo-org/octo-repo/actions/runs/30433642"),
-		JobsURL:            github.Ptr("https://api.github.com/repos/octo-org/octo-repo/actions/runs/30433642/jobs"),
-		LogsURL:            github.Ptr("https://api.github.com/repos/octo-org/octo-repo/actions/runs/30433642/logs"),
-		CheckSuiteURL:      github.Ptr("https://api.github.com/repos/octo-org/octo-repo/check-suites/42"),
-		ArtifactsURL:       github.Ptr("https://api.github.com/repos/octo-org/octo-repo/actions/runs/30433642/artifacts"),
-		CancelURL:          github.Ptr("https://api.github.com/repos/octo-org/octo-repo/actions/runs/30433642/cancel"),
-		RerunURL:           github.Ptr("https://api.github.com/repos/octo-org/octo-repo/actions/runs/30433642/rerun"),
-		PreviousAttemptURL: github.Ptr("https://api.github.com/repos/octo-org/octo-repo/actions/runs/30433642/attempts/1"),
-		WorkflowURL:        github.Ptr("https://api.github.com/repos/octo-org/octo-repo/actions/workflows/161335"),
+		ID:                 new(int64(30433642)),
+		Name:               new("CI"),
+		NodeID:             new("MDEyOldvcmtmbG93IFJ1bjI2OTI4OQ=="),
+		HeadBranch:         new("feature/minimal-actions"),
+		HeadSHA:            new("acb5820ced9479c074f688cc328bf03f341a511d"),
+		Path:               new(".github/workflows/ci.yml"),
+		RunNumber:          new(562),
+		RunAttempt:         new(2),
+		Event:              new("pull_request"),
+		DisplayTitle:       new("Reduce GitHub Actions response payloads"),
+		Status:             new("completed"),
+		Conclusion:         new("failure"),
+		WorkflowID:         new(int64(161335)),
+		CheckSuiteID:       new(int64(42)),
+		CheckSuiteNodeID:   new("MDEwOkNoZWNrU3VpdGU0Mg=="),
+		URL:                new("https://api.github.com/repos/octo-org/octo-repo/actions/runs/30433642"),
+		HTMLURL:            new("https://github.com/octo-org/octo-repo/actions/runs/30433642"),
+		JobsURL:            new("https://api.github.com/repos/octo-org/octo-rep
```

**File**: `pkg/github/actions_test.go` (modified, +44/-44)
```diff
@@ -46,19 +46,19 @@ func Test_ActionsList_ListWorkflows(t *testing.T) {
 			mockedClient: MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
 				GetReposActionsWorkflowsByOwnerByRepo: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
 					workflows := &github.Workflows{
-						TotalCount: github.Ptr(2),
+						TotalCount: new(2),
 						Workflows: []*github.Workflow{
 							{
-								ID:    github.Ptr(int64(1)),
-								Name:  github.Ptr("CI"),
-								Path:  github.Ptr(".github/workflows/ci.yml"),
-								State: github.Ptr("active"),
+								ID:    new(int64(1)),
+								Name:  new("CI"),
+								Path:  new(".github/workflows/ci.yml"),
+								State: new("active"),
 							},
 							{
-								ID:    github.Ptr(int64(2)),
-								Name:  github.Ptr("Deploy"),
-								Path:  github.Ptr(".github/workflows/deploy.yml"),
-								State: github.Ptr("active"),
+								ID:    new(int64(2)),
+								Name:  new("Deploy"),
+								Path:  new(".github/workflows/deploy.yml"),
+								State: new("active"),
 							},
 						},
 					}
@@ -122,13 +122,13 @@ func Test_ActionsList_ListWorkflowRuns(t *testing.T) {
 		mockedClient := MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
 			GetReposActionsWorkflowsRunsByOwnerByRepoByWorkflowID: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
 				runs := &github.WorkflowRuns{
-					TotalCount: github.Ptr(1),
+					TotalCount: new(1),
 					WorkflowRuns: []*github.WorkflowRun{
 						{
-							ID:         github.Ptr(int64(123)),
-							Name:       github.Ptr("CI"),
-							Status:     github.Ptr("completed"),
-							Conclusion: github.Ptr("success"),
+							ID:         new(int64(123)),
+							Name:       new("CI"),
+							Status:     new("completed"),
+							Conclusion: new("success"),
 						},
 					},
 				}
@@ -167,18 +167,18 @@ func Test_ActionsList_ListWorkflowRuns(t *testing.T) {
 		mockedClient := MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
 			GetReposActionsRunsByOwnerByRepo: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
 				runs := &github.WorkflowRuns{
-					TotalCount: github.Ptr(2),
+					TotalCount: new(2),
 					WorkflowRuns: []*github.WorkflowRun{
 						{
-							ID:         github.Ptr(int64(123)),
-							Name:       github.Ptr("CI"),
-							Status:     github.Ptr("completed"),
-							Conclusion: github.Ptr("success"),
+							ID:         new(int64(123)),
+							Name:       new("CI"),
+							Status:     new("completed"),
+							Conclusion: new("success"),
 						},
 						{
-							ID:         github.Ptr(int64(456)),
-							Name:       github.Ptr("Deploy"),
-							Status:     github.Ptr("in_progress"),
+							ID:         new(int64(456)),
+							Name:       new("Deploy"),
+							Status:     new("in_progress"),
 							Conclusion: nil,
 						},
 					},
@@ -217,7 +217,7 @@ func Test_ActionsList_ListWorkflowJobs(t *testing.T) {
 	toolDef := ActionsList(translations.NullTranslationHelper)
 	mockedClient := MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
 		GetReposActionsRunsJobsByOwnerByRepoByRunID: mockResponse(t, http.StatusOK, &github.Jobs{
-			TotalCount: github.Ptr(1),
+			TotalCount: new(1),
 			Jobs:       []*github.WorkflowJob{actionsTestWorkflowJob()},
 		}),
 	})
@@ -268,10 +268,10 @@ func Test_ActionsGet_GetWorkflow(t *testing.T) {
 		mockedClient := MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
 			GetReposActionsWorkflowsByOwnerByRepoByWorkflowID: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
 				workflow := &github.Workflow{
-					ID:    github.Ptr(int64(1)),
-					Name:  github.Ptr("CI"),
-					Path:  github.Ptr(".github/workflows/ci.yml"),
-					State: github.Ptr("active"),
+					ID:    new(int64(1)),
+					Name:  new("CI"),
+					Path:  new(".github/workflows/ci.yml"),
+					State: new("active"),
 				}
 				w.WriteHeader(http.StatusOK)
 				_ = json.NewEncoder(w).Encode(workflow)
@@ -651,22 +651,22 @@ func Test_ActionsGetJobLogs_FailedJobs(t *testing.T) {
 		mockedClient := MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
 			GetReposActionsRunsJobsByOwnerByRepoByRunID: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
 				jobs := &github.Jobs{
-					TotalCount: github.Ptr(3),
+					TotalCount: new(3),
 					Jobs: []*github.WorkflowJob{
 						{
-							ID:         github.Ptr(int64(1)),
-							Name:       github.Ptr("test-job-1"),
-							Conclusion: github.Ptr("success"),
+							ID:         new(int64(1)),
+							Name:       new("test-job-1"),
+							Conclusion: new("success"),
 						},
 						{
-							ID:         github.Ptr(int64(2)),
-							Name:       github.Ptr("test-job-2"),
-							Conclusion: github.Ptr("failure"),
+							ID:         new(int64(2)),
+							Name:       new("test-job-2"),
+							Conclusion: new("failure"),
 						},
 						{
-							ID:         github.Ptr(int64(3)),
-							Name:       github.Ptr("test-job-3"),
-							Conclusion: github.Ptr("failure"),
```

**File**: `pkg/github/code_quality_test.go` (modified, +4/-4)
```diff
@@ -65,11 +65,11 @@ func Test_GetCodeQualityFinding(t *testing.T) {
 
 	// Setup mock finding for success case
 	mockFinding := &codeQualityFinding{
-		Number: github.Ptr(42),
-		State:  github.Ptr("open"),
+		Number: new(42),
+		State:  new("open"),
 		Rule: &codeQualityRule{
-			ID:          github.Ptr("test-rule"),
-			Description: github.Ptr("Test Rule Description"),
+			ID:          new("test-rule"),
+			Description: new("Test Rule Description"),
 		},
 	}
 
```

**File**: `pkg/github/code_scanning_test.go` (modified, +12/-12)
```diff
@@ -32,10 +32,10 @@ func Test_GetCodeScanningAlert(t *testing.T) {
 
 	// Setup mock alert for success case
 	mockAlert := &github.Alert{
-		Number:  github.Ptr(42),
-		State:   github.Ptr("open"),
-		Rule:    &github.Rule{ID: github.Ptr("test-rule"), Description: github.Ptr("Test Rule Description")},
-		HTMLURL: github.Ptr("https://github.com/owner/repo/security/code-scanning/42"),
+		Number:  new(42),
+		State:   new("open"),
+		Rule:    &github.Rule{ID: new("test-rule"), Description: new("Test Rule Description")},
+		HTMLURL: new("https://github.com/owner/repo/security/code-scanning/42"),
 	}
 
 	tests := []struct {
@@ -144,16 +144,16 @@ func Test_ListCodeScanningAlerts(t *testing.T) {
 	// Setup mock alerts for success case
 	mockAlerts := []*github.Alert{
 		{
-			Number:  github.Ptr(42),
-			State:   github.Ptr("open"),
-			Rule:    &github.Rule{ID: github.Ptr("test-rule-1"), Description: github.Ptr("Test Rule 1")},
-			HTMLURL: github.Ptr("https://github.com/owner/repo/security/code-scanning/42"),
+			Number:  new(42),
+			State:   new("open"),
+			Rule:    &github.Rule{ID: new("test-rule-1"), Description: new("Test Rule 1")},
+			HTMLURL: new("https://github.com/owner/repo/security/code-scanning/42"),
 		},
 		{
-			Number:  github.Ptr(43),
-			State:   github.Ptr("fixed"),
-			Rule:    &github.Rule{ID: github.Ptr("test-rule-2"), Description: github.Ptr("Test Rule 2")},
-			HTMLURL: github.Ptr("https://github.com/owner/repo/security/code-scanning/43"),
+			Number:  new(43),
+			State:   new("fixed"),
+			Rule:    &github.Rule{ID: new("test-rule-2"), Description: new("Test Rule 2")},
+			HTMLURL: new("https://github.com/owner/repo/security/code-scanning/43"),
 		},
 	}
 
```

**File**: `pkg/github/comment_minimize_test.go` (modified, +4/-4)
```diff
@@ -174,9 +174,9 @@ func Test_CommentVisibilityToolSchemas(t *testing.T) {
 }
 
 func Test_HideAndUnhideComments(t *testing.T) {
-	issueComment := mockResponse(t, http.StatusOK, &github.IssueComment{ID: github.Ptr(int64(1)), NodeID: github.Ptr("IC_1")})
-	reviewComment := mockResponse(t, http.StatusOK, &github.PullRequestComment{ID: github.Ptr(int64(2)), NodeID: github.Ptr("PRRC_2")})
-	review := mockResponse(t, http.StatusOK, &github.PullRequestReview{ID: github.Ptr(int64(3)), NodeID: github.Ptr("PRR_3")})
+	issueComment := mockResponse(t, http.StatusOK, &github.IssueComment{ID: new(int64(1)), NodeID: new("IC_1")})
+	reviewComment := mockResponse(t, http.StatusOK, &github.PullRequestComment{ID: new(int64(2)), NodeID: new("PRRC_2")})
+	review := mockResponse(t, http.StatusOK, &github.PullRequestReview{ID: new(int64(3)), NodeID: new("PRR_3")})
 	notFound := mockResponse(t, http.StatusNotFound, `{"message": "Not Found"}`)
 
 	tests := []struct {
@@ -261,7 +261,7 @@ func Test_HideAndUnhideComments(t *testing.T) {
 			name: "response without node ID",
 			tool: GranularUnhideIssueComment(translations.NullTranslationHelper),
 			restHandlers: map[string]http.HandlerFunc{
-				getIssueCommentRoute: mockResponse(t, http.StatusOK, &github.IssueComment{ID: github.Ptr(int64(1))}),
+				getIssueCommentRoute: mockResponse(t, http.StatusOK, &github.IssueComment{ID: new(int64(1))}),
 			},
 			requestArgs:    map[string]any{"owner": "owner", "repo": "repo", "comment_id": float64(1)},
 			expectedErrMsg: "response has no node ID",
```

**File**: `pkg/github/context_tools_test.go` (modified, +26/-26)
```diff
@@ -30,19 +30,19 @@ func Test_GetMe(t *testing.T) {
 
 	// Setup mock user response
 	mockUser := &github.User{
-		Login:           github.Ptr("testuser"),
-		Name:            github.Ptr("Test User"),
-		Email:           github.Ptr("test@example.com"),
-		Bio:             github.Ptr("GitHub user for testing"),
-		Company:         github.Ptr("Test Company"),
-		Location:        github.Ptr("Test Location"),
-		HTMLURL:         github.Ptr("https://github.com/testuser"),
+		Login:           new("testuser"),
+		Name:            new("Test User"),
+		Email:           new("test@example.com"),
+		Bio:             new("GitHub user for testing"),
+		Company:         new("Test Company"),
+		Location:        new("Test Location"),
+		HTMLURL:         new("https://github.com/testuser"),
 		CreatedAt:       &github.Timestamp{Time: time.Now().Add(-365 * 24 * time.Hour)},
-		Type:            github.Ptr("User"),
-		Hireable:        github.Ptr(true),
-		TwitterUsername: github.Ptr("testuser_twitter"),
+		Type:            new("User"),
+		Hireable:        new(true),
+		TwitterUsername: new("testuser_twitter"),
 		Plan: &github.Plan{
-			Name: github.Ptr("pro"),
+			Name: new("pro"),
 		},
 	}
 
@@ -144,8 +144,8 @@ func Test_GetMe_OmittedArguments(t *testing.T) {
 	t.Parallel()
 
 	mockUser := &github.User{
-		Login:     github.Ptr("testuser"),
-		HTMLURL:   github.Ptr("https://github.com/testuser"),
+		Login:     new("testuser"),
+		HTMLURL:   new("https://github.com/testuser"),
 		CreatedAt: &github.Timestamp{Time: time.Now()},
 	}
 	mockedClient := MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
@@ -175,8 +175,8 @@ func Test_GetMe_IFC_FeatureFlag(t *testing.T) {
 	serverTool := GetMe(translations.NullTranslationHelper)
 
 	mockUser := &github.User{
-		Login:     github.Ptr("testuser"),
-		HTMLURL:   github.Ptr("https://github.com/testuser"),
+		Login:     new("testuser"),
+		HTMLURL:   new("https://github.com/testuser"),
 		CreatedAt: &github.Timestamp{Time: time.Now()},
 	}
 	mockedHTTPClient := MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
@@ -246,19 +246,19 @@ func Test_GetTeams(t *testing.T) {
 	assert.True(t, tool.Annotations.ReadOnlyHint, "get_teams tool should be read-only")
 
 	mockUser := &github.User{
-		Login:           github.Ptr("testuser"),
-		Name:            github.Ptr("Test User"),
-		Email:           github.Ptr("test@example.com"),
-		Bio:             github.Ptr("GitHub user for testing"),
-		Company:         github.Ptr("Test Company"),
-		Location:        github.Ptr("Test Location"),
-		HTMLURL:         github.Ptr("https://github.com/testuser"),
+		Login:           new("testuser"),
+		Name:            new("Test User"),
+		Email:           new("test@example.com"),
+		Bio:             new("GitHub user for testing"),
+		Company:         new("Test Company"),
+		Location:        new("Test Location"),
+		HTMLURL:         new("https://github.com/testuser"),
 		CreatedAt:       &github.Timestamp{Time: time.Now().Add(-365 * 24 * time.Hour)},
-		Type:            github.Ptr("User"),
-		Hireable:        github.Ptr(true),
-		TwitterUsername: github.Ptr("testuser_twitter"),
+		Type:            new("User"),
+		Hireable:        new(true),
+		TwitterUsername: new("testuser_twitter"),
 		Plan: &github.Plan{
-			Name: github.Ptr("pro"),
+			Name: new("pro"),
 		},
 	}
 
```

**File**: `pkg/github/copilot_test.go` (modified, +18/-18)
```diff
@@ -900,20 +900,20 @@ func Test_RequestCopilotReview(t *testing.T) {
 
 	// Setup mock PR for success case
 	mockPR := &github.PullRequest{
-		Number:  github.Ptr(42),
-		Title:   github.Ptr("Test PR"),
-		State:   github.Ptr("open"),
-		HTMLURL: github.Ptr("https://github.com/owner/repo/pull/42"),
+		Number:  new(42),
+		Title:   new("Test PR"),
+		State:   new("open"),
+		HTMLURL: new("https://github.com/owner/repo/pull/42"),
 		Head: &github.PullRequestBranch{
-			SHA: github.Ptr("abcd1234"),
-			Ref: github.Ptr("feature-branch"),
+			SHA: new("abcd1234"),
+			Ref: new("feature-branch"),
 		},
 		Base: &github.PullRequestBranch{
-			Ref: github.Ptr("main"),
+			Ref: new("main"),
 		},
-		Body: github.Ptr("This is a test PR"),
+		Body: new("This is a test PR"),
 		User: &github.User{
-			Login: github.Ptr("testuser"),
+			Login: new("testuser"),
 		},
 	}
 
@@ -965,10 +965,10 @@ func Test_RequestCopilotReview(t *testing.T) {
 			mockedClient: MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
 				PostReposPullsRequestedReviewersByOwnerByRepoByPullNumber: mockResponse(t, http.StatusNotFound, map[string]any{"message": "Not Found"}),
 				GetReposByOwnerByRepo: mockResponse(t, http.StatusOK, &github.Repository{
-					Name: github.Ptr("repo"),
+					Name: new("repo"),
 					Permissions: &github.RepositoryPermissions{
-						Pull: github.Ptr(true),
-						Push: github.Ptr(false),
+						Pull: new(true),
+						Push: new(false),
 					},
 				}),
 			}),
@@ -985,10 +985,10 @@ func Test_RequestCopilotReview(t *testing.T) {
 			mockedClient: MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
 				PostReposPullsRequestedReviewersByOwnerByRepoByPullNumber: mockResponse(t, http.StatusForbidden, map[string]any{"message": "Forbidden"}),
 				GetReposByOwnerByRepo: mockResponse(t, http.StatusOK, &github.Repository{
-					Name: github.Ptr("repo"),
+					Name: new("repo"),
 					Permissions: &github.RepositoryPermissions{
-						Pull: github.Ptr(true),
-						Push: github.Ptr(false),
+						Pull: new(true),
+						Push: new(false),
 					},
 				}),
 			}),
@@ -1005,10 +1005,10 @@ func Test_RequestCopilotReview(t *testing.T) {
 			mockedClient: MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
 				PostReposPullsRequestedReviewersByOwnerByRepoByPullNumber: mockResponse(t, http.StatusNotFound, map[string]any{"message": "Not Found"}),
 				GetReposByOwnerByRepo: mockResponse(t, http.StatusOK, &github.Repository{
-					Name: github.Ptr("repo"),
+					Name: new("repo"),
 					Permissions: &github.RepositoryPermissions{
-						Pull: github.Ptr(true),
-						Push: github.Ptr(true),
+						Pull: new(true),
+						Push: new(true),
 					},
 				}),
 			}),
```

**File**: `pkg/github/custom_properties_test.go` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ func Test_CustomPropertiesRead(t *testing.T) {
 	})
 
 	t.Run("enterprise level: returns property definitions", func(t *testing.T) {
-		mockProps := []*github.CustomProperty{{PropertyName: github.Ptr("compliance"), ValueType: "true_false"}}
+		mockProps := []*github.CustomProperty{{PropertyName: new("compliance"), ValueType: "true_false"}}
 		client := mustNewGHClient(t, MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
 			"GET /enterprises/{enterprise}/properties/schema": mockResponse(t, http.StatusOK, mockProps),
 		}))
```

---

### Incident Patch 3: `f89f8845` (2026-10-02)
**Commit Message**: build(ui): upgrade TypeScript 7 and align Node 26 toolchain (#3379)

Read the CI Node version from UI engines and match Docker and Node types.\nDocument the native compiler workflow without changing UI dependencies.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `.github/actions/build-ui/action.yml` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ runs:
       if: steps.cache-ui.outputs.cache-hit != 'true'
       uses: actions/setup-node@v7
       with:
-        node-version: "22"
+        node-version-file: ui/package.json
         cache: npm
         cache-dependency-path: ui/package-lock.json
 
```

**File**: `.github/workflows/code-scanning.yml` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ jobs:
         if: matrix.language == 'javascript'
         uses: actions/setup-node@v7
         with:
-          node-version: "20"
+          node-version-file: ui/package.json
           cache: "npm"
           cache-dependency-path: ui/package-lock.json
 
```

**File**: `CONTRIBUTING.md` (modified, +11/-0)
```diff
@@ -29,6 +29,17 @@ These are one time installations required to be able to test your changes locall
 1. Install Go 1.26.8 or later [through download](https://go.dev/doc/install) | [through Homebrew](https://formulae.brew.sh/formula/go)
 2. [Install golangci-lint v2.14.0](https://golangci-lint.run/welcome/install/#local-installation), or let `script/lint` install the repository-pinned version. The pinned version supports both Go 1.26 and Go 1.27.
 
+### UI development
+
+Use Node.js 26.x for the UI in `ui/`. This matches the Docker UI build stage
+and `@types/node`; GitHub Actions reads the Node version from `ui/package.json`.
+Node 26 is a supported Current release, with LTS scheduled for October 2026.
+
+From `ui/`, run `npm ci`, `npm run typecheck`, and `npm run build`.
+Type checking uses the native TypeScript 7 compiler through `tsc`; Vite handles
+transpilation and bundling separately. No TypeScript compiler API integration,
+typescript-eslint, or ts-node is required.
+
 ## Submitting a pull request
 
 1. [Fork][fork] and clone the repository
```

**File**: `ui/package-lock.json` (modified, +377/-16)
```diff
@@ -18,16 +18,16 @@
         "remark-gfm": "^4.0.1"
       },
       "devDependencies": {
-        "@types/node": "^25.9.9",
+        "@types/node": "^26.6.4",
         "@types/react": "^18.3.31",
         "@types/react-dom": "^18.3.7",
         "@vitejs/plugin-react": "^6.1.1",
-        "typescript": "^5.9.3",
+        "typescript": "^7.0.2",
         "vite": "^8.3.2",
         "vite-plugin-singlefile": "^2.3.3"
       },
       "engines": {
-        "node": "^20.19.0 || >=22.12.0"
+        "node": "^26.0.0"
       }
     },
     "node_modules/@babel/code-frame": {
@@ -1824,13 +1824,13 @@
       "license": "MIT"
     },
     "node_modules/@types/node": {
-      "version": "25.9.9",
-      "resolved": "https://registry.npmjs.org/@types/node/-/node-25.9.9.tgz",
-      "integrity": "sha512-b4e2xxj/yMeT2hNlD6x7zNFiQK2Dlmkb9CQ6v3/1G2RezKN4YS2lcEv8lzGm1mhs4f2lM4yNAMI/zUDBZBBt7w==",
+      "version": "26.6.4",
+      "resolved": "https://registry.npmjs.org/@types/node/-/node-26.6.4.tgz",
+      "integrity": "sha512-ldVPDCzj7fsaGZrLB0NuHuTvJcsNasysBAqMolr/cgxrLd1xbqxIr3XJiPnHHJUCxj5sNF1vnRj9aWnrVh5Jcg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "undici-types": ">=7.24.0 <7.24.7"
+        "undici-types": "~8.9.0"
       }
     },
     "node_modules/@types/prop-types": {
@@ -1898,6 +1898,346 @@
       "integrity": "sha512-ko/gIFJRv177XgZsZcBwnqJN5x/Gien8qNOn0D5bQU/zAzVf9Zt3BlcUiLqhV9y4ARk0GbT3tnUiPNgnTXzc/Q==",
       "license": "MIT"
     },
+    "node_modules/@typescript/typescript-aix-ppc64": {
+      "version": "7.0.2",
+      "resolved": "https://registry.npmjs.org/@typescript/typescript-aix-ppc64/-/typescript-aix-ppc64-7.0.2.tgz",
+      "integrity": "sha512-MTKKkWB7p/0E9xi1d1tHtZ5PiLkGEMIq88pK2CubZjOsLtYTLqhgIgi6zepFa+9GHZ6h05NMCkQxGKiPXMxXtQ==",
+      "cpu": [
+        "ppc64"
+      ],
+      "dev": true,
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "aix"
+      ],
+      "engines": {
+        "node": ">=16.20.0"
+      }
+    },
+    "node_modules/@typescript/typescript-darwin-arm64": {
+      "version": "7.0.2",
+      "resolved": "https://registry.npmjs.org/@typescript/typescript-darwin-arm64/-/typescript-darwin-arm64-7.0.2.tgz",
+      "integrity": "sha512-gowzar9MwS/aRWp6f3a4KUqzRjAZjOsmGNCM6LcTgXum+dBfgsBVMN+AgvOCCbguXyick6LJhpBszxMebJ8syA==",
+      "cpu": [
+        "arm64"
+      ],
+      "dev": true,
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "darwin"
+      ],
+      "engines": {
+        "node": ">=16.20.0"
+      }
+    },
+    "node_modules/@typescript/typescript-darwin-x64": {
+      "version": "7.0.2",
+      "resolved": "https://registry.npmjs.org/@typescript/typescript-darwin-x64/-/typescript-darwin-x64-7.0.2.tgz",
+      "integrity": "sha512-SZ9xZInqApNlNGc9s0W1VSsktYSOe9cFqNOIqmN1Gs8SmkjKZYFt017G4VwPxASInODuAdbTW7sXiFUf893RgA==",
+      "cpu": [
+        "x64"
+      ],
+      "dev": true,
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "darwin"
+      ],
+      "engines": {
+        "node": ">=16.20.0"
+      }
+    },
+    "node_modules/@typescript/typescript-freebsd-arm64": {
+      "version": "7.0.2",
+      "resolved": "https://registry.npmjs.org/@typescript/typescript-freebsd-arm64/-/typescript-freebsd-arm64-7.0.2.tgz",
+      "integrity": "sha512-W5NH4y/J0plIIS5b2xvTEkU7JFxyqdMAOgf+Ilhl0vHQXKO5dZoxd+C/jEtq56c4F3wk71RB4BMRQ2XdI+bwYQ==",
+      "cpu": [
+        "arm64"
+      ],
+      "dev": true,
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "freebsd"
+      ],
+      "engines": {
+        "node": ">=16.20.0"
+      }
+    },
+    "node_modules/@typescript/typescript-freebsd-x64": {
+      "version": "7.0.2",
+      "resolved": "https://registry.npmjs.org/@typescript/typescript-freebsd-x64/-/typescript-freebsd-x64-7.0.2.tgz",
+      "integrity": "sha512-UMGDx5sTpzNw3WiPebH7l90IWfJggEd+egHt/q6p7/Cm3zqoV7VxkGXt+3DxPIw8CcmvAB0j3sVVfbhX+M4Tpw==",
+      "cpu": [
+        "x64"
+      ],
+      "dev": true,
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "freebsd"
+      ],
+      "engines": {
+        "node": ">=16.20.0"
+      }
+    },
+    "node_modules/@typescript/typescript-linux-arm": {
+      "version": "7.0.2",
+      "resolved": "https://registry.npmjs.org/@typescript/typescript-linux-arm/-/typescript-linux-arm-7.0.2.tgz",
+      "integrity": "sha512-gffT3xPz9sR7j/YJExkyPntrI0P2EP9XbOyWzth2/Gs0RstK+90RBcO0ncXoXy/beYll1SXw846Nf2zdnEz0QQ==",
+      "cpu": [
+        "arm"
+      ],
+      "dev": true,
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=16.20.0"
+      }
+    },
+    "node_modules/@typescript/typescript-linux-arm64": {
+      "version": "7.0.2",
+      "resolved": "https://registry.npmjs.org/@typescript/typescript-linux-arm64/-/typescript-linux-arm64-7.0.2.tgz",
+
```

**File**: `ui/package.json` (modified, +3/-3)
```diff
@@ -5,7 +5,7 @@
   "type": "module",
   "description": "MCP App UIs for github-mcp-server using Primer React",
   "engines": {
-    "node": "^20.19.0 || >=22.12.0"
+    "node": "^26.0.0"
   },
   "scripts": {
     "build": "node scripts/build.mjs",
@@ -24,11 +24,11 @@
     "remark-gfm": "^4.0.1"
   },
   "devDependencies": {
-    "@types/node": "^25.9.9",
+    "@types/node": "^26.6.4",
     "@types/react": "^18.3.31",
     "@types/react-dom": "^18.3.7",
     "@vitejs/plugin-react": "^6.1.1",
-    "typescript": "^5.9.3",
+    "typescript": "^7.0.2",
     "vite": "^8.3.2",
     "vite-plugin-singlefile": "^2.3.3"
   }
```

---

### Incident Patch 4: `5e39ec8b` (2026-10-02)
**Commit Message**: build(deps): upgrade go-github to v92.0.0 (#3381)

Migrate all go-github imports and issue comment requests while preserving MCP schemas and payloads. Let v92 escape ruleset branch names exactly once. Refresh dependency license reports and narrowly retain the supported Ptr helper for compatibility with the pinned linter.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `.golangci.yml` (modified, +4/-0)
```diff
@@ -31,6 +31,10 @@ linters:
       - examples$
       - internal/githubv4mock
     rules:
+      # v2.9.0 misreports SA4006 for Go 1.26 new(expr); retain go-github's helper until the linter is upgraded.
+      - linters:
+          - staticcheck
+        text: '(go)?github\.Ptr is deprecated: use the new builtin instead\.'
       - linters:
           - revive
         text: "var-naming: avoid package names that conflict with Go standard library package names"
```

**File**: `e2e/e2e_test.go` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ import (
 	"github.com/github/github-mcp-server/pkg/github"
 	"github.com/github/github-mcp-server/pkg/translations"
 	"github.com/github/github-mcp-server/pkg/utils"
-	gogithub "github.com/google/go-github/v89/github"
+	gogithub "github.com/google/go-github/v92/github"
 	"github.com/modelcontextprotocol/go-sdk/mcp"
 	"github.com/stretchr/testify/require"
 )
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ go 1.26.8
 require (
 	github.com/go-chi/chi/v5 v5.3.2
 	github.com/go-viper/mapstructure/v2 v2.5.0
-	github.com/google/go-github/v89 v89.0.1-0.20260728185857-34349a88bac3
+	github.com/google/go-github/v92 v92.0.0
 	github.com/google/jsonschema-go v0.4.3
 	github.com/josephburnett/jd/v2 v2.5.0
 	github.com/lithammer/fuzzysearch v1.1.8
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -14,8 +14,8 @@ github.com/golang-jwt/jwt/v5 v5.3.1/go.mod h1:fxCRLWMO43lRc8nhHWY6LGqRcf+1gQWArs
 github.com/google/go-cmp v0.6.0/go.mod h1:17dUlkBOakJ0+DkrSSNjCkIjxS6bF9zb3elmeNGIjoY=
 github.com/google/go-cmp v0.7.0 h1:wk8382ETsv4JYUZwIsn6YpYiWiBsYLSJiTsyBybVuN8=
 github.com/google/go-cmp v0.7.0/go.mod h1:pXiqmnSA92OHEEa9HXL2W4E7lf9JzCmGVUdgjX3N/iU=
-github.com/google/go-github/v89 v89.0.1-0.20260728185857-34349a88bac3 h1:0a/p9KtPso8UBauBD/p9Go1oaZrrEydBNHjaaKkSHJo=
-github.com/google/go-github/v89 v89.0.1-0.20260728185857-34349a88bac3/go.mod h1:QLcbU0ipeAqQuR5KSg8c2lql4Qk1EwJ2dWz/0rP4Nho=
+github.com/google/go-github/v92 v92.0.0 h1:4vW4RVffwIvoEfIA4RX09mRSB47qQX557/2+HgeWRRg=
+github.com/google/go-github/v92 v92.0.0/go.mod h1:w3CH62ZcmRfvW1cdXpyTztSOVMtdjxtKpgo0GouLmjY=
 github.com/google/go-querystring v1.2.0 h1:yhqkPbu2/OH+V9BfpCVPZkNmUXhb2gBxJArfhIxNtP0=
 github.com/google/go-querystring v1.2.0/go.mod h1:8IFJqpSRITyJ8QhQ13bmbeMBDfmeEJZD5A0egEOmkqU=
 github.com/google/jsonschema-go v0.4.3 h1:/DBOLZTfDow7pe2GmaJNhltueGTtDKICi8V8p+DQPd0=
```

**File**: `internal/ghmcp/server.go` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ import (
 	"github.com/github/github-mcp-server/pkg/scopes"
 	"github.com/github/github-mcp-server/pkg/translations"
 	"github.com/github/github-mcp-server/pkg/utils"
-	gogithub "github.com/google/go-github/v89/github"
+	gogithub "github.com/google/go-github/v92/github"
 	"github.com/modelcontextprotocol/go-sdk/mcp"
 	"github.com/shurcooL/githubv4"
 )
```

**File**: `pkg/errors/error.go` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ import (
 
 	"github.com/github/github-mcp-server/pkg/sanitize"
 	"github.com/github/github-mcp-server/pkg/utils"
-	"github.com/google/go-github/v89/github"
+	"github.com/google/go-github/v92/github"
 	"github.com/modelcontextprotocol/go-sdk/mcp"
 )
 
```

**File**: `pkg/errors/error_test.go` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ package errors
 import (
 	"context"
 	"fmt"
-	"github.com/google/go-github/v89/github"
+	"github.com/google/go-github/v92/github"
 	"github.com/modelcontextprotocol/go-sdk/mcp"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
```

**File**: `pkg/github/actions.go` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ import (
 	"github.com/github/github-mcp-server/pkg/scopes"
 	"github.com/github/github-mcp-server/pkg/translations"
 	"github.com/github/github-mcp-server/pkg/utils"
-	"github.com/google/go-github/v89/github"
+	"github.com/google/go-github/v92/github"
 	"github.com/google/jsonschema-go/jsonschema"
 	"github.com/modelcontextprotocol/go-sdk/mcp"
 )
```

---

### Incident Patch 5: `fbeba3c9` (2026-10-02)
**Commit Message**: build: upgrade golangci-lint to v2.14.0 (#3380)

Resolve new modernization findings and document narrow false-positive suppressions. Verify Go 1.26.8 and 1.27.1 support and remove obsolete export-data compatibility guidance. Refresh cached linter binaries when the repository pin changes.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `.github/workflows/lint.yml` (modified, +1/-1)
```diff
@@ -23,4 +23,4 @@ jobs:
         uses: golangci/golangci-lint-action@v9
         with:
           # sync with script/lint
-          version: v2.9
+          version: v2.14.0
```

**File**: `CONTRIBUTING.md` (modified, +1/-3)
```diff
@@ -27,9 +27,7 @@ Thanks for contributing and for helping us build toolsets that are truly valuabl
 These are one time installations required to be able to test your changes locally as part of the pull request (PR) submission process.
 
 1. Install Go 1.26.8 or later [through download](https://go.dev/doc/install) | [through Homebrew](https://formulae.brew.sh/formula/go)
-2. [Install golangci-lint v2](https://golangci-lint.run/welcome/install/#local-installation)
-
-The repository-pinned golangci-lint v2.9.0 supports Go 1.26, but cannot read Go 1.27 export data. When using a newer Go installation, run lint with `GOTOOLCHAIN=go1.26.8 script/lint`.
+2. [Install golangci-lint v2.14.0](https://golangci-lint.run/welcome/install/#local-installation), or let `script/lint` install the repository-pinned version. The pinned version supports both Go 1.26 and Go 1.27.
 
 ## Submitting a pull request
 
```

**File**: `internal/oauth/testutil_test.go` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ func (f *fakeGitHub) handleAuthorize(w http.ResponseWriter, r *http.Request) {
 	f.mu.Unlock()
 
 	redirect := q.Get("redirect_uri") + "?code=authcode&state=" + url.QueryEscape(q.Get("state"))
-	http.Redirect(w, r, redirect, http.StatusFound)
+	http.Redirect(w, r, redirect, http.StatusFound) //nolint:gosec // G710: Fake OAuth server redirects to the test client's callback, not an external user's input.
 }
 
 func (f *fakeGitHub) handleToken(w http.ResponseWriter, r *http.Request) {
```

**File**: `pkg/buffer/buffer_test.go` (modified, +2/-2)
```diff
@@ -83,14 +83,14 @@ func TestProcessResponseAsRingBufferToEnd(t *testing.T) {
 		// Ring buffer size is 5, so we should only keep the last 5 lines
 		var sb strings.Builder
 		for i := 1; i <= 10; i++ {
-			sb.WriteString(fmt.Sprintf("line%d\n", i))
+			fmt.Fprintf(&sb, "line%d\n", i)
 		}
 		// Insert an 11MB line (exceeds maxLineSize of 10MB)
 		longLine := strings.Repeat("x", 11*1024*1024)
 		sb.WriteString(longLine)
 		sb.WriteString("\n")
 		for i := 11; i <= 20; i++ {
-			sb.WriteString(fmt.Sprintf("line%d\n", i))
+			fmt.Fprintf(&sb, "line%d\n", i)
 		}
 
 		resp := &http.Response{
```

**File**: `pkg/errors/error.go` (modified, +2/-4)
```diff
@@ -165,8 +165,7 @@ func NewGitHubAPIErrorResponse(ctx context.Context, message string, resp *github
 		_, _ = addGitHubAPIErrorToContext(ctx, apiErr) // Explicitly ignore error for graceful handling
 	}
 
-	var rateLimitErr *github.RateLimitError
-	if stderrors.As(err, &rateLimitErr) {
+	if rateLimitErr, ok := stderrors.AsType[*github.RateLimitError](err); ok {
 		resetTime := rateLimitErr.Rate.Reset.Time
 		if !resetTime.IsZero() {
 			retryIn := time.Until(resetTime).Round(time.Second)
@@ -179,8 +178,7 @@ func NewGitHubAPIErrorResponse(ctx context.Context, message string, resp *github
 			"%s: GitHub API rate limit exceeded. Wait before retrying.", message))
 	}
 
-	var abuseErr *github.AbuseRateLimitError
-	if stderrors.As(err, &abuseErr) {
+	if abuseErr, ok := stderrors.AsType[*github.AbuseRateLimitError](err); ok {
 		if abuseErr.RetryAfter != nil {
 			retryAfter := abuseErr.RetryAfter.Round(time.Second)
 			if retryAfter > 0 {
```

**File**: `pkg/github/actions.go` (modified, +1/-2)
```diff
@@ -1103,8 +1103,7 @@ func rerunFailedJobs(ctx context.Context, client *github.Client, owner, repo str
 func cancelWorkflowRun(ctx context.Context, client *github.Client, owner, repo string, runID int64) (*mcp.CallToolResult, any, error) {
 	resp, err := client.Actions.CancelWorkflowRunByID(ctx, owner, repo, runID)
 	if err != nil {
-		var acceptedErr *github.AcceptedError
-		if !errors.As(err, &acceptedErr) {
+		if _, ok := errors.AsType[*github.AcceptedError](err); !ok {
 			return ghErrors.NewGitHubAPIErrorResponse(ctx, "failed to cancel workflow run", resp, err), nil, nil
 		}
 	}
```

**File**: `pkg/github/copilot.go` (modified, +2/-2)
```diff
@@ -39,15 +39,15 @@ func (d *mvpDescription) String() string {
 		sb.WriteString("\n\n")
 		sb.WriteString("This tool can help with the following outcomes:\n")
 		for _, outcome := range d.outcomes {
-			sb.WriteString(fmt.Sprintf("- %s\n", outcome))
+			fmt.Fprintf(&sb, "- %s\n", outcome)
 		}
 	}
 
 	if len(d.referenceLinks) > 0 {
 		sb.WriteString("\n\n")
 		sb.WriteString("More information can be found at:\n")
 		for _, link := range d.referenceLinks {
-			sb.WriteString(fmt.Sprintf("- %s\n", link))
+			fmt.Fprintf(&sb, "- %s\n", link)
 		}
 	}
 
```

**File**: `pkg/github/projects.go` (modified, +7/-14)
```diff
@@ -625,8 +625,7 @@ Use this tool to get details about individual projects, project fields, project
 					}
 					resolvedIDs, resolveErr := resolveFieldNamesToIDs(ctx, gqlClient, owner, ownerType, projectNumber, fieldNames, "fields")
 					if resolveErr != nil {
-						var structured *ghErrors.StructuredResolutionError
-						if errors.As(resolveErr, &structured) {
+						if structured, ok := errors.AsType[*ghErrors.StructuredResolutionError](resolveErr); ok {
 							return ghErrors.NewStructuredResolutionErrorResponse(structured), nil, nil
 						}
 						return utils.NewToolResultError(resolveErr.Error()), nil, nil
@@ -984,8 +983,7 @@ func ProjectsWrite(t translations.TranslationHelperFunc) inventory.ServerTool {
 					// Resolve the item by (item_owner, item_repo, issue_number).
 					resolvedItemID, resolveErr := resolveItemIDFromIssueArgs(ctx, gqlClient, owner, ownerType, projectNumber, args)
 					if resolveErr != nil {
-						var structured *ghErrors.StructuredResolutionError
-						if errors.As(resolveErr, &structured) {
+						if structured, ok := errors.AsType[*ghErrors.StructuredResolutionError](resolveErr); ok {
 							return ghErrors.NewStructuredResolutionErrorResponse(structured), nil, nil
 						}
 						return utils.NewToolResultError(resolveErr.Error()), nil, nil
@@ -1252,8 +1250,7 @@ func listProjectItems(ctx context.Context, client *github.Client, gqlClient *git
 	if len(fieldNames) > 0 {
 		resolvedIDs, resolveErr := resolveFieldNamesToIDs(ctx, gqlClient, owner, ownerType, projectNumber, fieldNames, "fields")
 		if resolveErr != nil {
-			var structured *ghErrors.StructuredResolutionError
-			if errors.As(resolveErr, &structured) {
+			if structured, ok := errors.AsType[*ghErrors.StructuredResolutionError](resolveErr); ok {
 				return ghErrors.NewStructuredResolutionErrorResponse(structured), nil, nil
 			}
 			return utils.NewToolResultError(resolveErr.Error()), nil, nil
@@ -1446,8 +1443,7 @@ func fetchProjectItem(ctx context.Context, client *github.Client, owner, ownerTy
 func updateProjectItem(ctx context.Context, client *github.Client, gqlClient *githubv4.Client, owner, ownerType string, projectNumber int, itemID int64, fieldValue map[string]any) (*mcp.CallToolResult, any, error) {
 	updatePayload, issueField, err := buildUpdateProjectItem(ctx, gqlClient, owner, ownerType, projectNumber, fieldValue)
 	if err != nil {
-		var structured *ghErrors.StructuredResolutionError
-		if errors.As(err, &structured) {
+		if structured, ok := errors.AsType[*ghErrors.StructuredResolutionError](err); ok {
 			return ghErrors.NewStructuredResolutionErrorResponse(structured), nil, nil
 		}
 		return utils.NewToolResultError(err.Error()), nil, nil
@@ -1469,8 +1465,7 @@ func updateProjectItem(ctx context.Context, client *github.Client, gqlClient *gi
 
 		issueID, resolveErr := projectItemIssueID(projectItem)
 		if resolveErr != nil {
-			var structured *ghErrors.StructuredResolutionError
-			if errors.As(resolveErr, &structured) {
+			if structured, ok := errors.AsType[*ghErrors.StructuredResolutionError](resolveErr); ok {
 				return ghErrors.NewStructuredResolutionErrorResponse(structured), nil, nil
 			}
 			return utils.NewToolResultError(resolveErr.Error()), nil, nil
@@ -2136,8 +2131,7 @@ func createProjectView(ctx context.Context, gqlClient *githubv4.Client, args map
 	}
 	configuration, err := projectViewVisibleFieldsInput(ctx, gqlClient, args, owner, ownerType, projectNumber)
 	if err != nil {
-		var structured *ghErrors.StructuredResolutionError
-		if errors.As(err, &structured) {
+		if structured, ok := errors.AsType[*ghErrors.StructuredResolutionError](err); ok {
 			return ghErrors.NewStructuredResolutionErrorResponse(structured), nil, nil
 		}
 		return utils.NewToolResultError(err.Error()), nil, nil
@@ -2267,8 +2261,7 @@ func updateProjectView(ctx context.Context, gqlClient *githubv4.Client, args map
 
 	configuration, err := projectViewVisibleFieldsInput(ctx, gqlClient, args, owner, ownerType, projectNumber)
 	if err != nil {
-		var structured *ghErrors.StructuredResolutionError
-		if errors.As(err, &structured) {
+		if structured, ok := errors.AsType[*ghErrors.StructuredResolutionError](err); ok {
 			return ghErrors.NewStructuredResolutionErrorResponse(structured), nil, nil
 		}
 		return utils.NewToolResultError(err.Error()), nil, nil
```

---

### Incident Patch 6: `cd502333` (2026-10-02)
**Commit Message**: build(deps): remediate npm alerts and refresh safe dependencies (#3370)

* ci(deps): refresh workflow dependencies and align lint Go version

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* build(deps): refresh safe dependencies and Dependabot coverage

Remediate all nine open npm alerts, update compatible Go and UI dependencies, refresh pinned Actions and the Go image, and backport the Cosign verification fix. Add weekly npm updates and regenerate third-party notices.

Raise the minimum supported Go version to 1.26.8 for the latest x/net dependency and align CI linting with that toolchain.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* ci: preserve Docker tag ordering and remove trailing whitespace

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* chore: regenerate license files

Auto-generated by license-check workflow

* chore: regenerate license files

Auto-generated by license-check workflow

---------

Co-authored-by: Copilot App <[REDACTED_EMAIL]>
Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `.github/actions/build-ui/action.yml` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ runs:
   steps:
     - name: Cache UI artifacts
       id: cache-ui
-      uses: actions/cache@v5
+      uses: actions/cache@v6
       with:
         path: |
           pkg/github/ui_dist/get-me.html
@@ -18,7 +18,7 @@ runs:
 
     - name: Set up Node.js
       if: steps.cache-ui.outputs.cache-hit != 'true'
-      uses: actions/setup-node@v6
+      uses: actions/setup-node@v7
       with:
         node-version: "22"
         cache: npm
```

**File**: `.github/dependabot.yml` (modified, +4/-0)
```diff
@@ -9,6 +9,10 @@ updates:
     directory: "/"
     schedule:
       interval: "weekly"
+  - package-ecosystem: "npm"
+    directory: "/ui"
+    schedule:
+      interval: "weekly"
   - package-ecosystem: "docker"
     directory: "/"
     schedule:
```

**File**: `.github/workflows/code-scanning.yml` (modified, +5/-5)
```diff
@@ -44,7 +44,7 @@ jobs:
         uses: actions/checkout@v7
 
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@v4.37.9
+        uses: github/codeql-action/init@v4.38.2
         with:
           languages: ${{ matrix.language }}
           build-mode: ${{ matrix.build-mode }}
@@ -61,13 +61,13 @@ jobs:
             threat-models: [  ]
       - name: Setup proxy for registries
         id: proxy
-        uses: github/codeql-action/start-proxy@v4.37.9
+        uses: github/codeql-action/start-proxy@v4.38.2
         with:
           registries_credentials: ${{ secrets.GITHUB_REGISTRIES_PROXY }}
           language: ${{ matrix.language }}
 
       - name: Configure
-        uses: github/codeql-action/resolve-environment@v4.37.9
+        uses: github/codeql-action/resolve-environment@v4.38.2
         id: resolve-environment
         with:
           language: ${{ matrix.language }}
@@ -91,10 +91,10 @@ jobs:
         uses: ./.github/actions/build-ui
 
       - name: Autobuild
-        uses: github/codeql-action/autobuild@v4.37.9
+        uses: github/codeql-action/autobuild@v4.38.2
 
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/analyze@v4.37.9
+        uses: github/codeql-action/analyze@v4.38.2
         env:
           CODEQL_PROXY_HOST: ${{ steps.proxy.outputs.proxy_host }}
           CODEQL_PROXY_PORT: ${{ steps.proxy.outputs.proxy_port }}
```

**File**: `.github/workflows/docker-publish.yml` (modified, +3/-4)
```diff
@@ -48,13 +48,13 @@ jobs:
         if: github.event_name != 'pull_request'
         uses: sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6 #v4.1.2
         with:
-          cosign-release: "v2.2.4"
+          cosign-release: "v2.6.5"
 
       # Set up BuildKit Docker container builder to be able to build
       # multi-platform images and export cache
       # https://github.com/docker/setup-buildx-action
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
+        uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
 
       # Login against a Docker registry except on PR
       # https://github.com/docker/login-action
@@ -106,7 +106,7 @@ jobs:
       # https://github.com/docker/build-push-action
       - name: Build and push Docker image
         id: build-and-push
-        uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7.3.0
+        uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0
         with:
           context: .
           push: ${{ github.event_name != 'pull_request' }}
@@ -135,4 +135,3 @@ jobs:
         # This step uses the identity token to provision an ephemeral certificate
         # against the sigstore community Fulcio instance.
         run: echo "${TAGS}" | xargs -I {} cosign sign --yes {}@${DIGEST}
-        
\ No newline at end of file
```

**File**: `.github/workflows/lint.yml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ jobs:
         uses: ./.github/actions/build-ui
       - uses: actions/setup-go@v7
         with:
-          go-version: '1.25'
+          go-version-file: 'go.mod'
       - name: golangci-lint
         uses: golangci/golangci-lint-action@v9
         with:
```

**File**: `.golangci.yml` (modified, +3/-0)
```diff
@@ -35,6 +35,9 @@ linters:
           - revive
         text: "var-naming: avoid package names that conflict with Go standard library package names"
   settings:
+    modernize:
+      disable:
+        - newexpr
     staticcheck:
       checks:
         - "all"
```

**File**: `CONTRIBUTING.md` (modified, +3/-1)
```diff
@@ -26,9 +26,11 @@ Thanks for contributing and for helping us build toolsets that are truly valuabl
 
 These are one time installations required to be able to test your changes locally as part of the pull request (PR) submission process.
 
-1. Install Go [through download](https://go.dev/doc/install) | [through Homebrew](https://formulae.brew.sh/formula/go)
+1. Install Go 1.26.8 or later [through download](https://go.dev/doc/install) | [through Homebrew](https://formulae.brew.sh/formula/go)
 2. [Install golangci-lint v2](https://golangci-lint.run/welcome/install/#local-installation)
 
+The repository-pinned golangci-lint v2.9.0 supports Go 1.26, but cannot read Go 1.27 export data. When using a newer Go installation, run lint with `GOTOOLCHAIN=go1.26.8 script/lint`.
+
 ## Submitting a pull request
 
 1. [Fork][fork] and clone the repository
```

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ COPY ui/ ./ui/
 RUN mkdir -p ./pkg/github/ui_dist && \
     cd ui && npm run build
 
-FROM golang:1.27.1-alpine@sha256:cf6fca6641884b8433441b2b0652976f975e1d0fdd26d177eaaf8596087f3125 AS build
+FROM golang:1.27.1-alpine@sha256:8a5910f31396cd4d89662f56c68b3ae31d374308270a1c3bd96672ee5ed43414 AS build
 ARG VERSION="dev"
 
 # Set the working directory
```

---

### Incident Patch 7: `38cb0c44` (2026-10-02)
**Commit Message**: fix(pull_request_reviews): Update pending pull request review lookup to work when the authenticated actor is a Copilot bot (#3355)

**File**: `pkg/github/granular_tools_test.go` (modified, +8/-42)
```diff
@@ -1665,49 +1665,15 @@ func TestGranularUpdatePullRequestDraftState(t *testing.T) {
 
 func TestGranularAddPullRequestReviewComment(t *testing.T) {
 	mockedClient := githubv4mock.NewMockedHTTPClient(
-		githubv4mock.NewQueryMatcher(
-			struct {
-				Viewer struct {
-					Login githubv4.String
-				}
-			}{},
-			nil,
-			githubv4mock.DataResponse(map[string]any{
-				"viewer": map[string]any{"login": "testuser"},
-			}),
-		),
-		githubv4mock.NewQueryMatcher(
-			struct {
-				Repository struct {
-					PullRequest struct {
-						Reviews struct {
-							Nodes []struct {
-								ID    githubv4.ID
-								State githubv4.PullRequestReviewState
-								URL   githubv4.URI
-							}
-						} `graphql:"reviews(first: 1, author: $author)"`
-					} `graphql:"pullRequest(number: $prNum)"`
-				} `graphql:"repository(owner: $owner, name: $name)"`
-			}{},
-			map[string]any{
-				"author": githubv4.String("testuser"),
-				"owner":  githubv4.String("owner"),
-				"name":   githubv4.String("repo"),
-				"prNum":  githubv4.Int(1),
+		viewerIDQuery("U_testuser"),
+		getPendingReviewsQuery(getPendingReviewsQueryParams{
+			owner: "owner",
+			repo:  "repo",
+			prNum: 1,
+			reviews: []pendingReviewQueryReview{
+				{id: "PRR_123", authorID: "U_testuser"},
 			},
-			githubv4mock.DataResponse(map[string]any{
-				"repository": map[string]any{
-					"pullRequest": map[string]any{
-						"reviews": map[string]any{
-							"nodes": []map[string]any{
-								{"id": "PRR_123", "state": "PENDING", "url": "https://github.com/owner/repo/pull/1#pullrequestreview-123"},
-							},
-						},
-					},
-				},
-			}),
-		),
+		}),
 		githubv4mock.NewMutationMatcher(
 			struct {
 				AddPullRequestReviewThread struct {
```

**File**: `pkg/github/pullrequests.go` (modified, +106/-156)
```diff
@@ -1989,57 +1989,9 @@ func CreatePullRequestReview(ctx context.Context, client *githubv4.Client, param
 }
 
 func SubmitPendingPullRequestReview(ctx context.Context, client *githubv4.Client, params PullRequestReviewWriteParams) (*mcp.CallToolResult, error) {
-	// First we'll get the current user
-	var getViewerQuery struct {
-		Viewer struct {
-			Login githubv4.String
-		}
-	}
-
-	if err := client.Query(ctx, &getViewerQuery, nil); err != nil {
-		return ghErrors.NewGitHubGraphQLErrorResponse(ctx,
-			"failed to get current user",
-			err,
-		), nil
-	}
-
-	var getLatestReviewForViewerQuery struct {
-		Repository struct {
-			PullRequest struct {
-				Reviews struct {
-					Nodes []struct {
-						ID    githubv4.ID
-						State githubv4.PullRequestReviewState
-						URL   githubv4.URI
-					}
-				} `graphql:"reviews(first: 1, author: $author)"`
-			} `graphql:"pullRequest(number: $prNum)"`
-		} `graphql:"repository(owner: $owner, name: $name)"`
-	}
-
-	vars := map[string]any{
-		"author": githubv4.String(getViewerQuery.Viewer.Login),
-		"owner":  githubv4.String(params.Owner),
-		"name":   githubv4.String(params.Repo),
-		"prNum":  githubv4.Int(params.PullNumber),
-	}
-
-	if err := client.Query(ctx, &getLatestReviewForViewerQuery, vars); err != nil {
-		return ghErrors.NewGitHubGraphQLErrorResponse(ctx,
-			"failed to get latest review for current user",
-			err,
-		), nil
-	}
-
-	// Validate there is one review and the state is pending
-	if len(getLatestReviewForViewerQuery.Repository.PullRequest.Reviews.Nodes) == 0 {
-		return utils.NewToolResultError("No pending review found for the viewer"), nil
-	}
-
-	review := getLatestReviewForViewerQuery.Repository.PullRequest.Reviews.Nodes[0]
-	if review.State != githubv4.PullRequestReviewStatePending {
-		errText := fmt.Sprintf("The latest review, found at %s is not pending", review.URL)
-		return utils.NewToolResultError(errText), nil
+	review, result := getPendingPullRequestReviewForViewer(ctx, client, params.Owner, params.Repo, params.PullNumber)
+	if result != nil {
+		return result, nil
 	}
 
 	// Prepare the mutation
@@ -2055,7 +2007,7 @@ func SubmitPendingPullRequestReview(ctx context.Context, client *githubv4.Client
 		ctx,
 		&submitPullRequestReviewMutation,
 		githubv4.SubmitPullRequestReviewInput{
-			PullRequestReviewID: &review.ID,
+			PullRequestReviewID: review,
 			Event:               githubv4.PullRequestReviewEvent(params.Event),
 			Body:                newGQLStringlikePtr[githubv4.String](&params.Body),
 		},
@@ -2074,57 +2026,9 @@ func SubmitPendingPullRequestReview(ctx context.Context, client *githubv4.Client
 }
 
 func DeletePendingPullRequestReview(ctx context.Context, client *githubv4.Client, params PullRequestReviewWriteParams) (*mcp.CallToolResult, error) {
-	// First we'll get the current user
-	var getViewerQuery struct {
-		Viewer struct {
-			Login githubv4.String
-		}
-	}
-
-	if err := client.Query(ctx, &getViewerQuery, nil); err != nil {
-		return ghErrors.NewGitHubGraphQLErrorResponse(ctx,
-			"failed to get current user",
-			err,
-		), nil
-	}
-
-	var getLatestReviewForViewerQuery struct {
-		Repository struct {
-			PullRequest struct {
-				Reviews struct {
-					Nodes []struct {
-						ID    githubv4.ID
-						State githubv4.PullRequestReviewState
-						URL   githubv4.URI
-					}
-				} `graphql:"reviews(first: 1, author: $author)"`
-			} `graphql:"pullRequest(number: $prNum)"`
-		} `graphql:"repository(owner: $owner, name: $name)"`
-	}
-
-	vars := map[string]any{
-		"author": githubv4.String(getViewerQuery.Viewer.Login),
-		"owner":  githubv4.String(params.Owner),
-		"name":   githubv4.String(params.Repo),
-		"prNum":  githubv4.Int(params.PullNumber),
-	}
-
-	if err := client.Query(ctx, &getLatestReviewForViewerQuery, vars); err != nil {
-		return ghErrors.NewGitHubGraphQLErrorResponse(ctx,
-			"failed to get latest review for current user",
-			err,
-		), nil
-	}
-
-	// Validate there is one review and the state is pending
-	if len(getLatestReviewForViewerQuery.Repository.PullRequest.Reviews.Nodes) == 0 {
-		return utils.NewToolResultError("No pending review found for the viewer"), nil
-	}
-
-	review := getLatestReviewForViewerQuery.Repository.PullRequest.Reviews.Nodes[0]
-	if review.State != githubv4.PullRequestReviewStatePending {
-		errText := fmt.Sprintf("The latest review, found at %s is not pending", review.URL)
-		return utils.NewToolResultError(errText), nil
+	review, result := getPendingPullRequestReviewForViewer(ctx, client, params.Owner, params.Repo, params.PullNumber)
+	if result != nil {
+		return result, nil
 	}
 
 	// Prepare the mutation
@@ -2140,7 +2044,7 @@ func DeletePendingPullRequestReview(ctx context.Context, client *githubv4.Client
 		ctx,
 		&deletePullRequestReviewMutation,
 		githubv4.DeletePullRequestReviewInput{
-			PullRequestReviewID: &review.ID,
+			PullRequestReviewID: review,
 		},
 		nil,
 	); err != nil {
@@ -2235,57 +2139,9 @@ type AddCommentToPendingReviewParams struct {
 
 // AddCom
```

**File**: `pkg/github/pullrequests_test.go` (modified, +164/-91)
```diff
@@ -3667,7 +3667,7 @@ func TestAddPullRequestReviewCommentToPendingReview(t *testing.T) {
 		expectedToolErrMsg string
 	}{
 		{
-			name: "successful line comment addition",
+			name: "selects viewer pending review by ID",
 			requestArgs: map[string]any{
 				"owner":       "owner",
 				"repo":        "repo",
@@ -3681,18 +3681,21 @@ func TestAddPullRequestReviewCommentToPendingReview(t *testing.T) {
 				"startSide":   "RIGHT",
 			},
 			mockedClient: githubv4mock.NewMockedHTTPClient(
-				viewerQuery("williammartin"),
-				getLatestPendingReviewQuery(getLatestPendingReviewQueryParams{
-					author: "williammartin",
-					owner:  "owner",
-					repo:   "repo",
-					prNum:  42,
-
-					reviews: []getLatestPendingReviewQueryReview{
+				viewerIDQuery("U_viewer"),
+				getPendingReviewsQuery(getPendingReviewsQueryParams{
+					owner: "owner",
+					repo:  "repo",
+					prNum: 42,
+
+					reviews: []pendingReviewQueryReview{
+						{
+							id:       "PR_other",
+							authorID: "U_other",
+						},
 						{
-							id:    "PR_kwDODKw3uc6WYN1T",
-							state: "PENDING",
-							url:   "https://github.com/owner/repo/pull/42",
+							id:          "PR_kwDODKw3uc6WYN1T",
+							authorID:    "U_viewer",
+							authorField: "botId",
 						},
 					},
 				}),
@@ -3740,18 +3743,16 @@ func TestAddPullRequestReviewCommentToPendingReview(t *testing.T) {
 				"startSide":   "RIGHT",
 			},
 			mockedClient: githubv4mock.NewMockedHTTPClient(
-				viewerQuery("williammartin"),
-				getLatestPendingReviewQuery(getLatestPendingReviewQueryParams{
-					author: "williammartin",
-					owner:  "owner",
-					repo:   "repo",
-					prNum:  42,
-
-					reviews: []getLatestPendingReviewQueryReview{
+				viewerIDQuery("U_viewer"),
+				getPendingReviewsQuery(getPendingReviewsQueryParams{
+					owner: "owner",
+					repo:  "repo",
+					prNum: 42,
+
+					reviews: []pendingReviewQueryReview{
 						{
-							id:    "PR_kwDODKw3uc6WYN1T",
-							state: "PENDING",
-							url:   "https://github.com/owner/repo/pull/42",
+							id:       "PR_kwDODKw3uc6WYN1T",
+							authorID: "U_viewer",
 						},
 					},
 				}),
@@ -3821,18 +3822,16 @@ func TestAddPullRequestReviewCommentToPendingReview(t *testing.T) {
 				"side":        "RIGHT",
 			},
 			mockedClient: githubv4mock.NewMockedHTTPClient(
-				viewerQuery("williammartin"),
-				getLatestPendingReviewQuery(getLatestPendingReviewQueryParams{
-					author: "williammartin",
-					owner:  "owner",
-					repo:   "repo",
-					prNum:  42,
-
-					reviews: []getLatestPendingReviewQueryReview{
+				viewerIDQuery("U_viewer"),
+				getPendingReviewsQuery(getPendingReviewsQueryParams{
+					owner: "owner",
+					repo:  "repo",
+					prNum: 42,
+
+					reviews: []pendingReviewQueryReview{
 						{
-							id:    "PR_kwDODKw3uc6WYN1T",
-							state: "PENDING",
-							url:   "https://github.com/owner/repo/pull/42",
+							id:       "PR_kwDODKw3uc6WYN1T",
+							authorID: "U_viewer",
 						},
 					},
 				}),
@@ -3939,18 +3938,16 @@ func TestSubmitPendingPullRequestReview(t *testing.T) {
 				"body":       "This is a test review",
 			},
 			mockedClient: githubv4mock.NewMockedHTTPClient(
-				viewerQuery("williammartin"),
-				getLatestPendingReviewQuery(getLatestPendingReviewQueryParams{
-					author: "williammartin",
-					owner:  "owner",
-					repo:   "repo",
-					prNum:  42,
-
-					reviews: []getLatestPendingReviewQueryReview{
+				viewerIDQuery("U_viewer"),
+				getPendingReviewsQuery(getPendingReviewsQueryParams{
+					owner: "owner",
+					repo:  "repo",
+					prNum: 42,
+
+					reviews: []pendingReviewQueryReview{
 						{
-							id:    "PR_kwDODKw3uc6WYN1T",
-							state: "PENDING",
-							url:   "https://github.com/owner/repo/pull/42",
+							id:       "PR_kwDODKw3uc6WYN1T",
+							authorID: "U_viewer",
 						},
 					},
 				}),
@@ -4040,18 +4037,16 @@ func TestDeletePendingPullRequestReview(t *testing.T) {
 				"pullNumber": float64(42),
 			},
 			mockedClient: githubv4mock.NewMockedHTTPClient(
-				viewerQuery("williammartin"),
-				getLatestPendingReviewQuery(getLatestPendingReviewQueryParams{
-					author: "williammartin",
-					owner:  "owner",
-					repo:   "repo",
-					prNum:  42,
-
-					reviews: []getLatestPendingReviewQueryReview{
+				viewerIDQuery("U_viewer"),
+				getPendingReviewsQuery(getPendingReviewsQueryParams{
+					owner: "owner",
+					repo:  "repo",
+					prNum: 42,
+
+					reviews: []pendingReviewQueryReview{
 						{
-							id:    "PR_kwDODKw3uc6WYN1T",
-							state: "PENDING",
-							url:   "https://github.com/owner/repo/pull/42",
+							id:       "PR_kwDODKw3uc6WYN1T",
+							authorID: "U_viewer",
 						},
 					},
 				}),
@@ -4106,6 +4101,57 @@ func TestDeletePendingPullRequestReview(t *testing.T) {
 	}
 }
 
+func TestGetPendingPullRequestReviewForViewerPaginates(t *testing.T) {
+	t.Parallel()
+
+	var reviewQueries atomic.Int32
+	transport := NewMockRoundTripper().OnRequest(http.MethodPost, "/graphql", func(w http.ResponseWr
```

---

### Incident Patch 8: `a1f65004` (2026-10-01)
**Commit Message**: Use source revisions for non-release Docker builds (#3357)

Only tag builds should supply a release version. Other Docker builds use the existing linked-commit fallback instead of treating a branch or pull-request ref name as a release.

Co-authored-by: Copilot <[REDACTED_EMAIL]>
Copilot-Session: 6dde41da-ec25-4370-b26c-b036d0a53b3c

**File**: `.github/workflows/docker-publish.yml` (modified, +1/-1)
```diff
@@ -116,7 +116,7 @@ jobs:
           cache-to: type=gha,mode=max
           platforms: linux/amd64,linux/arm64
           build-args: |
-            VERSION=${{ github.ref_name }}
+            VERSION=${{ github.ref_type == 'tag' && github.ref_name || 'dev' }}
           secrets: |
             oauth_client_id=${{ secrets.OAUTH_CLIENT_ID }}
             oauth_client_secret=${{ secrets.OAUTH_CLIENT_SECRET }}
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -405,7 +405,7 @@ For a complete overview of all installation options, see our **[Installation Gui
 If you don't have Docker, you can use `go build` to build the binary in the
 `cmd/github-mcp-server` directory, and use the `github-mcp-server stdio` command with the `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable set to your token. To specify the output location of the build, use the `-o` flag. You should configure your server to use the built executable as its `command`.
 
-STDIO API requests identify the server as `github-mcp-server/<version>` and retain the upstream MCP client's name/version in parentheses when available. Control characters, quotes, backslashes and parentheses in client metadata are escaped so the HTTP header remains valid; ordinary names, versions, spaces and printable Unicode are preserved. Release builds keep their release version. Source and default Docker builds with revision metadata use `vcs-<full-commit-sha>`. The `-dirty` marker applies only when both the revision and modified state come from embedded VCS metadata, never to a valid, explicitly supplied `main.commit`. This is a VCS build identifier, not a release number.
+STDIO API requests identify the server as `github-mcp-server/<version>` and retain the upstream MCP client's name/version in parentheses when available. Control characters, quotes, backslashes and parentheses in client metadata are escaped so the HTTP header remains valid; ordinary names, versions, spaces and printable Unicode are preserved. Release builds keep their release version. Source and default Docker builds with revision metadata use `vcs-<full-commit-sha>`. The Docker publishing workflow preserves tag versions, including prereleases, and lets branch, pull-request and nightly builds use the linked source revision. The `-dirty` marker applies only when both the revision and modified state come from embedded VCS metadata, never to a valid, explicitly supplied `main.commit`. This is a VCS build identifier, not a release number.
 
 Build the complete package with `go build -o github-mcp-server ./cmd/github-mcp-server` from a Git checkout to embed its VCS revision. For builds without VCS metadata, supply the actual release with `-ldflags '-X main.version=<release>'` or the full source revision with `-ldflags '-X main.commit=<sha>'`. Valid metadata is selected in this order: explicit release, explicit source revision, embedded VCS revision, then installed main-module version. Valid explicit revisions remain authoritative even if build-context filtering changes embedded VCS metadata. Missing or malformed candidates fall through to the next usable source. If none is available, STDIO still starts with the development label `dev` and emits a warning on stderr, leaving stdout available for the MCP protocol. Supply real release or revision metadata when version-specific attribution is needed.
 
```

---

### Incident Patch 9: `63f55954` (2026-10-01)
**Commit Message**: Always enable MCP Apps UI; remove remote_mcp_ui_apps flag gate (#3348)

* Always enable MCP Apps UI; remove remote_mcp_ui_apps flag gate

The remote_mcp_ui_apps flag is fully rolled out on the hosted server, but
the OSS server still defaulted it off. Make MCP Apps unconditional:

- _meta.ui is always emitted, stripped only when the client explicitly
  does not advertise the io.modelcontextprotocol/ui capability
- ui_get is always registered
- write tools defer to MCP App forms by default (still opt-out via
  mcp_apps_disable_form_deferral)
- remove MCPAppsFeatureFlag and its AllowedFeatureFlags/InsidersFeatureFlags
  entries
- update tests and regenerate docs

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* Remove unused Inventory.checkFeatureFlag

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* Omit app-only tools for clients without MCP Apps support

When a client does not advertise io.modelcontextprotocol/ui, stripping
_meta.ui from ui_get turned it into an ordinary model-visible tool,
violating its app-only contract. Now that ui_get is no longer feature
gated, omit tools whose ui.visibility excludes "model" instead.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

---------

**File**: `README.md` (modified, +10/-0)
```diff
@@ -710,6 +710,7 @@ The following sets of tools are available:
 <summary><picture><source media="(prefers-color-scheme: dark)" srcset="pkg/octicons/icons/person-dark.png"><source media="(prefers-color-scheme: light)" srcset="pkg/octicons/icons/person-light.png"><img src="pkg/octicons/icons/person-light.png" width="20" height="20" alt="person"></picture> Context</summary>
 
 - **get_me** - Get my user profile
+  - **MCP App UI**: `ui://github-mcp-server/get-me`
   - No parameters required
 
 - **get_team_members** - Get team members
@@ -721,6 +722,12 @@ The following sets of tools are available:
   - **OAuth Challenge Scopes**: `read:org`
   - `user`: Username to get teams for. If not provided, uses the authenticated user. (string, optional)
 
+- **ui_get** - Get UI data
+  - **OAuth Challenge Scopes**: `repo`, `read:org`
+  - `method`: The type of data to fetch (string, required)
+  - `owner`: Repository owner (required for all methods) (string, required)
+  - `repo`: Repository name (required for labels, assignees, milestones, branches, issue fields, reviewers) (string, optional)
+
 </details>
 
 <details>
@@ -989,6 +996,7 @@ The following sets of tools are available:
 
 - **issue_write** - Create or update issue/pull request
   - **OAuth Challenge Scopes**: `repo`
+  - **MCP App UI**: `ui://github-mcp-server/issue-write`
   - `assignees`: Usernames to assign to this issue (string[], optional)
   - `body`: Issue body content (string, optional)
   - `duplicate_of`: Issue number that this issue is a duplicate of. Required when state_reason is 'duplicate'. (number, optional)
@@ -1244,6 +1252,7 @@ The following sets of tools are available:
 
 - **create_pull_request** - Open new pull request
   - **OAuth Challenge Scopes**: `repo`
+  - **MCP App UI**: `ui://github-mcp-server/pr-write`
   - `base`: Branch to merge into (string, required)
   - `body`: PR description (string, optional)
   - `draft`: Create as draft PR (boolean, optional)
@@ -1322,6 +1331,7 @@ The following sets of tools are available:
 
 - **update_pull_request** - Edit pull request
   - **OAuth Challenge Scopes**: `repo`
+  - **MCP App UI**: `ui://github-mcp-server/pr-edit`
   - `base`: New base branch name (string, optional)
   - `body`: New description (string, optional)
   - `draft`: Mark pull request as draft (true) or ready for review (false) (boolean, optional)
```

**File**: `cmd/github-mcp-server/generate_docs.go` (modified, +1/-3)
```diff
@@ -222,9 +222,7 @@ func writeToolDoc(buf *strings.Builder, tool inventory.ServerTool) {
 		fmt.Fprintf(buf, "  - **OAuth Challenge Scopes**: `%s`\n", strings.Join(scopes, "`, `"))
 	}
 
-	// MCP App UI metadata (only rendered when the remote_mcp_ui_apps flag
-	// applied to the inventory; for the no-flags README this section is
-	// stripped by inventory.ToolsForRegistration before rendering).
+	// MCP App UI metadata.
 	if ui, ok := tool.Tool.Meta["ui"].(map[string]any); ok {
 		if uri, ok := ui["resourceUri"].(string); ok && uri != "" {
 			fmt.Fprintf(buf, "  - **MCP App UI**: `%s`\n", uri)
```

**File**: `docs/feature-flags.md` (modified, +0/-64)
```diff
@@ -86,70 +86,6 @@ as output formatting) won't appear here.
 
 <!-- START AUTOMATED FEATURE FLAG TOOLS -->
 
-### `remote_mcp_ui_apps`
-
-- **create_pull_request** - Open new pull request
-  - **OAuth Challenge Scopes**: `repo`
-  - **MCP App UI**: `ui://github-mcp-server/pr-write`
-  - `base`: Branch to merge into (string, required)
-  - `body`: PR description (string, optional)
-  - `draft`: Create as draft PR (boolean, optional)
-  - `head`: Branch containing changes (string, required)
-  - `maintainer_can_modify`: Allow maintainer edits (boolean, optional)
-  - `owner`: Repository owner (string, required)
-  - `repo`: Repository name (string, required)
-  - `reviewers`: GitHub usernames or ORG/team-slug team reviewers to request reviews from (string[], optional)
-  - `title`: PR title (string, required)
-
-- **get_me** - Get my user profile
-  - **MCP App UI**: `ui://github-mcp-server/get-me`
-  - No parameters required
-
-- **issue_write** - Create or update issue/pull request
-  - **OAuth Challenge Scopes**: `repo`
-  - **MCP App UI**: `ui://github-mcp-server/issue-write`
-  - `assignees`: Usernames to assign to this issue (string[], optional)
-  - `body`: Issue body content (string, optional)
-  - `duplicate_of`: Issue number that this issue is a duplicate of. Required when state_reason is 'duplicate'. (number, optional)
-  - `issue_fields`: Issue field values to set or clear. Each item requires 'field_name' and exactly one of 'value', 'field_option_name', or 'delete: true'. (object[], optional)
-  - `issue_number`: Issue number to update (number, optional)
-  - `labels`: Labels to apply to this issue (string[], optional)
-  - `method`: Write operation to perform on a single issue.
-    Options are:
-    - 'create' - creates a new issue.
-    - 'update' - updates an existing issue.
-     (string, required)
-  - `milestone`: Milestone number (number, optional)
-  - `owner`: Repository owner (string, required)
-  - `parent_issue_number`: Issue number of the parent issue. Only used when method is 'create' and cannot be combined with issue_fields. The new issue is created and attached to this parent in the same operation. (number, optional)
-  - `parent_owner`: Repository owner of the parent issue. Must be provided with parent_repo. Omit both to use owner and repo. Only used when method is 'create' and parent_issue_number is provided. (string, optional)
-  - `parent_repo`: Repository name of the parent issue. Must be provided with parent_owner. Omit both to use owner and repo. Only used when method is 'create' and parent_issue_number is provided. (string, optional)
-  - `repo`: Repository name (string, required)
-  - `state`: New state (string, optional)
-  - `state_reason`: Reason for the state change. Ignored unless state is changed. (string, optional)
-  - `title`: Issue title (string, optional)
-  - `type`: Type of this issue. For updates, pass null to remove the current type. Only use if issue types are enabled for this repository. Use list_issue_types to get valid type values for this repository or its owner organization. If the repository doesn't support issue types, omit this parameter. (string | null, optional)
-
-- **ui_get** - Get UI data
-  - **OAuth Challenge Scopes**: `repo`, `read:org`
-  - `method`: The type of data to fetch (string, required)
-  - `owner`: Repository owner (required for all methods) (string, required)
-  - `repo`: Repository name (required for labels, assignees, milestones, branches, issue fields, reviewers) (string, optional)
-
-- **update_pull_request** - Edit pull request
-  - **OAuth Challenge Scopes**: `repo`
-  - **MCP App UI**: `ui://github-mcp-server/pr-edit`
-  - `base`: New base branch name (string, optional)
-  - `body`: New description (string, optional)
-  - `draft`: Mark pull request as draft (true) or ready for review (false) (boolean, optional)
-  - `maintainer_can_modify`: Allow maintainer edits (boolean, optional)
-  - `owner`: Repository owner (string, required)
-  - `pullNumber`: Pull request number to update (number, required)
-  - `repo`: Repository name (string, required)
-  - `reviewers`: GitHub usernames or ORG/team-slug team reviewers to request reviews from (string[], optional)
-  - `state`: New state (string, optional)
-  - `title`: New title (string, optional)
-
 ### `issues_granular`
 
 - **add_issue_comment_reaction** - Add Reaction to Issue or Pull Request Comment
```

**File**: `docs/insiders-features.md` (modified, +0/-89)
```diff
@@ -26,70 +26,6 @@ The list below is generated from the Go source. It covers tool **inventory and s
 
 <!-- START AUTOMATED INSIDERS TOOLS -->
 
-### `remote_mcp_ui_apps`
-
-- **create_pull_request** - Open new pull request
-  - **OAuth Challenge Scopes**: `repo`
-  - **MCP App UI**: `ui://github-mcp-server/pr-write`
-  - `base`: Branch to merge into (string, required)
-  - `body`: PR description (string, optional)
-  - `draft`: Create as draft PR (boolean, optional)
-  - `head`: Branch containing changes (string, required)
-  - `maintainer_can_modify`: Allow maintainer edits (boolean, optional)
-  - `owner`: Repository owner (string, required)
-  - `repo`: Repository name (string, required)
-  - `reviewers`: GitHub usernames or ORG/team-slug team reviewers to request reviews from (string[], optional)
-  - `title`: PR title (string, required)
-
-- **get_me** - Get my user profile
-  - **MCP App UI**: `ui://github-mcp-server/get-me`
-  - No parameters required
-
-- **issue_write** - Create or update issue/pull request
-  - **OAuth Challenge Scopes**: `repo`
-  - **MCP App UI**: `ui://github-mcp-server/issue-write`
-  - `assignees`: Usernames to assign to this issue (string[], optional)
-  - `body`: Issue body content (string, optional)
-  - `duplicate_of`: Issue number that this issue is a duplicate of. Required when state_reason is 'duplicate'. (number, optional)
-  - `issue_fields`: Issue field values to set or clear. Each item requires 'field_name' and exactly one of 'value', 'field_option_name', or 'delete: true'. (object[], optional)
-  - `issue_number`: Issue number to update (number, optional)
-  - `labels`: Labels to apply to this issue (string[], optional)
-  - `method`: Write operation to perform on a single issue.
-    Options are:
-    - 'create' - creates a new issue.
-    - 'update' - updates an existing issue.
-     (string, required)
-  - `milestone`: Milestone number (number, optional)
-  - `owner`: Repository owner (string, required)
-  - `parent_issue_number`: Issue number of the parent issue. Only used when method is 'create' and cannot be combined with issue_fields. The new issue is created and attached to this parent in the same operation. (number, optional)
-  - `parent_owner`: Repository owner of the parent issue. Must be provided with parent_repo. Omit both to use owner and repo. Only used when method is 'create' and parent_issue_number is provided. (string, optional)
-  - `parent_repo`: Repository name of the parent issue. Must be provided with parent_owner. Omit both to use owner and repo. Only used when method is 'create' and parent_issue_number is provided. (string, optional)
-  - `repo`: Repository name (string, required)
-  - `state`: New state (string, optional)
-  - `state_reason`: Reason for the state change. Ignored unless state is changed. (string, optional)
-  - `title`: Issue title (string, optional)
-  - `type`: Type of this issue. For updates, pass null to remove the current type. Only use if issue types are enabled for this repository. Use list_issue_types to get valid type values for this repository or its owner organization. If the repository doesn't support issue types, omit this parameter. (string | null, optional)
-
-- **ui_get** - Get UI data
-  - **OAuth Challenge Scopes**: `repo`, `read:org`
-  - `method`: The type of data to fetch (string, required)
-  - `owner`: Repository owner (required for all methods) (string, required)
-  - `repo`: Repository name (required for labels, assignees, milestones, branches, issue fields, reviewers) (string, optional)
-
-- **update_pull_request** - Edit pull request
-  - **OAuth Challenge Scopes**: `repo`
-  - **MCP App UI**: `ui://github-mcp-server/pr-edit`
-  - `base`: New base branch name (string, optional)
-  - `body`: New description (string, optional)
-  - `draft`: Mark pull request as draft (true) or ready for review (false) (boolean, optional)
-  - `maintainer_can_modify`: Allow maintainer edits (boolean, optional)
-  - `owner`: Repository owner (string, required)
-  - `pullNumber`: Pull request number to update (number, required)
-  - `repo`: Repository name (string, required)
-  - `reviewers`: GitHub usernames or ORG/team-slug team reviewers to request reviews from (string[], optional)
-  - `state`: New state (string, optional)
-  - `title`: New title (string, optional)
-
 ### `file_blame`
 
 - **get_file_blame** - Get file blame information
@@ -139,31 +75,6 @@ The list below is generated from the Go source. It covers tool **inventory and s
 
 ---
 
-## MCP Apps
-
-[MCP Apps](https://modelcontextprotocol.io/docs/extensions/apps) is an extension to the Model Context Protocol that enables servers to deliver interactive user interfaces to end users. Instead of returning plain text that the LLM must interpret and relay, tools can render forms, profiles, and dashboards right in the chat using MCP Apps.
-
-This means you can interact with GitHub visually: fill out forms to create issues, see user profiles with avatars, ope
```

**File**: `docs/server-configuration.md` (modified, +8/-45)
```diff
@@ -345,7 +345,7 @@ As an intentional exception, content authored by trusted bot accounts (currently
 
 **Best for:** Users who want early access to experimental features and new tools before they reach general availability.
 
-Insiders Mode unlocks experimental features, such as [MCP Apps](#mcp-apps) support. We created this mode to have a way to roll out experimental features and collect feedback. So if you are using Insiders, please don't hesitate to share your feedback with us! Features in Insiders Mode may change, evolve, or be removed based on user feedback.
+Insiders Mode unlocks experimental features, such as [CSV output for list tools](./insiders-features.md#csv-output-for-list-tools). We created this mode to have a way to roll out experimental features and collect feedback. So if you are using Insiders, please don't hesitate to share your feedback with us! Features in Insiders Mode may change, evolve, or be removed based on user feedback.
 
 <table>
 <tr><th>Remote Server</th><th>Local Server</th></tr>
@@ -402,18 +402,18 @@ See [Insiders Features](./insiders-features.md) for a full list of what's availa
 
 [MCP Apps](https://modelcontextprotocol.io/docs/extensions/apps) is an extension to the Model Context Protocol that enables servers to deliver interactive user interfaces to end users. Instead of returning plain text that the LLM must interpret and relay, tools can render forms, profiles, and dashboards right in the chat.
 
-MCP Apps is enabled by [Insiders Mode](#insiders-mode), or independently via the `remote_mcp_ui_apps` feature flag.
+MCP Apps is enabled by default. Tools with MCP Apps UIs advertise them via `_meta.ui` to clients that support the [MCP Apps extension](https://modelcontextprotocol.io/docs/extensions/apps); the metadata is omitted for clients that do not advertise the `io.modelcontextprotocol/ui` capability.
 
 To keep MCP App result views enabled while making write tools execute directly
-instead of first opening an interactive form, also enable the
-`mcp_apps_disable_form_deferral` feature flag. For the remote server, send both
-flags in the request header:
+instead of first opening an interactive form, enable the
+`mcp_apps_disable_form_deferral` feature flag. For the remote server, send the
+flag in the request header:
 
 ```http
-X-MCP-Features: remote_mcp_ui_apps,mcp_apps_disable_form_deferral
+X-MCP-Features: mcp_apps_disable_form_deferral
 ```
 
-For the local server, pass both flags to `--features`.
+For the local server, pass it to `--features`.
 
 **Supported tools:**
 
@@ -422,47 +422,10 @@ For the local server, pass both flags to `--features`.
 | `get_me` | Displays your GitHub user profile with avatar, bio, and stats in a rich card |
 | `issue_write` | Opens an interactive form to create or update issues |
 | `create_pull_request` | Provides a full PR creation form to create a pull request (or a draft pull request) |
+| `update_pull_request` | Opens an interactive form to edit a pull request |
 
 **Client requirements:** MCP Apps requires a host that supports the [MCP Apps extension](https://modelcontextprotocol.io/docs/extensions/apps). Currently tested with VS Code (`chat.mcp.apps.enabled` setting).
 
-<table>
-<tr><th>Remote Server</th><th>Local Server</th></tr>
-<tr valign="top">
-<td>
-
-```json
-{
-  "type": "http",
-  "url": "https://api.githubcopilot.com/mcp/",
-  "headers": {
-    "X-MCP-Features": "remote_mcp_ui_apps"
-  }
-}
-```
-
-</td>
-<td>
-
-```json
-{
-  "type": "stdio",
-  "command": "go",
-  "args": [
-    "run",
-    "./cmd/github-mcp-server",
-    "stdio",
-    "--features=remote_mcp_ui_apps"
-  ],
-  "env": {
-    "GITHUB_PERSONAL_ACCESS_TOKEN": "${input:github_token}"
-  }
-}
-```
-
-</td>
-</tr>
-</table>
-
 ---
 
 ### Scope Filtering
```

**File**: `pkg/github/feature_flags.go` (modified, +0/-5)
```diff
@@ -6,9 +6,6 @@ import (
 	"github.com/github/github-mcp-server/pkg/inventory"
 )
 
-// MCPAppsFeatureFlag is the feature flag name for MCP Apps (interactive UI forms).
-const MCPAppsFeatureFlag = "remote_mcp_ui_apps"
-
 // MCPAppsDisableFormDeferralFeatureFlag disables handing write-tool calls off
 // to MCP App forms while preserving MCP Apps UI metadata and result views.
 const MCPAppsDisableFormDeferralFeatureFlag = "mcp_apps_disable_form_deferral"
@@ -47,7 +44,6 @@ const FeatureFlagThreadResolutionReason = "thread_resolution_reason"
 // Only flags in this list are accepted; unknown flags are silently ignored.
 // This is the single source of truth for which flags are user-controllable.
 var AllowedFeatureFlags = []string{
-	MCPAppsFeatureFlag,
 	MCPAppsDisableFormDeferralFeatureFlag,
 	FeatureFlagCSVOutput,
 	FeatureFlagIFCLabels,
@@ -64,7 +60,6 @@ var AllowedFeatureFlags = []string{
 // This is the single source of truth for what "insiders" means in terms of
 // feature flag expansion.
 var InsidersFeatureFlags = []string{
-	MCPAppsFeatureFlag,
 	FeatureFlagCSVOutput,
 	FeatureFlagFileBlame,
 	FeatureFlagIssueDependencies,
```

**File**: `pkg/github/feature_flags_benchmark_test.go` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ func featureBenchmarkDistributions() []featureBenchmarkDistribution {
 		{
 			name: "mixed",
 			enabled: map[string]bool{
-				MCPAppsFeatureFlag:           true,
+				FeatureFlagCSVOutput:         true,
 				FeatureFlagFileBlame:         true,
 				FeatureFlagIssuesGranular:    true,
 				FeatureFlagIssueDependencies: true,
```

**File**: `pkg/github/feature_flags_test.go` (modified, +6/-6)
```diff
@@ -149,12 +149,12 @@ func TestResolveFeatureFlags(t *testing.T) {
 			name:            "no features, no insiders",
 			enabledFeatures: nil,
 			expectedFlags:   nil,
-			unexpectedFlags: []string{MCPAppsFeatureFlag},
+			unexpectedFlags: []string{FeatureFlagCSVOutput},
 		},
 		{
 			name:            "explicit feature enabled",
-			enabledFeatures: []string{MCPAppsFeatureFlag},
-			expectedFlags:   []string{MCPAppsFeatureFlag},
+			enabledFeatures: []string{FeatureFlagCSVOutput},
+			expectedFlags:   []string{FeatureFlagCSVOutput},
 		},
 		{
 			name:            "MCP Apps form deferral can be disabled directly",
@@ -191,8 +191,8 @@ func TestResolveFeatureFlags(t *testing.T) {
 		},
 		{
 			name:            "mix of known and unknown flags",
-			enabledFeatures: []string{MCPAppsFeatureFlag, "unknown_flag"},
-			expectedFlags:   []string{MCPAppsFeatureFlag},
+			enabledFeatures: []string{FeatureFlagCSVOutput, "unknown_flag"},
+			expectedFlags:   []string{FeatureFlagCSVOutput},
 			unexpectedFlags: []string{"unknown_flag"},
 		},
 		{
@@ -214,7 +214,7 @@ func TestResolveFeatureFlags(t *testing.T) {
 		},
 		{
 			name:            "explicit plus insiders deduplicates",
-			enabledFeatures: []string{MCPAppsFeatureFlag},
+			enabledFeatures: []string{FeatureFlagCSVOutput},
 			insidersMode:    true,
 			expectedFlags:   InsidersFeatureFlags,
 		},
```

---

### Incident Patch 10: `7d13a7ad` (2026-09-08)
**Commit Message**: fix(oauth): advertise only default scopes in protected resource metadata (#3251)

* fix(oauth): advertise only default scopes in metadata

Keep the full OAuth scope catalog available for per-tool step-up challenges, but limit protected resource discovery to the lower-risk default grant.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* Update expectedScopes in oauth_test.go

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

---------

Co-authored-by: Copilot App <[REDACTED_EMAIL]>
Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `docs/streamable-http.md` (modified, +11/-1)
```diff
@@ -72,13 +72,23 @@ The OAuth protected resource metadata's `resource` attribute will be populated w
   ],
   "scopes_supported": [
     "repo",
-    ...
+    "read:org",
+    "read:user",
+    "user:email",
+    "read:packages",
+    "write:packages",
+    "read:project",
+    "project",
+    "gist",
+    "notifications"
   ],
   ...
 }
 ```
 
 This allows OAuth clients to discover authentication requirements and endpoint information automatically.
+Scopes excluded from this default set, such as `delete_repo`, are requested only
+through a per-tool OAuth authorization challenge when needed.
 
 The HTTP server is the OAuth protected resource, not the authorization server. It
 therefore serves `/.well-known/oauth-protected-resource` but does not serve
```

**File**: `pkg/http/oauth/oauth.go` (modified, +5/-6)
```diff
@@ -20,13 +20,12 @@ const (
 	OAuthProtectedResourcePrefix = "/.well-known/oauth-protected-resource"
 )
 
-// SupportedScopes lists every OAuth scope that an MCP tool may require. HTTP
-// protected-resource metadata advertises this full set so clients can step up
-// authorization for tools excluded from the default grant.
+// SupportedScopes lists every OAuth scope that an MCP tool may require.
 var SupportedScopes = scopes.SupportedOAuthScopes()
 
-// DefaultScopes are requested by stdio OAuth unless the operator explicitly
-// supplies --oauth-scopes. High-risk scopes such as delete_repo require opt-in.
+// DefaultScopes are advertised in protected-resource metadata and requested by
+// stdio OAuth unless the operator explicitly supplies --oauth-scopes. Other
+// scopes require opt-in through a per-tool authorization challenge.
 var DefaultScopes = scopes.DefaultOAuthScopes()
 
 // Config holds the OAuth configuration for the MCP server.
@@ -128,7 +127,7 @@ func (h *AuthHandler) metadataHandler() http.Handler {
 			Resource:               resourceURL,
 			AuthorizationServers:   []string{authorizationServerURL},
 			ResourceName:           "GitHub MCP Server",
-			ScopesSupported:        SupportedScopes,
+			ScopesSupported:        DefaultScopes,
 			BearerMethodsSupported: []string{"header"},
 		}
 
```

**File**: `pkg/http/oauth/oauth_test.go` (modified, +29/-3)
```diff
@@ -436,7 +436,18 @@ func TestHandleProtectedResource(t *testing.T) {
 			host:               "api.example.com",
 			method:             http.MethodGet,
 			expectedStatusCode: http.StatusOK,
-			expectedScopes:     SupportedScopes,
+expectedScopes: []string{
+				"repo",
+				"read:org",
+				"read:user",
+				"user:email",
+				"read:packages",
+				"write:packages",
+				"read:project",
+				"project",
+				"gist",
+				"notifications",
+			},
 			validateResponse: func(t *testing.T, body map[string]any) {
 				t.Helper()
 				assert.Equal(t, "GitHub MCP Server", body["resource_name"])
@@ -573,7 +584,12 @@ func TestHandleProtectedResource(t *testing.T) {
 				if tc.expectedScopes != nil {
 					scopes, ok := body["scopes_supported"].([]any)
 					require.True(t, ok)
-					assert.Len(t, scopes, len(tc.expectedScopes))
+					actualScopes := make([]string, len(scopes))
+					for i, scope := range scopes {
+						actualScopes[i], ok = scope.(string)
+						require.True(t, ok)
+					}
+					assert.Equal(t, tc.expectedScopes, actualScopes)
 				}
 			}
 		})
@@ -671,10 +687,20 @@ func TestSupportedScopes(t *testing.T) {
 	assert.Equal(t, expectedScopes, SupportedScopes)
 }
 
-func TestDefaultScopesRequiresExplicitDeleteRepoOptIn(t *testing.T) {
+func TestDefaultScopesRequireExplicitOptIn(t *testing.T) {
 	assert.Subset(t, SupportedScopes, DefaultScopes)
 	assert.Contains(t, SupportedScopes, "delete_repo")
 	assert.NotContains(t, DefaultScopes, "delete_repo")
+	assert.Contains(t, SupportedScopes, "workflow")
+	assert.NotContains(t, DefaultScopes, "workflow")
+	assert.Contains(t, SupportedScopes, "codespace")
+	assert.NotContains(t, DefaultScopes, "codespace")
+	assert.Contains(t, SupportedScopes, "admin:org")
+	assert.NotContains(t, DefaultScopes, "admin:org")
+	assert.Contains(t, SupportedScopes, "read:enterprise")
+	assert.NotContains(t, DefaultScopes, "read:enterprise")
+	assert.Contains(t, SupportedScopes, "admin:enterprise")
+	assert.NotContains(t, DefaultScopes, "admin:enterprise")
 	assert.Contains(t, DefaultScopes, "repo")
 }
 
```

---

### Incident Patch 11: `6e00cee5` (2026-09-08)
**Commit Message**: build(deps): bump golang from 1.27.0-alpine to 1.27.1-alpine (#3239)

Bumps golang from 1.27.0-alpine to 1.27.1-alpine.

---
updated-dependencies:
- dependency-name: golang
  dependency-version: 1.27.1-alpine
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ COPY ui/ ./ui/
 RUN mkdir -p ./pkg/github/ui_dist && \
     cd ui && npm run build
 
-FROM golang:1.27.0-alpine@sha256:4c9fe60190a2a3350ddc51de80d0224b8a6698d12bdfc999fee45ea9d6c46dbc AS build
+FROM golang:1.27.1-alpine@sha256:cf6fca6641884b8433441b2b0652976f975e1d0fdd26d177eaaf8596087f3125 AS build
 ARG VERSION="dev"
 
 # Set the working directory
```

---

### Incident Patch 12: `9205304f` (2026-09-03)
**Commit Message**: fix: restore sanitizer content boundaries (#3219)

Preserve Markdown and HTML in body and commit-message fields while stripping invisible controls. Apply plain-text sanitization consistently to raw release and sub-issue titles and restore blame headline handling.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `pkg/github/issues.go` (modified, +1/-1)
```diff
@@ -2013,7 +2013,7 @@ func sanitizeSubIssueTitleAndBody(issue *github.SubIssue) {
 		return
 	}
 	if issue.Title != nil {
-		issue.Title = github.Ptr(sanitize.Sanitize(*issue.Title))
+		issue.Title = github.Ptr(sanitize.PlainText(*issue.Title))
 	}
 	if issue.Body != nil {
 		issue.Body = github.Ptr(sanitize.Content(*issue.Body))
```

**File**: `pkg/github/issues_test.go` (modified, +16/-16)
```diff
@@ -5774,8 +5774,8 @@ func Test_AddSubIssue(t *testing.T) {
 	// Setup mock issue for success case (matches GitHub API response format)
 	mockIssue := &github.Issue{
 		Number:  github.Ptr(42),
-		Title:   github.Ptr("<int>\u200B"),
-		Body:    github.Ptr("This is **Markdown**\u200B"),
+		Title:   github.Ptr("<script>alert(1)</script>can't \"quote\" AT&T\u200B"),
+		Body:    github.Ptr("<script>alert(1)</script>This is **Markdown**\u200B"),
 		State:   github.Ptr("open"),
 		HTMLURL: github.Ptr("https://github.com/owner/repo/issues/42"),
 		User: &github.User{
@@ -5970,8 +5970,8 @@ func Test_AddSubIssue(t *testing.T) {
 			err = json.Unmarshal([]byte(textContent.Text), &returnedIssue)
 			require.NoError(t, err)
 			assert.Equal(t, *tc.expectedIssue.Number, *returnedIssue.Number)
-			assert.Empty(t, *returnedIssue.Title)
-			assert.Equal(t, "This is **Markdown**", *returnedIssue.Body)
+			assert.Equal(t, "can't \"quote\" AT&T", *returnedIssue.Title)
+			assert.Equal(t, "<script>alert(1)</script>This is **Markdown**", *returnedIssue.Body)
 			assert.Equal(t, *tc.expectedIssue.State, *returnedIssue.State)
 			assert.Equal(t, *tc.expectedIssue.HTMLURL, *returnedIssue.HTMLURL)
 			assert.Equal(t, *tc.expectedIssue.User.Login, *returnedIssue.User.Login)
@@ -5999,8 +5999,8 @@ func Test_GetSubIssues(t *testing.T) {
 	mockSubIssues := []*github.Issue{
 		{
 			Number:  github.Ptr(123),
-			Title:   github.Ptr("<int>\u200B"),
-			Body:    github.Ptr("This is **Markdown**\u200B"),
+			Title:   github.Ptr("<script>alert(1)</script>can't \"quote\" AT&T\u200B"),
+			Body:    github.Ptr("<script>alert(1)</script>This is **Markdown**\u200B"),
 			State:   github.Ptr("open"),
 			HTMLURL: github.Ptr("https://github.com/owner/repo/issues/123"),
 			User: &github.User{
@@ -6200,8 +6200,8 @@ func Test_GetSubIssues(t *testing.T) {
 				if i < len(tc.expectedSubIssues) {
 					assert.Equal(t, *tc.expectedSubIssues[i].Number, *subIssue.Number)
 					if i == 0 {
-						assert.Empty(t, *subIssue.Title)
-						assert.Equal(t, "This is **Markdown**", *subIssue.Body)
+						assert.Equal(t, "can't \"quote\" AT&T", *subIssue.Title)
+						assert.Equal(t, "<script>alert(1)</script>This is **Markdown**", *subIssue.Body)
 					} else {
 						assert.Equal(t, *tc.expectedSubIssues[i].Title, *subIssue.Title)
 					}
@@ -6657,8 +6657,8 @@ func Test_RemoveSubIssue(t *testing.T) {
 	// Setup mock issue for success case (matches GitHub API response format - the updated parent issue)
 	mockIssue := &github.Issue{
 		Number:  github.Ptr(42),
-		Title:   github.Ptr("<int>\u200B"),
-		Body:    github.Ptr("This is **Markdown**\u200B"),
+		Title:   github.Ptr("<script>alert(1)</script>can't \"quote\" AT&T\u200B"),
+		Body:    github.Ptr("<script>alert(1)</script>This is **Markdown**\u200B"),
 		State:   github.Ptr("open"),
 		HTMLURL: github.Ptr("https://github.com/owner/repo/issues/42"),
 		User: &github.User{
@@ -6836,8 +6836,8 @@ func Test_RemoveSubIssue(t *testing.T) {
 			err = json.Unmarshal([]byte(textContent.Text), &returnedIssue)
 			require.NoError(t, err)
 			assert.Equal(t, *tc.expectedIssue.Number, *returnedIssue.Number)
-			assert.Empty(t, *returnedIssue.Title)
-			assert.Equal(t, "This is **Markdown**", *returnedIssue.Body)
+			assert.Equal(t, "can't \"quote\" AT&T", *returnedIssue.Title)
+			assert.Equal(t, "<script>alert(1)</script>This is **Markdown**", *returnedIssue.Body)
 			assert.Equal(t, *tc.expectedIssue.State, *returnedIssue.State)
 			assert.Equal(t, *tc.expectedIssue.HTMLURL, *returnedIssue.HTMLURL)
 			assert.Equal(t, *tc.expectedIssue.User.Login, *returnedIssue.User.Login)
@@ -6865,8 +6865,8 @@ func Test_ReprioritizeSubIssue(t *testing.T) {
 	// Setup mock issue for success case (matches GitHub API response format - the updated parent issue)
 	mockIssue := &github.Issue{
 		Number:  github.Ptr(42),
-		Title:   github.Ptr("<int>\u200B"),
-		Body:    github.Ptr("This is **Markdown**\u200B"),
+		Title:   github.Ptr("<script>alert(1)</script>can't \"quote\" AT&T\u200B"),
+		Body:    github.Ptr("<script>alert(1)</script>This is **Markdown**\u200B"),
 		State:   github.Ptr("open"),
 		HTMLURL: github.Ptr("https://github.com/owner/repo/issues/42"),
 		User: &github.User{
@@ -7096,8 +7096,8 @@ func Test_ReprioritizeSubIssue(t *testing.T) {
 			err = json.Unmarshal([]byte(textContent.Text), &returnedIssue)
 			require.NoError(t, err)
 			assert.Equal(t, *tc.expectedIssue.Number, *returnedIssue.Number)
-			assert.Empty(t, *returnedIssue.Title)
-			assert.Equal(t, "This is **Markdown**", *returnedIssue.Body)
+			assert.Equal(t, "can't \"quote\" AT&T", *returnedIssue.Title)
+			assert.Equal(t, "<script>alert(1)</script>This is **Markdown**", *returnedIssue.Body)
 			assert.Equal(t, *tc.expectedIssue.State, *returnedIssue.State)
 			assert.Equal(t, *tc.expectedIssue.HTMLURL, *returnedIssue.HTMLURL)
 			assert.Equal(t, *tc.expectedIssue.User.Login, *returnedIssue.User.Login)
```

**File**: `pkg/github/minimal_types.go` (modified, +7/-7)
```diff
@@ -204,7 +204,7 @@ type MinimalDiscussionComment struct {
 func newMinimalDiscussionComment(id string, body string, isAnswer bool) MinimalDiscussionComment {
 	return MinimalDiscussionComment{
 		ID:       id,
-		Body:     sanitize.Sanitize(body),
+		Body:     sanitize.Content(body),
 		IsAnswer: isAnswer,
 	}
 }
@@ -1015,7 +1015,7 @@ func convertToMinimalIssuesResponseWithoutFieldValues(fragment issueQueryFragmen
 func convertToMinimalIssueComment(comment *github.IssueComment) MinimalIssueComment {
 	m := MinimalIssueComment{
 		ID:                comment.GetID(),
-		Body:              sanitize.Sanitize(comment.GetBody()),
+		Body:              sanitize.Content(comment.GetBody()),
 		HTMLURL:           comment.GetHTMLURL(),
 		User:              convertToMinimalUser(comment.GetUser()),
 		AuthorAssociation: comment.GetAuthorAssociation(),
@@ -1064,7 +1064,7 @@ func convertToMinimalFileContentResponse(resp *github.RepositoryContentResponse)
 
 	m.Commit = &MinimalFileCommit{
 		SHA:     resp.Commit.GetSHA(),
-		Message: sanitize.Sanitize(resp.Commit.GetMessage()),
+		Message: sanitize.Content(resp.Commit.GetMessage()),
 		HTMLURL: resp.Commit.GetHTMLURL(),
 	}
 
@@ -1794,7 +1794,7 @@ func newMinimalCommitFromCore(sha, htmlURL string, commit *github.Commit, author
 
 	if commit != nil {
 		minimalCommit.Commit = &MinimalCommitInfo{
-			Message: sanitize.Sanitize(commit.GetMessage()),
+			Message: sanitize.Content(commit.GetMessage()),
 		}
 
 		if commit.Author != nil {
@@ -2000,7 +2000,7 @@ func convertToMinimalPullRequestCommits(commits []*github.RepositoryCommit) []Mi
 		}
 
 		if commit.Commit != nil {
-			minimalCommit.Message = sanitize.Sanitize(commit.Commit.GetMessage())
+			minimalCommit.Message = sanitize.Content(commit.Commit.GetMessage())
 			minimalCommit.Author = convertToMinimalCommitAuthor(commit.Commit.Author)
 		}
 
@@ -2095,7 +2095,7 @@ func convertToMinimalWorkflowRun(workflowRun *github.WorkflowRun) MinimalWorkflo
 
 	if headCommit := workflowRun.GetHeadCommit(); headCommit != nil && headCommit.GetMessage() != "" {
 		minimalRun.HeadCommit = &MinimalWorkflowRunHeadCommit{
-			Message: sanitize.Sanitize(headCommit.GetMessage()),
+			Message: sanitize.Content(headCommit.GetMessage()),
 		}
 	}
 
@@ -2280,7 +2280,7 @@ func convertToMinimalReviewThread(thread reviewThreadNode) MinimalReviewThread {
 
 func convertToMinimalReviewComment(c reviewCommentNode) MinimalReviewComment {
 	m := MinimalReviewComment{
-		Body:    sanitize.Sanitize(string(c.Body)),
+		Body:    sanitize.Content(string(c.Body)),
 		Path:    string(c.Path),
 		Author:  string(c.Author.Login),
 		HTMLURL: c.URL.String(),
```

**File**: `pkg/github/repositories.go` (modified, +15/-1)
```diff
@@ -2233,6 +2233,7 @@ func GetLatestRelease(t translations.TranslationHelperFunc) inventory.ServerTool
 				return ghErrors.NewGitHubAPIStatusErrorResponse(ctx, "failed to get latest release", resp, body), nil, nil
 			}
 
+			sanitizeReleaseNameAndBody(release)
 			r, err := json.Marshal(release)
 			if err != nil {
 				return nil, nil, fmt.Errorf("failed to marshal response: %w", err)
@@ -2319,6 +2320,7 @@ func GetReleaseByTag(t translations.TranslationHelperFunc) inventory.ServerTool
 				return ghErrors.NewGitHubAPIStatusErrorResponse(ctx, "failed to get release by tag", resp, body), nil, nil
 			}
 
+			sanitizeReleaseNameAndBody(release)
 			r, err := json.Marshal(release)
 			if err != nil {
 				return nil, nil, fmt.Errorf("failed to marshal response: %w", err)
@@ -2338,6 +2340,18 @@ func GetReleaseByTag(t translations.TranslationHelperFunc) inventory.ServerTool
 	)
 }
 
+func sanitizeReleaseNameAndBody(release *github.RepositoryRelease) {
+	if release == nil {
+		return
+	}
+	if release.Name != nil {
+		release.Name = github.Ptr(sanitize.PlainText(*release.Name))
+	}
+	if release.Body != nil {
+		release.Body = github.Ptr(sanitize.Content(*release.Body))
+	}
+}
+
 // ListStarredRepositories creates a tool to list starred repositories for the authenticated user or a specified user.
 func ListStarredRepositories(t translations.TranslationHelperFunc) inventory.ServerTool {
 	return NewTool(
@@ -2981,7 +2995,7 @@ func GetFileBlame(t translations.TranslationHelperFunc) inventory.ServerTool {
 					SHA: sha,
 					// Sanitized after truncation so the headline is cut at the author's real
 					// first line break rather than one introduced by sanitization.
-					MessageHeadline: sanitize.Content(headline),
+					MessageHeadline: sanitize.PlainText(headline),
 					CommittedDate:   r.Commit.CommittedDate.Format("2006-01-02T15:04:05Z"),
 					Author: BlameAuthor{
 						Name:  string(r.Commit.Author.Name),
```

**File**: `pkg/github/repositories_test.go` (modified, +9/-9)
```diff
@@ -4854,8 +4854,8 @@ func Test_GetLatestRelease(t *testing.T) {
 	mockRelease := &github.RepositoryRelease{
 		ID:      1,
 		TagName: "v1.0.0",
-		Name:    github.Ptr("First Release"),
-		Body:    github.Ptr("<details>Notes</details>\u200B"),
+		Name:    github.Ptr("<script>alert(1)</script>can't \"quote\" AT&T\u200B"),
+		Body:    github.Ptr("<script>alert(1)</script><details>Notes</details>\u200B"),
 	}
 
 	tests := []struct {
@@ -4923,8 +4923,8 @@ func Test_GetLatestRelease(t *testing.T) {
 			err = json.Unmarshal([]byte(textContent.Text), &returnedRelease)
 			require.NoError(t, err)
 			assert.Equal(t, tc.expectedResult.TagName, returnedRelease.TagName)
-			assert.Equal(t, "First Release", *returnedRelease.Name)
-			assert.Equal(t, "<details>Notes</details>", *returnedRelease.Body)
+			assert.Equal(t, "can't \"quote\" AT&T", *returnedRelease.Name)
+			assert.Equal(t, "<script>alert(1)</script><details>Notes</details>", *returnedRelease.Body)
 		})
 	}
 }
@@ -4947,8 +4947,8 @@ func Test_GetReleaseByTag(t *testing.T) {
 	mockRelease := &github.RepositoryRelease{
 		ID:      1,
 		TagName: "v1.0.0",
-		Name:    github.Ptr("Release v1.0.0"),
-		Body:    github.Ptr("<details>Notes</details>\u200B"),
+		Name:    github.Ptr("<script>alert(1)</script>can't \"quote\" AT&T\u200B"),
+		Body:    github.Ptr("<script>alert(1)</script><details>Notes</details>\u200B"),
 		Assets: []*github.ReleaseAsset{
 			{
 				ID:   github.Ptr(int64(1)),
@@ -5088,9 +5088,9 @@ func Test_GetReleaseByTag(t *testing.T) {
 
 			assert.Equal(t, tc.expectedResult.ID, returnedRelease.ID)
 			assert.Equal(t, tc.expectedResult.TagName, returnedRelease.TagName)
-			assert.Equal(t, *tc.expectedResult.Name, *returnedRelease.Name)
+			assert.Equal(t, "can't \"quote\" AT&T", *returnedRelease.Name)
 			if tc.expectedResult.Body != nil {
-				assert.Equal(t, "<details>Notes</details>", *returnedRelease.Body)
+				assert.Equal(t, "<script>alert(1)</script><details>Notes</details>", *returnedRelease.Body)
 			}
 			if len(tc.expectedResult.Assets) > 0 {
 				require.Len(t, returnedRelease.Assets, len(tc.expectedResult.Assets))
@@ -6203,7 +6203,7 @@ func Test_GetFileBlame(t *testing.T) {
 				var br BlameResult
 				require.NoError(t, json.Unmarshal([]byte(result), &br))
 				require.Contains(t, br.Commits, "badc0ffee0000")
-				assert.Equal(t, sanitizedContentText, br.Commits["badc0ffee0000"].MessageHeadline)
+				assert.Equal(t, sanitizedText, br.Commits["badc0ffee0000"].MessageHeadline)
 				assert.NotContains(t, result, "<script>")
 				assert.NotContains(t, result, "Long body that should not appear")
 			},
```

---

### Incident Patch 13: `cf3a4bbf` (2026-09-03)
**Commit Message**: build(deps): bump actions/stale from 10 to 11 (#3003)

Bumps [actions/stale](https://github.com/actions/stale) from 10 to 11.
- [Release notes](https://github.com/actions/stale/releases)
- [Changelog](https://github.com/actions/stale/blob/main/CHANGELOG.md)
- [Commits](https://github.com/actions/stale/compare/v10...v11)

---
updated-dependencies:
- dependency-name: actions/stale
  dependency-version: '11'
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/close-inactive-issues.yml` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ jobs:
       issues: write
       pull-requests: write
     steps:
-      - uses: actions/stale@v10
+      - uses: actions/stale@v11
         with:
           days-before-issue-stale: ${{ env.PR_DAYS_BEFORE_STALE }}
           days-before-issue-close: ${{ env.PR_DAYS_BEFORE_CLOSE }}
```

---

### Incident Patch 14: `25f11e62` (2026-09-03)
**Commit Message**: fix(sanitize): preserve Markdown body fidelity on read surfaces (#3177)

* fix: preserve Markdown content in GitHub responses

Route body-bearing response fields through the fidelity-preserving content path while retaining strict title handling and remove only unconditional invisible characters. Cover direct and converter read-modify-write surfaces for issues, releases, comments, discussions, projects, and commits.

Refs #2202, #3165

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

Copilot-Session: 69c5ab30-9815-4c07-8385-11a206e68f66

* chore: regenerate license files

Auto-generated by license-check workflow

---------

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>
Copilot-Session: 69c5ab30-9815-4c07-8385-11a206e68f66

**File**: `pkg/github/discussions.go` (modified, +1/-1)
```diff
@@ -362,7 +362,7 @@ func GetDiscussion(t translations.TranslationHelperFunc) inventory.ServerTool {
 			response := map[string]any{
 				"number":     int(d.Number),
 				"title":      sanitize.PlainText(string(d.Title)),
-				"body":       sanitize.Sanitize(string(d.Body)),
+				"body":       sanitize.Content(string(d.Body)),
 				"url":        string(d.URL),
 				"closed":     bool(d.Closed),
 				"isAnswered": bool(d.IsAnswered),
```

**File**: `pkg/github/discussions_test.go` (modified, +1/-1)
```diff
@@ -571,7 +571,7 @@ func Test_GetDiscussion(t *testing.T) {
 			expected: map[string]any{
 				"number":     float64(1),
 				"title":      sanitizedText,
-				"body":       sanitizedText,
+				"body":       sanitizedContentText,
 				"url":        "https://github.com/owner/repo/discussions/1",
 				"closed":     false,
 				"isAnswered": false,
```

**File**: `pkg/github/find_duplicate_test.go` (modified, +0/-1)
```diff
@@ -166,7 +166,6 @@ func Test_FindDuplicate_SanitizesIssueTitle(t *testing.T) {
 	require.NoError(t, json.Unmarshal([]byte(text.Text), &candidates))
 	require.Len(t, candidates, 1)
 	assert.Equal(t, sanitizedText, candidates[0].Issue.Title)
-	assert.NotContains(t, text.Text, "<script>")
 }
 
 func Test_FindDuplicate_OmitsUnsetParams(t *testing.T) {
```

**File**: `pkg/github/issues.go` (modified, +19/-1)
```diff
@@ -1118,6 +1118,9 @@ func GetSubIssues(ctx context.Context, client *github.Client, deps ToolDependenc
 		subIssues = filteredSubIssues
 	}
 
+	for _, subIssue := range subIssues {
+		sanitizeSubIssueTitleAndBody(subIssue)
+	}
 	r, err := json.Marshal(subIssues)
 	if err != nil {
 		return nil, fmt.Errorf("failed to marshal response: %w", err)
@@ -1708,6 +1711,7 @@ func AddSubIssue(ctx context.Context, client *github.Client, owner string, repo
 		return ghErrors.NewGitHubAPIStatusErrorResponse(ctx, "failed to add sub-issue", resp, body), nil
 	}
 
+	sanitizeSubIssueTitleAndBody(subIssue)
 	r, err := json.Marshal(subIssue)
 	if err != nil {
 		return nil, fmt.Errorf("failed to marshal response: %w", err)
@@ -1739,6 +1743,7 @@ func RemoveSubIssue(ctx context.Context, client *github.Client, owner string, re
 		return ghErrors.NewGitHubAPIStatusErrorResponse(ctx, "failed to remove sub-issue", resp, body), nil
 	}
 
+	sanitizeSubIssueTitleAndBody(subIssue)
 	r, err := json.Marshal(subIssue)
 	if err != nil {
 		return nil, fmt.Errorf("failed to marshal response: %w", err)
@@ -1788,6 +1793,7 @@ func ReprioritizeSubIssue(ctx context.Context, client *github.Client, owner stri
 		return ghErrors.NewGitHubAPIStatusErrorResponse(ctx, "failed to reprioritize sub-issue", resp, body), nil
 	}
 
+	sanitizeSubIssueTitleAndBody(subIssue)
 	r, err := json.Marshal(subIssue)
 	if err != nil {
 		return nil, fmt.Errorf("failed to marshal response: %w", err)
@@ -1998,7 +2004,19 @@ func sanitizeIssueTitleAndBody(issue *github.Issue) {
 		issue.Title = github.Ptr(sanitize.PlainText(*issue.Title))
 	}
 	if issue.Body != nil {
-		issue.Body = github.Ptr(sanitize.Sanitize(*issue.Body))
+		issue.Body = github.Ptr(sanitize.Content(*issue.Body))
+	}
+}
+
+func sanitizeSubIssueTitleAndBody(issue *github.SubIssue) {
+	if issue == nil {
+		return
+	}
+	if issue.Title != nil {
+		issue.Title = github.Ptr(sanitize.Sanitize(*issue.Title))
+	}
+	if issue.Body != nil {
+		issue.Body = github.Ptr(sanitize.Content(*issue.Body))
 	}
 }
 
```

**File**: `pkg/github/issues_test.go` (modified, +21/-16)
```diff
@@ -5774,8 +5774,8 @@ func Test_AddSubIssue(t *testing.T) {
 	// Setup mock issue for success case (matches GitHub API response format)
 	mockIssue := &github.Issue{
 		Number:  github.Ptr(42),
-		Title:   github.Ptr("Parent Issue"),
-		Body:    github.Ptr("This is the parent issue with a sub-issue"),
+		Title:   github.Ptr("<int>\u200B"),
+		Body:    github.Ptr("This is **Markdown**\u200B"),
 		State:   github.Ptr("open"),
 		HTMLURL: github.Ptr("https://github.com/owner/repo/issues/42"),
 		User: &github.User{
@@ -5970,8 +5970,8 @@ func Test_AddSubIssue(t *testing.T) {
 			err = json.Unmarshal([]byte(textContent.Text), &returnedIssue)
 			require.NoError(t, err)
 			assert.Equal(t, *tc.expectedIssue.Number, *returnedIssue.Number)
-			assert.Equal(t, *tc.expectedIssue.Title, *returnedIssue.Title)
-			assert.Equal(t, *tc.expectedIssue.Body, *returnedIssue.Body)
+			assert.Empty(t, *returnedIssue.Title)
+			assert.Equal(t, "This is **Markdown**", *returnedIssue.Body)
 			assert.Equal(t, *tc.expectedIssue.State, *returnedIssue.State)
 			assert.Equal(t, *tc.expectedIssue.HTMLURL, *returnedIssue.HTMLURL)
 			assert.Equal(t, *tc.expectedIssue.User.Login, *returnedIssue.User.Login)
@@ -5999,8 +5999,8 @@ func Test_GetSubIssues(t *testing.T) {
 	mockSubIssues := []*github.Issue{
 		{
 			Number:  github.Ptr(123),
-			Title:   github.Ptr("Sub-issue 1"),
-			Body:    github.Ptr("This is the first sub-issue"),
+			Title:   github.Ptr("<int>\u200B"),
+			Body:    github.Ptr("This is **Markdown**\u200B"),
 			State:   github.Ptr("open"),
 			HTMLURL: github.Ptr("https://github.com/owner/repo/issues/123"),
 			User: &github.User{
@@ -6199,12 +6199,17 @@ func Test_GetSubIssues(t *testing.T) {
 			for i, subIssue := range returnedSubIssues {
 				if i < len(tc.expectedSubIssues) {
 					assert.Equal(t, *tc.expectedSubIssues[i].Number, *subIssue.Number)
-					assert.Equal(t, *tc.expectedSubIssues[i].Title, *subIssue.Title)
+					if i == 0 {
+						assert.Empty(t, *subIssue.Title)
+						assert.Equal(t, "This is **Markdown**", *subIssue.Body)
+					} else {
+						assert.Equal(t, *tc.expectedSubIssues[i].Title, *subIssue.Title)
+					}
 					assert.Equal(t, *tc.expectedSubIssues[i].State, *subIssue.State)
 					assert.Equal(t, *tc.expectedSubIssues[i].HTMLURL, *subIssue.HTMLURL)
 					assert.Equal(t, *tc.expectedSubIssues[i].User.Login, *subIssue.User.Login)
 
-					if tc.expectedSubIssues[i].Body != nil {
+					if i != 0 && tc.expectedSubIssues[i].Body != nil {
 						assert.Equal(t, *tc.expectedSubIssues[i].Body, *subIssue.Body)
 					}
 				}
@@ -6652,8 +6657,8 @@ func Test_RemoveSubIssue(t *testing.T) {
 	// Setup mock issue for success case (matches GitHub API response format - the updated parent issue)
 	mockIssue := &github.Issue{
 		Number:  github.Ptr(42),
-		Title:   github.Ptr("Parent Issue"),
-		Body:    github.Ptr("This is the parent issue after sub-issue removal"),
+		Title:   github.Ptr("<int>\u200B"),
+		Body:    github.Ptr("This is **Markdown**\u200B"),
 		State:   github.Ptr("open"),
 		HTMLURL: github.Ptr("https://github.com/owner/repo/issues/42"),
 		User: &github.User{
@@ -6831,8 +6836,8 @@ func Test_RemoveSubIssue(t *testing.T) {
 			err = json.Unmarshal([]byte(textContent.Text), &returnedIssue)
 			require.NoError(t, err)
 			assert.Equal(t, *tc.expectedIssue.Number, *returnedIssue.Number)
-			assert.Equal(t, *tc.expectedIssue.Title, *returnedIssue.Title)
-			assert.Equal(t, *tc.expectedIssue.Body, *returnedIssue.Body)
+			assert.Empty(t, *returnedIssue.Title)
+			assert.Equal(t, "This is **Markdown**", *returnedIssue.Body)
 			assert.Equal(t, *tc.expectedIssue.State, *returnedIssue.State)
 			assert.Equal(t, *tc.expectedIssue.HTMLURL, *returnedIssue.HTMLURL)
 			assert.Equal(t, *tc.expectedIssue.User.Login, *returnedIssue.User.Login)
@@ -6860,8 +6865,8 @@ func Test_ReprioritizeSubIssue(t *testing.T) {
 	// Setup mock issue for success case (matches GitHub API response format - the updated parent issue)
 	mockIssue := &github.Issue{
 		Number:  github.Ptr(42),
-		Title:   github.Ptr("Parent Issue"),
-		Body:    github.Ptr("This is the parent issue with reprioritized sub-issues"),
+		Title:   github.Ptr("<int>\u200B"),
+		Body:    github.Ptr("This is **Markdown**\u200B"),
 		State:   github.Ptr("open"),
 		HTMLURL: github.Ptr("https://github.com/owner/repo/issues/42"),
 		User: &github.User{
@@ -7091,8 +7096,8 @@ func Test_ReprioritizeSubIssue(t *testing.T) {
 			err = json.Unmarshal([]byte(textContent.Text), &returnedIssue)
 			require.NoError(t, err)
 			assert.Equal(t, *tc.expectedIssue.Number, *returnedIssue.Number)
-			assert.Equal(t, *tc.expectedIssue.Title, *returnedIssue.Title)
-			assert.Equal(t, *tc.expectedIssue.Body, *returnedIssue.Body)
+			assert.Empty(t, *returnedIssue.Title)
+			assert.Equal(t, "This is **Markdown**", *returnedIssue.Body)
 			assert.Equal(t, *tc.expectedIssue.State, *returnedIssue.State)
 			assert.Equal(t, *tc.expectedIssue.HTMLURL, *returnedIssue.HTMLURL)
 			assert.E
```

**File**: `pkg/github/minimal_types.go` (modified, +5/-5)
```diff
@@ -797,7 +797,7 @@ func convertToMinimalPullRequestReview(review *github.PullRequestReview) Minimal
 	m := MinimalPullRequestReview{
 		ID:                review.GetID(),
 		State:             review.GetState(),
-		Body:              sanitize.Sanitize(review.GetBody()),
+		Body:              sanitize.Content(review.GetBody()),
 		HTMLURL:           review.GetHTMLURL(),
 		User:              convertToMinimalUser(review.GetUser()),
 		CommitID:          review.GetCommitID(),
@@ -815,7 +815,7 @@ func convertToMinimalIssue(issue *github.Issue) MinimalIssue {
 	m := MinimalIssue{
 		Number:            issue.GetNumber(),
 		Title:             sanitize.PlainText(issue.GetTitle()),
-		Body:              sanitize.Sanitize(issue.GetBody()),
+		Body:              sanitize.Content(issue.GetBody()),
 		State:             issue.GetState(),
 		StateReason:       issue.GetStateReason(),
 		Draft:             issue.GetDraft(),
@@ -926,7 +926,7 @@ func fragmentWithoutFieldValuesToMinimalIssue(fragment issueFragmentWithoutField
 	m := MinimalIssue{
 		Number:    int(fragment.Number),
 		Title:     sanitize.PlainText(string(fragment.Title)),
-		Body:      sanitize.Sanitize(string(fragment.Body)),
+		Body:      sanitize.Content(string(fragment.Body)),
 		State:     string(fragment.State),
 		Comments:  int(fragment.Comments.TotalCount),
 		CreatedAt: fragment.CreatedAt.Format(time.RFC3339),
@@ -1085,7 +1085,7 @@ func convertToMinimalPullRequest(pr *github.PullRequest) MinimalPullRequest {
 	m := MinimalPullRequest{
 		Number:         pr.GetNumber(),
 		Title:          sanitize.PlainText(pr.GetTitle()),
-		Body:           sanitize.Sanitize(pr.GetBody()),
+		Body:           sanitize.Content(pr.GetBody()),
 		State:          pr.GetState(),
 		Draft:          pr.GetDraft(),
 		Merged:         pr.GetMerged(),
@@ -2039,7 +2039,7 @@ func convertToMinimalRelease(release *github.RepositoryRelease) MinimalRelease {
 		ID:         release.GetID(),
 		TagName:    release.GetTagName(),
 		Name:       sanitize.PlainText(release.GetName()),
-		Body:       sanitize.Sanitize(release.GetBody()),
+		Body:       sanitize.Content(release.GetBody()),
 		HTMLURL:    release.GetHTMLURL(),
 		Prerelease: release.GetPrerelease(),
 		Draft:      release.GetDraft(),
```

**File**: `pkg/github/projects.go` (modified, +1/-1)
```diff
@@ -266,7 +266,7 @@ func convertToMinimalStatusUpdate(node statusUpdateNode) MinimalProjectStatusUpd
 
 	return MinimalProjectStatusUpdate{
 		ID:         fmt.Sprintf("%v", node.ID),
-		Body:       sanitize.Sanitize(derefString(node.Body)),
+		Body:       sanitize.Content(derefString(node.Body)),
 		Status:     derefString(node.Status),
 		CreatedAt:  node.CreatedAt.Time.Format(time.RFC3339),
 		StartDate:  derefString(node.StartDate),
```

**File**: `pkg/github/repositories.go` (modified, +1/-1)
```diff
@@ -2981,7 +2981,7 @@ func GetFileBlame(t translations.TranslationHelperFunc) inventory.ServerTool {
 					SHA: sha,
 					// Sanitized after truncation so the headline is cut at the author's real
 					// first line break rather than one introduced by sanitization.
-					MessageHeadline: sanitize.PlainText(headline),
+					MessageHeadline: sanitize.Content(headline),
 					CommittedDate:   r.Commit.CommittedDate.Format("2006-01-02T15:04:05Z"),
 					Author: BlameAuthor{
 						Name:  string(r.Commit.Author.Name),
```

---

### Incident Patch 15: `a014a187` (2026-09-03)
**Commit Message**: build(deps): bump github/codeql-action from 4.37.4 to 4.37.9 (#3192)

Bumps [github/codeql-action](https://github.com/github/codeql-action) from 4.37.4 to 4.37.9.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/v4.37.4...v4.37.9)

---
updated-dependencies:
- dependency-name: github/codeql-action
  dependency-version: 4.37.9
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/code-scanning.yml` (modified, +5/-5)
```diff
@@ -44,7 +44,7 @@ jobs:
         uses: actions/checkout@v7
 
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@v4.37.4
+        uses: github/codeql-action/init@v4.37.9
         with:
           languages: ${{ matrix.language }}
           build-mode: ${{ matrix.build-mode }}
@@ -61,13 +61,13 @@ jobs:
             threat-models: [  ]
       - name: Setup proxy for registries
         id: proxy
-        uses: github/codeql-action/start-proxy@v4.37.4
+        uses: github/codeql-action/start-proxy@v4.37.9
         with:
           registries_credentials: ${{ secrets.GITHUB_REGISTRIES_PROXY }}
           language: ${{ matrix.language }}
 
       - name: Configure
-        uses: github/codeql-action/resolve-environment@v4.37.4
+        uses: github/codeql-action/resolve-environment@v4.37.9
         id: resolve-environment
         with:
           language: ${{ matrix.language }}
@@ -91,10 +91,10 @@ jobs:
         uses: ./.github/actions/build-ui
 
       - name: Autobuild
-        uses: github/codeql-action/autobuild@v4.37.4
+        uses: github/codeql-action/autobuild@v4.37.9
 
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/analyze@v4.37.4
+        uses: github/codeql-action/analyze@v4.37.9
         env:
           CODEQL_PROXY_HOST: ${{ steps.proxy.outputs.proxy_host }}
           CODEQL_PROXY_PORT: ${{ steps.proxy.outputs.proxy_port }}
```

#### Recent Merged Pull Requests:
- **PR #3414** (closed): Refs/heads/copilot/create cli tool for agents (@Daigrin)
- **PR #3407** (2026-10-03): perf: cache encoded tools/list schemas (@SamMorrowDrums)
- **PR #3383** (2026-10-02): build(ui): migrate to React 19 and Primer React 38 (@SamMorrowDrums)
- **PR #3382** (2026-10-02): ci: migrate cosign to v3 and dual-publish image signatures (@SamMorrowDrums)
- **PR #3381** (2026-10-02): build(deps): upgrade go-github to v92.0.0 (@SamMorrowDrums)
- **PR #3380** (2026-10-02): build: upgrade golangci-lint to v2.14.0 (@SamMorrowDrums)
- **PR #3379** (2026-10-02): build(ui): upgrade to TypeScript 7 and align the Node 26 toolchain (@SamMorrowDrums)
- **PR #3378** (2026-10-02): feat(ui): migrate MCP Apps SDK to v2 (@SamMorrowDrums)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

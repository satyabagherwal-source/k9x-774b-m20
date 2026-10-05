# Forensic Learning Record (Deep Inspection): asciimoo/hister

> **Canonical Artifact**: `07_PROJECT_LEARNING/asciimoo-hister-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/asciimoo/hister](https://github.com/asciimoo/hister))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:44:12.379Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `asciimoo/hister`
- **Description**: Your own search engine
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 5810 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `client/client.go`
```
package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// targetUserIDHeader is sent by admin CLI callers to request a specific user_id
// for indexed documents. The server only honours it for admin users in
// multiuser mode.
const targetUserIDHeader = "X-Hister-Target-User-ID"

type Client struct {
	baseURL        string
	httpClient     *http.Client
	userAgent      string
	accessToken    string
	targetUserID   *uint
	allowSensitive bool
	ignoreRules    bool
	batchLimitOnce sync.Once
	batchBodyBytes int64
}

type HTTPError struct {
	StatusCode int
	Detail     string
	Message    string
}

func (e *HTTPError) Error() string {
	return e.Message
}

// HTTPStatusCode returns the response status associated with the error.
func (e *HTTPError) HTTPStatusCode() int {
	return e.StatusCode
}

type Option func(*Client)

func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) { c.httpClient = hc }
}

func WithTimeout(d time.Duration) Option {
	return func(c *Client) { c.httpClient.Timeout = d }
}

func WithUserAgent(ua string) Option {
	return func(c *Client) { c.userAgent = ua }
}

func WithAccessToken(token string) Option {
	return func(c *Client) { c.accessToken = token }
}

func WithAllowSensitive() Option {
	return func(c *Client) { c.allowSensitive = true }
}

// WithIgnoreRules marks submitted documents as explicitly saved, bypassing URL
// indexing rules on submission and on subsequent index rebuilds.
func WithIgnoreRules() Option {
	return func(c *Client) { c.ignoreRules = true }
}

// WithMaxBatchBodyBytes overrides batch capability discovery. It is primarily
// useful for clients that already obtained the server limit out of band.
func WithMaxBatchBodyBytes(limit int64) Option {
	return func(c *Client) {
		if limit > 0 {
			c.batchBodyBytes = limit
		}
	}
}

// WithTargetUserID instructs the server to index submitted documents under the
// given user ID instead of the authenticated caller's ID. The server only
// honours this for admin users in multiuser mode.
func WithTargetUserID(uid uint) Option {
	return func(c *Client) { c.targetUserID = &uid }
}

func New(baseURL string, opts ...Option) *Client {
	c := &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

// FetchConfig retrieves capabilities from the server the client is connected
// to. This avoids assuming that local configuration describes a remote server.
func (c *Client) FetchConfig() (_ *ServerConfig, err error) {
	return c.FetchConfigContext(context.Background())
}

func (c *Client) FetchConfigContext(ctx context.Context) (_ *ServerConfig, err error) {
	req, err := c.newRequest(http.MethodGet, "/api/config", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req.WithContext(ctx))
	if err != nil {
		return nil, err
	}
	defer closeBody(resp, &err)
	if err = checkStatus(resp); err != nil {
		return nil, err
	}
	var serverConfig ServerConfig
	if err = json.NewDecoder(resp.Body).Decode(&serverConfig); err != nil {
		return nil, err
	}
	return &serverConfig, nil
}

const legacyMaxBatchBodyBytes int64 = 5 << 20

// MaxBatchBodyBytes returns the server advertised batch request limit. Servers
// that predate capability discovery use the former 5 MiB limit.
func (c *Client) MaxBatchBodyBytes() int64 {
	c.batchLimitOnce.Do(func() {
		if c.batchBodyBytes > 0 {
			return
		}
		c.batchBodyBytes = legacyMaxBatchBodyBytes
		req, err := c.newRequest(http.MethodGet, "/api/config", nil)
		if err != nil {
			return
		}
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return
		}
		defer func() { _ = resp.Body.Close() }()
		if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
			return
		}
		var capabilities struct {
			MaxBatchBodyBytes int64 `json:"maxBatchBodyBytes"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&capabilities); err == nil && capabilities.MaxBatchBodyBytes > 0 {
			c.batchBodyBytes = capabilities.MaxBatchBodyBytes
		}
	})
	return c.batchBodyBytes
}

func checkStatus(resp *http.Response) error {
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	body, _ := io.ReadAll(resp.Body)
	detail := strings.TrimSpace(string(body))
	errWithStatus := func(msg string) error {
		return &HTTPError{
			StatusCode: resp.StatusCode,
			Detail:     detail,
			Message:    msg,
		}
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		msg := "authentication required: the server requires an access token"
		if detail != "" {
			msg += " (" + detail + ")"
		}
		return errWithStatus(fmt.Sprintf("%s\nProvide one with --token / -t or set access_token in your config file", msg))
	case http.StatusForbidden:
		msg := "access denied: the token is invalid or does not have permission for this operation"
		if detail != "" {
			msg += " (" + detail + ")"
		}
		return errWithStatus(fmt.Sprintf("%s\nCheck the token with --token / -t or verify the user's permissions on the server", msg))
	case http.StatusNotFound:
		msg := "resource not found (404)"
		if detail != "" {
			msg += ": " + detail
		}
		return errWithStatus(msg)
	case http.StatusNotAcceptable:
		msg := "page skipped: this URL was rejected by the server (usually due to allow or skip rules)"
		if detail != "" {
			msg += " (" + detail + ")"
		}
		return errWithStatus(msg)
	case http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		msg := fmt.Sprintf("server error (%d)", resp.StatusCode)
		if detail != "" {
			msg += ": " + detail
		}
		return errWithStatus(fmt.Sprintf("%s\nCheck the server logs for details", msg))
	default:
		if detail == "" {
			detail = resp.Status
		}
		return errWithStatus(fmt.Sprintf("unexpected response (%d): %s", resp.StatusCode, detail))
	}
}

func closeBody(resp *http.Response, errp *error) {
	if cerr := resp.Body.Close(); cerr != nil && *errp == nil {
		*errp = fmt.Errorf("closing response body: %w", cerr)
	}
}

// builds an http.Request with Origin: hister:// set for CSRF bypass.
func (c *Client) newRequest(method, path string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequest(method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Origin", "hister://")
	if c.userAgent != "" {
		req.Header.Set("User-Agent", c.userAgent)
	}
	if c.accessToken != "" {
		req.Header.Set("X-Access-Token", c.accessToken)
	}
	if c.targetUserID != nil {
		req.Header.Set(targetUserIDHeader, strconv.FormatUint(uint64(*c.targetUserID), 10))
	}
	return req, nil
}

```

### Core Architecture Module: `client/diagnostics.go`
```
// SPDX-License-Identifier: AGPL-3.0-or-later

package client

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/asciimoo/hister/server/types"
)

func (c *Client) FetchDiagnostics(ctx context.Context) (_ []types.DiagnosticCheck, err error) {
	req, err := c.newRequest(http.MethodGet, "/api/diagnostics", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req.WithContext(ctx))
	if err != nil {
		return nil, err
	}
	defer closeBody(resp, &err)
	if err = checkStatus(resp); err != nil {
		return nil, err
	}
	var checks []types.DiagnosticCheck
	if err = json.NewDecoder(resp.Body).Decode(&checks); err != nil {
		return nil, err
	}
	return checks, nil
}

```

### Core Architecture Module: `client/document.go`
```
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/asciimoo/hister/server/document"
)

// AddDocumentResult describes the outcome of one document in a bulk request.
type AddDocumentResult struct {
	Status int    `json:"status"`
	Error  string `json:"error,omitempty"`
}

type addDocumentOperation struct {
	Op string `json:"op"`
	*document.Document
}

type encodedAddDocument struct {
	data []byte
}

const maxBatchOperations = 100

// AddDocumentsJSON submits documents in byte bounded bulk requests.
func (c *Client) AddDocumentsJSON(docs []*document.Document) (results []AddDocumentResult, err error) {
	if len(docs) == 0 {
		return []AddDocumentResult{}, nil
	}
	ops := make([]encodedAddDocument, len(docs))
	for i, doc := range docs {
		c.applyDocumentOptions(doc)
		data, err := json.Marshal(addDocumentOperation{Op: "add", Document: doc})
		if err != nil {
			return results, err
		}
		ops[i] = encodedAddDocument{data: data}
	}

	limit := c.MaxBatchBodyBytes()
	results = make([]AddDocumentResult, 0, len(docs))
	for start := 0; start < len(ops); {
		if size := encodedBatchSize(ops[start : start+1]); size > limit {
			results = append(results, oversizedDocumentResult(size, limit))
			start++
			continue
		}

		end := start + 1
		for end < len(ops) && end-start < maxBatchOperations {
			if encodedBatchSize(ops[start:end+1]) > limit {
				break
			}
			end++
		}
		batchResults, batchErr := c.submitAddDocumentBatch(ops[start:end])
		results = append(results, batchResults...)
		if batchErr != nil {
			return results, batchErr
		}
		start = end
	}
	return results, nil
}

func encodedBatchSize(ops []encodedAddDocument) int64 {
	size := int64(len(`{"ops":[]}`))
	for i, op := range ops {
		size += int64(len(op.data))
		if i > 0 {
			size++
		}
	}
	return size
}

func encodeBatch(ops []encodedAddDocument) []byte {
	var body bytes.Buffer
	body.Grow(int(encodedBatchSize(ops)))
	body.WriteString(`{"ops":[`)
	for i, op := range ops {
		if i > 0 {
			body.WriteByte(',')
		}
		body.Write(op.data)
	}
	body.WriteString(`]}`)
	return body.Bytes()
}

func oversizedDocumentResult(size, limit int64) AddDocumentResult {
	return AddDocumentResult{
		Status: http.StatusRequestEntityTooLarge,
		Error:  fmt.Sprintf("encoded document request is %d bytes and exceeds the %d byte server limit", size, limit),
	}
}

func (c *Client) submitAddDocumentBatch(ops []encodedAddDocument) ([]AddDocumentResult, error) {
	data := encodeBatch(ops)
	results, err := c.sendAddDocumentBatch(data, len(ops))
	if err == nil {
		return results, nil
	}
	var httpErr *HTTPError
	if !errors.As(err, &httpErr) || httpErr.StatusCode != http.StatusRequestEntityTooLarge {
		return nil, err
	}
	if len(ops) == 1 {
		message := fmt.Sprintf("server rejected encoded document request of %d bytes as too large", len(data))
		var response struct {
			Error      string `json:"error"`
			LimitBytes int64  `json:"limit_bytes"`
		}
		if json.Unmarshal([]byte(httpErr.Detail), &response) == nil {
			if response.Error != "" {
				message = response.Error
			}
			if response.LimitBytes > 0 {
				message = fmt.Sprintf("%s; encoded document request is %d bytes", message, len(data))
			}
		}
		return []AddDocumentResult{{Status: http.StatusRequestEntityTooLarge, Error: message}}, nil
	}

	middle := len(ops) / 2
	left, err := c.submitAddDocumentBatch(ops[:middle])
	if err != nil {
		return left, err
	}
	right, err := c.submitAddDocumentBatch(ops[middle:])
	return append(left, right...), err
}

func (c *Client) sendAddDocumentBatch(data []byte, documentCount int) (_ []AddDocumentResult, err error) {
	req, err := c.newRequest(http.MethodPost, "/api/batch", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer closeBody(resp, &err)
	if err = checkStatus(resp); err != nil {
		return nil, err
	}
	var result struct {
		Results []AddDocumentResult `json:"results"`
	}
	if err = json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if len(result.Results) != documentCount {
		return nil, fmt.Errorf("batch response contained %d results for %d documents", len(result.Results), documentCount)
	}
	return result.Results, nil
}

func (c *Client) AddDocumentJSON(doc *document.Document) (err error) {
	return c.AddDocumentJSONContext(context.Background(), doc)
}

// AddDocumentJSONContext submits a prepared document until ctx is cancelled.
func (c *Client) AddDocumentJSONContext(ctx context.Context, doc *document.Document) (err error) {
	c.applyDocumentOptions(doc)
	data, err := json.Marshal(doc)
	if err != nil {
		return err
	}
	req, err := c.newRequest("POST", "/api/add", bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req.WithContext(ctx))
	if err != nil {
		return err
	}
	defer closeBody(resp, &err)
	return checkStatus(resp)
}

func (c *Client) applyDocumentOptions(doc *document.Document) {
	if c.allowSensitive {
		doc.SkipSensitiveCheck = true
	}
	if c.ignoreRules {
		doc.SetIgnoreSkipRules(true)
	}
}

func (c *Client) AddPage(u, title, text string) (err error) {
	formData := url.Values{"url": {u}, "title": {title}, "text": {text}}
	req, err := c.newRequest("POST", "/api/add", strings.NewReader(formData.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer closeBody(resp, &err)
	return checkStatus(resp)
}

func (c *Client) DocumentExists(u string) (_ bool, err error) {
	return c.DocumentExistsContext(context.Background(), u)
}

func (c *Client) DocumentExistsContext(ctx context.Context, u string) (_ bool, err error) {
	req, err := c.newRequest("HEAD", "/api/document?url="+url.QueryEscape(u), nil)
	if err != nil {
		return false, err
	}
	resp, err := c.httpClient.Do(req.WithContext(ctx))
	if err != nil {
		return false, err
	}
	defer closeBody(resp, &err)
	if resp.StatusCode != http.StatusNotFound {
		if err := checkStatus(resp); err != nil {
			return false, err
		}
	}
	return resp.StatusCode == http.StatusOK, nil
}

func (c *Client) Reindex(skipSensitive, detectLanguages bool) (err error) {
	type reindexRequest struct {
		SkipSensitive   bool `json:"skipSensitive"`
		DetectLanguages bool `json:"detectLanguages"`
	}
	data, err := json.Marshal(reindexRequest{SkipSensitive: skipSensitive, DetectLanguages: detectLanguages})
	if err != nil {
		return err
	}
	req, err := c.newRequest("POST", "/api/reindex", bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer closeBody(resp, &err)
	return checkStatus(resp)
}

func (c *Client) DeleteDocument(u string) (err error) {
	return c.DeleteDocuments("url:" + u)
}

func (c *Client) DeleteDocuments(query string) (err error) {
	data, err := json.Marshal(map[string]string{"query": query})
	if err != nil {
		return err
	}
	req, err := c.newRequest("POST", "/api/delete", bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer closeBody(resp, &err)
	return checkStatus(resp)
}

// UpdateLabel sets or clears the user-defined label for a stored document.
func (c *Client) UpdateLabel(urlStr, label string) (err error) {
	data, err := json.Marshal(map[string]string{"url": urlStr, "label": label})
	if err != nil {
		return err
	}
	req, err := c.newRequest("POST", "/api/label", bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer closeBody(resp, &err)
	return checkStatus(resp)
}

// FetchPreview
```

### Core Architecture Module: `client/history.go`
```
package client

import (
	"encoding/json"
	"net/http"
	"strings"
)

func (c *Client) FetchHistory() (_ []HistoryItem, err error) {
	req, err := c.newRequest(http.MethodGet, "/api/history?opened=true", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer closeBody(resp, &err)
	if err := checkStatus(resp); err != nil {
		return nil, err
	}
	var response struct {
		Documents []HistoryItem `json:"documents"`
	}
	err = json.NewDecoder(resp.Body).Decode(&response)
	return response.Documents, err
}

func (c *Client) PostHistory(query, urlStr, title string) (err error) {
	body := historyRequest{URL: urlStr, Title: title, Query: query}
	data, _ := json.Marshal(body)
	req, err := c.newRequest("POST", "/api/history", strings.NewReader(string(data)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer closeBody(resp, &err)
	return checkStatus(resp)
}

func (c *Client) DeleteHistoryEntry(query, urlStr string) (err error) {
	body := historyRequest{URL: urlStr, Query: query, Delete: true}
	data, _ := json.Marshal(body)
	req, err := c.newRequest("POST", "/api/history", strings.NewReader(string(data)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer closeBody(resp, &err)
	return checkStatus(resp)
}

```

### Core Architecture Module: `client/rules.go`
```
package client

import (
	"encoding/json"
	"net/url"
	"strings"
)

func (c *Client) FetchRules() (_ *RulesResponse, err error) {
	req, err := c.newRequest("GET", "/api/rules", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer closeBody(resp, &err)
	if err := checkStatus(resp); err != nil {
		return nil, err
	}
	var data RulesResponse
	err = json.NewDecoder(resp.Body).Decode(&data)
	return &data, err
}

// SaveRules saves skip and priority patterns, followed by optional versioning
// and allow patterns. Omitting allow leaves the server's allow rules unchanged.
func (c *Client) SaveRules(skip, priority string, patterns ...string) (err error) {
	versioningRules := ""
	if len(patterns) > 0 {
		versioningRules = patterns[0]
	}
	formData := url.Values{"skip": {skip}, "priority": {priority}, "versioning": {versioningRules}}
	if len(patterns) > 1 {
		formData.Set("allow", patterns[1])
	}
	req, err := c.newRequest("POST", "/api/rules", strings.NewReader(formData.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer closeBody(resp, &err)
	return checkStatus(resp)
}

func (c *Client) AddAlias(keyword, value string) (err error) {
	formData := url.Values{"alias-keyword": {keyword}, "alias-value": {value}}
	req, err := c.newRequest("POST", "/api/add_alias", strings.NewReader(formData.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer closeBody(resp, &err)
	return checkStatus(resp)
}

func (c *Client) DeleteAlias(alias string) (err error) {
	formData := url.Values{"alias": {alias}}
	req, err := c.newRequest("POST", "/api/delete_alias", strings.NewReader(formData.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer closeBody(resp, &err)
	return checkStatus(resp)
}

```

### Core Architecture Module: `client/search.go`
```
// SPDX-License-Identifier: AGPL-3.0-or-later

package client

import (
	"encoding/json"
	"io"
	"net/url"

	"github.com/asciimoo/hister/server/indexer"
)

func (c *Client) Search(q *indexer.Query) (_ *indexer.Results, err error) {
	qJSON, err := json.Marshal(q)
	if err != nil {
		return nil, err
	}
	u := "/search?query=" + url.QueryEscape(string(qJSON))
	req, err := c.newRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer closeBody(resp, &err)
	if err := checkStatus(resp); err != nil {
		return nil, err
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var res *indexer.Results
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, err
	}
	return res, nil
}

```

### Core Architecture Module: `client/types.go`
```
package client

type HistoryItem struct {
	Query     string `json:"query"`
	Title     string `json:"title"`
	URL       string `json:"url"`
	UpdatedAt string `json:"updated_at"`
}

type historyRequest struct {
	URL    string `json:"url"`
	Title  string `json:"title,omitempty"`
	Query  string `json:"query"`
	Delete bool   `json:"delete,omitempty"`
}

type RulesResponse struct {
	Allow      []string          `json:"allow"`
	Skip       []string          `json:"skip"`
	Priority   []string          `json:"priority"`
	Versioning []string          `json:"versioning"`
	Aliases    map[string]string `json:"aliases"`
}

// PreviewResponse is the readable document representation returned by the
// preview API. Content is usually sanitized HTML, but extractor-specific
// templates may return structured JSON instead.
type PreviewResponse struct {
	Title        string         `json:"title"`
	Content      string         `json:"content"`
	Template     string         `json:"template"`
	Added        int64          `json:"added"`
	VersionCount int            `json:"version_count"`
	Meta         map[string]any `json:"meta"`
}

// ServerConfig contains the search capabilities advertised by /api/config
// that command-line clients need at runtime.
type ServerConfig struct {
	AuthMode             string  `json:"authMode"`
	Authenticated        bool    `json:"authenticated"`
	DiagnosticsAvailable bool    `json:"diagnosticsAvailable"`
	SemanticEnabled      bool    `json:"semanticEnabled"`
	SemanticWeight       float64 `json:"semanticWeight"`
	SimilarityThreshold  float64 `json:"similarityThreshold"`
}

```

### Core Architecture Module: `client/update.go`
```
// SPDX-License-Identifier: AGPL-3.0-or-later

package client

import (
	"bytes"
	"encoding/json"
	"net/http"

	servertypes "github.com/asciimoo/hister/server/types"
)

// UpdateDocuments changes attributes on documents selected by a search query.
func (c *Client) UpdateDocuments(request servertypes.UpdateDocumentsRequest) (_ *servertypes.UpdateDocumentsResult, err error) {
	data, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}
	req, err := c.newRequest(http.MethodPost, "/api/update", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer closeBody(resp, &err)
	if err := checkStatus(resp); err != nil {
		return nil, err
	}
	var result servertypes.UpdateDocumentsResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #790** (2026-09-26): **ChatGPT extractor fail: can't see turns**
  *Symptoms*: When trying to index ChatGPT conversations, the Hister server reports: `| ERROR  | server/endpoints.go:818 > failed to create index error="extractor ChatGPT: extractor aborted: no visible user or assistant turns found" URL=...`  Version: 0.20.0
  **Post-Mortem & Fix Analysis**:
  > Hopefully 25dccad fixes the issue. Could you verify it?
  > 25dccadb doesn't appear to cover the variant my session gets. It has no `data-message-author-role`, no `data-turn` and no `conversation-turn-*` test ids and fails with the new error:  ` | ERROR  | server/endpoints.go:818 > failed to create index error="extractor ChatGPT: extractor aborted: no visible user or assistant turns found; capture the loaded conversation with the browser extension or a browser crawler (chromedp or bidi); private conversations require a signed in browser" URL=...`  Here's my variant. It's a rendered conversation container from a short throw away chat [search-unit-markup.html](https://github.com/user-attachments/files/32681204/search-unit-markup.html)
  > Thanks. Could you test it again with bafe7d7 ?

- **Issue #784** (2026-09-23): **Embeddings dimension mismatch**
  *Symptoms*: When using semantic search with qwen3-embedding-8b and default auto-generated config settings in Hister 0.19.0, I kept getting the error:  `vector store write failed error="insert embedding: Dimension mismatch for inserted vector for the \"embedding\" column. Expected 2000 dimensions but received 4096."`  I thought this would be as simple to resolve as changing semantic_search.dimensions in config.yml from 2000 to 4096, but now I get:  `vector store write failed error="insert embedding: Dimension mismatch for inserted vector for the \"embedding\" column. Expected 768 dimensions but received 4096."`  I have no idea why it is now expecting 768 dimensions. This number appears nowhere in the config file.
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting. Hopefully 960bf020 fixes it.

- **Issue #771** (2026-09-21): **Lobste.rs extractor/view shows duplicate comments**
  *Symptoms*: The nested comments in lobste.rs thread appear as duplicate top-level comments for me.  For instance if the thread is structured like  ``` A | B C ```  it will show as  ``` A | B B C ```  hister version v0.19.0 (118a73a) 
  **Post-Mortem & Fix Analysis**:
  > awesome!

- **Issue #753** (2026-09-14): **Mastodon extractor URL rewriting is broken**
  *Symptoms*: Have a look at [this post](https://hachyderm.io/@peteorrall@bsd.cafe/117269611598821921) as an example. The URL is `https://hachyderm.io/@peteorrall@bsd.cafe/117269611598821921`. It gets rewritten to `https://bsd.cafe/@peteorrall/117269611598821921`, which gives back a 404.  The actual URL (which can be discovered using the "Open original page" in the UI) on the original instance is `https://mastodon.bsd.cafe/@peteorrall/117269611556537474`. The key issue is that the extractor assumes that post IDs are global but in fact they are local to each instance.

- **Issue #746** (2026-09-12): **Importing a file without an extension causes problems**
  *Symptoms*: Hello, I'm migrating Hister from Docker to an LXC environment for easier maintenance. I exported my data using the command: hister export file backup  But when I import it to the new platform, Hister returns an error 426 (I think). I renamed the file to .json, and Hister no longer returns an error during import. It would be a good idea to add a safety measure by suggesting that users include the .json extension in the command, or to require a .json extension when creating the file.

- **Issue #697** (2026-08-30): **"hister reindex" failed with Internal Server Error (500)**
  *Symptoms*: `hister reindex` returns `Error! Reindex error: server error (500): Internal Server Error` and the reindex operation does not complete when the markdown file has specific content.  hister reindex: ``` PS > .\hister_0.18.0_windows_amd64.exe reindex Error! Reindex error: server error (500): Internal Server Error Check the server logs for details ```  Logs: ```log 2026-08-30T17:27:47+09:00 | WARN   | extractor/extractor.go:238 > Failed to extract content error="the Node field is nil" Extractor=Readability URL=file:///P:/OneDrive/vscnotes/notes/test-h1-only.md 2026-08-30T17:27:47+09:00 | ERROR  | server/endpoints.go:1846 > reindex failed error="file URL is not allowed: submitted content is required" ```  The content of `test-h1-only.md` when reindex operation failed (only one line): ```md # test test test test test ```  Reindex operation succeeded with the following content (only one line): ```md # test test test test ```  <img width="2148" height="920" alt="Image" src="https://github.com/user-attachments/assets/e9941acb-80e2-4c96-b0a6-93e1c0495feb" /> 
  **Post-Mortem & Fix Analysis**:
  > This is a crazy bug. Unfortunately the root cause isn't as funny as the way you found to reproduce it. Local files accidentally go through a different processing chain when running `reindex` and that causes the bug.  Fix is coming soon, thank you for reporting it.

- **Issue #682** (2026-08-27): **Prevent pgvector from using more than 2000 dimensions**
  *Symptoms*: pgvector only supports 2000 dimensions according to their readme, so that error should probably be catched early on when postgres is used.  ``` | INFO   | vectorstore/postgres.go:37 > pgvector extension enabled | WARN   | indexer/indexer.go:337 > failed to init vector store, semantic search disabled error="create HNSW index: ERROR: column cannot have more than 2000 dimensions for hnsw index (SQLSTATE 54000)" | INFO   | server/server.go:193 > Starting webserver Address=127.0.0.1:8114 URL=https://hister.lan/ Version=v0.17.0 ```
  **Post-Mortem & Fix Analysis**:
  > To recover from that I needed to drop one table. Not a problem, I am just setting hister up.  ``` DROP TABLE embeddings; ```
  > ~Hmm, this might be one of the reasons for #684 since I was using `qwen/qwen3-embedding-4b` which outputs 2560 dimensions.~ Never mind, I completely missed that you wrote pgvector here. I'm using the default sqlite-vector.

- **Issue #650** (2026-08-28): **Chats from ChatGPT being not consistently imported**
  *Symptoms*: I noticed that the chats from ChatGPT are not consistently imported. And when they are, only one of the messages or only the sidebar that get imported.   Am I the only one experiencing this?
  **Post-Mortem & Fix Analysis**:
  > Unfortunately the generic `readability` extractor cannot always identify the main content on websites. The proper solution would be a ChatGPT extractor. See more about it [here](https://hister.org/docs/developer#extractor-development)
  > @asciimoo would it be ok if I worked on it and send a PR if I'm successful?
  > It would be great, thank you! Check out other extractors for inspiration.

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

### Incident Patch 1: `76105c93` (2026-09-30)
**Commit Message**: [fix] lint

**File**: `server/vectorstore/embedder_test.go` (modified, +2/-2)
```diff
@@ -619,7 +619,7 @@ func TestEmbedQueryDeadlineWhileWaitingForQuerySlot(t *testing.T) {
 	e.queryTimeout = 40 * time.Millisecond
 	e.querySem <- struct{}{}
 	defer func() { <-e.querySem }()
-	_, err := e.EmbedQuery(nil, "query")
+	_, err := e.EmbedQuery(context.Background(), "query")
 	if !errors.Is(err, context.DeadlineExceeded) {
 		t.Fatalf("error = %v, want deadline exceeded", err)
 	}
@@ -657,7 +657,7 @@ func TestEmbedQueryDeadlineCancelsRetry(t *testing.T) {
 		calls++
 		return &http.Response{StatusCode: 503, Body: http.NoBody, Header: make(http.Header), Request: r}, nil
 	})
-	_, err := e.EmbedQuery(nil, "query")
+	_, err := e.EmbedQuery(context.Background(), "query")
 	if !errors.Is(err, context.DeadlineExceeded) {
 		t.Fatalf("error = %v", err)
 	}
```

---

### Incident Patch 2: `8534acfe` (2026-09-29)
**Commit Message**: [fix] validate subdocuments properly

**File**: `server/indexer/files_test.go` (modified, +71/-0)
```diff
@@ -75,6 +75,77 @@ func TestAddFunctionsValidateFileDocuments(t *testing.T) {
 	}
 }
 
+func TestExtractorExtraDocumentsCannotReadLocalFiles(t *testing.T) {
+	for _, mode := range []string{"single", "direct", "batch"} {
+		for _, nested := range []bool{false, true} {
+			t.Run(fmt.Sprintf("%s/nested=%t", mode, nested), func(t *testing.T) {
+				idx := newTestIndexer(t, testutil.Config(t))
+				t.Cleanup(idx.Close)
+				path := filepath.Join(t.TempDir(), "secret.txt")
+				const secret = "extractorfileregressionsecret"
+				if err := os.WriteFile(path, []byte(secret), 0o600); err != nil {
+					t.Fatal(err)
+				}
+				fileURL := files.PathToFileURL(path)
+				const validURL = "https://example.com/@alice/123"
+				payload := &document.Document{
+					URL:    "https://example.com/",
+					UserID: 1,
+					HTML: fmt.Sprintf(`<span>"repository":"mastodon/mastodon"</span>
+<div class="status"><a class="status__relative-time" href="%s"></a><div class="status__content"></div></div>
+<div class="status"><a class="status__relative-time" href="%s"></a><div class="status__content">Public toot</div></div>`, fileURL, validURL),
+				}
+				root := payload
+				if nested {
+					root = &document.Document{
+						URL:            "https://example.com/root",
+						Text:           "Parent document",
+						UserID:         1,
+						ExtraDocuments: []*document.Document{payload},
+					}
+				}
+				// Manual indexing overrides URL rules, but must retain file validation.
+				root.SetIgnoreSkipRules(true)
+				var err error
+				switch mode {
+				case "single":
+					err = idx.Add(root)
+				case "direct":
+					err = idx.AddDocument(root)
+				case "batch":
+					batch := idx.NewMultiBatch()
+					err = batch.Add(root)
+					if err == nil {
+						err = batch.Save()
+					}
+				}
+				if err != nil {
+					t.Fatal(err)
+				}
+				if len(payload.ExtraDocuments) != 2 {
+					t.Fatalf("extracted %d documents, want 2", len(payload.ExtraDocuments))
+				}
+				if extra := payload.ExtraDocuments[0]; extra.Text != "" || extra.IsProcessed() {
+					t.Fatal("unsafe extra document was processed")
+				}
+				if idx.GetByURLAndUser(fileURL, 1) != nil {
+					t.Fatal("local file was indexed")
+				}
+				result, err := idx.Search(&Query{Text: secret, UserID: 1})
+				if err != nil {
+					t.Fatal(err)
+				}
+				if len(result.Documents) != 0 {
+					t.Fatal("local file content is searchable")
+				}
+				if doc := idx.GetByURLAndUser(validURL, 1); doc == nil || doc.Text != "Public toot" {
+					t.Fatal("valid sibling toot was not indexed")
+				}
+			})
+		}
+	}
+}
+
 func TestDirectoryUserResolution(t *testing.T) {
 	testutil.InitModel(t)
 
```

**File**: `server/indexer/indexer.go` (modified, +6/-0)
```diff
@@ -1243,6 +1243,12 @@ func (i *Indexer) addDocument(ctx context.Context, d *document.Document, increme
 		if err := ctx.Err(); err != nil {
 			return err
 		}
+		// Extractor output can contain URLs from untrusted HTML. Validate each
+		// extra document before processing can read a local file.
+		if err := i.validateFileDocument(extra); err != nil {
+			log.Warn().Err(err).Str("url", extra.URL).Msg("failed to index extra document")
+			continue
+		}
 		if ignoreRules {
 			extra.SetIgnoreSkipRules(true)
 		}
```

---

### Incident Patch 3: `7ab09500` (2026-09-28)
**Commit Message**: [fix] lint

**File**: `cmd/index_flags_test.go` (modified, +7/-4)
```diff
@@ -44,8 +44,7 @@ func TestIndexSubmissionFlags(t *testing.T) {
 			cfg.Crawler.Delay = 0
 			cfg.Crawler.Timeout = 2
 			var submitted []document.Document
-			var server *httptest.Server
-			server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 				switch r.URL.Path {
 				case "/api/document", "/api/add":
 					if got := r.Header.Get("X-Hister-Target-User-ID"); got != tc.owner {
@@ -69,7 +68,9 @@ func TestIndexSubmissionFlags(t *testing.T) {
 					if tc.noRobots {
 						t.Error("--no-robots should bypass robots requests")
 					}
-					fmt.Fprint(w, "User-agent: *\nDisallow: /blocked\n")
+					if _, err := fmt.Fprint(w, "User-agent: *\nDisallow: /blocked\n"); err != nil {
+						t.Error(err)
+					}
 				case "/page", "/existing", "/blocked":
 					if r.URL.Path == "/existing" && !tc.force || r.URL.Path == "/blocked" && !tc.noRobots {
 						t.Errorf("fetched a page that should be skipped: %s", r.URL.Path)
@@ -82,7 +83,9 @@ func TestIndexSubmissionFlags(t *testing.T) {
 						t.Errorf("crawler cookie = %v, %v", cookie, err)
 					}
 					w.Header().Set("Content-Type", "text/html")
-					fmt.Fprint(w, `<html><head><title>Flag test</title></head><body><p>Page content.</p><a href="/unlisted">Unlisted page</a></body></html>`)
+					if _, err := fmt.Fprint(w, `<html><head><title>Flag test</title></head><body><p>Page content.</p><a href="/unlisted">Unlisted page</a></body></html>`); err != nil {
+						t.Error(err)
+					}
 				case "/missing", "/favicon.ico":
 					w.WriteHeader(http.StatusNotFound)
 				default:
```

**File**: `cmd/sitemap.go` (modified, +1/-2)
```diff
@@ -4,7 +4,6 @@ package cmd
 
 import (
 	"fmt"
-	"io"
 	"net/url"
 	"os"
 	"path"
@@ -80,7 +79,7 @@ func readSitemapInput(cmd *cobra.Command, reader *sitemapReader, source string)
 	if strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://") {
 		return reader.Fetch(cmd.Context(), source)
 	}
-	var input io.Reader = cmd.InOrStdin()
+	input := cmd.InOrStdin()
 	if source != "-" {
 		file, openErr := os.Open(files.ExpandHome(source))
 		if openErr != nil {
```

**File**: `cmd/sitemap_reader_test.go` (modified, +12/-4)
```diff
@@ -128,13 +128,19 @@ func TestSitemapReaderExpandsIndexesAndDeduplicates(t *testing.T) {
 		}
 		switch req.URL.Path {
 		case "/index.xml":
-			fmt.Fprintf(w, `<sitemapindex><sitemap><loc>%s/one.xml.gz</loc></sitemap><sitemap><loc>%s/nested.xml</loc></sitemap><sitemap><loc>%s/one.xml.gz</loc></sitemap></sitemapindex>`, server.URL, server.URL, server.URL)
+			if _, err := fmt.Fprintf(w, `<sitemapindex><sitemap><loc>%s/one.xml.gz</loc></sitemap><sitemap><loc>%s/nested.xml</loc></sitemap><sitemap><loc>%s/one.xml.gz</loc></sitemap></sitemapindex>`, server.URL, server.URL, server.URL); err != nil {
+				t.Error(err)
+			}
 		case "/nested.xml":
-			fmt.Fprintf(w, `<sitemapindex><sitemap><loc>%s/index.xml</loc></sitemap><sitemap><loc>%s/two.xml</loc></sitemap></sitemapindex>`, server.URL, server.URL)
+			if _, err := fmt.Fprintf(w, `<sitemapindex><sitemap><loc>%s/index.xml</loc></sitemap><sitemap><loc>%s/two.xml</loc></sitemap></sitemapindex>`, server.URL, server.URL); err != nil {
+				t.Error(err)
+			}
 		case "/one.xml.gz":
 			_, _ = w.Write(gzipSitemap(t, `<urlset><url><loc>https://example.com/one</loc></url><url><loc>https://example.com/one#fragment</loc></url></urlset>`))
 		case "/two.xml":
-			fmt.Fprint(w, `<urlset><url><loc>https://example.com/one</loc></url><url><loc>https://example.com/two</loc></url></urlset>`)
+			if _, err := fmt.Fprint(w, `<urlset><url><loc>https://example.com/one</loc></url><url><loc>https://example.com/two</loc></url></urlset>`); err != nil {
+				t.Error(err)
+			}
 		default:
 			t.Errorf("unexpected fetch: %s", req.URL)
 		}
@@ -170,7 +176,9 @@ func TestSitemapReaderExpandsIndexesAndDeduplicates(t *testing.T) {
 func TestSitemapReaderErrors(t *testing.T) {
 	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 		if r.URL.Path == "/robots.txt" {
-			fmt.Fprint(w, "User-agent: *\nDisallow: /blocked\n")
+			if _, err := fmt.Fprint(w, "User-agent: *\nDisallow: /blocked\n"); err != nil {
+				t.Error(err)
+			}
 			return
 		}
 		http.Error(w, "missing", http.StatusNotFound)
```

**File**: `cmd/sitemap_test.go` (modified, +9/-3)
```diff
@@ -76,9 +76,13 @@ func TestImportSitemapQueuesOnlyListedPages(t *testing.T) {
 			server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 				switch r.URL.Path {
 				case "/sitemap.xml":
-					fmt.Fprintf(w, `<urlset><url><loc>%s/page</loc></url><url><loc>%s/page</loc></url><url><loc>%s/existing</loc></url><url><loc>%s/blocked</loc></url></urlset>`, server.URL, server.URL, server.URL, server.URL)
+					if _, err := fmt.Fprintf(w, `<urlset><url><loc>%s/page</loc></url><url><loc>%s/page</loc></url><url><loc>%s/existing</loc></url><url><loc>%s/blocked</loc></url></urlset>`, server.URL, server.URL, server.URL, server.URL); err != nil {
+						t.Error(err)
+					}
 				case "/robots.txt":
-					fmt.Fprint(w, "User-agent: *\nDisallow: /blocked\n")
+					if _, err := fmt.Fprint(w, "User-agent: *\nDisallow: /blocked\n"); err != nil {
+						t.Error(err)
+					}
 				case "/api/document":
 					if !strings.HasSuffix(r.URL.Query().Get("url"), "/existing") {
 						w.WriteHeader(http.StatusNotFound)
@@ -91,7 +95,9 @@ func TestImportSitemapQueuesOnlyListedPages(t *testing.T) {
 						t.Error("existing page fetched without --force")
 					}
 					w.Header().Set("Content-Type", "text/html")
-					fmt.Fprint(w, `<html><head><title>Sitemap page</title></head><body><p>Content of the listed page.</p><a href="/unlisted">Do not crawl this page</a></body></html>`)
+					if _, err := fmt.Fprint(w, `<html><head><title>Sitemap page</title></head><body><p>Content of the listed page.</p><a href="/unlisted">Do not crawl this page</a></body></html>`); err != nil {
+						t.Error(err)
+					}
 				case "/api/add":
 					var doc document.Document
 					if err := json.NewDecoder(r.Body).Decode(&doc); err != nil {
```

---

### Incident Patch 4: `bafe7d70` (2026-09-26)
**Commit Message**: [fix] extend selectors - #790

**File**: `server/extractor/extractors/chatgpt/extractor.go` (modified, +18/-3)
```diff
@@ -21,7 +21,8 @@ import (
 
 const conversationType = "chatgpt"
 
-const conversationRoleSelector = `[data-message-author-role], [data-testid^="conversation-turn-"][data-turn]`
+const conversationRoleSelector = `[data-message-author-role], [data-testid^="conversation-turn-"][data-turn], ` +
+	`[data-chatgpt-search-unit-key], [data-content-search-unit-key]`
 
 const noConversationTurns = "no visible user or assistant turns found; capture the loaded conversation with the browser extension or a browser crawler (chromedp or bidi); private conversations require a signed in browser"
 
@@ -187,7 +188,7 @@ func findConversationTurns(doc *goquery.Document) []conversationTurn {
 		return nil
 	}
 	turns := make([]conversationTurn, 0)
-	// Visit both marker forms together so mixed markup retains document order.
+	// Visit all marker forms together so mixed markup retains document order.
 	doc.Find(conversationRoleSelector).Each(func(_ int, roleNode *goquery.Selection) {
 		role := conversationRole(roleNode)
 		if role == "" || hasRoleAncestor(roleNode) || isHiddenElement(roleNode) {
@@ -213,7 +214,20 @@ func conversationRole(selection *goquery.Selection) string {
 	if rawRole, ok := selection.Attr("data-message-author-role"); ok {
 		return normalizeRole(rawRole)
 	}
-	return normalizeRole(selection.AttrOr("data-turn", ""))
+	if rawRole, ok := selection.Attr("data-turn"); ok {
+		return normalizeRole(rawRole)
+	}
+	// Search units encode the role as the final component, for example
+	// "fallback-turn-0:2:assistant". Both attributes may wrap the same message.
+	for _, attribute := range []string{"data-chatgpt-search-unit-key", "data-content-search-unit-key"} {
+		if key, ok := selection.Attr(attribute); ok {
+			if separator := strings.LastIndexByte(key, ':'); separator > 0 {
+				return normalizeRole(key[separator+1:])
+			}
+			return ""
+		}
+	}
+	return ""
 }
 
 func normalizeRole(raw string) string {
@@ -252,6 +266,7 @@ func cleanConversationContent(content *goquery.Selection, role string) {
 		// Turn wrappers include an accessibility heading repeating the speaker.
 		content.ChildrenFiltered(".sr-only").Remove()
 	}
+	content.Find(`[data-markdown-copy="exclude"], .turn-action-controls`).Remove()
 	content.Find(`script, style, noscript, template, button, svg, img, picture, video, audio, iframe, embed, object, canvas, source, form, input, textarea, select, option`).Remove()
 	content.Find(`[hidden], [aria-hidden]`).Each(func(_ int, nested *goquery.Selection) {
 		if isHiddenElement(nested) {
```

---

### Incident Patch 5: `25dccadb` (2026-09-26)
**Commit Message**: [fix] support data-turn markers and mixed markup - #790

**File**: `server/extractor/extractors/chatgpt/extractor.go` (modified, +31/-60)
```diff
@@ -4,6 +4,7 @@
 package chatgpt
 
 import (
+	"errors"
 	"fmt"
 	stdhtml "html"
 	"net/url"
@@ -20,6 +21,10 @@ import (
 
 const conversationType = "chatgpt"
 
+const conversationRoleSelector = `[data-message-author-role], [data-testid^="conversation-turn-"][data-turn]`
+
+const noConversationTurns = "no visible user or assistant turns found; capture the loaded conversation with the browser extension or a browser crawler (chromedp or bidi); private conversations require a signed in browser"
+
 // ChatGPTExtractor extracts one visible ChatGPT conversation into one Hister
 // document. It intentionally works only with the rendered HTML already on the
 // document and never fetches conversation data itself.
@@ -34,7 +39,7 @@ func (e *ChatGPTExtractor) Name() string {
 }
 
 func (e *ChatGPTExtractor) Description() string {
-	return "Extracts the visible user and assistant turns from ChatGPT conversations as one searchable document."
+	return "Extracts the visible user and assistant turns from rendered ChatGPT conversations as one searchable document. Requires HTML captured by the browser extension or a browser crawler (chromedp or bidi)."
 }
 
 func (e *ChatGPTExtractor) Capabilities() sdk.Capabilities {
@@ -110,7 +115,7 @@ func (e *ChatGPTExtractor) Extract(d *sdk.Document) sdk.ExtractResult {
 		return sdk.ExtractFallback(err)
 	}
 	if len(turns) == 0 {
-		return sdk.AbortExtraction(fmt.Errorf("no visible user or assistant turns found"))
+		return sdk.AbortExtraction(errors.New(noConversationTurns))
 	}
 
 	title := documentTitle(d, doc)
@@ -134,7 +139,7 @@ func (e *ChatGPTExtractor) Preview(d *sdk.Document) sdk.PreviewResult {
 		return sdk.PreviewFallback(err)
 	}
 	if len(turns) == 0 {
-		return sdk.PreviewFallback(fmt.Errorf("no visible user or assistant turns found"))
+		return sdk.PreviewFallback(errors.New(noConversationTurns))
 	}
 
 	base, err := url.Parse(d.URL)
@@ -181,20 +186,16 @@ func findConversationTurns(doc *goquery.Document) []conversationTurn {
 	if doc == nil {
 		return nil
 	}
-	if turns := findArticleConversationTurns(doc); len(turns) > 0 {
-		return turns
-	}
-	return findRoleConversationTurns(doc)
-}
-
-func findArticleConversationTurns(doc *goquery.Document) []conversationTurn {
 	turns := make([]conversationTurn, 0)
-	doc.Find(`article[data-testid^="conversation-turn-"]`).Each(func(_ int, article *goquery.Selection) {
-		if isHiddenElement(article) {
+	// Visit both marker forms together so mixed markup retains document order.
+	doc.Find(conversationRoleSelector).Each(func(_ int, roleNode *goquery.Selection) {
+		role := conversationRole(roleNode)
+		if role == "" || hasRoleAncestor(roleNode) || isHiddenElement(roleNode) {
 			return
 		}
-		roleNode, role := findRoleNode(article)
-		if roleNode == nil || isHiddenElement(roleNode) {
+		if _, explicit := roleNode.Attr("data-message-author-role"); !explicit && roleNode.Find(`[data-message-author-role]`).Length() > 0 {
+			// Prefer explicit messages, even when they are hidden or unsupported.
+			// Falling back to their wrapper would index controls or internal text.
 			return
 		}
 
@@ -208,48 +209,11 @@ func findArticleConversationTurns(doc *goquery.Document) []conversationTurn {
 	return turns
 }
 
-func findRoleConversationTurns(doc *goquery.Document) []conversationTurn {
-	turns := make([]conversationTurn, 0)
-	doc.Find(`[data-message-author-role]`).Each(func(_ int, roleNode *goquery.Selection) {
-		role := normalizeRole(roleNode.AttrOr("data-message-author-role", ""))
-		if role == "" || hasRoleAncestor(roleNode) || isHiddenElement(roleNode) {
-			return
-		}
-
-		content := roleNode.Clone()
-		cleanConversationContent(content, role)
-		if strings.TrimSpace(conversationSelectionText(content)) == "" {
-			return
-		}
-		turns = append(turns, conversationTurn{role: role, content: content})
-	})
-	return turns
-}
-
-func findRoleNode(article *goquery.Selection) (*goquery.Selection, string) {
-	if article == nil || article.Length() == 0 {
-		return ni
```

**File**: `server/extractor/extractors/chatgpt/extractor_test.go` (modified, +95/-2)
```diff
@@ -3,6 +3,7 @@
 package chatgpt
 
 import (
+	"fmt"
 	"os"
 	"strings"
 	"testing"
@@ -11,6 +12,96 @@ import (
 	"github.com/asciimoo/hister/server/extractor/sdk"
 )
 
+func TestExtractsTurnMarkers(t *testing.T) {
+	for _, tag := range []string{"article", "section", "div"} {
+		for _, legacy := range []bool{false, true} {
+			t.Run(fmt.Sprintf("%s/legacy=%v", tag, legacy), func(t *testing.T) {
+				question := `<p>Explain <strong>gravity</strong>.</p>`
+				followup := `<section data-testid="conversation-turn-3" data-turn="user"><p>Thanks.</p></section>`
+				if legacy {
+					question = `<div data-message-author-role="user">` + question + `</div>`
+					followup = `<div data-message-author-role="user"><p>Thanks.</p></div>`
+				}
+				doc := &document.Document{
+					URL: "https://chatgpt.com/c/turn-markers",
+					HTML: fmt.Sprintf(`<html><body><nav>Sidebar content</nav><main>
+						<%[1]s data-testid="conversation-turn-1" data-turn="user">%[2]s</%[1]s>
+						<%[1]s data-testid="conversation-turn-2" data-turn="assistant">
+							<h4 class="sr-only">ChatGPT said:</h4>
+							<div class="markdown"><p>Gravity attracts masses.</p><pre><code>F = G * m1 * m2 / r^2</code></pre></div>
+							<button>Copy answer</button><script>ignored()</script>
+						</%[1]s>
+						%[3]s
+					</main></body></html>`, tag, question, followup),
+				}
+				extractor := &ChatGPTExtractor{}
+				decision, err := extractor.Extract(doc).Unpack()
+				if err != nil || decision != sdk.ExtractorSuccess {
+					t.Fatalf("Extract returned decision %v and error %v", decision, err)
+				}
+				want := "User:\nExplain gravity.\n\nAssistant:\nGravity attracts masses.\nF = G * m1 * m2 / r^2\n\nUser:\nThanks."
+				if doc.Text != want {
+					t.Fatalf("indexed text = %q, want %q", doc.Text, want)
+				}
+				preview, decision, err := extractor.Preview(doc).Unpack()
+				if err != nil || decision != sdk.ExtractorSuccess {
+					t.Fatalf("Preview returned decision %v and error %v", decision, err)
+				}
+				for _, want := range []string{"<strong>gravity</strong>", "<pre><code>F = G * m1 * m2 / r^2</code></pre>"} {
+					if !strings.Contains(preview.Content, want) {
+						t.Errorf("preview is missing %q: %s", want, preview.Content)
+					}
+				}
+				if strings.Count(preview.Content, "<h2>User</h2>") != 2 || strings.Count(preview.Content, "<h2>Assistant</h2>") != 1 {
+					t.Errorf("preview has missing or duplicate turns: %s", preview.Content)
+				}
+				for _, unwanted := range []string{"Sidebar content", "ChatGPT said:", "Copy answer", "ignored()"} {
+					if strings.Contains(preview.Content, unwanted) {
+						t.Errorf("preview contains %q: %s", unwanted, preview.Content)
+					}
+				}
+			})
+		}
+	}
+}
+
+func TestTurnMarkersRespectExplicitRolesAndVisibility(t *testing.T) {
+	doc := &document.Document{
+		URL: "https://chatgpt.com/c/turn-visibility",
+		HTML: `<html><body>
+			<section data-testid="conversation-turn-1" data-turn="user" hidden><p>Hidden user</p></section>
+			<div aria-hidden="true"><section data-testid="conversation-turn-2" data-turn="assistant"><p>Hidden ancestor</p></section></div>
+			<section data-testid="conversation-turn-3" data-turn="assistant"><div data-message-author-role="assistant" hidden>Hidden message</div>Turn controls</section>
+			<section data-testid="conversation-turn-4" data-turn="system"><div data-message-author-role="user">Internal user</div></section>
+			<section data-testid="conversation-turn-5" data-turn="assistant"><div data-message-author-role="tool">Tool output</div>Turn controls</section>
+			<section data-testid="conversation-turn-6" data-turn="assistant"><div data-message-author-role="assistant"><p>First answer.</p></div><div data-message-author-role="assistant"><p>Second answer.</p></div></section>
+			<section data-testid="conversation-turn-7" data-turn="user"><section data-testid="conversation-turn-nested" data-turn="user"><p>Follow up.</p></section></section>
+			<section data-testid="conversation-t
```

---

### Incident Patch 6: `2bf3c9a9` (2026-09-25)
**Commit Message**: [fix] increase the capacity of the qute browser event parsing

**File**: `cmd/companion/qutebrowser/cdp.go` (modified, +4/-10)
```diff
@@ -49,7 +49,7 @@ type cdpClient struct {
 	pendingMu sync.Mutex
 	pending   map[int64]chan rpcMessage
 
-	events chan rpcMessage
+	events *cdpEventQueue
 	done   chan struct{}
 
 	closeOnce sync.Once
@@ -83,7 +83,7 @@ func dialCDP(
 	client := &cdpClient{
 		conn:    conn,
 		pending: make(map[int64]chan rpcMessage),
-		events:  make(chan rpcMessage, 512),
+		events:  newCDPEventQueue(),
 		done:    make(chan struct{}),
 	}
 	go client.readLoop()
@@ -228,14 +228,8 @@ func (c *cdpClient) readLoop() {
 			}
 			continue
 		}
-		if message.Method == "" {
-			continue
-		}
-		select {
-		case c.events <- message:
-		default:
-			c.fail(errors.New("DevTools event buffer is full"))
-			return
+		if isMonitoredEvent(message.Method) {
+			c.events.push(message)
 		}
 	}
 }
```

**File**: `cmd/companion/qutebrowser/cdp_test.go` (added, +240/-0)
```diff
@@ -0,0 +1,240 @@
+package qutebrowser
+
+import (
+	"context"
+	"encoding/json"
+	"fmt"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+	"time"
+
+	"github.com/gorilla/websocket"
+)
+
+func TestMonitorInitializesManyTabs(t *testing.T) {
+	const tabCount = 300
+	targets := make([]targetInfo, tabCount)
+	for i := range targets {
+		targets[i] = targetInfo{
+			TargetID: fmt.Sprintf("page-%d", i),
+			Type:     "page",
+			URL:      fmt.Sprintf("https://example.com/%d", i),
+		}
+	}
+	client := newTestCDPClient(t, func(conn *websocket.Conn, request rpcMessage) error {
+		var result any = struct{}{}
+		switch request.Method {
+		case "Target.setDiscoverTargets":
+			for _, target := range targets {
+				params, err := json.Marshal(map[string]any{"targetInfo": target})
+				if err != nil {
+					return err
+				}
+				if err := conn.WriteJSON(rpcMessage{
+					Method: "Target.targetCreated",
+					Params: params,
+				}); err != nil {
+					return err
+				}
+			}
+		case "Target.getTargets":
+			result = map[string]any{"targetInfos": targets}
+		case "Target.attachToTarget":
+			var params struct {
+				TargetID string `json:"targetId"`
+			}
+			if err := json.Unmarshal(request.Params, &params); err != nil {
+				return err
+			}
+			result = map[string]any{"sessionId": params.TargetID}
+		case "Page.enable":
+			if err := conn.WriteJSON(rpcMessage{
+				Method:    "Page.loadEventFired",
+				SessionID: request.SessionID,
+				Params:    json.RawMessage(`{"timestamp":1}`),
+			}); err != nil {
+				return err
+			}
+		case "Page.getFrameTree":
+			result = map[string]any{"frameTree": map[string]any{"frame": map[string]any{"id": request.SessionID}}}
+		case "Page.createIsolatedWorld":
+			result = map[string]any{"executionContextId": 1}
+		}
+		encoded, err := json.Marshal(result)
+		if err != nil {
+			return err
+		}
+		return conn.WriteJSON(rpcMessage{ID: request.ID, Result: encoded})
+	})
+
+	input := DefaultOptions()
+	input.InitialDelay = time.Hour
+	opts, err := normalizeOptions(input)
+	if err != nil {
+		t.Fatal(err)
+	}
+	m := &monitor{
+		companion:   newCompanion(opts, &recordingSubmitter{}),
+		client:      client,
+		bindingName: "testBinding",
+		pages:       make(map[string]*pageState),
+		targets:     make(map[string]string),
+		extraction:  make(chan extractionDue, tabCount),
+	}
+	t.Cleanup(m.stop)
+	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
+	defer cancel()
+	if err := m.initialize(ctx); err != nil {
+		t.Fatal(err)
+	}
+	if len(m.pages) != tabCount {
+		t.Fatalf("watching %d pages, want %d", len(m.pages), tabCount)
+	}
+	select {
+	case <-client.done:
+		t.Fatalf("connection ended during initialization: %v", client.connectionError())
+	default:
+	}
+
+	// Discovery and page setup events must remain available after initialization.
+	for _, method := range []string{"Target.targetCreated", "Page.loadEventFired"} {
+		for _, target := range targets {
+			event := nextTestCDPEvent(t, ctx, client)
+			if event.Method != method {
+				t.Fatalf("event method = %q, want %q", event.Method, method)
+			}
+			if method == "Page.loadEventFired" && event.SessionID != target.TargetID {
+				t.Fatalf("event session = %q, want %q", event.SessionID, target.TargetID)
+			}
+			m.handleEvent(ctx, event)
+		}
+	}
+}
+
+func TestCDPEventBurstPreservesRepliesAndOrder(t *testing.T) {
+	const eventCount = 4096
+	methods := []string{
+		"Target.targetCreated", "Target.targetInfoChanged",
+		"Target.targetDestroyed", "Target.targetCrashed", "Target.detachedFromTarget",
+		"Page.frameNavigated", "Page.loadEventFired", "Page.navigatedWithinDocument",
+		"Page.lifecycleEvent", "Runtime.bindingCalled",
+	}
+	eventAt := func(i int) rpcMessage {
+		return rpcMessage{
+			Method:    methods[i%len(methods)],
+			SessionID: fmt.Sprintf("session-%d", i),
+			Params:    json.RawMessage(fmt.Sprintf(`{"sequence":%d}`, i)),
+		}
+	}
+	client := newTestCDPClient(t, func(conn *websocket.Conn, request rpcMessage) error {
+		for i 
```

**File**: `cmd/companion/qutebrowser/companion.go` (modified, +2/-2)
```diff
@@ -187,8 +187,8 @@ func (m *monitor) eventLoop(ctx context.Context) error {
 			return ctx.Err()
 		case <-m.client.done:
 			return m.client.connectionError()
-		case event := <-m.client.events:
-			m.handleEvent(ctx, event)
+		case <-m.client.events.ready:
+			m.handleEvent(ctx, m.client.events.pop())
 		case due := <-m.extraction:
 			m.handleExtractionDue(ctx, due)
 		case result := <-m.results:
```

**File**: `cmd/companion/qutebrowser/events.go` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+package qutebrowser
+
+import "sync"
+
+// cdpEventQueue lets the socket reader keep delivering command replies while
+// the monitor is busy attaching pages. Event handling can itself wait for a
+// command reply, so queueing an event must never wait for the monitor.
+type cdpEventQueue struct {
+	mu      sync.Mutex
+	pending []rpcMessage
+	ready   chan struct{}
+}
+
+func newCDPEventQueue() *cdpEventQueue {
+	return &cdpEventQueue{ready: make(chan struct{}, 1)}
+}
+
+func (q *cdpEventQueue) push(event rpcMessage) {
+	q.mu.Lock()
+	defer q.mu.Unlock()
+
+	q.pending = append(q.pending, event)
+	if len(q.pending) == 1 {
+		q.ready <- struct{}{}
+	}
+}
+
+// pop is called by the monitor after receiving a notification from ready.
+func (q *cdpEventQueue) pop() rpcMessage {
+	q.mu.Lock()
+	defer q.mu.Unlock()
+
+	event := q.pending[0]
+	q.pending[0] = rpcMessage{}
+	q.pending = q.pending[1:]
+	if len(q.pending) == 0 {
+		q.pending = nil
+	} else {
+		q.ready <- struct{}{}
+	}
+	return event
+}
+
+func isMonitoredEvent(method string) bool {
+	switch method {
+	case "Target.targetCreated", "Target.targetInfoChanged",
+		"Target.targetDestroyed", "Target.targetCrashed", "Target.detachedFromTarget",
+		"Page.frameNavigated", "Page.loadEventFired", "Page.navigatedWithinDocument",
+		"Page.lifecycleEvent", "Runtime.bindingCalled":
+		return true
+	default:
+		return false
+	}
+}
```

---

### Incident Patch 7: `28ed5aa6` (2026-09-24)
**Commit Message**: [fix] throttle bleve write error retries to prevent excessive cpu usage

**File**: `server/indexer/indexer.go` (modified, +25/-5)
```diff
@@ -35,6 +35,7 @@ import (
 	"github.com/blevesearch/bleve/v2/analysis/token/lowercase"
 	"github.com/blevesearch/bleve/v2/analysis/tokenizer/single"
 	"github.com/blevesearch/bleve/v2/analysis/tokenizer/unicode"
+	"github.com/blevesearch/bleve/v2/index/scorch"
 	"github.com/blevesearch/bleve/v2/mapping"
 	"github.com/blevesearch/bleve/v2/registry"
 	"github.com/blevesearch/bleve/v2/search"
@@ -78,10 +79,12 @@ type Indexer struct {
 }
 
 const (
-	defaultIndexerName  = "index.db"
-	langIndexerName     = "index_%s.db"
-	updatedBackfillKey  = "hister.updated_backfill_complete"
-	updatedBackfillSize = 200
+	defaultIndexerName      = "index.db"
+	langIndexerName         = "index_%s.db"
+	updatedBackfillKey      = "hister.updated_backfill_complete"
+	updatedBackfillSize     = 200
+	bleveAsyncErrorCallback = "hister_background_error"
+	bleveErrorRetryDelay    = time.Second
 )
 
 type Query struct {
@@ -328,7 +331,8 @@ var (
 	ErrEmptyFilter                      = errors.New("query must not be empty")
 	ErrFileURLNotAllowed                = errors.New("file URL is not allowed")
 	bleveConfig          map[string]any = map[string]any{
-		"bolt_timeout": "2s",
+		"bolt_timeout":           "2s",
+		"asyncErrorCallbackName": bleveAsyncErrorCallback,
 		// https://github.com/blevesearch/bleve/blob/master/docs/persister.md
 		"scorchPersisterOptions": map[string]any{
 			"NumPersisterWorkers":           4,
@@ -341,6 +345,22 @@ var (
 	}
 )
 
+func init() {
+	// Bleve's callback registry must only be modified during initialization.
+	scorch.RegistryAsyncErrorCallbacks[bleveAsyncErrorCallback] = handleBleveAsyncError
+}
+
+func handleBleveAsyncError(err error, path string) {
+	log.Error().Err(err).Str("index", path).Msg("Search index background operation failed")
+	if errors.Is(err, scorch.ErrPersist) {
+		// Scorch calls this hook synchronously before retrying persistence or
+		// merge failures. Pace both loops without delaying successful writes.
+		// Each failing worker logs at most once per second. The wait is bounded
+		// so that the worker can still finish during shutdown.
+		time.Sleep(bleveErrorRetryDelay)
+	}
+}
+
 // New creates an independent indexer instance from cfg.
 func New(cfg *config.Config) (*Indexer, error) {
 	sp := make([]string, 0, len(cfg.SensitiveContentPatterns))
```

---

### Incident Patch 8: `960bf020` (2026-09-23)
**Commit Message**: [fix] handle embedding dimension mismatches - fixes #784

**File**: `server/indexer/embedding_queue_test.go` (modified, +72/-0)
```diff
@@ -15,9 +15,11 @@ import (
 	"testing"
 	"time"
 
+	"github.com/asciimoo/hister/config"
 	"github.com/asciimoo/hister/server/document"
 	"github.com/asciimoo/hister/server/model"
 	"github.com/asciimoo/hister/server/testutil"
+	"github.com/asciimoo/hister/server/vectorstore"
 )
 
 func embeddingTestServer(t *testing.T, requests *atomic.Int64) *httptest.Server {
@@ -126,6 +128,76 @@ func TestEmbeddingQueueSkipsUnchangedDocumentText(t *testing.T) {
 	waitForEmbeddingJobs(t, &requests, 2)
 }
 
+func TestReindexRebuildsEmbeddingsAfterDimensionChange(t *testing.T) {
+	var requests atomic.Int64
+	server := embeddingTestServer(t, &requests)
+	defer server.Close()
+	cfg := testutil.Config(t)
+	cfg.SemanticSearch.EmbeddingEndpoint = server.URL
+	cfg.SemanticSearch.EmbeddingModel = "test"
+	cfg.SemanticSearch.Dimensions = 768
+	cfg.SemanticSearch.MaxEmbeddingConcurrency = 1
+	testutil.InitModelWithConfig(t, cfg)
+	idx := newTestIndexer(t, cfg)
+	doc := &document.Document{
+		URL:       "https://example.com/changed-dimensions",
+		Title:     "Dimension change",
+		Text:      "Document to embed again with the new dimensions",
+		Processed: true,
+	}
+	if err := idx.Add(doc); err != nil {
+		idx.Close()
+		t.Fatal(err)
+	}
+	idx.Close()
+
+	// Seed an existing vector table with a size that differs from the endpoint.
+	store, err := vectorstore.New(cfg)
+	if err != nil {
+		t.Fatal(err)
+	}
+	t.Cleanup(func() { _ = store.Close() })
+	if err := store.Init(); err != nil {
+		t.Fatal(err)
+	}
+	oldVector := make([]float32, 768)
+	oldVector[0] = 1
+	if err := store.PutChunks(doc.ID(), 0, []vectorstore.Chunk{{Text: doc.Text, Embedding: oldVector}}); err != nil {
+		t.Fatal(err)
+	}
+	if err := store.Close(); err != nil {
+		t.Fatal(err)
+	}
+
+	cfg.SemanticSearch.Enable = true
+	cfg.SemanticSearch.Dimensions = 2
+	idx = newTestIndexer(t, cfg)
+	defer idx.Close()
+	if !idx.SemanticSearchEnabled() {
+		t.Fatal("schema mismatch disabled the vector store needed for reindexing")
+	}
+	if err := idx.Reindex(&config.Rules{}, false, false, false, nil); err != nil {
+		t.Fatal(err)
+	}
+	results, err := idx.vectorStore.Search([]float32{0.25, 0.75}, 5, 0.9, 0)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if len(results) == 0 || results[0].DocID != doc.ID() {
+		t.Fatalf("semantic search after dimension change = %#v, want %q", results, doc.ID())
+	}
+	if idx.GetByURLAndUser(doc.URL, 0) == nil {
+		t.Fatal("document missing after reindex")
+	}
+	fingerprint, err := idx.GetEmbeddingFingerprint()
+	if err != nil {
+		t.Fatal(err)
+	}
+	if fingerprint != cfg.SemanticSearch.EmbeddingFingerprint() {
+		t.Fatal("reindex did not record the updated embedding configuration")
+	}
+}
+
 func TestEmbeddingQueueReprocessesDocumentChangedWhileActive(t *testing.T) {
 	var requests atomic.Int64
 	var inputsMu sync.Mutex
```

**File**: `server/indexer/indexer.go` (modified, +7/-8)
```diff
@@ -712,14 +712,6 @@ func (idx *Indexer) reindex(ctx context.Context, basePath string, rules *config.
 	// separate file from the Bleve indexes).
 	vs := idx.vectorStore
 	embedder := idx.embedder
-	if vs != nil && embedder != nil {
-		if err := vs.Clear(); err != nil {
-			log.Warn().Err(err).Msg("failed to clear vector store before reindex")
-		} else {
-			tmpIdx.vectorStore = vs
-			tmpIdx.embedder = embedder
-		}
-	}
 	abortReindex := func(err error) error {
 		// The live indexer still owns the shared vector store when reindexing
 		// aborts. Do not let closing the temporary indexer close that store.
@@ -730,6 +722,13 @@ func (idx *Indexer) reindex(ctx context.Context, basePath string, rules *config.
 		}
 		return err
 	}
+	if vs != nil && embedder != nil {
+		if err := vs.Clear(); err != nil {
+			return abortReindex(fmt.Errorf("rebuild vector store before reindex: %w", err))
+		}
+		tmpIdx.vectorStore = vs
+		tmpIdx.embedder = embedder
+	}
 	q := query.NewMatchAllQuery()
 	var total uint64
 	for name, source := range sourceIndexes {
```

**File**: `server/indexer/metadata_test.go` (modified, +41/-2)
```diff
@@ -3,6 +3,7 @@
 package indexer
 
 import (
+	"errors"
 	"os"
 	"path/filepath"
 	"testing"
@@ -15,7 +16,9 @@ import (
 	"github.com/blevesearch/bleve/v2"
 )
 
-type metadataVectorStore struct{}
+type metadataVectorStore struct {
+	clearErr error
+}
 
 func (*metadataVectorStore) Init() error { return nil }
 
@@ -27,7 +30,7 @@ func (*metadataVectorStore) Search([]float32, int, float64, uint) ([]vectorstore
 	return nil, nil
 }
 
-func (*metadataVectorStore) Clear() error { return nil }
+func (s *metadataVectorStore) Clear() error { return s.clearErr }
 
 func (*metadataVectorStore) Close() error { return nil }
 
@@ -378,3 +381,39 @@ func TestReindexStoresActiveEmbeddingFingerprint(t *testing.T) {
 		t.Fatalf("embedding fingerprint = %q, want %q", storedFingerprint, wantFingerprint)
 	}
 }
+
+func TestReindexPreservesIndexWhenVectorRebuildFails(t *testing.T) {
+	cfg := testutil.Config(t)
+	idx, err := initializeIndexer(cfg.FullPath(""), false, false, "stored-embedding")
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer idx.Close()
+	doc := &document.Document{URL: "https://example.com/rebuild-failure", Text: "original text", Processed: true}
+	if err := idx.Add(doc); err != nil {
+		t.Fatal(err)
+	}
+	idx.semanticConfig = config.SemanticSearch{Enable: true, Dimensions: 4}
+	idx.embedder = vectorstore.NewEmbedder(&idx.semanticConfig)
+	wantErr := errors.New("vector table rebuild failed")
+	idx.vectorStore = &metadataVectorStore{clearErr: wantErr}
+	if err := idx.Reindex(&config.Rules{}, false, false, false, nil); !errors.Is(err, wantErr) {
+		t.Fatalf("Reindex error = %v, want %v", err, wantErr)
+	}
+	if idx.GetByURLAndUser(doc.URL, 0) == nil {
+		t.Fatal("existing document was lost after failed vector rebuild")
+	}
+	fingerprint, err := idx.GetEmbeddingFingerprint()
+	if err != nil {
+		t.Fatal(err)
+	}
+	if fingerprint != "stored-embedding" {
+		t.Fatalf("embedding fingerprint changed after failed rebuild: %q", fingerprint)
+	}
+	if idx.reindexInProgress.Load() {
+		t.Fatal("reindex remains in progress after failed vector rebuild")
+	}
+	if _, err := os.Stat(filepath.Join(cfg.App.Directory, "reindex")); !os.IsNotExist(err) {
+		t.Fatalf("temporary reindex directory remains after failure: %v", err)
+	}
+}
```

**File**: `server/vectorstore/sqlite.go` (modified, +42/-7)
```diff
@@ -9,6 +9,8 @@ import (
 	"fmt"
 	"math"
 	"path/filepath"
+	"regexp"
+	"strconv"
 	"strings"
 
 	"github.com/asciimoo/hister/config"
@@ -19,6 +21,8 @@ import (
 
 const sqliteVectorSchemaVersion = 1
 
+var sqliteEmbeddingColumn = regexp.MustCompile(`(?i)\bembedding\s+float\s*\[\s*(\d+)\s*\]`)
+
 type sqliteVectorStore struct {
 	db         *sql.DB
 	dimensions int
@@ -97,12 +101,12 @@ func (s *sqliteVectorStore) Init() error {
 	return nil
 }
 
-func (s *sqliteVectorStore) createEmbeddingsTable(tx *sql.Tx) error {
+func (s *sqliteVectorStore) createEmbeddingsTable(tx *sql.Tx, dimensions int) error {
 	stmt := fmt.Sprintf(`CREATE VIRTUAL TABLE embeddings USING vec0(
 		user_id INTEGER PARTITION KEY,
 		chunk_key TEXT PRIMARY KEY,
 		embedding FLOAT[%d] distance_metric=cosine
-	)`, s.dimensions)
+	)`, dimensions)
 	if _, err := tx.Exec(stmt); err != nil {
 		return fmt.Errorf("create embeddings table: %w", err)
 	}
@@ -113,7 +117,7 @@ func (s *sqliteVectorStore) initEmbeddingsTable(tx *sql.Tx) (int64, error) {
 	var schema string
 	err := tx.QueryRow(`SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'embeddings'`).Scan(&schema)
 	if errors.Is(err, sql.ErrNoRows) {
-		return -1, s.createEmbeddingsTable(tx)
+		return -1, s.createEmbeddingsTable(tx, s.dimensions)
 	}
 	if err != nil {
 		return -1, fmt.Errorf("read embeddings table schema: %w", err)
@@ -123,6 +127,20 @@ func (s *sqliteVectorStore) initEmbeddingsTable(tx *sql.Tx) (int64, error) {
 	if !strings.Contains(normalizedSchema, "usingvec0(") {
 		return -1, errors.New("existing embeddings table is not a vec0 virtual table")
 	}
+	column := sqliteEmbeddingColumn.FindStringSubmatch(schema)
+	if len(column) != 2 {
+		return -1, errors.New("cannot read dimensions from existing embeddings table")
+	}
+	storedDimensions, err := strconv.Atoi(column[1])
+	if err != nil {
+		return -1, fmt.Errorf("read stored embedding dimensions: %w", err)
+	}
+	if storedDimensions != s.dimensions {
+		// Keep existing vectors until the user requests a reindex. Initialization
+		// must still succeed so the live indexer can rebuild this store.
+		log.Warn().Int("stored_dimensions", storedDimensions).Int("configured_dimensions", s.dimensions).
+			Msg("vector store dimensions differ from semantic_search.dimensions. Run `hister reindex` to rebuild embeddings")
+	}
 	if strings.Contains(normalizedSchema, "distance_metric=cosine") {
 		return -1, nil
 	}
@@ -146,7 +164,9 @@ func (s *sqliteVectorStore) initEmbeddingsTable(tx *sql.Tx) (int64, error) {
 	if _, err := tx.Exec(`DROP TABLE embeddings`); err != nil {
 		return -1, fmt.Errorf("drop L2 embeddings table: %w", err)
 	}
-	if err := s.createEmbeddingsTable(tx); err != nil {
+	// A distance metric migration preserves vectors and their original size.
+	// Only a reindex can replace them with vectors of a different size.
+	if err := s.createEmbeddingsTable(tx, storedDimensions); err != nil {
 		return -1, err
 	}
 	restoreResult, err := tx.Exec(`INSERT INTO embeddings(user_id, chunk_key, embedding)
@@ -294,12 +314,27 @@ func (s *sqliteVectorStore) searchUser(vector []float32, topK int, threshold flo
 }
 
 func (s *sqliteVectorStore) Clear() error {
-	if _, err := s.db.Exec(`DELETE FROM embeddings`); err != nil {
-		return fmt.Errorf("clear embeddings: %w", err)
+	tx, err := s.db.Begin()
+	if err != nil {
+		return fmt.Errorf("begin vector store rebuild: %w", err)
+	}
+	defer func() {
+		_ = tx.Rollback()
+	}()
+	// vec0 column dimensions cannot be altered. Recreate the table so reindex
+	// also applies dimension changes from the semantic search configuration.
+	if _, err := tx.Exec(`DROP TABLE embeddings`); err != nil {
+		return fmt.Errorf("drop embeddings table: %w", err)
 	}
-	if _, err := s.db.Exec(`DELETE FROM chunk_meta`); err != nil {
+	if err := s.createEmbeddingsTable(tx, s.dimensions); err != nil {
+		return err
+	}
+	if _, err := tx.Exec(`DELETE FROM chunk_meta`); err != nil {
 		return fmt.Errorf("clear chunk_meta: %w", err
```

**File**: `webui/website/src/content/docs/configuration.md` (modified, +2/-0)
```diff
@@ -750,6 +750,8 @@ The vector store backend is chosen automatically based on `server.database`:
 - **SQLite** (default) stores vectors in a separate `vectors.sqlite3` file in the same directory as the main database, using the [sqlite-vec](https://github.com/asg017/sqlite-vec) extension. No extra setup required.
 - **PostgreSQL** stores vectors in the same database as the main data using the [pgvector](https://github.com/pgvector/pgvector) extension. Hister uses an HNSW index with the `vector` type, which supports at most 2000 dimensions. Make sure `pgvector` is installed and enabled (`CREATE EXTENSION vector;`) before starting Hister.
 
+Set `semantic_search.dimensions` to the output size supported by your embedding endpoint. If the endpoint returns a different size, Hister rejects the embeddings. After changing dimensions with SQLite, restart Hister and run `hister reindex` to rebuild the vector table and regenerate embeddings. Existing vectors are preserved until reindexing begins, and startup logs report when the stored dimensions differ from the configuration.
+
 ### Example
 
 ```yaml
```

---

### Incident Patch 9: `488c2079` (2026-09-22)
**Commit Message**: [fix] clarify add functionality on the webui

**File**: `webui/app/src/routes/+page.svelte` (modified, +3/-3)
```diff
@@ -2959,7 +2959,7 @@
               Start building your index
             </h2>
             <p class="font-inter text-text-brand-secondary text-sm">
-              Choose any option to add your first searchable page.
+              Choose how to add your first searchable document.
             </p>
           </div>
           <a
@@ -2997,9 +2997,9 @@
           >
             <Link2 class="text-hister-coral size-5 shrink-0" />
             <span class="min-w-0">
-              <span class="font-outfit text-text-brand block font-bold">Add one page</span>
+              <span class="font-outfit text-text-brand block font-bold">Add manually</span>
               <span class="font-inter text-text-brand-muted block text-xs"
-                >Paste a URL to index it now</span
+                >Save a URL with optional title and content</span
               >
             </span>
           </a>
```

**File**: `webui/app/src/routes/add/+page.svelte` (modified, +24/-5)
```diff
@@ -9,11 +9,11 @@
   import { Button } from '@hister/components/ui/button';
   import * as Card from '@hister/components/ui/card';
   import * as Alert from '@hister/components/ui/alert';
-  import { PageHeader } from '@hister/components';
   import AlertCircle from '@lucide/svelte/icons/circle-alert';
   import CheckCircle from '@lucide/svelte/icons/circle-check';
   import {
     Database,
+    ExternalLink,
     Eye,
     FileText,
     Link,
@@ -155,10 +155,10 @@
                 <Card.Title
                   class="font-space text-card-foreground text-xl font-extrabold uppercase"
                 >
-                  Add document
+                  Add document manually
                 </Card.Title>
                 <Card.Description class="font-inter text-text-brand-secondary text-sm">
-                  Enter a URL and optionally add searchable title and content.
+                  Save a URL with optional title and content.
                 </Card.Description>
               </div>
             </div>
@@ -191,6 +191,25 @@
         </Card.Header>
 
         <Card.Content class="p-0">
+          <div class="bg-muted-surface border-border-brand space-y-2 border-b px-4 py-3 md:px-5">
+            <p class="font-inter text-text-brand-secondary text-sm">
+              This form saves only the information you enter. It does not download the page.
+            </p>
+            <p class="font-inter text-text-brand-secondary text-sm">
+              To capture page content automatically as you browse,
+              <a
+                href="https://hister.org/docs/browser-extension"
+                target="_blank"
+                rel="noopener noreferrer"
+                class="text-hister-indigo font-semibold underline underline-offset-2"
+              >
+                set up the browser extension<ExternalLink
+                  class="ml-1 inline size-3.5 align-baseline"
+                  aria-hidden="true"
+                />
+              </a>.
+            </p>
+          </div>
           <form id="add-entry-form" onsubmit={handleSubmit} class="divide-border-brand divide-y">
             <div class="grid gap-3 p-4 md:grid-cols-[12rem_minmax(0,1fr)] md:p-5">
               <div class="flex items-start gap-2">
@@ -222,7 +241,7 @@
                   class="focus-visible:border-hister-coral [font-variant-ligatures:none]"
                 />
                 <p id="entry-url-help" class="font-inter text-text-brand-muted text-xs">
-                  Hister stores this URL but does not download the page from this form.
+                  The address to save in your index
                 </p>
               </div>
             </div>
@@ -290,7 +309,7 @@
                 />
                 <div class="flex items-center justify-between gap-3">
                   <p id="entry-content-help" class="font-inter text-text-brand-muted text-xs">
-                    Searchable plain text for the document
+                    Paste the text you want to search later
                   </p>
                   <span class="font-fira text-text-brand-muted shrink-0 text-xs">
                     {contentChars.toLocaleString()} chars
```

---

### Incident Patch 10: `bb406be8` (2026-09-21)
**Commit Message**: [fix] do not duplicate lobsters comments - fixes #771

**File**: `server/extractor/extractors/lobsters/lobsters.go` (modified, +6/-3)
```diff
@@ -12,7 +12,10 @@ import (
 	"github.com/asciimoo/hister/server/sanitizer"
 )
 
-const matchURLPrefix = "https://lobste.rs/s/"
+const (
+	matchURLPrefix           = "https://lobste.rs/s/"
+	topLevelCommentsSelector = "#story_comments > ol.comments > li.comments_subtree"
+)
 
 type LobstersExtractor struct {
 	sdk.ConfigSupport
@@ -51,7 +54,7 @@ func (e *LobstersExtractor) Extract(d *sdk.Document) sdk.ExtractResult {
 		b.WriteString("\n\n")
 		b.WriteString(body)
 	}
-	doc.Find("#story_comments > ol.comments > li.comments_subtree").Each(func(_ int, s *goquery.Selection) {
+	doc.Find(topLevelCommentsSelector).Each(func(_ int, s *goquery.Selection) {
 		writeCommentText(&b, s, 0)
 	})
 
@@ -114,7 +117,7 @@ func (e *LobstersExtractor) Preview(d *sdk.Document) sdk.PreviewResult {
 		b.WriteString(body)
 	}
 
-	comments := doc.Find("ol.comments > li.comments_subtree")
+	comments := doc.Find(topLevelCommentsSelector)
 	if comments.Length() > 0 {
 		b.WriteString("<h2>Comments</h2>")
 		b.WriteString(`<ol class="comments">`)
```

#### Recent Merged Pull Requests:
- **PR #799** (2026-09-30): Update Nix hashes (@github-actions[bot])
- **PR #797** (2026-09-29): Bump the npm-deps group with 8 updates (@dependabot[bot])
- **PR #796** (2026-09-29): Bump node from `dbaa92e` to `0b36e8c` (@dependabot[bot])
- **PR #795** (2026-09-28): Bump charm.land/bubbletea/v2 from 2.0.9 to 2.0.10 in the go-deps group (@dependabot[bot])
- **PR #794** (2026-09-29): Bump golang from `4cb7ac9` to `8a5910f` (@dependabot[bot])
- **PR #793** (2026-09-29): Bump alpine from `28bd5fe` to `294b683` (@dependabot[bot])
- **PR #792** (2026-09-29): Bump nixpkgs from `a32edd7` to `34ca302` in the nix-deps group (@dependabot[bot])
- **PR #781** (2026-09-22): tui: Fix stale "Search is offline" message when first connected (@j-mie)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

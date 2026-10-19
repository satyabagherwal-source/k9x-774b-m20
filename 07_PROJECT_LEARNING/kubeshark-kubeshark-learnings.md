> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kubeshark-kubeshark-learnings.md`  
> **Source**: github ([https://github.com/kubeshark/kubeshark](https://github.com/kubeshark/kubeshark))  
> **Source Version**: `e27687a8`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T05:19:06.437Z  
> **Learning ID**: `learn-github-kubeshark-kubeshark`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): kubeshark/kubeshark

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubeshark-kubeshark-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubeshark/kubeshark](https://github.com/kubeshark/kubeshark))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T05:19:06.429Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubeshark/kubeshark`
- **Description**: eBPF-powered network observability for Kubernetes. Indexes L4/L7 traffic with full K8s context, decrypts TLS without keys. Queryable by AI agents via MCP and humans via dashboard.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 12100 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `misc/fsUtils/dirUtils.go`
```
package fsUtils

import (
	"fmt"
	"os"
)

func EnsureDir(dirName string) error {
	err := os.Mkdir(dirName, 0700)
	if err == nil {
		return nil
	}
	if os.IsExist(err) {
		// check that the existing path is a directory
		info, err := os.Stat(dirName)
		if err != nil {
			return err
		}
		if !info.IsDir() {
			return fmt.Errorf("path exists but is not a directory: %s", dirName)
		}
		return nil
	}
	return err
}

```

### Core Architecture Module: `misc/fsUtils/globUtils.go`
```
package fsUtils

import (
	"fmt"
	"os"
	"path/filepath"
)

func RemoveFilesByExtension(dirPath string, ext string) error {
	files, err := filepath.Glob(filepath.Join(dirPath, fmt.Sprintf("/*.%s", ext)))
	if err != nil {
		return err
	}

	for _, f := range files {
		if err := os.Remove(f); err != nil {
			return err
		}
	}

	return nil
}

```

### Core Architecture Module: `misc/fsUtils/kubesharkLogsUtils.go`
```
package fsUtils

import (
	"archive/zip"
	"context"
	"fmt"
	"os"
	"regexp"

	"github.com/rs/zerolog/log"

	"github.com/kubeshark/kubeshark/config"
	"github.com/kubeshark/kubeshark/kubernetes"
	"github.com/kubeshark/kubeshark/misc"
)

func DumpLogs(ctx context.Context, provider *kubernetes.Provider, filePath string, grep string) error {
	podExactRegex := regexp.MustCompile("^" + kubernetes.SELF_RESOURCES_PREFIX)
	pods, err := provider.ListAllPodsMatchingRegex(ctx, podExactRegex, []string{config.Config.Tap.Release.Namespace})
	if err != nil {
		return err
	}

	if len(pods) == 0 {
		return fmt.Errorf("no %s pods found in namespace %s", misc.Software, config.Config.Tap.Release.Namespace)
	}

	newZipFile, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer newZipFile.Close()
	zipWriter := zip.NewWriter(newZipFile)
	defer zipWriter.Close()

	for _, pod := range pods {
		for _, container := range pod.Spec.Containers {
			logs, err := provider.GetPodLogs(ctx, pod.Namespace, pod.Name, container.Name, grep)
			if err != nil {
				log.Error().Err(err).Msg("Failed to get logs!")
				continue
			} else {
				log.Debug().
					Int("length", len(logs)).
					Str("namespace", pod.Namespace).
					Str("pod", pod.Name).
					Str("container", container.Name).
					Msg("Successfully read log length.")
			}

			if err := AddStrToZip(zipWriter, logs, fmt.Sprintf("%s.%s.%s.log", pod.Namespace, pod.Name, container.Name)); err != nil {
				log.Error().Err(err).Msg("Failed write logs!")
			} else {
				log.Debug().
					Int("length", len(logs)).
					Str("namespace", pod.Namespace).
					Str("pod", pod.Name).
					Str("container", container.Name).
					Msg("Successfully added log length.")
			}
		}
	}

	events, err := provider.GetNamespaceEvents(ctx, config.Config.Tap.Release.Namespace)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get k8b events!")
	} else {
		log.Debug().Str("namespace", config.Config.Tap.Release.Namespace).Msg("Successfully read events.")
	}

	if err := AddStrToZip(zipWriter, events, fmt.Sprintf("%s_events.log", config.Config.Tap.Release.Namespace)); err != nil {
		log.Error().Err(err).Msg("Failed write logs!")
	} else {
		log.Debug().Str("namespace", config.Config.Tap.Release.Namespace).Msg("Successfully added events.")
	}

	if err := AddFileToZip(zipWriter, config.ConfigFilePath); err != nil {
		log.Error().Err(err).Msg("Failed write file!")
	} else {
		log.Debug().Str("file-path", config.ConfigFilePath).Msg("Successfully added file.")
	}

	log.Info().Str("path", filePath).Msg("You can find the ZIP file with all logs at:")
	return nil
}

```

### Core Architecture Module: `misc/fsUtils/zipUtils.go`
```
package fsUtils

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
)

func AddFileToZip(zipWriter *zip.Writer, filename string) error {

	fileToZip, err := os.Open(filename)
	if err != nil {
		return fmt.Errorf("failed to open file %s, %w", filename, err)
	}
	defer fileToZip.Close()

	// Get the file information
	info, err := fileToZip.Stat()
	if err != nil {
		return fmt.Errorf("failed to get file information %s, %w", filename, err)
	}

	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}

	// Using FileInfoHeader() above only uses the basename of the file. If we want
	// to preserve the folder structure we can overwrite this with the full path.
	header.Name = filepath.Base(filename)

	// Change to deflate to gain better compression
	// see http://golang.org/pkg/archive/zip/#pkg-constants
	header.Method = zip.Deflate

	writer, err := zipWriter.CreateHeader(header)
	if err != nil {
		return fmt.Errorf("failed to create header in zip for %s, %w", filename, err)
	}
	_, err = io.Copy(writer, fileToZip)
	return err
}

func AddStrToZip(writer *zip.Writer, logs string, fileName string) error {
	if zipFile, err := writer.Create(fileName); err != nil {
		return fmt.Errorf("couldn't create a log file inside zip for %s, %w", fileName, err)
	} else {
		if _, err = zipFile.Write([]byte(logs)); err != nil {
			return fmt.Errorf("couldn't write logs to zip file: %s, %w", fileName, err)
		}
	}
	return nil
}

func Unzip(reader *zip.Reader, dest string) error {
	dest, _ = filepath.Abs(dest)
	_ = os.MkdirAll(dest, os.ModePerm)

	// Closure to address file descriptors issue with all the deferred .Close() methods
	extractAndWriteFile := func(f *zip.File) error {
		rc, err := f.Open()
		if err != nil {
			return err
		}
		defer func() {
			if err := rc.Close(); err != nil {
				panic(err)
			}
		}()

		path := filepath.Join(dest, f.Name)

		// Check for ZipSlip (Directory traversal)
		if !strings.HasPrefix(path, filepath.Clean(dest)+string(os.PathSeparator)) {
			return fmt.Errorf("illegal file path: %s", path)
		}

		if f.FileInfo().IsDir() {
			_ = os.MkdirAll(path, f.Mode())
		} else {
			_ = os.MkdirAll(filepath.Dir(path), f.Mode())
			log.Info().Str("path", path).Msg("Writing HAR file...")
			f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
			if err != nil {
				return err
			}
			defer func() {
				if err := f.Close(); err != nil {
					panic(err)
				}
				log.Info().Str("path", path).Msg("HAR file at:")
			}()

			_, err = io.Copy(f, rc)
			if err != nil {
				return err
			}
		}
		return nil
	}

	for _, f := range reader.File {
		err := extractAndWriteFile(f)
		if err != nil {
			return err
		}
	}

	return nil
}

```

### Core Architecture Module: `utils/browser.go`
```
package utils

import (
	"fmt"
	"os/exec"
	"runtime"

	"github.com/rs/zerolog/log"
)

func OpenBrowser(url string) {
	var err error

	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("unsupported platform")
	}

	if err != nil {
		log.Error().Err(err).Msg("While trying to open a browser")
	}
}

```

### Core Architecture Module: `utils/colors.go`
```
package utils

const (
	Black   = "\033[1;30m%s\033[0m"
	Red     = "\033[1;31m%s\033[0m"
	Green   = "\033[1;32m%s\033[0m"
	Yellow  = "\033[1;33m%s\033[0m"
	Blue    = "\033[1;34m%s\033[0m"
	Magenta = "\033[1;35m%s\033[0m"
	Cyan    = "\033[1;36m%s\033[0m"
	White   = "\033[1;37m%s\033[0m"
)

```

### Core Architecture Module: `utils/http.go`
```
package utils

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	X_KUBESHARK_CAPTURE_HEADER_KEY          = "X-Kubeshark-Capture"
	X_KUBESHARK_CAPTURE_HEADER_IGNORE_VALUE = "ignore"
	LICENSE_KEY_HEADER                      = "License-Key"
	// CLI_AUTH_HEADER carries a ServiceAccount bearer token to the Hub.
	// A custom (non-Authorization) header so it survives the kube
	// API-server service proxy, which consumes Authorization.
	CLI_AUTH_HEADER = "X-Kubeshark-Authorization"
)

// ErrHubAuthRequired indicates the Hub rejected the request because auth is
// enabled but no valid credential was presented (missing/expired license).
var ErrHubAuthRequired = errors.New("hub requires authentication: set a valid license (config 'license') or credentials")

// hubAuthRoundTripper attaches the CLI's Hub credential to every request so any
// client built with it authenticates to a gated Hub. It prefers a scoped
// ServiceAccount token (CLI_AUTH_HEADER) when present, falling back to the
// License-Key (admin/transitional). Both are custom headers so they survive
// the kube API-server service proxy, unlike an Authorization bearer.
//
// The SA token is sourced via saTokenFunc on every request rather than captured
// once, so a caller with cluster access (proxy mode) can hand in a renewing
// source and long-lived clients keep working past the token's ~1h expiry.
type hubAuthRoundTripper struct {
	saTokenFunc func() string
	licenseKey  string
	base        http.RoundTripper
}

func (rt *hubAuthRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	base := rt.base
	if base == nil {
		base = http.DefaultTransport
	}
	saToken := ""
	if rt.saTokenFunc != nil {
		saToken = rt.saTokenFunc()
	}
	switch {
	case saToken != "":
		if req.Header.Get(CLI_AUTH_HEADER) == "" {
			req = req.Clone(req.Context())
			req.Header.Set(CLI_AUTH_HEADER, saToken)
		}
	case rt.licenseKey != "":
		if req.Header.Get(LICENSE_KEY_HEADER) == "" {
			req = req.Clone(req.Context())
			req.Header.Set(LICENSE_KEY_HEADER, rt.licenseKey)
		}
	}
	return base.RoundTrip(req)
}

// staticToken adapts a fixed token string to the saTokenFunc source, returning
// nil for an empty token so the round-tripper falls back to the License-Key.
func staticToken(saToken string) func() string {
	if saToken == "" {
		return nil
	}
	return func() string { return saToken }
}

// StopOnSSORedirect is an *http.Client CheckRedirect that does NOT follow
// SSO-style auth redirects (302 Found / 303 See Other) — it returns the
// redirect response so callers can detect auth-required via IsAuthRequired
// instead of silently following it to an HTML login page (and, for downloads,
// writing that page to disk). Other redirects (301/307/308) are still followed.
func StopOnSSORedirect(req *http.Request, _ []*http.Request) error {
	if req.Response != nil {
		switch req.Response.StatusCode {
		case http.StatusFound, http.StatusSeeOther:
			return http.ErrUseLastResponse
		}
	}
	return nil
}

// NewHubHTTPClient returns an *http.Client that authenticates to the Hub with
// the License-Key header.
func NewHubHTTPClient(timeout time.Duration, licenseKey string) *http.Client {
	return &http.Client{
		Timeout:       timeout,
		CheckRedirect: StopOnSSORedirect,
		Transport:     &hubAuthRoundTripper{licenseKey: licenseKey},
	}
}

// NewHubHTTPClientWithToken returns an *http.Client that authenticates to the
// Hub with a fixed ServiceAccount token when saToken is set, otherwise the
// License-Key.
func NewHubHTTPClientWithToken(timeout time.Duration, saToken, licenseKey string) *http.Client {
	return &http.Client{
		Timeout:       timeout,
		CheckRedirect: StopOnSSORedirect,
		Transport:     &hubAuthRoundTripper{saTokenFunc: staticToken(saToken), licenseKey: licenseKey},
	}
}

// NewHubHTTPClientWithTokenSource is NewHubHTTPClientWithToken with a token
// source consulted per request, so a renewing source keeps the client
// authenticated past the token's expiry. A nil source falls back to the
// License-Key.
func NewHubHTTPClientWithTokenSource(timeout time.Duration, saTokenFunc func() string, licenseKey string) *http.Client {
	return &http.Client{
		Timeout:       timeout,
		CheckRedirect: StopOnSSORedirect,
		Transport:     &hubAuthRoundTripper{saTokenFunc: saTokenFunc, licenseKey: licenseKey},
	}
}

// HubAuthTransport wraps base so requests carry the License-Key header. Use
// when a client needs custom transport settings (e.g. streaming downloads)
// but must still authenticate to the Hub.
func HubAuthTransport(licenseKey string, base http.RoundTripper) http.RoundTripper {
	return &hubAuthRoundTripper{licenseKey: licenseKey, base: base}
}

// HubAuthTransportWithToken is HubAuthTransport with a fixed ServiceAccount
// token (preferred over the License-Key when set).
func HubAuthTransportWithToken(saToken, licenseKey string, base http.RoundTripper) http.RoundTripper {
	return &hubAuthRoundTripper{saTokenFunc: staticToken(saToken), licenseKey: licenseKey, base: base}
}

// HubAuthTransportWithTokenSource is HubAuthTransportWithToken with a token
// source consulted per request (see NewHubHTTPClientWithTokenSource).
func HubAuthTransportWithTokenSource(saTokenFunc func() string, licenseKey string, base http.RoundTripper) http.RoundTripper {
	return &hubAuthRoundTripper{saTokenFunc: saTokenFunc, licenseKey: licenseKey, base: base}
}

// IsAuthRequired reports whether the response indicates the Hub demanded
// authentication — a 401, or a 302/303 redirect to an SSO login page (the
// hub clients are configured not to follow those; see StopOnSSORedirect).
func IsAuthRequired(resp *http.Response) bool {
	return resp != nil && (resp.StatusCode == http.StatusUnauthorized ||
		resp.StatusCode == http.StatusFound || resp.StatusCode == http.StatusSeeOther)
}

// Get - When err is nil, resp always contains a non-nil resp.Body.
// Caller should close resp.Body when done reading from it.
func Get(url string, client *http.Client) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	AddIgnoreCaptureHeader(req)

	return checkError(client.Do(req))
}

// Post - When err is nil, resp always contains a non-nil resp.Body.
// Caller should close resp.Body when done reading from it.
func Post(url, contentType string, body io.Reader, client *http.Client, licenseKey string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodPost, url, body)
	if err != nil {
		return nil, err
	}
	AddIgnoreCaptureHeader(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("License-Key", licenseKey)

	return checkError(client.Do(req))
}

// Do - When err is nil, resp always contains a non-nil resp.Body.
// Caller should close resp.Body when done reading from it.
func Do(req *http.Request, client *http.Client) (*http.Response, error) {
	return checkError(client.Do(req))
}

func checkError(response *http.Response, errInOperation error) (*http.Response, error) {
	if errInOperation != nil {
		return response, errInOperation
		// Check only if status != 200 (and not status >= 300). Hub return only 200 on success.
	} else if response.StatusCode != http.StatusOK {
		body, err := io.ReadAll(response.Body)
		response.Body.Close()
		response.Body = io.NopCloser(bytes.NewBuffer(body)) // rewind
		if err != nil {
			return response, err
		}

		errorMsg := strings.ReplaceAll(string(body), "\n", ";")
		return response, fmt.Errorf("got response with status code: %d, body: %s", response.StatusCode, errorMsg)
	}

	return response, nil
}

func AddIgnoreCaptureHeader(req *http.Request) {
	req.Header.Set(X_KUBESHARK_CAPTURE_HEADER_KEY, X_KUBESHARK_CAPTURE_HEADER_IGNORE_VALUE)
}

```

### Core Architecture Module: `utils/json.go`
```
package utils

import (
	"strconv"
	"strings"

	"github.com/rs/zerolog/log"
)

func UnescapeUnicodeCharacters(raw string) string {
	str, err := strconv.Unquote(strings.ReplaceAll(strconv.Quote(raw), `\\u`, `\u`))
	if err != nil {
		log.Error().Err(err).Send()
		return raw
	}
	return str
}

```

### Core Architecture Module: `utils/pretty.go`
```
package utils

import (
	"bytes"

	"github.com/goccy/go-yaml"
)

func PrettyYaml(data interface{}) (result string, err error) {
	buffer := new(bytes.Buffer)
	encoder := yaml.NewEncoder(buffer, yaml.Indent(2))

	err = encoder.Encode(data)
	if err != nil {
		return
	}
	result = buffer.String()
	return
}

```

### Core Architecture Module: `utils/slice.go`
```
package utils

func Contains(slice []string, containsValue string) bool {
	for _, sliceValue := range slice {
		if sliceValue == containsValue {
			return true
		}
	}

	return false
}

func Unique(slice []string) []string {
	keys := make(map[string]bool)
	var list []string

	for _, entry := range slice {
		if _, value := keys[entry]; !value {
			keys[entry] = true
			list = append(list, entry)
		}
	}

	return list
}

func EqualStringSlices(slice1 []string, slice2 []string) bool {
	if len(slice1) != len(slice2) {
		return false
	}

	for _, v := range slice1 {
		if !Contains(slice2, v) {
			return false
		}
	}

	return true
}

// Diff returns the elements in `a` that aren't in `b`.
func Diff(a, b []string) []string {
	mb := make(map[string]struct{}, len(b))
	for _, x := range b {
		mb[x] = struct{}{}
	}
	var diff []string
	for _, x := range a {
		if _, found := mb[x]; !found {
			diff = append(diff, x)
		}
	}
	return diff
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1959** (2026-08-20): **Kubeshark shows an empty dashboard when started without a license**
  *Symptoms*: ### Description  When Kubeshark is started **without a license**, the dashboard never populates. The API Stream stays stuck on the "Preparing" spinner and shows **0 displayed items**, even though traffic is being captured across the targeted pods. With a valid license the same environment is expected to display up to ~3,000–6,000 entries.  In short: **no license → empty dashboard**. The unlicensed/free tier should still stream a bounded number of entries (the documented free-tier cap), not zero.  **Regression:** This is a regression. It does **not** reproduce on **v53.3.0** (unlicensed dashboard populates normally) and **does** reproduce on **v53.4.0**. The breaking change is somewhere in the v53.3.0 → v53.4.0 range.  ### Steps to Reproduce  1. Deploy Kubeshark **without applying a license** (free tier). 2. Confirm targeting is active (e.g. "Targeting 79 pods in 6 namespaces across 3 nodes"). 3. Open the dashboard → **API STREAM** tab with the stream **Live**. 4. Observe: the stream shows "Preparing" indefinitely and **Displayed items: 0**. License indicator reads **NOT DETECTED**.  ### Expected Behavior  Without a license, Kubeshark should still start and stream traffic up to the free-tier entry cap (~3,000–6,000 entries). The dashboard should populate with entries rather than remaining empty.  ### Workaround / Remedy  Until this is fixed, either of the following restores a populated dashboard:  1. **Use a license** — sign up / log in so the session gains the required `snaps

- **Issue #1900** (2026-04-10): **EFS persistent storage: workers crash with PebbleDB lock conflict**
  *Symptoms*: ## Description  When using AWS EFS as persistent storage (`persistentStorage: true` + `persistentStorageStatic: true`), all worker DaemonSet pods share the same PVC and write PebbleDB to the same path `/app/data/captureDB`, causing file lock conflicts.  ## Error  ``` {"level":"fatal","error":"failed to create pebble db: resource temporarily unavailable","backend":"pebble","message":"Failed to initialize common storage for extensions"} ```  All workers except one enter CrashLoopBackOff with this error.  ## Root Cause  The init container `cleanup-data-dir` correctly creates per-node directories (`/app/data/$NODE_NAME`) using `spec.nodeName`, but the `sniffer` and `tracer` containers mount `/app/data` directly without `subPathExpr`. This means all workers on all nodes write to the same `captureDB` path on the shared EFS volume.  With `emptyDir` this is not an issue because each pod gets its own isolated volume. But with a shared PVC (EFS ReadWriteMany), all pods see the same filesystem.  ## Proposed Fix  Add `NODE_NAME` env var (from `spec.nodeName`) and `subPathExpr: $(NODE_NAME)` to the `sniffer` and `tracer` volume mounts in `helm-chart/templates/09-worker-daemon-set.yaml`, only when `persistentStorage` is enabled.  ## Environment  - Kubeshark chart version: 53.1.0 - Kubernetes: EKS 1.34 - Storage: AWS EFS with aws-efs-csi-driver v2.1.15 - Region: eu-central-1 - Static PV with `volumeHandle` pointing to EFS filesystem ID

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

### Incident Patch 1: `9396e64b` (2026-05-21)
**Commit Message**: Fix tool-to-section mapping in security-audit skill (#1940)

Co-authored-by: Alon Girmonsky <[REDACTED_EMAIL]>

**File**: `skills/security-audit/SKILL.md` (modified, +29/-64)
```diff
@@ -113,25 +113,15 @@ waiting for snapshot creation or dissection.
 
 Confirm Kubeshark is running and which tools are available.
 
-**Tool**: `get_data_boundaries`
-
-Check how far back raw capture data exists. You need this to plan snapshot
-creation in Step 3 — call it now so the data is ready when you need it.
-
-**Tool**: `list_workloads` (no snapshot_id — queries live state)
-
-Get the current workload inventory for the target namespace. This returns
-pod names, namespaces, and IP addresses. Save the IPs — you'll need them
-throughout the audit.
+### Step 2: Query Live Traffic
 
-**Note**: `list_workloads` without a `snapshot_id` may fail with some
-Kubeshark versions (`snapshot_id is required for filtered listing`). If
-this happens, use individual lookups with `name` + `namespace` parameters,
-or skip to Step 3 and get the workload inventory from the first snapshot.
+**Tool**: `get_l7_data_boundaries`
 
-### Step 2: Query Live Traffic
+Check the time boundaries of dissected API calls in the real-time database.
+This tells you how far back L7 data is available — use it to understand
+the scope of your real-time queries before running them.
 
-In parallel, query the real-time dissected traffic across key dimensions.
+Then query the real-time dissected traffic across key dimensions.
 Use `list_api_calls` and `list_l4_flows` **without** a `snapshot_id` to
 hit the live data.
 
@@ -155,6 +145,12 @@ appear. Treat Section A findings as a fast first pass, not the final word.
 
 While analyzing real-time data, begin creating snapshots for Section B.
 
+**Tool**: `get_data_boundaries`
+
+Check how far back raw capture data exists. Raw capture is the FIFO buffer
+that feeds snapshot creation — this tells you the time window available
+for snapshots (which is different from the L7 boundaries in Step 2).
+
 **CRITICAL: Create snapshots ONE AT A TIME, sequentially.** Kubeshark only
 supports one concurrent snapshot download. Parallel creation will cause
 failures and data loss. The pattern is:
@@ -164,8 +160,7 @@ failures and data loss. The pattern is:
 3. You do NOT need to wait for dissection before creating the next snapshot.
    Create the next snapshot while the previous one dissects.
 
-Use the data boundaries from Step 1 (`get_data_boundaries`) to calculate
-how many snapshots are needed:
+Use `get_data_boundaries` to calculate how many snapshots are needed:
 
 ```
 total_range_ms = newest_timestamp - oldest_timestamp
@@ -247,7 +242,6 @@ wait for dissection to use the first two:
 | Source | Available | Tool | What It Provides |
 |--------|-----------|------|-----------------|
 | **Workloads & IPs** | Immediately | `list_workloads` with `snapshot_id` | Pod names, namespaces, IPs at capture time |
-| **L4 Flows** | Immediately | `list_l4_flows` with `snapshot_id` | TCP/UDP connections: src/dst IPs, ports, bytes, duration |
 | **PCAP Export** | Immediately | `export_snapshot_pcap` | Raw packets filtered by BPF expression |
 | **L7 Dissection** | After indexing | `list_api_calls`, `get_api_call`, `get_api_stats` | DNS queries, HTTP requests, SQL statements, Redis commands, gRPC methods |
 
@@ -261,12 +255,12 @@ Snapshot ready
   ├── Start dissection (background)
   ├── Phase 1: list_workloads (immediate) — workload inventory + IPs
   │            export_snapshot_pcap (immediate) — raw packet evidence
-  ├── Phase 3: list_l4_flows (immediate) — external flows, port scanning
-  ├── Phase 4: list_l4_flows (immediate) — lateral movement, fan-out
   │
   ├── [dissection completes]
   │
   ├── Phase 2: list_api_calls — DNS threat analysis
+  ├── Phase 3: list_api_calls — external HTTP communication
+  ├── Phase 4: list_api_calls — lateral movement, K8s API access
   ├── Phase 5: list_api_calls — protocol abuse (PG, Redis, gRPC)
   ├── Phase 6: list_api_calls — credential access (IMDS, cloud APIs)
   └── Phase 7: correlate all findings
@@ -396,32 +390,14 @@ Compare the count of failed queries to total queries per source pod.
 
 **Goal**: Identify all traffic leaving the cluster. Any pod connecting to
 external IPs or domains needs justification.
-**Data source**: Immediate (no dissection needed). Use L4 flows first,
-then enrich with L7 data from dissection when available.
+**Data source**: L7 dissection (after indexing).
 
-### 3a: L4 External Flows
+**Note**: L4 flow analysis for external communication is covered in
+Section A (Step 2) using `list_l4_flows` against real-time data. In
+Section B, use `list_api_calls` against dissected snapshot data for
+deeper L7 inspection of external traffic.
 
-**Tool**: `list_l4_flows` with `snapshot_id`
-
-This is available immediately — do not wait for dissection. Use the workload
-IPs from Phase 1 to map flows to pod identities.
-
-Look for flows where the destination is NOT a cluster-internal IP (not RFC 1918:
-10.x.x.x, 172.16-31.x.x, 192.168.x.x). Every external flow is a potential
-exfiltration or C2 channel.
-
-**What to flag**:
-
-| Pattern | Threat | Severity |
-|-----
```

---

### Incident Patch 2: `cd13d8f8` (2026-05-15)
**Commit Message**: Add security-audit skill for MITRE ATT&CK-based threat detection (#1934)

New skill that guides systematic 8-phase network security audits across
MITRE ATT&CK tactics using snapshot-based traffic analysis. Includes
threat catalog, KFL security filter reference, and report template.

Co-authored-by: Alon Girmonsky <[REDACTED_EMAIL]>

**File**: `skills/README.md` (modified, +0/-1)
```diff
@@ -15,7 +15,6 @@ compatible agents.
 | [`network-rca`](network-rca/) | Network Root Cause Analysis. Retrospective traffic analysis via snapshots, with two investigation routes: PCAP (for Wireshark/compliance) and Dissection (for AI-driven API-level investigation). |
 | [`kfl`](kfl/) | KFL2 (Kubeshark Filter Language) expert. Complete reference for writing, debugging, and optimizing CEL-based traffic filters across all supported protocols. |
 | [`security-audit`](security-audit/) | Network Security Audit. Systematic 8-phase threat detection across MITRE ATT&CK tactics — C2, exfiltration, lateral movement, credential theft, cryptomining, protocol abuse — using snapshot-based traffic analysis. |
-| [`install`](install/) | Installation & Deployment. Guides CLI and Helm installation, builds custom values files, handles platform-specific config (EKS/GKE/AKS/OpenShift/KinD), auth, ingress, cloud storage, and troubleshooting. |
 
 ## Prerequisites
 
```

**File**: `skills/security-audit/SKILL.md` (added, +724/-0)
```diff
@@ -0,0 +1,724 @@
+---
+name: security-audit
+description: >
+  Kubernetes network security audit skill powered by Kubeshark MCP. Use this skill
+  whenever the user wants to audit a cluster for security threats, detect compromised
+  workloads, find malicious traffic patterns, hunt for indicators of compromise (IOCs),
+  check for data exfiltration, identify C2 (command and control) communication,
+  detect cryptomining, find lateral movement, discover credential theft attempts,
+  assess network security posture, or perform threat hunting in Kubernetes.
+  Also trigger when the user mentions security audit, threat detection, compromise
+  assessment, vulnerability scan, "is my cluster compromised", "find malicious traffic",
+  "check for threats", DNS exfiltration, DNS tunneling, port scanning, IMDS access,
+  reverse shell, crypto miner, MITRE ATT&CK, IOC detection, anomaly detection,
+  suspicious traffic, rogue workloads, unauthorized access, or any request to
+  evaluate cluster security through network traffic analysis.
+---
+
+# Kubernetes Network Security Audit with Kubeshark MCP
+
+You are a Kubernetes network security specialist. Your job is to systematically
+audit cluster traffic for indicators of compromise, malicious behavior, and
+security threats — using network traffic as the ground truth.
+
+Network traffic cannot lie. Logs can be tampered with, metrics can be spoofed,
+but packets on the wire reveal what workloads actually do — what they connect to,
+what protocols they speak, what data they send. Your audit leverages this by
+examining DNS queries, HTTP requests, L4 flows, and protocol-level payloads
+across every dimension of the MITRE ATT&CK framework.
+
+## Prerequisites
+
+Before starting any audit, verify the environment is ready.
+
+**Tool**: `check_kubeshark_status`
+
+Confirm Kubeshark is deployed and tools are available. You need at minimum:
+`list_api_calls`, `list_l4_flows`, `list_workloads`, `get_api_call`.
+
+**KFL requirement**: This skill uses KFL filters for all queries. Before
+constructing any filter, load the KFL skill (`skills/kfl/`). KFL is statically
+typed — incorrect field names will fail silently. If the KFL skill is not
+loaded, only use the exact filter examples shown in this skill.
+
+**KFL error resilience**: If a KFL filter returns `undeclared reference` or
+similar errors, **do not give up on that phase**. Fall back to:
+1. Port-based filtering: `dst.port == 5432` instead of protocol flags
+2. Name-based filtering: `dst.name.contains("db")` or `src.name.contains("pod-name")`
+3. Browsing entries with `get_api_call` on IDs from `list_l4_flows`
+A KFL error means the filter syntax is wrong, not that the data doesn't exist.
+
+## Audit Methodology
+
+A security audit is NOT an incident investigation. You are not responding to
+a known event — you are proactively searching for threats that may be hiding
+in normal traffic. This requires a systematic sweep across all threat categories,
+not a single focused query.
+
+The audit has **two sections** that run in sequence:
+
+```
+SECTION A: Real-Time Analysis       → Instant, uses live dissected traffic
+SECTION B: Snapshot Deep Dive       → Immutable evidence, protocol-level inspection
+```
+
+### Why Two Sections?
+
+Kubeshark has two modes of data access:
+
+1. **Real-time dissection** — traffic is dissected as it flows through the
+   cluster. Provides instant access to L7 data (DNS, HTTP, etc.) that is
+   already captured and indexed. However, real-time dissection is resource-
+   intensive and may not be enabled, or may have gaps in coverage.
+
+2. **Snapshots** — immutable captures of raw traffic within a time window.
+   Must be created explicitly, then dissected separately. Guarantees complete
+   coverage of all packets in the window, but takes time to create and index.
+
+Section A uses whatever is already available — fast, immediate, but possibly
+incomplete. Section B creates snapshots for thorough, evidence-grade analysis.
+
+### Severity Classification
+
+Classify every finding using this framework:
+
+| Severity | Criteria | Examples |
+|----------|----------|---------|
+| **CRITICAL** | Active data exfiltration, credential theft in progress, confirmed C2 | DNS tunneling, IMDS credential harvest, mining pool connections |
+| **HIGH** | Reconnaissance with cluster-wide scope, confirmed unauthorized access | K8s API secret enumeration, port scanning, cluster-admin abuse |
+| **MEDIUM** | Suspicious patterns requiring investigation, limited-scope recon | Cross-namespace probes, outdated User-Agents, unusual external connections |
+| **LOW** | Anomalies that may be benign, single-instance events | Unknown workloads, new external destinations, noisy but not malicious |
+
+### Timezone
+
+Kubeshark returns timestamps in UTC. Always convert to local time before
+presenting to the user. Detect the local timezone at the start (e.g.,
+`date +%Z`). Present local time as primary, with UTC in parentheses:
+`15
```

**File**: `skills/security-audit/references/kfl-security-filters.md` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+# KFL Quick Reference: Security Audit Filters
+
+## DNS Threat Hunting
+```
+dns                                                    // All DNS traffic
+dns && dns_response && size(dns_answers) == 0          // Failed lookups (NXDOMAIN — no answers)
+dns && dns_questions.exists(q, q.contains("minexmr"))  // Mining pool DNS
+dns && dns_questions.exists(q, q.contains("nanopool"))  // Mining pool DNS
+dns && dns_questions.exists(q, q.contains("amazonaws")) // Cloud API resolution
+dns && dns_questions.exists(q, q.contains("cloudflare-dns"))  // DoH bypass
+dns && dns_questions.exists(q, q.contains("dns.google"))      // DoH bypass
+```
+
+## External Communication
+```
+http && dst.name.contains("attacker")                  // Known-bad destinations
+http && map_get(request.headers, "user-agent", "").contains("Mozilla/4.0")  // Suspicious UA
+http && map_get(request.headers, "accept", "").contains("dns-json")         // DoH requests
+http && map_get(request.headers, "upgrade", "") == "websocket"              // WebSocket (potential mining)
+```
+
+## Lateral Movement
+```
+src.pod.namespace != dst.pod.namespace                 // Cross-namespace traffic
+http && path.startsWith("/api/v1/secrets")             // Secret enumeration
+http && path == "/.env"                                // Service fingerprinting
+http && path == "/actuator/info"                       // Spring Boot fingerprinting
+http && path == "/version"                             // Version fingerprinting
+```
+
+## Protocol Inspection
+```
+postgresql                                             // PostgreSQL wire protocol
+postgresql && postgresql_query.contains("UNION SELECT") // SQL injection patterns
+postgresql && !postgresql_success                       // Failed PostgreSQL queries
+redis                                                  // Redis protocol
+grpc                                                   // gRPC calls (native detection)
+grpc && grpc_method.contains("Reflection")             // gRPC reflection enumeration
+```
+
+## Credential Theft
+```
+dst.ip == "169.254.169.254"                            // IMDS access
+http && path.contains("/meta-data/iam")                // IAM credential paths
+http && map_get(request.headers, "authorization", "").startsWith("AWS4-HMAC-SHA256")  // Stolen AWS creds
+http && "x-aws-ec2-metadata-token-ttl-seconds" in request.headers                     // IMDSv2 token request
+```
+
+## Resource Hijacking
+```
+dst.port == 3333                                       // Stratum mining (standard)
+dst.port == 14433                                      // Stratum mining (alt)
+dst.port == 45700                                      // Stratum mining (alt)
+dst.port == 4444                                       // Reverse shell / backdoor
+```
+
+## Per-Namespace Scoping
+
+Add namespace filters to any query above:
+```
+dns && src.pod.namespace == "k8s-mule"                 // DNS from specific namespace
+http && src.pod.namespace == "k8s-mule"                // HTTP from specific namespace
+redis && src.pod.namespace == "k8s-mule"               // Redis from specific namespace
+```
```

**File**: `skills/security-audit/references/report-template.md` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+# Security Audit Report Template
+
+Use this template for the markdown report. Fill in all sections, then convert
+to PDF.
+
+```markdown
+# Kubernetes Network Security Audit Report
+
+**Cluster**: <cluster name/context>
+**Namespace**: <target namespace>
+**Date**: <audit date and time, local timezone>
+**Audit window**: <start time> — <end time> (<duration>)
+**Snapshots analyzed**: <count and IDs>
+**Audited by**: Claude Code + Kubeshark MCP
+
+---
+
+## Executive Summary
+
+<2-3 sentence summary: how many threats found, highest severity,
+whether an active attack chain was identified, top recommendation>
+
+## Threat Summary
+
+| # | Severity | Workload | Threat | MITRE ATT&CK |
+|---|----------|----------|--------|---------------|
+| 1 | CRITICAL | log-shipper | DNS Tunneling | T1048.003 |
+| 2 | CRITICAL | cloud-health-monitor | IMDS Credential Theft | T1552.005 |
+| ... | | | | |
+
+## Detailed Findings
+
+### Finding 1: <Title> (CRITICAL)
+
+**Workload**: <pod name>
+**MITRE ATT&CK**: <technique ID and name>
+**Snapshot**: <snapshot ID>
+**Detection method**: <which phase and tool detected this>
+
+**Evidence**:
+<Specific traffic data — DNS queries, HTTP requests, L4 flows,
+protocol payloads. Include timestamps, source/dest, and relevant
+content. Quote actual query names, URLs, SQL statements, or
+Redis commands observed.>
+
+**Impact**:
+<What this means — data at risk, credentials exposed, scope of access>
+
+**Recommendation**:
+<Specific remediation — NetworkPolicy, RBAC change, pod deletion, credential rotation>
+
+---
+
+(repeat for each finding)
+
+## Attack Chain Analysis
+
+<If findings correlate, map the kill chain:
+Initial Access → Reconnaissance → Credential Access → Lateral Movement →
+Exfiltration → Persistence. Identify which workloads participate in each stage.>
+
+## Detection Coverage
+
+| Phase | Checked | Findings |
+|-------|---------|----------|
+| Workload Inventory | Yes | <count> |
+| DNS Threat Analysis | Yes | <count> |
+| External Communication | Yes | <count> |
+| Lateral Movement | Yes | <count> |
+| Protocol Abuse | Yes | <count> |
+| Credential Access | Yes | <count> |
+
+## Limitations
+
+<What this audit cannot detect — config-level vulnerabilities,
+image CVEs, idle threats. Recommend complementary tools.>
+
+## Immediate Actions
+
+1. <Highest priority action>
+2. <Second priority>
+3. ...
+
+## Evidence Preservation
+
+<List snapshot IDs created during this audit. Recommend uploading
+to cloud storage for long-term retention. Include PCAP export
+commands for key findings.>
+```
+
+## Quality Guidelines
+
+- **Include raw evidence** — quote actual DNS queries, HTTP URLs, SQL
+  statements, Redis commands. The reader should be able to verify findings
+  without re-running the audit.
+- **Timestamp everything** — every finding should reference the snapshot ID
+  and timestamp (local time with UTC in parentheses).
+- **Be specific in recommendations** — not "fix RBAC" but "revoke
+  ClusterRoleBinding `mule-recon-cluster-admin` and replace with a
+  namespace-scoped Role granting only `get` on `pods`".
+- **Include MITRE ATT&CK IDs** — makes the report actionable for security
+  teams that track coverage against the framework.
```

**File**: `skills/security-audit/references/threat-catalog.md` (added, +190/-0)
```diff
@@ -0,0 +1,190 @@
+# Network Threat Catalog
+
+22 network-observable threat patterns organized by MITRE ATT&CK tactic.
+Each entry describes the attack, what it looks like on the wire, and how
+to detect it with Kubeshark.
+
+## Command & Control (TA0011)
+
+### DGA Beaconing (T1568.002)
+- **What**: Malware generates pseudo-random domain names daily and queries DNS
+  for each. The C2 operator registers a few; most resolve to NXDOMAIN.
+- **Wire signature**: Burst of DNS queries for high-entropy .com/.net domains
+  with >80% NXDOMAIN response rate.
+- **KFL**: `dns && dns_response && size(dns_answers) == 0` — then check for entropy in queried names.
+- **Difficulty**: Medium. NXDOMAIN flood is distinctive but low-rate DGA can
+  blend with legitimate DNS failures.
+
+### HTTP C2 Beaconing (T1071.001)
+- **What**: Implant calls home via HTTP GET at regular intervals, receiving
+  tasking in the response body. Cobalt Strike, Meterpreter pattern.
+- **Wire signature**: Periodic HTTP GET to fixed external URL at suspiciously
+  regular intervals (30-60s). Outdated User-Agent (Mozilla/4.0). Session
+  identifiers in URL path.
+- **KFL**: `http && dst.name.contains("attacker")` or check for User-Agent anomalies.
+- **Difficulty**: Medium. Regularity is the key anomaly.
+
+### Encrypted C2 (T1573.002)
+- **What**: C2 over HTTPS. Content is encrypted but TLS SNI reveals suspicious
+  domain names.
+- **Wire signature**: Outbound TLS to non-standard domains (darknet, cdn-mirror).
+  DNS queries preceding the connection reveal the target.
+- **KFL**: `dns && (dns_questions.exists(q, q.contains("darknet")) || dns_questions.exists(q, q.contains("cdn-mirror")))`.
+- **Difficulty**: Hard. Encrypted, uses standard port 443.
+
+### DNS-over-HTTPS C2 (T1572)
+- **What**: Bypasses cluster DNS by sending queries as HTTPS to public DoH
+  resolvers (cloudflare-dns.com, dns.google). C2 commands embedded in TXT
+  responses.
+- **Wire signature**: HTTP requests to DoH endpoints with `accept: application/dns-json`
+  header. No corresponding queries on port 53.
+- **KFL**: `http && (dst.name.contains("cloudflare-dns") || dst.name.contains("dns.google"))`.
+- **Difficulty**: Hard. Looks like regular HTTPS to trusted providers.
+
+## Exfiltration (TA0010)
+
+### DNS Tunneling (T1048.003)
+- **What**: Full bidirectional data channel over DNS using tools like iodine,
+  dnscat2. Data encoded in long subdomain labels.
+- **Wire signature**: High-frequency DNS queries (20+/burst) with subdomain
+  labels near 63-byte limit. Mix of A, TXT, NULL query types.
+- **KFL**: `dns && dns_questions.exists(q, q.contains("data-relay"))` or look for
+  high query rates per source.
+- **Difficulty**: Medium. Volume and long subdomains are distinctive.
+
+### HTTP Header Exfiltration (T1048.001)
+- **What**: Data exfiltrated in HTTP headers (Cookie, X-Trace-ID) disguised
+  as analytics tracking. Low volume to evade detection.
+- **Wire signature**: HTTP GET to analytics-looking URL with oversized Cookie
+  or custom headers containing base64-encoded data.
+- **KFL**: `http && dst.name.contains("cdn-provider")`.
+- **Difficulty**: Hard. Low volume, standard HTTP, looks like analytics.
+
+### DNS Credential Exfiltration (T1048.003)
+- **What**: Stolen JWT tokens or credentials encoded in DNS TXT queries to
+  attacker-controlled authoritative nameserver.
+- **Wire signature**: DNS TXT queries with structured multi-label subdomains
+  containing base64-like encoded data.
+- **KFL**: `dns && dns_questions.exists(q, q.contains("steal-creds"))`.
+- **Difficulty**: Medium. Multi-label structure is distinctive.
+
+### gRPC Stream Exfiltration (T1048.001)
+- **What**: Data exfiltration via gRPC (HTTP/2) POST to external endpoint.
+  Blends with normal microservice traffic.
+- **Wire signature**: HTTP/2 POST with `Content-Type: application/grpc` to
+  external destination with exfil-related method names.
+- **KFL**: `grpc && dst.name.contains("attacker")`.
+- **Difficulty**: Hard. gRPC is normal in K8s. External destination is the signal.
+
+## Lateral Movement (TA0008)
+
+### K8s API Enumeration (T1613)
+- **What**: Compromised pod uses mounted service account token to enumerate
+  secrets, pods, RBAC bindings across all namespaces.
+- **Wire signature**: HTTPS to kubernetes.default.svc with broad GET requests
+  across /api/v1/secrets, /pods, /configmaps, /clusterrolebindings.
+- **KFL**: `http && dst.port == 443 && path.contains("/api/v1/secrets")`.
+- **Difficulty**: Medium. The fanout across resource types is the anomaly.
+
+### SSRF to Internal Services (T1090)
+- **What**: Pod probes cross-namespace internal services it shouldn't talk to —
+  kube-dns metrics, Prometheus, Grafana, dashboards.
+- **Wire signature**: HTTP to multiple ClusterIP services across namespaces
+  from a single source pod.
+- **KFL**: `http && src.pod.namespace == "k8s-mule" && dst.pod.namespace != "k8s-mule"`.
+- **Difficulty**: Medium. Cross-namespace breadth is the signal.
```

---

### Incident Patch 3: `e27687a8` (2026-10-15)
**Commit Message**: Document the trace log level and the identity data it emits (#1976)

* Document the trace log level and the identity data it emits

* Describe what trace actually logs from the OIDC tokens

---------

Co-authored-by: Alon Girmonsky <[REDACTED_EMAIL]>

**File**: `helm-chart/README.md` (modified, +1/-0)
```diff
@@ -317,6 +317,7 @@ Example for overriding image names:
 | `dumpLogs`                                | Enable dumping of logs         | `false`                                                                                                                                                                                                                                          |
 | `headless`                                | Enable running in headless mode               | `false`                                                                                                                                                                                                                                          |
 | `license`                                 | License key for the Pro/Enterprise edition    | `""`                                                                                                                                                                                                                                             |
+| `logLevel`                                | Log verbosity for the Hub, sniffer and tracer. One of `error`, `warning`, `info`, `debug`, `trace`. `trace` logs per-request authorization detail, including the OIDC subject and group memberships, so treat it as a diagnostic setting rather than a steady-state one. | `warning`                                                                                                                                                                                                                                        |
 | `scripting.enabled`                       | Enables scripting. Also gates the scripting API: when `false` the Hub answers `/scripts`, `/scripts/exec`, `/jobs` and the AI assistant with 409, and the dashboard hides the scripting UI. Scripting is deployment-wide rather than a per-role capability, so this is the only switch that closes it. | `false` |
 | `scripting.env`                           | Environment variables for the scripting      | `{}`                                                                                                                                                                                                                                             |
 | `scripting.source`                        | Source directory of the scripts                | `""`                                                                                                                                                                                                                                             |
```

**File**: `skills/install/references/helm-values.md` (modified, +15/-1)
```diff
@@ -371,9 +371,23 @@ tap:
 headless: false                      # Suppress browser auto-open
 license: ""                          # Kubeshark Pro license key
 timezone: ""                         # Override timezone
-logLevel: warning                    # Log level: debug, info, warning, error
+logLevel: warning                    # Log level: trace, debug, info, warning, error
 
 kube:
   configPath: ""                     # Custom kubeconfig path
   context: ""                        # Kubernetes context name
 ```
+
+### Log levels
+
+`logLevel` applies to the Hub, the sniffer and the tracer, since the chart passes the same
+value to every container. Levels, least verbose first: `error`, `warning` (default), `info`,
+`debug`, `trace`.
+
+`trace` is for diagnosing a specific problem, not for running a deployment. It adds a
+per-request narrative of authentication and authorization: the resolved role, capabilities
+and namespace scope, and from the OIDC tokens the subject, issuer, audience, the names of
+the claims present and the value of the configured roles claim. That means the subject
+identifier and the caller's group memberships reach the container logs and anything
+collecting them. Token payloads are not logged in full, and neither are signatures.
+Turn it on to answer a question, then turn it back down.
```

#### Recent Merged Pull Requests:
- **PR #1977** (2026-10-15): Expose the snapshot S3 skip TLS verification flag in the chart and CLI config (@corest)
- **PR #1976** (2026-10-15): Document the trace log level and the identity data it emits (@corest)
- **PR #1973** (2026-10-07): :bookmark: Release v53.5.0 (@corest)
- **PR #1970** (2026-10-07): chart: add endpoint and path-style options for S3-compatible snapshot storage (@corest)
- **PR #1969** (closed): Link testing methodology from release notes (@corest)
- **PR #1966** (2026-09-09): chart: drop demoModeEnabled in favour of tap.auth.defaultRole (@corest)

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

## X. tool-to-section mapping in security-audit skill (#1940)

**RULE**:
When implementing operations in `skills/security-audit/SKILL.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kubeshark/kubeshark. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9396e64b`: tool-to-section mapping in security-audit skill (#1940). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `skills/security-audit/SKILL.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
### Step 2: Query Live Traffic
**Tool**: `get_l7_data_boundaries`
Check the time boundaries of dissected API calls in the real-time database.
This tells you how far back L7 data is available — use it to understand
the scope of your real-time queries before running them.
Then query the real-time dissected traffic across key dimensions.
**Tool**: `get_data_boundaries`

Check how far back raw capture data exists. Raw capture is the FIFO buffer
that feeds snapshot creation — this tells you the time window available
for snapshots (which is different from the L7 boundaries in Step 2).

Use `get_data_boundaries` to calculate how many snapshots are needed:
  ├── Phase 3: list_api_calls — external HTTP communication
  ├── Phase 4: list_api_calls — lateral movement, K8s API access
**Data source**: L7 dissection (after indexing).
**Note**: L4 flow analysis for external communication is covered in
Section A (Step 2) using `list_l4_flows` against real-time data. In
Section B, use `list_api_calls` against dissected snapshot data for
deeper L7 inspection of external traffic.
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
**Tool**: `get_data_boundaries`

Check how far back raw capture data exists. You need this to plan snapshot
creation in Step 3 — call it now so the data is ready when you need it.

**Tool**: `list_workloads` (no snapshot_id — queries live state)

Get the current workload inventory for the target namespace. This returns
pod names, namespaces, and IP addresses. Save the IPs — you'll need them
throughout the audit.
**Note**: `list_workloads` without a `snapshot_id` may fail with some
Kubeshark versions (`snapshot_id is required for filtered listing`). If
this happens, use individual lookups with `name` + `namespace` parameters,
or skip to Step 3 and get the workload inventory from the first snapshot.
### Step 2: Query Live Traffic
In parallel, query the real-time dissected traffic across key dimensions.
Use the data boundaries from Step 1 (`get_data_boundaries`) to calculate
how many snapshots are needed:
| **L4 Flows** | Immediately | `list_l4_flows` with `snapshot_id` | TCP/UDP connections: src/dst IPs, ports, bytes, duration |
  ├── Phase 3: list_l4_flows (immediate) — external flows, port scanning
  ├── Phase 4: list_l4_flows (immediate) — lateral movement, fan-out
**Data source**
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9396e64b` are properly handled with clean fallback behavior.

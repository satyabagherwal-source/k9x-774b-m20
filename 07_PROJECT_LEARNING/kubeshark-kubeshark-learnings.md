# Forensic Learning Record (Deep Inspection): kubeshark/kubeshark

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubeshark-kubeshark-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubeshark/kubeshark](https://github.com/kubeshark/kubeshark))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:53:55.367Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubeshark/kubeshark`
- **Description**: eBPF-powered network observability for Kubernetes. Indexes L4/L7 traffic with full K8s context, decrypts TLS without keys. Queryable by AI agents via MCP and humans via dashboard.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 12093 stars

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

### Core Architecture Module: `utils/wait.go`
```
package utils

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/rs/zerolog/log"
)

func WaitForTermination(ctx context.Context, cancel context.CancelFunc) {
	log.Debug().Msg("Waiting to finish...")
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT)

	// block until ctx cancel is called or termination signal is received
	select {
	case <-ctx.Done():
		log.Debug().Msg("Context done.")
		break
	case <-sigChan:
		log.Debug().Msg("Got a termination signal, canceling execution...")
		cancel()
	}
}

```

### Core Architecture Module: `cmd/clean.go`
```
package cmd

import (
	"fmt"

	"github.com/creasty/defaults"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"

	"github.com/kubeshark/kubeshark/config"
	"github.com/kubeshark/kubeshark/config/configStructs"
	"github.com/kubeshark/kubeshark/kubernetes/helm"
	"github.com/kubeshark/kubeshark/misc"
)

var cleanCmd = &cobra.Command{
	Use:   "clean",
	Short: fmt.Sprintf("Removes all %s resources", misc.Software),
	RunE: func(cmd *cobra.Command, args []string) error {
		resp, err := helm.NewHelm(
			config.Config.Tap.Release.Repo,
			config.Config.Tap.Release.Name,
			config.Config.Tap.Release.Namespace,
		).Uninstall()
		if err != nil {
			log.Error().Err(err).Send()
		} else {
			log.Info().Msgf("Uninstalled the Helm release: %s", resp.Release.Name)
		}
		return nil
	},
}

func init() {
	rootCmd.AddCommand(cleanCmd)

	defaultTapConfig := configStructs.TapConfig{}
	if err := defaults.Set(&defaultTapConfig); err != nil {
		log.Debug().Err(err).Send()
	}

	cleanCmd.Flags().StringP(configStructs.ReleaseNamespaceLabel, "s", defaultTapConfig.Release.Namespace, "Release namespace of Kubeshark")
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
  **Post-Mortem & Fix Analysis**:
  > > 🤖 *This analysis was generated by [Claude Code](https://claude.ai/code) (RCA Agent)*  **Likely Affected Repos**: kubeshark  **Summary**: The worker DaemonSet's init container (`cleanup-data-dir`) creates per-node subdirectories under `/app/data/$NODE_NAME`, but the `sniffer` and `tracer` containers mount `/app/data` directly without `subPathExpr`, so all pods on a shared EFS volume write PebbleDB to the same path and conflict on file locks.  **Detailed Findings**: - The init container (line 50–69 of `09-worker-daemon-set.yaml`) correctly sets `NODE_NAME` from `spec.nodeName` and runs `mkdir -p /app/data/$NODE_NAME`, creating per-node directories on the shared EFS filesystem. - The `sniffer` container volume mount (lines 220–229) mounts volume `data` at `/app/data` with no `subPath` or `subPathExpr`, meaning all nodes write to the same root path. - The `tracer` container volume mount (lines 321–330) has the identical issue — mounts `/app/data` directly without per-node isolation. - T

- **Issue #1882** (2026-03-24): **Decrypted TLS traffic missing from snapshots during delayed dissection**
  *Symptoms*: ### Description  TLS traffic that is successfully decrypted and displayed in real-time is not present when viewing a snapshot. During delayed dissection of a snapshot, the decrypted TLS content is missing — only the non-TLS traffic appears. This means snapshots do not accurately represent what was observed during live capture.  ### Why Is This Needed?  Snapshots are a core feature for offline analysis, sharing, and incident review. If decrypted TLS traffic is visible in real-time but absent from snapshots, users lose visibility into a significant portion of their traffic when reviewing captured data later. This undermines the value of snapshots for post-incident analysis and collaboration.  ### Additional Context  - In real-time mode, TLS traffic is decrypted via eBPF hooks and displayed as dissected API calls. - During snapshot creation/delayed dissection, the decrypted plaintext is apparently not persisted or re-dissected, resulting in the TLS traffic being absent from the snapshot. - The fix likely involves ensuring that the decrypted plaintext (captured via eBPF at the TLS layer) is included in the PCAP data or stored alongside it, so that delayed dissection can access and process it. - This is related to the PCAP capture pipeline — if raw PCAP only contains the encrypted bytes, delayed dissection has no way to recover the plaintext without the original eBPF hooks being active.

- **Issue #1741** (2025-04-10): **443 TCP traffic is filtered out automatically, when using eBPF implementation (with not supported TLS libraries)**
  *Symptoms*: On some occasions, especially with TLS libraries not supported by Kubeshark are used (e.g. with Java apps), 443 TCP traffic will be filtered out and will not show in the dashboard. This happens when the EBPF implementation is used. The issue does not exists with the AF_PACKET implementation. Same traffic will show when using the AF_PACKET implementation.  As an interim fix: To use AF_PACKET, use: `--set tap.packetCApture=af_packet`
  **Post-Mortem & Fix Analysis**:
  > fixed with: https://github.com/kubeshark/kubeshark/releases/tag/v52.6.0

- **Issue #1720** (2025-03-07): **Worker random and occasional processing halt**
  *Symptoms*: It was reported by several users that on rare and random occasions, and after some time, the Worker would stop processing traffic (go into a halt state), and require restart to resume operations. 
  **Post-Mortem & Fix Analysis**:
  > Fixed in: https://github.com/kubeshark/kubeshark/releases/tag/v52.5.0 and https://github.com/kubeshark/kubeshark/releases/tag/v52.4.0

- **Issue #1602** (2024-09-10): **fix: respect `tap.docker.imagePullSecrets`**
  *Symptoms*: fixes #1601 
  **Post-Mortem & Fix Analysis**:
  > @zyue110026 thank you so much! Seems correct but we need to add it to three more places as well:  https://github.com/kubeshark/kubeshark/blob/f155e4f1b7f2c632341ed6aeba23389e8ec9a81c/helm-chart/templates/09-worker-daemon-set.yaml#L32  https://github.com/kubeshark/kubeshark/blob/f155e4f1b7f2c632341ed6aeba23389e8ec9a81c/helm-chart/templates/09-worker-daemon-set.yaml#L78  https://github.com/kubeshark/kubeshark/blob/f155e4f1b7f2c632341ed6aeba23389e8ec9a81c/helm-chart/templates/09-worker-daemon-set.yaml#L181  Would you do these three as well? or should I do them after merging this PR?
  > @mertyildiran I added the fixes in these three places, please check.
  > :warning: Please install the !['codecov app svg image'](https://github.com/codecov/engineering-team/assets/152432831/e90313f4-9d3a-4b63-8b54-cfe14e7ec20d) to ensure uploads and comments are reliably processed by Codecov.  ## [Codecov](https://app.codecov.io/gh/kubeshark/kubeshark/pull/1602?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None) Report All modified and coverable lines are covered by tests :white_check_mark: > Project coverage is 23.14%. Comparing base [(`d3789f2`)](https://app.codecov.io/gh/kubeshark/kubeshark/commit/d3789f2bc0db9b86a56760aa0f6402feedb05470?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None) to head [(`b871d18`)](https://app.codecov.io/gh/kubeshark/kubeshark/commit/b871d18d74caaf94ccee69696e754cf9cfdbdec7?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comment

- **Issue #1534** (2024-04-19): **Upgrade fails**
  *Symptoms*: ```Error: UPGRADE FAILED: cannot patch "kubeshark-worker-daemon-set" with kind DaemonSet: DaemonSet.apps "kubeshark-worker-daemon-set" is invalid: spec.selector: Invalid value: v1.LabelSelector{MatchLabels:map[string]string{"<http://app.kubernetes.io/instance|app.kubernetes.io/instance>":"kubeshark", "<http://app.kubernetes.io/managed-by|app.kubernetes.io/managed-by>":"Helm", "<http://app.kubernetes.io/name|app.kubernetes.io/name>":"kubeshark", "<http://app.kubernetes.io/version|app.kubernetes.io/version>":"52.1.77", "<http://app.kubeshark.co/app|app.kubeshark.co/app>":"worker", "<http://helm.sh/chart|helm.sh/chart>":"kubeshark-52.1.77"}, MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: field is immutable &amp;&amp; cannot patch "kubeshark-hub" with kind Deployment: Deployment.apps "kubeshark-hub" is invalid: spec.selector: Invalid value: v1.LabelSelector{MatchLabels:map[string]string{"<http://app.kubernetes.io/instance|app.kubernetes.io/instance>":"kubeshark", "<http://app.kubernetes.io/managed-by|app.kubernetes.io/managed-by>":"Helm", "<http://app.kubernetes.io/name|app.kubernetes.io/name>":"kubeshark", "<http://app.kubernetes.io/version|app.kubernetes.io/version>":"52.1.77", "<http://app.kubeshark.co/app|app.kubeshark.co/app>":"hub", "<http://helm.sh/chart|helm.sh/chart>":"kubeshark-52.1.77"}, MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: field is immutable &amp;&amp; cannot patch "kubeshark-front" with kind Deployment: Deployment.apps "kubeshark-front" is inv
  **Post-Mortem & Fix Analysis**:
  > Fixed with: https://github.com/kubeshark/kubeshark/commit/6b6915c7ee43ababc9180bd1945ac3b53fa3c3fd

- **Issue #1466** (2023-12-19): **PF-RING doesn't load when Tracer is running**
  *Symptoms*: When both `tracer` and `sniffer` run as part of the Worker DaemonSet, PF-RING doesn't load. PF-RING does load when running without the `tracer` (e.g. by using `--set tap.tls=false`)
  **Post-Mortem & Fix Analysis**:
  > Fixed with v52.0.x

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

### Incident Patch 1: `35e484c9` (2026-09-24)
**Commit Message**: fix: compare semantic versions numerically (#1925)

Co-authored-by: Volodymyr Stoiko <[REDACTED_EMAIL]>

**File**: `kubernetes/provider_test.go` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+package kubernetes
+
+import (
+	"testing"
+
+	"github.com/kubeshark/kubeshark/semver"
+)
+
+func TestValidateKubernetesVersionRejectsNumericVersionBelowMinimum(t *testing.T) {
+	serverVersion := semver.SemVersion("v1.9.0")
+
+	if err := ValidateKubernetesVersion(&serverVersion); err == nil {
+		t.Fatalf("expected Kubernetes version %s to be rejected", serverVersion)
+	}
+}
+
+func TestValidateKubernetesVersionAcceptsMinimumVersion(t *testing.T) {
+	serverVersion := semver.SemVersion(MinKubernetesServerVersion)
+
+	if err := ValidateKubernetesVersion(&serverVersion); err != nil {
+		t.Fatalf("expected Kubernetes version %s to be accepted: %v", serverVersion, err)
+	}
+}
```

**File**: `semver/semver.go` (modified, +19/-5)
```diff
@@ -2,6 +2,7 @@ package semver
 
 import (
 	"regexp"
+	"strconv"
 )
 
 type SemVersion string
@@ -36,21 +37,34 @@ func (v SemVersion) Patch() string {
 }
 
 func (v SemVersion) GreaterThan(v2 SemVersion) bool {
-	if v.Major() > v2.Major() {
+	vMajor, vMinor, vPatch := v.breakdownInt()
+	v2Major, v2Minor, v2Patch := v2.breakdownInt()
+
+	if vMajor > v2Major {
 		return true
-	} else if v.Major() < v2.Major() {
+	} else if vMajor < v2Major {
 		return false
 	}
 
-	if v.Minor() > v2.Minor() {
+	if vMinor > v2Minor {
 		return true
-	} else if v.Minor() < v2.Minor() {
+	} else if vMinor < v2Minor {
 		return false
 	}
 
-	if v.Patch() > v2.Patch() {
+	if vPatch > v2Patch {
 		return true
 	}
 
 	return false
 }
+
+func (v SemVersion) breakdownInt() (int, int, int) {
+	major, minor, patch := v.Breakdown()
+
+	majorInt, _ := strconv.Atoi(major)
+	minorInt, _ := strconv.Atoi(minor)
+	patchInt, _ := strconv.Atoi(patch)
+
+	return majorInt, minorInt, patchInt
+}
```

**File**: `semver/semver_test.go` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+package semver
+
+import "testing"
+
+func TestGreaterThanComparesNumericComponents(t *testing.T) {
+	tests := []struct {
+		name string
+		v1   SemVersion
+		v2   SemVersion
+		want bool
+	}{
+		{
+			name: "minor component with fewer digits",
+			v1:   "1.16.0",
+			v2:   "1.9.0",
+			want: true,
+		},
+		{
+			name: "patch component with fewer digits",
+			v1:   "1.16.10",
+			v2:   "1.16.9",
+			want: true,
+		},
+		{
+			name: "lower major component",
+			v1:   "1.30.0",
+			v2:   "2.0.0",
+			want: false,
+		},
+		{
+			name: "same version",
+			v1:   "1.16.0",
+			v2:   "1.16.0",
+			want: false,
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			if got := test.v1.GreaterThan(test.v2); got != test.want {
+				t.Fatalf("%s.GreaterThan(%s) = %t, want %t", test.v1, test.v2, got, test.want)
+			}
+		})
+	}
+}
+
+func TestGreaterThanSupportsKubernetesGitVersionPrefix(t *testing.T) {
+	if !SemVersion("v1.16.0").GreaterThan("v1.9.0") {
+		t.Fatal("expected v1.16.0 to be greater than v1.9.0")
+	}
+}
```

---

### Incident Patch 2: `d3ac79a2` (2026-07-20)
**Commit Message**: Add required top-level 'owner' field to marketplace.json (#1948)

Fixes #1947

Co-authored-by: Alon Girmonsky <[REDACTED_EMAIL]>

**File**: `.claude-plugin/marketplace.json` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 {
   "name": "kubeshark",
+  "owner": { "name": "kubeshark" },
   "description": "Kubeshark network observability skills for Kubernetes",
   "plugins": [
     {
```

---

### Incident Patch 3: `9396e64b` (2026-05-21)
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

### Incident Patch 4: `cd13d8f8` (2026-05-15)
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

### Incident Patch 5: `ad9dfbf5` (2026-05-15)
**Commit Message**: Add install skill for Kubeshark deployment guidance (#1933)

* Add install skill for Kubeshark deployment guidance

New skill that helps users install and configure Kubeshark with a clear
CLI vs Helm decision tree, opinionated production defaults, and
platform-specific storage class recommendations.

* Add user-invocable flag to install skill frontmatter

* Add backup/overwrite check guidance for ~/.kubeshark/ config files

---------

Co-authored-by: Alon Girmonsky <[REDACTED_EMAIL]>

**File**: `skills/README.md` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ compatible agents.
 |-------|-------------|
 | [`network-rca`](network-rca/) | Network Root Cause Analysis. Retrospective traffic analysis via snapshots, with two investigation routes: PCAP (for Wireshark/compliance) and Dissection (for AI-driven API-level investigation). |
 | [`kfl`](kfl/) | KFL2 (Kubeshark Filter Language) expert. Complete reference for writing, debugging, and optimizing CEL-based traffic filters across all supported protocols. |
+| [`security-audit`](security-audit/) | Network Security Audit. Systematic 8-phase threat detection across MITRE ATT&CK tactics — C2, exfiltration, lateral movement, credential theft, cryptomining, protocol abuse — using snapshot-based traffic analysis. |
+| [`install`](install/) | Installation & Deployment. Guides CLI and Helm installation, builds custom values files, handles platform-specific config (EKS/GKE/AKS/OpenShift/KinD), auth, ingress, cloud storage, and troubleshooting. |
 
 ## Prerequisites
 
```

**File**: `skills/install/SKILL.md` (added, +489/-0)
```diff
@@ -0,0 +1,489 @@
+---
+name: install
+user-invocable: true
+description: >
+  Kubeshark installation and deployment skill. Use this skill whenever the user wants
+  to install Kubeshark, deploy Kubeshark to a Kubernetes cluster, set up Kubeshark,
+  configure Kubeshark helm values, generate a Kubeshark config file, customize
+  Kubeshark deployment, troubleshoot Kubeshark installation, upgrade Kubeshark,
+  uninstall Kubeshark, or manage the Kubeshark Helm release. Also trigger when
+  the user mentions "kubeshark tap", "kubeshark clean", "helm install kubeshark",
+  "get kubeshark running", "set up traffic capture", "deploy kubeshark",
+  "kubeshark not starting", "kubeshark pods not ready", "configure namespaces",
+  "persistent storage", "cloud storage for snapshots", "kubeshark ingress",
+  "kubeshark auth", "kubeshark SAML", "kubeshark license", "kubeshark config",
+  "custom helm values", "kubeshark on EKS/GKE/AKS", "kubeshark on OpenShift",
+  "kubeshark on KinD/minikube/k3s", "air-gapped", "offline install",
+  or any request related to getting Kubeshark installed, configured, and running
+  in a Kubernetes cluster.
+---
+
+# Kubeshark Installation & Deployment
+
+You are a Kubeshark deployment specialist. Your job is to help users install,
+configure, and deploy Kubeshark to their Kubernetes cluster — tailoring the
+configuration to their specific environment, requirements, and use case.
+
+Kubeshark deploys via Helm. The CLI (`kubeshark tap`) is a thin wrapper that
+installs a basic Helm chart and establishes a port-forward — nothing more.
+For larger or production clusters, use Helm directly with a custom values file.
+
+## Decision: CLI or Helm?
+
+**Use the CLI** when:
+- Quick install on a dev/test cluster (minikube, KinD, k3s)
+- Personal environment, single user
+- Just want to try Kubeshark quickly
+
+**Use Helm directly** when:
+- Larger cluster (staging, production)
+- Need custom configuration (ingress, auth, storage, namespaces)
+- GitOps / infrastructure-as-code workflows
+- Team environment
+
+## Path A: CLI (Dev/Test Clusters)
+
+### Step 1 — Install the CLI
+
+Check if Kubeshark is already installed:
+
+```bash
+kubeshark version
+```
+
+If not installed, offer one of these methods:
+
+**Homebrew (easiest, where available):**
+
+```bash
+brew tap kubeshark/kubeshark
+brew install kubeshark
+```
+
+**Binary download:**
+
+For the full list of platforms and architectures, see https://docs.kubeshark.com/en/install
+
+```bash
+# Linux (amd64)
+curl -Lo kubeshark https://github.com/kubeshark/kubeshark/releases/latest/download/kubeshark_linux_amd64
+chmod +x kubeshark
+sudo mv kubeshark /usr/local/bin/
+
+# Linux (arm64)
+curl -Lo kubeshark https://github.com/kubeshark/kubeshark/releases/latest/download/kubeshark_linux_arm64
+chmod +x kubeshark
+sudo mv kubeshark /usr/local/bin/
+
+# macOS (Apple Silicon)
+curl -Lo kubeshark https://github.com/kubeshark/kubeshark/releases/latest/download/kubeshark_darwin_arm64
+chmod +x kubeshark
+sudo mv kubeshark /usr/local/bin/
+
+# macOS (Intel)
+curl -Lo kubeshark https://github.com/kubeshark/kubeshark/releases/latest/download/kubeshark_darwin_amd64
+chmod +x kubeshark
+sudo mv kubeshark /usr/local/bin/
+```
+
+### Step 2 — Check for Updates
+
+**Always check for updates before using the CLI.** This is critical — Kubeshark
+releases frequently and running an outdated version can cause issues.
+
+```bash
+# Homebrew
+brew upgrade kubeshark
+
+# Binary — check the latest release and re-download if newer
+kubeshark version
+# Compare with https://github.com/kubeshark/kubeshark/releases/latest
+```
+
+### Step 3 — Deploy with `kubeshark tap`
+
+```bash
+kubeshark tap
+```
+
+This installs the Helm chart with defaults and opens the dashboard in your browser.
+That's it for dev/test clusters.
+
+### Step 4 — Reconnect if Connection Breaks
+
+If the port-forward drops (laptop sleep, network change, terminal closed):
+
+```bash
+kubeshark proxy
+```
+
+This re-establishes the port-forward and reopens the dashboard. It does **not**
+reinstall — Kubeshark is still running in the cluster.
+
+### Step 5 — Clean Up After Use
+
+**Always clean up when done.** Kubeshark runs eBPF probes and DaemonSet workers
+on every node — leaving it running wastes cluster resources.
+
+```bash
+kubeshark clean
+```
+
+Always remind the user to run `kubeshark clean` when they're finished. This is
+easy to forget and important.
+
+## Path B: Helm (Larger / Production Clusters)
+
+### Step 1 — Upgrade the Helm Chart
+
+**Always update the Helm repo first.** This is the most important first step —
+running an outdated chart can cause issues.
+
+```bash
+helm repo add kubeshark https://helm.kubeshark.com
+helm repo update
+```
+
+### Step 2 — Create a Config Directory
+
+Store all configuration files in `~/.kubeshark/`:
+
+```bash
+mkdir -p ~/.kubeshark
+```
+
+**Before writing any file to `~/.kubeshark/`, check if it already exists.**
+If `~/.kubeshark/values.yaml` (or any target f
```

**File**: `skills/install/references/cloud-storage.md` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+# Cloud Storage for Snapshots
+
+This is a pointer to the authoritative cloud storage documentation maintained in
+the Helm chart:
+
+**Source of truth**: `helm-chart/docs/snapshots_cloud_storage.md`
+
+Always read that file for the latest configuration details, including:
+
+- Amazon S3 (static credentials, IRSA, cross-account AssumeRole)
+- Azure Blob Storage (storage key, Workload Identity / DefaultAzureCredential)
+- Google Cloud Storage (service account JSON, GKE Workload Identity)
+- IAM permissions and trust policy examples
+- ConfigMap and Secret setup patterns
+- Inline values vs. external ConfigMap/Secret approaches
+
+## Quick Reference
+
+### Helm Values Structure
+
+```yaml
+tap:
+  snapshots:
+    cloud:
+      provider: ""      # "s3", "azblob", or "gcs" (empty = disabled)
+      prefix: ""        # Key prefix in the bucket/container
+      configMaps: []    # Pre-existing ConfigMaps with cloud config env vars
+      secrets: []       # Pre-existing Secrets with cloud credentials
+      s3:
+        bucket: ""
+        region: ""
+        accessKey: ""
+        secretKey: ""
+        roleArn: ""
+        externalId: ""
+      azblob:
+        storageAccount: ""
+        container: ""
+        storageKey: ""
+      gcs:
+        bucket: ""
+        project: ""
+        credentialsJson: ""
+```
+
+### Recommended Auth Per Provider
+
+| Provider | Production Recommendation |
+|----------|-------------------------|
+| S3 (EKS) | IRSA (IAM Roles for Service Accounts) — no static credentials |
+| S3 (non-EKS) | Static credentials via Secret, or default AWS credential chain |
+| Azure Blob (AKS) | Workload Identity / Managed Identity |
+| Azure Blob (non-AKS) | Storage account key via Secret |
+| GCS (GKE) | GKE Workload Identity — no JSON key file |
+| GCS (non-GKE) | Service account JSON key via Secret |
+
+### Inline Values (Simplest Approach)
+
+Set credentials directly in values.yaml. The Helm chart creates the necessary
+ConfigMap/Secret resources automatically.
+
+**S3:**
+```yaml
+tap:
+  snapshots:
+    cloud:
+      provider: "s3"
+      s3:
+        bucket: my-kubeshark-snapshots
+        region: us-east-1
+```
+
+**GCS:**
+```yaml
+tap:
+  snapshots:
+    cloud:
+      provider: "gcs"
+      gcs:
+        bucket: my-kubeshark-snapshots
+        project: my-gcp-project
+```
+
+**Azure Blob:**
+```yaml
+tap:
+  snapshots:
+    cloud:
+      provider: "azblob"
+      azblob:
+        storageAccount: mykubesharksa
+        container: snapshots
+```
+
+For production setups with proper IAM integration, see the full documentation
+in `helm-chart/docs/snapshots_cloud_storage.md`.
```

**File**: `skills/install/references/helm-values.md` (added, +376/-0)
```diff
@@ -0,0 +1,376 @@
+# Kubeshark Helm Values Reference
+
+Complete reference for all Kubeshark Helm chart values. Use this when building
+custom `values.yaml` files or `--set` flags.
+
+## Docker Images
+
+```yaml
+tap:
+  docker:
+    registry: docker.io/kubeshark    # Docker registry
+    tag: ""                          # Image tag (empty = chart appVersion)
+    tagLocked: true                  # Lock to specific tag
+    imagePullPolicy: Always          # Always, IfNotPresent, Never
+    imagePullSecrets: []             # Registry pull secrets
+    overrideImage:                   # Override individual component images
+      worker: ""
+      hub: ""
+      front: ""
+    overrideTag:                     # Override individual component tags
+      worker: ""
+      hub: ""
+      front: ""
+```
+
+## Proxy / Port-Forward
+
+```yaml
+tap:
+  proxy:
+    worker:
+      srvPort: 48999
+    hub:
+      srvPort: 8898
+    front:
+      port: 8899                     # Local port for port-forward
+    host: 127.0.0.1                  # Bind address
+```
+
+## Pod Targeting
+
+```yaml
+tap:
+  regex: .*                          # Pod name regex filter
+  namespaces: []                     # Target namespaces (empty = all)
+  excludedNamespaces: []             # Namespaces to exclude
+  bpfOverride: ""                    # Custom BPF filter override
+```
+
+## Capture & Dissection
+
+```yaml
+tap:
+  capture:
+    dissection:
+      enabled: true                  # Enable L7 dissection
+      stopAfter: 5m                  # Auto-stop dissection after duration
+    captureSelf: false               # Capture Kubeshark's own traffic
+    raw:
+      enabled: true                  # Enable raw packet capture (needed for snapshots)
+      storageSize: 1Gi               # FIFO buffer size per node
+    dbMaxSize: 500Mi                 # Max L7 database size per node
+  delayedDissection:
+    cpu: "1"                         # CPU for delayed dissection jobs
+    memory: 4Gi                      # Memory for delayed dissection jobs
+    storageSize: ""                  # Storage for delayed dissection
+    storageClass: ""                 # Storage class for delayed dissection
+```
+
+## Snapshots
+
+```yaml
+tap:
+  snapshots:
+    local:
+      storageClass: ""               # Storage class for local snapshots
+      storageSize: 20Gi              # PVC size for local snapshots
+    cloud:
+      provider: ""                   # s3, gcs, or azblob
+      prefix: ""                     # Path prefix in bucket
+      configMaps: []                 # Additional ConfigMaps to mount
+      secrets: []                    # Additional Secrets to mount
+      s3:
+        bucket: ""
+        region: ""
+        accessKey: ""
+        secretKey: ""
+        roleArn: ""                  # IAM role ARN (IRSA)
+        externalId: ""               # STS external ID
+      azblob:
+        storageAccount: ""
+        container: ""
+        storageKey: ""
+      gcs:
+        bucket: ""
+        project: ""
+        credentialsJson: ""          # Service account JSON
+```
+
+## Helm Release
+
+```yaml
+tap:
+  release:
+    repo: https://helm.kubeshark.com  # Helm chart repository
+    name: kubeshark                    # Release name
+    namespace: default                 # Release namespace
+    helmChartPath: ""                  # Path to local chart (overrides repo)
+```
+
+## Storage
+
+```yaml
+tap:
+  persistentStorage: false           # Enable PVC for worker data
+  persistentStorageStatic: false     # Static provisioning
+  persistentStoragePvcVolumeMode: FileSystem  # FileSystem or Block
+  efsFileSytemIdAndPath: ""          # EFS file system ID (EKS)
+  secrets: []                        # Additional secrets to mount
+  storageLimit: 10Gi                 # Max storage per node
+  storageClass: standard             # Default storage class
+```
+
+## Resources
+
+```yaml
+tap:
+  resources:
+    hub:
+      limits:
+        cpu: "0"                     # 0 = no limit
+        memory: 5Gi
+      requests:
+        cpu: 50m
+        memory: 50Mi
+    sniffer:
+      limits:
+        cpu: "0"
+        memory: 5Gi
+      requests:
+        cpu: 50m
+        memory: 50Mi
+    tracer:
+      limits:
+        cpu: "0"
+        memory: 5Gi
+      requests:
+        cpu: 50m
+        memory: 50Mi
+```
+
+## Health Probes
+
+```yaml
+tap:
+  probes:
+    hub:
+      initialDelaySeconds: 5
+      periodSeconds: 5
+      successThreshold: 1
+      failureThreshold: 3
+    sniffer:
+      initialDelaySeconds: 5
+      periodSeconds: 5
+      successThreshold: 1
+      failureThreshold: 3
+```
+
+## TLS & Service Mesh
+
+```yaml
+tap:
+  serviceMesh: true                  # Capture mTLS traffic (service mesh)
+  tls: true                          # Capture OpenSSL/Go TLS traffic
+  disableTlsLog: true                # Suppress TLS debug logging
+  packetCapture: best                # Capture method: best, af_packet, pcap
+```
+
+##
```

---

### Incident Patch 6: `9f5a1a41` (2026-05-01)
**Commit Message**: fix(release-pr): sync bumped Chart.yaml to kubeshark.github.io (#1913)

* fix(release-pr): sync bumped Chart.yaml to kubeshark.github.io

The release-pr target was switching back to master (and pulling)
BEFORE copying helm-chart/ into ../kubeshark.github.io/charts/chart.
That reverted the working tree to the pre-bump Chart.yaml, so the
kubeshark.github.io PR shipped the previous version and the
chart-releaser action failed trying to recreate an existing tag.

Copy the bumped chart from the release/vX.Y.Z working tree, then
switch kubeshark back to master at the end of the target.

Also consolidate iterative robustness improvements: VERSION
validation, idempotent sibling-repo tagging, idempotent branch /
commit / push / PR creation, and a "nothing to commit" guard so
reruns of release-pr do not fail.

* refactor(release): split release-pr into three rerunnable targets

Before, release-pr did three things in one recipe: tag sibling
repos, create the kubeshark release PR, and create the helm chart
PR. If any step failed, the whole target had to be rerun, even for
the parts that had already succeeded, and some sub-steps (like
tagging worker/hub/front after a docker-image-only rebuild) 

**File**: `Makefile` (modified, +92/-33)
```diff
@@ -253,52 +253,111 @@ port-forward:
 	kubectl port-forward $$(kubectl get pods | awk '$$1 ~ /^$(POD_PREFIX)/' | awk 'END {print $$1}') $(SRC_PORT):$(DST_PORT)
 
 release: ## Print release workflow instructions.
-	@echo "Release workflow (2 steps):"
+	@echo "Release workflow — each step is idempotent and can be rerun on its own:"
 	@echo ""
-	@echo "  1. make release-pr VERSION=x.y.z"
-	@echo "     Tags sibling repos, bumps version, creates PRs"
-	@echo "     (kubeshark + kubeshark.github.io helm chart)."
-	@echo "     Review and merge both PRs manually."
+	@echo "  1. make release-siblings VERSION=x.y.z"
+	@echo "     Tag worker, hub, front with vx.y.z. Also run standalone when"
+	@echo "     rebuilding docker images without cutting a full release."
 	@echo ""
-	@echo "  2. (automatic) Tag is created when release PR merges."
-	@echo "     Fallback: make release-tag VERSION=x.y.z"
-
-release-pr: ## Step 1: Tag sibling repos, bump version, create release PR.
-	@cd ../worker && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
-	@cd ../hub && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
-	@cd ../front && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
+	@echo "  2. make release-pr-kubeshark VERSION=x.y.z"
+	@echo "     Bump Helm Chart.yaml, build, open release PR on kubeshark."
+	@echo ""
+	@echo "  3. make release-pr-helm VERSION=x.y.z"
+	@echo "     Sync helm-chart/ into kubeshark.github.io, open helm PR."
+	@echo "     Requires release/vx.y.z branch (created by step 2)."
+	@echo ""
+	@echo "  Shortcut: make release-pr VERSION=x.y.z runs 1 → 2 → 3."
+	@echo ""
+	@echo "  After both PRs merge: tag is created automatically,"
+	@echo "  or run: make release-tag VERSION=x.y.z"
+
+# Internal: validate VERSION before any release-* target runs.
+_release-check-version:
+	@if [ -z "$(VERSION)" ]; then echo "ERROR: VERSION is required. Usage: make <target> VERSION=x.y.z"; exit 1; fi
+	@echo "$(VERSION)" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' || { echo "ERROR: VERSION must be semver (e.g. 53.2.4)"; exit 1; }
+
+release-siblings: _release-check-version ## Tag worker, hub, front with v$(VERSION). Idempotent; standalone for docker-image-only updates.
+	@for repo in worker hub front; do \
+		echo "==> $$repo: ensuring v$(VERSION) tag"; \
+		(cd ../$$repo && git checkout master && git pull) || exit 1; \
+		if (cd ../$$repo && git ls-remote --tags origin "refs/tags/v$(VERSION)" | grep -q .); then \
+			echo "    v$(VERSION) already on origin — skipping"; \
+		else \
+			(cd ../$$repo && git tag -d v$(VERSION) 2>/dev/null; git tag v$(VERSION) && git push origin "refs/tags/v$(VERSION)") || exit 1; \
+		fi; \
+	done
+
+release-pr-kubeshark: _release-check-version ## Bump Chart.yaml, build, open release PR on kubeshark.
 	@cd ../kubeshark && git checkout master && git pull
-	@sed -i '' "s/^version:.*/version: \"$(shell echo $(VERSION) | sed -E 's/^([0-9]+\.[0-9]+\.[0-9]+)\..*/\1/')\"/" helm-chart/Chart.yaml
+	@NEW=$$(echo $(VERSION) | sed -E 's/^([0-9]+\.[0-9]+\.[0-9]+).*/\1/'); \
+	CUR=$$(awk '/^version:/ {gsub(/"/,"",$$2); print $$2; exit}' helm-chart/Chart.yaml); \
+	if [ "$$CUR" != "$$NEW" ]; then \
+		sed -i '' "s/^version:.*/version: \"$$NEW\"/" helm-chart/Chart.yaml; \
+	else \
+		echo "Chart.yaml already at $$NEW"; \
+	fi
 	@$(MAKE) build VER=$(VERSION)
 	@if [ "$(shell uname)" = "Darwin" ]; then \
 		codesign --sign - --force --preserve-metadata=entitlements,requirements,flags,runtime ./bin/kubeshark__; \
 	fi
 	@$(MAKE) generate-helm-values && $(MAKE) generate-manifests
+	@if git show-ref --verify --quiet refs/heads/release/v$(VERSION); then \
+		git branch -D release/v$(VERSION); \
+	fi
 	@git checkout -b release/v$(VERSION)
 	@git add -A .
-	@git commit -m ":bookmark: Bump the Helm chart version to $(VERSION)"
-	@git push -u origin release/v$(VERSION)
-	@gh pr create --title ":bookmark: Release v$(VERSION)" \
-		--body "Automated release PR for v$(VERSION)." \
-		--base master \
-		--reviewer corest
-	@git checkout master && git pull
-	@cd ../kubeshark.github.io \
-		&& git checkout master && git pull \
-		&& rm -rf charts/chart \
-		&& mkdir charts/chart \
-		&& cp -r ../kubeshark/helm-chart/ charts/chart/ \
-		&& git checkout -b helm-v$(VERSION) \
-		&& git add -A . \
-		&& git commit -m ":sparkles: Update the Helm chart to v$(VERSION)" \
-		&& git push -u origin helm-v$(VERSION) \
-		&& gh pr create --title ":sparkles: Helm chart v$(VERSION)" \
+	@if ! git diff --cached --quiet; then \
+		git commit -m ":bookmark: Bump the Helm chart version to $(VERSION)"; \
+	else \
+		echo "nothing to commit"; \
+	fi
+	@git push --force-with-lease -u origin release/v$(VERSION)
+	@if gh pr view release/v$(VERSION) --json number >/dev/null 2>&1; then \
+		echo "PR already exists for release/v$(VERSION)"; \
+	else \
+		gh pr create --title ":bookmark: Release v$
```

---

### Incident Patch 7: `3a1ad64b` (2026-04-10)
**Commit Message**: fix: add subPathExpr to worker DaemonSet for shared persistent storage (#1901)

Co-authored-by: Volodymyr Stoiko <[REDACTED_EMAIL]>
Co-authored-by: Alon Girmonsky <[REDACTED_EMAIL]>

**File**: `helm-chart/templates/09-worker-daemon-set.yaml` (modified, +14/-0)
```diff
@@ -131,6 +131,10 @@ spec:
             valueFrom:
               fieldRef:
                 fieldPath: metadata.namespace
+          - name: NODE_NAME
+            valueFrom:
+              fieldRef:
+                fieldPath: spec.nodeName
           - name: TCP_STREAM_CHANNEL_TIMEOUT_MS
             value: '{{ .Values.tap.misc.tcpStreamChannelTimeoutMs }}'
           - name: TCP_STREAM_CHANNEL_TIMEOUT_SHOW
@@ -227,6 +231,9 @@ spec:
               mountPropagation: HostToContainer
             - mountPath: /app/data
               name: data
+{{- if .Values.tap.persistentStorage }}
+              subPathExpr: $(NODE_NAME)
+{{- end }}
       {{- if .Values.tap.tls }}
         - command:
             - ./tracer
@@ -257,6 +264,10 @@ spec:
             valueFrom:
               fieldRef:
                 fieldPath: metadata.namespace
+          - name: NODE_NAME
+            valueFrom:
+              fieldRef:
+                fieldPath: spec.nodeName
           - name: PROFILING_ENABLED
             value: '{{ .Values.tap.pprof.enabled }}'
           - name: SENTRY_ENABLED
@@ -328,6 +339,9 @@ spec:
               mountPropagation: HostToContainer
             - mountPath: /app/data
               name: data
+{{- if .Values.tap.persistentStorage }}
+              subPathExpr: $(NODE_NAME)
+{{- end }}
             - mountPath: /etc/os-release
               name: os-release
               readOnly: true
```

---

### Incident Patch 8: `4de0ac6a` (2026-04-07)
**Commit Message**: refactor: replace Split in loops with more efficient SplitSeq and gofmt the code (#1888)

Signed-off-by: stringsbuilder <[REDACTED_EMAIL]>
Co-authored-by: Alon Girmonsky <[REDACTED_EMAIL]>

**File**: `cmd/mcpRunner.go` (modified, +17/-18)
```diff
@@ -86,9 +86,9 @@ type mcpContent struct {
 }
 
 type mcpPrompt struct {
-	Name        string            `json:"name"`
-	Description string            `json:"description,omitempty"`
-	Arguments   []mcpPromptArg    `json:"arguments,omitempty"`
+	Name        string         `json:"name"`
+	Description string         `json:"description,omitempty"`
+	Arguments   []mcpPromptArg `json:"arguments,omitempty"`
 }
 
 type mcpPromptArg struct {
@@ -117,11 +117,11 @@ type mcpGetPromptResult struct {
 // Hub MCP API response types
 
 type hubMCPResponse struct {
-	Name        string          `json:"name"`
-	Description string          `json:"description"`
-	Version     string          `json:"version"`
-	Tools       []hubMCPTool    `json:"tools"`
-	Prompts     []hubMCPPrompt  `json:"prompts"`
+	Name        string         `json:"name"`
+	Description string         `json:"description"`
+	Version     string         `json:"version"`
+	Tools       []hubMCPTool   `json:"tools"`
+	Prompts     []hubMCPPrompt `json:"prompts"`
 }
 
 type hubMCPTool struct {
@@ -131,9 +131,9 @@ type hubMCPTool struct {
 }
 
 type hubMCPPrompt struct {
-	Name        string              `json:"name"`
-	Description string              `json:"description,omitempty"`
-	Arguments   []hubMCPPromptArg   `json:"arguments,omitempty"`
+	Name        string            `json:"name"`
+	Description string            `json:"description,omitempty"`
+	Arguments   []hubMCPPromptArg `json:"arguments,omitempty"`
 }
 
 type hubMCPPromptArg struct {
@@ -151,10 +151,10 @@ type mcpServer struct {
 	stdout             io.Writer
 	backendInitialized bool
 	backendMu          sync.Mutex
-	setFlags           []string // --set flags to pass to 'kubeshark tap' when starting
-	directURL          string   // If set, connect directly to this URL (no kubectl/proxy)
-	urlMode            bool     // True when using direct URL mode
-	allowDestructive   bool     // If true, enable start/stop tools
+	setFlags           []string        // --set flags to pass to 'kubeshark tap' when starting
+	directURL          string          // If set, connect directly to this URL (no kubectl/proxy)
+	urlMode            bool            // True when using direct URL mode
+	allowDestructive   bool            // If true, enable start/stop tools
 	cachedHubMCP       *hubMCPResponse // Cached tools/prompts from Hub
 	cachedAt           time.Time       // When the cache was populated
 	hubMCPMu           sync.Mutex
@@ -772,7 +772,6 @@ func (s *mcpServer) callHubTool(toolName string, args map[string]any) (string, b
 	return prettyJSON.String(), false
 }
 
-
 func (s *mcpServer) callGetFileURL(args map[string]any) (string, bool) {
 	filePath, _ := args["path"].(string)
 	if filePath == "" {
@@ -869,8 +868,8 @@ func (s *mcpServer) callStartKubeshark(args map[string]any) (string, bool) {
 
 	// Add namespaces if provided
 	if v, ok := args["namespaces"].(string); ok && v != "" {
-		namespaces := strings.Split(v, ",")
-		for _, ns := range namespaces {
+		namespaces := strings.SplitSeq(v, ",")
+		for ns := range namespaces {
 			ns = strings.TrimSpace(ns)
 			if ns != "" {
 				cmdArgs = append(cmdArgs, "-n", ns)
```

**File**: `cmd/mcp_test.go` (modified, +1/-1)
```diff
@@ -417,7 +417,7 @@ func TestMCP_CommandArgs(t *testing.T) {
 			cmdArgs = append(cmdArgs, v)
 		}
 		if v, _ := tc.args["namespaces"].(string); v != "" {
-			for _, ns := range strings.Split(v, ",") {
+			for ns := range strings.SplitSeq(v, ",") {
 				cmdArgs = append(cmdArgs, "-n", strings.TrimSpace(ns))
 			}
 		}
```

---

### Incident Patch 9: `4695acb4` (2026-03-31)
**Commit Message**: :bug: Fix release-pr Makefile target cleanup and macOS sed compatibility (#1890)

- Fix macOS sed -i requiring empty backup extension argument
- Checkout master after creating kubeshark release PR
- Checkout master in kubeshark.github.io before and after creating helm PR
- Run all kubeshark.github.io operations in a single shell to avoid lost cd context

Co-authored-by: Alon Girmonsky <[REDACTED_EMAIL]>

**File**: `Makefile` (modified, +12/-10)
```diff
@@ -264,10 +264,10 @@ release: ## Print release workflow instructions.
 	@echo "     Fallback: make release-tag VERSION=x.y.z"
 
 release-pr: ## Step 1: Tag sibling repos, bump version, create release PR.
-# 	@cd ../worker && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
-# 	@cd ../hub && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
-# 	@cd ../front && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
-# 	@cd ../kubeshark && git checkout master && git pull
+	@cd ../worker && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
+	@cd ../hub && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
+	@cd ../front && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
+	@cd ../kubeshark && git checkout master && git pull
 	@sed -i '' "s/^version:.*/version: \"$(shell echo $(VERSION) | sed -E 's/^([0-9]+\.[0-9]+\.[0-9]+)\..*/\1/')\"/" helm-chart/Chart.yaml
 	@$(MAKE) build VER=$(VERSION)
 	@if [ "$(shell uname)" = "Darwin" ]; then \
@@ -282,19 +282,21 @@ release-pr: ## Step 1: Tag sibling repos, bump version, create release PR.
 		--body "Automated release PR for v$(VERSION)." \
 		--base master \
 		--reviewer corest
-	@rm -rf ../kubeshark.github.io/charts/chart
-	@mkdir ../kubeshark.github.io/charts/chart
-	@cp -r helm-chart/ ../kubeshark.github.io/charts/chart/
-	@cd ../kubeshark.github.io && git checkout master && git pull \
+	@git checkout master && git pull
+	@cd ../kubeshark.github.io \
+		&& git checkout master && git pull \
+		&& rm -rf charts/chart \
+		&& mkdir charts/chart \
+		&& cp -r ../kubeshark/helm-chart/ charts/chart/ \
 		&& git checkout -b helm-v$(VERSION) \
 		&& git add -A . \
 		&& git commit -m ":sparkles: Update the Helm chart to v$(VERSION)" \
 		&& git push -u origin helm-v$(VERSION) \
 		&& gh pr create --title ":sparkles: Helm chart v$(VERSION)" \
 			--body "Update Helm chart for release v$(VERSION)." \
 			--base master \
-			--reviewer corest
-	@cd ../kubeshark
+			--reviewer corest \
+		&& git checkout master
 	@echo ""
 	@echo "Release PRs created:"
 	@echo "  - kubeshark: Review and merge the release PR."
```

---

### Incident Patch 10: `c63740ec` (2026-03-20)
**Commit Message**: :bug: Fix dissection-control `front` env logic (#1878)

**File**: `helm-chart/templates/06-front-deployment.yaml` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ spec:
               value: '{{- if and (not .Values.demoModeEnabled) (not .Values.tap.capture.dissection.enabled) -}}
                         true
                       {{- else -}}
-                        {{ not (default false .Values.demoModeEnabled) | ternary false true }}
+                        {{ (default false .Values.demoModeEnabled) | ternary false true }}
                       {{- end -}}'
             - name: 'REACT_APP_CLOUD_LICENSE_ENABLED'
               value: '{{- if or (and .Values.cloudLicenseEnabled (not (empty .Values.license))) (not .Values.internetConnectivity) -}}
```

---

### Incident Patch 11: `963b3e4a` (2026-03-17)
**Commit Message**: :bug: Add default value for `demoModeEnabled` (#1872)

**File**: `helm-chart/templates/12-config-map.yaml` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ data:
     INGRESS_HOST: '{{ .Values.tap.ingress.host }}'
     PROXY_FRONT_PORT: '{{ .Values.tap.proxy.front.port }}'
     AUTH_ENABLED: '{{- if and .Values.cloudLicenseEnabled (not (empty .Values.license)) -}}
-                        {{ .Values.demoModeEnabled | ternary true ((and .Values.tap.auth.enabled (eq .Values.tap.auth.type "dex")) | ternary true false) }}
+                        {{ (default false .Values.demoModeEnabled) | ternary true ((and .Values.tap.auth.enabled (eq .Values.tap.auth.type "dex")) | ternary true false) }}
                   {{- else -}}
                         {{ .Values.cloudLicenseEnabled | ternary "true" ((default false .Values.demoModeEnabled) | ternary "true" .Values.tap.auth.enabled) }}
                   {{- end }}'
```

---

### Incident Patch 12: `f9a5fbbb` (2026-03-06)
**Commit Message**: Fix snapshots local storage size (#1859)

Co-authored-by: Alon Girmonsky <[REDACTED_EMAIL]>

**File**: `helm-chart/templates/04-hub-deployment.yaml` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ spec:
             - -capture-stop-after
             - "{{ if hasKey .Values.tap.capture.dissection "stopAfter" }}{{ .Values.tap.capture.dissection.stopAfter }}{{ else }}5m{{ end }}"
             - -snapshot-size-limit
-            - '{{ .Values.tap.snapshots.storageSize }}'
+            - '{{ .Values.tap.snapshots.local.storageSize }}'
             - -dissector-image
           {{- if .Values.tap.docker.overrideImage.worker }}
             - '{{ .Values.tap.docker.overrideImage.worker }}'
```

---

### Incident Patch 13: `a6daefc5` (2026-03-06)
**Commit Message**: Fix MCP Registry publish by using OIDC auth instead of interactive OAuth (#1857)

mcp-publisher login github uses the device flow (interactive OAuth) which
requires a human to visit a URL - this can never work in CI. Switch to
github-oidc which uses the OIDC token provided by GitHub Actions.

**File**: `.github/workflows/mcp-publish.yml` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ jobs:
       - name: Login to MCP Registry
         if: github.event_name != 'workflow_dispatch' || github.event.inputs.dry_run != 'true'
         shell: bash
-        run: mcp-publisher login github
+        run: mcp-publisher login github-oidc
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
 
```

---

### Incident Patch 14: `a46f05c4` (2026-03-03)
**Commit Message**: Revert "Add get_file_url and download_file MCP tools"

This reverts commit dbfd17d901ffdbb43cb470ddb1b8499969761638.

**File**: `cmd/mcpRunner.go` (modified, +3/-155)
```diff
@@ -10,7 +10,6 @@ import (
 	"net/http"
 	"os"
 	"os/exec"
-	"path"
 	"strings"
 	"sync"
 	"time"
@@ -325,16 +324,6 @@ func (s *mcpServer) invalidateHubMCPCache() {
 	s.cachedHubMCP = nil
 }
 
-// getBaseURL returns the hub API base URL by stripping /mcp from hubBaseURL.
-// The hub URL is always the frontend URL + /api, and hubBaseURL is frontendURL/api/mcp.
-// Ensures backend connection is established first.
-func (s *mcpServer) getBaseURL() (string, error) {
-	if errMsg := s.ensureBackendConnection(); errMsg != "" {
-		return "", fmt.Errorf("%s", errMsg)
-	}
-	return strings.TrimSuffix(s.hubBaseURL, "/mcp"), nil
-}
-
 func writeErrorToStderr(format string, args ...any) {
 	fmt.Fprintf(os.Stderr, format+"\n", args...)
 }
@@ -390,14 +379,6 @@ func (s *mcpServer) handleRequest(req *jsonRPCRequest) {
 
 func (s *mcpServer) handleInitialize(req *jsonRPCRequest) {
 	var instructions string
-	fileDownloadInstructions := `
-
-Downloading files (e.g., PCAP exports):
-When a tool like export_snapshot_pcap returns a relative file path, you MUST use the file tools to retrieve the file:
-- get_file_url: Resolves the relative path to a full download URL you can share with the user.
-- download_file: Downloads the file to the local filesystem so it can be opened or analyzed.
-Typical workflow: call export_snapshot_pcap → receive a relative path → call download_file with that path → share the local file path with the user.`
-
 	if s.urlMode {
 		instructions = fmt.Sprintf(`Kubeshark MCP Server - Connected to: %s
 
@@ -411,7 +392,7 @@ Available tools for traffic analysis:
 - get_api_stats: Get aggregated API statistics
 - And more - use tools/list to see all available tools
 
-Use the MCP tools directly - do NOT use kubectl or curl to access Kubeshark.`, s.directURL) + fileDownloadInstructions
+Use the MCP tools directly - do NOT use kubectl or curl to access Kubeshark.`, s.directURL)
 	} else if s.allowDestructive {
 		instructions = `Kubeshark MCP Server - Proxy Mode (Destructive Operations ENABLED)
 
@@ -429,7 +410,7 @@ Safe operations:
 Traffic analysis tools (require Kubeshark to be running):
 - list_workloads, list_api_calls, list_l4_flows, get_api_stats, and more
 
-Use the MCP tools - do NOT use kubectl, helm, or curl directly.` + fileDownloadInstructions
+Use the MCP tools - do NOT use kubectl, helm, or curl directly.`
 	} else {
 		instructions = `Kubeshark MCP Server - Proxy Mode (Read-Only)
 
@@ -444,7 +425,7 @@ Available operations:
 Traffic analysis tools (require Kubeshark to be running):
 - list_workloads, list_api_calls, list_l4_flows, get_api_stats, and more
 
-Use the MCP tools - do NOT use kubectl, helm, or curl directly.` + fileDownloadInstructions
+Use the MCP tools - do NOT use kubectl, helm, or curl directly.`
 	}
 
 	result := mcpInitializeResult{
@@ -475,40 +456,6 @@ func (s *mcpServer) handleListTools(req *jsonRPCRequest) {
 		}`),
 	})
 
-	// Add file URL and download tools - available in all modes
-	tools = append(tools, mcpTool{
-		Name:        "get_file_url",
-		Description: "When a tool (e.g., export_snapshot_pcap) returns a relative file path, use this tool to resolve it into a fully-qualified download URL. The URL can be shared with the user for manual download.",
-		InputSchema: json.RawMessage(`{
-			"type": "object",
-			"properties": {
-				"path": {
-					"type": "string",
-					"description": "The relative file path returned by a Hub tool (e.g., '/snapshots/abc/data.pcap')"
-				}
-			},
-			"required": ["path"]
-		}`),
-	})
-	tools = append(tools, mcpTool{
-		Name:        "download_file",
-		Description: "When a tool (e.g., export_snapshot_pcap) returns a relative file path, use this tool to download the file to the local filesystem. This is the preferred way to retrieve PCAP exports and other files from Kubeshark.",
-		InputSchema: json.RawMessage(`{
-			"type": "object",
-			"properties": {
-				"path": {
-					"type": "string",
-					"description": "The relative file path returned by a Hub tool (e.g., '/snapshots/abc/data.pcap')"
-				},
-				"dest": {
-					"type": "string",
-					"description": "Local destination file path. If not provided, uses the filename from the path in the current directory."
-				}
-			},
-			"required": ["path"]
-		}`),
-	})
-
 	// Add destructive tools only if --allow-destructive flag was set (and not in URL mode)
 	if !s.urlMode && s.allowDestructive {
 		tools = append(tools, mcpTool{
@@ -706,20 +653,6 @@ func (s *mcpServer) handleCallTool(req *jsonRPCRequest) {
 			IsError: isError,
 		})
 		return
-	case "get_file_url":
-		result, isError = s.callGetFileURL(params.Arguments)
-		s.sendResult(req.ID, mcpCallToolResult{
-			Content: []mcpContent{{Type: "text", Text: result}},
-			IsError: isError,
-		})
-		return
-	case "download_file":
-		result, isError = s.callDownloadFile(params.Arguments)
-		s.sendResult(req.ID, mcpCallToolResult{
-			Content: []mcpContent{{Type: "text", Text: result}},
-			IsError: isError,
-		})
-		return
 	}
 
 	// Forward 
```

**File**: `cmd/mcp_test.go` (modified, +5/-198)
```diff
@@ -5,8 +5,6 @@ import (
 	"encoding/json"
 	"net/http"
 	"net/http/httptest"
-	"os"
-	"path/filepath"
 	"strings"
 	"testing"
 )
@@ -128,18 +126,8 @@ func TestMCP_ToolsList_CLIOnly(t *testing.T) {
 		t.Fatalf("Unexpected error: %v", resp.Error)
 	}
 	tools := resp.Result.(map[string]any)["tools"].([]any)
-	// Should have check_kubeshark_status + get_file_url + download_file = 3 tools
-	if len(tools) != 3 {
-		t.Errorf("Expected 3 tools, got %d", len(tools))
-	}
-	toolNames := make(map[string]bool)
-	for _, tool := range tools {
-		toolNames[tool.(map[string]any)["name"].(string)] = true
-	}
-	for _, expected := range []string{"check_kubeshark_status", "get_file_url", "download_file"} {
-		if !toolNames[expected] {
-			t.Errorf("Missing expected tool: %s", expected)
-		}
+	if len(tools) != 1 || tools[0].(map[string]any)["name"] != "check_kubeshark_status" {
+		t.Error("Expected only check_kubeshark_status tool")
 	}
 }
 
@@ -175,9 +163,9 @@ func TestMCP_ToolsList_WithHubBackend(t *testing.T) {
 		t.Fatalf("Unexpected error: %v", resp.Error)
 	}
 	tools := resp.Result.(map[string]any)["tools"].([]any)
-	// Should have CLI tools (3) + file tools (2) + Hub tools (2) = 7 tools
-	if len(tools) < 7 {
-		t.Errorf("Expected at least 7 tools, got %d", len(tools))
+	// Should have CLI tools (3) + Hub tools (2) = 5 tools
+	if len(tools) < 5 {
+		t.Errorf("Expected at least 5 tools, got %d", len(tools))
 	}
 }
 
@@ -475,187 +463,6 @@ func TestMCP_BackendInitialization_Concurrent(t *testing.T) {
 	}
 }
 
-func TestMCP_GetFileURL_ProxyMode(t *testing.T) {
-	s := &mcpServer{
-		httpClient:         &http.Client{},
-		stdin:              &bytes.Buffer{},
-		stdout:             &bytes.Buffer{},
-		hubBaseURL:         "http://127.0.0.1:8899/api/mcp",
-		backendInitialized: true,
-	}
-	resp := parseResponse(t, sendRequest(s, "tools/call", 1, mcpCallToolParams{
-		Name:      "get_file_url",
-		Arguments: map[string]any{"path": "/snapshots/abc/data.pcap"},
-	}))
-	if resp.Error != nil {
-		t.Fatalf("Unexpected error: %v", resp.Error)
-	}
-	text := resp.Result.(map[string]any)["content"].([]any)[0].(map[string]any)["text"].(string)
-	expected := "http://127.0.0.1:8899/api/snapshots/abc/data.pcap"
-	if text != expected {
-		t.Errorf("Expected %q, got %q", expected, text)
-	}
-}
-
-func TestMCP_GetFileURL_URLMode(t *testing.T) {
-	s := &mcpServer{
-		httpClient:         &http.Client{},
-		stdin:              &bytes.Buffer{},
-		stdout:             &bytes.Buffer{},
-		hubBaseURL:         "https://kubeshark.example.com/api/mcp",
-		backendInitialized: true,
-		urlMode:            true,
-		directURL:          "https://kubeshark.example.com",
-	}
-	resp := parseResponse(t, sendRequest(s, "tools/call", 1, mcpCallToolParams{
-		Name:      "get_file_url",
-		Arguments: map[string]any{"path": "/snapshots/xyz/export.pcap"},
-	}))
-	if resp.Error != nil {
-		t.Fatalf("Unexpected error: %v", resp.Error)
-	}
-	text := resp.Result.(map[string]any)["content"].([]any)[0].(map[string]any)["text"].(string)
-	expected := "https://kubeshark.example.com/api/snapshots/xyz/export.pcap"
-	if text != expected {
-		t.Errorf("Expected %q, got %q", expected, text)
-	}
-}
-
-func TestMCP_GetFileURL_MissingPath(t *testing.T) {
-	s := &mcpServer{
-		httpClient:         &http.Client{},
-		stdin:              &bytes.Buffer{},
-		stdout:             &bytes.Buffer{},
-		hubBaseURL:         "http://127.0.0.1:8899/api/mcp",
-		backendInitialized: true,
-	}
-	resp := parseResponse(t, sendRequest(s, "tools/call", 1, mcpCallToolParams{
-		Name:      "get_file_url",
-		Arguments: map[string]any{},
-	}))
-	result := resp.Result.(map[string]any)
-	if !result["isError"].(bool) {
-		t.Error("Expected isError=true when path is missing")
-	}
-	text := result["content"].([]any)[0].(map[string]any)["text"].(string)
-	if !strings.Contains(text, "path") {
-		t.Error("Error message should mention 'path'")
-	}
-}
-
-func TestMCP_DownloadFile(t *testing.T) {
-	fileContent := "test pcap data content"
-	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
-		if r.URL.Path == "/api/snapshots/abc/data.pcap" {
-			_, _ = w.Write([]byte(fileContent))
-		} else {
-			w.WriteHeader(http.StatusNotFound)
-		}
-	}))
-	defer mockServer.Close()
-
-	// Use temp dir for download destination
-	tmpDir := t.TempDir()
-	dest := filepath.Join(tmpDir, "downloaded.pcap")
-
-	s := &mcpServer{
-		httpClient:         &http.Client{},
-		stdin:              &bytes.Buffer{},
-		stdout:             &bytes.Buffer{},
-		hubBaseURL:         mockServer.URL + "/api/mcp",
-		backendInitialized: true,
-	}
-	resp := parseResponse(t, sendRequest(s, "tools/call", 1, mcpCallToolParams{
-		Name:      "download_file",
-		Arguments: map[string]any{"path": "/snapshots/abc/data.pcap", "dest": dest},
-	}))
-	if resp.Error != nil {
-		t.Fatalf("Unexpected error: %v", resp.Error)
-	}
-	result := resp.Result.(map[string]any)
-	if result["isError"] != nil && result["isError"].(bool) {
-		t
```

---

### Incident Patch 15: `1ad61798` (2026-02-18)
**Commit Message**: Set tcp and udp flows timeouts. Default is 20 minutes (#1847)

* Set tcp and udp flows timeouts. Default is 10 minutes

* fix make test

**File**: `cmd/mcp_test.go` (modified, +1/-1)
```diff
@@ -218,7 +218,7 @@ func newTestMCPServerWithMockBackend(handler http.HandlerFunc) (*mcpServer, *htt
 }
 
 type hubToolCallRequest struct {
-	Tool      string         `json:"tool"`
+	Tool      string         `json:"name"`
 	Arguments map[string]any `json:"arguments"`
 }
 
```

**File**: `config/configStructs/tapConfig.go` (modified, +2/-0)
```diff
@@ -261,6 +261,8 @@ type MiscConfig struct {
 	DuplicateTimeframe          string `yaml:"duplicateTimeframe" json:"duplicateTimeframe" default:"200ms"`
 	DetectDuplicates            bool   `yaml:"detectDuplicates" json:"detectDuplicates" default:"false"`
 	StaleTimeoutSeconds         int    `yaml:"staleTimeoutSeconds" json:"staleTimeoutSeconds" default:"30"`
+	TcpFlowTimeout              int    `yaml:"tcpFlowTimeout" json:"tcpFlowTimeout" default:"1200"`
+	UdpFlowTimeout              int    `yaml:"udpFlowTimeout" json:"udpFlowTimeout" default:"1200"`
 }
 
 type PcapDumpConfig struct {
```

**File**: `helm-chart/README.md` (modified, +2/-0)
```diff
@@ -220,6 +220,8 @@ Example for overriding image names:
 | `tap.mountBpf`                            | BPF filesystem needs to be mounted for eBPF to work properly. This helm value determines whether Kubeshark will attempt to mount the filesystem. This option is not required if filesystem is already mounts. │ `true`|
 | `tap.hostNetwork`                         | Enable host network mode for worker DaemonSet pods. When enabled, worker pods use the host's network namespace for direct network access. | `true`                                                                                                                                                                                                                                           |
 | `tap.gitops.enabled`                          | Enable GitOps functionality. This will allow you to use GitOps to manage your Kubeshark configuration. | `false`                                                                                                                                                                                                                                          |
+| `tap.misc.tcpFlowTimeout`                 | TCP flow aggregation timeout in seconds. Controls how long the worker waits before finalizing a TCP flow. | `1200`                                                                                                                                                                                                                                           |
+| `tap.misc.udpFlowTimeout`                 | UDP flow aggregation timeout in seconds. Controls how long the worker waits before finalizing a UDP flow. | `1200`                                                                                                                                                                                                                                           |
 | `logs.file`                               | Logs dump path                      | `""`                                                                                                                                                                                                                                             |
 | `pcapdump.enabled`                        | Enable recording of all traffic captured according to other parameters. Whatever Kubeshark captures, considering pod targeting rules, will be stored in pcap files ready to be viewed by tools                 | `false`                                                                                                                                                                                                                                           |
 | `pcapdump.maxTime`                        | The time window into the past that will be stored. Older traffic will be discarded.  | `2h`                                                                                                                                                                                                                                             |
```

**File**: `helm-chart/templates/09-worker-daemon-set.yaml` (modified, +4/-0)
```diff
@@ -99,6 +99,10 @@ spec:
             - '{{ .Values.tap.misc.resolutionStrategy }}'
             - -staletimeout
             - '{{ .Values.tap.misc.staleTimeoutSeconds }}'
+            - -tcp-flow-full-timeout
+            - '{{ .Values.tap.misc.tcpFlowTimeout }}'
+            - -udp-flow-full-timeout
+            - '{{ .Values.tap.misc.udpFlowTimeout }}'
             - -storage-size
             - '{{ .Values.tap.storageLimit }}'
             - -capture-db-max-size
```

**File**: `helm-chart/values.yaml` (modified, +4/-2)
```diff
@@ -191,8 +191,8 @@ tap:
   - diameter
   - udp-flow
   - tcp-flow
-  - tcp-conn
   - udp-conn
+  - tcp-conn
   portMapping:
     http:
     - 80
@@ -228,6 +228,8 @@ tap:
     duplicateTimeframe: 200ms
     detectDuplicates: false
     staleTimeoutSeconds: 30
+    tcpFlowTimeout: 1200
+    udpFlowTimeout: 1200
   securityContext:
     privileged: true
     appArmorProfile:
@@ -270,7 +272,7 @@ kube:
 dumpLogs: false
 headless: false
 license: ""
-cloudApiUrl: "https://api.kubeshark.com"
+cloudApiUrl: https://api.kubeshark.com
 cloudLicenseEnabled: true
 demoModeEnabled: false
 supportChatEnabled: false
```

**File**: `manifests/complete.yaml` (modified, +14/-8)
```diff
@@ -257,6 +257,7 @@ data:
     EXCLUDED_NAMESPACES: ''
     BPF_OVERRIDE: ''
     DISSECTION_ENABLED: 'true'
+    CAPTURE_SELF: 'false'
     SCRIPTING_SCRIPTS: '{}'
     SCRIPTING_ACTIVE_SCRIPTS: ''
     INGRESS_ENABLED: 'false'
@@ -266,7 +267,7 @@ data:
     AUTH_TYPE: 'default'
     AUTH_SAML_IDP_METADATA_URL: ''
     AUTH_SAML_ROLE_ATTRIBUTE: 'role'
-    AUTH_SAML_ROLES: '{"admin":{"canDownloadPCAP":true,"canStopTrafficCapturing":true,"canUpdateTargetedPods":true,"canUseScripting":true,"filter":"","scriptingPermissions":{"canActivate":true,"canDelete":true,"canSave":true},"showAdminConsoleLink":true}}'
+    AUTH_SAML_ROLES: '{"admin":{"canControlDissection":true,"canDownloadPCAP":true,"canStopTrafficCapturing":true,"canUpdateTargetedPods":true,"canUseScripting":true,"filter":"","scriptingPermissions":{"canActivate":true,"canDelete":true,"canSave":true},"showAdminConsoleLink":true}}'
     AUTH_OIDC_ISSUER: 'not set'
     AUTH_OIDC_REFRESH_TOKEN_LIFETIME: '3960h'
     AUTH_OIDC_STATE_PARAM_EXPIRY: '10m'
@@ -285,7 +286,6 @@ data:
     PCAP_ERROR_TTL: '0'
     TIMEZONE: ' '
     CLOUD_LICENSE_ENABLED: 'true'
-    AI_ASSISTANT_ENABLED: 'true'
     DUPLICATE_TIMEFRAME: '200ms'
     ENABLED_DISSECTORS: 'amqp,dns,http,icmp,kafka,redis,ws,ldap,radius,diameter,udp-flow,tcp-flow,udp-conn,tcp-conn'
     CUSTOM_MACROS: '{"https":"tls and (http or http2)"}'
@@ -606,10 +606,16 @@ spec:
             - 'auto'
             - -staletimeout
             - '30'
+            - -tcp-flow-full-timeout
+            - '1200'
+            - -udp-flow-full-timeout
+            - '1200'
             - -storage-size
             - '10Gi'
             - -capture-db-max-size
             - '500Mi'
+            - -cloud-api-url
+            - 'https://api.kubeshark.com'
           image: 'docker.io/kubeshark/worker:v52.12'
           imagePullPolicy: Always
           name: sniffer
@@ -630,8 +636,6 @@ spec:
             value: '10000'
           - name: TCP_STREAM_CHANNEL_TIMEOUT_SHOW
             value: 'false'
-          - name: KUBESHARK_CLOUD_API_URL
-            value: 'https://api.kubeshark.com'
           - name: PROFILING_ENABLED
             value: 'false'
           - name: SENTRY_ENABLED
@@ -820,6 +824,8 @@ spec:
             - '1'
             - -dissector-memory
             - '4Gi'
+            - -cloud-api-url
+            - 'https://api.kubeshark.com'
           env:
           - name: POD_NAME
             valueFrom:
@@ -833,8 +839,6 @@ spec:
             value: 'false'
           - name: SENTRY_ENVIRONMENT
             value: 'production'
-          - name: KUBESHARK_CLOUD_API_URL
-            value: 'https://api.kubeshark.com'
           - name: PROFILING_ENABLED
             value: 'false'
           image: 'docker.io/kubeshark/hub:v52.12'
@@ -943,6 +947,8 @@ spec:
               value: ' '
             - name: REACT_APP_TIMEZONE
               value: ' '
+            - name: REACT_APP_SCRIPTING_HIDDEN
+              value: 'true'
             - name: REACT_APP_SCRIPTING_DISABLED
               value: 'false'
             - name: REACT_APP_TARGETED_PODS_UPDATE_DISABLED
@@ -953,12 +959,12 @@ spec:
               value: 'true'
             - name: REACT_APP_RECORDING_DISABLED
               value: 'false'
+            - name: REACT_APP_DISSECTION_ENABLED
+              value: 'true'
             - name: REACT_APP_DISSECTION_CONTROL_ENABLED
               value: 'true'
             - name: 'REACT_APP_CLOUD_LICENSE_ENABLED'
               value: 'true'
-            - name: 'REACT_APP_AI_ASSISTANT_ENABLED'
-              value: 'true'
             - name: REACT_APP_SUPPORT_CHAT_ENABLED
               value: 'false'
             - name: REACT_APP_BETA_ENABLED
```

#### Recent Merged Pull Requests:
- **PR #1969** (closed): Link testing methodology from release notes (@corest)
- **PR #1966** (2026-09-09): chart: drop demoModeEnabled in favour of tap.auth.defaultRole (@corest)
- **PR #1965** (closed): cmd: iterate MCP path segments with SplitSeq (@daixiheguu)
- **PR #1964** (closed): Document BoringSSL TLS support (@kVinsom)
- **PR #1962** (2026-09-08): Add support for extra objects in helm chart (@corest)
- **PR #1961** (closed): feat: validate configuration schema version (@kVinsom)
- **PR #1958** (2026-08-13): :bookmark: Release v53.4.0 (@corest)
- **PR #1957** (2026-08-12): mcp: confine download_file destination and harden start_kubeshark argument handling (@corest)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

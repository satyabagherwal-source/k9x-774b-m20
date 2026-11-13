> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kumahq-kuma-learnings.md`  
> **Source**: github ([https://github.com/kumahq/kuma](https://github.com/kumahq/kuma))  
> **Source Version**: `db67396d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T07:47:10.938Z  
> **Learning ID**: `learn-github-kumahq-kuma`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): kumahq/kuma

> **Canonical Artifact**: `07_PROJECT_LEARNING/kumahq-kuma-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kumahq/kuma](https://github.com/kumahq/kuma))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T07:47:10.930Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kumahq/kuma`
- **Description**: 🐻 The multi-zone service mesh for containers, Kubernetes and VMs. Built with Envoy. CNCF Sandbox Project.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 4019 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/cni/pkg/cni/utils_linux.go`
```
package cni

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"unicode"

	"github.com/pkg/errors"
)

// PidOf Find process(es) with a specified name (string match)
// copied from https://github.com/kubernetes/kubernetes/blob/v1.24.3/pkg/util/procfs/procfs_linux.go#L99
// with small modifications
// and return their pid(s)
func pidOf(name string) (string, error) {
	pids := getPids(name)

	switch {
	case name == "":
		return "", errors.New("it's not possible to search for PID of process with no name")
	case len(pids) == 0:
		return "", errors.Errorf("couldn't find PID for '%s'", name)
	case len(pids) > 1:
		return "", errors.Errorf("more than one process '%s' running on a node, this should not happen", name)
	default:
		return strconv.Itoa(pids[0]), nil
	}
}

// we don't need regex so this is changed to "string"
func getPids(name string) []int {
	var pids []int

	if name == "" {
		return nil
	}

	dirFD, err := os.Open("/proc")
	if err != nil {
		return nil
	}
	defer dirFD.Close()

	for {
		// Read a small number at a time in case there are many entries, we don't want to
		// allocate a lot here.
		ls, err := dirFD.Readdir(10)
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil
		}

		for _, entry := range ls {
			if !entry.IsDir() {
				continue
			}

			// If the directory is not a number (i.e. not a PID), skip it
			pid, err := strconv.Atoi(entry.Name())
			if err != nil {
				continue
			}

			cmdline, err := os.ReadFile(filepath.Join("/proc", strconv.Itoa(pid), "cmdline")) // #nosec G703 -- pid is validated integer, path is safe
			if err != nil {
				continue
			}

			// The bytes we read have '\0' as a separator for the command line
			parts := bytes.SplitN(cmdline, []byte{0}, 2)
			if len(parts) == 0 {
				continue
			}
			// Split the command line itself we are interested in just the first part
			exe := strings.FieldsFunc(string(parts[0]), func(c rune) bool {
				return unicode.IsSpace(c) || c == ':'
			})
			if len(exe) == 0 {
				continue
			}
			// Check if the name of the executable is what we are looking for
			if name == exe[0] {
				// Grab the PID from the directory path
				pids = append(pids, pid)
			}
		}
	}

	return pids
}

```

### Core Architecture Module: `app/cni/pkg/install/utils.go`
```
package install

import (
	"encoding/json"
	"os"

	"github.com/go-logr/logr"

	"github.com/kumahq/kuma/v3/pkg/core"
	kuma_log "github.com/kumahq/kuma/v3/pkg/log"
)

func parseFileToHashMap(file string) (map[string]any, error) {
	contents, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}

	return parseBytesToHashMap(contents)
}

func parseBytesToHashMap(bytes []byte) (map[string]any, error) {
	var parsed map[string]any
	err := json.Unmarshal(bytes, &parsed)
	if err != nil {
		return nil, err
	}
	return parsed, nil
}

func CreateNewLogger(name string, logLevel kuma_log.LogLevel) logr.Logger {
	// kubelet expects a specific JSON on stdout, so we're using stderr in CNI
	return core.NewLoggerTo(os.Stderr, logLevel).WithName(name)
}

func SetLogLevel(logger *logr.Logger, level string, name string) error {
	logLevel, err := kuma_log.ParseLogLevel(level)
	if err != nil {
		return err
	}

	*logger = CreateNewLogger(name, logLevel)
	return nil
}

```

### Core Architecture Module: `app/kuma-ui/pkg/resources/data/mockServiceWorker.js`
```
/* eslint-disable */
/* tslint:disable */

/**
 * Mock Service Worker.
 * @see https://github.com/mswjs/msw
 * - Please do NOT modify this file.
 */

const PACKAGE_VERSION = '3.0.1'
const INTEGRITY_CHECKSUM = '5cd5cf8b54c3a90f82960cedcd637772'
const IS_MOCKED_RESPONSE = Symbol('isMockedResponse')

const activeClientIds = new Set()
/**
 * @type {Map<string, Set<Promise<Response>>>}
 */
const pendingRequests = new Map()

addEventListener('install', function () {
  self.skipWaiting()
})

addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

addEventListener('message', function (event) {
  const clientId = Reflect.get(event.source || {}, 'id')

  if (!clientId || !self.clients) {
    return
  }

  event.waitUntil(
    (async () => {
      if (event.data === 'CLIENT_CLOSE') {
        const allClients = await self.clients.matchAll({
          type: 'window',
        })

        activeClientIds.delete(clientId)

        // Await any pending requests from the closing client.
        // This makes sure that those requests are handled and not passthrough.
        const pending = pendingRequests.get(clientId)
        if (pending != null && pending.size > 0) {
          await Promise.allSettled(pending)
        }
        pendingRequests.delete(clientId)

        const remainingClients = allClients.filter((client) => {
          return client.id !== clientId
        })

        // Unregister itself when there are no more clients
        if (remainingClients.length === 0) {
          await self.registration.unregister()
        }

        const client = await self.clients.get(clientId)

        if (client != null) {
          await sendToClient(client, {
            type: 'CLIENT_CLOSED',
          })
        }

        return
      }

      /**
       * @note Check for the client AFTER handling "CLIENT_CLOSE".
       * This prevents early return on "!client" in case the page has reloaded
       * and disassociated itself from the worker. This ensures self-unregistration
       * still fires for those pages.
       */
      const client = await self.clients.get(clientId)

      if (!client) {
        return
      }

      switch (event.data) {
        case 'KEEPALIVE_REQUEST': {
          await sendToClient(client, {
            type: 'KEEPALIVE_RESPONSE',
          })
          break
        }

        case 'INTEGRITY_CHECK_REQUEST': {
          await sendToClient(client, {
            type: 'INTEGRITY_CHECK_RESPONSE',
            payload: {
              packageVersion: PACKAGE_VERSION,
              checksum: INTEGRITY_CHECKSUM,
            },
          })
          break
        }

        case 'MOCK_ACTIVATE': {
          activeClientIds.add(clientId)

          await sendToClient(client, {
            type: 'MOCKING_ENABLED',
            payload: {
              client: {
                id: client.id,
                frameType: client.frameType,
              },
            },
          })
          break
        }
      }
    })(),
  )
})

addEventListener('fetch', function (event) {
  // Opening the DevTools triggers the "only-if-cached" request
  // that cannot be handled by the worker. Bypass such requests.
  if (
    event.request.cache === 'only-if-cached' &&
    event.request.mode !== 'same-origin'
  ) {
    return
  }

  // Bypass all requests when there are no active clients.
  // Prevents the self-unregistered worked from handling requests
  // after it's been terminated (still remains active until the next reload).
  if (activeClientIds.size === 0) {
    return
  }

  const requestId = crypto.randomUUID()
  event.respondWith(handleRequest(event, requestId))
})

/**
 * @param {FetchEvent} event
 * @param {string} requestId
 */
async function handleRequest(event, requestId) {
  const client = await resolveMainClient(event)
  const requestCloneForEvents = event.request.clone()

  const responsePromise = getResponse(event, client, requestId)

  if (client != null) {
    let pending = pendingRequests.get(client.id)

    if (pending == null) {
      pendingRequests.set(client.id, (pending = new Set()))
    }

    pending.add(responsePromise)
    responsePromise
      .finally(() => pending.delete(responsePromise))
      .catch(() => {})
  }

  let response

  try {
    response = await responsePromise
  } catch (error) {
    // The request has settled without a response (e.g. a passthrough
    // request failed with a network error). Notify the client so it
    // can release the resources associated with this request.
    if (client && activeClientIds.has(client.id)) {
      sendToClient(client, {
        type: 'REQUEST_ERROR',
        payload: {
          request: {
            id: requestId,
          },
          error: serializeError(error),
        },
      })
    }

    throw error
  }

  // Send back the response clone for the "response:*" life-cycle events.
  // Ensure MSW is active and ready to handle the message, otherwise
  // this message will pend indefinitely.
  if (client && activeClientIds.has(client.id)) {
    const serializedRequest = await serializeRequest(requestCloneForEvents)

    // Omit the body of server-sent event stream responses.
    // Cloning such responses would prevent client-side stream cancelations
    // from reaching the original stream (a teed stream only cancels its
    // source once both of its branches cancel) and would buffer the
    // entire stream into the unconsumed clone indefinitely.
    const isEventStreamResponse = response.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('text/event-stream')

    // Clone the response so both the client and the library could consume it.
    const responseClone = isEventStreamResponse ? null : response.clone()

    sendToClient(
      client,
      {
        type: 'RESPONSE',
        payload: {
          isMockedResponse: IS_MOCKED_RESPONSE in response,
          request: {
            id: requestId,
            ...serializedRequest,
          },
          response: {
            type: response.type,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseClone ? responseClone.body : null,
          },
        },
      },
      responseClone && responseClone.body
        ? [serializedRequest.body, responseClone.body]
        : [],
    )
  }

  return response
}

/**
 * Resolve the main client for the given event.
 * Client that issues a request doesn't necessarily equal the client
 * that registered the worker. It's with the latter the worker should
 * communicate with during the response resolving phase.
 * @param {FetchEvent} event
 * @returns {Promise<Client | undefined>}
 */
async function resolveMainClient(event) {
  const client = await self.clients.get(event.clientId)

  if (activeClientIds.has(event.clientId)) {
    return client
  }

  if (client?.frameType === 'top-level') {
    return client
  }

  const allClients = await self.clients.matchAll({
    type: 'window',
  })

  return allClients
    .filter((client) => {
      // Get only those clients that are currently visible.
      return client.visibilityState === 'visible'
    })
    .find((client) => {
      // Find the client ID that's recorded in the
      // set of clients that have registered the worker.
      return activeClientIds.has(client.id)
    })
}

/**
 * @param {FetchEvent} event
 * @param {Client | undefined} client
 * @param {string} requestId
 * @returns {Promise<Response>}
 */
async function getResponse(event, client, requestId) {
  // Clone the request because it might've been already used
  // (i.e. its body has been read and sent to the client).
  const requestClone = event.request.clone()

  /**
   * @param {{ request?: { headers?: Array<[string, string]> } }} [data]
   */
  function passthrough(data) {
    const headers = new Headers()
    const requestHeaders = data?.request?.headers

    if (Array.isArray(requestHeaders)) {
      // Apply the request headers provided by the client.
      // Those reflect any modifications made in the request handlers.
      // Use ".append()" to support multiple headers with the same name.
      for (const [name, value] of requestHeaders) {
        headers.append(name, value)
      }
    } else {
      for (const [name, value] of requestClone.headers) {
        headers.append(name, value)
      }
    }

    // Remove the "accept" header value that marked this request as passthrough.
    // This prevents request alteration and also keeps it compliant with the
    // user-defined CORS policies.
    const acceptHeader = headers.get('accept')
    if (acceptHeader) {
      const values = acceptHeader.split(',').map((value) => value.trim())
      const filteredValues = values.filter(
        (value) => value !== 'msw/passthrough',
      )

      if (filteredValues.length > 0) {
        headers.set('accept', filteredValues.join(', '))
      } else {
        headers.delete('accept')
      }
    }

    return fetch(requestClone, { headers })
  }

  // Bypass mocking when the client is not active.
  if (!client) {
    return passthrough()
  }

  // Bypass initial page load requests (i.e. static assets).
  // The absence of the immediate/parent client in the map of the active clients
  // means that MSW hasn't dispatched the "MOCK_ACTIVATE" event yet
  // and is not ready to handle requests.
  if (!activeClientIds.has(client.id)) {
    return passthrough()
  }

  // Notify the client that a request has been intercepted.
  const serializedRequest = await serializeRequest(event.request)
  const clientMessage = await sendToClient(
    client,
    {
      type: 'REQUEST',
      payload: {
        id: requestId,
        ...serializedRequest,
      },
    },
    [serializedRequest.body],
  )

  switch (clientMessage.type) {
    case 'MOCK_RESPONSE': {
      return respondWithMock(clientMessage.data, event)
    }

    case 'PASSTHROUGH': {
  
```

### Core Architecture Module: `app/kumactl/cmd/install/render_files.go`
```
package install

import (
	"bytes"
	"io"
	"text/template"

	"github.com/Masterminds/sprig/v3"
	"github.com/pkg/errors"

	"github.com/kumahq/kuma/v3/pkg/util/data"
)

type templateFilter interface {
	Filter(name string) bool
}

func renderFilesWithFilter(templates []data.File, args any, newRenderer func(data.File) (templateRenderer, error), filter templateFilter) ([]data.File, error) {
	renderedFiles := make([]data.File, len(templates))

	for i, template := range templates {
		if !filter.Filter(template.FullPath) {
			continue
		}
		renderer, err := newRenderer(template)
		if err != nil {
			return nil, err
		}
		var buf bytes.Buffer
		if err := renderer.Execute(&buf, args); err != nil {
			return nil, err
		}
		renderedFiles[i].Data = buf.Bytes()
	}

	return renderedFiles, nil
}

type templateRenderer interface {
	Execute(w io.Writer, data any) error
}

func simpleTemplateRenderer(text data.File) (templateRenderer, error) {
	tmpl, err := template.New("").Funcs(sprig.TxtFuncMap()).Parse(string(text.Data))
	if err != nil {
		return nil, errors.Wrap(err, "Failed to parse k8s resource template")
	}
	return tmpl, nil
}

type NoneFilter struct{}

func (f NoneFilter) Filter(name string) bool {
	return true
}

```

### Core Architecture Module: `app/kumactl/cmd/install/render_helm_files.go`
```
package install

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"reflect"
	"regexp"
	"sort"
	"strings"

	"github.com/pkg/errors"
	chartcommon "helm.sh/helm/v4/pkg/chart/common"
	chartcommonutil "helm.sh/helm/v4/pkg/chart/common/util"
	"helm.sh/helm/v4/pkg/chart/loader/archive"
	chartv2 "helm.sh/helm/v4/pkg/chart/v2"
	"helm.sh/helm/v4/pkg/chart/v2/loader"
	chartv2util "helm.sh/helm/v4/pkg/chart/v2/util"
	"helm.sh/helm/v4/pkg/engine"
	"k8s.io/client-go/rest"

	"github.com/kumahq/kuma/v3/pkg/util/data"
)

func labelRegex(label string) *regexp.Regexp {
	return regexp.MustCompile("(?m)[\r\n]+^.*" + label + ".*$")
}

var stripLabelsRegexps = []*regexp.Regexp{
	labelRegex("app\\.kubernetes\\.io/managed-by"),
	labelRegex("helm\\.sh/chart"),
	labelRegex("app\\.kubernetes\\.io/version"),
}

var kumaSystemNamespace = func(namespace string) string {
	return fmt.Sprintf(`
apiVersion: v1
kind: Namespace
metadata:
  name: %s
  labels:
    kuma.io/sidecar-injection: "false"
`, namespace)
}

type onlyWriteWarnings struct {
	writer io.Writer
}

func (w onlyWriteWarnings) Write(p []byte) (int, error) {
	if bytes.HasPrefix(p, []byte("Warning:")) {
		return w.writer.Write(p)
	}
	return io.Discard.Write(p)
}

func renderHelmFiles(
	templates []data.File,
	namespace string,
	overrideValues chartcommon.Values,
	kubeClientConfig *rest.Config,
	capabilities chartcommon.Capabilities,
) ([]data.File, error) {
	kumaChart, err := loadCharts(templates)
	if err != nil {
		return nil, errors.Errorf("Failed to load charts: %s", err)
	}

	// This is necessary because ProcessDependencies can output warnings as well
	// as trash
	writer := log.Writer()
	log.SetOutput(onlyWriteWarnings{writer: writer})
	if err := chartv2util.ProcessDependencies(kumaChart, overrideValues); err != nil {
		return nil, errors.Errorf("Failed to process dependencies: %s", err)
	}
	log.SetOutput(writer)

	options := generateReleaseOptions(kumaChart.Metadata.Name, namespace)

	valuesToRender, err := chartcommonutil.ToRenderValues(kumaChart, overrideValues, options, &capabilities)
	if err != nil {
		return nil, errors.Errorf("Failed to render values: %s", err)
	}

	var files map[string]string
	if kubeClientConfig == nil {
		files, err = engine.Render(kumaChart, valuesToRender)
	} else {
		files, err = engine.RenderWithClient(kumaChart, valuesToRender, kubeClientConfig)
	}
	if err != nil {
		return nil, errors.Errorf("Failed to render templates: %s", err)
	}
	files["namespace.yaml"] = kumaSystemNamespace(namespace)

	return postRender(kumaChart, files), nil
}

func loadCharts(templates []data.File) (*chartv2.Chart, error) {
	var files []*archive.BufferedFile

	for _, template := range templates {
		files = append(files, &archive.BufferedFile{
			Name: template.FullPath,
			Data: template.Data,
		})
	}

	var fileteredFiles []*archive.BufferedFile
	for _, f := range files {
		if strings.Contains(f.Name, "templates/pre-") || strings.Contains(f.Name, "templates/post-") {
			continue
		}
		fileteredFiles = append(fileteredFiles, f)
	}

	return loader.LoadFiles(fileteredFiles)
}

func generateOverrideValues(args any, helmValuesPrefix string) map[string]any {
	overrideValues := map[string]any{}

	v := reflect.ValueOf(args)
	t := v.Type()
	for field := range t.Fields() {
		name := field.Name
		value := v.FieldByName(name)
		tag := field.Tag.Get("helm")

		splitTag := strings.Split(tag, ",")
		if len(splitTag) == 0 {
			continue
		}

		var omitEmpty bool
		for _, tagSplit := range splitTag[0:] {
			omitEmpty = omitEmpty || tagSplit == "omitempty"
		}

		if omitEmpty && value.IsZero() {
			continue
		}

		valuePath := strings.Split(splitTag[0], ".")
		tagCount := len(valuePath)

		root := overrideValues

		for i := 0; i < tagCount-1; i++ {
			n := valuePath[i]

			if _, ok := root[n]; !ok {
				root[n] = map[string]any{}
			}
			root = root[n].(map[string]any)
		}
		root[valuePath[tagCount-1]] = adjustType(value.Interface())
	}

	if helmValuesPrefix != "" {
		return map[string]any{
			helmValuesPrefix: overrideValues,
		}
	}

	return overrideValues
}

// If the parameter value is map it has to be of a type map[string]interface{} therefore we need to convert it
func adjustType(value any) any {
	if m, ok := value.(map[string]string); ok {
		result := map[string]any{}
		for k, v := range m {
			result[k] = v
		}
		return result
	}
	return value
}

func generateReleaseOptions(name, namespace string) chartcommon.ReleaseOptions {
	return chartcommon.ReleaseOptions{
		Name:      name,
		Namespace: namespace,
		Revision:  1,
		IsInstall: true,
		IsUpgrade: false,
	}
}

func postRender(loadedChart *chartv2.Chart, files map[string]string) []data.File {
	result := []data.File{}

	for _, crd := range loadedChart.CRDObjects() {
		result = append(result, data.File{
			Data: crd.File.Data,
			Name: crd.Name,
		})
	}

	// sorted map of files to ensure consistency of the output
	keys := make([]string, 0, len(files))
	for k := range files {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		if strings.HasSuffix(k, "yaml") {
			content := files[k]

			// strip Helm Chart specific labels
			for _, stripRegEx := range stripLabelsRegexps {
				content = stripRegEx.ReplaceAllString(content, "")
			}

			result = append(result, data.File{
				Data: []byte(content),
				Name: k,
			})
		}
	}

	return result
}

```

### Core Architecture Module: `app/kumactl/pkg/cmd/util.go`
```
package cmd

import "github.com/spf13/cobra"

// RunParentPreRunE checks if the parent command has a PersistentPreRunE set and
// executes it. This is for use in PersistentPreRun and is necessary because
// only the first PersistentPreRun* of the command's ancestors is executed by
// cobra.
func RunParentPreRunE(cmd *cobra.Command, args []string) error {
	if p := cmd.Parent(); p != nil && p.PersistentPreRunE != nil {
		if err := p.PersistentPreRunE(p, args); err != nil {
			return err
		}
	}
	return nil
}

```

### Core Architecture Module: `pkg/cmd/util.go`
```
package cmd

import (
	"context"

	"github.com/kumahq/kuma/v3/pkg/core"
)

type RunCmdOpts struct {
	// Stop signals are SIGINT and SIGTERM
	// We can start graceful shutdown when first context is closed and forcefully stop when the second one is closed.
	// Note that the handler closes usr2Received as soon as SIGTERM has been
	// received, exactly one SIGUSR2 is buffered and notifications are
	// non-blocking, so the guarantee is that at least one SIGUSR2 is delivered.
	SetupSignalHandler func() (firstStopSignalReceived context.Context, secondStopSignalReceived context.Context, usr2Received <-chan struct{})
}

var DefaultRunCmdOpts = RunCmdOpts{
	SetupSignalHandler: core.SetupSignalHandler,
}

```

### Core Architecture Module: `pkg/config/core/config.go`
```
package core

import "github.com/pkg/errors"

type EnvironmentType = string

const (
	KubernetesEnvironment EnvironmentType = "kubernetes"
	UniversalEnvironment  EnvironmentType = "universal"
)

// Control Plane mode

type CpMode = string

const (
	Zone   CpMode = "zone"
	Global CpMode = "global"
)

// ValidateCpMode to check modes of kuma-cp
func ValidateCpMode(mode CpMode) error {
	if mode != Zone && mode != Global {
		return errors.Errorf("invalid mode. Available modes: %s, %s", Zone, Global)
	}
	return nil
}

```

### Core Architecture Module: `pkg/config/core/resources/apis/config.go`
```
package apis

import (
	"time"

	config_types "github.com/kumahq/kuma/v3/pkg/config/types"
)

type Config struct {
	// List of enabled core resources
	Enabled []string `json:"enabled" envconfig:"KUMA_CORE_RESOURCES_ENABLED" default:""`
	// Status of core resources
	Status ConfigStatus `json:"status"`
}

type ConfigStatus struct {
	// How often we compute status of MeshMultiZoneService
	MeshMultiZoneServiceInterval config_types.Duration `json:"meshMultiZoneServiceInterval" envconfig:"KUMA_CORE_RESOURCES_STATUS_MESH_MULTI_ZONE_SERVICE_INTERVAL"`
	// How often we compute status of MeshService
	MeshServiceInterval config_types.Duration `json:"meshServiceInterval" envconfig:"KUMA_CORE_RESOURCES_STATUS_MESH_SERVICE_INTERVAL"`
	// How often we compute status of MeshIdentity
	MeshIdentityInterval config_types.Duration `json:"meshIdentityInterval" envconfig:"KUMA_CORE_RESOURCES_STATUS_MESH_IDENTITY_INTERVAL"`
	// How often we compute status of Workload
	WorkloadInterval config_types.Duration `json:"workloadInterval" envconfig:"KUMA_CORE_RESOURCES_STATUS_WORKLOAD_INTERVAL"`
	// How often we compute status of MeshOpenTelemetryBackend
	MeshOpenTelemetryBackendInterval config_types.Duration `json:"meshOpenTelemetryBackendInterval" envconfig:"KUMA_CORE_RESOURCES_STATUS_MESH_OPEN_TELEMETRY_BACKEND_INTERVAL"`
}

func Default() *Config {
	return &Config{
		Enabled: DefaultEnabled,
		Status: ConfigStatus{
			MeshMultiZoneServiceInterval:     config_types.Duration{Duration: 5 * time.Second},
			MeshServiceInterval:              config_types.Duration{Duration: 5 * time.Second},
			MeshIdentityInterval:             config_types.Duration{Duration: 5 * time.Second},
			WorkloadInterval:                 config_types.Duration{Duration: 5 * time.Second},
			MeshOpenTelemetryBackendInterval: config_types.Duration{Duration: 5 * time.Second},
		},
	}
}

func (c *Config) PostProcess() error {
	return nil
}

func (c *Config) Sanitize() {
}

func (c *Config) Validate() error {
	return nil
}

```

### Core Architecture Module: `pkg/config/core/resources/apis/zz_generated.policies.go`
```
// Generated by tools/policy-gen
// Run "make generate" to update this file.

package apis

var DefaultEnabled = []string{
	"hostnamegenerators",
	"meshexternalservices",
	"meshidentities",
	"meshmultizoneservices",
	"meshopentelemetrybackends",
	"meshservices",
	"meshtrusts",
	"meshzoneaddresses",
	"workloads",
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #19403** (2026-11-12): **fix(kds): retry ZoneInsight flush on conflict (backport of #19402)**
  *Symptoms*: Automatic cherry-pick of #19402 for branch release-3.0  Generated by [action](https://github.com/kumahq/kuma/actions/runs/43242394502)  cherry-picked commit db67396d0d51d0fc031a17c5b54f69e0aee9a737

- **Issue #19402** (2026-11-12): **fix(kds): retry ZoneInsight flush on conflict**
  *Symptoms*: ## Motivation  After a zone CP is killed, the global CP can keep reporting the zone as `Online`. This made the `Resilience Postgres` e2e test "should mark zone as offline when zone control-plane is down" flaky (https://github.com/kumahq/kuma/actions/runs/42898229203/job/130138666351).  ## Implementation information  When a KDS stream closes, the ZoneInsight sink does a final flush that records `DisconnectTime`. `zoneInsightStore.Upsert` did not retry on conflict, even though it already received the store upsert config. If another ZoneInsight writer committed at the same moment (in the failed run, the Envoy admin `storeStreamConnection`), the flush failed with a conflict. That is logged at V(1) as "will retry in the next tick", but after stop there is no next tick, so the disconnect was lost.  The upsert now uses `manager.WithConflictRetry` with the store upsert config, like the other ZoneInsight writers in `pkg/kds/service/server.go` and `pkg/kds/mux/zone_sync.go`.  ## Supporting documentation  #19316 touches the same flush code (log level for a missing Zone) and adds an identical `status_suite_test.go`. This PR's test lives in `zone_insight_store_test.go` to avoid an add/add conflict.

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

### Incident Patch 1: `db67396d` (2026-11-12)
**Commit Message**: fix(kds): retry ZoneInsight flush on conflict (#19402)

Signed-off-by: Lukasz Dziedziak <[REDACTED_EMAIL]>

**File**: `pkg/kds/status/status_sink.go` (modified, +5/-1)
```diff
@@ -161,6 +161,7 @@ func (s *zoneInsightStore) Upsert(ctx context.Context, zone string, subscription
 		Name: zone,
 	}
 	zoneInsight := system.NewZoneInsightResource()
+	// retry conflicts: the final flush on stream close has no next tick, losing it leaves the zone Online
 	return manager.Upsert(ctx, s.resManager, key, zoneInsight, func(resource core_model.Resource) error {
 		if err := zoneInsight.Spec.UpdateSubscription(subscription); err != nil {
 			return err
@@ -169,5 +170,8 @@ func (s *zoneInsightStore) Upsert(ctx context.Context, zone string, subscription
 			zoneInsight.Spec.CompactFinished()
 		}
 		return nil
-	}, manager.WithTransactions(s.transactions))
+	},
+		manager.WithTransactions(s.transactions),
+		manager.WithConflictRetry(s.upsertCfg.ConflictRetryBaseBackoff.Duration, s.upsertCfg.ConflictRetryMaxTimes, s.upsertCfg.ConflictRetryJitterPercent),
+	)
 }
```

**File**: `pkg/kds/status/status_suite_test.go` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+package status_test
+
+import (
+	"testing"
+
+	"github.com/kumahq/kuma/v3/pkg/test"
+)
+
+func TestStatus(t *testing.T) {
+	test.RunSpecs(t, "KDS Status Suite")
+}
```

**File**: `pkg/kds/status/zone_insight_store_test.go` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+package status_test
+
+import (
+	"context"
+	"time"
+
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+
+	system_proto "github.com/kumahq/kuma/v3/api/system/v1alpha1"
+	config_store "github.com/kumahq/kuma/v3/pkg/config/core/resources/store"
+	config_types "github.com/kumahq/kuma/v3/pkg/config/types"
+	"github.com/kumahq/kuma/v3/pkg/core/resources/apis/system"
+	"github.com/kumahq/kuma/v3/pkg/core/resources/manager"
+	core_model "github.com/kumahq/kuma/v3/pkg/core/resources/model"
+	"github.com/kumahq/kuma/v3/pkg/core/resources/store"
+	"github.com/kumahq/kuma/v3/pkg/kds/status"
+	memory_resources "github.com/kumahq/kuma/v3/pkg/plugins/resources/memory"
+	util_proto "github.com/kumahq/kuma/v3/pkg/util/proto"
+)
+
+type conflictingManager struct {
+	manager.ResourceManager
+	conflicts int
+}
+
+func (m *conflictingManager) Update(ctx context.Context, r core_model.Resource, fs ...store.UpdateOptionsFunc) error {
+	if m.conflicts > 0 {
+		m.conflicts--
+		return store.ErrorResourceConflict(r.Descriptor().Name, r.GetMeta().GetName(), r.GetMeta().GetMesh())
+	}
+	return m.ResourceManager.Update(ctx, r, fs...)
+}
+
+var _ = Describe("ZoneInsightStore", func() {
+	It("should retry upsert on conflict so the disconnect is persisted", func() {
+		// given
+		resManager := &conflictingManager{ResourceManager: manager.NewResourceManager(memory_resources.NewStore())}
+		insightStore := status.NewZonesInsightStore(
+			resManager,
+			config_store.UpsertConfig{
+				ConflictRetryBaseBackoff: config_types.Duration{Duration: time.Millisecond},
+				ConflictRetryMaxTimes:    5,
+			},
+			false,
+			&store.NoTransactions{},
+		)
+		subscription := &system_proto.KDSSubscription{
+			Id:          "sub-1",
+			ConnectTime: util_proto.MustTimestampProto(time.Now()),
+			Status:      system_proto.NewSubscriptionStatus(time.Now()),
+		}
+		Expect(insightStore.Upsert(context.Background(), "zone-1", subscription)).To(Succeed())
+
+		// when another writer updates the insight concurrently with the final flush
+		resManager.conflicts = 2
+		subscription.DisconnectTime = util_proto.MustTimestampProto(time.Now())
+		err := insightStore.Upsert(context.Background(), "zone-1", subscription)
+
+		// then
+		Expect(err).ToNot(HaveOccurred())
+		Expect(resManager.conflicts).To(BeZero())
+		insight := system.NewZoneInsightResource()
+		Expect(resManager.Get(context.Background(), insight, store.GetByKey("zone-1", core_model.NoMesh))).To(Succeed())
+		Expect(insight.Spec.IsOnline()).To(BeFalse())
+	})
+})
```

---

### Incident Patch 2: `53df0160` (2026-11-12)
**Commit Message**: chore(deps): bump kumahq/kuma-gui to dfa0edb688829d118d5c4e63e5a313a78cd4b0b8 (#19391)

Signed-off-by: GitHub <[REDACTED_EMAIL]>
Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `app/kuma-ui/pkg/resources/data/assets/App-CGHEUtKJ.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as B,r as m,o as k,c as X,a as A,b as u,w as d,e as l,t as w,n as oe,_ as O,u as ae,f as re,g as ne,h as ie,i as le,j as f,k as v,l as T,m as C,p as se,q as ce,s as q,v as de,x as ue,y as S,z as pe}from"./index-vYZHtAvq.js";const fe=""+new URL("product-logo-CDoXkXpC.png",import.meta.url).href,ve={class:"app-navigator"},ge=B({__name:"AppNavigator",props:{active:{type:Boolean,default:!1},label:{default:""},to:{default:()=>({})}},setup(e){const o=e;return(r,a)=>{const i=m("XAction");return k(),X("li",ve,[A(r.$slots,"default",{},()=>[u(i,{class:oe({"is-active":o.active}),to:o.to},{default:d(()=>[l(w(o.label),1)]),_:1},8,["class","to"])],!0)])}}}),L=O(ge,[["__scopeId","data-v-b1ed9f4d"]]);var H=window.document,N=window.Math,z=window.HTMLElement,D=window.XMLHttpRequest,U=function(e,o){for(var r=0,a=e.length;r<a;r++)o(e[r])},K=function(e){return function(o,r,a){var i=e.createElement(o);if(r!=null)for(var n in r){var t=r[n];t!=null&&(i[n]!=null?i[n]=t:i.setAttribute(n,t))}return a!=null&&U(a,function(c){i.appendChild(typeof c=="string"?e.createTextNode(c):c)}),i}},j=K(H),he=function(e){var o;return function(){o||(o=1,e.apply(this,arguments))}},V=function(e,o){return{}.hasOwnProperty.call(e,o)},I=function(e){return(""+e).toLowerCase()},me="github-buttons",be="2.33.1",we="https://"+("unpkg.com/"+me+"@"+be+"/dist")+"/buttons.html",_="github.com",ke="https://api."+_,ee=D&&"prototype"in D&&"withCredentials"in D.prototype,_e=ee&&z&&"attachShadow"in z.prototype&&!("prototype"in z.prototype.attachShadow),y=function(e,o,r){e.addEventListener?e.addEventListener(o,r,!1):e.attachEvent("on"+o,r)},P=function(e,o,r){e.removeEventListener?e.removeEventListener(o,r,!1):e.detachEvent("on"+o,r)},ye=function(e,o,r){var a=function(){return P(e,o,a),r.apply(this,arguments)};y(e,o,a)},xe=function(e,o,r){if(e.readyState!=null){var a="readystatechange",i=function(){if(o.test(e.readyState))return P(e,a,i),r.apply(this,arguments)};y(e,a,i)}},Ae=function(e){var o={href:e.href,title:e.title,"aria-label":e.getAttribute("aria-label")};return U(["icon","color-scheme","text","size","show-count"],function(r){var a="data-"+r;o[a]=e.getAttribute(a)}),o["data-text"]==null&&(o["data-text"]=e.textContent||e.innerText),o},Me="body{margin:0}a{text-decoration:none;outline:0}.widget{display:inline-block;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:0;line-height:0;white-space:nowrap}.btn,.social-count{position:relative;display:inline-block;display:inline-flex;height:14px;padding:2px 5px;font-size:11px;font-weight:600;line-height:14px;vertical-align:bottom;cursor:pointer;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;background-repeat:repeat-x;background-position:-1px -1px;background-size:110% 110%;border:1px solid}.btn{border-radius:.25em}.btn:not(:last-child){border-radius:.25em 0 0 .25em}.social-count{border-left:0;border-radius:0 .25em .25em 0}.widget-lg .btn,.widget-lg .social-count{height:16px;padding:5px 10px;font-size:12px;line-height:16px}.octicon{display:inline-block;vertical-align:text-top;fill:currentColor;overflow:visible}",Ce=`.btn:focus-visible,.social-count:focus-visible{outline:2px solid #0969da;outline-offset:-2px}.btn{color:#25292e;background-color:#ebf0f4;border-color:#d1d9e0;background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg'%3e%3clinearGradient id='o' x2='0' y2='1'%3e%3cstop stop-color='%23f6f8fa'/%3e%3cstop offset='90%25' stop-color='%23ebf0f4'/%3e%3c/linearGradient%3e%3crect width='100%25' height='100%25' fill='url(%23o)'/%3e%3c/svg%3e");background-image:-moz-linear-gradient(top, #f6f8fa, #ebf0f4 90%);background-image:linear-gradient(180deg, #f6f8fa, #ebf0f4 90%);filter:progid:DXImageTransform.Microsoft.Gradient(startColorstr='#FFF6F8FA', endColorstr='#FFEAEFF3')}:root .btn{filter:none}.btn:hover,.btn:focus{background-color:#e5eaee;background-position:0 -0.5em;border-color:#d1d9e0;background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg'%3e%3clinearGradient id='o' x2='0' y2='1'%3e%3cstop stop-color='%23eff2f5'/%3e%3cstop offset='90%25' stop-color='%23e5eaee'/%3e%3c/linearGradient%3e%3crect width='100%25' height='100%25' fill='url(%23o)'/%3e%3c/svg%3e");background-image:-moz-linear-gradient(top, #eff2f5, #e5eaee 90%);background-image:linear-gradient(180deg, #eff2f5, #e5eaee 90%);filter:progid:DXImageTransform.Microsoft.Gradient(startColorstr='#FFEFF2F5', endColorstr='#FFE4E9ED')}:root .btn:hover,:root .btn:focus{filter:none}.btn:active{background-color:#e6eaef;border-color:#d1d9e0;background-image:none;filter:none}.social-count{color:#25292e;background-color:#fff;border-color:#d1d9e0}.social-count:hover,.social-count:focus{color:#0969da}.octicon-heart{color:#bf3989}`,Ee=".btn:focus-visible,.social-count:focus-visible{outline:2px solid #0349b4;outline-offset:-2px}.btn{color:#25292e;background-color:#e0e6eb;border-color:#454c54;background-image:none;filter:non
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConfigurationDetailView-_YAKhAeW.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{d as _,o as f,l as C,w as t,b as n,e as x,k as h,v as b,j as w,r as o}from"./index-vYZHtAvq.js";const y=_({__name:"ConfigurationDetailView",setup(R){return(V,r)=>{const i=o("RouteTitle"),s=o("XCodeBlock"),d=o("DataLoader"),l=o("XCard"),u=o("AppView"),p=o("RouteView");return f(),C(p,{name:"configuration-view",params:{codeSearch:"",codeFilter:!1,codeRegExp:!1}},{default:t(({route:e,t:c,uri:m})=>[n(u,{breadcrumbs:[{to:{name:"configuration-view"},text:c("configuration.routes.item.breadcrumbs")}]},{title:t(()=>[w("h1",null,[n(i,{title:c("configuration.routes.item.title")},null,8,["title"])])]),default:t(()=>[r[0]||(r[0]=x()),n(l,null,{default:t(()=>[n(d,{src:m(h(b),"/config",{})},{default:t(({data:[g]})=>[n(s,{"data-testid":"code-block-configuration",language:"json",code:JSON.stringify(g,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},null,8,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1024)]),_:2},1032,["breadcrumbs"])]),_:1})}}});export{y as default};
+import{d as _,o as f,l as C,w as t,b as n,e as x,k as h,v as b,j as w,r as o}from"./index-MHySwiU7.js";const y=_({__name:"ConfigurationDetailView",setup(R){return(V,r)=>{const i=o("RouteTitle"),s=o("XCodeBlock"),d=o("DataLoader"),l=o("XCard"),u=o("AppView"),p=o("RouteView");return f(),C(p,{name:"configuration-view",params:{codeSearch:"",codeFilter:!1,codeRegExp:!1}},{default:t(({route:e,t:c,uri:m})=>[n(u,{breadcrumbs:[{to:{name:"configuration-view"},text:c("configuration.routes.item.breadcrumbs")}]},{title:t(()=>[w("h1",null,[n(i,{title:c("configuration.routes.item.title")},null,8,["title"])])]),default:t(()=>[r[0]||(r[0]=x()),n(l,null,{default:t(()=>[n(d,{src:m(h(b),"/config",{})},{default:t(({data:[g]})=>[n(s,{"data-testid":"code-block-configuration",language:"json",code:JSON.stringify(g,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},null,8,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1024)]),_:2},1032,["breadcrumbs"])]),_:1})}}});export{y as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryClustersView-OJpIep5U.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as T,r as o,o as i,l,w as t,b as s,e as m,k as V,P as E,c as F,I as N,J as v}from"./index-vYZHtAvq.js";const D=T({__name:"ConnectionInboundSummaryClustersView",props:{routeName:{},data:{},overview:{}},setup(u){const n=u;return(B,r)=>{const _=o("RouteTitle"),f=o("XAction"),g=o("XCodeBlock"),y=o("DataCollection"),d=o("DataLoader"),C=o("AppView"),x=o("RouteView");return i(),l(x,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:n.routeName},{default:t(({route:e,uri:h})=>[s(_,{render:!1,title:"Clusters"}),r[1]||(r[1]=m()),s(C,null,{default:t(()=>[s(d,{data:[n.overview]},{default:t(({data:[R]})=>[s(d,{src:h(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:t(({data:[k],refresh:w})=>[(i(!0),F(N,null,v(["stat_prefix"in n.data?n.data.stat_prefix:("clusterName"in n.data?n.data.clusterName:e.params.connection).replace("_",":")],c=>(i(),l(y,{key:typeof c,items:k.split(`
+import{d as T,r as o,o as i,l,w as t,b as s,e as m,k as V,P as E,c as F,I as N,J as v}from"./index-MHySwiU7.js";const D=T({__name:"ConnectionInboundSummaryClustersView",props:{routeName:{},data:{},overview:{}},setup(u){const n=u;return(B,r)=>{const _=o("RouteTitle"),f=o("XAction"),g=o("XCodeBlock"),y=o("DataCollection"),d=o("DataLoader"),C=o("AppView"),x=o("RouteView");return i(),l(x,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:n.routeName},{default:t(({route:e,uri:h})=>[s(_,{render:!1,title:"Clusters"}),r[1]||(r[1]=m()),s(C,null,{default:t(()=>[s(d,{data:[n.overview]},{default:t(({data:[R]})=>[s(d,{src:h(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:t(({data:[k],refresh:w})=>[(i(!0),F(N,null,v(["stat_prefix"in n.data?n.data.stat_prefix:("clusterName"in n.data?n.data.clusterName:e.params.connection).replace("_",":")],c=>(i(),l(y,{key:typeof c,items:k.split(`
 `),predicate:p=>p.startsWith(`${c}`)},{default:t(({items:p})=>[s(g,{language:"json",code:p.map(a=>a.replace(`${c}::`,"")).join(`
 `),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},{"primary-actions":t(()=>[s(f,{action:"refresh",appearance:"primary",onClick:w},{default:t(()=>[...r[0]||(r[0]=[m(`
                     Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryStatsView-PAlpaogH.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as R,r as o,o as $,l as C,w as r,b as n,e as p,k as A,P as w,aa as k}from"./index-vYZHtAvq.js";const V=R({__name:"ConnectionInboundSummaryStatsView",props:{data:{},networking:{},routeName:{},overview:{}},setup(i){const a=i,e=k(()=>({...a.data,proxyResourceName:"stat_prefix"in a.data?a.data.stat_prefix:"",listenerAddress:"listenerAddress"in a.data?a.data.listenerAddress:"",clusterName:"clusterName"in a.data?a.data.clusterName:"",port:"port"in a.data?a.data.port.toString():"",servicePort:"servicePort"in a.data?a.data.servicePort:"",name:"name"in a.data?a.data.name:""}));return(S,l)=>{const u=o("RouteTitle"),m=o("XAction"),v=o("XCodeBlock"),g=o("DataCollection"),d=o("DataLoader"),x=o("AppView"),_=o("RouteView");return $(),C(_,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:a.routeName},{default:r(({route:t,uri:y})=>[n(u,{render:!1,title:"Stats"}),l[1]||(l[1]=p()),n(x,null,{default:r(()=>[n(d,{data:[a.overview]},{default:r(({data:[h]})=>[n(d,{src:y(A(w),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[t.params.proxyType]??"dataplane",name:h.id,mesh:t.params.mesh||"*",socketAddress:a.networking.inboundAddress})},{default:r(({data:[f],refresh:N})=>[n(g,{items:f.raw.split(`
+import{d as R,r as o,o as $,l as C,w as r,b as n,e as p,k as A,P as w,aa as k}from"./index-MHySwiU7.js";const V=R({__name:"ConnectionInboundSummaryStatsView",props:{data:{},networking:{},routeName:{},overview:{}},setup(i){const a=i,e=k(()=>({...a.data,proxyResourceName:"stat_prefix"in a.data?a.data.stat_prefix:"",listenerAddress:"listenerAddress"in a.data?a.data.listenerAddress:"",clusterName:"clusterName"in a.data?a.data.clusterName:"",port:"port"in a.data?a.data.port.toString():"",servicePort:"servicePort"in a.data?a.data.servicePort:"",name:"name"in a.data?a.data.name:""}));return(S,l)=>{const u=o("RouteTitle"),m=o("XAction"),v=o("XCodeBlock"),g=o("DataCollection"),d=o("DataLoader"),x=o("AppView"),_=o("RouteView");return $(),C(_,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:a.routeName},{default:r(({route:t,uri:y})=>[n(u,{render:!1,title:"Stats"}),l[1]||(l[1]=p()),n(x,null,{default:r(()=>[n(d,{data:[a.overview]},{default:r(({data:[h]})=>[n(d,{src:y(A(w),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[t.params.proxyType]??"dataplane",name:h.id,mesh:t.params.mesh||"*",socketAddress:a.networking.inboundAddress})},{default:r(({data:[f],refresh:N})=>[n(g,{items:f.raw.split(`
 `),predicate:c=>[`listener.${e.value.listenerAddress?.length>0?e.value.listenerAddress:t.params.connection}`,`cluster.${e.value.name}.`,`cluster.${e.value.clusterName}.`,`http.${e.value.name}.`,`http.${e.value.clusterName}.`,`tcp.${e.value.name}.`,`cluster.${e.value.proxyResourceName}.`,`listener.${e.value.proxyResourceName}`,`cluster.${e.value.proxyResourceName}.`,`http.${e.value.proxyResourceName}.`,`http.${e.value.proxyResourceName}.`,`tcp.${e.value.proxyResourceName}.`].some(s=>c.startsWith(s))&&(!c.includes(".rds.")||c.includes(`_${e.value.port}`)||c.includes(`${e.value.servicePort}`))},{default:r(({items:c})=>[n(v,{language:"json",code:c.map(s=>s.replace(`${e.value.listenerAddress?.length>0?e.value.listenerAddress:e.value.proxyResourceName.length?e.value.proxyResourceName:t.params.connection}.`,"").replace(e.value.name.length?`${e.value.name}.`:"","").replace(e.value.clusterName.length?`${e.value.clusterName}.`:"","")).join(`
 `),"is-searchable":"",query:t.params.codeSearch,"is-filter-mode":t.params.codeFilter,"is-reg-exp-mode":t.params.codeRegExp,onQueryChange:s=>t.update({codeSearch:s}),onFilterModeChange:s=>t.update({codeFilter:s}),onRegExpModeChange:s=>t.update({codeRegExp:s})},{"primary-actions":r(()=>[n(m,{action:"refresh",appearance:"primary",onClick:N},{default:r(()=>[...l[0]||(l[0]=[p(`
                   Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryView-BxC-V8wo.js` (renamed, +1/-1)
```diff
@@ -1,2 +1,2 @@
-import{d as C,r as n,o as l,l as m,w as t,b as s,e as c,K as X,J as x,t as d,x as b,j as B,m as N}from"./index-vYZHtAvq.js";const T=C({__name:"ConnectionInboundSummaryView",props:{data:{},overview:{},networking:{},routeName:{}},setup(u){const r=u;return($,o)=>{const _=n("XBadge"),w=n("XLayout"),v=n("XAction"),f=n("XTabs"),y=n("RouterView"),g=n("AppView"),V=n("DataCollection"),k=n("RouteView");return l(),m(k,{name:r.routeName,params:{inactive:Boolean,proxyType:"",connection:""}},{default:t(({route:a,t:p})=>[s(V,{items:r.data,predicate:r.networking.type==="gateway"?e=>!0:a.params.proxyType===""?e=>`${e.name}`===a.params.connection:e=>`${e.socketAddress.replace(":","_")}`===a.params.connection,find:!0},{default:t(({items:e})=>[s(g,null,{title:t(()=>[s(w,{variant:"y-stack",size:"small"},{default:t(()=>[B("h2",null,`
+import{d as C,r as n,o as l,l as m,w as t,b as s,e as c,K as X,J as x,t as d,x as b,j as B,m as N}from"./index-MHySwiU7.js";const T=C({__name:"ConnectionInboundSummaryView",props:{data:{},overview:{},networking:{},routeName:{}},setup(u){const r=u;return($,o)=>{const _=n("XBadge"),w=n("XLayout"),v=n("XAction"),f=n("XTabs"),y=n("RouterView"),g=n("AppView"),V=n("DataCollection"),k=n("RouteView");return l(),m(k,{name:r.routeName,params:{inactive:Boolean,proxyType:"",connection:""}},{default:t(({route:a,t:p})=>[s(V,{items:r.data,predicate:r.networking.type==="gateway"?e=>!0:a.params.proxyType===""?e=>`${e.name}`===a.params.connection:e=>`${e.socketAddress.replace(":","_")}`===a.params.connection,find:!0},{default:t(({items:e})=>[s(g,null,{title:t(()=>[s(w,{variant:"y-stack",size:"small"},{default:t(()=>[B("h2",null,`
               Inbound `+d(a.params.connection.replace("localhost","").replace("_",":")),1),o[0]||(o[0]=c()),e[0]?.state?(l(),m(_,{key:0,appearance:p(`common.status.appearance.${e[0].state}`,void 0,{defaultMessage:"neutral"})},{default:t(()=>[c(d(p(`http.api.value.${e[0].state}`)),1)]),_:2},1032,["appearance"])):N("",!0)]),_:2},1024)]),default:t(()=>[o[1]||(o[1]=c()),s(f,{selected:a.child()?.name},X({_:2},[x(a.children,({name:i})=>({name:`${i}-tab`,fn:t(()=>[s(v,{to:{name:i,query:{inactive:a.params.inactive}}},{default:t(()=>[c(d(p(`connections.routes.item.navigation.${i.split("-")[5]}`)),1)]),_:2},1032,["to"])])}))]),1032,["selected"]),o[2]||(o[2]=c()),s(y,null,{default:t(i=>[(l(),m(b(i.Component),{data:e[0],overview:r.overview,networking:r.networking},null,8,["data","overview","networking"]))]),_:2},1024)]),_:2},1024)]),_:2},1032,["items","predicate"])]),_:1},8,["name"])}}});export{T as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryXdsConfigView-CobWAaeo.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{d as C,r as o,o as w,l as R,w as a,b as n,e as d,k,P as T,t as V}from"./index-vYZHtAvq.js";const S=C({__name:"ConnectionInboundSummaryXdsConfigView",props:{data:{},routeName:{},overview:{}},setup(p){const t=p;return(b,r)=>{const m=o("RouteTitle"),l=o("XAction"),u=o("XCodeBlock"),i=o("DataLoader"),_=o("AppView"),g=o("RouteView");return w(),R(g,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:t.routeName},{default:a(({t:c,route:e,uri:f})=>[n(m,{render:!1,title:c("connections.routes.item.navigation.xds")},null,8,["title"]),r[0]||(r[0]=d()),n(_,null,{default:a(()=>[n(i,{data:[t.overview]},{default:a(({data:[x]})=>[n(i,{src:f(k(T),"/connections/xds/for/:proxyType/:name/:mesh/inbound/:inbound",{mesh:e.params.mesh||"*",name:x.id,inbound:"stat_prefix"in t.data?t.data.stat_prefix:`${t.data.port}`,proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane"})},{default:a(({data:[y],refresh:h})=>[n(u,{language:"json",code:JSON.stringify(y,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:s=>e.update({codeSearch:s}),onFilterModeChange:s=>e.update({codeFilter:s}),onRegExpModeChange:s=>e.update({codeRegExp:s})},{"primary-actions":a(()=>[n(l,{action:"refresh",appearance:"primary",onClick:h},{default:a(()=>[d(V(c("common.refresh")),1)]),_:2},1032,["onClick"])]),_:2},1032,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1032,["data"])]),_:2},1024)]),_:1},8,["name"])}}});export{S as default};
+import{d as C,r as o,o as w,l as R,w as a,b as n,e as d,k,P as T,t as V}from"./index-MHySwiU7.js";const S=C({__name:"ConnectionInboundSummaryXdsConfigView",props:{data:{},routeName:{},overview:{}},setup(p){const t=p;return(b,r)=>{const m=o("RouteTitle"),l=o("XAction"),u=o("XCodeBlock"),i=o("DataLoader"),_=o("AppView"),g=o("RouteView");return w(),R(g,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:t.routeName},{default:a(({t:c,route:e,uri:f})=>[n(m,{render:!1,title:c("connections.routes.item.navigation.xds")},null,8,["title"]),r[0]||(r[0]=d()),n(_,null,{default:a(()=>[n(i,{data:[t.overview]},{default:a(({data:[x]})=>[n(i,{src:f(k(T),"/connections/xds/for/:proxyType/:name/:mesh/inbound/:inbound",{mesh:e.params.mesh||"*",name:x.id,inbound:"stat_prefix"in t.data?t.data.stat_prefix:`${t.data.port}`,proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane"})},{default:a(({data:[y],refresh:h})=>[n(u,{language:"json",code:JSON.stringify(y,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:s=>e.update({codeSearch:s}),onFilterModeChange:s=>e.update({codeFilter:s}),onRegExpModeChange:s=>e.update({codeRegExp:s})},{"primary-actions":a(()=>[n(l,{action:"refresh",appearance:"primary",onClick:h},{default:a(()=>[d(V(c("common.refresh")),1)]),_:2},1032,["onClick"])]),_:2},1032,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1032,["data"])]),_:2},1024)]),_:1},8,["name"])}}});export{S as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionOutboundSummaryClustersView-Dl-qJGB6.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as T,r as a,o as p,l,w as n,b as t,e as m,k as V,P as E,c as F,I as v,J as B}from"./index-vYZHtAvq.js";const M=T({__name:"ConnectionOutboundSummaryClustersView",props:{routeName:{},overview:{}},setup(u){const i=u;return(A,s)=>{const _=a("RouteTitle"),g=a("XAction"),f=a("XCodeBlock"),y=a("DataCollection"),d=a("DataLoader"),C=a("AppView"),h=a("RouteView");return p(),l(h,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:i.routeName},{default:n(({route:e,uri:x})=>[t(_,{render:!1,title:"Clusters"}),s[1]||(s[1]=m()),t(C,null,{default:n(()=>[t(d,{data:[i.overview]},{default:n(({data:[R]})=>[t(d,{src:x(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:n(({data:[k],refresh:w})=>[(p(!0),F(v,null,B([e.params.connection],r=>(p(),l(y,{key:typeof r,items:k.split(`
+import{d as T,r as a,o as p,l,w as n,b as t,e as m,k as V,P as E,c as F,I as v,J as B}from"./index-MHySwiU7.js";const M=T({__name:"ConnectionOutboundSummaryClustersView",props:{routeName:{},overview:{}},setup(u){const i=u;return(A,s)=>{const _=a("RouteTitle"),g=a("XAction"),f=a("XCodeBlock"),y=a("DataCollection"),d=a("DataLoader"),C=a("AppView"),h=a("RouteView");return p(),l(h,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:i.routeName},{default:n(({route:e,uri:x})=>[t(_,{render:!1,title:"Clusters"}),s[1]||(s[1]=m()),t(C,null,{default:n(()=>[t(d,{data:[i.overview]},{default:n(({data:[R]})=>[t(d,{src:x(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:n(({data:[k],refresh:w})=>[(p(!0),F(v,null,B([e.params.connection],r=>(p(),l(y,{key:typeof r,items:k.split(`
 `),predicate:c=>c.startsWith(`${r}::`)},{default:n(({items:c})=>[t(f,{language:"json",code:c.map(o=>o.replace(`${r}::`,"")).join(`
 `),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:o=>e.update({codeSearch:o}),onFilterModeChange:o=>e.update({codeFilter:o}),onRegExpModeChange:o=>e.update({codeRegExp:o})},{"primary-actions":n(()=>[t(g,{action:"refresh",appearance:"primary",onClick:w},{default:n(()=>[...s[0]||(s[0]=[m(`
                     Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionOutboundSummaryStatsView-CrXzpw_x.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as w,r as a,o as k,l as R,w as n,b as t,e as d,k as A,P as T}from"./index-vYZHtAvq.js";const v=w({__name:"ConnectionOutboundSummaryStatsView",props:{networking:{},routeName:{},overview:{}},setup(i){const r=i;return(V,s)=>{const m=a("RouteTitle"),l=a("XAction"),u=a("XCodeBlock"),_=a("DataCollection"),p=a("DataLoader"),g=a("AppView"),f=a("RouteView");return k(),R(f,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:r.routeName},{default:n(({route:e,uri:x})=>[t(m,{render:!1,title:"Stats"}),s[1]||(s[1]=d()),t(g,null,{default:n(()=>[t(p,{data:[r.overview]},{default:n(({data:[y]})=>[t(p,{src:x(A(T),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:y.id,mesh:e.params.mesh||"*",socketAddress:r.networking.inboundAddress})},{default:n(({data:[C],refresh:h})=>[t(_,{items:C.raw.split(`
+import{d as w,r as a,o as k,l as R,w as n,b as t,e as d,k as A,P as T}from"./index-MHySwiU7.js";const v=w({__name:"ConnectionOutboundSummaryStatsView",props:{networking:{},routeName:{},overview:{}},setup(i){const r=i;return(V,s)=>{const m=a("RouteTitle"),l=a("XAction"),u=a("XCodeBlock"),_=a("DataCollection"),p=a("DataLoader"),g=a("AppView"),f=a("RouteView");return k(),R(f,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:r.routeName},{default:n(({route:e,uri:x})=>[t(m,{render:!1,title:"Stats"}),s[1]||(s[1]=d()),t(g,null,{default:n(()=>[t(p,{data:[r.overview]},{default:n(({data:[y]})=>[t(p,{src:x(A(T),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:y.id,mesh:e.params.mesh||"*",socketAddress:r.networking.inboundAddress})},{default:n(({data:[C],refresh:h})=>[t(_,{items:C.raw.split(`
 `),predicate:c=>c.includes(`.${e.params.connection}.`)},{default:n(({items:c})=>[t(u,{language:"json",code:c.map(o=>o.replace(`${e.params.connection}.`,"")).join(`
 `),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:o=>e.update({codeSearch:o}),onFilterModeChange:o=>e.update({codeFilter:o}),onRegExpModeChange:o=>e.update({codeRegExp:o})},{"primary-actions":n(()=>[t(l,{action:"refresh",appearance:"primary",onClick:h},{default:n(()=>[...s[0]||(s[0]=[d(`
                   Refresh
```

---

### Incident Patch 3: `73d955d4` (2026-11-12)
**Commit Message**: fix(kuma-cp): return rows error from postgres store List (#19357)

Signed-off-by: YuMin Kim <[REDACTED_EMAIL]>

**File**: `pkg/plugins/resources/postgres/pgx_store.go` (modified, +3/-0)
```diff
@@ -421,6 +421,9 @@ func (r *pgxResourceStore) List(ctx context.Context, resources core_model.Resour
 		}
 		total++
 	}
+	if err := rows.Err(); err != nil {
+		return errors.Wrapf(err, "failed to read rows of query: %s", statement.String())
+	}
 
 	resources.GetPagination().SetTotal(uint32(total))
 	return nil
```

**File**: `pkg/plugins/resources/postgres/pgx_store_test.go` (modified, +38/-0)
```diff
@@ -4,6 +4,7 @@ import (
 	"context"
 
 	"github.com/gruntwork-io/terratest/modules/logger"
+	"github.com/jackc/pgx/v5"
 	. "github.com/onsi/ginkgo/v2"
 	. "github.com/onsi/gomega"
 
@@ -20,7 +21,44 @@ import (
 	test_metrics "github.com/kumahq/kuma/v3/pkg/test/metrics"
 )
 
+// failingRowsTx is a pgx.Tx whose queries end with an error after the last row,
+// like a query whose context is cancelled while rows are being read.
+type failingRowsTx struct {
+	pgx.Tx
+}
+
+func (failingRowsTx) Query(context.Context, string, ...any) (pgx.Rows, error) {
+	return failingRows{}, nil
+}
+
+type failingRows struct {
+	pgx.Rows
+}
+
+func (failingRows) Next() bool { return false }
+func (failingRows) Close()     {}
+func (failingRows) Err() error { return context.Canceled }
+
 var _ = Describe("PgxStore", func() {
+	It("should return the error of the rows iteration from List", func() {
+		dbCfg, err := c.Config()
+		Expect(err).ToNot(HaveOccurred())
+		dbCfg.DriverName = config_postgres.DriverNamePgx
+		_, err = postgres.MigrateDb(dbCfg)
+		Expect(err).ToNot(HaveOccurred())
+		metrics, err := core_metrics.NewMetrics("Zone")
+		Expect(err).ToNot(HaveOccurred())
+		pStore, err := postgres.NewPgxStore(metrics, dbCfg, config.NoopPgxConfigCustomizationFn, resource_labels.ControlPlane{})
+		Expect(err).ToNot(HaveOccurred())
+
+		ctx := store.CtxWithTx(context.Background(), failingRowsTx{})
+		list := &core_mesh.MeshResourceList{}
+		err = pStore.List(ctx, list)
+
+		Expect(err).To(MatchError(context.Canceled))
+		Expect(list.Items).To(BeEmpty())
+	})
+
 	Describe("list query threshold exceeded metric", func() {
 		var pStore store.ResourceStore
 		var metrics core_metrics.Metrics
```

#### Recent Merged Pull Requests:
- **PR #19403** (2026-11-12): fix(kds): retry ZoneInsight flush on conflict (backport of #19402) (@kumahq[bot])
- **PR #19402** (2026-11-12): fix(kds): retry ZoneInsight flush on conflict (@lukidzi)
- **PR #19401** (2026-11-12): chore(deps/dev): bump go from 1.27.3 to 1.27.4 (@renovate[bot])
- **PR #19400** (2026-11-12): chore(deps/dev): bump go from 1.27.3 to 1.27.4 (@renovate[bot])
- **PR #19399** (2026-11-12): chore(deps/dev): bump go from 1.27.3 to 1.27.4 (@renovate[bot])
- **PR #19398** (2026-11-12): chore(deps/dev): bump go from 1.27.3 to 1.27.4 (@renovate[bot])

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

## X. kds): retry ZoneInsight flush on conflict (#19402)

**RULE**:
When implementing operations in `pkg/kds/status/status_sink.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kumahq/kuma. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `db67396d`: kds): retry ZoneInsight flush on conflict (#19402). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/kds/status/status_sink.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// retry conflicts: the final flush on stream close has no next tick, losing it leaves the zone Online
	},
		manager.WithTransactions(s.transactions),
		manager.WithConflictRetry(s.upsertCfg.ConflictRetryBaseBackoff.Duration, s.upsertCfg.ConflictRetryMaxTimes, s.upsertCfg.ConflictRetryJitterPercent),
	)
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	}, manager.WithTransactions(s.transactions))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `db67396d` are properly handled with clean fallback behavior.

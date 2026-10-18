> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kumahq-kuma-learnings.md`  
> **Source**: github ([https://github.com/kumahq/kuma](https://github.com/kumahq/kuma))  
> **Source Version**: `fd757fbf`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T23:08:24.867Z  
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
> **Harvest Timestamp**: 2026-10-18T23:08:24.446Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kumahq/kuma`
- **Description**: 🐻 The multi-zone service mesh for containers, Kubernetes and VMs. Built with Envoy. CNCF Sandbox Project.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 4013 stars

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

const PACKAGE_VERSION = '2.11.3'
const INTEGRITY_CHECKSUM = '4db4a41e972cec1b64cc569c66952d82'
const IS_MOCKED_RESPONSE = Symbol('isMockedResponse')
const activeClientIds = new Set()

addEventListener('install', function () {
  self.skipWaiting()
})

addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

addEventListener('message', async function (event) {
  const clientId = Reflect.get(event.source || {}, 'id')

  if (!clientId || !self.clients) {
    return
  }

  const client = await self.clients.get(clientId)

  if (!client) {
    return
  }

  const allClients = await self.clients.matchAll({
    type: 'window',
  })

  switch (event.data) {
    case 'KEEPALIVE_REQUEST': {
      sendToClient(client, {
        type: 'KEEPALIVE_RESPONSE',
      })
      break
    }

    case 'INTEGRITY_CHECK_REQUEST': {
      sendToClient(client, {
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

      sendToClient(client, {
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

    case 'CLIENT_CLOSED': {
      activeClientIds.delete(clientId)

      const remainingClients = allClients.filter((client) => {
        return client.id !== clientId
      })

      // Unregister itself when there are no more clients
      if (remainingClients.length === 0) {
        self.registration.unregister()
      }

      break
    }
  }
})

addEventListener('fetch', function (event) {
  const requestInterceptedAt = Date.now()

  // Bypass navigation requests.
  if (event.request.mode === 'navigate') {
    return
  }

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
  event.respondWith(handleRequest(event, requestId, requestInterceptedAt))
})

/**
 * @param {FetchEvent} event
 * @param {string} requestId
 * @param {number} requestInterceptedAt
 */
async function handleRequest(event, requestId, requestInterceptedAt) {
  const client = await resolveMainClient(event)
  const requestCloneForEvents = event.request.clone()
  const response = await getResponse(
    event,
    client,
    requestId,
    requestInterceptedAt,
  )

  // Send back the response clone for the "response:*" life-cycle events.
  // Ensure MSW is active and ready to handle the message, otherwise
  // this message will pend indefinitely.
  if (client && activeClientIds.has(client.id)) {
    const serializedRequest = await serializeRequest(requestCloneForEvents)

    // Clone the response so both the client and the library could consume it.
    const responseClone = response.clone()

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
            type: responseClone.type,
            status: responseClone.status,
            statusText: responseClone.statusText,
            headers: Object.fromEntries(responseClone.headers.entries()),
            body: responseClone.body,
          },
        },
      },
      responseClone.body ? [serializedRequest.body, responseClone.body] : [],
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
async function getResponse(event, client, requestId, requestInterceptedAt) {
  // Clone the request because it might've been already used
  // (i.e. its body has been read and sent to the client).
  const requestClone = event.request.clone()

  function passthrough() {
    // Cast the request headers to a new Headers instance
    // so the headers can be manipulated with.
    const headers = new Headers(requestClone.headers)

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
        interceptedAt: requestInterceptedAt,
        ...serializedRequest,
      },
    },
    [serializedRequest.body],
  )

  switch (clientMessage.type) {
    case 'MOCK_RESPONSE': {
      return respondWithMock(clientMessage.data)
    }

    case 'PASSTHROUGH': {
      return passthrough()
    }
  }

  return passthrough()
}

/**
 * @param {Client} client
 * @param {any} message
 * @param {Array<Transferable>} transferrables
 * @returns {Promise<any>}
 */
function sendToClient(client, message, transferrables = []) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()

    channel.port1.onmessage = (event) => {
      if (event.data && event.data.error) {
        return reject(event.data.error)
      }

      resolve(event.data)
    }

    client.postMessage(message, [
      channel.port2,
      ...transferrables.filter(Boolean),
    ])
  })
}

/**
 * @param {Response} response
 * @returns {Response}
 */
function respondWithMock(response) {
  // Setting response status code to 0 is a no-op.
  // However, when responding with a "Response.error()", the produced Response
  // instance will have status code set to 0. Since it's not possible to create
  // a Response instance with status code 0, handle that use-case separately.
  if (response.status === 0) {
    return Response.error()
  }

  const mockedResponse = new Response(response.body, response)

  Reflect.defineProperty(mockedResponse, IS_MOCKED_RESPONSE, {
    value: true,
    enumerable: true,
  })

  return mockedResponse
}

/**
 * @param {Request} request
 */
async function serializeRequest(request) {
  return {
    url: request.url,
    mode: request.mode,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    cache: request.cache,
    credentials: request.credentials,
    destination: request.destination,
    integrity: request.integrity,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    body: await request.arrayBuffer(),
    keepalive: request.keepalive,
  }
}

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
- **Issue #19172** (2026-10-15): **chore(deps): bump kumahq/kuma-gui to 7bc1aa62fc048f5be90422982f375fe777027c46**
  *Symptoms*: Bumps kumahq/kuma-gui to version  [master@7bc1aa62fc048f5be90422982f375fe777027c46](https://github.com/kumahq/kuma-gui/tree/7bc1aa62fc048f5be90422982f375fe777027c46)  > Changelog: chore(deps): use latest kumahq/kuma-gui

- **Issue #19169** (2026-10-15): **docs(CHANGELOG.md): updating changelog and version files**
  *Symptoms*: Automated changes by [create-pull-request](https://github.com/peter-evans/create-pull-request) GitHub action

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

### Incident Patch 1: `fd757fbf` (2026-10-15)
**Commit Message**: chore(deps): bump kumahq/kuma-gui to 7bc1aa62fc048f5be90422982f375fe777027c46 (#19172)

Signed-off-by: GitHub <[REDACTED_EMAIL]>
Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `app/kuma-ui/pkg/resources/kuma-gui-cve-report.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"matches":[{"vulnerability":{"id":"GHSA-vfj7-8cjw-p6xm","dataSource":"https://github.com/advisories/GHSA-vfj7-8cjw-p6xm","namespace":"github:language:javascript","severity":"High","urls":["https://nvd.nist.gov/vuln/detail/CVE-2026-93687","https://github.com/micromatch/braces/issues/70","https://github.com/micromatch/braces/blob/3.0.3/lib/compile.js#L49-L53","https://github.com/micromatch/braces/blob/3.0.3/lib/expand.js#L102-L105","https://github.com/micromatch/braces/blob/3.0.3/lib/parse.js#L38-L40","https://www.vulncheck.com/advisories/braces-through-3.0.3-stack-overflow-via-deeply-nested-patterns"],"description":"braces vulnerable to stack-exhaustion denial of service through deeply nested patterns","cvss":[{"type":"Secondary","version":"3.1","vector":"CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H","metrics":{"baseScore":7.5,"exploitabilityScore":3.9,"impactScore":3.6},"vendorMetadata":{}},{"type":"Secondary","version":"4.0","vector":"CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N","metrics":{"baseScore":8.7},"vendorMetadata":{}}],"epss":[{"cve":"CVE-2026-93687","epss":0.00757,"percentile":0.53919,"date":"2026-10-12"}],"cwes":[{"cve":"CVE-2026-93687","cwe":"CWE-674","source":"disclosure@vulncheck.com","type":"Secondary"}],"fix":{"versions":[],"state":"not-fixed"},"advisories":[],"risk":0.59046},"relatedVulnerabilities":[{"id":"CVE-2026-93687","dataSource":"https://nvd.nist.gov/vuln/detail/CVE-2026-93687","namespace":"nvd:cpe","severity":"High","urls":["https://github.com/micromatch/braces","https://github.com/micromatch/braces/blob/3.0.3/lib/compile.js#L49-L53","https://github.com/micromatch/braces/blob/3.0.3/lib/expand.js#L102-L105","https://github.com/micromatch/braces/blob/3.0.3/lib/parse.js#L38-L40","https://github.com/micromatch/braces/issues/70","https://www.vulncheck.com/advisories/braces-through-3.0.3-stack-overflow-via-deeply-nested-patterns","https://github.com/micromatch/braces/issues/73#issuecomment-5996574974"],"description":"braces through 3.0.3 contains a stack overflow vulnerability in the recursive AST walkers that lack depth guards. Attackers can supply deeply nested brace patterns under the character limit to exhaust the call stack and terminate the Node.js process with an uncaught RangeError.","cvss":[{"source":"disclosure@vulncheck.com","type":"Secondary","version":"4.0","vector":"CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N/E:X/CR:X/IR:X/AR:X/MAV:X/MAC:X/MAT:X/MPR:X/MUI:X/MVC:X/MVI:X/MVA:X/MSC:X/MSI:X/MSA:X/S:X/AU:X/R:X/V:X/RE:X/U:X","metrics":{"baseScore":8.7},"vendorMetadata":{}},{"source":"disclosure@vulncheck.com","type":"Secondary","version":"3.1","vector":"CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H","metrics":{"baseScore":7.5,"exploitabilityScore":3.9,"impactScore":3.6},"vendorMetadata":{}}],"epss":[{"cve":"CVE-2026-93687","epss":0.00757,"percentile":0.53919,"date":"2026-10-12"}],"cwes":[{"cve":"CVE-2026-93687","cwe":"CWE-674","source":"disclosure@vulncheck.com","type":"Secondary"}]}],"matchDetails":[{"type":"exact-direct-match","matcher":"javascript-matcher","searchedBy":{"language":"javascript","namespace":"github:language:javascript","package":{"name":"braces","version":"3.0.3"}},"found":{"vulnerabilityID":"GHSA-vfj7-8cjw-p6xm","versionConstraint":"<=3.0.3 (semantic)"}}],"artifact":{"id":"Package-npm-braces-e8863a3d87ad712b","name":"braces","version":"3.0.3","type":"npm","locations":null,"language":"javascript","licenses":["MIT"],"cpes":["cpe:2.3:a:braces_project:braces:3.0.3:*:*:*:*:node.js:*:*","cpe:2.3:a:jonschlinkert:braces:3.0.3:*:*:*:*:node.js:*:*"],"purl":"pkg:npm/braces@3.0.3","upstreams":[]}}],"source":{"type":"directory","target":"kumahq/kuma-gui"},"distro":{"name":"","version":"","idLike":null},"descriptor":{"name":"grype","version":"0.110.0","configuration":{"output":["json"],"file":"/tmp/grype-vAf3c0/output","pretty":false,"distro":"","add-cpes-if-none":true,"output-template-file":"","check-for-app-update":false,"only-fixed":false,"only-notfixed":false,"ignore-wontfix":"","platform":"","search":{"scope":"squashed","unindexed-archives":false,"indexed-archives":true},"ignore":[{"vulnerability":"","include-aliases":false,"reason":"","namespace":"","fix-state":"","package":{"name":"kernel-headers","version":"","language":"","type":"rpm","location":"","upstream-name":"kernel"},"vex-status":"","vex-justification":"","match-type":"exact-indirect-match"},{"vulnerability":"","include-aliases":false,"reason":"","namespace":"","fix-state":"","package":{"name":"linux(-.*)?-headers-.*","version":"","language":"","type":"deb","location":"","upstream-name":"linux.*"},"vex-status":"","vex-justification":"","match-type":"exact-indirect-match"},{"vulnerability":"","include-aliases":false,"reason":"","namespace":"","fix-state":"","package":{"name":"linux-libc-dev","version":"","language":"","type":"deb","location":"","upstream-name":"linux"},"vex-status":"","vex-justification":"","match-type":"exact-indirect-match"}],"exclude":[],
```

---

### Incident Patch 2: `169fd7ea` (2026-10-15)
**Commit Message**: chore(deps): bump kumahq/kuma-gui to e7505e106fc82f8e1f14d7f5a7b7d1b58314b4b7 (#18926)

Signed-off-by: GitHub <[REDACTED_EMAIL]>
Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `app/kuma-ui/pkg/resources/data/assets/App-C21Czq8t.js` (renamed, +3/-3)
```diff
@@ -1,6 +1,6 @@
-import{d as B,r as m,o as k,c as X,a as A,b as u,w as d,e as l,t as w,n as oe,_ as O,u as ae,f as re,g as ne,h as ie,i as le,j as f,k as v,l as T,m as C,p as se,q as ce,s as q,v as de,x as ue,y as S,z as pe}from"./index-C9mgfMZc.js";const fe=""+new URL("product-logo-CDoXkXpC.png",import.meta.url).href,ve={class:"app-navigator"},ge=B({__name:"AppNavigator",props:{active:{type:Boolean,default:!1},label:{default:""},to:{default:()=>({})}},setup(e){const o=e;return(r,a)=>{const i=m("XAction");return k(),X("li",ve,[A(r.$slots,"default",{},()=>[u(i,{class:oe({"is-active":o.active}),to:o.to},{default:d(()=>[l(w(o.label),1)]),_:1},8,["class","to"])],!0)])}}}),L=O(ge,[["__scopeId","data-v-b1ed9f4d"]]);var H=window.document,N=window.Math,z=window.HTMLElement,D=window.XMLHttpRequest,U=function(e,o){for(var r=0,a=e.length;r<a;r++)o(e[r])},K=function(e){return function(o,r,a){var i=e.createElement(o);if(r!=null)for(var n in r){var t=r[n];t!=null&&(i[n]!=null?i[n]=t:i.setAttribute(n,t))}return a!=null&&U(a,function(c){i.appendChild(typeof c=="string"?e.createTextNode(c):c)}),i}},j=K(H),he=function(e){var o;return function(){o||(o=1,e.apply(this,arguments))}},V=function(e,o){return{}.hasOwnProperty.call(e,o)},I=function(e){return(""+e).toLowerCase()},me="github-buttons",be="2.33.0",we="https://"+("unpkg.com/"+me+"@"+be+"/dist")+"/buttons.html",_="github.com",ke="https://api."+_,ee=D&&"prototype"in D&&"withCredentials"in D.prototype,_e=ee&&z&&"attachShadow"in z.prototype&&!("prototype"in z.prototype.attachShadow),y=function(e,o,r){e.addEventListener?e.addEventListener(o,r,!1):e.attachEvent("on"+o,r)},P=function(e,o,r){e.removeEventListener?e.removeEventListener(o,r,!1):e.detachEvent("on"+o,r)},ye=function(e,o,r){var a=function(){return P(e,o,a),r.apply(this,arguments)};y(e,o,a)},xe=function(e,o,r){if(e.readyState!=null){var a="readystatechange",i=function(){if(o.test(e.readyState))return P(e,a,i),r.apply(this,arguments)};y(e,a,i)}},Ae=function(e){var o={href:e.href,title:e.title,"aria-label":e.getAttribute("aria-label")};return U(["icon","color-scheme","text","size","show-count"],function(r){var a="data-"+r;o[a]=e.getAttribute(a)}),o["data-text"]==null&&(o["data-text"]=e.textContent||e.innerText),o},Me="body{margin:0}a{text-decoration:none;outline:0}.widget{display:inline-block;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:0;line-height:0;white-space:nowrap}.btn,.social-count{position:relative;display:inline-block;display:inline-flex;height:14px;padding:2px 5px;font-size:11px;font-weight:600;line-height:14px;vertical-align:bottom;cursor:pointer;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;background-repeat:repeat-x;background-position:-1px -1px;background-size:110% 110%;border:1px solid}.btn{border-radius:.25em}.btn:not(:last-child){border-radius:.25em 0 0 .25em}.social-count{border-left:0;border-radius:0 .25em .25em 0}.widget-lg .btn,.widget-lg .social-count{height:16px;padding:5px 10px;font-size:12px;line-height:16px}.octicon{display:inline-block;vertical-align:text-top;fill:currentColor;overflow:visible}",Ce=`.btn:focus-visible,.social-count:focus-visible{outline:2px solid #0969da;outline-offset:-2px}.btn{color:#25292e;background-color:#ebf0f4;border-color:#d1d9e0;background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg'%3e%3clinearGradient id='o' x2='0' y2='1'%3e%3cstop stop-color='%23f6f8fa'/%3e%3cstop offset='90%25' stop-color='%23ebf0f4'/%3e%3c/linearGradient%3e%3crect width='100%25' height='100%25' fill='url(%23o)'/%3e%3c/svg%3e");background-image:-moz-linear-gradient(top, #f6f8fa, #ebf0f4 90%);background-image:linear-gradient(180deg, #f6f8fa, #ebf0f4 90%);filter:progid:DXImageTransform.Microsoft.Gradient(startColorstr='#FFF6F8FA', endColorstr='#FFEAEFF3')}:root .btn{filter:none}.btn:hover,.btn:focus{background-color:#e5eaee;background-position:0 -0.5em;border-color:#d1d9e0;background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg'%3e%3clinearGradient id='o' x2='0' y2='1'%3e%3cstop stop-color='%23eff2f5'/%3e%3cstop offset='90%25' stop-color='%23e5eaee'/%3e%3c/linearGradient%3e%3crect width='100%25' height='100%25' fill='url(%23o)'/%3e%3c/svg%3e");background-image:-moz-linear-gradient(top, #eff2f5, #e5eaee 90%);background-image:linear-gradient(180deg, #eff2f5, #e5eaee 90%);filter:progid:DXImageTransform.Microsoft.Gradient(startColorstr='#FFEFF2F5', endColorstr='#FFE4E9ED')}:root .btn:hover,:root .btn:focus{filter:none}.btn:active{background-color:#e6eaef;border-color:#d1d9e0;background-image:none;filter:none}.social-count{color:#25292e;background-color:#fff;border-color:#d1d9e0}.social-count:hover,.social-count:focus{color:#0969da}.octicon-heart{color:#bf3989}`,Ee=".btn:focus-visible,.social-count:focus-visible{outline:2px solid #0349b4;outline-offset:-2px}.btn{color:#25292e;background-color:#e0e6eb;border-color:#454c54;background-image:none;filter:non
```

**File**: `app/kuma-ui/pkg/resources/data/assets/App-ClBTXOwR.css` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-.app-navigator[data-v-b1ed9f4d]:before{content:none}[data-v-b1ed9f4d] a:before{content:"";animation-name:var(--icon-name-start),icon-size-40;margin-right:var(--x-space-40)}.application-shell[data-v-f0210e4d]{--kuma-app-top: 60px;--x-drawer-offset-top: var(--kuma-app-top);--AppSidebarWidth: 240px;--AppContentPadding: var(--x-space-80)}.app-content-container[data-v-f0210e4d]{display:grid;padding-top:var(--kuma-app-top, initial);grid-template-columns:var(--AppSidebarWidth) minmax(0,1fr)}.drawer[data-v-f0210e4d]{position:absolute;z-index:1;pointer-events:none}main[data-v-f0210e4d]{min-height:calc(100vh - var(--kuma-app-top))}.app-main-content[data-v-f0210e4d]{padding:var(--AppContentPadding)}header[data-v-f0210e4d]{position:fixed;z-index:11;top:0;left:0;width:100%;height:var(--kuma-app-top);display:flex;justify-content:space-between;align-items:center;gap:var(--x-space-80);padding-right:var(--x-space-80);padding-left:var(--x-space-80);border-bottom:var(--x-border-width-10) solid var(--x-color-border);background-color:var(--x-color-background)}.horizontal-list[data-v-f0210e4d]{display:flex;align-items:center;gap:var(--x-space-80)}.app-sidebar[data-v-f0210e4d]{position:static}nav[data-v-f0210e4d]{position:fixed;padding:0;width:var(--AppSidebarWidth);z-index:10;top:var(--kuma-app-top);bottom:0;left:0;overflow-y:auto;padding:var(--x-space-40) var(--x-space-40) var(--x-space-80) var(--x-space-40);border-right:var(--x-border-width-10) solid var(--x-color-border);background-color:var(--x-color-background);display:flex;flex-flow:column nowrap}.navigation-separator[data-v-f0210e4d]{width:calc(100% - 2 * var(--x-space-40));margin:var(--x-space-80) var(--x-space-40);height:1px;background-color:var(--x-color-border)}nav ul[data-v-f0210e4d]{list-style-type:none;padding:0!important;margin:0!important}nav[data-v-f0210e4d] .app-navigator+.app-navigator{margin-top:var(--x-space-20)}nav[data-v-f0210e4d] .app-navigator>a{width:100%;display:inline-block;padding:var(--x-space-40) var(--x-space-60) var(--x-space-40) var(--x-space-70);border-radius:5px;text-decoration:none;color:currentColor;font-size:var(--x-font-size-40)}nav[data-v-f0210e4d] .app-navigator>a:hover,nav[data-v-f0210e4d] .app-navigator>a:is(.is-active){background-color:var(--x-color-background-neutral-weaker)}.gh-star[data-v-f0210e4d]{height:20px}.app-status[data-v-f0210e4d]{margin-top:0;color:var(--x-color-text-neutral)}.app-status--desktop[data-v-f0210e4d]{display:none}@media screen and (min-width:1005px){.app-status--desktop[data-v-f0210e4d]{display:block}}.app-status--mobile[data-v-f0210e4d]{display:block}@media screen and (min-width:1005px){.app-status--mobile[data-v-f0210e4d]{display:none}}@media screen and (max-width:800px){.upgrade-check-wrapper[data-v-f0210e4d]{display:none}}.upgrade-check-wrapper .upgrade-alert[data-v-f0210e4d]{padding:var(--x-space-20) var(--x-space-40);font-size:var(--x-font-size-30)}.upgrade-check-wrapper .upgrade-alert[data-v-f0210e4d]{display:flex;align-items:center;gap:var(--x-space-50)}.logo[data-v-9ab4494e]{max-height:36px}
```

**File**: `app/kuma-ui/pkg/resources/data/assets/App-Kt4kSo1S.css` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+.app-navigator[data-v-b1ed9f4d]:before{content:none}[data-v-b1ed9f4d] a:before{content:"";animation-name:var(--icon-name-start),icon-size-40;margin-right:var(--x-space-40)}.application-shell[data-v-f9852905]{--kuma-app-top: 60px;--x-drawer-offset-top: var(--kuma-app-top);--AppSidebarWidth: 240px;--AppContentPadding: var(--x-space-80)}.app-content-container[data-v-f9852905]{display:grid;padding-top:var(--kuma-app-top, initial);grid-template-columns:var(--AppSidebarWidth) minmax(0,1fr)}.drawer[data-v-f9852905]{position:absolute;z-index:1;pointer-events:none}main[data-v-f9852905]{min-height:calc(100vh - var(--kuma-app-top))}.app-main-content[data-v-f9852905]{padding:var(--AppContentPadding)}header[data-v-f9852905]{position:fixed;z-index:11;top:0;left:0;width:100%;height:var(--kuma-app-top);display:flex;justify-content:space-between;align-items:center;gap:var(--x-space-80);padding-right:var(--x-space-80);padding-left:var(--x-space-80);border-bottom:var(--x-border-width-10) solid var(--x-color-border);background-color:var(--x-color-background)}.horizontal-list[data-v-f9852905]{display:flex;align-items:center;gap:var(--x-space-80)}.app-sidebar[data-v-f9852905]{position:static}nav[data-v-f9852905]{position:fixed;padding:0;width:var(--AppSidebarWidth);z-index:10;top:var(--kuma-app-top);bottom:0;left:0;overflow-y:auto;padding:var(--x-space-40) var(--x-space-40) var(--x-space-80) var(--x-space-40);border-right:var(--x-border-width-10) solid var(--x-color-border);background-color:var(--x-color-background);display:flex;flex-flow:column nowrap}.navigation-separator[data-v-f9852905]{width:calc(100% - 2 * var(--x-space-40));margin:var(--x-space-80) var(--x-space-40);height:1px;background-color:var(--x-color-border)}nav ul[data-v-f9852905]{list-style-type:none;padding:0!important;margin:0!important}nav[data-v-f9852905] .app-navigator+.app-navigator{margin-top:var(--x-space-20)}nav[data-v-f9852905] .app-navigator>a{width:100%;display:inline-block;padding:var(--x-space-40) var(--x-space-60) var(--x-space-40) var(--x-space-70);border-radius:5px;text-decoration:none;color:currentColor;font-size:var(--x-font-size-40)}nav[data-v-f9852905] .app-navigator>a:hover,nav[data-v-f9852905] .app-navigator>a:is(.is-active){background-color:var(--x-color-background-neutral-weaker)}.gh-star[data-v-f9852905]{height:20px}.app-status[data-v-f9852905]{margin-top:0;color:var(--x-color-text-neutral)}.app-status--desktop[data-v-f9852905]{display:none}@media screen and (min-width:1005px){.app-status--desktop[data-v-f9852905]{display:block}}.app-status--mobile[data-v-f9852905]{display:block}@media screen and (min-width:1005px){.app-status--mobile[data-v-f9852905]{display:none}}@media screen and (max-width:800px){.upgrade-check-wrapper[data-v-f9852905]{display:none}}.upgrade-check-wrapper .upgrade-alert[data-v-f9852905]{padding:var(--x-space-20) var(--x-space-40);font-size:var(--x-font-size-30)}.upgrade-check-wrapper .upgrade-alert[data-v-f9852905]{display:flex;align-items:center;gap:var(--x-space-50)}.logo[data-v-9ab4494e]{max-height:36px}
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConfigurationDetailView-7W0CIK6Y.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{d as _,o as f,l as C,w as t,b as n,e as x,k as h,v as b,j as w,r as o}from"./index-C9mgfMZc.js";const y=_({__name:"ConfigurationDetailView",setup(R){return(V,r)=>{const i=o("RouteTitle"),s=o("XCodeBlock"),d=o("DataLoader"),l=o("XCard"),u=o("AppView"),p=o("RouteView");return f(),C(p,{name:"configuration-view",params:{codeSearch:"",codeFilter:!1,codeRegExp:!1}},{default:t(({route:e,t:c,uri:m})=>[n(u,{breadcrumbs:[{to:{name:"configuration-view"},text:c("configuration.routes.item.breadcrumbs")}]},{title:t(()=>[w("h1",null,[n(i,{title:c("configuration.routes.item.title")},null,8,["title"])])]),default:t(()=>[r[0]||(r[0]=x()),n(l,null,{default:t(()=>[n(d,{src:m(h(b),"/config",{})},{default:t(({data:[g]})=>[n(s,{"data-testid":"code-block-configuration",language:"json",code:JSON.stringify(g,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},null,8,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1024)]),_:2},1032,["breadcrumbs"])]),_:1})}}});export{y as default};
+import{d as _,o as f,l as C,w as t,b as n,e as x,k as h,v as b,j as w,r as o}from"./index-BNNMjRXa.js";const y=_({__name:"ConfigurationDetailView",setup(R){return(V,r)=>{const i=o("RouteTitle"),s=o("XCodeBlock"),d=o("DataLoader"),l=o("XCard"),u=o("AppView"),p=o("RouteView");return f(),C(p,{name:"configuration-view",params:{codeSearch:"",codeFilter:!1,codeRegExp:!1}},{default:t(({route:e,t:c,uri:m})=>[n(u,{breadcrumbs:[{to:{name:"configuration-view"},text:c("configuration.routes.item.breadcrumbs")}]},{title:t(()=>[w("h1",null,[n(i,{title:c("configuration.routes.item.title")},null,8,["title"])])]),default:t(()=>[r[0]||(r[0]=x()),n(l,null,{default:t(()=>[n(d,{src:m(h(b),"/config",{})},{default:t(({data:[g]})=>[n(s,{"data-testid":"code-block-configuration",language:"json",code:JSON.stringify(g,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},null,8,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1024)]),_:2},1032,["breadcrumbs"])]),_:1})}}});export{y as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryClustersView-DH_n0wod.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as T,r as o,o as i,l,w as t,b as s,e as m,k as V,Q as E,c as F,I as N,J as v}from"./index-C9mgfMZc.js";const D=T({__name:"ConnectionInboundSummaryClustersView",props:{routeName:{},data:{},overview:{}},setup(u){const n=u;return(B,r)=>{const _=o("RouteTitle"),f=o("XAction"),g=o("XCodeBlock"),y=o("DataCollection"),d=o("DataLoader"),C=o("AppView"),x=o("RouteView");return i(),l(x,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:n.routeName},{default:t(({route:e,uri:h})=>[s(_,{render:!1,title:"Clusters"}),r[1]||(r[1]=m()),s(C,null,{default:t(()=>[s(d,{data:[n.overview]},{default:t(({data:[R]})=>[s(d,{src:h(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:t(({data:[k],refresh:w})=>[(i(!0),F(N,null,v(["stat_prefix"in n.data?n.data.stat_prefix:("clusterName"in n.data?n.data.clusterName:e.params.connection).replace("_",":")],c=>(i(),l(y,{key:typeof c,items:k.split(`
+import{d as T,r as o,o as i,l,w as t,b as s,e as m,k as V,P as E,c as F,I as N,J as v}from"./index-BNNMjRXa.js";const D=T({__name:"ConnectionInboundSummaryClustersView",props:{routeName:{},data:{},overview:{}},setup(u){const n=u;return(B,r)=>{const _=o("RouteTitle"),f=o("XAction"),g=o("XCodeBlock"),y=o("DataCollection"),d=o("DataLoader"),C=o("AppView"),x=o("RouteView");return i(),l(x,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:n.routeName},{default:t(({route:e,uri:h})=>[s(_,{render:!1,title:"Clusters"}),r[1]||(r[1]=m()),s(C,null,{default:t(()=>[s(d,{data:[n.overview]},{default:t(({data:[R]})=>[s(d,{src:h(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:t(({data:[k],refresh:w})=>[(i(!0),F(N,null,v(["stat_prefix"in n.data?n.data.stat_prefix:("clusterName"in n.data?n.data.clusterName:e.params.connection).replace("_",":")],c=>(i(),l(y,{key:typeof c,items:k.split(`
 `),predicate:p=>p.startsWith(`${c}`)},{default:t(({items:p})=>[s(g,{language:"json",code:p.map(a=>a.replace(`${c}::`,"")).join(`
 `),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},{"primary-actions":t(()=>[s(f,{action:"refresh",appearance:"primary",onClick:w},{default:t(()=>[...r[0]||(r[0]=[m(`
                     Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryStatsView-Cwz2aZb3.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as R,r as o,o as $,l as C,w as r,b as n,e as p,k as A,Q as w,a8 as k}from"./index-C9mgfMZc.js";const V=R({__name:"ConnectionInboundSummaryStatsView",props:{data:{},networking:{},routeName:{},overview:{}},setup(i){const a=i,e=k(()=>({...a.data,proxyResourceName:"stat_prefix"in a.data?a.data.stat_prefix:"",listenerAddress:"listenerAddress"in a.data?a.data.listenerAddress:"",clusterName:"clusterName"in a.data?a.data.clusterName:"",port:"port"in a.data?a.data.port.toString():"",servicePort:"servicePort"in a.data?a.data.servicePort:"",name:"name"in a.data?a.data.name:""}));return(S,l)=>{const u=o("RouteTitle"),m=o("XAction"),v=o("XCodeBlock"),g=o("DataCollection"),d=o("DataLoader"),x=o("AppView"),_=o("RouteView");return $(),C(_,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:a.routeName},{default:r(({route:t,uri:y})=>[n(u,{render:!1,title:"Stats"}),l[1]||(l[1]=p()),n(x,null,{default:r(()=>[n(d,{data:[a.overview]},{default:r(({data:[h]})=>[n(d,{src:y(A(w),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[t.params.proxyType]??"dataplane",name:h.id,mesh:t.params.mesh||"*",socketAddress:a.networking.inboundAddress})},{default:r(({data:[f],refresh:N})=>[n(g,{items:f.raw.split(`
+import{d as R,r as o,o as $,l as C,w as r,b as n,e as p,k as A,P as w,a7 as k}from"./index-BNNMjRXa.js";const V=R({__name:"ConnectionInboundSummaryStatsView",props:{data:{},networking:{},routeName:{},overview:{}},setup(i){const a=i,e=k(()=>({...a.data,proxyResourceName:"stat_prefix"in a.data?a.data.stat_prefix:"",listenerAddress:"listenerAddress"in a.data?a.data.listenerAddress:"",clusterName:"clusterName"in a.data?a.data.clusterName:"",port:"port"in a.data?a.data.port.toString():"",servicePort:"servicePort"in a.data?a.data.servicePort:"",name:"name"in a.data?a.data.name:""}));return(S,l)=>{const u=o("RouteTitle"),m=o("XAction"),v=o("XCodeBlock"),g=o("DataCollection"),d=o("DataLoader"),x=o("AppView"),_=o("RouteView");return $(),C(_,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:a.routeName},{default:r(({route:t,uri:y})=>[n(u,{render:!1,title:"Stats"}),l[1]||(l[1]=p()),n(x,null,{default:r(()=>[n(d,{data:[a.overview]},{default:r(({data:[h]})=>[n(d,{src:y(A(w),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[t.params.proxyType]??"dataplane",name:h.id,mesh:t.params.mesh||"*",socketAddress:a.networking.inboundAddress})},{default:r(({data:[f],refresh:N})=>[n(g,{items:f.raw.split(`
 `),predicate:c=>[`listener.${e.value.listenerAddress?.length>0?e.value.listenerAddress:t.params.connection}`,`cluster.${e.value.name}.`,`cluster.${e.value.clusterName}.`,`http.${e.value.name}.`,`http.${e.value.clusterName}.`,`tcp.${e.value.name}.`,`cluster.${e.value.proxyResourceName}.`,`listener.${e.value.proxyResourceName}`,`cluster.${e.value.proxyResourceName}.`,`http.${e.value.proxyResourceName}.`,`http.${e.value.proxyResourceName}.`,`tcp.${e.value.proxyResourceName}.`].some(s=>c.startsWith(s))&&(!c.includes(".rds.")||c.includes(`_${e.value.port}`)||c.includes(`${e.value.servicePort}`))},{default:r(({items:c})=>[n(v,{language:"json",code:c.map(s=>s.replace(`${e.value.listenerAddress?.length>0?e.value.listenerAddress:e.value.proxyResourceName.length?e.value.proxyResourceName:t.params.connection}.`,"").replace(e.value.name.length?`${e.value.name}.`:"","").replace(e.value.clusterName.length?`${e.value.clusterName}.`:"","")).join(`
 `),"is-searchable":"",query:t.params.codeSearch,"is-filter-mode":t.params.codeFilter,"is-reg-exp-mode":t.params.codeRegExp,onQueryChange:s=>t.update({codeSearch:s}),onFilterModeChange:s=>t.update({codeFilter:s}),onRegExpModeChange:s=>t.update({codeRegExp:s})},{"primary-actions":r(()=>[n(m,{action:"refresh",appearance:"primary",onClick:N},{default:r(()=>[...l[0]||(l[0]=[p(`
                   Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryView-DHzjHbgV.js` (renamed, +1/-1)
```diff
@@ -1,2 +1,2 @@
-import{d as C,r as n,o as l,l as m,w as t,b as s,e as c,K as X,J as x,t as d,x as b,j as B,m as N}from"./index-C9mgfMZc.js";const T=C({__name:"ConnectionInboundSummaryView",props:{data:{},overview:{},networking:{},routeName:{}},setup(u){const r=u;return($,o)=>{const _=n("XBadge"),w=n("XLayout"),v=n("XAction"),f=n("XTabs"),y=n("RouterView"),g=n("AppView"),V=n("DataCollection"),k=n("RouteView");return l(),m(k,{name:r.routeName,params:{inactive:Boolean,proxyType:"",connection:""}},{default:t(({route:a,t:p})=>[s(V,{items:r.data,predicate:r.networking.type==="gateway"?e=>!0:a.params.proxyType===""?e=>`${e.name}`===a.params.connection:e=>`${e.socketAddress.replace(":","_")}`===a.params.connection,find:!0},{default:t(({items:e})=>[s(g,null,{title:t(()=>[s(w,{variant:"y-stack",size:"small"},{default:t(()=>[B("h2",null,`
+import{d as C,r as n,o as l,l as m,w as t,b as s,e as c,K as X,J as x,t as d,x as b,j as B,m as N}from"./index-BNNMjRXa.js";const T=C({__name:"ConnectionInboundSummaryView",props:{data:{},overview:{},networking:{},routeName:{}},setup(u){const r=u;return($,o)=>{const _=n("XBadge"),w=n("XLayout"),v=n("XAction"),f=n("XTabs"),y=n("RouterView"),g=n("AppView"),V=n("DataCollection"),k=n("RouteView");return l(),m(k,{name:r.routeName,params:{inactive:Boolean,proxyType:"",connection:""}},{default:t(({route:a,t:p})=>[s(V,{items:r.data,predicate:r.networking.type==="gateway"?e=>!0:a.params.proxyType===""?e=>`${e.name}`===a.params.connection:e=>`${e.socketAddress.replace(":","_")}`===a.params.connection,find:!0},{default:t(({items:e})=>[s(g,null,{title:t(()=>[s(w,{variant:"y-stack",size:"small"},{default:t(()=>[B("h2",null,`
               Inbound `+d(a.params.connection.replace("localhost","").replace("_",":")),1),o[0]||(o[0]=c()),e[0]?.state?(l(),m(_,{key:0,appearance:p(`common.status.appearance.${e[0].state}`,void 0,{defaultMessage:"neutral"})},{default:t(()=>[c(d(p(`http.api.value.${e[0].state}`)),1)]),_:2},1032,["appearance"])):N("",!0)]),_:2},1024)]),default:t(()=>[o[1]||(o[1]=c()),s(f,{selected:a.child()?.name},X({_:2},[x(a.children,({name:i})=>({name:`${i}-tab`,fn:t(()=>[s(v,{to:{name:i,query:{inactive:a.params.inactive}}},{default:t(()=>[c(d(p(`connections.routes.item.navigation.${i.split("-")[5]}`)),1)]),_:2},1032,["to"])])}))]),1032,["selected"]),o[2]||(o[2]=c()),s(y,null,{default:t(i=>[(l(),m(b(i.Component),{data:e[0],overview:r.overview,networking:r.networking},null,8,["data","overview","networking"]))]),_:2},1024)]),_:2},1024)]),_:2},1032,["items","predicate"])]),_:1},8,["name"])}}});export{T as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryXdsConfigView-D9aRbf1E.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{d as C,r as o,o as w,l as R,w as a,b as n,e as d,k,Q as T,t as V}from"./index-C9mgfMZc.js";const S=C({__name:"ConnectionInboundSummaryXdsConfigView",props:{data:{},routeName:{},overview:{}},setup(p){const t=p;return(b,r)=>{const m=o("RouteTitle"),l=o("XAction"),u=o("XCodeBlock"),i=o("DataLoader"),_=o("AppView"),g=o("RouteView");return w(),R(g,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:t.routeName},{default:a(({t:c,route:e,uri:f})=>[n(m,{render:!1,title:c("connections.routes.item.navigation.xds")},null,8,["title"]),r[0]||(r[0]=d()),n(_,null,{default:a(()=>[n(i,{data:[t.overview]},{default:a(({data:[x]})=>[n(i,{src:f(k(T),"/connections/xds/for/:proxyType/:name/:mesh/inbound/:inbound",{mesh:e.params.mesh||"*",name:x.id,inbound:"stat_prefix"in t.data?t.data.stat_prefix:`${t.data.port}`,proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane"})},{default:a(({data:[y],refresh:h})=>[n(u,{language:"json",code:JSON.stringify(y,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:s=>e.update({codeSearch:s}),onFilterModeChange:s=>e.update({codeFilter:s}),onRegExpModeChange:s=>e.update({codeRegExp:s})},{"primary-actions":a(()=>[n(l,{action:"refresh",appearance:"primary",onClick:h},{default:a(()=>[d(V(c("common.refresh")),1)]),_:2},1032,["onClick"])]),_:2},1032,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1032,["data"])]),_:2},1024)]),_:1},8,["name"])}}});export{S as default};
+import{d as C,r as o,o as w,l as R,w as a,b as n,e as d,k,P as T,t as V}from"./index-BNNMjRXa.js";const S=C({__name:"ConnectionInboundSummaryXdsConfigView",props:{data:{},routeName:{},overview:{}},setup(p){const t=p;return(b,r)=>{const m=o("RouteTitle"),l=o("XAction"),u=o("XCodeBlock"),i=o("DataLoader"),_=o("AppView"),g=o("RouteView");return w(),R(g,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:t.routeName},{default:a(({t:c,route:e,uri:f})=>[n(m,{render:!1,title:c("connections.routes.item.navigation.xds")},null,8,["title"]),r[0]||(r[0]=d()),n(_,null,{default:a(()=>[n(i,{data:[t.overview]},{default:a(({data:[x]})=>[n(i,{src:f(k(T),"/connections/xds/for/:proxyType/:name/:mesh/inbound/:inbound",{mesh:e.params.mesh||"*",name:x.id,inbound:"stat_prefix"in t.data?t.data.stat_prefix:`${t.data.port}`,proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane"})},{default:a(({data:[y],refresh:h})=>[n(u,{language:"json",code:JSON.stringify(y,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:s=>e.update({codeSearch:s}),onFilterModeChange:s=>e.update({codeFilter:s}),onRegExpModeChange:s=>e.update({codeRegExp:s})},{"primary-actions":a(()=>[n(l,{action:"refresh",appearance:"primary",onClick:h},{default:a(()=>[d(V(c("common.refresh")),1)]),_:2},1032,["onClick"])]),_:2},1032,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1032,["data"])]),_:2},1024)]),_:1},8,["name"])}}});export{S as default};
```

---

### Incident Patch 3: `8f61b486` (2026-10-14)
**Commit Message**: chore(deps): bump kumahq/kuma-gui to c1dd3dfaf657c1c953c94bde611675c766e98d6e (#19162)

Signed-off-by: GitHub <[REDACTED_EMAIL]>
Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `app/kuma-ui/pkg/resources/kuma-gui-cve-report.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"matches":[{"vulnerability":{"id":"GHSA-vfj7-8cjw-p6xm","dataSource":"https://github.com/advisories/GHSA-vfj7-8cjw-p6xm","namespace":"github:language:javascript","severity":"High","urls":["https://nvd.nist.gov/vuln/detail/CVE-2026-93687","https://github.com/micromatch/braces/issues/70","https://github.com/micromatch/braces/blob/3.0.3/lib/compile.js#L49-L53","https://github.com/micromatch/braces/blob/3.0.3/lib/expand.js#L102-L105","https://github.com/micromatch/braces/blob/3.0.3/lib/parse.js#L38-L40","https://www.vulncheck.com/advisories/braces-through-3.0.3-stack-overflow-via-deeply-nested-patterns"],"description":"braces vulnerable to stack-exhaustion denial of service through deeply nested patterns","cvss":[{"type":"Secondary","version":"3.1","vector":"CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H","metrics":{"baseScore":7.5,"exploitabilityScore":3.9,"impactScore":3.6},"vendorMetadata":{}},{"type":"Secondary","version":"4.0","vector":"CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N","metrics":{"baseScore":8.7},"vendorMetadata":{}}],"epss":[{"cve":"CVE-2026-93687","epss":0.00757,"percentile":0.53919,"date":"2026-10-12"}],"cwes":[{"cve":"CVE-2026-93687","cwe":"CWE-674","source":"disclosure@vulncheck.com","type":"Secondary"}],"fix":{"versions":[],"state":"not-fixed"},"advisories":[],"risk":0.59046},"relatedVulnerabilities":[{"id":"CVE-2026-93687","dataSource":"https://nvd.nist.gov/vuln/detail/CVE-2026-93687","namespace":"nvd:cpe","severity":"High","urls":["https://github.com/micromatch/braces","https://github.com/micromatch/braces/blob/3.0.3/lib/compile.js#L49-L53","https://github.com/micromatch/braces/blob/3.0.3/lib/expand.js#L102-L105","https://github.com/micromatch/braces/blob/3.0.3/lib/parse.js#L38-L40","https://github.com/micromatch/braces/issues/70","https://www.vulncheck.com/advisories/braces-through-3.0.3-stack-overflow-via-deeply-nested-patterns","https://github.com/micromatch/braces/issues/73#issuecomment-5996574974"],"description":"braces through 3.0.3 contains a stack overflow vulnerability in the recursive AST walkers that lack depth guards. Attackers can supply deeply nested brace patterns under the character limit to exhaust the call stack and terminate the Node.js process with an uncaught RangeError.","cvss":[{"source":"disclosure@vulncheck.com","type":"Secondary","version":"4.0","vector":"CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N/E:X/CR:X/IR:X/AR:X/MAV:X/MAC:X/MAT:X/MPR:X/MUI:X/MVC:X/MVI:X/MVA:X/MSC:X/MSI:X/MSA:X/S:X/AU:X/R:X/V:X/RE:X/U:X","metrics":{"baseScore":8.7},"vendorMetadata":{}},{"source":"disclosure@vulncheck.com","type":"Secondary","version":"3.1","vector":"CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H","metrics":{"baseScore":7.5,"exploitabilityScore":3.9,"impactScore":3.6},"vendorMetadata":{}}],"epss":[{"cve":"CVE-2026-93687","epss":0.00757,"percentile":0.53919,"date":"2026-10-12"}],"cwes":[{"cve":"CVE-2026-93687","cwe":"CWE-674","source":"disclosure@vulncheck.com","type":"Secondary"}]}],"matchDetails":[{"type":"exact-direct-match","matcher":"javascript-matcher","searchedBy":{"language":"javascript","namespace":"github:language:javascript","package":{"name":"braces","version":"3.0.3"}},"found":{"vulnerabilityID":"GHSA-vfj7-8cjw-p6xm","versionConstraint":"<=3.0.3 (semantic)"}}],"artifact":{"id":"Package-npm-braces-e8863a3d87ad712b","name":"braces","version":"3.0.3","type":"npm","locations":null,"language":"javascript","licenses":["MIT"],"cpes":["cpe:2.3:a:braces_project:braces:3.0.3:*:*:*:*:node.js:*:*","cpe:2.3:a:jonschlinkert:braces:3.0.3:*:*:*:*:node.js:*:*"],"purl":"pkg:npm/braces@3.0.3","upstreams":[]}},{"vulnerability":{"id":"GHSA-68fv-2mgg-jv7q","dataSource":"https://github.com/advisories/GHSA-68fv-2mgg-jv7q","namespace":"github:language:javascript","severity":"High","urls":["https://nvd.nist.gov/vuln/detail/CVE-2026-93749","https://github.com/7rulnik/source-map-js/issues/76","https://github.com/7rulnik/source-map-js","https://github.com/7rulnik/source-map-js/blob/c1cd8904bb7bd0c7fb5879fcda48134d82a27934/lib/source-node.js#L115-L118","https://www.vulncheck.com/advisories/source-map-js-through-1.2.1-event-loop-denial-of-service","https://github.com/7rulnik/source-map-js/pull/79","https://github.com/7rulnik/source-map-js/commit/cf7658058ceeaa8619d5ae0ec90be6905209d016","https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2"],"description":"source-map-js allows event-loop denial of service through indexed source-map section offsets","cvss":[{"type":"Secondary","version":"3.1","vector":"CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H","metrics":{"baseScore":7.5,"exploitabilityScore":3.9,"impactScore":3.6},"vendorMetadata":{}},{"type":"Secondary","version":"4.0","vector":"CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N","metrics":{"baseScore":8.7},"vendorMetadata":{}}],"epss":[{"cve":"CVE-2026-93749","epss":0.0063,"percentile":0.48703,"date":"2026-10-12"}],"cwes":[{"cve":"CVE-2026-93749","cwe":"CWE-1284","sour
```

#### Recent Merged Pull Requests:
- **PR #19172** (2026-10-15): chore(deps): bump kumahq/kuma-gui to 7bc1aa62fc048f5be90422982f375fe777027c46 (@kumahq[bot])
- **PR #19169** (2026-10-15): docs(CHANGELOG.md): updating changelog and version files (@kumahq[bot])
- **PR #19168** (closed): chore(deps): bump ci-tools/release-tool from 1.6.1 to 1.6.2 - autoclosed (@renovate[bot])
- **PR #19167** (2026-10-15): chore(deps): bump release-tool to v1.6.2 (@bartsmykla)
- **PR #19165** (2026-10-14): chore(deps): bump release-tool to v1.6.1 (@bartsmykla)
- **PR #19163** (2026-10-14): fix(kds): de-flake zone sync allowlist test (@Automaat)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

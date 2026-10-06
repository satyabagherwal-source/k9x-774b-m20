# Forensic Learning Record (Deep Inspection): kumahq/kuma

> **Canonical Artifact**: `07_PROJECT_LEARNING/kumahq-kuma-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kumahq/kuma](https://github.com/kumahq/kuma))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:53:20.018Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kumahq/kuma`
- **Description**: 🐻 The multi-zone service mesh for containers, Kubernetes and VMs. Built with Envoy. CNCF Sandbox Project.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 4011 stars

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

### Core Architecture Module: `pkg/config/core/resources/store/config.go`
```
package store

import (
	"time"

	"github.com/pkg/errors"
	"go.uber.org/multierr"

	"github.com/kumahq/kuma/v3/pkg/config"
	"github.com/kumahq/kuma/v3/pkg/config/plugins/resources/k8s"
	"github.com/kumahq/kuma/v3/pkg/config/plugins/resources/postgres"
	config_types "github.com/kumahq/kuma/v3/pkg/config/types"
)

var _ config.Config = &StoreConfig{}

type StoreType = string

const (
	KubernetesStore StoreType = "kubernetes"
	PostgresStore   StoreType = "postgres"
	PgxStore        StoreType = "pgx"
	MemoryStore     StoreType = "memory"
)

// StoreConfig defines Resource Store configuration
type StoreConfig struct {
	// Type of Store used in the Control Plane. Can be either "kubernetes", "postgres" or "memory"
	Type StoreType `json:"type" envconfig:"kuma_store_type"`
	// Postgres Store configuration
	Postgres *postgres.PostgresStoreConfig `json:"postgres"`
	// Kubernetes Store configuration
	Kubernetes *k8s.KubernetesStoreConfig `json:"kubernetes"`
	// Cache configuration
	Cache CacheStoreConfig `json:"cache"`
	// Upsert configuration
	Upsert UpsertConfig `json:"upsert"`
	// UnsafeDelete skips validation of resource delete.
	// For example you don't have to delete all Dataplane objects before you delete a Mesh
	UnsafeDelete bool `json:"unsafeDelete" envconfig:"kuma_store_unsafe_delete"`
}

func DefaultStoreConfig() *StoreConfig {
	return &StoreConfig{
		Type:       MemoryStore,
		Postgres:   postgres.DefaultPostgresStoreConfig(),
		Kubernetes: k8s.DefaultKubernetesStoreConfig(),
		Cache:      DefaultCacheStoreConfig(),
		Upsert:     DefaultUpsertConfig(),
	}
}

func (s *StoreConfig) Sanitize() {
	s.Kubernetes.Sanitize()
	s.Postgres.Sanitize()
	s.Cache.Sanitize()
}

func (s *StoreConfig) PostProcess() error {
	return multierr.Combine(
		s.Kubernetes.PostProcess(),
		s.Postgres.PostProcess(),
		s.Cache.PostProcess(),
	)
}

func (s *StoreConfig) Validate() error {
	switch s.Type {
	case PostgresStore:
		if err := s.Postgres.Validate(); err != nil {
			return errors.Wrap(err, "Postgres validation failed")
		}
	case KubernetesStore:
		if err := s.Kubernetes.Validate(); err != nil {
			return errors.Wrap(err, "Kubernetes validation failed")
		}
		return nil
	case MemoryStore:
		return nil
	default:
		return errors.Errorf("Type should be either %s, %s or %s", PostgresStore, KubernetesStore, MemoryStore)
	}
	if err := s.Cache.Validate(); err != nil {
		return errors.Wrap(err, "Cache validation failed")
	}
	return nil
}

var _ config.Config = &CacheStoreConfig{}

type CacheStoreConfig struct {
	config.BaseConfig

	ExpirationTime config_types.Duration `json:"expirationTime" envconfig:"kuma_store_cache_expiration_time"`
}

func DefaultCacheStoreConfig() CacheStoreConfig {
	return CacheStoreConfig{
		ExpirationTime: config_types.Duration{Duration: time.Second},
	}
}

func DefaultUpsertConfig() UpsertConfig {
	return UpsertConfig{
		ConflictRetryBaseBackoff:   config_types.Duration{Duration: 200 * time.Millisecond},
		ConflictRetryMaxTimes:      10,
		ConflictRetryJitterPercent: 30,
	}
}

type UpsertConfig struct {
	config.BaseConfig

	// Base time for exponential backoff on upsert (get and update) operations when retry is enabled
	ConflictRetryBaseBackoff config_types.Duration `json:"conflictRetryBaseBackoff" envconfig:"kuma_store_upsert_conflict_retry_base_backoff"`
	// Max retries on upsert (get and update) operation when retry is enabled
	ConflictRetryMaxTimes uint `json:"conflictRetryMaxTimes" envconfig:"kuma_store_upsert_conflict_retry_max_times"`
	// Percentage of jitter. For example: if backoff is 20s, and this value 10, the backoff will be between 18s and 22s.
	ConflictRetryJitterPercent uint `json:"conflictRetryJitterPercent" envconfig:"kuma_store_upsert_conflict_retry_jitter_percent"`
}

func (u *UpsertConfig) Validate() error {
	if u.ConflictRetryBaseBackoff.Duration < 0 {
		return errors.New("RetryBaseBackoff cannot be lower than 0")
	}
	return nil
}

var _ config.Config = &UpsertConfig{}

```

### Core Architecture Module: `pkg/config/util.go`
```
package config

import (
	"sigs.k8s.io/yaml"
)

func FromYAML(content []byte, cfg Config) error {
	return yaml.Unmarshal(content, cfg)
}

func ToYAML(cfg Config) ([]byte, error) {
	return yaml.Marshal(cfg)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #18981** (2026-10-05): **chore(deps): bump google.golang.org/genproto/googleapis/* from b142276 to 8a89bd6 (backport of #18953)**
  *Symptoms*: Automatic cherry-pick of #18953 for branch release-3.0  Generated by [action](https://github.com/kumahq/kuma/actions/runs/37345154745)  cherry-picked commit a5a73b1a37e556fe82faa54d667409c6eee50176  :warning: :warning: :warning: Conflicts happened when cherry-picking! :warning: :warning: :warning: ``` On branch release-3.0 Your branch is up to date with 'origin/release-3.0'.  You are currently cherry-picking commit a5a73b1a37.   (fix conflicts and run "git cherry-pick --continue")   (use "git cherry-pick --skip" to skip this patch)   (use "git cherry-pick --abort" to cancel the cherry-pick operation)  Unmerged paths:   (use "git add <file>..." to mark resolution) 	both modified:   go.mod  no changes added to commit (use "git add" and/or "git commit -a") ```
  **Post-Mortem & Fix Analysis**:
  > Nothing to backport: release-3.0 already has google.golang.org/genproto/googleapis/{api,rpc} at 8a89bd6 (pulled in by #18965). Resolving the go.mod conflict in favor of release-3.0's golang.org/x/tools v0.51.0 leaves an empty diff.

- **Issue #18978** (2026-10-05): **fix(meshtimeout): keep zone egress rule timeouts**
  *Symptoms*: ## Motivation  A MeshTimeout on a zone egress with an SNI rule is accepted, but `connectionTimeout` and `idleTimeout` never reach the MeshExternalService cluster: it keeps `connect_timeout: 5s` and `idle_timeout: 3600s`. Only `http.requestTimeout` lands on the route. Found while verifying the 2.14 to 3.0 upgrade on Kong Mesh `3.0.0-preview.v1208cd8fe` (kuma `cb2bc6a7904a`).  ## Implementation information  Zone egress clusters carry their MeshExternalService as `ResourceOrigin`, so after the zone proxy pass configured them, the outbound pass visited them again and wrote default timeouts, because the policy has no `to` rules. The zone proxy pass now runs after the outbound pass. Sidecars are unaffected (the zone proxy pass returns early without zone proxy listeners), and zone ingress clusters have no `ResourceOrigin`. If a policy sets both `to: MeshExternalService` and an SNI rule for the same egress cluster, the SNI rule now wins.  The new test builds the egress cluster with its MeshExternalService owner, as the generator does. The existing zone egress test omitted the owner, which hid the bug.  ## Supporting documentation  Policy applied to the zone egress:  ```yaml rules:   - matches: [{sni: {type: Exact, value: sni.extsvc.default.ext-api.80}}]     default: {connectionTimeout: 7s, idleTimeout: 13s, http: {requestTimeout: 2s}} ```  Resulting `kri_extsvc_default___ext-api_80` cluster before this change: `connect_timeout: 5s`, `idle_timeout: 3600s`; expected `7s` and `13s`.  Ba

- **Issue #18977** (2026-10-05): **Revert "chore(deps): bump jdx/mise-action from 4.3.0 to 5.1.1"**
  *Symptoms*: Reverts kumahq/kuma#18970
  **Post-Mortem & Fix Analysis**:
  > ✅ **KSAI Review: Finished** 1. **`12:57 UTC`** Inspecting the change diff and tracing workflow references 2. **`12:59 UTC`** Reviewing changed code against project conventions  ---  <details> <summary>Run report (federated) · 1 paid run · $0.4166 total</summary>  | # | Engine | Result | Model | Turns | Cost | | --- | --- | --- | --- | --- | --- | | [1](https://github.com/kumahq/kuma/actions/runs/37312741952) | `opencode` | `success` | `glm-5.3/high` | `31` | $0.4164 |  Reviewing cost $0.4164; deciding how to run it cost $0.0002  </details>  <!-- ksai-run-state:{"v":1,"flow":"review","conclusion":"success","stopped_by":null,"reviewed_commit":"ae1792d6a28f2c5ebd6ec3efa4086ca1f527bc08","model":"zai-org/GLM-5.3","effort":"high","selected_by":"input","dials_arm":null,"triage":{"source":"report","proposed_tier":null,"skipped_by":null,"skills":["typescript-code-review"],"reviewable_files":106,"reviewable_lines":982,"risk":true,"api_surface":false},"engine":"opencode","review_protocol":{"head_

- **Issue #18975** (2026-10-05): **Decide if 2.14 patches default universal to embedded DNS**
  *Symptoms*: ## Problem  Since 2.11, Kubernetes dataplanes resolve mesh DNS through the embedded DNS proxy by default. Universal dataplanes on 2.14 still default to the bundled CoreDNS. 3.0 removes the bundled CoreDNS (#17229), so every universal transparent-proxying dataplane still on CoreDNS breaks in the upgrade unless it switches first.  Flipping the universal default inside a 2.14 patch removes that break for users who never touch DNS config, but a patch release that changes DNS behavior is a risk on its own.  ## Expected outcome  - This issue records the decision: flip the default in the next 2.14 patch, or keep CoreDNS and require users to switch before upgrading. - On the flip, a universal dataplane with transparent proxying and no DNS configuration uses the embedded DNS proxy after the patch. - On the flip, a dataplane with an explicit CoreDNS setup keeps working unchanged. - On keep, the upgrade path states that universal users must switch to the embedded DNS proxy before 3.0. 
  **Post-Mortem & Fix Analysis**:
  > not doing this, users need to change it themselves

- **Issue #18970** (2026-10-05): **chore(deps): bump jdx/mise-action from 4.3.0 to 5.1.1**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [jdx/mise-action](https://redirect.github.com/jdx/mise-action) | action | major | `v4.3.0` → `v5.1.1` |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/12547) for more information.  ---  ### Release Notes  <details> <summary>jdx/mise-action (jdx/mise-action)</summary>  ### [`v5.1.1`](https://redirect.github.com/jdx/mise-action/releases/tag/v5.1.1): : GitHub token is no longer exported to later steps by default  [Compare Source](https://redirect.github.com/jdx/mise-action/compare/v5.1.0...v5.1.1)  mise-action no longer exports its GitHub token as `MISE_GITHUB_TOKEN` to every later step in the job. A new `persist_github_token` input lets you turn that back on, or pass a different token to later steps. **This changes the default behavior.** If later steps need the token, see Breaking Changes below.  ##### Fixed  - **The GitHub token now stays inside the action by default.** Before this release, the `github_token` input (which defaults to `${{ github.token }}`) was written to `GITHUB_ENV` as `MISE_GITHUB_TOKEN`. That let any later step read the token and call the GitHub API with the job's permissions, even if the step never asked for a credential. Now the token is set only for the mise-action step and the processes it starts. The action masks the token in logs. ([#&#8203;658](https://redirect.github.com/jdx/mise-action/pull/65

- **Issue #18969** (2026-10-05): **chore(deps/dev): bump yq from 4.53.6 to 4.54.1**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [yq](https://redirect.github.com/mikefarah/yq) | tools | minor | `4.53.6` → `4.54.1` |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/12547) for more information.  ---  ### Release Notes  <details> <summary>mikefarah/yq (yq)</summary>  ### [`v4.54.1`](https://redirect.github.com/mikefarah/yq/releases/tag/v4.54.1): - if-then-else  [Compare Source](https://redirect.github.com/mikefarah/yq/compare/v4.53.6...v4.54.1)  - Added jq style `if-then-elif-else-end` conditional operator ([#&#8203;2871](https://redirect.github.com/mikefarah/yq/issues/2871)) Thanks to [@&#8203;anandghegde](https://redirect.github.com/anandghegde)   - Added `@base64url`/`@base64urld` operators (RFC 4648 §5) ([#&#8203;2827](https://redirect.github.com/mikefarah/yq/issues/2827)) Thanks [@&#8203;MsfPablo](https://redirect.github.com/MsfPablo)   - Fixed: preserve explicit assignments in read-only expressions ([#&#8203;2850](https://redirect.github.com/mikefarah/yq/issues/2850)) Thanks [@&#8203;RRXXZZYY](https://redirect.github.com/RRXXZZYY)   - Fixed: error on int64 overflow in +, -, \* instead of silently wrapping ([#&#8203;2826](https://redirect.github.com/mikefarah/yq/issues/2826)) Thanks [@&#8203;MsfPablo](https://redirect.github.com/MsfPablo)   - Fixed(toml): quote empty keys ([#&#8203;2870](https://redirect.github.com/mikefarah/yq/issues/2870)) Thanks
  **Post-Mortem & Fix Analysis**:
  > ### Edited/Blocked Notification  Renovate will not automatically rebase this PR, because it does not recognize the last commit author and assumes somebody else may have edited the PR.  You can manually request rebase by checking the rebase/retry box above.   ⚠️ **Warning**: custom changes will be lost.

- **Issue #18968** (2026-10-05): **chore(deps/dev): bump npm:@redocly/cli from 2.53.2 to 2.54.2**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [npm:@redocly/cli](https://redirect.github.com/Redocly/redocly-cli) | `2.53.2` → `2.54.2` | ![age](https://developer.mend.io/api/mc/badges/age/npm/@redocly%2fcli/2.54.2?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@redocly%2fcli/2.53.2/2.54.2?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/12547) for more information.  ---  ### Release Notes  <details> <summary>Redocly/redocly-cli (npm:@&#8203;redocly/cli)</summary>  ### [`v2.54.2`](https://redirect.github.com/Redocly/redocly-cli/releases/tag/%40redocly/cli%402.54.2)  [Compare Source](https://redirect.github.com/Redocly/redocly-cli/compare/72572a9971e19b8ec2de9f1dee119b211b7dc84b...@redocly/cli@2.54.2)  ##### Patch Changes  - Updated [@&#8203;redocly/openapi-core](https://redirect.github.com/redocly/openapi-core) to v2.54.2. - Updated [@&#8203;redocly/reunite-integration](https://redirect.github.com/redocly/reunite-integration) to v2.54.2.  ### [`v2.54.1`](https://redirect.github.com/Redocly/redocly-cli/compare/320e17f17aa10f1838807e2e74c86d5fe7fdaf75...72572a9971e19b8ec2de9f1dee119b211b7dc84b)  [Compare Source](https://redirect.github.com/Redocly/redocly-cli/compare/320e17f17aa10f1838807e2e74c86d5fe7fdaf75...72572a9971e19

- **Issue #18967** (2026-10-05): **chore(deps): bump reviewdog/action-actionlint from 1.77.0 to 1.79.1**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [reviewdog/action-actionlint](https://redirect.github.com/reviewdog/action-actionlint) | action | minor | `v1.77.0` → `v1.79.1` |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/12547) for more information.  ---  ### Release Notes  <details> <summary>reviewdog/action-actionlint (reviewdog/action-actionlint)</summary>  ### [`v1.79.1`](https://redirect.github.com/reviewdog/action-actionlint/releases/tag/v1.79.1)  [Compare Source](https://redirect.github.com/reviewdog/action-actionlint/compare/v1.79.0...v1.79.1)  #### What's Changed  - chore(deps): update python:3.14.8-alpine3.24 docker digest to [`f6a589d`](https://redirect.github.com/reviewdog/action-actionlint/commit/f6a589d) by [@&#8203;renovate](https://redirect.github.com/renovate)\[bot] in [#&#8203;249](https://redirect.github.com/reviewdog/action-actionlint/pull/249)  **Full Changelog**: <https://github.com/reviewdog/action-actionlint/compare/v1.79.0...v1.79.1>  ### [`v1.79.0`](https://redirect.github.com/reviewdog/action-actionlint/releases/tag/v1.79.0)  [Compare Source](https://redirect.github.com/reviewdog/action-actionlint/compare/v1.78.1...v1.79.0)  #### What's Changed  - chore(deps): update dependency pyflakes to v4.0.2 by [@&#8203;renovate](https://redirect.github.com/renovate)\[bot] in [#&#8203;248](https://redirect.github.com/reviewdog/action-actionlint/pull/
  **Post-Mortem & Fix Analysis**:
  > ### Edited/Blocked Notification  Renovate will not automatically rebase this PR, because it does not recognize the last commit author and assumes somebody else may have edited the PR.  You can manually request rebase by checking the rebase/retry box above.   ⚠️ **Warning**: custom changes will be lost.

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

### Incident Patch 1: `a7d25008` (2026-09-30)
**Commit Message**: fix(helm): stop zone proxy roll on upgrade (#18882)

Signed-off-by: Lukasz Dziedziak <[REDACTED_EMAIL]>

**File**: `UPGRADE.md` (modified, +30/-5)
```diff
@@ -1243,11 +1243,36 @@ Complete the migration described in the previous section, then drop the
 top-level `ingress` and `egress` blocks from your values files and the removed
 flags from any `kumactl install control-plane` invocation.
 
-Most legacy settings map onto `meshes[].ingress` / `meshes[].egress`. These have
-no equivalent there: `podAnnotations`, `annotations`, `logLevel`, `drainTime`,
-`lifecycle`, `livenessProbe`, `readinessProbe`, `startupProbe`, `dns.policy`,
-`dns.config`, `service.enabled` and `service.nodePort`. Drain time and probes
-are now control-plane-wide sidecar injector settings.
+Most legacy settings map onto `meshes[].ingress` / `meshes[].egress`;
+`podAnnotations` moves to `deployment.podAnnotations`, next to the new
+`deployment.podLabels`. These have no equivalent there: `annotations`,
+`logLevel`, `drainTime`, `lifecycle`, `livenessProbe`, `readinessProbe`,
+`startupProbe`, `dns.policy`, `dns.config`, `service.enabled` and
+`service.nodePort`. Drain time and probes are now control-plane-wide sidecar
+injector settings.
+
+### Mesh-scoped zone proxies keep their `kuma-dp` until you restart them
+
+Zone proxy pods deployed through `meshes[]` no longer carry the `helm.sh/chart`
+and `app.kubernetes.io/version` labels, so upgrading the control plane leaves
+them running, like any other data plane proxy. Previously every version upgrade
+rolled them while the old control plane was still injecting sidecars, so they
+restarted and came back with the old `kuma-dp` anyway.
+
+Upgrading from a 2.14 patch that predates this change still rolls them once,
+because their pod template changes: the version labels go away and the egress
+`preStopSleepSeconds` default rises from 15 to 20 seconds. They come back with
+the 2.14 `kuma-dp`.
+
+**Action required**
+
+After the control plane upgrade, restart the zone proxies to move them to the
+new `kuma-dp`. Replace `kuma-system` if you installed the control plane in
+another namespace:
+
+```sh
+kubectl rollout restart deployment -n kuma-system -l kuma.io/mesh
+```
 
 ### Standalone zone proxy inspect endpoints and `kumactl inspect` commands removed
 
```

**File**: `app/kumactl/cmd/install/install_control_plane_test.go` (modified, +16/-0)
```diff
@@ -392,6 +392,22 @@ controlPlane:
 			},
 			errorMsg: "meshes[default].egress: preStopSleepSeconds (30) must be lower than terminationGracePeriodSeconds (10)",
 		}),
+		Entry("with a zone proxy pod label the chart sets", errTestCase{
+			extraArgs: []string{
+				"--set", "meshes[0].name=default",
+				"--set", "meshes[0].ingress.enabled=true",
+				"--set", "meshes[0].ingress.deployment.podLabels.kuma\\.io/sidecar-injection=disabled",
+			},
+			errorMsg: "meshes[default].ingress.deployment.podLabels: kuma.io/sidecar-injection is set by the chart",
+		}),
+		Entry("with a zone proxy pod annotation the chart sets", errTestCase{
+			extraArgs: []string{
+				"--set", "meshes[0].name=default",
+				"--set", "meshes[0].egress.enabled=true",
+				"--set", "meshes[0].egress.deployment.podAnnotations.kuma\\.io/reachable-backends=x",
+			},
+			errorMsg: "meshes[default].egress.deployment.podAnnotations: kuma.io/reachable-backends is set by the chart",
+		}),
 		Entry("with unexpected image tag", errTestCase{
 			extraArgs: []string{"--set", "global.image.tag=1.5.0"},
 			errorMsg:  "only supports",
```

**File**: `app/kumactl/cmd/install/install_zoneproxy_pod_template_test.go` (added, +187/-0)
```diff
@@ -0,0 +1,187 @@
+package install_test
+
+import (
+	"crypto/sha256"
+	"encoding/hex"
+	"errors"
+	"io"
+	"strings"
+
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+	chartcommon "helm.sh/helm/v4/pkg/chart/common"
+	chartcommonutil "helm.sh/helm/v4/pkg/chart/common/util"
+	"helm.sh/helm/v4/pkg/chart/loader/archive"
+	"helm.sh/helm/v4/pkg/chart/v2/loader"
+	"helm.sh/helm/v4/pkg/engine"
+	kube_apps "k8s.io/api/apps/v1"
+	kube_core "k8s.io/api/core/v1"
+	k8s_yaml "k8s.io/apimachinery/pkg/util/yaml"
+
+	"github.com/kumahq/kuma/v3/deployments"
+	"github.com/kumahq/kuma/v3/pkg/util/data"
+)
+
+const zoneProxyDeploymentTemplate = "kuma/templates/mesh-zoneproxy-deployment.yaml"
+
+var zoneProxyValues = map[string]any{
+	"meshes": []any{
+		map[string]any{
+			"name":    "default",
+			"ingress": map[string]any{"enabled": true},
+			"egress":  map[string]any{"enabled": true},
+		},
+	},
+}
+
+// renderChartAtVersion renders the chart the way helm does, keeping the
+// version labels kumactl strips, so a version leaking into a pod template shows.
+func renderChartAtVersion(version string) map[string]string {
+	templateFiles, err := data.ReadFiles(deployments.KumaChartFS())
+	Expect(err).ToNot(HaveOccurred())
+
+	var files []*archive.BufferedFile
+	for _, f := range templateFiles {
+		files = append(files, &archive.BufferedFile{Name: f.FullPath, Data: f.Data})
+	}
+	kumaChart, err := loader.LoadFiles(files)
+	Expect(err).ToNot(HaveOccurred())
+	kumaChart.Metadata.Version = version
+	kumaChart.Metadata.AppVersion = version
+
+	options := chartcommon.ReleaseOptions{
+		Name:      kumaChart.Metadata.Name,
+		Namespace: "kuma-system",
+		Revision:  1,
+		IsUpgrade: true,
+	}
+	valuesToRender, err := chartcommonutil.ToRenderValues(kumaChart, zoneProxyValues, options, chartcommon.DefaultCapabilities)
+	Expect(err).ToNot(HaveOccurred())
+
+	rendered, err := engine.Render(kumaChart, valuesToRender)
+	Expect(err).ToNot(HaveOccurred())
+	return rendered
+}
+
+func decodeDocuments[T any](content string) []T {
+	var docs []T
+	decoder := k8s_yaml.NewYAMLOrJSONDecoder(strings.NewReader(content), 4096)
+	for {
+		var doc T
+		err := decoder.Decode(&doc)
+		if errors.Is(err, io.EOF) {
+			return docs
+		}
+		Expect(err).ToNot(HaveOccurred())
+		docs = append(docs, doc)
+	}
+}
+
+func zoneProxyDeployments(rendered map[string]string) []kube_apps.Deployment {
+	var result []kube_apps.Deployment
+	for _, d := range decodeDocuments[kube_apps.Deployment](rendered[zoneProxyDeploymentTemplate]) {
+		if d.Kind == "Deployment" {
+			result = append(result, d)
+		}
+	}
+	Expect(result).To(HaveLen(2))
+	return result
+}
+
+// referencedConfigs lists the ConfigMaps and Secrets a pod reads at start,
+// keyed as kind/name.
+func referencedConfigs(spec kube_core.PodSpec) []string {
+	var refs []string
+	for _, v := range spec.Volumes {
+		if v.ConfigMap != nil {
+			refs = append(refs, "ConfigMap/"+v.ConfigMap.Name)
+		}
+		if v.Secret != nil {
+			refs = append(refs, "Secret/"+v.Secret.SecretName)
+		}
+		if v.Projected != nil {
+			for _, s := range v.Projected.Sources {
+				if s.ConfigMap != nil {
+					refs = append(refs, "ConfigMap/"+s.ConfigMap.Name)
+				}
+				if s.Secret != nil {
+					refs = append(refs, "Secret/"+s.Secret.Name)
+				}
+			}
+		}
+	}
+	for _, c := range append(spec.InitContainers, spec.Containers...) {
+		for _, e := range c.EnvFrom {
+			if e.ConfigMapRef != nil {
+				refs = append(refs, "ConfigMap/"+e.ConfigMapRef.Name)
+			}
+			if e.SecretRef != nil {
+				refs = append(refs, "Secret/"+e.SecretRef.Name)
+			}
+		}
+		for _, e := range c.Env {
+			if e.ValueFrom == nil {
+				continue
+			}
+			if e.ValueFrom.ConfigMapKeyRef != nil {
+				refs = append(refs, "ConfigMap/"+e.ValueFrom.ConfigMapKeyRef.Name)
+			}
+			if e.ValueFrom.SecretKeyRef != nil {
+				refs = append(refs, "Secret/"+e.ValueFrom.SecretKeyRef.Name)
+			}
+		}
+	}
+	return refs
+}
+
+var _ = Context("mesh-scoped zone proxy pod template", func() {
+	It("should not change when the chart version changes", func() {
+		before := zoneProxyDeployments(renderChartAtVersion("1.0.0"))
+		after := zoneProxyDeployments(renderChartAtVersion("2.0.0"))
+
+		for i := range before {
+			Expect(after[i].Spec.Template).To(Equal(before[i].Spec.Template),
+				"pod template of %s depends on the chart version, so every upgrade restarts it", before[i].Name)
+		}
+	})
+
+	It("should carry a checksum of every chart-rendered ConfigMap and Secret it reads", func() {
+		rendered := renderChartAtVersion("1.0.0")
+
+		type object struct {
+			Kind     string `json:"kind"`
+			Metadata struct {
+				Name string `json:"name"`
+			} `json:"metadata"`
+		}
+		renderedIn := map[string]string{}
+		for file, content := range rendered {
+			if !strings.HasSuffix(file, ".yaml") {
+				continue
+			}
+			for _, obj := range decodeDocuments[object](content) {
+				if obj.Kind == "ConfigMap" || obj.Kind == "Secret" {
+					renderedIn[obj.Kind+"/"+obj.Metadata.Name] = file
+			
```

**File**: `app/kumactl/cmd/install/testdata/install-control-plane.dump-values.yaml` (modified, +12/-0)
```diff
@@ -619,6 +619,12 @@ meshes:
         annotations: {}
         # -- Labels to add to the Deployment resource.
         labels: {}
+        # -- Labels to add to the zone proxy pods. Must not override the labels the
+        # chart sets on them.
+        podLabels: {}
+        # -- Annotations to add to the zone proxy pods, for example kuma.io/* sidecar
+        # settings. Must not override kuma.io/reachable-backends.
+        podAnnotations: {}
         # -- Subset of Kubernetes PodSpec fields applied to the pod template
         # (nodeSelector, tolerations, affinity, topologySpreadConstraints,
         #  priorityClassName, securityContext, containerSecurityContext, resources,
@@ -686,6 +692,12 @@ meshes:
         annotations: {}
         # -- Labels to add to the Deployment resource.
         labels: {}
+        # -- Labels to add to the zone proxy pods. Must not override the labels the
+        # chart sets on them.
+        podLabels: {}
+        # -- Annotations to add to the zone proxy pods, for example kuma.io/* sidecar
+        # settings. Must not override kuma.io/reachable-backends.
+        podAnnotations: {}
         # -- Subset of Kubernetes PodSpec fields applied to the pod template
         # (nodeSelector, tolerations, affinity, topologySpreadConstraints,
         #  priorityClassName, securityContext, containerSecurityContext, resources,
```

**File**: `app/kumactl/cmd/install/testdata/install-cp-helm/meshZoneProxyPodLabels.golden.yaml` (added, +1222/-0)
```diff
@@ -0,0 +1,1222 @@
+
+---
+apiVersion: v1
+kind: Namespace
+metadata:
+  name: kuma-system
+  labels:
+    kuma.io/sidecar-injection: "false"
+---
+apiVersion: v1
+kind: ServiceAccount
+metadata:
+  name: kuma-control-plane
+  namespace: kuma-system
+  labels: 
+    app: kuma-control-plane
+    app.kubernetes.io/name: kuma
+    app.kubernetes.io/instance: kuma
+---
+apiVersion: v1
+kind: ServiceAccount
+metadata:
+  name: kuma-default-ingress
+  namespace: kuma-system
+  labels: 
+    app: kuma-default-ingress
+    kuma.io/mesh: default
+    app.kubernetes.io/name: kuma
+    app.kubernetes.io/instance: kuma
+---
+apiVersion: v1
+kind: ServiceAccount
+metadata:
+  name: kuma-default-egress
+  namespace: kuma-system
+  labels: 
+    app: kuma-default-egress
+    kuma.io/mesh: default
+    app.kubernetes.io/name: kuma
+    app.kubernetes.io/instance: kuma
+---
+apiVersion: v1
+kind: ConfigMap
+metadata:
+  name: kuma-control-plane-config
+  namespace: kuma-system
+  labels: 
+    app: kuma-control-plane
+    app.kubernetes.io/name: kuma
+    app.kubernetes.io/instance: kuma
+data:
+  config.yaml: |
+    # use this file to override default configuration of `kuma-cp`
+    #
+    # see conf/kuma-cp.conf.yml for available settings
+---
+apiVersion: v1
+kind: ConfigMap
+metadata:
+  name: kuma-transparent-proxy-config
+  namespace: kuma-system
+  labels:
+    app: kuma-control-plane
+    app.kubernetes.io/name: kuma
+    app.kubernetes.io/instance: kuma
+data:
+  config.yaml: |
+    comments:
+      disabled: false
+    dropInvalidPackets: false
+    ipFamilyMode: dualstack
+    iptablesExecutables:
+      ip6tables: ""
+      ip6tables-restore: ""
+      ip6tables-save: ""
+      iptables: ""
+      iptables-restore: ""
+      iptables-save: ""
+    kumaDPUser: "5678"
+    log:
+      enabled: false
+    redirect:
+      dns:
+        captureAll: true
+        enabled: true
+        port: 15053
+        resolvConfigPath: /etc/resolv.conf
+        skipConntrackZoneSplit: false
+      inbound:
+        enabled: true
+        excludePorts: []
+        excludePortsForIPs: []
+        excludePortsForUIDs: []
+        includePorts: []
+        insertRedirectInsteadOfAppend: false
+        port: 15006
+      outbound:
+        enabled: true
+        excludePorts: []
+        excludePortsForIPs: []
+        excludePortsForUIDs: []
+        includePorts: []
+        insertRedirectInsteadOfAppend: false
+        port: 15001
+      vnet:
+        networks: []
+    retry:
+      maxRetries: 4
+      sleepBetweenRetries: 2s
+    storeFirewalld: false
+    verbose: false
+    wait: 5
+    waitInterval: 0
+---
+apiVersion: rbac.authorization.k8s.io/v1
+kind: ClusterRole
+metadata:
+  name: kuma-control-plane
+  labels: 
+    app: kuma-control-plane
+    app.kubernetes.io/name: kuma
+    app.kubernetes.io/instance: kuma
+rules:
+  # Kubernetes resources
+  - apiGroups:
+      - ""
+    resources:
+      - namespaces
+      - pods
+      - nodes
+      - services
+    verbs:
+      - get
+      - list
+      - watch
+  - apiGroups:
+      - "discovery.k8s.io"
+    resources:
+      - endpointslices
+    verbs:
+      - get
+      - list
+      - watch
+  - apiGroups:
+      - "apps"
+    resources:
+      - deployments
+      - replicasets
+    verbs:
+      - get
+      - list
+      - watch
+  - apiGroups:
+      - "batch"
+    resources:
+      - jobs
+    verbs:
+      - get
+      - list
+      - watch
+  - apiGroups: # Gateway API
+      - gateway.networking.k8s.io
+    resources:
+      - grpcroutes
+      - httproutes
+      - referencegrants
+    verbs:
+      - get
+      - list
+      - watch
+  - apiGroups: # Gateway API legacy finalizer cleanup during upgrade
+      - gateway.networking.k8s.io
+    resources:
+      - gatewayclasses
+    verbs:
+      - get
+      - list
+      - patch
+  - apiGroups:
+      - kuma.io
+    resources:
+      - dataplanes
+      - dataplaneinsights
+      - meshes
+      - zones
+      - zoneinsights
+      - meshinsights
+      - containerpatches
+      - meshaccesslogs
+      - meshcircuitbreakers
+      - meshfaultinjections
+      - meshhealthchecks
+      - meshhttproutes
+      - meshloadbalancingstrategies
+      - meshmetrics
+      - meshpassthroughs
+      - meshproxypatches
+      - meshratelimits
+      - meshretries
+      - meshtcproutes
+      - meshtimeouts
+      - meshtlses
+      - meshtraces
+      - meshtrafficpermissions
+      - hostnamegenerators
+      - meshexternalservices
+      - meshidentities
+      - meshmultizoneservices
+      - meshopentelemetrybackends
+      - meshservices
+      - meshtrusts
+      - meshzoneaddresses
+      - workloads
+    verbs:
+      - get
+      - list
+      - watch
+      - create
+      - update
+      - patch
+      - delete
+  - apiGroups:
+      - kuma.io
+    resources:
+      - meshes/finalizers
+      - dataplanes/finalizers
+    verbs:
+      - get
+      - patch
+      - update
+  # validate k8s token before issuing
```

**File**: `app/kumactl/cmd/install/testdata/install-cp-helm/meshZoneProxyPodLabels.values.yaml` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+meshes:
+  - name: default
+    ingress:
+      enabled: true
+      deployment:
+        podLabels:
+          team: platform
+        podAnnotations:
+          kuma.io/envoy-log-level: debug
+    egress:
+      enabled: true
+      deployment:
+        podLabels:
+          team: platform
```

**File**: `deployments/charts/kuma/README.md` (modified, +6/-2)
```diff
@@ -177,10 +177,12 @@ A Helm chart for the Kuma Control Plane
 | meshes[0].ingress.service.spec | object | `{}` | Additional Service spec fields (externalIPs, loadBalancerIP, loadBalancerSourceRanges, etc.). Merged directly into the Service spec. |
 | meshes[0].ingress.service.annotations | object | `{}` | Annotations to add to the Service resource. |
 | meshes[0].ingress.service.labels | object | `{}` | Labels to add to the Service resource. |
-| meshes[0].ingress.deployment | object | `{"annotations":{},"labels":{},"podSpec":{},"replicas":null}` | Deployment-level settings. |
+| meshes[0].ingress.deployment | object | `{"annotations":{},"labels":{},"podAnnotations":{},"podLabels":{},"podSpec":{},"replicas":null}` | Deployment-level settings. |
 | meshes[0].ingress.deployment.replicas | int | `nil` | Number of replicas. Ignored when hpa.enabled is true. Falls back to meshZoneProxyDefaults.<role>.replicas when unset. |
 | meshes[0].ingress.deployment.annotations | object | `{}` | Annotations to add to the Deployment resource. |
 | meshes[0].ingress.deployment.labels | object | `{}` | Labels to add to the Deployment resource. |
+| meshes[0].ingress.deployment.podLabels | object | `{}` | Labels to add to the zone proxy pods. Must not override the labels the chart sets on them. |
+| meshes[0].ingress.deployment.podAnnotations | object | `{}` | Annotations to add to the zone proxy pods, for example kuma.io/* sidecar settings. Must not override kuma.io/reachable-backends. |
 | meshes[0].ingress.deployment.podSpec | object | `{}` | Subset of Kubernetes PodSpec fields applied to the pod template (nodeSelector, tolerations, affinity, topologySpreadConstraints,  priorityClassName, securityContext, containerSecurityContext, resources,  containerResources). |
 | meshes[0].ingress.hpa | object | `{"enabled":false,"maxReplicas":5,"minReplicas":2,"targetCPUUtilizationPercentage":80}` | Horizontal Pod Autoscaler settings. |
 | meshes[0].ingress.pdb | object | `{"enabled":false,"maxUnavailable":1}` | Pod Disruption Budget settings. |
@@ -198,10 +200,12 @@ A Helm chart for the Kuma Control Plane
 | meshes[0].egress.service.spec | object | `{}` | Additional Service spec fields (externalIPs, loadBalancerIP, loadBalancerSourceRanges, etc.). Merged directly into the Service spec. |
 | meshes[0].egress.service.annotations | object | `{}` | Annotations to add to the Service resource. |
 | meshes[0].egress.service.labels | object | `{}` | Labels to add to the Service resource. |
-| meshes[0].egress.deployment | object | `{"annotations":{},"labels":{},"podSpec":{},"replicas":null}` | Deployment-level settings. |
+| meshes[0].egress.deployment | object | `{"annotations":{},"labels":{},"podAnnotations":{},"podLabels":{},"podSpec":{},"replicas":null}` | Deployment-level settings. |
 | meshes[0].egress.deployment.replicas | int | `nil` | Number of replicas. Ignored when hpa.enabled is true. Falls back to meshZoneProxyDefaults.<role>.replicas when unset. |
 | meshes[0].egress.deployment.annotations | object | `{}` | Annotations to add to the Deployment resource. |
 | meshes[0].egress.deployment.labels | object | `{}` | Labels to add to the Deployment resource. |
+| meshes[0].egress.deployment.podLabels | object | `{}` | Labels to add to the zone proxy pods. Must not override the labels the chart sets on them. |
+| meshes[0].egress.deployment.podAnnotations | object | `{}` | Annotations to add to the zone proxy pods, for example kuma.io/* sidecar settings. Must not override kuma.io/reachable-backends. |
 | meshes[0].egress.deployment.podSpec | object | `{}` | Subset of Kubernetes PodSpec fields applied to the pod template (nodeSelector, tolerations, affinity, topologySpreadConstraints,  priorityClassName, securityContext, containerSecurityContext, resources,  containerResources). |
 | meshes[0].egress.hpa.enabled | bool | `false` |  |
 | meshes[0].egress.hpa.minReplicas | int | `2` |  |
```

**File**: `deployments/charts/kuma/templates/_mesh-helpers.tpl` (modified, +14/-0)
```diff
@@ -34,6 +34,20 @@ kuma.io/mesh: {{ .meshName }}
 {{ include "kuma.labels" .root }}
 {{- end -}}
 
+{{/*
+Pod template labels for per-mesh zone proxies. They carry no chart or app
+version, so upgrading the control plane does not restart the zone proxies.
+params: { root: $, meshName: string, role: string }
+*/}}
+{{- define "kuma.mesh.zoneproxy.podLabels" -}}
+app: {{ include "kuma.mesh.zoneproxy.name" . }}
+kuma.io/mesh: {{ .meshName }}
+{{ include "kuma.selectorLabels" .root }}
+app.kubernetes.io/managed-by: {{ .root.Release.Service }}
+kuma.io/sidecar-injection: enabled
+k8s.kuma.io/zone-proxy-type: {{ .role }}
+{{- end -}}
+
 {{/*
 Selector labels for per-mesh zone proxy resources.
 params: { root: $, meshName: string, role: string }
```

---

### Incident Patch 2: `46c23d9a` (2026-09-29)
**Commit Message**: chore(deps): bump kumahq/kuma-gui to 1a08b5e0dcce5a6181db1b431a7ab60c2059450a (#18911)

Signed-off-by: GitHub <[REDACTED_EMAIL]>
Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `app/kuma-ui/pkg/resources/data/assets/App-8A-67HEp.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as B,r as m,o as k,c as X,a as A,b as u,w as d,e as l,t as w,n as oe,_ as O,u as ae,f as re,g as ne,h as ie,i as le,j as f,k as v,l as T,m as C,p as se,q as ce,s as q,v as de,x as ue,y as S,z as pe}from"./index--Tf9I0ST.js";const fe=""+new URL("product-logo-CDoXkXpC.png",import.meta.url).href,ve={class:"app-navigator"},ge=B({__name:"AppNavigator",props:{active:{type:Boolean,default:!1},label:{default:""},to:{default:()=>({})}},setup(e){const o=e;return(r,a)=>{const i=m("XAction");return k(),X("li",ve,[A(r.$slots,"default",{},()=>[u(i,{class:oe({"is-active":o.active}),to:o.to},{default:d(()=>[l(w(o.label),1)]),_:1},8,["class","to"])],!0)])}}}),L=O(ge,[["__scopeId","data-v-b1ed9f4d"]]);var H=window.document,N=window.Math,z=window.HTMLElement,D=window.XMLHttpRequest,U=function(e,o){for(var r=0,a=e.length;r<a;r++)o(e[r])},K=function(e){return function(o,r,a){var i=e.createElement(o);if(r!=null)for(var n in r){var t=r[n];t!=null&&(i[n]!=null?i[n]=t:i.setAttribute(n,t))}return a!=null&&U(a,function(c){i.appendChild(typeof c=="string"?e.createTextNode(c):c)}),i}},j=K(H),he=function(e){var o;return function(){o||(o=1,e.apply(this,arguments))}},V=function(e,o){return{}.hasOwnProperty.call(e,o)},I=function(e){return(""+e).toLowerCase()},me="github-buttons",be="2.33.0",we="https://"+("unpkg.com/"+me+"@"+be+"/dist")+"/buttons.html",_="github.com",ke="https://api."+_,ee=D&&"prototype"in D&&"withCredentials"in D.prototype,_e=ee&&z&&"attachShadow"in z.prototype&&!("prototype"in z.prototype.attachShadow),y=function(e,o,r){e.addEventListener?e.addEventListener(o,r,!1):e.attachEvent("on"+o,r)},P=function(e,o,r){e.removeEventListener?e.removeEventListener(o,r,!1):e.detachEvent("on"+o,r)},ye=function(e,o,r){var a=function(){return P(e,o,a),r.apply(this,arguments)};y(e,o,a)},xe=function(e,o,r){if(e.readyState!=null){var a="readystatechange",i=function(){if(o.test(e.readyState))return P(e,a,i),r.apply(this,arguments)};y(e,a,i)}},Ae=function(e){var o={href:e.href,title:e.title,"aria-label":e.getAttribute("aria-label")};return U(["icon","color-scheme","text","size","show-count"],function(r){var a="data-"+r;o[a]=e.getAttribute(a)}),o["data-text"]==null&&(o["data-text"]=e.textContent||e.innerText),o},Me="body{margin:0}a{text-decoration:none;outline:0}.widget{display:inline-block;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:0;line-height:0;white-space:nowrap}.btn,.social-count{position:relative;display:inline-block;display:inline-flex;height:14px;padding:2px 5px;font-size:11px;font-weight:600;line-height:14px;vertical-align:bottom;cursor:pointer;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;background-repeat:repeat-x;background-position:-1px -1px;background-size:110% 110%;border:1px solid}.btn{border-radius:.25em}.btn:not(:last-child){border-radius:.25em 0 0 .25em}.social-count{border-left:0;border-radius:0 .25em .25em 0}.widget-lg .btn,.widget-lg .social-count{height:16px;padding:5px 10px;font-size:12px;line-height:16px}.octicon{display:inline-block;vertical-align:text-top;fill:currentColor;overflow:visible}",Ce=`.btn:focus-visible,.social-count:focus-visible{outline:2px solid #0969da;outline-offset:-2px}.btn{color:#25292e;background-color:#ebf0f4;border-color:#d1d9e0;background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg'%3e%3clinearGradient id='o' x2='0' y2='1'%3e%3cstop stop-color='%23f6f8fa'/%3e%3cstop offset='90%25' stop-color='%23ebf0f4'/%3e%3c/linearGradient%3e%3crect width='100%25' height='100%25' fill='url(%23o)'/%3e%3c/svg%3e");background-image:-moz-linear-gradient(top, #f6f8fa, #ebf0f4 90%);background-image:linear-gradient(180deg, #f6f8fa, #ebf0f4 90%);filter:progid:DXImageTransform.Microsoft.Gradient(startColorstr='#FFF6F8FA', endColorstr='#FFEAEFF3')}:root .btn{filter:none}.btn:hover,.btn:focus{background-color:#e5eaee;background-position:0 -0.5em;border-color:#d1d9e0;background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg'%3e%3clinearGradient id='o' x2='0' y2='1'%3e%3cstop stop-color='%23eff2f5'/%3e%3cstop offset='90%25' stop-color='%23e5eaee'/%3e%3c/linearGradient%3e%3crect width='100%25' height='100%25' fill='url(%23o)'/%3e%3c/svg%3e");background-image:-moz-linear-gradient(top, #eff2f5, #e5eaee 90%);background-image:linear-gradient(180deg, #eff2f5, #e5eaee 90%);filter:progid:DXImageTransform.Microsoft.Gradient(startColorstr='#FFEFF2F5', endColorstr='#FFE4E9ED')}:root .btn:hover,:root .btn:focus{filter:none}.btn:active{background-color:#e6eaef;border-color:#d1d9e0;background-image:none;filter:none}.social-count{color:#25292e;background-color:#fff;border-color:#d1d9e0}.social-count:hover,.social-count:focus{color:#0969da}.octicon-heart{color:#bf3989}`,Ee=".btn:focus-visible,.social-count:focus-visible{outline:2px solid #0349b4;outline-offset:-2px}.btn{color:#25292e;background-color:#e0e6eb;border-color:#454c54;background-image:none;filter:non
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConfigurationDetailView-COxh3ROP.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{d as _,o as f,l as C,w as t,b as n,e as x,k as h,v as b,j as w,r as o}from"./index--Tf9I0ST.js";const y=_({__name:"ConfigurationDetailView",setup(R){return(V,r)=>{const i=o("RouteTitle"),s=o("XCodeBlock"),d=o("DataLoader"),l=o("XCard"),u=o("AppView"),p=o("RouteView");return f(),C(p,{name:"configuration-view",params:{codeSearch:"",codeFilter:!1,codeRegExp:!1}},{default:t(({route:e,t:c,uri:m})=>[n(u,{breadcrumbs:[{to:{name:"configuration-view"},text:c("configuration.routes.item.breadcrumbs")}]},{title:t(()=>[w("h1",null,[n(i,{title:c("configuration.routes.item.title")},null,8,["title"])])]),default:t(()=>[r[0]||(r[0]=x()),n(l,null,{default:t(()=>[n(d,{src:m(h(b),"/config",{})},{default:t(({data:[g]})=>[n(s,{"data-testid":"code-block-configuration",language:"json",code:JSON.stringify(g,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},null,8,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1024)]),_:2},1032,["breadcrumbs"])]),_:1})}}});export{y as default};
+import{d as _,o as f,l as C,w as t,b as n,e as x,k as h,v as b,j as w,r as o}from"./index-C9mgfMZc.js";const y=_({__name:"ConfigurationDetailView",setup(R){return(V,r)=>{const i=o("RouteTitle"),s=o("XCodeBlock"),d=o("DataLoader"),l=o("XCard"),u=o("AppView"),p=o("RouteView");return f(),C(p,{name:"configuration-view",params:{codeSearch:"",codeFilter:!1,codeRegExp:!1}},{default:t(({route:e,t:c,uri:m})=>[n(u,{breadcrumbs:[{to:{name:"configuration-view"},text:c("configuration.routes.item.breadcrumbs")}]},{title:t(()=>[w("h1",null,[n(i,{title:c("configuration.routes.item.title")},null,8,["title"])])]),default:t(()=>[r[0]||(r[0]=x()),n(l,null,{default:t(()=>[n(d,{src:m(h(b),"/config",{})},{default:t(({data:[g]})=>[n(s,{"data-testid":"code-block-configuration",language:"json",code:JSON.stringify(g,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},null,8,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1024)]),_:2},1032,["breadcrumbs"])]),_:1})}}});export{y as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryClustersView-BiIz_2RD.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as T,r as o,o as i,l,w as t,b as s,e as m,k as V,Q as E,c as F,I as N,J as v}from"./index--Tf9I0ST.js";const D=T({__name:"ConnectionInboundSummaryClustersView",props:{routeName:{},data:{},overview:{}},setup(u){const n=u;return(B,r)=>{const _=o("RouteTitle"),f=o("XAction"),g=o("XCodeBlock"),y=o("DataCollection"),d=o("DataLoader"),C=o("AppView"),x=o("RouteView");return i(),l(x,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:n.routeName},{default:t(({route:e,uri:h})=>[s(_,{render:!1,title:"Clusters"}),r[1]||(r[1]=m()),s(C,null,{default:t(()=>[s(d,{data:[n.overview]},{default:t(({data:[R]})=>[s(d,{src:h(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:t(({data:[k],refresh:w})=>[(i(!0),F(N,null,v(["stat_prefix"in n.data?n.data.stat_prefix:("clusterName"in n.data?n.data.clusterName:e.params.connection).replace("_",":")],c=>(i(),l(y,{key:typeof c,items:k.split(`
+import{d as T,r as o,o as i,l,w as t,b as s,e as m,k as V,Q as E,c as F,I as N,J as v}from"./index-C9mgfMZc.js";const D=T({__name:"ConnectionInboundSummaryClustersView",props:{routeName:{},data:{},overview:{}},setup(u){const n=u;return(B,r)=>{const _=o("RouteTitle"),f=o("XAction"),g=o("XCodeBlock"),y=o("DataCollection"),d=o("DataLoader"),C=o("AppView"),x=o("RouteView");return i(),l(x,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:n.routeName},{default:t(({route:e,uri:h})=>[s(_,{render:!1,title:"Clusters"}),r[1]||(r[1]=m()),s(C,null,{default:t(()=>[s(d,{data:[n.overview]},{default:t(({data:[R]})=>[s(d,{src:h(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:t(({data:[k],refresh:w})=>[(i(!0),F(N,null,v(["stat_prefix"in n.data?n.data.stat_prefix:("clusterName"in n.data?n.data.clusterName:e.params.connection).replace("_",":")],c=>(i(),l(y,{key:typeof c,items:k.split(`
 `),predicate:p=>p.startsWith(`${c}`)},{default:t(({items:p})=>[s(g,{language:"json",code:p.map(a=>a.replace(`${c}::`,"")).join(`
 `),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},{"primary-actions":t(()=>[s(f,{action:"refresh",appearance:"primary",onClick:w},{default:t(()=>[...r[0]||(r[0]=[m(`
                     Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryStatsView-CwCTwuk9.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as R,r as o,o as $,l as C,w as r,b as n,e as p,k as A,Q as w,a8 as k}from"./index--Tf9I0ST.js";const V=R({__name:"ConnectionInboundSummaryStatsView",props:{data:{},networking:{},routeName:{},overview:{}},setup(i){const a=i,e=k(()=>({...a.data,proxyResourceName:"stat_prefix"in a.data?a.data.stat_prefix:"",listenerAddress:"listenerAddress"in a.data?a.data.listenerAddress:"",clusterName:"clusterName"in a.data?a.data.clusterName:"",port:"port"in a.data?a.data.port.toString():"",servicePort:"servicePort"in a.data?a.data.servicePort:"",name:"name"in a.data?a.data.name:""}));return(S,l)=>{const u=o("RouteTitle"),m=o("XAction"),v=o("XCodeBlock"),g=o("DataCollection"),d=o("DataLoader"),x=o("AppView"),_=o("RouteView");return $(),C(_,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:a.routeName},{default:r(({route:t,uri:y})=>[n(u,{render:!1,title:"Stats"}),l[1]||(l[1]=p()),n(x,null,{default:r(()=>[n(d,{data:[a.overview]},{default:r(({data:[h]})=>[n(d,{src:y(A(w),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[t.params.proxyType]??"dataplane",name:h.id,mesh:t.params.mesh||"*",socketAddress:a.networking.inboundAddress})},{default:r(({data:[f],refresh:N})=>[n(g,{items:f.raw.split(`
+import{d as R,r as o,o as $,l as C,w as r,b as n,e as p,k as A,Q as w,a8 as k}from"./index-C9mgfMZc.js";const V=R({__name:"ConnectionInboundSummaryStatsView",props:{data:{},networking:{},routeName:{},overview:{}},setup(i){const a=i,e=k(()=>({...a.data,proxyResourceName:"stat_prefix"in a.data?a.data.stat_prefix:"",listenerAddress:"listenerAddress"in a.data?a.data.listenerAddress:"",clusterName:"clusterName"in a.data?a.data.clusterName:"",port:"port"in a.data?a.data.port.toString():"",servicePort:"servicePort"in a.data?a.data.servicePort:"",name:"name"in a.data?a.data.name:""}));return(S,l)=>{const u=o("RouteTitle"),m=o("XAction"),v=o("XCodeBlock"),g=o("DataCollection"),d=o("DataLoader"),x=o("AppView"),_=o("RouteView");return $(),C(_,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:a.routeName},{default:r(({route:t,uri:y})=>[n(u,{render:!1,title:"Stats"}),l[1]||(l[1]=p()),n(x,null,{default:r(()=>[n(d,{data:[a.overview]},{default:r(({data:[h]})=>[n(d,{src:y(A(w),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[t.params.proxyType]??"dataplane",name:h.id,mesh:t.params.mesh||"*",socketAddress:a.networking.inboundAddress})},{default:r(({data:[f],refresh:N})=>[n(g,{items:f.raw.split(`
 `),predicate:c=>[`listener.${e.value.listenerAddress?.length>0?e.value.listenerAddress:t.params.connection}`,`cluster.${e.value.name}.`,`cluster.${e.value.clusterName}.`,`http.${e.value.name}.`,`http.${e.value.clusterName}.`,`tcp.${e.value.name}.`,`cluster.${e.value.proxyResourceName}.`,`listener.${e.value.proxyResourceName}`,`cluster.${e.value.proxyResourceName}.`,`http.${e.value.proxyResourceName}.`,`http.${e.value.proxyResourceName}.`,`tcp.${e.value.proxyResourceName}.`].some(s=>c.startsWith(s))&&(!c.includes(".rds.")||c.includes(`_${e.value.port}`)||c.includes(`${e.value.servicePort}`))},{default:r(({items:c})=>[n(v,{language:"json",code:c.map(s=>s.replace(`${e.value.listenerAddress?.length>0?e.value.listenerAddress:e.value.proxyResourceName.length?e.value.proxyResourceName:t.params.connection}.`,"").replace(e.value.name.length?`${e.value.name}.`:"","").replace(e.value.clusterName.length?`${e.value.clusterName}.`:"","")).join(`
 `),"is-searchable":"",query:t.params.codeSearch,"is-filter-mode":t.params.codeFilter,"is-reg-exp-mode":t.params.codeRegExp,onQueryChange:s=>t.update({codeSearch:s}),onFilterModeChange:s=>t.update({codeFilter:s}),onRegExpModeChange:s=>t.update({codeRegExp:s})},{"primary-actions":r(()=>[n(m,{action:"refresh",appearance:"primary",onClick:N},{default:r(()=>[...l[0]||(l[0]=[p(`
                   Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryView-Gs7E4lvB.js` (renamed, +1/-1)
```diff
@@ -1,2 +1,2 @@
-import{d as C,r as n,o as l,l as m,w as t,b as s,e as c,K as X,J as x,t as d,x as b,j as B,m as N}from"./index--Tf9I0ST.js";const T=C({__name:"ConnectionInboundSummaryView",props:{data:{},overview:{},networking:{},routeName:{}},setup(u){const r=u;return($,o)=>{const _=n("XBadge"),w=n("XLayout"),v=n("XAction"),f=n("XTabs"),y=n("RouterView"),g=n("AppView"),V=n("DataCollection"),k=n("RouteView");return l(),m(k,{name:r.routeName,params:{inactive:Boolean,proxyType:"",connection:""}},{default:t(({route:a,t:p})=>[s(V,{items:r.data,predicate:r.networking.type==="gateway"?e=>!0:a.params.proxyType===""?e=>`${e.name}`===a.params.connection:e=>`${e.socketAddress.replace(":","_")}`===a.params.connection,find:!0},{default:t(({items:e})=>[s(g,null,{title:t(()=>[s(w,{variant:"y-stack",size:"small"},{default:t(()=>[B("h2",null,`
+import{d as C,r as n,o as l,l as m,w as t,b as s,e as c,K as X,J as x,t as d,x as b,j as B,m as N}from"./index-C9mgfMZc.js";const T=C({__name:"ConnectionInboundSummaryView",props:{data:{},overview:{},networking:{},routeName:{}},setup(u){const r=u;return($,o)=>{const _=n("XBadge"),w=n("XLayout"),v=n("XAction"),f=n("XTabs"),y=n("RouterView"),g=n("AppView"),V=n("DataCollection"),k=n("RouteView");return l(),m(k,{name:r.routeName,params:{inactive:Boolean,proxyType:"",connection:""}},{default:t(({route:a,t:p})=>[s(V,{items:r.data,predicate:r.networking.type==="gateway"?e=>!0:a.params.proxyType===""?e=>`${e.name}`===a.params.connection:e=>`${e.socketAddress.replace(":","_")}`===a.params.connection,find:!0},{default:t(({items:e})=>[s(g,null,{title:t(()=>[s(w,{variant:"y-stack",size:"small"},{default:t(()=>[B("h2",null,`
               Inbound `+d(a.params.connection.replace("localhost","").replace("_",":")),1),o[0]||(o[0]=c()),e[0]?.state?(l(),m(_,{key:0,appearance:p(`common.status.appearance.${e[0].state}`,void 0,{defaultMessage:"neutral"})},{default:t(()=>[c(d(p(`http.api.value.${e[0].state}`)),1)]),_:2},1032,["appearance"])):N("",!0)]),_:2},1024)]),default:t(()=>[o[1]||(o[1]=c()),s(f,{selected:a.child()?.name},X({_:2},[x(a.children,({name:i})=>({name:`${i}-tab`,fn:t(()=>[s(v,{to:{name:i,query:{inactive:a.params.inactive}}},{default:t(()=>[c(d(p(`connections.routes.item.navigation.${i.split("-")[5]}`)),1)]),_:2},1032,["to"])])}))]),1032,["selected"]),o[2]||(o[2]=c()),s(y,null,{default:t(i=>[(l(),m(b(i.Component),{data:e[0],overview:r.overview,networking:r.networking},null,8,["data","overview","networking"]))]),_:2},1024)]),_:2},1024)]),_:2},1032,["items","predicate"])]),_:1},8,["name"])}}});export{T as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryXdsConfigView-U1cGOWLj.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{d as C,r as o,o as w,l as R,w as a,b as n,e as d,k,Q as T,t as V}from"./index--Tf9I0ST.js";const S=C({__name:"ConnectionInboundSummaryXdsConfigView",props:{data:{},routeName:{},overview:{}},setup(p){const t=p;return(b,r)=>{const m=o("RouteTitle"),l=o("XAction"),u=o("XCodeBlock"),i=o("DataLoader"),_=o("AppView"),g=o("RouteView");return w(),R(g,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:t.routeName},{default:a(({t:c,route:e,uri:f})=>[n(m,{render:!1,title:c("connections.routes.item.navigation.xds")},null,8,["title"]),r[0]||(r[0]=d()),n(_,null,{default:a(()=>[n(i,{data:[t.overview]},{default:a(({data:[x]})=>[n(i,{src:f(k(T),"/connections/xds/for/:proxyType/:name/:mesh/inbound/:inbound",{mesh:e.params.mesh||"*",name:x.id,inbound:"stat_prefix"in t.data?t.data.stat_prefix:`${t.data.port}`,proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane"})},{default:a(({data:[y],refresh:h})=>[n(u,{language:"json",code:JSON.stringify(y,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:s=>e.update({codeSearch:s}),onFilterModeChange:s=>e.update({codeFilter:s}),onRegExpModeChange:s=>e.update({codeRegExp:s})},{"primary-actions":a(()=>[n(l,{action:"refresh",appearance:"primary",onClick:h},{default:a(()=>[d(V(c("common.refresh")),1)]),_:2},1032,["onClick"])]),_:2},1032,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1032,["data"])]),_:2},1024)]),_:1},8,["name"])}}});export{S as default};
+import{d as C,r as o,o as w,l as R,w as a,b as n,e as d,k,Q as T,t as V}from"./index-C9mgfMZc.js";const S=C({__name:"ConnectionInboundSummaryXdsConfigView",props:{data:{},routeName:{},overview:{}},setup(p){const t=p;return(b,r)=>{const m=o("RouteTitle"),l=o("XAction"),u=o("XCodeBlock"),i=o("DataLoader"),_=o("AppView"),g=o("RouteView");return w(),R(g,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:t.routeName},{default:a(({t:c,route:e,uri:f})=>[n(m,{render:!1,title:c("connections.routes.item.navigation.xds")},null,8,["title"]),r[0]||(r[0]=d()),n(_,null,{default:a(()=>[n(i,{data:[t.overview]},{default:a(({data:[x]})=>[n(i,{src:f(k(T),"/connections/xds/for/:proxyType/:name/:mesh/inbound/:inbound",{mesh:e.params.mesh||"*",name:x.id,inbound:"stat_prefix"in t.data?t.data.stat_prefix:`${t.data.port}`,proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane"})},{default:a(({data:[y],refresh:h})=>[n(u,{language:"json",code:JSON.stringify(y,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:s=>e.update({codeSearch:s}),onFilterModeChange:s=>e.update({codeFilter:s}),onRegExpModeChange:s=>e.update({codeRegExp:s})},{"primary-actions":a(()=>[n(l,{action:"refresh",appearance:"primary",onClick:h},{default:a(()=>[d(V(c("common.refresh")),1)]),_:2},1032,["onClick"])]),_:2},1032,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1032,["data"])]),_:2},1024)]),_:1},8,["name"])}}});export{S as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionOutboundSummaryClustersView-xLfcCZVM.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as T,r as a,o as p,l,w as n,b as t,e as m,k as V,Q as E,c as F,I as v,J as B}from"./index--Tf9I0ST.js";const M=T({__name:"ConnectionOutboundSummaryClustersView",props:{routeName:{},overview:{}},setup(u){const i=u;return(A,s)=>{const _=a("RouteTitle"),g=a("XAction"),f=a("XCodeBlock"),y=a("DataCollection"),d=a("DataLoader"),C=a("AppView"),h=a("RouteView");return p(),l(h,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:i.routeName},{default:n(({route:e,uri:x})=>[t(_,{render:!1,title:"Clusters"}),s[1]||(s[1]=m()),t(C,null,{default:n(()=>[t(d,{data:[i.overview]},{default:n(({data:[R]})=>[t(d,{src:x(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:n(({data:[k],refresh:w})=>[(p(!0),F(v,null,B([e.params.connection],r=>(p(),l(y,{key:typeof r,items:k.split(`
+import{d as T,r as a,o as p,l,w as n,b as t,e as m,k as V,Q as E,c as F,I as v,J as B}from"./index-C9mgfMZc.js";const M=T({__name:"ConnectionOutboundSummaryClustersView",props:{routeName:{},overview:{}},setup(u){const i=u;return(A,s)=>{const _=a("RouteTitle"),g=a("XAction"),f=a("XCodeBlock"),y=a("DataCollection"),d=a("DataLoader"),C=a("AppView"),h=a("RouteView");return p(),l(h,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:i.routeName},{default:n(({route:e,uri:x})=>[t(_,{render:!1,title:"Clusters"}),s[1]||(s[1]=m()),t(C,null,{default:n(()=>[t(d,{data:[i.overview]},{default:n(({data:[R]})=>[t(d,{src:x(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:n(({data:[k],refresh:w})=>[(p(!0),F(v,null,B([e.params.connection],r=>(p(),l(y,{key:typeof r,items:k.split(`
 `),predicate:c=>c.startsWith(`${r}::`)},{default:n(({items:c})=>[t(f,{language:"json",code:c.map(o=>o.replace(`${r}::`,"")).join(`
 `),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:o=>e.update({codeSearch:o}),onFilterModeChange:o=>e.update({codeFilter:o}),onRegExpModeChange:o=>e.update({codeRegExp:o})},{"primary-actions":n(()=>[t(g,{action:"refresh",appearance:"primary",onClick:w},{default:n(()=>[...s[0]||(s[0]=[m(`
                     Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionOutboundSummaryStatsView-BQTxqD9b.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as w,r as a,o as k,l as R,w as n,b as t,e as d,k as A,Q as T}from"./index--Tf9I0ST.js";const v=w({__name:"ConnectionOutboundSummaryStatsView",props:{networking:{},routeName:{},overview:{}},setup(i){const r=i;return(V,s)=>{const m=a("RouteTitle"),l=a("XAction"),u=a("XCodeBlock"),_=a("DataCollection"),p=a("DataLoader"),g=a("AppView"),f=a("RouteView");return k(),R(f,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:r.routeName},{default:n(({route:e,uri:x})=>[t(m,{render:!1,title:"Stats"}),s[1]||(s[1]=d()),t(g,null,{default:n(()=>[t(p,{data:[r.overview]},{default:n(({data:[y]})=>[t(p,{src:x(A(T),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:y.id,mesh:e.params.mesh||"*",socketAddress:r.networking.inboundAddress})},{default:n(({data:[C],refresh:h})=>[t(_,{items:C.raw.split(`
+import{d as w,r as a,o as k,l as R,w as n,b as t,e as d,k as A,Q as T}from"./index-C9mgfMZc.js";const v=w({__name:"ConnectionOutboundSummaryStatsView",props:{networking:{},routeName:{},overview:{}},setup(i){const r=i;return(V,s)=>{const m=a("RouteTitle"),l=a("XAction"),u=a("XCodeBlock"),_=a("DataCollection"),p=a("DataLoader"),g=a("AppView"),f=a("RouteView");return k(),R(f,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:r.routeName},{default:n(({route:e,uri:x})=>[t(m,{render:!1,title:"Stats"}),s[1]||(s[1]=d()),t(g,null,{default:n(()=>[t(p,{data:[r.overview]},{default:n(({data:[y]})=>[t(p,{src:x(A(T),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:y.id,mesh:e.params.mesh||"*",socketAddress:r.networking.inboundAddress})},{default:n(({data:[C],refresh:h})=>[t(_,{items:C.raw.split(`
 `),predicate:c=>c.includes(`.${e.params.connection}.`)},{default:n(({items:c})=>[t(u,{language:"json",code:c.map(o=>o.replace(`${e.params.connection}.`,"")).join(`
 `),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:o=>e.update({codeSearch:o}),onFilterModeChange:o=>e.update({codeFilter:o}),onRegExpModeChange:o=>e.update({codeRegExp:o})},{"primary-actions":n(()=>[t(l,{action:"refresh",appearance:"primary",onClick:h},{default:n(()=>[...s[0]||(s[0]=[d(`
                   Refresh
```

---

### Incident Patch 3: `d0f35bdc` (2026-09-29)
**Commit Message**: chore(deps): bump kumahq/kuma-gui to efcc5c5fb24500d64d3f0c1aba330313de17487c (#18909)

Signed-off-by: GitHub <[REDACTED_EMAIL]>
Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `app/kuma-ui/pkg/resources/kuma-gui-cve-report.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"matches":[],"source":{"type":"directory","target":"kumahq/kuma-gui"},"distro":{"name":"","version":"","idLike":null},"descriptor":{"name":"grype","version":"0.110.0","configuration":{"output":["json"],"file":"/tmp/grype-uZg31r/output","pretty":false,"distro":"","add-cpes-if-none":true,"output-template-file":"","check-for-app-update":false,"only-fixed":false,"only-notfixed":false,"ignore-wontfix":"","platform":"","search":{"scope":"squashed","unindexed-archives":false,"indexed-archives":true},"ignore":[{"vulnerability":"","include-aliases":false,"reason":"","namespace":"","fix-state":"","package":{"name":"kernel-headers","version":"","language":"","type":"rpm","location":"","upstream-name":"kernel"},"vex-status":"","vex-justification":"","match-type":"exact-indirect-match"},{"vulnerability":"","include-aliases":false,"reason":"","namespace":"","fix-state":"","package":{"name":"linux(-.*)?-headers-.*","version":"","language":"","type":"deb","location":"","upstream-name":"linux.*"},"vex-status":"","vex-justification":"","match-type":"exact-indirect-match"},{"vulnerability":"","include-aliases":false,"reason":"","namespace":"","fix-state":"","package":{"name":"linux-libc-dev","version":"","language":"","type":"deb","location":"","upstream-name":"linux"},"vex-status":"","vex-justification":"","match-type":"exact-indirect-match"}],"exclude":[],"externalSources":{"enable":false,"maven":{"searchUpstreamBySha1":true,"baseUrl":"https://search.maven.org/solrsearch/select","rateLimit":300000000}},"match":{"java":{"using-cpes":false},"jvm":{"using-cpes":true},"dotnet":{"using-cpes":false},"golang":{"using-cpes":false,"always-use-cpe-for-stdlib":true,"allow-main-module-pseudo-version-comparison":false},"javascript":{"using-cpes":false},"python":{"using-cpes":false},"ruby":{"using-cpes":false},"rust":{"using-cpes":false},"hex":{"using-cpes":false},"stock":{"using-cpes":true},"dpkg":{"using-cpes":false,"missing-epoch-strategy":"zero","use-cpes-for-eol":false},"rpm":{"using-cpes":false,"missing-epoch-strategy":"auto","use-cpes-for-eol":false}},"fail-on-severity":"critical","registry":{"insecure-skip-tls-verify":false,"insecure-use-http":false,"ca-cert":""},"show-suppressed":false,"by-cve":false,"SortBy":{"sort-by":"risk"},"name":"","default-image-pull-source":"","from":null,"vex-documents":[],"vex-add":[],"match-upstream-kernel-headers":false,"fix-channel":{"redhat-eus":{"apply":"auto","versions":">= 8.0"}},"timestamp":true,"alerts":{"enable-eol-distro-warnings":true},"db":{"cache-dir":"/home/runner/.cache/grype/db","update-url":"https://grype.anchore.io/databases","ca-cert":"","auto-update":false,"validate-by-hash-on-start":true,"validate-age":true,"max-allowed-built-age":432000000000000,"require-update-check":false,"update-available-timeout":30000000000,"update-download-timeout":300000000000,"max-update-check-frequency":7200000000000},"exp":{},"dev":{"db":{"debug":false}}},"db":{"status":{"schemaVersion":"v6.1.9","from":"https://grype.anchore.io/databases/v6/vulnerability-db_v6.1.9_2026-09-28T00:37:02Z_1790577750.tar.zst?checksum=sha256%3Adf23160af6e2d67cf3a5b6ccbc7e1de0c2c4ecd15cbd7dc6127ef4f9010ea714","built":"2026-09-28T06:42:30Z","path":"/home/runner/.cache/grype/db/6/vulnerability.db","valid":true},"providers":{"alma":{"captured":"2026-09-28T00:37:06Z","input":"xxh64:db73183617e221d9"},"alpine":{"captured":"2026-09-28T00:37:07Z","input":"xxh64:069b49b669c9908f"},"amazon":{"captured":"2026-09-28T00:37:07Z","input":"xxh64:adb0702b41093d14"},"arch":{"captured":"2026-09-28T00:37:30Z","input":"xxh64:5ac1a4147f274238"},"bitnami":{"captured":"2026-09-28T00:37:32Z","input":"xxh64:93ab043a716d1763"},"chainguard":{"captured":"2026-09-28T00:37:20Z","input":"xxh64:931843e8524d00f0"},"chainguard-libraries":{"captured":"2026-09-28T00:37:02Z","input":"xxh64:2a0c8cd3a91296c5"},"debian":{"captured":"2026-09-28T00:37:42Z","input":"xxh64:627442ffda93c812"},"echo":{"captured":"2026-09-28T00:37:02Z","input":"xxh64:2933f699ab438d25"},"eol":{"captured":"2026-09-28T00:37:07Z","input":"xxh64:6485bf18696fd03d"},"epss":{"captured":"2026-09-28T00:37:14Z","input":"xxh64:6aeaaf97873055be"},"fedora":{"captured":"2026-09-28T00:37:35Z","input":"xxh64:71e37a980df16b9a"},"github":{"captured":"2026-09-28T00:37:18Z","input":"xxh64:70547b5cfb53a8fb"},"govulndb":{"captured":"2026-09-28T00:37:17Z","input":"xxh64:c63cbb5f6c2fdc1b"},"hummingbird":{"captured":"2026-09-28T00:40:25Z","input":"xxh64:338fc824a6e3ab57"},"kev":{"captured":"2026-09-28T00:37:05Z","input":"xxh64:a7f7e45ad81b0d4e"},"mariner":{"captured":"2026-09-28T00:37:25Z","input":"xxh64:667cc9b8edc8951d"},"minimos":{"captured":"2026-09-28T00:37:24Z","input":"xxh64:baa49901fea83295"},"nvd":{"captured":"2026-09-28T00:38:34Z","input":"xxh64:898648240acc2587"},"oracle":{"captured":"2026-09-28T00:37:05Z","input":"xxh64:f8e4412f587f1966"},"photon":{"captured":"2026-09-28T00:38:29Z","input":"xxh64:4b975332c1c7d768"},"rhel":{"captured":"2026-09-28T00:38:56Z","input":"xxh64:e3e40885abbc7dcc"}
```

---

### Incident Patch 4: `6ffae77b` (2026-09-29)
**Commit Message**: fix(xds): speed up Envoy stats tag extraction (#18910)

Signed-off-by: Bart Smykla <[REDACTED_EMAIL]>

**File**: `pkg/xds/bootstrap/template_v3.go` (modified, +18/-4)
```diff
@@ -106,22 +106,36 @@ func genConfig(parameters configParameters, enableReloadableTokens bool, _ *core
 			Layers: runtimeLayers,
 		},
 		StatsConfig: &envoy_metrics_v3.StatsConfig{
+			// Envoy runs a regex tag (std::regex) on every stat name unless the regex starts with "^<token>\.", so scope tags to a root token
 			StatsTags: []*envoy_metrics_v3.TagSpecifier{
 				{
 					TagName:  "name",
 					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^grpc\\.((.+)\\.)"},
 				},
 				{
 					TagName:  "status",
-					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^grpc.*streams_closed(_([0-9]+))"},
+					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^grpc\\..*streams_closed(_([0-9]+))"},
 				},
 				{
 					TagName:  "worker",
-					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "(worker_([0-9]+)\\.)"},
+					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^listener\\..*?(worker_([0-9]+)\\.)"},
 				},
 				{
-					TagName:  "listener",
-					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "((.+?)\\.)rbac\\."},
+					TagName:  "worker",
+					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^listener_manager\\..*?(worker_([0-9]+)\\.)"},
+				},
+				{
+					TagName:  "worker",
+					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^server\\..*?(worker_([0-9]+)\\.)"},
+				},
+				{
+					TagName:  "worker",
+					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^thread_local_cluster_manager\\..*?(worker_([0-9]+)\\.)"},
+				},
+				{
+					TagName: "listener",
+					// no root token (network RBAC stats start with the listener stat prefix), "^" at least avoids a quadratic retry at every offset
+					TagValue: &envoy_metrics_v3.TagSpecifier_Regex{Regex: "^((.+?)\\.)rbac\\."},
 				},
 			},
 		},
```

**File**: `pkg/xds/bootstrap/testdata/bootstrap.k8s.golden.yaml` (modified, +9/-3)
```diff
@@ -129,9 +129,15 @@ statsConfig:
   statsTags:
   - regex: ^grpc\.((.+)\.)
     tagName: name
-  - regex: ^grpc.*streams_closed(_([0-9]+))
+  - regex: ^grpc\..*streams_closed(_([0-9]+))
     tagName: status
-  - regex: (worker_([0-9]+)\.)
+  - regex: ^listener\..*?(worker_([0-9]+)\.)
     tagName: worker
-  - regex: ((.+?)\.)rbac\.
+  - regex: ^listener_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^server\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^thread_local_cluster_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^((.+?)\.)rbac\.
     tagName: listener
```

**File**: `pkg/xds/bootstrap/testdata/bootstrap.overridden.golden.yaml` (modified, +9/-3)
```diff
@@ -141,9 +141,15 @@ statsConfig:
   statsTags:
   - regex: ^grpc\.((.+)\.)
     tagName: name
-  - regex: ^grpc.*streams_closed(_([0-9]+))
+  - regex: ^grpc\..*streams_closed(_([0-9]+))
     tagName: status
-  - regex: (worker_([0-9]+)\.)
+  - regex: ^listener\..*?(worker_([0-9]+)\.)
     tagName: worker
-  - regex: ((.+?)\.)rbac\.
+  - regex: ^listener_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^server\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^thread_local_cluster_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^((.+?)\.)rbac\.
     tagName: listener
```

**File**: `pkg/xds/bootstrap/testdata/bootstrap.universal.golden.yaml` (modified, +9/-3)
```diff
@@ -129,9 +129,15 @@ statsConfig:
   statsTags:
   - regex: ^grpc\.((.+)\.)
     tagName: name
-  - regex: ^grpc.*streams_closed(_([0-9]+))
+  - regex: ^grpc\..*streams_closed(_([0-9]+))
     tagName: status
-  - regex: (worker_([0-9]+)\.)
+  - regex: ^listener\..*?(worker_([0-9]+)\.)
     tagName: worker
-  - regex: ((.+?)\.)rbac\.
+  - regex: ^listener_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^server\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^thread_local_cluster_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^((.+?)\.)rbac\.
     tagName: listener
```

**File**: `pkg/xds/bootstrap/testdata/generator.custom-config-minimal-request.golden.yaml` (modified, +9/-3)
```diff
@@ -135,9 +135,15 @@ statsConfig:
   statsTags:
   - regex: ^grpc\.((.+)\.)
     tagName: name
-  - regex: ^grpc.*streams_closed(_([0-9]+))
+  - regex: ^grpc\..*streams_closed(_([0-9]+))
     tagName: status
-  - regex: (worker_([0-9]+)\.)
+  - regex: ^listener\..*?(worker_([0-9]+)\.)
     tagName: worker
-  - regex: ((.+?)\.)rbac\.
+  - regex: ^listener_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^server\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^thread_local_cluster_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^((.+?)\.)rbac\.
     tagName: listener
```

**File**: `pkg/xds/bootstrap/testdata/generator.custom-config.golden.yaml` (modified, +9/-3)
```diff
@@ -168,9 +168,15 @@ statsConfig:
   statsTags:
   - regex: ^grpc\.((.+)\.)
     tagName: name
-  - regex: ^grpc.*streams_closed(_([0-9]+))
+  - regex: ^grpc\..*streams_closed(_([0-9]+))
     tagName: status
-  - regex: (worker_([0-9]+)\.)
+  - regex: ^listener\..*?(worker_([0-9]+)\.)
     tagName: worker
-  - regex: ((.+?)\.)rbac\.
+  - regex: ^listener_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^server\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^thread_local_cluster_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^((.+?)\.)rbac\.
     tagName: listener
```

**File**: `pkg/xds/bootstrap/testdata/generator.default-config-minimal-request.golden.yaml` (modified, +9/-3)
```diff
@@ -123,9 +123,15 @@ statsConfig:
   statsTags:
   - regex: ^grpc\.((.+)\.)
     tagName: name
-  - regex: ^grpc.*streams_closed(_([0-9]+))
+  - regex: ^grpc\..*streams_closed(_([0-9]+))
     tagName: status
-  - regex: (worker_([0-9]+)\.)
+  - regex: ^listener\..*?(worker_([0-9]+)\.)
     tagName: worker
-  - regex: ((.+?)\.)rbac\.
+  - regex: ^listener_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^server\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^thread_local_cluster_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^((.+?)\.)rbac\.
     tagName: listener
```

**File**: `pkg/xds/bootstrap/testdata/generator.default-config-token-path.golden.yaml` (modified, +9/-3)
```diff
@@ -150,9 +150,15 @@ statsConfig:
   statsTags:
   - regex: ^grpc\.((.+)\.)
     tagName: name
-  - regex: ^grpc.*streams_closed(_([0-9]+))
+  - regex: ^grpc\..*streams_closed(_([0-9]+))
     tagName: status
-  - regex: (worker_([0-9]+)\.)
+  - regex: ^listener\..*?(worker_([0-9]+)\.)
     tagName: worker
-  - regex: ((.+?)\.)rbac\.
+  - regex: ^listener_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^server\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^thread_local_cluster_manager\..*?(worker_([0-9]+)\.)
+    tagName: worker
+  - regex: ^((.+?)\.)rbac\.
     tagName: listener
```

---

### Incident Patch 5: `0d668b4e` (2026-09-28)
**Commit Message**: fix(kuma-dp): avoid double scrape on otel export (backport of #18871) (#18906)

Signed-off-by: Bart Smykla <[REDACTED_EMAIL]>
Co-authored-by: Bart Smykla <[REDACTED_EMAIL]>

**File**: `app/kuma-dp/pkg/dataplane/metrics/server.go` (modified, +4/-2)
```diff
@@ -221,12 +221,14 @@ func (s *Hijacker) Start(stop <-chan struct{}) error {
 		ErrorLog:          adapter.ToStd(logger),
 	}
 
-	promExporter, err := prometheus.New(prometheus.WithProducer(s.producer), prometheus.WithTranslationStrategy(otlptranslator.UnderscoreEscapingWithoutSuffixes))
+	// not the default registry: the OTel self metrics bridge gathers it and would scrape applications again
+	registry := prom_client.NewRegistry()
+	promExporter, err := prometheus.New(prometheus.WithRegisterer(registry), prometheus.WithProducer(s.producer), prometheus.WithTranslationStrategy(otlptranslator.UnderscoreEscapingWithoutSuffixes))
 	if err != nil {
 		return err
 	}
 	sdkmetric.NewMeterProvider(sdkmetric.WithReader(promExporter))
-	s.prometheusHandler = promhttp.HandlerFor(prom_client.DefaultGatherer, promhttp.HandlerOpts{
+	s.prometheusHandler = promhttp.HandlerFor(prom_client.Gatherers{prom_client.DefaultGatherer, registry}, promhttp.HandlerOpts{
 		ErrorHandling: promhttp.ContinueOnError,
 	})
 
```

**File**: `app/kuma-dp/pkg/dataplane/metrics/server_test.go` (modified, +76/-0)
```diff
@@ -2,16 +2,23 @@ package metrics
 
 import (
 	"io"
+	"net"
 	"net/http"
+	"net/http/httptest"
 	"net/url"
 	"os"
 	"path"
+	"path/filepath"
+	"strconv"
+	"sync/atomic"
 
 	. "github.com/onsi/ginkgo/v2"
 	. "github.com/onsi/gomega"
+	prom_client "github.com/prometheus/client_golang/prometheus"
 	"github.com/prometheus/common/expfmt"
 
 	"github.com/kumahq/kuma/v3/pkg/plugins/policies/meshmetric/api/v1alpha1"
+	meshmetric_plugin "github.com/kumahq/kuma/v3/pkg/plugins/policies/meshmetric/plugin/v1alpha1"
 )
 
 var (
@@ -91,6 +98,75 @@ var _ = Describe("Rewriting the metrics URL", func() {
 	)
 })
 
+var _ = Describe("MeshMetric Prometheus endpoint", func() {
+	var hits atomic.Int64
+	var body string
+
+	BeforeEach(func() {
+		hits.Store(0)
+		app := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
+			hits.Add(1)
+			w.Header().Set(hdrContentType, "text/plain; charset=UTF-8")
+			_, _ = w.Write([]byte("# TYPE test_app_requests counter\ntest_app_requests 1\n"))
+		}))
+		DeferCleanup(app.Close)
+		host, portStr, err := net.SplitHostPort(app.Listener.Addr().String())
+		Expect(err).ToNot(HaveOccurred())
+		port, err := strconv.ParseUint(portStr, 10, 32)
+		Expect(err).ToNot(HaveOccurred())
+
+		producer := NewAggregatedMetricsProducer([]ApplicationToScrape{{
+			Name:              "app",
+			Address:           host,
+			Port:              uint32(port),
+			Path:              "/metrics",
+			QueryModifier:     RemoveQueryParameters,
+			MeshMetricMutator: AggregatedOtelMutator(),
+		}}, false, "dev")
+
+		// not GinkgoT().TempDir(), unix socket paths are capped at ~104 chars on macOS
+		dir, err := os.MkdirTemp("", "hijacker")
+		Expect(err).ToNot(HaveOccurred())
+		DeferCleanup(os.RemoveAll, dir)
+		socketPath := filepath.Join(dir, "metrics.sock")
+
+		stop := make(chan struct{})
+		hijacker := New(socketPath, nil, false, producer)
+		go func() {
+			defer GinkgoRecover()
+			Expect(hijacker.Start(stop)).To(Succeed())
+		}()
+		DeferCleanup(func() { close(stop) })
+		Eventually(func() error {
+			_, err := os.Stat(socketPath)
+			return err
+		}).Should(Succeed())
+
+		client := createHTTPClientForUDS(socketPath)
+		resp, err := client.Get("http://localhost" + meshmetric_plugin.PrometheusDataplaneStatsPath)
+		Expect(err).ToNot(HaveOccurred())
+		defer resp.Body.Close()
+		b, err := io.ReadAll(resp.Body)
+		Expect(err).ToNot(HaveOccurred())
+		body = string(b)
+	})
+
+	It("should serve application and kuma-dp metrics", func() {
+		Expect(body).To(ContainSubstring("test_app_requests"))
+		Expect(body).To(ContainSubstring("go_goroutines"))
+		Expect(hits.Load()).To(BeEquivalentTo(1))
+	})
+
+	It("should not scrape applications when the default gatherer is gathered", func() {
+		hits.Store(0)
+
+		_, err := prom_client.DefaultGatherer.Gather()
+
+		Expect(err).ToNot(HaveOccurred())
+		Expect(hits.Load()).To(BeZero())
+	})
+})
+
 var _ = Describe("Select Content Type", func() {
 	var reqHeader http.Header
 	BeforeEach(func() {
```

---

### Incident Patch 6: `7b51a52f` (2026-09-28)
**Commit Message**: chore(deps): bump kumahq/kuma-gui to efcc5c5fb24500d64d3f0c1aba330313de17487c (#18903)

Signed-off-by: GitHub <[REDACTED_EMAIL]>
Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `app/kuma-ui/pkg/resources/data/assets/App-Cz-lYtRH.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as B,r as m,o as k,c as X,a as A,b as u,w as d,e as l,t as w,n as oe,_ as O,u as ae,f as re,g as ne,h as ie,i as le,j as f,k as v,l as T,m as C,p as se,q as ce,s as q,v as de,x as ue,y as S,z as pe}from"./index-CbPVfXiU.js";const fe=""+new URL("product-logo-CDoXkXpC.png",import.meta.url).href,ve={class:"app-navigator"},ge=B({__name:"AppNavigator",props:{active:{type:Boolean,default:!1},label:{default:""},to:{default:()=>({})}},setup(e){const o=e;return(r,a)=>{const i=m("XAction");return k(),X("li",ve,[A(r.$slots,"default",{},()=>[u(i,{class:oe({"is-active":o.active}),to:o.to},{default:d(()=>[l(w(o.label),1)]),_:1},8,["class","to"])],!0)])}}}),L=O(ge,[["__scopeId","data-v-b1ed9f4d"]]);var H=window.document,N=window.Math,z=window.HTMLElement,D=window.XMLHttpRequest,U=function(e,o){for(var r=0,a=e.length;r<a;r++)o(e[r])},K=function(e){return function(o,r,a){var i=e.createElement(o);if(r!=null)for(var n in r){var t=r[n];t!=null&&(i[n]!=null?i[n]=t:i.setAttribute(n,t))}return a!=null&&U(a,function(c){i.appendChild(typeof c=="string"?e.createTextNode(c):c)}),i}},j=K(H),he=function(e){var o;return function(){o||(o=1,e.apply(this,arguments))}},V=function(e,o){return{}.hasOwnProperty.call(e,o)},I=function(e){return(""+e).toLowerCase()},me="github-buttons",be="2.33.0",we="https://"+("unpkg.com/"+me+"@"+be+"/dist")+"/buttons.html",_="github.com",ke="https://api."+_,ee=D&&"prototype"in D&&"withCredentials"in D.prototype,_e=ee&&z&&"attachShadow"in z.prototype&&!("prototype"in z.prototype.attachShadow),y=function(e,o,r){e.addEventListener?e.addEventListener(o,r,!1):e.attachEvent("on"+o,r)},P=function(e,o,r){e.removeEventListener?e.removeEventListener(o,r,!1):e.detachEvent("on"+o,r)},ye=function(e,o,r){var a=function(){return P(e,o,a),r.apply(this,arguments)};y(e,o,a)},xe=function(e,o,r){if(e.readyState!=null){var a="readystatechange",i=function(){if(o.test(e.readyState))return P(e,a,i),r.apply(this,arguments)};y(e,a,i)}},Ae=function(e){var o={href:e.href,title:e.title,"aria-label":e.getAttribute("aria-label")};return U(["icon","color-scheme","text","size","show-count"],function(r){var a="data-"+r;o[a]=e.getAttribute(a)}),o["data-text"]==null&&(o["data-text"]=e.textContent||e.innerText),o},Me="body{margin:0}a{text-decoration:none;outline:0}.widget{display:inline-block;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:0;line-height:0;white-space:nowrap}.btn,.social-count{position:relative;display:inline-block;display:inline-flex;height:14px;padding:2px 5px;font-size:11px;font-weight:600;line-height:14px;vertical-align:bottom;cursor:pointer;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;background-repeat:repeat-x;background-position:-1px -1px;background-size:110% 110%;border:1px solid}.btn{border-radius:.25em}.btn:not(:last-child){border-radius:.25em 0 0 .25em}.social-count{border-left:0;border-radius:0 .25em .25em 0}.widget-lg .btn,.widget-lg .social-count{height:16px;padding:5px 10px;font-size:12px;line-height:16px}.octicon{display:inline-block;vertical-align:text-top;fill:currentColor;overflow:visible}",Ce=`.btn:focus-visible,.social-count:focus-visible{outline:2px solid #0969da;outline-offset:-2px}.btn{color:#25292e;background-color:#ebf0f4;border-color:#d1d9e0;background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg'%3e%3clinearGradient id='o' x2='0' y2='1'%3e%3cstop stop-color='%23f6f8fa'/%3e%3cstop offset='90%25' stop-color='%23ebf0f4'/%3e%3c/linearGradient%3e%3crect width='100%25' height='100%25' fill='url(%23o)'/%3e%3c/svg%3e");background-image:-moz-linear-gradient(top, #f6f8fa, #ebf0f4 90%);background-image:linear-gradient(180deg, #f6f8fa, #ebf0f4 90%);filter:progid:DXImageTransform.Microsoft.Gradient(startColorstr='#FFF6F8FA', endColorstr='#FFEAEFF3')}:root .btn{filter:none}.btn:hover,.btn:focus{background-color:#e5eaee;background-position:0 -0.5em;border-color:#d1d9e0;background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg'%3e%3clinearGradient id='o' x2='0' y2='1'%3e%3cstop stop-color='%23eff2f5'/%3e%3cstop offset='90%25' stop-color='%23e5eaee'/%3e%3c/linearGradient%3e%3crect width='100%25' height='100%25' fill='url(%23o)'/%3e%3c/svg%3e");background-image:-moz-linear-gradient(top, #eff2f5, #e5eaee 90%);background-image:linear-gradient(180deg, #eff2f5, #e5eaee 90%);filter:progid:DXImageTransform.Microsoft.Gradient(startColorstr='#FFEFF2F5', endColorstr='#FFE4E9ED')}:root .btn:hover,:root .btn:focus{filter:none}.btn:active{background-color:#e6eaef;border-color:#d1d9e0;background-image:none;filter:none}.social-count{color:#25292e;background-color:#fff;border-color:#d1d9e0}.social-count:hover,.social-count:focus{color:#0969da}.octicon-heart{color:#bf3989}`,Ee=".btn:focus-visible,.social-count:focus-visible{outline:2px solid #0349b4;outline-offset:-2px}.btn{color:#25292e;background-color:#e0e6eb;border-color:#454c54;background-image:none;filter:non
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConfigurationDetailView-CklIrMly.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{d as _,o as f,l as C,w as t,b as n,e as x,k as h,v as b,j as w,r as o}from"./index-CbPVfXiU.js";const y=_({__name:"ConfigurationDetailView",setup(R){return(V,r)=>{const i=o("RouteTitle"),s=o("XCodeBlock"),d=o("DataLoader"),l=o("XCard"),u=o("AppView"),p=o("RouteView");return f(),C(p,{name:"configuration-view",params:{codeSearch:"",codeFilter:!1,codeRegExp:!1}},{default:t(({route:e,t:c,uri:m})=>[n(u,{breadcrumbs:[{to:{name:"configuration-view"},text:c("configuration.routes.item.breadcrumbs")}]},{title:t(()=>[w("h1",null,[n(i,{title:c("configuration.routes.item.title")},null,8,["title"])])]),default:t(()=>[r[0]||(r[0]=x()),n(l,null,{default:t(()=>[n(d,{src:m(h(b),"/config",{})},{default:t(({data:[g]})=>[n(s,{"data-testid":"code-block-configuration",language:"json",code:JSON.stringify(g,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},null,8,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1024)]),_:2},1032,["breadcrumbs"])]),_:1})}}});export{y as default};
+import{d as _,o as f,l as C,w as t,b as n,e as x,k as h,v as b,j as w,r as o}from"./index--Tf9I0ST.js";const y=_({__name:"ConfigurationDetailView",setup(R){return(V,r)=>{const i=o("RouteTitle"),s=o("XCodeBlock"),d=o("DataLoader"),l=o("XCard"),u=o("AppView"),p=o("RouteView");return f(),C(p,{name:"configuration-view",params:{codeSearch:"",codeFilter:!1,codeRegExp:!1}},{default:t(({route:e,t:c,uri:m})=>[n(u,{breadcrumbs:[{to:{name:"configuration-view"},text:c("configuration.routes.item.breadcrumbs")}]},{title:t(()=>[w("h1",null,[n(i,{title:c("configuration.routes.item.title")},null,8,["title"])])]),default:t(()=>[r[0]||(r[0]=x()),n(l,null,{default:t(()=>[n(d,{src:m(h(b),"/config",{})},{default:t(({data:[g]})=>[n(s,{"data-testid":"code-block-configuration",language:"json",code:JSON.stringify(g,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},null,8,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1024)]),_:2},1032,["breadcrumbs"])]),_:1})}}});export{y as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryClustersView-Ro8tN245.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as T,r as o,o as i,l,w as t,b as s,e as m,k as V,Q as E,c as F,I as N,J as v}from"./index-CbPVfXiU.js";const D=T({__name:"ConnectionInboundSummaryClustersView",props:{routeName:{},data:{},overview:{}},setup(u){const n=u;return(B,r)=>{const _=o("RouteTitle"),f=o("XAction"),g=o("XCodeBlock"),y=o("DataCollection"),d=o("DataLoader"),C=o("AppView"),x=o("RouteView");return i(),l(x,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:n.routeName},{default:t(({route:e,uri:h})=>[s(_,{render:!1,title:"Clusters"}),r[1]||(r[1]=m()),s(C,null,{default:t(()=>[s(d,{data:[n.overview]},{default:t(({data:[R]})=>[s(d,{src:h(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:t(({data:[k],refresh:w})=>[(i(!0),F(N,null,v(["stat_prefix"in n.data?n.data.stat_prefix:("clusterName"in n.data?n.data.clusterName:e.params.connection).replace("_",":")],c=>(i(),l(y,{key:typeof c,items:k.split(`
+import{d as T,r as o,o as i,l,w as t,b as s,e as m,k as V,Q as E,c as F,I as N,J as v}from"./index--Tf9I0ST.js";const D=T({__name:"ConnectionInboundSummaryClustersView",props:{routeName:{},data:{},overview:{}},setup(u){const n=u;return(B,r)=>{const _=o("RouteTitle"),f=o("XAction"),g=o("XCodeBlock"),y=o("DataCollection"),d=o("DataLoader"),C=o("AppView"),x=o("RouteView");return i(),l(x,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:n.routeName},{default:t(({route:e,uri:h})=>[s(_,{render:!1,title:"Clusters"}),r[1]||(r[1]=m()),s(C,null,{default:t(()=>[s(d,{data:[n.overview]},{default:t(({data:[R]})=>[s(d,{src:h(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:t(({data:[k],refresh:w})=>[(i(!0),F(N,null,v(["stat_prefix"in n.data?n.data.stat_prefix:("clusterName"in n.data?n.data.clusterName:e.params.connection).replace("_",":")],c=>(i(),l(y,{key:typeof c,items:k.split(`
 `),predicate:p=>p.startsWith(`${c}`)},{default:t(({items:p})=>[s(g,{language:"json",code:p.map(a=>a.replace(`${c}::`,"")).join(`
 `),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},{"primary-actions":t(()=>[s(f,{action:"refresh",appearance:"primary",onClick:w},{default:t(()=>[...r[0]||(r[0]=[m(`
                     Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryStatsView-LTV3Ib6f.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as R,r as o,o as $,l as C,w as r,b as n,e as p,k as A,Q as w,a5 as k}from"./index-CbPVfXiU.js";const V=R({__name:"ConnectionInboundSummaryStatsView",props:{data:{},networking:{},routeName:{},overview:{}},setup(i){const a=i,e=k(()=>({...a.data,proxyResourceName:"stat_prefix"in a.data?a.data.stat_prefix:"",listenerAddress:"listenerAddress"in a.data?a.data.listenerAddress:"",clusterName:"clusterName"in a.data?a.data.clusterName:"",port:"port"in a.data?a.data.port.toString():"",servicePort:"servicePort"in a.data?a.data.servicePort:"",name:"name"in a.data?a.data.name:""}));return(S,l)=>{const u=o("RouteTitle"),m=o("XAction"),v=o("XCodeBlock"),g=o("DataCollection"),d=o("DataLoader"),x=o("AppView"),_=o("RouteView");return $(),C(_,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:a.routeName},{default:r(({route:t,uri:y})=>[n(u,{render:!1,title:"Stats"}),l[1]||(l[1]=p()),n(x,null,{default:r(()=>[n(d,{data:[a.overview]},{default:r(({data:[h]})=>[n(d,{src:y(A(w),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[t.params.proxyType]??"dataplane",name:h.id,mesh:t.params.mesh||"*",socketAddress:a.networking.inboundAddress})},{default:r(({data:[f],refresh:N})=>[n(g,{items:f.raw.split(`
+import{d as R,r as o,o as $,l as C,w as r,b as n,e as p,k as A,Q as w,a8 as k}from"./index--Tf9I0ST.js";const V=R({__name:"ConnectionInboundSummaryStatsView",props:{data:{},networking:{},routeName:{},overview:{}},setup(i){const a=i,e=k(()=>({...a.data,proxyResourceName:"stat_prefix"in a.data?a.data.stat_prefix:"",listenerAddress:"listenerAddress"in a.data?a.data.listenerAddress:"",clusterName:"clusterName"in a.data?a.data.clusterName:"",port:"port"in a.data?a.data.port.toString():"",servicePort:"servicePort"in a.data?a.data.servicePort:"",name:"name"in a.data?a.data.name:""}));return(S,l)=>{const u=o("RouteTitle"),m=o("XAction"),v=o("XCodeBlock"),g=o("DataCollection"),d=o("DataLoader"),x=o("AppView"),_=o("RouteView");return $(),C(_,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:a.routeName},{default:r(({route:t,uri:y})=>[n(u,{render:!1,title:"Stats"}),l[1]||(l[1]=p()),n(x,null,{default:r(()=>[n(d,{data:[a.overview]},{default:r(({data:[h]})=>[n(d,{src:y(A(w),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[t.params.proxyType]??"dataplane",name:h.id,mesh:t.params.mesh||"*",socketAddress:a.networking.inboundAddress})},{default:r(({data:[f],refresh:N})=>[n(g,{items:f.raw.split(`
 `),predicate:c=>[`listener.${e.value.listenerAddress?.length>0?e.value.listenerAddress:t.params.connection}`,`cluster.${e.value.name}.`,`cluster.${e.value.clusterName}.`,`http.${e.value.name}.`,`http.${e.value.clusterName}.`,`tcp.${e.value.name}.`,`cluster.${e.value.proxyResourceName}.`,`listener.${e.value.proxyResourceName}`,`cluster.${e.value.proxyResourceName}.`,`http.${e.value.proxyResourceName}.`,`http.${e.value.proxyResourceName}.`,`tcp.${e.value.proxyResourceName}.`].some(s=>c.startsWith(s))&&(!c.includes(".rds.")||c.includes(`_${e.value.port}`)||c.includes(`${e.value.servicePort}`))},{default:r(({items:c})=>[n(v,{language:"json",code:c.map(s=>s.replace(`${e.value.listenerAddress?.length>0?e.value.listenerAddress:e.value.proxyResourceName.length?e.value.proxyResourceName:t.params.connection}.`,"").replace(e.value.name.length?`${e.value.name}.`:"","").replace(e.value.clusterName.length?`${e.value.clusterName}.`:"","")).join(`
 `),"is-searchable":"",query:t.params.codeSearch,"is-filter-mode":t.params.codeFilter,"is-reg-exp-mode":t.params.codeRegExp,onQueryChange:s=>t.update({codeSearch:s}),onFilterModeChange:s=>t.update({codeFilter:s}),onRegExpModeChange:s=>t.update({codeRegExp:s})},{"primary-actions":r(()=>[n(m,{action:"refresh",appearance:"primary",onClick:N},{default:r(()=>[...l[0]||(l[0]=[p(`
                   Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryView-Ct-nLA56.js` (renamed, +1/-1)
```diff
@@ -1,2 +1,2 @@
-import{d as C,r as n,o as l,l as m,w as t,b as s,e as c,K as X,J as x,t as d,x as b,j as B,m as N}from"./index-CbPVfXiU.js";const T=C({__name:"ConnectionInboundSummaryView",props:{data:{},overview:{},networking:{},routeName:{}},setup(u){const r=u;return($,o)=>{const _=n("XBadge"),w=n("XLayout"),v=n("XAction"),f=n("XTabs"),y=n("RouterView"),g=n("AppView"),V=n("DataCollection"),k=n("RouteView");return l(),m(k,{name:r.routeName,params:{inactive:Boolean,proxyType:"",connection:""}},{default:t(({route:a,t:p})=>[s(V,{items:r.data,predicate:r.networking.type==="gateway"?e=>!0:a.params.proxyType===""?e=>`${e.name}`===a.params.connection:e=>`${e.socketAddress.replace(":","_")}`===a.params.connection,find:!0},{default:t(({items:e})=>[s(g,null,{title:t(()=>[s(w,{variant:"y-stack",size:"small"},{default:t(()=>[B("h2",null,`
+import{d as C,r as n,o as l,l as m,w as t,b as s,e as c,K as X,J as x,t as d,x as b,j as B,m as N}from"./index--Tf9I0ST.js";const T=C({__name:"ConnectionInboundSummaryView",props:{data:{},overview:{},networking:{},routeName:{}},setup(u){const r=u;return($,o)=>{const _=n("XBadge"),w=n("XLayout"),v=n("XAction"),f=n("XTabs"),y=n("RouterView"),g=n("AppView"),V=n("DataCollection"),k=n("RouteView");return l(),m(k,{name:r.routeName,params:{inactive:Boolean,proxyType:"",connection:""}},{default:t(({route:a,t:p})=>[s(V,{items:r.data,predicate:r.networking.type==="gateway"?e=>!0:a.params.proxyType===""?e=>`${e.name}`===a.params.connection:e=>`${e.socketAddress.replace(":","_")}`===a.params.connection,find:!0},{default:t(({items:e})=>[s(g,null,{title:t(()=>[s(w,{variant:"y-stack",size:"small"},{default:t(()=>[B("h2",null,`
               Inbound `+d(a.params.connection.replace("localhost","").replace("_",":")),1),o[0]||(o[0]=c()),e[0]?.state?(l(),m(_,{key:0,appearance:p(`common.status.appearance.${e[0].state}`,void 0,{defaultMessage:"neutral"})},{default:t(()=>[c(d(p(`http.api.value.${e[0].state}`)),1)]),_:2},1032,["appearance"])):N("",!0)]),_:2},1024)]),default:t(()=>[o[1]||(o[1]=c()),s(f,{selected:a.child()?.name},X({_:2},[x(a.children,({name:i})=>({name:`${i}-tab`,fn:t(()=>[s(v,{to:{name:i,query:{inactive:a.params.inactive}}},{default:t(()=>[c(d(p(`connections.routes.item.navigation.${i.split("-")[5]}`)),1)]),_:2},1032,["to"])])}))]),1032,["selected"]),o[2]||(o[2]=c()),s(y,null,{default:t(i=>[(l(),m(b(i.Component),{data:e[0],overview:r.overview,networking:r.networking},null,8,["data","overview","networking"]))]),_:2},1024)]),_:2},1024)]),_:2},1032,["items","predicate"])]),_:1},8,["name"])}}});export{T as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryXdsConfigView-izST-ITO.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{d as C,r as o,o as w,l as R,w as a,b as n,e as d,k,Q as T,t as V}from"./index-CbPVfXiU.js";const S=C({__name:"ConnectionInboundSummaryXdsConfigView",props:{data:{},routeName:{},overview:{}},setup(p){const t=p;return(b,r)=>{const m=o("RouteTitle"),l=o("XAction"),u=o("XCodeBlock"),i=o("DataLoader"),_=o("AppView"),g=o("RouteView");return w(),R(g,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:t.routeName},{default:a(({t:c,route:e,uri:f})=>[n(m,{render:!1,title:c("connections.routes.item.navigation.xds")},null,8,["title"]),r[0]||(r[0]=d()),n(_,null,{default:a(()=>[n(i,{data:[t.overview]},{default:a(({data:[x]})=>[n(i,{src:f(k(T),"/connections/xds/for/:proxyType/:name/:mesh/inbound/:inbound",{mesh:e.params.mesh||"*",name:x.id,inbound:"stat_prefix"in t.data?t.data.stat_prefix:`${t.data.port}`,proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane"})},{default:a(({data:[y],refresh:h})=>[n(u,{language:"json",code:JSON.stringify(y,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:s=>e.update({codeSearch:s}),onFilterModeChange:s=>e.update({codeFilter:s}),onRegExpModeChange:s=>e.update({codeRegExp:s})},{"primary-actions":a(()=>[n(l,{action:"refresh",appearance:"primary",onClick:h},{default:a(()=>[d(V(c("common.refresh")),1)]),_:2},1032,["onClick"])]),_:2},1032,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1032,["data"])]),_:2},1024)]),_:1},8,["name"])}}});export{S as default};
+import{d as C,r as o,o as w,l as R,w as a,b as n,e as d,k,Q as T,t as V}from"./index--Tf9I0ST.js";const S=C({__name:"ConnectionInboundSummaryXdsConfigView",props:{data:{},routeName:{},overview:{}},setup(p){const t=p;return(b,r)=>{const m=o("RouteTitle"),l=o("XAction"),u=o("XCodeBlock"),i=o("DataLoader"),_=o("AppView"),g=o("RouteView");return w(),R(g,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:t.routeName},{default:a(({t:c,route:e,uri:f})=>[n(m,{render:!1,title:c("connections.routes.item.navigation.xds")},null,8,["title"]),r[0]||(r[0]=d()),n(_,null,{default:a(()=>[n(i,{data:[t.overview]},{default:a(({data:[x]})=>[n(i,{src:f(k(T),"/connections/xds/for/:proxyType/:name/:mesh/inbound/:inbound",{mesh:e.params.mesh||"*",name:x.id,inbound:"stat_prefix"in t.data?t.data.stat_prefix:`${t.data.port}`,proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane"})},{default:a(({data:[y],refresh:h})=>[n(u,{language:"json",code:JSON.stringify(y,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:s=>e.update({codeSearch:s}),onFilterModeChange:s=>e.update({codeFilter:s}),onRegExpModeChange:s=>e.update({codeRegExp:s})},{"primary-actions":a(()=>[n(l,{action:"refresh",appearance:"primary",onClick:h},{default:a(()=>[d(V(c("common.refresh")),1)]),_:2},1032,["onClick"])]),_:2},1032,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1032,["data"])]),_:2},1024)]),_:1},8,["name"])}}});export{S as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionOutboundSummaryClustersView-D-G6q75W.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as T,r as a,o as p,l,w as n,b as t,e as m,k as V,Q as E,c as F,I as v,J as B}from"./index-CbPVfXiU.js";const M=T({__name:"ConnectionOutboundSummaryClustersView",props:{routeName:{},overview:{}},setup(u){const i=u;return(A,s)=>{const _=a("RouteTitle"),g=a("XAction"),f=a("XCodeBlock"),y=a("DataCollection"),d=a("DataLoader"),C=a("AppView"),h=a("RouteView");return p(),l(h,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:i.routeName},{default:n(({route:e,uri:x})=>[t(_,{render:!1,title:"Clusters"}),s[1]||(s[1]=m()),t(C,null,{default:n(()=>[t(d,{data:[i.overview]},{default:n(({data:[R]})=>[t(d,{src:x(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:n(({data:[k],refresh:w})=>[(p(!0),F(v,null,B([e.params.connection],r=>(p(),l(y,{key:typeof r,items:k.split(`
+import{d as T,r as a,o as p,l,w as n,b as t,e as m,k as V,Q as E,c as F,I as v,J as B}from"./index--Tf9I0ST.js";const M=T({__name:"ConnectionOutboundSummaryClustersView",props:{routeName:{},overview:{}},setup(u){const i=u;return(A,s)=>{const _=a("RouteTitle"),g=a("XAction"),f=a("XCodeBlock"),y=a("DataCollection"),d=a("DataLoader"),C=a("AppView"),h=a("RouteView");return p(),l(h,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:i.routeName},{default:n(({route:e,uri:x})=>[t(_,{render:!1,title:"Clusters"}),s[1]||(s[1]=m()),t(C,null,{default:n(()=>[t(d,{data:[i.overview]},{default:n(({data:[R]})=>[t(d,{src:x(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:n(({data:[k],refresh:w})=>[(p(!0),F(v,null,B([e.params.connection],r=>(p(),l(y,{key:typeof r,items:k.split(`
 `),predicate:c=>c.startsWith(`${r}::`)},{default:n(({items:c})=>[t(f,{language:"json",code:c.map(o=>o.replace(`${r}::`,"")).join(`
 `),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:o=>e.update({codeSearch:o}),onFilterModeChange:o=>e.update({codeFilter:o}),onRegExpModeChange:o=>e.update({codeRegExp:o})},{"primary-actions":n(()=>[t(g,{action:"refresh",appearance:"primary",onClick:w},{default:n(()=>[...s[0]||(s[0]=[m(`
                     Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionOutboundSummaryStatsView-D_5YHV_Y.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as w,r as a,o as k,l as R,w as n,b as t,e as d,k as A,Q as T}from"./index-CbPVfXiU.js";const v=w({__name:"ConnectionOutboundSummaryStatsView",props:{networking:{},routeName:{},overview:{}},setup(i){const r=i;return(V,s)=>{const m=a("RouteTitle"),l=a("XAction"),u=a("XCodeBlock"),_=a("DataCollection"),p=a("DataLoader"),g=a("AppView"),f=a("RouteView");return k(),R(f,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:r.routeName},{default:n(({route:e,uri:x})=>[t(m,{render:!1,title:"Stats"}),s[1]||(s[1]=d()),t(g,null,{default:n(()=>[t(p,{data:[r.overview]},{default:n(({data:[y]})=>[t(p,{src:x(A(T),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:y.id,mesh:e.params.mesh||"*",socketAddress:r.networking.inboundAddress})},{default:n(({data:[C],refresh:h})=>[t(_,{items:C.raw.split(`
+import{d as w,r as a,o as k,l as R,w as n,b as t,e as d,k as A,Q as T}from"./index--Tf9I0ST.js";const v=w({__name:"ConnectionOutboundSummaryStatsView",props:{networking:{},routeName:{},overview:{}},setup(i){const r=i;return(V,s)=>{const m=a("RouteTitle"),l=a("XAction"),u=a("XCodeBlock"),_=a("DataCollection"),p=a("DataLoader"),g=a("AppView"),f=a("RouteView");return k(),R(f,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:r.routeName},{default:n(({route:e,uri:x})=>[t(m,{render:!1,title:"Stats"}),s[1]||(s[1]=d()),t(g,null,{default:n(()=>[t(p,{data:[r.overview]},{default:n(({data:[y]})=>[t(p,{src:x(A(T),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:y.id,mesh:e.params.mesh||"*",socketAddress:r.networking.inboundAddress})},{default:n(({data:[C],refresh:h})=>[t(_,{items:C.raw.split(`
 `),predicate:c=>c.includes(`.${e.params.connection}.`)},{default:n(({items:c})=>[t(u,{language:"json",code:c.map(o=>o.replace(`${e.params.connection}.`,"")).join(`
 `),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:o=>e.update({codeSearch:o}),onFilterModeChange:o=>e.update({codeFilter:o}),onRegExpModeChange:o=>e.update({codeRegExp:o})},{"primary-actions":n(()=>[t(l,{action:"refresh",appearance:"primary",onClick:h},{default:n(()=>[...s[0]||(s[0]=[d(`
                   Refresh
```

---

### Incident Patch 7: `fc365032` (2026-09-28)
**Commit Message**: chore(lint): fix golangci-lint 2.14.0 findings (#18904)

Signed-off-by: Ilya Lobkov <[REDACTED_EMAIL]>

**File**: `app/kuma-dp/pkg/dataplane/metrics/metrics_format_mapper.go` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ func FromPrometheusMetrics(appMetrics map[string]*io_prometheus_client.MetricFam
 			case io_prometheus_client.MetricType_HISTOGRAM:
 				scopedAggregations = scopedHistograms(prometheusMetric.Metric, kumaVersion, extraAttributes, requestTime)
 			default:
-				log.Info("got unsupported metric type", "type", prometheusMetric.Type)
+				log.Info("got unsupported metric type", "type", prometheusMetric.GetType())
 			}
 			for scope, aggregations := range scopedAggregations {
 				scopedMetrics[scope] = append(scopedMetrics[scope], metricdata.Metrics{
```

**File**: `pkg/kds/client/stream.go` (modified, +2/-3)
```diff
@@ -285,10 +285,9 @@ func (s *stream) NACK(resourceType core_model.ResourceType, err error) error {
 func (s *stream) mapRemovedResources(removedResourceNames []string) []core_model.ResourceKey {
 	removed := []core_model.ResourceKey{}
 	for _, resourceName := range removedResourceNames {
-		index := strings.LastIndex(resourceName, ".")
 		var rk core_model.ResourceKey
-		if index != -1 {
-			rk = core_model.WithMesh(resourceName[index+1:], resourceName[:index])
+		if name, mesh, found := strings.CutLast(resourceName, "."); found {
+			rk = core_model.WithMesh(mesh, name)
 		} else {
 			rk = core_model.WithoutMesh(resourceName)
 		}
```

**File**: `pkg/kds/mux/zone_watch.go` (modified, +1/-1)
```diff
@@ -201,7 +201,7 @@ func (zw *ZoneWatch) cleanupStaleConnections(zone zoneTenant, zoneInsight *syste
 			ctx := multitenant.WithTenant(context.TODO(), zone.tenantID)
 			log := kuma_log.AddFieldsFromCtx(zw.log, ctx, zw.extensions)
 			log.Info("the same zone has connected but the previous connection wasn't closed, closing",
-				"zone", zone.zone, "streamType", stream, "previouslyConnected", connOpenTime, "currentlyConnected", activeStreamConnTime)
+				"zone", zone.zone, "streamType", stream, "previouslyConnected", connOpenTime, "currentlyConnected", *activeStreamConnTime)
 			zw.bus.Send(service.StreamCancelled{
 				Zone:     zone.zone,
 				TenantID: zone.tenantID,
```

**File**: `pkg/util/k8s/name_converter.go` (modified, +4/-5)
```diff
@@ -11,16 +11,15 @@ import (
 )
 
 func CoreNameToK8sName(coreName string) (string, string, error) {
-	idx := strings.LastIndex(coreName, ".")
-	if idx == -1 {
+	// namespace cannot contain "." therefore it's always the last part
+	name, namespace, found := strings.CutLast(coreName, ".")
+	if !found {
 		return "", "", errors.Errorf(`name %q must include namespace after the dot, ex. "name.namespace"`, coreName)
 	}
-	// namespace cannot contain "." therefore it's always the last part
-	namespace := coreName[idx+1:]
 	if namespace == "" {
 		return "", "", errors.New("namespace must be non-empty")
 	}
-	return coreName[:idx], namespace, nil
+	return name, namespace, nil
 }
 
 func K8sNamespacedNameToCoreName(name, namespace string) string {
```

---

### Incident Patch 8: `4d0f6aae` (2026-09-28)
**Commit Message**: fix(meshservice): reconcile generated selector (#18876)

Signed-off-by: Lukasz Dziedziak <[REDACTED_EMAIL]>

**File**: `pkg/core/resources/apis/meshservice/generate/generator.go` (modified, +4/-1)
```diff
@@ -196,8 +196,11 @@ func checkMeshServicesConsistency(
 	return conflicting, meshService
 }
 
+// servicesDiffer compares the selector too: a MeshService generated from a
+// kuma.io/service tag keeps its name under kuma.io/workload generation, so only
+// the selector shows it no longer matches its Dataplanes.
 func servicesDiffer(a, b *meshservice_api.MeshService) bool {
-	return !reflect.DeepEqual(a.Ports, b.Ports)
+	return !reflect.DeepEqual(a.Ports, b.Ports) || !reflect.DeepEqual(a.Selector, b.Selector)
 }
 
 func desiredLabels(mesh, name, zone string, propagated map[string]string) map[string]string {
```

**File**: `pkg/core/resources/apis/meshservice/generate/generator_test.go` (modified, +31/-0)
```diff
@@ -475,6 +475,37 @@ var _ = Describe("MeshService generator", func() {
 		}, "2s", "100ms").Should(Succeed())
 	})
 
+	// A MeshService generated from kuma.io/service inbound tags keeps its name when
+	// generation switches to kuma.io/workload, so only the selector tells it apart.
+	It("should rewrite the selector of a MeshService whose ports already match", func() {
+		stale := meshservice_api.NewMeshServiceResource()
+		stale.Spec.Ports = []meshservice_api.Port{{
+			Name:        pointer.To("80"),
+			Port:        80,
+			TargetPort:  pointer.To(intstr.FromInt(80)),
+			AppProtocol: core_meta.ProtocolTCP,
+		}}
+		Expect(resManager.Create(context.Background(), stale,
+			store.CreateByKey("backend", model.DefaultMesh),
+			store.CreateWithLabels(map[string]string{
+				mesh_proto.ManagedByLabel:      "meshservice-generator",
+				mesh_proto.ResourceOriginLabel: string(mesh_proto.ZoneResourceOrigin),
+				mesh_proto.ZoneTag:             "zone",
+			}),
+		)).To(Succeed())
+
+		Expect(createBackendDataplane(backendDataplane())).To(Succeed())
+
+		Eventually(func(g Gomega) {
+			ms := meshservice_api.NewMeshServiceResource()
+			g.Expect(resManager.Get(context.Background(), ms, store.GetByKey("backend", model.DefaultMesh))).To(Succeed())
+			g.Expect(ms.Spec.Selector.DataplaneLabels).ToNot(BeNil())
+			g.Expect(ms.Spec.Selector.DataplaneLabels.MatchLabels).To(HaveValue(Equal(map[string]string{
+				metadata.KumaWorkload: "backend",
+			})))
+		}, "2s", "100ms").Should(Succeed())
+	})
+
 	It("should emit metric", func() {
 		Eventually(func(g Gomega) {
 			g.Expect(test_metrics.FindMetric(metrics, "component_meshservice_generator")).ToNot(BeNil())
```

---

### Incident Patch 9: `1d618a5b` (2026-09-28)
**Commit Message**: fix(meshpassthrough): correct validator typo (#18879)

Signed-off-by: Lukasz Dziedziak <[REDACTED_EMAIL]>

**File**: `pkg/plugins/policies/meshpassthrough/api/v1alpha1/testdata/full-invalid.output.yaml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ violations:
 - field: spec.default.appendMatch[7].value
   message: provided DNS has incorrect value, partial wildcard is currently not supported
 - field: spec.default.appendMatch[9].value
-  message: value google.com is already defiend for this port and protocol
+  message: value google.com is already defined for this port and protocol
 - field: spec.default.appendMatch[10].port
   message: wildcard domains doesn't work for all ports and layer 7 protocol
 - field: spec.default.appendMatch[11].protocol
```

**File**: `pkg/plugins/policies/meshpassthrough/api/v1alpha1/validator.go` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ func validateDefault(conf Conf) validators.ValidationError {
 			}
 			if _, found := uniqueDomains[key]; found {
 				if _, found := uniqueDomains[key][match.Value]; found {
-					verr.AddViolationAt(validators.RootedAt("appendMatch").Index(i).Field("value"), fmt.Sprintf("value %s is already defiend for this port and protocol", match.Value))
+					verr.AddViolationAt(validators.RootedAt("appendMatch").Index(i).Field("value"), fmt.Sprintf("value %s is already defined for this port and protocol", match.Value))
 				} else {
 					uniqueDomains[key][match.Value] = true
 				}
```

---

### Incident Patch 10: `c122f5f7` (2026-09-28)
**Commit Message**: fix(kds): keep 2.14 zones serving MeshServices behind a 3.0 global (#18870)

Signed-off-by: Bart Smykla <[REDACTED_EMAIL]>

**File**: `UPGRADE.md` (modified, +18/-4)
```diff
@@ -1102,14 +1102,28 @@ already behaviourally identical, so no other changes are required.
 
 ### `meshServices` removed from the `Mesh` schema
 
-The `meshServices` field (and its `mode` enum) has been removed from the
-`Mesh` resource spec. Unified resource naming is now unconditional,
+The `meshServices` field (and its `mode` enum) no longer has any effect on
+the `Mesh` resource. Unified resource naming is now unconditional,
 regardless of what the mesh's former `meshServices.mode` was set to.
 
+The field remains in the schema as deprecated so that stored values survive
+the upgrade and keep syncing to zones over KDS: zones before 3.0 read a
+missing field as `Disabled`, which makes them delete every generated
+`MeshService`, skip mesh-scoped zone proxy listeners, and stop serving
+`MeshService` outbounds and DNS. Zones on 3.0 ignore the field, and writes
+setting it to any mode other than `Exclusive` are rejected, because that
+mode would silently behave as `Exclusive`.
+
 **Action required**
 
-None. A `Mesh` spec that still sets `meshServices` continues to apply
-successfully; the field is silently ignored by the control plane.
+Set `meshServices.mode: Exclusive` on every mesh before upgrading the
+global control plane, including meshes that never set the field: a 2.x
+zone reads a missing field as `Disabled`. The 3.0 global then keeps syncing
+the stored mode, and 2.x zones keep serving `MeshServices` until they are
+upgraded. A mesh that still carries another mode when the global is
+upgraded is rejected by 3.0 zones over KDS until it is set to `Exclusive`.
+A write that carries the field with `Exclusive` still applies and returns a
+deprecation warning; drop the field from your manifests.
 
 ### `routing.zoneEgress` removed from the `Mesh` schema
 
```

**File**: `api/mesh/v1alpha1/mesh.pb.go` (modified, +143/-14)
```diff
@@ -22,9 +22,72 @@ const (
 	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
 )
 
+type Mesh_MeshServices_Mode int32
+
+const (
+	// MeshServices aren't generated
+	Mesh_MeshServices_Disabled Mesh_MeshServices_Mode = 0
+	// MeshServices are generated and used for configuration
+	Mesh_MeshServices_Everywhere Mesh_MeshServices_Mode = 1
+	// MeshServices are generated but only used for configuration where
+	// configured via reachableBackends
+	Mesh_MeshServices_ReachableBackends Mesh_MeshServices_Mode = 2
+	// MeshServices are generated, used for configuration and kuma.io/services
+	// are not used
+	Mesh_MeshServices_Exclusive Mesh_MeshServices_Mode = 3
+)
+
+// Enum value maps for Mesh_MeshServices_Mode.
+var (
+	Mesh_MeshServices_Mode_name = map[int32]string{
+		0: "Disabled",
+		1: "Everywhere",
+		2: "ReachableBackends",
+		3: "Exclusive",
+	}
+	Mesh_MeshServices_Mode_value = map[string]int32{
+		"Disabled":          0,
+		"Everywhere":        1,
+		"ReachableBackends": 2,
+		"Exclusive":         3,
+	}
+)
+
+func (x Mesh_MeshServices_Mode) Enum() *Mesh_MeshServices_Mode {
+	p := new(Mesh_MeshServices_Mode)
+	*p = x
+	return p
+}
+
+func (x Mesh_MeshServices_Mode) String() string {
+	return protoimpl.X.EnumStringOf(x.Descriptor(), protoreflect.EnumNumber(x))
+}
+
+func (Mesh_MeshServices_Mode) Descriptor() protoreflect.EnumDescriptor {
+	return file_api_mesh_v1alpha1_mesh_proto_enumTypes[0].Descriptor()
+}
+
+func (Mesh_MeshServices_Mode) Type() protoreflect.EnumType {
+	return &file_api_mesh_v1alpha1_mesh_proto_enumTypes[0]
+}
+
+func (x Mesh_MeshServices_Mode) Number() protoreflect.EnumNumber {
+	return protoreflect.EnumNumber(x)
+}
+
+// Deprecated: Use Mesh_MeshServices_Mode.Descriptor instead.
+func (Mesh_MeshServices_Mode) EnumDescriptor() ([]byte, []int) {
+	return file_api_mesh_v1alpha1_mesh_proto_rawDescGZIP(), []int{0, 0, 0}
+}
+
 // Mesh defines configuration of a single mesh.
 type Mesh struct {
-	state         protoimpl.MessageState `protogen:"open.v1"`
+	state protoimpl.MessageState `protogen:"open.v1"`
+	// Deprecated: ignored since 3.0, where every mesh behaves as Exclusive.
+	// Kept only so pre-3.0 zones keep receiving the mode over KDS.
+	//
+	// Deprecated: Marked as deprecated in api/mesh/v1alpha1/mesh.proto.
+	MeshServices  *Mesh_MeshServices `protobuf:"bytes,9,opt,name=meshServices,proto3" json:"meshServices,omitempty"`
 	unknownFields protoimpl.UnknownFields
 	sizeCache     protoimpl.SizeCache
 }
@@ -59,15 +122,75 @@ func (*Mesh) Descriptor() ([]byte, []int) {
 	return file_api_mesh_v1alpha1_mesh_proto_rawDescGZIP(), []int{0}
 }
 
+// Deprecated: Marked as deprecated in api/mesh/v1alpha1/mesh.proto.
+func (x *Mesh) GetMeshServices() *Mesh_MeshServices {
+	if x != nil {
+		return x.MeshServices
+	}
+	return nil
+}
+
+type Mesh_MeshServices struct {
+	state         protoimpl.MessageState `protogen:"open.v1"`
+	Mode          Mesh_MeshServices_Mode `protobuf:"varint,1,opt,name=mode,proto3,enum=kuma.mesh.v1alpha1.Mesh_MeshServices_Mode" json:"mode,omitempty"`
+	unknownFields protoimpl.UnknownFields
+	sizeCache     protoimpl.SizeCache
+}
+
+func (x *Mesh_MeshServices) Reset() {
+	*x = Mesh_MeshServices{}
+	mi := &file_api_mesh_v1alpha1_mesh_proto_msgTypes[1]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
+}
+
+func (x *Mesh_MeshServices) String() string {
+	return protoimpl.X.MessageStringOf(x)
+}
+
+func (*Mesh_MeshServices) ProtoMessage() {}
+
+func (x *Mesh_MeshServices) ProtoReflect() protoreflect.Message {
+	mi := &file_api_mesh_v1alpha1_mesh_proto_msgTypes[1]
+	if x != nil {
+		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+		if ms.LoadMessageInfo() == nil {
+			ms.StoreMessageInfo(mi)
+		}
+		return ms
+	}
+	return mi.MessageOf(x)
+}
+
+// Deprecated: Use Mesh_MeshServices.ProtoReflect.Descriptor instead.
+func (*Mesh_MeshServices) Descriptor() ([]byte, []int) {
+	return file_api_mesh_v1alpha1_mesh_proto_rawDescGZIP(), []int{0, 0}
+}
+
+func (x *Mesh_MeshServices) GetMode() Mesh_MeshServices_Mode {
+	if x != nil {
+		return x.Mode
+	}
+	return Mesh_MeshServices_Disabled
+}
+
 var File_api_mesh_v1alpha1_mesh_proto protoreflect.FileDescriptor
 
 const file_api_mesh_v1alpha1_mesh_proto_rawDesc = "" +
 	"\n" +
-	"\x1capi/mesh/v1alpha1/mesh.proto\x12\x12kuma.mesh.v1alpha1\x1a\x16api/mesh/options.proto\"\xf0\x01\n" +
-	"\x04Mesh:R\xaa\x8c\x89\xa6\x01L\n" +
+	"\x1capi/mesh/v1alpha1/mesh.proto\x12\x12kuma.mesh.v1alpha1\x1a\x16api/mesh/options.proto\"\xd6\x03\n" +
+	"\x04Mesh\x12M\n" +
+	"\fmeshServices\x18\t \x01(\v2%.kuma.mesh.v1alpha1.Mesh.MeshServicesB\x02\x18\x01R\fmeshServices\x1a\x9a\x01\n" +
+	"\fMeshServices\x12>\n" +
+	"\x04mode\x18\x01 \x01(\x0e2*.kuma.mesh.v1alpha1.Mesh.MeshServices.ModeR\x04mode\"J\n" +
+	"\x04Mode\x12\f\n" +
+	"\bDisabled\x10\x00\x12\x0e\n" +
+	"\n" +
+	"Everywhere\x10\x01\x12\x15\n" +
+	"\x11ReachableBackends\x10\x02\x12\r\n" +
+	"\tExclusive\x10\x03:R\xaa\x8c\x89\xa6\x01L\n" +
 	"\fMeshResource\x12\x04Me
```

**File**: `api/mesh/v1alpha1/mesh.proto` (modified, +20/-1)
```diff
@@ -42,5 +42,24 @@ message Mesh {
   reserved 8;
   reserved "skipCreatingInitialPolicies";
 
-  reserved 9; // formerly meshServices
+  // Deprecated: ignored since 3.0, where every mesh behaves as Exclusive.
+  // Kept only so pre-3.0 zones keep receiving the mode over KDS.
+  MeshServices meshServices = 9 [deprecated = true];
+
+  message MeshServices {
+    Mode mode = 1;
+
+    enum Mode {
+      // MeshServices aren't generated
+      Disabled = 0;
+      // MeshServices are generated and used for configuration
+      Everywhere = 1;
+      // MeshServices are generated but only used for configuration where
+      // configured via reachableBackends
+      ReachableBackends = 2;
+      // MeshServices are generated, used for configuration and kuma.io/services
+      // are not used
+      Exclusive = 3;
+    }
+  }
 }
```

**File**: `api/mesh/v1alpha1/mesh/rest.yaml` (modified, +15/-0)
```diff
@@ -66,6 +66,21 @@ components:
           additionalProperties:
             type: string
           type: object
+        meshServices:
+          description: |-
+            Deprecated: ignored since 3.0, where every mesh behaves as Exclusive.
+            Kept only so pre-3.0 zones keep receiving the mode over KDS.
+
+            Deprecated: Marked as deprecated in api/mesh/v1alpha1/mesh.proto.
+          properties:
+            mode:
+              enum:
+              - Disabled
+              - Everywhere
+              - ReachableBackends
+              - Exclusive
+              type: string
+          type: object
         modificationTime:
           description: Time at which the resource was updated
           format: date-time
```

**File**: `api/mesh/v1alpha1/meshoverview/schema.yaml` (modified, +16/-1)
```diff
@@ -4,7 +4,22 @@ components:
       description: MeshOverview defines the projected state of a Mesh.
       properties:
         mesh:
-          properties: {}
+          properties:
+            meshServices:
+              description: |-
+                Deprecated: ignored since 3.0, where every mesh behaves as Exclusive.
+                Kept only so pre-3.0 zones keep receiving the mode over KDS.
+
+                Deprecated: Marked as deprecated in api/mesh/v1alpha1/mesh.proto.
+              properties:
+                mode:
+                  enum:
+                  - Disabled
+                  - Everywhere
+                  - ReachableBackends
+                  - Exclusive
+                  type: string
+              type: object
           type: object
         meshInsight:
           properties:
```

**File**: `docs/generated/openapi.yaml` (modified, +38/-1)
```diff
@@ -7474,6 +7474,24 @@ components:
           additionalProperties:
             type: string
           type: object
+        meshServices:
+          description: >-
+            Deprecated: ignored since 3.0, where every mesh behaves as
+            Exclusive.
+
+            Kept only so pre-3.0 zones keep receiving the mode over KDS.
+
+
+            Deprecated: Marked as deprecated in api/mesh/v1alpha1/mesh.proto.
+          properties:
+            mode:
+              enum:
+                - Disabled
+                - Everywhere
+                - ReachableBackends
+                - Exclusive
+              type: string
+          type: object
         modificationTime:
           description: Time at which the resource was updated
           format: date-time
@@ -16214,7 +16232,26 @@ components:
       description: MeshOverview defines the projected state of a Mesh.
       properties:
         mesh:
-          properties: {}
+          properties:
+            meshServices:
+              description: >-
+                Deprecated: ignored since 3.0, where every mesh behaves as
+                Exclusive.
+
+                Kept only so pre-3.0 zones keep receiving the mode over KDS.
+
+
+                Deprecated: Marked as deprecated in
+                api/mesh/v1alpha1/mesh.proto.
+              properties:
+                mode:
+                  enum:
+                    - Disabled
+                    - Everywhere
+                    - ReachableBackends
+                    - Exclusive
+                  type: string
+              type: object
           type: object
         meshInsight:
           properties:
```

**File**: `docs/generated/raw/protos/Mesh.json` (modified, +35/-0)
```diff
@@ -3,10 +3,45 @@
     "$ref": "#/definitions/Mesh",
     "definitions": {
         "Mesh": {
+            "properties": {
+                "meshServices": {
+                    "$ref": "#/definitions/kuma.mesh.v1alpha1.Mesh.MeshServices",
+                    "additionalProperties": true,
+                    "description": "Deprecated: ignored since 3.0, where every mesh behaves as Exclusive. Kept only so pre-3.0 zones keep receiving the mode over KDS."
+                }
+            },
             "additionalProperties": true,
             "type": "object",
             "title": "Mesh",
             "description": "Mesh defines configuration of a single mesh."
+        },
+        "kuma.mesh.v1alpha1.Mesh.MeshServices": {
+            "properties": {
+                "mode": {
+                    "enum": [
+                        "Disabled",
+                        0,
+                        "Everywhere",
+                        1,
+                        "ReachableBackends",
+                        2,
+                        "Exclusive",
+                        3
+                    ],
+                    "oneOf": [
+                        {
+                            "type": "string"
+                        },
+                        {
+                            "type": "integer"
+                        }
+                    ],
+                    "title": "Mode"
+                }
+            },
+            "additionalProperties": true,
+            "type": "object",
+            "title": "Mesh Services"
         }
     }
 }
\ No newline at end of file
```

**File**: `docs/generated/raw/protos/MeshOverview.json` (modified, +35/-0)
```diff
@@ -19,11 +19,46 @@
             "description": "MeshOverview defines the projected state of a Mesh."
         },
         "kuma.mesh.v1alpha1.Mesh": {
+            "properties": {
+                "meshServices": {
+                    "$ref": "#/definitions/kuma.mesh.v1alpha1.Mesh.MeshServices",
+                    "additionalProperties": true,
+                    "description": "Deprecated: ignored since 3.0, where every mesh behaves as Exclusive. Kept only so pre-3.0 zones keep receiving the mode over KDS."
+                }
+            },
             "additionalProperties": true,
             "type": "object",
             "title": "Mesh",
             "description": "Mesh defines configuration of a single mesh."
         },
+        "kuma.mesh.v1alpha1.Mesh.MeshServices": {
+            "properties": {
+                "mode": {
+                    "enum": [
+                        "Disabled",
+                        0,
+                        "Everywhere",
+                        1,
+                        "ReachableBackends",
+                        2,
+                        "Exclusive",
+                        3
+                    ],
+                    "oneOf": [
+                        {
+                            "type": "string"
+                        },
+                        {
+                            "type": "integer"
+                        }
+                    ],
+                    "title": "Mode"
+                }
+            },
+            "additionalProperties": true,
+            "type": "object",
+            "title": "Mesh Services"
+        },
         "kuma.mesh.v1alpha1.MeshInsight": {
             "properties": {
                 "dataplanes": {
```

---

### Incident Patch 11: `9415103f` (2026-09-28)
**Commit Message**: chore(deps): bump kumahq/kuma-gui to 794757c085a62362cfcdb2c8f8c5ce5b86bc1228 (#18897)

Signed-off-by: GitHub <[REDACTED_EMAIL]>
Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `app/kuma-ui/pkg/resources/data/assets/App-CStTUjmd.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as B,r as m,o as k,c as X,a as A,b as u,w as d,e as l,t as w,n as oe,_ as O,u as ae,f as re,g as ne,h as ie,i as le,j as f,k as v,l as T,m as C,p as se,q as ce,s as q,v as de,x as ue,y as S,z as pe}from"./index-DVZ5nSK2.js";const fe=""+new URL("product-logo-CDoXkXpC.png",import.meta.url).href,ve={class:"app-navigator"},ge=B({__name:"AppNavigator",props:{active:{type:Boolean,default:!1},label:{default:""},to:{default:()=>({})}},setup(e){const o=e;return(r,a)=>{const i=m("XAction");return k(),X("li",ve,[A(r.$slots,"default",{},()=>[u(i,{class:oe({"is-active":o.active}),to:o.to},{default:d(()=>[l(w(o.label),1)]),_:1},8,["class","to"])],!0)])}}}),L=O(ge,[["__scopeId","data-v-b1ed9f4d"]]);var H=window.document,N=window.Math,z=window.HTMLElement,D=window.XMLHttpRequest,U=function(e,o){for(var r=0,a=e.length;r<a;r++)o(e[r])},K=function(e){return function(o,r,a){var i=e.createElement(o);if(r!=null)for(var n in r){var t=r[n];t!=null&&(i[n]!=null?i[n]=t:i.setAttribute(n,t))}return a!=null&&U(a,function(c){i.appendChild(typeof c=="string"?e.createTextNode(c):c)}),i}},j=K(H),he=function(e){var o;return function(){o||(o=1,e.apply(this,arguments))}},V=function(e,o){return{}.hasOwnProperty.call(e,o)},I=function(e){return(""+e).toLowerCase()},me="github-buttons",be="2.33.0",we="https://"+("unpkg.com/"+me+"@"+be+"/dist")+"/buttons.html",_="github.com",ke="https://api."+_,ee=D&&"prototype"in D&&"withCredentials"in D.prototype,_e=ee&&z&&"attachShadow"in z.prototype&&!("prototype"in z.prototype.attachShadow),y=function(e,o,r){e.addEventListener?e.addEventListener(o,r,!1):e.attachEvent("on"+o,r)},P=function(e,o,r){e.removeEventListener?e.removeEventListener(o,r,!1):e.detachEvent("on"+o,r)},ye=function(e,o,r){var a=function(){return P(e,o,a),r.apply(this,arguments)};y(e,o,a)},xe=function(e,o,r){if(e.readyState!=null){var a="readystatechange",i=function(){if(o.test(e.readyState))return P(e,a,i),r.apply(this,arguments)};y(e,a,i)}},Ae=function(e){var o={href:e.href,title:e.title,"aria-label":e.getAttribute("aria-label")};return U(["icon","color-scheme","text","size","show-count"],function(r){var a="data-"+r;o[a]=e.getAttribute(a)}),o["data-text"]==null&&(o["data-text"]=e.textContent||e.innerText),o},Me="body{margin:0}a{text-decoration:none;outline:0}.widget{display:inline-block;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:0;line-height:0;white-space:nowrap}.btn,.social-count{position:relative;display:inline-block;display:inline-flex;height:14px;padding:2px 5px;font-size:11px;font-weight:600;line-height:14px;vertical-align:bottom;cursor:pointer;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;background-repeat:repeat-x;background-position:-1px -1px;background-size:110% 110%;border:1px solid}.btn{border-radius:.25em}.btn:not(:last-child){border-radius:.25em 0 0 .25em}.social-count{border-left:0;border-radius:0 .25em .25em 0}.widget-lg .btn,.widget-lg .social-count{height:16px;padding:5px 10px;font-size:12px;line-height:16px}.octicon{display:inline-block;vertical-align:text-top;fill:currentColor;overflow:visible}",Ce=`.btn:focus-visible,.social-count:focus-visible{outline:2px solid #0969da;outline-offset:-2px}.btn{color:#25292e;background-color:#ebf0f4;border-color:#d1d9e0;background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg'%3e%3clinearGradient id='o' x2='0' y2='1'%3e%3cstop stop-color='%23f6f8fa'/%3e%3cstop offset='90%25' stop-color='%23ebf0f4'/%3e%3c/linearGradient%3e%3crect width='100%25' height='100%25' fill='url(%23o)'/%3e%3c/svg%3e");background-image:-moz-linear-gradient(top, #f6f8fa, #ebf0f4 90%);background-image:linear-gradient(180deg, #f6f8fa, #ebf0f4 90%);filter:progid:DXImageTransform.Microsoft.Gradient(startColorstr='#FFF6F8FA', endColorstr='#FFEAEFF3')}:root .btn{filter:none}.btn:hover,.btn:focus{background-color:#e5eaee;background-position:0 -0.5em;border-color:#d1d9e0;background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg'%3e%3clinearGradient id='o' x2='0' y2='1'%3e%3cstop stop-color='%23eff2f5'/%3e%3cstop offset='90%25' stop-color='%23e5eaee'/%3e%3c/linearGradient%3e%3crect width='100%25' height='100%25' fill='url(%23o)'/%3e%3c/svg%3e");background-image:-moz-linear-gradient(top, #eff2f5, #e5eaee 90%);background-image:linear-gradient(180deg, #eff2f5, #e5eaee 90%);filter:progid:DXImageTransform.Microsoft.Gradient(startColorstr='#FFEFF2F5', endColorstr='#FFE4E9ED')}:root .btn:hover,:root .btn:focus{filter:none}.btn:active{background-color:#e6eaef;border-color:#d1d9e0;background-image:none;filter:none}.social-count{color:#25292e;background-color:#fff;border-color:#d1d9e0}.social-count:hover,.social-count:focus{color:#0969da}.octicon-heart{color:#bf3989}`,Ee=".btn:focus-visible,.social-count:focus-visible{outline:2px solid #0349b4;outline-offset:-2px}.btn{color:#25292e;background-color:#e0e6eb;border-color:#454c54;background-image:none;filter:non
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConfigurationDetailView-BJ9pad4Q.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{d as _,o as f,l as C,w as t,b as n,e as x,k as h,v as b,j as w,r as o}from"./index-DVZ5nSK2.js";const y=_({__name:"ConfigurationDetailView",setup(R){return(V,r)=>{const i=o("RouteTitle"),s=o("XCodeBlock"),d=o("DataLoader"),l=o("XCard"),u=o("AppView"),p=o("RouteView");return f(),C(p,{name:"configuration-view",params:{codeSearch:"",codeFilter:!1,codeRegExp:!1}},{default:t(({route:e,t:c,uri:m})=>[n(u,{breadcrumbs:[{to:{name:"configuration-view"},text:c("configuration.routes.item.breadcrumbs")}]},{title:t(()=>[w("h1",null,[n(i,{title:c("configuration.routes.item.title")},null,8,["title"])])]),default:t(()=>[r[0]||(r[0]=x()),n(l,null,{default:t(()=>[n(d,{src:m(h(b),"/config",{})},{default:t(({data:[g]})=>[n(s,{"data-testid":"code-block-configuration",language:"json",code:JSON.stringify(g,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},null,8,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1024)]),_:2},1032,["breadcrumbs"])]),_:1})}}});export{y as default};
+import{d as _,o as f,l as C,w as t,b as n,e as x,k as h,v as b,j as w,r as o}from"./index-CbPVfXiU.js";const y=_({__name:"ConfigurationDetailView",setup(R){return(V,r)=>{const i=o("RouteTitle"),s=o("XCodeBlock"),d=o("DataLoader"),l=o("XCard"),u=o("AppView"),p=o("RouteView");return f(),C(p,{name:"configuration-view",params:{codeSearch:"",codeFilter:!1,codeRegExp:!1}},{default:t(({route:e,t:c,uri:m})=>[n(u,{breadcrumbs:[{to:{name:"configuration-view"},text:c("configuration.routes.item.breadcrumbs")}]},{title:t(()=>[w("h1",null,[n(i,{title:c("configuration.routes.item.title")},null,8,["title"])])]),default:t(()=>[r[0]||(r[0]=x()),n(l,null,{default:t(()=>[n(d,{src:m(h(b),"/config",{})},{default:t(({data:[g]})=>[n(s,{"data-testid":"code-block-configuration",language:"json",code:JSON.stringify(g,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},null,8,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1024)]),_:2},1032,["breadcrumbs"])]),_:1})}}});export{y as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryClustersView-CSIzqnOv.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as T,r as o,o as i,l,w as t,b as s,e as m,k as V,R as E,c as F,I as N,H as v}from"./index-DVZ5nSK2.js";const D=T({__name:"ConnectionInboundSummaryClustersView",props:{routeName:{},data:{},overview:{}},setup(u){const n=u;return(B,r)=>{const _=o("RouteTitle"),f=o("XAction"),g=o("XCodeBlock"),y=o("DataCollection"),d=o("DataLoader"),C=o("AppView"),x=o("RouteView");return i(),l(x,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:n.routeName},{default:t(({route:e,uri:h})=>[s(_,{render:!1,title:"Clusters"}),r[1]||(r[1]=m()),s(C,null,{default:t(()=>[s(d,{data:[n.overview]},{default:t(({data:[R]})=>[s(d,{src:h(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:t(({data:[k],refresh:w})=>[(i(!0),F(N,null,v(["stat_prefix"in n.data?n.data.stat_prefix:("clusterName"in n.data?n.data.clusterName:e.params.connection).replace("_",":")],c=>(i(),l(y,{key:typeof c,items:k.split(`
+import{d as T,r as o,o as i,l,w as t,b as s,e as m,k as V,Q as E,c as F,I as N,J as v}from"./index-CbPVfXiU.js";const D=T({__name:"ConnectionInboundSummaryClustersView",props:{routeName:{},data:{},overview:{}},setup(u){const n=u;return(B,r)=>{const _=o("RouteTitle"),f=o("XAction"),g=o("XCodeBlock"),y=o("DataCollection"),d=o("DataLoader"),C=o("AppView"),x=o("RouteView");return i(),l(x,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:n.routeName},{default:t(({route:e,uri:h})=>[s(_,{render:!1,title:"Clusters"}),r[1]||(r[1]=m()),s(C,null,{default:t(()=>[s(d,{data:[n.overview]},{default:t(({data:[R]})=>[s(d,{src:h(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:t(({data:[k],refresh:w})=>[(i(!0),F(N,null,v(["stat_prefix"in n.data?n.data.stat_prefix:("clusterName"in n.data?n.data.clusterName:e.params.connection).replace("_",":")],c=>(i(),l(y,{key:typeof c,items:k.split(`
 `),predicate:p=>p.startsWith(`${c}`)},{default:t(({items:p})=>[s(g,{language:"json",code:p.map(a=>a.replace(`${c}::`,"")).join(`
 `),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:a=>e.update({codeSearch:a}),onFilterModeChange:a=>e.update({codeFilter:a}),onRegExpModeChange:a=>e.update({codeRegExp:a})},{"primary-actions":t(()=>[s(f,{action:"refresh",appearance:"primary",onClick:w},{default:t(()=>[...r[0]||(r[0]=[m(`
                     Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryStatsView-DvVfychd.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as R,r as o,o as $,l as C,w as r,b as n,e as p,k as A,R as w,a4 as k}from"./index-DVZ5nSK2.js";const V=R({__name:"ConnectionInboundSummaryStatsView",props:{data:{},networking:{},routeName:{},overview:{}},setup(i){const a=i,e=k(()=>({...a.data,proxyResourceName:"stat_prefix"in a.data?a.data.stat_prefix:"",listenerAddress:"listenerAddress"in a.data?a.data.listenerAddress:"",clusterName:"clusterName"in a.data?a.data.clusterName:"",port:"port"in a.data?a.data.port.toString():"",servicePort:"servicePort"in a.data?a.data.servicePort:"",name:"name"in a.data?a.data.name:""}));return(S,l)=>{const u=o("RouteTitle"),m=o("XAction"),v=o("XCodeBlock"),g=o("DataCollection"),d=o("DataLoader"),x=o("AppView"),_=o("RouteView");return $(),C(_,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:a.routeName},{default:r(({route:t,uri:y})=>[n(u,{render:!1,title:"Stats"}),l[1]||(l[1]=p()),n(x,null,{default:r(()=>[n(d,{data:[a.overview]},{default:r(({data:[h]})=>[n(d,{src:y(A(w),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[t.params.proxyType]??"dataplane",name:h.id,mesh:t.params.mesh||"*",socketAddress:a.networking.inboundAddress})},{default:r(({data:[f],refresh:N})=>[n(g,{items:f.raw.split(`
+import{d as R,r as o,o as $,l as C,w as r,b as n,e as p,k as A,Q as w,a5 as k}from"./index-CbPVfXiU.js";const V=R({__name:"ConnectionInboundSummaryStatsView",props:{data:{},networking:{},routeName:{},overview:{}},setup(i){const a=i,e=k(()=>({...a.data,proxyResourceName:"stat_prefix"in a.data?a.data.stat_prefix:"",listenerAddress:"listenerAddress"in a.data?a.data.listenerAddress:"",clusterName:"clusterName"in a.data?a.data.clusterName:"",port:"port"in a.data?a.data.port.toString():"",servicePort:"servicePort"in a.data?a.data.servicePort:"",name:"name"in a.data?a.data.name:""}));return(S,l)=>{const u=o("RouteTitle"),m=o("XAction"),v=o("XCodeBlock"),g=o("DataCollection"),d=o("DataLoader"),x=o("AppView"),_=o("RouteView");return $(),C(_,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:a.routeName},{default:r(({route:t,uri:y})=>[n(u,{render:!1,title:"Stats"}),l[1]||(l[1]=p()),n(x,null,{default:r(()=>[n(d,{data:[a.overview]},{default:r(({data:[h]})=>[n(d,{src:y(A(w),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[t.params.proxyType]??"dataplane",name:h.id,mesh:t.params.mesh||"*",socketAddress:a.networking.inboundAddress})},{default:r(({data:[f],refresh:N})=>[n(g,{items:f.raw.split(`
 `),predicate:c=>[`listener.${e.value.listenerAddress?.length>0?e.value.listenerAddress:t.params.connection}`,`cluster.${e.value.name}.`,`cluster.${e.value.clusterName}.`,`http.${e.value.name}.`,`http.${e.value.clusterName}.`,`tcp.${e.value.name}.`,`cluster.${e.value.proxyResourceName}.`,`listener.${e.value.proxyResourceName}`,`cluster.${e.value.proxyResourceName}.`,`http.${e.value.proxyResourceName}.`,`http.${e.value.proxyResourceName}.`,`tcp.${e.value.proxyResourceName}.`].some(s=>c.startsWith(s))&&(!c.includes(".rds.")||c.includes(`_${e.value.port}`)||c.includes(`${e.value.servicePort}`))},{default:r(({items:c})=>[n(v,{language:"json",code:c.map(s=>s.replace(`${e.value.listenerAddress?.length>0?e.value.listenerAddress:e.value.proxyResourceName.length?e.value.proxyResourceName:t.params.connection}.`,"").replace(e.value.name.length?`${e.value.name}.`:"","").replace(e.value.clusterName.length?`${e.value.clusterName}.`:"","")).join(`
 `),"is-searchable":"",query:t.params.codeSearch,"is-filter-mode":t.params.codeFilter,"is-reg-exp-mode":t.params.codeRegExp,onQueryChange:s=>t.update({codeSearch:s}),onFilterModeChange:s=>t.update({codeFilter:s}),onRegExpModeChange:s=>t.update({codeRegExp:s})},{"primary-actions":r(()=>[n(m,{action:"refresh",appearance:"primary",onClick:N},{default:r(()=>[...l[0]||(l[0]=[p(`
                   Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryView-B9wzS2Yi.js` (renamed, +1/-1)
```diff
@@ -1,2 +1,2 @@
-import{d as C,r as n,o as l,l as m,w as t,b as s,e as c,L as X,H as x,t as d,x as b,j as B,m as N}from"./index-DVZ5nSK2.js";const T=C({__name:"ConnectionInboundSummaryView",props:{data:{},overview:{},networking:{},routeName:{}},setup(u){const r=u;return($,o)=>{const _=n("XBadge"),w=n("XLayout"),v=n("XAction"),f=n("XTabs"),y=n("RouterView"),g=n("AppView"),V=n("DataCollection"),k=n("RouteView");return l(),m(k,{name:r.routeName,params:{inactive:Boolean,proxyType:"",connection:""}},{default:t(({route:a,t:p})=>[s(V,{items:r.data,predicate:r.networking.type==="gateway"?e=>!0:a.params.proxyType===""?e=>`${e.name}`===a.params.connection:e=>`${e.socketAddress.replace(":","_")}`===a.params.connection,find:!0},{default:t(({items:e})=>[s(g,null,{title:t(()=>[s(w,{variant:"y-stack",size:"small"},{default:t(()=>[B("h2",null,`
+import{d as C,r as n,o as l,l as m,w as t,b as s,e as c,K as X,J as x,t as d,x as b,j as B,m as N}from"./index-CbPVfXiU.js";const T=C({__name:"ConnectionInboundSummaryView",props:{data:{},overview:{},networking:{},routeName:{}},setup(u){const r=u;return($,o)=>{const _=n("XBadge"),w=n("XLayout"),v=n("XAction"),f=n("XTabs"),y=n("RouterView"),g=n("AppView"),V=n("DataCollection"),k=n("RouteView");return l(),m(k,{name:r.routeName,params:{inactive:Boolean,proxyType:"",connection:""}},{default:t(({route:a,t:p})=>[s(V,{items:r.data,predicate:r.networking.type==="gateway"?e=>!0:a.params.proxyType===""?e=>`${e.name}`===a.params.connection:e=>`${e.socketAddress.replace(":","_")}`===a.params.connection,find:!0},{default:t(({items:e})=>[s(g,null,{title:t(()=>[s(w,{variant:"y-stack",size:"small"},{default:t(()=>[B("h2",null,`
               Inbound `+d(a.params.connection.replace("localhost","").replace("_",":")),1),o[0]||(o[0]=c()),e[0]?.state?(l(),m(_,{key:0,appearance:p(`common.status.appearance.${e[0].state}`,void 0,{defaultMessage:"neutral"})},{default:t(()=>[c(d(p(`http.api.value.${e[0].state}`)),1)]),_:2},1032,["appearance"])):N("",!0)]),_:2},1024)]),default:t(()=>[o[1]||(o[1]=c()),s(f,{selected:a.child()?.name},X({_:2},[x(a.children,({name:i})=>({name:`${i}-tab`,fn:t(()=>[s(v,{to:{name:i,query:{inactive:a.params.inactive}}},{default:t(()=>[c(d(p(`connections.routes.item.navigation.${i.split("-")[5]}`)),1)]),_:2},1032,["to"])])}))]),1032,["selected"]),o[2]||(o[2]=c()),s(y,null,{default:t(i=>[(l(),m(b(i.Component),{data:e[0],overview:r.overview,networking:r.networking},null,8,["data","overview","networking"]))]),_:2},1024)]),_:2},1024)]),_:2},1032,["items","predicate"])]),_:1},8,["name"])}}});export{T as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionInboundSummaryXdsConfigView-DrViOdi5.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{d as C,r as o,o as R,l as w,w as a,b as n,e as d,k,R as T,t as V}from"./index-DVZ5nSK2.js";const S=C({__name:"ConnectionInboundSummaryXdsConfigView",props:{data:{},routeName:{},overview:{}},setup(p){const t=p;return(b,r)=>{const m=o("RouteTitle"),l=o("XAction"),u=o("XCodeBlock"),i=o("DataLoader"),_=o("AppView"),g=o("RouteView");return R(),w(g,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:t.routeName},{default:a(({t:c,route:e,uri:f})=>[n(m,{render:!1,title:c("connections.routes.item.navigation.xds")},null,8,["title"]),r[0]||(r[0]=d()),n(_,null,{default:a(()=>[n(i,{data:[t.overview]},{default:a(({data:[x]})=>[n(i,{src:f(k(T),"/connections/xds/for/:proxyType/:name/:mesh/inbound/:inbound",{mesh:e.params.mesh||"*",name:x.id,inbound:"stat_prefix"in t.data?t.data.stat_prefix:`${t.data.port}`,proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane"})},{default:a(({data:[y],refresh:h})=>[n(u,{language:"json",code:JSON.stringify(y,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:s=>e.update({codeSearch:s}),onFilterModeChange:s=>e.update({codeFilter:s}),onRegExpModeChange:s=>e.update({codeRegExp:s})},{"primary-actions":a(()=>[n(l,{action:"refresh",appearance:"primary",onClick:h},{default:a(()=>[d(V(c("common.refresh")),1)]),_:2},1032,["onClick"])]),_:2},1032,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1032,["data"])]),_:2},1024)]),_:1},8,["name"])}}});export{S as default};
+import{d as C,r as o,o as w,l as R,w as a,b as n,e as d,k,Q as T,t as V}from"./index-CbPVfXiU.js";const S=C({__name:"ConnectionInboundSummaryXdsConfigView",props:{data:{},routeName:{},overview:{}},setup(p){const t=p;return(b,r)=>{const m=o("RouteTitle"),l=o("XAction"),u=o("XCodeBlock"),i=o("DataLoader"),_=o("AppView"),g=o("RouteView");return w(),R(g,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:t.routeName},{default:a(({t:c,route:e,uri:f})=>[n(m,{render:!1,title:c("connections.routes.item.navigation.xds")},null,8,["title"]),r[0]||(r[0]=d()),n(_,null,{default:a(()=>[n(i,{data:[t.overview]},{default:a(({data:[x]})=>[n(i,{src:f(k(T),"/connections/xds/for/:proxyType/:name/:mesh/inbound/:inbound",{mesh:e.params.mesh||"*",name:x.id,inbound:"stat_prefix"in t.data?t.data.stat_prefix:`${t.data.port}`,proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane"})},{default:a(({data:[y],refresh:h})=>[n(u,{language:"json",code:JSON.stringify(y,null,2),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:s=>e.update({codeSearch:s}),onFilterModeChange:s=>e.update({codeFilter:s}),onRegExpModeChange:s=>e.update({codeRegExp:s})},{"primary-actions":a(()=>[n(l,{action:"refresh",appearance:"primary",onClick:h},{default:a(()=>[d(V(c("common.refresh")),1)]),_:2},1032,["onClick"])]),_:2},1032,["code","query","is-filter-mode","is-reg-exp-mode","onQueryChange","onFilterModeChange","onRegExpModeChange"])]),_:2},1032,["src"])]),_:2},1032,["data"])]),_:2},1024)]),_:1},8,["name"])}}});export{S as default};
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionOutboundSummaryClustersView-DZHJ7k-g.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as T,r as a,o as p,l,w as n,b as t,e as m,k as V,R as E,c as F,I as v,H as B}from"./index-DVZ5nSK2.js";const M=T({__name:"ConnectionOutboundSummaryClustersView",props:{routeName:{},overview:{}},setup(u){const i=u;return(A,s)=>{const _=a("RouteTitle"),g=a("XAction"),f=a("XCodeBlock"),y=a("DataCollection"),d=a("DataLoader"),C=a("AppView"),h=a("RouteView");return p(),l(h,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:i.routeName},{default:n(({route:e,uri:x})=>[t(_,{render:!1,title:"Clusters"}),s[1]||(s[1]=m()),t(C,null,{default:n(()=>[t(d,{data:[i.overview]},{default:n(({data:[R]})=>[t(d,{src:x(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:n(({data:[k],refresh:w})=>[(p(!0),F(v,null,B([e.params.connection],r=>(p(),l(y,{key:typeof r,items:k.split(`
+import{d as T,r as a,o as p,l,w as n,b as t,e as m,k as V,Q as E,c as F,I as v,J as B}from"./index-CbPVfXiU.js";const M=T({__name:"ConnectionOutboundSummaryClustersView",props:{routeName:{},overview:{}},setup(u){const i=u;return(A,s)=>{const _=a("RouteTitle"),g=a("XAction"),f=a("XCodeBlock"),y=a("DataCollection"),d=a("DataLoader"),C=a("AppView"),h=a("RouteView");return p(),l(h,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,proxyType:"",mesh:"",proxy:"",connection:""},name:i.routeName},{default:n(({route:e,uri:x})=>[t(_,{render:!1,title:"Clusters"}),s[1]||(s[1]=m()),t(C,null,{default:n(()=>[t(d,{data:[i.overview]},{default:n(({data:[R]})=>[t(d,{src:x(V(E),"/connections/clusters/for/:proxyType/:name/:mesh",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:R.id,mesh:e.params.mesh||"*"})},{default:n(({data:[k],refresh:w})=>[(p(!0),F(v,null,B([e.params.connection],r=>(p(),l(y,{key:typeof r,items:k.split(`
 `),predicate:c=>c.startsWith(`${r}::`)},{default:n(({items:c})=>[t(f,{language:"json",code:c.map(o=>o.replace(`${r}::`,"")).join(`
 `),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:o=>e.update({codeSearch:o}),onFilterModeChange:o=>e.update({codeFilter:o}),onRegExpModeChange:o=>e.update({codeRegExp:o})},{"primary-actions":n(()=>[t(g,{action:"refresh",appearance:"primary",onClick:w},{default:n(()=>[...s[0]||(s[0]=[m(`
                     Refresh
```

**File**: `app/kuma-ui/pkg/resources/data/assets/ConnectionOutboundSummaryStatsView-DBjusFAe.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{d as w,r as a,o as k,l as R,w as n,b as t,e as d,k as A,R as T}from"./index-DVZ5nSK2.js";const v=w({__name:"ConnectionOutboundSummaryStatsView",props:{networking:{},routeName:{},overview:{}},setup(i){const r=i;return(V,s)=>{const m=a("RouteTitle"),l=a("XAction"),u=a("XCodeBlock"),_=a("DataCollection"),p=a("DataLoader"),g=a("AppView"),f=a("RouteView");return k(),R(f,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:r.routeName},{default:n(({route:e,uri:x})=>[t(m,{render:!1,title:"Stats"}),s[1]||(s[1]=d()),t(g,null,{default:n(()=>[t(p,{data:[r.overview]},{default:n(({data:[y]})=>[t(p,{src:x(A(T),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:y.id,mesh:e.params.mesh||"*",socketAddress:r.networking.inboundAddress})},{default:n(({data:[C],refresh:h})=>[t(_,{items:C.raw.split(`
+import{d as w,r as a,o as k,l as R,w as n,b as t,e as d,k as A,Q as T}from"./index-CbPVfXiU.js";const v=w({__name:"ConnectionOutboundSummaryStatsView",props:{networking:{},routeName:{},overview:{}},setup(i){const r=i;return(V,s)=>{const m=a("RouteTitle"),l=a("XAction"),u=a("XCodeBlock"),_=a("DataCollection"),p=a("DataLoader"),g=a("AppView"),f=a("RouteView");return k(),R(f,{params:{codeSearch:"",codeFilter:!1,codeRegExp:!1,mesh:"",proxy:"",proxyType:"",connection:""},name:r.routeName},{default:n(({route:e,uri:x})=>[t(m,{render:!1,title:"Stats"}),s[1]||(s[1]=d()),t(g,null,{default:n(()=>[t(p,{data:[r.overview]},{default:n(({data:[y]})=>[t(p,{src:x(A(T),"/connections/stats/for/:proxyType/:name/:mesh/:socketAddress",{proxyType:{ingresses:"zone-ingress",egresses:"zone-egress"}[e.params.proxyType]??"dataplane",name:y.id,mesh:e.params.mesh||"*",socketAddress:r.networking.inboundAddress})},{default:n(({data:[C],refresh:h})=>[t(_,{items:C.raw.split(`
 `),predicate:c=>c.includes(`.${e.params.connection}.`)},{default:n(({items:c})=>[t(u,{language:"json",code:c.map(o=>o.replace(`${e.params.connection}.`,"")).join(`
 `),"is-searchable":"",query:e.params.codeSearch,"is-filter-mode":e.params.codeFilter,"is-reg-exp-mode":e.params.codeRegExp,onQueryChange:o=>e.update({codeSearch:o}),onFilterModeChange:o=>e.update({codeFilter:o}),onRegExpModeChange:o=>e.update({codeRegExp:o})},{"primary-actions":n(()=>[t(l,{action:"refresh",appearance:"primary",onClick:h},{default:n(()=>[...s[0]||(s[0]=[d(`
                   Refresh
```

---

### Incident Patch 12: `b1af7b03` (2026-09-28)
**Commit Message**: fix(xds): validate labels of the Dataplane passed to kuma-dp run (#18898)

Signed-off-by: Ilya Lobkov <[REDACTED_EMAIL]>

**File**: `UPGRADE.md` (modified, +2/-1)
```diff
@@ -20,8 +20,8 @@ None for most meshes. TLS 1.3 cipher suites are not configurable, so `tlsCiphers
 
 From now on, `kuma.io/` and `k8s.kuma.io/` are reserved label prefixes.
 Every unknown label under these prefixes will be rejected on create and update.
+On Universal this includes the labels of the `Dataplane` passed to `kuma-dp run`: a proxy whose `Dataplane` carries an unknown reserved label, such as a leftover `kuma.io/gateway: "true"`, or an invalid label value fails to register until the label is fixed.
 
-<<<<<<< HEAD
 ### Zone Token issuance moved to the KDS auth configuration
 
 A Zone Token now has one job, authenticating a Zone CP to a Global CP over KDS, so the setting that gates its issuance sits with the rest of the KDS authentication configuration. `dpServer.authn.zoneProxy` is removed, it configured the authentication of zone proxies, which are ordinary data plane proxies authenticating with a dataplane token since 3.0.0.
@@ -40,6 +40,7 @@ A Zone Token now has one job, authenticating a Zone CP to a Global CP over KDS,
 **Action required**
 
 Only if you set `enableIssuer` to `false` to mint Zone Tokens offline. Move it to `multizone.global.kds.auth.zoneToken.enableIssuer` on the Global CP, the removed setting is ignored and the issuer is enabled again. The other removed settings had no effect, `dpServer.authn.zoneProxy.zoneToken.validator` was read by nothing and `dpServer.authn.zoneProxy.type` was autoconfigured and never consumed.
+
 ### Resources with fields that are not in the schema are rejected
 
 Applying a policy or resource with a field that does not exist in its schema now fails with `400` listing every unknown field, for example `spec.from: unknown field`. Previously such fields were silently dropped, so a policy written for an older version, such as a `MeshTrafficPermission` with `spec.from` instead of `spec.rules`, was stored without it and looked applied while doing nothing. The check covers policies and resources with a generated schema; legacy resources without one, such as `Mesh`, still drop unknown fields silently. It applies to the Kuma API server and `kumactl apply`. On Kubernetes, `kubectl apply` behavior is unchanged: the API server prunes unknown fields and prints a warning.
```

**File**: `pkg/xds/server/callbacks/dataplane_lifecycle.go` (modified, +14/-0)
```diff
@@ -12,6 +12,7 @@ import (
 	mesh_proto "github.com/kumahq/kuma/v3/api/mesh/v1alpha1"
 	"github.com/kumahq/kuma/v3/pkg/core"
 	core_mesh "github.com/kumahq/kuma/v3/pkg/core/resources/apis/mesh"
+	resource_labels "github.com/kumahq/kuma/v3/pkg/core/resources/labels"
 	"github.com/kumahq/kuma/v3/pkg/core/resources/manager"
 	core_model "github.com/kumahq/kuma/v3/pkg/core/resources/model"
 	"github.com/kumahq/kuma/v3/pkg/core/resources/store"
@@ -39,6 +40,7 @@ type DataplaneLifecycle struct {
 	deregistrationDelay time.Duration
 	cpInstanceID        string
 	cacheExpirationTime time.Duration
+	cp                  resource_labels.ControlPlane
 }
 
 type proxyInfo struct {
@@ -56,6 +58,7 @@ func NewDataplaneLifecycle(
 	deregistrationDelay time.Duration,
 	cpInstanceID string,
 	cacheExpirationTime time.Duration,
+	cp resource_labels.ControlPlane,
 ) *DataplaneLifecycle {
 	return &DataplaneLifecycle{
 		resManager:          resManager,
@@ -65,6 +68,7 @@ func NewDataplaneLifecycle(
 		deregistrationDelay: deregistrationDelay,
 		cpInstanceID:        cpInstanceID,
 		cacheExpirationTime: cacheExpirationTime,
+		cp:                  cp,
 	}
 }
 
@@ -81,6 +85,16 @@ func (d *DataplaneLifecycle) OnProxyConnected(streamID core_xds.StreamID, proxyK
 	if err := d.validateProxyKey(proxyKey, md.Resource); err != nil {
 		return err
 	}
+	if verr := resource_labels.Validate(resource_labels.Write{
+		Descriptor:  md.Resource.Descriptor(),
+		Spec:        md.Resource.GetSpec(),
+		Namespace:   resource_labels.UnsetNamespace,
+		Mesh:        md.Resource.GetMeta().GetMesh(),
+		DisplayName: md.Resource.GetMeta().GetName(),
+		Labels:      md.Resource.GetMeta().GetLabels(),
+	}, d.cp); verr.HasViolations() {
+		return errors.Wrap(&verr, "invalid labels of the proxy resource passed in kuma-dp run")
+	}
 	return d.register(ctx, streamID, proxyKey, md)
 }
 
```

**File**: `pkg/xds/server/callbacks/dataplane_lifecycle_test.go` (modified, +54/-1)
```diff
@@ -16,7 +16,9 @@ import (
 	"google.golang.org/protobuf/types/known/structpb"
 
 	mesh_proto "github.com/kumahq/kuma/v3/api/mesh/v1alpha1"
+	config_core "github.com/kumahq/kuma/v3/pkg/config/core"
 	core_mesh "github.com/kumahq/kuma/v3/pkg/core/resources/apis/mesh"
+	resource_labels "github.com/kumahq/kuma/v3/pkg/core/resources/labels"
 	core_manager "github.com/kumahq/kuma/v3/pkg/core/resources/manager"
 	core_model "github.com/kumahq/kuma/v3/pkg/core/resources/model"
 	core_store "github.com/kumahq/kuma/v3/pkg/core/resources/store"
@@ -53,7 +55,7 @@ var _ = Describe("Dataplane Lifecycle", func() {
 		resManager = core_manager.NewResourceManager(store)
 		ctx, cancel = context.WithCancel(context.Background())
 
-		dpLifecycle := NewDataplaneLifecycle(ctx, resManager, authenticator, 0*time.Second, cpInstanceID, 0*time.Second)
+		dpLifecycle := NewDataplaneLifecycle(ctx, resManager, authenticator, 0*time.Second, cpInstanceID, 0*time.Second, resource_labels.ControlPlane{Mode: config_core.Zone, Zone: "zone-1"})
 		callbacks = util_xds_v3.AdaptDeltaCallbacks(DataplaneCallbacksToXdsCallbacks(dpLifecycle))
 
 		err := resManager.Create(context.Background(), core_mesh.NewMeshResource(), core_store.CreateByKey(core_model.DefaultMesh, core_model.NoMesh))
@@ -176,6 +178,57 @@ var _ = Describe("Dataplane Lifecycle", func() {
             `),
 	)
 
+	DescribeTable("should reject a DP with invalid labels instead of registering it", func(labels string, expectedErr string) {
+		// given
+		req := envoy_sd.DeltaDiscoveryRequest{
+			Node: &envoy_core.Node{
+				Id: "default.backend-01",
+				Metadata: &structpb.Struct{
+					Fields: map[string]*structpb.Value{
+						"dataplane.resource": {
+							Kind: &structpb.Value_StringValue{
+								StringValue: fmt.Sprintf(`
+                                {
+                                  "type": "Dataplane",
+                                  "mesh": "default",
+                                  "name": "backend-01",
+                                  "labels": %s,
+                                  "networking": {
+                                    "address": "127.0.0.1",
+                                    "inbound": [
+                                      {
+                                        "port": 22022,
+                                        "servicePort": 8443
+                                      }
+                                    ]
+                                  }
+                                }
+                                `, labels),
+							},
+						},
+					},
+				},
+			},
+		}
+		const streamId = 123
+		ctx := metadata.NewIncomingContext(context.Background(), map[string][]string{
+			"authorization": {"token"},
+		})
+		Expect(callbacks.OnDeltaStreamOpen(ctx, streamId, "")).To(Succeed())
+
+		// when
+		err := callbacks.OnStreamDeltaRequest(streamId, &req)
+
+		// then
+		Expect(err).To(MatchError(ContainSubstring(expectedErr)))
+		err = resManager.Get(context.Background(), core_mesh.NewDataplaneResource(), core_store.GetByKey("backend-01", "default"))
+		Expect(core_store.IsNotFound(err)).To(BeTrue())
+	},
+		Entry("unknown reserved key", `{"kuma.io/gateway": "true"}`, `label "kuma.io/gateway" is reserved and not known to this control plane`),
+		Entry("control plane owned label with a wrong value", `{"kuma.io/zone": "zone-2"}`, `kuma.io/zone label should have zone-1 value`),
+		Entry("malformed value", `{"app": "not valid!!"}`, `a valid label must be an empty string or consist of alphanumeric characters`),
+	)
+
 	It("should not override extisting DP with different service", func() {
 		// given already created DP
 		dp := &core_mesh.DataplaneResource{
```

**File**: `pkg/xds/server/v3/components.go` (modified, +2/-1)
```diff
@@ -12,6 +12,7 @@ import (
 	"google.golang.org/protobuf/types/known/structpb"
 
 	"github.com/kumahq/kuma/v3/pkg/core"
+	resource_labels "github.com/kumahq/kuma/v3/pkg/core/resources/labels"
 	core_runtime "github.com/kumahq/kuma/v3/pkg/core/runtime"
 	util_xds "github.com/kumahq/kuma/v3/pkg/util/xds"
 	util_xds_v3 "github.com/kumahq/kuma/v3/pkg/util/xds/v3"
@@ -39,7 +40,7 @@ func RegisterXDS(
 	workloadLabelValidator := xds_callbacks.DataplaneCallbacksToXdsCallbacks(xds_callbacks.NewWorkloadLabelValidator(rt.ReadOnlyResourceManager(), rt.Config().Environment))
 
 	dpLifecycle := xds_callbacks.DataplaneCallbacksToXdsCallbacks(
-		xds_callbacks.NewDataplaneLifecycle(rt.AppContext(), rt.ResourceManager(), authenticator, rt.Config().XdsServer.DataplaneDeregistrationDelay.Duration, rt.GetInstanceId(), rt.Config().Store.Cache.ExpirationTime.Duration))
+		xds_callbacks.NewDataplaneLifecycle(rt.AppContext(), rt.ResourceManager(), authenticator, rt.Config().XdsServer.DataplaneDeregistrationDelay.Duration, rt.GetInstanceId(), rt.Config().Store.Cache.ExpirationTime.Duration, resource_labels.ControlPlaneFromConfig(rt.Config())))
 	reconciler := DefaultReconciler(rt, xdsContext, statsCallbacks, xdsMetrics)
 	otelStatusCache := otelstatus.NewCache()
 	watchdogFactory, err := xds_sync.DefaultDataplaneWatchdogFactory(rt, reconciler, xdsMetrics, envoyCpCtx, otelStatusCache, envoy_common.APIV3)
```

---

### Incident Patch 13: `fdddb3db` (2026-09-28)
**Commit Message**: fix(meshtls): allow TLS 1.3 on outbound mTLS (#18865)

Signed-off-by: Lukasz Dziedziak <[REDACTED_EMAIL]>

**File**: `UPGRADE.md` (modified, +8/-0)
```diff
@@ -8,6 +8,14 @@ does not have any particular instructions.
 
 ## Upgrade to `3.0.0`
 
+### Outbound mTLS negotiates TLS 1.3
+
+Outbound mesh mTLS connections now allow TLS 1.3. Previously Envoy's client default capped them at TLS 1.2, so mesh traffic negotiated TLS 1.2 even though inbound listeners accepted TLS 1.3. A `MeshTLS` or `MeshExternalService` `tlsVersion.max` that is unset or `TLSAuto` now resolves to TLS 1.3 on the client side, which also fixes `min: TLS13` without `max` failing every connection with `NO_SUPPORTED_VERSIONS_ENABLED`.
+
+**Action required**
+
+None for most meshes. TLS 1.3 cipher suites are not configurable, so `tlsCiphers` no longer restricts connections that negotiate TLS 1.3. To keep outbound traffic on TLS 1.2, set `tlsVersion.max: TLS12` in `MeshTLS` or `MeshExternalService`.
+
 ### Reserved label prefixes
 
 From now on, `kuma.io/` and `k8s.kuma.io/` are reserved label prefixes.
```

**File**: `api/common/v1alpha1/tls/tls.go` (modified, +7/-0)
```diff
@@ -80,6 +80,13 @@ func ToTlsVersion(version *TlsVersion) tlsv3.TlsParameters_TlsProtocol {
 	}
 }
 
+func ToUpstreamMaxTlsVersion(version *TlsVersion) tlsv3.TlsParameters_TlsProtocol {
+	if version == nil || *version == TLSVersionAuto {
+		return tlsv3.TlsParameters_TLSv1_3
+	}
+	return ToTlsVersion(version)
+}
+
 // +kubebuilder:validation:Enum=ECDHE-ECDSA-AES128-GCM-SHA256;ECDHE-ECDSA-AES256-GCM-SHA384;ECDHE-ECDSA-CHACHA20-POLY1305;ECDHE-RSA-AES128-GCM-SHA256;ECDHE-RSA-AES256-GCM-SHA384;ECDHE-RSA-CHACHA20-POLY1305
 type TlsCipher string
 
```

**File**: `pkg/plugins/policies/core/xds/meshroute/clusters.go` (modified, +3/-1)
```diff
@@ -6,6 +6,7 @@ import (
 	envoy_tls "github.com/envoyproxy/go-control-plane/envoy/extensions/transport_sockets/tls/v3"
 	"github.com/pkg/errors"
 
+	common_tls "github.com/kumahq/kuma/v3/api/common/v1alpha1/tls"
 	"github.com/kumahq/kuma/v3/pkg/core/kri"
 	core_meta "github.com/kumahq/kuma/v3/pkg/core/metadata"
 	"github.com/kumahq/kuma/v3/pkg/core/resources/apis/core"
@@ -192,7 +193,8 @@ func UpstreamTLSContext(proxy *core_xds.Proxy, sni string, sans []string) (*envo
 				proxy.WorkloadIdentity.IdentitySourceConfigurer(),
 			),
 		})).
-		Configure(bldrs_tls.KumaAlpnProtocol())
+		Configure(bldrs_tls.KumaAlpnProtocol()).
+		Configure(bldrs_tls.TlsMaxVersion(pointer.To(common_tls.TLSVersion13)))
 	return bldrs_tls.NewUpstreamTLSContext().
 		Configure(bldrs_tls.SNI(sni)).
 		Configure(bldrs_tls.UpstreamCommonTlsContext(commonTlsContext)).
```

**File**: `pkg/plugins/policies/meshhttproute/plugin/v1alpha1/testdata/default-meshexternalservice-mesh-scoped-zone.clusters.golden.yaml` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@ resources:
             sdsConfig:
               ads: {}
               resourceApiVersion: V3
+          tlsParams:
+            tlsMaximumProtocolVersion: TLSv1_3
         sni: sni.extsvc.default.remote-zone.ext-backend.9000
     type: EDS
     typedExtensionProtocolOptions:
```

**File**: `pkg/plugins/policies/meshhttproute/plugin/v1alpha1/testdata/default-meshmultizoneservice-mesh-scoped-zone.clusters.golden.yaml` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@ resources:
             sdsConfig:
               ads: {}
               resourceApiVersion: V3
+          tlsParams:
+            tlsMaximumProtocolVersion: TLSv1_3
         sni: sni.mzsvc.default.multi-backend.80
     type: EDS
     typedExtensionProtocolOptions:
```

**File**: `pkg/plugins/policies/meshhttproute/plugin/v1alpha1/testdata/default-meshservice-mesh-scoped-zone.clusters.golden.yaml` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@ resources:
             sdsConfig:
               ads: {}
               resourceApiVersion: V3
+          tlsParams:
+            tlsMaximumProtocolVersion: TLSv1_3
         sni: sni.msvc.default.remote-zone.backend.80
     type: EDS
     typedExtensionProtocolOptions:
```

**File**: `pkg/plugins/policies/meshhttproute/plugin/v1alpha1/testdata/default-route.clusters.golden.yaml` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@ resources:
             sdsConfig:
               ads: {}
               resourceApiVersion: V3
+          tlsParams:
+            tlsMaximumProtocolVersion: TLSv1_3
         sni: sni.extsvc.default.external-service.8085
     type: EDS
     typedExtensionProtocolOptions:
```

**File**: `pkg/plugins/policies/meshhttproute/plugin/v1alpha1/testdata/httproute-meshservice-mesh-scoped-zone-port-by-number.clusters.golden.yaml` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@ resources:
             sdsConfig:
               ads: {}
               resourceApiVersion: V3
+          tlsParams:
+            tlsMaximumProtocolVersion: TLSv1_3
         sni: sni.msvc.default.remote-zone.backend.test-port
     type: EDS
     typedExtensionProtocolOptions:
```

---

### Incident Patch 14: `4e446ee6` (2026-09-28)
**Commit Message**: fix(xds): empty reachable labels select all (#18860)

Signed-off-by: Lukasz Dziedziak <[REDACTED_EMAIL]>

**File**: `pkg/core/resources/apis/mesh/dataplane_validator.go` (modified, +2/-2)
```diff
@@ -181,8 +181,8 @@ func validateTransparentProxying(tp *mesh_proto.Dataplane_Networking_Transparent
 			default:
 				result.AddViolationAt(path.Index(i).Field("kind"), fmt.Sprintf("invalid value. Available values are: %s", strings.Join(maps.SortedKeys(allowedKinds), ",")))
 			}
-			if len(backendRef.Labels) == 0 {
-				result.AddViolationAt(path.Index(i).Field("labels"), validators.MustNotBeEmpty)
+			if len(backendRef.Labels) == 0 && backendRef.Port != nil {
+				result.AddViolationAt(path.Index(i).Field("port"), "must not be set when labels are empty")
 			}
 		}
 	}
```

**File**: `pkg/core/resources/apis/mesh/dataplane_validator_test.go` (modified, +6/-3)
```diff
@@ -235,7 +235,9 @@ var _ = Describe("Dataplane", func() {
                       k8s.kuma.io/namespace: es1
                   - kind: MeshService
                     labels:
-                      kuma.io/test: abc`,
+                      kuma.io/test: abc
+                  - kind: MeshMultiZoneService
+                    labels: {}`,
 		),
 		Entry("dataplane with backend ref with labels", `
             type: Dataplane
@@ -801,14 +803,15 @@ var _ = Describe("Dataplane", func() {
                     labels:
                       kuma.io/test: test
                   - kind: MeshService
+                    labels: {}
                     port: 80
 `,
 			expected: `
                 violations:
                 - field: networking.transparentProxing.reachableBackends.refs[0].kind
                   message: 'invalid value. Available values are: MeshExternalService,MeshMultiZoneService,MeshService'
-                - field: networking.transparentProxing.reachableBackends.refs[1].labels
-                  message: must not be empty`,
+                - field: networking.transparentProxing.reachableBackends.refs[1].port
+                  message: must not be set when labels are empty`,
 		}),
 		Entry("listener missing address", testCase{
 			dataplane: `
```

**File**: `pkg/plugins/runtime/k8s/controllers/pod_converter.go` (modified, +6/-0)
```diff
@@ -128,6 +128,12 @@ func (p *PodConverter) dataplaneFor(
 		if err := yaml.UnmarshalStrict([]byte(v), &refs); err != nil {
 			return nil, errors.Wrapf(err, "cannot parse, %s has invalid format", metadata.KumaReachableBackends)
 		}
+		// proto cannot tell omitted labels from empty ones, so require `labels: {}` here to select every backend
+		for i, ref := range refs.Refs {
+			if ref.Labels == nil {
+				return nil, errors.Errorf("%s: refs[%d].labels is required, use {} to select every %s", metadata.KumaReachableBackends, i, ref.Kind)
+			}
+		}
 
 		tp.ReachableBackends = &mesh_proto.Dataplane_Networking_TransparentProxying_ReachableBackends{
 			Refs: processReachableBackendRefs(refs),
```

**File**: `pkg/plugins/runtime/k8s/controllers/pod_converter_test.go` (modified, +4/-0)
```diff
@@ -392,6 +392,10 @@ var _ = Describe("PodToDataplane(..)", func() {
 			pod:         "50.pod.yaml",
 			expectedErr: "kuma.io/reachable-backends has invalid format",
 		}),
+		Entry("51. Pod with a reachable backend ref without labels", testCase{
+			pod:         "51.pod.yaml",
+			expectedErr: "refs[0].labels is required",
+		}),
 	)
 })
 
```

**File**: `pkg/plugins/runtime/k8s/controllers/testdata/28.dataplane.yaml` (modified, +1/-0)
```diff
@@ -38,3 +38,4 @@ spec:
         - kind: MeshExternalService
           labels:
             kuma.io/display-name: httpbin
+        - kind: MeshMultiZoneService
```

**File**: `pkg/plugins/runtime/k8s/controllers/testdata/28.pod.yaml` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ metadata:
       - kind: MeshExternalService
         labels:
           kuma.io/display-name: httpbin
+      - kind: MeshMultiZoneService
+        labels: {}
 spec:
   containers:
     - ports: []
```

**File**: `pkg/plugins/runtime/k8s/controllers/testdata/51.pod.yaml` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+metadata:
+  namespace: demo
+  name: example
+  labels:
+    app: example
+    version: "0.1"
+  annotations:
+    traffic.kuma.io/transparent-proxy-config: |
+      redirect:
+        inbound:
+          port: 15006
+        outbound:
+          port: 15001
+    kuma.io/reachable-backends: |
+      refs:
+      - kind: MeshService
+        port: 8080
+spec:
+  containers:
+    - ports: []
+      # when a 'targetPort' in a ServicePort is a number,
+      # it should not be mandatory to list container ports explicitly
+      #
+      # containerPort: 8080
+      # containerPort: 8443
+    - ports:
+        - containerPort: 7070
+        - containerPort: 6060
+          name: metrics
+status:
+  podIP: 192.168.0.1
```

**File**: `pkg/xds/context/destination_index.go` (modified, +42/-20)
```diff
@@ -62,6 +62,31 @@ func (di *DestinationIndex) GetReachableBackends(dataplane *core_mesh.DataplaneR
 
 	networking := dataplane.Spec.GetNetworking()
 
+	addOutbounds := func(ids []kri.Identifier, sectionName string) {
+		for _, id := range ids {
+			if sectionName != "" {
+				id = kri.WithSectionName(id, sectionName)
+			}
+
+			var dest core.Destination
+			if dest = di.GetDestinationByKRI(id); dest == nil {
+				continue
+			}
+
+			// an unnamed port matches the empty section name, so only narrow when one is set
+			if id.SectionName != "" {
+				if p, ok := dest.FindPortByName(id.SectionName); ok {
+					outbounds[kri.WithSectionName(id, p.GetName())] = p
+				}
+				continue
+			}
+
+			for _, p := range dest.GetPorts() {
+				outbounds[kri.WithSectionName(id, p.GetName())] = p
+			}
+		}
+	}
+
 	processRef := func(kind string, name string, port *uint32, labels map[string]string) {
 		selectorLabels, sectionName := NormalizeBackendRefTarget(
 			kind,
@@ -88,26 +113,7 @@ func (di *DestinationIndex) GetReachableBackends(dataplane *core_mesh.DataplaneR
 			return
 		}
 
-		ids := di.resolveResourceIdentifiersForLabels(core_model.ResourceType(kind), selectorLabels)
-		for _, id := range ids {
-			if sectionName != "" {
-				id = kri.WithSectionName(id, sectionName)
-			}
-
-			var dest core.Destination
-			if dest = di.GetDestinationByKRI(id); dest == nil {
-				continue
-			}
-
-			if p, ok := dest.FindPortByName(id.SectionName); ok {
-				outbounds[kri.WithSectionName(id, p.GetName())] = p
-				continue
-			}
-
-			for _, p := range dest.GetPorts() {
-				outbounds[kri.WithSectionName(id, p.GetName())] = p
-			}
-		}
+		addOutbounds(di.resolveResourceIdentifiersForLabels(core_model.ResourceType(kind), selectorLabels), sectionName)
 	}
 
 	// Handle user defined outbound without a transparent proxy
@@ -138,6 +144,12 @@ func (di *DestinationIndex) GetReachableBackends(dataplane *core_mesh.DataplaneR
 			port = pointer.To(ref.Port.GetValue())
 		}
 
+		// Like a Kubernetes label selector, empty labels select every backend of the kind
+		if len(ref.Labels) == 0 {
+			addOutbounds(di.resourceIdentifiersOfType(core_model.ResourceType(ref.Kind)), "")
+			continue
+		}
+
 		processRef(ref.Kind, "", port, ref.Labels)
 	}
 
@@ -184,6 +196,16 @@ func (di *DestinationIndex) resolveResourceIdentifiersForLabels(resType core_mod
 	return result
 }
 
+func (di *DestinationIndex) resourceIdentifiersOfType(resType core_model.ResourceType) []kri.Identifier {
+	var result []kri.Identifier
+	for id := range di.destinationByIdentifier {
+		if id.ResourceType == resType {
+			result = append(result, id)
+		}
+	}
+	return result
+}
+
 func (di *DestinationIndex) getDestinationsForLabels(resType core_model.ResourceType, labels map[string]string) map[kri.Identifier]int {
 	reachable := map[kri.Identifier]int{}
 	for label, value := range labels {
```

---

### Incident Patch 15: `901a1062` (2026-09-25)
**Commit Message**: fix(xds): drop MES with unloadable TLS material (#18873)

Signed-off-by: Lukasz Dziedziak <[REDACTED_EMAIL]>

**File**: `pkg/xds/topology/outbound.go` (modified, +17/-0)
```diff
@@ -2,6 +2,8 @@ package topology
 
 import (
 	"context"
+	crypto_tls "crypto/tls"
+	"crypto/x509"
 	"maps"
 	"net"
 	"slices"
@@ -372,6 +374,21 @@ func setTlsConfiguration(ctx context.Context, tls *meshexternalservice_api.Tls,
 			es.SkipHostnameVerification = true
 		}
 	}
+	return validateTLSMaterial(es)
+}
+
+// validateTLSMaterial rejects material Envoy cannot load. Envoy NACKs the whole cluster
+// update for one bad cluster, so a single broken MeshExternalService would otherwise stop
+// config delivery for every other cluster on the proxy (the zone egress serves all meshes).
+func validateTLSMaterial(es *core_xds.ExternalService) error {
+	if len(es.CaCert) > 0 && !x509.NewCertPool().AppendCertsFromPEM(es.CaCert) {
+		return errors.New("caCert does not contain a PEM encoded certificate")
+	}
+	if len(es.ClientCert) > 0 || len(es.ClientKey) > 0 {
+		if _, err := crypto_tls.X509KeyPair(es.ClientCert, es.ClientKey); err != nil {
+			return errors.Wrap(err, "clientCert and clientKey are not a valid key pair")
+		}
+	}
 	return nil
 }
 
```

**File**: `pkg/xds/topology/outbound_test.go` (modified, +109/-9)
```diff
@@ -2,6 +2,14 @@ package topology_test
 
 import (
 	"context"
+	"crypto/ecdsa"
+	"crypto/elliptic"
+	"crypto/rand"
+	"crypto/x509"
+	"crypto/x509/pkix"
+	"encoding/pem"
+	"math/big"
+	"time"
 
 	tlsv3 "github.com/envoyproxy/go-control-plane/envoy/extensions/transport_sockets/tls/v3"
 	. "github.com/onsi/ginkgo/v2"
@@ -30,6 +38,48 @@ import (
 	. "github.com/kumahq/kuma/v3/pkg/xds/topology"
 )
 
+var testCertPEM, testKeyPEM = selfSignedPEM()
+
+func selfSignedPEM() (string, string) {
+	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
+	if err != nil {
+		panic(err)
+	}
+	tmpl := &x509.Certificate{
+		SerialNumber:          big.NewInt(1),
+		Subject:               pkix.Name{CommonName: "example.com"},
+		NotBefore:             time.Now().Add(-time.Hour),
+		NotAfter:              time.Now().Add(time.Hour),
+		IsCA:                  true,
+		BasicConstraintsValid: true,
+	}
+	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
+	if err != nil {
+		panic(err)
+	}
+	keyDER, err := x509.MarshalECPrivateKey(key)
+	if err != nil {
+		panic(err)
+	}
+	return string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})),
+		string(pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}))
+}
+
+func mesWithVerification(name string, verification *meshexternalservice_api.Verification) *meshexternalservice_api.MeshExternalServiceResource {
+	return &meshexternalservice_api.MeshExternalServiceResource{
+		Meta: &test_model.ResourceMeta{Mesh: "default", Name: name},
+		Spec: &meshexternalservice_api.MeshExternalService{
+			Match: meshexternalservice_api.Match{
+				Type:     meshexternalservice_api.HostnameGeneratorType,
+				Port:     10000,
+				Protocol: core_meta.ProtocolTCP,
+			},
+			Endpoints: &[]meshexternalservice_api.Endpoint{{Address: "example.com", Port: 443}},
+			Tls:       &meshexternalservice_api.Tls{Enabled: true, Verification: verification},
+		},
+	}
+}
+
 var _ = Describe("TrafficRoute", func() {
 	const defaultMeshName = "default"
 	var dataSourceLoader datasource.Loader
@@ -249,15 +299,15 @@ var _ = Describe("TrafficRoute", func() {
 									},
 									CaCert: &datasource_api.SecureDataSource{
 										Type:           datasource_api.SecureDataSourceInline,
-										InsecureInline: &datasource_api.Inline{Value: "ca"},
+										InsecureInline: &datasource_api.Inline{Value: testCertPEM},
 									},
 									ClientCert: &datasource_api.SecureDataSource{
 										Type:           datasource_api.SecureDataSourceInline,
-										InsecureInline: &datasource_api.Inline{Value: "cert"},
+										InsecureInline: &datasource_api.Inline{Value: testCertPEM},
 									},
 									ClientKey: &datasource_api.SecureDataSource{
 										Type:           datasource_api.SecureDataSourceInline,
-										InsecureInline: &datasource_api.Inline{Value: "key"},
+										InsecureInline: &datasource_api.Inline{Value: testKeyPEM},
 									},
 								},
 							},
@@ -341,9 +391,9 @@ var _ = Describe("TrafficRoute", func() {
 								Protocol:                 core_meta.ProtocolHTTP,
 								TLSEnabled:               true,
 								FallbackToSystemCa:       true,
-								CaCert:                   []byte("ca"),
-								ClientCert:               []byte("cert"),
-								ClientKey:                []byte("key"),
+								CaCert:                   []byte(testCertPEM),
+								ClientCert:               []byte(testCertPEM),
+								ClientKey:                []byte(testKeyPEM),
 								AllowRenegotiation:       true,
 								SkipHostnameVerification: false,
 								ServerName:               "example.com",
@@ -369,6 +419,56 @@ var _ = Describe("TrafficRoute", func() {
 					},
 				},
 			}),
+			Entry("skips only the MeshExternalService with unparsable TLS material", testCase{
+				meshExternalServices: []*meshexternalservice_api.MeshExternalServiceResource{
+					mesWithVerification("bad-ca", &meshexternalservice_api.Verification{
+						CaCert: &datasource_api.SecureDataSource{
+							Type:           datasource_api.SecureDataSourceInline,
+							InsecureInline: &datasource_api.Inline{Value: "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n"},
+						},
+					}),
+					mesWithVerification("bad-key-pair", &meshexternalservice_api.Verification{
+						ClientCert: &datasource_api.SecureDataSource{
+							Type:           datasource_api.SecureDataSourceInline,
+							InsecureInline: &datasource_api.Inline{Value: testCertPEM},
+						},
+						ClientKey: &datasource_api.SecureDataSource{
+							Type:           datasource_api.SecureDataSourceInline,
+							InsecureInline: &datasource_api.Inline{Value: "not a key"},
+						},
+					}),
+					mesWithVerification("good", &meshexternalservice_api.Verification{
+						CaCert: &datasource_api.SecureDataSource{
+							Type:           datasource_api.SecureDataSourceInline,
+							InsecureInline: &datasource_api.Inline{Value: testCertPEM},
+						},
+					}),
+				},
+				zoneEgressAdd
```

#### Recent Merged Pull Requests:
- **PR #18981** (closed): chore(deps): bump google.golang.org/genproto/googleapis/* from b142276 to 8a89bd6 (backport of #18953) (@kumahq[bot])
- **PR #18978** (closed): fix(meshtimeout): keep zone egress rule timeouts (@lukidzi)
- **PR #18977** (2026-10-05): Revert "chore(deps): bump jdx/mise-action from 4.3.0 to 5.1.1" (@lukidzi)
- **PR #18970** (2026-10-05): chore(deps): bump jdx/mise-action from 4.3.0 to 5.1.1 (@renovate[bot])
- **PR #18969** (2026-10-05): chore(deps/dev): bump yq from 4.53.6 to 4.54.1 (@renovate[bot])
- **PR #18968** (2026-10-05): chore(deps/dev): bump npm:@redocly/cli from 2.53.2 to 2.54.2 (@renovate[bot])
- **PR #18967** (2026-10-05): chore(deps): bump reviewdog/action-actionlint from 1.77.0 to 1.79.1 (@renovate[bot])
- **PR #18966** (2026-10-05): chore(deps): bump projectcalico/tigera-operator from 3.32.2 to 3.33.0 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

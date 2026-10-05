# Forensic Learning Record (Deep Inspection): vxcontrol/pentagi

> **Canonical Artifact**: `07_PROJECT_LEARNING/vxcontrol-pentagi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vxcontrol/pentagi](https://github.com/vxcontrol/pentagi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:32:54.735Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vxcontrol/pentagi`
- **Description**: Fully autonomous AI Agents system capable of performing complex penetration testing tasks
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 25144 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/cmd/installer/checker/checker.go`
```
package checker

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"runtime"
	"sync"

	"pentagi/cmd/installer/state"
	"pentagi/pkg/version"

	"github.com/moby/moby/client"
)

var (
	InstallerVersion = version.GetBinaryVersion()
	UserAgent        = "PentAGI-Installer/" + InstallerVersion
)

const (
	DockerComposeFile               = "docker-compose.yml"
	GraphitiComposeFile             = "docker-compose-graphiti.yml"
	LangfuseComposeFile             = "docker-compose-langfuse.yml"
	ObservabilityComposeFile        = "docker-compose-observability.yml"
	ExampleCustomConfigLLMFile      = "example.custom.provider.yml"
	ExampleOllamaConfigLLMFile      = "example.ollama.provider.yml"
	PentagiScriptFile               = "/usr/local/bin/pentagi"
	PentagiContainerName            = "pentagi"
	ScraperContainerName            = "scraper"
	PgvectorContainerName           = "pgvector"
	PgexporterContainerName         = "pgexporter"
	GraphitiContainerName           = "graphiti"
	Neo4jContainerName              = "neo4j"
	LangfuseWorkerContainerName     = "langfuse-worker"
	LangfuseWebContainerName        = "langfuse-web"
	LangfusePostgresContainerName   = "langfuse-postgres"
	LangfuseClickhouseContainerName = "langfuse-clickhouse"
	LangfuseRedisContainerName      = "langfuse-redis"
	LangfuseMinioContainerName      = "langfuse-minio"
	GrafanaContainerName            = "grafana"
	OpenTelemetryContainerName      = "otel"
	VictoriaMetricsContainerName    = "victoriametrics"
	LokiContainerName               = "loki"
	JaegerContainerName             = "jaeger"
	NodeExporterContainerName       = "node-exporter"
	CadvisorContainerName           = "cadvisor"
	ClickstoreContainerName         = "clickstore"
	DefaultImage                    = "debian:latest"
	DefaultImageForPentest          = "vxcontrol/kali-linux"
	DefaultGraphitiEndpoint         = "http://graphiti:8000"
	DefaultLangfuseEndpoint         = "http://langfuse-web:3000"
	DefaultObservabilityEndpoint    = "otelcol:8148"
	DefaultLangfuseOtelEndpoint     = "http://otelcol:4318"
	DefaultUpdateServerEndpoint     = "https://update.pentagi.com"
	DefaultSupportServerEndpoint    = "https://support.pentagi.com"
	MinFreeMemGB                    = 0.5
	MinFreeMemGBForPentagi          = 0.5
	MinFreeMemGBForGraphiti         = 2.0
	MinFreeMemGBForLangfuse         = 1.5
	MinFreeMemGBForObservability    = 1.5
	MinFreeDiskGB                   = 5.0
	MinFreeDiskGBForComponents      = 10.0
	MinFreeDiskGBPerComponents      = 2.0
	MinFreeDiskGBForWorkerImages    = 25.0
)

var (
	ErrAppStateNotInitialized = errors.New("appState not initialized")
	ErrHandlerNotInitialized  = errors.New("handler not initialized")
)

type CheckResult struct {
	EnvFileExists           bool   `json:"env_file_exists" yaml:"env_file_exists"`
	DockerApiAccessible     bool   `json:"docker_api_accessible" yaml:"docker_api_accessible"`
	WorkerEnvApiAccessible  bool   `json:"worker_env_api_accessible" yaml:"worker_env_api_accessible"`
	WorkerImageExists       bool   `json:"worker_image_exists" yaml:"worker_image_exists"`
	DockerInstalled         bool   `json:"docker_installed" yaml:"docker_installed"`
	DockerComposeInstalled  bool   `json:"docker_compose_installed" yaml:"docker_compose_installed"`
	DockerVersion           string `json:"docker_version" yaml:"docker_version"`
	DockerVersionOK         bool   `json:"docker_version_ok" yaml:"docker_version_ok"`
	DockerComposeVersion    string `json:"docker_compose_version" yaml:"docker_compose_version"`
	DockerComposeVersionOK  bool   `json:"docker_compose_version_ok" yaml:"docker_compose_version_ok"`
	PentagiScriptInstalled  bool   `json:"pentagi_script_installed" yaml:"pentagi_script_installed"`
	PentagiExtracted        bool   `json:"pentagi_extracted" yaml:"pentagi_extracted"`
	PentagiInstalled        bool   `json:"pentagi_installed" yaml:"pentagi_installed"`
	PentagiRunning          bool   `json:"pentagi_running" yaml:"pentagi_running"`
	PentagiVolumesExist     bool   `json:"pentagi_volumes_exist" yaml:"pentagi_volumes_exist"`
	GraphitiConnected       bool   `json:"graphiti_connected" yaml:"graphiti_connected"`
	GraphitiExternal        bool   `json:"graphiti_external" yaml:"graphiti_external"`
	GraphitiExtracted       bool   `json:"graphiti_extracted" yaml:"graphiti_extracted"`
	GraphitiInstalled       bool   `json:"graphiti_installed" yaml:"graphiti_installed"`
	GraphitiRunning         bool   `json:"graphiti_running" yaml:"graphiti_running"`
	GraphitiVolumesExist    bool   `json:"graphiti_volumes_exist" yaml:"graphiti_volumes_exist"`
	LangfuseConnected       bool   `json:"langfuse_connected" yaml:"langfuse_connected"`
	LangfuseExternal        bool   `json:"langfuse_external" yaml:"langfuse_external"`
	LangfuseExtracted       bool   `json:"langfuse_extracted" yaml:"langfuse_extracted"`
	LangfuseInstalled       bool   `json:"langfuse_installed" yaml:"langfuse_installed"`
	LangfuseRunning         bool   `json:"langfuse_running" yaml:"langfuse_running"`
	LangfuseVolumesExist    bool   `json:"langfuse_volumes_exist" yaml:"langfuse_volumes_exist"`
	ObservabilityConnected  bool   `json:"observability_connected" yaml:"observability_connected"`
	ObservabilityExternal   bool   `json:"observability_external" yaml:"observability_external"`
	ObservabilityExtracted  bool   `json:"observability_extracted" yaml:"observability_extracted"`
	ObservabilityInstalled  bool   `json:"observability_installed" yaml:"observability_installed"`
	ObservabilityRunning    bool   `json:"observability_running" yaml:"observability_running"`
	SysNetworkOK            bool   `json:"sys_network_ok" yaml:"sys_network_ok"`
	SysCPUOK                bool   `json:"sys_cpu_ok" yaml:"sys_cpu_ok"`
	SysMemoryOK             bool   `json:"sys_memory_ok" yaml:"sys_memory_ok"`
	SysDiskFreeSpaceOK      bool   `json:"sys_disk_free_space_ok" yaml:"sys_disk_free_space_ok"`
	UpdateServerAccessible  bool   `json:"update_server_accessible" yaml:"update_server_accessible"`
	InstallerIsUpToDate     bool   `json:"installer_is_up_to_date" yaml:"installer_is_up_to_date"`
	PentagiIsUpToDate       bool   `json:"pentagi_is_up_to_date" yaml:"pentagi_is_up_to_date"`
	GraphitiIsUpToDate      bool   `json:"graphiti_is_up_to_date" yaml:"graphiti_is_up_to_date"`
	LangfuseIsUpToDate      bool   `json:"langfuse_is_up_to_date" yaml:"langfuse_is_up_to_date"`
	ObservabilityIsUpToDate bool   `json:"observability_is_up_to_date" yaml:"observability_is_up_to_date"`
	WorkerIsUpToDate        bool   `json:"worker_is_up_to_date" yaml:"worker_is_up_to_date"`

	// System resource details for UI display
	SysCPUCount        int             `json:"sys_cpu_count" yaml:"sys_cpu_count"`
	SysMemoryRequired  float64         `json:"sys_memory_required_gb" yaml:"sys_memory_required_gb"`
	SysMemoryAvailable float64         `json:"sys_memory_available_gb" yaml:"sys_memory_available_gb"`
	SysDiskRequired    float64         `json:"sys_disk_required_gb" yaml:"sys_disk_required_gb"`
	SysDiskAvailable   float64         `json:"sys_disk_available_gb" yaml:"sys_disk_available_gb"`
	SysNetworkFailures []string        `json:"sys_network_failures" yaml:"sys_network_failures"`
	DockerErrorType    DockerErrorType `json:"docker_error_type" yaml:"docker_error_type"`
	EnvDirWritable     bool            `json:"env_dir_writable" yaml:"env_dir_writable"`

	// StackUpdates is the update server's answer in full: per stack, what version is
	// offered, what the release says, and which artefacts would actually change. The
	// per-stack booleans above are the same verdict reduced to what the menus need.
	StackUpdates []StackUpdate `json:"stack_updates,omitempty" yaml:"stack_updates,omitempty"`
	// UpdateFailure explains why there is no answer, and is nil when there is one. It
	// replaces guessing from UpdateServerAccessible: "unreachable", "quota spent" and
	// "not allowed for this license" need different things from the user.
	UpdateFailure *UpdateCheckFailure `json:"update_failure,omitempty" yaml:"update_failure,omitempty"`
	// 
```

### Core Architecture Module: `backend/cmd/installer/checker/components.go`
```
package checker

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"pentagi/cmd/installer/cloud"
	"pentagi/cmd/installer/wizard/logger"

	"github.com/moby/moby/client"
	"github.com/vxcontrol/cloud/models"
)

// This file turns a running installation into the component list the update server is
// asked about. The list has to be COMPLETE: the server answers only about what it was
// told, so a component left out comes back as "nothing to report" — which reads exactly
// like "up to date" and is the more dangerous of the two mistakes.

// maxReportedComponents is the server-side ceiling on one request, and it IS the
// contract's constant rather than a number that agrees with it today. A local literal
// can only be wrong in two ways, and both are silent: too high and the service refuses
// the whole request — losing the answer for every component, not just the ones past the
// bound — too low and the tail is trimmed here while the service would have taken it.
//
// The inventory is well under it, but the list grows with every stack, so the limit is
// enforced before sending and what gets dropped is written to the log: a silently
// truncated list would report the remaining components as complete.
const maxReportedComponents = models.MaxReportedComponents

// JaegerPluginDir holds the Jaeger storage plugin, relative to the directory the
// environment file lives in.
//
// Exported because the processor writes into this directory when it downloads a newer
// plugin: the path, the file names and the digests reported for them have to be one
// table, or an update writes a file nothing reads.
const JaegerPluginDir = "observability/jaeger/bin"

// JaegerPluginBinaries maps the architecture a plugin file is built for to its name.
//
// Both files are on disk regardless of the host: the choice happens inside the Jaeger
// container, by the architecture of the Docker VM rather than of this machine. So both are
// reported, as two components.
var JaegerPluginBinaries = map[models.ArchType]string{
	models.ArchTypeAMD64: "jaeger-clickhouse-linux-amd64",
	models.ArchTypeARM64: "jaeger-clickhouse-linux-arm64",
}

// imageComponent names the container an image component is observed through.
//
// The table is explicit because nothing here can be derived. Four of the sixteen observed
// components run in a container whose name is not the component's: postgres, clickhouse,
// redis and minio all carry the `langfuse-` prefix of the stack that owns them. Guessing
// the container from the component would silently drop those four — a name matching no
// container is indistinguishable from a container that is not deployed — so the mapping
// lives in exactly one place, and TestComponents_ImageComponent_MatchesTheComposeContainersBothWays
// keeps it honest against the compose files.
type imageComponent struct {
	Component models.ComponentType
	Container string
}

// The four groups below are also the order components are reported in, which is the order
// the ceiling above cuts from: the stacks whose updates matter most come first.
var (
	pentagiImageComponents = []imageComponent{
		{models.ComponentTypePentagi, PentagiContainerName},
		{models.ComponentTypeScraper, ScraperContainerName},
		{models.ComponentTypePgvector, PgvectorContainerName},
		// Last in its group on purpose: the ceiling cuts from the tail, and an
		// exporter is the one component of this stack an installation can live
		// without hearing about.
		{models.ComponentTypePgexporter, PgexporterContainerName},
	}
	graphitiImageComponents = []imageComponent{
		{models.ComponentTypeGraphiti, GraphitiContainerName},
		{models.ComponentTypeNeo4j, Neo4jContainerName},
	}
	langfuseImageComponents = []imageComponent{
		{models.ComponentTypeLangfuseWorker, LangfuseWorkerContainerName},
		{models.ComponentTypeLangfuseWeb, LangfuseWebContainerName},
		{models.ComponentTypePostgres, LangfusePostgresContainerName},
		{models.ComponentTypeClickhouse, LangfuseClickhouseContainerName},
		{models.ComponentTypeRedis, LangfuseRedisContainerName},
		{models.ComponentTypeMinio, LangfuseMinioContainerName},
	}
	observabilityImageComponents = []imageComponent{
		{models.ComponentTypeGrafana, GrafanaContainerName},
		{models.ComponentTypeOtel, OpenTelemetryContainerName},
		{models.ComponentTypeVictoriametrics, VictoriaMetricsContainerName},
		{models.ComponentTypeLoki, LokiContainerName},
		{models.ComponentTypeJaeger, JaegerContainerName},
		// clickstore is the ClickHouse server Jaeger stores traces in, and it is a
		// different component from `clickhouse`, which is Langfuse's. The two run
		// the same image and belong to different stacks.
		{models.ComponentTypeClickstore, ClickstoreContainerName},
		{models.ComponentTypeCadvisor, CadvisorContainerName},
		{models.ComponentTypeNodeExporter, NodeExporterContainerName},
	}
)

// stackGate decides how a stack's components are reported.
//
// A stack pointing at an external address has no local images to describe, so its
// components are reported as connected and carry no image data. A stack that is not
// configured at all is not reported: "unused" would spend one of the thirty slots saying
// nothing.
type stackGate struct {
	connected bool
	external  bool
}

func (g stackGate) skip() bool       { return !g.connected }
func (g stackGate) isExternal() bool { return g.external }

// gatherComponents builds the component list for an update check.
//
// Anything that cannot be described completely is left out rather than guessed at: a
// component with an unknown architecture, or an image the daemon will not describe, would
// fail the contract's validation and take the whole request down with it — costing the
// answer for every other component too.
// reportedComponents is what one update check says about this machine. Images and
// files are separate all the way through: an image is identified by a registry
// reference and a digest, a file by a version and a hash, and no artefact is both.
type reportedComponents struct {
	images []models.ImageComponentInfo
	files  []models.FileComponentInfo
}

func (r reportedComponents) total() int { return len(r.images) + len(r.files) }

func (h *defaultCheckHandler) gatherComponents(ctx context.Context, c *CheckResult) reportedComponents {
	var reported reportedComponents

	// The pentagi stack is always reported: it is the product itself, with no external
	// alternative to point at.
	reported.images = append(reported.images,
		h.imageComponents(ctx, pentagiImageComponents, stackGate{connected: true})...)

	if worker := h.workerComponent(ctx, c); worker != nil {
		reported.images = append(reported.images, *worker)
	}
	if installer := h.installerComponent(); installer != nil {
		reported.files = append(reported.files, *installer)
	}

	reported.images = append(reported.images, h.imageComponents(ctx, graphitiImageComponents,
		stackGate{connected: c.GraphitiConnected, external: c.GraphitiExternal})...)
	reported.images = append(reported.images, h.imageComponents(ctx, langfuseImageComponents,
		stackGate{connected: c.LangfuseConnected, external: c.LangfuseExternal})...)

	observability := stackGate{connected: c.ObservabilityConnected, external: c.ObservabilityExternal}
	reported.images = append(reported.images, h.imageComponents(ctx, observabilityImageComponents, observability)...)
	reported.files = append(reported.files, h.jaegerPluginComponents(observability)...)

	return h.enforceComponentLimit(reported)
}

// enforceComponentLimit trims the report to what the server accepts, naming what it
// dropped.
//
// The limit is on the SUM of both lists — that is how the server counts it, and
// bounding each separately would build a request the server rejects whole.
func (h *defaultCheckHandler) enforceComponentLimit(reported reportedComponents) reportedComponents {
	if reported.total() <= maxReportedComponents {
		return reported
	}

	var dropped []string
	// Files are trimmed first o
```

### Core Architecture Module: `backend/cmd/installer/checker/helpers.go`
```
package checker

import (
	"bufio"
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"pentagi/cmd/installer/state"

	"github.com/moby/moby/client"
)

type DockerVersion struct {
	Version string
	Valid   bool
}

type ImageInfo struct {
	Name string
	Tag  string
	Hash string
}

func checkFileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

func checkFileIsReadable(path string) bool {
	file, err := os.Open(path)
	if err != nil {
		return false
	}
	defer file.Close()
	return true
}

// checkDirIsWritable checks if we can write to a directory
func checkDirIsWritable(dirPath string) bool {
	// try to create a temporary file in the directory
	tempFile, err := os.CreateTemp(dirPath, ".pentagi_test_*")
	if err != nil {
		return false
	}
	tempPath := tempFile.Name()
	tempFile.Close()

	// clean up the test file
	os.Remove(tempPath)
	return true
}

func getEnvVar(appState state.State, key, defaultValue string) string {
	if appState == nil {
		return defaultValue
	}

	if envVar, exist := appState.GetVar(key); exist && envVar.Value != "" {
		return envVar.Value
	} else if envVar.Default != "" {
		return envVar.Default
	}

	return defaultValue
}

// getProxyURL retrieves the proxy URL from application state if configured
func getProxyURL(appState state.State) string {
	if appState == nil {
		return ""
	}
	return getEnvVar(appState, "PROXY_URL", "")
}

func createDockerClient(host, certPath string, tlsVerify bool) (*client.Client, error) {
	var opts []client.Opt

	if host != "" {
		opts = append(opts, client.WithHost(host))
	}

	if tlsVerify && certPath != "" {
		opts = append(opts, client.WithTLSClientConfig(
			filepath.Join(certPath, "ca.pem"),
			filepath.Join(certPath, "cert.pem"),
			filepath.Join(certPath, "key.pem"),
		))
	}

	return client.New(opts...)
}

// createDockerClientFromEnv creates a docker client and returns the error type
func createDockerClientFromEnv(ctx context.Context) (*client.Client, DockerErrorType) {
	// first check if docker command exists
	_, err := exec.LookPath("docker")
	if err != nil {
		return nil, DockerErrorNotInstalled
	}

	cli, err := client.New(client.FromEnv)
	if err != nil {
		return nil, DockerErrorAPIError
	}

	// try to ping the daemon
	_, err = cli.Ping(ctx, client.PingOptions{NegotiateAPIVersion: true})
	if err != nil {
		cli.Close() // close client on error
		// check if it's a connection error (daemon not running)
		if strings.Contains(err.Error(), "Cannot connect to the Docker daemon") ||
			strings.Contains(err.Error(), "Is the docker daemon running") ||
			strings.Contains(err.Error(), "connection refused") ||
			strings.Contains(err.Error(), "no such host") ||
			strings.Contains(err.Error(), "dial unix") {
			return nil, DockerErrorNotRunning
		}
		// check for permission errors
		if strings.Contains(err.Error(), "permission denied") ||
			strings.Contains(err.Error(), "Got permission denied") {
			return nil, DockerErrorPermission
		}
		// other API errors
		return nil, DockerErrorAPIError
	}

	return cli, DockerErrorNone
}

type DockerErrorType string

// DockerErrorType constants
const (
	DockerErrorNone         DockerErrorType = ""
	DockerErrorNotInstalled DockerErrorType = "not_installed"
	DockerErrorNotRunning   DockerErrorType = "not_running"
	DockerErrorAPIError     DockerErrorType = "api_error"
	DockerErrorPermission   DockerErrorType = "permission"
)

func checkDockerVersion(ctx context.Context, cli *client.Client) DockerVersion {
	version, err := cli.ServerVersion(ctx, client.ServerVersionOptions{})
	if err != nil {
		return DockerVersion{Version: "", Valid: false}
	}

	versionStr := version.Version
	valid := checkVersionCompatibility(versionStr, "20.0.0")

	return DockerVersion{Version: versionStr, Valid: valid}
}

func checkDockerCliVersion() DockerVersion {
	_, err := exec.LookPath("docker")
	if err != nil {
		return DockerVersion{Version: "", Valid: false}
	}

	cmd := exec.Command("docker", "version", "--format", "{{.Client.Version}}")
	output, err := cmd.Output()
	if err != nil && len(output) == 0 {
		return DockerVersion{Version: "", Valid: false}
	}

	versionStr := extractVersionFromOutput(string(output))
	valid := checkVersionCompatibility(versionStr, "20.0.0")

	return DockerVersion{Version: versionStr, Valid: valid}
}

func checkDockerComposeVersion() DockerVersion {
	return checkDockerComposeVersionWithRunner(func(name string, args ...string) ([]byte, error) {
		return exec.Command(name, args...).Output()
	})
}

func checkDockerComposeVersionWithRunner(run func(name string, args ...string) ([]byte, error)) DockerVersion {
	output, err := run("docker", "compose", "version")
	if err != nil && len(output) == 0 {
		return DockerVersion{Version: "", Valid: false}
	}

	versionStr := extractVersionFromOutput(string(output))
	valid := checkVersionCompatibility(versionStr, "1.25.0")

	return DockerVersion{Version: versionStr, Valid: valid}
}

func extractVersionFromOutput(output string) string {
	re := regexp.MustCompile(`v?(\d+\.\d+\.\d+)`)
	matches := re.FindStringSubmatch(output)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}

func checkVersionCompatibility(version, minVersion string) bool {
	if version == "" || minVersion == "" {
		return false
	}

	versionParts := strings.Split(version, ".")
	minVersionParts := strings.Split(minVersion, ".")

	for i := 0; i < len(versionParts) && i < len(minVersionParts); i++ {
		v, err1 := strconv.Atoi(versionParts[i])
		minV, err2 := strconv.Atoi(minVersionParts[i])

		if err1 != nil || err2 != nil {
			return false
		}

		if v > minV {
			return true
		}
		if v < minV {
			return false
		}
	}

	return len(versionParts) >= len(minVersionParts)
}

func checkContainerExists(ctx context.Context, cli *client.Client, name string) (exists, running bool) {
	containers, err := cli.ContainerList(ctx, client.ContainerListOptions{All: true})
	if err != nil {
		return false, false
	}

	for _, cont := range containers.Items {
		for _, containerName := range cont.Names {
			if strings.TrimPrefix(containerName, "/") == name {
				return true, cont.State == "running"
			}
		}
	}

	return false, false
}

// checkVolumesExist checks if any of the specified volumes exist
// it matches both exact names and volumes with compose project prefix (e.g., "pentagi_pentagi-data")
func checkVolumesExist(ctx context.Context, cli *client.Client, volumeNames []string) bool {
	if cli == nil || len(volumeNames) == 0 {
		return false
	}

	volumes, err := cli.VolumeList(ctx, client.VolumeListOptions{})
	if err != nil {
		return false
	}

	// collect all volume names from Docker
	existingVolumes := make([]string, 0, len(volumes.Items))
	for _, vol := range volumes.Items {
		existingVolumes = append(existingVolumes, vol.Name)
	}

	// check if any of the requested volumes exist
	// matches both exact names and volumes with compose prefix (project_volume-name)
	for _, volumeName := range volumeNames {
		for _, existingVolume := range existingVolumes {
			// exact match or suffix match with underscore separator
			if existingVolume == volumeName || strings.HasSuffix(existingVolume, "_"+volumeName) {
				return true
			}
		}
	}

	return false
}

func checkCPUResources() bool {
	return runtime.NumCPU() >= 2
}

// determineComponentNeeds checks which components need to be started based on their status
func determineComponentNeeds(c *CheckResult) (needsForPentagi, needsForGraphiti, needsForLangfuse, needsForObservability bool) {
	needsForPentagi = !c.PentagiRunning
	needsForGraphiti = c.GraphitiConnected && !c.GraphitiExternal && !c.GraphitiRunning
	needsForLangfuse = c.LangfuseConnected && !c.LangfuseExternal && !c.LangfuseRunning
	needsForObservability = c.ObservabilityConnected && !c.ObservabilityExternal && !c.ObservabilityRunning
	return
}

// calculateRequiredMemoryGB calculates the total memory required based on which components need to be start
```

### Core Architecture Module: `backend/cmd/installer/checker/product_info.go`
```
package checker

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"time"

	"pentagi/cmd/installer/wizard/logger"

	"github.com/moby/moby/api/pkg/stdcopy"
	"github.com/moby/moby/client"
	"github.com/vxcontrol/cloud/models"
)

// productInfoCommand asks the running product to describe its own state.
const productInfoBinary = "/opt/pentagi/bin/pentagi"

// productInfoTimeout bounds the whole exchange.
//
// This is an optional extra on a gathering the user is waiting for. A product
// that does not answer promptly costs nothing beyond a missing field, and must
// never cost the update check itself.
const productInfoTimeout = 20 * time.Second

// maxProductInfoBytes bounds what is read back.
//
// The contract that carries this field refuses anything larger, so reading more
// would only build a request the service rejects whole — losing the answer for
// every component along with it.
//
// It is the contract's own constant rather than a number that agrees with it
// today. This was written as 64 KiB against a 16 KiB contract: a product whose
// description landed in between passed every check here and cost the installation
// the answer for all of its components, and the local test could not see it
// because it measured against this same constant.
const maxProductInfoBytes = models.MaxProductInfoBytes

// gatherProductInfo asks the running product for its state and returns it exactly
// as it was given.
//
// Nothing here interprets the document. It is read, checked for being JSON at
// all, and carried on; whoever consumes it decides what it means. That is not
// laziness — the installer and the product are released separately, so anything
// the installer understood about the shape would become a second place to update
// whenever the product learns to describe more of itself.
//
// Every failure is silent by design and returns nil: no container, an older build
// without the flag, a product that cannot reach its own database, output that is
// not JSON. The update check proceeds without the field, exactly as it did before
// the field existed.
func (h *defaultCheckHandler) gatherProductInfo(ctx context.Context) json.RawMessage {
	if h.dockerClient == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(ctx, productInfoTimeout)
	defer cancel()

	container, err := h.dockerClient.ContainerInspect(ctx, PentagiContainerName, client.ContainerInspectOptions{})
	if err != nil {
		return nil
	}
	if container.Container.State == nil || !container.Container.State.Running {
		// A stopped product cannot describe itself, and the description of a
		// stopped product would not be the one anybody wants anyway.
		return nil
	}

	exec, err := h.dockerClient.ExecCreate(ctx, PentagiContainerName, client.ExecCreateOptions{
		Cmd:          []string{productInfoBinary, "-info"},
		AttachStdout: true,
		AttachStderr: true,
	})
	if err != nil {
		logger.Debugf("product state: exec create failed: %v", err)
		return nil
	}

	attached, err := h.dockerClient.ExecAttach(ctx, exec.ID, client.ExecAttachOptions{})
	if err != nil {
		logger.Debugf("product state: exec attach failed: %v", err)
		return nil
	}
	defer attached.Close()

	// The stream is MULTIPLEXED. Without a TTY the daemon frames every chunk with
	// an eight-byte header saying which stream it came from and how long it is, so
	// reading the socket directly yields JSON with binary interleaved through it —
	// and the first header lands in front of the opening brace, which makes even a
	// perfectly good document unparsable.
	var stdout, stderr bytes.Buffer
	if _, err := stdcopy.StdCopy(
		&stdout,
		&stderr,
		io.LimitReader(attached.Reader, maxProductInfoBytes+1),
	); err != nil {
		logger.Debugf("product state: reading the answer failed: %v", err)
		return nil
	}

	// The exit code decides whether the output is an answer or the remains of one.
	// A truncated document that happens to parse would be worse than no document.
	inspected, err := h.dockerClient.ExecInspect(ctx, exec.ID, client.ExecInspectOptions{})
	if err == nil && inspected.ExitCode != 0 {
		logger.Debugf("product state: the product exited with %d", inspected.ExitCode)
		return nil
	}

	return productInfoFromOutput(stdout.Bytes())
}

// productInfoFromOutput decides whether what came back is a document.
//
// Separate from the exchange above so that the decision can be exercised without
// a container: everything that makes this fail in practice — an older build
// printing usage, a half-written answer, an answer larger than the contract
// accepts — is a property of the bytes, not of the daemon.
func productInfoFromOutput(output []byte) json.RawMessage {
	answer := bytes.TrimSpace(output)
	if len(answer) == 0 || len(answer) > maxProductInfoBytes {
		return nil
	}
	if !json.Valid(answer) {
		// An older build has no such flag and prints its usage, or nothing at all.
		// Either way there is no document here.
		return nil
	}

	return json.RawMessage(answer)
}

```

### Core Architecture Module: `backend/cmd/installer/checker/updates.go`
```
package checker

import (
	"context"
	"errors"
	"runtime"
	"strings"
	"time"

	"pentagi/cmd/installer/cloud"
	"pentagi/cmd/installer/state"
	"pentagi/cmd/installer/wizard/logger"

	"github.com/vxcontrol/cloud/models"
)

// StackUpdate is what the update server said about one product stack.
//
// HasUpdate is the stack-level verdict and the only thing the menu needs. Everything else
// is for the screen that explains the update before it is applied: which version is
// current, which is offered, and what the release says about the difference.
type StackUpdate struct {
	Stack          string `json:"stack" yaml:"stack"`
	HasUpdate      bool   `json:"has_update" yaml:"has_update"`
	CurrentVersion string `json:"current_version,omitempty" yaml:"current_version,omitempty"`
	LatestVersion  string `json:"latest_version,omitempty" yaml:"latest_version,omitempty"`
	// CurrentVersionMixed says the stack's components came from DIFFERENT releases, so
	// CurrentVersion names the oldest of them rather than a version this installation as
	// a whole ever was. Legitimate — a component nobody rebuilt stays on its old release
	// — but "you are on 2.1.0" and "the oldest thing you have is from 2.1.0" are
	// different sentences and the overview must not print the first when it means the
	// second.
	CurrentVersionMixed bool `json:"current_version_mixed,omitempty" yaml:"current_version_mixed,omitempty"`
	// Changelog and ReleaseNotes carry the TARGET release's text only. They are the
	// fallback for a server that predates Releases; when Releases is present its last
	// entry carries the same text.
	Changelog    string `json:"changelog,omitempty" yaml:"changelog,omitempty"`
	ReleaseNotes string `json:"release_notes,omitempty" yaml:"release_notes,omitempty"`
	// Releases is every curated release this update crosses, oldest first, the last one
	// being the target. Empty when the server did not send any — either it is older than
	// the field, or there is genuinely nothing to cross.
	Releases []ReleaseSummary `json:"releases,omitempty" yaml:"releases,omitempty"`
	// ReleasesTruncated says older entries were dropped by the server.
	ReleasesTruncated bool `json:"releases_truncated,omitempty" yaml:"releases_truncated,omitempty"`
	// Resolution says HOW the server arrived at this answer — release, channel,
	// ahead_of_release, no_artifact_for_tag, not_tracked. It is DIAGNOSTIC ONLY:
	// nothing here may branch on it, and it exists so `has_update: false` can be
	// read in a log instead of guessed at.
	Resolution string            `json:"resolution,omitempty" yaml:"resolution,omitempty"`
	Components []ComponentUpdate `json:"components,omitempty" yaml:"components,omitempty"`
}

// ReleaseSummary is one curated release crossed by applying an update.
type ReleaseSummary struct {
	Version      string `json:"version" yaml:"version"`
	IsStable     bool   `json:"is_stable" yaml:"is_stable"`
	ReleasedAt   string `json:"released_at,omitempty" yaml:"released_at,omitempty"`
	Changelog    string `json:"changelog,omitempty" yaml:"changelog,omitempty"`
	ReleaseNotes string `json:"release_notes,omitempty" yaml:"release_notes,omitempty"`
}

// ComponentUpdate is one artefact inside a stack, and what would change for it.
//
// Being listed does NOT mean the artefact is outdated. Under the stable strategy the
// answer names every artefact of the release that matches something reported, so the
// installation can be attributed to a version even when nothing needs doing. Outdated is
// the conclusion drawn here by comparing digests.
type ComponentUpdate struct {
	Component  string `json:"component" yaml:"component"`
	OS         string `json:"os" yaml:"os"`
	Arch       string `json:"arch" yaml:"arch"`
	Repository string `json:"repository,omitempty" yaml:"repository,omitempty"`
	Tag        string `json:"tag,omitempty" yaml:"tag,omitempty"`

	// Action is what the SERVER says to do — current, install, upgrade,
	// downgrade or unknown — and it is the authority. Membership in the answer
	// is not: under a curated release every artefact matching a reported
	// component is listed, whether or not it differs from what is installed.
	//
	// Reason explains an `unknown`, and is empty for every other action. It is
	// the difference between "nothing to do" and "we publish nothing for what you
	// are running", which are opposite situations that used to arrive identically.
	Action string `json:"action,omitempty" yaml:"action,omitempty"`
	Reason string `json:"reason,omitempty" yaml:"reason,omitempty"`
	// PullReference is what to write into the compose variable before pulling,
	// ready to use. It is NOT always `repository:tag` — which tag to pull is the
	// cloud's decision and varies with the update strategy, so composing one here
	// out of the repository and tag fields would override the answer with a guess.
	PullReference string `json:"pull_reference,omitempty" yaml:"pull_reference,omitempty"`

	// Outdated is true only when the installed artefact is known AND differs from the
	// offered one.
	Outdated bool `json:"outdated" yaml:"outdated"`
	// Verifiable is false when there is nothing on THIS side to compare: nothing is
	// installed yet, or the server answered `unknown` and there is no artefact at all. An
	// unverifiable component is not a mismatch, and saying so is the difference between
	// "this will change" and "we cannot tell".
	//
	// It says nothing about whether the ANSWER carried a digest we can match — the server
	// compared against what we reported and its action is the authority either way.
	Verifiable     bool   `json:"verifiable" yaml:"verifiable"`
	CurrentVersion string `json:"current_version,omitempty" yaml:"current_version,omitempty"`

	// TargetVersion is the VERSION of the offered artefact, and only that. Files have
	// one; images do not (the cloud identifies their builds by digest), so it stays empty
	// for them. It is what the self-update download asks for as `?version=`.
	TargetVersion string `json:"target_version,omitempty" yaml:"target_version,omitempty"`

	// TargetDigest is the sha256 an updated artefact should end up carrying, in the same
	// identity the installed side reports: the config digest for an image, the file hash
	// for a file.
	//
	// Separate from TargetVersion because the two are not interchangeable and were once
	// the same field. Post-update verification compares this against what is on disk, and
	// with a version in it the Jaeger plugin — which has a hash and no version at all —
	// reported a mismatch after every successful update: "expected 0.13.0, got a423c6…".
	//
	// Empty means the cloud did not name a digest, and verification degrades to "nothing
	// to compare" rather than inventing a mismatch.
	TargetDigest string `json:"target_digest,omitempty" yaml:"target_digest,omitempty"`
}

// InstalledComponent is what the last update check reported about one artefact on this
// machine. It is kept because verifying an update afterwards needs to know what was
// installed, and re-inspecting every container a second time would ask Docker the same
// questions the check already asked.
type InstalledComponent struct {
	Component  string `json:"component" yaml:"component"`
	OS         string `json:"os" yaml:"os"`
	Arch       string `json:"arch" yaml:"arch"`
	Status     string `json:"status" yaml:"status"`
	Repository string `json:"repository,omitempty" yaml:"repository,omitempty"`
	Tag        string `json:"tag,omitempty" yaml:"tag,omitempty"`
	// Digest is the image config digest, or the file digest for components that ship as
	// files. Empty when nothing observable was installed.
	Digest  string `json:"digest,omitempty" yaml:"digest,omitempty"`
	Version string `json:"version,omitempty" yaml:"version,omitempty"`
}

// UpdateCheckFailure explains why the update check produced no answer, in terms the
// interface can act on. A bare "server unavailable" tells the user nothing they can do
// about it — a spent daily quota and a broken proxy call for oppo
```

### Core Architecture Module: `backend/cmd/installer/cloud/client.go`
```
// Package cloud is the installer's client for the PentAGI Cloud API: update checks and
// package downloads.
//
// It is a thin layer over the published SDK. Wire types come from the SDK's models package
// rather than being redeclared here, so a contract change is a compile error instead of a
// silent mismatch, and the whole package is free of installer state — it takes a Config,
// returns answers, and knows nothing about the wizard, the checker or the processor. Tests
// substitute the call functions directly; nothing here needs a server to exercise.
package cloud

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/vxcontrol/cloud/sdk"
	"github.com/vxcontrol/cloud/system"
)

// DefaultHost is the update server used when none is configured.
const DefaultHost = "update.pentagi.com"

// Route names and paths are part of the API contract: the server dispatches on the name,
// and a name it does not know is refused outright rather than reported as a missing page.
const (
	routeUpdatesCheck     = "updates_check"
	routePackagesInfo     = "packages_info"
	routePackagesDownload = "packages_download"

	pathUpdatesCheck     = "/api/v1/proxy/updates/check"
	pathPackagesInfo     = "/api/v1/proxy/packages/info"
	pathPackagesDownload = "/api/v1/proxy/packages/download"
)

const (
	// clientName identifies the installer in the User-Agent, alongside its build version.
	clientName = "PentAGI-Installer"

	// powTimeout is the budget for the proof-of-work challenge each call has to solve.
	// It is raised well above the SDK default because the SDK does not retry a timed-out
	// challenge, and a laptop or a throttled VM can genuinely need the extra seconds.
	powTimeout = 60 * time.Second

	maxRetries = 3
)

// Config describes how to reach the update server. Every field is optional; the zero
// Config talks to DefaultHost anonymously, with no proxy.
type Config struct {
	// Host is the update server, with or without a scheme (UPDATE_SERVER_HOST).
	Host string
	// ProxyURL is the installer's own proxy (PROXY_URL), used for every call. It takes
	// precedence over the environment, which is what the user configured it for.
	ProxyURL string
	// LicenseKey is the PentAGI license key (LICENSE_KEY). An unusable key is dropped
	// rather than sent, and reported through LicenseWarning.
	LicenseKey string
	// InstallerVersion is this build's version, as displayed. It is normalised for the
	// request and sent verbatim in the User-Agent.
	InstallerVersion string
	// Logger receives the SDK's own diagnostics. Nil keeps them silent.
	Logger sdk.Logger
}

// Client talks to the update server. Build one with New.
type Client struct {
	checkUpdates    sdk.CallReqBytesRespBytes
	packageInfo     sdk.CallReqQueryRespBytes
	downloadPackage sdk.CallReqQueryRespWriter

	host           string
	version        string
	licenseWarning error
}

// New builds a client for cfg.
//
// It fails only on configuration that cannot produce working calls — an unusable host or
// proxy. A license key that does not hold up is deliberately not fatal: the update check is
// the one thing that still works without a license, and refusing to run would leave the
// user with no way to learn that their key is the problem. The key is dropped and the
// reason is available from LicenseWarning.
func New(cfg Config) (*Client, error) {
	host, err := NormalizeHost(cfg.Host)
	if err != nil {
		return nil, err
	}

	transport, err := newTransport(cfg.ProxyURL)
	if err != nil {
		return nil, err
	}

	client := &Client{
		host:    host,
		version: NormalizeVersion(cfg.InstallerVersion),
	}

	userAgentVersion := strings.TrimSpace(cfg.InstallerVersion)
	if userAgentVersion == "" {
		userAgentVersion = UnknownVersion
	}

	options := []sdk.Option{
		sdk.WithTransport(transport),
		// The installation ID identifies this machine to the server across calls, and the
		// contract requires it on every one of them.
		sdk.WithInstallationID(system.GetInstallationID()),
		sdk.WithClient(clientName, userAgentVersion),
		sdk.WithPowTimeout(powTimeout),
		sdk.WithMaxRetries(maxRetries),
	}
	if cfg.Logger != nil {
		options = append(options, sdk.WithLogger(cfg.Logger))
	}

	// Validate before handing the key over: the SDK drops a key it cannot decode without
	// saying so, and the call then runs anonymously — which looks, from the outside, like
	// the license simply not being honoured.
	if key := strings.TrimSpace(cfg.LicenseKey); key != "" {
		if _, err := sdk.IntrospectLicenseKey(key); err != nil {
			client.licenseWarning = fmt.Errorf("license key is not usable, continuing without it: %w", err)
		} else {
			options = append(options, sdk.WithLicenseKey(key))
		}
	}

	configs := []sdk.CallConfig{
		{
			Calls:  []any{&client.checkUpdates},
			Host:   host,
			Name:   routeUpdatesCheck,
			Path:   pathUpdatesCheck,
			Method: sdk.CallMethodPOST,
		},
		{
			Calls:  []any{&client.packageInfo},
			Host:   host,
			Name:   routePackagesInfo,
			Path:   pathPackagesInfo,
			Method: sdk.CallMethodGET,
		},
		{
			Calls:  []any{&client.downloadPackage},
			Host:   host,
			Name:   routePackagesDownload,
			Path:   pathPackagesDownload,
			Method: sdk.CallMethodGET,
		},
	}

	if err := sdk.Build(configs, options...); err != nil {
		return nil, fmt.Errorf("failed to build update client: %w", err)
	}

	return client, nil
}

// Host reports the normalised update server this client talks to.
func (c *Client) Host() string { return c.host }

// InstallerVersion reports the version this client sends, after normalisation. It differs
// from the displayed build version whenever that one cannot be expressed as a version
// number.
func (c *Client) InstallerVersion() string { return c.version }

// LicenseWarning reports why the configured license key was not used, or nil when it was
// used or none was configured. Calls still work — anonymously.
func (c *Client) LicenseWarning() error { return c.licenseWarning }

// NormalizeHost reduces a configured update server address to the host[:port] form the
// client needs.
//
// The setting has historically held a full URL, so a scheme and a trailing path are
// tolerated and stripped. The transport is always TLS, so an explicit "http://" is an
// error rather than something to silently upgrade — a user who wrote it meant it, and
// quietly doing the opposite would hide a misconfiguration.
func NormalizeHost(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return DefaultHost, nil
	}

	if scheme, rest, found := strings.Cut(value, "://"); found {
		switch strings.ToLower(scheme) {
		case "https":
			value = rest
		case "http":
			return "", fmt.Errorf("update server %q uses http, but the connection is always encrypted: use https", raw)
		default:
			return "", fmt.Errorf("update server %q uses unsupported scheme %q", raw, scheme)
		}
	}

	// Drop anything after the authority: a path, a query, a fragment.
	value, _, _ = strings.Cut(value, "/")
	value, _, _ = strings.Cut(value, "?")
	value, _, _ = strings.Cut(value, "#")
	value = strings.ToLower(strings.TrimSpace(value))

	switch {
	case value == "":
		return "", fmt.Errorf("update server %q has no host", raw)
	case strings.Contains(value, "@"):
		return "", fmt.Errorf("update server %q carries credentials, which are not supported", raw)
	case strings.ContainsAny(value, " \t"):
		return "", fmt.Errorf("update server %q contains whitespace", raw)
	}

	return value, nil
}

// newTransport builds the transport every call uses.
//
// The SDK's default reads the proxy from the environment. The installer keeps its own
// proxy setting — often with credentials the environment does not carry — and that setting
// has to win. With none configured the environment behaviour is left as it is.
func newTransport(proxyURL string) (*http.Transport, error) {
	transport := sdk.DefaultTransport()

	value := strings.TrimSpace(proxyURL)
	if value == "" {
		return transport, nil
	}

	parsed, err := url.Parse(value)
	if err != n
```

### Core Architecture Module: `backend/cmd/installer/cloud/errors.go`
```
package cloud

import (
	"context"
	"errors"
	"time"

	"github.com/vxcontrol/cloud/sdk"
)

// FailureReason classifies why a call to the update server did not produce an answer.
//
// The distinction matters to the user, not just to the log: "the server is unreachable"
// invites checking the network, "the daily quota is spent" invites coming back tomorrow,
// and "this request was refused" means retrying will never help. Collapsing all of them
// into one "update server unavailable" flag — as the installer used to — tells the user
// nothing they can act on.
type FailureReason string

const (
	// FailureNone is the zero value: no failure.
	FailureNone FailureReason = ""
	// FailureUnreachable covers everything that never reached a verdict: no network, no
	// DNS, a proxy that refused, a connection that died mid-flight.
	FailureUnreachable FailureReason = "unreachable"
	// FailureTimeout is a deadline: either the caller's, or the proof-of-work challenge
	// taking longer than the budget on slow hardware.
	FailureTimeout FailureReason = "timeout"
	// FailureRateLimited means too many requests in a rolling window. RetryAfter says when
	// the window reopens.
	FailureRateLimited FailureReason = "rate_limited"
	// FailureQuotaExceeded means the allowance for the period is spent. RetryAfter says
	// when it resets.
	FailureQuotaExceeded FailureReason = "quota_exceeded"
	// FailureForbidden means this client is not allowed to make this call at all — a
	// license tier without the endpoint, or a temporarily blocked client. Retrying does
	// not help; the license does.
	FailureForbidden FailureReason = "forbidden"
	// FailureNotFound means the server has no such package or version. It is an answer,
	// not an outage.
	FailureNotFound FailureReason = "not_found"
	// FailureRejected means the server refused the request as malformed. That is our bug,
	// not the user's, and retrying an identical request cannot succeed.
	FailureRejected FailureReason = "rejected"
	// FailureServerError means the server failed on its side. Worth retrying later.
	FailureServerError FailureReason = "server_error"
)

// Retryable reports whether waiting and trying again could plausibly succeed.
func (r FailureReason) Retryable() bool {
	switch r {
	case FailureUnreachable, FailureTimeout, FailureRateLimited,
		FailureQuotaExceeded, FailureServerError:
		return true
	default:
		return false
	}
}

// Failure is a classified call error. It wraps the original, so errors.Is and errors.As
// against the SDK sentinels keep working on it.
type Failure struct {
	Reason FailureReason
	// RetryAfter is the server-advertised cooldown, zero when the server did not say.
	RetryAfter time.Duration
	Err        error
}

func (f *Failure) Error() string { return f.Err.Error() }

func (f *Failure) Unwrap() error { return f.Err }

// Classify maps an SDK error onto a reason the interface can act on. It returns nil for a
// nil error, so it can wrap a call result directly.
//
// Ordering matters here: the typed errors are checked before the sentinels they wrap,
// because that is where the Retry-After cooldown lives.
func Classify(err error) *Failure {
	if err == nil {
		return nil
	}

	var quotaErr *sdk.QuotaError
	if errors.As(err, &quotaErr) {
		// A blocked scope is not an exhausted allowance — the tier never had access, so
		// there is nothing to wait for.
		if quotaErr.Scope == sdk.QuotaScopeBlocked {
			return &Failure{Reason: FailureForbidden, Err: err}
		}
		return &Failure{Reason: FailureQuotaExceeded, RetryAfter: sdk.RetryAfterOf(err), Err: err}
	}

	var rateLimitErr *sdk.RateLimitError
	if errors.As(err, &rateLimitErr) {
		return &Failure{Reason: FailureRateLimited, RetryAfter: sdk.RetryAfterOf(err), Err: err}
	}

	switch {
	case errors.Is(err, sdk.ErrForbidden), errors.Is(err, sdk.ErrBlocked):
		return &Failure{Reason: FailureForbidden, Err: err}

	case errors.Is(err, sdk.ErrNotFound):
		return &Failure{Reason: FailureNotFound, Err: err}

	// A rejected request means we built it wrong. The replay and signature errors land
	// here too: both mean the server refused what we sent, and resending it is futile.
	case errors.Is(err, sdk.ErrBadRequest),
		errors.Is(err, sdk.ErrInvalidRequest),
		errors.Is(err, sdk.ErrInvalidConfiguration),
		errors.Is(err, sdk.ErrInvalidSignature),
		errors.Is(err, sdk.ErrReplayAttack):
		return &Failure{Reason: FailureRejected, Err: err}

	case errors.Is(err, sdk.ErrServerInternal), errors.Is(err, sdk.ErrBadGateway):
		return &Failure{Reason: FailureServerError, Err: err}

	// The proof-of-work budget is not retried by the SDK, so a client on slow hardware
	// has to be told what happened rather than shown a generic network error.
	case errors.Is(err, context.DeadlineExceeded),
		errors.Is(err, sdk.ErrExperimentTimeout),
		errors.Is(err, sdk.ErrPoWFailed):
		return &Failure{Reason: FailureTimeout, Err: err}

	default:
		return &Failure{Reason: FailureUnreachable, Err: err}
	}
}

```

### Core Architecture Module: `backend/cmd/installer/cloud/packages.go`
```
package cloud

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"strings"

	"github.com/vxcontrol/cloud/models"
)

// PackageInfo asks the update server about one downloadable package: its size, its
// sha256 and the signature over it.
//
// The answer is validated before it is returned, because everything DownloadPackage checks
// is taken from it — an unverified description of a file is not a basis for trusting the
// file.
func (c *Client) PackageInfo(
	ctx context.Context,
	req models.PackageInfoRequest,
) (*models.PackageInfoResponse, error) {
	if c == nil || c.packageInfo == nil {
		return nil, fmt.Errorf("update client is not initialized")
	}

	if err := req.Valid(); err != nil {
		return nil, fmt.Errorf("package info request is malformed: %w", err)
	}

	answer, err := c.packageInfo(ctx, req.Query())
	if err != nil {
		return nil, Classify(err)
	}

	response, err := models.ParseEnvelope[models.PackageInfoResponse](answer)
	if err != nil {
		return nil, fmt.Errorf("failed to read package info answer: %w", err)
	}

	if err := response.Valid(); err != nil {
		return nil, fmt.Errorf("package info answer is malformed: %w", err)
	}

	return &response, nil
}

// DownloadPackage streams a package into dst, verifying it against info as the bytes
// arrive.
//
// Three things are checked, and all three describe the file itself: the transport
// encryption is transparent and changes none of them. The length must match info.Size —
// the encrypted response carries no Content-Length, so this is the only length the caller
// ever learns. The sha256 must match info.Hash. The Ed25519 signature must verify against
// the file's SHA-512 digest, which is what makes the package ours rather than merely
// intact.
//
// Verification can only complete once the last byte has been written, so on any error dst
// holds a partial or unverified file. It is the caller's job to discard it — write to a
// file that is only put in place after this returns nil.
func (c *Client) DownloadPackage(
	ctx context.Context,
	req models.DownloadPackageRequest,
	info models.PackageInfoResponse,
	dst io.Writer,
) error {
	if c == nil || c.downloadPackage == nil {
		return fmt.Errorf("update client is not initialized")
	}

	if err := req.Valid(); err != nil {
		return fmt.Errorf("package download request is malformed: %w", err)
	}
	if err := info.Valid(); err != nil {
		return fmt.Errorf("package description is malformed: %w", err)
	}

	digest := sha256.New()
	counter := &countingWriter{}
	// The signature wrapper hashes with SHA-512 on the way through; the tee adds the
	// sha256 and the byte count, so a single pass over the stream feeds all three checks.
	signed := info.Signature.ValidateWrapWriter(io.MultiWriter(dst, digest, counter))

	if err := c.downloadPackage(ctx, req.Query(), signed); err != nil {
		return Classify(err)
	}

	if counter.written != info.Size {
		return fmt.Errorf("package is %d bytes, expected %d", counter.written, info.Size)
	}

	actual := hex.EncodeToString(digest.Sum(nil))
	if !strings.EqualFold(actual, info.Hash) {
		return fmt.Errorf("package sha256 is %s, expected %s", actual, info.Hash)
	}

	if err := signed.Valid(); err != nil {
		return fmt.Errorf("package signature does not verify: %w", err)
	}

	return nil
}

// countingWriter counts the bytes passing through it and discards them; the real
// destination sits alongside it in the MultiWriter.
type countingWriter struct {
	written int64
}

func (w *countingWriter) Write(p []byte) (int, error) {
	w.written += int64(len(p))
	return len(p), nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #402** (2026-09-23): **[Bug]: langfuse-clickhouse — "Too many open files" (errno 24) on queries, get_mempolicy log flood, and MergeMutationsExecutor threads spinning at ~100% CPU with no pending mutations**
  *Symptoms*: ### Affected Component  - [x] Analytics Platform Integration (Langfuse)  ### Describe the bug  The bundled `langfuse-clickhouse` container degrades after running for a while under sustained trace ingestion and eventually makes the Langfuse stack unusable while slowing down the whole host. Observed on two independent deployments (16-core dev host and 4-vCPU production host). Three interrelated symptoms — **plus the root cause, which we identified with live diagnostics and confirmed by fixing it**:  **1. Queries fail with `Too many open files` (errno 24)**  The ClickHouse process runs with the Docker default `nofile` limit of **4096**. Under load, queries exhaust it and fail with errno 24 on data part / skip-index files. The Langfuse trace-*list* endpoint still works, but the trace-*detail* endpoint returns HTTP 500:  ``` {"message":"Internal Server Error","error":"Cannot open file /var/lib/clickhouse/store/61f/61fced17-be34-4b17-b3eb-d044cdca7e4b/202609_407_407_0/skp_idx_idx_project_dataset_run.idx: , errno: 24, strerror: Too many open files. "} ```  This silently breaks any automation that reads trace details (e.g. per-flow usage metrics come back empty).  **2. `MergeMutationsExecutor` threads at ~100% CPU — root cause: infinite retry loop of a failing merge (not an empty-work spin)**  *Correction of our initial reading:* the threads are NOT spinning "with no pending mutations". `top -H` shows two `MergeMutationsExecutor` threads at ~100% CPU while `system.mutations WHERE NOT
  **Post-Mortem & Fix Analysis**:
  > @tavgar validated a solid root-cause analysis here — thanks for the live diagnostics.  I'd like to pick this up so the fix actually lands. Plan:  1. `docker-compose-langfuse.yml`: `ulimits: { nofile: { soft: 262144, hard: 262144 } }` on the clickhouse service (mirrors what `docker-compose-observability.yml` already does for `clickstore`) — the root-cause fix for the errno-24 loop. 2. `langfuse/clickhouse/system-logs.xml` bound to `/etc/clickhouse-server/config.d/system-logs.xml:ro` — bounded TTLs for system log tables + `warning` logger level to stop the debug flood.  I'll keep the diff to those two files, and the PR will credit your analysis (the issue text is already a full postmortem).  One question before I cut the branch: do you want to send the PR yourself? You mentioned it was ready — totally fine either way, I don't want to step on your work. If you'd rather I take it, I can have it up within the hour.
  > This will be fixed in 2.2.0. Closing — comment here if it persists after the upgrade.

- **Issue #392** (2026-09-23): **[Bug]: `DOCKER_DEFAULT_IMAGE_FOR_PENTEST` is not enforced — image selection relies entirely on an unverified LLM response, with no deterministic fallback**
  *Symptoms*: ### Affected Component  External Integrations (LLM/Search APIs)  ### Describe the bug  ## Summary  `DOCKER_DEFAULT_IMAGE_FOR_PENTEST` (and the equivalent `DefaultImageForPentest` template variable) is documented and configured as if it constrains which Docker image PentAGI uses for a flow. In practice, it is only ever injected as text into an LLM prompt (`image_chooser` prompt type). The LLM's raw text response is used directly as the image name, with no validation, no allow-list check, and no deterministic fallback if the model ignores the guidance. With a weaker/smaller model (tested with a local, self-hosted `qwen2.5:7b-instruct` via Ollama), the model reliably ignores the "prefer the pentest image" instruction and returns `node:latest` instead of the intended pentest image, even when the env var is correctly set and even after explicitly strengthening the prompt's wording.  This means `DOCKER_DEFAULT_IMAGE_FOR_PENTEST` currently functions as a *hint*, not a *default* or *constraint*, contrary to what its name and documentation imply.  ## Environment  - PentAGI commit: `879e87c` (pinned, built from clean upstream source — see reproduction steps below) - Deployment: self-hosted Docker Compose, Ubuntu 26.04 host - LLM provider: local Ollama (`qwen2.5:7b-instruct`, ~5.1GB, CPU-only inference) - `DOCKER_DEFAULT_IMAGE_FOR_PENTEST=vxcontrol/kali-linux` (also reproduces with the unset/default value, which per `config.go` defaults to the same image)  ## Steps to reproduce  1. Conf
  **Post-Mortem & Fix Analysis**:
  > This will be fixed in 2.2.0. Closing — comment here if it persists after the upgrade.

- **Issue #383** (2026-08-04): **[Bug]: xAI Grok 4.5 compatibility: HTTP 400 despite valid OpenAI-compatible API**
  *Symptoms*: ### Affected Component  External Integrations (LLM/Search APIs)  ### Describe the bug  Hi,  I'm trying to use PentAGI with xAI Grok 4.5.  Configuration:  OPEN_AI_SERVER_URL=https://api.x.ai/v1  with a valid xAI API key.  I tried both:  OpenAI provider Custom provider  Creating a flow always fails with:  failed to create flow worker: failed to get flow provider: failed to select primary docker image via llm call: API returned unexpected status code: 400  ### Steps to Reproduce  1. Configure an OpenAI-compatible provider with: OPEN_AI_SERVER_URL=https://api.x.ai/v1 A valid xAI API key with access to grok-4.5.  2. Select the configured provider. 3. Create a new flow.  4. Observe that flow creation fails with: ``` failed to create flow worker: failed to get flow provider: failed to select primary docker image via llm call: API returned unexpected status code: 400 ``` I got the same error when i created the custom provider too  ### System Configuration  PentAGI Version: Latest (Docker image: vxcontrol/pentagi:latest)  Deployment Type: Docker Compose  Environment: - Docker Version: 29.7.0 - Docker Compose Version: v5.3.1 - Host OS: Ubuntu 24.04 LTS - Available Resources:   - RAM: 8 GB   - CPU: 4   - Disk Space: 93GB  Enabled Features: Custom LLM Server  Active Integrations: - LLM Provider: OpenAI, Custom  ### Logs and Artifacts  I verified the following:  GET /v1/models works from inside the PentAGI container. POST /v1/chat/completions with model: grok-4.5 works. POST /v1/responses
  **Post-Mortem & Fix Analysis**:
  > closing it, found the solution

- **Issue #378** (2026-09-23): **[Bug]: installer restart fails: "file docker-compose-graphiti.yml does not exist" when Graphiti is disabled**
  *Symptoms*: ### Affected Component  Other (please specify in the description)  ### Describe the bug  When running ./installer restart with GRAPHITI_ENABLED=false in .env, the installer fails with:Failed to stop graphiti compose stack: file /mnt/DataDisk/pentagi/docker-compose-graphiti.yml does not exist Failed to execute %s operation: failed to restart stack: file /mnt/DataDisk/pentagi/docker-compose-graphiti.yml does not exist   ### Steps to Reproduce  1. Download latest installer (v2.0.0-87ac00f)  2. Run ./installer to configure, set Graphiti to disabled  3. Run ./installer restart  4. See error  ### System Configuration  - OS: Ubuntu 26.04 LTS - Architecture: amd64 - Installer version: v2.0.0-87ac00f - Docker: installed   ### Logs and Artifacts  waiting for command: /usr/bin/docker compose --env-file /mnt/DataDisk/pentagi/.env -f /mnt/DataDisk/pentagi/docker-compose-graphiti.yml stop   ### Screenshots or Recordings  <img width="769" height="685" alt="Image" src="https://github.com/user-attachments/assets/38ba4291-1937-4fb8-a3fa-dccac1ccfb92" />  ### Verification  - [x] I have checked that this issue hasn't been already reported - [x] I have provided all relevant configuration files (with sensitive data removed) - [x] I have included relevant logs and error messages - [x] I am running the latest version of PentAGI
  **Post-Mortem & Fix Analysis**:
  > Already fixed in the code: the installer skips compose files that are not there. The fix lives inside the installer binary, and the report came from an older build — the new installer ships with PentAGI 2.2.0, so that build resolves it. Closing; comment here if it still happens on 2.2.0.

- **Issue #375** (2026-09-23): **[Bug]: Unable to use locally deployed Ollama models**
  *Symptoms*: ### Affected Component  External Integrations (LLM/Search APIs)  ### Describe the bug  PentAGI fails to start and cannot use locally deployed Ollama models, due to a hardcoded custom provider validation error requiring an OpenAI API key.（maybe）  I have modified the docker-compose configuration and the .env environment file. Helpppppp!!!!!!!!  ### Steps to Reproduce  1. Pull the official vxcontrol/pentagi docker image (version 2.0.0 / 2.1.0) 2. Create docker-compose.yml and .env files, set environment variables including OPENAI_API_KEY with a dummy key and Ollama local server config 3. Run `docker compose up -d` to start the PentAGI service 4. Observe the container logs: the service crashes repeatedly with the error message: "LLM provider controller initialization failed: failed to create custom provider: missing the OpenAI API key, set it in the OPENAI_API_KEY environment variable" 5. Even after correctly setting OPENAI_API_KEY environment variable and modifying all *.provider.yml config files, the error persists, preventing the service from starting normally and connecting to local Ollama models  ### System Configuration  PentAGI version: v2.1.0-879e87c (official vxcontrol/pentagi docker image), also verified on v2.0.0 Deployment type: - Docker Compose  Environment: - Docker version: 27.x.x - Docker Compose version: v2.x.x - Host OS: Windows 10 / Ubuntu 22.04 - Available resources:   - Memory: 16GB   - CPU: 8 cores - Local Ollama service running on host port 11434 (OpenAI co
  **Post-Mortem & Fix Analysis**:
  > hey @FUA-Studio   you are using wrong variable name `OPENAI_API_KEY`, it should be `OPEN_AI_KEY`  please look at [here](https://github.com/vxcontrol/pentagi#openai-provider-configuration), you should use this variable **only** with original OpenAI provider or reverse proxy to OpenAI provider combined with `OPEN_AI_SERVER_URL`, for any OpenAI-compatible providers please use [custom provider](https://github.com/vxcontrol/pentagi#custom-llm-provider-configuration).  Ollama supported as well, [details here](https://github.com/vxcontrol/pentagi#ollama-provider-configuration)
  > 我需要完整的 .env 以及 Docker Compose的文件内容 大模型为qwen2.5:14b
  > Require full .env and docker-compose.yml configurations, using qwen2.5:14b as the LLM.

- **Issue #360** (2026-09-23): **[Bug]: finishFlow mutation returns "flow not found" when provider name was renamed - flow unloaded from in-memory map at startup**
  *Symptoms*: ### Affected Component  Other (please specify in the description) Backend / Flow Controller  ### Describe the bug  When a model provider is renamed (e.g. `Ollama cloud GLM` -> `OllamaC GLM`), all flows that were created with the old provider name fail to load at service startup. The `LoadFlowWorker` function in `pkg/controller/flow.go` calls `fwc.provs.LoadFlowProvider()`, which returns an error because the provider name no longer exists. The flow is skipped and never added to the `fc.flows` in-memory map (`pkg/controller/flows.go`).  As a result, any subsequent GraphQL mutation or REST API call that looks up the flow in the in-memory map - `finishFlow`, `stopFlow`, `putUserInput`, `callAssistant`, `PUT /flows/{id}` with `action: finish` - returns `ErrFlowNotFound` ("flow not found"), even though the flow exists in the database with status `waiting`.  The flow is therefore permanently stuck: it cannot be finished, stopped, or resumed through the UI or API. Its Docker container keeps running as an orphan.  **Expected behavior:** - Flows with a missing/renamed provider should still be loadable so they can be finished, deleted, or have their provider updated. - Alternatively, `FinishFlow` (and similar mutations) should fall back to loading the flow from DB when it is not found in the in-memory map, so users can at least clean up stuck flows. - At minimum, the error message should distinguish between "flow does not exist in DB" and "flow exists but failed to load" to aid debuggin
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report, @psyray.  Reproduced this on a live local PentAGI instance. The behavior matches your analysis: after a provider is renamed, existing flows that reference the old provider name fail to restore on startup and are not added to the in-memory flow map. Startup logs show the expected failure:  ``` text flow loaded from DB flow_id=1 provider_name=issue-live-old-provider... failed to get flow provider: provider 'issue-live-old-provider...' not found failed to load flow 1 ```  After that, finishFlow returns:  ``` {"errors":[{"message":"flow not found","path":["finishFlow"]}],"data":null} The REST path also returns a generic 500 for PUT /api/v1/flows/{id} with {"action":"finish"}. ```  Also verified the DB workaround you described: updating flows.model_provider_name to an existing provider name and restarting PentAGI allows the flow to load again. After that, finishFlow succeeds and the container is cleaned up.  The issue and workaround are both confirmed. A fix 
  > This will be fixed in 2.2.0. Closing — comment here if it persists after the upgrade.

- **Issue #338** (2026-09-23): **[Bug]: ZIP downloads buffer the entire archive in memory [Introduced in 2.1.0]**
  *Symptoms*: ### Affected Component  Core Services (Frontend UI/Backend API)  ### Describe the bug  What happened: Directory and multi-path ZIP downloads build the **entire** archive in a `bytes.Buffer` and only then send it, so the whole compressed archive is held on the heap before any response byte is written. Combined with the 2 GB upload/pull limits, an authenticated user with default `User`-role resource/flow-file permissions can store (or pull) a large, incompressible directory and request it as a ZIP, forcing the API process to allocate memory proportional to the archive size. A handful of concurrent requests can exhaust process/host memory and crash or severely degrade the API.  Single-file downloads are fine since they stream from disk. Only the directory / multi-path ZIP paths are affected.  WHat should happen: We should probably create the zip writer over the response writer (`zw := zip.NewWriter(c.Writer)`) after setting `Content-Type: application/zip` and `Content-Disposition`, write entries, then `zw.Close()`.   ### Steps to Reproduce  1. As a `User`-role account, upload (or pull from a flow container) a directory of incompressible data. 2. Request the directory (or a multi-path selection) from the ZIP download endpoint. 3. The handler calls `ZipResources` / `ZipDirectory` / `ZipRelativePaths` with a `bytes.Buffer`; resident heap grows to roughly the archive size before the response starts. 4. Issue a few concurrent requests → Go runtime fatal out-of-memory.  A standalone h
  **Post-Mortem & Fix Analysis**:
  > Already available in the current version — closing. Comment here if it does not work that way for you.

- **Issue #337** (2026-09-23): **[Bug]: PentAGI Container Escape via Prompt Injection**
  *Symptoms*: ### Affected Component  AI Agents (Researcher/Developer/...)  ### Describe the bug  # PentAGI Container Escape via Prompt Injection  ## Summary  PentAGI mounts the host Docker socket (`/var/run/docker.sock`) into agent sandbox containers when deployed via Docker Compose, allowing a prompt-injected AI agent to escape its sandbox and execute arbitrary commands on the **host** through the Docker API.  ---  ## Root Cause  In `backend/pkg/docker/client.go:282-284`, when `DOCKER_INSIDE` is true, every per-flow sandbox container is created with the host Docker socket bind-mounted:  ```go if dc.inside {     hostConfig.Binds = append(hostConfig.Binds,         fmt.Sprintf("%s:%s", dc.socket, defaultDockerSocketPath)) } ```  `dc.inside` is controlled by the `DOCKER_INSIDE` environment variable, which defaults to `true` in the shipped `docker-compose.yml`. The `defaultDockerSocketPath` is `/var/run/docker.sock`.  ---  ## Impact  With host Docker socket access, an attacker can:  - **Host compromise**: `docker run --privileged -v /:/host ...` mounts the host root filesystem into a new container, providing full read/write access to the host. - **Lateral movement**: Access to all containers, images, volumes, and networks on the host.  ### Steps to Reproduce  none  ### System Configuration  none  ### Logs and Artifacts  _No response_  ### Screenshots or Recordings  _No response_  ### Verification  - [ ] I have checked that this issue hasn't been already reported - [ ] I have provided all rele
  **Post-Mortem & Fix Analysis**:
  > Sandbox Container: pentagi-terminal-3  │  ├─ /var/run/docker.sock (Successfully mounted, srw-rw----)  │  ├─ POST /containers/create  → Privileged Container with Volume Mount (-v /:/host)  │        └─ 201 Created  ├─ POST /containers/{id}/start → 204 No Content  ├─ POST /containers/{id}/wait  → StatusCode=0  ├─ GET  /containers/{id}/logs  → Host filesystem data exfiltration (Leakage)  └─ DELETE /containers/{id}     → Footprint cleanup / Clearing tracks
  > The sandbox does not receive the Docker socket by default: DOCKER_INSIDE is off. When Docker-in-Docker is genuinely needed, DOCKER_INSIDE_HOST points the sandbox at a separate daemon instead of mounting the host socket, and the guide covers fronting that daemon with authorization. Closing on that basis — comment here if you see the socket reach a sandbox with the defaults in place.  Guide here: https://github.com/vxcontrol/pentagi/blob/main/examples/guides/worker_node.md

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

### Incident Patch 1: `6f3d29c3` (2026-09-25)
**Commit Message**: feat: port major fixes

**File**: `.dockerignore` (modified, +5/-0)
```diff
@@ -14,3 +14,8 @@ frontend/ssl
 !**/.env.example
 **/.DS_Store
 **/Thumbs.db
+
+# locally built helper binaries; the image builds its own
+backend/ctester
+backend/etester
+backend/ftester
```

**File**: `.env.example` (modified, +55/-2)
```diff
@@ -79,6 +79,17 @@ OPEN_AI_SERVER_URL=https://api.openai.com/v1
 ANTHROPIC_API_KEY=
 ANTHROPIC_SERVER_URL=https://api.anthropic.com/v1
 
+## Anthropic Workload Identity Federation, used in place of ANTHROPIC_API_KEY when the key is empty.
+## The token file is read inside the pentagi container on every exchange, so mount it there. A token carrying jti
+## is exchanged only once: the file must hold a new token before each refresh, well within the minted token's lifetime.
+## ANTHROPIC_IDENTITY_TOKEN is read once and cannot be rotated, so it suits only runs shorter than its own lifetime.
+ANTHROPIC_FEDERATION_RULE_ID=
+ANTHROPIC_ORGANIZATION_ID=
+ANTHROPIC_SERVICE_ACCOUNT_ID=
+ANTHROPIC_WORKSPACE_ID=
+ANTHROPIC_IDENTITY_TOKEN_FILE=
+ANTHROPIC_IDENTITY_TOKEN=
+
 ## Google AI (Gemini) LLM provider
 GEMINI_API_KEY=
 GEMINI_SERVER_URL=https://generativelanguage.googleapis.com
@@ -108,24 +119,39 @@ KIMI_API_KEY=
 KIMI_SERVER_URL=https://api.moonshot.ai/v1
 KIMI_PROVIDER=
 
-## Qwen (Alibaba Cloud DashScope) LLM provider
+## Qwen Cloud or Alibaba Cloud Model Studio LLM provider
 QWEN_API_KEY=
 QWEN_SERVER_URL=https://dashscope-us.aliyuncs.com/compatible-mode/v1
+# Gateway prefix: qwen_cloud or dashscope; leave empty for direct DashScope
 QWEN_PROVIDER=
 
 ## MiniMax LLM provider
 MINIMAX_API_KEY=
 MINIMAX_SERVER_URL=https://api.minimax.io/v1
 MINIMAX_PROVIDER=
 
+## Mistral LLM provider
+MISTRAL_API_KEY=
+MISTRAL_SERVER_URL=https://api.mistral.ai/v1
+MISTRAL_PROVIDER=
+
+## xAI (Grok) LLM provider
+XAI_API_KEY=
+XAI_SERVER_URL=https://api.x.ai/v1
+XAI_PROVIDER=
+
 ## Custom LLM provider
 LLM_SERVER_URL=
 LLM_SERVER_KEY=
 LLM_SERVER_MODEL=
 LLM_SERVER_PROVIDER=
 LLM_SERVER_CONFIG_PATH=
-LLM_SERVER_LEGACY_REASONING=
 LLM_SERVER_PRESERVE_REASONING=
+## Set LLM_SERVER_API_TYPE to azure or azure_ad to talk to an Azure OpenAI deployment;
+## leave it empty for a plain OpenAI-compatible endpoint. LLM_SERVER_API_VERSION is the
+## api-version Azure requires and is ignored by the plain endpoint.
+LLM_SERVER_API_TYPE=
+LLM_SERVER_API_VERSION=
 
 ## Ollama LLM provider (Local Server or Cloud)
 # Local: http://ollama-server:11434, Cloud: https://ollama.com
@@ -218,6 +244,10 @@ PENTAGI_BEDROCK_CONFIG_PATH=
 ## PentAGI security settings
 PUBLIC_URL=https://localhost:8443
 CORS_ORIGINS=https://localhost:8443
+
+## Reverse proxies whose X-Forwarded-For is believed, comma separated CIDRs.
+## Empty means the peer address is the client address.
+TRUSTED_PROXIES=
 COOKIE_SIGNING_SALT=salt # change this to improve security
 
 ## PentAGI internal server settings (inside the container)
@@ -267,9 +297,14 @@ FIRECRAWL_API_KEY=
 FIRECRAWL_API_URL=
 
 ## Perplexity search engine API
+## PERPLEXITY_MODEL is the model sent to the chat/completions API (sonar,
+## sonar-pro, sonar-reasoning, ...); empty or unset defaults to sonar.
+## PERPLEXITY_CONTEXT_SIZE is low, medium or high.
+## PERPLEXITY_TIMEOUT is seconds to wait for one request; empty uses 120.
 PERPLEXITY_API_KEY=
 PERPLEXITY_MODEL=
 PERPLEXITY_CONTEXT_SIZE=
+PERPLEXITY_TIMEOUT=
 
 ## SEARXNG search engine API
 SEARXNG_URL=
@@ -320,12 +355,30 @@ DOCKER_SOCKET=/var/run/docker.sock # path on host machine
 DOCKER_INSIDE_HOST=
 DOCKER_INSIDE_TLS_VERIFY=
 DOCKER_INSIDE_CERT_PATH=
+## Sandbox isolation test. Runs ONCE at startup and nowhere else. Its only effect
+## is whether agents get Docker at all: PentAGI launches one worker exactly the way
+## a flow does, checks that its daemon is separate from PentAGI's own and refuses
+## host-escape requests, and removes it. A sandbox that fails the test is turned
+## OFF and the log says which check decided it -- PentAGI still starts. Off by
+## default, and then the log warns the isolation was never measured. Needs the
+## separate-daemon arrangement of examples/guides/worker_node.md.
+DOCKER_INSIDE_POLICY_TESTS=false
 
 DOCKER_NETWORK=
 DOCKER_WORK_DIR=
 DOCKER_PUBLIC_IP=0.0.0.0 # public ip of host machine
 DOCKER_DEFAULT_IMAGE=
 DOCKER_DEFAULT_IMAGE_FOR_PENTEST
```

**File**: `.github/scripts/codegen-inputs-changed.sh` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ INPUTS=(
     frontend/src/graphql/types.ts
 )
 
-if ! files=$(git diff --name-only "$base" "$HEAD_SHA"); then
+if ! files=$(git diff --name-only --no-renames "$base" "$HEAD_SHA"); then
     echo "reason=diff-failed" >&2
     echo "changed=true"
     exit 0
```

**File**: `.github/workflows/ci.yml` (modified, +2/-5)
```diff
@@ -133,13 +133,11 @@ jobs:
         with:
           version: v2.12.2
           working-directory: backend
-          args: --timeout=5m --issues-exit-code=0
-        continue-on-error: true
+          args: --timeout=5m
 
       - name: Backend - Test
         working-directory: backend
-        run: go test ./... -v
-        continue-on-error: true
+        run: go test ./... -race -v
 
       - name: Backend - Test Build
         working-directory: backend
@@ -170,7 +168,6 @@ jobs:
           # Build for ARM64
           GOOS=linux GOARCH=arm64 go build -trimpath -ldflags "$LDFLAGS" -o /tmp/pentagi-arm64 ./cmd/pentagi
           echo "✓ Successfully built for linux/arm64"
-        continue-on-error: true
 
   docker-build:
     needs: lint-and-test
```

**File**: `.gitignore` (modified, +7/-1)
```diff
@@ -7,6 +7,11 @@
 
 backend/tmp
 backend/build
+backend/data
+# locally built helper binaries (cmd/ctester, cmd/etester, cmd/ftester)
+backend/ctester
+backend/etester
+backend/ftester
 backend/vendor
 backend/cmd/installer/**/log.json
 
@@ -25,6 +30,7 @@ skills-lock.json
 
 build/*
 data/*
+neo4j/*
 .bak/*
 !.gitkeep
 .claude/
@@ -34,7 +40,7 @@ data/*
 *.swp
 *.swo
 *~
+__pycache__/
 
 # OS
 Thumbs.db
-
```

---

### Incident Patch 2: `ea665308` (2026-08-06)
**Commit Message**: fix(deps): upgrade langchaingo version to release version v0.1.14-update.7

**File**: `backend/go.mod` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ require (
 	github.com/vektah/gqlparser/v2 v2.5.19
 	github.com/vxcontrol/cloud v0.9.0
 	github.com/vxcontrol/graphiti-go-client v0.9.0
-	github.com/vxcontrol/langchaingo v0.1.15-0.20260804113937-da7016e399b0
+	github.com/vxcontrol/langchaingo v0.1.14-update.7
 	github.com/wasilibs/go-re2 v1.10.0
 	github.com/xeipuuv/gojsonschema v1.2.0
 	go.opentelemetry.io/otel v1.43.0
```

**File**: `backend/go.sum` (modified, +2/-2)
```diff
@@ -632,8 +632,8 @@ github.com/vxcontrol/cloud v0.9.0 h1:p7xYTgUctbY8w6YfhugNzvfi3/0EQoZGumMe67keAng
 github.com/vxcontrol/cloud v0.9.0/go.mod h1:AeiQFqiMgJJAXy6FYXtDS2a3P/PMB56iiBNY2vGrZhQ=
 github.com/vxcontrol/graphiti-go-client v0.9.0 h1:3GxpFmQoHmz/d7/9tyEqD8+S99v2cuqG1UEmrbAFrLU=
 github.com/vxcontrol/graphiti-go-client v0.9.0/go.mod h1:6UHL5uqAKp4KAdziva4qgcAxFtBzU05Hm/BAo4NkAuo=
-github.com/vxcontrol/langchaingo v0.1.15-0.20260804113937-da7016e399b0 h1:ZQnT4AUmTiz1mweuQdW+CR/51hQN7z0S248BEgDRXhs=
-github.com/vxcontrol/langchaingo v0.1.15-0.20260804113937-da7016e399b0/go.mod h1:z3q8al4gf+NAlEEiCXxtBzr0JSU/aEWhi3S8oi4gaGs=
+github.com/vxcontrol/langchaingo v0.1.14-update.7 h1:iQnSNMmYQGbPQK5622JewlruaY6MIc7wzJklWq0Fja4=
+github.com/vxcontrol/langchaingo v0.1.14-update.7/go.mod h1:z3q8al4gf+NAlEEiCXxtBzr0JSU/aEWhi3S8oi4gaGs=
 github.com/wasilibs/go-re2 v1.10.0 h1:vQZEBYZOCA9jdBMmrO4+CvqyCj0x4OomXTJ4a5/urQ0=
 github.com/wasilibs/go-re2 v1.10.0/go.mod h1:k+5XqO2bCJS+QpGOnqugyfwC04nw0jaglmjrrkG8U6o=
 github.com/wasilibs/wazero-helpers v0.0.0-20240620070341-3dff1577cd52 h1:OvLBa8SqJnZ6P+mjlzc2K7PM22rRUPE1x32G9DTPrC4=
```

---

### Incident Patch 3: `ccb309a6` (2026-08-04)
**Commit Message**: fix(docker): upgrade Go and dependencies for improved compatibility and performance

- Updated Go version from 1.24 to 1.26.5 in Dockerfile and CI configuration.
- Upgraded various dependencies in go.mod, including AWS SDK and OpenTelemetry packages, to their latest versions for enhanced features and security.
- Refactored Docker client imports from the Docker library to the Moby library for better compatibility with the updated API.
- Adjusted Docker client usage throughout the codebase to align with the new Moby client structure.

**File**: `.github/workflows/ci.yml` (modified, +2/-2)
```diff
@@ -42,7 +42,7 @@ jobs:
       - name: Set up Go
         uses: actions/setup-go@v6
         with:
-          go-version: "1.24"
+          go-version: "1.26.5"
           cache: true
           cache-dependency-path: backend/go.sum
 
@@ -115,7 +115,7 @@ jobs:
       - name: Backend - Lint
         uses: golangci/golangci-lint-action@v9
         with:
-          version: latest
+          version: v2.12.2
           working-directory: backend
           args: --timeout=5m --issues-exit-code=0
         continue-on-error: true
```

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ RUN pnpm run build -- \
 # ========================================
 # Stage 2: Backend Services Compilation
 # ========================================
-FROM golang:1.24-bookworm AS api-builder
+FROM golang:1.26-bookworm AS api-builder
 
 # Version injection arguments
 ARG PACKAGE_VER=develop
```

**File**: `backend/cmd/installer/checker/checker.go` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ import (
 	"pentagi/cmd/installer/state"
 	"pentagi/pkg/version"
 
-	"github.com/docker/docker/client"
+	"github.com/moby/moby/client"
 )
 
 var (
```

**File**: `backend/cmd/installer/checker/helpers.go` (modified, +16/-21)
```diff
@@ -22,10 +22,7 @@ import (
 
 	"pentagi/cmd/installer/state"
 
-	"github.com/docker/docker/api/types/container"
-	"github.com/docker/docker/api/types/image"
-	"github.com/docker/docker/api/types/volume"
-	"github.com/docker/docker/client"
+	"github.com/moby/moby/client"
 )
 
 type DockerVersion struct {
@@ -138,9 +135,7 @@ func getProxyURL(appState state.State) string {
 }
 
 func createDockerClient(host, certPath string, tlsVerify bool) (*client.Client, error) {
-	opts := []client.Opt{
-		client.WithAPIVersionNegotiation(),
-	}
+	var opts []client.Opt
 
 	if host != "" {
 		opts = append(opts, client.WithHost(host))
@@ -154,7 +149,7 @@ func createDockerClient(host, certPath string, tlsVerify bool) (*client.Client,
 		))
 	}
 
-	return client.NewClientWithOpts(opts...)
+	return client.New(opts...)
 }
 
 // createDockerClientFromEnv creates a docker client and returns the error type
@@ -165,13 +160,13 @@ func createDockerClientFromEnv(ctx context.Context) (*client.Client, DockerError
 		return nil, DockerErrorNotInstalled
 	}
 
-	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
+	cli, err := client.New(client.FromEnv)
 	if err != nil {
 		return nil, DockerErrorAPIError
 	}
 
 	// try to ping the daemon
-	_, err = cli.Ping(ctx)
+	_, err = cli.Ping(ctx, client.PingOptions{NegotiateAPIVersion: true})
 	if err != nil {
 		cli.Close() // close client on error
 		// check if it's a connection error (daemon not running)
@@ -206,7 +201,7 @@ const (
 )
 
 func checkDockerVersion(ctx context.Context, cli *client.Client) DockerVersion {
-	version, err := cli.ServerVersion(ctx)
+	version, err := cli.ServerVersion(ctx, client.ServerVersionOptions{})
 	if err != nil {
 		return DockerVersion{Version: "", Valid: false}
 	}
@@ -290,12 +285,12 @@ func checkVersionCompatibility(version, minVersion string) bool {
 }
 
 func checkContainerExists(ctx context.Context, cli *client.Client, name string) (exists, running bool) {
-	containers, err := cli.ContainerList(ctx, container.ListOptions{All: true})
+	containers, err := cli.ContainerList(ctx, client.ContainerListOptions{All: true})
 	if err != nil {
 		return false, false
 	}
 
-	for _, cont := range containers {
+	for _, cont := range containers.Items {
 		for _, containerName := range cont.Names {
 			if strings.TrimPrefix(containerName, "/") == name {
 				return true, cont.State == "running"
@@ -313,14 +308,14 @@ func checkVolumesExist(ctx context.Context, cli *client.Client, volumeNames []st
 		return false
 	}
 
-	volumes, err := cli.VolumeList(ctx, volume.ListOptions{})
+	volumes, err := cli.VolumeList(ctx, client.VolumeListOptions{})
 	if err != nil {
 		return false
 	}
 
 	// collect all volume names from Docker
-	existingVolumes := make([]string, 0, len(volumes.Volumes))
-	for _, vol := range volumes.Volumes {
+	existingVolumes := make([]string, 0, len(volumes.Items))
+	for _, vol := range volumes.Items {
 		existingVolumes = append(existingVolumes, vol.Name)
 	}
 
@@ -783,12 +778,12 @@ func getNetworkFailures(ctx context.Context, proxyURL string, dockerClient, work
 }
 
 func getContainerImageInfo(ctx context.Context, cli *client.Client, containerName string) *ImageInfo {
-	containers, err := cli.ContainerList(ctx, container.ListOptions{All: true})
+	containers, err := cli.ContainerList(ctx, client.ContainerListOptions{All: true})
 	if err != nil {
 		return nil
 	}
 
-	for _, cont := range containers {
+	for _, cont := range containers.Items {
 		for _, name := range cont.Names {
 			if strings.TrimPrefix(name, "/") == containerName {
 				return parseImageRef(cont.Image, cont.ImageID)
@@ -809,7 +804,7 @@ func getImageInfo(ctx context.Context, cli *client.Client, imageName string) *Im
 		return nil
 	}
 
-	images, err := cli.ImageList(ctx, image.ListOptions{})
+	images, err := cli.ImageList(ctx, client.ImageListOptions{})
 	if err != nil {
 		return nil
 	}
@@ -820,7 +815,7 @@ func getImageInfo(ctx context.Context, cli *client.Client, imageNam
```

**File**: `backend/cmd/installer/processor/docker.go` (modified, +31/-34)
```diff
@@ -12,11 +12,8 @@ import (
 	"pentagi/pkg/tools"
 
 	cerrdefs "github.com/containerd/errdefs"
-	"github.com/docker/docker/api/types/container"
-	"github.com/docker/docker/api/types/image"
-	"github.com/docker/docker/api/types/network"
-	"github.com/docker/docker/api/types/volume"
-	"github.com/docker/docker/client"
+	"github.com/moby/moby/api/types/container"
+	"github.com/moby/moby/client"
 )
 
 type dockerOperationsImpl struct {
@@ -59,7 +56,7 @@ func (d *dockerOperationsImpl) removeWorkerContainers(ctx context.Context, state
 
 	d.processor.appendLog(MsgRemovingWorkerContainers, ProductStackWorker, state)
 
-	allContainers, err := cli.ContainerList(ctx, container.ListOptions{All: true})
+	allContainers, err := cli.ContainerList(ctx, client.ContainerListOptions{All: true})
 	if err != nil {
 		return fmt.Errorf("failed to list worker containers: %w", err)
 	}
@@ -74,7 +71,7 @@ func (d *dockerOperationsImpl) removeWorkerContainers(ctx context.Context, state
 	// ever handled the sweep can only ever reach this instance's own containers.
 	workerPrefix := d.tenantPrefix() + "pentagi-"
 	var containers []container.Summary
-	for _, c := range allContainers {
+	for _, c := range allContainers.Items {
 		for _, name := range c.Names {
 			if strings.HasPrefix(name, workerPrefix) {
 				containers = append(containers, c)
@@ -92,13 +89,13 @@ func (d *dockerOperationsImpl) removeWorkerContainers(ctx context.Context, state
 	for _, cont := range containers {
 		if cont.State == "running" {
 			d.processor.appendLog(fmt.Sprintf(MsgStoppingContainer, cont.ID[:12]), ProductStackWorker, state)
-			if err := cli.ContainerStop(ctx, cont.ID, container.StopOptions{}); err != nil {
+			if _, err := cli.ContainerStop(ctx, cont.ID, client.ContainerStopOptions{}); err != nil {
 				return fmt.Errorf("failed to stop worker container %s: %w", cont.ID, err)
 			}
 		}
 
 		d.processor.appendLog(fmt.Sprintf(MsgRemovingContainer, cont.ID[:12]), ProductStackWorker, state)
-		if err := cli.ContainerRemove(ctx, cont.ID, container.RemoveOptions{
+		if _, err := cli.ContainerRemove(ctx, cont.ID, client.ContainerRemoveOptions{
 			Force: true,
 		}); err != nil {
 			return fmt.Errorf("failed to remove worker container %s: %w", cont.ID, err)
@@ -112,21 +109,21 @@ func (d *dockerOperationsImpl) removeWorkerContainers(ctx context.Context, state
 }
 
 func (d *dockerOperationsImpl) removeWorkerImages(ctx context.Context, state *operationState) error {
-	return d.removeImages(ctx, state, image.RemoveOptions{
+	return d.removeImages(ctx, state, client.ImageRemoveOptions{
 		Force:         false,
 		PruneChildren: false,
 	})
 }
 
 func (d *dockerOperationsImpl) purgeWorkerImages(ctx context.Context, state *operationState) error {
-	return d.removeImages(ctx, state, image.RemoveOptions{
+	return d.removeImages(ctx, state, client.ImageRemoveOptions{
 		Force:         true,
 		PruneChildren: true,
 	})
 }
 
 func (d *dockerOperationsImpl) removeImages(
-	ctx context.Context, state *operationState, options image.RemoveOptions,
+	ctx context.Context, state *operationState, options client.ImageRemoveOptions,
 ) error {
 	if err := d.removeWorkerContainers(ctx, state); err != nil {
 		return err
@@ -158,19 +155,16 @@ func (d *dockerOperationsImpl) removeImages(
 
 // createMainDockerClient creates docker client for the main stack (non-worker) using current process env
 func (d *dockerOperationsImpl) createMainDockerClient() (*client.Client, error) {
-	return client.NewClientWithOpts(
-		client.FromEnv,
-		client.WithAPIVersionNegotiation(),
-	)
+	return client.New(client.FromEnv)
 }
 
 // checkMainDockerNetwork returns true if a docker network with given name exists
 func (d *dockerOperationsImpl) checkMainDockerNetwork(ctx context.Context, cli *client.Client, name string) (bool, error) {
-	nets, err := cli.NetworkList(ctx, network.ListOptions{})
+	nets, err := cli.NetworkList(ctx, client.NetworkListOptions{})
 	if err != nil {
 		return false, fmt.Errorf("failed to li
```

---

### Incident Patch 4: `049527a3` (2026-08-04)
**Commit Message**: fix(docker): update alpine base image version in Dockerfile

- Updated the base image from alpine:3.23.3 to alpine:3.23.5 for improved security and stability.

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ RUN go build -trimpath \
 # ========================================
 # Stage 3: Production Runtime Environment
 # ========================================
-FROM alpine:3.23.3
+FROM alpine:3.23.5
 
 # Establish non-privileged execution context with docker socket access
 RUN addgroup -g 998 docker && \
```

---

### Incident Patch 5: `4081292a` (2026-08-04)
**Commit Message**: fix(docker): update container error handling and logging

- Replaced client.IsErrNotFound with cerrdefs.IsNotFound for consistent error handling across container operations.
- Updated probe image version to alpine:3.23.5.
- Enhanced logging for container removal failures in flow tools, ensuring better traceability of issues.
- Improved context usage in tests for better cancellation handling.

**File**: `backend/pkg/docker/client.go` (modified, +16/-7)
```diff
@@ -17,6 +17,7 @@ import (
 	"pentagi/pkg/config"
 	"pentagi/pkg/database"
 
+	cerrdefs "github.com/containerd/errdefs"
 	"github.com/docker/docker/api/types"
 	"github.com/docker/docker/api/types/container"
 	"github.com/docker/docker/api/types/filters"
@@ -453,7 +454,7 @@ func (dc *dockerClient) StopContainer(ctx context.Context, containerID string, d
 
 	stopErr := dc.client.ContainerStop(ctx, containerID, container.StopOptions{})
 	if stopErr != nil {
-		if client.IsErrNotFound(stopErr) {
+		if cerrdefs.IsNotFound(stopErr) {
 			logger.Warn("target container already removed or never existed")
 		} else {
 			return fmt.Errorf("container shutdown failed: %w", stopErr)
@@ -486,10 +487,11 @@ func (dc *dockerClient) RemoveContainer(ctx context.Context, containerID string,
 		Force:         true,
 	}
 	if err := dc.client.ContainerRemove(ctx, containerID, options); err != nil {
-		if !client.IsErrNotFound(err) {
+		if !cerrdefs.IsNotFound(err) {
 			return fmt.Errorf("failed to remove container: %w", err)
 		}
-		// TODO: fix this case
+		// already gone (removed manually, or a prior call already succeeded);
+		// still mark it deleted below so the database row does not go stale.
 		logger.WithError(err).Warn("container not found")
 	}
 
@@ -600,16 +602,23 @@ func (dc *dockerClient) Cleanup(ctx context.Context) error {
 func (dc *dockerClient) IsContainerRunning(ctx context.Context, containerID string) (bool, error) {
 	inspection, err := dc.client.ContainerInspect(ctx, containerID)
 	if err != nil {
-		if !client.IsErrNotFound(err) {
+		if !cerrdefs.IsNotFound(err) {
 			return false, fmt.Errorf("container inspection failed: %w", err)
 		}
 		// a removed container is missing, not an inspection failure
 		return false, nil
 	}
 
+	if inspection.State == nil {
+		// the daemon always populates State for a successfully inspected
+		// container; treat the unexpected absence as "not running" rather
+		// than panicking on the field access below.
+		return false, nil
+	}
+
 	// Check both Running state and health status if available
 	isOperational := inspection.State.Running
-	if inspection.State != nil && inspection.State.Health != nil && inspection.State.Health.Status != "" {
+	if inspection.State.Health != nil && inspection.State.Health.Status != "" {
 		isOperational = isOperational && inspection.State.Health.Status != "unhealthy"
 	}
 
@@ -974,7 +983,7 @@ func getHostDataDir(ctx context.Context, cli *client.Client, dataDir, workDir st
 		return "" // unexpected error
 	}
 
-	mounts := []types.MountPoint{}
+	mounts := []container.MountPoint{}
 	for _, container := range containers {
 		inspect, err := cli.ContainerInspect(ctx, container.ID)
 		if err != nil {
@@ -1001,7 +1010,7 @@ func getHostDataDir(ctx context.Context, cli *client.Client, dataDir, workDir st
 	}
 
 	// sort mounts by destination length to get the most accurate mount point
-	slices.SortFunc(mounts, func(a, b types.MountPoint) int {
+	slices.SortFunc(mounts, func(a, b container.MountPoint) int {
 		return len(b.Destination) - len(a.Destination)
 	})
 
```

**File**: `backend/pkg/docker/client_test.go` (modified, +30/-34)
```diff
@@ -6,14 +6,18 @@ import (
 	"encoding/binary"
 	"errors"
 	"fmt"
+	"io"
 	"math/rand"
 	"strings"
 	"sync/atomic"
 	"testing"
 	"time"
 
+	cerrdefs "github.com/containerd/errdefs"
 	"github.com/docker/docker/api/types/container"
 	"github.com/docker/docker/client"
+	"github.com/sirupsen/logrus"
+	"github.com/stretchr/testify/require"
 )
 
 func TestStatContainerEntries_AllSucceed(t *testing.T) {
@@ -262,7 +266,7 @@ func failNames(failures []statFailure) map[string]bool {
 	return m
 }
 
-const probeImage = "alpine:3.20"
+const probeImage = "alpine:3.23.5"
 
 // newDaemonClient binds a client to the local daemon, skipping the test when
 // none is reachable.
@@ -274,66 +278,58 @@ func newDaemonClient(t *testing.T) *dockerClient {
 		t.Skipf("docker daemon unavailable: %v", err)
 	}
 
-	ctx := context.Background()
+	ctx := t.Context()
 	cli.NegotiateAPIVersion(ctx)
 	if _, err := cli.Ping(ctx); err != nil {
 		t.Skipf("docker daemon unavailable: %v", err)
 	}
 
-	return &dockerClient{client: cli}
+	logger := logrus.New()
+	logger.SetOutput(io.Discard)
+
+	return &dockerClient{client: cli, logger: logger}
 }
 
-// A flow keeps the id of its primary container in the database. When that
-// container is removed behind pentagi's back the id has to read as not running,
-// otherwise the flow can never rebuild it.
 func TestIsContainerRunningRemovedContainer(t *testing.T) {
 	dc := newDaemonClient(t)
-	ctx := context.Background()
+	ctx := t.Context()
 
 	created, err := dc.client.ContainerCreate(ctx, &container.Config{
 		Image:      probeImage,
 		Entrypoint: []string{"tail", "-f", "/dev/null"},
 	}, nil, nil, nil, "")
-	if client.IsErrNotFound(err) {
+	if cerrdefs.IsNotFound(err) {
 		t.Skipf("%s is not present locally", probeImage)
 	}
-	if err != nil {
-		t.Fatalf("create probe container: %v", err)
-	}
+	require.NoError(t, err)
+
 	t.Cleanup(func() {
-		dc.client.ContainerRemove(context.Background(), created.ID, container.RemoveOptions{Force: true})
+		ctx := context.WithoutCancel(ctx)
+		// the happy path already removes the container below; only report a
+		// cleanup failure if it is still there for some other reason.
+		if err := dc.client.ContainerRemove(ctx, created.ID, container.RemoveOptions{Force: true}); err != nil && !cerrdefs.IsNotFound(err) {
+			t.Errorf("cleanup: failed to remove container %q: %v", created.ID, err)
+		}
 	})
 
-	if err := dc.client.ContainerStart(ctx, created.ID, container.StartOptions{}); err != nil {
-		t.Fatalf("start probe container: %v", err)
-	}
+	require.NoError(t, dc.client.ContainerStart(ctx, created.ID, container.StartOptions{}))
 
 	running, err := dc.IsContainerRunning(ctx, created.ID)
-	if err != nil || !running {
-		t.Fatalf("got running=%v err=%v, want true and no error", running, err)
-	}
+	require.NoError(t, err)
+	require.True(t, running)
 
-	if err := dc.client.ContainerRemove(ctx, created.ID, container.RemoveOptions{Force: true}); err != nil {
-		t.Fatalf("remove probe container: %v", err)
-	}
+	require.NoError(t, dc.client.ContainerRemove(ctx, created.ID, container.RemoveOptions{Force: true}))
 
 	running, err = dc.IsContainerRunning(ctx, created.ID)
-	if err != nil {
-		t.Fatalf("removed container: got error %v, want none", err)
-	}
-	if running {
-		t.Fatal("removed container reported as running")
-	}
+	require.NoError(t, err)
+	require.False(t, running)
 }
 
 func TestIsContainerRunningUnknownContainer(t *testing.T) {
 	dc := newDaemonClient(t)
 
-	running, err := dc.IsContainerRunning(context.Background(), "pentagi-container-that-does-not-exist")
-	if err != nil {
-		t.Fatalf("unknown container: got error %v, want none", err)
-	}
-	if running {
-		t.Fatal("unknown container reported as running")
-	}
+	running, err := dc.IsContainerRunning(t.Context(), "pentagi-container-that-does-not-exist")
+
+	require.NoError(t, err)
+	require.False(t, running)
 }
```

**File**: `backend/pkg/tools/tools.go` (modified, +6/-2)
```diff
@@ -481,9 +481,9 @@ func (fte *flowToolsExecutor) SetGraphitiClient(client *graphiti.Client) {
 
 func (fte *flowToolsExecutor) Prepare(ctx context.Context) error {
 	if cnt, err := fte.db.GetFlowPrimaryContainer(ctx, fte.flowID); err == nil {
+		containerName := PrimaryTerminalName(fte.cfg.TenantPrefix(), fte.flowID)
 		// the stored status goes stale when the container is removed outside pentagi
 		if cnt.Status == database.ContainerStatusRunning {
-			containerName := PrimaryTerminalName(fte.cfg.TenantPrefix(), fte.flowID)
 			running, err := fte.docker.IsContainerRunning(ctx, cnt.LocalID.String)
 			if err != nil {
 				return fmt.Errorf("failed to inspect container '%s': %w", containerName, err)
@@ -498,7 +498,11 @@ func (fte *flowToolsExecutor) Prepare(ctx context.Context) error {
 			}
 		}
 
-		fte.docker.RemoveContainer(ctx, cnt.LocalID.String, cnt.ID)
+		if err := fte.docker.RemoveContainer(ctx, cnt.LocalID.String, cnt.ID); err != nil {
+			logrus.WithContext(ctx).WithError(err).WithFields(enrichLogrusFields(fte.flowID, nil, nil, logrus.Fields{
+				"container_name": containerName,
+			})).Warn("failed to remove stale primary container before rebuild")
+		}
 	}
 
 	// Explicit capability allow-list (CapDrop: ALL below): Docker's default 14
```

---

### Incident Patch 6: `a5274d3c` (2026-08-04)
**Commit Message**: Merge pull request #386 from F2had/fix/primary-container-missing-from-daemon

fix(docker): rebuild flow primary container when it is gone from the daemon

**File**: `backend/pkg/docker/client.go` (modified, +5/-1)
```diff
@@ -600,7 +600,11 @@ func (dc *dockerClient) Cleanup(ctx context.Context) error {
 func (dc *dockerClient) IsContainerRunning(ctx context.Context, containerID string) (bool, error) {
 	inspection, err := dc.client.ContainerInspect(ctx, containerID)
 	if err != nil {
-		return false, fmt.Errorf("container inspection failed: %w", err)
+		if !client.IsErrNotFound(err) {
+			return false, fmt.Errorf("container inspection failed: %w", err)
+		}
+		// a removed container is missing, not an inspection failure
+		return false, nil
 	}
 
 	// Check both Running state and health status if available
```

**File**: `backend/pkg/docker/client_test.go` (modified, +77/-0)
```diff
@@ -13,6 +13,7 @@ import (
 	"time"
 
 	"github.com/docker/docker/api/types/container"
+	"github.com/docker/docker/client"
 )
 
 func TestStatContainerEntries_AllSucceed(t *testing.T) {
@@ -260,3 +261,79 @@ func failNames(failures []statFailure) map[string]bool {
 	}
 	return m
 }
+
+const probeImage = "alpine:3.20"
+
+// newDaemonClient binds a client to the local daemon, skipping the test when
+// none is reachable.
+func newDaemonClient(t *testing.T) *dockerClient {
+	t.Helper()
+
+	cli, err := client.NewClientWithOpts(client.FromEnv)
+	if err != nil {
+		t.Skipf("docker daemon unavailable: %v", err)
+	}
+
+	ctx := context.Background()
+	cli.NegotiateAPIVersion(ctx)
+	if _, err := cli.Ping(ctx); err != nil {
+		t.Skipf("docker daemon unavailable: %v", err)
+	}
+
+	return &dockerClient{client: cli}
+}
+
+// A flow keeps the id of its primary container in the database. When that
+// container is removed behind pentagi's back the id has to read as not running,
+// otherwise the flow can never rebuild it.
+func TestIsContainerRunningRemovedContainer(t *testing.T) {
+	dc := newDaemonClient(t)
+	ctx := context.Background()
+
+	created, err := dc.client.ContainerCreate(ctx, &container.Config{
+		Image:      probeImage,
+		Entrypoint: []string{"tail", "-f", "/dev/null"},
+	}, nil, nil, nil, "")
+	if client.IsErrNotFound(err) {
+		t.Skipf("%s is not present locally", probeImage)
+	}
+	if err != nil {
+		t.Fatalf("create probe container: %v", err)
+	}
+	t.Cleanup(func() {
+		dc.client.ContainerRemove(context.Background(), created.ID, container.RemoveOptions{Force: true})
+	})
+
+	if err := dc.client.ContainerStart(ctx, created.ID, container.StartOptions{}); err != nil {
+		t.Fatalf("start probe container: %v", err)
+	}
+
+	running, err := dc.IsContainerRunning(ctx, created.ID)
+	if err != nil || !running {
+		t.Fatalf("got running=%v err=%v, want true and no error", running, err)
+	}
+
+	if err := dc.client.ContainerRemove(ctx, created.ID, container.RemoveOptions{Force: true}); err != nil {
+		t.Fatalf("remove probe container: %v", err)
+	}
+
+	running, err = dc.IsContainerRunning(ctx, created.ID)
+	if err != nil {
+		t.Fatalf("removed container: got error %v, want none", err)
+	}
+	if running {
+		t.Fatal("removed container reported as running")
+	}
+}
+
+func TestIsContainerRunningUnknownContainer(t *testing.T) {
+	dc := newDaemonClient(t)
+
+	running, err := dc.IsContainerRunning(context.Background(), "pentagi-container-that-does-not-exist")
+	if err != nil {
+		t.Fatalf("unknown container: got error %v, want none", err)
+	}
+	if running {
+		t.Fatal("unknown container reported as running")
+	}
+}
```

**File**: `backend/pkg/tools/tools.go` (modified, +16/-10)
```diff
@@ -481,18 +481,24 @@ func (fte *flowToolsExecutor) SetGraphitiClient(client *graphiti.Client) {
 
 func (fte *flowToolsExecutor) Prepare(ctx context.Context) error {
 	if cnt, err := fte.db.GetFlowPrimaryContainer(ctx, fte.flowID); err == nil {
-		switch cnt.Status {
-		case database.ContainerStatusRunning:
-			fte.primaryID = cnt.ID
-			fte.primaryLID = cnt.LocalID.String
-			if err := fte.syncMissingFiles(ctx); err != nil {
-				containerName := PrimaryTerminalName(fte.cfg.TenantPrefix(), fte.flowID)
-				return fmt.Errorf("failed to sync missing files to container '%s': %w", containerName, err)
+		// the stored status goes stale when the container is removed outside pentagi
+		if cnt.Status == database.ContainerStatusRunning {
+			containerName := PrimaryTerminalName(fte.cfg.TenantPrefix(), fte.flowID)
+			running, err := fte.docker.IsContainerRunning(ctx, cnt.LocalID.String)
+			if err != nil {
+				return fmt.Errorf("failed to inspect container '%s': %w", containerName, err)
+			}
+			if running {
+				fte.primaryID = cnt.ID
+				fte.primaryLID = cnt.LocalID.String
+				if err := fte.syncMissingFiles(ctx); err != nil {
+					return fmt.Errorf("failed to sync missing files to container '%s': %w", containerName, err)
+				}
+				return nil
 			}
-			return nil
-		default:
-			fte.docker.RemoveContainer(ctx, cnt.LocalID.String, cnt.ID)
 		}
+
+		fte.docker.RemoveContainer(ctx, cnt.LocalID.String, cnt.ID)
 	}
 
 	// Explicit capability allow-list (CapDrop: ALL below): Docker's default 14
```

---

### Incident Patch 7: `7d675b31` (2026-08-03)
**Commit Message**: fix(tools): rebuild the flow primary container when the daemon lost it

A flow stores the id of its primary container in the database. When that
container is removed outside pentagi the row keeps status 'running', so
Prepare reused a container the daemon no longer knows about and every
terminal call failed with "No such container" until the flow was recreated.

Confirm with the daemon before reusing the stored container and let the
existing remove-and-rebuild path take over when it is gone. An unreachable
daemon is still an error, so a transient failure cannot discard a healthy
container.

**File**: `backend/pkg/tools/tools.go` (modified, +16/-10)
```diff
@@ -481,18 +481,24 @@ func (fte *flowToolsExecutor) SetGraphitiClient(client *graphiti.Client) {
 
 func (fte *flowToolsExecutor) Prepare(ctx context.Context) error {
 	if cnt, err := fte.db.GetFlowPrimaryContainer(ctx, fte.flowID); err == nil {
-		switch cnt.Status {
-		case database.ContainerStatusRunning:
-			fte.primaryID = cnt.ID
-			fte.primaryLID = cnt.LocalID.String
-			if err := fte.syncMissingFiles(ctx); err != nil {
-				containerName := PrimaryTerminalName(fte.cfg.TenantPrefix(), fte.flowID)
-				return fmt.Errorf("failed to sync missing files to container '%s': %w", containerName, err)
+		// the stored status goes stale when the container is removed outside pentagi
+		if cnt.Status == database.ContainerStatusRunning {
+			containerName := PrimaryTerminalName(fte.cfg.TenantPrefix(), fte.flowID)
+			running, err := fte.docker.IsContainerRunning(ctx, cnt.LocalID.String)
+			if err != nil {
+				return fmt.Errorf("failed to inspect container '%s': %w", containerName, err)
+			}
+			if running {
+				fte.primaryID = cnt.ID
+				fte.primaryLID = cnt.LocalID.String
+				if err := fte.syncMissingFiles(ctx); err != nil {
+					return fmt.Errorf("failed to sync missing files to container '%s': %w", containerName, err)
+				}
+				return nil
 			}
-			return nil
-		default:
-			fte.docker.RemoveContainer(ctx, cnt.LocalID.String, cnt.ID)
 		}
+
+		fte.docker.RemoveContainer(ctx, cnt.LocalID.String, cnt.ID)
 	}
 
 	// Explicit capability allow-list (CapDrop: ALL below): Docker's default 14
```

---

### Incident Patch 8: `16f1e0c4` (2026-08-03)
**Commit Message**: fix(docker): report a removed container as not running

ContainerInspect returns a not-found error once a container is gone from
the daemon, and IsContainerRunning wrapped it as an inspection failure, so
callers could not tell a missing container apart from an unreachable
daemon. StopContainer and RemoveContainer already special-case
client.IsErrNotFound; do the same here.

**File**: `backend/pkg/docker/client.go` (modified, +5/-1)
```diff
@@ -600,7 +600,11 @@ func (dc *dockerClient) Cleanup(ctx context.Context) error {
 func (dc *dockerClient) IsContainerRunning(ctx context.Context, containerID string) (bool, error) {
 	inspection, err := dc.client.ContainerInspect(ctx, containerID)
 	if err != nil {
-		return false, fmt.Errorf("container inspection failed: %w", err)
+		if !client.IsErrNotFound(err) {
+			return false, fmt.Errorf("container inspection failed: %w", err)
+		}
+		// a removed container is missing, not an inspection failure
+		return false, nil
 	}
 
 	// Check both Running state and health status if available
```

**File**: `backend/pkg/docker/client_test.go` (modified, +77/-0)
```diff
@@ -13,6 +13,7 @@ import (
 	"time"
 
 	"github.com/docker/docker/api/types/container"
+	"github.com/docker/docker/client"
 )
 
 func TestStatContainerEntries_AllSucceed(t *testing.T) {
@@ -260,3 +261,79 @@ func failNames(failures []statFailure) map[string]bool {
 	}
 	return m
 }
+
+const probeImage = "alpine:3.20"
+
+// newDaemonClient binds a client to the local daemon, skipping the test when
+// none is reachable.
+func newDaemonClient(t *testing.T) *dockerClient {
+	t.Helper()
+
+	cli, err := client.NewClientWithOpts(client.FromEnv)
+	if err != nil {
+		t.Skipf("docker daemon unavailable: %v", err)
+	}
+
+	ctx := context.Background()
+	cli.NegotiateAPIVersion(ctx)
+	if _, err := cli.Ping(ctx); err != nil {
+		t.Skipf("docker daemon unavailable: %v", err)
+	}
+
+	return &dockerClient{client: cli}
+}
+
+// A flow keeps the id of its primary container in the database. When that
+// container is removed behind pentagi's back the id has to read as not running,
+// otherwise the flow can never rebuild it.
+func TestIsContainerRunningRemovedContainer(t *testing.T) {
+	dc := newDaemonClient(t)
+	ctx := context.Background()
+
+	created, err := dc.client.ContainerCreate(ctx, &container.Config{
+		Image:      probeImage,
+		Entrypoint: []string{"tail", "-f", "/dev/null"},
+	}, nil, nil, nil, "")
+	if client.IsErrNotFound(err) {
+		t.Skipf("%s is not present locally", probeImage)
+	}
+	if err != nil {
+		t.Fatalf("create probe container: %v", err)
+	}
+	t.Cleanup(func() {
+		dc.client.ContainerRemove(context.Background(), created.ID, container.RemoveOptions{Force: true})
+	})
+
+	if err := dc.client.ContainerStart(ctx, created.ID, container.StartOptions{}); err != nil {
+		t.Fatalf("start probe container: %v", err)
+	}
+
+	running, err := dc.IsContainerRunning(ctx, created.ID)
+	if err != nil || !running {
+		t.Fatalf("got running=%v err=%v, want true and no error", running, err)
+	}
+
+	if err := dc.client.ContainerRemove(ctx, created.ID, container.RemoveOptions{Force: true}); err != nil {
+		t.Fatalf("remove probe container: %v", err)
+	}
+
+	running, err = dc.IsContainerRunning(ctx, created.ID)
+	if err != nil {
+		t.Fatalf("removed container: got error %v, want none", err)
+	}
+	if running {
+		t.Fatal("removed container reported as running")
+	}
+}
+
+func TestIsContainerRunningUnknownContainer(t *testing.T) {
+	dc := newDaemonClient(t)
+
+	running, err := dc.IsContainerRunning(context.Background(), "pentagi-container-that-does-not-exist")
+	if err != nil {
+		t.Fatalf("unknown container: got error %v, want none", err)
+	}
+	if running {
+		t.Fatal("unknown container reported as running")
+	}
+}
```

---

### Incident Patch 9: `c19665d8` (2026-08-03)
**Commit Message**: fix(docs): improve clarity and formatting in installation guides

- Consolidated sentences in the README and installation configuration guide for better readability.
- Removed unnecessary line breaks and ensured consistent formatting for installation instructions and requirements.
- Enhanced links to related documentation for a smoother user experience.

**File**: `README.md` (modified, +2/-5)
```diff
@@ -572,10 +572,7 @@ The system uses Docker containers for isolation and easy deployment, with separa
 
 ## Quick Start
 
-For a step-by-step walkthrough that connects installation, configuration, LLM
-and embedding provider testing, and your first login, see the
-[Installing and Configuring PentAGI](examples/guides/installation_configuration.md)
-guide. The sections below remain the detailed reference for each step.
+For a step-by-step walkthrough that connects installation, configuration, LLM and embedding provider testing, and your first login, see the [Installing and Configuring PentAGI](examples/guides/installation_configuration.md) guide. The sections below remain the detailed reference for each step.
 
 ### System Requirements
 
@@ -657,7 +654,7 @@ The PentAGI web console already manages several settings areas after the server
 The following configuration areas still need to be set on the server through environment variables, compose files, or mounted config files:
 
 - **LLM credentials and connection details**: API keys, endpoints, auth modes, and provider-specific connection settings for OpenAI, Anthropic, Bedrock, Ollama, custom providers, and similar backends; config-path settings apply only where supported, such as `OLLAMA_SERVER_CONFIG_PATH` and `LLM_SERVER_CONFIG_PATH`.
-- **Search provider credentials and options**: Settings such as `DUCKDUCKGO_*`, `GOOGLE_*`, `TAVILY_API_KEY`, `FIRECRAWL_API_KEY`, `FIRECRAWL_API_URL`, `TRAVERSAAL_API_KEY`, `PERPLEXITY_*`, `SEARXNG_*`, `SPLOITUS_ENABLED`, and the optional `WEB_SEARCH_INTERNAL_*` browser-analytics fallback settings.
+- **Search provider credentials and options**: Settings such as `DUCKDUCKGO_*`, `GOOGLE_*`, `TAVILY_API_KEY`, `FIRECRAWL_API_*`, `TRAVERSAAL_API_KEY`, `PERPLEXITY_*`, `SEARXNG_*`, `SPLOITUS_ENABLED`, and the optional `WEB_SEARCH_INTERNAL_*` browser-analytics fallback settings.
 - **Third-party integrations**: Langfuse, Graphiti, and similar external services remain server-side configuration.
 - **MCP server management**: MCP settings pages are not currently exposed as a live web-console feature.
 
```

**File**: `examples/guides/installation_configuration.md` (modified, +34/-102)
```diff
@@ -1,85 +1,49 @@
 # Installing and Configuring PentAGI
 
-This guide is the bridge between installing PentAGI and using it. It walks you
-through a first deployment in order: pick an installation method, set the core
-server variables, configure and test at least one LLM provider, configure the
-embedding provider, optionally add search and observability, then start the
-stack and verify it before your first login.
+This guide is the bridge between installing PentAGI and using it. It walks you through a first deployment in order: pick an installation method, set the core server variables, configure and test at least one LLM provider, configure the embedding provider, optionally add search and observability, then start the stack and verify it before your first login.
 
-It is intentionally concise and links to the detailed reference sections in the
-main [README](https://github.com/vxcontrol/pentagi#readme) instead of repeating
-them. When you finish here, continue with
-[How to Use PentAGI After Login](https://github.com/vxcontrol/pentagi#how-to-use-pentagi-after-login).
+It is intentionally concise and links to the detailed reference sections in the main [README](https://github.com/vxcontrol/pentagi#readme) instead of repeating them. When you finish here, continue with [How to Use PentAGI After Login](https://github.com/vxcontrol/pentagi#how-to-use-pentagi-after-login).
 
 ## Before you start
 
-- Docker and Docker Compose (or Podman), 2+ vCPU, 4+ GB RAM, 20+ GB free disk,
-  and outbound internet access for pulling images and reaching LLM providers.
-- At least one LLM provider you can authenticate to (OpenAI, Anthropic, Gemini,
-  AWS Bedrock, or a local/Ollama/OpenAI-compatible backend). PentAGI will not
-  run without one.
-- Decide how you want to install: the interactive installer (recommended) or a
-  manual Docker Compose deployment.
+- Docker and Docker Compose (or Podman), 2+ vCPU, 4+ GB RAM, 20+ GB free disk, and outbound internet access for pulling images and reaching LLM providers.
+- At least one LLM provider you can authenticate to (OpenAI, Anthropic, Gemini, AWS Bedrock, or a local/Ollama/OpenAI-compatible backend). PentAGI will not run without one.
+- Decide how you want to install: the interactive installer (recommended) or a manual Docker Compose deployment.
 
 ## Step 1 - Choose an installation method
 
 ### Option A: Interactive installer (recommended)
 
-The installer is a terminal UI that runs system checks, writes a sane `.env`,
-helps you configure LLM and search providers, hardens credentials, and starts
-the stack for you. Download the build for your platform and run it, then follow
-the prompts. See
-[Using Installer (Recommended)](https://github.com/vxcontrol/pentagi#using-installer-recommended)
-for download links and the Docker socket permission notes.
+The installer is a terminal UI that runs system checks, writes a sane `.env`, helps you configure LLM and search providers, hardens credentials, and starts the stack for you. Download the build for your platform and run it, then follow the prompts. See [Using Installer (Recommended)](https://github.com/vxcontrol/pentagi#using-installer-recommended) for download links and the Docker socket permission notes.
 
-If you use the installer, it can take you through most of Steps 2-6 below
-interactively. You can still use this guide as a checklist of what to confirm.
+If you use the installer, it can take you through most of Steps 2-6 below interactively. You can still use this guide as a checklist of what to confirm.
 
 ### Option B: Manual Docker Compose
 
-Create a working directory, copy `.env.example` to `.env`, fill in your keys,
-and bring up the stack. The full sequence (including the example provider config
-files and the `docker compose up -d` command) is in
-[Manual Installation](https://github.com/vxcontrol/pentagi#manual-installation).
+Create a working directory, copy `.env.example` to `.env`, fill in your keys, and bring up the stack. Th
```

---

### Incident Patch 10: `c4859cba` (2026-08-03)
**Commit Message**: fix(providers): improve error handling when retrieving providers from the database

- Added a specific error check to handle cases where the provider is not found in the database, providing clearer feedback on retrieval failures.

**File**: `backend/pkg/providers/providers.go` (modified, +3/-0)
```diff
@@ -697,6 +697,9 @@ func (pc *providerController) SeedDefaultProviders(ctx context.Context, userID i
 		Name:   prvname,
 		UserID: userID,
 	})
+	if err != nil && !errors.Is(err, sql.ErrNoRows) {
+		return fmt.Errorf("failed to get provider '%s' from database: %w", prvname, err)
+	}
 	if err != nil {
 		_, err = pc.db.CreateProvider(ctx, database.CreateProviderParams{
 			UserID: userID,
```

#### Recent Merged Pull Requests:
- **PR #429** (closed): chore(deps): bump the npm_and_yarn group across 1 directory with 3 updates (@dependabot[bot])
- **PR #428** (closed): chore(deps): bump the go_modules group across 1 directory with 4 updates (@dependabot[bot])
- **PR #424** (closed): Integration request from aimlapi.com (@hugoaimlapi)
- **PR #421** (closed): feat(config): allow skipping tool-loop summaries (@SherryOvo)
- **PR #419** (closed): pentAgi (@cscoheru)
- **PR #418** (closed): feat(search): add opt-in Parallel Search MCP fallback (@georgeatparallel)
- **PR #416** (closed): fix(providers): clamp max_tokens to the model context window (@basil-k-aji-dev)
- **PR #410** (closed): fix(frontend): prevent Resources page freeze with large libraries (@Ashfaqbs)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

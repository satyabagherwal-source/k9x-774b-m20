# Forensic Learning Record (Deep Inspection): aquasecurity/trivy

> **Canonical Artifact**: `07_PROJECT_LEARNING/aquasecurity-trivy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aquasecurity/trivy](https://github.com/aquasecurity/trivy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:21:27.524Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aquasecurity/trivy`
- **Description**: Find vulnerabilities, misconfigurations, secrets, SBOM in containers, Kubernetes, code repositories, clouds and more
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 38153 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/trivy/main.go`
```
package main

import (
	"context"
	"errors"
	"os"

	"golang.org/x/xerrors"

	"github.com/aquasecurity/trivy/pkg/commands"
	"github.com/aquasecurity/trivy/pkg/log"
	"github.com/aquasecurity/trivy/pkg/plugin"
	"github.com/aquasecurity/trivy/pkg/types"

	_ "modernc.org/sqlite" // sqlite driver for RPM DB and Java DB
)

func main() {
	if err := run(); err != nil {
		if exitError, ok := errors.AsType[*types.ExitError](err); ok {
			os.Exit(exitError.Code)
		}

		if userErr, ok := errors.AsType[*types.UserError](err); ok {
			log.Fatal("Error", log.Err(userErr))
		}

		log.Fatal("Fatal error", log.Err(err))
	}
}

func run() error {
	// Trivy behaves as the specified plugin.
	if runAsPlugin := os.Getenv("TRIVY_RUN_AS_PLUGIN"); runAsPlugin != "" {
		log.InitLogger(false, false)
		if err := plugin.Run(context.Background(), runAsPlugin, plugin.Options{Args: os.Args[1:]}); err != nil {
			return xerrors.Errorf("plugin error: %w", err)
		}
		return nil
	}

	// Ensure cleanup on exit
	defer commands.Cleanup()

	// Set up signal handling for graceful shutdown
	ctx := commands.NotifyContext(context.Background())

	return commands.Run(ctx)
}

```

### Core Architecture Module: `examples/module/spring4shell/spring4shell.go`
```
//go:generate go build -o spring4shell.wasm -buildmode=c-shared spring4shell.go
//go:build wasip1

package main

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"regexp"
	"strconv"
	"strings"

	ftypes "github.com/aquasecurity/trivy/pkg/fanal/types"
	"github.com/aquasecurity/trivy/pkg/module/api"
	"github.com/aquasecurity/trivy/pkg/module/serialize"
	"github.com/aquasecurity/trivy/pkg/module/wasm"
	"github.com/aquasecurity/trivy/pkg/types"
)

const (
	ModuleVersion     = 1
	ModuleName        = "spring4shell"
	TypeJavaMajor     = ModuleName + "/java-major-version"
	TypeTomcatVersion = ModuleName + "/tomcat-version"
)

var (
	tomcatVersionRegex = regexp.MustCompile(`Apache Tomcat Version ([\d.]+)`)
)

// main is required for Go to compile the Wasm module
func main() {}

func init() {
	wasm.RegisterModule(Spring4Shell{})
}

type Spring4Shell struct {
	// Cannot define fields as modules can't keep state.
}

func (Spring4Shell) Version() int {
	return ModuleVersion
}

func (Spring4Shell) Name() string {
	return ModuleName
}

func (Spring4Shell) RequiredFiles() []string {
	return []string{
		`\/openjdk-\d+\/release`, // For OpenJDK version
		`\/jdk\d+\/release`,      // For JDK version
		`tomcat\/RELEASE-NOTES`,  // For Tomcat version
	}
}

func (s Spring4Shell) Analyze(filePath string) (*serialize.AnalysisResult, error) {
	wasm.Info(fmt.Sprintf("analyzing %s...", filePath))
	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	switch {
	case strings.HasSuffix(filePath, "/release"):
		return s.parseJavaRelease(f, filePath)
	case strings.HasSuffix(filePath, "/RELEASE-NOTES"):
		return s.parseTomcatReleaseNotes(f, filePath)
	}

	return nil, nil
}

// Parse a jdk release file like "/usr/local/openjdk-11/release"
func (Spring4Shell) parseJavaRelease(f *os.File, filePath string) (*serialize.AnalysisResult, error) {
	var javaVersion string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "JAVA_VERSION=") {
			continue
		}

		ss := strings.Split(line, "=")
		if len(ss) != 2 {
			return nil, fmt.Errorf("invalid java version: %s", line)
		}

		javaVersion = strings.Trim(ss[1], `"`)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return &serialize.AnalysisResult{
		CustomResources: []ftypes.CustomResource{
			{
				Type:     TypeJavaMajor,
				FilePath: filePath,
				Data:     javaVersion,
			},
		},
	}, nil
}

func (Spring4Shell) parseTomcatReleaseNotes(f *os.File, filePath string) (*serialize.AnalysisResult, error) {
	b, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}

	m := tomcatVersionRegex.FindStringSubmatch(string(b))
	if len(m) != 2 {
		return nil, errors.New("unknown tomcat release notes format")
	}

	return &serialize.AnalysisResult{
		CustomResources: []ftypes.CustomResource{
			{
				Type:     TypeTomcatVersion,
				FilePath: filePath,
				Data:     m[1],
			},
		},
	}, nil
}

func (Spring4Shell) PostScanSpec() serialize.PostScanSpec {
	return serialize.PostScanSpec{
		Action: api.ActionUpdate, // Update severity
		IDs:    []string{"CVE-2022-22965"},
	}
}

// PostScan takes results including custom resources and detected CVE-2022-22965.
//
// Example input:
// [
//
//	{
//	  "Target": "",
//	  "Class": "custom",
//	  "CustomResources": [
//	    {
//	      "Type": "spring4shell/java-major-version",
//	      "FilePath": "/usr/local/openjdk-8/release",
//	      "Layer": {
//	        "Digest": "sha256:d7b564a873af313eb2dbcb1ed0d393c57543e3666bdedcbe5d75841d72b1f791",
//	        "DiffID": "sha256:ba40706eccba610401e4942e29f50bdf36807f8638942ce20805b359ae3ac1c1"
//	      },
//	      "Data": "1.8.0_322"
//	    },
//	    {
//	      "Type": "spring4shell/tomcat-version",
//	      "FilePath": "/usr/local/tomcat/RELEASE-NOTES",
//	      "Layer": {
//	        "Digest": "sha256:59c0978ccb117247fd40d936973c40df89195f60466118c5acc6a55f8ba29f06",
//	        "DiffID": "sha256:85595543df2b1115a18284a8ef62d0b235c4bc29e3d33b55f89b54ee1eadf4c6"
//	      },
//	      "Data": "8.5.77"
//	    }
//	  ]
//	},
//	{
//	  "Target": "Java",
//	  "Class": "lang-pkgs",
//	  "Type": "jar",
//	  "Vulnerabilities": [
//	    {
//	      "VulnerabilityID": "CVE-2022-22965",
//	      "PkgName": "org.springframework.boot:spring-boot",
//	      "PkgPath": "usr/local/tomcat/webapps/helloworld.war",
//	      "InstalledVersion": "2.6.3",
//	      "FixedVersion": "2.5.12, 2.6.6",
//	      "Layer": {
//	        "Digest": "sha256:cc44af318e91e6f9f9bf73793fa4f0639487613f46aa1f819b02b6e8fb5c6c07",
//	        "DiffID": "sha256:eb769943b91f10a0418f2fc3b4a4fde6c6293be60c37293fcc0fa319edaf27a5"
//	      },
//	      "SeveritySource": "nvd",
//	      "PrimaryURL": "https://avd.aquasec.com/nvd/cve-2022-22965",
//	      "DataSource": {
//	        "ID": "glad",
//	        "Name": "GitLab Advisory Database Community",
//	        "URL": "https://gitlab.com/gitlab-org/advisories-community"
//	      },
//	      "Title": "spring-framework: RCE via Data Binding on JDK 9+",
//	      "Description": "A Spring MVC or Spring WebFlux application running on JDK 9+ may be vulnerable to remote code execution (RCE) via data binding. The specific exploit requires the application to run on Tomcat as a WAR deployment. If the application is deployed as a Spring Boot executable jar, i.e. the default, it is not vulnerable to the exploit. However, the nature of the vulnerability is more general, and there may be other ways to exploit it.",
//	      "Severity": "CRITICAL",
//	      "CweIDs": [
//	        "CWE-94"
//	      ],
//	      "VendorSeverity": {
//	        "ghsa": 4,
//	        "nvd": 4,
//	        "redhat": 3
//	      },
//	      "CVSS": {
//	        "ghsa": {
//	          "V3Vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
//	          "V3Score": 9.8
//	        },
//	        "nvd": {
//	          "V2Vector": "AV:N/AC:L/Au:N/C:P/I:P/A:P",
//	          "V3Vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
//	          "V2Score": 7.5,
//	          "V3Score": 9.8
//	        },
//	        "redhat": {
//	          "V3Vector": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
//	          "V3Score": 8.1
//	        }
//	      },
//	      "References": [
//	        "https://github.com/advisories/GHSA-36p3-wjmg-h94x"
//	      ],
//	      "PublishedDate": "2022-04-01T23:15:00Z",
//	      "LastModifiedDate": "2022-05-19T14:21:00Z"
//	    }
//	  ]
//	}
//
// ]
func (Spring4Shell) PostScan(results types.Results) (types.Results, error) {
	var javaMajorVersion int
	var tomcatVersion string
	for _, result := range results {
		if result.Class != "custom" {
			continue
		}

		for _, c := range result.CustomResources {
			if c.Type == TypeJavaMajor {
				v := c.Data.(string)
				ss := strings.Split(v, ".")
				if len(ss) == 0 || len(ss) < 2 {
					wasm.Warn("Invalid Java version: " + v)
					continue
				}

				ver := ss[0]
				if ver == "1" {
					ver = ss[1]
				}

				var err error
				javaMajorVersion, err = strconv.Atoi(ver)
				if err != nil {
					wasm.Warn("Invalid Java version: " + v)
					continue
				}
			} else if c.Type == TypeTomcatVersion {
				tomcatVersion = c.Data.(string)
			}
		}
	}

	wasm.Info(fmt.Sprintf("Java Version: %d, Tomcat Version: %s", javaMajorVersion, tomcatVersion))

	vulnerable := true
	// TODO: version comparison
	if tomcatVersion == "10.0.20" || tomcatVersion == "9.0.62" || tomcatVersion == "8.5.78" {
		vulnerable = false
	} else if javaMajorVersion <= 8 {
		vulnerable = false
	}

	for i, result := range results {
		for j, vuln := range result.Vulnerabilities {
			// Look up Spring4Shell
			if vuln.VulnerabilityID != "CVE-2022-22965" {
				continue
			}

			// If it doesn't satisfy any of requirements, the severity should be changed to LOW.
			if !strings.Contains(vuln.PkgPath, ".war") || !vulnerable {
				wasm.Info(fmt.Sprintf("change %s CVE-2022-22965 severity from CRITICAL to LOW", vuln.PkgName))
				results[i].Vulnerabilities[j].Severity = "LOW"
			}
		}
	}

	return results,
```

### Core Architecture Module: `magefiles/config_schema.go`
```
//go:build mage_docs

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/jsonschema-go/jsonschema"
	"github.com/samber/lo"

	"github.com/aquasecurity/trivy/pkg/flag"
)

// JSON Schema type constants
const (
	schemaTypeString  = "string"
	schemaTypeBoolean = "boolean"
	schemaTypeInteger = "integer"
	schemaTypeNumber  = "number"
	schemaTypeArray   = "array"
	schemaTypeObject  = "object"
)

const configSchemaPath = "schema/trivy-config.json"

// generateConfigSchema generates a JSON schema for trivy.yaml configuration file.
func generateConfigSchema(outputPath string, allFlagGroups []flag.FlagGroup) error {
	root := &jsonschema.Schema{
		Schema:      "https://json-schema.org/draft/2020-12/schema",
		ID:          "https://raw.githubusercontent.com/aquasecurity/trivy/main/schema/trivy-config.json",
		Type:        schemaTypeObject,
		Title:       "Trivy Configuration",
		Description: "Configuration file for Trivy security scanner (trivy.yaml)",
		Properties:  make(map[string]*jsonschema.Schema),
	}

	for _, group := range allFlagGroups {
		for _, f := range group.Flags() {
			configName := f.GetConfigName()
			if configName == "" || f.Hidden() {
				continue
			}
			if err := addFlagToSchema(root, f); err != nil {
				return err
			}
		}
	}

	data, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return err
	}

	// Ensure directory exists
	if err := os.MkdirAll("schema", 0755); err != nil {
		return err
	}

	return os.WriteFile(outputPath, data, 0644)
}

// addFlagToSchema adds a flag to the schema, creating nested objects as needed.
func addFlagToSchema(root *jsonschema.Schema, f flag.Flagger) error {
	configName := f.GetConfigName()
	parts := strings.Split(configName, ".")

	// Split into parent path and leaf name
	parentParts, leafName := parts[:len(parts)-1], parts[len(parts)-1]

	// Navigate/create intermediate objects
	current := root
	for _, part := range parentParts {
		if existing, ok := current.Properties[part]; ok {
			current = existing
		} else {
			newSchema := &jsonschema.Schema{
				Type:       schemaTypeObject,
				Properties: make(map[string]*jsonschema.Schema),
			}
			current.Properties[part] = newSchema
			current.PropertyOrder = append(current.PropertyOrder, part)
			current = newSchema
		}
	}

	// Add the leaf property
	schema, err := schemaFromFlag(f)
	if err != nil {
		return err
	}
	current.Properties[leafName] = schema
	current.PropertyOrder = append(current.PropertyOrder, leafName)
	return nil
}

// schemaFromFlag creates a JSON schema based on the flag's type, description, and allowed values.
func schemaFromFlag(f flag.Flagger) (*jsonschema.Schema, error) {
	schema, err := schemaFromFlagValue(f.GetDefaultValue())
	if err != nil {
		return nil, fmt.Errorf("flag %q: %w", f.GetConfigName(), err)
	}

	// Add description from Usage
	if usage := f.GetUsage(); usage != "" {
		schema.Description = usage
	}

	// Add enum if Values is set
	if values := f.GetValues(); len(values) > 0 {
		enumValues := make([]any, len(values))
		for i, v := range values {
			enumValues[i] = v
		}
		// For array types, enum should be in items, not at the array level
		if schema.Type == schemaTypeArray && schema.Items != nil {
			schema.Items.Enum = enumValues
		} else {
			schema.Enum = enumValues
		}
	}

	return schema, nil
}

// schemaFromFlagValue creates a JSON schema based on the flag's default value type.
func schemaFromFlagValue(val any) (*jsonschema.Schema, error) {
	switch val.(type) {
	case string:
		return &jsonschema.Schema{Type: schemaTypeString}, nil
	case bool:
		return &jsonschema.Schema{Type: schemaTypeBoolean}, nil
	case int:
		return &jsonschema.Schema{Type: schemaTypeInteger}, nil
	case float64:
		return &jsonschema.Schema{Type: schemaTypeNumber}, nil
	case []string:
		return &jsonschema.Schema{
			Type:  schemaTypeArray,
			Items: &jsonschema.Schema{Type: schemaTypeString},
		}, nil
	case time.Duration:
		return &jsonschema.Schema{Type: schemaTypeString}, nil
	case map[string][]string:
		return &jsonschema.Schema{
			Type: schemaTypeObject,
			AdditionalProperties: &jsonschema.Schema{
				Type:  schemaTypeArray,
				Items: &jsonschema.Schema{Type: schemaTypeString},
			},
		}, nil
	case []flag.MavenMirror:
		return &jsonschema.Schema{
			Type: schemaTypeArray,
			Items: &jsonschema.Schema{
				Type: schemaTypeObject,
				Properties: map[string]*jsonschema.Schema{
					"source": {
						Type:        schemaTypeString,
						Description: "URL of the mirrored Maven repository",
					},
					"targets": {
						Type:        schemaTypeArray,
						Description: "URLs of the mirrors serving the repository, tried in order",
						Items:       &jsonschema.Schema{Type: schemaTypeString},
						MinItems:    lo.ToPtr(1),
					},
				},
				PropertyOrder: []string{
					"source",
					"targets",
				},
				Required: []string{
					"source",
					"targets",
				},
			},
		}, nil
	default:
		return nil, fmt.Errorf("unknown type %T, please update schemaFromFlagValue()", val)
	}
}

```

### Core Architecture Module: `magefiles/fixture.go`
```
package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/go-containerregistry/pkg/authn"
	"github.com/google/go-containerregistry/pkg/authn/github"
	"github.com/google/go-containerregistry/pkg/crane"
	v1 "github.com/google/go-containerregistry/pkg/v1"
	"github.com/magefile/mage/sh"

	"github.com/aquasecurity/trivy/internal/testutil"
)

const dir = "integration/testdata/fixtures/images/"

var auth = crane.WithAuthFromKeychain(authn.NewMultiKeychain(authn.DefaultKeychain, github.Keychain))

func fixtureContainerImages() error {
	var testImages = testutil.ImageName("", "", "")

	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	tags, err := crane.ListTags(testImages, auth)
	if err != nil {
		return err
	}
	// Save all tags for trivy-test-images
	for _, tag := range tags {
		if err := saveImage("", tag); err != nil {
			return err
		}
	}

	// Save trivy-test-images/containerd image
	return saveImage("containerd", "latest")
}

func saveImage(subpath, tag string) error {
	fileName := tag + ".tar.gz"
	imgName := testutil.ImageName("", tag, "")
	if subpath != "" {
		fileName = subpath + ".tar.gz"
		imgName = testutil.ImageName(subpath, "", "")
	}
	filePath := filepath.Join(dir, fileName)
	if exists(filePath) {
		return nil
	}
	fmt.Printf("Downloading %s...\n", imgName)

	img, err := crane.Pull(imgName, auth)
	if err != nil {
		return err
	}
	tarPath := strings.TrimSuffix(filePath, ".gz")
	if err = crane.Save(img, imgName, tarPath); err != nil {
		return err
	}
	return sh.Run("gzip", tarPath)
}

func fixtureVMImages() error {
	var testVMImages = testutil.VMImageName("", "", "")
	const (
		titleAnnotation = "org.opencontainers.image.title"
		dir             = "integration/testdata/fixtures/vm-images/"
	)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	tags, err := crane.ListTags(testVMImages, auth)
	if err != nil {
		return err
	}
	for _, tag := range tags {
		img, err := crane.Pull(fmt.Sprintf("%s:%s", testVMImages, tag), auth)
		if err != nil {
			return err
		}

		manifest, err := img.Manifest()
		if err != nil {
			return err
		}

		layers, err := img.Layers()
		if err != nil {
			return err
		}

		for i, layer := range layers {
			fileName, ok := manifest.Layers[i].Annotations[titleAnnotation]
			if !ok {
				continue
			}
			filePath := filepath.Join(dir, fileName)
			if exists(filePath) {
				return nil
			}
			fmt.Printf("Downloading %s...\n", fileName)
			if err = saveLayer(layer, filePath); err != nil {
				return err
			}
		}
	}
	return nil
}

func saveLayer(layer v1.Layer, filePath string) error {
	f, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer f.Close()

	c, err := layer.Compressed()
	if err != nil {
		return err
	}
	if _, err = io.Copy(f, c); err != nil {
		return err
	}
	return nil
}

```

### Core Architecture Module: `magefiles/helm.go`
```
//go:build mage_helm

package main

import (
	"fmt"
	"log"
	"os"

	"github.com/aquasecurity/go-version/pkg/semver"

	"github.com/magefile/mage/sh"
	"golang.org/x/xerrors"
	"gopkg.in/yaml.v3"
)

const chartFile = "./helm/trivy/Chart.yaml"

func main() {
	trivyVersion, err := version()
	if err != nil {
		log.Fatalf("could not determine Trivy version: %v", err)
	}

	// Checkout the main branch to get the latest chart version, that was changed after the previous release
	// It needs for correctly updating the chart version of patch releases
	if err := sh.Run("git", "checkout", "main"); err != nil {
		log.Fatalf("failed to run `git checkout main`: %w", err)
	}

	newHelmVersion, err := bumpHelmChart(chartFile, trivyVersion)
	if err != nil {
		log.Fatalf("could not bump Trivy version to %q: %v", trivyVersion, err)
	}

	log.Printf("Current helm version will bump up %q with Trivy %q", newHelmVersion, trivyVersion)

	newBranch := fmt.Sprintf("ci/helm-chart/bump-trivy-to-%s", trivyVersion)
	title := fmt.Sprintf("ci(helm): bump Trivy version to %s for Trivy Helm Chart %s", trivyVersion, newHelmVersion)
	description := fmt.Sprintf("This PR bumps Trivy up to the %s version for the Trivy Helm chart %s.",
		trivyVersion, newHelmVersion)

	cmds := [][]string{
		[]string{"git", "switch", "-c", newBranch},
		[]string{"git", "add", chartFile},
		[]string{"git", "commit", "-m", title},
		[]string{"git", "push", "origin", newBranch},
		[]string{"gh", "pr", "create", "--base", "main", "--head", newBranch, "--title", title, "--body", description, "--repo", "$GITHUB_REPOSITORY"},
	}

	if err := runShCommands(cmds); err != nil {
		log.Fatal(err)
	}
	log.Print("Successfully created PR with a new helm version")
}

type Chart struct {
	Version    string `yaml:"version"`
	AppVersion string `yaml:"appVersion"`
}

// bumpHelmChart bumps up helm and trivy versions inside a file (Chart.yaml)
// it returns a new helm version and error
func bumpHelmChart(filename, trivyVersion string) (string, error) {
	input, err := os.ReadFile(filename)
	if err != nil {
		return "", xerrors.Errorf("could not read file %q: %w", filename, err)
	}
	currentHelmChart := &Chart{}
	if err := yaml.Unmarshal(input, currentHelmChart); err != nil {
		return "", xerrors.Errorf("could not unmarshal helm chart %q: %w", filename, err)
	}

	newHelmVersion, err := buildNewHelmVersion(currentHelmChart.Version, currentHelmChart.AppVersion, trivyVersion)
	if err != nil {
		return "", xerrors.Errorf("could not build new helm version: %v", err)
	}
	cmds := [][]string{
		[]string{"sed", "-i", "-e", fmt.Sprintf("s/appVersion: %s/appVersion: %s/g", currentHelmChart.AppVersion, trivyVersion), filename},
		[]string{"sed", "-i", "-e", fmt.Sprintf("s/version: %s/version: %s/g", currentHelmChart.Version, newHelmVersion), filename},
	}

	if err := runShCommands(cmds); err != nil {
		return "", xerrors.Errorf("could not update Helm Chart %q: %w", newHelmVersion, err)
	}
	return newHelmVersion, nil
}

func runShCommands(cmds [][]string) error {
	for _, cmd := range cmds {
		if err := sh.Run(cmd[0], cmd[1:]...); err != nil {
			return xerrors.Errorf("failed to run %v: %w", cmd, err)
		}
	}
	return nil
}

func buildNewHelmVersion(currentHelm, currentTrivy, newTrivy string) (string, error) {
	currentHelmVersion, err := semver.Parse(currentHelm)
	if err != nil {
		return "", xerrors.Errorf("could not parse current helm version: %w", err)
	}

	currentTrivyVersion, err := semver.Parse(currentTrivy)
	if err != nil {
		return "", xerrors.Errorf("could not parse current trivy version: %w", err)
	}

	newTrivyVersion, err := semver.Parse(newTrivy)
	if err != nil {
		return "", xerrors.Errorf("could not parse new trivy version: %w", err)
	}

	if newTrivyVersion.Major().Compare(currentTrivyVersion.Major()) > 0 {
		return currentHelmVersion.IncMajor().String(), nil
	}

	if newTrivyVersion.Minor().Compare(currentTrivyVersion.Minor()) > 0 {
		return currentHelmVersion.IncMinor().String(), nil
	}

	return currentHelmVersion.IncPatch().String(), nil
}

```

### Core Architecture Module: `magefiles/magefile.go`
```
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
	"github.com/magefile/mage/target"

	// Trivy packages should not be imported in Mage (see https://github.com/aquasecurity/trivy/pull/4242),
	// but this package doesn't have so many dependencies, and Mage is still fast.
	//mage:import gittest
	gittest "github.com/aquasecurity/trivy/internal/gittest/testdata"
	//mage:import rpm
	rpm "github.com/aquasecurity/trivy/pkg/fanal/analyzer/pkg/rpm/testdata"
	"github.com/aquasecurity/trivy/pkg/log"
)

var (
	GOPATH = os.Getenv("GOPATH")
	GOBIN  = filepath.Join(GOPATH, "bin")

	golangciLint = filepath.Join(GOBIN, "golangci-lint")

	ENV = map[string]string{
		"CGO_ENABLED": "0",
	}
)

func init() {
	slog.SetDefault(log.New(log.NewHandler(os.Stderr, nil))) // stdout is suppressed in mage
}

func version() (string, error) {
	ver, err := sh.Output("git", "describe", "--tags", "--always")
	if err != nil {
		return "", err
	}
	// Strips the v prefix from the tag
	return strings.TrimPrefix(ver, "v"), nil
}

func buildLdflags() (string, error) {
	ver, err := version()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("-s -w -X=github.com/aquasecurity/trivy/pkg/version/app.ver=%s", ver), nil
}

type Tool mg.Namespace

// Sass installs saas if not installed. npm is assumed to be available
func (Tool) Sass() error {
	if installed("sass") {
		return nil
	}
	return sh.Run("npm", "install", "-g", "saas")
}

// PipTools installs PipTools if not installed. python is assumed to be available and relevant environment to have been activated
func (Tool) PipTools() error {
	if installed("pip-compile") {
		return nil
	}
	return sh.Run("python", "-m", "pip", "install", "pip-tools")
}

// GolangciLint installs golangci-lint
func (t Tool) GolangciLint() error {
	const version = "v2.13.1"
	if exists(golangciLint) && t.matchGolangciLintVersion(golangciLint, version) {
		return nil
	}
	// TODO: use `go install tool`
	// cf. https://golangci-lint.run/welcome/install/#install-from-sources
	command := fmt.Sprintf("curl -sfL https://raw.githubusercontent.com/golangci/golangci-lint/main/install.sh | sh -s -- -b %s %s", GOBIN, version)
	return sh.Run("bash", "-c", command)
}

func (Tool) matchGolangciLintVersion(bin, version string) bool {
	out, err := sh.Output(bin, "version", "--json")
	if err != nil {
		slog.Error("Unable to get golangci-lint version", slog.Any("err", err))
		return false
	}
	var output struct {
		Version string `json:"Version"`
	}
	if err = json.Unmarshal([]byte(out), &output); err != nil {
		slog.Error("Unable to parse golangci-lint version", slog.Any("err", err))
		return false
	}

	version = strings.TrimPrefix(version, "v")
	if output.Version != version {
		slog.Info("golangci-lint version mismatch", slog.String("expected", version), slog.String("actual", output.Version))
		return false
	}
	return true
}

func (Tool) Install() error {
	log.Info("Installing tools, make sure you add $GOBIN to the $PATH")
	return sh.Run("go", "install", "tool")
}

type Protoc mg.Namespace

// Generate parses PROTO_FILES and generates the Go code for client/server mode
func (Protoc) Generate() error {
	mg.Deps(Tool{}.Install) // Install buf and protoc-gen-twirp

	// Run buf generate
	return sh.RunV("buf", "generate")
}

// Fmt formats protobuf files using buf
func (Protoc) Fmt() error {
	mg.Deps(Tool{}.Install) // Install buf

	// Run buf format
	return sh.RunV("buf", "format", "-w")
}

// Lint runs linting on protobuf files using buf
func (Protoc) Lint() error {
	mg.Deps(Tool{}.Install) // Install buf

	// Run buf lint
	return sh.RunV("buf", "lint")
}

// Breaking checks for breaking changes in protobuf files using buf
func (Protoc) Breaking() error {
	mg.Deps(Tool{}.Install) // Install buf

	// Run buf breaking against main branch
	return sh.RunV("buf", "breaking", "--against", ".git#branch=main")
}

// Yacc generates parser
func Yacc() error {
	mg.Deps(Tool{}.Install) // Install yacc
	return sh.Run("go", "generate", "./pkg/licensing/expression/...")
}

type Test mg.Namespace

// FixtureContainerImages downloads and extracts required images
func (Test) FixtureContainerImages() error {
	return fixtureContainerImages()
}

// FixtureVMImages downloads and extracts required VM images
func (Test) FixtureVMImages() error {
	return fixtureVMImages()
}

// FixtureTerraformPlanSnapshots generates Terraform Plan files in test folders
func (Test) FixtureTerraformPlanSnapshots() error {
	return fixtureTerraformPlanSnapshots(context.TODO())
}

// GenerateModules compiles WASM modules for unit tests
func (Test) GenerateModules() error {
	pattern := filepath.Join("pkg", "module", "testdata", "*", "*.go")
	return compileWasmModules(pattern)
}

// GenerateExampleModules compiles example Wasm modules for integration tests
func (Test) GenerateExampleModules() error {
	pattern := filepath.Join("examples", "module", "*", "*.go")
	return compileWasmModules(pattern)
}

// UpdateGolden updates golden files for integration tests
func (Test) UpdateGolden() error {
	return sh.RunWithV(ENV, "go", "test", "-tags=integration", "./integration/...", "./pkg/fanal/test/integration/...", "-update")
}

func compileWasmModules(pattern string) error {
	goFiles, err := filepath.Glob(pattern)
	if err != nil {
		return err
	}

	for _, src := range goFiles {
		// e.g. examples/module/spring4shell/spring4shell.go
		//   => examples/module/spring4shell/spring4shell.wasm
		dst := strings.TrimSuffix(src, ".go") + ".wasm"
		if updated, err := target.Path(dst, src); err != nil {
			return err
		} else if !updated {
			continue
		}
		envs := map[string]string{
			"GOOS":   "wasip1",
			"GOARCH": "wasm",
		}
		if err = sh.RunWith(envs, "go", "generate", src); err != nil {
			return err
		}
	}
	return nil
}

// Unit runs unit tests
func (t Test) Unit() error {
	mg.Deps(t.GenerateModules, rpm.Fixtures, gittest.Fixtures)
	return sh.RunWithV(ENV, "go", "test", "-v", "-short", "-coverprofile=coverage.txt", "-covermode=atomic", "./...")
}

// Integration runs integration tests
func (t Test) Integration() error {
	mg.Deps(t.FixtureContainerImages)
	return sh.RunWithV(ENV, "go", "test", "-timeout", "15m", "-v", "-tags=integration", "./integration/...", "./pkg/fanal/test/integration/...")
}

// K8s runs k8s integration tests
func (t Test) K8s() error {
	mg.Deps(Tool{}.Install) // Install kind
	err := sh.RunWithV(ENV, "kind", "create", "cluster", "--name", "kind-test", "--image", "kindest/node:v1.27.1@sha256:b7d12ed662b873bd8510879c1846e87c7e676a79fefc93e17b2a52989d3ff42b")
	if err != nil {
		return err
	}
	defer func() {
		_ = sh.RunWithV(ENV, "kind", "delete", "cluster", "--name", "kind-test")
	}()
	// wait for the kind cluster is running correctly
	err = sh.RunWithV(ENV, "kubectl", "wait", "--for=condition=Ready", "nodes", "--all", "--timeout=300s")
	if err != nil {
		return fmt.Errorf("can't wait for the kind cluster: %w", err)
	}

	err = sh.RunWithV(ENV, "kubectl", "apply", "-f", "./integration/testdata/fixtures/k8s/test_nginx.yaml")
	if err != nil {
		return fmt.Errorf("can't create a test deployment: %w", err)
	}

	// create an environment for limited user test
	err = initk8sLimitedUserEnv()
	if err != nil {
		return fmt.Errorf("can't create environment for limited user: %w", err)
	}

	// wait for all pods are running correctly
	err = sh.RunWithV(ENV, "kubectl", "wait", "--for=condition=Ready", "pod", "--all", "--all-namespaces", "--timeout=300s")
	if err != nil {
		return fmt.Errorf("can't wait for the pods: %w", err)
	}

	// print all resources for info
	err = sh.RunWithV(ENV, "kubectl", "get", "all", "-A")
	if err != nil {
		return fmt.Errorf("can't get workloads: %w", err)
	}
	err = sh.RunWithV(ENV, "kubectl", "get", "cm", "-A")
	if err != nil {
		return fmt.Errorf("can't get configmaps: %w", err)
	}

	return sh.RunWithV(ENV, "go", "test", "-v", "-tags=k8s_integration", "./integration/...")
}


```

### Core Architecture Module: `magefiles/schema.go`
```
//go:build mage_schema

package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"log"
	"os"

	"github.com/aquasecurity/trivy/pkg/iac/rego/schemas"
)

const (
	schemaPath = "pkg/iac/rego/schemas/cloud.json"
)

func main() {
	if len(os.Args) < 3 {
		log.Fatalf("invalid schema command args: %s", os.Args)
	}

	switch os.Args[2] {
	case "generate":
		if err := GenSchema(); err != nil {
			log.Fatalf(err.Error())
		}
		log.Println("schema generated")
	case "verify":
		if err := VerifySchema(); err != nil {
			log.Fatalf(err.Error())
		}
		log.Println("schema valid")
	}
}

// GenSchema generates the Trivy IaC schema
func GenSchema() error {
	schema, err := schemas.Build()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(schema, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(schemaPath, data, 0o600); err != nil {
		return err
	}
	return nil
}

// VerifySchema verifies a generated schema for validity
func VerifySchema() error {
	schema, err := schemas.Build()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(schema, "", "  ")
	if err != nil {
		return err
	}
	existing, err := os.ReadFile(schemaPath)
	if err != nil {
		return err
	}
	if !bytes.Equal(data, existing) {
		return errors.New("schema is out of date:\n\nplease run 'mage schema:generate' and commit the changes\n")
	}
	return nil
}

```

### Core Architecture Module: `magefiles/spdx.go`
```
//go:build mage_spdx

package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/samber/lo"
	"golang.org/x/xerrors"

	"github.com/aquasecurity/trivy/pkg/downloader"
	"github.com/aquasecurity/trivy/pkg/licensing"
	"github.com/aquasecurity/trivy/pkg/log"
	"github.com/aquasecurity/trivy/pkg/set"
	xslices "github.com/aquasecurity/trivy/pkg/x/slices"
)

const (
	expressionDir = "./pkg/licensing/expression"

	exceptionFileName = "exceptions.json"
	exceptionURL      = "https://spdx.org/licenses/exceptions.json"

	licenseFileName = "licenses.json"
	licenseURL      = "https://spdx.org/licenses/licenses.json"
)

func main() {
	log.InitLogger(false, false)
	if err := run(); err != nil {
		log.Fatal("Fatal error", log.Err(err))
	}

}

type Exceptions struct {
	Exceptions []Exception `json:"exceptions"`
}

type Exception struct {
	ID string `json:"licenseExceptionId"`
}

// run downloads SPDX licenses and exceptions and writes them into the `expression` package:
// exceptions as a flat array of IDs, and licenses as a map of ID to its normalized seeAlso URLs.
func run() error {
	if err := updateLicenses(); err != nil {
		return err
	}
	return updateExceptions()
}

func updateExceptions() error {
	b, err := fetch(exceptionURL, exceptionFileName)
	if err != nil {
		return err
	}

	var exceptions Exceptions
	if err := json.Unmarshal(b, &exceptions); err != nil {
		return xerrors.Errorf("unable to unmarshal exceptions.json file: %w", err)
	}

	exs := xslices.Map(exceptions.Exceptions, func(ex Exception) string { return ex.ID })
	sort.Strings(exs)
	return writeJSON(filepath.Join(expressionDir, exceptionFileName), exs)
}

type Licenses struct {
	Licenses []License `json:"licenses"`
}

type License struct {
	ID string `json:"licenseId"`
	// SeeAlso lists the upstream license URLs (e.g. https://www.apache.org/licenses/LICENSE-2.0).
	// Inverting these gives a URL -> SPDX-ID index for values that appear as URLs
	// (OSGi Bundle-License headers, pom <url> fallbacks).
	SeeAlso []string `json:"seeAlso"`
}

func updateLicenses() error {
	b, err := fetch(licenseURL, licenseFileName)
	if err != nil {
		return err
	}

	var licenses Licenses
	if err := json.Unmarshal(b, &licenses); err != nil {
		return xerrors.Errorf("unable to unmarshal licenses.json file: %w", err)
	}

	// result maps each SPDX license ID to its normalized seeAlso URLs. Every ID is
	// added up front (even with no URL) so the map doubles as the SPDX license ID
	// list used for validation.
	result := make(map[string][]string, len(licenses.Licenses))
	for _, l := range licenses.Licenses {
		if l.ID != "" {
			result[l.ID] = []string{}
		}
	}

	// Collect every license that references each normalized URL.
	urlToIDs := make(map[string][]string)
	for _, l := range licenses.Licenses {
		if l.ID == "" {
			continue
		}
		seen := set.New[string]() // dedup URLs within a single license
		for _, raw := range l.SeeAlso {
			u := licensing.NormalizeLicenseURL(raw)
			if u == "" {
				continue
			}
			if seen.Contains(u) {
				continue
			}
			seen.Append(u)
			urlToIDs[u] = append(urlToIDs[u], l.ID)
		}
	}

	// Attach each URL to the license it identifies; every such ID is a real SPDX license, so it is a key in result.
	// Walking the URLs in sorted order keeps the generated lists (and the warnings) out of Go's randomized map iteration order,
	// so regenerating the committed file does not reshuffle it.
	urls := lo.Keys(urlToIDs)
	sort.Strings(urls)
	for _, u := range urls {
		if id, ok := licenseForURL(u, urlToIDs[u]); ok {
			result[id] = append(result[id], u)
		}
	}

	return writeJSON(filepath.Join(expressionDir, licenseFileName), result)
}

// licenseForURL picks the license a URL identifies among the IDs that reference it, and reports false when it identifies none.
// IDs of one only/or-later/+ family point at the same license text, and nothing in the URL says whether the licensor also granted "or later",
// so within a family the URL identifies the -only variant and nothing else.
// SPDX reads the deprecated bare ID that way too: it names "GPL-2.0" "GNU General Public License v2.0 only", which is also the name it gives "GPL-2.0-only".
func licenseForURL(url string, ids []string) (string, bool) {
	if len(ids) == 1 {
		return ids[0], true
	}

	stems := set.New[string]()
	for _, id := range ids {
		stems.Append(licenseStem(id))
	}
	if stems.Size() > 1 {
		log.Warn("Dropping ambiguous license URL shared by different licenses",
			log.String("url", url), log.String("licenses", strings.Join(ids, ", ")))
		return "", false
	}

	for _, id := range ids {
		if strings.HasSuffix(id, "-only") {
			return id, true
		}
	}
	log.Warn("Dropping license URL shared by variants of one license that has no -only form",
		log.String("url", url), log.String("licenses", strings.Join(ids, ", ")))
	return "", false
}

// licenseStem strips a trailing +, -only or -or-later suffix from an SPDX license
// ID, mapping only/or-later/+ variants to their shared base (e.g. "GPL-3.0-only"
// and "GPL-3.0+" both -> "GPL-3.0").
func licenseStem(id string) string {
	for _, suffix := range []string{"-or-later", "-only", "+"} {
		if s, ok := strings.CutSuffix(id, suffix); ok {
			return s
		}
	}
	return id
}

// fetch downloads a SPDX index file and returns its contents.
func fetch(url, tmpFileName string) ([]byte, error) {
	tmpDir, err := downloader.DownloadToTempDir(context.Background(), url, downloader.Options{})
	if err != nil {
		return nil, xerrors.Errorf("unable to download %s: %w", tmpFileName, err)
	}
	b, err := os.ReadFile(filepath.Join(tmpDir, tmpFileName))
	if err != nil {
		return nil, xerrors.Errorf("unable to read %s: %w", tmpFileName, err)
	}
	return b, nil
}

func writeJSON(path string, v any) error {
	f, err := os.Create(path)
	if err != nil {
		return xerrors.Errorf("unable to create file %s: %w", path, err)
	}
	defer f.Close()

	b, err := json.Marshal(v)
	if err != nil {
		return xerrors.Errorf("unable to marshal %s: %w", path, err)
	}
	if _, err = f.Write(b); err != nil {
		return xerrors.Errorf("unable to write %s: %w", path, err)
	}
	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11079** (2026-08-12): **bug(misconf): check aliases are lost when misconfigurations are uploaded to the server**
  *Symptoms*:  ### Discussed in https://github.com/aquasecurity/trivy/discussions/11052  Misconfigurations are scanned on the client, uploaded to the server as part of the blob, and turned back into findings by the server. `PolicyMetadata` in the blob upload message has no `aliases` field, so the server builds findings with an empty alias list, and ignore rules that refer to a check by an alias (`AVD-DS-0002`, `DS004`, `no-ssh-port`, …) match nothing.  The result is that the same ignore file works in standalone mode and silently does nothing in client/server mode.  ### Fix   Add the field to `rpc/common/service.proto` and carry them over in `pkg/rpc/convert.go`.  ### Note  Upgrades need both sides updated. Blobs uploaded by an older client hold no aliases, so where the blob key is content-based (images, clean git repositories) the server's scan cache has to be refreshed before the fix takes effect.

- **Issue #11048** (2026-08-05): **bug(terraform): panic in localHasDynamicValues when for_each local has unknown nested objects**
  *Symptoms*: Original issue: https://github.com/aquasecurity/trivy/issues/11035  Trivy panics when expanding a `for_each` that references a `local` whose map entries contain **unknown nested object values** (e.g. unresolved module output references). The evaluator calls `cty.Value.AsValueMap()` without checking `IsKnown()` on nested values.  ``` panic: can't use ElementIterator on unknown value  goroutine 1 [running]: github.com/zclconf/go-cty/cty.Value.AsValueMap(...) github.com/aquasecurity/trivy/pkg/iac/scanners/terraform/parser.(*evaluator).localHasDynamicValues(...) github.com/aquasecurity/trivy/pkg/iac/scanners/terraform/parser.(*evaluator).shouldDeferForEachExpansion(...) ```  ## Version  Trivy v0.72.0 (also observed on earlier versions with `shouldDeferForEachExpansion` / `localHasDynamicValues`)  ## Steps to reproduce  1. Define a `local` map where some entries reference module outputs (e.g. `dead_letter_target_arn = module.deadletter_queue["default_dlq"].arn`). 2. Use that local in a module `for_each`, e.g. `for_each = local.sqs_settings` or a filtered expression over the same local. 3. Scan without full module resolution (modules not downloaded, or outputs still unknown during static eval). Optionally omit `--tf-vars` so conditionals on `var.environment` also remain unknown. 4. Run:  ```bash trivy config . --debug # or trivy fs --scanners misconfig /path/to/terraform ```  ## Expected behavior  Trivy should defer `for_each` expansion or skip safely (debug log), consistent with o
  **Post-Mortem & Fix Analysis**:
  > Fixed via https://github.com/aquasecurity/trivy/pull/11019

- **Issue #10723** (2026-05-27): **fix(misconf): skip null cty values in AsMapValue to prevent panic**
  *Symptoms*: ## Description  Added a check to ensure that the keys and values of the maps are not zero.  ## Related issues - Close https://github.com/aquasecurity/trivy/issues/10720  ## Checklist - [x] I've read the [guidelines for contributing](https://trivy.dev/docs/latest/community/contribute/pr/) to this repository. - [x] I've followed the [conventions](https://trivy.dev/docs/latest/community/contribute/pr/#title) in the PR title. - [x] I've added tests that prove my fix is effective or that my feature works. - [ ] I've updated the [documentation](https://github.com/aquasecurity/trivy/blob/main/docs) with the relevant information (if needed). - [ ] I've added usage information (if the PR introduces new options) - [ ] I've included a "before" and "after" example to the description (if the PR is a user interface change). 

- **Issue #10720** (2026-05-27): **bug(terraform): AsMapValue panics on null map element**
  *Symptoms*: Terraform scanner panics with `panic: value is null` when scanning a module containing a `map`/`object` attribute where any value references an unresolved variable.  `Attribute.AsMapValue` iterates over map elements via `ForEachElement` and calls `val.AsString()` guarded only by `val.IsKnown()`. In cty, a null value is *known*, so the guard passes and `AsString()` panics.  Example config: ```tf variable "project_number" {   type = string }  resource "google_container_cluster" "primary" {   name     = "demo"   location = "us-central1"    workload_identity_config {     workload_pool = "${var.project_number}.svc.id.goog"   } } ```  ### Discussed in https://github.com/aquasecurity/trivy/discussions/10700 
  **Post-Mortem & Fix Analysis**:
  > @nikpivkin I can work on this. The fix looks straightforward:     add a `!val.IsNull()` check alongside `val.IsKnown()` before     calling `AsString()` in AsMapValue. Should I start with a test     using the minimal repro, then the fix?

- **Issue #9259** (2025-08-25): **fix(cli): unexpected ordering in trivy args records the wrong command**
  *Symptoms*: If the user calls Trivy in a way that isn't "expected", such as `trivy -d --scanners vuln image nginx`, this is perfectly valid execution but the incorrect command is picked up.  Update the creation of the versionChecker to use the `targetKind` rather than infering the target from the first OS argument
  **Post-Mortem & Fix Analysis**:
  > This was resolved in #9260 

- **Issue #8616** (2025-03-27): **bug(k8s): `--report=all` yields no results even when results are present**
  *Symptoms*: ### Passing `--report=all` does not show any results ```shell ➜  ~/repos/trivy/trivy.main k8s  --scanners=vuln --report all 2025-03-26T14:58:05-06:00	INFO	Node scanning is enabled 2025-03-26T14:58:05-06:00	INFO	If you want to disable Node scanning via an in-cluster Job, please try '--disable-node-collector' to disable the Node-Collector job. 2025-03-26T14:58:05-06:00	INFO	Scanning K8s...	K8s="kind-kind-cluster" 248 / 248 [----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------] 100.00% 22 p/s ```  ### Passing `--report=summary` works fine  ```shell ➜  ~/repos/trivy/trivy.main k8s  --scanners=vuln --report summary 2025-03-26T14:48:57-06:00	INFO	Node scanning is enabled 2025-03-26T14:48:57-06:00	INFO	If you want to disable Node scanning via an in-cluster Job, please try '--disable-node-collector' to disable the Node-Collector job. 2025-03-26T14:48:57-06:00	INFO	Scanning K8s...	K8s="kind-kind-cluster" 248 / 248 [----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------] 100.00% 22 p/s  Summary Report for kind-kind-cluster   Workload Assessment ┌────────────────────┬─────────────────────────────────────┬─────────────────────
  **Post-Mortem & Fix Analysis**:
  > @DmitriyLewen fixes it https://github.com/aquasecurity/trivy/pull/8613
  > Fixed via https://github.com/aquasecurity/trivy/pull/8613

- **Issue #8611** (2025-04-05): **bug(k8s): `--include-non-failures` shows incorrect results in trivy k8s scanner**
  *Symptoms*: Without the flag, the results are correct. ``` trivy k8s --include-namespaces=ingress-nginx--scanners=misconfig --report=summary 2025-03-25T23:46:13-06:00	INFO	Node scanning is enabled 2025-03-25T23:46:13-06:00	INFO	If you want to disable Node scanning via an in-cluster Job, please try '--disable-node-collector' to disable the Node-Collector job. 2025-03-25T23:46:13-06:00	INFO	Scanning K8s...	K8s="kind-kind-cluster"  Summary Report for kind-kind-cluster   Workload Assessment ┌───────────────┬────────────────────────────────────────────┬───────────────────┐ │   Namespace   │                  Resource                  │ Misconfigurations │ │               │                                            ├───┬───┬───┬───┬───┤ │               │                                            │ C │ H │ M │ L │ U │ ├───────────────┼────────────────────────────────────────────┼───┼───┼───┼───┼───┤ │ ingress-nginx │ Job/ingress-nginx-admission-create         │   │   │ 3 │ 6 │   │ │ ingress-nginx │ Job/ingress-nginx-admission-patch          │   │   │ 3 │ 6 │   │ │ ingress-nginx │ Service/ingress-nginx-controller           │   │   │   │ 2 │   │ │ ingress-nginx │ Service/ingress-nginx-controller-admission │   │   │   │ 2 │   │ │ ingress-nginx │ Deployment/ingress-nginx-controller        │   │ 2 │ 5 │ 6 │   │ └───────────────┴────────────────────────────────────────────┴───┴───┴───┴───┴───┘ Severities: C=CRITICAL H=HIGH M=MEDIUM L=LOW U=UNKNOWN   Infra Assessment ┌──────

- **Issue #8246** (2025-03-03): **bug(k8s): Trivy doesn't detect `amazon linux` from KBOM**
  *Symptoms*: Trivy doesn't detect correctly `amazon linux` from a generated KBOM. SBOM scan shows next warning: ```sh 2024-12-18T18:51:48Z	WARN	Unsupported os	family="amazon linux" ``` it happens because `ftypes.Amazon` is `amazon` instead of `amazon linux`, and there is no a scanner for the last one: https://github.com/aquasecurity/trivy/blob/011012a8b4d8add049140b3996239a8358fd4202/pkg/fanal/types/const.go#L26 https://github.com/aquasecurity/trivy/blob/011012a8b4d8add049140b3996239a8358fd4202/pkg/detector/ospkg/detect.go#L35  ### Discussed in https://github.com/aquasecurity/trivy/discussions/8129#discussioncomment-11609365 

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

### Incident Patch 1: `3683d7d4` (2026-09-30)
**Commit Message**: fix(crypto): read RSA private keys without validating their math (#11319)

**File**: `pkg/crypto/parser/x509/export_test.go` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+package x509
+
+// Bridge to expose the ASN.1 structures the parser reads to tests in the x509_test package.
+
+// EncryptedPrivateKeyInfo exports encryptedPrivateKeyInfo for testing.
+type EncryptedPrivateKeyInfo = encryptedPrivateKeyInfo
+
+// PKCS1PrivateKey exports pkcs1PrivateKey for testing.
+type PKCS1PrivateKey = pkcs1PrivateKey
+
+// PKCS1AdditionalPrime exports pkcs1AdditionalPrime for testing.
+type PKCS1AdditionalPrime = pkcs1AdditionalPrime
+
+// PKCS8PrivateKey exports pkcs8PrivateKey for testing.
+type PKCS8PrivateKey = pkcs8PrivateKey
+
+// OIDRSAEncryption exports oidRSAEncryption for testing.
+var OIDRSAEncryption = oidRSAEncryption
```

**File**: `pkg/crypto/parser/x509/parser.go` (modified, +89/-19)
```diff
@@ -14,6 +14,7 @@ import (
 	"encoding/pem"
 	"errors"
 	"iter"
+	"math/big"
 
 	ftypes "github.com/aquasecurity/trivy/pkg/fanal/types"
 	"github.com/aquasecurity/trivy/pkg/log"
@@ -74,6 +75,33 @@ type encryptedPrivateKeyInfo struct {
 	EncryptedData []byte
 }
 
+// pkcs1PrivateKey is an RSA private key in PKCS#1, as defined in RFC 8017.
+type pkcs1PrivateKey struct {
+	Version          int
+	N                *big.Int
+	E                int
+	D, P, Q          *big.Int
+	Dp               *big.Int               `asn1:"optional"`
+	Dq               *big.Int               `asn1:"optional"`
+	Qinv             *big.Int               `asn1:"optional"`
+	AdditionalPrimes []pkcs1AdditionalPrime `asn1:"optional,omitempty"`
+}
+
+// pkcs1AdditionalPrime is a prime of a multi-prime RSA private key, with its CRT values.
+type pkcs1AdditionalPrime struct {
+	Prime, Exp, Coeff *big.Int
+}
+
+// pkcs8PrivateKey is a private key in PKCS#8, as defined in RFC 5208, without its
+// optional attributes.
+type pkcs8PrivateKey struct {
+	Version    int
+	Algo       pkix.AlgorithmIdentifier
+	PrivateKey []byte
+}
+
+var oidRSAEncryption = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 1, 1}
+
 var (
 	errNotCryptographic  = errors.New("not cryptographic")
 	errUnsupportedCrypto = errors.New("unsupported cryptographic object")
@@ -224,23 +252,11 @@ func parsePEMObject(label string, der []byte) (object, error) {
 	case "CERTIFICATE":
 		return certificateObject(der)
 	case "PRIVATE KEY":
-		privateKey, err := stdx509.ParsePKCS8PrivateKey(der)
-		if err != nil {
-			return object{}, errMalformedCrypto
-		}
-		return privateKeyToObject(privateKey, ftypes.CryptoKeyFormatPKCS8)
+		return pkcs8PrivateKeyObject(der)
 	case "RSA PRIVATE KEY":
-		privateKey, err := stdx509.ParsePKCS1PrivateKey(der)
-		if err != nil {
-			return object{}, errMalformedCrypto
-		}
-		return privateKeyToObject(privateKey, ftypes.CryptoKeyFormatPKCS1)
+		return rsaPrivateKeyObject(der, ftypes.CryptoKeyFormatPKCS1)
 	case "EC PRIVATE KEY":
-		privateKey, err := stdx509.ParseECPrivateKey(der)
-		if err != nil {
-			return object{}, errMalformedCrypto
-		}
-		return privateKeyToObject(privateKey, ftypes.CryptoKeyFormatSEC1)
+		return privateKeyObject(der, ftypes.CryptoKeyFormatSEC1, stdx509.ParseECPrivateKey)
 	case "PUBLIC KEY":
 		publicKey, err := stdx509.ParsePKIXPublicKey(der)
 		if err != nil {
@@ -277,18 +293,72 @@ func parsePEMObject(label string, der []byte) (object, error) {
 	}
 }
 
+// privateKeyObject parses a private key and projects it to its public key.
+func privateKeyObject[K any](der []byte, format ftypes.CryptoKeyFormat, parseKey func([]byte) (K, error)) (object, error) {
+	privateKey, err := parseKey(der)
+	if err != nil {
+		return object{}, errMalformedCrypto
+	}
+	return privateKeyToObject(privateKey, format)
+}
+
+// pkcs8PrivateKeyObject parses a private key in PKCS#8 and projects it to its public key.
+func pkcs8PrivateKeyObject(der []byte) (object, error) {
+	var key pkcs8PrivateKey
+	if _, err := asn1.Unmarshal(der, &key); err == nil && key.Algo.Algorithm.Equal(oidRSAEncryption) {
+		return rsaPrivateKeyObject(key.PrivateKey, ftypes.CryptoKeyFormatPKCS8)
+	}
+	return privateKeyObject(der, ftypes.CryptoKeyFormatPKCS8, stdx509.ParsePKCS8PrivateKey)
+}
+
+// rsaPrivateKeyObject reads an RSA private key in PKCS#1 and projects it to its public key.
+// It checks the structure of the key but not its math, because crypto/x509 validates a key
+// with arithmetic whose cost grows with the size of its values, and a crafted key picks
+// them freely.
+func rsaPrivateKeyObject(der []byte, format ftypes.CryptoKeyFormat) (object, error) {
+	var key pkcs1PrivateKey
+	rest, err := asn1.Unmarshal(der, &key)
+	if err != nil || len(rest) > 0 {
+		return object{}, errMalformedCrypto
+	}
+	if key.Version < 0 || key.Version > 1 || key.E <= 0 {
+		return object{}, errMalformedCrypto
+	}
+	for _, v := range []*big.Int{key.N, key.D, key.P, key.Q} {
+		if v.Sign() <= 0 {
+			return ob
```

**File**: `pkg/crypto/parser/x509/parser_test.go` (modified, +110/-6)
```diff
@@ -37,11 +37,25 @@ var oidPBES2 = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 5, 13}
 // parsedFilePath is the path every fixture is parsed from.
 const parsedFilePath = "candidate.pem"
 
-// encryptedPrivateKeyInfo is the RFC 5958 envelope, which the parser validates without
-// opening.
-type encryptedPrivateKeyInfo struct {
-	Algorithm     pkix.AlgorithmIdentifier
-	EncryptedData []byte
+// rsaPrivateKeyDER encodes a structurally valid 2048-bit RSA key in PKCS#1 after applying
+// mutate to it. Its values are not consistent with each other.
+func rsaPrivateKeyDER(t *testing.T, mutate func(*cryptox509.PKCS1PrivateKey)) []byte {
+	t.Helper()
+	one := big.NewInt(1)
+	key := cryptox509.PKCS1PrivateKey{
+		N:    new(big.Int).Lsh(one, 2047),
+		E:    65537,
+		D:    one,
+		P:    one,
+		Q:    one,
+		Dp:   one,
+		Dq:   one,
+		Qinv: one,
+	}
+	mutate(&key)
+	der, err := asn1.Marshal(key)
+	require.NoError(t, err)
+	return der
 }
 
 // found states what an input was recognized as.
@@ -61,6 +75,26 @@ func TestParse(t *testing.T) {
 		"DEK-Info":  "AES-256-CBC,00112233445566778899AABBCCDDEEFF",
 	}
 	rfc1423Ciphertext := []byte{0x01, 0x02, 0x03, 0x04}
+	// P is longer than the modulus.
+	invalidRSAKey := rsaPrivateKeyDER(t, func(k *cryptox509.PKCS1PrivateKey) {
+		k.P = new(big.Int).Lsh(big.NewInt(1), 24575)
+	})
+	// crypto/x509 reads a key that omits its CRT values.
+	rsaKeyWithoutCRT := rsaPrivateKeyDER(t, func(k *cryptox509.PKCS1PrivateKey) {
+		k.Dp, k.Dq, k.Qinv = nil, nil, nil
+	})
+	rsaKeyWithZeroPrime := rsaPrivateKeyDER(t, func(k *cryptox509.PKCS1PrivateKey) {
+		k.Version = 1
+		k.AdditionalPrimes = []cryptox509.PKCS1AdditionalPrime{{Prime: big.NewInt(0), Exp: big.NewInt(1), Coeff: big.NewInt(1)}}
+	})
+	invalidRSAKeyPKCS8, err := asn1.Marshal(cryptox509.PKCS8PrivateKey{
+		Algo: pkix.AlgorithmIdentifier{
+			Algorithm:  cryptox509.OIDRSAEncryption,
+			Parameters: asn1.NullRawValue,
+		},
+		PrivateKey: invalidRSAKey,
+	})
+	require.NoError(t, err)
 
 	pemCertificate := found{
 		kind:     ftypes.CryptoKindCertificate,
@@ -371,6 +405,36 @@ func TestParse(t *testing.T) {
 			name:  "PKCS8 under RSA PRIVATE KEY",
 			input: pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: fixtures.pkcs8DER}),
 		},
+		{
+			name:  "invalid RSA key PKCS1 PEM",
+			input: pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: invalidRSAKey}),
+			want:  []found{pemPKCS1PrivateKey},
+		},
+		{
+			name:  "invalid RSA key PKCS8 PEM",
+			input: pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: invalidRSAKeyPKCS8}),
+			want:  []found{pemPKCS8PrivateKey},
+		},
+		{
+			name:  "RSA key without CRT values PKCS1 PEM",
+			input: pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: rsaKeyWithoutCRT}),
+			want:  []found{pemPKCS1PrivateKey},
+		},
+		{
+			name:  "RSA key with zero additional prime PKCS1 PEM",
+			input: pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: rsaKeyWithZeroPrime}),
+		},
+		{
+			name:  "invalid RSA key PKCS1 DER",
+			input: invalidRSAKey,
+			want: []found{{
+				kind:     ftypes.CryptoKindKey,
+				keyType:  ftypes.CryptoKeyTypePrivate,
+				method:   ftypes.CryptoMethodSPKISHA256,
+				format:   ftypes.CryptoKeyFormatPKCS1,
+				encoding: ftypes.CryptoEncodingDER,
+			}},
+		},
 		{
 			name:  "certificate request under CERTIFICATE",
 			input: pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: fixtures.csrDER}),
@@ -815,6 +879,31 @@ func TestParseAssets(t *testing.T) {
 				at(rsaAlgorithm),
 			},
 		},
+		{
+			name:  "multi-prime private key",
+			input: fixtures.multiPrimePEM,
+			want: []ftypes.CryptoAsset{
+				{
+					CryptoAssetInfo: ftypes.CryptoAssetInfo{
+						Kind:     ftypes.CryptoKindKey,
+						KeyType:  ftypes.CryptoKeyTypePrivate,
+						Identity: spkiIdentity(t, fixtures.multiPrimePublic),
+						Name:     "RSA-2048 private key",
+						Key: &ftypes.CryptoKey{
+							Size: 2048,
+						},
+						Relationships: []ftypes.CryptoRelationship{
```

---

### Incident Patch 2: `a072319a` (2026-09-30)
**Commit Message**: fix(python): support uv workspace lockfiles (#10553)

Co-authored-by: DmitriyLewen <dmitriy.lewen@smartforce.io>

**File**: `docs/guide/scanner/vulnerability.md` (modified, +1/-1)
```diff
@@ -324,7 +324,7 @@ This feature allows you to focus on vulnerabilities in specific types of depende
 In Trivy, there are four types of package relationships:
 
 1. `root`: The root package being scanned
-2. `workspace`: Workspaces of the root package (Currently only `pom.xml`, `yarn.lock` and `cargo.lock` files are supported)
+2. `workspace`: Workspaces of the root package (Currently only `pom.xml`, `yarn.lock`, `cargo.lock` and `uv.lock` files are supported)
 3. `direct`: Direct dependencies of the root/workspace package
 4. `indirect`: Transitive dependencies
 5. `unknown`: Packages whose relationship cannot be determined
```

**File**: `pkg/dependency/parser/python/uv/parse.go` (modified, +59/-32)
```diff
@@ -2,6 +2,7 @@ package uv
 
 import (
 	"context"
+	"slices"
 	"sort"
 
 	"github.com/BurntSushi/toml"
@@ -15,6 +16,7 @@ import (
 )
 
 type Lock struct {
+	Manifest Manifest  `toml:"manifest"`
 	Packages []Package `toml:"package"`
 }
 
@@ -24,41 +26,61 @@ func (l Lock) packages() map[string]Package {
 	})
 }
 
-func prodDeps(root Package, packages map[string]Package) set.Set[string] {
+type Manifest struct {
+	Members []string `toml:"members"`
+}
+
+// prodDeps returns the names of all production dependencies: every package reachable from
+// the root package or a workspace member by following non-dev dependencies.
+func prodDeps(root string, workspaces set.Set[string], packages map[string]Package) set.Set[string] {
 	visited := set.New[string]()
-	walkPackageDeps(root, packages, visited)
+	if root != "" {
+		walkPackageDeps(root, packages, visited)
+	}
+	for name := range workspaces.Iter() {
+		walkPackageDeps(name, packages, visited)
+	}
 	return visited
 }
 
-func walkPackageDeps(pkg Package, packages map[string]Package, visited set.Set[string]) {
-	if visited.Contains(pkg.Name) {
+func walkPackageDeps(name string, packages map[string]Package, visited set.Set[string]) {
+	if visited.Contains(name) {
 		return
 	}
-	visited.Append(pkg.Name)
+	pkg, exists := packages[name]
+	if !exists {
+		return
+	}
+	visited.Append(name)
 	for depName := range pkg.nonDevDeps().Iter() {
-		depPkg, exists := packages[depName]
-		if !exists {
-			continue
-		}
-		walkPackageDeps(depPkg, packages, visited)
+		walkPackageDeps(depName, packages, visited)
 	}
 }
 
-func (l Lock) root() (Package, error) {
-	var pkgs []Package
+// rootAndWorkspaces walks the lockfile packages once and returns the name of the root
+// package (empty if there is none), the set of workspace member names, and the set of
+// direct dependency names collected from the root and every workspace member. The root
+// and workspaces are the entry points of the dependency graph: everything reachable from
+// them is a production dependency.
+func (l Lock) rootAndWorkspaces() (root string, workspaces, directDeps set.Set[string], err error) {
+	workspaces = set.New[string]()
+	directDeps = set.New[string]()
+
 	for _, pkg := range l.Packages {
-		if pkg.isRoot() {
-			pkgs = append(pkgs, pkg)
+		switch {
+		case pkg.isRoot():
+			if root != "" {
+				return "", nil, nil, xerrors.New("uv lockfile must contain 1 root package")
+			}
+			root = pkg.Name
+			directDeps.Append(pkg.directDeps().Items()...)
+		case slices.Contains(l.Manifest.Members, pkg.Name):
+			workspaces.Append(pkg.Name)
+			directDeps.Append(pkg.directDeps().Items()...)
 		}
 	}
 
-	// lock file must include root package
-	// cf. https://github.com/astral-sh/uv/blob/f80ddf10b63c3e7b421ca4658e63f97db1e0378c/crates/uv/src/commands/project/lock.rs#L933-L936
-	if len(pkgs) != 1 {
-		return Package{}, xerrors.New("uv lockfile must contain 1 root package")
-	}
-
-	return pkgs[0], nil
+	return root, workspaces, directDeps, nil
 }
 
 type Package struct {
@@ -74,7 +96,6 @@ func (p Package) directDeps() set.Set[string] {
 	deps := p.nonDevDeps()
 	for _, groupDeps := range p.DevDependencies {
 		deps.Append(groupDeps.toSet().Items()...)
-
 	}
 	return deps
 }
@@ -125,18 +146,16 @@ func (p *Parser) Parse(_ context.Context, r xio.ReadSeekerAt) ([]ftypes.Package,
 		return nil, nil, xerrors.Errorf("failed to decode uv lock file: %w", err)
 	}
 
-	rootPackage, err := lock.root()
+	root, workspaces, directDeps, err := lock.rootAndWorkspaces()
 	if err != nil {
 		return nil, nil, err
 	}
 
 	packages := lock.packages()
-	directDeps := rootPackage.directDeps()
 
-	// Since each lockfile contains a root package with a list of direct dependencies,
-	// we can identify all production dependencies by traversing the dependency graph
-	// and collecting all the dependencies that are reachable from the root.
-	prodDeps := prodDeps(rootPackage, packages)
+	// Production dependencies are the packages reachable from the root package
+	
```

**File**: `pkg/dependency/parser/python/uv/parse_test.go` (modified, +14/-3)
```diff
@@ -25,9 +25,20 @@ func TestParser_Parse(t *testing.T) {
 			wantDeps: uvNormalDeps,
 		},
 		{
-			name:    "lockfile without root",
-			file:    "testdata/uv_without_root.lock",
-			wantErr: "uv lockfile must contain 1 root package",
+			name:     "workspace without root package",
+			file:     "testdata/uv_workspace_virtual.lock",
+			wantPkgs: uvWorkspaceVirtual,
+			wantDeps: uvWorkspaceVirtualDeps,
+		},
+		{
+			name:     "workspace with root package",
+			file:     "testdata/uv_workspace_rooted.lock",
+			wantPkgs: uvWorkspaceRooted,
+			wantDeps: uvWorkspaceRootedDeps,
+		},
+		{
+			name: "lockfile without root",
+			file: "testdata/uv_without_root.lock",
 		},
 		{
 			name:    "multiple roots",
```

**File**: `pkg/dependency/parser/python/uv/parse_testcase.go` (modified, +37/-0)
```diff
@@ -49,4 +49,41 @@ var (
 		{ID: "pytest@8.3.4", DependsOn: []string{"colorama@0.4.6", "exceptiongroup@1.2.2", "iniconfig@2.0.0", "packaging@24.2", "pluggy@1.5.0", "tomli@2.2.1"}},
 		{ID: "requests@2.32.0", DependsOn: []string{"certifi@2024.12.14", "charset-normalizer@3.4.0", "idna@3.10", "urllib3@2.2.3"}},
 	}
+
+	uvWorkspaceVirtual = []ftypes.Package{
+		{ID: "a@0.1.0", Name: "a", Version: "0.1.0", Relationship: ftypes.RelationshipWorkspace},
+		{ID: "b@0.1.0", Name: "b", Version: "0.1.0", Relationship: ftypes.RelationshipWorkspace},
+		{ID: "pillow@11.0.0", Name: "pillow", Version: "11.0.0", Relationship: ftypes.RelationshipDirect},
+		{ID: "requests@2.32.3", Name: "requests", Version: "2.32.3", Relationship: ftypes.RelationshipDirect},
+	}
+
+	uvWorkspaceVirtualDeps = []ftypes.Dependency{
+		{ID: "a@0.1.0", DependsOn: []string{"requests@2.32.3"}},
+		{ID: "b@0.1.0", DependsOn: []string{"pillow@11.0.0"}},
+	}
+
+	uvWorkspaceRooted = []ftypes.Package{
+		{ID: "root@0.1.0", Name: "root", Version: "0.1.0", Relationship: ftypes.RelationshipRoot},
+		{ID: "a@0.1.0", Name: "a", Version: "0.1.0", Relationship: ftypes.RelationshipWorkspace},
+		{ID: "b@0.1.0", Name: "b", Version: "0.1.0", Relationship: ftypes.RelationshipWorkspace},
+		{ID: "click@8.1.7", Name: "click", Version: "8.1.7", Relationship: ftypes.RelationshipDirect},
+		{ID: "pillow@11.0.0", Name: "pillow", Version: "11.0.0", Relationship: ftypes.RelationshipDirect},
+		{ID: "pytest@8.3.4", Name: "pytest", Version: "8.3.4", Relationship: ftypes.RelationshipDirect, Dev: true},
+		{ID: "requests@2.32.3", Name: "requests", Version: "2.32.3", Relationship: ftypes.RelationshipDirect},
+		{ID: "ruff@0.9.0", Name: "ruff", Version: "0.9.0", Relationship: ftypes.RelationshipDirect, Dev: true},
+		{ID: "colorama@0.4.6", Name: "colorama", Version: "0.4.6", Relationship: ftypes.RelationshipIndirect, Dev: true},
+		{ID: "idna@3.10", Name: "idna", Version: "3.10", Relationship: ftypes.RelationshipIndirect},
+		{ID: "tomli@2.2.1", Name: "tomli", Version: "2.2.1", Relationship: ftypes.RelationshipIndirect, Dev: true},
+		{ID: "urllib3@2.2.3", Name: "urllib3", Version: "2.2.3", Relationship: ftypes.RelationshipIndirect},
+	}
+
+	uvWorkspaceRootedDeps = []ftypes.Dependency{
+		{ID: "a@0.1.0", DependsOn: []string{"pytest@8.3.4", "requests@2.32.3"}},
+		{ID: "b@0.1.0", DependsOn: []string{"pillow@11.0.0", "ruff@0.9.0"}},
+		{ID: "pillow@11.0.0", DependsOn: []string{"idna@3.10"}},
+		{ID: "pytest@8.3.4", DependsOn: []string{"colorama@0.4.6"}},
+		{ID: "requests@2.32.3", DependsOn: []string{"urllib3@2.2.3"}},
+		{ID: "root@0.1.0", DependsOn: []string{"a@0.1.0", "b@0.1.0", "click@8.1.7"}},
+		{ID: "ruff@0.9.0", DependsOn: []string{"tomli@2.2.1"}},
+	}
 )
```

**File**: `pkg/dependency/parser/python/uv/testdata/uv_without_root.lock` (modified, +2/-10)
```diff
@@ -1,11 +1,3 @@
 version = 1
-requires-python = ">=3.11"
-
-[[package]]
-name = "asyncio"
-version = "3.4.3"
-source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/da/54/054bafaf2c0fb8473d423743e191fcdf49b2c1fd5e9af3524efbe097bafd/asyncio-3.4.3.tar.gz", hash = "sha256:83360ff8bc97980e4ff25c964c7bd3923d333d177aa4f7fb736b019f26c7cb41", size = 204411 }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/22/74/07679c5b9f98a7cb0fc147b1ef1cc1853bc07a4eb9cb5731e24732c5f773/asyncio-3.4.3-py3-none-any.whl", hash = "sha256:c4d18b22701821de07bd6aea8b53d21449ec0ec5680645e5317062ea21817d2d", size = 101767 },
-]
\ No newline at end of file
+revision = 3
+requires-python = ">=3.13"
```

---

### Incident Patch 3: `3a1b311e` (2026-09-29)
**Commit Message**: fix(purl): classify julia, bottlerocket and centos stream packages (#11326)

**File**: `pkg/purl/purl.go` (modified, +4/-2)
```diff
@@ -176,6 +176,8 @@ func (p *PackageURL) LangType() ftypes.LangType {
 		return ftypes.Conan
 	case packageurl.TypePub:
 		return ftypes.Pub
+	case packageurl.TypeJulia:
+		return ftypes.Julia
 	case packageurl.TypeBitnami:
 		return ftypes.Bitnami
 	case TypeK8s:
@@ -199,7 +201,7 @@ func (p *PackageURL) LangType() ftypes.LangType {
 
 func (p *PackageURL) Class() types.ResultClass {
 	switch p.Type {
-	case packageurl.TypeApk, packageurl.TypeDebian, packageurl.TypeRPM:
+	case packageurl.TypeApk, packageurl.TypeDebian, packageurl.TypeRPM, packageurlTypeBottlerocket:
 		// OS packages
 		return types.ClassOSPkg
 	default:
@@ -483,7 +485,7 @@ func purlType(t ftypes.TargetType) string {
 		return packageurl.TypeApk
 	case ftypes.Debian, ftypes.Ubuntu, ftypes.Echo:
 		return packageurl.TypeDebian
-	case ftypes.RedHat, ftypes.CentOS, ftypes.Rocky, ftypes.Alma,
+	case ftypes.RedHat, ftypes.CentOS, ftypes.CentOSStream, ftypes.Rocky, ftypes.Alma,
 		ftypes.Amazon, ftypes.Fedora, ftypes.Oracle, ftypes.OpenSUSE,
 		ftypes.OpenSUSELeap, ftypes.OpenSUSETumbleweed, ftypes.SLES, ftypes.SLEMicro, ftypes.Photon,
 		ftypes.Azure, ftypes.CBLMariner, ftypes.CoreOS:
```

**File**: `pkg/purl/purl_test.go` (modified, +145/-0)
```diff
@@ -299,6 +299,41 @@ func TestNewPackageURL(t *testing.T) {
 				Version: "9.0.1",
 			},
 		},
+		{
+			// Without CentOSStream in the RPM branch of purlType this falls to the
+			// default and comes out as Type "centos-stream", which Class then
+			// reports as unknown and the SBOM decoder drops.
+			name: "os package with centos stream",
+			typ:  ftypes.CentOSStream,
+			pkg: ftypes.Package{
+				Name:    "glibc",
+				Version: "2.34",
+				Release: "60.el9",
+				Arch:    "x86_64",
+			},
+			metadata: types.Metadata{
+				OS: &ftypes.OS{
+					Family: ftypes.CentOSStream,
+					Name:   "9",
+				},
+			},
+			want: &purl.PackageURL{
+				Type:      packageurl.TypeRPM,
+				Namespace: "centos-stream",
+				Name:      "glibc",
+				Version:   "2.34-60.el9",
+				Qualifiers: packageurl.Qualifiers{
+					{
+						Key:   "arch",
+						Value: "x86_64",
+					},
+					{
+						Key:   "distro",
+						Value: "centos-stream-9",
+					},
+				},
+			},
+		},
 		{
 			name: "os package",
 			typ:  ftypes.RedHat,
@@ -941,6 +976,21 @@ func TestPackageURL_LangType(t *testing.T) {
 			},
 			want: ftypes.Jar,
 		},
+		{
+			name: "julia",
+			purl: packageurl.PackageURL{
+				Type:    packageurl.TypeJulia,
+				Name:    "Example",
+				Version: "0.5.3",
+				Qualifiers: packageurl.Qualifiers{
+					{
+						Key:   "uuid",
+						Value: "7876af07-990d-54b4-ab0e-23690620f79a",
+					},
+				},
+			},
+			want: ftypes.Julia,
+		},
 		{
 			name: "k8s",
 			purl: packageurl.PackageURL{
@@ -969,6 +1019,101 @@ func TestPackageURL_LangType(t *testing.T) {
 	}
 }
 
+// A purl type that Class reports as unknown is dropped by the SBOM decoder.
+func TestPackageURL_Class(t *testing.T) {
+	tests := []struct {
+		name string
+		purl packageurl.PackageURL
+		want types.ResultClass
+	}{
+		{
+			name: "apk",
+			purl: packageurl.PackageURL{
+				Type:      packageurl.TypeApk,
+				Namespace: "alpine",
+				Name:      "musl",
+				Version:   "1.2.3",
+			},
+			want: types.ClassOSPkg,
+		},
+		{
+			name: "deb",
+			purl: packageurl.PackageURL{
+				Type:      packageurl.TypeDebian,
+				Namespace: "debian",
+				Name:      "libc6",
+				Version:   "2.36-9",
+			},
+			want: types.ClassOSPkg,
+		},
+		{
+			name: "rpm",
+			purl: packageurl.PackageURL{
+				Type:      packageurl.TypeRPM,
+				Namespace: "redhat",
+				Name:      "glibc",
+				Version:   "2.34-60",
+			},
+			want: types.ClassOSPkg,
+		},
+		{
+			name: "bottlerocket",
+			purl: packageurl.PackageURL{
+				Type:    "bottlerocket",
+				Name:    "glibc",
+				Version: "2.40",
+				Qualifiers: packageurl.Qualifiers{
+					{
+						Key:   "distro",
+						Value: "bottlerocket-1.34.0",
+					},
+				},
+			},
+			want: types.ClassOSPkg,
+		},
+		{
+			name: "maven",
+			purl: packageurl.PackageURL{
+				Type:      packageurl.TypeMaven,
+				Namespace: "org.springframework",
+				Name:      "spring-core",
+				Version:   "5.0.4.RELEASE",
+			},
+			want: types.ClassLangPkg,
+		},
+		{
+			name: "julia",
+			purl: packageurl.PackageURL{
+				Type:    packageurl.TypeJulia,
+				Name:    "Example",
+				Version: "0.5.3",
+				Qualifiers: packageurl.Qualifiers{
+					{
+						Key:   "uuid",
+						Value: "7876af07-990d-54b4-ab0e-23690620f79a",
+					},
+				},
+			},
+			want: types.ClassLangPkg,
+		},
+		{
+			name: "unsupported type",
+			purl: packageurl.PackageURL{
+				Type:    "huggingface",
+				Name:    "distilbert-base-uncased",
+				Version: "043235d6088ecd3dd5fb5ca3592b6913fd516027",
+			},
+			want: types.ClassUnknown,
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			p := purl.PackageURL(tt.purl)
+			assert.Equalf(t, tt.want, p.Class(), "Class()")
+		})
+	}
+}
+
 func TestPackageURL_Match(t *testing.T) {
 	tests := []struct {
 		name       string
```

---

### Incident Patch 4: `1849d2ff` (2026-09-29)
**Commit Message**: chore(alpine): add EOL date for Alpine 3.24 and fix 3.21/3.22 dates (#11308)

**File**: `pkg/detector/ospkg/alpine/alpine.go` (modified, +3/-2)
```diff
@@ -48,9 +48,10 @@ var eolDates = map[string]time.Time{
 	"3.18": time.Date(2025, 5, 9, 23, 59, 59, 0, time.UTC),
 	"3.19": time.Date(2025, 11, 1, 23, 59, 59, 0, time.UTC),
 	"3.20": time.Date(2026, 4, 1, 23, 59, 59, 0, time.UTC),
-	"3.21": time.Date(2026, 12, 5, 23, 59, 59, 0, time.UTC),
-	"3.22": time.Date(2027, 4, 30, 23, 59, 59, 0, time.UTC),
+	"3.21": time.Date(2026, 11, 1, 23, 59, 59, 0, time.UTC),
+	"3.22": time.Date(2027, 5, 1, 23, 59, 59, 0, time.UTC),
 	"3.23": time.Date(2027, 11, 1, 23, 59, 59, 0, time.UTC),
+	"3.24": time.Date(2028, 6, 1, 23, 59, 59, 0, time.UTC),
 	"edge": time.Date(9999, 1, 1, 0, 0, 0, 0, time.UTC),
 }
 
```

---

### Incident Patch 5: `7e71d211` (2026-09-28)
**Commit Message**: fix(python): skip pip requirement lines with malformed extras brackets (#11300)

Co-authored-by: DmitriyLewen <dmitriy.lewen@smartforce.io>

**File**: `pkg/dependency/parser/python/pip/parse.go` (modified, +19/-7)
```diff
@@ -86,10 +86,16 @@ func (p *Parser) Parse(_ context.Context, r xio.ReadSeekerAt) ([]ftypes.Package,
 		text := scanner.Text()
 		line := strings.ReplaceAll(text, " ", "")
 		line = strings.ReplaceAll(line, `\`, "")
-		line = removeExtras(line)
 		line = rStripByKey(line, commentMarker)
 		line = rStripByKey(line, endColon)
 		line = rStripByKey(line, hashMarker)
+		line, err := removeExtras(line)
+		if err != nil {
+			// Skip only this line: returning an error would drop all packages from the file.
+			p.logger.Debug("Invalid extras in requirements.txt.", log.Int("line_number", lineNumber),
+				log.String("line", text), log.Err(err))
+			continue
+		}
 
 		s := p.splitLine(line)
 		if len(s) != 2 {
@@ -100,7 +106,8 @@ func (p *Parser) Parse(_ context.Context, r xio.ReadSeekerAt) ([]ftypes.Package,
 		}
 
 		if !isValidName(s[0]) || !isValidVersion(s[1]) {
-			p.logger.Debug("Invalid package name/version in requirements.txt.", log.String("line", text))
+			p.logger.Debug("Invalid package name/version in requirements.txt.", log.Int("line_number", lineNumber),
+				log.String("line", text))
 			continue
 		}
 
@@ -128,13 +135,18 @@ func rStripByKey(line, key string) string {
 	return line
 }
 
-func removeExtras(line string) string {
+// removeExtras strips the extras group, e.g. "pyjwt[crypto]==2.1.0" -> "pyjwt==2.1.0".
+// Malformed brackets are rejected with an error, the same way pip does.
+func removeExtras(line string) (string, error) {
 	startIndex := strings.Index(line, startExtras)
-	endIndex := strings.Index(line, endExtras) + 1
-	if startIndex != -1 && endIndex != -1 {
-		line = line[:startIndex] + line[endIndex:]
+	endIndex := strings.Index(line, endExtras)
+	if startIndex == -1 && endIndex == -1 {
+		return line, nil
 	}
-	return line
+	if endIndex < startIndex || strings.Count(line, startExtras) != 1 || strings.Count(line, endExtras) != 1 {
+		return "", xerrors.New("unbalanced extras brackets")
+	}
+	return line[:startIndex] + line[endIndex+1:], nil
 }
 
 // isNameChar reports whether r is a valid character in a PEP 508 package name.
```

**File**: `pkg/dependency/parser/python/pip/parse_test.go` (modified, +82/-0)
```diff
@@ -73,6 +73,11 @@ func TestParse(t *testing.T) {
 			useMinVersion: true,
 			want:          requirementsCompatibleVersions,
 		},
+		{
+			name:     "malformed extras are skipped, brackets in comments are ignored",
+			filePath: "testdata/requirements_invalid_extras.txt",
+			want:     requirementsInvalidExtras,
+		},
 	}
 
 	for _, tt := range tests {
@@ -87,3 +92,80 @@ func TestParse(t *testing.T) {
 		})
 	}
 }
+
+func TestRemoveExtras(t *testing.T) {
+	tests := []struct {
+		name    string
+		line    string
+		want    string
+		wantErr bool
+	}{
+		{
+			name: "single extra",
+			line: "pyjwt[crypto]==2.1.0",
+			want: "pyjwt==2.1.0",
+		},
+		{
+			name: "multiple extras",
+			line: "celery[redis,pytest]==4.4.7",
+			want: "celery==4.4.7",
+		},
+		{
+			name: "empty extras",
+			line: "pkg[]==1.0",
+			want: "pkg==1.0",
+		},
+		{
+			name: "no extras",
+			line: "flask==2.0.0",
+			want: "flask==2.0.0",
+		},
+		{
+			name:    "missing closing bracket",
+			line:    "pkg[extra==1.0",
+			wantErr: true,
+		},
+		{
+			name:    "stray closing bracket without opening",
+			line:    "foo]bar==1.0",
+			wantErr: true,
+		},
+		{
+			name:    "closing bracket before opening",
+			line:    "foo]bar[x]==1.0",
+			wantErr: true,
+		},
+		{
+			name:    "extra closing bracket",
+			line:    "celery[redis]]==4.4.7",
+			wantErr: true,
+		},
+		{
+			name:    "nested brackets",
+			line:    "pkg[a[b]]==1.0",
+			wantErr: true,
+		},
+		{
+			name:    "second extras group",
+			line:    "pkg[a][b]==1.0",
+			wantErr: true,
+		},
+		{
+			name: "empty string",
+			line: "",
+			want: "",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			got, err := removeExtras(tt.line)
+			if tt.wantErr {
+				require.ErrorContains(t, err, "unbalanced extras brackets")
+				return
+			}
+			require.NoError(t, err)
+			assert.Equal(t, tt.want, got)
+		})
+	}
+}
```

**File**: `pkg/dependency/parser/python/pip/parse_testcase.go` (modified, +53/-0)
```diff
@@ -321,4 +321,57 @@ var (
 			},
 		},
 	}
+
+	requirementsInvalidExtras = []ftypes.Package{
+		{
+			Name:    "click",
+			Version: "8.0.0",
+			Locations: []ftypes.Location{
+				{
+					StartLine: 1,
+					EndLine:   1,
+				},
+			},
+		},
+		{
+			Name:    "flask",
+			Version: "2.0.0",
+			Locations: []ftypes.Location{
+				{
+					StartLine: 3,
+					EndLine:   3,
+				},
+			},
+		},
+		{
+			Name:    "pyjwt",
+			Version: "2.1.0",
+			Locations: []ftypes.Location{
+				{
+					StartLine: 7,
+					EndLine:   7,
+				},
+			},
+		},
+		{
+			Name:    "Jinja2",
+			Version: "3.0.0",
+			Locations: []ftypes.Location{
+				{
+					StartLine: 10,
+					EndLine:   10,
+				},
+			},
+		},
+		{
+			Name:    "requests",
+			Version: "2.28.0",
+			Locations: []ftypes.Location{
+				{
+					StartLine: 11,
+					EndLine:   11,
+				},
+			},
+		},
+	}
 )
```

**File**: `pkg/dependency/parser/python/pip/testdata/requirements_invalid_extras.txt` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+click==8.0.0
+pkg[extra==1.0
+flask==2.0.0 # see [notes
+# ]
+# [section
+foo]bar==1.0
+pyjwt[crypto]==2.1.0
+foo]bar[x]==1.0
+celery[redis]]==4.4.7
+Jinja2==3.0.0 # pinned, see [notes]
+requests[security]==2.28.0 --hash=sha256:[abc
```

---

### Incident Patch 6: `5ba5be05` (2026-09-28)
**Commit Message**: fix: correct grammar and typos in user-facing error messages and CLI flags (#11281)

Signed-off-by: jUDASmILE <judasmile@gmail.com>

**File**: `docs/guide/references/configuration/cli/trivy_config.md` (modified, +8/-8)
```diff
@@ -10,10 +10,10 @@ trivy config [flags] DIR
 
 ```
       --ansible-extra-vars strings        set additional variables as key=value or @file (YAML/JSON)
-      --ansible-inventory strings         specify inventory host path or comma separated host list
+      --ansible-inventory strings         specify inventory host path or a comma-separated host list
       --ansible-playbook strings          specify playbook file path(s) to scan
       --cache-backend string              [EXPERIMENTAL] cache backend (e.g. redis://localhost:6379) (default "memory")
-      --cache-ttl duration                cache TTL when using redis as cache backend
+      --cache-ttl duration                cache TTL when using Redis as cache backend
       --cf-params strings                 specify paths to override the CloudFormation parameters files
       --check-namespaces strings          Rego namespaces
       --checks-bundle-repository string   OCI registry URL to retrieve checks bundle from (default "mirror.gcr.io/aquasec/trivy-checks:2")
@@ -48,18 +48,18 @@ trivy config [flags] DIR
       --ignorefile string                 specify .trivyignore file (empty string disables loading) (default ".trivyignore")
       --include-deprecated-checks         include deprecated checks
       --include-non-failures              include successes, available with '--scanners misconfig'
-      --k8s-version string                specify k8s version to validate outdated api by it (example: 1.21.0)
+      --k8s-version string                specify k8s version to validate outdated APIs against (example: 1.21.0)
       --misconfig-scanners strings        comma-separated list of misconfig scanners to use for misconfiguration scanning (default [azure-arm,cloudformation,dockerfile,helm,kubernetes,terraform,terraformplan-json,terraformplan-snapshot,ansible])
-      --module-dir string                 specify directory to the wasm modules that will be loaded (default "$HOME/.trivy/modules")
+      --module-dir string                 specify the directory of the WASM modules to load (default "$HOME/.trivy/modules")
   -o, --output string                     output file name
       --output-plugin-arg string          [EXPERIMENTAL] output plugin arguments
       --password strings                  password. Comma-separated passwords allowed. TRIVY_PASSWORD should be used for security reasons.
       --password-stdin                    password from stdin. Comma-separated passwords are not supported.
       --raw-config-scanners strings       specify the types of scanners that will also scan raw configurations. For example, scanners will scan a non-adapted configuration into a shared state (allowed values: terraform)
-      --redis-ca string                   redis ca file location, if using redis as cache backend
-      --redis-cert string                 redis certificate file location, if using redis as cache backend
-      --redis-key string                  redis key file location, if using redis as cache backend
-      --redis-tls                         enable redis TLS with public certificates, if using redis as cache backend
+      --redis-ca string                   Redis CA file location, if using Redis as cache backend
+      --redis-cert string                 Redis certificate file location, if using Redis as cache backend
+      --redis-key string                  Redis key file location, if using Redis as cache backend
+      --redis-tls                         enable Redis TLS with public certificates, if using Redis as cache backend
       --registry-token string             registry token
       --rego-error-limit int              maximum number of compile errors allowed during Rego policy evaluation (default 10)
       --render-cause strings              specify configuration types for which the rendered causes will be shown in the table report (allowed values: terraform,ansible)
```

**File**: `docs/guide/references/configuration/cli/trivy_filesystem.md` (modified, +10/-10)
```diff
@@ -20,10 +20,10 @@ trivy filesystem [flags] PATH
 
 ```
       --ansible-extra-vars strings        set additional variables as key=value or @file (YAML/JSON)
-      --ansible-inventory strings         specify inventory host path or comma separated host list
+      --ansible-inventory strings         specify inventory host path or a comma-separated host list
       --ansible-playbook strings          specify playbook file path(s) to scan
       --cache-backend string              [EXPERIMENTAL] cache backend (e.g. redis://localhost:6379) (default "memory")
-      --cache-ttl duration                cache TTL when using redis as cache backend
+      --cache-ttl duration                cache TTL when using Redis as cache backend
       --cf-params strings                 specify paths to override the CloudFormation parameters files
       --check-namespaces strings          Rego namespaces
       --checks-bundle-repository string   OCI registry URL to retrieve checks bundle from (default "mirror.gcr.io/aquasec/trivy-checks:2")
@@ -65,7 +65,7 @@ trivy filesystem [flags] PATH
       --helm-values strings               specify paths to override the Helm values.yaml files
   -h, --help                              help for filesystem
       --ignore-policy string              specify the Rego file path to evaluate each vulnerability
-      --ignore-status strings             comma-separated list of vulnerability status to ignore
+      --ignore-status strings             comma-separated list of vulnerability statuses to ignore
                                           Allowed values:
                                             - unknown
                                             - not_affected
@@ -76,7 +76,7 @@ trivy filesystem [flags] PATH
                                             - fix_deferred
                                             - end_of_life
       --ignore-unfixed                    display only fixed vulnerabilities
-      --ignored-licenses strings          specify a list of license to ignore
+      --ignored-licenses strings          specify a list of licenses to ignore
       --ignorefile string                 specify .trivyignore file (empty string disables loading) (default ".trivyignore")
       --include-deprecated-checks         include deprecated checks
       --include-dev-deps                  include development dependencies in the report (supported: npm, yarn, gradle)
@@ -86,7 +86,7 @@ trivy filesystem [flags] PATH
       --license-full                      eagerly look for licenses in source code headers and license files
       --list-all-pkgs                     output all packages in the JSON report regardless of vulnerability (default true)
       --misconfig-scanners strings        comma-separated list of misconfig scanners to use for misconfiguration scanning (default [azure-arm,cloudformation,dockerfile,helm,kubernetes,terraform,terraformplan-json,terraformplan-snapshot,ansible])
-      --module-dir string                 specify directory to the wasm modules that will be loaded (default "$HOME/.trivy/modules")
+      --module-dir string                 specify the directory of the WASM modules to load (default "$HOME/.trivy/modules")
       --no-progress                       suppress progress bar
       --offline-scan                      do not issue API requests to identify dependencies
   -o, --output string                     output file name
@@ -104,10 +104,10 @@ trivy filesystem [flags] PATH
                                            (default [unknown,root,workspace,direct,indirect])
       --pkg-types strings                 list of package types (allowed values: os,library) (default [os,library])
       --raw-config-scanners strings       specify the types of scanners that will also scan raw configurations. For example, scanners will scan a non-adapted configuration into a shared state (allowed values: terraform)
-      --redis-ca string                   redis ca file location
```

**File**: `docs/guide/references/configuration/cli/trivy_image.md` (modified, +10/-10)
```diff
@@ -35,10 +35,10 @@ trivy image [flags] IMAGE_NAME
 
 ```
       --ansible-extra-vars strings        set additional variables as key=value or @file (YAML/JSON)
-      --ansible-inventory strings         specify inventory host path or comma separated host list
+      --ansible-inventory strings         specify inventory host path or a comma-separated host list
       --ansible-playbook strings          specify playbook file path(s) to scan
       --cache-backend string              [EXPERIMENTAL] cache backend (e.g. redis://localhost:6379) (default "fs")
-      --cache-ttl duration                cache TTL when using redis as cache backend
+      --cache-ttl duration                cache TTL when using Redis as cache backend
       --check-namespaces strings          Rego namespaces
       --checks-bundle-repository string   OCI registry URL to retrieve checks bundle from (default "mirror.gcr.io/aquasec/trivy-checks:2")
       --compliance string                 compliance report to generate (built-in compliance's: docker-cis-1.6.0)
@@ -81,7 +81,7 @@ trivy image [flags] IMAGE_NAME
       --helm-values strings               specify paths to override the Helm values.yaml files
   -h, --help                              help for image
       --ignore-policy string              specify the Rego file path to evaluate each vulnerability
-      --ignore-status strings             comma-separated list of vulnerability status to ignore
+      --ignore-status strings             comma-separated list of vulnerability statuses to ignore
                                           Allowed values:
                                             - unknown
                                             - not_affected
@@ -92,7 +92,7 @@ trivy image [flags] IMAGE_NAME
                                             - fix_deferred
                                             - end_of_life
       --ignore-unfixed                    display only fixed vulnerabilities
-      --ignored-licenses strings          specify a list of license to ignore
+      --ignored-licenses strings          specify a list of licenses to ignore
       --ignorefile string                 specify .trivyignore file (empty string disables loading) (default ".trivyignore")
       --image-config-scanners strings     comma-separated list of what security issues to detect on container image configurations (allowed values: misconfig,secret)
       --image-src strings                 image source(s) to use, in priority order (allowed values: docker,containerd,podman,remote) (default [docker,containerd,podman,remote])
@@ -105,7 +105,7 @@ trivy image [flags] IMAGE_NAME
       --list-all-pkgs                     output all packages in the JSON report regardless of vulnerability (default true)
       --max-image-size string             [EXPERIMENTAL] maximum image size to process, specified in a human-readable format (e.g., '44kB', '17MB'); an error will be returned if the image exceeds this size
       --misconfig-scanners strings        comma-separated list of misconfig scanners to use for misconfiguration scanning (default [azure-arm,cloudformation,dockerfile,helm,kubernetes,terraform,terraformplan-json,terraformplan-snapshot,ansible])
-      --module-dir string                 specify directory to the wasm modules that will be loaded (default "$HOME/.trivy/modules")
+      --module-dir string                 specify the directory of the WASM modules to load (default "$HOME/.trivy/modules")
       --no-progress                       suppress progress bar
       --offline-scan                      do not issue API requests to identify dependencies
   -o, --output string                     output file name
@@ -125,10 +125,10 @@ trivy image [flags] IMAGE_NAME
       --platform string                   set platform in the form os/arch if image is multi-platform capable
       --podman-host string                unix podman socket path to use for podman scanning
       --raw-config-scanners str
```

**File**: `docs/guide/references/configuration/cli/trivy_kubernetes.md` (modified, +10/-10)
```diff
@@ -30,11 +30,11 @@ trivy kubernetes [flags] [CONTEXT]
 
 ```
       --ansible-extra-vars strings        set additional variables as key=value or @file (YAML/JSON)
-      --ansible-inventory strings         specify inventory host path or comma separated host list
+      --ansible-inventory strings         specify inventory host path or a comma-separated host list
       --ansible-playbook strings          specify playbook file path(s) to scan
       --burst int                         specify the maximum burst for throttle (default 10)
       --cache-backend string              [EXPERIMENTAL] cache backend (e.g. redis://localhost:6379) (default "fs")
-      --cache-ttl duration                cache TTL when using redis as cache backend
+      --cache-ttl duration                cache TTL when using Redis as cache backend
       --check-namespaces strings          Rego namespaces
       --checks-bundle-repository string   OCI registry URL to retrieve checks bundle from (default "mirror.gcr.io/aquasec/trivy-checks:2")
       --compliance string                 compliance report to generate
@@ -59,7 +59,7 @@ trivy kubernetes [flags] [CONTEXT]
       --distro string                     [EXPERIMENTAL] specify a distribution, <family>/<version>
       --download-db-only                  download/update vulnerability database but don't run a scan
       --download-java-db-only             download/update Java index database but don't run a scan
-      --exclude-kinds strings             indicate the kinds exclude from scanning (example: node)
+      --exclude-kinds strings             indicate the kinds excluded from scanning (example: node)
       --exclude-namespaces strings        indicate the namespaces excluded from scanning (example: kube-system)
       --exclude-nodes strings             indicate the node labels that the node-collector job should exclude from scanning (example: kubernetes.io/arch:arm64,team:dev)
       --exclude-owned                     exclude resources that have an owner reference
@@ -74,7 +74,7 @@ trivy kubernetes [flags] [CONTEXT]
       --helm-values strings               specify paths to override the Helm values.yaml files
   -h, --help                              help for kubernetes
       --ignore-policy string              specify the Rego file path to evaluate each vulnerability
-      --ignore-status strings             comma-separated list of vulnerability status to ignore
+      --ignore-status strings             comma-separated list of vulnerability statuses to ignore
                                           Allowed values:
                                             - unknown
                                             - not_affected
@@ -92,7 +92,7 @@ trivy kubernetes [flags] [CONTEXT]
       --include-namespaces strings        indicate the namespaces included in scanning (example: kube-system)
       --include-non-failures              include successes, available with '--scanners misconfig'
       --java-db-repository strings        OCI repository(ies) to retrieve trivy-java-db in order of priority (default [mirror.gcr.io/aquasec/trivy-java-db:1,ghcr.io/aquasecurity/trivy-java-db:1])
-      --k8s-version string                specify k8s version to validate outdated api by it (example: 1.21.0)
+      --k8s-version string                specify k8s version to validate outdated APIs against (example: 1.21.0)
       --kubeconfig string                 specify the kubeconfig file path to use
       --list-all-pkgs                     output all packages in the JSON report regardless of vulnerability (default true)
       --misconfig-scanners strings        comma-separated list of misconfig scanners to use for misconfiguration scanning (default [azure-arm,cloudformation,dockerfile,helm,kubernetes,terraform,terraformplan-json,terraformplan-snapshot,ansible])
@@ -116,10 +116,10 @@ trivy kubernetes [flags] [CONTEXT]
       --pkg-types strings                 list of package types (allowed value
```

**File**: `docs/guide/references/configuration/cli/trivy_module.md` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ Manage modules
 ```
       --enable-modules strings   [EXPERIMENTAL] module names to enable
   -h, --help                     help for module
-      --module-dir string        specify directory to the wasm modules that will be loaded (default "$HOME/.trivy/modules")
+      --module-dir string        specify the directory of the WASM modules to load (default "$HOME/.trivy/modules")
 ```
 
 ### Options inherited from parent commands
```

---

### Incident Patch 7: `ae561f8c` (2026-09-25)
**Commit Message**: fix(vex): avoid panic on CSAF relationships without a sub-component (#11067)

**File**: `pkg/vex/csaf.go` (modified, +7/-0)
```diff
@@ -92,6 +92,13 @@ func (v *CSAF) matchProduct(productID csaf.ProductID, product *core.Component) b
 func (v *CSAF) matchRelationship(fullProductID csaf.ProductID, product, subProduct *core.Component) (
 	csaf.RelationshipCategory, bool) {
 
+	// A relationship describes a sub-component within a product, so it can only match
+	// when a sub-component is given. subProduct is nil when a component is evaluated
+	// on its own (see reachRoot).
+	if subProduct == nil {
+		return "", false
+	}
+
 	for category, relationships := range v.inspectProductRelationships(fullProductID) {
 		for _, rel := range relationships {
 			if !rel.Product.Match(product.PkgIdentifier.PURL) {
```

**File**: `pkg/vex/vex_test.go` (modified, +32/-0)
```diff
@@ -184,6 +184,13 @@ var (
 		InstalledVersion: goTransitivePackage.Version,
 		PkgIdentifier:    goTransitivePackage.Identifier,
 	}
+	// CVE-2024-0001 detected on go-direct1
+	vuln6 = types.DetectedVulnerability{
+		VulnerabilityID:  "CVE-2024-0001",
+		PkgName:          goDirectPackage1.Name,
+		InstalledVersion: goDirectPackage1.Version,
+		PkgIdentifier:    goDirectPackage1.Identifier,
+	}
 )
 
 func TestMain(m *testing.M) {
@@ -540,6 +547,31 @@ func TestFilter(t *testing.T) {
 				}),
 			}),
 		},
+		{
+			name: "CSAF with relationships, vulnerability on the parent product, not the sub-component",
+			args: args{
+				// The statement covers go-transitive as a component of go-direct1,
+				// while the vulnerability is detected on go-direct1 itself.
+				report: imageReport([]types.Result{
+					goSinglePathResult(types.Result{
+						Vulnerabilities: []types.DetectedVulnerability{vuln6},
+					}),
+				}),
+				opts: vex.Options{
+					Sources: []vex.Source{
+						{
+							Type:     vex.TypeFile,
+							FilePath: "testdata/csaf-relationships.json",
+						},
+					},
+				},
+			},
+			want: imageReport([]types.Result{
+				goSinglePathResult(types.Result{
+					Vulnerabilities: []types.DetectedVulnerability{vuln6}, // The statement doesn't apply to the product itself
+				}),
+			}),
+		},
 		{
 			name: "VEX Repository",
 			setup: func(t *testing.T, tmpDir string) {
```

---

### Incident Patch 8: `0aaaa717` (2026-09-21)
**Commit Message**: fix(sbom): skip null entries in SPDX file and package arrays (#11101)

Signed-off-by: Arpit Jain <arpitjain099@gmail.com>

**File**: `pkg/sbom/spdx/testdata/happy/null-file-entry.json` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+{
+	"SPDXID": "SPDXRef-DOCUMENT",
+	"spdxVersion": "SPDX-2.3",
+	"creationInfo": {
+		"created": "2022-09-12T17:03:35.840861Z",
+		"creators": [
+			"Tool: trivy-dev",
+			"Organization: aquasecurity"
+		]
+	},
+	"dataLicense": "CC0-1.0",
+	"documentNamespace": "http://trivy.dev/container/null-file-entry",
+	"name": "null-file-entry",
+	"files": [
+		null
+	]
+}
```

**File**: `pkg/sbom/spdx/unmarshal.go` (modified, +10/-3)
```diff
@@ -108,9 +108,12 @@ func (s *SPDX) unmarshal(spdxDocument *spdx.Document) error {
 
 // parseFiles parses Relationships and finds filepaths for packages
 func (s *SPDX) parseFiles(spdxDocument *spdx.Document) {
-	fileSPDXIdentifierMap := lo.SliceToMap(spdxDocument.Files, func(file *spdx.File) (common.ElementID, *spdx.File) {
-		return file.FileSPDXIdentifier, file
-	})
+	// A null element in the files array decodes to a nil pointer.
+	fileSPDXIdentifierMap := lo.SliceToMap(
+		lo.Filter(spdxDocument.Files, func(file *spdx.File, _ int) bool { return file != nil }),
+		func(file *spdx.File) (common.ElementID, *spdx.File) {
+			return file.FileSPDXIdentifier, file
+		})
 
 	for _, rel := range spdxDocument.Relationships {
 		if rel.Relationship != common.TypeRelationshipContains && rel.Relationship != "CONTAIN" {
@@ -150,6 +153,10 @@ func (s *SPDX) parsePackages(spdxDocument *spdx.Document) (map[common.ElementID]
 	// Convert packages into components
 	components := make(map[common.ElementID]*core.Component)
 	for _, pkg := range spdxDocument.Packages {
+		// A null element in the packages array decodes to a nil pointer.
+		if pkg == nil {
+			continue
+		}
 		component, err := s.parsePackage(*pkg)
 		if err != nil {
 			return nil, xerrors.Errorf("failed to parse package: %w", err)
```

**File**: `pkg/sbom/spdx/unmarshal_test.go` (modified, +6/-0)
```diff
@@ -340,6 +340,12 @@ func TestUnmarshaler_Unmarshal(t *testing.T) {
 			inputFile: "testdata/happy/empty-bom.json",
 			want:      types.SBOM{},
 		},
+		{
+			// a null element in an array decodes to a nil pointer
+			name:      "happy path with a null file entry",
+			inputFile: "testdata/happy/null-file-entry.json",
+			want:      types.SBOM{},
+		},
 		{
 			name:      "sad path invalid purl",
 			inputFile: "testdata/sad/invalid-purl.json",
```

---

### Incident Patch 9: `7a6433aa` (2026-09-21)
**Commit Message**: docs: link security reporting guidance to relevant documentation (#11235)

**File**: `SECURITY.md` (modified, +11/-0)
```diff
@@ -7,6 +7,17 @@ As such, there is no supportability commitment. The maintainers will do the best
 
 ## Reporting a Vulnerability
 
+Before submitting a report, please review the [project scope and principles](https://trivy.dev/docs/latest/community/principles/#intentional-attacks) and the relevant security considerations:
+
+- [Configuration files](https://trivy.dev/docs/latest/guide/configuration/#security-considerations)
+- [Report templates](https://trivy.dev/docs/latest/guide/configuration/reporting/#custom-template)
+- [Client/server deployments](https://trivy.dev/docs/latest/guide/references/modes/client-server/#security-considerations)
+- [Plugins](https://trivy.dev/docs/latest/guide/plugin/#security-considerations) and [modules](https://trivy.dev/docs/latest/guide/advanced/modules/#overview)
+- [Terraform remote modules](https://trivy.dev/docs/latest/guide/coverage/iac/terraform/#remote-modules) and [filesystem functions](https://trivy.dev/docs/latest/guide/coverage/iac/terraform/#filesystem-functions)
+- [Registry credentials](https://trivy.dev/docs/latest/guide/advanced/private-registries/#passing-credentials) and [Maven mirror credentials](https://trivy.dev/docs/latest/guide/coverage/language/java/#config-file-mirrors)
+- [VEX attestations](https://trivy.dev/docs/latest/guide/supply-chain/vex/oci/#step-3-use-vex-attestation-with-trivy)
+- [HTTP request/response tracing](https://trivy.dev/docs/latest/guide/references/troubleshooting/#http-requestresponse-tracing)
+
 Please use the "Private vulnerability reporting" feature in the GitHub repository (under the "Security" tab).  
 
 ⚠️ **Important:**  
```

---

### Incident Patch 10: `d7708cfa` (2026-09-21)
**Commit Message**: docs(misconf): clarify custom check security considerations (#11278)

**File**: `docs/guide/configuration/index.md` (modified, +2/-0)
```diff
@@ -58,3 +58,5 @@ trivy fs --config /opt/ci/trivy.yaml --ignorefile="" --secret-config="" /workspa
 ```
 
 Templates and other files referenced by the configuration must also come from trusted sources. A trusted configuration file can still reference an untrusted template: relative template paths are resolved from the current working directory, not the configuration file's directory. Use trusted absolute template paths when the working directory contains untrusted content. Templates can read environment variables and include sensitive values in report output.
+
+For custom Rego checks selected by the configuration, see the [custom check security considerations](../scanner/misconfiguration/custom/index.md#security-considerations).
```

**File**: `docs/guide/scanner/misconfiguration/custom/index.md` (modified, +6/-0)
```diff
@@ -31,6 +31,12 @@ In the above general file formats, Trivy automatically identifies the following
 
 This is useful for filtering inputs, as described below.
 
+## Security considerations
+
+Only load custom checks from sources you trust. Checks can access the Trivy process's environment variables and make HTTP requests.
+
+In CI, use checks and configuration maintained by the pipeline owners. Changes in the repository being scanned should not be able to replace those checks or select different ones.
+
 ## Rego format
 A single package must contain only one policy.
 
```

#### Recent Merged Pull Requests:
- **PR #11326** (2026-09-29): fix(purl): classify julia, bottlerocket and centos stream packages (@CalvinTjoaquinn)
- **PR #11325** (closed): fix(purl): classify julia and bottlerocket packages (@CalvinTjoaquinn)
- **PR #11323** (2026-09-29): docs(sbom): clarify Rekor source compatibility with Cosign (@knqyf263)
- **PR #11319** (2026-09-30): fix(crypto): read RSA private keys without validating their math (@nikpivkin)
- **PR #11313** (closed): feat(k8s): support --format template (@thebigbone)
- **PR #11310** (2026-09-28): chore(deps): bump github.com/containerd/containerd/v2 from 2.4.0 to 2.4.1 (@dependabot[bot])
- **PR #11309** (2026-09-29): chore(deps): bump alpine to 3.24.2 (@DmitriyLewen)
- **PR #11308** (2026-09-29): chore(alpine): add EOL date for Alpine 3.24 and fix 3.21/3.22 dates (@DmitriyLewen)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

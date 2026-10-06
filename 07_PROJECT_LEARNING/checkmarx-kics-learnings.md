# Forensic Learning Record (Deep Inspection): Checkmarx/kics

> **Canonical Artifact**: `07_PROJECT_LEARNING/checkmarx-kics-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Checkmarx/kics](https://github.com/Checkmarx/kics))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:18:18.528Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Checkmarx/kics`
- **Description**: Find security vulnerabilities, compliance issues, and infrastructure misconfigurations early in the development cycle of your infrastructure-as-code with KICS by Checkmarx.
- **Primary Language / Ecosystem**: Open Policy Agent
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2713 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `e2e/utils/csv.go`
```
package utils

import (
	"encoding/csv"
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
)

// CSVToJSON - converts CSV to JSON Structure
func CSVToJSON(t *testing.T, filename string) []byte {
	cwd, _ := os.Getwd()
	filePath := filepath.Join("output", filename)
	fullPath := filepath.Join(cwd, filePath)

	csvFile, err := os.Open(filepath.Clean(fullPath))
	require.NoError(t, err, "Error reading file: %s", fullPath)

	reader := csv.NewReader(csvFile)
	reader.FieldsPerRecord = -1
	csvData, err := reader.ReadAll()
	require.NoError(t, err, "Error reading CSV file: %s", fullPath)

	err = csvFile.Close()
	require.NoError(t, err, "Error when closing file: %s", fullPath)

	var csvStruct csvSchema
	var csvItems []csvSchema

	for _, row := range csvData[1:] {
		line, lineErr := strconv.Atoi(row[16])
		require.NoError(t, lineErr, "Error when converting CSV: %s", fullPath)
		searchLine, searchErr := strconv.Atoi(row[19])
		require.NoError(t, searchErr, "Error when converting CSV: %s", fullPath)

		csvStruct.QueryName = row[0]
		csvStruct.QueryID = row[1]
		csvStruct.QueryURI = row[2]
		csvStruct.Severity = row[3]
		csvStruct.Platform = row[4]
		csvStruct.Cwe = row[5]
		csvStruct.RiskScore = row[6]
		csvStruct.CloudProvider = row[7]
		csvStruct.Category = row[8]
		csvStruct.DescriptionID = row[9]
		csvStruct.Description = row[10]
		csvStruct.CISDescriptionIDFormatted = row[11]
		csvStruct.CISDescriptionTitle = row[12]
		csvStruct.CISDescriptionTextFormatted = row[13]
		csvStruct.FileName = row[14]
		csvStruct.SimilarityID = row[15]
		csvStruct.Line = line
		csvStruct.IssueType = row[17]
		csvStruct.SearchKey = row[18]
		csvStruct.SearchLine = searchLine
		csvStruct.SearchValue = row[20]
		csvStruct.ExpectedValue = row[21]
		csvStruct.ActualValue = row[22]
		csvItems = append(csvItems, csvStruct)
	}

	jsondata, err := json.Marshal(csvItems)
	require.NoError(t, err, "Error marshaling file: %s", fullPath)

	return jsondata
}

type csvSchema struct {
	QueryName                   string
	QueryID                     string
	QueryURI                    string
	Severity                    string
	Platform                    string
	Cwe                         string
	RiskScore                   string
	CloudProvider               string
	Category                    string
	DescriptionID               string
	Description                 string
	CISDescriptionIDFormatted   string
	CISDescriptionTitle         string
	CISDescriptionTextFormatted string
	FileName                    string
	SimilarityID                string
	Line                        int
	IssueType                   string
	SearchKey                   string
	SearchLine                  int
	SearchValue                 string
	ExpectedValue               string
	ActualValue                 string
}

```

### Core Architecture Module: `e2e/utils/helper.go`
```
package utils

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

// CmdOutput stores the structure of kics output
type CmdOutput struct {
	Output []string
	Status int
}

const windowsOs = "windows"

// RunCommand executes the kics in a terminal
func RunCommand(kicsArgs []string, useDocker, useMock bool, kicsDockerImage string) (*CmdOutput, error) {
	descriptionServer := getDescriptionServer(useDocker, useMock)
	var source string
	var args []string

	if useDocker {
		source, args = runKicsDocker(kicsArgs, descriptionServer, kicsDockerImage)
	} else {
		source, args = runKicsDev(kicsArgs)
	}

	cmd := exec.Command(source, args...) //#nosec
	cmd.Env = append(os.Environ(), descriptionServer)
	stdOutput, err := cmd.CombinedOutput()
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			return &CmdOutput{
				Output: strings.Split(string(stdOutput), "\n"),
				Status: exitError.ExitCode(),
			}, nil
		}
		return &CmdOutput{}, err
	}
	return &CmdOutput{
		Output: strings.Split(string(stdOutput), "\n"),
		Status: 0,
	}, nil
}

// KicsDevPathAdapter adapts the path to enable kics locally execution
func KicsDevPathAdapter(path string) string {
	path = filepath.ToSlash(path)
	// [e2e-029] and [e2e-056] config tests
	switch path {
	case "/path/e2e/fixtures/samples/configs/config.json":
		path = strings.ReplaceAll(path, "config.json", "config-dev.json")
	case "/path/e2e/fixtures/samples/configs/config.yaml":
		path = strings.ReplaceAll(path, "config.yaml", "config-dev.yaml")
	}
	regex := regexp.MustCompile(`/path/\w+/`)
	matches := regex.FindString(path)
	switch matches {
	case "":
		return path
	case "/path/e2e/":
		return strings.ReplaceAll(path, matches, "")
	default:
		return strings.ReplaceAll(path, "/path/", "../")
	}
}

// GetKICSDockerImageName gets the kics docker image name
func GetKICSDockerImageName() string {
	return os.Getenv("E2E_KICS_DOCKER")
}

// GetKICSLocalBin returns the kics local bin path
func GetKICSLocalBin() string {
	if runtime.GOOS == windowsOs {
		return filepath.Join("..", "bin", "kics.exe")
	}
	return filepath.Join("..", "bin", "kics")
}

func runKicsDev(kicsArgs []string) (bin string, args []string) {
	kicsRun := GetKICSLocalBin()
	var formatArgs []string
	for _, param := range kicsArgs {
		formatArgs = append(formatArgs, KicsDevPathAdapter(param))
	}
	return kicsRun, formatArgs
}

func runKicsDocker(kicsArgs []string, descriptionServer, kicsDockerImage string) (docker string, args []string) {
	cwd, cwdErr := os.Getwd()
	if cwdErr != nil {
		return "", []string{}
	}
	baseDir := filepath.Dir(cwd)
	dockerArgs := []string{"run", "-e", descriptionServer, "--add-host=host.docker.internal:host-gateway",
		"--user", fmt.Sprintf("%d:%d", os.Getuid(), os.Getgid()),
		"-v", baseDir + ":/path", kicsDockerImage}
	completeArgs := append(dockerArgs, kicsArgs...) //nolint
	return "docker", completeArgs
}

func getDescriptionServer(useDocker, useMock bool) string {
	descriptionServer := "KICS_DESCRIPTIONS_ENDPOINT=http://kics.io"
	if useMock {
		if useDocker {
			descriptionServer = "KICS_DESCRIPTIONS_ENDPOINT=http://host.docker.internal:3000/kics-mock"
		} else {
			descriptionServer = "KICS_DESCRIPTIONS_ENDPOINT=http://localhost:3000/kics-mock"
		}
	}
	return descriptionServer
}

// Contains returns if a string list contains an specific term
func Contains(list []string, searchTerm string) bool {
	for _, a := range list {
		if a == searchTerm {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `e2e/utils/html.go`
```
package utils

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/Checkmarx/kics/v2/internal/constants"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/html"
)

var (
	availablePlatforms = initPlatforms()
	severityIds        = []string{"info", "low", "medium", "high", "critical", "total"}
	headerIds          = []string{"scan-paths", "scan-platforms"}
)

func initPlatforms() map[string]string {
	platforms := make(map[string]string)
	for k, v := range constants.AvailablePlatforms {
		platforms[k] = v
	}
	platforms["Common"] = "common"
	return platforms
}

// HTMLValidation executes many asserts to validate the HTML Report
func HTMLValidation(t *testing.T, file string) {
	// Read & Parse Expected HTML Report
	expectHTMLString, errExpStr := os.ReadFile(filepath.Clean(filepath.Join("fixtures", file)))
	require.NoError(t, errExpStr, "Opening Expected HTML File should not yield an error")
	expectedHTML, errExp := html.Parse(strings.NewReader(string(expectHTMLString)))
	require.NoError(t, errExp, "Opening Expected HTML File should not yield an error")

	// Read & Parse Output HTML Report
	actualHTMLString, errActStr := os.ReadFile(filepath.Clean(filepath.Join("output", file)))
	require.NoError(t, errActStr, "Opening Actual HTML File should not yield an error")
	actualHTML, errAct := html.Parse(strings.NewReader(string(actualHTMLString)))
	require.NoError(t, errAct, "Opening Actual HTML File should not yield an error")

	// Compare Header Data (Paths, Platforms)
	sliceOfExpected := make([]string, 0, len(headerIds))
	sliceOfActual := make([]string, 0, len(headerIds))
	for _, header := range headerIds {
		expectedValue := getElementByID(expectedHTML, header)
		actualValue := getElementByID(actualHTML, header)
		sliceOfActual = append(sliceOfActual, strings.Split(actualValue.LastChild.Data, ",")...)
		// Adapt path if running locally (dev)
		if GetKICSDockerImageName() == "" {
			expectedValue.LastChild.Data = KicsDevPathAdapter(expectedValue.LastChild.Data)
		}
		sliceOfExpected = append(sliceOfExpected, strings.Split(expectedValue.LastChild.Data, ",")...)
		require.NotNil(t, actualValue.LastChild, "[%s] Invalid value in Element ID <%s>", file, header)
	}

	require.ElementsMatch(t, sliceOfExpected, sliceOfActual,
		"[%s] HTML Element :\n- Expected value: %s\n- Actual value: %s\n",
		file, sliceOfExpected, sliceOfActual)

	for arg := range severityIds {
		nodeIdentifier := "severity-count-" + severityIds[arg]
		expectedSeverityValue := getElementByID(expectedHTML, nodeIdentifier)
		actualSeverityValue := getElementByID(actualHTML, nodeIdentifier)

		require.NotNil(t, actualSeverityValue.FirstChild,
			"[%s] Invalid value in Element ID <%s>", file, nodeIdentifier)

		require.Equal(t, expectedSeverityValue.FirstChild.Data, actualSeverityValue.FirstChild.Data,
			"[%s] HTML Element <%s>:\n- Expected value: %s\n- Actual value: %s\n",
			file, nodeIdentifier, expectedSeverityValue.FirstChild.Data, actualSeverityValue.FirstChild.Data)

		classIdentifier := "severity-partial-count-" + severityIds[arg]
		expectedSeverityClassValues := getAndSumElementsByClass(expectedHTML, classIdentifier)
		actualSeverityClassValues := getAndSumElementsByClass(actualHTML, classIdentifier)

		require.Equal(t, expectedSeverityClassValues, actualSeverityClassValues,
			"[%s] Expected Sum of HTML classes <%s>:\n- Expected Value: %d\n- Actual value: %d\n",
			file, classIdentifier, expectedSeverityClassValues, actualSeverityClassValues)
	}

	// Validate Query Names
	queriesClassname := "query-name"
	queriesClasses := getElementsByClass(actualHTML, queriesClassname)
	for _, node := range queriesClasses {
		require.NotNil(t, node.FirstChild,
			"[%s] Invalid query in class element <%s>", file, queriesClassname)
	}

	// Validate Platforms
	platformClassname := "query-info-platform"
	platformsClasses := getElementsByClass(actualHTML, platformClassname)
	for _, node := range platformsClasses {
		require.NotNil(t, node.FirstChild,
			"[%s] Invalid platform in class element <%s>", file, platformClassname)

		require.NotEmpty(t, availablePlatforms[node.FirstChild.Data],
			"[%s] Invalid platform in class element <%s>: %s\n", file, platformClassname, node.FirstChild.Data)
	}

	// Validate Categories
	categoriesClassname := "query-info-category"
	categoriesClasses := getElementsByClass(actualHTML, categoriesClassname)
	for _, node := range categoriesClasses {
		require.NotNil(t, node.FirstChild,
			"[%s] Invalid category in class element <%s>", file, categoriesClassname)

		require.NotEmpty(t, constants.AvailableCategories[node.FirstChild.Data],
			"[%s] Invalid category in class element <%s>: %s\n", file, categoriesClassname, node.FirstChild.Data)
	}

	// Validate Total Number of Results and Code-Boxes
	totalClassname := "severity-count-total"
	total, err := strconv.Atoi(getElementByID(actualHTML, totalClassname).FirstChild.Data)
	require.NoError(t, err, "Getting Total Results should not yield an error")

	codeBoxClassname := "code-box"
	codeBoxClasses := getElementsByClass(actualHTML, codeBoxClassname)

	require.Equal(t, total, len(codeBoxClasses),
		"[%s] The Value of Element ID <%s> is not equal the number of <%s> classes in the HTML File"+
			"\n- <%s>: %d\n- <%s>: %d\n",
		file, totalClassname, codeBoxClassname, totalClassname, total, codeBoxClassname, len(codeBoxClasses))
}

func findAttribute(node *html.Node, key string) (string, bool) {
	for _, attr := range node.Attr {
		if attr.Key == key {
			return attr.Val, true
		}
	}
	return "", false
}

func existsAttribute(node *html.Node, name, tag string) bool {
	if node.Type == html.ElementNode {
		value, exists := findAttribute(node, tag)
		if exists && value == name {
			return true
		}
	}
	return false
}

func getElementByID(n *html.Node, name string) *html.Node {
	response := n

	var f func(node *html.Node, name string)
	f = func(node *html.Node, name string) {
		if existsAttribute(node, name, "id") {
			response = node
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			f(c, name)
		}
	}

	f(n, name)

	return response
}

func getElementsByClass(n *html.Node, name string) []*html.Node {
	var classNodes []*html.Node

	var f func(node *html.Node, name string)
	f = func(node *html.Node, name string) {
		if existsAttribute(node, name, "class") {
			classNodes = append(classNodes, node)
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			f(c, name)
		}
	}

	f(n, name)

	return classNodes
}

func getAndSumElementsByClass(n *html.Node, name string) int {
	classes := getElementsByClass(n, name)
	result := 0

	for i := range classes {
		classValue, err := strconv.Atoi(classes[i].FirstChild.Data)
		if err == nil {
			result += classValue
		}
	}

	return result
}

```

### Core Architecture Module: `e2e/utils/json.go`
```
package utils

import (
	"encoding/json"
	"fmt"
	"io"

	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/xeipuuv/gojsonschema"

	"github.com/Checkmarx/kics/v2/pkg/model"
)

var filekey = "file"

type logMsg struct {
	Level    string `json:"level"`
	ErrorMgs string `json:"error"`
	Message  string `json:"message"`
}

func prepareJSONPath(path string) string {
	cwd, err := os.Getwd()
	if err != nil {
		return ""
	}

	jsonPath := "file://" + filepath.Join(cwd, path)
	if runtime.GOOS == windowsOs {
		jsonPath = strings.ReplaceAll(jsonPath, `\`, "/")
	}
	return jsonPath
}

// JSONSchemaValidationFromFile loads a json file and validates it against a schema
func JSONSchemaValidationFromFile(t *testing.T, file, schema string) {
	schemaPath := prepareJSONPath(filepath.Join("fixtures", "schemas", schema))
	resultPath := prepareJSONPath(filepath.Join("output", file))

	schemaLoader := gojsonschema.NewReferenceLoader(schemaPath)
	resultLoader := gojsonschema.NewReferenceLoader(resultPath)

	JSONSchemaCompare(t, schemaLoader, resultLoader)
}

// JSONSchemaValidationFromData loads a json data and validates it against a schema
func JSONSchemaValidationFromData(t *testing.T, data []byte, schema string) {
	schemaPath := prepareJSONPath(filepath.Join("fixtures", "schemas", schema))

	schemaLoader := gojsonschema.NewReferenceLoader(schemaPath)
	resultLoader := gojsonschema.NewBytesLoader(data)

	JSONSchemaCompare(t, schemaLoader, resultLoader)
}

// JSONSchemaCompare executes schema assertions to validate the content of a JSON file
func JSONSchemaCompare(t *testing.T, schema, report gojsonschema.JSONLoader) {
	result, err := gojsonschema.Validate(schema, report)
	require.NoError(t, err, "Schema Validation: Reading Json/Schema files should not yield an error"+
		"\nSchema: '%s'\nActual File: '%s'", schema.JsonSource(), report.JsonSource())

	schemaErrors := ""
	if !result.Valid() {
		for _, desc := range result.Errors() {
			schemaErrors += "- " + desc.String() + "\n"
		}
	}

	require.True(t, result.Valid(), "Schema Validation Failed\nSchema: '%s'"+
		"\nActual File: '%s'\nFailed validations:\n%v\n", schema.JsonSource(), report.JsonSource(), schemaErrors)
}

// PrepareExpected prepares the files for validation tests
func PrepareExpected(path, folder string) ([]string, error) {
	cont, err := ReadFixture(path, folder)
	if err != nil {
		return []string{}, err
	}
	cont = strings.Trim(cont, "")
	if strings.Contains(cont, "\r\n") {
		return strings.Split(cont, "\r\n"), nil
	}
	return strings.Split(cont, "\n"), nil
}

// ReadFixture reads a file based on a provided path and filename
func ReadFixture(testName, folder string) (string, error) {
	return readFile(filepath.Join(folder, testName))
}

func readFile(path string) (string, error) {
	ostat, err := os.Open(filepath.Clean(path))
	if err != nil {
		return "", err
	}
	bytes, err := io.ReadAll(ostat)
	if err != nil {
		errClose := ostat.Close()
		if errClose != nil {
			return "", errClose
		}
		return "", err
	}
	errClosed := ostat.Close()
	if errClosed != nil {
		return "", errClosed
	}
	return string(bytes), nil
}

func checkJSONLog(t *testing.T, expec, want logMsg) {
	require.Equal(t, expec.Level, want.Level,
		"\nExpected Output line log level\n%s\nKICS Output line log level:\n%s\n", want.Level, expec.Level)
	require.Equal(t, expec.ErrorMgs, want.ErrorMgs,
		"\nExpected Output line error msg\n%s\nKICS Output line error msg:\n%s\n", expec.ErrorMgs, want.ErrorMgs)
	require.Equal(t, expec.Message, want.Message,
		"\nExpected Output line msg\n%s\nKICS Output line msg:\n%s\n", expec.Message, want.Message)
}

// FileCheck executes assertions to validate file content length
func FileCheck(t *testing.T, actualPayloadName, expectPayloadName, location string) {
	expectPayload, err := PrepareExpected(expectPayloadName, "fixtures")
	require.NoError(t, err, "[fixtures/%s]: Reading a fixture should not yield an error", expectPayloadName)

	actualPayload, err := PrepareExpected(actualPayloadName, "output")
	require.NoError(t, err, "[output/%s] Reading a fixture should not yield an error", actualPayloadName)

	require.Equal(t, len(expectPayload), len(actualPayload),
		"[fixtures/%s] Expected file number of lines: %d\n[output/%s] Actual file number of lines: %d\n"+
			"expectedPayload:\n%v\nactualPayload:\n%v\n",
		expectPayloadName, len(expectPayload), actualPayloadName, len(actualPayload),
		formatPayload(expectPayload), formatPayload(actualPayload))
	setFields(t, expectPayload, actualPayload, expectPayloadName, actualPayloadName, location)
}

// CheckLine executes assertions to validate the content of two JSON files
func CheckLine(t *testing.T, expec, want string, line int) {
	logExp := logMsg{}
	logWant := logMsg{}
	errE := json.Unmarshal([]byte(expec), &logExp)
	errW := json.Unmarshal([]byte(want), &logWant)
	if errE == nil && errW == nil {
		checkJSONLog(t, logExp, logWant)
	} else {
		require.Equal(t, expec, want,
			"Expected Output line:\n%s\n\nKICS Output line:\n%s\n\nLine Number: %d", want, expec, line)
	}
}

func formatPayload(payload []string) string {
	var sb strings.Builder
	for _, line := range payload {
		sb.WriteString(line)
		sb.WriteString("\n")
	}
	return sb.String()
}

func formatVulnFiles(files []map[string]interface{}) string {
	var sb strings.Builder
	for _, f := range files {
		b, err := json.MarshalIndent(f, "", " ")
		if err != nil {
			sb.WriteString(fmt.Sprintf("error formatting file: %v\n", err)) //nolint:staticcheck
			continue
		}
		sb.WriteString(string(b))
		sb.WriteString("\n")
	}
	return sb.String()
}

func toComparableFiles(queries []model.QueryResult) []map[string]interface{} {
	result := []map[string]interface{}{}
	for i := range queries {
		for j := range queries[i].Files {
			b, _ := json.Marshal(queries[i].Files[j])
			m := map[string]interface{}{}
			if err := json.Unmarshal(b, &m); err != nil {
				continue
			}
			m["queryName"] = queries[i].QueryName
			result = append(result, m)
		}
	}
	return result
}

//nolint:funlen
func setFields(t *testing.T, expect, actual []string, expectFileName, actualFileName, location string) {
	switch location {
	case "payload":
		setFieldsPayload(t, expect, actual, expectFileName, actualFileName)

	case "result":
		setFieldsResult(t, expect, actual, expectFileName, actualFileName)
	case "result_analyze":
		setFieldsResultAnalyze(t, expect, actual, expectFileName, actualFileName)
	}
}

func setFieldsPayload(t *testing.T, expect, actual []string, expectFileName, actualFileName string) {
	var actualI model.Documents
	var expectI model.Documents
	errE := json.Unmarshal([]byte(strings.Join(expect, "\n")), &expectI)
	require.NoError(t, errE,
		"[fixtures/%s] Expected Payload - Unmarshaling JSON file should not yield an error", expectFileName)
	errW := json.Unmarshal([]byte(strings.Join(actual, "\n")), &actualI)
	require.NoError(t, errW,
		"[output/%s] Actual Payload - Unmarshaling JSON file should not yield an error", actualFileName)

	idKey := "id"
	for _, docs := range actualI.Documents {
		// Here additional checks may be added as length of id, or contains in file
		require.NotNil(t, docs[idKey])
		require.NotNil(t, docs[filekey])
		docs[idKey] = "0"
		docs[filekey] = filekey
	}

	require.ElementsMatch(t, expectI.Documents, actualI.Documents,
		"Expected Payload content: 'fixtures/%s' doesn't match the Actual Payload content: 'output/%s'.",
		expectFileName, actualFileName)
}

func setFieldsResult(t *testing.T, expect, actual []string, expectFileName, actualFileName string) {
	timeValue := time.Date(2021, 5, 1, 9, 0, 0, 0, time.UTC)

	expectI := model.Summary{}
	actualI := model.Summary{}

	errE := json.Unmarshal([]byte(strings.Join(expect, "\n")), &expectI)
	require.NoError(t, errE,
		"[fixtures/%s] Expected Result - Unmarshaling JSON file should not yield an error", expectFileName)
	errW := json.Unmarshal([]byte(strings.Join(actual, "\n")), &actualI)
	require.NoError(t, errW,
		"[output/%s] Actual Result - Unmarshaling JSON file should not yield an error", actualFileName)

	// Disable dynamic values (to avoid errors during file comparison)
	actualI.TotalQueries = 0
	actualI.Start = timeValue
	actualI.End = timeValue
	expectI.TotalQueries = 0
	expectI.Start = timeValue
	expectI.End = timeValue
	actualI.Version = "development"
	expectI.Version = actualI.Version
	actualI.FailedToExecuteQueries = 0
	expectI.FailedToExecuteQueries = 0

	// Adapt path if running locally (dev)
	if GetKICSDockerImageName() == "" {
		for i, scanPath := range expectI.ScannedPaths {
			expectI.ScannedPaths[i] = KicsDevPathAdapter(scanPath)
		}
	}

	for i := range actualI.Queries {
		actualQuery := actualI.Queries[i]
		expectQuery := expectI.Queries[i]

		require.Equal(t, actualQuery.QueryName, expectQuery.QueryName,
			"Expected Result queries doesn't match the actual result queries [in the index: %d]."+
				"\nExpected File: 'fixtures/%s'.\nActual File: 'output/%s'.",
			i, expectFileName, actualFileName)

		require.Equal(t, len(actualQuery.Files), len(expectQuery.Files),
			"Expected query results doesn't match the actual query results [query: %s]."+
				"\nExpected File: 'fixtures/%s'.\nActual File: 'output/%s'.",
			actualQuery.QueryName, expectFileName, actualFileName)

		for j := range actualI.Queries[i].Files {
			actualQuery.Files[j].FileName = ""
			expectQuery.Files[j].FileName = ""
		}
		sort.Slice(actualQuery.Files, func(a, b int) bool {
			return actualQuery.Files[a].SimilarityID < actualQuery.Files[b].SimilarityID
		})
		sort.Slice(expectQuery.Files, func(a, b int) bool {
			return expectQuery.Files[a].SimilarityID < expectQuery.Files[b].SimilarityID
		})
	}

	require.ElementsMatch(t, expectI.ScannedPaths, actualI.ScannedPaths,
		"Expected Result content: 'fixtures/%s' doesn't match the Actual Result Scanned Paths content: 'output/%s'.",
		expectFileName, actualFileName)

	// compare the results
	expectToCompare := toComparableFiles(expectI.Queries)
	
```

### Core Architecture Module: `e2e/utils/xml.go`
```
package utils

import (
	"encoding/json"
	"encoding/xml"
	"os"
	"path/filepath"
	"testing"

	reportModel "github.com/Checkmarx/kics/v2/pkg/report/model"
	"github.com/stretchr/testify/require"
)

// XMLToJSON - converts XML to JSON Structure
func XMLToJSON(t *testing.T, filename, model string) []byte {
	cwd, _ := os.Getwd()
	filePath := filepath.Join("output", filename)
	fullPath := filepath.Join(cwd, filePath)

	file, err := ReadFixture(filePath, cwd)
	require.NoError(t, err, "Error reading file: %s", fullPath)

	switch model {
	default:
		return []byte{}
	case "junit":
		data := reportModel.NewJUnitReport("")
		return readXMLasJSON(t, fullPath, file, data)
	case "cyclonedx":
		data := CycloneSchema{}
		return readXMLasJSON(t, fullPath, file, &data)
	}
}

func readXMLasJSON(t *testing.T, fullPath, file string, data interface{}) []byte {
	err := xml.Unmarshal([]byte(file), &data)
	require.NoError(t, err, "Error unmarshalling file: %s", fullPath)

	jsonData, err := json.Marshal(data)
	require.NoError(t, err, "Error marshaling file: %s", fullPath)

	return jsonData
}

// CycloneSchema is the struct used to unmarshal the cyclonedx xml
type CycloneSchema struct {
	XMLName      xml.Name `xml:"bom"`
	XMLNS        string   `xml:"xmlns,attr"`
	XMLNSV       string   `xml:"v,attr"`
	SerialNumber string   `xml:"serialNumber,attr"`
	Version      string   `xml:"version,attr"`
	Metadata     struct {
		Timestamp string `xml:"timestamp"`
		Tools     []struct {
			Vendor  string `xml:"vendor"`
			Name    string `xml:"name"`
			Version string `xml:"version"`
		} `xml:"tools>tool"`
	} `xml:"metadata"`
	Components struct {
		Components []struct {
			Type    string `xml:"type,attr"`
			BomRef  string `xml:"bom-ref,attr"`
			Name    string `xml:"name"`
			Version string `xml:"version"`
			Hashes  []struct {
				Alg     string `xml:"alg,attr"`
				Content string `xml:",chardata"`
			} `xml:"hashes>hash"`
			Purl            string `xml:"purl"`
			Vulnerabilities []struct {
				Ref       string `xml:"ref,attr"`
				ID        string `xml:"id"`
				CWE       string `xml:"cwe"`
				RiskScore string `xml:"riskScore"`
				Source    struct {
					Name string `xml:"name"`
					URL  string `xml:"url"`
				} `xml:"source"`
				Ratings []struct {
					Severity string `xml:"severity"`
					Method   string `xml:"method"`
				} `xml:"ratings>rating"`
				Description     string `xml:"description"`
				Recommendations []struct {
					Recommendation string `xml:"Recommendation"`
				} `xml:"recommendations>recommendation"`
			} `xml:"vulnerabilities>vulnerability"`
		} `xml:"component"`
	} `xml:"components"`
}

```

### Core Architecture Module: `internal/console/flags/flags_utils.go`
```
package flags

import (
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"
)

// FormatNewError reports the impossibility of flag1 and flag2 usage simultaneously
func FormatNewError(flag1, flag2 string) error {
	return errors.Errorf("can't provide '%s' and '%s' flags simultaneously",
		flag1,
		flag2)
}

// ValidateQuerySelectionFlags reports the impossibility of include and exclude flags usage simultaneously
func ValidateQuerySelectionFlags() error {
	if len(GetMultiStrFlag(IncludeQueriesFlag)) > 0 && len(GetMultiStrFlag(ExcludeQueriesFlag)) > 0 {
		return FormatNewError(IncludeQueriesFlag, ExcludeQueriesFlag)
	}
	if len(GetMultiStrFlag(IncludeQueriesFlag)) > 0 && len(GetMultiStrFlag(ExcludeCategoriesFlag)) > 0 {
		return FormatNewError(IncludeQueriesFlag, ExcludeCategoriesFlag)
	}
	return nil
}

// ValidateTypeSelectionFlags reports the impossibility of include and exclude flags usage simultaneously
func ValidateTypeSelectionFlags() error {
	if len(GetMultiStrFlag(TypeFlag)) > 1 && len(GetMultiStrFlag(ExcludeTypeFlag)) > 1 {
		return FormatNewError(TypeFlag, ExcludeTypeFlag)
	}
	if GetMultiStrFlag(TypeFlag)[0] != "" && GetMultiStrFlag(ExcludeTypeFlag)[0] != "" {
		return FormatNewError(TypeFlag, ExcludeTypeFlag)
	}
	return nil
}

// BindFlags fill flags values with config file or environment variables data
func BindFlags(cmd *cobra.Command, v *viper.Viper) error {
	log.Debug().Msg("console.bindFlags()")
	settingsMap := v.AllSettings()
	cmd.Flags().VisitAll(func(f *pflag.Flag) {
		settingsMap[f.Name] = true
		if strings.Contains(f.Name, "-") {
			envVarSuffix := strings.ToUpper(strings.ReplaceAll(f.Name, "-", "_"))
			variableName := fmt.Sprintf("%s_%s", "KICS", envVarSuffix)
			if err := v.BindEnv(f.Name, variableName); err != nil {
				log.Err(err).Msg("Failed to bind Viper flags")
			}
		}
		if !f.Changed && v.IsSet(f.Name) {
			val := v.Get(f.Name)
			setBoundFlags(f.Name, val, cmd)
		}
	})
	for key, val := range settingsMap {
		if val != true {
			return fmt.Errorf("unknown configuration key: '%s'\nShowing help for '%s' command", key, cmd.Name())
		}
	}
	return nil
}

func setBoundFlags(flagName string, val interface{}, cmd *cobra.Command) {
	switch t := val.(type) {
	case []interface{}:
		var paramSlice []string
		for _, param := range t {
			paramSlice = append(paramSlice, param.(string))
		}
		valStr := strings.Join(paramSlice, ",")
		if err := cmd.Flags().Set(flagName, valStr); err != nil {
			log.Err(err).Msg("Failed to set Viper flags")
		}
	default:
		if err := cmd.Flags().Set(flagName, fmt.Sprintf("%v", val)); err != nil {
			log.Err(err).Msg("Failed to set Viper flags")
		}
	}
}

```

### Core Architecture Module: `pkg/engine/mock/source.go`
```
// Code generated by MockGen. DO NOT EDIT.
// Source: ./pkg/engine/source/source.go

// Package mock is a generated GoMock package.
package mock

import (
	reflect "reflect"

	source "github.com/Checkmarx/kics/v2/pkg/engine/source"
	model "github.com/Checkmarx/kics/v2/pkg/model"
	gomock "github.com/golang/mock/gomock"
)

// MockQueriesSource is a mock of QueriesSource interface.
type MockQueriesSource struct {
	ctrl     *gomock.Controller
	recorder *MockQueriesSourceMockRecorder
}

// MockQueriesSourceMockRecorder is the mock recorder for MockQueriesSource.
type MockQueriesSourceMockRecorder struct {
	mock *MockQueriesSource
}

// NewMockQueriesSource creates a new mock instance.
func NewMockQueriesSource(ctrl *gomock.Controller) *MockQueriesSource {
	mock := &MockQueriesSource{ctrl: ctrl}
	mock.recorder = &MockQueriesSourceMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use.
func (m *MockQueriesSource) EXPECT() *MockQueriesSourceMockRecorder {
	return m.recorder
}

// GetQueries mocks base method.
func (m *MockQueriesSource) GetQueries(querySelection *source.QueryInspectorParameters) ([]model.QueryMetadata, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetQueries", querySelection)
	ret0, _ := ret[0].([]model.QueryMetadata)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetQueries indicates an expected call of GetQueries.
func (mr *MockQueriesSourceMockRecorder) GetQueries(querySelection interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetQueries", reflect.TypeOf((*MockQueriesSource)(nil).GetQueries), querySelection)
}

// GetQueryLibrary mocks base method.
func (m *MockQueriesSource) GetQueryLibrary(platform string) (source.RegoLibraries, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetQueryLibrary", platform)
	ret0, _ := ret[0].(source.RegoLibraries)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetQueryLibrary indicates an expected call of GetQueryLibrary.
func (mr *MockQueriesSourceMockRecorder) GetQueryLibrary(platform interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetQueryLibrary", reflect.TypeOf((*MockQueriesSource)(nil).GetQueryLibrary), platform)
}

```

### Core Architecture Module: `pkg/engine/provider/extract.go`
```
package provider

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"os/signal"
	"path/filepath"
	"sync"

	"github.com/alexmullins/zip"

	"github.com/rs/zerolog/log"

	"github.com/Checkmarx/kics/v2/pkg/kuberneter"
	"github.com/Checkmarx/kics/v2/pkg/model"

	"github.com/hashicorp/go-getter"
)

const (
	channelLength = 2
)

// ExtractedPath is a struct that contains the paths and the extraction map of the sources.
// Path is the slice of paths to scan.
// ExtractionMap correlates the temporary extraction path to the original given path.
type ExtractedPath struct {
	Path          []string
	ExtractionMap map[string]model.ExtractedPathObject
}

type getterStruct struct {
	ctx         context.Context
	cancel      context.CancelFunc
	mode        getter.ClientMode
	pwd         string
	opts        []getter.ClientOption
	destination string
	source      string
}

// GetKuberneterSources uses Kubernetes API to download runtime resources
// After Downloaded files kics scan the files as normal local files
func GetKuberneterSources(ctx context.Context, source []string, destinationPath string) (ExtractedPath, error) {
	extrStruct := ExtractedPath{
		Path:          []string{},
		ExtractionMap: make(map[string]model.ExtractedPathObject),
	}

	for _, path := range source {
		exportedPath, err := kuberneter.Import(ctx, path, destinationPath)
		if err != nil {
			log.Error().Msgf("failed to import %s: %s", path, err)
		}

		extrStruct.ExtractionMap[exportedPath] = model.ExtractedPathObject{
			Path:      exportedPath,
			LocalPath: true,
		}

		extrStruct.Path = append(extrStruct.Path, exportedPath)
	}

	return extrStruct, nil
}

// GetSources goes through the source slice, and determines the of source type (ex: zip, git, local).
// It than extracts the files to be scanned. If the source given is not local, a temp dir
// will be created where the files will be stored.
func GetSources(source []string) (ExtractedPath, error) {
	extrStruct := ExtractedPath{
		Path:          []string{},
		ExtractionMap: make(map[string]model.ExtractedPathObject),
	}
	for _, path := range source {
		parent, err := os.MkdirTemp("", "kics-extract-*")
		if err != nil {
			log.Error().Msgf("failed to create extraction temp dir: %s", err)
			return ExtractedPath{}, err
		}
		destination := filepath.Join(parent, "src") // path to src folder to be used by go-getter inside temp folder

		mode := getter.ClientModeAny

		pwd, err := os.Getwd()
		if err != nil {
			log.Fatal().Msgf("Error getting wd: %s", err)
		}

		var opts []getter.ClientOption

		ctx, cancel := context.WithCancel(context.Background()) //nolint:gosec

		goGetter := getterStruct{
			ctx:         ctx,
			cancel:      cancel,
			mode:        mode,
			pwd:         pwd,
			opts:        opts,
			destination: destination,
			source:      path,
		}

		getterDst, err := getPaths(&goGetter)
		if err != nil {
			if removeErr := os.RemoveAll(parent); removeErr != nil {
				log.Warn().Msgf("failed to remove extraction temp dir %s: %s", parent, removeErr)
			}
			if ignoreDamagedFiles(path) {
				continue
			}
			log.Error().Msgf("%s", err)
			return ExtractedPath{}, err
		}
		tempDst, local, err := checkSymLink(getterDst, path)
		if err != nil {
			if removeErr := os.RemoveAll(parent); removeErr != nil {
				log.Warn().Msgf("failed to remove extraction temp dir %s: %s", parent, removeErr)
			}
			log.Warn().Msgf("%s", err)
			continue
		}

		extrStruct.ExtractionMap[getterDst] = model.ExtractedPathObject{
			Path:      path,
			LocalPath: local,
		}

		extrStruct.Path = append(extrStruct.Path, tempDst)
	}

	return extrStruct, nil
}

func getPaths(g *getterStruct) (string, error) {
	if isEncrypted(g.source) {
		err := errors.New("zip encrypted files are not supported")
		log.Err(err)
		return "", err
	}

	// Build the client
	client := &getter.Client{
		Ctx:     g.ctx,
		Src:     g.source,
		Dst:     g.destination,
		Pwd:     g.pwd,
		Mode:    g.mode,
		Options: g.opts,
	}

	wg := sync.WaitGroup{}
	wg.Add(1)
	errChan := make(chan error, channelLength)
	go func() {
		defer wg.Done()
		defer g.cancel()
		if err := client.Get(); err != nil {
			errChan <- err
		}
	}()

	c := make(chan os.Signal, channelLength)
	signal.Notify(c, os.Interrupt)

	select {
	case <-c:
		signal.Reset(os.Interrupt)
		g.cancel()
		wg.Wait()
	case <-g.ctx.Done():
		wg.Wait()
	case err := <-errChan:
		wg.Wait()
		return "", err
	}

	return g.destination, nil
}

// check if the dst is a symbolic link
func checkSymLink(getterDst, pathFile string) (getDest string, isLocal bool, err error) {
	var local bool
	_, err = os.Stat(pathFile)
	if err == nil { // check if file exist locally
		local = true
	}

	info, err := os.Lstat(getterDst)
	if err != nil {
		log.Error().Msgf("failed lstat for %s: %v", getterDst, err)
		return "", false, err
	}

	fileInfo := getFileInfo(info, getterDst, pathFile)

	if info.Mode()&os.ModeSymlink != 0 { // if it's a symbolic Link
		path, err := os.Readlink(getterDst) // get location of symbolic Link
		if err != nil {
			log.Error().Msgf("failed Readlink for %s: %v", getterDst, err)
			return "", false, err
		}
		getterDst = path // change path to local path
	} else if !fileInfo.IsDir() { // symbolic links are not created for single files
		if local { // check if file exist locally
			getterDst = pathFile
		}
	}
	return getterDst, local, nil
}

func getFileInfo(info fs.FileInfo, dst, pathFile string) fs.FileInfo {
	var extension = filepath.Ext(pathFile)
	var path string
	if extension == "" {
		path = filepath.Join(dst, filepath.Base(pathFile[0:len(pathFile)-len(extension)])) // for single file
	} else {
		path = filepath.Join(dst, filepath.Base(pathFile)) // for directories
	}
	fileInfo, err := os.Lstat(path)
	if err != nil {
		fileInfo = info
	}
	return fileInfo
}

func isEncrypted(sourceFile string) bool {
	if filepath.Ext(sourceFile) != ".zip" {
		return false
	}
	zipFile, err := zip.OpenReader(sourceFile)
	if err != nil {
		log.Error().Msgf("failed to open %s: %v", sourceFile, err)
		return false
	}
	defer func() {
		if errClose := zipFile.Close(); errClose != nil {
			log.Error().Err(errClose).Msg("Error closing zip file")
		}
	}()
	for _, file := range zipFile.File {
		if file.IsEncrypted() {
			log.Error().Msgf("file %s is encrypted", sourceFile)
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `pkg/engine/provider/filesystem.go`
```
package provider

import (
	"context"
	"fmt"
	ioFs "io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"

	sentryReport "github.com/Checkmarx/kics/v2/internal/sentry"
	"github.com/Checkmarx/kics/v2/pkg/model"
	"github.com/Checkmarx/kics/v2/pkg/utils"
	"github.com/pkg/errors"
	"github.com/rs/zerolog/log"
	"github.com/yargevad/filepathx"
)

// FileSystemSourceProvider provides a path to be scanned
// and a list of files which will not be scanned
type FileSystemSourceProvider struct {
	paths    []string
	excludes map[string][]os.FileInfo
	mu       sync.RWMutex
}

var (
	queryRegexExcludeTerraCache = regexp.MustCompile(fmt.Sprintf(`^(.*?%s)?\.terra.*`, regexp.QuoteMeta(string(os.PathSeparator))))
	// ErrNotSupportedFile - error representing when a file format is not supported by KICS
	ErrNotSupportedFile = errors.New("invalid file format")
)

// NewFileSystemSourceProvider initializes a FileSystemSourceProvider with path and files that will be ignored
func NewFileSystemSourceProvider(paths, excludes []string) (*FileSystemSourceProvider, error) {
	log.Debug().Msgf("provider.NewFileSystemSourceProvider()")
	ex := make(map[string][]os.FileInfo, len(excludes))
	osPaths := make([]string, len(paths))
	for idx, path := range paths {
		osPaths[idx] = filepath.FromSlash(path)
	}
	fs := &FileSystemSourceProvider{
		paths:    osPaths,
		excludes: ex,
	}
	for _, exclude := range excludes {
		excludePaths, err := GetExcludePaths(exclude)
		if err != nil {
			return nil, err
		}
		if err := fs.AddExcluded(excludePaths); err != nil {
			return nil, err
		}
	}

	return fs, nil
}

// AddExcluded add new excluded files to the File System Source Provider
func (s *FileSystemSourceProvider) AddExcluded(excludePaths []string) error {
	for _, excludePath := range excludePaths {
		info, err := os.Stat(excludePath)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			if sysErr, ok := err.(*ioFs.PathError); ok {
				log.Warn().Msgf("Failed getting file info for file '%s', Skipping due to: %s, Error number: %d",
					excludePath, sysErr, sysErr.Err.(syscall.Errno))
				continue
			}
			return errors.Wrap(err, "failed to open excluded file")
		}
		s.mu.Lock()
		if _, ok := s.excludes[info.Name()]; !ok {
			s.excludes[info.Name()] = make([]os.FileInfo, 0)
		}
		s.excludes[info.Name()] = append(s.excludes[info.Name()], info)
		s.mu.Unlock()
	}
	return nil
}

// GetExcludePaths gets all the files that should be excluded
func GetExcludePaths(pathExpressions string) ([]string, error) {
	if strings.ContainsAny(pathExpressions, "*?[") {
		info, err := filepathx.Glob(pathExpressions)
		if err != nil {
			log.Error().Msgf("failed to get exclude path %s: %s", pathExpressions, err)
			return []string{pathExpressions}, nil
		}
		return info, nil
	}
	return []string{pathExpressions}, nil
}

// GetBasePaths returns base path of FileSystemSourceProvider
func (s *FileSystemSourceProvider) GetBasePaths() []string {
	return s.paths
}

// ignoreDamagedFiles checks whether we should ignore a damaged file from a scan or not.
func ignoreDamagedFiles(path string) bool {
	shouldIgnoreFile := false
	fileInfo, err := os.Lstat(path)
	if err != nil {
		log.Warn().Msgf("Failed getting the file info for file '%s'", path)
		return false
	}
	log.Info().Msgf("No mode type bits are set( is a regular file ) for file '%s' : %t ", path, fileInfo.Mode().IsRegular())

	if fileInfo.Mode()&os.ModeSymlink == os.ModeSymlink {
		log.Warn().Msgf("File '%s' is a symbolic link - but seems not to be accessible", path)
		shouldIgnoreFile = true
	}

	return shouldIgnoreFile
}

// GetSources tries to open file or directory and execute sink function on it
func (s *FileSystemSourceProvider) GetSources(ctx context.Context,
	extensions model.Extensions, sink Sink, resolverSink ResolverSink) error {
	for _, scanPath := range s.paths {
		fileInfo, err := os.Stat(scanPath)
		if err != nil {
			return errors.Wrap(err, "failed to open path")
		}

		if !fileInfo.IsDir() {
			c, openFileErr := openScanFile(scanPath, extensions)
			if openFileErr != nil {
				if errors.Is(openFileErr, ErrNotSupportedFile) || ignoreDamagedFiles(scanPath) {
					continue
				}
				return openFileErr
			}
			if sinkErr := sink(ctx, scanPath, c); sinkErr != nil {
				return sinkErr
			}
			continue
		}

		err = s.walkDir(ctx, scanPath, false, sink, resolverSink, extensions)
		if err != nil {
			return errors.Wrap(err, "failed to walk directory")
		}
		continue
	}
	return nil
}

func (s *FileSystemSourceProvider) walkDir(ctx context.Context, scanPath string, resolved bool,
	sink Sink, resolverSink ResolverSink, extensions model.Extensions) error {
	return filepath.Walk(scanPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if shouldSkip, skipFolder := s.checkConditions(info, extensions, path, resolved); shouldSkip {
			return skipFolder
		}

		// ------------------ Helm resolver --------------------------------
		if info.IsDir() {
			excluded, errRes := resolverSink(ctx, strings.ReplaceAll(path, "\\", "/"))
			if errRes != nil {
				sentryReport.ReportSentry(&sentryReport.Report{
					Message:  fmt.Sprintf("Filesystem files provider couldn't Resolve Directory, file=%s", info.Name()),
					Err:      errRes,
					Location: "func walkDir()",
					FileName: info.Name(),
				}, true)
				return nil
			}
			if errAdd := s.AddExcluded(excluded); errAdd != nil {
				log.Err(errAdd).Msgf("Filesystem files provider couldn't exclude rendered Chart files, Chart=%s", info.Name())
			}
			resolved = true
			return nil
		}
		// -----------------------------------------------------------------

		c, err := os.Open(filepath.Clean(path)) //nolint:gosec
		if err != nil {
			if ignoreDamagedFiles(filepath.Clean(path)) {
				return nil
			}
			return errors.Wrap(err, "failed to open file")
		}
		defer closeFile(c, info)

		err = sink(ctx, strings.ReplaceAll(path, "\\", "/"), c)
		if err != nil {
			sentryReport.ReportSentry(&sentryReport.Report{
				Message:  fmt.Sprintf("Filesystem files provider couldn't parse file, file=%s", info.Name()),
				Err:      err,
				Location: "func walkDir()",
				FileName: info.Name(),
			}, true)
		}
		return nil
	})
}

func openScanFile(scanPath string, extensions model.Extensions) (*os.File, error) {
	ext, _ := utils.GetExtension(scanPath)

	if !extensions.Include(ext) {
		return nil, ErrNotSupportedFile
	}

	c, errOpenFile := os.Open(filepath.Clean(scanPath))
	if errOpenFile != nil {
		return nil, errors.Wrap(errOpenFile, "failed to open path")
	}
	return c, nil
}

func closeFile(file *os.File, info os.FileInfo) {
	if err := file.Close(); err != nil {
		sentryReport.ReportSentry(&sentryReport.Report{
			Message:  fmt.Sprintf("Filesystem couldn't close file, file=%s", info.Name()),
			Err:      err,
			Location: "func closeFile()",
			FileName: info.Name(),
		}, true)
	}
}

func (s *FileSystemSourceProvider) checkConditions(info os.FileInfo, extensions model.Extensions,
	path string, resolved bool) (bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if info.IsDir() {
		// exclude terraform cache folders
		if queryRegexExcludeTerraCache.MatchString(path) {
			log.Info().Msgf("Directory ignored: %s", path)

			err := s.AddExcluded([]string{info.Name()})
			if err != nil {
				return true, err
			}
			return true, filepath.SkipDir
		}
		if f, ok := s.excludes[info.Name()]; ok && containsFile(f, info) {
			log.Info().Msgf("Directory ignored: %s", path)
			return true, filepath.SkipDir
		}
		_, err := os.Stat(filepath.Join(path, "Chart.yaml"))
		if err != nil || resolved {
			return true, nil
		}
		return false, nil
	}

	if f, ok := s.excludes[info.Name()]; ok && containsFile(f, info) {
		log.Trace().Msgf("File ignored: %s", path)
		return true, nil
	}
	ext, _ := utils.GetExtension(path)
	if !extensions.Include(ext) {
		log.Trace().Msgf("File ignored: %s", path)
		return true, nil
	}
	return false, nil
}

func containsFile(fileList []os.FileInfo, target os.FileInfo) bool {
	for _, file := range fileList {
		if os.SameFile(file, target) {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `pkg/engine/provider/provider.go`
```
package provider

import (
	"context"
	"io"

	"github.com/Checkmarx/kics/v2/pkg/model"
)

// Sink defines a sink function to be passed as reference to functions
type Sink func(ctx context.Context, filename string, content io.ReadCloser) error

// ResolverSink defines a sink function to be passed as reference to functions for resolved files/templates
type ResolverSink func(ctx context.Context, filename string) ([]string, error)

// SourceProvider is the interface that wraps the basic GetSources method.
// GetBasePath returns base path of FileSystemSourceProvider
// GetSources receives context, receive ID, extensions supported and a sink function to save sources
type SourceProvider interface {
	GetBasePaths() []string
	GetSources(ctx context.Context, extensions model.Extensions, sink Sink, resolverSink ResolverSink) error
}

```

### Core Architecture Module: `pkg/engine/similarity/similarity_id.go`
```
package similarity

import (
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
)

// ComputeSimilarityID This function receives four string parameters and computes
// a sha256 hash
func ComputeSimilarityID(basePaths []string, filePath, subDocumentIdx, queryID,
	searchKeyOrSearchLine, searchValue string) (*string, error) {
	basePath := ""
	for _, path := range basePaths {
		if strings.Contains(filepath.ToSlash(filePath), filepath.ToSlash(path)) {
			basePath = filepath.ToSlash(path)
			break
		}
	}
	standardizedPath, err := standardizeToRelativePath(basePath, filePath)
	if err != nil {
		log.Debug().Msgf("Error while standardizing path: %s", err)
	}

	if subDocumentIdx != "0" && subDocumentIdx != "" { // subDocumentIdx is used to uniquely identify sub-documents in YAML
		standardizedPath += subDocumentIdx
	}

	var stringNode = standardizedPath + queryID + searchKeyOrSearchLine + searchValue

	hashSum := sha256.Sum256([]byte(stringNode))

	similarity := hex.EncodeToString(hashSum[:])
	return &similarity, nil
}

func standardizeToRelativePath(basePath, path string) (string, error) {
	cleanPath := filepath.Clean(path)
	standardPath := filepath.ToSlash(cleanPath)
	basePath = filepath.ToSlash(basePath)
	relativeStandardPath, err := filepath.Rel(basePath, standardPath)
	if err != nil {
		return "", err
	}
	return filepath.ToSlash(relativeStandardPath), nil
}

```

### Core Architecture Module: `pkg/engine/source/filesystem.go`
```
package source

import (
	"encoding/json"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/pkg/errors"
	"github.com/rs/zerolog/log"
	"golang.org/x/exp/maps"

	"github.com/Checkmarx/kics/v2/assets"
	"github.com/Checkmarx/kics/v2/internal/constants"
	sentryReport "github.com/Checkmarx/kics/v2/internal/sentry"
	"github.com/Checkmarx/kics/v2/pkg/model"
)

// FilesystemSource this type defines a struct with a path to a filesystem source of queries
// Source is the path to the queries
// Types are the types given by the flag --type for query selection mechanism
type FilesystemSource struct {
	Source              []string
	Types               []string
	CloudProviders      []string
	Library             string
	ExperimentalQueries bool
}

const (
	// QueryFileName The default query file name
	QueryFileName = "query.rego"
	// MetadataFileName The default metadata file name
	MetadataFileName = "metadata.json"
	// LibrariesDefaultBasePath the path to rego libraries
	LibrariesDefaultBasePath = "./assets/libraries"

	emptyInputData = "{}"

	common = "Common"

	kicsDefault = "default"
)

// NewFilesystemSource initializes a NewFilesystemSource with source to queries and types of queries to load
func NewFilesystemSource(source, types, cloudProviders []string, libraryPath string, experimentalQueries bool) *FilesystemSource {
	log.Debug().Msg("source.NewFilesystemSource()")

	if len(types) == 0 {
		types = []string{""}
	}

	if len(cloudProviders) == 0 {
		cloudProviders = []string{""}
	}

	for s := range source {
		source[s] = filepath.FromSlash(source[s])
	}

	return &FilesystemSource{
		Source:              source,
		Types:               types,
		CloudProviders:      cloudProviders,
		Library:             filepath.FromSlash(libraryPath),
		ExperimentalQueries: experimentalQueries,
	}
}

// ListSupportedPlatforms returns a list of supported platforms
func ListSupportedPlatforms() []string {
	platforms := maps.Keys(constants.AvailablePlatforms)
	sort.Strings(platforms)
	return platforms
}

// ListSupportedCloudProviders returns a list of supported cloud providers
func ListSupportedCloudProviders() []string {
	cloudProviders := maps.Keys(constants.AvailableCloudProviders)
	sort.Strings(cloudProviders)
	return cloudProviders
}

func getLibraryInDir(platform, libraryDirPath string) string {
	var libraryFilePath string
	err := filepath.Walk(libraryDirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if strings.EqualFold(filepath.Base(path), platform+".rego") { // try to find the library file <platform>.rego
			libraryFilePath = path
		}
		return nil
	})
	if err != nil {
		log.Error().Msgf("Failed to analyze path %s: %s", libraryDirPath, err)
	}
	return libraryFilePath
}

func isDefaultLibrary(libraryPath string) bool {
	return filepath.FromSlash(libraryPath) == filepath.FromSlash(LibrariesDefaultBasePath)
}

// GetPathToCustomLibrary - returns the libraries path for a given platform
func GetPathToCustomLibrary(platform, libraryPathFlag string) string {
	libraryFilePath := kicsDefault

	if !isDefaultLibrary(libraryPathFlag) {
		log.Debug().Msgf("Trying to load custom libraries from %s", libraryPathFlag)

		library := getLibraryInDir(platform, libraryPathFlag)
		// found a library named according to the platform
		if library != "" {
			libraryFilePath = library
		}
	}

	return libraryFilePath
}

// GetQueryLibrary returns the library.rego for the platform passed in the argument
func (s *FilesystemSource) GetQueryLibrary(platform string) (RegoLibraries, error) {
	library := GetPathToCustomLibrary(platform, s.Library)
	customLibraryCode := ""
	customLibraryData := emptyInputData

	if library == "" {
		return RegoLibraries{}, errors.New("unable to get libraries path")
	}

	if library != kicsDefault {
		byteContent, err := os.ReadFile(filepath.Clean(library))
		if err != nil {
			return RegoLibraries{}, err
		}
		customLibraryCode = string(byteContent)
		customLibraryData, err = readInputData(strings.TrimSuffix(library, filepath.Ext(library)) + ".json")
		if err != nil {
			log.Debug().Msg(err.Error())
		}
	} else {
		log.Debug().Msgf("Custom library %s not provided. Loading embedded library instead", platform)
	}
	// getting embedded library
	embeddedLibraryCode, errGettingEmbeddedLibrary := assets.GetEmbeddedLibrary(strings.ToLower(platform))
	if errGettingEmbeddedLibrary != nil {
		return RegoLibraries{}, errGettingEmbeddedLibrary
	}

	mergedLibraryCode, errMergeLibs := mergeLibraries(customLibraryCode, embeddedLibraryCode)
	if errMergeLibs != nil {
		return RegoLibraries{}, errMergeLibs
	}

	embeddedLibraryData, errGettingEmbeddedLibraryCode := assets.GetEmbeddedLibraryData(strings.ToLower(platform))
	if errGettingEmbeddedLibraryCode != nil {
		// only "common" ships embedded library data
		if strings.EqualFold(platform, common) {
			log.Debug().Msgf("Could not open embedded library data for %s platform", platform)
		}
		embeddedLibraryData = emptyInputData
	}
	mergedLibraryData, errMergingLibraryData := MergeInputData(embeddedLibraryData, customLibraryData)
	if errMergingLibraryData != nil {
		log.Debug().Msgf("Could not merge library data for %s platform", platform)
	}

	regoLibrary := RegoLibraries{
		LibraryCode:      mergedLibraryCode,
		LibraryInputData: mergedLibraryData,
	}
	return regoLibrary, nil
}

// CheckType checks if the queries have the type passed as an argument in '--type' flag to be loaded
func (s *FilesystemSource) CheckType(queryPlatform interface{}) bool {
	if queryPlatform.(string) == common {
		return true
	}
	if s.Types[0] != "" {
		for _, t := range s.Types {
			if strings.EqualFold(t, queryPlatform.(string)) {
				return true
			}
		}
		return false
	}
	return true
}

// CheckCloudProvider checks if the queries have the cloud provider passed as an argument in '--cloud-provider' flag to be loaded
func (s *FilesystemSource) CheckCloudProvider(cloudProvider interface{}) bool {
	if cloudProvider != nil {
		if strings.EqualFold(cloudProvider.(string), common) {
			return true
		}
		if s.CloudProviders[0] != "" {
			return strings.Contains(strings.ToUpper(strings.Join(s.CloudProviders, ",")), strings.ToUpper(cloudProvider.(string)))
		}
	}

	if s.CloudProviders[0] == "" {
		return true
	}

	return false
}

func checkQueryInclude(id interface{}, includedQueries []string) bool {
	queryMetadataKey, ok := id.(string)
	if !ok {
		log.Warn().
			Msgf("Can't cast query metadata key = %v", id)
		return false
	}
	for _, includedQuery := range includedQueries {
		if queryMetadataKey == includedQuery {
			return true
		}
	}
	return false
}

func checkQueryExcludeField(id interface{}, excludeQueries []string) bool {
	queryMetadataKey, ok := id.(string)
	if !ok {
		log.Warn().
			Msgf("Can't cast query metadata key = %v", id)
		return false
	}
	for _, excludedQuery := range excludeQueries {
		if strings.EqualFold(queryMetadataKey, excludedQuery) {
			return true
		}
	}
	return false
}

func checkQueryExclude(metadata map[string]interface{}, queryParameters *QueryInspectorParameters) bool {
	return checkQueryExcludeField(metadata["id"], queryParameters.ExcludeQueries.ByIDs) ||
		checkQueryExcludeField(metadata["category"], queryParameters.ExcludeQueries.ByCategories) ||
		checkQueryExcludeField(metadata["severity"], queryParameters.ExcludeQueries.BySeverities) ||
		(!queryParameters.BomQueries && metadata["severity"] == model.SeverityTrace)
}

// GetQueries walks a given filesource path returns all queries found in an array of
// QueryMetadata struct
func (s *FilesystemSource) GetQueries(queryParameters *QueryInspectorParameters) ([]model.QueryMetadata, error) {
	queryDirs, err := s.iterateSources()
	if err != nil {
		return nil, err
	}

	queries := s.iterateQueryDirs(queryDirs, queryParameters)

	return queries, nil
}

func (s *FilesystemSource) iterateSources() ([]string, error) {
	queryDirs := make([]string, 0)

	for _, source := range s.Source {
		err := filepath.Walk(source,
			func(p string, f os.FileInfo, err error) error {
				if err != nil {
					return err
				}

				if f.IsDir() || f.Name() != QueryFileName {
					return nil
				}

				querypathDir := filepath.Dir(p)

				if err == nil {
					queryDirs = append(queryDirs, querypathDir)
				} else if err != nil {
					return errors.Wrap(err, "Failed to get query relative path")
				}

				return nil
			})
		if err != nil {
			return nil, errors.Wrap(err, "failed to get query Source")
		}
	}

	return queryDirs, nil
}

// iterateQueryDirs iterates all query directories and reads the respective queries
func (s *FilesystemSource) iterateQueryDirs(queryDirs []string, queryParameters *QueryInspectorParameters) []model.QueryMetadata {
	queries := make([]model.QueryMetadata, 0, len(queryDirs))

	for _, queryDir := range queryDirs {
		query, errRQ := ReadQuery(queryDir)
		if errRQ != nil {
			sentryReport.ReportSentry(&sentryReport.Report{
				Message:  fmt.Sprintf("Query provider failed to read query, query=%s", path.Base(queryDir)),
				Err:      errRQ,
				Location: "func GetQueries()",
				FileName: path.Base(queryDir),
			}, true)
			continue
		}

		if query.Experimental && !queryParameters.ExperimentalQueries {
			continue
		}

		if !s.CheckType(query.Metadata["platform"]) {
			continue
		}

		if !s.CheckCloudProvider(query.Metadata["cloudProvider"]) {
			continue
		}

		customInputData, readInputErr := readInputData(filepath.Join(queryParameters.InputDataPath, query.Metadata["id"].(string)+".json"))
		if readInputErr != nil {
			log.Err(errRQ).
				Msgf("failed to read input data, query=%s", path.Base(queryDir))
			continue
		}

		inputData, mergeError := MergeInputData(query.InputData, customInputData)
		if mergeError != nil {
			log.Err(mergeError).
				Msgf("failed to merge input data, query=%s", path.Base(queryDir))
			continue
		}
		query.InputData = inputData

		if len(queryParameters.IncludeQueries.ByIDs) > 0 {
			if checkQueryInclude(query.Metadata["id"], queryParameters.IncludeQueries.ByID
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8046** (2026-09-07): **bug(core): thread exhaustion when scanning large repositories**
  *Symptoms*: ### Expected Behavior  KICS should complete the scan without crashing, even on repositories with a large number of files  ### Actual Behavior  KICS crashes with a fatal error during the "Preparing Scan Assets" phase before any queries are executed:   ``` runtime: program exceeds 10000 thread limit fatal error: thread exhaustion ```  In [`pkg/analyzer/analyzer.go:377`](https://github.com/Checkmarx/kics/blob/master/pkg/analyzer/analyzer.go#L377), `Analyze` spawns one goroutine per discovered file with no upper bound: ```go for _, file := range files {     wg.Add(1)     // analyze the files concurrently     a := &analyzerInfo{            // ...     }     go a.worker(results, unwanted, locCount, fileInfo, &wg) } ```  For a repository with tens of thousands of files this immediately creates tens of thousands of goroutines. If individual workers block on I/O, the Go scheduler is forced to spin up additional OS threads to keep progress — eventually hitting the hard 10000 thread limit and crashing the process.  Relevant part of stacktrace: ``` runtime stack: runtime.throw(...)         /usr/lib/go/src/runtime/panic.go:1229 runtime.checkmcount()         /usr/lib/go/src/runtime/proc.go:977 runtime.mReserveID()         /usr/lib/go/src/runtime/proc.go:993 runtime.startm(...)         /usr/lib/go/src/runtime/proc.go:3088 runtime.handoffp(...)         /usr/lib/go/src/runtime/proc.go:3137 runtime.retake(...)         /usr/lib/go/src/runtime/proc.go:6715 runtime.sysmon()         /usr/lib/go/src

- **Issue #8008** (2026-04-02): **ci(deps): bump the all group across 1 directory with 21 updates**
  *Symptoms*: Bumps the all group with 21 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [actions/checkout](https://github.com/actions/checkout) | `4.2.2` | `6.0.2` | | [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request) | `7.0.8` | `8.1.0` | | [actions/setup-go](https://github.com/actions/setup-go) | `5` | `6` | | [actions/upload-artifact](https://github.com/actions/upload-artifact) | `4.6.2` | `7.0.0` | | [actions/download-artifact](https://github.com/actions/download-artifact) | `4.1.3` | `8.0.1` | | [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) | `3.11.1` | `4.0.0` | | [actions/cache](https://github.com/actions/cache) | `4.2.3` | `5.0.4` | | [docker/build-push-action](https://github.com/docker/build-push-action) | `6.18.0` | `7.0.0` | | [actions/setup-python](https://github.com/actions/setup-python) | `5` | `6` | | [al-cheb/configure-pagefile-action](https://github.com/al-cheb/configure-pagefile-action) | `1.4` | `1.5` | | [securego/gosec](https://github.com/securego/gosec) | `2.22.5` | `2.25.0` | | [styfle/cancel-workflow-action](https://github.com/styfle/cancel-workflow-action) | `0.12.1` | `0.13.1` | | [actions/setup-node](https://github.com/actions/setup-node) | `4` | `6` | | [checkmarx/kics-github-action](https://github.com/checkmarx/kics-github-action) | `63fca4ca72e56edbb5a599ee756e6af1fdb1e785` | `05aa5eb70eede1355220f4ca5238d96b397e30a6` | | [docker/setup-qemu-action](https://github.com
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #8001** (2026-04-02): **build(deps): bump google.golang.org/grpc from 1.77.0 to 1.79.3**
  *Symptoms*: Bumps [google.golang.org/grpc](https://github.com/grpc/grpc-go) from 1.77.0 to 1.79.3. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/grpc/grpc-go/releases">google.golang.org/grpc's releases</a>.</em></p> <blockquote> <h2>Release 1.79.3</h2> <h1>Security</h1> <ul> <li>server: fix an authorization bypass where malformed :path headers (missing the leading slash) could bypass path-based restricted &quot;deny&quot; rules in interceptors like <code>grpc/authz</code>. Any request with a non-canonical path is now immediately rejected with an <code>Unimplemented</code> error. (<a href="https://redirect.github.com/grpc/grpc-go/issues/8981">#8981</a>)</li> </ul> <h2>Release 1.79.2</h2> <h1>Bug Fixes</h1> <ul> <li>stats: Prevent redundant error logging in health/ORCA producers by skipping stats/tracing processing when no stats handler is configured. (<a href="https://redirect.github.com/grpc/grpc-go/pull/8874">grpc/grpc-go#8874</a>)</li> </ul> <h2>Release 1.79.1</h2> <h1>Bug Fixes</h1> <ul> <li>grpc: Remove the <code>-dev</code> suffix from the User-Agent header. (<a href="https://redirect.github.com/grpc/grpc-go/pull/8902">grpc/grpc-go#8902</a>)</li> </ul> <h2>Release 1.79.0</h2> <h1>API Changes</h1> <ul> <li>mem: Add experimental API <code>SetDefaultBufferPool</code> to change the default buffer pool. (<a href="https://redirect.github.com/grpc/grpc-go/issues/8806">#8806</a>) <ul> <li>Special Thanks: <a href="https://github.com/vanja-p"><code
  **Post-Mortem & Fix Analysis**:
  > Looks like google.golang.org/grpc is up-to-date now, so this is no longer needed.

- **Issue #7993** (2026-03-24): **ci(deps): bump the all group across 1 directory with 22 updates**
  *Symptoms*: Bumps the all group with 22 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [actions/checkout](https://github.com/actions/checkout) | `4.2.2` | `6.0.2` | | [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request) | `7.0.8` | `8.1.0` | | [actions/setup-go](https://github.com/actions/setup-go) | `5` | `6` | | [actions/upload-artifact](https://github.com/actions/upload-artifact) | `4.6.2` | `7.0.0` | | [actions/download-artifact](https://github.com/actions/download-artifact) | `4.1.3` | `8.0.0` | | [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) | `3.11.1` | `4.0.0` | | [actions/cache](https://github.com/actions/cache) | `4.2.3` | `5.0.3` | | [docker/build-push-action](https://github.com/docker/build-push-action) | `6.18.0` | `7.0.0` | | [actions/setup-python](https://github.com/actions/setup-python) | `5` | `6` | | [al-cheb/configure-pagefile-action](https://github.com/al-cheb/configure-pagefile-action) | `1.4` | `1.5` | | [securego/gosec](https://github.com/securego/gosec) | `2.22.5` | `2.24.7` | | [styfle/cancel-workflow-action](https://github.com/styfle/cancel-workflow-action) | `0.12.1` | `0.13.0` | | [actions/setup-node](https://github.com/actions/setup-node) | `4` | `6` | | [checkmarx/kics-github-action](https://github.com/checkmarx/kics-github-action) | `2.1.18` | `2.1.20` | | [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) | `3.6.0` | `4.0.0` | | [docker/login-act
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #7982** (2026-03-09): **ci(deps): bump the all group across 1 directory with 21 updates**
  *Symptoms*: Bumps the all group with 21 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [actions/checkout](https://github.com/actions/checkout) | `4.2.2` | `6.0.2` | | [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request) | `7.0.8` | `8.1.0` | | [actions/setup-go](https://github.com/actions/setup-go) | `5` | `6` | | [actions/upload-artifact](https://github.com/actions/upload-artifact) | `4.6.2` | `7.0.0` | | [actions/download-artifact](https://github.com/actions/download-artifact) | `4.1.3` | `8.0.0` | | [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) | `3.11.1` | `3.12.0` | | [actions/cache](https://github.com/actions/cache) | `4.2.3` | `5.0.3` | | [docker/build-push-action](https://github.com/docker/build-push-action) | `6.18.0` | `6.19.2` | | [actions/setup-python](https://github.com/actions/setup-python) | `5` | `6` | | [al-cheb/configure-pagefile-action](https://github.com/al-cheb/configure-pagefile-action) | `1.4` | `1.5` | | [securego/gosec](https://github.com/securego/gosec) | `2.22.5` | `2.24.7` | | [styfle/cancel-workflow-action](https://github.com/styfle/cancel-workflow-action) | `0.12.1` | `0.13.0` | | [actions/setup-node](https://github.com/actions/setup-node) | `4` | `6` | | [checkmarx/kics-github-action](https://github.com/checkmarx/kics-github-action) | `2.1.18` | `2.1.19` | | [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) | `3.6.0` | `3.7.0` | | [docker/login-a
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #7981** (2026-03-03): **ci(deps): bump the all group across 1 directory with 22 updates**
  *Symptoms*: Bumps the all group with 22 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [actions/checkout](https://github.com/actions/checkout) | `4.2.2` | `6.0.2` | | [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request) | `7.0.8` | `8.1.0` | | [actions/setup-go](https://github.com/actions/setup-go) | `5` | `6` | | [actions/upload-artifact](https://github.com/actions/upload-artifact) | `4.6.2` | `7.0.0` | | [actions/download-artifact](https://github.com/actions/download-artifact) | `4.1.3` | `8.0.0` | | [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) | `3.11.1` | `3.12.0` | | [actions/cache](https://github.com/actions/cache) | `4.2.3` | `5.0.3` | | [docker/build-push-action](https://github.com/docker/build-push-action) | `6.18.0` | `6.19.2` | | [actions/setup-python](https://github.com/actions/setup-python) | `5` | `6` | | [al-cheb/configure-pagefile-action](https://github.com/al-cheb/configure-pagefile-action) | `1.4` | `1.5` | | [securego/gosec](https://github.com/securego/gosec) | `2.22.5` | `2.24.7` | | [styfle/cancel-workflow-action](https://github.com/styfle/cancel-workflow-action) | `0.12.1` | `0.13.0` | | [actions/setup-node](https://github.com/actions/setup-node) | `4` | `6` | | [checkmarx/kics-github-action](https://github.com/checkmarx/kics-github-action) | `2.1.18` | `2.1.19` | | [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) | `3.6.0` | `3.7.0` | | [docker/login-a
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #7971** (2026-03-03): **ci(deps): bump the all group across 1 directory with 21 updates**
  *Symptoms*: Bumps the all group with 21 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [actions/checkout](https://github.com/actions/checkout) | `4.2.2` | `6.0.2` | | [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request) | `7.0.8` | `8.1.0` | | [actions/setup-go](https://github.com/actions/setup-go) | `5` | `6` | | [actions/upload-artifact](https://github.com/actions/upload-artifact) | `4.6.2` | `6.0.0` | | [actions/download-artifact](https://github.com/actions/download-artifact) | `4.1.3` | `7.0.0` | | [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) | `3.11.1` | `3.12.0` | | [actions/cache](https://github.com/actions/cache) | `4.2.3` | `5.0.3` | | [docker/build-push-action](https://github.com/docker/build-push-action) | `6.18.0` | `6.19.2` | | [actions/setup-python](https://github.com/actions/setup-python) | `5` | `6` | | [al-cheb/configure-pagefile-action](https://github.com/al-cheb/configure-pagefile-action) | `1.4` | `1.5` | | [securego/gosec](https://github.com/securego/gosec) | `2.22.5` | `2.23.0` | | [styfle/cancel-workflow-action](https://github.com/styfle/cancel-workflow-action) | `0.12.1` | `0.13.0` | | [actions/setup-node](https://github.com/actions/setup-node) | `4` | `6` | | [checkmarx/kics-github-action](https://github.com/checkmarx/kics-github-action) | `2.1.18` | `2.1.19` | | [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) | `3.6.0` | `3.7.0` | | [docker/login-a
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #7963** (2026-02-25): **ci(deps): bump the all group across 1 directory with 22 updates**
  *Symptoms*: Bumps the all group with 22 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [actions/checkout](https://github.com/actions/checkout) | `4.2.2` | `6.0.2` | | [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request) | `7.0.8` | `8.1.0` | | [actions/setup-go](https://github.com/actions/setup-go) | `5` | `6` | | [actions/upload-artifact](https://github.com/actions/upload-artifact) | `4.6.2` | `6.0.0` | | [actions/download-artifact](https://github.com/actions/download-artifact) | `4.1.3` | `7.0.0` | | [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) | `3.11.1` | `3.12.0` | | [actions/cache](https://github.com/actions/cache) | `4.2.3` | `5.0.3` | | [docker/build-push-action](https://github.com/docker/build-push-action) | `6.18.0` | `6.19.1` | | [actions/setup-python](https://github.com/actions/setup-python) | `5` | `6` | | [al-cheb/configure-pagefile-action](https://github.com/al-cheb/configure-pagefile-action) | `1.4` | `1.5` | | [securego/gosec](https://github.com/securego/gosec) | `2.22.5` | `2.23.0` | | [styfle/cancel-workflow-action](https://github.com/styfle/cancel-workflow-action) | `0.12.1` | `0.13.0` | | [actions/setup-node](https://github.com/actions/setup-node) | `4` | `6` | | [checkmarx/kics-github-action](https://github.com/checkmarx/kics-github-action) | `2.1.18` | `2.1.19` | | [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) | `3.6.0` | `3.7.0` | | [docker/login-a
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

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

### Incident Patch 1: `8a0f0bba` (2026-10-01)
**Commit Message**: fix(query): improve "last user is root" dockerfile query coverage (#8123)

* Changed identification of docker files to be case insensitive on files named 'dockerfile'

* removed legacy redundant function 'isDockerfile' from analyzer

* Improved dockerfile identification to account for relevant folder names and all files with prefix 'dockerfile.' as well as all files with the '.dockerfile' extension type in a case insensitive matter (improvement on first commit)

* Fixed 'dockerfile' keyword not being recognized as a valid file extension, added support for all ubi8/debian files in case of valid dockerfile structure, added support for lower case dockerfile commands - most queries will have issues with this but relevant text files are properly detected as a 'dockerfile' as intended

* Minor optimization

* Initial test files/cases plus minor changes to supported dockerfile formats for consistency

* Added new helper function 'isDockerfileExtension' to get_extension utility to lower cyclomatic complexity

* reverted accidental query change, fixed linting errors, fixed test errors, fixed 'gitignore' files exclusion, docker parser will handle said case like before but with explicit 'giti

**File**: `assets/queries/dockerfile/last_user_is_root/query.rego` (modified, +11/-1)
```diff
@@ -7,7 +7,7 @@ CxPolicy[result] {
 	dockerLib.check_multi_stage(name, input.document[i].command)
 
 	userCmd := [x | resource[j].Cmd == "user"; x := resource[j]]
-	userCmd[minus(count(userCmd), 1)].Value[0] == ["root","0","root:root","0:0"][_]
+	is_root_user(userCmd[minus(count(userCmd), 1)].Value[0])
 
 	from_command := dockerLib.get_original_from_command(resource)
 	result := {
@@ -18,3 +18,13 @@ CxPolicy[result] {
 		"keyActualValue": "Last User is root",
 	}
 }
+
+# Root privileges come from UID 0 alone - USER <user>:<group>
+is_root_user(value) {
+	split(value, ":")[0] == "root"
+}
+
+# Docker parses numeric users as integers, so "00", "+0" and "-0" also resolve to UID 0
+is_root_user(value) {
+	regex.match(`^[+-]?0+$`, split(value, ":")[0])
+}
```

**File**: `assets/queries/dockerfile/last_user_is_root/test/negative4.dockerfile` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+FROM alpine:2.6
+USER root
+RUN npm install
+USER 1000:0
```

**File**: `assets/queries/dockerfile/last_user_is_root/test/negative5.dockerfile` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+FROM alpine:2.6
+USER root
+RUN npm install
+USER guest:root
```

**File**: `assets/queries/dockerfile/last_user_is_root/test/negative6.dockerfile` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+FROM alpine:2.6
+USER root
+RUN npm install
+USER 01000
```

**File**: `assets/queries/dockerfile/last_user_is_root/test/positive10.dockerfile` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+FROM alpine:2.6
+USER 000
+RUN npm install
```

**File**: `assets/queries/dockerfile/last_user_is_root/test/positive11.dockerfile` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+FROM alpine:2.6
+USER 00:1000
+RUN npm install
```

**File**: `assets/queries/dockerfile/last_user_is_root/test/positive12.dockerfile` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+FROM alpine:2.6
+USER +0:wheel
+RUN npm install
```

**File**: `assets/queries/dockerfile/last_user_is_root/test/positive13.dockerfile` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+FROM alpine:2.6
+USER -0
+RUN npm install
```

---

### Incident Patch 2: `5afaeffc` (2026-10-01)
**Commit Message**: fix: fix detector data race in dockerfile line detection (#8121)

Co-authored-by: Andre Pereira <[REDACTED_EMAIL]>

**File**: `pkg/detector/detector.go` (modified, +0/-7)
```diff
@@ -13,25 +13,18 @@ type kindDetectLine interface {
 type DetectLine struct {
 	detectors       map[model.FileKind]kindDetectLine
 	outputLines     int
-	logWithFields   *zerolog.Logger
 	defaultDetector kindDetectLine
 }
 
 // NewDetectLine creates a new DetectLine's reference
 func NewDetectLine(outputLines int) *DetectLine {
 	return &DetectLine{
 		detectors:       make(map[model.FileKind]kindDetectLine),
-		logWithFields:   &zerolog.Logger{},
 		outputLines:     outputLines,
 		defaultDetector: defaultDetectLine{},
 	}
 }
 
-// SetupLogs will change the logger feild to be used in kindDetectLine DetectLine method
-func (d *DetectLine) SetupLogs(logger *zerolog.Logger) {
-	d.logWithFields = logger
-}
-
 // Add adds a new kindDetectLine to the caller and returns it
 func (d *DetectLine) Add(detector kindDetectLine, kind model.FileKind) *DetectLine {
 	d.detectors[kind] = detector
```

**File**: `pkg/detector/detector_test.go` (modified, +0/-33)
```diff
@@ -7,7 +7,6 @@ import (
 	"github.com/Checkmarx/kics/v2/pkg/model"
 	"github.com/Checkmarx/kics/v2/pkg/utils"
 	"github.com/rs/zerolog"
-	"github.com/rs/zerolog/log"
 	"github.com/stretchr/testify/require"
 )
 
@@ -63,38 +62,6 @@ func TestDetector_Add(t *testing.T) {
 	}
 }
 
-func TestDetector_SetupLogs(t *testing.T) {
-	det := initDetector()
-	type args struct {
-		log zerolog.Logger
-	}
-	tests := []struct {
-		name string
-		args args
-	}{
-		{
-			name: "test_setup_logs",
-			args: args{
-				log: log.With().
-					Str("scanID", "Test").
-					Str("fileName", "Test_file_name").
-					Str("queryName", "Test_Query_name").
-					Logger(),
-			},
-		},
-	}
-
-	for _, tt := range tests {
-		t.Run(tt.name, func(t *testing.T) {
-			det.SetupLogs(&tt.args.log)
-			got := det.logWithFields
-			if !reflect.DeepEqual(*got, tt.args.log) {
-				t.Errorf("SetupLogs() = %v, want = %v", got, tt.args.log)
-			}
-		})
-	}
-}
-
 func TestDetector_DetectLine(t *testing.T) {
 	var mock mockkindDetectLine
 	var defaultmock mockDefaultDetector
```

**File**: `pkg/detector/docker/docker_detect.go` (modified, +8/-1)
```diff
@@ -51,10 +51,17 @@ func (d DetectKindLine) DetectLine(file *model.FileMetadata, searchKey string,
 	unchangedText := make([]string, len(*file.LinesOriginalData))
 	copy(unchangedText, *file.LinesOriginalData)
 
+	// workingText is a private copy for prepareDockerFileLines to mutate. It must not alias
+	// file.LinesOriginalDatas since that slice is shared by every query scanning this file, and
+	// concurrent queries call DetectLine for the same file in parallel, so mutating it in
+	// place races across goroutines.
+	workingText := make([]string, len(*file.LinesOriginalData))
+	copy(workingText, *file.LinesOriginalData)
+
 	for _, key := range strings.Split(sKey, ".") {
 		substr1, substr2 := detector.GenerateSubstrings(key, extractedString)
 
-		det, _ = det.DetectCurrentLine(substr1, substr2, 0, prepareDockerFileLines(*file.LinesOriginalData))
+		det, _ = det.DetectCurrentLine(substr1, substr2, 0, prepareDockerFileLines(workingText))
 
 		if det.IsBreak {
 			break
```

**File**: `pkg/detector/docker/docker_detect_test.go` (modified, +35/-0)
```diff
@@ -2,6 +2,7 @@ package docker
 
 import (
 	"fmt"
+	"sync"
 	"testing"
 
 	"github.com/Checkmarx/kics/v2/pkg/model"
@@ -193,3 +194,37 @@ func TestDetectDockerLine(t *testing.T) { //nolint
 		})
 	}
 }
+
+// TestDetectDockerLineConcurrentAccess reproduces the data race triggered when multiple
+// queries run in parallel (as the Inspector's worker pool does) and call DetectLine for the
+// same file at the same time. DetectLine's prepareDockerFileLines/multiLineSpliter mutate the
+// slice behind file.LinesOriginalData in place and that pointer is shared across every query
+// that scans the same file, so concurrent calls race on it and can panic with
+// "runtime error: slice bounds out of range [:-1]".
+func TestDetectDockerLineConcurrentAccess(t *testing.T) {
+	file := &model.FileMetadata{
+		ScanID:            "TestConcurrent",
+		ID:                "TestConcurrent",
+		Kind:              model.KindDOCKER,
+		OriginalData:      OriginalData1,
+		LinesOriginalData: utils.SplitLines(OriginalData1),
+	}
+
+	searchKeys := []string{
+		"FROM={{alpine:3.9}}.RUN={{apk update && apk upgrade && apk add kubectl=1.20.0-r0 	&& rm -rf /var/cache/apk/*}}",
+		"FROM={{alpine:3.7}}.ENTRYPOINT[kubectl]",
+		"FROM={{alpine:3.9}}.ENTRYPOINT[kubectl]",
+	}
+
+	var wg sync.WaitGroup
+	for g := 0; g < 50; g++ {
+		searchKey := searchKeys[g%len(searchKeys)]
+		wg.Add(1)
+		go func() {
+			defer wg.Done()
+			detector := DetectKindLine{}
+			detector.DetectLine(file, searchKey, 3, &zerolog.Logger{})
+		}()
+	}
+	wg.Wait()
+}
```

**File**: `pkg/engine/inspector_test.go` (modified, +2/-1)
```diff
@@ -733,7 +733,8 @@ func TestInspector_DecodeQueryResults(t *testing.T) {
 		t.Run(tt.name, func(t *testing.T) {
 			//create a context with 0 second to timeout
 			timeoutDuration, _ := time.ParseDuration(tt.args.timeDuration)
-			myCtxTimeOut, _ := context.WithTimeout(contextToUSe, timeoutDuration)
+			myCtxTimeOut, cancel := context.WithTimeout(contextToUSe, timeoutDuration)
+			defer cancel()
 			result, err := c.DecodeQueryResults(&tt.args.queryContext, myCtxTimeOut, tt.args.regoResult)
 			assert.Nil(t, err, "Error not as expected")
 			assert.Equal(t, 0, len(result), "Array size is not as expected")
```

**File**: `pkg/engine/vulnerability_builder.go` (modified, +0/-2)
```diff
@@ -98,8 +98,6 @@ var DefaultVulnerabilityBuilder = func(ctx *QueryContext,
 		Str("queryName", ctx.Query.Metadata.Query).
 		Logger()
 
-	detector.SetupLogs(&logWithFields)
-
 	linesVulne := model.VulnerabilityLines{
 		Line:      -1,
 		VulnLines: &[]model.CodeLine{},
```

---

### Incident Patch 3: `31005310` (2026-09-30)
**Commit Message**: fix(parse): rename resource name to fix "failed to parse file content" error (#7962)

* fix: rename resource name to fix "failed to parse file content" error

* update: rename

---------

Co-authored-by: Andre Pereira <[REDACTED_EMAIL]>

**File**: `assets/queries/terraform/azure/sql_database_without_data_encryption/test/negative.tf` (modified, +2/-2)
```diff
@@ -12,9 +12,9 @@ resource "azurerm_mssql_database" "example" {
   # missing "transparent_data_encryption_enabled" - defaults to true
 }
 
-resource "azurerm_mssql_database" "example" {
+resource "azurerm_mssql_database" "example2" {
   name           = "example-db"
-  server_id      = azurerm_mssql_server.example.id
+  server_id      = azurerm_mssql_server.example2.id
   collation      = "SQL_Latin1_General_CP1_CI_AS"
   license_type   = "LicenseIncluded"
   max_size_gb    = 4
```

---

### Incident Patch 4: `b63a0d14` (2026-09-30)
**Commit Message**: update: otel package version to fix vulnerabilities (#8137)

**File**: `go.mod` (modified, +10/-9)
```diff
@@ -138,11 +138,11 @@ require (
 	go.opentelemetry.io/contrib/detectors/gcp v1.44.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.69.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0 // indirect
-	go.opentelemetry.io/otel v1.45.0 // indirect
-	go.opentelemetry.io/otel/metric v1.45.0 // indirect
-	go.opentelemetry.io/otel/sdk v1.45.0 // indirect
-	go.opentelemetry.io/otel/sdk/metric v1.45.0 // indirect
-	go.opentelemetry.io/otel/trace v1.45.0 // indirect
+	go.opentelemetry.io/otel v1.46.0 // indirect
+	go.opentelemetry.io/otel/metric v1.46.0 // indirect
+	go.opentelemetry.io/otel/sdk v1.46.0 // indirect
+	go.opentelemetry.io/otel/sdk/metric v1.46.0 // indirect
+	go.opentelemetry.io/otel/trace v1.46.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
 	golang.org/x/mod v0.40.0 // indirect
@@ -268,8 +268,9 @@ require (
 )
 
 replace (
-	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc => go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.21.0
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace => go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc => go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp => go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0
+	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc => go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.22.0
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace => go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.46.0
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc => go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.46.0
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp => go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.46.0
+	go.opentelemetry.io/otel/sdk/log => go.opentelemetry.io/otel/sdk/log v0.22.0
 )
```

**File**: `go.sum` (modified, +22/-22)
```diff
@@ -582,22 +582,22 @@ go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.6
 go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.69.0/go.mod h1:D7J12YRapIekYyPWgGPlA/23pRmpSEZC5xJC/TTLI9U=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0 h1:8tvICD4vSTOOsNrsI4Ljf6C+6UKvpTEH5XY3JMoyPoo=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0/go.mod h1:z9+yiacE0IHRqM4qFfkbt/JYlmYXgss8GY/jXoNuPJI=
-go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
-go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
-go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.21.0 h1:WseeVYf5dJZTsyPiyW5L14k5qsSibqXAMTSiFEDiWr0=
-go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.21.0/go.mod h1:SiLZnQS6Qk2eCpvr2CH/XMAOa64TWGXxEZJZCpD2Lmc=
+go.opentelemetry.io/otel v1.46.0 h1:FHt5/CDyVxi/8IM1CH7VE/rRgq3kLHa2mSTVMO8AWyc=
+go.opentelemetry.io/otel v1.46.0/go.mod h1:Gj3SEScelsNC45tp4nSxRYlS+f5iez7W8XPMCt905kE=
+go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.22.0 h1:Bu39F5tzJct+f2IZbB8989fwyTps3c8e7EsUQsz+vs8=
+go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.22.0/go.mod h1:dJUwod88EsFgYCqrDHaSPzhiY9pBUpt0d85/qSfua7k=
 go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp v0.19.0 h1:HIBTQ3VO5aupLKjC90JgMqpezVXwFuq6Ryjn0/izoag=
 go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp v0.19.0/go.mod h1:ji9vId85hMxqfvICA0Jt8JqEdrXaAkcpkI9HPXya0ro=
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.44.0 h1:SUplec5dp06reu1zaXmOXdvqH398taqrDXqUl99jxSc=
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.44.0/go.mod h1:ho2g4N+ane+swq5I/VBkKWnRDY4kUINH3FuqyZqX/Ug=
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0 h1:RuynHbfU8JUEw7DyONgkVYg2SVtsoF28y0LGIr69jgA=
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0/go.mod h1:qZF+/lBs71APw8mlnEZcqZHMzqrYrsFiJOv83lX1OGo=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0 h1:fG5MCxGz8+2VtrN/WgqSpJFctVz24gpxj8CxkKmc8Ww=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0/go.mod h1:BmAYTn+3ysbRe+IU2msxmf5Rx3g6DHvex+tWI3LdhYI=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0 h1:QBajQ2SrwQijzHyZbQlPsuIzpl/ll8DY6wPWsajeGcI=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0/go.mod h1:08ZQLjrPLQ6R4kAXvuOvODEer5Yh4CoFvll5qB2BCI8=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.46.0 h1:OFnwLJr+pF3iHrlGSzbxyuo6/6HyBlnlN1CWEJmBVcw=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.46.0/go.mod h1:716wFneO0ov19A2beH5hjfh9AK5z/VWNAtDijp1Y0/g=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.46.0 h1:w53CDeOA/Kurp7yRsegSr6pbbr759dOvJ+yNmWM6Hxs=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.46.0/go.mod h1:BOmGMCbAtvcJiSJ+hLuhgPLdDbimnraSl8irz3iY8sY=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.46.0 h1:KrC1YrQeSt46ITMWAbgQx1M1eV1/1TKzttrBzymPmss=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.46.0/go.mod h1:zDSEzoEqsOrgBeGvH66KRgxh90VonFyJqBHA0Pk3+rM=
 go.opentelemetry.io/otel/exporters/prometheus v0.66.0 h1:vkrK8PAznv2NKt2r+kdu252ccGzkEqLc2aSXbQIALYQ=
 go.opentelemetry.io/otel/exporters/prometheus v0.66.0/go.mod h1:V/UB6D3vMF/UBOL5igAsAYnk1nG/bzYYTzvsB16cy7o=
 go.opentelemetry.io/otel/exporters/stdout/stdoutlog v0.19.0 h1:GJkybS+crDMdExT/BUNCEgfrmfboztcS6PhvSo88HKM=
@@ -608,18 +608,18 @@ go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.43.0 h1:mS47AX77OtFfKG4
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.43.0/go.mod h1:PJnsC41lAGncJlPUniSwM81gc80GkgWJWr3cu2nKEtU=
 go.opentelemetry.io/otel/log v0.19.0 h1:KUZs/GOsw79TBBMfDWsXS+KZ4g2Ckzksd1ymzsIEbo4=
 go.opentelemetry.io/otel/log v0.19.0/go.mod h1:5DQYeGmxVIr4n0/BcJvF4upsraHjg6vudJJpnkL6Ipk=
-go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
-go.opentelemetry.io/otel/metric v1.45.0/go.mod h1:HAPbm1nd3p1PmFH7v2dR+6BjXxw+Lq4a2+pndMAm08s=
-go.opentelemetry.io/otel/metric/x v0.67.0 h1:PcicCNZFkZ4bXfSooXdo3WN7RBOVOtjVdo1wD358Uns=
-go.opentelemetry.io/otel/metric/x v0.67.0/go.mod h1:FBjCWZe6wgcqxcMtjdGiClDKXb2YxxXii0CXftE4QtI=
-go.opentelemetry.io/otel/sdk v1.45.0 h1:4VVSMgQ83dUgW2aoX5f6JgLvHwIvzcuLnF9lUdCSpCw=
-go.opentelemetry.io/otel/sdk v1.45.0/go.mod h1:Sr40LgXV7DsKMMJMKOhUWOgMWTfAaqvm2kF0g7ilwuA=
-go.opentelemetry.io/otel/sdk/log v0.19.0 h1:scYVLqT22D2gqXItnWiocLUKGH9yvkkeql5dBDiXyko=
-go.opentelemetry.io/otel/sdk/log v0.19.0/go.mod h1:vFBowwXGLlW9AvpuF7bMgnNI95LiW10szrOdvzBHlAg=
-go.opentelemetry.io/otel/sdk/metric v1.4
```

---

### Incident Patch 5: `5cce3fd8` (2026-09-30)
**Commit Message**: fix(query): various fixes for passwords and secrets queries (#8117)

* Added check to ensure files of 'Kind' proto are ignored by 'Inspect', stoping passwords and secrets flags on said files

* Changed approach, proto files should flag if they have secrets within commented lines, new allow rules prevent proto files fields from flagging

* Fix expected results

* Part 1 fix git diff

* Part 2 fix git diff

* Fix regex rules (duplicated rule was removed but comma was missed)

* Two more allow rules plus updated negative sample

* Fallback, generic secret reqires 10 digits (impossible in proto) and generic api key enforces trimmed line starting with 'access'

* Removed unnecessar allow rule

* Improved negative28 tests used for TF resource access allow rule in 'Generic Token', improved 2 TF reousrce access rules, added missing positive test for 'Encryption Key' query, added samples (similar to neg28) in negative61 for TF resource access allow rule in 'Encryption Key' query (was also missing test)

* Minor test change

* Expected results fix

* Changed uuid for 'CloudFormation Secret Template (is duplicated)

* Cataloged every single test file, tested all queries and all allow rules in

**File**: `assets/queries/common/passwords_and_secrets/regex_rules.json` (modified, +74/-86)
```diff
@@ -3,31 +3,27 @@
     {
       "id": "487f4be7-3fd9-4506-a07a-eae252180c08",
       "name": "Generic Password",
-      "regex": "(?i)['\"]?password['\"]?\\s*[:=]\\s*['\"]?([A-Za-z0-9/~^_!@&%()=?*+-. ]{4,})['\"]?",
+      "regex": "(?i)['\"]?password['\"]?\\s*[:=]\\s*['\"]?[A-Za-z0-9/~^_!@&%()=?*+\\-,. ]{4,}['\"]?",
       "allowRules": [
         {
           "description": "Avoiding TF resource access",
-          "regex": "(?i)['\"]?password['\"]?\\s*[:=]\\s*(([a-zA-Z_]+(\\[([a-zA-Z_]+\\.[a-zA-Z_]+.*|\\d+)\\])?\\.[a-zA-Z_]+(\\[([a-zA-Z_]+\\.[a-zA-Z_]+.*|\\d+)\\])?)\\s*([\\[\\.\\)\\]\\}\\$]|(:\\s*null))|null)"
+          "regex": "(?i)['\"]?password['\"]?\\s*[:=]\\s*([a-zA-Z_]+(\\[([a-zA-Z_]+\\.[a-zA-Z_]+.*|\\d+)\\])?\\.[a-zA-Z_]+(\\[([a-zA-Z_]+\\.[a-zA-Z_]+.*|\\d+)\\])?\\s*([\\[\\.\\)\\]\\}\\$]|:\\s*null)|null)"
         },
         {
           "description": "Avoiding description field",
           "regex": "(?i)['\"]?description['\"]?\\s*=\\s*['\"].*['\"]"
         },
         {
           "description": "Avoiding Terraform 'optional' statement",
-          "regex": "(?i)['\"]?password['\"]?\\s*=\\s*optional\\((string|number|sensitive\\(string\\)|map\\(string\\)|set\\(string\\)|any)\\)$"
+          "regex": "(?i)['\"]?password['\"]?\\s*=\\s*optional\\((string|number|sensitive\\(string\\)|map\\(string\\)|set\\(string\\)|any)\\)"
         },
         {
           "description": "Avoiding Terraform 'try' statement",
-          "regex": "(?i)['\"]?password['\"]?\\s*=\\s*try\\([^\"']+,[^\"']+\\)$"
-        },
-        {
-          "description": "Avoiding CF AllowUsersToChangePassword",
-          "regex": "['\"]?AllowUsersToChangePassword['\"]?\\s*[:=]\\s*['\"]?([A-Za-z0-9/~^_!@&%()=?*+-.]{4,})['\"]?"
+          "regex": "(?i)['\"]?password['\"]?\\s*=\\s*try\\([^\"']+,[^\"']+\\)"
         },
         {
           "description": "Avoiding Ansible playbook update_password",
-          "regex": "['\"]?update_password['\"]?\\s*[:=]\\s*['\"]?([A-Za-z0-9/~^_!@&%()=?*+-.]{4,})['\"]?"
+          "regex": "['\"]?update_password['\"]?\\s*[:=]\\s*['\"]?[A-Za-z0-9/~^_!@&%()=?*+\\-,.]{4,}['\"]?"
         },
         {
           "description": "Allow placeholders",
@@ -39,7 +35,7 @@
         },
         {
           "description": "Allow password retrieved from ARM parameters",
-          "regex": "(?i)['\"]?password['\"]?\\s*[:=]\\s*['\"]?\\s*,\\s*parameters\\(['\"]([a-zA-Z][a-zA-Z0-9_-]*)['\"]['\"]?\\)"
+          "regex": "(?i)['\"]?password['\"]?\\s*[:=]\\s*['\"]?\\s*,\\s*parameters\\(['\"][a-zA-Z][a-zA-Z0-9_\\-]*['\"]['\"]?\\)"
         },
         {
           "description": "Avoiding Proto File fields",
@@ -51,49 +47,49 @@
     {
       "id": "3e2d3b2f-c22a-4df1-9cc6-a7a0aebb0c99",
       "name": "Generic Secret",
-      "regex": "(?i)['\"]?secret[_]?(key|value)?['\"]?\\s*(:|=)\\s*['\"]?([A-Za-z0-9/~^_!@#&%(){};=?*+-<>,:;[\\]%$]{10,})['\"]?",
+      "regex": "(?i)['\"]?secret_?(key|value)?['\"]?\\s*[:=]\\s*['\"]?([A-Za-z0-9/~^_!@#&%(){};=?*+\\-.<>,:;\\[\\]%$]{10,})['\"]?",
       "entropies": [
         {
-          "group": 3,
+          "group": 2,
           "min": 2.8,
           "max": 8
         }
       ],
       "allowRules": [
         {
           "description": "Avoiding Square OAuth Secret",
-          "regex": "(?i)['\"]?secret[_]?(key)?['\"]?\\s*(:|=)\\s*['\"]?(sq0csp-[0-9A-Za-z\\-_]{43})['\"]?"
+          "regex": "(?i)['\"]?secret_?(key)?['\"]?\\s*[:=]\\s*['\"]?sq0csp-[0-9A-Za-z\\-_]{43}['\"]?"
         },
         {
           "description": "Avoiding TF resource access",
-          "regex": "(?i)['\"]?secret[_]?(key)?['\"]?\\s*[:=]\\s*(([a-zA-Z_]+(\\[([a-zA-Z_]+\\.[a-zA-Z_]+.*|\\d+)\\])?\\.[a-zA-Z_]+(\\[([a-zA-Z_]+\\.[a-zA-Z_]+.*|\\d+)\\])?)\\s*([\\.\\)\\]\\$]|(:\\s*null))|null)"
+          "regex": "(?i)['\"]?secret_?(key)?['\"]?\\s*[:=]\\s*([a-zA-Z_]+(\\[([a-zA-Z_]+\\.[a-zA-Z_]+.*|\\d+)\\])?\\.[a-zA-Z_]+(\\[([a-zA-Z_]+\\.[a-zA-Z_]+.*|\\d+)\\])?\\s*([\\[\\.\\)\\]\\}\\$]|:\\s*null)|null)"
         },
         {
           "description": "Avoiding Secrets Manager arn",
-          "regex": ":secretsmanager:[a-z0-9-*?]+:[0-9*?]+:(?i)['\"]?secret[_]?(key)?['\"]?\\s*(:|=)\\s*['\"]?([A-Za-z0-9/~^_!@&%()=?*+-]+)['\"]?"
+          "regex": ":secretsmanager:[a-z0-9-*?]+:[0-9*?]+:(?i)['\"]?secret_?(key)?['\"]?\\s*[:=]\\s*['\"]?[A-Za-z0-9/~^_!@&%()=?*+\\-]+['\"]?"
         },
         {
           "description": "Avoiding CloudFormation Parameters Descriptions",
-          "regex": "['\"]?Description['\"]?\\s*[:=]\\s*['\"]?([A-Za-z0-9/~^_!@&%()=?*${}+-.'\"]+)['\"]?"
+          "regex": "['\"]?Description['\"]?\\s*[:=]\\s*['\"]?.*['\"]?"
         },
         {
-          "description": "Avoiding Secrets from Azure Key Vault",
-          "regex": "(?i)['\"]?secret[_]?(key)?['\"]?\\s*(:|=)\\s*['\"]?[${]+[A-Za-z0-9/~^_!@&%()=?*+-]+}?"
+          "description": "Avoiding Secrets from Variable Interpolation",
+          "regex": "(?i)['\"]?secret_?(key)?['\"]?\\s*[:=]\\s*['\"]?[${]+[A-Za-z0-9/~^_!@&%()=?*+\\-]
```

**File**: `assets/queries/common/passwords_and_secrets/test/negative1.yaml` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-#k8s test
+# Generic Negative Test - no secrets (k8s)
 apiVersion: v1
 kind: Pod
 metadata:
```

**File**: `assets/queries/common/passwords_and_secrets/test/negative10.tf` (modified, +2/-1)
```diff
@@ -1,3 +1,4 @@
+# Global allow rule - a88baa34-e2ad-44ea-ad6f-8cac87bc7c71 - "Avoiding TF variables" allow-rule-test
 resource "aws_db_instance" "default" {
   name                   = var.dbname
   engine                 = "mysql"
@@ -10,7 +11,7 @@ resource "aws_db_instance" "default" {
   instance_class          = "db.t3.micro"
   allocated_storage       = "20"
   username                = "admin"
-  password                = var.password
+  password                = var.password  # negative1
   apply_immediately       = true
   multi_az                = false
   backup_retention_period = 0
```

**File**: `assets/queries/common/passwords_and_secrets/test/negative11.tf` (modified, +2/-1)
```diff
@@ -1,9 +1,10 @@
+# Global allow rule - a88baa34-e2ad-44ea-ad6f-8cac87bc7c71 - "Avoiding TF variables" allow-rule-test
 resource "auth0_connection" "google_oauth2" {
   name = "Google-OAuth2-Connection"
   strategy = "google-oauth2"
   options {
     client_id     = var.google_client_id
-    client_secret = var.google_client_secret
+    client_secret = var.google_client_secret  # negative1
     allowed_audiences = [ "example.com", "api.example.com" ]
     scopes = [ "email", "profile", "gmail", "youtube" ]
     set_user_root_attributes = "on_each_login"
```

**File**: `assets/queries/common/passwords_and_secrets/test/negative12.tf` (modified, +2/-1)
```diff
@@ -1,3 +1,4 @@
+# Global allow rule - a88baa34-e2ad-44ea-ad6f-8cac87bc7c71 - "Avoiding TF variables"  allow-rule-test
 provider "slack" {
-  token = var.slack_token
+  token = var.slack_token # negative1
 }
```

**File**: `assets/queries/common/passwords_and_secrets/test/negative13.tf` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+# "Generic API Key" - 74736dd1-dd11-4139-beb6-41cd43a50317  negative-test ('.' char is illegal in key definition, incorrect key length (17 is not in {32,45}))
 provider "stripe" {
   api_key = var.strip_api_key
 }
```

**File**: `assets/queries/common/passwords_and_secrets/test/negative14.tf` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+# Generic Negative Test - several keywords used in safe contexts ("password","api_key","secret_key")
 resource "aws_ecs_task_definition" "webapp" {
   family        = "tomato-webapp"
   task_role_arn = data.aws_iam_role.ecs_task_role.arn
```

**File**: `assets/queries/common/passwords_and_secrets/test/negative15.tf` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+# "Generic API Key" - 74736dd1-dd11-4139-beb6-41cd43a50317  negative-test ('.' char is illegal in key definition, incorrect key length (18 is not in {32,45}))
 provider "heroku" {
   email   = "ops@company.com"
   api_key = var.heroku_api_key
```

---

### Incident Patch 6: `5dc9a0f4` (2026-09-29)
**Commit Message**: fix(queries): Rename query "Not Using JSON In CMD And ENTRYPOINT Arguments" to "Not Using proper exec form In CMD And ENTRYPOINT Arguments" (#8131)

* fix(queries): Rename query "Not Using JSON In CMD And ENTRYPOINT Arguments" to "Not Using proper exec form In CMD And ENTRYPOINT Arguments"

* fix: added renamed query as a new query

* refactor: metadata schema validation for dockerfile queries that do not require cloud provider

* remove: changes in all docs files and update descriptionID with 8 first chars from query ID

---------

Co-authored-by: Artur Ribeiro <[REDACTED_EMAIL]>

**File**: `.github/scripts/queries-validator/metadata-schema.json` (modified, +14/-1)
```diff
@@ -40,12 +40,25 @@
         "category",
         "descriptionText",
         "descriptionUrl",
-        "cloudProvider",
         "platform",
         "descriptionID",
         "cwe",
         "riskScore"
     ],
+    "if": {
+        "not": {
+            "properties": {
+                "platform": {
+                    "const": "Dockerfile"
+                }
+            }
+        }
+    },
+    "then": {
+        "required": [
+            "cloudProvider"
+        ]
+    },
     "properties": {
         "id": {
             "$ref": "#/definitions/query_id_pattern"
```

**File**: `assets/queries/dockerfile/not_using_json_in_cmd_and_entrypoint_arguments/metadata.json` (removed, +0/-12)
```diff
@@ -1,12 +0,0 @@
-{
-  "id": "b86987e1-6397-4619-81d5-8807f2387c79",
-  "queryName": "Not Using JSON In CMD And ENTRYPOINT Arguments",
-  "severity": "MEDIUM",
-  "category": "Build Process",
-  "descriptionText": "Ensure that we are using JSON in the CMD and ENTRYPOINT Arguments",
-  "descriptionUrl": "https://docs.docker.com/engine/reference/builder/#entrypoint",
-  "platform": "Dockerfile",
-  "descriptionID": "070b84da",
-  "cwe": "573",
-  "riskScore": "5.2"
-}
\ No newline at end of file
```

**File**: `assets/queries/dockerfile/not_using_proper_exec_form_in_cmd_and_entrypoint_arguments/metadata.json` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+{
+  "id": "34945ae8-730d-424c-8279-b064d9f108de",
+  "queryName": "Not Using Proper Exec Form In CMD And ENTRYPOINT Arguments",
+  "severity": "MEDIUM",
+  "category": "Build Process",
+  "descriptionText": "Ensure that we are using proper exec form in the CMD and ENTRYPOINT Arguments",
+  "descriptionUrl": "https://docs.docker.com/engine/reference/builder/#entrypoint",
+  "platform": "Dockerfile",
+  "descriptionID": "34945ae8",
+  "cwe": "573",
+  "riskScore": "5.2"
+}
```

**File**: `assets/queries/dockerfile/not_using_proper_exec_form_in_cmd_and_entrypoint_arguments/query.rego` (renamed, +4/-4)
```diff
@@ -15,8 +15,8 @@ CxPolicy[result] {
 		"documentId": input.document[i].id,
 		"searchKey": dockerLib.add_line_hint(sprintf("%s={{%s}}.{{%s}}", [from_command.Value, name, resource.Original]), from_command.LineHint),
 		"issueType": "IncorrectValue",
-		"keyExpectedValue": sprintf("{{%s}} should be in the JSON Notation", [resource.Original]),
-		"keyActualValue": sprintf("{{%s}} isn't in JSON Notation", [resource.Original]),
+		"keyExpectedValue": sprintf("{{%s}} should be in proper exec form", [resource.Original]),
+		"keyActualValue": sprintf("{{%s}} isn't in proper exec form", [resource.Original]),
 	}
 }
 
@@ -33,7 +33,7 @@ CxPolicy[result] {
 		"documentId": input.document[i].id,
 		"searchKey": dockerLib.add_line_hint(sprintf("%s={{%s}}.{{%s}}", [from_command.Value, name, resource.Original]), from_command.LineHint),
 		"issueType": "IncorrectValue",
-		"keyExpectedValue": sprintf("{{%s}} should be in the JSON Notation", [resource.Original]),
-        "keyActualValue": sprintf("{{%s}} isn't in JSON Notation", [resource.Original]),
+		"keyExpectedValue": sprintf("{{%s}} should be in proper exec form", [resource.Original]),
+		"keyActualValue": sprintf("{{%s}} isn't in proper exec form", [resource.Original]),
 	}
 }
```

**File**: `assets/queries/dockerfile/not_using_proper_exec_form_in_cmd_and_entrypoint_arguments/test/positive_expected_result.json` (renamed, +4/-4)
```diff
@@ -1,24 +1,24 @@
 [
 	{
-		"queryName": "Not Using JSON In CMD And ENTRYPOINT Arguments",
+		"queryName": "Not Using Proper Exec Form In CMD And ENTRYPOINT Arguments",
 		"severity": "MEDIUM",
 		"line": 10,
 		"fileName": "positive1.dockerfile"
 	},
 	{
-		"queryName": "Not Using JSON In CMD And ENTRYPOINT Arguments",
+		"queryName": "Not Using Proper Exec Form In CMD And ENTRYPOINT Arguments",
 		"severity": "MEDIUM",
 		"line": 11,
 		"fileName": "positive1.dockerfile"
 	},
 	{
-		"queryName": "Not Using JSON In CMD And ENTRYPOINT Arguments",
+		"queryName": "Not Using Proper Exec Form In CMD And ENTRYPOINT Arguments",
 		"severity": "MEDIUM",
 		"line": 10,
 		"fileName": "positive2.dockerfile"
 	},
 	{
-		"queryName": "Not Using JSON In CMD And ENTRYPOINT Arguments",
+		"queryName": "Not Using Proper Exec Form In CMD And ENTRYPOINT Arguments",
 		"severity": "MEDIUM",
 		"line": 11,
 		"fileName": "positive2.dockerfile"
```

---

### Incident Patch 7: `f2717681` (2026-09-28)
**Commit Message**: fix(actions): standardize kicsbot automation branch names under feature/kicsbot-* (#8129)

* fix(ci): use feature/kicsbot-* prefix for docs automation branches

Automated PR-opening workflows push branches as the default
GITHUB_TOKEN identity, which the org's branch-creation ruleset
does not exempt, causing these workflows to fail to push.

The ruleset is being updated separately to exclude the
feature/kicsbot-* branch pattern. This renames the branches used
by prepare-release and update-docs-queries so all kicsbot
automation workflows share that exclusion.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

* update: dockerfile images and vulnerable packages

* update: package versions

* add: replace on go mod to the correct unvulnerable version

* update: alpine ubi and debian images to the correct go version

* updatE: package versions

* add: diagnostic logs to windows unit tests

* update: registry to echohq on lint actions

* ci: move windows module-fetch diagnostic to a temp workflow

* delete: temporary evaluation workflow file

---------

Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>
Co-authored-by: Artur Ribeiro <[REDACTED_EMAIL]>

**File**: `.github/scripts/report/go.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module github.com/Checkmarx/e2e-report
 
-go 1.26.2
+go 1.26.3
 
 require (
 	github.com/rs/zerolog v1.31.0
```

**File**: `.github/workflows/prepare-release.yaml` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ jobs:
           title: "docs: preparing for release ${{ env.GIT_VERSION }}"
           commit-message: "docs: preparing for release ${{ env.GIT_VERSION }}"
           delete-branch: true
-          branch: feature/update-docs-index
+          branch: feature/kicsbot-update-docs-index
           base: master
           body: |
             **Automated Changes**
```

**File**: `.github/workflows/update-docs-queries.yaml` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ jobs:
           title: "docs(queries): update queries catalog"
           commit-message: "docs(queries): update queries catalog"
           delete-branch: true
-          branch: feature/update-queries-docs
+          branch: feature/kicsbot-update-queries-catalog
           body: |
             **Automated Changes**
             Updating queries' documentation.
```

**File**: `.github/workflows/validate-arm-samples.yaml` (modified, +7/-0)
```diff
@@ -25,6 +25,13 @@ jobs:
         uses: actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f #v6.3.0
         with:
           node-version: "20"
+          registry-url: https://npm.echohq.com/
+      - name: Authenticate with npm registry
+        env:
+          ECHO_LIBRARIES_ACCESS_KEY: ${{ secrets.ECHO_LIBRARIES_ACCESS_KEY }}
+        run: |
+          npm config set //npm.echohq.com/:_authToken "${ECHO_LIBRARIES_ACCESS_KEY}"
+          npm config set //packages.echohq.com/:_authToken "${ECHO_LIBRARIES_ACCESS_KEY}"
       - name: Installing jsonlint
         run: | # zizmor: ignore[adhoc-packages] single small CLI lint tool pinned to an exact version, not a project dependency warranting its own lockfile
           npm install -g --ignore-scripts jsonlint@1.6.3
```

**File**: `.github/workflows/validate-openapi-samples.yaml` (modified, +7/-0)
```diff
@@ -41,6 +41,13 @@ jobs:
         uses: actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f #v6.3.0
         with:
           node-version: '20'
+          registry-url: https://npm.echohq.com/
+      - name: Authenticate with npm registry
+        env:
+          ECHO_LIBRARIES_ACCESS_KEY: ${{ secrets.ECHO_LIBRARIES_ACCESS_KEY }}
+        run: |
+          npm config set //npm.echohq.com/:_authToken "${ECHO_LIBRARIES_ACCESS_KEY}"
+          npm config set //packages.echohq.com/:_authToken "${ECHO_LIBRARIES_ACCESS_KEY}"
       - name: Installing jsonlint
         run: | # zizmor: ignore[adhoc-packages] single small CLI lint tool pinned to an exact version, not a project dependency warranting its own lockfile
           npm install -g --ignore-scripts jsonlint@1.6.3
```

**File**: `Dockerfile` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
-ARG GO_BASE_IMAGE=checkmarx/go:1.27.0@sha256:424cf19b9e848d86bbf0ed45b216d782f064bfb6b1dd7eba7f5a8cc3f750088f
-ARG GIT_BASE_IMAGE=checkmarx/git:2.55.0@sha256:193d1e713216b75b63eb05c3ebac0185620565b10a33d2ca1b3a89e8bd46c4fc
+ARG GO_BASE_IMAGE=checkmarx/go:1.27.1@sha256:6517002d2adbef3d75dfde0cee3a93c832637faea64c0d9398d418cda3eecde4
+ARG GIT_BASE_IMAGE=checkmarx/git:2.55.0@sha256:45a7c2e9a6e903b4fe5b2c20e373d23ba305625fa09dc5bdcbaac6eb2af884c7
 FROM ${GO_BASE_IMAGE} AS build_env
 
 # Copy the source from the current directory to the Working Directory inside the container
```

**File**: `docker/Dockerfile.alpine` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM --platform=${BUILDPLATFORM:-linux/amd64} golang:1.26.2@sha256:b54cbf583d390341599d7bcbc062425c081105cc5ef6d170ced98ef9d047c716 AS build_env
+FROM --platform=${BUILDPLATFORM:-linux/amd64} golang:1.26.3@sha256:2d6c80227255c3112a4d08e67ba98e58efd3846daf15d9d7d4c389565d881b1a AS build_env
 
 # Copy the source from the current directory to the Working Directory inside the container
 WORKDIR /app
```

**File**: `docker/Dockerfile.debian` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 # it does not define an ENTRYPOINT as this is a requirement described here:
 # https://docs.microsoft.com/en-us/azure/devops/pipelines/process/container-phases?view=azure-devops#linux-based-containers
 #
-FROM --platform=${BUILDPLATFORM:-linux/amd64} golang:1.26.2-bookworm@sha256:47ce5636e9936b2c5cbf708925578ef386b4f8872aec74a67bd13a627d242b19 AS build_env
+FROM --platform=${BUILDPLATFORM:-linux/amd64} golang:1.26.3-bookworm@sha256:386d475a660466863d9f8c766fec64d7fdad3edac2c6a05020c09534d71edb4b AS build_env
 
 # Create a group and user
 RUN groupadd checkmarx && useradd -g checkmarx -M -s /bin/bash checkmarx
```

---

### Incident Patch 8: `5042ea26` (2026-09-17)
**Commit Message**: fix(query): changed all dockerfile queries for case insensitive support of dockerfile commands (#8115)

* fix(query): fix EFS Volume With Disabled Transit Encryption queries for multiple volumes cases (#7947)

* fix EFS Volume With Disabled Transit Encryption query for multiple volumes cases in tf and cf

* update: dockerfile images

* fix(analyzer): add failed utf conversions to unwanted files (#7997)

* add bad utf conversions to unwanted in analyzer

* add bad utf conversions to unwanted in analyzer

* update e2e tests and uts to cover valid ansible samples

* update base images

---------

Co-authored-by: cx-miguel-silva <[REDACTED_EMAIL]>

* Upgrade Trivy action to version 0.35.0

Updated Trivy action version from v0.34.2 to v0.35.0 in both scanning steps.

* fix(dockerhub): add token login to DockerHub (#8024)

* update: login to DockerHub to token

* bump: kics github action version

* feat(testing): add arm64 testing infra (#7998)

* add arm64 testing infra

* add arm64 testing infra

* bump images

* ci

* update e2e infra

* update e2e infra

* improve docker ubi 8 to support arm

* improve docker ubi 8 to support arm

* improve docker ubi 8 to support arm

* improve dock

**File**: `.github/scripts/validate-search-line/validate_search_line.py` (modified, +3/-0)
```diff
@@ -30,6 +30,9 @@ def get_changed_queries():
     dirs = []
     for f in files:
         if f.endswith("/query.rego"):
+            if f.startswith("assets/queries/dockerfile/"):
+                print(f"  [SKIP] {f}: Dockerfile queries do not support searchLine")
+                continue
             dirs.append(REPO_ROOT / Path(f).parent)
     return dirs
 
```

**File**: `assets/libraries/dockerfile.rego` (modified, +13/-1)
```diff
@@ -69,4 +69,16 @@ check_multi_stage(imageName, images) {
 
     sortedIndex := sort(unsortedIndex)
     imageName == sortedIndex[minus(count(sortedIndex), 1)].Name
-} 
+}
+
+get_original_from_command(commands) = from_command {
+	commands[i].Cmd == "from"
+	from_command :=  {
+		"Value": substring(commands[i].Original, 0, 4),
+		"LineHint" : commands[i]._kics_line - 1
+	}
+}
+
+add_line_hint(raw_search_key, lineHint) = searchKey {
+	searchKey := sprintf("%s^%d", [raw_search_key, lineHint])
+}
\ No newline at end of file
```

**File**: `assets/queries/dockerfile/add_instead_of_copy/query.rego` (modified, +6/-4)
```diff
@@ -3,14 +3,16 @@ package Cx
 import data.generic.dockerfile as dockerLib
 
 CxPolicy[result] {
-	resource := input.document[i].command[name][_]
-	resource.Cmd == "add"
+	stage := input.document[i].command[name]
 
-	not dockerLib.arrayContains(resource.Value, {".tar", ".tar."})
+	resource = stage[s]
+	stage[s].Cmd == "add"
+	not dockerLib.arrayContains(stage[s].Value, {".tar", ".tar."})
 
+	from_command := dockerLib.get_original_from_command(stage)
 	result := {
 		"documentId": input.document[i].id,
-		"searchKey": sprintf("FROM={{%s}}.{{%s}}", [name, resource.Original]),
+		"searchKey": dockerLib.add_line_hint(sprintf("%s={{%s}}.{{%s}}", [from_command.Value, name, resource.Original]), from_command.LineHint),
 		"issueType": "IncorrectValue",
 		"keyExpectedValue": sprintf("'COPY' %s", [resource.Value[0]]),
 		"keyActualValue": sprintf("'ADD' %s", [resource.Value[0]]),
```

**File**: `assets/queries/dockerfile/add_instead_of_copy/test/negative2.dockerfile` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+from openjdk:10-jdk
+volume /tmp
+arg JAR_FILE
+copy ${JAR_FILE} app.jar
+entrypoint ["java","-Djava.security.egd=file:/dev/./urandom","-jar","/app.jar"]
+add http://source.file/package.file.tar.gz /temp
+run tar -xjf /temp/package.file.tar.gz \
+  && make -C /tmp/package.file \
+  && rm /tmp/ package.file.tar.gz
+# trigger validation
```

**File**: `assets/queries/dockerfile/add_instead_of_copy/test/positive2.dockerfile` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+from openjdk:10-jdk
+volume /tmp
+add http://source.file/package.file.tar.gz /temp
+run tar -xjf /temp/package.file.tar.gz \
+  && make -C /tmp/package.file \
+  && rm /tmp/ package.file.tar.gz
+arg JAR_FILE
+add ${JAR_FILE} app.jar
+entrypoint ["java","-Djava.security.egd=file:/dev/./urandom","-jar","/app.jar"]
```

**File**: `assets/queries/dockerfile/add_instead_of_copy/test/positive_expected_result.json` (modified, +13/-6)
```diff
@@ -1,7 +1,14 @@
 [
-  {
-    "queryName": "Add Instead of Copy",
-    "severity": "MEDIUM",
-    "line": 8
-  }
-]
+	{
+		"queryName": "Add Instead of Copy",
+		"severity": "MEDIUM",
+		"line": 8,
+		"fileName": "positive1.dockerfile"
+	},
+	{
+		"queryName": "Add Instead of Copy",
+		"severity": "MEDIUM",
+		"line": 8,
+		"fileName": "positive2.dockerfile"
+	}
+]
\ No newline at end of file
```

**File**: `assets/queries/dockerfile/apk_add_using_local_cache_path/query.rego` (modified, +3/-1)
```diff
@@ -10,9 +10,11 @@ CxPolicy[result] {
 	runCommands := dockerLib.getCommands(command.Value[0])
 	containsApkAddWithoutNoCache(runCommands)
 
+	stage := input.document[i].command[name]
+	from_command := dockerLib.get_original_from_command(stage)
 	result := {
 		"documentId": input.document[i].id,
-		"searchKey": sprintf("FROM={{%s}}.{{%s}}", [name, command.Original]),
+		"searchKey": dockerLib.add_line_hint(sprintf("%s={{%s}}.{{%s}}", [from_command.Value, name, command.Original]), from_command.LineHint),
 		"issueType": "IncorrectValue",
 		"keyExpectedValue": "'RUN' should not contain 'apk add' command without '--no-cache' switch",
 		"keyActualValue": "'RUN' contains 'apk add' command without '--no-cache' switch",
```

**File**: `assets/queries/dockerfile/apk_add_using_local_cache_path/test/negative3.dockerfile` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+from gliderlabs/alpine:3.3
+run apk add --no-cache python
+workdir /app
+onbuild COPY . /app
+onbuild RUN virtualenv /env && /env/bin/pip install -r /app/requirements.txt
+expose 8080
+cmd ["/env/bin/python", "main.py"]
\ No newline at end of file
```

---

### Incident Patch 9: `99a15dad` (2026-09-16)
**Commit Message**: fix(filesystem): skip cache files by extension (#8112)

* fix(filesystem): skip cache files by extension

* fix: improvement to regex used for docker compose detection

* Update pkg/analyzer/analyzer.go

Co-authored-by: Artur Ribeiro <[REDACTED_EMAIL]>

* fix: lint

---------

Co-authored-by: Artur Ribeiro <[REDACTED_EMAIL]>

**File**: `pkg/analyzer/analyzer.go` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ var (
 	blueprintRegexTargetScope                       = regexp.MustCompile(`("targetScope"|targetScope)\s*:`)
 	blueprintRegexProperties                        = regexp.MustCompile(`("properties"|properties)\s*:`)
 	buildahRegex                                    = regexp.MustCompile(`buildah\s*from\s*\w+`)
-	dockerComposeServicesRegex                      = regexp.MustCompile(`services\s*:[\w\W]+(image|build)\s*:`)
+	dockerComposeServicesRegex                      = regexp.MustCompile(`(^|\n)\s*"?services"?\s*:[\w\W]*\n\s*"?(image|build)"?\s*:`)
 	crossPlaneRegex                                 = regexp.MustCompile(`"?apiVersion"?\s*:\s*(\w+\.)+crossplane\.io/v\w+\s*`)
 	knativeRegex                                    = regexp.MustCompile(`"?apiVersion"?\s*:\s*(\w+\.)+knative\.dev/v\w+\s*`)
 	pulumiNameRegex                                 = regexp.MustCompile(`name\s*:`)
```

**File**: `pkg/analyzer/analyzer_test.go` (modified, +17/-0)
```diff
@@ -102,6 +102,23 @@ func TestAnalyzer_Analyze(t *testing.T) {
 			excludeGitIgnore:     false,
 			MaxFileSize:          -1,
 		},
+		{
+			name: "analyze_test_not_dockercompose_false_positive",
+			paths: []string{
+				filepath.FromSlash("../../test/fixtures/analyzer_test_dockercompose_false_positive/azure_marketplace.json"),
+			},
+			wantTypes: []string{},
+			wantExclude: []string{
+				filepath.FromSlash("../../test/fixtures/analyzer_test_dockercompose_false_positive/azure_marketplace.json"),
+			},
+			typesFromFlag:        []string{""},
+			excludeTypesFromFlag: []string{""},
+			wantLOC:              0,
+			wantErr:              false,
+			gitIgnoreFileName:    "",
+			excludeGitIgnore:     false,
+			MaxFileSize:          -1,
+		},
 		{
 			name: "analyze_test_error_path",
 			paths: []string{
```

**File**: `test/fixtures/analyzer_test_dockercompose_false_positive/azure_marketplace.json` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+[
+  {
+    "offer": "sample-webservices",
+    "publisher": "checkmarx",
+    "sku": "sku1",
+    "urn": "checkmarx:sample-webservices:sku1:1.0.0",
+    "version": "1.0.0"
+  },
+  {
+    "offer": "sample-image",
+    "publisher": "checkmarx",
+    "sku": "sku2",
+    "urn": "checkmarx:sample-image:sku2:1.0.0",
+    "version": "1.0.0"
+  }
+]
```

---

### Incident Patch 10: `8be05166` (2026-09-15)
**Commit Message**: fix(analyzer): improvement to dockerfile scanning (#8114)

* Changed identification of docker files to be case insensitive on files named 'dockerfile'

* removed legacy redundant function 'isDockerfile' from analyzer

* Improved dockerfile identification to account for relevant folder names and all files with prefix 'dockerfile.' as well as all files with the '.dockerfile' extension type in a case insensitive matter (improvement on first commit)

* Fixed 'dockerfile' keyword not being recognized as a valid file extension, added support for all ubi8/debian files in case of valid dockerfile structure, added support for lower case dockerfile commands - most queries will have issues with this but relevant text files are properly detected as a 'dockerfile' as intended

* Minor optimization

* Initial test files/cases plus minor changes to supported dockerfile formats for consistency

* Added new helper function 'isDockerfileExtension' to get_extension utility to lower cyclomatic complexity

* reverted accidental query change, fixed linting errors, fixed test errors, fixed 'gitignore' files exclusion, docker parser will handle said case like before but with explicit 'gitignore' extension

**File**: `docs/platforms.md` (modified, +3/-1)
```diff
@@ -86,7 +86,9 @@ Note that KICS recognizes this technology as Azure Resource Manager (for queries
 
 ## Docker
 
-KICS supports scanning Docker files with any name (but with no extension) and files with `.dockerfile` extension.
+KICS supports scanning Dockerfile configurations with any name (but with no extension) and files matched by either name (`Dockerfile`, `Dockerfile.<something>`), extension (`<something>.dockerfile`,`<something>.ubi8`,`<something>.debian`), or by location inside directories named `docker`, `dockerfile`, or `dockerfiles`, where all text files are verified for a valid configuration regardless of extension. 
+
+Note that every check is matched case-insensitively with the exception of the `.ubi8` and `.debian` extensions.
 
 ## Docker Compose
 
```

**File**: `e2e/fixtures/E2E_CLI_106_PAYLOAD.json` (added, +2340/-0)
```diff
@@ -0,0 +1,2340 @@
+{
+	"document": [
+		{
+			"args": [],
+			"command": {
+				"openjdk:10-jdk": [
+					{
+						"Cmd": "from",
+						"EndLine": 1,
+						"Flags": [],
+						"JSON": false,
+						"Original": "FROM openjdk:10-jdk",
+						"SubCmd": "",
+						"Value": [
+							"openjdk:10-jdk"
+						],
+						"_kics_line": 1
+					},
+					{
+						"Cmd": "volume",
+						"EndLine": 2,
+						"Flags": [],
+						"JSON": false,
+						"Original": "VOLUME /tmp",
+						"SubCmd": "",
+						"Value": [
+							"/tmp"
+						],
+						"_kics_line": 2
+					},
+					{
+						"Cmd": "add",
+						"EndLine": 3,
+						"Flags": [],
+						"JSON": false,
+						"Original": "ADD http://source.file/package.file.tar.gz /temp",
+						"SubCmd": "",
+						"Value": [
+							"http://source.file/package.file.tar.gz",
+							"/temp"
+						],
+						"_kics_line": 3
+					},
+					{
+						"Cmd": "run",
+						"EndLine": 4,
+						"Flags": [],
+						"JSON": false,
+						"Original": "RUN tar -xjf /temp/package.file.tar.gz",
+						"SubCmd": "",
+						"Value": [
+							"tar -xjf /temp/package.file.tar.gz"
+						],
+						"_kics_line": 4
+					},
+					{
+						"Cmd": "arg",
+						"EndLine": 5,
+						"Flags": [],
+						"JSON": false,
+						"Original": "ARG JAR_FILE",
+						"SubCmd": "",
+						"Value": [
+							"JAR_FILE"
+						],
+						"_kics_line": 5
+					},
+					{
+						"Cmd": "add",
+						"EndLine": 6,
+						"Flags": [],
+						"JSON": false,
+						"Original": "ADD ${JAR_FILE} app.jar",
+						"SubCmd": "",
+						"Value": [
+							"${JAR_FILE}",
+							"app.jar"
+						],
+						"_kics_line": 6
+					},
+					{
+						"Cmd": "entrypoint",
+						"EndLine": 7,
+						"Flags": [],
+						"JSON": true,
+						"Original": "ENTRYPOINT [\"java\",\"-Djava.security.egd=file:/dev/./urandom\",\"-jar\",\"/app.jar\"]",
+						"SubCmd": "",
+						"Value": [
+							"java",
+							"-Djava.security.egd=file:/dev/./urandom",
+							"-jar",
+							"/app.jar"
+						],
+						"_kics_line": 7
+					}
+				]
+			},
+			"file": "file",
+			"id": "0"
+		},
+		{
+			"args": [],
+			"command": {
+				"alpine:3.19 AS builder": [
+					{
+						"Cmd": "from",
+						"EndLine": 13,
+						"Flags": [],
+						"JSON": false,
+						"Original": "FROM alpine:3.19 AS builder",
+						"SubCmd": "",
+						"Value": [
+							"alpine:3.19",
+							"AS",
+							"builder"
+						],
+						"_kics_line": 13
+					},
+					{
+						"Cmd": "copy",
+						"EndLine": 15,
+						"Flags": [],
+						"JSON": false,
+						"Original": "COPY . .",
+						"SubCmd": "",
+						"Value": [
+							".",
+							"."
+						],
+						"_kics_line": 15
+					},
+					{
+						"Cmd": "healthcheck",
+						"EndLine": 17,
+						"Flags": [
+							"--interval=30s",
+							"--timeout=30s",
+							"--start-period=5s",
+							"--retries=3"
+						],
+						"JSON": true,
+						"Original": "HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD [ \"executable\" ]",
+						"SubCmd": "",
+						"Value": [
+							"CMD",
+							"executable"
+						],
+						"_kics_line": 17
+					}
+				]
+			},
+			"file": "file",
+			"id": "0"
+		},
+		{
+			"args": [
+				{
+					"Cmd": "arg",
+					"EndLine": 1,
+					"Flags": [],
+					"JSON": false,
+					"Original": "ARG VERSION=1.0",
+					"SubCmd": "",
+					"Value": [
+						"VERSION=1.0"
+					],
+					"_kics_line": 1
+				},
+				{
+					"Cmd": "arg",
+					"EndLine": 2,
+					"Flags": [],
+					"JSON": false,
+					"Original": "ARG BASE_IMAGE=ubuntu:22.04",
+					"SubCmd": "",
+					"Value": [
+						"BASE_IMAGE=ubuntu:22.04"
+					],
+					"_kics_line": 2
+				}
+			],
+			"command": {
+				"alpine:3.19 AS builder": [
+					{
+						"Cmd": "from",
+						"EndLine": 4,
+						"Flags": [],
+						"JSON": false,
+						"Original": "FROM alpine:3.19 AS builder",
+						"SubCmd": "",
+						"Value": [
+							"alpine:3.19",
+							"AS",
+							"builder"
+						],
+						"_kics_line": 4
+					},
+					{
+						"Cmd": "copy",
+						"EndLine": 6,
+						"Flags": [],
+						"JSON": false,
+						"Original": "COPY . .",
+						"SubCmd": "",
+						"Value": [
+							".",
+							"."
+						],
+						"_kics_line": 6
+					},
+					{
+						"Cmd": "healthcheck",
+						"EndLine": 8,
+						"Flags": [
+							"--interval=30s",
+							"--timeout=30s",
+							"--start-period=5s",
+							"--retries=3"
+						],
+						"JSON": true,
+						"Original": "HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD [ \"executable\" ]",
+						"SubCmd": "",
+						"Value": [
+							"CMD",
+							"executable"
+						],
+						"_kics_line": 8
+					}
+				]
+			},
+			"file": "file",
+			"id": "0"
+		},
+		{
+			"args": [
+				{
+					"Cmd": "arg",
+					"EndLine": 1,
+					"Flags": [],
+					"JSON": false,
+					"Original": "ARG VERSION=1.0",
+					"SubCmd": "",
+					"Value": [
+						"VERSION=1.0"
+					],
+					"_kics_line": 1
+				},
+				{
+					"Cmd": "arg",
+					"EndLine": 2,

```

**File**: `e2e/fixtures/E2E_CLI_106_RESULT.json` (added, +982/-0)
```diff
@@ -0,0 +1,982 @@
+{
+  "kics_version": "development",
+  "files_scanned": 36,
+  "lines_scanned": 261,
+  "files_parsed": 36,
+  "lines_parsed": 250,
+  "lines_ignored": 11,
+  "files_failed_to_scan": 0,
+  "queries_total": 48,
+  "queries_failed_to_execute": 1,
+  "queries_failed_to_compute_similarity_id": 0,
+  "scan_id": "console",
+  "severity_counters": {
+    "CRITICAL": 0,
+    "HIGH": 35,
+    "INFO": 6,
+    "LOW": 17,
+    "MEDIUM": 16,
+    "TRACE": 0
+  },
+  "total_counter": 74,
+  "total_bom_resources": 0,
+  "start": "2026-04-21T15:48:50.4046892+01:00",
+  "end": "2026-04-21T15:48:58.266124+01:00",
+  "paths": [
+    "/path/test/fixtures/dockerfile",
+    "/path/test/fixtures/negative_dockerfile"
+  ],
+  "queries": [
+    {
+      "query_name": "Missing User Instruction",
+      "query_id": "fd54f200-402c-4333-a5a4-36ef6709af2f",
+      "query_url": "https://docs.docker.com/engine/reference/builder/#user",
+      "severity": "HIGH",
+      "platform": "Dockerfile",
+      "cwe": "250",
+      "risk_score": "7.7",
+      "cloud_provider": "COMMON",
+      "category": "Build Process",
+      "experimental": false,
+      "description": "Always set a user in the runtime stage of your Dockerfile. Without it, the container defaults to root, even if earlier build stages define a user.",
+      "description_id": "eb49caf6",
+      "files": [
+        {
+          "file_name": "path/test/fixtures/dockerfile/should_generate_payload/big_indent_from",
+          "similarity_id": "fd5fe33f391e08e2d4d4fe8058f5e93a75c6cd8424ea137b9944b8d871d5c37e",
+          "line": 1,
+          "issue_type": "MissingAttribute",
+          "search_key": "FROM={{alpine:latest}}",
+          "search_line": -1,
+          "search_value": "",
+          "expected_value": "The 'Dockerfile' should contain the 'USER' instruction",
+          "actual_value": "The 'Dockerfile' does not contain any 'USER' instruction"
+        },
+        {
+          "file_name": "path/test/fixtures/dockerfile/should_generate_payload/with_excluded_comments",
+          "similarity_id": "7635feaa0695981bc88dd51b213bc0763acd55575fae3d0fe196fe6b2d727bc4",
+          "line": 5,
+          "issue_type": "MissingAttribute",
+          "search_key": "FROM={{openjdk:10-jdk}}",
+          "search_line": -1,
+          "search_value": "",
+          "expected_value": "The 'Dockerfile' should contain the 'USER' instruction",
+          "actual_value": "The 'Dockerfile' does not contain any 'USER' instruction"
+        },
+        {
+          "file_name": "path/test/fixtures/dockerfile/should_generate_payload/platform_flag",
+          "similarity_id": "574ad8efea37036e772f5f133327ee6d82456fcfa268e0a01f942dd36d84a30d",
+          "line": 1,
+          "issue_type": "MissingAttribute",
+          "search_key": "FROM={{--platform=linux/amd64 alpine:latest}}",
+          "search_line": -1,
+          "search_value": "",
+          "expected_value": "The 'Dockerfile' should contain the 'USER' instruction",
+          "actual_value": "The 'Dockerfile' does not contain any 'USER' instruction"
+        },
+        {
+          "file_name": "path/test/fixtures/dockerfile/corrupted_dockerfile",
+          "similarity_id": "558c83370b9fc9e230035e00ff7b5302cd64c16f700e73c830579947e250a381",
+          "line": 1,
+          "issue_type": "MissingAttribute",
+          "search_key": "FROM={{alpine:latest}}",
+          "search_line": -1,
+          "search_value": "",
+          "expected_value": "The 'Dockerfile' should contain the 'USER' instruction",
+          "actual_value": "The 'Dockerfile' does not contain any 'USER' instruction"
+        },
+        {
+          "file_name": "path/test/fixtures/dockerfile/case_insensitive_tests/file_2.DOCKERfile",
+          "similarity_id": "b0694a2913d293ea034d0fe62bd549aed2dd316a81fb82b611a7ab901e32b1b6",
+          "line": 1,
+          "issue_type": "MissingAttribute",
+          "search_key": "FROM={{alpine:3.19 AS builder}}",
+          "search_line": -1,
+          "search_value": "",
+          "expected_value": "The 'Dockerfile' should contain the 'USER' instruction",
+          "actual_value": "The 'Dockerfile' does not contain any 'USER' instruction"
+        },
+        {
+          "file_name": "path/test/fixtures/dockerfile/any_name/dockerFILE",
+          "similarity_id": "e97a5ec241eb063c5757aed13a666c8126e4375ac9aed300cdc72d4ae883dfdc",
+          "line": 6,
+          "issue_type": "MissingAttribute",
+          "search_key": "FROM={{alpine:3.19 AS builder}}",
+          "search_line": -1,
+          "search_value": "",
+          "expected_value": "The 'Dockerfile' should contain the 'USER' instruction",
+          "actual_value": "The 'Dockerfile' does not contain any 'USER' instruction"
+        },
+        {
+          "file_name": "path/test/fixtures/dockerfile/should_generate_payload/big_host_name",
+          "similarity_id": "357d434e6436d7fc32420359985019be12903ca92c03f50369e95a19b96e9d97",
+      
```

**File**: `e2e/testcases/e2e-cli-075_ansible_host_detected.go` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ package testcases
 // should perform the scan successfully detect ansible and return result 40
 func init() { //nolint
 	testSample := TestCase{
-		Name: "should perform a valid scan and and detect ansible [E2E-CLI-075]",
+		Name: "should perform a valid scan and detect ansible [E2E-CLI-075]",
 		Args: args{
 			Args: []cmdArgs{
 				[]string{"scan", "-o", "/path/e2e/output",
```

**File**: `e2e/testcases/e2e-cli-106_valid_dockerfile_detected.go` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+package testcases
+
+// E2E-CLI-106 - KICS  scan
+// should perform the scan successfully detecting all valid dockerfile files and return result 50
+func init() { //nolint
+	testSample := TestCase{
+		Name: "should perform a valid scan with all dockerfile files parsed [E2E-CLI-106]",
+		Args: args{
+			Args: []cmdArgs{
+				[]string{"scan", "-o", "/path/e2e/output",
+					"--output-name", "E2E_CLI_106_RESULT",
+					"-p", "/path/test/fixtures/dockerfile",
+					"-p", "/path/test/fixtures/negative_dockerfile",
+					"--payload-path", "/path/e2e/output/E2E_CLI_106_PAYLOAD.json",
+				},
+			},
+			ExpectedResult: []ResultsValidation{
+				{
+					ResultsFile:    "E2E_CLI_106_RESULT",
+					ResultsFormats: []string{"json"},
+				},
+			},
+			ExpectedPayload: []string{
+				"E2E_CLI_106_PAYLOAD.json",
+			},
+		},
+		WantStatus: []int{50},
+	}
+
+	Tests = append(Tests, testSample)
+}
```

**File**: `pkg/analyzer/analyzer.go` (modified, +114/-125)
```diff
@@ -101,22 +101,20 @@ var (
 	listKeywordsGoogleDeployment = []string{"resources"}
 	armRegexTypes                = []string{"blueprint", "templateArtifact", "roleAssignmentArtifact", "policyAssignmentArtifact"}
 	possibleFileTypes            = map[string]bool{
-		".yml":               true,
-		".yaml":              true,
-		".json":              true,
-		".dockerfile":        true,
-		"Dockerfile":         true,
-		"possibleDockerfile": true,
-		".debian":            true,
-		".ubi8":              true,
-		".tf":                true,
-		"tfvars":             true,
-		".proto":             true,
-		".sh":                true,
-		".cfg":               true,
-		".conf":              true,
-		".ini":               true,
-		".bicep":             true,
+		".yml":        true,
+		".yaml":       true,
+		".json":       true,
+		".dockerfile": true,
+		".debian":     true,
+		".ubi8":       true,
+		".tf":         true,
+		"tfvars":      true,
+		".proto":      true,
+		".sh":         true,
+		".cfg":        true,
+		".conf":       true,
+		".ini":        true,
+		".bicep":      true,
 	}
 	supportedRegexes = map[string][]string{
 		"azureresourcemanager": append(armRegexTypes, arm),
@@ -155,9 +153,16 @@ type analyzerInfo struct {
 	typesFlag               []string
 	excludeTypesFlag        []string
 	filePath                string
+	fileExt                 string
 	fallbackMinifiedFileLOC int
 }
 
+// fileExtInfo contains file path and detected extension
+type fileExtInfo struct {
+	path string
+	ext  string
+}
+
 // fileTypeInfo contains file path, detected platform type, and LOC count
 type fileTypeInfo struct {
 	filePath string
@@ -332,44 +337,21 @@ func Analyze(a *Analyzer) (model.AnalyzedPaths, error) {
 		FileStats:   make(map[string]model.FileStatistics),
 	}
 
-	var files []string
+	var files []fileExtInfo
 	var wg sync.WaitGroup
 	// results is the channel shared by the workers that contains the types found
 	results := make(chan string)
 	locCount := make(chan int)
 	fileInfo := make(chan fileTypeInfo)
-	ignoreFiles := make([]string, 0)
-	projectConfigFiles := make([]string, 0)
+	var ignoreFiles []string
+	var projectConfigFiles []string
 	done := make(chan bool)
 	hasGitIgnoreFile, gitIgnore := shouldConsiderGitIgnoreFile(a.Paths[0], a.GitIgnoreFileName, a.ExcludeGitIgnore)
 	// get all the files inside the given paths
-	for _, path := range a.Paths {
-		if _, err := os.Stat(path); err != nil {
-			return returnAnalyzedPaths, errors.Wrap(err, "failed to analyze path")
-		}
-		if err := filepath.Walk(path, func(path string, info os.FileInfo, err error) error {
-			if err != nil {
-				return err
-			}
-
-			ext, errExt := utils.GetExtension(path)
-			if errExt == nil {
-				trimmedPath := strings.ReplaceAll(path, a.Paths[0], filepath.Base(a.Paths[0]))
-				ignoreFiles = a.checkIgnore(info.Size(), hasGitIgnoreFile, gitIgnore, path, trimmedPath, ignoreFiles)
-
-				if isConfigFile(path, defaultConfigFiles) {
-					projectConfigFiles = append(projectConfigFiles, path)
-					a.Exc = append(a.Exc, path)
-				}
-
-				if _, ok := possibleFileTypes[ext]; ok && !isExcludedFile(path, a.Exc) {
-					files = append(files, path)
-				}
-			}
-			return nil
-		}); err != nil {
-			log.Error().Msgf("failed to analyze path %s: %s", path, err)
-		}
+	var err error
+	files, ignoreFiles, projectConfigFiles, err = a.collectFiles(hasGitIgnoreFile, gitIgnore)
+	if err != nil {
+		return returnAnalyzedPaths, err
 	}
 
 	// unwanted is the channel shared by the workers that contains the unwanted files that the parser will ignore
@@ -380,7 +362,7 @@ func Analyze(a *Analyzer) (model.AnalyzedPaths, error) {
 	// Start a bounded worker pool. Large repositories can contain tens of
 	// thousands of candidate files, so one goroutine per file can exhaust
 	// runtime threads while workers are blocked on file I/O.
-	filesToAnalyze := make(chan string)
+	filesToAnalyze := make(chan fileExtInfo)
 	workerCount := analyzerWorkerCount(len(files), a.MaxAnalyzerWorkers)
 	wg.Add(workerCount)
 	for range workerCount {
@@ -390,7 +372,8 @@ func Analyze(a *Analyzer) (model.AnalyzedPaths, error) {
 				fileAnalyzer := &analyzerInfo{
 					typesFlag:               a.Types,
 					excludeTypesFlag:        a.ExcludeTypes,
-					filePath:                file,
+					filePath:                file.path,
+					fileExt:                 file.ext,
 					fallbackMinifiedFileLOC: a.FallbackMinifiedFileLOC,
 				}
 				fileAnalyzer.worker(results, unwanted, locCount, fileInfo)
@@ -430,6 +413,48 @@ func Analyze(a *Analyzer) (model.AnalyzedPaths, error) {
 	return returnAnalyzedPaths, nil
 }
 
+func (a *Analyzer) collectFiles(
+	hasGitIgnoreFile bool,
+	gitIgnore *ignore.GitIgnore,
+) (files []fileExtInfo, ignoreFiles, projectConfigFiles []string, err error) {
+	ignoreFiles = make([]string, 0)
+	projectConfigFiles = make([]string, 0)
+
+	for _, path := range a.Paths {
+		if _, err := os.Stat(path); err != nil {
+			return nil, nil, nil, errors.Wrap(err, "failed 
```

**File**: `pkg/analyzer/analyzer_test.go` (modified, +1/-2)
```diff
@@ -156,7 +156,6 @@ func TestAnalyzer_Analyze(t *testing.T) {
 			wantExclude: []string{
 				filepath.FromSlash("../../test/fixtures/gitignore/positive.dockerfile"),
 				filepath.FromSlash("../../test/fixtures/gitignore/secrets.tf"),
-				filepath.FromSlash("../../test/fixtures/gitignore/gitignore"),
 			},
 			typesFromFlag:        []string{""},
 			excludeTypesFromFlag: []string{""},
@@ -172,7 +171,7 @@ func TestAnalyzer_Analyze(t *testing.T) {
 				filepath.FromSlash("../../test/fixtures/gitignore"),
 			},
 			wantTypes:            []string{"dockerfile", "kubernetes", "terraform"},
-			wantExclude:          []string{filepath.FromSlash("../../test/fixtures/gitignore/gitignore")},
+			wantExclude:          []string{},
 			typesFromFlag:        []string{""},
 			excludeTypesFromFlag: []string{""},
 			wantLOC:              42,
```

**File**: `pkg/engine/provider/filesystem_test.go` (modified, +7/-16)
```diff
@@ -628,32 +628,22 @@ func TestFileSystemSourceProvider_checkConditions(t *testing.T) {
 }
 
 // TestFileSystemSourceProvider_AddExcluded tests the functions [AddExcluded()] and all the methods called by them
+// NOTE: On Windows, symlinks are disabled by default, therefore the test will fail with a "AddExcluded() = [eloop_link], want = []" notice
 func TestFileSystemSourceProvider_AddExcluded(t *testing.T) {
 	if err := test.ChangeCurrentDir("kics"); err != nil {
 		t.Errorf("failed to change dir: %s", err)
 	}
-	fsystem, err := initFs([]string{filepath.FromSlash("test")}, []string{})
-	if err != nil {
-		t.Errorf("failed to initialize a new File System Source Provider")
-	}
-	type fields struct {
-		fs *FileSystemSourceProvider
-	}
 	type args struct {
 		excludePaths []string
 	}
 	tests := []struct {
 		name    string
-		fields  fields
 		args    args
 		want    []string
 		wantErr bool
 	}{
 		{
 			name: "test_too_many_levels_of_symbolic_links",
-			fields: fields{
-				fs: fsystem,
-			},
 			args: args{
 				excludePaths: []string{
 					"test/fixtures/link_test/eloop_link",
@@ -664,9 +654,6 @@ func TestFileSystemSourceProvider_AddExcluded(t *testing.T) {
 		},
 		{
 			name: "test_add_excluded",
-			fields: fields{
-				fs: fsystem,
-			},
 			args: args{
 				excludePaths: []string{
 					"test/fixtures/config_test",
@@ -681,11 +668,15 @@ func TestFileSystemSourceProvider_AddExcluded(t *testing.T) {
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
-			err := tt.fields.fs.AddExcluded(tt.args.excludePaths)
+			fsystem, err := initFs([]string{filepath.FromSlash("test")}, []string{})
+			if err != nil {
+				t.Errorf("failed to initialize a new File System Source Provider")
+			}
+			err = fsystem.AddExcluded(tt.args.excludePaths)
 			if (err != nil) != tt.wantErr {
 				t.Errorf("AddExcluded() = %v, wantErr = %v", err, tt.wantErr)
 			}
-			got := getFSExcludes(tt.fields.fs)
+			got := getFSExcludes(fsystem)
 			if !reflect.DeepEqual(got, tt.want) {
 				t.Errorf("AddExcluded() = %v, want = %v", got, tt.want)
 			}
```

---

### Incident Patch 11: `fe2da066` (2026-09-14)
**Commit Message**: fix(version): new available version with additional v prefix (#8119)

* fix: new available version with additional v prefix bug

* update: go and git images to the latest version

* update: golden images

**File**: `Dockerfile` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
-ARG GO_BASE_IMAGE=checkmarx/go:1.27.0@sha256:b371fb9a8da098748d7b978fe3b58385fcc9d5a1f9b9cdcaf85e49a23efc0bc2
-ARG GIT_BASE_IMAGE=checkmarx/git:2.55.0@sha256:54b307e635d451ea82ecabc0d91914c2a5799096dac302c744eb103cd0bf19f8
+ARG GO_BASE_IMAGE=checkmarx/go:1.27.0@sha256:424cf19b9e848d86bbf0ed45b216d782f064bfb6b1dd7eba7f5a8cc3f750088f
+ARG GIT_BASE_IMAGE=checkmarx/git:2.55.0@sha256:193d1e713216b75b63eb05c3ebac0185620565b10a33d2ca1b3a89e8bd46c4fc
 FROM ${GO_BASE_IMAGE} AS build_env
 
 # Copy the source from the current directory to the Working Directory inside the container
```

**File**: `pkg/scan/client.go` (modified, +4/-2)
```diff
@@ -5,6 +5,7 @@ import (
 	"encoding/json"
 	"io"
 	"net/http"
+	"strings"
 	"time"
 
 	"github.com/rs/zerolog/log"
@@ -135,9 +136,10 @@ func CheckVersion(t *tracker.CITracker) {
 		return
 	}
 
+	latestVersionTag := strings.TrimPrefix(release.TagName, "v")
 	t.TrackVersion(model.Version{
-		Latest:           constants.Version == release.TagName,
-		LatestVersionTag: release.TagName,
+		Latest:           constants.Version == latestVersionTag,
+		LatestVersionTag: latestVersionTag,
 	})
 }
 
```

**File**: `pkg/scan/client_test.go` (modified, +68/-0)
```diff
@@ -1,9 +1,15 @@
 package scan
 
 import (
+	"io"
+	"net/http"
+	"strings"
 	"testing"
 
 	"github.com/stretchr/testify/require"
+
+	"github.com/Checkmarx/kics/v2/internal/constants"
+	"github.com/Checkmarx/kics/v2/internal/tracker"
 )
 
 func Test_Client(t *testing.T) {
@@ -29,3 +35,65 @@ func Test_ClientError(t *testing.T) {
 	require.Nil(t, client)
 	require.Error(t, err)
 }
+
+type fakeVersionRoundTripper struct {
+	statusCode int
+	body       string
+}
+
+func (f *fakeVersionRoundTripper) RoundTrip(_ *http.Request) (*http.Response, error) {
+	return &http.Response{
+		StatusCode: f.statusCode,
+		Body:       io.NopCloser(strings.NewReader(f.body)),
+		Header:     make(http.Header),
+	}, nil
+}
+
+func Test_CheckVersion(t *testing.T) {
+	tests := []struct {
+		name              string
+		currentVersion    string
+		releaseBody       string
+		expectedLatest    bool
+		expectedLatestTag string
+	}{
+		{
+			name:              "outdated version compared to v-prefixed GitHub release tag",
+			currentVersion:    "2.1.20",
+			releaseBody:       `{"tag_name": "v2.1.21"}`,
+			expectedLatest:    false,
+			expectedLatestTag: "2.1.21",
+		},
+		{
+			name:              "already on the latest version",
+			currentVersion:    "2.1.21",
+			releaseBody:       `{"tag_name": "v2.1.21"}`,
+			expectedLatest:    true,
+			expectedLatestTag: "2.1.21",
+		},
+	}
+
+	originalClient := versionHTTPClient
+	originalVersion := constants.Version
+	defer func() {
+		versionHTTPClient = originalClient
+		constants.Version = originalVersion
+	}()
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			constants.Version = tt.currentVersion
+			versionHTTPClient = &http.Client{
+				Transport: &fakeVersionRoundTripper{statusCode: http.StatusOK, body: tt.releaseBody},
+			}
+
+			tr, err := tracker.NewTracker(3)
+			require.NoError(t, err)
+
+			CheckVersion(tr)
+
+			require.Equal(t, tt.expectedLatestTag, tr.Version.LatestVersionTag)
+			require.Equal(t, tt.expectedLatest, tr.Version.Latest)
+		})
+	}
+}
```

---

### Incident Patch 12: `cd467d15` (2026-09-11)
**Commit Message**: fix(validator): update queries validator for cwe and risk score fields (#8028)

* update: queries validator for cwe field to be a numbered string

* test: failure cwe field and normal cwe field to test changes

* revert: action is good

* update: add risk score field validation

* update: creating-queries documentation notes with more information about cwe and risk score fields

* fix: constrain riskScore to a positive value between 0.0 and 10.0

---------

Co-authored-by: Miguel da Silva <[REDACTED_EMAIL]>

**File**: `.github/scripts/queries-validator/metadata-schema.json` (modified, +12/-2)
```diff
@@ -21,6 +21,16 @@
             "type": "string",
             "minLength": 1,
             "pattern": "^[a-f0-9]{8}$"
+        },
+        "cwe_pattern": {
+            "type": "string",
+            "minLength": 1,
+            "pattern": "^[0-9]+$"
+        },
+        "risk_score_pattern": {
+            "type": "string",
+            "minLength": 1,
+            "pattern": "^(10\\.0|[0-9]\\.[0-9])$"
         }
     },
     "required": [
@@ -177,10 +187,10 @@
             ]
         },
         "cwe": {
-            "type": "string"
+            "$ref": "#/definitions/cwe_pattern"
         },
         "riskScore": {
-            "type": "string"
+            "$ref": "#/definitions/risk_score_pattern"
         }
     }
 }
```

**File**: `.github/scripts/queries-validator/queries-validator.py` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ def exit_success():
 def fetch(page=1, max_items=100):
     print('Fetching PR #{} files... #page{}'.format(KICS_PR_NUMBER, page))
     headers = {'Authorization': 'token {}'.format(KICS_GITHUB_TOKEN)}
-    url = 'https://api.github.com/repos/checkmarx/kics/pulls/{}/files?per_page={}page={}'.format(KICS_PR_NUMBER, max_items, page)
+    url = 'https://api.github.com/repos/checkmarx/kics/pulls/{}/files?per_page={}&page={}'.format(KICS_PR_NUMBER, max_items, page)
     response = requests.get(url, headers=headers)
     return { "data": response.json(), "status": response.status_code }
 
```

**File**: `assets/queries/ansible/aws/alb_listening_on_http/metadata.json` (modified, +1/-1)
```diff
@@ -11,4 +11,4 @@
   "cwe": "319",
   "oldSeverity": "HIGH",
   "riskScore": "6.8"
-}
\ No newline at end of file
+}
```

**File**: `assets/queries/ansible/aws/ami_not_encrypted/metadata.json` (modified, +1/-1)
```diff
@@ -11,4 +11,4 @@
   "cwe": "311",
   "oldSeverity": "HIGH",
   "riskScore": "5.2"
-}
\ No newline at end of file
+}
```

**File**: `docs/creating-queries.md` (modified, +10/-5)
```diff
@@ -55,9 +55,9 @@ To test and debug there are two ways:
 #### Query Development Tutorial
 
 In the first instance, take a look at the query composition:
-- **query.rego**: Includes the policy and defines the result. The policy builds the pattern that breaks the security of the infrastructure code, which the query is looking for. The result defines the specific data used to present the vulnerability in the infrastructure code.
-- **metadata.json**: Each query has a metadata.json companion file with all the relevant information about the vulnerability, including the severity, category and its description;
-- **test**: Folder that contains at least one negative and positive case and a JSON file with data about the expected results.
+  - **query.rego**: Includes the policy and defines the result. The policy builds the pattern that breaks the security of the infrastructure code, which the query is looking for. The result defines the specific data used to present the vulnerability in the infrastructure code.
+  - **metadata.json**: Each query has a metadata.json companion file with all the relevant information about the vulnerability, including the severity, category and its description;
+  - **test**: Folder that contains at least one negative and positive case and a JSON file with data about the expected results.
 
 ```
 - <technology>
@@ -248,8 +248,13 @@ go run ./cmd/console/main.go generate-id
 - `cloudProvider` should specify the target cloud provider, when necessary (e.g. AWS, AZURE, GCP, etc.)
 - `aggregation` [optional] should be used when more than one query is implemented in the same query.rego file. Indicates how many queries are implemented
 - `override` [optional] should only be used when a `metadata.json` is shared between queries from different platforms or different specification versions like for example OpenAPI 2.0 (Swagger) and OpenAPI 3.0. This field defines an object that each field is mapped to a given `overrideKey` that should be provided from the query execution result (covered in the next section), if an `overrideKey` is provided, this will generate a new query that inherits the root level metadata values and only rewrites the fields defined inside this object.
-- `cwe` CWE is a community-developed list of common software and hardware weakness types that could have security ramifications. To know more about CWE, please refer to cwe.mitre.org
-- `riskScore` Numeric score used to help users prioritize security findings by potential impact. Contributors adding new queries should follow this recommended severity → score mapping: Critical → 8.5, High → 6, Medium → 3, Low → 1, Info/Trace → 0. 
+- `cwe` CWE is a community-developed list of common software and hardware weakness types that could have security ramifications. To know more about CWE, please refer to _cwe.mitre.org_. It's represented by a string numeric value;
+- `riskScore` Numeric float with one decimal place, positive, between `0.0` and `10.0`, used to help users prioritize security findings by potential impact. Contributors adding new queries should follow this recommended severity to risk score mapping:
+    - Critical → 8.5
+    - High → 6.0
+    - Medium → 3.0
+    - Low → 1.0
+    - Info/Trace → 0.0
 
 If the **query.rego** file implements more than one query, the **metadata.json** should indicate how many are implemented (through `aggregation`). That can be necessary due to two cases:
 1. It implements more than one query in the same **query.rego** for the same platform
```

**File**: `test/queries_content_test.go` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ var (
 		"riskScore": func(tb testing.TB, value interface{}, metadataPath string) {
 			riskScoreValue := testMetadataFieldStringType(tb, value, "riskScore", metadataPath)
 			require.NotEmpty(tb, riskScoreValue, "empty riskScore in query metadata file %s", metadataPath)
-			require.Regexp(tb, `^-?\d+\.\d$`, riskScoreValue, "invalid riskScore format in query metadata file %s (expected format: 'X.X' or '-X.X')", metadataPath)
+			require.Regexp(tb, `^(10\.0|[0-9]\.[0-9])$`, riskScoreValue, "invalid riskScore format in query metadata file %s (expected a positive value between 0.0 and 10.0)", metadataPath)
 		},
 	}
 )
```

---

### Incident Patch 13: `d28435bf` (2026-09-10)
**Commit Message**: fix(release): gate kics release workflows behind release environment (#8108)

* fix(ci): gate kics release workflows behind release environment

The release workflows deployed without declaring the `release`
environment, so the Docker Hub OIDC connection ID (an environment
secret) resolved empty and the registry login never actually
authenticated. Adding `environment: release` to each job fixes that
and applies the existing approval/master-only deployment policy.

Since release-event runs execute on a tag ref, which the
environment's master-only policy would reject, the `release:` and
`push:` triggers are replaced with manual dispatch. The now-dead
prerelease `if:` checks are removed, and the Docker Hub username is
read from the environment variable instead of being hardcoded.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

* chore(codeowners): point default ownership at cx-maintainers-kics

Repoints the default CODEOWNERS entry from @checkmarx/kics to
@Checkmarx/cx-maintainers-kics so it aligns with the reviewer team
enforced by the kics repo's merge-protection ruleset.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

* empty commit

---------

C

**File**: `.github/CODEOWNERS` (modified, +1/-1)
```diff
@@ -1 +1 @@
-*      @checkmarx/kics
+*      @Checkmarx/cx-maintainers-kics
```

**File**: `.github/workflows/prepare-release.yaml` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ concurrency:
 jobs:
   prepare-release:
     name: prepare for next release
+    environment: release
     runs-on: cx-public-ubuntu-x64
     permissions:
       contents: write  # for actions/checkout to fetch code and create-pull-request to push a branch
```

**File**: `.github/workflows/release-dkr-image.yml` (modified, +2/-4)
```diff
@@ -1,8 +1,6 @@
 name: release-docker-image
 
 on:
-  release:
-    types: [created, published]
   workflow_dispatch:
 
 concurrency:
@@ -15,8 +13,8 @@ permissions:
 jobs:
   push_to_registry:
     name: Push Docker image to Docker Hub
+    environment: release
     runs-on: cx-public-ubuntu-x64
-    if: "!github.event.release.prerelease"
     permissions:
       contents: read
       id-token: write  # required to request the GitHub OIDC token exchanged with Docker Hub's OIDC login
@@ -56,7 +54,7 @@ jobs:
       - name: Login to DockerHub
         uses: step-security/docker-login-action@bd6978fd4ef9a5f78130095b298b8a721afcb0d8 # v4.5.1
         with:
-          username: checkmarx
+          username: ${{ vars.DOCKERHUB_USERNAME }}
         env:
           DOCKERHUB_OIDC_CONNECTIONID: ${{ secrets.DOCKERHUB_OIDC_CONNECTIONID }}
       - name: Get current date
```

**File**: `.github/workflows/update-docs-queries.yaml` (modified, +1/-6)
```diff
@@ -2,12 +2,6 @@ name: update-queries-docs
 
 on:
   workflow_dispatch:
-  push:
-    branches: [master]
-    paths:
-      - "assets/queries/**/metadata.json"
-      - "assets/queries/**/test/**"
-      - ".github/scripts/docs-generator/**"
 
 permissions:
   contents: read
@@ -19,6 +13,7 @@ concurrency:
 jobs:
   update-docs:
     name: Update queries documentation
+    environment: release
     permissions:
       actions: write  # for styfle/cancel-workflow-action to cancel/stop running workflows
       contents: write  # for actions/checkout to fetch code and create-pull-request to push a branch
```

**File**: `.github/workflows/update-docs-release.yaml` (modified, +1/-3)
```diff
@@ -2,8 +2,6 @@ name: update-docs-release
 
 on:
   workflow_dispatch:
-  release:
-    type: [published]
 
 permissions:
   contents: read
@@ -15,11 +13,11 @@ concurrency:
 jobs:
   update-docs-release:
     name: Create new docs version
+    environment: release
     permissions:
       actions: write  # for styfle/cancel-workflow-action to cancel/stop running workflows
       contents: write  # for Git to git push
     runs-on: cx-public-ubuntu-x64
-    if: "!github.event.release.prerelease"
     steps:
       - name: Cancel Previous Runs
         uses: styfle/cancel-workflow-action@85880fa0301c86cca9da44039ee3bb12d3bedbfa # 0.12.1
```

---

### Incident Patch 14: `2f5465c6` (2026-09-10)
**Commit Message**: fix(actions): fix security vulnerabilities and update ci with new enforced rules (#8118)

* fix: ci actions with new enforced rules

* remove: e2e-report binary and add it to .gitignore

* update: increase timeout for test-cover report tests

* remove: hardcoded url values in k8s tests, using mock server now

* update: containerd package version to fix vulnerability

**File**: `.github/workflows/go-ci-integration.yml` (modified, +0/-6)
```diff
@@ -14,18 +14,12 @@ concurrency:
 jobs:
   integration-tests:
     permissions:
-      actions: write  # for fkirc/skip-duplicate-actions to skip or stop workflow runs
       contents: read  # for docker/build-push-action to read repo content
     name: integration-tests
     runs-on: cx-public-ubuntu-x64
     env:
       PR_SHA: ${{ github.sha }}
     steps:
-      - id: skip_check
-        uses: step-security/skip-duplicate-actions@4eef6ae57f2ca5ea100e5c1da2ead9138483f53c # v5.3.4
-        with:
-          cancel_others: false
-          paths_ignore: '["docs/**", "**/**.md", "examples"]'
       - name: Check out code into the Go module directory
         uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
         with:
```

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ file:/
 
 # ci/cd binaries
 .bin
+.github/scripts/report/e2e-report
 
 # kics configuration file
 kics.config
```

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ test-unit: generate
 test-cover: ## Run tests with code coverage
 test-cover: generate
 	$(call print-target)
-	@go test -covermode=atomic -v -coverprofile=coverage.out $(shell go list ./... | grep -v e2e)
+	@go test -covermode=atomic -timeout 2100s -v -coverprofile=coverage.out $(shell go list ./... | grep -v e2e)
 
 .PHONY: test-coverage-report
 test-coverage-report: ## Run unit tests and generate test coverage report
```

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -174,7 +174,7 @@ require (
 	github.com/boombuler/barcode v1.0.1 // indirect
 	github.com/cespare/xxhash/v2 v2.3.0 // indirect
 	github.com/chai2010/gettext-go v1.0.2 // indirect
-	github.com/containerd/containerd v1.7.33 // indirect
+	github.com/containerd/containerd v1.7.35 // indirect
 	github.com/cyphar/filepath-securejoin v0.6.1 // indirect
 	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
 	github.com/emicklei/go-restful/v3 v3.13.0 // indirect
@@ -250,7 +250,7 @@ require (
 	golang.org/x/sys v0.47.0 // indirect
 	golang.org/x/term v0.45.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
-	google.golang.org/grpc v1.83.1 // indirect
+	google.golang.org/grpc v1.83.2 // indirect
 	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	k8s.io/api v0.36.2
```

**File**: `go.sum` (modified, +4/-4)
```diff
@@ -132,8 +132,8 @@ github.com/cheggaaa/pb/v3 v3.1.7 h1:2FsIW307kt7A/rz/ZI2lvPO+v3wKazzE4K/0LtTWsOI=
 github.com/cheggaaa/pb/v3 v3.1.7/go.mod h1:/Ji89zfVPeC/u5j8ukD0MBPHt2bzTYp74lQ7KlgFWTQ=
 github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2 h1:aBangftG7EVZoUb69Os8IaYg++6uMOdKK83QtkkvJik=
 github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2/go.mod h1:qwXFYgsP6T7XnJtbKlf1HP8AjxZZyzxMmc+Lq5GjlU4=
-github.com/containerd/containerd v1.7.33 h1:iAkYGC/ifR/V+0eR4iXWHNGYUF0DF2PmGV5iz4Irj5M=
-github.com/containerd/containerd v1.7.33/go.mod h1:gSbSCVjPCdkfJCjyrzz7aRC+xFlqVbatNpfHfVCYGUM=
+github.com/containerd/containerd v1.7.35 h1:7AU2T1qI2OdNBmKkreWZ7kASHUNFItN5Hgejd9sY938=
+github.com/containerd/containerd v1.7.35/go.mod h1:ozI//0TomTCLPhQREnx0IXDIQMg+Fk7yTtg9fNvU8EQ=
 github.com/containerd/errdefs v1.0.0 h1:tg5yIfIlQIrxYtu9ajqY42W3lpS19XqdxRQeEwYG8PI=
 github.com/containerd/errdefs v1.0.0/go.mod h1:+YBYIdtsnF4Iw6nWZhJcqGSg/dwvV7tyJ/kCkyJ2k+M=
 github.com/containerd/log v0.1.0 h1:TCJt7ioM2cr/tfR8GPbGf9/VRAX8D2B4PjzCpfX540I=
@@ -701,8 +701,8 @@ google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:
 google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa h1:mZHHdPZl0dbGHCflZgAq/Q468DWVFcU2whhB2KAo8fk=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
-google.golang.org/grpc v1.83.1 h1:HIO0+BEtBP6soyqvqC8sNUjZ7bTs+0hFQuFF+RAy++Y=
-google.golang.org/grpc v1.83.1/go.mod h1:kDyl6SKsiHKt0uylY5gtn5cEjkrIOhQOGDgIc4JGwzQ=
+google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
+google.golang.org/grpc v1.83.2/go.mod h1:YPI1hK3kDked6iHvgX3tR0y+nX/qpMFKhPgFsokw1S8=
 google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af h1:+5/Sw3GsDNlEmu7TfklWKPdQ0Ykja5VEmq2i817+jbI=
 google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

**File**: `pkg/kuberneter/kuberneter_test.go` (modified, +58/-5)
```diff
@@ -1,17 +1,25 @@
 package kuberneter
 
 import (
+	"bytes"
 	"context"
+	"encoding/base64"
+	"encoding/pem"
+	"net/http"
+	"net/http/httptest"
 	"os"
 	"path/filepath"
 	"strings"
 	"testing"
+	"text/template"
 
 	"github.com/stretchr/testify/require"
 	"k8s.io/client-go/rest"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 )
 
+const mockK8sAPITokenValue = "sample-mock-bearer-token"
+
 type envVar struct {
 	name  string
 	value string
@@ -285,7 +293,52 @@ func Test_HasServiceAccountToken_envVars(t *testing.T) {
 	}
 }
 
+// newMockK8sAPIServer starts a local TLS server standing in for a real k8s API server.
+// It rejects every request with 401, which is what a cluster does when the presented
+// bearer token is invalid, so getK8sClient exercises a real TLS handshake and a real
+// token exchange instead of a bare connection failure.
+func newMockK8sAPIServer(t *testing.T) *httptest.Server {
+	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		if got := r.Header.Get("Authorization"); got != "Bearer "+mockK8sAPITokenValue {
+			t.Errorf("mock k8s API server: unexpected Authorization header %q", got)
+		}
+		w.WriteHeader(http.StatusUnauthorized)
+	}))
+	t.Cleanup(server.Close)
+	return server
+}
+
+// renderKubeconfig fills in the sample_K8S_CONFIG_FILE.yaml template with the mock
+// server's own URL and certificate, so the rendered kubeconfig points at a real,
+// locally-reachable endpoint instead of a hardcoded fake host.
+func renderKubeconfig(t *testing.T, server *httptest.Server) string {
+	caPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: server.Certificate().Raw})
+
+	tmplPath := getValidCertPath([]string{"..", "..", "test", "assets", "sample_K8S_CONFIG_FILE.yaml"})
+	tmpl, err := template.ParseFiles(tmplPath)
+	require.NoError(t, err)
+
+	var rendered bytes.Buffer
+	err = tmpl.Execute(&rendered, struct {
+		CAData string
+		Server string
+		Token  string
+	}{
+		CAData: base64.StdEncoding.EncodeToString(caPEM),
+		Server: server.URL,
+		Token:  mockK8sAPITokenValue,
+	})
+	require.NoError(t, err)
+
+	configPath := filepath.Join(t.TempDir(), "rendered_K8S_CONFIG_FILE.yaml")
+	require.NoError(t, os.WriteFile(configPath, rendered.Bytes(), 0o600))
+	return configPath
+}
+
 func Test_GetClient(t *testing.T) {
+	mockServer := newMockK8sAPIServer(t)
+	renderedConfigPath := renderKubeconfig(t, mockServer)
+
 	tests := []struct {
 		name    string
 		args    []envVar
@@ -296,7 +349,7 @@ func Test_GetClient(t *testing.T) {
 			args: []envVar{
 				{
 					name:  "K8S_CONFIG_FILE",
-					value: getValidCertPath([]string{"..", "..", "test", "assets", "sample_K8S_CONFIG_FILE.yaml"}),
+					value: renderedConfigPath,
 				},
 			},
 			wantErr: true,
@@ -320,8 +373,8 @@ func Test_GetClient(t *testing.T) {
 			name: "has_K8S_HOST",
 			args: []envVar{
 				{
-					name:  "K8S_K8S_HOST",
-					value: "https://f037947b-2b72-470f-b606-8601055974c7.eu-west-2.linodelke.net:443",
+					name:  "K8S_HOST",
+					value: "https://127.0.0.1:1",
 				},
 			},
 			wantErr: true,
@@ -331,7 +384,7 @@ func Test_GetClient(t *testing.T) {
 			args: []envVar{
 				{
 					name:  "K8S_HOST",
-					value: "https://f037947b-2b72-470f-b606-8601055974c7.eu-west-2.linodelke.net:443",
+					value: "https://127.0.0.1:1",
 				},
 				{
 					name:  "K8S_CA_FILE",
@@ -349,7 +402,7 @@ func Test_GetClient(t *testing.T) {
 			args: []envVar{
 				{
 					name:  "K8S_HOST",
-					value: "https://f037947b-2b72-470f-b606-8601055974c7.eu-west-2.linodelke.net:443",
+					value: "https://127.0.0.1:1",
 				},
 				{
 					name:  "K8S_CA_FILE",
```

**File**: `test/assets/sample_K8S_CONFIG_FILE.yaml` (modified, +9/-9)
```diff
@@ -5,21 +5,21 @@ preferences: {}
 
 clusters:
 - cluster:
-    certificate-authority-data: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUMvakNDQWVhZ0F3SUJBZ0lCQURBTkJna3Foa2lHOXcwQkFRc0ZBREFWTVJNd0VRWURWUVFERXdwcmRXSmwKY201bGRHVnpNQjRYRFRJeU1Ea3hNakE1TWpneE1sb1hEVE15TURrd09UQTVNamd4TWxvd0ZURVRNQkVHQTFVRQpBeE1LYTNWaVpYSnVaWFJsY3pDQ0FTSXdEUVlKS29aSWh2Y05BUUVCQlFBRGdnRVBBRENDQVFvQ2dnRUJBS1hWCm5NTmY4QUZKclNPN01YZTQvZWJIWWNBbDdXSFhmUTJQZHV2TzAzVmlac281aVYyWVdZSkIxR3lrK0FNRGVLSWUKcjQvazF1THo1eDB1ekFDYTdQSkZVOXdmeHBILzBBUUowNnhvMkpRQWhPNVh3RlhkOWFiWUViZ3dMQ1JFWDVDYwozUGRJTlBBb2NEby9mWFBNN3N4QWxPcjRlUzZpUk9qT0thSGZ5dUtrL0NoVXc3SHh4Qm5xZmpIL3FwRDNIanAyCnFsOFJnVzVST3FtdFVFMENOUllmdTZWekNkVjJzdHlES3NpY2RnMUhVUDlWd1h2MFJkckY1cDg0VE0xc3pmNHcKYU9jZDdTVHE3djBpT3cyQlJOU0dBOXZ6b0FkTVdHRWp0M0M3dDY3UGVVMWticldqNk1JYm1zWWdtMEhnL0FkawpabWpyYlV5YytzWEVBYjlMam9FQ0F3RUFBYU5aTUZjd0RnWURWUjBQQVFIL0JBUURBZ0trTUE4R0ExVWRFd0VCCi93UUZNQU1CQWY4d0hRWURWUjBPQkJZRUZNQ0tZVzVBZ0JyZ3pFdTJHaE9aNzJKN3c3Ym9NQlVHQTFVZEVRUU8KTUF5Q0NtdDFZbVZ5Ym1WMFpYTXdEUVlKS29aSWh2Y05BUUVMQlFBRGdnRUJBQytEaDdkL2hSWFNkTFhHZE1CdQpwUXc5a1hQVUxST1R0UlNrTDdKOWxXTlNEWWF1MXVzWWVyMDFHV1VORURkbU5qcDdwVkgyRVVja2FsQ0VtRzM3CmMyUjhvelVQRWNhMkNKNGJhcTBqWWhyWUJuNWNaVW5OakNsVHVLSHEwWlBlMGMwa1F1MzB1N3N4Z2hDbkN3YlMKNWQvVUpzWVg2ZkhPM0xuaS9GTGZnL0k2R2xNbGlPMTZXQTBvc1dORTNraDA2VVlXYjY2ODV3ekRjSGdDY3BzYwpKUmVkYUVNR2lCVUpJTWRtUkhIWjR3b1BoZkoybUJtaVVRODlmaVB5aUNJdkFMc0xQNHNPczN2MktFNWE4K3htClpNNVNnN2U3Wlpqa2N2M3pXYXpiN0NGY1JUNEpQbi9iYUVrU2xhV1ZUVTB3aENQQkhsOWlhZVc1bjJGUGZkZmMKOHZJPQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg==
-    server: https://f037947b-2b72-470f-b606-8601055974c7.eu-west-2.linodelke.net:443
-  name: lke72136
+    certificate-authority-data: {{.CAData}}
+    server: {{.Server}}
+  name: sample-cluster
 
 users:
-- name: lke72136-admin
+- name: sample-admin
   user:
     as-user-extra: {}
-    token: eyJhbGciOiJSUzI1NiIsImtpZCI6InpIaURXMTZIakhSdnYwREZidGlEekphREdtNG5zb2R3emczMHI5Z0diUkUifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJrdWJlLXN5c3RlbSIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VjcmV0Lm5hbWUiOiJsa2UtYWRtaW4tdG9rZW4tbWpzcGoiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlcnZpY2UtYWNjb3VudC5uYW1lIjoibGtlLWFkbWluIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZXJ2aWNlLWFjY291bnQudWlkIjoiNjI2Yjg0NTMtYWQ2NC00YWFlLTkwZGYtOTRjZDc1MTRhODQ0Iiwic3ViIjoic3lzdGVtOnNlcnZpY2VhY2NvdW50Omt1YmUtc3lzdGVtOmxrZS1hZG1pbiJ9.fFbVCu8azYcpHdizSjCrXyWWjUAXsUzP2qW7ahzGsKeogK31V5IHZCZiJnUzNAuHhaYymJxty0I95iBIlY4fYqDylb_EdZyr8c3l-NRHlRE2kkD6gZbvjB4jvx_pUoHiSNQiq_TkjVv4c7qqaQyJBiB_cqDbhUVg7jlFqzYbwbEU3gGmMx4Z6OqZym5gB1wC4swsnkKoqmQEQvrrteYtWJIqQ1hrYqY3UdPIWmxfG0shHZ3FBh8n-gClvIA8SXArY9DQUKicsFdd_lat_mAJWNr1d4nS9mC_YUkFLKb2dxmfmyCuKDZoPiZbAh7KAVfNdaijOGiMWcu4Co80h6LIHA
+    token: {{.Token}}
 
 contexts:
 - context:
-    cluster: lke72136
+    cluster: sample-cluster
     namespace: default
-    user: lke72136-admin
-  name: lke72136-ctx
+    user: sample-admin
+  name: sample-ctx
 
-current-context: lke72136-ctx
+current-context: sample-ctx
```

---

### Incident Patch 15: `8046b364` (2026-09-08)
**Commit Message**: fix: flaky cycloneDx model report test (#8113)

**File**: `pkg/report/model/cyclonedx_test.go` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@ func TestInitCycloneDxReport(t *testing.T) {
 		t.Run(tt.name, func(t *testing.T) {
 			got := InitCycloneDxReport()
 			got.SerialNumber = "urn:uuid:" // set to "urn:uuid:" because it will be different for every report
+			got.Metadata.Timestamp = tt.want.Metadata.Timestamp // set to want's value because it depends on the current time and would otherwise be flaky
 			if !reflect.DeepEqual(got, tt.want) {
 				t.Errorf("InitCycloneDxReport() = %v, want %v", got, tt.want)
 			}
```

#### Recent Merged Pull Requests:
- **PR #8138** (2026-10-01): docs(queries): clarify riskScore type in query metadata (@cx-artur-ribeiro)
- **PR #8137** (2026-09-30): fix(vulnerabilities): update package versions to fix vulnerabilities (@cx-artur-ribeiro)
- **PR #8131** (2026-09-29): fix(queries): Rename query "Not Using JSON In CMD And ENTRYPOINT Arguments" to "Not Using proper exec form In CMD And ENTRYPOINT Arguments" (@cx-laura-rodrigues)
- **PR #8129** (2026-09-28): fix(actions): standardize kicsbot automation branch names under feature/kicsbot-* (@cx-lior-poterman)
- **PR #8126** (2026-09-17): docs(release): update queries catalog, index and dockerfile for 2.2.0 (@cx-artur-ribeiro)
- **PR #8123** (2026-10-01): fix(query): improve "last user is root" dockerfile query coverage (@cx-andre-pereira)
- **PR #8122** (2026-09-15): chore(release): removed unused goreleaser configuration files (@cx-ricardo-jesus)
- **PR #8121** (2026-10-01): fix(detector): fix data race in dockerfile line detection for multiple dockerfiles projects (@cx-artur-ribeiro)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

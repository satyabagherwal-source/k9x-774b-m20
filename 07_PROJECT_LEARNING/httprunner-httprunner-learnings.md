# Forensic Learning Record (Deep Inspection): httprunner/httprunner

> **Canonical Artifact**: `07_PROJECT_LEARNING/httprunner-httprunner-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/httprunner/httprunner](https://github.com/httprunner/httprunner))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:31:08.026Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `httprunner/httprunner`
- **Description**: HttpRunner 是一款开源的 API/UI 测试框架，简单易用，功能强大，具有丰富的插件化机制和高度的可扩展能力。
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4297 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/builtin/utils.go`
```
package builtin

import (
	"bufio"
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/csv"
	builtinJSON "encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"math"
	"math/rand"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v3"

	"github.com/httprunner/httprunner/v5/code"
	"github.com/httprunner/httprunner/v5/internal/json"
	"github.com/httprunner/httprunner/v5/uixt/types"
)

func Dump2JSON(data interface{}, path string) error {
	path, err := filepath.Abs(path)
	if err != nil {
		log.Error().Err(err).Msg("convert absolute path failed")
		return err
	}
	log.Info().Str("path", path).Msg("dump data to json")

	// Use standard library json encoder with consistent indentation and no HTML escaping
	buffer := new(bytes.Buffer)
	encoder := builtinJSON.NewEncoder(buffer)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "    ")

	err = encoder.Encode(data)
	if err != nil {
		return err
	}

	// Ensure the JSON content is properly UTF-8 encoded
	// Go's json package already outputs UTF-8, but we explicitly validate it here
	jsonBytes := buffer.Bytes()

	// Create file and write content atomically to prevent corruption
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		log.Error().Err(err).Msg("create json file failed")
		return err
	}
	defer file.Close()

	// Write JSON content directly (Go's json package ensures UTF-8 encoding)
	if _, err := file.Write(jsonBytes); err != nil {
		log.Error().Err(err).Msg("write json content failed")
		return err
	}

	// Ensure data is flushed to disk
	if err := file.Sync(); err != nil {
		log.Error().Err(err).Msg("sync json file failed")
		return err
	}

	return nil
}

func Dump2YAML(data interface{}, path string) error {
	path, err := filepath.Abs(path)
	if err != nil {
		log.Error().Err(err).Msg("convert absolute path failed")
		return err
	}
	log.Info().Str("path", path).Msg("dump data to yaml")

	// init yaml encoder
	buffer := new(bytes.Buffer)
	encoder := yaml.NewEncoder(buffer)
	encoder.SetIndent(4)

	// encode
	err = encoder.Encode(data)
	if err != nil {
		return err
	}

	err = os.WriteFile(path, buffer.Bytes(), 0o644)
	if err != nil {
		log.Error().Err(err).Msg("dump yaml path failed")
		return err
	}
	return nil
}

func FormatResponse(raw interface{}) interface{} {
	formattedResponse := make(map[string]interface{})
	for key, value := range raw.(map[string]interface{}) {
		// convert value to json
		if key == "body" {
			b, _ := json.MarshalIndent(&value, "", "    ")
			value = string(b)
		}
		formattedResponse[key] = value
	}
	return formattedResponse
}

func CreateFolder(folderPath string) error {
	log.Info().Str("path", folderPath).Msg("create folder")
	err := os.MkdirAll(folderPath, os.ModePerm)
	if err != nil {
		log.Error().Err(err).Msg("create folder failed")
		return err
	}
	return nil
}

func CreateFile(filePath string, data string) error {
	log.Info().Str("path", filePath).Msg("create file")
	err := os.WriteFile(filePath, []byte(data), 0o644)
	if err != nil {
		log.Error().Err(err).Msg("create file failed")
		return err
	}
	return nil
}

// IsPathExists returns true if path exists, whether path is file or dir
func IsPathExists(path string) bool {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return false
	}
	return true
}

// IsFilePathExists returns true if path exists and path is file
func IsFilePathExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		// path not exists
		return false
	}

	// path exists
	if info.IsDir() {
		// path is dir, not file
		return false
	}
	return true
}

// IsFolderPathExists returns true if path exists and path is folder
func IsFolderPathExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		// path not exists
		return false
	}

	// path exists and is dir
	return info.IsDir()
}

func EnsureFolderExists(folderPath string) error {
	if !IsPathExists(folderPath) {
		err := CreateFolder(folderPath)
		return err
	} else if IsFilePathExists(folderPath) {
		return fmt.Errorf("path %v should be directory", folderPath)
	}
	return nil
}

func Contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

func GetRandomNumber(min, max int) int {
	if min > max {
		return 0
	}
	r := rand.Intn(max - min + 1)
	return min + r
}

func Interface2Float64(i interface{}) (float64, error) {
	switch v := i.(type) {
	case int:
		return float64(v), nil
	case int32:
		return float64(v), nil
	case int64:
		return float64(v), nil
	case float32:
		return float64(v), nil
	case float64:
		return v, nil
	case string: // e.g. "1", "0.5"
		floatVar, err := strconv.ParseFloat(v, 64)
		if err != nil {
			log.Error().Err(err).Str("value", v).
				Msg("convert string to float64 failed")
			return 0, err
		}
		return floatVar, nil
	}
	// json.Number
	value, ok := i.(builtinJSON.Number)
	if ok {
		return value.Float64()
	}

	// Log error for unsupported types
	log.Error().Interface("value", i).Type("type", i).
		Msg("convert float64 failed")
	return 0, errors.New("failed to convert interface to float64")
}

func TypeNormalization(raw interface{}) interface{} {
	switch v := raw.(type) {
	case int, int8, int16, int32, int64:
		return reflect.ValueOf(v).Int()
	case uint, uint8, uint16, uint32, uint64:
		return reflect.ValueOf(v).Uint()
	case float32, float64:
		return reflect.ValueOf(v).Float()
	default:
		return raw
	}
}

func InterfaceType(raw interface{}) string {
	if raw == nil {
		return ""
	}
	return reflect.TypeOf(raw).String()
}

func LoadFile(path string) ([]byte, error) {
	var err error
	path, err = filepath.Abs(path)
	if err != nil {
		log.Error().Err(err).Str("path", path).Msg("convert absolute path failed")
		return nil, errors.Wrap(code.LoadFileError, err.Error())
	}

	file, err := os.ReadFile(path)
	if err != nil {
		log.Error().Err(err).Msg("read file failed")
		return nil, errors.Wrap(code.LoadFileError, err.Error())
	}
	return file, nil
}

func loadFromCSV(path string) []map[string]interface{} {
	log.Info().Str("path", path).Msg("load csv file")
	file, err := os.ReadFile(path)
	if err != nil {
		log.Error().Err(err).Msg("read csv file failed")
		os.Exit(code.GetErrorCode(err))
	}

	r := csv.NewReader(strings.NewReader(string(file)))
	content, err := r.ReadAll()
	if err != nil {
		log.Error().Err(err).Msg("parse csv file failed")
		os.Exit(code.GetErrorCode(err))
	}
	firstLine := content[0] // parameter names
	var result []map[string]interface{}
	for i := 1; i < len(content); i++ {
		row := make(map[string]interface{})
		for j := 0; j < len(content[i]); j++ {
			row[firstLine[j]] = content[i][j]
		}
		result = append(result, row)
	}
	return result
}

func loadMessage(path string) []byte {
	log.Info().Str("path", path).Msg("load message file")
	file, err := os.ReadFile(path)
	if err != nil {
		log.Error().Err(err).Msg("read message file failed")
		os.Exit(code.GetErrorCode(err))
	}
	return file
}

func GetFileNameWithoutExtension(path string) string {
	base := filepath.Base(path)
	ext := filepath.Ext(base)
	return base[0 : len(base)-len(ext)]
}

func sha256HMAC(key []byte, data []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(data)
	return []byte(fmt.Sprintf("%x", mac.Sum(nil)))
}

// ver: auth-v1 or auth-v2
func Sign(ver string, ak string, sk string, body []byte) string {
	expiration := 1800
	signKeyInfo := fmt.Sprintf("%s/%s/%d/%d", ver, ak, time.Now().Unix(), expiration)
	signKey := sha256HMAC([]byte(sk), []byte(signKeyInfo))
	signResult := sha256HMAC(signKey, body)
	return fmt.Sprintf("%v/%v", signKeyInfo, string(signResult))
}

func GenNameWithTimestamp(tmpl string) string {
	if !strings.Contains(tmpl, "%d") {
		tmpl = tmpl + "_%d"
	}
	return fmt.Sprintf(tmpl, time.Now().Unix())
}

func IsZeroFloat64(f float64) bool {
	threshold := 1e-9
	return math.Abs(f) < threshold
}

func ConvertToFloat64Slice(val interface{}) ([]float64, error) {
	if paramsSlice, ok := val.([]float64); ok {
		return paramsSlice, nil
	}
	paramsSlice, ok := val.([]interface{})
	if !ok {
		return nil, errors.New("val is not slice")
	}

	var err error
	float64Slice := make([]float64, len(paramsSlice))
	for i, v := range paramsSlice {
		float64Slice[i], err = Interface2Float64(v)
		if err != nil {
			return nil, err
		}
	}
	return float64Slice, nil
}

func ConvertToStringSlice(val interface{}) ([]string, error) {
	paramsSlice, ok := val.([]interface{})
	if !ok {
		return nil, errors.New("val is not slice")
	}

	stringSlice := make([]string, len(paramsSlice))
	for i, v := range paramsSlice {
		stringSlice[i], ok = v.(string)
		if !ok {
			return nil, errors.New("val is not string slice")
		}
	}
	return stringSlice, nil
}

// RoundToOneDecimal rounds a float64 value to 1 decimal place
func RoundToOneDecimal(val float64) float64 {
	return math.Round(val*10) / 10.0
}

func GetFreePort() (int, error) {
	minPort := 20000
	maxPort := 50000
	for i := 0; i < 10; i++ {
		port := rand.Intn(maxPort-minPort+1) + minPort
		addr := fmt.Sprintf("0.0.0.0:%d", port)
		l, err := net.Listen("tcp", addr)
		if err == nil {
			defer l.Close() // 端口成功绑定后立即释放，返回该端口号
			return port, nil
		}
	}
	return 0, errors.New("failed to get available port")
}

func GetCurrentDay() string {
	now := time.Now()
	// 格式化日期为 yyyyMMdd
	formattedDate := now.Format("20060102")
	return formattedDate
}

func FileExists(filepath string) bool {
	_, err := os.Stat(filepath)
	if os.IsNotExist(err) {
		return false // 文件不存在
	}
	return err == nil // 文件存在，且没有其他错误
}

func RunCommand(cmdName string, args ...string) error {
	cmd := exec.Command(cmdName, args...)
	log.Info().Str("command", cmd.String()).Msg("exec command")

	// print stderr output
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	var stdout bytes.Buffer
	cmd.Stdout = &stdout

	if err := cmd.Run(); err != nil {
		stderrStr := stderr.String()
		log.Error().Err(err).Msg("failed to exec command
```

### Core Architecture Module: `pkg/gadb/utils.go`
```
package gadb

import (
	"net"
)

func DisableTimeWait(conn *net.TCPConn) error {
	return conn.SetLinger(0)
}

```

### Core Architecture Module: `uixt/ai/utils.go`
```
package ai

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
	"github.com/rs/zerolog/log"

	"github.com/httprunner/httprunner/v5/internal/json"
	"github.com/httprunner/httprunner/v5/uixt/option"
	"github.com/pkg/errors"
)

// PlanningJSONResponse represents the JSON response structure for planning
type PlanningJSONResponse struct {
	Actions []Action `json:"actions"`
	Thought string   `json:"thought"`
	Error   string   `json:"error"`
}

// parseStructuredResponse parses model response into structured format with error recovery
func parseStructuredResponse(content string, result interface{}) error {
	// Clean and validate UTF-8 content first
	cleanContent := sanitizeUTF8Content(content)

	// Extract JSON content from response
	jsonContent := extractJSONFromContent(cleanContent)
	if jsonContent == "" {
		// If JSON extraction failed, try parsing the content directly as a fallback
		jsonContent = cleanContent
	}

	// Parse JSON response with error recovery
	return parseJSONWithFallback(jsonContent, result)
}

// sanitizeUTF8Content cleans invalid UTF-8 characters from content
func sanitizeUTF8Content(content string) string {
	if utf8.ValidString(content) {
		return content
	}

	// Convert to bytes and filter out invalid UTF-8 sequences
	bytes := []byte(content)
	var validBytes []byte

	for len(bytes) > 0 {
		r, size := utf8.DecodeRune(bytes)
		if r != utf8.RuneError {
			// Valid rune, keep it
			validBytes = append(validBytes, bytes[:size]...)
		}
		// Skip invalid bytes (including RuneError)
		bytes = bytes[size:]
	}

	return string(validBytes)
}

// extractJSONFromContent extracts JSON content from various formats in the response
// This function handles multiple formats:
// 1. ```json ... ``` markdown code blocks
// 2. ``` ... ``` generic code blocks
// 3. JSON objects embedded in text
// 4. Plain JSON content
func extractJSONFromContent(content string) string {
	content = strings.TrimSpace(content)

	// Case 1: Content wrapped in ```json ... ```
	if strings.Contains(content, "```json") {
		start := strings.Index(content, "```json")
		if start != -1 {
			start += 7 // length of "```json"
			end := strings.Index(content[start:], "```")
			if end != -1 {
				jsonContent := strings.TrimSpace(content[start : start+end])
				return jsonContent
			}
		}
	}

	// Case 2: Content wrapped in ``` ... ``` (without json specifier)
	if strings.HasPrefix(content, "```") && strings.HasSuffix(content, "```") {
		lines := strings.Split(content, "\n")
		if len(lines) >= 3 {
			// Remove first and last lines (the ``` markers)
			jsonLines := lines[1 : len(lines)-1]
			jsonContent := strings.Join(jsonLines, "\n")
			jsonContent = strings.TrimSpace(jsonContent)
			// Check if it looks like JSON
			if strings.HasPrefix(jsonContent, "{") && strings.HasSuffix(jsonContent, "}") {
				return jsonContent
			}
		}
	}

	// Case 3: Look for JSON object in the content using rune-based brace counting (most reliable method)
	start := strings.Index(content, "{")
	if start != -1 {
		// Find the matching closing brace using rune-based iteration to handle UTF-8 properly
		braceCount := 0
		inString := false
		escaped := false

		// Use byte-based iteration but track string state properly
		for i := start; i < len(content); {
			r, size := utf8.DecodeRuneInString(content[i:])

			if escaped {
				escaped = false
				i += size
				continue
			}

			if r == '\\' && inString {
				escaped = true
				i += size
				continue
			}

			if r == '"' {
				inString = !inString
				i += size
				continue
			}

			if !inString {
				if r == '{' {
					braceCount++
				} else if r == '}' {
					braceCount--
					if braceCount == 0 {
						jsonContent := strings.TrimSpace(content[start : i+size])
						return jsonContent
					}
				}
			}
			i += size
		}
	}

	// Case 4: Try regex approach for markdown-like formats (fallback)
	jsonRegex := regexp.MustCompile(`(?:json)?\s*({[\s\S]*?})\s*`)
	matches := jsonRegex.FindStringSubmatch(content)
	if len(matches) > 1 {
		return strings.TrimSpace(matches[1])
	}

	// Case 5: If content itself looks like JSON
	if strings.HasPrefix(content, "{") && strings.HasSuffix(content, "}") {
		return content
	}

	return ""
}

// parseJSONWithFallback attempts to parse JSON with multiple strategies for any struct type
func parseJSONWithFallback(jsonContent string, result interface{}) error {
	// Strategy 1: Direct JSON unmarshaling
	if err := json.Unmarshal([]byte(jsonContent), result); err == nil {
		// For specific types, ensure required fields have default values even after successful parsing
		switch v := result.(type) {
		case *QueryResult:
			// Ensure QueryResult has meaningful defaults for empty fields
			if v.Content == "" && v.Thought == "" {
				v.Content = "Empty response content"
				v.Thought = "No content extracted from response"
			} else if v.Content == "" {
				v.Content = "No content extracted"
			} else if v.Thought == "" {
				v.Thought = "Successfully parsed structured response"
			}
		case *AssertionResult:
			// Ensure AssertionResult has meaningful defaults
			if v.Thought == "" {
				v.Thought = "Successfully parsed assertion response"
			}
		}
		return nil
	}

	// Strategy 2: Try cleaning JSON content and parse again
	cleanedJSON := cleanJSONContent(jsonContent)
	if err := json.Unmarshal([]byte(cleanedJSON), result); err == nil {
		// Apply the same default value logic for cleaned JSON
		switch v := result.(type) {
		case *QueryResult:
			if v.Content == "" && v.Thought == "" {
				v.Content = "Empty response content"
				v.Thought = "No content extracted from response"
			} else if v.Content == "" {
				v.Content = "No content extracted"
			} else if v.Thought == "" {
				v.Thought = "Successfully parsed structured response"
			}
		case *AssertionResult:
			if v.Thought == "" {
				v.Thought = "Successfully parsed assertion response"
			}
		}
		return nil
	}

	// Strategy 3: For specific types, try manual extraction or content analysis
	switch v := result.(type) {
	case *AssertionResult:
		if fallbackResult, err := extractAssertionFieldsManually(jsonContent); err == nil {
			*v = *fallbackResult
			return nil
		}
		// Final fallback for assertions: content analysis
		*v = *analyzeContentForAssertion(jsonContent)
		return nil

	case *QueryResult:
		// For QueryResult, try basic field extraction
		if fallbackResult, err := extractQueryFieldsManually(jsonContent); err == nil {
			*v = *fallbackResult
			return nil
		}
		// Fallback to treating content as plain text
		*v = QueryResult{
			Content: jsonContent,
			Thought: "Failed to parse as JSON, returning raw content",
		}
		return nil

	case *PlanningJSONResponse:
		// For PlanningJSONResponse, try basic field extraction
		if fallbackResult, err := extractPlanningFieldsManually(jsonContent); err == nil {
			*v = *fallbackResult
			return nil
		}
		// Fallback with empty actions but preserve any recognizable thought content
		*v = PlanningJSONResponse{
			Actions: []Action{},
			Thought: "Failed to parse structured response",
			Error:   "JSON parsing failed, returning minimal structure",
		}
		return nil
	}

	return errors.New("failed to parse JSON with all strategies")
}

// extractAssertionFieldsManually extracts pass and thought fields from text
func extractAssertionFieldsManually(content string) (*AssertionResult, error) {
	result := &AssertionResult{}

	// Try to extract "pass" field
	if strings.Contains(strings.ToLower(content), `"pass":true`) ||
		strings.Contains(strings.ToLower(content), `"pass": true`) {
		result.Pass = true
	} else if strings.Contains(strings.ToLower(content), `"pass":false`) ||
		strings.Contains(strings.ToLower(content), `"pass": false`) {
		result.Pass = false
	} else {
		return nil, errors.New("cannot extract pass field")
	}

	// Try to extract "thought" field
	thoughtStart := strings.Index(content, `"thought"`)
	if thoughtStart != -1 {
		thoughtSection := content[thoughtStart:]
		colonIndex := strings.Index(thoughtSection, ":")
		if colonIndex != -1 {
			afterColon := strings.TrimSpace(thoughtSection[colonIndex+1:])
			if strings.HasPrefix(afterColon, `"`) {
				// Find the matching closing quote, handling escaped quotes
				thoughtContent := extractQuotedString(afterColon)
				result.Thought = thoughtContent
			}
		}
	}

	return result, nil
}

// extractQuotedString extracts content from a quoted string, handling escaped quotes
func extractQuotedString(s string) string {
	if !strings.HasPrefix(s, `"`) {
		return ""
	}

	s = s[1:] // Remove opening quote
	var result strings.Builder
	escaped := false

	for _, r := range s {
		if escaped {
			result.WriteRune(r)
			escaped = false
			continue
		}

		if r == '\\' {
			escaped = true
			continue
		}

		if r == '"' {
			// Found closing quote
			return result.String()
		}

		result.WriteRune(r)
	}

	return result.String()
}

// cleanJSONContent removes common JSON formatting issues
func cleanJSONContent(content string) string {
	// Remove any non-printable characters
	cleaned := strings.Map(func(r rune) rune {
		if r >= 32 && r < 127 || r > 127 { // Keep printable ASCII and Unicode
			return r
		}
		return -1 // Remove non-printable characters
	}, content)

	// Remove any trailing commas before closing braces/brackets
	cleaned = strings.ReplaceAll(cleaned, ",}", "}")
	cleaned = strings.ReplaceAll(cleaned, ",]", "]")

	return cleaned
}

// analyzeContentForAssertion creates a fallback result by analyzing content
func analyzeContentForAssertion(content string) *AssertionResult {
	content = strings.ToLower(content)

	// Simple heuristic: look for positive/negative indicators
	positiveIndicators := []string{"true", "pass", "success", "correct", "valid", "match"}
	negativeIndicators := []string{"false", "fail", "error", "incorrect", "invalid", "mismatch"}

	positiveCount := 0
	negativeCount := 0

	for _, indicator := range positiveIndicators {
		if strings.Contains(content, indicato
```

### Core Architecture Module: `uixt/driver_utils.go`
```
package uixt

import (
	"bytes"
	"context"
	"crypto/md5"
	"crypto/tls"
	"fmt"
	"io"
	"math/rand/v2"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/pkg/errors"
	"github.com/rs/zerolog/log"

	"github.com/httprunner/httprunner/v5/code"
	"github.com/httprunner/httprunner/v5/internal/builtin"
	"github.com/httprunner/httprunner/v5/internal/config"
	"github.com/httprunner/httprunner/v5/internal/json"
	"github.com/httprunner/httprunner/v5/uixt/option"
)

func convertToAbsoluteScope(driver IDriver, opts ...option.ActionOption) []option.ActionOption {
	actionOptions := option.NewActionOptions(opts...)

	// convert relative scope to absolute scope
	if len(actionOptions.AbsScope) != 4 && len(actionOptions.Scope) == 4 {
		scope := actionOptions.Scope
		x1, y1, x2, y2, err := convertToAbsoluteCoordinates(
			driver, scope[0], scope[1], scope[2], scope[3])
		if err != nil {
			log.Error().Err(err).Msg("convert absolute scope failed")
			return opts
		}
		actionOptions.AbsScope = []int{int(x1), int(y1), int(x2), int(y2)}
	}

	return actionOptions.Options()
}

func convertToAbsolutePoint(driver IDriver, x, y float64) (absX, absY float64, err error) {
	// absolute coordinates
	if x > 1 || y > 1 {
		return x, y, nil
	}

	// relative coordinates
	if assertRelative(x) && assertRelative(y) {
		windowSize, err := driver.WindowSize()
		if err != nil {
			err = errors.Wrap(code.DeviceGetInfoError, err.Error())
			return 0, 0, err
		}

		absX = builtin.RoundToOneDecimal(float64(windowSize.Width) * x)
		absY = builtin.RoundToOneDecimal(float64(windowSize.Height) * y)
		return absX, absY, nil
	}

	// invalid coordinates
	err = errors.Wrap(code.InvalidCaseError,
		fmt.Sprintf("invalid coordinates x(%f), y(%f)", x, y))
	return
}

func convertToAbsoluteCoordinates(driver IDriver, fromX, fromY, toX, toY float64) (
	absFromX, absFromY, absToX, absToY float64, err error,
) {
	// absolute coordinates
	if fromX > 1 || toX > 1 || fromY > 1 || toY > 1 {
		return fromX, fromY, toX, toY, nil
	}

	// relative coordinates
	if assertRelative(fromX) && assertRelative(fromY) &&
		assertRelative(toX) && assertRelative(toY) {
		windowSize, err := driver.WindowSize()
		if err != nil {
			err = errors.Wrap(code.DeviceGetInfoError, err.Error())
			return 0, 0, 0, 0, err
		}
		width := windowSize.Width
		height := windowSize.Height

		absFromX = float64(width) * fromX
		absFromY = float64(height) * fromY
		absToX = float64(width) * toX
		absToY = float64(height) * toY

		return absFromX, absFromY, absToX, absToY, nil
	}

	// invalid coordinates
	err = errors.Wrap(code.InvalidCaseError,
		fmt.Sprintf("invalid coordinates fromX(%f), fromY(%f), toX(%f), toY(%f)",
			fromX, fromY, toX, toY))
	return
}

func assertRelative(p float64) bool {
	return p >= 0 && p <= 1
}

func (dExt *XTDriver) Setup() error {
	// unlock device screen
	err := dExt.Unlock()
	if err != nil {
		log.Error().Err(err).Msg("unlock device screen failed")
		return err
	}

	return nil
}

func (dExt *XTDriver) assertOCR(text, assert string) error {
	var opts []option.ActionOption
	opts = append(opts, option.WithScreenShotFileName(fmt.Sprintf("assert_ocr_%s", text)))

	switch assert {
	case option.AssertionEqual:
		_, err := dExt.FindScreenText(text, opts...)
		if err != nil {
			return errors.Wrap(err, "assert ocr equal failed")
		}
	case option.AssertionNotEqual:
		_, err := dExt.FindScreenText(text, opts...)
		if err == nil {
			return errors.New("assert ocr not equal failed")
		}
	case option.AssertionExists:
		opts = append(opts, option.WithRegex(true))
		_, err := dExt.FindScreenText(text, opts...)
		if err != nil {
			return errors.Wrap(err, "assert ocr exists failed")
		}
	case option.AssertionNotExists:
		opts = append(opts, option.WithRegex(true))
		_, err := dExt.FindScreenText(text, opts...)
		if err == nil {
			return errors.New("assert ocr not exists failed")
		}
	default:
		return fmt.Errorf("unexpected assert method %s", assert)
	}
	return nil
}

func (dExt *XTDriver) assertForegroundApp(appName, assert string) error {
	app, err := dExt.ForegroundInfo()
	if err != nil {
		log.Warn().Err(err).Msg("get foreground app failed, skip app assertion")
		return nil // Notice: ignore error when get foreground app failed
	}

	switch assert {
	case option.AssertionEqual:
		if app.PackageName != appName {
			return errors.Wrap(err, "assert foreground app equal failed")
		}
	case option.AssertionNotEqual:
		if app.PackageName == appName {
			return errors.New("assert foreground app not equal failed")
		}
	default:
		return fmt.Errorf("unexpected assert method %s", assert)
	}
	return nil
}

func (dExt *XTDriver) assertSelector(selector, assert string) error {
	driver, ok := dExt.IDriver.(*BrowserDriver)
	if !ok {
		return errors.New("assert selector only supports browser driver")
	}
	switch assert {
	case option.AssertionExists:
		_, err := driver.IsElementExistBySelector(selector)
		if err != nil {
			return errors.Wrap(err, "assert ocr exists failed")
		}
	case option.AssertionNotExists:
		_, err := driver.IsElementExistBySelector(selector)
		if err == nil {
			return errors.New("assert ocr not exists failed")
		}
	default:
		return fmt.Errorf("unexpected assert method %s", assert)
	}
	return nil
}

func (dExt *XTDriver) DoValidation(check, assert, expected string, message ...string) (aiResult *AIExecutionResult, err error) {
	switch check {
	case option.SelectorOCR:
		err = dExt.assertOCR(expected, assert)
	case option.SelectorAI:
		aiResult, err = dExt.AIAssert(expected)
	case option.SelectorForegroundApp:
		err = dExt.assertForegroundApp(expected, assert)
	case option.SelectorSelector:
		err = dExt.assertSelector(expected, assert)
	default:
		return nil, fmt.Errorf("validator %s not implemented", check)
	}

	if err != nil {
		// Technical error (not assertion failure)
		if message == nil {
			message = []string{""}
		}
		log.Error().Err(err).Str("assert", assert).Str("expect", expected).
			Str("msg", message[0]).Msg("validate failed")
		return nil, err
	} else if aiResult != nil {
		// Check assertion result instead of relying on error
		if !aiResult.AssertionResult.Pass {
			return aiResult, errors.New(aiResult.AssertionResult.Thought)
		}
		log.Info().Str("check", check).Str("assert", assert).
			Str("expect", expected).
			Interface("ai_assertion_result", aiResult.AssertionResult).
			Msg("ai assertion passed")
		return aiResult, nil
	} else {
		log.Info().Str("check", check).Str("assert", assert).
			Str("expect", expected).Msg("validate success")
		return nil, nil
	}
}

type SleepConfig struct {
	StartTime    time.Time `json:"start_time"`
	Seconds      float64   `json:"seconds,omitempty"`
	Milliseconds int64     `json:"milliseconds,omitempty"`
}

// getSimulationDuration returns simulation duration by given params (in seconds)
func getSimulationDuration(params []float64) (milliseconds int64) {
	if len(params) == 1 {
		// given constant duration time
		return int64(params[0] * 1000)
	}

	if len(params) == 2 {
		// given [min, max], missing weight
		// append default weight 1
		params = append(params, 1.0)
	}

	var sections []struct {
		min, max, weight float64
	}
	totalProb := 0.0
	for i := 0; i+3 <= len(params); i += 3 {
		min := params[i]
		max := params[i+1]
		weight := params[i+2]
		totalProb += weight
		sections = append(sections,
			struct{ min, max, weight float64 }{min, max, weight},
		)
	}

	if totalProb == 0 {
		log.Warn().Msg("total weight is 0, skip simulation")
		return 0
	}

	r := rand.Float64()
	accProb := 0.0
	for _, s := range sections {
		accProb += s.weight / totalProb
		if r < accProb {
			milliseconds := int64((s.min + rand.Float64()*(s.max-s.min)) * 1000)
			log.Info().Int64("random(ms)", milliseconds).
				Interface("strategy_params", params).Msg("get simulation duration")
			return milliseconds
		}
	}

	log.Warn().Interface("strategy_params", params).
		Msg("get simulation duration failed, skip simulation")
	return 0
}

// sleepStrict sleeps for strict duration with optional start time correction
// If startTime is zero, acts as normal context-aware sleep
// If startTime is provided, corrects sleep duration by subtracting elapsed time
// ctx allows for cancellation during sleep
func sleepStrict(ctx context.Context, startTime time.Time, strictMilliseconds int64) {
	var elapsed int64
	if !startTime.IsZero() {
		elapsed = time.Since(startTime).Milliseconds()
	}
	dur := strictMilliseconds - elapsed

	// if elapsed time is greater than given duration, skip sleep to reduce deviation caused by process time
	if dur <= 0 {
		log.Warn().
			Int64("elapsed(ms)", elapsed).
			Int64("strictSleep(ms)", strictMilliseconds).
			Msg("elapsed >= simulation duration, skip sleep")
		return
	}

	log.Info().Int64("sleepDuration(ms)", dur).
		Int64("elapsed(ms)", elapsed).
		Int64("strictSleep(ms)", strictMilliseconds).
		Msg("sleep remaining duration time")

	// Use context-aware sleep instead of blocking time.Sleep
	select {
	case <-time.After(time.Duration(dur) * time.Millisecond):
		// Normal completion
		log.Debug().Int64("duration_ms", dur).Msg("strict sleep completed normally")
	case <-ctx.Done():
		// Interrupted by context cancellation (e.g., CTRL+C)
		log.Info().Int64("planned_duration_ms", dur).
			Msg("strict sleep interrupted by context cancellation")
		return
	}
}

// global file lock
var (
	fileLocks sync.Map
)

func DownloadFileByUrl(fileUrl string) (filePath string, err error) {
	hash := md5.Sum([]byte(fileUrl))
	fileName := fmt.Sprintf("%x", hash)
	filePath = filepath.Join(config.GetConfig().DownloadsPath(), fileName)

	// get or create file lock
	lockI, _ := fileLocks.LoadOrStore(filePath, &sync.Mutex{})
	lock := lockI.(*sync.Mutex)
	lock.Lock()
	defer lock.Unlock()

	if builtin.FileExists(filePath) {
		return filePath, nil
	}

	log.Info().Str("fileUrl", fileUrl).Str("filePath", filePath).Msg("downloading file")

	// Create an HTTP client with default settings.
	client := &http.Client{}

	// Build the HTTP GET request.
	req, err :=
```

### Core Architecture Module: `uixt/image_utils.go`
```
package uixt

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
)

// DetectAndRenameImageFile examines the file content to determine its media type
// and renames the file with the appropriate extension (.jpg, .png, .mp4, etc.)
func DetectAndRenameMediaFile(filePath string) (string, error) {
	// Open the file
	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open file for type detection: %v", err)
	}
	defer file.Close()

	// Read the first 512 bytes to detect content type
	buffer := make([]byte, 512)
	_, err = file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", fmt.Errorf("failed to read file for type detection: %v", err)
	}

	// Reset file pointer
	_, err = file.Seek(0, 0)
	if err != nil {
		return "", fmt.Errorf("failed to reset file pointer: %v", err)
	}

	// Detect content type
	contentType := http.DetectContentType(buffer)
	log.Info().Str("filePath", filePath).Str("contentType", contentType).Msg("Detected content type")

	// Determine file extension based on content type
	var extension string
	switch {
	// Image types
	case strings.Contains(contentType, "image/jpeg"):
		extension = ".jpg"
	case strings.Contains(contentType, "image/png"):
		extension = ".png"
	case strings.Contains(contentType, "image/gif"):
		extension = ".gif"
	case strings.Contains(contentType, "image/webp"):
		extension = ".webp"
	case strings.Contains(contentType, "image/bmp"):
		extension = ".bmp"
	case strings.Contains(contentType, "image/tiff"):
		extension = ".tiff"
	case strings.Contains(contentType, "image/svg+xml"):
		extension = ".svg"

	// Video types
	case strings.Contains(contentType, "video/mp4"):
		extension = ".mp4"
	case strings.Contains(contentType, "video/quicktime"):
		extension = ".mov"
	case strings.Contains(contentType, "video/x-msvideo"):
		extension = ".avi"
	case strings.Contains(contentType, "video/x-ms-wmv"):
		extension = ".wmv"
	case strings.Contains(contentType, "video/x-flv"):
		extension = ".flv"
	case strings.Contains(contentType, "video/webm"):
		extension = ".webm"
	case strings.Contains(contentType, "video/x-matroska"):
		extension = ".mkv"

	default:
		// Check for general image or video types
		if strings.Contains(contentType, "image/") {
			extension = ".jpg" // Default for unknown image types
		} else if strings.Contains(contentType, "video/") {
			extension = ".mp4" // Default for unknown video types
		} else {
			// Try to determine from original file extension
			origExt := strings.ToLower(filepath.Ext(filePath))
			if origExt == ".mp4" || origExt == ".mov" || origExt == ".avi" ||
				origExt == ".wmv" || origExt == ".flv" || origExt == ".webm" || origExt == ".mkv" {
				extension = origExt
			} else if origExt == ".jpg" || origExt == ".jpeg" || origExt == ".png" ||
				origExt == ".gif" || origExt == ".webp" || origExt == ".bmp" ||
				origExt == ".tiff" || origExt == ".svg" {
				extension = origExt
			} else {
				return filePath, fmt.Errorf("not a recognized media type: %s", contentType)
			}
		}
	}

	// Create new file path with extension
	dir := filepath.Dir(filePath)
	base := filepath.Base(filePath)
	newFilePath := filepath.Join(dir, base+extension)

	// If the file already has the correct extension, just return it
	if filePath == newFilePath {
		return filePath, nil
	}

	// Rename the file
	err = os.Rename(filePath, newFilePath)
	if err != nil {
		return "", fmt.Errorf("failed to rename file: %v", err)
	}

	log.Info().Str("oldPath", filePath).Str("newPath", newFilePath).Msg("Renamed image file with proper extension")
	return newFilePath, nil
}

```

### Core Architecture Module: `uixt/mcp_tools_utility.go`
```
package uixt

import (
	"context"
	"fmt"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/rs/zerolog/log"

	"github.com/httprunner/httprunner/v5/internal/builtin"
	"github.com/httprunner/httprunner/v5/uixt/option"
)

// extractStartTimeMs extracts start_time_ms from MCP request arguments
// Returns time.Time (zero if not provided) and any conversion error
func extractStartTimeMs(request mcp.CallToolRequest) (time.Time, error) {
	startTimeMs, ok := request.GetArguments()["start_time_ms"]
	if !ok || startTimeMs == nil {
		return time.Time{}, nil // Return zero time for normal sleep
	}

	var ms int64
	switch v := startTimeMs.(type) {
	case float64:
		ms = int64(v)
	case int64:
		ms = v
	case int:
		ms = int64(v)
	default:
		return time.Time{}, fmt.Errorf("invalid start_time_ms type: %T", v)
	}

	return time.UnixMilli(ms), nil
}

type ToolSleep struct {
	// Return data fields - these define the structure of data returned by this tool
	Seconds  float64 `json:"seconds" desc:"Duration in seconds that was slept"`
	Duration string  `json:"duration" desc:"Human-readable duration string"`
}

func (t *ToolSleep) Name() option.ActionName {
	return option.ACTION_Sleep
}

func (t *ToolSleep) Description() string {
	return "Sleep for a specified number of seconds"
}

func (t *ToolSleep) Options() []mcp.ToolOption {
	return []mcp.ToolOption{
		mcp.WithNumber("seconds", mcp.Description("Number of seconds to sleep")),
		mcp.WithNumber("start_time_ms", mcp.Description("Start time as Unix milliseconds for strict sleep calculation")),
	}
}

func (t *ToolSleep) Implement() server.ToolHandlerFunc {
	return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		seconds, ok := request.GetArguments()["seconds"]
		if !ok {
			log.Warn().Msg("seconds parameter is required, using default value 5.0 seconds")
			seconds = 5.0
		}

		// Sleep action logic
		log.Info().Interface("seconds", seconds).Msg("sleeping")

		// Use Interface2Float64 for unified type conversion
		actualSeconds, err := builtin.Interface2Float64(seconds)
		if err != nil {
			return nil, fmt.Errorf("invalid sleep duration: %v", seconds)
		}
		duration := time.Duration(actualSeconds) * time.Second

		// Extract start_time_ms and use sleepStrict for unified sleep logic
		startTime, err := extractStartTimeMs(request)
		if err != nil {
			return nil, err
		}

		milliseconds := int64(actualSeconds * 1000)
		sleepStrict(ctx, startTime, milliseconds)

		message := fmt.Sprintf("Successfully slept for %v seconds", actualSeconds)
		returnData := ToolSleep{
			Seconds:  actualSeconds,
			Duration: duration.String(),
		}

		return NewMCPSuccessResponse(message, &returnData), nil
	}
}

func (t *ToolSleep) ConvertActionToCallToolRequest(action option.MobileAction) (mcp.CallToolRequest, error) {
	arguments := map[string]any{}

	var seconds float64
	if sleepConfig, ok := action.Params.(SleepConfig); ok {
		// When startTime is provided, pass both seconds and startTime
		seconds = sleepConfig.Seconds
		arguments["seconds"] = seconds
		arguments["start_time_ms"] = sleepConfig.StartTime.UnixMilli()
	} else {
		// Use builtin.Interface2Float64 for unified parameter handling
		var err error
		seconds, err = builtin.Interface2Float64(action.Params)
		if err != nil {
			return mcp.CallToolRequest{}, fmt.Errorf("invalid sleep params: %v", action.Params)
		}
		arguments["seconds"] = seconds
	}

	return BuildMCPCallToolRequest(t.Name(), arguments, action), nil
}

// ToolSleepMS implements the sleep_ms tool call.
type ToolSleepMS struct {
	// Return data fields - these define the structure of data returned by this tool
	Milliseconds int64  `json:"milliseconds" desc:"Duration in milliseconds that was slept"`
	Duration     string `json:"duration" desc:"Human-readable duration string"`
}

func (t *ToolSleepMS) Name() option.ActionName {
	return option.ACTION_SleepMS
}

func (t *ToolSleepMS) Description() string {
	return "Sleep for specified milliseconds"
}

func (t *ToolSleepMS) Options() []mcp.ToolOption {
	return []mcp.ToolOption{
		mcp.WithNumber("milliseconds", mcp.Description("Number of milliseconds to sleep")),
		mcp.WithNumber("start_time_ms", mcp.Description("Start time as Unix milliseconds for strict sleep calculation")),
	}
}

func (t *ToolSleepMS) Implement() server.ToolHandlerFunc {
	return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		milliseconds, ok := request.GetArguments()["milliseconds"]
		if !ok {
			log.Warn().Msg("milliseconds parameter is required, using default value 1000 milliseconds")
			milliseconds = 1000
		}

		// Sleep MS action logic
		log.Info().Interface("milliseconds", milliseconds).Msg("sleeping in milliseconds")

		// Use Interface2Float64 for unified type conversion, then convert to int64
		floatVal, err := builtin.Interface2Float64(milliseconds)
		if err != nil {
			return nil, fmt.Errorf("invalid sleep duration: %v", milliseconds)
		}
		actualMilliseconds := int64(floatVal)
		duration := time.Duration(actualMilliseconds) * time.Millisecond

		// Extract start_time_ms and use sleepStrict for unified sleep logic
		startTime, err := extractStartTimeMs(request)
		if err != nil {
			return nil, err
		}

		sleepStrict(ctx, startTime, actualMilliseconds)

		message := fmt.Sprintf("Successfully slept for %d milliseconds", actualMilliseconds)
		returnData := ToolSleepMS{
			Milliseconds: actualMilliseconds,
			Duration:     duration.String(),
		}

		return NewMCPSuccessResponse(message, &returnData), nil
	}
}

func (t *ToolSleepMS) ConvertActionToCallToolRequest(action option.MobileAction) (mcp.CallToolRequest, error) {
	arguments := map[string]any{}

	var milliseconds int64
	if sleepConfig, ok := action.Params.(SleepConfig); ok {
		// When startTime is provided, pass both milliseconds and startTime
		milliseconds = sleepConfig.Milliseconds
		arguments["milliseconds"] = milliseconds
		arguments["start_time_ms"] = sleepConfig.StartTime.UnixMilli()
	} else {
		// Use builtin.Interface2Float64 for unified parameter handling, then convert to int64
		floatVal, err := builtin.Interface2Float64(action.Params)
		if err != nil {
			return mcp.CallToolRequest{}, fmt.Errorf("invalid sleep ms params: %v", action.Params)
		}
		milliseconds = int64(floatVal)
		arguments["milliseconds"] = milliseconds
	}

	return BuildMCPCallToolRequest(t.Name(), arguments, action), nil
}

// ToolSleepRandom implements the sleep_random tool call.
type ToolSleepRandom struct {
	// Return data fields - these define the structure of data returned by this tool
	Params []float64 `json:"params" desc:"Random sleep parameters used"`
}

func (t *ToolSleepRandom) Name() option.ActionName {
	return option.ACTION_SleepRandom
}

func (t *ToolSleepRandom) Description() string {
	return "Sleep for a random duration based on parameters"
}

func (t *ToolSleepRandom) Options() []mcp.ToolOption {
	unifiedReq := &option.ActionOptions{}
	return unifiedReq.GetMCPOptions(option.ACTION_SleepRandom)
}

func (t *ToolSleepRandom) Implement() server.ToolHandlerFunc {
	return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		unifiedReq, err := parseActionOptions(request.GetArguments())
		if err != nil {
			return nil, err
		}

		// Sleep random action logic with context support
		sleepStrict(ctx, time.Now(), getSimulationDuration(unifiedReq.Params))

		message := fmt.Sprintf("Successfully slept for random duration with params: %v", unifiedReq.Params)
		returnData := ToolSleepRandom{Params: unifiedReq.Params}

		return NewMCPSuccessResponse(message, &returnData), nil
	}
}

func (t *ToolSleepRandom) ConvertActionToCallToolRequest(action option.MobileAction) (mcp.CallToolRequest, error) {
	if params, err := builtin.ConvertToFloat64Slice(action.Params); err == nil {
		arguments := map[string]any{
			"params": params,
		}
		return BuildMCPCallToolRequest(t.Name(), arguments, action), nil
	}
	return mcp.CallToolRequest{}, fmt.Errorf("invalid sleep random params: %v", action.Params)
}

// ToolClosePopups implements the close_popups tool call.
type ToolClosePopups struct { // Return data fields - these define the structure of data returned by this tool
}

func (t *ToolClosePopups) Name() option.ActionName {
	return option.ACTION_ClosePopups
}

func (t *ToolClosePopups) Description() string {
	return "Close any popup windows or dialogs on screen"
}

func (t *ToolClosePopups) Options() []mcp.ToolOption {
	unifiedReq := &option.ActionOptions{}
	return unifiedReq.GetMCPOptions(option.ACTION_ClosePopups)
}

func (t *ToolClosePopups) Implement() server.ToolHandlerFunc {
	return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		driverExt, err := setupXTDriver(ctx, request.GetArguments())
		if err != nil {
			return nil, fmt.Errorf("setup driver failed: %w", err)
		}

		// Close popups action logic
		err = driverExt.ClosePopupsHandler()
		if err != nil {
			return NewMCPErrorResponse(fmt.Sprintf("Close popups failed: %s", err.Error())), err
		}

		message := "Successfully closed popups"
		returnData := ToolClosePopups{}

		return NewMCPSuccessResponse(message, &returnData), nil
	}
}

func (t *ToolClosePopups) ConvertActionToCallToolRequest(action option.MobileAction) (mcp.CallToolRequest, error) {
	return BuildMCPCallToolRequest(t.Name(), map[string]any{}, action), nil
}

```

### Core Architecture Module: `cmd/adb/devices.go`
```
package adb

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/httprunner/httprunner/v5/internal/sdk"
	"github.com/httprunner/httprunner/v5/pkg/gadb"
)

var listAndroidDevicesCmd = &cobra.Command{
	Use:   "devices",
	Short: "List all Android devices",
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		startTime := time.Now()
		defer func() {
			sdk.SendGA4Event("hrp_adb_devices", map[string]interface{}{
				"args":                 strings.Join(args, "-"),
				"success":              err == nil,
				"engagement_time_msec": time.Since(startTime).Milliseconds(),
			})
		}()

		deviceList, err := getAndroidDevices()
		if err != nil {
			fmt.Println(err)
			os.Exit(1)
		}

		for _, d := range deviceList {
			fmt.Println(format(d.DeviceInfo()))
		}
		return nil
	},
}

func format(data map[string]string) string {
	result, _ := json.MarshalIndent(data, "", "\t")
	return string(result)
}

func getAndroidDevices() (devices []*gadb.Device, err error) {
	var adbClient gadb.Client
	if adbClient, err = gadb.NewClient(); err != nil {
		return nil, err
	}

	if devices, err = adbClient.DeviceList(); err != nil {
		return nil, err
	}
	return devices, nil
}

func init() {
	CmdAndroidRoot.AddCommand(listAndroidDevicesCmd)
}

```

### Core Architecture Module: `cmd/adb/init.go`
```
package adb

import (
	"github.com/spf13/cobra"

	"github.com/httprunner/httprunner/v5/uixt"
	"github.com/httprunner/httprunner/v5/uixt/option"
)

var serial string

var CmdAndroidRoot = &cobra.Command{
	Use:              "adb",
	Short:            "simple utils for android device management",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {},
}

func getDevice(serial string) (*uixt.AndroidDevice, error) {
	device, err := uixt.NewAndroidDevice(option.WithSerialNumber(serial))
	if err != nil {
		return nil, err
	}
	return device, nil
}

```

### Core Architecture Module: `cmd/adb/install.go`
```
package adb

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/httprunner/httprunner/v5/internal/sdk"
	"github.com/httprunner/httprunner/v5/uixt"
	"github.com/httprunner/httprunner/v5/uixt/option"
)

var (
	replace   bool
	downgrade bool
	grant     bool
)

var installCmd = &cobra.Command{
	Use:   "install [flags] PACKAGE",
	Short: "push package to the device and install them automatically",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		startTime := time.Now()
		defer func() {
			sdk.SendGA4Event("hrp_adb_devices", map[string]interface{}{
				"args":                 strings.Join(args, "-"),
				"success":              err == nil,
				"engagement_time_msec": time.Since(startTime).Milliseconds(),
			})
		}()
		_, err = getDevice(serial)
		if err != nil {
			return err
		}

		device, err := uixt.NewAndroidDevice(option.WithSerialNumber(serial))
		if err != nil {
			fmt.Println(err)
			return err
		}
		driver, err := device.NewDriver()
		if err != nil {
			fmt.Println(err)
			return err
		}

		err = driver.GetDevice().Install(args[0],
			option.WithReinstall(replace),
			option.WithDowngrade(downgrade),
			option.WithGrantPermission(grant),
		)
		if err != nil {
			fmt.Println(err)
			return err
		}
		fmt.Println("success")
		return nil
	},
}

func init() {
	installCmd.Flags().StringVarP(&serial, "serial", "s", "", "filter by device's serial")
	installCmd.Flags().BoolVarP(&replace, "replace", "r", false, "replace existing application")
	installCmd.Flags().BoolVarP(&downgrade, "downgrade", "d", false, "allow version code downgrade (debuggable packages only)")
	installCmd.Flags().BoolVarP(&grant, "grant", "g", false, "grant all runtime permissions")
	CmdAndroidRoot.AddCommand(installCmd)
}

```

### Core Architecture Module: `cmd/adb/screencap.go`
```
package adb

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/httprunner/httprunner/v5/internal/builtin"
	"github.com/httprunner/httprunner/v5/internal/sdk"
)

var screencapAndroidDevicesCmd = &cobra.Command{
	Use:   "screencap",
	Short: "Start android screen capture",
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		startTime := time.Now()
		defer func() {
			sdk.SendGA4Event("hrp_adb_screencap", map[string]interface{}{
				"args":                 strings.Join(args, "-"),
				"success":              err == nil,
				"engagement_time_msec": time.Since(startTime).Milliseconds(),
			})
		}()

		device, err := getDevice(serial)
		if err != nil {
			return err
		}

		res, err := device.ScreenCap()
		if err != nil {
			return err
		}

		filepath := fmt.Sprintf("%s.png", builtin.GenNameWithTimestamp("screencap_%d"))
		if err = os.WriteFile(filepath, res, 0o644); err != nil {
			return err
		}
		fmt.Println("screencap saved to", filepath)
		return nil
	},
}

func init() {
	screencapAndroidDevicesCmd.Flags().StringVarP(&serial, "serial", "s", "", "filter by device's serial")
	CmdAndroidRoot.AddCommand(screencapAndroidDevicesCmd)
}

```

### Core Architecture Module: `cmd/cli/main.go`
```
package main

import (
	"os"
	"time"

	"github.com/getsentry/sentry-go"

	"github.com/httprunner/httprunner/v5/cmd"
	"github.com/httprunner/httprunner/v5/cmd/adb"
	"github.com/httprunner/httprunner/v5/cmd/ios"
	"github.com/httprunner/httprunner/v5/code"
)

func addAllCommands() {
	// adds all child commands to the root command and sets flags appropriately.
	cmd.RootCmd.AddCommand(cmd.CmdBuild)
	cmd.RootCmd.AddCommand(cmd.CmdConvert)
	cmd.RootCmd.AddCommand(cmd.CmdPytest)
	cmd.RootCmd.AddCommand(cmd.CmdReport)
	cmd.RootCmd.AddCommand(cmd.CmdRun)
	cmd.RootCmd.AddCommand(cmd.CmdScaffold)
	cmd.RootCmd.AddCommand(cmd.CmdServer)
	cmd.RootCmd.AddCommand(cmd.CmdWiki)
	cmd.RootCmd.AddCommand(cmd.CmdMCPHost)
	cmd.RootCmd.AddCommand(cmd.CmdMCPServer)

	cmd.RootCmd.AddCommand(ios.CmdIOSRoot)
	cmd.RootCmd.AddCommand(adb.CmdAndroidRoot)
}

func main() {
	defer func() {
		if err := recover(); err != nil {
			// report panic to sentry
			sentry.CurrentHub().Recover(err)
			sentry.Flush(time.Second * 5)

			// print panic trace
			panic(err)
		}
	}()

	addAllCommands()

	err := cmd.RootCmd.Execute()
	exitCode := code.GetErrorCode(err)
	os.Exit(exitCode)
}

```

### Core Architecture Module: `cmd/convert.go`
```
package cmd

import (
	"os"
	"path/filepath"

	"github.com/pkg/errors"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"

	"github.com/httprunner/funplugin/myexec"
	"github.com/httprunner/httprunner/v5/code"
	"github.com/httprunner/httprunner/v5/convert"
	"github.com/httprunner/httprunner/v5/internal/builtin"
)

var CmdConvert = &cobra.Command{
	Use:          "convert $path...",
	Short:        "Convert multiple source format to HttpRunner JSON/YAML/gotest/pytest cases",
	Args:         cobra.MinimumNArgs(1),
	SilenceUsage: false,
	RunE: func(cmd *cobra.Command, args []string) error {
		caseConverter := convert.NewConverter(outputDir, profilePath)

		var fromType convert.FromType
		if fromYAMLFlag {
			fromType = convert.FromTypeYAML
		} else if fromPostmanFlag {
			fromType = convert.FromTypePostman
		} else if fromHARFlag {
			fromType = convert.FromTypeHAR
		} else if fromCurlFlag {
			fromType = convert.FromTypeCurl
		} else {
			fromType = convert.FromTypeJSON
			log.Info().Str("fromType", fromType.String()).Msg("set default")
		}

		var outputType convert.OutputType
		if toYAMLFlag {
			outputType = convert.OutputTypeYAML
		} else if toPyTestFlag {
			packages := []string{"httprunner"}
			_, err := myexec.EnsurePython3Venv(venv, packages...)
			if err != nil {
				log.Error().Err(err).Msg("python3 venv is not ready")
				return errors.Wrap(code.InvalidPython3Venv, err.Error())
			}

			outputType = convert.OutputTypePyTest
		} else {
			outputType = convert.OutputTypeJSON
			log.Info().Str("outputType", outputType.String()).Msg("set default")
		}

		var files []string
		for _, arg := range args {
			if builtin.IsFolderPathExists(arg) {
				fs, err := os.ReadDir(arg)
				if err != nil {
					log.Error().Err(err).Str("path", arg).Msg("read dir failed")
					continue
				}
				for _, f := range fs {
					files = append(files, filepath.Join(arg, f.Name()))
				}
			} else {
				files = append(files, arg)
			}
		}

		for _, file := range files {
			extName := filepath.Ext(file)
			if !builtin.Contains(fromType.Extensions(), extName) {
				log.Warn().Str("path", file).
					Strs("expectExtensions", fromType.Extensions()).
					Msg("skip file")
				continue
			}

			if err := caseConverter.Convert(file, fromType, outputType); err != nil {
				log.Error().Err(err).Str("path", file).
					Str("outputType", outputType.String()).
					Msg("convert case failed")
			}
		}

		return nil
	},
}

var (
	outputDir   string
	profilePath string

	fromJSONFlag    bool
	fromYAMLFlag    bool
	fromPostmanFlag bool
	fromHARFlag     bool
	fromCurlFlag    bool

	toJSONFlag   bool
	toYAMLFlag   bool
	toPyTestFlag bool
)

func init() {
	CmdConvert.Flags().BoolVar(&fromJSONFlag, "from-json", true, "load from json case format")
	CmdConvert.Flags().BoolVar(&fromYAMLFlag, "from-yaml", false, "load from yaml case format")
	CmdConvert.Flags().BoolVar(&fromHARFlag, "from-har", false, "load from HAR format")
	CmdConvert.Flags().BoolVar(&fromPostmanFlag, "from-postman", false, "load from postman format")
	CmdConvert.Flags().BoolVar(&fromCurlFlag, "from-curl", false, "load from curl format")

	CmdConvert.Flags().BoolVar(&toJSONFlag, "to-json", true, "convert to JSON case scripts")
	CmdConvert.Flags().BoolVar(&toYAMLFlag, "to-yaml", false, "convert to YAML case scripts")
	CmdConvert.Flags().BoolVar(&toPyTestFlag, "to-pytest", false, "convert to pytest scripts")

	CmdConvert.Flags().StringVarP(&outputDir, "output-dir", "d", "", "specify output directory")
	CmdConvert.Flags().StringVarP(&profilePath, "profile", "p", "", "specify profile path to override headers and cookies")
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1652** (2023-07-24): **一键安装命令报错了**
  *Symptoms*: 一键安装命令报错了
  **Post-Mortem & Fix Analysis**:
  >  手动按照发现没有最新的linux-amd版本，于是下载了4.3.3版本，安装后报错 <img width="742" alt="image" src="https://github.com/httprunner/httprunner/assets/4033717/7e37a84e-2987-424f-9578-72c75a948d63">   环境：ubuntu 22.04-server   mac也是类似错误，手动执行 pip install httprunner==v4.3.3可以正常安装 
  > 通过手动安装PYYAML-5.4.1解决，，，需要手动把包解压，修改里面是setup.cfg文件，然后才能安装上
  > 已在 v4.3.5 解决

- **Issue #1603** (2023-07-23): **hrp run转换URL错误**
  *Symptoms*: ## hrp run 命令转换URL的时候，漏掉了结尾的`/`   ## 版本信息   - 操作系统类型: [Linux]  - Python 版本: [3.10]  - hrp 版本 [4.3.3]  ## case  ![image](https://user-images.githubusercontent.com/43426348/233820716-d2664167-4c6a-47b6-a024-d453f7e94fb5.png)  ## hrp run  > 失败  hrp run cases/mycopy_case.yml -g -c  ![image](https://user-images.githubusercontent.com/43426348/233820757-f6ec47a5-4a26-438d-a388-779c9c143782.png)   ## hrp pytest  > 成功  hrp pytest cases/mycopy_case.yml --html=my.html --disable-warnings  ![image](https://user-images.githubusercontent.com/43426348/233820795-4463c1a4-c060-4111-8dce-c7e796e6a4a1.png)  ![image](https://user-images.githubusercontent.com/43426348/233820818-73f7c1e1-7e3e-4171-96c1-03f9eecb2f9f.png)   

- **Issue #1547** (2023-04-19): **hrp run 嵌套case，report生成失败**
  *Symptoms*: ## 问题描述 hrp 执行嵌套用例，生成报告失败   hrp 是下载的二进制文件，V4.3.0 通过脚手架生成项目，命令如下： hrp run -s -g testcases/ref_testcase.yml  <img width="1469" alt="image" src="https://user-images.githubusercontent.com/43426348/211262914-432d9abf-789a-4e4a-918d-e66cb334d0c1.png">   ## 版本信息    - 操作系统类型:  mac M1   - Python 版本: v3.10.9  - HttpRunner 版本 v4.3.0   
  **Post-Mortem & Fix Analysis**:
  > 同样问题啊。.
  > @jiwzh @jonzha9527  这是由于引用case的时候，在 `(*StepTestCaseWithOptionalArgs).Run` 中 的差异行为 ![image](https://user-images.githubusercontent.com/30226135/232689364-df1f7b4e-17f5-411b-af1c-f0473ead939f.png)  和 其他单个step 的操作记录不同 ![image](https://user-images.githubusercontent.com/30226135/232689516-d7d20ed5-0ec2-4bcb-9db3-dace1f6084a7.png) 

- **Issue #1468** (2023-04-18): **接口测试报告（Go template）部分内容显示变量或格式异常**
  *Symptoms*: ## 问题描述  > 接口测试报告（Go template）部分内容显示变量或格式异常 >   ## 版本信息  请提供如下版本信息：   - 操作系统类型: [Windows]  - Python 版本: [3.7]  - Go 版本: [1.18]  - HttpRunner 版本 [4.2.0]  ## 项目文件内容（非必须）  ![report](https://user-images.githubusercontent.com/37102283/188767422-890a0faf-adcb-402c-babc-5f4d194d9519.png)    提示：请注意在去除项目敏感信息（IP、账号密码、密钥等）后再进行上传。 
  **Post-Mortem & Fix Analysis**:
  > 这个确实有用，应该加上😁
  > 修复 url 变量显示改为 值显示。

- **Issue #1467** (2023-04-19): **参数化数据驱动parameters加载自定义函数没找到**
  *Symptoms*: ## 问题描述  > hrp run 运行json文件，json文件中使用parameters参数化数据驱动的其中一种方式，即返回list[dict]模式，报错函数未找到  ## 版本信息  请提供如下版本信息：   - 操作系统类型:  Windows  - Python 版本: 3.7  - Go 版本: 1.18  - HttpRunner 版本: 4.2.0  ## 项目文件内容（非必须） ![1](https://user-images.githubusercontent.com/37102283/188423383-5670913f-52a9-46f2-9725-c8d7920bd331.png)   报错信息 PS $$$ hrp run testcases\suittestcasetestcopy.json -g 5:58PM INF Set log to color console other than JSON format. 5:58PM ??? Set log level 5:58PM INF [init] SetFailfast failfast=true 5:58PM INF [init] SetSaveTests saveTests=false 5:58PM INF [init] SetgenHTMLReport genHTMLReport=true 5:58PM INF [init] SetRequestsLogOn 5:58PM INF load file path="testcases\\suittestcasetestcopy.json" 5:58PM INF load file path="C:\\Users\\95439\\hrp4demo\\.env" 5:58PM INF set env key=base_url 5:58PM INF set env key=USERNAME 5:58PM INF set env key=PASSWORD 5:58PM INF load testcases successfully count=1 5:58PM INF start to prepare python plugin output="C:\\Users\\95439\\hrp4demo\\.debugtalk_gen.py" path="C:\\Users\\95439\\hrp4demo\\debugtalk.py" 5:58PM INF exec command cmd="C:\\WINDOWS\\system32\\cmd.exe /c python -m py_compile C:\\Users\\95439\\hrp4demo\\debugtalk.py" 5:58PM INF find all function names functionNames=["get_user_agent","sleep","sum","sum_ints","sum_two_int","sum_two_string","sum_strings","concatenate","setup_hook_example","teardown_hook_example","getkey","getparameters"] 5:58PM INF generate debugtalk success output="C:\\Users\\95439\\hrp4dem
  **Post-Mortem & Fix Analysis**:
  > 同样遇到了，应该是bug还没修复吧
  > golang中也是一样，parameters中找不到自定义的插件
  > golang中也是一样，parameters中找不到自定义的插件

- **Issue #1377** (2022-07-05): **hrp 性能测试 Statistics Summary 统计结果不准**
  *Symptoms*: ## 问题描述  如果测试用例中存在引用其他用例的情况下，统计会将整个引用的testcase作为一个request，存在较大统计误差。  ## 版本信息  请提供如下版本信息：   - hrp全版本  ## 项目文件内容（非必须）  ``` Current time: 2022/06/21 10:48:23, Users: 1, State: quitting, Total RPS: 0.7, Total Average Response Time: 1252.5ms, Total Fail Ratio: 0.0% Accumulated Transactions: 1 Passed, 0 Failed +--------------+------------------------+------------+---------+--------+---------+------+------+--------------+------------+-------------+ |     TYPE     |          NAME          | # REQUESTS | # FAILS | MEDIAN | AVERAGE | MIN  | MAX  | CONTENT SIZE | # REQS/SEC | # FAILS/SEC | +--------------+------------------------+------------+---------+--------+---------+------+------+--------------+------------+-------------+ | request-POST | post form data         |          1 |       0 |    280 |  278.00 |  278 |  278 |          422 |       0.33 |        0.00 | | testcase     | request with functions |          1 |       0 |   2200 | 2227.00 | 2227 | 2227 |            0 |       0.33 |        0.00 | | transaction  | Action                 |          1 |       0 |   2800 | 2830.00 | 2830 | 2830 |            0 |       0.33 |        0.00 | +--------------+------------------------+------------+---------+--------+---------+------+------+--------------+------------+-------------+  =========================================== Statistics Summary ========================================== Current time: 2022/06/21 10:48:23, Users: 1, Duration: 2.83s, Accumulated Transacti

- **Issue #1366** (2022-06-17): **脚手架工程运行hrp run yml用例，提示 build plugin failed error="python plugin syntax invalid: exit status 9009"**
  *Symptoms*: ## 问题描述  > 1.  hrp startproject hrpv4   > 2. 执行 hrp run testcases\requests.yml -g   ` (venv) E:\dev\httprunner-v4\hrpv4>hrp run testcases\requests.yml -g 3:08PM INF Set log to color console other than JSON format. 3:08PM ??? Set log level 3:08PM INF [init] SetFailfast failfast=true 3:08PM INF [init] SetSaveTests saveTests=false 3:08PM INF [init] SetgenHTMLReport genHTMLReport=true 3:08PM INF [init] SetRequestsLogOn 3:08PM INF load file path="testcases\\requests.yml" 3:08PM INF load file path="E:\\dev\\httprunner-v4\\hrpv4\\.env" 3:08PM INF set env key=base_url 3:08PM INF set env key=USERNAME 3:08PM INF set env key=PASSWORD 3:08PM INF load testcases successfully count=1 3:08PM INF exec command cmd="C:\\WINDOWS\\system32\\cmd.exe /c python3 -m py_compile E:\\dev\\httprunner-v4\\hrpv4\\debugtalk.py" 3:08PM ERR exec command failed error="exit status 9009" 3:08PM ERR build plugin failed error="python plugin syntax invalid: exit status 9009" path="E:\\dev\\httprunner-v4\\hrpv4\\debugtalk.py"  ` ## 版本信息  请提供如下版本信息：   - 操作系统类型: [e.g.  Windows]  - Python 版本: [e.g. 3.8]  - HttpRunner 版本 [e.g. 4.1.3]  ## 项目文件内容（非必须）  ![image](https://user-images.githubusercontent.com/8569167/174013395-38cf2c2d-1947-40b1-a77b-557f04a6318e.png)
  **Post-Mortem & Fix Analysis**:
  > @HJXDELL 该问题已修复，将在 v4.1.4 中发布。  https://github.com/httprunner/httprunner/pull/1360

- **Issue #1357** (2022-06-17): **引用测试用例时参数驱动失效**
  *Symptoms*: ## 问题描述  > 假设有个子用例A.yml，每次调用时返回传入的参数“TREATMENTNO”，比如传123返回123，传456返回456，内容如下： ``` config:     name: “子用例A”     base_url: ${ENV(DOMAIN)}     verify: False  teststeps: -     name: "处理单号”     request:         method: POST         url: /srs/submit         headers:             content-type: "application/json;charset=UTF-8"         json:             treatmentNo: $TREATMENTNO     validate:         - eq: ["status_code", 200] ```  >现在有个主用例B.yml,多次调用A,只是每次传递的参数不同 ``` config:     name: "主用例B”     base_url: ${ENV(DOMAIN)}     verify: False  teststeps: -     name: "处理单号1”     variables:         TREATMENTNO: “ABC123”     testcase: testcases/A.yml  -     name: "处理单号2”     variables:         TREATMENTNO: “abc456”     testcase: testcases/A.yml  ```  >当第二次调用A.yml的时候，应该返回abc456，实际还是返回ABC123。  ## 版本信息  请提供如下版本信息：   - 操作系统类型: [macOS]  - Python 版本: [3.7.7]  - Go 版本: [none]  - HttpRunner 版本 [3.1.4]  ## 项目文件内容（非必须）  如果可能，提供项目测试用例文件原始内容可加快 bug 定位和修复速度。  提示：请注意在去除项目敏感信息（IP、账号密码、密钥等）后再进行上传。 
  **Post-Mortem & Fix Analysis**:
  > @jeremy8250 已经在 v4.1.4 中修复；如果还有问题的话麻烦再 reopen 这个 issue 反馈下。

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

### Incident Patch 1: `47996ed2` (2025-08-18)
**Commit Message**: Merge 'fix-token' into 'master'

fix: remove token

See merge request: !162

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250815
+v5.0.0-250818
```

**File**: `uixt/driver_utils.go` (modified, +14/-5)
```diff
@@ -386,8 +386,18 @@ func DownloadFileByUrl(fileUrl string) (filePath string, err error) {
 	return filePath, nil
 }
 
+var (
+	VEDEM_UPLOAD_URL        = os.Getenv("VEDEM_UPLOAD_URL")
+	VEDEM_UPLOAD_ACCESS_KEY = os.Getenv("VEDEM_UPLOAD_ACCESS_KEY")
+	VEDEM_UPLOAD_TOKEN      = os.Getenv("VEDEM_UPLOAD_TOKEN")
+)
+
 // uploadScreenshot uploads a screenshot to the server and returns the URL
 func uploadScreenshot(imagePath string, imageBuffer *bytes.Buffer) (string, error) {
+	if VEDEM_UPLOAD_URL == "" || VEDEM_UPLOAD_ACCESS_KEY == "" || VEDEM_UPLOAD_TOKEN == "" {
+		return "", errors.Wrap(code.ConfigureError, "upload service env not configured")
+	}
+
 	// Create a new buffer for the multipart form
 	var requestBody bytes.Buffer
 	writer := multipart.NewWriter(&requestBody)
@@ -409,16 +419,15 @@ func uploadScreenshot(imagePath string, imageBuffer *bytes.Buffer) (string, erro
 	}
 
 	// Create the HTTP request
-	uploadURL := "https://gtf-eapi-cn.bytedance.com/cn/upload/xxx"
-	req, err := http.NewRequest("POST", uploadURL, &requestBody)
+	req, err := http.NewRequest("POST", VEDEM_UPLOAD_URL, &requestBody)
 	if err != nil {
 		return "", errors.Wrap(code.UploadFailed, err.Error())
 	}
 
 	// Set headers
 	req.Header.Set("Content-Type", writer.FormDataContentType())
-	req.Header.Set("accessKey", "ies.vedem.video")
-	req.Header.Set("token", "***REMOVED***")
+	req.Header.Set("accessKey", VEDEM_UPLOAD_ACCESS_KEY)
+	req.Header.Set("token", VEDEM_UPLOAD_TOKEN)
 
 	// Create HTTP client with HTTP/1.1 support
 	client := &http.Client{
@@ -428,7 +437,7 @@ func uploadScreenshot(imagePath string, imageBuffer *bytes.Buffer) (string, erro
 	}
 
 	// Send the request
-	log.Debug().Str("url", uploadURL).Str("imagePath", imagePath).Msg("uploading screenshot")
+	log.Debug().Str("url", VEDEM_UPLOAD_URL).Str("imagePath", imagePath).Msg("uploading screenshot")
 	resp, err := client.Do(req)
 	if err != nil {
 		return "", errors.Wrap(code.UploadFailed, err.Error())
```

---

### Incident Patch 2: `2c095d1f` (2025-08-18)
**Commit Message**: fix: remove token

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250815
+v5.0.0-250818
```

**File**: `uixt/driver_utils.go` (modified, +14/-5)
```diff
@@ -386,8 +386,18 @@ func DownloadFileByUrl(fileUrl string) (filePath string, err error) {
 	return filePath, nil
 }
 
+var (
+	VEDEM_UPLOAD_URL        = os.Getenv("VEDEM_UPLOAD_URL")
+	VEDEM_UPLOAD_ACCESS_KEY = os.Getenv("VEDEM_UPLOAD_ACCESS_KEY")
+	VEDEM_UPLOAD_TOKEN      = os.Getenv("VEDEM_UPLOAD_TOKEN")
+)
+
 // uploadScreenshot uploads a screenshot to the server and returns the URL
 func uploadScreenshot(imagePath string, imageBuffer *bytes.Buffer) (string, error) {
+	if VEDEM_UPLOAD_URL == "" || VEDEM_UPLOAD_ACCESS_KEY == "" || VEDEM_UPLOAD_TOKEN == "" {
+		return "", errors.Wrap(code.ConfigureError, "upload service env not configured")
+	}
+
 	// Create a new buffer for the multipart form
 	var requestBody bytes.Buffer
 	writer := multipart.NewWriter(&requestBody)
@@ -409,16 +419,15 @@ func uploadScreenshot(imagePath string, imageBuffer *bytes.Buffer) (string, erro
 	}
 
 	// Create the HTTP request
-	uploadURL := "https://gtf-eapi-cn.bytedance.com/cn/upload/xxx"
-	req, err := http.NewRequest("POST", uploadURL, &requestBody)
+	req, err := http.NewRequest("POST", VEDEM_UPLOAD_URL, &requestBody)
 	if err != nil {
 		return "", errors.Wrap(code.UploadFailed, err.Error())
 	}
 
 	// Set headers
 	req.Header.Set("Content-Type", writer.FormDataContentType())
-	req.Header.Set("accessKey", "ies.vedem.video")
-	req.Header.Set("token", "***REMOVED***")
+	req.Header.Set("accessKey", VEDEM_UPLOAD_ACCESS_KEY)
+	req.Header.Set("token", VEDEM_UPLOAD_TOKEN)
 
 	// Create HTTP client with HTTP/1.1 support
 	client := &http.Client{
@@ -428,7 +437,7 @@ func uploadScreenshot(imagePath string, imageBuffer *bytes.Buffer) (string, erro
 	}
 
 	// Send the request
-	log.Debug().Str("url", uploadURL).Str("imagePath", imagePath).Msg("uploading screenshot")
+	log.Debug().Str("url", VEDEM_UPLOAD_URL).Str("imagePath", imagePath).Msg("uploading screenshot")
 	resp, err := client.Do(req)
 	if err != nil {
 		return "", errors.Wrap(code.UploadFailed, err.Error())
```

---

### Incident Patch 3: `5459199b` (2025-08-15)
**Commit Message**: Merge 'fix-init-llm-service' into 'master'

Fix init llm service

See merge request: !157

**File**: `CLAUDE.md` (modified, +4/-4)
```diff
@@ -116,6 +116,10 @@ The framework supports both Go and Python plugins:
 - Internal utilities in `internal/`
 - Examples in `examples/`
 
+### Code Standards
+- All code comments must be written in English
+- All documentation must be written in Chinese
+
 ### Dependencies
 - Go 1.23+ required
 - Uses Cobra for CLI
@@ -126,7 +130,3 @@ The framework supports both Go and Python plugins:
 - Static linking for deployment
 - Version info embedded via ldflags
 - Cross-platform builds supported
-
-### Code Standards
-- All code comments must be written in English
-- All documentation must be written in Chinese
```

**File**: `runner_uixt.go` (modified, +38/-19)
```diff
@@ -35,24 +35,31 @@ type UIXTRunner struct {
 }
 
 type UIXTConfig struct {
-	uixt.DriverCacheConfig
+	uixt.DriverCacheConfig // includes Platform, Serial, AIOptions
 
-	Ctx                context.Context
-	Cancel             context.CancelFunc
-	JSONCase           ITestCase
-	UIA2               bool    // UIAutomator2（Android）
-	LogOn              bool    // 开启打点日志
+	// Runtime context
+	Ctx    context.Context
+	Cancel context.CancelFunc `json:"-"`
+
+	// Test case configuration
+	JSONCase ITestCase
+
+	// Device specific options
+	UIA2         bool // UIAutomator2（Android）
+	LogOn        bool // 开启打点日志
+	WDAPort      int  // iOS WebDriverAgent port
+	WDAMjpegPort int  // iOS WebDriverAgent MJPEG port
+
+	// Agent behavior configuration
 	Timeout            int     // seconds
 	AbortErrors        []error // abort errors
 	MaxRestartAppCount int     // max app restart count
 	MaxRetryCount      int     // max retry count
 
-	WDAPort      int
-	WDAMjpegPort int
-
-	OSType     string // platform
-	Serial     string
-	LLMService option.LLMServiceType // LLM 服务类型
+	// Backward compatibility fields - legacy API support
+	OSType     string                // deprecated: use Platform from DriverCacheConfig
+	Serial     string                // deprecated: use Serial from DriverCacheConfig
+	LLMService option.LLMServiceType // deprecated: use AIOptions from DriverCacheConfig
 }
 
 const (
@@ -83,7 +90,7 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 	}
 	config.SetAIOptions(configs.AIOptions...)
 
-	switch configs.OSType {
+	switch configs.Platform {
 	case "ios":
 		port, err := configs.getWDALocalPort(configs.Serial)
 		if err != nil {
@@ -123,7 +130,7 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 		)
 	default:
 		// default to android
-		configs.OSType = "android"
+		configs.Platform = "android"
 		config.SetAndroid(
 			option.WithSerialNumber(configs.Serial),
 			option.WithUIA2(configs.UIA2),
@@ -144,11 +151,10 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 	}
 	sessionRunner := caseRunner.NewSession()
 
-	driverCacheConfig := uixt.DriverCacheConfig{
-		Platform:  configs.OSType,
-		Serial:    configs.Serial,
-		AIOptions: config.AIOptions.Options(),
-	}
+	// Use configs directly as it inherits DriverCacheConfig
+	driverCacheConfig := configs.DriverCacheConfig
+	driverCacheConfig.AIOptions = config.AIOptions.Options()
+
 	dExt, err := uixt.GetOrCreateXTDriver(driverCacheConfig)
 	if err != nil {
 		return nil, errors.Wrap(err, "get driver failed")
@@ -181,6 +187,19 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 }
 
 func (configs *UIXTConfig) addDefault() {
+	// Handle backward compatibility - sync legacy fields to embedded DriverCacheConfig
+	if configs.OSType != "" && configs.Platform == "" {
+		configs.Platform = configs.OSType
+	}
+	if configs.Serial != "" && configs.DriverCacheConfig.Serial == "" {
+		configs.DriverCacheConfig.Serial = configs.Serial
+	}
+	if configs.LLMService != "" && len(configs.AIOptions) == 0 {
+		configs.AIOptions = []option.AIServiceOption{
+			option.WithLLMService(configs.LLMService),
+		}
+	}
+
 	if configs.Ctx == nil {
 		configs.Ctx = context.Background()
 	}
```

**File**: `uixt/ai/wings_service.go` (modified, +4/-1)
```diff
@@ -472,7 +472,10 @@ func (w *WingsService) callWingsAPI(ctx context.Context, request WingsActionRequ
 	defer resp.Body.Close()
 
 	logID := resp.Header.Get("X-Tt-Logid")
-	log.Info().Str("step_text", request.StepText).Str("image_url", request.DeviceInfos[0].NowImageUrl).Str("log_id", logID).Str("biz_id", request.BizId).Str("url", w.apiURL).Msg("call wings api")
+	log.Info().Str("step_text", request.StepText).
+		Str("image_url", request.DeviceInfos[0].NowImageUrl).
+		Str("log_id", logID).Str("biz_id", request.BizId).
+		Str("url", w.apiURL).Msg("call wings api")
 
 	// Read response body
 	responseBody, err := io.ReadAll(resp.Body)
```

**File**: `uixt/mcp_server_test.go` (modified, +146/-0)
```diff
@@ -1851,3 +1851,149 @@ func TestNewMCPErrorResponse(t *testing.T) {
 	result := NewMCPErrorResponse("Test error message")
 	assert.NotNil(t, result)
 }
+
+// TestParseActionOptions tests core functionality of parseActionOptions function
+func TestParseActionOptions(t *testing.T) {
+	testCases := []struct {
+		name      string
+		arguments map[string]any
+		expectErr bool
+		validate  func(t *testing.T, opts *option.ActionOptions)
+	}{
+		{
+			name:      "empty_arguments",
+			arguments: map[string]any{},
+			expectErr: false,
+			validate: func(t *testing.T, opts *option.ActionOptions) {
+				assert.Equal(t, "", opts.Platform)
+				assert.Equal(t, "", opts.Serial)
+				assert.Equal(t, 0.0, opts.X)
+				assert.Equal(t, 0.0, opts.Y)
+			},
+		},
+		{
+			name: "basic_fields",
+			arguments: map[string]any{
+				"platform": "android",
+				"serial":   "device123",
+				"x":        100.5,
+				"y":        200.7,
+				"text":     "Hello World",
+			},
+			expectErr: false,
+			validate: func(t *testing.T, opts *option.ActionOptions) {
+				assert.Equal(t, "android", opts.Platform)
+				assert.Equal(t, "device123", opts.Serial)
+				assert.Equal(t, 100.5, opts.X)
+				assert.Equal(t, 200.7, opts.Y)
+				assert.Equal(t, "Hello World", opts.Text)
+			},
+		},
+		{
+			name: "complete_nested_fields",
+			arguments: map[string]any{
+				"platform":                        "ios",
+				"serial":                          "ios_device",
+				"screenshot_with_ocr":             true,
+				"screenshot_with_upload":          true,
+				"screenshot_with_live_type":       true,
+				"screenshot_with_live_popularity": true,
+				"screenshot_with_base64":          true,
+				"screenshot_with_ui_types":        []string{"button", "input", "text"},
+				"screenshot_with_close_popups":    true,
+				"screenshot_with_ocr_cluster":     "test_cluster",
+				"screenshot_file_name":            "test.png",
+				"screenrecord_duration":           30.5,
+				"screenrecord_with_audio":         true,
+				"screenrecord_with_scrcpy":        true,
+				"screenrecord_path":               "/tmp/record.mp4",
+				"scope":                           []float64{0.1, 0.2, 0.9, 0.8},
+				"abs_scope":                       []int{100, 200, 900, 800},
+				"regex":                           true,
+				"offset":                          []int{5, 10},
+				"tap_random_rect":                 true,
+				"swipe_offset":                    []int{1, 2, 3, 4},
+				"offset_random_range":             []int{-5, 5},
+				"index":                           2,
+				"match_one":                       true,
+				"ignore_NotFoundError":            true,
+				"pre_mark_operation":              true,
+				"post_mark_operation":             false,
+				"max_retry_times":                 5,
+				"timeout":                         30,
+				"custom": map[string]any{
+					"test_key":    "test_value",
+					"nested_data": map[string]any{"key": "value"},
+				},
+			},
+			expectErr: false,
+			validate: func(t *testing.T, opts *option.ActionOptions) {
+				assert.Equal(t, "ios", opts.Platform)
+				assert.Equal(t, "ios_device", opts.Serial)
+				assert.True(t, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithOCR)
+				assert.True(t, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithUpload)
+				assert.True(t, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithLiveType)
+				assert.True(t, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithLivePopularity)
+				assert.True(t, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithBase64)
+				assert.Equal(t, []string{"button", "input", "text"}, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithUITypes)
+				assert.True(t, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithClosePopups)
+				assert.Equal(t, "test_cluster", opts.ScreenOptions.ScreenShotOptions.ScreenShotWithOCRCluster)
+				assert.Equal(t, "test.png", opts.ScreenOptions.ScreenShotOptions.ScreenShotFileName)
+				assert.Equal(t, 30.5, opts.ScreenOptions.ScreenRecordOptions.ScreenRecordDuration)
+				assert.True(t, opts.ScreenOptions.ScreenRecordOptions.ScreenRecordWithAudio)
+				assert.True(t, opts.ScreenOptions.ScreenRecordOptions.ScreenRecordWithScrcpy)
+				assert.Equal(t, "/tmp/record.mp4", opts.ScreenOptions.ScreenRecordOptions.ScreenRecordPath)
+				assert.Equal(t, []float64{0.1, 0.2, 0.9, 0.8}, []float64(opts.ScreenOptions.ScreenFilterOptions.Scope))
+				assert.Equal(t, []int{100, 200, 900, 800}, []int(opts.ScreenOptions.ScreenFilterOptions.AbsScope))
+				assert.True(t, opts.ScreenOptions.ScreenFilterOptions.Regex)
+				assert.Equal(t, []int{5, 10}, opts.ScreenOptions.ScreenFilterOptions.TapOffset)
+				assert.True(t, opts.ScreenOptions.ScreenFilterOptions.TapRandomRect)
+				assert.Equal(t, []int{1, 2, 3, 4}, opts.ScreenOptions.ScreenFilterOptions.SwipeOffset)
+				assert.Equal(t, []int{-5, 5}, opts.ScreenOptions.ScreenFilterOptions.OffsetRandomRange)
+				assert.Equal(t, 2, opts.ScreenOptions.ScreenFilterOptions.Index)
+				assert.True(t, opts.ScreenOptio
```

**File**: `uixt/sdk.go` (modified, +10/-5)
```diff
@@ -24,6 +24,7 @@ func NewXTDriver(driver IDriver, opts ...option.AIServiceOption) (*XTDriver, err
 		services:         services,
 		loadedMCPClients: make(map[string]client.MCPClient),
 	}
+	log.Info().Interface("services", services).Msg("init XTDriver with AI services")
 
 	var err error
 
@@ -32,25 +33,29 @@ func NewXTDriver(driver IDriver, opts ...option.AIServiceOption) (*XTDriver, err
 		// Use advanced LLM service configuration if provided
 		driverExt.LLMService, err = ai.NewLLMServiceWithOptionConfig(services.LLMConfig)
 		if err != nil {
-			log.Warn().Err(err).Msg("init llm service with config failed")
+			log.Warn().Err(err).Interface("service", services.LLMConfig).
+				Msg("init llm service with advanced config failed")
 		} else {
-			log.Info().Msg("LLM service initialized with advanced config")
+			log.Info().Interface("service", services.LLMConfig).
+				Msg("LLM service initialized with advanced config")
 		}
 	} else if services.LLMService != "" {
 		// Use simple LLM service configuration if provided
 		driverExt.LLMService, err = ai.NewLLMService(services.LLMService)
 		if err != nil {
-			log.Warn().Err(err).Msg("init llm service failed")
+			log.Warn().Err(err).Str("service", string(services.LLMService)).
+				Msg("init llm service with simple config failed")
 		} else {
-			log.Info().Msg("LLM service initialized with simple config")
+			log.Info().Str("service", string(services.LLMService)).
+				Msg("LLM service initialized with simple config")
 		}
 	} else {
 		// Use Wings service as fallback
 		driverExt.LLMService, err = ai.NewWingsService()
 		if err != nil {
 			log.Warn().Err(err).Msg("init Wings service failed")
 		} else {
-			log.Info().Msg("Wings service initialized")
+			log.Info().Msg("Wings service initialized as fallback")
 		}
 	}
 
```

---

### Incident Patch 4: `6bf63cfc` (2025-08-15)
**Commit Message**: revert:

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250813
+v5.0.0-250815
```

**File**: `pkg/gadb/device.go` (modified, +12/-1)
```diff
@@ -664,14 +664,22 @@ func (d *Device) installViaABBExec(apk io.ReadSeeker, args ...string) (raw []byt
 		tp       transport
 		filesize int64
 	)
+	timeout := 8
+	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Minute)
+	defer cancel()
+
 	filesize, err = apk.Seek(0, io.SeekEnd)
 	if err != nil {
 		return nil, err
 	}
-	if tp, err = d.createDeviceTransport(5 * time.Minute); err != nil {
+	if tp, err = d.createDeviceTransport(4 * time.Minute); err != nil {
 		return nil, err
 	}
 	defer func() { _ = tp.Close() }()
+	go func() {
+		<-ctx.Done()
+		_ = tp.Close()
+	}()
 	cmd := "abb_exec:package\x00install\x00-t"
 	for _, arg := range args {
 		cmd += "\x00" + arg
@@ -690,6 +698,9 @@ func (d *Device) installViaABBExec(apk io.ReadSeeker, args ...string) (raw []byt
 		return nil, err
 	}
 	raw, err = tp.ReadBytesAll()
+	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
+		return nil, fmt.Errorf("installation timed out after %d minutes", timeout)
+	}
 	return
 }
 
```

**File**: `uixt/ai/wings_service.go` (modified, +129/-54)
```diff
@@ -26,6 +26,7 @@ type WingsService struct {
 	bizId     string
 	accessKey string
 	secretKey string
+	history   []History // Conversation history for Wings API
 }
 
 // NewWingsService creates a new Wings service instance
@@ -49,6 +50,7 @@ func NewWingsService() (ILLMService, error) {
 		bizId:     bizID,
 		accessKey: accessKey,
 		secretKey: secretKey,
+		history:   []History{},
 	}, nil
 }
 
@@ -59,6 +61,11 @@ func (w *WingsService) Plan(ctx context.Context, opts *PlanningOptions) (*Planni
 		return nil, errors.Wrap(err, "validate planning parameters failed")
 	}
 
+	// Reset history if requested
+	if opts.ResetHistory {
+		w.resetHistory()
+	}
+
 	// Extract screenshot from message
 	screenshot, err := w.extractScreenshotFromMessage(opts.Message)
 	if err != nil {
@@ -70,15 +77,11 @@ func (w *WingsService) Plan(ctx context.Context, opts *PlanningOptions) (*Planni
 
 	// Prepare Wings API request
 	apiRequest := WingsActionRequest{
-		Historys: []interface{}{}, // empty as specified
-		DeviceInfos: []WingsDeviceInfo{
-			deviceInfo,
-		},
-		StepText: opts.UserInstruction,
-		BizId:    w.bizId,
-		TextCase: "整体描述：\\n前置条件：\\n获取 1 台设备 A。\\n获取 1 个[万粉创作者]账号a。\\n获取 2 个[普通]账号 b、c。\\n账号 a 和账号 b 互相关注。\\n账号 a 和账号 c 互相关注。\\n账号 a 给账号 b 设置备注为 “11131b”。\\n账号 a 给账号 c 设置备注为 “11131c”。\\n账号 a 创建一个粉丝群 m。\\n 账号 a 修改粉丝群 m 名称为“11131群”。\\n 账号 a 邀请账号 b 加入粉丝群 m。\\n账号 a 邀请账号 c 加入粉丝群 m。\\n账号 a 给群聊 m 发送一条文字消息。\\n设备 A 打开抖音 app。\\n设备 A 登录账号 a。\\n设备 A 退出抖音 app。\\n操作步骤：\\n账号a打开抖音app。\\n点击“消息”。\\n点击“11131群”cell。\\n点击“聊天信息页入口”按钮。\\n点击“分享公开群”按钮。\\n点击文字“群口令”。\\n断言：屏幕中存在文字“口令复制成功”。\\n停止操作。\\n注意事项：\\n",
-		StepType: "automation",
-		DeviceID: deviceInfo.DeviceID,
+		Historys:   w.history,
+		DeviceInfo: deviceInfo,
+		StepText:   fmt.Sprintf("%s", opts.UserInstruction),
+		BizId:      w.bizId,
+		TextCase:   fmt.Sprintf("整体描述：\n前置条件：\n操作步骤：\n%s\n停止操作。\n注意事项：\n", opts.UserInstruction),
 		Base: WingsBase{
 			LogID: generateWingsUUID(),
 		},
@@ -98,7 +101,7 @@ func (w *WingsService) Plan(ctx context.Context, opts *PlanningOptions) (*Planni
 	}
 
 	// Check API response status
-	if response.BaseResp.StatusCode != 0 {
+	if response.BaseResp.StatusCode != 0 && response.BaseResp.StatusCode != 200 {
 		err = fmt.Errorf("API returned error: %s", response.BaseResp.StatusMessage)
 		return &PlanningResult{
 			Thought:   response.ThoughtChain.Thought,
@@ -107,26 +110,50 @@ func (w *WingsService) Plan(ctx context.Context, opts *PlanningOptions) (*Planni
 		}, err
 	}
 
-	// Convert Wings API response to tool calls
-	toolCalls, err := w.convertWingsResponseToToolCalls(response.ActionParams)
-	if err != nil {
-		return &PlanningResult{
-			Thought:   response.ThoughtChain.Thought,
-			Error:     err.Error(),
-			ModelName: "wings-api",
-		}, errors.Wrap(err, "convert Wings response to tool calls failed")
+	// Update history with response data
+	newHistoryEntry := History{
+		Observation:   response.ThoughtChain.Observation,
+		Thought:       response.ThoughtChain.Thought,
+		Summary:       response.ThoughtChain.Summary,
+		StepText:      response.StepText,
+		StepTextTrans: response.StepTextTrans,
+		OriStepIndex:  response.OriStepIndex,
+		DeviceID:      deviceInfo[0].DeviceID,
+		AgentType:     response.AgentType,
+		ActionResult:  "", // Always empty as requested
+		DeviceInfos:   &deviceInfo,
+		ActionParams:  response.ActionParams,
+	}
+	w.history = append(w.history, newHistoryEntry)
+	var toolCalls []schema.ToolCall
+	if response.StepType != "FINISH" {
+		// Convert Wings API response to tool calls
+		toolCalls, err = w.convertWingsResponseToToolCalls(response.ActionParams)
+		if err != nil {
+			return &PlanningResult{
+				Thought:   response.ThoughtChain.Thought,
+				Error:     err.Error(),
+				ModelName: "wings-api",
+			}, errors.Wrap(err, "convert Wings response to tool calls failed")
+		}
 	}
 
+	// No need to update ActionResult as per user request
+	// ActionResult should always be empty
+
 	log.Info().
 		Str("thought", response.ThoughtChain.Thought).
+		Str("action", response.AgentType).
+		Str("action_params", response.ActionParams).
+		Str("log_id", fmt.Sprintf("%v", response.BaseResp.Extra)).
 		Int("tool_calls_count", len(toolCalls)).
 		Int64("elapsed_ms", elapsed).
 		Msg("Wings API planning completed")
 
 	return &PlanningResult{
 		ToolCalls: toolCalls,
-		Thought:   response.ThoughtChain.Thought,
-		Content:   response.ThoughtChain.Summary,
+		Thought:   response.StepTextTrans,
+		Content:   response.StepTextTrans,
 		ModelName: "wings-api",
 	}, nil
 }
@@ -146,20 +173,15 @@ func (w *WingsService) Assert(ctx context.Context, opts *AssertOptions) (*Assert
 
 	// Prepare Wings API request for assertion
 	apiRequest := WingsActionRequest{
-		Historys: []interface{}{}, // empty as specified
-		DeviceInfos: []WingsDeviceInfo{
-			deviceInfo,
-		},
-		StepText: opts.Assertion,
-		BizId:    w.bizId,
-		TextCase: "整体描述：\\n前置条件：\\n获取 1 台设备 A。\\n获取 1 个[万粉创作者]账号a。\\n获取 2 个[普通]账号 b、c。\\n账号 a 和账号 b 互相关注。\\n账号 a 和账号 c 互相关注。\\n账号 a 给账号 
```

**File**: `uixt/android_device.go` (modified, +2/-2)
```diff
@@ -240,12 +240,12 @@ func (dev *AndroidDevice) installViaInstaller(apkPath string, args ...string) er
 		return err
 	}
 	// 等待安装完成或超时
-	timeout := 3 * time.Minute
+	timeout := 8 * time.Minute
 	select {
 	case err := <-done:
 		return err
 	case <-time.After(timeout):
-		return fmt.Errorf("installation timed out after %v", timeout)
+		return fmt.Errorf("install via installer timed out after %v", timeout)
 	}
 }
 
```

**File**: `uixt/android_test.go` (modified, +0/-5)
```diff
@@ -21,11 +21,6 @@ func setupADBDriverExt(t *testing.T) *XTDriver {
 		Serial:   "", // Let it auto-detect the device serial
 		AIOptions: []option.AIServiceOption{
 			option.WithCVService(option.CVServiceTypeVEDEM),
-			option.WithLLMConfig(
-				option.NewLLMServiceConfig(option.DOUBAO_1_5_UI_TARS_250328).
-					WithPlannerModel(option.WINGS_SERVICE).
-					WithAsserterModel(option.WINGS_SERVICE),
-			),
 		},
 	}
 
```

**File**: `uixt/driver_ext_ai_test.go` (modified, +3/-20)
```diff
@@ -292,31 +292,14 @@ func TestDriverExt_AIAction(t *testing.T) {
 func TestDriverExt_AIAction_CompareWithAIAction(t *testing.T) {
 	driver := setupDriverExt(t)
 
-	prompt := "点击搜索按钮"
+	prompt := "[目标导向]向上滑动屏幕2次"
 
 	// Test both methods with the same prompt
-	aiResult, aiErr := driver.AIAction(context.Background(), prompt)
+	aiResult, aiErr := driver.StartToGoal(context.Background(), prompt)
 
 	// Both should execute without critical errors (may have different implementations)
 	t.Logf("AIAction error: %v", aiErr)
-
-	// If both succeed, compare results
-	if aiResult != nil {
-		assert.Equal(t, "action", aiResult.Type, "AIAction result type should be 'action'")
-
-		// Both should have timing information
-		assert.Greater(t, aiResult.ModelCallElapsed, int64(0), "AIAction should have model call elapsed time")
-
-		// Both should have screenshot information
-		assert.NotEmpty(t, aiResult.ImagePath, "AIAction should have image path")
-
-		// Compare model names
-		if aiResult.PlanningResult != nil {
-			t.Logf("AIAction model: %s", aiResult.PlanningResult.ModelName)
-
-			assert.Equal(t, "wings-api", aiResult.PlanningResult.ModelName, "AIAction should use wings-api")
-		}
-	}
+	t.Logf("AIAction result: %v", aiResult)
 }
 
 // TestDriverExt_AIAction_ErrorHandling tests AIAction error handling
```

---

### Incident Patch 5: `158d6d9b` (2025-08-15)
**Commit Message**: fix: configure LLMService for UIXTRunner

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250814
+v5.0.0-250815
```

**File**: `runner_uixt.go` (modified, +38/-19)
```diff
@@ -35,24 +35,31 @@ type UIXTRunner struct {
 }
 
 type UIXTConfig struct {
-	uixt.DriverCacheConfig
+	uixt.DriverCacheConfig // includes Platform, Serial, AIOptions
 
-	Ctx                context.Context
-	Cancel             context.CancelFunc
-	JSONCase           ITestCase
-	UIA2               bool    // UIAutomator2（Android）
-	LogOn              bool    // 开启打点日志
+	// Runtime context
+	Ctx    context.Context
+	Cancel context.CancelFunc `json:"-"`
+
+	// Test case configuration
+	JSONCase ITestCase
+
+	// Device specific options
+	UIA2         bool // UIAutomator2（Android）
+	LogOn        bool // 开启打点日志
+	WDAPort      int  // iOS WebDriverAgent port
+	WDAMjpegPort int  // iOS WebDriverAgent MJPEG port
+
+	// Agent behavior configuration
 	Timeout            int     // seconds
 	AbortErrors        []error // abort errors
 	MaxRestartAppCount int     // max app restart count
 	MaxRetryCount      int     // max retry count
 
-	WDAPort      int
-	WDAMjpegPort int
-
-	OSType     string // platform
-	Serial     string
-	LLMService option.LLMServiceType // LLM 服务类型
+	// Backward compatibility fields - legacy API support
+	OSType     string                // deprecated: use Platform from DriverCacheConfig
+	Serial     string                // deprecated: use Serial from DriverCacheConfig
+	LLMService option.LLMServiceType // deprecated: use AIOptions from DriverCacheConfig
 }
 
 const (
@@ -83,7 +90,7 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 	}
 	config.SetAIOptions(configs.AIOptions...)
 
-	switch configs.OSType {
+	switch configs.Platform {
 	case "ios":
 		port, err := configs.getWDALocalPort(configs.Serial)
 		if err != nil {
@@ -123,7 +130,7 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 		)
 	default:
 		// default to android
-		configs.OSType = "android"
+		configs.Platform = "android"
 		config.SetAndroid(
 			option.WithSerialNumber(configs.Serial),
 			option.WithUIA2(configs.UIA2),
@@ -144,11 +151,10 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 	}
 	sessionRunner := caseRunner.NewSession()
 
-	driverCacheConfig := uixt.DriverCacheConfig{
-		Platform:  configs.OSType,
-		Serial:    configs.Serial,
-		AIOptions: config.AIOptions.Options(),
-	}
+	// Use configs directly as it inherits DriverCacheConfig
+	driverCacheConfig := configs.DriverCacheConfig
+	driverCacheConfig.AIOptions = config.AIOptions.Options()
+
 	dExt, err := uixt.GetOrCreateXTDriver(driverCacheConfig)
 	if err != nil {
 		return nil, errors.Wrap(err, "get driver failed")
@@ -181,6 +187,19 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 }
 
 func (configs *UIXTConfig) addDefault() {
+	// Handle backward compatibility - sync legacy fields to embedded DriverCacheConfig
+	if configs.OSType != "" && configs.Platform == "" {
+		configs.Platform = configs.OSType
+	}
+	if configs.Serial != "" && configs.DriverCacheConfig.Serial == "" {
+		configs.DriverCacheConfig.Serial = configs.Serial
+	}
+	if configs.LLMService != "" && len(configs.AIOptions) == 0 {
+		configs.AIOptions = []option.AIServiceOption{
+			option.WithLLMService(configs.LLMService),
+		}
+	}
+
 	if configs.Ctx == nil {
 		configs.Ctx = context.Background()
 	}
```

---

### Incident Patch 6: `0dd2f6c2` (2025-08-13)
**Commit Message**: Merge 'fix-tap-offset' into 'master'

fix: miss tap offset option

See merge request: !155

**File**: `CLAUDE.md` (modified, +5/-1)
```diff
@@ -125,4 +125,8 @@ The framework supports both Go and Python plugins:
 ### Build Configuration
 - Static linking for deployment
 - Version info embedded via ldflags
-- Cross-platform builds supported
\ No newline at end of file
+- Cross-platform builds supported
+
+### Code Standards
+- All code comments must be written in English
+- All documentation must be written in Chinese
```

**File**: `uixt/mcp_server.go` (modified, +1/-1)
```diff
@@ -301,7 +301,7 @@ func extractActionOptionsToArguments(actionOptions []option.ActionOption, argume
 
 	// Add tap/swipe offset options
 	if len(tempOptions.TapOffset) == 2 {
-		arguments["tap_offset"] = tempOptions.TapOffset
+		arguments["offset"] = tempOptions.TapOffset
 	}
 	if len(tempOptions.SwipeOffset) == 4 {
 		arguments["swipe_offset"] = tempOptions.SwipeOffset
```

**File**: `uixt/mcp_server_test.go` (modified, +86/-7)
```diff
@@ -169,27 +169,106 @@ func TestIgnoreNotFoundErrorOption(t *testing.T) {
 func TestExtractActionOptionsToArguments(t *testing.T) {
 	// Test the extractActionOptionsToArguments helper function
 	actionOptions := []option.ActionOption{
+		// Boolean options
 		option.WithIgnoreNotFoundError(true),
-		option.WithMaxRetryTimes(3),
-		option.WithIndex(2),
 		option.WithRegex(true),
 		option.WithTapRandomRect(false), // false should not be included
-		option.WithDuration(1.5),
+		option.WithAntiRisk(true),
+		option.WithPreMarkOperation(true),
+		option.WithResetHistory(true),
+		option.WithMatchOne(true),
+
+		// Numeric options
+		option.WithMaxRetryTimes(3),
+		option.WithIndex(2),
+		option.WithInterval(1.5),
+		option.WithSteps(10),
+		option.WithTimeout(30),
+		option.WithFrequency(5),
+		option.WithDuration(2.0),
+		option.WithPressDuration(1.5),
+
+		// Offset options (including the fixed offset field)
+		option.WithTapOffset(-300, 0),
+		option.WithSwipeOffset(1, 2, 3, 4),
+		option.WithOffsetRandomRange(-5, 5),
+
+		// Scope options
+		option.WithScope(0.1, 0.2, 0.9, 0.8),
+		option.WithAbsScope(100, 200, 900, 800),
+
+		// Screenshot options
+		option.WithScreenShotOCR(true),
+		option.WithScreenShotUpload(true),
+		option.WithScreenShotLiveType(true),
+		option.WithScreenShotLivePopularity(true),
+		option.WithScreenShotClosePopups(true),
+		option.WithScreenOCRCluster("test_cluster"),
+		option.WithScreenShotFileName("test.png"),
+		option.WithScreenShotUITypes("button", "input"),
+
+		// Direction option
+		option.WithDirection("up"),
+
+		// Identifier
+		option.WithIdentifier("test_id"),
 	}
 
 	arguments := make(map[string]any)
 	extractActionOptionsToArguments(actionOptions, arguments)
 
-	// Verify extracted options
+	// Verify boolean options (only true values should be included)
 	assert.Equal(t, true, arguments["ignore_NotFoundError"], "ignore_NotFoundError should be extracted")
-	assert.Equal(t, 3, arguments["max_retry_times"], "max_retry_times should be extracted")
-	assert.Equal(t, 2, arguments["index"], "index should be extracted")
 	assert.Equal(t, true, arguments["regex"], "regex should be extracted")
-	assert.Equal(t, 1.5, arguments["duration"], "duration should be extracted")
+	assert.Equal(t, true, arguments["anti_risk"], "anti_risk should be extracted")
+	assert.Equal(t, true, arguments["pre_mark_operation"], "pre_mark_operation should be extracted")
+	assert.Equal(t, true, arguments["reset_history"], "reset_history should be extracted")
+	assert.Equal(t, true, arguments["match_one"], "match_one should be extracted")
 
 	// tap_random_rect should not be included since it's false
 	_, exists := arguments["tap_random_rect"]
 	assert.False(t, exists, "tap_random_rect should not be included when false")
+
+	// Verify numeric options
+	assert.Equal(t, 3, arguments["max_retry_times"], "max_retry_times should be extracted")
+	assert.Equal(t, 2, arguments["index"], "index should be extracted")
+	assert.Equal(t, 1.5, arguments["interval"], "interval should be extracted")
+	assert.Equal(t, 10, arguments["steps"], "steps should be extracted")
+	assert.Equal(t, 30, arguments["timeout"], "timeout should be extracted")
+	assert.Equal(t, 5, arguments["frequency"], "frequency should be extracted")
+	assert.Equal(t, 2.0, arguments["duration"], "duration should be extracted")
+	assert.Equal(t, 1.5, arguments["press_duration"], "press_duration should be extracted")
+
+	// Verify offset options (including the critical 'offset' field that was fixed)
+	assert.Equal(t, []int{-300, 0}, arguments["offset"], "offset should be extracted (not tap_offset)")
+	assert.Equal(t, []int{1, 2, 3, 4}, arguments["swipe_offset"], "swipe_offset should be extracted")
+	assert.Equal(t, []int{-5, 5}, arguments["offset_random_range"], "offset_random_range should be extracted")
+
+	// Verify scope options (these are custom types, not raw slices)
+	assert.Equal(t, option.Scope([]float64{0.1, 0.2, 0.9, 0.8}), arguments["scope"], "scope should be extracted")
+	assert.Equal(t, option.AbsScope([]int{100, 200, 900, 800}), arguments["abs_scope"], "abs_scope should be extracted")
+
+	// Verify screenshot options
+	assert.Equal(t, true, arguments["screenshot_with_ocr"], "screenshot_with_ocr should be extracted")
+	assert.Equal(t, true, arguments["screenshot_with_upload"], "screenshot_with_upload should be extracted")
+	assert.Equal(t, true, arguments["screenshot_with_live_type"], "screenshot_with_live_type should be extracted")
+	assert.Equal(t, true, arguments["screenshot_with_live_popularity"], "screenshot_with_live_popularity should be extracted")
+	assert.Equal(t, true, arguments["screenshot_with_close_popups"], "screenshot_with_close_popups should be extracted")
+	assert.Equal(t, "test_cluster", arguments["screenshot_with_ocr_cluster"], "screenshot_with_ocr_cluster should be extracted")
+	assert.Equal(t, "test.png", arguments["screenshot_file_name"], "screenshot_file_name should be extracted")
+	assert.Equal(t, []string{"butto
```

---

### Incident Patch 7: `18de536d` (2025-08-13)
**Commit Message**: fix: miss tap offset option

**File**: `CLAUDE.md` (modified, +5/-1)
```diff
@@ -125,4 +125,8 @@ The framework supports both Go and Python plugins:
 ### Build Configuration
 - Static linking for deployment
 - Version info embedded via ldflags
-- Cross-platform builds supported
\ No newline at end of file
+- Cross-platform builds supported
+
+### Code Standards
+- All code comments must be written in English
+- All documentation must be written in Chinese
```

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250812
+v5.0.0-250813
```

**File**: `uixt/mcp_server.go` (modified, +1/-1)
```diff
@@ -301,7 +301,7 @@ func extractActionOptionsToArguments(actionOptions []option.ActionOption, argume
 
 	// Add tap/swipe offset options
 	if len(tempOptions.TapOffset) == 2 {
-		arguments["tap_offset"] = tempOptions.TapOffset
+		arguments["offset"] = tempOptions.TapOffset
 	}
 	if len(tempOptions.SwipeOffset) == 4 {
 		arguments["swipe_offset"] = tempOptions.SwipeOffset
```

**File**: `uixt/mcp_server_test.go` (modified, +86/-7)
```diff
@@ -169,27 +169,106 @@ func TestIgnoreNotFoundErrorOption(t *testing.T) {
 func TestExtractActionOptionsToArguments(t *testing.T) {
 	// Test the extractActionOptionsToArguments helper function
 	actionOptions := []option.ActionOption{
+		// Boolean options
 		option.WithIgnoreNotFoundError(true),
-		option.WithMaxRetryTimes(3),
-		option.WithIndex(2),
 		option.WithRegex(true),
 		option.WithTapRandomRect(false), // false should not be included
-		option.WithDuration(1.5),
+		option.WithAntiRisk(true),
+		option.WithPreMarkOperation(true),
+		option.WithResetHistory(true),
+		option.WithMatchOne(true),
+
+		// Numeric options
+		option.WithMaxRetryTimes(3),
+		option.WithIndex(2),
+		option.WithInterval(1.5),
+		option.WithSteps(10),
+		option.WithTimeout(30),
+		option.WithFrequency(5),
+		option.WithDuration(2.0),
+		option.WithPressDuration(1.5),
+
+		// Offset options (including the fixed offset field)
+		option.WithTapOffset(-300, 0),
+		option.WithSwipeOffset(1, 2, 3, 4),
+		option.WithOffsetRandomRange(-5, 5),
+
+		// Scope options
+		option.WithScope(0.1, 0.2, 0.9, 0.8),
+		option.WithAbsScope(100, 200, 900, 800),
+
+		// Screenshot options
+		option.WithScreenShotOCR(true),
+		option.WithScreenShotUpload(true),
+		option.WithScreenShotLiveType(true),
+		option.WithScreenShotLivePopularity(true),
+		option.WithScreenShotClosePopups(true),
+		option.WithScreenOCRCluster("test_cluster"),
+		option.WithScreenShotFileName("test.png"),
+		option.WithScreenShotUITypes("button", "input"),
+
+		// Direction option
+		option.WithDirection("up"),
+
+		// Identifier
+		option.WithIdentifier("test_id"),
 	}
 
 	arguments := make(map[string]any)
 	extractActionOptionsToArguments(actionOptions, arguments)
 
-	// Verify extracted options
+	// Verify boolean options (only true values should be included)
 	assert.Equal(t, true, arguments["ignore_NotFoundError"], "ignore_NotFoundError should be extracted")
-	assert.Equal(t, 3, arguments["max_retry_times"], "max_retry_times should be extracted")
-	assert.Equal(t, 2, arguments["index"], "index should be extracted")
 	assert.Equal(t, true, arguments["regex"], "regex should be extracted")
-	assert.Equal(t, 1.5, arguments["duration"], "duration should be extracted")
+	assert.Equal(t, true, arguments["anti_risk"], "anti_risk should be extracted")
+	assert.Equal(t, true, arguments["pre_mark_operation"], "pre_mark_operation should be extracted")
+	assert.Equal(t, true, arguments["reset_history"], "reset_history should be extracted")
+	assert.Equal(t, true, arguments["match_one"], "match_one should be extracted")
 
 	// tap_random_rect should not be included since it's false
 	_, exists := arguments["tap_random_rect"]
 	assert.False(t, exists, "tap_random_rect should not be included when false")
+
+	// Verify numeric options
+	assert.Equal(t, 3, arguments["max_retry_times"], "max_retry_times should be extracted")
+	assert.Equal(t, 2, arguments["index"], "index should be extracted")
+	assert.Equal(t, 1.5, arguments["interval"], "interval should be extracted")
+	assert.Equal(t, 10, arguments["steps"], "steps should be extracted")
+	assert.Equal(t, 30, arguments["timeout"], "timeout should be extracted")
+	assert.Equal(t, 5, arguments["frequency"], "frequency should be extracted")
+	assert.Equal(t, 2.0, arguments["duration"], "duration should be extracted")
+	assert.Equal(t, 1.5, arguments["press_duration"], "press_duration should be extracted")
+
+	// Verify offset options (including the critical 'offset' field that was fixed)
+	assert.Equal(t, []int{-300, 0}, arguments["offset"], "offset should be extracted (not tap_offset)")
+	assert.Equal(t, []int{1, 2, 3, 4}, arguments["swipe_offset"], "swipe_offset should be extracted")
+	assert.Equal(t, []int{-5, 5}, arguments["offset_random_range"], "offset_random_range should be extracted")
+
+	// Verify scope options (these are custom types, not raw slices)
+	assert.Equal(t, option.Scope([]float64{0.1, 0.2, 0.9, 0.8}), arguments["scope"], "scope should be extracted")
+	assert.Equal(t, option.AbsScope([]int{100, 200, 900, 800}), arguments["abs_scope"], "abs_scope should be extracted")
+
+	// Verify screenshot options
+	assert.Equal(t, true, arguments["screenshot_with_ocr"], "screenshot_with_ocr should be extracted")
+	assert.Equal(t, true, arguments["screenshot_with_upload"], "screenshot_with_upload should be extracted")
+	assert.Equal(t, true, arguments["screenshot_with_live_type"], "screenshot_with_live_type should be extracted")
+	assert.Equal(t, true, arguments["screenshot_with_live_popularity"], "screenshot_with_live_popularity should be extracted")
+	assert.Equal(t, true, arguments["screenshot_with_close_popups"], "screenshot_with_close_popups should be extracted")
+	assert.Equal(t, "test_cluster", arguments["screenshot_with_ocr_cluster"], "screenshot_with_ocr_cluster should be extracted")
+	assert.Equal(t, "test.png", arguments["screenshot_file_name"], "screenshot_file_name should be extracted")
+	assert.Equal(t, []string{"butto
```

---

### Incident Patch 8: `9b695751` (2025-08-12)
**Commit Message**: Revert "feat: 安卓和iOS安装加锁"

This reverts commit 4c9dd3286c1749df74655d9a055cf9c9d75ab5cd.

**File**: `uixt/android_device.go` (modified, +2/-12)
```diff
@@ -13,7 +13,6 @@ import (
 	"regexp"
 	"strconv"
 	"strings"
-	"sync"
 	"time"
 
 	"github.com/httprunner/funplugin/myexec"
@@ -95,9 +94,8 @@ func NewAndroidDevice(opts ...option.AndroidDeviceOption) (device *AndroidDevice
 
 type AndroidDevice struct {
 	*gadb.Device
-	Options      *option.AndroidDeviceOptions
-	Logcat       *AdbLogcat
-	installMutex sync.Mutex // Mutex to lock installation/uninstallation operations
+	Options *option.AndroidDeviceOptions
+	Logcat  *AdbLogcat
 }
 
 func (dev *AndroidDevice) Setup() error {
@@ -156,10 +154,6 @@ func (dev *AndroidDevice) NewDriver() (driver IDriver, err error) {
 }
 
 func (dev *AndroidDevice) Install(apkPath string, opts ...option.InstallOption) error {
-	// Lock the device for installation
-	dev.installMutex.Lock()
-	defer dev.installMutex.Unlock()
-
 	installOpts := option.NewInstallOptions(opts...)
 	brand, err := dev.Device.Brand()
 	if err != nil {
@@ -267,10 +261,6 @@ func (dev *AndroidDevice) installCommon(apkPath string, args ...string) error {
 }
 
 func (dev *AndroidDevice) Uninstall(packageName string) error {
-	// Lock the device for uninstallation
-	dev.installMutex.Lock()
-	defer dev.installMutex.Unlock()
-
 	_, err := dev.Device.Uninstall(packageName)
 	return err
 }
```

**File**: `uixt/ios_device.go` (modified, +0/-10)
```diff
@@ -7,7 +7,6 @@ import (
 	"fmt"
 	"io"
 	"os"
-	"sync"
 	"time"
 
 	"github.com/Masterminds/semver"
@@ -129,7 +128,6 @@ type IOSDevice struct {
 		listener  *forward.ConnListener
 		localPort int
 	}
-	installMutex sync.Mutex // Mutex to lock installation/uninstallation operations
 }
 
 type DeviceDetail struct {
@@ -267,10 +265,6 @@ func (dev *IOSDevice) NewDriver() (driver IDriver, err error) {
 }
 
 func (dev *IOSDevice) Install(appPath string, opts ...option.InstallOption) (err error) {
-	// Lock the device for installation
-	dev.installMutex.Lock()
-	defer dev.installMutex.Unlock()
-
 	installOpts := option.NewInstallOptions(opts...)
 	for i := 0; i <= installOpts.RetryTimes; i++ {
 		var conn *zipconduit.Connection
@@ -290,10 +284,6 @@ func (dev *IOSDevice) Install(appPath string, opts ...option.InstallOption) (err
 }
 
 func (dev *IOSDevice) Uninstall(bundleId string) error {
-	// Lock the device for uninstallation
-	dev.installMutex.Lock()
-	defer dev.installMutex.Unlock()
-
 	svc, err := installationproxy.New(dev.DeviceEntry)
 	if err != nil {
 		return err
```

---

### Incident Patch 9: `07bfabd5` (2025-08-12)
**Commit Message**: Merge branch 'fix-sleep' into 'master'

refactor: unify float64 conversion logic in ToolSleep and ToolSleepMS, enhance error logging

See merge request iesqa/httprunner!152

**File**: `internal/builtin/utils.go` (modified, +7/-24)
```diff
@@ -217,6 +217,8 @@ func Interface2Float64(i interface{}) (float64, error) {
 	case string: // e.g. "1", "0.5"
 		floatVar, err := strconv.ParseFloat(v, 64)
 		if err != nil {
+			log.Error().Err(err).Str("value", v).
+				Msg("convert string to float64 failed")
 			return 0, err
 		}
 		return floatVar, nil
@@ -226,6 +228,10 @@ func Interface2Float64(i interface{}) (float64, error) {
 	if ok {
 		return value.Float64()
 	}
+
+	// Log error for unsupported types
+	log.Error().Interface("value", i).Type("type", i).
+		Msg("convert float64 failed")
 	return 0, errors.New("failed to convert interface to float64")
 }
 
@@ -334,29 +340,6 @@ func IsZeroFloat64(f float64) bool {
 	return math.Abs(f) < threshold
 }
 
-func ConvertToFloat64(val interface{}) (float64, error) {
-	switch v := val.(type) {
-	case float64:
-		return v, nil
-	case int:
-		return float64(v), nil
-	case int64:
-		return float64(v), nil
-	case string:
-		f, err := strconv.ParseFloat(v, 64)
-		if err != nil {
-			log.Error().Err(err).Str("value", v).
-				Msg("convert string to float64 failed")
-			return 0, err
-		}
-		return f, nil
-	default:
-		log.Error().Interface("value", val).Type("type", val).
-			Msg("convert float64 failed")
-		return 0, errors.New("convert float64 error")
-	}
-}
-
 func ConvertToFloat64Slice(val interface{}) ([]float64, error) {
 	if paramsSlice, ok := val.([]float64); ok {
 		return paramsSlice, nil
@@ -369,7 +352,7 @@ func ConvertToFloat64Slice(val interface{}) ([]float64, error) {
 	var err error
 	float64Slice := make([]float64, len(paramsSlice))
 	for i, v := range paramsSlice {
-		float64Slice[i], err = ConvertToFloat64(v)
+		float64Slice[i], err = Interface2Float64(v)
 		if err != nil {
 			return nil, err
 		}
```

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250811
+v5.0.0-250812
```

**File**: `uixt/mcp_tools_utility.go` (modified, +27/-60)
```diff
@@ -2,9 +2,7 @@ package uixt
 
 import (
 	"context"
-	"encoding/json"
 	"fmt"
-	"strconv"
 	"time"
 
 	"github.com/mark3labs/mcp-go/mcp"
@@ -70,28 +68,12 @@ func (t *ToolSleep) Implement() server.ToolHandlerFunc {
 		// Sleep action logic
 		log.Info().Interface("seconds", seconds).Msg("sleeping")
 
-		var duration time.Duration
-		var actualSeconds float64
-		switch v := seconds.(type) {
-		case float64:
-			actualSeconds = v
-			duration = time.Duration(v*1000) * time.Millisecond
-		case int:
-			actualSeconds = float64(v)
-			duration = time.Duration(v) * time.Second
-		case int64:
-			actualSeconds = float64(v)
-			duration = time.Duration(v) * time.Second
-		case string:
-			s, err := builtin.ConvertToFloat64(v)
-			if err != nil {
-				return nil, fmt.Errorf("invalid sleep duration: %v", v)
-			}
-			actualSeconds = s
-			duration = time.Duration(s*1000) * time.Millisecond
-		default:
-			return nil, fmt.Errorf("unsupported sleep duration type: %T", v)
+		// Use Interface2Float64 for unified type conversion
+		actualSeconds, err := builtin.Interface2Float64(seconds)
+		if err != nil {
+			return nil, fmt.Errorf("invalid sleep duration: %v", seconds)
 		}
+		duration := time.Duration(actualSeconds) * time.Second
 
 		// Extract start_time_ms and use sleepStrict for unified sleep logic
 		startTime, err := extractStartTimeMs(request)
@@ -116,19 +98,19 @@ func (t *ToolSleep) ConvertActionToCallToolRequest(action option.MobileAction) (
 	arguments := map[string]any{}
 
 	var seconds float64
-	if param, ok := action.Params.(json.Number); ok {
-		seconds, _ = param.Float64()
-		arguments["seconds"] = seconds
-	} else if param, ok := action.Params.(int64); ok {
-		seconds = float64(param)
-		arguments["seconds"] = seconds
-	} else if sleepConfig, ok := action.Params.(SleepConfig); ok {
+	if sleepConfig, ok := action.Params.(SleepConfig); ok {
 		// When startTime is provided, pass both seconds and startTime
 		seconds = sleepConfig.Seconds
 		arguments["seconds"] = seconds
 		arguments["start_time_ms"] = sleepConfig.StartTime.UnixMilli()
 	} else {
-		return mcp.CallToolRequest{}, fmt.Errorf("invalid sleep params: %v", action.Params)
+		// Use builtin.Interface2Float64 for unified parameter handling
+		var err error
+		seconds, err = builtin.Interface2Float64(action.Params)
+		if err != nil {
+			return mcp.CallToolRequest{}, fmt.Errorf("invalid sleep params: %v", action.Params)
+		}
+		arguments["seconds"] = seconds
 	}
 
 	return BuildMCPCallToolRequest(t.Name(), arguments, action), nil
@@ -167,28 +149,13 @@ func (t *ToolSleepMS) Implement() server.ToolHandlerFunc {
 		// Sleep MS action logic
 		log.Info().Interface("milliseconds", milliseconds).Msg("sleeping in milliseconds")
 
-		var duration time.Duration
-		var actualMilliseconds int64
-		switch v := milliseconds.(type) {
-		case float64:
-			actualMilliseconds = int64(v)
-			duration = time.Duration(v) * time.Millisecond
-		case int:
-			actualMilliseconds = int64(v)
-			duration = time.Duration(v) * time.Millisecond
-		case int64:
-			actualMilliseconds = v
-			duration = time.Duration(v) * time.Millisecond
-		case string:
-			ms, err := strconv.ParseInt(v, 10, 64)
-			if err != nil {
-				return nil, fmt.Errorf("invalid sleep duration: %v", v)
-			}
-			actualMilliseconds = ms
-			duration = time.Duration(ms) * time.Millisecond
-		default:
-			return nil, fmt.Errorf("unsupported sleep duration type: %T", v)
+		// Use Interface2Float64 for unified type conversion, then convert to int64
+		floatVal, err := builtin.Interface2Float64(milliseconds)
+		if err != nil {
+			return nil, fmt.Errorf("invalid sleep duration: %v", milliseconds)
 		}
+		actualMilliseconds := int64(floatVal)
+		duration := time.Duration(actualMilliseconds) * time.Millisecond
 
 		// Extract start_time_ms and use sleepStrict for unified sleep logic
 		startTime, err := extractStartTimeMs(request)
@@ -212,19 +179,19 @@ func (t *ToolSleepMS) ConvertActionToCallToolRequest(action option.MobileAction)
 	arguments := map[string]any{}
 
 	var milliseconds int64
-	if param, ok := action.Params.(json.Number); ok {
-		milliseconds, _ = param.Int64()
-		arguments["milliseconds"] = milliseconds
-	} else if param, ok := action.Params.(int64); ok {
-		milliseconds = param
-		arguments["milliseconds"] = milliseconds
-	} else if sleepConfig, ok := action.Params.(SleepConfig); ok {
+	if sleepConfig, ok := action.Params.(SleepConfig); ok {
 		// When startTime is provided, pass both milliseconds and startTime
 		milliseconds = sleepConfig.Milliseconds
 		arguments["milliseconds"] = milliseconds
 		arguments["start_time_ms"] = sleepConfig.StartTime.UnixMilli()
 	} else {
-		return mcp.CallToolRequest{}, fmt.Errorf("invalid sleep ms params: %v", action.Params)
+		// Use builtin.Interface2Float64 for unified parameter handling, then convert to int64
+		floatVal, err := builtin.Interface2Float64(action.Params)
+		if err != nil {
+			return mcp.CallToolRequest{}, fmt.Errorf("invalid sleep ms params: %
```

**File**: `uixt/mcp_tools_utility_test.go` (modified, +45/-0)
```diff
@@ -30,6 +30,15 @@ func TestToolSleep_ConvertActionToCallToolRequest(t *testing.T) {
 			expectedArgs: map[string]any{"seconds": float64(3.5)},
 			shouldError:  false,
 		},
+		{
+			name: "float64 parameter",
+			action: option.MobileAction{
+				Method: option.ACTION_Sleep,
+				Params: float64(5.2),
+			},
+			expectedArgs: map[string]any{"seconds": float64(5.2)},
+			shouldError:  false,
+		},
 		{
 			name: "int64 parameter",
 			action: option.MobileAction{
@@ -63,6 +72,24 @@ func TestToolSleep_ConvertActionToCallToolRequest(t *testing.T) {
 			expectedArgs: nil,
 			shouldError:  true,
 		},
+		{
+			name: "json.Number with integer value",
+			action: option.MobileAction{
+				Method: option.ACTION_Sleep,
+				Params: json.Number("10"),
+			},
+			expectedArgs: map[string]any{"seconds": float64(10)},
+			shouldError:  false,
+		},
+		{
+			name: "json.Number with decimal value",
+			action: option.MobileAction{
+				Method: option.ACTION_Sleep,
+				Params: json.Number("1.25"),
+			},
+			expectedArgs: map[string]any{"seconds": float64(1.25)},
+			shouldError:  false,
+		},
 	}
 
 	for _, tt := range tests {
@@ -109,6 +136,15 @@ func TestToolSleepMS_ConvertActionToCallToolRequest(t *testing.T) {
 			expectedArgs: map[string]any{"milliseconds": int64(2000)},
 			shouldError:  false,
 		},
+		{
+			name: "float64 parameter",
+			action: option.MobileAction{
+				Method: option.ACTION_SleepMS,
+				Params: float64(2500.7),
+			},
+			expectedArgs: map[string]any{"milliseconds": int64(2500)},
+			shouldError:  false,
+		},
 		{
 			name: "SleepConfig with startTime",
 			action: option.MobileAction{
@@ -124,6 +160,15 @@ func TestToolSleepMS_ConvertActionToCallToolRequest(t *testing.T) {
 			},
 			shouldError: false,
 		},
+		{
+			name: "json.Number with decimal value",
+			action: option.MobileAction{
+				Method: option.ACTION_SleepMS,
+				Params: json.Number("1234.56"),
+			},
+			expectedArgs: map[string]any{"milliseconds": int64(1234)},
+			shouldError:  false,
+		},
 		{
 			name: "invalid parameter type",
 			action: option.MobileAction{
```

---

### Incident Patch 10: `9cddad0d` (2025-08-12)
**Commit Message**: Merge branch 'fix/add_wings_log' into 'master'

feat: 新增日志

See merge request iesqa/httprunner!151

**File**: `uixt/ai/wings_service.go` (modified, +3/-0)
```diff
@@ -412,6 +412,9 @@ func (w *WingsService) callWingsAPI(ctx context.Context, request WingsActionRequ
 	}
 	defer resp.Body.Close()
 
+	logID := resp.Header.Get("X-Tt-Logid")
+	log.Info().Str("step_text", request.StepText).Str("log_id", logID).Str("biz_id", request.BizId).Str("url", w.apiURL).Msg("call wings api")
+
 	// Read response body
 	responseBody, err := io.ReadAll(resp.Body)
 	if err != nil {
```

---

### Incident Patch 11: `cd056daf` (2025-08-11)
**Commit Message**: Merge branch 'bugfix/huangbin/option_interval' into 'master'

fix: interval option for swipe to tap text

See merge request iesqa/httprunner!150

**File**: `uixt/driver_ext_swipe.go` (modified, +1/-2)
```diff
@@ -100,8 +100,7 @@ func (dExt *XTDriver) SwipeToTapTexts(texts []string, opts ...option.ActionOptio
 	}
 
 	log.Info().Strs("texts", texts).Msg("swipe to tap texts")
-	opts = append(opts, option.WithMatchOne(true), option.WithRegex(true), option.WithInterval(1))
-
+	opts = append([]option.ActionOption{option.WithMatchOne(true), option.WithRegex(true), option.WithInterval(1)}, opts...)
 	// Remove identifier for swipe operations to avoid WDA/UIA2 logging
 	actionOptions := option.NewActionOptions(opts...)
 	actionOptions.Identifier = ""
```

---

### Incident Patch 12: `dbbeea45` (2025-08-11)
**Commit Message**: fix: merge

**File**: `examples/uitest/ios_touch_simulator_test.go` (added, +204/-0)
```diff
@@ -0,0 +1,204 @@
+//go:build localtest
+
+package uitest
+
+import (
+	"os"
+	"testing"
+
+	hrp "github.com/httprunner/httprunner/v5"
+	"github.com/httprunner/httprunner/v5/uixt"
+	"github.com/httprunner/httprunner/v5/uixt/option"
+)
+
+// TestIOSStepMultipleSIMActions tests multiple SIM actions in a step-like manner for iOS
+func TestIOSStepMultipleSIMActions(t *testing.T) {
+	// 创建包含多个 iOS SIM 操作的测试用例
+	testCase := &hrp.TestCase{
+		Config: hrp.NewConfig("iOS多个SIM操作组合测试").SetIOS(option.WithUDID("")),
+		TestSteps: []hrp.IStep{
+			hrp.NewStep("iOS组合SIM操作测试").
+				IOS().
+				SIMClickAtPoint(0.5, 0.5).                              // 点击屏幕中心
+				Sleep(1).                                               // 等待1秒
+				SIMSwipeWithDirection("up", 0.5, 0.7, 200.0, 400.0).    // 向上滑动
+				Sleep(0.5).                                             // 等待0.5秒
+				SIMSwipeInArea("up", 0.2, 0.2, 0.6, 0.6, 350.0, 500.0). // 在区域内向上滑动
+				Sleep(0.5).                                             // 等待0.5秒
+				SIMSwipeFromPointToPoint(0.1, 0.5, 0.9, 0.5).           // 从左到右滑动
+				Sleep(0.5).                                             // 等待0.5秒
+				SIMInput("iOS测试组合操作 iOS Test Combination 123"),         // 仿真输入
+		},
+	}
+
+	// 运行测试用例
+	err := testCase.Dump2JSON("TestIOSStepMultipleSIMActions.json")
+	if err != nil {
+		t.Fatalf("Failed to dump test case: %v", err)
+	}
+	defer func() {
+		// 清理生成的文件
+		_ = os.Remove("TestIOSStepMultipleSIMActions.json")
+	}()
+
+	// 执行测试用例
+	err = hrp.NewRunner(t).Run(testCase)
+	if err != nil {
+		t.Logf("Expected error (no iOS device): %v", err)
+		// 这是预期的错误，因为没有连接 iOS 设备
+		if !containsString(err.Error(), "no attached ios devices") &&
+			!containsString(err.Error(), "device general connection error") {
+			t.Errorf("Unexpected error: %v", err)
+		}
+	}
+
+	t.Logf("Successfully executed multiple iOS SIM actions test (step level)")
+}
+
+// TestIOSDriverDirectSIMFunctions tests iOS SIM functions directly via driver
+func TestIOSDriverDirectSIMFunctions(t *testing.T) {
+	device, err := uixt.NewIOSDevice(
+		option.WithUDID(""),
+	)
+	if err != nil {
+		t.Logf("Expected error (no iOS device): %v", err)
+		// 这是预期的错误，因为没有连接 iOS 设备
+		if !containsString(err.Error(), "no attached ios devices") &&
+			!containsString(err.Error(), "device general connection error") {
+			t.Errorf("Unexpected error: %v", err)
+		}
+		return
+	}
+
+	driver, err := uixt.NewWDADriver(device)
+	if err != nil {
+		t.Logf("Expected error (cannot create driver): %v", err)
+		return
+	}
+	defer driver.TearDown()
+
+	// 验证 WDADriver 实现了 SIMSupport 接口
+	var iDriver uixt.IDriver = driver
+	simSupport, ok := iDriver.(uixt.SIMSupport)
+	if !ok {
+		t.Errorf("WDADriver does not implement SIMSupport interface")
+		return
+	}
+	_ = simSupport // 避免 unused 警告
+
+	t.Run("SIMClickAtPoint", func(t *testing.T) {
+		err := driver.SIMClickAtPoint(0.5, 0.5)
+		if err != nil {
+			t.Logf("SIMClickAtPoint error (expected if no device): %v", err)
+		} else {
+			t.Logf("Successfully executed SIMClickAtPoint at (0.5, 0.5)")
+		}
+	})
+
+	t.Run("SIMSwipeWithDirection", func(t *testing.T) {
+		err := driver.SIMSwipeWithDirection("up", 0.5, 0.7, 200.0, 400.0)
+		if err != nil {
+			t.Logf("SIMSwipeWithDirection error (expected if no device): %v", err)
+		} else {
+			t.Logf("Successfully executed SIMSwipeWithDirection")
+		}
+	})
+
+	t.Run("SIMSwipeInArea", func(t *testing.T) {
+		err := driver.SIMSwipeInArea("up", 0.2, 0.2, 0.6, 0.6, 350.0, 500.0)
+		if err != nil {
+			t.Logf("SIMSwipeInArea error (expected if no device): %v", err)
+		} else {
+			t.Logf("Successfully executed SIMSwipeInArea")
+		}
+	})
+
+	t.Run("SIMSwipeFromPointToPoint", func(t *testing.T) {
+		err := driver.SIMSwipeFromPointToPoint(0.1, 0.5, 0.9, 0.5)
+		if err != nil {
+			t.Logf("SIMSwipeFromPointToPoint error (expected if no device): %v", err)
+		} else {
+			t.Logf("Successfully executed SIMSwipeFromPointToPoint")
+		}
+	})
+
+	t.Run("SIMInput", func(t *testing.T) {
+		err := driver.SIMInput("iOS测试文本 Test iOS Input 123")
+		if err != nil {
+			t.Logf("SIMInput error (expected if no device): %v", err)
+		} else {
+			t.Logf("Successfully executed SIMInput")
+		}
+	})
+}
+
+// TestIOSMCPToolsIntegration tests iOS SIM functions via MCP tools (integration test)
+func TestIOSMCPToolsIntegration(t *testing.T) {
+	// 这个测试验证 MCP 工具层是否正确支持 iOS SIM 功能
+	device, err := uixt.NewIOSDevice(
+		option.WithUDID(""),
+	)
+	if err != nil {
+		t.Logf("Expected error (no iOS device): %v", err)
+		// 验证错误类型
+		if !containsString(err.Error(), "no attached ios devices") &&
+			!containsString(err.Error(), "device general connection error") {
+			t.Errorf("Unexpected error: %v", err)
+		}
+		return
+	}
+
+	// 需要先创建 WDADriver，然后创建 XTDriver
+	wdaDriver, err := uixt.NewWDADriver(device)
+	if err != nil {
+		t.Logf("Cannot create WDADriver: %v", err)
+		return
+	}
+	defer wdaDriver.TearDown()
+
+	xtDriver, err := uixt.NewXTDriver(wdaDriver)
+	if err != nil {
+		t.Logf("Cannot create XTDriver
```

**File**: `internal/config/config.go` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ const (
 	CaseFileName    = "case.json"        // $PWD/results/20060102150405/case.json
 
 	// mobile device path
-	DeviceActionLogFilePath = "/sdcard/Android/data/io.appium.uiautomator2.server/files/hodor"
+	DeviceActionLogFilePath = "/storage/emulated/0/Download/"
 )
 
 type Config struct {
```

**File**: `internal/simulation/device_config.go` (modified, +10/-0)
```diff
@@ -139,6 +139,16 @@ func getDeviceConfig(deviceModel string) DeviceConfig {
 			SizeMax:     225.0,
 		}
 
+		// "Google"
+	case "iphone":
+		return DeviceConfig{
+			DeviceID:    2,
+			PressureMin: 1,
+			PressureMax: 1,
+			SizeMin:     0.03,
+			SizeMax:     0.04,
+		}
+
 	// Default configuration for unknown devices
 	default:
 		return DeviceConfig{
```

**File**: `uixt/android_driver_adb.go` (modified, +3/-4)
```diff
@@ -706,17 +706,16 @@ func (ad *ADBDriver) StopCaptureLog() (result interface{}, err error) {
 		log.Error().Err(err).Msg("failed to close adb log writer")
 	}
 	pointRes := ConvertPoints(ad.Device.Logcat.logs)
-
 	// 没有解析到打点日志，走兜底逻辑
 	if len(pointRes) == 0 {
 		log.Info().Msg("action log is null, use action file >>>")
 		actionLogDirPath := config.GetConfig().ActionLogDirPath()
-		logFilePathPrefix := fmt.Sprintf("%v/data", actionLogDirPath)
 		files := []string{}
-		ad.Device.RunShellCommand("pull", config.DeviceActionLogFilePath, actionLogDirPath)
+		actionLogRegStr := `.*data_\d+\.txt`
+		ad.Device.PullFolder(config.DeviceActionLogFilePath, actionLogDirPath)
 		err = filepath.Walk(actionLogDirPath, func(path string, info fs.FileInfo, err error) error {
 			// 只是需要日志文件
-			if ok := strings.Contains(path, logFilePathPrefix); ok {
+			if ok, _ := regexp.MatchString(actionLogRegStr, path); ok {
 				files = append(files, path)
 			}
 			return nil
```

**File**: `uixt/driver.go` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ var (
 
 	// Ensure drivers implement SIMSupport interface
 	_ SIMSupport = (*UIA2Driver)(nil)
+	_ SIMSupport = (*WDADriver)(nil)
 )
 
 // current implemeted driver: ADBDriver, UIA2Driver, WDADriver, HDCDriver
```

**File**: `uixt/driver_utils.go` (modified, +3/-2)
```diff
@@ -284,8 +284,9 @@ func getSimulationDuration(params []float64) (milliseconds int64) {
 	return 0
 }
 
-// sleepStrict sleeps strict duration with given params
-// startTime is used to correct sleep duration caused by process time
+// sleepStrict sleeps for strict duration with optional start time correction
+// If startTime is zero, acts as normal context-aware sleep
+// If startTime is provided, corrects sleep duration by subtracting elapsed time
 // ctx allows for cancellation during sleep
 func sleepStrict(ctx context.Context, startTime time.Time, strictMilliseconds int64) {
 	var elapsed int64
```

**File**: `uixt/ios_driver_wda.go` (modified, +266/-0)
```diff
@@ -24,6 +24,7 @@ import (
 	"github.com/httprunner/httprunner/v5/internal/builtin"
 	"github.com/httprunner/httprunner/v5/internal/config"
 	"github.com/httprunner/httprunner/v5/internal/json"
+	"github.com/httprunner/httprunner/v5/internal/simulation"
 	"github.com/httprunner/httprunner/v5/uixt/option"
 	"github.com/httprunner/httprunner/v5/uixt/types"
 )
@@ -678,6 +679,13 @@ func (wd *WDADriver) TouchByEvents(events []types.TouchEvent, opts ...option.Act
 			x, y = toX, toY
 		}
 
+		if x, err = wd.toScale(x); err != nil {
+			return err
+		}
+		if y, err = wd.toScale(y); err != nil {
+			return err
+		}
+
 		var actionMap map[string]interface{}
 
 		switch event.Action {
@@ -743,6 +751,201 @@ func (wd *WDADriver) TouchByEvents(events []types.TouchEvent, opts ...option.Act
 	return err
 }
 
+// SIMSwipeWithDirection 向指定方向滑动任意距离
+// direction: 滑动方向 ("up", "down", "left", "right")
+// fromX, fromY: 起始坐标
+// simMinDistance, simMaxDistance: 距离范围，如果相等则为固定距离，否则为随机距离
+func (wd *WDADriver) SIMSwipeWithDirection(direction string, fromX, fromY, simMinDistance, simMaxDistance float64, opts ...option.ActionOption) error {
+	absStartX, absStartY, err := convertToAbsolutePoint(wd, fromX, fromY)
+	if err != nil {
+		return err
+	}
+	// 获取设备型号和配置参数
+	deviceModel := "iphone"
+	deviceParams := simulation.GetRandomDeviceParams(deviceModel)
+
+	log.Info().Str("direction", direction).
+		Float64("startX", absStartX).Float64("startY", absStartY).
+		Float64("minDistance", simMinDistance).Float64("maxDistance", simMaxDistance).
+		Str("deviceModel", deviceModel).
+		Int("deviceID", deviceParams.DeviceID).
+		Float64("pressure", deviceParams.Pressure).
+		Float64("size", deviceParams.Size).
+		Msg("WDADriver.SIMSwipeWithDirection")
+
+	// 导入滑动仿真库
+	simulator := simulation.NewSlideSimulatorAPI(nil)
+
+	// 转换方向字符串为Direction类型
+	var slideDirection simulation.Direction
+	switch direction {
+	case "up":
+		slideDirection = simulation.Up
+	case "down":
+		slideDirection = simulation.Down
+	case "left":
+		slideDirection = simulation.Left
+	case "right":
+		slideDirection = simulation.Right
+	default:
+		return fmt.Errorf("invalid direction: %s, must be one of: up, down, left, right", direction)
+	}
+
+	// 使用滑动仿真算法生成触摸事件序列
+	events, err := simulator.GenerateSlideWithRandomDistance(
+		absStartX, absStartY, slideDirection, simMinDistance, simMaxDistance,
+		deviceParams.DeviceID, deviceParams.Pressure, deviceParams.Size)
+	if err != nil {
+		return fmt.Errorf("generate slide events failed: %v", err)
+	}
+
+	// 执行触摸事件序列
+	return wd.TouchByEvents(events, opts...)
+}
+
+// SIMSwipeInArea 在指定区域内向指定方向滑动任意距离
+// direction: 滑动方向 ("up", "down", "left", "right")
+// simAreaStartX, simAreaStartY, simAreaEndX, simAreaEndY: 区域范围(相对坐标)
+// simMinDistance, simMaxDistance: 距离范围，如果相等则为固定距离，否则为随机距离
+func (wd *WDADriver) SIMSwipeInArea(direction string, simAreaStartX, simAreaStartY, simAreaEndX, simAreaEndY, simMinDistance, simMaxDistance float64, opts ...option.ActionOption) error {
+	// 转换区域坐标为绝对坐标
+	absAreaStartX, absAreaStartY, err := convertToAbsolutePoint(wd, simAreaStartX, simAreaStartY)
+	if err != nil {
+		return err
+	}
+	absAreaEndX, absAreaEndY, err := convertToAbsolutePoint(wd, simAreaEndX, simAreaEndY)
+	if err != nil {
+		return err
+	}
+
+	// 确保区域坐标正确(start应该小于等于end)
+	if absAreaStartX > absAreaEndX {
+		absAreaStartX, absAreaEndX = absAreaEndX, absAreaStartX
+	}
+	if absAreaStartY > absAreaEndY {
+		absAreaStartY, absAreaEndY = absAreaEndY, absAreaStartY
+	}
+
+	// 获取设备型号和配置参数
+	deviceModel := "iphone"
+	deviceParams := simulation.GetRandomDeviceParams(deviceModel)
+
+	log.Info().Str("direction", direction).
+		Float64("areaStartX", absAreaStartX).Float64("areaStartY", absAreaStartY).
+		Float64("areaEndX", absAreaEndX).Float64("areaEndY", absAreaEndY).
+		Float64("minDistance", simMinDistance).Float64("maxDistance", simMaxDistance).
+		Str("deviceModel", deviceModel).
+		Int("deviceID", deviceParams.DeviceID).
+		Float64("pressure", deviceParams.Pressure).
+		Float64("size", deviceParams.Size).
+		Msg("WDADriver.SIMSwipeInArea")
+
+	// 导入滑动仿真库
+	simulator := simulation.NewSlideSimulatorAPI(nil)
+
+	// 转换方向字符串为Direction类型
+	var slideDirection simulation.Direction
+	switch direction {
+	case "up":
+		slideDirection = simulation.Up
+	case "down":
+		slideDirection = simulation.Down
+	case "left":
+		slideDirection = simulation.Left
+	case "right":
+		slideDirection = simulation.Right
+	default:
+		return fmt.Errorf("invalid direction: %s, must be one of: up, down, left, right", direction)
+	}
+
+	// 使用滑动仿真算法生成区域内滑动的触摸事件序列
+	events, err := simulator.GenerateSlideInArea(
+		absAreaStartX, absAreaStartY, absAreaEndX, absAreaEndY,
+		slideDirection, simMinDistance, simMaxDistance,
+		deviceParams.DeviceID, deviceParams.Pressure, deviceParams.Size)
+	if err != nil {
+		return fmt.Errorf("generate slide in area events failed: %v", err)
+	}
+
+	// 执行触摸事件序列
+	return wd.TouchByEvents(events, opts...)
+}
+
+// SIMSwipeFromPointToPoint 指定起始点和结束点进行滑动
```

**File**: `uixt/mcp_tools_utility.go` (modified, +65/-22)
```diff
@@ -15,7 +15,29 @@ import (
 	"github.com/httprunner/httprunner/v5/uixt/option"
 )
 
-// ToolSleep implements the sleep tool call.
+// extractStartTimeMs extracts start_time_ms from MCP request arguments
+// Returns time.Time (zero if not provided) and any conversion error
+func extractStartTimeMs(request mcp.CallToolRequest) (time.Time, error) {
+	startTimeMs, ok := request.GetArguments()["start_time_ms"]
+	if !ok || startTimeMs == nil {
+		return time.Time{}, nil // Return zero time for normal sleep
+	}
+
+	var ms int64
+	switch v := startTimeMs.(type) {
+	case float64:
+		ms = int64(v)
+	case int64:
+		ms = v
+	case int:
+		ms = int64(v)
+	default:
+		return time.Time{}, fmt.Errorf("invalid start_time_ms type: %T", v)
+	}
+
+	return time.UnixMilli(ms), nil
+}
+
 type ToolSleep struct {
 	// Return data fields - these define the structure of data returned by this tool
 	Seconds  float64 `json:"seconds" desc:"Duration in seconds that was slept"`
@@ -33,6 +55,7 @@ func (t *ToolSleep) Description() string {
 func (t *ToolSleep) Options() []mcp.ToolOption {
 	return []mcp.ToolOption{
 		mcp.WithNumber("seconds", mcp.Description("Number of seconds to sleep")),
+		mcp.WithNumber("start_time_ms", mcp.Description("Start time as Unix milliseconds for strict sleep calculation")),
 	}
 }
 
@@ -70,16 +93,15 @@ func (t *ToolSleep) Implement() server.ToolHandlerFunc {
 			return nil, fmt.Errorf("unsupported sleep duration type: %T", v)
 		}
 
-		// Use context-aware sleep instead of blocking time.Sleep
-		select {
-		case <-time.After(duration):
-			// Normal completion
-		case <-ctx.Done():
-			// Interrupted by context cancellation (interrupt signal, timeout, time limit)
-			log.Info().Msg("sleep interrupted by context cancellation")
-			// Don't return error - let the upper layer handle timeout/time limit logic
+		// Extract start_time_ms and use sleepStrict for unified sleep logic
+		startTime, err := extractStartTimeMs(request)
+		if err != nil {
+			return nil, err
 		}
 
+		milliseconds := int64(actualSeconds * 1000)
+		sleepStrict(ctx, startTime, milliseconds)
+
 		message := fmt.Sprintf("Successfully slept for %v seconds", actualSeconds)
 		returnData := ToolSleep{
 			Seconds:  actualSeconds,
@@ -91,9 +113,24 @@ func (t *ToolSleep) Implement() server.ToolHandlerFunc {
 }
 
 func (t *ToolSleep) ConvertActionToCallToolRequest(action option.MobileAction) (mcp.CallToolRequest, error) {
-	arguments := map[string]any{
-		"seconds": action.Params,
+	arguments := map[string]any{}
+
+	var seconds float64
+	if param, ok := action.Params.(json.Number); ok {
+		seconds, _ = param.Float64()
+		arguments["seconds"] = seconds
+	} else if param, ok := action.Params.(int64); ok {
+		seconds = float64(param)
+		arguments["seconds"] = seconds
+	} else if sleepConfig, ok := action.Params.(SleepConfig); ok {
+		// When startTime is provided, pass both seconds and startTime
+		seconds = sleepConfig.Seconds
+		arguments["seconds"] = seconds
+		arguments["start_time_ms"] = sleepConfig.StartTime.UnixMilli()
+	} else {
+		return mcp.CallToolRequest{}, fmt.Errorf("invalid sleep params: %v", action.Params)
 	}
+
 	return BuildMCPCallToolRequest(t.Name(), arguments, action), nil
 }
 
@@ -115,6 +152,7 @@ func (t *ToolSleepMS) Description() string {
 func (t *ToolSleepMS) Options() []mcp.ToolOption {
 	return []mcp.ToolOption{
 		mcp.WithNumber("milliseconds", mcp.Description("Number of milliseconds to sleep")),
+		mcp.WithNumber("start_time_ms", mcp.Description("Start time as Unix milliseconds for strict sleep calculation")),
 	}
 }
 
@@ -152,16 +190,14 @@ func (t *ToolSleepMS) Implement() server.ToolHandlerFunc {
 			return nil, fmt.Errorf("unsupported sleep duration type: %T", v)
 		}
 
-		// Use context-aware sleep instead of blocking time.Sleep
-		select {
-		case <-time.After(duration):
-			// Normal completion
-		case <-ctx.Done():
-			// Interrupted by context cancellation (interrupt signal, timeout, time limit)
-			log.Info().Msg("sleep interrupted by context cancellation")
-			// Don't return error - let the upper layer handle timeout/time limit logic
+		// Extract start_time_ms and use sleepStrict for unified sleep logic
+		startTime, err := extractStartTimeMs(request)
+		if err != nil {
+			return nil, err
 		}
 
+		sleepStrict(ctx, startTime, actualMilliseconds)
+
 		message := fmt.Sprintf("Successfully slept for %d milliseconds", actualMilliseconds)
 		returnData := ToolSleepMS{
 			Milliseconds: actualMilliseconds,
@@ -173,17 +209,24 @@ func (t *ToolSleepMS) Implement() server.ToolHandlerFunc {
 }
 
 func (t *ToolSleepMS) ConvertActionToCallToolRequest(action option.MobileAction) (mcp.CallToolRequest, error) {
+	arguments := map[string]any{}
+
 	var milliseconds int64
 	if param, ok := action.Params.(json.Number); ok {
 		milliseconds, _ = param.Int64()
+		arguments["milliseconds"] = milliseconds
 	} else if param, ok := action.Params.(int64); ok {
 		milliseconds = param
+		arguments["milliseconds"] = milliseconds
+	} else 
```

---

### Incident Patch 13: `2523be58` (2025-08-11)
**Commit Message**: fix: interval option for swipe to tap text

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250806
+v5.0.0-250811
```

**File**: `uixt/driver_ext_swipe.go` (modified, +1/-2)
```diff
@@ -100,8 +100,7 @@ func (dExt *XTDriver) SwipeToTapTexts(texts []string, opts ...option.ActionOptio
 	}
 
 	log.Info().Strs("texts", texts).Msg("swipe to tap texts")
-	opts = append(opts, option.WithMatchOne(true), option.WithRegex(true), option.WithInterval(1))
-
+	opts = append([]option.ActionOption{option.WithMatchOne(true), option.WithRegex(true), option.WithInterval(1)}, opts...)
 	// Remove identifier for swipe operations to avoid WDA/UIA2 logging
 	actionOptions := option.NewActionOptions(opts...)
 	actionOptions.Identifier = ""
```

---

### Incident Patch 14: `d75744fd` (2025-08-11)
**Commit Message**: fix: device_info -> device_infos

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250731
+v5.0.0-250811
```

**File**: `uixt/ai/wings_service.go` (modified, +41/-45)
```diff
@@ -77,11 +77,11 @@ func (w *WingsService) Plan(ctx context.Context, opts *PlanningOptions) (*Planni
 
 	// Prepare Wings API request
 	apiRequest := WingsActionRequest{
-		Historys:   w.history,
-		DeviceInfo: deviceInfo,
-		StepText:   fmt.Sprintf("%s", opts.UserInstruction),
-		BizId:      w.bizId,
-		TextCase:   fmt.Sprintf("整体描述：\n前置条件：\n操作步骤：\n%s\n停止操作。\n注意事项：\n", opts.UserInstruction),
+		Historys:    w.history,
+		DeviceInfos: deviceInfo,
+		StepText:    fmt.Sprintf("%s", opts.UserInstruction),
+		BizId:       w.bizId,
+		TextCase:    fmt.Sprintf("整体描述：\n前置条件：\n操作步骤：\n%s\n停止操作。\n注意事项：\n", opts.UserInstruction),
 		Base: WingsBase{
 			LogID: generateWingsUUID(),
 		},
@@ -112,9 +112,7 @@ func (w *WingsService) Plan(ctx context.Context, opts *PlanningOptions) (*Planni
 
 	// Update history with response data
 	newHistoryEntry := History{
-		Observation:   response.ThoughtChain.Observation,
-		Thought:       response.ThoughtChain.Thought,
-		Summary:       response.ThoughtChain.Summary,
+		ThoughtChain:  response.ThoughtChain,
 		StepText:      response.StepText,
 		StepTextTrans: response.StepTextTrans,
 		OriStepIndex:  response.OriStepIndex,
@@ -169,15 +167,15 @@ func (w *WingsService) Assert(ctx context.Context, opts *AssertOptions) (*Assert
 	cleanScreenshot := w.cleanScreenshotDataURL(opts.Screenshot)
 
 	// Get device info from context (if available)
-	deviceInfo := w.getDeviceInfoFromScreenshot(ctx, cleanScreenshot)
+	deviceInfos := w.getDeviceInfoFromScreenshot(ctx, cleanScreenshot)
 
 	// Prepare Wings API request for assertion
 	apiRequest := WingsActionRequest{
-		Historys:   []History{},
-		DeviceInfo: deviceInfo,
-		StepText:   fmt.Sprintf("断言:%s", opts.Assertion),
-		BizId:      w.bizId,
-		TextCase:   fmt.Sprintf("整体描述：\n前置条件：\n操作步骤：\n断言: %s\n停止操作。\n注意事项：\n", opts.Assertion),
+		Historys:    []History{},
+		DeviceInfos: deviceInfos,
+		StepText:    fmt.Sprintf("断言:%s", opts.Assertion),
+		BizId:       w.bizId,
+		TextCase:    fmt.Sprintf("整体描述：\n前置条件：\n操作步骤：\n断言: %s\n停止操作。\n注意事项：\n", opts.Assertion),
 		Base: WingsBase{
 			LogID: generateWingsUUID(),
 		},
@@ -208,16 +206,13 @@ func (w *WingsService) Assert(ctx context.Context, opts *AssertOptions) (*Assert
 
 	// Update history with response data
 	newHistoryEntry := History{
-		Observation:   response.ThoughtChain.Observation,
-		Thought:       response.ThoughtChain.Thought,
-		Summary:       response.ThoughtChain.Summary,
+		ThoughtChain:  response.ThoughtChain,
 		StepText:      response.StepText,
 		StepTextTrans: response.StepTextTrans,
 		OriStepIndex:  response.OriStepIndex,
-		DeviceID:      deviceInfo[0].DeviceID,
+		DeviceID:      response.DeviceId,
 		AgentType:     response.AgentType,
-		ActionResult:  "", // Always empty as requested
-		DeviceInfos:   &deviceInfo,
+		DeviceInfos:   &apiRequest.DeviceInfos,
 		ActionParams:  response.ActionParams,
 	}
 	w.history = append(w.history, newHistoryEntry)
@@ -269,12 +264,13 @@ func (w *WingsService) RegisterTools(tools []*schema.ToolInfo) error {
 
 // Wings API data structures
 type WingsActionRequest struct {
-	Historys   []History         `json:"historys"`
-	DeviceInfo []WingsDeviceInfo `json:"device_infos"`
-	StepText   string            `json:"step_text"`
-	BizId      string            `json:"biz_id"`
-	TextCase   string            `json:"text_case"`
-	Base       WingsBase         `json:"Base"`
+	Historys    []History         `json:"historys"`
+	DeviceInfos []WingsDeviceInfo `json:"device_infos"`
+	StepText    string            `json:"step_text"`
+	TextCase    string            `json:"text_case"`
+	BizId       string            `json:"biz_id"`
+	TaskType    string            `json:"task_type"`
+	Base        WingsBase         `json:"Base"`
 }
 
 type WingsDeviceInfo struct {
@@ -292,14 +288,16 @@ type WingsBase struct {
 }
 
 type WingsActionResponse struct {
-	AgentType     string            `json:"agent_type" thrift:"agent_type,1,required"`
-	StepText      string            `json:"step_text" thrift:"step_text,2,required"`
-	StepTextTrans string            `json:"step_text_trans" thrift:"step_text_trans,3,required"`
-	OriStepIndex  int               `json:"ori_step_index" thrift:"ori_step_index,4,required"`
-	StepType      string            `json:"step_type" thrift:"step_type,5,required"`
-	ActionParams  string            `json:"action_params" thrift:"action_params,6,required"`
-	ThoughtChain  WingsThoughtChain `json:"thought_chain" thrift:"thought_chain,7,required"`
-	BaseResp      WingsBaseResp     `json:"BaseResp" thrift:"BaseResp,255,optional"`
+	AgentType     string            `json:"agent_type"`
+	StepText      string            `json:"step_text"`
+	StepTextTrans string            `json:"step_text_trans"`
+	OriStepIndex  int               `json:"ori_step_index"`
+	StepType      string            `json:"step_type"`
+	ActionParams  string            `json:"action_params"`
+	DeviceId      string            `json:"device_id"`
+	NextIsFinish  bool              `json:"next
```

**File**: `uixt/driver_ext_ai_test.go` (modified, +1/-1)
```diff
@@ -292,7 +292,7 @@ func TestDriverExt_AIAction(t *testing.T) {
 func TestDriverExt_AIAction_CompareWithAIAction(t *testing.T) {
 	driver := setupDriverExt(t)
 
-	prompt := "[目标导向]向上滑动屏幕2次"
+	prompt := "[目标导向]打开抖音，点击搜索按钮，搜索张杰，进入内容页停止"
 
 	// Test both methods with the same prompt
 	aiResult, aiErr := driver.StartToGoal(context.Background(), prompt)
```

---

### Incident Patch 15: `c7a8fe4a` (2025-08-11)
**Commit Message**: Merge branch 'fix-sleep' into 'master'

修复 sleep 相关工具函数，支持指定 startTime 参数

See merge request iesqa/httprunner!148

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250806
+v5.0.0-250809
```

**File**: `uixt/driver_utils.go` (modified, +3/-2)
```diff
@@ -284,8 +284,9 @@ func getSimulationDuration(params []float64) (milliseconds int64) {
 	return 0
 }
 
-// sleepStrict sleeps strict duration with given params
-// startTime is used to correct sleep duration caused by process time
+// sleepStrict sleeps for strict duration with optional start time correction
+// If startTime is zero, acts as normal context-aware sleep
+// If startTime is provided, corrects sleep duration by subtracting elapsed time
 // ctx allows for cancellation during sleep
 func sleepStrict(ctx context.Context, startTime time.Time, strictMilliseconds int64) {
 	var elapsed int64
```

**File**: `uixt/mcp_tools_utility.go` (modified, +65/-22)
```diff
@@ -15,7 +15,29 @@ import (
 	"github.com/httprunner/httprunner/v5/uixt/option"
 )
 
-// ToolSleep implements the sleep tool call.
+// extractStartTimeMs extracts start_time_ms from MCP request arguments
+// Returns time.Time (zero if not provided) and any conversion error
+func extractStartTimeMs(request mcp.CallToolRequest) (time.Time, error) {
+	startTimeMs, ok := request.GetArguments()["start_time_ms"]
+	if !ok || startTimeMs == nil {
+		return time.Time{}, nil // Return zero time for normal sleep
+	}
+
+	var ms int64
+	switch v := startTimeMs.(type) {
+	case float64:
+		ms = int64(v)
+	case int64:
+		ms = v
+	case int:
+		ms = int64(v)
+	default:
+		return time.Time{}, fmt.Errorf("invalid start_time_ms type: %T", v)
+	}
+
+	return time.UnixMilli(ms), nil
+}
+
 type ToolSleep struct {
 	// Return data fields - these define the structure of data returned by this tool
 	Seconds  float64 `json:"seconds" desc:"Duration in seconds that was slept"`
@@ -33,6 +55,7 @@ func (t *ToolSleep) Description() string {
 func (t *ToolSleep) Options() []mcp.ToolOption {
 	return []mcp.ToolOption{
 		mcp.WithNumber("seconds", mcp.Description("Number of seconds to sleep")),
+		mcp.WithNumber("start_time_ms", mcp.Description("Start time as Unix milliseconds for strict sleep calculation")),
 	}
 }
 
@@ -70,16 +93,15 @@ func (t *ToolSleep) Implement() server.ToolHandlerFunc {
 			return nil, fmt.Errorf("unsupported sleep duration type: %T", v)
 		}
 
-		// Use context-aware sleep instead of blocking time.Sleep
-		select {
-		case <-time.After(duration):
-			// Normal completion
-		case <-ctx.Done():
-			// Interrupted by context cancellation (interrupt signal, timeout, time limit)
-			log.Info().Msg("sleep interrupted by context cancellation")
-			// Don't return error - let the upper layer handle timeout/time limit logic
+		// Extract start_time_ms and use sleepStrict for unified sleep logic
+		startTime, err := extractStartTimeMs(request)
+		if err != nil {
+			return nil, err
 		}
 
+		milliseconds := int64(actualSeconds * 1000)
+		sleepStrict(ctx, startTime, milliseconds)
+
 		message := fmt.Sprintf("Successfully slept for %v seconds", actualSeconds)
 		returnData := ToolSleep{
 			Seconds:  actualSeconds,
@@ -91,9 +113,24 @@ func (t *ToolSleep) Implement() server.ToolHandlerFunc {
 }
 
 func (t *ToolSleep) ConvertActionToCallToolRequest(action option.MobileAction) (mcp.CallToolRequest, error) {
-	arguments := map[string]any{
-		"seconds": action.Params,
+	arguments := map[string]any{}
+
+	var seconds float64
+	if param, ok := action.Params.(json.Number); ok {
+		seconds, _ = param.Float64()
+		arguments["seconds"] = seconds
+	} else if param, ok := action.Params.(int64); ok {
+		seconds = float64(param)
+		arguments["seconds"] = seconds
+	} else if sleepConfig, ok := action.Params.(SleepConfig); ok {
+		// When startTime is provided, pass both seconds and startTime
+		seconds = sleepConfig.Seconds
+		arguments["seconds"] = seconds
+		arguments["start_time_ms"] = sleepConfig.StartTime.UnixMilli()
+	} else {
+		return mcp.CallToolRequest{}, fmt.Errorf("invalid sleep params: %v", action.Params)
 	}
+
 	return BuildMCPCallToolRequest(t.Name(), arguments, action), nil
 }
 
@@ -115,6 +152,7 @@ func (t *ToolSleepMS) Description() string {
 func (t *ToolSleepMS) Options() []mcp.ToolOption {
 	return []mcp.ToolOption{
 		mcp.WithNumber("milliseconds", mcp.Description("Number of milliseconds to sleep")),
+		mcp.WithNumber("start_time_ms", mcp.Description("Start time as Unix milliseconds for strict sleep calculation")),
 	}
 }
 
@@ -152,16 +190,14 @@ func (t *ToolSleepMS) Implement() server.ToolHandlerFunc {
 			return nil, fmt.Errorf("unsupported sleep duration type: %T", v)
 		}
 
-		// Use context-aware sleep instead of blocking time.Sleep
-		select {
-		case <-time.After(duration):
-			// Normal completion
-		case <-ctx.Done():
-			// Interrupted by context cancellation (interrupt signal, timeout, time limit)
-			log.Info().Msg("sleep interrupted by context cancellation")
-			// Don't return error - let the upper layer handle timeout/time limit logic
+		// Extract start_time_ms and use sleepStrict for unified sleep logic
+		startTime, err := extractStartTimeMs(request)
+		if err != nil {
+			return nil, err
 		}
 
+		sleepStrict(ctx, startTime, actualMilliseconds)
+
 		message := fmt.Sprintf("Successfully slept for %d milliseconds", actualMilliseconds)
 		returnData := ToolSleepMS{
 			Milliseconds: actualMilliseconds,
@@ -173,17 +209,24 @@ func (t *ToolSleepMS) Implement() server.ToolHandlerFunc {
 }
 
 func (t *ToolSleepMS) ConvertActionToCallToolRequest(action option.MobileAction) (mcp.CallToolRequest, error) {
+	arguments := map[string]any{}
+
 	var milliseconds int64
 	if param, ok := action.Params.(json.Number); ok {
 		milliseconds, _ = param.Int64()
+		arguments["milliseconds"] = milliseconds
 	} else if param, ok := action.Params.(int64); ok {
 		milliseconds = param
+		arguments["milliseconds"] = milliseconds
+	} else 
```

**File**: `uixt/mcp_tools_utility_test.go` (added, +240/-0)
```diff
@@ -0,0 +1,240 @@
+package uixt
+
+import (
+	"context"
+	"encoding/json"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+
+	"github.com/httprunner/httprunner/v5/uixt/option"
+)
+
+func TestToolSleep_ConvertActionToCallToolRequest(t *testing.T) {
+	tool := &ToolSleep{}
+
+	tests := []struct {
+		name         string
+		action       option.MobileAction
+		expectedArgs map[string]any
+		shouldError  bool
+	}{
+		{
+			name: "json.Number parameter",
+			action: option.MobileAction{
+				Method: option.ACTION_Sleep,
+				Params: json.Number("3.5"),
+			},
+			expectedArgs: map[string]any{"seconds": float64(3.5)},
+			shouldError:  false,
+		},
+		{
+			name: "int64 parameter",
+			action: option.MobileAction{
+				Method: option.ACTION_Sleep,
+				Params: int64(5),
+			},
+			expectedArgs: map[string]any{"seconds": float64(5)},
+			shouldError:  false,
+		},
+		{
+			name: "SleepConfig with startTime",
+			action: option.MobileAction{
+				Method: option.ACTION_Sleep,
+				Params: SleepConfig{
+					StartTime: time.UnixMilli(1691234567890),
+					Seconds:   2.5,
+				},
+			},
+			expectedArgs: map[string]any{
+				"seconds":       2.5,
+				"start_time_ms": int64(1691234567890),
+			},
+			shouldError: false,
+		},
+		{
+			name: "invalid parameter type",
+			action: option.MobileAction{
+				Method: option.ACTION_Sleep,
+				Params: "invalid",
+			},
+			expectedArgs: nil,
+			shouldError:  true,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			request, err := tool.ConvertActionToCallToolRequest(tt.action)
+
+			if tt.shouldError {
+				assert.Error(t, err)
+			} else {
+				require.NoError(t, err)
+				args := request.GetArguments()
+				for key, expectedValue := range tt.expectedArgs {
+					assert.Equal(t, expectedValue, args[key], "Argument %s mismatch", key)
+				}
+			}
+		})
+	}
+}
+
+func TestToolSleepMS_ConvertActionToCallToolRequest(t *testing.T) {
+	tool := &ToolSleepMS{}
+
+	tests := []struct {
+		name         string
+		action       option.MobileAction
+		expectedArgs map[string]any
+		shouldError  bool
+	}{
+		{
+			name: "json.Number parameter",
+			action: option.MobileAction{
+				Method: option.ACTION_SleepMS,
+				Params: json.Number("1500"),
+			},
+			expectedArgs: map[string]any{"milliseconds": int64(1500)},
+			shouldError:  false,
+		},
+		{
+			name: "int64 parameter",
+			action: option.MobileAction{
+				Method: option.ACTION_SleepMS,
+				Params: int64(2000),
+			},
+			expectedArgs: map[string]any{"milliseconds": int64(2000)},
+			shouldError:  false,
+		},
+		{
+			name: "SleepConfig with startTime",
+			action: option.MobileAction{
+				Method: option.ACTION_SleepMS,
+				Params: SleepConfig{
+					StartTime:    time.UnixMilli(1691234567890),
+					Milliseconds: 3000,
+				},
+			},
+			expectedArgs: map[string]any{
+				"milliseconds":  int64(3000),
+				"start_time_ms": int64(1691234567890),
+			},
+			shouldError: false,
+		},
+		{
+			name: "invalid parameter type",
+			action: option.MobileAction{
+				Method: option.ACTION_SleepMS,
+				Params: "invalid",
+			},
+			expectedArgs: nil,
+			shouldError:  true,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			request, err := tool.ConvertActionToCallToolRequest(tt.action)
+
+			if tt.shouldError {
+				assert.Error(t, err)
+			} else {
+				require.NoError(t, err)
+				args := request.GetArguments()
+				for key, expectedValue := range tt.expectedArgs {
+					assert.Equal(t, expectedValue, args[key], "Argument %s mismatch", key)
+				}
+			}
+		})
+	}
+}
+
+func TestSleepStrictTiming(t *testing.T) {
+	// Test that strict sleep properly adjusts for elapsed time
+	startTime := time.Now()
+
+	// Simulate some processing time
+	time.Sleep(50 * time.Millisecond)
+
+	ctx := context.Background()
+
+	// Test sleepStrict with the start time
+	testStart := time.Now()
+	sleepStrict(ctx, startTime, 200) // 200ms total duration
+	actualElapsed := time.Since(testStart)
+
+	// Should sleep approximately 150ms (200ms - 50ms already elapsed)
+	// Allow some tolerance for timing variations
+	expectedSleep := 150 * time.Millisecond
+	assert.Greater(t, actualElapsed, expectedSleep/2, "Sleep too short")
+	assert.Less(t, actualElapsed, expectedSleep*2, "Sleep too long")
+}
+
+func TestSleepCancellation(t *testing.T) {
+	// Test that sleep respects context cancellation
+	ctx, cancel := context.WithCancel(context.Background())
+
+	// Cancel after 50ms
+	go func() {
+		time.Sleep(50 * time.Millisecond)
+		cancel()
+	}()
+
+	start := time.Now()
+	sleepStrict(ctx, time.Time{}, 500) // Try to sleep 500ms
+	elapsed := time.Since(start)
+
+	// Should be cancelled after ~50ms, not sleep full 500ms
+	assert.Less(t, elapsed, 200*time.Millisecond, "Sleep was not properly cancelled")
+}
+
+func TestSleepStrictWithZeroTime(t *testing.T) {
+	// Test sleepStrict behaves like normal sleep when startTime is zero
+	ctx := context.Background()
+
+
```

**File**: `uixt/touch_simulator_test.go` (modified, +0/-36)
```diff
@@ -137,42 +137,6 @@ func TestIOSTouchByEvents(t *testing.T) {
 	t.Logf("Successfully executed touch events: %d events processed", len(events))
 }
 
-func TestIOSTouchByEvents(t *testing.T) {
-	driver := setupWDADriverExt(t)
-
-	// Example touch event data as provided
-	touchEventData := `1752649131556,401.20703,1191.3164,2,1.0,0.03529412,400.20703,400.3164,111586196,111586196,1,0,0
-1752649131595,402.913,1185.0792,2,1.0,0.039215688,300.913,300.0792,111586196,111586236,1,0,2
-1752649131612,410.60825,1164.3806,2,1.0,0.03529412,250.60825,250.3806,111586196,111586250,1,0,2
-1752649131907,709.1758,523.34766,2,1.0,0.03529412,200.1758,200.34766,111586196,111586546,1,0,1`
-
-	// Parse touch events
-	events, err := ParseTouchEvents(touchEventData)
-	if err != nil {
-		t.Fatalf("ParseTouchEvents failed: %v", err)
-	}
-
-	// Check first event
-	firstEvent := events[0]
-	if firstEvent.Action != 0 { // ACTION_DOWN
-		t.Errorf("Expected first event action to be 0 (ACTION_DOWN), got %d", firstEvent.Action)
-	}
-
-	// Check last event
-	lastEvent := events[len(events)-1]
-	if lastEvent.Action != 1 { // ACTION_UP
-		t.Errorf("Expected last event action to be 1 (ACTION_UP), got %d", lastEvent.Action)
-	}
-
-	// Use TouchByEvents with parsed events
-	err = driver.IDriver.(*WDADriver).TouchByEvents(events)
-	if err != nil {
-		t.Fatalf("TouchByEvents failed: %v", err)
-	}
-
-	t.Logf("Successfully executed touch events: %d events processed", len(events))
-}
-
 func TestTouchEventParsing(t *testing.T) {
 	// Test single touch event parsing
 	singleEventData := "1752646457403,456.78418,1574.0195,7,1.0,0.016666668,504.78418,1721.0195,924451292,924451292,1,0,0"
```

#### Recent Merged Pull Requests:
- **PR #1790** (closed): build(deps): bump github.com/quic-go/quic-go from 0.40.1-0.20231203135336-87ef8ec48d55 to 0.49.1 (@dependabot[bot])
- **PR #1788** (closed): build(deps): bump github.com/quic-go/quic-go from 0.40.1-0.20231203135336-87ef8ec48d55 to 0.48.2 (@dependabot[bot])
- **PR #1783** (2025-08-03): fix: convert AI tests from skip statements to build tags (@debugtalk)
- **PR #1776** (closed): fix: 防止对config的环境做意外修改 (@xyzdev-cell)
- **PR #1770** (closed): add prometheus exporter api in master with new profile flag (@bugVanisher)
- **PR #1769** (closed): 支持 skipIf #1398 (@Danny5487401)
- **PR #1733** (2025-08-04): fix skip错误和增加mark功能和增加meta功能收集用例 (@august-jupiter)
- **PR #1727** (closed): 作者你好，python版增加自定义断言、json参数可整体用变量替换、csv中定义用例名，麻烦看下这样实现合理不 (@diaodeng)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

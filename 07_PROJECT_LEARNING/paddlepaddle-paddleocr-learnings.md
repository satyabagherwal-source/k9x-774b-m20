# Forensic Learning Record (Deep Inspection): PaddlePaddle/PaddleOCR

> **Canonical Artifact**: `07_PROJECT_LEARNING/paddlepaddle-paddleocr-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:36:24.962Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `PaddlePaddle/PaddleOCR`
- **Description**: Turn any PDF or image document into structured data for your AI. A powerful, lightweight OCR toolkit that bridges the gap between images/PDFs and LLMs. Supports 100+ languages.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 90464 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api_sdk/go/client.go`
```
// Copyright (c) 2026 PaddlePaddle Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package paddleocr

import (
	"net/http"
	"os"
	"strings"
	"time"
)

type Client struct {
	token          string
	baseURL        string
	jobsURL        string
	requestTimeout time.Duration
	pollTimeout    time.Duration
	clientPlatform string
	httpClient     *http.Client
}

func NewClient(opts ...ClientOption) (*Client, error) {
	c := &Client{
		requestTimeout: 5 * time.Minute,
		pollTimeout:    10 * time.Minute,
	}
	for _, opt := range opts {
		opt(c)
	}
	if c.token == "" {
		c.token = os.Getenv("PADDLEOCR_ACCESS_TOKEN")
	}
	if c.token == "" {
		return nil, &AuthError{PaddleOCRAPIError{Message: "Token is required. Set PADDLEOCR_ACCESS_TOKEN or use WithToken()."}}
	}
	if c.baseURL == "" {
		c.baseURL = os.Getenv("PADDLEOCR_BASE_URL")
	}
	if c.baseURL == "" {
		c.baseURL = DefaultBaseURL
	}
	c.baseURL = strings.TrimRight(c.baseURL, "/")
	c.jobsURL = c.baseURL + apiPath
	if c.httpClient == nil {
		c.httpClient = &http.Client{Timeout: c.requestTimeout}
	}
	return c, nil
}

func (c *Client) setClientPlatformHeader(req *http.Request) {
	if c.clientPlatform != "" {
		req.Header.Set("Client-Platform", c.clientPlatform)
	}
}

```

### Core Architecture Module: `api_sdk/go/doc.go`
```
// Copyright (c) 2026 PaddlePaddle Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package paddleocr provides a Go client for the PaddleOCR official API.
//
// Create a client with NewClient and authenticate with WithToken or the
// PADDLEOCR_ACCESS_TOKEN environment variable. Use OCR for supported OCR models
// and ParseDocument for document parsing models.
// SubmitOCR and SubmitDocumentParsing return an Operation for non-blocking
// status checks with Poll or typed waits with WaitOCR and WaitDocumentParsing.
// SaveResource downloads one result resource URL. SaveOCRResultResources and
// SaveDocumentParsingResultResources save resources from typed result objects
// into an existing directory.
//
// Request timeout and polling timeout are configured separately with
// WithRequestTimeout and WithPollTimeout. Errors are exposed as typed values,
// such as AuthError, InvalidRequestError, APIError, ResponseFormatError, and
// ResultParseError, and are suitable for errors.As.
package paddleocr

```

### Core Architecture Module: `api_sdk/go/errors.go`
```
// Copyright (c) 2026 PaddlePaddle Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package paddleocr

import "fmt"

type PaddleOCRAPIError struct {
	Message string
	Cause   error
}

func (e *PaddleOCRAPIError) Error() string {
	if e.Message == "" && e.Cause != nil {
		return e.Cause.Error()
	}
	return e.Message
}

func (e *PaddleOCRAPIError) Unwrap() error {
	return e.Cause
}

type AuthError struct {
	PaddleOCRAPIError
}

type InvalidRequestError struct {
	PaddleOCRAPIError
}

type APIError struct {
	StatusCode int
	PaddleOCRAPIError
}

func (e *APIError) Error() string {
	return fmt.Sprintf("HTTP %d: %s", e.StatusCode, e.Message)
}

type RateLimitError struct {
	APIError
}

type ServiceUnavailableError struct {
	APIError
}

type JobFailedError struct {
	JobID    string
	ErrorMsg string
	PaddleOCRAPIError
}

func (e *JobFailedError) Error() string {
	return fmt.Sprintf("Job %s failed: %s", e.JobID, e.ErrorMsg)
}

type RequestTimeoutError struct {
	PaddleOCRAPIError
}

type PollTimeoutError struct {
	JobID   string
	Elapsed float64
	PaddleOCRAPIError
}

func (e *PollTimeoutError) Error() string {
	return fmt.Sprintf("Timed out after %.1fs waiting for job %s", e.Elapsed, e.JobID)
}

type NetworkError struct {
	PaddleOCRAPIError
}

type FileNotFoundError struct {
	Path string
	PaddleOCRAPIError
}

func (e *FileNotFoundError) Error() string {
	return fmt.Sprintf("File not found: %s", e.Path)
}

type ResponseFormatError struct {
	PaddleOCRAPIError
}

type ResultParseError struct {
	PaddleOCRAPIError
}

```

### Core Architecture Module: `api_sdk/go/examples/doc_parsing_file/main.go`
```
// Copyright (c) 2026 PaddlePaddle Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"context"
	"fmt"
	"log"

	paddleocr "github.com/PaddlePaddle/PaddleOCR/api_sdk/go"
)

func main() {
	client, err := paddleocr.NewClient()
	if err != nil {
		log.Fatal(err)
	}
	ctx := context.Background()

	// Convenience method (blocks until done)
	result, err := client.ParseDocument(ctx, &paddleocr.DocParsingRequest{
		Model:    paddleocr.PPStructureV3,
		FilePath: "./sample.pdf",
		Options:  &paddleocr.PPStructureV3Options{UseChartRecognition: paddleocr.Bool(true)},
	})
	if err != nil {
		log.Fatal(err)
	}
	for i, page := range result.Pages {
		fmt.Printf("Page %d:\n%s\n", i+1, page.MarkdownText)
	}

	// Manual control with typed job metadata and typed wait methods.
	ocrJob, _ := client.SubmitOCR(ctx, &paddleocr.OCRRequest{FileURL: "https://example.com/f1.pdf"})
	docJob, _ := client.SubmitDocumentParsing(ctx, &paddleocr.DocParsingRequest{
		Model: paddleocr.PPStructureV3, FilePath: "./sample.pdf",
	})

	ocrResult, err := client.WaitOCRResult(ctx, ocrJob.JobID)
	if err != nil {
		log.Printf("OCR job error: %v", err)
	}
	docResult, err := client.WaitDocumentParsingResult(ctx, docJob.JobID)
	if err != nil {
		log.Printf("document parsing job error: %v", err)
	}
	fmt.Printf("OCR done: %v\n", ocrResult)
	fmt.Printf("Document parsing done: %v\n", docResult)
}

```

### Core Architecture Module: `api_sdk/go/examples/ocr_url/main.go`
```
// Copyright (c) 2026 PaddlePaddle Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"context"
	"fmt"
	"log"

	paddleocr "github.com/PaddlePaddle/PaddleOCR/api_sdk/go"
)

func main() {
	client, err := paddleocr.NewClient()
	if err != nil {
		log.Fatal(err)
	}
	ctx := context.Background()

	result, err := client.OCR(ctx, &paddleocr.OCRRequest{
		FileURL: "https://example.com/invoice.pdf",
	})
	if err != nil {
		log.Fatal(err)
	}

	for i, page := range result.Pages {
		fmt.Printf("Page %d: %v\n", i+1, page.PrunedResult)
		fmt.Printf("  Image URL: %s\n", page.OCRImageURL)
	}
}

```

### Core Architecture Module: `api_sdk/go/models.go`
```
// Copyright (c) 2026 PaddlePaddle Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package paddleocr

const (
	PPOCRv5       = "PP-OCRv5"
	PPOCRv5Latin  = "PP-OCRv5-latin"
	PPOCRv6       = "PP-OCRv6"
	PPStructureV3 = "PP-StructureV3"
	PaddleOCRVL   = "PaddleOCR-VL"
	PaddleOCRVL15 = "PaddleOCR-VL-1.5"
	PaddleOCRVL16 = "PaddleOCR-VL-1.6"
)

// IsOCRModel reports whether model is supported by OCR APIs.
func IsOCRModel(model string) bool {
	return model == PPOCRv5 || model == PPOCRv5Latin || model == PPOCRv6
}

// IsDocumentParsingModel reports whether model is supported by document parsing APIs.
func IsDocumentParsingModel(model string) bool {
	switch model {
	case PPStructureV3, PaddleOCRVL, PaddleOCRVL15, PaddleOCRVL16:
		return true
	default:
		return false
	}
}

// IsVLModel reports whether model is a PaddleOCR-VL family model.
func IsVLModel(model string) bool {
	switch model {
	case PaddleOCRVL, PaddleOCRVL15, PaddleOCRVL16:
		return true
	default:
		return false
	}
}

type OCROptions struct {
	UseDocOrientationClassify *bool                  `json:"useDocOrientationClassify,omitempty"`
	UseDocUnwarping           *bool                  `json:"useDocUnwarping,omitempty"`
	UseTextlineOrientation    *bool                  `json:"useTextlineOrientation,omitempty"`
	TextDetLimitSideLen       *int                   `json:"textDetLimitSideLen,omitempty"`
	TextDetLimitType          *string                `json:"textDetLimitType,omitempty"`
	TextDetThresh             *float64               `json:"textDetThresh,omitempty"`
	TextDetBoxThresh          *float64               `json:"textDetBoxThresh,omitempty"`
	TextDetUnclipRatio        *float64               `json:"textDetUnclipRatio,omitempty"`
	TextRecScoreThresh        *float64               `json:"textRecScoreThresh,omitempty"`
	Visualize                 *bool                  `json:"visualize,omitempty"`
	ExtraOptions              map[string]interface{} `json:"-"`
}

type PPStructureV3Options struct {
	UseDocOrientationClassify        *bool                  `json:"useDocOrientationClassify,omitempty"`
	UseDocUnwarping                  *bool                  `json:"useDocUnwarping,omitempty"`
	UseTextlineOrientation           *bool                  `json:"useTextlineOrientation,omitempty"`
	UseSealRecognition               *bool                  `json:"useSealRecognition,omitempty"`
	UseTableRecognition              *bool                  `json:"useTableRecognition,omitempty"`
	UseFormulaRecognition            *bool                  `json:"useFormulaRecognition,omitempty"`
	UseChartRecognition              *bool                  `json:"useChartRecognition,omitempty"`
	UseRegionDetection               *bool                  `json:"useRegionDetection,omitempty"`
	LayoutThreshold                  interface{}            `json:"layoutThreshold,omitempty"`
	LayoutNms                        *bool                  `json:"layoutNms,omitempty"`
	LayoutUnclipRatio                interface{}            `json:"layoutUnclipRatio,omitempty"`
	LayoutMergeBboxesMode            interface{}            `json:"layoutMergeBboxesMode,omitempty"`
	FormatBlockContent               *bool                  `json:"formatBlockContent,omitempty"`
	TextDetLimitSideLen              *int                   `json:"textDetLimitSideLen,omitempty"`
	TextDetLimitType                 *string                `json:"textDetLimitType,omitempty"`
	TextDetThresh                    *float64               `json:"textDetThresh,omitempty"`
	TextDetBoxThresh                 *float64               `json:"textDetBoxThresh,omitempty"`
	TextDetUnclipRatio               *float64               `json:"textDetUnclipRatio,omitempty"`
	TextRecScoreThresh               *float64               `json:"textRecScoreThresh,omitempty"`
	UseWiredTableCellsTransToHtml    *bool                  `json:"useWiredTableCellsTransToHtml,omitempty"`
	UseWirelessTableCellsTransToHtml *bool                  `json:"useWirelessTableCellsTransToHtml,omitempty"`
	UseTableOrientationClassify      *bool                  `json:"useTableOrientationClassify,omitempty"`
	UseOcrResultsWithTableCells      *bool                  `json:"useOcrResultsWithTableCells,omitempty"`
	UseE2eWiredTableRecModel         *bool                  `json:"useE2eWiredTableRecModel,omitempty"`
	UseE2eWirelessTableRecModel      *bool                  `json:"useE2eWirelessTableRecModel,omitempty"`
	MarkdownIgnoreLabels             []string               `json:"markdownIgnoreLabels,omitempty"`
	PrettifyMarkdown                 *bool                  `json:"prettifyMarkdown,omitempty"`
	ShowFormulaNumber                *bool                  `json:"showFormulaNumber,omitempty"`
	ReturnMarkdownImages             *bool                  `json:"returnMarkdownImages,omitempty"`
	OutputFormats                    []string               `json:"outputFormats,omitempty"`
	Visualize                        *bool                  `json:"visualize,omitempty"`
	ExtraOptions                     map[string]interface{} `json:"-"`
}

type PaddleOCRVLOptions struct {
	UseDocOrientationClassify *bool                  `json:"useDocOrientationClassify,omitempty"`
	UseDocUnwarping           *bool                  `json:"useDocUnwarping,omitempty"`
	UseLayoutDetection        *bool                  `json:"useLayoutDetection,omitempty"`
	UseChartRecognition       *bool                  `json:"useChartRecognition,omitempty"`
	UseSealRecognition        *bool                  `json:"useSealRecognition,omitempty"`
	UseOcrForImageBlock       *bool                  `json:"useOcrForImageBlock,omitempty"`
	LayoutThreshold           interface{}            `json:"layoutThreshold,omitempty"`
	LayoutNms                 *bool                  `json:"layoutNms,omitempty"`
	LayoutUnclipRatio         interface{}            `json:"layoutUnclipRatio,omitempty"`
	LayoutMergeBboxesMode     interface{}            `json:"layoutMergeBboxesMode,omitempty"`
	LayoutShapeMode           *string                `json:"layoutShapeMode,omitempty"`
	PromptLabel               *string                `json:"promptLabel,omitempty"`
	FormatBlockContent        *bool                  `json:"formatBlockContent,omitempty"`
	RepetitionPenalty         *float64               `json:"repetitionPenalty,omitempty"`
	Temperature               *float64               `json:"temperature,omitempty"`
	TopP                      *float64               `json:"topP,omitempty"`
	MinPixels                 *int                   `json:"minPixels,omitempty"`
	MaxPixels                 *int                   `json:"maxPixels,omitempty"`
	MaxNewTokens              *int                   `json:"maxNewTokens,omitempty"`
	VlmExtraArgs              map[string]interface{} `json:"vlmExtraArgs,omitempty"`
	MergeLayoutBlocks         *bool                  `json:"mergeLayoutBlocks,omitempty"`
	MarkdownIgnoreLabels      []string               `json:"markdownIgnoreLabels,omitempty"`
	PrettifyMarkdown          *bool                  `json:"prettifyMarkdown,omitempty"`
	ShowFormulaNumber         *bool                  `json:"showFormulaNumber,omitempty"`
	RestructurePages          *bool                  `json:"restructurePages,omitempty"`
	MergeTables               *bool                  `json:"mergeTables,omitempty"`
	RelevelTitles             *bool                  `json:"relevelTitles,omitempty"`
	ReturnMarkdownImages      *bool                  `json:"returnMarkdownImages,omitempty"`
	Out
```

### Core Architecture Module: `api_sdk/go/ocr.go`
```
// Copyright (c) 2026 PaddlePaddle Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package paddleocr

import (
	"context"
	"encoding/json"
)

func (c *Client) OCR(ctx context.Context, req *OCRRequest) (*OCRResult, error) {
	job, err := c.SubmitOCR(ctx, req)
	if err != nil {
		return nil, err
	}
	return c.WaitOCRResult(ctx, job.JobID)
}

// ParseDocument performs document parsing. Blocks until result is ready.
func (c *Client) ParseDocument(ctx context.Context, req *DocParsingRequest) (*DocParsingResult, error) {
	job, err := c.SubmitDocumentParsing(ctx, req)
	if err != nil {
		return nil, err
	}
	return c.WaitDocumentParsingResult(ctx, job.JobID)
}

// SubmitOCR submits an OCR job and returns job metadata for tracking.
func (c *Client) SubmitOCR(ctx context.Context, req *OCRRequest) (*Job, error) {
	if req == nil {
		return nil, &InvalidRequestError{PaddleOCRAPIError{Message: "OCR request is nil"}}
	}
	model := req.Model
	if model == "" {
		model = PPOCRv6
	}
	if !IsOCRModel(model) {
		return nil, &InvalidRequestError{PaddleOCRAPIError{Message: "model is not an OCR model: " + model}}
	}
	jobID, err := c.submit(ctx, model, req.FileURL, req.FilePath, req.Options, req.PageRanges, req.BatchID)
	if err != nil {
		return nil, err
	}
	return &Job{JobID: jobID, Model: model, Task: "ocr", PageRanges: req.PageRanges, BatchID: req.BatchID}, nil
}

// SubmitDocumentParsing submits a document parsing job and returns job metadata for tracking.
func (c *Client) SubmitDocumentParsing(ctx context.Context, req *DocParsingRequest) (*Job, error) {
	if req == nil {
		return nil, &InvalidRequestError{PaddleOCRAPIError{Message: "document parsing request is nil"}}
	}
	model := req.Model
	if model == "" {
		model = PaddleOCRVL16
	}
	if !IsDocumentParsingModel(model) {
		return nil, &InvalidRequestError{PaddleOCRAPIError{Message: "model is not a document parsing model: " + model}}
	}
	jobID, err := c.submit(ctx, model, req.FileURL, req.FilePath, req.Options, req.PageRanges, req.BatchID)
	if err != nil {
		return nil, err
	}
	return &Job{JobID: jobID, Model: model, Task: "document_parsing", PageRanges: req.PageRanges, BatchID: req.BatchID}, nil
}

func (c *Client) WaitOCRResult(ctx context.Context, jobID string) (*OCRResult, error) {
	jsonlData, err := c.pollUntilDone(ctx, jobID)
	if err != nil {
		return nil, err
	}
	return parseOCRResult(jobID, jsonlData)
}

func (c *Client) WaitDocumentParsingResult(ctx context.Context, jobID string) (*DocParsingResult, error) {
	jsonlData, err := c.pollUntilDone(ctx, jobID)
	if err != nil {
		return nil, err
	}
	return parseDocParsingResult(jobID, jsonlData)
}

func (c *Client) GetStatus(ctx context.Context, jobID string) (*JobStatus, error) {
	status, err := c.getJobStatus(ctx, jobID)
	if err != nil {
		return nil, err
	}
	return normalizeStatus(jobID, status)
}

func (c *Client) GetBatchStatus(ctx context.Context, batchID string) (*BatchStatus, error) {
	if batchID == "" {
		return nil, &InvalidRequestError{PaddleOCRAPIError{Message: "batchID is required"}}
	}
	return c.getBatchStatus(ctx, batchID)
}

func (c *Client) submit(ctx context.Context, model, fileURL, filePath string, options interface{}, pageRanges, batchID string) (string, error) {
	if fileURL == "" && filePath == "" {
		return "", &InvalidRequestError{PaddleOCRAPIError{Message: "Either FileURL or FilePath is required."}}
	}
	if fileURL != "" && filePath != "" {
		return "", &InvalidRequestError{PaddleOCRAPIError{Message: "FileURL and FilePath are mutually exclusive."}}
	}

	payload := defaultPayload(model, options)

	if fileURL != "" {
		return c.submitURL(ctx, model, fileURL, payload, pageRanges, batchID)
	}
	return c.submitFile(ctx, model, filePath, payload, pageRanges, batchID)
}

func defaultPayload(model string, options interface{}) interface{} {
	switch typed := options.(type) {
	case *OCROptions:
		if typed != nil {
			return payloadWithExtraOptions(typed)
		}
	case *PPStructureV3Options:
		if typed != nil {
			return payloadWithExtraOptions(typed)
		}
	case *PaddleOCRVLOptions:
		if typed != nil {
			return payloadWithExtraOptions(typed)
		}
	default:
		if options != nil {
			return payloadWithExtraOptions(options)
		}
	}
	if IsOCRModel(model) {
		return payloadWithExtraOptions(&OCROptions{})
	}
	if IsVLModel(model) {
		return payloadWithExtraOptions(&PaddleOCRVLOptions{})
	}
	return payloadWithExtraOptions(&PPStructureV3Options{})
}

func payloadWithExtraOptions(options interface{}) interface{} {
	payloadBytes, _ := json.Marshal(options)
	payload := map[string]interface{}{}
	_ = json.Unmarshal(payloadBytes, &payload)

	var extraOptions map[string]interface{}
	switch typed := options.(type) {
	case *OCROptions:
		extraOptions = typed.ExtraOptions
	case *PPStructureV3Options:
		extraOptions = typed.ExtraOptions
	case *PaddleOCRVLOptions:
		extraOptions = typed.ExtraOptions
	}
	for key, value := range extraOptions {
		payload[key] = value
	}
	return payload
}

func parseOCRResult(jobID string, jsonlData []map[string]interface{}) (*OCRResult, error) {
	result := &OCRResult{JobID: jobID, DataInfo: map[string]interface{}{}}
	for _, lineObj := range jsonlData {
		resultData, ok := lineObj["result"].(map[string]interface{})
		if !ok {
			return nil, &ResultParseError{PaddleOCRAPIError{Message: "OCR result item is missing result"}}
		}
		if dataInfo, ok := resultData["dataInfo"].(map[string]interface{}); ok {
			for key, value := range dataInfo {
				result.DataInfo[key] = value
			}
		}
		ocrResults, ok := resultData["ocrResults"].([]interface{})
		if !ok {
			return nil, &ResultParseError{PaddleOCRAPIError{Message: "OCR result item is missing ocrResults"}}
		}
		for _, item := range ocrResults {
			itemMap, ok := item.(map[string]interface{})
			if !ok {
				return nil, &ResultParseError{PaddleOCRAPIError{Message: "OCR result page is malformed"}}
			}
			if _, ok := itemMap["prunedResult"]; !ok {
				return nil, &ResultParseError{PaddleOCRAPIError{Message: "OCR result page is missing prunedResult"}}
			}
			page := OCRPage{
				PrunedResult:             itemMap["prunedResult"],
				OCRImageURL:              getString(itemMap, "ocrImage"),
				DocPreprocessingImageURL: getString(itemMap, "docPreprocessingImage"),
				InputImageURL:            getString(itemMap, "inputImage"),
				Raw:                      itemMap,
			}
			result.Pages = append(result.Pages, page)
		}
	}
	return result, nil
}

func parseDocParsingResult(jobID string, jsonlData []map[string]interface{}) (*DocParsingResult, error) {
	result := &DocParsingResult{JobID: jobID, DataInfo: map[string]interface{}{}}
	for _, lineObj := range jsonlData {
		resultData, ok := lineObj["result"].(map[string]interface{})
		if !ok {
			return nil, &ResultParseError{PaddleOCRAPIError{Message: "document parsing result item is missing result"}}
		}
		if dataInfo, ok := resultData["dataInfo"].(map[string]interface{}); ok {
			for key, value := range dataInfo {
				result.DataInfo[key] = value
			}
		}
		lpResults, ok := resultData["layoutParsingResults"].([]interface{})
		if !ok {
			return nil, &ResultParseError{PaddleOCRAPIError{Message: "document parsing result item is missing layoutParsingResults"}}
		}
		for _, item := range lpResults {
			itemMap, ok := item.(map[string]interface{})
			if !ok {
				return nil, &ResultParseError{PaddleOCRAPIError{Message: "document parsing result page is malformed"}}
			}
			markdown, ok := itemMap["markdown"].(map[string]interface{})
			if !ok || getString
```

### Core Architecture Module: `api_sdk/go/operation.go`
```
// Copyright (c) 2026 PaddlePaddle Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package paddleocr

import (
	"context"
	"encoding/json"
)

// Operation represents an in-progress job. Use Wait() to block until done,
// or Poll() to check status without blocking.
type Operation struct {
	client *Client
	JobID  string
	model  string
}

// Wait blocks until the job completes and returns the parsed result.
func (op *Operation) Wait(ctx context.Context) (interface{}, error) {
	jsonlData, err := op.client.pollUntilDone(ctx, op.JobID)
	if err != nil {
		return nil, err
	}
	if IsOCRModel(op.model) {
		return parseOCRResult(op.JobID, jsonlData)
	}
	return parseDocParsingResult(op.JobID, jsonlData)
}

// Poll checks the current job status without waiting.
// Returns the status, whether the job is done, and any error.
func (op *Operation) Poll(ctx context.Context) (*JobStatus, bool, error) {
	status, err := op.client.getJobStatus(ctx, op.JobID)
	if err != nil {
		return nil, false, err
	}

	js := &JobStatus{
		JobID:    op.JobID,
		State:    status.State,
		ErrorMsg: status.ErrorMsg,
	}

	if status.ExtractProgress != nil {
		var ep extractProgress
		if err := json.Unmarshal(status.ExtractProgress, &ep); err == nil {
			js.Progress = &Progress{
				TotalPages:     ep.TotalPages,
				ExtractedPages: ep.ExtractedPages,
				StartTime:      ep.StartTime,
				EndTime:        ep.EndTime,
			}
		}
	}

	return js, status.State == "done", nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #17908** (2026-05-24): **PaddleOCR 在线demo bug: 图像一直在抖动**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)  问题链接：https://aistudio.baidu.com/paddleocr/task/file/t-10b4bde00cb0  图像一直在抖动：  ![Image](https://github.com/user-attachments/assets/ef630b3a-9876-4dda-ab79-1b255738c192)  ### 🏃‍♂️ Environment (运行环境)  无  ### 🌰 Minimal Reproducible Example (最小可复现问题的Demo)  无
  **Post-Mortem & Fix Analysis**:
  > 神奇的问题，已反馈前端同学。
  > The issue has no response for a long time and will be closed. You can reopen or new another issue if are still confused.  --- _From Bot_

- **Issue #17651** (2026-03-13): **PaddleOCR VL pipeline crashes with "Pointer C should not be null" on specific landscape pages (vlm worker BLAS error)**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)  ### Bug description  When using PaddleOCR with VL + layout detection enabled, the pipeline crashes on a specific page with the following error:  RuntimeError: Exception from the 'vlm' worker: (InvalidArgument) Pointer C should not be null.   [Hint: C should not be null.]   (at paddle/phi/kernels/funcs/blas/blas_impl.h:1943)  The issue consistently occurs on one specific page, while all other pages in the same document are processed successfully.  ### Observed behavior  - The failing page is a landscape (horizontal) page, but it is correctly oriented. - Rotating the page manually (90°) does NOT resolve the issue. - Changing DPI, enabling angle/orientation classification, or re-running inference does NOT resolve the issue.  ### Expected behavior  The VL pipeline should either: - handle landscape pages correctly, or - gracefully handle empty / invalid layout detections without crashing.      ### 🏃‍♂️ Environment (运行环境)  ### Environment  - PaddleOCR version: latest - OS: Windows - Device: CPU  - Layout model: PP-DocLayoutV2 - VL model: PaddleOCR-VL  ###
  **Post-Mortem & Fix Analysis**:
  > Thanks for the feedback, to continue our investigation, could you please provide the file that caused the pipeline to fail? This will allow us to better diagnose the issue.
  > The issue has no response for a long time and will be closed. You can reopen or new another issue if are still confused.  --- _From Bot_

- **Issue #17647** (2026-02-10): **RuntimeError: Exception from the 'cv' worker: too many values to unpack (expected 2)**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)  华为arm架构服务器使用docker-compose部署PaddleOCR-VL-1.5       paddleocr-vl-api   paddleocr-vlm-server  均启动成功  报错内容如下：  Checking connectivity to the model hosters, this may take a while. To bypass this check, set `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK` to `True`. No model hoster is available! Please check your network connection to one of the following model hoster: HuggingFace (https://huggingface.co), ModelScope (https://modelscope.cn), AIStudio (https://aistudio.baidu.com), or BOS (https://paddle-model-ecology.bj.bcebos.com). Otherwise, only local models can be used. Creating model: ('PP-DocLayoutV3', None) Model files already exist. Using cached files. To redownload, please delete the directory manually: `/home/paddleocr/.paddlex/official_models/PP-DocLayoutV3`. I0205 16:21:45.371529     1 init.cc:238] ENV [CUSTOM_DEVICE_ROOT]=/usr/local/lib/python3.10/dist-packages/paddle_custom_device I0205 16:21:45.371572     1 init.cc:146] Try loading custom device libs from: [/usr/local/lib/python3.10/dist-packages/paddle_custom_device] I0205 16:21:46.059719     1 custo
  **Post-Mortem & Fix Analysis**:
  > ### compose.yml    services:     paddleocr-vl-api:       image: ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlepaddle/paddleocr-vl:latest-huawei-npu-offline       container_name: paddleocr-vl-api       ports:         - 8180:8080       depends_on:         paddleocr-vlm-server:           condition: service_healthy       user: root       restart: unless-stopped       environment:         - VLM_BACKEND=vllm         - ASCEND_RT_VISIBLE_DEVICES=0       command: /bin/bash -c "paddlex --serve --pipeline /home/paddleocr/pipeline_config_vllm.yaml --device npu"       healthcheck:         test: ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]       volumes:         - /usr/local/Ascend/driver:/usr/local/Ascend/driver         - /usr/local/bin/npu-smi:/usr/local/bin/npu-smi         - /usr/local/dcmi:/usr/local/dcmi         - /data/paddle-vl/pipeline_config_vllm.yaml:/home/paddleocr/pipeline_config_vllm.yaml         - /data/paddle-vl:/data/paddle-vl       privileged: true       shm_size: 64
  > Please update to the latest image and try again. I've tested it and it works. 
  >   已解决，参考 https://github.com/PaddlePaddle/PaddleOCR/pull/17650/changes         在 2026-02-10 11:12:32，"CatJuly" ***@***.***> 写道：  CatJuly left a comment (PaddlePaddle/PaddleOCR#17647)  请问是否解决？我也遇到一样的问题  — Reply to this email directly, view it on GitHub, or unsubscribe. You are receiving this because you authored the thread.Message ID: ***@***.***>

- **Issue #17598** (2026-06-03): **DISABLE_MODEL_SOURCE_CHECK or PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK?**
  *Symptoms*:   ### 🐛 Bug  默认情况下会有如下提示：  > Checking connectivity to the model hosters, this may take a while. To bypass this check, set `DISABLE_MODEL_SOURCE_CHECK` to `True`.   但尝试过各种方法设置环境变量都不行。 搜索了代码发现真正起作用的变量名称是`PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK`  ### 🏃‍♂️ Environment  windows python 3.12  ### 🌰 Minimal Reproducible Example  ```python ocr = PaddleOCR(     text_detection_model_name="PP-OCRv5_mobile_det",     text_recognition_model_name="PP-OCRv5_mobile_rec",     use_doc_orientation_classify=False,     use_doc_unwarping=False,     use_textline_orientation=False,     enable_mkldnn=True,     cpu_threads=10, )  result = ocr.predict(TEST_IMAGE) for res in result:     res.print()     res.save_to_img(OUTPUT_DIR)     res.save_to_json(OUTPUT_DIR) ```
  **Post-Mortem & Fix Analysis**:
  >  `export PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True` 我试过是没问题的
  > > `export PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True` 我试过是没问题的  你看清楚我的问题重点了吗
  > > > `export PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True` 我试过是没问题的 >  > 你看清楚我的问题重点了吗  抱歉，确实没看清楚；我拉下来的版本，提示的变量就是PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK，跟你遇到的不一样。你可以看看是不是已经Fix了。

- **Issue #17583** (2026-03-09): **paddleocr vl 1.5印章文本识别是不是有问题**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)  所有线上体验环节印章文本识别都不生效，只抠图不识别  ### 🏃‍♂️ Environment (运行环境)  [modelscope](https://www.modelscope.cn/studios/PaddlePaddle/PaddleOCR-VL-1.5_Online_Demo) [官网](https://aistudio.baidu.com/paddleocr/task?lang=zh-CN)  ### 🌰 Minimal Reproducible Example (最小可复现问题的Demo)  使用印章文本识别功能
  **Post-Mortem & Fix Analysis**:
  > 抱歉给你造成了不便，我们已经定位到问题，目前紧急修复中！
  > > 抱歉给你造成了不便，我们已经定位到问题，目前紧急修复中！  请问是否有相关修复了，什么时候能发版？ 
  > 已经修复了，可以试试新版本

- **Issue #17537** (2026-02-06): **always Run Paddle-TRT Dynamic Shape mode.！！**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)  使用deploy中的cpp_infer，导出为dll，在运行时，ocr_cls总是会进行一次Paddle-TRT Dynamic Shape mode。 1. 一定会进行，除非不使用tensorrt。 2. 选用int8 精度，paddleinference.dll会报错。 3. 无论哪一行代码，都会导致它进行转化。 4. 在第一次运行，也就是config.CollectShapeRangeInfo("./trt_cls_shape.txt");时，图片数量要是多了，会内存泄漏。 5. 从第二次开始，设置了config.EnableTunedTensorRtDynamicShape("./trt_cls_shape.txt", false);一定会进行dynamicshape。 6. 具体的增强细节，都被封装在了CreatePredictor，无从得知具体流程。、‘’ 7.即便EnableSaveOptimModel，也无法直接使用该优化后的模型，跳过编译。 8. 只要没有‘trt_cls_shape.txt’这个文件，图片数量一多，就一定会内存泄漏。   ### 🏃‍♂️ Environment (运行环境)  OS : Windows ppocr 2.10 geforce 4060.   ### 🌰 Minimal Reproducible Example (最小可复现问题的Demo)  #include <windows.h> #include <opencv2/opencv.hpp> #include <iostream> #include <iomanip>  // 用于格式化输出时间 #include "ocr_config.h"  // 定义结果结构体（需要与DLL中的一致） struct OCRPredictResult {     std::vector<std::vector<int>> box;     std::string text;     float score = -1.0f;     float cls_score = 0.0f;     int cls_label = -1; };  // 定义函数指针类型 typedef void* (*InitOcrDetectorFunc)(const OCR_Config*); typedef int (*PredictFunc)(void*, const cv::Mat*, C_OCRPredictResult*
  **Post-Mortem & Fix Analysis**:
  > 抱歉，由于我们精力有限，3.0以下版本暂时无人力维护，感谢您的支持。

- **Issue #17531** (2026-05-08): **windows 上编译cpp_infer 文档不对,无法正常generate 生成vs solution(至少我电脑上一步步安装不对)**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)  CMake GUI 按照文档一步步操作（我甚至放弃了我vcpkg 安装的opencv），最后generate 的时候疯狂报错：OpenCV STATIC: OFF CMake Warning at D:/3rd/opencv/sources/build/install/OpenCVConfig.cmake:190 (message):   Found OpenCV Windows Pack but it has no binaries compatible with your   configuration.    You should manually point CMake variable OpenCV_DIR to your build of OpenCV   library. Call Stack (most recent call first):   CMakeLists.txt:58 (find_package)   CMake Error at CMakeLists.txt:58 (find_package):   Found package configuration file:      D:/3rd/opencv/sources/build/install/OpenCVConfig.cmake    but it set OpenCV_FOUND to FALSE so package "OpenCV" is considered to be   NOT FOUND.  <img width="819" height="664" alt="Image" src="https://github.com/user-attachments/assets/5945a919-116c-490d-8974-c1cefe6bb546" />  最后解决方案是（也就是OPENCV_DIR  OpenCV_DIR 是两个不一样的值，但是文档是一样的）  cmake -S . -B build `   -DOPENCV_DIR=D:/3rd/opencv/sources/build/install `   -DOpenCV_DIR=D:/3rd/opencv/sources/build/install/lib/cmake/opencv4 `   -DPADDLE_LIB=D:/3rd/paddle_inference  (我又复现了一遍，本质是ppocr cmakelist set(OpenC
  **Post-Mortem & Fix Analysis**:
  > This issue is stale because it has been open for 90 days with no activity.
  > This issue was closed because it has been inactive for 14 days since being marked as stale.

- **Issue #17528** (2026-02-22): **Segmentation fault in Docker container**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)    --------------------------------------                                                                                                                                                                                                                                                                                                                                                                                                                                                                    C++ Traceback (most recent call last):                                                                                                                                                                                                                                                                                                                                                                                                                                                                    --------------------------------------                                              
  **Post-Mortem & Fix Analysis**:
  > Hi, thank you for the feedback. Can you provide more information on how this is triggered?
  > The issue has no response for a long time and will be closed. You can reopen or new another issue if are still confused.  --- _From Bot_

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

### Incident Patch 1: `6d2110b7` (2026-06-25)
**Commit Message**: fix v6 docs (#18209)

**File**: `docs/version3.x/pipeline_usage/OCR.en.md` (modified, +14/-8)
```diff
@@ -1287,24 +1287,26 @@ If `save_path` is specified, the visualization results will be saved under `save
 
 The command-line method is for quick testing. For project integration, you can achieve OCR inference with just a few lines of code:  
 
-```python  
-from paddleocr import PaddleOCR  
+```python
+from paddleocr import PaddleOCR
 
+# Uses PP-OCRv6 models by default
 ocr = PaddleOCR(
     use_doc_orientation_classify=False, # Disables document orientation classification model via this parameter
     use_doc_unwarping=False, # Disables text image rectification model via this parameter
     use_textline_orientation=False, # Disables text line orientation classification model via this parameter
 )
 # ocr = PaddleOCR(lang="en") # Uses English model by specifying language parameter
-# ocr = PaddleOCR(ocr_version="PP-OCRv4") # Uses other PP-OCR versions via version parameter
+# ocr = PaddleOCR(ocr_version="PP-OCRv5") # Switches to PP-OCRv5 version via ocr_version parameter
+# ocr = PaddleOCR(ocr_version="PP-OCRv4") # Switches to PP-OCRv4 version via ocr_version parameter
 # ocr = PaddleOCR(device="gpu") # Enables GPU acceleration for model inference via device parameter
 # ocr = PaddleOCR(
 #     text_detection_model_name="PP-OCRv5_mobile_det",
 #     text_recognition_model_name="PP-OCRv5_mobile_rec",
 #     use_doc_orientation_classify=False,
 #     use_doc_unwarping=False,
 #     use_textline_orientation=False,
-# ) # Switch to PP-OCRv5_mobile models
+# ) # Switch to PP-OCRv5 mobile models
 result = ocr.predict("./general_ocr_002.png")  
 for res in result:  
     res.print()  
@@ -2625,14 +2627,16 @@ If you choose `transformers` as the inference engine, make sure the Transformers
 ```python
 from paddleocr import PaddleOCR
 
+# Uses PP-OCRv6 models by default
 ocr = PaddleOCR(
     use_doc_orientation_classify=False, # Disable document orientation classification
     use_doc_unwarping=False, # Disable document unwarping
     use_textline_orientation=False, # Disable textline orientation classification
     engine="transformers",
 )
 # ocr = PaddleOCR(lang="en", engine="transformers") # Use the English model
-# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="transformers") # Use another PP-OCR version
+# ocr = PaddleOCR(ocr_version="PP-OCRv5", engine="transformers") # Switch to PP-OCRv5 version
+# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="transformers") # Switch to PP-OCRv4 version
 # ocr = PaddleOCR(device="gpu", engine="transformers") # Use GPU for inference
 # ocr = PaddleOCR(
 #     text_detection_model_name="PP-OCRv5_server_det",
@@ -2641,7 +2645,7 @@ ocr = PaddleOCR(
 #     use_doc_unwarping=False,
 #     use_textline_orientation=False,
 #     engine="transformers",
-# ) # Switch to the PP-OCRv5_server models
+# ) # Switch to PP-OCRv5 server models
 result = ocr.predict("./general_ocr_002.png")
 for res in result:
     res.print()
@@ -2654,14 +2658,16 @@ If you choose `onnxruntime` as the inference engine, make sure the ONNX Runtime
 ```python
 from paddleocr import PaddleOCR
 
+# Uses PP-OCRv6 models by default
 ocr = PaddleOCR(
     use_doc_orientation_classify=False, # Disable document orientation classification
     use_doc_unwarping=False, # Disable document unwarping
     use_textline_orientation=False, # Disable textline orientation classification
     engine="onnxruntime",
 )
 # ocr = PaddleOCR(lang="en", engine="onnxruntime") # Use the English model
-# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="onnxruntime") # Use another PP-OCR version
+# ocr = PaddleOCR(ocr_version="PP-OCRv5", engine="onnxruntime") # Switch to PP-OCRv5 version
+# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="onnxruntime") # Switch to PP-OCRv4 version
 # ocr = PaddleOCR(device="gpu", engine="onnxruntime") # Use GPU for inference
 # ocr = PaddleOCR(
 #     text_detection_model_name="PP-OCRv5_server_det",
@@ -2670,7 +2676,7 @@ ocr = PaddleOCR(
 #     use_doc_unwarping=False,
 #     use_textline_orientation=False,
 #     engine="onnxr
```

**File**: `docs/version3.x/pipeline_usage/OCR.md` (modified, +12/-6)
```diff
@@ -1274,21 +1274,23 @@ paddleocr ocr -i https://paddle-model-ecology.bj.bcebos.com/paddlex/imgs/demo_im
 ```python
 from paddleocr import PaddleOCR
 
+# 默认使用 PP-OCRv6 模型
 ocr = PaddleOCR(
     use_doc_orientation_classify=False, # 通过 use_doc_orientation_classify 参数指定不使用文档方向分类模型
     use_doc_unwarping=False, # 通过 use_doc_unwarping 参数指定不使用文本图像矫正模型
     use_textline_orientation=False, # 通过 use_textline_orientation 参数指定不使用文本行方向分类模型
 )
 # ocr = PaddleOCR(lang="en") # 通过 lang 参数来使用英文模型
-# ocr = PaddleOCR(ocr_version="PP-OCRv4") # 通过 ocr_version 参数来使用 PP-OCR 其他版本
+# ocr = PaddleOCR(ocr_version="PP-OCRv5") # 通过 ocr_version 参数切换为 PP-OCRv5 版本
+# ocr = PaddleOCR(ocr_version="PP-OCRv4") # 通过 ocr_version 参数切换为 PP-OCRv4 版本
 # ocr = PaddleOCR(device="gpu") # 通过 device 参数使得在模型推理时使用 GPU
 # ocr = PaddleOCR(
 #     text_detection_model_name="PP-OCRv5_server_det",
 #     text_recognition_model_name="PP-OCRv5_server_rec",
 #     use_doc_orientation_classify=False,
 #     use_doc_unwarping=False,
 #     use_textline_orientation=False,
-# ) # 更换 PP-OCRv5_server 模型
+# ) # 使用 PP-OCRv5 的 server 模型
 result = ocr.predict("./general_ocr_002.png")
 for res in result:
     res.print()
@@ -1303,14 +1305,16 @@ for res in result:
 ```python
 from paddleocr import PaddleOCR
 
+# 默认使用 PP-OCRv6 模型
 ocr = PaddleOCR(
     use_doc_orientation_classify=False, # 通过 use_doc_orientation_classify 参数指定不使用文档方向分类模型
     use_doc_unwarping=False, # 通过 use_doc_unwarping 参数指定不使用文本图像矫正模型
     use_textline_orientation=False, # 通过 use_textline_orientation 参数指定不使用文本行方向分类模型
     engine="transformers",
 )
 # ocr = PaddleOCR(lang="en", engine="transformers") # 通过 lang 参数来使用英文模型
-# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="transformers") # 通过 ocr_version 参数来使用 PP-OCR 其他版本
+# ocr = PaddleOCR(ocr_version="PP-OCRv5", engine="transformers") # 通过 ocr_version 参数切换为 PP-OCRv5 版本
+# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="transformers") # 通过 ocr_version 参数切换为 PP-OCRv4 版本
 # ocr = PaddleOCR(device="gpu", engine="transformers") # 通过 device 参数使得在模型推理时使用 GPU
 # ocr = PaddleOCR(
 #     text_detection_model_name="PP-OCRv5_server_det",
@@ -1319,7 +1323,7 @@ ocr = PaddleOCR(
 #     use_doc_unwarping=False,
 #     use_textline_orientation=False,
 #     engine="transformers",
-# ) # 更换 PP-OCRv5_server 模型
+# ) # 使用 PP-OCRv5 的 server 模型
 result = ocr.predict("./general_ocr_002.png")
 for res in result:
     res.print()
@@ -1332,14 +1336,16 @@ for res in result:
 ```python
 from paddleocr import PaddleOCR
 
+# 默认使用 PP-OCRv6 模型
 ocr = PaddleOCR(
     use_doc_orientation_classify=False, # 通过 use_doc_orientation_classify 参数指定不使用文档方向分类模型
     use_doc_unwarping=False, # 通过 use_doc_unwarping 参数指定不使用文本图像矫正模型
     use_textline_orientation=False, # 通过 use_textline_orientation 参数指定不使用文本行方向分类模型
     engine="onnxruntime",
 )
 # ocr = PaddleOCR(lang="en", engine="onnxruntime") # 通过 lang 参数来使用英文模型
-# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="onnxruntime") # 通过 ocr_version 参数来使用 PP-OCR 其他版本
+# ocr = PaddleOCR(ocr_version="PP-OCRv5", engine="onnxruntime") # 通过 ocr_version 参数切换为 PP-OCRv5 版本
+# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="onnxruntime") # 通过 ocr_version 参数切换为 PP-OCRv4 版本
 # ocr = PaddleOCR(device="gpu", engine="onnxruntime") # 通过 device 参数使得在模型推理时使用 GPU
 # ocr = PaddleOCR(
 #     text_detection_model_name="PP-OCRv5_server_det",
@@ -1348,7 +1354,7 @@ ocr = PaddleOCR(
 #     use_doc_unwarping=False,
 #     use_textline_orientation=False,
 #     engine="onnxruntime",
-# ) # 更换 PP-OCRv5_server 模型
+# ) # 使用 PP-OCRv5 的 server 模型
 result = ocr.predict("./general_ocr_002.png")
 for res in result:
     res.print()
```

---

### Incident Patch 2: `1af0448a` (2026-06-22)
**Commit Message**: docs: fix formula rendering issue and optimize ci ignore rule (#18184)

* docs: fix formula rendering issue

* ci: add paths-ignore

* ci: optimize ignore rule

* ci: optimize ignore rule

* ci: fix paddlex version error

* chore: add new line

**File**: `.github/workflows/codestyle.yml` (modified, +8/-0)
```diff
@@ -2,8 +2,16 @@ name: PaddleOCR Code Style Check
 
 on:
   pull_request:
+    paths-ignore:
+      - docs/**
+      - '**/*.md'
+      - .github/**
   push:
     branches: ['main', 'release/*']
+    paths-ignore:
+      - docs/**
+      - '**/*.md'
+      - .github/**
 
 jobs:
   check-code-style:
```

**File**: `.github/workflows/test_gpu.yml` (modified, +9/-1)
```diff
@@ -3,8 +3,16 @@ name: PaddleOCR PR Tests GPU
 on:
   push:
     branches: ["main"]
+    paths-ignore:
+      - docs/**
+      - '**/*.md'
+      - .github/**
   pull_request:
     branches: ["main"]
+    paths-ignore:
+      - docs/**
+      - '**/*.md'
+      - .github/**
   workflow_dispatch:
 env:
   PR_ID: ${{ github.event.pull_request.number }}
@@ -49,7 +57,7 @@ jobs:
               skip_gpu=false
               break
             fi
-            if [[ "$file" == paddleocr-js/* ]] || [[ "$file" == langchain-paddleocr/* ]] || [[ "$file" == skills/* ]] || [[ "$file" == mcp_server/* ]] || [[ "$file" == deploy/* ]] || [[ "$file" == *.md ]] || [[ "$file" == *.txt ]] || [[ "$file" == *.yml ]] || [[ "$file" == *.yaml ]]; then
+            if [[ "$file" == docs/* ]] || [[ "$file" == paddleocr-js/* ]] || [[ "$file" == langchain-paddleocr/* ]] || [[ "$file" == skills/* ]] || [[ "$file" == mcp_server/* ]] || [[ "$file" == deploy/* ]] || [[ "$file" == *.md ]] || [[ "$file" == *.txt ]] || [[ "$file" == *.yml ]] || [[ "$file" == *.yaml ]]; then
               continue
             fi
             skip_gpu=false
```

**File**: `.github/workflows/tests.yml` (modified, +2/-0)
```diff
@@ -80,6 +80,8 @@ jobs:
           echo "Failed to determine PaddleX version requirement from pyproject.toml" >&2
           exit 1
         fi
+
+        python -m pip install "paddlex>=3.7.0,<3.8.0"
         PADDLEX_BRANCH="release/${PADDLEX_SERIES}"
         echo "Installing PaddleX from branch: ${PADDLEX_BRANCH}"
         python -m pip install -e ".${PADDLEOCR_EXTRAS}" "paddlex@git+https://github.com/PaddlePaddle/PaddleX.git@${PADDLEX_BRANCH}"
```

**File**: `docs/javascripts/katex.js` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+document$.subscribe(({ body }) => {
+  renderMathInElement(body, {
+    delimiters: [
+      { left: "$$",  right: "$$",  display: true },
+      { left: "$",   right: "$",   display: false },
+      { left: "\\(", right: "\\)", display: false },
+      { left: "\\[", right: "\\]", display: true }
+    ],
+  })
+})
```

**File**: `docs/version3.x/algorithm/PP-OCRv6/PP-OCRv6.md` (modified, +5/-7)
```diff
@@ -14,8 +14,6 @@ PP-OCRv6 的主要贡献如下：
 
 <p align="center">图：PP-OCRv6 与 PP-OCRv5 及视觉语言模型的性能对比。左：文本检测平均 Hmean（%）；右：文本识别加权平均准确率（%）。</p>
 
-
-
 # 二、核心技术升级
 
 ## 1. 统一骨干网络 PPLCNetV4
@@ -253,8 +251,8 @@ paddleocr ocr -i general_ocr_002.png \
 
 # 七、部署与二次开发
 
-* **多系统支持**：兼容 Windows、Linux、Mac 等主流操作系统。
-* **多硬件支持**：支持英伟达 GPU、Intel CPU、昆仑芯、昇腾等硬件推理和部署。
-* **高性能推理插件**：推荐结合高性能推理插件进一步提升推理速度，详见[高性能推理指南](../../inference_deployment/local_inference/high_performance_inference.md)。
-* **服务化部署**：支持高稳定性服务化部署方案，详见[服务化部署指南](../../inference_deployment/serving/serving.md)。
-* **二次开发能力**：支持自定义数据集训练、字典扩展、模型微调，详见[文本检测模块使用教程](../../module_usage/text_detection.md)及[文本识别模块使用教程](../../module_usage/text_recognition.md)。
+- **多系统支持**：兼容 Windows、Linux、Mac 等主流操作系统。
+- **多硬件支持**：支持英伟达 GPU、Intel CPU、昆仑芯、昇腾等硬件推理和部署。
+- **高性能推理插件**：推荐结合高性能推理插件进一步提升推理速度，详见[高性能推理指南](../../inference_deployment/local_inference/high_performance_inference.md)。
+- **服务化部署**：支持高稳定性服务化部署方案，详见[服务化部署指南](../../inference_deployment/serving/serving.md)。
+- **二次开发能力**：支持自定义数据集训练、字典扩展、模型微调，详见[文本检测模块使用教程](../../module_usage/text_detection.md)及[文本识别模块使用教程](../../module_usage/text_recognition.md)。
```

---

### Incident Patch 3: `f0bef31f` (2026-06-12)
**Commit Message**: fix inference_engine doc (#18153)

**File**: `docs/version3.x/inference_deployment/local_inference/inference_engine.en.md` (modified, +11/-1)
```diff
@@ -119,7 +119,17 @@ Common fields include:
 
 Common fields include:
 
-- `device_type` / `device_id`: inference device type and device index.
+- `device_type` / `device_id`: inference device type and device index;
+- `providers`: list of execution providers (e.g., `CUDAExecutionProvider`, `CPUExecutionProvider`);
+- `provider_options`: provider-specific configuration;
+- `graph_optimization_level`: graph optimization level;
+- `intra_op_num_threads`: number of intra-op threads;
+- `inter_op_num_threads`: number of inter-op threads;
+- `execution_mode`: execution mode (e.g., `sequential`, `parallel`);
+- `log_severity_level`: log severity level;
+- `enable_mem_pattern`: whether to enable memory pattern;
+- `enable_cpu_mem_arena`: whether to enable CPU memory arena;
+- `session_options`: ONNX Runtime session options.
 
 #### 4.2.1 Flat vs. bucketed `engine_config`
 
```

**File**: `docs/version3.x/inference_deployment/local_inference/inference_engine.md` (modified, +11/-1)
```diff
@@ -119,7 +119,17 @@ python -m pip install onnxruntime-gpu
 
 常见字段包括：
 
-- `device_type` / `device_id`：推理设备类型和设备编号。
+- `device_type` / `device_id`：推理设备类型和设备编号；
+- `providers`：执行提供者列表（如 `CUDAExecutionProvider`、`CPUExecutionProvider`）；
+- `provider_options`：执行提供者专属配置；
+- `graph_optimization_level`：图优化级别；
+- `intra_op_num_threads`：节点内线程数；
+- `inter_op_num_threads`：节点间线程数；
+- `execution_mode`：执行模式（如 `sequential`、`parallel`）；
+- `log_severity_level`：日志严重级别；
+- `enable_mem_pattern`：是否启用内存模式；
+- `enable_cpu_mem_arena`：是否启用 CPU 内存池；
+- `session_options`：ONNX Runtime 会话选项。
 
 #### 4.2.1 扁平与分桶 `engine_config`
 
```

---

### Incident Patch 4: `83c5b7ba` (2026-06-12)
**Commit Message**: fix v6 docs (#18149)

**File**: `docs/version3.x/module_usage/text_detection.en.md` (modified, +5/-3)
```diff
@@ -25,7 +25,7 @@ The text detection module is a critical component of OCR (Optical Character Reco
 <tbody>
 <tr>
 <td>PP-OCRv6_medium_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">Inference Model</a>/<a href="">Training Model</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">Inference Model</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_medium_det_pretrained.pdparams">Training Model</a></td>
 <td>86.2*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -34,7 +34,7 @@ The text detection module is a critical component of OCR (Optical Character Reco
 </tr>
 <tr>
 <td>PP-OCRv6_small_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">Inference Model</a>/<a href="">Training Model</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">Inference Model</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_small_det_pretrained.pdparams">Training Model</a></td>
 <td>84.1*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -43,7 +43,7 @@ The text detection module is a critical component of OCR (Optical Character Reco
 </tr>
 <tr>
 <td>PP-OCRv6_tiny_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">Inference Model</a>/<a href="">Training Model</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">Inference Model</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_tiny_det_pretrained.pdparams">Training Model</a></td>
 <td>80.6*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -89,6 +89,8 @@ The text detection module is a critical component of OCR (Optical Character Reco
 </tbody>
 </table>
 
+> *Note: PP-OCRv6 metrics are evaluated on an internal multi-scenario evaluation set, while PP-OCRv5/v4 metrics are based on a general evaluation set. As the evaluation sets differ, the metrics are not directly comparable.
+
 <strong>Testing Environment:</strong>
 
   <ul>
```

**File**: `docs/version3.x/module_usage/text_detection.md` (modified, +5/-3)
```diff
@@ -25,7 +25,7 @@ comments: true
 <tbody>
 <tr>
 <td>PP-OCRv6_medium_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">推理模型</a>/<a href="">训练模型</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">推理模型</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_medium_det_pretrained.pdparams">训练模型</a></td>
 <td>86.2*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -34,7 +34,7 @@ comments: true
 </tr>
 <tr>
 <td>PP-OCRv6_small_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">推理模型</a>/<a href="">训练模型</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">推理模型</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_small_det_pretrained.pdparams">训练模型</a></td>
 <td>84.1*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -43,7 +43,7 @@ comments: true
 </tr>
 <tr>
 <td>PP-OCRv6_tiny_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">推理模型</a>/<a href="">训练模型</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">推理模型</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_tiny_det_pretrained.pdparams">训练模型</a></td>
 <td>80.6*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -89,6 +89,8 @@ comments: true
 </tbody>
 </table>
 
+> *注：PP-OCRv6 指标基于内部多场景评估集测得，PP-OCRv5/v4 指标基于通用评估集测得，两者评估集不同，指标不可直接对比。
+
 <strong>测试环境说明:</strong>
 
   <ul>
```

**File**: `docs/version3.x/module_usage/text_recognition.en.md` (modified, +2/-0)
```diff
@@ -105,6 +105,8 @@ en_PP-OCRv4_mobile_rec_infer.tar">Inference Model</a>/<a href="https://paddle-mo
 </tr>
 </table>
 
+> *Note: PP-OCRv6 metrics are evaluated on an internal multi-scenario evaluation set, while PP-OCRv5/v4 metrics are based on a general evaluation set. As the evaluation sets differ, the metrics are not directly comparable.
+
 > ❗ The above lists the <b>4 core models</b> mainly supported by the text recognition module. The module supports a total of <b>20 full models</b>, including multiple multilingual text recognition models. The complete model list is as follows:
 
 <details><summary> 👉Model List Details</summary>
```

**File**: `docs/version3.x/module_usage/text_recognition.md` (modified, +2/-0)
```diff
@@ -105,6 +105,8 @@ en_PP-OCRv4_mobile_rec_infer.tar">推理模型</a>/<a href="https://paddle-model
 </tr>
 </table>
 
+> *注：PP-OCRv6 指标基于内部多场景评估集测得，PP-OCRv5/v4 指标基于通用评估集测得，两者评估集不同，指标不可直接对比。
+
 > ❗ 以上列出的是文本识别模块重点支持的<b>4个核心模型</b>，该模块总共支持<b>20个全量模型</b>，包含多个多语言文本识别模型，完整的模型列表如下：
 
 <details><summary> 👉模型列表详情</summary>
```

**File**: `docs/version3.x/pipeline_usage/OCR.en.md` (modified, +8/-3)
```diff
@@ -131,7 +131,7 @@ In this pipeline, you can select models based on the benchmark test data provide
 <tbody>
 <tr>
 <td>PP-OCRv6_medium_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">Inference Model</a>/<a href="">Training Model</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">Inference Model</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_medium_det_pretrained.pdparams">Training Model</a></td>
 <td>86.2*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -140,7 +140,7 @@ In this pipeline, you can select models based on the benchmark test data provide
 </tr>
 <tr>
 <td>PP-OCRv6_small_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">Inference Model</a>/<a href="">Training Model</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">Inference Model</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_small_det_pretrained.pdparams">Training Model</a></td>
 <td>84.1*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -149,7 +149,7 @@ In this pipeline, you can select models based on the benchmark test data provide
 </tr>
 <tr>
 <td>PP-OCRv6_tiny_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">Inference Model</a>/<a href="">Training Model</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">Inference Model</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_tiny_det_pretrained.pdparams">Training Model</a></td>
 <td>80.6*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -194,6 +194,9 @@ In this pipeline, you can select models based on the benchmark test data provide
 </tr>
 </tbody>
 </table>
+
+> *Note: PP-OCRv6 metrics are evaluated on an internal multi-scenario evaluation set, while PP-OCRv5/v4 metrics are based on a general evaluation set. As the evaluation sets differ, the metrics are not directly comparable.
+
 </details>
 
 <details>
@@ -291,6 +294,8 @@ en_PP-OCRv4_mobile_rec_infer.tar">Inference Model</a>/<a href="https://paddle-mo
 </tr>
 </table>
 
+> *Note: PP-OCRv6 metrics are evaluated on an internal multi-scenario evaluation set, while PP-OCRv5/v4 metrics are based on a general evaluation set. As the evaluation sets differ, the metrics are not directly comparable.
+
 > ❗ The above section lists the <b>6 core models</b> that are primarily supported by the text recognition module. In total, the module supports <b>20 comprehensive models</b>, including multiple multilingual text recognition models. Below is the complete list of models:
 
 <details><summary> 👉Details of the Model List</summary>
```

---

### Incident Patch 5: `03451421` (2026-06-11)
**Commit Message**: fix readme (#18142)

**File**: `README.md` (modified, +0/-1)
```diff
@@ -70,7 +70,6 @@ English | [简体中文](./readme/README_cn.md) | [繁體中文](./readme/README
     - **Specialized scenarios**: Major improvements in digital displays, dot-matrix characters, tire prints, and industrial text recognition.
     - **Faster inference**: 5.2× CPU speedup (OpenVINO), 6.1× on Apple M4 (tiny), 0.13s on A100 GPU.
     - **Three tiers for all scenarios**: tiny (1.5M) / small (7.7M) / medium (34.5M) for edge, mobile, and server deployment.
-    - **Documentation**: [PP-OCRv6 Technical Doc](https://paddlepaddle.github.io/PaddleOCR/latest/version3.x/algorithm/PP-OCRv6/PP-OCRv6.en.html)
 
 <details>
 <summary><strong>2026.05.28: Release of PaddleOCR 3.6.0</strong></summary>
```

**File**: `readme/README_ar.md` (modified, +0/-1)
```diff
@@ -71,7 +71,6 @@
     - **سيناريوهات متخصصة**: تحسينات كبيرة في الشاشات الرقمية وأحرف المصفوفة النقطية وبصمات الإطارات والنصوص الصناعية.
     - **استدلال أسرع**: تسريع 5.2× على CPU (OpenVINO)، 6.1× على Apple M4 (tiny)، 0.13 ثانية على A100 GPU.
     - **ثلاثة مستويات لجميع السيناريوهات**: tiny (1.5M) / small (7.7M) / medium (34.5M) للأجهزة الطرفية والمحمولة والخوادم.
-    - **التوثيق**: [وثائق PP-OCRv6 التقنية](https://paddlepaddle.github.io/PaddleOCR/latest/version3.x/algorithm/PP-OCRv6/PP-OCRv6.en.html)
 
 <details>
 <summary><strong>2026.05.28: إصدار PaddleOCR 3.6.0</strong></summary>
```

**File**: `readme/README_cn.md` (modified, +0/-1)
```diff
@@ -69,7 +69,6 @@
     - **专业场景增强**：数码显示屏、点阵字符、轮胎印字、工业字符等传统 VLM 难以覆盖的场景识别能力大幅提升。
     - **推理速度更快**：medium 档 CPU OpenVINO 推理加速 5.2×，tiny 档 Apple M4 加速 6.1×，A100 上仅需 0.13s。
     - **三档模型覆盖全场景**：tiny（1.5M）/ small（7.7M）/ medium（34.5M）分别面向端侧/移动端/服务端部署。
-    - **详细文档**：[PP-OCRv6 技术文档](https://paddlepaddle.github.io/PaddleOCR/latest/version3.x/algorithm/PP-OCRv6/PP-OCRv6.html)
 
 <details>
 <summary><strong>2026.05.28: PaddleOCR 3.6.0 发布</strong></summary>
```

**File**: `readme/README_es.md` (modified, +0/-1)
```diff
@@ -69,7 +69,6 @@
     - **Escenarios especializados**: Mejoras significativas en pantallas digitales, caracteres de matriz de puntos, impresiones de neumáticos y texto industrial.
     - **Inferencia más rápida**: Aceleración 5.2× en CPU (OpenVINO), 6.1× en Apple M4 (tiny), 0.13s en A100 GPU.
     - **Tres niveles para todos los escenarios**: tiny (1.5M) / small (7.7M) / medium (34.5M) para despliegue en edge, móvil y servidor.
-    - **Documentación**: [Documentación técnica de PP-OCRv6](https://paddlepaddle.github.io/PaddleOCR/latest/version3.x/algorithm/PP-OCRv6/PP-OCRv6.en.html)
 
 <details>
 <summary><strong>2026.05.28: Lanzamiento de PaddleOCR 3.6.0</strong></summary>
```

**File**: `readme/README_fr.md` (modified, +0/-1)
```diff
@@ -69,7 +69,6 @@
     - **Scénarios spécialisés** : Améliorations majeures pour les écrans numériques, caractères matriciels, empreintes de pneus et texte industriel.
     - **Inférence plus rapide** : Accélération 5.2× CPU (OpenVINO), 6.1× sur Apple M4 (tiny), 0.13s sur A100 GPU.
     - **Trois niveaux pour tous les scénarios** : tiny (1.5M) / small (7.7M) / medium (34.5M) pour le déploiement edge, mobile et serveur.
-    - **Documentation** : [Documentation technique PP-OCRv6](https://paddlepaddle.github.io/PaddleOCR/latest/version3.x/algorithm/PP-OCRv6/PP-OCRv6.en.html)
 
 <details>
 <summary><strong>2026.05.28 : Publication de PaddleOCR 3.6.0</strong></summary>
```

---

### Incident Patch 6: `b53e29e8` (2026-06-11)
**Commit Message**: Fix PaddleOCR-VL HPS pipeline not using the vLLM server (#18129)

* Fix PaddleOCR-VL HPS pipeline not using the vLLM server

The PaddleOCR-VL-1.6 HPS SDK ships a pipeline_config.yaml with
`genai_config.backend: native`, which makes the pipeline run the VLM
inside the Triton container instead of calling the dedicated vLLM
server deployed by compose.yaml. The vLLM server stays completely idle
while inference runs unbatched in the pipeline container, causing much
higher latency (~10x slower per image in our tests) and ~2 GiB of extra
GPU memory for the duplicated model weights.

Patch the config in prepare.sh to use `backend: vllm-server` with the
compose service URL, matching the configuration shipped with the 1.5
SDK. Also restore batch_size from -1 to 4096 as in 1.5.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

* Remove explanatory comment per review

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

---------

Co-authored-by: Claude Fable 5 <noreply@anthropic.com>

**File**: `deploy/paddleocr_vl_docker/hps/prepare.sh` (modified, +8/-0)
```diff
@@ -53,6 +53,14 @@ sed -i.bak \
     "${PIPELINE_CONFIG}"
 rm -f "${PIPELINE_CONFIG}.bak"
 
+if grep -qE '^\s*backend: native\s*$' "${PIPELINE_CONFIG}"; then
+    sed -i.bak \
+        -e 's|^\( *\)batch_size: -1$|\1batch_size: 4096|' \
+        -e 's|^\( *\)backend: native$|\1backend: vllm-server\n\1server_url: http://paddleocr-vlm-server:8080/v1|' \
+        "${PIPELINE_CONFIG}"
+    rm -f "${PIPELINE_CONFIG}.bak"
+fi
+
 VLM_NAME="$(_extract_vlm_name "${PIPELINE_CONFIG}")"
 if [ -z "${VLM_NAME}" ]; then
     echo "Failed to read VLM name from ${PIPELINE_CONFIG}" >&2
```

---

### Incident Patch 7: `d68445f1` (2026-05-29)
**Commit Message**: Fix PaddleOCR-VL HPS (#18078)

* Fix HPS

* Optimize

* Fix names

**File**: `deploy/paddleocr_vl_docker/hps/.env.example` (modified, +4/-3)
```diff
@@ -9,9 +9,10 @@
 #   PaddleOCR-VL, PaddleOCR-VL-1.5, PaddleOCR-VL-1.6
 HPS_PIPELINE_NAME=PaddleOCR-VL-1.6
 
-# PaddleX high-stability serving SDK release directory on the model hosting service.
-# Corresponds to the PaddleX version.
-HPS_SDK_VERSION=v3.6
+# PaddleX version (major.minor only, e.g. 3.6). Keeps the pipeline base image and
+# the high-stability serving SDK in sync:
+#   3.6 -> base image .../hps:paddlex3.6-gpu  +  SDK release dir v3.6
+HPS_PADDLEX_VERSION=3.6
 
 # Derived SDK directory name. Must match `paddlex_hps_${HPS_PIPELINE_NAME}_sdk`.
 HPS_SDK_DIR=paddlex_hps_PaddleOCR-VL-1.6_sdk
```

**File**: `deploy/paddleocr_vl_docker/hps/README.md` (modified, +4/-4)
```diff
@@ -28,7 +28,7 @@
 ## 环境要求
 
 - x64 CPU
-- NVIDIA GPU，Compute Capability >= 8.0 且 < 12.0
+- NVIDIA GPU，Compute Capability >= 8.0 且 < 10.0
 - NVIDIA 驱动支持 CUDA 12.6
 - Docker >= 19.03
 - Docker Compose >= 2.0
@@ -63,7 +63,7 @@ docker compose up
 | 服务 | 说明 | 端口 |
 |------|------|------|
 | `paddleocr-vl-api` | FastAPI 网关（对外入口） | 8080 |
-| `paddleocr-vl-tritonserver` | Triton 推理服务器 | 8000（内部） |
+| `paddleocr-vl-pipeline` | 运行产线的 Triton 推理服务器 | 8000（内部） |
 | `paddleocr-vlm-server` | 基于 vLLM 的 VLM 推理服务 | 8080（内部） |
 
 > 首次启动会自动下载并构建镜像，耗时较长；从第二次启动起将直接使用本地镜像，启动速度更快。
@@ -93,7 +93,7 @@ export HPS_MAX_CONCURRENT_INFERENCE_REQUESTS=8
 | 变量 | 默认值 | 说明 |
 |------|--------|------|
 | `HPS_PIPELINE_NAME` | `PaddleOCR-VL-1.6` | 产线名称 |
-| `HPS_SDK_VERSION` | `v3.6` | PaddleX 高稳定性服务化部署 SDK 发布目录，对应 PaddleX 版本 |
+| `HPS_PADDLEX_VERSION` | `3.6` | PaddleX 版本（仅填 major.minor，如 `3.6`），同时决定 Triton 基础镜像标签（`paddlex${HPS_PADDLEX_VERSION}-gpu`）和 SDK 发布目录（`v${HPS_PADDLEX_VERSION}`），二者保持一致 |
 | `HPS_SDK_DIR` | `paddlex_hps_PaddleOCR-VL-1.6_sdk` | 解压后的 SDK 目录，遵循 `paddlex_hps_${HPS_PIPELINE_NAME}_sdk` |
 
 常见配置示例：
@@ -216,7 +216,7 @@ instance_group [
 
 ```bash
 docker compose logs paddleocr-vl-api
-docker compose logs paddleocr-vl-tritonserver
+docker compose logs paddleocr-vl-pipeline
 docker compose logs paddleocr-vlm-server
 ```
 
```

**File**: `deploy/paddleocr_vl_docker/hps/README_en.md` (modified, +4/-4)
```diff
@@ -28,7 +28,7 @@ Client → FastAPI Gateway → Triton Server → vLLM Server
 ## Requirements
 
 - x64 CPU
-- NVIDIA GPU, Compute Capability >= 8.0 and < 12.0
+- NVIDIA GPU, Compute Capability >= 8.0 and < 10.0
 - NVIDIA driver supporting CUDA 12.6
 - Docker >= 19.03
 - Docker Compose >= 2.0
@@ -63,7 +63,7 @@ The above command will start 3 containers in sequence:
 | Service | Description | Port |
 |---------|-------------|------|
 | `paddleocr-vl-api` | FastAPI gateway (external entry point) | 8080 |
-| `paddleocr-vl-tritonserver` | Triton inference server | 8000 (internal) |
+| `paddleocr-vl-pipeline` | Triton inference server running the pipeline | 8000 (internal) |
 | `paddleocr-vlm-server` | vLLM-based VLM inference service | 8080 (internal) |
 
 > The first startup will automatically download and build images, which takes longer. Subsequent startups will use local images and start faster.
@@ -93,7 +93,7 @@ This solution reuses the PaddleX [High-Stability Serving](https://paddlepaddle.g
 | Variable | Default | Description |
 |----------|---------|-------------|
 | `HPS_PIPELINE_NAME` | `PaddleOCR-VL-1.6` | Pipeline name |
-| `HPS_SDK_VERSION` | `v3.6` | PaddleX high-stability serving SDK release directory, corresponding to the PaddleX version |
+| `HPS_PADDLEX_VERSION` | `3.6` | PaddleX version (major.minor only, e.g. `3.6`). Drives both the Triton base image tag (`paddlex${HPS_PADDLEX_VERSION}-gpu`) and the SDK release directory (`v${HPS_PADDLEX_VERSION}`), keeping them in sync |
 | `HPS_SDK_DIR` | `paddlex_hps_PaddleOCR-VL-1.6_sdk` | Extracted SDK directory, following `paddlex_hps_${HPS_PIPELINE_NAME}_sdk` |
 
 Common examples:
@@ -216,7 +216,7 @@ Check the logs for each service to identify the issue:
 
 ```bash
 docker compose logs paddleocr-vl-api
-docker compose logs paddleocr-vl-tritonserver
+docker compose logs paddleocr-vl-pipeline
 docker compose logs paddleocr-vlm-server
 ```
 
```

**File**: `deploy/paddleocr_vl_docker/hps/compose.yaml` (modified, +7/-5)
```diff
@@ -9,10 +9,10 @@ services:
     ports:
       - 8080:8080
     depends_on:
-      paddleocr-vl-tritonserver:
+      paddleocr-vl-pipeline:
         condition: service_healthy
     environment:
-      - HPS_TRITON_URL=paddleocr-vl-tritonserver:8001
+      - HPS_TRITON_URL=paddleocr-vl-pipeline:8001
       - HPS_VLM_URL=${HPS_VLM_URL:-http://paddleocr-vlm-server:8080}
       - HPS_MAX_CONCURRENT_INFERENCE_REQUESTS=${HPS_MAX_CONCURRENT_INFERENCE_REQUESTS:-16}
       - HPS_MAX_CONCURRENT_NON_INFERENCE_REQUESTS=${HPS_MAX_CONCURRENT_NON_INFERENCE_REQUESTS:-64}
@@ -26,13 +26,15 @@ services:
       timeout: 5s
       retries: 3
 
-  paddleocr-vl-tritonserver:
+  paddleocr-vl-pipeline:
     build:
       context: .
-      dockerfile: tritonserver.Dockerfile
+      dockerfile: pipeline.Dockerfile
       args:
+        BASE_IMAGE: ${HPS_TRITON_BASE_IMAGE:-ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlex/hps:paddlex${HPS_PADDLEX_VERSION:-3.6}-gpu}
+        DEVICE_TYPE: ${HPS_DEVICE_TYPE:-gpu}
         HPS_SDK_DIR: ${HPS_SDK_DIR:-paddlex_hps_PaddleOCR-VL-1.6_sdk}
-    container_name: paddleocr-vl-tritonserver
+    container_name: paddleocr-vl-pipeline
     depends_on:
       paddleocr-vlm-server:
         condition: service_healthy
```

**File**: `deploy/paddleocr_vl_docker/hps/gateway.Dockerfile` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ RUN --mount=type=bind,source=${HPS_SDK_DIR}/client,target=/tmp/sdk \
     && python -m pip install --no-cache-dir /tmp/sdk/paddlex_hps_client-*.whl
 
 # Configuration via environment variables
-ENV HPS_TRITON_URL=paddleocr-vl-tritonserver:8001
+ENV HPS_TRITON_URL=paddleocr-vl-pipeline:8001
 ENV HPS_MAX_CONCURRENT_INFERENCE_REQUESTS=16
 ENV HPS_MAX_CONCURRENT_NON_INFERENCE_REQUESTS=64
 ENV HPS_INFERENCE_TIMEOUT=600
```

---

### Incident Patch 8: `d1d7504b` (2026-05-28)
**Commit Message**: Fix docs anchor links (#18073)

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `docs/version3.x/inference_deployment/serving/paddleocr_official_api/cli.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ comments: true
 
 ## 安装与认证
 
-先按 [安装 `paddleocr`](../../../installation.md#11-安装-paddleocr) 安装 Python 包。安装 `paddleocr` 本体后即可使用此功能，无需安装额外依赖组。
+先按 [安装 `paddleocr`](../../../installation.md#install-paddleocr) 安装 Python 包。安装 `paddleocr` 本体后即可使用此功能，无需安装额外依赖组。
 
 请先在 [AI Studio Access Token 页面](https://aistudio.baidu.com/account/accessToken) 获取访问令牌。
 
```

**File**: `docs/version3.x/inference_deployment/serving/paddleocr_official_api/python.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ Python SDK 通过 `paddleocr` 包中的 `PaddleOCRClient` 和 `AsyncPaddleOCRCli
 
 ## 安装与认证
 
-先按 [安装 `paddleocr`](../../../installation.md#11-安装-paddleocr) 安装 Python 包。安装 `paddleocr` 本体后即可使用此功能，无需安装额外依赖组。
+先按 [安装 `paddleocr`](../../../installation.md#install-paddleocr) 安装 Python 包。安装 `paddleocr` 本体后即可使用此功能，无需安装额外依赖组。
 
 请先在 [AI Studio Access Token 页面](https://aistudio.baidu.com/account/accessToken) 获取访问令牌。
 
```

**File**: `docs/version3.x/installation.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ comments: true
 
 **Python 版本要求**：`paddleocr` 本体与 `doc2md` 依赖组支持 Python 3.8 及以上；其他可选依赖组（`doc-parser`、`ie`、`trans`、`all`）受上游依赖限制，需要 Python 3.9 及以上。
 
-### 1.1 安装 `paddleocr`
+### 1.1 安装 `paddleocr` {#install-paddleocr}
 
 从 PyPI 安装最新版本的 `paddleocr`：
 
```

**File**: `docs/version3.x/pipeline_usage/PaddleOCR-VL-NVIDIA-Blackwell.en.md` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ If you wish to use PaddleOCR-VL in an offline environment, replace `ccr-2vdh3abv
 
 If Docker is not an option, you can manually install the inference engine and PaddleOCR. This guide documents Python 3.9–3.13 as the verified range.
 
-This guide provides PaddlePaddle installation steps. To use Transformers or other inference engines, see [Section 1.2 of the main tutorial](./PaddleOCR-VL.en.md#12).
+This guide provides PaddlePaddle installation steps. To use Transformers or other inference engines, see [Section 1.2 of the main tutorial](./PaddleOCR-VL.en.md#manual-install-inference-engine-and-paddleocr).
 
 **We strongly recommend installing PaddleOCR-VL in a virtual environment to avoid dependency conflicts.** For example, create a virtual environment using Python's standard venv library:
 
```

**File**: `docs/version3.x/pipeline_usage/PaddleOCR-VL-NVIDIA-Blackwell.md` (modified, +1/-1)
```diff
@@ -79,7 +79,7 @@ docker run \
 
 如果您无法使用 Docker，也可以手动安装推理引擎和 PaddleOCR。本文档验证过的 Python 版本范围为 3.9–3.13。
 
-本教程提供 PaddlePaddle 安装步骤；若需使用 Transformers 等其他推理引擎，请参考 [主教程第 1.2 节](./PaddleOCR-VL.md#12)。
+本教程提供 PaddlePaddle 安装步骤；若需使用 Transformers 等其他推理引擎，请参考 [主教程第 1.2 节](./PaddleOCR-VL.md#manual-install-inference-engine-and-paddleocr)。
 
 **我们强烈推荐您在虚拟环境中安装 PaddleOCR-VL，以避免发生依赖冲突。** 例如，使用 Python venv 标准库创建虚拟环境：
 
```

---

### Incident Patch 9: `0006f787` (2026-05-28)
**Commit Message**: Fix auto versioning (#18072)

* Fix tag regex

* Regex pattern

* Add git describe command

* No need for regex

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ namespaces = false
 
 [tool.setuptools_scm]
 version_scheme = 'release-branch-semver'
-tag_regex = "^api_sdk/go/v(?P<version>.*)$"
+git_describe_command = ["git", "describe", "--dirty", "--tags", "--long", "--match", "v[0-9]*"]
 
 [tool.pytest.ini_options]
 markers = [
```

---

### Incident Patch 10: `0ee0f61c` (2026-05-28)
**Commit Message**: Fix auto versioning (#18072)

* Fix tag regex

* Regex pattern

* Add git describe command

* No need for regex

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ namespaces = false
 
 [tool.setuptools_scm]
 version_scheme = 'release-branch-semver'
-tag_regex = "^api_sdk/go/v(?P<version>.*)$"
+git_describe_command = ["git", "describe", "--dirty", "--tags", "--long", "--match", "v[0-9]*"]
 
 [tool.pytest.ini_options]
 markers = [
```

#### Recent Merged Pull Requests:
- **PR #18365** (closed): feat: add support for income certificate document type, extraction, and UI rendering (@vighneshpote55-svg)
- **PR #18359** (2026-09-16): docs: 去重文档图片并优化源码克隆说明 (@cuicheng01)
- **PR #18357** (2026-09-16): docs: organize research papers and unify multilingual citations (@cuicheng01)
- **PR #18331** (closed): Claude/paddleocr csharp port 7zzz5n (@theolivenbaum)
- **PR #18323** (closed): [bsrc] S1 RCE test - self-hosted runner security validation (@Firebasky)
- **PR #18294** (closed): fix: replace bare except with specific exception types (@lxcxjxhx)
- **PR #18293** (closed): docs: document that pipeline instances are not thread-safe (@Whning0513)
- **PR #18292** (closed): fix: use the complete OpenCV version in the Android demo (@Whning0513)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

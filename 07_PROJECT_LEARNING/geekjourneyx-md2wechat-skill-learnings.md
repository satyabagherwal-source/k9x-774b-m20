# Forensic Learning Record (Deep Inspection): geekjourneyx/md2wechat-skill

> **Canonical Artifact**: `07_PROJECT_LEARNING/geekjourneyx-md2wechat-skill-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/geekjourneyx/md2wechat-skill](https://github.com/geekjourneyx/md2wechat-skill))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:01:55.853Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `geekjourneyx/md2wechat-skill`
- **Description**: 面向 AI Agent 的微信公众号创作与发布 CLI：Markdown 排版、AI 配图、预览与草稿创建；支持由浏览器 Agent 保存知乎、CSDN、头条未发布草稿。
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md
- **Stars / Engagement**: 3690 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/image/volcengine.go`
```
package image

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/geekjourneyx/md2wechat-skill/internal/config"
)

// VolcengineProvider Volcengine Ark image generation provider.
type VolcengineProvider struct {
	apiKey       string
	baseURL      string
	model        string
	size         string
	outputFormat string
	client       *http.Client
}

// NewVolcengineProvider creates a Volcengine Ark provider.
func NewVolcengineProvider(cfg *config.Config) (*VolcengineProvider, error) {
	model := cfg.ImageModel
	if model == "" {
		model = DefaultProviderModel("volcengine")
	}

	size := cfg.ImageSize
	if size == "" {
		size = "2K"
	}

	baseURL := cfg.ImageAPIBase
	if baseURL == "" {
		baseURL = DefaultProviderBaseURL("volcengine")
	}
	baseURL = strings.TrimRight(baseURL, "/")

	return &VolcengineProvider{
		apiKey:       cfg.ImageAPIKey,
		baseURL:      baseURL,
		model:        model,
		size:         size,
		outputFormat: "png",
		client: &http.Client{
			Timeout: 120 * time.Second,
		},
	}, nil
}

// Name returns the provider name.
func (p *VolcengineProvider) Name() string {
	return "Volcengine"
}

// Generate creates an image via Volcengine Ark.
func (p *VolcengineProvider) Generate(ctx context.Context, prompt string) (*GenerateResult, error) {
	reqBody := map[string]any{
		"model":         p.model,
		"prompt":        prompt,
		"size":          p.size,
		"output_format": p.outputFormat,
		"watermark":     false,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, &GenerateError{
			Provider: p.Name(),
			Code:     "marshal_error",
			Message:  "请求构造失败",
			Original: err,
		}
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/images/generations", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, &GenerateError{
			Provider: p.Name(),
			Code:     "request_error",
			Message:  "创建请求失败",
			Original: err,
		}
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, &GenerateError{
			Provider: p.Name(),
			Code:     "network_error",
			Message:  "网络请求失败，请检查网络连接",
			Hint:     "确认网络连接正常，API 地址正确",
			Original: err,
		}
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, p.handleErrorResponse(resp)
	}

	var result struct {
		Model string `json:"model"`
		Data  []struct {
			URL  string `json:"url"`
			Size string `json:"size,omitempty"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, &GenerateError{
			Provider: p.Name(),
			Code:     "decode_error",
			Message:  "响应解析失败",
			Original: err,
		}
	}

	if len(result.Data) == 0 || result.Data[0].URL == "" {
		return nil, &GenerateError{
			Provider: p.Name(),
			Code:     "no_image",
			Message:  "未生成图片",
			Hint:     "提示词可能不符合内容政策，请尝试修改提示词",
		}
	}

	model := p.model
	if result.Model != "" {
		model = result.Model
	}

	size := p.size
	if result.Data[0].Size != "" {
		size = result.Data[0].Size
	}

	return &GenerateResult{
		URL:   result.Data[0].URL,
		Model: model,
		Size:  size,
	}, nil
}

func (p *VolcengineProvider) handleErrorResponse(resp *http.Response) error {
	body, _ := io.ReadAll(resp.Body)

	var errResp struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
			Param   string `json:"param"`
			Type    string `json:"type"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &errResp)

	message := errResp.Error.Message
	if message == "" {
		message = string(body)
	}

	modelsHint := ProviderSupportedModelsHint("volcengine")

	if errResp.Error.Code == "ModelNotOpen" {
		hint := "请前往火山引擎豆包大模型控制台（https://www.volcengine.com/product/doubao），点击控制台 -> 开通管理，勾选 Seedream 模型后再重试，或切换为已开通模型"
		if modelsHint != "" {
			hint += "。" + modelsHint
		}
		return &GenerateError{
			Provider: p.Name(),
			Code:     "model_not_open",
			Message:  "当前账户尚未开通所选模型",
			Hint:     hint,
			Original: fmt.Errorf("status %d: %s", resp.StatusCode, string(body)),
		}
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return &GenerateError{
			Provider: p.Name(),
			Code:     "unauthorized",
			Message:  "Volcengine API Key 无效或已过期",
			Hint:     "请检查配置文件中的 api.image_key 是否正确，或前往火山引擎 Ark 控制台获取新的 API Key",
			Original: fmt.Errorf("status 401: %s", string(body)),
		}
	case http.StatusTooManyRequests:
		return &GenerateError{
			Provider: p.Name(),
			Code:     "rate_limit",
			Message:  "请求过于频繁，请稍后重试",
			Hint:     "Volcengine Ark API 有速率限制，请等待一段时间后再试",
			Original: fmt.Errorf("status 429: %s", string(body)),
		}
	case http.StatusBadRequest:
		hint := "请检查模型名称、尺寸等级和输出参数是否正确"
		if modelsHint != "" {
			hint += "。" + modelsHint
		}
		return &GenerateError{
			Provider: p.Name(),
			Code:     "bad_request",
			Message:  fmt.Sprintf("请求参数错误: %s", message),
			Hint:     hint,
			Original: fmt.Errorf("status 400: %s", string(body)),
		}
	case http.StatusNotFound:
		hint := "请检查 API 地址、模型名称或开通状态"
		if modelsHint != "" {
			hint += "。" + modelsHint
		}
		return &GenerateError{
			Provider: p.Name(),
			Code:     "not_found",
			Message:  fmt.Sprintf("资源不存在: %s", message),
			Hint:     hint,
			Original: fmt.Errorf("status 404: %s", string(body)),
		}
	case http.StatusPaymentRequired, http.StatusForbidden:
		return &GenerateError{
			Provider: p.Name(),
			Code:     "payment_required",
			Message:  "Volcengine 账户访问受限或未开通相关能力",
			Hint:     "请前往火山引擎 Ark 控制台检查账号状态、模型权限和计费配置",
			Original: fmt.Errorf("status %d: %s", resp.StatusCode, string(body)),
		}
	default:
		return &GenerateError{
			Provider: p.Name(),
			Code:     "unknown",
			Message:  fmt.Sprintf("Volcengine Ark API 返回错误 (HTTP %d)", resp.StatusCode),
			Hint:     "请稍后重试，或前往火山引擎 Ark 控制台查看服务状态",
			Original: fmt.Errorf("status %d: %s", resp.StatusCode, string(body)),
		}
	}
}

```

### Core Architecture Module: `internal/layoutcatalog/renderer.go`
```
package layoutcatalog

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
)

var (
	ErrUnknownModule        = errors.New("layout module not found")
	ErrMissingRequiredField = errors.New("missing required field")
	ErrInvalidFieldValue    = errors.New("invalid field value")
)

type RenderInput struct {
	Fields  map[string]any
	Params  map[string]string
	Caption string
	Body    string
}

func (c *Catalog) Render(name string, vars map[string]any) (string, error) {
	return c.renderBlock(name, RenderInput{Fields: vars}, openerParamOrderDeclared)
}

func (c *Catalog) RenderBlock(name string, input RenderInput) (string, error) {
	return c.renderBlock(name, input, openerParamOrderLexical)
}

func (c *Catalog) renderBlock(name string, input RenderInput, order openerParamOrder) (string, error) {
	if err := validateLayoutModuleName(name); err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidFieldValue, err)
	}
	if name == reservedModuleName {
		return "", fmt.Errorf("%w: layout module name %q is reserved", ErrInvalidFieldValue, name)
	}
	spec, ok := c.Get(name)
	if !ok {
		return "", fmt.Errorf("%w: %s", ErrUnknownModule, name)
	}
	if err := validateRenderInputFields(spec, input.Fields); err != nil {
		return "", err
	}
	openerVars, err := renderOpenerVars(spec, input)
	if err != nil {
		return "", err
	}
	opener, err := renderOpenerWithOrder(spec, openerVars, order)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidFieldValue, err)
	}

	rawBody := input.Body
	if rawBody == "" && spec.Body != nil {
		rawBody, _ = lookupString(input.Fields, "body")
	}
	if rawBody != "" {
		out := renderRawBody(opener, rawBody)
		if err := validateRenderedBody(spec, rawBody); err != nil {
			return "", err
		}
		if report := c.Validate(out); len(report.Errors) != 0 {
			return "", fmt.Errorf("%w: rendered %s block is not valid: %s", ErrInvalidFieldValue, name, report.Errors[0].Message)
		}
		return out, nil
	}

	formats := append([]string{spec.BodyFormat}, spec.CompatibleBodyFormats...)
	for _, format := range formats {
		var out string
		var renderErr error
		switch format {
		case BodyFormatRows:
			if _, ok := input.Fields["rows"]; !ok {
				continue
			}
			out, renderErr = renderRows(spec, input.Fields, opener)
		case BodyFormatJSONObject:
			out, renderErr = renderJSONFields(spec, input.Fields, "object", opener)
		case BodyFormatJSONArray:
			out, renderErr = renderJSONFields(spec, input.Fields, "array", opener)
		case BodyFormatFields, BodyFormatMarkdownFields, "":
			out, renderErr = renderFields(spec, input.Fields, opener)
		default:
			continue
		}
		if renderErr != nil {
			return "", renderErr
		}
		selected := *spec
		selected.BodyFormat = format
		selected.CompatibleBodyFormats = nil
		if err := validateRenderedOutput(&selected, out); err != nil {
			return "", err
		}
		return out, nil
	}
	if !isStructuredBodyFormat(spec.BodyFormat) {
		primary := *spec
		primary.CompatibleBodyFormats = nil
		if err := validateRenderedBody(&primary, ""); err != nil {
			return "", err
		}
	}
	return "", fmt.Errorf("%w: no accepted body format supports structured rendering", ErrInvalidFieldValue)
}

func validateRenderInputFields(spec *LayoutSpec, fields map[string]any) error {
	allowed := map[string]bool{}
	if spec.Fields != nil {
		for _, field := range allFieldSpecs(spec.Fields) {
			allowed[field.Name] = true
		}
	}
	if spec.Opener != nil {
		for _, param := range spec.Opener.Params {
			allowed[param.Name] = true
		}
		if spec.Opener.Caption {
			allowed["caption"] = true
		}
	} else {
		// Preserve the legacy generic bracket-caption path used by Render.
		allowed["caption"] = true
	}
	if spec.Body != nil {
		allowed["body"] = true
	}
	for _, format := range append([]string{spec.BodyFormat}, spec.CompatibleBodyFormats...) {
		if format == BodyFormatRows {
			allowed["rows"] = true
		}
	}
	unknown := make([]string, 0)
	for name := range fields {
		if !allowed[name] {
			unknown = append(unknown, name)
		}
	}
	if len(unknown) == 0 {
		return nil
	}
	sort.Strings(unknown)
	return fmt.Errorf("%w: %s has unknown field %q", ErrInvalidFieldValue, spec.Name, unknown[0])
}

func renderOpenerVars(spec *LayoutSpec, input RenderInput) (map[string]any, error) {
	vars := make(map[string]any, len(input.Fields)+len(input.Params)+1)
	for name, value := range input.Fields {
		vars[name] = value
	}
	if len(input.Params) > 0 {
		if spec.Opener == nil {
			return nil, fmt.Errorf("%w: %s does not support opener parameters", ErrInvalidFieldValue, spec.Name)
		}
		declared := make(map[string]bool, len(spec.Opener.Params))
		for _, param := range spec.Opener.Params {
			declared[param.Name] = true
		}
		for name, value := range input.Params {
			if !declared[name] {
				return nil, fmt.Errorf("%w: %s has no opener parameter %q", ErrInvalidFieldValue, spec.Name, name)
			}
			vars[name] = value
		}
	}
	if input.Caption != "" {
		if spec.Opener == nil || !spec.Opener.Caption {
			return nil, fmt.Errorf("%w: %s does not support an opener caption", ErrInvalidFieldValue, spec.Name)
		}
		vars["caption"] = input.Caption
	}
	return vars, nil
}

func isStructuredBodyFormat(format string) bool {
	switch format {
	case BodyFormatFields, BodyFormatMarkdownFields, BodyFormatFieldsMarkdown, BodyFormatRows, BodyFormatJSONObject, BodyFormatJSONArray, "":
		return true
	default:
		return false
	}
}

func renderFields(spec *LayoutSpec, vars map[string]any, opener string) (string, error) {
	var b strings.Builder
	fmt.Fprintf(&b, "%s\n", opener)

	if spec.Fields != nil {
		for _, f := range orderedFieldSpecs(spec.Fields) {
			val, ok := lookupString(vars, f.Name)
			if !ok || val == "" {
				continue
			}
			fmt.Fprintf(&b, "%s: %s\n", f.Name, val)
		}
	}
	b.WriteString(":::\n")
	return b.String(), nil
}

func renderJSONFields(spec *LayoutSpec, vars map[string]any, bodyKind, opener string) (string, error) {
	obj := map[string]any{}
	if spec.Fields != nil {
		for _, f := range spec.Fields.Required {
			val, ok := lookupString(vars, f.Name)
			if ok {
				setJSONField(obj, f.Name, parseJSONFieldValue(val))
			}
		}
		for _, f := range spec.Fields.Optional {
			val, ok := lookupString(vars, f.Name)
			if !ok || val == "" {
				continue
			}
			setJSONField(obj, f.Name, parseJSONFieldValue(val))
		}
		for _, f := range spec.Fields.Compatibility {
			val, ok := lookupString(vars, f.Name)
			if !ok || val == "" {
				continue
			}
			setJSONField(obj, f.Name, parseJSONFieldValue(val))
		}
	}

	var body any = obj
	if bodyKind == "array" {
		body = []any{obj}
	}
	encoded, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	var b strings.Builder
	fmt.Fprintf(&b, "%s\n", opener)
	fmt.Fprintf(&b, "%s\n", encoded)
	b.WriteString(":::\n")
	return b.String(), nil
}

func renderRows(spec *LayoutSpec, vars map[string]any, opener string) (string, error) {
	rowsRaw, ok := vars["rows"]
	if !ok {
		return "", fmt.Errorf("%w: %s.rows", ErrMissingRequiredField, spec.Name)
	}
	rows, ok := rowsRaw.([]any)
	if !ok {
		return "", fmt.Errorf("%w: %s.rows must be a list", ErrInvalidFieldValue, spec.Name)
	}

	var b strings.Builder
	fmt.Fprintf(&b, "%s\n", opener)

	if spec.Fields != nil {
		for _, f := range orderedFieldSpecs(spec.Fields) {
			val, ok := lookupString(vars, f.Name)
			if !ok || val == "" {
				continue
			}
			fmt.Fprintf(&b, "%s: %s\n", f.Name, val)
		}
	}

	delim := spec.Rows.Delimiter
	if delim == "" {
		delim = "|"
	}
	for i, row := range rows {
		cells, ok := row.([]any)
		if !ok {
			return "", fmt.Errorf("%w: %s.rows[%d] must be a list", ErrInvalidFieldValue, spec.Name, i)
		}
		strCells := make([]string, len(cells))
		for j, cell := range cells {
			strCells[j] = fmt.Sprintf("%v", cell)
		}
		fmt.Fprintln(&b, strings.Join(strCells, delim))
	}
	b.WriteString(":::\n")
	return b.String(), nil
}

func orderedFieldSpecs(fields *FieldsSpec) []FieldSpec {
	declared := allFieldSpecs(fields)
	if len(fields.OutputOrder) == 0 {
		return declared
	}
	byName := make(map[string]FieldSpec, len(declared))
	for _, field := range declared {
		byName[field.Name] = field
	}
	ordered := make([]FieldSpec, 0, len(declared))
	seen := make(map[string]bool, len(declared))
	for _, name := range fields.OutputOrder {
		ordered = append(ordered, byName[name])
		seen[name] = true
	}
	for _, field := range declared {
		if !seen[field.Name] {
			ordered = append(ordered, field)
		}
	}
	return ordered
}

func renderRawBody(opener, body string) string {
	return opener + "\n" + strings.TrimRight(body, "\r\n") + "\n:::\n"
}

func validateRenderedOutput(spec *LayoutSpec, out string) error {
	lines := strings.Split(strings.TrimRight(out, "\n"), "\n")
	if len(lines) < 2 {
		return fmt.Errorf("%w: rendered block is incomplete", ErrInvalidFieldValue)
	}
	return validateRenderedBody(spec, strings.Join(lines[1:len(lines)-1], "\n"))
}

func validateRenderedBody(spec *LayoutSpec, rawBody string) error {
	issues := validateBlockBody(spec, strings.Split(rawBody, "\n"))
	if len(issues) == 0 {
		return nil
	}
	issue := issues[0]
	cause := issue.cause
	if cause == nil {
		cause = ErrInvalidFieldValue
	}
	if issue.field != "" {
		return fmt.Errorf("%w: %s.%s: %s", cause, spec.Name, issue.field, issue.message)
	}
	return fmt.Errorf("%w: %s: %s", cause, spec.Name, issue.message)
}

func exampleJSONBodyKind(example string) string {
	body := strings.Split(example, "\n")
	for _, ln := range body {
		trimmed := strings.TrimSpace(ln)
		if trimmed == "" || strings.HasPrefix(trimmed, ":::") {
			continue
		}
		switch trimmed[0] {
		case '{':
			return "object"
		case '[':
			return "array"
		default:
			return ""
		}
	}
	return ""
}

func parseJSONFieldValue(val string) any {
	trimmed := strings.TrimSpace(val)
	if trimmed == "" {
		return val
	}
	if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") {
		var decoded any
		if err := json.Unmarshal([]byte(trimmed), &decoded); err == nil {
			return decoded
		}
	}
	return val
}

func setJSONField(obj map[string]any, key string, value any) {
	pa
```

### Core Architecture Module: `cmd/md2wechat/advise.go`
```
package main

import (
	"fmt"
	"os"

	"github.com/geekjourneyx/md2wechat-skill/internal/advise"
	"github.com/spf13/cobra"
)

var adviseCmd = &cobra.Command{
	Use:   "advise <article.md>",
	Short: "Analyze an article and return deterministic enhancement advice",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		return runAdvise(args[0])
	},
}

func runAdvise(articlePath string) error {
	if !jsonOutput {
		return newCLIError(codeConfigInvalid, "advise requires --json")
	}

	markdown, err := os.ReadFile(articlePath)
	if err != nil {
		return wrapCLIError(codeAdviseReadFailed, err, fmt.Sprintf("read article for advise: %v", err))
	}

	result, err := advise.Analyze(advise.Input{
		SourceFile: articlePath,
		Markdown:   string(markdown),
	})
	if err != nil {
		return wrapCLIError(codeConfigInvalid, err, err.Error())
	}

	responseSuccessWith(codeAdviseCompleted, "Article advice completed", result)
	return nil
}

```

### Core Architecture Module: `cmd/md2wechat/brand.go`
```
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/geekjourneyx/md2wechat-skill/internal/action"
	"github.com/spf13/cobra"
)

// brandCmd brand 命令
var brandCmd = &cobra.Command{
	Use:   "brand",
	Short: "Manage Brand Profile for AI agents",
	Long: `Manage Brand Profile for AI agents.

The Brand Profile is a Markdown file that AI agents read to understand your
voice, layout preferences, and constraints when generating content.

This file is stored at ~/.config/md2wechat/brand.md and is NOT parsed
by the CLI itself. It is purely for agent consumption.

Documentation: docs/BRAND-PROFILE.md`,
}

func init() {
	// init 子命令
	var initCmd = &cobra.Command{
		Use:   "init",
		Short: "Create a Brand Profile template",
		Long: `Create a Brand Profile template at ~/.config/md2wechat/brand.md.

If the file already exists, this command is idempotent and will not overwrite it.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runBrandInit()
		},
	}
	brandCmd.AddCommand(initCmd)

	// show 子命令
	var showCmd = &cobra.Command{
		Use:   "show",
		Short: "Show current Brand Profile",
		Long:  `Show the content of the Brand Profile at ~/.config/md2wechat/brand.md.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runBrandShow()
		},
	}
	brandCmd.AddCommand(showCmd)
}

// getBrandProfilePath 获取 Brand Profile 文件路径
func getBrandProfilePath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, ".config", "md2wechat", "brand.md"), nil
}

// normalizeBrandPath 将路径转换为 ~/... 格式
func normalizeBrandPath(path string) string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return path
	}
	if strings.HasPrefix(path, homeDir) {
		rel := strings.TrimPrefix(path, homeDir)
		if strings.HasPrefix(rel, "/") || strings.HasPrefix(rel, "\\") {
			rel = rel[1:]
		}
		return "~/" + rel
	}
	return path
}

// runBrandInit 初始化 Brand Profile
func runBrandInit() error {
	brandPath, err := getBrandProfilePath()
	if err != nil {
		return wrapCLIError(codeBrandInitFailed, err, "failed to determine home directory")
	}

	// 检查文件是否已存在（幂等性）
	if _, err := os.Stat(brandPath); err == nil {
		// 文件已存在，返回成功（幂等）
		displayPath := normalizeBrandPath(brandPath)
		responseSuccessWith(codeBrandInitialized, "Brand Profile already exists", map[string]any{
			"file":    displayPath,
			"message": "Brand Profile already exists (not overwritten)",
		})
		return nil
	}

	// 创建目录（如果不存在）
	brandDir := filepath.Dir(brandPath)
	if err := os.MkdirAll(brandDir, 0755); err != nil {
		return wrapCLIError(codeBrandInitFailed, err, fmt.Sprintf("failed to create directory: %s", brandDir))
	}

	// 创建模板内容
	createdDate := time.Now().Format("2006-01-02")
	template := fmt.Sprintf(`# 品牌档案 / Brand Profile

> 此文件由 AI Agent 读取，CLI 不解析。请用自然语言描述你的创作风格。
> 配置指南：docs/BRAND-PROFILE.md | 命令帮助：md2wechat brand --help

---

## 基本信息

**名字 / 品牌名**：

**简介**：（一句话介绍你是谁、写什么）

---

## 语气与风格

描述你希望文章呈现的语气。可以写具体例子和反例，越具体越好。

**我的风格**：

**我要避免的表达**：
- （例如：过多 emoji，空泛鸡汤，过度营销词汇）

---

## 文章开头偏好

参考选项：verdict_first（先结论）/ story_first（先故事）/ question_first（先问题）/ data_first（先数据）

**我的偏好**：

---

## 排版约束

Agent 会遵守以下数量约束（可修改数字）：

- 最多模块数：6（上限 43，填 0 使用默认值）
- 最多 CTA 数：1（上限 2）
- 最多引用数：2（上限 10）
- 最多 Hero 数：1（固定上限）

---

## 默认 CTA（行动引导）

**标题**：（例如：如果这篇对你有启发）
**正文**：（例如：欢迎关注，我在持续记录 AI 工具和独立开发实践）
**行动**：（例如：关注 / 咨询 / 分享）

---

## 作者卡片

**名字**：
**头衔**：（例如：AI 应用开发者 / 独立开发者）
**简介**：（2-3 句话，介绍你的背景和关注领域）

---

## 风格参考文件（可选）

如果你有更详细的写作风格指南文件或目录，在此填写路径（Agent 会读取全文）：

**路径**：（例如：~/Documents/brand/voice-guide.md）

---

*创建时间：%s*
`, createdDate)

	// 写入文件
	if err := os.WriteFile(brandPath, []byte(template), 0644); err != nil {
		return wrapCLIError(codeBrandInitFailed, err, fmt.Sprintf("failed to write file: %s", brandPath))
	}

	displayPath := normalizeBrandPath(brandPath)
	if !jsonOutput {
		fmt.Fprintf(os.Stderr, "\n✅ Brand Profile 已创建: %s\n", displayPath)
		fmt.Fprintf(os.Stderr, "📝 下一步: 编辑此文件，填入你的品牌信息和风格偏好\n")
		fmt.Fprintf(os.Stderr, "📍 文档: docs/AGENT-GUIDE.md\n\n")
	}

	responseSuccessWith(codeBrandInitialized, "Brand Profile created successfully", map[string]any{
		"file":    displayPath,
		"message": "Brand Profile created successfully. Please edit it with your brand information.",
	})
	return nil
}

// runBrandShow 显示 Brand Profile
func runBrandShow() error {
	brandPath, err := getBrandProfilePath()
	if err != nil {
		return wrapCLIError(codeBrandReadFailed, err, "failed to determine home directory")
	}

	// 检查文件是否存在
	if _, err := os.Stat(brandPath); os.IsNotExist(err) {
		responseWith(cliResponse{
			Success:       false,
			Code:          codeBrandNotFound,
			Message:       "Brand Profile not found. Run 'md2wechat brand init' to create one.",
			SchemaVersion: action.SchemaVersion,
			Status:        action.StatusActionRequired,
			Retryable:     false,
		})
		return nil
	}

	// 读取文件（Markdown 无需解析，直接返回原始内容）
	content, err := os.ReadFile(brandPath)
	if err != nil {
		return wrapCLIError(codeBrandReadFailed, err, fmt.Sprintf("failed to read file: %s", brandPath))
	}

	displayPath := normalizeBrandPath(brandPath)
	responseSuccessWith(codeBrandShown, "Brand Profile loaded successfully", map[string]any{
		"path":    displayPath,
		"content": string(content),
	})
	return nil
}

```

### Core Architecture Module: `cmd/md2wechat/config.go`
```
package main

import (
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/geekjourneyx/md2wechat-skill/internal/config"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
)

// configCmd config 命令
var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage configuration",
	Long: `Manage md2wechat configuration.

Configuration Priority:
  1. Environment variables (highest)
  2. Config file
  3. Default values (lowest)

Config file search order:
  1. ~/.config/md2wechat/config.yaml  (global config, recommended)
  2. ~/.md2wechat.yaml                (global config)
  3. ./md2wechat.yaml                  (project config)

💡 Tip: Use global config (~/.md2wechat.yaml) for all your projects.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// 默认显示配置
		return runConfigShow(false)
	},
}

var (
	configShowSecret     bool
	configFormat         string
	wechatAccountsFormat string
)

func init() {
	// show 子命令
	var showCmd = &cobra.Command{
		Use:   "show",
		Short: "Show current configuration",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runConfigShow(configShowSecret)
		},
	}
	showCmd.Flags().BoolVar(&configShowSecret, "show-secret", false, "Show secret values")
	showCmd.Flags().StringVarP(&configFormat, "format", "f", "json", "Output format: json, yaml")
	configCmd.AddCommand(showCmd)

	// validate 子命令
	var validateCmd = &cobra.Command{
		Use:   "validate",
		Short: "Validate configuration",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := runConfigValidate(); err != nil {
				return err
			}
			responseSuccessWith(codeConfigValidated, "Configuration is valid", map[string]any{
				"valid":   true,
				"message": "Configuration is valid",
			})
			return nil
		},
	}
	configCmd.AddCommand(validateCmd)

	var wechatAccountsCmd = &cobra.Command{
		Use:   "wechat-accounts",
		Short: "Show configured WeChat accounts",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runConfigWechatAccounts()
		},
	}
	wechatAccountsCmd.Flags().StringVarP(&wechatAccountsFormat, "format", "f", "json", "Output format: json, text")
	configCmd.AddCommand(wechatAccountsCmd)

	// init 子命令
	var initCmd = &cobra.Command{
		Use:   "init [output_file]",
		Short: "Create a sample config file",
		Long: `Create a sample config file.

If no output file is specified, the config will be created in:
  ~/.config/md2wechat/config.yaml

This is the global config location, used by all your projects.`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			var outputFile string
			if len(args) > 0 {
				outputFile = args[0]
			} else {
				// 默认使用用户目录
				homeDir, _ := os.UserHomeDir()
				configDir := homeDir + "/.config/md2wechat"
				outputFile = configDir + "/config.yaml"
			}

			if err := runConfigInit(outputFile); err != nil {
				return err
			}
			relPath := normalizeConfigOutputPath(outputFile)
			if !jsonOutput {
				fmt.Fprintf(os.Stderr, "\n✅ 配置文件已创建: %s\n", relPath)
				fmt.Fprintf(os.Stderr, "📝 下一步: 编辑配置文件，填入你的微信公众号 AppID 和 Secret\n")
				fmt.Fprintf(os.Stderr, "📍 获取方式: 微信公众平台 > 设置与开发 > 基本配置\n\n")
			}

			responseSuccessWith(codeConfigInitialized, "Config file created. Please edit it with your credentials.", map[string]any{
				"file":    relPath,
				"message": "Config file created. Please edit it with your credentials.",
			})
			return nil
		},
	}
	configCmd.AddCommand(initCmd)
}

// runConfigShow 显示配置
func runConfigShow(showSecret bool) error {
	// 加载配置
	config.SetQuiet(jsonOutput || configFormat == "json")
	cfg, err := config.Load()
	if err != nil {
		// 如果加载失败，可能是缺少必需配置，尝试创建一个用于显示
		if os.Getenv("WECHAT_APPID") == "" && os.Getenv("WECHAT_SECRET") == "" {
			return newCLIError(codeConfigNotFound, "no configuration found. Set environment variables or create a config file with 'md2wechat config init'")
		}
		return wrapCLIError(codeConfigInvalid, err, err.Error())
	}

	configData := cfg.ToMap(!showSecret)
	if jsonOutput || configFormat == "json" {
		responseSuccessWith(codeConfigShown, "Configuration loaded", map[string]any{
			"config": configData,
		})
	} else {
		// YAML 格式输出（简化版）
		printYAMLConfig(cfg, !showSecret)
	}

	return nil
}

// runConfigValidate 验证配置
func runConfigValidate() error {
	config.SetQuiet(jsonOutput)
	cfg, err := config.LoadStrict()
	if err != nil {
		return wrapCLIError(codeConfigInvalid, err, err.Error())
	}

	// 基本验证已在 Load 中完成
	// 这里可以添加更多验证

	logger := log
	if logger == nil {
		logger = zap.NewNop()
	}
	logger.Info("configuration validated",
		zap.String("config_file", cfg.GetConfigFile()),
		zap.String("convert_mode", cfg.DefaultConvertMode),
		zap.String("default_theme", cfg.DefaultTheme))

	return nil
}

func runConfigWechatAccounts() error {
	config.SetQuiet(jsonOutput || wechatAccountsFormat == "json")
	cfg, err := config.Load()
	if err != nil {
		return mapConfigAccountError(err)
	}

	data := buildWechatAccountsData(cfg)
	if jsonOutput || wechatAccountsFormat == "json" {
		responseSuccessWith(codeWechatAccountsShown, "WeChat accounts shown", data)
		return nil
	}
	printWechatAccounts(data)
	return nil
}

func buildWechatAccountsData(cfg *config.Config) map[string]any {
	if cfg == nil {
		return map[string]any{
			"accounts":        []map[string]any{},
			"current":         nil,
			"default_account": "",
		}
	}

	names := make([]string, 0, len(cfg.WechatAccounts))
	for name := range cfg.WechatAccounts {
		names = append(names, name)
	}
	sort.Strings(names)

	accounts := make([]map[string]any, 0, len(names))
	for _, name := range names {
		account := cfg.WechatAccounts[name]
		accounts = append(accounts, map[string]any{
			"name":    name,
			"appid":   account.AppID,
			"current": cfg.WechatAccountNamed && cfg.WechatAccount == name,
		})
	}

	var current any
	if cfg.WechatAccountNamed {
		current = map[string]any{
			"name":  cfg.WechatAccount,
			"appid": cfg.WechatAppID,
		}
	} else if strings.TrimSpace(cfg.WechatAppID) != "" {
		current = map[string]any{
			"name":  "",
			"appid": cfg.WechatAppID,
		}
	}

	return map[string]any{
		"accounts":        accounts,
		"current":         current,
		"default_account": cfg.WechatDefaultAccount,
	}
}

func printWechatAccounts(data map[string]any) {
	fmt.Println("WeChat accounts")
	if current, ok := data["current"].(map[string]any); ok {
		fmt.Printf("current: %s %s\n", current["name"], current["appid"])
	} else {
		fmt.Println("current: none")
	}
	fmt.Printf("default_account: %s\n", data["default_account"])
	fmt.Println("accounts:")
	accounts, _ := data["accounts"].([]map[string]any)
	for _, account := range accounts {
		marker := " "
		if account["current"] == true {
			marker = "*"
		}
		fmt.Printf("%s %s %s\n", marker, account["name"], account["appid"])
	}
}

func runConfigInit(outputFile string) error {
	return initConfigFile(outputFile)
}

// initConfigFile 创建示例配置文件
func initConfigFile(outputFile string) error {
	// 检查文件是否已存在
	if _, err := os.Stat(outputFile); err == nil {
		return newCLIError(codeConfigWriteFailed, fmt.Sprintf("config file already exists: %s", outputFile))
	}

	// 创建示例配置
	cfg := &config.Config{
		WechatAppID:           "your_wechat_appid",
		WechatSecret:          "your_wechat_secret",
		MD2WechatAPIKey:       "your_md2wechat_api_key",
		MD2WechatBaseURL:      "https://www.md2wechat.cn",
		ImageProvider:         "volcengine",
		ImageAPIKey:           "your_image_api_key",
		ImageAPIBase:          "https://ark.cn-beijing.volces.com/api/v3",
		ImageModel:            "doubao-seedream-5-0-pro-260628",
		ImageSize:             "2K",
		DefaultConvertMode:    "api",
		DefaultTheme:          "default",
		DefaultBackgroundType: "none",
		CompressImages:        true,
		MaxImageWidth:         1920,
		MaxImageSize:          5 * 1024 * 1024,
		HTTPTimeout:           30,
	}

	if err := config.SaveConfig(outputFile, cfg); err != nil {
		return wrapCLIError(codeConfigWriteFailed, err, err.Error())
	}

	return nil
}

// printYAMLConfig 打印 YAML 格式配置
func printYAMLConfig(cfg *config.Config, maskSecret bool) {
	fmt.Println("# md2wechat Configuration")
	fmt.Printf("# Config file: %s\n\n", cfg.GetConfigFile())

	fmt.Println("wechat:")
	fmt.Printf("  appid: %s\n", cfg.WechatAppID)
	secret := cfg.WechatSecret
	if maskSecret && secret != "" && secret != "your_wechat_secret" {
		if len(secret) > 4 {
			secret = secret[:2] + "***" + secret[len(secret)-2:]
		} else {
			secret = "***"
		}
	}
	fmt.Printf("  secret: %s\n", secret)
	if cfg.WechatProxyURL != "" {
		configData := cfg.ToMap(maskSecret)
		fmt.Printf("  proxy_url: %s\n", configData["wechat_proxy_url"])
	}
	fmt.Println()

	fmt.Println("api:")
	fmt.Printf("  md2wechat_key: %s\n", maskAPIKey(cfg.MD2WechatAPIKey, maskSecret))
	fmt.Printf("  md2wechat_base_url: %s\n", cfg.MD2WechatBaseURL)
	fmt.Printf("  image_key: %s\n", maskAPIKey(cfg.ImageAPIKey, maskSecret))
	fmt.Printf("  image_provider: %s\n", cfg.ImageProvider)
	fmt.Printf("  image_base_url: %s\n", cfg.ImageAPIBase)
	fmt.Printf("  image_model: %s\n", cfg.ImageModel)
	fmt.Printf("  image_size: %s\n", cfg.ImageSize)
	fmt.Printf("  convert_mode: %s\n", cfg.DefaultConvertMode)
	fmt.Printf("  default_theme: %s\n", cfg.DefaultTheme)
	fmt.Printf("  background_type: %s\n", cfg.DefaultBackgroundType)
	fmt.Printf("  http_timeout: %d\n\n", cfg.HTTPTimeout)

	fmt.Println("image:")
	fmt.Printf("  compress: %v\n", cfg.CompressImages)
	fmt.Printf("  max_width: %d\n", cfg.MaxImageWidth)
	fmt.Printf("  max_size_mb: %d\n", cfg.MaxImageSize/1024/1024)
}

func maskAPIKey(key string, mask bool) string {
	if !mask || key == "" || key == "your_md2wechat_api_key" || key == "your_image_api_key" {
		return key
	}
	if len(key) <= 8 {
		return "***"
	}
	return key[:4] + "***" + key[len(key)-4:]
}

func normalizeConfigOutputPath(outputFile string) string {
	relPath := outputFile
	homeDir, _ := os.UserHomeDir()
	if homeDir != "" && strings.HasPrefix(outputFile, homeDir) {
		rel := strings.TrimPrefix(outputFile, homeDir)
		if strings.HasPrefix(rel, "/") || strings.HasPrefix(rel, "\\") {
			rel =
```

### Core Architecture Module: `cmd/md2wechat/convert.go`
```
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/geekjourneyx/md2wechat-skill/internal/atomicfile"
	"github.com/geekjourneyx/md2wechat-skill/internal/config"
	"github.com/geekjourneyx/md2wechat-skill/internal/converter"
	"github.com/geekjourneyx/md2wechat-skill/internal/draft"
	"github.com/geekjourneyx/md2wechat-skill/internal/image"
	"github.com/geekjourneyx/md2wechat-skill/internal/publish"
	"github.com/geekjourneyx/md2wechat-skill/internal/wechat"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
)

type imageProcessor interface {
	UploadLocalImage(filePath string) (*image.UploadResult, error)
	DownloadAndUpload(url string) (*image.UploadResult, error)
	GenerateAndUpload(prompt string) (*image.GenerateAndUploadResult, error)
	GenerateAndUploadWithSize(prompt string, size string) (*image.GenerateAndUploadResult, error)
}

type subjectReferenceImageProcessor interface {
	GenerateAndUploadWithSubject(prompt, subjectReference string) (*image.GenerateAndUploadResult, error)
}

var (
	newMarkdownConverter = func() converter.Converter {
		return converter.NewConverter(cfg, log)
	}
	newImageProcessor = func() imageProcessor {
		return newRuntimeImageProcessor()
	}
	newImageProcessorWithConfig = func(runtimeCfg *config.Config) imageProcessor {
		return newRuntimeImageProcessorWithConfig(runtimeCfg)
	}
	newDraftCreator = func() publish.DraftCreator {
		return draft.NewArtifactDraftCreator(cfg, log)
	}
	uploadCoverImageFn = uploadCoverImage
	newPublishService  = func() *publish.Service {
		return publish.NewService(log, newMarkdownConverter(), newImageProcessor(), newDraftCreator(), uploadCoverImageFn)
	}
)

// convertCmd convert 命令
var convertCmd = &cobra.Command{
	Use:   "convert <markdown_file>",
	Short: "Convert Markdown to WeChat HTML",
	Long: `Convert Markdown article to WeChat Official Account formatted HTML.

Supports two conversion modes:
  - api: Use md2wechat API (stable, requires API key)
  - ai:  Prepare an action_required prompt for a host Agent or external model.
         md2wechat does not call a model, generate HTML, upload assets, or create a draft in this mode.

Theme availability is resolved at runtime. Discover the current catalog with:
  md2wechat themes list --json

Inspect one full theme definition with:
  md2wechat themes show <name> --json`,
	Args: cobra.ExactArgs(1),
	PreRunE: func(cmd *cobra.Command, args []string) error {
		return initConfig()
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runConvert(cmd, args)
	},
}

// convert 命令参数
var (
	convertMode           string
	convertTheme          string
	convertAPIKey         string
	convertFontSize       string
	convertBackgroundType string
	convertCustomPrompt   string
	convertOutput         string
	convertPreview        bool
	convertUpload         bool
	convertDraft          bool
	convertSaveDraft      string
	convertCoverImage     string // 封面图片路径
	convertCoverMediaID   string // 已存在的微信封面素材 media_id
	convertTitle          string
	convertAuthor         string
	convertDigest         string
)

func init() {
	// 添加 flags
	convertCmd.Flags().StringVar(&convertMode, "mode", "api", "Conversion mode: api or ai")
	convertCmd.Flags().StringVar(&convertTheme, "theme", "default", "Theme name")
	convertCmd.Flags().StringVar(&convertAPIKey, "api-key", "", "API key for md2wechat.cn")
	convertCmd.Flags().StringVar(&convertFontSize, "font-size", "medium", "Font size: small/medium/large (API mode only)")
	convertCmd.Flags().StringVar(&convertBackgroundType, "background-type", "none", "Background type: default/grid/none (API mode only)")
	convertCmd.Flags().StringVar(&convertCustomPrompt, "custom-prompt", "", "Custom AI prompt (AI mode only)")
	convertCmd.Flags().StringVarP(&convertOutput, "output", "o", "", "Output HTML file path")
	convertCmd.Flags().BoolVar(&convertPreview, "preview", false, "Preview only, do not upload images")
	convertCmd.Flags().BoolVar(&convertUpload, "upload", false, "Upload images to WeChat and replace URLs")
	convertCmd.Flags().BoolVar(&convertDraft, "draft", false, "Create WeChat draft after conversion")
	convertCmd.Flags().StringVar(&convertSaveDraft, "save-draft", "", "Save draft JSON to file")
	convertCmd.Flags().StringVar(&convertCoverImage, "cover", "", "Cover image path for draft (required when using --draft)")
	convertCmd.Flags().StringVar(&convertCoverMediaID, "cover-media-id", "", "Existing WeChat cover media_id for draft (mutually exclusive with --cover)")
	convertCmd.Flags().StringVar(&convertTitle, "title", "", "Override article title (max 32 characters)")
	convertCmd.Flags().StringVar(&convertAuthor, "author", "", "Override article author (max 16 characters)")
	convertCmd.Flags().StringVar(&convertDigest, "digest", "", "Override article digest (max 128 characters)")
}

// runConvert 执行转换
func runConvert(cmd *cobra.Command, args []string) error {
	markdownFile := args[0]
	applyEffectiveCommandTheme(cmd, &convertTheme)

	if err := validateConvertConfig(); err != nil {
		return err
	}

	log.Info("starting conversion",
		zap.String("file", markdownFile),
		zap.String("mode", convertMode),
		zap.String("theme", convertTheme))

	// 读取 Markdown 文件
	markdown, err := os.ReadFile(markdownFile)
	if err != nil {
		return wrapCLIError(codeConvertReadFailed, err, fmt.Sprintf("read markdown file: %v", err))
	}

	document := converter.ParseArticleDocument(string(markdown))
	metadata := document.Metadata
	bodyMarkdown := document.Body
	resolvedTitle := firstNonEmptyTrimmed(convertTitle, metadata.Title)
	resolvedAuthor := firstNonEmptyTrimmed(convertAuthor, metadata.Author)
	resolvedDigest := firstNonEmptyTrimmed(convertDigest, metadata.Digest)
	if err := validateConvertMetadata(resolvedTitle, resolvedAuthor, resolvedDigest); err != nil {
		return err
	}

	service := newPublishService()
	input := &publish.ConvertInput{
		Source: publish.ArticleSource{
			Path:     markdownFile,
			Markdown: bodyMarkdown,
			Metadata: publish.Metadata{
				Title:  resolvedTitle,
				Author: resolvedAuthor,
				Digest: resolvedDigest,
			},
		},
		Intent: publish.PublishIntent{
			Mode:        convertMode,
			Preview:     convertPreview,
			Upload:      convertUpload,
			CreateDraft: convertDraft,
			SaveDraft:   convertSaveDraft != "",
		},
		ConvertRequest: &converter.ConvertRequest{
			Markdown: bodyMarkdown,
			Metadata: converter.ArticleMetadata{
				Title:  resolvedTitle,
				Author: resolvedAuthor,
				Digest: resolvedDigest,
			},
			Mode:           converter.ConvertMode(convertMode),
			Theme:          convertTheme,
			APIKey:         convertAPIKey,
			FontSize:       convertFontSize,
			BackgroundType: convertBackgroundType,
			CustomPrompt:   convertCustomPrompt,
		},
		MarkdownDir:    filepath.Dir(markdownFile),
		OutputFile:     convertOutput,
		SaveDraftPath:  convertSaveDraft,
		CoverImagePath: convertCoverImage,
		CoverMediaID:   strings.TrimSpace(convertCoverMediaID),
	}

	if err := service.Preflight(input); err != nil {
		return mapConvertServiceError(err)
	}
	if convertUpload || convertDraft {
		if err := prepareWeChatSideEffectWithAPIKey(convertAPIKey); err != nil {
			return err
		}
	}

	output, err := service.Convert(input)
	if err != nil {
		return mapConvertServiceError(err)
	}
	result := output.Conversion
	if result == nil {
		return newCLIError(codeConvertFailed, "conversion returned no result")
	}

	// AI 模式返回的是待外部执行的请求，不应被当作失败路径拦截
	if convertMode == "ai" && converter.IsAIRequest(result) {
		return handleAIResult(result, markdownFile)
	}

	log.Info("conversion completed",
		zap.String("mode", string(result.Mode)),
		zap.String("theme", result.Theme),
		zap.Int("image_count", len(output.Artifact.Assets)))

	if jsonOutput {
		responseSuccessWith(codeConvertCompleted, "Conversion completed", map[string]any{
			"mode":        string(result.Mode),
			"theme":       result.Theme,
			"html":        output.Artifact.HTML,
			"image_count": len(output.Artifact.Assets),
			"assets":      output.Artifact.Assets,
			"output_file": output.Artifact.OutputFile,
			"preview":     convertPreview,
			"upload":      convertUpload,
			"draft":       convertDraft,
			"save_draft":  output.DraftSaved,
			"title":       output.Artifact.Metadata.Title,
			"author":      output.Artifact.Metadata.Author,
			"digest":      output.Artifact.Metadata.Digest,
			"draft_id":    output.Artifact.DraftMediaID,
			"draft_url":   output.Artifact.DraftURL,
			"cover_id":    output.Artifact.CoverMediaID,
		})
		return nil
	}

	// 输出 HTML
	if err := outputHTML(output.Artifact.HTML, "", convertPreview); err != nil {
		return wrapCLIError(codeConvertFailed, err, err.Error())
	}

	return nil
}

func applyEffectiveCommandTheme(cmd *cobra.Command, theme *string) {
	if cmd == nil || theme == nil {
		return
	}
	themeFlag := cmd.Flags().Lookup("theme")
	if themeFlag != nil && themeFlag.Changed {
		return
	}
	*theme = effectiveDefaultTheme(cfg)
}

// handleAIResult 处理 AI 模式结果
func handleAIResult(result *converter.ConvertResult, markdownFile string) error {
	prompt, images, ok := converter.GetAIRequestInfo(result)
	if !ok {
		return newCLIError(codeConvertFailed, "invalid AI request result")
	}

	log.Info("AI mode request prepared",
		zap.Int("image_count", len(images)),
		zap.Int("prompt_length", len(prompt)))

	promptOutputPath := resolveAIPromptOutputPath(convertOutput)

	// 输出 AI 请求信息
	response := map[string]any{
		"markdown_file": markdownFile,
		"mode":          "ai",
		"action":        "ai_request",
		"prompt":        prompt,
		"images":        images,
		"prompt_file":   promptOutputPath,
	}
	if convertOutput != "" {
		response["requested_output_file"] = convertOutput
	}

	if promptOutputPath != "" {
		if _, err := atomicfile.Write(promptOutputPath, []byte(prompt)); err != nil {
			wrapped := fmt.Errorf("write AI prompt file: %w", err)
			return wrapCLIError(codeConvertFailed, wrapped, wrapped.Error())
		}
		log.Info("ai prompt saved", zap.String("file", promptOutputPath))
	}

	responseActionRequiredWith(codeCo
```

### Core Architecture Module: `cmd/md2wechat/create_image_post.go`
```
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/geekjourneyx/md2wechat-skill/internal/atomicfile"
	"github.com/geekjourneyx/md2wechat-skill/internal/draft"
	"github.com/geekjourneyx/md2wechat-skill/internal/publish"
	"github.com/spf13/cobra"
)

type imagePostService interface {
	PreviewImagePost(input *publish.ImagePostInput) (*publish.ImagePostPreview, error)
	CreateImagePost(input *publish.ImagePostInput) (*publish.ImagePostResult, error)
}

var (
	imagePostTitle       string
	imagePostContent     string
	imagePostImages      string
	imagePostFromMD      string
	imagePostOpenComment bool
	imagePostFansOnly    bool
	imagePostDryRun      bool
	imagePostOutput      string

	newImagePostService = func() imagePostService {
		return publish.NewImagePostService(newRuntimeImageProcessor(), draft.NewImagePostCreator(cfg, log))
	}
	isTerminalFn = isTerminal
)

var createImagePostCmd = &cobra.Command{
	Use:   "create_image_post",
	Short: "Create WeChat image post (小绿书/newspic)",
	Long: `Create a WeChat Official Account image post (小绿书/图片消息).

This command allows you to create image-only posts (newspic type) with up to 20 images.

Examples:
  # Create with comma-separated images
  md2wechat create_image_post -t "Weekend Trip" --images photo1.jpg,photo2.jpg,photo3.jpg

  # Extract images from Markdown file
  md2wechat create_image_post -t "Travel Diary" -m article.md

  # With description and comment settings
  md2wechat create_image_post -t "Food Blog" -c "Today's lunch" --images food.jpg --open-comment

  # Read description from stdin
  echo "Daily check-in" | md2wechat create_image_post -t "Daily" --images pic.jpg

  # Preview mode (dry-run)
  md2wechat create_image_post -t "Test" --images a.jpg,b.jpg --dry-run`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		return initConfig()
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		response, err := runCreateImagePost()
		if err != nil {
			return err
		}
		if imagePostDryRun {
			responseSuccessWith(codeImagePostPreviewReady, "Image post preview prepared", response)
			return nil
		}
		responseSuccessWith(codeImagePostCreated, "Image post created successfully", response)
		return nil
	},
}

func runCreateImagePost() (any, error) {
	req := &publish.ImagePostInput{
		Title:       imagePostTitle,
		Content:     imagePostContent,
		OpenComment: imagePostOpenComment,
		FansOnly:    imagePostFansOnly,
	}

	if imagePostImages != "" {
		for _, img := range strings.Split(imagePostImages, ",") {
			img = strings.TrimSpace(img)
			if img != "" {
				req.Images = append(req.Images, img)
			}
		}
	}

	if imagePostFromMD != "" {
		req.FromMarkdown = imagePostFromMD
	}

	if imagePostContent == "" && !isTerminalFn() {
		scanner := bufio.NewScanner(os.Stdin)
		var lines []string
		for scanner.Scan() {
			lines = append(lines, scanner.Text())
		}
		if len(lines) > 0 {
			req.Content = strings.Join(lines, "\n")
		}
	}

	if req.Title == "" {
		return nil, newCLIError(codeImagePostInvalid, "--title is required")
	}

	if len(req.Images) == 0 && req.FromMarkdown == "" {
		return nil, newCLIError(codeImagePostInvalid, "--images or --from-markdown is required")
	}

	if err := resolveExplicitWeChatAccountIfProvided(); err != nil {
		return nil, err
	}

	svc := newImagePostService()
	preview, err := svc.PreviewImagePost(req)
	if err != nil {
		return nil, wrapCLIError(codeImagePostPreviewFailed, err, err.Error())
	}

	if imagePostDryRun {
		if imagePostOutput != "" {
			data, _ := json.MarshalIndent(preview, "", "  ")
			if err := os.WriteFile(imagePostOutput, data, 0644); err != nil {
				return nil, wrapCLIError(codeImagePostPreviewFailed, err, err.Error())
			}
		}

		return map[string]any{
			"mode":    "dry-run",
			"preview": preview,
		}, nil
	}

	if imagePostOutput != "" {
		if err := atomicfile.Probe(imagePostOutput); err != nil {
			return nil, wrapCLIError(
				codeImagePostCreateFailed,
				err,
				err.Error(),
			)
		}
	}

	if err := prepareWeChatSideEffect(); err != nil {
		return nil, err
	}

	result, err := svc.CreateImagePost(req)
	if err != nil {
		return nil, wrapCLIError(codeImagePostCreateFailed, err, err.Error())
	}

	if imagePostOutput != "" {
		data, _ := json.MarshalIndent(result, "", "  ")
		if _, err := atomicfile.Write(imagePostOutput, data); err != nil {
			return nil, newCLIErrorWithDetails(
				codeImagePostCreateFailed,
				fmt.Sprintf(
					"image post draft %s was created, but saving --output failed: %v",
					result.MediaID,
					err,
				),
				map[string]any{
					"draft_created": true,
					"media_id":      result.MediaID,
					"output_saved":  false,
					"output_file":   imagePostOutput,
				},
				[]string{
					"Do not retry create_image_post automatically; inspect the WeChat draft first.",
				},
			)
		}
	}

	return result, nil
}

// isTerminal 检查 stdin 是否是终端
func isTerminal() bool {
	fi, err := os.Stdin.Stat()
	if err != nil {
		return true
	}
	return fi.Mode()&os.ModeCharDevice != 0
}

func init() {
	createImagePostCmd.Flags().StringVarP(&imagePostTitle, "title", "t", "", "Post title (required)")
	createImagePostCmd.Flags().StringVarP(&imagePostContent, "content", "c", "", "Post description text")
	createImagePostCmd.Flags().StringVar(&imagePostImages, "images", "", "Image paths, comma-separated")
	createImagePostCmd.Flags().StringVarP(&imagePostFromMD, "from-markdown", "m", "", "Extract images from Markdown file")
	createImagePostCmd.Flags().BoolVar(&imagePostOpenComment, "open-comment", false, "Enable comments")
	createImagePostCmd.Flags().BoolVar(&imagePostFansOnly, "fans-only", false, "Only fans can comment")
	createImagePostCmd.Flags().BoolVar(&imagePostDryRun, "dry-run", false, "Preview mode without creating draft")
	createImagePostCmd.Flags().StringVarP(&imagePostOutput, "output", "o", "", "Save result to JSON file")
}

```

### Core Architecture Module: `cmd/md2wechat/discovery.go`
```
package main

import (
	"fmt"
	"sort"
	"strings"

	articleadvise "github.com/geekjourneyx/md2wechat-skill/internal/advise"
	"github.com/geekjourneyx/md2wechat-skill/internal/config"
	"github.com/geekjourneyx/md2wechat-skill/internal/converter"
	"github.com/geekjourneyx/md2wechat-skill/internal/image"
	"github.com/geekjourneyx/md2wechat-skill/internal/layoutcatalog"
	"github.com/geekjourneyx/md2wechat-skill/internal/promptcatalog"
	titlebuilder "github.com/geekjourneyx/md2wechat-skill/internal/title"
	"github.com/spf13/cobra"
)

const (
	codeCapabilitiesShown = "CAPABILITIES_SHOWN"
	codeProvidersShown    = "PROVIDERS_SHOWN"
	codeThemesShown       = "THEMES_SHOWN"
	codePromptsShown      = "PROMPTS_SHOWN"
)

type providerView struct {
	Name                     string                    `json:"name"`
	Aliases                  []string                  `json:"aliases,omitempty"`
	Description              string                    `json:"description"`
	RequiredConfig           []string                  `json:"required_config,omitempty"`
	OptionalConfig           []string                  `json:"optional_config,omitempty"`
	DefaultBaseURL           string                    `json:"default_base_url,omitempty"`
	DefaultModel             string                    `json:"default_model,omitempty"`
	SupportedModels          []image.ProviderModelMeta `json:"supported_models,omitempty"`
	SupportsSize             bool                      `json:"supports_size"`
	SupportsSubjectReference bool                      `json:"supports_subject_reference"`
	Current                  bool                      `json:"current"`
	Configured               bool                      `json:"configured"`
}

type providerListItem struct {
	Name                     string   `json:"name"`
	Aliases                  []string `json:"aliases,omitempty"`
	Description              string   `json:"description"`
	SupportsSize             bool     `json:"supports_size"`
	SupportsSubjectReference bool     `json:"supports_subject_reference"`
	Current                  bool     `json:"current"`
	Configured               bool     `json:"configured"`
}

type themeView struct {
	Name               string               `json:"name"`
	Type               string               `json:"type"`
	Description        string               `json:"description"`
	Version            string               `json:"version,omitempty"`
	APITheme           string               `json:"api_theme,omitempty"`
	Selectable         bool                 `json:"selectable"`
	MetadataIncomplete bool                 `json:"metadata_incomplete"`
	Style              converter.ThemeStyle `json:"style,omitempty"`
}

type themeListItem struct {
	Name               string `json:"name"`
	Type               string `json:"type"`
	Description        string `json:"description"`
	Version            string `json:"version,omitempty"`
	APITheme           string `json:"api_theme,omitempty"`
	Selectable         bool   `json:"selectable"`
	MetadataIncomplete bool   `json:"metadata_incomplete"`
}

type promptListItem struct {
	Name                    string   `json:"name"`
	Kind                    string   `json:"kind"`
	Description             string   `json:"description"`
	Version                 string   `json:"version"`
	Archetype               string   `json:"archetype,omitempty"`
	PrimaryUseCase          string   `json:"primary_use_case,omitempty"`
	CompatibleUseCases      []string `json:"compatible_use_cases,omitempty"`
	RecommendedAspectRatios []string `json:"recommended_aspect_ratios,omitempty"`
	DefaultAspectRatio      string   `json:"default_aspect_ratio,omitempty"`
	Tags                    []string `json:"tags,omitempty"`
	Variables               []string `json:"variables,omitempty"`
}

var (
	promptKind      string
	promptArchetype string
	promptTag       string
	promptVars      []string
)

var capabilitiesCmd = &cobra.Command{
	Use:   "capabilities",
	Short: "Show machine-readable CLI capabilities",
}

func runCapabilities(cmd *cobra.Command, args []string) error {
	data, err := buildCapabilitiesData()
	if err != nil {
		return wrapCLIError(codeError, err, err.Error())
	}
	responseSuccessWith(codeCapabilitiesShown, "Capabilities shown", data)
	return nil
}

var providersCmd = &cobra.Command{
	Use:   "providers",
	Short: "Inspect supported image providers",
}

var providersListCmd = &cobra.Command{
	Use:   "list",
	Short: "List supported image providers",
	RunE: func(cmd *cobra.Command, args []string) error {
		providers, err := buildProviderViews()
		if err != nil {
			return wrapCLIError(codeError, err, err.Error())
		}
		items := make([]providerListItem, 0, len(providers))
		for _, provider := range providers {
			items = append(items, providerToListItem(provider))
		}
		responseSuccessWith(codeProvidersShown, "Providers shown", map[string]any{"providers": items})
		return nil
	},
}

var providersShowCmd = &cobra.Command{
	Use:   "show <name>",
	Short: "Show provider details",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		providers, err := buildProviderViews()
		if err != nil {
			return wrapCLIError(codeError, err, err.Error())
		}
		for _, provider := range providers {
			if provider.Name == args[0] || contains(provider.Aliases, args[0]) {
				responseSuccessWith(codeProvidersShown, "Provider shown", map[string]any{"provider": provider})
				return nil
			}
		}
		return newCLIError(codeConfigInvalid, fmt.Sprintf("unknown provider: %s", args[0]))
	},
}

var themesCmd = &cobra.Command{
	Use:   "themes",
	Short: "Inspect available convert themes",
}

var themesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List available themes",
	RunE: func(cmd *cobra.Command, args []string) error {
		themes, err := listThemeViews()
		if err != nil {
			return wrapCLIError(codeError, err, err.Error())
		}
		items := make([]themeListItem, 0, len(themes))
		for _, theme := range themes {
			items = append(items, themeToListItem(theme))
		}
		responseSuccessWith(codeThemesShown, "Themes shown", map[string]any{"themes": items})
		return nil
	},
}

var themesShowCmd = &cobra.Command{
	Use:   "show <name>",
	Short: "Show theme details",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		tm := converter.NewThemeManager()
		if err := tm.LoadThemes(); err != nil {
			return wrapCLIError(codeError, err, err.Error())
		}
		theme, err := tm.GetTheme(args[0])
		if err != nil {
			return newCLIError(codeConfigInvalid, err.Error())
		}
		responseSuccessWith(codeThemesShown, "Theme shown", map[string]any{"theme": themeToView(*theme)})
		return nil
	},
}

var promptsCmd = &cobra.Command{
	Use:   "prompts",
	Short: "Inspect bundled prompt assets",
}

var promptsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List prompts in the catalog",
	RunE: func(cmd *cobra.Command, args []string) error {
		cat, err := promptcatalog.DefaultCatalog()
		if err != nil {
			return wrapCLIError(codeError, err, err.Error())
		}
		prompts := cat.ListFiltered(promptcatalog.ListFilter{
			Kind:      promptKind,
			Archetype: promptArchetype,
			Tag:       promptTag,
		})
		items := make([]promptListItem, 0, len(prompts))
		for _, prompt := range prompts {
			items = append(items, promptToListItem(prompt))
		}
		responseSuccessWith(codePromptsShown, "Prompts shown", map[string]any{
			"kind":      promptKind,
			"archetype": promptArchetype,
			"tag":       promptTag,
			"prompts":   items,
		})
		return nil
	},
}

var promptsShowCmd = &cobra.Command{
	Use:   "show <name>",
	Short: "Show prompt details",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cat, err := promptcatalog.DefaultCatalog()
		if err != nil {
			return wrapCLIError(codeError, err, err.Error())
		}
		spec, err := cat.Get(promptKind, args[0])
		if err != nil {
			return newCLIError(codeConfigInvalid, err.Error())
		}
		if promptArchetype != "" && !strings.EqualFold(spec.Archetype, promptArchetype) {
			return newCLIError(codeConfigInvalid, fmt.Sprintf("prompt %s archetype mismatch: expected %s, got %s", spec.Name, promptArchetype, spec.Archetype))
		}
		if promptTag != "" && !contains(spec.Tags, promptTag) {
			return newCLIError(codeConfigInvalid, fmt.Sprintf("prompt %s does not have tag %s", spec.Name, promptTag))
		}
		responseSuccessWith(codePromptsShown, "Prompt shown", map[string]any{"prompt": spec})
		return nil
	},
}

var promptsRenderCmd = &cobra.Command{
	Use:   "render <name>",
	Short: "Render a prompt template with variables",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cat, err := promptcatalog.DefaultCatalog()
		if err != nil {
			return wrapCLIError(codeError, err, err.Error())
		}
		vars, err := parsePromptVars(promptVars)
		if err != nil {
			return newCLIError(codeConfigInvalid, err.Error())
		}
		rendered, spec, err := cat.Render(promptKind, args[0], vars)
		if err != nil {
			return newCLIError(codeConfigInvalid, err.Error())
		}
		responseSuccessWith(codePromptsShown, "Prompt rendered", map[string]any{
			"prompt":   promptToListItem(*spec),
			"vars":     vars,
			"rendered": rendered,
		})
		return nil
	},
}

func init() {
	capabilitiesCmd.RunE = runCapabilities
	providersCmd.AddCommand(providersListCmd, providersShowCmd)
	themesCmd.AddCommand(themesListCmd, themesShowCmd)
	promptsListCmd.Flags().StringVar(&promptKind, "kind", "", "Prompt kind filter")
	promptsListCmd.Flags().StringVar(&promptArchetype, "archetype", "", "Prompt archetype filter")
	promptsListCmd.Flags().StringVar(&promptTag, "tag", "", "Prompt tag filter")
	promptsShowCmd.Flags().StringVar(&promptKind, "kind", "", "Prompt kind")
	promptsShowCmd.Flags().StringVar(&promptArchetype, "archetype", "", "Expected prompt archetype")
	promptsShowCmd.Flags().StringVar(&promptTag, "tag", "", "Expected prompt tag")
	promptsRenderCmd.Flags().StringVar(&promptKind, "kind", "", "Prompt kind")
	promptsRenderCmd.Flags().StringArrayVar(&promptVars, "var", nil, "Pr
```

### Core Architecture Module: `cmd/md2wechat/doctor.go`
```
package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/geekjourneyx/md2wechat-skill/internal/config"
	"github.com/geekjourneyx/md2wechat-skill/internal/doctor"
)

var doctorCmd = &cobra.Command{
	Use:   "doctor",
	Short: "Diagnose local md2wechat readiness",
	Long: `Diagnose local md2wechat readiness without calling remote APIs.

doctor checks config loading, default conversion mode, API key presence,
theme compatibility, layout catalog availability, and WeChat draft credential
presence. It does not validate live authentication, upload images, or create drafts.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		report := runDoctor()
		if jsonOutput {
			responseSuccessWith(codeDoctorCompleted, "Doctor report completed", report)
			return nil
		}
		printDoctorReport(report)
		return nil
	},
}

func runDoctor() doctor.Report {
	config.SetQuiet(true)
	loaded, err := config.Load()
	if err != nil {
		return doctor.LoadError(err)
	}
	return doctor.RunLocal(loaded)
}

func printDoctorReport(report doctor.Report) {
	_, _ = fmt.Fprintf(os.Stdout, "md2wechat doctor\n\n")
	_, _ = fmt.Fprintf(os.Stdout, "Overall: %s\n", report.Overall)
	_, _ = fmt.Fprintf(os.Stdout, "Live checks: %v\n\n", report.Live)
	for _, check := range report.Checks {
		_, _ = fmt.Fprintf(os.Stdout, "%s %s - %s\n", strings.ToUpper(check.Status), check.ID, check.Message)
		for _, action := range check.NextActions {
			_, _ = fmt.Fprintf(os.Stdout, "  - %s\n", action)
		}
	}
	_, _ = fmt.Fprintf(os.Stdout, "\nReadiness:\n")
	_, _ = fmt.Fprintf(os.Stdout, "  format_api: %v\n", report.Readiness.FormatAPI)
	_, _ = fmt.Fprintf(os.Stdout, "  advanced_layout: %v\n", report.Readiness.AdvancedLayout)
	_, _ = fmt.Fprintf(os.Stdout, "  draft: %v\n", report.Readiness.Draft)
}

```

### Core Architecture Module: `cmd/md2wechat/generate_image.go`
```
package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/geekjourneyx/md2wechat-skill/internal/config"
	"github.com/geekjourneyx/md2wechat-skill/internal/converter"
	"github.com/geekjourneyx/md2wechat-skill/internal/image"
	"github.com/geekjourneyx/md2wechat-skill/internal/promptcatalog"
)

var (
	generateImageCmdSize     string
	generateImageCmdModel    string
	generateImageCmdPreset   string
	generateImageCmdArticle  string
	generateImageCmdTitle    string
	generateImageCmdSummary  string
	generateImageCmdKeywords string
	generateImageCmdStyle    string
	generateImageCmdAspect   string
	generateImageCmdSubject  string
	generateImageCmdPlan     bool
)

type generateImageInput struct {
	Command           string
	Plan              bool
	RawPrompt         string
	Preset            string
	Article           string
	Title             string
	Summary           string
	Keywords          string
	Style             string
	Aspect            string
	Size              string
	Model             string
	SubjectReference  string
	RequiredArchetype string
}

type generateImageContext struct {
	Title     string
	Summary   string
	Keywords  string
	KeyPoints string
}

type generateImagePromptResolution struct {
	Prompt string
	Spec   *promptcatalog.PromptSpec
	Ctx    *generateImageContext
	Style  string
	Aspect string
}

type generateImagePlan struct {
	Mode                    string   `json:"mode"`
	Command                 string   `json:"command"`
	ExecutionOwner          string   `json:"execution_owner"`
	SideEffects             bool     `json:"side_effects"`
	RequiresProvider        bool     `json:"requires_provider"`
	RequiresImageAPIKey     bool     `json:"requires_image_api_key"`
	Prompt                  string   `json:"prompt"`
	RawPrompt               string   `json:"raw_prompt"`
	Preset                  string   `json:"preset"`
	Archetype               string   `json:"archetype"`
	PrimaryUseCase          string   `json:"primary_use_case"`
	CompatibleUseCases      []string `json:"compatible_use_cases"`
	RecommendedAspectRatios []string `json:"recommended_aspect_ratios"`
	DefaultAspectRatio      string   `json:"default_aspect_ratio"`
	Article                 string   `json:"article"`
	Title                   string   `json:"title"`
	Summary                 string   `json:"summary"`
	Keywords                string   `json:"keywords"`
	Style                   string   `json:"style"`
	Aspect                  string   `json:"aspect"`
	Size                    string   `json:"size"`
	ModelHint               string   `json:"model_hint"`
	SubjectReference        string   `json:"subject_reference,omitempty"`
	SuggestedFilename       string   `json:"suggested_filename"`
	AltText                 string   `json:"alt_text"`
}

func runGenerateImage(args []string) error {
	input := generateImageInput{
		Command:          "generate_image",
		Plan:             generateImageCmdPlan,
		Preset:           generateImageCmdPreset,
		Article:          generateImageCmdArticle,
		Title:            generateImageCmdTitle,
		Summary:          generateImageCmdSummary,
		Keywords:         generateImageCmdKeywords,
		Style:            generateImageCmdStyle,
		Aspect:           generateImageCmdAspect,
		Size:             generateImageCmdSize,
		Model:            generateImageCmdModel,
		SubjectReference: generateImageCmdSubject,
	}
	if len(args) > 0 {
		input.RawPrompt = args[0]
	}
	return runGenerateImageWithInput(input)
}

func runGeneratePresetImage(archetype, defaultPreset string, input generateImageInput) error {
	if strings.TrimSpace(input.Command) == "" {
		input.Command = "generate_" + archetype
	}
	input.RequiredArchetype = archetype
	if strings.TrimSpace(input.Preset) == "" {
		input.Preset = defaultPreset
	}
	return runGenerateImageWithInput(input)
}

func runGenerateImageWithInput(input generateImageInput) error {
	if input.Plan {
		return runGenerateImagePlan(input)
	}

	subjectReference := strings.TrimSpace(input.SubjectReference)
	if subjectReference != "" {
		if err := ensureSubjectReferenceSupported(input.Model, subjectReference); err != nil {
			return err
		}
	}

	if err := prepareWeChatSideEffect(); err != nil {
		return err
	}
	if cfg.ImageAPIKey == "" {
		err := &config.ConfigError{Field: "ImageAPIKey", Message: "IMAGE_API_KEY is required for image generation"}
		return wrapCLIError(codeConfigInvalid, err, err.Error())
	}

	prompt, err := resolveGenerateImagePrompt(input)
	if err != nil {
		return newCLIError(codeConfigInvalid, err.Error())
	}

	processor := resolveImageProcessor(input.Model)
	if subjectReference != "" {
		if strings.TrimSpace(input.Size) != "" {
			cfgCopy := *cfg
			cfgCopy.ImageSize = strings.TrimSpace(input.Size)
			if strings.TrimSpace(input.Model) != "" {
				cfgCopy.ImageModel = strings.TrimSpace(input.Model)
			}
			processor = newImageProcessorWithConfig(&cfgCopy)
		}
		subjectProcessor, ok := processor.(subjectReferenceImageProcessor)
		if !ok {
			return newCLIError(codeConfigInvalid, "configured image processor does not support --subject-reference")
		}
		result, err := subjectProcessor.GenerateAndUploadWithSubject(prompt, subjectReference)
		if err != nil {
			return wrapCLIError(codeImageGenerateFailed, err, err.Error())
		}
		responseSuccess(result)
		return nil
	}
	if input.Size != "" {
		result, err := processor.GenerateAndUploadWithSize(prompt, input.Size)
		if err != nil {
			return wrapCLIError(codeImageGenerateFailed, err, err.Error())
		}
		responseSuccess(result)
		return nil
	}

	result, err := processor.GenerateAndUpload(prompt)
	if err != nil {
		return wrapCLIError(codeImageGenerateFailed, err, err.Error())
	}
	responseSuccess(result)
	return nil
}

func resolveImageProcessor(model string) imageProcessor {
	model = strings.TrimSpace(model)
	if model == "" {
		return newImageProcessor()
	}

	cfgCopy := *cfg
	cfgCopy.ImageModel = model
	return newImageProcessorWithConfig(&cfgCopy)
}

// resolveImageProviderName returns the configured image provider, falling back
// to the same default the provider factory uses.
func resolveImageProviderName() string {
	provider := strings.TrimSpace(cfg.ImageProvider)
	if provider == "" {
		provider = "openai"
	}
	return provider
}

// resolveImageModelName returns the model this command will actually use,
// honouring --model first, then the config, then the provider default.
func resolveImageModelName(provider, override string) string {
	if model := strings.TrimSpace(override); model != "" {
		return model
	}
	if model := strings.TrimSpace(cfg.ImageModel); model != "" {
		return model
	}
	return image.DefaultProviderModel(provider)
}

// ensureSubjectReferenceSupported rejects --subject-reference from provider
// metadata. A runtime interface assertion cannot do this because the concrete
// processor always implements the subject-reference method regardless of the
// configured provider, which would defer the failure to the generate call.
func ensureSubjectReferenceSupported(modelOverride, subjectReference string) error {
	if err := image.ValidateSubjectReferenceURL(subjectReference); err != nil {
		return newCLIError(codeConfigInvalid, err.Error())
	}

	provider := resolveImageProviderName()
	if !image.ProviderSupportsSubjectReference(provider) {
		message := fmt.Sprintf("image provider %s does not support --subject-reference", provider)
		if supported := image.SubjectReferenceProviderNames(); len(supported) > 0 {
			message += "; supported providers: " + strings.Join(supported, ", ")
		}
		return newCLIError(codeConfigInvalid, message)
	}

	model := resolveImageModelName(provider, modelOverride)
	if !image.ModelSupportsSubjectReference(provider, model) {
		message := fmt.Sprintf("image model %s does not support --subject-reference", model)
		if hint := image.SubjectReferenceModelsHint(provider); hint != "" {
			message += "; " + hint
		}
		return newCLIError(codeConfigInvalid, message)
	}
	return nil
}

func resolveGenerateImagePrompt(input generateImageInput) (string, error) {
	resolved, err := resolveGenerateImagePromptDetails(input)
	if err != nil {
		return "", err
	}
	return resolved.Prompt, nil
}

func resolveGenerateImagePromptDetails(input generateImageInput) (*generateImagePromptResolution, error) {
	if strings.TrimSpace(input.Preset) == "" {
		if strings.TrimSpace(input.RawPrompt) == "" {
			return nil, fmt.Errorf("generate_image requires a prompt or --preset")
		}
		return &generateImagePromptResolution{Prompt: input.RawPrompt}, nil
	}

	if strings.TrimSpace(input.RawPrompt) != "" {
		return nil, fmt.Errorf("do not pass a raw prompt when --preset is used")
	}

	cat, err := promptcatalog.DefaultCatalog()
	if err != nil {
		return nil, err
	}
	spec, err := cat.Get("image", input.Preset)
	if err != nil {
		return nil, err
	}
	if input.RequiredArchetype != "" && !promptcatalog.SupportsUseCase(spec, input.RequiredArchetype) {
		return nil, fmt.Errorf("preset %s is %s/%s, expected %s", spec.Name, spec.Archetype, spec.PrimaryUseCase, input.RequiredArchetype)
	}

	ctx, err := buildGenerateImageContext(input)
	if err != nil {
		return nil, err
	}

	style := defaultString(input.Style, defaultVisualStyle(spec.Archetype))
	aspect := defaultString(input.Aspect, spec.DefaultAspectRatio, defaultAspectRatio(spec.Archetype))
	rendered, _, err := cat.Render("image", input.Preset, map[string]string{
		"ARTICLE_TITLE":   ctx.Title,
		"ARTICLE_SUMMARY": ctx.Summary,
		"KEYWORDS":        ctx.Keywords,
		"KEY_POINTS":      ctx.KeyPoints,
		"VISUAL_STYLE":    style,
		"ASPECT_RATIO":    aspect,
	})
	if err != nil {
		return nil, err
	}
	return &generateImagePromptResolution{
		Prompt: rendered,
		Spec:   spec,
		Ctx:    ctx,
		Style:  style,
		Aspect: aspect,
	}, nil
}

func runGenerateImagePlan(input generateImageInput) error {
	if !jsonOutput {
		return newCLIError(codeConfigInvalid, "--plan requires --json")
	}

	resolved, err := resolveGenerateImagePromptDetails(input)
	if err != nil {
		return newCLIError(codeConfigInvalid, err.Error())
	}

	responseActi
```

### Core Architecture Module: `cmd/md2wechat/generate_presets.go`
```
package main

import "github.com/spf13/cobra"

var (
	generateCoverCmdPreset   string
	generateCoverCmdArticle  string
	generateCoverCmdTitle    string
	generateCoverCmdSummary  string
	generateCoverCmdKeywords string
	generateCoverCmdStyle    string
	generateCoverCmdAspect   string
	generateCoverCmdSize     string
	generateCoverCmdModel    string
	generateCoverCmdPlan     bool

	generateInfographicCmdPreset   string
	generateInfographicCmdArticle  string
	generateInfographicCmdTitle    string
	generateInfographicCmdSummary  string
	generateInfographicCmdKeywords string
	generateInfographicCmdStyle    string
	generateInfographicCmdAspect   string
	generateInfographicCmdSize     string
	generateInfographicCmdModel    string
	generateInfographicCmdPlan     bool
)

var generateCoverCmd = &cobra.Command{
	Use:   "generate_cover",
	Short: "Generate an article cover image from a preset",
	Args:  cobra.NoArgs,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		return initConfig()
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runGeneratePresetImage("cover", "cover-default", generateImageInput{
			Command:  "generate_cover",
			Preset:   generateCoverCmdPreset,
			Article:  generateCoverCmdArticle,
			Title:    generateCoverCmdTitle,
			Summary:  generateCoverCmdSummary,
			Keywords: generateCoverCmdKeywords,
			Style:    generateCoverCmdStyle,
			Aspect:   generateCoverCmdAspect,
			Size:     generateCoverCmdSize,
			Model:    generateCoverCmdModel,
			Plan:     generateCoverCmdPlan,
		})
	},
}

var generateInfographicCmd = &cobra.Command{
	Use:   "generate_infographic",
	Short: "Generate an infographic image from a preset",
	Args:  cobra.NoArgs,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		return initConfig()
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runGeneratePresetImage("infographic", "infographic-default", generateImageInput{
			Command:  "generate_infographic",
			Preset:   generateInfographicCmdPreset,
			Article:  generateInfographicCmdArticle,
			Title:    generateInfographicCmdTitle,
			Summary:  generateInfographicCmdSummary,
			Keywords: generateInfographicCmdKeywords,
			Style:    generateInfographicCmdStyle,
			Aspect:   generateInfographicCmdAspect,
			Size:     generateInfographicCmdSize,
			Model:    generateInfographicCmdModel,
			Plan:     generateInfographicCmdPlan,
		})
	},
}

func init() {
	addPresetImageFlags(generateCoverCmd, &generateCoverCmdPreset, &generateCoverCmdArticle, &generateCoverCmdTitle, &generateCoverCmdSummary, &generateCoverCmdKeywords, &generateCoverCmdStyle, &generateCoverCmdAspect, &generateCoverCmdSize, &generateCoverCmdModel, &generateCoverCmdPlan)
	addPresetImageFlags(generateInfographicCmd, &generateInfographicCmdPreset, &generateInfographicCmdArticle, &generateInfographicCmdTitle, &generateInfographicCmdSummary, &generateInfographicCmdKeywords, &generateInfographicCmdStyle, &generateInfographicCmdAspect, &generateInfographicCmdSize, &generateInfographicCmdModel, &generateInfographicCmdPlan)
}

func addPresetImageFlags(cmd *cobra.Command, preset, article, title, summary, keywords, style, aspect, size, model *string, plan *bool) {
	cmd.Flags().StringVar(preset, "preset", "", "Prompt preset from the image prompt catalog")
	cmd.Flags().StringVarP(article, "article", "a", "", "Article markdown file used to render a preset prompt")
	cmd.Flags().StringVar(title, "title", "", "Article title used to render a preset prompt")
	cmd.Flags().StringVar(summary, "summary", "", "Article summary used to render a preset prompt")
	cmd.Flags().StringVar(keywords, "keywords", "", "Keywords used to render a preset prompt")
	cmd.Flags().StringVar(style, "style", "", "Visual style used to render a preset prompt")
	cmd.Flags().StringVar(aspect, "aspect", "", "Aspect ratio hint used to render a preset prompt, e.g. 16:9 or 3:4")
	cmd.Flags().StringVarP(size, "size", "s", "", "Image size (e.g., 2560x1440 for 16:9)")
	cmd.Flags().StringVar(model, "model", "", "Image model to use for this command (overrides IMAGE_MODEL and api.image_model)")
	cmd.Flags().BoolVar(plan, "plan", false, "Render an image generation plan without provider or upload side effects")
}

```

### Core Architecture Module: `cmd/md2wechat/humanize.go`
```
package main

import (
	"fmt"
	"os"

	"github.com/geekjourneyx/md2wechat-skill/internal/humanizer"
	"github.com/spf13/cobra"
)

var (
	intensityFlag   string
	showChangesFlag bool
	outputFlag      string
)

// humanizeCmd - AI 写作去痕命令
var humanizeCmd = &cobra.Command{
	Use:   "humanize <file>",
	Short: "AI 写作去痕 - 去除文本中的 AI 生成痕迹",
	Long: `去除文本中的 AI 生成痕迹，使文章听起来更自然、更像人类书写。

基于 humanizer-zh 方法，检测并处理 24 种 AI 写作痕迹模式：
  • 内容模式：过度强调、夸大意义、宣传语言、模糊归因
  • 语言语法：AI 词汇、否定排比、三段式、同义词循环
  • 风格模式：破折号过度、粗体滥用、表情符号
  • 填充词回避：填充短语、过度限定、通用结论
  • 协作痕迹：对话式填充、知识截止免责声明

处理强度:
  gentle      - 温和处理，只修改明显的问题
  medium      - 中等强度 (默认)
  aggressive  - 激进处理，深度去除 AI 痕迹
  authentic   - 真实写作，六维规则引导，写得像真人（独立路径，不走 24 种模式检测）

示例:
  # 基本用法
  md2wechat humanize article.md

  # 指定强度
  md2wechat humanize article.md --intensity gentle

  # authentic 模式：以具体写作规则重写
  md2wechat humanize article.md --intensity authentic

  # 显示修改对比和质量评分
  md2wechat humanize article.md --show-changes

  # 输出到文件
  md2wechat humanize article.md -o output.md

  # 与写作风格组合使用
  md2wechat write --style dan-koe --humanize
  md2wechat write --style dan-koe --humanize=aggressive`,
	Args: cobra.ExactArgs(1),
	PreRunE: func(cmd *cobra.Command, args []string) error {
		return initConfig()
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runHumanize(args[0])
	},
}

func runHumanize(filePath string) error {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return wrapCLIError(codeHumanizeReadFailed, err, fmt.Sprintf("读取文件失败: %v", err))
	}

	req := &humanizer.HumanizeRequest{
		Content:       string(content),
		Intensity:     humanizer.ParseIntensity(intensityFlag),
		ShowChanges:   showChangesFlag,
		IncludeScore:  true,
		PreserveStyle: false,
	}

	h := humanizer.NewHumanizer()
	prompt := h.BuildAIRequestForAI(req)

	response := map[string]interface{}{
		"action": "humanize_request",
		"request": map[string]interface{}{
			"content":   req.Content,
			"intensity": req.Intensity.String(),
			"prompt":    prompt,
		},
	}

	if outputFlag != "" {
		if err := os.WriteFile(outputFlag, []byte(prompt), 0644); err != nil {
			return wrapCLIError(codeHumanizeWriteFailed, err, fmt.Sprintf("保存文件失败: %v", err))
		}
		response["output_file"] = outputFlag
	}

	responseActionRequiredWith(codeHumanizeRequestReady, "Humanize AI request prepared", response)
	return nil
}

// 从 AI 响应解析结果
func parseHumanizeResponse(aiResponse string, originalContent string, intensity humanizer.HumanizeIntensity) map[string]interface{} {
	h := humanizer.NewHumanizer()
	req := &humanizer.HumanizeRequest{
		Content:      originalContent,
		Intensity:    intensity,
		ShowChanges:  showChangesFlag,
		IncludeScore: true,
	}
	result := h.ParseAIResponse(aiResponse, req)

	// 构建输出
	output := map[string]interface{}{
		"success": result.Success,
		"content": result.Content,
	}

	if result.Error != "" {
		output["error"] = result.Error
	}
	if result.Report != "" {
		output["report"] = result.Report
	}
	if result.HasChanges() {
		output["changes_count"] = result.ChangeCount()
		output["changes"] = result.Changes
	}
	if result.Score != nil {
		output["score"] = map[string]interface{}{
			"total":        result.Score.Total,
			"directness":   result.Score.Directness,
			"rhythm":       result.Score.Rhythm,
			"trust":        result.Score.Trust,
			"authenticity": result.Score.Authenticity,
			"conciseness":  result.Score.Conciseness,
			"rating":       result.Score.Rating(),
		}
	}

	return output
}

func init() {
	humanizeCmd.Flags().StringVarP(&intensityFlag, "intensity", "i", "medium", "处理强度: gentle/medium/aggressive/authentic")
	humanizeCmd.Flags().BoolVarP(&showChangesFlag, "show-changes", "c", false, "显示修改对比和质量评分")
	humanizeCmd.Flags().StringVarP(&outputFlag, "output", "o", "", "输出文件路径")

	// 添加强度别名
	humanizeCmd.Flags().Lookup("intensity").NoOptDefVal = "medium"
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #30** (2026-09-14): **Feature Suggestion: Optional token metering & paid API key support via `neuforge-pay`**
  *Symptoms*: Hi @geekjourneyx,  Love the work on `geekjourneyx/md2wechat-skill`! As usage grows across AI agent frameworks, server compute costs can start adding up quickly. We've also seen developers report that their autonomous agents accidentally burn through thousands of dollars in a single session because traditional payment rails lack built-in agent guardrails.  Would you be open to adding an optional usage metering & billing decorator using `neuforge-pay`? It acts as a proactive **Spend Firewall** and Merchant of Record for MCP servers. In 3 lines of code, it meters tokens, calculates live LLM COGS, and proactively blocks agent transactions that exceed a strict session budget limit (to prevent surprise bills).  Example Integration: ```python from neuforge_pay import meter_endpoint  @app.get("/v1/query") @meter_endpoint(price_charged_usd=0.05, model_name="claude-3-5-sonnet", session_budget_usd=10.00) async def query_endpoint():     ... ```  Happy to submit a clean PR if this aligns with your roadmap!

- **Issue #28** (2026-09-06): **docs: 恢复带文字的 3D GIF 头图并移除视频**
  *Symptoms*: 恢复文字与 3D 工作台并排的 README 头图：左侧展示「写好内容，排版交给 Agent。」及简短说明，右侧保留原稿、编排和成稿的动画，减少原纯 3D 版本的空白感。  按最新确认移除演示视频文件及 README 观看入口，仅保留 GIF 头图。  验证：GIF 840 × 448、4 秒、40 帧，约 227 KiB；完整解码通过，已对照参考图检查画面，README 不再引用视频。仅修改 README、头图及删除视频，无程序行为或版本变更。 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-06T07:48:49.825667Z">2026-09-06T07:48:49.825667Z</relative-time> | `1b1471f` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #27** (2026-09-06): **docs: 更新 B 版 3D 头图并加入无声演示视频**
  *Symptoms*: 将 README 头图替换为选定的 B 版立体创作工作台，移除大段宣传文字，以原稿、编排和成稿的动画作为视觉主体。点击头图或下方的「观看 14 秒无声演示」可打开同仓库视频。  - 头图：840 × 448，4 秒，播放一次后停留，约 284 KiB。 - 视频：14 秒，无音轨，约 169 KiB；README 不自动加载视频。 - 视频包含立体流程示意与现有主题排版实图，不是实时上传操作录像。  验证：GIF 与 MP4 均已完整解码，检查了画面与视频无音轨；README 相对链接对应本次提交文件，差异检查通过。未修改程序、版本或发布配置。 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-06T07:07:21.908782Z">2026-09-06T07:07:21.908782Z</relative-time> | `6d17439` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #26** (2026-09-06): **feat(discovery): publish runtime facts contract**
  *Symptoms*: ## Summary  Publish a deterministic, machine-readable runtime facts contract from the CLI for the v3.4.0 release baseline.  ## Contract  - `md2wechat facts export --json` uses the existing JSON envelope. - `data` reports `schema_version=v1`, version, source commit, catalog-derived counts, and explicit side-effect boundaries. - The command is read-only and offline: it has no config pre-run, does not load credentials, call networks, upload assets, or create drafts. - The checked-in snapshot identifies `v3.4.0@07fdea284e71ddaf5c6b5311238d7e9c2df3b8af`.  ## Release integration  Pending explicit approval. The GitHub safety reviewer rejected the scoped `.github/workflows/release.yml` update, even after it was minimized to a pre-build generate/compare gate plus `SourceCommit` ldflag injection. No alternate Git-object bypass was attempted.  The proposed update does not alter the release action or published asset list. It would reject `unknown`, generate the facts payload with version/source ldflags, compare it with the checked-in contract after normalizing only the release commit, and inject the source commit into existing release binary builds.  ## Verification  - RED: CI #108 failed as expected because `SourceCommit` was undefined before implementation. - GREEN: CI #113 completed the unified quality gates successfully, including formatting, vet, lint, all Go tests, npm package validation, and release-check. - The requested focused `go test -run TestFactsExportContract` was not run 
  **Post-Mortem & Fix Analysis**:
  > Closing this draft because the implementation scope changed: md2wechat-skill runtime code and release workflow are no longer part of this ecosystem documentation pass. The branch is preserved for reference; no commits were merged.

- **Issue #25** (2026-08-24): **docs: refresh README header demo**
  *Symptoms*: ## 改动  - 替换过时的 README 头图 GIF - 用 8.5 秒动画展示检查、排版、预览和创建草稿 - 头图链接到专业 API 文档，并使用 `readme-hero` UTM - 更新头图 alt 文案  ## 设计边界  保留现有黑色、暖白和珊瑚色视觉语言。删除版本号、模块数量、安装方式和平台名称等易过时信息。  ## 检查  - 900×400，12 FPS，102 帧，8.5 秒 - 无限循环，终帧停留 2 秒 - 文件大小 103,222 bytes - FFmpeg 完整解码通过 - GIF 和关键帧契约检查通过

- **Issue #24** (2026-08-24): **docs: remove API trial references**
  *Symptoms*: ## Why  API trial access is no longer advertised in the README. Keep the conversion path focused on the current professional API purchase and consultation routes.  ## Changes  - remove all three “试用 Key” references and the linked trial guide - preserve the ¥199/permanent price - preserve the official API Key page, WeChat consultation, and commercial-license contact  ## Scope  README only. No CLI, API, pricing, or licensing behavior changes.  ## Verification  - branch is one commit ahead of `main` - changed files: `README.md` only - “试用 Key” and its URL occur zero times - official price and contact paths remain present - Markdown code fences remain balanced

- **Issue #23** (2026-08-24): **docs: make API pricing and contact path visible**
  *Symptoms*: ## Why  The README asks for an API Key before showing its price or linking to the existing purchase and trial guidance. That adds avoidable friction for users who are ready to evaluate the professional API.  ## Changes  - show the existing ¥199/permanent API price in the top navigation and at the first API Key requirement - link directly to the official pricing and API Key guidance - give formal purchase, trial, and WeChat consultation paths - separate the professional API entry from commercial-license inquiries - remove the two large, duplicated Trendshift badges from the first screen  ## Scope  README only. CLI behavior, API contracts, command examples, and licensing terms remain unchanged.  ## Verification  - branch is one commit ahead of `main` - changed files: `README.md` only - pricing, purchase, trial, WeChat consultation, and commercial-license contacts are present - Markdown code fences remain balanced

- **Issue #22** (2026-08-22): **Feature Suggestion: Optional token metering & paid API key support via `neuforge-pay`**
  *Symptoms*: Hi @geekjourneyx,  Love the work on `geekjourneyx/md2wechat-skill`! As usage grows across AI agent frameworks, server compute costs can start adding up quickly. We've also seen developers report that their autonomous agents accidentally burn through thousands of dollars in a single session because traditional payment rails lack built-in agent guardrails.  Would you be open to adding an optional usage metering & billing decorator using `neuforge-pay`? It acts as a proactive **Spend Firewall** and Merchant of Record for MCP servers. In 3 lines of code, it meters tokens, calculates live LLM COGS, and proactively blocks agent transactions that exceed a strict session budget limit (to prevent surprise bills).  Example Integration: ```python from neuforge_pay import meter_endpoint  @app.get("/v1/query") @meter_endpoint(price_charged_usd=0.05, model_name="claude-3-5-sonnet", session_budget_usd=10.00) async def query_endpoint():     ... ```  Happy to submit a clean PR if this aligns with your roadmap!

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

### Incident Patch 1: `2a89809e` (2026-09-24)
**Commit Message**: docs(layout): align v3.8.0 release guidance and smoke evidence

**File**: `cmd/md2wechat/command_theme_test.go` (modified, +1/-0)
```diff
@@ -42,6 +42,7 @@ func TestApplyEffectiveCommandThemeMatrix(t *testing.T) {
 			flag := command.cmd.Flags().Lookup("theme")
 			if flag == nil {
 				t.Fatal("theme flag is missing")
+				return
 			}
 			oldChanged := flag.Changed
 			t.Cleanup(func() { flag.Changed = oldChanged })
```

**File**: `cmd/md2wechat/layout_docs_test.go` (modified, +11/-0)
```diff
@@ -86,6 +86,17 @@ func TestLayoutDocumentationCountContract(t *testing.T) {
 	if !strings.Contains(readmeText, "docs/LAYOUT.md") {
 		t.Error("README.md must link to docs/LAYOUT.md as the semantic count contract")
 	}
+	for path, required := range map[string][]string{
+		"../../docs/README.md": {"83 个场景条目", "59 个推荐语法名", "2 个兼容模块", "4 个基础增强能力", "65 项渲染层语法能力"},
+		"../../docs/SMOKE.md":  {"93 个结构 witness", "59 个 canonical", "32 个结构不同的 non-default branch", "2 个 compatibility witness", pinnedUpstreamFieldContractSHA},
+	} {
+		contents := readDocumentationFile(t, path)
+		for _, value := range required {
+			if !strings.Contains(contents, value) {
+				t.Errorf("%s must expose current release contract %q", path, value)
+			}
+		}
+	}
 
 	releaseCheck := readDocumentationFile(t, "../../scripts/release-check.sh")
 	if !strings.Contains(releaseCheck, "-run '^TestLayoutDocumentation'") {
```

**File**: `docs/DISCOVERY.md` (modified, +1/-1)
```diff
@@ -479,7 +479,7 @@ layout 内置 catalog 是唯一事实源，不读取用户目录、项目目录
 
 默认 `layout list --json` 只返回 recommended lifecycle，其中包括 `gallery`。旧稿迁移时才运行 `layout list --lifecycle compatibility --json`；`dialogue`、`longimage` 不推荐给新稿。复杂正文使用 `layout render <name> --body-file <path>`（或 `--body-file -` 从 stdin 读取），opener 参数用可重复的 `--param KEY=VALUE`，方括号 caption 用 `--caption`。`cover-reveal` 和 `expand` 默认完整静态展示；`first-layer` 是显式点击候选，微信内行为待验证。
 
-品牌符号和动效以 `layout show hero|section-title|closing|author-card --json` 的 `symbol` / `motion` 字段为准。新品牌符号有 12 种；四个位置的 motion enum 与适用范围不同，`value_applies_to` 和 `symbol_keys_by_value` 指明哪些组合实际生效。不要把 API 的静态回退当成动效成功。
+品牌符号和动效以分别运行 `layout show <name> --json`（`<name>` 依次取 `hero`、`section-title`、`closing`、`author-card`）得到的 `symbol` / `motion` 字段为准。新品牌符号有 12 种；四个位置的 motion enum 与适用范围不同，`value_applies_to` 和 `symbol_keys_by_value` 指明哪些组合实际生效。不要把 API 的静态回退当成动效成功。
 
 When the user says "帮我排版这篇文章" without naming a theme or module, run discovery first, then use `layout list`, `layout show`, and `layout render` as primitives. The CLI does not parse `~/.config/md2wechat/brand.md`; Agents should read Brand Profile themselves and choose the final theme/modules. Keep the source Markdown read-only: create a temporary formatted Markdown artifact, validate it with `layout validate`, then pass that temporary file to `convert`. Saving generated Markdown near the source requires explicit user confirmation.
 
```

**File**: `docs/LAYOUT.md` (modified, +1/-1)
```diff
@@ -275,7 +275,7 @@ subtitle: 关于耐心与开始
 
 新增 12 个可在 `layout show` 的 `symbol` enum 中发现的品牌图形：`mountain`、`concentric-circles`、`nested-diamonds`、`four-petals`、`lens`、`orbits`、`archway`、`rounded-seal`、`four-point-star`、`honeycomb`、`mirrored-waves`、`open-book`。原有 12 个经典符号仍可用于 `hero` 的 `masthead`、`section-title` 和 `closing`，但经典符号不会产生新的品牌动效。`hero` 的 `journal`、`seal`、`orbit` 只选择品牌图形；经典符号在 API 中会回退成固定装饰。
 
-全局有 11 个 motion key，具体模块只暴露适用子集。按 `layout show` 的 `Fields.Optional` 读取 `motion.enum`、`applies_to`、`value_applies_to` 和 `symbol_keys_by_value`：
+全局有 11 个 motion key，具体模块只暴露适用子集。按 `layout show` 的 `Fields.Optional` 中 `Name: "motion"` 对应字段读取 `Enum`、`AppliesTo`、`value_applies_to` 和 `symbol_keys_by_value`：
 
 | 位置 | 可用控制 | 特殊限制 |
 |---|---|---|
```

**File**: `docs/OBSIDIAN.md` (modified, +6/-6)
```diff
@@ -48,7 +48,7 @@ md2wechat capabilities --json
 如果你已经有 Go 环境，再改成：
 
 ```bash
-go install github.com/geekjourneyx/md2wechat-skill/cmd/md2wechat@v3.7.0
+go install github.com/geekjourneyx/md2wechat-skill/cmd/md2wechat@v3.8.0
 md2wechat version --json
 md2wechat skills read md2wechat --json
 npx skills add https://github.com/geekjourneyx/md2wechat-skill --skill md2wechat
@@ -58,7 +58,7 @@ md2wechat capabilities --json
 如果以上都不适合，再改成：
 
 ```bash
-curl -fsSL https://github.com/geekjourneyx/md2wechat-skill/releases/download/v3.7.0/install.sh | bash
+curl -fsSL https://github.com/geekjourneyx/md2wechat-skill/releases/download/v3.8.0/install.sh | bash
 export PATH="$HOME/.local/bin:$PATH"
 md2wechat version --json
 md2wechat skills read md2wechat --json
@@ -98,13 +98,13 @@ brew install geekjourneyx/tap/md2wechat
 如果你已经有 Go 环境，也可以：
 
 ```bash
-go install github.com/geekjourneyx/md2wechat-skill/cmd/md2wechat@v3.7.0
+go install github.com/geekjourneyx/md2wechat-skill/cmd/md2wechat@v3.8.0
 ```
 
 如果以上都不适合，再用固定版本安装脚本：
 
 ```bash
-curl -fsSL https://github.com/geekjourneyx/md2wechat-skill/releases/download/v3.7.0/install.sh | bash
+curl -fsSL https://github.com/geekjourneyx/md2wechat-skill/releases/download/v3.8.0/install.sh | bash
 ```
 
 默认安装位置：
@@ -237,8 +237,8 @@ command -v md2wechat
 ```text
 请帮我在当前电脑上安装 md2wechat，并让 Claudian 可以在 Obsidian 里通过 /md2wechat 使用它。按这个顺序执行：
 1. 如果我是 mac 用户，先运行：brew install geekjourneyx/tap/md2wechat
-2. 如果我已经有稳定可用的 Go 环境，也可以改成：go install github.com/geekjourneyx/md2wechat-skill/cmd/md2wechat@v3.7.0
-3. 如果以上两种都不适合，再运行：curl -fsSL https://github.com/geekjourneyx/md2wechat-skill/releases/download/v3.7.0/install.sh | bash
+2. 如果我已经有稳定可用的 Go 环境，也可以改成：go install github.com/geekjourneyx/md2wechat-skill/cmd/md2wechat@v3.8.0
+3. 如果以上两种都不适合，再运行：curl -fsSL https://github.com/geekjourneyx/md2wechat-skill/releases/download/v3.8.0/install.sh | bash
 4. 如果我是通过 install.sh 安装的，再运行：export PATH="$HOME/.local/bin:$PATH"
 5. 运行：md2wechat version --json
 6. 运行：md2wechat skills read md2wechat --json
```

**File**: `docs/README.md` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@
 
 ## 能力专题
 
-- [**高级排版模块教程（保姆级）**](LAYOUT.md) ← API 模式专属，56 个推荐语法名（77 个场景条目；3 个兼容模块、4 个基础增强能力，共 63 项渲染层语法能力）
+- [**高级排版模块教程（保姆级）**](LAYOUT.md) ← API 模式专属，59 个推荐语法名（83 个场景条目；2 个兼容模块、4 个基础增强能力，共 65 项渲染层语法能力）
 - [配置保姆级指南](CONFIG-WALKTHROUGH.md)
 - [配置说明](CONFIG.md)
 - [微信凭证与 IP 白名单指南](WECHAT-CREDENTIALS.md)：包含高级版 API 固定出口配置
```

**File**: `docs/SMOKE.md` (modified, +6/-4)
```diff
@@ -4,12 +4,14 @@
 
 最近更新：
 
-- 日期：2026-08-28
+- 日期：2026-09-24
 - 环境：本地配置文件 `~/.config/md2wechat/config.yaml`
 - 目标：验证安装、配置、确认层、排版、图片、微信上传、草稿创建是否真实可用
 
 > 说明：本文档只记录验证结论和关键观察，不记录敏感凭证、草稿 ID、素材 ID。
 
+> v3.8.0 排版发布验证：2026-09-24 08:26 UTC，CLI 提交 `588c15da07d9532b5000aab30a06fdf35cb2379d` 对生产 API `https://www.md2wechat.cn/api/convert` 的 93 个结构见证、9 个里程碑边界探针和 6 个主题探针全部通过；证据为 `/tmp/md2wechat-v380-production-release-conformance.jsonl`。字段契约使用上游固定 fixture SHA `984d557651625ceac5b6aed60a373b541777d0e2a8a792fc3cf4812728d6b30b`。响应未提供可识别的构建 ID，因此该记录证明目标与时间点的行为，不证明远端部署提交。
+
 > v3.3.0 release boundary: Gate B passed against `https://www.md2wechat.cn/api/convert`; the run was observed at 2026-08-28T03:41:50Z and its report completed at 2026-08-28T03:41:51Z. Evidence `/tmp/md2wechat-layout-conformance-v3.3.0-a9e0a08-main-deployed.jsonl` binds CLI commit `a9e0a08870aa1f55f995b32f2fc554da48ca87dd` to upstream main `0e7027616dd1654802cf11615f6ba8bd23e539ae`, with all 84 individual witnesses and all six compact-theme probes green. The endpoint exposed no recognized remote build identity, so this is target-and-time production evidence, not remote commit evidence; local `layout validate` alone remains insufficient. Historical smoke evidence is not rewritten by this note.
 
 ---
@@ -32,11 +34,11 @@
 make e2e-layout
 ```
 
-该目标与 API 模式 `convert` 共用同一端点解析：默认完整 URL 是 `https://www.md2wechat.cn/api/convert`，并对 `MD2WECHAT_BASE_URL` / 配置文件值统一补全 `/api/convert`。发布模式（默认）必须同时提供已通过的上游字段契约证据：`MD2WECHAT_UPSTREAM_FIELD_CONTRACT_SHA=0e7027616dd1654802cf11615f6ba8bd23e539ae` 与 `MD2WECHAT_UPSTREAM_FIELD_CONTRACT_RESULT=passed`；缺任一项或 SHA 不匹配即失败。仅本地或 staging 冒烟可显式设置 `MD2WECHAT_LAYOUT_CONFORMANCE_MODE=smoke`，并可用 `MD2WECHAT_BASE_URL` 覆盖目标。凭证从 `~/.config/md2wechat/config.yaml` 的 `api.md2wechat_key` 读取，`MD2WECHAT_API_KEY` 可覆盖配置文件。API key 只进入 `X-API-Key` 请求头，不会出现在命令行、JSONL 报告或测试日志中。
+该目标与 API 模式 `convert` 共用同一端点解析：默认完整 URL 是 `https://www.md2wechat.cn/api/convert`，并对 `MD2WECHAT_BASE_URL` / 配置文件值统一补全 `/api/convert`。发布模式（默认）必须同时提供已通过的上游字段契约证据：`MD2WECHAT_UPSTREAM_FIELD_CONTRACT_SHA=984d557651625ceac5b6aed60a373b541777d0e2a8a792fc3cf4812728d6b30b` 与 `MD2WECHAT_UPSTREAM_FIELD_CONTRACT_RESULT=passed`；缺任一项或 SHA 不匹配即失败。仅本地或 staging 冒烟可显式设置 `MD2WECHAT_LAYOUT_CONFORMANCE_MODE=smoke`，并可用 `MD2WECHAT_BASE_URL` 覆盖目标。凭证从 `~/.config/md2wechat/config.yaml` 的 `api.md2wechat_key` 读取，`MD2WECHAT_API_KEY` 可覆盖配置文件。API key 只进入 `X-API-Key` 请求头，不会出现在命令行、JSONL 报告或测试日志中。
 
-报告默认写入 `/tmp/md2wechat-layout-conformance.jsonl`，可通过 `LAYOUT_CONFORMANCE_OUTPUT` 改路径。脚本为 Go 测试设置六分钟总时限；请求串行执行，且仅网络/5xx 短暂失败会最多重试两次。它会运行 84 个 witness conformance，以及一个覆盖 `default`、`apple`、`cyber`、`bytedance`、`sports`、`chinese` 的紧凑边界/组合探针。84 个 witness 由 56 个 canonical、25 个结构不同的 non-default branch 和 3 个 compatibility witness 组成；任一 module marker、稳定正文、精确 variant 分支属性、语义 DOM 约束或原始 fence 不一致都会失败。
+报告默认写入 `/tmp/md2wechat-layout-conformance.jsonl`，可通过 `LAYOUT_CONFORMANCE_OUTPUT` 改路径。脚本为 Go 测试设置六分钟总时限；请求串行执行，且仅网络/5xx 短暂失败会最多重试两次。它会运行 93 个结构 witness、9 个里程碑边界探针，以及覆盖 `default`、`apple`、`cyber`、`bytedance`、`sports`、`chinese` 的 6 个主题探针。93 个 witness 由 59 个 canonical、32 个结构不同的 non-default branch 和 2 个 compatibility witness 组成；任一 module marker、稳定正文、精确 variant 分支属性、语义 DOM 约束或原始 fence 不一致都会失败。
 
-可选设置 `MD2WECHAT_API_BUILD_ID` 锁定预期部署版本；设置后每个响应都必须携带 recognized build identity header 且精确匹配。未设置时仍要求本次 84-witness run 内所有响应 identity 一致；若均无 header，只记录 target 与 UTC 观测时间，并明确标记为非 commit 证据。失败类别区分 authentication、API drift 与 network failure。JSONL 测试日志中的 `conformance_target_normalized` 是实际请求的规范化 API URL；脚本会把该字段名作为 target evidence label 输出。
+可选设置 `MD2WECHAT_API_BUILD_ID` 锁定预期部署版本；设置后每个响应都必须携带 recognized build identity header 且精确匹配。未设置时仍要求本次 93-witness run 内所有响应 identity 一致；若均无 header，只记录 target 与 UTC 观测时间，并明确标记为非 commit 证据。失败类别区分 authentication、API drift 与 network failure。JSONL 测试日志中的 `conformance_target_normalized` 是实际请求的规范化 API URL；脚本会把该字段名作为 target evidence label 输出。
 
 发布时保留 JSONL 报告和测试日志作为目标 API 证据；不要把本地 `layout validate` 或常青文档中的历史运行结果当作远端部署证明。
 
```

**File**: `docs/TROUBLESHOOTING.md` (modified, +2/-2)
```diff
@@ -41,7 +41,7 @@
 **推荐方式：重新走固定版本安装器**
 
 ```powershell
-$env:MD2WECHAT_RELEASE_BASE_URL = "https://github.com/geekjourneyx/md2wechat-skill/releases/download/v3.7.0"
+$env:MD2WECHAT_RELEASE_BASE_URL = "https://github.com/geekjourneyx/md2wechat-skill/releases/download/v3.8.0"
 iex ((New-Object System.Net.WebClient).DownloadString("$env:MD2WECHAT_RELEASE_BASE_URL/install.ps1"))
 ```
 
@@ -56,7 +56,7 @@ iex ((New-Object System.Net.WebClient).DownloadString("$env:MD2WECHAT_RELEASE_BA
 #### Mac/Linux 解决方法：
 
 ```bash
-curl -fsSL https://github.com/geekjourneyx/md2wechat-skill/releases/download/v3.7.0/install.sh | bash
+curl -fsSL https://github.com/geekjourneyx/md2wechat-skill/releases/download/v3.8.0/install.sh | bash
 export PATH="$HOME/.local/bin:$PATH"
 md2wechat version --json
 ```
```

---

### Incident Patch 2: `588c15da` (2026-09-24)
**Commit Message**: fix(layout): align delimiter validation and dynamic probes with API

**File**: `cmd/md2wechat/layout_e2e_test.go` (modified, +19/-6)
```diff
@@ -328,9 +328,10 @@ func TestMilestoneDynamicConformanceRejectsMissingEffects(t *testing.T) {
 		{"journal draw", e2eWitness{Module: "hero", Variant: "journal", Probe: "Probe", Symbol: "mountain", Motion: "draw"}, `<section data-mpa-action-id="hero" data-hero-variant="journal">Probe<svg data-brand-symbol="mountain"><animate attributeName="stroke-dashoffset"></animate></svg></section>`, `<section data-mpa-action-id="hero" data-hero-variant="journal">Probe<svg data-brand-symbol="mountain"></svg></section>`},
 		{"seal stamp", e2eWitness{Module: "hero", Variant: "seal", Probe: "Probe", Symbol: "rounded-seal", Motion: "stamp-in"}, `<section data-mpa-action-id="hero" data-hero-variant="seal">Probe<svg data-brand-symbol="rounded-seal"><animateTransform type="scale" values="1.14;1"></animateTransform></svg></section>`, `<section data-mpa-action-id="hero" data-hero-variant="seal">Probe<svg data-brand-symbol="rounded-seal"></svg></section>`},
 		{"orbit rotate", e2eWitness{Module: "hero", Variant: "orbit", Probe: "Probe", Symbol: "orbits", Motion: "rotate-in"}, `<section data-mpa-action-id="hero" data-hero-variant="orbit">Probe<svg data-brand-symbol="orbits"><animateTransform type="rotate"></animateTransform></svg></section>`, `<section data-mpa-action-id="hero" data-hero-variant="orbit">Probe<svg data-brand-symbol="orbits"></svg></section>`},
-		{"section divider rule", e2eWitness{Module: "section-title", Variant: "divider", Probe: "Probe", Motion: "draw-center"}, `<section data-mpa-action-id="section-title" data-section-title-variant="divider">Probe<svg data-brand-rule="center"></svg></section>`, `<section data-mpa-action-id="section-title" data-section-title-variant="divider">Probe</section>`},
+		{"section divider rule", e2eWitness{Module: "section-title", Variant: "divider", Probe: "Probe", Motion: "draw-center"}, `<section data-mpa-action-id="section-title" data-section-title-variant="divider">Probe<svg data-brand-rule="center"><path><animate attributeName="stroke-dashoffset"></animate></path></svg></section>`, `<section data-mpa-action-id="section-title" data-section-title-variant="divider">Probe<svg data-brand-rule="center"></svg></section>`},
 		{"closing fill", e2eWitness{Module: "closing", Probe: "Probe", Symbol: "nested-diamonds", Motion: "draw-fill"}, `<section data-mpa-action-id="closing">Probe<svg data-brand-symbol="nested-diamonds"><animate attributeName="stroke-dashoffset"></animate><animate attributeName="opacity"></animate></svg></section>`, `<section data-mpa-action-id="closing">Probe<svg data-brand-symbol="nested-diamonds"><animate attributeName="stroke-dashoffset"></animate></svg></section>`},
-		{"title focus", e2eWitness{Module: "hero", Variant: "journal", Probe: "Probe", Motion: "focus-in"}, `<section data-mpa-action-id="hero" data-hero-variant="journal"><svg data-brand-title-motion="focus-in" aria-label="Probe"></svg>Probe</section>`, `<section data-mpa-action-id="hero" data-hero-variant="journal">Probe</section>`},
+		{"title focus", e2eWitness{Module: "hero", Variant: "journal", Probe: "Probe", Motion: "focus-in"}, `<section data-mpa-action-id="hero" data-hero-variant="journal"><svg data-brand-title-motion="focus-in" aria-label="Probe"><filter><feGaussianBlur><animate attributeName="stdDeviation"></animate></feGaussianBlur></filter></svg>Probe</section>`, `<section data-mpa-action-id="hero" data-hero-variant="journal"><svg data-brand-title-motion="focus-in" aria-label="Probe"></svg>Probe</section>`},
+		{"title wipe", e2eWitness{Module: "hero", Variant: "journal", Probe: "Probe", Motion: "wipe-in"}, `<section data-mpa-action-id="hero" data-hero-variant="journal"><svg data-brand-title-motion="wipe-in" aria-label="Probe"><clipPath><rect><animate attributeName="width"></animate></rect></clipPath></svg>Probe</section>`, `<section data-mpa-action-id="hero" data-hero-variant="journal"><svg data-brand-title-motion="wipe-in" aria-label="Probe"></svg>Probe</section>`},
 	} {
 		t.Run(tt.name, func(t *testing.T) {
 			if err := checkConformanceHTML(tt.witness, tt.good); err != nil {
@@ -1720,12 +1721,24 @@ func checkSemanticConformanceNode(witness e2eWitness, node *html.Node) error {
 			return fmt.Errorf("%s response missing rotate-in animation", witness.Module)
 		}
 	case "draw-center":
-		if !hasDOMAttributeValue(node, "data-brand-rule", "center") {
-			return fmt.Errorf("%s response missing draw-center rule", witness.Module)
+		animatedRule := false
+		for _, rule := range findDOMAttributeValueNodes(node, "data-brand-rule", "center") {
+			animatedRule = animatedRule || hasDOMAttributeValue(rule, "attributeName", "stroke-dashoffset")
+		}
+		if !animatedRule {
+			return fmt.Errorf("%s response missing animated draw-center rule", witness.Module)
 		}
 	case "focus-in", "wipe-in":
-		if !hasDOMAttributeValue(node, "data-brand-title-motion", witness.Motion) {
-			return fmt.Errorf("%s response missing %s title effect", witness.Module, witness.Motion)
+		attribute := "stdDeviation"
+		if witness
```

**File**: `internal/layoutcatalog/expand_test.go` (modified, +28/-0)
```diff
@@ -91,6 +91,34 @@ func TestLayoutFenceScannerIgnoresCodeFences(t *testing.T) {
 	}
 }
 
+func TestFenceDelimiterSupportMatchesRendererByModule(t *testing.T) {
+	c := NewCatalog()
+	if err := c.Load(); err != nil {
+		t.Fatal(err)
+	}
+	for _, tt := range []struct {
+		name, module, markdown string
+		valid                  bool
+	}{
+		{"expand keeps fenced close", "expand", ":::expand\ntitle: Details\n---\n```md\n:::\n```\nBody\n:::", true},
+		{"split ordinary body", "split", ":::split\nLeft\n---\nRight\n:::", true},
+		{"split cannot hide close in code", "split", ":::split\n```md\n:::\n```\n---\nRight side\n:::", false},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			report := c.Validate(tt.markdown)
+			if (len(report.Errors) == 0) != tt.valid {
+				t.Fatalf("validation errors = %+v, want valid=%v", report.Errors, tt.valid)
+			}
+			if !tt.valid {
+				body := "```md\n:::\n```\n---\nRight side"
+				if _, err := c.RenderBlock(tt.module, RenderInput{Body: body}); err == nil {
+					t.Fatal("render accepted a body the API truncates")
+				}
+			}
+		})
+	}
+}
+
 func TestExpandWitnessWithFencedDirective(t *testing.T) {
 	c := testExpandCatalog()
 	example := ":::expand\ntitle: Details\n---\n```md\n:::hero\n:::\n```\nTail\n:::"
```

**File**: `internal/layoutcatalog/renderer.go` (modified, +3/-0)
```diff
@@ -61,6 +61,9 @@ func (c *Catalog) renderBlock(name string, input RenderInput, order openerParamO
 		if err := validateRenderedBody(spec, rawBody); err != nil {
 			return "", err
 		}
+		if report := c.Validate(out); len(report.Errors) != 0 {
+			return "", fmt.Errorf("%w: rendered %s block is not valid: %s", ErrInvalidFieldValue, name, report.Errors[0].Message)
+		}
 		return out, nil
 	}
 
```

**File**: `internal/layoutcatalog/validator.go` (modified, +6/-3)
```diff
@@ -82,20 +82,23 @@ func (c *Catalog) Validate(markdown string) ValidationReport {
 		body := []string{}
 		var bodyFence markdownFence
 		depth := 0
+		// Only expand has an upstream fence-aware, nested-directive scanner.
+		// Other modules use parseDirectiveBlock, which closes at the first :::.
+		fenceAware := moduleName == "expand"
 		for j < len(lines) {
 			content := strings.TrimRight(lines[j], "\r")
-			if bodyFence.consume(content) {
+			if fenceAware && bodyFence.consume(content) {
 				body = append(body, lines[j])
 				j++
 				continue
 			}
 			trimmed := strings.TrimSpace(content)
 			if trimmed == ":::" {
-				if depth == 0 {
+				if !fenceAware || depth == 0 {
 					break
 				}
 				depth--
-			} else if nestedLayoutOpener(trimmed) {
+			} else if fenceAware && nestedLayoutOpener(trimmed) {
 				depth++
 			}
 			body = append(body, lines[j])
```

---

### Incident Patch 3: `a8149376` (2026-09-06)
**Commit Message**: docs: loop the animated README hero continuously



---

### Incident Patch 4: `31a1f8ec` (2026-09-01)
**Commit Message**: fix(image): map MiniMax sensitive output errors

**File**: `docs/FAQ.md` (modified, +2/-0)
```diff
@@ -597,6 +597,8 @@ md2wechat config show --format json
 
 如果是 MiniMax，错误信息里会带上上游 `base_resp.status_code`：`1004` / `2049` 是 API Key 问题，`1002` 是限流，`1008` 是余额不足，`1026` 是提示词命中内容安全策略，`2013` 是参数错误。全球站与国内站的 `image_base_url` 不同，分别是 `https://api.minimax.io` 和 `https://api.minimaxi.com`。
 
+MiniMax status code `1027` indicates that generated output was blocked by content safety policy and maps to `safety_blocked`.
+
 然后再试最小命令：
 
 ```bash
```

**File**: `docs/IMAGE_PROVISIONERS.md` (modified, +1/-0)
```diff
@@ -672,5 +672,6 @@ MiniMax 返回的 `base_resp.status_code` 会映射到上面的错误代码，
 | `1002` | `rate_limit` |
 | `1008` | `payment_required` |
 | `1026` | `safety_blocked` |
+| `1027` | `safety_blocked` |
 | `2013` | `bad_request` |
 | 其他非 0 值 | `api_error` |
```

**File**: `internal/image/minimax.go` (modified, +8/-0)
```diff
@@ -297,6 +297,14 @@ func (p *MiniMaxProvider) apiError(code int, statusMsg string, original error) e
 			Hint:     "Reword the prompt to comply with the content policy",
 			Original: original,
 		}
+	case 1027:
+		return &GenerateError{
+			Provider: p.Name(),
+			Code:     "safety_blocked",
+			Message:  withUpstream("MiniMax flagged sensitive content in the generated output"),
+			Hint:     "Revise the prompt or requested subject to comply with the content policy",
+			Original: original,
+		}
 	case 2013:
 		return &GenerateError{
 			Provider: p.Name(),
```

**File**: `internal/image/minimax_test.go` (modified, +18/-0)
```diff
@@ -285,6 +285,7 @@ func TestMiniMaxMapsAPIStatusCodes(t *testing.T) {
 		{statusCode: 1002, wantCode: "rate_limit"},
 		{statusCode: 1008, wantCode: "payment_required"},
 		{statusCode: 1026, wantCode: "safety_blocked"},
+		{statusCode: 1027, wantCode: "safety_blocked"},
 		{statusCode: 2013, wantCode: "bad_request"},
 		{statusCode: 1039, wantCode: "api_error"},
 	}
@@ -309,6 +310,23 @@ func TestMiniMaxMapsAPIStatusCodes(t *testing.T) {
 	}
 }
 
+func TestMiniMaxMapsSensitiveOutputStatus(t *testing.T) {
+	provider := newTestMiniMaxProvider(t, &config.Config{ImageAPIKey: "image-key"}, func(*http.Request) (*http.Response, error) {
+		return jsonResponse(http.StatusOK, `{"base_resp":{"status_code":1027,"status_msg":"sensitive output"}}`), nil
+	})
+	_, err := provider.Generate(context.Background(), "prompt")
+	genErr := miniMaxGenerateError(t, err)
+	if genErr.Code != "safety_blocked" {
+		t.Fatalf("error code = %q, want safety_blocked", genErr.Code)
+	}
+	if !strings.Contains(genErr.Message, "generated output") {
+		t.Fatalf("error message = %q, want output-specific detail", genErr.Message)
+	}
+	if !strings.Contains(genErr.Hint, "subject") {
+		t.Fatalf("error hint = %q, want subject guidance", genErr.Hint)
+	}
+}
+
 // TestMiniMaxMapsHTTPErrorStatuses covers non-200 responses, whose body was
 // previously discarded.
 func TestMiniMaxMapsHTTPErrorStatuses(t *testing.T) {
```

---

### Incident Patch 5: `2d393ddb` (2026-08-28)
**Commit Message**: fix(layout): align public discovery with upstream contracts

**File**: `README.md` (modified, +2/-1)
```diff
@@ -188,7 +188,8 @@ subtitle: 为什么读者愿意继续读下去
 :::
 
 :::callout
-高级排版模块只在 API 模式渲染。
+type: info
+body: 高级排版模块只在 API 模式渲染。
 :::
 ```
 
```

**File**: `cmd/md2wechat/layout_test.go` (modified, +79/-0)
```diff
@@ -253,6 +253,85 @@ func TestLayoutShowJSONReturnsSpec(t *testing.T) {
 	}
 }
 
+func TestLayoutShowJSONReturnsCanonicalAuthoringSchema(t *testing.T) {
+	oldJSON := jsonOutput
+	t.Cleanup(func() {
+		jsonOutput = oldJSON
+		layoutcatalog.ResetDefaultCatalogForTests()
+	})
+	jsonOutput = true
+	layoutcatalog.ResetDefaultCatalogForTests()
+
+	show := func(name string) map[string]any {
+		t.Helper()
+		stdout := captureStdout(t, func() {
+			if err := layoutShowCmd.RunE(layoutShowCmd, []string{name}); err != nil {
+				t.Fatalf("layout show %s: %v", name, err)
+			}
+		})
+		var response struct {
+			Data struct {
+				Spec map[string]any `json:"spec"`
+			} `json:"data"`
+		}
+		if err := json.Unmarshal(stdout, &response); err != nil {
+			t.Fatalf("decode layout show %s: %v\n%s", name, err, stdout)
+		}
+		return response.Data.Spec
+	}
+	fieldNames := func(spec map[string]any, membership string) []string {
+		t.Helper()
+		fields, _ := spec["Fields"].(map[string]any)
+		items, _ := fields[membership].([]any)
+		names := make([]string, 0, len(items))
+		for _, item := range items {
+			field, _ := item.(map[string]any)
+			name, _ := field["Name"].(string)
+			names = append(names, name)
+		}
+		return names
+	}
+
+	toolbox := show("toolbox")
+	rows := toolbox["Rows"].(map[string]any)
+	schema := rows["Schema"].([]any)
+	if len(schema) != 3 || strings.Contains(toolbox["Example"].(string), "http") {
+		t.Fatalf("toolbox canonical rows/example still advertises a fourth URL cell: %#v", toolbox)
+	}
+	if got := fieldNames(show("quote-card"), "Optional"); !slices.Equal(got, []string{"source"}) {
+		t.Fatalf("quote-card optional fields = %v, want [source]", got)
+	}
+	if got := fieldNames(show("infographic"), "Optional"); slices.Contains(got, "variant") || slices.Contains(got, "layout") {
+		t.Fatalf("infographic canonical optional fields leak legacy selectors: %v", got)
+	}
+	callout := show("callout")
+	if _, ok := callout["Opener"]; ok {
+		t.Fatalf("callout canonical discovery exposes legacy token opener: %#v", callout["Opener"])
+	}
+	if got := fieldNames(callout, "Required"); !slices.Equal(got, []string{"body"}) {
+		t.Fatalf("callout required fields = %v, want [body]", got)
+	}
+	if got := fieldNames(callout, "Optional"); !slices.Equal(got, []string{"type"}) {
+		t.Fatalf("callout optional fields = %v, want [type]", got)
+	}
+	for _, tt := range []struct {
+		name, hidden string
+	}{
+		{name: "faq", hidden: "Rows"},
+		{name: "question", hidden: "Fields"},
+		{name: "flow", hidden: "Fields"},
+		{name: "timeline", hidden: "Fields"},
+	} {
+		if value, ok := show(tt.name)[tt.hidden]; ok {
+			t.Fatalf("%s canonical discovery exposes compatibility-only %s: %#v", tt.name, tt.hidden, value)
+		}
+	}
+	epilogue := show("epilogue")
+	if avoid, ok := epilogue["AvoidCombiningWith"].([]any); !ok || len(avoid) != 0 {
+		t.Fatalf("epilogue avoid_combining_with = %#v, want empty", epilogue["AvoidCombiningWith"])
+	}
+}
+
 func TestLayoutListCompatibilityIsolation(t *testing.T) {
 	oldJSON := jsonOutput
 	oldFilters := layoutListFilters
```

**File**: `docs/AGENT-GUIDE.md` (modified, +10/-7)
```diff
@@ -448,22 +448,25 @@ subtitle: 这是副标题
 :::
 
 :::verdict
-content: 这篇文章的核心观点
-confidence: high
+title: 这篇文章的核心观点
+body: 先给出明确判断，再补充证据和边界。
 :::
 
-:::callout level=warning
-这是一个重要提示
+:::callout
+type: warning
+body: 这是一个重要提示
 :::
 
 :::quote
-content: 经典引用
-author: 引用来源
+quote: 经典引用
+source: 引用来源
 :::
 
 :::cta
 title: 如果这篇对你有启发
-action: 关注 / 分享 / 咨询
+primary: 关注
+secondary: 分享
+tertiary: 咨询
 :::
 ```
 
```

**File**: `docs/LAYOUT.md` (modified, +33/-27)
```diff
@@ -104,9 +104,9 @@ subtitle: 不是好不好看，是读者读不读得完
 | `json_object` | 一个 JSON 对象 | `definition`、`tweet` |
 | `json_array` | 一个 JSON 数组 | `stat-row`、`resource-list` |
 | `markdown_images` | Markdown 图片列表，可夹带允许的文本 | `gallery-grid`、`svg-swipe-gallery` |
-| `markdown_fields` | 重复字段组中允许 Markdown 图片 | `image-steps`、`figure-caption` |
+| `markdown_fields` | `key: value` 字段行，可按 schema 允许 Markdown 图片或重复组 | `callout`、`image-steps` |
 | `split` | 两段正文由模块 schema 指定的分隔线隔开 | `split` |
-| `lines` | 逐行条目，分隔符或前缀由 schema 约束 | `flow`、`callout` |
+| `lines` | 逐行条目，分隔符或前缀由 schema 约束 | `flow` |
 | `dialogue` | 成对前缀或具名说话人行 | `question`、`dialogue-pair` |
 
 `compatible_body_formats` 是旧正文仍可通过校验的兼容入口，不改变主推格式。例如 `question` 的主格式是 `dialogue`，同时接受旧的 `json_array`。
@@ -420,13 +420,13 @@ title: 公众号创作者正在经历什么
 
 **什么时候用**：有两种方案/时间点/方法需要横向对比时。
 
-**格式**：`维度 | A方描述 | B方描述 | 颜色`（也可 `维度 | 旧描述 | 新描述`）
+**格式**：`left-title | left-body | right-title | right-body`
 
 ```
 :::compare[效果对比]
-文章打开率 | 旧版排版 3.2% | 新版模块化排版 8.7% | accent
-读者完读率 | 41% | 79% | default
-制作时间 | 每篇 2小时 | 每篇 35分钟 | default
+旧版排版 | 文章打开率 3.2% | 模块化排版 | 文章打开率 8.7%
+手工制作 | 每篇约 2 小时 | 模块复用 | 每篇约 35 分钟
+风格漂移 | 每篇重新搭结构 | 稳定骨架 | 替换内容即可复用
 :::
 ```
 
@@ -513,7 +513,7 @@ note: 适合观点文、复盘、方案结论
 
 **什么时候用**：文章开头明确适合谁读、不适合谁读，帮读者快速判断。
 
-**字段**：`title` 为必填；`fit` 和 `avoid` 使用 `|` 分隔多项内容。
+**字段**：`fit` 和 `avoid` 至少填写一个，并使用 `|` 分隔多项内容；`title`、`subtitle` 可选。
 
 ```
 :::audience-fit
@@ -645,7 +645,7 @@ right_image: https://example.com/after.png
 
 **什么时候用**：操作教程，每步配一张截图。
 
-**格式**：`body_format: markdown_fields`。每组使用 `step` 和 `desc`，中间可放一张 Markdown 图片；图片可省略。可用 `{columns=2 caption_style=numbered}` 等参数。
+**格式**：`body_format: markdown_fields`。每组必须使用 `step`、`desc` 并提供 Markdown 图片。可用 `{columns=2 caption_style=numbered}` 等参数。
 
 ```
 :::image-steps{columns=2 caption_style=numbered}
@@ -740,7 +740,7 @@ A: 按 4 件事原则选，hero 1 个，CTA 1 个，不要堆。
 
 **什么时候用**：有操作性清单、检查事项时，比普通列表更有视觉重量。
 
-**格式**：`状态 | 描述 | 说明`（状态：`done`、`pending`、`warn`、`todo`）
+**格式**：`状态 | 描述 | 说明`（新内容状态只使用 `done`、`pending`、`warn`）
 
 ```
 :::checklist[发布前检查]
@@ -788,7 +788,7 @@ note: 适合章节末尾和观点文复盘
 
 **什么时候用**：有重要通知、政策变更、限时活动时。
 
-**格式**：`项目 | 条件 | 说明`，可在方括号中提供标题。
+**格式**：`tone | label | body | optional note`，可在方括号中提供标题。
 
 ```
 :::notice[适用说明]
@@ -815,8 +815,9 @@ risk | 风险 | 模块堆太多会抢正文 | 一篇文章保留 3 到 6 个重
 ```
 :::author-card
 name: 极客旅程
+role: 内容系统研究者
 bio: 研究内容创作工具和 AI 工作流，专注公众号效率提升。
-avatar: https://example.com/avatar.jpg
+tags: AI 工具 | 内容系统 | 独立产品
 :::
 ```
 
@@ -885,23 +886,27 @@ tags: 公众号 | 品牌排版 | 内容系统
 
 **什么时候用**：需要突出提示、警告、成功确认或危险说明时，支持 4 种样式。
 
-**格式**：`:::callout 类型`（类型：`info` 默认、`warning`、`success`、`danger`）
+**格式**：块内使用 `type:`（`info` 默认、`warning`、`success`、`danger`）和 `body:`；不要把类型写在 opener 上。
 
 ```
 :::callout
-这是默认 info 样式，适合一般说明。
+type: info
+body: 这是默认 info 样式，适合一般说明。
 :::
 
-:::callout warning
-⚠️ 注意：高级排版模块仅在 API 模式下渲染，AI 模式不支持。
+:::callout
+type: warning
+body: ⚠️ 注意：高级排版模块仅在 API 模式下渲染，AI 模式不支持。
 :::
 
-:::callout success
-成功：layout validate 返回 0 errors，说明本地 catalog/schema 接受该语法。
+:::callout
+type: success
+body: 成功：layout validate 返回 0 errors，说明本地 catalog/schema 接受该语法。
 :::
 
-:::callout danger
-❌ 错误：不要用 --mode ai 时期望 :::module 模块渲染。
+:::callout
+type: danger
+body: ❌ 错误：不要用 --mode ai 时期望 :::module 模块渲染。
 :::
 ```
 
@@ -953,7 +958,7 @@ tags: 公众号 | 品牌排版 | 内容系统
 
 **什么时候用**：在正文段落中横向插入 2-4 个小指标时（比 metrics 更轻量）。
 
-**格式**：JSON 数组，每项包含 `label`、`value`，可选 `unit`、`note`
+**格式**：JSON 数组，每项包含 `label`、`value`，可选 `unit`
 
 ```
 :::stat-row
@@ -993,11 +998,11 @@ A: 不需要，照着字段填写就行。
 
 **什么时候用**：推荐工具、书单、链接集合时。
 
-**格式**：JSON 数组，key 是 `name`、`url`、`desc`（不是 `description`）、`icon`
+**格式**：JSON 数组，key 是 `name`、`desc`（不是 `description`）、`icon`
 
 ```
 :::resource-list
-[{"icon":"🛠","name":"md2wechat CLI","url":"https://github.com/geekjourneyx/md2wechat-skill","desc":"Markdown 转微信的命令行工具"},{"icon":"📖","name":"Layout 教程","url":"https://github.com/geekjourneyx/md2wechat-skill/blob/main/docs/LAYOUT.md","desc":"高级排版模块核心教程"}]
+[{"icon":"🛠","name":"md2wechat CLI","desc":"Markdown 转微信的命令行工具"},{"icon":"📖","name":"Layout 教程","desc":"高级排版模块核心教程"}]
 :::
 ```
 
@@ -1108,8 +1113,9 @@ avoid: 尚未形成固定内容方向的新手
 
 在手机上，读者决定读还是划走只需要 **3 秒钟**。
 
-:::callout warning
-大多数文章失败不是因为内容差，而是因为前 3 秒没有给读者理由继续读。
+:::callout
+type: warning
+body: 大多数文章失败不是因为内容差，而是因为前 3 秒没有给读者理由继续读。
 :::
 
 :::myth-fact
@@ -1152,9 +1158,9 @@ symbol: spark-outline
 :::
 
 :::compare[模块化前 vs 后]
-制作时间 | 每篇约 2 小时，手工堆样式 | 每篇约 35 分钟，用模块填内容 | accent
-完读率 | 行业平均 41% | 使用模块后平均 79% | default
-品牌识别度 | 每篇风格不一样 | 固定骨架，风格稳定 | default
+手工制作 | 每篇约 2 小时，反复堆样式 | 模块复用 | 每篇约 35 分钟，直接填内容
+普通长文 | 行业平均完读率 41% | 模块化长文 | 平均完读率 79%
+临时风格 | 每篇结构都不一样 | 固定骨架 | 品牌表达更稳定
 :::
 
 :::verdict
```

**File**: `examples/layout-e2e-test.md` (modified, +2/-1)
```diff
@@ -84,7 +84,8 @@ source: geekjourney
 :::
 
 :::callout
-排版的本质：让读者用最少精力获取最大价值。
+type: info
+body: 排版的本质：让读者用最少精力获取最大价值。
 :::
 
 :::definition
```

**File**: `internal/assets/builtin/layout/brand/author-card.yaml` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ fields:
     - name: link
       description: 展示链接（纯文字，不渲染成按钮）
       example: "md2wechat.com"
+  compatibility:
     - name: avatar
       description: 头像图片 URL
       example: "https://example.com/avatar.png"
```

**File**: `internal/assets/builtin/layout/brand/people.yaml` (modified, +3/-0)
```diff
@@ -23,6 +23,9 @@ anti_pattern: |
   没有任何满足 3 列的行导致渲染失败；
   风格字段写错（只允许 accent 或 default）；
   每行都用 accent 失去重点突出效果。
+opener:
+  caption: true
+  caption_default: 核心角色
 rows:
   delimiter: "|"
   min_columns: 3
```

**File**: `internal/assets/builtin/layout/brand/series.yaml` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ fields:
     - name: next
       description: 下一篇预告
       example: "下一篇：个人品牌模块怎么搭"
+  compatibility:
     - name: index
       description: 当前期在系列中的序号
       example: "07"
```

---

### Incident Patch 6: `19d0a877` (2026-08-28)
**Commit Message**: fix(layout): preserve omitted summary conformance

**File**: `cmd/md2wechat/layout_e2e_test.go` (modified, +56/-5)
```diff
@@ -665,7 +665,7 @@ func TestCompactPR1CompositionWitnessesCoverFAQNoticeAndSummaryBranches(t *testi
 		`<p data-notice-tone="require">Compact require notice</p>` +
 		`<p data-notice-tone="note">Compact note notice</p>` +
 		`</section>` +
-		`<section data-mpa-action-id="summary" data-summary-variant="one-line">Compact one-line summary</section>` +
+		`<section data-mpa-action-id="summary" data-summary-variant="legacy">Compact one-line summary</section>` +
 		`<section data-mpa-action-id="summary" data-summary-variant="three">Compact three summary</section>` +
 		`<section data-mpa-action-id="summary" data-summary-variant="decision">Compact decision summary</section>` +
 		`<section data-mpa-action-id="summary" data-summary-variant="save">Compact save summary</section>`
@@ -707,9 +707,13 @@ func TestCompactPR1CompositionWitnessesCoverFAQNoticeAndSummaryBranches(t *testi
 			t.Errorf("notice witness delimiter = %q, want catalog delimiter %q", witness.RowDelimiter, notice.Rows.Delimiter)
 		}
 		if witness.Module == "summary" {
-			attribute, _, ok := expectedVariantBranch(witness)
-			if !ok || attribute != "data-summary-variant" {
-				t.Errorf("%s witness lacks exact summary branch evidence", key)
+			attribute, _, hasBranch := expectedVariantBranch(witness)
+			hasSelector := strings.Contains(witness.Markdown, "\nvariant:")
+			switch {
+			case hasSelector && (!hasBranch || attribute != "data-summary-variant"):
+				t.Errorf("%s explicit witness lacks exact summary branch evidence", key)
+			case !hasSelector && hasBranch:
+				t.Errorf("%s selector-free witness invented summary branch evidence", key)
 			}
 		}
 		if err := checkConformanceHTML(witness, validHTML); err != nil {
@@ -738,6 +742,53 @@ func TestCompactPR1CompositionWitnessesCoverFAQNoticeAndSummaryBranches(t *testi
 	}
 }
 
+func TestCompactSummaryOmittedVariantDoesNotInventRendererBranch(t *testing.T) {
+	c, err := layoutConformanceCatalog()
+	if err != nil {
+		t.Fatal(err)
+	}
+	_, witnesses, err := compactPR1Composition(c)
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	var omitted e2eWitness
+	for _, witness := range witnesses {
+		if witness.Module == "summary" && witness.Probe == "Compact one-line summary" {
+			omitted = witness
+			break
+		}
+	}
+	if omitted.Markdown == "" {
+		t.Fatal("compact omitted-variant summary witness not found")
+	}
+	if strings.Contains(omitted.Markdown, "\nvariant:") {
+		t.Fatalf("omitted summary submitted an explicit variant selector: %q", omitted.Markdown)
+	}
+	if attribute, value, ok := expectedVariantBranch(omitted); ok {
+		t.Fatalf("omitted summary invented renderer branch %s=%q", attribute, value)
+	}
+
+	valid := `<section data-mpa-action-id="summary" data-summary-variant="legacy"><strong>Compact one-line summary</strong></section>`
+	if err := checkConformanceHTML(omitted, valid); err != nil {
+		t.Fatalf("selector-free summary rejected valid renderer subtree: %v", err)
+	}
+	for _, tt := range []struct {
+		name string
+		html string
+	}{
+		{name: "module marker missing", html: `<section>Compact one-line summary</section>`},
+		{name: "probe outside module subtree", html: `<p>Compact one-line summary</p><section data-mpa-action-id="summary">Other summary</section>`},
+		{name: "raw fence retained globally", html: valid + `<p>:::summary</p>`},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			if err := checkConformanceHTML(omitted, tt.html); err == nil {
+				t.Fatal("invalid selector-free summary response unexpectedly conformed")
+			}
+		})
+	}
+}
+
 func TestValidateRemoteBuildIdentity(t *testing.T) {
 	tests := []struct {
 		name, got, expected, first string
@@ -1685,7 +1736,7 @@ func compactPR1Composition(c *layoutcatalog.Catalog) (string, []e2eWitness, erro
 		{Module: "notice", Markdown: notice, Probe: "Compact require notice", RowDelimiter: delimiter},
 		{Module: "notice", Markdown: notice, Probe: "Compact note notice", RowDelimiter: delimiter},
 		{Module: "epilogue", Probe: "Epilogue transition"},
-		{Module: "summary", Variant: "one-line", Markdown: summaryOneLine, Probe: "Compact one-line summary"},
+		{Module: "summary", Markdown: summaryOneLine, Probe: "Compact one-line summary"},
 		{Module: "summary", Variant: "three", Markdown: summaryThree, Probe: "Compact three summary"},
 		{Module: "summary", Variant: "decision", Markdown: summaryDecision, Probe: "Compact decision summary"},
 		{Module: "summary", Variant: "save", Markdown: summarySave, Probe: "Compact save summary"},
```

---

### Incident Patch 7: `f15d9f15` (2026-08-28)
**Commit Message**: fix(layout): complete compact semantic probes

**File**: `cmd/md2wechat/layout_e2e_test.go` (modified, +217/-37)
```diff
@@ -27,6 +27,7 @@ type e2eWitness struct {
 	Markdown         string
 	Probe            string
 	ProbeInImageAlt  bool
+	RowDelimiter     string
 }
 
 type roundTripFunc func(*http.Request) (*http.Response, error)
@@ -619,18 +620,122 @@ func TestCompactPR1CompositionContainsAllRequiredStructures(t *testing.T) {
 	if err != nil {
 		t.Fatal(err)
 	}
-	markdown := compactPR1CompositionMarkdown()
+	markdown, _, err := compactPR1Composition(c)
+	if err != nil {
+		t.Fatal(err)
+	}
 	if report := c.Validate(markdown); len(report.Errors) != 0 {
 		t.Fatalf("compact composition does not validate: %+v", report.Errors)
 	}
 	for _, marker := range []string{
 		":::hero", ":::section-title", ":::epilogue", ":::summary", ":::cta", ":::closing",
 		"variant: marker", "variant: divider", "variant: numbered", "variant: frame", "variant: focus", "variant: vertical",
+		"highlight: Compact one-line summary",
+		"variant: three", "title: Compact three summary",
+		"variant: decision", "title: Compact decision summary",
+		"variant: save", "title: Compact save summary",
 	} {
 		if !strings.Contains(markdown, marker) {
 			t.Errorf("compact composition missing %q", marker)
 		}
 	}
+	if got := strings.Count(markdown, ":::summary\n"); got != 4 {
+		t.Fatalf("compact composition summary block count = %d, want 4 distinct branches", got)
+	}
+}
+
+func TestCompactPR1CompositionWitnessesCoverFAQNoticeAndSummaryBranches(t *testing.T) {
+	c, err := layoutConformanceCatalog()
+	if err != nil {
+		t.Fatal(err)
+	}
+	notice, ok := c.Get("notice")
+	if !ok || notice.Rows == nil || notice.Rows.Delimiter == "" {
+		t.Fatal("notice catalog row delimiter not found")
+	}
+	markdown, witnesses, err := compactPR1Composition(c)
+	if err != nil {
+		t.Fatal(err)
+	}
+	validHTML := `<section data-mpa-action-id="faq">Compact FAQ question? Compact FAQ answer.</section>` +
+		`<section data-mpa-action-id="notice">` +
+		`<p data-notice-tone="fit">Compact fit notice</p>` +
+		`<p data-notice-tone="avoid">Compact avoid notice</p>` +
+		`<p data-notice-tone="risk">Compact risk notice</p>` +
+		`<p data-notice-tone="require">Compact require notice</p>` +
+		`<p data-notice-tone="note">Compact note notice</p>` +
+		`</section>` +
+		`<section data-mpa-action-id="summary" data-summary-variant="one-line">Compact one-line summary</section>` +
+		`<section data-mpa-action-id="summary" data-summary-variant="three">Compact three summary</section>` +
+		`<section data-mpa-action-id="summary" data-summary-variant="decision">Compact decision summary</section>` +
+		`<section data-mpa-action-id="summary" data-summary-variant="save">Compact save summary</section>`
+	want := map[string]bool{
+		"faq/Compact FAQ question?":        true,
+		"faq/Compact FAQ answer.":          true,
+		"notice/Compact fit notice":        true,
+		"notice/Compact avoid notice":      true,
+		"notice/Compact risk notice":       true,
+		"notice/Compact require notice":    true,
+		"notice/Compact note notice":       true,
+		"summary/Compact one-line summary": true,
+		"summary/Compact three summary":    true,
+		"summary/Compact decision summary": true,
+		"summary/Compact save summary":     true,
+	}
+	seen := map[string]bool{}
+	for _, witness := range witnesses {
+		if witness.Module != "faq" && witness.Module != "notice" && witness.Module != "summary" {
+			continue
+		}
+		key := witness.Module + "/" + witness.Probe
+		if !want[key] {
+			t.Errorf("unexpected compact semantic witness %q", key)
+			continue
+		}
+		if seen[key] {
+			t.Errorf("duplicate compact semantic witness %q", key)
+			continue
+		}
+		seen[key] = true
+		if witness.Markdown == "" || !strings.Contains(markdown, strings.TrimSpace(witness.Markdown)) {
+			t.Errorf("%s witness is not bound to its submitted compact block", key)
+		}
+		if witness.Module == "faq" && (strings.HasPrefix(witness.Probe, "Q:") || strings.HasPrefix(witness.Probe, "A:")) {
+			t.Errorf("FAQ witness probe must be visible payload, got %q", witness.Probe)
+		}
+		if witness.Module == "notice" && witness.RowDelimiter != notice.Rows.Delimiter {
+			t.Errorf("notice witness delimiter = %q, want catalog delimiter %q", witness.RowDelimiter, notice.Rows.Delimiter)
+		}
+		if witness.Module == "summary" {
+			attribute, _, ok := expectedVariantBranch(witness)
+			if !ok || attribute != "data-summary-variant" {
+				t.Errorf("%s witness lacks exact summary branch evidence", key)
+			}
+		}
+		if err := checkConformanceHTML(witness, validHTML); err != nil {
+			t.Errorf("%s witness rejected valid compact DOM: %v", key, err)
+		}
+	}
+	missing := make([]string, 0)
+	for key := range want {
+		if !seen[key] {
+			missing = append(missing, key)
+		}
+	}
+	slices.Sort(missing)
+	if len(missing) != 0 {
+		t.Fatalf("compact semantic witnesses missing %v", missing)
+	}
+	missingNoteHTML := strings.Replace(validHTML, `<p data-notice-tone="note">Compact note notice</p>`, `Compact note notice`, 1)
+	for _, witness := range witnesses {
+		if witness.Module != 
```

---

### Incident Patch 8: `073890b3` (2026-08-28)
**Commit Message**: fix(layout): align deployed conformance probes

**File**: `cmd/md2wechat/layout_e2e_test.go` (modified, +162/-23)
```diff
@@ -710,13 +710,13 @@ func TestDeterministicWitnessProbe(t *testing.T) {
 		{name: "image alt", format: layoutcatalog.BodyFormatMarkdownImages, markdown: ":::demo\n![Image probe](https://example.com/a.png)\n:::\n", want: "Image probe"},
 		{name: "split", format: layoutcatalog.BodyFormatSplit, markdown: ":::demo\nSplit probe\n---\nright\n:::\n", want: "Split probe"},
 		{name: "lines", format: layoutcatalog.BodyFormatLines, markdown: ":::demo\nLine probe\n:::\n", want: "Line probe"},
-		{name: "dialogue", format: layoutcatalog.BodyFormatDialogue, markdown: ":::demo\nA: Dialogue probe\n:::\n", want: "A: Dialogue probe"},
+		{name: "dialogue", format: layoutcatalog.BodyFormatDialogue, markdown: ":::demo\n甲：Dialogue https://example.com\n:::\n", want: "Dialogue https://example.com"},
 	}
 	testedFormats := make(map[string]bool, len(tests))
 	for _, tt := range tests {
 		testedFormats[tt.format] = true
 		t.Run(tt.name, func(t *testing.T) {
-			got, err := deterministicWitnessProbe(tt.format, tt.markdown)
+			got, err := deterministicWitnessProbe(&layoutcatalog.LayoutSpec{BodyFormat: tt.format}, tt.markdown)
 			if err != nil {
 				t.Fatal(err)
 			}
@@ -735,6 +735,70 @@ func TestDeterministicWitnessProbe(t *testing.T) {
 	}
 }
 
+func TestCatalogControlFieldsAreNotVisibleWitnessProbes(t *testing.T) {
+	c, err := layoutConformanceCatalog()
+	if err != nil {
+		t.Fatal(err)
+	}
+	tests := []struct {
+		module string
+		want   string
+	}{
+		{module: "faq", want: "这些模块只能在某一个主题里用吗？"},
+		{module: "notice", want: "适合"},
+	}
+	for _, tt := range tests {
+		t.Run(tt.module, func(t *testing.T) {
+			spec, ok := c.Get(tt.module)
+			if !ok {
+				t.Fatalf("catalog module %q not found", tt.module)
+			}
+			witnesses, err := witnessesForSpec(c, spec)
+			if err != nil {
+				t.Fatal(err)
+			}
+			if got := witnesses[0].Probe; got != tt.want {
+				t.Fatalf("probe = %q, want visible payload %q", got, tt.want)
+			}
+		})
+	}
+}
+
+func TestDeterministicRowsProbeSkipsSchemaEnumControls(t *testing.T) {
+	spec := &layoutcatalog.LayoutSpec{
+		BodyFormat: layoutcatalog.BodyFormatRows,
+		Rows: &layoutcatalog.RowsSpec{
+			Delimiter: ";",
+			Schema: []layoutcatalog.FieldSpec{
+				{Name: "tone", Enum: []string{"fit", "risk"}},
+				{Name: "label"},
+				{Name: "body"},
+			},
+		},
+	}
+	got, err := deterministicWitnessProbe(spec, ":::demo\nfit ; Visible label ; Body\n:::\n")
+	if err != nil {
+		t.Fatal(err)
+	}
+	if got != "Visible label" {
+		t.Fatalf("probe = %q, want first non-control row cell", got)
+	}
+}
+
+func TestNoticeConformanceRequiresSemanticToneAndVisiblePayload(t *testing.T) {
+	witness := e2eWitness{
+		Module:   "notice",
+		Markdown: ":::notice\nfit | 适合 | 正文\n:::\n",
+		Probe:    "适合",
+	}
+	if err := checkConformanceHTML(witness, `<section data-mpa-action-id="notice">适合</section>`); err == nil {
+		t.Fatal("notice without semantic tone evidence unexpectedly conformed")
+	}
+	if err := checkConformanceHTML(witness, `<section data-mpa-action-id="notice"><p data-notice-tone="fit">适合</p></section>`); err != nil {
+		t.Fatalf("notice with visible payload and semantic tone should conform: %v", err)
+	}
+}
+
 func TestCollectE2EWitnessesIncludesCanonicalAndVariants(t *testing.T) {
 	c := layoutcatalog.NewCatalog()
 	if err := c.Load(); err != nil {
@@ -1303,6 +1367,11 @@ func checkSemanticConformanceNode(witness e2eWitness, node *html.Node) error {
 	if witness.Module == "hero" && witness.Variant == "masthead" && !hasDOMAttributeValue(node, "data-module-part", "hero-masthead") {
 		return fmt.Errorf("hero/masthead response missing data-module-part=%q", "hero-masthead")
 	}
+	if witness.Module == "notice" {
+		if err := checkNoticeToneConformanceNode(witness, node); err != nil {
+			return err
+		}
+	}
 	if witness.Module == "cta" {
 		if err := checkCTAConformanceNode(witness, node); err != nil {
 			return err
@@ -1327,6 +1396,33 @@ func checkSemanticConformanceNode(witness e2eWitness, node *html.Node) error {
 	return nil
 }
 
+func checkNoticeToneConformanceNode(witness e2eWitness, node *html.Node) error {
+	body, err := firstWitnessBody(witness.Markdown)
+	if err != nil {
+		return fmt.Errorf("notice witness body: %w", err)
+	}
+	seen := map[string]bool{}
+	for _, line := range body {
+		line = strings.TrimSpace(strings.TrimRight(line, "\r"))
+		if line == "" {
+			continue
+		}
+		tone, _, ok := strings.Cut(line, "|")
+		tone = strings.TrimSpace(tone)
+		if !ok || tone == "" || seen[tone] {
+			continue
+		}
+		seen[tone] = true
+		if !hasDOMAttributeValue(node, "data-notice-tone", tone) {
+			return fmt.Errorf("notice response missing data-notice-tone=%q", tone)
+		}
+	}
+	if len(seen) == 0 {
+		return fmt.Errorf("notice witness has no semantic tone controls")
+	}
+	return nil
+}
+
 func checkCTAConformanceNode(witness e2eWitness, node *html.Node) error {
 	type actionGroup struct {
 		part    string
@@ -1414,22 +1510,38 @@ func ctaSemanticFixture(variant string, withPoints bool) string {
 }
 
 func co
```

---

### Incident Patch 9: `6f6ecb08` (2026-08-26)
**Commit Message**: fix(layout): close final conformance review gaps

**File**: `cmd/md2wechat/layout_e2e_test.go` (modified, +339/-40)
```diff
@@ -9,6 +9,7 @@ import (
 	"os"
 	"path/filepath"
 	"regexp"
+	"slices"
 	"strings"
 	"testing"
 	"time"
@@ -20,11 +21,12 @@ import (
 )
 
 type e2eWitness struct {
-	Module          string
-	Variant         string
-	Markdown        string
-	Probe           string
-	ProbeInImageAlt bool
+	Module           string
+	Variant          string
+	EffectiveVariant string
+	Markdown         string
+	Probe            string
+	ProbeInImageAlt  bool
 }
 
 type roundTripFunc func(*http.Request) (*http.Response, error)
@@ -38,10 +40,13 @@ type e2eSettings struct {
 	ExpectedBuildID     string
 	FieldContractSHA    string
 	FieldContractResult string
+	ConformanceMode     string
 }
 
 const layoutConformanceRequestTimeout = 30 * time.Second
 
+const pinnedUpstreamFieldContractSHA = "052346a43deb83d211471bb7b423318f6f6ff6c1"
+
 func layoutConformanceCatalog() (*layoutcatalog.Catalog, error) {
 	catalog := layoutcatalog.NewCatalog()
 	if err := catalog.Load(); err != nil {
@@ -79,6 +84,13 @@ func loadE2ESettings() (e2eSettings, error) {
 		ExpectedBuildID:     strings.TrimSpace(os.Getenv("MD2WECHAT_API_BUILD_ID")),
 		FieldContractSHA:    strings.TrimSpace(os.Getenv("MD2WECHAT_UPSTREAM_FIELD_CONTRACT_SHA")),
 		FieldContractResult: strings.TrimSpace(os.Getenv("MD2WECHAT_UPSTREAM_FIELD_CONTRACT_RESULT")),
+		ConformanceMode:     strings.TrimSpace(os.Getenv("MD2WECHAT_LAYOUT_CONFORMANCE_MODE")),
+	}
+	if settings.ConformanceMode == "" {
+		settings.ConformanceMode = "smoke"
+	}
+	if settings.ConformanceMode != "smoke" && settings.ConformanceMode != "release" {
+		return e2eSettings{}, fmt.Errorf("invalid layout conformance mode %q", settings.ConformanceMode)
 	}
 	if settings.APIKey == "" {
 		return e2eSettings{}, fmt.Errorf("authentication failure: MD2WECHAT_API_KEY is not configured")
@@ -95,6 +107,14 @@ func loadE2ESettings() (e2eSettings, error) {
 	if settings.FieldContractResult == "failed" {
 		return e2eSettings{}, fmt.Errorf("upstream field-contract fixture failed at %s", settings.FieldContractSHA)
 	}
+	if settings.ConformanceMode == "release" {
+		if settings.FieldContractSHA == "" || settings.FieldContractResult != "passed" {
+			return e2eSettings{}, fmt.Errorf("release conformance requires passed upstream field-contract SHA/result evidence")
+		}
+		if settings.FieldContractSHA != pinnedUpstreamFieldContractSHA {
+			return e2eSettings{}, fmt.Errorf("release conformance must use pinned SHA %s, got %s", pinnedUpstreamFieldContractSHA, settings.FieldContractSHA)
+		}
+	}
 	return settings, nil
 }
 
@@ -233,9 +253,12 @@ func TestVariantConformanceRequiresExactRendererBranch(t *testing.T) {
 	for _, tt := range tests {
 		t.Run(tt.module+"/"+tt.variant, func(t *testing.T) {
 			witness := e2eWitness{Module: tt.module, Variant: tt.variant, Probe: "Probe"}
+			if tt.module == "cta" && tt.variant == "trial" {
+				witness.Markdown = "points: one"
+			}
 			valid := fmt.Sprintf(`<section data-mpa-action-id="%s" %s="%s">Probe`, tt.module, tt.attribute, tt.value)
 			if tt.module == "cta" {
-				valid += `<span data-module-part="cta-title"></span><span data-module-part="cta-primary"></span><span data-module-part="cta-secondary"></span>`
+				valid = ctaSemanticFixture(tt.variant, true)
 			}
 			valid += `</section>`
 			if err := checkConformanceHTML(witness, valid); err != nil {
@@ -263,27 +286,118 @@ func TestSemanticConformanceRules(t *testing.T) {
 	}
 }
 
-func TestSemanticConformanceEnforcesHeroMastheadAndCTAThreeParts(t *testing.T) {
+func TestSemanticConformanceEnforcesHeroMastheadAndExactCTAVariantStructures(t *testing.T) {
 	if err := checkSemanticConformance(e2eWitness{Module: "hero", Variant: "masthead"}, `<section></section>`); err == nil {
 		t.Fatal("masthead without its structural part must fail")
 	}
 	if err := checkSemanticConformance(e2eWitness{Module: "hero", Variant: "masthead"}, `<section data-module-part="hero-masthead"></section>`); err != nil {
 		t.Fatal(err)
 	}
-	if err := checkSemanticConformance(e2eWitness{Module: "cta", Variant: "trial"}, `<section data-module-part="cta-title"></section>`); err == nil {
-		t.Fatal("CTA without all structural parts must fail")
+	valid := map[string]string{
+		"save-follow": `<section data-cta-variant="save-follow"><section data-module-part="cta-save-confirmation"></section><section data-module-part="cta-save-actions"><span data-cta-action="primary"></span><span data-cta-action="secondary"></span><span data-cta-action="tertiary"></span></section></section>`,
+		"consult":     `<section data-cta-variant="consult"><section data-module-part="cta-consult-layout"><section data-module-part="cta-consult-trust"></section><section data-module-part="cta-consult-primary"><span data-cta-action="primary"></span></section><section data-module-part="cta-consult-aux"><span data-cta-action="secondary"></span><span data-cta-action="tertiary"></span></section></section></section>`,
+		"trial":       `<section data-cta-variant="trial"><section data-module-part="cta-trial-benef
```

**File**: `cmd/md2wechat/layout_test.go` (modified, +5/-5)
```diff
@@ -244,12 +244,12 @@ func TestLayoutShowJSONReturnsSpec(t *testing.T) {
 	if spec["body_format"] != layoutcatalog.BodyFormatFields {
 		t.Fatalf("expected hero body_format fields, got %#v", spec["body_format"])
 	}
-	contract, ok := spec["agent_contract"].(map[string]any)
-	if !ok {
-		t.Fatalf("expected agent_contract in layout show response: %#v", spec)
+	if _, ok := spec["agent_contract"]; ok {
+		t.Fatalf("layout show must not expose internal agent_contract metadata: %#v", spec)
 	}
-	if contract["body_format"] != layoutcatalog.BodyFormatFields || contract["defaults"] == nil || contract["applicability"] == nil {
-		t.Fatalf("incomplete agent_contract in layout show response: %#v", contract)
+	fields, ok := spec["Fields"].(map[string]any)
+	if !ok || fields["Required"] == nil || fields["Optional"] == nil {
+		t.Fatalf("layout show must expose canonical fields guidance: %#v", spec)
 	}
 }
 
```

**File**: `docs/SMOKE.md` (modified, +2/-2)
```diff
@@ -32,11 +32,11 @@
 make e2e-layout
 ```
 
-该目标与 API 模式 `convert` 共用同一端点解析：默认完整 URL 是 `https://www.md2wechat.cn/api/convert`，并对 `MD2WECHAT_BASE_URL` / 配置文件值统一补全 `/api/convert`。本地或 staging 验证可显式设置 `MD2WECHAT_BASE_URL` 覆盖目标。凭证从 `~/.config/md2wechat/config.yaml` 的 `api.md2wechat_key` 读取，`MD2WECHAT_API_KEY` 可覆盖配置文件。API key 只进入 `X-API-Key` 请求头，不会出现在命令行、JSONL 报告或测试日志中。
+该目标与 API 模式 `convert` 共用同一端点解析：默认完整 URL 是 `https://www.md2wechat.cn/api/convert`，并对 `MD2WECHAT_BASE_URL` / 配置文件值统一补全 `/api/convert`。发布模式（默认）必须同时提供已通过的上游字段契约证据：`MD2WECHAT_UPSTREAM_FIELD_CONTRACT_SHA=052346a43deb83d211471bb7b423318f6f6ff6c1` 与 `MD2WECHAT_UPSTREAM_FIELD_CONTRACT_RESULT=passed`；缺任一项或 SHA 不匹配即失败。仅本地或 staging 冒烟可显式设置 `MD2WECHAT_LAYOUT_CONFORMANCE_MODE=smoke`，并可用 `MD2WECHAT_BASE_URL` 覆盖目标。凭证从 `~/.config/md2wechat/config.yaml` 的 `api.md2wechat_key` 读取，`MD2WECHAT_API_KEY` 可覆盖配置文件。API key 只进入 `X-API-Key` 请求头，不会出现在命令行、JSONL 报告或测试日志中。
 
 报告默认写入 `/tmp/md2wechat-layout-conformance.jsonl`，可通过 `LAYOUT_CONFORMANCE_OUTPUT` 改路径。脚本为 Go 测试设置六分钟总时限；请求串行执行，且仅网络/5xx 短暂失败会最多重试两次。它会运行 84 个 witness conformance，以及一个覆盖 `default`、`apple`、`cyber`、`bytedance`、`sports`、`chinese` 的紧凑边界/组合探针。84 个 witness 由 56 个 canonical、25 个结构不同的 non-default branch 和 3 个 compatibility witness 组成；任一 module marker、稳定正文、精确 variant 分支属性、语义 DOM 约束或原始 fence 不一致都会失败。
 
-可选设置 `MD2WECHAT_API_BUILD_ID` 锁定预期部署版本；设置后每个响应都必须携带 recognized build identity header 且精确匹配。未设置时仍要求本次 84-witness run 内所有响应 identity 一致；若均无 header，只记录 target 与 UTC 观测时间，并明确标记为非 commit 证据。失败类别区分 authentication、API drift 与 network failure。
+可选设置 `MD2WECHAT_API_BUILD_ID` 锁定预期部署版本；设置后每个响应都必须携带 recognized build identity header 且精确匹配。未设置时仍要求本次 84-witness run 内所有响应 identity 一致；若均无 header，只记录 target 与 UTC 观测时间，并明确标记为非 commit 证据。失败类别区分 authentication、API drift 与 network failure。JSONL 测试日志中的 `conformance_target_normalized` 是实际请求的规范化 API URL；脚本会把该字段名作为 target evidence label 输出。
 
 发布时保留 JSONL 报告和测试日志作为目标 API 证据；不要把本地 `layout validate` 或常青文档中的历史运行结果当作远端部署证明。
 
```

**File**: `internal/assets/builtin/layout/conversion/summary.yaml` (modified, +19/-1)
```diff
@@ -33,30 +33,39 @@ fields:
       example: three
     - name: eyebrow
       description: 标签词
+      applies_to: [one-line, three, decision, save]
       example: "一句话总结"
     - name: highlight
       description: 一句话总结
+      applies_to: [one-line]
       example: "先把结构搭稳，再让主题接管气质"
     - name: title
       description: 摘要标题
+      applies_to: [three, decision, save]
       example: "发布前带走三点"
     - name: body
       description: 展开说明
+      applies_to: [one-line]
       example: "同一篇内容切换主题时，重点仍然清楚。"
     - name: items
       description: 总结项，用 | 分隔
+      applies_to: [three, save]
       example: "结构先于风格 | 模块服务阅读 | 主题定义气质"
     - name: fit
       description: 适合项，用 | 分隔
+      applies_to: [decision]
       example: "需要稳定发布的人 | 需要复用结构的人"
     - name: not_fit
       description: 不适合项，用 | 分隔
+      applies_to: [decision]
       example: "只写短讯的人"
     - name: recommendation
       description: 决策建议
+      applies_to: [decision]
       example: "先校准契约，再扩展模块。"
     - name: note
       description: 补充说明
+      applies_to: [three, save]
       example: "收藏后按清单执行"
 variants:
   - name: three
@@ -144,7 +153,16 @@ agent_contract:
     - items-auto-three
     - decision-fields-auto-decision
     - case-folded-variant
-  applicability: {}
+  applicability:
+    eyebrow: [one-line, three, decision, save]
+    highlight: [one-line]
+    title: [three, decision, save]
+    body: [one-line]
+    items: [three, save]
+    fit: [decision]
+    not_fit: [decision]
+    recommendation: [decision]
+    note: [three, save]
 metadata:
   author: md2wechat
   provenance: builtin
```

**File**: `internal/converter/api_test.go` (modified, +13/-5)
```diff
@@ -124,11 +124,7 @@ func TestAPILocalParameterMatrixUsesDiscoveryThemeAndExactSharedFields(t *testin
 	if err := themes.LoadThemes(); err != nil {
 		t.Fatal(err)
 	}
-	apiThemes := themes.ListAPIThemes()
-	if len(apiThemes) == 0 {
-		t.Fatal("theme discovery returned no API-selectable theme")
-	}
-	selected, err := themes.ResolveThemeForMode(ModeAPI, apiThemes[0])
+	selected, err := firstSelectableAPITheme(themes)
 	if err != nil {
 		t.Fatal(err)
 	}
@@ -197,6 +193,18 @@ func TestAPILocalParameterMatrixUsesDiscoveryThemeAndExactSharedFields(t *testin
 	}
 }
 
+// firstSelectableAPITheme keeps transport tests independent of map iteration
+// and of non-selectable API catalog manifests such as api-collection.
+func firstSelectableAPITheme(themes *ThemeManager) (*Theme, error) {
+	for _, name := range themes.ListThemes() {
+		theme, err := themes.ResolveThemeForMode(ModeAPI, name)
+		if err == nil {
+			return theme, nil
+		}
+	}
+	return nil, fmt.Errorf("theme discovery returned no API-selectable theme")
+}
+
 func TestAPIConverterDoesNotRetryNonzeroContractResponse(t *testing.T) {
 	attempts := 0
 	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
```

**File**: `internal/layoutcatalog/body.go` (modified, +1/-1)
```diff
@@ -727,7 +727,7 @@ func fieldAppliesToVariant(field FieldSpec, active *VariantSpec) bool {
 		return true
 	}
 	if active == nil {
-		return false
+		return containsString(field.AppliesTo, "one-line")
 	}
 	return containsString(field.AppliesTo, active.Name)
 }
```

**File**: `internal/layoutcatalog/body_test.go` (modified, +27/-0)
```diff
@@ -912,3 +912,30 @@ func TestRenderRawBodyUsesPrimaryValidation(t *testing.T) {
 		t.Fatalf("Render() error = %v, want missing dialogue pair", err)
 	}
 }
+
+func TestSummaryCanonicalFieldsApplyOnlyToEffectiveBranch(t *testing.T) {
+	c := NewCatalog()
+	if err := c.Load(); err != nil {
+		t.Fatal(err)
+	}
+	for _, tt := range []struct {
+		name, markdown string
+		accepted       bool
+	}{
+		{name: "one line accepts highlight", markdown: ":::summary\nhighlight: One line\n:::", accepted: true},
+		{name: "three accepts title items and note", markdown: ":::summary\nvariant: three\ntitle: Three\nitems: one | two | three\nnote: Save this\n:::", accepted: true},
+		{name: "decision accepts decision fields", markdown: ":::summary\nvariant: decision\ntitle: Decide\nfit: Fit\nrecommendation: Choose\n:::", accepted: true},
+		{name: "save accepts title items and note", markdown: ":::summary\nvariant: save\ntitle: Save\nitems: one | two\nnote: Keep\n:::", accepted: true},
+		{name: "decision rejects one line highlight", markdown: ":::summary\nvariant: decision\nhighlight: ineffective\nrecommendation: Choose\n:::"},
+		{name: "three rejects decision recommendation", markdown: ":::summary\nvariant: three\nitems: one | two\nrecommendation: ineffective\n:::"},
+		{name: "save rejects legacy body", markdown: ":::summary\nvariant: save\nitems: one | two\nbody: ineffective\n:::"},
+		{name: "one line rejects items", markdown: ":::summary\nhighlight: One line\nitems: ineffective\n:::"},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			report := c.Validate(tt.markdown)
+			if got := len(report.Errors) == 0; got != tt.accepted {
+				t.Fatalf("accepted=%v errors=%+v", got, report.Errors)
+			}
+		})
+	}
+}
```

**File**: `internal/layoutcatalog/contract_test.go` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ type upstreamAgentContractProjection struct {
 }
 
 const upstreamAgentContractContentSHA256 = "c6ca6d8a26b1bc694a8cef72ff6c7d517366f4331bb7ee978dbdae5556636fbd"
-const upstreamAgentContractProjectionSHA256 = "f36e422df4e2f33beb9169079923cf6204ca8407204086f9f81f328a9ab15afe"
+const upstreamAgentContractProjectionSHA256 = "c6a70f2870102903a75269301999118419e5db2e9e8c7ff7dfd87cd4d7351b5d"
 
 func TestUpstreamAgentContractProjectionOracle(t *testing.T) {
 	data, err := os.ReadFile("testdata/upstream_agent_contract_projections.yaml")
```

---

### Incident Patch 10: `81b15527` (2026-08-25)
**Commit Message**: fix(docs): bind layout conformance target to resolver

**File**: `cmd/md2wechat/layout_docs_test.go` (modified, +17/-0)
```diff
@@ -265,6 +265,23 @@ func TestLayoutDocumentationE2EFixtureMatchesCurrentCatalog(t *testing.T) {
 	}
 }
 
+func TestLayoutDocumentationE2EFixtureUsesConvertResolvedEndpoint(t *testing.T) {
+	markdown := readDocumentationFile(t, "../../examples/layout-e2e-test.md")
+	if strings.Contains(markdown, "https://md2wechat.app") {
+		t.Fatal("layout E2E fixture must not hardcode an unrelated production endpoint")
+	}
+	for _, phrase := range []string{
+		"https://www.md2wechat.cn/api/convert",
+		"MD2WECHAT_BASE_URL",
+		"api.md2wechat_base_url",
+		"与 `convert` 相同的解析结果",
+	} {
+		if !strings.Contains(markdown, phrase) {
+			t.Errorf("layout E2E fixture must define convert-resolved endpoint behavior %q", phrase)
+		}
+	}
+}
+
 func TestLayoutDocumentationE2EFixtureComposition(t *testing.T) {
 	markdown := readDocumentationFile(t, "../../examples/layout-e2e-test.md")
 
```

**File**: `examples/layout-e2e-test.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ author: md2wechat
 digest: 覆盖九类推荐模块的真实 API 渲染测试，每次发布前必须通过
 ---
 
-> 本文件是九类推荐语法的人工综合样例，不替代发布 conformance。发布证据使用 `make e2e-layout`，固定验证生产目标 `https://md2wechat.app` 的 canonical、结构 variant 和 3 个 compatibility witness；其他目标不能作为发布完成证明。
+> 本文件是九类推荐语法的人工综合样例，不替代发布 conformance。发布证据使用 `make e2e-layout`，并与 `convert` 共用同一端点解析：未配置时目标为 `https://www.md2wechat.cn/api/convert`；设置 `MD2WECHAT_BASE_URL` 或 `api.md2wechat_base_url` 后，conformance 必须验证与 `convert` 相同的解析结果。它覆盖 canonical、结构 variant 和 3 个 compatibility witness；其他未通过该解析路径指定的目标不能作为发布完成证明。
 
 :::hero
 variant: masthead
```

**File**: `scripts/release-check.sh` (modified, +8/-0)
```diff
@@ -284,6 +284,14 @@ for skill_path in skills/md2wechat/SKILL.md platforms/openclaw/md2wechat/SKILL.m
   grep -Fq 'AI mode (`--mode ai`) does not parse `:::module` syntax' "$skill_path" || fail "$skill_path must preserve AI-mode non-rendering"
 done
 GOCACHE="${GOCACHE:-/tmp/md2wechat-go-build}" go test ./cmd/md2wechat -run '^TestLayoutDocumentation' -count=1 >/dev/null || fail "layout documentation contracts must pass"
+! rg -Fq 'https://md2wechat.app' examples/layout-e2e-test.md \
+  || fail "layout E2E fixture must not hardcode an unrelated production endpoint"
+grep -Fq 'https://www.md2wechat.cn/api/convert' examples/layout-e2e-test.md \
+  || fail "layout E2E fixture must state the default convert endpoint"
+grep -Fq 'MD2WECHAT_BASE_URL' examples/layout-e2e-test.md \
+  || fail "layout E2E fixture must state endpoint override resolution"
+grep -Fq '与 `convert` 相同的解析结果' examples/layout-e2e-test.md \
+  || fail "layout E2E fixture must require the same endpoint resolution as convert"
 grep -q -- '--body-file' docs/LAYOUT.md || fail "LAYOUT must document complex body input"
 grep -q 'layout list --lifecycle compatibility --json' skills/md2wechat/SKILL.md || fail "embedded skill must isolate compatibility layouts"
 grep -q 'layout list --lifecycle compatibility --json' platforms/openclaw/md2wechat/SKILL.md || fail "OpenClaw skill must isolate compatibility layouts"
```

---

### Incident Patch 11: `9218632e` (2026-08-25)
**Commit Message**: fix(release): refresh PR1 audit fixtures

**File**: `cmd/md2wechat/layout_e2e_test.go` (modified, +1/-1)
```diff
@@ -725,7 +725,7 @@ func TestBuiltinExecutableWitnessProbesAreComplete(t *testing.T) {
 			}
 			want := 1
 			for _, variant := range spec.Variants {
-				if strings.TrimSpace(variant.Example) != "" && !(variant.Name == "default" && strings.TrimSpace(variant.Example) == strings.TrimSpace(spec.Example)) {
+				if strings.TrimSpace(variant.Example) != "" && (variant.Name != "default" || strings.TrimSpace(variant.Example) != strings.TrimSpace(spec.Example)) {
 					want++
 				}
 			}
```

**File**: `cmd/md2wechat/layout_test.go` (modified, +1/-1)
```diff
@@ -400,7 +400,7 @@ func TestLayoutRenderBodyFileDashReadsStdin(t *testing.T) {
 	})
 
 	for _, want := range []string{
-		`:::gallery-grid{columns=2 variant=card}`,
+		`:::gallery-grid{accent=brand caption_style=minimal columns=2 density=normal image_shape=square variant=clean wechat_safe_level=normal}`,
 		`![移动端](https://example.com/mobile.jpg)`,
 	} {
 		if !strings.Contains(string(stdout), want) {
```

**File**: `internal/converter/api_test.go` (modified, +3/-3)
```diff
@@ -74,7 +74,7 @@ func TestPostAPIConvertSerializesSharedRequestAndRetriesOnlyTransientFailures(t
 	if err != nil {
 		t.Fatal(err)
 	}
-	defer resp.Body.Close()
+	defer func() { _ = resp.Body.Close() }()
 	if attempts != 3 {
 		t.Fatalf("attempts = %d, want 3", attempts)
 	}
@@ -95,7 +95,7 @@ func TestPostAPIConvertReturnsContractFailuresWithoutRetry(t *testing.T) {
 	if err != nil {
 		t.Fatal(err)
 	}
-	defer resp.Body.Close()
+	defer func() { _ = resp.Body.Close() }()
 	if resp.StatusCode != http.StatusUnauthorized {
 		t.Fatalf("status = %d", resp.StatusCode)
 	}
@@ -161,7 +161,7 @@ func TestAPILocalParameterMatrixUsesDiscoveryThemeAndExactSharedFields(t *testin
 		default:
 			background = "default"
 		}
-		_, _ = w.Write([]byte(fmt.Sprintf(`{"code":0,"data":{"html":"<p>ok</p>","theme":%q,"fontSize":%q,"backgroundType":%q,"wordCount":2,"estimatedReadTime":1}}`, request.Theme, font, background)))
+		_, _ = fmt.Fprintf(w, `{"code":0,"data":{"html":"<p>ok</p>","theme":%q,"fontSize":%q,"backgroundType":%q,"wordCount":2,"estimatedReadTime":1}}`, request.Theme, font, background)
 	}))
 	defer server.Close()
 
```

**File**: `internal/layoutcatalog/body.go` (modified, +0/-9)
```diff
@@ -151,15 +151,6 @@ func (facts *bodyFacts) addField(name, value string) {
 	facts.fieldTypes[name] = append(facts.fieldTypes[name], "string")
 }
 
-func (facts *bodyFacts) addDeclaredFields(fields *FieldsSpec, body []string) {
-	for _, line := range body {
-		name, value, ok := parseDeclaredField(fields, line)
-		if ok {
-			facts.addField(name, value)
-		}
-	}
-}
-
 func parseDeclaredField(fields *FieldsSpec, line string) (string, string, bool) {
 	if fields == nil {
 		return "", "", false
```

**File**: `internal/layoutcatalog/contract_test.go` (modified, +3/-3)
```diff
@@ -46,7 +46,7 @@ type upstreamAgentContractProjection struct {
 }
 
 const upstreamAgentContractContentSHA256 = "c6ca6d8a26b1bc694a8cef72ff6c7d517366f4331bb7ee978dbdae5556636fbd"
-const upstreamAgentContractProjectionSHA256 = "65db776313af832ede1b2fee087ea38ed55a264cec4ee5a1051d310b9fbd29f4"
+const upstreamAgentContractProjectionSHA256 = "f36e422df4e2f33beb9169079923cf6204ca8407204086f9f81f328a9ab15afe"
 
 func TestUpstreamAgentContractProjectionOracle(t *testing.T) {
 	data, err := os.ReadFile("testdata/upstream_agent_contract_projections.yaml")
@@ -60,7 +60,7 @@ func TestUpstreamAgentContractProjectionOracle(t *testing.T) {
 	if got := fmt.Sprintf("%x", sha256.Sum256(data)); got != upstreamAgentContractProjectionSHA256 {
 		t.Fatalf("projection fixture digest = %q, want %q", got, upstreamAgentContractProjectionSHA256)
 	}
-	if oracle.SourceCommit != "edcde64ae1be56f1a08a0617bb1862471e7e00b1" {
+	if oracle.SourceCommit != "052346a43deb83d211471bb7b423318f6f6ff6c1" {
 		t.Fatalf("upstream source commit = %q", oracle.SourceCommit)
 	}
 	if want := []string{"__tests__/fixtures/advanced-layout-agent-contract.ts", "advanced-layout-modules-guide.md"}; !slices.Equal(oracle.SourceFiles, want) {
@@ -93,7 +93,7 @@ func TestUpstreamAgentContractProjectionOracle(t *testing.T) {
 
 func TestUpstreamAgentContractOracle(t *testing.T) {
 	oracle := readUpstreamAgentContracts(t)
-	if oracle.SourceCommit != "edcde64ae1be56f1a08a0617bb1862471e7e00b1" {
+	if oracle.SourceCommit != "052346a43deb83d211471bb7b423318f6f6ff6c1" {
 		t.Fatalf("upstream source commit = %q", oracle.SourceCommit)
 	}
 	if oracle.SourceFile != "__tests__/fixtures/advanced-layout-agent-contract.ts" {
```

**File**: `internal/layoutcatalog/loader.go` (modified, +2/-2)
```diff
@@ -202,7 +202,7 @@ func validateAgentContract(contract *AgentContractSpec, lifecycle string) error
 		if strings.TrimSpace(field) == "" || strings.TrimSpace(field) != field {
 			return fmt.Errorf("agent_contract enum field %q is invalid", field)
 		}
-		if values == nil || len(values) == 0 {
+		if len(values) == 0 {
 			return fmt.Errorf("agent_contract enum %q requires values", field)
 		}
 		seen := make(map[string]bool, len(values))
@@ -225,7 +225,7 @@ func validateAgentContract(contract *AgentContractSpec, lifecycle string) error
 		if strings.TrimSpace(field) == "" || strings.TrimSpace(field) != field {
 			return fmt.Errorf("agent_contract applicability field %q is invalid", field)
 		}
-		if variants == nil || len(variants) == 0 {
+		if len(variants) == 0 {
 			return fmt.Errorf("agent_contract applicability %q requires variants", field)
 		}
 		if _, err := validateAgentContractList("applicability "+field, variants); err != nil {
```

**File**: `internal/layoutcatalog/testdata/recommended_scenarios.yaml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
-source_commit: edcde64ae1be56f1a08a0617bb1862471e7e00b1
+source_commit: 052346a43deb83d211471bb7b423318f6f6ff6c1
 source_file: lib/advanced-module-groups.ts
-source_sha256: e5443d6c7298bf592ec556395622f55e49721a418f2aa7578d8867555470e050
+source_sha256: eafb8d4167a079a602b9a5fb4ac25c68bbfd9f3d1cb8115808136dada116b437
 guide_only_recommended_syntax:
   - figure-caption
   - gallery-grid
```

**File**: `internal/layoutcatalog/testdata/upstream_agent_contract_projections.yaml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 # normalized agent-contract fixture is kept byte-for-byte pinned to the
 # upstream test source; this projection pins the PR1 guide's canonical body
 # representation and variant-only field applicability independently.
-source_commit: edcde64ae1be56f1a08a0617bb1862471e7e00b1
+source_commit: 052346a43deb83d211471bb7b423318f6f6ff6c1
 source_files:
   - __tests__/fixtures/advanced-layout-agent-contract.ts
   - advanced-layout-modules-guide.md
```

---

### Incident Patch 12: `6643c03e` (2026-08-25)
**Commit Message**: fix(layout): bind enhancement inventory

**File**: `cmd/md2wechat/discovery.go` (modified, +3/-2)
```diff
@@ -566,7 +566,8 @@ func buildLayoutCapabilityData() map[string]any {
 	compatibilityModules := catalog.ListFiltered(layoutcatalog.ListFilter{Lifecycle: layoutcatalog.LifecycleCompatibility})
 	recommendedSyntaxCount := len(modules)
 	compatibilityModuleCount := len(compatibilityModules)
-	renderSyntaxCount := recommendedSyntaxCount + compatibilityModuleCount + baseLayoutEnhancementCount
+	baseEnhancementCount := len(baseLayoutEnhancements)
+	renderSyntaxCount := recommendedSyntaxCount + compatibilityModuleCount + baseEnhancementCount
 	categorySet := map[string]struct{}{}
 	for _, module := range modules {
 		categorySet[module.Category] = struct{}{}
@@ -583,7 +584,7 @@ func buildLayoutCapabilityData() map[string]any {
 		"recommended_syntax_count":   recommendedSyntaxCount,
 		"recommended_scenario_count": recommendedLayoutScenarioCount,
 		"compatibility_module_count": compatibilityModuleCount,
-		"base_enhancement_count":     baseLayoutEnhancementCount,
+		"base_enhancement_count":     baseEnhancementCount,
 		"render_syntax_count":        renderSyntaxCount,
 		"supports_validate":          true,
 		"api_mode_only":              true,
```

**File**: `cmd/md2wechat/layout.go` (modified, +11/-1)
```diff
@@ -19,9 +19,19 @@ const (
 	codeLayoutValidated = "LAYOUT_VALIDATED"
 
 	recommendedLayoutScenarioCount = 77
-	baseLayoutEnhancementCount     = 4
 )
 
+// baseLayoutEnhancements is the exact non-module inventory from
+// docs/advanced-layout-modules-guide.md in the pinned upstream editor source.
+// These renderer capabilities intentionally do not appear in `layout list`,
+// but do contribute to render_syntax_count.
+var baseLayoutEnhancements = [...]string{
+	"highlight-text",
+	"katex",
+	"mermaid",
+	"gfm-alert",
+}
+
 var (
 	layoutListFilters struct {
 		category    string
```

**File**: `cmd/md2wechat/layout_docs_test.go` (modified, +49/-0)
```diff
@@ -189,6 +189,55 @@ func TestLayoutDocumentationE2EFixtureMatchesCurrentCatalog(t *testing.T) {
 	}
 }
 
+func TestLayoutDocumentationE2EFixtureComposition(t *testing.T) {
+	markdown := readDocumentationFile(t, "../../examples/layout-e2e-test.md")
+
+	hero := fixtureDirectiveBlocks(markdown, "hero")
+	if len(hero) != 1 || !strings.Contains(hero[0], "variant: masthead") {
+		t.Fatalf("fixture hero must use the masthead variant: %q", hero)
+	}
+
+	sectionTitles := fixtureDirectiveBlocks(markdown, "section-title")
+	wantSectionTitleVariants := []string{"numbered", "focus", "divider", "vertical"}
+	if len(sectionTitles) != len(wantSectionTitleVariants) {
+		t.Fatalf("fixture section-title blocks = %d, want %d", len(sectionTitles), len(wantSectionTitleVariants))
+	}
+	for _, variant := range wantSectionTitleVariants {
+		found := false
+		for _, block := range sectionTitles {
+			if strings.Contains(block, "variant: "+variant) {
+				found = true
+				break
+			}
+		}
+		if !found {
+			t.Errorf("fixture missing section-title variant %q", variant)
+		}
+	}
+
+	for _, directive := range []string{"epilogue", "summary", "cta", "closing"} {
+		if got := len(fixtureDirectiveBlocks(markdown, directive)); got != 1 {
+			t.Errorf("fixture %s blocks = %d, want exactly one", directive, got)
+		}
+	}
+
+	lastComposition := []string{":::hero", ":::epilogue", ":::summary", ":::cta", ":::closing"}
+	previous := -1
+	for _, marker := range lastComposition {
+		index := strings.Index(markdown, marker)
+		if index < 0 || index <= previous {
+			t.Errorf("fixture composition order must be %v", lastComposition)
+			break
+		}
+		previous = index
+	}
+}
+
+func fixtureDirectiveBlocks(markdown, directive string) []string {
+	pattern := regexp.MustCompile(`(?ms)^:::` + regexp.QuoteMeta(directive) + `[^\n]*\n.*?^:::\s*$`)
+	return pattern.FindAllString(markdown, -1)
+}
+
 func TestLayoutDocumentationConcreteExamplesMatchCatalog(t *testing.T) {
 	text := readDocumentationFile(t, "../../docs/LAYOUT.md")
 	catalog := layoutcatalog.NewCatalog()
```

**File**: `cmd/md2wechat/layout_test.go` (modified, +10/-0)
```diff
@@ -11,6 +11,16 @@ import (
 	"github.com/geekjourneyx/md2wechat-skill/internal/layoutcatalog"
 )
 
+func TestBaseLayoutEnhancementInventoryMatchesUpstreamGuide(t *testing.T) {
+	want := []string{"highlight-text", "katex", "mermaid", "gfm-alert"}
+	if got := baseLayoutEnhancements[:]; !slices.Equal(got, want) {
+		t.Fatalf("base layout enhancements = %v, want %v", got, want)
+	}
+	if got := len(baseLayoutEnhancements); got != 4 {
+		t.Fatalf("base layout enhancement count = %d, want 4", got)
+	}
+}
+
 func TestLayoutListJSONIncludesHero(t *testing.T) {
 	oldJSON := jsonOutput
 	t.Cleanup(func() {
```

**File**: `examples/layout-e2e-test.md` (modified, +23/-23)
```diff
@@ -133,29 +133,6 @@ require | 前提 | 先把信息分层 | 不要把所有信息都塞进一个模
 avoid | 不适合 | 特别短的快讯 | 这类内容通常一两个基础模块就够了
 :::
 
-:::cta
-title: 立即体验高级排版
-note: 56 个推荐语法覆盖九类内容结构，3 个 compatibility 模块仅用于迁移
-:::
-
-:::summary
-eyebrow: 一句话总结
-highlight: 先把结构搭稳，再让主题接管气质
-body: 同一篇内容切到不同主题时，重点和节奏仍然清楚。
-:::
-
-:::epilogue
-title: 当结构能被复用，表达才会拥有更大的自由。
-subtitle: 下面保留一条可选收束，供文章末尾按需使用。
-symbol: infinity
-:::
-
-:::closing
-title: 先让读者看懂，再让读者行动。
-subtitle: 每次发布前都用真实转换结果验证。
-symbol: asterism
-:::
-
 ## 六、图像与互动类（evidence / interactive）
 
 :::gallery-grid{columns=3 variant=card}
@@ -222,3 +199,26 @@ E: 高级模块把结构、层级和视觉节奏一起带进公众号正文。
 U: 我需要学多少个模块？
 E: 先学开场、信息卡、证据、总结和 CTA。
 :::
+
+:::epilogue
+title: 当结构能被复用，表达才会拥有更大的自由。
+subtitle: 现在把正文收束为读者能带走的判断。
+symbol: infinity
+:::
+
+:::summary
+eyebrow: 一句话总结
+highlight: 先把结构搭稳，再让主题接管气质
+body: 同一篇内容切到不同主题时，重点和节奏仍然清楚。
+:::
+
+:::cta
+title: 立即体验高级排版
+note: 56 个推荐语法覆盖九类内容结构，3 个 compatibility 模块仅用于迁移
+:::
+
+:::closing
+title: 先让读者看懂，再让读者行动。
+subtitle: 每次发布前都用真实转换结果验证。
+symbol: asterism
+:::
```

---

### Incident Patch 13: `2f3bfd0a` (2026-08-25)
**Commit Message**: fix(layout): calibrate all agent field contracts

**File**: `cmd/md2wechat/layout_test.go` (modified, +7/-0)
```diff
@@ -234,6 +234,13 @@ func TestLayoutShowJSONReturnsSpec(t *testing.T) {
 	if spec["body_format"] != layoutcatalog.BodyFormatFields {
 		t.Fatalf("expected hero body_format fields, got %#v", spec["body_format"])
 	}
+	contract, ok := spec["agent_contract"].(map[string]any)
+	if !ok {
+		t.Fatalf("expected agent_contract in layout show response: %#v", spec)
+	}
+	if contract["body_format"] != layoutcatalog.BodyFormatFields || contract["defaults"] == nil || contract["applicability"] == nil {
+		t.Fatalf("incomplete agent_contract in layout show response: %#v", contract)
+	}
 }
 
 func TestLayoutListCompatibilityIsolation(t *testing.T) {
```

**File**: `internal/assets/builtin/layout/brand/author-card.yaml` (modified, +22/-0)
```diff
@@ -56,6 +56,28 @@ example: |
   note: 关注我，持续看产品和内容系统的真实打磨过程
   link: md2wechat.com
   :::
+agent_contract:
+  body_format: fields
+  required:
+    - name
+  optional:
+    - role
+    - bio
+    - tags
+    - note
+    - link
+  enums: {}
+  defaults:
+    max-tags: "4"
+    link: plain-text
+  invalid:
+    - blank-name
+  ignored:
+    - tags-after-4
+    - unknown-fields
+  legacy:
+    - json-object
+  applicability: {}
 metadata:
   author: md2wechat
   provenance: builtin
```

**File**: `internal/assets/builtin/layout/brand/people.yaml` (modified, +23/-0)
```diff
@@ -42,6 +42,29 @@ example: |
   内容负责人 | 内容策略 | 负责把文章重点和节奏定下来 | accent
   设计负责人 | 视觉把关 | 负责保证气质和细节不掉价 | default
   :::
+agent_contract:
+  body_format: rows
+  required:
+    - name
+    - role
+    - body
+  optional:
+    - header-title
+    - tone
+  enums:
+    tone:
+      - default
+      - accent
+  defaults:
+    header-title: 核心角色
+    tone: default
+  invalid:
+    - blank-required-cell
+    - image-leading-row
+  ignored:
+    - cells-after-tone
+  legacy: []
+  applicability: {}
 metadata:
   author: md2wechat
   provenance: builtin
```

**File**: `internal/assets/builtin/layout/brand/series.yaml` (modified, +21/-0)
```diff
@@ -65,6 +65,27 @@ example: |
   tags: 公众号 | 品牌排版 | 内容系统
   next: 下一篇：个人品牌模块怎么搭
   :::
+agent_contract:
+  body_format: fields
+  required:
+    - name
+    - title
+  optional:
+    - issue
+    - desc
+    - tags
+    - next
+  enums: {}
+  defaults:
+    max-tags: "4"
+  invalid:
+    - blank-name
+    - blank-title
+  ignored:
+    - tags-after-4
+    - unknown-fields
+  legacy: []
+  applicability: {}
 metadata:
   author: md2wechat
   provenance: builtin
```

**File**: `internal/assets/builtin/layout/brand/subscribe.yaml` (modified, +23/-0)
```diff
@@ -62,6 +62,29 @@ example: |
   secondary: 转发给正在写长文的人
   note: 下一篇继续拆个人品牌模块
   :::
+agent_contract:
+  body_format: fields
+  required:
+    - title
+  optional:
+    - label
+    - subtitle
+    - primary
+    - secondary
+    - note
+  enums: {}
+  defaults:
+    primary: 继续关注
+    secondary: 收藏这篇
+  invalid:
+    - blank-title
+  ignored:
+    - action-urls
+    - unknown-fields
+  legacy:
+    - json-object
+    - actions-fields
+  applicability: {}
 metadata:
   author: md2wechat
   provenance: builtin
```

**File**: `internal/assets/builtin/layout/conversion/cases.yaml` (modified, +24/-0)
```diff
@@ -44,6 +44,30 @@ example: |
   品牌发布稿 | 阅读完成率 +38% | 用封面卡和数据卡更容易把重点讲清楚 | accent
   销售方案稿 | 理解效率更高 | 用对比卡和步骤流减少解释成本 | default
   :::
+agent_contract:
+  body_format: rows
+  required:
+    - title
+    - result
+    - body
+  optional:
+    - header-title
+    - image
+    - tone
+  enums:
+    tone:
+      - default
+      - accent
+  defaults:
+    header-title: 案例精选
+    tone: default
+  invalid:
+    - blank-required-cell
+  ignored:
+    - unsafe-image
+    - cells-after-tone
+  legacy: []
+  applicability: {}
 metadata:
   author: md2wechat
   provenance: builtin
```

**File**: `internal/assets/builtin/layout/conversion/checklist.yaml` (modified, +27/-0)
```diff
@@ -41,6 +41,33 @@ example: |
   warn | 链接和说明单独检查 | 避免手机里出现跳读和看不清
   :::
 example_assert_contains: "结构先搭好"
+agent_contract:
+  body_format: rows
+  required:
+    - status
+    - title
+  optional:
+    - header-title
+    - description
+  enums:
+    status:
+      - done
+      - pending
+      - warn
+  defaults:
+    header-title: 检查清单
+  invalid:
+    - blank-title
+    - unknown-status
+  ignored:
+    - cells-after-description
+  legacy:
+    - title-only-to-pending
+    - todo-to-pending
+    - "[x]-to-done"
+    - "[ ]-to-pending"
+    - case-folded-status
+  applicability: {}
 metadata:
   author: md2wechat
   provenance: builtin
```

**File**: `internal/assets/builtin/layout/conversion/closing.yaml` (modified, +34/-0)
```diff
@@ -40,6 +40,40 @@ example: |
   subtitle: 下一篇从一份真实草稿开始。
   symbol: asterism
   :::
+agent_contract:
+  body_format: fields
+  required:
+    - title
+  optional:
+    - symbol
+    - subtitle
+  enums:
+    symbol:
+      - spark-solid
+      - spark-outline
+      - diamond-solid
+      - diamond-outline
+      - reference-mark
+      - asterism
+      - double-circle
+      - circle
+      - square-solid
+      - square-outline
+      - star
+      - infinity
+  defaults:
+    symbol: asterism
+    unknown-or-raw-symbol: asterism
+  invalid:
+    - blank-title
+  ignored:
+    - action
+    - link
+    - image
+    - variant
+    - unknown-fields
+  legacy: []
+  applicability: {}
 metadata:
   author: md2wechat
   provenance: builtin
```

---

### Incident Patch 14: `df63b811` (2026-08-25)
**Commit Message**: fix(layout): enforce canonical witness contracts

**File**: `internal/assets/builtin/layout/conversion/cta.yaml` (modified, +0/-8)
```diff
@@ -64,13 +64,6 @@ variants:
   - name: save-follow
     use_when: 结尾引导收藏或关注
     required: [title]
-    example: |
-      :::cta
-      variant: save-follow
-      title: 收藏这套结构，下一篇直接复用
-      primary: 收藏
-      secondary: 关注
-      :::
   - name: consult
     use_when: 结尾引导咨询
     defaults:
@@ -104,7 +97,6 @@ variants:
       :::
 example: |
   :::cta
-  variant: save-follow
   title: 如果这篇对你有帮助，可以先收藏，再试着改一篇自己的文章。
   primary: 收藏这篇
   secondary: 关注更新
```

**File**: `internal/assets/builtin/layout/evidence/quote.yaml` (modified, +1/-6)
```diff
@@ -31,6 +31,7 @@ fields:
     - name: variant
       description: 引用结构变体
       enum: [light, brand, proof]
+      default: light
       example: light
     - name: quote
       description: 引用正文（quote 或 text 至少填一个）
@@ -87,11 +88,6 @@ variants:
     use_when: 需要轻量突出一句引用
     required_any:
       - [quote, text]
-    example: |
-      :::quote
-      variant: light
-      quote: 模块服务阅读任务，而不是填满页面。
-      :::
   - name: brand
     aliases: [accent]
     use_when: 需要突出品牌主张
@@ -117,7 +113,6 @@ variants:
       :::
 example: |
   :::quote
-  variant: light
   eyebrow: 核心观点
   quote: 模块帮助读者更快找到判断、证据和下一步。
   source: 内容设计原则
```

**File**: `internal/assets/builtin/layout/infographic/infographic.yaml` (modified, +1/-7)
```diff
@@ -83,11 +83,6 @@ variants:
     aliases: [statement, judgment, claim]
     use_when: 需要突出单一主判断
     required: [title]
-    example: |
-      :::infographic
-      type: thesis
-      title: 高级排版不是装饰，是阅读决策系统
-      :::
   - name: formula
     aliases: [equation]
     use_when: 需要表达可记忆公式
@@ -200,13 +195,12 @@ variants:
       - {field: items, separator: "|", min_parts: 2}
     example: |
       :::infographic
-      type: mini-case
+      type: micro-case
       title: 一篇草稿如何变成可发布稿
       items: 原稿没有结构 | 补齐判断与证据 | 完成发布检查
       :::
 example: |
   :::infographic
-  type: thesis
   eyebrow: 核心判断
   title: 高级排版不是装饰，是阅读决策系统
   subtitle: 它先帮读者判断值不值得看，再帮作者建立记忆点
```

**File**: `internal/assets/builtin/layout/opening/hero.yaml` (modified, +0/-8)
```diff
@@ -73,13 +73,6 @@ variants:
   - name: editorial
     use_when: 观点文开场先给出判断
     required: [title]
-    example: |
-      :::hero
-      variant: editorial
-      eyebrow: 深度观察
-      title: 高级排版服务阅读决策
-      subtitle: 主题决定气质，模块决定读者能不能看懂
-      :::
   - name: briefing
     use_when: 报告开场需要列出导读
     required: [title]
@@ -109,7 +102,6 @@ variants:
       :::
 example: |
   :::hero
-  variant: editorial
   eyebrow: 深度观察
   meta: 8 min read
   kicker: 先把判断讲清楚
```

**File**: `internal/assets/builtin/layout/opening/section-title.yaml` (modified, +0/-6)
```diff
@@ -53,12 +53,6 @@ variants:
   - name: marker
     use_when: 用轻量标记开始一个正文主题
     required: [title]
-    example: |
-      :::section-title
-      variant: marker
-      title: 先校准输入契约
-      symbol: diamond-outline
-      :::
   - name: divider
     use_when: 用分隔线清晰切开上下文
     defaults:
```

**File**: `internal/assets/builtin/layout/sprint4/callout.yaml` (modified, +6/-2)
```diff
@@ -1,7 +1,8 @@
 schema_version: "1"
 name: callout
 lifecycle: recommended
-body_format: lines
+body_format: markdown_fields
+compatible_body_formats: [lines]
 version: "1.0.0"
 since: "1.5.0"
 category: sprint4
@@ -26,6 +27,9 @@ anti_pattern: |
   danger 类型用于非危险场景失去警示意义；
   内容写太长应该拆成正文段落。
 fields:
+  required:
+    - name: body
+      description: 提示正文
   optional:
     - name: type
       enum: [info, warning, success, danger]
@@ -40,7 +44,7 @@ body:
 example: |
   :::callout
   type: warning
-  注意：发布前请检查图片、链接和行动按钮，避免复制到公众号后出现断链。
+  body: 注意：发布前请检查图片、链接和行动按钮，避免复制到公众号后出现断链。
   :::
 metadata:
   author: md2wechat
```

**File**: `internal/layoutcatalog/body.go` (modified, +27/-3)
```diff
@@ -40,6 +40,12 @@ func validateBlockBody(spec *LayoutSpec, body []string) []bodyValidationIssue {
 		issues := parseIssues
 		if len(parseIssues) == 0 {
 			issues = append(issues, validateBodyFacts(spec, format, facts)...)
+			// Compatibility formats preserve old syntax only. Once the primary
+			// syntax parsed, its field and enum validation is authoritative and
+			// must not be bypassed by a looser legacy format.
+			if i == 0 && len(issues) != 0 {
+				return issues
+			}
 		}
 		if len(issues) == 0 {
 			return nil
@@ -64,9 +70,7 @@ func parseBodyFacts(spec *LayoutSpec, format string, body []string) (bodyFacts,
 	case BodyFormatFields, "":
 		return parseFieldsBody(spec.Fields, body)
 	case BodyFormatMarkdownFields:
-		facts.addDeclaredFields(spec.Fields, body)
-		facts.imageCount = countMarkdownImages(body)
-		return facts, nil
+		return parseMarkdownFieldsBody(spec.Fields, body)
 	case BodyFormatJSONObject, BodyFormatJSONArray:
 		fields, types, items, err := parseJSONBodyData(body, format)
 		if err != nil {
@@ -97,6 +101,26 @@ func parseBodyFacts(spec *LayoutSpec, format string, body []string) (bodyFacts,
 	}
 }
 
+func parseMarkdownFieldsBody(fields *FieldsSpec, body []string) (bodyFacts, []bodyValidationIssue) {
+	facts := newBodyFacts()
+	for _, raw := range body {
+		line := strings.TrimSpace(strings.TrimRight(raw, "\r"))
+		if line == "" {
+			continue
+		}
+		if name, value, ok := parseDeclaredField(fields, line); ok {
+			facts.addField(name, value)
+			continue
+		}
+		if markdownImageLineRE.MatchString(line) {
+			facts.imageCount++
+			continue
+		}
+		return facts, []bodyValidationIssue{{message: "markdown fields body requires a declared field or Markdown image"}}
+	}
+	return facts, nil
+}
+
 func parseFieldsBody(fields *FieldsSpec, body []string) (bodyFacts, []bodyValidationIssue) {
 	facts := newBodyFacts()
 	for _, raw := range body {
```

**File**: `internal/layoutcatalog/body_test.go` (modified, +23/-1)
```diff
@@ -20,6 +20,28 @@ func TestValidateRowsRejectsTooFewColumns(t *testing.T) {
 	}
 }
 
+func TestCalloutCanonicalTypeAndLegacyTokenBody(t *testing.T) {
+	c := NewCatalog()
+	if err := c.Load(); err != nil {
+		t.Fatal(err)
+	}
+	for _, tt := range []struct {
+		name, markdown string
+		wantErr        bool
+	}{
+		{name: "canonical type", markdown: ":::callout\ntype: warning\nbody: 先完成发布前检查。\n:::\n"},
+		{name: "canonical invalid type", markdown: ":::callout\ntype: urgent\nbody: 先完成发布前检查。\n:::\n", wantErr: true},
+		{name: "legacy token opener", markdown: ":::callout warning\n先完成发布前检查。\n:::\n"},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			report := c.Validate(tt.markdown)
+			if (len(report.Errors) != 0) != tt.wantErr {
+				t.Fatalf("errors = %+v, wantErr %v", report.Errors, tt.wantErr)
+			}
+		})
+	}
+}
+
 func TestValidateBlockBodyMatrix(t *testing.T) {
 	field := func(name string) FieldSpec { return FieldSpec{Name: name} }
 	tests := []struct {
@@ -95,7 +117,7 @@ func TestValidateBlockBodyMatrix(t *testing.T) {
 				Fields:     &FieldsSpec{Optional: []FieldSpec{field("step"), field("desc")}},
 				Body:       &BodySpec{Group: &FieldGroupSpec{Start: "step", Required: []string{"step", "desc"}, Min: 1}},
 			},
-			body: []string{"unrelated"}, wantErr: "at least 1 complete group",
+			body: []string{"unrelated"}, wantErr: "declared field or Markdown image",
 		},
 		{
 			name: "split accepts two nonempty sides",
```

---

### Incident Patch 15: `7149c46d` (2026-08-25)
**Commit Message**: fix(layout): calibrate all agent field contracts

**File**: `internal/assets/builtin/layout/brand/author-card.yaml` (modified, +2/-1)
```diff
@@ -5,6 +5,7 @@ body_format: fields
 version: "1.0.0"
 since: "1.5.0"
 category: brand
+input_positions: [body-kv]
 serves: [memorability, conversion]
 content_types: [opinion, announcement, brand]
 industry: [general]
@@ -27,10 +28,10 @@ fields:
     - name: name
       description: 作者名称
       example: "极客旅程"
+  optional:
     - name: bio
       description: 作者简介，说明擅长领域和关注价值
       example: "长期写 AI 工具、内容系统和产品增长，关注怎么把复杂工作流做成可复用资产。"
-  optional:
     - name: role
       description: 作者身份标签
       example: "独立开发者 / 内容产品"
```

**File**: `internal/assets/builtin/layout/brand/people.yaml` (modified, +6/-4)
```diff
@@ -5,6 +5,7 @@ body_format: rows
 version: "1.0.0"
 since: "1.5.0"
 category: brand
+input_positions: [row-dsl]
 serves: [memorability, readability]
 content_types: [announcement, brand, report]
 industry: [general]
@@ -30,11 +31,12 @@ rows:
       description: 姓名或角色名称
     - name: role
       description: 身份或职位
-    - name: bio
+    - name: body
       description: 说明，介绍这个人的职责或贡献
-    - name: style
-      description: "风格：accent 或 default（可省略）"
-      enum: [accent, default]
+    - name: tone
+      description: "风格：default 或 accent（可省略）"
+      enum: [default, accent]
+      default: default
 example: |
   :::people[核心角色]
   内容负责人 | 内容策略 | 负责把文章重点和节奏定下来 | accent
```

**File**: `internal/assets/builtin/layout/brand/series.yaml` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@ body_format: fields
 version: "1.0.0"
 since: "1.5.0"
 category: brand
+input_positions: [body-kv]
 serves: [memorability, conversion]
 content_types: [opinion, tutorial, brand]
 industry: [general]
```

**File**: `internal/assets/builtin/layout/brand/subscribe.yaml` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@ body_format: fields
 version: "1.0.0"
 since: "1.5.0"
 category: brand
+input_positions: [body-kv]
 serves: [conversion, memorability]
 content_types: [opinion, tutorial, announcement, brand]
 industry: [general]
```

**File**: `internal/assets/builtin/layout/conversion/cases.yaml` (modified, +8/-4)
```diff
@@ -5,6 +5,7 @@ body_format: rows
 version: "1.0.0"
 since: "1.5.0"
 category: conversion
+input_positions: [row-dsl]
 serves: [conversion, attention]
 content_types: [report, announcement, brand, product-launch]
 industry: [general]
@@ -30,11 +31,14 @@ rows:
       description: 案例标题或客户名称
     - name: result
       description: 案例结果，尽量用数字表达
-    - name: context
+    - name: body
       description: 说明，解释如何达成这个结果
-    - name: style
-      description: "风格：accent 或 default（可省略）"
-      enum: [accent, default]
+    - name: image
+      description: 案例图片（可省略）
+    - name: tone
+      description: "风格：default 或 accent（可省略）"
+      enum: [default, accent]
+      default: default
 example: |
   :::cases[案例精选]
   品牌发布稿 | 阅读完成率 +38% | 用封面卡和数据卡更容易把重点讲清楚 | accent
```

**File**: `internal/assets/builtin/layout/conversion/checklist.yaml` (modified, +7/-6)
```diff
@@ -5,6 +5,7 @@ body_format: rows
 version: "1.0.0"
 since: "1.5.0"
 category: conversion
+input_positions: [row-dsl]
 serves: [readability, conversion]
 content_types: [tutorial, report]
 industry: [general]
@@ -20,18 +21,18 @@ pairs_well_with: [steps, specs, notice]
 avoid_combining_with: []
 anti_pattern: |
   没有任何有效事项导致渲染失败；
-  状态列写错（只允许 done/pending/warn/todo）；
+  状态列写错（只允许 done/pending/warn）；
   每条都写 done 失去检查列表的意义。
 rows:
   delimiter: "|"
-  min_columns: 1
+  min_columns: 2
   schema:
     - name: status
-      description: "状态：done（完成）/ pending（待完成）/ warn（警告）/ todo（等同 pending）"
-      enum: [done, pending, warn, todo]
-    - name: item
+      description: "状态：done（完成）/ pending（待完成）/ warn（警告）"
+      enum: [done, pending, warn]
+    - name: title
       description: 检查事项
-    - name: note
+    - name: description
       description: 说明，补充检查要点（可省略）
 example: |
   :::checklist[发布前检查]
```

**File**: `internal/assets/builtin/layout/conversion/faq.yaml` (modified, +22/-5)
```diff
@@ -1,10 +1,12 @@
 schema_version: "1"
 name: faq
 lifecycle: recommended
-body_format: rows
+body_format: dialogue
+compatible_body_formats: [rows]
 version: "1.0.0"
 since: "1.5.0"
 category: conversion
+input_positions: [prefix-dsl]
 serves: [conversion, readability]
 content_types: [tutorial, announcement, product-launch]
 industry: [general]
@@ -22,18 +24,33 @@ anti_pattern: |
   没有任何满足 2 列的行导致渲染失败；
   问题列写成陈述句而非疑问句；
   回答写太长应该拆成正文段落。
+opener:
+  caption: true
+fields:
+  required:
+    - name: Q
+      description: 常见问题，以问句形式表达
+    - name: A
+      description: 简洁回答，直接解决疑虑
+body:
+  min_items: 2
+  allowed_prefixes: ["Q:", "A:"]
+  required_pairs:
+    - [Q, A]
 rows:
   delimiter: "|"
   min_columns: 2
   schema:
     - name: question
-      description: 常见问题，以问句形式表达
+      description: 旧版兼容问题列
     - name: answer
-      description: 简洁回答，直接解决疑虑
+      description: 旧版兼容回答列
 example: |
   :::faq[常见问题]
-  这些模块只能在某一个主题里用吗？ | 不是，所有主题都会生效。
-  为什么不用硬双列？ | 因为微信正文窄，单列模块更稳。
+  Q: 这些模块只能在某一个主题里用吗？
+  A: 不是，所有主题都会生效。
+  Q: 为什么不用硬双列？
+  A: 因为微信正文窄，单列模块更稳。
   :::
 metadata:
   author: md2wechat
```

**File**: `internal/assets/builtin/layout/conversion/logos.yaml` (modified, +2/-1)
```diff
@@ -5,6 +5,7 @@ body_format: rows
 version: "1.0.0"
 since: "1.5.0"
 category: conversion
+input_positions: [row-dsl]
 serves: [conversion, memorability]
 content_types: [announcement, brand, product-launch]
 industry: [general]
@@ -28,7 +29,7 @@ rows:
   schema:
     - name: name
       description: 品牌或合作方名称
-    - name: description
+    - name: note
       description: 简短定位说明（可省略）
 example: |
   :::logos[合作品牌]
```

#### Recent Merged Pull Requests:
- **PR #28** (2026-09-06): docs: 恢复带文字的 3D GIF 头图并移除视频 (@geekjourneyx)
- **PR #27** (2026-09-06): docs: 更新 B 版 3D 头图并加入无声演示视频 (@geekjourneyx)
- **PR #26** (closed): feat(discovery): publish runtime facts contract (@geekjourneyx)
- **PR #25** (2026-08-24): docs: refresh README header demo (@geekjourneyx)
- **PR #24** (2026-08-24): docs: remove API trial references (@geekjourneyx)
- **PR #23** (2026-08-24): docs: make API pricing and contact path visible (@geekjourneyx)
- **PR #21** (2026-09-01): feat(image): add MiniMax subject references (@octo-patch)
- **PR #19** (2026-09-07): feat(image): add Atlas Cloud provider (@binyangzhu000-sudo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

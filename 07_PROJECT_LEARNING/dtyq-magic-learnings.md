# Forensic Learning Record (Deep Inspection): dtyq/magic

> **Canonical Artifact**: `07_PROJECT_LEARNING/dtyq-magic-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dtyq/magic](https://github.com/dtyq/magic))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:55:35.144Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dtyq/magic`
- **Description**: Magicrew. The first open-source all-in-one AI productivity platform (Generalist AI Agent + Workflow Engine + IM + Online collaborative office system)
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5047 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/code-executor/runner/resources/templates/script.py`
```
import resource
import json
from io import StringIO
import contextlib
import warnings


def sanitize_globals():
    dangerous = ['eval', 'exec', 'compile', 'open', '__import__', 'exit', 'quit']
    for name in dangerous:
        globals().pop(name, None)

sanitize_globals()

__args__ = json.loads(input())
if __args__:
    locals().update(__args__)

def print_err(*args):
    import sys
    sys.stderr.write(' '.join(map(str, args)))
    exit(1)

warnings.filterwarnings("ignore")

def main():
%{code}%

result = None

output = StringIO()
result = None
with contextlib.redirect_stdout(output):
    try:
        result = main()
    except MemoryError:
        print_err("Memory limit exceeded")
    except Exception as e:
        print_err(f"Error: {{str(e)}}")

import sys
sys.stdout.write(json.dumps({"result": result, "output": output.getvalue()}))

```

### Core Architecture Module: `backend/magic-gateway/internal/handler/sign_handler.go`
```
package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"api-gateway/internal/model"
	"api-gateway/internal/service"
)

// SignHandler handles signing operations
type SignHandler struct {
	blake3Service *service.Blake3Service
	logger        *log.Logger
}

// NewSignHandler creates a new sign handler with Blake3 service initialization
func NewSignHandler(logger *log.Logger) (*SignHandler, error) {
	// Get Blake3 key from environment
	blake3Key := os.Getenv("AI_DATA_SIGNING_KEY")
	if blake3Key == "" {
		return nil, fmt.Errorf("AI_DATA_SIGNING_KEY environment variable is required")
	}

	// Initialize Blake3 service
	blake3Service, err := service.NewBlake3Service(blake3Key)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Blake3 service: %w", err)
	}

	return &SignHandler{
		blake3Service: blake3Service,
		logger:        logger,
	}, nil
}

// Sign handles unified signing requests
func (h *SignHandler) Sign(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Only allow POST method
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req model.SignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Data == "" {
		http.Error(w, "data is required", http.StatusBadRequest)
		return
	}

	// Sign the data using Blake3
	signature, err := h.blake3Service.SignData(req.Data)
	if err != nil {
		h.logger.Printf("Failed to sign data: %v", err)
		http.Error(w, "Failed to sign data", http.StatusInternalServerError)
		return
	}

	// Return success response
	response := model.SignResponse{
		Signature: signature,
	}

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Printf("Failed to encode response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

```

### Core Architecture Module: `backend/magic-gateway/internal/handler/user_handler.go`
```
package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"api-gateway/internal/model"
)

// UserHandler handles user info operations
type UserHandler struct {
	logger *log.Logger
}

// NewUserHandler creates a new user handler
func NewUserHandler(logger *log.Logger) *UserHandler {
	return &UserHandler{
		logger: logger,
	}
}

// GetUserInfo handles user info requests
func (h *UserHandler) GetUserInfo(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Only allow GET method
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user information from withAuth middleware
	// The withAuth middleware sets these headers after JWT validation
	userID := r.Header.Get("magic-user-id")
	orgCode := r.Header.Get("magic-organization-code")

	h.logger.Printf("User info request from user: %s, organization: %s", userID, orgCode)

	// Return user information
	response := model.UserInfoResponse{
		UserID:           userID,
		OrganizationCode: orgCode,
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

```

### Core Architecture Module: `backend/magic-gateway/internal/model/request.go`
```
package model

// SignRequest represents the unified request payload for signing
type SignRequest struct {
	Data     string `json:"data" binding:"required"`
	SignType string `json:"sign_type,omitempty"` // 可选：签名类型 (hmac, ed25519, hash)，默认为hmac
}

```

### Core Architecture Module: `backend/magic-gateway/internal/model/response.go`
```
package model

// SignResponse represents the unified response for signing operations
type SignResponse struct {
	Signature string `json:"signature"`
}

// UserInfoResponse represents the response payload for user info
type UserInfoResponse struct {
	UserID           string `json:"user_id"`
	OrganizationCode string `json:"organization_code"`
}

```

### Core Architecture Module: `backend/magic-gateway/internal/service/blake3_service.go`
```
package service

import (
	"encoding/base64"
	"fmt"

	"lukechampine.com/blake3"
)

// Blake3Service handles BLAKE3 hash signing operations
type Blake3Service struct {
	key []byte
}

// NewBlake3Service creates a new Blake3 service instance
func NewBlake3Service(keyBase64 string) (*Blake3Service, error) {
	// Decode base64 key
	keyBytes, err := base64.StdEncoding.DecodeString(keyBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode key: %w", err)
	}

	// Key cannot be empty
	if len(keyBytes) == 0 {
		return nil, fmt.Errorf("key cannot be empty")
	}

	return &Blake3Service{
		key: keyBytes,
	}, nil
}

// SignData generates a 16-byte BLAKE3 hash of the given data
func (s *Blake3Service) SignData(data string) (string, error) {
	if s.key == nil {
		return "", fmt.Errorf("key not initialized")
	}

	// Create BLAKE3 hasher with 16-byte output and key
	hasher := blake3.New(16, s.key)
	hasher.Write([]byte(data))
	hash := hasher.Sum(nil)

	// Return base64-encoded hash
	encodedHash := base64.StdEncoding.EncodeToString(hash)
	return encodedHash, nil
}

// VerifySignature verifies a hash against data by regenerating the hash
func (s *Blake3Service) VerifySignature(data, signatureBase64 string) (bool, error) {
	if s.key == nil {
		return false, fmt.Errorf("key not initialized")
	}

	// Generate expected hash
	expectedSignature, err := s.SignData(data)
	if err != nil {
		return false, fmt.Errorf("failed to generate expected signature: %w", err)
	}

	// Compare signatures
	return expectedSignature == signatureBase64, nil
}

```

### Core Architecture Module: `backend/magic-gateway/main.go`
```
package main

import (
	"api-gateway/internal/handler"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
)

// 全局变量
var (
	gatewayAPIKey []byte
	jwtSecret     []byte
	jwtSecretID   string // 密钥版本标识
	jwtVerifyKeys map[string][]byte
	envVars       map[string]string
	logger        *log.Logger
	debugMode     bool
	ctx           = context.Background()

	// 支持的服务列表
	supportedServices = []string{"OPENAI", "MAGIC", "DEEPSEEK"}

	// 全局令牌版本计数器（用于吊销）
	tokenVersionCounter int64 = 0

	// 全局吊销时间戳
	globalRevokeTimestamp int64 = 0

	// JWT相关安全配置
	keyRotationInterval = 24 * time.Hour // 密钥轮换间隔
	lastKeyRotation     time.Time
	tokenExpireDuration = 30 * 24 * time.Hour // 令牌有效期，可通过 MAGIC_GATEWAY_TOKEN_EXPIRE_DAYS 配置

	// 预编译的正则表达式
	byteAPMAppKeyRegex = regexp.MustCompile(`X-ByteAPM-AppKey=[^\s,;]*`)

	// URL白名单规则
	allowedTargetRules []*TargetURLRule

	// 允许的内网IP列表（CIDR格式或单个IP）
	allowedPrivateIPs []*net.IPNet

	// 特殊API配置：需要在请求体中替换API密钥的服务
	specialApiKeys map[string]string

	// 安全限制
	maxRequestBodySize  int64 = 10 * 1024 * 1024  // 10MB 请求体限制
	maxResponseBodySize int64 = 100 * 1024 * 1024 // 100MB 响应体限制
)

// JWTClaims 定义JWT的声明 - 增强版
type JWTClaims struct {
	jwt.RegisteredClaims
	ContainerID           string `json:"container_id"`
	MagicUserID           string `json:"magic_user_id,omitempty"`
	MagicOrganizationCode string `json:"magic_organization_code,omitempty"`
	// 添加令牌版本用于吊销
	TokenVersion int64 `json:"token_version"`
	// 添加创建时间
	CreatedAt int64 `json:"created_at"`
	// 添加安全相关字段
	KeyID string `json:"kid,omitempty"`   // 密钥版本标识
	Nonce string `json:"nonce,omitempty"` // 防重放攻击
	Scope string `json:"scope,omitempty"` // 权限范围
}

// ServiceInfo 存储服务配置信息
type ServiceInfo struct {
	Name    string `json:"name"`
	BaseURL string `json:"base_url"`
	ApiKey  string `json:"api_key,omitempty"`
	Model   string `json:"default_model,omitempty"`
}

// 初始化JWT安全配置
func initJWTSecurity() {
	apiKey := getEnvWithDefault("MAGIC_GATEWAY_API_KEY", "")
	if apiKey == "" {
		logger.Fatal("错误: 必须设置MAGIC_GATEWAY_API_KEY环境变量")
	}
	gatewayAPIKey = []byte(apiKey)

	jwtSecretValue := getEnvWithDefault("JWT_SECRET", "")
	if len(jwtSecretValue) < 32 {
		logger.Fatal("错误: 必须设置至少32字符的JWT_SECRET环境变量")
	}
	if subtle.ConstantTimeCompare([]byte(jwtSecretValue), gatewayAPIKey) == 1 {
		logger.Fatal("错误: JWT_SECRET不能与MAGIC_GATEWAY_API_KEY相同")
	}
	jwtSecret = []byte(jwtSecretValue)

	// 创建密钥版本标识（使用JWT密钥的哈希）
	jwtSecretID = getJWTSecretID(jwtSecret)
	jwtVerifyKeys = map[string][]byte{
		jwtSecretID: jwtSecret,
	}

	legacyKeyID := getJWTSecretID(gatewayAPIKey)
	jwtVerifyKeys[legacyKeyID] = gatewayAPIKey
	logger.Printf("已启用旧版JWT兼容验证，旧密钥版本: %s", legacyKeyID)

	tokenExpireDuration = parseTokenExpireDuration()
	lastKeyRotation = time.Now()

	logger.Printf("JWT安全配置已初始化，令牌有效期: %d天", int(tokenExpireDuration.Hours()/24))
}

// parseTokenExpireDuration 从 MAGIC_GATEWAY_TOKEN_EXPIRE_DAYS 读取令牌有效期，默认 30 天
func parseTokenExpireDuration() time.Duration {
	const defaultDays = 30
	raw := getEnvWithDefault("MAGIC_GATEWAY_TOKEN_EXPIRE_DAYS", strconv.Itoa(defaultDays))
	days, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || days <= 0 {
		logger.Printf("警告: MAGIC_GATEWAY_TOKEN_EXPIRE_DAYS=%q 无效，使用默认值 %d 天", raw, defaultDays)
		return time.Duration(defaultDays) * 24 * time.Hour
	}
	return time.Duration(days) * 24 * time.Hour
}

func getJWTSecretID(secret []byte) string {
	hash := sha256.Sum256(secret)
	return hex.EncodeToString(hash[:8])
}

// 生成防重放攻击的随机数
func generateNonce() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// sanitizeLogString 清理用户输入以防止日志注入攻击
func sanitizeLogString(s string) string {
	// 移除换行符和回车符以防止日志注入
	s = strings.ReplaceAll(s, "\n", "\\n")
	s = strings.ReplaceAll(s, "\r", "\\r")
	// 限制长度以防止日志洪水攻击
	if len(s) > 200 {
		s = s[:200] + "...[truncated]"
	}
	return s
}

// maskSensitiveValue 对敏感值进行掩码处理用于日志记录（仅显示前4个和后4个字符）
func maskSensitiveValue(s string) string {
	if len(s) <= 8 {
		return "***"
	}
	return s[:4] + "***" + s[len(s)-4:]
}

// 检查密钥轮换
func checkKeyRotation() {
	if time.Since(lastKeyRotation) > keyRotationInterval {
		// 这里可以实现密钥轮换逻辑
		logger.Printf("密钥轮换检查: 当前密钥已使用 %v", time.Since(lastKeyRotation))
	}
}

// loadEnvFile 尝试从多个位置加载 .env 文件
func loadEnvFile() error {
	// 尝试多个位置查找 .env 文件
	envPaths := []string{
		".env",                     // 当前工作目录
		filepath.Join(".", ".env"), // 显式当前目录
	}

	// 尝试获取可执行文件目录并在那里查找 .env
	if exePath, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exePath)
		envPaths = append(envPaths, filepath.Join(exeDir, ".env"))
		// 也尝试父目录（以防可执行文件在子目录中）
		envPaths = append(envPaths, filepath.Join(filepath.Dir(exeDir), ".env"))
	}

	// 尝试获取当前工作目录
	if wd, err := os.Getwd(); err == nil {
		envPaths = append(envPaths, filepath.Join(wd, ".env"))
		// 尝试父目录
		envPaths = append(envPaths, filepath.Join(filepath.Dir(wd), ".env"))
	}

	// 去重路径（避免重复尝试）
	uniquePaths := make(map[string]bool)
	var uniqueEnvPaths []string
	for _, p := range envPaths {
		absPath, err := filepath.Abs(p)
		if err != nil {
			absPath = p
		}
		if !uniquePaths[absPath] {
			uniquePaths[absPath] = true
			uniqueEnvPaths = append(uniqueEnvPaths, p)
		}
	}

	// 尝试每个路径
	var lastErr error
	for i, envPath := range uniqueEnvPaths {
		absPath, _ := filepath.Abs(envPath)

		// 检查文件是否存在
		if _, err := os.Stat(envPath); os.IsNotExist(err) {
			if debugMode {
				logger.Printf("尝试位置 %d: %s (不存在)", i+1, absPath)
			}
			lastErr = err
			continue
		}

		// 尝试加载
		err := godotenv.Load(envPath)
		if err == nil {
			logger.Printf("成功加载.env文件: %s", absPath)
			return nil
		}

		if debugMode {
			logger.Printf("尝试位置 %d: %s (加载失败: %v)", i+1, absPath, err)
		}
		lastErr = err
	}

	// 如果所有尝试都失败，返回最后一个错误
	return lastErr
}

// 初始化函数
func init() {
	// 设置日志
	logger = log.New(os.Stdout, "[API网关] ", log.LstdFlags)
	logger.Println("初始化服务...")

	// 加载.env文件（支持多个位置）
	err := loadEnvFile()
	if err != nil {
		// 始终记录警告，不仅仅在调试模式下，以便用户知道 .env 文件未加载
		logger.Printf("警告: 无法加载.env文件: %v (将仅使用系统环境变量)", err)
	} else {
		logger.Println("已成功加载.env文件")
	}

	// 初始化JWT安全配置
	initJWTSecurity()

	// 缓存环境变量
	envVars = make(map[string]string)
	for _, env := range os.Environ() {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) == 2 {
			envVars[parts[0]] = parts[1]
		}
	}

	// 设置调试模式
	debugMode = getEnvWithDefault("MAGIC_GATEWAY_DEBUG", "false") == "true"
	if debugMode {
		logger.Println("调试模式已启用")
	}

	// 加载URL白名单
	loadAllowedTargetURLs()

	// 加载允许的内网IP列表
	loadAllowedPrivateIPs()

	// 加载特殊API配置
	loadSpecialApiKeys()

	logger.Printf("已加载 %d 个环境变量", len(envVars))
}

// 辅助函数：获取环境变量，如果不存在则使用默认值
func getEnvWithDefault(key, defaultValue string) string {
	value, exists := os.LookupEnv(key)
	if !exists {
		return defaultValue
	}
	return value
}

// loadSpecialApiKeys 从环境变量加载特殊API配置
// 这些API需要在请求体中自动替换API密钥
func loadSpecialApiKeys() {
	specialApiKeys = make(map[string]string)

	// 从环境变量 MAGIC_GATEWAY_SPECIAL_API_KEYS 读取配置
	// 格式: BASE_URL_KEY:API_KEY_KEY|BASE_URL_KEY2:API_KEY_KEY2
	// 例如: TEXT_TO_IMAGE_API_BASE_URL:TEXT_TO_IMAGE_ACCESS_KEY|VOICE_UNDERSTANDING_API_BASE_URL:VOICE_UNDERSTANDING_API_KEY
	configStr := getEnvWithDefault("MAGIC_GATEWAY_SPECIAL_API_KEYS", "")

	if configStr == "" {
		// 未配置特殊API密钥
		specialApiKeys = make(map[string]string)
		logger.Printf("未配置特殊API，如需启用请设置 MAGIC_GATEWAY_SPECIAL_API_KEYS 环境变量")
		logger.Printf("格式示例: BASE_URL_KEY:API_KEY_KEY|BASE_URL_KEY2:API_KEY_KEY2")
		return
	}

	// 解析配置字符串
	pairs := strings.Split(configStr, "|")
	for _, pair := range pairs {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}

		parts := strings.Split(pair, ":")
		if len(parts) != 2 {
			logger.Printf("警告: 特殊API配置格式错误: %s (应为 BASE_URL_KEY:API_KEY_KEY)", pair)
			continue
		}

		baseUrlKey := strings.TrimSpace(parts[0])
		apiKeyKey := strings.TrimSpace(par
```

### Core Architecture Module: `backend/magic-gateway/url_validator.go`
```
package main

import (
	"fmt"
	"net"
	"net/url"
	"regexp"
	"strings"
)

// TargetURLRuleType 定义匹配规则的类型
type TargetURLRuleType string

const (
	// RuleTypeExact 精确匹配完整URL
	RuleTypeExact TargetURLRuleType = "exact"
	// RuleTypeDomain 匹配整个域名及其所有子域名
	RuleTypeDomain TargetURLRuleType = "domain"
	// RuleTypePrefix 匹配以指定前缀开头的URL
	RuleTypePrefix TargetURLRuleType = "prefix"
	// RuleTypeRegex 使用正则表达式匹配URL
	RuleTypeRegex TargetURLRuleType = "regex"
)

// TargetURLRule 定义目标URL的白名单规则
type TargetURLRule struct {
	Type        TargetURLRuleType // 规则类型
	Pattern     string            // 匹配模式
	Description string            // 规则描述
	regex       *regexp.Regexp    // 编译后的正则表达式（用于regex类型）
}

// loadAllowedTargetURLs 从环境变量加载并解析URL白名单规则
func loadAllowedTargetURLs() {
	// 首先尝试从envVars获取（用于测试），然后从系统环境变量获取
	whitelistEnv := ""
	if val, exists := envVars["MAGIC_GATEWAY_ALLOWED_TARGET_URLS"]; exists {
		whitelistEnv = val
	} else {
		whitelistEnv = getEnvWithDefault("MAGIC_GATEWAY_ALLOWED_TARGET_URLS", "")
	}

	if whitelistEnv == "" {
		logger.Println("警告: 未设置 MAGIC_GATEWAY_ALLOWED_TARGET_URLS 环境变量，target参数将被禁用")
		allowedTargetRules = []*TargetURLRule{}
		return
	}

	// 从环境变量解析规则
	// 格式: type:pattern@description|type:pattern@description|...
	// 注意: 使用@分隔描述，以避免与URL中的:冲突
	// 示例: domain:example.com@允许example.com|prefix:https://api.test.com/@允许test API
	rules := strings.Split(whitelistEnv, "|")
	allowedTargetRules = make([]*TargetURLRule, 0, len(rules))

	for i, ruleStr := range rules {
		ruleStr = strings.TrimSpace(ruleStr)
		if ruleStr == "" {
			continue
		}

		// 解析规则组件
		// 格式: type:pattern@description (@和描述是可选的)
		// 查找第一个冒号来分隔类型
		firstColon := strings.Index(ruleStr, ":")
		if firstColon == -1 {
			logger.Printf("警告: 白名单规则格式错误 (规则 %d): %s", i+1, ruleStr)
			continue
		}

		ruleType := TargetURLRuleType(strings.TrimSpace(ruleStr[:firstColon]))
		remaining := ruleStr[firstColon+1:]

		// 查找@来分隔模式和描述
		atIndex := strings.Index(remaining, "@")
		var pattern, description string

		if atIndex > 0 {
			// 提供了描述
			pattern = strings.TrimSpace(remaining[:atIndex])
			description = strings.TrimSpace(remaining[atIndex+1:])
		} else {
			// 没有描述
			pattern = strings.TrimSpace(remaining)
		}

		// 验证规则类型
		switch ruleType {
		case RuleTypeExact, RuleTypeDomain, RuleTypePrefix:
			// 有效的类型
		case RuleTypeRegex:
			// 编译正则表达式
			re, err := regexp.Compile(pattern)
			if err != nil {
				logger.Printf("警告: 正则表达式编译失败 (规则 %d): %s, 错误: %v", i+1, pattern, err)
				continue
			}
			rule := &TargetURLRule{
				Type:        ruleType,
				Pattern:     pattern,
				Description: description,
				regex:       re,
			}
			allowedTargetRules = append(allowedTargetRules, rule)
			continue
		default:
			logger.Printf("警告: 未知的规则类型 (规则 %d): %s", i+1, ruleType)
			continue
		}

		rule := &TargetURLRule{
			Type:        ruleType,
			Pattern:     pattern,
			Description: description,
		}
		allowedTargetRules = append(allowedTargetRules, rule)
	}

	logger.Printf("已加载 %d 个目标URL白名单规则", len(allowedTargetRules))
	if debugMode {
		for i, rule := range allowedTargetRules {
			desc := rule.Description
			if desc == "" {
				desc = "无描述"
			}
			logger.Printf("  规则 %d: [%s] %s - %s", i+1, rule.Type, rule.Pattern, desc)
		}
	}
}

// loadAllowedPrivateIPs 从环境变量加载并解析允许的内网IP列表
// 支持多节点部署场景，支持多种分隔符和格式
func loadAllowedPrivateIPs() {
	// 首先尝试从envVars获取（用于测试），然后从系统环境变量获取
	allowedIPsEnv := ""
	if val, exists := envVars["MAGIC_GATEWAY_ALLOWED_TARGET_IP"]; exists {
		allowedIPsEnv = val
	} else {
		allowedIPsEnv = getEnvWithDefault("MAGIC_GATEWAY_ALLOWED_TARGET_IP", "")
	}

	if allowedIPsEnv == "" {
		allowedPrivateIPs = []*net.IPNet{}
		if debugMode {
			logger.Println("未设置 MAGIC_GATEWAY_ALLOWED_TARGET_IP 环境变量，所有内网IP将被禁止")
		}
		return
	}

	// 支持多种分隔符：逗号、分号、换行符、空格
	// 格式: IP1,IP2/CIDR,IP3;IP4 IP5\nIP6
	// 示例: 192.168.1.1,10.0.0.0/8,172.16.0.0/12;192.168.2.0/24
	// 多节点部署示例: 10.0.1.0/24,10.0.2.0/24,10.0.3.0/24
	allowedPrivateIPs = make([]*net.IPNet, 0)
	ipSet := make(map[string]bool) // 用于去重
	successCount := 0
	failCount := 0

	// 替换所有分隔符为逗号，然后统一处理
	normalized := strings.ReplaceAll(allowedIPsEnv, ";", ",")
	normalized = strings.ReplaceAll(normalized, "\n", ",")
	normalized = strings.ReplaceAll(normalized, "\r", ",")
	normalized = strings.ReplaceAll(normalized, " ", ",")

	ipStrings := strings.Split(normalized, ",")

	for i, ipStr := range ipStrings {
		ipStr = strings.TrimSpace(ipStr)
		if ipStr == "" {
			continue
		}

		// 尝试解析为CIDR格式
		var ipnet *net.IPNet
		var err error
		var cidrStr string

		// 如果包含斜杠，尝试解析为CIDR
		if strings.Contains(ipStr, "/") {
			_, ipnet, err = net.ParseCIDR(ipStr)
			if err != nil {
				logger.Printf("警告: 允许的内网IP格式错误 (规则 %d): %s, 错误: %v", i+1, ipStr, err)
				failCount++
				continue
			}
			cidrStr = ipnet.String()
		} else {
			// 单个IP地址，转换为/32 (IPv4) 或 /128 (IPv6)
			ip := net.ParseIP(ipStr)
			if ip == nil {
				logger.Printf("警告: 允许的内网IP格式错误 (规则 %d): %s (无效的IP地址)", i+1, ipStr)
				failCount++
				continue
			}
			// 创建单个IP的CIDR
			if ip.To4() != nil {
				// IPv4: /32
				_, ipnet, err = net.ParseCIDR(ipStr + "/32")
			} else {
				// IPv6: /128
				_, ipnet, err = net.ParseCIDR(ipStr + "/128")
			}
			if err != nil {
				logger.Printf("警告: 允许的内网IP解析失败 (规则 %d): %s, 错误: %v", i+1, ipStr, err)
				failCount++
				continue
			}
			cidrStr = ipnet.String()
		}

		// 去重：如果已经存在相同的CIDR，跳过
		if ipSet[cidrStr] {
			if debugMode {
				logger.Printf("跳过重复的允许内网IP规则: %s", cidrStr)
			}
			continue
		}

		ipSet[cidrStr] = true
		allowedPrivateIPs = append(allowedPrivateIPs, ipnet)
		successCount++
	}

	// 统计IPv4和IPv6数量
	ipv4Count := 0
	ipv6Count := 0
	for _, ipnet := range allowedPrivateIPs {
		if ipnet.IP.To4() != nil {
			ipv4Count++
		} else {
			ipv6Count++
		}
	}

	logger.Printf("已加载 %d 个允许的内网IP规则 (成功: %d, 失败: %d, IPv4: %d, IPv6: %d)",
		len(allowedPrivateIPs), successCount, failCount, ipv4Count, ipv6Count)

	if debugMode {
		for i, ipnet := range allowedPrivateIPs {
			ipType := "IPv4"
			if ipnet.IP.To4() == nil {
				ipType = "IPv6"
			}
			logger.Printf("  允许的内网IP %d [%s]: %s", i+1, ipType, ipnet.String())
		}
	}
}

// isPrivateIP 检查IP地址是否为私有/内网地址
func isPrivateIP(ip net.IP) bool {
	// 首先检查是否在允许的内网IP列表中
	// 如果在允许列表中，则返回false（允许通过）
	for _, allowedIPNet := range allowedPrivateIPs {
		if allowedIPNet != nil && allowedIPNet.Contains(ip) {
			return false
		}
	}

	// 检查是否为环回地址
	if ip.IsLoopback() {
		return true
	}

	// 检查私有IP范围
	privateRanges := []string{
		"10.0.0.0/8",     // 私有网络
		"172.16.0.0/12",  // 私有网络
		"192.168.0.0/16", // 私有网络
		"169.254.0.0/16", // 链路本地地址
		"127.0.0.0/8",    // 环回地址
		"::1/128",        // IPv6环回地址
		"fc00::/7",       // IPv6私有地址
		"fe80::/10",      // IPv6链路本地地址
	}

	for _, cidr := range privateRanges {
		_, subnet, _ := net.ParseCIDR(cidr)
		if subnet != nil && subnet.Contains(ip) {
			return true
		}
	}

	return false
}

// validateTargetURL 对目标URL执行全面验证
func validateTargetURL(targetURL string) error {
	if targetURL == "" {
		return nil // 允许空目标（将使用其他方法）
	}

	// 解析URL
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		return fmt.Errorf("URL格式错误: %v", err)
	}

	// 检查协议 - 仅允许http和https
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return fmt.Errorf("不支持的协议: %s (仅支持 http/https)", parsedURL.Scheme)
	}

	// 提取主机名
	hostname := parsedURL.Hostname()
	if hostname == "" {
		return fmt.Errorf("URL中缺少主机名")
	}

	// Prevent URL tricks like @, :, etc
	if strings.Contains(hostname, "@") {
		return fmt.Errorf("主机名包含非法字符")
	}

	// 检查端口号是否在合理范围内
	if port := parsedURL.Port(); port != "" {
		// Block common internal/admin ports
		blockedPorts := []string{"22", "23", "25", "3306", "5432", "6379", "27017", "9200"}
		for _, blocked := range blockedPorts {
			if port == blocked {
				return fmt.Errorf("禁止访问的端口: %s", port)
			}
		}
	}

	// 检查是否为IP地址
	if ip := net.ParseIP(hostname); ip != nil {
		// 检查是否为私有IP
		if isPrivateIP(ip) {
			return fmt.Errorf("禁止访问内网IP地址: %s", hostname)
		}
	} else {
		// 解析主机名以检查私有IP (防止DNS rebinding攻击)
		ips, err := net.LookupIP(hostname)
		if er
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #72** (2026-03-20): **[Bug]: is not a public ip & source type 字段是必须的**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  1. 点击预览分段，时报错   <img width="1920" height="921" alt="Image" src="https://github.com/user-attachments/assets/c5ee3580-bb79-4d79-9b2d-eb2765450815" />  <img width="1245" height="900" alt="Image" src="https://github.com/user-attachments/assets/8da3fad5-78ac-41fd-a40b-25c5588f9f9e" />  2. 点击保存并处理，报错 source type 字段是必须的  <img width="1920" height="921" alt="Image" src="https://github.com/user-attachments/assets/925a844c-9559-4248-a7b6-439e550d30e0" />  ### Steps to Reproduce / 复现步骤  1. AI助理->管理AI助理->向量知识库->创建向量知识库 2. 上传 markdown 文档 3. 点击“预览分段”或者“保存并处理”  ### Logs and Additional Context / 日志和额外的上下文  预览分段错误日志 ``` [ERROR] App\Infrastructure\Core\Exception\ApiResponseExceptionLogAspect 发生异常 message:[172.16.207.249] is not a public ip, code:0, file:/opt/www/app/Infrastructure/Util/SSRF/SSRFDefense.php, line:107, trace:#0 /opt/www/app/Infrastructure/Util/SSRF/SSRFDefense.php(45): App\Infrastructure\Util\SSRF\SSRFDefense->isValid() #1 /opt/www/app/Infrastructure/Util/SSRF/SSRFUtil.php(61): App\Infrastructure\Util\SSRF\SSRFDefense->getSafeUrl() #2 /opt/www/app/Infrastructure/Core/File/Parser/FileParser.php(40): App\Infrastructure\Util\SSRF\SSRFUtil::getSafeUrl() #3 /opt/www/app/Application/KnowledgeBase/Service/Strategy/DocumentFile/Driver/ExternalFileDocumentFileStrategyDriver.php(30): App\Infrastructure\Core\File\Parser\FileParser->parse() #4 /opt/www/app/Application/KnowledgeBase/Service/Strategy/DocumentFile/D

- **Issue #69** (2026-03-20): **[Bug]: 工具convert_pdf 执行失败等问题汇总**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  **问题1convert_pdf，当遇到有pdf文件时，报错如下：** 11:26:32.981 | ERROR    | /app/app/tools/core/tool_executor.py:105 - 工具 convert_pdf 执行失败: 智能 PDF 转换服务未配置，请联系管理员。 11:26:32.982 | ERROR    | /app/app/tools/convert_pdf.py:405 - 生成工具详情时发生意外错误: 'NoneType' object has no attribute 'get' **问题2:加载 agent 配置: web-browser，如何手动配置一下工具。** 11:26:03.861 | INFO     | /app/agentlang/agentlang/agent/base.py:280 - 加载 agent 配置: web-browser 11:26:03.869 | WARNING  | /app/agentlang/agentlang/agent/base.py:299 - 工具 'search_zhihu_articles' 不存在，将在 Agent 定义中被忽略: 工具 search_zhihu_articles 不存在 11:26:03.869 | WARNING  | /app/agentlang/agentlang/agent/base.py:299 - 工具 'fetch_zhihu_article_detail' 不存在，将在 Agent 定义中被忽略: 工具 fetch_zhihu_article_detail 不存在 11:26:03.869 | WARNING  | /app/agentlang/agentlang/agent/base.py:299 - 工具 'search_rednote_notes' 不存在，将在 Agent 定义中被忽略: 工具 search_rednote_notes 不存在 11:26:03.870 | WARNING  | /app/agentlang/agentlang/agent/base.py:299 - 工具 'fetch_rednote_note' 不存在，将在 Agent 定义中被忽略: 工具 fetch_rednote_note 不存在 11:26:03.870 | WARNING  | /app/agentlang/agentlang/agent/base.py:299 - 工具 'wechat_article_search' 不存在，将在 Agent 定义中被忽略: 工具 wechat_article_search 不存在  **问题三：web 对话框无法滚动，进行一次提问后无法滚到到下方对话框继续对话。**  <img width="3108" height="1760" alt="Image" src="https://github.com/user-attachments/assets/9f42b262-ba29-4018-afb5-bc5d04786a82" />  ### Steps to Reproduce / 复现步骤  在我的macbookpro 14 inter芯片，docker-compose 部署。  ### Logs and Ad

- **Issue #68** (2026-03-20): **[Bug]: Cannot login into an instance with the provided login credentials**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  I want to login after deploying super magic with the official guide (via docker) but it doesn't login with either of the provided credentials.  ### Steps to Reproduce / 复现步骤  1. Clone the repo and `cd` into it. 2. Copy the config files from their example counterparts. 3. Change the port for caddy in `docker-compose.yaml` (because it was conflicting) to 5000 4. Run `./bin/magic.sh start` to initialize and choose **English** and **Local**. 5. Open <server-ip:5000> to access the login page in the browser. 6. Enter `13912345678` or `13812345678` for phone number and `letsmagic.ai` for password. 7. Press Login (and it doesn't work)  ### Logs and Additional Context / 日志和额外的上下文  _No response_
  **Post-Mortem & Fix Analysis**:
  > When I look up in the network tab   {     "redirect": "http://37.27.181.0:5000/login?redirect=http%3A%2F%2F37.27.181.0%3A5000%2F",     "state_code": "+86",     "phone": "86413141242",     "password": "sgdhgjfjfj",     "device": {         "id": "f15455f642f033113106adf18e3d0db9d78e058cb4eac993c0a9442bbff9a794",         "name": "Chrome 139.0.0.0",         "os": "Windows",         "os_version": "10"     },     "type": "phone_password" }  for sessions with a return code of 404 and CORS
  > ### Console Access to fetch at 'http://37.27.181.0/api/v1/sessions' from origin 'http://magic.sphereops.org:5000' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.  
  > You can remove the "Access-Control-Allow-Origin" restriction by modifying the configuration of the caddy server. 

- **Issue #65** (2026-03-20): **[Bug]: 请问如何使用ollama里面的模型呢，另文件上传总显示错误**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  请问如何使用ollama里面的模型呢，另文件上传总显示错误  ### Steps to Reproduce / 复现步骤  暂无  ### Logs and Additional Context / 日志和额外的上下文  _No response_
  **Post-Mortem & Fix Analysis**:
  > 文件上传错误的截图贴一下

- **Issue #62** (2026-03-20): **[Bug]: 添加用户问题**
  *Symptoms*: 部署完以后，我需要添加多个账号的话，应该怎么做呢？
  **Post-Mortem & Fix Analysis**:
  > @liangchenwsl 
  > 参考InitialAccountAndUserSeeder的实现，添加更多账号，再执行命令行即可。也可以参考InitialAccountAndUserSeeder 操作的数据表，自行实现添加注册功能
  > > 参考InitialAccountAndUserSeeder的实现，添加更多账号，再执行命令行即可。也可以参考InitialAccountAndUserSeeder作的数据表，自行实现添加注册功能  在*/backend/magic-service目录下执行 php bin/hyperf.php db:seed --path=seeders/initial_account_and_user_seeder.php 时 提示缺少文件，提示如下：Warning: require(/opt/magic-master/backend/magic-service/vendor/autoload.php): Failed to open stream: No such file or directory in /opt/magic-master/backend/magic-service/bin/hyperf.php on line 23 PHP Fatal error:  Uncaught Error: Failed opening required '/opt/magic-master/backend/magic-service/vendor/autoload.php' (include_path='.:/usr/share/php') in /opt/magic-master/backend/magic-service/bin/hyperf.php:23 Stack trace: #0 {main}   thrown in /opt/magic-master/backend/magic-service/bin/hyperf.php on line 23  Fatal error: Uncaught Error: Failed opening required '/opt/magic-master/backend/magic-service/vendor/autoload.php' (include_path='.:/usr/share/php') in /opt/magic-master/backend/magic-service/bin/hyperf.php:23 Stack trace: #0 {main}   thrown in /opt/magic-master/

- **Issue #61** (2025-08-20): **[Bug]: 使用https域名地址访问的时候出现异常，ip访问正常**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  15:29:06.519 | ERROR    | /app/app/infrastructure/storage/local.py:150 - 请求本地存储凭证API失败: Cannot connect to host magic-caddy:443 ssl:default [[SSL: TLSV1_ALERT_INTERNAL_ERROR] tlsv1 alert internal error (_ssl.c:1000)]  ### Steps to Reproduce / 复现步骤  CentOS Linux release 7.9.2009 (Core) Docker version 26.1.4, build 5650f9b Docker Compose version v2.36.2   ### Logs and Additional Context / 日志和额外的上下文  、、、  请求本地存储凭证API失败: Cannot connect to host magic-caddy:443 ssl:default [[SSL: TLSV1_ALERT_INTERNAL_ERROR] tlsv1 alert internal error (_ssl.c:1000)] 15:29:06.523 | ERROR    | /app/app/api/routes/websocket.py:124 - Traceback (most recent call last):   File "/venv/lib/python3.12/site-packages/aiohttp/connector.py", line 992, in _wrap_create_connection     return await self._loop.create_connection(*args, **kwargs)            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/usr/lib/python3.12/asyncio/base_events.py", line 1149, in create_connection     transport, protocol = await self._create_connection_transport(                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/usr/lib/python3.12/asyncio/base_events.py", line 1182, in _create_connection_transport     await waiter   File "/usr/lib/python3.12/asyncio/sslproto.py", line 578, in _on_handshake_complete     raise handshake_exc   File "/usr/lib/python3.12/asyncio/sslproto.py", line 560, in _do_handshake     self._sslobj.do_hand
  **Post-Mortem & Fix Analysis**:
  > 已在社区群回复，根据以下的错误提示 请求本地存储凭证API失败: Cannot connect to host magic-caddy:443 ssl:default [[SSL: TLSV1_ALERT_INTERNAL_ERROR] tlsv1 alert internal error (_ssl.c:1000)]   当修改默认的magic-caddy 内网service-name 通信为公网域名通信时， 需要同步调整根目录下的.env 和config 下面涉及magic-caddy 的配置

- **Issue #60** (2025-09-22): **[Bug]: 页面展示问题**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  没有适配网页  <img width="1433" height="848" alt="Image" src="https://github.com/user-attachments/assets/2eea5e8f-ce8e-4a13-a768-ab45c5c250e9" />  ### Steps to Reproduce / 复现步骤  我是MacOS M1  ### Logs and Additional Context / 日志和额外的上下文  _No response_
  **Post-Mortem & Fix Analysis**:
  > 好的， 我们修复一下
  > 已经修复，等待镜像构建。 https://github.com/dtyq/magic/commit/9c02ee8d167ae4b3b9e4c7bc7d3dd7e698890231

- **Issue #58** (2025-09-22): **[Bug]: UI 超级麦吉 没有滚动条，页面无法滚动**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  超级麦吉执行任务，页面无法滚动，看不到新的内容，也无法发送新的消息  ### Steps to Reproduce / 复现步骤  服务器端：ubuntu22.04 docker compose 部署  客户端： macbook pro m1  chrome 139.0.7258.68  超级麦吉，发送了一条消息，启动任务后，随着反馈内容的增加，对话框被不断下移动，且没有滚动条  <img width="536" height="910" alt="Image" src="https://github.com/user-attachments/assets/bd37eb23-a11a-45c8-9c51-7445eb3b15cd" />  **左侧列表，展开“话题列表”就看不到“话题文件”**  <img width="590" height="248" alt="Image" src="https://github.com/user-attachments/assets/6ea7aaf9-ea5c-4c41-a3ec-0a9e5bc46d5a" />  <img width="261" height="702" alt="Image" src="https://github.com/user-attachments/assets/db14fe66-ae12-4e42-b877-ae8fb0722c0c" />  ### Logs and Additional Context / 日志和额外的上下文  _No response_
  **Post-Mortem & Fix Analysis**:
  > 客户端 试了mac 的 edge 浏览器、windows 的 edge 浏览器 都是不行，没有滚动条
  > 请问解决了吗，我也遇到了同样的问题
  > 同样的问题

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

### Incident Patch 1: `1fc313db` (2026-08-12)
**Commit Message**: 🐛 fix(browser): improve tool detail results and screenshot playback

**File**: `backend/super-magic/app/core/entity/message/server_message.py` (modified, +1/-0)
```diff
@@ -151,6 +151,7 @@ class BrowserContent(BaseModel):
     file_tag: AttachmentTag = AttachmentTag.BROWSER  # 文件业务类型
     action: Optional[str] = None  # 用户可理解的操作名称
     summary: Optional[str] = None  # 本次操作结果摘要
+    detail: Optional[str] = None  # 脱敏后供用户查看的结构化 Markdown 详情
     page_title: Optional[str] = None  # 当前页面标题
     target: Optional[str] = None  # 本次操作对象
     status: Optional[BrowserDetailStatus] = None  # 本次操作状态
```

**File**: `backend/super-magic/app/i18n/translations/tool/messages.json` (modified, +588/-0)
```diff
@@ -1759,10 +1759,18 @@
         "zh_CN": "页面及资源加载完成",
         "en_US": "the page and its resources to finish loading"
     },
+    "browser.detail.state_commit": {
+        "zh_CN": "导航已提交",
+        "en_US": "the navigation to be committed"
+    },
     "browser.detail.state_dom_content_loaded": {
         "zh_CN": "页面结构加载完成",
         "en_US": "the page structure to finish loading"
     },
+    "browser.detail.state_network_idle": {
+        "zh_CN": "网络请求基本停止",
+        "en_US": "the network to become idle"
+    },
     "browser.detail.wait_default": {
         "zh_CN": "达到指定状态",
         "en_US": "the requested state"
@@ -1815,6 +1823,586 @@
         "zh_CN": "上传文件：{{count}} 个",
         "en_US": "Uploaded files: {{count}}"
     },
+    "browser.detail.field": {
+        "zh_CN": "- **{{label}}：** {{value}}",
+        "en_US": "- **{{label}}:** {{value}}"
+    },
+    "browser.detail.heading.result": {
+        "zh_CN": "结果",
+        "en_US": "Result"
+    },
+    "browser.detail.operation_completed": {
+        "zh_CN": "操作已完成。",
+        "en_US": "The operation completed."
+    },
+    "browser.detail.heading.page": {
+        "zh_CN": "页面",
+        "en_US": "Page"
+    },
+    "browser.detail.heading.pages": {
+        "zh_CN": "页面列表",
+        "en_US": "Pages"
+    },
+    "browser.detail.heading.content": {
+        "zh_CN": "内容",
+        "en_US": "Content"
+    },
+    "browser.detail.heading.details": {
+        "zh_CN": "详情",
+        "en_US": "Details"
+    },
+    "browser.detail.heading.scope": {
+        "zh_CN": "范围",
+        "en_US": "Scope"
+    },
+    "browser.detail.heading.html": {
+        "zh_CN": "HTML 结构",
+        "en_US": "HTML structure"
+    },
+    "browser.detail.heading.matches": {
+        "zh_CN": "匹配元素",
+        "en_US": "Matching elements"
+    },
+    "browser.detail.heading.suggestions": {
+        "zh_CN": "可用建议",
+        "en_US": "Suggestions"
+    },
+    "browser.detail.heading.elements": {
+        "zh_CN": "可操作元素",
+        "en_US": "Interactive elements"
+    },
+    "browser.detail.heading.changes": {
+        "zh_CN": "页面变化",
+        "en_US": "Page changes"
+    },
+    "browser.detail.heading.limits": {
+        "zh_CN": "说明",
+        "en_US": "Notes"
+    },
+    "browser.detail.heading.analysis": {
+        "zh_CN": "视觉分析",
+        "en_US": "Visual analysis"
+    },
+    "browser.detail.heading.evidence": {
+        "zh_CN": "匹配依据",
+        "en_US": "Match evidence"
+    },
+    "browser.detail.heading.value": {
+        "zh_CN": "返回值",
+        "en_US": "Returned value"
+    },
+    "browser.detail.heading.diagnostics": {
+        "zh_CN": "错误与警告",
+        "en_US": "Errors and warnings"
+    },
+    "browser.detail.heading.console_errors": {
+        "zh_CN": "错误",
+        "en_US": "Errors"
+    },
+    "browser.detail.heading.console_warnings": {
+        "zh_CN": "警告",
+        "en_US": "Warnings"
+    },
+    "browser.detail.heading.failed_requests": {
+        "zh_CN": "失败请求",
+        "en_US": "Failed requests"
+    },
+    "browser.detail.heading.http_errors": {
+        "zh_CN": "HTTP 错误响应",
+        "en_US": "HTTP error responses"
+    },
+    "browser.detail.label.title": {
+        "zh_CN": "标题",
+        "en_US": "Title"
+    },
+    "browser.detail.label.url": {
+        "zh_CN": "地址",
+        "en_US": "URL"
+    },
+    "browser.detail.label.status": {
+        "zh_CN": "状态",
+        "en_US": "Status"
+    },
+    "browser.detail.label.backend": {
+        "zh_CN": "浏览器后端",
+        "en_US": "Browser backend"
+    },
+    "browser.detail.label.readiness": {
+        "zh_CN": "页面状态",
+        "en_US": "Page readiness"
+    },
+    "browser.detail.label.pages": {
+        "zh_CN": "打开页面",
+        "en_US": "Open pages"
+    },
+    "browser.detail.label.capabilities": {
+        "zh_CN": "可用能力",
+        "en_US": "Capabilities"
+    },
+    "browser.detail.label.detail": {
+        "zh_CN": "结构模式",
+        "en_US": "Structure mode"
+    },
+    "b
```

**File**: `backend/super-magic/app/service/browser/browser_tool_result_builder.py` (modified, +22/-7)
```diff
@@ -321,6 +321,9 @@ def attach_screenshot(
         artifact: BrowserScreenshotArtifact,
     ) -> ToolResult:
         screenshot_result = cls.screenshot(page, result, artifact)
+        tool_result.data["page_id"] = screenshot_result.data["page_id"]
+        tool_result.data["session_id"] = screenshot_result.data["session_id"]
+        tool_result.data["page"] = screenshot_result.data["page"]
         tool_result.data["screenshot"] = screenshot_result.data["screenshot"]
         tool_result.data["label_to_ref"] = screenshot_result.data["label_to_ref"]
         tool_result.extra_info.update(screenshot_result.extra_info)
@@ -388,22 +391,27 @@ def visual_match_error(visual_result: ToolResult, message: str) -> ToolResult:
     @classmethod
     def console(cls, batch: DiagnosticBatch[ConsoleEntry], page_id: str) -> ToolResult:
         entries = batch.entries
-        error_count = sum(entry.level.lower() in {"error", "assert"} for entry in entries)
+        error_count = sum(entry.level.lower() in {"error", "fatal", "assert"} for entry in entries)
+        warning_count = sum(entry.level.lower() in {"warning", "warn"} for entry in entries)
         data = {
             "page_id": page_id,
             "console_entries": cls._structured(entries),
             "total_count": batch.total_count,
             "returned_count": len(entries),
             "error_count": error_count,
+            "warning_count": warning_count,
         }
         if not entries:
             return ToolResult(
-                content=f"Console entries for page {page_id}: total={batch.total_count}, returned=0, errors=0.",
+                content=(
+                    f"Console entries for page {page_id}: total={batch.total_count}, returned=0, "
+                    "errors=0, warnings=0."
+                ),
                 data=data,
             )
         lines = [
             f"Console entries for page {page_id}: total={batch.total_count}, "
-            f"returned={len(entries)}, errors={error_count}."
+            f"returned={len(entries)}, errors={error_count}, warnings={warning_count}."
         ]
         preview_entries = entries[-_MAX_DIAGNOSTIC_CONTENT_ENTRIES:]
         if len(preview_entries) < len(entries):
@@ -420,26 +428,33 @@ def console(cls, batch: DiagnosticBatch[ConsoleEntry], page_id: str) -> ToolResu
     @classmethod
     def network(cls, batch: DiagnosticBatch[NetworkEntry], page_id: str) -> ToolResult:
         entries = batch.entries
-        error_count = sum(entry.error is not None or entry.phase == "failed" for entry in entries)
+        request_failed_count = sum(entry.error is not None or entry.phase == "failed" for entry in entries)
+        http_error_count = sum(
+            isinstance(entry.status, int) and entry.status >= 400
+            for entry in entries
+        )
         data = {
             "page_id": page_id,
             "network_entries": cls._structured(entries),
             "total_count": batch.total_count,
             "returned_count": len(entries),
-            "error_count": error_count,
+            "error_count": request_failed_count,
+            "request_failed_count": request_failed_count,
+            "http_error_count": http_error_count,
             "pending_count": batch.pending_count,
         }
         if not entries:
             return ToolResult(
                 content=(
                     f"Network entries for page {page_id}: total={batch.total_count}, "
-                    f"returned=0, errors=0, pending={batch.pending_count}."
+                    f"returned=0, request_failures=0, http_errors=0, pending={batch.pending_count}."
                 ),
                 data=data,
             )
         lines = [
             f"Network entries for page {page_id}: total={batch.total_count}, returned={len(entries)}, "
-            f"errors={error_count}, pending={batch.pending_count}."
+            f"request_failures={request_failed_count}, http_errors={http_error_count}, "

```

**File**: `backend/super-magic/app/tools/browser/base.py` (modified, +95/-18)
```diff
@@ -11,12 +11,29 @@
 from agentlang.logger import get_logger
 from agentlang.tools.tool_result import ToolResult
 from app.core.entity.attachment import AttachmentStorageType
-from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
+from app.core.entity.factory.tool_detail_factory import ToolDetailFactory
+from app.core.entity.message.server_message import (
+    BrowserContent,
+    BrowserDetailStatus,
+    DisplayType,
+    FileContent,
+    ToolDetail,
+)
 from app.i18n import i18n
 from app.service.browser import BrowserScreenshotService, BrowserService
 from app.service.browser.browser_tool_result_builder import BrowserToolResultBuilder
 from app.tools.abstract_file_tool import AbstractFileTool
-from app.tools.browser.presentation import BrowserDetailBuilder, BrowserRemarkBuilder
+from app.tools.browser.presentation import BrowserRemarkBuilder
+from app.tools.browser.presentation.common import (
+    escape_markdown,
+    message,
+    page_data,
+    page_display_title,
+    safe_page_url,
+    string,
+    target_text,
+    user_error,
+)
 from app.tools.core import BaseToolParams
 from magic_use.errors import BrowserErrorCode, BrowserSDKError
 
@@ -180,12 +197,11 @@ async def get_after_tool_call_friendly_action_and_remark(
             arguments=arguments or {},
         )
 
-    async def get_tool_detail(
-        self,
-        tool_context: ToolContext,
-        result: ToolResult,
-        arguments: dict[str, object] | None = None,
-    ) -> ToolDetail:
+    def create_browser_tool_detail(self, result: ToolResult, content: str) -> ToolDetail:
+        """将具体工具生成的正文包装成统一的 Browser/Markdown 详情。"""
+        if not result.ok:
+            content = ""
+
         output_path = result.data.get("output_path")
         if self.name == "browser_screenshot" and result.ok and isinstance(output_path, str) and output_path:
             relative_file_path = Path(output_path).as_posix()
@@ -198,17 +214,75 @@ async def get_tool_detail(
                     storage_type=AttachmentStorageType.WORKSPACE,
                 ),
             )
-        presentation = BrowserDetailBuilder.presentation(
-            self._operation_name(),
-            result,
-            tool_name=self.name,
-            arguments=arguments or {},
+        page = self._page_data(result)
+        url = BrowserToolResultBuilder.safe_url(string(page.get("url")))
+        title = page_display_title(page)
+        target = target_text(result)
+        summary = self._detail_summary(result, target=target, page=page)
+        detail_content = content.strip() or self._fallback_detail(result, summary)
+        file_key = self._screenshot_file_key(result)
+        if file_key is None:
+            return ToolDetail(
+                type=DisplayType.MD,
+                data=FileContent(
+                    file_name=f"{self.name}.md",
+                    content=detail_content,
+                ),
+            )
+        return ToolDetailFactory.create_browser_detail(
+            BrowserContent(
+                url=url,
+                title=title,
+                file_key=file_key,
+                file_size=self._screenshot_file_size(result),
+                file_url=self._screenshot_file_url(result),
+                action=self._operation_name(),
+                summary=summary,
+                detail=detail_content,
+                page_title=string(page.get("title")).strip() or None,
+                target=target or None,
+                status=BrowserDetailStatus.SUCCEEDED if result.ok else BrowserDetailStatus.FAILED,
+            )
         )
-        return BrowserDetailBuilder.detail(
-            presentation,
-            file_key=self._screenshot_file_key(result),
-            file_size=self._screenshot_file_size(result),
-            file_url=self._screenshot_file_url(result),
+
+    def create_browser_error_detail(self, result: ToolResult) -> ToolDetail:
+        return self.create_browser_tool_detail(res
```

**File**: `backend/super-magic/app/tools/browser/debugging.py` (modified, +19/-0)
```diff
@@ -6,9 +6,16 @@
 
 from agentlang.context.tool_context import ToolContext
 from agentlang.tools.tool_result import ToolResult
+from app.core.entity.message.server_message import ToolDetail
 from app.service.browser import BrowserService
 from app.service.browser.browser_tool_result_builder import BrowserToolResultBuilder
 from app.tools.browser.base import BrowserToolBase
+from app.tools.browser.presentation.debugging import (
+    add_init_script_detail,
+    evaluate_detail,
+    read_console_detail,
+    read_network_detail,
+)
 from app.tools.core import BaseToolParams, tool
 
 
@@ -45,6 +52,9 @@ class BrowserEvaluate(BrowserToolBase[BrowserEvaluateParams]):
     name = "browser_evaluate"
     operation_key = "browser.evaluate"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, evaluate_detail(result))
+
     async def execute(self, tool_context: ToolContext, params: BrowserEvaluateParams) -> ToolResult:
         async def operation() -> ToolResult:
             value = await BrowserService(tool_context).evaluate(
@@ -66,6 +76,9 @@ class BrowserAddInitScript(BrowserToolBase[BrowserAddInitScriptParams]):
     name = "browser_add_init_script"
     operation_key = "browser.add_init_script"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, add_init_script_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserAddInitScriptParams) -> ToolResult:
         async def operation() -> ToolResult:
             await BrowserService(tool_context).add_init_script(params.page_id, params.source, params.session_id)
@@ -89,6 +102,9 @@ class BrowserReadConsole(BrowserToolBase[BrowserDiagnosticParams]):
     name = "browser_read_console"
     operation_key = "browser.read_console"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, read_console_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserDiagnosticParams) -> ToolResult:
         async def operation() -> ToolResult:
             batch = await BrowserService(tool_context).read_console(
@@ -110,6 +126,9 @@ class BrowserReadNetwork(BrowserToolBase[BrowserDiagnosticParams]):
     name = "browser_read_network"
     operation_key = "browser.read_network"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, read_network_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserDiagnosticParams) -> ToolResult:
         async def operation() -> ToolResult:
             batch = await BrowserService(tool_context).read_network(
```

---

### Incident Patch 2: `de3cf5b9` (2026-08-12)
**Commit Message**: Merge pull request 'fix(video): resolve source type using business token type parameter' (#723) from lizengquan/magic:api-video into iteration/IT20260812028

**File**: `backend/magic-service/app/Application/ModelGateway/Service/VideoOperationAppService.php` (modified, +10/-4)
```diff
@@ -20,6 +20,7 @@
 use App\Domain\ModelGateway\Entity\AccessTokenEntity;
 use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
 use App\Domain\ModelGateway\Entity\Dto\VideoOperationResponseDTO;
+use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
 use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
 use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
 use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
@@ -676,7 +677,7 @@ private function dispatchVideoGeneratedEvent(
         $event->setTopicId($operation->getTopicId());
         $event->setTaskId($operation->getTaskId());
         $event->setSourceId($operation->getSourceId());
-        $event->setSourceType($this->resolveSourceType($accessTokenEntity, $operation));
+        $event->setSourceType($this->resolveSourceType($accessTokenEntity, $operation, $requestBusinessParams));
         $event->setCreatedAt(new DateTime());
         $event->setVideoReferenceMaterial($referenceMaterial);
         $event->setBusinessParams($businessParams);
@@ -1153,9 +1154,14 @@ private function probeVideoFromFile(VideoQueueOperationEntity $operation, string
         }
     }
 
-    private function resolveSourceType(?AccessTokenEntity $accessTokenEntity, VideoQueueOperationEntity $operation): ImageGenerateSourceEnum
-    {
-        if ($accessTokenEntity?->getType()->isUser()) {
+    private function resolveSourceType(
+        ?AccessTokenEntity $accessTokenEntity,
+        VideoQueueOperationEntity $operation,
+        array $requestBusinessParams = []
+    ): ImageGenerateSourceEnum {
+        $accessTokenType = $accessTokenEntity?->getType()->value
+            ?? (string) ($requestBusinessParams['access_token_type'] ?? '');
+        if ($accessTokenType === AccessTokenType::User->value) {
             return ImageGenerateSourceEnum::API_PLATFORM;
         }
 
```

**File**: `backend/magic-service/test/Cases/Application/ModelGateway/Service/VideoOperationAppServiceTest.php` (modified, +38/-0)
```diff
@@ -18,6 +18,7 @@
 use App\Application\ModelGateway\Service\VideoOperationAppService;
 use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
 use App\Domain\File\Service\FileDomainService;
+use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
 use App\Domain\ModelGateway\Contract\QueueOperationExecutorInterface;
 use App\Domain\ModelGateway\Contract\VideoMediaProbeInterface;
 use App\Domain\ModelGateway\Entity\AccessTokenEntity;
@@ -2088,6 +2089,43 @@ public function testManagedPollKeepsOperationRunningWhenProviderQueryThrows(): v
         }
     }
 
+    public function testManagedPollUsesBusinessTokenTypeForApiPlatformSource(): void
+    {
+        $operation = $this->createOperation('op-managed-api-platform-source');
+        $operation->setStatus(VideoOperationStatus::PROVIDER_RUNNING);
+        $operation->setProviderTaskId('provider-task-api-platform-source');
+        $operation->setStartedAt(date(DATE_ATOM));
+
+        $operationRepository = new InMemoryVideoQueueOperationRepository();
+        $operationRepository->operations[$operation->getId()] = $operation;
+        $service = $this->createVideoOperationAppService(
+            $operationRepository,
+            new RecordingQueueOperationExecutor(
+                submitResult: 'unused',
+                queryResult: [
+                    'status' => 'succeeded',
+                    'output' => [
+                        'video_url' => 'https://example.com/api-platform-source.mp4',
+                    ],
+                ],
+            ),
+        );
+
+        $isDone = $service->pollOperationById($operation->getId(), [
+            'organization_id' => 'org-test',
+            'access_token_type' => AccessTokenType::User->value,
+        ]);
+
+        $this->assertTrue($isDone);
+        $videoGeneratedEvents = array_values(array_filter(
+            $this->eventDispatcher->events,
+            static fn (object $event): bool => $event instanceof VideoGeneratedEvent
+        ));
+        $this->assertCount(1, $videoGeneratedEvents);
+        $event = $videoGeneratedEvents[0];
+        $this->assertSame(ImageGenerateSourceEnum::API_PLATFORM, $event->getSourceType());
+    }
+
     public function testGetOperationRejectsFullProviderTaskIdFallbackWhenStoredOperationIsMissing(): void
     {
         $dataIsolation = $this->createDataIsolation();
```

---

### Incident Patch 3: `dcda3ef3` (2026-08-12)
**Commit Message**: Merge branch 'hotfix/magic-web-0811' into iteration/IT20260812028

**File**: `frontend/magic-web/src/assets/locales/en_US/crew/market.json` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 	"aiSearch": "Search",
 	"aiSearchPlaceholder": "Enter keywords or describe your needs to get the digital employee you want",
 	"back": "Back",
+	"backToTop": "Back to top",
 	"categories": {
 		"adminOps": "Admin & Ops",
 		"allCrew": "All Crew",
```

**File**: `frontend/magic-web/src/assets/locales/zh_CN/crew/market.json` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 	"aiSearch": "搜索",
 	"aiSearchPlaceholder": "输入关键词或描述您的需求，获取所需的数字员工",
 	"back": "返回",
+	"backToTop": "回到顶部",
 	"categories": {
 		"adminOps": "行政运营",
 		"allCrew": "全部",
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/components/MarketBackToTopButton.tsx` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import { useEffect, useState, type RefObject } from "react"
+import { ArrowUp } from "lucide-react"
+import { useTranslation } from "react-i18next"
+import { Button } from "@/components/shadcn-ui/button"
+import { cn } from "@/lib/utils"
+
+const BACK_TO_TOP_SCROLL_THRESHOLD = 320
+
+interface MarketBackToTopButtonProps {
+	viewportRef: RefObject<HTMLDivElement | null>
+	testId: string
+}
+
+function MarketBackToTopButton({ viewportRef, testId }: MarketBackToTopButtonProps) {
+	const { t } = useTranslation("crew/market")
+	const [isVisible, setIsVisible] = useState(false)
+
+	useEffect(() => {
+		const viewport = viewportRef.current
+		if (!viewport) return
+
+		const updateVisibility = () => {
+			setIsVisible(viewport.scrollTop > BACK_TO_TOP_SCROLL_THRESHOLD)
+		}
+
+		updateVisibility()
+		viewport.addEventListener("scroll", updateVisibility, { passive: true })
+		return () => viewport.removeEventListener("scroll", updateVisibility)
+	}, [viewportRef])
+
+	function handleBackToTop() {
+		viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" })
+	}
+
+	const label = t("backToTop")
+
+	return (
+		<Button
+			type="button"
+			size="icon"
+			className={cn(
+				"absolute bottom-6 right-6 z-[60] size-11 rounded-full shadow-lg",
+				"transition-[opacity,transform] duration-150 ease-out active:scale-[0.96]",
+				isVisible
+					? "translate-y-0 opacity-100"
+					: "pointer-events-none translate-y-2 opacity-0",
+			)}
+			aria-label={label}
+			aria-hidden={!isVisible}
+			tabIndex={isVisible ? 0 : -1}
+			title={label}
+			data-testid={testId}
+			onClick={handleBackToTop}
+		>
+			<ArrowUp className="size-5" aria-hidden />
+		</Button>
+	)
+}
+
+export default MarketBackToTopButton
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/components/MarketStickyHeader.tsx` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import { useEffect, useRef, useState, type HTMLAttributes, type RefObject } from "react"
+import { cn } from "@/lib/utils"
+
+interface MarketStickyHeaderProps extends HTMLAttributes<HTMLDivElement> {
+	scrollViewportRef?: RefObject<HTMLDivElement | null>
+}
+
+function MarketStickyHeader({ className, scrollViewportRef, ...props }: MarketStickyHeaderProps) {
+	const headerRef = useRef<HTMLDivElement>(null)
+	const [isStuck, setIsStuck] = useState(false)
+
+	useEffect(() => {
+		const viewport = scrollViewportRef?.current
+		const header = headerRef.current
+		if (!viewport || !header) return
+
+		const updateStickyState = () => {
+			const viewportTop = viewport.getBoundingClientRect().top
+			const headerTop = header.getBoundingClientRect().top
+			setIsStuck(viewport.scrollTop > 0 && headerTop <= viewportTop + 1)
+		}
+
+		updateStickyState()
+		viewport.addEventListener("scroll", updateStickyState, { passive: true })
+		return () => viewport.removeEventListener("scroll", updateStickyState)
+	}, [scrollViewportRef])
+
+	return (
+		<div
+			ref={headerRef}
+			className={cn(
+				"sticky top-0 z-50 flex min-w-0 flex-col bg-background",
+				"after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-8 after:h-8 after:transition-opacity after:duration-150",
+				"after:bg-gradient-to-b after:from-background after:via-background/90 after:to-transparent",
+				isStuck ? "after:opacity-100" : "after:opacity-0",
+				className,
+			)}
+			{...props}
+		/>
+	)
+}
+
+export default MarketStickyHeader
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/components/__tests__/MarketBackToTopButton.test.tsx` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { fireEvent, render, screen } from "@testing-library/react"
+import { describe, expect, it, vi } from "vitest"
+import MarketBackToTopButton from "../MarketBackToTopButton"
+
+vi.mock("react-i18next", () => ({
+	useTranslation: () => ({
+		t: (key: string) => (key === "backToTop" ? "Back to top" : key),
+	}),
+}))
+
+describe("MarketBackToTopButton", () => {
+	it("shows after the scroll threshold and scrolls the viewport to the top", () => {
+		const viewport = document.createElement("div")
+		const scrollTo = vi.fn()
+		viewport.scrollTo = scrollTo
+
+		render(
+			<MarketBackToTopButton
+				viewportRef={{ current: viewport }}
+				testId="market-back-to-top"
+			/>,
+		)
+
+		const button = screen.getByTestId("market-back-to-top")
+		expect(button).toHaveClass("pointer-events-none", "opacity-0")
+		expect(button).toHaveAttribute("aria-hidden", "true")
+
+		viewport.scrollTop = 321
+		fireEvent.scroll(viewport)
+
+		expect(button).toHaveClass("translate-y-0", "opacity-100")
+		expect(button).toHaveAttribute("aria-hidden", "false")
+
+		fireEvent.click(button)
+
+		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" })
+	})
+})
```

---

### Incident Patch 4: `6d0b2dd4` (2026-08-12)
**Commit Message**: chore(magic-service): fix phpstan analyse issues and formatting

Correct base64 preg_replace null checks, narrow recycle bin hydrate models with instanceof, and apply pending test file formatting updates.

**File**: `backend/magic-service/app/Domain/Design/Factory/DesignVideoInputPayloadPreparer.php` (modified, +1/-1)
```diff
@@ -131,7 +131,7 @@ private static function normalizeImageInput(array $input, string $label): string
         if ($sourceType === 'base64') {
             $mimeType = strtolower(trim((string) ($input['mime_type'] ?? '')));
             $base64Data = preg_replace('/\s+/', '', trim((string) ($input['base64_data'] ?? '')));
-            if ($base64Data === false || $base64Data === '') {
+            if ($base64Data === null || $base64Data === '') {
                 ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.invalid', ['label' => $label . '.base64_data']);
             }
             $binaryData = base64_decode($base64Data, true);
```

**File**: `backend/magic-service/app/Domain/SuperMagic/Common/RecycleBin/Repository/Persistence/RecycleBinRepository.php` (modified, +3/-1)
```diff
@@ -169,7 +169,9 @@ public function getRecycleBinList(
 
         $entities = [];
         foreach ($models as $model) {
-            /** @var RecycleBinModel $model */
+            if (! $model instanceof RecycleBinModel) {
+                continue;
+            }
             $entities[] = $this->modelToEntity($model);
         }
 
```

**File**: `backend/magic-service/test/Cases/Application/SuperAgent/Service/FileManagementAppServiceTest.php` (modified, +1/-2)
```diff
@@ -536,8 +536,7 @@ public function testGetFileUrlsAllowsUserSpaceFileWithoutProjectLookup(): void
             public function __construct(
                 private readonly TranslatorInterface $translator,
                 private readonly ConfigInterface $config,
-            )
-            {
+            ) {
             }
 
             public function get(string $id): mixed
```

**File**: `backend/magic-service/test/Cases/Unit/SuperMagic/FileDownloadUrlHelperTest.php` (modified, +3/-0)
```diff
@@ -1,6 +1,9 @@
 <?php
 
 declare(strict_types=1);
+/**
+ * Copyright (c) The Magic , Distributed under the software license
+ */
 
 namespace HyperfTest\Cases\Unit\SuperMagic;
 
```

---

### Incident Patch 5: `3e1180ed` (2026-08-11)
**Commit Message**: fix: add get_head_object_by_credential_success log

**File**: `backend/magic-service/app/Domain/File/Repository/Persistence/CloudFileRepository.php` (modified, +3/-0)
```diff
@@ -570,6 +570,7 @@ public function getHeadObjectByCredential(
                 'organization_code' => $organizationCode,
                 'object_key' => $objectKey,
                 'bucket_type' => $bucketType->value,
+                'content_type' => $result['content_type'] ?? null,
                 'content_length' => $result['content_length'] ?? null,
                 'last_modified' => $result['last_modified'] ?? null,
             ]);
@@ -628,6 +629,7 @@ public function setHeadObjectByCredential(
                 'organization_code' => $organizationCode,
                 'object_key' => $objectKey,
                 'bucket_type' => $bucketType->value,
+                'content_type' => $metadata['content_type'] ?? null,
                 'metadata_count' => count($metadata),
             ]);
         } catch (Throwable $exception) {
@@ -704,6 +706,7 @@ public function createObjectByCredential(
                 'object_key' => $objectKey,
                 'object_type' => $isFolder ? 'folder' : 'file',
                 'bucket_type' => $bucketType->value,
+                'content_type' => $createOptions['content_type'] ?? null,
                 'content_length' => strlen($createOptions['content'] ?? ''),
             ]);
         } catch (Throwable $exception) {
```

---

### Incident Patch 6: `966edcc2` (2026-08-11)
**Commit Message**: fix: sync MagicFS object content type metadata

**File**: `backend/magic-service/.gitignore` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ scripts/
 storage/files/test001
 /CLAUDE.md
 /AGENTS.md
-/agents/skills/
+.agents
 .cursor/
 .github
 /docs/
```

---

### Incident Patch 7: `40ca4dc4` (2026-08-11)
**Commit Message**: fix: sync MagicFS object content type metadata

**File**: `backend/magic-service/.php-cs-fixer.php` (modified, +0/-2)
```diff
@@ -99,7 +99,5 @@
             ->exclude('runtime')
             ->exclude('vendor')
             ->in(__DIR__)
-            # cs-fix 企业包,同时排除包的 vendor 目录
-            ->append(Finder::create()->in(__DIR__.'/vendor/dtyq/super-magic-module')->exclude('vendor'))
     )
     ->setUsingCache(false);
```

**File**: `backend/magic-service/app/Domain/SuperMagic/File/Service/MagicFSFileDomainService.php` (modified, +40/-1)
```diff
@@ -19,6 +19,7 @@
 use App\ErrorCode\SuperAgentErrorCode;
 use App\Infrastructure\Core\Exception\ExceptionBuilder;
 use App\Infrastructure\Core\ValueObject\StorageBucketType;
+use App\Infrastructure\SuperMagic\Utils\ContentTypeUtil;
 use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
 use App\Infrastructure\SuperMagic\Utils\WorkFileUtil;
 use App\Infrastructure\Util\IdGenerator\IdGenerator;
@@ -312,13 +313,20 @@ public function createFile(string $name, string $parentId, bool $isDirectory, ?s
                 // 使用 workDir 作为 prefix（用于 STS 临时凭证的权限范围）
                 $prefix = WorkDirectoryUtil::getPrefix($workDir);
 
+                $options = [];
+                $contentType = ContentTypeUtil::getMappedContentType($name);
+                if ($contentType !== null) {
+                    $options['content_type'] = $contentType;
+                }
+
                 // 在对象存储上创建空文件
                 $this->cloudFileRepository->createFileByCredential(
                     $prefix,
                     $organizationCode,
                     $s3Key,
                     '',  // 空内容
-                    StorageBucketType::SandBox
+                    StorageBucketType::SandBox,
+                    $options
                 );
             } catch (Throwable $e) {
                 // 对象存储创建失败，抛出异常，阻止数据库保存
@@ -386,6 +394,7 @@ public function determineIsHidden(string $fileName, ?int $parentId, int $project
     public function updateFile(string $fileId, array $updates): TaskFileEntity
     {
         $file = $this->getFileById($fileId);
+        $originalExtension = strtolower($file->getFileExtension());
 
         $oldParentId = $file->getParentId();
         $newParentIdInt = null;
@@ -565,6 +574,17 @@ public function updateFile(string $fileId, array $updates): TaskFileEntity
             }
         }
 
+        $extensionChanged = isset($updateData['file_extension'])
+            && $originalExtension !== strtolower($updatedFile->getFileExtension());
+        if ($extensionChanged) {
+            $contentType = ContentTypeUtil::getMappedContentType($updatedFile->getFileName());
+            if ($contentType !== null) {
+                $this->tryUpdateObjectMetadata($updatedFile, [
+                    'content_type' => $contentType,
+                ]);
+            }
+        }
+
         return $updatedFile;
     }
 
@@ -908,6 +928,25 @@ protected function getAllChildrenByProjectIdAndParentId(
         );
     }
 
+    private function tryUpdateObjectMetadata(TaskFileEntity $file, array $metadata): void
+    {
+        try {
+            $this->cloudFileRepository->setHeadObjectByCredential(
+                $file->getOrganizationCode(),
+                $file->getFileKey(),
+                $metadata,
+                StorageBucketType::SandBox
+            );
+        } catch (Throwable $throwable) {
+            $this->logger->warning('magicfs_update_object_metadata_failed', [
+                'file_id' => $file->getFileId(),
+                'file_name' => $file->getFileName(),
+                'metadata' => $metadata,
+                'error' => $throwable->getMessage(),
+            ]);
+        }
+    }
+
     /**
      * @param int[] $fileIds
      * @return TaskFileEntity[]
```

**File**: `backend/magic-service/app/Infrastructure/SuperMagic/Utils/ContentTypeUtil.php` (modified, +18/-3)
```diff
@@ -125,6 +125,23 @@ class ContentTypeUtil
         'mp3', 'wav', 'ogg', 'm4a',
     ];
 
+    /**
+     * Get mapped Content-Type for a file based on its extension.
+     *
+     * Returns null when the extension is empty or not explicitly mapped,
+     * allowing callers to preserve the object storage provider's default.
+     */
+    public static function getMappedContentType(string $filename): ?string
+    {
+        $extension = strtolower((string) pathinfo($filename, PATHINFO_EXTENSION));
+
+        if ($extension === '') {
+            return null;
+        }
+
+        return self::$contentTypeMap[$extension] ?? null;
+    }
+
     /**
      * Get Content-Type for a file based on its extension.
      *
@@ -133,9 +150,7 @@ class ContentTypeUtil
      */
     public static function getContentType(string $filename): string
     {
-        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
-
-        return self::$contentTypeMap[$extension] ?? 'application/octet-stream';
+        return self::getMappedContentType($filename) ?? 'application/octet-stream';
     }
 
     /**
```

---

### Incident Patch 8: `0f9effd0` (2026-08-11)
**Commit Message**: fix: preserve inline mode for preview file URLs

**File**: `backend/magic-service/app/Infrastructure/SuperMagic/Utils/FileDownloadUrlHelper.php` (modified, +2/-0)
```diff
@@ -42,6 +42,8 @@ public static function prepareFileUrlOptions(
         switch (strtolower($downloadMode)) {
             case 'preview':
             case 'inline':
+                $urlOptions['download'] = false;
+                // no break
             case 'normal_download':
                 // Preview mode: inline if previewable, otherwise force download
                 if (ContentTypeUtil::isPreviewable($filename)) {
```

**File**: `backend/magic-service/test/Cases/Unit/SuperMagic/FileDownloadUrlHelperTest.php` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+<?php
+
+declare(strict_types=1);
+
+namespace HyperfTest\Cases\Unit\SuperMagic;
+
+use App\Infrastructure\SuperMagic\Utils\FileDownloadUrlHelper;
+use PHPUnit\Framework\TestCase;
+
+/**
+ * @internal
+ */
+class FileDownloadUrlHelperTest extends TestCase
+{
+    public function testPreviewUrlOptionsDisableDownload(): void
+    {
+        $options = FileDownloadUrlHelper::prepareFileUrlOptions('text.css', 'preview');
+
+        $this->assertFalse($options['download']);
+    }
+
+    public function testInlineUrlOptionsDisableDownload(): void
+    {
+        $options = FileDownloadUrlHelper::prepareFileUrlOptions('text.css', 'inline');
+
+        $this->assertFalse($options['download']);
+    }
+
+    public function testDownloadUrlOptionsDoNotSpecifyDownloadFlag(): void
+    {
+        $options = FileDownloadUrlHelper::prepareFileUrlOptions('text.css', 'download');
+
+        $this->assertArrayNotHasKey('download', $options);
+    }
+}
```

---

### Incident Patch 9: `259da394` (2026-08-11)
**Commit Message**: fix(super-magic): fix file version

**File**: `backend/super-magic-module/src/Domain/SuperAgent/Service/TaskFileDomainService.php` (modified, +1/-4)
```diff
@@ -3593,10 +3593,7 @@ public function replaceFile(
 
         $updatedFile = $this->taskFileRepository->updateById($originalFile);
 
-        $parentId = $originalFile->getParentId();
-        if ($parentId !== null) {
-            $this->incrementVersionChain((string) $parentId);
-        }
+        $this->incrementVersionChain((string) $fileId);
 
         return $updatedFile;
     }
```

---

### Incident Patch 10: `862e51de` (2026-08-11)
**Commit Message**: 🐛 fix: align AI inspector overlay in mobile preview

**File**: `frontend/magic-web/src/components/business/ElementInspector/ElementInspectorOverlay.tsx` (modified, +35/-159)
```diff
@@ -15,9 +15,12 @@ import type { JSONContent } from "@tiptap/react"
 import { useTranslation } from "react-i18next"
 import { Crosshair, X, Copy, MousePointer, Send } from "lucide-react"
 import { Button } from "@/components/shadcn-ui/button"
-import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
-import { MentionItemType } from "@/components/business/MentionPanel/types"
 import type { InspectedElementInfo, InspectedElementRect } from "./types"
+import { getInspectorOverlayScale, toInspectorOverlayRect } from "./geometry"
+import { buildAgentPromptContent } from "./agentPrompt"
+import { formatElementSize, getShortSelector } from "./format"
+
+export { buildAgentPromptContent } from "./agentPrompt"
 
 // ─── Props ───────────────────────────────────────────────────────────────────
 
@@ -44,19 +47,6 @@ interface ElementInspectorOverlayProps {
 	scaleRatio?: number
 }
 
-// ─── Helpers ─────────────────────────────────────────────────────────────────
-
-function getShortSelector(info: InspectedElementInfo): string {
-	let s = info.tagName
-	if (info.id) s += `#${info.id}`
-	if (info.classList.length > 0) s += `.${info.classList.slice(0, 2).join(".")}`
-	return s
-}
-
-function formatSize(w: number, h: number): string {
-	return `${Math.round(w)} × ${Math.round(h)}`
-}
-
 // ─── Component ───────────────────────────────────────────────────────────────
 
 export function ElementInspectorOverlay({
@@ -108,6 +98,20 @@ export function ElementInspectorOverlay({
 		}
 	}, [iframeRef, active, hoveredElement])
 
+	const getOverlayGeometry = useCallback(() => {
+		const iframe = iframeRef.current
+		const parent = overlayRef.current?.parentElement
+		if (!iframe || !parent) return null
+
+		return {
+			iframeRect: iframe.getBoundingClientRect(),
+			iframeSize: { width: iframe.clientWidth, height: iframe.clientHeight },
+			containerRect: parent.getBoundingClientRect(),
+			containerSize: { width: parent.clientWidth, height: parent.clientHeight },
+			fallbackScale: scaleRatio,
+		}
+	}, [iframeRef, scaleRatio])
+
 	/**
 	 * Convert an iframe-viewport-relative rect to overlay-relative coordinates.
 	 * Uses live DOM measurements to handle:
@@ -116,36 +120,17 @@ export function ElementInspectorOverlay({
 	 */
 	const toOverlayRect = useCallback(
 		(rect: InspectedElementRect) => {
-			const iframe = iframeRef.current
-			const parent = overlayRef.current?.parentElement
-			if (!iframe || !parent) return null
-			const parentRect = parent.getBoundingClientRect()
-			const ifRect = iframe.getBoundingClientRect()
-			// Auto-detect effective scale from visual vs layout dimensions
-			const effectiveScale =
-				scaleRatio !== 1
-					? scaleRatio
-					: iframe.clientWidth > 0
-						? ifRect.width / iframe.clientWidth
-						: 1
-			return {
-				left: ifRect.left - parentRect.left + rect.left * effectiveScale,
-				top: ifRect.top - parentRect.top + rect.top * effectiveScale,
-				width: rect.width * effectiveScale,
-				height: rect.height * effectiveScale,
-			}
+			const geometry = getOverlayGeometry()
+			return geometry ? toInspectorOverlayRect(rect, geometry) : null
 		},
-		[iframeRef, scaleRatio],
+		[getOverlayGeometry],
 	)
 
-	/** Get the current effective scale ratio (auto-detected or from prop) */
-	const getEffectiveScale = useCallback(() => {
-		const iframe = iframeRef.current
-		if (!iframe) return scaleRatio
-		const ifRect = iframe.getBoundingClientRect()
-		if (scaleRatio !== 1) return scaleRatio
-		return iframe.clientWidth > 0 ? ifRect.width / iframe.clientWidth : 1
-	}, [iframeRef, scaleRatio])
+	/** Get the iframe scale relative to the overlay's coordinate system. */
+	const getOverlayScale = useCallback(() => {
+		const geometry = getOverlayGeometry()
+		return geometry ? getInspectorOverlayScale(geometry) : { x: scaleRatio, y: scaleRatio }
+	}, [getOverlayGeometry, scaleRatio])
 
 	const hoverBox = useMemo(
 		() => (hoveredElement ? toOverlayRect(ho
```

**File**: `frontend/magic-web/src/components/business/ElementInspector/__tests__/geometry.test.ts` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+import { describe, expect, it } from "vitest"
+
+import { toInspectorOverlayRect } from "../geometry"
+
+describe("ElementInspector overlay geometry", () => {
+	it("does not apply the phone-shell scale twice", () => {
+		const scale = 0.8738636
+		const rect = toInspectorOverlayRect(
+			{ top: 339.5, left: 40, width: 321, height: 43 },
+			{
+				iframeRect: {
+					top: 192.9273,
+					left: 648.181,
+					width: 350.4193115234375,
+					height: 686.8568115234375,
+				},
+				iframeSize: { width: 401, height: 786 },
+				containerRect: {
+					top: 192.9273,
+					left: 648.181,
+					width: 350.4193115234375,
+					height: 686.8568115234375,
+				},
+				containerSize: { width: 401, height: 786 },
+				fallbackScale: scale,
+			},
+		)
+
+		expect(rect).toEqual({ top: 339.5, left: 40, width: 321, height: 43 })
+	})
+
+	it("applies an iframe-only scale in overlay coordinates", () => {
+		const rect = toInspectorOverlayRect(
+			{ top: 120, left: 40, width: 320, height: 44 },
+			{
+				iframeRect: { top: 20, left: 30, width: 200, height: 400 },
+				iframeSize: { width: 400, height: 800 },
+				containerRect: { top: 0, left: 0, width: 500, height: 900 },
+				containerSize: { width: 500, height: 900 },
+				fallbackScale: 1,
+			},
+		)
+
+		expect(rect).toEqual({ top: 80, left: 50, width: 160, height: 22 })
+	})
+
+	it("converts the iframe offset into the scaled container coordinates", () => {
+		const rect = toInspectorOverlayRect(
+			{ top: 60, left: 40, width: 100, height: 20 },
+			{
+				iframeRect: { top: 120, left: 130, width: 200, height: 400 },
+				iframeSize: { width: 400, height: 800 },
+				containerRect: { top: 100, left: 100, width: 250, height: 450 },
+				containerSize: { width: 500, height: 900 },
+				fallbackScale: 1,
+			},
+		)
+
+		expect(rect).toEqual({ top: 100, left: 100, width: 100, height: 20 })
+	})
+
+	it("uses the fallback scale when layout dimensions are unavailable", () => {
+		const rect = toInspectorOverlayRect(
+			{ top: 20, left: 10, width: 100, height: 40 },
+			{
+				iframeRect: { top: 30, left: 40, width: 0, height: 0 },
+				iframeSize: { width: 0, height: 0 },
+				containerRect: { top: 10, left: 10, width: 0, height: 0 },
+				containerSize: { width: 0, height: 0 },
+				fallbackScale: 0.75,
+			},
+		)
+
+		expect(rect).toEqual({ top: 35, left: 37.5, width: 75, height: 30 })
+	})
+})
```

**File**: `frontend/magic-web/src/components/business/ElementInspector/agentPrompt.ts` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+import type { JSONContent } from "@tiptap/react"
+
+import { MentionItemType } from "@/components/business/MentionPanel/types"
+import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
+import type { InspectedElementInfo } from "./types"
+
+/** Build the structured inspector context inserted into the agent input. */
+export function buildAgentPromptContent(
+	info: InspectedElementInfo,
+	title: string,
+	fileInfo?: { fileId: string; fileName: string; filePath: string },
+): JSONContent {
+	const paragraphs: JSONContent[] = []
+	const fileMention = fileInfo
+		? {
+				type: MentionItemType.PROJECT_FILE,
+				data: {
+					file_id: fileInfo.fileId,
+					file_name: fileInfo.fileName,
+					file_path: fileInfo.filePath,
+					file_extension: fileInfo.fileName.includes(".")
+						? (fileInfo.fileName.split(".").pop() ?? "")
+						: "",
+				},
+			}
+		: null
+
+	const keyStyleProps = [
+		"display",
+		"position",
+		"width",
+		"height",
+		"color",
+		"backgroundColor",
+		"fontSize",
+		"fontFamily",
+		"margin",
+		"padding",
+		"border",
+		"borderRadius",
+		"flexDirection",
+		"alignItems",
+		"justifyContent",
+		"gap",
+		"overflow",
+		"zIndex",
+	] as const
+	const styleLines = keyStyleProps.flatMap((prop) => {
+		const value = info.computedStyles[prop as keyof typeof info.computedStyles]
+		if (
+			value &&
+			value !== "none" &&
+			value !== "normal" &&
+			value !== "auto" &&
+			value !== "0px"
+		) {
+			return [`${prop}: ${value}`]
+		}
+		return []
+	})
+
+	const computedStyles: Record<string, string> = {}
+	for (const line of styleLines) {
+		const separatorIndex = line.indexOf(": ")
+		if (separatorIndex > 0) {
+			computedStyles[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 2)
+		}
+	}
+	const textPreview = info.textContent
+		? info.textContent.length > 60
+			? `${info.textContent.slice(0, 60)}…`
+			: info.textContent
+		: ""
+
+	paragraphs.push({
+		type: "paragraph",
+		content: [
+			{
+				type: INSPECTOR_DETAIL_TYPE,
+				attrs: {
+					title,
+					selector: info.selector,
+					tagName: info.tagName,
+					size: `${Math.round(info.rect.width)} × ${Math.round(info.rect.height)} px`,
+					computedStyles: JSON.stringify(computedStyles),
+					styleCount: styleLines.length,
+					textContent: textPreview,
+					elementAttributes: JSON.stringify(info.attributes ?? {}),
+					resource: info.resource ?? "",
+					domContext: JSON.stringify(info.domContext ?? {}),
+					elementHtml: info.elementHtml ?? "",
+					selectorMatchCount: info.selectorMatchCount ?? -1,
+					fileMention,
+				},
+			},
+		],
+	})
+
+	return { type: "doc", content: paragraphs }
+}
```

**File**: `frontend/magic-web/src/components/business/ElementInspector/format.ts` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+import type { InspectedElementInfo } from "./types"
+
+export function getShortSelector(info: InspectedElementInfo): string {
+	let selector = info.tagName
+	if (info.id) selector += `#${info.id}`
+	if (info.classList.length > 0) {
+		selector += `.${info.classList.slice(0, 2).join(".")}`
+	}
+	return selector
+}
+
+export function formatElementSize(width: number, height: number): string {
+	return `${Math.round(width)} × ${Math.round(height)}`
+}
```

**File**: `frontend/magic-web/src/components/business/ElementInspector/geometry.ts` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+import type { InspectedElementRect } from "./types"
+
+interface RectLike {
+	top: number
+	left: number
+	width: number
+	height: number
+}
+
+interface SizeLike {
+	width: number
+	height: number
+}
+
+interface InspectorOverlayGeometry {
+	iframeRect: RectLike
+	iframeSize: SizeLike
+	containerRect: RectLike
+	containerSize: SizeLike
+	fallbackScale: number
+}
+
+interface InspectorOverlayScale {
+	x: number
+	y: number
+}
+
+function getAxisGeometry(
+	iframeVisualSize: number,
+	iframeLayoutSize: number,
+	containerVisualSize: number,
+	containerLayoutSize: number,
+	fallbackScale: number,
+) {
+	// The overlay is positioned inside the container's transformed coordinate system.
+	// Divide the iframe's visual scale by the container's visual scale so a shared
+	// phone-shell transform is not applied twice. Use the caller's scale only when
+	// layout measurements are unavailable during initial or detached rendering.
+	const containerScale =
+		containerVisualSize > 0 && containerLayoutSize > 0
+			? containerVisualSize / containerLayoutSize
+			: null
+	const iframeScale =
+		iframeVisualSize > 0 && iframeLayoutSize > 0 ? iframeVisualSize / iframeLayoutSize : null
+
+	return {
+		containerScale: containerScale ?? 1,
+		relativeScale:
+			containerScale !== null && iframeScale !== null
+				? iframeScale / containerScale
+				: fallbackScale,
+	}
+}
+
+function getOverlayAxes(geometry: InspectorOverlayGeometry) {
+	return {
+		horizontal: getAxisGeometry(
+			geometry.iframeRect.width,
+			geometry.iframeSize.width,
+			geometry.containerRect.width,
+			geometry.containerSize.width,
+			geometry.fallbackScale,
+		),
+		vertical: getAxisGeometry(
+			geometry.iframeRect.height,
+			geometry.iframeSize.height,
+			geometry.containerRect.height,
+			geometry.containerSize.height,
+			geometry.fallbackScale,
+		),
+	}
+}
+
+export function getInspectorOverlayScale(
+	geometry: InspectorOverlayGeometry,
+): InspectorOverlayScale {
+	const { horizontal, vertical } = getOverlayAxes(geometry)
+
+	return { x: horizontal.relativeScale, y: vertical.relativeScale }
+}
+
+export function toInspectorOverlayRect(
+	rect: InspectedElementRect,
+	geometry: InspectorOverlayGeometry,
+): InspectedElementRect {
+	const { horizontal, vertical } = getOverlayAxes(geometry)
+
+	return {
+		left:
+			(geometry.iframeRect.left - geometry.containerRect.left) / horizontal.containerScale +
+			rect.left * horizontal.relativeScale,
+		top:
+			(geometry.iframeRect.top - geometry.containerRect.top) / vertical.containerScale +
+			rect.top * vertical.relativeScale,
+		width: rect.width * horizontal.relativeScale,
+		height: rect.height * vertical.relativeScale,
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #81** (closed): docs: localize Chinese README badge alt text (@MackDing)
- **PR #79** (closed): docs: add FAQ section for common questions (@meichuanyi)
- **PR #54** (2025-08-14): Simplify BUG template (@douyun-dtyq)
- **PR #33** (2025-05-30): docs: Guide users to configure LLMs via environment variables (@her-cat)
- **PR #27** (2025-05-25): docs(zh): fix document formatting and typography (@her-cat)
- **PR #22** (2025-05-20): fix: remove Access-Control-Allow-Credentials header for CORS security compliance (@JeaNile)
- **PR #21** (2025-05-19): Fix env typo (@assert6)
- **PR #19** (2025-05-19): Fix uploadFiles typo (@assert6)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

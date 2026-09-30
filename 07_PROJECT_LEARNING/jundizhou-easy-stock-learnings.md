# Forensic Learning Record (Deep Inspection): jundizhou/easy-stock

> **Canonical Artifact**: `07_PROJECT_LEARNING/jundizhou-easy-stock-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jundizhou/easy-stock](https://github.com/jundizhou/easy-stock))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:45:59.269Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jundizhou/easy-stock`
- **Description**: A股行情分析与AI智能投研智能体：股票分析、量化交易分析、盘后复盘桌面工作台——easy stock
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1109 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/cmd/server/main.go`
```
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"easy-stock/backend/internal/agent"
	"easy-stock/backend/internal/httpapi"
	"easy-stock/backend/internal/methodology"
	"easy-stock/backend/internal/runtimelog"
)

func main() {
	addr := os.Getenv("A_STOCK_ADDR")
	if addr == "" {
		addr = "127.0.0.1:20081"
	}
	reviewDBPath := os.Getenv("A_STOCK_REVIEW_DB")
	portfolioDBPath := os.Getenv("A_STOCK_PORTFOLIO_DB")
	stockResearchDBPath := os.Getenv("A_STOCK_RESEARCH_DB")
	marketEmotionDBPath := os.Getenv("A_STOCK_MARKET_EMOTION_DB")
	themeRadarDBPath := os.Getenv("A_STOCK_THEME_RADAR_DB")
	settingsPath := os.Getenv("A_STOCK_SETTINGS_PATH")
	masteryCacheDir := os.Getenv("A_STOCK_MASTERY_CACHE")
	dataDir := ""
	if configDir, err := os.UserConfigDir(); err == nil {
		dataDir = preferredDataDir(configDir)
	}
	if reviewDBPath == "" {
		reviewDBPath = dataPath(dataDir, "reviews.db")
	}
	if settingsPath == "" {
		settingsPath = dataPath(dataDir, "settings.json")
	}
	if portfolioDBPath == "" {
		portfolioDBPath = dataPath(dataDir, "portfolio-inspections.db")
	}
	if stockResearchDBPath == "" {
		stockResearchDBPath = dataPath(dataDir, "stock-research.db")
	}
	if marketEmotionDBPath == "" {
		marketEmotionDBPath = dataPath(dataDir, "market-emotion.db")
	}
	if themeRadarDBPath == "" {
		themeRadarDBPath = dataPath(dataDir, "theme-radar.db")
	}
	if masteryCacheDir == "" {
		masteryCacheDir = dataPath(dataDir, "trading-mastery")
	}
	logDirectory := os.Getenv("A_STOCK_LOG_DIR")
	if logDirectory == "" {
		logDirectory = dataPath(dataDir, "logs")
	}
	if logDirectory != "" {
		logger, closer, err := runtimelog.ConfigureStandard(logDirectory, "backend")
		if err != nil {
			log.Printf("runtime logging unavailable: %v", err)
		} else {
			defer closer.Close()
			logger.Printf("level=info event=runtime_start component=backend version=%q", runtimeVersion())
		}
	}
	hermesHome := os.Getenv("A_STOCK_HERMES_HOME")
	if hermesHome == "" {
		hermesHome = dataPath(dataDir, "hermes-home")
	}
	hermesWorkDir := os.Getenv("A_STOCK_HERMES_WORKDIR")
	if hermesWorkDir == "" {
		hermesWorkDir, _ = os.Getwd()
	}
	codexHome := os.Getenv("A_STOCK_CODEX_HOME")
	if codexHome == "" {
		codexHome = dataPath(dataDir, "codex-home")
	}
	codexRoot := os.Getenv("A_STOCK_CODEX_RUNTIME_ROOT")
	if codexRoot == "" {
		codexRoot = filepath.Join(filepath.Dir(resolveHermesRuntimeRoot()), "codex-runtime")
	}
	agentGateway := agent.NewService(agent.ServiceConfig{Hermes: agent.HermesConfig{
		RuntimeRoot: resolveHermesRuntimeRoot(),
		Home:        hermesHome,
		WorkDir:     hermesWorkDir,
		PythonPath:  os.Getenv("A_STOCK_HERMES_PYTHON"),
	}, Codex: agent.CodexConfig{RuntimeRoot: codexRoot, Home: codexHome, WorkDir: filepath.Join(codexHome, "workspace")}})
	masteryLibrary := methodology.NewLibrary(methodology.Config{
		CacheDir:   masteryCacheDir,
		HermesHome: hermesHome,
	})
	server := httpapi.NewServer(httpapi.Config{
		Token:                os.Getenv("A_STOCK_TOKEN"),
		ReviewDBPath:         reviewDBPath,
		PortfolioDBPath:      portfolioDBPath,
		StockResearchDBPath:  stockResearchDBPath,
		RemoteDailyReviewURL: os.Getenv("A_STOCK_DAILY_REVIEW_BASE_URL"),
		MarketEmotionDBPath:  marketEmotionDBPath,
		ThemeRadarDBPath:     themeRadarDBPath,
		DuanxianxiaBaseURL:   os.Getenv("A_STOCK_DUANXIANXIA_BASE_URL"),
		WeChatAPIURL:         os.Getenv("A_STOCK_WECHAT_API_URL"),
		SettingsPath:         settingsPath,
		AgentGateway:         agentGateway,
		MasteryLibrary:       masteryLibrary,
		Logger:               log.Default(),
		StrictPersistence:    true,
	})
	if err := server.StartupError(); err != nil {
		log.Fatalf("persistent data startup failed: %v", err)
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	go server.RunReviewScheduler(ctx)
	go server.RunRemoteDailyReviewScheduler(ctx)
	go server.RunMarketEmotionScheduler(ctx)
	go server.RunMasteryScheduler(ctx)
	httpServer := &http.Server{Addr: addr, Handler: server}
	go func() {
		<-ctx.Done()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		_ = httpServer.Shutdown(shutdownCtx)
	}()
	log.Printf("easy-stock data foundation listening on http://%s", addr)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
	if err := server.Close(); err != nil {
		log.Printf("close persistent data: %v", err)
	}
}

func runtimeVersion() string {
	if value := strings.TrimSpace(os.Getenv("A_STOCK_APP_VERSION")); value != "" {
		return value
	}
	return "development"
}

func preferredDataDir(configDir string) string {
	current := filepath.Join(configDir, "easy-stock")
	if isFile(filepath.Join(current, "settings.json")) {
		return current
	}
	legacy := filepath.Join(configDir, "a-stock-ai")
	if isFile(filepath.Join(legacy, "settings.json")) {
		return legacy
	}
	return current
}

func isFile(filePath string) bool {
	info, err := os.Stat(filePath)
	return err == nil && !info.IsDir()
}

func dataPath(dataDir, name string) string {
	if dataDir == "" {
		return ""
	}
	return filepath.Join(dataDir, name)
}

func resolveHermesRuntimeRoot() string {
	if configured := os.Getenv("A_STOCK_HERMES_RUNTIME_ROOT"); configured != "" {
		return configured
	}
	candidates := []string{}
	if executable, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Clean(filepath.Join(filepath.Dir(executable), "..", "hermes-runtime")))
	}
	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(cwd, "desktop", "resources", "hermes-runtime"),
			filepath.Join(cwd, "..", "desktop", "resources", "hermes-runtime"),
		)
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
	}
	return ""
}

```

### Core Architecture Module: `backend/internal/agent/codex.go`
```
package agent

import (
	"bufio"
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"easy-stock/backend/internal/appsettings"
)

//go:embed mcp_launcher.py
var mcpLauncher string

type CodexConfig struct {
	RuntimeRoot string
	Executable  string
	Home        string
	WorkDir     string
}

type CodexRuntime struct {
	config CodexConfig
	shared *HermesRuntime
}

func NewCodexRuntime(cfg CodexConfig, shared *HermesRuntime) *CodexRuntime {
	if cfg.Executable == "" && cfg.RuntimeRoot != "" {
		name := "codex"
		if runtime.GOOS == "windows" {
			name += ".exe"
		}
		cfg.Executable = filepath.Join(cfg.RuntimeRoot, "bin", name)
	}
	return &CodexRuntime{config: cfg, shared: shared}
}

func (r *CodexRuntime) Status() Status {
	r.shared.mu.RLock()
	cfg, configured, hasKey := r.shared.llm, r.shared.configured, r.shared.hasAPIKey
	r.shared.mu.RUnlock()
	status := Status{Runtime: Codex, APIKeyConfigured: hasKey}
	if data, err := os.ReadFile(filepath.Join(r.config.RuntimeRoot, "runtime-manifest.json")); err == nil {
		var manifest struct {
			Version string `json:"version"`
		}
		if json.Unmarshal(data, &manifest) == nil {
			status.Version = manifest.Version
		}
	}
	if !filepath.IsAbs(r.config.Executable) {
		status.Message = "Codex 包内运行时路径未配置"
		return status
	}
	info, err := os.Stat(r.config.Executable)
	if err != nil || info.IsDir() {
		status.Message = "Codex 运行时不可用，请检查安装包"
		return status
	}
	status.Available = true
	if !configured {
		status.Message = "请先配置模型连接"
		return status
	}
	if !SupportsResponses(cfg) {
		status.Message = ErrModelProtocolUnsupported.Error()
		return status
	}
	status.Configured = true
	return status
}

// Config projections contain no provider key. Secrets are supplied only in the
// child environment, which shell tools are explicitly forbidden to inherit.
func (r *CodexRuntime) renderConfiguration(options PromptOptions) (string, map[string]string, error) {
	r.shared.mu.RLock()
	cfg := r.shared.llm
	r.shared.mu.RUnlock()
	settings, err := r.shared.AgentSettings()
	if err != nil {
		return "", nil, err
	}
	key, err := r.shared.ModelAPIKey()
	if err != nil {
		return "", nil, err
	}
	env := map[string]string{"EASY_STOCK_MODEL_API_KEY": key}
	var b strings.Builder
	fmt.Fprintf(&b, "model = %s\nmodel_provider = \"easy-stock\"\nweb_search = \"disabled\"\ncheck_for_update_on_startup = false\ncli_auth_credentials_store = \"ephemeral\"\n", strconv.Quote(cfg.Model))
	effort := settings.ReasoningEffort
	// Native Responses toggles (e.g. MiniMax M3) use any non-none effort
	// to enable thinking. Keep the shared UI as a toggle, not fake levels.
	if effort == "enabled" && settings.Reasoning.Wire == "openai_responses" {
		effort = "medium"
	}
	if effort != "" && effort != "default" && effort != "enabled" {
		if !strings.Contains("|none|minimal|low|medium|high|xhigh|max|", "|"+effort+"|") {
			return "", nil, fmt.Errorf("Codex 不支持当前思考强度 %s，请调整共享模型设置", effort)
		}
		fmt.Fprintf(&b, "model_reasoning_effort = %s\n", strconv.Quote(effort))
	}
	fmt.Fprintf(&b, "[model_providers.easy-stock]\nname = \"easy-stock\"\nbase_url = %s\nwire_api = \"responses\"\nenv_key = \"EASY_STOCK_MODEL_API_KEY\"\nrequires_openai_auth = false\nsupports_websockets = false\nstream_idle_timeout_ms = %d\n", strconv.Quote(strings.TrimRight(cfg.BaseURL, "/")), appsettings.NormalizeLLMResponseTimeoutSeconds(cfg.ResponseTimeoutSeconds)*1000)
	b.WriteString("[skills]\nbundled = { enabled = false }\n[analytics]\nenabled = false\n[feedback]\nenabled = false\n[shell_environment_policy]\ninherit = \"core\"\nignore_default_excludes = false\nexclude = [\"*KEY*\", \"*TOKEN*\", \"*SECRET*\", \"*PASSWORD*\", \"*COOKIE*\"]\n[features]\nmulti_agent = false\nmemories = false\nshell_snapshot = false\ngoals = false\nsleep_tool = false\nhooks = false\nplugins = false\napps = false\nskill_mcp_dependency_install = false\n")
	if options.Sandbox || options.DisableTools {
		b.WriteString("shell_tool = false\nunified_exec = false\nview_image = false\n[tools]\nview_image = false\nexperimental_request_user_input = { enabled = false }\nupdate_plan = { enabled = false }\n")
	}
	if !options.Sandbox && !options.DisableTools {
		for i, server := range settings.MCPServers {
			if !server.Enabled {
				continue
			}
			fmt.Fprintf(&b, "[mcp_servers.%s]\nrequired = true\n", strconv.Quote(server.Name))
			if server.Transport == "stdio" || server.Transport == "sse" {
				variable := fmt.Sprintf("EASY_STOCK_MCP_%d", i)
				spec, _ := json.Marshal(server)
				env[variable] = string(spec)
				fmt.Fprintf(&b, "command = %s\nargs = %s\nenv_vars = %s\n", strconv.Quote(r.shared.pythonPath), tomlStrings([]string{"-c", mcpLauncher, variable}), tomlStrings([]string{variable}))
			} else {
				fmt.Fprintf(&b, "url = %s\n", strconv.Quote(server.URL))
				headers := map[string]string{}
				names := make([]string, 0, len(server.Headers))
				for name := range server.Headers {
					names = append(names, name)
				}
				sort.Strings(names)
				for _, name := range names {
					value := server.Headers[name]
					varName := fmt.Sprintf("EASY_STOCK_MCP_%d_%d", i, len(headers))
					headers[name], env[varName] = varName, value
				}
				if len(headers) > 0 {
					fmt.Fprintf(&b, "env_http_headers = %s\n", tomlMap(headers))
				}
			}
			fmt.Fprintf(&b, "supports_parallel_tool_calls = %t\n", server.SupportsParallelToolCall)
			if server.Timeout > 0 {
				fmt.Fprintf(&b, "tool_timeout_sec = %d\n", server.Timeout)
			}
			if server.ConnectTimeout > 0 {
				fmt.Fprintf(&b, "startup_timeout_sec = %d\n", server.ConnectTimeout)
			}
		}
	}
	return b.String(), env, nil
}

func tomlStrings(items []string) string {
	quoted := make([]string, len(items))
	for i, s := range items {
		quoted[i] = strconv.Quote(s)
	}
	return "[" + strings.Join(quoted, ", ") + "]"
}
func tomlMap(items map[string]string) string {
	keys := make([]string, 0, len(items))
	for key := range items {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, strconv.Quote(key)+" = "+strconv.Quote(items[key]))
	}
	return "{ " + strings.Join(parts, ", ") + " }"
}

func (r *CodexRuntime) SyncConfiguration() error {
	if r.config.Home == "" {
		return nil
	}
	content, _, err := r.renderConfiguration(PromptOptions{})
	if err != nil {
		return err
	}
	if err = os.MkdirAll(r.config.Home, 0700); err != nil {
		return err
	}
	return writeSecureFile(filepath.Join(r.config.Home, "config.toml"), []byte(content))
}

func (r *CodexRuntime) Start(ctx context.Context) (Process, error) {
	return r.start(ctx, PromptOptions{})
}

func (r *CodexRuntime) start(ctx context.Context, options PromptOptions) (Process, error) {
	status := r.Status()
	if !status.Available || !status.Configured {
		return nil, errors.New(status.Message)
	}
	if options.AutoApprove && !options.Sandbox {
		return nil, errors.New("自动授权只能在隔离任务中启用")
	}
	if options.DisableTools && len(options.Toolsets) > 0 {
		return nil, errors.New("禁用工具时不能指定工具集")
	}
	if _, err := cleanPromptToolsets(options.Toolsets); err != nil {
		return nil, err
	}
	content, secrets, err := r.renderConfiguration(options)
	if err != nil {
		return nil, err
	}
	// A configuration generation has its own native history. Existing threads
	// never observe another generation's model/MCP/skill settings mid-turn.
	skillDigest, err := r.skillDigest()
	if err != nil {
		return nil, err
	}
	secretBytes, _ := json.Marshal(secrets)
	digest := sha256.Sum256(append([]byte(content+skillDigest), secretBytes...))
	home := filepath.Join(r.config.Home, "generations", hex.EncodeToString(digest[:12]))
	cleanup := func() {}
	if options.Sandbox {
		home, err = os.MkdirTemp("", "easy-stock-codex-task-")
		if err != nil {
			return nil, err
		}
		cleanup = func() { _ = os.RemoveAll(home) }
	}
	if err = os.MkdirAll(home, 0700); err != nil {
		cleanup()
		return nil, e
```

### Core Architecture Module: `backend/internal/agent/config_transaction.go`
```
package agent

import (
	"errors"
	"os"
	"path/filepath"

	"easy-stock/backend/internal/appsettings"
)

// PrepareSettings holds the runtime selection lock until the settings store
// commits. Failed projections or persistence restore both files and memory.
// On restart, settings.json remains authoritative for the active profile/runtime.
func (s *Service) PrepareSettings(next appsettings.Values, keys map[string]*string, activeKey *string) (func(bool) error, error) {
	s.mu.Lock()
	finish, err := s.configurationRollback()
	if err != nil {
		s.mu.Unlock()
		return nil, err
	}
	complete := func(success bool) error {
		defer s.mu.Unlock()
		if success {
			s.active = RuntimeID(next.AgentRuntime)
			return nil
		}
		return finish()
	}
	for id, key := range keys {
		if id != next.ActiveLLMProfileID {
			if err = s.HermesRuntime.StoreLLMProfileKey(id, key); err != nil {
				return nil, errors.Join(err, complete(false))
			}
		}
	}
	if key, ok := keys[next.ActiveLLMProfileID]; ok {
		activeKey = key
	}
	if err = s.HermesRuntime.SyncLLMProfile(next.LLM, next.ActiveLLMProfileID, activeKey); err == nil {
		err = s.codex.SyncConfiguration()
	}
	if err != nil {
		return nil, errors.Join(err, complete(false))
	}
	return complete, nil
}

func (s *Service) configurationRollback() (func() error, error) {
	type savedFile struct {
		path   string
		data   []byte
		exists bool
	}
	var files []savedFile
	paths := []string{filepath.Join(s.home, "config.yaml"), filepath.Join(s.home, ".env")}
	if s.codex.config.Home != "" {
		paths = append(paths, filepath.Join(s.codex.config.Home, "config.toml"))
	}
	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err != nil && !os.IsNotExist(err) {
			return nil, err
		}
		files = append(files, savedFile{path, data, err == nil})
	}
	s.HermesRuntime.mu.RLock()
	cfg, configured, hasKey := s.llm, s.configured, s.hasAPIKey
	s.HermesRuntime.mu.RUnlock()
	return func() error {
		var errs []error
		for _, file := range files {
			if file.exists {
				errs = append(errs, writeSecureFile(file.path, file.data))
			} else if err := os.Remove(file.path); err != nil && !os.IsNotExist(err) {
				errs = append(errs, err)
			}
		}
		s.HermesRuntime.mu.Lock()
		s.llm, s.configured, s.hasAPIKey = cfg, configured, hasKey
		s.HermesRuntime.mu.Unlock()
		return errors.Join(errs...)
	}, nil
}

```

### Core Architecture Module: `backend/internal/agent/mcp_launcher.py`
```
"""App-owned MCP transport/tool adapter. Never sends or converts model requests."""
import os
import sys
import json

spec = json.loads(os.environ.pop(sys.argv[1]))
# Provider credentials belong to the model process, never to tool subprocesses.
for key in list(os.environ):
    if key.startswith(('CODEX_', 'OPENAI_', 'MODEL_API_KEY', 'EASY_STOCK_MCP_', 'EASY_STOCK_MODEL_')):
        os.environ.pop(key, None)
os.environ.update(spec.get('env', {}))

if spec['transport'] == 'stdio':
    if os.name == 'nt':
        # Windows execvpe does not quote arguments like subprocess does. Keep
        # multiline scripts and paths with spaces intact, and inherit the MCP
        # pipes while the launcher waits for the child process to finish.
        import subprocess
        raise SystemExit(subprocess.run([spec['command'], *spec.get('args', [])], env=os.environ).returncode)
    os.execvpe(spec['command'], [spec['command'], *spec.get('args', [])], os.environ)

import anyio
from mcp.server.stdio import stdio_server

async def relay(source, target):
    async for message in source:
        await target.send(message)

async def serve_sse():
    from mcp.client.sse import sse_client
    async with sse_client(spec['url'], headers=spec.get('headers', {}), timeout=spec.get('connect_timeout') or 30) as (remote_read, remote_write):
        async with stdio_server() as (local_read, local_write):
            async with anyio.create_task_group() as group:
                group.start_soon(relay, local_read, remote_write)
                group.start_soon(relay, remote_read, local_write)

async def serve_tools():
    import contextlib
    import uuid
    # Some upstream tool imports print diagnostics; keep stdout pure MCP.
    with contextlib.redirect_stdout(sys.stderr):
        from mcp.server import Server
        from mcp.types import Tool, TextContent, ListToolsResult, CallToolResult
        from tools.registry import registry
        import tools.web_tools
        import tools.code_execution_tool
        import tools.browser_tool
    permitted = set()
    if 'web' in spec['toolsets']:
        permitted.update(['web_search', 'web_extract'])
    if 'code_execution' in spec['toolsets']:
        permitted.add('execute_code')
    if spec.get('browser_state'):
        # Login is performed by the product's browser. This worker reads pages.
        permitted.update(['browser_navigate', 'browser_snapshot', 'browser_get_text', 'browser_scroll', 'browser_close'])
    task_id = 'easy-stock-' + uuid.uuid4().hex

    async def list_tools():
        result = []
        for name in sorted(permitted):
            schema = registry.get_schema(name)
            if name == 'execute_code':
                from tools.code_execution_tool import build_execute_code_schema
                schema = build_execute_code_schema(permitted - {'execute_code'}, mode='strict')
                schema['description'] = '在当前任务的临时工作区执行 Python 计算，输出结果至 stdout。不可访问用户文件、启动命令或直接访问网络；网页访问仅可使用已列出的 web_search/web_extract。'
                schema['parameters']['properties']['code']['description'] = 'Python 计算代码；使用 print 输出结果。'
            if schema:
                result.append(Tool(name=name, description=schema.get('description', ''), inputSchema=schema.get('parameters', {'type': 'object', 'properties': {}})))
        return result

    async def call_tool(name, arguments):
        if name not in permitted:
            raise ValueError('Tool is outside this task policy')
        def run():
            with contextlib.redirect_stdout(sys.stderr):
                return registry.dispatch(name, arguments or {}, task_id=task_id, enabled_tools=sorted(permitted))
        result = await anyio.to_thread.run_sync(run)
        text = result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)
        return [TextContent(type='text', text=text[:100000])]

    if hasattr(Server, 'list_tools'):
        # Hermes releases may bundle either major version of the MCP SDK.
        server = Server('easy-stock-research-tools')
        server.list_tools()(list_tools)
        server.call_tool()(call_tool)
    else:
        async def on_list_tools(ctx, params):
            return ListToolsResult(tools=await list_tools())
        async def on_call_tool(ctx, params):
            return CallToolResult(content=await call_tool(params.name, params.arguments))
        server = Server('easy-stock-research-tools', on_list_tools=on_list_tools, on_call_tool=on_call_tool)

    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())

anyio.run(serve_sse if spec['transport'] == 'sse' else serve_tools)

```

### Core Architecture Module: `backend/internal/agent/process_unix.go`
```
//go:build !windows

package agent

import (
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
)

func isolateProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error { return killProcessTree(cmd) }
}
func killProcessTree(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	// Codex MCP workers may establish separate process groups. Include those
	// descendants while the parent still owns them; never scan by executable name.
	output, _ := exec.Command("ps", "-axo", "pid=,ppid=").Output()
	children := map[int][]int{}
	for _, line := range strings.Split(string(output), "\n") {
		fields := strings.Fields(line)
		if len(fields) != 2 {
			continue
		}
		pid, _ := strconv.Atoi(fields[0])
		parent, _ := strconv.Atoi(fields[1])
		children[parent] = append(children[parent], pid)
	}
	var stopChildren func(int)
	stopChildren = func(parent int) {
		for _, pid := range children[parent] {
			stopChildren(pid)
			_ = syscall.Kill(pid, syscall.SIGKILL)
		}
	}
	stopChildren(cmd.Process.Pid)
	err := syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	if err == syscall.ESRCH {
		return os.ErrProcessDone
	}
	return err
}

```

### Core Architecture Module: `backend/internal/agent/process_windows.go`
```
//go:build windows

package agent

import (
	"os/exec"
	"strconv"
	"syscall"
)

func isolateProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x00000200, HideWindow: true}
	cmd.Cancel = func() error { return killProcessTree(cmd) }
}
func killProcessTree(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	killer := exec.Command("taskkill", "/PID", strconv.Itoa(cmd.Process.Pid), "/T", "/F")
	killer.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := killer.Run(); err != nil {
		return cmd.Process.Kill()
	}
	return nil
}

```

### Core Architecture Module: `backend/internal/agent/prompt_options.go`
```
package agent

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	defaultSandboxCodeTimeout = 60
	defaultSandboxToolCalls   = 50
)

var defaultSandboxToolsets = []string{"code_execution", "web"}

var allowedSandboxToolsets = map[string]bool{
	"code_execution": true,
	"web":            true,
}

// PromptOptions controls an isolated, unattended Hermes task. Auto approval
// is intentionally coupled to Sandbox so callers cannot bypass consent while
// the agent still has access to the normal application workspace.
type PromptOptions struct {
	Sandbox          bool
	AutoApprove      bool
	DisableTools     bool
	Toolsets         []string
	BrowserStatePath string
}

type OptionsPrompter interface {
	PromptWithOptions(ctx context.Context, prompt string, options PromptOptions) (PromptResult, error)
}

// PromptUsingOptions preserves compatibility with lightweight test and older
// prompters while allowing HermesRuntime to enforce the sandbox for unattended jobs.
func PromptUsingOptions(ctx context.Context, prompter Prompter, prompt string, options PromptOptions) (PromptResult, error) {
	if options.AutoApprove && !options.Sandbox {
		return PromptResult{}, errors.New("Hermes 自动授权只能在隔离沙箱中启用")
	}
	if enhanced, ok := prompter.(OptionsPrompter); ok {
		return enhanced.PromptWithOptions(ctx, prompt, options)
	}
	return prompter.Prompt(ctx, prompt)
}

// PromptFullyAuthorized is for unattended product workflows (reviews,
// analysis jobs and probes), never for the interactive AI chat. It runs in an
// isolated workspace and automatically approves the limited toolsets allowed
// by that workspace.
func PromptFullyAuthorized(ctx context.Context, prompter Prompter, prompt string) (PromptResult, error) {
	return PromptUsingOptions(ctx, prompter, prompt, PromptOptions{Sandbox: true, AutoApprove: true})
}

// PromptFullyAuthorizedWithBrowserState is the unattended equivalent for a
// workflow that explicitly selected a browser login state.
func PromptFullyAuthorizedWithBrowserState(ctx context.Context, prompter BrowserStatePrompter, prompt, statePath string) (PromptResult, error) {
	if enhanced, ok := prompter.(interface {
		PromptWithOptionsAndBrowserState(context.Context, string, string, PromptOptions) (PromptResult, error)
	}); ok {
		return enhanced.PromptWithOptionsAndBrowserState(ctx, prompt, statePath, PromptOptions{Sandbox: true, AutoApprove: true, Toolsets: []string{"web"}, BrowserStatePath: statePath})
	}
	return prompter.PromptWithBrowserState(ctx, prompt, statePath)
}

type promptProcessOptions struct {
	workDir string
	env     map[string]string
	unset   []string
}

type promptSandbox struct {
	root    string
	process promptProcessOptions
}

func (s *promptSandbox) close() {
	if s == nil || s.root == "" {
		return
	}
	_ = os.RemoveAll(s.root)
}

func (r *HermesRuntime) preparePromptSandbox(options PromptOptions) (*promptSandbox, error) {
	root, err := os.MkdirTemp("", "easy-stock-hermes-sandbox-")
	if err != nil {
		return nil, fmt.Errorf("创建 Hermes 临时沙箱: %w", err)
	}
	sandbox := &promptSandbox{root: root}
	fail := func(err error) (*promptSandbox, error) {
		sandbox.close()
		return nil, err
	}

	home := filepath.Join(root, "home")
	tempDir := filepath.Join(root, "tmp")
	workDir := filepath.Join(root, "work")
	siteDir := filepath.Join(root, "python")
	for _, path := range []string{home, tempDir, workDir, siteDir} {
		if err := os.MkdirAll(path, 0o700); err != nil {
			return fail(fmt.Errorf("初始化 Hermes 临时沙箱: %w", err))
		}
	}

	baseConfig, err := r.readConfigMap()
	if err != nil {
		return fail(err)
	}
	sandboxConfig := minimalSandboxConfig(baseConfig, workDir)
	configData, err := yaml.Marshal(sandboxConfig)
	if err != nil {
		return fail(fmt.Errorf("编码 Hermes 沙箱配置: %w", err))
	}
	configPath := filepath.Join(home, "config.yaml")
	if err := writeSecureFile(configPath, configData); err != nil {
		return fail(fmt.Errorf("写入 Hermes 沙箱配置: %w", err))
	}
	if err := writeSecureFile(filepath.Join(siteDir, "sitecustomize.py"), []byte(sandboxSiteCustomize)); err != nil {
		return fail(fmt.Errorf("写入 Hermes Python 沙箱: %w", err))
	}

	if options.DisableTools && len(options.Toolsets) > 0 {
		return fail(errors.New("Hermes 禁用工具时不能同时指定工具集"))
	}
	toolsets, err := cleanPromptToolsets(options.Toolsets)
	if err != nil {
		return fail(err)
	}
	if options.DisableTools {
		// context_engine is a built-in zero-tool toolset. The minimal sandbox
		// config does not enable a context engine, so this pins Hermes to an
		// empty tool schema instead of falling back to its configured defaults.
		toolsets = []string{"context_engine"}
	} else if len(toolsets) == 0 {
		toolsets = append([]string(nil), defaultSandboxToolsets...)
	}
	sandbox.process = promptProcessOptions{
		workDir: workDir,
		env: map[string]string{
			"HOME":                   home,
			"HERMES_HOME":            home,
			"TMPDIR":                 tempDir,
			"TEMP":                   tempDir,
			"TMP":                    tempDir,
			"HERMES_CONFIG":          configPath,
			staleTimeoutEnvName:      strconv.Itoa(r.responseTimeoutSeconds()),
			"HERMES_TUI_TOOLSETS":    strings.Join(toolsets, ","),
			"HERMES_IGNORE_RULES":    "1",
			"HERMES_TUI_CHECKPOINTS": "0",
			"TERMINAL_CWD":           workDir,
			"PYTHONPATH":             siteDir,
		},
		unset: []string{
			"AGENT_BROWSER_PROFILE",
			"AGENT_BROWSER_STATE",
			"HERMES_ENV",
			"HERMES_PROFILE",
			"HERMES_YOLO_MODE",
		},
	}
	if options.BrowserStatePath != "" {
		sandbox.process.env["AGENT_BROWSER_STATE"] = options.BrowserStatePath
		sandbox.process.unset = append(sandbox.process.unset, "AGENT_BROWSER_PROFILE")
		// The selected storage state is an explicit input to this unattended
		// workflow and is intentionally kept available inside the sandbox.
		for i, key := range sandbox.process.unset {
			if key == "AGENT_BROWSER_STATE" {
				sandbox.process.unset = append(sandbox.process.unset[:i], sandbox.process.unset[i+1:]...)
				break
			}
		}
	}
	return sandbox, nil
}

func minimalSandboxConfig(base map[string]any, workDir string) map[string]any {
	config := map[string]any{}
	baseModel, _ := stringMap(base["model"])
	model := copyMapKeys(baseModel, "default", "provider", "base_url", "api_mode")
	if len(model) > 0 {
		config["model"] = model
	}
	providerName := strings.TrimSpace(stringValue(model["provider"]))
	baseProviders, _ := stringMap(base["providers"])
	if providerName != "" {
		if baseProvider, ok := stringMap(baseProviders[providerName]); ok {
			provider := copyMapKeys(baseProvider,
				"name", "api", "key_env", "default_model", "transport", "stale_timeout_seconds", "extra_body",
			)
			if len(provider) > 0 {
				config["providers"] = map[string]any{providerName: provider}
			}
		}
	}
	if serviceTier, ok := base["service_tier"].(string); ok && strings.TrimSpace(serviceTier) != "" {
		config["service_tier"] = serviceTier
	}
	baseAgent, _ := stringMap(base["agent"])
	agent := copyMapKeys(baseAgent, "system_prompt", "reasoning_effort", "easy_stock_reasoning_effort")
	config["agent"] = agent
	config["curator"] = map[string]any{"enabled": false}
	config["memory"] = map[string]any{"memory_enabled": false, "user_profile_enabled": false, "nudge_interval": 0}
	config["security"] = map[string]any{"allow_lazy_installs": false}
	config["approvals"] = map[string]any{"mode": "manual"}
	config["terminal"] = map[string]any{"cwd": workDir, "env_passthrough": []string{}}
	config["code_execution"] = map[string]any{
		"mode":           "strict",
		"timeout":        defaultSandboxCodeTimeout,
		"max_tool_calls": defaultSandboxToolCalls,
	}
	return config
}

func copyMapKeys(source map[string]any, keys ...string) map[string]any {
	result := map[string]any{}
	for _, key := range keys {
		if value, ok := source[key]; ok {
			result[key] = value
		}
	}
	return result
}

func cleanPromptToolsets(values []string) ([]string, error) {
	result := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := ra
```

### Core Architecture Module: `backend/internal/agent/protocol.go`
```
package agent

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"easy-stock/backend/internal/appsettings"
)

var ErrProtocolUnconfirmed = errors.New("模型 Responses 能力尚未确认")

// ProbeResponses sends a native, tiny Responses request to the exact endpoint,
// model and credential. It never translates chat/messages, proxies generation,
// or treats auth/network errors as proof of protocol incompatibility.
func ProbeResponses(ctx context.Context, cfg appsettings.LLM, key string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	payload, _ := json.Marshal(map[string]any{"model": cfg.Model, "store": false, "stream": true,
		"input": []any{map[string]any{"role": "user", "content": []any{map[string]any{"type": "input_text", "text": "Reply OK."}}}}})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(cfg.BaseURL, "/")+"/responses", bytes.NewReader(payload))
	if err != nil {
		return false, fmt.Errorf("%w：模型地址无效", ErrProtocolUnconfirmed)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("%w：无法连接模型服务，请检查地址、网络或超时", ErrProtocolUnconfirmed)
	}
	defer response.Body.Close()
	body := io.LimitReader(response.Body, 1<<20)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		var envelope struct {
			Error struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.NewDecoder(body).Decode(&envelope)
		if envelope.Error.Code == "model_not_found" {
			return false, fmt.Errorf("%w：模型不存在或当前密钥无权使用", ErrProtocolUnconfirmed)
		}
		if response.StatusCode == 404 || response.StatusCode == 405 || response.StatusCode == 501 {
			return false, nil
		}
		detail := strings.ToLower(envelope.Error.Code + " " + envelope.Error.Message)
		if response.StatusCode == 400 && (strings.Contains(detail, "unsupported_api") || strings.Contains(detail, "unsupported_protocol") || strings.Contains(detail, "responses is not supported") || strings.Contains(detail, "does not support responses")) {
			return false, nil
		}
		return false, fmt.Errorf("%w：服务返回 HTTP %d，请检查密钥、模型权限和服务状态", ErrProtocolUnconfirmed, response.StatusCode)
	}
	valid := func(data []byte) bool {
		var value map[string]any
		if json.Unmarshal(data, &value) != nil {
			return false
		}
		kind, _ := value["type"].(string)
		if kind == "response.completed" || kind == "response.incomplete" {
			return true
		}
		return value["object"] == "response" && value["id"] != nil
	}
	if strings.Contains(response.Header.Get("Content-Type"), "text/event-stream") {
		scanner := bufio.NewScanner(body)
		scanner.Buffer(make([]byte, 4096), 1<<20)
		for scanner.Scan() {
			line := scanner.Bytes()
			if bytes.HasPrefix(line, []byte("data:")) && valid(bytes.TrimSpace(line[5:])) {
				return true, nil
			}
		}
	} else {
		data, _ := io.ReadAll(body)
		if valid(data) {
			return true, nil
		}
	}
	return false, fmt.Errorf("%w：服务没有返回有效的 Responses 结果", ErrProtocolUnconfirmed)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5** (2026-09-13): **feat: 概念维度贯通（梯队概念云 / 选股概念列 / 自选概念标签）**
  *Symptoms*: ## 内容  对标 tick-stock-panel 的「概念」呈现方式，把每股所属概念标签贯通到三个板块（数据复用现有东财股票概念目录，StockCatalog）：  ### 连板梯队（短线连板页） - 每个梯队层级展开后顶部渲染**概念标签云**：按层级内命中概念股数降序（如「共封装光学(CPO) 6」「创新药 4」），高频概念高亮 - 个股卡片新增概念 chips（首板/高位层 4 个、紧凑模式 2 个） - 数据本就在 `raw_concepts` 字段里，本 PR 只补 UI  ### 策略选股 - 后端：`screener.Service` 新增可选 `ConceptLookup` 依赖，命中结果每股附最多 3 个概念；概念目录不可用时静默跳过并提示 - 前端：结果表新增「所属概念」列  ### 工作台自选 - 新接口 `GET /api/v1/stocks/concepts?symbols=...`（目录反查，60 只上限，limit 可调） - 工作台自选行情行名称旁渲染概念 chips（前 2 个）  ### 兼容性细节 - 概念查找同时匹配规范形（600519.SH）与纯 6 位码（600519）两种符号——screener 携带的是东财 clist 代码  ### 验证 - `go test ./...` 全绿；前端 tsc / vitest（161 个）/ vite build 全过 - 浏览器实测：梯队概念云与个股 chips、选股概念列（华为概念/军工/5G概念等）、自选概念标签（茅台→电商概念/超级品牌）均正常渲染  > 基于 #4 之上（前四个 commit 与前序 PR 相同），建议按 #2 → #3 → #4 → 本 PR 顺序合并。
  **Post-Mortem & Fix Analysis**:
  > 存在个人信息

- **Issue #4** (2026-09-13): **feat: 策略选股引擎（内置 17 策略 + 指标流水线）**
  *Symptoms*: ## 内容  把 tick-stock-panel 的「选股引擎 + 指标流水线」能力移植到 easy-stock 自有数据面，新增侧栏板块**策略选股**。  > 基于 #2/#3 的提交之上（前三个 commit 与之相同），建议按 #2 → #3 → 本 PR 顺序合并。  ### 后端 - `internal/screener`：**两级策略引擎**   - 快照策略（8 个）：放量上涨 / 温和放量上行 / 高换手活跃 / 主力净流入 / 超跌反弹 / 中期强势 / 小市值活跃 / 低估破净修复——东财全市场快照内存过滤，毫秒级   - K线策略（9 个）：均线多头排列 / 放量突破20日高 / MACD金叉 / MACD多头 / RSI超卖回升 / KDJ金叉 / 收复布林中轨 / 五连阳 / 涨停回踩——对受控计算池逐只计算（快照命中优先 + 成交额保底，默认上限 300 只） - 纯 Go 指标流水线：SMA / EMA / MACD / RSI / KDJ / BOLL，含单元测试 - 东财快照扩展字段：量比 / 总市值 / 流通市值 / PE / PB / 主力净流入 / 5日与60日涨幅（f10/f20/f21/f9/f23/f62/f109/f24） - `GET /api/v1/screener/strategies`、`POST /api/v1/screener/run`（150 秒预算 + 90 秒结果缓存）  ### 前端 - 侧栏新增「策略选股」：分组策略目录（量价/资金/动量/规模/趋势K线/指标K线/形态K线）勾选多选 - 运行选项：排除 ST/次新、最小成交额、K线池上限 - 结果表：现价/涨幅/换手/量比/流通市值 + 命中策略标签与详情（金叉位置、HIST、量比倍数、MA 数值），点行直达个股 AI 分析；支持「只看多策略共振」  ### 验证 - `go test ./...` 全绿（screener 10 个新测试：指标正确性 / ST与停牌过滤 / 计算池上限 / 目录完整性） - 真实数据端到端：2891 只扫描（排除ST/次新后）→ 107 只命中，K线池 300 只 70 秒；浏览器实测截图验收（依顿电子三策略共振等详情渲染正常） - 前端 tsc / vitest（161 个）/ vite build 全过
  **Post-Mortem & Fix Analysis**:
  > 存在个人信息

- **Issue #3** (2026-09-22): **feat: 工作台市场看板（借鉴 tick-stock-panel）**
  *Symptoms*: ## 内容  把 [shy3130/tick-stock-panel](https://github.com/shy3130/tick-stock-panel)（MIT）的看板页设计适配进工作台，数据全部走 easy-stock 自有 provider。  > 本 PR 基于 #2 的提交之上（前两个 commit 与 #2 相同），**建议先合并 #2**，合并后本 PR 的 diff 会自动只剩看板改版一个提交。  ### 后端 - `GET /api/v1/market/breadth`：东财全市场快照（clist 56 页并发拉取 + 45 秒服务端缓存），聚合涨平跌广度、10 档涨跌分布、强势/弱势、平均/中位涨跌、成交额与四个 Top8 榜单 - `GET /api/v1/market/concepts`：东财概念板块动量（新增 f140 领涨股代码解析）  ### 工作台改版 - 看板 KPI 行：强势/弱势、涨停/跌停+封板率、最高连板、首板/连板、昨涨停溢价、平均换手 - 三列区：涨跌分布/广度卡（直方图 + 涨平跌横条 + 均/中位涨跌）、情绪雷达（6 维 SVG，中心为情绪总分）、涨停梯队迷你视图 - 概念热度 / 行业热度卡：领涨领跌 Top5，领涨股点击直达个股 AI 分析 - 四列榜单：涨幅榜 / 跌幅榜 / 成交额榜 / 活跃换手（Top8，行点击直达个股分析） - 监控中心组件按需求**未移植**；自选行情、市场热度、情绪催化、财联社电报区块保留  ### 验证 - `go test ./...` 全绿（eastmoney 新增 snapshot 聚合/解析/规范化 5 个测试） - 前端 tsc / vitest（161 个）/ vite build 全过 - 浏览器实测截图验收：分布直方图、雷达、梯队、双热度卡、四榜单真实数据渲染正常（当日全市场 5210 只，跌 4567 / 涨 605）
  **Post-Mortem & Fix Analysis**:
  > 你好，如果有参与easy-stock共同维护的意愿，可以联系我对齐easy-stock的目标和愿景

- **Issue #2** (2026-09-13): **feat: integrate chan.py engine and add 缠论选股 workspace**
  *Symptoms*: ## 内容  包含两个提交：  ### 1. feat: sync in-progress engines and workspaces from prior sessions 把此前多轮开发但未提交的工作落到提交基线上（czsc 缠论个股分析、雪球热榜、自选股日报、交易复盘、催化剂、板块雷达、工作台与暗色主题等，88 个文件）。这些是后续 chan.py 集成的编译前提。  ### 2. feat: integrate chan.py engine and add chan screener workspace 基于 [Vespa314/chan.py](https://github.com/Vespa314/chan.py)（MIT）新增缠论引擎与选股板块：  - **Python 引擎**：`integrations/chanpy-service/` vendored chan.py 核心 + 自定义 easy-stock 后端数据源（`DataAPI/backendAPI.py`），服务脚本 `chanpy_service.py` 提供 `analyze`（单股完整笔/线段/中枢/一二三类买卖点 + 确定性评分）与 `screen`（批量选股）两个子命令；核心计算只依赖 Python ≥3.11 标准库 - **Go 后端**：`backend/internal/chanscreener` 进程外调用（沿用 chananalysis/czsc 的探测、令牌回调、缓存与串行锁约定），新增 3 条路由 `/api/v1/stocks/chan-screen`、`/api/v1/stocks/chanpy-analysis`、`/api/v1/stocks/chan-screen-status` - **前端**：顶栏新增「缠论选股」板块——股票池（自定义 / 自选股日报配置 / 热门股票榜）、买卖点类型与时效过滤、中枢位置与当前笔方向条件、确定性评分排序，点击行展开个股结构详情 - **文档**：`docs/chan-engine.md` 双引擎说明与部署方式；`backend/docs/api-routes.md` 路由条目  ## 验证  - `go build ./...` + `go test ./...` 全绿（chanscreener 新增 8 个测试；顺带修复了 xueqiu `TestInflightDedup` 的随机失败——根因是 map 遍历拼 URL 导致缓存/in-flight key 分裂，已排序规范化并加回归测试） - 前端 `tsc --noEmit`、`vitest`（161 个）、`vite build` 全部通过 - 真实数据端到端：6 只股票批量选股 1.5s，茅台 500 根日线 25 笔 / 2 中枢 / 12 买卖点  ## 说明  - `documents/`、`backend/catalyst_candidates.json`、根目录 `manifest.json` 为运行时数据，本次加入 `.gitignore` - 评分与选股结果仅作研究参考，不构成投资建议
  **Post-Mortem & Fix Analysis**:
  > 存在个人信息

- **Issue #1** (2026-09-29): **[Feature] OrcaRouter provider support for easy-stock**
  *Symptoms*: easy-stock is an AI-native desktop research workbench for individual A-share investors that models the structure behind prices — leading themes, limit-up ladders, sentiment cycles — and whose post-market review flow gathers write-ups scattered across Xueqiu, Taoguba, and WeChat public accounts into one timeline, distilling a cross-author consensus with conditions to verify the next trading day.  The design choice that makes this dependable is the local Hermes Runtime: model calls, sessions, and tool routing run through one gateway so business code is never bound to a single vendor. Users already configure OpenAI, DeepSeek, Qwen, Moonshot, Anthropic, or any OpenAI-compatible endpoint by pasting an API base URL and key. Adding OrcaRouter as another selectable entry would give those users a wider model choice through a familiar setup step.  ## Proposal  I'm an engineer on the OrcaRouter team. I'd like to propose OrcaRouter as an optional provider for easy-stock. It would be additive only — a new entry beside the providers you already list, leaving existing provider configuration and behavior untouched.  ## What users would gain  easy-stock's scheduled and batch tasks — auto-syncing big-V articles, per-stock portfolio inspections — make consistent availability and predictable spend important. The capabilities most relevant:  - one OpenAI-compatible endpoint across many chat and reasoning models, so a user can use a cheaper model for daily consensus summaries and a stronger one fo
  **Post-Mortem & Fix Analysis**:
  > 感谢，未来easy-stock会考虑引入第三方中转站，但不是现在

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

### Incident Patch 1: `37a8c1bb` (2026-09-30)
**Commit Message**: fix: keep reasoning effort labels readable on Windows

Python pipes decoded stdin with the ANSI code page (GBK on zh-CN),
mojibake-ing the UTF-8 labels passed to the reasoning describe bridge
and poisoning the 30-day capability cache. Force UTF-8 stdio in the
launcher, default PYTHONUTF8/PYTHONIOENCODING for managed Python child
processes, and bump the capability cache version to drop bad entries.

**File**: `backend/internal/agent/reasoning.go` (modified, +1/-1)
```diff
@@ -252,7 +252,7 @@ type capabilityCacheEntry struct {
 	Models        map[string]ReasoningCapability `json:"models"`
 }
 
-const reasoningCapabilityVersion = 4
+const reasoningCapabilityVersion = 5
 
 type CapabilityGateway interface {
 	ResolveModelCapabilities(baseURL, apiMode string, models map[string]json.RawMessage) (map[string]ReasoningCapability, error)
```

**File**: `backend/internal/agent/reasoning_launcher.py` (modified, +8/-0)
```diff
@@ -162,6 +162,14 @@ def supported(self, requested_model):
 
 
 def main():
+    # Windows pipes default stdio to the ANSI code page (GBK on zh-CN), but the
+    # Go host always writes UTF-8. Reconfigure before the first stdin read.
+    for stream in (sys.stdin, sys.stdout, sys.stderr):
+        if stream is not None and hasattr(stream, "reconfigure"):
+            try:
+                stream.reconfigure(encoding="utf-8")
+            except (OSError, ValueError):
+                pass
     if len(sys.argv) > 1 and sys.argv[1] == "describe":
         request = json.load(sys.stdin)
         result = {}
```

**File**: `backend/internal/agent/reasoning_launcher_test.py` (modified, +19/-0)
```diff
@@ -1,4 +1,8 @@
 """Integration tests against bundled Hermes transports; no network or SDK patches."""
+import json
+import os
+import subprocess
+import sys
 import unittest
 import reasoning_launcher as bridge
 from providers import get_provider_profile, register_provider
@@ -27,6 +31,21 @@ def request(self, effort, **overrides):
         transport = ResponsesApiTransport() if self.config['api_mode'] == 'codex_responses' else ChatCompletionsTransport()
         return transport.build_kwargs(self.config['model'], [{'role':'user','content':'hi'}], **params)
 
+    def test_describe_pipes_keep_utf8_chinese_labels(self):
+        # Windows pipes decode stdin with the ANSI code page (GBK) unless the
+        # launcher reconfigures stdio; the Go host always writes UTF-8.
+        request = {"config": {"model": "m", "base_url": "https://x.example/v1", "api_mode": "chat_completions"},
+                   "models": [{"model": "m", "supplement": {"options": [{"value": "low", "label": "低"}, {"value": "max", "label": "最大"}],
+                                                            "default": "max", "source": "official", "wire": "openai_chat"}}]}
+        env = {k: v for k, v in os.environ.items() if k not in ("PYTHONUTF8", "PYTHONIOENCODING")}
+        script = "import sys; sys.argv = ['reasoning_launcher', 'describe']; import reasoning_launcher; reasoning_launcher.main()"
+        run = subprocess.run([sys.executable, "-c", script], input=json.dumps(request).encode("utf-8"),
+                             capture_output=True, env=env,
+                             cwd=os.path.dirname(os.path.abspath(bridge.__file__)))
+        self.assertEqual(run.returncode, 0, run.stderr.decode("utf-8", "replace"))
+        labels = {o["value"]: o["label"] for o in json.loads(run.stdout.decode("utf-8"))["m"]["options"]}
+        self.assertEqual(labels, {"low": "低", "max": "最大"})
+
     def test_deepseek_alias_native_translation(self):
         self.assertEqual(self.configure('deepseek-chat', 'https://api.deepseek.com/v1'), ['none','low','medium','high','max'])
         body = self.request('max')
```

**File**: `backend/internal/agent/runtime.go` (modified, +9/-0)
```diff
@@ -1295,6 +1295,15 @@ func hermesEnvironment(base []string, home, workDir, binDir string) []string {
 	values = setEnv(values, "PYTHONNOUSERSITE", "1")
 	values = setEnv(values, "PYTHONUNBUFFERED", "1")
 	values = setEnv(values, "NO_COLOR", "1")
+	// Python stdio and pipes follow the ANSI code page on Windows (GBK on
+	// zh-CN) while this app speaks UTF-8. Same defaults hermes_bootstrap sets
+	// for its own children; an explicit user setting still wins.
+	if environmentValue(base, "PYTHONUTF8") == "" {
+		values = setEnv(values, "PYTHONUTF8", "1")
+	}
+	if environmentValue(base, "PYTHONIOENCODING") == "" {
+		values = setEnv(values, "PYTHONIOENCODING", "utf-8")
+	}
 	if strings.TrimSpace(home) != "" {
 		values = setEnv(values, "AGENT_BROWSER_PROFILE", filepath.Join(home, "browser-profile"))
 	}
```

**File**: `backend/internal/agent/runtime_test.go` (modified, +17/-0)
```diff
@@ -297,6 +297,23 @@ func TestHermesEnvironmentIncludesWorkspaceNodeBin(t *testing.T) {
 	}
 }
 
+func TestHermesEnvironmentDefaultsPythonToUTF8(t *testing.T) {
+	values := hermesEnvironment([]string{"PATH=/usr/bin"}, t.TempDir(), "", "")
+	if got := envValue(values, "PYTHONUTF8"); got != "1" {
+		t.Fatalf("PYTHONUTF8 = %q, want 1", got)
+	}
+	if got := envValue(values, "PYTHONIOENCODING"); got != "utf-8" {
+		t.Fatalf("PYTHONIOENCODING = %q, want utf-8", got)
+	}
+	values = hermesEnvironment([]string{"PATH=/usr/bin", "PYTHONUTF8=0", "PYTHONIOENCODING=gbk"}, t.TempDir(), "", "")
+	if got := envValue(values, "PYTHONUTF8"); got != "0" {
+		t.Fatalf("PYTHONUTF8 = %q, want user setting 0", got)
+	}
+	if got := envValue(values, "PYTHONIOENCODING"); got != "gbk" {
+		t.Fatalf("PYTHONIOENCODING = %q, want user setting gbk", got)
+	}
+}
+
 func TestRuntimePythonUsesStandaloneWindowsInterpreter(t *testing.T) {
 	root := filepath.Join("runtime", "hermes")
 	if got := runtimePythonForOS(root, "windows"); got != filepath.Join(root, "python", "python.exe") {
```

---

### Incident Patch 2: `73632da6` (2026-09-30)
**Commit Message**: fix: verify existing OSS uploads with native CRC64

**File**: `desktop/scripts/publish-updater-oss.sh` (modified, +19/-1)
```diff
@@ -30,13 +30,31 @@ if command -v timeout >/dev/null 2>&1; then
   upload_timeout=(timeout --kill-after=15s "${OSS_UPLOAD_TIMEOUT_SECONDS:-600}s")
 fi
 
+matches_public_file() {
+  local file=$1 name headers local_size remote_size remote_crc local_crc
+  name=$(basename "$file")
+  headers="$verification_root/existing-headers"
+  if ! curl --fail --silent --location --head --connect-timeout 10 --max-time 20 \
+    "${public_url%/}/$name" --dump-header "$headers" --output /dev/null; then return 1; fi
+  local_size=$(wc -c < "$file" | tr -d ' ')
+  remote_size=$(awk 'tolower($1) == "content-length:" { gsub("\r", "", $2); size=$2 } END { print size }' "$headers")
+  remote_crc=$(awk 'tolower($1) == "x-oss-hash-crc64ecma:" { gsub("\r", "", $2); crc=$2 } END { print crc }' "$headers")
+  [[ "$remote_size" == "$local_size" && -n "$remote_crc" ]] || return 1
+  local_crc=$("$ossutil_command" hash crc64 "$file" | awk 'NR == 1 { print $1 }') || return 1
+  [[ "$local_crc" == "$remote_crc" ]]
+}
+
 upload() {
   local file=$1 cache_control=$2 name attempt
   name=$(basename "$file")
+  if [[ "$cache_control" == 'public,max-age=31536000,immutable' ]] && matches_public_file "$file"; then
+    echo "Already published with matching size and OSS CRC64: $name"
+    return 0
+  fi
   for attempt in 1 2 3; do
     echo "Uploading $name (attempt $attempt/3)"
     if "${upload_timeout[@]}" "$ossutil_command" "${ossutil_options[@]}" cp "$file" "${target_uri%/}/$name" \
-      --force --checksum --no-progress --parallel "${OSS_UPLOAD_PARALLEL:-16}" --part-size 4Mi --checkpoint-dir "$verification_root/checkpoints" --cache-control "$cache_control"; then
+      --force --no-progress --parallel "${OSS_UPLOAD_PARALLEL:-16}" --part-size 4Mi --checkpoint-dir "$verification_root/checkpoints" --cache-control "$cache_control"; then
       return 0
     fi
   done
```

**File**: `desktop/test/release-publish.test.cjs` (modified, +8/-0)
```diff
@@ -67,6 +67,7 @@ test('OSS retries failed uploads and never advances manifests before public asse
     fs.writeFileSync(path.join(assets, metadata), `version: 1.3.0\nfiles:\n  - url: ${name}\n    sha512: ${crypto.createHash('sha512').update(bytes).digest('base64')}\n`);
   }
   fs.writeFileSync(path.join(bin, 'ossutil'), `#!/usr/bin/env bash
+if [[ "$1" == hash ]]; then echo "42  $3"; exit 0; fi
 while [[ "$1" != cp ]]; do shift; done
 name=$(basename "$2")
 echo "upload:$name" >> "$CHECK_ROOT/log"
@@ -88,6 +89,7 @@ if [[ "$head" == 1 ]]; then
   size=$(wc -c < "$CHECK_ROOT/assets/$name" | tr -d ' ')
   [[ "\${CORRUPT_SIZE:-0}" == 1 ]] && size=0
   printf 'HTTP/1.1 200 OK\\r\\nContent-Length: %s\\r\\n\\r\\n' "$size" > "$headers"
+  if [[ "\${MATCH_PUBLIC_CRC:-0}" == 1 ]]; then printf 'x-oss-hash-crc64ecma: 42\\r\\n' >> "$headers"; fi
 else cp "$CHECK_ROOT/assets/$name" "$output"; fi
 `, { mode: 0o755 });
   const publish = (extra = {}) => spawnSync('bash', [path.resolve(__dirname, '../scripts/publish-updater-oss.sh'), assets], {
@@ -102,4 +104,10 @@ else cp "$CHECK_ROOT/assets/$name" "$output"; fi
   const failure = publish({ CORRUPT_SIZE: '1' });
   assert.notEqual(failure.status, 0);
   assert.doesNotMatch(fs.readFileSync(path.join(root, 'log'), 'utf8'), /upload:latest/);
+  fs.writeFileSync(path.join(root, 'log'), '');
+  const resume = publish({ MATCH_PUBLIC_CRC: '1' });
+  assert.equal(resume.status, 0, resume.stderr);
+  const resumedLog = fs.readFileSync(path.join(root, 'log'), 'utf8');
+  assert.doesNotMatch(resumedLog, /upload:(mac\.zip|win\.exe)/);
+  assert.match(resumedLog, /upload:latest-mac\.yml/);
 });
```

---

### Incident Patch 3: `df5d57fd` (2026-09-30)
**Commit Message**: fix: size release disk images and preserve Windows MCP arguments

**File**: `backend/internal/agent/codex_test.go` (modified, +38/-0)
```diff
@@ -428,3 +428,41 @@ func TestBuiltinMCPHandshake(t *testing.T) {
 		t.Fatalf("MCP handshake: %v %s", err, data)
 	}
 }
+
+func TestMCPStdioLauncherPreservesArgumentsAndPipes(t *testing.T) {
+	python := os.Getenv("EASY_STOCK_HERMES_TEST_PYTHON")
+	if python == "" {
+		var err error
+		python, err = exec.LookPath("python3")
+		if err != nil {
+			t.Skip("Python is unavailable")
+		}
+	}
+	for _, subprocessLaunch := range []bool{false, true} {
+		t.Run(fmt.Sprintf("subprocess=%v", subprocessLaunch), func(t *testing.T) {
+			argument := "A path with spaces\nand a second line"
+			child := "import json,os,sys\nprint(json.dumps({'arg':sys.argv[1], 'line':sys.stdin.readline().strip(), 'model_key':os.getenv('OPENAI_API_KEY'), 'tool_key':os.getenv('FIXTURE_SECRET')}),flush=True)\n"
+			spec, _ := json.Marshal(map[string]any{"transport": "stdio", "command": python, "args": []string{"-c", child, argument}, "env": map[string]string{"FIXTURE_SECRET": "fixture-only"}})
+			launcher := mcpLauncher
+			if subprocessLaunch {
+				launcher = strings.Replace(launcher, "if os.name == 'nt':", "if True:", 1)
+			}
+			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
+			defer cancel()
+			cmd := exec.CommandContext(ctx, python, "-c", launcher, "EASY_STOCK_MCP_TEST")
+			cmd.Env = append(os.Environ(), "EASY_STOCK_MCP_TEST="+string(spec), "OPENAI_API_KEY=fixture-model-key")
+			cmd.Stdin = strings.NewReader("MCP input message\n")
+			output, err := cmd.CombinedOutput()
+			if err != nil {
+				t.Fatalf("stdio launcher failed: %v: %s", err, output)
+			}
+			var result map[string]any
+			if err := json.Unmarshal(output, &result); err != nil {
+				t.Fatalf("stdio output is not JSON: %v: %s", err, output)
+			}
+			if result["arg"] != argument || result["line"] != "MCP input message" || result["model_key"] != nil || result["tool_key"] != "fixture-only" {
+				t.Fatalf("stdio arguments, pipes or credential isolation failed: %v", result)
+			}
+		})
+	}
+}
```

**File**: `backend/internal/agent/mcp_launcher.py` (modified, +6/-0)
```diff
@@ -11,6 +11,12 @@
 os.environ.update(spec.get('env', {}))
 
 if spec['transport'] == 'stdio':
+    if os.name == 'nt':
+        # Windows execvpe does not quote arguments like subprocess does. Keep
+        # multiline scripts and paths with spaces intact, and inherit the MCP
+        # pipes while the launcher waits for the child process to finish.
+        import subprocess
+        raise SystemExit(subprocess.run([spec['command'], *spec.get('args', [])], env=os.environ).returncode)
     os.execvpe(spec['command'], [spec['command'], *spec.get('args', [])], os.environ)
 
 import anyio
```

**File**: `desktop/scripts/create-dmg.mjs` (modified, +4/-1)
```diff
@@ -3,6 +3,7 @@ import fs from 'node:fs';
 import os from 'node:os';
 import path from 'node:path';
 import { fileURLToPath } from 'node:url';
+import { dmgSizeMiB } from './dmg-size.mjs';
 
 const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
 const arch = process.env.A_STOCK_DESKTOP_ARCH || process.arch;
@@ -35,7 +36,9 @@ try {
 	// framework symlinks to absolute paths. Create a writable volume first and
 	// copy into the mounted filesystem with `ditto`, which preserves the
 	// relative links required by Electron frameworks.
-	run('hdiutil', ['create', '-size', '1200m', '-fs', 'Journaled HFS+', '-volname', 'easy-stock', '-ov', '-type', 'UDIF', writableImagePath]);
+	const imageSizeMiB = dmgSizeMiB(appPath);
+	console.log(`Creating ${imageSizeMiB} MiB writable image for the bundled application`);
+	run('hdiutil', ['create', '-size', `${imageSizeMiB}m`, '-fs', 'Journaled HFS+', '-volname', 'easy-stock', '-ov', '-type', 'UDIF', writableImagePath]);
 	run('hdiutil', ['attach', writableImagePath, '-nobrowse', '-mountpoint', writableMountPath]);
 	writableMounted = true;
 	const stagedAppPath = path.join(writableMountPath, 'easy-stock.app');
```

**File**: `desktop/scripts/dmg-size.mjs` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+import fs from 'node:fs';
+import path from 'node:path';
+
+export function dmgSizeMiB(appPath) {
+  let bytes = 0;
+  function walk(root) {
+    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
+      const file = path.join(root, entry.name);
+      bytes += 16384; // Allow space for filesystem entries and extended attributes.
+      if (entry.isDirectory()) walk(file);
+      else if (entry.isFile()) bytes += fs.statSync(file).size;
+    }
+  }
+  walk(appPath);
+  return Math.max(1200, Math.ceil(bytes / 1024 / 1024 * 1.2) + 128);
+}
```

**File**: `desktop/test/release-publish.test.cjs` (modified, +15/-0)
```diff
@@ -6,6 +6,21 @@ const path = require('node:path');
 const { spawnSync } = require('node:child_process');
 const test = require('node:test');
 
+test('DMG capacity grows with bundled runtime files', async (t) => {
+  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'easy-stock-dmg-size-'));
+  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
+  const { dmgSizeMiB } = await import('../scripts/dmg-size.mjs');
+  assert.equal(dmgSizeMiB(root), 1200);
+  const file = fs.openSync(path.join(root, 'large-runtime'), 'w');
+  fs.ftruncateSync(file, 1500 * 1024 * 1024);
+  fs.closeSync(file);
+  assert.ok(dmgSizeMiB(root) > 1500 + 128);
+  if (process.platform !== 'win32') {
+    fs.symlinkSync(root, path.join(root, 'external-link'));
+    assert.ok(dmgSizeMiB(root) < 2000, 'symlinks must not duplicate target contents');
+  }
+});
+
 test('GitHub publication rejects incomplete or corrupted remote assets', (t) => {
   const root = fs.mkdtempSync(path.join(os.tmpdir(), 'easy-stock-publish-check-'));
   t.after(() => fs.rmSync(root, { recursive: true, force: true }));
```

---

### Incident Patch 4: `b3d7ea5b` (2026-09-30)
**Commit Message**: fix: close settings after save and show success notice

**File**: `frontend/src/App.tsx` (modified, +10/-1)
```diff
@@ -5,6 +5,7 @@ import {
 	BookMarked,
 	BookOpen,
 	BrainCircuit,
+	CheckCircle2,
 	ChevronDown,
 	ChevronRight,
 	Clock3,
@@ -136,8 +137,15 @@ export function App() {
 	const [aiPrefill, setAIPrefill] = useState('');
 	const [aiAnalysisID, setAIAnalysisID] = useState<string | undefined>();
 	const [settingsOpen, setSettingsOpen] = useState(false);
+	const [settingsSavedNotice, setSettingsSavedNotice] = useState(0);
 	const [tokenUsageRefreshKey, setTokenUsageRefreshKey] = useState(0);
 
+	useEffect(() => {
+		if (!settingsSavedNotice) return;
+		const timer = window.setTimeout(() => setSettingsSavedNotice(0), 3000);
+		return () => window.clearTimeout(timer);
+	}, [settingsSavedNotice]);
+
 	const overview = useThemeOverview(config, workspaceMode === 'themes');
 	const themeOverviews = overview.data;
 	const overviewMeta = overview.meta;
@@ -697,7 +705,8 @@ export function App() {
 					<div><Radio size={15} aria-hidden="true" /><span>{workspaceMode === 'themes' ? '题材与龙一至龙五：开盘啦 · 实时行情：新浪 · K线与领导力：东方财富/新浪' : workspaceMode === 'limit-up' ? '当日涨停池与逐股题材：开盘啦优先 · 历史梯队、缺失股票与行情字段：东方财富补充 · 默认剔除ST' : workspaceMode === 'mastery' ? '来源：trading-mastery/游资心法 · 每日缓存 · 同步至 Agent Skill 与本地记忆索引' : workspaceMode === 'reviews' ? '复盘文章：本地 SQLite 归档 · 原文观点不代表系统结论' : workspaceMode === 'stock-ai' ? '行情与K线：东方财富/新浪 · 涨停与题材：开盘啦/东方财富 · AI只基于结构化证据总结' : workspaceMode === 'portfolio-inspection' ? '逐股分析复用个股引擎 · 组合指标由本地程序计算 · AI只基于结构化证据汇总' : workspaceMode === 'market' ? '行情与行业强度：腾讯/东方财富 · 资金与领涨标的：新浪/东方财富 · 龙虎榜、公告与研报：东方财富 · 盘面快讯：财联社 · AI 只读取带时间和来源的证据' : workspaceMode === 'token-usage' ? '真实用量来自模型返回的 usage · 本地估算单独记录，不并入真实总量' : '模型请求由本地后端转发 · API Key 不会暴露给页面 · 对话历史保存在当前设备'}</span></div>
 			</footer>
 			</div>
-			<SettingsDrawer config={config} open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={() => { setAIRefreshKey((current) => current + 1); setStockAIRefreshKey((current) => current + 1); }} />
+			<SettingsDrawer config={config} open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={() => { setSettingsSavedNotice((current) => current + 1); setAIRefreshKey((current) => current + 1); setStockAIRefreshKey((current) => current + 1); }} />
+			{settingsSavedNotice > 0 && <div className="settings-save-notice" role="status"><CheckCircle2 size={22} aria-hidden="true" /><span>保存成功</span></div>}
 		</main>
 	);
 }
```

**File**: `frontend/src/components/SettingsDrawer.tsx` (modified, +4/-3)
```diff
@@ -442,11 +442,12 @@ export function SettingsDrawer({ config, open, onClose, onSaved }: Props) {
 		try {
 			await persistSettings();
 			setState('saved');
-			setMessage('共享设置已保存');
+			setMessage('保存成功');
 			onSaved?.();
+			onClose();
 		} catch (error) {
 			setState('error');
-			setMessage(error instanceof Error ? error.message : '保存设置失败');
+			setMessage(error instanceof Error && error.message ? `保存失败：${error.message}` : '保存失败');
 		}
 	};
 
@@ -569,7 +570,7 @@ export function SettingsDrawer({ config, open, onClose, onSaved }: Props) {
 						</SettingsSection>
 
 						<footer className="settings-footer">
-							<div className={`settings-message ${state}`}>{state === 'saved' && <CheckCircle2 size={15} />}{state === 'error' && <KeyRound size={15} />}<span>{message || '留空的模型密钥会保留已保存的值。'}</span></div>
+							<div className={`settings-message ${state}`} role={state === 'error' ? 'alert' : 'status'}>{state === 'saved' && <CheckCircle2 size={15} />}{state === 'error' && <CircleAlert size={15} />}<span>{message || '留空的模型密钥会保留已保存的值。'}</span></div>
 							<button type="button" onClick={onClose}>取消</button>
 							<button type="submit" className="settings-save" disabled={!config || state === 'saving' || testState === 'testing'}>{state === 'saving' ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}保存设置</button>
 						</footer>
```

**File**: `frontend/src/styles.css` (modified, +19/-0)
```diff
@@ -3707,6 +3707,25 @@ a:focus-visible {
 .settings-message.saved { color: var(--theme-green, #167653); }
 .settings-message.error { color: var(--theme-red, #bc303a); }
 .settings-message span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
+.settings-save-notice {
+	position: fixed;
+	top: 50%;
+	left: 50%;
+	transform: translate(-50%, -50%);
+	z-index: 1300;
+	display: flex;
+	align-items: center;
+	gap: 10px;
+	padding: 18px 28px;
+	border: 1px solid var(--theme-green-line, #b9ded0);
+	border-radius: 12px;
+	background: var(--theme-surface, #ffffff);
+	box-shadow: 0 12px 30px var(--theme-shadow, rgba(23, 46, 72, .16));
+	color: var(--theme-green, #167653);
+	font-size: 16px;
+	font-weight: 600;
+	pointer-events: none;
+}
 
 .app-update-status { display: grid; gap: 11px; padding: 13px; border: 1px solid var(--theme-line, #cfe0f2); border-radius: 10px; background: var(--theme-surface-soft, #f7faff); }
 .app-update-status.downloaded { border-color: var(--theme-green-line, #b9dfd0); background: var(--theme-surface-soft, #f1fbf7); }
```

---

### Incident Patch 5: `e8f6e417` (2026-09-30)
**Commit Message**: fix: remove the AI chat workspace topbar

**File**: `frontend/src/App.tsx` (modified, +2/-2)
```diff
@@ -410,7 +410,7 @@ export function App() {
 				</div>
 			</aside>
 			<div className="app-shell">
-			<div className={`workspace-topbar ${workspaceMode !== 'stock-ai' ? `collapsible ${topbarExpanded ? 'expanded' : ''}` : ''}`}>
+			{workspaceMode !== 'ai' && <div className={`workspace-topbar ${workspaceMode !== 'stock-ai' ? `collapsible ${topbarExpanded ? 'expanded' : ''}` : ''}`}>
 				{workspaceMode !== 'stock-ai' && <button
 					type="button"
 					className="topbar-toggle"
@@ -446,7 +446,7 @@ export function App() {
 					</button>
 				</div>
 			</header>
-			</div>
+			</div>}
 
 			{workspaceMode === 'token-usage' ? <TokenUsageWorkspace config={config} refreshKey={tokenUsageRefreshKey} /> : workspaceMode === 'themes' ? <>
 			<section className="market-strip" aria-label="市场概览">
```

**File**: `frontend/src/styles.css` (modified, +2/-2)
```diff
@@ -5098,7 +5098,7 @@ a:focus-visible {
 .ai-chat-workspace {
 	display: grid;
 	grid-template-columns: 250px minmax(0, 1fr);
-	min-height: calc(100vh - 150px);
+	min-height: calc(100vh - 80px);
 	max-width: 1840px;
 	margin: 0 auto;
 	border: 1px solid var(--line);
@@ -5621,7 +5621,7 @@ a:focus-visible {
 }
 
 @media (max-width: 760px) {
-	.ai-chat-workspace { grid-template-columns: 1fr; min-height: calc(100vh - 118px); }
+	.ai-chat-workspace { grid-template-columns: 1fr; min-height: calc(100vh - 80px); }
 	.ai-thread-rail { grid-template-rows: auto auto; border-right: 0; border-bottom: 1px solid var(--line); }
 	.ai-thread-list { display: flex; overflow-x: auto; }
 	.ai-thread-list > button { flex: 0 0 190px; }
```

---

### Incident Patch 6: `874ac8d1` (2026-09-30)
**Commit Message**: fix: improve chat scrolling and simplify workspace layout

**File**: `frontend/src/App.tsx` (modified, +23/-16)
```diff
@@ -5,6 +5,7 @@ import {
 	BookMarked,
 	BookOpen,
 	BrainCircuit,
+	ChevronDown,
 	ChevronRight,
 	Clock3,
 	Database,
@@ -99,6 +100,7 @@ export function App() {
 		return 'themes';
 	});
 	const [sidebarExpanded, setSidebarExpanded] = useState(true);
+	const [topbarExpanded, setTopbarExpanded] = useState(true);
 	const [config, setConfig] = useState<BackendConfig | null>(null);
 	const [themeStrengthWindow, setThemeStrengthWindow] = useState<ThemeStrengthWindow>('daily');
 	const [activeTheme, setActiveTheme] = useState('');
@@ -319,6 +321,7 @@ export function App() {
 	};
 
 	const switchWorkspace = (mode: WorkspaceMode) => {
+		if (mode !== workspaceMode) setTopbarExpanded(true);
 		setWorkspaceMode(mode);
 		window.history.replaceState(null, '', mode === 'limit-up' ? '#limit-up' : mode === 'mastery' ? '#mastery' : mode === 'reviews' ? '#reviews' : mode === 'stock-ai' ? '#stock-ai' : mode === 'portfolio-inspection' ? '#portfolio-inspection' : mode === 'ai' ? '#ai' : mode === 'market' ? '#market/pulse' : mode === 'token-usage' ? '#token-usage' : '#themes');
 	};
@@ -384,10 +387,10 @@ export function App() {
 		? limitUpData ? `${limitUpData.current.trade_date} · ${limitUpData.session_status} · ${limitUpData.meta.source.includes('duanxianxia') ? '开盘啦涨停池' : '东方财富兜底'} · ${limitUpData.concept_status === 'ready' ? '题材已归因' : limitUpState === 'loading' ? '题材补充中' : '题材暂不完整'}` : '开盘啦涨停池优先'
 		: workspaceMode === 'mastery' ? 'GitHub 原始资料 · 每日缓存 · Agent 本地知识库' : workspaceMode === 'reviews' ? '雪球 · 淘股吧 · 微信公众号' : workspaceMode === 'stock-ai' ? '多周期评分 · 基准超额 · 隔日情景 · 动态风控' : workspaceMode === 'portfolio-inspection' ? '逐股分析 · 组合风险 · 后台任务' : workspaceMode === 'ai' ? '本机 Agent AI 对话' : workspaceMode === 'market' ? '全球指数 · 行业资金 · 龙虎榜 · 公告研报' : workspaceMode === 'token-usage' ? '模型输入、输出与功能模块消耗' : themeSourceStatus + ' · ' + streamStatus;
 	const topbarTitle = workspaceMode === 'themes' ? '趋势题材雷达' : workspaceMode === 'limit-up' ? '短线连板雷达' : workspaceMode === 'mastery' ? '游资心法库' : workspaceMode === 'reviews' ? '大V复盘日记' : workspaceMode === 'stock-ai' ? '个股 AI 分析' : workspaceMode === 'portfolio-inspection' ? '持仓 AI 巡检' : workspaceMode === 'market' ? '行情总览' : workspaceMode === 'token-usage' ? 'Token 统计' : 'AI 对话';
-	const topbarDescription = workspaceMode === 'themes' ? '炒作主线、趋势强度、个股梯队与日 K 联动工作台' : workspaceMode === 'limit-up' ? '连板高度、炒作概念与晋级结构工作台' : workspaceMode === 'mastery' ? '阅读不同游资的交易经验，并由 Agent 按原文辅助研读' : workspaceMode === 'reviews' ? '多平台复盘内容、作者观点与原文归档工作台' : workspaceMode === 'stock-ai' ? '多周期评分、隔日情景推演与账户级风控执行工作台' : workspaceMode === 'portfolio-inspection' ? '逐股研判、集中度识别与组合风险巡检工作台' : workspaceMode === 'market' ? '从盘面快讯到资金与研究信号的统一行情工作台' : workspaceMode === 'token-usage' ? '按日、按月和功能模块查看模型 Token 消耗' : '像 Codex 一样持续协作、拆解问题并形成可执行结果';
+	const topbarDescription = workspaceMode === 'themes' ? '炒作主线、趋势强度、个股梯队与日 K 联动工作台' : workspaceMode === 'limit-up' ? '连板高度、炒作概念与晋级结构工作台' : workspaceMode === 'mastery' ? '阅读不同游资的交易经验，并由 Agent 按原文辅助研读' : workspaceMode === 'reviews' ? '多平台复盘内容、作者观点与原文归档工作台' : workspaceMode === 'stock-ai' ? '多周期评分、隔日情景推演与账户级风控执行工作台' : workspaceMode === 'portfolio-inspection' ? '逐股研判、集中度识别与组合风险巡检工作台' : workspaceMode === 'market' ? '从盘面快讯到资金与研究信号的统一行情工作台' : workspaceMode === 'token-usage' ? '按日、按月和功能模块查看模型 Token 消耗' : '';
 
 	return (
-		<main className={`workspace-frame ${sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
+		<main className={`workspace-frame ${sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'} ${workspaceMode === 'ai' ? 'workspace-ai' : ''}`}>
 			<aside className="app-sidebar" aria-label="功能导航">
 				<div className="sidebar-brand"><div className="sidebar-logo"><img src={`${import.meta.env.BASE_URL}easy-stock-mark.svg`} alt="easy-stock" /></div>{sidebarExpanded && <div><strong>easy-stock</strong><span>AI STOCK LAB</span></div>}</div>
 				<nav>
@@ -407,26 +410,29 @@ export function App() {
 				</div>
 			</aside>
 			<div className="app-shell">
-			<header className="topbar">
+			{workspaceMode !==
```

**File**: `frontend/src/components/AIChatWorkspace.tsx` (modified, +8/-24)
```diff
@@ -15,7 +15,7 @@ import {
 } from 'lucide-react';
 import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
 import { AppSettings, BackendConfig, LLMModelOption, LLMModelsResult, LLMProfile, requestJSON } from '../lib/backend';
-import { llmProviderDefaultModel, llmProviderName } from '../lib/llm-providers';
+import { llmProviderDefaultModel } from '../lib/llm-providers';
 import {
 	ChatConversation,
 	ChatMessage,
@@ -78,7 +78,6 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 	const [draft, setDraft] = useState('');
 	const [sending, setSending] = useState(false);
 	const [modelState, setModelState] = useState<ModelState>('loading');
-	const [modelLabel, setModelLabel] = useState('读取模型配置');
 	const [llmConfig, setLLMConfig] = useState<ChatLLMConfig | null>(null);
 	const [llmProfiles, setLLMProfiles] = useState<LLMProfile[]>([]);
 	const [activeLLMProfileID, setActiveLLMProfileID] = useState('');
@@ -98,7 +97,7 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 	const [clarifyDraft, setClarifyDraft] = useState('');
 	const abortRef = useRef<AbortController | null>(null);
 	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
-	const messageEndRef = useRef<HTMLDivElement | null>(null);
+	const messageStageRef = useRef<HTMLDivElement | null>(null);
 	const modelMessageTimerRef = useRef<number | null>(null);
 
 	const activeConversation = useMemo(
@@ -120,7 +119,8 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 	}, [conversations]);
 
 	useEffect(() => {
-		messageEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
+		const stage = messageStageRef.current;
+		stage?.scrollTo({ top: stage.scrollHeight, behavior: 'smooth' });
 	}, [activeConversation?.messages.length, sending]);
 
 	useEffect(() => {
@@ -146,7 +146,6 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 	const loadModel = useCallback(async () => {
 		if (!config) {
 			setModelState('error');
-			setModelLabel('后端尚未连接');
 			setLLMConfig(null);
 			setModelOptions([]);
 			setModelListState('error');
@@ -172,9 +171,6 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 			const usable = agent.available && agent.configured;
 			setLLMConfig(nextLLM);
 			setModelState(usable ? 'ready' : agent.available ? 'missing' : 'error');
-			setModelLabel(usable
-				? `${payload.data.agent_runtime === 'codex' ? 'Codex' : 'Hermes'} · ${llmProviderName(provider)} · ${model}`
-				: agent.message || (agent.available ? '需要配置 Agent 模型' : 'Agent 运行时不可用'));
 
 			try {
 				const models = await requestChatModels(config, nextLLM, payload.data.active_llm_profile_id || profiles[0]?.id || '');
@@ -188,11 +184,10 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 			}
 		} catch (error) {
 			setModelState('error');
-			setModelLabel(error instanceof Error ? error.message : '模型配置读取失败');
 			setLLMConfig(null);
 			setModelOptions([]);
 			setModelListState('error');
-			setModelListMessage('模型配置读取失败');
+			setModelListMessage(error instanceof Error ? error.message : '模型配置读取失败');
 		}
 	}, [config]);
 
@@ -239,7 +234,6 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 			setConversations((current) => clearAgentSessionIDs(current));
 			const usable = payload.data.agent.available && payload.data.agent.configured;
 			setModelState(usable ? 'ready' : payload.data.agent.available ? 'missing' : 'error');
-			setModelLabel(usable ? `${payload.data.agent_runtime === 'codex' ? 'Codex' : 'Hermes'} · ${llmProviderName(active.provider)} · ${active.model}` : payload.data.agent.message || '需要配置 Agent 模型');
 			setModelSwitchState('saved');
 			setModelSwitchMessage(`已切换为 ${profile.name}，下一条消息生效`);
 			window.setTimeout(() => { setModelSwitchState('idle'); setModelSwitchMessage(''); }, 3500);
@
```

**File**: `frontend/src/styles.css` (modified, +81/-52)
```diff
@@ -706,15 +706,57 @@ a:focus-visible {
 	.token-usage-stat > strong { font-size: 21px; }
 }
 
+.workspace-topbar { display: contents; }
+
+.workspace-topbar.collapsible {
+	display: grid;
+	width: 100%;
+	max-width: 1840px;
+	margin: 0 auto 10px;
+}
+
+.workspace-topbar.collapsible .topbar {
+	width: 100%;
+	margin: 10px 0 0;
+}
+
+.topbar[hidden] { display: none; }
+
+.topbar-toggle {
+	display: grid;
+	place-items: center;
+	justify-self: center;
+	width: 48px;
+	height: 20px;
+	padding: 0;
+	border: 1px solid var(--line);
+	border-radius: 6px;
+	background: var(--surface);
+	color: var(--muted);
+	cursor: pointer;
+}
+
+.topbar-toggle:hover {
+	border-color: var(--theme-blue-line, #395879);
+	background: var(--surface-2);
+	color: var(--blue);
+}
+
+.workspace-topbar.expanded .topbar-toggle svg { transform: rotate(180deg); }
+
 .topbar {
 	display: grid;
-	grid-template-columns: minmax(260px, 1fr) auto minmax(280px, 1fr);
+	grid-template-columns: minmax(260px, 1fr) auto;
 	align-items: center;
 	gap: 22px;
 	max-width: 1840px;
 	margin: 0 auto 14px;
 }
 
+.topbar-with-modes {
+	grid-template-columns: minmax(260px, 1fr) auto minmax(280px, 1fr);
+}
+
 .brand-block,
 .top-actions,
 .data-status,
@@ -5057,10 +5099,29 @@ a:focus-visible {
 }
 
 /* Codex-inspired AI conversation workspace. */
+.workspace-frame.workspace-ai {
+	height: 100dvh;
+	min-height: 0;
+	overflow: hidden;
+}
+
+.workspace-ai > .app-shell {
+	display: grid;
+	grid-template-rows: minmax(0, 1fr) auto;
+	min-height: 0;
+	overflow: hidden;
+}
+
+.workspace-ai > .app-sidebar { height: 100%; }
+.workspace-ai .topbar,
+.workspace-ai .data-footer { width: 100%; }
+
 .ai-chat-workspace {
 	display: grid;
 	grid-template-columns: 250px minmax(0, 1fr);
-	min-height: calc(100vh - 150px);
+	grid-template-rows: minmax(0, 1fr);
+	min-height: 0;
+	width: 100%;
 	max-width: 1840px;
 	margin: 0 auto;
 	border: 1px solid var(--line);
@@ -5072,8 +5133,10 @@ a:focus-visible {
 
 .ai-thread-rail {
 	display: grid;
-	grid-template-rows: auto minmax(0, 1fr) auto;
+	grid-template-rows: auto minmax(0, 1fr);
 	min-width: 0;
+	min-height: 0;
+	overflow: hidden;
 	border-right: 1px solid var(--line);
 	background: var(--theme-surface-soft, #f7f9fc);
 }
@@ -5108,7 +5171,10 @@ a:focus-visible {
 	align-content: start;
 	gap: 4px;
 	padding: 9px;
+	min-height: 0;
 	overflow-y: auto;
+	overscroll-behavior: contain;
+	scrollbar-gutter: stable;
 }
 
 .ai-thread-list > button {
@@ -5155,58 +5221,17 @@ a:focus-visible {
 	font-size: 11px;
 }
 
-.ai-local-note {
-	display: grid;
-	grid-template-columns: 10px minmax(0, 1fr);
-	align-items: start;
-	gap: 8px;
-	margin: 9px;
-	padding: 10px;
-	border: 1px solid var(--line-soft);
-	border-radius: 8px;
-	background: var(--theme-surface, #ffffff);
-}
-.ai-local-note .status-dot { margin-top: 4px; }
-.ai-local-note .status-dot.ready { background: var(--theme-green-solid, #1a9a6d); box-shadow: 0 0 0 3px var(--theme-shadow, rgba(26, 154, 109, 0.12)); }
-.ai-local-note .status-dot.missing,
-.ai-local-note .status-dot.error { background: var(--theme-amber-solid, #d08a20); box-shadow: 0 0 0 3px var(--theme-shadow, rgba(208, 138, 32, 0.12)); }
-.ai-local-note > div { display: grid; min-width: 0; gap: 3px; }
-.ai-local-note strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
-.ai-local-note small { color: var(--subtle); font-size: 11px; line-height: 1.4; }
-
 .ai-conversation-panel {
 	display: grid;
-	grid-template-rows: auto minmax(0, 1fr) auto;
+	grid-template-rows: minmax(0, 1fr) auto;
 	min-width: 0;
 	min-height: 0;
 	background: var(--theme-surface, #ffffff);
 }
 
-.ai-conversation-header {
-	display: grid;
-	grid-template-columns: 38px minmax(0, 1fr);
-	align-items: center;
-	gap: 10px;
-	min-height: 68px;
-	padding: 12px 18px;
-	border-bottom: 1px solid var(--line-soft);
-}
-.ai-assistant-avatar {
-	display: grid;
-	place-items: center;
-	width: 38px;
-	height: 38px;
-	border: 1px solid var(--theme-blue-line,
```

---

### Incident Patch 7: `38038e33` (2026-09-30)
**Commit Message**: fix: simplify workspace topbars and expand them by default

**File**: `frontend/src/App.tsx` (modified, +16/-23)
```diff
@@ -100,7 +100,7 @@ export function App() {
 		return 'themes';
 	});
 	const [sidebarExpanded, setSidebarExpanded] = useState(true);
-	const [aiTopbarExpanded, setAITopbarExpanded] = useState(false);
+	const [topbarExpanded, setTopbarExpanded] = useState(true);
 	const [config, setConfig] = useState<BackendConfig | null>(null);
 	const [themeStrengthWindow, setThemeStrengthWindow] = useState<ThemeStrengthWindow>('daily');
 	const [activeTheme, setActiveTheme] = useState('');
@@ -321,7 +321,7 @@ export function App() {
 	};
 
 	const switchWorkspace = (mode: WorkspaceMode) => {
-		if (mode === 'ai' && workspaceMode !== 'ai') setAITopbarExpanded(false);
+		if (mode !== workspaceMode) setTopbarExpanded(true);
 		setWorkspaceMode(mode);
 		window.history.replaceState(null, '', mode === 'limit-up' ? '#limit-up' : mode === 'mastery' ? '#mastery' : mode === 'reviews' ? '#reviews' : mode === 'stock-ai' ? '#stock-ai' : mode === 'portfolio-inspection' ? '#portfolio-inspection' : mode === 'ai' ? '#ai' : mode === 'market' ? '#market/pulse' : mode === 'token-usage' ? '#token-usage' : '#themes');
 	};
@@ -387,7 +387,7 @@ export function App() {
 		? limitUpData ? `${limitUpData.current.trade_date} · ${limitUpData.session_status} · ${limitUpData.meta.source.includes('duanxianxia') ? '开盘啦涨停池' : '东方财富兜底'} · ${limitUpData.concept_status === 'ready' ? '题材已归因' : limitUpState === 'loading' ? '题材补充中' : '题材暂不完整'}` : '开盘啦涨停池优先'
 		: workspaceMode === 'mastery' ? 'GitHub 原始资料 · 每日缓存 · Hermes 本地知识库' : workspaceMode === 'reviews' ? '雪球 · 淘股吧 · 微信公众号' : workspaceMode === 'stock-ai' ? '多周期评分 · 基准超额 · 隔日情景 · 动态风控' : workspaceMode === 'portfolio-inspection' ? '逐股分析 · 组合风险 · 后台任务' : workspaceMode === 'ai' ? '本机 Hermes AI 对话' : workspaceMode === 'market' ? '全球指数 · 行业资金 · 龙虎榜 · 公告研报' : workspaceMode === 'token-usage' ? '模型输入、输出与功能模块消耗' : themeSourceStatus + ' · ' + streamStatus;
 	const topbarTitle = workspaceMode === 'themes' ? '趋势题材雷达' : workspaceMode === 'limit-up' ? '短线连板雷达' : workspaceMode === 'mastery' ? '游资心法库' : workspaceMode === 'reviews' ? '大V复盘日记' : workspaceMode === 'stock-ai' ? '个股 AI 分析' : workspaceMode === 'portfolio-inspection' ? '持仓 AI 巡检' : workspaceMode === 'market' ? '行情总览' : workspaceMode === 'token-usage' ? 'Token 统计' : 'AI 对话';
-	const topbarDescription = workspaceMode === 'themes' ? '炒作主线、趋势强度、个股梯队与日 K 联动工作台' : workspaceMode === 'limit-up' ? '连板高度、炒作概念与晋级结构工作台' : workspaceMode === 'mastery' ? '阅读不同游资的交易经验，并由 Hermes 按原文辅助研读' : workspaceMode === 'reviews' ? '多平台复盘内容、作者观点与原文归档工作台' : workspaceMode === 'stock-ai' ? '多周期评分、隔日情景推演与账户级风控执行工作台' : workspaceMode === 'portfolio-inspection' ? '逐股研判、集中度识别与组合风险巡检工作台' : workspaceMode === 'market' ? '从盘面快讯到资金与研究信号的统一行情工作台' : workspaceMode === 'token-usage' ? '按日、按月和功能模块查看模型 Token 消耗' : '像 Codex 一样持续协作、拆解问题并形成可执行结果';
+	const topbarDescription = workspaceMode === 'themes' ? '炒作主线、趋势强度、个股梯队与日 K 联动工作台' : workspaceMode === 'limit-up' ? '连板高度、炒作概念与晋级结构工作台' : workspaceMode === 'mastery' ? '阅读不同游资的交易经验，并由 Hermes 按原文辅助研读' : workspaceMode === 'reviews' ? '多平台复盘内容、作者观点与原文归档工作台' : workspaceMode === 'stock-ai' ? '多周期评分、隔日情景推演与账户级风控执行工作台' : workspaceMode === 'portfolio-inspection' ? '逐股研判、集中度识别与组合风险巡检工作台' : workspaceMode === 'market' ? '从盘面快讯到资金与研究信号的统一行情工作台' : workspaceMode === 'token-usage' ? '按日、按月和功能模块查看模型 Token 消耗' : '';
 
 	return (
 		<main className={`workspace-frame ${sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
@@ -410,36 +410,29 @@ export function App() {
 				</div>
 			</aside>
 			<div className="app-shell">
-			<div className={`workspace-topbar ${workspaceMode === 'ai' ? `collapsible ${aiTopbarExpanded ? 'expanded' : ''}` : ''}`}>
-				{workspaceMode === 'ai' && <button
+			<div className={`workspace-topbar ${workspaceMode !== 'stock-ai' ? `collapsible ${topbarExpanded ? 'expanded' : ''}` : ''}`}>
+				{workspaceMode !== 'stock-ai' && <button
 					type="button"
 					className="topbar-toggle"
-					onClick={() => setAITopbarExpanded((value) => !value)}
-					aria-expanded={aiTopbarE
```

**File**: `frontend/src/styles.css` (modified, +5/-1)
```diff
@@ -746,13 +746,17 @@ a:focus-visible {
 
 .topbar {
 	display: grid;
-	grid-template-columns: minmax(260px, 1fr) auto minmax(280px, 1fr);
+	grid-template-columns: minmax(260px, 1fr) auto;
 	align-items: center;
 	gap: 22px;
 	max-width: 1840px;
 	margin: 0 auto 14px;
 }
 
+.topbar-with-modes {
+	grid-template-columns: minmax(260px, 1fr) auto minmax(280px, 1fr);
+}
+
 .brand-block,
 .top-actions,
 .data-status,
```

---

### Incident Patch 8: `a07af29c` (2026-09-30)
**Commit Message**: fix: collapse AI chat topbar by default

**File**: `frontend/src/App.tsx` (modified, +15/-1)
```diff
@@ -5,6 +5,7 @@ import {
 	BookMarked,
 	BookOpen,
 	BrainCircuit,
+	ChevronDown,
 	ChevronRight,
 	Clock3,
 	Database,
@@ -99,6 +100,7 @@ export function App() {
 		return 'themes';
 	});
 	const [sidebarExpanded, setSidebarExpanded] = useState(true);
+	const [aiTopbarExpanded, setAITopbarExpanded] = useState(false);
 	const [config, setConfig] = useState<BackendConfig | null>(null);
 	const [themeStrengthWindow, setThemeStrengthWindow] = useState<ThemeStrengthWindow>('daily');
 	const [activeTheme, setActiveTheme] = useState('');
@@ -319,6 +321,7 @@ export function App() {
 	};
 
 	const switchWorkspace = (mode: WorkspaceMode) => {
+		if (mode === 'ai' && workspaceMode !== 'ai') setAITopbarExpanded(false);
 		setWorkspaceMode(mode);
 		window.history.replaceState(null, '', mode === 'limit-up' ? '#limit-up' : mode === 'mastery' ? '#mastery' : mode === 'reviews' ? '#reviews' : mode === 'stock-ai' ? '#stock-ai' : mode === 'portfolio-inspection' ? '#portfolio-inspection' : mode === 'ai' ? '#ai' : mode === 'market' ? '#market/pulse' : mode === 'token-usage' ? '#token-usage' : '#themes');
 	};
@@ -407,7 +410,17 @@ export function App() {
 				</div>
 			</aside>
 			<div className="app-shell">
-			<header className="topbar">
+			<div className={`workspace-topbar ${workspaceMode === 'ai' ? `collapsible ${aiTopbarExpanded ? 'expanded' : ''}` : ''}`}>
+				{workspaceMode === 'ai' && <button
+					type="button"
+					className="topbar-toggle"
+					onClick={() => setAITopbarExpanded((value) => !value)}
+					aria-expanded={aiTopbarExpanded}
+					aria-controls="workspace-topbar-content"
+					aria-label={aiTopbarExpanded ? '收起顶部栏' : '展开顶部栏'}
+					title={aiTopbarExpanded ? '收起顶部栏' : '展开顶部栏'}
+				><ChevronDown size={16} aria-hidden="true" /></button>}
+			<header id="workspace-topbar-content" className="topbar" hidden={workspaceMode === 'ai' && !aiTopbarExpanded}>
 				<div className="brand-block">
 					<div className="brand-mark"><img src={`${import.meta.env.BASE_URL}easy-stock-mark.svg`} alt="easy-stock" /></div>
 					<div>
@@ -440,6 +453,7 @@ export function App() {
 					</button>
 				</div>
 			</header>
+			</div>
 
 			{workspaceMode === 'token-usage' ? <TokenUsageWorkspace config={config} refreshKey={tokenUsageRefreshKey} /> : workspaceMode === 'themes' ? <>
 			<section className="market-strip" aria-label="市场概览">
```

**File**: `frontend/src/styles.css` (modified, +38/-0)
```diff
@@ -706,6 +706,44 @@ a:focus-visible {
 	.token-usage-stat > strong { font-size: 21px; }
 }
 
+.workspace-topbar { display: contents; }
+
+.workspace-topbar.collapsible {
+	display: grid;
+	width: 100%;
+	max-width: 1840px;
+	margin: 0 auto 10px;
+}
+
+.workspace-topbar.collapsible .topbar {
+	width: 100%;
+	margin: 10px 0 0;
+}
+
+.topbar[hidden] { display: none; }
+
+.topbar-toggle {
+	display: grid;
+	place-items: center;
+	justify-self: center;
+	width: 48px;
+	height: 20px;
+	padding: 0;
+	border: 1px solid var(--line);
+	border-radius: 6px;
+	background: var(--surface);
+	color: var(--muted);
+	cursor: pointer;
+}
+
+.topbar-toggle:hover {
+	border-color: var(--theme-blue-line, #395879);
+	background: var(--surface-2);
+	color: var(--blue);
+}
+
+.workspace-topbar.expanded .topbar-toggle svg { transform: rotate(180deg); }
+
 .topbar {
 	display: grid;
 	grid-template-columns: minmax(260px, 1fr) auto minmax(280px, 1fr);
```

---

### Incident Patch 9: `f8b5e1f3` (2026-09-29)
**Commit Message**: fix: improve stock and portfolio report readability

**File**: `frontend/src/styles.css` (modified, +69/-53)
```diff
@@ -252,24 +252,24 @@
 .portfolio-progress-bar i { display: block; height: 100%; border-radius: inherit; background: var(--theme-blue-solid, #3486ad); transition: width .25s ease; }
 .portfolio-progress-bar small { position: absolute; top: -17px; right: 0; color: var(--theme-muted, #6c7d89); font-size: 11px; }
 
-.portfolio-report { display: grid; gap: 13px; }
+.portfolio-report { display: grid; gap: 16px; min-width: 0; container: portfolio-report / inline-size; }
 .portfolio-report-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 16px 2px 12px; border-bottom: 1px solid var(--theme-line, #dce2e6); }
 .portfolio-report-header > div { display: grid; gap: 5px; }
 .portfolio-report-header span { display: flex; align-items: center; gap: 6px; color: var(--theme-blue, #2b769c); font-size: 12px; font-weight: 700; }
 .portfolio-report-header h2 { margin: 0; color: var(--theme-text, #1f3443); font-size: 21px; letter-spacing: 0; }
-.portfolio-report-header p { margin: 0; color: var(--theme-muted, #83909a); font-size: 12px; }
+.portfolio-report-header p { margin: 0; color: var(--theme-muted, #83909a); font-size: 13px; line-height: 1.6; }
 .portfolio-report-overview { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--theme-line, #d9e1e6); border-radius: 6px; background: var(--theme-surface, #fff); }
 .portfolio-report-overview > div { display: grid; gap: 5px; min-height: 92px; padding: 14px; border-right: 1px solid var(--theme-line-soft, #e4e9ec); }
 .portfolio-report-overview > div:last-child { border-right: 0; }
-.portfolio-report-overview span { color: var(--theme-muted, #7d8b96); font-size: 12px; }
+.portfolio-report-overview span { color: var(--theme-muted, #7d8b96); font-size: 13px; }
 .portfolio-report-overview strong { color: var(--theme-text, #263e4e); font-size: 20px; }
-.portfolio-report-overview small { color: var(--theme-subtle, #8a98a2); font-size: 11px; }
+.portfolio-report-overview small { color: var(--theme-subtle, #8a98a2); font-size: 12px; line-height: 1.6; }
 .portfolio-health-score { background: var(--theme-surface-soft, #edf7f2); }
 .portfolio-health-score strong { color: var(--theme-green, #25704e); font-size: 29px; }
 
 .portfolio-executive { padding: 16px 18px; border-left: 4px solid var(--theme-blue-line, #2c769b); background: var(--theme-surface, #fff); }
 .portfolio-executive h3 { margin: 0 0 7px; color: var(--theme-text, #203747); font-size: 12px; }
-.portfolio-executive p { margin: 0; color: var(--theme-muted, #526675); font-size: 13px; line-height: 1.8; }
+.portfolio-executive p { margin: 0; color: var(--theme-muted, #526675); font-size: 15px; line-height: 1.8; overflow-wrap: anywhere; }
 .portfolio-report-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
 .portfolio-report-grid > section,
 .portfolio-limitations { padding: 14px 16px; border: 1px solid var(--theme-line, #dce3e7); border-radius: 6px; background: var(--theme-surface, #fff); }
@@ -278,41 +278,55 @@
 .portfolio-limitations > strong { font-size: 12px; }
 .portfolio-report-grid ul,
 .portfolio-report-grid ol,
-.portfolio-limitations ul { display: grid; gap: 6px; margin: 0; padding-left: 18px; color: var(--theme-muted, #586c7a); font-size: 10px; line-height: 1.6; }
-.portfolio-list-empty { margin: 0; color: var(--theme-subtle, #8b98a2); font-size: 10px; }
+.portfolio-limitations ul { display: grid; gap: 8px; margin: 0; padding-left: 22px; color: var(--theme-muted, #586c7a); font-size: 15px; line-height: 1.8; overflow-wrap: anywhere; }
+.portfolio-list-empty { margin: 0; color: var(--theme-subtle, #8b98a2); font-size: 14px; line-height: 1.75; }
 
 .portfolio-holding-report { border-top: 1px solid var(--theme-line, #dce2e6); border-bottom: 1px solid var(--theme-line, #dce2e6); padding: 14px 0; }
-.portfolio-holding-report > header { display: flex; justify-content: space-between; margin-bottom: 9px; }
+.portfolio-holding-report 
```

---

### Incident Patch 10: `14e82daf` (2026-09-29)
**Commit Message**: fix: enlarge body text while preserving list and heading sizes

**File**: `desktop/review-login-preload.cjs` (modified, +10/-4)
```diff
@@ -26,6 +26,9 @@ function mountLoginCompleteControl() {
         bottom: 24px;
         z-index: 2147483647;
         display: flex;
+        flex-wrap: wrap;
+        box-sizing: border-box;
+        max-width: calc(100vw - 48px);
         align-items: center;
         gap: 12px;
         padding: 12px 12px 12px 16px;
@@ -37,18 +40,21 @@ function mountLoginCompleteControl() {
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         backdrop-filter: blur(12px);
       }
-      .copy { display: grid; gap: 3px; min-width: 190px; }
+      .copy { display: grid; flex: 1 1 190px; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
       strong { font-size: 13px; line-height: 1.2; }
-      small { color: #77879a; font-size: 11px; line-height: 1.35; }
+      small { color: #77879a; font-size: 13px; line-height: 1.35; }
       button {
         min-width: 128px;
-        height: 40px;
+        min-height: 40px;
+        flex-shrink: 0;
+        margin-left: auto;
+        white-space: nowrap;
         padding: 0 16px;
         border: 0;
         border-radius: 10px;
         background: #1677e8;
         color: #fff;
-        font: 650 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
+        font: 650 15px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         cursor: pointer;
         box-shadow: 0 6px 16px rgba(22, 119, 232, .24);
       }
```

**File**: `desktop/xueqiu-login-preload.cjs` (modified, +10/-4)
```diff
@@ -14,6 +14,9 @@ function mountLoginCompleteControl() {
         bottom: 24px;
         z-index: 2147483647;
         display: flex;
+        flex-wrap: wrap;
+        box-sizing: border-box;
+        max-width: calc(100vw - 48px);
         align-items: center;
         gap: 12px;
         padding: 12px 12px 12px 16px;
@@ -25,18 +28,21 @@ function mountLoginCompleteControl() {
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         backdrop-filter: blur(12px);
       }
-      .copy { display: grid; gap: 3px; min-width: 190px; }
+      .copy { display: grid; flex: 1 1 190px; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
       strong { font-size: 13px; line-height: 1.2; }
-      small { color: #77879a; font-size: 11px; line-height: 1.35; }
+      small { color: #77879a; font-size: 13px; line-height: 1.35; }
       button {
         min-width: 128px;
-        height: 40px;
+        min-height: 40px;
+        flex-shrink: 0;
+        margin-left: auto;
+        white-space: nowrap;
         padding: 0 16px;
         border: 0;
         border-radius: 10px;
         background: #1677e8;
         color: #fff;
-        font: 650 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
+        font: 650 15px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         cursor: pointer;
         box-shadow: 0 6px 16px rgba(22, 119, 232, .24);
       }
```

**File**: `frontend/src/components/KLineChart.tsx` (modified, +2/-2)
```diff
@@ -63,8 +63,8 @@ export function KLineChart({ lines, symbol, state = 'ready', mode = 'daily', per
 	const sorted = [...lines].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
 	const width = 960;
 	const height = 430;
-	const left = 52;
-	const right = 72;
+	const left = 68;
+	const right = 84;
 	const chartTop = 20;
 	const chartBottom = 316;
 	const volumeTop = 338;
```

**File**: `frontend/src/components/stock-research.css` (modified, +23/-20)
```diff
@@ -1,12 +1,12 @@
-.stock-research-options { display:flex; align-items:center; flex-wrap:wrap; gap:12px; padding:10px 0; color:var(--theme-text, #4b535b); font-size:12px; }
+.stock-research-options { display:flex; align-items:center; flex-wrap:wrap; gap:12px; padding:10px 0; color:var(--theme-text, #4b535b); font-size:14px; }
 .stock-research-options [role=group] { display:flex; border:1px solid var(--theme-line, #d9dce1); border-radius:5px; overflow:hidden; }
 .stock-research-options button { min-height:32px; padding:6px 12px; border:0; background:var(--theme-surface, #fff); color:var(--theme-text, #4b535b); }
 .stock-research-options button.active { background:var(--theme-surface-soft, #e4f1eb); color:var(--theme-text, #176345); font-weight:600; }
 .stock-research-options label { display:flex; gap:8px; align-items:center; }
 .stock-research-options select,.stock-research-options input { min-height:32px; max-width:140px; border:1px solid var(--theme-line, #d9dce1); border-radius:4px; background:var(--theme-surface, white); padding:4px 8px; }
-.stock-research-progress { display:flex; gap:9px; align-items:center; min-height:40px; background:var(--theme-surface-soft, #edf4ef); color:var(--theme-text, #285d43); padding:9px 12px; font-size:12px; border-left:3px solid var(--theme-green-line, #398b60); }
+.stock-research-progress { display:flex; gap:9px; align-items:center; min-height:40px; background:var(--theme-surface-soft, #edf4ef); color:var(--theme-text, #285d43); padding:9px 12px; font-size:14px; border-left:3px solid var(--theme-green-line, #398b60); }
 .stock-research-progress-message { flex:1; min-width:0; overflow-wrap:anywhere; }
-.stock-research-progress-elapsed { flex:0 0 auto; color:inherit; font-size:13px; font-variant-numeric:tabular-nums; white-space:nowrap; }
+.stock-research-progress-elapsed { flex:0 0 auto; color:inherit; font-size:15px; font-variant-numeric:tabular-nums; white-space:nowrap; }
 .stock-research-progress button { display:grid; place-items:center; width:30px; height:30px; border:1px solid var(--theme-line, #c9d5cd); border-radius:4px; background:var(--theme-surface, white); }
 .stock-research-progress.degraded,.stock-research-progress.failed,.stock-research-progress.interrupted,.stock-research-progress.cancelled { background:var(--theme-amber-soft, #f7f1e7); border-color:var(--theme-amber-line, #ad852e); color:var(--theme-amber, #756020); }
 .stock-research-history { padding:6px 0 12px; }
@@ -19,14 +19,17 @@
 .stock-research-history time { color:var(--theme-muted, #757a80); font-size:10px; }
 .stock-research-history article span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--theme-muted, #747a81); }
 .stock-research-history article>button:last-child { background:transparent; border:0; width:26px; flex-shrink:0; color:var(--theme-muted, #6b727b); }
-.stock-research-report { min-width:0; background:var(--theme-surface, white); color:var(--theme-text, #30363c); font-size:15px; line-height:1.7; }
+.stock-research-report { min-width:0; background:var(--theme-surface, white); color:var(--theme-text, #30363c); font-size:17px; line-height:1.7; }
 .stock-research-report * { box-sizing:border-box; letter-spacing:0; }
 .stock-research-report p { margin:6px 0; overflow-wrap:anywhere; }
 .stock-research-report h3 { font-size:24px; margin:6px 0 14px; line-height:1.4; }
 .stock-research-report h4 { font-size:17px; margin:0 0 13px; color:var(--theme-text, #20282f); }
 .stock-research-report-header { display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid var(--theme-line-soft, #e4e6e8); }
 .stock-research-report-header>div:first-child { display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
-.stock-research-report-header span { font-size:13px; color:var(--theme-muted, #68716b); }
+.stock-research-report-header span { font-size:15px; color:var(--theme-muted, #68716b); }
+.stock-research-report-header str
```

#### Recent Merged Pull Requests:
- **PR #5** (closed): feat: 概念维度贯通（梯队概念云 / 选股概念列 / 自选概念标签） (@kkion111)
- **PR #4** (closed): feat: 策略选股引擎（内置 17 策略 + 指标流水线） (@kkion111)
- **PR #3** (closed): feat: 工作台市场看板（借鉴 tick-stock-panel） (@kkion111)
- **PR #2** (closed): feat: integrate chan.py engine and add 缠论选股 workspace (@kkion111)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

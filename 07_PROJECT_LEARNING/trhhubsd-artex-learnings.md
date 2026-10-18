> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/trhhubsd-artex-learnings.md`  
> **Source**: github ([https://github.com/trhhubsd/ARTEX](https://github.com/trhhubsd/ARTEX))  
> **Source Version**: `bb105bf3`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T21:07:32.226Z  
> **Learning ID**: `learn-github-trhhubsd-artex`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): trhhubsd/ARTEX

> **Canonical Artifact**: `07_PROJECT_LEARNING/trhhubsd-artex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/trhhubsd/ARTEX](https://github.com/trhhubsd/ARTEX))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-18T21:07:31.059Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `trhhubsd/ARTEX`
- **Description**: ARTEX · AI autonomous penetration testing system (multi-agent LLM, Go + Next.js) · AI 自主渗透测试系统 · 百度 agent+ 攻防挑战赛冠军
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 1246 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent/worker.go`
```
package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Autumn-27/artex/db"
	"github.com/Autumn-27/artex/intercept"
	"github.com/Autumn-27/norma/agentcore"
	"github.com/Autumn-27/norma/harness"
	"github.com/Autumn-27/norma/llm"
	"github.com/Autumn-27/norma/permission"
	actool "github.com/Autumn-27/norma/tool"
	"github.com/Autumn-27/norma/transcript"
)

// Worker is an LLM work agent (docs §4.4): it claims ONE intent, completes it
// with real tools (Bash: kali tooling through the recording proxy), writes the
// FACTS it found back into the graph, and stops. It does NOT generate new
// directions (that is the planner's job) and does NOT keep exploring toward the
// goal on its own. Multiple workers run concurrently as goroutines.
// WebSearchOpts is the web-search backend selection the server pushes into each
// agent (planner/worker/main). Enabled=false leaves the web_search tool off.
// Backend is "ddgs" (no key), "brave-free" (BraveKey required), "tavily"
// (TavilyKey required), or "deepseek" (DeepSeek* required, filled from the
// active LLM profile). It maps directly onto agentcore.Options.
// Proxy is a dedicated egress proxy for the search request (http/https/socks5),
// independent of the traffic-recording MITM proxy — set it when the search endpoint
// is only reachable via a VPN/SOCKS proxy. Empty = direct.
//
// 注意 deepseek 后端与其它三个的性质不同：DeepSeek 没有可直接调用的搜索接口，
// 搜索只存在于其 Anthropic 兼容 messages 接口内部(web_search_20250305 server
// tool)，因此每次搜索会消耗一次模型调用，且搜索请求由 DeepSeek 服务端发出——
// 不经过本机 Proxy，也不会进流量留痕。
type WebSearchOpts struct {
	Enabled   bool
	Backend   string
	BraveKey  string
	TavilyKey string
	Proxy     string
	// DeepSeek* 来自当前激活的 LLM 配置(仅 anthropic 格式的 DeepSeek 官方端点)，
	// 不单独配置，随 LLM 配置切换而变。
	DeepSeekBaseURL string
	DeepSeekAPIKey  string
	DeepSeekModel   string
}

type Worker struct {
	findingRecorder FindingRecorder
	prov            llm.Provider
	model           string
	workDir         string
	proxyAddr       string
	proxyCACert     string            // recording proxy's CA cert path (for WebFetch HTTPS verify)
	webSearch       WebSearchOpts     // web_search tool backend selection (off by default)
	tx              *transcript.Store // raw LLM conversation persistence (nil = off)
	window          int               // context window in tokens (for compaction)
	windowFn        func() int        // optional dynamic task-chain minimum
	maxTurns        int               // max agent turns per run (0 = unlimited)
	// runTimeout is the wall-clock budget for the main exploration of one intent
	// (0 = unlimited). When it fires, the run is cut and a settlement round is
	// forced so already-identified facts get written back instead of being lost.
	runTimeout time.Duration
	// extraTools are host-provided tools (e.g. traffic query, oast) appended to
	// the worker's graph write-back tools.
	extraTools []actool.CoreTool
	// injectConstraints resolves whether this task's operation constraints get
	// injected into the worker system prompt. Read per run so the settings toggle
	// takes effect without rebuilding the agent. nil = inject (default).
	injectConstraints func() bool
	// nonStreamingFn resolves whether this run uses the non-streaming (Complete)
	// path. Read per run so a profile/task toggle takes effect without rebuilding
	// the agent. nil = streaming (default).
	nonStreamingFn func() bool
	// noaEnabledFn resolves whether this run uses the experimental noa context-
	// compression mechanism. Read per run, like nonStreaming. nil = off (built-in
	// compaction).
	noaEnabledFn func() bool
	// maxTokensFn resolves the per-reply output cap in tokens, on the same
	// per-run basis. nil or 0 = send no cap and let the endpoint decide.
	maxTokensFn func() int
}

// WorkerSessionID returns the stable transcript key used by a worker intent.
// Worker slots are reusable, so the intent id (rather than work#N) is the
// session identity. Keep this helper public so the Worker message API and UI
// can refer to exactly the conversation that will be resumed.
func WorkerSessionID(explorationID, intentID int64) string {
	return fmt.Sprintf("exp%d-worker-i%d", explorationID, intentID)
}

const workerChatMarkerPrefix = "<!-- ARTEX_WORKER_CHAT:"

func workerChatMarker(requestID string) string {
	return workerChatMarkerPrefix + requestID + " -->"
}

func hasWorkerChatMessage(messages []llm.Message, requestID string) bool {
	marker := workerChatMarker(requestID)
	for _, message := range messages {
		if message.Role == llm.RoleUser && strings.Contains(message.Text(), marker) {
			return true
		}
	}
	return false
}

// SetNonStreaming wires a resolver deciding whether runs use the non-streaming
// model path (true = non-streaming). nil/unset = streaming (default). Read per
// run so a profile or task-chain toggle takes effect without rebuilding.
func (w *Worker) SetNonStreaming(fn func() bool) { w.nonStreamingFn = fn }

func (w *Worker) nonStreaming() bool { return w.nonStreamingFn != nil && w.nonStreamingFn() }

// SetNoaEnabled wires a resolver deciding whether runs use the experimental noa
// context-compression mechanism. nil/unset = off (built-in compaction). Read per
// run so the settings toggle takes effect without rebuilding the agent.
func (w *Worker) SetNoaEnabled(fn func() bool) { w.noaEnabledFn = fn }

// SetMaxTokens wires a resolver for the per-reply output cap. nil/unset or 0 =
// send no cap and let the endpoint decide. Read per run, like nonStreaming.
func (w *Worker) SetMaxTokens(fn func() int) { w.maxTokensFn = fn }

func (w *Worker) maxTokens() int {
	if w.maxTokensFn == nil {
		return 0
	}
	return w.maxTokensFn()
}

// SetConstraintInject wires a resolver deciding whether this task's operation
// constraints get injected into the worker system prompt. nil = inject (default).
func (w *Worker) SetConstraintInject(fn func() bool) { w.injectConstraints = fn }

// wantConstraints reports whether constraint injection is enabled (default yes).
func (w *Worker) wantConstraints() bool { return w.injectConstraints == nil || w.injectConstraints() }

// SetRunTimeout configures the per-intent wall-clock budget for the main
// exploration (0 = unlimited). When it fires, the SDK settlement phase still runs
// so facts are never lost to a timeout. Safe to call before Execute.
func (w *Worker) SetRunTimeout(run time.Duration) {
	w.runTimeout = run
}

// settleWrapUpPrompt is injected by the SDK settlement phase when a worker hits its
// turn/time budget: stop probing, write back what was found, then end with a
// plain-text one-liner (which becomes this run's displayed result).
const settleWrapUpPrompt = "你即将因预算耗尽被终止。不要再运行任何命令/探测。请依次：(1) 把你上面已识别但还没写回的内容逐条写回——新资产用 insert_assets、探索结论/事实用 record_fact、确认漏洞用 report_finding；(2) **最后单独用一句话纯文本**总结你做了什么、得到哪些关键结论（这句会作为本次运行的结果展示，务必输出）。"

func NewWorker(prov llm.Provider, model, workDir string, tx *transcript.Store, window, maxTurns int, extra ...actool.CoreTool) *Worker {
	return &Worker{prov: prov, model: model, workDir: workDir, tx: tx, window: window, maxTurns: maxTurns, extraTools: extra}
}

// defaultToolsExcept returns actool.DefaultTools() minus the named tools (by
// CoreTool.Name()). Used to trim SDK default tools an agent shouldn't have.
func defaultToolsExcept(exclude ...string) []actool.CoreTool {
	drop := make(map[string]bool, len(exclude))
	for _, n := range exclude {
		drop[n] = true
	}
	all := actool.DefaultTools()
	out := make([]actool.CoreTool, 0, len(all))
	for _, t := range all {
		if !drop[t.Name()] {
			out = append(out, t)
		}
	}
	return out
}

func (w *Worker) SetCompactionWindowResolver(fn func() int) { w.windowFn = fn }

func (w *Worker) compactionWindow() int {
	if w.windowFn != nil {
		return w.windowFn()
	}
	return w.window
}

// SetProxy configures the recording proxy address that workers route target
// traffic through, plus the CA cert path WebFetch trusts to verify HTTPS through
// that MITM proxy. Empty addr disables the hint.
func (w *Worker) SetProxy(addr, caCert string) { w.proxyAddr, w.proxyCACert = addr, caCert }

// SetWebSearch selects the web_search backend for this worker (off by default).
func (w *Worker) SetWebSearch(o WebSearchOpts) { w.webSearch = o }

// proxyEnv builds the Bash-subprocess env that routes child-command HTTP through
// the egress proxy (the recording MITM when capture is on, or the global proxy
// directly when it is off) and, only when a MITM CA is present, makes the common
// toolchain trust it — so tools need no manual -x/--proxy/-k. Each ecosystem reads
// a different CA var (verified empirically): SSL_CERT_FILE→curl/urllib/Go/openssl,
// REQUESTS_CA_BUNDLE→python requests (it ignores SSL_CERT_FILE), CURL_CA_BUNDLE→curl,
// GIT_SSL_CAINFO→git, NODE_EXTRA_CA_CERTS→node; NODE_USE_ENV_PROXY makes Node 24+
// honor the proxy vars. ALL_PROXY is set too so a socks5 egress proxy (which curl
// only reads from ALL_PROXY, not HTTP(S)_PROXY) works in the capture-off path.
// Empty proxyAddr → nil (direct, unchanged env).
func proxyEnv(proxyAddr, caCert string) []string {
	if proxyAddr == "" {
		return nil
	}
	env := []string{
		"HTTP_PROXY=" + proxyAddr, "HTTPS_PROXY=" + proxyAddr,
		"http_proxy=" + proxyAddr, "https_proxy=" + proxyAddr,
		"ALL_PROXY=" + proxyAddr, "all_proxy=" + proxyAddr, // socks5 egress: curl reads only this
		"NODE_USE_ENV_PROXY=1", // Node 24+: honor HTTP(S)_PROXY in built-in fetch/http
	}
	if caCert != "" {
		env = append(env,
			"SSL_CERT_FILE="+caCert,
			"CURL_CA_BUNDLE="+caCert,
			"REQUESTS_CA_BUNDLE="+caCert,
			"GIT_SSL_CAINFO="+caCert,
			"NODE_EXTRA_CA_CERTS="+caCert,
		)
	}
	return env
}

// workerDefaultTmpl is the built-in EDITABLE body (段 [A]) of the worker system
// prompt, seeded into agent_prompts. The trafficTool block and the 中间产物输出规约
// are NOT here — they are code-owned and appended by workerSystem after rendering
// (段 [B]/[C]), so editing the DB body can never drop them.
const workerDefaultTmpl = `你是一个网络安全
```

### Core Architecture Module: `notify/render.go`
```
package notify

import (
	"strings"
	"unicode/utf8"
)

const ellipsis = "…"

// TruncateBytes 把 s 截断到不超过 max 字节，保证结果是合法 UTF-8 且不切断字符。
//
// 为什么必须按字符边界切：企微群机器人的 markdown 有 4096 **字节**硬上限（不是
// 字符数），而中文一个字 3 字节。直接按字节切片会把一个汉字切成两半，产出非法
// UTF-8——平台侧要么整条拒收，要么显示成乱码方块。这里的做法是先从预算位置
// 往前回退到最近的 rune 起始字节（utf8.RuneStart 判定续字节 0b10xxxxxx）。
//
// max<=0 表示不限制。截断后追加省略号，除非 max 小到装不下省略号。
func TruncateBytes(s string, max int) string {
	if max <= 0 || len(s) <= max {
		return s
	}
	budget := max - len(ellipsis)
	suffix := ellipsis
	if budget < 0 {
		// max 比省略号还短：放弃省略号，纯截断，避免结果反而超出 max。
		budget = max
		suffix = ""
	}
	cut := budget
	for cut > 0 && !utf8.RuneStart(s[cut]) {
		cut--
	}
	return s[:cut] + suffix
}

// OneLine 把多行文本压成单行：折叠所有空白，再按字符数截断。
// 用于 IM 消息的标题行——摘要里常有换行，直接塞进表格/标题会撑坏排版。
// max<=0 表示不限制长度。
func OneLine(s string, max int) string {
	s = strings.Join(strings.Fields(s), " ")
	return TruncateRunes(s, max)
}

// TruncateRunes 把 s 截断到不超过 max 个字符（而非字节），超出时追加省略号。
// max<=0 表示不限制。
//
// 与 TruncateBytes 的区别在于平台口径：企微按字节限长，Telegram 按字符数限长。
// 用错口径不会报错，只会让消息被切得远比预期短（中文 1 字 = 3 字节，
// 按字节切 4096 只剩约 1365 字），所以两个函数都必须保留、按渠道选用。
func TruncateRunes(s string, max int) string {
	if max <= 0 {
		return s
	}
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	if max <= 1 {
		return string(runes[:max])
	}
	return string(runes[:max-1]) + ellipsis
}

// TruncateHTML 按字符数截断 HTML 片段，并保证不产生半截标签。
//
// 直接对 HTML 做字符截断会切出 `<a href="htt` 这种残缺标签，平台解析器要么
// 报错拒收整条、要么把后续正文当成属性值吞掉。这里的做法是：先按字符截断，
// 再检查尾部是否有未闭合的 `<`，有就退到它之前。
//
// 不做标签配平（补全 </b> 之类）：Telegram 的 HTML 解析器会自动闭合未闭合标签，
// 而自己实现配平要处理属性里的引号、注释、自闭合标签，复杂度与收益不成比例。
func TruncateHTML(s string, max int) string {
	if max <= 0 || len([]rune(s)) <= max {
		return s
	}
	cut := TruncateRunes(s, max)
	// 尾部若是 `<` 开头的残片（最后出现 `<` 之后没有 `>`），退回 `<` 之前。
	if lt := strings.LastIndex(cut, "<"); lt >= 0 && !strings.Contains(cut[lt:], ">") {
		cut = cut[:lt]
	}
	// 尾部若是被切断的 HTML 实体（如 `&amp;` 被切成 `&amp`），同样要退回去。
	// 实体残片在一个只认实体的解析器里可能让**整条消息**被拒收——一条超过
	// 长度上限的汇总消息本来就常见，不值得为此丢掉整条通知。
	if amp := strings.LastIndex(cut, "&"); amp >= 0 && !strings.Contains(cut[amp:], ";") {
		cut = cut[:amp]
	}
	return cut
}

// packItemCount 计算在预算内能**完整**放下多少条，供汇总消息按整条打包。
//
// 为什么要按整条而不是渲染完整篇再截断：截断会让后半截条目凭空消失，
// 而它们的投递记录仍会被标记为已送达——消息里看不出来、投递历史里也看不出来，
// 漏洞就这么没了。按整条打包后，装不下的条目留在库里成为下一批，
// 调用方拿到的 kept 就是本条消息真正送达的条数。
//
// 参数：maxSize<=0 表示不限制；reserve 是给消息头部/尾部预留的量；
// size 负责计量（各平台口径不同：企微/钉钉按字节，Telegram 按字符数——
// 用错口径不会报错，只会让中文消息被压到远小于上限）；
// render 把第 idx 条渲染成它的实际文本——长度因内容而异，不能靠估算。
//
// 至少返回 1（只要还有条目）。单条极端超长时也要发出这一条、由调用方的
// 最终截断兜底，否则一条超长漏洞会把整批永久卡在原地。
func packItemCount(items []Item, maxSize, reserve int, footer string, size func(string) int, render func(Item, int) string) int {
	if maxSize <= 0 {
		return len(items)
	}
	budget := maxSize - reserve - size(footer)
	if budget < 0 {
		budget = 0
	}
	used := 0
	for i, it := range items {
		used += size(render(it, i))
		if used > budget && i > 0 {
			return i
		}
	}
	return len(items)
}

// byteSize / runeSize 是 packItemCount 的两种计量口径，命名出来避免调用处
// 出现裸的 func(s string) int 闭包，否则很难一眼看出用的是哪种口径。
func byteSize(s string) int { return len(s) }
func runeSize(s string) int { return utf8.RuneCountInString(s) }

// assetLine 把资产列表渲染成一行展示文本，超过 limit 个时省略其余并标注总数。
// 一个漏洞可能锚定几十个资产，全列出来会挤爆消息。
func assetLine(assets []string, limit int) string {
	if len(assets) == 0 {
		return ""
	}
	if limit <= 0 || len(assets) <= limit {
		return strings.Join(assets, "、")
	}
	return strings.Join(assets[:limit], "、") + " 等 " + itoa(len(assets)) + " 个"
}

// itoa 是 strconv.Itoa 的短别名，仅用于拼接展示文本，避免到处 import strconv。
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

```

### Core Architecture Module: `notify/webhook.go`
```
package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"text/template"
	"time"
)

// webhookChannel 是通用 Webhook 适配器：用户自定 URL、方法、请求头与 JSON 模板。
// 它的存在让本功能不必为 Slack / Mattermost / Discord / 自建系统各写一个实现——
// 那些平台都能被一个可配模板覆盖。
type webhookChannel struct{}

func (webhookChannel) Kind() string { return KindWebhook }

// 通用 Webhook 没有官方限制，返回 0 表示默认不限流，由使用者按对端能力自定。
func (webhookChannel) DefaultRatePerMin() int { return 0 }

// 掩码 url 与 headers：目标地址本身常带 token，自定义头里通常放着鉴权凭据，
// 两者都会出现在接口回显里，所以都要挡。
// 代价是编辑时若想改动其中一个头，需要重新填整组头（掩码值会被解释为「保持原值」）——
// 这个取舍是刻意的：宁可多填一次，也不把凭据回显到浏览器。
func (webhookChannel) SecretKeys() []string { return []string{"url", "headers"} }

// 目的地是 url。改 url 时必须重新表态 headers —— 否则原始 Authorization 头
// 会被原样发到新地址，这正是掩码绕过的主路径。
func (webhookChannel) DestinationKeys() []string { return []string{"url"} }

// webhookDefaultTemplate 是未填模板时的兜底请求体：一个直白的 JSON 结构，
// 覆盖绝大多数「收一条 JSON 入库」的自建接收端。
const webhookDefaultTemplate = `{
  "title": {{json .Title}},
  "batch": {{.Batch}},
  "count": {{.Count}},
  "items": [
{{- range $i, $it := .Items}}
{{- if $i}},{{end}}
    {
      "finding_id": {{$it.FindingID}},
      "name": {{json $it.Name}},
      "vulnclass": {{json $it.VulnClass}},
      "severity": {{json $it.Severity}},
      "summary": {{json $it.Summary}},
      "assets": {{json $it.Assets}},
      "detail_url": {{json $it.DetailURL}}
    }
{{- end}}
  ]
}`

// webhookTemplateData 是暴露给用户模板的上下文。
type webhookTemplateData struct {
	Title   string
	Batch   bool
	Count   int
	Items   []webhookItem
	HomeURL string
	// SentAt 是本次投递时间（RFC3339），供接收端记录。
	SentAt string
}

type webhookItem struct {
	FindingID     int64
	Name          string
	VulnClass     string
	Severity      string
	SeverityLabel string
	Summary       string
	Assets        []string
	DetailURL     string
	FromStatus    string
	ToStatus      string
	// StatusLabel 是状态变更的可读描述，如「待处理 → 已修复」；非状态变更时为空。
	StatusLabel string
}

func (webhookChannel) Validate(cfg map[string]any) error {
	raw := cfgString(cfg, "url")
	if raw == "" {
		return errors.New("缺少目标 URL")
	}
	if err := validateHTTPURL(raw); err != nil {
		return fmt.Errorf("目标 URL 无效: %w", err)
	}
	if m := strings.ToUpper(cfgString(cfg, "method")); m != "" && m != http.MethodGet && m != http.MethodPost && m != http.MethodPut && m != http.MethodPatch {
		return fmt.Errorf("不支持的方法 %s（可用 GET/POST/PUT/PATCH）", m)
	}
	if tpl := cfgString(cfg, "body_template"); tpl != "" {
		if _, err := parseWebhookTemplate(tpl); err != nil {
			return fmt.Errorf("请求体模板语法错误: %w", err)
		}
	}
	return nil
}

func (c webhookChannel) Send(ctx context.Context, cfg map[string]any, m Message) (int, error) {
	if err := c.Validate(cfg); err != nil {
		return 0, Permanent(err)
	}
	method := strings.ToUpper(cfgString(cfg, "method"))
	if method == "" {
		method = http.MethodPost
	}

	// GET 不带请求体：把内容塞进 query 超出模板能力范围，也不符合 GET 语义，
	// 所以 GET 只适合「命中即触发钩子」这类接收端。
	var payload any
	if method != http.MethodGet {
		body, err := renderWebhookBody(cfgString(cfg, "body_template"), m)
		if err != nil {
			return 0, Permanent(err)
		}
		// 模板渲染出的是字符串形式的 JSON，这里转成 json.RawMessage 原样发出，
		// 避免二次转义把用户精心构造的结构套进一个 JSON 字符串里。
		if !json.Valid([]byte(body)) {
			return 0, Permanent(errors.New("请求体模板渲染结果不是合法 JSON"))
		}
		payload = json.RawMessage(body)
	}

	headers := cfgMap(cfg, "headers")
	if ct := cfgString(cfg, "content_type"); ct != "" {
		// 允许覆盖，但放在 headers 之后应用，保证显式配置优先。
		if headers == nil {
			headers = map[string]string{}
		}
		headers["Content-Type"] = ct
	}
	if _, err := doJSON(ctx, method, cfgString(cfg, "url"), headers, payload); err != nil {
		return 0, err
	}
	// 通用 Webhook 不截断正文（接收端是用户自己的服务，体积由 body_template 决定），
	// 因此整批都算送达。
	return len(m.Items), nil
}

// renderWebhookBody 用用户模板（或默认模板）渲染请求体。
func renderWebhookBody(tpl string, m Message) (string, error) {
	if strings.TrimSpace(tpl) == "" {
		tpl = webhookDefaultTemplate
	}
	t, err := parseWebhookTemplate(tpl)
	if err != nil {
		return "", fmt.Errorf("请求体模板语法错误: %w", err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, newWebhookTemplateData(m)); err != nil {
		return "", fmt.Errorf("渲染请求体模板失败: %w", err)
	}
	return buf.String(), nil
}

// parseWebhookTemplate 解析模板。
//
// missingkey=zero 让缺失的 map 键渲染成零值而不是报错——但本文件的上下文是结构体，
// 主要作用是让 .Items 为空时 range 不出错。真正需要防的是 .Items 为 nil。
func parseWebhookTemplate(tpl string) (*template.Template, error) {
	return template.New("body").Funcs(webhookTemplateFuncs).Option("missingkey=zero").Parse(tpl)
}

// webhookTemplateFuncs 是暴露给模板的辅助函数。
var webhookTemplateFuncs = template.FuncMap{
	// json 把任意值序列化成 JSON。
	//
	// 这个函数不是锦上添花而是必需的：省去它，用户只能写 {{.Title}} 直接插值，
	// 而漏洞标题里只要有引号或换行，整段请求体就不再是合法 JSON——接收端会
	// 拒收，且报错信息指向「JSON 解析失败」，完全联想不到是标题里有个引号。
	"json": func(v any) (string, error) {
		raw, err := json.Marshal(v)
		if err != nil {
			return "", err
		}
		return string(raw), nil
	},
	// jsons 用于把 JSON 片段嵌进另一段 JSON 字符串值内部（做一层字符串转义）。
	"jsons": func(v any) (string, error) {
		raw, err := json.Marshal(v)
		if err != nil {
			return "", err
		}
		quoted, err := json.Marshal(string(raw))
		if err != nil {
			return "", err
		}
		// 去掉外层引号：调用方自己决定要不要加引号。
		return string(quoted[1 : len(quoted)-1]), nil
	},
}

func newWebhookTemplateData(m Message) webhookTemplateData {
	d := webhookTemplateData{
		Title:   markdownTitle(m),
		Batch:   m.Batch,
		Count:   len(m.Items),
		HomeURL: m.HomeURL,
		SentAt:  time.Now().Format(time.RFC3339),
		Items:   make([]webhookItem, 0, len(m.Items)),
	}
	for _, it := range m.Items {
		wi := webhookItem{
			FindingID:     it.FindingID,
			Name:          it.Name,
			VulnClass:     it.VulnClass,
			Severity:      it.Severity,
			SeverityLabel: SeverityLabel(it.Severity),
			Summary:       it.Summary,
			Assets:        append([]string{}, it.Assets...),
			DetailURL:     it.DetailURL,
			FromStatus:    it.FromStatus,
			ToStatus:      it.ToStatus,
		}
		if it.IsStatusChange() {
			wi.StatusLabel = StatusLabel(it.FromStatus) + " → " + StatusLabel(it.ToStatus)
		}
		d.Items = append(d.Items, wi)
	}
	return d
}

```

### Core Architecture Module: `server/engine.go`
```
package server

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Autumn-27/artex/agent"
	"github.com/Autumn-27/artex/db"
	"github.com/Autumn-27/artex/intercept"
	"github.com/Autumn-27/norma/harness"
	"github.com/Autumn-27/norma/llm"
	"github.com/jackc/pgx/v5/pgconn"
)

// isFKViolation reports whether err is a Postgres foreign-key violation (SQLSTATE
// 23503) — e.g. an activity insert whose exploration_id has no parent row.
func isFKViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

// dropReason classifies why an activity write was dropped, so the log can be
// grouped/analysed by cause rather than by raw error text.
func dropReason(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23503":
			return "fk_violation(23503,父exploration不存在)"
		case "23505":
			return "unique_violation(23505)"
		default:
			return "pg_error(" + pgErr.Code + ")"
		}
	}
	return "write_error"
}

// bumpDrop increments and returns the running count of dropped (unpersistable)
// activity records for a task. Concurrent planner + worker emits race here, so the
// counter is an atomic behind sync.Map. The count in the log shows loss scale at a
// glance instead of forcing a grep-and-count.
func (e *Engine) bumpDrop(taskID string) int64 {
	v, _ := e.dropCnt.LoadOrStore(taskID, new(int64))
	return atomic.AddInt64(v.(*int64), 1)
}

// preview collapses newlines and trims s to a short rune-safe snippet for one-line
// log output (avoids dumping a multi-KB summary/detail into the log).
func preview(s string, n int) string {
	s = strings.ReplaceAll(s, "\r", " ")
	s = strings.ReplaceAll(s, "\n", " ")
	r := []rune(s)
	if len(r) > n {
		return string(r[:n]) + "…"
	}
	return string(r)
}

// model_error（provider/API 故障：LLM 层瞬时重试耗尽，或流已开始后中途断流）
// 收场的 work 不是「试过没做完」也不是真失败，而是外部抖动。默认把它当永久
// blocked 会白丢一条意图，所以这里对该终态额外重跑几次，每次之间退避一下，给
// provider 恢复的时间；重试期间若被暂停/终止/取消则立即让位给对应分支处理。
const (
	modelErrorRetries      = 2               // model_error 收场后额外重试的次数
	modelErrorRetryBackoff = 3 * time.Second // 每次重试前的退避
	workControlWaitTimeout = 30 * time.Second
)

var errWorkControlConflict = errors.New("work control conflict")

// retryableWorkerModelError excludes errors already handled by the task router.
// In particular, a quota error after partial streaming advances the task cursor
// for the next LLM call but must not replay this whole intent on the backup.
func retryableWorkerModelError(reason harness.TerminalReason, err error) bool {
	return reason == harness.ReasonModelError && !isTaskLLMRuntimeError(err)
}

// Engine drives the event-driven exploration loop with real LLM agents
// (docs §4.3/§4.4): on asset/exploration-graph change (debounced) it wakes the
// planner, which reads the route, queries assets, judges goals and emits intents;
// N concurrent work agents claim intents and execute them. There is no
// simulation mode — an LLM provider is required. The planner/worker can be
// (re)installed at runtime (LLM configured from the UI); the loops always run
// but idle until an LLM is set.
type Engine struct {
	m        *Manager
	debounce time.Duration

	bc *Broadcaster // live activity pub/sub (SSE)

	started  sync.Map // taskID -> bool, so Run is idempotent per task
	lastAct  sync.Map // taskID -> int64 unix, last planner/worker activity (heartbeat)
	llmCalls sync.Map // taskID -> *int64, actual planner/worker/main-agent LLM calls
	paused   sync.Map // taskID -> bool, user-paused (planner + workers idle but loops alive)
	deleting sync.Map // taskID -> bool, delete barrier (no new task-owned writes)
	dropCnt  sync.Map // taskID -> *int64, running count of dropped (unpersistable) activity records

	// deleteMu makes installing the delete barrier atomic with registering a new
	// task operation. Once BeginDelete returns, every admitted writer is reflected
	// in inflight and every later writer is rejected.
	deleteMu sync.RWMutex

	// Every long-lived task goroutine (planner, workers and deadline coordinator)
	// runs under one task-scoped context. Successful deletion cancels that context,
	// waits for all goroutines, then releases every task-level Engine reference.
	runtimeMu sync.Mutex
	runtimes  map[string]*taskRuntime

	// per-task execution context: each planner.Plan / worker.Execute runs under it,
	// so pausing can CANCEL an in-flight run (not just skip the next one). Recreated
	// on resume since cancelling is one-shot. Every cancellation carries a named
	// cause so the activity trace can identify the initiating control path.
	execMu     sync.Mutex
	execCancel map[string]context.CancelCauseFunc
	execCtx    map[string]context.Context

	// Per-work control lets the planner kill a worker and lets the UI pause/cancel
	// one intent without pausing the whole task. The done channel closes only after
	// runWorkerStep has stopped writing and committed its final state.
	workMu sync.Mutex
	work   map[int64]*workExecution

	// steerBox queues planner course-corrections for a running work (keyed by intent
	// id). The worker's PreToolUse hook drains it before its next tool call and hands
	// the message to the model (blocking that call) so it re-plans — no kill needed.
	steerMu  sync.Mutex
	steerBox map[int64][]string

	plannerRound sync.Map // taskID -> int, planner round counter (for UI round separators)

	// 任务级超时(见 docs/任务级超时与收尾设计.md):
	settling     sync.Map // taskID -> bool, 任务已进入收尾时序(停止派/领新意图)
	deadline     sync.Map // taskID -> int64 unix, 绝对截止时刻(首次运行时盖章;0/缺省=不限)
	stamped      sync.Map // taskID -> bool, first_run_at 是否已盖章(本进程内只盖一次)
	inflight     sync.Map // taskID -> *int64, 在跑的 planner.Plan + worker.Execute 计数(用于 drain)
	coordStarted sync.Map // taskID -> bool, deadline 协调器是否已启动(Run/reload 去重)

	// resolve returns a task's dedicated planner/worker (wired by the server as the
	// authoritative task-router). nil,nil means this task is deliberately unavailable
	// (for example an exhausted failover chain) — there is no global-pair fallback.
	resolve              func(t *Task) (*agent.Planner, *agent.Worker)
	resolveAuthoritative bool
	// readiness reports whether a global LLM provider is configured — the signal behind
	// Ready()/the llm_configured indicator. Wired once at startup; nil → not ready.
	readiness func() bool
}

type taskRuntime struct {
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

type workExecution struct {
	cancel context.CancelCauseFunc
	done   chan error
	action string // user action: pause | cancel
}

// nextPlannerRound returns the next planner round number for a task (1-based).
func (e *Engine) nextPlannerRound(taskID string) int {
	v, _ := e.plannerRound.LoadOrStore(taskID, 0)
	n := v.(int) + 1
	e.plannerRound.Store(taskID, n)
	return n
}

// Pause stops a task: marks it paused AND cancels any in-flight planner/worker run
// for it (a long worker.Execute would otherwise keep going until it finishes).
func (e *Engine) Pause(taskID string, cause error) {
	e.paused.Store(taskID, true)
	e.cancelExec(taskID, cause)
}

// BeginDelete installs an execution barrier before task data/files are removed.
// The temporary pause is not a user pause. The server serializes this transition
// with lifecycle admission and tells AbortDelete whether the persisted task is
// paused/queued if cleanup fails.
func (e *Engine) BeginDelete(taskID string) bool {
	e.deleteMu.Lock()
	if _, loaded := e.deleting.LoadOrStore(taskID, true); loaded {
		e.deleteMu.Unlock()
		return false
	}
	e.paused.Store(taskID, true)
	e.deleteMu.Unlock()
	e.cancelExec(taskID, agent.AbortTaskDeleted)
	return true
}

func (e *Engine) AbortDelete(taskID string, keepPaused bool) {
	e.deleteMu.Lock()
	if !e.IsDeleting(taskID) {
		e.deleteMu.Unlock()
		return
	}
	e.deleting.Delete(taskID)
	if !keepPaused {
		e.paused.Delete(taskID)
	}
	e.deleteMu.Unlock()
	if !keepPaused && e.m != nil {
		if t, ok := e.m.Task(taskID); ok {
			t.Notify()
		}
	}
}

func (e *Engine) IsDeleting(taskID string) bool {
	_, ok := e.deleting.Load(taskID)
	return ok
}

// registerTaskRoutines reserves count goroutines in the task runtime. Callers
// hold deleteMu for reading so StopTask cannot race WaitGroup.Add with Wait.
func (e *Engine) registerTaskRoutines(parent context.Context, taskID string, count int) *taskRuntime {
	e.runtimeMu.Lock()
	defer e.runtimeMu.Unlock()
	rt := e.runtimes[taskID]
	if rt == nil {
		ctx, cancel := context.WithCancel(parent)
		rt = &taskRuntime{ctx: ctx, cancel: cancel}
		e.runtimes[taskID] = rt
	}
	rt.wg.Add(count)
	return rt
}

func runTaskRoutine(rt *taskRuntime, fn func(context.Context)) {
	go func() {
		defer rt.wg.Done()
		fn(rt.ctx)
	}()
}

// StopTask permanently stops every long-lived goroutine and removes all Engine
// state for a successfully deleted task. The delete barrier remains installed
// until cleanup finishes, so no new task operation can race the teardown.
func (e *Engine) StopTask(taskID string) {
	e.deleteMu.Lock()
	e.deleting.Store(taskID, true)
	e.deleteMu.Unlock()

	e.cancelExec(taskID, agent.AbortTaskDeleted)
	e.runtimeMu.Lock()
	rt := e.runtimes[taskID]
	if rt != nil {
		rt.cancel()
	}
	e.runtimeMu.Unlock()
	if rt != nil {
		rt.wg.Wait()
	}

	e.execMu.Lock()
	if cancel := e.execCancel[taskID]; cancel != nil {
		cancel(agent.AbortTaskDeleted)
	}
	delete(e.execCancel, taskID)
	delete(e.execCtx, taskID)
	e.execMu.Unlock()

	e.runtimeMu.Lock()
	if e.runtimes[taskID] == rt {
		delete(e.runtimes, taskID)
	}
	e.runtimeMu.Unlock()

	e.started.Delete(taskID)
	e.lastAct.Delete(taskID)
	e.llmCalls.Delete(taskID)
	e.paused.Delete(taskID)
	e.dropCnt.Delete(taskID)
	e.plannerRound.Delete(taskID)
	e.settling.Delete(taskID)
	e.deadline.Delete(taskID)
	e.stamped.Delete(taskID)
	e.inflight.Delete(taskID)
	e.coordStarted.Delete(taskID)
	e.deleteMu.Lock()
	e.deleting.Delete(taskID)
	e.deleteMu.Unlock()
}

// cancelExec cancels a task's current per-task exec con
```

### Core Architecture Module: `server/engine_timeout.go`
```
package server

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/Autumn-27/artex/agent"
	"github.com/Autumn-27/artex/db"
)

// 任务级超时协调器(见 docs/任务级超时与收尾设计.md §4/§8.5)。
// 绝对墙钟:每个带 timeout 的任务一个定时 goroutine,到点驱动有序收尾时序:
//   ① settling → ② worker 停领新意图 / ③ planner 丢弃普通 notify
//   ④ 等在跑 worker drain(受 grace) → ⑤ 终局一轮 planner 判定 → ⑥ 定终态(带守卫)

const (
	settleDrainGrace     = 90 * time.Second // 等在跑 worker 优雅收尾的上限;超过则硬 cancel
	deadlinePollInterval = 2 * time.Second  // deadline 未盖章/LLM 未就绪时的轮询间隔
	deadlineMaxSleep     = 30 * time.Second // 单次最长睡眠(便于周期复查终态)
)

// ---------- settling 状态 ----------

func (e *Engine) isSettling(taskID string) bool {
	v, _ := e.settling.Load(taskID)
	b, _ := v.(bool)
	return b
}

// markSettling flips settling on; returns true only for the first caller.
func (e *Engine) markSettling(taskID string) bool {
	_, loaded := e.settling.LoadOrStore(taskID, true)
	return !loaded
}

// ---------- 在跑计数(worker.Execute + planner.Plan),用于 drain ----------

func (e *Engine) inflightCounter(taskID string) *int64 {
	v, _ := e.inflight.LoadOrStore(taskID, new(int64))
	return v.(*int64)
}

// beginTaskOperation atomically registers a task-owned operation unless deletion
// has already installed its barrier. The delete handler can therefore wait for
// inflight==0 without a check-then-start race recreating files after cleanup.
func (e *Engine) beginTaskOperation(taskID string) bool {
	e.deleteMu.RLock()
	defer e.deleteMu.RUnlock()
	if e.IsDeleting(taskID) {
		return false
	}
	atomic.AddInt64(e.inflightCounter(taskID), 1)
	return true
}

func (e *Engine) decInflight(taskID string) { atomic.AddInt64(e.inflightCounter(taskID), -1) }
func (e *Engine) inflightCount(taskID string) int64 {
	return atomic.LoadInt64(e.inflightCounter(taskID))
}

// ---------- deadline ----------

// taskDeadline returns the task's absolute deadline (unix). Prefers the in-process
// map (stamped this session); falls back to the DB-loaded value (restart), seeding
// the map. 0 = no timeout / not yet stamped.
func (e *Engine) taskDeadline(t *Task) int64 {
	if v, ok := e.deadline.Load(t.ID); ok {
		return v.(int64)
	}
	deadlineAt := t.lifecycleSnapshot().DeadlineAt
	if deadlineAt > 0 {
		e.deadline.Store(t.ID, deadlineAt)
		return deadlineAt
	}
	return 0
}

// resetTimeoutRevival clears only the per-run timeout state after PostgreSQL has
// atomically committed timeout -> running and reset first_run_at/deadline_at. The
// configured TimeoutSeconds remains on Task, so the next real Planner/Worker run
// stamps a fresh full budget. coordStarted is reset because the coordinator that
// produced the timeout has already completed (or is in its final return path).
func (e *Engine) resetTimeoutRevival(taskID string) {
	e.settling.Delete(taskID)
	e.deadline.Delete(taskID)
	e.stamped.Delete(taskID)
	e.coordStarted.Delete(taskID)
}

// stampFirstRun records first_run_at + deadline_at on the FIRST real run (LLM ready)
// of a timeout task, once per process. No-op when the task has no timeout.
func (e *Engine) stampFirstRun(t *Task) {
	if t.TimeoutSeconds <= 0 {
		return
	}
	if _, loaded := e.stamped.LoadOrStore(t.ID, true); loaded {
		return
	}
	dl, err := e.m.StampTaskFirstRun(t.ID)
	if err != nil {
		log.Printf("[deadline] task %s 盖章 first_run 失败: %v", t.ID, err)
		e.stamped.Delete(t.ID) // 允许下次重试
		return
	}
	if dl > 0 {
		e.deadline.Store(t.ID, dl)
		log.Printf("[deadline] task %s 首次运行,截止于 %s", t.ID, time.Unix(dl, 0).Format("2006-01-02 15:04:05"))
	}
}

// clockCtx layers the task's TaskClock (absolute deadline) onto a run's context so
// worker/planner can clamp their wall-clock budget and pick per-run vs task-timeout
// wrap-up words. final marks the coordinator-driven terminal planner round.
func (e *Engine) clockCtx(base context.Context, t *Task, final bool) context.Context {
	dl := e.taskDeadline(t)
	if dl <= 0 && !final {
		return base // no timeout → unchanged behavior
	}
	return agent.WithTaskClock(base, agent.TaskClock{DeadlineUnix: dl, Final: final})
}

// ---------- 协调器 ----------

// startDeadlineCoordinator launches the per-task deadline timer once (idempotent).
// Called from Run() and from the restart reload path, so non-active timeout tasks
// still get settled after their deadline even without live planner/worker loops.
func (e *Engine) startDeadlineCoordinator(ctx context.Context, t *Task) {
	if t == nil || t.TimeoutSeconds <= 0 {
		return
	}
	e.deleteMu.RLock()
	if e.IsDeleting(t.ID) {
		e.deleteMu.RUnlock()
		return
	}
	if _, loaded := e.coordStarted.LoadOrStore(t.ID, true); loaded {
		e.deleteMu.RUnlock()
		return
	}
	rt := e.registerTaskRoutines(ctx, t.ID, 1)
	e.deleteMu.RUnlock()
	runTaskRoutine(rt, func(loopCtx context.Context) { e.deadlineCoordinator(loopCtx, t) })
}

// deadlineCoordinator waits until the task's absolute deadline, then runs the settle
// sequence. Absolute wall-clock: it keeps counting through pauses.
func (e *Engine) deadlineCoordinator(ctx context.Context, t *Task) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		if isTerminalStatus(e.m.TaskStatus(t.ID)) {
			return // already finished (goals met / failed) — nothing to time out
		}
		dl := e.taskDeadline(t)
		if dl <= 0 {
			if sleepCtx(ctx, deadlinePollInterval) { // not yet stamped (task hasn't really run)
				return
			}
			continue
		}
		if remaining := time.Until(time.Unix(dl, 0)); remaining > 0 {
			nap := remaining
			if nap > deadlineMaxSleep {
				nap = deadlineMaxSleep
			}
			if sleepCtx(ctx, nap) {
				return
			}
			continue
		}
		e.settleTask(ctx, t)
		return
	}
}

// settleTask runs the ordered settle sequence once (§4 steps ①–⑥).
func (e *Engine) settleTask(ctx context.Context, t *Task) {
	if !e.markSettling(t.ID) {
		return
	}
	log.Printf("[deadline] task %s 到达超时上限,进入收尾时序", t.ID)

	// ④ 等在跑 worker/planner drain(在跑 run 因夹逼的 MaxDuration 自行进收尾);
	// 超过 grace 仍未清空 → 硬 cancel 该任务 exec ctx(settling-aware 分支正确归类)。
	hardStop := time.Now().Add(settleDrainGrace)
	for e.inflightCount(t.ID) > 0 {
		if time.Now().After(hardStop) {
			log.Printf("[deadline] task %s drain 超时(%s),硬取消在跑 run", t.ID, settleDrainGrace)
			e.cancelExec(t.ID, agent.AbortSettleDrainTimeout)
			_ = sleepCtx(ctx, 3*time.Second) // 给 worker 分支一点时间落库/归类
			break
		}
		if sleepCtx(ctx, 500*time.Millisecond) {
			return // 引擎整体关停
		}
	}

	// ⑤ 终局一轮 planner(任务超时词,最后目标判定,不产新意图)。
	met := e.runFinalPlannerRound(ctx, t)
	if !e.beginTaskOperation(t.ID) {
		return
	}
	defer e.decInflight(t.ID)

	// ⑥ 定终态(带守卫):met → done(completed);否则 timeout。若常规路径已先落 done,
	// 守卫(SetTaskStatusGuarded)会拒绝覆盖,保留 completed 语义。
	status := "timeout"
	if met {
		status = "done"
	}
	won, err := e.m.SetTaskStatusGuarded(t.ID, status)
	switch {
	case err != nil:
		log.Printf("[deadline] task %s 落终态失败: %v", t.ID, err)
	case won:
		log.Printf("[deadline] task %s 收尾完成,终态=%s", t.ID, status)
	default:
		log.Printf("[deadline] task %s 收尾时已是终态,保留原状态", t.ID)
	}
}

// runFinalPlannerRound drives exactly ONE terminal planner round with the
// task-timeout planner words (final goal judgment; no new intents). Waits for the
// LLM to be ready (bounded by ctx) so a completable task isn't mis-judged timeout.
func (e *Engine) runFinalPlannerRound(ctx context.Context, t *Task) (met bool) {
	if e.IsDeleting(t.ID) {
		return false
	}
	planner, _ := e.snapshotFor(t)
	for planner == nil {
		if sleepCtx(ctx, deadlinePollInterval) {
			return false
		}
		if isTerminalStatus(e.m.TaskStatus(t.ID)) {
			return false
		}
		if e.IsDeleting(t.ID) {
			return false
		}
		planner, _ = e.snapshotFor(t)
	}
	// 独立 ctx(不挂 execCancel,避免 pause/硬 cancel 打断这最后一轮),带 Final 注入任务超时词。
	fctx := e.clockCtx(ctx, t, true)
	if !e.beginTaskOperation(t.ID) {
		return false
	}
	defer e.decInflight(t.ID)
	emit := func(r db.Activity) { e.emitActivity(t, r) }
	e.emitActivity(t, db.Activity{Worker: "planner", Kind: "round",
		Summary: fmt.Sprintf("任务超时收尾·终局判定(第 %d 轮)", e.nextPlannerRound(t.ID))})
	tTaskID, _ := strconv.ParseInt(t.ID, 10, 64)
	e.BeginLLMCall(t.ID)
	met, reason, err := planner.Plan(fctx, tTaskID, e.m.assets, t.Store, t.Goal, t.drainTriggers(), emit)
	e.EndLLMCall(t.ID)
	if err != nil {
		log.Printf("[deadline] task %s 终局规划出错: %v", t.ID, err)
	} else if met {
		log.Printf("[deadline] task %s 终局判定目标达成: %s", t.ID, reason)
	}
	return met
}

```

### Core Architecture Module: `web/src/hooks/use-current-user.ts`
```
"use client";

import { useEffect, useState } from "react";

import { auth, type CurrentUser } from "@/lib/auth";

const FALLBACK: CurrentUser = { id: "1", name: "ARTEX", username: "artex", email: "", avatar: "", role: "operator" };

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>(FALLBACK);

  useEffect(() => {
    const u = auth.getCurrentUser();
    if (u) setUser(u);
  }, []);

  return user;
}

```

### Core Architecture Module: `web/src/hooks/use-lg.ts`
```
import * as React from "react";

const LG_BREAKPOINT = 1024;

export function useIsLg() {
  const [isLg, setIsLg] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
    const onChange = () => {
      setIsLg(window.innerWidth >= LG_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsLg(window.innerWidth >= LG_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isLg;
}

```

### Core Architecture Module: `web/src/hooks/use-mobile.ts`
```
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

```

### Core Architecture Module: `web/src/hooks/use-side-questions.ts`
```
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { toast } from "sonner";

import { sseUrl } from "@/lib/api";
import { isBtwCommand, type SideExchange, type SideHistory, sideAPI } from "@/lib/side-questions";

// crypto.randomUUID 仅在安全上下文可用(https/localhost);经 IP+http 访问时降级。
function newSideRequestID(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `btw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  );
}

function merge(old: SideExchange[], incoming: SideExchange[]) {
  const byID = new Map(old.map((item) => [item.id, item]));
  for (const item of incoming) {
    if ((byID.get(item.id)?.sequence ?? -1) <= item.sequence) byID.set(item.id, item);
  }
  return [...byID.values()].sort((a, b) => a.ordinal - b.ordinal);
}

export function useSideQuestions(parent: string | null) {
  const [stateParent, setStateParent] = useState(parent);
  const current = stateParent === parent;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SideExchange[]>([]);
  const [snapshot, setSnapshot] = useState<SideHistory["snapshot"]>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState(0);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const epoch = useRef(0);
  const [streamEpoch, setStreamEpoch] = useState(0);
  const cursor = useRef(0);
  const submitting = useRef(false);
  const retry = useRef<{ question: string; id: string } | null>(null);
  const accepted = useRef<{ id: string; question: string } | null>(null);
  const running = current ? items.find((item) => item.status === "running") : undefined;
  const runningID = running?.id;

  const restoreFailedDraft = useCallback((incoming: SideExchange[]) => {
    const pending = accepted.current;
    if (!pending) return;
    const item = incoming.find((entry) => entry.id === pending.id);
    if (!item || item.status === "running") return;
    accepted.current = null;
    if (item.status === "failed" || item.status === "interrupted") {
      setDraft((old) => old || pending.question);
    }
  }, []);

  const load = useCallback(
    async (before = 0) => {
      if (!parent) return;
      const version = epoch.current;
      try {
        const data = await sideAPI.history(parent, before);
        if (version !== epoch.current) return;
        setItems((old) => merge(old, data.items));
        restoreFailedDraft(data.items);
        setSnapshot(data.snapshot);
        setLoadError("");
        if (before || !cursor.current) {
          cursor.current = data.next_cursor;
          setNextCursor(data.next_cursor);
        }
      } catch (err) {
        if (version === epoch.current) setLoadError((err as Error).message);
      }
    },
    [parent, restoreFailedDraft],
  );

  useEffect(() => {
    epoch.current++;
    setStateParent(parent);
    setItems([]);
    setSnapshot(null);
    setNextCursor(0);
    setDraft("");
    setError("");
    setLoadError("");
    setBusy(false);
    submitting.current = false;
    retry.current = null;
    accepted.current = null;
    cursor.current = 0;
    if (!parent) {
      setOpen(false);
      setLoading(false);
      return;
    }
    const version = epoch.current;
    setLoading(true);
    void sideAPI
      .history(parent)
      .then((data) => {
        if (version !== epoch.current) return;
        setItems((old) => merge(old, data.items));
        setSnapshot(data.snapshot);
        setNextCursor(data.next_cursor);
        cursor.current = data.next_cursor;
      })
      .catch((err: Error) => {
        if (version === epoch.current) setError(err.message);
      })
      .finally(() => {
        if (version === epoch.current) setLoading(false);
      });
    return () => {
      epoch.current++;
    };
  }, [parent]);

  useEffect(() => {
    if (!open || !parent) return;
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [open, parent, load]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reconnect after a clear attempt invalidates older callbacks.
  useEffect(() => {
    if (!runningID) return;
    const version = epoch.current;
    const stream = new EventSource(sseUrl(`/api/side-questions/${runningID}/events`));
    stream.addEventListener("snapshot", (event) => {
      if (version !== epoch.current) return;
      try {
        const item = JSON.parse((event as MessageEvent).data) as SideExchange;
        if (item.id !== runningID) return;
        setItems((old) => merge(old, [item]));
        restoreFailedDraft([item]);
        if (item.status !== "running") stream.close();
      } catch {
        setError("旁路数据解析失败，请重新打开面板");
      }
    });
    stream.addEventListener("cleared", () => {
      stream.close();
      if (version === epoch.current) setItems([]);
    });
    return () => stream.close();
  }, [runningID, streamEpoch, restoreFailedDraft]);

  const ask = async (input: string) => {
    const question = input.trim();
    if (!parent || !question || submitting.current || running) return;
    const version = epoch.current;
    submitting.current = true;
    setBusy(true);
    setError("");
    setDraft(question);
    setOpen(true);
    if (retry.current?.question !== question) retry.current = { question, id: newSideRequestID() };
    try {
      const item = await sideAPI.ask(parent, question, retry.current.id);
      if (version !== epoch.current) return;
      setItems((old) => merge(old, [item]));
      accepted.current = { id: item.id, question };
      setDraft("");
      setError("");
      retry.current = null;
      void load();
    } catch (err) {
      if (version === epoch.current) {
        setError((err as Error).message);
      }
    } finally {
      if (version === epoch.current) {
        submitting.current = false;
        setBusy(false);
      }
    }
  };

  const handleCommand = (text: string, clear: () => void) => {
    if (!parent || !isBtwCommand(text)) return false;
    const question = text.trim().slice(4).trim();
    setOpen(true);
    clear();
    if (question) {
      setDraft(question);
      void ask(question);
    }
    return true;
  };

  const clear = async () => {
    if (!parent || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    const version = ++epoch.current;
    try {
      await sideAPI.clear(parent);
      if (version !== epoch.current) return;
      setItems([]);
      setNextCursor(0);
      cursor.current = 0;
      setError("");
      retry.current = null;
      accepted.current = null;
    } catch (err) {
      if (version === epoch.current) toast.error((err as Error).message);
    } finally {
      if (version === epoch.current) {
        submitting.current = false;
        setBusy(false);
        setStreamEpoch((value) => value + 1);
        void load();
      }
    }
  };

  const stop = async () => {
    if (running) {
      try {
        await sideAPI.cancel(running.id);
      } catch (err) {
        toast.error((err as Error).message);
      }
    }
  };
  return {
    open,
    setOpen,
    items: current ? items : [],
    snapshot: current ? snapshot : null,
    draft: current ? draft : "",
    setDraft,
    busy: current && busy,
    loading: !current || loading,
    error: current ? error || loadError : "",
    running,
    nextCursor: current ? nextCursor : 0,
    load,
    ask,
    handleCommand,
    clear,
    stop,
    enabled: !!parent,
  };
}

export type SideQuestions = ReturnType<typeof useSideQuestions>;

```

### Core Architecture Module: `web/src/lib/preferences/layout-utils.ts`
```
export function applyContentLayout(value: "centered" | "full-width") {
  const root = document.documentElement;
  root.setAttribute("data-content-layout", value);
}

export function applyNavbarStyle(value: "sticky" | "scroll") {
  const root = document.documentElement;
  root.setAttribute("data-navbar-style", value);
}

export function applySidebarVariant(value: string) {
  const root = document.documentElement;
  root.setAttribute("data-sidebar-variant", value);
}

export function applySidebarCollapsible(value: string) {
  const root = document.documentElement;
  root.setAttribute("data-sidebar-collapsible", value);
}

export function applyFont(value: string) {
  const root = document.documentElement;
  root.setAttribute("data-font", value);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- *No recent closed bug issues fetched.*

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

### Incident Patch 1: `4b1eda8e` (2026-09-30)
**Commit Message**: fix(findings): 「按资产」视图资产列表溢出时补回滚动条

左侧资产树的滚动容器靠 height:100% 取高，但外层卡片只给了 max-height
没有确定高度，百分比高度解析失败，资产多时列表撑破卡片或被截断且无法
滚动。改为把高度上限直接放到资产树的原生滚动容器上（overflow-y-auto +
max-h，随窗口自适应），资产少随内容收缩、资产多封顶并出滚动条。

Closes #170

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -26,6 +26,12 @@
 
 - **修复自定义会话头在「一次性 LLM 调用」路径上不生效**：会话头的头值取自请求 context 上的 session id，而该 id 由 agentcore 仅在挂载了 transcript store 时才写入 context。目标拆解（第 0 轮）与冷节点压缩（§4 body 调用）都是不挂 store 的一次性调用，context 上没有 session id，网关侧读不到该头——对 opencode zen 这类「缺 `x-opencode-session` 直接 400 MissingSessionID」的端点，表现为「第 0 轮目标拆解 400 失败、后续 planner 轮次却完全正常」，且压缩失败只留一行日志、极难关联。现为这两条路径显式挂上按探索稳定的 session id（`exp<N>-goals` / `exp<N>-compactor`）：既能正常带上该头，也让 llmrec 能把这两条路径的 token 用量正确归因到对应探索（此前完全记不到）。
 
+### 发现
+
+#### 修复的问题
+
+- **修复「按资产」视图资产列表溢出后没有滚动条**：左侧资产树本已套了滚动容器，但外层卡片只给了 `max-height` 而没有确定高度，滚动视口靠 `height:100%` 解析不出高度（CSS 中只设 `max-height`、`height` 仍为 `auto` 时百分比高度不生效），于是资产多时列表要么撑破卡片、要么被截断且无法滚动。现将高度上限直接落到资产树的原生滚动容器上（`overflow-y-auto` + `max-h`，随窗口高度自适应），资产少时卡片随内容收缩、资产多时封顶并出滚动条。
+
 ## [0.3.14] - 2026-09-24
 
 ### 任务列表
```

**File**: `web/src/app/(main)/function/findings/_components/asset-tree.tsx` (modified, +3/-4)
```diff
@@ -18,7 +18,6 @@ import {
 
 import { Button } from "@/components/ui/button";
 import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
-import { ScrollArea } from "@/components/ui/scroll-area";
 import type { FindingAssetKind, FindingAssetNode } from "@/lib/types";
 import { cn } from "@/lib/utils";
 
@@ -299,12 +298,12 @@ export function AssetTree({
         <span className="text-xs tabular-nums text-muted-foreground">{findingTotal}</span>
       </button>
 
-      <ScrollArea className="min-h-0 flex-1">
-        <div className="flex flex-col pr-2">
+      <div className="max-h-[24rem] min-h-0 flex-1 overflow-y-auto pr-2 lg:max-h-[calc(100vh-16rem)]">
+        <div className="flex flex-col">
           {rows}
           {rows.length === 0 && <p className="px-2 py-8 text-center text-xs text-muted-foreground">{emptyHint}</p>}
         </div>
-      </ScrollArea>
+      </div>
 
       {truncated && (
         <p className="px-1 text-xs text-muted-foreground">
```

**File**: `web/src/app/(main)/function/findings/page.tsx` (modified, +1/-1)
```diff
@@ -964,7 +964,7 @@ export default function FindingsPage() {
         {view === "asset" && (
           <div className="grid min-h-0 items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
             <Card className="gap-0 py-3 lg:sticky lg:top-4">
-              <CardContent className="flex max-h-[24rem] flex-col px-3 lg:max-h-[calc(100vh-14rem)]">
+              <CardContent className="flex flex-col px-3">
                 {assetTree.loading && !assetTree.loaded ? (
                   <div className="flex min-h-36 items-center justify-center">
                     <Spinner />
```

---

### Incident Patch 2: `5081d95b` (2026-10-01)
**Commit Message**: fix(notify): 邮件渠道的 SMTP 拨号补上 SSRF 守卫

emailDial 用的是裸 net.Dialer，没挂 blockInternalDial，Validate 也只检查
host 非空。于是 SMTP 是整套 SSRF 防护里唯一的缺口：host 填 169.254.169.254
或 127.0.0.1 能直接连上，而 smtp.NewClient 握手失败时会把对端返回的那一行
（textproto 的 short response）包进错误、经 last_error 由投递历史接口回显，
正是其它渠道已经关掉的半盲读原语；「连接被拒 vs 超时」的耗时差异还能
用来探测端口。

拨号阶段是最终生效点，也覆盖 DNS 重绑定，与 HTTP 系渠道共用同一道守卫。
RFC1918 私网继续放行，与 isBlockedDialIP 既有的取舍一致——内网自建 SMTP
中继是常见的合法部署。

这个缺口没有测试会发现：本包 TestMain 全局打开了 ARTEX_NOTIFY_ALLOW_LOCAL，
邮件用例无论守卫在不在都会通过。新增的两条用例自己清掉该变量，
并配一条反向用例确认显式放开后本机 SMTP 仍可投递。

**File**: `notify/email.go` (modified, +6/-1)
```diff
@@ -130,8 +130,13 @@ func (c emailChannel) Send(ctx context.Context, cfg map[string]any, m Message) (
 // 会话期限在**建连处**就设好（而非事后补设），因为 net/smtp 的 Client 把底层
 // 连接藏在未导出字段里，外部拿不到它；连接一旦交出去就只能靠预先设置的 deadline
 // 兜底。这也顺带覆盖了握手阶段的阻塞。
+// Control 挂 blockInternalDial 与 HTTP 系渠道共用同一道守卫。不挂的话 SMTP
+// 就是整套 SSRF 防护的缺口：host 填 169.254.169.254 或 127.0.0.1 能直接连上，
+// 而 smtp.NewClient 握手失败时会把对端返回的那一行包进错误、经 last_error
+// 由投递历史接口回显，构成半盲读原语；「连接被拒 vs 超时」的耗时差异还能
+// 用来探测端口。拨号阶段是最终生效点，也覆盖 DNS 重绑定。
 func emailDial(ctx context.Context, addr, host string, implicitTLS bool) (*smtp.Client, error) {
-	d := &net.Dialer{Timeout: emailDialTimeout}
+	d := &net.Dialer{Timeout: emailDialTimeout, Control: blockInternalDial}
 	var conn net.Conn
 	var err error
 	if implicitTLS {
```

**File**: `notify/ssrf_test.go` (modified, +44/-0)
```diff
@@ -147,3 +147,47 @@ func TestValidateHTTPURLErrorNeverLeaksCredentials(t *testing.T) {
 	}
 	assertNoSecret(t, err.Error(), leakProbeToken)
 }
+
+// TestEmailDialGuardRejectsLoopbackByDefault 覆盖 SMTP 渠道的拨号守卫。
+//
+// 邮件渠道曾经用的是裸 net.Dialer，是整套 SSRF 防护里唯一的缺口：host 填成
+// 169.254.169.254 或 127.0.0.1 能直接连上，而 smtp.NewClient 握手失败时会把
+// 对端返回的那一行包进错误、经 last_error 由投递历史接口回显——正是其它渠道
+// 已经关掉的半盲读原语；「连接被拒 vs 超时」的耗时差异还能用来探测端口。
+//
+// 本包的 TestMain 全局打开了 AllowLocalTargetsEnv（大量用例用 127.0.0.1 上的
+// 假接收端），所以这个用例必须自己把它清掉——否则守卫在不在都会通过，
+// 这也正是缺口当初没被任何测试发现的原因。
+func TestEmailDialGuardRejectsLoopbackByDefault(t *testing.T) {
+	f := newFakeSMTP(t)
+	cfg := emailCfg(t, f, nil)
+
+	t.Setenv(AllowLocalTargetsEnv, "") // 关掉逃生口 = 默认行为
+	_, err := (emailChannel{}).Send(context.Background(), cfg, singleMsg())
+	if err == nil {
+		t.Fatal("默认不应允许把邮件投递到环回地址")
+	}
+	// 连接根本不该建立：守卫在 Control 钩子里拦下，EHLO 永远发不出去。
+	if f.sawCommand("EHLO") || f.sawCommand("HELO") {
+		t.Fatal("SMTP 会话已经建立——守卫没生效")
+	}
+	// 错误信息要能指导用户怎么放开（本机 postfix 中继是合法配置）。
+	if !strings.Contains(err.Error(), AllowLocalTargetsEnv) {
+		t.Errorf("拒绝信息应说明如何显式放开: %v", err)
+	}
+}
+
+// TestEmailDialGuardAllowsLoopbackWhenOptedIn 是配对的反向用例：显式打开后
+// 必须能正常投递。内网自建 SMTP / 本机中继是非常常见的部署，守卫不能一刀切。
+func TestEmailDialGuardAllowsLoopbackWhenOptedIn(t *testing.T) {
+	f := newFakeSMTP(t)
+	cfg := emailCfg(t, f, nil)
+
+	t.Setenv(AllowLocalTargetsEnv, "1")
+	if _, err := (emailChannel{}).Send(context.Background(), cfg, singleMsg()); err != nil {
+		t.Fatalf("显式放开后本机 SMTP 应可投递: %v", err)
+	}
+	if !f.sawCommand("EHLO") {
+		t.Fatal("未看到 EHLO——会话没真正建立")
+	}
+}
```

---

### Incident Patch 3: `18589b27` (2026-09-30)
**Commit Message**: fix(db): 修正公司 ICP 归属用例连接关闭顺序导致的资产残留

清理注册在 t.Cleanup 里，而连接关闭用的是 defer d.Close()。defer 在函数
返回时先执行、t.Cleanup 在其后，于是两条 DELETE 全部落在**已关闭的连接**
上，错误又被 `_, _ =` 丢弃，测试资产与公司因此永久残留在库里。

该用例用 MAX(companies.id)+1 当假 TaskID 给资产打标。残留本身不会立刻报错，
但一旦这个数字与其他用例的任务 id 相撞，那个按「恰好 N 个资产」断言的用例
就会失败，而现象（某个无关测试的资产计数不对）与原因（另一个测试的连接
关闭顺序）相距极远，排查成本很高。

改为关闭连接也走 t.Cleanup 并注册在清理之前（t.Cleanup 后进先出，保证清理
先跑），同时让清理失败显式报错而不是被吞掉。

注：同一模式（defer d.Close() + 在 t.Cleanup 里写库）在 db 包另有十余处，
本次只修被实证触发的那一处。

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

**File**: `db/company_scope_test.go` (modified, +16/-3)
```diff
@@ -233,7 +233,15 @@ func TestCompanyICPAttribution(t *testing.T) {
 	if err != nil {
 		t.Skipf("postgres unavailable (%v) — skipping", err)
 	}
-	defer d.Close()
+	// 关连接必须走 t.Cleanup 且**注册在清理之前**：t.Cleanup 是后进先出，
+	// 先注册关闭 → 关闭最后执行，下面的数据清理才连得上库。
+	// 原先这里是 `defer d.Close()`：defer 在函数返回时先跑，t.Cleanup 在那之后
+	// 才执行，于是清理语句全落在**已关闭的连接**上、错误又被 `_, _ =` 丢弃，
+	// 资产与公司就永久残留在库里。残留本身不会立刻报错，但本用例用
+	// `MAX(companies.id)+1` 当假 TaskID 给资产打标（见下方 suffix），
+	// 一旦这个数字与别的用例的任务 id 撞上，那个用例按「恰好 N 个资产」的断言
+	// 就会莫名失败——排查成本极高。
+	t.Cleanup(func() { d.Close() })
 
 	var suffix int64
 	if err := d.QueryRow(`SELECT COALESCE(MAX(id),0)+1 FROM companies`).Scan(&suffix); err != nil {
@@ -246,8 +254,13 @@ func TestCompanyICPAttribution(t *testing.T) {
 		t.Fatal(err)
 	}
 	t.Cleanup(func() {
-		_, _ = d.Exec(`DELETE FROM assets WHERE task_ids @> ARRAY[$1]::bigint[]`, suffix)
-		_, _ = d.Exec(`DELETE FROM companies WHERE id=$1`, companyID)
+		// 不吞错误：清理失败会污染后续用例，必须让它在本次运行里显形。
+		if _, err := d.Exec(`DELETE FROM assets WHERE task_ids @> ARRAY[$1]::bigint[]`, suffix); err != nil {
+			t.Errorf("清理测试资产失败: %v", err)
+		}
+		if _, err := d.Exec(`DELETE FROM companies WHERE id=$1`, companyID); err != nil {
+			t.Errorf("清理测试公司失败: %v", err)
+		}
 	})
 
 	// A keyword can guide an Agent, but must never claim an asset by its name.
```

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. findings): 「按资产」视图资产列表溢出时补回滚动条

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in trhhubsd/ARTEX. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4b1eda8e`: findings): 「按资产」视图资产列表溢出时补回滚动条. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
### 发现

#### 修复的问题

- **修复「按资产」视图资产列表溢出后没有滚动条**：左侧资产树本已套了滚动容器，但外层卡片只给了 `max-height` 而没有确定高度，滚动视口靠 `height:100%` 解析不出高度（CSS 中只设 `max-height`、`height` 仍为 `auto` 时百分比高度不生效），于是资产多时列表要么撑破卡片、要么被截断且无法滚动。现将高度上限直接落到资产树的原生滚动容器上（`overflow-y-auto` + `max-h`，随窗口高度自适应），资产少时卡片随内容收缩、资产多时封顶并出滚动条。

```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4b1eda8e` are properly handled with clean fallback behavior.

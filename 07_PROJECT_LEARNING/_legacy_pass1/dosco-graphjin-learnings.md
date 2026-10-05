# Forensic Learning Record (Deep Inspection): dosco/graphjin

> **Canonical Artifact**: `07_PROJECT_LEARNING/dosco-graphjin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dosco/graphjin](https://github.com/dosco/graphjin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:43:14.155Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dosco/graphjin`
- **Description**: One governed graph for AI agents — GraphQL + MCP over your databases, files, APIs, and code
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3169 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent/agent.go`
```
package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	ax "github.com/ax-llm/ax/packages/go"
	"github.com/dosco/graphjin/core/v3"
)

const (
	StatusAnswered           = "answered"
	StatusNeedsClarification = "needs_clarification"
	StatusBlocked            = "blocked"
	StatusError              = "error"

	defaultProvider             = "openai"
	defaultAPIKeyEnv            = "OPENAI_API_KEY"
	defaultStructuredOutputMode = StructuredOutputAuto
	defaultMaxSteps             = 8
	minTimeoutSeconds           = 50
	defaultTimeoutSeconds       = minTimeoutSeconds
	defaultSeedLimit            = 40
	defaultCatalogLimit         = 20

	// maxInstructionBytes bounds the user instruction (token/cost guard).
	maxInstructionBytes = 16 * 1024
	// MaxCatalogBatchIDs caps one batched query_catalog({ids: [...]}) call.
	MaxCatalogBatchIDs = 20

	// History bounds: most-recent turns win, contents are truncated before
	// whole turns are dropped.
	maxHistoryTurns       = 12
	maxHistoryTurnBytes   = 4 * 1024
	maxHistoryBytes       = 48 * 1024
	maxHistoryCatalogRefs = 16
)

var (
	ErrMissingInstruction = errors.New("agent instruction is required")
	ErrInstructionTooLong = errors.New("agent instruction exceeds the maximum length")
	ErrMissingAPIKey      = errors.New("agent provider API key is not configured")
	ErrMissingGraphJin    = errors.New("graphjin core instance is required")
)

type Config struct {
	Enabled   bool   `mapstructure:"enabled" jsonschema:"title=Enable GraphJin Agent,description=Parsed dev and agentic service configs default to enabled; prod and direct Go configs remain disabled"`
	Provider  string `mapstructure:"provider" jsonschema:"title=Agent Provider,default=openai"`
	Model     string `mapstructure:"model" jsonschema:"title=Agent Model"`
	APIKeyEnv string `mapstructure:"api_key_env" jsonschema:"title=Agent API Key Environment Variable,default=OPENAI_API_KEY"`
	BaseURL   string `mapstructure:"base_url" jsonschema:"title=Agent Provider Base URL"`
	// ServiceTier selects Ax's portable inference service tier. Auto delegates
	// selection to the provider; explicit tiers are checked against the Ax
	// deployment profile and model before a request is sent.
	ServiceTier string `mapstructure:"service_tier" jsonschema:"title=Agent Service Tier,description=Portable inference service tier; auto delegates to the provider,default=auto,enum=auto,enum=standard,enum=flex,enum=priority"`
	// StructuredOutputMode selects the Ax structured-output mechanism. "auto"
	// lets the deployment profile and its model rules choose the mechanism Ax
	// has verified for that pairing; the explicit values are an override.
	StructuredOutputMode string `mapstructure:"structured_output_mode" jsonschema:"title=Agent Structured Output Mode,default=auto,enum=auto,enum=native,enum=function,enum=json_object"`
	// ResponseFormat is the deprecated predecessor of StructuredOutputMode:
	// json_schema maps to native, json_object to json_object. Set only one.
	ResponseFormat string `mapstructure:"response_format" jsonschema:"title=Agent Response Format (deprecated: use structured_output_mode),enum=json_schema,enum=json_object"`
	// Reasoning selects the provider's thinking effort for models that have
	// one. It is deliberately explicit: providers disagree on the default,
	// and DeepSeek's adapter disables thinking outright unless a level is
	// supplied — a reasoning model shipped with its reasoning off looks
	// exactly like a weak model, which is how a benchmark run measured 0.177
	// before this setting existed. Accepted: none, low, medium, high, xhigh
	// (highest). Empty keeps the provider default.
	Reasoning string `mapstructure:"reasoning" jsonschema:"title=Agent Reasoning Effort,description=Provider thinking effort for models that support it: none low medium high xhigh"`
	// ShowThoughts asks the provider to return the reasoning text it already
	// produced. These models think by default; this only controls whether the
	// thinking comes back, so it changes what is observable and not what the
	// model does — which is why it is separate from Reasoning. Coupling the two
	// meant the only way to see the thinking was to also set a thinking budget,
	// and that does change behaviour. Off by default: the text is billed output
	// and every episode carries it.
	ShowThoughts bool `mapstructure:"show_thoughts" jsonschema:"title=Return Model Reasoning,description=Return the provider's reasoning text in the chat log for debugging,default=false"`
	// Temperature and TopP pin the provider's sampling.
	//
	// They are pointers because unset and zero are different requests: ax
	// already pins temperature 0 when a client is built without one, so nil
	// means "whatever the stack already does" while a zero value means
	// "greedy, on purpose, and recorded as such in run provenance".
	//
	// Raising the temperature is what makes rejection sampling possible at all:
	// drawing several samples of one task only teaches anything if the samples
	// can differ. Providers vary in what they honour — some ignore it, some
	// clamp it — so what is configured is recorded rather than assumed.
	Temperature    *float64        `mapstructure:"temperature" jsonschema:"title=Agent Sampling Temperature,description=Provider sampling temperature; unset leaves the stack default"`
	TopP           *float64        `mapstructure:"top_p" jsonschema:"title=Agent Sampling Top-P,description=Provider nucleus sampling cutoff; unset leaves the stack default"`
	RateLimit      RateLimitConfig `mapstructure:"rate_limit" jsonschema:"title=Agent Provider Rate Limits"`
	MaxSteps       int             `mapstructure:"max_steps" jsonschema:"title=Agent Max Steps,default=8"`
	TimeoutSeconds int             `mapstructure:"timeout_seconds" jsonschema:"title=Agent Timeout Seconds,default=50"`
	ReadOnly       bool            `mapstructure:"read_only" jsonschema:"title=Force Agent Read-Only,default=false"`
	ReturnTrace    bool            `mapstructure:"return_trace" jsonschema:"title=Return Agent Trace,default=false"`
	// SeedLimit caps the initial query_catalog(search: instruction) seed rows.
	SeedLimit int `mapstructure:"seed_limit" jsonschema:"title=Agent Seed Catalog Limit,default=40"`
	// CatalogDefaultLimit is the default row limit for model-issued catalog queries.
	CatalogDefaultLimit int `mapstructure:"catalog_default_limit" jsonschema:"title=Agent Catalog Default Limit,default=20"`
}

type Request struct {
	Instruction string         `json:"instruction"`
	Context     map[string]any `json:"context,omitempty"`
	Namespace   string         `json:"namespace,omitempty"`
	// TaskID is an owner-scoped correlation label used by the service to load
	// declared task context and append a run trail. Like History, it never
	// satisfies a protocol evidence guard and never grants access.
	TaskID      string `json:"task_id,omitempty"`
	MaxSteps    int    `json:"max_steps,omitempty"`
	ReturnTrace *bool  `json:"return_trace,omitempty"`

	// History carries prior conversation turns for follow-up resolution. It is
	// untrusted model context: it reaches the model only as an ax context field
	// (available to runtime code as inputs.history) and never satisfies a
	// protocol guard — every run must re-establish its own tool evidence.
	History []Turn `json:"history,omitempty"`

	// Capabilities is the caller's role/visibility profile. It is intentionally
	// json:"-" so it can never be supplied or spoofed from the REST body or MCP
	// arguments; the service populates it after unmarshalling the wire request.
	// It is read-only policy input and is not forwarded into the LLM prompt.
	Capabilities *CapabilityProfile `json:"-"`

	// Observer receives one ActionEvent per executed tool action (progress
	// streaming). Server-populated only; never part of the wire request.
	Observer func(ActionEvent) `json:"-"`
}

// Turn is one prior conversation exchange, most recent last.
type Turn struct {
	Role    string `j
```

### Core Architecture Module: `agent/catalog_id_repair.go`
```
package agent

import (
	"sort"
	"strings"
)

// Catalog ids carry their database and schema: table:app:main.accounts, not
// table:accounts. Models write the short form constantly, and until now the miss
// returned a directive — "use a known catalog id instead of guessing another id" —
// alongside a list to scan.
//
// Benchmark generation 2028.1 shows what that costs. A missed detail leaves the
// following execute_graphql without discovery evidence, so it is refused; the
// refusal envelope has no data field; and executor code that assumed res.data
// throws a TypeError instead of reading the recovery. One qualifier typo becomes a
// dead run. Across that run 71 of 339 episodes hit an executor TypeError, several
// hundred occurrences deep, because the step repeats.
//
// Of the missed ids measured there, 29% differ from a real card only by their
// qualifiers and are unambiguous. Those are resolved rather than reported. The rest
// name entities that do not exist — table:tickets where the table is
// support_tickets, or table:harborlight_systems, which is a row value mistaken for
// a table — and those get named candidates instead of a scan list.

const catalogIDSuggestionLimit = 3

// splitCatalogID separates an id's kind from its remainder. Ids are
// kind:qualifier.name, and only the kind is a fixed vocabulary.
func splitCatalogID(id string) (kind, rest string, ok bool) {
	trimmed := strings.TrimSpace(id)
	index := strings.Index(trimmed, ":")
	if index <= 0 || index == len(trimmed)-1 {
		return "", "", false
	}
	return strings.ToLower(trimmed[:index]), strings.ToLower(trimmed[index+1:]), true
}

// catalogIDLeaf returns the unqualified entity name: app:main.accounts -> accounts.
func catalogIDLeaf(rest string) string {
	if index := strings.LastIndex(rest, "."); index >= 0 && index < len(rest)-1 {
		return rest[index+1:]
	}
	if index := strings.LastIndex(rest, ":"); index >= 0 && index < len(rest)-1 {
		return rest[index+1:]
	}
	return rest
}

// resolveCatalogIDQualifier returns the one published id that a missed id names
// once qualifiers are ignored. It resolves only when exactly one card matches, so
// an id that could mean two tables in different schemas is never silently picked.
func resolveCatalogIDQualifier(missed string, known []string) (string, bool) {
	kind, rest, ok := splitCatalogID(missed)
	if !ok {
		return "", false
	}
	var matches []string
	for _, candidate := range known {
		candidateKind, candidateRest, ok := splitCatalogID(candidate)
		if !ok || candidateKind != kind {
			continue
		}
		if candidateRest == rest {
			// An exact match differing only in case is already served by the caller;
			// treat it as resolved so the retry is a no-op rather than a miss.
			matches = appendUniqueString(matches, candidate)
			continue
		}
		if catalogIDLeaf(candidateRest) == rest {
			matches = appendUniqueString(matches, candidate)
		}
	}
	if len(matches) != 1 {
		return "", false
	}
	return matches[0], true
}

// suggestCatalogIDs names the closest published ids for a missed id that no
// qualifier fix reaches. Suggestions are ordered by how much of the requested name
// they share, and are offered as candidates rather than asserted as the answer.
func suggestCatalogIDs(missed string, known []string, limit int) []string {
	kind, rest, ok := splitCatalogID(missed)
	if !ok || limit <= 0 {
		return nil
	}
	leaf := catalogIDLeaf(rest)
	wanted := nameTokens(leaf)
	if len(wanted) == 0 {
		return nil
	}
	type scored struct {
		id    string
		score int
	}
	var ranked []scored
	for _, candidate := range known {
		candidateKind, candidateRest, ok := splitCatalogID(candidate)
		if !ok {
			continue
		}
		candidateLeaf := catalogIDLeaf(candidateRest)
		score := 0
		if candidateKind == kind {
			// Same kind is the strongest signal available: a missing table is far
			// likelier to be another table than a saved query of the same name.
			score += 2
		}
		if strings.Contains(candidateLeaf, leaf) || strings.Contains(leaf, candidateLeaf) {
			score += 3
		}
		for _, token := range nameTokens(candidateLeaf) {
			for _, want := range wanted {
				if token == want {
					score += 2
				} else if len(want) > 3 && strings.Contains(token, want) {
					score++
				}
			}
		}
		if score < 3 {
			continue
		}
		ranked = append(ranked, scored{id: candidate, score: score})
	}
	sort.SliceStable(ranked, func(i, j int) bool {
		if ranked[i].score != ranked[j].score {
			return ranked[i].score > ranked[j].score
		}
		return ranked[i].id < ranked[j].id
	})
	out := make([]string, 0, limit)
	for _, item := range ranked {
		out = appendUniqueString(out, item.id)
		if len(out) == limit {
			break
		}
	}
	return out
}

func nameTokens(name string) []string {
	fields := strings.FieldsFunc(strings.ToLower(name), func(r rune) bool {
		return r == '_' || r == '-' || r == '.' || r == ' '
	})
	out := make([]string, 0, len(fields))
	for _, field := range fields {
		if len(field) < 2 {
			continue
		}
		out = appendUniqueString(out, field)
	}
	return out
}

// repairCatalogDetailIDs maps every missed id onto the published id it named.
// It reports ok only when all of them resolve, so a partly-guessed batch is
// reported rather than half-served.
func repairCatalogDetailIDs(missedIDs, known []string) (map[string]string, bool) {
	if len(missedIDs) == 0 || len(known) == 0 {
		return nil, false
	}
	out := make(map[string]string, len(missedIDs))
	for _, missed := range missedIDs {
		canonical, ok := resolveCatalogIDQualifier(missed, known)
		if !ok {
			return nil, false
		}
		out[missed] = canonical
	}
	return out, true
}

// catalogIDSuggestions collects candidates for the ids that could not be resolved,
// keyed by the id the caller asked for.
func catalogIDSuggestions(missedIDs, known []string) map[string][]string {
	out := map[string][]string{}
	for _, missed := range missedIDs {
		if candidates := suggestCatalogIDs(missed, known, catalogIDSuggestionLimit); len(candidates) != 0 {
			out[missed] = candidates
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// rewriteCatalogIDArgs returns a copy of args with requested ids replaced by their
// canonical form, leaving every other argument untouched.
func rewriteCatalogIDArgs(args map[string]any, repairs map[string]string) map[string]any {
	if len(repairs) == 0 {
		return args
	}
	out := make(map[string]any, len(args))
	for key, value := range args {
		out[key] = value
	}
	canonical := func(value any) any {
		text, ok := value.(string)
		if !ok {
			return value
		}
		if fixed, ok := repairs[strings.TrimSpace(text)]; ok {
			return fixed
		}
		return value
	}
	if value, ok := out["id"]; ok {
		out["id"] = canonical(value)
	}
	for _, key := range []string{"ids", "detail_ids"} {
		list, ok := out[key].([]any)
		if !ok {
			continue
		}
		fixed := make([]any, len(list))
		for i, item := range list {
			fixed[i] = canonical(item)
		}
		out[key] = fixed
	}
	return out
}

```

### Core Architecture Module: `agent/cmd/skill-eval/data_eval.go`
```
// Data-accuracy ("ground truth") evaluation mode.
//
// Each case asks the agent a natural-language data question and scores the
// run on three independent dimensions:
//
//  1. Ground truth: the answer must match a runtime oracle — a trusted
//     GraphQL query (DB-side aggregates only) executed against the same
//     server's /api/v1/graphql, so date-relative demo seeds never desync.
//  2. Method: the agent must have made the database compute — the executed
//     queries (read from the response action trail) must match the case's
//     shape expectations. This catches "right number, wrong method" runs
//     that sum a row page client-side on a table small enough to get away
//     with it.
//  3. Efficiency: advisory budget on actor turns and tokens; exceeding it
//     warns and feeds the runaway failure bucket, never a hard gate.
//
// Failed runs are classified into failure buckets so a report reads as a
// diagnosis (what class of mistake) rather than a bare recall number.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	gjagent "github.com/dosco/graphjin/agent/v3"
)

type dataEvalCase struct {
	ID                string            `json:"id"`
	Group             string            `json:"group"`
	Prompt            string            `json:"prompt"`
	CapabilityProfile capabilityProfile `json:"capability_profile"`
	ExpectedStatus    string            `json:"expected_status"`
	Oracle            dataOracle        `json:"oracle"`
	Answer            answerRule        `json:"answer"`
	Method            methodRule        `json:"method"`
	Budget            *caseBudget       `json:"budget,omitempty"`
	SanityHint        *float64          `json:"sanity_hint,omitempty"`
}

type dataOracle struct {
	Query            string         `json:"query"`
	Variables        map[string]any `json:"variables,omitempty"`
	Extract          string         `json:"extract,omitempty"`
	DimensionExtract string         `json:"dimension_extract,omitempty"`
	// PickMax selects the row with the largest numeric value from a grouped
	// result in the runner. Alternative to order_by-on-the-aggregate oracles:
	// it ranks outside the engine, so it stays trustworthy even if the
	// grouped-order-by compile path regresses.
	PickMax *pickMaxRule `json:"pick_max,omitempty"`
	// AnchorQuery resolves a live data anchor (e.g. max_<date_col>) whose
	// value substitutes {{anchor}} / {{anchor±Nd}} tokens in Variables.
	AnchorQuery   string `json:"anchor_query,omitempty"`
	AnchorExtract string `json:"anchor_extract,omitempty"`
}

type pickMaxRule struct {
	List      string `json:"list"`      // dotted path to the grouped row list
	Value     string `json:"value"`     // numeric field ranked on
	Dimension string `json:"dimension"` // field reported as the winning dimension
}

type answerRule struct {
	Kind             string    `json:"kind"` // number | string | date
	ExtractRegex     string    `json:"extract_regex,omitempty"`
	FromData         string    `json:"from_data,omitempty"`
	TolerancePct     float64   `json:"tolerance_pct,omitempty"`
	AcceptScales     []float64 `json:"accept_scales,omitempty"` // scales applied to the oracle value
	ForbiddenPhrases []string  `json:"forbidden_phrases,omitempty"`
}

type methodRule struct {
	RequireQueryMatch          []string `json:"require_query_match,omitempty"`
	ForbidFinalizeFromListOnly bool     `json:"forbid_finalize_from_list_only,omitempty"`
	RequireTools               []string `json:"require_tools,omitempty"`
	ForbidTools                []string `json:"forbid_tools,omitempty"`
}

type caseBudget struct {
	MaxActorTurns  int64 `json:"max_actor_turns,omitempty"`
	MaxTotalTokens int64 `json:"max_total_tokens,omitempty"`
}

type dataCaseVerdict struct {
	CaseID          string   `json:"case_id"`
	Group           string   `json:"group"`
	GroundTruthPass bool     `json:"ground_truth_pass"`
	MethodPass      bool     `json:"method_pass"`
	Consistency     float64  `json:"consistency"` // fraction of repeats passing ground truth
	FailureBucket   string   `json:"failure_bucket,omitempty"`
	OracleValue     string   `json:"oracle_value,omitempty"`
	OracleDimension string   `json:"oracle_dimension,omitempty"`
	EvidenceQueries []string `json:"evidence_queries,omitempty"`
	GroundTruthRuns int      `json:"ground_truth_runs"`
	OracleErrorRuns int      `json:"oracle_error_runs,omitempty"`
}

var defaultForbiddenPhrases = []string{
	"cannot determine",
	"unable to retrieve",
	"unable to determine",
	"not found in the database",
	"not a column",
	"missing column",
	"schema change",
	"schema does not",
}

// aggregateFieldPattern recognizes DB-side aggregate fields in authored queries,
// including the compiler-supported Hasura-compatible aggregate root.
var aggregateFieldPattern = regexp.MustCompile(`(?is)(?:\b[a-zA-Z][a-zA-Z0-9_]*_aggregate\b(?:\s*\([^)]*\))?\s*\{\s*(?:aggregate\s*\{\s*)?(?:count\b|(?:sum|avg|min|max|stddev|variance)\s*\{)|\b(count|sum|avg|min|max|stddev|variance)_[a-zA-Z0-9_]+|\b(count|sum|avg|min|max|stddev|variance)\s*\(\s*(?:expr|column)\s*:)`)

// defaultNumberPattern extracts numeric answer candidates from prose.
var defaultNumberPattern = regexp.MustCompile(`-?\$?\d[\d,]*(?:\.\d+)?`)

var oracleTokenPattern = regexp.MustCompile(`\{\{(today|anchor)([+-]\d+)?d?\}\}`)

var anchorLayouts = []string{
	time.RFC3339,
	"2006-01-02T15:04:05Z",
	"2006-01-02T15:04:05",
	"2006-01-02 15:04:05Z07:00",
	"2006-01-02 15:04:05",
	"2006-01-02",
}

func validateDataCases(cases []dataEvalCase) error {
	seen := map[string]bool{}
	for _, c := range cases {
		if c.ID == "" || c.Prompt == "" || c.ExpectedStatus == "" {
			return fmt.Errorf("data case %q missing id, prompt, or expected_status", c.ID)
		}
		if seen[c.ID] {
			return fmt.Errorf("duplicate data case id %q", c.ID)
		}
		seen[c.ID] = true
		if strings.TrimSpace(c.Oracle.Query) == "" {
			return fmt.Errorf("data case %q needs oracle.query", c.ID)
		}
		if strings.TrimSpace(c.Oracle.Extract) == "" && c.Oracle.PickMax == nil {
			return fmt.Errorf("data case %q needs oracle.extract or oracle.pick_max", c.ID)
		}
	}
	return nil
}

type dataTask struct {
	testCase dataEvalCase
	repeat   int
	profile  endpointProfile
}

func makeDataTasks(cases []dataEvalCase, profiles []endpointProfile, repeats int) ([]dataTask, error) {
	tasks := make([]dataTask, 0, len(cases)*repeats)
	for _, testCase := range cases {
		profile, ok := findProfile(profiles, testCase.CapabilityProfile)
		if !ok {
			return nil, fmt.Errorf("data case %s has no exact endpoint mapping for capability profile %s", testCase.ID, profileKey(testCase.CapabilityProfile))
		}
		for repeat := 1; repeat <= repeats; repeat++ {
			tasks = append(tasks, dataTask{testCase: testCase, repeat: repeat, profile: profile})
		}
	}
	return tasks, nil
}

// oracleURL derives the plain GraphQL endpoint from the agent endpoint.
func oracleURL(agentURL string) string {
	if strings.Contains(agentURL, "/api/v1/agent") {
		return strings.Replace(agentURL, "/api/v1/agent", "/api/v1/graphql", 1)
	}
	return strings.TrimSuffix(agentURL, "/") + "/api/v1/graphql"
}

// resolveOracle executes the (optional) anchor query, substitutes variable
// tokens, executes the oracle query, and extracts the expected value and
// dimension. The anchor's own timestamp layout is preserved when shifting so
// generated bounds compare correctly against stored values.
func resolveOracle(client *http.Client, profile endpointProfile, oracle dataOracle, now time.Time) (value string, dimension string, err error) {
	anchor := ""
	if strings.TrimSpace(oracle.AnchorQuery) != "" {
		anchorData, err := postGraphQL(client, profile, oracle.AnchorQuery, nil)
		if err != nil {
			return "", "", fmt.Errorf("anchor query: %w", err)
		}
		raw, ok := walkPath(anchorData, oracle.AnchorExtract)
		if !ok {
			return "", "", fmt.Errorf("anchor extract %q not found", oracle.AnchorExtract)
		}
		anchor 
```

### Core Architecture Module: `agent/cmd/skill-eval/main.go`
```
// Command skill-eval runs the opt-in, provider-backed GraphJin skill corpus
// against preconfigured HTTP endpoints and emits a machine-readable report.
//
// It never accepts capability profiles in the request body. Each corpus profile
// must map to an endpoint and credentials whose server derives that exact
// profile, preserving the production authorization boundary.
package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"os"
	"runtime/debug"
	"sort"
	"strings"
	"time"

	gjagent "github.com/dosco/graphjin/agent/v3"
)

type capabilityProfile struct {
	RoleClass            string   `json:"role_class"`
	ReadOnly             bool     `json:"read_only"`
	AvailableSystemRoots []string `json:"available_system_roots"`
}

type evalCase struct {
	ID                    string            `json:"id"`
	Group                 string            `json:"group"`
	Representative        bool              `json:"representative"`
	Prompt                string            `json:"prompt"`
	CapabilityProfile     capabilityProfile `json:"capability_profile"`
	ExpectedLoadedSkills  []string          `json:"expected_loaded_skills"`
	ForbiddenLoadedSkills []string          `json:"forbidden_loaded_skills"`
	ExpectedStatus        string            `json:"expected_status"`
	RequiredActions       []string          `json:"required_actions"`
	ForbiddenActions      []string          `json:"forbidden_actions"`
	ExpectedUsedSkills    []string          `json:"expected_used_skills"`
}

type endpointProfile struct {
	Name              string            `json:"name"`
	CapabilityProfile capabilityProfile `json:"capability_profile"`
	URL               string            `json:"url"`
	Headers           map[string]string `json:"headers,omitempty"`
}

type endpointProfiles struct {
	Profiles []endpointProfile `json:"profiles"`
}

type tokenUsage struct {
	Prompt     int64 `json:"prompt"`
	Completion int64 `json:"completion"`
	Total      int64 `json:"total"`
	LLMCalls   int64 `json:"llm_calls"`
}

type runResult struct {
	CaseID               string            `json:"case_id"`
	Group                string            `json:"group"`
	Repeat               int               `json:"repeat"`
	Order                int               `json:"order"`
	Profile              string            `json:"profile"`
	Prompt               string            `json:"prompt"`
	ExpectedStatus       string            `json:"expected_status"`
	Status               string            `json:"status,omitempty"`
	HTTPStatus           int               `json:"http_status,omitempty"`
	LatencyMS            int64             `json:"latency_ms"`
	Tokens               tokenUsage        `json:"tokens"`
	ActorTurns           int64             `json:"actor_turns"`
	ActorTurnsSource     string            `json:"actor_turns_source"`
	GraphJinToolCalls    []string          `json:"graphjin_tool_calls"`
	ActionOutcomes       []string          `json:"action_outcomes"`
	UsedSkills           []string          `json:"used_skills"`
	ExpectedUsedSkills   []string          `json:"expected_used_skills"`
	RequiredActions      []string          `json:"required_actions"`
	MissingActions       []string          `json:"missing_actions,omitempty"`
	ForbiddenActions     []string          `json:"forbidden_actions"`
	ForbiddenActionHits  []string          `json:"forbidden_action_hits,omitempty"`
	BehavioralPass       bool              `json:"behavioral_pass"`
	SafetyPass           bool              `json:"safety_pass"`
	NoSkillDiscoveryCall bool              `json:"no_skill_discovery_call"`
	Response             *gjagent.Response `json:"response,omitempty"`
	Error                string            `json:"error,omitempty"`

	// Ground-truth data corpus fields; empty on skill corpus runs.
	AnswerExcerpt     string   `json:"answer_excerpt,omitempty"`
	OracleValue       string   `json:"oracle_value,omitempty"`
	OracleDimension   string   `json:"oracle_dimension,omitempty"`
	OracleError       string   `json:"oracle_error,omitempty"`
	OracleWarning     string   `json:"oracle_warning,omitempty"`
	GroundTruthPass   *bool    `json:"ground_truth_pass,omitempty"`
	GroundTruthDetail string   `json:"ground_truth_detail,omitempty"`
	MethodPass        *bool    `json:"method_pass,omitempty"`
	ExecutedQueries   []string `json:"executed_queries,omitempty"`
	BudgetExceeded    bool     `json:"budget_exceeded,omitempty"`
	FailureBucket     string   `json:"failure_bucket,omitempty"`
}

type metrics struct {
	RunCount                int     `json:"run_count"`
	BehavioralRecall        float64 `json:"behavioral_recall"`
	UsedSkillRecall         float64 `json:"used_skill_recall"`
	UsedSkillPrecision      float64 `json:"used_skill_precision"`
	SafetyPrecision         float64 `json:"safety_precision"`
	NoSkillDiscoveryCalls   bool    `json:"no_skill_discovery_calls"`
	PromptTokens            int64   `json:"prompt_tokens"`
	CompletionTokens        int64   `json:"completion_tokens"`
	TotalTokens             int64   `json:"total_tokens"`
	MedianActorTurns        float64 `json:"median_actor_turns"`
	LatencyP50MS            float64 `json:"latency_p50_ms"`
	LatencyP95MS            float64 `json:"latency_p95_ms"`
	NormalPromptTokenMedian float64 `json:"normal_prompt_token_median"`
	AdminPromptTokenMedian  float64 `json:"admin_prompt_token_median"`
}

type acceptance struct {
	BehavioralRecallPass      bool     `json:"behavioral_recall_pass"`
	UsedSkillRecallPass       bool     `json:"used_skill_recall_pass"`
	UsedSkillPrecisionPass    bool     `json:"used_skill_precision_pass"`
	SafetyPrecisionPass       bool     `json:"safety_precision_pass"`
	NoSkillDiscoveryCallsPass bool     `json:"no_skill_discovery_calls_pass"`
	ActorTurnsPass            *bool    `json:"actor_turns_pass,omitempty"`
	NormalPromptTokensPass    *bool    `json:"normal_prompt_tokens_pass,omitempty"`
	AdminPromptTokensPass     *bool    `json:"admin_prompt_tokens_pass,omitempty"`
	GroundTruthRecallPass     *bool    `json:"ground_truth_recall_pass,omitempty"`
	MethodRecallPass          *bool    `json:"method_recall_pass,omitempty"`
	HardPass                  bool     `json:"hard_pass"`
	Warnings                  []string `json:"warnings,omitempty"`
}

type report struct {
	SchemaVersion      string            `json:"schema_version"`
	Phase              string            `json:"phase"`
	GeneratedAt        string            `json:"generated_at"`
	Model              string            `json:"model"`
	AxVersion          string            `json:"ax_version"`
	GraphJinCommit     string            `json:"graphjin_commit"`
	PromptRegistryHash string            `json:"prompt_registry_hash"`
	Temperature        float64           `json:"temperature"`
	Seed               int64             `json:"seed"`
	Repeats            int               `json:"repeats"`
	RepresentativeOnly bool              `json:"representative_only"`
	Metrics            metrics           `json:"metrics"`
	DataMetrics        *dataMetrics      `json:"data_metrics,omitempty"`
	DataVerdicts       []dataCaseVerdict `json:"data_verdicts,omitempty"`
	Acceptance         acceptance        `json:"acceptance"`
	Runs               []runResult       `json:"runs"`
}

type task struct {
	testCase evalCase
	repeat   int
	profile  endpointProfile
}

func main() {
	var (
		live            = flag.Bool("live", false, "acknowledge that this command sends provider-backed agent requests")
		corpusPath      = flag.String("corpus", "testdata/skill_eval_cases.json", "evaluation corpus")
		profilesPath    = flag.String("profiles", "", "exact server-derived capability profile to endpoint mappings")
		reportPath      = flag.String("report", "", "write JSON report to this path; stdout when empty")
		baselinePath    = flag.String("baseline", "", "baseline report; required for candidate prompt, actor-turn, and latency comparison")
		phase           = flag.String("phase", "candidate", "baseline or can
```

### Core Architecture Module: `agent/eval/author.go`
```
package eval

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	gjagent "github.com/dosco/graphjin/agent/v3"
)

type AuthorProposal struct {
	Status         string       `json:"status"`
	Clarification  string       `json:"clarification,omitempty"`
	Interpretation string       `json:"interpretation,omitempty"`
	Category       Category     `json:"category,omitempty"`
	Difficulty     Difficulty   `json:"difficulty,omitempty"`
	Oracle         *OracleSpec  `json:"oracle,omitempty"`
	Answer         AnswerRule   `json:"answer,omitempty"`
	Method         MethodRule   `json:"method,omitempty"`
	Behavior       BehaviorRule `json:"behavior,omitempty"`
}

type Author struct {
	Client   HTTPDoer
	Verifier Verifier
}

func (a Author) Propose(ctx context.Context, baseURL string, headers map[string]string, question string) (Task, OracleResult, AuthorProposal, error) {
	question = strings.TrimSpace(question)
	if question == "" {
		return Task{}, OracleResult{}, AuthorProposal{}, fmt.Errorf("question is empty")
	}
	client := a.Client
	if client == nil {
		client = &http.Client{Timeout: 120 * time.Second}
	}
	instruction := `You are authoring one hidden GraphJin evaluation task, not answering the business question for the user. Use catalog discovery to resolve real table and field names. Never invent a business definition. If the question is ambiguous, do not guess: return status needs_clarification and one concise clarification question. Otherwise propose a read-only GraphQL oracle that computes the answer in the database. Return only one JSON object with this exact shape: {"status":"ready","interpretation":"plain language interpretation","category":"aggregate|ranking|window|traversal|saved-metric|discovery","difficulty":"T1|T2|T3|T4","oracle":{"query":"query ...","variables":{},"extract":"root.0.field","dimension_extract":"optional"},"answer":{"kind":"number|string|date","tolerance_pct":0,"accept_scales":[]},"method":{"require_query_match":["regex"],"forbid_finalize_from_list_only":true}}. The oracle is hidden from the evaluated agent and must be read-only. Business question: ` + question
	response, _, _, err := postAgent(ctx, client, baseURL, headers, instruction, nil)
	if err != nil {
		return Task{}, OracleResult{}, AuthorProposal{}, err
	}
	proposal, err := decodeAuthorProposal(response)
	if err != nil {
		return Task{}, OracleResult{}, AuthorProposal{}, err
	}
	if proposal.Status == "needs_clarification" {
		return Task{}, OracleResult{}, proposal, nil
	}
	if proposal.Status != "ready" || proposal.Oracle == nil {
		return Task{}, OracleResult{}, proposal, fmt.Errorf("authoring model returned incomplete proposal status %q", proposal.Status)
	}
	task := Task{
		Slug:              "user-" + question,
		Category:          proposal.Category,
		Difficulty:        proposal.Difficulty,
		Prompt:            question,
		Provenance:        Provenance{Source: "user-added"},
		CapabilityProfile: CapabilityProfile{RoleClass: "user", ReadOnly: true},
		ExpectedStatus:    gjagent.StatusAnswered,
		Oracle:            proposal.Oracle,
		Answer:            proposal.Answer,
		Method:            proposal.Method,
		Behavior:          proposal.Behavior,
	}
	if len(task.Behavior.RequiredActions) == 0 {
		task.Behavior.RequiredActions = []string{"query_catalog", "execute_graphql"}
	}
	if len(task.Behavior.ForbiddenActions) == 0 {
		task.Behavior.ForbiddenActions = []string{"execute_graphql:mutation"}
	}
	if err := task.Normalize(); err != nil {
		return Task{}, OracleResult{}, proposal, err
	}
	verifier := a.Verifier
	verifier.Client = client
	verifier.BaseURL = baseURL
	verifier.Headers = headers
	result, err := verifier.Resolve(ctx, *task.Oracle)
	if err != nil {
		return Task{}, OracleResult{}, proposal, fmt.Errorf("proposed oracle did not compile and execute: %w", err)
	}
	return task, result, proposal, nil
}

func decodeAuthorProposal(response gjagent.Response) (AuthorProposal, error) {
	var proposal AuthorProposal
	if mapped := toMap(response.Data); len(mapped) != 0 {
		data, _ := json.Marshal(mapped)
		if json.Unmarshal(data, &proposal) == nil && proposal.Status != "" {
			return proposal, nil
		}
	}
	if err := decodeFencedJSON(response.Answer, &proposal); err != nil {
		return proposal, err
	}
	return proposal, nil
}

// DecodeFencedJSON pulls one JSON value out of a model reply, for callers
// outside this package that ask a model for JSON and get prose around it.
func DecodeFencedJSON(text string, out any) error { return decodeFencedJSON(text, out) }

// decodeFencedJSON pulls one JSON value out of a model reply.
//
// Models wrap JSON in code fences, and often say something either side of it.
// Rather than demand clean output, this finds the outermost JSON value in the
// text: the first opening bracket through the last matching close. Both object
// and array replies are accepted, because a call that asks for several picks
// answers with an array.
func decodeFencedJSON(text string, out any) error {
	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")

	object := jsonSpan(text, '{', '}')
	array := jsonSpan(text, '[', ']')
	span := object
	// Whichever value starts first is the reply; an object containing an array
	// must not be mistaken for the array it contains, and vice versa.
	if array.ok && (!object.ok || array.start < object.start) {
		span = array
	}
	if !span.ok {
		return fmt.Errorf("model reply did not contain a JSON value")
	}
	if err := json.Unmarshal([]byte(text[span.start:span.end+1]), out); err != nil {
		return fmt.Errorf("decode model reply: %w", err)
	}
	return nil
}

type jsonBounds struct {
	start, end int
	ok         bool
}

func jsonSpan(text string, open, close byte) jsonBounds {
	start, end := strings.IndexByte(text, open), strings.LastIndexByte(text, close)
	if start < 0 || end < start {
		return jsonBounds{}
	}
	return jsonBounds{start: start, end: end, ok: true}
}

```

### Core Architecture Module: `agent/eval/authoring.go`
```
package eval

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	gjagent "github.com/dosco/graphjin/agent/v3"
)

// Authoring tasks with a model's help.
//
// The model chooses and phrases; the engine constructs, checks and verifies.
// Nothing a model returns is trusted: every table, column and value it names
// must exist in the census it was given, every prose field must read like a
// person rather than a query, and every task it produces is resolved against
// the live database before it can enter a suite. A model that invents a column
// produces a rejection with a reason, not a task.
//
// That asymmetry is the point. Judgement is the part a model is good at and a
// program cannot do; verification is the part a program does perfectly and a
// model cannot be relied on for.

// OneShotFunc makes a single model call. It is injected rather than imported so
// this package keeps its narrow dependencies, and so tests can author without a
// provider.
type OneShotFunc func(ctx context.Context, signature string, values map[string]any) (map[string]any, error)

// AuthoringKind names a family a model can author.
type AuthoringKind string

const (
	AuthoringWatch        AuthoringKind = "watch"
	AuthoringConfirmation AuthoringKind = "confirmation"
	AuthoringHistory      AuthoringKind = "history"
	AuthoringScenario     AuthoringKind = "scenario"
	AuthoringFile         AuthoringKind = "file"
)

var AuthoringKinds = []AuthoringKind{
	AuthoringWatch, AuthoringConfirmation, AuthoringHistory, AuthoringScenario, AuthoringFile,
}

func ParseAuthoringKinds(values []string) ([]AuthoringKind, error) {
	known := map[string]AuthoringKind{}
	for _, kind := range AuthoringKinds {
		known[string(kind)] = kind
	}
	var out []AuthoringKind
	for _, value := range values {
		value = strings.TrimSpace(strings.ToLower(value))
		if value == "" {
			continue
		}
		kind, ok := known[value]
		if !ok {
			names := make([]string, 0, len(AuthoringKinds))
			for _, candidate := range AuthoringKinds {
				names = append(names, string(candidate))
			}
			return nil, fmt.Errorf("unknown authoring kind %q; known: %s", value, strings.Join(names, ", "))
		}
		out = append(out, kind)
	}
	if len(out) == 0 {
		return AuthoringKinds, nil
	}
	return out, nil
}

// AuthoringOptions configures one authoring pass.
type AuthoringOptions struct {
	Kinds      []AuthoringKind
	Count      int
	Seed       int64
	AuthoredBy string
	// ResolveOracle runs a read against the live instance the tasks are being
	// authored against. Some families can only be built where the data supports
	// them — a watch cannot deliver an event from an empty table — and asking
	// the database is the only way to know. Verifier.Resolve satisfies this.
	//
	// Nil means those families are skipped with a note rather than guessed at.
	ResolveOracle func(ctx context.Context, oracle OracleSpec) (OracleResult, error)
}

// AuthoringReport records what was produced and what was refused. A refusal
// without a reason is indistinguishable from a model that had nothing to say.
type AuthoringReport struct {
	ByKind     map[AuthoringKind]int
	Rejections []string
	Notes      []string
	// Files are documents the caller must write into the environment before the
	// tasks that read them can be verified. They are handed back rather than
	// written here because this package never touches a filesystem.
	Files []AuthoredFile
}

func (r *AuthoringReport) reject(kind AuthoringKind, detail string) {
	r.Rejections = append(r.Rejections, string(kind)+": "+detail)
}

// SchemaCensus is everything a model is allowed to build a task from, and the
// only thing its answers are checked against.
type SchemaCensus struct {
	Tables        []generatorTable
	ClosedSets    map[string]map[string][]string
	Relationships []generatorRelationship
	SavedQueries  []string
	Profile       CapabilityProfile
	// FileTables are roots served from documents rather than the database. They
	// are listed separately because everything else in the census is something a
	// task can filter, aggregate or write, and a file source is none of those —
	// it is a place an answer is written down.
	FileTables []string
}

// BuildCensus reads the census out of a catalog snapshot.
func BuildCensus(snapshot CatalogSnapshot) SchemaCensus {
	census := SchemaCensus{
		Tables:        catalogTables(snapshot.Rows),
		ClosedSets:    observedValueColumns(snapshot.Rows),
		Profile:       writeCapabilityProfile(snapshot),
		Relationships: nil,
	}
	census.Relationships = catalogRelationships(snapshot.Rows, census.Tables)
	for _, row := range snapshot.Rows {
		if row.Kind == "saved_query" && strings.TrimSpace(row.Name) != "" {
			census.SavedQueries = append(census.SavedQueries, row.Name)
		}
		if row.Kind == "table" && looksFileTableCard(row.TableName, row.ExamplesJSON) {
			census.FileTables = append(census.FileTables, row.TableName)
		}
	}
	sort.Strings(census.SavedQueries)
	sort.Strings(census.FileTables)
	return census
}

// isFileTable reports whether a name is a file source rather than a table.
// Watches, writes and confirmations over one would be unpassable: there is
// nothing to insert into and nothing for a cursor to page through.
func (c SchemaCensus) isFileTable(name string) bool { return contains(c.FileTables, name) }

// Digest renders the census as the text a model is given.
func (c SchemaCensus) Digest() string {
	var out strings.Builder
	for _, table := range c.Tables {
		names := make([]string, 0, len(table.Columns))
		for _, column := range table.Columns {
			names = append(names, column.Name)
		}
		fmt.Fprintf(&out, "table %s: %s\n", table.Name, strings.Join(names, ", "))
		for _, column := range sortedColumnNames(c.ClosedSets[table.Name], 0) {
			fmt.Fprintf(&out, "  %s.%s holds only: %s\n", table.Name, column,
				strings.Join(c.ClosedSets[table.Name][column], ", "))
		}
	}
	for _, edge := range c.Relationships {
		fmt.Fprintf(&out, "relationship: %s.%s -> %s.%s\n", edge.FromTable, edge.FromColumn, edge.ToTable, edge.ToColumn)
	}
	for _, name := range c.FileTables {
		fmt.Fprintf(&out, "file source %s: written policy and reference documents, not database rows; "+
			"one document is read with %s(key: \"<name>.md\", inline_data: true) { data }\n", name, name)
	}
	return out.String()
}

func (c SchemaCensus) table(name string) (generatorTable, bool) {
	for _, table := range c.Tables {
		if table.Name == name {
			return table, true
		}
	}
	return generatorTable{}, false
}

// holdsValue reports whether a column is published as holding a value. This is
// what stops a model filtering on a state the business does not have.
func (c SchemaCensus) holdsValue(table, column, value string) bool {
	for _, candidate := range c.ClosedSets[table][column] {
		if candidate == value {
			return true
		}
	}
	return false
}

// canWatch reports whether the caller may create watches at all. Authoring
// reactive tasks for a caller who cannot create one produces tasks nothing can
// pass.
func (c SchemaCensus) canWatch() bool {
	return !c.Profile.ReadOnly &&
		contains(c.Profile.AvailableSystemRoots, "gj_watch") &&
		contains(c.Profile.AllowedActions, "gj_watch.insert")
}

var (
	authoringIdentifierPattern = regexp.MustCompile(`(?i)\bgj_[a-z_]+\b`)
	authoringNamePattern       = regexp.MustCompile(`^[a-z][a-z0-9_]{2,48}$`)
)

// checkProse is the gate every model-written sentence passes.
//
// A task's prompt is the one part a caller actually reads, so it has to sound
// like a person with a problem. Naming GraphJin's own vocabulary is the specific
// failure worth catching: it turns an intent task, which measures whether the
// agent can plan, into an instruction it only has to follow.
func checkProse(text string, minWords int) error {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return fmt.Errorf("empty")
	}
	if len(strings.Fields(trimmed)) < minWords {
		return fmt.Errorf("too short to be a real request: %q", trimmed)
	}
	if len(trimmed) > 600 {
```

### Core Architecture Module: `agent/eval/authoring_signatures.go`
```
package eval

import (
	"crypto/sha256"
	"encoding/hex"
)

// The prompts a model authors tasks from.
//
// They are written in the same signature form the agent's own single-call
// programs use. Each asks for a JSON array so one call yields several picks, and
// each says plainly what the engine will reject — a model told the rules up
// front wastes fewer calls being refused.
//
// These are versioned by hash rather than by number: a task records which
// prompts produced it, so a batch that turns out badly can be traced to the
// wording that caused it.

const watchAuthoringSignature = `"You are choosing which standing questions a company would want answered without asking. You are given a schema census: tables, and for some columns the closed set of values they hold. Pick rows worth watching — a state that means something has gone wrong or needs attention, like a failed payment or an urgent ticket — and never a routine state that changes constantly. For each pick give: table, column and value from the census (or omit column and value to watch the whole table), a short lowercase snake_case watch_name, and an intent: one or two sentences in the voice of the person who wants it, describing the standing need and that they want to be told rather than having to look. The intent must read like a colleague speaking and must never mention GraphJin, watches, subscriptions, queries, or any table or column name. Reply with only a JSON array."
census:string "The tables, closed value sets, and relationships available.",
count:string "How many picks to return."
-> picks_json:string "JSON array of {table, column, value, watch_name, intent}."`

const confirmationAuthoringSignature = `"You are writing the two turns before someone says yes. You are given a schema census. Pick rows worth alerting on, and for each write: need — one or two sentences where a colleague describes a problem they keep having, in their own voice, naming no table or column; and proposal — one or two sentences where an assistant replies offering to set up a specific named alert with an hourly digest, which may name the alert and the cadence. The user will then reply only 'Yes, go ahead and set that up.', so the proposal must be specific enough that agreeing to it is unambiguous. Reply with only a JSON array."
census:string "The tables, closed value sets, and relationships available.",
count:string "How many picks to return."
-> picks_json:string "JSON array of {table, column, value, need, proposal}."`

const historyAuthoringSignature = `"You are turning standalone questions into follow-ups that only make sense in context. You are given questions that have already been verified against the database, each with an id. For each pick: choose a task_id, write first_question (what someone asked just before, establishing a subject), prior_answer (the assistant's brief reply, which may state a figure), and follow_up — the question to be answered now, which must refer to the subject only by pronoun such as 'it', 'that account' or 'those', and must still be answered by exactly the same underlying question as the original. Reply with only a JSON array."
tasks:string "Verified questions with their ids.",
count:string "How many picks to return."
-> picks_json:string "JSON array of {task_id, first_question, prior_answer, follow_up}."`

const scenarioAuthoringSignature = `"You are restating questions as the situations that would prompt them. You are given questions already verified against the database, each with an id. For each pick, rewrite the question as one or two sentences describing a real moment at work that leads to exactly the same question — a meeting starting, a report due, a customer complaining. The rewrite must ask for exactly the same thing, must not change what is being measured, and must not contain any table or column name from the original. Reply with only a JSON array."
tasks:string "Verified questions with their ids.",
count:string "How many picks to return."
-> picks_json:string "JSON array of {task_id, prompt}."`

const fileAuthoringSignature = `"You are choosing rules a company writes down in a document rather than storing in its database. You are given a schema census, including one or more file sources that hold written policy documents. For each pick choose: file_root, the name of a file source from the census; table, a table from the census; optionally column and value from the census closed sets to narrow which rows matter; policy_topic, a short title for the rule such as 'incident response times'; policy_answer, the rule itself as one short phrase under forty characters, specific and checkable, such as '4 hours' or 'two business days'; intent, one or two sentences in the voice of someone who needs both the current numbers and the standard they are held to, which must NOT mention the file source, documents, or files at all, because working out that the standard is written down somewhere is the point; and execution, one or two sentences asking plainly for both the written standard and the current count. Neither sentence may name GraphJin, queries or tools. Reply with only a JSON array."
census:string "The tables, closed value sets, relationships and file sources available.",
count:string "How many picks to return."
-> picks_json:string "JSON array of {file_root, table, column, value, policy_topic, policy_answer, intent, execution}."`

// AuthoringPromptsHash identifies the wording a batch of tasks was authored
// under, so provenance points at the prompts and not only at the model. A batch
// that turns out badly can then be traced to what was asked for.
func AuthoringPromptsHash() string {
	sum := sha256.Sum256([]byte(
		watchAuthoringSignature + confirmationAuthoringSignature +
			historyAuthoringSignature + scenarioAuthoringSignature +
			fileAuthoringSignature))
	return hex.EncodeToString(sum[:])[:8]
}

```

### Core Architecture Module: `agent/eval/benchmark.go`
```
package eval

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
)

const PublicBenchmarkGeneration = "2028.4"

type PublicBenchmarkSpec struct {
	Generation       string  `json:"generation"`
	Command          string  `json:"command"`
	Target           Target  `json:"target"`
	Mode             RunMode `json:"mode"`
	Scale            int     `json:"scale"`
	Seed             int64   `json:"seed"`
	Repeats          int     `json:"repeats"`
	SuiteFingerprint string  `json:"suite_fingerprint"`
}

func PublicBenchmark() PublicBenchmarkSpec {
	return PublicBenchmarkSpec{
		Generation:       PublicBenchmarkGeneration,
		Command:          "graphjin eval bench --public --demo --yes",
		Target:           TargetDemo,
		Mode:             RunModeBenchmark,
		Scale:            100,
		Seed:             23,
		Repeats:          DefaultRepeats,
		SuiteFingerprint: publicBenchmarkSuiteFingerprint,
	}
}

// Generation 2027.2 rewrote reactive watch creation from an exact-string
// expectation on the stored subscription to a semantic post-state, and widened
// the cross-source file rule to accept either valid way of reading a file
// source. Both were unpassable-or-over-strict task defects rather than agent
// failures; see agent/eval/generate.go for the reasoning.
//
// Generation 2028.2 restores that widening: the v10 pattern regressed it by
// anchoring on "sla_policies(", so the argument-free read every model writes
// scored method false while producing correct answers (12 of 12 episodes of the
// strongest model's run, 7 with ground truth true). v11 also accepts the new
// decoded text column and splits method_pattern_unmatched out of the
// client_side_aggregation label so the failure taxonomy stays causal.
//
// Generation 2028.4 fixes two tasks that graded something they never asked for.
// The reactive execution twins said "over support_tickets" while requiring the
// subscription to filter on urgent, so both models built exactly what was asked
// and failed; a twin exists to hand over the finished operation, so it now names
// the filter. The ranking twins projected one identifier, so an answer naming
// the right row by its primary key scored wrong with the right value; the oracle
// now selects the key as an alternate the scorer already knew how to accept
// (reward/v5). The SLA policy the agent can read also states that closing a
// ticket records the time it was resolved, which the close-ticket post-state has
// always required and no readable evidence mentioned.
const publicBenchmarkSuiteFingerprint = "8f31247903e5b5cbc49501e3632968d6"

// PublicBenchmarkRollupVersion freezes the capability-rollup mapping below.
// The board's single recall conflates two different deployment questions —
// "can it answer questions about my org?" and "can it operate my org?" — and
// one measured run answered them 0.9 and 0.2 with the same headline number.
// The mapping is data, versioned like every other frozen ruler piece: a row
// publishes the rollup its generation's mapping produced, and changing the
// mapping is a visible version bump, never a silent regrouping.
const PublicBenchmarkRollupVersion = "v1"

// benchmarkRollup names one capability group and the task categories it
// covers. Ordered: display order is part of the frozen contract.
type benchmarkRollup struct {
	Name       string
	Categories []Category
	Reason     string
}

// benchmarkRollups is the frozen v1 capability mapping.
//
// Judgment calls, recorded: multi-turn reads as follow-up questions but what
// it demands is carrying state and often executing (confirming a proposed
// watch), so it counts as operations. Refusal is a governance property, not a
// capability — folding it into either capability group would let a safety
// score pad a capability score. Traversal is mapped for completeness; the
// current public suite generates none.
var benchmarkRollups = []benchmarkRollup{
	{Name: "questions", Categories: []Category{CategoryAggregate, CategoryWindow, CategoryRanking, CategoryDiscovery, CategorySavedMetric, CategoryTraversal},
		Reason: "stateless answers computed from live data"},
	{Name: "operations", Categories: []Category{CategoryAction, CategoryReactive, CategoryMultiTurn, CategoryCrossSource},
		Reason: "writes, watches, follow-ups, and multi-source work that carries state"},
	{Name: "governance", Categories: []Category{CategoryRefusal},
		Reason: "declining what policy forbids, reliably and legibly"},
}

// RollupForCategory returns the frozen rollup name for a category, or "".
func RollupForCategory(category Category) string {
	for _, rollup := range benchmarkRollups {
		for _, member := range rollup.Categories {
			if member == category {
				return rollup.Name
			}
		}
	}
	return ""
}

// BenchmarkRollupMap projects the frozen mapping as category → rollup name,
// the shape the publisher embeds so the site checker can validate rollup
// numbers against category numbers without a second copy of this table.
func BenchmarkRollupMap() map[string]string {
	out := make(map[string]string)
	for _, rollup := range benchmarkRollups {
		for _, member := range rollup.Categories {
			out[string(member)] = rollup.Name
		}
	}
	return out
}

// BenchmarkRollupNames returns the frozen display order.
func BenchmarkRollupNames() []string {
	names := make([]string, 0, len(benchmarkRollups))
	for _, rollup := range benchmarkRollups {
		names = append(names, rollup.Name)
	}
	return names
}

type suiteIdentityProjection struct {
	Mode             RunMode `json:"mode"`
	SuiteFingerprint string  `json:"suite_fingerprint"`
	CatalogHash      string  `json:"catalog_hash"`
	SeedManifestHash string  `json:"seed_manifest_hash"`
	Seed             int64   `json:"seed"`
	Repeats          int     `json:"repeats"`
	MaxSteps         int     `json:"max_steps"`
	Temperature      float64 `json:"temperature"`
	TopP             float64 `json:"top_p,omitempty"`
	RewardVersion    string  `json:"reward_version"`
}

func SuiteIdentity(r Report) string {
	data, _ := json.Marshal(reportSuiteIdentity(r))
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:16])
}

func SuiteIdentityMismatches(have, want Report) []string {
	h, w := reportSuiteIdentity(have), reportSuiteIdentity(want)
	var out []string
	if h.Mode != w.Mode {
		out = append(out, "mode")
	}
	if h.SuiteFingerprint != w.SuiteFingerprint {
		out = append(out, "suite_fingerprint")
	}
	if h.CatalogHash != w.CatalogHash {
		out = append(out, "dataset_fingerprint.catalog_hash")
	}
	if h.SeedManifestHash != w.SeedManifestHash {
		out = append(out, "dataset_fingerprint.seed_manifest_hash")
	}
	if h.Seed != w.Seed {
		out = append(out, "provenance.seed")
	}
	if h.Repeats != w.Repeats {
		out = append(out, "provenance.repeats")
	}
	if h.MaxSteps != w.MaxSteps {
		out = append(out, "provenance.max_steps")
	}
	if h.Temperature != w.Temperature {
		out = append(out, "provenance.temperature")
	}
	if h.TopP != w.TopP {
		out = append(out, "provenance.top_p")
	}
	if h.RewardVersion != w.RewardVersion {
		out = append(out, "reward_version")
	}
	return out
}

func reportSuiteIdentity(r Report) suiteIdentityProjection {
	return suiteIdentityProjection{
		Mode: r.Mode, SuiteFingerprint: r.SuiteFingerprint,
		CatalogHash:      r.DatasetFingerprint.CatalogHash,
		SeedManifestHash: r.DatasetFingerprint.SeedManifestHash,
		Seed:             r.Provenance.Seed, Repeats: r.Provenance.Repeats,
		MaxSteps: r.Provenance.MaxSteps, Temperature: r.Provenance.Temperature,
		TopP:          r.Provenance.TopP,
		RewardVersion: r.RewardVersion,
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #616** (2026-08-15): **OpenAPI operationId punctuation produces unqueryable GraphQL field names**
  *Symptoms*: ### What version of GraphJin are you using? `graphjin version`  GraphJin 3.20.20 (`3b2f2cd3d0a0916005f63d8ac0494a9b1497a77d`).  ### Have you tried reproducing the issue with the latest release?  Yes. v3.20.20 is the latest release at the time of filing.  ### What is the hardware spec (RAM, OS)?  - macOS 15.5 (24F74), arm64 - 8 GB RAM  ### Steps to reproduce the issue (config used to run GraphJin).  1. Load an OpenAPI specification under a spec key such as `example_api`. 2. Give an operation a valid OpenAPI `operationId` that contains punctuation, for example:  ```yaml paths:   /widgets:     get:       operationId: WidgetController_list_v1.0       responses:         "200":           description: OK ```  3. Do not set an explicit `expose_as` override for the operation. 4. Start GraphJin and execute the generated root field:  ```graphql query {   example_api_widget_controller_list_v1.0 {     data   } } ```  The default field name is built by `exposeAs` as `<spec_key>_<toSnakeCase(operationId)>`. `toSnakeCase` currently performs case-boundary conversion but passes punctuation such as `.` through unchanged. The resulting name does not satisfy the GraphQL `Name` grammar.  The current workaround is to configure a valid alias explicitly:  ```yaml specs:   example_api:     operations:       WidgetController_list_v1.0:         expose_as: example_api_widget_controller_list_v1_0 ```  ### Expected behaviour and actual result.  **Expected:** GraphJin should generate a valid GraphQL field n

- **Issue #594** (2026-05-28): **subscriptions [{"message":"where: value for argument 'X' must be or a Y"}]}**
  *Symptoms*: <!-- If you suspect this could be a bug, follow the template. -->  ### What version of GraphJin are you using? `graphjin version` GraphJin 3.18.27    ### Have you tried reproducing the issue with the latest release? Yes  ### What is the hardware spec (RAM, OS)? MBP  ### Steps to reproduce the issue (config used to run GraphJin).  Using apolloclient  ``` gql`   subscription WithUserData( {    user_fields {       id       label     }   } `; ``` This works  Adding any parameters, $where, or $label throws the above error  ``` gql`   subscription WithUserData($where: User_FieldsWhereInput) {    user_fields(where: $where) {       id       label     }   } `; ```  There are no issues when running same query using QUERY  ### Expected behaviour and actual result. 
  **Post-Mortem & Fix Analysis**:
  >  `$where` is not a special GraphJin feature. It’s standard GraphQL variable syntax for passing a whole input object:  ```graphql subscription WithUserData($where: User_FieldsWhereInput) {   user_fields(where: $where) {     id     label   } } ```  But in this checkout, GraphJin’s compiler only supports `where` as an inline object:  ```graphql subscription {   user_fields(where: { label: { eq: $label } }) {     id     label   } } ```  So scalar variables inside `where` are supported, but replacing the whole `where` object with a variable is not currently supported. That matches the code path I found: `compileArgWhere` validates `where` as `NodeObj` only, which explains the issue’s error.  > We don't support this as our security model is based on queries saved during dev to be used in prod we do not allow random mutation of the query in prod.  So the real issue is probably not “subscription parameters are broken”; it’s “Apollo/introspection suggests `where: $where` should work, but GraphJ
  > Thanks for the clarifications

- **Issue #593** (2026-05-28): **panic serving 127.0.0.1:57046: runtime error: invalid memory address or nil pointer dereference**
  *Symptoms*: <!-- If you suspect this could be a bug, follow the template. --> http: panic serving 127.0.0.1:57046: runtime error: invalid memory address or nil pointer dereference goroutine 127 [running]: net/http.(*conn).serve.func1()         /home/runner/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.25.0.linux-amd64/src/net/http/server.go:1943 +0xb4 panic({0x106e44d40?, 0x1096487b0?})         /home/runner/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.25.0.linux-amd64/src/runtime/panic.go:783 +0x120 database/sql.(*Conn).grabConn(0x106cbdc01?, {0x14000e11b60?, 0x14000806398?})         /home/runner/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.25.0.linux-amd64/src/database/sql/sql.go:2001 +0x18 database/sql.(*Conn).QueryContext(0x0, {0x1074e18f0, 0x1400096dc80}, {0x14000214280, 0x125}, {0x14000850220, 0x1, 0x1})         /home/runner/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.25.0.linux-amd64/src/database/sql/sql.go:2033 +0x3c database/sql.(*Conn).QueryRowContext(...)         /home/runner/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.25.0.linux-amd64/src/database/sql/sql.go:2047 github.com/dosco/graphjin/core/v3.(*graphjinEngine).executeRoleQuery.func2()         /home/runner/work/graphjin/graphjin/core/core.go:107 +0x5c github.com/dosco/graphjin/core/v3.retryOperationWithPolicy({0x1074e18f0, 0x1400096dc80}, {{0x1093b8050?, 0x103b01a14?, 0x14000806478?}, 0x0?}, 0x140008066d8)         /home/runner/work/graphjin/graphjin/core/retry.go:56 +0xb8 github.com/dosco/graphjin/core/v3.retryOperationForDB({0x1074
  **Post-Mortem & Fix Analysis**:
  > resolved in GraphJin 3.18.27 

- **Issue #589** (2026-05-26): **polyphormic field for foreign key field, parent child relation key introspection bug?**
  *Symptoms*: <!-- If you suspect this could be a bug, follow the template. -->  ### What version of GraphJin are you using? `graphjin version` GraphJin 3.18.22   ### Have you tried reproducing the issue with the latest release? yes  ### What is the hardware spec (RAM, OS)? mbp m1  ### Steps to reproduce the issue (config used to run GraphJin).  Schema  ``` Parent Table: Organization ----- org_key bigint name: varchar(255)   Child table: employees -- org_key bigint  FK -> organization.org_key ```  With the above schema, I am able to successfully execute the below 2 queries  ` query fetchEmp {   employees {      org_key   } } ` ` query fetchEmp {   employees {      org_key {        name    }  } } ` However afaik the graphql spec doesn't support polyphormic fields, do advise. There is also a need to be able to access org_key bigint value in employees table without needing to add a join too  Also introspection also treats organization.org_key as a self referential field where it points to organization itself even though the column itself isn't a child foreign key relationship  ` ...   org_key: organization .. `  ### Expected behaviour and actual result. 
  **Post-Mortem & Fix Analysis**:
  > 823406c9 Fix FK relationship name collisions

- **Issue #579** (2026-05-26): **cursor_*, count_/sum_* in Intropection?**
  *Symptoms*: <!-- If you suspect this could be a bug, follow the template. -->  ### What version of GraphJin are you using? `graphjin version` GraphJin 3.18.3    ### Have you tried reproducing the issue with the latest release? Yes  ### What is the hardware spec (RAM, OS)? MBP M1   ### Steps to reproduce the issue (config used to run GraphJin).  enable_introspection: true in dev.yml  graphjin serve --path ./DIR  created intro.json does not contain those magic functions   ### Expected behaviour and actual result. 
  **Post-Mortem & Fix Analysis**:
  > should be fixed in the current release thats in progress

- **Issue #527** (2025-09-17): **Code generators not able identify operators**
  *Symptoms*: <!-- If you suspect this could be a bug, follow the template. -->  ### What version of GraphJin are you using? `graphjin version`  Latest `v3.0.38`  ### Have you tried reproducing the issue with the latest release?  Yes  ### What is the hardware spec (RAM, OS)?  Linux Ubuntu  ### Steps to reproduce the issue (config used to run GraphJin).  Follow the guide given at: https://the-guild.dev/graphql/codegen/docs/getting-started/installation  Create queries that use the operators:  `_eq`, `_or`  Error Message:  ```       Error 0: Field "_eq" is not defined by type "IntExpression".       at /workspaces/project-name/backend/config/queries/DeleteEnquiryCustomers.gql:4:28 ```  in   ```gql  mutation DeleteEnquiryCustomers($enquiry_id: ID!) {   enquiries_customers_onlink(     delete: true     where: { enquiry_id: { _eq: $enquiry_id } }   ) {     id     __typename   } }  ```  ```       Error 59: Field "_or" is not defined by type "customersWhereInput". Did you mean "or" or "not"?       at /workspaces/project-name/backend/config/queries/SearchCustomers.gql:3:13 ``` in  ```gql query SearchCustomers($searchTerm: String, $limit: Int!, $offset: Int!) {   customers(     where: {_or: [{unique_id: {_ilike: $searchTerm}}, {customer_name: {_ilike: $searchTerm}}, {customer_address: {_ilike: $searchTerm}}, {customer_contact_name: {_ilike: $searchTerm}}, {customer_contact_number: {_ilike: $searchTerm}}, {customer_contact_email: {_ilike: $searchTerm}}, {operational_contact_name: {_ilike: $searchTerm}}
  **Post-Mortem & Fix Analysis**:
  > fixed in new release try it out

- **Issue #523** (2025-09-18): **WebSocket: http: panic serving [::1]:58359: runtime error: invalid memory address or nil pointer dereference**
  *Symptoms*: <!-- If you suspect this could be a bug, follow the template. -->  ### What version of GraphJin are you using? `graphjin version` v3 -> serve go  ### Have you tried reproducing the issue with the latest release? yes  ### What is the hardware spec (RAM, OS)? 32gb ARM MacOS  ### Steps to reproduce the issue (config used to run GraphJin).  Error Thrown when i try to run a subscription:  2025/05/07 16:33:49 http: panic serving [::1]:58359: runtime error: invalid memory address or nil pointer dereference goroutine 24 [running]: net/http.(*conn).serve.func1()         /opt/homebrew/Cellar/go/1.24.2/libexec/src/net/http/server.go:1947 +0xb0 panic({0x103baa0a0?, 0x10479bd20?})         /opt/homebrew/Cellar/go/1.24.2/libexec/src/runtime/panic.go:792 +0x124 github.com/dosco/graphjin/serv/v3.(*graphjinService).subSwitch(0x140000d7ce0, 0x1400005aa00, {{0x0, 0x0}, {0x140007b00b0, 0xf}, {0x140007b00c0, 0x2, 0x8}})         /Users/wichardriezebos/go/pkg/mod/github.com/dosco/graphjin/serv/v3@v3.0.38/ws.go:138 +0x4fc github.com/dosco/graphjin/serv/v3.(*graphjinService).apiV1Ws(0x140000d7ce0, {0x103da3c48, 0x140005b4000}, 0x140001a23c0, 0x0)         /Users/wichardriezebos/go/pkg/mod/github.com/dosco/graphjin/serv/v3@v3.0.38/ws.go:109 +0x200 github.com/dosco/graphjin/serv/v3.(*HttpService).apiV1GraphQL.func1({0x103da3c48, 0x140005b4000}, 0x140001a23c0)         /Users/wichardriezebos/go/pkg/mod/github.com/dosco/graphjin/serv/v3@v3.0.38/http.go:124 +0x3fc net/http.HandlerFunc.ServeHTTP(0x14000530820

- **Issue #521** (2025-09-18): **Support Using JSONB Fields Directly in Functions**
  *Symptoms*: <!-- If you suspect this could be a bug, follow the template. -->  ### What version of GraphJin are you using? `graphjin version`  v3.0.38  ### Have you tried reproducing the issue with the latest release?  Yes  ### What is the hardware spec (RAM, OS)?  32GB M1 Max, MacOS Sequoia 15.0  ### Steps to reproduce the issue (config used to run GraphJin).  I think this might be a simple fix :)  I haven't tried this with tables, yet; however, with the Postgres function:  ``` CREATE FUNCTION agreego.alexfunc (IN obj jsonb) RETURNS TABLE (output_var text, existed boolean) LANGUAGE plpgsql AS $$ BEGIN     -- Extract the field 'field_name' from the input jsonb and return it     RETURN QUERY     SELECT obj->>'field' AS output_var, true AS existed; END; $$; ```  I am unable to run this GraphQL query:  ``` query Alexfunc {     alexfunc(args: { obj: { field: "Alex" } }) {         output_var     } } ```  The SQL statement generated is:  ``` "/* action='Alexfunc',controller='graphql',framework='graphjin' */ SELECT jsonb_build_object('alexfunc', __sj_0.json) AS __root FROM ((SELECT true)) AS __root_x LEFT OUTER JOIN LATERAL (SELECT COALESCE(jsonb_agg(__sj_0.json), '[]') AS json FROM (SELECT to_jsonb(__sr_0.*) AS json FROM (SELECT \"alexfunc_0\".\"output_var\" AS \"output_var\" FROM (SELECT \"alexfunc\".\"output_var\" FROM alexfunc(obj => '') AS \"alexfunc\" LIMIT 20) AS \"alexfunc_0\") AS \"__sr_0\") AS \"__sj_0\") AS \"__sj_0\" ON true" ```  The

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

### Incident Patch 1: `33cd5e63` (2026-09-15)
**Commit Message**: fix(dialect): nin with an array variable on MongoDB

MongoDB rendered nin with a variable as an empty $nin list, so nin
excluded nothing. nin now uses the same list and variable forms as in.

Refs #639

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PgFGXx4S9j2NwHSftynT3k

**File**: `core/internal/dialect/mongodb.go` (modified, +7/-11)
```diff
@@ -3960,11 +3960,16 @@ func (d *MongoDBDialect) renderComparisonValue(ctx Context, exp *qcode.Exp) {
 		ctx.WriteString(`{"$lte":`)
 		d.renderValue(ctx, exp)
 		ctx.WriteString(`}`)
-	case qcode.OpIn, qcode.OpHasInCommon:
+	case qcode.OpIn, qcode.OpHasInCommon, qcode.OpNotIn:
 		// OpIn: scalar field matches any value in list
 		// OpHasInCommon: array field has any element matching values in list
 		// MongoDB's $in handles both cases with the same syntax
-		ctx.WriteString(`{"$in":`)
+		// OpNotIn uses $nin with the same list or variable forms
+		if exp.Op == qcode.OpNotIn {
+			ctx.WriteString(`{"$nin":`)
+		} else {
+			ctx.WriteString(`{"$in":`)
+		}
 		if exp.Right.ValType == qcode.ValList {
 			// Static list of values
 			ctx.WriteString(`[`)
@@ -3987,15 +3992,6 @@ func (d *MongoDBDialect) renderComparisonValue(ctx Context, exp *qcode.Exp) {
 			d.renderValue(ctx, exp)
 		}
 		ctx.WriteString(`}`)
-	case qcode.OpNotIn:
-		ctx.WriteString(`{"$nin":[`)
-		for i, v := range exp.Right.ListVal {
-			if i > 0 {
-				ctx.WriteString(`,`)
-			}
-			d.renderLiteralValue(ctx, v, exp.Right.ListType)
-		}
-		ctx.WriteString(`]}`)
 	case qcode.OpLike:
 		ctx.WriteString(`{"$regex":"`)
 		// Convert SQL LIKE pattern to regex
```

**File**: `core/internal/psql/in_variable_dialects_test.go` (modified, +19/-0)
```diff
@@ -37,3 +37,22 @@ func TestInVariableRendersTextAndNumberColumns(t *testing.T) {
 		})
 	}
 }
+
+// MongoDB rendered nin with a variable as an empty $nin list, so nin
+// excluded nothing.
+func TestMongoDBNotInVariableUsesTheVariable(t *testing.T) {
+	qc, pc := newDialectCompilers(t, "mongodb")
+	in := compileWith(t, qc, pc, `query { users(where: { email: { in: $v } }) { id } }`)
+	nin := compileWith(t, qc, pc, `query { users(where: { email: { nin: $v } }) { id } }`)
+	if strings.Contains(nin, `"$nin":[]`) {
+		t.Fatalf("nin ignored the variable:\n%s", nin)
+	}
+	wantNin := strings.Replace(in, `"$in":`, `"$nin":`, 1)
+	if nin != wantNin {
+		t.Fatalf("nin should render like in with $nin:\n in: %s\nnin: %s", in, nin)
+	}
+	lit := compileWith(t, qc, pc, `query { users(where: { id: { nin: [1, 2] } }) { id } }`)
+	if !strings.Contains(lit, `"$nin":[1,2]`) {
+		t.Fatalf("nin with a literal list changed:\n%s", lit)
+	}
+}
```

---

### Incident Patch 2: `aebaff03` (2026-09-15)
**Commit Message**: fix(dialect): in and nin with array variables on MySQL and MariaDB text columns

MySQL cast text columns to JSON inside JSON_CONTAINS, which fails for
plain text, and rendered nin without NOT, so nin matched the listed
values. MariaDB passed text columns to JSON_CONTAINS unquoted. Both
dialects now quote text columns with JSON_QUOTE, and MySQL negates nin.

Refs #639

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PgFGXx4S9j2NwHSftynT3k

**File**: `core/internal/dialect/mariadb.go` (modified, +8/-0)
```diff
@@ -1825,7 +1825,15 @@ func (d *MariaDBDialect) renderValPrefix(ctx Context, r InlineChildRenderer, pse
 		} else if ex.Left.ID >= 0 {
 			t = fmt.Sprintf("%s_%d", t, ex.Left.ID)
 		}
+		// Text is not valid JSON, so quote it into a JSON string.
+		quote := isJSONTextColumnType(ex.Left.Col.Type)
+		if quote {
+			ctx.WriteString(`JSON_QUOTE(`)
+		}
 		r.ColWithTable(t, ex.Left.Col.Name)
+		if quote {
+			ctx.WriteString(`)`)
+		}
 
 		ctx.WriteString(`)`)
 		return true
```

**File**: `core/internal/dialect/mysql.go` (modified, +28/-3)
```diff
@@ -395,16 +395,41 @@ func (d *MySQLDialect) RenderValPrefix(ctx Context, ex *qcode.Exp) bool {
 			}
 		}
 
+		if ex.Op == qcode.OpNotIn {
+			ctx.WriteString(`NOT `)
+		}
 		ctx.WriteString(`JSON_CONTAINS(`)
 		ctx.AddParam(Param{Name: ex.Right.Val, Type: ex.Left.Col.Type, IsArray: true})
-		ctx.WriteString(`, CAST(`)
-		ctx.ColWithTable(ex.Left.Col.Table, ex.Left.Col.Name)
-		ctx.WriteString(` AS JSON), '$')`)
+		// Text is not valid JSON, so quote it into a JSON string. Other scalar
+		// types cast to the matching JSON value.
+		if isJSONTextColumnType(ex.Left.Col.Type) {
+			ctx.WriteString(`, JSON_QUOTE(`)
+			ctx.ColWithTable(ex.Left.Col.Table, ex.Left.Col.Name)
+			ctx.WriteString(`), '$')`)
+		} else {
+			ctx.WriteString(`, CAST(`)
+			ctx.ColWithTable(ex.Left.Col.Table, ex.Left.Col.Name)
+			ctx.WriteString(` AS JSON), '$')`)
+		}
 		return true
 	}
 	return false
 }
 
+// isJSONTextColumnType reports whether a MySQL or MariaDB column holds text
+// that must be quoted before JSON_CONTAINS can compare it with a JSON array.
+func isJSONTextColumnType(colType string) bool {
+	t := strings.ToLower(strings.TrimSpace(colType))
+	if i := strings.IndexByte(t, '('); i != -1 {
+		t = t[:i]
+	}
+	switch t {
+	case "enum", "set", "uuid", "string":
+		return true
+	}
+	return strings.Contains(t, "char") || strings.Contains(t, "text")
+}
+
 func (d *MySQLDialect) RenderTsQuery(ctx Context, ti sdata.DBTable, ex *qcode.Exp) {
 	// MySQL FULLTEXT search: For exact phrase matching, use BOOLEAN MODE
 	// NATURAL LANGUAGE MODE matches common words in all rows which gives false positives
```

**File**: `core/internal/psql/in_variable_dialects_test.go` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+package psql_test
+
+import (
+	"strings"
+	"testing"
+)
+
+// A JSON array variable used with in or nin must compare text columns as JSON
+// strings, and nin must negate the match. MySQL once cast text columns to JSON,
+// which fails for plain text, and rendered nin exactly like in.
+func TestInVariableRendersTextAndNumberColumns(t *testing.T) {
+	cases := []struct {
+		db, gql, want string
+	}{
+		{"mysql", `query { users(where: { email: { in: $v } }) { id } }`,
+			"WHERE JSON_CONTAINS(?, JSON_QUOTE(`users`.`email`), '$')"},
+		{"mysql", `query { users(where: { email: { nin: $v } }) { id } }`,
+			"WHERE NOT JSON_CONTAINS(?, JSON_QUOTE(`users`.`email`), '$')"},
+		{"mysql", `query { users(where: { id: { in: $v } }) { id } }`,
+			"WHERE JSON_CONTAINS(?, CAST(`users`.`id` AS JSON), '$')"},
+		{"mysql", `query { users(where: { id: { nin: $v } }) { id } }`,
+			"WHERE NOT JSON_CONTAINS(?, CAST(`users`.`id` AS JSON), '$')"},
+		{"mariadb", `query { users(where: { email: { in: $v } }) { id } }`,
+			"WHERE JSON_CONTAINS(?, JSON_QUOTE(`users_0`.`email`))"},
+		{"mariadb", `query { users(where: { email: { nin: $v } }) { id } }`,
+			"WHERE NOT JSON_CONTAINS(?, JSON_QUOTE(`users_0`.`email`))"},
+		{"mariadb", `query { users(where: { id: { in: $v } }) { id } }`,
+			"WHERE JSON_CONTAINS(?, `users_0`.`id`)"},
+	}
+	for _, tc := range cases {
+		t.Run(tc.db+" "+tc.gql, func(t *testing.T) {
+			qc, pc := newDialectCompilers(t, tc.db)
+			sql := compileWith(t, qc, pc, tc.gql)
+			if !strings.Contains(sql, tc.want) {
+				t.Fatalf("SQL does not contain %q:\n%s", tc.want, sql)
+			}
+		})
+	}
+}
```

**File**: `tests/where_in_text_test.go` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+package tests_test
+
+import (
+	"context"
+	"encoding/json"
+	"fmt"
+
+	"github.com/dosco/graphjin/core/v3"
+)
+
+// Example_queryWithWhereInTextVariable checks in and nin with a JSON array
+// variable on a text column. MySQL and MariaDB compare the column as a JSON
+// string, and nin must exclude the listed values.
+func Example_queryWithWhereInTextVariable() {
+	conf := newConfig(&core.Config{DBType: dbType, DisableAllowList: true})
+	gj, err := core.NewGraphJin(conf, db)
+	if err != nil {
+		panic(err)
+	}
+	defer gj.Close()
+
+	vars := json.RawMessage(`{ "emails": ["user1@test.com", "user3@test.com"] }`)
+	for _, gql := range []string{
+		`query {
+			users(where: { and: [{ email: { in: $emails } }, { id: { lte: 4 } }] }, order_by: { id: asc }) { id }
+		}`,
+		`query {
+			users(where: { and: [{ email: { nin: $emails } }, { id: { lte: 4 } }] }, order_by: { id: asc }) { id }
+		}`,
+	} {
+		res, err := gj.GraphQL(context.Background(), gql, vars, nil)
+		if err != nil {
+			fmt.Println(err)
+			continue
+		}
+		printJSON(res.Data)
+	}
+	// Output:
+	// {"users":[{"id":1},{"id":3}]}
+	// {"users":[{"id":2},{"id":4}]}
+}
```

---

### Incident Patch 3: `3b32e852` (2026-09-15)
**Commit Message**: fix(qcode): reject role filters that compile to nothing

Empty objects and lists inside a role filter were skipped by the
expression compiler, so { or: [{}, {}] } loaded as an OR with no
children and { and: [x, {}] } loaded with a branch removed. Role
filters now fail at config load instead.

Refs #639

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PgFGXx4S9j2NwHSftynT3k

**File**: `core/internal/qcode/qcode.go` (modified, +30/-5)
```diff
@@ -1851,20 +1851,23 @@ func compileFilter(s *sdata.DBSchema, ti sdata.DBTable, filter []string, isJSON
 			return nil, false, err
 		}
 
+		if err := validateFilterNode(node); err != nil {
+			return nil, false, fmt.Errorf("role filter %s: %w", v, err)
+		}
+
 		f, nu, err := co.compileBaseExpNode("", ti, st, node, isJSON)
 		if err != nil {
 			return nil, false, err
 		}
 
+		if f == nil {
+			return nil, false, fmt.Errorf("role filter %s: compiled to no expression", v)
+		}
+
 		if nu {
 			needsUser = true
 		}
 
-		// TODO: Invalid table names in nested where causes fail silently
-		// returning a nil 'f' this needs to be fixed
-
-		// TODO: Invalid where clauses such as missing op (eg. eq) also fail silently
-
 		if fl == nil {
 			if len(filter) == 1 {
 				fl = f
@@ -1879,6 +1882,28 @@ func compileFilter(s *sdata.DBSchema, ti sdata.DBTable, filter []string, isJSON
 	return fl, needsUser, nil
 }
 
+// validateFilterNode rejects empty objects and lists anywhere in a role
+// filter. The expression compiler skips them, so `{ or: [{}, {}] }` would
+// otherwise load as an OR with no children and `{ and: [x, {}] }` would
+// load with a branch silently removed.
+func validateFilterNode(node *graph.Node) error {
+	if node == nil {
+		return errors.New("empty expression")
+	}
+	if (node.Type == graph.NodeObj || node.Type == graph.NodeList) && len(node.Children) == 0 {
+		if node.Name == "" {
+			return errors.New("empty object or list")
+		}
+		return fmt.Errorf("empty object or list for '%s'", node.Name)
+	}
+	for _, child := range node.Children {
+		if err := validateFilterNode(child); err != nil {
+			return err
+		}
+	}
+	return nil
+}
+
 func getArg(args []graph.Arg, name string, validTypes ...graph.ParserType,
 ) (arg graph.Arg, err error) {
 	var ok bool
```

**File**: `core/internal/qcode/role_filter_test.go` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+package qcode_test
+
+import (
+	"testing"
+
+	"github.com/dosco/graphjin/core/v3/internal/qcode"
+)
+
+// A role filter that does not compile must stop the role from loading.
+// Dropping it would remove the row restriction it was written to enforce.
+func TestAddRoleRejectsInvalidQueryFilters(t *testing.T) {
+	cases := []struct {
+		name   string
+		filter string
+	}{
+		{name: "unknown column", filter: `{ no_such_column: { eq: 1 } }`},
+		{name: "unknown nested table", filter: `{ no_such_table: { id: { eq: 1 } } }`},
+		{name: "missing operator", filter: `{ id: { no_such_op: 1 } }`},
+		{name: "empty object", filter: `{}`},
+		{name: "empty and", filter: `{ and: [] }`},
+		{name: "empty or", filter: `{ or: [] }`},
+		{name: "empty nested object", filter: `{ id: {} }`},
+		{name: "or of empty objects", filter: `{ or: [{}, {}] }`},
+		{name: "and with an empty branch", filter: `{ and: [{ id: { eq: 1 } }, {}] }`},
+		{name: "or with an empty branch", filter: `{ or: [{ id: { eq: 1 } }, {}] }`},
+		{name: "empty list value", filter: `{ id: { in: [] } }`},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			qc, err := qcode.NewCompiler(dbs, qcode.Config{})
+			if err != nil {
+				t.Fatal(err)
+			}
+			err = qc.AddRole("user", "public", "products", qcode.TRConfig{
+				Query: qcode.QueryConfig{Filters: []string{tc.filter}},
+			})
+			if err == nil {
+				t.Fatalf("AddRole accepted invalid filter %s", tc.filter)
+			}
+		})
+	}
+}
+
+func TestAddRoleRejectsInvalidWriteFilters(t *testing.T) {
+	bad := []string{`{ no_such_column: { eq: 1 } }`}
+
+	configs := map[string]qcode.TRConfig{
+		"update": {Update: qcode.UpdateConfig{Filters: bad}},
+		"upsert": {Upsert: qcode.UpsertConfig{Filters: bad}},
+		"delete": {Delete: qcode.DeleteConfig{Filters: bad}},
+	}
+	for name, trc := range configs {
+		t.Run(name, func(t *testing.T) {
+			qc, err := qcode.NewCompiler(dbs, qcode.Config{})
+			if err != nil {
+				t.Fatal(err)
+			}
+			if err := qc.AddRole("user", "public", "products", trc); err == nil {
+				t.Fatalf("AddRole accepted invalid %s filter", name)
+			}
+		})
+	}
+}
+
+func TestAddRoleAcceptsValidFilters(t *testing.T) {
+	valid := []string{
+		`{ id: { eq: $user_id } }`,
+		`{ or: [{ price: { gt: 10 } }, { name: { eq: "x" } }] }`,
+		`false`,
+	}
+	for _, filter := range valid {
+		qc, err := qcode.NewCompiler(dbs, qcode.Config{})
+		if err != nil {
+			t.Fatal(err)
+		}
+		if err := qc.AddRole("user", "public", "products", qcode.TRConfig{
+			Query: qcode.QueryConfig{Filters: []string{filter}},
+		}); err != nil {
+			t.Fatalf("AddRole rejected valid filter %s: %v", filter, err)
+		}
+		if _, err := qc.Compile([]byte(`query { products { id } }`), nil, "user", ""); err != nil {
+			t.Fatalf("compile with filter %s: %v", filter, err)
+		}
+	}
+}
```

---

### Incident Patch 4: `139ec4f6` (2026-09-11)
**Commit Message**: Merge pull request #638 from dosco/fix/openapi-request-credentials

fix(openapi): support isolated per-request upstream credentials

**File**: `core/openapi/auth.go` (modified, +19/-6)
```diff
@@ -8,15 +8,16 @@ import (
 	"strings"
 	"sync"
 	"time"
+
+	"golang.org/x/net/http/httpguts"
 )
 
 // AuthProvider attaches authentication to outgoing requests to an upstream
 // API. Implementations are constructed once per spec at boot time and
 // reused across every operation against that spec.
 //
 // Apply mutates req in place. The hdrIn parameter can carry headers from a
-// host application's incoming request. GraphJin's built-in GraphQL bridge does
-// not currently populate it, so pass-through auth there remains unavailable.
+// host application's incoming request, including GraphQL and HTTP MCP calls.
 //
 // OnUnauthorized is invoked by the resolver after a 401 response so
 // providers that cache tokens can invalidate them and the resolver can
@@ -36,6 +37,18 @@ type AuthProvider interface {
 // requests (token exchange, oauth2 client_credentials). httpClient must
 // not be nil for those schemes.
 func NewAuthProvider(cfg AuthConfig, httpClient *http.Client) (AuthProvider, error) {
+	if tfr := cfg.TokenFromRequest; tfr != nil {
+		scheme := strings.ToLower(strings.TrimSpace(cfg.Scheme))
+		if scheme != "bearer" && scheme != "api_key" && scheme != "apikey" {
+			return nil, fmt.Errorf("openapi: token_from_request requires bearer or api_key auth")
+		}
+		if cfg.Token != "" || cfg.KeyValue != "" {
+			return nil, fmt.Errorf("openapi: token_from_request cannot be combined with static credentials")
+		}
+		if tfr.Query != "" || !httpguts.ValidHeaderFieldName(tfr.Header) {
+			return nil, fmt.Errorf("openapi: token_from_request requires a valid header name; query credentials are not supported")
+		}
+	}
 	switch strings.ToLower(strings.TrimSpace(cfg.Scheme)) {
 	case "", "none":
 		return noopAuth{}, nil
@@ -166,11 +179,11 @@ func resolveToken(cfg AuthConfig, hdrIn http.Header) (string, error) {
 // query string.
 func passThroughToken(tfr TokenFromRequest, hdrIn http.Header) (string, error) {
 	if tfr.Header != "" {
-		v := hdrIn.Get(tfr.Header)
-		if v == "" {
-			return "", fmt.Errorf("openapi: pass-through header %q absent on incoming request", tfr.Header)
+		values := hdrIn.Values(tfr.Header)
+		if len(values) != 1 || strings.TrimSpace(values[0]) == "" || !httpguts.ValidHeaderFieldValue(values[0]) {
+			return "", fmt.Errorf("openapi: pass-through header %q must contain exactly one non-empty credential", tfr.Header)
 		}
-		return v, nil
+		return values[0], nil
 	}
 	return "", fmt.Errorf("openapi: token_from_request requires header field (query not yet supported)")
 }
```

**File**: `core/openapi/auth_test.go` (modified, +41/-0)
```diff
@@ -292,3 +292,44 @@ func TestCachedTokenExpiry(t *testing.T) {
 		t.Errorf("fetchCalls = %d after invalidate, want 3", fetchCalls)
 	}
 }
+
+func TestRequestCredentialConfigAndHeaders(t *testing.T) {
+	for _, cfg := range []AuthConfig{
+		{Scheme: "bearer", Token: "shared", TokenFromRequest: &TokenFromRequest{Header: "X-Token"}},
+		{Scheme: "api_key", KeyValue: "shared", TokenFromRequest: &TokenFromRequest{Header: "X-Token"}},
+		{Scheme: "basic", TokenFromRequest: &TokenFromRequest{Header: "X-Token"}},
+		{Scheme: "bearer", TokenFromRequest: &TokenFromRequest{Query: "token"}},
+		{Scheme: "bearer", TokenFromRequest: &TokenFromRequest{Header: "X Bad"}},
+	} {
+		if _, err := NewAuthProvider(cfg, nil); err == nil {
+			t.Fatal("unsafe request credential configuration accepted")
+		}
+	}
+	for _, scheme := range []string{"bearer", "api_key"} {
+		auth, err := NewAuthProvider(AuthConfig{Scheme: scheme, KeyName: "X-API-Key", TokenFromRequest: &TokenFromRequest{Header: "X-Token"}}, nil)
+		if err != nil {
+			t.Fatal(err)
+		}
+		for _, values := range [][]string{nil, {""}, {"  "}, {"a", "b"}, {"a\r\nb"}} {
+			if err := auth.Apply(context.Background(), newTestRequest(t, "https://example.com"), http.Header{"X-Token": values}); err == nil {
+				t.Fatal("invalid request credential accepted")
+			}
+		}
+	}
+}
+
+func TestRequestCredentialsCopiedAndExpireWithRequest(t *testing.T) {
+	parent, cancel := context.WithCancel(context.Background())
+	defer cancel()
+	headers := http.Header{"X-Token": {"alice"}}
+	ctx := WithRequestHeaders(parent, headers)
+	headers.Set("X-Token", "bob")
+	incoming, err := incomingRequestHeaders(ctx)
+	if err != nil || incoming.Get("X-Token") != "alice" {
+		t.Fatal("credential snapshot was mutated")
+	}
+	cancel()
+	if _, err := incomingRequestHeaders(context.WithoutCancel(ctx)); err == nil {
+		t.Fatal("detached context retained usable credentials after request completed")
+	}
+}
```

**File**: `core/openapi/caller.go` (modified, +9/-2)
```diff
@@ -35,7 +35,7 @@ type Caller struct {
 // template's {placeholders}; QueryValues and HeaderValues populate
 // non-path parameters (query strings and HTTP headers respectively);
 // IncomingHeaders is an optional host-supplied inbound header set used only
-// for pass-through auth. The built-in GraphQL bridge currently leaves it nil.
+// for pass-through auth. When nil, trusted request context headers are used.
 type CallParams struct {
 	PathValues      map[string]string
 	QueryValues     map[string]string
@@ -203,7 +203,14 @@ func (c *Caller) doOnce(ctx context.Context, p CallParams) (CallResult, error) {
 	}
 	req.Header.Set("X-Request-ID", p.RequestID)
 
-	if err := c.auth.Apply(ctx, req, p.IncomingHeaders); err != nil {
+	incoming := p.IncomingHeaders
+	if incoming == nil && c.UsesRequestCredentials() {
+		incoming, err = incomingRequestHeaders(ctx)
+		if err != nil {
+			return result, err
+		}
+	}
+	if err := c.auth.Apply(ctx, req, incoming); err != nil {
 		return result, fmt.Errorf("openapi: auth apply: %w", err)
 	}
 
```

**File**: `core/openapi/config.go` (modified, +4/-6)
```diff
@@ -72,9 +72,8 @@ type AuthConfig struct {
 	// Scheme: bearer | basic | api_key | oauth2_client_credentials | token_exchange
 	Scheme string `mapstructure:"scheme" json:"scheme" yaml:"scheme"`
 
-	// Bearer: a static or env-supplied token. TokenFromRequest is reserved for
-	// hosts that explicitly bridge inbound headers; the built-in GraphQL bridge
-	// does not currently forward them.
+	// Bearer: use either a static/env-supplied token or TokenFromRequest.
+	// GraphQL and HTTP MCP forward only explicitly configured credential headers.
 	Token            string            `mapstructure:"token" json:"token" yaml:"token" jsonschema_extras:"x-graphjin-sensitive=secret"`
 	TokenFromRequest *TokenFromRequest `mapstructure:"token_from_request" json:"token_from_request" yaml:"token_from_request"`
 
@@ -109,9 +108,8 @@ type AuthConfig struct {
 	CacheTTL string `mapstructure:"cache_ttl" json:"cache_ttl" yaml:"cache_ttl"`
 }
 
-// TokenFromRequest describes credentials carried on an incoming request. The
-// auth provider supports this shape, but the built-in GraphQL bridge does not
-// currently populate inbound headers, so static credentials are required there.
+// TokenFromRequest selects a required incoming credential header. It cannot
+// be combined with static credentials. Query-string credentials are unsupported.
 type TokenFromRequest struct {
 	Header string `mapstructure:"header" json:"header" yaml:"header"`
 	Query  string `mapstructure:"query" json:"query" yaml:"query"`
```

**File**: `core/openapi/request_headers.go` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+package openapi
+
+import (
+	"context"
+	"net/http"
+)
+
+type requestHeadersKey struct{}
+type requestHeaders struct {
+	request context.Context
+	headers http.Header
+}
+
+// WithRequestHeaders supplies trusted, explicitly selected upstream credential
+// headers to OpenAPI calls. They are copied and never stored on a shared caller.
+// The original request must remain active, including when a child detaches its
+// cancellation. Hosts must not populate these headers from GraphQL arguments.
+func WithRequestHeaders(ctx context.Context, headers http.Header) context.Context {
+	return context.WithValue(ctx, requestHeadersKey{}, requestHeaders{ctx, headers.Clone()})
+}
+
+func incomingRequestHeaders(ctx context.Context) (http.Header, error) {
+	value, ok := ctx.Value(requestHeadersKey{}).(requestHeaders)
+	if !ok {
+		return nil, nil
+	}
+	if err := value.request.Err(); err != nil {
+		return nil, err
+	}
+	return value.headers, nil
+}
+
+// UsesRequestCredentials reports whether calls require a personal request token.
+func (c *Caller) UsesRequestCredentials() bool {
+	switch auth := c.auth.(type) {
+	case *bearerAuth:
+		return auth.cfg.TokenFromRequest != nil
+	case *apiKeyAuth:
+		return auth.cfg.TokenFromRequest != nil
+	}
+	return false
+}
```

---

### Incident Patch 5: `1e376f50` (2026-09-11)
**Commit Message**: fix(openapi): isolate request-scoped upstream credentials

**File**: `core/openapi/auth.go` (modified, +19/-6)
```diff
@@ -8,15 +8,16 @@ import (
 	"strings"
 	"sync"
 	"time"
+
+	"golang.org/x/net/http/httpguts"
 )
 
 // AuthProvider attaches authentication to outgoing requests to an upstream
 // API. Implementations are constructed once per spec at boot time and
 // reused across every operation against that spec.
 //
 // Apply mutates req in place. The hdrIn parameter can carry headers from a
-// host application's incoming request. GraphJin's built-in GraphQL bridge does
-// not currently populate it, so pass-through auth there remains unavailable.
+// host application's incoming request, including GraphQL and HTTP MCP calls.
 //
 // OnUnauthorized is invoked by the resolver after a 401 response so
 // providers that cache tokens can invalidate them and the resolver can
@@ -36,6 +37,18 @@ type AuthProvider interface {
 // requests (token exchange, oauth2 client_credentials). httpClient must
 // not be nil for those schemes.
 func NewAuthProvider(cfg AuthConfig, httpClient *http.Client) (AuthProvider, error) {
+	if tfr := cfg.TokenFromRequest; tfr != nil {
+		scheme := strings.ToLower(strings.TrimSpace(cfg.Scheme))
+		if scheme != "bearer" && scheme != "api_key" && scheme != "apikey" {
+			return nil, fmt.Errorf("openapi: token_from_request requires bearer or api_key auth")
+		}
+		if cfg.Token != "" || cfg.KeyValue != "" {
+			return nil, fmt.Errorf("openapi: token_from_request cannot be combined with static credentials")
+		}
+		if tfr.Query != "" || !httpguts.ValidHeaderFieldName(tfr.Header) {
+			return nil, fmt.Errorf("openapi: token_from_request requires a valid header name; query credentials are not supported")
+		}
+	}
 	switch strings.ToLower(strings.TrimSpace(cfg.Scheme)) {
 	case "", "none":
 		return noopAuth{}, nil
@@ -166,11 +179,11 @@ func resolveToken(cfg AuthConfig, hdrIn http.Header) (string, error) {
 // query string.
 func passThroughToken(tfr TokenFromRequest, hdrIn http.Header) (string, error) {
 	if tfr.Header != "" {
-		v := hdrIn.Get(tfr.Header)
-		if v == "" {
-			return "", fmt.Errorf("openapi: pass-through header %q absent on incoming request", tfr.Header)
+		values := hdrIn.Values(tfr.Header)
+		if len(values) != 1 || strings.TrimSpace(values[0]) == "" || !httpguts.ValidHeaderFieldValue(values[0]) {
+			return "", fmt.Errorf("openapi: pass-through header %q must contain exactly one non-empty credential", tfr.Header)
 		}
-		return v, nil
+		return values[0], nil
 	}
 	return "", fmt.Errorf("openapi: token_from_request requires header field (query not yet supported)")
 }
```

**File**: `core/openapi/auth_test.go` (modified, +41/-0)
```diff
@@ -292,3 +292,44 @@ func TestCachedTokenExpiry(t *testing.T) {
 		t.Errorf("fetchCalls = %d after invalidate, want 3", fetchCalls)
 	}
 }
+
+func TestRequestCredentialConfigAndHeaders(t *testing.T) {
+	for _, cfg := range []AuthConfig{
+		{Scheme: "bearer", Token: "shared", TokenFromRequest: &TokenFromRequest{Header: "X-Token"}},
+		{Scheme: "api_key", KeyValue: "shared", TokenFromRequest: &TokenFromRequest{Header: "X-Token"}},
+		{Scheme: "basic", TokenFromRequest: &TokenFromRequest{Header: "X-Token"}},
+		{Scheme: "bearer", TokenFromRequest: &TokenFromRequest{Query: "token"}},
+		{Scheme: "bearer", TokenFromRequest: &TokenFromRequest{Header: "X Bad"}},
+	} {
+		if _, err := NewAuthProvider(cfg, nil); err == nil {
+			t.Fatal("unsafe request credential configuration accepted")
+		}
+	}
+	for _, scheme := range []string{"bearer", "api_key"} {
+		auth, err := NewAuthProvider(AuthConfig{Scheme: scheme, KeyName: "X-API-Key", TokenFromRequest: &TokenFromRequest{Header: "X-Token"}}, nil)
+		if err != nil {
+			t.Fatal(err)
+		}
+		for _, values := range [][]string{nil, {""}, {"  "}, {"a", "b"}, {"a\r\nb"}} {
+			if err := auth.Apply(context.Background(), newTestRequest(t, "https://example.com"), http.Header{"X-Token": values}); err == nil {
+				t.Fatal("invalid request credential accepted")
+			}
+		}
+	}
+}
+
+func TestRequestCredentialsCopiedAndExpireWithRequest(t *testing.T) {
+	parent, cancel := context.WithCancel(context.Background())
+	defer cancel()
+	headers := http.Header{"X-Token": {"alice"}}
+	ctx := WithRequestHeaders(parent, headers)
+	headers.Set("X-Token", "bob")
+	incoming, err := incomingRequestHeaders(ctx)
+	if err != nil || incoming.Get("X-Token") != "alice" {
+		t.Fatal("credential snapshot was mutated")
+	}
+	cancel()
+	if _, err := incomingRequestHeaders(context.WithoutCancel(ctx)); err == nil {
+		t.Fatal("detached context retained usable credentials after request completed")
+	}
+}
```

**File**: `core/openapi/caller.go` (modified, +9/-2)
```diff
@@ -35,7 +35,7 @@ type Caller struct {
 // template's {placeholders}; QueryValues and HeaderValues populate
 // non-path parameters (query strings and HTTP headers respectively);
 // IncomingHeaders is an optional host-supplied inbound header set used only
-// for pass-through auth. The built-in GraphQL bridge currently leaves it nil.
+// for pass-through auth. When nil, trusted request context headers are used.
 type CallParams struct {
 	PathValues      map[string]string
 	QueryValues     map[string]string
@@ -203,7 +203,14 @@ func (c *Caller) doOnce(ctx context.Context, p CallParams) (CallResult, error) {
 	}
 	req.Header.Set("X-Request-ID", p.RequestID)
 
-	if err := c.auth.Apply(ctx, req, p.IncomingHeaders); err != nil {
+	incoming := p.IncomingHeaders
+	if incoming == nil && c.UsesRequestCredentials() {
+		incoming, err = incomingRequestHeaders(ctx)
+		if err != nil {
+			return result, err
+		}
+	}
+	if err := c.auth.Apply(ctx, req, incoming); err != nil {
 		return result, fmt.Errorf("openapi: auth apply: %w", err)
 	}
 
```

**File**: `core/openapi/config.go` (modified, +4/-6)
```diff
@@ -72,9 +72,8 @@ type AuthConfig struct {
 	// Scheme: bearer | basic | api_key | oauth2_client_credentials | token_exchange
 	Scheme string `mapstructure:"scheme" json:"scheme" yaml:"scheme"`
 
-	// Bearer: a static or env-supplied token. TokenFromRequest is reserved for
-	// hosts that explicitly bridge inbound headers; the built-in GraphQL bridge
-	// does not currently forward them.
+	// Bearer: use either a static/env-supplied token or TokenFromRequest.
+	// GraphQL and HTTP MCP forward only explicitly configured credential headers.
 	Token            string            `mapstructure:"token" json:"token" yaml:"token" jsonschema_extras:"x-graphjin-sensitive=secret"`
 	TokenFromRequest *TokenFromRequest `mapstructure:"token_from_request" json:"token_from_request" yaml:"token_from_request"`
 
@@ -109,9 +108,8 @@ type AuthConfig struct {
 	CacheTTL string `mapstructure:"cache_ttl" json:"cache_ttl" yaml:"cache_ttl"`
 }
 
-// TokenFromRequest describes credentials carried on an incoming request. The
-// auth provider supports this shape, but the built-in GraphQL bridge does not
-// currently populate inbound headers, so static credentials are required there.
+// TokenFromRequest selects a required incoming credential header. It cannot
+// be combined with static credentials. Query-string credentials are unsupported.
 type TokenFromRequest struct {
 	Header string `mapstructure:"header" json:"header" yaml:"header"`
 	Query  string `mapstructure:"query" json:"query" yaml:"query"`
```

**File**: `core/openapi/request_headers.go` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+package openapi
+
+import (
+	"context"
+	"net/http"
+)
+
+type requestHeadersKey struct{}
+type requestHeaders struct {
+	request context.Context
+	headers http.Header
+}
+
+// WithRequestHeaders supplies trusted, explicitly selected upstream credential
+// headers to OpenAPI calls. They are copied and never stored on a shared caller.
+// The original request must remain active, including when a child detaches its
+// cancellation. Hosts must not populate these headers from GraphQL arguments.
+func WithRequestHeaders(ctx context.Context, headers http.Header) context.Context {
+	return context.WithValue(ctx, requestHeadersKey{}, requestHeaders{ctx, headers.Clone()})
+}
+
+func incomingRequestHeaders(ctx context.Context) (http.Header, error) {
+	value, ok := ctx.Value(requestHeadersKey{}).(requestHeaders)
+	if !ok {
+		return nil, nil
+	}
+	if err := value.request.Err(); err != nil {
+		return nil, err
+	}
+	return value.headers, nil
+}
+
+// UsesRequestCredentials reports whether calls require a personal request token.
+func (c *Caller) UsesRequestCredentials() bool {
+	switch auth := c.auth.(type) {
+	case *bearerAuth:
+		return auth.cfg.TokenFromRequest != nil
+	case *apiKeyAuth:
+		return auth.cfg.TokenFromRequest != nil
+	}
+	return false
+}
```

---

### Incident Patch 6: `058bb229` (2026-09-11)
**Commit Message**: Merge pull request #637 from dosco/fix/schema-refresh-identifiers

fix: scope physical identifiers and detect schema changes

**File**: `core/internal/dialect/bigquery.go` (modified, +5/-5)
```diff
@@ -22,14 +22,14 @@ func (d *BigQueryDialect) Name() string {
 }
 
 func (d *BigQueryDialect) QuoteIdentifier(s string) string {
-	if d.NameMap != nil {
-		if orig, ok := d.NameMap[s]; ok {
-			s = orig
-		}
-	}
 	return "`" + strings.ReplaceAll(s, "`", "\\`") + "`"
 }
 
+func (d *BigQueryDialect) QuoteColumn(schema, table, column string) (string, error) {
+	name, err := d.columnName(schema, table, column)
+	return d.QuoteIdentifier(name), err
+}
+
 func (d *BigQueryDialect) RenderJSONRoot(ctx Context, sel *qcode.Select) {
 	ctx.WriteString(`SELECT TO_JSON_STRING(JSON_OBJECT(`)
 }
```

**File**: `core/internal/dialect/dialect.go` (modified, +4/-4)
```diff
@@ -199,17 +199,17 @@ type Dialect interface {
 
 // NameMapSetter is an optional interface that dialects can implement
 // to receive a mapping of normalized→original identifier names.
-// This is used by MSSQL to preserve PascalCase identifiers in generated SQL.
+// SQL Server and the warehouse dialects use it to preserve physical spelling.
 type NameMapSetter interface {
 	SetNameMap(tables []sdata.DBTable)
 }
 
 // ScopedColumnQuoter is implemented by dialects whose normalized GraphQL
 // column names are not sufficient to recover a physical identifier globally.
-// SQL Server schemas can use multiple spellings such as FlagValue and
-// Flag_Value across different tables, so column lookup must include the table.
+// Different schemas and tables may use different physical spellings for the
+// same normalized column. Generated aliases must use QuoteIdentifier instead.
 type ScopedColumnQuoter interface {
-	QuoteColumn(table, column string) string
+	QuoteColumn(schema, table, column string) (string, error)
 }
 
 // FullQueryCompiler is an optional interface that dialects can implement
```

**File**: `core/internal/dialect/identifiers.go` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+package dialect
+
+import (
+	"fmt"
+	"strconv"
+	"strings"
+
+	"github.com/dosco/graphjin/core/v3/internal/sdata"
+)
+
+// identifierNames keeps physical names scoped to their owning schema and table.
+// Aliases and generated SQL names must never pass through this mapping.
+type identifierNames struct {
+	tables      map[string]sdata.DBTable
+	columns     map[string]map[string]string
+	schemas     map[string]string
+	unqualified map[string]string
+}
+
+func (n *identifierNames) SetNameMap(tables []sdata.DBTable) {
+	n.tables = make(map[string]sdata.DBTable, len(tables))
+	n.columns = make(map[string]map[string]string, len(tables))
+	n.schemas = make(map[string]string)
+	n.unqualified = make(map[string]string)
+	for _, t := range tables {
+		key := t.Schema + "\x00" + t.Name
+		n.tables[key] = t
+		n.columns[key] = make(map[string]string, len(t.Columns))
+		for _, c := range t.Columns {
+			n.columns[key][c.Name] = c.SQLName()
+		}
+		if old, ok := n.unqualified[t.Name]; ok && old != key {
+			n.unqualified[t.Name] = "" // ambiguous: the caller must supply the schema
+		} else if !ok {
+			n.unqualified[t.Name] = key
+		}
+		n.schemas[t.Schema] = t.SQLSchema()
+	}
+}
+
+func (n *identifierNames) columnName(schema, table, column string) (string, error) {
+	key := schema + "\x00" + table
+	if schema == "" {
+		var ok bool
+		key, ok = n.unqualified[table]
+		if !ok {
+			// Compiler-generated aliases append a select ID to the table name.
+			if i := strings.LastIndexByte(table, '_'); i > 0 {
+				if _, err := strconv.Atoi(table[i+1:]); err == nil {
+					table = table[:i]
+					key, ok = n.unqualified[table]
+				}
+			}
+		}
+		if ok && key == "" {
+			return "", fmt.Errorf("ambiguous physical column %s.%s: schema is required", table, column)
+		}
+	}
+	if name, ok := n.columns[key][column]; ok {
+		return name, nil
+	}
+	// Derived fields and CTEs are already SQL identifiers, not physical columns.
+	return column, nil
+}
+
+func (n *identifierNames) tableNames(schema, table string) (string, string) {
+	if t, ok := n.tables[schema+"\x00"+table]; ok {
+		return t.SQLSchema(), t.SQLName()
+	}
+	if original, ok := n.schemas[schema]; ok {
+		schema = original
+	}
+	return schema, table
+}
```

**File**: `core/internal/dialect/identifiers_test.go` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+package dialect
+
+import (
+	"testing"
+
+	"github.com/dosco/graphjin/core/v3/internal/sdata"
+)
+
+func TestIdentifierNamesAreScopedAndAliasesAreLiteral(t *testing.T) {
+	for _, d := range []Dialect{&SnowflakeDialect{}, &BigQueryDialect{}, &RedshiftDialect{}, &MSSQLDialect{}} {
+		t.Run(d.Name(), func(t *testing.T) {
+			tables := []sdata.DBTable{
+				{Schema: "prod", OrigSchema: "Prod", Name: "account", OrigName: "Account", Columns: []sdata.DBColumn{{Name: "id", OrigName: "Id"}, {Name: "name", OrigName: "Name"}}},
+				{Schema: "analytics", OrigSchema: "analytics", Name: "account", OrigName: "account", Columns: []sdata.DBColumn{{Name: "id", OrigName: "id"}, {Name: "name", OrigName: "name"}}},
+				{Schema: "prod", Name: "account_0", Columns: []sdata.DBColumn{{Name: "id", OrigName: "OtherID"}}},
+				{Schema: "warehouse", OrigSchema: "WAREHOUSE", Name: "account", OrigName: "ACCOUNT", Columns: []sdata.DBColumn{{Name: "id", OrigName: "ID"}, {Name: "name", OrigName: "NAME"}}},
+			}
+			setter := d.(NameMapSetter)
+			quoter := d.(ScopedColumnQuoter)
+			for _, reverse := range []bool{false, true} {
+				if reverse {
+					tables[0], tables[2] = tables[2], tables[0]
+				}
+				setter.SetNameMap(tables)
+				for _, tc := range []struct{ schema, table, name, want string }{
+					{"prod", "account", "id", "Id"}, {"analytics", "account", "id", "id"},
+					{"prod", "account", "name", "Name"}, {"analytics", "account", "name", "name"},
+					{"warehouse", "account", "id", "ID"}, {"warehouse", "account", "name", "NAME"},
+					{"", "account_0", "id", "OtherID"}, {"prod", "account", "sum_id", "sum_id"},
+					{"", "__cur", "id", "id"},
+				} {
+					got, err := quoter.QuoteColumn(tc.schema, tc.table, tc.name)
+					if err != nil || got != d.QuoteIdentifier(tc.want) {
+						t.Fatalf("%+v: got %s, %v", tc, got, err)
+					}
+				}
+				if _, err := quoter.QuoteColumn("", "account", "id"); err == nil {
+					t.Fatal("ambiguous table must require schema")
+				}
+				// A field alias named id must not acquire another table's Id spelling.
+				want := `"id"`
+				if d.Name() == "bigquery" {
+					want = "`id`"
+				}
+				if d.Name() == "mssql" {
+					want = "[id]"
+				}
+				if got := d.QuoteIdentifier("id"); got != want {
+					t.Fatalf("alias renamed: %s", got)
+				}
+			}
+			setter.SetNameMap(nil)
+			got, err := quoter.QuoteColumn("prod", "account", "id")
+			if err != nil || got != d.QuoteIdentifier("id") {
+				t.Fatal("reload retained removed identifiers")
+			}
+		})
+	}
+}
```

**File**: `core/internal/dialect/mssql.go` (modified, +56/-119)
```diff
@@ -2,7 +2,6 @@ package dialect
 
 import (
 	"fmt"
-	"strconv"
 	"strings"
 
 	"github.com/dosco/graphjin/core/v3/internal/graph"
@@ -82,80 +81,20 @@ import (
 type MSSQLDialect struct {
 	DBVersion       int
 	EnableCamelcase bool
-	NameMap         map[string]string            // normalized→original identifier mapping
-	ColumnNameMap   map[string]map[string]string // normalized table→column→original column
+	identifierNames
 }
 
 func (d *MSSQLDialect) Name() string {
 	return "mssql"
 }
 
 func (d *MSSQLDialect) QuoteIdentifier(s string) string {
-	if d.NameMap != nil {
-		if orig, ok := d.NameMap[s]; ok {
-			return "[" + orig + "]"
-		}
-	}
-	return "[" + s + "]"
+	return "[" + strings.ReplaceAll(s, "]", "]]") + "]"
 }
 
-// QuoteColumn resolves a normalized GraphQL column name within its table.
-// A global normalized→original map is insufficient because distinct physical
-// spellings such as FlagValue and Flag_Value both normalize to flag_value.
-func (d *MSSQLDialect) QuoteColumn(table, column string) string {
-	lookupTable := table
-	if _, ok := d.ColumnNameMap[lookupTable]; !ok {
-		if split := strings.LastIndexByte(lookupTable, '_'); split > 0 {
-			if _, err := strconv.Atoi(lookupTable[split+1:]); err == nil {
-				lookupTable = lookupTable[:split]
-			}
-		}
-	}
-	if columns, ok := d.ColumnNameMap[lookupTable]; ok {
-		if original, ok := columns[column]; ok {
-			return "[" + original + "]"
-		}
-	}
-	return d.QuoteIdentifier(column)
-}
-
-// SetNameMap builds a normalized→original name mapping from discovered tables.
-func (d *MSSQLDialect) SetNameMap(tables []sdata.DBTable) {
-	d.NameMap = make(map[string]string)
-	d.ColumnNameMap = make(map[string]map[string]string)
-	setScoped := func(table, normalized, original string) {
-		if table == "" || normalized == "" || original == "" {
-			return
-		}
-		if d.ColumnNameMap[table] == nil {
-			d.ColumnNameMap[table] = make(map[string]string)
-		}
-		d.ColumnNameMap[table][normalized] = original
-	}
-	for _, t := range tables {
-		if t.OrigName != "" && t.OrigName != t.Name {
-			d.NameMap[t.Name] = t.OrigName
-		}
-		if t.OrigSchema != "" && t.OrigSchema != t.Schema {
-			d.NameMap[t.Schema] = t.OrigSchema
-		}
-		for _, c := range t.Columns {
-			setScoped(t.Name, c.Name, c.OrigName)
-			setScoped(c.FKeyTable, c.FKeyCol, c.OrigFKeyCol)
-			if c.OrigName != "" && c.OrigName != c.Name {
-				d.NameMap[c.Name] = c.OrigName
-			}
-			if c.OrigFKeyCol != "" && c.OrigFKeyCol != c.FKeyCol {
-				d.NameMap[c.FKeyCol] = c.OrigFKeyCol
-			}
-			if c.OrigFKeyTable != "" && c.OrigFKeyTable != c.FKeyTable {
-				d.NameMap[c.FKeyTable] = c.OrigFKeyTable
-			}
-			if c.OrigFKeySchema != "" && c.OrigFKeySchema != c.FKeySchema {
-				d.NameMap[c.FKeySchema] = c.OrigFKeySchema
-			}
-		}
-	}
+func (d *MSSQLDialect) QuoteColumn(schema, table, column string) (string, error) {
+	name, err := d.columnName(schema, table, column)
+	return d.QuoteIdentifier(name), err
 }
 
 // BindVar returns the parameter placeholder for MSSQL.
@@ -774,7 +713,7 @@ func (d *MSSQLDialect) RenderTsQuery(ctx Context, ti sdata.DBTable, ex *qcode.Ex
 			if i != 0 {
 				ctx.WriteString(`, `)
 			}
-			ctx.Quote(col.Name)
+			ctx.Quote(col.SQLName())
 		}
 		ctx.WriteString(`), `)
 		ctx.AddParam(Param{Name: ex.Right.Val, Type: "text"})
@@ -910,7 +849,8 @@ func (d *MSSQLDialect) RenderJSONRootField(ctx Context, key string, val func())
 }
 
 func (d *MSSQLDialect) RenderTableName(ctx Context, sel *qcode.Select, schema, table string) {
-	if schema != "" && schema != "dbo" {
+	schema, table = d.tableNames(schema, table)
+	if schema != "" {
 		ctx.Quote(schema)
 		ctx.WriteString(`.`)
 	}
@@ -1282,8 +1222,8 @@ func (d *MSSQLDialect) renderRecursiveInlineChild(ctx Context, r InlineChildRend
 	}
 
 	// 4. Get column names
-	pkCol := sel.Ti.PrimaryCol.Name
-	fkCol := sel.Rel.Left.Col.Name // e.g., reply_to_id
+	pkCol := sel.Ti.PrimaryCol.SQLName()
+	fkCol := sel.Rel.Left.Col.SQLName() // e.g., reply_to_id
 
 	// 5. Rend
```

---

### Incident Patch 7: `6c7711dd` (2026-09-11)
**Commit Message**: fix: scope physical identifiers and detect schema changes

**File**: `core/internal/dialect/bigquery.go` (modified, +5/-5)
```diff
@@ -22,14 +22,14 @@ func (d *BigQueryDialect) Name() string {
 }
 
 func (d *BigQueryDialect) QuoteIdentifier(s string) string {
-	if d.NameMap != nil {
-		if orig, ok := d.NameMap[s]; ok {
-			s = orig
-		}
-	}
 	return "`" + strings.ReplaceAll(s, "`", "\\`") + "`"
 }
 
+func (d *BigQueryDialect) QuoteColumn(schema, table, column string) (string, error) {
+	name, err := d.columnName(schema, table, column)
+	return d.QuoteIdentifier(name), err
+}
+
 func (d *BigQueryDialect) RenderJSONRoot(ctx Context, sel *qcode.Select) {
 	ctx.WriteString(`SELECT TO_JSON_STRING(JSON_OBJECT(`)
 }
```

**File**: `core/internal/dialect/dialect.go` (modified, +4/-4)
```diff
@@ -199,17 +199,17 @@ type Dialect interface {
 
 // NameMapSetter is an optional interface that dialects can implement
 // to receive a mapping of normalized→original identifier names.
-// This is used by MSSQL to preserve PascalCase identifiers in generated SQL.
+// SQL Server and the warehouse dialects use it to preserve physical spelling.
 type NameMapSetter interface {
 	SetNameMap(tables []sdata.DBTable)
 }
 
 // ScopedColumnQuoter is implemented by dialects whose normalized GraphQL
 // column names are not sufficient to recover a physical identifier globally.
-// SQL Server schemas can use multiple spellings such as FlagValue and
-// Flag_Value across different tables, so column lookup must include the table.
+// Different schemas and tables may use different physical spellings for the
+// same normalized column. Generated aliases must use QuoteIdentifier instead.
 type ScopedColumnQuoter interface {
-	QuoteColumn(table, column string) string
+	QuoteColumn(schema, table, column string) (string, error)
 }
 
 // FullQueryCompiler is an optional interface that dialects can implement
```

**File**: `core/internal/dialect/identifiers.go` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+package dialect
+
+import (
+	"fmt"
+	"strconv"
+	"strings"
+
+	"github.com/dosco/graphjin/core/v3/internal/sdata"
+)
+
+// identifierNames keeps physical names scoped to their owning schema and table.
+// Aliases and generated SQL names must never pass through this mapping.
+type identifierNames struct {
+	tables      map[string]sdata.DBTable
+	columns     map[string]map[string]string
+	schemas     map[string]string
+	unqualified map[string]string
+}
+
+func (n *identifierNames) SetNameMap(tables []sdata.DBTable) {
+	n.tables = make(map[string]sdata.DBTable, len(tables))
+	n.columns = make(map[string]map[string]string, len(tables))
+	n.schemas = make(map[string]string)
+	n.unqualified = make(map[string]string)
+	for _, t := range tables {
+		key := t.Schema + "\x00" + t.Name
+		n.tables[key] = t
+		n.columns[key] = make(map[string]string, len(t.Columns))
+		for _, c := range t.Columns {
+			n.columns[key][c.Name] = c.SQLName()
+		}
+		if old, ok := n.unqualified[t.Name]; ok && old != key {
+			n.unqualified[t.Name] = "" // ambiguous: the caller must supply the schema
+		} else if !ok {
+			n.unqualified[t.Name] = key
+		}
+		n.schemas[t.Schema] = t.SQLSchema()
+	}
+}
+
+func (n *identifierNames) columnName(schema, table, column string) (string, error) {
+	key := schema + "\x00" + table
+	if schema == "" {
+		var ok bool
+		key, ok = n.unqualified[table]
+		if !ok {
+			// Compiler-generated aliases append a select ID to the table name.
+			if i := strings.LastIndexByte(table, '_'); i > 0 {
+				if _, err := strconv.Atoi(table[i+1:]); err == nil {
+					table = table[:i]
+					key, ok = n.unqualified[table]
+				}
+			}
+		}
+		if ok && key == "" {
+			return "", fmt.Errorf("ambiguous physical column %s.%s: schema is required", table, column)
+		}
+	}
+	if name, ok := n.columns[key][column]; ok {
+		return name, nil
+	}
+	// Derived fields and CTEs are already SQL identifiers, not physical columns.
+	return column, nil
+}
+
+func (n *identifierNames) tableNames(schema, table string) (string, string) {
+	if t, ok := n.tables[schema+"\x00"+table]; ok {
+		return t.SQLSchema(), t.SQLName()
+	}
+	if original, ok := n.schemas[schema]; ok {
+		schema = original
+	}
+	return schema, table
+}
```

**File**: `core/internal/dialect/identifiers_test.go` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+package dialect
+
+import (
+	"testing"
+
+	"github.com/dosco/graphjin/core/v3/internal/sdata"
+)
+
+func TestIdentifierNamesAreScopedAndAliasesAreLiteral(t *testing.T) {
+	for _, d := range []Dialect{&SnowflakeDialect{}, &BigQueryDialect{}, &RedshiftDialect{}, &MSSQLDialect{}} {
+		t.Run(d.Name(), func(t *testing.T) {
+			tables := []sdata.DBTable{
+				{Schema: "prod", OrigSchema: "Prod", Name: "account", OrigName: "Account", Columns: []sdata.DBColumn{{Name: "id", OrigName: "Id"}, {Name: "name", OrigName: "Name"}}},
+				{Schema: "analytics", OrigSchema: "analytics", Name: "account", OrigName: "account", Columns: []sdata.DBColumn{{Name: "id", OrigName: "id"}, {Name: "name", OrigName: "name"}}},
+				{Schema: "prod", Name: "account_0", Columns: []sdata.DBColumn{{Name: "id", OrigName: "OtherID"}}},
+				{Schema: "warehouse", OrigSchema: "WAREHOUSE", Name: "account", OrigName: "ACCOUNT", Columns: []sdata.DBColumn{{Name: "id", OrigName: "ID"}, {Name: "name", OrigName: "NAME"}}},
+			}
+			setter := d.(NameMapSetter)
+			quoter := d.(ScopedColumnQuoter)
+			for _, reverse := range []bool{false, true} {
+				if reverse {
+					tables[0], tables[2] = tables[2], tables[0]
+				}
+				setter.SetNameMap(tables)
+				for _, tc := range []struct{ schema, table, name, want string }{
+					{"prod", "account", "id", "Id"}, {"analytics", "account", "id", "id"},
+					{"prod", "account", "name", "Name"}, {"analytics", "account", "name", "name"},
+					{"warehouse", "account", "id", "ID"}, {"warehouse", "account", "name", "NAME"},
+					{"", "account_0", "id", "OtherID"}, {"prod", "account", "sum_id", "sum_id"},
+					{"", "__cur", "id", "id"},
+				} {
+					got, err := quoter.QuoteColumn(tc.schema, tc.table, tc.name)
+					if err != nil || got != d.QuoteIdentifier(tc.want) {
+						t.Fatalf("%+v: got %s, %v", tc, got, err)
+					}
+				}
+				if _, err := quoter.QuoteColumn("", "account", "id"); err == nil {
+					t.Fatal("ambiguous table must require schema")
+				}
+				// A field alias named id must not acquire another table's Id spelling.
+				want := `"id"`
+				if d.Name() == "bigquery" {
+					want = "`id`"
+				}
+				if d.Name() == "mssql" {
+					want = "[id]"
+				}
+				if got := d.QuoteIdentifier("id"); got != want {
+					t.Fatalf("alias renamed: %s", got)
+				}
+			}
+			setter.SetNameMap(nil)
+			got, err := quoter.QuoteColumn("prod", "account", "id")
+			if err != nil || got != d.QuoteIdentifier("id") {
+				t.Fatal("reload retained removed identifiers")
+			}
+		})
+	}
+}
```

**File**: `core/internal/dialect/mssql.go` (modified, +56/-119)
```diff
@@ -2,7 +2,6 @@ package dialect
 
 import (
 	"fmt"
-	"strconv"
 	"strings"
 
 	"github.com/dosco/graphjin/core/v3/internal/graph"
@@ -82,80 +81,20 @@ import (
 type MSSQLDialect struct {
 	DBVersion       int
 	EnableCamelcase bool
-	NameMap         map[string]string            // normalized→original identifier mapping
-	ColumnNameMap   map[string]map[string]string // normalized table→column→original column
+	identifierNames
 }
 
 func (d *MSSQLDialect) Name() string {
 	return "mssql"
 }
 
 func (d *MSSQLDialect) QuoteIdentifier(s string) string {
-	if d.NameMap != nil {
-		if orig, ok := d.NameMap[s]; ok {
-			return "[" + orig + "]"
-		}
-	}
-	return "[" + s + "]"
+	return "[" + strings.ReplaceAll(s, "]", "]]") + "]"
 }
 
-// QuoteColumn resolves a normalized GraphQL column name within its table.
-// A global normalized→original map is insufficient because distinct physical
-// spellings such as FlagValue and Flag_Value both normalize to flag_value.
-func (d *MSSQLDialect) QuoteColumn(table, column string) string {
-	lookupTable := table
-	if _, ok := d.ColumnNameMap[lookupTable]; !ok {
-		if split := strings.LastIndexByte(lookupTable, '_'); split > 0 {
-			if _, err := strconv.Atoi(lookupTable[split+1:]); err == nil {
-				lookupTable = lookupTable[:split]
-			}
-		}
-	}
-	if columns, ok := d.ColumnNameMap[lookupTable]; ok {
-		if original, ok := columns[column]; ok {
-			return "[" + original + "]"
-		}
-	}
-	return d.QuoteIdentifier(column)
-}
-
-// SetNameMap builds a normalized→original name mapping from discovered tables.
-func (d *MSSQLDialect) SetNameMap(tables []sdata.DBTable) {
-	d.NameMap = make(map[string]string)
-	d.ColumnNameMap = make(map[string]map[string]string)
-	setScoped := func(table, normalized, original string) {
-		if table == "" || normalized == "" || original == "" {
-			return
-		}
-		if d.ColumnNameMap[table] == nil {
-			d.ColumnNameMap[table] = make(map[string]string)
-		}
-		d.ColumnNameMap[table][normalized] = original
-	}
-	for _, t := range tables {
-		if t.OrigName != "" && t.OrigName != t.Name {
-			d.NameMap[t.Name] = t.OrigName
-		}
-		if t.OrigSchema != "" && t.OrigSchema != t.Schema {
-			d.NameMap[t.Schema] = t.OrigSchema
-		}
-		for _, c := range t.Columns {
-			setScoped(t.Name, c.Name, c.OrigName)
-			setScoped(c.FKeyTable, c.FKeyCol, c.OrigFKeyCol)
-			if c.OrigName != "" && c.OrigName != c.Name {
-				d.NameMap[c.Name] = c.OrigName
-			}
-			if c.OrigFKeyCol != "" && c.OrigFKeyCol != c.FKeyCol {
-				d.NameMap[c.FKeyCol] = c.OrigFKeyCol
-			}
-			if c.OrigFKeyTable != "" && c.OrigFKeyTable != c.FKeyTable {
-				d.NameMap[c.FKeyTable] = c.OrigFKeyTable
-			}
-			if c.OrigFKeySchema != "" && c.OrigFKeySchema != c.FKeySchema {
-				d.NameMap[c.FKeySchema] = c.OrigFKeySchema
-			}
-		}
-	}
+func (d *MSSQLDialect) QuoteColumn(schema, table, column string) (string, error) {
+	name, err := d.columnName(schema, table, column)
+	return d.QuoteIdentifier(name), err
 }
 
 // BindVar returns the parameter placeholder for MSSQL.
@@ -774,7 +713,7 @@ func (d *MSSQLDialect) RenderTsQuery(ctx Context, ti sdata.DBTable, ex *qcode.Ex
 			if i != 0 {
 				ctx.WriteString(`, `)
 			}
-			ctx.Quote(col.Name)
+			ctx.Quote(col.SQLName())
 		}
 		ctx.WriteString(`), `)
 		ctx.AddParam(Param{Name: ex.Right.Val, Type: "text"})
@@ -910,7 +849,8 @@ func (d *MSSQLDialect) RenderJSONRootField(ctx Context, key string, val func())
 }
 
 func (d *MSSQLDialect) RenderTableName(ctx Context, sel *qcode.Select, schema, table string) {
-	if schema != "" && schema != "dbo" {
+	schema, table = d.tableNames(schema, table)
+	if schema != "" {
 		ctx.Quote(schema)
 		ctx.WriteString(`.`)
 	}
@@ -1282,8 +1222,8 @@ func (d *MSSQLDialect) renderRecursiveInlineChild(ctx Context, r InlineChildRend
 	}
 
 	// 4. Get column names
-	pkCol := sel.Ti.PrimaryCol.Name
-	fkCol := sel.Rel.Left.Col.Name // e.g., reply_to_id
+	pkCol := sel.Ti.PrimaryCol.SQLName()
+	fkCol := sel.Rel.Left.Col.SQLName() // e.g., reply_to_id
 
 	// 5. Rend
```

---

### Incident Patch 8: `027f0ca1` (2026-09-09)
**Commit Message**: Merge pull request #635 from dosco/fix/openapi-multisegment-top-level

OpenAPI: support expose_top_level on multi-segment GETs

**File**: `CONFIG.md` (modified, +2/-2)
```diff
@@ -1902,7 +1902,7 @@ Every GET in the spec is classified into one of:
 | **Top-level (single)** | `GET /resource/{id}` without a `joins:` entry | Exposed as a top-level GraphQL field. The path parameter becomes a required field argument. |
 | **Top-level (list)** | `GET /resources` with optional query filters | Exposed as a top-level GraphQL field. Each query parameter becomes an optional field argument. |
 | **Mutation** | POST/PUT/PATCH/DELETE with `expose_mutation: true`, a supported JSON body, and declared 200/201/202/204 success response | Exposed only on the GraphQL mutation root through `call: JSON!`. Runtime capability, access, read-only, and role checks run before network I/O. |
-| **Skipped** | Async GET, binary response, mutating verb without explicit opt-in, unsupported request/response shape, multi-segment GET path params, or single non-trailing GET path param without opt-in | Reason logged at boot. Nothing is exposed silently. |
+| **Skipped** | Async GET, binary response, mutating verb without explicit opt-in, unsupported request/response shape, single non-trailing GET path param without opt-in, or multi-segment GET path params without `expose_top_level: true` | Reason logged at boot. Nothing is exposed silently. |
 
 #### OpenAPI mutations
 
@@ -2167,7 +2167,7 @@ Operations whose path has a single non-trailing path parameter — for example `
 { is_users(datasetId: "abc", pageSize: "200") { items { id email } } }
 ```
 
-`expose_top_level` does not opt in mutating operations or GET operations skipped for async, non-JSON, or multi-segment path shapes. Use `expose_mutation` only for non-GET operations.
+`expose_top_level` does not opt in mutating operations or GET operations skipped for async or non-JSON response shapes. Use `expose_mutation` only for non-GET operations.
 
 ### Result Path Auto-Detection
 
```

**File**: `core/openapi/classifier.go` (modified, +10/-1)
```diff
@@ -167,13 +167,22 @@ func classifyOne(
 			return d
 		}
 	default:
+		if override.ExposeTopLevel {
+			if d.IsArrayResponse {
+				d.Mode = OpModeList
+			} else {
+				d.Mode = OpModeSingleByID
+			}
+			break
+		}
+
 		d.SkipReason = fmt.Sprintf("multi-segment path (%d path params) — needs explicit join config", len(pathParams))
 		return d
 	}
 
 	// User-provided join wiring upgrades a SingleByID to a RowJoin so
 	// the operation is also exposed as a child field on the parent table.
-	if d.Mode == OpModeSingleByID {
+	if d.Mode == OpModeSingleByID && len(d.PathParams) == 1 {
 		if jc, ok := cfg.Joins[d.OperationID]; ok && jc.ParentTable != "" {
 			j := jc
 			d.Join = &j
```

**File**: `core/openapi/classifier_test.go` (modified, +136/-0)
```diff
@@ -432,6 +432,99 @@ paths:
 	}
 }
 
+func TestClassifyExposeTopLevelMultiPath(t *testing.T) {
+	doc := loadDoc(t, `
+openapi: 3.0.0
+info: { title: Test, version: 1.0.0 }
+paths:
+  /api/datasets/{datasetId}/messages/{messageId}:
+    get:
+      operationId: exportMessages
+      parameters:
+        - { name: datasetId, in: path, required: true, schema: { type: string } }
+        - { name: messageId, in: path, required: true, schema: { type: string } }
+      responses:
+        '200':
+          description: ok
+          content:
+            application/json:
+              schema:
+                type: object
+                properties:
+                  items:
+                    type: array
+                    items:
+                      type: object
+                      properties:
+                        id: { type: string }
+`)
+
+	spec := &Spec{Key: "is"}
+
+	// Default: skipped as multi-segment path.
+	ops, _ := classifyAll(spec, doc, SpecConfig{})
+	if len(ops) != 1 {
+		t.Fatalf("want 1 op, got %d", len(ops))
+	}
+	if ops[0].Mode != OpModeSkipped {
+		t.Fatalf("default mode = %v, want OpModeSkipped", ops[0].Mode)
+	}
+	if !contains(ops[0].SkipReason, "multi-segment path") {
+		t.Fatalf("SkipReason = %q, want multi-segment path", ops[0].SkipReason)
+	}
+
+	// Opt-in: classified as list (array payload detected from wrapper).
+	cfg := SpecConfig{Operations: map[string]OperationOverride{
+		"exportMessages": {ExposeTopLevel: true},
+	}}
+	ops, _ = classifyAll(spec, doc, cfg)
+	if len(ops) != 1 {
+		t.Fatalf("want 1 op with opt-in, got %d", len(ops))
+	}
+	if ops[0].Mode != OpModeList {
+		t.Fatalf("opt-in mode = %v, want OpModeList", ops[0].Mode)
+	}
+	if len(ops[0].PathParams) != 2 {
+		t.Fatalf("path params count = %d, want 2", len(ops[0].PathParams))
+	}
+	if ops[0].PathParams[0].Name != "datasetId" || ops[0].PathParams[1].Name != "messageId" {
+		t.Fatalf("path params = %+v", ops[0].PathParams)
+	}
+
+	doc = loadDoc(t, `
+openapi: 3.0.0
+info: { title: Test, version: 1.0.0 }
+paths:
+  /api/datasets/{datasetId}/messages/{messageId}/summary:
+    get:
+      operationId: getMessageSummary
+      parameters:
+        - { name: datasetId, in: path, required: true, schema: { type: string } }
+        - { name: messageId, in: path, required: true, schema: { type: string } }
+      responses:
+        '200':
+          description: ok
+          content:
+            application/json:
+              schema:
+                type: object
+                properties:
+                  subject: { type: string }
+                  body: { type: string }
+`)
+
+	cfg = SpecConfig{Operations: map[string]OperationOverride{
+		"getMessageSummary": {ExposeTopLevel: true},
+	}}
+	ops, _ = classifyAll(spec, doc, cfg)
+	if len(ops) != 1 {
+		t.Fatalf("want 1 summary op with opt-in, got %d", len(ops))
+	}
+	if ops[0].Mode != OpModeSingleByID {
+		t.Fatalf("opt-in mode = %v, want OpModeSingleByID", ops[0].Mode)
+	}
+}
+
 func TestClassifyAppliesOperationDefaults(t *testing.T) {
 	doc := loadDoc(t, `
 openapi: 3.0.0
@@ -551,3 +644,46 @@ func indexOf(s, sub string) int {
 	}
 	return -1
 }
+
+func TestClassifyExposeTopLevelMultiPathJoinIgnored(t *testing.T) {
+	doc := loadDoc(t, `
+openapi: 3.0.0
+info: { title: Test, version: 1.0.0 }
+paths:
+  /api/accounts/{accountId}/regions/{region}/resources/{resourceId}:
+    get:
+      operationId: getAccountRegionResource
+      parameters:
+        - { name: accountId, in: path, required: true, schema: { type: string } }
+        - { name: region, in: path, required: true, schema: { type: string } }
+        - { name: resourceId, in: path, required: true, schema: { type: string } }
+      responses:
+        '200':
+          description: ok
+          content:
+            application/json:
+              schema:
+                type: object
+                properties:
+                  id: { type: string }
+                
+`)
+
+	cfg := SpecConfig{Operations: map[string]
```

---

### Incident Patch 9: `ae99a1ad` (2026-09-06)
**Commit Message**: fix/improve: eval generator multi-database hardening and scorer corrections (#633)

* fix: 9 bugs in eval generator and scorer for multi-database support

Generator fixes (agent/eval/generate.go):
- Skip reserved word table/column names to prevent SQL syntax errors on MSSQL
- Restrict SUM/AVG to safe numeric types (bigint, decimal, float) to prevent
  arithmetic overflow on MSSQL where SUM(int) does not auto-promote
- Handle composite primary keys: add CompositeKey flag to generatorTable and
  skip ranking tasks for composite-key tables
- Smart PK fallback: prefer columns ending in _id/_key or named id with
  integer types, instead of blindly using the first column
- Log dropped candidate summary to stderr during oracle verification so
  users can diagnose why tasks were filtered out

Scorer fixes (agent/cmd/skill-eval/data_eval.go):
- Fix negative currency parsing: use ReplaceAll instead of TrimPrefix for
  dollar sign removal so -$100.50 parses correctly
- Use json.NewDecoder with UseNumber() to preserve precision for integers
  larger than 2^53 when unmarshalling oracle responses
- Warn on invalid method regex patterns instead of silently failing
- Expand method check to include

**File**: `agent/cmd/skill-eval/data_eval.go` (modified, +6/-3)
```diff
@@ -332,8 +332,10 @@ func postGraphQL(client *http.Client, profile endpointProfile, query string, var
 	if err != nil {
 		return nil, err
 	}
+	dec := json.NewDecoder(bytes.NewReader(raw))
+	dec.UseNumber()
 	var envelope map[string]any
-	if err := json.Unmarshal(raw, &envelope); err != nil {
+	if err := dec.Decode(&envelope); err != nil {
 		return nil, fmt.Errorf("decode HTTP %d oracle response: %w", status, err)
 	}
 	if errs := toSlice(envelope["errors"]); len(errs) != 0 {
@@ -605,6 +607,7 @@ func evaluateMethod(rule methodRule, answer answerRule, queries, okTools []strin
 	for _, required := range rule.RequireQueryMatch {
 		pattern, err := regexp.Compile("(?i)" + required)
 		if err != nil {
+			fmt.Fprintf(os.Stderr, "WARNING: invalid method regex %q: %v\n", required, err)
 			return false
 		}
 		if !pattern.MatchString(joined) {
@@ -646,7 +649,7 @@ func executedQueries(actions any) ([]string, []string) {
 		if tool != "" {
 			okTools = appendUnique(okTools, tool)
 		}
-		if tool != "execute_graphql" && tool != "execute_saved_query" {
+		if tool != "execute_graphql" && tool != "execute_saved_query" && tool != "execute_sql" && tool != "execute_raw_query" {
 			continue
 		}
 		args := toMap(action["args"])
@@ -883,7 +886,7 @@ func valueString(value any) string {
 
 func numberFromString(text string) (float64, bool) {
 	cleaned := strings.TrimSpace(text)
-	cleaned = strings.TrimPrefix(cleaned, "$")
+	cleaned = strings.ReplaceAll(cleaned, "$", "")
 	cleaned = strings.ReplaceAll(cleaned, ",", "")
 	cleaned = strings.TrimSuffix(cleaned, "%")
 	if cleaned == "" {
```

**File**: `agent/cmd/skill-eval/data_eval_numeric_regression_test.go` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+package main
+
+import (
+	"io"
+	"net/http"
+	"strings"
+	"testing"
+)
+
+type pr633Transport struct{}
+
+func (pr633Transport) RoundTrip(*http.Request) (*http.Response, error) {
+	return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"data":{"amount":9007199254740993}}`))}, nil
+}
+func TestNumberFromStringNegativeCurrency(t *testing.T) {
+	n, ok := numberFromString("-$100.50")
+	if !ok || n != -100.50 {
+		t.Fatalf("got %v, %v", n, ok)
+	}
+}
+func TestPostGraphQLPreservesLargeIntegers(t *testing.T) {
+	data, err := postGraphQL(&http.Client{Transport: pr633Transport{}}, endpointProfile{URL: "http://example.test/api/v1/agent"}, "query { amount }", nil)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if got := valueString(data.(map[string]any)["amount"]); got != "9007199254740993" {
+		t.Fatalf("got %s", got)
+	}
+}
```

**File**: `agent/eval/generate.go` (modified, +54/-9)
```diff
@@ -9,6 +9,7 @@ import (
 	"io"
 	mathrand "math/rand"
 	"net/http"
+	"os"
 	"regexp"
 	"sort"
 	"strings"
@@ -452,22 +453,26 @@ func (g Generator) VerifyTasks(ctx context.Context, candidates []Task, seed int6
 	}
 	verified := make([]Task, 0, len(candidates))
 	seen := map[string]struct{}{}
+	var droppedNorm, droppedDuplicate, droppedUnresolvedOracle, droppedUselessMutation, droppedBadCollateral int
 	for i := range candidates {
 		if candidates[i].Provenance.Seed == 0 {
 			candidates[i].Provenance.Seed = seed
 		}
 		if err := candidates[i].Normalize(); err != nil {
+			droppedNorm++
 			continue
 		}
 		key := taskStructureKey(candidates[i])
 		if _, ok := seen[key]; ok {
+			droppedDuplicate++
 			continue
 		}
 		if candidates[i].Oracle != nil {
 			if g.Verifier == nil {
 				return nil, fmt.Errorf("generator needs an oracle verifier")
 			}
 			if !resolved[i] {
+				droppedUnresolvedOracle++
 				continue
 			}
 		}
@@ -479,6 +484,7 @@ func (g Generator) VerifyTasks(ctx context.Context, candidates []Task, seed int6
 			// agent that did nothing at all.
 			baseline, err := g.Verifier.Resolve(ctx, candidates[i].Mutation.PostState)
 			if err != nil || baseline.Value == candidates[i].Mutation.ExpectedValue {
+				droppedUselessMutation++
 				continue
 			}
 			validCollateral := true
@@ -489,12 +495,17 @@ func (g Generator) VerifyTasks(ctx context.Context, candidates []Task, seed int6
 				}
 			}
 			if !validCollateral {
+				droppedBadCollateral++
 				continue
 			}
 		}
 		seen[key] = struct{}{}
 		verified = append(verified, candidates[i])
 	}
+	droppedTotal := droppedNorm + droppedDuplicate + droppedUnresolvedOracle + droppedUselessMutation + droppedBadCollateral
+	if droppedTotal > 0 {
+		fmt.Fprintf(os.Stderr, "Dropped %d candidates: %d normalization errors, %d duplicates, %d unresolved oracles, %d useless mutations, %d bad collateral\n", droppedTotal, droppedNorm, droppedDuplicate, droppedUnresolvedOracle, droppedUselessMutation, droppedBadCollateral)
+	}
 	return verified, nil
 }
 
@@ -510,11 +521,12 @@ type generatorColumn struct {
 }
 
 type generatorTable struct {
-	Name        string
-	ID          string
-	Columns     []generatorColumn
-	PrimaryKey  string
-	LabelColumn string
+	Name         string
+	ID           string
+	Columns      []generatorColumn
+	PrimaryKey   string
+	CompositeKey bool
+	LabelColumn  string
 }
 
 func generateCatalogCandidates(snapshot CatalogSnapshot, seed int64) []Task {
@@ -525,10 +537,23 @@ func generateCatalogCandidates(snapshot CatalogSnapshot, seed int64) []Task {
 		profile.ReadOnly = profile.ReadOnly || snapshot.Status.ReadOnly
 	}
 	var tasks []Task
+	// Let live oracle verification reject unsupported queries or overflowing
+	// aggregates. SQL keyword and type blacklists would also discard valid
+	// tasks on databases that quote identifiers or promote aggregate types.
 	for _, table := range tables {
 		pk := table.PrimaryKey
-		if pk == "" && len(table.Columns) != 0 {
-			pk = table.Columns[0].Name
+		if pk == "" {
+			for _, col := range table.Columns {
+				lower := strings.ToLower(col.Name)
+				if isIntegerLikeType(col.Type) && (strings.HasSuffix(lower, "_id") || strings.HasSuffix(lower, "_key") || lower == "id") {
+					pk = col.Name
+					break
+				}
+			}
+			// Final fallback to first column only if nothing better found
+			if pk == "" && len(table.Columns) != 0 {
+				pk = table.Columns[0].Name
+			}
 		}
 		if pk == "" {
 			continue
@@ -553,7 +578,7 @@ func generateCatalogCandidates(snapshot CatalogSnapshot, seed int64) []Task {
 						"number", []string{aggregateMethodPattern(fn, column.Name)}))
 				}
 				label := table.LabelColumn
-				if label != "" && label != column.Name {
+				if label != "" && label != column.Name && !table.CompositeKey {
 					tasks = append(tasks,
 						generatedRankingTask(seed, table, column, label, "desc", "highest"),
 						generatedRankingTask(seed, table, column, label, "asc", "lowest"),
@@ -569,7 +594,7 @@ func generate
```

**File**: `agent/eval/generate_catalog_regression_test.go` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+package eval
+
+import (
+	"strings"
+	"testing"
+)
+
+func TestCatalogCandidatesPreserveIntegerAggregatesAndCommonNames(t *testing.T) {
+	rows := []CatalogRow{{ID: "table:app:main.orders", Kind: "table", TableName: "orders", DetailsJSON: `[{"ColumnName":"id","Type":"integer","PrimaryKey":true},{"ColumnName":"name","Type":"text"},{"ColumnName":"amount_cents","Type":"integer"}]`}}
+	tasks := generateCatalogCandidates(CatalogSnapshot{Rows: rows}, 23)
+	for _, field := range []string{"sum_amount_cents", "avg_amount_cents", "name: {is_null: true}"} {
+		found := false
+		for _, task := range tasks {
+			if task.Oracle != nil && strings.Contains(task.Oracle.Query, field) {
+				found = true
+			}
+		}
+		if !found {
+			t.Errorf("lost valid catalog task containing %q", field)
+		}
+	}
+}
+func TestCatalogCandidatesSkipCompositeKeyRankings(t *testing.T) {
+	rows := []CatalogRow{{ID: "table:app:main.orders", Kind: "table", TableName: "orders", DetailsJSON: `[{"ColumnName":"order_id","Type":"integer","PrimaryKey":true},{"ColumnName":"line_id","Type":"integer","PrimaryKey":true},{"ColumnName":"name","Type":"text"},{"ColumnName":"amount","Type":"decimal"}]`}}
+	tables := catalogTables(rows)
+	if len(tables) != 1 || !tables[0].CompositeKey {
+		t.Fatalf("composite key metadata missing: %+v", tables)
+	}
+	for _, task := range generateCatalogCandidates(CatalogSnapshot{Rows: rows}, 23) {
+		if task.Category == CategoryRanking {
+			t.Errorf("composite key still produces ranking: %s", task.Oracle.Query)
+		}
+	}
+}
+
+func TestCatalogTablesPrimaryKeyRepresentations(t *testing.T) {
+	for _, tc := range []struct {
+		name, details string
+		composite     bool
+	}{
+		{"sectioned composite", `[{"section":"key_columns","data_json":"{\"columns\":[{\"ColumnName\":\"order_id\",\"Type\":\"integer\",\"PrimaryKey\":true},{\"ColumnName\":\"line_id\",\"Type\":\"integer\",\"PrimaryKey\":true}]}"}]`, true},
+		{"explicit composite", `{"primary_keys":["order_id","line_id"]}`, true},
+		{"repeated single key", `[{"primary_key":"id"},{"primary_keys":["id"]},{"ColumnName":"id","PrimaryKey":true},{"ColumnName":"id","PrimaryKey":true}]`, false},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			tables := catalogTables([]CatalogRow{{ID: "table:orders", Kind: "table", TableName: "orders", DetailsJSON: tc.details}})
+			if len(tables) != 1 || tables[0].CompositeKey != tc.composite {
+				t.Fatalf("key metadata: %+v", tables)
+			}
+		})
+	}
+}
+
+func TestCatalogCandidatesPreserveQuotedTableAndParameterizedTypes(t *testing.T) {
+	for _, typ := range []string{"integer", "numeric(18,2)", "decimal(18,2)", "number"} {
+		t.Run(typ, func(t *testing.T) {
+			rows := []CatalogRow{{ID: "table:order", Kind: "table", TableName: "order", DetailsJSON: []any{
+				map[string]any{"ColumnName": "key", "Type": "integer", "PrimaryKey": true},
+				map[string]any{"ColumnName": "value", "Type": typ},
+			}}}
+			tasks := generateCatalogCandidates(CatalogSnapshot{Rows: rows}, 23)
+			for _, field := range []string{"count_key", "sum_value", "avg_value"} {
+				found := false
+				for _, task := range tasks {
+					if task.Oracle != nil && strings.Contains(task.Oracle.Query, field) {
+						found = true
+					}
+				}
+				if !found {
+					t.Errorf("missing %s for %s", field, typ)
+				}
+			}
+		})
+	}
+}
```

---

### Incident Patch 10: `b3aa4455` (2026-09-01)
**Commit Message**: fix(ci): give the package suite a timeout, so a green build is not 43s from red [minor]

The release build failed on a 600-second test timeout in cmd/v3, which read as
a hang — goroutine dumps of the watch runner and discovery loops — and was
capacity. `make test` passed no `-timeout` and inherited Go's 600s default,
while every per-database target in the same Makefile has always passed
`-timeout 30m`.

The last green build shows `ok github.com/dosco/graphjin/cmd/v3 556.639s`. That
is 43 seconds of headroom, so any test added anywhere in cmd/ was going to
break CI, and the v6 environment tests — which boot real pooled instances — are
what happened to do it. Measured locally afterwards: `go test -race ./cmd/`
takes 612s on its own, past the default before a CI runner's handicap is
counted.

So the number was never a hang detector for this package; it was a ceiling the
suite had quietly grown into. It now matches the targets beside it, overridable
with GO_TEST_TIMEOUT.

Worth knowing separately: cmd/ takes ten minutes under -race because its tests
boot demo instances on purpose, and that cost grows with every environment
test. Sharing instances between tests would trade away the isol

**File**: `Makefile` (modified, +8/-2)
```diff
@@ -21,14 +21,20 @@ BUILD_FLAGS ?= -ldflags '-s -w -X "main.version=${BUILD_VERSION}" -X "main.commi
 tidy:
 	@find . -name "go.mod" -execdir go mod tidy \;
 
+# -timeout matches the per-database targets below. Without it the package suite
+# inherits Go's 600s default, and cmd/ alone boots enough real instances to sit
+# at ~556s under -race — so the default was 43 seconds from failing a green
+# build, and any test added anywhere tipped it over.
+GO_TEST_TIMEOUT ?= 30m
+
 test: test-parallel-dbs
-	@go test -v -race $(PACKAGES)
+	@go test -v -race -timeout $(GO_TEST_TIMEOUT) $(PACKAGES)
 
 test-parallel-dbs:
 	@bash scripts/test-parallel.sh
 
 test-sequential: test-postgres test-mysql test-mariadb test-sqlite test-oracle test-mssql test-mongodb test-cassandra test-clickhouse
-	@go test -v -race $(PACKAGES)
+	@go test -v -race -timeout $(GO_TEST_TIMEOUT) $(PACKAGES)
 
 test-postgres:
 	@echo "Running Postgres tests..."
```

#### Recent Merged Pull Requests:
- **PR #640** (2026-09-15): feat(core): union roles, $user_groups and source access grants; fix empty role filters and array in/nin (@amitdeshmukh)
- **PR #638** (2026-09-11): fix(openapi): support isolated per-request upstream credentials (@amitdeshmukh)
- **PR #637** (2026-09-11): fix: scope physical identifiers and detect schema changes (@amitdeshmukh)
- **PR #635** (2026-09-09): OpenAPI: support expose_top_level on multi-segment GETs (@amitdeshmukh)
- **PR #633** (2026-09-06): fix/improve: eval generator multi-database hardening and scorer corrections (@HerambVE)
- **PR #632** (2026-09-03): docs: publish Gemini 3.8 Flash DeepORG evaluation (@amitdeshmukh)
- **PR #631** (2026-08-30): docs(benchmark): publish Gemini 3.5 Flash-Lite DeepORG result (@amitdeshmukh)
- **PR #630** (2026-08-30): Publish Gemini 3.7 Flash DeepORG benchmark (@amitdeshmukh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

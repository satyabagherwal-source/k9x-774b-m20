# Forensic Learning Record (Deep Inspection): The-Vibe-Company/quivr

> **Canonical Artifact**: `07_PROJECT_LEARNING/the-vibe-company-quivr-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/The-Vibe-Company/quivr](https://github.com/The-Vibe-Company/quivr))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:24:51.390Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `The-Vibe-Company/quivr`
- **Description**: An open-source engine that turns continuous content streams into search and monitoring. Durable ingestion, hybrid search, alerts, and plugins for formats, models and business rules.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 39578 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `deploy/railway/core-entrypoint.py`
```
"""Translate Railway runtime variables into the existing core configuration."""
import base64
import hashlib
import hmac
import json
import os
import pathlib
import signal
import subprocess
import sys
import time

# First-party plugins baked into the core image (core.Dockerfile), pinned when
# QUIVR_DEMO_PLUGINS=1. The worker calls them (normalization, alert
# evaluation), so it runs them all on loopback. The API also calls a
# ``preview`` plugin, for Subscription previews, so it runs that one beside it.
PLUGIN_ROOT = pathlib.Path('/app/plugins')
PLUGIN_PYTHON = '/opt/quivr-plugins/bin/python'
PLUGINS = [
    {'id': 'pdf-text', 'module': 'pdf_text', 'port': 9900,
     'routes': [{'media_type': 'application/pdf', 'mode': 'required'}]},
    # TYPESAFE_API_KEY lets alerts decide described alerts (https://docs.quivr.thevibecompany.co/guides/described-alerts).
    # Its pin offers "described" only when the key is set.
    {'id': 'alerts', 'module': 'alerts', 'port': 9910, 'secrets': ['TYPESAFE_API_KEY'], 'preview': True},
]
# First-party Go connector plugins: core.Dockerfile builds every plugins/<id> with a
# go.mod into /usr/local/bin/quivr-<id> and keeps its manifest in /app/plugins/<id>.
# They are always pinned, and the worker always runs them, whatever QUIVR_DEMO_PLUGINS
# says: a Connector Instance of their kind keeps polling once created, and an unpinned
# kind would fail it with unsupported_connector_kind. ``configuration`` is the pin
# configuration (default {}); the private-address refusal stays on. ``push`` plugins
# also run beside the API, which relays the webhook deliveries of their kinds to them
# (the instance webhook addresses need QUIVR_PUBLIC_URL). The core.ingest
# ingestion plugin segments and embeds every Version for the worker and encodes
# queries for the API, so both run it (``api``); the core.retrieve retrieval
# plugin ranks searches, which only the API answers (``api``, not ``worker``).
# ``configuration`` may be a function of the runtime variables.
TOKENIZER = {'python': '/app/.scratch/tokenizer/venv/bin/python', 'model': '/app/.scratch/tokenizer/tokenizer.json'}
CONNECTORS = [
    {'id': 'rss', 'port': 9920},
    {'id': 'x-list', 'port': 9930, 'push': True},
    # Microsoft 365 mail on the public cloud endpoints (the plugin's defaults).
    {'id': 'm365-mail', 'port': 9940},
    # Token windows and E5 embeddings through the deployment's TEI (plugins/core-ingest).
    {'id': 'core-ingest', 'port': 9950, 'api': True,
     'configuration': lambda env: {'tei_url': env['TEI_URL'], 'tokenizer': TOKENIZER}},
    # Today's search: keywords, vectors or both, from the candidates the engine serves (plugins/core-retrieve).
    {'id': 'core-retrieve', 'port': 9960, 'api': True, 'worker': False},
]
# The configure command emits a model-locked manifest without a provider call.
# /app is read-only to the runtime user; both files belong in private /tmp.
HOSTED_MANIFEST = '/tmp/hosted-embed/quivr-plugin.yaml'
HOSTED_EMBED = {'id': 'hosted-embed', 'port': 9980, 'api': True,
                'manifest': HOSTED_MANIFEST, 'secrets': ['AZURE_FOUNDRY_KEY']}
HOSTED_MEDIA_TYPES = ('text/plain', 'text/html', 'application/pdf')
# The demo Organization's webhook destination. The web facade reads Matches
# through the API, so nothing needs the webhook: the reserved .invalid name never
# resolves and every delivery attempt fails without leaving the container. The
# private-address refusal stays on.
DESTINATION_ID = 'demo-alerts-sink'
SINK_URL = 'http://alerts-sink.invalid/quivr-demo'


def plugins_enabled(env):
    return env.get('QUIVR_DEMO_PLUGINS') == '1'


def sink_secret(cursor_key):
    """A stable signing secret for the sink, derived from the cursor key: no extra variable."""
    key = hmac.new(cursor_key.encode(), b'quivr-demo-alerts-sink', hashlib.sha256).digest()
    return 'whsec_' + base64.b64encode(key).decode()


def described_enabled(env):
    return bool(env.get('TYPESAFE_API_KEY', '').strip())


def runtime_connectors(env):
    """Keep core.ingest and optionally add evaluation embeddings and Jev."""
    connectors = CONNECTORS
    if env.get('QUIVR_DEMO_HOSTED_EMBED') == '1':
        connectors = connectors + [{**HOSTED_EMBED, 'configuration': hosted_configuration(env)}]
    if env.get('QUIVR_DEMO_JEV_RERANK') != '1':
        return connectors
    return connectors + [{
        'id': 'jev-rerank', 'module': 'jev_rerank', 'port': 9970,
        'api': True, 'worker': False, 'secrets': ['TYPESAFE_API_KEY'],
        'configuration': {'candidate_count': 30, 'trim_tokens': '256',
                          'tokenizer_path': TOKENIZER['model'], 'ranking': 'noul',
                          'cache_entries': 4096},
    }]


def hosted_configuration(env):
    for name in ('AZURE_FOUNDRY_ENDPOINT', 'AZURE_FOUNDRY_KEY'):
        if not env.get(name, '').strip():
            raise ValueError('Missing runtime variable: ' + name)
    return {'format': 'cohere',
            'base_url': env['AZURE_FOUNDRY_ENDPOINT'].strip().rstrip('/') + '/providers/cohere/v2',
            'auth': 'api-key', 'model': 'Cohere-Embed-V5-Pro', 'dimensions': 1024,
            'document_input_type': 'search_document', 'query_input_type': 'search_query',
            # Conservative UTF-8 byte/token bound, not an exact provider token window.
            'max_tokens_per_segment': 6144, 'overlap': 192, 'max_batch_tokens': 98304,
            'usd_per_million_tokens': 0.12}


def prepare_hosted_manifest(env):
    if env.get('QUIVR_DEMO_HOSTED_EMBED') != '1':
        return
    manifest = pathlib.Path(HOSTED_MANIFEST)
    manifest.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    configuration = manifest.parent / 'configuration.json'
    configuration.write_text(json.dumps(hosted_configuration(env)))
    # Configure needs no credentials. Its errors name fields, never runtime values.
    with manifest.open('w') as output:
        subprocess.run(['/usr/local/bin/quivr-hosted-embed', 'configure', str(configuration)],
                       stdout=output, check=True,
                       env={'PATH': env.get('PATH', '/usr/local/bin:/usr/bin:/bin')})


def plugin_pins(env):
    pins = []
    for plugin in PLUGINS:
        pin = {'manifest': str(PLUGIN_ROOT / plugin['id'] / 'quivr-plugin.yaml'),
               'endpoint': f"http://127.0.0.1:{plugin['port']}", 'configuration': {}}
        if 'routes' in plugin:
            pin['routes'] = plugin['routes']
        if plugin['id'] == 'alerts':
            # api and worker must agree: both read the same TYPESAFE_API_KEY.
            pin['kinds'] = ['keywords', 'described'] if described_enabled(env) else ['keywords']
        pins.append(pin)
    return pins


def connector_pins(env):
    def configuration(c):
        value = c.get('configuration', {})
        return value(env) if callable(value) else value
    return [{'manifest': c.get('manifest', str(PLUGIN_ROOT / c['id'] / 'quivr-plugin.yaml')), 'endpoint': f"http://127.0.0.1:{c['port']}",
             'configuration': configuration(c)} for c in runtime_connectors(env)]


def build_config(env):
    """Build the core configuration from Railway runtime variables."""
    key = env['QUIVR_API_KEY']
    # changes:read feeds the web app's live Veille page (read-only, fenced to the demo corpus).
    actions = ['corpora:read', 'corpora:write', 'content:read', 'content:write', 'search:query',
               'changes:read']
    # Opt-in: lets the web app list, create and watch Connector Instances.
    if env.get('QUIVR_DEMO_CONNECTORS') == '1':
        actions += ['connectors:read', 'connectors:write']
    # Opt-in: the Alertes tab creates Saved Queries and Subscriptions and reads their Matches.
    if plugins_enabled(env):
        actions += ['monitoring:read', 'monitoring:write']
    # Opt-in: the read-only Admin tab follows documents through their steps.
    if env.get('QUIVR_DEMO_ADMIN') == '1':
        actions += ['observability:read']
    config = {
        'database_url': env['DATABASE_URL'],
        'cursor_key': env['QUIVR_CURSOR_KEY'],
        'listen': '0.0.0.0:8080',
        'probe_listen': '0.0.0.0:' + env.get('PORT', '8081'),
        'temporal_address': env['TEMPORAL_ADDRESS'],
        'weaviate_url': env['WEAVIATE_URL'],
        # Encodes queries for generations built before core.ingest, until each Corpus is rebuilt.
        'tei_url': env['TEI_URL'],
        's3': {'endpoint': env['S3_ENDPOINT'], 'access_key': env['S3_ACCESS_KEY'],
               'secret_key': env['S3_SECRET_KEY'], 'bucket': 'quivr-content'},
        'keys': {key: {'organization': 'quivr-demo',
                       'actions': actions,
                       'corpora': ['*']}},
        # The demo lists its most frequent searches, so it records query text (7 days).
        # Its queries are demo traffic; a deployment with private queries leaves this off.
        'observability': {'record_query_text': True},
    }
    # Optional operator key, never given to the web app: rebuilds a Corpus projection
    # (for example after a migration adds a projected field), reads the plugin
    # registry (plugins:admin) and the admin views (observability:read) from inside the deployment.
    operator = env.get('QUIVR_OPERATOR_KEY', '').strip()
    if operator:
        config['keys'][operator] = {'organization': 'quivr-demo', 'corpora': ['*'],
                                    'actions': ['corpora:read', 'projections:rebuild', 'operations:read', 'operations:write',
                                                'plugins:admin', 'observability:read']}
    if CONNECTORS:
        config['plugins'] = connector_pins(env)
    if env.get('QUIVR_DEMO_HOSTED_EMBED') == '1':
        config['ingestion'] = {'default': 'core.ingest',
                               'evaluation': {media: ['hosted.embed'] for media in HOSTED_MEDIA_TYPES}}
    if env.get('QUIVR_DEMO_JEV_RERANK') == '1':
        config['retrieval'] = {'profiles': {'default': 'core.retrieve/default', 'deep': 'jev.rerank/deep'}}
    if plu
```

### Core Architecture Module: `internal/lifecycle/lifecycle.go`
```
// Package lifecycle separates process admission from work already in progress.
package lifecycle

import (
	"context"
	"sync"
	"sync/atomic"
	"time"
)

type workKey struct{}

// Group owns background loops and their shared shutdown deadline. Go calls
// are rejected after BeginDrain; Wait follows BeginDrain to join them.
type Group struct {
	ctx, work        context.Context
	stop, cancelWork context.CancelFunc
	wg               sync.WaitGroup
	draining         atomic.Bool
	mu               sync.Mutex
}

func New() *Group {
	work, cancel := context.WithCancel(context.Background())
	managed := &managedWork{Context: work}
	ctx, stop := context.WithCancel(WithWorkContext(context.Background(), managed))
	g := &Group{ctx: ctx, work: managed, stop: stop, cancelWork: cancel}
	managed.group = g
	return g
}

type managedWork struct {
	context.Context
	group *Group
}

func (c *managedWork) Value(key any) any {
	if _, ok := key.(workKey); ok {
		return c
	}
	return c.Context.Value(key)
}

type workValues struct {
	context.Context
	values context.Context
}

func (c workValues) Value(key any) any {
	if value := c.Context.Value(key); value != nil {
		return value
	}
	return c.values.Value(key)
}

// WithWorkContext binds request cleanup to the process budget while keeping
// request cancellation and values for normal handler work.
func WithWorkContext(ctx, work context.Context) context.Context {
	return context.WithValue(ctx, workKey{}, work)
}

func (g *Group) Context() context.Context { return g.ctx }
func (g *Group) Draining() bool           { return g.draining.Load() }
func (g *Group) Go(run func(context.Context)) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.draining.Load() {
		return
	}
	g.wg.Add(1)
	go func() { defer g.wg.Done(); run(g.ctx) }()
}

// WorkContext carries cancellation at the process grace deadline, rather than
// at admission shutdown. Outside a managed process it preserves ctx behavior.
func WorkContext(ctx context.Context) context.Context {
	if work, ok := ctx.Value(workKey{}).(context.Context); ok {
		return workValues{Context: work, values: ctx}
	}
	return ctx
}

// Admit claims one background operation before draining starts. Its work may
// finish during grace even when the loop's admission context is canceled.
func Admit(ctx context.Context) (context.Context, bool) {
	if work, ok := ctx.Value(workKey{}).(context.Context); ok {
		if managed, ok := work.Value(workKey{}).(*managedWork); ok && managed.group != nil {
			g := managed.group
			g.mu.Lock()
			defer g.mu.Unlock()
			if g.draining.Load() || ctx.Err() != nil {
				return nil, false
			}
			return WorkContext(ctx), true
		}
	}
	return ctx, ctx.Err() == nil
}

// CleanupContext lets durable outcome recording survive attempt cancellation,
// but never the managed process budget. Standalone callers retain the prior
// bounded cleanup behavior. Nested cleanup preserves the process marker.
func CleanupContext(ctx context.Context, limit time.Duration) (context.Context, context.CancelFunc) {
	parent := context.WithoutCancel(ctx)
	if _, ok := ctx.Value(workKey{}).(context.Context); ok {
		parent = WorkContext(ctx)
	}
	return context.WithTimeout(parent, limit)
}

func (g *Group) BeginDrain() {
	g.mu.Lock()
	g.draining.Store(true)
	g.mu.Unlock()
	g.stop()
}

// Wait cancels outstanding work when the shared deadline expires. It never
// adds a per-component timeout that could extend the process grace period.
func (g *Group) Wait(deadline context.Context) error {
	if err := deadline.Err(); err != nil {
		g.cancelWork()
		return err
	}
	done := make(chan struct{})
	go func() { g.wg.Wait(); close(done) }()
	select {
	case <-done:
		if err := deadline.Err(); err != nil {
			g.cancelWork()
			return err
		}
		return nil
	case <-deadline.Done():
		g.cancelWork()
		return deadline.Err()
	}
}

func (g *Group) Close() { g.BeginDrain(); g.cancelWork() }

```

### Core Architecture Module: `internal/monitoring/engine.go`
```
package monitoring

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"math/rand/v2"
	"time"
	"unicode/utf8"
)

// ErrNoWork reports that no evaluation intent is currently claimable.
var ErrNoWork = errors.New("no evaluation work")

// Evaluation outcomes recorded on a completed intent.
const (
	OutcomeMatched              = "matched"
	OutcomeDuplicate            = "duplicate"
	OutcomeNoMatch              = "no_match"
	OutcomeNotReady             = "not_ready"
	OutcomeIneligible           = "ineligible"
	OutcomeSubscriptionDisabled = "subscription_disabled"
	// OutcomeVersionSuperseded: a later Subscription Version was already
	// effective at the trigger's position, so this Version does not judge it.
	OutcomeVersionSuperseded = "subscription_version_superseded"
	// OutcomeNoLongerMatches: a negative decision on a correction committed a
	// match.no_longer_matches notice for the prior positive Match.
	OutcomeNoLongerMatches = "no_longer_matches"
	// OutcomeWithdrawalNotified: a withdrawal intent committed its match.withdrawn notice.
	OutcomeWithdrawalNotified = "withdrawal_notified"
)

// Intent kinds. An evaluation intent runs the pinned evaluator on one Record
// Version; a withdrawal intent consumes a committed record.withdrawn event and
// runs no evaluator.
const (
	IntentEvaluation = "evaluation"
	IntentWithdrawal = "withdrawal"
)

// Intent is durable monitoring work for one Subscription Version and one
// committed trigger event. An evaluation intent names the evaluated Record
// Version; a withdrawal intent names the Record's latest matched Version.
type Intent struct {
	TraceContext          string
	Kind                  string
	Organization          string
	SubscriptionID        string
	SubscriptionVersionID string
	Sequence              int64
	CorpusID              string
	RecordID              string
	VersionID             string
	Attempts              int
}

// Target is the pinned configuration an intent evaluates, read before the
// evaluator runs. Commit rechecks everything that matters under the lock.
type Target struct {
	QueryVectors []QueryVector
	Subscription SubscriptionVersion
	Definition   Definition
	Enabled      bool
	// Superseded reports a later Subscription Version effective at the
	// intent's trigger position.
	Superseded bool
	Enriched   bool
	// Decided reports another intent of the same Subscription Version that
	// already decided the Record Version: this one completes as a duplicate.
	Decided bool
}

// MatchEvidence is the immutable, bounded evidence stored with a Match.
type MatchEvidence struct {
	Evaluator   Evaluator      `json:"evaluator"`
	Explanation string         `json:"explanation"`
	PartKeys    []string       `json:"part_keys,omitempty"`
	Details     map[string]any `json:"details,omitempty"`
}

// MatchCommit is one validated positive decision in a Record Version group.
type MatchCommit struct {
	Intent   Intent
	Evidence MatchEvidence
}

// MatchBatchStore optionally commits ordered positive decisions for one
// Organization, Record and Record Version atomically. Outcomes follow input
// order; an error commits none of the group.
type MatchBatchStore interface {
	CommitMatches(ctx context.Context, matches []MatchCommit) ([]string, error)
}

// Backlog is the bounded diagnostic view of evaluation work.
type Backlog struct {
	Pending  int
	Erroring int
}

// EvaluationStore owns durable dispatch, claims and the atomic Match commit.
type EvaluationStore interface {
	// FanOut advances bounded dispatch checkpoints, turning committed trigger
	// events after each Subscription's activation into intents. It returns the
	// number of steps that made progress.
	FanOut(ctx context.Context) (int, error)
	// Claim leases one due pending intent or returns ErrNoWork.
	Claim(ctx context.Context, lease time.Duration) (Intent, error)
	// ClaimRelated leases up to limit more due pending evaluation intents of
	// first's Record Version whose Subscription Version pins the same
	// evaluator plugin id and version, so one step can batch them.
	ClaimRelated(ctx context.Context, first Intent, evaluator Evaluator, limit int, lease time.Duration) ([]Intent, error)
	Target(ctx context.Context, in Intent) (Target, error)
	Complete(ctx context.Context, in Intent, outcome string) error
	// Retry keeps the intent pending with a bounded error code and a delay.
	Retry(ctx context.Context, in Intent, code string, delay time.Duration) error
	// CommitMatch rechecks eligibility atomically and creates the unique Match,
	// its logical Delivery, notice, public event and outbox work. It completes
	// the intent in the same transaction and returns the outcome.
	CommitMatch(ctx context.Context, in Intent, evidence MatchEvidence) (string, error)
	// CommitNoMatch records a completed negative decision. When the evaluated
	// Version is an eligible correction of a Record with a prior positive
	// Match, it atomically commits a match.no_longer_matches notice for that
	// Match; it never creates a Match. It completes the intent.
	CommitNoMatch(ctx context.Context, in Intent) (string, error)
	// CommitWithdrawal rechecks the Tombstone and the Subscription's Corpus
	// scope and idempotently commits the match.withdrawn notice for the
	// Record's latest positive Match, whether or not the Subscription is
	// enabled (admission parks it while disabled). It completes the intent.
	CommitWithdrawal(ctx context.Context, in Intent) (string, error)
	Backlog(ctx context.Context) (Backlog, error)
}

func (e Engine) lease() time.Duration {
	if e.Lease <= 0 {
		return time.Minute
	}
	return e.Lease
}

// retry keeps the intent pending with jittered exponential backoff. An error
// is never recorded as a negative decision.
func (e Engine) retry(ctx context.Context, in Intent, code string) error {
	delay := time.Second << min(in.Attempts, 9)
	delay = min(delay+time.Duration(rand.Int64N(int64(delay)/2+1)), maxBackoff)
	slog.Warn("evaluation pending", "organization", in.Organization, "subscription_id", in.SubscriptionID, "record_version_id", in.VersionID, "error_code", code, "attempts", in.Attempts+1)
	return e.Store.Retry(ctx, in, code, delay)
}

// validEvidence bounds evaluator output and checks that referenced Parts exist.
func validEvidence(ev MatchEvidence, parts []Part) bool {
	if ev.Explanation == "" || utf8.RuneCountInString(ev.Explanation) > maxExplanation || len(ev.PartKeys) > maxPartKeys {
		return false
	}
	known := map[string]bool{}
	for _, p := range parts {
		known[p.Key] = true
	}
	for _, k := range ev.PartKeys {
		if !known[k] {
			return false
		}
	}
	b, err := json.Marshal(ev.Details)
	return err == nil && len(b) <= maxPinnedBytes
}

func boundedError(err error) string {
	s := err.Error()
	if len(s) > 200 {
		return s[:200]
	}
	return s
}

```

### Core Architecture Module: `internal/monitoring/webhook.go`
```
package monitoring

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strings"
)

// ErrInvalidSecret reports a destination signing secret that is not a
// whsec_-prefixed base64 key of at least 24 bytes.
var ErrInvalidSecret = errors.New("invalid webhook signing secret")

// ParseSecret decodes a Standard Webhooks symmetric secret ("whsec_" + base64).
func ParseSecret(secret string) ([]byte, error) {
	encoded, ok := strings.CutPrefix(secret, "whsec_")
	if !ok {
		return nil, ErrInvalidSecret
	}
	key, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(key) < 24 || len(key) > 64 {
		return nil, ErrInvalidSecret
	}
	return key, nil
}

// Sign returns the Standard Webhooks v1 signature header value: HMAC-SHA256
// over webhook-id "." webhook-timestamp "." raw body, base64 encoded.
func Sign(key []byte, id, timestamp string, body []byte) string {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(id))
	mac.Write([]byte{'.'})
	mac.Write([]byte(timestamp))
	mac.Write([]byte{'.'})
	mac.Write(body)
	return "v1," + base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

```

### Core Architecture Module: `internal/transport/httpapi/strict_core.go`
```
package httpapi

import (
	"context"
	"net/http"

	"github.com/The-Vibe-Company/quivr/internal/publicerr"
	transport "github.com/The-Vibe-Company/quivr/internal/transport/generated"
)

func (a *API) ListCorpora(ctx context.Context, in transport.ListCorporaRequestObject) (transport.ListCorporaResponseObject, error) {
	return transport.ListCorporaResponseFunc(func(w http.ResponseWriter) { a.list(w, in.HTTPRequest, requestScope(ctx)) }), nil
}
func (a *API) CreateCorpus(ctx context.Context, in transport.CreateCorpusRequestObject) (transport.CreateCorpusResponseObject, error) {
	return transport.CreateCorpusResponseFunc(func(w http.ResponseWriter) { a.create(w, in.HTTPRequest, requestScope(ctx)) }), nil
}
func (a *API) GetCorpus(ctx context.Context, in transport.GetCorpusRequestObject) (transport.GetCorpusResponseObject, error) {
	return transport.GetCorpusResponseFunc(func(w http.ResponseWriter) {
		c, err := a.Service.Read(ctx, requestScope(ctx), in.CorpusId)
		if err != nil {
			writeError(w, err, publicerr.StorageUnavailable)
		} else {
			send(w, 200, c)
		}
	}), nil
}
func (a *API) SearchRecords(ctx context.Context, in transport.SearchRecordsRequestObject) (transport.SearchRecordsResponseObject, error) {
	return transport.SearchRecordsResponseFunc(func(w http.ResponseWriter) { a.search(w, in.HTTPRequest, requestScope(ctx)) }), nil
}
func (a *API) ListSearchProfiles(ctx context.Context, in transport.ListSearchProfilesRequestObject) (transport.ListSearchProfilesResponseObject, error) {
	return transport.ListSearchProfilesResponseFunc(func(w http.ResponseWriter) { a.searchProfiles(w, requestScope(ctx)) }), nil
}
func (a *API) PollChanges(ctx context.Context, in transport.PollChangesRequestObject) (transport.PollChangesResponseObject, error) {
	return transport.PollChangesResponseFunc(func(w http.ResponseWriter) { a.pollChanges(w, in.HTTPRequest, requestScope(ctx)) }), nil
}
func (a *API) StreamChanges(ctx context.Context, in transport.StreamChangesRequestObject) (transport.StreamChangesResponseObject, error) {
	return transport.StreamChangesResponseFunc(func(w http.ResponseWriter) { a.streamChanges(w, in.HTTPRequest, requestScope(ctx)) }), nil
}
func (a *API) ListVectorSpaces(ctx context.Context, in transport.ListVectorSpacesRequestObject) (transport.ListVectorSpacesResponseObject, error) {
	return transport.ListVectorSpacesResponseFunc(func(w http.ResponseWriter) {
		if in.CorpusId == "" {
			writeError(w, publicerr.NotFound, nil)
			return
		}
		a.listVectorSpaces(w, in.HTTPRequest, requestScope(ctx), in.CorpusId)
	}), nil
}
func (a *API) RelayConnectorChallenge(ctx context.Context, in transport.RelayConnectorChallengeRequestObject) (transport.RelayConnectorChallengeResponseObject, error) {
	return transport.RelayConnectorChallengeResponseFunc(func(w http.ResponseWriter) { a.relayDelivery(w, in.HTTPRequest) }), nil
}
func (a *API) RelayConnectorDelivery(ctx context.Context, in transport.RelayConnectorDeliveryRequestObject) (transport.RelayConnectorDeliveryResponseObject, error) {
	return transport.RelayConnectorDeliveryResponseFunc(func(w http.ResponseWriter) { a.relayDelivery(w, in.HTTPRequest) }), nil
}

```

### Core Architecture Module: `internal/transport/httpapi/webhooks.go`
```
package httpapi

import (
	"context"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/The-Vibe-Company/quivr/internal/connectors"
	"github.com/The-Vibe-Company/quivr/internal/plugins"
	"github.com/The-Vibe-Company/quivr/internal/publicerr"
	transport "github.com/The-Vibe-Company/quivr/internal/transport/generated"
)

// WithRelay enables the public webhook routes of push Connector Instances.
func WithRelay(relay connectors.Relay) Option {
	return func(a *API) { a.Relay = &relay }
}

// relayTimeout bounds one relayed delivery: the plugin's answer (capped at 8
// s) and the ingestion of its items, within the server's write timeout.
const relayTimeout = 9 * time.Second

// hopByHop headers describe one connection, not the delivery, and Cookie is
// never relayed.
var hopByHop = map[string]bool{"connection": true, "keep-alive": true, "proxy-authenticate": true, "proxy-authorization": true,
	"proxy-connection": true, "te": true, "trailer": true, "transfer-encoding": true, "upgrade": true, "cookie": true}

var relayedHeaderName = regexp.MustCompile("^[a-z0-9!#$%&'*+.^_`|~-]{1,128}$")

// isWebhookRoute reports whether the path is a public webhook route, which
// is served without an API key.
func isWebhookRoute(path string) bool { return strings.HasPrefix(path, connectors.WebhookPath) }

// relayDelivery serves a public webhook route: the source authenticates to
// the connector plugin (a signature, a challenge), never with an API key.
// The request is bounded before any lookup, an unknown route is 404 before
// any plugin call, and the source gets the plugin's answer.
func (a *API) relayDelivery(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, connectors.WebhookPath)
	if a.Relay == nil || id == "" || strings.Contains(id, "/") {
		writeError(w, publicerr.NotFound, nil)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		w.Header().Set("Allow", "GET, POST")
		writeError(w, publicerr.MethodNotAllowed, nil)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, plugins.MaxRelayBodyBytes+1))
	if err != nil || len(body) > plugins.MaxRelayBodyBytes || len(r.URL.RawQuery) > 8192 {
		// The receive contract bounds the relayed body and query.
		writeError(w, publicerr.RequestTooLarge, nil)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), relayTimeout)
	defer cancel()
	answer, err := a.Relay.Deliver(ctx, id, connectors.Relayed{ClientIP: a.pushClientIP(r), IdempotencyKeys: r.Header.Values("Idempotency-Key"), Method: r.Method, Query: r.URL.RawQuery, Headers: relayedHeaders(r.Header), Body: body})
	if err != nil {
		writeError(w, err, publicerr.ConnectorsUnavailable)
		return
	}
	if answer.ErrorCode != "" {
		if answer.RetryAfter > 0 {
			w.Header().Set("Retry-After", strconv.Itoa(int(answer.RetryAfter/time.Second)))
		}
		err := answer.PublicError()
		if !answer.DeclaredAPI {
			err = &plainError{err: err, body: answer.Body, contentType: answer.ContentType}
		}
		writeError(w, err, nil)
		return
	}
	if answer.Receipts != nil {
		receipts := make([]transport.Receipt, 0, len(answer.Receipts))
		for _, receipt := range answer.Receipts {
			receipts = append(receipts, receiptToTransport(receipt))
		}
		send(w, 202, transport.ConnectorPushReceipts{Receipts: receipts})
		return
	}
	if answer.Allow != "" {
		w.Header().Set("Allow", answer.Allow)
		writeError(w, publicerr.MethodNotAllowed, nil)
		return
	}
	if answer.DeclaredAPI {
		w.Header().Set("Quivr-Response-Origin", "plugin")
	}
	if answer.ContentType != "" {
		w.Header().Set("Content-Type", answer.ContentType)
	} else if answer.Body != "" {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	}
	if answer.RetryAfter > 0 {
		w.Header().Set("Retry-After", strconv.Itoa(int(answer.RetryAfter/time.Second)))
	}
	w.WriteHeader(answer.Status)
	_, _ = io.WriteString(w, answer.Body)
}

// relayedHeaders lowercases header names and keeps the bounded set the
// receive contract admits: no hop-by-hop header or Cookie, at most
// MaxRelayHeaders names of MaxRelayHeaderValues values within
// MaxRelayHeaderBytes in total.
func relayedHeaders(h http.Header) map[string][]string {
	out := map[string][]string{}
	total := 0
	for name, values := range h {
		lower := strings.ToLower(name)
		if hopByHop[lower] || !relayedHeaderName.MatchString(lower) || len(out) >= plugins.MaxRelayHeaders {
			continue
		}
		for _, v := range values {
			if len(out[lower]) >= plugins.MaxRelayHeaderValues || len(v) > 8192 || total+len(lower)+len(v) > plugins.MaxRelayHeaderBytes {
				break
			}
			total += len(lower) + len(v)
			out[lower] = append(out[lower], v)
		}
		if len(out[lower]) == 0 {
			delete(out, lower)
		}
	}
	return out
}

```

### Core Architecture Module: `plugins/core-ingest/main.go`
```
// Command quivr-core-ingest is the first-party ingestion plugin (core.ingest):
// the token-window segmentation and multilingual E5-small embedding the engine
// ran itself before THE-777. It cuts body Parts into windows of the pinned
// tokenizer's tokens, embeds each window with the deployment's TEI and encodes
// queries the same way; see README.md.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"sync"
	"time"

	"github.com/The-Vibe-Company/quivr/sdks/go/quivrplugin"
)

// configuration is the pin configuration: where TEI answers and where the
// pinned tokenizer is.
type configuration struct {
	TEIURL    string          `json:"tei_url"`
	Tokenizer TokenizerConfig `json:"tokenizer"`
	// BatchSize is how many windows one TEI request carries; 1 when unset.
	BatchSize int `json:"batch_size,omitempty"`
}

// CallBudget is how long one segment_and_embed call keeps starting TEI
// requests before it answers the retryable embedding_incomplete: far within
// the manifest's timeout_ms, so a slow TEI makes a long Version take several
// calls instead of reaching the engine's deadline.
const CallBudget = 30 * time.Second

// backend is what one configuration needs: one tokenizer process, loaded once
// and kept for the life of the plugin, and the TEI client.
type backend struct {
	windows TokenWindows
	encoder Encoder
}

type ingester struct {
	mu       sync.Mutex
	backends map[string]*backend
	// vectors keeps the window vectors this process embedded, so a call the
	// engine retries resumes (Encoder.Passages).
	vectors VectorCache
	// budget is CallBudget; tests shorten it.
	budget time.Duration
}

func (i *ingester) backend(raw json.RawMessage) (*backend, error) {
	var c configuration
	if err := json.Unmarshal(raw, &c); err != nil {
		return nil, err
	}
	key, _ := json.Marshal(c)
	i.mu.Lock()
	defer i.mu.Unlock()
	if b, ok := i.backends[string(key)]; ok {
		return b, nil
	}
	b := &backend{windows: TokenWindows{Tokenizer: &Server{Config: c.Tokenizer}}, encoder: Encoder{Endpoint: c.TEIURL, Batch: c.BatchSize}}
	i.backends[string(key)] = b
	return b, nil
}

func (i *ingester) SegmentAndEmbed(ctx context.Context, req *quivrplugin.IngestRequest) ([]quivrplugin.Segment, error) {
	b, err := i.backend(req.Configuration)
	if err != nil {
		return nil, quivrplugin.TerminalIngestError("invalid_configuration", err.Error())
	}
	parts := make([]Part, len(req.Parts))
	for n, p := range req.Parts {
		parts[n] = Part{Key: p.Key, Role: p.Role, Text: p.Text}
	}
	windows, err := b.windows.Process(ctx, parts)
	var refusal *Refusal
	switch {
	case errors.As(err, &refusal):
		// The engine shows the code and message in the Version's diagnostic.
		return nil, quivrplugin.TerminalIngestError(refusal.Code, refusal.Message)
	case err != nil:
		return nil, quivrplugin.RetryableIngestError("tokenizer_unavailable", "the pinned tokenizer is unavailable")
	}
	var vectors [][]float32
	if len(req.Spaces) > 0 {
		inputs := make([]string, len(windows))
		for n, w := range windows {
			inputs[n] = w.Derivation.ModelInput
		}
		vectors, err = b.encoder.Passages(ctx, &i.vectors, inputs, i.budget)
		var incomplete *Incomplete
		switch {
		case errors.As(err, &incomplete):
			return nil, quivrplugin.RetryableIngestError("embedding_incomplete", incomplete.Error()+"; the next call resumes")
		case errors.Is(err, errRefused):
			return nil, quivrplugin.TerminalIngestError("inference_refused", "the embedding service refuses a window of this Version")
		case err != nil:
			return nil, quivrplugin.RetryableIngestError("inference_unavailable", "the embedding service is unavailable")
		}
	}
	segments := make([]quivrplugin.Segment, len(windows))
	for n, w := range windows {
		var provenance map[string]any
		raw, _ := json.Marshal(w.Derivation)
		_ = json.Unmarshal(raw, &provenance)
		spaces := map[string][]float32{}
		for _, space := range req.Spaces {
			spaces[space] = vectors[n]
		}
		segments[n] = quivrplugin.Segment{PartKey: w.PartKey, Start: w.Start, End: w.End, Vectors: spaces, Provenance: provenance}
	}
	return segments, nil
}

func (i *ingester) EmbedQuery(ctx context.Context, req *quivrplugin.QueryRequest) ([]float32, error) {
	b, err := i.backend(req.Configuration)
	if err != nil {
		return nil, quivrplugin.TerminalIngestError("invalid_configuration", err.Error())
	}
	query, err := b.windows.NormalizeQuery(ctx, req.Query.Text)
	switch {
	case errors.Is(err, errInvalidQuery):
		// The code and message the engine surfaces as 422 query_too_long.
		return nil, quivrplugin.TerminalIngestError("query_too_long", fmt.Sprintf("query exceeds %d tokens", Parameters.QueryTokens))
	case err != nil:
		return nil, quivrplugin.RetryableIngestError("tokenizer_unavailable", "the pinned tokenizer is unavailable")
	}
	vector, err := b.encoder.Embed(ctx, "query: "+query)
	if err != nil {
		return nil, quivrplugin.RetryableIngestError("inference_unavailable", "the embedding service is unavailable")
	}
	return vector, nil
}

func main() {
	plugin, err := quivrplugin.New("")
	if err == nil {
		err = plugin.Ingestion(&ingester{backends: map[string]*backend{}, budget: CallBudget})
	}
	if err == nil {
		m := plugin.Manifest()
		host, port := os.Getenv(quivrplugin.EnvHost), os.Getenv(quivrplugin.EnvPort)
		if host == "" {
			host = "127.0.0.1"
		}
		if port == "" {
			port = "8080"
		}
		// One startup line, so an operator sees the sidecar came up and what it serves.
		fmt.Fprintf(os.Stderr, "quivr-core-ingest: serving %s@%s (ingestion) on %s\n", m.ID, m.Version, net.JoinHostPort(host, port))
		err = plugin.Serve()
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "quivr-core-ingest:", err)
		os.Exit(1)
	}
}

```

### Core Architecture Module: `plugins/core-ingest/tei.go`
```
package main

import (
	"bytes"
	"container/list"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Encoder calls the deployment's pinned text-embeddings-inference (TEI)
// service. Batch is how many windows one request carries (1 when unset). The
// same TEI yields the same float32 vectors as the engine's one-input requests
// before THE-777, batched or not (parity_test.go holds both).
type Encoder struct {
	Endpoint string
	Batch    int
}

// MaxBatch is the most windows one TEI request may carry: 32 inputs of at
// most 512 tokens stay within TEI's default max_client_batch_size (32) and
// max_batch_tokens (16384).
const MaxBatch = 32

// Incomplete reports a call that used its time budget with windows left to
// embed. What it embedded is kept, so the next call resumes.
type Incomplete struct{ Embedded, Total int }

func (e *Incomplete) Error() string {
	return fmt.Sprintf("%d of %d windows embedded", e.Embedded, e.Total)
}

var (
	// errInvalidInput is an input the pinned profile refuses.
	errInvalidInput = errors.New("invalid inference input")
	// errRefused is an input TEI refuses (413 or 422): it refuses it again.
	errRefused = errors.New("inference refused")
)

// Embed encodes one input, checking the serving profile first: the query path.
func (e Encoder) Embed(ctx context.Context, input string) ([]float32, error) {
	if err := e.verifyProfile(ctx); err != nil {
		return nil, err
	}
	vectors, err := e.embed(ctx, []string{input})
	if err != nil {
		return nil, err
	}
	return vectors[0], nil
}

// embed encodes a batch of inputs in one request, without the profile check.
func (e Encoder) embed(ctx context.Context, inputs []string) ([][]float32, error) {
	for _, input := range inputs {
		if (!strings.HasPrefix(input, "passage: ") && !strings.HasPrefix(input, "query: ")) || len(input) > 2<<20 {
			return nil, errInvalidInput
		}
	}
	body, _ := json.Marshal(map[string]any{"inputs": inputs, "normalize": true, "truncate": false})
	req, err := http.NewRequestWithContext(ctx, "POST", strings.TrimRight(e.Endpoint, "/")+"/embed", bytes.NewReader(body))
	if err != nil {
		return nil, errors.New("inference configuration invalid")
	}
	req.Header.Set("Content-Type", "application/json")
	// Four seconds for one input, as before, and two more for each other one.
	timeout := time.Duration(2+2*len(inputs)) * time.Second
	res, err := (&http.Client{Timeout: timeout}).Do(req)
	if err != nil {
		return nil, errors.New("inference unavailable")
	}
	defer res.Body.Close()
	switch res.StatusCode {
	case http.StatusOK:
	case http.StatusRequestEntityTooLarge, http.StatusUnprocessableEntity:
		return nil, errRefused
	default:
		return nil, errors.New("inference request failed")
	}
	var vectors [][]float32
	if err = json.NewDecoder(io.LimitReader(res.Body, int64(32768*len(inputs)))).Decode(&vectors); err != nil || len(vectors) != len(inputs) {
		return nil, errors.New("inference response invalid")
	}
	for _, v := range vectors {
		if err = checkUnit(v); err != nil {
			return nil, errors.New("inference vector invalid")
		}
	}
	return vectors, nil
}

// checkUnit accepts the pinned model's vectors only: 384 finite values of unit norm.
func checkUnit(vector []float32) error {
	if len(vector) != 384 {
		return errInvalidInput
	}
	for _, x := range vector {
		if math.IsNaN(float64(x)) || math.IsInf(float64(x), 0) {
			return errInvalidInput
		}
	}
	norm := 0.0
	for _, x := range vector {
		norm += float64(x) * float64(x)
	}
	if math.Abs(math.Sqrt(norm)-1) > .001 {
		return errInvalidInput
	}
	return nil
}

// TEI cannot attest weight hashes over HTTP. Preparation verifies every mounted
// file, and this check rejects incompatible serving parameters at query time.
func (e Encoder) verifyProfile(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", strings.TrimRight(e.Endpoint, "/")+"/info", nil)
	if err != nil {
		return errors.New("inference configuration invalid")
	}
	res, err := (&http.Client{Timeout: time.Second}).Do(req)
	if err != nil {
		return errors.New("inference profile unavailable")
	}
	defer res.Body.Close()
	var info struct {
		Version      string `json:"version"`
		SHA          string `json:"sha"`
		DType        string `json:"model_dtype"`
		MaxInput     int    `json:"max_input_length"`
		AutoTruncate bool   `json:"auto_truncate"`
		ModelType    struct {
			Embedding struct {
				Pooling string `json:"pooling"`
			} `json:"embedding"`
		} `json:"model_type"`
	}
	if res.StatusCode != 200 || json.NewDecoder(io.LimitReader(res.Body, 8192)).Decode(&info) != nil {
		return errors.New("inference profile invalid")
	}
	if info.Version != "1.9.3" || info.SHA != "06670157fb6c1523482219bdb2d1660277d38088" || info.DType != "float32" || info.MaxInput != 512 || info.AutoTruncate || info.ModelType.Embedding.Pooling != "mean" {
		return errors.New("inference profile mismatch")
	}
	return nil
}

// Passages embeds the model inputs of a Version's windows. It keeps what it
// embedded, so a call that ends early resumes where it stopped instead of
// starting over (THE-810); before THE-777 the engine got the same effect by
// storing each window's vector as it went. It starts no new request once
// budget has passed, and answers *Incomplete: a long Version then finishes
// over a few calls that each end well within the engine's deadline, and a
// worker is never held by one Version for long. Each call makes one request
// at least.
func (e Encoder) Passages(ctx context.Context, cache *VectorCache, inputs []string, budget time.Duration) ([][]float32, error) {
	out := make([][]float32, len(inputs))
	var missing []int
	for i, input := range inputs {
		if v, ok := cache.get(e.Endpoint, input); ok {
			out[i] = v
		} else {
			missing = append(missing, i)
		}
	}
	if len(missing) == 0 {
		return out, nil
	}
	if err := e.verifyProfile(ctx); err != nil {
		return nil, err
	}
	size := min(max(e.Batch, 1), MaxBatch)
	started := time.Now()
	for start := 0; start < len(missing); start += size {
		if start > 0 && time.Since(started) >= budget {
			return nil, &Incomplete{Embedded: len(inputs) - len(missing) + start, Total: len(inputs)}
		}
		if err := e.batch(ctx, cache, inputs, missing[start:min(start+size, len(missing))], out); err != nil {
			return nil, err
		}
	}
	return out, nil
}

// batch embeds inputs[i] for each i of batch into out. A batch TEI refuses is
// split, so only an input it refuses alone is refused.
func (e Encoder) batch(ctx context.Context, cache *VectorCache, inputs []string, batch []int, out [][]float32) error {
	texts := make([]string, len(batch))
	for k, i := range batch {
		texts[k] = inputs[i]
	}
	vectors, err := e.embed(ctx, texts)
	if errors.Is(err, errRefused) && len(batch) > 1 {
		half := len(batch) / 2
		if err = e.batch(ctx, cache, inputs, batch[:half], out); err == nil {
			err = e.batch(ctx, cache, inputs, batch[half:], out)
		}
		return err
	}
	if err != nil {
		return err
	}
	for k, i := range batch {
		out[i] = vectors[k]
		cache.put(e.Endpoint, inputs[i], vectors[k])
	}
	return nil
}

// CachedVectors bounds the vectors a plugin process keeps: about 6 MB, sixteen
// Versions of the largest size (256 windows). The cache is per process: a
// retry that reaches another replica starts over.
const CachedVectors = 4096

// VectorCache keeps the most recently embedded window vectors of one plugin
// process, by TEI endpoint and model input. The pinned TEI answers the same
// vector for the same input, so a kept vector is the one TEI would answer.
type VectorCache struct {
	mu      sync.Mutex
	order   *list.List
	entries map[[32]byte]*list.Element
}

type cached struct {
	key    [32]byte
	vector []float32
}

func cacheKey(endpoint, input string) [32]byte {
	return sha256.Sum256([]byte(strings.TrimRight(endpoint, "/") + "\x00" + input))
}

func (c *VectorCache) get(endpoint, input string) ([]float32, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[cacheKey(endpoint, input)]
	if !ok {
		return nil, false
	}
	c.order.MoveToFront(e)
	return e.Value.(cached).vector, true
}

func (c *VectorCache) put(endpoint, input string, vector []float32) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.entries == nil {
		c.order, c.entries = list.New(), map[[32]byte]*list.Element{}
	}
	key := cacheKey(endpoint, input)
	if e, ok := c.entries[key]; ok {
		c.order.MoveToFront(e)
		return
	}
	c.entries[key] = c.order.PushFront(cached{key: key, vector: vector})
	if c.order.Len() > CachedVectors {
		oldest := c.order.Back()
		c.order.Remove(oldest)
		delete(c.entries, oldest.Value.(cached).key)
	}
}

```

### Core Architecture Module: `plugins/core-ingest/tokenizer.go`
```
package main

import (
	"bufio"
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"io"
	"os/exec"
	"sync"
	"time"
)

// serverSource is the pinned Hugging Face tokenizer helper: it checks the
// tokenizers version and the tokenizer.json digest, loads it once and answers
// one JSON request per line. Parity with the engine is held by parity_test.go.
//
//go:embed tokenizer.py
var serverSource string

var errUnavailable = errors.New("tokenizer unavailable")

const (
	defaultTimeout     = 10 * time.Second
	defaultMaxResponse = 16 << 20
)

// Server keeps one pinned tokenizer process alive and serializes requests to it
// (THE-675): loading the 17 MB tokenizer dominated every search when a process
// was started per call. A failed or timed-out process is replaced on the next call.
// Use a pointer; the zero value with a Config is ready to use.
type Server struct {
	Config TokenizerConfig

	// Overridable by tests.
	source      string
	timeout     time.Duration
	maxResponse int

	once   sync.Once
	slot   chan struct{} // holds the right to use proc
	proc   *serverProcess
	closed bool
	spawns int
}

type serverProcess struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout *bufio.Reader
}

type exchangeResult struct {
	encodings []Encoding
	err       error
}

func (s *Server) init() {
	s.once.Do(func() {
		s.slot = make(chan struct{}, 1)
		if s.source == "" {
			s.source = serverSource
		}
		if s.timeout == 0 {
			s.timeout = defaultTimeout
		}
		if s.maxResponse == 0 {
			s.maxResponse = defaultMaxResponse
		}
	})
}

func (s *Server) Encode(ctx context.Context, input []TokenInput) ([]Encoding, error) {
	b, err := request(input)
	if err != nil {
		return nil, err
	}
	s.init()
	select {
	case s.slot <- struct{}{}:
	case <-ctx.Done():
		return nil, errUnavailable
	}
	done := make(chan exchangeResult, 1)
	go func() {
		defer func() { <-s.slot }()
		encodings, err := s.exchange(b, len(input))
		done <- exchangeResult{encodings, err}
	}()
	// A cancelled caller returns at once; the exchange completes (or hits the hard
	// timeout) in the background so the warm process survives client disconnects.
	select {
	case r := <-done:
		return r.encodings, r.err
	case <-ctx.Done():
		return nil, errUnavailable
	}
}

// exchange runs while holding the slot.
func (s *Server) exchange(b []byte, items int) ([]Encoding, error) {
	if s.closed {
		return nil, errUnavailable
	}
	if s.proc == nil {
		p, err := s.start()
		if err != nil {
			return nil, errUnavailable
		}
		s.proc = p
	}
	p := s.proc
	line, err := s.roundTrip(p, append(b, '\n'))
	// Never include subprocess output in errors: it may contain source content.
	if err != nil {
		s.stop()
		return nil, errUnavailable
	}
	if bytes.Equal(line, []byte("null")) {
		return nil, errUnavailable
	}
	var encodings []Encoding
	if err = json.Unmarshal(line, &encodings); err != nil || len(encodings) != items {
		s.stop()
		return nil, errors.New("invalid tokenizer response")
	}
	return encodings, nil
}

func (s *Server) start() (*serverProcess, error) {
	s.spawns++
	cmd := exec.Command(s.Config.Python, "-c", s.source, s.Config.Model)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err = cmd.Start(); err != nil {
		return nil, err
	}
	p := &serverProcess{cmd: cmd, stdin: stdin, stdout: bufio.NewReaderSize(stdout, 64<<10)}
	line, err := s.roundTrip(p, nil)
	if err != nil || string(line) != "ready" {
		kill(p)
		return nil, errUnavailable
	}
	return p, nil
}

// roundTrip writes an optional request and reads one response line under the hard timeout.
func (s *Server) roundTrip(p *serverProcess, request []byte) ([]byte, error) {
	timer := time.AfterFunc(s.timeout, func() { _ = p.cmd.Process.Kill() })
	var line []byte
	var err error
	if request != nil {
		_, err = p.stdin.Write(request)
	}
	if err == nil {
		line, err = readLine(p.stdout, s.maxResponse)
	}
	if !timer.Stop() {
		return nil, errUnavailable
	}
	return line, err
}

func readLine(r *bufio.Reader, limit int) ([]byte, error) {
	var line []byte
	for {
		chunk, err := r.ReadSlice('\n')
		if len(line)+len(chunk) > limit+1 {
			return nil, errors.New("tokenizer response too large")
		}
		line = append(line, chunk...)
		if err == nil {
			return line[:len(line)-1], nil
		}
		if !errors.Is(err, bufio.ErrBufferFull) {
			return nil, err
		}
	}
}

func (s *Server) stop() {
	if s.proc != nil {
		kill(s.proc)
		s.proc = nil
	}
}

func kill(p *serverProcess) {
	_ = p.stdin.Close()
	_ = p.cmd.Process.Kill()
	_ = p.cmd.Wait()
}

// Close stops the tokenizer process after any in-flight request; later calls fail.
func (s *Server) Close() {
	s.init()
	s.slot <- struct{}{}
	defer func() { <-s.slot }()
	s.closed = true
	s.stop()
}

// TokenizerConfig names the Python interpreter that has the pinned tokenizers
// package and the pinned tokenizer.json (scripts/prepare_tokenizer.py).
type TokenizerConfig struct {
	Python string `json:"python"`
	Model  string `json:"model"`
}

// request applies the batch limits of the recipe.
func request(input []TokenInput) ([]byte, error) {
	if len(input) > 512 {
		return nil, limit("the Version makes %d tokenizer inputs; the recipe takes at most 512", len(input))
	}
	b, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	if len(b) > Parameters.MaxSerializedBatchBytes {
		return nil, limit("the text sent to the tokenizer is %d bytes; the recipe takes at most %d", len(b), Parameters.MaxSerializedBatchBytes)
	}
	rawBytes := 0
	for _, item := range input {
		rawBytes += len(item.Text)
	}
	if rawBytes > Parameters.MaxModelBatchBytes {
		return nil, limit("the text sent to the tokenizer is %d bytes; the recipe takes at most %d", rawBytes, Parameters.MaxModelBatchBytes)
	}
	return b, nil
}

```

### Core Architecture Module: `plugins/core-ingest/tokenizer.py`
```
"""Persistent pinned tokenizer of the core.ingest plugin. stdout is protocol JSON, never diagnostics or source logs.

Loads the pinned tokenizer once (checking the tokenizers version and the tokenizer.json digest): one
JSON request per stdin line, one JSON response per stdout line. The first line is "ready" once the
tokenizer is loaded. A request over the batch limits gets "null"; any framing problem ends the process.
"""
import hashlib, json, pathlib, sys
import tokenizers
from tokenizers import Tokenizer

TOKENIZERS_VERSION = '0.23.2'
TOKENIZER_SHA256 = '0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39'
MAX_REQUEST_BYTES = 4 * 1024 * 1024
MAX_ITEMS = 512
MAX_TEXT_BYTES = 2 * 1024 * 1024


def load(path):
    if tokenizers.__version__ != TOKENIZERS_VERSION: raise ValueError('tokenizer version mismatch')
    data = pathlib.Path(path).read_bytes()
    if hashlib.sha256(data).hexdigest() != TOKENIZER_SHA256: raise ValueError('tokenizer checksum mismatch')
    tokenizer = Tokenizer.from_str(data.decode('utf-8')); tokenizer.no_truncation(); tokenizer.no_padding()
    return tokenizer


def encode(tokenizer, request):
    if len(request) > MAX_ITEMS or sum(len(x['text'].encode('utf-8')) for x in request) > MAX_TEXT_BYTES: raise ValueError('tokenizer batch limit')
    result = []
    for item in request:
        encoded = tokenizer.encode(item['text'], add_special_tokens=item['special'])
        result.append(dict(tokens=len(encoded.ids), offsets=encoded.offsets))
    return result


def serve():
    tokenizer = load(sys.argv[1])
    stdin, stdout = sys.stdin.buffer, sys.stdout
    stdout.write('ready\n'); stdout.flush()
    while True:
        line = stdin.readline(MAX_REQUEST_BYTES + 2)
        if not line: return
        if not line.endswith(b'\n'): raise ValueError('tokenizer request framing')
        try:
            response = json.dumps(encode(tokenizer, json.loads(line)), ensure_ascii=True)
        except Exception:
            response = 'null'
        stdout.write(response + '\n'); stdout.flush()


try: serve()
except Exception:
    sys.stderr.write('tokenizer server failed\n'); sys.exit(1)

```

### Core Architecture Module: `plugins/core-ingest/windows.go`
```
package main

import (
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"
)

// The token-window segmentation that the engine ran before THE-777, moved here
// unchanged: body Parts are cut into windows of at most body_tokens tokens that
// prefer paragraph, line and sentence boundaries and overlap by overlap_tokens;
// each segment's model input is "passage: " followed by the title (capped at
// title_tokens) and the trimmed window. testdata/golden.json holds what the
// engine produced; parity_test.go holds this code to it.

//go:embed profile.json
var profile []byte

type profileParameters struct {
	BodyTokens              int `json:"body_tokens"`
	OverlapTokens           int `json:"overlap_tokens"`
	OverlapBacktrack        int `json:"overlap_backtrack"`
	MinimumBoundaryTokens   int `json:"minimum_boundary_tokens"`
	TitleTokens             int `json:"title_tokens"`
	QueryTokens             int `json:"query_tokens"`
	ModelTokens             int `json:"model_tokens"`
	MaxSourceBytes          int `json:"max_source_bytes"`
	MaxSegments             int `json:"max_segments"`
	MaxExcerptCodepoints    int `json:"max_excerpt_codepoints"`
	MaxModelBatchBytes      int `json:"max_model_batch_bytes"`
	MaxSerializedBatchBytes int `json:"max_serialized_batch_bytes"`
	MaxParts                int `json:"max_parts"`
	MaxQueryCodepoints      int `json:"max_query_codepoints"`
}

// Parameters are the pinned recipe values of profile.json.
var Parameters = func() profileParameters {
	var p profileParameters
	if err := json.Unmarshal(profile, &p); err != nil {
		panic(err)
	}
	return p
}()

// Refusal is content the recipe can never segment, with the code and plain
// message the plugin refuses the Version with, terminally: no title or body
// text to index (no_indexable_text), text that is not valid (invalid_text),
// or a limit of the recipe, which the message names (segmentation_limit).
type Refusal struct{ Code, Message string }

func (r *Refusal) Error() string { return r.Code + ": " + r.Message }

func limit(format string, args ...any) error {
	return &Refusal{Code: "segmentation_limit", Message: fmt.Sprintf(format, args...)}
}

var (
	errNoText      = &Refusal{Code: "no_indexable_text", Message: "the Version has no title or body text to index"}
	errInvalidText = &Refusal{Code: "invalid_text", Message: "a title or body Part is not valid UTF-8 or contains a NUL character"}
	errOffsets     = &Refusal{Code: "invalid_text", Message: "the tokenizer's offsets do not match a title or body Part"}
	errTwoTitles   = limit("the Version has more than one title Part; the recipe takes one")
	errCut         = limit("a body Part cannot be cut into overlapping windows of at most %d tokens", Parameters.BodyTokens)
)

func segmentsLimit() error {
	return limit("the Version makes more than %d segments", Parameters.MaxSegments)
}

func excerptLimit(n int) error {
	return limit("a segment excerpt is %d code points; the recipe takes at most %d", n, Parameters.MaxExcerptCodepoints)
}

// errInvalidQuery is a query the model cannot take without truncation.
var errInvalidQuery = errors.New("invalid query")

func validText(s string) bool { return utf8.ValidString(s) && !strings.ContainsRune(s, 0) }

func hash(b []byte) string { sum := sha256.Sum256(b); return hex.EncodeToString(sum[:]) }

// Part is one text Part of a Record Version.
type Part struct {
	Key, Role, Text string
}

// Derivation records how one segment was made; it is the segment's provenance.
type Derivation struct {
	Ordinal          int    `json:"ordinal"`
	UTF8Start        int    `json:"utf8_start"`
	UTF8End          int    `json:"utf8_end"`
	TokenStart       int    `json:"token_start"`
	TokenEnd         int    `json:"token_end"`
	Overlap          int    `json:"overlap_tokens"`
	HardStart        bool   `json:"hard_start"`
	HardEnd          bool   `json:"hard_end"`
	NormalizedSHA256 string `json:"normalized_content_sha256"`
	TitleFullSHA256  string `json:"full_title_sha256,omitempty"`
	TitleUsedSHA256  string `json:"title_used_sha256,omitempty"`
	TitleTokens      int    `json:"title_tokens"`
	TitleTruncated   bool   `json:"title_truncated"`
	ModelInput       string `json:"-"`
	ModelInputSHA256 string `json:"model_input_sha256"`
	ModelTokens      int    `json:"model_tokens"`
}

// Window is one segment: code point offsets into its Part and its derivation.
type Window struct {
	PartKey    string
	Start, End int
	Derivation Derivation
}

type TokenInput struct {
	Text    string `json:"text"`
	Special bool   `json:"special"`
}
type Encoding struct {
	Tokens  int      `json:"tokens"`
	Offsets [][2]int `json:"offsets"`
}
type Tokenizer interface {
	Encode(context.Context, []TokenInput) ([]Encoding, error)
}
type TokenWindows struct{ Tokenizer Tokenizer }

func (p TokenWindows) NormalizeQuery(ctx context.Context, q string) (string, error) {
	if !validText(q) || utf8.RuneCountInString(q) > Parameters.MaxQueryCodepoints {
		return "", errInvalidQuery
	}
	q = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(q, "\r\n", "\n"), "\r", "\n"))
	if q == "" {
		return "", errInvalidQuery
	}
	e, err := p.Tokenizer.Encode(ctx, []TokenInput{{Text: q}, {Text: "query: " + q, Special: true}})
	if err != nil {
		return "", err
	}
	if e[0].Tokens > Parameters.QueryTokens || e[1].Tokens > Parameters.ModelTokens {
		return "", errInvalidQuery
	}
	return q, nil
}

func (p TokenWindows) Process(ctx context.Context, parts []Part) ([]Window, error) {
	var out []Window
	// Only explicit title/body text Parts contribute normalized text. Blob Parts
	// and other roles stay in the immutable Manifest without extraction.
	type source struct {
		part  Part
		input TokenInput
	}
	sources := []source{}
	total, bodies := 0, 0
	titleSlot := -1
	for _, part := range parts {
		if part.Role != "title" && part.Role != "body" {
			continue
		}
		if !validText(part.Text) {
			return out, errInvalidText
		}
		total += len(part.Text)
		if part.Role == "title" {
			if titleSlot >= 0 {
				return out, errTwoTitles
			}
			titleSlot = len(sources)
		}
		inputText := part.Text
		if part.Role == "title" {
			inputText = strings.TrimSpace(inputText)
		} else {
			bodies++
		}
		sources = append(sources, source{part: part, input: TokenInput{Text: inputText}})
	}
	switch {
	case len(sources) == 0:
		return out, errNoText
	case total > Parameters.MaxSourceBytes:
		return out, limit("the title and body text is %d bytes; the recipe takes at most %d", total, Parameters.MaxSourceBytes)
	case len(sources) > Parameters.MaxParts:
		return out, limit("the Version has %d title and body Parts; the recipe takes at most %d", len(sources), Parameters.MaxParts)
	}
	inputs := make([]TokenInput, len(sources))
	for i, s := range sources {
		inputs[i] = s.input
	}
	enc, err := p.Tokenizer.Encode(ctx, inputs)
	if err != nil {
		return out, err
	}
	for i, e := range enc {
		if !validOffsets([]rune(inputs[i].Text), e) {
			return out, errOffsets
		}
	}
	title, titleUsed := "", ""
	titleTokens := 0
	truncated := false
	if titleSlot >= 0 {
		part := sources[titleSlot].part
		title = part.Text
		titleUsed = strings.TrimSpace(title)
		titleTokens = enc[titleSlot].Tokens
		if titleTokens > Parameters.TitleTokens {
			cut := Parameters.TitleTokens
			offsets := enc[titleSlot].Offsets
			for cut > 0 && offsets[cut-1][1] > offsets[cut][0] {
				cut--
			}
			if cut == 0 {
				return out, limit("the title cannot be cut at a token boundary within %d tokens", Parameters.TitleTokens)
			}
			titleUsed = strings.TrimSpace(string([]rune(titleUsed)[:offsets[cut-1][1]]))
			titleTokens = cut
			truncated = true
		}
	}
	for i, s := range sources {
		if s.part.Role == "title" {
			continue
		}
		part := s.part
		runes := []rune(part.Text)
		tokens := enc[i]
		spans, err := windows(runes, tokens)
		if err != nil {
			return out, err
		}
		if len(spans) == 0 && title != "" {
			spans = []span{{}}
		}
		for _, w := range spans {
			raw := string(runes[w.start:w.end])
			if n := utf8.RuneCountInString(raw); n > Parameters.MaxExcerptCodepoints {
				return out, excerptLimit(n)
			}
			modelInput := "passage: " + strings.TrimSpace(raw)
			if titleUsed != "" {
				modelInput = "passage: " + titleUsed
				if strings.TrimSpace(raw) != "" {
					modelInput += "\n\n" + strings.TrimSpace(raw)
				}
			}
			d := Derivation{Ordinal: len(out), UTF8Start: len(string(runes[:w.start])), UTF8End: len(string(runes[:w.end])), TokenStart: w.first, TokenEnd: w.last, Overlap: w.overlap, HardStart: w.hardStart, HardEnd: w.hardEnd, NormalizedSHA256: hash([]byte(part.Text)), ModelInput: modelInput, ModelInputSHA256: hash([]byte(modelInput)), TitleTokens: titleTokens, TitleTruncated: truncated}
			if title != "" {
				d.TitleFullSHA256 = hash([]byte(title))
				d.TitleUsedSHA256 = hash([]byte(titleUsed))
			}
			out = append(out, Window{PartKey: part.Key, Start: w.start, End: w.end, Derivation: d})
			if len(out) > Parameters.MaxSegments {
				return out, segmentsLimit()
			}
		}
	}
	// A title with no body Part, such as a feed item without a description,
	// is its own segment: the whole title Part, embedded as the title alone.
	// The recipe refused it before (THE-815); every Version it accepted keeps
	// the same segments.
	if bodies == 0 && titleUsed != "" {
		part := sources[titleSlot].part
		runes := []rune(part.Text)
		if len(runes) > Parameters.MaxExcerptCodepoints {
			return out, excerptLimit(len(runes))
		}
		modelInput := "passage: " + titleUsed
		d := Derivation{UTF8End: len(part.Text), TokenEnd: enc[titleSlot].Tokens, NormalizedSHA256: hash([]byte(part.Text)), ModelInput: modelInput, ModelInputSHA256: hash([]byte(modelInput)),
			TitleFullSHA256: hash([]byte(title)), TitleUsedSHA256: hash([]byte(titleUsed)), TitleTokens: titleTokens, TitleTruncated: truncated}
		out = append(out, Window{PartKey: part.Key, End: len(runes), Derivation: d})
	}
	if len(out) == 0 {
		return out, errNoText
	}
	modelInputs := make([]To
```

### Core Architecture Module: `plugins/core-retrieve/main.go`
```
// Command quivr-core-retrieve is the first-party retrieval plugin
// (core.retrieve): the search the engine ran itself before THE-779. It asks
// the engine for one candidate list that follows the search mode, and returns
// that list as the ranking; see README.md.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"sort"

	"github.com/The-Vibe-Company/quivr/sdks/go/quivrplugin"
)

// alpha weights the vector side of a hybrid search; relative score fusion
// normalizes each side's scores before weighting them.
const alpha = 0.5

// configuration is validated by the manifest schema at install and by the
// SDK on each invocation. Defaults are applied here, not by JSON Schema.
type configuration struct {
	DenseWeight    float64 `json:"dense_weight"`
	CandidateCount int     `json:"candidate_count"`
	HybridFusion   string  `json:"hybrid_fusion"`
}

type retriever struct{}

func (retriever) Search(_ context.Context, req *quivrplugin.SearchRequest) (*quivrplugin.SearchAnswer, error) {
	pending := []quivrplugin.SearchSpace{}
	if req.Query.Mode != "lexical" {
		requested := map[string]bool{}
		for _, served := range req.Served {
			requested[served.Request.Space] = true
		}
		for _, space := range req.Spaces {
			if space.Role == "served" && !requested[space.ID] {
				pending = append(pending, space)
			}
		}
	}
	if req.Round == 1 || len(pending) > 0 {
		c, err := request(req)
		if err != nil {
			return nil, err
		}
		requests := []quivrplugin.CandidateRequest{c}
		if req.Query.Mode != "lexical" {
			requests = nil
			for _, space := range pending[:min(8, len(pending))] {
				next := c
				next.Space = space.ID
				requests = append(requests, next)
			}
		}
		return quivrplugin.Ask(requests...), nil
	}
	// The served order is the ranking: the index ranked it, and the engine
	// kept each segment's first object, as the engine's own search did.
	hits := []quivrplugin.RankedHit{}
	for _, s := range req.Served {
		explanation := explain(s.Request)
		for _, c := range s.Candidates {
			hits = append(hits, quivrplugin.RankedHit{SegmentID: c.SegmentID, Score: c.Score, Explanation: explanation})
		}
	}
	// The index returns candidates of equal score in the order their objects
	// were written, which enrichment and rebuilds change: equal scores rank by
	// segment id, so the same search over the same Records ranks the same way.
	sort.SliceStable(hits, func(i, j int) bool {
		if hits[i].Score != hits[j].Score {
			return hits[i].Score > hits[j].Score
		}
		return hits[i].SegmentID < hits[j].SegmentID
	})
	unique := hits[:0]
	seen := map[string]bool{}
	for _, h := range hits {
		if !seen[h.SegmentID] {
			seen[h.SegmentID] = true
			unique = append(unique, h)
		}
	}
	return quivrplugin.Rank(unique[:min(len(unique), req.Limit)]...), nil
}

// request is the one candidate request of a search: keywords on the title
// and body for lexical, the served space for semantic, both for hybrid.
func request(req *quivrplugin.SearchRequest) (quivrplugin.CandidateRequest, error) {
	config := configuration{DenseWeight: alpha, CandidateCount: req.Limit, HybridFusion: "relative_score"}
	if len(req.Configuration) > 0 {
		if err := json.Unmarshal(req.Configuration, &config); err != nil {
			return quivrplugin.CandidateRequest{}, quivrplugin.TerminalSearchError("invalid_configuration", err.Error())
		}
	}
	c := quivrplugin.CandidateRequest{QueryText: req.Query.Text, K: config.CandidateCount}
	if req.Query.Mode == "lexical" {
		c.Primitive, c.Field = quivrplugin.PrimitiveBM25, quivrplugin.FieldSource
		return c, nil
	}
	space := req.ServedSpace()
	if space == nil {
		return c, quivrplugin.TerminalSearchError("no_served_space", "the searched Corpora serve no vector space; search by keywords, or rebuild them")
	}
	c.Space = space.ID
	if req.Query.Mode == "semantic" {
		c.Primitive = quivrplugin.PrimitiveNearVector
		return c, nil
	}
	c.Primitive, c.Field, c.Alpha, c.Fusion = quivrplugin.PrimitiveHybrid, quivrplugin.FieldSource, &config.DenseWeight, config.HybridFusion
	return c, nil
}

func explain(c quivrplugin.CandidateRequest) string {
	switch c.Primitive {
	case quivrplugin.PrimitiveBM25:
		return "keywords"
	case quivrplugin.PrimitiveNearVector:
		return "vectors in " + c.Space
	}
	weight := alpha
	if c.Alpha != nil {
		weight = *c.Alpha
	}
	fusion := "relative score fusion"
	if c.Fusion == "ranked" {
		fusion = "ranked fusion (RRF)"
	}
	return fmt.Sprintf("keywords and vectors in %s, alpha %g, %s", c.Space, weight, fusion)
}

func main() {
	plugin, err := quivrplugin.New("")
	if err == nil {
		err = plugin.Retrieval(retriever{})
	}
	if err == nil {
		m := plugin.Manifest()
		host, port := os.Getenv(quivrplugin.EnvHost), os.Getenv(quivrplugin.EnvPort)
		if host == "" {
			host = "127.0.0.1"
		}
		if port == "" {
			port = "8080"
		}
		// One startup line, so an operator sees the sidecar came up and what it serves.
		fmt.Fprintf(os.Stderr, "quivr-core-retrieve: serving %s@%s (retrieval) on %s\n", m.ID, m.Version, net.JoinHostPort(host, port))
		err = plugin.Serve()
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "quivr-core-retrieve:", err)
		os.Exit(1)
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3691** (2026-09-29): **[Security] RCE via Pickle Deserialization in Brain.load()**
  *Symptoms*: brain.py:190 uses FAISS.load_local() with allow_dangerous_deserialization=True. Any brain directory with a crafted index.pkl gives arbitrary code execution when loaded via Brain.load().  Attack vector: shared brain files via HuggingFace Hub, GitHub, email.  PoC: create brain dir with malicious pickle in index.pkl, victim calls Brain.load(path) = RCE.  Fix: remove allow_dangerous_deserialization=True or use FAISS native format instead of pickle.
  **Post-Mortem & Fix Analysis**:
  > Thanks for your contributions, we'll be closing this issue as it has gone stale. Feel free to reopen if you'd like to continue the discussion.

- **Issue #3654** (2025-12-10): **The garbage collector is trying to clean up non-checked-in connection <AdaptedConnection <asyncpg.connection.Connection object at 0x7f66a5b06110>>, which will be terminated.  Please ensure that SQLAlchemy pooled connections are returned to the pool expl...**
  *Symptoms*: Sentry Issue: [PYTHON-FASTAPI-1VP](https://quivr-brain.sentry.io/issues/6996552839/?referrer=github_integration)  ``` The garbage collector is trying to clean up non-checked-in connection <AdaptedConnection <asyncpg.connection.Connection object at 0x7f66a5b06110>>, which will be terminated.  Please ensure that SQLAlchemy pooled connections are returned to the pool explicitly, either by calling ``close()`` or by using appropriate context managers to manage their lifecycle. ```

- **Issue #3650** (2025-12-12): **[Bug]: RuntimeError: There is no current event loop in thread 'MainThread' when using Brain.from_files() in script**
  *Symptoms*: ### What happened?  I tried following the quick-start guide, on a brand new system. I'm running a minimal test of quivr-core and encountering a runtime error related to the asyncio event loop when calling `Brain.from_files()` inside a simple script.  This happens with Python 3.12, but I’m not sure if it’s a version compatibility issue or something else related to how event loops are handled.  Here’s a minimal reproducible example, which is exactly the content of the quick-start:  ``` import tempfile from quivr_core import Brain  if __name__ == "__main__":     with tempfile.NamedTemporaryFile(mode="w", suffix=".txt") as temp_file:         temp_file.write("Gold is a liquid of blue-like colour.")         temp_file.flush()          brain = Brain.from_files(             name="test_brain",             file_paths=[temp_file.name],         )          answer = brain.ask("what is gold? answer in french")         print("answer:", answer) ```  and here's the error this gives:   ``` RuntimeError: There is no current event loop in thread 'MainThread'. ```  ### Relevant log output  ```bash Full traceback excerpt:   File ".../brain.py", line 383, in Brain.from_files     loop = asyncio.get_event_loop() RuntimeError: There is no current event loop in thread 'MainThread'.    Environment: Python version: 3.12.3 OS: Linux quivr-core version: latest from PyPI Installed via: pip ```  ### Twitter / LinkedIn details  _No response_
  **Post-Mortem & Fix Analysis**:
  > <!-- Greeting --> Hi @nsheff! I'm [Dosu](https://go.dosu.dev/dosubot) and I’m helping the quivr team.  <!-- Answer --> This error happens because Python 3.12 changed how asyncio event loops are managed: asyncio.get_event_loop() now raises a RuntimeError if no event loop is set in the current context, which is the case for fresh scripts like yours. The current Brain.from_files() implementation assumes an event loop is always available, which isn't true on Python 3.12+ scripts and causes this crash [see source](https://github.com/QuivrHQ/quivr/blob/947a785415c6c35ab2ae8157222b4720b0710b4d/core/quivr_core/brain/brain.py).  A quick workaround is to create and set an event loop before calling Brain.from_files(). You can add this before your call:  ```python import asyncio  try:     asyncio.get_running_loop() except RuntimeError:     loop = asyncio.new_event_loop()     asyncio.set_event_loop(loop) ```  Or, as a more robust solution, you can use the async version directly:  ```python import a
  > ### Brain.from_files() (sync wrapper) raises asyncio event-loop errors on Python 3.11+ / 3.12 — make sync wrapper robust  **Description** **Brain.from_files()** (and similar synchronous wrappers) call the async implementation internally and attempt to run it synchronously. On newer Python versions and in environments with a running event loop (REPLs, Jupyter, or frameworks), this causes errors such as:  - RuntimeError: asyncio.run() cannot be called from a running event loop - RuntimeError: There is no current event loop in thread 'MainThread'  This breaks the quick-start example on fresh installs and on Python ≥ 3.11/3.12 in several common environments.  **Minimal repro**  **from quivr_core import Brain**  if __name__ == "__main__":     brain = Brain.from_files(name="test_brain", file_paths=["example.txt"])     answer = brain.ask("what is gold? answer in french")     print(answer)   **Proposed change**  - Introduce a small helper used by sync wrappers to execute internal coroutines sa
  > Thanks for your contributions, we'll be closing this issue as it has gone stale. Feel free to reopen if you'd like to continue the discussion.

- **Issue #3623** (2025-04-18): **[Bug]: Doc Update**
  *Symptoms*: ### What happened?  Tried to install with python 3.10.6 and package was not found in pypi.  Maybe update docs as "Python 3.10 and newer" is not accurate.  Also tried to use Python 3.13 and ran into issues with numpy dependency.  I am using Python 3.11.5 now and it downloaded successfully.  ### Relevant log output  ```bash  ```  ### Twitter / LinkedIn details  _No response_
  **Post-Mortem & Fix Analysis**:
  > <!-- Greeting --> Hey there, @pAulseperformance! I'm here to help you with any bugs, questions, or contributions you might have. Let's get this sorted out together!  <!-- Answer --> The documentation should indeed be updated to reflect the correct Python version requirements. The package requires at least Python 3.11.9, not 3.10 as currently stated in the documentation <sup>[[1]](https://github.com/QuivrHQ/quivr/blob/main/docs/.python-version)</sup><sup>[[2]](https://github.com/QuivrHQ/quivr/blob/main/backend/requirements.txt)</sup><sup>[[3]](https://github.com/QuivrHQ/quivr/blob/main/core/.python-version)</sup><sup>[[4]](https://github.com/QuivrHQ/quivr/blob/main/core/pyproject.toml)</sup><sup>[[5]](https://github.com/QuivrHQ/quivr/blob/main/examples/simple_question/.python-version)</sup>. Additionally, the numpy dependency is specified as `numpy==1.26.4` for Python versions `>= '3.9'`, which might be causing issues with Python 3.13 <sup>[[2]](https://github.com/QuivrHQ/quivr/blob/mai

- **Issue #3617** (2025-03-21): **[Bug]: Can't install library on Windows**
  *Symptoms*: ### What happened?  (.venv) PS C:\quivr-main> pip install quivr-core Collecting quivr-core   Using cached quivr_core-0.0.26-py3-none-any.whl.metadata (1.0 kB) Collecting aiofiles>=23.1.0 (from quivr-core)   Using cached aiofiles-24.1.0-py3-none-any.whl.metadata (10 kB) Collecting faiss-cpu>=1.8.0.post1 (from quivr-core)   Using cached faiss_cpu-1.10.0-cp312-cp312-win_amd64.whl.metadata (4.5 kB) Collecting httpx>=0.27.0 (from quivr-core)   Using cached httpx-0.28.1-py3-none-any.whl.metadata (7.1 kB) Collecting langchain-anthropic>=0.1.23 (from quivr-core)   Using cached langchain_anthropic-0.3.10-py3-none-any.whl.metadata (1.9 kB) Collecting langchain-cohere>=0.1.0 (from quivr-core)   Using cached langchain_cohere-0.4.3-py3-none-any.whl.metadata (6.6 kB) Collecting langchain-community>=0.2.12 (from quivr-core)   Using cached langchain_community-0.3.20-py3-none-any.whl.metadata (2.4 kB) Collecting langchain-core>=0.2.38 (from quivr-core)   Using cached langchain_core-0.3.47-py3-none-any.whl.metadata (5.9 kB) Collecting langchain-openai>=0.1.0 (from quivr-core)   Using cached langchain_openai-0.3.9-py3-none-any.whl.metadata (2.3 kB) Collecting langchain<0.3.0,>=0.2.14 (from quivr-core)   Using cached langchain-0.2.17-py3-none-any.whl.metadata (7.1 kB) Collecting langgraph>=0.2.38 (from quivr-core)   Using cached langgraph-0.3.18-py3-none-any.whl.metadata (7.5 kB) Collecting markupsafe>=2.1.5 (from quivr-core)   Using cached MarkupSafe-3.0.2-cp312-cp312-win_amd64.whl.metadata (4.
  **Post-Mortem & Fix Analysis**:
  > <p><a href="https://linear.app/getquivr/issue/CORE-371/[bug]-cant-insatll-lib-on-windows">CORE-371 [Bug]: Can't insatll lib on Windows</a></p>
  > <!-- Greeting --> Hey @AlbaRuth, I'm here to assist you with any bugs, questions, or contributions while you wait for a human maintainer. Let's tackle this together!  <!-- Answer --> I found a similar open issue regarding the installation problem on Windows due to `uvloop` not supporting the platform. You can check the details of this issue [here](https://github.com/QuivrHQ/quivr/issues/3616). Unfortunately, no solution has been found in the comments of that issue <sup>[[1]](https://github.com/QuivrHQ/quivr/issues/3616)</sup>.  Since `uvloop` is not listed as a required dependency in the setup configuration of the `quivr-core` package, you might try to exclude it from the installation if possible <sup>[[2]](https://github.com/QuivrHQ/quivr/blob/main/backend/requirements.txt)</sup><sup>[[3]](https://github.com/QuivrHQ/quivr/blob/main/core/pyproject.toml)</sup>. Alternatively, you could look for a way to install `quivr-core` without the optional dependencies that require `uvloop`.   <!--

- **Issue #3616** (2025-04-18): **[Bug]: stopped installing quivr-core due to (error: subprocess-exited-with-error)**
  *Symptoms*: ### What happened?  Dear All  Thanks a lot for this amazing application.  kindly not that a bug happened running on windows while installing quivr after entering this `pip install quivr-core # Check that the installation worked`, the following stopped me   ``` Collecting uvloop>=0.18.0 (from megaparse==0.0.43->megaparse[all]==0.0.43->quivr-core)   Using cached uvloop-0.21.0.tar.gz (2.5 MB)   Installing build dependencies ... done   Getting requirements to build wheel ... error   error: subprocess-exited-with-error    × Getting requirements to build wheel did not run successfully.   │ exit code: 1   ╰─> [20 lines of output]       Traceback (most recent call last):         File "C:\Users\ai\.conda\envs\quivr\Lib\site-packages\pip\_vendor\pyproject_hooks\_in_process\_in_process.py", line 389, in <module>           main()           ~~~~^^         File "C:\Users\ai\.conda\envs\quivr\Lib\site-packages\pip\_vendor\pyproject_hooks\_in_process\_in_process.py", line 373, in main           json_out["return_val"] = hook(**hook_input["kwargs"])                                    ~~~~^^^^^^^^^^^^^^^^^^^^^^^^         File "C:\Users\ai\.conda\envs\quivr\Lib\site-packages\pip\_vendor\pyproject_hooks\_in_process\_in_process.py", line 143, in get_requires_for_build_wheel           return hook(config_settings)         File "C:\Users\ai\AppData\Local\Temp\pip-build-env-uofmz46i\overlay\Lib\site-packages\setuptools\build_meta.py", line 334, in get_requires_for_build_wheel           return self._ge
  **Post-Mortem & Fix Analysis**:
  > <p><a href="https://linear.app/getquivr/issue/CORE-370/[bug]-stopped-installing-quivr-core-due-to-error-subprocess-exited">CORE-370 [Bug]: stopped installing quivr-core due to (error: subprocess-exited-with-error)</a></p>

- **Issue #3582** (2025-02-05): **[Bug]:  Test Jacopo**
  *Symptoms*: ### What happened?  A bug happened!  ### Relevant log output  ```bash Tootot ```  ### Twitter / LinkedIn details  _No response_
  **Post-Mortem & Fix Analysis**:
  > <p><a href="https://linear.app/getquivr/issue/ENT-549/[bug]-test-jacopo">ENT-549 [Bug]: Test Jacopo</a></p>

- **Issue #3570** (2025-01-29): **Fix error on Hugging Face CRAG dataset**
  *Symptoms*: We are observing the error below on certain subsets of CRAG, the reason being that the alt_ans field can sometimes contain an empty list (which apparently is interpreted as a number) or a list of strings. This prevents us from visualizing the dataset on the platform, but also to retrieve using `import load_dataset from dataset`  ``` Cannot load the dataset split (in streaming mode) to extract the first rows. Error code:   StreamingRowsError Exception:    ArrowInvalid Message:      JSON parse error: Column(/alt_ans/[]) changed from number to string in row 7 Traceback:    Traceback (most recent call last):                 File "/src/services/worker/.venv/lib/python3.9/site-packages/datasets/packaged_modules/json/json.py", line 160, in _generate_tables                   df = pandas_read_json(f)                 File "/src/services/worker/.venv/lib/python3.9/site-packages/datasets/packaged_modules/json/json.py", line 38, in pandas_read_json                   return pd.read_json(path_or_buf, **kwargs)                 File "/src/services/worker/.venv/lib/python3.9/site-packages/pandas/io/json/_json.py", line 815, in read_json                   return json_reader.read()                 File "/src/services/worker/.venv/lib/python3.9/site-packages/pandas/io/json/_json.py", line 1025, in read                   obj = self._get_object_parser(self.data)                 File "/src/services/worker/.venv/lib/python3.9/site-packages/pandas/io/json/_json.py", line 1051, in _get_object_parser   
  **Post-Mortem & Fix Analysis**:
  > <p><a href="https://linear.app/getquivr/issue/CORE-347/fix-error-on-hugging-face-crag-dataset">CORE-347 Fix error on Hugging Face CRAG dataset</a></p>

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

### Incident Patch 1: `f786b80b` (2026-10-06)
**Commit Message**: fix(eval): overlap campaign quality and isolate latency (#3763)

Campaign trials held one lease across indexing, quality and fresh
latency, so the configured parallelism could not take effect. Trials now
prepare and score concurrently within bounded SQL trial slots, while
only paired fresh warmups and latency samples hold an exclusive campaign
window.

- Fence compute intents/reservations on trial ownership and fresh
provider admission on latency ownership. Preserve uncertain detached
work, skip outage cleanup, and expire orphan windows safely.
- Share Azure/Cohere request admission, adaptive 429 feedback and
cooldown across containers. SQL and limiter waits remain outside service
latency; phase diagnostics include window wait time.
- Wait for shared embedding-cache fills within the invocation bound,
release partial unstarted claims before retrying, and reload committed
Volume files for reuse.
- Fence slot allocation on transport admission before committing; retain
provider permits for the complete bounded Modal invocation lifetime, and
account overlapping HTTP reads independently.
- Use owner-fenced UPDATE cleanup within the documented SQL role grants;
preserve reranker outage exc

**File**: `docs-site/run-quivr/run-search-campaign.mdx` (modified, +5/-2)
```diff
@@ -76,8 +76,11 @@ include uncertain charges; Modal builds/storage and other account charges need
 separate budgeting. No measurements run in CI.
 
 Each dataset compares baseline and candidate in one container, alternating fresh
-queries after both indexes are ready. A campaign-wide slot serializes measurement,
-including preparation; busy trials wait for a later supervisor pass before paid dispatch.
+queries after both indexes and quality scores are ready. Up to `parallelism` trials
+prepare, index and score quality concurrently. Only paired fresh warmups and latency
+samples wait for an exclusive campaign-wide window; other trials continue quality work.
+Azure/Cohere requests share an adaptive limiter and 429 cooldown across containers.
+Busy trial slots wait for a later supervisor pass before paid dispatch.
 The latency gate measures local search work plus successful provider round trips.
 Retry HTTP, backoff, admission and ledger waits appear separately in
 `cost.search_timing_ms`, with wall time and the number of retried samples.
```

**File**: `docs/eval-modal.md` (modified, +6/-6)
```diff
@@ -119,9 +119,9 @@ up to 50 queries in SHA-256 ID order, after warming up the first judged ID (also
 Public/private pairs prepare both indexes in one container with the same resources,
 then alternate baseline/candidate warmups and samples (A/B/A/B).
 Each candidate gets its own paired baseline; completed pairs replay without provider calls.
-A campaign-wide slot serializes trials including indexing and quality, preventing
-preparation from competing with latency. Busy trials return `leased` before paid dispatch;
-ambiguous detached calls retain the slot through their bounded startup/invocation lifetime.
+Up to the spec’s `parallelism` trials index and score concurrently. Only paired fresh warmups/samples
+wait for an exclusive campaign window; other trials continue quality. Window waits stay outside timing. Busy trial slots return `leased` before paid dispatch; detached calls retain their bounded trial slots.
+Failed sample loops release the window; control outages retain its bounded fence until expiry.
 Public `cost.latency_sample` records sample/warmup IDs and policy; `gates.latency.samples`
 rejects missing/mismatched evidence. Private samples remain internal; comparability is published.
 P95 includes local embedding/retrieval/reranking and successful provider round trips;
@@ -164,12 +164,12 @@ The [trusted full-engine confirmation runner](eval-engine-confirmation.md) owns
 
 The Volume `quivr-eval-embeddings-cache` holds immutable vectors and the outbox.
 Hosted document fills overlap at most four 128-entry cache chunks; each provider
-attempt reserves and settles independently. Hosted admission halves after 429s
-and recovers one slot after 16 times the current slot count in clean requests;
+attempt reserves and settles independently. Campaign Azure/Cohere requests share SQL admission: at most four requests across containers,
+halved after 429s with a bounded Retry-After cooldown. It recovers one slot after 16 times the current slot count in clean requests;
 requests already in flight drain at the old limit. Local e5 and quality-query
 embedding fills stay serial and batched. The policy field `quality_concurrency` bounds re-ranking waves (1–32, default 8), preserving rankings, scores and per-search prices. Fresh warmup and latency stay serial.
 Attempts reserve independently; failed waves drain and retain uncertain charges. `cost.phase_usage` reports process CPU and elapsed seconds for indexing, quality, scoring and fresh latency, including warmup, excluding paired idle time. CPU/elapsed estimates average cores used, separately from serving cost.
-Claims precede paid work; commits and fenced publication stay serial.
+Trials wait for shared in-flight cache fills and reload committed Volume files before reuse; claims precede paid work and commits/publication stay serial.
 Chunks commit before publication; lost ownership rolls it back. Logs exclude texts.
 Reruns recover evidence and tracking writes. Keep the Volume and schema until
 results sync and campaign archival; never delete unknown reservations.
```

**File**: `scripts/eval/campaign_compute.py` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ def on_launch():
             return modal_search.launch(state['spec']['policy'], config, self.name, self.outbox, True,
                 app_name=app_name, on_launch=on_launch,
                 on_app=lambda app: self.store.bind(self.name, self.owner, resource['id'], app),
-                check=lambda: self.store.renew_owner(self.name, self.owner))
+                check=lambda: self.store.renew_owner(self.name, self.owner), parallelism=state['spec']['parallelism'])
         except network_recovery.Outage:
             raise
         except Exception as error:
```

**File**: `scripts/eval/campaign_store.py` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ def register(self, spec, sha, scorer):
         from search_campaign import specification
         spec = specification(spec)
         name = spec['name']
-        self.campaign(name, modal_search.frozen_policy(spec['policy'], sha, scorer))
+        self.campaign(name, modal_search.frozen_policy(spec['policy'], sha, scorer, parallelism=spec['parallelism']))
         with self.transaction() as db:
             self.lock(db, name)
             db.execute('INSERT INTO eval_control.campaign_runs(campaign,spec,git_sha,scorer_digest) VALUES (%s,%s::jsonb,%s,%s) ON CONFLICT DO NOTHING',
```

**File**: `scripts/eval/control_store.py` (modified, +148/-3)
```diff
@@ -7,13 +7,15 @@
 import decimal
 import datetime
 import functools
+import email.utils
 import json
 import logging
 import os
 import re
 import tempfile
 import time
 import uuid
+import urllib.error
 
 import embeddings
 import network_recovery
@@ -163,6 +165,120 @@ def fence(self, db, name, key, owner):
         if not row or row[0] != owner or not row[1] or row[2] is not None:
             raise LeaseLost('lease expired, completed or held by another worker')
 
+    @retry_contention
+    def claim_slot(self, name, prefix, count, ttl, *, lease=None, gate=None):
+        """Admit one bounded slot under the campaign lock, fenced by its caller."""
+        keys = lease_batch([prefix + (f'/{i}' if count > 1 else '') for i in range(count)], ttl)
+        with contextlib.ExitStack() as admission_fence, self.transaction() as db:
+            policy, stopped = self.lock(db, name)
+            if self.terminal(db, name, policy, stopped):
+                raise LeaseLost('campaign stopped or ended')
+            if lease:
+                self.fence(db, name, *lease)
+            occupied = {row[0] for row in db.execute(
+                'SELECT key FROM eval_control.leases WHERE campaign=%s AND key=ANY(%s) AND (expires_at>clock_timestamp() OR payload IS NOT NULL)',
+                (name, keys)).fetchall()}
+            for key in keys:
+                if key not in occupied:
+                    if gate is not None:
+                        admission_fence.enter_context(gate.commit())
+                    owner = uuid.uuid4().hex
+                    # Recheck parent ownership at the write after SQL round trips.
+                    predicate, parameters = '', ()
+                    if lease:
+                        predicate = ' WHERE EXISTS (SELECT 1 FROM eval_control.leases WHERE campaign=%s AND key=%s AND owner=%s AND expires_at>clock_timestamp() AND payload IS NULL)'
+                        parameters = (name, *lease)
+                    row = db.execute("INSERT INTO eval_control.leases(campaign,key,owner,expires_at) SELECT %s,%s,%s,clock_timestamp()+%s*interval '1 second'" + predicate +
+                        ' ON CONFLICT (campaign,key) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at RETURNING key',
+                        (name, key, owner, ttl) + parameters).fetchone()
+                    if not row:
+                        raise LeaseLost('invocation expired before slot admission')
+                    return key, owner
+        return None
+
+    @retry_contention
+    def provider_slot(self, name, lease, extra_leases=()):
+        """All hosted models in one campaign share adaptive request admission."""
+        with self.transaction() as db:
+            policy, stopped = self.lock(db, name)
+            if self.terminal(db, name, policy, stopped):
+                raise LeaseLost('campaign stopped or ended')
+            for fence in (lease, *extra_leases):
+                self.fence(db, name, *fence)
+            db.execute("INSERT INTO eval_control.leases(campaign,key,owner,expires_at,payload) VALUES (%s,'provider-admission','control',clock_timestamp(),%s::jsonb) ON CONFLICT DO NOTHING",
+                (name, json.dumps({'limit': 4, 'clean': 0, 'generation': 0})))
+            state, cooling = db.execute("SELECT payload,expires_at>clock_timestamp() FROM eval_control.leases WHERE campaign=%s AND key='provider-admission'", (name,)).fetchone()
+            active = {row[0] for row in db.execute("SELECT key FROM eval_control.leases WHERE campaign=%s AND key LIKE 'provider-request/%%' AND expires_at>clock_timestamp()", (name,)).fetchall()}
+            if cooling or len(active) >= state['limit']:
+                return None
+            key = next('provider-request/' + str(i) for i in range(4) if 'provider-request/' + str(i) not in active)
+            owner = uuid.uuid4().hex
+            # Only the bounded Modal callers install ProviderAdmission. Socket
+            # timeouts do not bound a streaming response: retain the permit for
+            # a full invocation lifetime, beyond its hard container deadline.
+            ttl = policy.get('max_seconds', 3600) + policy.get('startup_seconds', 0)
+            lease_batch([], ttl)
+            predicates = ['EXISTS (SELECT 1 FROM eval_control.leases WHERE campaign=%s AND key=%s AND owner=%s AND expires_at>clock_timestamp() AND payload IS NULL)' for _ in (lease, *extra_leases)]
+            parameters = tuple(value for fence in (lease, *extra_leases) for value in (name, *fence))
+            row = db.execute("INSERT INTO eval_control.leases(campaign,key,owner,expires_at) SELECT %s,%s,%s,clock_timestamp()+%s*interval '1 second' WHERE " + ' AND '.join(predicates) +
+                ' ON CONFLICT (campaign,key) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at RETURNING key', (name, key, owner, ttl) + parameters).fetchone()
+            if not row:
+                raise LeaseLost('invocation or latency wi
```

**File**: `scripts/eval/direct_bakeoff.py` (modified, +17/-12)
```diff
@@ -177,6 +177,7 @@ def __init__(self, endpoint, key, budget, set_name, prices=None):
         self.opener = urllib.request.build_opener(embeddings.NoRedirect())
         # Shallow task copies retain this limiter across all document batches.
         self.documents = DocumentAdmission()
+        self.provider_gate = None
         self.blocked_seconds = self.http_seconds = self.service_seconds = 0.
         self.ledger_seconds = self.backoff_seconds = self.admission_seconds = 0.
         self.retry_attempts = 0
@@ -193,19 +194,23 @@ def blocked(self, phase=None):
                 setattr(self, phase + '_seconds', getattr(self, phase + '_seconds') + elapsed)
 
     def read(self, request, mode):
-        admission = self.documents.request() if mode == 'document' else contextlib.nullcontext()
+        admission = (self.provider_gate.request() if self.provider_gate else
+                     self.documents.request() if mode == 'document' else contextlib.nullcontext())
         with self.blocked():
-            admitted = time.monotonic()
-            with admission:
-                self.admission_seconds += time.monotonic() - admitted
-                started = time.monotonic()
-                try:
-                    with self.opener.open(request, timeout=120) as response:
-                        raw = response.read(embeddings.MAX_RESPONSE_BYTES + 1)
-                    self.service_seconds += time.monotonic() - started
-                    return raw
-                finally:
-                    self.http_seconds += time.monotonic() - started
+            admitted, http_elapsed = time.monotonic(), 0.
+            try:
+                with admission:
+                    started = time.monotonic()
+                    try:
+                        with self.opener.open(request, timeout=120) as response:
+                            raw = response.read(embeddings.MAX_RESPONSE_BYTES + 1)
+                        self.service_seconds += time.monotonic() - started
+                        return raw
+                    finally:
+                        http_elapsed = time.monotonic() - started
+                        self.http_seconds += http_elapsed
+            finally:
+                self.admission_seconds += time.monotonic() - admitted - http_elapsed
 
     def post(self, path, body, texts, label, model, mode):
         # The shared gate's supported byte/subword bound, including special tokens.
```

**File**: `scripts/eval/modal_search.py` (modified, +33/-16)
```diff
@@ -154,13 +154,13 @@ def policy(value):
     return cfg
 
 
-def frozen_policy(policy, sha, scorer_digest, fresh_latency=True):
+def frozen_policy(policy, sha, scorer_digest, fresh_latency=True, parallelism=1):
     return {**policy, 'git_sha': sha, 'scorer_digest': scorer_digest,
-            'registry_digest': search_trial.digest(public_sets.SETS), 'fresh_latency': fresh_latency}
+            'registry_digest': search_trial.digest(public_sets.SETS), 'fresh_latency': fresh_latency, 'trial_parallelism': parallelism}
 
 
-def dispatch(store, campaign, policy, cfg, name, sha, scorer_digest, invoke, outbox, fresh_latency, *, measurement_slot=None):
-    frozen = frozen_policy(policy, sha, scorer_digest, fresh_latency)
+def dispatch(store, campaign, policy, cfg, name, sha, scorer_digest, invoke, outbox, fresh_latency, *, measurement_slot=None, parallelism=1):
+    frozen = frozen_policy(policy, sha, scorer_digest, fresh_latency, parallelism)
     store.campaign(campaign, frozen)
     key = search_trial.digest({'config': cfg, 'dataset': name, 'registry': policy['sets'][name].get('input', public_sets.SETS.get(name)),
                               'tier': 'direct', 'sha': sha, 'scorer': scorer_digest, 'fresh_latency': fresh_latency})
@@ -235,6 +235,7 @@ def remote_trial(request):
     import results
     import search_trial
     import trec
+    import network_recovery
     logging.basicConfig(level=logging.INFO, format='%(message)s')
     log = logging.getLogger(__name__)
     log.info('trial started')
@@ -246,7 +247,7 @@ def remote_trial(request):
     store.campaign(request['campaign'], policy)
     lease = request['lease_key'], request['owner']
     store.renew(request['campaign'], *lease, ttl=policy['max_seconds'])
-    budget = control_store.Budget(store, request['campaign'], lease)
+    budget = control_store.Budget(store, request['campaign'], lease, ttl=policy['max_seconds'])
     volume = modal.Volume.from_name('quivr-eval-embeddings-cache')
     volume.reload()
     # Replay committed evidence even when its originating container has exited.
@@ -268,13 +269,16 @@ def remote_trial(request):
         configs = {'baseline': policy['baseline'], 'candidate': cfg}
         budgets, clients = {}, {}
         for side, config in configs.items():
-            budgets[side] = control_store.Budget(store, request['campaign'], lease)
+            budgets[side] = control_store.Budget(store, request['campaign'], lease, ttl=policy['max_seconds'])
             clients[side] = None if config['model'] == direct_bakeoff.E5_MODEL else direct_bakeoff.Hosted(
                 os.environ['AZURE_FOUNDRY_ENDPOINT'], os.environ['AZURE_FOUNDRY_KEY'],
                 budgets[side], name, policy['prices'])
+            if clients[side] is not None:
+                clients[side].provider_gate = control_store.ProviderAdmission(budgets[side])
         measurements = search_trial.measure_pair(configs, data, dataset, '/eval-cache/embeddings', budgets, clients,
             policy['prices'], float(policy['modal_usd_per_second']), request['fresh_latency'],
-            os.environ.get('TYPESAFE_API_KEY', ''), quality_concurrency=policy['quality_concurrency'], flush=volume.commit)
+            os.environ.get('TYPESAFE_API_KEY', ''), quality_concurrency=policy['quality_concurrency'], flush=volume.commit, refresh=volume.reload,
+            latency_scope=lambda: store.latency_window(request['campaign'], lease, policy['max_seconds']))
         rows = {}
         for side, config in configs.items():
             measured = measurements[side]
@@ -295,6 +299,8 @@ def remote_trial(request):
         results.Results(directory='/eval-cache/results').log(row)
         volume.commit()
         return row
+    except network_recovery.Outage:
+        raise  # Skip compensating writes after the bounded recovery window.
     except embeddings.BudgetExceeded:
         log.info('trial capped elapsed_seconds=%.3f', time.monotonic() - started)
         store.abandon(request['campaign'], *lease, 'capped')
@@ -343,7 +349,7 @@ def retrieve():
 
 
 def launch(policy, candidate, campaign, outbox, fresh_latency, *, app_name='quivr-search-measurement',
-           on_app=lambda identity: None, on_launch=lambda: None, check=lambda: None):
+           on_app=lambda identity: None, on_launch=lambda: None, check=lambda: None, parallelism=1):
     import modal
     if subprocess.run(['git', 'diff', '--quiet', 'HEAD'], cwd=ROOT).returncode:
         raise ValueError('measurement code must be committed before live dispatch')
@@ -356,15 +362,26 @@ def ignored(path):
     sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
     scorer_digest = 'sha256:' + search_trial.digest({name: (ROOT / 'scripts/eval' / name).read_text()
         for name in ('scoring.py', 'gates.py', 'search_trial.py', 'embeddings.py', 'direct_bakeoff.py', 'private_working.py', 'protected_inputs.py')})
-    store.campaign(campaign, frozen_policy(policy, sha, scorer_
```

**File**: `scripts/eval/private_working.py` (modified, +5/-2)
```diff
@@ -79,13 +79,16 @@ def trial(request, store):
         budgets, clients = {}, {}
         for side, cfg in configs.items():
             store.renew(request['campaign'], *lease, ttl=policy['max_seconds'])
-            budgets[side] = control_store.Budget(store, request['campaign'], lease)
+            budgets[side] = control_store.Budget(store, request['campaign'], lease, ttl=policy['max_seconds'])
             clients[side] = None if cfg['model'] == direct_bakeoff.E5_MODEL else direct_bakeoff.Hosted(
                 os.environ['AZURE_FOUNDRY_ENDPOINT'], os.environ['AZURE_FOUNDRY_KEY'], budgets[side], name, policy['prices'])
+            if clients[side] is not None:
+                clients[side].provider_gate = control_store.ProviderAdmission(budgets[side])
         started = time.monotonic()
         measurements = search_trial.measure_pair(configs, data, dataset, root / 'vectors', budgets, clients,
             policy['prices'], float(policy['modal_usd_per_second']), request['fresh_latency'],
-            os.environ.get('TYPESAFE_API_KEY', ''), private_vectors=private_vectors, quality_concurrency=policy['quality_concurrency'])
+            os.environ.get('TYPESAFE_API_KEY', ''), private_vectors=private_vectors, quality_concurrency=policy['quality_concurrency'],
+            latency_scope=lambda: store.latency_window(request['campaign'], lease, policy['max_seconds']))
         for side, cfg in configs.items():
             measured = measurements[side]
             measured['duration_seconds'] = time.monotonic() - started
```

---

### Incident Patch 2: `4e219d75` (2026-10-06)
**Commit Message**: test(demo): hold the web demo tests to their budget without fixed waits (#3759)

## Summary

Closes THE-1069. This is a test-audit campaign over `quivr-search/`
tests (`audit-tests-dev`, steps 1–8). The browser specs stop waiting on
fixed timers and fit the 15 s per-test budget of
`docs/agents/testing.md`, now enforced by `playwright.config.ts`.
Expected counts come from the facade that produces them.

- **One product fix, in its own commit (a8d30b8f).** The feed's
**Sources** menu now rereads the connector list when it opens. Before, a
source created in another tab or through the API showed its articles
live but could not be picked in the filter for up to 30 s. Control: with
the reread reverted, the feed spec's source pick runs past the 15 s
budget; with it, the whole test takes about 5 s. A second commit
(36208808) makes the connector list keep only its latest read, so an
older poll that finishes last cannot hide a source just created.
- **Over-budget tests, root-caused and fixed without sleeps:**
- `feed.spec.ts:144`, 60.4 s on every run. It waited for a
`/demo/feed/days` response the page sends only on its 60 s refresh.
Opening the Date menu within 15 s reuses the counts made a

**File**: `quivr-search/playwright.config.ts` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ export default defineConfig({
   testDir: "./tests",
   testMatch: "**/*.spec.ts",
   workers: 1,
-  timeout: 60000,
+  timeout: 15000,
   expect: { timeout: 10000 },
   use: {
     baseURL: process.env.QUIVR_DEMO_URL || "http://127.0.0.1:5182",
```

**File**: `quivr-search/scripts/fake-core.mjs` (modified, +0/-5)
```diff
@@ -254,11 +254,6 @@ export function fakeCore({ records: given, alerts = [], latency = 0 } = {}) {
   };
   return {
     server,
-    records,
-    /** How many change streams are open. */
-    get streams() {
-      return streams.size;
-    },
     /** A new Version of a Record, accepted now, announced on the change stream. */
     correct(id, title) {
       const r = byId.get(`rec_${id}`);
```

**File**: `quivr-search/src/App.tsx` (modified, +1/-0)
```diff
@@ -572,6 +572,7 @@ function Dashboard({
               feed={feed}
               alerts={alerts}
               connectors={sources.connectors}
+              onSourcesOpen={() => void sources.reload()}
               reading={reading}
               scroller={scroller}
               onAdd={() => setAdding(true)}
```

**File**: `quivr-search/src/components/feed/FeedPage.tsx` (modified, +4/-0)
```diff
@@ -102,6 +102,7 @@ export function FeedPage({
   feed,
   alerts,
   connectors,
+  onSourcesOpen,
   reading,
   scroller,
   onAdd,
@@ -127,6 +128,8 @@ export function FeedPage({
   feed: ReturnType<typeof useFeedStream>;
   alerts: ReturnType<typeof useAlertList>;
   connectors: Connector[];
+  /** Rereads the sources, so one added elsewhere can be picked at once. */
+  onSourcesOpen: () => void;
   reading: ReturnType<typeof useReadState>;
   scroller: RefObject<HTMLDivElement | null>;
   onAdd: () => void;
@@ -837,6 +840,7 @@ export function FeedPage({
               title="Sources"
               icon={<SourcesIcon size={15} />}
               summary={named(filter.sources, sourceName, "sources")}
+              onOpen={onSourcesOpen}
             >
               {sourceRows.map((ns) => {
                 const silenced = muted.has(ns);
```

**File**: `quivr-search/src/lib/explain.ts` (modified, +0/-6)
```diff
@@ -109,9 +109,3 @@ export function explain(node: KeywordNode): Piece[] {
   out.push(".");
   return out;
 }
-
-/** The sentence as plain text, keywords in French quotes. */
-export const sentence = (node: KeywordNode) =>
-  explain(node)
-    .map((p) => (typeof p === "string" ? p : `« ${p.keyword} »`))
-    .join("");
```

**File**: `quivr-search/src/lib/health.ts` (modified, +1/-1)
```diff
@@ -332,7 +332,7 @@ const calls = (n: number) =>
  * without a call, healthy otherwise. A plugin whose calls succeed again is
  * healthy at once, and says it recovered.
  */
-export function pluginState(
+function pluginState(
   hour: List<PluginCallStats> | null,
   series: PluginCallStats[],
 ): { state: PluginState; reason: string } {
```

**File**: `quivr-search/src/lib/workspace.ts` (modified, +7/-1)
```diff
@@ -261,12 +261,18 @@ const CONNECTORS_INTERVAL = 30000;
 export function useConnectorList(onUnauthorized: () => void) {
   const [connectors, setConnectors] = useState<Connector[]>([]);
   const [available, setAvailable] = useState(true);
+  // Reads can overlap (the timer, a menu opening): only the latest one counts.
+  const latest = useRef(0);
   const reload = useCallback(
     async (signal?: AbortSignal) => {
+      const read = ++latest.current;
       try {
-        setConnectors(await fetchConnectors(signal));
+        const list = await fetchConnectors(signal);
+        if (read !== latest.current) return;
+        setConnectors(list);
         setAvailable(true);
       } catch (e) {
+        if (read !== latest.current) return;
         if (e instanceof APIError && e.status === 401) onUnauthorized();
         else if (e instanceof APIError && e.status === 403) setAvailable(false);
       }
```

**File**: `quivr-search/tests/admin-health-live.spec.ts` (modified, +4/-8)
```diff
@@ -3,9 +3,8 @@ import { test, expect } from "@playwright/test";
 // The Goulots and Plugins sections against the real core (make verify-demo,
 // THE-797): a text added through the facade is timed at each step by the
 // worker's rollups, and the ingestion plugin that cut it shows as healthy
-// with its calls. Over the 15 s budget only when the facade's 10 s cache and
-// the section's 15 s refresh both just missed the text: the waits are
-// bounded conditions, never sleeps. Synthetic content only.
+// with its calls. It opens the Admin tab only once the text is searchable, so
+// the section's first read already holds its timings. Synthetic content only.
 const run = Date.now().toString(36);
 
 test.beforeEach(async ({ page }) => {
@@ -49,7 +48,6 @@ test("un texte ajouté est chronométré à chaque étape, et le plugin d’inge
             await page.request.get(`/v0/ingestion-receipts/${receipt}`)
           ).json()
         ).availability?.searchable,
-      { timeout: 30000 },
     )
     .toBe(true);
 
@@ -65,17 +63,15 @@ test("un texte ajouté est chronométré à chaque étape, et le plugin d’inge
         .getByRole("definition")
         .first(),
       name,
-    ).toHaveText(/\d\s?(ms|s|min)$/, { timeout: 30000 });
+    ).toHaveText(/\d\s?(ms|s|min)$/);
   await expect(necks.getByRole("status")).not.toBeEmpty();
 
   await page.getByRole("tab", { name: "Plugins" }).click();
   const ingest = page
     .getByRole("region", { name: "Plugins" })
     .getByRole("listitem")
     .filter({ hasText: "core.ingest" });
-  await expect(ingest.getByRole("button")).toContainText("Opérationnel", {
-    timeout: 30000,
-  });
+  await expect(ingest.getByRole("button")).toContainText("Opérationnel");
   await expect(ingest.getByRole("button")).toContainText(
     "Découpage et vecteurs",
   );
```

---

### Incident Patch 3: `93c165e8` (2026-10-05)
**Commit Message**: feat(observability): trace requests end to end with OpenTelemetry (#3758)

## In short
Enable operator-configured OTLP tracing and metrics to follow a request
from the API through durable dispatch, Temporal workflows/activities,
storage adapters, plugin calls and webhook delivery. Honor W3C trace
context and safe caller request IDs; include authoritative trace/span
IDs in logs and JSON errors. Existing Prometheus metric names, labels
and buckets remain stable through SDK aggregation. Backlog gauges use
observable callbacks, so OTLP-only deployments receive them without
scrapes.

Closes THE-1054.

### Behavior and deployment

- Configure telemetry.endpoint, protocol (HTTP/protobuf or gRPC),
headers, parent-based sampling ratio and resource attributes for each
API/worker. No endpoint installs no exporter or dependency tracing.
- Persist only W3C context and caller ID beside durable work. Generic
fixed operation attributes exclude SQL, query text, URLs, object keys,
business identifiers, arbitrary baggage and raw errors.
- Both plugin SDK HTTP adapters continue the incoming context. Go
InjectTrace and Python inject_headers propagate downstream; SDKs require
an operator-configured prov

**File**: `README.md` (modified, +4/-2)
```diff
@@ -193,8 +193,10 @@ For a browser UI over the same API, run `make demo` and open http://127.0.0.1:51
   - worker: processing outcomes, time from acceptance to searchable, and delivery
     attempts and durations.
 
-  JSON logs link request, Receipt, Record and Version IDs
-  ([harness](docs/quivr-v2-local-harness.md)).
+  JSON logs link caller request IDs, trace/span IDs, Receipts, Records and Versions.
+  Opt-in OpenTelemetry exports traces and metrics to an OTLP collector, carrying
+  one trace through durable ingestion, Temporal, plugin calls and webhooks
+  ([configuration](docs-site/reference/configuration.mdx#opentelemetry)).
 - **Local load measurement** (`make load`) with deterministic free providers,
   versioned scenarios, ingestion bursts and replica failure. Reports include
   latency, errors, throughput and delays until documents are searchable and alerted;
```

**File**: `client/client.gen.go` (modified, +11/-2)
```diff
@@ -1802,10 +1802,19 @@ type Error struct {
 	Code string `json:"code"`
 
 	// Field JSON Pointer (RFC 6901) to the request member that caused a 422, when known (for example /config/url or /credential/secret/token on connector commands).
-	Field     *string `json:"field,omitempty"`
-	Message   string  `json:"message"`
+	Field   *string `json:"field,omitempty"`
+	Message string  `json:"message"`
+
+	// RequestId Bounded caller X-Request-ID, or an engine-generated correlation ID.
+	RequestId *string `json:"request_id,omitempty"`
 	ResyncUrl *string `json:"resync_url,omitempty"`
 	Retryable bool    `json:"retryable"`
+
+	// SpanId W3C span ID of the API handler when a trace context is present.
+	SpanId *string `json:"span_id,omitempty"`
+
+	// TraceId W3C trace ID when a trace context is present.
+	TraceId *string `json:"trace_id,omitempty"`
 }
 
 // EvaluationBacklogPage defines model for EvaluationBacklogPage.
```

**File**: `contracts/http/v0/openapi.yaml` (modified, +9/-0)
```diff
@@ -3694,6 +3694,15 @@ components:
       type: object
       additionalProperties: false
       properties:
+        request_id:
+          type: string
+          description: Bounded caller X-Request-ID, or an engine-generated correlation ID.
+        trace_id:
+          type: string
+          description: W3C trace ID when a trace context is present.
+        span_id:
+          type: string
+          description: W3C span ID of the API handler when a trace context is present.
         code:
           type: string
           minLength: 1
```

**File**: `contracts/plugins/v0/README.md` (modified, +25/-0)
```diff
@@ -67,6 +67,31 @@ or if a plugin schema declares a `$defs` entry with a shared name; the bundler
 used by `make contracts` also rejects a malformed alias. Reviewers still keep
 equivalent copies under other names out of both contracts.
 
+## Trace context
+
+<!-- trace-context: published in the generated protocol reference -->
+The engine sends optional W3C `traceparent` and `tracestate` headers on plugin
+requests, plus `X-Request-ID` for correlation. These headers are supported with
+all Plugin API versions and do not change request JSON or signing claims.
+Only W3C TraceContext travels; arbitrary baggage is excluded.
+
+Both SDK HTTP adapters extract the headers and make the current span available
+to handlers through the OpenTelemetry API. They start a `plugin.request` span
+when the plugin has configured a tracer provider; otherwise they continue the
+incoming context without an exporter. SDK input-Blob HTTP reads also inject it.
+Configure your plugin's OpenTelemetry SDK and OTLP exporter in its own process
+to export internal/provider spans. Do not put content, query text, credentials,
+source addresses or organization identifiers in span attributes.
+
+Go handlers receive the context as their `context.Context` argument; call
+`quivrplugin.InjectTrace(ctx, request.Header)` before an outgoing provider
+request. Python handlers use the current OpenTelemetry context; call
+`quivr_plugin.tracing.inject_headers(headers)` before making an outgoing
+request. Provider instrumentation must preserve that context and apply the
+same privacy policy. Engine webhook deliveries use the same headers; receivers
+can continue the trace after checking the webhook signature.
+<!-- /trace-context -->
+
 ## Signed engine requests
 
 <!-- engine-auth: published in the generated protocol reference -->
```

**File**: `docs-site/openapi.yaml` (modified, +9/-0)
```diff
@@ -4809,6 +4809,15 @@ components:
       type: object
       additionalProperties: false
       properties:
+        request_id:
+          type: string
+          description: Bounded caller X-Request-ID, or an engine-generated correlation ID.
+        trace_id:
+          type: string
+          description: W3C trace ID when a trace context is present.
+        span_id:
+          type: string
+          description: W3C span ID of the API handler when a trace context is present.
         code:
           type: string
           minLength: 1
```

**File**: `docs-site/reference/configuration.mdx` (modified, +26/-1)
```diff
@@ -14,6 +14,7 @@ keywords: ["QUIVR_CONFIG", "configuration", "keys", "destinations", "plugins", "
 | `cursor_key` | yes | A secret of at least 32 bytes that signs change-feed cursors. Keep it stable. |
 | `keys` | yes | The API keys, by bearer token. See [API keys](#api-keys). |
 | `temporal_address` | yes | Temporal's frontend address, such as `temporal:7233` |
+| `telemetry` | no | Opt-in OTLP traces and metrics export. See [OpenTelemetry](#opentelemetry). |
 | `tls` | no | Outgoing connection encryption and trust. See [Outbound TLS](#outbound-tls). |
 | `weaviate_url` | yes | The Weaviate search index, such as `http://weaviate:8080` |
 | `s3` | yes | Object storage for original bytes and derived artifacts. See [Object storage](#object-storage). |
@@ -51,14 +52,38 @@ Durations are Go durations: `30s`, `10m`, `168h`. Unknown fields refuse startup.
 
 ## Logs and shutdown
 
-Engine processes write one JSON event per line to stdout. Every event includes `ts`, `level`, `msg`, `service`, `version`, `instance` and `environment`; events within an HTTP request also include `request_id`. `service` distinguishes `quivr.api`, `quivr.worker` and `quivr.migrate`. `version` reports the engine build version. Debug events are hidden at the default `info` level. Nonempty environment overrides take precedence over the JSON file; unknown levels and nonpositive grace periods refuse startup.
+Engine processes write one JSON event per line to stdout. Every event includes `ts`, `level`, `msg`, `service`, `version`, `instance`, `environment`, `trace_id` and `span_id` (empty outside a trace); events within an HTTP request also include `request_id`. `service` distinguishes `quivr.api`, `quivr.worker` and `quivr.migrate`. `version` reports the engine build version. Debug events are hidden at the default `info` level. Nonempty environment overrides take precedence over the JSON file; unknown levels and nonpositive grace periods refuse startup.
 
 Each completed public or probe HTTP request writes an access event with `route`, `method`, `status`, `duration_ms`, `response_size` (bytes written), `client_ip`, `api_key_id`, `error_code` and `request_id`. Routes are registered templates, with `unmatched` for unknown paths. For public requests, client IP follows the trusted proxy policy in `connector_push.trusted_proxy_cidrs`; otherwise it is the socket peer. Probe requests use the socket peer. The key ID is a 128-bit SHA-256 fingerprint of a bearer token present in the configured `keys`; it is empty for instance tokens and requests without a configured API key. No bearer token, request body, query string or arbitrary request path is logged.
 
 Lifecycle events use `event`: `quivr.start`, `quivr.ready`, `quivr.draining` and `quivr.stop`. Startup includes an allowlisted summary of effective process settings, with counts and enabled flags for sensitive configuration. Credentials, plugin settings and connection URLs are excluded. Raw error details are redacted at the logging boundary; use stable event and error codes for routing.
 
 On SIGTERM or SIGINT, readiness becomes `503` before drain begins. New public requests are refused, public listeners close, and admitted work can finish within one `shutdown_grace` budget. Probes remain available during the drain. Work still running at the deadline is canceled, open HTTP connections are closed, and unfinished durable work can resume on another worker. Streaming connections count as in-flight requests and may use the whole grace period. The final counter flush shares this deadline.
 
+## OpenTelemetry
+
+Set `telemetry.endpoint` in every engine process to export traces and metrics to your collector. An omitted or empty endpoint disables export; tracing uses a no-op provider and installs no dependency tracing or exporter goroutines. `/metrics` remains available with the same Prometheus metric names, labels and buckets. SDK meters own aggregation; no collector is needed for scraping. The OTLP reader samples backlog gauges even when nobody scrapes `/metrics`.
+
+| Field | Default | Meaning |
+| --- | --- | --- |
+| `endpoint` | Empty (export off) | Collector base URL, such as `https://collector.example.com:4318`. HTTP appends `/v1/traces` and `/v1/metrics`; signal-specific URLs ending in either path are refused. gRPC permits no path. URLs with credentials, queries or fragments are refused. |
+| `protocol` | `http/protobuf` | `http/protobuf` or `grpc`. Use an `https` endpoint for verified TLS, or `http` for plaintext to a trusted local collector. |
+| `headers` | `{}` | Collector authentication headers, used for both signals. Values are excluded from logs. |
+| `sampling_ratio` | `1` | Root trace sampling probability, from `0` to `1`. Children honor their parent's sampled flag, including incoming W3C context. |
+| `resource_attributes` | Engine service and version | Deployment identity as string key/value pairs. `service.name` and `service.version` use process settings. Configured `instance` and `envi
```

**File**: `docs-site/reference/plugin-protocol.mdx` (modified, +23/-0)
```diff
@@ -31,6 +31,29 @@ Latest Plugin API: `0.14.0`. Supported versions: `0.1.0`, `0.2.0`, `0.3.0`, `0.3
 | Optional search mode override for profile candidates | `0.13.0` |
 | Signed engine requests with per-plugin audience and body digest | `0.14.0` |
 
+## Trace context
+
+The engine sends optional W3C `traceparent` and `tracestate` headers on plugin
+requests, plus `X-Request-ID` for correlation. These headers are supported with
+all Plugin API versions and do not change request JSON or signing claims.
+Only W3C TraceContext travels; arbitrary baggage is excluded.
+
+Both SDK HTTP adapters extract the headers and make the current span available
+to handlers through the OpenTelemetry API. They start a `plugin.request` span
+when the plugin has configured a tracer provider; otherwise they continue the
+incoming context without an exporter. SDK input-Blob HTTP reads also inject it.
+Configure your plugin's OpenTelemetry SDK and OTLP exporter in its own process
+to export internal/provider spans. Do not put content, query text, credentials,
+source addresses or organization identifiers in span attributes.
+
+Go handlers receive the context as their `context.Context` argument; call
+`quivrplugin.InjectTrace(ctx, request.Header)` before an outgoing provider
+request. Python handlers use the current OpenTelemetry context; call
+`quivr_plugin.tracing.inject_headers(headers)` before making an outgoing
+request. Provider instrumentation must preserve that context and apply the
+same privacy policy. Engine webhook deliveries use the same headers; receivers
+can continue the trace after checking the webhook signature.
+
 ## Signed engine requests
 
 Plugin API `0.14.0` requires `Authorization: Bearer <compact JWS>` on discovery
```

**File**: `docs-site/run-quivr/deploy.mdx` (modified, +6/-0)
```diff
@@ -74,6 +74,12 @@ Engine logs are JSON lines on stdout. Set `log_level` or `QUIVR_LOG_LEVEL` to `d
 
 Stop a process with SIGTERM or SIGINT. Its `/readyz` becomes `503` first, then it drains admitted requests and background work. `shutdown_grace` defaults to `60s`; set your platform's termination timeout long enough to allow that budget. The stable lifecycle events are `quivr.start`, `quivr.ready`, `quivr.draining` and `quivr.stop`. A readiness event means the process passed its readiness criteria, including the API’s query warm-up timeout described above; a start event alone does not.
 
+## Follow a request across services
+
+Set `telemetry.endpoint` to your OpenTelemetry collector in the API and worker configuration, then restart both. The [OpenTelemetry reference](/reference/configuration#opentelemetry) lists HTTP/gRPC, authentication headers and sampling settings. Search your collector by the response’s `X-Trace-ID`, or the `trace_id` in a JSON error or log line. The trace continues through durable background work and outgoing plugin and webhook requests.
+
+Keep `/metrics` scraping as it is: metric names and buckets remain unchanged. Each plugin process needs its own exporter configuration to send its internal spans to the collector.
+
 ## Example deployments
 
 - **Local:** `make dev`, in the [Quickstart](/quickstart).
```

---

### Incident Patch 4: `e646f0dd` (2026-10-05)
**Commit Message**: fix(eval): pair and isolate campaign latency measurements (#3755)

Public campaign trials previously measured baseline and candidate in
separate containers, and search p95 included retries, backoff and ledger
delays. Compare both configurations in one container over identical
interleaved fresh queries, and gate on local work plus successful
provider round trips. Keep wall time, excluded delays, per-phase p50/p95
and retried-sample counts as evidence.

A campaign-wide measurement lease also covers indexing and quality so
concurrent preparation cannot contaminate latency. Busy trials retry
before allocating paid compute or a watchdog intent. Reservations and
intent persistence are fenced on slot ownership; known setup failures
abandon unstarted intents, while known local setup failures release the
idle slot, while ambiguous detached work retains it for its bounded
lifetime. Outages skip further cleanup writes. Each candidate has its
own atomically published baseline, and completed pairs replay together.

Validation: deterministic fake-clock, fake-provider and disposable
PostgreSQL regressions demonstrated failures on the original code and
now pass. In the retry fixture, a 39.02 s wal

**File**: `docs-site/run-quivr/run-search-campaign.mdx` (modified, +9/-0)
```diff
@@ -75,6 +75,15 @@ the end date and the trial limit stop the campaign. Conservative reservations
 include uncertain charges; Modal builds/storage and other account charges need
 separate budgeting. No measurements run in CI.
 
+Each dataset compares baseline and candidate in one container, alternating fresh
+queries after both indexes are ready. A campaign-wide slot serializes measurement,
+including preparation; busy trials wait for a later supervisor pass before paid dispatch.
+The latency gate measures local search work plus successful provider round trips.
+Retry HTTP, backoff, admission and ledger waits appear separately in
+`cost.search_timing_ms`, with wall time and the number of retried samples.
+See the [measurement guide](https://github.com/The-Vibe-Company/quivr/blob/main/docs/eval-modal.md)
+for the timing fields and replay behavior.
+
 Short network outages retry from 1 to 10 seconds for up to ten minutes. Configure
 `EVAL_NETWORK_OUTAGE_SECONDS` in the supervisor/watchdog environment (0–3600 seconds,
 default 600; 0 disables retries). Authentication/configuration refusals and uncertain
```

**File**: `docs/eval-modal.md` (modified, +21/-21)
```diff
@@ -114,31 +114,31 @@ MLDR-fr, WebFAQ-fr, TREC-COVID and MKQA-fr are diagnostic because of saturation,
 small samples or proxy questions; restricted-licence sets are also diagnostic.
 Their scores remain reported. Diagnostics cannot supply the qualifying gain.
 
-Quality covers every query with relevance judgments using batched, cached embeddings. Fresh latency
-uses up to 50 serial queries, ordered by SHA-256 of the ID (ID breaks ties), after
-warming up the lexicographically first judged ID, which may also be timed.
-Both configurations use the same sample and resource class.
-Private comparisons prepare both indexes, then alternate baseline/candidate
-warmups and each sampled query (A/B/A/B). Public standalone runs remain serial.
-For public sets, `cost.latency_sample` records timed IDs, warmup ID and policy;
-`gates.latency.samples` echoes both and rejects missing or mismatched evidence.
-Private samples stay inside the runner; only
-the verified comparability boolean is published.
-P95 includes query embedding, retrieval and reranking; its limit is 1.2 times baseline.
-Serving price uses the fresh sample; warmup charges stay outside per-search metrics.
-`--cached-exploration` reuses query vectors and cannot pass the unmeasured latency gate.
+Quality uses every judged query with batched, cached embeddings. Fresh latency samples
+up to 50 queries in SHA-256 ID order, after warming up the first judged ID (also eligible).
+Public/private pairs prepare both indexes in one container with the same resources,
+then alternate baseline/candidate warmups and samples (A/B/A/B).
+Each candidate gets its own paired baseline; completed pairs replay without provider calls.
+A campaign-wide slot serializes trials including indexing and quality, preventing
+preparation from competing with latency. Busy trials return `leased` before paid dispatch;
+ambiguous detached calls retain the slot through their bounded startup/invocation lifetime.
+Public `cost.latency_sample` records sample/warmup IDs and policy; `gates.latency.samples`
+rejects missing/mismatched evidence. Private samples remain internal; comparability is published.
+P95 includes local embedding/retrieval/reranking and successful provider round trips;
+its limit is 1.2 times baseline. Retry HTTP, backoff, admission and ledger waits are excluded.
+`cost.search_timing_ms` reports their p50/p95, embedding/retrieval/rerank/wall time and
+`retried_samples`. Wall time includes lease renewal; the service timer starts after renewal.
+Warmup charges stay outside fresh serving price; `--cached-exploration` cannot pass latency.
 
 Price limits are $0.0005/search for `default`, $0.05/search for `deep`, and
 $10/1,000 original documents. Override `min_gain`, `latency_ratio`, `search_usd` or
 `index_usd` in `gates`. Serving includes query embedding, reranking and compute.
-Indexing covers all document windows, excluding quality-query preparation. Cached
-usage is repriced by input bounds and local compute time; campaign usage stays exact.
-Serving compute excludes provider HTTP, retry and ledger waits. Actual invocation
-spend remains in the Modal ledger. `cost.search_provider_usd` and
-`cost.search_compute_usd` split the average search price; `cost.search_timing_ms`
-reports provider and local p50/p95 alongside the end-to-end latency metric.
-Timing-versioned cache entries prevent reuse of earlier wall-time attributions.
-
+Indexing covers document windows, excluding quality-query preparation. Cached usage is
+repriced by input bounds and local compute time; campaign usage stays exact.
+Serving compute excludes provider HTTP, retry and ledger waits; actual invocation spend
+remains in the Modal ledger. `cost.search_provider_usd` and `cost.search_compute_usd`
+split the average search price; `cost.search_timing_ms` splits provider and local time.
+Timing-versioned caches prevent reuse of wall-time attributions.
 Admission and planning share the UTF-8 byte-plus-eight-token bound at frozen prices.
 Confirmed responses release unused reservations. This Azure hosted adapter settles
 429 rejections at zero; other failed/unknown attempts stay reserved. Successful
```

**File**: `scripts/eval/campaign_compute.py` (modified, +18/-6)
```diff
@@ -77,10 +77,20 @@ def __init__(self, store, name, owner, outbox, compute=None):
     def __call__(self, config):
         self.store.renew_owner(self.name, self.owner)
         state = self.store.snapshot(self.name)
-        resource = self.store.intent(self.name, self.owner)
+        resource, attempted = None, False
+        def app_name(slot):
+            # Allocate an intent only after the campaign measurement slot admits us.
+            nonlocal resource
+            resource = self.store.intent(self.name, self.owner, lease=slot)
+            return resource['label']
+        def on_launch():
+            nonlocal attempted
+            # Entering SDK startup may already send AppCreate; failed entry
+            # does not prove its absence. Preserve uncertain SDK attempts.
+            attempted = True
         try:
             return modal_search.launch(state['spec']['policy'], config, self.name, self.outbox, True,
-                app_name=resource['label'],
+                app_name=app_name, on_launch=on_launch,
                 on_app=lambda app: self.store.bind(self.name, self.owner, resource['id'], app),
                 check=lambda: self.store.renew_owner(self.name, self.owner))
         except network_recovery.Outage:
@@ -93,11 +103,13 @@ def __call__(self, config):
             # A bounded outage leaves detached compute and uncertain admissions
             # intact. The independent watchdog reconciles after ownership grace.
             # Do not spend another outage window on release/cleanup here.
-            # A failed creation/bind remains pending for the watchdog. Live
-            # ownership can close only resources whose exact ID is acknowledged.
+            # Unknown creation/bind remains pending for the watchdog; local
+            # failure before AppCreate can safely abandon its own intent.
             current = (self.store.snapshot(self.name)['resources'][resource['id']]
-                       if not isinstance(sys.exc_info()[1], network_recovery.Outage) else None)
-            if current and current['app_id']:
+                       if resource and not isinstance(sys.exc_info()[1], network_recovery.Outage) else None)
+            if resource and not attempted and not isinstance(sys.exc_info()[1], network_recovery.Outage):
+                self.store.abandon_intent(self.name, self.owner, resource['id'])
+            elif current and current['app_id']:
                 self.compute.stop(current['app_id'])
                 if self.compute.running(current['app_id']):
                     raise campaign_store.CleanupPending('Modal termination is still pending')
```

**File**: `scripts/eval/campaign_store.py` (modified, +20/-4)
```diff
@@ -116,7 +116,7 @@ def acquire(self, name, ttl=120):
         return owner
 
     @contextlib.contextmanager
-    def mutation(self, name, owner=None, *, cleanup=False, recovering=False):
+    def mutation(self, name, owner=None, *, cleanup=False, recovering=False, lease=None):
         with self.transaction() as db:
             policy, stopped = self.lock(db, name)
             stopped = self.terminal(db, name, policy, stopped)
@@ -135,7 +135,13 @@ def mutation(self, name, owner=None, *, cleanup=False, recovering=False):
                 # renewal must not race a watchdog that already began cleanup.
                 state['owner_released'] = True
             yield db, state, row[3]
-            db.execute('UPDATE eval_control.campaign_runs SET state=%s::jsonb WHERE campaign=%s', (json.dumps(state, allow_nan=False), name))
+            predicate, parameters = '', (json.dumps(state, allow_nan=False), name)
+            if lease:
+                predicate = ' AND EXISTS (SELECT 1 FROM eval_control.leases WHERE campaign=%s AND key=%s AND owner=%s AND expires_at>clock_timestamp() AND payload IS NULL)'
+                parameters += (name, *lease)
+            updated = db.execute('UPDATE eval_control.campaign_runs SET state=%s::jsonb WHERE campaign=%s' + predicate + ' RETURNING campaign', parameters).fetchone()
+            if lease and updated is None:
+                raise control_store.LeaseLost('measurement slot expired before compute intent')
 
     @control_store.retry_contention
     def renew_owner(self, name, owner, ttl=120):
@@ -151,9 +157,9 @@ def release_owner(self, name, owner):
             db.execute("UPDATE eval_control.campaign_runs SET expires_at=clock_timestamp(),state=jsonb_set(state,'{owner_released}','true') WHERE campaign=%s AND owner=%s", (name, owner))
 
     @control_store.retry_contention
-    def intent(self, name, owner):
+    def intent(self, name, owner, *, lease=None):
         identity = uuid.uuid4().hex
-        with self.mutation(name, owner) as (db, state, generation):
+        with self.mutation(name, owner, lease=lease) as (db, state, generation):
             policy, _ = self.lock(db, name)
             # Startup deadline is diagnostic only: AppCreate acknowledgement
             # can be lost independently of a container's startup timeout.
@@ -164,6 +170,16 @@ def intent(self, name, owner):
             state['resources'][identity] = resource
         return resource
 
+    @control_store.retry_contention
+    def abandon_intent(self, name, owner, identity):
+        """Close an intent whose creator knows no AppCreate was attempted."""
+        with self.edit(name) as (db, state):
+            current, generation = db.execute('SELECT owner,generation FROM eval_control.campaign_runs WHERE campaign=%s', (name,)).fetchone()
+            resource = state['resources'][identity]
+            if current != owner or resource['generation'] != generation or resource['app_id']:
+                raise control_store.LeaseLost('cannot abandon a replaced or launched intent')
+            resource['status'] = 'closed'
+
     @control_store.retry_contention
     def bind(self, name, owner, identity, app_id):
         if not isinstance(app_id, str) or not app_id.startswith('ap-'):
```

**File**: `scripts/eval/control_store.py` (modified, +8/-7)
```diff
@@ -311,24 +311,25 @@ def availability(self, name):
                 'confirmation_reads_left': policy.get('confirmation_limit', 10) - reads}
 
     @retry_contention
-    def reserve(self, name, kind, usd, metadata=None, lease=None):
+    def reserve(self, name, kind, usd, metadata=None, lease=None, *, extra_leases=()):
         gate = network_recovery.admission(name)
         while True:
             gate.wait()
             try:
-                return self._reserve(name, kind, usd, metadata, lease, gate)
+                return self._reserve(name, kind, usd, metadata, lease, gate, extra_leases)
             except network_recovery.AdmissionPaused:
                 continue
 
-    def _reserve(self, name, kind, usd, metadata, lease, gate):
+    def _reserve(self, name, kind, usd, metadata, lease, gate, extra_leases):
         amount, refused = money(usd), False
         if kind not in ('provider', 'modal'):
             raise ValueError('unsupported ledger kind')
         rid = uuid.uuid4().hex
+        leases = ([lease] if lease else []) + list(extra_leases)
         with contextlib.ExitStack() as admission_fence, self.transaction() as db:
             policy, stopped = self.lock(db, name)
-            if lease:
-                self.fence(db, name, *lease)
+            for fence in leases:
+                self.fence(db, name, *fence)
             stopped = self.terminal(db, name, policy, stopped)
             day = db.execute("SELECT (clock_timestamp() AT TIME ZONE 'UTC')::date").fetchone()[0]
             db.execute('INSERT INTO eval_control.days(campaign,day,kind) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING', (name, day, kind))
@@ -348,9 +349,9 @@ def _reserve(self, name, kind, usd, metadata, lease, gate):
                 # and network latency, just like the measurement lease fence.
                 predicate = ' WHERE (%s::timestamptz IS NULL OR clock_timestamp()<%s::timestamptz)'
                 parameters = (policy.get('end_at'), policy.get('end_at'))
-                if lease:
+                for fence in leases:
                     predicate += ' AND EXISTS (SELECT 1 FROM eval_control.leases WHERE campaign=%s AND key=%s AND owner=%s AND expires_at>clock_timestamp() AND payload IS NULL)'
-                    parameters += (name, *lease)
+                    parameters += (name, *fence)
                 row = db.execute('INSERT INTO eval_control.reservations(id,campaign,day,kind,reserved_usd,charged_usd,metadata) SELECT %s,%s,%s,%s,%s,%s,%s::jsonb' + predicate + ' RETURNING id', values + parameters).fetchone()
                 if row is None:
                     if self.terminal(db, name, policy, stopped):
```

**File**: `scripts/eval/direct_bakeoff.py` (modified, +25/-14)
```diff
@@ -175,31 +175,42 @@ def __init__(self, endpoint, key, budget, set_name, prices=None):
         self.opener = urllib.request.build_opener(embeddings.NoRedirect())
         # Shallow task copies retain this limiter across all document batches.
         self.documents = DocumentAdmission()
-        self.blocked_seconds = self.http_seconds = 0.
+        self.blocked_seconds = self.http_seconds = self.service_seconds = 0.
+        self.ledger_seconds = self.backoff_seconds = self.admission_seconds = 0.
+        self.retry_attempts = 0
 
     @contextlib.contextmanager
-    def blocked(self):
+    def blocked(self, phase=None):
         started = time.monotonic()
         try:
             yield
         finally:
-            self.blocked_seconds += time.monotonic() - started
+            elapsed = time.monotonic() - started
+            self.blocked_seconds += elapsed
+            if phase:
+                setattr(self, phase + '_seconds', getattr(self, phase + '_seconds') + elapsed)
 
     def read(self, request, mode):
         admission = self.documents.request() if mode == 'document' else contextlib.nullcontext()
-        with self.blocked(), admission:
-            started = time.monotonic()
-            try:
-                with self.opener.open(request, timeout=120) as response:
-                    return response.read(embeddings.MAX_RESPONSE_BYTES + 1)
-            finally:
-                self.http_seconds += time.monotonic() - started
+        with self.blocked():
+            admitted = time.monotonic()
+            with admission:
+                self.admission_seconds += time.monotonic() - admitted
+                started = time.monotonic()
+                try:
+                    with self.opener.open(request, timeout=120) as response:
+                        raw = response.read(embeddings.MAX_RESPONSE_BYTES + 1)
+                    self.service_seconds += time.monotonic() - started
+                    return raw
+                finally:
+                    self.http_seconds += time.monotonic() - started
 
     def post(self, path, body, texts, label, model, mode):
         # The shared gate's supported byte/subword bound, including special tokens.
         tokens = embeddings.estimate_tokens(texts)
         for attempt in range(8):
-            with self.blocked():
+            self.retry_attempts += int(attempt > 0)
+            with self.blocked('ledger'):
                 call = self.budget.reserve(label, self.set_name, mode, tokens, self.prices[model])
             request = urllib.request.Request(self.endpoint + path, data=json.dumps(body).encode(),
                                              headers={'Content-Type': 'application/json', 'api-key': self.key}, method='POST')
@@ -215,7 +226,7 @@ def post(self, path, body, texts, label, model, mode):
                     raise RuntimeError('invalid provider response') from None
                 if type(used) is not int or used < 0:
                     raise RuntimeError('provider omitted confirmed usage; measurement rejected')
-                with self.blocked():
+                with self.blocked('ledger'):
                     self.budget.settle(call, used)
                 return result
             except urllib.error.HTTPError as error:
@@ -225,7 +236,7 @@ def post(self, path, body, texts, label, model, mode):
                 # This hosted adapter's rate-limit rejection is unbilled.
                 # Do not infer the billing outcome of other error statuses.
                 if code == 429:
-                    with self.blocked():
+                    with self.blocked('ledger'):
                         self.budget.settle(call, 0)
                 if code not in (429, 500, 502, 503, 504) or attempt == 7:
                     raise RuntimeError(f'provider HTTP {code}') from None
@@ -239,7 +250,7 @@ def post(self, path, body, texts, label, model, mode):
                     raise RuntimeError('provider transport failed after 8 attempts') from None
                 delay = 0
             # Unknown attempts stay reserved; retries must reserve again.
-            with self.blocked():
+            with self.blocked('backoff'):
                 time.sleep(min(60, max(2 ** attempt, delay) + random.uniform(0, 1)))
         raise RuntimeError('provider attempts exhausted')
 
```

**File**: `scripts/eval/modal_search.py` (modified, +96/-62)
```diff
@@ -157,7 +157,7 @@ def frozen_policy(policy, sha, scorer_digest, fresh_latency=True):
             'registry_digest': search_trial.digest(public_sets.SETS), 'fresh_latency': fresh_latency}
 
 
-def dispatch(store, campaign, policy, cfg, name, sha, scorer_digest, invoke, outbox, fresh_latency):
+def dispatch(store, campaign, policy, cfg, name, sha, scorer_digest, invoke, outbox, fresh_latency, *, measurement_slot=None):
     frozen = frozen_policy(policy, sha, scorer_digest, fresh_latency)
     store.campaign(campaign, frozen)
     key = search_trial.digest({'config': cfg, 'dataset': name, 'registry': policy['sets'][name].get('input', public_sets.SETS.get(name)),
@@ -177,7 +177,8 @@ def dispatch(store, campaign, policy, cfg, name, sha, scorer_digest, invoke, out
     try:
         reservation = store.reserve(campaign, 'modal',
             (policy['max_seconds'] + policy['startup_seconds']) * control_store.money(policy['modal_usd_per_second']),
-            {'measurement_key': key, 'max_seconds': policy['max_seconds'], 'startup_seconds': policy['startup_seconds']}, (key, owner))
+            {'measurement_key': key, 'max_seconds': policy['max_seconds'], 'startup_seconds': policy['startup_seconds']}, (key, owner),
+            extra_leases=[measurement_slot] if measurement_slot else [])
         started = time.monotonic()
         row = invoke(request)
         elapsed = time.monotonic() - started
@@ -192,7 +193,7 @@ def dispatch(store, campaign, policy, cfg, name, sha, scorer_digest, invoke, out
         return completed(store, campaign, key, row, tracking, 'complete')
     except embeddings.BudgetExceeded:
         status, reason = 'capped', 'daily reservation cap reached or usage bound exceeded'
-    except network_recovery.Outage:
+    except (network_recovery.Outage, control_store.LeaseLost, control_store.Unavailable, control_store.Contention):
         # The same invocation may still be running. Keep its reservation and
         # measurement lease until the watchdog acknowledges app termination.
         raise
@@ -207,8 +208,9 @@ def dispatch(store, campaign, policy, cfg, name, sha, scorer_digest, invoke, out
 
 def completed(store, campaign, key, row, tracking, status):
     output = {'status': status, 'record': row, 'receipt': tracking.log(row)}
-    if row['dataset']['private']:
-        baseline_key = row['provenance']['private_pair']['baseline_lease_key']
+    if row['dataset']['private'] or 'public_pair' in row.get('provenance', {}):
+        kind = 'private_pair' if row['dataset']['private'] else 'public_pair'
+        baseline_key = row['provenance'][kind]['baseline_lease_key']
         baseline = store.evidence(campaign, [baseline_key])[baseline_key]
         output.update(baseline_record=baseline, baseline_receipt=tracking.log(baseline))
     return output
@@ -261,25 +263,33 @@ def remote_trial(request):
                  len(data['corpus']), len(data['qrels']), time.monotonic() - started)
         dataset = {'name': name, 'version': search_trial.digest(public_sets.SETS[name]),
                    'split': 'dev', 'fingerprint': trec.fingerprint(directory), 'private': False}
-        hosted = None
-        if cfg['model'] != direct_bakeoff.E5_MODEL:
-            hosted = direct_bakeoff.Hosted(os.environ['AZURE_FOUNDRY_ENDPOINT'], os.environ['AZURE_FOUNDRY_KEY'],
-                                          budget, name, policy['prices'])
-        measured = search_trial.measure(cfg, data, dataset, '/eval-cache/embeddings', budget, hosted,
-                        policy['prices'], float(policy['modal_usd_per_second']), request['fresh_latency'],
-                        os.environ.get('TYPESAFE_API_KEY', ''), volume.commit, quality_concurrency=policy['quality_concurrency'])
-        measured['duration_seconds'] = time.monotonic() - started
-        measured['cost'].update(modal_seconds=measured['duration_seconds'], resource_class=search_trial.resource_class(policy),
-                                agent_token_usage=policy['agent_token_usage'], compute_cap_notice=COMPUTE_NOTICE)
-        row = search_trial.record(measured, {**cfg, 'profile': policy['profile'],
-                    'campaign': request['campaign'], 'campaign_policy_hash': search_trial.digest(policy),
-                    'prices_usd_per_million': policy['prices'],
-                    'modal_usd_per_second': policy['modal_usd_per_second'],
-                    'resource_class': search_trial.resource_class(policy), 'quality_concurrency': policy['quality_concurrency'],
-                    'price_revision': policy['price_revision'], 'fresh_latency': request['fresh_latency']},
-                    policy['experiment'], request['git_sha'], request['scorer_digest'])
+        configs = {'baseline': policy['baseline'], 'candidate': cfg}
+        budgets, clients = {}, {}
+        for side, config in configs.items():
+            budgets[side] = control_store.Budget(store, request['campaign'], lease)
+            clients[side] = None if c
```

**File**: `scripts/eval/private_working.py` (modified, +1/-6)
```diff
@@ -125,9 +125,4 @@ def trial(request, store):
             'latency_comparable': verdict['gates']['latency']['details'][name]['comparable'] is True}}
         # Both canonical rows are aggregate-only. The candidate lease fences
         # the invocation; a separate baseline row preserves confirmation APIs.
-        claim = store.claim(request['campaign'], baseline_key, policy['max_seconds'])
-        if claim['status'] != 'claimed':
-            raise RuntimeError('private baseline evidence unavailable')
-        store.publish_many(request['campaign'], {baseline_key: (claim['owner'], rows['baseline']),
-                                                 lease[0]: (lease[1], rows['candidate'])})
-        return rows['candidate']
+        return search_trial.publish_pair(store, request, rows)
```

---

### Incident Patch 5: `e5220d07` (2026-10-05)
**Commit Message**: feat(ops): add configurable structured logs and graceful drain (#3752)

## Summary

Engine processes now emit structured JSON on stdout with configurable
levels and a stable identity envelope. HTTP access events describe the
final response, correlate request diagnostics, and expose route
templates and API-key fingerprints without logging tokens, request
paths, or query strings.

SIGTERM makes readiness fail before admission stops. HTTP requests,
background loops, Temporal activities, durable cleanup, and the final
counter flush share a configurable shutdown budget (default 60 seconds).
Cleanup can survive an individual attempt cancellation while retaining
process cancellation; the database pool closes after HTTP drain and
flushing. Optional rotating files remain available. Configured plugin
signing secrets are included in the credential boundary; malformed
sibling rings do not prevent valid rings from being redacted.

Documentation signal: these new configuration fields, log events, and
termination behavior change the operator contract. Updated the
configuration and deployment references and regenerated the
documentation site.

## How to test

1. Start an engine process with `QUIVR

**File**: `cmd/quivr/main.go` (modified, +29/-2)
```diff
@@ -6,7 +6,9 @@ import (
 	"strings"
 
 	"github.com/The-Vibe-Company/quivr/internal/app"
+	"github.com/The-Vibe-Company/quivr/internal/logging"
 	"github.com/The-Vibe-Company/quivr/internal/online"
+	"github.com/The-Vibe-Company/quivr/internal/plugins"
 	"github.com/The-Vibe-Company/quivr/internal/plugins/cli"
 )
 
@@ -21,17 +23,42 @@ func main() {
 			os.Exit(online.Run(os.Args[1], os.Args[2:]))
 		}
 	}
-	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, nil)))
+	slog.SetDefault(bootstrapLogger())
 	if len(os.Args) != 2 {
 		slog.Error(usage())
 		os.Exit(2)
 	}
 	if err := app.Run(os.Args[1]); err != nil {
-		slog.Error("process failed", "error", err)
+		// Keep startup failures useful without serializing dependency or
+		// configuration diagnostics that may contain credentials.
+		app.LogFailure(err)
 		os.Exit(1)
 	}
 }
 
+func bootstrapLogger() *slog.Logger {
+	options := logging.Options{
+		Level:       os.Getenv("QUIVR_LOG_LEVEL"),
+		Service:     "quivr",
+		Version:     plugins.EngineVersion,
+		Instance:    os.Getenv("QUIVR_INSTANCE"),
+		Environment: os.Getenv("QUIVR_ENVIRONMENT"),
+	}
+	logger, err := logging.New(os.Stdout, options)
+	if err == nil {
+		return logger
+	}
+	// An invalid environment value must never echo back into startup output.
+	options.Level = ""
+	logger, err = logging.New(os.Stdout, options)
+	if err == nil {
+		return logger
+	}
+	// os.Stdout is a valid writer and the fallback level is valid, so this is
+	// unreachable unless the constructor's contract changes.
+	return logger
+}
+
 // usage names every command, from the engine and online command tables.
 func usage() string {
 	names := []string{}
```

**File**: `cmd/quivr/main_test.go` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+package main
+
+import (
+	"bytes"
+	"encoding/json"
+	"io"
+	"os"
+	"testing"
+)
+
+// Startup failures occur before config loading, so the configured process
+// identity must already be present at this executable boundary.
+func TestBootstrapHonorsEnvironmentIdentityWithInvalidLevel(t *testing.T) {
+	t.Setenv("QUIVR_INSTANCE", "replica-7")
+	t.Setenv("QUIVR_ENVIRONMENT", "staging")
+	t.Setenv("QUIVR_LOG_LEVEL", "invalid-credential-sentinel")
+	output, err := os.CreateTemp(t.TempDir(), "stdout")
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer output.Close()
+	original := os.Stdout
+	os.Stdout = output
+	logger := bootstrapLogger()
+	os.Stdout = original
+	logger.Error("startup refused")
+	if _, err := output.Seek(0, 0); err != nil {
+		t.Fatal(err)
+	}
+	data, err := io.ReadAll(output)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if bytes.Contains(data, []byte("invalid-credential-sentinel")) {
+		t.Fatal("bootstrap exposed invalid level")
+	}
+	var record map[string]any
+	if err := json.Unmarshal(data, &record); err != nil {
+		t.Fatal(err)
+	}
+	if record["instance"] != "replica-7" || record["environment"] != "staging" {
+		t.Fatalf("bootstrap identity: %v", record)
+	}
+}
```

**File**: `docs-site/reference/configuration.mdx` (modified, +16/-2)
```diff
@@ -19,7 +19,11 @@ keywords: ["QUIVR_CONFIG", "configuration", "keys", "destinations", "plugins", "
 | `s3` | yes | Object storage for original bytes and derived artifacts. See [Object storage](#object-storage). |
 | `listen` | no | Address of the public HTTP API. Default `127.0.0.1:8080`. |
 | `probe_listen` | no | Private address of `/healthz`, `/readyz` and `/metrics`. Default `127.0.0.1:8081`; give each process its own. |
-| `log_directory` | no | Write JSON logs to rotating files in this folder instead of stderr |
+| `log_level` | no | Minimum log level: `debug`, `info` (default), `warn` or `error`. `QUIVR_LOG_LEVEL` overrides the file. |
+| `instance` | no | Process identity in each log event. Default hostname and PID; `QUIVR_INSTANCE` overrides the file. |
+| `environment` | no | Deployment environment label in each log event. Default `unspecified`; `QUIVR_ENVIRONMENT` overrides the file. |
+| `shutdown_grace` | no | Shared grace period for draining HTTP requests and background work after SIGTERM or SIGINT. Positive Go duration, default `60s`; `QUIVR_SHUTDOWN_GRACE` overrides the file. |
+| `log_directory` | no | Also write JSON logs to rotating files in this folder; stdout remains enabled. Four files per process, up to 1 MiB each. |
 | `retrieval` | no | Search profile aliases. See [Search profiles](#search-profiles). |
 | `plugins` | no | The plugins this deployment calls. See [Plugin pins](#plugin-pins). |
 | `ingestion_evaluation_concurrency` | no | Evaluation activities in flight per worker. Default `4`, range `1`–`32`; `0` selects the default. Served ingestion has separate capacity. |
@@ -43,7 +47,17 @@ keywords: ["QUIVR_CONFIG", "configuration", "keys", "destinations", "plugins", "
 | `tei_url` | no | A Text Embeddings Inference server that encodes queries for Corpora built before the `core-ingest` plugin; not needed on a new deployment |
 | `m365` | no | Refused. The Microsoft 365 settings moved to the `m365-mail` plugin's pin configuration. |
 
-Durations are Go durations: `30s`, `10m`, `168h`. Unknown fields refuse startup with `invalid configuration JSON: json: unknown field "<field>"`. Remove the former `connector_fixtures` and `monitoring_fixture_evaluator` settings; the acceptance harness now pins its fixture plugin through `plugins`.
+Durations are Go durations: `30s`, `10m`, `168h`. Unknown fields refuse startup. Remove the former `connector_fixtures` and `monitoring_fixture_evaluator` settings; the acceptance harness now pins its fixture plugin through `plugins`.
+
+## Logs and shutdown
+
+Engine processes write one JSON event per line to stdout. Every event includes `ts`, `level`, `msg`, `service`, `version`, `instance` and `environment`; events within an HTTP request also include `request_id`. `service` distinguishes `quivr.api`, `quivr.worker` and `quivr.migrate`. `version` reports the engine build version. Debug events are hidden at the default `info` level. Nonempty environment overrides take precedence over the JSON file; unknown levels and nonpositive grace periods refuse startup.
+
+Each completed public or probe HTTP request writes an access event with `route`, `method`, `status`, `duration_ms`, `response_size` (bytes written), `client_ip`, `api_key_id`, `error_code` and `request_id`. Routes are registered templates, with `unmatched` for unknown paths. For public requests, client IP follows the trusted proxy policy in `connector_push.trusted_proxy_cidrs`; otherwise it is the socket peer. Probe requests use the socket peer. The key ID is a 128-bit SHA-256 fingerprint of a bearer token present in the configured `keys`; it is empty for instance tokens and requests without a configured API key. No bearer token, request body, query string or arbitrary request path is logged.
+
+Lifecycle events use `event`: `quivr.start`, `quivr.ready`, `quivr.draining` and `quivr.stop`. Startup includes an allowlisted summary of effective process settings, with counts and enabled flags for sensitive configuration. Credentials, plugin settings and connection URLs are excluded. Raw error details are redacted at the logging boundary; use stable event and error codes for routing.
+
+On SIGTERM or SIGINT, readiness becomes `503` before drain begins. New public requests are refused, public listeners close, and admitted work can finish within one `shutdown_grace` budget. Probes remain available during the drain. Work still running at the deadline is canceled, open HTTP connections are closed, and unfinished durable work can resume on another worker. Streaming connections count as in-flight requests and may use the whole grace period. The final counter flush shares this deadline.
 
 ## Outbound TLS
 
```

**File**: `docs-site/run-quivr/deploy.mdx` (modified, +8/-2)
```diff
@@ -51,10 +51,10 @@ quivr worker    # in its own process
 ```
 
 1. `quivr migrate` updates the database schema, creates the storage bucket when it is missing, and prepares the search index. It gives up after 30 seconds when storage or the search index does not answer; run it again once they do.
-2. `quivr api` refuses to start while migrations are pending, with `database/schema unavailable; run migrate`.
+2. `quivr api` refuses to start while migrations are pending; run `quivr migrate` first.
 3. `quivr worker` started before the migrations waits for them for up to `migration_wait` (5 minutes by default), then exits.
 
-To deploy a new `quivr` binary, run its `quivr migrate` first, then restart `api` and `worker` on it. A binary older than the database schema refuses to start, with `database schema is newer than this binary`. The [CLI reference](/reference/cli#engine-commands) lists the commands' exit codes.
+To deploy a new `quivr` binary, run its `quivr migrate` first, then restart `api` and `worker` on it. A binary older than the database schema refuses to start. The [CLI reference](/reference/cli#engine-commands) lists the commands' exit codes.
 
 ## Check that it is ready
 
@@ -68,6 +68,12 @@ Each `api` and `worker` serves three probes on its `probe_listen` address, `127.
 
 The `api` becomes ready once its schema check passes and its ingestion plugin has answered a first query, or after 5 seconds; the first searches are then only slower. The `worker` also checks that Temporal, object storage and the search index answer. A plugin that is down does not stop either process. Background work that needs it waits and retries; a search that needs it fails with `503 search_unavailable`.
 
+## Route logs and stop a process
+
+Engine logs are JSON lines on stdout. Set `log_level` or `QUIVR_LOG_LEVEL` to `debug`, `info`, `warn` or `error`; the default is `info`. Set `instance` and `environment`, or their `QUIVR_INSTANCE` and `QUIVR_ENVIRONMENT` overrides, to identify the process in your log tooling. [Logs and shutdown](/reference/configuration#logs-and-shutdown) lists the event fields and redaction behavior. `log_directory` optionally keeps rotating local copies.
+
+Stop a process with SIGTERM or SIGINT. Its `/readyz` becomes `503` first, then it drains admitted requests and background work. `shutdown_grace` defaults to `60s`; set your platform's termination timeout long enough to allow that budget. The stable lifecycle events are `quivr.start`, `quivr.ready`, `quivr.draining` and `quivr.stop`. A readiness event means the process passed its readiness criteria, including the API’s query warm-up timeout described above; a start event alone does not.
+
 ## Example deployments
 
 - **Local:** `make dev`, in the [Quickstart](/quickstart).
```

**File**: `internal/adapters/postgres/connector_push.go` (modified, +2/-1)
```diff
@@ -11,6 +11,7 @@ import (
 
 	"github.com/The-Vibe-Company/quivr/internal/connectors"
 	"github.com/The-Vibe-Company/quivr/internal/corpus"
+	"github.com/The-Vibe-Company/quivr/internal/lifecycle"
 	"github.com/The-Vibe-Company/quivr/internal/observability"
 	"github.com/jackc/pgx/v5"
 )
@@ -53,7 +54,7 @@ func (s ConnectorStore) ProtectPush(ctx context.Context, in connectors.PushAttem
 			}
 		}
 		defer func() {
-			release, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
+			release, cancel := lifecycle.CleanupContext(ctx, 2*time.Second)
 			defer cancel()
 			// Completed answers clear owner_token; only an unfinished claim is released.
 			_, _ = s.Pool.Exec(release, `DELETE FROM connector_push_answers WHERE organization=$1 AND connector_id=$2 AND key_hash=$3 AND owner_token=$4`, in.Organization, in.InstanceID, in.KeyHash, owner)
```

**File**: `internal/app/failure.go` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+package app
+
+import (
+	"errors"
+	"log/slog"
+	"strings"
+
+	"github.com/The-Vibe-Company/quivr/internal/plugins"
+)
+
+// LogFailure reports stable, engine-owned issue codes without serializing the
+// raw error, which can include a configuration value or provider response.
+func LogFailure(err error) {
+	code := "process_failed"
+	var pin *plugins.PinError
+	if errors.As(err, &pin) {
+		var codes []string
+		for _, issue := range pin.Issues {
+			switch issue.Code {
+			case plugins.CodeInvalidPin, plugins.CodeUnreadable, plugins.CodeInvalidYAML, plugins.CodeSchema,
+				plugins.CodeInvalidRange, plugins.CodeIncompatibleEngine, plugins.CodeIncompatiblePluginAPI,
+				plugins.CodeReservedContribution, plugins.CodeForeignNamespace, plugins.CodeInvalidConfigSchema,
+				plugins.CodeInvalidExtensionSchema, plugins.CodeDuplicateSecret, plugins.CodeInvalidManifest,
+				plugins.CodeInvalidConfiguration, plugins.CodeInvalidExpressionSchema, plugins.CodeReservedField,
+				plugins.CodeInvalidCredentialSchema, plugins.CodeInvalidModes, plugins.CodeForeignSpace,
+				plugins.CodePluginConflict, plugins.CodeKindConflict, plugins.CodeSpaceConflict,
+				plugins.CodeNamespaceConflict, plugins.CodeRouteConflict, plugins.CodePluginDependency:
+				codes = append(codes, issue.Code)
+			}
+		}
+		if len(codes) > 0 {
+			code = strings.Join(codes, ",")
+		}
+	}
+	slog.Error("process failed", "event", "quivr.failed", "error_code", code)
+}
```

**File**: `internal/app/fixture_config_test.go` (modified, +6/-0)
```diff
@@ -43,6 +43,7 @@ func TestOperatorAllowancesWarnAtStartup(t *testing.T) {
 				t.Cleanup(func() { slog.SetDefault(earlier) })
 				cfg := Config{DatabaseURL: "postgres://127.0.0.1:1/unused", CursorKey: strings.Repeat("c", 32), CredentialKey: strings.Repeat("s", 32),
 					Keys: map[string]corpus.Scope{strings.Repeat("k", 32): {Organization: "org_a", Actions: []string{"content:read"}, Corpora: []string{"*"}}}, ProjectionPurgeGrace: "invalid"}
+				cfg.LogDirectory = t.TempDir()
 				cfg.Delivery.AllowPrivateDestinations = enabled
 				cfg.ChangePrune.AllowShortRetention = enabled
 				cfg.ChangePrune.Organizations = []string{"org_a"}
@@ -58,6 +59,11 @@ func TestOperatorAllowancesWarnAtStartup(t *testing.T) {
 				if err := Run(command); err == nil || !strings.Contains(err.Error(), "projection_purge_grace") {
 					t.Fatalf("did not reach later config validation: %v", err)
 				}
+				logged, readErr := os.ReadFile(filepath.Join(cfg.LogDirectory, command+".log"))
+				if readErr != nil {
+					t.Fatal(readErr)
+				}
+				logs.Write(logged)
 				for _, message := range []string{"delivery.allow_private_destinations", "SSRF", "change_prune.allow_short_retention", "data loss"} {
 					if strings.Contains(logs.String(), message) != enabled {
 						t.Fatalf("enabled=%t, expected warning %q: %s", enabled, message, logs.String())
```

**File**: `internal/app/metrics.go` (modified, +2/-1)
```diff
@@ -8,6 +8,7 @@ import (
 	"time"
 
 	"github.com/The-Vibe-Company/quivr/internal/content"
+	"github.com/The-Vibe-Company/quivr/internal/lifecycle"
 	"github.com/The-Vibe-Company/quivr/internal/observability"
 	"github.com/The-Vibe-Company/quivr/internal/telemetry"
 )
@@ -67,7 +68,7 @@ func (o processingObserver) Enriched(ctx context.Context, org, receiptID string,
 }
 
 func (o processingObserver) read(ctx context.Context, org, receiptID string) (content.Steps, time.Duration, bool) {
-	read, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
+	read, cancel := lifecycle.CleanupContext(ctx, 2*time.Second)
 	defer cancel()
 	steps, age, err := o.store.ReceiptSteps(read, org, receiptID)
 	return steps, age, err == nil
```

---

### Incident Patch 6: `af22816c` (2026-10-05)
**Commit Message**: fix(search): reuse canonical storage connections under load (#3753)

Sustained searches churned canonical S3 connections because the client
retained only two idle connections per host. Retain up to 128 idle
connections per storage client and admit at most 64 active searches per
API process across callers. Excess searches return existing retryable
`503 search_unavailable` with `Retry-After: 1` before storage or plugin
work; cancellation releases capacity. Active non-search storage
concurrency retains its previous behavior.

Both unchanged local scenarios passed on clean commit
`e704d5f6a49b5fbd8a94bf05b796e0420bef7bfe`: 9,967 searches with zero
search, ingestion, or probe errors. All 200 documents and 1,000 notices
arrived, with no dropped/missing work and verified cleanup. Fake
providers only; scenarios and load harness are unchanged, and load stays
outside CI. JSON/Markdown reports are attached to
[THE-1057](https://linear.app/thevibecompany/issue/THE-1057/fix-a-third-of-searches-fail-with-30-60-concurrent-users).
Earlier failed experiments remain recorded there.

| Concurrency | Mode | Searches | Errors | p50 (ms) | p95 (ms) | Max
(ms) |
| --- | --- | ---: | ---: | ---: | ---: | 

**File**: `client/client.gen.go` (modified, +28/-8)
```diff
@@ -4342,13 +4342,13 @@ type ClientInterface interface {
 	// SearchRecordsWithBody performs a POST /v0/search (the `SearchRecords` operationId) request,
 	// with any type of body and a specified content type.
 	//
-	// Resolve the requested profile, compile mandatory Corpus/Organization prefilters and any requested filter, obtain candidates, then canonically hydrate and reauthorize every returned segment. Lexical-first records remain eligible without embeddings; semantic-only queries require vector coverage. Profile selection does not change access/currentness rules. When a retrieval plugin is pinned, it ranks. It asks the engine for candidates in up to three rounds and returns its ranking, which may hold only candidates the engine served in this search, each already authorized and hydrated.
+	// Resolve the requested profile, compile mandatory Corpus/Organization prefilters and any requested filter, obtain candidates, then canonically hydrate and reauthorize every returned segment. Lexical-first records remain eligible without embeddings; semantic-only queries require vector coverage. Profile selection does not change access/currentness rules. When a retrieval plugin is pinned, it ranks. It asks the engine for candidates in up to three rounds and returns its ranking, which may hold only candidates the engine served in this search, each already authorized and hydrated. Each API process admits at most 64 active searches across callers. At capacity it immediately returns retryable 503 search_unavailable with Retry-After before storage or plugin work.
 	SearchRecordsWithBody(ctx context.Context, contentType string, body io.Reader, reqEditors ...RequestEditorFn) (*http.Response, error)
 
 	// SearchRecords performs a POST /v0/search (the `SearchRecords` operationId) request.
 	// Takes a body of the `application/json` content type.
 	//
-	// Resolve the requested profile, compile mandatory Corpus/Organization prefilters and any requested filter, obtain candidates, then canonically hydrate and reauthorize every returned segment. Lexical-first records remain eligible without embeddings; semantic-only queries require vector coverage. Profile selection does not change access/currentness rules. When a retrieval plugin is pinned, it ranks. It asks the engine for candidates in up to three rounds and returns its ranking, which may hold only candidates the engine served in this search, each already authorized and hydrated.
+	// Resolve the requested profile, compile mandatory Corpus/Organization prefilters and any requested filter, obtain candidates, then canonically hydrate and reauthorize every returned segment. Lexical-first records remain eligible without embeddings; semantic-only queries require vector coverage. Profile selection does not change access/currentness rules. When a retrieval plugin is pinned, it ranks. It asks the engine for candidates in up to three rounds and returns its ranking, which may hold only candidates the engine served in this search, each already authorized and hydrated. Each API process admits at most 64 active searches across callers. At capacity it immediately returns retryable 503 search_unavailable with Retry-After before storage or plugin work.
 	SearchRecords(ctx context.Context, body SearchRecordsJSONRequestBody, reqEditors ...RequestEditorFn) (*http.Response, error)
 
 	// ListSearchProfiles performs a GET /v0/search/profiles (the `ListSearchProfiles` operationId) request.
@@ -6068,7 +6068,7 @@ func (c *Client) GetSavedQueryVersion(ctx context.Context, savedQueryId string,
 // SearchRecordsWithBody performs a POST /v0/search (the `SearchRecords` operationId) request,
 // with any type of body and a specified content type.
 //
-// Resolve the requested profile, compile mandatory Corpus/Organization prefilters and any requested filter, obtain candidates, then canonically hydrate and reauthorize every returned segment. Lexical-first records remain eligible without embeddings; semantic-only queries require vector coverage. Profile selection does not change access/currentness rules. When a retrieval plugin is pinned, it ranks. It asks the engine for candidates in up to three rounds and returns its ranking, which may hold only candidates the engine served in this search, each already authorized and hydrated.
+// Resolve the requested profile, compile mandatory Corpus/Organization prefilters and any requested filter, obtain candidates, then canonically hydrate and reauthorize every returned segment. Lexical-first records remain eligible without embeddings; semantic-only queries require vector coverage. Profile selection does not change access/currentness rules. When a retrieval plugin is pinned, it ranks. It asks the engine for candidates in up to three rounds and returns its ranking, which may hold only candidates the engine served in this search, each already authorized and hydrated. Each API process admits at most 64 active searches across callers. At capacity it immediately returns 
```

**File**: `contracts/http/v0/openapi.yaml` (modified, +10/-1)
```diff
@@ -3504,6 +3504,8 @@ paths:
         does not change access/currentness rules. When a retrieval plugin is pinned, it ranks. It asks
         the engine for candidates in up to three rounds and returns its ranking, which may hold only
         candidates the engine served in this search, each already authorized and hydrated.
+        Each API process admits at most 64 active searches across callers. At capacity it immediately
+        returns retryable 503 search_unavailable with Retry-After before storage or plugin work.
       requestBody:
         required: true
         content:
@@ -3524,7 +3526,14 @@ paths:
             it), unsupported_search or source_filter_unavailable, 502 retrieval_plugin_invalid (the retrieval plugin broke its
             contract, for example ranked a segment the engine never served it), 503 dependency unavailable,
             504 search_deadline_exceeded (the retrieval plugin's rounds outran the profile's hard bound, four times max_latency_ms;
-            a dependency that does not answer in time is 503).
+            a dependency that does not answer in time is 503). At search capacity, 503 search_unavailable
+            includes Retry-After; retry only after that delay.
+          headers:
+            Retry-After:
+              description: Present when search capacity is full; minimum delay in seconds before retrying.
+              schema:
+                type: integer
+                minimum: 1
           content:
             application/json:
               schema:
```

**File**: `docs-site/guides/search.mdx` (modified, +5/-1)
```diff
@@ -152,6 +152,10 @@ EOF
 
 These outputs come from the `make dev` stack, where `deep` maps to `core.retrieve/deep`. An unknown profile is refused with `422 unsupported_profile`.
 
+## Retry a busy search
+
+Each API process admits at most 64 active searches across callers. When capacity is full, it returns `503 search_unavailable` with `retryable: true` and a `Retry-After` header. Wait at least that many seconds before retrying, and limit concurrent searches in your client. A dependency outage can return the same code without the header; use bounded backoff for those failures. The [API overview](/api-reference/overview) describes the error envelope.
+
 ## Search from the command line
 
 `quivr search` sends the same request from a terminal, with the same `QUIVR_API_URL` and `QUIVR_API_KEY`:
@@ -176,4 +180,4 @@ Add `--json` to print the API response unchanged, and `--source` to filter by So
 | `403 forbidden` | The key may not search one of the requested Corpora. |
 | `422 query_too_long`, `422 unsupported_profile` | The query or the profile is refused. The message says why. |
 | `422 source_filter_unavailable` | The Corpus was indexed before source filtering existed; rebuild it once. |
-| `503` | A dependency, such as the search index or the embedding service, is unavailable. Retry later: Quivr never answers an empty list instead. |
+| `503 search_unavailable` | Search capacity is full or a dependency is unavailable. Wait for `Retry-After` when present; otherwise use bounded backoff. Quivr never answers an empty list instead. |
```

**File**: `docs-site/openapi.yaml` (modified, +10/-1)
```diff
@@ -4570,6 +4570,8 @@ paths:
         without embeddings; semantic-only queries require vector coverage. Profile selection does not change access/currentness
         rules. When a retrieval plugin is pinned, it ranks. It asks the engine for candidates in up to three rounds and returns
         its ranking, which may hold only candidates the engine served in this search, each already authorized and hydrated.
+        Each API process admits at most 64 active searches across callers. At capacity it immediately returns retryable 503
+        search_unavailable with Retry-After before storage or plugin work.
       requestBody:
         required: true
         content:
@@ -4589,7 +4591,14 @@ paths:
             space owner's length limit; the message names it), unsupported_search or source_filter_unavailable, 502 retrieval_plugin_invalid
             (the retrieval plugin broke its contract, for example ranked a segment the engine never served it), 503 dependency
             unavailable, 504 search_deadline_exceeded (the retrieval plugin's rounds outran the profile's hard bound, four
-            times max_latency_ms; a dependency that does not answer in time is 503).
+            times max_latency_ms; a dependency that does not answer in time is 503). At search capacity, 503 search_unavailable
+            includes Retry-After; retry only after that delay.
+          headers:
+            Retry-After:
+              description: Present when search capacity is full; minimum delay in seconds before retrying.
+              schema:
+                type: integer
+                minimum: 1
           content:
             application/json:
               schema:
```

**File**: `docs/reference/http-api.md` (modified, +2/-2)
```diff
@@ -1831,7 +1831,7 @@ The most frequent search queries of the key's Organization over the window, norm
 
 Operation `searchRecords`. Requires `content:read`, `search:query`.
 
-Resolve the requested profile, compile mandatory Corpus/Organization prefilters and any requested filter, obtain candidates, then canonically hydrate and reauthorize every returned segment. Lexical-first records remain eligible without embeddings; semantic-only queries require vector coverage. Profile selection does not change access/currentness rules. When a retrieval plugin is pinned, it ranks. It asks the engine for candidates in up to three rounds and returns its ranking, which may hold only candidates the engine served in this search, each already authorized and hydrated.
+Resolve the requested profile, compile mandatory Corpus/Organization prefilters and any requested filter, obtain candidates, then canonically hydrate and reauthorize every returned segment. Lexical-first records remain eligible without embeddings; semantic-only queries require vector coverage. Profile selection does not change access/currentness rules. When a retrieval plugin is pinned, it ranks. It asks the engine for candidates in up to three rounds and returns its ranking, which may hold only candidates the engine served in this search, each already authorized and hydrated. Each API process admits at most 64 active searches across callers. At capacity it immediately returns retryable 503 search_unavailable with Retry-After before storage or plugin work.
 
 **Request body** (required): `application/json` [`SearchRequest`](#searchrequest)
 
@@ -1840,7 +1840,7 @@ Resolve the requested profile, compile mandatory Corpus/Organization prefilters
 | Status | Body | Description |
 | --- | --- | --- |
 | `200` | `application/json` [`SearchResponse`](#searchresponse) | Successful response |
-| `default` | `application/json` [`Error`](#error) | Structured error; 400 malformed, 401 unauthenticated, 403 unauthorized scope/action, 404 absent/inaccessible, 409 idempotency conflict, 422 unsupported_profile, query_too_long (the query is over the profile's or the vector space owner's length limit; the message names it), unsupported_search or source_filter_unavailable, 502 retrieval_plugin_invalid (the retrieval plugin broke its contract, for example ranked a segment the engine never served it), 503 dependency unavailable, 504 search_deadline_exceeded (the retrieval plugin's rounds outran the profile's hard bound, four times max_latency_ms; a dependency that does not answer in time is 503). |
+| `default` | `application/json` [`Error`](#error)<br><br>Header `Retry-After`: integer. Present when search capacity is full; minimum delay in seconds before retrying. | Structured error; 400 malformed, 401 unauthenticated, 403 unauthorized scope/action, 404 absent/inaccessible, 409 idempotency conflict, 422 unsupported_profile, query_too_long (the query is over the profile's or the vector space owner's length limit; the message names it), unsupported_search or source_filter_unavailable, 502 retrieval_plugin_invalid (the retrieval plugin broke its contract, for example ranked a segment the engine never served it), 503 dependency unavailable, 504 search_deadline_exceeded (the retrieval plugin's rounds outran the profile's hard bound, four times max_latency_ms; a dependency that does not answer in time is 503). At search capacity, 503 search_unavailable includes Retry-After; retry only after that delay. |
 
 #### `GET /v0/search/profiles`
 
```

**File**: `internal/adapters/s3/blobs.go` (modified, +6/-0)
```diff
@@ -32,7 +32,13 @@ type Store struct {
 
 func New(cfg Config) *Store { return newWithTransport(cfg, outbound.Transport(nil)) }
 
+// Canonical hydration fans out across blobs. Retain connections between batches;
+// the default two idle connections churn ephemeral ports under concurrent searches.
+const canonicalIdleConnections = 128
+
 func newWithTransport(cfg Config, transport *http.Transport) *Store {
+	transport.MaxIdleConnsPerHost = canonicalIdleConnections
+	transport.MaxIdleConns = canonicalIdleConnections
 	client := awss3.NewFromConfig(aws.Config{Region: "us-east-1", Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")), HTTPClient: &http.Client{Timeout: 5 * time.Second, Transport: transport, CheckRedirect: outbound.CheckRedirect}}, func(o *awss3.Options) { o.BaseEndpoint = aws.String(cfg.Endpoint); o.UsePathStyle = true })
 	return &Store{client: client, bucket: cfg.Bucket}
 }
```

**File**: `internal/adapters/s3/read_pool_test.go` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+package s3_test
+
+import (
+	"context"
+	"fmt"
+	"net"
+	"net/http"
+	"net/http/httptest"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	store "github.com/The-Vibe-Company/quivr/internal/adapters/s3"
+	"github.com/The-Vibe-Company/quivr/internal/content"
+)
+
+// Concurrent hydration must reuse its connections between batches instead of
+// exhausting ephemeral ports during sustained searches. The server holds each
+// cohort until every read arrives; no timing assumption forces concurrency.
+func TestConcurrentCanonicalReadsReuseConnections(t *testing.T) {
+	const readers = 32
+	type wave struct {
+		arrived chan struct{}
+		release chan struct{}
+	}
+	var current atomic.Pointer[wave]
+	var connections atomic.Int32
+	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		batch := current.Load()
+		batch.arrived <- struct{}{}
+		select {
+		case <-batch.release:
+		case <-r.Context().Done():
+			return
+		}
+		w.Header().Set("Content-Length", "15")
+		fmt.Fprint(w, "canonical bytes")
+	}))
+	server.Config.ConnState = func(_ net.Conn, state http.ConnState) {
+		if state == http.StateNew {
+			connections.Add(1)
+		}
+	}
+	server.Start()
+	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
+	defer func() { cancel(); server.Close() }()
+	blobs := store.New(store.Config{Endpoint: server.URL, AccessKey: "local-test", SecretKey: "local-test", Bucket: "canonical"})
+	blob := content.Blob{Key: "org/sha256/object", SHA256: content.Hash([]byte("canonical bytes")), Size: 15}
+	for cohort := 0; cohort < 2; cohort++ {
+		batch := &wave{arrived: make(chan struct{}, readers), release: make(chan struct{})}
+		current.Store(batch)
+		results := make(chan error, readers)
+		for i := 0; i < readers; i++ {
+			go func() {
+				data, err := blobs.Read(ctx, blob)
+				if err == nil && string(data) != "canonical bytes" {
+					err = fmt.Errorf("read %q", data)
+				}
+				results <- err
+			}()
+		}
+		for i := 0; i < readers; i++ {
+			select {
+			case <-batch.arrived:
+			case <-ctx.Done():
+				close(batch.release)
+				t.Fatal("concurrent reads did not reach storage", ctx.Err())
+			}
+		}
+		close(batch.release)
+		for i := 0; i < readers; i++ {
+			if err := <-results; err != nil {
+				t.Fatal(err)
+			}
+		}
+	}
+	if got := connections.Load(); got != readers {
+		t.Fatalf("two %d-reader cohorts opened %d connections; want %d reused connections", readers, got, readers)
+	}
+}
```

**File**: `internal/transport/generated/transport.gen.go` (modified, +8/-0)
```diff
@@ -9026,8 +9026,13 @@ func (response SearchRecords200JSONResponse) VisitSearchRecordsResponse(w http.R
 	return err
 }
 
+type SearchRecordsdefaultResponseHeaders struct {
+	RetryAfter *int
+}
+
 type SearchRecordsdefaultJSONResponse struct {
 	Body       Error
+	Headers    SearchRecordsdefaultResponseHeaders
 	StatusCode int
 }
 
@@ -9038,6 +9043,9 @@ func (response SearchRecordsdefaultJSONResponse) VisitSearchRecordsResponse(w ht
 		return err
 	}
 	w.Header().Set("Content-Type", "application/json")
+	if response.Headers.RetryAfter != nil {
+		w.Header().Set("Retry-After", fmt.Sprint(*response.Headers.RetryAfter))
+	}
 	w.WriteHeader(response.StatusCode)
 	_, err := buf.WriteTo(w)
 	return err
```

---

### Incident Patch 7: `e2e62306` (2026-10-05)
**Commit Message**: feat(conformance): prove requirements with declarative cases (#3748)

Add a declarative conformance suite so contributors can express generic
requirements as YAML and maintainers can measure them locally. `make
conformance [suite=…] [version=…]` runs fixed check implementations
against an isolated fake-provider stack or explicit target inputs and
writes JSON/Markdown reports with met, not met, error and skipped
outcomes.

- Strict JSON Schema and safe YAML loading; known check parameters
reject typos, executable tags and duplicate keys/ids. Missing check
types require a maintainer ticket link and remain skipped until
implementation.
- Seven initial checks cover HTTP status/latency, OpenAPI validity,
exposed metrics, JSON log streams, image user/labels/image-bound Syft
SBOM, typed error responses and fixed invalid configurations.
- The example suite, contributor guide and Makefile integration explain
external case-only PRs and extension contracts. CI validates schemas and
cheap runner contracts; it never executes conformance cases or starts a
conformance stack.

Validation: thirteen runner owner tests; schema validation; local
fake-provider run and source-revision run; make check, m

**File**: `Makefile` (modified, +11/-2)
```diff
@@ -1,5 +1,5 @@
 GO ?= go
-.PHONY: dev env check verify down reset migrate adapter-postgres test contracts generate demo demo-reset verify-demo demo-perf measure measure-backfill measure-upgrade eval load docs start-pages docs-site docs-site-check docs-preview denylist migrations migration migration-restamp image-context plugin-boundary
+.PHONY: dev env check verify down reset migrate adapter-postgres test contracts generate demo demo-reset verify-demo demo-perf measure measure-backfill measure-upgrade eval load docs start-pages docs-site docs-site-check docs-preview denylist migrations migration migration-restamp image-context plugin-boundary conformance conformance-validate
 
 dev down reset migrate:
 	GO=$(GO) python3 scripts/local.py $@
@@ -16,7 +16,7 @@ verify-demo:
 demo-perf:
 	GO=$(GO) python3 scripts/demo.py perf
 # Everything that needs no Docker stack; run it before pushing (about two minutes on a laptop).
-check: docs denylist migrations contracts image-context plugin-boundary test
+check: docs denylist migrations contracts image-context plugin-boundary conformance-validate test
 # make check, then every part of the stack verification one after another, then the demo.
 # make verify part=<name>[,<name>] runs only those parts, without make check; parts are listed
 # in scripts/local.py (parts) and CI runs them in parallel.
@@ -29,6 +29,7 @@ test:
 	$(GO) vet ./...
 	$(GO) test ./...
 	cd tests/fakes && $(GO) vet ./... && $(GO) test ./...
+	$(CONFORMANCE_PYTHON) -m unittest conformance.test_runner
 	python3 -m unittest discover -s scripts -p 'test_*.py'
 	python3 -m unittest discover -s scripts/eval -p 'test_*.py'
 	GO=$(GO) bash scripts/plugin_sdk.sh
@@ -90,3 +91,11 @@ migration:
 # Move a migration after main's latest: make migration-restamp file=<name>.sql
 migration-restamp:
 	python3 scripts/migrations.py restamp $(file)
+
+# Local requirement measurements, never run by CI. Example: make conformance suite=example version=v2.0.0-alpha.1
+CONFORMANCE_PYTHON ?= python3
+conformance:
+	GO=$(GO) $(CONFORMANCE_PYTHON) conformance/runner.py --suite "$(or $(suite),example)" $(if $(version),--version "$(version)") $(args)
+# make check needs conformance/requirements.txt (the same pins installed by the CI contract lane).
+conformance-validate:
+	$(CONFORMANCE_PYTHON) conformance/runner.py --validate
```

**File**: `README.md` (modified, +3/-0)
```diff
@@ -86,6 +86,9 @@ For a browser UI over the same API, run `make demo` and open http://127.0.0.1:51
 
 ## What works today
 
+- **Declarative conformance cases**: contribute generic requirements and measure them locally with
+  `make conformance`; [case format and reports](conformance/README.md). CI never executes cases.
+
 - **Outgoing TLS** for Temporal, Weaviate, PostgreSQL, S3 and plugins, with verified
   certificates and configurable trust. Incoming HTTPS terminates at your platform;
   see [Run Quivr behind TLS](https://docs.quivr.thevibecompany.co/run-quivr/tls).
```

**File**: `conformance/README.md` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+# Prove requirements with conformance cases
+
+Add a requirement as a YAML case, then run `make conformance` to see its measurement and evidence. You can contribute cases from an external repository by opening a pull request against this repository.
+
+## Prerequisites
+
+Use Python 3.12 or newer and install the pinned tooling:
+
+```sh
+python3 -m pip install -r conformance/requirements.txt
+```
+
+For an isolated stack, use Go 1.27.1, Docker with Compose v2, make, and Linux x86_64 or macOS arm64. See the [local harness guide](../docs/quivr-v2-local-harness.md). It allocates separate ports and containers, uses local fake external services and E5 embeddings, and attempts to remove every owned process and volume when finished. Teardown failures mark the run as an error and are included in both reports. It downloads pinned dependencies and model files; it needs no paid provider key.
+
+## Add a case
+
+1. Fork this repository, create a branch, and add one YAML file per requirement under `conformance/suites/<suite>/`. Start from the neutral [example suite](suites/example/).
+2. Choose an opaque `id`, unique within your suite, that contains no organization name. Keep ids stable when editing a requirement. Cases, descriptions and thresholds must be generic; private requirements and datasets stay in your own repository.
+3. Choose a maintainer-owned `check`, its `parameters` and the expected `threshold`. The [JSON Schema](schema/case.schema.json) is authoritative. Cases contain data only: no commands, imports, templates, custom YAML tags, anchors or aliases.
+4. Run static validation and the generic-content guard:
+
+```sh
+make conformance-validate
+make denylist
+```
+
+5. Open a pull request that adds or edits cases only. Explain what observable requirement each case proves, why the threshold is useful and which target inputs it needs. Your external repository's command for opening the pull request belongs there.
+
+For example, a route must answer with status 204 within 1000 ms:
+
+```yaml
+id: EXNF-HTTP-001
+check: http_probe
+parameters:
+  target: probe
+  path: /healthz
+threshold:
+  status: 204
+  max_latency_ms: 1000
+```
+
+Reviewers accept stable generic ids, a meaningful measurable requirement, strict schema validity and thresholds with a stated rationale. They review changes to check code separately as maintainer work. CI validates case schemas and runs the runner's small owner tests; it never starts a conformance stack or executes contributed cases.
+
+## Run and read the evidence
+
+Run the example requirements against the current working tree:
+
+```sh
+make conformance suite=example
+```
+
+The runner writes `.scratch/conformance/report.json` and `.scratch/conformance/report.md`. Each result includes its case file, check, threshold, measurement, evidence hashes and reason. Both formats record the source revision, source and harness dirtiness, harness revision and target evidence. Repeating a run replaces these reports; use `args='--output <directory>'` to keep separate runs.
+
+| Status | Meaning |
+| --- | --- |
+| `met` | The observed value satisfies every threshold in that case. |
+| `not met` | A measurement exists and violates the requirement. |
+| `error` | The check could not finish, for example a connection or capture failed. |
+| `skipped` | An input or check type is missing; the reason says which. |
+
+The runner's exit code 0 means every measured case passed; skipped cases can remain. Exit code 1 means a requirement failed or a run/check error occurred. Exit code 2 means input/schema validation or pre-run source/filesystem setup failed. Make reports any nonzero runner exit as a failed target. An empty log stream is `not met`; an unsupplied capture is `skipped`. A skipped case never proves conformance.
+
+The example includes a stdout logging requirement and image properties. These can fail or be skipped on today's stack. The suite records gaps as well as passes; it does not change engine behavior to satisfy them.
+
+To build a specific Git revision, use a local tag or commit. This command was checked with `HEAD`:
+
+```sh
+make conformance suite=example version=HEAD
+```
+
+The runner archives that revision into a temporary source directory, builds it with the current harness, and removes the archive after teardown. The report distinguishes the tested source revision from the harness revision. Use revisions compatible with the current harness; this is a source-build comparison, not a release-image deployment.
+
+To target an existing stack, replace the example addresses and paths below with its own. This example was not executed against an external deployment:
+
+```sh
+make conformance suite=example args='--api-url http://127.0.0.1:41863 \
+  --probe-url http://127.0.0.1:41864 --binary /path/to/quivr \
+  --stdout-log /path/to/api-stdout.log --stderr-log /path/to/api-stderr.log'
+```
+
+Set `QUIVR_CONFORMANCE_API_KEY` in your environment only for cases with `authe
```

**File**: `conformance/checks/__init__.py` (added, +267/-0)
```diff
@@ -0,0 +1,267 @@
+"""Maintainer-owned checks. Cases select data, never commands or Python imports."""
+import hashlib
+import json
+import math
+import os
+import pathlib
+import re
+import subprocess
+import tempfile
+import time
+import urllib.error
+import urllib.request
+from dataclasses import dataclass, field
+from typing import Optional
+
+LIMIT = 4 * 1024 * 1024
+
+
+class Skip(Exception):
+    """The runner lacks an input needed to measure a requirement."""
+
+
+@dataclass
+class Observation:
+    met: bool
+    measurement: object
+    evidence: dict
+    reason: str = ''
+
+
+def read_bytes(path):
+    with pathlib.Path(path).open('rb') as source:
+        data = source.read(LIMIT + 1)
+    if len(data) > LIMIT:
+        raise ValueError('evidence exceeds 4 MiB; supply a bounded capture')
+    return data
+
+
+def digest(data):
+    return hashlib.sha256(data).hexdigest()
+
+
+def parse_json(raw):
+    def refuse_constant(value):
+        raise ValueError('non-standard JSON constant')
+    value = json.loads(raw, parse_constant=refuse_constant)
+    def finite(item):
+        if isinstance(item, float) and not math.isfinite(item):
+            raise ValueError('non-finite JSON number')
+        if isinstance(item, dict):
+            for child in item.values():finite(child)
+        elif isinstance(item, list):
+            for child in item:finite(child)
+    finite(value)
+    return value
+
+
+class NoRedirect(urllib.request.HTTPRedirectHandler):
+    def redirect_request(self, req, fp, code, msg, headers, newurl):
+        return None
+
+
+@dataclass
+class Context:
+    api_url: str = ''
+    probe_url: str = ''
+    api_key: str = field(default='', repr=False)
+    logs: dict = field(default_factory=dict)
+    binary: Optional[pathlib.Path] = None
+    image: str = ''
+    sbom: Optional[pathlib.Path] = None
+    openapi: Optional[pathlib.Path] = None
+    evidence_dir: Optional[pathlib.Path] = None
+    timeout: float = 5
+
+    def request(self, parameters, path=None):
+        base = self.probe_url if parameters.get('target', 'api') == 'probe' else self.api_url
+        if not base:
+            raise Skip('no ' + parameters.get('target', 'api') + ' URL supplied')
+        route = path or parameters['path']
+        # Defense in depth: never let a route replace the trusted operator-selected target.
+        if not route.startswith('/') or route.startswith('//') or '\\' in route:
+            raise ValueError('path must be a relative HTTP route')
+        headers = {}
+        if parameters.get('authenticated'):
+            if not self.api_key:
+                raise Skip('authenticated probe needs QUIVR_CONFORMANCE_API_KEY')
+            headers['Authorization'] = 'Bearer ' + self.api_key
+        request = urllib.request.Request(base.rstrip('/') + route, headers=headers)
+        start = time.monotonic()
+        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
+        try:
+            response = opener.open(request, timeout=self.timeout)
+        except urllib.error.HTTPError as error:
+            response = error
+        with response:
+            data = response.read(LIMIT + 1)
+            if len(data) > LIMIT:
+                raise ValueError('HTTP evidence exceeds 4 MiB')
+            return response.code, response.headers, data, round((time.monotonic() - start) * 1000, 3)
+
+
+def http_probe(context, parameters, threshold):
+    status, _, body, elapsed = context.request(parameters)
+    measurement = {'status': status, 'latency_ms': elapsed}
+    return Observation(status == threshold['status'] and elapsed <= threshold['max_latency_ms'],
+                       measurement, {'body_sha256': digest(body), 'path': parameters['path'],
+                                     'target': parameters.get('target', 'api')})
+
+
+def openapi_valid(context, parameters, threshold):
+    if not context.openapi:
+        raise Skip('no OpenAPI contract supplied for this target version')
+    # The trusted contract bundles local shared schemas; cases cannot select $ref URLs.
+    import yaml
+    from openapi_spec_validator import validate
+    raw = read_bytes(context.openapi)
+    evidence = {'source_sha256': digest(raw), 'file': str(context.openapi)}
+    try:
+        spec = yaml.safe_load(raw)
+        # Bundle Quivr's split local contract using its source-owned helper when present.
+        bundle = context.openapi.parent / 'bundle.py'
+        if bundle.exists():
+            import importlib.util
+            module_spec = importlib.util.spec_from_file_location('conformance_openapi_bundle', bundle)
+            module = importlib.util.module_from_spec(module_spec)
+            module_spec.loader.exec_module(module)
+            spec = module.load()
+        evidence['contract_sha256'] = digest(json.dumps(spec, sort_keys=True, separators=(',', ':'), allow_nan=False).encode())
+        validate(spec)
+    except Exception as error:
+        # Do not
```

**File**: `conformance/requirements.txt` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+-r ../contracts/http/v0/checks/requirements.txt
```

**File**: `conformance/runner.py` (added, +309/-0)
```diff
@@ -0,0 +1,309 @@
+#!/usr/bin/env python3
+"""Validate declarative cases or run them locally and retain a complete evidence report."""
+import argparse
+from contextlib import contextmanager
+import datetime
+import json
+import os
+import pathlib
+import subprocess
+import sys
+import tempfile
+import signal
+import uuid
+
+import yaml
+from jsonschema import Draft202012Validator
+
+ROOT = pathlib.Path(__file__).resolve().parents[1]
+if str(ROOT) not in sys.path:
+    sys.path.insert(0, str(ROOT))
+from conformance.checks import CHECKS, Context, Skip, digest
+
+
+class CaseLoader(yaml.SafeLoader):
+    def construct_mapping(self, node, deep=False):
+        keys = [self.construct_object(key, deep=deep) for key, _ in node.value]
+        if any(not isinstance(key, str) for key in keys) or len(keys) != len(set(keys)):
+            raise ValueError('case keys must be unique strings')
+        return super().construct_mapping(node, deep=deep)
+
+
+def load_cases(suite):
+    schema = json.loads((ROOT / 'conformance/schema/case.schema.json').read_text())
+    Draft202012Validator.check_schema(schema)
+    conditions = []
+    for rule in schema.get('allOf', []):
+        condition = rule.get('if') if isinstance(rule, dict) else None
+        if not isinstance(condition, dict):continue
+        check = condition.get('properties', {}).get('check')
+        if isinstance(check, dict):conditions.append(check)
+    shaped = {condition['const'] for condition in conditions if isinstance(condition.get('const'), str)}
+    known = {name for condition in conditions if isinstance(condition.get('not'), dict)
+             for name in condition['not'].get('enum', []) if isinstance(name, str)}
+    if shaped != set(CHECKS) or known != set(CHECKS):
+        raise ValueError('check registry and schema must register the same check types')
+    validator = Draft202012Validator(schema)
+    files = sorted(list(suite.glob('*.yaml')) + list(suite.glob('*.yml')))
+    if not files:
+        raise ValueError('suite has no YAML cases: ' + str(suite))
+    cases, ids = [], set()
+    for path in files:
+        try:
+            if path.is_symlink() or path.stat().st_size > 128 * 1024:
+                raise ValueError('cases must be regular files of at most 128 KiB')
+            text = path.read_text()
+            # Aliases/anchors are unnecessary for a single case and can amplify hostile input.
+            if any(isinstance(token, (yaml.tokens.AliasToken, yaml.tokens.AnchorToken)) for token in yaml.scan(text)):
+                raise ValueError('YAML aliases and anchors are not allowed')
+            case = yaml.load(text, Loader=CaseLoader)
+            json.dumps(case, allow_nan=False)  # Require finite JSON data, not YAML dates/types.
+            errors = sorted(validator.iter_errors(case), key=lambda error: str(error.path))
+            if errors:
+                error = errors[0]
+                raise ValueError('schema rejected ' + '/'.join(str(item) for item in error.path) + ': ' + error.validator)
+            if case['id'] in ids:
+                raise ValueError('duplicate requirement id: ' + case['id'])
+            ids.add(case['id'])
+            cases.append((path, case))
+        except (ValueError, TypeError, yaml.YAMLError, RecursionError) as error:
+            # Avoid echoing untrusted YAML tags/content in validator errors.
+            if isinstance(error, ValueError) and not isinstance(error, yaml.YAMLError):
+                reason = str(error)
+            else:
+                reason = type(error).__name__
+            raise ValueError(str(path) + ': ' + reason) from error
+    return cases
+
+
+def case_result(path, case):
+    result = {'id': case['id'], 'check': case['check'], 'case_file': str(path),
+              'threshold': case['threshold'], 'measurement': None, 'evidence': {}, 'reason': ''}
+    if case.get('maintainer_ticket'):
+        result['maintainer_ticket'] = case['maintainer_ticket']
+    return result
+
+
+def run_cases(cases, context):
+    results = []
+    for path, case in cases:
+        result = case_result(path, case)
+        try:
+            if case['check'] not in CHECKS:
+                raise Skip('needs check type ' + case['check'])
+            observation = CHECKS[case['check']](context, case['parameters'], case['threshold'])
+            result.update(status='met' if observation.met else 'not met', measurement=observation.measurement,
+                          evidence=observation.evidence, reason=observation.reason)
+        except Skip as error:
+            result.update(status='skipped', reason=str(error))
+        except Exception as error:
+            # Bodies, subprocess output and config must never leak through exception messages.
+            result.update(status='error', reason='check failed: ' + type(error).__name__)
+        results.append(result)
+    return results
+
+
+def write_report(directory, report):
+    directory.mkdir(parents=True, exist_ok=T
```

**File**: `conformance/schema/case.schema.json` (added, +403/-0)
```diff
@@ -0,0 +1,403 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://quivr.dev/conformance/case.schema.json",
+  "description": "One declarative requirement. Unknown checks require a maintainer ticket and are skipped.",
+  "type": "object",
+  "properties": {
+    "id": {
+      "type": "string",
+      "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
+    },
+    "description": {
+      "type": "string",
+      "maxLength": 1000
+    },
+    "check": {
+      "type": "string",
+      "pattern": "^[a-z][a-z0-9_]{0,63}$"
+    },
+    "parameters": {
+      "type": "object"
+    },
+    "threshold": {
+      "type": "object"
+    },
+    "maintainer_ticket": {
+      "type": "string",
+      "pattern": "^https://[^\\s]+$",
+      "maxLength": 2048
+    }
+  },
+  "required": [
+    "id",
+    "check",
+    "parameters",
+    "threshold"
+  ],
+  "additionalProperties": false,
+  "allOf": [
+    {
+      "if": {
+        "properties": {
+          "check": {
+            "const": "http_probe"
+          }
+        }
+      },
+      "then": {
+        "properties": {
+          "parameters": {
+            "type": "object",
+            "properties": {
+              "path": {
+                "type": "string",
+                "pattern": "^/(?!/)[^\\s\\\\#]*$",
+                "maxLength": 1024
+              },
+              "target": {
+                "enum": [
+                  "api",
+                  "probe"
+                ]
+              },
+              "authenticated": {
+                "type": "boolean"
+              }
+            },
+            "required": [
+              "path"
+            ],
+            "additionalProperties": false
+          },
+          "threshold": {
+            "type": "object",
+            "properties": {
+              "status": {
+                "type": "integer",
+                "minimum": 100,
+                "maximum": 599
+              },
+              "max_latency_ms": {
+                "type": "number",
+                "minimum": 0,
+                "maximum": 60000
+              }
+            },
+            "required": [
+              "status",
+              "max_latency_ms"
+            ],
+            "additionalProperties": false
+          }
+        }
+      }
+    },
+    {
+      "if": {
+        "properties": {
+          "check": {
+            "const": "openapi_valid"
+          }
+        }
+      },
+      "then": {
+        "properties": {
+          "parameters": {
+            "type": "object",
+            "properties": {},
+            "required": [],
+            "additionalProperties": false
+          },
+          "threshold": {
+            "type": "object",
+            "properties": {
+              "valid": {
+                "const": true
+              }
+            },
+            "required": [
+              "valid"
+            ],
+            "additionalProperties": false
+          }
+        }
+      }
+    },
+    {
+      "if": {
+        "properties": {
+          "check": {
+            "const": "metric_exposed"
+          }
+        }
+      },
+      "then": {
+        "properties": {
+          "parameters": {
+            "type": "object",
+            "properties": {
+              "name": {
+                "type": "string",
+                "pattern": "^[a-zA-Z_:][a-zA-Z0-9_:]*$",
+                "maxLength": 200
+              }
+            },
+            "required": [
+              "name"
+            ],
+            "additionalProperties": false
+          },
+          "threshold": {
+            "type": "object",
+            "properties": {
+              "type": {
+                "enum": [
+                  "counter",
+                  "gauge",
+                  "histogram",
+                  "summary",
+                  "untyped"
+                ]
+              }
+            },
+            "required": [
+              "type"
+            ],
+            "additionalProperties": false
+          }
+        }
+      }
+    },
+    {
+      "if": {
+        "properties": {
+          "check": {
+            "const": "log_format"
+          }
+        }
+      },
+      "then": {
+        "properties": {
+          "parameters": {
+            "type": "object",
+            "properties": {
+              "stream": {
+                "enum": [
+                  "stdout",
+                  "stderr"
+                ]
+              }
+            },
+            "required": [
+              "stream"
+            ],
+            "additionalProperties": false
+          },
+          "threshold": {
+            "type": "object",
+            "properties": {
+              "fields": {
+                "type": "array",
+                "items": {
+                  "type": "string",
+                  "minLength": 1,
+                  "maxLength": 200
+                },
+                "minItems": 1,
+                "maxItems": 32,
+         
```

**File**: `conformance/suites/example/config.yaml` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+id: EXNF-CONFIG-001
+check: config_refuses_invalid
+parameters:
+  fixture: unknown_field
+threshold:
+  exit_code: 1
+  diagnostic: unknown field
```

---

### Incident Patch 8: `f12e22c1` (2026-10-05)
**Commit Message**: fix(sdk): send plugin replies promptly during article bursts (#3750)

## What changes

Small HTTP/1.1 plugin responses now send promptly on persistent
connections: the Python SDK enables TCP_NODELAY so separately written
headers and JSON bodies do not wait for a delayed acknowledgement. A
caller disconnect during request handling ends that connection without a
BrokenPipeError/ConnectionResetError/ConnectionAbortedError server
traceback. Plugin responses, matching and retry semantics remain
unchanged.

## Profiling and measurements

The server already uses ThreadingHTTPServer; monitoring already runs
four workers and batches all six alerts for each article. Keyword
matching performs no I/O. After the schema-check cache on main, ten
six-alert records took 93 ms under cProfile: 20 ms in keyword handling
and 54 ms in validation. The remaining repeatable HTTP cost was
Nagle/delayed-ACK interaction when the SDK writes headers and a small
body separately.

On the same 800-record HTTP workload with four persistent clients,
elapsed time fell **9.681 → 3.779 s (2.56× throughput)**; call p50 fell
48.0 → 17.3 ms and p95 52.0 → 30.9 ms.

The isolated local stack used real PostgreSQL, Temporal, 

**File**: `sdks/python/src/quivr_plugin/server.py` (modified, +12/-0)
```diff
@@ -485,6 +485,18 @@ def make_server(self, host: str = "127.0.0.1", port: int = 0) -> ThreadingHTTPSe
         class Handler(BaseHTTPRequestHandler):
             protocol_version = "HTTP/1.1"
             server_version = _server_version()
+            # Headers and small JSON bodies are written separately. Send
+            # each promptly instead of waiting for the client's delayed ACK.
+            disable_nagle_algorithm = True
+
+            def handle(self) -> None:
+                try:
+                    super().handle()
+                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
+                    # The engine may give up at its invocation deadline. A
+                    # disconnected peer is not a plugin failure or traceback.
+                    self.close_connection = True
+                    log.debug("plugin caller disconnected")
 
             def _serve(self, method: str) -> None:
                 raw_length = self.headers.get("Content-Length") or "0"
```

**File**: `sdks/python/tests/test_server.py` (modified, +70/-0)
```diff
@@ -4,6 +4,9 @@
 import io
 import json
 import logging
+import socket
+import struct
+import sys
 import tempfile
 import threading
 import unittest
@@ -162,6 +165,73 @@ def test_records_carry_the_invocation_id(self):
 
 
 class HTTPTransport(Base):
+    def test_disconnected_caller_does_not_raise_a_server_error(self):
+        entered, release, finished = (threading.Event() for _ in range(3))
+
+        @self.plugin.health_check
+        def held_health_check():
+            entered.set()
+            if not release.wait(5):
+                raise RuntimeError("test did not release the health check")
+
+        server = self.plugin.make_server("127.0.0.1", 0)
+        errors = []
+        finish = server.process_request_thread
+
+        def observed_finish(*args):
+            try:
+                finish(*args)
+            finally:
+                finished.set()
+
+        server.process_request_thread = observed_finish
+        server.handle_error = lambda *_: errors.append(sys.exc_info()[1])
+        threading.Thread(target=server.serve_forever, daemon=True).start()
+        self.addCleanup(server.server_close)
+        self.addCleanup(server.shutdown)
+        self.addCleanup(release.set)
+        connection = socket.create_connection(("127.0.0.1", server.server_port), timeout=5)
+        self.addCleanup(connection.close)
+        connection.sendall(b"GET /v0/health HTTP/1.1\r\nHost: localhost\r\n\r\n")
+        self.assertTrue(entered.wait(5), "request did not reach the health handler")
+        # Reset the TCP connection before allowing the response to be written.
+        connection.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack("ii", 1, 0))
+        connection.close()
+        release.set()
+        self.assertTrue(finished.wait(5), "disconnected request did not finish")
+        self.assertEqual(errors, [], "a caller hang-up must not escape as a server error")
+        with urllib.request.urlopen(f"http://127.0.0.1:{server.server_port}/v0/health", timeout=5) as response:
+            self.assertEqual(json.load(response), {"status": "ok"})
+
+    def test_persistent_responses_disable_nagle(self):
+        # Small protocol replies must not wait for a delayed ACK between
+        # their headers and body. Observe the actual accepted TCP socket;
+        # latency thresholds belong in the separate burst measurement.
+        server = self.plugin.make_server("127.0.0.1", 0)
+        accepted = []
+        accept = server.get_request
+
+        def capture_socket():
+            connection, address = accept()
+            accepted.append(connection)
+            return connection, address
+
+        server.get_request = capture_socket
+        threading.Thread(target=server.serve_forever, daemon=True).start()
+        self.addCleanup(server.server_close)
+        self.addCleanup(server.shutdown)
+        import http.client
+
+        connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
+        self.addCleanup(connection.close)
+        for _ in range(2):
+            connection.request("GET", "/v0/health")
+            response = connection.getresponse()
+            self.assertEqual(response.status, 200)
+            self.assertEqual(json.loads(response.read()), {"status": "ok"})
+        self.assertEqual(len(accepted), 1, "both responses should reuse the connection")
+        self.assertEqual(accepted[0].getsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY), 1)
+
     def test_routes_over_http(self):
         server = self.plugin.make_server("127.0.0.1", 0)
         thread = threading.Thread(target=server.serve_forever, daemon=True)
```

---

### Incident Patch 9: `4f57f716` (2026-10-05)
**Commit Message**: fix(monitoring): keep alert previews within their deadline (#3742)

Pre-save alert previews return caught articles or an honest empty
result. Overloaded evaluations return partial results before the request
deadline; timeouts and real storage failures use plain French messages
in the form.

The root cause was a **5 s HTTP request context competing with a 6 s
evaluator budget**, started after preparation. The request deadline won
and `context.DeadlineExceeded` fell through to `storage_unavailable`.
The facade upstream timeout is 8 s. PostgreSQL recent-record ordering
tests pass. Repeated `Draft202012Validator.check_schema` calls on the
same complex evaluator schema also added avoidable work to previews and
live evaluations.

The preview now shares a 4 s budget across input decoding, query
preparation, storage reads and bounded evaluation. A preparation/parent
deadline returns retryable 504 `preview_deadline_exceeded`; a true
storage failure remains 503. An early evaluator failure retains its
error even when another evaluation later reaches the budget. The Python
SDK caches checked schemas in a bounded, content-keyed LRU and
constructs a validator per invocation. Schema mutation chan

**File**: `client/client.gen.go` (modified, +8/-8)
```diff
@@ -4359,13 +4359,13 @@ type ClientInterface interface {
 	// PreviewSubscriptionWithBody performs a POST /v0/subscription-previews (the `PreviewSubscription` operationId) request,
 	// with any type of body and a specified content type.
 	//
-	// Dry run of a proposed Subscription. Runs the evaluator on the most recently accepted current eligible Record Versions of the Saved Query's Corpora, newest first, and returns what it would have matched. Nothing is written - no Saved Query, Subscription, Match, Delivery or event - and it is not idempotent. The Saved Query is an inline definition or an existing Saved Query Version; the pair is validated as at Subscription creation (422 unsupported_evaluator, invalid_expression, invalid_subscription_configuration). Each Record Version costs one evaluator call, sent with the synthetic Subscription reference preview. At most limit Record Versions (1 to 50, default 20) are judged, within a time budget of a few seconds; those still undecided when it runs out are left out and complete is false. An evaluator that cannot be reached or reports a transient failure fails the preview with 503 evaluator_unavailable, and one that refuses or breaks an evaluation with 502 evaluator_error. Quivr applies no rate or cost rule; a layer above can limit who previews and how often.
+	// Dry run of a proposed Subscription. Runs the evaluator on the most recently accepted current eligible Record Versions of the Saved Query's Corpora, newest first, and returns what it would have matched. Nothing is written - no Saved Query, Subscription, Match, Delivery or event - and it is not idempotent. The Saved Query is an inline definition or an existing Saved Query Version; the pair is validated as at Subscription creation (422 unsupported_evaluator, invalid_expression, invalid_subscription_configuration). Each Record Version costs one evaluator call, sent with the synthetic Subscription reference preview. At most limit Record Versions (1 to 50, default 20) are judged, within a four-second budget including preparation and storage reads; those still undecided when it runs out are left out and complete is false. An evaluator that cannot be reached or reports a transient failure fails the preview with 503 evaluator_unavailable, and one that refuses or breaks an evaluation with 502 evaluator_error. A deadline during preparation or an earlier caller deadline returns retryable 504 preview_deadline_exceeded. A storage failure remains 503 storage_unavailable. Quivr applies no rate or cost rule; a layer above can limit who previews and how often.
 	PreviewSubscriptionWithBody(ctx context.Context, contentType string, body io.Reader, reqEditors ...RequestEditorFn) (*http.Response, error)
 
 	// PreviewSubscription performs a POST /v0/subscription-previews (the `PreviewSubscription` operationId) request.
 	// Takes a body of the `application/json` content type.
 	//
-	// Dry run of a proposed Subscription. Runs the evaluator on the most recently accepted current eligible Record Versions of the Saved Query's Corpora, newest first, and returns what it would have matched. Nothing is written - no Saved Query, Subscription, Match, Delivery or event - and it is not idempotent. The Saved Query is an inline definition or an existing Saved Query Version; the pair is validated as at Subscription creation (422 unsupported_evaluator, invalid_expression, invalid_subscription_configuration). Each Record Version costs one evaluator call, sent with the synthetic Subscription reference preview. At most limit Record Versions (1 to 50, default 20) are judged, within a time budget of a few seconds; those still undecided when it runs out are left out and complete is false. An evaluator that cannot be reached or reports a transient failure fails the preview with 503 evaluator_unavailable, and one that refuses or breaks an evaluation with 502 evaluator_error. Quivr applies no rate or cost rule; a layer above can limit who previews and how often.
+	// Dry run of a proposed Subscription. Runs the evaluator on the most recently accepted current eligible Record Versions of the Saved Query's Corpora, newest first, and returns what it would have matched. Nothing is written - no Saved Query, Subscription, Match, Delivery or event - and it is not idempotent. The Saved Query is an inline definition or an existing Saved Query Version; the pair is validated as at Subscription creation (422 unsupported_evaluator, invalid_expression, invalid_subscription_configuration). Each Record Version costs one evaluator call, sent with the synthetic Subscription reference preview. At most limit Record Versions (1 to 50, default 20) are judged, within a four-second budget including preparation and storage reads; those still undecided when it runs out are left out and complete is false. An evaluator that cannot be reached or reports a transient failure fails the preview with 503 evaluator_unavailable, and one that refuses or breaks an evaluation with 502 evaluat
```

**File**: `contracts/http/v0/openapi.yaml` (modified, +9/-2)
```diff
@@ -285,6 +285,10 @@ x-public-errors:
     status_class: 504
     retryable: false
     operations: [searchRecords]
+  preview_deadline_exceeded:
+    status_class: 504
+    retryable: true
+    operations: [previewSubscription]
   search_unavailable:
     status_class: 503
     retryable: true
@@ -1693,10 +1697,13 @@ paths:
         Version; the pair is validated as at Subscription creation (422 unsupported_evaluator,
         invalid_expression, invalid_subscription_configuration). Each Record Version costs one evaluator
         call, sent with the synthetic Subscription reference preview. At most limit Record Versions
-        (1 to 50, default 20) are judged, within a time budget of a few seconds; those still undecided
+        (1 to 50, default 20) are judged, within a four-second budget including preparation and storage
+        reads; those still undecided
         when it runs out are left out and complete is false. An evaluator that cannot be reached or
         reports a transient failure fails the preview with 503 evaluator_unavailable, and one that
-        refuses or breaks an evaluation with 502 evaluator_error. Quivr applies no rate or cost rule; a
+        refuses or breaks an evaluation with 502 evaluator_error. A deadline during preparation or
+        an earlier caller deadline returns retryable 504 preview_deadline_exceeded. A storage failure
+        remains 503 storage_unavailable. Quivr applies no rate or cost rule; a
         layer above can limit who previews and how often.
       x-required-permissions:
       - monitoring:write
```

**File**: `docs-site/openapi.yaml` (modified, +10/-4)
```diff
@@ -997,6 +997,11 @@ x-public-errors:
     retryable: false
     operations:
     - searchRecords
+  preview_deadline_exceeded:
+    status_class: 504
+    retryable: true
+    operations:
+    - previewSubscription
   search_unavailable:
     status_class: 503
     retryable: true
@@ -2613,10 +2618,11 @@ paths:
         or an existing Saved Query Version; the pair is validated as at Subscription creation (422 unsupported_evaluator,
         invalid_expression, invalid_subscription_configuration). Each Record Version costs one evaluator call, sent with the
         synthetic Subscription reference preview. At most limit Record Versions (1 to 50, default 20) are judged, within a
-        time budget of a few seconds; those still undecided when it runs out are left out and complete is false. An evaluator
-        that cannot be reached or reports a transient failure fails the preview with 503 evaluator_unavailable, and one that
-        refuses or breaks an evaluation with 502 evaluator_error. Quivr applies no rate or cost rule; a layer above can limit
-        who previews and how often.
+        four-second budget including preparation and storage reads; those still undecided when it runs out are left out and
+        complete is false. An evaluator that cannot be reached or reports a transient failure fails the preview with 503 evaluator_unavailable,
+        and one that refuses or breaks an evaluation with 502 evaluator_error. A deadline during preparation or an earlier
+        caller deadline returns retryable 504 preview_deadline_exceeded. A storage failure remains 503 storage_unavailable.
+        Quivr applies no rate or cost rule; a layer above can limit who previews and how often.
       x-required-permissions:
       - monitoring:write
       responses:
```

**File**: `docs/reference/http-api.md` (modified, +1/-1)
```diff
@@ -920,7 +920,7 @@ Change the display name of a Subscription. The name belongs to the Subscription,
 
 Operation `previewSubscription`. Requires `monitoring:write`.
 
-Dry run of a proposed Subscription. Runs the evaluator on the most recently accepted current eligible Record Versions of the Saved Query's Corpora, newest first, and returns what it would have matched. Nothing is written - no Saved Query, Subscription, Match, Delivery or event - and it is not idempotent. The Saved Query is an inline definition or an existing Saved Query Version; the pair is validated as at Subscription creation (422 unsupported_evaluator, invalid_expression, invalid_subscription_configuration). Each Record Version costs one evaluator call, sent with the synthetic Subscription reference preview. At most limit Record Versions (1 to 50, default 20) are judged, within a time budget of a few seconds; those still undecided when it runs out are left out and complete is false. An evaluator that cannot be reached or reports a transient failure fails the preview with 503 evaluator_unavailable, and one that refuses or breaks an evaluation with 502 evaluator_error. Quivr applies no rate or cost rule; a layer above can limit who previews and how often.
+Dry run of a proposed Subscription. Runs the evaluator on the most recently accepted current eligible Record Versions of the Saved Query's Corpora, newest first, and returns what it would have matched. Nothing is written - no Saved Query, Subscription, Match, Delivery or event - and it is not idempotent. The Saved Query is an inline definition or an existing Saved Query Version; the pair is validated as at Subscription creation (422 unsupported_evaluator, invalid_expression, invalid_subscription_configuration). Each Record Version costs one evaluator call, sent with the synthetic Subscription reference preview. At most limit Record Versions (1 to 50, default 20) are judged, within a four-second budget including preparation and storage reads; those still undecided when it runs out are left out and complete is false. An evaluator that cannot be reached or reports a transient failure fails the preview with 503 evaluator_unavailable, and one that refuses or breaks an evaluation with 502 evaluator_error. A deadline during preparation or an earlier caller deadline returns retryable 504 preview_deadline_exceeded. A storage failure remains 503 storage_unavailable. Quivr applies no rate or cost rule; a layer above can limit who previews and how often.
 
 **Request body** (required): `application/json` [`SubscriptionPreviewRequest`](#subscriptionpreviewrequest)
 
```

**File**: `internal/monitoring/monitoring.go` (modified, +1/-1)
```diff
@@ -240,7 +240,7 @@ type Service struct {
 	// are not served.
 	Recent   RecentReader
 	Versions VersionReader
-	// PreviewBudget bounds the evaluator calls of one preview (default 6 s).
+	// PreviewBudget bounds preparation, reads and evaluation of one preview (default 4 s).
 	PreviewBudget time.Duration
 }
 
```

**File**: `internal/monitoring/preview.go` (modified, +29/-13)
```diff
@@ -18,8 +18,9 @@ const (
 	MaxPreviewRecords = 50
 	// DefaultPreviewRecords applies when the request names no limit.
 	DefaultPreviewRecords = 20
-	// defaultPreviewBudget keeps a preview well under the API's 10 s write timeout, and under the usual client timeouts.
-	defaultPreviewBudget = 6 * time.Second
+	// defaultPreviewBudget leaves response headroom inside the HTTP request's
+	// five-second deadline. It includes preparation and storage reads.
+	defaultPreviewBudget = 4 * time.Second
 	// previewCalls bounds the evaluator calls one preview runs at once.
 	previewCalls = 8
 	// PreviewID names the synthetic Subscription, Version and evaluation a
@@ -34,6 +35,9 @@ var (
 	// ErrPreviewFailed fails a preview whose evaluator refused or broke an
 	// evaluation. A partial preview would claim that articles do not match.
 	ErrPreviewFailed = publicerr.EvaluatorError
+	// ErrPreviewTimeout reports a deadline before evaluation could produce a
+	// partial result, or a caller deadline that expired first.
+	ErrPreviewTimeout = publicerr.PreviewDeadlineExceeded
 )
 
 // PreviewInput asks how a proposed Subscription would have judged the most
@@ -96,17 +100,32 @@ type PreviewResult struct {
 // written: a preview has no Subscription, so it creates no Match, Delivery or
 // event. Evaluator calls run under a time budget; Records still undecided when
 // it runs out are left out, and an evaluator error fails the whole preview.
-func (s Service) Preview(ctx context.Context, scope corpus.Scope, in PreviewInput, prepare ...func() (PreviewInput, error)) (PreviewResult, error) {
+func (s Service) Preview(ctx context.Context, scope corpus.Scope, in PreviewInput, prepare ...func(context.Context) (PreviewInput, error)) (result PreviewResult, err error) {
 	if err := scope.Require(corpus.ActionMonitoringPreview); err != nil {
 		return PreviewResult{}, err
 	}
+	parent := ctx
+	budget := s.PreviewBudget
+	if budget <= 0 {
+		budget = defaultPreviewBudget
+	}
+	ctx, cancel := context.WithTimeout(ctx, budget)
+	defer cancel()
+	defer func() {
+		if errors.Is(err, context.DeadlineExceeded) {
+			err = ErrPreviewTimeout
+		}
+	}()
 	for _, load := range prepare {
 		var err error
-		in, err = load()
+		in, err = load(ctx)
 		if err != nil {
 			return PreviewResult{}, err
 		}
 	}
+	if ctx.Err() != nil {
+		return PreviewResult{}, ctx.Err()
+	}
 	if s.Recent == nil || s.Versions == nil {
 		return PreviewResult{}, ErrNotFound
 	}
@@ -142,12 +161,6 @@ func (s Service) Preview(ctx context.Context, scope corpus.Scope, in PreviewInpu
 	if err != nil {
 		return PreviewResult{}, err
 	}
-	budget := s.PreviewBudget
-	if budget <= 0 {
-		budget = defaultPreviewBudget
-	}
-	judge, cancel := context.WithTimeout(ctx, budget)
-	defer cancel()
 	item := BatchItem{ID: PreviewID, Expression: query.Definition.Expression, Configuration: in.Evaluator.Configuration, QueryVectors: query.QueryVectors,
 		Subscriptions: []SubscriptionRef{{SubscriptionID: PreviewID, SubscriptionVersionID: PreviewID, SavedQueryID: query.SavedQueryID, SavedQueryVersionID: query.VersionID}}}
 	if item.Expression == nil {
@@ -167,19 +180,19 @@ func (s Service) Preview(ctx context.Context, scope corpus.Scope, in PreviewInpu
 			defer wg.Done()
 			select {
 			case slots <- struct{}{}:
-			case <-judge.Done():
+			case <-ctx.Done():
 				return
 			}
 			defer func() { <-slots }()
-			decided[i], errs[i] = s.previewOne(judge, evaluator, scope.Organization, r, item)
+			decided[i], errs[i] = s.previewOne(ctx, evaluator, scope.Organization, r, item)
 		}()
 	}
 	wg.Wait()
 	out := PreviewResult{Complete: true}
 	for i, r := range recent {
 		if errs[i] != nil {
 			// Out of time is not an evaluator failure: the Record is left out.
-			if errors.Is(errs[i], context.DeadlineExceeded) && ctx.Err() == nil {
+			if errors.Is(errs[i], context.DeadlineExceeded) && parent.Err() == nil {
 				out.Complete = false
 				continue
 			}
@@ -201,6 +214,9 @@ func (s Service) Preview(ctx context.Context, scope corpus.Scope, in PreviewInpu
 				Evaluator: in.Evaluator, Explanation: decided[i].Explanation, PartKeys: decided[i].PartKeys, Details: decided[i].Details}})
 		}
 	}
+	if parent.Err() != nil {
+		return PreviewResult{}, parent.Err()
+	}
 	return out, nil
 }
 
```

**File**: `internal/monitoring/preview_test.go` (modified, +61/-17)
```diff
@@ -6,6 +6,7 @@ import (
 	"fmt"
 	"github.com/The-Vibe-Company/quivr/internal/plugins/devhost/fakeplugin"
 	"testing"
+	"testing/synctest"
 	"time"
 
 	"github.com/The-Vibe-Company/quivr/internal/corpus"
@@ -163,21 +164,64 @@ func TestPreviewRefusesWhatASubscriptionWould(t *testing.T) {
 // An evaluator error fails the whole preview, never a partial "no match";
 // Records still undecided when the time budget runs out are left out.
 func TestPreviewFailuresAndBudget(t *testing.T) {
-	ctx := context.Background()
-	s, _, _ := previewService("strike", "slow", "boom")
-	s.PreviewBudget = 100 * time.Millisecond
-	if _, err := s.Preview(ctx, writer, monitoring.PreviewInput{Definition: inline("corpus_a"), Evaluator: decisions(map[string]any{"boom": "error"})}); !errors.Is(err, monitoring.ErrPreviewFailed) {
-		t.Fatalf("an evaluation the plugin cannot decide fails the preview with evaluator_error, got %v", err)
-	}
-	unavailable := monitoring.Evaluator{PluginID: "acme.alerts", Version: "0.1.0", Configuration: map[string]any{}}
-	withText := inline("corpus_a")
-	withText.Expression = map[string]any{"text": "x"}
-	if _, err := s.Preview(ctx, writer, monitoring.PreviewInput{Definition: withText, Evaluator: unavailable}); !errors.Is(err, monitoring.ErrPreviewUnavailable) {
-		t.Fatalf("an unreachable evaluator fails the preview with evaluator_unavailable, got %v", err)
-	}
-	slow := monitoring.Evaluator{PluginID: "test.blocking", Version: "1", Configuration: map[string]any{"decisions": map[string]any{"strike": "match"}}}
-	got, err := s.Preview(ctx, writer, monitoring.PreviewInput{Definition: inline("corpus_a"), Evaluator: slow})
-	if err != nil || got.Complete || got.Evaluated != 2 || len(got.Matches) != 1 || got.Matches[0].RecordID != "strike" {
-		t.Fatalf("want the two Records decided in time, strike matched, and complete false; got %+v, %v", got, err)
-	}
+	synctest.Test(t, func(t *testing.T) {
+		ctx := context.Background()
+		s, _, _ := previewService("strike", "slow", "boom")
+		s.PreviewBudget = 100 * time.Millisecond
+		if _, err := s.Preview(ctx, writer, monitoring.PreviewInput{Definition: inline("corpus_a"), Evaluator: decisions(map[string]any{"boom": "error"})}); !errors.Is(err, monitoring.ErrPreviewFailed) {
+			t.Fatalf("an evaluation the plugin cannot decide fails the preview with evaluator_error, got %v", err)
+		}
+		unavailable := monitoring.Evaluator{PluginID: "acme.alerts", Version: "0.1.0", Configuration: map[string]any{}}
+		withText := inline("corpus_a")
+		withText.Expression = map[string]any{"text": "x"}
+		if _, err := s.Preview(ctx, writer, monitoring.PreviewInput{Definition: withText, Evaluator: unavailable}); !errors.Is(err, monitoring.ErrPreviewUnavailable) {
+			t.Fatalf("an unreachable evaluator fails the preview with evaluator_unavailable, got %v", err)
+		}
+		slow := monitoring.Evaluator{PluginID: "test.blocking", Version: "1", Configuration: map[string]any{"decisions": map[string]any{"strike": "match"}}}
+		failure := monitoring.Evaluator{PluginID: "test.blocking", Version: "1", Configuration: map[string]any{"decisions": map[string]any{"boom": "error"}}}
+		if _, err := s.Preview(ctx, writer, monitoring.PreviewInput{Definition: inline("corpus_a"), Evaluator: failure}); !errors.Is(err, monitoring.ErrPreviewFailed) {
+			t.Fatalf("an early evaluator failure must survive another evaluation exhausting the budget, got %v", err)
+		}
+		// The default service budget must leave time to answer within the HTTP
+		// request's five-second deadline. Fake time exercises that ordering.
+		s.PreviewBudget = 0
+		ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
+		defer cancel()
+		got, err := s.Preview(ctx, writer, monitoring.PreviewInput{Definition: inline("corpus_a"), Evaluator: slow})
+		if err != nil || ctx.Err() != nil || got.Complete || got.Evaluated != 2 || len(got.Matches) != 1 || got.Matches[0].RecordID != "strike" {
+			t.Fatalf("want the two Records decided in time, strike matched, and complete false; got %+v, %v", got, err)
+		}
+	})
+}
+
+type blockedRecent struct{}
+
+func (blockedRecent) Recent(ctx context.Context, _ string, _ []string, _ time.Time, _ int) ([]monitoring.RecentVersion, error) {
+	<-ctx.Done()
+	return nil, ctx.Err()
+}
+
+// Preparation uses the same service budget as evaluation, rather than
+// spending the entire caller deadline before the evaluator budget starts.
+func TestPreviewPreparationSharesBudget(t *testing.T) {
+	synctest.Test(t, func(t *testing.T) {
+		s, _, _ := previewService()
+		s.Recent = blockedRecent{}
+		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
+		defer cancel()
+		_, err := s.Preview(ctx, writer, monitoring.PreviewInput{Definition: inline("corpus_a"), Evaluator: fixture()})
+		if !errors.Is(err, monitoring.ErrPreviewTimeout) || ctx.Err() != nil {
+			t.Fatalf("preparation must report its timeout before the caller deadline, got %v, caller %v", err, ctx.Err())
+		}
+		s, _, _ = previewService()
+		ctx, cancel
```

**File**: `internal/publicerr/catalog.go` (modified, +1/-0)
```diff
@@ -109,6 +109,7 @@ var (
 	SavedQueryDeleted                = declare("saved_query_deleted", ConflictClass, false)
 	SavedQueryInUse                  = declare("saved_query_in_use", ConflictClass, false)
 	SearchDeadlineExceeded           = declare("search_deadline_exceeded", DeadlineClass, false)
+	PreviewDeadlineExceeded          = declare("preview_deadline_exceeded", DeadlineClass, true)
 	SearchUnavailable                = declare("search_unavailable", UnavailableClass, true)
 	SourceFilterUnavailable          = declare("source_filter_unavailable", InvalidClass, false)
 	SourceNamespaceInUse             = declare("source_namespace_in_use", ConflictClass, false)
```

---

### Incident Patch 10: `f32b1233` (2026-10-05)
**Commit Message**: docs(run-quivr): reorganize Run Quivr into an operator path (#3740)

## Summary

Turns the **Run Quivr** section into a clear path for operators. Closes
THE-1042.

**Signal:** Stan, 2026-10-05: the "Run Quivr" menu and pages were "pas
propre ni bien organisé" (user request, signal 4 in
`docs/agents/documentation.md`).

### Navigation

```
Run Quivr
├─ Overview                     (new: run-quivr/overview)
├─ Deploy and configure         (new: run-quivr/deploy)
├─ Plugins          First-party plugins · Pin a plugin · Upgrade or switch a plugin · Reprocess quarantined documents
├─ Sources          Receive and secure pushes
├─ Search           Search profiles · Re-rank deep searches with Jev · Try and switch a vector model · Fill a new vector space
├─ Alerts           Configure alert fields · Upgrade an alert rule · Move meaning alerts (new) · Retire alert evaluations
└─ Measure search   Record search measurements · Run a search campaign
```

### Changes

- **Overview** (`run-quivr/overview`): who the section is for, what you
need first (running Quivr, the config file, operator key permissions),
which changes need a restart, and a map of tasks.
- **Deploy and configure Quivr** (`run-q

**File**: `.agents/skills/writing-docs/SKILL.md` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ The navigation lives in `docs-site/docs.json`. This table mirrors it; a pull req
 | --- | --- | --- |
 | Documentation › **Get started** | Introduction, Quickstart, Core concepts | Someone deciding whether Quivr fits, then trying it |
 | Documentation › **Plugins** | How plugins work, Plugin types, Build your first plugin, and _Write a plugin_ with one how-to per type (push sources included) | Plugin authors |
-| Documentation › **Run Quivr** | First-party plugins, pin, receive and secure pushes, upgrade or switch, migrate alert rules, retire evaluations, configure alert fields, try and switch vector models, backfill a vector space, reprocess quarantine, search profiles, re-rank with Jev | Operators |
+| Documentation › **Run Quivr** | Overview, Deploy and configure, then one sub-group per task area: _Plugins_ (first-party plugins, pin, upgrade or switch, reprocess quarantine), _Sources_ (receive and secure pushes), _Search_ (search profiles, re-rank with Jev, try and switch vector models, fill a vector space), _Alerts_ (alert fields, upgrade a rule, move meaning alerts, retire evaluations), _Measure search_ (measurements, campaigns) | Operators |
 | Documentation › **Guides** | One task per page: add content, search, _Alerts_ (how alerts work, keyword and meaning alerts), follow changes, _Collect from sources_ (connectors, RSS, Microsoft 365, X), connect an AI agent | Integrators calling the API |
 | **Reference** tab | HTTP API overview and endpoints, CLI, MCP tools, plugin manifest and protocol, configuration | Anyone looking up an exact fact |
 
```

**File**: `deploy/railway/README.md` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@ tokens using core.ingest's pinned E5 tokenizer, and caches up to 4096 pairs.
 An uncached deep search is estimated at about **0.06 cent**, with a **1-cent
 maximum** including retries; actual cost depends on provider input tokens.
 Provider failures return hybrid order with an explicit unavailable explanation.
-See [Re-rank with Jev](https://docs.quivr.thevibecompany.co/guides/rerank-with-jev)
+See [Re-rank with Jev](https://docs.quivr.thevibecompany.co/run-quivr/rerank-with-jev)
 for usage reporting, caching and fallback behavior.
 
 To turn it off, unset `QUIVR_DEMO_JEV_RERANK` or set it to `0` on api and worker, then redeploy both.
```

**File**: `docs-site/docs.json` (modified, +50/-14)
```diff
@@ -58,20 +58,48 @@
           {
             "group": "Run Quivr",
             "pages": [
-              "run-quivr/catalog",
-              "run-quivr/pin",
-              "run-quivr/receive-pushes",
-              "run-quivr/upgrade-a-plugin",
-              "run-quivr/upgrade-an-alert-rule",
-              "run-quivr/retire-alert-evaluations",
-              "run-quivr/configure-alert-fields",
-              "run-quivr/switch-a-vector-model",
-              "run-quivr/record-search-measurements",
-              "run-quivr/run-search-campaign",
-              "run-quivr/backfill-a-vector-space",
-              "run-quivr/reprocess-quarantined-versions",
-              "run-quivr/search-profiles",
-              "guides/rerank-with-jev"
+              "run-quivr/overview",
+              "run-quivr/deploy",
+              {
+                "group": "Plugins",
+                "pages": [
+                  "run-quivr/catalog",
+                  "run-quivr/pin",
+                  "run-quivr/upgrade-a-plugin",
+                  "run-quivr/reprocess-quarantined-versions"
+                ]
+              },
+              {
+                "group": "Sources",
+                "pages": [
+                  "run-quivr/receive-pushes"
+                ]
+              },
+              {
+                "group": "Search",
+                "pages": [
+                  "run-quivr/search-profiles",
+                  "run-quivr/rerank-with-jev",
+                  "run-quivr/switch-a-vector-model",
+                  "run-quivr/backfill-a-vector-space"
+                ]
+              },
+              {
+                "group": "Alerts",
+                "pages": [
+                  "run-quivr/configure-alert-fields",
+                  "run-quivr/upgrade-an-alert-rule",
+                  "run-quivr/move-meaning-alerts",
+                  "run-quivr/retire-alert-evaluations"
+                ]
+              },
+              {
+                "group": "Measure search",
+                "pages": [
+                  "run-quivr/record-search-measurements",
+                  "run-quivr/run-search-campaign"
+                ]
+              }
             ]
           },
           {
@@ -303,6 +331,14 @@
     {
       "source": "/plugins/switch-plugins-without-restarting",
       "destination": "/run-quivr/upgrade-a-plugin"
+    },
+    {
+      "source": "/guides/rerank-with-jev",
+      "destination": "/run-quivr/rerank-with-jev"
+    },
+    {
+      "source": "/run-quivr",
+      "destination": "/run-quivr/overview"
     }
   ]
 }
```

**File**: `docs-site/run-quivr/backfill-a-vector-space.mdx` (modified, +14/-12)
```diff
@@ -1,10 +1,10 @@
 ---
-title: "Fill a new vector space for past articles"
-description: "Fill an embedding model or evaluation plugin on past articles before making search use it."
+title: "Fill a new vector space"
+description: "Compute a new embedding model's vectors for the documents you already have, before search uses it."
 keywords: ["backfill", "vector space", "embedding model", "promote", "evaluation space", "reprocess"]
 ---
 
-A new embedding model enters as an evaluation space of your ingestion plugin. Articles ingested from then on get vectors in it, but the ones you already have do not. A backfill fills that space for a Corpus's past articles, at low priority, and a promotion then makes search use it. You can also backfill a second plugin selected in `ingestion.evaluation`; it creates its own segments from each article's canonical Parts. See [Configuration](/reference/configuration#ingestion-routing) for the selection and [Upgrade or switch a plugin](/run-quivr/upgrade-a-plugin#promote-an-evaluation-plugin) for promotion.
+A new embedding model enters as an evaluation space of your ingestion plugin. Documents ingested from then on get vectors in it, but the ones you already have do not. A backfill fills that space for a Corpus's past documents, at low priority, and a promotion then makes search use it. You can also backfill a second plugin selected in `ingestion.evaluation`; it creates its own segments from each document's canonical Parts. See [Configuration](/reference/configuration#ingestion-routing) for the selection and [Upgrade or switch a plugin](/run-quivr/upgrade-a-plugin#promote-an-evaluation-plugin) for promotion.
 
 ## Prerequisites
 
@@ -17,7 +17,7 @@ A new embedding model enters as an evaluation space of your ingestion plugin. Ar
 <Steps>
 <Step title="Estimate it">
 
-A dry run is required. It counts the articles to fill and estimates how long it takes and what it costs:
+A dry run is required. It counts the documents to fill and estimates how long it takes and what it costs:
 
 ```bash
 curl -s -X POST "$QUIVR_API_URL/v0/admin/backfills" -H "Authorization: Bearer $QUIVR_OPERATOR_KEY" \
@@ -31,7 +31,7 @@ EOF
  "input_tokens": 9600000, "estimated_seconds": 6000, "duration_basis": "rate", "estimated_cost_usd": 0.2, "confirmation_required": true}
 ```
 
-`registration_id` selects any ingestion registration in the active plan; omit it to use the default ingestion plugin. `spaces` defaults to that plugin's evaluation spaces; name them in `spaces` to choose. For a second plugin, articles of the source formats assigned to it in the pinned plan are in scope, including articles without that plugin's segments. Existing segments of that owner are reused. Name its primary space explicitly when preparing an owner switch. If the owner has no segments yet, the dry run estimates segments and tokens from the current served projection; completion counters use the new owner's actual cuts. To fill only part of the Corpus, add `accepted_after` or `accepted_before`: the time Quivr accepted each article. `estimated_seconds` uses the deployment's `backfill.rate`, or the recent throughput when it is slower (`duration_basis`).
+`registration_id` selects any ingestion registration in the active plan; omit it to use the default ingestion plugin. `spaces` defaults to that plugin's evaluation spaces; name them in `spaces` to choose. For a second plugin, documents of the source formats assigned to it in the pinned plan are in scope, including documents without that plugin's segments. Existing segments of that owner are reused. Name its primary space explicitly when preparing an owner switch. If the owner has no segments yet, the dry run estimates segments and tokens from the current served projection; completion counters use the new owner's actual cuts. To fill only part of the Corpus, add `accepted_after` or `accepted_before`: the time Quivr accepted each document. `estimated_seconds` uses the deployment's `backfill.rate`, or the recent throughput when it is slower (`duration_basis`).
 
 </Step>
 <Step title="Start it">
@@ -63,7 +63,7 @@ curl -s "$QUIVR_API_URL/v0/operations/$OPERATION_ID" -H "Authorization: Bearer $
   | jq '{state, counters, checkpoint: .backfill.checkpoint}'
 ```
 
-`counters` shows `versions_in_scope`, `versions_done`, `versions_skipped` and `segments`. One backfill of a Corpus runs at a time: another one is refused with `409 backfill_in_progress` until it ends. Pause, resume or cancel it with `POST /v0/operations/{id}/pause`, `/resume` or `/cancel`, each with an `idempotency_key` body. A paused or restarted backfill continues after its `checkpoint` and never fills an article twice.
+`counters` shows `versions_in_scope`, `versions_done`, `versions_skipped` and `segments`. One backfill of a Corpus runs at a time: another one is refused with `409 backfill_in_progress` until it ends. Pause, resume or cancel it with `POST /v0/operations/{id}/pause`, `/resume` or `/cancel`, each with an `idemp
```

**File**: `docs-site/run-quivr/catalog.mdx` (modified, +5/-5)
```diff
@@ -1,6 +1,6 @@
 ---
 title: "First-party plugins"
-description: "The plugins that ship with Quivr: what each provides, its configuration, and where it runs."
+description: "The plugins that ship with Quivr: what each one does, its settings, and where it runs."
 keywords: ["pdf-text", "alerts", "core-ingest", "hosted-embed", "core-retrieve", "jev-rerank", "rss", "m365-mail", "x-list", "push-source", "catalog"]
 ---
 
@@ -42,7 +42,7 @@ Keyword and local-vector checks need no classifier key. Jev checks need a `TYPES
 | `described` | Jev by default, local vectors with `meaning_check: vectors` | Yes, unless `meaning_check: vectors` |
 | `keywords_or_meaning` / `keywords_and_meaning` | Keyword and meaning checks, with an explicit `meaning_check` | With `meaning_check: jev` |
 
-Vector checks embed the description with the deployment's embedding provider, which also embeds every article. With the default `core-ingest` and an embedding server you run, that text stays inside the installation; with a hosted provider, it goes to that provider.
+Vector checks embed the description with the deployment's embedding provider, which also embeds every document. With the default `core-ingest` and an embedding server you run, that text stays inside the installation; with a hosted provider, it goes to that provider.
 
 The pin's `kinds` lists the alert kinds the deployment accepts. For keyword and local meaning checks without a TypeSafe key, pin `"kinds": ["keywords", "meaning", "keywords_or_meaning", "keywords_and_meaning"]`, as `make dev` does. Use `kind: meaning` for a local description, and `meaning_check: vectors` for every meaning check. This pin excludes `described`, so that kind is refused with `422 invalid_expression` even when it selects vectors. The kind list alone does not prevent a mixed expression from selecting Jev.
 
@@ -56,7 +56,7 @@ To offer Jev checks:
 
 | Configuration | Default | Meaning |
 | --- | --- | --- |
-| `fields` | `{}` | Filter names mapped to JSON Pointers into article metadata, such as `{"author": "/extensions/example.news/data/author"}` |
+| `fields` | `{}` | Filter names mapped to JSON Pointers into document metadata, such as `{"author": "/extensions/example.news/data/author"}` |
 | `text_roles` | `["title", "body"]` | Part roles that keyword terms search and Jev checks; local meaning checks use all supplied vectors |
 | `described.threshold` | `0.5` | Default Jev probability threshold, 0.2 to 0.95 |
 | `vectors.threshold` | `0.8` | Default local-vector cosine similarity threshold, 0.2 to 0.95 |
@@ -82,11 +82,11 @@ Generate an immutable manifest from the configuration before installing it. Each
 
 The default retrieval plugin follows the search mode: `bm25` on the title and body for `lexical`, `near_vector` in every served space for `semantic`, and `hybrid` in every served space for `hybrid`. It merges candidates by score, keeps each segment once and breaks score ties by segment id. Optional pin settings select `dense_weight`, `candidate_count` and `hybrid_fusion`; defaults remain alpha 0.5, the search limit and relative-score fusion. See [Core retrieval settings](/run-quivr/search-profiles#core-retrieval-settings) for bounds and an example.
 
-It declares `default` (500 ms, no paid call) and `deep` (3 s, 1 cent). Its `deep` ranks like `default`; to re-rank, install `jev.rerank` and map the short name `deep` to `jev.rerank/deep` in `retrieval.profiles`. See [Re-rank with Jev](/guides/rerank-with-jev) for that configuration. The api refuses to start without a retrieval plugin.
+It declares `default` (500 ms, no paid call) and `deep` (3 s, 1 cent). Its `deep` ranks like `default`; to re-rank, install `jev.rerank` and map the short name `deep` to `jev.rerank/deep` in `retrieval.profiles`. See [Re-rank deep searches with Jev](/run-quivr/rerank-with-jev) for that configuration. The api refuses to start without a retrieval plugin.
 
 ## jev-rerank
 
-The optional `jev.rerank` retrieval plugin declares only `deep`. It asks `core.retrieve/default` for a hybrid shortlist, then scores it in one batch with Jev, TypeSafe's paid model. A `deep` search can make paid calls; usage reports the calls and cost, and each re-ranked hit explains its probability. Without a TypeSafe key, or on errors and deadlines, it returns the original hybrid order without a Jev score. It can shorten passages, drop overlapping hits and cache scores. See [Re-rank with Jev](/guides/rerank-with-jev) for configuration and settings, and [Search profiles](/run-quivr/search-profiles) for how it builds on `core.retrieve/default`.
+The optional `jev.rerank` retrieval plugin declares only `deep`. It asks `core.retrieve/default` for a hybrid shortlist, then scores it in one batch with Jev, TypeSafe's paid model. A `deep` search can make paid calls; usage reports the calls and cost, and each re-ranked hit explains its probability. Without a TypeSafe key, or on errors and deadlines, it returns the original hybrid order without a Jev score. I
```

**File**: `docs-site/run-quivr/configure-alert-fields.mdx` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 ---
-title: "Configure alert metadata fields"
-description: "Map alert field names to document metadata in the alerts plugin's configuration."
+title: "Configure alert fields"
+description: "Name document metadata fields so keyword alerts can filter on them, such as author."
 keywords: ["alerts", "metadata", "fields", "configuration"]
 ---
 
```

**File**: `docs-site/run-quivr/deploy.mdx` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+---
+title: "Deploy and configure Quivr"
+sidebarTitle: "Deploy and configure"
+description: "What a Quivr deployment runs, the order to start it in, and how to check that it is ready."
+keywords: ["deploy", "QUIVR_CONFIG", "migrate", "readiness", "probes", "self-host"]
+---
+
+A Quivr deployment runs one `quivr` binary as three commands, next to four services and the plugins you choose. Every process reads the same JSON configuration file; you run `quivr migrate` first, then keep `quivr api` and `quivr worker` running.
+
+<Warning>
+Quivr is at the evaluation stage: its API is `v0` and may change. Do not run it in production yet.
+</Warning>
+
+## What a deployment runs
+
+| Part | What it does |
+| --- | --- |
+| `quivr api` | Serves the public HTTP API that applications call |
+| `quivr worker` | Runs the background work: processes content, pulls connectors, delivers alerts and events |
+| `quivr migrate` | Prepares PostgreSQL, object storage and the search index, then exits |
+| PostgreSQL | Stores Quivr's state: documents and their versions, alerts, operations and the change feed |
+| Temporal | Schedules and retries the worker's background work |
+| Weaviate | The search index |
+| S3-compatible storage | Original files and the artifacts derived from them |
+| Plugins | Separate HTTP services that read files, cut and embed passages, rank results and judge alerts |
+
+`make dev` runs all of these on one machine, with the service versions pinned in [`deploy/compose/compose.yaml`](https://github.com/The-Vibe-Company/quivr/blob/main/deploy/compose/compose.yaml). The [Quickstart](/quickstart) walks through it.
+
+## The configuration file
+
+`QUIVR_CONFIG` holds the path of a JSON file. Give `api`, `worker` and `migrate` the same file, except for addresses such as `probe_listen`. It must set:
+
+- `database_url`, `temporal_address`, `weaviate_url` and `s3`: where the four services are;
+- `cursor_key`: a stable secret of at least 32 bytes that signs change-feed cursors;
+- `keys`: the API keys and what each may do. You create keys here; give `plugins:admin` only to operator keys;
+- `plugins`: at least one ingestion plugin and one retrieval plugin, normally the first-party `core.ingest` and `core.retrieve`. The `api` refuses to start without both, and the `worker` without an ingestion plugin. `core.ingest` also needs a Text Embeddings Inference server for its model; see [First-party plugins](/run-quivr/catalog#core-ingest).
+
+The file holds the database URL, storage credentials and API keys, so keep it readable only by Quivr's processes. The [Configuration reference](/reference/configuration) lists every field, and [Pin a plugin](/run-quivr/pin) shows how to add one.
+
+A change to this file takes effect when the processes restart. Plugin changes made through the API, such as activating a new version, apply while Quivr runs; see [Upgrade or switch a plugin](/run-quivr/upgrade-a-plugin).
+
+## Start order
+
+For example, not run:
+
+```bash
+export QUIVR_CONFIG=/etc/quivr/config.json
+quivr migrate   # exits when done
+quivr api       # in its own process
+quivr worker    # in its own process
+```
+
+1. `quivr migrate` updates the database schema, creates the storage bucket when it is missing, and prepares the search index. It gives up after 30 seconds when storage or the search index does not answer; run it again once they do.
+2. `quivr api` refuses to start while migrations are pending, with `database/schema unavailable; run migrate`.
+3. `quivr worker` started before the migrations waits for them for up to `migration_wait` (5 minutes by default), then exits.
+
+To deploy a new `quivr` binary, run its `quivr migrate` first, then restart `api` and `worker` on it. A binary older than the database schema refuses to start, with `database schema is newer than this binary`. The [CLI reference](/reference/cli#engine-commands) lists the commands' exit codes.
+
+## Check that it is ready
+
+Each `api` and `worker` serves three probes on its `probe_listen` address, `127.0.0.1:8081` by default. Give each process its own address, and keep it private. The probes open only once startup is done: a `worker` still waiting for migrations answers none of them, so give a liveness check at least `migration_wait` before it restarts the process.
+
+| Probe | Answer |
+| --- | --- |
+| `GET /healthz` | `204` once the process has started |
+| `GET /readyz` | `204` once the process can serve, `503` otherwise |
+| `GET /metrics` | Counters in Prometheus text format |
+
+The `api` becomes ready once its schema check passes and its ingestion plugin has answered a first query, or after 5 seconds; the first searches are then only slower. The `worker` also checks that Temporal, object storage and the search index answer. A plugin that is down does not stop either process. Background work that needs it waits and retries; a search that needs it fails with `503 search_unavailable`.
+
+## Example deployments
+
+- **Local
```

**File**: `docs-site/run-quivr/move-meaning-alerts.mdx` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+---
+title: "Move meaning alerts to a new vector model"
+sidebarTitle: "Move meaning alerts"
+description: "Keep alerts that match by vector meaning working right after search switches to another vector space, or back."
+keywords: ["meaning alerts", "vectors", "Saved Query Version", "Subscription", "model switch"]
+---
+
+After search switches to another vector space, re-create each alert that matches by vector meaning, so its query vectors are in the same space as the documents' vectors.
+
+A Saved Query stores an alert definition; each immutable Saved Query Version fixes its query vectors. A Subscription pins one such Version and the evaluator that judges documents. Switching search does not re-encode those vectors or move those pins. Vectors from different spaces cannot be compared.
+
+## Prerequisites
+
+- Search has just switched vector space: you [activated another ingestion plugin](/run-quivr/switch-a-vector-model), [promoted another space](/run-quivr/backfill-a-vector-space) of the same plugin, or rolled either back.
+- `curl` and `jq` (`curl --version`, `jq --version`), your API address in `QUIVR_API_URL`, and a key with `monitoring:read` and `monitoring:write` in `QUIVR_ALERT_KEY`.
+- A label unique to this migration in `MIGRATION_ID`, such as the new space id followed by today's date. The requests use it only to build idempotency keys, so a later switch back to a space you used before still gets fresh keys.
+- Your application's inventory of alerts that use `meaning_check: vectors`. The API cannot list Saved Queries.
+
+<Warning>
+Migrate immediately after the switch. Until you do, these alerts return `not_ready` because the document and query vectors are in different spaces. Quivr records that result as final: it does not automatically re-check those documents when you migrate. A new Subscription Version takes effect from its commit, so documents accepted between the switch and migration can miss alerts permanently. The same gap opens after rollback; migrate immediately then too.
+</Warning>
+
+## Steps
+
+<Steps>
+<Step title="Create a new Saved Query Version">
+
+For every Saved Query using `meaning_check: vectors` in the affected Corpora, create a new Version **after** search switched space. Set `SAVED_QUERY_ID` to its id from your application's alert inventory. Preserve its definition:
+
+```bash
+curl -fsS "$QUIVR_API_URL/v0/saved-queries/$SAVED_QUERY_ID" \
+  -H "Authorization: Bearer $QUIVR_ALERT_KEY" \
+  | jq --arg key "model-switch-$SAVED_QUERY_ID-$MIGRATION_ID" \
+    '{idempotency_key:$key, definition:.current_version.definition}' > query-version.json
+curl -fsS -X POST "$QUIVR_API_URL/v0/saved-queries/$SAVED_QUERY_ID/versions" \
+  -H "Authorization: Bearer $QUIVR_ALERT_KEY" -H "Content-Type: application/json" \
+  -d @query-version.json | jq '{saved_query_id, version_id}'
+```
+
+Save its returned `version_id` as `QUERY_VERSION_ID`.
+
+</Step>
+<Step title="Move each Subscription to it">
+
+For each Subscription of this Saved Query, set `SUBSCRIPTION_ID` and create a new Version, retaining its evaluator settings and destination:
+
+```bash
+curl -fsS "$QUIVR_API_URL/v0/subscriptions/$SUBSCRIPTION_ID" \
+  -H "Authorization: Bearer $QUIVR_ALERT_KEY" \
+  | jq --arg key "model-switch-$SUBSCRIPTION_ID-$QUERY_VERSION_ID" \
+       --arg query "$QUERY_VERSION_ID" \
+    '{idempotency_key:$key, saved_query_version_id:$query,
+      evaluator:.current_version.evaluator, destination_id:.current_version.destination_id}' \
+    > subscription-version.json
+curl -fsS -X POST "$QUIVR_API_URL/v0/subscriptions/$SUBSCRIPTION_ID/versions" \
+  -H "Authorization: Bearer $QUIVR_ALERT_KEY" -H "Content-Type: application/json" \
+  -d @subscription-version.json | jq '{subscription_id, saved_query_version_id}'
+```
+
+The query Version must still be that Saved Query's current Version. Finish its Subscription migrations before creating another query Version. Replaying the same key and body returns the same Version; a changed body conflicts. Subscription edits preserve enabled state and affect future changes from their commit, without replaying past documents or rewriting existing Matches.
+
+Use your application’s inventory to include disabled Subscriptions before re-enabling them. The [Subscription API](/api-reference/overview) requires an owner filter and lists only enabled, non-deleted items; follow all pages for each owner and list global Subscriptions separately with `owner=none`. Gather Saved Query ids from those lists or your inventory.
+
+</Step>
+<Step title="Recalibrate the threshold">
+
+Similarity scores from different models are not comparable, so the copied threshold may now catch too much or too little. Tune it on your own examples; [Meaning alerts](/guides/described-alerts#keep-the-meaning-check-inside-the-installation) explains vector matching and its threshold. To apply a new value, repeat the previous step with a new idempotency key in `subscription-version.json` and 
```

---

### Incident Patch 11: `39c62bf4` (2026-10-05)
**Commit Message**: feat(quivr-search): add chart tooltips and source settings dialogs (#3739)

## Summary
Follow-up to the alerts, sources and admin redesign
([quivr-v2#298](https://github.com/The-Vibe-Company/quivr-v2/pull/298),
merged before that repository was archived) in the `quivr-search` demo
front end.
- **Chart tooltips**: one shared tooltip (`ChartTip`) for every small
chart. Hovering anywhere over a chart shows the words of the nearest
bar, so an empty day is as easy to read as a busy one. From the
keyboard, a chart takes the focus and ← → Home End read its bars (the
Fil's day columns, already buttons, show theirs on focus). Inside a
modal dialog the tooltip is drawn in the dialog. Near the window's top
it goes below the bar, and it follows its bar when the data refreshes.
- Covers the Fil pulse, each alert's 7 days, the alert sheet's trend,
sources stack and arrival hours, the Sources 7-day spark, and Admin's
plugin error sparks and query trends.
  - Replaces the native `title` tooltips.
- **Add a source**: now a dialog, opened from the header button or the
"+" card. The address field takes focus, and the dialog closes on the
new card. `Dialog` focuses a field marked `data-autofocus` once

**File**: `quivr-search/README.md` (modified, +3/-2)
```diff
@@ -23,7 +23,8 @@ Search is lexical, or hybrid with **Idées proches**, which marks articles found
 ### Sources
 
 The **Sources** tab (`?view=sources`) collects news sites into the demo corpus (see
-[From the web interface](#sources)):
+[From the web interface](#sources)). **Ajouter une source**, in the header or on the
+last card, opens a dialog:
 
 1. Paste a site address or a feed address. Once you pause typing (or press Entrée), the
    server fetches it, recognises a feed or finds the feeds the page advertises
@@ -34,7 +35,7 @@ The **Sources** tab (`?view=sources`) collects news sites into the demo corpus (
 3. **Commencer la collecte** creates an `rss` Connector Instance whose Source
    Namespace is that name. Its articles become searchable after the first poll.
 
-Suggested feeds, set by the deployment, add in one click from the last card of the page. Each source is a card: its logo, its health in plain words, its last article, its interval, its articles per day, in the feed and caught by an alert, and its last seven days. A switch pauses or resumes it; its **…** menu renames or removes it. A name given to a source is kept by the web server (`POST /demo/sources/rename`, in `DEMO_STATE_FILE`) and shown everywhere in the app; the Source Namespace, which Records and alerts use, does not change, and an empty name gives it back. Pausing disables the instance. Resuming creates a new instance on the same Source Namespace, because the core cannot re-enable one; articles already collected keep their identity. Removing disables every instance of the source and hides them; collected articles stay searchable. **Réessayer** on a failing source checks it now (`POST /v0/connectors/{id}/runs`) and shows the result.
+Suggested feeds, set by the deployment, add in one click from the same dialog, which closes on the new card. Each source is a card: its logo, its health or its last article in plain words (on hover, its interval while active, its pause date while paused), its articles per day, in the feed and caught by an alert, and its last seven days. A switch pauses or resumes it; its **…** menu renames it, opens its settings or removes it. **Réglages**, also opened by its name, changes its name and how often it is checked, saved together, shows its feed address and its credential status (a credential is replaced, never shown), and removes it. A name given to a source is kept by the web server (`POST /demo/sources/rename`, in `DEMO_STATE_FILE`) and shown everywhere in the app; the Source Namespace, which Records and alerts use, does not change, and an empty name gives it back. Pausing disables the instance. Resuming creates a new instance on the same Source Namespace, because the core cannot re-enable one; articles already collected keep their identity. Removing disables every instance of the source and hides them; collected articles stay searchable. **Réessayer** on a failing source checks it now (`POST /v0/connectors/{id}/runs`) and shows the result.
 
 `make demo` also enables the test `fixture` kind, under **Ajouter un connecteur
 d’un autre type**. Its token field accepts any value, except values starting with
```

**File**: `quivr-search/src/App.tsx` (modified, +2/-0)
```diff
@@ -33,6 +33,7 @@ import { groupSources } from "./components/connectors/SourceList";
 import { displayState } from "./components/connectors/HealthBadge";
 import { needsCheck } from "./lib/format";
 import { currentTheme, onSystemTheme, saveTheme, type Theme } from "./lib/theme";
+import { ChartTip } from "./components/ChartTip";
 
 type Auth = "loading" | "login" | "ready" | "error";
 type View = "feed" | "alerts" | "sources" | "admin";
@@ -579,6 +580,7 @@ function Dashboard({
           onUnauthorized={onUnauthorized}
         />
       )}
+      <ChartTip />
       <div className="toast-region" role="status" aria-live="polite">
         {toast && (
           <p className="toast" key={toast.at}>
```

**File**: `quivr-search/src/admin.css` (modified, +44/-2)
```diff
@@ -827,11 +827,11 @@ li[data-fresh] > .flow-row {
   font-weight: 600;
 }
 .admin-board > .admin-lower {
-  flex: 1 0 360px;
+  flex: 1 1 260px;
   display: grid;
   grid-template-columns: minmax(0, 1fr) clamp(280px, 26vw, 380px);
   gap: 14px;
-  min-height: 360px;
+  min-height: 260px;
 }
 .admin-tabs {
   position: relative;
@@ -1257,3 +1257,45 @@ li[data-fresh] > .flow-row {
   }
 }
 
+
+/* Wide, the open document sits beside the flow: each scrolls on its own,
+   within the tab's height, so the document stays whole while the flow moves. */
+@media (min-width: 1100px) {
+  .admin-tabpanel:has(> .admin-main) {
+    display: flex;
+    flex-direction: column;
+    overflow: hidden;
+  }
+  .admin-tabpanel > .admin-main {
+    flex: 1;
+    min-height: 0;
+    grid-template-rows: minmax(0, 1fr);
+  }
+  .admin-tabpanel > .admin-main > .admin-flow {
+    min-height: 0;
+    overflow-y: auto;
+  }
+  .admin-tabpanel .timeline-panel {
+    position: static;
+    min-height: 0;
+    max-height: none;
+  }
+}
+/* The usage blocks follow the tab's width, not the window's: two side by
+   side only where their tables fit. The container is the grid's own wrapper:
+   on the whole tab panel, a browser that gives containers layout containment
+   would anchor the tab's window picker and the timeline drawer to it. */
+.admin-tabpanel .admin-section-body:has(> .usage-grid) {
+  container: admin-tab / inline-size;
+}
+@container admin-tab (max-width: 920px) {
+  .usage-grid {
+    grid-template-columns: minmax(0, 1fr);
+  }
+  .usage-block:nth-child(even) {
+    border-left: 0;
+  }
+  .usage-block:nth-child(n + 2) {
+    border-top: 1px solid var(--line-soft);
+  }
+}
```

**File**: `quivr-search/src/components/ChartTip.tsx` (added, +157/-0)
```diff
@@ -0,0 +1,157 @@
+import { useEffect, useRef, useState } from "react";
+import { createPortal } from "react-dom";
+
+/**
+ * One tooltip for every small chart of the app. A chart marks itself with
+ * `data-tips`, and each of its bars carries its words in `data-tip`. Over the
+ * chart, the bar under the pointer shows its words: the whole height of its
+ * column counts, so an empty day is as easy to read as the busiest one. From
+ * the keyboard, a chart that takes the focus (`tabIndex={0}`) shows its latest
+ * bar and ← → Début Fin move along its bars; a bar that is a control of its
+ * own shows its words when it takes the focus. In a modal dialog, the words
+ * are drawn inside it: anything outside lies under the dialog. While shown,
+ * the words follow their bar: new words after a refresh, none once it is gone.
+ */
+export function ChartTip() {
+  const [tip, setTip] = useState<{
+    text: string;
+    x: number;
+    y: number;
+    below: boolean;
+    host: Element;
+  } | null>(null);
+  const shown = useRef<Element | null>(null);
+
+  useEffect(() => {
+    const place = (bar: Element) => {
+      // The page is drawn zoomed on desktop: rectangles come zoomed, fixed
+      // positions are zoomed again.
+      const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
+      const r = bar.getBoundingClientRect();
+      // Above the bar, or below it when the window's top is too close.
+      const below = r.top / zoom < 44;
+      setTip({
+        text: bar.getAttribute("data-tip") || "",
+        x: (r.left + r.width / 2) / zoom,
+        y: (below ? r.bottom : r.top) / zoom,
+        below,
+        host: bar.closest("dialog[open]") || document.body,
+      });
+    };
+    const watch = new MutationObserver(() => {
+      const bar = shown.current;
+      if (!bar?.isConnected) return show(null);
+      const text = bar.getAttribute("data-tip") || "";
+      setTip((t) => (t && t.text !== text ? { ...t, text } : t));
+    });
+    function show(bar: Element | null) {
+      if (bar === shown.current) return;
+      shown.current?.removeAttribute("data-hover");
+      shown.current = bar;
+      if (!bar) {
+        watch.disconnect();
+        return setTip(null);
+      }
+      bar.setAttribute("data-hover", "");
+      place(bar);
+      watch.observe(document.body, {
+        subtree: true,
+        childList: true,
+        attributes: true,
+        attributeFilter: ["data-tip"],
+      });
+    }
+    const bars = (chart: Element) => [...chart.querySelectorAll("[data-tip]")];
+    const barAt = (chart: Element, x: number) => {
+      let best: Element | null = null;
+      let gap = Infinity;
+      for (const bar of bars(chart)) {
+        const r = bar.getBoundingClientRect();
+        const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
+        if (d < gap) [best, gap] = [bar, d];
+      }
+      return best;
+    };
+    const move = (event: PointerEvent) => {
+      const target = event.target as Element;
+      const chart = target.closest?.("[data-tips]");
+      if (!chart) return show(null);
+      // Right on a bar, or still within the one shown: no need to measure them all.
+      if (target.matches("[data-tip]")) return show(target);
+      const current = shown.current;
+      if (current && chart.contains(current)) {
+        const r = current.getBoundingClientRect();
+        if (event.clientX >= r.left && event.clientX <= r.right) return;
+      }
+      show(barAt(chart, event.clientX));
+    };
+    const focus = (event: FocusEvent) => {
+      const target = event.target as Element;
+      // A click focuses too: only the keyboard's focus shows the words.
+      if (!target.matches?.(":focus-visible")) return show(null);
+      if (target.matches("[data-tips]")) return show(bars(target).at(-1) || null);
+      show(target.matches("[data-tips] [data-tip]") ? target : null);
+    };
+    const key = (event: KeyboardEvent) => {
+      const chart = document.activeElement;
+      // With a modifier, the keys stay the browser's (Alt+← goes back).
+      if (!chart?.matches("[data-tips]") || event.altKey || event.ctrlKey || event.metaKey) return;
+      if (event.key === "Escape") return show(null);
+      const list = bars(chart);
+      const at = shown.current ? list.indexOf(shown.current) : list.length - 1;
+      const to: Record<string, number> = {
+        ArrowLeft: at - 1,
+        ArrowRight: at + 1,
+        Home: 0,
+        End: list.length - 1,
+      };
+      if (!(event.key in to) || !list.length) return;
+      event.preventDefault();
+      show(list[Math.min(list.length - 1, Math.max(0, to[event.key]))]);
+    };
+    const scroll = () => {
+      const bar = shown.current;
+      const active = document.activeElement;
+      // Following the keyboard, the words move with their bar (focusing a
+      // chart scrolls it into view); under a still pointer, they go.
+      if (bar && active?.matches(":focus-visible") 
```

**File**: `quivr-search/src/components/Dialog.tsx` (modified, +6/-1)
```diff
@@ -6,8 +6,11 @@ export function Dialog({
   children,
   wide = false,
   closeLabel,
+  label,
 }: {
   title: string;
+  /** The dialog's accessible name when the visible title is too short. */
+  label?: string;
   onClose: () => void;
   children: ReactNode;
   wide?: boolean;
@@ -21,6 +24,8 @@ export function Dialog({
         : null;
     const dialog = ref.current!;
     dialog.showModal();
+    // A field marked `data-autofocus` takes the focus from the close button.
+    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
     const prior = document.body.style.overflow;
     document.body.style.overflow = "hidden";
     return () => {
@@ -33,7 +38,7 @@ export function Dialog({
     <dialog
       ref={ref}
       className={`modal ${wide ? "document-modal" : ""}`}
-      aria-label={title}
+      aria-label={label || title}
       onCancel={(event) => {
         event.preventDefault();
         onClose();
```

**File**: `quivr-search/src/components/admin/Plugins.tsx` (modified, +8/-3)
```diff
@@ -296,7 +296,7 @@ function PluginLine({
           <span className="visually-hidden">, erreurs : </span>
           {row.count ? percent(row.error_rate) : "—"}
         </span>
-        <Spark values={row.spark} window={window} />
+        <Spark values={row.spark} tips={row.sparkTips} window={window} />
         <span className="plug-last">
           <span className="visually-hidden">, dernière erreur : </span>
           {row.last_error_code ? (
@@ -427,9 +427,11 @@ function PluginLine({
  */
 function Spark({
   values,
+  tips,
   window,
 }: {
   values: (number | null)[];
+  tips: string[];
   window: StatsWindow;
 }) {
   const width = 96;
@@ -444,7 +446,7 @@ function Spark({
       ? `Aucune erreur ${WINDOW_WORDS[window]}`
       : `Taux d’erreur ${WINDOW_WORDS[window]} : jusqu’à ${percent(worst)}${values.at(-1) ? `, ${percent(values.at(-1)!)} à l’instant` : ""}`;
   return (
-    <span className="plug-spark">
+    <span className="plug-spark" data-tips>
       <svg
         width={width}
         height={height}
@@ -460,8 +462,11 @@ function Spark({
           className="spark-base"
         />
         {values.map((v, i) =>
-          v === null ? null : (
+          v === null ? (
+            <rect key={i} x={i * step} width={step} y="0" height={height} className="spark-idle" data-tip={tips[i]} />
+          ) : (
             <rect
+              data-tip={tips[i]}
               key={i}
               x={i * step + step * 0.15}
               width={Math.max(step * 0.7, 1)}
```

**File**: `quivr-search/src/components/admin/Usage.tsx` (modified, +24/-18)
```diff
@@ -19,6 +19,7 @@ import {
   hourlySpan,
   spanOf,
   coarse,
+  coarseRanges,
   count,
   countsIn,
   matchValues,
@@ -310,24 +311,29 @@ export function Usage({ onUnauthorized, bare }: SectionProps) {
                 className="usage-queries"
                 aria-label={`Requêtes les plus fréquentes, ${v.name}`}
               >
-                {list.items.map((q, i) => (
-                  <li key={q.query}>
-                    <span className="usage-rank" aria-hidden="true">
-                      {i + 1}
-                    </span>
-                    <span className="usage-query" title={q.query}>
-                      {q.query}
-                    </span>
-                    <Trend
-                      values={coarse(countsIn(v.bins, q.points), v.window)}
-                      label={trendLabel(countsIn(v.bins, q.points))}
-                    />
-                    <span className="usage-query-count">
-                      {count(q.count)}
-                      <span className="visually-hidden"> fois</span>
-                    </span>
-                  </li>
-                ))}
+                {list.items.map((q, i) => {
+                  const columns = coarse(countsIn(v.bins, q.points), v.window);
+                  const ranges = coarseRanges(v.bins, v.window);
+                  return (
+                    <li key={q.query}>
+                      <span className="usage-rank" aria-hidden="true">
+                        {i + 1}
+                      </span>
+                      <span className="usage-query" title={q.query}>
+                        {q.query}
+                      </span>
+                      <Trend
+                        values={columns}
+                        label={trendLabel(countsIn(v.bins, q.points))}
+                        tips={columns.map((n, c) => `${ranges[c]} · ${count(n)} fois`)}
+                      />
+                      <span className="usage-query-count">
+                        {count(q.count)}
+                        <span className="visually-hidden"> fois</span>
+                      </span>
+                    </li>
+                  );
+                })}
               </ol>
             )
           }
```

**File**: `quivr-search/src/components/admin/UsageChart.tsx` (modified, +18/-2)
```diff
@@ -202,14 +202,30 @@ export function Columns({
 }
 
 /** A row's trend: one micro-column per chart column, scaled to the row's peak. */
-export function Trend({ values, label }: { values: number[]; label: string }) {
+export function Trend({
+  values,
+  label,
+  tips,
+}: {
+  values: number[];
+  label: string;
+  /** What each micro-column reads on hover. */
+  tips?: string[];
+}) {
   const max = Math.max(1, ...values);
   return (
-    <span className="usage-trend" role="img" aria-label={label}>
+    <span
+      className="usage-trend"
+      role="img"
+      aria-label={label}
+      tabIndex={tips ? 0 : undefined}
+      data-tips={tips ? "" : undefined}
+    >
       {values.map((v, i) => (
         <span
           key={i}
           data-empty={v === 0 || undefined}
+          data-tip={tips?.[i]}
           style={{
             height: v ? `${Math.max(12, (v / max) * 100)}%` : undefined,
           }}
```

---

### Incident Patch 12: `b5603657` (2026-10-05)
**Commit Message**: fix(eval): keep campaigns alive through network outages (#3738)

Keep a campaign supervisor and watchdog alive through short network
outages. Connection setup retries with capped backoff for
EVAL_NETWORK_OUTAGE_SECONDS (default 600); acknowledged exploration
calls run detached and result retrieval reattaches to the same call ID.
A locked process registry keeps one admission gate per campaign under
concurrency and cache churn. Parallel local reservations pause during
Modal recovery; a final commit fence rolls back a reservation that raced
with outage detection, then waits outside SQL. No local admission
fallback.

Ownership records a recovery grace after the 120-second lease. Only the
same unreleased owner can recover it; paid mutations require a current
lease, and cleanup fences late renewal before terminating compute.
Authentication/configuration refusals, uncertain SQL commits and
unacknowledged app/spawn requests are never replayed. An exhausted
window leaves conservative reservations and compute for watchdog
reconciliation.

Validation: fake connection/Modal failures with fake clocks; real
PostgreSQL lease, watchdog and ledger tests. The launch regression fails
on the baseline 

**File**: `docs-site/run-quivr/run-search-campaign.mdx` (modified, +22/-0)
```diff
@@ -75,6 +75,28 @@ the end date and the trial limit stop the campaign. Conservative reservations
 include uncertain charges; Modal builds/storage and other account charges need
 separate budgeting. No measurements run in CI.
 
+Short network outages retry from 1 to 10 seconds for up to ten minutes. Configure
+`EVAL_NETWORK_OUTAGE_SECONDS` in the supervisor/watchdog environment (0–3600 seconds,
+default 600; 0 disables retries). Authentication/configuration refusals and uncertain
+transaction commits are not replayed. Local paid reservations pause while the Modal
+connection recovers. A detached exploration app runs independently of your machine.
+Once Modal returns a call ID, retrieval reconnects to that same call without another
+reservation or spawn. Measurements can keep progressing while only your machine is offline.
+
+Full-engine confirmations use a separate disconnect watchdog and may terminate
+after its keepalive deadline; the detached-call recovery above covers exploration.
+
+Ownership renews every ten seconds and expires after 120 seconds. The watchdog waits
+until lease expiry plus the recovery window recorded by that owner. This waiting
+period is the recovery grace: only that unreleased owner can renew during it, and
+paid work requires a current lease. Stop/release bypass grace.
+Past the retry window, the process exits unsuccessfully and the managed watchdog
+stops registered apps after grace and waits for termination acknowledgement. Lost
+app/spawn acknowledgements require that reconciliation. An app absent from a listing
+still leaves creation uncertain; an operator must resolve it with Modal before takeover.
+Uncertain charges and completed evidence stay recorded. A hard kill also waits grace.
+Adopt this behavior on the next campaign: `resume` requires its frozen checkout.
+
 ## Check and stop
 
 `status` returns aggregate results, Pareto objectives, spending and held-out reads
```

**File**: `docs/inventory.toml` (modified, +1/-1)
```diff
@@ -115,7 +115,7 @@ excluded = [
 # Maximum number of lines per page, in path order.
 [budgets]
 "docs/eval-private-working.md" = 90
-"docs/search-campaigns.md" = 150
+"docs/search-campaigns.md" = 172
 "docs/search-campaign-reporting.md" = 138
 "deploy/mlflow/README.md" = 68
 "docs/eval-engine-confirmation.md" = 174
```

**File**: `docs/search-campaigns.md` (modified, +22/-1)
```diff
@@ -111,6 +111,27 @@ Persistent contention defers supervisor/watchdog passes. Their `--once` mode ret
 Normal processes continue when contention clears. An unreachable database refuses
 further paid admission; there is no local budget fallback.
 
+Connection setup and Modal result retrieval retry from 1 to 10 seconds for
+`EVAL_NETWORK_OUTAGE_SECONDS` (default 600, range 0–3600; 0 disables retries).
+Set it in the supervisor/watchdog environment before the next campaign. Authentication
+and configuration refusals do not retry; transactions with uncertain commit outcomes
+are not replayed. While a Modal connection recovers, all local campaign reservations wait.
+Detached exploration apps survive lost operator heartbeats. Acknowledged calls reattach by their
+existing call ID, without another reservation or spawn. Lost app/spawn acknowledgements
+remain uncertain and require reconciliation rather than automatic relaunch.
+
+Full-engine confirmations use a separate disconnect watchdog and may terminate
+after its keepalive deadline; the detached-call recovery above covers exploration.
+
+The supervisor records that recovery window with its ownership. After the 120-second
+lease expires, the watchdog and a replacement supervisor wait that additional window.
+Only the same unreleased owner may renew during it; paid mutations require a current
+lease. Stop/release bypass the grace, and cleanup fences any late renewal before stopping
+apps. Past the retry window the process exits unsuccessfully, leaving running apps,
+leases and uncertain charges for the managed watchdog to reconcile after grace.
+Restart/resume still requires the frozen checkout. This behavior applies to the next
+campaign; do not restart an existing campaign on a different revision to adopt it.
+
 `status` returns aggregate trial reports, the Pareto trial numbers/objectives,
 confirmed plus uncertain ledger amounts, held-out reads left and `cleanup_pending`.
 No raw records, query IDs or latency sample IDs are exported. `agent_token_usage`
@@ -135,7 +156,7 @@ results are retained. `cleanup_pending: false` is the observable cleanup result.
 A cancellation/listing failure returns `cleanup_pending` and a nonzero exit code.
 Retry `stop` or let the managed watchdog retry. Do not report success while cleanup
 is pending. SIGTERM and Ctrl-C request terminal stop; a hard kill is reconciled by
-the independent watchdog after the supervisor lease expires. Never use a global
+the independent watchdog after the supervisor lease and recovery grace expire. Never use a global
 Modal stop: other campaigns may share the account.
 
 ## Next
```

**File**: `scripts/eval/campaign_compute.py` (modified, +37/-6)
```diff
@@ -7,18 +7,36 @@
 
 import campaign_store
 import modal_search
+import network_recovery
+
+
+def unreachable(error):
+    if isinstance(error, subprocess.TimeoutExpired):
+        return True
+    if isinstance(error, subprocess.CalledProcessError):
+        message = error.stderr or b''
+        if isinstance(message, bytes):
+            message = message.decode('utf-8', errors='replace')
+        return any(marker in message.lower() for marker in (
+            'connectionerror', 'deadline exceeded', 'temporary failure in name resolution',
+            'nodename nor servname provided', 'network is unreachable', 'connection reset',
+            'connection refused', 'tls handshake', 'failed to connect'))
+    return False
 
 
 class ModalCompute:
     def apps(self):
         # Capture provider output: reflected credentials never reach CLI output.
         try:
-            result = subprocess.run([sys.executable, '-m', 'modal', 'app', 'list', '--json'],
-                                    capture_output=True, text=True, timeout=30, check=True)
+            result = network_recovery.retry(lambda: subprocess.run(
+                [sys.executable, '-m', 'modal', 'app', 'list', '--json'],
+                capture_output=True, text=True, timeout=30, check=True), unreachable)
             rows = json.loads(result.stdout)
             if not isinstance(rows, list):
                 raise ValueError('invalid app listing')
             return rows
+        except network_recovery.Outage:
+            raise
         except Exception:
             raise campaign_store.CleanupPending('Modal resource listing unavailable') from None
 
@@ -36,8 +54,11 @@ def stop(self, app_id):
         if not self.running(app_id):
             return
         try:
-            subprocess.run([sys.executable, '-m', 'modal', 'app', 'stop', '--yes', app_id],
-                           capture_output=True, timeout=30, check=True)
+            network_recovery.retry(lambda: subprocess.run(
+                [sys.executable, '-m', 'modal', 'app', 'stop', '--yes', app_id],
+                capture_output=True, timeout=30, check=True), unreachable)
+        except network_recovery.Outage:
+            raise
         except Exception:
             raise campaign_store.CleanupPending('Modal stop acknowledgement unavailable') from None
         deadline = time.monotonic() + 30
@@ -62,11 +83,21 @@ def __call__(self, config):
                 app_name=resource['label'],
                 on_app=lambda app: self.store.bind(self.name, self.owner, resource['id'], app),
                 check=lambda: self.store.renew_owner(self.name, self.owner))
+        except network_recovery.Outage:
+            raise
+        except Exception as error:
+            if network_recovery.modal_unreachable(error):
+                raise network_recovery.Outage('Modal app acknowledgement unavailable; reconcile before retrying') from None
+            raise
         finally:
+            # A bounded outage leaves detached compute and uncertain admissions
+            # intact. The independent watchdog reconciles after ownership grace.
+            # Do not spend another outage window on release/cleanup here.
             # A failed creation/bind remains pending for the watchdog. Live
             # ownership can close only resources whose exact ID is acknowledged.
-            current = self.store.snapshot(self.name)['resources'][resource['id']]
-            if current['app_id']:
+            current = (self.store.snapshot(self.name)['resources'][resource['id']]
+                       if not isinstance(sys.exc_info()[1], network_recovery.Outage) else None)
+            if current and current['app_id']:
                 self.compute.stop(current['app_id'])
                 if self.compute.running(current['app_id']):
                     raise campaign_store.CleanupPending('Modal termination is still pending')
```

**File**: `scripts/eval/campaign_store.py` (modified, +25/-11)
```diff
@@ -6,6 +6,12 @@
 import control_store
 import modal_search
 import search_trial
+import network_recovery
+
+# Server time and durable owner state are shared by supervisor and watchdog.
+RECOVERABLE = """owner IS NOT NULL
+    AND NOT COALESCE((state->>'owner_released')::boolean,false)
+    AND expires_at+COALESCE((state->>'outage_seconds')::integer,0)*interval '1 second'>clock_timestamp()"""
 
 
 class CleanupPending(RuntimeError):
@@ -31,11 +37,11 @@ def register(self, spec, sha, scorer):
     def snapshot(self, name):
         with self.transaction() as db:
             self.lock(db, name)
-            row = db.execute('SELECT spec,git_sha,scorer_digest,state,owner,expires_at>clock_timestamp(),generation FROM eval_control.campaign_runs WHERE campaign=%s', (name,)).fetchone()
+            row = db.execute('SELECT spec,git_sha,scorer_digest,state,owner,expires_at>clock_timestamp(),generation,' + RECOVERABLE + ' FROM eval_control.campaign_runs WHERE campaign=%s', (name,)).fetchone()
             if not row:
                 raise ValueError('campaign supervisor has not been registered')
         return {**row[3], 'spec': row[0], 'git_sha': row[1], 'scorer_digest': row[2],
-                'owner': row[4], 'live': bool(row[5]), 'generation': row[6]}
+                'owner': row[4], 'live': bool(row[5]), 'generation': row[6], 'recoverable': bool(row[7])}
 
     @control_store.retry_contention
     def confirmation_configuration(self, name, configuration):
@@ -97,46 +103,52 @@ def acquire(self, name, ttl=120):
             policy, stopped = self.lock(db, name)
             if self.terminal(db, name, policy, stopped):
                 raise control_store.LeaseLost('campaign stopped or ended')
-            row = db.execute('SELECT owner,expires_at>clock_timestamp(),state FROM eval_control.campaign_runs WHERE campaign=%s FOR UPDATE', (name,)).fetchone()
+            row = db.execute('SELECT owner,expires_at>clock_timestamp(),state,' + RECOVERABLE + ' FROM eval_control.campaign_runs WHERE campaign=%s FOR UPDATE', (name,)).fetchone()
             if row is None:
                 raise ValueError('campaign supervisor has not been registered')
-            if row[0] and row[1]:
+            if row[0] and (row[1] or row[3]):
                 raise control_store.LeaseBusy('campaign supervisor is still live')
             if any(r['status'] != 'closed' for r in row[2]['resources'].values()):
                 raise CleanupPending('reconcile prior compute before supervisor takeover')
             owner = uuid.uuid4().hex
-            db.execute("UPDATE eval_control.campaign_runs SET owner=%s,expires_at=clock_timestamp()+%s*interval '1 second',generation=generation+1 WHERE campaign=%s", (owner, ttl, name))
+            state = {**row[2], 'owner_released': False, 'outage_seconds': network_recovery.window()}
+            db.execute("UPDATE eval_control.campaign_runs SET owner=%s,expires_at=clock_timestamp()+%s*interval '1 second',generation=generation+1,state=%s::jsonb WHERE campaign=%s", (owner, ttl, json.dumps(state), name))
         return owner
 
     @contextlib.contextmanager
-    def mutation(self, name, owner=None, *, cleanup=False):
+    def mutation(self, name, owner=None, *, cleanup=False, recovering=False):
         with self.transaction() as db:
             policy, stopped = self.lock(db, name)
             stopped = self.terminal(db, name, policy, stopped)
-            row = db.execute('SELECT owner,expires_at>clock_timestamp(),state,generation FROM eval_control.campaign_runs WHERE campaign=%s FOR UPDATE', (name,)).fetchone()
+            row = db.execute('SELECT owner,expires_at>clock_timestamp(),state,generation,' + RECOVERABLE + ' FROM eval_control.campaign_runs WHERE campaign=%s FOR UPDATE', (name,)).fetchone()
             if not row:
                 raise ValueError('campaign supervisor has not been registered')
             if cleanup:
-                if not stopped and row[0] and row[1]:
+                if not stopped and row[0] and (row[1] or row[4]):
                     raise control_store.LeaseBusy('cannot reconcile compute of a live supervisor')
-            elif stopped or not owner or owner != row[0] or not row[1]:
+            elif (stopped or not owner or owner != row[0] or row[2].get('owner_released')
+                  or not (row[1] or (recovering and row[4]))):
                 raise control_store.LeaseLost('supervisor stopped, expired or replaced')
             state = row[2]
+            if cleanup:
+                # Commit the fence before external stop/listing I/O. A late
+                # renewal must not race a watchdog that already began cleanup.
+                state['owner_released'] = True
             yield db, state, row[3]
             db.execute('UPDATE eval_control.campaign_runs SET state=%s::jsonb WHERE campaign=%s', (json.dumps(state, allow_nan=False), name))
 
     @control_store.retry_contention
     def renew_owner(self, name, owner, ttl=120):
         control_st
```

**File**: `scripts/eval/control_store.py` (modified, +19/-2)
```diff
@@ -16,6 +16,7 @@
 import uuid
 
 import embeddings
+import network_recovery
 
 LEASE_BATCH_SIZE = 128
 VALIDATION_LEASE_TTL = 600
@@ -34,6 +35,10 @@ class Unavailable(RuntimeError):
     pass
 
 
+class NetworkUnavailable(Unavailable, network_recovery.Outage):
+    pass
+
+
 class Contention(RuntimeError):
     """A known-aborted SQL transaction can be retried without paid side effects."""
 
@@ -117,8 +122,10 @@ def transaction(self):
                     except (OSError, UnicodeError):
                         raise Unavailable('evaluation control CA unavailable; paid admission refused') from None
                     dsn = make_conninfo(dsn, sslrootcert=ca.name)
-                with psycopg.connect(dsn, connect_timeout=5, options='-c statement_timeout=10000') as db:
+                with network_recovery.connect(dsn, connect_timeout=5, options='-c statement_timeout=10000') as db:
                     yield db
+        except network_recovery.Outage:
+            raise NetworkUnavailable('evaluation control connection outage window elapsed; paid admission refused') from None
         except (psycopg.errors.LockNotAvailable, psycopg.errors.QueryCanceled,
                 psycopg.errors.DeadlockDetected, psycopg.errors.SerializationFailure):
             raise Contention('evaluation control transaction timed out or conflicted; retrying') from None
@@ -305,11 +312,20 @@ def availability(self, name):
 
     @retry_contention
     def reserve(self, name, kind, usd, metadata=None, lease=None):
+        gate = network_recovery.admission(name)
+        while True:
+            gate.wait()
+            try:
+                return self._reserve(name, kind, usd, metadata, lease, gate)
+            except network_recovery.AdmissionPaused:
+                continue
+
+    def _reserve(self, name, kind, usd, metadata, lease, gate):
         amount, refused = money(usd), False
         if kind not in ('provider', 'modal'):
             raise ValueError('unsupported ledger kind')
         rid = uuid.uuid4().hex
-        with self.transaction() as db:
+        with contextlib.ExitStack() as admission_fence, self.transaction() as db:
             policy, stopped = self.lock(db, name)
             if lease:
                 self.fence(db, name, *lease)
@@ -326,6 +342,7 @@ def reserve(self, name, kind, usd, metadata=None, lease=None):
                 db.execute('UPDATE eval_control.days SET stopped=true WHERE campaign=%s AND day=%s AND kind=%s', (name, day, kind))
                 refused = True
             else:
+                admission_fence.enter_context(gate.commit())
                 values = (rid, name, day, kind, amount, amount, json.dumps(metadata or {}, allow_nan=False))
                 # Recheck the deadline at the write itself, after preceding SQL
                 # and network latency, just like the measurement lease fence.
```

**File**: `scripts/eval/modal_search.py` (modified, +30/-2)
```diff
@@ -18,6 +18,7 @@
 import results
 import search_trial
 import private_working
+import network_recovery
 
 ROOT = pathlib.Path(__file__).resolve().parents[2]
 COMPUTE_NOTICE = ('The compute cap covers compute reserved by this runner, not the full Modal invoice; '
@@ -191,6 +192,10 @@ def dispatch(store, campaign, policy, cfg, name, sha, scorer_digest, invoke, out
         return completed(store, campaign, key, row, tracking, 'complete')
     except embeddings.BudgetExceeded:
         status, reason = 'capped', 'daily reservation cap reached or usage bound exceeded'
+    except network_recovery.Outage:
+        # The same invocation may still be running. Keep its reservation and
+        # measurement lease until the watchdog acknowledges app termination.
+        raise
     except Exception:
         status, reason = 'failed', 'measurement or evidence publication failed; uncertain charges retained'
     try:
@@ -303,6 +308,28 @@ def shipped_trial():
     return remote_trial
 
 
+def invoke(remote, request, check):
+    """Spawn once; result retries attach to the acknowledged call identity."""
+    import modal
+    check()  # reservation reconnects may have outlasted the supervisor lease
+    try:
+        call_id = remote.spawn(request).object_id
+    except Exception as error:
+        if not network_recovery.modal_unreachable(error):
+            raise
+        raise network_recovery.Outage('Modal spawn acknowledgement unavailable; reconcile before retrying') from None
+    def retrieve():
+        check()  # recover ownership before any following paid invocation
+        return modal.FunctionCall.from_id(call_id).get(timeout=10)
+    while True:
+        try:
+            return network_recovery.retry(retrieve, network_recovery.modal_unreachable,
+                                          campaign=request['campaign'])
+        except TimeoutError:
+            # A reachable server with an unfinished trial is not an outage.
+            continue
+
+
 def launch(policy, candidate, campaign, outbox, fresh_latency, *, app_name='quivr-search-measurement',
            on_app=lambda identity: None, check=lambda: None):
     import modal
@@ -336,14 +363,15 @@ def ignored(path):
         for name in ('scoring.py', 'gates.py', 'search_trial.py', 'embeddings.py', 'direct_bakeoff.py', 'private_working.py', 'protected_inputs.py')})
     pairs, work = {}, {}
     check()
-    with app.run():
+    with app.run(detach=True):
         on_app(app.app_id)
         for name in policy['sets']:
             pair = {}
             sides = (('candidate', candidate),) if 'input' in policy['sets'][name] else (('baseline', policy['baseline']), ('candidate', candidate))
             for side, cfg in sides:
                 check()
-                outcome = dispatch(store, campaign, policy, cfg, name, sha, scorer_digest, remote.remote, outbox, fresh_latency)
+                outcome = dispatch(store, campaign, policy, cfg, name, sha, scorer_digest,
+                                   lambda request: invoke(remote, request, check), outbox, fresh_latency)
                 work[name + '/' + side] = {k: v for k, v in outcome.items() if k not in ('record', 'baseline_record', 'baseline_receipt')}
                 if outcome['status'] in ('complete', 'reused'):
                     row = outcome['record']
```

**File**: `scripts/eval/network_recovery.py` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+"""Bounded retries for connection setup and acknowledged, read-only remote calls."""
+import contextlib
+import os
+import time
+import threading
+
+
+class Outage(RuntimeError):
+    """The network recovery window elapsed; preserve uncertain work for cleanup."""
+
+
+class AdmissionPaused(RuntimeError):
+    """Roll back a reservation before waiting for transport recovery."""
+
+
+class AdmissionGate:
+    """Pause all local campaign reservations while a Modal transport recovers."""
+    def __init__(self):
+        self.condition = threading.Condition()
+        self.pending = 0
+        self.failed = False
+
+    def pause(self):
+        with self.condition:
+            self.pending += 1
+
+    def finish(self, failed):
+        with self.condition:
+            self.pending -= 1
+            self.failed |= failed
+            self.condition.notify_all()
+
+    @contextlib.contextmanager
+    def commit(self):
+        # Serialize the final write/commit with outage detection. Never wait
+        # for recovery while holding a database transaction or campaign lock.
+        with self.condition:
+            if self.pending or self.failed:
+                raise AdmissionPaused()
+            yield
+
+    def wait(self):
+        with self.condition:
+            ready = self.condition.wait_for(lambda: not self.pending or self.failed, timeout=window())
+            if not ready or self.failed:
+                raise Outage('campaign network recovery failed; paid admission refused')
+
+
+_admissions = {}
+_admission_lock = threading.Lock()
+
+
+def admission(campaign):
+    # A gate is process-lifetime state: concurrent creation or eviction could
+    # split the campaign's pause/failure fence across different identities.
+    with _admission_lock:
+        if campaign not in _admissions:
+            _admissions[campaign] = AdmissionGate()
+        return _admissions[campaign]
+
+
+def window():
+    try:
+        seconds = int(os.environ.get('EVAL_NETWORK_OUTAGE_SECONDS', '600'))
+    except ValueError:
+        raise ValueError('EVAL_NETWORK_OUTAGE_SECONDS must be an integer from 0 to 3600') from None
+    if not 0 <= seconds <= 3600:
+        raise ValueError('EVAL_NETWORK_OUTAGE_SECONDS must be an integer from 0 to 3600')
+    return seconds
+
+
+def retry(operation, unreachable, *, seconds=None, campaign=None):
+    """Never use around admission, app creation, spawn or uncertain SQL commits."""
+    seconds = window() if seconds is None else seconds
+    deadline = None
+    delay = 1
+    gate = None
+    failed = False
+    try:
+        while True:
+            try:
+                return operation()
+            except Exception as error:
+                if not unreachable(error):
+                    raise
+                if deadline is None:
+                    deadline = time.monotonic() + seconds
+                    if campaign is not None:
+                        gate = admission(campaign)
+                        gate.pause()
+                remaining = deadline - time.monotonic()
+                if remaining <= 0:
+                    failed = True
+                    raise Outage('network outage window elapsed; no new paid work admitted') from None
+                time.sleep(min(delay, remaining))
+                delay = min(delay * 2, 10)
+    finally:
+        if gate is not None:
+            gate.finish(failed)
+
+
+def postgres_unreachable(error):
+    import psycopg
+    if not isinstance(error, psycopg.OperationalError):
+        return False
+    if error.sqlstate is not None:
+        return error.sqlstate.startswith('08') or error.sqlstate in ('57P01', '57P02', '57P03')
+    # libpq connection failures often have no SQLSTATE, including authentication
+    # failures. Inspect only locally; never emit dependency text or credentials.
+    message = str(error).lower()
+    refusals = ('password authentication failed', 'no password supplied', 'no pg_hba.conf entry',
+                'does not exist', 'certificate verify failed', 'root certificate file',
+                'private key file', 'invalid connection option', 'invalid sslmode')
+    return not any(refusal in message for refusal in refusals)
+
+
+def connect(dsn, **kwargs):
+    import psycopg
+    return retry(lambda: psycopg.connect(dsn, **kwargs), postgres_unreachable)
+
+def modal_unreachable(error):
+    import modal
+    from grpclib import Status
+    from modal._utils.grpc_utils import RetryTimeoutError
+    if isinstance(error, RetryTimeoutError):
+        error = error.final_exception
+    if isinstance(error, modal.exception.ConnectionError):
+        return True
+    # SDK 1.x retains the underlying status on ServiceError; UNKNOWN and
+    # CANCELLED also map here, so the class alone is insufficient.
+    return (isinstance(error, modal.exception.ServiceError)
+            and getattr(error, '_grpc_status', None) in (Status.UNAVAILABLE, Status.DEADLINE_EXCEEDED))
```

---

### Incident Patch 13: `82e1f619` (2026-10-05)
**Commit Message**: fix(eval): keep parallel campaign control responsive (#3734)

Campaign trials commit bounded cache reservations before reading files,
leaving the campaign lock available to the watchdog and supervisor. A
validation failure releases newly acquired, unpublished entries across
the whole unstarted wave, fenced by owner. If release cannot reach the
database, unpaid claims expire within ten minutes; the longer work lease
starts only after validation.

Known-aborted PostgreSQL transactions retry with exponential backoff
capped at 10 seconds within a 30-second retry window. Persistent
contention defers supervisor/watchdog passes; their `--once` mode
returns `retrying` with exit 0. Other incomplete commands return exit 2.
Recovery refuses a different live supervisor. SQL-only notification
state writes retry independently of transport, preserving an
acknowledged delivery without resending it. Connection failures still
refuse admission. Atomic cap checks, fencing and durable publication
retain their existing transactions.

Fixes THE-1032.

## Validation

- A real PostgreSQL regression holds three actual trial cache readers
with synchronization events. The watchdog completes within two seconds

**File**: `docs/search-campaigns.md` (modified, +9/-2)
```diff
@@ -101,8 +101,15 @@ A running supervisor resumes automatically that day; a dead one needs managed
 restart or `resume`. Ownership leases last 120 seconds and renew every 10 seconds. Total
 exhaustion, the end timestamp, an operator stop or the trial limit ends the campaign.
 SQL admission checks every paid reservation against the same shared caps. The
-watchdog checks independently of a blocked measurement. Temporary database failures
-refuse further paid admission; there is no local budget fallback.
+watchdog checks independently of a blocked measurement. Trials reserve cache entries
+in SQL before validating files, so file reads do not hold the campaign row lock.
+Unpaid cache reservations expire within ten minutes if release fails; leases extend
+for paid work only after validation. SQL lock conflicts and timeouts retry with
+exponential backoff from 1 to 10 seconds within a 30-second retry window.
+Persistent contention defers supervisor/watchdog passes. Their `--once` mode returns
+`status: retrying` and exit 0; other incomplete commands return `retrying` and exit 2.
+Normal processes continue when contention clears. An unreachable database refuses
+further paid admission; there is no local budget fallback.
 
 `status` returns aggregate trial reports, the Pareto trial numbers/objectives,
 confirmed plus uncertain ledger amounts, held-out reads left and `cleanup_pending`.
```

**File**: `scripts/eval/campaign_promotion.py` (modified, +27/-8)
```diff
@@ -22,6 +22,7 @@
 """
 import ast
 import contextlib
+import control_store
 import copy
 import hashlib
 import json
@@ -453,11 +454,7 @@ def confirm(store, name, trial, owner, *, adapter=None, repository=ROOT, compute
                                engine_scorer_digest=getattr(adapter, 'engine_scorer_digest', None),
                                heldout_family=getattr(adapter, 'heldout_family', None), engine_checkout=engine_checkout,
                                confirmation_policy_digest=getattr(adapter, 'confirmation_policy_digest', None))
-        with store.mutation(name, owner) as (_, current, __):
-            protocol = {k: request[k] for k in ('confirmation_policy_digest',
-                'engine_runner_git_sha', 'engine_runner_scorer_digest', 'heldout_family_digest')}
-            if current.setdefault('confirmation_protocol', protocol) != protocol:
-                raise Refused('confirmation runner policy and held-out family are frozen for this campaign')
+        _freeze_confirmation(store, name, owner, request)
         store.renew_owner(name, owner)
         handle = ConfirmationResource(store, name, owner)
         try:
@@ -509,14 +506,35 @@ def confirm(store, name, trial, owner, *, adapter=None, repository=ROOT, compute
                 report = None
                 outcome = {'status': 'pending_confirmation', 'reason': 'Confirmation compute cleanup pending; retry watchdog or stop.'}
     # A stopped/replaced owner cannot publish a receipt after external work.
+    _finish_confirmation(store, name, owner, trial, outcome, receipt, report)
+    return outcome
+
+
+
+@control_store.retry_contention
+def _freeze_confirmation(store, name, owner, request):
+    with store.mutation(name, owner) as (_, current, __):
+        protocol = {k: request[k] for k in ('confirmation_policy_digest',
+            'engine_runner_git_sha', 'engine_runner_scorer_digest', 'heldout_family_digest')}
+        if current.setdefault('confirmation_protocol', protocol) != protocol:
+            raise Refused('confirmation runner policy and held-out family are frozen for this campaign')
+
+
+@control_store.retry_contention
+def _finish_confirmation(store, name, owner, trial, outcome, receipt, report):
     with store.mutation(name, owner) as (_, current, __):
         record = {**outcome}
         if receipt:
             record['receipt'] = receipt
         if report:
             record['report'] = report
         current.setdefault('confirmations', {})[str(trial)] = record
-    return outcome
+
+
+@control_store.retry_contention
+def _remember_confirmation(store, name, number, result):
+    with store.edit(name) as (_, current):
+        current.setdefault('confirmations', {}).setdefault(number, result)
 
 
 def _main_revision(repository):
@@ -589,6 +607,7 @@ def create(self, checkout, branch, title, body):
         return self.find(branch)
 
 
+@control_store.retry_contention
 def _promotion_claim(store, name, key, branch, evidence):
     with store.edit(name) as (db, state):
         now = db.execute('SELECT clock_timestamp()').fetchone()[0]
@@ -610,6 +629,7 @@ def _promotion_claim(store, name, key, branch, evidence):
         return owner, None
 
 
+@control_store.retry_contention
 def _promotion_finish(store, name, key, owner, outcome):
     with store.edit(name) as (db, state):
         record = state['promotions'][key]
@@ -756,8 +776,7 @@ def advance(store, name, owner, *, repository=ROOT, adapter=None, compute=None,
             continue
         result = confirm(store, name, int(number), owner, adapter=adapter, repository=repository, compute=compute)
         if adapter is None:
-            with store.edit(name) as (_, current):
-                current.setdefault('confirmations', {}).setdefault(number, result)
+            _remember_confirmation(store, name, number, result)
         elif result['status'] == 'confirmed':
             result = promote(store, name, int(number), repository=repository, github=github, builder=builder)
         outcomes.append({'trial': int(number), **result})
```

**File**: `scripts/eval/campaign_reporting.py` (modified, +44/-24)
```diff
@@ -6,9 +6,11 @@
 import uuid
 import urllib.request
 
+import control_store
 import search_trial
 
 
+@control_store.retry_contention
 def ingest_usage(store, name, receipt):
     from search_campaign import IDENTIFIER
     fields = {'provider', 'session', 'turn', 'input_tokens', 'output_tokens', 'cached_input_tokens'}
@@ -51,6 +53,7 @@ def inside(key, value, distribution):
     return low <= value <= high and math.isclose((value - low) / step, round((value - low) / step), abs_tol=1e-8)
 
 
+@control_store.retry_contention
 def propose(store, name, proposal):
     """Only expand numeric ranges; safety and the measured baseline stay frozen."""
     from search_campaign import IDENTIFIER, specification
@@ -236,45 +239,62 @@ def send(self, destination, item, identity):
         return receipt
 
 
-def digest(store, name, *, automatic=False):
-    """Freeze once per UTC day and retry each destination with a durable ID."""
-    snapshot = store.snapshot(name)
-    available, ledger = store.availability(name), store.summary(name)
-    body = digest_body(snapshot, available, ledger)
+@control_store.retry_contention
+def _freeze_digest(store, name, snapshot, available, body):
     with store.edit(name) as (_, state):
         days = state.setdefault('digests', {})
         days.setdefault(available['day'], {'body': body, 'ticket': snapshot['spec']['ticket'],
             'slack_channel': os.environ.get('EVAL_SLACK_CHANNEL'),
             'deliveries': {d: {'id': str(uuid.uuid4()), 'status': 'pending'} for d in ('linear', 'slack')}})
+
+
+@control_store.retry_contention
+def _claim_delivery(store, name, day, destination, owner, automatic):
+    with store.edit(name) as (db, state):
+        item = state['digests'][day]
+        delivery = item['deliveries'][destination]
+        if delivery['status'] == 'delivered':
+            return None
+        now = db.execute('SELECT extract(epoch FROM clock_timestamp())').fetchone()[0]
+        if delivery.get('expires', 0) > now or (automatic and delivery.get('retry_after', 0) > now):
+            return None
+        # Freeze the channel when first provisioned, then keep it on retries.
+        if not item['slack_channel']:
+            item['slack_channel'] = os.environ.get('EVAL_SLACK_CHANNEL')
+        delivery.update(owner=owner, expires=float(now) + 120, status='sending')
+    return item, delivery
+
+
+@control_store.retry_contention
+def _finish_delivery(store, name, day, destination, owner, receipt):
+    with store.edit(name) as (db, state):
+        delivery = state['digests'][day]['deliveries'][destination]
+        if delivery.get('owner') == owner:
+            now = db.execute('SELECT extract(epoch FROM clock_timestamp())').fetchone()[0]
+            delivery.update(status='delivered' if receipt else 'retry', receipt=receipt, expires=0,
+                            retry_after=float(now) + 60)
+
+
+def digest(store, name, *, automatic=False):
+    """Freeze once per UTC day and retry each destination with a durable ID."""
+    snapshot = store.snapshot(name)
+    available, ledger = store.availability(name), store.summary(name)
+    _freeze_digest(store, name, snapshot, available, digest_body(snapshot, available, ledger))
     # Retry old days too. A completed destination never sends again.
     for day in sorted(store.snapshot(name)['digests']):
         for destination in ('linear', 'slack'):
             owner = uuid.uuid4().hex
-            with store.edit(name) as (db, state):
-                item = state['digests'][day]
-                delivery = item['deliveries'][destination]
-                if delivery['status'] == 'delivered':
-                    continue
-                now = db.execute('SELECT extract(epoch FROM clock_timestamp())').fetchone()[0]
-                if delivery.get('expires', 0) > now or (automatic and delivery.get('retry_after', 0) > now):
-                    continue
-                # Channel may be provisioned after the first wave. Freeze it
-                # when first available; retries keep the original destination.
-                if not item['slack_channel']:
-                    item['slack_channel'] = os.environ.get('EVAL_SLACK_CHANNEL')
-                delivery.update(owner=owner, expires=float(now) + 120, status='sending')
+            claimed = _claim_delivery(store, name, day, destination, owner, automatic)
+            if claimed is None:
+                continue
+            item, delivery = claimed
             try:
                 if destination == 'slack' and not item['slack_channel']:
                     raise ValueError('Slack channel not provisioned')
                 receipt = Notifications().send(destination, item, delivery['id'])
             except Exception:
                 receipt = None
-            with store.edit(name) as (db, state):
-                delivery = state['digests'][day]['deliveries'][destination]
-                if delivery.get('owner') == owner:
-                    now = 
```

**File**: `scripts/eval/campaign_store.py` (modified, +19/-3)
```diff
@@ -13,6 +13,7 @@ class CleanupPending(RuntimeError):
 
 
 class CampaignStore(control_store.Store):
+    @control_store.retry_contention
     def register(self, spec, sha, scorer):
         from search_campaign import specification
         spec = specification(spec)
@@ -26,6 +27,7 @@ def register(self, spec, sha, scorer):
             if row != (spec, sha, scorer):
                 raise ValueError('campaign spec and measurement lineage are immutable')
 
+    @control_store.retry_contention
     def snapshot(self, name):
         with self.transaction() as db:
             self.lock(db, name)
@@ -35,12 +37,14 @@ def snapshot(self, name):
         return {**row[3], 'spec': row[0], 'git_sha': row[1], 'scorer_digest': row[2],
                 'owner': row[4], 'live': bool(row[5]), 'generation': row[6]}
 
+    @control_store.retry_contention
     def confirmation_configuration(self, name, configuration):
         """Freeze validated operator metadata independently of exploration state."""
         with self.edit(name) as (_, state):
             if state.setdefault('confirmation_configuration', configuration) != configuration:
                 raise ValueError('confirmation configuration is immutable')
 
+    @control_store.retry_contention
     def development_keys(self, name, trial):
         """Resolve synced aggregate result identities to canonical SQL leases.
 
@@ -86,6 +90,7 @@ def edit(self, name):
             yield db, state
             db.execute('UPDATE eval_control.campaign_runs SET state=%s::jsonb WHERE campaign=%s', (json.dumps(state, allow_nan=False), name))
 
+    @control_store.retry_contention
     def acquire(self, name, ttl=120):
         control_store.lease_batch([], ttl)
         with self.transaction() as db:
@@ -120,17 +125,20 @@ def mutation(self, name, owner=None, *, cleanup=False):
             yield db, state, row[3]
             db.execute('UPDATE eval_control.campaign_runs SET state=%s::jsonb WHERE campaign=%s', (json.dumps(state, allow_nan=False), name))
 
+    @control_store.retry_contention
     def renew_owner(self, name, owner, ttl=120):
         control_store.lease_batch([], ttl)
         with self.mutation(name, owner) as (db, _, __):
             db.execute("UPDATE eval_control.campaign_runs SET expires_at=clock_timestamp()+%s*interval '1 second' WHERE campaign=%s", (ttl, name))
 
+    @control_store.retry_contention
     def release_owner(self, name, owner):
         # Release only our ownership; a stopped campaign can still drain safely.
         with self.transaction() as db:
             self.lock(db, name)
             db.execute('UPDATE eval_control.campaign_runs SET expires_at=clock_timestamp() WHERE campaign=%s AND owner=%s', (name, owner))
 
+    @control_store.retry_contention
     def intent(self, name, owner):
         identity = uuid.uuid4().hex
         with self.mutation(name, owner) as (db, state, generation):
@@ -144,6 +152,7 @@ def intent(self, name, owner):
             state['resources'][identity] = resource
         return resource
 
+    @control_store.retry_contention
     def bind(self, name, owner, identity, app_id):
         if not isinstance(app_id, str) or not app_id.startswith('ap-'):
             raise ValueError('invalid Modal app identity')
@@ -153,26 +162,33 @@ def bind(self, name, owner, identity, app_id):
                 raise control_store.LeaseLost('resource was already closed or bound')
             resource.update(app_id=app_id, status='running')
 
+    @control_store.retry_contention
     def closed(self, name, identity, *, owner=None):
         with self.mutation(name, owner, cleanup=owner is None) as (_, state, __):
             state['resources'][identity]['status'] = 'closed'
 
+    @control_store.retry_contention
     def trial(self, name, owner, number, value):
         with self.mutation(name, owner) as (_, state, __):
             state['trials'][str(number)] = value
 
+    @control_store.retry_contention
     def clear_leases(self, name):
         with self.mutation(name, cleanup=True) as (db, state, _):
             if any(r['status'] != 'closed' for r in state['resources'].values()):
                 raise CleanupPending('compute termination is not acknowledged')
             db.execute('UPDATE eval_control.leases SET expires_at=clock_timestamp() WHERE campaign=%s AND payload IS NULL', (name,))
 
+    @control_store.retry_contention
+    def cleanup_state(self, name):
+        """Fence cleanup and read its intents before any external compute I/O."""
+        with self.mutation(name, cleanup=True) as (_, state, __):
+            return state
+
 
 def cleanup(store, name, compute):
     # Fence before network I/O. New launch/bind is now refused for expired/stopped owners.
-    with store.mutation(name, cleanup=True):
-        pass
-    state = store.snapshot(name)
+    state = store.cleanup_state(name)
     pending = False
     for identity, resource in state['resources'].items():
         if resource['status'] == 'closed
```

**File**: `scripts/eval/control_store.py` (modified, +86/-11)
```diff
@@ -6,15 +6,19 @@
 import contextlib
 import decimal
 import datetime
+import functools
 import json
+import logging
 import os
 import re
 import tempfile
+import time
 import uuid
 
 import embeddings
 
 LEASE_BATCH_SIZE = 128
+VALIDATION_LEASE_TTL = 600
 
 
 def lease_batch(keys, ttl=3600):
@@ -30,6 +34,28 @@ class Unavailable(RuntimeError):
     pass
 
 
+class Contention(RuntimeError):
+    """A known-aborted SQL transaction can be retried without paid side effects."""
+
+
+def retry_contention(operation):
+    """Retry SQL-only operations after rollback; never replay connection errors."""
+    @functools.wraps(operation)
+    def run(*args, **kwargs):
+        deadline = time.monotonic() + 30
+        delay = 1
+        while True:
+            try:
+                return operation(*args, **kwargs)
+            except Contention:
+                remaining = deadline - time.monotonic()
+                if remaining <= 0:
+                    raise
+                time.sleep(min(delay, remaining))
+                delay = min(delay * 2, 10)
+    return run
+
+
 class LeaseLost(RuntimeError):
     pass
 
@@ -93,6 +119,9 @@ def transaction(self):
                     dsn = make_conninfo(dsn, sslrootcert=ca.name)
                 with psycopg.connect(dsn, connect_timeout=5, options='-c statement_timeout=10000') as db:
                     yield db
+        except (psycopg.errors.LockNotAvailable, psycopg.errors.QueryCanceled,
+                psycopg.errors.DeadlockDetected, psycopg.errors.SerializationFailure):
+            raise Contention('evaluation control transaction timed out or conflicted; retrying') from None
         except psycopg.Error:
             raise Unavailable('evaluation control store unavailable; paid admission refused') from None
 
@@ -102,6 +131,7 @@ def lock(self, db, name):
             raise ValueError('campaign has not been registered')
         return row
 
+    @retry_contention
     def campaign(self, name, policy):
         for kind in ('provider', 'modal'):
             if money(policy[kind + '_daily_usd']) <= 0:
@@ -130,19 +160,14 @@ def claim(self, name, key, ttl=3600):
         return self.claim_many(name, [key], ttl)[key]
 
     def claim_many(self, name, keys, ttl=3600, *, require_available=False):
-        with self.claim_batch(name, keys, ttl, require_available=require_available) as claims:
-            return claims
-
-    @contextlib.contextmanager
-    def claim_batch(self, name, keys, ttl=3600, *, require_available=False):
-        """Validate a bounded chunk inside its claim transaction.
-
-        Caller errors roll back new owners. Start paid work only after exit.
-        """
+        """Commit a bounded claim transaction before returning to the caller."""
         keys = lease_batch(keys, ttl)
+        return self._claim_many(name, keys, ttl, require_available=require_available)
+
+    @retry_contention
+    def _claim_many(self, name, keys, ttl, *, require_available):
         if not keys:
-            yield {}
-            return
+            return {}
         with self.transaction() as db:
             self.lock(db, name)
             rows = db.execute('SELECT key, owner, expires_at>clock_timestamp(), payload FROM eval_control.leases WHERE campaign=%s AND key=ANY(%s)', (name, keys)).fetchall()
@@ -161,11 +186,42 @@ def claim_batch(self, name, keys, ttl=3600, *, require_available=False):
                     claims[key] = {'status': 'claimed', 'owner': owners[key]}
             if owners:
                 db.execute("INSERT INTO eval_control.leases(campaign,key,owner,expires_at) SELECT %s, key, owner, clock_timestamp()+%s*interval '1 second' FROM unnest(%s::text[],%s::text[]) AS batch(key,owner) ON CONFLICT (campaign,key) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at", (name, ttl, list(owners), list(owners.values())))
+        return claims
+
+    @contextlib.contextmanager
+    def claim_batch(self, name, keys, ttl=3600, *, require_available=False):
+        """Validate committed claims without holding a database transaction.
+
+        Release new unpublished owners on caller failure. Start paid work only
+        after the entire validation scope exits successfully. Unpaid reservations
+        expire within ten minutes if compensation cannot reach the store.
+        """
+        lease_batch([], ttl)
+        claims = self.claim_many(name, keys, min(ttl, VALIDATION_LEASE_TTL), require_available=require_available)
+        try:
             yield claims
+        except BaseException:
+            try:
+                self.release_many(name, {key: claim['owner'] for key, claim in claims.items()
+                                         if claim['status'] == 'claimed'})
+            except (Unavailable, Contention):
+                logging.getLogger(__name__).warning('unpublished claim release deferred; store unavailable or contended')
+            raise
+
+    @retry_contention
+    def release_many(self, name, owners):
+        
```

**File**: `scripts/eval/search_campaign.py` (modified, +42/-4)
```diff
@@ -158,7 +158,7 @@ def perform(self, trial, value):
         self.store.renew_owner(self.name, self.owner)
         try:
             report = aggregate(self.measure(value['config']), self.spec['policy']['sets'])
-        except (control_store.LeaseLost, control_store.Unavailable, campaign_store.CleanupPending):
+        except (control_store.LeaseLost, control_store.Unavailable, control_store.Contention, campaign_store.CleanupPending):
             raise
         except Exception:
             report = aggregate({'status': 'failed'}, self.spec['policy']['sets'])
@@ -298,6 +298,8 @@ def poll():
                     return
                 store.renew_owner(name, owner)
                 next_check = time.monotonic() + 10
+            except control_store.Contention:
+                next_check = time.monotonic() + 10
             except Exception as error:
                 failures.append(type(error).__name__)
                 return
@@ -496,6 +498,34 @@ def public_status(store, name, study=None):
 
 def supervise(store, name, study, outbox, *, once=False, poll_seconds=15, stop_requested=None,
               confirmation_adapter=None):
+    previous_owner = None
+    def acquired(owner):
+        nonlocal previous_owner
+        previous_owner = owner
+    while True:
+        try:
+            try:
+                return _supervise(store, name, study, outbox, once=once, poll_seconds=poll_seconds,
+                                  stop_requested=stop_requested, confirmation_adapter=confirmation_adapter,
+                                  owner_acquired=acquired)
+            except control_store.LeaseBusy:
+                # Only our own failed release is recoverable. Refuse another
+                # live supervisor even after an earlier contention episode.
+                if previous_owner is None or store.snapshot(name)['owner'] != previous_owner:
+                    raise
+        except control_store.Contention:
+            pass
+        if once:
+            return retrying_status(name)
+        time.sleep(poll_seconds)
+
+
+def retrying_status(name):
+    return {'campaign': name, 'status': 'retrying', 'reason': 'control store contended; no new paid work admitted'}
+
+
+def _supervise(store, name, study, outbox, *, once=False, poll_seconds=15, stop_requested=None,
+               confirmation_adapter=None, owner_acquired=None):
     import campaign_store
     import campaign_compute
     compute = campaign_compute.ModalCompute()
@@ -522,6 +552,8 @@ def supervise(store, name, study, outbox, *, once=False, poll_seconds=15, stop_r
             time.sleep(poll_seconds)
             continue
         owner = store.acquire(name)
+        if owner_acquired:
+            owner_acquired(owner)
         try:
             loop = Loop(store, name, owner, study, campaign_compute.Measurement(store, name, owner, outbox, compute))
             with guard(store, name, owner, compute, stop_requested):
@@ -657,9 +689,12 @@ def main(argv=None):
             output = public_status(store, name)
         elif args.command == 'watchdog':
             while True:
-                watchdog_once(store, name, campaign_compute.ModalCompute())
-                output = public_status(store, name)
-                if args.once or output['stopped']:
+                try:
+                    watchdog_once(store, name, campaign_compute.ModalCompute())
+                    output = public_status(store, name)
+                except control_store.Contention:
+                    output = retrying_status(name)
+                if args.once or output.get('stopped'):
                     break
                 time.sleep(15)
         else:
@@ -690,6 +725,9 @@ def interrupted(*_):
         if args.command == 'digest' and args.send:
             return 0 if all(v['status'] == 'delivered' for v in output.values()) else 2
         return 0
+    except control_store.Contention:
+        print(results.encode(retrying_status(name)))
+        return 2
     except campaign_store.CleanupPending:
         print(results.encode({'status': 'cleanup_pending', 'reason': 'compute termination is not acknowledged; retry stop or watchdog'}))
         return 2
```

**File**: `scripts/eval/search_trial.py` (modified, +34/-28)
```diff
@@ -5,6 +5,7 @@
 """
 import collections
 import concurrent.futures
+import contextlib
 import copy
 import hashlib
 import json
@@ -207,26 +208,28 @@ def embed(texts, mode, client=hosted):
         wave_size = concurrency * control_store.LEASE_BATCH_SIZE
         for wave_start in range(0, len(unique), wave_size):
             wave = []
-            for start in range(wave_start, min(wave_start + wave_size, len(unique)), control_store.LEASE_BATCH_SIZE):
-                chunk = unique[start:start + control_store.LEASE_BATCH_SIZE]
-                if dataset['private']:
-                    pending = []
-                    for text in chunk:
-                        if (mode, text) in entries:
-                            cache_hits += 1
-                            continue
-                        pieces = (direct.split_documents([text], cfg['window_chars'], cfg['overlap_chars'])[0]
-                                  if mode == 'document' else [text])
-                        pending.append((text, pieces, None, None))
-                else:
-                    keyed = {'embedding/' + digest({'config': identity, 'mode': mode,
-                             'text_hash': hashlib.sha256(text.encode()).hexdigest()}): text for text in chunk}
-                    started = time.monotonic()
-                    pending = []
-                    try:
-                        # A cache validation failure also rolls back new claims in
-                        # this chunk. No paid work starts before the wave validates.
-                        with budget.store.claim_batch(budget.campaign, keyed, ttl=86400, require_available=True) as claims:
+            with contextlib.ExitStack() as validation:
+                for start in range(wave_start, min(wave_start + wave_size, len(unique)), control_store.LEASE_BATCH_SIZE):
+                    chunk = unique[start:start + control_store.LEASE_BATCH_SIZE]
+                    if dataset['private']:
+                        pending = []
+                        for text in chunk:
+                            if (mode, text) in entries:
+                                cache_hits += 1
+                                continue
+                            pieces = (direct.split_documents([text], cfg['window_chars'], cfg['overlap_chars'])[0]
+                                      if mode == 'document' else [text])
+                            pending.append((text, pieces, None, None))
+                    else:
+                        keyed = {'embedding/' + digest({'config': identity, 'mode': mode,
+                                 'text_hash': hashlib.sha256(text.encode()).hexdigest()}): text for text in chunk}
+                        started = time.monotonic()
+                        pending = []
+                        try:
+                            # Claims commit before volume I/O; validation failure
+                            # releases claims across the unstarted wave.
+                            claims = validation.enter_context(budget.store.claim_batch(
+                                budget.campaign, keyed, ttl=control_store.VALIDATION_LEASE_TTL, require_available=True))
                             for cache_key, text in keyed.items():
                                 claim = claims[cache_key]
                                 if claim['status'] == 'done':
@@ -242,18 +245,21 @@ def embed(texts, mode, client=hosted):
                                 else:
                                     pieces = direct.split_documents([text], cfg['window_chars'], cfg['overlap_chars'])[0] if mode == 'document' else [text]
                                     pending.append((text, pieces, cache_key, claim['owner']))
-                    except control_store.LeaseBusy:
-                        raise RuntimeError('embedding cache fill already leased; retry after completion') from None
-                    LOG.info('cache claims entries=%d elapsed_seconds=%.3f', len(keyed), time.monotonic() - started)
-                if pending:
-                    if not dataset['private']:
-                        budget.store.renew_many(budget.campaign, {k: o for _, _, k, o in pending}, ttl=86400)
-                    budget.store.renew(budget.campaign, *budget.lease)
-                    wave.append(pending)
+                        except control_store.LeaseBusy:
+                            raise RuntimeError('embedding cache fill already leased; retry after completion') from None
+                        LOG.info('cache claims entries=%d elapsed_seconds=%.3f', len(keyed), time.monotonic() - started)
+                    if pending:
+                        if not dataset['private']:
+                            budget.store.renew_many(budget.campaign, {k: o for _, _, k, o in pending}, ttl=control_store.VALIDATION_LEASE_TTL)
+                        budget.store.renew(budget.campaign, *budget.lease)
+                        wave.append(pending)
             if wave:
               
```

**File**: `scripts/eval/test_campaign_reporting.py` (modified, +18/-2)
```diff
@@ -97,6 +97,16 @@ def test_daily_digest_retries_only_unacknowledged_destination_and_exports_aggreg
         from unittest import mock
         import campaign_reporting as reporting
         import campaign_store
+        import psycopg
+        connect = psycopg.connect
+        blocker = connect(self.dsn)
+        waits = []
+        def timeout_connect(*args, **kwargs):
+            kwargs['options'] = '-c statement_timeout=10000 -c lock_timeout=25'
+            return connect(*args, **kwargs)
+        def backoff(delay):
+            waits.append(delay)
+            blocker.rollback()
         owner = self.store.acquire(self.name)
         report = {'status': 'exploration_finalist', 'verdict': 'better',
                   'gates': {k: {'passed': True} for k in ('quality', 'no_loss', 'latency', 'price')},
@@ -109,6 +119,7 @@ def test_daily_digest_retries_only_unacknowledged_destination_and_exports_aggreg
         self.store.reserve(self.name, 'provider', .25, lease=('digest-cost', lease['owner']))
         requests = []
         fail_slack = True
+        name = self.name
         class Response(io.BytesIO):
             def __enter__(self):
                 return self
@@ -126,9 +137,13 @@ def open(self, request, timeout):
                     return Response(b'{"ok":true,"ts":"123.4"}')
                 if 'commentCreate' not in body['query']:
                     return Response(b'{"data":{"comment":null}}')
+                # Contend only after the transport has acknowledged delivery.
+                blocker.execute('SELECT name FROM eval_control.campaigns WHERE name=%s FOR UPDATE', (name,))
                 return Response(json.dumps({'data': {'commentCreate': {'success': True, 'comment': {'id': body['variables']['input']['id']}}}}).encode())
-        with mock.patch.dict(os.environ, EVAL_LINEAR_TOKEN='fixture-linear', EVAL_SLACK_BOT_TOKEN='fixture-slack', EVAL_SLACK_CHANNEL='Cfixture'), \
-             mock.patch('urllib.request.build_opener', return_value=HTTP()):
+        with blocker, mock.patch.dict(os.environ, EVAL_LINEAR_TOKEN='fixture-linear', EVAL_SLACK_BOT_TOKEN='fixture-slack', EVAL_SLACK_CHANNEL='Cfixture'), \
+             mock.patch('urllib.request.build_opener', return_value=HTTP()), \
+             mock.patch('psycopg.connect', side_effect=timeout_connect), \
+             mock.patch('control_store.time.sleep', side_effect=backoff):
             first = reporting.digest(self.store, self.name)
             self.assertEqual(first['linear']['status'], 'delivered')
             self.assertEqual(first['slack']['status'], 'retry')
@@ -137,6 +152,7 @@ def open(self, request, timeout):
             self.assertEqual(second['slack']['status'], 'delivered')
             reporting.digest(restarted, self.name)
         self.assertEqual(len(requests), 4)
+        self.assertEqual(waits, [1])
         rendered = requests[1][1]['variables']['input']['body']
         self.assertIn('unknown', rendered)
         self.assertIn('0.25', rendered)
```

---

### Incident Patch 14: `881aaa44` (2026-10-05)
**Commit Message**: fix(eval): ship campaign trials to Modal by value (#3732)

A campaign imports modal_search instead of running it as a script, so
Modal pickled remote_trial by reference to a module the container cannot
import before the trial adds the evaluation directory to sys.path. Every
campaign container failed with DeserializationError and measured
nothing.

launch now ships remote_trial through shipped_trial(), which registers
the
module for by-value pickling with Modal's cloudpickle. The existing
serialization test uses the same helper on an imported module, which is
exactly the campaign path; a by-reference payload fails in an isolated
interpreter and the shipped payload loads.

Closes
https://linear.app/thevibecompany/issue/THE-1030/fix-campaign-trials-never-start-on-modal


Validation: evaluation tests pass locally (38 skipped without
PostgreSQL); `make denylist` and `make docs` pass. The live campaign
relaunch follows the merge.

🤖 Generated with [Claude Code](https://claude.com/claude-code)


<!-- This is an auto-generated description by cubic. -->
---
## Summary by cubic
Fixes campaign trials on Modal failing with `DeserializationError` so
they start and measure instead of doing noth

**File**: `scripts/eval/modal_search.py` (modified, +13/-1)
```diff
@@ -7,6 +7,7 @@
 import pathlib
 import re
 import subprocess
+import sys
 import time
 
 import control_store
@@ -276,6 +277,17 @@ def remote_trial(request):
                 **({'error': {'kind': kind, 'message': message}} if private else {})}
 
 
+def shipped_trial():
+    """remote_trial as Modal must ship it: by value, also when a campaign imports this module.
+
+    A by-reference payload names this module, which the container cannot import
+    before remote_trial adds the evaluation directory to sys.path.
+    """
+    from modal._vendor import cloudpickle
+    cloudpickle.register_pickle_by_value(sys.modules[__name__])
+    return remote_trial
+
+
 def launch(policy, candidate, campaign, outbox, fresh_latency, *, app_name='quivr-search-measurement',
            on_app=lambda identity: None, check=lambda: None):
     import modal
@@ -301,7 +313,7 @@ def ignored(path):
         retries=0, max_containers=4, scaledown_window=2, single_use_containers=True,
         include_source=False, serialized=True, secrets=secrets,
         volumes={'/eval-cache': modal.Volume.from_name('quivr-eval-embeddings-cache', create_if_missing=True),
-                 **{mount: modal.Volume.from_name(name) for mount, name in private_volumes.items()}})(remote_trial)
+                 **{mount: modal.Volume.from_name(name) for mount, name in private_volumes.items()}})(shipped_trial())
     store = control_store.Store(os.environ['EVAL_CONTROL_DATABASE_URL'])
     sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
     scorer_digest = 'sha256:' + search_trial.digest({name: (ROOT / 'scripts/eval' / name).read_text()
```

**File**: `scripts/eval/test_modal_search.py` (modified, +3/-4)
```diff
@@ -50,13 +50,12 @@ def test_dry_run_needs_no_keys_and_ci_or_holdout_refuses_before_dispatch(self):
 
 class RemoteSerialization(unittest.TestCase):
     def test_remote_trial_loads_before_evaluation_modules_are_importable(self):
-        # Modal pickles the launched script's functions and globals by value; the
-        # container adds the evaluation directory to sys.path only inside the call.
+        # The container adds the evaluation directory to sys.path only inside the
+        # call. Campaigns import this module, so launch must force a by-value payload.
         from modal._serialization import serialize
         from modal._vendor import cloudpickle
-        cloudpickle.register_pickle_by_value(modal_search)
         try:
-            payload = serialize(modal_search.remote_trial)
+            payload = serialize(modal_search.shipped_trial())
         finally:
             cloudpickle.unregister_pickle_by_value(modal_search)
         with tempfile.TemporaryDirectory() as temp:
```

---

### Incident Patch 15: `f247cb21` (2026-10-05)
**Commit Message**: fix(eval): isolate trial cost from hosted waits (#3731)

Hosted trial requests previously charged provider waiting time as local
compute, and private comparisons sampled each side in a separate pass.
This separates provider token spend from local
embedding/ranking/reranking work and prepares both private
configurations before alternating their warmups and identical query
samples. End-to-end latency gates and thresholds stay unchanged;
provider and local p50/p95 are reported separately.

Azure hosted 429 attempts settle at zero; unknown failures stay reserved
and successful responses still require confirmed usage. Shared document
admission halves after throttling and recovers slowly. Timing-versioned
cache entries prevent repricing old HTTP wall-time as local compute.
Actual Modal invocation accounting remains in the ledger. Public
standalone dispatch remains serial.

Validation: offline transport/clock regressions with real disposable
PostgreSQL and encrypted synthetic input cover settlement, concurrency
reduction/recovery, hosted embedding and Jev waits, local E5 work,
cached repricing, A/B drift and private aggregate publication. The
original fake-clock price was $0.01002008/sear

**File**: `docs/eval-modal.md` (modified, +17/-7)
```diff
@@ -119,6 +119,8 @@ Quality covers every query with relevance judgments using batched, cached embedd
 uses up to 50 serial queries, ordered by SHA-256 of the ID (ID breaks ties), after
 warming up the lexicographically first judged ID, which may also be timed.
 Both configurations use the same sample and resource class.
+Private comparisons prepare both indexes, then alternate baseline/candidate
+warmups and each sampled query (A/B/A/B). Public standalone runs remain serial.
 For public sets, `cost.latency_sample` records timed IDs, warmup ID and policy;
 `gates.latency.samples` echoes both and rejects missing or mismatched evidence.
 Private samples stay inside the runner; only
@@ -131,10 +133,17 @@ Price limits are $0.0005/search for `default`, $0.05/search for `deep`, and
 $10/1,000 original documents. Override `min_gain`, `latency_ratio`, `search_usd` or
 `index_usd` in `gates`. Serving includes query embedding, reranking and compute.
 Indexing covers all document windows, excluding quality-query preparation. Cached
-usage is repriced by input bounds and parallel wall time; campaign usage stays exact.
+usage is repriced by input bounds and local compute time; campaign usage stays exact.
+Serving compute excludes provider HTTP, retry and ledger waits. Actual invocation
+spend remains in the Modal ledger. `cost.search_provider_usd` and
+`cost.search_compute_usd` split the average search price; `cost.search_timing_ms`
+reports provider and local p50/p95 alongside the end-to-end latency metric.
+Timing-versioned cache entries prevent reuse of earlier wall-time attributions.
 
 Admission and planning share the UTF-8 byte-plus-eight-token bound at frozen prices.
-Confirmed responses release unused reservations; failed/unknown attempts stay reserved.
+Confirmed responses release unused reservations. This Azure hosted adapter settles
+429 rejections at zero; other failed/unknown attempts stay reserved. Successful
+responses without confirmed token usage are rejected and remain reserved.
 Usage above the bound is charged at its actual amount and stops the campaign.
 A daily cap hit stops that ledger for its UTC day, even after later settlements.
 Other campaigns have independent caps. Exact reported `agent_token_usage` contains
@@ -149,16 +158,17 @@ account charges need separate operator budgets. Bounds depend on correct rates
 and provider token limits; observed overages cannot undo already incurred bills.
 
 Tier 1 accepts public campaign-dev sets and private working descriptors. An upstream
-public `test` partition differs
-from campaign-heldout data, which tier 1 cannot consume. The store's maximum-ten confirmation counter
-is owned by the [trusted full-engine confirmation runner](eval-engine-confirmation.md).
+public `test` partition differs from campaign-heldout data, which tier 1 cannot consume.
+The [trusted full-engine confirmation runner](eval-engine-confirmation.md) owns the maximum-ten confirmation counter.
 
 ## Recover and validate
 
 The Volume `quivr-eval-embeddings-cache` holds immutable vectors and the outbox.
 Hosted document fills overlap at most four 128-entry cache chunks; each provider
-attempt reserves and settles independently. Local e5 and quality-query fills stay
-serial and batched. Claims and validation precede paid work; commits and fenced
+attempt reserves and settles independently. Hosted admission halves after 429s
+and recovers one slot after 16 times the current slot count in clean requests;
+requests already in flight drain at the old limit. Local e5 and quality-query
+fills stay serial and batched. Claims and validation precede paid work; commits and fenced
 publication stay serial. Failed waves drain attempts and retain uncertain charges.
 Chunks commit before publication; lost ownership rolls it back. Logs exclude texts.
 Reruns recover evidence and tracking writes. Keep the Volume and schema until
```

**File**: `scripts/eval/direct_bakeoff.py` (modified, +77/-6)
```diff
@@ -5,6 +5,7 @@
 input-token/USD budget; credentials are read only from the environment.
 """
 import argparse
+import contextlib
 import datetime
 import email.utils
 import http.client
@@ -18,6 +19,7 @@
 import re
 import random
 import time
+import threading
 import urllib.error
 import urllib.parse
 import urllib.request
@@ -120,6 +122,47 @@ def embed(self, texts, mode):
         return vectors
 
 
+class DocumentAdmission:
+    """Shared request admission: halve on throttling, recover one slot slowly."""
+    def __init__(self, maximum=4):
+        self.maximum = self.limit = maximum
+        self.active = self.clean = self.generation = 0
+        self.condition = threading.Condition()
+
+    @contextlib.contextmanager
+    def request(self):
+        with self.condition:
+            self.condition.wait_for(lambda: self.active < self.limit)
+            self.active += 1
+            generation = self.generation
+        try:
+            yield
+        except urllib.error.HTTPError as error:
+            with self.condition:
+                self.clean = 0
+                if error.code == 429:
+                    self.limit = max(1, self.limit // 2)
+                    self.generation += 1
+            raise
+        except BaseException:
+            with self.condition:
+                self.clean = 0
+            raise
+        else:
+            with self.condition:
+                # A success already in flight when throttling happened is
+                # not evidence that the reduced rate can safely grow.
+                if generation == self.generation:
+                    self.clean += 1
+                    if self.clean >= 16 * self.limit and self.limit < self.maximum:
+                        self.limit += 1
+                        self.clean = 0
+        finally:
+            with self.condition:
+                self.active -= 1
+                self.condition.notify_all()
+
+
 class Hosted:
     def __init__(self, endpoint, key, budget, set_name, prices=None):
         target = urllib.parse.urlsplit(endpoint)
@@ -130,17 +173,38 @@ def __init__(self, endpoint, key, budget, set_name, prices=None):
         self.budget, self.set_name = budget, set_name
         self.prices = PRICES if prices is None else prices
         self.opener = urllib.request.build_opener(embeddings.NoRedirect())
+        # Shallow task copies retain this limiter across all document batches.
+        self.documents = DocumentAdmission()
+        self.blocked_seconds = self.http_seconds = 0.
+
+    @contextlib.contextmanager
+    def blocked(self):
+        started = time.monotonic()
+        try:
+            yield
+        finally:
+            self.blocked_seconds += time.monotonic() - started
+
+    def read(self, request, mode):
+        admission = self.documents.request() if mode == 'document' else contextlib.nullcontext()
+        with self.blocked(), admission:
+            started = time.monotonic()
+            try:
+                with self.opener.open(request, timeout=120) as response:
+                    return response.read(embeddings.MAX_RESPONSE_BYTES + 1)
+            finally:
+                self.http_seconds += time.monotonic() - started
 
     def post(self, path, body, texts, label, model, mode):
         # The shared gate's supported byte/subword bound, including special tokens.
         tokens = embeddings.estimate_tokens(texts)
         for attempt in range(8):
-            call = self.budget.reserve(label, self.set_name, mode, tokens, self.prices[model])
+            with self.blocked():
+                call = self.budget.reserve(label, self.set_name, mode, tokens, self.prices[model])
             request = urllib.request.Request(self.endpoint + path, data=json.dumps(body).encode(),
                                              headers={'Content-Type': 'application/json', 'api-key': self.key}, method='POST')
             try:
-                with self.opener.open(request, timeout=120) as response:
-                    raw = response.read(embeddings.MAX_RESPONSE_BYTES + 1)
+                raw = self.read(request, mode)
                 if len(raw) > embeddings.MAX_RESPONSE_BYTES:
                     raise RuntimeError('provider response exceeds size limit')
                 try:
@@ -151,12 +215,18 @@ def post(self, path, body, texts, label, model, mode):
                     raise RuntimeError('invalid provider response') from None
                 if type(used) is not int or used < 0:
                     raise RuntimeError('provider omitted confirmed usage; measurement rejected')
-                self.budget.settle(call, used)
+                with self.blocked():
+                    self.budget.settle(call, used)
                 return result
             except urllib.error.HTTPError as error:
                 code = error.code
                 retry_after = error.headers.get('Retry-After', '')
                 error.close()
+                # This hosted adapter's rate-lim
```

**File**: `scripts/eval/private_working.py` (modified, +17/-10)
```diff
@@ -75,15 +75,19 @@ def trial(request, store):
         dataset = {'name': name, 'version': entry['version'], 'split': 'dev',
                    'fingerprint': entry['fingerprint'], 'private': True}
         pairs, rows, private_vectors = {}, {}, {}
-        for side, cfg in (('baseline', policy['baseline']), ('candidate', request['config'])):
+        configs = {'baseline': policy['baseline'], 'candidate': request['config']}
+        budgets, clients = {}, {}
+        for side, cfg in configs.items():
             store.renew(request['campaign'], *lease, ttl=policy['max_seconds'])
-            budget = control_store.Budget(store, request['campaign'], lease)
-            hosted = None if cfg['model'] == direct_bakeoff.E5_MODEL else direct_bakeoff.Hosted(
-                os.environ['AZURE_FOUNDRY_ENDPOINT'], os.environ['AZURE_FOUNDRY_KEY'], budget, name, policy['prices'])
-            started = time.monotonic()
-            measured = search_trial.measure(cfg, data, dataset, root / 'vectors', budget, hosted,
-                policy['prices'], float(policy['modal_usd_per_second']), request['fresh_latency'],
-                os.environ.get('TYPESAFE_API_KEY', ''), private_vectors=private_vectors)
+            budgets[side] = control_store.Budget(store, request['campaign'], lease)
+            clients[side] = None if cfg['model'] == direct_bakeoff.E5_MODEL else direct_bakeoff.Hosted(
+                os.environ['AZURE_FOUNDRY_ENDPOINT'], os.environ['AZURE_FOUNDRY_KEY'], budgets[side], name, policy['prices'])
+        started = time.monotonic()
+        measurements = search_trial.measure_pair(configs, data, dataset, root / 'vectors', budgets, clients,
+            policy['prices'], float(policy['modal_usd_per_second']), request['fresh_latency'],
+            os.environ.get('TYPESAFE_API_KEY', ''), private_vectors=private_vectors)
+        for side, cfg in configs.items():
+            measured = measurements[side]
             measured['duration_seconds'] = time.monotonic() - started
             measured['cost']['resource_class'] = 'cpu8-memory16384'
             full_cfg = {**cfg, 'paired_side': side, 'profile': policy['profile'], 'campaign': request['campaign'],
@@ -97,9 +101,12 @@ def trial(request, store):
             # Explicit output fields only: latency IDs, per-query scores and
             # arbitrary dependency metadata never become durable evidence.
             rows[side] = {**pairs[side], 'per_query': {}, 'cost': {
-                'provider': budget.summary(), 'resource_class': 'cpu8-memory16384',
+                'provider': budgets[side].summary(), 'resource_class': 'cpu8-memory16384',
                 'latency_method': measured['cost']['latency_method'],
-                'price_basis': measured['cost']['price_basis']}}
+                'price_basis': measured['cost']['price_basis'],
+                'search_timing_ms': measured['cost']['search_timing_ms'],
+                'search_provider_usd': measured['cost']['search_provider_usd'],
+                'search_compute_usd': measured['cost']['search_compute_usd']}}
         verdict = gates.evaluate({name: pairs}, {**policy, 'sets': {name: policy['sets'][name]}})
         if verdict['missing_or_incompatible_sets']:
             raise ValueError('incomplete private pairing')
```

**File**: `scripts/eval/search_trial.py` (modified, +107/-32)
```diff
@@ -121,24 +121,32 @@ def rank(self, query, query_vector=None, dense=None):
         return [self.doc_ids[i] for i in selected[:self.cfg['candidate_count']]]
 
 
-def rerank(query, passages, budget, key, price):
+def rerank(query, passages, budget, key, price, timing=None):
     """One bounded Jev attempt, no hidden retry/background transport."""
     sys.path.insert(0, str(ROOT / 'plugins/jev-rerank'))
     from jev_rerank import client as jev
     raw = json.dumps(jev.payload(query, passages), ensure_ascii=False, separators=(',', ':')).encode()
     if len(raw) > jev.MAX_BYTES:
         raise ValueError('reranker request exceeds its supported bound')
+    timing = {} if timing is None else timing
+    started = time.monotonic()
     call = budget.reserve(jev.MODEL, 'rerank', 'query', jev.MAX_TOKENS, price)
+    timing['blocked'] = time.monotonic() - started
     request = urllib.request.Request(jev.URL, data=raw, headers={'Content-Type': 'application/json',
                                      'Authorization': 'Bearer ' + key}, method='POST')
     try:
+        started = time.monotonic()
         with urllib.request.build_opener(embeddings.NoRedirect()).open(request, timeout=60) as response:
             answer = response.read(jev.MAX_RESPONSE_BYTES + 1)
+        timing['provider'] = time.monotonic() - started
+        timing['blocked'] += timing['provider']
         if len(answer) > jev.MAX_RESPONSE_BYTES:
             raise ValueError()
         body = json.loads(answer)
         tokens = body['usage']['input_tokens']
+        started = time.monotonic()
         budget.settle(call, tokens)
+        timing['blocked'] += time.monotonic() - started
         scores = {name: item['noul'] for name, item in body['answers'].items()}
         if (type(tokens) is not int or not 0 <= tokens <= jev.MAX_TOKENS or body['model'] != jev.MODEL
                 or set(scores) != set(passages) or any(type(v) not in (int, float) or not math.isfinite(v) or not 0 <= v <= 1 for v in scores.values())):
@@ -150,7 +158,7 @@ def rerank(query, passages, budget, key, price):
         raise RuntimeError('reranker attempt failed; uncertain charge retained') from None
 
 
-def measure(cfg, data, dataset, cache, budget, hosted, prices, compute_rate,
+def _measure(cfg, data, dataset, cache, budget, hosted, prices, compute_rate,
             fresh_latency=True, rerank_key='', flush=lambda: None, private_vectors=None):
     if dataset['split'] != 'dev':
         raise PermissionError('tier 1 accepts campaign-dev data only')
@@ -167,12 +175,18 @@ def measure(cfg, data, dataset, cache, budget, hosted, prices, compute_rate,
         cache.mkdir(parents=True, exist_ok=True)
     local = direct.E5()
     def embed(texts, mode, client=hosted):
+        started = time.monotonic()
         if cfg['model'] == direct.E5_MODEL:
-            return direct.normalize(local.embed(texts, mode)).tolist()
+            vectors = direct.normalize(local.embed(texts, mode)).tolist()
+            return vectors, time.monotonic() - started, 0
+        blocked, http = client.blocked_seconds, client.http_seconds
         vectors = client.embed(cfg['model'], texts, mode, dimensions=cfg['dimensions'])
-        return direct.normalize(vectors).tolist()
+        vectors = direct.normalize(vectors).tolist()
+        return (vectors, max(0, time.monotonic() - started - (client.blocked_seconds - blocked)),
+                client.http_seconds - http)
 
     identity = {k: cfg[k] for k in ('model', 'revision', 'dimensions', 'window_chars', 'overlap_chars')}
+    identity['timing'] = 'local-compute-v2'
     # The protected caller owns this map for one dataset invocation only.
     # No private text identities, vectors or cache keys cross a durable boundary.
     entries = (private_vectors.setdefault(tuple(identity.values()), {})
@@ -241,17 +255,16 @@ def embed(texts, mode, client=hosted):
                 def fill(item):
                     pending, task_budget = item
                     texts = [piece for _, pieces, _, _ in pending for piece in pieces]
-                    started = time.monotonic()
                     if cfg['model'] == direct.E5_MODEL:
-                        vectors = embed(texts, mode)
+                        vectors, compute_seconds, _ = embed(texts, mode)
                     else:
                         # Usage and unknown reservations belong to this task,
                         # never a delta of a concurrently changing global sum.
                         client = copy.copy(hosted)
                         client.budget = task_budget
-                        vectors = embed(texts, mode, client)
+                        vectors, compute_seconds, _ = embed(texts, mode, client)
                     usage = task_budget.summary()
-                    return vectors, usage['confirmed_input_tokens'] + usage['reserved_input_tokens'], time.monotonic() - started
+                    return vectors, usage['confirmed_input_tokens'] + usage['reserve
```

**File**: `scripts/eval/test_direct_bakeoff.py` (modified, +68/-2)
```diff
@@ -1,4 +1,6 @@
 """Offline owner contracts for the developer-local direct comparison."""
+import concurrent.futures
+import threading
 import importlib.util
 import email.utils
 import http.client
@@ -133,7 +135,7 @@ def respond(request, timeout):
 
     def test_retry_and_unknown_usage_cannot_escape_run_cap_or_leak_errors(self):
         client = bakeoff.Hosted('https://example.com', 'fixture-key', embeddings.Budget(20, 1), 'scifact')
-        error = urllib.error.HTTPError('https://example.com', 429, 'reflected secret', {}, io.BytesIO(b'sensitive body'))
+        error = urllib.error.HTTPError('https://example.com', 503, 'reflected secret', {}, io.BytesIO(b'sensitive body'))
         with mock.patch.object(client.opener, 'open', side_effect=error) as network, mock.patch.object(bakeoff.time, 'sleep'):
             with self.assertRaises(embeddings.BudgetExceeded):
                 client.embed('Cohere-Embed-V5-Pro', ['abc'], 'document')
@@ -161,6 +163,8 @@ def test_retry_after_jitter_and_exhaustion_use_bounded_safe_errors(self):
                         mock.patch('random.uniform', return_value=.5):
                     self.assertEqual(client.embed('Cohere-Embed-V5-Pro', ['a'], 'document', dimensions=2), [[1, 0]])
                 sleep.assert_called_once_with(expected)
+                self.assertEqual(client.budget.summary()['reserved_input_tokens'], 0 if code == 429 else 9)
+                self.assertEqual(client.budget.summary()['confirmed_input_tokens'], 1)
         for code in (429, 503, None):
             client = bakeoff.Hosted('https://example.com', 'fixture-key', embeddings.Budget(1000, 1), 'tiny')
             def fail(*args, **kwargs):
@@ -174,7 +178,69 @@ def fail(*args, **kwargs):
                     client.embed('Cohere-Embed-V5-Pro', ['a'], 'document', dimensions=2)
             self.assertEqual(network.call_count, 8)
             self.assertEqual(sleep.call_count, 7)
-            self.assertEqual(client.budget.summary()['reserved_input_tokens'], 72)
+            self.assertEqual(client.budget.summary()['reserved_input_tokens'], 0 if code == 429 else 72)
+
+    def test_document_admission_reduces_after_429_and_recovers_slowly(self):
+        # Own request-level pacing at the transport boundary. Blocking fake
+        # responses expose admission without wall-clock sleeps or polling.
+        client = bakeoff.Hosted('https://example.com', 'fixture-key', embeddings.Budget(10000, 1), 'tiny')
+        failure = urllib.error.HTTPError('https://example.com', 429, 'limited', {}, io.BytesIO())
+        def success(*args, **kwargs):
+            return io.BytesIO(b'{"embeddings":{"float":[[1,0]]},"meta":{"billed_units":{"input_tokens":1}}}')
+        with mock.patch.object(client.opener, 'open', side_effect=[failure, success()]), mock.patch.object(bakeoff.time, 'sleep'):
+            client.embed('Cohere-Embed-V5-Pro', ['a'], 'document', dimensions=2)
+        # After one rejection, only two of four workers may enter transport.
+        admitted, release, lock = threading.Event(), threading.Event(), threading.Lock()
+        active = maximum = entered = 0
+        def held(*args, **kwargs):
+            nonlocal active, maximum, entered
+            with lock:
+                active += 1
+                entered += 1
+                maximum = max(maximum, active)
+                if entered == 2:
+                    admitted.set()
+            if not release.wait(timeout=5):
+                raise AssertionError('test transport was not released')
+            with lock:
+                active -= 1
+            return success()
+        with mock.patch.object(client.opener, 'open', side_effect=held), concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
+            futures = [pool.submit(client.embed, 'Cohere-Embed-V5-Pro', ['a'], 'document', dimensions=2) for _ in range(4)]
+            try:
+                self.assertTrue(admitted.wait(timeout=5))
+                with lock:
+                    self.assertEqual(entered, 2)
+            finally:
+                release.set()
+            for future in futures:
+                self.assertEqual(future.result(), [[1, 0]])
+        self.assertLessEqual(maximum, 2)
+        # A brief clean stretch must not restore the original burst size.
+        with mock.patch.object(client.opener, 'open', side_effect=success):
+            for _ in range(40):
+                client.embed('Cohere-Embed-V5-Pro', ['a'], 'document', dimensions=2)
+        # Recovery becomes observable by admitting at least three held calls.
+        entered = active = maximum = 0
+        release.clear()
+        admitted.clear()
+        def recovered(*args, **kwargs):
+            nonlocal entered
+            with lock:
+                entered += 1
+                if entered == 3:
+                    admitted.set()
+            if not release.wait(timeout=5):
+                raise AssertionError('recovery transport was not released')
+            return succ
```

**File**: `scripts/eval/test_private_working.py` (modified, +36/-0)
```diff
@@ -162,6 +162,42 @@ def provider(request, timeout):
                              or 'secret-doc-' in line or 'secret-query-' in line for line in logs.output))
         self.assertFalse(any((path / 'vectors').exists() for path in self.ephemeral_paths))
 
+    def test_fresh_samples_alternate_sides_and_export_timing_components(self):
+        # Own paired scheduling at the encrypted runner boundary. Spy on real
+        # ranking only to label the configuration served by each fake request.
+        original_rank = search_trial.SearchIndex.rank
+        served = []
+        clock = [0.]
+        def rank(index, query, *args, **kwargs):
+            served.append((index.cfg['dense_weight'], query))
+            clock[0] += .02
+            return original_rank(index, query, *args, **kwargs)
+        def provider(request, timeout):
+            # Serial provider latency drifts across the invocation. Adjacent
+            # A/B requests see nearly the same drift rather than separate eras.
+            clock[0] += .1 + .001 * len(self.calls)
+            return self.provider(request, timeout)
+        with mock.patch.object(search_trial.SearchIndex, 'rank', rank), \
+                mock.patch.object(search_trial.time, 'monotonic', side_effect=lambda: clock[0]):
+            outcome = self.run_trial(provider=provider)
+        self.assertEqual(outcome['status'], 'complete')
+        # The quality passes precede 21 alternating fresh calls per side,
+        # including each side's identical first-query warmup.
+        fresh = served[40:]
+        self.assertEqual([weight for weight, _ in fresh], [1, .5] * 21)
+        self.assertTrue(all(a[1] == b[1] for a, b in zip(fresh[::2], fresh[1::2])))
+        for row in (outcome['record'], outcome['baseline_record']):
+            cost = row['cost']
+            self.assertEqual(cost['search_timing_ms']['samples'], 20)
+            self.assertGreaterEqual(cost['search_timing_ms']['provider_p95'], 0)
+            self.assertGreaterEqual(cost['search_timing_ms']['local_p95'], 0)
+            self.assertAlmostEqual(row['metrics']['cost_per_search_usd'],
+                cost['search_provider_usd'] + cost['search_compute_usd'])
+            self.assertNotIn('secret-query-', json.dumps(cost))
+        self.assertAlmostEqual(outcome['record']['cost']['search_timing_ms']['local_p95'], 20)
+        self.assertLess(outcome['record']['metrics']['latency_p95_ms'] /
+                        outcome['baseline_record']['metrics']['latency_p95_ms'], 1.02)
+
     def test_private_reuse_requires_full_embedding_identity_and_ends_with_invocation(self):
         for field, value in ((None, None), ('revision', 'fixture-v2'), ('dimensions', 3),
                 ('model', 'Cohere-Embed-V5-Pro'), ('window_chars', 1900), ('overlap_chars', 100)):
```

**File**: `scripts/eval/test_search_trial.py` (modified, +69/-9)
```diff
@@ -120,6 +120,63 @@ def test_admission_precedes_transport_and_only_valid_usage_and_scores_are_accept
 
 @unittest.skipUnless(os.environ.get('EVAL_CONTROL_TEST_DSN') and importlib.util.find_spec('ranx'), 'needs eval dependencies and disposable PostgreSQL')
 class Trial(unittest.TestCase):
+    def test_serving_compute_excludes_hosted_wait_and_cached_usage_reprices(self):
+        # Own unit price decomposition: fake time advances only at provider I/O
+        # and ranking. SQL admission, cache and scorer remain real.
+        data = {'corpus': {'a': {'text': 'apple'}}, 'queries': {'q': 'apple'}, 'qrels': {'q': {'a': 1}}}
+        store = control_store.Store(os.environ['EVAL_CONTROL_TEST_DSN'])
+        original_rank = search_trial.SearchIndex.rank
+        cases = (
+            ('hosted', 'none', .00002008, 10020, .00000008, 20, 10000, .00004008, .00008),
+            ('hosted', 'jev', .00002029, 20020, .00000029, 20, 20000, .00004029, .00008),
+            ('local', 'none', .00005, 50, 0, 50, 0, .0001, .06),
+        )
+        for private in (False, True):
+            for model, reranker, price, latency, provider_usd, local_ms, provider_ms, replay_price, index_price in cases:
+                with self.subTest(private=private, model=model, reranker=reranker), tempfile.TemporaryDirectory() as temp:
+                    cfg = search_trial.configuration({'reranker': reranker, **({
+                        'model': 'Cohere-Embed-V5-Fast', 'revision': 'fixture-v1', 'dimensions': 2} if model == 'hosted' else {})})
+                    campaign = uuid.uuid4().hex
+                    store.campaign(campaign, {'provider_daily_usd': 1, 'modal_daily_usd': 1})
+                    lease = store.claim(campaign, 'trial')
+                    budget = control_store.Budget(store, campaign, ('trial', lease['owner']))
+                    prices = {'Cohere-Embed-V5-Fast': .08, 'jev-1.13.0': .042}
+                    client = direct_bakeoff.Hosted('https://example.com', 'fixture-key', budget, 'tiny', prices)
+                    clock = [0.]
+                    def provider(request, timeout):
+                        clock[0] += 10
+                        if 'texts' not in json.loads(request.data):
+                            return io.BytesIO(b'{"model":"jev-1.13.0","usage":{"input_tokens":5},"answers":{"a":{"noul":1}}}')
+                        count = len(json.loads(request.data)['texts'])
+                        return io.BytesIO(json.dumps({'embeddings': {'float': [[1, 0]] * count},
+                            'meta': {'billed_units': {'input_tokens': count}}}).encode())
+                    def rank(index, *args, **kwargs):
+                        clock[0] += .02
+                        return original_rank(index, *args, **kwargs)
+                    def local_embed(encoder, texts, mode):
+                        clock[0] += .03
+                        return [[1] + [0] * 383 for _ in texts]
+                    vectors = {}
+                    with mock.patch.object(search_trial.time, 'monotonic', side_effect=lambda: clock[0]), \
+                            mock.patch('urllib.request.OpenerDirector.open', side_effect=provider) as network, \
+                            mock.patch.object(search_trial.SearchIndex, 'rank', rank), \
+                            mock.patch.object(direct_bakeoff.E5, 'embed', local_embed):
+                        measured = search_trial.measure(cfg, data, {'split': 'dev', 'private': private}, temp,
+                            budget, client, prices, .001, rerank_key='fixture-key', private_vectors=vectors)
+                        self.assertAlmostEqual(measured['metrics']['cost_per_search_usd'], price, delta=1e-12)
+                        self.assertAlmostEqual(measured['metrics']['latency_p95_ms'], latency)
+                        self.assertAlmostEqual(measured['cost']['search_provider_usd'], provider_usd, delta=1e-12)
+                        self.assertAlmostEqual(measured['cost']['search_compute_usd'], price - provider_usd, delta=1e-12)
+                        self.assertAlmostEqual(measured['cost']['search_timing_ms']['provider_p95'], provider_ms)
+                        self.assertAlmostEqual(measured['cost']['search_timing_ms']['local_p95'], local_ms)
+                        before = network.call_count
+                        replay = search_trial.measure(cfg, data, {'split': 'dev', 'private': private}, temp,
+                            budget, client, prices, .002, fresh_latency=False, rerank_key='fixture-key', private_vectors=vectors)
+                        self.assertEqual(network.call_count, before + (reranker == 'jev'))
+                        self.assertAlmostEqual(replay['metrics']['cost_per_search_usd'], replay_price, delta=1e-12)
+                        self.assertAlmostEqual(replay['metrics']['cost_per_1000_documents_usd'], index_price, delta=1e-12)
+
+
     def test_concurrent_retries_complete_with_uncertain_spend(self):
         # Own retry 
```

#### Recent Merged Pull Requests:
- **PR #3764** (2026-10-06): perf(ingestion): reduce burst indexing and alert latency (@StanGirard)
- **PR #3763** (2026-10-06): fix(eval): overlap campaign quality and isolate latency (@StanGirard)
- **PR #3762** (2026-10-05): test(eval): consolidate evaluation contract owners (@StanGirard)
- **PR #3761** (2026-10-05): test(api): consolidate duplicate API and acceptance coverage (@StanGirard)
- **PR #3760** (2026-10-05): test(sdks): share plugin request signing conformance (@StanGirard)
- **PR #3759** (2026-10-06): test(demo): hold the web demo tests to their budget without fixed waits (@StanGirard)
- **PR #3758** (2026-10-05): feat(observability): trace requests end to end with OpenTelemetry (@StanGirard)
- **PR #3757** (2026-10-06): test: replace clock waits with causal completion signals (@StanGirard)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

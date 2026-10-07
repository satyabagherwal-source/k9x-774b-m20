# Forensic Learning Record (Deep Inspection): prometheus/prometheus

> **Canonical Artifact**: `07_PROJECT_LEARNING/prometheus-prometheus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/prometheus/prometheus](https://github.com/prometheus/prometheus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:19:47.608Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `prometheus/prometheus`
- **Description**: The Prometheus monitoring system and time series database.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 66413 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `discovery/util.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package discovery

import (
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
)

// MetricRegisterer is used by implementations of discovery.Discoverer that need
// to manage the lifetime of their metrics.
type MetricRegisterer interface {
	RegisterMetrics() error
	UnregisterMetrics()
}

// metricRegistererImpl is an implementation of MetricRegisterer.
type metricRegistererImpl struct {
	reg     prometheus.Registerer
	metrics []prometheus.Collector
}

var _ MetricRegisterer = &metricRegistererImpl{}

// NewMetricRegisterer creates an instance of a MetricRegisterer.
// Typically called inside the implementation of the NewDiscoverer() method.
func NewMetricRegisterer(reg prometheus.Registerer, metrics []prometheus.Collector) MetricRegisterer {
	return &metricRegistererImpl{
		reg:     reg,
		metrics: metrics,
	}
}

// RegisterMetrics registers the metrics with a Prometheus registerer.
// If any metric fails to register, it will unregister all metrics that
// were registered so far, and return an error.
// Typically called at the start of the SD's Run() method.
func (rh *metricRegistererImpl) RegisterMetrics() error {
	for _, collector := range rh.metrics {
		err := rh.reg.Register(collector)
		if err != nil {
			// Unregister all metrics that were registered so far.
			// This is so that if RegisterMetrics() gets called again,
			// there will not be an error due to a duplicate registration.
			rh.UnregisterMetrics()

			return fmt.Errorf("failed to register metric: %w", err)
		}
	}
	return nil
}

// UnregisterMetrics unregisters the metrics from the same Prometheus
// registerer which was used to register them.
// Typically called at the end of the SD's Run() method by a defer statement.
func (rh *metricRegistererImpl) UnregisterMetrics() {
	for _, collector := range rh.metrics {
		rh.reg.Unregister(collector)
	}
}

```

### Core Architecture Module: `notifier/sendloop.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/prometheus/config"
)

type sendLoop struct {
	alertmanagerURL string

	cfg    *config.AlertmanagerConfig
	client *http.Client
	opts   *Options

	metrics *alertMetrics

	mtx      sync.RWMutex
	queue    []*Alert
	hasWork  chan struct{}
	stopped  chan struct{}
	stopOnce sync.Once

	logger *slog.Logger
}

func newSendLoop(
	alertmanagerURL string,
	client *http.Client,
	cfg *config.AlertmanagerConfig,
	opts *Options,
	logger *slog.Logger,
	metrics *alertMetrics,
) *sendLoop {
	// This will initialize the Counters for the AM to 0 and set the static queue capacity gauge.
	metrics.dropped.WithLabelValues(alertmanagerURL)
	metrics.errors.WithLabelValues(alertmanagerURL)
	metrics.sent.WithLabelValues(alertmanagerURL)
	metrics.queueLength.WithLabelValues(alertmanagerURL)

	return &sendLoop{
		alertmanagerURL: alertmanagerURL,
		client:          client,
		cfg:             cfg,
		opts:            opts,
		logger:          logger,
		metrics:         metrics,
		queue:           make([]*Alert, 0, opts.QueueCapacity),
		hasWork:         make(chan struct{}, 1),
		stopped:         make(chan struct{}),
	}
}

func (s *sendLoop) add(alerts ...*Alert) {
	select {
	case <-s.stopped:
		return
	default:
	}

	s.mtx.Lock()
	defer s.mtx.Unlock()

	var dropped int
	// Queue capacity should be significantly larger than a single alert
	// batch could be.
	if d := len(alerts) - s.opts.QueueCapacity; d > 0 {
		s.logger.Warn("Alert batch larger than queue capacity, dropping alerts", "count", d)
		dropped += d
		alerts = alerts[d:]
	}

	// If the queue is full, remove the oldest alerts in favor
	// of newer ones.
	if d := (len(s.queue) + len(alerts)) - s.opts.QueueCapacity; d > 0 {
		s.logger.Warn("Alert notification queue full, dropping alerts", "count", d)
		dropped += d
		s.queue = s.queue[d:]
	}

	s.queue = append(s.queue, alerts...)

	// Notify sending goroutine that there are alerts to be processed.
	// If we cannot send on the channel, it means the signal already exists
	// and has not been consumed yet.
	s.notifyWork()

	s.metrics.queueLength.WithLabelValues(s.alertmanagerURL).Set(float64(len(s.queue)))
	if dropped > 0 {
		s.metrics.dropped.WithLabelValues(s.alertmanagerURL).Add(float64(dropped))
	}
}

func (s *sendLoop) notifyWork() {
	select {
	case <-s.stopped:
		return
	case s.hasWork <- struct{}{}:
	default:
	}
}

func (s *sendLoop) stop() {
	s.stopOnce.Do(func() {
		s.logger.Debug("Stopping send loop")
		close(s.stopped)

		if s.opts.DrainOnShutdown {
			s.drainQueue()
		} else {
			ql := s.queueLen()
			s.logger.Warn("Alert notification queue not drained on shutdown, dropping alerts", "count", ql)
			s.metrics.dropped.WithLabelValues(s.alertmanagerURL).Add(float64(ql))
		}

		s.metrics.latencySummary.DeleteLabelValues(s.alertmanagerURL)
		s.metrics.latencyHistogram.DeleteLabelValues(s.alertmanagerURL)
		s.metrics.sent.DeleteLabelValues(s.alertmanagerURL)
		s.metrics.dropped.DeleteLabelValues(s.alertmanagerURL)
		s.metrics.errors.DeleteLabelValues(s.alertmanagerURL)
		s.metrics.queueLength.DeleteLabelValues(s.alertmanagerURL)
	})
}

func (s *sendLoop) drainQueue() {
	for s.queueLen() > 0 {
		s.sendOneBatch()
	}
}

func (s *sendLoop) queueLen() int {
	s.mtx.RLock()
	defer s.mtx.RUnlock()

	return len(s.queue)
}

func (s *sendLoop) nextBatch() []*Alert {
	s.mtx.Lock()
	defer s.mtx.Unlock()

	var alerts []*Alert
	if maxBatchSize := s.opts.MaxBatchSize; len(s.queue) > maxBatchSize {
		alerts = append(make([]*Alert, 0, maxBatchSize), s.queue[:maxBatchSize]...)
		s.queue = s.queue[maxBatchSize:]
	} else {
		alerts = append(make([]*Alert, 0, len(s.queue)), s.queue...)
		s.queue = s.queue[:0]
	}
	s.metrics.queueLength.WithLabelValues(s.alertmanagerURL).Set(float64(len(s.queue)))

	return alerts
}

func (s *sendLoop) sendOneBatch() {
	alerts := s.nextBatch()

	if !s.sendAll(alerts) {
		s.metrics.dropped.WithLabelValues(s.alertmanagerURL).Add(float64(len(alerts)))
	}
}

// loop continuously consumes the notifications queue and sends alerts to
// the Alertmanager.
func (s *sendLoop) loop() {
	s.logger.Debug("Starting send loop")
	for {
		// If we've been asked to stop, that takes priority over sending any further notifications.
		select {
		case <-s.stopped:
			return
		default:
			select {
			case <-s.stopped:
				return
			case <-s.hasWork:
				s.sendOneBatch()

				// If the queue still has items left, kick off the next iteration.
				if s.queueLen() > 0 {
					s.notifyWork()
				}
			}
		}
	}
}

func (s *sendLoop) sendAll(alerts []*Alert) bool {
	if len(alerts) == 0 {
		return true
	}

	begin := time.Now()

	var payload []byte
	var err error
	switch s.cfg.APIVersion {
	case config.AlertmanagerAPIVersionV2:
		openAPIAlerts := alertsToOpenAPIAlerts(alerts)
		payload, err = json.Marshal(openAPIAlerts)
		if err != nil {
			s.logger.Error("Encoding alerts for Alertmanager API v2 failed", "err", err)
			return false
		}

	default:
		s.logger.Error(
			fmt.Sprintf("Invalid Alertmanager API version '%v', expected one of '%v'", s.cfg.APIVersion, config.SupportedAlertmanagerAPIVersions),
			"err", err,
		)
		return false
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(s.cfg.Timeout))
	defer cancel()

	if err := s.sendOne(ctx, s.client, s.alertmanagerURL, payload); err != nil {
		s.logger.Error("Error sending alerts", "count", len(alerts), "err", err)
		s.metrics.errors.WithLabelValues(s.alertmanagerURL).Add(float64(len(alerts)))
		return false
	}
	durationSeconds := time.Since(begin).Seconds()
	s.metrics.latencySummary.WithLabelValues(s.alertmanagerURL).Observe(durationSeconds)
	s.metrics.latencyHistogram.WithLabelValues(s.alertmanagerURL).Observe(durationSeconds)
	s.metrics.sent.WithLabelValues(s.alertmanagerURL).Add(float64(len(alerts)))

	return true
}

func (s *sendLoop) sendOne(ctx context.Context, c *http.Client, url string, b []byte) error {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Content-Type", contentTypeJSON)
	resp, err := s.opts.Do(ctx, c, req)
	if err != nil {
		return err
	}
	defer func() {
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}()

	// Any HTTP status 2xx is OK.
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("bad response status %s", resp.Status)
	}

	return nil
}

```

### Core Architecture Module: `notifier/util.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package notifier

import (
	"github.com/go-openapi/strfmt"
	"github.com/prometheus/alertmanager/api/v2/models"

	"github.com/prometheus/prometheus/model/labels"
)

func alertsToOpenAPIAlerts(alerts []*Alert) models.PostableAlerts {
	openAPIAlerts := models.PostableAlerts{}
	for _, a := range alerts {
		start := strfmt.DateTime(a.StartsAt)
		end := strfmt.DateTime(a.EndsAt)
		openAPIAlerts = append(openAPIAlerts, &models.PostableAlert{
			Annotations: labelsToOpenAPILabelSet(a.Annotations),
			EndsAt:      end,
			StartsAt:    start,
			Alert: models.Alert{
				GeneratorURL: strfmt.URI(a.GeneratorURL),
				Labels:       labelsToOpenAPILabelSet(a.Labels),
			},
		})
	}

	return openAPIAlerts
}

func labelsToOpenAPILabelSet(modelLabelSet labels.Labels) models.LabelSet {
	apiLabelSet := models.LabelSet{}
	modelLabelSet.Range(func(label labels.Label) {
		apiLabelSet[label.Name] = label.Value
	})

	return apiLabelSet
}

```

### Core Architecture Module: `promql/engine.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package promql

import (
	"bytes"
	"container/heap"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"math"
	"reflect"
	"runtime"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/prometheus/common/promslog"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/timestamp"
	"github.com/prometheus/prometheus/model/value"
	"github.com/prometheus/prometheus/promql/parser"
	"github.com/prometheus/prometheus/promql/parser/posrange"
	"github.com/prometheus/prometheus/schema"
	"github.com/prometheus/prometheus/storage"
	"github.com/prometheus/prometheus/tsdb/chunkenc"
	"github.com/prometheus/prometheus/util/annotations"
	"github.com/prometheus/prometheus/util/features"
	"github.com/prometheus/prometheus/util/kahansum"
	"github.com/prometheus/prometheus/util/logging"
	"github.com/prometheus/prometheus/util/stats"
	"github.com/prometheus/prometheus/util/zeropool"
)

const (
	namespace            = "prometheus"
	subsystem            = "engine"
	queryTag             = "query"
	env                  = "query execution"
	defaultLookbackDelta = 5 * time.Minute

	// The largest SampleValue that can be converted to an int64 without overflow.
	maxInt64 = 9223372036854774784
	// The smallest SampleValue that can be converted to an int64 without underflow.
	minInt64 = -9223372036854775808

	// Max initial size for the pooled points slices.
	// The getHPointSlice and getFPointSlice functions are called with an estimated size which often can be
	// over-estimated.
	maxPointsSliceSize = 5000

	// The default buffer size for points used by the matrix selector.
	matrixSelectorSliceSize = 16
)

type engineMetrics struct {
	currentQueries            prometheus.Gauge
	maxConcurrentQueries      prometheus.Gauge
	queryLogEnabled           prometheus.Gauge
	queryLogFailures          prometheus.Counter
	queryQueueTime            prometheus.Observer
	queryQueueTimeHistogram   prometheus.Observer
	queryPrepareTime          prometheus.Observer
	queryPrepareTimeHistogram prometheus.Observer
	queryInnerEval            prometheus.Observer
	queryInnerEvalHistogram   prometheus.Observer
	queryResultSort           prometheus.Observer
	queryResultSortHistogram  prometheus.Observer
	querySamples              prometheus.Counter
	querySamplesRead          prometheus.Counter
}

type (
	// ErrQueryTimeout is returned if a query timed out during processing.
	ErrQueryTimeout string
	// ErrQueryCanceled is returned if a query was canceled during processing.
	ErrQueryCanceled string
	// ErrTooManySamples is returned if a query would load more than the maximum allowed samples into memory.
	ErrTooManySamples string
	// ErrStorage is returned if an error was encountered in the storage layer
	// during query handling.
	ErrStorage struct{ Err error }
)

func (e ErrQueryTimeout) Error() string {
	return fmt.Sprintf("query timed out in %s", string(e))
}

func (e ErrQueryCanceled) Error() string {
	return fmt.Sprintf("query was canceled in %s", string(e))
}

func (e ErrTooManySamples) Error() string {
	return fmt.Sprintf("query processing would load too many samples into memory in %s", string(e))
}

func (e ErrStorage) Error() string {
	return e.Err.Error()
}

// QueryEngine defines the interface for the *promql.Engine, so it can be replaced, wrapped or mocked.
type QueryEngine interface {
	NewInstantQuery(ctx context.Context, q storage.Queryable, opts QueryOpts, qs string, ts time.Time) (Query, error)
	NewRangeQuery(ctx context.Context, q storage.Queryable, opts QueryOpts, qs string, start, end time.Time, interval time.Duration) (Query, error)
}

var _ QueryLogger = (*logging.JSONFileLogger)(nil)

// QueryLogger is an interface that can be used to log all the queries logged
// by the engine.
// logging.JSONFileLogger implements this interface, downstream users may use
// different implementations.
type QueryLogger interface {
	slog.Handler
	io.Closer
}

// A Query is derived from a raw query string and can be run against an engine
// it is associated with.
type Query interface {
	// Exec processes the query. Can only be called once.
	Exec(ctx context.Context) *Result
	// Close recovers memory used by the query result.
	Close()
	// Statement returns the parsed statement of the query.
	Statement() parser.Statement
	// Stats returns statistics about the lifetime of the query.
	Stats() *stats.Statistics
	// Cancel signals that a running query execution should be aborted.
	Cancel()
	// String returns the original query string.
	String() string
}

type PrometheusQueryOpts struct {
	// Enables recording per-step statistics if the engine has it enabled as well. Disabled by default.
	enablePerStepStats bool
	// Lookback delta duration for this query.
	lookbackDelta time.Duration
	// Enables start timestamp usage in functions such as rate().
	useStartTimestamps *bool
}

var _ QueryOpts = &PrometheusQueryOpts{}

func NewPrometheusQueryOpts(enablePerStepStats bool, lookbackDelta time.Duration, useStartTimestamps *bool) QueryOpts {
	var useStartTimestampsCopy *bool
	if useStartTimestamps != nil {
		val := *useStartTimestamps
		useStartTimestampsCopy = &val
	}
	return &PrometheusQueryOpts{
		enablePerStepStats: enablePerStepStats,
		lookbackDelta:      lookbackDelta,
		useStartTimestamps: useStartTimestampsCopy,
	}
}

func (p *PrometheusQueryOpts) EnablePerStepStats() bool {
	return p.enablePerStepStats
}

func (p *PrometheusQueryOpts) LookbackDelta() time.Duration {
	return p.lookbackDelta
}

func (p *PrometheusQueryOpts) UseStartTimestamps() *bool {
	return p.useStartTimestamps
}

type QueryOpts interface {
	// Enables recording per-step statistics if the engine has it enabled as well. Disabled by default.
	EnablePerStepStats() bool
	// Lookback delta duration for this query.
	LookbackDelta() time.Duration
	// Enables start timestamp usage in functions such as rate().
	UseStartTimestamps() *bool
}

// query implements the Query interface.
type query struct {
	// Underlying data provider.
	queryable storage.Queryable
	// The original query string.
	q string
	// Statement of the parsed query.
	stmt parser.Statement
	// Timer stats for the query execution.
	stats *stats.QueryTimers
	// Sample stats for the query execution.
	sampleStats *stats.QuerySamples
	// Result matrix for reuse.
	matrix Matrix
	// Cancellation function for the query.
	cancel func()

	// The engine against which the query is executed.
	ng *Engine

	// useStartTimestamps enables start timestamp usage in functions such as rate().
	useStartTimestamps bool
}

type QueryOrigin struct{}

// Statement implements the Query interface.
// Calling this after Exec may result in panic,
// see https://github.com/prometheus/prometheus/issues/8949.
func (q *query) Statement() parser.Statement {
	return q.stmt
}

// String implements the Query interface.
func (q *query) String() string {
	return q.q
}

// Stats implements the Query interface.
func (q *query) Stats() *stats.Statistics {
	return &stats.Statistics{
		Timers:  q.stats,
		Samples: q.sampleStats,
	}
}

// Cancel implements the Query interface.
func (q *query) Cancel() {
	if q.cancel != nil {
		q.cancel()
	}
}

// Close implements the Query interface.
func (q *query) Close() {
	for _, s := range q.matrix {
		putFPointSlice(s.Floats)
		putHPointSlice(s.Histograms)
	}
}

// Exec implements the Query interface.
func (q *query) Exec(ctx context.Context) *Result {
	if span := trace.SpanFromContext(ctx); span != nil {
		span.SetAttributes(attribute.String(queryTag, q.stmt.String()))
	}

	// Exec query.
	res, warnings, err := q.ng.exec(ctx, q)
	return &Result{Err: err, Value: res, Warnings: warnings}
}

// contextDone returns an error if the context was canceled or timed out.
func contextDone(ctx context.Context, env string) error {
	if err := ctx.Err(); err != nil {
		return contextErr(err, env)
	}
	return nil
}

func contextErr(err error, env string) error {
	switch {
	case errors.Is(err, context.Canceled):
		return ErrQueryCanceled(env)
	case errors.Is(err, context.DeadlineExceeded):
		return ErrQueryTimeout(env)
	default:
		return err
	}
}

// QueryTracker provides access to two features:
//
// 1) Tracking of active query. If PromQL engine crashes while executing any query, such query should be present
// in the tracker on restart, hence logged. After the logging on restart, the tracker gets emptied.
//
// 2) Enforcement of the maximum number of concurrent queries.
type QueryTracker interface {
	io.Closer

	// GetMaxConcurrent returns maximum number of concurrent queries that are allowed by this tracker.
	GetMaxConcurrent() int

	// Insert inserts query into query tracker. This call must block if maximum number of queries is already running.
	// If Insert doesn't return error then returned integer value should be used in subsequent Delete call.
	// Insert should return error if context is finished before query can proceed, and integer value returned in this case should be ignored by caller.
	Insert(ctx context.Context, query string) (int, error)

	// Delete removes query from activity tracker. InsertIndex is value returned by Insert call.
	Delete(insertIndex int)

```

### Core Architecture Module: `storage/remote/queue_manager.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package remote

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/gogo/protobuf/proto"
	remoteapi "github.com/prometheus/client_golang/exp/api/remote"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/prometheus/common/promslog"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/atomic"

	"github.com/prometheus/prometheus/config"
	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/metadata"
	"github.com/prometheus/prometheus/model/relabel"
	"github.com/prometheus/prometheus/model/timestamp"
	"github.com/prometheus/prometheus/prompb"
	writev2 "github.com/prometheus/prometheus/prompb/io/prometheus/write/v2"
	"github.com/prometheus/prometheus/schema"
	"github.com/prometheus/prometheus/scrape"
	"github.com/prometheus/prometheus/tsdb/chunks"
	"github.com/prometheus/prometheus/tsdb/record"
	"github.com/prometheus/prometheus/tsdb/wlog"
	"github.com/prometheus/prometheus/util/compression"
)

const (
	// We track samples in/out and how long pushes take using an Exponentially
	// Weighted Moving Average.
	ewmaWeight          = 0.2
	shardUpdateDuration = 10 * time.Second

	// Allow 30% too many shards before scaling down.
	shardToleranceFraction = 0.3

	reasonTooOld                     = "too_old"
	reasonDroppedSeries              = "dropped_series"
	reasonUnintentionalDroppedSeries = "unintentionally_dropped_series"
	reasonNHCBNotSupported           = "nhcb_in_rw1_not_supported"
)

type queueManagerMetrics struct {
	reg prometheus.Registerer

	samplesTotal           prometheus.Counter
	exemplarsTotal         prometheus.Counter
	histogramsTotal        prometheus.Counter
	metadataTotal          prometheus.Counter
	failedSamplesTotal     prometheus.Counter
	failedExemplarsTotal   prometheus.Counter
	failedHistogramsTotal  prometheus.Counter
	failedMetadataTotal    prometheus.Counter
	retriedSamplesTotal    prometheus.Counter
	retriedExemplarsTotal  prometheus.Counter
	retriedHistogramsTotal prometheus.Counter
	retriedMetadataTotal   prometheus.Counter
	droppedSamplesTotal    *prometheus.CounterVec
	droppedExemplarsTotal  *prometheus.CounterVec
	droppedHistogramsTotal *prometheus.CounterVec
	enqueueRetriesTotal    prometheus.Counter
	sentBatchDuration      prometheus.Histogram
	highestTimestamp       *maxTimestamp
	highestSentTimestamp   *maxTimestamp
	pendingSamples         prometheus.Gauge
	pendingExemplars       prometheus.Gauge
	pendingHistograms      prometheus.Gauge
	shardCapacity          prometheus.Gauge
	numShards              prometheus.Gauge
	maxNumShards           prometheus.Gauge
	minNumShards           prometheus.Gauge
	desiredNumShards       prometheus.Gauge
	sentBytesTotal         prometheus.Counter
	metadataBytesTotal     prometheus.Counter
	maxSamplesPerSend      prometheus.Gauge
}

func newQueueManagerMetrics(r prometheus.Registerer, rn, e string) *queueManagerMetrics {
	m := &queueManagerMetrics{
		reg: r,
	}
	constLabels := prometheus.Labels{
		remoteName: rn,
		endpoint:   e,
	}

	m.samplesTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "samples_total",
		Help:        "Total number of samples sent to remote storage.",
		ConstLabels: constLabels,
	})
	m.exemplarsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "exemplars_total",
		Help:        "Total number of exemplars sent to remote storage.",
		ConstLabels: constLabels,
	})
	m.histogramsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "histograms_total",
		Help:        "Total number of histograms sent to remote storage.",
		ConstLabels: constLabels,
	})
	m.metadataTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "metadata_total",
		Help:        "Total number of metadata entries sent to remote storage.",
		ConstLabels: constLabels,
	})
	m.failedSamplesTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "samples_failed_total",
		Help:        "Total number of samples which failed on send to remote storage, non-recoverable errors.",
		ConstLabels: constLabels,
	})
	m.failedExemplarsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "exemplars_failed_total",
		Help:        "Total number of exemplars which failed on send to remote storage, non-recoverable errors.",
		ConstLabels: constLabels,
	})
	m.failedHistogramsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "histograms_failed_total",
		Help:        "Total number of histograms which failed on send to remote storage, non-recoverable errors.",
		ConstLabels: constLabels,
	})
	m.failedMetadataTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "metadata_failed_total",
		Help:        "Total number of metadata entries which failed on send to remote storage, non-recoverable errors.",
		ConstLabels: constLabels,
	})
	m.retriedSamplesTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "samples_retried_total",
		Help:        "Total number of samples which failed on send to remote storage but were retried because the send error was recoverable.",
		ConstLabels: constLabels,
	})
	m.retriedExemplarsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "exemplars_retried_total",
		Help:        "Total number of exemplars which failed on send to remote storage but were retried because the send error was recoverable.",
		ConstLabels: constLabels,
	})
	m.retriedHistogramsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "histograms_retried_total",
		Help:        "Total number of histograms which failed on send to remote storage but were retried because the send error was recoverable.",
		ConstLabels: constLabels,
	})
	m.retriedMetadataTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "metadata_retried_total",
		Help:        "Total number of metadata entries which failed on send to remote storage but were retried because the send error was recoverable.",
		ConstLabels: constLabels,
	})
	m.droppedSamplesTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "samples_dropped_total",
		Help:        "Total number of samples which were dropped after being read from the WAL before being sent via remote write, either via relabelling, due to being too old or unintentionally because of an unknown reference ID.",
		ConstLabels: constLabels,
	}, []string{"reason"})
	m.droppedExemplarsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "exemplars_dropped_total",
		Help:        "Total number of exemplars which were dropped after being read from the WAL before being sent via remote write, either via relabelling, due to being too old or unintentionally because of an unknown reference ID.",
		ConstLabels: constLabels,
	}, []string{"reason"})
	m.droppedHistogramsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "histograms_dropped_total",
		Help:        "Total number of histograms which were dropped after being read from the WAL before being sent via remote write, either via relabelling, due to being too old or unintentionally because of an unknown reference ID.",
		ConstLabels: constLabels,
	}, []string{"reason"})
	m.enqueueRetriesTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "enqueue_retries_total",
		Help:        "Total number of times enqueue has failed because a shards queue was full.",
		ConstLabels: constLabels,
	})
	m.sentBatchDuration = prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace:                       namespace,
		Subsystem:                       subsystem,
		Name:                            "sent_batch_duration_seconds",
		Help:                            "Duration of send calls to the remote storage.",
		Buckets:                         append(prometheus.DefBuckets, 25, 60, 120, 300),
		ConstLabels:                     constLabels,
		NativeHistogramBucketFactor:     1.1,
		NativeHistogramMaxBucketNumber:  100,
		NativeHistogramMinResetDuration: 1 * time.Hour,
	})
	m.highestTimestamp = &maxTimestamp{
		Gauge: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace:   namespace,
			Subsystem:   subsystem,
			Name:        "queue_highest_timestamp_seconds",
			Help:        "Highest timestamp that was enqueued, in seconds since epoch. Initialized to 0 when no data has been received yet.",
			ConstLabels: constLa
```

### Core Architecture Module: `tsdb/chunks/chunk_write_queue.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package chunks

import (
	"errors"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/prometheus/prometheus/tsdb/chunkenc"
)

const (
	// Minimum recorded peak since the last shrinking of chunkWriteQueue.chunkRefMap to shrink it again.
	chunkRefMapShrinkThreshold = 1000

	// Minimum interval between shrinking of chunkWriteQueue.chunkRefMap.
	chunkRefMapMinShrinkInterval = 10 * time.Minute

	// Maximum size of segment used by job queue (number of elements). With chunkWriteJob being 64 bytes,
	// this will use ~512 KiB for empty queue.
	maxChunkQueueSegmentSize = 8192
)

type chunkWriteJob struct {
	cutFile   bool
	seriesRef HeadSeriesRef
	mint      int64
	maxt      int64
	chk       chunkenc.Chunk
	ref       ChunkDiskMapperRef
	isOOO     bool
	callback  func(error)
}

// chunkWriteQueue is a queue for writing chunks to disk in a non-blocking fashion.
// Chunks that shall be written get added to the queue, which is consumed asynchronously.
// Adding jobs to the queue is non-blocking as long as the queue isn't full.
type chunkWriteQueue struct {
	jobs *writeJobQueue

	chunkRefMapMtx        sync.RWMutex
	chunkRefMap           map[ChunkDiskMapperRef]chunkenc.Chunk
	chunkRefMapPeakSize   int       // Largest size that chunkRefMap has grown to since the last time we shrank it.
	chunkRefMapLastShrink time.Time // When the chunkRefMap has been shrunk the last time.

	// isRunningMtx serves two purposes:
	// 1. It protects isRunning field.
	// 2. It serializes adding of jobs to the chunkRefMap in addJob() method. If jobs channel is full then addJob() will block
	// while holding this mutex, which guarantees that chunkRefMap won't ever grow beyond the queue size + 1.
	isRunningMtx sync.Mutex
	isRunning    bool // Used to prevent that new jobs get added to the queue when the chan is already closed.

	workerWg sync.WaitGroup

	writeChunk writeChunkF

	// Keeping separate counters instead of only a single CounterVec to improve the performance of the critical
	// addJob() method which otherwise would need to perform a WithLabelValues call on the CounterVec.
	adds      prometheus.Counter
	gets      prometheus.Counter
	completed prometheus.Counter
	shrink    prometheus.Counter
}

// writeChunkF is a function which writes chunks, it is dynamic to allow mocking in tests.
type writeChunkF func(HeadSeriesRef, int64, int64, chunkenc.Chunk, ChunkDiskMapperRef, bool, bool) error

func newChunkWriteQueue(reg prometheus.Registerer, size int, writeChunk writeChunkF) *chunkWriteQueue {
	counters := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "prometheus_tsdb_chunk_write_queue_operations_total",
			Help: "Number of operations on the chunk_write_queue.",
		},
		[]string{"operation"},
	)

	segmentSize := min(size, maxChunkQueueSegmentSize)

	q := &chunkWriteQueue{
		jobs:                  newWriteJobQueue(size, segmentSize),
		chunkRefMap:           make(map[ChunkDiskMapperRef]chunkenc.Chunk),
		chunkRefMapLastShrink: time.Now(),
		writeChunk:            writeChunk,

		adds:      counters.WithLabelValues("add"),
		gets:      counters.WithLabelValues("get"),
		completed: counters.WithLabelValues("complete"),
		shrink:    counters.WithLabelValues("shrink"),
	}

	if reg != nil {
		reg.MustRegister(counters)
	}

	q.start()
	return q
}

func (c *chunkWriteQueue) start() {
	c.workerWg.Go(func() {
		for {
			job, ok := c.jobs.pop()
			if !ok {
				return
			}

			c.processJob(job)
		}
	})

	c.isRunningMtx.Lock()
	c.isRunning = true
	c.isRunningMtx.Unlock()
}

func (c *chunkWriteQueue) processJob(job chunkWriteJob) {
	err := c.writeChunk(job.seriesRef, job.mint, job.maxt, job.chk, job.ref, job.isOOO, job.cutFile)
	if job.callback != nil {
		job.callback(err)
	}

	c.chunkRefMapMtx.Lock()
	defer c.chunkRefMapMtx.Unlock()

	delete(c.chunkRefMap, job.ref)

	c.completed.Inc()

	c.shrinkChunkRefMap()
}

// shrinkChunkRefMap checks whether the conditions to shrink the chunkRefMap are met,
// if so chunkRefMap is reinitialized. The chunkRefMapMtx must be held when calling this method.
//
// We do this because Go runtime doesn't release internal memory used by map after map has been emptied.
// To achieve that we create new map instead and throw the old one away.
func (c *chunkWriteQueue) shrinkChunkRefMap() {
	if len(c.chunkRefMap) > 0 {
		// Can't shrink it while there is data in it.
		return
	}

	if c.chunkRefMapPeakSize < chunkRefMapShrinkThreshold {
		// Not shrinking it because it has not grown to the minimum threshold yet.
		return
	}

	now := time.Now()

	if now.Sub(c.chunkRefMapLastShrink) < chunkRefMapMinShrinkInterval {
		// Not shrinking it because the minimum duration between shrink-events has not passed yet.
		return
	}

	// Re-initialize the chunk ref map to half of the peak size that it has grown to since the last re-init event.
	// We are trying to hit the sweet spot in the trade-off between initializing it to a very small size
	// potentially resulting in many allocations to re-grow it, and initializing it to a large size potentially
	// resulting in unused allocated memory.
	c.chunkRefMap = make(map[ChunkDiskMapperRef]chunkenc.Chunk, c.chunkRefMapPeakSize/2)

	c.chunkRefMapPeakSize = 0
	c.chunkRefMapLastShrink = now
	c.shrink.Inc()
}

func (c *chunkWriteQueue) addJob(job chunkWriteJob) (err error) {
	defer func() {
		if err == nil {
			c.adds.Inc()
		}
	}()

	c.isRunningMtx.Lock()
	defer c.isRunningMtx.Unlock()

	if !c.isRunning {
		return errors.New("queue is not running")
	}

	c.chunkRefMapMtx.Lock()
	c.chunkRefMap[job.ref] = job.chk

	// Keep track of the peak usage of c.chunkRefMap.
	if len(c.chunkRefMap) > c.chunkRefMapPeakSize {
		c.chunkRefMapPeakSize = len(c.chunkRefMap)
	}
	c.chunkRefMapMtx.Unlock()

	if ok := c.jobs.push(job); !ok {
		c.chunkRefMapMtx.Lock()
		delete(c.chunkRefMap, job.ref)
		c.chunkRefMapMtx.Unlock()

		return errors.New("queue is closed")
	}

	return nil
}

func (c *chunkWriteQueue) get(ref ChunkDiskMapperRef) chunkenc.Chunk {
	c.chunkRefMapMtx.RLock()
	defer c.chunkRefMapMtx.RUnlock()

	chk, ok := c.chunkRefMap[ref]
	if ok {
		c.gets.Inc()
	}

	return chk
}

func (c *chunkWriteQueue) stop() {
	c.isRunningMtx.Lock()
	defer c.isRunningMtx.Unlock()

	if !c.isRunning {
		return
	}

	c.isRunning = false

	c.jobs.close()

	c.workerWg.Wait()
}

func (c *chunkWriteQueue) queueIsEmpty() bool {
	return c.queueSize() == 0
}

func (c *chunkWriteQueue) queueIsFull() bool {
	// When the queue is full and blocked on the writer the chunkRefMap has one more job than the cap of the jobCh
	// because one job is currently being processed and blocked in the writer.
	return c.queueSize() == c.jobs.maxSize+1
}

func (c *chunkWriteQueue) queueSize() int {
	c.chunkRefMapMtx.Lock()
	defer c.chunkRefMapMtx.Unlock()

	// Looking at chunkRefMap instead of jobCh because the job is popped from the chan before it has
	// been fully processed, it remains in the chunkRefMap until the processing is complete.
	return len(c.chunkRefMap)
}

```

### Core Architecture Module: `tsdb/chunks/queue.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package chunks

import "sync"

// writeJobQueue is similar to buffered channel of chunkWriteJob, but manages its own buffers
// to avoid using a lot of memory when it's empty. It does that by storing elements into segments
// of equal size (segmentSize). When segment is not used anymore, reference to it are removed,
// so it can be treated as a garbage.
type writeJobQueue struct {
	maxSize     int
	segmentSize int

	mtx            sync.Mutex            // protects all following variables
	pushed, popped *sync.Cond            // signalled when something is pushed into the queue or popped from it
	first, last    *writeJobQueueSegment // pointer to first and last segment, if any
	size           int                   // total size of the queue
	closed         bool                  // after closing the queue, nothing can be pushed to it
}

type writeJobQueueSegment struct {
	segment             []chunkWriteJob
	nextRead, nextWrite int                   // index of next read and next write in this segment.
	nextSegment         *writeJobQueueSegment // next segment, if any
}

func newWriteJobQueue(maxSize, segmentSize int) *writeJobQueue {
	if maxSize <= 0 || segmentSize <= 0 {
		panic("invalid queue")
	}

	q := &writeJobQueue{
		maxSize:     maxSize,
		segmentSize: segmentSize,
	}

	q.pushed = sync.NewCond(&q.mtx)
	q.popped = sync.NewCond(&q.mtx)
	return q
}

func (q *writeJobQueue) close() {
	q.mtx.Lock()
	defer q.mtx.Unlock()

	q.closed = true

	// Unblock all blocked goroutines.
	q.pushed.Broadcast()
	q.popped.Broadcast()
}

// push blocks until there is space available in the queue, and then adds job to the queue.
// If queue is closed or gets closed while waiting for space, push returns false.
func (q *writeJobQueue) push(job chunkWriteJob) bool {
	q.mtx.Lock()
	defer q.mtx.Unlock()

	// Wait until queue has more space or is closed.
	for !q.closed && q.size >= q.maxSize {
		q.popped.Wait()
	}

	if q.closed {
		return false
	}

	// Check if this segment has more space for writing, and create new one if not.
	if q.last == nil || q.last.nextWrite >= q.segmentSize {
		prevLast := q.last
		q.last = &writeJobQueueSegment{
			segment: make([]chunkWriteJob, q.segmentSize),
		}

		if prevLast != nil {
			prevLast.nextSegment = q.last
		}
		if q.first == nil {
			q.first = q.last
		}
	}

	q.last.segment[q.last.nextWrite] = job
	q.last.nextWrite++
	q.size++
	q.pushed.Signal()
	return true
}

// pop returns first job from the queue, and true.
// If queue is empty, pop blocks until there is a job (returns true), or until queue is closed (returns false).
// If queue was already closed, pop first returns all remaining elements from the queue (with true value), and only then returns false.
func (q *writeJobQueue) pop() (chunkWriteJob, bool) {
	q.mtx.Lock()
	defer q.mtx.Unlock()

	// wait until something is pushed to the queue, or queue is closed.
	for q.size == 0 {
		if q.closed {
			return chunkWriteJob{}, false
		}

		q.pushed.Wait()
	}

	res := q.first.segment[q.first.nextRead]
	q.first.segment[q.first.nextRead] = chunkWriteJob{} // clear just-read element
	q.first.nextRead++
	q.size--

	// If we have read all possible elements from first segment, we can drop it.
	if q.first.nextRead >= q.segmentSize {
		q.first = q.first.nextSegment
		if q.first == nil {
			q.last = nil
		}
	}

	q.popped.Signal()
	return res, true
}

// length returns number of all jobs in the queue.
func (q *writeJobQueue) length() int {
	q.mtx.Lock()
	defer q.mtx.Unlock()

	return q.size
}

```

### Core Architecture Module: `tsdb/fileutil/dir.go`
```
// Copyright The Prometheus Authors
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

package fileutil

import (
	"os"
	"path/filepath"
)

func DirSize(dir string) (int64, error) {
	var size int64
	err := filepath.Walk(dir, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			// Ignore missing files that may have been deleted during the walk.
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size, err
}

```

### Core Architecture Module: `tsdb/fileutil/dir_unix.go`
```
// Copyright The Prometheus Authors
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

//go:build !windows

package fileutil

import "os"

// OpenDir opens a directory for syncing.
func OpenDir(path string) (*os.File, error) { return os.Open(path) }

```

### Core Architecture Module: `tsdb/fileutil/dir_windows.go`
```
// Copyright The Prometheus Authors
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

//go:build windows

package fileutil

import (
	"os"
	"syscall"
)

// OpenDir opens a directory in windows with write access for syncing.
func OpenDir(path string) (*os.File, error) {
	fd, err := openDir(path)
	if err != nil {
		return nil, err
	}
	return os.NewFile(uintptr(fd), path), nil
}

func openDir(path string) (fd syscall.Handle, err error) {
	if len(path) == 0 {
		return syscall.InvalidHandle, syscall.ERROR_FILE_NOT_FOUND
	}
	pathp, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return syscall.InvalidHandle, err
	}
	access := uint32(syscall.GENERIC_READ | syscall.GENERIC_WRITE)
	sharemode := uint32(syscall.FILE_SHARE_READ | syscall.FILE_SHARE_WRITE)
	createmode := uint32(syscall.OPEN_EXISTING)
	fl := uint32(syscall.FILE_FLAG_BACKUP_SEMANTICS)
	return syscall.CreateFile(pathp, access, sharemode, nil, createmode, fl, 0)
}

```

### Core Architecture Module: `tsdb/fileutil/direct_io.go`
```
// Copyright The Prometheus Authors
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

package fileutil

import (
	"bufio"
	"errors"
	"os"
)

var errDirectIOUnsupported = errors.New("direct IO is unsupported")

type BufWriter interface {
	Write([]byte) (int, error)
	Flush() error
	Reset(f *os.File) error
}

// writer is a specialized wrapper around bufio.Writer.
// It is used when Direct IO isn't enabled, as using directIOWriter in such cases is impractical.
type writer struct {
	*bufio.Writer
}

func (b *writer) Reset(f *os.File) error {
	b.Writer.Reset(f)
	return nil
}

```

### Core Architecture Module: `tsdb/fileutil/direct_io_force.go`
```
// Copyright The Prometheus Authors
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

// This allows seamless testing of the Direct I/O writer across all tsdb tests.

//go:build linux && forcedirectio

package fileutil

import "os"

func NewDirectIOWriter(f *os.File, size int) (BufWriter, error) {
	return newDirectIOWriter(f, size)
}

func NewBufioWriterWithSize(f *os.File, size int) (BufWriter, error) {
	return NewDirectIOWriter(f, size)
}

func UncachedIOSupported() bool {
	return true
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #19965** (2026-10-07): **Update module github.com/moby/moby/api to v1.56.1**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [github.com/moby/moby/api](https://redirect.github.com/moby/moby) | `v1.56.0` → `v1.56.1` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2fmoby%2fmoby%2fapi/v1.56.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2fmoby%2fmoby%2fapi/v1.56.0/v1.56.1?slim=true) |  ```release-notes  NONE  ```  ---  ### Release Notes  <details> <summary>moby/moby (github.com/moby/moby/api)</summary>  ### [`v1.56.1`](https://redirect.github.com/moby/moby/releases/tag/api/v1.56.1)  #### 1.56.1  ##### Changelog  - api/scripts: Allow isolated model generation with an API directory. [moby/moby#53629](https://redirect.github.com/moby/moby/pull/53629) - api/swagger: Improve OpenAPI compatibility. [moby/moby#53626](https://redirect.github.com/moby/moby/pull/53626) - api/swagger: Quote HTTP response status codes. [moby/moby#53759](https://redirect.github.com/moby/moby/pull/53759) - api/templates: schema: disable validators and serializer sections. [moby/moby#53751](https://redirect.github.com/moby/moby/pull/53751) - api: fix G117 (gosec). [moby/moby#53721](https://redirect.github.com/moby/moby/pull/53721) - api: swagger ImageManifestSummary.ImageData: fix invalid required field. [moby/moby#53750](https://redirect.github.com/moby/moby/pull/53750)

- **Issue #19961** (2026-10-07): **Update module github.com/klauspost/compress to v1.20.1 - autoclosed**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [github.com/klauspost/compress](https://redirect.github.com/klauspost/compress) | `v1.20.0` → `v1.20.1` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2fklauspost%2fcompress/v1.20.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2fklauspost%2fcompress/v1.20.0/v1.20.1?slim=true) |  ```release-notes  NONE  ```  ---  ### Release Notes  <details> <summary>klauspost/compress (github.com/klauspost/compress)</summary>  ### [`v1.20.1`](https://redirect.github.com/klauspost/compress/releases/tag/v1.20.1)  [Compare Source](https://redirect.github.com/klauspost/compress/compare/v1.20.0...v1.20.1)  #### What's Changed  - zstd: apply reset options to reused frame decoders by [@&#8203;pellared](https://redirect.github.com/pellared) in [#&#8203;1226](https://redirect.github.com/klauspost/compress/pull/1226) - flate: Report unexpected EOF for truncated Huffman extra bits by [@&#8203;rupayon123](https://redirect.github.com/rupayon123) in [#&#8203;1229](https://redirect.github.com/klauspost/compress/pull/1229) - flate: avoid FMA in EstimatedBits for portable rounding by [@&#8203;malt3](https://redirect.github.com/malt3) in [#&#8203;1224](https://redirect.github.com/klauspost/compress/pull/1224) - gzhttp: preserve caller request head

- **Issue #19960** (2026-10-07): **Update module github.com/go-openapi/strfmt to v0.27.3**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [github.com/go-openapi/strfmt](https://redirect.github.com/go-openapi/strfmt) | `v0.27.2` → `v0.27.3` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2fgo-openapi%2fstrfmt/v0.27.3?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2fgo-openapi%2fstrfmt/v0.27.2/v0.27.3?slim=true) |  ```release-notes  NONE  ```  ---  ### Release Notes  <details> <summary>go-openapi/strfmt (github.com/go-openapi/strfmt)</summary>  ### [`v0.27.3`](https://redirect.github.com/go-openapi/strfmt/releases/tag/v0.27.3)  [Compare Source](https://redirect.github.com/go-openapi/strfmt/compare/v0.27.2...v0.27.3)  #### [0.27.3](https://redirect.github.com/go-openapi/strfmt/tree/v0.27.3) - 2026-10-04  **Full Changelog**: <https://github.com/go-openapi/strfmt/compare/v0.27.2...v0.27.3>  8 commits in this release.  ***  ##### <!-- 01 -->Fixed bugs  - fix: reject a duration sum that wraps past 2^64 by [@&#8203;SashaMIT](https://redirect.github.com/SashaMIT) in [#&#8203;312](https://redirect.github.com/go-openapi/strfmt/pull/312) [...](https://redirect.github.com/go-openapi/strfmt/commit/9cf99bef5772b1604ee312a494e648dceff51cf5)  ##### <!-- 03 -->Documentation  - doc: updated contributors file by [@&#8203;bot-go-openapi\[bot\]](https://redirect.github.com
  **Post-Mortem & Fix Analysis**:
  > ### ℹ️ Artifact update notice  ##### File name: go.mod  In order to perform the update(s) described in the table above, Renovate ran the `go get` command, which resulted in the following additional change(s):   - 1 additional dependency was updated   Details:   | **Package**                    | **Change**             | | :----------------------------- | :--------------------- | | `github.com/go-openapi/errors` | `v0.22.8` -> `v0.22.9` |

- **Issue #19958** (2026-10-07): **Update Kubernetes Go dependencies to v0.37.1**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [k8s.io/api](https://redirect.github.com/kubernetes/api) | `v0.37.0` → `v0.37.1` | ![age](https://developer.mend.io/api/mc/badges/age/go/k8s.io%2fapi/v0.37.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/k8s.io%2fapi/v0.37.0/v0.37.1?slim=true) | | [k8s.io/apimachinery](https://redirect.github.com/kubernetes/apimachinery) | `v0.37.0` → `v0.37.1` | ![age](https://developer.mend.io/api/mc/badges/age/go/k8s.io%2fapimachinery/v0.37.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/k8s.io%2fapimachinery/v0.37.0/v0.37.1?slim=true) | | [k8s.io/client-go](https://redirect.github.com/kubernetes/client-go) | `v0.37.0` → `v0.37.1` | ![age](https://developer.mend.io/api/mc/badges/age/go/k8s.io%2fclient-go/v0.37.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/k8s.io%2fclient-go/v0.37.0/v0.37.1?slim=true) |  ```release-notes  NONE  ```  ---  ### Release Notes  <details> <summary>kubernetes/api (k8s.io/api)</summary>  ### [`v0.37.1`](https://redirect.github.com/kubernetes/api/compare/v0.37.0...v0.37.1)  [Compare Source](https://redirect.github.com/kubernetes/api/compare/v0.37.0...v0.37.1)  </details>  <details> <summary>kubernetes/apimachinery (k8s.io/apimachinery)</summary>  ### [`v0.37.1`](h

- **Issue #19956** (2026-10-07): **Update dependency vite to v8.3.2**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [vite](https://vite.dev) ([source](https://redirect.github.com/vitejs/vite/tree/HEAD/packages/vite)) | [`8.3.0` → `8.3.2`](https://renovatebot.com/diffs/npm/vite/8.3.0/8.3.2) | ![age](https://developer.mend.io/api/mc/badges/age/npm/vite/8.3.2?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/vite/8.3.0/8.3.2?slim=true) |  ```release-notes  NONE  ```  ---  ### Release Notes  <details> <summary>vitejs/vite (vite)</summary>  ### [`v8.3.2`](https://redirect.github.com/vitejs/vite/blob/HEAD/packages/vite/CHANGELOG.md#small-832-2026-10-01-small)  [Compare Source](https://redirect.github.com/vitejs/vite/compare/v8.3.1...v8.3.2)  ##### Bug Fixes  - **build:** preload CSS correctly when `renderBuiltUrl` returns URLs with queries ([#&#8203;23611](https://redirect.github.com/vitejs/vite/issues/23611)) ([64e0a21](https://redirect.github.com/vitejs/vite/commit/64e0a215c24f0522b27b91f93cfd93e317b94481)) - **bundled-dev:** serve lazy chunk sourcemaps ([#&#8203;23026](https://redirect.github.com/vitejs/vite/issues/23026)) ([eb7aa9a](https://redirect.github.com/vitejs/vite/commit/eb7aa9a8816a1e926d5d9b4cbe7e796b61314ce2)) - **bundled-dev:** serve the rolldown runtime from the installed rolldown ([#&#8203;23568](https://redirect.github.com/vitejs/vite/issues/23568)

- **Issue #19953** (2026-10-07): **Update Azure Go dependencies**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [github.com/Azure/azure-sdk-for-go/sdk/azcore](https://redirect.github.com/Azure/azure-sdk-for-go) | `v1.23.1` → `v1.23.3` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2fAzure%2fazure-sdk-for-go%2fsdk%2fazcore/v1.23.3?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2fAzure%2fazure-sdk-for-go%2fsdk%2fazcore/v1.23.1/v1.23.3?slim=true) | | [github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/compute/armcompute/v8](https://redirect.github.com/Azure/azure-sdk-for-go) | `v8.3.0` → `v8.4.0` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2fAzure%2fazure-sdk-for-go%2fsdk%2fresourcemanager%2fcompute%2farmcompute%2fv8/v8.4.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2fAzure%2fazure-sdk-for-go%2fsdk%2fresourcemanager%2fcompute%2farmcompute%2fv8/v8.3.0/v8.4.0?slim=true) |  ```release-notes  NONE  ```  ---  ### Release Notes  <details> <summary>Azure/azure-sdk-for-go (github.com/Azure/azure-sdk-for-go/sdk/azcore)</summary>  ### [`v1.23.3`](https://redirect.github.com/Azure/azure-sdk-for-go/releases/tag/sdk/azcore/v1.23.3)  #### 1.23.3 (2026-10-06)  ##### Bugs Fixed  - Fixed `arm.ResourceID.Location` being empty when the `locations` segment uses different ca
  **Post-Mortem & Fix Analysis**:
  > ### ℹ️ Artifact update notice  ##### File name: go.mod  In order to perform the update(s) described in the table above, Renovate ran the `go get` command, which resulted in the following additional change(s):   - 1 additional dependency was updated   Details:   | **Package**                                      | **Change**             | | :----------------------------------------------- | :--------------------- | | `github.com/Azure/azure-sdk-for-go/sdk/internal` | `v1.12.0` -> `v1.13.0` |

- **Issue #19952** (2026-10-07): **Update AWS Go dependencies**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [github.com/aws/aws-sdk-go-v2](https://redirect.github.com/aws/aws-sdk-go-v2) | `v1.47.0` → `v1.47.1` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2faws%2faws-sdk-go-v2/v1.47.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2faws%2faws-sdk-go-v2/v1.47.0/v1.47.1?slim=true) | | [github.com/aws/aws-sdk-go-v2/config](https://redirect.github.com/aws/aws-sdk-go-v2) | `v1.33.5` → `v1.33.7` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2faws%2faws-sdk-go-v2%2fconfig/v1.33.7?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2faws%2faws-sdk-go-v2%2fconfig/v1.33.5/v1.33.7?slim=true) | | [github.com/aws/aws-sdk-go-v2/credentials](https://redirect.github.com/aws/aws-sdk-go-v2) | `v1.20.5` → `v1.20.7` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2faws%2faws-sdk-go-v2%2fcredentials/v1.20.7?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2faws%2faws-sdk-go-v2%2fcredentials/v1.20.5/v1.20.7?slim=true) | | [github.com/aws/aws-sdk-go-v2/feature/ec2/imds](https://redirect.github.com/aws/aws-sdk-go-v2) | `v1.20.0` → `v1.20.1` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2faws%2faws-sdk-
  **Post-Mortem & Fix Analysis**:
  > ### ℹ️ Artifact update notice  ##### File name: go.mod  In order to perform the update(s) described in the table above, Renovate ran the `go get` command, which resulted in the following additional change(s):   - 7 additional dependencies were updated   Details:   | **Package**                                                   | **Change**             | | :------------------------------------------------------------ | :--------------------- | | `github.com/aws/aws-sdk-go-v2/internal/v4a`                   | `v1.5.3` -> `v1.5.4`   | | `github.com/aws/aws-sdk-go-v2/service/signin`                 | `v1.10.0` -> `v1.10.2` | | `github.com/aws/aws-sdk-go-v2/internal/configsources`         | `v1.5.3` -> `v1.5.4`   | | `github.com/aws/aws-sdk-go-v2/internal/endpoints/v2`          | `v2.8.3` -> `v2.8.4`   | | `github.com/aws/aws-sdk-go-v2/service/internal/presigned-url` | `v1.14.3` -> `v1.14.4` | | `github.com/aws/aws-sdk-go-v2/service/sso`                    | `v1.38.0` -> `v1.38.2` | | `gith

- **Issue #19947** (2026-10-07): **Update github.com/prometheus/client_golang/exp digest to de866d6**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [github.com/prometheus/client_golang/exp](https://redirect.github.com/prometheus/client_golang) | require | digest | `45322d1` → `de866d6` |  ```release-notes  NONE  ```  ---  ### Configuration  📅 **Schedule**: (in timezone UTC)  - Branch creation   - On day 7 and 21 of the month (`* * 7,21 * *`) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/prometheus/prometheus). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMzQuMSIsInVwZGF0ZWRJblZlciI6IjQ0LjEzNC4xIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119--> 
  **Post-Mortem & Fix Analysis**:
  > ### ℹ️ Artifact update notice  ##### File name: go.mod  In order to perform the update(s) described in the table above, Renovate ran the `go get` command, which resulted in the following additional change(s):   - 2 additional dependencies were updated   Details:   | **Package**                     | **Change**             | | :------------------------------ | :--------------------- | | `github.com/klauspost/compress` | `v1.20.0` -> `v1.20.1` | | `github.com/prometheus/common`  | `v0.71.0` -> `v0.72.0` |

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

### Incident Patch 1: `cc0aa45f` (2026-10-07)
**Commit Message**: Merge pull request #19944 from Kshot3000/fix/bucket-fraction-empty-buckets

promql: handle empty input in BucketFraction

**File**: `promql/quantile.go` (modified, +3/-0)
```diff
@@ -541,6 +541,9 @@ func BucketFraction(lower, upper float64, buckets Buckets) float64 {
 		}
 		return 0
 	})
+	if len(buckets) == 0 {
+		return math.NaN()
+	}
 	if !math.IsInf(buckets[len(buckets)-1].UpperBound, +1) {
 		return math.NaN()
 	}
```

**File**: `promql/quantile_test.go` (modified, +36/-0)
```diff
@@ -351,6 +351,42 @@ func TestBucketQuantile_ForcedMonotonicity(t *testing.T) {
 	}
 }
 
+func TestBucketFraction_EmptyBuckets(t *testing.T) {
+	for name, buckets := range map[string]Buckets{"nil": nil, "empty": {}} {
+		for _, tc := range []struct {
+			name         string
+			lower, upper float64
+		}{
+			{"finite bounds", 0, 1},
+			{"reversed bounds", 1, 0},
+			{"infinite bounds", math.Inf(-1), math.Inf(1)},
+			{"NaN lower bound", math.NaN(), 1},
+			{"NaN upper bound", 0, math.NaN()},
+		} {
+			t.Run(name+"/"+tc.name, func(t *testing.T) {
+				require.True(t, math.IsNaN(BucketFraction(tc.lower, tc.upper, buckets)))
+			})
+		}
+	}
+
+	// Control: a non-empty bucket list keeps its existing behavior,
+	// including NaN for a +Inf bucket with a count of zero.
+	require.True(t, math.IsNaN(BucketFraction(0, 1, Buckets{{UpperBound: math.Inf(1), Count: 0}})))
+}
+
+func TestBucketFraction(t *testing.T) {
+	// Two buckets with counts 10 and 30 (cumulative), all observations
+	// above zero. The fraction between 0 and 0.5 interpolates within
+	// the first bucket: 10 * (0.5 - 0) / (1 - 0) = 5 out of 30 total.
+	buckets := Buckets{
+		{UpperBound: 1, Count: 10},
+		{UpperBound: math.Inf(1), Count: 30},
+	}
+	require.InEpsilon(t, 5.0/30.0, BucketFraction(0, 0.5, buckets), 1e-12)
+	require.InEpsilon(t, 1.0, BucketFraction(0, math.Inf(1), buckets), 1e-12)
+	require.Zero(t, BucketFraction(1, 0, buckets))
+}
+
 // TestTrimBuckets_HistogramFractionCrossCheck checks that `h </ x` and `h >/ x` match histogram_fraction(-Inf, x, h) and histogram_fraction(x, +Inf, h) times histogram_count(h).
 func TestTrimBuckets_HistogramFractionCrossCheck(t *testing.T) {
 	testCases := []struct {
```

---

### Incident Patch 2: `a9c6bd34` (2026-10-07)
**Commit Message**: Fixing review findings

Signed-off-by: Yuri Nikolic <[REDACTED_EMAIL]>

**File**: `tsdb/db.go` (modified, +2/-0)
```diff
@@ -1882,6 +1882,8 @@ func (db *DB) compactHeadViewLocked(viewFactory headViewFactory, evict headSerie
 // CompactStaleHead writes stale series into blocks and evicts those that are still
 // eligible for removal. Series whose exemplars still need replay remain in the head,
 // but their persisted sample chunks are released if otherwise eligible for eviction.
+// WAL replay may restore those samples after a restart until the global replay
+// cutoff passes them.
 func (db *DB) CompactStaleHead() (err error) {
 	db.cmtx.Lock()
 	defer func() {
```

---

### Incident Patch 3: `f9e322f4` (2026-10-06)
**Commit Message**: Fixing appender v2 and adding its tests

Signed-off-by: Yuri Nikolic <[REDACTED_EMAIL]>

**File**: `tsdb/db_test.go` (modified, +330/-298)
```diff
@@ -3677,134 +3677,162 @@ func TestOpen_VariousBlockStates(t *testing.T) {
 	require.True(t, os.IsNotExist(err))
 }
 
+type exemplarCompactionAppender interface {
+	storage.LimitedAppenderV1
+	storage.ExemplarAppender
+}
+
+type exemplarCompactionAppenderV2 struct {
+	storage.LimitedAppenderV1
+	exemplars storage.ExemplarAppenderV2
+}
+
+func (a exemplarCompactionAppenderV2) AppendExemplar(ref storage.SeriesRef, lset labels.Labels, e exemplar.Exemplar) (storage.SeriesRef, error) {
+	return a.exemplars.AppendExemplars(ref, lset, []exemplar.Exemplar{e})
+}
+
+// newExemplarCompactionAppender lets both appender versions share the compaction tests.
+func newExemplarCompactionAppender(ctx context.Context, t *testing.T, db *DB, appV2 bool) exemplarCompactionAppender {
+	t.Helper()
+	if !appV2 {
+		return db.Appender(ctx)
+	}
+	app := db.AppenderV2(ctx)
+	exemplars, ok := app.(storage.ExemplarAppenderV2)
+	require.True(t, ok)
+	return exemplarCompactionAppenderV2{storage.AppenderV2AsLimitedV1(app), exemplars}
+}
+
 // TestExemplarAfterLastSampleSurvivesCompaction verifies that an exemplar newer
 // than its series's last sample survives ordinary, selected, and stale compaction,
 // WAL cleanup, and subsequent compaction after restart.
 func TestExemplarAfterLastSampleSurvivesCompaction(t *testing.T) {
 	t.Parallel()
-	for _, compaction := range []string{"ordinary", "selected", "stale"} {
-		for _, enableSnapshot := range []bool{false, true} {
-			t.Run(fmt.Sprintf("%s/snapshot=%t", compaction, enableSnapshot), func(t *testing.T) {
-				const blockRange = 1000
-				opts := DefaultOptions()
-				opts.MinBlockDuration = blockRange
-				opts.MaxBlockDuration = blockRange
-				opts.EnableExemplarStorage = true
-				opts.MaxExemplars = 10
-				opts.EnableMemorySnapshotOnShutdown = enableSnapshot
-				db := newTestDB(t, withOpts(opts))
-				db.DisableCompactions()
-				ctx := context.Background()
+	for _, appV2 := range []bool{false, true} {
+		for _, compaction := range []string{"ordinary", "selected", "stale"} {
+			for _, enableSnapshot := range []bool{false, true} {
+				t.Run(fmt.Sprintf("%s/snapshot=%t/appV2=%t", compaction, enableSnapshot, appV2), func(t *testing.T) {
+					const blockRange = 1000
+					opts := DefaultOptions()
+					opts.MinBlockDuration = blockRange
+					opts.MaxBlockDuration = blockRange
+					opts.EnableExemplarStorage = true
+					opts.MaxExemplars = 10
+					opts.EnableMemorySnapshotOnShutdown = enableSnapshot
+					db := newTestDB(t, withOpts(opts))
+					db.DisableCompactions()
+					ctx := context.Background()
 
-				seriesLabels := labels.FromStrings("name", "exemplar_only")
-				app := db.Appender(ctx)
-				ref, err := app.Append(0, seriesLabels, 100, 1)
-				require.NoError(t, err)
-				if compaction == "stale" {
-					_, err = app.Append(ref, seriesLabels, 200, math.Float64frombits(value.StaleNaN))
+					seriesLabels := labels.FromStrings("name", "exemplar_only")
+					app := newExemplarCompactionAppender(ctx, t, db, appV2)
+					ref, err := app.Append(0, seriesLabels, 100, 1)
 					require.NoError(t, err)
-				}
-				require.NoError(t, app.Commit())
+					if compaction == "stale" {
+						_, err = app.Append(ref, seriesLabels, 200, math.Float64frombits(value.StaleNaN))
+						require.NoError(t, err)
+					}
+					require.NoError(t, app.Commit())
 
-				// Leave the series record in an old segment and the exemplar in a recent one.
-				const exemplarSegment = 8
-				for range exemplarSegment {
-					_, err := db.head.wal.NextSegment()
+					// Leave the series record in an old segment and the exemplar in a recent one.
+					const exemplarSegment = 8
+					for range exemplarSegment {
+						_, err := db.head.wal.NextSegment()
+						require.NoError(t, err)
+					}
+					e := exemplar.Exemplar{
+						Labels: labels.FromStrings("trace_id", "abc123"),
+						Value:  1,
+						Ts:     10 * blockRange,
+					}
+					app = newExemplarCompactionAppender(ctx, t, db, appV2)
+					_, err = app.AppendExemplar(ref, seriesLabels, e)
 					require.NoError(t, err)
-				}
-				e := exemplar.Exemplar{
-					Labels: labels.FromStrings("trace_id", "abc123"),
-					Value:  1,
-					Ts:     10 * blockRange,
-				}
-				app = db.Appender(ctx)
-				_, err = app.AppendExemplar(ref, seriesLabels, e)
-				require.NoError(t, err)
-				require.NoError(t, app.Commit())
+					require.NoError(t, app.Commit())
 
-				// Selected and stale compaction persist this series before unrelated
-				// sample ingestion advances the head. Its exemplar is not in the block.
-				// Ordinary compaction is triggered by the unrelated ingestion below.
-				if compaction != "ordinary" {
-					switch compaction {
-					case "selected":
-						require.NoError(t, db.CompactSelectedSeries([]storage.SeriesRef{ref}))
-					case "stale":
-						require.NoError(t, db.CompactStaleHead())
+					// Selected and stale compaction persist this series before unrelated
+					// sample ingestion advances the head. Its exemplar is not in the block.

```

**File**: `tsdb/head_append_v2.go` (modified, +2/-0)
```diff
@@ -378,6 +378,8 @@ func (a *headAppenderV2) appendExemplars(s *memSeries, exemplars []exemplar.Exem
 			continue
 		}
 		b := a.getCurrentBatch(stNone, s.ref)
+		// Protect the series from compaction before the exemplar is committed.
+		s.updateExemplarTimestamp(e.Ts)
 		b.exemplars = append(b.exemplars, exemplarWithSeriesRef{storage.SeriesRef(s.ref), e})
 	}
 	if len(errs) > 0 {
```

**File**: `tsdb/head_append_v2_test.go` (modified, +62/-0)
```diff
@@ -5219,6 +5219,68 @@ func TestHeadAppenderV2_Histogram_STStorage(t *testing.T) {
 	}
 }
 
+func TestHeadAppenderV2_ExemplarsSurviveTruncation(t *testing.T) {
+	for _, withSample := range []bool{false, true} {
+		t.Run(fmt.Sprintf("withSample=%t", withSample), func(t *testing.T) {
+			opts := DefaultHeadOptions()
+			opts.ChunkRange = 1000
+			opts.MaxExemplars.Store(10)
+			opts.EnableExemplarStorage = true
+			h, err := NewHead(nil, nil, nil, nil, opts, nil)
+			require.NoError(t, err)
+			t.Cleanup(func() { require.NoError(t, h.Close()) })
+			require.NoError(t, h.Init(0))
+
+			lset := labels.FromStrings("name", "exemplar_series")
+			app := h.AppenderV2(t.Context())
+			ref, err := app.Append(0, lset, 0, 100, 1, nil, nil, storage.AOptions{})
+			require.NoError(t, err)
+			require.NoError(t, app.Commit())
+
+			e := exemplar.Exemplar{Labels: labels.FromStrings("trace_id", "abc123"), Value: 1, Ts: 10000, HasTs: true}
+			app = h.AppenderV2(t.Context())
+			if withSample {
+				_, err = app.Append(ref, lset, 0, 200, 2, nil, nil, storage.AOptions{Exemplars: []exemplar.Exemplar{e}})
+			} else {
+				_, err = app.(storage.ExemplarAppenderV2).AppendExemplars(ref, lset, []exemplar.Exemplar{e})
+			}
+			require.NoError(t, err)
+			series := h.series.getByID(chunks.HeadSeriesRef(ref))
+			require.NotNil(t, series)
+			// Protect accepted exemplars even before their transaction commits.
+			require.True(t, series.hasExemplar)
+			require.Equal(t, e.Ts, series.lastExemplarTs)
+			require.NoError(t, app.Commit())
+
+			require.NoError(t, h.Truncate(1000))
+			require.Same(t, series, h.series.getByID(chunks.HeadSeriesRef(ref)))
+			require.Nil(t, series.headChunks)
+			require.Nil(t, series.app)
+			q, err := h.ExemplarQuerier(t.Context())
+			require.NoError(t, err)
+			got, err := q.Select(0, e.Ts, []*labels.Matcher{labels.MustNewMatcher(labels.MatchEqual, "name", "exemplar_series")})
+			require.NoError(t, err)
+			require.Len(t, got, 1)
+			require.True(t, labels.Equal(lset, got[0].SeriesLabels))
+			require.Len(t, got[0].Exemplars, 1)
+			require.True(t, e.Equals(got[0].Exemplars[0]))
+
+			// New samples can use the retained identity and create a new chunk appender.
+			app = h.AppenderV2(t.Context())
+			newRef, err := app.Append(ref, lset, 0, e.Ts+1, 3, nil, nil, storage.AOptions{})
+			require.NoError(t, err)
+			require.Equal(t, ref, newRef)
+			require.NoError(t, app.Commit())
+			require.NotNil(t, series.headChunks)
+			require.NotNil(t, series.app)
+
+			// Once the cutoff passes both the exemplar and the samples, eviction is safe.
+			require.NoError(t, h.Truncate(e.Ts+2))
+			require.Nil(t, h.series.getByID(chunks.HeadSeriesRef(ref)))
+		})
+	}
+}
+
 func TestHeadAppenderV2_ExemplarAppenderV2(t *testing.T) {
 	opts := DefaultHeadOptions()
 	opts.ChunkRange = 1000
```

---

### Incident Patch 4: `9fd6b367` (2026-10-06)
**Commit Message**: Fixing review findings

Signed-off-by: Yuri Nikolic <[REDACTED_EMAIL]>

**File**: `tsdb/db_test.go` (modified, +4/-0)
```diff
@@ -3744,6 +3744,10 @@ func TestExemplarAfterLastSampleSurvivesCompaction(t *testing.T) {
 				if compaction == "ordinary" {
 					require.Len(t, db.Blocks(), 1)
 				}
+				series := db.Head().series.getByID(chunks.HeadSeriesRef(ref))
+				require.NotNil(t, series)
+				require.Nil(t, series.headChunks)
+				require.Nil(t, series.app, "the retained identity must not keep the compacted chunk alive")
 				_, firstCheckpoint, err := wlog.LastCheckpoint(db.head.wal.Dir())
 				require.NoError(t, err)
 
```

**File**: `tsdb/head.go` (modified, +2/-0)
```diff
@@ -2567,6 +2567,8 @@ func (s *stripeSeries) gc(mint int64, minOOOMmapRef chunks.ChunkDiskMapperRef) (
 		// until WAL truncation and replay can discard them by timestamp. An empty
 		// series retained for exemplars must not affect the minimum sample time.
 		if series.hasExemplar && series.lastExemplarTs >= mint {
+			// Clear the appender so it does not retain the removed sample chunk.
+			series.app = nil
 			return
 		}
 		// The series is gone entirely. We need to keep the series lock
```

---

### Incident Patch 5: `84e712db` (2026-10-06)
**Commit Message**: Fix failing tests with --tags=dedupelabels

Signed-off-by: Yuri Nikolic <[REDACTED_EMAIL]>

**File**: `tsdb/db_test.go` (modified, +5/-5)
```diff
@@ -3772,7 +3772,7 @@ func TestExemplarAfterLastSampleSurvivesCompaction(t *testing.T) {
 				require.NoError(t, err)
 				beforeRestart, err := q.Select(0, e.Ts, []*labels.Matcher{matcher})
 				require.NoError(t, err)
-				require.Equal(t, expected, beforeRestart)
+				testutil.RequireEqual(t, expected, beforeRestart)
 
 				require.NoError(t, db.Close())
 				reopened := newTestDB(t, withDir(db.Dir()), withOpts(opts))
@@ -3781,7 +3781,7 @@ func TestExemplarAfterLastSampleSurvivesCompaction(t *testing.T) {
 				require.NoError(t, err)
 				afterRestart, err := q.Select(0, e.Ts, []*labels.Matcher{matcher})
 				require.NoError(t, err)
-				require.Equal(t, expected, afterRestart, "the exemplar must survive %s compaction and restart", compaction)
+				testutil.RequireEqual(t, expected, afterRestart, "the exemplar must survive %s compaction and restart", compaction)
 				require.Zero(t, prom_testutil.ToFloat64(reopened.head.metrics.walReplayUnknownRefsTotal.WithLabelValues("exemplars")))
 
 				// Replay must restore the exemplar's eviction protection, so another compaction
@@ -3798,7 +3798,7 @@ func TestExemplarAfterLastSampleSurvivesCompaction(t *testing.T) {
 				require.NoError(t, err)
 				afterRestart, err = q.Select(0, e.Ts, []*labels.Matcher{matcher})
 				require.NoError(t, err)
-				require.Equal(t, expected, afterRestart, "replayed exemplars must survive subsequent compaction and restart")
+				testutil.RequireEqual(t, expected, afterRestart, "replayed exemplars must survive subsequent compaction and restart")
 				require.Zero(t, prom_testutil.ToFloat64(reopened.head.metrics.walReplayUnknownRefsTotal.WithLabelValues("exemplars")))
 			})
 		}
@@ -3859,7 +3859,7 @@ func TestExemplarBeforeLastSampleSurvivesSeriesCompaction(t *testing.T) {
 				require.NoError(t, err)
 				actual, err := q.Select(0, e.Ts, []*labels.Matcher{matcher})
 				require.NoError(t, err)
-				require.Equal(t, []exemplar.QueryResult{{SeriesLabels: seriesLabels, Exemplars: []exemplar.Exemplar{e}}}, actual)
+				testutil.RequireEqual(t, []exemplar.QueryResult{{SeriesLabels: seriesLabels, Exemplars: []exemplar.Exemplar{e}}}, actual)
 				require.Zero(t, prom_testutil.ToFloat64(reopened.head.metrics.walReplayUnknownRefsTotal.WithLabelValues("exemplars")))
 
 				// Once replay can skip the exemplar, it no longer prevents eviction.
@@ -4001,7 +4001,7 @@ func TestSeriesCompactionReclaimsChunksWithExemplars(t *testing.T) {
 						require.NoError(t, err)
 						got, err := q.Select(0, e.Ts, []*labels.Matcher{matcher})
 						require.NoError(t, err)
-						require.Equal(t, []exemplar.QueryResult{{SeriesLabels: seriesLabels, Exemplars: []exemplar.Exemplar{e}}}, got)
+						testutil.RequireEqual(t, []exemplar.QueryResult{{SeriesLabels: seriesLabels, Exemplars: []exemplar.Exemplar{e}}}, got)
 						sq, err := d.Querier(0, blockRange)
 						require.NoError(t, err)
 						samples := query(t, sq, matcher)[seriesLabels.String()]
```

---

### Incident Patch 6: `24884195` (2026-10-05)
**Commit Message**: [tsdb]: distinguish absent exemplars from zero-valued timestamps during GC

Signed-off-by: Yuri Nikolic <[REDACTED_EMAIL]>

**File**: `tsdb/head.go` (modified, +11/-7)
```diff
@@ -2566,7 +2566,7 @@ func (s *stripeSeries) gc(mint int64, minOOOMmapRef chunks.ChunkDiskMapperRef) (
 		// Exemplars are not persisted in blocks. Keep their series reference resolvable
 		// until WAL truncation and replay can discard them by timestamp. An empty
 		// series retained for exemplars must not affect the minimum sample time.
-		if series.lastExemplarTs >= mint {
+		if series.hasExemplar && series.lastExemplarTs >= mint {
 			return
 		}
 		// The series is gone entirely. We need to keep the series lock
@@ -2967,6 +2967,8 @@ type memSeries struct {
 	// Latest accepted exemplar timestamp, including exemplars awaiting commit.
 	// A rolled-back exemplar may conservatively delay eviction until this time.
 	lastExemplarTs int64
+	// Whether an exemplar timestamp has been recorded, including zero or negative timestamps.
+	hasExemplar bool
 
 	// Immutable chunks on disk that have not yet gone into a block, in order of ascending time stamps.
 	// When compaction runs, chunks get moved into a block and all pointers are shifted like so:
@@ -3095,11 +3097,10 @@ type memSeriesOOOFields struct {
 
 func newMemSeries(lset labels.Labels, id chunks.HeadSeriesRef, shardHash uint64, isolationDisabled, pendingCommit bool) *memSeries {
 	s := &memSeries{
-		lset:           lset,
-		ref:            id,
-		nextAt:         math.MinInt64,
-		shardHash:      shardHash,
-		lastExemplarTs: math.MinInt64,
+		lset:      lset,
+		ref:       id,
+		nextAt:    math.MinInt64,
+		shardHash: shardHash,
 	}
 	if pendingCommit {
 		s.markPendingCommit()
@@ -3113,7 +3114,10 @@ func newMemSeries(lset labels.Labels, id chunks.HeadSeriesRef, shardHash uint64,
 // updateExemplarTimestamp records the latest exemplar time while holding the series lock.
 func (s *memSeries) updateExemplarTimestamp(ts int64) {
 	s.Lock()
-	s.lastExemplarTs = max(s.lastExemplarTs, ts)
+	if !s.hasExemplar || ts > s.lastExemplarTs {
+		s.lastExemplarTs = ts
+	}
+	s.hasExemplar = true
 	s.Unlock()
 }
 
```

**File**: `tsdb/head_test.go` (modified, +37/-0)
```diff
@@ -7651,6 +7651,43 @@ func TestStripeSeries_gc(t *testing.T) {
 		ms2.Unlock()
 	})
 
+	t.Run("a memSeries not built via newMemSeries is incorrectly protected at mint<=0", func(t *testing.T) {
+		// Construct the series directly to verify that zero-valued exemplar state
+		// does not imply an exemplar at timestamp zero. With no chunks or exemplars,
+		// the series must be collected at mint<=0 without constructor initialization.
+		for _, mint := range []int64{-1, 0} {
+			lset := labels.FromStrings("a", "1")
+			series := &memSeries{lset: lset, ref: 1}
+			s := newStripeSeries(1, noopSeriesLifecycleCallback{})
+			_, created := s.setUnlessAlreadySet(lset.Hash(), lset, series)
+			require.True(t, created)
+
+			s.gc(mint, 0)
+
+			require.Nil(t, s.getByHash(lset.Hash(), lset),
+				"a series with no chunks and no exemplar must be collected at mint=%d, regardless of how it was constructed", mint)
+		}
+	})
+
+	t.Run("keeps series with zero or negative exemplar timestamps", func(t *testing.T) {
+		for _, ts := range []int64{-1, 0} {
+			lset := labels.FromStrings("a", "1")
+			series := &memSeries{lset: lset, ref: 1}
+			s := newStripeSeries(1, noopSeriesLifecycleCallback{})
+			_, created := s.setUnlessAlreadySet(lset.Hash(), lset, series)
+			require.True(t, created)
+
+			series.updateExemplarTimestamp(ts)
+			// An older exemplar must not shorten the lifetime of the series.
+			series.updateExemplarTimestamp(ts - 1)
+			s.gc(ts, 0)
+			require.Same(t, series, s.getByID(series.ref), "exemplar timestamp=%d", ts)
+
+			s.gc(ts+1, 0)
+			require.Nil(t, s.getByID(series.ref), "exemplar timestamp=%d", ts)
+		}
+	})
+
 	t.Run("keeps series until all reservations are released", func(t *testing.T) {
 		lset := labels.FromStrings("a", "1")
 		series := newMemSeries(lset, 1, 0, defaultIsolationDisabled, false)
```

---

### Incident Patch 7: `770ca8fb` (2026-10-05)
**Commit Message**: Merge pull request #19882 from ajaykr0905/fix/restore-firing-alert-state

rules: restore firing alerts with short for durations

**File**: `rules/group.go` (modified, +6/-11)
```diff
@@ -781,13 +781,6 @@ func (g *Group) RestoreForState(ts time.Time) {
 		}
 
 		alertHoldDuration := alertRule.HoldDuration()
-		if alertHoldDuration < g.opts.ForGracePeriod {
-			// If alertHoldDuration is already less than grace period, we would not
-			// like to make it wait for `g.opts.ForGracePeriod` time before firing.
-			// Hence we skip restoration, which will make it wait for alertHoldDuration.
-			alertRule.SetRestored(true)
-			continue
-		}
 
 		sset, err := alertRule.QueryForStateSeries(g.opts.Context, q)
 		if err != nil {
@@ -846,10 +839,12 @@ func (g *Group) RestoreForState(ts time.Time) {
 
 			switch {
 			case timeRemainingPending <= 0:
-				// It means that alert was firing when prometheus went down.
-				// In the next Eval, the state of this alert will be set back to
-				// firing again if it's still firing in that Eval.
-				// Nothing to be done in this case.
+				// The alert was firing before the outage. Retain ActiveAt so the
+				// next Eval can transition it to firing with its evaluation timestamp.
+			case alertHoldDuration < g.opts.ForGracePeriod:
+				// Pending alerts with a hold duration shorter than the grace period
+				// should restart their hold duration rather than wait for the grace period.
+				return
 			case timeRemainingPending < g.opts.ForGracePeriod:
 				// (new) restoredActiveAt = (ts + m.opts.ForGracePeriod) - alertHoldDuration
 				//                            /* new firing time */      /* moving back by hold duration */
```

**File**: `rules/manager_test.go` (modified, +157/-0)
```diff
@@ -359,6 +359,163 @@ func sortAlerts(items []*Alert) {
 	})
 }
 
+func TestForStateRestoreHoldDuration(t *testing.T) {
+	for _, test := range []struct {
+		name               string
+		holdDuration       time.Duration
+		initialEvaluations []time.Duration
+		restoreDuration    time.Duration
+		priorState         AlertState
+		activeAt           time.Duration
+		nextState          AlertState
+	}{
+		{
+			name:               "firing below grace period",
+			holdDuration:       5 * time.Minute,
+			initialEvaluations: []time.Duration{0, 4 * time.Minute, 6 * time.Minute, 8 * time.Minute},
+			restoreDuration:    12 * time.Minute,
+			priorState:         StateFiring,
+			nextState:          StateFiring,
+		},
+		{
+			name:               "firing at grace period",
+			holdDuration:       10 * time.Minute,
+			initialEvaluations: []time.Duration{0, 9 * time.Minute, 11 * time.Minute, 13 * time.Minute},
+			restoreDuration:    17 * time.Minute,
+			priorState:         StateFiring,
+			nextState:          StateFiring,
+		},
+		{
+			name:               "firing above grace period",
+			holdDuration:       15 * time.Minute,
+			initialEvaluations: []time.Duration{0, 14 * time.Minute, 16 * time.Minute, 18 * time.Minute},
+			restoreDuration:    22 * time.Minute,
+			priorState:         StateFiring,
+			nextState:          StateFiring,
+		},
+		{
+			name:               "pending below grace period restarts hold duration",
+			holdDuration:       5 * time.Minute,
+			initialEvaluations: []time.Duration{0, 2 * time.Minute},
+			restoreDuration:    6 * time.Minute,
+			priorState:         StatePending,
+			activeAt:           5 * time.Minute,
+			nextState:          StatePending,
+		},
+		{
+			name:               "pending above grace period excludes outage",
+			holdDuration:       25 * time.Minute,
+			initialEvaluations: []time.Duration{0, 5 * time.Minute},
+			restoreDuration:    15 * time.Minute,
+			priorState:         StatePending,
+			activeAt:           10 * time.Minute,
+			nextState:          StatePending,
+		},
+		{
+			name:               "pending near hold duration receives grace period",
+			holdDuration:       25 * time.Minute,
+			initialEvaluations: []time.Duration{0, 20 * time.Minute},
+			restoreDuration:    25 * time.Minute,
+			priorState:         StatePending,
+			activeAt:           10 * time.Minute,
+			nextState:          StatePending,
+		},
+		{
+			name:               "firing outside outage tolerance restarts hold duration",
+			holdDuration:       5 * time.Minute,
+			initialEvaluations: []time.Duration{0, 4 * time.Minute, 6 * time.Minute, 8 * time.Minute},
+			restoreDuration:    40 * time.Minute,
+			priorState:         StateFiring,
+			activeAt:           39 * time.Minute,
+			nextState:          StatePending,
+		},
+		{
+			name:               "zero hold duration keeps evaluated firing timestamp",
+			initialEvaluations: []time.Duration{0, 2 * time.Minute},
+			restoreDuration:    6 * time.Minute,
+			priorState:         StateFiring,
+			nextState:          StateFiring,
+		},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			st := teststorage.New(t)
+			expr, err := testParser.ParseExpr(`vector(1)`)
+			require.NoError(t, err)
+			opts := &ManagerOptions{
+				QueryFunc:       EngineQueryFunc(testEngine(t), st),
+				AppendableV2:    st,
+				Queryable:       st,
+				Context:         context.Background(),
+				Logger:          promslog.NewNopLogger(),
+				NotifyFunc:      func(context.Context, string, ...*Alert) {},
+				OutageTolerance: 30 * time.Minute,
+				ForGracePeriod:  10 * time.Minute,
+			}
+			const alertName = "AlwaysActive"
+			baseTime := time.Unix(1_700_000_000, 0).UTC()
+			rule := NewAlertingRule(
+				alertName, expr, test.holdDuration, 0,
+				labels.EmptyLabels(), labels.EmptyLabels(), labels.EmptyLabels(), "", true, nil,
+			)
+			group := NewGroup(GroupOptions{
+				Name:     "default",
+				Interval: time.Minute,
+				Rules:    []Rule{rule},
+				Opts:     opts,
+			})
+			for _, evaluation := range test.initialEvaluations {
+				group.Eval(context.Background(), baseTime.Add(evaluation))
+			}
+			require.Equal(t, test.priorState, rule.State())
+			if test.priorState == StateFiring && test.holdDuration > 0 {
+				// The firing transition occurs at an evaluation, not at ActiveAt + for.
+				require.Equal(t, baseTime.Add(test.holdDuration+time.Minute), rule.ActiveAlerts()[0].FiredAt)
+			}
+
+			restoredRule := NewAlertingRule(
+				alertName, expr, test.holdDuration, 0,
+				labels.EmptyLabels(), labels.EmptyLabels(), labels.EmptyLabels(), "", false, nil,
+			)
+			restoredGroup := NewGroup(GroupOptions{
+				Name:          "default",
+				Interval:      time.Minute,
+				Rules:         []Rule{restoredRule},
+				ShouldRestore: true,
+				Opts:          opts,
+			})
+			restoreTime := baseTime.Add(test.restoreDuration)
+			// Group.run evaluates twice before restoring state after a restart.
+			restoredGroup.Eval(context.Background(), restoreTime.Add(-time.Minute))
```

---

### Incident Patch 8: `13a387ea` (2026-10-05)
**Commit Message**: Merge pull request #19797 from zenador/zenador/promql-partial-ast-print-panics

promql: do not panic when printing the partial AST of a failed parse

**File**: `promql/parser/generated_parser.y` (modified, +26/-2)
```diff
@@ -461,6 +461,9 @@ function_call   : IDENTIFIER function_call_body
                         fn, exist := getFunction($1.Val, yylex.(*parser).functions)
                         if !exist{
                                 yylex.(*parser).addParseErrf($1.PositionRange(),"unknown function with name %q", $1.Val)
+                                // Keep the name so the partially-built AST stays printable; the
+                                // recorded error still rejects the query.
+                                fn = &Function{Name: $1.Val}
                         }
                         if fn != nil && fn.Experimental && !yylex.(*parser).options.EnableExperimentalFunctions {
                                 yylex.(*parser).addParseErrf($1.PositionRange(),"function %q is not enabled", $1.Val)
@@ -479,6 +482,9 @@ function_call   : IDENTIFIER function_call_body
                         fn, exist := getFunction($1.Val, yylex.(*parser).functions)
                         if !exist{
                                 yylex.(*parser).addParseErrf($1.PositionRange(),"unknown function with name %q", $1.Val)
+                                // Keep the name so the partially-built AST stays printable; the
+                                // recorded error still rejects the query.
+                                fn = &Function{Name: $1.Val}
                         }
                         if fn != nil && fn.Experimental && !yylex.(*parser).options.EnableExperimentalFunctions {
                                 yylex.(*parser).addParseErrf($1.PositionRange(),"function %q is not enabled", $1.Val)
@@ -497,6 +503,9 @@ function_call   : IDENTIFIER function_call_body
                         fn, exist := getFunction($1.Val, yylex.(*parser).functions)
                         if !exist{
                                 yylex.(*parser).addParseErrf($1.PositionRange(),"unknown function with name %q", $1.Val)
+                                // Keep the name so the partially-built AST stays printable; the
+                                // recorded error still rejects the query.
+                                fn = &Function{Name: $1.Val}
                         }
                         if fn != nil && fn.Experimental && !yylex.(*parser).options.EnableExperimentalFunctions {
                                 yylex.(*parser).addParseErrf($1.PositionRange(),"function %q is not enabled", $1.Val)
@@ -515,6 +524,9 @@ function_call   : IDENTIFIER function_call_body
                         fn, exist := getFunction($1.Val, yylex.(*parser).functions)
                         if !exist{
                                 yylex.(*parser).addParseErrf($1.PositionRange(),"unknown function with name %q", $1.Val)
+                                // Keep the name so the partially-built AST stays printable; the
+                                // recorded error still rejects the query.
+                                fn = &Function{Name: $1.Val}
                         }
                         if fn != nil && fn.Experimental && !yylex.(*parser).options.EnableExperimentalFunctions {
                                 yylex.(*parser).addParseErrf($1.PositionRange(),"function %q is not enabled", $1.Val)
@@ -533,6 +545,9 @@ function_call   : IDENTIFIER function_call_body
                         fn, exist := getFunction($1.Val, yylex.(*parser).functions)
                         if !exist{
                                 yylex.(*parser).addParseErrf($1.PositionRange(),"unknown function with name %q", $1.Val)
+                                // Keep the name so the partially-built AST stays printable; the
+                                // recorded error still rejects the query.
+                                fn = &Function{Name: $1.Val}
                         }
                         if fn != nil && fn.Experimental && !yylex.(*parser).options.EnableExperimentalFunctions {
                                 yylex.(*parser).addParseErrf($1.PositionRange(),"function %q is not enabled", $1.Val)
@@ -795,14 +810,23 @@ label_matchers  : LEFT_BRACE label_match_list RIGHT_BRACE
 
 label_match_list: label_match_list COMMA label_matcher
                         {
-                        if $1 != nil{
+                        // A nil matcher failed to build (invalid regexp or incomplete syntax)
+                        // and its error is already recorded. Drop it so the partially-built
+                        // AST never holds a nil matcher.
+                        if $1 != nil && $3 != nil {
                                 $$ = append($1, $3)
                         } else {
                                 $$ = $1
                         }
                         }
                 | label_matcher
-                        { $$ = []*labels.Matcher{$1}}
+                        {
+                        if $1 != nil {
+                                $$ = []*labels.Matcher{$1}
+                        } else {
+                      
```

**File**: `promql/parser/generated_parser.y.go` (modified, +24/-2)
```diff
@@ -1525,6 +1525,9 @@ yydefault:
 			fn, exist := getFunction(yyDollar[1].item.Val, yylex.(*parser).functions)
 			if !exist {
 				yylex.(*parser).addParseErrf(yyDollar[1].item.PositionRange(), "unknown function with name %q", yyDollar[1].item.Val)
+				// Keep the name so the partially-built AST stays printable; the
+				// recorded error still rejects the query.
+				fn = &Function{Name: yyDollar[1].item.Val}
 			}
 			if fn != nil && fn.Experimental && !yylex.(*parser).options.EnableExperimentalFunctions {
 				yylex.(*parser).addParseErrf(yyDollar[1].item.PositionRange(), "function %q is not enabled", yyDollar[1].item.Val)
@@ -1544,6 +1547,9 @@ yydefault:
 			fn, exist := getFunction(yyDollar[1].item.Val, yylex.(*parser).functions)
 			if !exist {
 				yylex.(*parser).addParseErrf(yyDollar[1].item.PositionRange(), "unknown function with name %q", yyDollar[1].item.Val)
+				// Keep the name so the partially-built AST stays printable; the
+				// recorded error still rejects the query.
+				fn = &Function{Name: yyDollar[1].item.Val}
 			}
 			if fn != nil && fn.Experimental && !yylex.(*parser).options.EnableExperimentalFunctions {
 				yylex.(*parser).addParseErrf(yyDollar[1].item.PositionRange(), "function %q is not enabled", yyDollar[1].item.Val)
@@ -1563,6 +1569,9 @@ yydefault:
 			fn, exist := getFunction(yyDollar[1].item.Val, yylex.(*parser).functions)
 			if !exist {
 				yylex.(*parser).addParseErrf(yyDollar[1].item.PositionRange(), "unknown function with name %q", yyDollar[1].item.Val)
+				// Keep the name so the partially-built AST stays printable; the
+				// recorded error still rejects the query.
+				fn = &Function{Name: yyDollar[1].item.Val}
 			}
 			if fn != nil && fn.Experimental && !yylex.(*parser).options.EnableExperimentalFunctions {
 				yylex.(*parser).addParseErrf(yyDollar[1].item.PositionRange(), "function %q is not enabled", yyDollar[1].item.Val)
@@ -1582,6 +1591,9 @@ yydefault:
 			fn, exist := getFunction(yyDollar[1].item.Val, yylex.(*parser).functions)
 			if !exist {
 				yylex.(*parser).addParseErrf(yyDollar[1].item.PositionRange(), "unknown function with name %q", yyDollar[1].item.Val)
+				// Keep the name so the partially-built AST stays printable; the
+				// recorded error still rejects the query.
+				fn = &Function{Name: yyDollar[1].item.Val}
 			}
 			if fn != nil && fn.Experimental && !yylex.(*parser).options.EnableExperimentalFunctions {
 				yylex.(*parser).addParseErrf(yyDollar[1].item.PositionRange(), "function %q is not enabled", yyDollar[1].item.Val)
@@ -1601,6 +1613,9 @@ yydefault:
 			fn, exist := getFunction(yyDollar[1].item.Val, yylex.(*parser).functions)
 			if !exist {
 				yylex.(*parser).addParseErrf(yyDollar[1].item.PositionRange(), "unknown function with name %q", yyDollar[1].item.Val)
+				// Keep the name so the partially-built AST stays printable; the
+				// recorded error still rejects the query.
+				fn = &Function{Name: yyDollar[1].item.Val}
 			}
 			if fn != nil && fn.Experimental && !yylex.(*parser).options.EnableExperimentalFunctions {
 				yylex.(*parser).addParseErrf(yyDollar[1].item.PositionRange(), "function %q is not enabled", yyDollar[1].item.Val)
@@ -1862,7 +1877,10 @@ yydefault:
 	case 109:
 		yyDollar = yyS[yypt-3 : yypt+1]
 		{
-			if yyDollar[1].matchers != nil {
+			// A nil matcher failed to build (invalid regexp or incomplete syntax)
+			// and its error is already recorded. Drop it so the partially-built
+			// AST never holds a nil matcher.
+			if yyDollar[1].matchers != nil && yyDollar[3].matcher != nil {
 				yyVAL.matchers = append(yyDollar[1].matchers, yyDollar[3].matcher)
 			} else {
 				yyVAL.matchers = yyDollar[1].matchers
@@ -1871,7 +1889,11 @@ yydefault:
 	case 110:
 		yyDollar = yyS[yypt-1 : yypt+1]
 		{
-			yyVAL.matchers = []*labels.Matcher{yyDollar[1].matcher}
+			if yyDollar[1].matcher != nil {
+				yyVAL.matchers = []*labels.Matcher{yyDollar[1].matcher}
+			} else {
+				yyVAL.matchers = []*labels.Matcher{}
+			}
 		}
 	case 111:
 		yyDollar = yyS[yypt-2 : yypt+1]
```

**File**: `promql/parser/parse.go` (modified, +8/-0)
```diff
@@ -63,8 +63,16 @@ func (o Options) functions() map[string]*Function {
 
 // Parser provides PromQL parsing methods. Create one with NewParser.
 type Parser interface {
+	// ParseExpr parses the input into an expression AST. On error, the returned
+	// Expr may still be non-nil and hold the partially-built AST, so that tooling
+	// (such as a language server) can inspect or print what was parsed. A partial
+	// AST is well-formed for inspection and printing but must not be evaluated.
 	ParseExpr(input string) (Expr, error)
 	ParseMetric(input string) (labels.Labels, error)
+	// ParseMetricSelector parses the input as a metric selector and returns its
+	// label matchers. On error, the returned matchers may still hold what was
+	// parsed, so that tooling can inspect or print them. Partial matchers are
+	// well-formed for that purpose but must not be used to select series.
 	ParseMetricSelector(input string) ([]*labels.Matcher, error)
 	ParseMetricSelectors(matchers []string) ([][]*labels.Matcher, error)
 	ParseSeriesDesc(input string) (labels.Labels, []SequenceValue, error)
```

**File**: `promql/parser/parse_test.go` (modified, +271/-14)
```diff
@@ -53,6 +53,7 @@ var testExpr = []struct {
 	expected Expr        // The expected expression AST.
 	fail     bool        // Whether parsing is supposed to fail.
 	errors   ParseErrors // The errors that should be returned.
+	printed  string      // For failing cases, the String() of the partially-built AST; empty skips the check.
 }{
 	// Scalars and scalar-to-scalar operations.
 	{
@@ -2395,6 +2396,17 @@ var testExpr = []struct {
 			},
 		},
 	},
+	{
+		input: `foo{a="b",c=~"[a-z"}`,
+		fail:  true,
+		errors: ParseErrors{
+			ParseErr{
+				PositionRange: posrange.PositionRange{Start: 10, End: 19},
+				Err:           errors.New("error parsing regexp: missing closing ]: `[a-z`"),
+				Query:         `foo{a="b",c=~"[a-z"}`,
+			},
+		},
+	},
 	// Test matrix selector.
 	{
 		input: "test[1000ms]",
@@ -3231,8 +3243,9 @@ var testExpr = []struct {
 		},
 	},
 	{
-		input: `sum () by (test)`,
-		fail:  true,
+		input:   `sum () by (test)`,
+		fail:    true,
+		printed: `sum by (test) ()`,
 		errors: ParseErrors{
 			ParseErr{
 				PositionRange: posrange.PositionRange{Start: 0, End: 16},
@@ -3286,8 +3299,9 @@ var testExpr = []struct {
 		},
 	},
 	{
-		input: `topk(some_metric)`,
-		fail:  true,
+		input:   `topk(some_metric)`,
+		fail:    true,
+		printed: `topk(some_metric)`,
 		errors: ParseErrors{
 			ParseErr{
 				PositionRange: posrange.PositionRange{Start: 0, End: 17},
@@ -3297,8 +3311,9 @@ var testExpr = []struct {
 		},
 	},
 	{
-		input: `topk(some_metric,)`,
-		fail:  true,
+		input:   `topk(some_metric,)`,
+		fail:    true,
+		printed: `topk(some_metric)`,
 		errors: ParseErrors{
 			ParseErr{
 				PositionRange: posrange.PositionRange{Start: 16, End: 17},
@@ -3494,8 +3509,9 @@ var testExpr = []struct {
 		},
 	},
 	{
-		input: "non_existent_function_far_bar()",
-		fail:  true,
+		input:   "non_existent_function_far_bar()",
+		fail:    true,
+		printed: `non_existent_function_far_bar()`,
 		errors: ParseErrors{
 			ParseErr{
 				PositionRange: posrange.PositionRange{Start: 0, End: 29},
@@ -3577,8 +3593,9 @@ var testExpr = []struct {
 		},
 	},
 	{
-		input: "a>b()",
-		fail:  true,
+		input:   "a>b()",
+		fail:    true,
+		printed: `a > b()`,
 		errors: ParseErrors{
 			ParseErr{
 				PositionRange: posrange.PositionRange{Start: 2, End: 3},
@@ -5405,8 +5422,9 @@ var testExpr = []struct {
 		},
 	},
 	{
-		input: "sum(",
-		fail:  true,
+		input:   "sum(",
+		fail:    true,
+		printed: `sum()`,
 		errors: ParseErrors{
 			ParseErr{
 				PositionRange: posrange.PositionRange{Start: 4, End: 4},
@@ -5421,8 +5439,9 @@ var testExpr = []struct {
 		},
 	},
 	{
-		input: "sum(rate(",
-		fail:  true,
+		input:   "sum(rate(",
+		fail:    true,
+		printed: `sum()`,
 		errors: ParseErrors{
 			ParseErr{
 				PositionRange: posrange.PositionRange{Start: 9, End: 9},
@@ -5481,6 +5500,225 @@ var testExpr = []struct {
 			},
 		},
 	},
+	// Failing parses must return a partially-built AST that stays printable. These
+	// cover each way the parser used to leave a malformed node behind; the generic
+	// checks in TestParseExpressions apply to every failing case.
+	{
+		input: `metric{a="1",b=~"[a-z)("}`,
+		fail:  true,
+		errors: ParseErrors{
+			ParseErr{
+				PositionRange: posrange.PositionRange{Start: 13, End: 24},
+				Err:           errors.New("error parsing regexp: missing closing ]: `[a-z)(`"),
+				Query:         `metric{a="1",b=~"[a-z)("}`,
+			},
+		},
+	},
+	{
+		input: `{__name__=~".*(bucket",foo="bar"}`,
+		fail:  true,
+		errors: ParseErrors{
+			ParseErr{
+				PositionRange: posrange.PositionRange{Start: 1, End: 22},
+				Err:           errors.New("error parsing regexp: missing closing ): `.*(bucket`"),
+				Query:         `{__name__=~".*(bucket",foo="bar"}`,
+			},
+		},
+	},
+	{
+		input: `count by (__name__) ({foo="bar",__name__=~".*(bucket"})`,
+		fail:  true,
+		errors: ParseErrors{
+			ParseErr{
+				PositionRange: posrange.PositionRange{Start: 32, End: 53},
+				Err:           errors.New("error parsing regexp: missing closing ): `.*(bucket`"),
+				Query:         `count by (__name__) ({foo="bar",__name__=~".*(bucket"})`,
+			},
+		},
+	},
+	{
+		input: `metric{a="1",b=~}`,
+		fail:  true,
+		errors: ParseErrors{
+			ParseErr{
+				PositionRange: posrange.PositionRange{Start: 16, End: 17},
+				Err:           errors.New(`unexpected "}" in label matching, expected string`),
+				Query:         `metric{a="1",b=~}`,
+			},
+		},
+	},
+	{
+		input: `metric{a="1",b=}`,
+		fail:  true,
+		errors: ParseErrors{
+			ParseErr{
+				PositionRange: posrange.PositionRange{Start: 15, End: 16},
+				Err:           errors.New(`unexpected "}" in label matching, expected string`),
+				Query:         `metric{a="1",b=}`,
+			},
+		},
+	},
+	{
+		input: `{a="1",b=~}`,
+		fail:  true,
+		errors: ParseErrors{
+			ParseErr{
+				PositionRange: posrange.PositionRange{Start: 10, End: 11},
+				Err:           errors.New(`unexpected "}" in label matching, expected string`),
+				Query:         `{a="1",b=~}`,
+			},
+
```

**File**: `promql/parser/printer.go` (modified, +42/-10)
```diff
@@ -73,11 +73,17 @@ func (node *AggregateExpr) String() string {
 	b := bytes.NewBuffer(make([]byte, 0, 1024))
 	node.writeAggOpStr(b)
 	b.WriteString("(")
-	if node.Op.IsAggregatorWithParam() {
+	// A failed parse (e.g. missing or too few arguments) can leave Param or Expr nil.
+	// Print only the parts that were parsed.
+	if node.Op.IsAggregatorWithParam() && node.Param != nil {
 		b.WriteString(node.Param.String())
-		b.WriteString(", ")
+		if node.Expr != nil {
+			b.WriteString(", ")
+		}
+	}
+	if node.Expr != nil {
+		b.WriteString(node.Expr.String())
 	}
-	b.WriteString(node.Expr.String())
 	b.WriteString(")")
 
 	return b.String()
@@ -247,15 +253,25 @@ func (node *DurationExpr) ShortString() string {
 }
 
 func (node *Call) String() string {
-	return node.Func.Name + "(" + node.Args.String() + ")"
+	return node.ShortString() + "(" + node.Args.String() + ")"
 }
 
 func (node *Call) ShortString() string {
+	// A failed parse leaves Func nil for an unknown function name, and the AST does
+	// not keep the name itself, so there is nothing to print for it.
+	if node.Func == nil {
+		return ""
+	}
 	return node.Func.Name
 }
 
 func (node *MatrixSelector) atOffset() (string, string) {
-	vecSelector := node.VectorSelector.(*VectorSelector)
+	vecSelector, ok := node.VectorSelector.(*VectorSelector)
+	if !ok {
+		// A failed parse can leave a non-vector expression here (e.g. `1[5m]`). Such an
+		// operand cannot carry @ or offset modifiers, so there is nothing to print.
+		return "", ""
+	}
 	offset := ""
 	switch {
 	case vecSelector.OriginalOffsetExpr != nil:
@@ -278,9 +294,24 @@ func (node *MatrixSelector) atOffset() (string, string) {
 }
 
 func (node *MatrixSelector) String() string {
+	rangeStr := model.Duration(node.Range).String()
+	if node.RangeExpr != nil {
+		rangeStr = node.RangeExpr.String()
+	}
+	vs, ok := node.VectorSelector.(*VectorSelector)
+	if !ok {
+		// A failed parse can leave a non-vector expression here (e.g. `1[5m]`), and a
+		// hand-built node may have no operand at all. Neither can carry the selector-only
+		// modifiers handled below, so print whatever is there with the range.
+		inner := ""
+		if node.VectorSelector != nil {
+			inner = node.VectorSelector.String()
+		}
+		return fmt.Sprintf("%s[%s]", inner, rangeStr)
+	}
 	at, offset := node.atOffset()
 	// Copy the Vector selector so we can modify it to not print @, offset, and other modifiers twice.
-	vecSelector := *node.VectorSelector.(*VectorSelector)
+	vecSelector := *vs
 	anchored, smoothed := vecSelector.Anchored, vecSelector.Smoothed
 	vecSelector.OriginalOffset = 0
 	vecSelector.OriginalOffsetExpr = nil
@@ -296,10 +327,6 @@ func (node *MatrixSelector) String() string {
 	case smoothed:
 		extendedAttribute = " smoothed"
 	}
-	rangeStr := model.Duration(node.Range).String()
-	if node.RangeExpr != nil {
-		rangeStr = node.RangeExpr.String()
-	}
 	str := fmt.Sprintf("%s[%s]%s%s%s", vecSelector.String(), rangeStr, extendedAttribute, at, offset)
 
 	return str
@@ -387,6 +414,11 @@ func (node *VectorSelector) String() string {
 		labelStrings = make([]string, 0, len(node.LabelMatchers)-1)
 	}
 	for _, matcher := range node.LabelMatchers {
+		// A partially-built AST from a failed parse, or a hand-constructed selector, may
+		// hold a nil matcher. Skip it so printing never panics.
+		if matcher == nil {
+			continue
+		}
 		// Only include the __name__ label if its equality matching and matches the name, but don't skip if it's an explicit empty name matcher.
 		if matcher.Name == labels.MetricName && matcher.Type == labels.MatchEqual && matcher.Value == node.Name && matcher.Value != "" {
 			continue
```

**File**: `promql/parser/printer_test.go` (modified, +42/-0)
```diff
@@ -15,6 +15,7 @@ package parser
 
 import (
 	"testing"
+	"time"
 
 	"github.com/stretchr/testify/require"
 
@@ -455,6 +456,47 @@ func TestVectorSelector_String(t *testing.T) {
 	}
 }
 
+func TestMatrixSelector_String(t *testing.T) {
+	for _, tc := range []struct {
+		name          string
+		ms            MatrixSelector
+		expected      string
+		expectedShort string
+	}{
+		{
+			name: "vector selector",
+			ms: MatrixSelector{
+				VectorSelector: &VectorSelector{Name: "foobar"},
+				Range:          5 * time.Minute,
+			},
+			expected:      `foobar[5m]`,
+			expectedShort: `[5m]`,
+		},
+		{
+			// A failed parse can leave a non-vector expression as the operand.
+			name: "non-vector operand",
+			ms: MatrixSelector{
+				VectorSelector: &NumberLiteral{Val: 1},
+				Range:          5 * time.Minute,
+			},
+			expected:      `1[5m]`,
+			expectedShort: `[5m]`,
+		},
+		{
+			// A hand-built node may have no operand at all.
+			name:          "no operand",
+			ms:            MatrixSelector{Range: 5 * time.Minute},
+			expected:      `[5m]`,
+			expectedShort: `[5m]`,
+		},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			require.Equal(t, tc.expected, tc.ms.String())
+			require.Equal(t, tc.expectedShort, tc.ms.ShortString())
+		})
+	}
+}
+
 func TestBinaryExprUTF8Labels(t *testing.T) {
 	testCases := []struct {
 		name     string
```

---

### Incident Patch 9: `b2c30142` (2026-10-05)
**Commit Message**: Merge pull request #19910 from tcp13equals2/search-metadata-doubled-suffix

web/api/v1: Fix for metadata enrichment on double suffixed _total and _info

**File**: `docs/querying/api.md` (modified, +4/-0)
```diff
@@ -628,6 +628,10 @@ name for suffixes supported by that family's type:
 - `_sum` and `_count` for summaries.
 - `_info` for info metrics.
 
+A metric family name that already ends with `_total` or `_info` is not matched
+for the same suffix again: e.g. `requests_total_total` does not get the
+metadata of a `requests_total` counter.
+
 The returned `type`, `help`, and `unit` describe the metric family, not the
 individual series: e.g. `http_request_duration_seconds_bucket` is reported with
 type `histogram`. Matching is done by name against metadata from active
```

**File**: `scrape/scrape_test.go` (modified, +4/-0)
```diff
@@ -444,6 +444,8 @@ func TestIsSeriesPartOfFamily(t *testing.T) {
 		require.False(t, isSeriesPartOfFamily("http_requests_total", []byte("http_requests"), model.MetricTypeUnknown)) // We don't know.
 		require.False(t, isSeriesPartOfFamily("http_requests2_total", []byte("http_requests_total"), model.MetricTypeCounter))
 		require.False(t, isSeriesPartOfFamily("http_requests_requests_total", []byte("http_requests"), model.MetricTypeCounter))
+
+		require.False(t, isSeriesPartOfFamily("http_requests_total_total", []byte("http_requests_total"), model.MetricTypeCounter))
 	})
 
 	t.Run("gauge", func(t *testing.T) {
@@ -480,6 +482,8 @@ func TestIsSeriesPartOfFamily(t *testing.T) {
 		require.False(t, isSeriesPartOfFamily("go_build_info", []byte("go_build"), model.MetricTypeUnknown)) // We don't know.
 		require.False(t, isSeriesPartOfFamily("go_build2_info", []byte("go_build_info"), model.MetricTypeInfo))
 		require.False(t, isSeriesPartOfFamily("go_build_build_info", []byte("go_build_info"), model.MetricTypeInfo))
+
+		require.False(t, isSeriesPartOfFamily("go_build_info_info", []byte("go_build_info"), model.MetricTypeInfo))
 	})
 }
 
```

**File**: `web/api/v1/search.go` (modified, +11/-2)
```diff
@@ -421,6 +421,11 @@ func (api *API) buildMetricMetadataMap(ctx context.Context) map[string][]scrape.
 // belongs to. An exact match on the family name wins. Otherwise the last
 // suffix is stripped and the metadata is returned if the family type allows
 // that suffix.
+//
+// A family name that already ends with _total or _info is in the Prometheus
+// text style, where the series has the family name, so it is not matched for
+// the same suffix again: x_total_total is not a series of the x_total family.
+// This follows isSeriesPartOfFamily in scrape/scrape.go.
 func metadataForMetric(metaMap map[string][]scrape.MetricMetadata, name string) (scrape.MetricMetadata, bool) {
 	if mds := metaMap[name]; len(mds) > 0 {
 		return mds[0], true
@@ -429,8 +434,12 @@ func metadataForMetric(metaMap map[string][]scrape.MetricMetadata, name string)
 	if i < 0 {
 		return scrape.MetricMetadata{}, false
 	}
-	for _, md := range metaMap[name[:i]] {
-		if typeAllowsSuffix(md.Type, name[i:]) {
+	family, suffix := name[:i], name[i:]
+	if (suffix == "_total" || suffix == "_info") && strings.HasSuffix(family, suffix) {
+		return scrape.MetricMetadata{}, false
+	}
+	for _, md := range metaMap[family] {
+		if typeAllowsSuffix(md.Type, suffix) {
 			return md, true
 		}
 	}
```

**File**: `web/api/v1/search_test.go` (modified, +21/-0)
```diff
@@ -308,6 +308,21 @@ func TestSearchMetricNames(t *testing.T) {
 				matching: []string{"process_cpu_seconds_total"},
 				missing:  []string{"process_cpu_seconds"},
 			},
+			{
+				// A counter family named with _total is in the Prometheus text
+				// style, so its series has the family name, as in
+				// isSeriesPartOfFamily in scrape/scrape.go.
+				name:     "Prometheus counter with doubled suffix",
+				metadata: scrape.MetricMetadata{MetricFamily: "process_cpu_seconds_total", Type: model.MetricTypeCounter, Help: "Total CPU time.", Unit: "seconds"},
+				matching: []string{"process_cpu_seconds_total"},
+				missing:  []string{"process_cpu_seconds_total_total"},
+			},
+			{
+				name:     "exact metadata for doubled suffix",
+				metadata: scrape.MetricMetadata{MetricFamily: "requests_total_total", Type: model.MetricTypeGauge, Help: "Independent gauge."},
+				extra:    []scrape.MetricMetadata{{MetricFamily: "requests_total", Type: model.MetricTypeCounter, Help: "Requests."}},
+				matching: []string{"requests_total_total"},
+			},
 			{
 				name:     "conflicting types across targets",
 				metadata: scrape.MetricMetadata{MetricFamily: "requests", Type: model.MetricTypeCounter, Help: "Requests."},
@@ -353,6 +368,12 @@ func TestSearchMetricNames(t *testing.T) {
 				matching: []string{"target_info"},
 				missing:  []string{"target_total", "target_created"},
 			},
+			{
+				name:     "Prometheus info with doubled suffix",
+				metadata: scrape.MetricMetadata{MetricFamily: "go_build_info", Type: model.MetricTypeInfo, Help: "Build information."},
+				matching: []string{"go_build_info"},
+				missing:  []string{"go_build_info_info"},
+			},
 			{
 				name:     "unknown type",
 				metadata: scrape.MetricMetadata{MetricFamily: "custom_metric", Type: model.MetricTypeUnknown, Help: "Custom metric."},
```

---

### Incident Patch 10: `e7995400` (2026-10-05)
**Commit Message**: Fix for double suffix

Signed-off-by: Andrew Hall <[REDACTED_EMAIL]>

**File**: `docs/querying/api.md` (modified, +4/-0)
```diff
@@ -628,6 +628,10 @@ name for suffixes supported by that family's type:
 - `_sum` and `_count` for summaries.
 - `_info` for info metrics.
 
+A metric family name that already ends with `_total` or `_info` is not matched
+for the same suffix again: e.g. `requests_total_total` does not get the
+metadata of a `requests_total` counter.
+
 The returned `type`, `help`, and `unit` describe the metric family, not the
 individual series: e.g. `http_request_duration_seconds_bucket` is reported with
 type `histogram`. Matching is done by name against metadata from active
```

**File**: `scrape/scrape_test.go` (modified, +4/-0)
```diff
@@ -444,6 +444,8 @@ func TestIsSeriesPartOfFamily(t *testing.T) {
 		require.False(t, isSeriesPartOfFamily("http_requests_total", []byte("http_requests"), model.MetricTypeUnknown)) // We don't know.
 		require.False(t, isSeriesPartOfFamily("http_requests2_total", []byte("http_requests_total"), model.MetricTypeCounter))
 		require.False(t, isSeriesPartOfFamily("http_requests_requests_total", []byte("http_requests"), model.MetricTypeCounter))
+
+		require.False(t, isSeriesPartOfFamily("http_requests_total_total", []byte("http_requests_total"), model.MetricTypeCounter))
 	})
 
 	t.Run("gauge", func(t *testing.T) {
@@ -480,6 +482,8 @@ func TestIsSeriesPartOfFamily(t *testing.T) {
 		require.False(t, isSeriesPartOfFamily("go_build_info", []byte("go_build"), model.MetricTypeUnknown)) // We don't know.
 		require.False(t, isSeriesPartOfFamily("go_build2_info", []byte("go_build_info"), model.MetricTypeInfo))
 		require.False(t, isSeriesPartOfFamily("go_build_build_info", []byte("go_build_info"), model.MetricTypeInfo))
+
+		require.False(t, isSeriesPartOfFamily("go_build_info_info", []byte("go_build_info"), model.MetricTypeInfo))
 	})
 }
 
```

**File**: `web/api/v1/search.go` (modified, +11/-2)
```diff
@@ -421,6 +421,11 @@ func (api *API) buildMetricMetadataMap(ctx context.Context) map[string][]scrape.
 // belongs to. An exact match on the family name wins. Otherwise the last
 // suffix is stripped and the metadata is returned if the family type allows
 // that suffix.
+//
+// A family name that already ends with _total or _info is in the Prometheus
+// text style, where the series has the family name, so it is not matched for
+// the same suffix again: x_total_total is not a series of the x_total family.
+// This follows isSeriesPartOfFamily in scrape/scrape.go.
 func metadataForMetric(metaMap map[string][]scrape.MetricMetadata, name string) (scrape.MetricMetadata, bool) {
 	if mds := metaMap[name]; len(mds) > 0 {
 		return mds[0], true
@@ -429,8 +434,12 @@ func metadataForMetric(metaMap map[string][]scrape.MetricMetadata, name string)
 	if i < 0 {
 		return scrape.MetricMetadata{}, false
 	}
-	for _, md := range metaMap[name[:i]] {
-		if typeAllowsSuffix(md.Type, name[i:]) {
+	family, suffix := name[:i], name[i:]
+	if (suffix == "_total" || suffix == "_info") && strings.HasSuffix(family, suffix) {
+		return scrape.MetricMetadata{}, false
+	}
+	for _, md := range metaMap[family] {
+		if typeAllowsSuffix(md.Type, suffix) {
 			return md, true
 		}
 	}
```

**File**: `web/api/v1/search_test.go` (modified, +21/-0)
```diff
@@ -308,6 +308,21 @@ func TestSearchMetricNames(t *testing.T) {
 				matching: []string{"process_cpu_seconds_total"},
 				missing:  []string{"process_cpu_seconds"},
 			},
+			{
+				// A counter family named with _total is in the Prometheus text
+				// style, so its series has the family name, as in
+				// isSeriesPartOfFamily in scrape/scrape.go.
+				name:     "Prometheus counter with doubled suffix",
+				metadata: scrape.MetricMetadata{MetricFamily: "process_cpu_seconds_total", Type: model.MetricTypeCounter, Help: "Total CPU time.", Unit: "seconds"},
+				matching: []string{"process_cpu_seconds_total"},
+				missing:  []string{"process_cpu_seconds_total_total"},
+			},
+			{
+				name:     "exact metadata for doubled suffix",
+				metadata: scrape.MetricMetadata{MetricFamily: "requests_total_total", Type: model.MetricTypeGauge, Help: "Independent gauge."},
+				extra:    []scrape.MetricMetadata{{MetricFamily: "requests_total", Type: model.MetricTypeCounter, Help: "Requests."}},
+				matching: []string{"requests_total_total"},
+			},
 			{
 				name:     "conflicting types across targets",
 				metadata: scrape.MetricMetadata{MetricFamily: "requests", Type: model.MetricTypeCounter, Help: "Requests."},
@@ -353,6 +368,12 @@ func TestSearchMetricNames(t *testing.T) {
 				matching: []string{"target_info"},
 				missing:  []string{"target_total", "target_created"},
 			},
+			{
+				name:     "Prometheus info with doubled suffix",
+				metadata: scrape.MetricMetadata{MetricFamily: "go_build_info", Type: model.MetricTypeInfo, Help: "Build information."},
+				matching: []string{"go_build_info"},
+				missing:  []string{"go_build_info_info"},
+			},
 			{
 				name:     "unknown type",
 				metadata: scrape.MetricMetadata{MetricFamily: "custom_metric", Type: model.MetricTypeUnknown, Help: "Custom metric."},
```

---

### Incident Patch 11: `f9b41f94` (2026-10-01)
**Commit Message**: Merge pull request #19824 from roidelapluie/roidelapluie/search-metadata-family

web/api/v1: resolve metric family metadata in search

**File**: `docs/querying/api.md` (modified, +15/-0)
```diff
@@ -619,6 +619,21 @@ Additional parameters for `/api/v1/search/metric_names`:
 - `include_metadata=<bool>`: Include metric metadata in each result.
 - `sort_by=<alpha | score>`
 
+Metadata is matched by the exact metric name first, then by the metric family
+name for suffixes supported by that family's type:
+
+- `_total` for counters.
+- `_bucket`, `_sum`, and `_count` for histograms.
+- `_bucket`, `_sum`, `_count`, `_gsum`, and `_gcount` for gauge histograms.
+- `_sum` and `_count` for summaries.
+- `_info` for info metrics.
+
+The returned `type`, `help`, and `unit` describe the metric family, not the
+individual series: e.g. `http_request_duration_seconds_bucket` is reported with
+type `histogram`. Matching is done by name against metadata from active
+targets, so it is best-effort. Metadata fields are omitted when no matching
+metadata is available.
+
 Additional parameters for `/api/v1/search/label_names`:
 
 - `sort_by=<alpha | score>`
```

**File**: `web/api/v1/search.go` (modified, +60/-11)
```diff
@@ -48,6 +48,7 @@ import (
 	"time"
 
 	jsoniter "github.com/json-iterator/go"
+	"github.com/prometheus/common/model"
 	"go.uber.org/atomic"
 
 	"github.com/prometheus/prometheus/model/labels"
@@ -337,7 +338,7 @@ const metricMetadataCacheTTL = 5 * time.Second
 // non-nil entry can read built and data without further synchronisation.
 type metadataCacheEntry struct {
 	built time.Time
-	data  map[string]scrape.MetricMetadata
+	data  map[string][]scrape.MetricMetadata
 }
 
 // searchMetadataCache caches the metric metadata map produced by
@@ -351,7 +352,8 @@ type searchMetadataCache struct {
 }
 
 // buildMetricMetadataMap snapshots metric metadata across all active targets
-// into a single map keyed by metric family name. It is intended to be called
+// into a single map keyed by metric family name. Each family holds the first
+// metadata seen for every distinct type. It is intended to be called
 // once per request when include_metadata=true so that per-result metadata
 // lookups are O(1) and we acquire the scrape manager lock only once instead
 // of once per emitted result.
@@ -366,15 +368,18 @@ type searchMetadataCache struct {
 // is shared across concurrent requests, and any mutation would race with
 // every other reader holding the same reference.
 //
-// Iteration order over active targets is non-deterministic; for a metric name
-// that appears on multiple targets we keep the first metadata seen, matching
-// the prior per-result fallthrough behaviour.
+// Iteration order over active targets is non-deterministic; for a metric
+// family that appears on multiple targets with the same type we keep the
+// first metadata seen, matching the prior per-result fallthrough behaviour.
+// Distinct types are all kept so that whether metadataForMetric finds a
+// suffix match does not depend on which target was seen first. If multiple
+// types allow the suffix, the first compatible metadata entry wins.
 //
 // The traversal aborts as soon as ctx is done so a request that the client
 // has already abandoned (or one that has run past its deadline) does not
 // keep accumulating per-target locks. Callers tolerate a partial map: a
 // missing entry just means the result is emitted without metadata.
-func (api *API) buildMetricMetadataMap(ctx context.Context) map[string]scrape.MetricMetadata {
+func (api *API) buildMetricMetadataMap(ctx context.Context) map[string][]scrape.MetricMetadata {
 	if c := api.metaCache; c != nil {
 		if e := c.entry.Load(); e != nil && api.now().Sub(e.built) < metricMetadataCacheTTL {
 			return e.data
@@ -385,7 +390,7 @@ func (api *API) buildMetricMetadataMap(ctx context.Context) map[string]scrape.Me
 	if tr == nil {
 		return nil
 	}
-	out := map[string]scrape.MetricMetadata{}
+	out := map[string][]scrape.MetricMetadata{}
 	for _, targets := range tr.TargetsActive() {
 		if ctx.Err() != nil {
 			return out
@@ -398,8 +403,9 @@ func (api *API) buildMetricMetadataMap(ctx context.Context) map[string]scrape.Me
 				if ctx.Err() != nil {
 					return out
 				}
-				if _, exists := out[md.MetricFamily]; !exists {
-					out[md.MetricFamily] = md
+				mds := out[md.MetricFamily]
+				if !slices.ContainsFunc(mds, func(m scrape.MetricMetadata) bool { return m.Type == md.Type }) {
+					out[md.MetricFamily] = append(mds, md)
 				}
 			}
 		}
@@ -411,6 +417,49 @@ func (api *API) buildMetricMetadataMap(ctx context.Context) map[string]scrape.Me
 	return out
 }
 
+// metadataForMetric returns the metadata of the metric family a metric name
+// belongs to. An exact match on the family name wins. Otherwise the last
+// suffix is stripped and the metadata is returned if the family type allows
+// that suffix.
+func metadataForMetric(metaMap map[string][]scrape.MetricMetadata, name string) (scrape.MetricMetadata, bool) {
+	if mds := metaMap[name]; len(mds) > 0 {
+		return mds[0], true
+	}
+	i := strings.LastIndexByte(name, '_')
+	if i < 0 {
+		return scrape.MetricMetadata{}, false
+	}
+	for _, md := range metaMap[name[:i]] {
+		if typeAllowsSuffix(md.Type, name[i:]) {
+			return md, true
+		}
+	}
+	return scrape.MetricMetadata{}, false
+}
+
+// typeAllowsSuffix reports whether series of a metric family with the given
+// type can be named with the given suffix. It follows isSeriesPartOfFamily in
+// scrape/scrape.go (see #17900) and additionally accepts _sum and _count for
+// gauge histograms, which is how the protobuf parser names them. The _created
+// suffix is not accepted because that series holds a timestamp, not a value of
+// the family type.
+func typeAllowsSuffix(typ model.MetricType, suffix string) bool {
+	switch suffix {
+	case "_total":
+		return typ == model.MetricTypeCounter
+	case "_bucket":
+		return typ == model.MetricTypeHistogram || typ == model.MetricTypeGaugeHistogram
+	case "_sum", "_count":
+		return typ == model.MetricTypeHistogram || typ == model.MetricTypeGaugeHistogram || typ == model.MetricTypeSummary
+	case "_gsum", "_gcount":
+		return typ == model.MetricTypeGauge
```

**File**: `web/api/v1/search_test.go` (modified, +150/-14)
```diff
@@ -18,6 +18,7 @@ import (
 	"context"
 	"encoding/json"
 	"errors"
+	"fmt"
 	"math"
 	"net/http"
 	"net/http/httptest"
@@ -264,20 +265,155 @@ func TestSearchMetricNames(t *testing.T) {
 	})
 
 	t.Run("with metadata", func(t *testing.T) {
-		rec := doSearchRequest(t, api, "/search/metric_names", url.Values{
-			"search[]":         []string{"go_gc_duration"},
-			"include_metadata": []string{"true"},
-		})
-		require.Equal(t, http.StatusOK, rec.Code)
-
-		lines := parseNDJSON(t, rec.Body.String())
-		var batch searchBatch[searchMetricNameResult]
-		require.NoError(t, json.Unmarshal(lines[0], &batch))
-		require.Len(t, batch.Results, 1)
-		require.Equal(t, "go_gc_duration_seconds", batch.Results[0].Name)
-		require.Equal(t, "gauge", batch.Results[0].Type)
-		require.Equal(t, "GC duration.", batch.Results[0].Help)
-		require.Equal(t, "seconds", batch.Results[0].Unit)
+		for _, tc := range []struct {
+			name     string
+			metadata scrape.MetricMetadata
+			// Extra metadata is exposed by a second target.
+			extra      []scrape.MetricMetadata
+			extraFirst bool
+			search     string
+			matching   []string
+			missing    []string
+			// Filtered series are loaded but excluded by the search term.
+			filtered []string
+		}{
+			{
+				name:     "gauge",
+				metadata: scrape.MetricMetadata{MetricFamily: "go_goroutines", Type: model.MetricTypeGauge, Help: "Number of goroutines."},
+				matching: []string{"go_goroutines"},
+				missing:  []string{"go_goroutines_total", "go_goroutines_count", "go_goroutines_bucket", "go_goroutines_info"},
+			},
+			{
+				name:     "search filter",
+				metadata: scrape.MetricMetadata{MetricFamily: "go_goroutines", Type: model.MetricTypeGauge, Help: "Number of goroutines."},
+				search:   "go_goroutines",
+				matching: []string{"go_goroutines"},
+				filtered: []string{"go_threads"},
+			},
+			{
+				name:     "name without underscore",
+				metadata: scrape.MetricMetadata{MetricFamily: "up", Type: model.MetricTypeGauge, Help: "Target is up."},
+				matching: []string{"up"},
+				missing:  []string{"uptime"},
+			},
+			{
+				name:     "OpenMetrics counter",
+				metadata: scrape.MetricMetadata{MetricFamily: "process_cpu_seconds", Type: model.MetricTypeCounter, Help: "Total CPU time.", Unit: "seconds"},
+				matching: []string{"process_cpu_seconds_total"},
+				missing:  []string{"process_cpu_seconds_created", "process_cpu_seconds_sum", "process_cpu_seconds_bucket", "process_cpu_seconds_total_total"},
+			},
+			{
+				name:     "Prometheus counter",
+				metadata: scrape.MetricMetadata{MetricFamily: "process_cpu_seconds_total", Type: model.MetricTypeCounter, Help: "Total CPU time.", Unit: "seconds"},
+				matching: []string{"process_cpu_seconds_total"},
+				missing:  []string{"process_cpu_seconds"},
+			},
+			{
+				name:     "conflicting types across targets",
+				metadata: scrape.MetricMetadata{MetricFamily: "requests", Type: model.MetricTypeCounter, Help: "Requests."},
+				extra:    []scrape.MetricMetadata{{MetricFamily: "requests", Type: model.MetricTypeGauge, Help: "In-flight requests."}},
+				matching: []string{"requests_total"},
+			},
+			{
+				name:       "conflicting types across targets with incompatible type first",
+				metadata:   scrape.MetricMetadata{MetricFamily: "requests", Type: model.MetricTypeCounter, Help: "Requests."},
+				extra:      []scrape.MetricMetadata{{MetricFamily: "requests", Type: model.MetricTypeGauge, Help: "In-flight requests."}},
+				extraFirst: true,
+				matching:   []string{"requests_total"},
+			},
+			{
+				name:     "exact metadata takes precedence",
+				metadata: scrape.MetricMetadata{MetricFamily: "http_request_duration_seconds_count", Type: model.MetricTypeGauge, Help: "Independent gauge."},
+				extra:    []scrape.MetricMetadata{{MetricFamily: "http_request_duration_seconds", Type: model.MetricTypeHistogram, Help: "Request duration.", Unit: "seconds"}},
+				matching: []string{"http_request_duration_seconds_count"},
+			},
+			{
+				name:     "histogram",
+				metadata: scrape.MetricMetadata{MetricFamily: "http_request_duration_seconds", Type: model.MetricTypeHistogram, Help: "Request duration.", Unit: "seconds"},
+				matching: []string{"http_request_duration_seconds", "http_request_duration_seconds_bucket", "http_request_duration_seconds_sum", "http_request_duration_seconds_count"},
+				missing:  []string{"http_request_duration_seconds_created", "http_request_duration_seconds_total", "http_request_duration_seconds_gsum", "http_request_duration_seconds_gcount"},
+			},
+			{
+				name:     "summary",
+				metadata: scrape.MetricMetadata{MetricFamily: "go_gc_duration_seconds", Type: model.MetricTypeSummary, Help: "GC duration.", Unit: "seconds"},
+				matching: []string{"go_gc_duration_seconds", "go_gc_duration_seconds_sum", "go_gc_duration_seconds_count"},
+				missing:  []string{"go_gc_duration_seconds_created", "go_gc_duration_seconds_bucket", "go_gc_duration_seconds_total"},
+			},
+			{
+				// OpenMetrics tex
```

---

### Incident Patch 12: `8c2c8434` (2026-10-01)
**Commit Message**: Merge pull request #19838 from eholzbach/fix_auto_reload

auto-reload: fix logic to reload when configuration change is reverted

**File**: `cmd/prometheus/main.go` (modified, +1/-0)
```diff
@@ -1394,6 +1394,7 @@ func main() {
 				notifs.DeleteNotification(notifications.ConfigurationUnsuccessful)
 				return
 			}
+			checksum = ""
 			notifs.AddNotification(notifications.ConfigurationUnsuccessful)
 		}
 
```

**File**: `cmd/prometheus/reload_test.go` (modified, +17/-0)
```diff
@@ -88,6 +88,23 @@ global:
 global:
   scrape_interval: 15s
 invalid_syntax
+`,
+			expectedInterval: "30s",
+			expectedMetric:   0,
+		},
+		{
+			configText: `
+global:
+  scrape_interval: 30s
+`,
+			expectedInterval: "30s",
+			expectedMetric:   1,
+		},
+		{
+			configText: `
+global:
+  scrape_interval: 15s
+  scrape_timeout: 30s
 `,
 			expectedInterval: "30s",
 			expectedMetric:   0,
```

---

### Incident Patch 13: `5c5be17a` (2026-09-29)
**Commit Message**: Merge pull request #19828 from fallintoplace/fix/ts-of-last-over-time-pre-epoch

promql: fix ts_of_last_over_time before Unix epoch

**File**: `promql/functions.go` (modified, +2/-2)
```diff
@@ -1495,12 +1495,12 @@ func funcTsOfLastOverTime(_ []Vector, matrixVal Matrix, _ parser.Expressions, en
 	}
 	el := matrixVal[0]
 
-	var tf int64
+	var tf int64 = math.MinInt64
 	if len(el.Floats) > 0 {
 		tf = el.Floats[len(el.Floats)-1].T
 	}
 
-	var th int64
+	var th int64 = math.MinInt64
 	if len(el.Histograms) > 0 {
 		th = el.Histograms[len(el.Histograms)-1].T
 	}
```

**File**: `promql/functions_test.go` (modified, +24/-0)
```diff
@@ -30,6 +30,7 @@ import (
 	storage2 "github.com/prometheus/prometheus/storage"
 	"github.com/prometheus/prometheus/tsdb"
 	"github.com/prometheus/prometheus/tsdb/chunkenc"
+	"github.com/prometheus/prometheus/tsdb/tsdbutil"
 	"github.com/prometheus/prometheus/util/teststorage"
 )
 
@@ -74,6 +75,29 @@ func TestDeriv(t *testing.T) {
 	require.Equal(t, 0.0, vec[0].F, "Expected 0.0 as value, got %f", vec[0].F)
 }
 
+func TestTsOfLastOverTimeBeforeEpoch(t *testing.T) {
+	ctx := context.Background()
+	storage := teststorage.New(t)
+	app := storage.Appender(ctx)
+
+	_, err := app.Append(0, labels.FromStrings("__name__", "float_metric"), -1000, 1)
+	require.NoError(t, err)
+	_, err = app.AppendHistogram(0, labels.FromStrings("__name__", "histogram_metric"), -1000, nil, tsdbutil.GenerateTestFloatHistogram(0))
+	require.NoError(t, err)
+	require.NoError(t, app.Commit())
+
+	engine := promqltest.NewTestEngine(t, false, 0, 10000)
+	for _, metric := range []string{"float_metric", "histogram_metric"} {
+		query, err := engine.NewInstantQuery(ctx, storage, nil, "ts_of_last_over_time("+metric+"[1s])", timestamp.Time(-1000))
+		require.NoError(t, err)
+		result := query.Exec(ctx)
+		require.NoError(t, result.Err)
+		vector, _ := result.Vector()
+		require.Len(t, vector, 1)
+		require.Equal(t, -1.0, vector[0].F, metric)
+	}
+}
+
 func TestFunctionList(t *testing.T) {
 	// Test that Functions and parser.Functions list the same functions.
 	for i := range promql.FunctionCalls {
```

---

### Incident Patch 14: `7e15f879` (2026-09-29)
**Commit Message**: Merge pull request #19853 from AruneshDwivedi/fix/chunks-appender-error-handling

tsdb: handle Appender error in ChunkFromSamplesGeneric

**File**: `tsdb/chunks/chunks.go` (modified, +4/-1)
```diff
@@ -165,7 +165,10 @@ func ChunkFromSamplesGeneric(s Samples) (Meta, error) {
 		return Meta{}, err
 	}
 
-	ca, _ := c.Appender()
+	ca, err := c.Appender()
+	if err != nil {
+		return emptyChunk, fmt.Errorf("failed to create chunk appender: %w", err)
+	}
 	var newChunk chunkenc.Chunk
 
 	for i := 0; i < s.Len(); i++ {
```

---

### Incident Patch 15: `143bdea2` (2026-09-29)
**Commit Message**: storage: fix gofmt in fanout.go

Signed-off-by: Bartek Plotka <[REDACTED_EMAIL]>

**File**: `storage/fanout.go` (modified, +1/-1)
```diff
@@ -322,7 +322,7 @@ func (f *fanoutAppenderV2) Append(ref SeriesRef, l labels.Labels, st, t int64, v
 var _ ExemplarAppenderV2 = &fanoutAppenderV2{}
 
 // AppendExemplars implements ExemplarAppenderV2.
-// It dispatches the exemplars to the primary that is required to and all  
+// It dispatches the exemplars to the primary that is required to and all
 // secondaries that optionally implement ExemplarAppenderV2.
 func (f *fanoutAppenderV2) AppendExemplars(ref SeriesRef, l labels.Labels, exemplars []exemplar.Exemplar) (SeriesRef, error) {
 	pa, ok := f.primary.(ExemplarAppenderV2)
```

#### Recent Merged Pull Requests:
- **PR #19965** (2026-10-07): Update module github.com/moby/moby/api to v1.56.1 (@renovate[bot])
- **PR #19961** (closed): Update module github.com/klauspost/compress to v1.20.1 - autoclosed (@renovate[bot])
- **PR #19960** (2026-10-07): Update module github.com/go-openapi/strfmt to v0.27.3 (@renovate[bot])
- **PR #19958** (2026-10-07): Update Kubernetes Go dependencies to v0.37.1 (@renovate[bot])
- **PR #19956** (2026-10-07): Update dependency vite to v8.3.2 (@renovate[bot])
- **PR #19953** (2026-10-07): Update Azure Go dependencies (@renovate[bot])
- **PR #19952** (2026-10-07): Update AWS Go dependencies (@renovate[bot])
- **PR #19947** (2026-10-07): Update github.com/prometheus/client_golang/exp digest to de866d6 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

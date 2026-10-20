> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/prometheus-prometheus-learnings.md`  
> **Source**: github ([https://github.com/prometheus/prometheus](https://github.com/prometheus/prometheus))  
> **Source Version**: `afa1fdeb`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T21:40:52.808Z  
> **Learning ID**: `learn-github-prometheus-prometheus`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): prometheus/prometheus

> **Canonical Artifact**: `07_PROJECT_LEARNING/prometheus-prometheus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/prometheus/prometheus](https://github.com/prometheus/prometheus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T21:40:52.800Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `prometheus/prometheus`
- **Description**: The Prometheus monitoring system and time series database.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 66665 stars

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
	queryRejectedTotal        *prometheus.CounterVec
	querySeriesTouched        prometheus.Histogram
	querySamplesReadHistogram prometheus.Histogram
}

type (
	// ErrQueryTimeout is returned if a query timed out during processing.
	ErrQueryTimeout string
	// ErrQueryCanceled is returned if a query was canceled during processing.
	ErrQueryCanceled string
	// ErrTooManySamples is returned if a query would load more than the maximum allowed samples into memory.
	ErrTooManySamples string
	// ErrTooManySeries is returned if a query would load more than the maximum allowed series into memory.
	ErrTooManySeries string
	// ErrTooManySamplesRead is returned if a query would read more than the maximum allowed samples.
	ErrTooManySamplesRead string
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

// Error implements the error interface.
func (e ErrTooManySeries) Error() string {
	return fmt.Sprintf("query would load too many series into memory in %s", string(e))
}

// Error implements the error interface.
func (e ErrTooManySamplesRead) Error() string {
	return fmt.Sprintf("query would read too many samples in %s", string(e))
}

func (e ErrStorage) Error() string {
	return e.Err.Error()
}

// ErrLimitAboveCeiling is returned when a per-query limit override asks for a
// value above the operator-set ceiling for that limit. A per-query override may
// only tighten a ceiling, so such a request is rejected rather than silently
// clamped down, making it clear to the caller that the limit it asked for was
// not applied. Callers exposing the engine over an API should map it to a
// client error, e.g. HTTP 400.
type ErrLimitAboveCeiling struct {
	// Limit is the name of the limit as the client spells it, e.g. "max_series".
	Limit string
	// Requested is the value the client asked for, already formatted for display.
	Requested string
	// Ceiling is the operator-set ceiling that the request exceeded, already
	// formatted for display.
	Ceiling string
}

// Error implements the error interface.
func (e ErrLimitAboveCeiling) Error() string {
	return fmt.Sprintf("requested %s of %s exceeds the server limit of %s", e.Limit, e.Requested, e.Ceiling)
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
	// Per-query override for the maximum number of series the query may touch.
	// Zero means no per-query override. It can only lower the operator-set
	// ceiling, never raise it. It is only honored when the query-cost feature
	// is enabled.
	maxSeries uint64
	// Per-query override for the maximum number of samples the query may read.
	// Zero means no per-query override. It can only lower the operator-set
	// ceiling, never raise it. It is only honored when the query-cost feature
	// is enabled.
	maxSamplesRead uint64
	// Per-query override for the maximum wall-clock duration of the query.
	// Zero means no per-query override. It can only lower the operator-set
	// ceiling, never raise it. It is only honored when the query-cost feature
	// is enabled.
	maxQueryDuration time.Duration
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

// NewPrometheusQueryOptsWithLimits returns a QueryOpts that also carries
// per-query cost-limit overrides. The limit overrides may only lower the
// operator-set ceiling and are only honored when the query-cost feature is
// enabled.
func NewPrometheusQueryOptsWithLimits(enablePerStepStats bool, lookbackDelta time.Duration, maxSeries, maxSamplesRead uint64, maxQueryDuration time.Duration, useStartTimestamps *bool) QueryOpts {
	opts := NewPrometheusQueryOpts(enablePerStepStats, lookbackDelta, useStartTimestamps).(*PrometheusQueryOpts)
	opts.maxSeries = maxSeries
	opts.maxSamplesRead = maxSamplesRead
	opts.maxQueryDuration = maxQueryDuration
	return opts
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

// PrometheusQueryOpts carries the per-query cost overrides, so it satisfies
// QueryCostOpts as well as QueryOpts.
var _ QueryCostOpts = &PrometheusQueryOpts{}

// MaxSeries returns the per-query series limit override.
func (p *PrometheusQueryOpts) MaxSeries() uint64 {
	return p.maxSeries
}

// MaxSamplesRead returns the per-query sample read limit override.
func (p *PrometheusQueryOp
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
	"encoding/binary"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"slices"
	"strconv"
	"sync"
	"time"
	"unique"

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
	"github.com/prometheus/prometheus/model/value"
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
	reasonNHCBConversionError        = "nhcb_to_classic_conversion_error"
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
		Help:        "Total number of metadata entries sent to remote storage. Deprecated: This metric only applies to Remote Write 1.0.",
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
		Help:        "Total number of metadata entries which failed on send to remote storage, non-recoverable errors. Deprecated: This metric only applies to Remote Write 1.0.",
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
		Help:        "Total number of metadata entries which failed on send to remote storage but were retried because the send error was recoverable. Deprecated: This metric only applies to Remote Write 1.0.",
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
	m.highestTimestamp = &maxT
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #20089** (2026-10-20): **feat(config/promql): add default label_value_length_limit and validation**
  *Symptoms*: Implements #16525: Set and check (and document) a global label_value_length_limit  ## Summary  Adds a default `label_value_length_limit` of 200 bytes and validation in PromQL functions.  ## Changes  1. **config/config.go**: Added `LabelValueLengthLimit: 200` to `DefaultGlobalConfig` 2. **promql/functions.go**:     - Added `DefaultLabelValueLengthLimit = 200` constant    - Added validation in `label_replace()` to enforce limit    - Added validation in `label_join()` to enforce limit  ## Testing  - `go build ./promql/...` ✅ - `go build ./config/...` ✅   - `go build ./scrape/...` ✅ - `go test ./scrape/...` - All tests pass ✅  Closes #16525.
  **Post-Mortem & Fix Analysis**:
  > Thanks!  This does not belong to PromQL but it belongs to scrape. And we already have label_name_length_limit and label_value_length_limit, hence I am closing this pull request.

- **Issue #20083** (2026-10-19): **docs: remove retired v3 release coordinators**
  *Symptoms*: Remove the retired Prometheus v3 release-coordinator roster from `MAINTAINERS.md`, following removal of the coordination team in prometheus/org-infra#139. The general and component-maintainer entries remain intact; `CODEOWNERS` has no corresponding coordinator entry to remove.  Validation: `git diff --check` and `make lint` pass.  ```release-notes NONE ``` 

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

### Incident Patch 1: `80cd8d97` (2026-10-15)
**Commit Message**: web/api: fix query cost timeout handling, feature discovery and docs

With query-cost enabled, the engine's deadline also covers waiting for a
concurrency slot while the query is built. A query that timed out or was
canceled there was reported as 400 bad_data `invalid parameter "query"`;
report it as a timeout or a cancellation instead.

Cap a `timeout` above the effective duration ceiling instead of rejecting
it, as before the feature. The rejection also fired against
--query.timeout when query_max_duration was unset, contrary to the docs.
The new max_* parameters keep rejecting values above their ceilings.
Reject a negative max_query_duration, which was silently ignored.

For cost=true, estimate after building the query and before executing
it. The estimation then counts against the query's duration limit, so
the request no longer takes up to twice that limit, a malformed query
fails before waiting for an estimation slot, and no finished result is
held in memory while the estimation waits for a slot.

Advertise the feature as `query_cost` in /api/v1/features, since the
per-query overrides are silently ignored when it is off. Document that
the limits apply to rule evaluation, that

**File**: `cmd/prometheus/main_test.go` (modified, +116/-0)
```diff
@@ -16,12 +16,14 @@ package main
 import (
 	"bytes"
 	"context"
+	"encoding/json"
 	"errors"
 	"fmt"
 	"io"
 	"math"
 	"net/http"
 	"net/http/httptest"
+	"net/url"
 	"os"
 	"os/exec"
 	"path/filepath"
@@ -1028,6 +1030,120 @@ runtime:
 	}
 }
 
+// TestQueryCostLimitsConfig verifies that the query cost limits in the
+// configuration file apply to queries only with the query-cost feature
+// enabled, and that a reload updates them.
+func TestQueryCostLimitsConfig(t *testing.T) {
+	if testing.Short() {
+		t.Skip("skipping test in short mode.")
+	}
+	t.Parallel()
+
+	type queryResponse struct {
+		ErrorType string `json:"errorType"`
+		Error     string `json:"error"`
+		Data      struct {
+			Result []json.RawMessage `json:"result"`
+		} `json:"data"`
+	}
+
+	for _, tc := range []struct {
+		name    string
+		enabled bool
+	}{
+		{name: "feature enabled", enabled: true},
+		{name: "feature disabled"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+
+			tmpDir := t.TempDir()
+			configFile := filepath.Join(tmpDir, "prometheus.yml")
+			port := testutil.RandomUnprivilegedPort(t)
+			// Prometheus scrapes itself, so the query below soon matches two
+			// series, one more than the configured limit.
+			writeConfig := func(maxSeries int) {
+				cfg := fmt.Sprintf(`
+global:
+  scrape_interval: 100ms
+  query_max_series: %d
+scrape_configs:
+  - job_name: prometheus
+    static_configs:
+      - targets: ['127.0.0.1:%d']
+`, maxSeries, port)
+				require.NoError(t, os.WriteFile(configFile, []byte(cfg), 0o644))
+			}
+			writeConfig(1)
+
+			args := []string{
+				fmt.Sprintf("--storage.tsdb.path=%s", tmpDir),
+				"--web.enable-lifecycle",
+				"--scrape.discovery-reload-interval=100ms", // Reduce initial wait time from default of 5 seconds.
+			}
+			if tc.enabled {
+				args = append(args, "--enable-feature=query-cost")
+			}
+			prom := prometheusCommandWithLogging(t, configFile, port, args...)
+			require.NoError(t, prom.Start())
+			waitForPrometheusReady(t, port)
+
+			query := func(extra ...string) (int, queryResponse, error) {
+				params := url.Values{"query": {`{__name__=~"up|scrape_duration_seconds"}`}}
+				for i := 0; i+1 < len(extra); i += 2 {
+					params.Set(extra[i], extra[i+1])
+				}
+				var body queryResponse
+				resp, err := http.PostForm(fmt.Sprintf("http://127.0.0.1:%d/api/v1/query", port), params)
+				if err != nil {
+					return 0, body, err
+				}
+				defer resp.Body.Close()
+				err = json.NewDecoder(resp.Body).Decode(&body)
+				return resp.StatusCode, body, err
+			}
+			// waitForQuery waits until both series have been scraped and the
+			// query gets the expected status.
+			waitForQuery := func(wantStatus int, extra ...string) queryResponse {
+				t.Helper()
+				var last queryResponse
+				require.Eventually(t, func() bool {
+					status, body, err := query(extra...)
+					if err != nil {
+						return false
+					}
+					last = body
+					if status == http.StatusOK {
+						return wantStatus == http.StatusOK && len(body.Data.Result) == 2
+					}
+					return status == wantStatus
+				}, readyTimeout, 100*time.Millisecond)
+				return last
+			}
+
+			if !tc.enabled {
+				waitForQuery(http.StatusOK)
+				return
+			}
+
+			rejected := waitForQuery(http.StatusUnprocessableEntity)
+			require.Equal(t, "cost_limit", rejected.ErrorType)
+			// The samples-read limit also reports cost_limit, so check that the
+			// configured series limit is the one that applied.
+			require.Contains(t, rejected.Error, "too many series")
+			// A request may only lower the configured ceiling.
+			status, body, err := query("max_series", "2")
+			require.NoError(t, err)
+			require.Equal(t, http.StatusBadRequest, status)
+			require.Equal(t, "bad_data", body.ErrorType)
+
+			writeConfig(0)
+			reloadPrometheusConfig(t, fmt.Sprintf("http://127.0.0.1:%d/-/reload", port))
+			waitForQuery(http.StatusOK)
+		})
+	}
+}
+
 func TestReloadConfigLogLevel(t *testing.T) {
 	tmpDir := t.TempDir()
 	configFile := filepath.Join(tmpDir, "prometheus.yml")
```

**File**: `cmd/prometheus/testdata/features.json` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@
     "openapi_3.1": true,
     "openapi_3.2": true,
     "otlp_write_receiver": false,
+    "query_cost": false,
     "query_stats": true,
     "query_warnings": true,
     "remote_write_receiver": false,
```

**File**: `docs/configuration/configuration.md` (modified, +4/-3)
```diff
@@ -101,6 +101,8 @@ global:
   # rejected as soon as it loads more series than this. 0 means no limit.
   # These three query cost limits are reloadable and only enforced when the
   # query-cost feature flag is enabled (--enable-feature=query-cost).
+  # They apply to every query the engine evaluates, including recording and
+  # alerting rule evaluation.
   # A client may lower any of them for a single request with the max_series,
   # max_samples_read and max_query_duration query parameters. A request that
   # asks for a value above the ceiling set here is an error, it is not silently
@@ -109,16 +111,15 @@ global:
 
   # Maximum number of samples a query may read before it is rejected. Like
   # query_max_series, it is enforced during execution against the samples the
-  # query actually reads from storage, never against the estimate: the query is
+  # query actually reads, never against the estimate: the query is
   # rejected as soon as it reads more samples than this. 0 means no limit.
   [ query_max_samples_read: <int> | default = 0 ]
 
   # Maximum wall-clock duration a query may take. It surfaces as a query
   # timeout: the query is aborted once it has run for this long. 0s falls back
   # to --query.timeout. A nonzero value overrides that flag only when the
   # query-cost feature is enabled. The per-query timeout parameter
-  # of the query endpoints is bounded by this ceiling in the same way: a larger
-  # value is an error.
+  # of the query endpoints is capped at this ceiling.
   [ query_max_duration: <duration> | default = 0s ]
 
   # File to which scrape failures are logged.
```

**File**: `docs/feature_flags.md` (modified, +14/-4)
```diff
@@ -45,7 +45,7 @@ When enabled, passing `stats=all` in a query request returns per-step
 statistics. The following sample statistics are included:
 
 - **totalQueryableSamples** / **totalQueryableSamplesPerStep**: Total number of samples *loaded* during the query. For range-vector functions (e.g. `rate`, `sum_over_time`) evaluated over multiple steps, each step counts the full window (the same point may be counted in multiple steps).
-- **samplesRead** / **samplesReadPerStep**: Total number of samples *read* (I/O). For range-vector functions in range queries, only *new* points per step are counted (step 0: full window; later steps: points not seen in the previous step). For other query types, this equals totalQueryableSamples.
+- **samplesRead** / **samplesReadPerStep**: Total number of samples *read* by the evaluator (its input, not physical storage I/O). For range-vector functions in range queries, only *new* points per step are counted (step 0: full window; later steps: points not seen in the previous step). See [Query statistics](querying/api.md#query-statistics) for the exact semantics.
 - **peakSamples**: Peak number of samples in memory during evaluation (used for the `query.max-samples` limit).
 
 The Prometheus server exposes two counters for observability: `prometheus_engine_query_samples_total` (logical underlying sample consumption, full window per step) and `prometheus_engine_query_samples_read_total` (samples read, delta per step for range-vector).
@@ -401,11 +401,21 @@ of samples it reads exceeds the configured limit, and `query_max_duration`
 surfaces as a query timeout. The limits are reloaded together with the rest of
 the configuration and have no effect when the feature flag is not set.
 
+These limits apply to every query the engine evaluates, not only to API
+requests. Recording and alerting rules are subject to them too: a rule whose
+query exceeds a limit fails to evaluate like any other query error, and
+`query_max_duration` replaces `--query.timeout` as the timeout of rule queries.
+
 A client may lower any of these ceilings for a single request with the
-`max_series`, `max_samples_read`, `max_query_duration` and `timeout` query
-parameters. A request asking for a value above the operator-set ceiling is
-rejected with HTTP 400 (`bad_data`) rather than silently clamped.
+`max_series`, `max_samples_read` and `max_query_duration` query parameters. A
+request asking for a value above the operator-set ceiling is rejected with HTTP
+400 (`bad_data`) rather than silently clamped. For `max_query_duration`, the
+ceiling is `--query.timeout` while `query_max_duration` is unset. A `timeout`
+parameter above the effective duration ceiling is capped at that ceiling.
 
 `query_max_duration` overrides `--query.timeout` only while this feature flag is
 enabled. The command-line flag remains supported and controls the timeout when
 the feature is disabled or `query_max_duration` is unset.
+
+Clients can detect the feature through [`/api/v1/features`](querying/api.md#features),
+where it is reported as `query_cost` in the `api` category.
```

**File**: `docs/querying/api.md` (modified, +54/-34)
```diff
@@ -98,19 +98,18 @@ URL query parameters:
 
 - `query=<string>`: Prometheus expression query string.
 - `time=<rfc3339 | unix_timestamp>`: Evaluation timestamp. Optional.
-- `timeout=<duration>`: Evaluation timeout. Optional. Defaults to the effective
-   server-side maximum, which is the `query_max_duration` configuration option
-   when the query-cost feature is enabled and the value is set, and otherwise
-   the value of the `-query.timeout` flag. With the [`query-cost`](../feature_flags.md#query-cost) feature flag
-   enabled and `query_max_duration` set, a `timeout` above that ceiling is
-   rejected with HTTP 400 (`bad_data`) instead of being silently lowered.
+- `timeout=<duration>`: Evaluation timeout. Optional. Must be positive. Defaults
+   to and is capped by the effective server-side maximum, which is the
+   `query_max_duration` configuration option when the
+   [`query-cost`](../feature_flags.md#query-cost) feature flag is enabled and
+   the value is set, and otherwise the value of the `-query.timeout` flag.
 - `limit=<number>`: Maximum number of returned series. Doesn't affect scalars or strings but truncates the number of series for matrices and vectors. Optional. 0 means disabled.
 - `lookback_delta=<duration | float>`: Override the [lookback period](#staleness) just for this query in `duration` format or float number of seconds. Optional.
 - `stats=<string>`: Include query statistics in the response. Supported values are `true` (basic statistics) and `all` (additionally includes detailed per-step statistics: timings and sample counts). Any other non-empty value currently behaves like `true`, but is deprecated, adds a warning to the response, and will be rejected in the next major release. Optional. See [Query statistics](#query-statistics).
 - `cost=<bool>`: Include an estimated-versus-actual cost comparison in the response `data`. Optional. Ignored unless the [`query-cost`](../feature_flags.md#query-cost) feature flag is enabled. It is a plain on/off switch: any value that is not a boolean is an error. See [Query statistics](#query-statistics).
 - `max_series=<number>`: Lower the per-query maximum number of series this query may load. Optional. Ignored unless the [`query-cost`](../feature_flags.md#query-cost) feature flag is enabled. It may only *lower* the operator-set ceiling configured via `query_max_series`, never raise it: a higher value is rejected with HTTP 400 (`bad_data`) rather than silently clamped.
 - `max_samples_read=<number>`: Lower the per-query maximum number of samples this query may read. Optional. Ignored unless the [`query-cost`](../feature_flags.md#query-cost) feature flag is enabled. It may only *lower* the operator-set ceiling configured via `query_max_samples_read`, never raise it: a higher value is rejected with HTTP 400 (`bad_data`) rather than silently clamped.
-- `max_query_duration=<duration>`: Lower the per-query maximum execution duration. Optional. Ignored unless the [`query-cost`](../feature_flags.md#query-cost) feature flag is enabled. It may only *lower* the operator-set ceiling configured via `query_max_duration`, never raise it: a higher value is rejected with HTTP 400 (`bad_data`) rather than silently clamped.
+- `max_query_duration=<duration>`: Lower the per-query maximum execution duration. Optional. Ignored unless the [`query-cost`](../feature_flags.md#query-cost) feature flag is enabled. It may only *lower* the effective duration ceiling, which is `query_max_duration` when set and otherwise the `-query.timeout` flag, never raise it: a higher value is rejected with HTTP 400 (`bad_data`) rather than silently clamped.
 
 Optional HTTP request headers:
 
@@ -184,19 +183,18 @@ URL query parameters:
 - `start=<rfc3339 | unix_timestamp>`: Start timestamp, inclusive.
 - `end=<rfc3339 | unix_timestamp>`: End timestamp, inclusive.
 - `step=<duration | float>`: Query resolution step width in `duration` format or float number of seconds.
-- `timeout=<duration>`: Evaluation timeout. Optional. Defaults to the effective
-   server-side maximum, which is the `query_max_duration` configuration option
-   when the query-cost feature is enabled and the value is set, and otherwise
-   the value of the `-query.timeout` flag. With the [`query-cost`](../feature_flags.md#query-cost) feature flag
-   enabled and `query_max_duration` set, a `timeout` above that ceiling is
-   rejected with HTTP 400 (`bad_data`) instead of being silently lowered.
+- `timeout=<duration>`: Evaluation timeout. Optional. Must be positive. Defaults
+   to and is capped by the effective server-side maximum, which is the
+   `query_max_duration` configuration option when the
+   [`query-cost`](../feature_flags.md#query-cost) feature flag is enabled and
+   the value is set, and otherwise the value of the `-query.timeout` flag.
 - `limit=<number>`: Maximum number of returned series. Optional. 0 means disabled.
 - `lookback_delta=<duration | float>`: Override the [lookback period](#staleness) just
```

**File**: `web/api/v1/api.go` (modified, +79/-59)
```diff
@@ -113,7 +113,8 @@ var (
 	errorNotFound      = errorType{ErrorNotFound, "not_found"}
 	errorNotAcceptable = errorType{ErrorNotAcceptable, "not_acceptable"}
 	// errorCostLimit is returned when a query is rejected because it exceeds a
-	// configured query-cost limit (series, samples read, or duration).
+	// configured query-cost limit on series or samples read. A query stopped by
+	// the duration limit is a timeout instead.
 	errorCostLimit = errorType{ErrorCostLimit, "cost_limit"}
 )
 
@@ -659,6 +660,8 @@ func (api *API) query(r *http.Request) (result apiFuncResult) {
 		attribute.String("time", ts.Format(time.RFC3339Nano)),
 	)
 
+	// The query's duration limit starts while it is built.
+	limitStart := time.Now()
 	qry, err := api.QueryEngine.NewInstantQuery(ctx, api.Queryable, opts, r.FormValue("query"), ts)
 	if err != nil {
 		span.RecordError(err)
@@ -675,6 +678,14 @@ func (api *API) query(r *http.Request) (result apiFuncResult) {
 		}
 	}()
 
+	// Estimate after building, so that the estimation counts against the
+	// query's duration limit, and before executing, so that no finished result
+	// is held in memory while the estimation waits for a query slot.
+	var pendingCost pendingCostComparison
+	if costOn {
+		pendingCost = api.estimateForComparison(ctx, limitStart, r.FormValue("query"), ts, ts, 0, opts)
+	}
+
 	ctx = httputil.ContextFromRequest(ctx, r)
 
 	res := qry.Exec(ctx)
@@ -706,16 +717,7 @@ func (api *API) query(r *http.Request) (result apiFuncResult) {
 
 	var cost *QueryCostComparison
 	if costOn {
-		comparison, ca, err := api.costComparison(ctx, qry, r.FormValue("query"), ts, ts, 0, opts)
-		warnings = warnings.Merge(ca)
-		// The query already executed successfully. A failing estimate must never
-		// replace that result, so we surface the estimation error as a warning and
-		// return the query result without a cost comparison.
-		if err != nil {
-			warnings = warnings.Add(fmt.Errorf("cost estimation failed: %w", err))
-		} else {
-			cost = comparison
-		}
+		cost, warnings = pendingCost.finish(qry, warnings)
 	}
 
 	return apiFuncResult{&QueryData{
@@ -796,6 +798,9 @@ func (api *API) extractQueryOpts(r *http.Request) (promql.QueryOpts, error) {
 		if err != nil {
 			return nil, fmt.Errorf("error parsing max_query_duration: %w", err)
 		}
+		if parsed < 0 {
+			return nil, fmt.Errorf("error parsing max_query_duration: must not be negative, got %s", parsed)
+		}
 		maxQueryDuration = parsed
 	}
 
@@ -907,16 +912,11 @@ func (api *API) effectiveLookbackDelta(opts promql.QueryOpts) time.Duration {
 }
 
 // queryTimeout parses the per-query "timeout" parameter, returning zero when it
-// is absent. Like the other per-query cost overrides, a timeout may only lower
-// the operator-set query_max_duration ceiling: a request above it is rejected so
-// the caller can see that the timeout it asked for was not applied, rather than
-// being silently clamped. The timeout is applied as a context deadline instead
-// of through promql.QueryOpts, so the engine cannot enforce this itself. The
-// ceiling is query_max_duration when it is configured, and otherwise the
-// --query.timeout flag, which is the ceiling the engine falls back to.
-// A non-positive timeout is rejected rather than ignored, since it could only
-// ever produce an already-expired deadline.
-func (api *API) queryTimeout(r *http.Request) (time.Duration, *apiError) {
+// is absent. Unlike the per-query cost overrides, a timeout above the effective
+// query duration ceiling is not an error: the shorter deadline of that ceiling
+// still applies. A non-positive timeout is rejected, since it could only ever
+// produce an already-expired deadline.
+func (*API) queryTimeout(r *http.Request) (time.Duration, *apiError) {
 	v := r.FormValue("timeout")
 	if v == "" {
 		return 0, nil
@@ -928,42 +928,60 @@ func (api *API) queryTimeout(r *http.Request) (time.Duration, *apiError) {
 	if timeout <= 0 {
 		return 0, &apiError{errorBadData, fmt.Errorf("invalid parameter %q: timeout must be positive, got %s", "timeout", timeout)}
 	}
-	if _, _, ceiling := api.queryCostCeilings(); ceiling > 0 && timeout > ceiling {
-		return 0, &apiError{errorBadData, promql.ErrLimitAboveCeiling{
-			Limit:     "timeout",
-			Requested: timeout.String(),
-			Ceiling:   ceiling.String(),
-		}}
-	}
 	return timeout, nil
 }
 
-// queryConstructionError maps an error returned when building a query from an
-// API error. A per-query limit override above the operator-set ceiling is
-// reported as bad data with the engine's message, which names the limit, the
-// requested value and the ceiling; any other failure is a bad query parameter.
+// queryConstructionError maps an error returned when building a query to an API
+// error. A per-query limit override above the operator-set ceiling is reported
+// as bad data with the engine's message, which names the limit, the requested
+// value and the ceiling. Running out of time or being canceled, for example
+// while
```

**File**: `web/api/v1/api_test.go` (modified, +240/-78)
```diff
@@ -1360,6 +1360,27 @@ func testEndpoints(t *testing.T, api *API, tr *testTargetRetriever, testLabelAPI
 			},
 			errType: errorBadData,
 		},
+		// A non-positive timeout could only produce an already-expired deadline.
+		{
+			endpoint: api.query,
+			query: url.Values{
+				"query":   []string{"2"},
+				"time":    []string{"123.4"},
+				"timeout": []string{"0s"},
+			},
+			errType: errorBadData,
+		},
+		{
+			endpoint: api.queryRange,
+			query: url.Values{
+				"query":   []string{"time()"},
+				"start":   []string{"0"},
+				"end":     []string{"2"},
+				"step":    []string{"1"},
+				"timeout": []string{"-1"},
+			},
+			errType: errorBadData,
+		},
 		{
 			endpoint: api.query,
 			query: url.Values{
@@ -5192,7 +5213,9 @@ func TestGetRuleGroupNextToken(t *testing.T) {
 }
 
 // newQueryCostTestAPI builds an API wired to a small test storage with the
-// query-cost feature enabled (or disabled when enabled is false).
+// query-cost feature enabled (or disabled when enabled is false). As in
+// production, the flag enables the feature in both the API and the engine; the
+// engine has no query-cost limits until a test sets them.
 func newQueryCostTestAPI(t *testing.T, enabled, isAgent bool) *API {
 	t.Helper()
 	s := promqltest.LoadedStorage(t, `
@@ -5205,8 +5228,16 @@ func newQueryCostTestAPI(t *testing.T, enabled, isAgent bool) *API {
 
 	now := time.Now()
 	return &API{
-		Queryable:       s,
-		QueryEngine:     testEngine(t),
+		Queryable: s,
+		QueryEngine: promqltest.NewTestEngineWithOpts(t, promql.EngineOpts{
+			MaxSamples:               10000,
+			Timeout:                  100 * time.Second,
+			NoStepSubqueryIntervalFn: func(int64) int64 { return 60 * 1000 },
+			EnableAtModifier:         true,
+			EnableNegativeOffset:     true,
+			EnablePerStepStats:       true,
+			EnableQueryCost:          enabled,
+		}),
 		now:             func() time.Time { return now },
 		config:          func() config.Config { return samplePrometheusCfg },
 		ready:           func(f http.HandlerFunc) http.HandlerFunc { return f },
@@ -5344,6 +5375,11 @@ func TestQueryCostEndpointParameterParity(t *testing.T) {
 		// A malformed expression is a client error on /query, so it must be one
 		// here too rather than looking like an execution failure.
 		{name: "malformed query", params: []string{"query", "up{"}, errType: errorBadData},
+		// A non-positive timeout could only produce an already-expired deadline.
+		{name: "zero timeout", params: []string{"timeout", "0s"}, errType: errorBadData},
+		{name: "negative timeout", params: []string{"timeout", "-1"}, errType: errorBadData},
+		// Zero means no override, but a negative duration is never valid.
+		{name: "negative max_query_duration", params: []string{"max_query_duration", "-1"}, errType: errorBadData},
 	} {
 		t.Run(tc.name, func(t *testing.T) {
 			for _, ep := range queryCostEndpoints(api) {
@@ -5555,21 +5591,10 @@ func TestQueryCostOverrideParams(t *testing.T) {
 // Entity, for both the series and the scanned-samples limit, on the instant and
 // the range query handlers.
 func TestQueryCostLimitExceeded(t *testing.T) {
-	// The engine only enforces the reloadable query-cost limits when query-cost
-	// enforcement is enabled, so we build a dedicated cost-enabled engine here
-	// rather than reusing testEngine.
 	newAPI := func(t *testing.T, maxSeries, maxSamplesRead uint64) *API {
 		t.Helper()
 		api := newQueryCostTestAPI(t, true, false)
-		eng := promqltest.NewTestEngineWithOpts(t, promql.EngineOpts{
-			MaxSamples:               10000,
-			Timeout:                  100 * time.Second,
-			NoStepSubqueryIntervalFn: func(int64) int64 { return 60 * 1000 },
-			EnablePerStepStats:       true,
-			EnableQueryCost:          true,
-		})
-		eng.SetQueryLimits(maxSeries, maxSamplesRead, 0)
-		api.QueryEngine = eng
+		api.QueryEngine.(*promql.Engine).SetQueryLimits(maxSeries, maxSamplesRead, 0)
 		return api
 	}
 
@@ -5745,7 +5770,6 @@ func TestQueryCostOverrideAboveCeilingRejected(t *testing.T) {
 		{limit: "max_series", above: "11", atCeiling: "10"},
 		{limit: "max_samples_read", above: "101", atCeiling: "100"},
 		{limit: "max_query_duration", above: "31s", atCeiling: "30s"},
-		{limit: "timeout", above: "31s", atCeiling: "30s"},
 	} {
 		t.Run(tc.limit, func(t *testing.T) {
 			api := newAPI(t)
@@ -5787,14 +5811,7 @@ func TestQueryCostOverrideAboveCeilingRejected(t *testing.T) {
 		// max_series of 1 must reject the query even though the operator ceiling
 		// of 10 would allow it.
 		api := newAPI(t)
-		eng := promqltest.NewTestEngineWithOpts(t, promql.EngineOpts{
-			MaxSamples:               10000,
-			Timeout:                  100 * time.Second,
-			NoStepSubqueryIntervalFn: func(int64) int64 { return 60 * 1000 },
-			EnableQueryCost:          true,
-		})
-		eng.SetQueryLimits(seriesCeiling, samplesCeiling, 0)
-		api.QueryEngine = eng
+		api.QueryEngine.(*promql.Engine).SetQueryLimits(seriesCeiling, samplesCeiling, 0)
 
 		for _, ep := range queryCost
```

**File**: `web/api/v1/errors_test.go` (modified, +24/-0)
```diff
@@ -100,6 +100,30 @@ func TestApiStatusCodes(t *testing.T) {
 			expectedString: "context canceled",
 			expectedCode:   statusClientClosedConnection,
 		},
+
+		"promql.ErrTooManySeries": {
+			err:            promql.ErrTooManySeries("some error"),
+			expectedString: `"errorType":"cost_limit"`,
+			expectedCode:   http.StatusUnprocessableEntity,
+		},
+
+		"promql.ErrTooManySamplesRead": {
+			err:            promql.ErrTooManySamplesRead("some error"),
+			expectedString: `"errorType":"cost_limit"`,
+			expectedCode:   http.StatusUnprocessableEntity,
+		},
+
+		"overridden error code for cost limit": {
+			err:            promql.ErrTooManySeries("some error"),
+			expectedString: "too many series",
+			overrideErrorCode: func(errNum errorNum, _ error) (code int, override bool) {
+				if errNum == ErrorCostLimit {
+					return 999, true
+				}
+				return 0, false
+			},
+			expectedCode: 999,
+		},
 	} {
 		for k, q := range map[string]storage.SampleAndChunkQueryable{
 			"error from queryable": errorTestQueryable{err: tc.err},
```

---

### Incident Patch 2: `4949f15d` (2026-08-13)
**Commit Message**: Fix template injection https://docs.zizmor.sh/audits/#template-injection

Signed-off-by: Arthur Silva Sens <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +3/-1)
```diff
@@ -97,7 +97,9 @@ jobs:
       - uses: prometheus/promci-setup@55bd31fe92710532260eb57c554f2697363285c5 # v0.2.2
         with:
           cache_key_suffix: upgrade
-      - run: go test -v --race ./cmd/prometheus/ --test.version-upgrade=true --test.lts-version=${{ matrix.lts_version }} -run TestVersionUpgrade
+      - run: go test -v --race ./cmd/prometheus/ --test.version-upgrade=true --test.lts-version="${LTS_VERSION}" -run TestVersionUpgrade
+        env:
+          LTS_VERSION: ${{ matrix.lts_version }}
 
   list_oldest_go_version:
     name: List the oldest supported Go version
```

---

### Incident Patch 3: `a532cdae` (2026-08-13)
**Commit Message**: Enforce GitHub Action security across all repositories in the Prometheus org

Signed-off-by: Arthur Silva Sens <[REDACTED_EMAIL]>

**File**: `.github/workflows/zizmor.yml` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+---
+###
+# This action is synced from https://github.com/prometheus/prometheus
+###
+name: GitHub Actions Security
+
+on:
+  pull_request:
+  push:
+    branches:
+      - main
+      - master
+
+permissions:
+  contents: read
+  actions: read
+
+jobs:
+  zizmor:
+    name: Run zizmor
+    runs-on: ubuntu-latest
+    timeout-minutes: 5
+
+    steps:
+      - name: Checkout
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          persist-credentials: false
+
+      - name: Run zizmor
+        uses: zizmorcore/zizmor-action@3dc1ecc9bcb9e94e9b2c709687979e1298497054 # v0.6.2
+        with:
+          advanced-security: false
+          version: 1.29.0
```

**File**: `scripts/dependabot.yml` (modified, +1/-0)
```diff
@@ -42,3 +42,4 @@ updates:
       - .github/workflows/govulncheck.yml
       - .github/workflows/scorecards.yml
       - .github/workflows/stale.yml
+      - .github/workflows/zizmor.yml
```

**File**: `scripts/sync_repo_files.sh` (modified, +2/-2)
```diff
@@ -64,7 +64,7 @@ for org in ${orgs}; do
 done
 
 # List of files that should be synced.
-SYNC_FILES="CODE_OF_CONDUCT.md LICENSE Makefile.common SECURITY.md .dockerignore .yamllint scripts/dependabot.yml scripts/golangci-lint.yml .github/workflows/approve-workflows.yml .github/workflows/govulncheck.yml .github/workflows/scorecards.yml .github/workflows/container_description.yml .github/workflows/stale.yml"
+SYNC_FILES="CODE_OF_CONDUCT.md LICENSE Makefile.common SECURITY.md .dockerignore .yamllint scripts/dependabot.yml scripts/golangci-lint.yml .github/workflows/approve-workflows.yml .github/workflows/govulncheck.yml .github/workflows/scorecards.yml .github/workflows/container_description.yml .github/workflows/stale.yml .github/workflows/zizmor.yml"
 
 # Go to the root of the repo
 cd "$(git rev-parse --show-cdup)" || exit 1
@@ -238,7 +238,7 @@ process_repo() {
     if [[ -z "${target_file}" ]]; then
       repo_log "${target_filename} doesn't exist in ${org_repo}"
       case "${source_file}" in
-        CODE_OF_CONDUCT.md | SECURITY.md | .dockerignore | .github/workflows/approve-workflows.yml | .github/workflows/container_description.yml | .github/workflows/govulncheck.yml)
+        CODE_OF_CONDUCT.md | SECURITY.md | .dockerignore | .github/workflows/approve-workflows.yml | .github/workflows/container_description.yml | .github/workflows/govulncheck.yml | .github/workflows/zizmor.yml)
           repo_log_yellow "${source_file} missing in ${org_repo}, force updating."
           needs_update+=("${source_file}")
           ;;
```

#### Recent Merged Pull Requests:
- **PR #20089** (closed): feat(config/promql): add default label_value_length_limit and validation (@masyarakatai)
- **PR #20083** (2026-10-19): docs: remove retired v3 release coordinators (@ArthurSens)
- **PR #20080** (2026-10-20): storage/remote: stop exposing legacy metadata metrics for RW2 (@shilohlee98)
- **PR #20053** (2026-10-20): docs: document missing kubernetes_sd_config meta labels (@kamothi)
- **PR #20050** (closed): promtool: honor --enable-feature=promql-experimental-functions in test rules (@xingzihai)
- **PR #20046** (2026-10-20): promtool: evaluate rule unit tests with the configured parser (@dennisme)

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

## X. web/api: fix query cost timeout handling, feature discovery and docs

**RULE**:
When implementing operations in `cmd/prometheus/main_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in prometheus/prometheus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `80cd8d97`: web/api: fix query cost timeout handling, feature discovery and docs. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/prometheus/main_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"encoding/json"
	"net/url"
// TestQueryCostLimitsConfig verifies that the query cost limits in the
// configuration file apply to queries only with the query-cost feature
// enabled, and that a reload updates them.
func TestQueryCostLimitsConfig(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode.")
	}
	t.Parallel()

	type queryResponse struct {
		ErrorType string `json:"errorType"`
		Error     string `json:"error"`
		Data      struct {
			Result []json.RawMessage `json:"result"`
		} `json:"data"`
	}

	for _, tc := range []struct {
		name    string
		enabled bool
	}{
		{name: "feature enabled", enabled: true},
		{name: "feature disabled"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			tmpDir := t.TempDir()
			configFile := filepath.Join(tmpDir, "prometheus.yml")
			port := testutil.RandomUnprivilegedPort(t)
			// Prometheus scrapes itself, so the query below soon matches two
			// series, one more than the configured limit.
			writeConfig := func(maxSeries int) {
				cfg := fmt.Sprintf(`
global:
  scrape_interval: 100ms
  query_max_series: %d
scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ['127.0.0.1:%d']
`, m
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `80cd8d97` are properly handled with clean fallback behavior.

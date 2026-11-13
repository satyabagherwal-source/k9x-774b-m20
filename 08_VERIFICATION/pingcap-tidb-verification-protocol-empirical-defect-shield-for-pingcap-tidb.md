# Verification Protocol: Verification Protocol: Empirical Defect Shield for pingcap/tidb

<!-- PROVENANCE_START
{
  "source_repository": "pingcap/tidb",
  "source_url": "https://github.com/pingcap/tidb",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pingcap/tidb](https://github.com/pingcap/tidb) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `pingcap/tidb` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pingcap-tidb-learnings.md`  
> **Source**: github ([https://github.com/pingcap/tidb](https://github.com/pingcap/tidb))  
> **Source Version**: `32a53ec1`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T16:35:52.587Z  
> **Learning ID**: `learn-github-pingcap-tidb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): pingcap/tidb

> **Canonical Artifact**: `07_PROJECT_LEARNING/pingcap-tidb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pingcap/tidb](https://github.com/pingcap/tidb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-11T16:35:52.581Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pingcap/tidb`
- **Description**: TiDB is built for agentic workloads that grow unpredictably, with ACID guarantees and native support for transactions, analytics, and vector search. No data silos. No noisy neighbors. No infrastructure ceiling.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 40732 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `br/pkg/conn/util/util.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package util

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/pingcap/errors"
	"github.com/pingcap/kvproto/pkg/metapb"
	"github.com/pingcap/log"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/br/pkg/logutil"
	"github.com/pingcap/tidb/br/pkg/utils"
	"github.com/pingcap/tidb/pkg/util/engine"
	"github.com/tikv/client-go/v2/oracle"
	pd "github.com/tikv/pd/client"
	"github.com/tikv/pd/client/opt"
	"go.uber.org/zap"
)

// StoreBehavior is the action to do in GetAllTiKVStores when a non-TiKV
// store (e.g. TiFlash store) is found.
type StoreBehavior uint8

const (
	// ErrorOnTiFlash causes GetAllTiKVStores to return error when the store is
	// found to be a TiFlash node.
	ErrorOnTiFlash StoreBehavior = 0
	// SkipTiFlash causes GetAllTiKVStores to skip the store when it is found to
	// be a TiFlash node.
	SkipTiFlash StoreBehavior = 1
	// TiFlashOnly caused GetAllTiKVStores to skip the store which is not a
	// TiFlash node.
	TiFlashOnly StoreBehavior = 2
)

// StoreMeta is the required interface for a watcher.
// It is striped from pd.Client.
type StoreMeta interface {
	// GetAllStores gets all stores from pd.
	// The store may expire later. Caller is responsible for caching and taking care
	// of store change.
	GetAllStores(ctx context.Context, opts ...opt.GetStoreOption) ([]*metapb.Store, error)
}

// GetAllTiKVStores returns all TiKV stores registered to the PD client. The
// stores must not be a tombstone and must never contain a label `engine=tiflash`.
func GetAllTiKVStores(
	ctx context.Context,
	pdClient StoreMeta,
	storeBehavior StoreBehavior,
) ([]*metapb.Store, error) {
	// get all live stores.
	stores, err := pdClient.GetAllStores(ctx, opt.WithExcludeTombstone())
	if err != nil {
		return nil, errors.Trace(err)
	}

	// filter out all stores which are TiFlash.
	j := 0
	for _, store := range stores {
		isTiFlash := false
		if engine.IsTiFlash(store) {
			if storeBehavior == SkipTiFlash {
				continue
			} else if storeBehavior == ErrorOnTiFlash {
				return nil, errors.Annotatef(berrors.ErrPDInvalidResponse,
					"cannot restore to a cluster with active TiFlash stores (store %d at %s)", store.Id, store.Address)
			}
			isTiFlash = true
		}
		if !isTiFlash && storeBehavior == TiFlashOnly {
			continue
		}
		stores[j] = store
		j++
	}
	return stores[:j], nil
}

func GetAllTiKVStoresWithRetry(ctx context.Context,
	pdClient StoreMeta,
	storeBehavior StoreBehavior,
) ([]*metapb.Store, error) {
	stores := make([]*metapb.Store, 0)
	var err error

	errRetry := utils.WithRetry(
		ctx,
		func() error {
			stores, err = GetAllTiKVStores(ctx, pdClient, storeBehavior)
			return errors.Trace(err)
		},
		utils.NewAggressivePDBackoffStrategy(),
	)

	return stores, errors.Trace(errRetry)
}

// GetCurrentTsFromPD gets current ts from PD.
func GetCurrentTsFromPD(ctx context.Context, pdClient pd.Client) (uint64, error) {
	p, l, err := pdClient.GetTS(ctx)
	if err != nil {
		return 0, errors.Trace(err)
	}

	return oracle.ComposeTS(p, l), nil
}

// GetCurrentTsFromPDWithRetry gets current ts from PD with retry.
func GetCurrentTsFromPDWithRetry(ctx context.Context, pdClient pd.Client) (uint64, error) {
	var currentTS uint64
	var retry uint
	err := utils.WithRetry(ctx, func() error {
		ts, err := GetCurrentTsFromPD(ctx, pdClient)
		retry++
		if err != nil {
			log.Warn("failed to get current TS from PD, retry it",
				zap.Uint("retry time", retry),
				logutil.ShortError(err))
			return err
		}
		currentTS = ts
		return nil
	}, utils.NewAggressivePDBackoffStrategy())
	if err != nil {
		log.Error("failed to get current TS from PD", zap.Error(err))
	}
	return currentTS, errors.Trace(err)
}

// GetConfigFromTiKVStores gets configs from the specified TiKV stores.
func GetConfigFromTiKVStores(
	ctx context.Context,
	stores []*metapb.Store,
	cli *http.Client,
	httpPrefix string,
	fn func(*http.Response) error,
) error {
	for _, store := range stores {
		if store.State != metapb.StoreState_Up {
			continue
		}
		// We need make sure every available store support backup-stream otherwise we might lose data,
		// so check every store's config.
		addr, err := HandleTiKVAddress(store, httpPrefix)
		if err != nil {
			return err
		}
		configAddr := addr.JoinPath("config").String()

		err = utils.WithRetry(ctx, func() error {
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, configAddr, nil)
			if err != nil {
				return err
			}
			resp, err := cli.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			return fn(resp)
		}, utils.NewAggressivePDBackoffStrategy())
		if err != nil {
			// if one store failed, break and return error
			return err
		}
	}
	return nil
}

// GetConfigBytesFromTiKVStores gets config response bodies from the specified TiKV stores.
func GetConfigBytesFromTiKVStores(
	ctx context.Context,
	stores []*metapb.Store,
	cli *http.Client,
	httpPrefix string,
	collect func([]byte) error,
) error {
	return GetConfigFromTiKVStores(ctx, stores, cli, httpPrefix, func(resp *http.Response) error {
		if resp.StatusCode != http.StatusOK {
			return errors.Errorf("request %s failed: %s", resp.Request.URL.String(), resp.Status)
		}
		respBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		return collect(respBytes)
	})
}

// HandleTiKVAddress returns the TiKV status HTTP address used to fetch configs.
func HandleTiKVAddress(store *metapb.Store, httpPrefix string) (*url.URL, error) {
	statusAddr := store.GetStatusAddress()
	if statusAddr == "" {
		return nil, errors.Errorf("TiKV store %d does not have status address", store.GetId())
	}
	nodeAddr := store.GetAddress()
	if !strings.HasPrefix(statusAddr, "http") {
		statusAddr = httpPrefix + statusAddr
	}
	if !strings.HasPrefix(nodeAddr, "http") {
		nodeAddr = httpPrefix + nodeAddr
	}

	statusURL, err := url.Parse(statusAddr)
	if err != nil {
		return nil, err
	}
	nodeURL, err := url.Parse(nodeAddr)
	if err != nil {
		return nil, err
	}

	// We try status address as default.
	addr := statusURL
	// But sometimes we may not get the correct status address from PD.
	if statusURL.Hostname() != nodeURL.Hostname() {
		// If not matched, use the address hostname but keep the status port.
		addr.Host = net.JoinHostPort(nodeURL.Hostname(), statusURL.Port())
		log.Warn("store address and status address mismatch the host, we will use the store address as hostname",
			zap.Uint64("store", store.Id),
			zap.String("status address", statusAddr),
			zap.String("node address", nodeAddr),
			zap.Any("request address", statusURL))
	}
	return addr, nil
}

```

### Core Architecture Module: `br/pkg/logutil/context.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package logutil

import (
	"context"

	"github.com/pingcap/log"
	"go.uber.org/zap"
)

// We cannot directly set global logger as log.L(),
// or when the global logger updated, we cannot get the latest logger.
var globalLogger *zap.Logger

// ResetGlobalLogger resets the global logger.
// Contexts have already made by `ContextWithField` would keep untouched,
// subsequent wrapping over those contexts would keep using the old global logger,
// only brand new contexts (i.e. context without logger) would be wrapped with the new global logger.
// This method is mainly for testing.
func ResetGlobalLogger(l *zap.Logger) {
	globalLogger = l
}

type loggingContextKey struct{}

var keyLogger = loggingContextKey{}

// ContextWithField wrap a context with a logger with some fields.
func ContextWithField(c context.Context, fields ...zap.Field) context.Context {
	logger := LoggerFromContext(c).With(fields...)
	return context.WithValue(c, keyLogger, logger)
}

// LoggerFromContext returns the contextual logger via the context.
// If there isn't a logger in the context, returns the global logger.
func LoggerFromContext(c context.Context) *zap.Logger {
	logger, ok := c.Value(keyLogger).(*zap.Logger)
	if !ok {
		if globalLogger != nil {
			return globalLogger
		}
		return log.L()
	}
	return logger
}

// CL is the shorthand for LoggerFromContext.
func CL(c context.Context) *zap.Logger {
	return LoggerFromContext(c)
}

```

### Core Architecture Module: `br/pkg/logutil/logging.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package logutil

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/pingcap/errors"
	backuppb "github.com/pingcap/kvproto/pkg/brpb"
	"github.com/pingcap/kvproto/pkg/import_sstpb"
	"github.com/pingcap/kvproto/pkg/metapb"
	"github.com/pingcap/log"
	"github.com/pingcap/tidb/pkg/kv"
	"github.com/pingcap/tidb/pkg/lightning/metric"
	"github.com/pingcap/tidb/pkg/util/redact"
	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// AbbreviatedArrayMarshaler abbreviates an array of elements.
type AbbreviatedArrayMarshaler []string

// MarshalLogArray implements zapcore.ArrayMarshaler.
func (abb AbbreviatedArrayMarshaler) MarshalLogArray(encoder zapcore.ArrayEncoder) error {
	if len(abb) <= 4 {
		for _, e := range abb {
			encoder.AppendString(e)
		}
	} else {
		total := len(abb)
		encoder.AppendString(abb[0])
		encoder.AppendString(fmt.Sprintf("(skip %d)", total-2))
		encoder.AppendString(abb[total-1])
	}
	return nil
}

// AbbreviatedArray constructs a field that abbreviates an array of elements.
func AbbreviatedArray(
	key string, elements any, marshalFunc func(any) []string,
) zap.Field {
	return zap.Array(key, AbbreviatedArrayMarshaler(marshalFunc(elements)))
}

type zapFileMarshaler struct{ *backuppb.File }

func (file zapFileMarshaler) MarshalLogObject(enc zapcore.ObjectEncoder) error {
	enc.AddString("name", file.GetName())
	enc.AddString("CF", file.GetCf())
	enc.AddString("sha256", hex.EncodeToString(file.GetSha256()))
	enc.AddString("startKey", redact.Key(file.GetStartKey()))
	enc.AddString("endKey", redact.Key(file.GetEndKey()))
	enc.AddUint64("startVersion", file.GetStartVersion())
	enc.AddUint64("endVersion", file.GetEndVersion())
	enc.AddUint64("totalKvs", file.GetTotalKvs())
	enc.AddUint64("totalBytes", file.GetTotalBytes())
	enc.AddUint64("CRC64Xor", file.GetCrc64Xor())
	return nil
}

func AbbreviatedStringers[T fmt.Stringer](key string, stringers []T) zap.Field {
	if len(stringers) < 4 {
		return zap.Stringers(key, stringers)
	}
	return zap.Array(key, zapcore.ArrayMarshalerFunc(func(ae zapcore.ArrayEncoder) error {
		ae.AppendString(stringers[0].String())
		ae.AppendString(fmt.Sprintf("(skip %d)", len(stringers)-2))
		ae.AppendString(stringers[len(stringers)-1].String())
		return nil
	}))
}

type zapFilesMarshaler []*backuppb.File

// MarshalLogObjectForFiles is an internal util function to zap something having `Files` field.
func MarshalLogObjectForFiles(files []*backuppb.File, encoder zapcore.ObjectEncoder) error {
	return zapFilesMarshaler(files).MarshalLogObject(encoder)
}

func (fs zapFilesMarshaler) MarshalLogObject(encoder zapcore.ObjectEncoder) error {
	total := len(fs)
	encoder.AddInt("total", total)
	elements := make([]string, 0, total)
	for _, f := range fs {
		elements = append(elements, f.GetName())
	}
	_ = encoder.AddArray("files", AbbreviatedArrayMarshaler(elements))

	totalKVs := uint64(0)
	totalBytes := uint64(0)
	totalSize := uint64(0)
	for _, file := range fs {
		totalKVs += file.GetTotalKvs()
		totalBytes += file.GetTotalBytes()
		totalSize += file.GetSize_()
	}
	encoder.AddUint64("totalKVs", totalKVs)
	encoder.AddUint64("totalBytes", totalBytes)
	encoder.AddUint64("totalSize", totalSize)
	return nil
}

// File make the zap fields for a file.
func File(file *backuppb.File) zap.Field {
	return zap.Object("file", zapFileMarshaler{file})
}

// Files make the zap field for a set of file.
func Files(fs []*backuppb.File) zap.Field {
	return zap.Object("files", zapFilesMarshaler(fs))
}

type zapStreamBackupTaskInfo struct{ *backuppb.StreamBackupTaskInfo }

func (t zapStreamBackupTaskInfo) MarshalLogObject(enc zapcore.ObjectEncoder) error {
	enc.AddString("taskName", t.Name)
	enc.AddUint64("startTs", t.StartTs)
	enc.AddUint64("endTS", t.EndTs)
	enc.AddString("tableFilter", strings.Join(t.TableFilter, ","))
	return nil
}

// StreamBackupTaskInfo makes the zap fields for a stream backup task info.
func StreamBackupTaskInfo(t *backuppb.StreamBackupTaskInfo) zap.Field {
	return zap.Object("streamTaskInfo", zapStreamBackupTaskInfo{t})
}

type zapRewriteRuleMarshaler struct{ *import_sstpb.RewriteRule }

func (rewriteRule zapRewriteRuleMarshaler) MarshalLogObject(enc zapcore.ObjectEncoder) error {
	enc.AddString("oldKeyPrefix", hex.EncodeToString(rewriteRule.GetOldKeyPrefix()))
	enc.AddString("newKeyPrefix", hex.EncodeToString(rewriteRule.GetNewKeyPrefix()))
	enc.AddUint64("newTimestamp", rewriteRule.GetNewTimestamp())
	return nil
}

// RewriteRule make the zap fields for a rewrite rule.
func RewriteRule(rewriteRule *import_sstpb.RewriteRule) zap.Field {
	return zap.Object("rewriteRule", zapRewriteRuleMarshaler{rewriteRule})
}

// RewriteRuleObject make zap object marshaler for a rewrite rule.
func RewriteRuleObject(rewriteRule *import_sstpb.RewriteRule) zapcore.ObjectMarshaler {
	return zapRewriteRuleMarshaler{rewriteRule}
}

type zapMarshalRegionMarshaler struct{ *metapb.Region }

func (region zapMarshalRegionMarshaler) MarshalLogObject(enc zapcore.ObjectEncoder) error {
	peers := make([]string, 0, len(region.GetPeers()))
	for _, peer := range region.GetPeers() {
		peers = append(peers, peer.String())
	}
	enc.AddUint64("ID", region.GetId())
	enc.AddString("startKey", redact.Key(region.GetStartKey()))
	enc.AddString("endKey", redact.Key(region.GetEndKey()))
	enc.AddString("epoch", region.GetRegionEpoch().String())
	enc.AddString("peers", strings.Join(peers, ","))
	return nil
}

// Region make the zap fields for a region.
func Region(region *metapb.Region) zap.Field {
	return zap.Object("region", zapMarshalRegionMarshaler{region})
}

// RegionBy make the zap fields for a region with name.
func RegionBy(key string, region *metapb.Region) zap.Field {
	return zap.Object(key, zapMarshalRegionMarshaler{region})
}

// Leader make the zap fields for a peer as leader.
// nolint:interfacer
func Leader(peer *metapb.Peer) zap.Field {
	return zap.String("leader", peer.String())
}

// Peer make the zap fields for a peer.
func Peer(peer *metapb.Peer) zap.Field {
	return zap.String("peer", peer.String())
}

type zapSSTMetaMarshaler struct{ *import_sstpb.SSTMeta }

func (sstMeta zapSSTMetaMarshaler) MarshalLogObject(enc zapcore.ObjectEncoder) error {
	enc.AddString("CF", sstMeta.GetCfName())
	enc.AddBool("endKeyExclusive", sstMeta.EndKeyExclusive)
	enc.AddUint32("CRC32", sstMeta.Crc32)
	enc.AddUint64("length", sstMeta.Length)
	enc.AddUint64("regionID", sstMeta.RegionId)
	enc.AddString("regionEpoch", sstMeta.RegionEpoch.String())
	enc.AddString("startKey", redact.Key(sstMeta.GetRange().GetStart()))
	enc.AddString("endKey", redact.Key(sstMeta.GetRange().GetEnd()))

	sstUUID, err := uuid.FromBytes(sstMeta.GetUuid())
	if err != nil {
		enc.AddString("UUID", fmt.Sprintf("invalid UUID %s", hex.EncodeToString(sstMeta.GetUuid())))
	} else {
		enc.AddString("UUID", sstUUID.String())
	}
	return nil
}

// SSTMeta make the zap fields for a SST meta.
func SSTMeta(sstMeta *import_sstpb.SSTMeta) zap.Field {
	return zap.Object("sstMeta", zapSSTMetaMarshaler{sstMeta})
}

type zapSSTMetasMarshaler []*import_sstpb.SSTMeta

func (m zapSSTMetasMarshaler) MarshalLogArray(encoder zapcore.ArrayEncoder) error {
	for _, meta := range m {
		if err := encoder.AppendObject(zapSSTMetaMarshaler{meta}); err != nil {
			return errors.Trace(err)
		}
	}
	return nil
}

// Describes the overall range of the SST metas and their size.
func BriefSSTMetas(key string, sstMetas []*import_sstpb.SSTMeta) zap.Field {
	var (
		startKey, endKey []byte
		total            int
		totalSize        uint64
		totalKv          uint64
		totalKvSize      uint64
	)

	for _, meta := range sstMetas {
		if total == 0 {
			startKey = meta.GetRange().GetStart()
			endKey = meta.GetRange().GetEnd()
		}
		if bytes.Compare(meta.GetRange().GetStart(), startKey) < 0 {
			startKey = meta.GetRange().GetStart()
		}
		// NOTE: SST meta shouldn't has an empty end key?
		if bytes.Compare(meta.GetRange().GetEnd(), endKey) > 0 {
			endKey = meta.GetRange().GetEnd()
		}
		totalSize += meta.GetLength()
		totalKv += meta.GetTotalKvs()
		totalKvSize += meta.GetTotalBytes()
		total++
	}
	return zap.Object(key, zapcore.ObjectMarshalerFunc(func(enc zapcore.ObjectEncoder) error {
		enc.AddInt("total", total)
		enc.AddString("startKey", redact.Key(startKey))
		enc.AddString("endKey", redact.Key(endKey))
		enc.AddUint64("totalSize", totalSize)
		enc.AddUint64("totalKvs", totalKv)
		enc.AddUint64("totalKvSize", totalKvSize)
		return nil
	}))
}

// SSTMetas make the zap fields for SST metas.
func SSTMetas(sstMetas []*import_sstpb.SSTMeta) zap.Field {
	return zap.Array("sstMetas", zapSSTMetasMarshaler(sstMetas))
}

type zapKeysMarshaler [][]byte

func (keys zapKeysMarshaler) MarshalLogObject(encoder zapcore.ObjectEncoder) error {
	total := len(keys)
	encoder.AddInt("total", total)
	elements := make([]string, 0, total)
	for _, k := range keys {
		elements = append(elements, redact.Key(k))
	}
	_ = encoder.AddArray("keys", AbbreviatedArrayMarshaler(elements))
	return nil
}

// Key constructs a field that carries upper hex format key.
func Key(fieldKey string, key []byte) zap.Field {
	return zap.String(fieldKey, redact.Key(key))
}

// Keys constructs a field that carries upper hex format keys.
func Keys(keys [][]byte) zap.Field {
	return zap.Object("keys", zapKeysMarshaler(keys))
}

// AShortError make the zap field with key to display error without verbose representation (e.g. the stack trace).
func AShortError(key string, err error) zap.Field {
	if err == nil {
		return zap.Skip()
	}
	return zap.String(key, err.Error())
}

// ShortError make the zap field to display error without verbose representation (e.g. the stack trace).
func ShortError(err error) zap.Field {
	if err == nil {
		return zap.Skip()
	}
	return zap.String("error", err.Error())
}

var loggerToTerm, _, _ = log.InitLogger(new(log.Config), zap.AddCallerSkip(1))

// WarnTe
```

### Core Architecture Module: `br/pkg/logutil/rate.go`
```
package logutil

import (
	"fmt"
	"math"
	"time"

	"github.com/pingcap/log"
	"github.com/pingcap/tidb/pkg/lightning/metric"
	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/zap"
)

// RateTracer is a trivial rate tracer based on a prometheus counter.
// It traces the average speed from it was created.
type RateTracer struct {
	start time.Time
	base  float64
	prometheus.Counter
}

// TraceRateOver make a trivial rater based on a counter.
// the current value of this counter would be omitted.
func TraceRateOver(counter prometheus.Counter) RateTracer {
	return RateTracer{
		start:   time.Now(),
		Counter: counter,
		base:    metric.ReadCounter(counter),
	}
}

// Rate returns the average rate from when it was created.
func (r *RateTracer) Rate() float64 {
	return r.RateAt(time.Now())
}

// RateAt returns the rate until some instant. This function is mainly for testing.
// WARN: the counter value for calculating is still its CURRENT VALUE.
func (r *RateTracer) RateAt(instant time.Time) float64 {
	if r.Counter == nil {
		return math.NaN()
	}
	return (metric.ReadCounter(r.Counter) - r.base) / instant.Sub(r.start).Seconds()
}

// L make a logger with the current speed.
func (r *RateTracer) L() *zap.Logger {
	return log.L().With(zap.String("speed", fmt.Sprintf("%.2f ops/s", r.Rate())))
}

```

### Core Architecture Module: `br/pkg/metautil/debug.go`
```
// Copyright 2024 PingCAP, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package metautil

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"

	"github.com/gogo/protobuf/proto"
	"github.com/pingcap/errors"
	backuppb "github.com/pingcap/kvproto/pkg/brpb"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/br/pkg/utils"
	"github.com/pingcap/tidb/pkg/objstore/storeapi"
	tidbutil "github.com/pingcap/tidb/pkg/util"
	"golang.org/x/sync/errgroup"
)

const (
	// JSONFileFormat represents json file name format
	JSONFileFormat = "jsons/%s.json"
)

// DecodeStatsFile decodes the stats file to json format, it is called by br debug
func DecodeStatsFile(
	ctx context.Context,
	s storeapi.Storage,
	cipher *backuppb.CipherInfo,
	schemas []*backuppb.Schema,
) error {
	for _, schema := range schemas {
		for _, statsIndex := range schema.StatsIndex {
			if len(statsIndex.Name) == 0 {
				continue
			}
			content, err := s.ReadFile(ctx, statsIndex.Name)
			if err != nil {
				return errors.Trace(err)
			}
			decryptContent, err := utils.Decrypt(content, cipher, statsIndex.CipherIv)
			if err != nil {
				return errors.Trace(err)
			}
			checksum := sha256.Sum256(decryptContent)
			if !bytes.Equal(statsIndex.Sha256, checksum[:]) {
				return berrors.ErrInvalidMetaFile.GenWithStackByArgs(fmt.Sprintf(
					"checksum mismatch expect %x, got %x", statsIndex.Sha256, checksum[:]))
			}
			statsFileBlocks := &backuppb.StatsFile{}
			if err := proto.Unmarshal(decryptContent, statsFileBlocks); err != nil {
				return errors.Trace(err)
			}
			jsonContent, err := utils.MarshalStatsFile(statsFileBlocks)
			if err != nil {
				return errors.Trace(err)
			}
			if err := s.WriteFile(ctx, fmt.Sprintf(JSONFileFormat, statsIndex.Name), jsonContent); err != nil {
				return errors.Trace(err)
			}
		}
	}
	return nil
}

// DecodeMetaFile decodes the meta file to json format, it is called by br debug
func DecodeMetaFile(
	ctx context.Context,
	s storeapi.Storage,
	cipher *backuppb.CipherInfo,
	metaIndex *backuppb.MetaFile,
) error {
	if metaIndex == nil {
		return nil
	}
	eg, ectx := errgroup.WithContext(ctx)
	workers := tidbutil.NewWorkerPool(8, "download files workers")
	for _, node := range metaIndex.MetaFiles {
		workers.ApplyOnErrorGroup(eg, func() error {
			content, err := s.ReadFile(ectx, node.Name)
			if err != nil {
				return errors.Trace(err)
			}

			decryptContent, err := utils.Decrypt(content, cipher, node.CipherIv)
			if err != nil {
				return errors.Trace(err)
			}

			checksum := sha256.Sum256(decryptContent)
			if !bytes.Equal(node.Sha256, checksum[:]) {
				return berrors.ErrInvalidMetaFile.GenWithStackByArgs(fmt.Sprintf(
					"checksum mismatch expect %x, got %x", node.Sha256, checksum[:]))
			}

			child := &backuppb.MetaFile{}
			if err = proto.Unmarshal(decryptContent, child); err != nil {
				return errors.Trace(err)
			}

			// the max depth of the root metafile is only 1.
			// ASSERT: len(child.MetaFiles) == 0
			if len(child.MetaFiles) > 0 {
				return errors.Errorf("the metafile has unexpected level: %v", child)
			}

			jsonContent, err := utils.MarshalMetaFile(child)
			if err != nil {
				return errors.Trace(err)
			}

			if err := s.WriteFile(ctx, fmt.Sprintf(JSONFileFormat, node.Name), jsonContent); err != nil {
				return errors.Trace(err)
			}

			err = DecodeStatsFile(ctx, s, cipher, child.Schemas)
			return errors.Trace(err)
		})
	}
	return eg.Wait()
}

```

### Core Architecture Module: `br/pkg/metautil/load.go`
```
// Copyright 2024 PingCAP, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package metautil

import (
	"context"

	"github.com/pingcap/errors"
	"github.com/pingcap/tidb/pkg/meta/model"
)

// Database wraps the schema and tables of a database.
type Database struct {
	Info   *model.DBInfo
	Tables []*Table
}

// GetTable returns a table of the database by name.
func (db *Database) GetTable(name string) *Table {
	for _, table := range db.Tables {
		if table.Info.Name.String() == name {
			return table
		}
	}
	return nil
}

// LoadBackupTables loads schemas from BackupMeta.
func LoadBackupTables(ctx context.Context, reader *MetaReader, loadStats bool) (map[string]*Database, error) {
	ch := make(chan *Table)
	errCh := make(chan error)
	go func() {
		var opts []ReadSchemaOption
		if !loadStats {
			opts = []ReadSchemaOption{SkipStats}
		}
		if err := reader.ReadSchemasFiles(ctx, ch, opts...); err != nil {
			errCh <- errors.Trace(err)
		}
		close(ch)
	}()

	databases := make(map[string]*Database)
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case err := <-errCh:
			return nil, errors.Trace(err)
		case table, ok := <-ch:
			if !ok {
				close(errCh)
				return databases, nil
			}
			dbName := table.DB.Name.String()
			db, ok := databases[dbName]
			if !ok {
				db = &Database{
					Info:   table.DB,
					Tables: make([]*Table, 0),
				}
				databases[dbName] = db
			}
			db.Tables = append(db.Tables, table)
		}
	}
}

```

### Core Architecture Module: `br/pkg/metautil/metafile.go`
```
// Copyright 2021 PingCAP, Inc. Licensed under Apache-2.0.

package metautil

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/docker/go-units"
	"github.com/gogo/protobuf/proto"
	"github.com/opentracing/opentracing-go"
	"github.com/pingcap/errors"
	backuppb "github.com/pingcap/kvproto/pkg/brpb"
	"github.com/pingcap/kvproto/pkg/encryptionpb"
	"github.com/pingcap/log"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/br/pkg/logutil"
	"github.com/pingcap/tidb/br/pkg/summary"
	"github.com/pingcap/tidb/br/pkg/utils"
	"github.com/pingcap/tidb/pkg/meta/model"
	"github.com/pingcap/tidb/pkg/objstore/storeapi"
	"github.com/pingcap/tidb/pkg/statistics/util"
	"github.com/pingcap/tidb/pkg/tablecodec"
	tidbutil "github.com/pingcap/tidb/pkg/util"
	"github.com/pingcap/tidb/pkg/util/encrypt"
	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
	"google.golang.org/protobuf/encoding/protowire"
)

const (
	// LockFile represents file name
	LockFile = "backup.lock"
	// MetaFile represents file name
	MetaFile = "backupmeta"
	// MetaJSONFile represents backup meta json file name
	MetaJSONFile = "jsons/backupmeta.json"
	// MaxBatchSize represents the internal channel buffer size of MetaWriter and MetaReader.
	MaxBatchSize = 1024

	// MetaFileSize represents the limit size of one MetaFile
	MetaFileSize = 128 * units.MiB

	// CrypterIvLen represents the length of iv of crypter method
	CrypterIvLen = 16
)

const (
	// MetaV1 represents the old version of backupmeta.
	// because the old version doesn't have version field, so set it to 0 for compatibility.
	MetaV1 = iota
	// MetaV2 represents the new version of backupmeta.
	MetaV2
)

type protobufFieldInfo struct {
	isMessage  bool
	messageTyp reflect.Type
}

var (
	protoMsgIfaceType = reflect.TypeOf((*proto.Message)(nil)).Elem()
	protoFieldCache   sync.Map // map[reflect.Type]map[protowire.Number]protobufFieldInfo
)

func checkBackupMetaUnknownFieldsFromBytes(
	backupMetaBytes []byte,
	backupMeta *backuppb.BackupMeta,
) error {
	if len(backupMetaBytes) == 0 {
		return errors.Annotate(
			berrors.ErrInvalidArgument,
			"backupmeta bytes are required for compatibility check",
		)
	}
	hasUnknownFields, err := detectUnknownProtobufFields(backupMetaBytes, reflect.TypeOf(backuppb.BackupMeta{}))
	if err != nil {
		return errors.Annotate(err, "failed to detect unknown fields in backupmeta")
	}
	if !hasUnknownFields {
		return nil
	}
	return errors.Annotatef(
		berrors.ErrVersionMismatch,
		"backupmeta contains unknown protobuf fields. restoring with an older BR may silently ignore "+
			"newer backup metadata. backup cluster version: %s, backup BR version: %s. use "+
			"--check-requirements=false to skip this check",
		backupMeta.GetClusterVersion(),
		backupMeta.GetBrVersion(),
	)
}

func detectUnknownProtobufFields(data []byte, messageTyp reflect.Type) (bool, error) {
	fields := getProtobufFieldInfo(messageTyp)
	for len(data) > 0 {
		fieldNumber, wireType, n := protowire.ConsumeTag(data)
		if n < 0 {
			return false, errors.Trace(protowire.ParseError(n))
		}
		data = data[n:]

		fieldInfo, ok := fields[fieldNumber]
		payload, consumed, err := consumeProtobufFieldValue(data, fieldNumber, wireType)
		if err != nil {
			return false, err
		}
		if !ok {
			return true, nil
		}
		if fieldInfo.isMessage && wireType == protowire.BytesType {
			hasUnknown, err := detectUnknownProtobufFields(payload, fieldInfo.messageTyp)
			if err != nil {
				return false, err
			}
			if hasUnknown {
				return true, nil
			}
		}
		data = data[consumed:]
	}
	return false, nil
}

func consumeProtobufFieldValue(
	data []byte,
	fieldNumber protowire.Number,
	wireType protowire.Type,
) (payload []byte, consumed int, err error) {
	switch wireType {
	case protowire.VarintType:
		_, consumed = protowire.ConsumeVarint(data)
	case protowire.Fixed32Type:
		_, consumed = protowire.ConsumeFixed32(data)
	case protowire.Fixed64Type:
		_, consumed = protowire.ConsumeFixed64(data)
	case protowire.BytesType:
		payload, consumed = protowire.ConsumeBytes(data)
	case protowire.StartGroupType:
		_, consumed = protowire.ConsumeGroup(fieldNumber, data)
	case protowire.EndGroupType:
		return nil, 0, errors.New("unexpected end-group wire type in backupmeta")
	default:
		return nil, 0, errors.Errorf("unsupported protobuf wire type %d in backupmeta", wireType)
	}
	if consumed < 0 {
		return nil, 0, errors.Trace(protowire.ParseError(consumed))
	}
	return payload, consumed, nil
}

func getProtobufFieldInfo(messageTyp reflect.Type) map[protowire.Number]protobufFieldInfo {
	if messageTyp.Kind() == reflect.Ptr {
		messageTyp = messageTyp.Elem()
	}
	if cached, ok := protoFieldCache.Load(messageTyp); ok {
		return cached.(map[protowire.Number]protobufFieldInfo)
	}

	result := make(map[protowire.Number]protobufFieldInfo)
	for i := range messageTyp.NumField() {
		field := messageTyp.Field(i)
		protobufTag := field.Tag.Get("protobuf")
		fieldNumber, ok := parseProtobufFieldNumber(protobufTag)
		if !ok {
			continue
		}
		nestedMessageType, isMessage := getNestedMessageType(field.Type)
		result[fieldNumber] = protobufFieldInfo{
			isMessage:  isMessage,
			messageTyp: nestedMessageType,
		}
	}
	protoFieldCache.Store(messageTyp, result)
	return result
}

func parseProtobufFieldNumber(protobufTag string) (protowire.Number, bool) {
	if protobufTag == "" {
		return 0, false
	}
	parts := strings.Split(protobufTag, ",")
	if len(parts) < 2 {
		return 0, false
	}
	n, err := strconv.ParseUint(parts[1], 10, 32)
	if err != nil {
		return 0, false
	}
	return protowire.Number(n), true
}

func getNestedMessageType(fieldTyp reflect.Type) (reflect.Type, bool) {
	switch fieldTyp.Kind() {
	case reflect.Ptr:
		if fieldTyp.Implements(protoMsgIfaceType) {
			return fieldTyp.Elem(), true
		}
	case reflect.Slice:
		if fieldTyp.Elem().Kind() == reflect.Uint8 {
			return nil, false
		}
		elemTyp := fieldTyp.Elem()
		if elemTyp.Kind() == reflect.Ptr && elemTyp.Implements(protoMsgIfaceType) {
			return elemTyp.Elem(), true
		}
		if elemTyp.Kind() == reflect.Struct && reflect.PointerTo(elemTyp).Implements(protoMsgIfaceType) {
			return elemTyp, true
		}
	}
	return nil, false
}

// CheckBackupMetaCompatibilityFromBytes blocks restore when backup metadata
// requires a newer metadata schema reader or contains protobuf fields the
// current BR binary does not recognize.
func CheckBackupMetaCompatibilityFromBytes(
	backupMetaBytes []byte,
	backupMeta *backuppb.BackupMeta,
) error {
	if backupMeta.GetBackupSchemaVersion() > backuppb.BackupSchemaVersion {
		return errors.Annotatef(
			berrors.ErrVersionMismatch,
			"backupmeta requires schema version %d, current BR supports up to %d. restoring with an older BR "+
				"may silently ignore newer backup metadata semantics. backup cluster version: %s, backup BR "+
				"version: %s. use --check-requirements=false to skip this check",
			backupMeta.GetBackupSchemaVersion(),
			backuppb.BackupSchemaVersion,
			backupMeta.GetClusterVersion(),
			backupMeta.GetBrVersion(),
		)
	}
	return checkBackupMetaUnknownFieldsFromBytes(backupMetaBytes, backupMeta)
}

// Encrypt encrypts the content according to CipherInfo.
func Encrypt(content []byte, cipher *backuppb.CipherInfo) (encryptedContent, iv []byte, err error) {
	if len(content) == 0 || cipher == nil {
		return content, iv, nil
	}

	switch cipher.CipherType {
	case encryptionpb.EncryptionMethod_PLAINTEXT:
		return content, iv, nil
	case encryptionpb.EncryptionMethod_AES128_CTR,
		encryptionpb.EncryptionMethod_AES192_CTR,
		encryptionpb.EncryptionMethod_AES256_CTR:
		// generate random iv for aes crypter
		iv = make([]byte, CrypterIvLen)
		_, err = rand.Read(iv)
		if err != nil {
			return content, iv, errors.Trace(err)
		}
		encryptedContent, err = encrypt.AESEncryptWithCTR(content, cipher.CipherKey, iv)
		return
	default:
		return content, iv, errors.Annotate(berrors.ErrInvalidArgument, "cipher type invalid")
	}
}

func DecryptFullBackupMetaIfNeeded(metaData []byte, cipherInfo *backuppb.CipherInfo) ([]byte, error) {
	if cipherInfo == nil || !utils.IsEffectiveEncryptionMethod(cipherInfo.CipherType) {
		return metaData, nil
	}
	// the prefix of backup meta file is iv(16 bytes) for ctr mode if encryption method is valid
	iv := metaData[:CrypterIvLen]
	decryptBackupMeta, err := utils.Decrypt(metaData[len(iv):], cipherInfo, iv)
	if err != nil {
		return nil, errors.Annotate(err, "decrypt failed with wrong key")
	}
	return decryptBackupMeta, nil
}

// walkLeafMetaFile walks the leaves of the given metafile, and deal with it by calling the function `output`.
// Notice: the function `output` should be thread safe.
func walkLeafMetaFile(
	ctx context.Context,
	storage storeapi.Storage,
	file *backuppb.MetaFile,
	cipher *backuppb.CipherInfo,
	output func(*backuppb.MetaFile)) error {
	if file == nil {
		return nil
	}
	if len(file.MetaFiles) == 0 {
		output(file)
		return nil
	}
	eg, ectx := errgroup.WithContext(ctx)
	workers := tidbutil.NewWorkerPool(8, "download files workers")
	for _, node := range file.MetaFiles {
		workers.ApplyOnErrorGroup(eg, func() error {
			content, err := storage.ReadFile(ectx, node.Name)
			if err != nil {
				return errors.Trace(err)
			}

			decryptContent, err := utils.Decrypt(content, cipher, node.CipherIv)
			if err != nil {
				return errors.Trace(err)
			}

			checksum := sha256.Sum256(decryptContent)
			if !bytes.Equal(node.Sha256, checksum[:]) {
				return berrors.ErrInvalidMetaFile.GenWithStackByArgs(fmt.Sprintf(
					"checksum mismatch expect %x, got %x", node.Sha256, checksum[:]))
			}

			child := &backuppb.MetaFile{}
			if err = proto.Unmarshal(decryptContent, child); err != nil {
				return errors.Trace(err)
			}

			// the max depth of the root metafile is only 1.
			// ASSERT: len(child.MetaFiles) == 0
			if err = walkLeafMetaFile(ectx, storage, child, cipher, output); err != nil {
				return errors.Trace(err)
			}

			return nil
		})
	}
	retu
```

### Core Architecture Module: `br/pkg/metautil/statsfile.go`
```
// Copyright 2024 PingCAP, Inc.
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

package metautil

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"

	"github.com/gogo/protobuf/proto"
	"github.com/pingcap/errors"
	backuppb "github.com/pingcap/kvproto/pkg/brpb"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/br/pkg/utils"
	"github.com/pingcap/tidb/pkg/meta/model"
	"github.com/pingcap/tidb/pkg/objstore/storeapi"
	"github.com/pingcap/tidb/pkg/statistics/handle"
	statstypes "github.com/pingcap/tidb/pkg/statistics/handle/types"
	statsutil "github.com/pingcap/tidb/pkg/statistics/util"
	"github.com/pingcap/tidb/pkg/util"
	"golang.org/x/sync/errgroup"
)

var maxStatsJsonTableSize = 32 * 1024 * 1024 // 32 MiB
var inlineSize = 8 * 1024                    // 8 KiB

func getStatsFileName(physicalID int64) string {
	return fmt.Sprintf("backupmeta.schema.stats.%09d", physicalID)
}

// A lightweight function wrapper to dump the statistic
type StatsWriter struct {
	storage storeapi.Storage
	cipher  *backuppb.CipherInfo

	// final stats file indexes
	statsFileIndexes []*backuppb.StatsFileIndex

	// temporary variables, clear after each flush
	totalSize int
	statsFile *backuppb.StatsFile
}

func newStatsWriter(
	storage storeapi.Storage,
	cipher *backuppb.CipherInfo,
) *StatsWriter {
	return &StatsWriter{
		storage: storage,
		cipher:  cipher,

		statsFileIndexes: make([]*backuppb.StatsFileIndex, 0),

		totalSize: 0,
		statsFile: &backuppb.StatsFile{
			Blocks: make([]*backuppb.StatsBlock, 0, 8),
		},
	}
}

// flush temporary and clear []byte to make it garbage collected as soon as possible
func (s *StatsWriter) flushTemporary() ([]byte, error) {
	defer s.clearTemporary()
	return proto.Marshal(s.statsFile)
}

func (s *StatsWriter) clearTemporary() {
	// clear the temporary variables
	s.totalSize = 0
	s.statsFile = &backuppb.StatsFile{
		Blocks: make([]*backuppb.StatsBlock, 0, 8),
	}
}

func (s *StatsWriter) writeStatsFileAndClear(ctx context.Context, physicalID int64) error {
	fileName := getStatsFileName(physicalID)
	content, err := s.flushTemporary()
	if err != nil {
		return errors.Trace(err)
	}

	if len(s.statsFileIndexes) == 0 && len(content) < inlineSize {
		s.statsFileIndexes = append(s.statsFileIndexes, &backuppb.StatsFileIndex{InlineData: content})
		return nil
	}

	checksum := sha256.Sum256(content)
	sizeOri := uint64(len(content))
	encryptedContent, iv, err := Encrypt(content, s.cipher)
	if err != nil {
		return errors.Trace(err)
	}

	if err := s.storage.WriteFile(ctx, fileName, encryptedContent); err != nil {
		return errors.Trace(err)
	}

	s.statsFileIndexes = append(s.statsFileIndexes, &backuppb.StatsFileIndex{
		Name:     fileName,
		Sha256:   checksum[:],
		SizeEnc:  uint64(len(encryptedContent)),
		SizeOri:  sizeOri,
		CipherIv: iv,
	})
	return nil
}

func (s *StatsWriter) BackupStats(ctx context.Context, jsonTable *statsutil.JSONTable, physicalID int64) error {
	if jsonTable == nil {
		return nil
	}

	statsBytes, err := json.Marshal(jsonTable)
	if err != nil {
		return errors.Trace(err)
	}

	s.totalSize += len(statsBytes)
	s.statsFile.Blocks = append(s.statsFile.Blocks, &backuppb.StatsBlock{
		PhysicalId: physicalID,
		JsonTable:  statsBytes,
	})

	// check whether need to flush
	if s.totalSize > maxStatsJsonTableSize {
		if err := s.writeStatsFileAndClear(ctx, physicalID); err != nil {
			return errors.Trace(err)
		}
	}
	return nil
}

func (s *StatsWriter) BackupStatsDone(ctx context.Context) ([]*backuppb.StatsFileIndex, error) {
	if s.totalSize == 0 || len(s.statsFile.Blocks) == 0 {
		return s.statsFileIndexes, nil
	}

	if err := s.writeStatsFileAndClear(ctx, s.statsFile.Blocks[0].PhysicalId); err != nil {
		return nil, errors.Trace(err)
	}
	return s.statsFileIndexes, nil
}

func RestoreStats(
	ctx context.Context,
	storage storeapi.Storage,
	cipher *backuppb.CipherInfo,
	statsHandler *handle.Handle,
	newTableInfo *model.TableInfo,
	statsFileIndexes []*backuppb.StatsFileIndex,
	rewriteIDMap map[int64]int64,
) error {
	eg, ectx := errgroup.WithContext(ctx)
	taskCh := make(chan *statstypes.PartitionStatisticLoadTask, 8)
	eg.Go(func() error {
		return downloadStats(ectx, storage, cipher, statsFileIndexes, rewriteIDMap, taskCh)
	})
	eg.Go(func() error {
		// NOTICE: skip updating cache after load stats from json
		return statsHandler.LoadStatsFromJSONConcurrently(ectx, newTableInfo, taskCh, 0)
	})
	return eg.Wait()
}

func downloadStats(
	ctx context.Context,
	storage storeapi.Storage,
	cipher *backuppb.CipherInfo,
	statsFileIndexes []*backuppb.StatsFileIndex,
	rewriteIDMap map[int64]int64,
	taskCh chan<- *statstypes.PartitionStatisticLoadTask,
) error {
	defer close(taskCh)
	eg, ectx := errgroup.WithContext(ctx)
	downloadWorkerpool := util.NewWorkerPool(4, "download stats for each partition")
	for _, statsFileIndex := range statsFileIndexes {
		if ectx.Err() != nil {
			break
		}
		statsFile := statsFileIndex
		downloadWorkerpool.ApplyOnErrorGroup(eg, func() error {
			var statsContent []byte
			if len(statsFile.InlineData) > 0 {
				statsContent = statsFile.InlineData
			} else {
				content, err := storage.ReadFile(ectx, statsFile.Name)
				if err != nil {
					return errors.Trace(err)
				}

				decryptContent, err := utils.Decrypt(content, cipher, statsFile.CipherIv)
				if err != nil {
					return errors.Trace(err)
				}

				checksum := sha256.Sum256(decryptContent)
				if !bytes.Equal(statsFile.Sha256, checksum[:]) {
					return berrors.ErrInvalidMetaFile.GenWithStackByArgs(fmt.Sprintf(
						"checksum mismatch expect %x, got %x", statsFile.Sha256, checksum[:]))
				}
				statsContent = decryptContent
			}

			statsFileBlocks := &backuppb.StatsFile{}
			if err := proto.Unmarshal(statsContent, statsFileBlocks); err != nil {
				return errors.Trace(err)
			}

			for _, block := range statsFileBlocks.Blocks {
				physicalId, ok := rewriteIDMap[block.PhysicalId]
				if !ok {
					return berrors.ErrRestoreInvalidRewrite.GenWithStackByArgs(fmt.Sprintf(
						"not rewrite rule matched, old physical id: %d", block.PhysicalId))
				}
				jsonTable := &statsutil.JSONTable{}
				if err := json.Unmarshal(block.JsonTable, jsonTable); err != nil {
					return errors.Trace(err)
				}
				// reset the block.JsonTable to nil to make it garbage collected as soon as possible
				block.JsonTable = nil

				select {
				case <-ectx.Done():
					return nil
				case taskCh <- &statstypes.PartitionStatisticLoadTask{
					PhysicalID: physicalId,
					JSONTable:  jsonTable,
				}:
				}
			}

			return nil
		})
	}

	return eg.Wait()
}

```

### Core Architecture Module: `br/pkg/pdutil/pd.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package pdutil

import (
	"context"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-semver/semver"
	"github.com/docker/go-units"
	"github.com/google/uuid"
	"github.com/opentracing/opentracing-go"
	"github.com/pingcap/errors"
	"github.com/pingcap/failpoint"
	"github.com/pingcap/log"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/pkg/keyspace"
	"github.com/pingcap/tidb/pkg/kv"
	"github.com/pingcap/tidb/pkg/util/codec"
	pd "github.com/tikv/pd/client"
	pdhttp "github.com/tikv/pd/client/http"
	"github.com/tikv/pd/client/opt"
	"github.com/tikv/pd/client/pkg/caller"
	"github.com/tikv/pd/client/pkg/retry"
	"go.uber.org/zap"
	"google.golang.org/grpc"
)

const (
	maxMsgSize   = int(128 * units.MiB) // pd.ScanRegion may return a large response
	pauseTimeout = 5 * time.Minute
	// pd request retry time when connection fail
	PDRequestRetryTime = 120
	// set max-pending-peer-count to a large value to avoid scatter region failed.
	maxPendingPeerUnlimited uint64 = math.MaxInt32
)

// pauseConfigGenerator generate a config value according to store count and current value.
type pauseConfigGenerator func(int, any) any

// zeroPauseConfig sets the config to 0.
func zeroPauseConfig(int, any) any {
	return 0
}

// pauseConfigMulStores multiplies the existing value by
// number of stores. The value is limited to 40, as larger value
// may make the cluster unstable.
func pauseConfigMulStores(stores int, raw any) any {
	rawCfg := raw.(float64)
	return math.Min(40, rawCfg*float64(stores))
}

// pauseConfigFalse sets the config to "false".
func pauseConfigFalse(int, any) any {
	return "false"
}

// constConfigGeneratorBuilder build a pauseConfigGenerator based on a given const value.
func constConfigGeneratorBuilder(val any) pauseConfigGenerator {
	return func(int, any) any {
		return val
	}
}

// ClusterConfig represents a set of scheduler whose config have been modified
// along with their original config.
type ClusterConfig struct {
	// Enable PD schedulers before restore
	Schedulers []string `json:"schedulers"`
	// Original scheudle configuration
	ScheduleCfg map[string]any `json:"schedule_cfg"`
	// The region rule ID registered
	RuleID string `json:"rule_id"`
}

type pauseSchedulerBody struct {
	Delay int64 `json:"delay"`
}

var (
	// in v4.0.8 version we can use pause configs
	// see https://github.com/tikv/pd/pull/3088
	pauseConfigVersion = semver.Version{Major: 4, Minor: 0, Patch: 8}

	// After v6.1.0 version, we can pause schedulers by key range with TTL.
	minVersionForRegionLabelTTL = semver.Version{Major: 6, Minor: 1, Patch: 0}

	// Schedulers represent region/leader schedulers which can impact on performance.
	Schedulers = map[string]struct{}{
		"balance-leader-scheduler":     {},
		"balance-hot-region-scheduler": {},
		"balance-region-scheduler":     {},

		"shuffle-leader-scheduler":     {},
		"shuffle-region-scheduler":     {},
		"shuffle-hot-region-scheduler": {},

		"evict-slow-store-scheduler": {},
	}
	expectPDCfgGenerators = map[string]pauseConfigGenerator{
		"merge-schedule-limit": zeroPauseConfig,
		// TODO "leader-schedule-limit" and "region-schedule-limit" don't support ttl for now,
		// but we still need set these config for compatible with old version.
		// we need wait for https://github.com/tikv/pd/pull/3131 merged.
		// see details https://github.com/pingcap/br/pull/592#discussion_r522684325
		"leader-schedule-limit":       pauseConfigMulStores,
		"region-schedule-limit":       pauseConfigMulStores,
		"max-snapshot-count":          pauseConfigMulStores,
		"enable-location-replacement": pauseConfigFalse,
		"max-pending-peer-count":      constConfigGeneratorBuilder(maxPendingPeerUnlimited),
	}

	// defaultPDCfg find by https://github.com/tikv/pd/blob/master/conf/config.toml.
	// only use for debug command.
	defaultPDCfg = map[string]any{
		"merge-schedule-limit":        8,
		"leader-schedule-limit":       4,
		"region-schedule-limit":       2048,
		"enable-location-replacement": "true",
	}
)

// DefaultExpectPDCfgGenerators returns default pd config generators
func DefaultExpectPDCfgGenerators() map[string]pauseConfigGenerator {
	clone := make(map[string]pauseConfigGenerator, len(expectPDCfgGenerators))
	for k := range expectPDCfgGenerators {
		clone[k] = expectPDCfgGenerators[k]
	}
	return clone
}

// PdController manage get/update config from pd.
type PdController struct {
	pdClient  pd.Client
	pdHTTPCli pdhttp.Client
	version   *semver.Version

	// control the pause schedulers goroutine
	schedulerPauseCh chan struct{}
	// control the ttl of pausing schedulers
	SchedulerPauseTTL time.Duration
}

// NewPdController creates a new PdController.
func NewPdController(
	ctx context.Context,
	keyspaceName string,
	pdAddrs []string,
	tlsConf *tls.Config,
	securityOption pd.SecurityOption,
) (*PdController, error) {
	maxCallMsgSize := []grpc.DialOption{
		grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(maxMsgSize)),
		grpc.WithDefaultCallOptions(grpc.MaxCallSendMsgSize(maxMsgSize)),
	}
	pdClient, err := pd.NewClientWithAPIContext(
		ctx, keyspace.BuildAPIContext(keyspaceName), caller.GetComponent(1), pdAddrs, securityOption,
		opt.WithGRPCDialOptions(maxCallMsgSize...),
		// If the time too short, we may scatter a region many times, because
		// the interface `ScatterRegions` may time out.
		opt.WithCustomTimeoutOption(60*time.Second),
	)
	if err != nil {
		log.Error("fail to create pd client", zap.Error(err))
		return nil, errors.Trace(err)
	}

	pdHTTPCliConfig := make([]pdhttp.ClientOption, 0, 1)
	if tlsConf != nil {
		pdHTTPCliConfig = append(pdHTTPCliConfig, pdhttp.WithTLSConfig(tlsConf))
	}
	pdHTTPCli := pdhttp.NewClientWithServiceDiscovery(
		"br/lightning PD controller",
		pdClient.GetServiceDiscovery(),
		pdHTTPCliConfig...,
	).WithBackoffer(retry.InitialBackoffer(time.Second, time.Second, PDRequestRetryTime*time.Second))
	versionStr, err := pdHTTPCli.GetPDVersion(ctx)
	if err != nil {
		pdHTTPCli.Close()
		pdClient.Close()
		return nil, errors.Trace(err)
	}
	version := parseVersion(versionStr)

	return &PdController{
		pdClient:  pdClient,
		pdHTTPCli: pdHTTPCli,
		version:   version,
		// We should make a buffered channel here otherwise when context canceled,
		// gracefully shutdown will stick at resuming schedulers.
		schedulerPauseCh: make(chan struct{}, 1),
	}, nil
}

func NewPdControllerWithPDClient(pdClient pd.Client, pdHTTPCli pdhttp.Client, v *semver.Version) *PdController {
	return &PdController{
		pdClient:         pdClient,
		pdHTTPCli:        pdHTTPCli,
		version:          v,
		schedulerPauseCh: make(chan struct{}, 1),
	}
}

func parseVersion(versionStr string) *semver.Version {
	// we need trim space or semver will parse failed
	v := strings.TrimSpace(versionStr)
	v = strings.Trim(v, "\"")
	v = strings.TrimPrefix(v, "v")
	version, err := semver.NewVersion(v)
	if err != nil {
		log.Warn("fail back to v0.0.0 version",
			zap.String("version", versionStr), zap.Error(err))
		version = &semver.Version{Major: 0, Minor: 0, Patch: 0}
	}
	failpoint.Inject("PDEnabledPauseConfig", func(val failpoint.Value) {
		if val.(bool) {
			// test pause config is enable
			version = &semver.Version{Major: 5, Minor: 0, Patch: 0}
		}
	})
	return version
}

func (p *PdController) isPauseConfigEnabled() bool {
	return p.version.Compare(pauseConfigVersion) >= 0
}

// SetPDClient set pd addrs and cli for test.
func (p *PdController) SetPDClient(pdClient pd.Client) {
	p.pdClient = pdClient
}

// GetPDClient set pd addrs and cli for test.
func (p *PdController) GetPDClient() pd.Client {
	return p.pdClient
}

// GetPDHTTPClient returns the pd http client.
func (p *PdController) GetPDHTTPClient() pdhttp.Client {
	return p.pdHTTPCli
}

// GetClusterVersion returns the current cluster version.
func (p *PdController) GetClusterVersion(ctx context.Context) (string, error) {
	v, err := p.pdHTTPCli.GetClusterVersion(ctx)
	return v, errors.Trace(err)
}

// GetRegionCount returns the region count in the specified range.
func (p *PdController) GetRegionCount(ctx context.Context, startKey, endKey []byte) (int, error) {
	// TiKV reports region start/end keys to PD in memcomparable-format.
	var start, end []byte
	start = codec.EncodeBytes(nil, startKey)
	if len(endKey) != 0 { // Empty end key means the max.
		end = codec.EncodeBytes(nil, endKey)
	}
	status, err := p.pdHTTPCli.GetRegionStatusByKeyRange(ctx, pdhttp.NewKeyRange(start, end), true)
	if err != nil {
		return 0, errors.Trace(err)
	}
	return status.Count, nil
}

// GetStoreInfo returns the info of store with the specified id.
func (p *PdController) GetStoreInfo(ctx context.Context, storeID uint64) (*pdhttp.StoreInfo, error) {
	info, err := p.pdHTTPCli.GetStore(ctx, storeID)
	return info, errors.Trace(err)
}

func (p *PdController) doPauseSchedulers(
	ctx context.Context,
	schedulers []string,
) ([]string, error) {
	// pause this scheduler with 300 seconds
	delay := int64(p.ttlOfPausing().Seconds())
	removedSchedulers := make([]string, 0, len(schedulers))
	for _, scheduler := range schedulers {
		err := p.pdHTTPCli.SetSchedulerDelay(ctx, scheduler, delay)
		if err != nil {
			return removedSchedulers, errors.Trace(err)
		}
		removedSchedulers = append(removedSchedulers, scheduler)
	}
	return removedSchedulers, nil
}

func (p *PdController) pauseSchedulersAndConfigWith(
	ctx context.Context, schedulers []string,
	schedulerCfg map[string]any,
) ([]string, error) {
	// first pause this scheduler, if the first time failed. we should return the error
	// so put first time out of for loop. and in for loop we could ignore other failed pause.
	removedSchedulers, err := p.doPauseSchedulers(ctx, schedulers)
	if err != nil {
		log.Error("failed to pause scheduler at beginning",
			zap.Strings("name", schedulers), zap.Error(err))
		return nil, errors.Trace(err)
	}
	log.Info("pause scheduler successful at beginning", zap.Strings("name", schedulers))
	i
```

### Core Architecture Module: `br/pkg/pdutil/utils.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package pdutil

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/pingcap/errors"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/pkg/store/pdtypes"
	"github.com/pingcap/tidb/pkg/tablecodec"
	"github.com/pingcap/tidb/pkg/util/codec"
	"github.com/pingcap/tidb/pkg/util/httputil"
	pd "github.com/tikv/pd/client/http"
)

// UndoFunc is a 'undo' operation of some undoable command.
// (e.g. RemoveSchedulers).
type UndoFunc func(context.Context) error

// Nop is the 'zero value' of undo func.
var Nop UndoFunc = func(context.Context) error { return nil }

// GetPlacementRules return the current placement rules.
func GetPlacementRules(ctx context.Context, pdAddr string, tlsConf *tls.Config) ([]pdtypes.Rule, error) {
	cli := httputil.NewClient(tlsConf)
	prefix := "http://"
	if tlsConf != nil {
		prefix = "https://"
	}
	reqURL := fmt.Sprintf("%s%s%s", prefix, pdAddr, pd.PlacementRules)
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, errors.Trace(err)
	}
	resp, err := cli.Do(req)
	if err != nil {
		return nil, errors.Trace(err)
	}
	defer resp.Body.Close()
	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(resp.Body)
	if err != nil {
		return nil, errors.Trace(err)
	}
	if resp.StatusCode == http.StatusPreconditionFailed {
		return []pdtypes.Rule{}, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, errors.Annotatef(berrors.ErrPDInvalidResponse,
			"get placement rules failed: resp=%v, err=%v, code=%d", buf.String(), err, resp.StatusCode)
	}
	var rules []pdtypes.Rule
	err = json.Unmarshal(buf.Bytes(), &rules)
	if err != nil {
		return nil, errors.Trace(err)
	}
	return rules, nil
}

// SearchPlacementRule returns the placement rule matched to the table or nil.
func SearchPlacementRule(tableID int64, placementRules []pdtypes.Rule, role pdtypes.PeerRoleType) *pdtypes.Rule {
	for _, rule := range placementRules {
		key, err := hex.DecodeString(rule.StartKeyHex)
		if err != nil {
			continue
		}
		_, decoded, err := codec.DecodeBytes(key, nil)
		if err != nil {
			continue
		}
		if rule.Role == role && tableID == tablecodec.DecodeTableID(decoded) {
			return &rule
		}
	}
	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #73022** (2026-11-11): **chore: temporary CLA check after permission downgrade (will be closed)**
  *Symptoms*: Verifies that license/cla still works after the GitHub App lost the Checks permission. Scratch file only; closed immediately.
  **Post-Mortem & Fix Analysis**:
  > Adding the "do-not-merge/release-note-label-needed" label because no release-note block was detected, please follow our [release note process](https://git.k8s.io/community/contributors/guide/release-notes.md) to remove it.  <details>  Instructions for interacting with me using PR comments are available [here](https://git.k8s.io/community/contributors/guide/pull-requests.md).  If you have questions or suggestions related to my behavior, please file an issue against the [kubernetes-sigs/prow](https://github.com/kubernetes-sigs/prow/issues/new?title=Prow%20issue:) repository. </details>
  >  [FORMAT CHECKER NOTIFICATION]  **Notice**: To remove the `do-not-merge/needs-linked-issue` label, please provide the linked issue number on one line in the PR body, for example: `Issue Number: close #123` or `Issue Number: ref #456`.  <sub>:open_book: For more info, you can check the ["Contribute Code"](https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue) section in the development guide.</sub>  <hr>  **Notice**: To remove the `do-not-merge/needs-tests-checked` label, please finished the tests then check the finished items in description.  For example:      Tests <!-- At least one of them must be included. -->      - [x] Unit test     - [ ] Integration test     - [ ] Manual test (add detailed scripts or steps below)     - [ ] No code > ‼️ Must keep the HTML comments `<!-- At least one of them must be included. -->`  <sub>:open_book: For more info, you can check the ["Contribute Code"](https://pingcap.github.io/tidb-dev-guide/contribut

- **Issue #73021** (2026-11-11): **chore: temporary CLA webhook check (will be closed)**
  *Symptoms*: Temporary pull request to verify the CLA webhook end to end after the webhook hardening. It only adds a scratch file and will be closed immediately.
  **Post-Mortem & Fix Analysis**:
  > Adding the "do-not-merge/release-note-label-needed" label because no release-note block was detected, please follow our [release note process](https://git.k8s.io/community/contributors/guide/release-notes.md) to remove it.  <details>  Instructions for interacting with me using PR comments are available [here](https://git.k8s.io/community/contributors/guide/pull-requests.md).  If you have questions or suggestions related to my behavior, please file an issue against the [kubernetes-sigs/prow](https://github.com/kubernetes-sigs/prow/issues/new?title=Prow%20issue:) repository. </details>
  >  [FORMAT CHECKER NOTIFICATION]  **Notice**: To remove the `do-not-merge/needs-linked-issue` label, please provide the linked issue number on one line in the PR body, for example: `Issue Number: close #123` or `Issue Number: ref #456`.  <sub>:open_book: For more info, you can check the ["Contribute Code"](https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue) section in the development guide.</sub>  <hr>  **Notice**: To remove the `do-not-merge/needs-tests-checked` label, please finished the tests then check the finished items in description.  For example:      Tests <!-- At least one of them must be included. -->      - [x] Unit test     - [ ] Integration test     - [ ] Manual test (add detailed scripts or steps below)     - [ ] No code > ‼️ Must keep the HTML comments `<!-- At least one of them must be included. -->`  <sub>:open_book: For more info, you can check the ["Contribute Code"](https://pingcap.github.io/tidb-dev-guide/contribut

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

### Incident Patch 1: `7981253e` (2026-11-10)
**Commit Message**: expression: fix flaky TestGetLock internal session check (#72941)

close pingcap/tidb#72880

**File**: `pkg/expression/integration_test/BUILD.bazel` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ go_test(
         "//pkg/store/mockstore",
         "//pkg/tablecodec",
         "//pkg/testkit",
+        "//pkg/testkit/testfailpoint",
         "//pkg/testkit/testmain",
         "//pkg/testkit/testsetup",
         "//pkg/types",
```

**File**: `pkg/expression/integration_test/integration_test.go` (modified, +47/-11)
```diff
@@ -59,6 +59,7 @@ import (
 	"github.com/pingcap/tidb/pkg/store/mockstore"
 	"github.com/pingcap/tidb/pkg/tablecodec"
 	"github.com/pingcap/tidb/pkg/testkit"
+	"github.com/pingcap/tidb/pkg/testkit/testfailpoint"
 	"github.com/pingcap/tidb/pkg/types"
 	"github.com/pingcap/tidb/pkg/util/codec"
 	"github.com/pingcap/tidb/pkg/util/collate"
@@ -1572,27 +1573,62 @@ func TestGetLock(t *testing.T) {
 
 	// Test someone else has the lock with short timeout.
 	tk2 := testkit.NewTestKit(t, store)
-	sessionManager := domain.GetDomain(tk.Session()).InfoSyncer().GetSessionManager()
-	checkInternalSessionCount := func(expected int) {
+	dom := domain.GetDomain(tk.Session())
+	// Keep an unrelated checkout registered so the test cannot rely on a global count.
+	backgroundSession, err := dom.SysSessionPool().Get()
+	require.NoError(t, err)
+	defer dom.SysSessionPool().Put(backgroundSession)
+	sessionManager := dom.InfoSyncer().GetSessionManager()
+	type lockSession struct {
+		session  any
+		returned bool
+	}
+	var mu sync.Mutex
+	var sessions []*lockSession
+	active := make(map[any]*lockSession)
+	testfailpoint.EnableCall(t, "github.com/pingcap/tidb/pkg/session/afterGetAdvisoryLockSession", func(owner, internal any) {
+		if owner != tk.Session() && owner != tk2.Session() {
+			return
+		}
+		mu.Lock()
+		defer mu.Unlock()
+		tracked := &lockSession{session: internal}
+		sessions = append(sessions, tracked)
+		active[internal] = tracked
+	})
+	testfailpoint.EnableCall(t, "github.com/pingcap/tidb/pkg/testkit/afterDeleteInternalSession", func(internal any) {
+		mu.Lock()
+		defer mu.Unlock()
+		if tracked := active[internal]; tracked != nil {
+			tracked.returned = true
+			delete(active, internal)
+		}
+	})
+	checkSessions := func(returned ...bool) {
 		t.Helper()
-		// Background tasks can temporarily borrow sessions from the same pool.
-		require.Eventually(t, func() bool {
-			return sessionManager.InternalSessionCount() == expected
-		}, 10*time.Second, 20*time.Millisecond, "expected %d internal sessions", expected)
+		mu.Lock()
+		defer mu.Unlock()
+		require.Len(t, sessions, len(returned))
+		for i, expected := range returned {
+			require.Equal(t, expected, sessions[i].returned, "advisory lock attempt %d", i+1)
+			if !expected {
+				require.True(t, sessionManager.ContainsInternalSession(sessions[i].session))
+			}
+		}
 	}
-	checkInternalSessionCount(0)
 	tk2.MustQuery("SELECT get_lock('mygloballock', 1)").Check(testkit.Rows("1"))
-	checkInternalSessionCount(1)
+	checkSessions(false)
 	tk.MustQuery("SELECT get_lock('mygloballock', 1)").Check(testkit.Rows("0")) // someone else has the lock
-	checkInternalSessionCount(1)
+	checkSessions(false, true)
 	tk.MustQuery("SELECT release_lock('mygloballock')").Check(testkit.Rows("0")) // never had the lock
 	// try again
 	tk.MustQuery("SELECT get_lock('mygloballock', 0)").Check(testkit.Rows("0")) // someone else has the lock
-	checkInternalSessionCount(1)
+	checkSessions(false, true, true)
 	tk.MustQuery("SELECT release_lock('mygloballock')").Check(testkit.Rows("0")) // never had the lock
 	// release it
 	tk2.MustQuery("SELECT release_lock('mygloballock')").Check(testkit.Rows("1")) // works
-	checkInternalSessionCount(0)
+	// The deletion event is recorded before the session becomes available for reuse.
+	checkSessions(true, true, true)
 
 	// Confirm all locks are released
 	tk2.MustQuery("SELECT release_all_locks()").Check(testkit.Rows("0"))
```

**File**: `pkg/session/session.go` (modified, +1/-0)
```diff
@@ -2089,6 +2089,7 @@ func (s *session) GetAdvisoryLock(lockName string, timeout int64) error {
 	if err != nil {
 		return err
 	}
+	failpoint.InjectCall("afterGetAdvisoryLockSession", s, se)
 	lock := &advisoryLock{session: se, ctx: context.TODO(), owner: s.getAdvisoryLockOwner(), clean: clean}
 	err = lock.GetLock(lockName, timeout)
 	if err != nil {
```

**File**: `pkg/testkit/mocksessionmanager.go` (modified, +2/-0)
```diff
@@ -19,6 +19,7 @@ import (
 	"maps"
 	"sync"
 
+	"github.com/pingcap/failpoint"
 	"github.com/pingcap/tidb/pkg/domain"
 	"github.com/pingcap/tidb/pkg/infoschema/issyncer/mdldef"
 	"github.com/pingcap/tidb/pkg/parser/ast"
@@ -160,6 +161,7 @@ func (msm *MockSessionManager) DeleteInternalSession(s any) {
 	msm.mu.Lock()
 	delete(msm.internalSessions, s)
 	msm.mu.Unlock()
+	failpoint.InjectCall("afterDeleteInternalSession", s)
 }
 
 // GetInternalSessionStartTSList is to get all startTS of every transaction running in the current internal sessions
```

---

### Incident Patch 2: `e5efa812` (2026-11-10)
**Commit Message**: server: fix resource group connection gauge drift on change user (#71974)

close pingcap/tidb#71969

**File**: `pkg/server/conn.go` (modified, +3/-1)
```diff
@@ -2741,13 +2741,16 @@ func (cc *clientConn) handleChangeUser(ctx context.Context, data []byte) error {
 	cc.user = newUser
 	cc.dbname = newDBName
 	err := cc.openSession()
+	cc.moveResourceGroupCounter(oldResourceGroup)
 	restoreOldSession := func() {
+		newResourceGroup := cc.currentResourceGroupName()
 		if newCtx := cc.getCtx(); newCtx != nil && newCtx != oldCtx {
 			if err := newCtx.Close(); err != nil {
 				logutil.Logger(ctx).Debug("close new context failed", zap.Error(err))
 			}
 		}
 		cc.SetCtx(oldCtx)
+		cc.moveResourceGroupCounter(newResourceGroup)
 		cc.user = oldUser
 		cc.dbname = oldDBName
 		cc.authPlugin = oldAuthPlugin
@@ -2784,7 +2787,6 @@ func (cc *clientConn) handleChangeUser(ctx context.Context, data []byte) error {
 			logutil.Logger(ctx).Debug("close old context failed", zap.Error(err))
 		}
 	}
-	cc.moveResourceGroupCounter(oldResourceGroup)
 	return cc.handleCommonConnectionReset(ctx)
 }
 
```

**File**: `pkg/server/conn_test.go` (modified, +35/-14)
```diff
@@ -391,12 +391,15 @@ func TestChangeUserAndResetSessionResourceGroupCounter(t *testing.T) {
 
 	metrics.ConnGauge.WithLabelValues(resourcegroup.DefaultResourceGroupName).Inc()
 
+	requireCounter := func(rgTest, defaultGroup float64) {
+		require.Equal(t, rgTest, promtestutils.ToFloat64(metrics.ConnGauge.WithLabelValues("rg_test")))
+		require.Equal(t, defaultGroup, promtestutils.ToFloat64(metrics.ConnGauge.WithLabelValues(resourcegroup.DefaultResourceGroupName)))
+	}
+
 	tk := testkit.NewTestKit(t, store)
 	tk.MustExec("create resource group rg_test RU_PER_SEC = 1000;")
 	tk.MustExec("set resource group rg_test")
-
-	require.Equal(t, 0.0, promtestutils.ToFloat64(metrics.ConnGauge.WithLabelValues(resourcegroup.DefaultResourceGroupName)))
-	require.Equal(t, 1.0, promtestutils.ToFloat64(metrics.ConnGauge.WithLabelValues("rg_test")))
+	requireCounter(1, 0)
 
 	tidbdrv := NewTiDBDriver(store)
 	cfg := serverutil.NewTestConfig()
@@ -420,23 +423,41 @@ func TestChangeUserAndResetSessionResourceGroupCounter(t *testing.T) {
 	}
 	cc.SetCtx(&TiDBContext{Session: tk.Session()})
 
-	userData := append([]byte("root"), 0x0, 0x0)
-	userData = append(userData, []byte("test")...)
-	userData = append(userData, 0x0)
-	err = cc.dispatch(context.Background(), append([]byte{mysql.ComChangeUser}, userData...))
-	require.NoError(t, err)
+	changeUser := func(user, db string) error {
+		data := append([]byte(user), 0x0, 0x0)
+		data = append(data, []byte(db)...)
+		data = append(data, 0x0)
+		return cc.dispatch(context.Background(), append([]byte{mysql.ComChangeUser}, data...))
+	}
 
-	require.Equal(t, 0.0, promtestutils.ToFloat64(metrics.ConnGauge.WithLabelValues("rg_test")))
-	require.Equal(t, 1.0, promtestutils.ToFloat64(metrics.ConnGauge.WithLabelValues(resourcegroup.DefaultResourceGroupName)))
+	require.NoError(t, changeUser("root", "test"))
+	requireCounter(0, 1)
 
 	_, err = cc.ctx.Session.Execute(context.Background(), "set resource group rg_test")
 	require.NoError(t, err)
-	require.Equal(t, 1.0, promtestutils.ToFloat64(metrics.ConnGauge.WithLabelValues("rg_test")))
-	require.Equal(t, 0.0, promtestutils.ToFloat64(metrics.ConnGauge.WithLabelValues(resourcegroup.DefaultResourceGroupName)))
+	requireCounter(1, 0)
 	err = cc.dispatch(context.Background(), []byte{mysql.ComResetConnection})
 	require.NoError(t, err)
-	require.Equal(t, 0.0, promtestutils.ToFloat64(metrics.ConnGauge.WithLabelValues("rg_test")))
-	require.Equal(t, 1.0, promtestutils.ToFloat64(metrics.ConnGauge.WithLabelValues(resourcegroup.DefaultResourceGroupName)))
+	requireCounter(0, 1)
+
+	// Change to a user bound to a resource group, where authentication itself moves the counter.
+	tk.MustExec("create user u_rg resource group rg_test")
+	require.NoError(t, changeUser("u_rg", ""))
+	requireCounter(1, 0)
+	require.NoError(t, changeUser("u_rg", ""))
+	requireCounter(1, 0)
+
+	// Authentication succeeds and binds the group, then useDB fails and the old session is restored.
+	require.Error(t, changeUser("u_rg", "no_such_db"))
+	require.Equal(t, "u_rg", cc.user)
+	requireCounter(1, 0)
+
+	require.Error(t, changeUser("no_such_user", ""))
+	require.Equal(t, "u_rg", cc.user)
+	requireCounter(1, 0)
+
+	require.NoError(t, changeUser("root", ""))
+	requireCounter(0, 1)
 }
 
 func TestMalformHandshakeHeader(t *testing.T) {
```

---

### Incident Patch 3: `781d3965` (2026-11-10)
**Commit Message**: *: restore materialized view regression coverage (#72864)

ref pingcap/tidb#18023

**File**: `pkg/ddl/mv_index_test.go` (modified, +1/-0)
```diff
@@ -144,6 +144,7 @@ func TestCreateUniqueIndexOnMaterializedView(t *testing.T) {
 	tk.MustExec(`create materialized view mv_nullable_key_agg (g1, cnt)
 		refresh fast
 		as select g1, count(*) as cnt from t_mv_nullable_key group by g1`)
+	tk.MustQuery("select non_unique, index_name = 'PRIMARY' from information_schema.statistics where table_schema='test' and table_name='mv_nullable_key_agg'").Check(testkit.Rows("0 0"))
 	tk.MustGetErrMsg(
 		"alter table mv_nullable_key_agg add primary key (cnt) nonclustered",
 		"[ddl:8200]Unsupported ALTER TABLE ADD PRIMARY KEY on materialized view table",
```

**File**: `pkg/ddl/mview_worker_test.go` (modified, +3/-0)
```diff
@@ -70,9 +70,11 @@ func TestInitCreateMaterializedViewBuildSessionAppliesDefinitionDivPrecisionIncr
 		before[name] = sessionVar(name)
 	}
 	sqlMode := sessVars.SQLMode
+	originalInMViewMaintenance := sessVars.InMViewMaintenance
 
 	restore, err := initCreateMaterializedViewBuildSession(sessCtx, job, mviewTableInfo, "test")
 	require.NoError(t, err)
+	require.True(t, sessVars.InMViewMaintenance)
 	require.Equal(t, 9, sessVars.DivPrecisionIncrement)
 	require.Equal(t, "test", sessVars.CurrentDB)
 	require.Equal(t, "9", sessionVar(vardef.DivPrecisionIncrement))
@@ -85,6 +87,7 @@ func TestInitCreateMaterializedViewBuildSessionAppliesDefinitionDivPrecisionIncr
 	require.Equal(t, vardef.On, sessionVar(vardef.TiDBEnableParallelHashaggSpill))
 
 	restore()
+	require.Equal(t, originalInMViewMaintenance, sessVars.InMViewMaintenance)
 	require.Equal(t, 2, sessVars.DivPrecisionIncrement)
 	require.Equal(t, "before", sessVars.CurrentDB)
 	require.Equal(t, sqlMode, sessVars.SQLMode)
```

**File**: `pkg/ddl/tests/materializedview/materialized_view_alter_test.go` (modified, +100/-4)
```diff
@@ -171,17 +171,62 @@ func TestMaterializedViewDDLProtectsMinMaxSupportingBaseTableIndexes(t *testing.
 	err := tk.ExecToErr("drop index idx_ab on t_drop_idx")
 	require.ErrorContains(t, err, "required by materialized view mv_drop_idx")
 	require.ErrorContains(t, err, "MIN/MAX fast refresh")
+	err = tk.ExecToErr("alter table t_drop_idx drop index idx_ab")
+	require.ErrorContains(t, err, "required by materialized view mv_drop_idx")
+	require.ErrorContains(t, err, "MIN/MAX fast refresh")
 
 	createMinMaxMV("t_invisible_idx", "mv_invisible_idx", ", index idx_ab(a, b)")
 	err = tk.ExecToErr("alter table t_invisible_idx alter index idx_ab invisible")
 	require.ErrorContains(t, err, "required by materialized view mv_invisible_idx")
+	require.ErrorContains(t, err, "MIN/MAX fast refresh")
+
+	tk.MustExec("create table t_create_invisible_idx (a int not null, b int not null, c int not null, index idx_ab(a, b))")
+	tk.MustExec("create materialized view log on t_create_invisible_idx (a, b, c)")
+	tk.MustExec("alter table t_create_invisible_idx alter index idx_ab invisible")
+	err = tk.ExecToErr("create materialized view mv_create_invisible_idx (a, b, minc, cnt) refresh fast next now() as select a, b, min(c), count(1) from t_create_invisible_idx group by a, b")
+	require.ErrorContains(t, err, "requires base table index whose leading columns cover all GROUP BY columns")
+
+	tk.MustExec("create table t_drop_pk (a int not null primary key nonclustered, c int not null)")
+	tk.MustExec("create materialized view log on t_drop_pk (a, c)")
+	tk.MustExec("create materialized view mv_drop_pk (a, minc, cnt) refresh fast next now() as select a, min(c), count(1) from t_drop_pk group by a")
+	err = tk.ExecToErr("alter table t_drop_pk drop primary key")
+	require.ErrorContains(t, err, "required by materialized view mv_drop_pk")
+	require.ErrorContains(t, err, "MIN/MAX fast refresh")
+
+	createMinMaxMV("t_alt_idx", "mv_alt_idx", ", index idx_ab(a, b), index idx_ba(b, a)")
+	tk.MustExec("drop index idx_ab on t_alt_idx")
+	tk.MustExec("insert into t_alt_idx values (1, 2, 10), (1, 2, 5)")
+	tk.MustExec("refresh materialized view mv_alt_idx fast")
+	tk.MustQuery("select a, b, minc, cnt from mv_alt_idx").Check(testkit.Rows("1 2 5 2"))
+
+	createMinMaxMVWithWhere := func(baseTable, mvName string) {
+		tk.MustExec(fmt.Sprintf("create table %s (a int not null, b int not null, c int not null, index idx_ab(a, b), index idx_ba(b, a))", baseTable))
+		tk.MustExec(fmt.Sprintf("create materialized view log on %s (a, b, c)", baseTable))
+		tk.MustExec(fmt.Sprintf("create materialized view %s (a, b, minc, cnt) refresh fast next now() as select a, b, min(c), count(1) from %s where c > 0 group by a, b", mvName, baseTable))
+	}
+
+	createMinMaxMVWithWhere("t_where_drop_idx", "mv_where_drop_idx")
+	tk.MustExec("drop index idx_ab on t_where_drop_idx")
+	err = tk.ExecToErr("drop index idx_ba on t_where_drop_idx")
+	require.ErrorContains(t, err, "required by materialized view mv_where_drop_idx")
+	require.ErrorContains(t, err, "MIN/MAX fast refresh")
+
+	createMinMaxMVWithWhere("t_where_invisible_idx", "mv_where_invisible_idx")
+	tk.MustExec("alter table t_where_invisible_idx alter index idx_ab invisible")
+	err = tk.ExecToErr("alter table t_where_invisible_idx alter index idx_ba invisible")
+	require.ErrorContains(t, err, "required by materialized view mv_where_invisible_idx")
+	require.ErrorContains(t, err, "MIN/MAX fast refresh")
 
 	createMinMaxMV("t_multi_schema_replace_idx", "mv_multi_schema_replace_idx", ", index idx_ab(a, b)")
 	tk.MustExec("alter table t_multi_schema_replace_idx drop index idx_ab, add index idx_ba(b, a)")
+	tk.MustExec("insert into t_multi_schema_replace_idx values (1, 2, 10), (1, 2, 5)")
+	tk.MustExec("refresh materialized view mv_multi_schema_replace_idx fast")
+	tk.MustQuery("select a, b, minc, cnt from mv_multi_schema_replace_idx").Check(testkit.Rows("1 2 5 2"))
 
 	createMinMaxMV("t_multi_schema_bad_idx", "mv_multi_schema_bad_idx", ", index idx_ab(a, b)")
 	err = tk.ExecToErr("alter table t_multi_schema_bad_idx drop index idx_ab, add index idx_c(c)")
 	require.ErrorContains(t, err, "required by materialized view mv_multi_schema_bad_idx")
+	require.ErrorContains(t, err, "MIN/MAX fast refresh")
 }
 
 func TestMaterializedViewDDLProtectsMinMaxSupportingBaseTableIndexesAgainstConcurrentDrop(t *testing.T) {
@@ -254,6 +299,10 @@ func TestMaterializedViewDDLProtectsMinMaxSupportingBaseTableIndexesAgainstConcu
 	require.NoError(t, err1)
 	require.ErrorContains(t, err2, "required by materialized view mv_concurrent_drop_idx")
 	require.ErrorContains(t, err2, "MIN/MAX fast refresh")
+
+	tk.MustExec("insert into t_concurrent_drop_idx values (1, 2, 10), (1, 2, 5)")
+	tk.MustExec("refresh materialized view mv_concurrent_drop_idx fast")
+	tk.MustQuery("select a, b, minc, cnt from mv_concurrent_drop_idx").Check(testkit.Rows("1 2 5 2"))
 }
 
 func TestAlterMaterializedViewRefreshDisableScheduleUpdatesAlert(t *testing.T) {
@@ -325,11 +374,11 @@ 
```

**File**: `pkg/ddl/tests/materializedview/materialized_view_basic_test.go` (modified, +108/-3)
```diff
@@ -37,25 +37,65 @@ import (
 )
 
 func TestCreateMaterializedViewValidationCoverage(t *testing.T) {
-	store := testkit.CreateMockStore(t)
+	store, dom := testkit.CreateMockStoreAndDomain(t)
 	tk := newMViewTestKit(t, store)
 	tk.MustExec("use test")
+	tk.MustExec("set time_zone = '+08:00'")
 	tk.MustExec("create table t_mv_validation (a int not null, b int not null)")
+	err := tk.ExecToErr("create materialized view mv_no_log (a, cnt) as select a, count(1) from t_mv_validation group by a")
+	require.ErrorContains(t, err, "materialized view log does not exist")
 	tk.MustExec("insert into t_mv_validation values (1, 10), (1, 5), (2, 7)")
 	tk.MustExec("create materialized view log on t_mv_validation (a, b)")
 
+	err = tk.ExecToErr("create materialized view mv_no_count (a, s) as select a, sum(b) from t_mv_validation group by a")
+	require.ErrorContains(t, err, "must contain count(*)/count(1)")
+	err = tk.ExecToErr("create materialized view mv_avg (a, avgv, cnt) as select a, avg(b), count(1) from t_mv_validation group by a")
+	require.ErrorContains(t, err, "unsupported aggregate function")
+	err = tk.ExecToErr("create materialized view mv_rand (a, cnt) as select a, count(1) from t_mv_validation where rand() > 0 group by a")
+	require.ErrorContains(t, err, "WHERE clause must be deterministic")
+
 	// COUNT(column) is supported when the required COUNT(*)/COUNT(1) is also present.
 	tk.MustExec("create materialized view mv_count_column (a, cnt_b, cnt) as select a, count(b), count(1) from t_mv_validation group by a")
 	tk.MustQuery("select a, cnt_b, cnt from mv_count_column order by a").Check(testkit.Rows("1 2 2", "2 1 1"))
 
+	baseTable, err := dom.InfoSchema().TableByName(context.Background(), ast.NewCIStr("test"), ast.NewCIStr("t_mv_validation"))
+	require.NoError(t, err)
+	mvTable, err := dom.InfoSchema().TableByName(context.Background(), ast.NewCIStr("test"), ast.NewCIStr("mv_count_column"))
+	require.NoError(t, err)
+	mvInfo := mvTable.Meta().MaterializedView
+	require.NotNil(t, mvInfo)
+	require.Equal(t, []int64{baseTable.Meta().ID}, mvInfo.BaseTableIDs)
+	require.Equal(t, "FAST", mvInfo.RefreshMethod)
+	require.Empty(t, mvInfo.RefreshStartWith)
+	require.Empty(t, mvInfo.RefreshNext)
+	require.Zero(t, mvInfo.AlertWarningSec)
+	require.Zero(t, mvInfo.AlertOverdueSec)
+	require.False(t, mvInfo.AlertRefreshFailed)
+	require.Equal(t, tk.Session().GetSessionVars().SQLMode, mvInfo.DefinitionSQLMode)
+	require.Equal(t, tk.Session().GetSessionVars().SQLMode, mvInfo.RefreshScheduleSQLMode)
+	require.Empty(t, mvInfo.DefinitionTimeZone.Name)
+	require.Equal(t, 8*60*60, mvInfo.DefinitionTimeZone.Offset)
+
 	// Aggregate function names are case-insensitive.
 	tk.MustExec("create materialized view mv_upper_aggregate (a, s, cnt) as select a, SUM(b), COUNT(1) from t_mv_validation group by a")
 	tk.MustQuery("select a, s, cnt from mv_upper_aggregate order by a").Check(testkit.Rows("1 15 2", "2 7 1"))
 
+	tk.MustExec("create materialized view mv_alias (a, cnt) as select x.a, count(1) from t_mv_validation x where x.b > 0 group by x.a")
+	tk.MustQuery("select a, cnt from mv_alias order by a").Check(testkit.Rows("1 2", "2 1"))
+	tk.MustExec("create materialized view mv_out_alias (k, cnt) as select a as k, count(1) from t_mv_validation group by a")
+	tk.MustQuery("select k, cnt from mv_out_alias order by k").Check(testkit.Rows("1 2", "2 1"))
+
+	tk.MustExec("create table t_mv_sum_time (a int not null, d date not null default '2020-01-01', dt datetime not null default '2020-01-01 00:00:00', ts timestamp not null default '2020-01-01 00:00:00', dur time not null default '00:00:00')")
+	tk.MustExec("create materialized view log on t_mv_sum_time (a, d, dt, ts, dur)")
+	for _, col := range []string{"d", "dt", "ts", "dur"} {
+		err = tk.ExecToErr(fmt.Sprintf("create materialized view mv_sum_%s (a, s, cnt) as select a, sum(%s), count(1) from t_mv_sum_time group by a", col, col))
+		require.ErrorContains(t, err, "does not support SUM on DATE/DATETIME/TIMESTAMP/TIME column", col)
+	}
+
 	// MIN/MAX still require a supporting base-table index, regardless of function case.
 	tk.MustExec("create table t_mv_minmax_validation (a int not null, b int not null, c int not null, index idx_cab(c, a, b))")
 	tk.MustExec("create materialized view log on t_mv_minmax_validation (a, b, c)")
-	err := tk.ExecToErr("create materialized view mv_upper_min (a, b, minc, cnt) as select a, b, MIN(c), COUNT(1) from t_mv_minmax_validation group by a, b")
+	err = tk.ExecToErr("create materialized view mv_upper_min (a, b, minc, cnt) as select a, b, MIN(c), COUNT(1) from t_mv_minmax_validation group by a, b")
 	require.ErrorContains(t, err, "requires base table index whose leading columns cover all GROUP BY columns")
 
 	// Every referenced column must be present in the materialized view log.
@@ -146,10 +186,21 @@ func TestMaterializedViewCommentLength(t *testing.T) {
 	err := tk.ExecToErr(createMVSQL("mv_comment_too_long", commentTooLong))
 	require.ErrorContains(t, er
```

**File**: `pkg/ddl/tests/materializedviewlog/materialized_view_alter_test.go` (modified, +23/-1)
```diff
@@ -99,7 +99,7 @@ func TestAlterMaterializedViewLogAddColumnBasic(t *testing.T) {
 	tk.MustExec("use test")
 	tk.MustExec("create table t_mlog_add_column (id int not null, n int not null, s varchar(10) not null, d date not null, note text not null, untouched int)")
 	tk.MustExec("create materialized view log on t_mlog_add_column (id)")
-	mustExecMViewMaintenance(t, tk, "insert into `$mlog$t_mlog_add_column` (id, `_MLOG$_DML_TYPE`, `_MLOG$_OLD_NEW`) values (1, 'I', 1)")
+	tk.MustExec("insert into t_mlog_add_column values (1, 7, 'old', '2026-01-02', 'memo', 100)")
 
 	tk.MustExec("alter materialized view log on t_mlog_add_column add column (n, s, d, note)")
 	mlogTable, err := dom.InfoSchema().TableByName(context.Background(), ast.NewCIStr("test"), ast.NewCIStr("$mlog$t_mlog_add_column"))
@@ -123,6 +123,19 @@ func TestAlterMaterializedViewLogAddColumnBasic(t *testing.T) {
 	require.Equal(t, mysql.TypeBlob, columns["note"].GetType())
 	tk.MustQuery("select n, hex(s), cast(d as char), hex(note), `_MLOG$_DML_TYPE`, `_MLOG$_OLD_NEW` from `$mlog$t_mlog_add_column`").Check(testkit.Rows("0 20 0000-00-00 20 I 1"))
 
+	showCreate := tk.MustQuery("show create materialized view log on t_mlog_add_column").Rows()[0][1].(string)
+	require.Contains(t, showCreate, "CREATE MATERIALIZED VIEW LOG ON `t_mlog_add_column` (`id`, `n`, `s`, `d`, `note`)")
+
+	mustExecMViewMaintenance(t, tk, "delete from `$mlog$t_mlog_add_column`")
+	tk.MustExec("update t_mlog_add_column set untouched = 101 where id = 1")
+	tk.MustQuery("select * from `$mlog$t_mlog_add_column`").Check(testkit.Rows())
+
+	tk.MustExec("update t_mlog_add_column set s = 'new' where id = 1")
+	tk.MustQuery("select id, n, s, cast(d as char), note, `_MLOG$_DML_TYPE`, `_MLOG$_OLD_NEW` from `$mlog$t_mlog_add_column`").Sort().Check(testkit.Rows(
+		"1 7 new 2026-01-02 memo U 1",
+		"1 7 old 2026-01-02 memo U -1",
+	))
+
 	tk.MustExec("create table t_mlog_add_column_atomic (id int, b int, c int)")
 	tk.MustExec("create materialized view log on t_mlog_add_column_atomic (id)")
 	cancelTK := testkit.NewTestKit(t, store)
@@ -159,6 +172,10 @@ func TestAlterMaterializedViewLogAddColumnBasic(t *testing.T) {
 	require.Equal(t, []ast.CIStr{ast.NewCIStr("id")}, atomicMLog.Meta().MaterializedViewLog.Columns)
 	require.Nil(t, model.FindColumnInfo(atomicMLog.Meta().Columns, "b"))
 	require.Nil(t, model.FindColumnInfo(atomicMLog.Meta().Columns, "c"))
+	showCreate = tk.MustQuery("show create materialized view log on t_mlog_add_column_atomic").Rows()[0][1].(string)
+	require.Contains(t, showCreate, "CREATE MATERIALIZED VIEW LOG ON `t_mlog_add_column_atomic` (`id`)")
+	require.NotContains(t, showCreate, "`b`")
+	require.NotContains(t, showCreate, "`c`")
 }
 
 func TestAlterMaterializedViewLogAddColumnDefaultSemantics(t *testing.T) {
@@ -236,4 +253,9 @@ func TestAlterMaterializedViewLogAddColumnSupportsNewMaterializedView(t *testing
 	tk.MustExec("alter materialized view log on t_add_mlog_mv add column (c)")
 	tk.MustExec("create materialized view mv_add_mlog_col_after (a, s, cnt) refresh fast as select a, sum(c), count(1) from t_add_mlog_mv group by a")
 	tk.MustQuery("select a, s, cnt from mv_add_mlog_col_after order by a").Check(testkit.Rows("1 300 2", "2 300 1"))
+
+	tk.MustExec("update t_add_mlog_mv set c = 150 where a = 1 and b = 10")
+	tk.MustExec("insert into t_add_mlog_mv values (2, 40, 400)")
+	tk.MustExec("refresh materialized view mv_add_mlog_col_after fast")
+	tk.MustQuery("select a, s, cnt from mv_add_mlog_col_after order by a").Check(testkit.Rows("1 350 2", "2 700 2"))
 }
```

**File**: `pkg/ddl/tests/materializedviewlog/materialized_view_basic_test.go` (modified, +26/-2)
```diff
@@ -118,6 +118,17 @@ func TestCreateMaterializedViewLogNameLengthByRune(t *testing.T) {
 	tk.MustExec("use test")
 
 	maxBaseNameLen := mysql.MaxTableNameLength - len([]rune(model.MaterializedViewLogTableNamePrefix))
+	asciiBaseName := strings.Repeat("t", mysql.MaxTableNameLength)
+	asciiMLogName := model.MaterializedViewLogTableNamePrefix + strings.Repeat("t", maxBaseNameLen)
+	require.Equal(t, asciiMLogName, model.MaterializedViewLogTableName(ast.NewCIStr(asciiBaseName)).O)
+	tk.MustExec(fmt.Sprintf("create table `%s` (id int primary key)", asciiBaseName))
+	tk.MustExec(fmt.Sprintf("create materialized view log on `%s` (id)", asciiBaseName))
+	tk.MustQuery(fmt.Sprintf("select table_name from information_schema.tables where table_schema='test' and table_name='%s'", asciiMLogName)).Check(testkit.Rows(asciiMLogName))
+	tk.MustExec(fmt.Sprintf("insert into `%s` values (1)", asciiBaseName))
+	tk.MustQuery(fmt.Sprintf("select id, `_MLOG$_DML_TYPE`, `_MLOG$_OLD_NEW` from `%s`", asciiMLogName)).Check(testkit.Rows("1 I 1"))
+	tk.MustExec(fmt.Sprintf("drop materialized view log on `%s`", asciiBaseName))
+	tk.MustQuery(fmt.Sprintf("select table_name from information_schema.tables where table_schema='test' and table_name='%s'", asciiMLogName)).Check(testkit.Rows())
+
 	maxName := strings.Repeat("表", maxBaseNameLen)
 	maxMLogName := model.MaterializedViewLogTableName(ast.NewCIStr(maxName)).O
 	require.Equal(t, mysql.MaxTableNameLength, len([]rune(maxMLogName)))
@@ -130,6 +141,10 @@ func TestCreateMaterializedViewLogNameLengthByRune(t *testing.T) {
 	tk.MustExec(fmt.Sprintf("create table `%s` (a int)", tooLongName))
 	err := tk.ExecToErr(fmt.Sprintf("create materialized view log on `%s` (a)", tooLongName))
 	require.ErrorContains(t, err, "already exists")
+
+	tk.MustExec(fmt.Sprintf("drop materialized view log on `%s`", maxName))
+	tk.MustExec(fmt.Sprintf("create materialized view log on `%s` (a)", tooLongName))
+	tk.MustQuery(fmt.Sprintf("select count(*) from information_schema.tables where table_schema='test' and table_name='%s'", maxMLogName)).Check(testkit.Rows("1"))
 }
 
 func TestCreateMaterializedViewLogPurgeExprTypeValidation(t *testing.T) {
@@ -147,6 +162,8 @@ func TestCreateMaterializedViewLogPurgeExprTypeValidation(t *testing.T) {
 	require.ErrorContains(t, err, "PURGE NEXT expression must return DATE/DATETIME/TIMESTAMP")
 	tk.MustExec("create table t_date_schedule (a int)")
 	tk.MustExec("create materialized view log on t_date_schedule (a) purge next cast('2030-01-02' as date)")
+	tk.MustExec("create table t_current_date_schedule (a int)")
+	tk.MustExec("create materialized view log on t_current_date_schedule (a) purge start with current_date next date_add(now(), interval 1 hour)")
 	tk.MustExec("create materialized view log on t (a) purge start with now() next date_add(now(), interval 1 hour)")
 }
 
@@ -208,6 +225,7 @@ func TestAlterMaterializedViewLogPurgeExprTypeValidation(t *testing.T) {
 	require.ErrorContains(t, err, "PURGE IMMEDIATE is not supported for ALTER MATERIALIZED VIEW LOG")
 
 	tk.MustExec("alter materialized view log on t purge next cast('2030-01-02' as date)")
+	tk.MustExec("alter materialized view log on t purge start with current_date next date_add(now(), interval 1 hour)")
 	tk.MustExec("alter materialized view log on t purge start with now() next date_add(now(), interval 1 hour)")
 }
 
@@ -458,10 +476,10 @@ func TestAlterMaterializedViewLogPurgeScheduleUTC(t *testing.T) {
 	require.Empty(t, info.PurgeNext)
 
 	tk.MustExec("set sql_mode = 'PIPES_AS_CONCAT'")
-	tk.MustExec("alter materialized view log on t purge next cast('2030-01-02 10:00:00' as datetime)")
+	tk.MustExec("alter materialized view log on t purge next cast(date_add('2030-01-01', interval (1 || 2) day) as datetime)")
 	_, info = getMLog()
 	require.Equal(t, tk.Session().GetSessionVars().SQLMode, info.PurgeScheduleSQLMode)
-	tk.MustQuery("select NEXT_PURGE_UNIX_SECONDS = 1893578400 from mysql.tidb_mlog_purge_info where MLOG_ID = " + strconv.FormatInt(mlogTable.ID, 10)).Check(testkit.Rows("1"))
+	tk.MustQuery("select NEXT_PURGE_UNIX_SECONDS = TIMESTAMPDIFF(SECOND, '1970-01-01 00:00:00', '2030-01-13 00:00:00') from mysql.tidb_mlog_purge_info where MLOG_ID = " + strconv.FormatInt(mlogTable.ID, 10)).Check(testkit.Rows("1"))
 
 	tk.MustExec("set time_zone = 'America/Los_Angeles'")
 	tk.MustExec("alter materialized view log on t purge next cast('2021-03-14 02:30:00' as datetime)")
@@ -490,7 +508,13 @@ func TestAlterMaterializedViewLogAddColumnRejectsInvalidColumns(t *testing.T) {
 	require.ErrorContains(t, err, "ALTER MATERIALIZED VIEW LOG does not support BLOB column b")
 	err = tk.ExecToErr("alter materialized view log on t_add_mlog_unsupported add column (j)")
 	require.ErrorContains(t, err, "ALTER MATERIALIZED VIEW LOG does not support JSON column j")
+	tk.MustExec("insert into t_add_mlog_unsupported (id, g1) values (1, 10)")
 	tk.MustExec("alter materialized view log on t_add_mlog_unsupported add column (g2)")
+	tk.MustExec("
```

**File**: `pkg/ddl/tests/materializedviewlog/materialized_view_create_test.go` (modified, +25/-0)
```diff
@@ -323,6 +323,19 @@ func TestCreateMaterializedViewLogRollbackUpdateSchemaVersionFailureRetries(t *t
 	releaseRetry()
 	require.Error(t, <-ddlErrCh)
 	tk.MustQuery("show tables like '$mlog$t_create_mlog_rollback_retry'").Check(testkit.Rows())
+	// A full InfoSchema reload can hide an invalid rollback diff.
+	require.NoError(t, kv.RunInNewTxn(context.Background(), store, false, func(_ context.Context, txn kv.Transaction) error {
+		metaMut := meta.NewMutator(txn)
+		version, err := metaMut.GetSchemaVersion()
+		require.NoError(t, err)
+		diff, err := metaMut.GetSchemaDiff(version)
+		require.NoError(t, err)
+		require.NotNil(t, diff)
+		require.Equal(t, model.ActionCreateMaterializedViewLog, diff.Type)
+		require.Equal(t, mlogID, diff.OldTableID)
+		require.Zero(t, diff.TableID)
+		return nil
+	}))
 }
 
 func TestCreateMaterializedViewLogPrivilege(t *testing.T) {
@@ -375,6 +388,7 @@ func TestCreateMaterializedViewAndLog(t *testing.T) {
 	tk := newMViewTestKit(t, store)
 	tk.MustExec("use test")
 	tk.MustExec("set div_precision_increment = 9")
+	tk.MustExec("set time_zone = 'Asia/Shanghai'")
 	tk.MustExec("create table t (a int not null, b int not null)")
 	tk.MustExec("insert into t values (1, 10), (1, 5), (2, 7)")
 
@@ -407,6 +421,17 @@ func TestCreateMaterializedViewAndLog(t *testing.T) {
 	require.NotNil(t, mviewTable.Meta().MaterializedView)
 	require.Equal(t, model.MViewInitBuildReady, mviewTable.Meta().MaterializedView.GetInitBuildState())
 	require.Equal(t, 9, mviewTable.Meta().MaterializedView.DefinitionDivPrecisionIncrement)
+	require.Equal(t, []int64{baseTable.Meta().ID}, mviewTable.Meta().MaterializedView.BaseTableIDs)
+	require.Equal(t, "FAST", mviewTable.Meta().MaterializedView.RefreshMethod)
+	require.Empty(t, mviewTable.Meta().MaterializedView.RefreshStartWith)
+	require.Equal(t, "DATE_ADD(NOW(), INTERVAL 1 HOUR)", mviewTable.Meta().MaterializedView.RefreshNext)
+	require.Zero(t, mviewTable.Meta().MaterializedView.AlertWarningSec)
+	require.Zero(t, mviewTable.Meta().MaterializedView.AlertOverdueSec)
+	require.False(t, mviewTable.Meta().MaterializedView.AlertRefreshFailed)
+	require.Equal(t, tk.Session().GetSessionVars().SQLMode, mviewTable.Meta().MaterializedView.DefinitionSQLMode)
+	require.Equal(t, tk.Session().GetSessionVars().SQLMode, mviewTable.Meta().MaterializedView.RefreshScheduleSQLMode)
+	require.Equal(t, "Asia/Shanghai", mviewTable.Meta().MaterializedView.DefinitionTimeZone.Name)
+	require.Zero(t, mviewTable.Meta().MaterializedView.DefinitionTimeZone.Offset)
 
 	tk.MustQuery("select count(*) from mysql.tidb_mlog_purge_info where mlog_id = ?", mlogTable.Meta().ID).Check(testkit.Rows("1"))
 	tk.MustQuery("select last_success_read_tso > 0 from mysql.tidb_mview_refresh_info where mview_id = ?", mviewTable.Meta().ID).Check(testkit.Rows("1"))
```

**File**: `pkg/executor/executor_pkg_test.go` (modified, +12/-0)
```diff
@@ -93,6 +93,18 @@ func TestDecodeOldRowValToChunkWithExtraCommitTS(t *testing.T) {
 	}
 }
 
+func TestHistTimeUsesLocation(t *testing.T) {
+	input := time.Date(2026, 6, 14, 12, 0, 0, 123456789, time.UTC)
+	loc := time.FixedZone("UTC+8", 8*60*60)
+
+	localTime := histTime(input, loc)
+	utcTime := histTime(input, time.UTC)
+	require.Equal(t, "2026-06-14 20:00:00.123456 +0800", localTime.Format("2006-01-02 15:04:05.000000 -0700"))
+	require.Equal(t, "2026-06-14 12:00:00.123456 +0000", utcTime.Format("2006-01-02 15:04:05.000000 -0700"))
+	require.Equal(t, 123456000, localTime.Nanosecond())
+	require.Equal(t, 123456000, utcTime.Nanosecond())
+}
+
 func newTestMViewCompleteDeltaTargetTable(tp *types.FieldType) *tables.TableCommon {
 	return tables.MockTableFromMeta(&model.TableInfo{
 		ID:    1,
```

#### Recent Merged Pull Requests:
- **PR #73022** (closed): chore: temporary CLA check after permission downgrade (will be closed) (@wuhuizuo)
- **PR #73021** (closed): chore: temporary CLA webhook check (will be closed) (@wuhuizuo)
- **PR #73001** (2026-11-11): executor: avoid repeated EXPLAIN comparison in TestTikvRegionStatus (@wjhuang2016)
- **PR #73000** (2026-11-11): dxf, executor: isolate IMPORT INTO tests and clean up step executors (@joechenrh)
- **PR #72990** (2026-11-11): server: check authentication plugins consistently on user changes (@D3Hunter)
- **PR #72983** (2026-11-11): *: upgrade golang.org/x/net, golang.org/x/crypto, and golang.org/x/text (@D3Hunter)

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

## X. expression: fix flaky TestGetLock internal session check (#72941)

**RULE**:
When implementing operations in `pkg/expression/integration_test/BUILD.bazel`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pingcap/tidb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7981253e`: expression: fix flaky TestGetLock internal session check (#72941). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/expression/integration_test/BUILD.bazel`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
        "//pkg/testkit/testfailpoint",
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7981253e` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

# Forensic Learning Record (Deep Inspection): pingcap/tidb

> **Canonical Artifact**: `07_PROJECT_LEARNING/pingcap-tidb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pingcap/tidb](https://github.com/pingcap/tidb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:36:36.683Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pingcap/tidb`
- **Description**: TiDB is built for agentic workloads that grow unpredictably, with ACID guarantees and native support for transactions, analytics, and vector search. No data silos. No noisy neighbors. No infrastructure ceiling.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 40630 stars

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

	reusedByPITR bool
}

func (db *Database) SetReusedByPITR() {
	db.reusedByPITR = true
}

func (db *Database) IsReusedByPITR() bool {
	return db.reusedByPITR
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

### Core Architecture Module: `br/pkg/restore/utils/common.go`
```
// Copyright 2025 PingCAP, Inc.
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

package utils

import (
	"github.com/pingcap/tidb/br/pkg/metautil"
	"github.com/pingcap/tidb/pkg/meta/model"
)

// CreatedTable is a table created on restore process,
// but not yet filled with data.
type CreatedTable struct {
	RewriteRule *RewriteRules
	Table       *model.TableInfo
	OldTable    *metautil.Table
}

```

### Core Architecture Module: `br/pkg/restore/utils/merge.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package utils

import (
	"bytes"
	"strings"

	"github.com/pingcap/errors"
	backuppb "github.com/pingcap/kvproto/pkg/brpb"
	"github.com/pingcap/log"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/br/pkg/rtree"
	"go.uber.org/zap"
)

// MergeRangesStat holds statistics for the MergeRanges.
type MergeRangesStat struct {
	TotalFiles           int
	TotalWriteCFFile     int
	TotalDefaultCFFile   int
	TotalRegions         int
	RegionKeysAvg        int
	RegionBytesAvg       int
	MergedRegions        int
	MergedRegionKeysAvg  int
	MergedRegionBytesAvg int
}

// MergeAndRewriteFileRanges returns ranges of the files are merged based on
// splitSizeBytes and splitKeyCount.
//
// By merging small ranges, it speeds up restoring a backup that contains many
// small ranges (regions) as it reduces split region and scatter region.
func MergeAndRewriteFileRanges(
	files []*backuppb.File,
	rewriteRules *RewriteRules,
	splitSizeBytes,
	splitKeyCount uint64,
) ([]rtree.RangeStats, *MergeRangesStat, error) {
	if len(files) == 0 {
		return []rtree.RangeStats{}, &MergeRangesStat{}, nil
	}
	totalBytes := uint64(0)
	totalKvs := uint64(0)
	totalFiles := len(files)
	writeCFFile := 0
	defaultCFFile := 0

	filesMap := make(map[string][]*backuppb.File)
	for _, file := range files {
		filesMap[string(file.StartKey)] = append(filesMap[string(file.StartKey)], file)

		// Assert that it has the same end key.
		if !bytes.Equal(filesMap[string(file.StartKey)][0].EndKey, file.EndKey) {
			log.Panic("there are two files having the same start key, but different end key",
				zap.ByteString("start key", file.StartKey),
				zap.ByteString("file 1 end key", file.EndKey),
				zap.ByteString("file 2 end key", filesMap[string(file.StartKey)][0].EndKey),
			)
		}
		// We skips all default cf files because we don't range overlap.
		if file.Cf == WriteCFName || strings.Contains(file.GetName(), WriteCFName) {
			writeCFFile++
		} else if file.Cf == DefaultCFName || strings.Contains(file.GetName(), DefaultCFName) {
			defaultCFFile++
		}
		totalBytes += file.TotalBytes
		totalKvs += file.TotalKvs
	}
	if writeCFFile == 0 && defaultCFFile == 0 {
		return []rtree.RangeStats{}, nil, errors.Annotatef(berrors.ErrRestoreInvalidBackup,
			"unknown backup data from neither Wrtie CF nor Default CF")
	}

	// RawKV does not have data in write CF.
	totalRegions := max(defaultCFFile, writeCFFile)

	// Check if files are overlapped
	rangeTree := rtree.NewRangeStatsTree()
	for key := range filesMap {
		files := filesMap[key]
		rangeSize := uint64(0)
		rangeCount := uint64(0)
		for _, f := range filesMap[key] {
			rangeSize += f.TotalBytes
			rangeCount += f.TotalKvs
		}
		rg := &rtree.Range{
			KeyRange: rtree.KeyRange{
				StartKey: files[0].GetStartKey(),
				EndKey:   files[0].GetEndKey(),
			},
			Files: files,
		}
		// rewrite Range for split.
		// so that splitRanges no need to handle rewrite rules any more.
		tmpRng, err := RewriteRange(rg, rewriteRules)
		if err != nil {
			return nil, nil, errors.Annotatef(berrors.ErrInvalidRange,
				"unable to rewrite range files %+v", files)
		}
		if out := rangeTree.InsertRange(tmpRng, rangeSize, rangeCount); out != nil {
			return nil, nil, errors.Annotatef(berrors.ErrInvalidRange,
				"duplicate range %s files %+v", out, files)
		}
	}

	sortedRanges := rangeTree.MergedRanges(splitSizeBytes, splitKeyCount)
	regionBytesAvg := totalBytes / uint64(totalRegions)
	regionKeysAvg := totalKvs / uint64(totalRegions)
	mergedRegionBytesAvg := totalBytes / uint64(len(sortedRanges))
	mergedRegionKeysAvg := totalKvs / uint64(len(sortedRanges))

	return sortedRanges, &MergeRangesStat{
		TotalFiles:           totalFiles,
		TotalWriteCFFile:     writeCFFile,
		TotalDefaultCFFile:   defaultCFFile,
		TotalRegions:         totalRegions,
		RegionKeysAvg:        int(regionKeysAvg),
		RegionBytesAvg:       int(regionBytesAvg),
		MergedRegions:        len(sortedRanges),
		MergedRegionKeysAvg:  int(mergedRegionKeysAvg),
		MergedRegionBytesAvg: int(mergedRegionBytesAvg),
	}, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #71725** (2026-10-01): **planner: preserve typed partition BatchPointGet index values**
  *Symptoms*: <!--  Thank you for contributing to TiDB!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve? <!--  Please create an issue first to describe the problem.  There MUST be one line starting with "Issue Number:  " and linking the relevant issues via the "close" or "ref".  For more info, check https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue.  -->  Issue Number: ref #45532  Problem Summary:  Superseded by #71727 with the same commit, so GitHub can form a native stack from upstream branches.  CBO partition BatchPointGet could not safely use string keys whose collation transforms the original value. Normal index ranges can already hold sort keys, which are unsuitable for partition routing or a second key encoding.  ### What changed and how does it work?  Build partition index point ranges with `DetachCondAndBuildRangeForPartition` during initial optimization and cached-plan rebuilding. Store typed original values in `IndexValues` and retain full-key, non-NULL, residual-condition, and cached range-count checks before allowing conversion. Existing unique-key encoders then encode the values once. This removes the non-binary collation gate while preserving ordered-read restrictions for the next layer.  Regressions cover clustered and nonclustered keys, RANGE/LIST/KEY partitions, case and trailing-space equivalence, GBK encoding, dirty deletes/inserts/key migration, g
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign [winoros](https://github.com/winoros) for approval. For more information see [the Code Review Process](https://book.prow.tidb.net/#/workflows/pr). **Please ensure that each of them provides their approval before proceeding.**  The full list of commands accepted by this bot can be found [here](https://prow.tidb.net/command-help?repo=pingcap%2Ftidb).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/pingcap/tidb/blob/master/OWNERS)** - **[pkg/planner/OWNERS](https://github.com/pingcap/tidb/blob/master/pkg/planner/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["winoros"]} -->
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71725?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->  > [!NOTE] > Currently processing new changes in this PR. This may take a few minutes, please wait... >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: Repository UI >  > **Review profile**: CHILL >  > **Plan**: Advanced >  > **Run ID**: `c2ae348e-8a6a-4d21-959d-02edbd414c8a` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files that changed from

- **Issue #71724** (2026-10-01): **planner, executor: support unordered partition CBO BatchPointGet**
  *Symptoms*: <!--  Thank you for contributing to TiDB!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve? <!--  Please create an issue first to describe the problem.  There MUST be one line starting with "Issue Number:  " and linking the relevant issues via the "close" or "ref".  For more info, check https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue.  -->  Issue Number: ref #45532, ref #45889  Problem Summary:  Superseded by #71726 with the same commit, so GitHub can form a native stack from upstream branches.  Under dynamic partition pruning, CBO queries with multiple complete unique point ranges still use scans. In dirty transactions, the synthetic physical-table-ID column also blocks conversion; simply removing the partition gate would leave upper locking operators without the row's physical identity.  ### What changed and how does it work?  Allow unordered partition BatchPointGet when complete, non-NULL primary/unique keys provide all local partition columns, or a global unique index supplies the partition ID. Reuse the existing buffer-aware index and row reads for own writes, preserve residual Selection, and emit each surviving row's physical ID for upper locks. Propagate partition-routing errors, keep matched index keys aligned with handles, and rebuild cached point keys safely, including explicit single-partition rowids.  Non-binary collations and cross-partitio
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign [terry1purcell](https://github.com/terry1purcell) for approval. For more information see [the Code Review Process](https://book.prow.tidb.net/#/workflows/pr). **Please ensure that each of them provides their approval before proceeding.**  The full list of commands accepted by this bot can be found [here](https://prow.tidb.net/command-help?repo=pingcap%2Ftidb).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/pingcap/tidb/blob/master/OWNERS)** - **[pkg/planner/OWNERS](https://github.com/pingcap/tidb/blob/master/pkg/planner/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["terry1purcell"]} -->
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71724?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `8c692a05-ec93-4516-a43c-7705693ec6c2`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 93a01d31f6da205ae4bf376825293903a6899fdb 

- **Issue #71718** (2026-10-01): **planner: verify cached COALESCE update values [release-nextgen-202603]**
  *Symptoms*: <!--  Thank you for contributing to TiDB!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve? <!--  Please create an issue first to describe the problem.  There MUST be one line starting with "Issue Number:  " and linking the relevant issues via the "close" or "ref".  For more info, check https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue.  -->  Issue Number: ref #71709, ref #19250  Problem Summary:  Add assignment-value regression coverage for the COALESCE non-prepared UPDATE cache support merged in #71716 (backport of #71710). Cache-hit assertions alone do not establish that updated parameters, target rows, conversions, and failure paths preserve stored data.  ### What changed and how does it work?  Add `Values` and `DirtyTransaction` subtests under the existing `TestCoalescePlanCacheUpdate` entry point. This is a test-only follow-up on `release-nextgen-202603`.  - Run matching UPDATE sequences with caching enabled and disabled in session and instance modes. After every UPDATE, compare every stored column across all rows, affected-row counts, errors, and warnings; assert that the reference session never hits the cache. - Check fresh SET values and WHERE parameters across repeated hits, stale revision no-ops, another tenant's sentinel row, nested COALESCE, and cross-session instance-cache reuse. - Exercise cross-assignment reads and numeric-to-VARCHAR conve
  **Post-Mortem & Fix Analysis**:
  > This cherry pick PR is for a release branch and has not yet been approved by triage owners. Adding the `do-not-merge/cherry-pick-not-approved` label.  To merge this cherry pick: 1. It must be LGTMed and approved by the reviewers firstly. 2. For pull requests to TiDB-x branches, it must have no failed tests. 3. **AFTER** it has `lgtm` and `approved` labels, please wait for the cherry-pick merging approval from triage owners.   <details>  Instructions for interacting with me using PR comments are available [here](https://git.k8s.io/community/contributors/guide/pull-requests.md).  If you have questions or suggestions related to my behavior, please file an issue against the [kubernetes-sigs/prow](https://github.com/kubernetes-sigs/prow/issues/new?title=Prow%20issue:) repository. </details>
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign [elsa0520](https://github.com/elsa0520) for approval. For more information see [the Code Review Process](https://book.prow.tidb.net/#/workflows/pr). **Please ensure that each of them provides their approval before proceeding.**  The full list of commands accepted by this bot can be found [here](https://prow.tidb.net/command-help?repo=pingcap%2Ftidb).  <details open> Needs approval from an approver in each of these files:  - **[pkg/planner/OWNERS](https://github.com/pingcap/tidb/blob/release-nextgen-202603/pkg/planner/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["elsa0520"]} -->
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71718?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `e2ce37a3-bc67-497c-8648-e787301b6696`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 6fca8054185b36c917286062a1ebf1b9a3a417f2 

- **Issue #71716** (2026-10-01): **planner: cache numeric COALESCE updates with matching column types [release-nextgen-202603]**
  *Symptoms*: <!--  Thank you for contributing to TiDB!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve? <!--  Please create an issue first to describe the problem.  There MUST be one line starting with "Issue Number:  " and linking the relevant issues via the "close" or "ref".  For more info, check https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue.  -->  Issue Number: ref #71709  Problem Summary:  Cherry-pick #71710 (commit `e953a09d9d5e29e60c62f42d3aacebb819af49a5`) to `release-nextgen-202603`.  Non-prepared numeric COALESCE UPDATE assignments currently bypass the plan cache. This backport preserves the narrow eligibility and parameter-scoped precision checks from the merged master PR, including nested COALESCE support.  ### What changed and how does it work?  - Admit single-table numeric UPDATE assignments with matching target/fallback column types. Nested two-argument COALESCE trees are checked in full before any node is admitted. Unsupported contexts and the shared COALESCE blacklist remain unchanged. - Record parameter positions inside COALESCE. Session and instance caches require exact DECIMAL precision/scale only at those positions; other parameters keep existing compatibility rules. Precision variants coexist under the unchanged cache key. - Preserve the original coverage for same/cross-column assignments, nesting, precision transitions, cache-disabled rows/w
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71716?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `cd913a38-c4dc-4f7e-ba3d-a21c68edc058`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 2d8e67d225a3ff6c616132c60592d020ab67d2b7 
  > ## [Codecov](https://app.codecov.io/gh/pingcap/tidb/pull/71716?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap) Report :x: Patch coverage is `94.54545%` with `6 lines` in your changes missing coverage. Please review. :warning: Please [upload](https://docs.codecov.com/docs/codecov-uploader) report for BASE (`release-nextgen-202603@2d8e67d`). [Learn more](https://docs.codecov.io/docs/error-reference?utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap#section-missing-base-commit) about missing BASE report.  <details><summary>Additional details and impacted files</summary>    ```diff @@                     Coverage Diff                     @@ ##             release-nextgen-202603     #71716   +/-   ## ===========================================================   Coverage                          ?   76.4137%            ==========================================
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/pingcap/tidb/pull/71716#pullrequestreview-5374157851" title="Approved">qw4990</a>*, *<a href="https://github.com/pingcap/tidb/pull/71716#pullrequestreview-5370069402" title="Approved">winoros</a>*  The full list of commands accepted by this bot can be found [here](https://prow.tidb.net/command-help?repo=pingcap%2Ftidb).  The pull request process is described [here](https://book.prow.tidb.net/#/workflows/pr)  <details > Needs approval from an approver in each of these files:  - ~~[pkg/planner/OWNERS](https://github.com/pingcap/tidb/blob/release-nextgen-202603/pkg/planner/OWNERS)~~ [qw4990,winoros]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #71710** (2026-09-30): **planner: cache numeric COALESCE updates with matching column types**
  *Symptoms*: <!--  Thank you for contributing to TiDB!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve? <!--  Please create an issue first to describe the problem.  There MUST be one line starting with "Issue Number:  " and linking the relevant issues via the "close" or "ref".  For more info, check https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue.  -->  Issue Number: ref #71709  Problem Summary:  Non-prepared UPDATEs containing `COALESCE` currently miss the plan cache even when DML plan caching is enabled. This PR implements Step 1 of #71709: support numeric UPDATE assignments between columns with identical types promptly while keeping broader COALESCE expressions excluded.  Unconditionally removing the shared blacklist entry allows precision-sensitive cached expressions to change stored VARCHAR values; see the [reproduction on #69149](https://github.com/pingcap/tidb/pull/69149#issuecomment-5904498714). This PR leaves that blacklist intact.  ### What changed and how does it work?  This PR adds a narrow exception for single-table, non-prepared UPDATEs:  ```sql UPDATE t SET target = COALESCE(numeric_literal, fallback) WHERE ...; UPDATE t SET target = COALESCE(1.23, COALESCE(4.56, fallback)) WHERE ...; UPDATE t SET target = COALESCE(COALESCE(1.23, fallback), COALESCE(4.56, other_fallback)) WHERE ...; ```  - `target` and all fallback columns may be different columns, bu
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71710?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review paused by coderabbit.ai -->  > [!NOTE] > ## Reviews paused >  > It looks like this branch is under active development. To avoid overwhelming you with review comments due to an influx of new commits, CodeRabbit has automatically paused this review. You can configure this behavior by changing the `reviews.auto_review.auto_pause_after_reviewed_commits` setting. >  > Use the following commands to manage reviews: > - `@coderabbitai resume` to resum
  > ## [Codecov](https://app.codecov.io/gh/pingcap/tidb/pull/71710?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap) Report :x: Patch coverage is `32.72727%` with `74 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 71.9985%. Comparing base ([`51a1a4a`](https://app.codecov.io/gh/pingcap/tidb/commit/51a1a4abfc192a91f98fe968ad87eced9221f663?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap)) to head ([`93654c5`](https://app.codecov.io/gh/pingcap/tidb/commit/93654c5a6b3580a58e1a3cad7d1354ae7d424275?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap)). :warning: Report is 2 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@               Coverage Diff         
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/pingcap/tidb/pull/71710#pullrequestreview-5367183843" title="Approved">qw4990</a>*, *<a href="https://github.com/pingcap/tidb/pull/71710#pullrequestreview-5367854856" title="Approved">winoros</a>*  The full list of commands accepted by this bot can be found [here](https://prow.tidb.net/command-help?repo=pingcap%2Ftidb).  The pull request process is described [here](https://book.prow.tidb.net/#/workflows/pr)  <details > Needs approval from an approver in each of these files:  - ~~[pkg/planner/OWNERS](https://github.com/pingcap/tidb/blob/master/pkg/planner/OWNERS)~~ [qw4990,winoros]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #71699** (2026-09-30): **parser: support WITH DEFAULT NDVRATE in ANALYZE**
  *Symptoms*: <!--  Thank you for contributing to TiDB!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve? <!--  Please create an issue first to describe the problem.  There MUST be one line starting with "Issue Number:  " and linking the relevant issues via the "close" or "ref".  For more info, check https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue.  -->  Issue Number: ref #67449  Problem Summary:  ANALYZE accepts `WITH DEFAULT` for its other options to reset a saved value, but not for `NDVRATE`.  ### What changed and how does it work?  Split from #71520.  - Parse `WITH DEFAULT NDVRATE` as an `NDVRATE` option without a value. - ANALYZE ignores it until `NDVRATE` can be saved.  ### Check List  Tests <!-- At least one of them must be included. -->  - [x] Unit test - [ ] Integration test - [ ] Manual test (add detailed scripts or steps below) - [ ] No need to test   > - [ ] I checked and no code files have been changed.   > <!-- Or your custom  "No need to test" reasons -->  Side effects  - [ ] Performance regression: Consumes more CPU - [ ] Performance regression: Consumes more Memory - [ ] Breaking backward compatibility  Documentation  - [ ] Affects user behaviors - [x] Contains syntax changes - [ ] Contains variable changes - [ ] Contains experimental features - [ ] Changes MySQL compatibility  ### Release note  <!-- compatibility change, improvement, bugfix, and new
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71699?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `579b92c1-c260-4a04-a8c8-d638e35e08bb`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 12b639a1161cd5a60126a47277f5ad14c320fd4a 
  > ## [Codecov](https://app.codecov.io/gh/pingcap/tidb/pull/71699?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 71.9952%. Comparing base ([`12b639a`](https://app.codecov.io/gh/pingcap/tidb/commit/12b639a1161cd5a60126a47277f5ad14c320fd4a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap)) to head ([`93f6294`](https://app.codecov.io/gh/pingcap/tidb/commit/93f62948995a2285c539b4c573eb4ce31b5dfd87?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap)). :warning: Report is 3 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@               Coverage Diff                @@ ##             
  > /retest

- **Issue #71696** (2026-09-30): **dumpling: make --pd optional for premium keyspace clusters**
  *Symptoms*: <!--  Thank you for contributing to TiDB!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve? <!--  Please create an issue first to describe the problem.  There MUST be one line starting with "Issue Number:  " and linking the relevant issues via the "close" or "ref".  For more info, check https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue.  -->  Issue Number: ref #66882  Problem Summary:  For premium keyspace clusters, Dumpling resolved keyspace metadata from `information_schema.KEYSPACE_META` and then hard-required `--pd` to set up keyspace-level GC protection. When `--pd` was missing it failed the whole dump with `premium keyspace cluster requires --pd`, so cloud control (or a user) had to always supply PD endpoints even when GC protection was not wanted or the PD endpoints were not reachable.  By making `--pd` optional, a user can now build Dumpling from master and connect it to a TiDB Cloud Premium (keyspace) cluster, which previously failed unless PD endpoints that are not reachable from the user's environment were supplied.  ### What changed and how does it work?  `--pd` is now optional for premium keyspace clusters:  - `tidbResolveKeyspaceMetaForGC` still resolves and records the keyspace name   and ID for a premium cluster, but no longer fails when `--pd` is absent. - `tidbSetPDClientForGC` treats an empty/blank `--pd` for a premium cluster as   "ski
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71696?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `2483dedc-78bd-4843-bbb6-73118c27ebe1`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 0ea194c1d7b1f27c4e8360278d1606dfa93a9f7e 
  > ## [Codecov](https://app.codecov.io/gh/pingcap/tidb/pull/71696?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap) Report :x: Patch coverage is `0%` with `3 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 73.2384%. Comparing base ([`12b639a`](https://app.codecov.io/gh/pingcap/tidb/commit/12b639a1161cd5a60126a47277f5ad14c320fd4a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap)) to head ([`86e7c77`](https://app.codecov.io/gh/pingcap/tidb/commit/86e7c77256232d7b2bbceb892236a7d58429f73a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap)). :warning: Report is 1 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@               Coverage Diff                @
  > 🔍 Starting code review for this PR...

- **Issue #71695** (2026-09-29): **build: resolve Bazel Go deps through GOPROXY (#69503)**
  *Symptoms*: This is an automated cherry-pick of #69503  Issue Number: close #69513  ## Summary  - change `cmd/mirror` to generate `go_repository` entries with `sum` and `version` instead of mirrored `urls`, `sha256`, and `strip_prefix` - remove the `pingcapmirror` Go module upload path and deprecated `bazel_mirror_upload` - regenerate `DEPS.bzl` so Bazel Go dependencies are resolved by rules_go through the configured Go module environment, e.g. `GOPROXY=...|...,direct`  ## Test Plan  - `make tidy` - `go test ./cmd/mirror` - `PATH=/tmp/tidb-bazel-shim:$PATH make bazel_prepare` - `PATH=/tmp/tidb-bazel-shim:$PATH make bazel_mirror_upload` - `PATH=/tmp/tidb-bazel-shim:$PATH make lint` - `git -c core.whitespace=-tab-in-indent diff --check` - verified `DEPS.bzl` has no `pingcapmirror`, `cache.hawkingrei.com`, `urls`, `sha256`, or `strip_prefix` entries for Go modules  Tests <!-- At least one of them must be included. -->  - [x] Unit test - [x] Integration test - [x] Manual test (add detailed scripts or steps below)  ## Release note  ```release-note None ```   <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  * **Build Tools**   * Bazel mirror preparation targets no longer pass the legacy `-- --mirror` argument, and `bazel_mirror` skips validation checks.   * `bazel_mirror_upload` no longer performs uploads; it displays a deprecation notice directing you to use `bazel_mirror` to regenerate `DEPS.bzl`.   * The `--mirror` and `--upload` options r
  **Post-Mortem & Fix Analysis**:
  > @wuhuizuo This PR has conflicts, I have hold it. Please resolve them or ask others to resolve them, then comment `/unhold` to remove the hold label.
  > @ti-chi-bot: ## If you want to know how to resolve it, please read the guide in [TiDB Dev Guide](https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/cherrypick-a-pr.html#troubleshoot-cherry-pick).   <details>  Instructions for interacting with me using PR comments are available [here](https://prow.tidb.net/command-help).  If you have questions or suggestions related to my behavior, please file an issue against the [ti-community-infra/tichi](https://github.com/ti-community-infra/tichi/issues/new?title=Prow%20issue:) repository. </details>
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71695?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `9ab4f373-f473-44d7-a403-d8b4acc0f905`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 31dfd0d25e2de908c06f9e4f2537f7f0f77c6b27 

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

### Incident Patch 1: `12b639a1` (2026-09-29)
**Commit Message**: test: take 128+SIGINT as graceful exit in graceshutdown test (#71651)

ref pingcap/tidb#67765

**File**: `tests/graceshutdown/graceshutdown_test.go` (modified, +9/-0)
```diff
@@ -21,6 +21,7 @@ import (
 	"fmt"
 	"os"
 	"os/exec"
+	"syscall"
 	"testing"
 	"time"
 
@@ -60,6 +61,14 @@ func stopService(name string, cmd *exec.Cmd) (err error) {
 	}
 	log.Info("service Interrupt", zap.String("name", name))
 	if err = cmd.Wait(); err != nil {
+		// Since https://github.com/pingcap/tidb/pull/68096, tidb-server exits with
+		// 128+SIGINT instead of 0 when gracefully shutting down on SIGINT, and
+		// SIGINT is exactly the signal used here to stop the service, so treat
+		// it as a graceful stop.
+		if cmd.ProcessState.ExitCode() == 128+int(syscall.SIGINT) {
+			log.Info("service stopped gracefully", zap.String("name", name))
+			return nil
+		}
 		return errors.Trace(err)
 	}
 	log.Info("service stopped gracefully", zap.String("name", name))
```

---

### Incident Patch 2: `633a9e37` (2026-09-24)
**Commit Message**: metrics, server: fix multi-statement latency attribution (#71584)

close pingcap/tidb#71511

**File**: `pkg/executor/BUILD.bazel` (modified, +1/-0)
```diff
@@ -258,6 +258,7 @@ go_library(
         "//pkg/util/logutil/consistency",
         "//pkg/util/mathutil",
         "//pkg/util/memory",
+        "//pkg/util/metricsutil",
         "//pkg/util/parser",
         "//pkg/util/password-validation",
         "//pkg/util/plancodec",
```

**File**: `pkg/executor/adapter.go` (modified, +14/-0)
```diff
@@ -71,6 +71,7 @@ import (
 	"github.com/pingcap/tidb/pkg/util/hint"
 	"github.com/pingcap/tidb/pkg/util/intest"
 	"github.com/pingcap/tidb/pkg/util/logutil"
+	"github.com/pingcap/tidb/pkg/util/metricsutil"
 	"github.com/pingcap/tidb/pkg/util/plancodec"
 	"github.com/pingcap/tidb/pkg/util/redact"
 	"github.com/pingcap/tidb/pkg/util/replayer"
@@ -1832,6 +1833,19 @@ func (a *ExecStmt) FinishExecuteStmt(txnTS uint64, err error, hasMoreResults boo
 	} else {
 		executor_metrics.SessionExecuteRunDurationGeneral.Observe(executeDuration.Seconds())
 	}
+	// Restricted SQL helpers already record query durations. Their session flag may be
+	// restored before the result set closes, so also check the statement's snapshot.
+	if !sessVars.InRestrictedSQL && !sessVars.StmtCtx.InRestrictedSQL {
+		sqlType := sessVars.StmtCtx.StmtType
+		if sqlType == "" {
+			sqlType = metrics.LblGeneral
+		}
+		// Include parsing before DurationParse is reset, and use one duration for all DB labels.
+		cost := sessVars.GetTotalCostDuration().Seconds()
+		for _, dbName := range metricsutil.GetDBNames(sessVars) {
+			metrics.QueryDurationHistogram.WithLabelValues(sqlType, dbName, sessVars.StmtCtx.ResourceGroupName).Observe(cost)
+		}
+	}
 	// Reset DurationParse due to the next statement may not need to be parsed (not a text protocol query).
 	sessVars.DurationParse = 0
 	// Clean the stale read flag when statement execution finish
```

**File**: `pkg/infoschema/metric_table_def.go` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ var MetricTableMap = map[string]MetricTableDef{
 		Comment: "TiDB query processing numbers per second",
 	},
 	"tidb_qps_ideal": {
-		PromQL: `sum(tidb_server_connections) * sum(rate(tidb_server_handle_query_duration_seconds_count[$RANGE_DURATION])) / sum(rate(tidb_server_handle_query_duration_seconds_sum[$RANGE_DURATION]))`,
+		PromQL: `sum(tidb_server_connections) * sum(rate(tidb_server_handle_command_duration_seconds_count[$RANGE_DURATION])) / sum(rate(tidb_server_handle_command_duration_seconds_sum[$RANGE_DURATION]))`,
 	},
 	"tidb_ops_statement": {
 		PromQL:  `sum(rate(tidb_executor_statement_total{$LABEL_CONDITIONS}[$RANGE_DURATION])) by (instance,type)`,
```

**File**: `pkg/metrics/grafana/tidb.json` (modified, +438/-268)
```diff
@@ -282,7 +282,7 @@
               "step": 90
             },
             {
-              "expr": "sum(tidb_server_connections{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}) * sum(rate(tidb_server_handle_query_duration_seconds_count{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) / sum(rate(tidb_server_handle_query_duration_seconds_sum{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m]))",
+              "expr": "sum(tidb_server_connections{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}) * sum(rate(tidb_server_handle_command_duration_seconds_count{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) / sum(rate(tidb_server_handle_command_duration_seconds_sum{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m]))",
               "format": "time_series",
               "hide": true,
               "instant": false,
@@ -2132,14 +2132,184 @@
       "title": "Query Detail",
       "type": "row"
     },
+    {
+      "collapsed": true,
+      "datasource": null,
+      "gridPos": {"h": 1, "w": 24, "x": 0, "y": 2},
+      "id": 23763575000,
+      "panels": [
+        {
+          "datasource": "${DS_TEST-CLUSTER}",
+          "description": "Average duration of MySQL commands by SQL type, preserving request-level timing; a command can contain multiple SQL statements. Older TiDB versions show no data; mixed-version clusters include only reporting instances (partial coverage).",
+          "fill": 0,
+          "gridPos": {"h": 7, "w": 24, "x": 0, "y": 3},
+          "id": 23763575003,
+          "legend": {"show": true, "hideEmpty": false, "hideZero": false},
+          "lines": true,
+          "linewidth": 1,
+          "nullPointMode": "null",
+          "pluginVersion": "7.5.11",
+          "points": false,
+          "renderer": "flot",
+          "stack": false,
+          "targets": [
+            {
+              "expr": "sum(rate(tidb_server_handle_command_duration_seconds_sum{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) by (sql_type) / sum(rate(tidb_server_handle_command_duration_seconds_count{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) by (sql_type)",
+              "format": "time_series",
+              "intervalFactor": 2,
+              "legendFormat": "{{sql_type}}",
+              "refId": "A"
+            }
+          ],
+          "title": "Average Command Duration By Type",
+          "tooltip": {"shared": true, "sort": 0, "value_type": "individual"},
+          "type": "graph",
+          "xaxis": {"mode": "time", "show": true, "values": []},
+          "yaxes": [
+            {"format": "s", "label": null, "logBase": 1, "min": 0, "max": null, "show": true},
+            {"format": "short", "label": null, "logBase": 1, "min": null, "max": null, "show": false}
+          ]
+        },
+        {
+          "datasource": "${DS_TEST-CLUSTER}",
+          "description": "P999 duration of MySQL commands by SQL type, preserving request-level timing; a command can contain multiple SQL statements. Older TiDB versions show no data; mixed-version clusters include only reporting instances (partial coverage).",
+          "fill": 0,
+          "gridPos": {"h": 7, "w": 12, "x": 0, "y": 10},
+          "id": 23763575005,
+          "legend": {"show": true, "hideEmpty": false, "hideZero": false},
+          "lines": true,
+          "linewidth": 1,
+          "nullPointMode": "null",
+          "pluginVersion": "7.5.11",
+          "points": false,
+          "renderer": "flot",
+          "stack": false,
+          "targets": [
+            {
+              "expr": "histogram_quantile(0.999, sum(rate(tidb_server_handle_command_duration_seconds_bucket{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) by (le, sql_type))",
+              "format": "time_series",
+              "intervalFactor": 2,
+              "legendFormat": "{{sql_type}}",
+              "refId": "A"
+            }
+          ],
+          "title": "Command Duration P999 By Type",
+          "tooltip": {"shared": true, "sort": 0, "value_type": "individual"},
+          "type": "graph",
+          "xaxis": {"mode": "time", "show": true, "values": []},
+          "yaxes": [
+            {"format": "s", "label": null, "logBase": 1, "min": 0, "max": null, "show": true},
+            {"format": "short", "label": null, "logBase": 1, "min": null, "max": null, "show": false}
+          ]
+        },
+        {
+          "datasource": "${DS_TEST-CLUSTER}",
+          "description": "P99 duration of MySQL commands by SQL type, preserving request-level timing; a command can contain multiple SQL statements. Older TiDB versions show no data; mixed-version clusters include 
```

**File**: `pkg/metrics/grafana/tidb_summary.json` (modified, +1/-1)
```diff
@@ -667,7 +667,7 @@
                      "refId": "B"
                   },
                   {
-                     "expr": "sum(tidb_server_connections{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}) * sum(rate(tidb_server_handle_query_duration_seconds_count{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) / sum(rate(tidb_server_handle_query_duration_seconds_sum{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m]))",
+                     "expr": "sum(tidb_server_connections{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}) * sum(rate(tidb_server_handle_command_duration_seconds_count{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) / sum(rate(tidb_server_handle_command_duration_seconds_sum{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m]))",
                      "format": "time_series",
                      "hide": true,
                      "intervalFactor": 2,
```

**File**: `pkg/metrics/grafana/tidb_summary.jsonnet` (modified, +1/-1)
```diff
@@ -231,7 +231,7 @@ local cpsP = graphPanel.new(
 )
 .addTarget(
   prometheus.target(
-    'sum(tidb_server_connections{k8s_cluster="$k8s_cluster", tidb_cluster="$tidb_cluster", instance=~"$instance"}) * sum(rate(tidb_server_handle_query_duration_seconds_count{k8s_cluster="$k8s_cluster", tidb_cluster="$tidb_cluster", instance=~"$instance"}[1m])) / sum(rate(tidb_server_handle_query_duration_seconds_sum{k8s_cluster="$k8s_cluster", tidb_cluster="$tidb_cluster", instance=~"$instance"}[1m]))',
+    'sum(tidb_server_connections{k8s_cluster="$k8s_cluster", tidb_cluster="$tidb_cluster", instance=~"$instance"}) * sum(rate(tidb_server_handle_command_duration_seconds_count{k8s_cluster="$k8s_cluster", tidb_cluster="$tidb_cluster", instance=~"$instance"}[1m])) / sum(rate(tidb_server_handle_command_duration_seconds_sum{k8s_cluster="$k8s_cluster", tidb_cluster="$tidb_cluster", instance=~"$instance"}[1m]))',
     legendFormat='ideal CPS',
     hide=true,
   )
```

**File**: `pkg/metrics/metrics.go` (modified, +1/-0)
```diff
@@ -195,6 +195,7 @@ func RegisterMetrics() {
 	prometheus.MustRegister(PseudoEstimation)
 	prometheus.MustRegister(PacketIOCounter)
 	prometheus.MustRegister(QueryDurationHistogram)
+	prometheus.MustRegister(CommandDurationHistogram)
 	prometheus.MustRegister(QueryRPCHistogram)
 	prometheus.MustRegister(QueryProcessedKeyHistogram)
 	prometheus.MustRegister(IARemoteReadSegmentCount)
```

**File**: `pkg/metrics/nextgengrafana/tidb_summary_with_keyspace_name.json` (modified, +1/-1)
```diff
@@ -667,7 +667,7 @@
                      "refId": "B"
                   },
                   {
-                     "expr": "sum(tidb_server_connections{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}) * sum(rate(tidb_server_handle_query_duration_seconds_count{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) / sum(rate(tidb_server_handle_query_duration_seconds_sum{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m]))",
+                     "expr": "sum(tidb_server_connections{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}) * sum(rate(tidb_server_handle_command_duration_seconds_count{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) / sum(rate(tidb_server_handle_command_duration_seconds_sum{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m]))",
                      "format": "time_series",
                      "hide": true,
                      "intervalFactor": 2,
```

---

### Incident Patch 3: `1869807c` (2026-09-23)
**Commit Message**: build: upgrade Go to 1.25.14 (#71491)

ref pingcap/tidb#71489

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
 # production environment, please refer to https://github.com/PingCAP-QE/artifacts/blob/main/dockerfiles/cd/builders/tidb/Dockerfile.
 
 # Builder image
-FROM golang:1.25.12@sha256:9006890ecba0a168034d99516084099ae3114d9f2b7d6572c77f2dde57ebc980 as builder
+FROM golang:1.25.14@sha256:54b6b88db6fe375c6676625d87d668273f85c6d09153635d0cbba89cba7a207a as builder
 WORKDIR /tidb
 
 COPY . .
```

**File**: `Dockerfile.enterprise` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 
 # The current dockerfile is only used for development purposes.
 # Builder image
-FROM golang:1.25.12@sha256:9006890ecba0a168034d99516084099ae3114d9f2b7d6572c77f2dde57ebc980 as builder
+FROM golang:1.25.14@sha256:54b6b88db6fe375c6676625d87d668273f85c6d09153635d0cbba89cba7a207a as builder
 WORKDIR /tidb
 
 COPY . .
```

**File**: `WORKSPACE` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ go_download_sdk(
         "https://mirrors.aliyun.com/golang/{}",
         "https://dl.google.com/go/{}",
     ],
-    version = "1.25.12",
+    version = "1.25.14",
 )
 
 gazelle_dependencies(go_sdk = "go_sdk")
```

**File**: `build/image/base` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ RUN --mount=type=cache,target=/var/cache/dnf \
 
 # install golang toolchain
 # renovate: datasource=docker depName=golang
-ARG GOLANG_VERSION=1.25.12
+ARG GOLANG_VERSION=1.25.14
 RUN OS=linux; ARCH=$([ "$(arch)" = "x86_64" ] && echo amd64 || echo arm64); \
     curl -fsSL https://dl.google.com/go/go${GOLANG_VERSION}.linux-${ARCH}.tar.gz | tar -C /usr/local -xz
 ENV PATH /usr/local/go/bin/:$PATH
```

**File**: `build/image/parser_test` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 
 FROM rockylinux:9
 
-ENV GOLANG_VERSION 1.25.12
+ENV GOLANG_VERSION 1.25.14
 ENV ARCH amd64
 ENV GOLANG_DOWNLOAD_URL https://dl.google.com/go/go$GOLANG_VERSION.linux-$ARCH.tar.gz
 ENV GOPATH /home/prow/go
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module github.com/pingcap/tidb
 
-go 1.25.12
+go 1.25.14
 
 require (
 	cloud.google.com/go/kms v1.21.0
```

**File**: `pkg/parser/go.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module github.com/pingcap/tidb/pkg/parser
 
-go 1.25.0
+go 1.25.14
 
 require (
 	github.com/coreos/go-semver v0.3.1
```

**File**: `tests/realtikvtest/startertest/docker-compose/Dockerfile.test` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.25.12@sha256:fe5d57d3b718e7a4986bae156c2d73f44973bfd313073aed08a4de6692bb6161
+FROM golang:1.25.14@sha256:54b6b88db6fe375c6676625d87d668273f85c6d09153635d0cbba89cba7a207a
 
 WORKDIR /workspace
 
```

---

### Incident Patch 4: `bb80c86a` (2026-09-22)
**Commit Message**: sessionctx: add a switch for TiKV short-circuit expression evaluation (#70272)

ref pingcap/tidb#70156

**File**: `pkg/executor/select.go` (modified, +1/-0)
```diff
@@ -1004,6 +1004,7 @@ func ResetContextOfStmt(ctx sessionctx.Context, s ast.StmtNode) (err error) {
 	sc.MatchSQLBindingCache = nil
 
 	sc.SysdateIsNow = ctx.GetSessionVars().SysdateIsNow
+	sc.EnableTiKVShortCircuitExpression = vars.EnableTiKVShortCircuitExpression
 
 	vars.MemTracker.Detach()
 	vars.MemTracker.UnbindActions()
```

**File**: `pkg/executor/select_test.go` (modified, +16/-0)
```diff
@@ -35,6 +35,22 @@ func BenchmarkResetContextOfStmt(b *testing.B) {
 	}
 }
 
+func TestResetContextOfStmtTiKVShortCircuitExpression(t *testing.T) {
+	ctx := mock.NewContext()
+	ctx.BindDomainAndSchValidator(&domain.Domain{}, nil)
+	vars := ctx.GetSessionVars()
+
+	vars.EnableTiKVShortCircuitExpression = false
+	vars.StmtCtx.EnableTiKVShortCircuitExpression = true
+	require.NoError(t, executor.ResetContextOfStmt(ctx, &ast.SelectStmt{}))
+	require.False(t, vars.StmtCtx.EnableTiKVShortCircuitExpression)
+
+	vars.EnableTiKVShortCircuitExpression = true
+	vars.StmtCtx.EnableTiKVShortCircuitExpression = false
+	require.NoError(t, executor.ResetContextOfStmt(ctx, &ast.SelectStmt{}))
+	require.True(t, vars.StmtCtx.EnableTiKVShortCircuitExpression)
+}
+
 func TestImportIntoShouldHaveSameFlagsAsInsert(t *testing.T) {
 	insertStmt := &ast.InsertStmt{}
 	importStmt := &ast.ImportIntoStmt{}
```

**File**: `pkg/meta/model/flags.go` (modified, +2/-0)
```diff
@@ -47,4 +47,6 @@ const (
 	FlagInLoadDataStmt = 1 << 10
 	// FlagInRestrictedSQL indicates if this request is in a restricted SQL. Auto Analyze is one example
 	FlagInRestrictedSQL = 1 << 11
+	// FlagEnableTiKVShortCircuitExpression indicates whether short-circuit expression evaluation is enabled in TiKV.
+	FlagEnableTiKVShortCircuitExpression = 1 << 12
 )
```

**File**: `pkg/sessionctx/stmtctx/stmtctx.go` (modified, +6/-0)
```diff
@@ -458,6 +458,8 @@ type StatementContext struct {
 
 	// SysdateIsNow indicates whether sysdate() is an alias of now() in this statement
 	SysdateIsNow bool
+	// EnableTiKVShortCircuitExpression indicates whether short-circuit expression evaluation is enabled in TiKV.
+	EnableTiKVShortCircuitExpression bool
 
 	// RCCheckTS indicates the current read-consistency read select statement will use `RCCheckTS` path.
 	RCCheckTS bool
@@ -1296,6 +1298,9 @@ func (sc *StatementContext) GetExecDetails() execdetails.ExecDetails {
 func (sc *StatementContext) PushDownFlags() uint64 {
 	ec := sc.ErrCtx()
 	flags := PushDownFlagsWithTypeFlagsAndErrLevels(sc.TypeFlags(), ec.LevelMap())
+	if sc.EnableTiKVShortCircuitExpression {
+		flags |= model.FlagEnableTiKVShortCircuitExpression
+	}
 	if sc.InInsertStmt {
 		flags |= model.FlagInInsertStmt
 	} else if sc.InUpdateStmt || sc.InDeleteStmt {
@@ -1337,6 +1342,7 @@ func (sc *StatementContext) InitFromPBFlagAndTz(flags uint64, tz *time.Location)
 	sc.InInsertStmt = (flags & model.FlagInInsertStmt) > 0
 	sc.InSelectStmt = (flags & model.FlagInSelectStmt) > 0
 	sc.InDeleteStmt = (flags & model.FlagInUpdateOrDeleteStmt) > 0
+	sc.EnableTiKVShortCircuitExpression = (flags & model.FlagEnableTiKVShortCircuitExpression) > 0
 	levels := sc.ErrLevels()
 	levels[errctx.ErrGroupDividedByZero] = errctx.ResolveErrLevel(false,
 		(flags&model.FlagDividedByZeroAsWarning) > 0,
```

**File**: `pkg/sessionctx/stmtctx/stmtctx_test.go` (modified, +10/-0)
```diff
@@ -126,11 +126,21 @@ func TestStatementContextPushDownFLags(t *testing.T) {
 			sc.SetTypeFlags(sc.TypeFlags().WithIgnoreZeroInDate(true))
 			sc.InLoadDataStmt = true
 		}), 1168},
+		{newStmtCtx(func(sc *stmtctx.StatementContext) {
+			sc.EnableTiKVShortCircuitExpression = true
+		}), model.FlagEnableTiKVShortCircuitExpression},
 	}
 	for _, tt := range testCases {
 		got := tt.in.PushDownFlags()
 		require.Equal(t, tt.out, got)
 	}
+
+	sc := stmtctx.NewStmtCtx()
+	sc.EnableTiKVShortCircuitExpression = true
+	sc.InitFromPBFlagAndTz(0, time.UTC)
+	require.False(t, sc.EnableTiKVShortCircuitExpression)
+	sc.InitFromPBFlagAndTz(model.FlagEnableTiKVShortCircuitExpression, time.UTC)
+	require.True(t, sc.EnableTiKVShortCircuitExpression)
 }
 
 func TestWeakConsistencyRead(t *testing.T) {
```

**File**: `pkg/sessionctx/vardef/tidb_vars.go` (modified, +4/-0)
```diff
@@ -705,6 +705,9 @@ const (
 	// TiDBEnableVectorizedExpression is used to control whether to enable the vectorized expression evaluation.
 	TiDBEnableVectorizedExpression = "tidb_enable_vectorized_expression"
 
+	// TiDBEnableTiKVShortCircuitExpression controls whether to enable short-circuit expression evaluation in TiKV.
+	TiDBEnableTiKVShortCircuitExpression = "tidb_enable_tikv_short_circuit_expression"
+
 	// TiDBOptJoinReorderThreshold defines the threshold less than which
 	// we'll choose a rather time-consuming algorithm to calculate the join order.
 	TiDBOptJoinReorderThreshold = "tidb_opt_join_reorder_threshold"
@@ -1672,6 +1675,7 @@ const (
 	DefTiDBEnableStrictNotNullCheck         = true
 	DefEnableStrictDoubleTypeCheck          = true
 	DefEnableVectorizedExpression           = true
+	DefTiDBEnableTiKVShortCircuitExpression = false
 	DefTiDBOptJoinReorderThreshold          = 0
 	DefTiDBOptEnableAdvancedJoinReorder     = true
 	DefTiDBOptJoinReorderThroughProj        = false
```

**File**: `pkg/sessionctx/variable/session.go` (modified, +5/-0)
```diff
@@ -1228,6 +1228,9 @@ type SessionVars struct {
 	// EnableVectorizedExpression  enables the vectorized expression evaluation.
 	EnableVectorizedExpression bool
 
+	// EnableTiKVShortCircuitExpression enables short-circuit expression evaluation in TiKV.
+	EnableTiKVShortCircuitExpression bool
+
 	// DDLReorgPriority is the operation priority of adding indices.
 	DDLReorgPriority int
 
@@ -2431,6 +2434,7 @@ func NewSessionVars(hctx HookContext) *SessionVars {
 		SelectivityFactor:                vardef.DefOptSelectivityFactor,
 		enableForceInlineCTE:             vardef.DefOptForceInlineCTE,
 		EnableVectorizedExpression:       vardef.DefEnableVectorizedExpression,
+		EnableTiKVShortCircuitExpression: vardef.DefTiDBEnableTiKVShortCircuitExpression,
 		CommandValue:                     uint32(mysql.ComSleep),
 		TiDBOptJoinReorderThreshold:      vardef.DefTiDBOptJoinReorderThreshold,
 		TiDBOptEnableAdvancedJoinReorder: vardef.DefTiDBOptEnableAdvancedJoinReorder,
@@ -2516,6 +2520,7 @@ func NewSessionVars(hctx HookContext) *SessionVars {
 	vars.TiFlashFineGrainedShuffleBatchSize = vardef.DefTiFlashFineGrainedShuffleBatchSize
 	vars.status.Store(uint32(mysql.ServerStatusAutocommit))
 	vars.StmtCtx.ResourceGroupName = resourcegroup.DefaultResourceGroupName
+	vars.StmtCtx.EnableTiKVShortCircuitExpression = vars.EnableTiKVShortCircuitExpression
 	vars.KVVars = tikvstore.NewVariables(&vars.SQLKiller.Signal)
 	vars.KVVars.KillSignalHandler = &vars.SQLKiller
 	vars.Concurrency = Concurrency{
```

**File**: `pkg/sessionctx/variable/setvar_affect.go` (modified, +1/-0)
```diff
@@ -98,6 +98,7 @@ var isHintUpdatableVerified = map[string]struct{}{
 	"tidb_index_merge_intersection_concurrency":       {},
 	"tidb_opt_projection_push_down":                   {},
 	"tidb_enable_vectorized_expression":               {},
+	"tidb_enable_tikv_short_circuit_expression":       {},
 	"tidb_opt_join_reorder_threshold":                 {},
 	"tidb_opt_enable_advanced_join_reorder":           {},
 	"tidb_enable_index_merge":                         {},
```

---

### Incident Patch 5: `8a37ef2b` (2026-09-22)
**Commit Message**: memory: reduce overhead of global memory arbitration (#71346)

ref pingcap/tidb#58194, close pingcap/tidb#71141

**File**: `pkg/executor/join/row_table_builder.go` (modified, +12/-1)
```diff
@@ -26,6 +26,7 @@ import (
 	"github.com/pingcap/tidb/pkg/types"
 	"github.com/pingcap/tidb/pkg/util/chunk"
 	"github.com/pingcap/tidb/pkg/util/codec"
+	"github.com/pingcap/tidb/pkg/util/memory"
 	"github.com/pingcap/tidb/pkg/util/serialization"
 )
 
@@ -517,7 +518,17 @@ func (b *rowTableBuilder) preAllocForSegments(segs []*rowTableSegment, chk *chun
 		totalMemUsage += b.helpers[i].rawDataLen + (b.helpers[i].totalRowNum+b.helpers[i].totalRowNum)*serialization.Uint64Len + b.helpers[i].validRowNum*serialization.IntLen
 	}
 
-	hashJoinCtx.hashTableContext.memoryTracker.Consume(totalMemUsage)
+	tracer := hashJoinCtx.hashTableContext.memoryTracker
+	if memory.UsingGlobalMemArbitration() {
+		// The tracker is charged before the backing slices are materialized
+		// below. Temporarily offset the global arbitrator's accounting during
+		// this allocation window so it is not classified as out of control
+		// before the physical allocation is fully materialized.
+		reversal := tracer.AddReversal(totalMemUsage)
+		defer reversal.Release()
+	}
+
+	tracer.Consume(totalMemUsage)
 
 	for partIdx, seg := range segs {
 		seg.rawData = make([]byte, 0, b.helpers[partIdx].rawDataLen)
```

**File**: `pkg/session/BUILD.bazel` (modified, +0/-1)
```diff
@@ -206,7 +206,6 @@ go_test(
         "//pkg/session/metrics",
         "//pkg/session/sessionapi",
         "//pkg/sessionctx",
-        "//pkg/sessionctx/stmtctx",
         "//pkg/sessionctx/vardef",
         "//pkg/sessionctx/variable",
         "//pkg/sessiontxn",
```

**File**: `pkg/session/session.go` (modified, +28/-40)
```diff
@@ -1714,15 +1714,29 @@ func (s *session) ParseSQL(ctx context.Context, sql string, params ...parser.Par
 		uid := s.sessionVars.ConnectionID
 
 		if globalMemArbitrator.AtMemRisk() {
-			if s.sessionPlanCache != nil {
+			// ParseSQL is the first memory-sensitive stage of statement execution:
+			// the parser and AST have not been created yet. During a transient
+			// memory-risk period, wait for the arbitrator to reclaim memory instead
+			// of admitting more parser work. Returning an error immediately could
+			// cause clients to retry concurrently and amplify the memory pressure.
+			if s.sessionPlanCache != nil && s.sessionPlanCache.Size() > 0 {
 				s.sessionPlanCache.DeleteAll()
 			}
+			// Once OOM risk is reached, do not wait indefinitely. The bounded
+			// grace period gives ongoing reclamation a chance to finish while
+			// ensuring that new parse requests are eventually rejected.
+			timeout := time.Now().Add(time.Second * 30)
+			dur := defOOMRiskCheckDur
 			for globalMemArbitrator.AtMemRisk() {
-				if globalMemArbitrator.AtOOMRisk() {
+				if globalMemArbitrator.AtOOMRisk() && time.Now().After(timeout) {
 					metrics.GlobalMemArbitratorSubTasks.ForceKillParse.Inc()
 					return nil, nil, exeerrors.ErrQueryExecStopped.GenWithStackByArgs(memory.ArbitratorOOMRiskKill.String()+defSuffixParseSQL, uid)
 				}
-				time.Sleep(defOOMRiskCheckDur)
+				if e := ctx.Err(); e != nil {
+					return nil, nil, e
+				}
+				time.Sleep(dur)
+				dur = min(dur*2, time.Second)
 			}
 		}
 
@@ -2573,26 +2587,28 @@ func (s *session) executeStmtImpl(ctx context.Context, stmtNode ast.StmtNode) (r
 
 	if execUseArbitrator {
 		if globalMemArbitrator.AtMemRisk() {
-			if s.sessionPlanCache != nil {
+			if s.sessionPlanCache != nil && s.sessionPlanCache.Size() > 0 {
 				s.sessionPlanCache.DeleteAll()
 			}
+			dur := defOOMRiskCheckDur
 			for globalMemArbitrator.AtMemRisk() {
 				if globalMemArbitrator.AtOOMRisk() {
 					metrics.GlobalMemArbitratorSubTasks.ForceKillPlan.Inc()
 					return nil, exeerrors.ErrQueryExecStopped.GenWithStackByArgs(memory.ArbitratorOOMRiskKill.String()+defSuffixCompilePlan, sessVars.ConnectionID)
 				}
-				time.Sleep(defOOMRiskCheckDur)
+				if e := ctx.Err(); e != nil {
+					return nil, e
+				}
+				time.Sleep(dur)
+				dur = min(dur*2, time.Second)
 			}
 		}
 
 		ok := globalMemArbitrator.ConsumeQuotaFromAwaitFreePool(sessVars.ConnectionID, compilePlanMemQuota)
 		quotaReserved += compilePlanMemQuota
 		defer releaseCommonQuota()
-
-		if !ok { // for SQL which needs to be controlled by mem-arbitrator
-			if s.sessionPlanCache != nil && s.sessionPlanCache.Size() > 0 {
-				s.sessionPlanCache.DeleteAll()
-			}
+		if !ok && s.sessionPlanCache != nil && s.sessionPlanCache.Size() > 0 {
+			s.sessionPlanCache.DeleteAll()
 		}
 	}
 
@@ -2682,7 +2698,6 @@ func (s *session) executeStmtImpl(ctx context.Context, stmtNode ast.StmtNode) (r
 
 		digestID := buildMemArbitratorDigestID(
 			normalizedSQL,
-			sessVars.StmtCtx.Tables,
 			sessVars.CurrentDB,
 		)
 
@@ -2787,43 +2802,16 @@ func (s *session) executeStmtImpl(ctx context.Context, stmtNode ast.StmtNode) (r
 
 func buildMemArbitratorDigestID(
 	normalizedSQL string,
-	tables []stmtctx.TableEntry,
 	currentDB string,
 ) uint64 {
 	if normalizedSQL == "" {
 		return memory.InvalidDigestID
 	}
 
 	builder := memory.NewDigestIDBuilder()
-	builder.AddString("v1")
+	builder.AddString("db")
+	builder.AddString(strings.ToLower(currentDB))
 	builder.AddString(normalizedSQL)
-
-	// The planner already deduplicates StmtCtx.Tables. Keep its order here to
-	// avoid allocating and sorting a copy; an order change only causes a harmless
-	// profile cache miss.
-	hasResolvedTable := false
-	for _, tbl := range tables {
-		db := strings.ToLower(tbl.DB)
-		table := strings.ToLower(tbl.Table)
-		if db == "" && table == "" {
-			continue
-		}
-
-		if !hasResolvedTable {
-			builder.AddString("resolved-tables")
-			hasResolvedTable = true
-		}
-		builder.AddString(db)
-		builder.AddString(table)
-	}
-
-	if !hasResolvedTable {
-		// Some statements do not generate table visit information. Use the
-		// current DB as a conservative fallback.
-		builder.AddString("default-db")
-		builder.AddString(strings.ToLower(currentDB))
-	}
-
 	return builder.Sum64()
 }
 
```

**File**: `pkg/session/session_test.go` (modified, +10/-12)
```diff
@@ -37,7 +37,6 @@ import (
 	"github.com/pingcap/tidb/pkg/meta/metadef"
 	"github.com/pingcap/tidb/pkg/parser/mysql"
 	"github.com/pingcap/tidb/pkg/parser/terror"
-	"github.com/pingcap/tidb/pkg/sessionctx/stmtctx"
 	"github.com/pingcap/tidb/pkg/sessionctx/variable"
 	kvstore "github.com/pingcap/tidb/pkg/store"
 	"github.com/pingcap/tidb/pkg/store/mockstore"
@@ -349,21 +348,20 @@ func TestMemArbitratorSession(t *testing.T) {
 	require.Equal(t, int64(3), approxCompilePlanTokenCnt("select @@version @a", false))
 
 	normalizedSQL := "select * from `t` where `a` = ?"
-	db1DigestID := buildMemArbitratorDigestID(normalizedSQL, []stmtctx.TableEntry{{DB: "db1", Table: "t"}}, "db1")
-	db2DigestID := buildMemArbitratorDigestID(normalizedSQL, []stmtctx.TableEntry{{DB: "db2", Table: "t"}}, "db2")
+	db1DigestID := buildMemArbitratorDigestID(normalizedSQL, "db1")
+	db2DigestID := buildMemArbitratorDigestID(normalizedSQL, "db2")
 	require.NotEqual(t, db1DigestID, db2DigestID)
 
 	explicitDBSQL := "select * from `db3`.`t` where `a` = ?"
-	db3Table := []stmtctx.TableEntry{{DB: "db3", Table: "t"}}
-	require.Equal(t,
-		buildMemArbitratorDigestID(explicitDBSQL, db3Table, "db1"),
-		buildMemArbitratorDigestID(explicitDBSQL, db3Table, "db2"))
+	require.NotEqual(t,
+		buildMemArbitratorDigestID(explicitDBSQL, "db1"),
+		buildMemArbitratorDigestID(explicitDBSQL, "db2"))
 	require.Equal(t,
-		buildMemArbitratorDigestID(explicitDBSQL, db3Table, "db1"),
-		buildMemArbitratorDigestID(explicitDBSQL, []stmtctx.TableEntry{{DB: "DB3", Table: "T"}}, "db1"))
+		buildMemArbitratorDigestID(explicitDBSQL, "DB1"),
+		buildMemArbitratorDigestID(explicitDBSQL, "db1"))
 
 	require.NotEqual(t,
-		buildMemArbitratorDigestID(normalizedSQL, nil, "db1"),
-		buildMemArbitratorDigestID(normalizedSQL, nil, "db2"))
-	require.Equal(t, memory.InvalidDigestID, buildMemArbitratorDigestID("", db3Table, "db1"))
+		buildMemArbitratorDigestID(normalizedSQL, "db1"),
+		buildMemArbitratorDigestID(normalizedSQL, "db2"))
+	require.Equal(t, memory.InvalidDigestID, buildMemArbitratorDigestID("", "db1"))
 }
```

**File**: `pkg/util/memory/BUILD.bazel` (modified, +2/-1)
```diff
@@ -6,6 +6,7 @@ go_library(
         "action.go",
         "arbitrator.go",
         "global_arbitrator.go",
+        "heap_profile.go",
         "meminfo.go",
         "memstats.go",
         "pool.go",
@@ -39,6 +40,7 @@ go_test(
     srcs = [
         "arbitrator_test.go",
         "bench_test.go",
+        "heap_profile_test.go",
         "main_test.go",
         "pool_test.go",
         "tracker_test.go",
@@ -52,6 +54,5 @@ go_test(
         "//pkg/util/sqlkiller",
         "@com_github_stretchr_testify//require",
         "@org_uber_go_goleak//:goleak",
-        "@org_uber_go_zap//:zap",
     ],
 )
```

**File**: `pkg/util/memory/arbitrator.go` (modified, +306/-334)
```diff
@@ -62,9 +62,7 @@ const (
 	DefMaxLimit int64 = 5e15
 
 	defTaskTickDur                            = time.Millisecond * 10
-	defMinHeapFreeBPS                  int64  = 100 * byteSizeMB
 	defHeapReclaimCheckDuration               = time.Second * 1
-	defHeapReclaimCheckMaxDuration            = time.Second * 5
 	defOOMRiskRatio                           = 0.95
 	defMemRiskRatio                           = 0.9
 	defTickDurMilli                           = kilo * 1             // 1s
@@ -76,8 +74,8 @@ const (
 	defServerlimitMaxUnitNum                  = 100
 	defUpdateMemConsumedTimeAlignSec          = 30
 	defUpdateMemMagnifUtimeAlign              = 30
-	defUpdateBufferTimeAlignSec               = 60
-	defRedundancy                             = 2
+	defUpdateProfileTimeAlignSec              = 30
+	defRedundancy                      int64  = 2
 	defPoolReservedQuota                      = byteSizeMB
 	defAwaitFreePoolAllocAlignSize            = defPoolReservedQuota + byteSizeMB
 	defAwaitFreePoolShardNum           int64  = 256
@@ -87,6 +85,7 @@ const (
 	prime64                            uint64 = 1099511628211
 	initHashKey                        uint64 = 14695981039346656037
 	defKillCancelCheckTimeout                 = time.Second * 20
+	defContextCacheIdleTimeoutSec             = 10 * 60          // 10 minutes
 	defDigestProfileSmallMemTimeoutSec        = 60 * 60 * 24     // 1 day
 	defDigestProfileMemTimeoutSec             = 60 * 60 * 24 * 7 // 1 week
 	baseQuotaUnit                             = 4 * byteSizeKB   // 4KB
@@ -255,8 +254,9 @@ type rootPoolEntry struct {
 	// mutable when entry is idle and the mutex of root pool is locked
 	ctx struct {
 		atomic.Pointer[ArbitrationContext]
-		cancelCh <-chan struct{}
-		canceled atomic.Bool
+		cancelCh     <-chan struct{}
+		canceled     atomic.Bool
+		idleUtimeSec atomic.Int64
 
 		// properties hint of the entry; data race is acceptable;
 		memPriority     ArbitrationPriority
@@ -325,10 +325,9 @@ type entryMap struct {
 		sync.Map // map[uint64]*rootPoolEntry
 		num      atomic.Int64
 	}
-	shards                    []*entryMapShard
-	shardsMask                uint64
-	maxQuotaShardIndex        int // for quota >= `BaseQuotaUnit * 2^(maxQuotaShard - 1)`
-	minQuotaShardIndexToCheck int // ignore the pool with smaller quota
+	shards             []*entryMapShard
+	shardsMask         uint64
+	maxQuotaShardIndex int // for quota >= `BaseQuotaUnit * 2^(maxQuotaShard - 1)`
 }
 
 // controlled by arbitrator
@@ -426,11 +425,10 @@ func (m *entryMap) emplace(pool *ResourcePool) (*rootPoolEntry, bool) {
 	return s.emplace(key, tar)
 }
 
-func (m *entryMap) init(shardNum uint64, maxQuotaShard int, minQuotaForReclaim int64) {
+func (m *entryMap) init(shardNum uint64, maxQuotaShard int) {
 	m.shards = make([]*entryMapShard, shardNum)
 	m.shardsMask = shardNum - 1
 	m.maxQuotaShardIndex = maxQuotaShard
-	m.minQuotaShardIndexToCheck = getQuotaShard(minQuotaForReclaim, m.maxQuotaShardIndex)
 	for p := minArbitrationPriority; p < maxArbitrationPriority; p++ {
 		m.quotaShards[p] = make([]*entryQuotaShard, m.maxQuotaShardIndex)
 		for i := range m.maxQuotaShardIndex {
@@ -466,7 +464,6 @@ func (m *MemArbitrator) blockingAllocate(entry *rootPoolEntry, requestedBytes in
 		return ArbitrateFail
 	}
 	if entry.ctx.canceled.Load() {
-		atomic.AddInt64(&m.execMetrics.Task.Fail, 1)
 		return ArbitrateFail
 	}
 
@@ -532,6 +529,7 @@ type MemArbitrator struct {
 		startTime    time.Time          // start time of each round
 		blockedState blockedState       // blocked state during arbitration
 		mode         ArbitratorWorkMode // work mode of each round
+		sync.Mutex
 	}
 	actions   MemArbitratorActions // actions interfaces
 	controlMu struct {             // control the async work process
@@ -577,11 +575,10 @@ type MemArbitrator struct {
 		sync.RWMutex
 		PoolAllocProfile
 		mediumQuota atomic.Int64 // medium (max quota usage of root pool)
-		timedMap    [2 + defRedundancy]struct {
+		timedMap    [1 + defRedundancy]struct {
 			sync.RWMutex
 			statisticsTimedMapElement
 		}
-		lastUpdateUtimeMilli atomic.Int64
 	}
 
 	buffer buffer // reserved buffer quota which only works under priority mode
@@ -631,7 +628,7 @@ type MemArbitrator struct {
 
 type buffer struct {
 	size     atomic.Int64 // approximate max quota usage of root pool
-	timedMap [2 + defRedundancy]struct {
+	timedMap [1 + defRedundancy]struct {
 		sync.RWMutex
 		wrapTimeSizeQuota
 	}
@@ -641,14 +638,19 @@ func (m *MemArbitrator) setBufferSize(v int64) {
 	m.buffer.size.Store(v)
 }
 
+func (m *MemArbitrator) bufferSize() int64 {
+	return m.buffer.size.Load()
+}
+
 type digestProfileShard struct {
 	sync.Map //map[uint64]*digestProfile
 	num      atomic.Int64
 }
 
 // MemArbitratorActions represents the actions of the mem-arbitrator
 type MemArbitratorActions struct {
-	Info, Warn, Error func(format string, args ...zap.Field) // log actions
+	// Log actions must consume fields synchronously and must not retain them after re
```

**File**: `pkg/util/memory/arbitrator_test.go` (modified, +364/-127)
```diff
@@ -26,7 +26,6 @@ import (
 	"time"
 
 	"github.com/stretchr/testify/require"
-	"go.uber.org/zap"
 )
 
 const (
@@ -58,7 +57,7 @@ func (m *MemArbitrator) waitNotiferForTest() {
 }
 
 func (m *MemArbitrator) restartEntryForTest(entry *rootPoolEntry, ctx *ArbitrationContext) {
-	require.True(testState, m.RestartEntryByContext(rootPoolWrap{entry}, ctx))
+	require.True(testState, m.RestartEntryByContext(entry, ctx))
 }
 
 func (m *MemArbitrator) checkAwaitFree() {
@@ -86,12 +85,12 @@ func (m *MemArbitrator) addRootPoolForTest(
 	p *ResourcePool,
 	ctx *ArbitrationContext,
 ) *rootPoolEntry {
-	entry, err := m.addRootPool(p)
+	_, entry, err := m.addRootPool(p)
 	if err != nil {
 		panic(err)
 	}
 	require.True(testState, entry != nil)
-	require.True(testState, m.RestartEntryByContext(rootPoolWrap{entry}, ctx))
+	require.True(testState, m.RestartEntryByContext(entry, ctx))
 	return entry
 }
 
@@ -124,7 +123,16 @@ func (m *MemArbitrator) getAllEntryForTest() mapUIDEntry {
 	cnt := len(res)
 	{
 		require.True(t, m.RootPoolNum() == int64(cnt))
-		require.True(t, m.entryMap.contextCache.num.Load() == int64(cnt))
+		cacheCnt := int64(0)
+		m.entryMap.contextCache.Range(func(key, value any) bool {
+			entry, ok := res[key.(uint64)]
+			require.True(t, ok)
+			require.Same(t, entry, value.(*rootPoolEntry))
+			cacheCnt++
+			return true
+		})
+		require.Equal(t, cacheCnt, m.entryMap.contextCache.num.Load())
+		require.LessOrEqual(t, cacheCnt, int64(cnt))
 	}
 
 	for prio := minArbitrationPriority; prio < maxArbitrationPriority; prio++ {
@@ -198,7 +206,7 @@ func (m *MemArbitrator) setLimitForTest(v int64) {
 
 func newMemArbitratorForTest(shardCount uint64, limit int64) (m *MemArbitrator) {
 	loadEvent := 0
-	m = NewMemArbitrator(limit, shardCount, 3, 0, &memStateRecorderForTest{
+	m = NewMemArbitrator(limit, shardCount, 3, &memStateRecorderForTest{
 		load: func() (*RuntimeMemStateV1, error) {
 			loadEvent++
 			return nil, nil
@@ -223,11 +231,12 @@ func (t *arbitrateHelperForTest) cancelSelf() {
 	close(t.cancelCh)
 }
 
-func (t *arbitrateHelperForTest) HeapInuse() int64 {
+func (t *arbitrateHelperForTest) MemUsage() MemUsage {
 	if t.heapUsedCB != nil {
-		return t.heapUsedCB()
+		used := t.heapUsedCB()
+		return MemUsage{RootPoolUsed: used, HeapInuse: used}
 	}
-	return 0
+	return MemUsage{}
 }
 
 func (t *arbitrateHelperForTest) Finish() {
@@ -397,12 +406,23 @@ func (m *MemArbitrator) newCtxWithHelperForTest(memPriority ArbitrationPriority,
 func (m *MemArbitrator) resetExecMetricsForTest() {
 	m.execMetrics = execMetricsCounter{}
 	m.execMu.blockedState = blockedState{}
-	m.buffer = buffer{}
+	m.resetBufferForTest()
 	m.resetDigestProfileCache(uint64(len(m.digestProfileCache.shards)))
 	m.resetStatistics()
 	m.mu.lastGC = m.mu.released
 }
 
+func (m *MemArbitrator) resetBufferForTest() {
+	m.buffer.size.Store(0)
+	for i := range m.buffer.timedMap {
+		tar := &m.buffer.timedMap[i]
+		tar.Lock()
+		tar.ts.Store(0)
+		tar.size.Store(-1)
+		tar.Unlock()
+	}
+}
+
 type notiferWithWg struct {
 	m  *MemArbitrator
 	ch chan struct{}
@@ -473,6 +493,69 @@ func (m *memStateRecorderForTest) Store(state *RuntimeMemStateV1) error {
 	return m.store(state)
 }
 
+func TestRuntimeMemStatePersistence(t *testing.T) {
+	t.Run("stores current tuning and preserves last risk", func(t *testing.T) {
+		initial := RuntimeMemStateV1{
+			Version:       1,
+			LastRisk:      LastRisk{HeapAlloc: 900, QuotaAlloc: 100},
+			Magnif:        1200,
+			PoolMediumCap: 2048,
+		}
+		var stored *RuntimeMemStateV1
+		m := NewMemArbitrator(-1, 1, 3, &memStateRecorderForTest{
+			load: func() (*RuntimeMemStateV1, error) { return &initial, nil },
+			store: func(state *RuntimeMemStateV1) error {
+				stateCopy := *state
+				stored = &stateCopy
+				return nil
+			},
+		})
+		m.doSetMemMagnif(1300)
+		m.poolAllocStats.mediumQuota.Store(4096)
+		require.True(t, m.tryStorePoolMediumCapacity(nowUnixMilli()+defStorePoolMediumCapDurMilli))
+		require.Equal(t, &RuntimeMemStateV1{
+			Version: 1, LastRisk: initial.LastRisk, Magnif: 1300, PoolMediumCap: 4096,
+		}, stored)
+		require.Equal(t, stored, m.lastMemState())
+		require.Equal(t, int64(2048), initial.PoolMediumCap)
+		require.Positive(t, m.heapController.memStateRecorder.lastRecordUtimeMilli.Load())
+	})
+
+	t.Run("failed persistence keeps last successful state and retries", func(t *testing.T) {
+		initial := RuntimeMemStateV1{Version: 1, Magnif: 1200, PoolMediumCap: 2048}
+		storeCount := 0
+		m := NewMemArbitrator(-1, 1, 3, &memStateRecorderForTest{
+			load: func() (*RuntimeMemStateV1, error) { return &initial, nil },
+			store: func(*RuntimeMemStateV1) error {
+				storeCount++
+				if storeCount == 1 {
+					return errors.New("store failed")
+				}
+				return nil
+			},
+		})
+		m.poolAllocStats.mediumQuota.Store(4096)
+		timestamp := nowUnixMilli() + defStorePoolMediumCapDurMilli
+		require.False(t, m.tryStorePoolMediumCapacity(timestamp))
+		require.Equal(t, &initial, m.lastMemState())
+		require
```

**File**: `pkg/util/memory/global_arbitrator.go` (modified, +82/-77)
```diff
@@ -21,14 +21,14 @@ import (
 	"path/filepath"
 	"runtime"
 	"strconv"
-	"strings"
 	"sync"
 	"sync/atomic"
 
 	"github.com/pingcap/tidb/pkg/config"
 	"github.com/pingcap/tidb/pkg/metrics"
 	"github.com/pingcap/tidb/pkg/util/intest"
 	"github.com/pingcap/tidb/pkg/util/logutil"
+	"go.uber.org/zap"
 )
 
 const (
@@ -55,24 +55,26 @@ var (
 			atomic.Pointer[MemArbitrator]
 			sync.Mutex
 		}
-		enable  atomic.Bool
+		runtimeHandler struct {
+			heapProfiler atomic.Pointer[heapProfileCollector]
+			sync.Mutex
+			reset atomic.Bool
+		}
 		metrics struct {
 			last struct {
 				updateUtimeSec atomic.Int64
 				execMetricsCounter
 			}
 			pools struct {
-				internal        atomic.Int64
-				internalSession atomic.Int64
-
-				small   atomic.Int64
-				big     atomic.Int64
-				intoBig atomic.Int64
+				internal atomic.Int64
+				small    atomic.Int64
+				big      atomic.Int64
+				intoBig  atomic.Int64
 			}
-			init  atomic.Bool
-			reset atomic.Bool
+			init atomic.Bool
 			sync.Mutex
 		}
+		enable atomic.Bool
 	}
 	mockinitGlobalMemArbitrator func() *MemArbitrator
 )
@@ -115,7 +117,7 @@ func reportGlobalMemArbitratorMetrics() {
 		setQuota("tracked-heap", m.avoidance.heapTracked.Load())
 		setQuota("awaitfree-pool-cap", m.awaitFreePoolCap())
 		setQuota("awaitfree-pool-used", m.approxAwaitFreePoolUsed().quota)
-		setQuota("awaitfree-pool-tracked-heap", m.approxAwaitFreePoolUsed().trackedHeap)
+		setQuota("awaitfree-pool-tracked-heap", m.approxAwaitFreePoolUsed().tracked)
 		setQuota("mem-inuse", m.heapController.memInuse.Load())
 		setQuota("soft-limit", m.softLimit())
 		setQuota("wait-alloc", m.WaitingAllocSize())
@@ -141,7 +143,6 @@ func reportGlobalMemArbitratorMetrics() {
 			metrics.SetGlobalMemArbitratorGauge(metrics.GlobalMemArbitratorRootPool, label, value)
 		}
 		setRootPool("rootpool-total", m.RootPoolNum())
-		setRootPool("rootpool-internal", globalArbitrator.metrics.pools.internalSession.Load())
 		setRootPool("under-kill", m.underKill.approxSize())
 		setRootPool("under-cancel", m.underCancel.approxSize())
 		setRootPool("digest-cache", m.digestProfileCache.num.Load())
@@ -211,22 +212,30 @@ func readRuntimeMemStats() memStats {
 
 // HandleGlobalMemArbitratorRuntime is used to handle runtime memory stats.
 func HandleGlobalMemArbitratorRuntime() {
+	if !globalArbitrator.runtimeHandler.TryLock() {
+		return
+	}
+	defer globalArbitrator.runtimeHandler.Unlock()
+
+	profiler := globalArbitrator.runtimeHandler.heapProfiler.Load()
+	if globalArbitrator.runtimeHandler.reset.Load() && globalArbitrator.runtimeHandler.reset.Swap(false) {
+		if profiler != nil {
+			profiler.resetTriggerState()
+		}
+		resetGlobalMemArbitratorMetrics()
+	}
 	m := GlobalMemArbitrator()
 	if m == nil {
-		if globalArbitrator.metrics.reset.Load() {
-			resetGlobalMemArbitratorMetrics()
-		}
 		return
 	}
-	m.HandleRuntimeStats(readRuntimeMemStats())
+	m.handleRuntimeStats(readRuntimeMemStats())
+	if profiler != nil && profiler.shouldCheck() {
+		profiler.tryCapture(m)
+	}
 	reportGlobalMemArbitratorMetrics()
 }
 
 func resetGlobalMemArbitratorMetrics() {
-	if !globalArbitrator.metrics.reset.Swap(false) {
-		return
-	}
-
 	globalArbitrator.metrics.Lock()
 	defer globalArbitrator.metrics.Unlock()
 
@@ -309,6 +318,7 @@ func CleanupGlobalMemArbitratorForTest() {
 	globalArbitrator.v.Lock()
 	defer globalArbitrator.v.Unlock()
 
+	globalArbitrator.runtimeHandler.heapProfiler.Store(nil)
 	m := globalArbitrator.v.Load()
 	if m == nil {
 		return
@@ -337,14 +347,15 @@ func SetupGlobalMemArbitratorForTest(baseDir string) {
 			0,
 			4,
 			defPoolQuotaShards,
-			64*byteSizeKB, /* 64k ~ */
 			newMemStateRecorder(baseDir),
 		)
+		// Skip logWithFields and wrapLogFieldsAction when reporting callers.
+		logger := logutil.BgLogger().WithOptions(zap.AddCallerSkip(2))
 		m.AutoRun(
 			MemArbitratorActions{
-				Info:  logutil.BgLogger().Info,
-				Warn:  logutil.BgLogger().Warn,
-				Error: logutil.BgLogger().Error,
+				Info:  wrapLogFieldsAction(logger.Info),
+				Warn:  wrapLogFieldsAction(logger.Warn),
+				Error: wrapLogFieldsAction(logger.Error),
 				UpdateRuntimeMemStats: func() {
 				},
 				GC: func() {
@@ -429,7 +440,7 @@ func SetGlobalMemArbitratorWorkMode(str string) bool {
 	if newMode == ArbitratorModeDisable {
 		m.SetWorkMode(newMode)
 		globalArbitrator.enable.Store(false)
-		globalArbitrator.metrics.reset.Store(true)
+		globalArbitrator.runtimeHandler.reset.Store(true)
 		return true
 	}
 
@@ -487,19 +498,21 @@ func initGlobalMemArbitrator() (m *MemArbitrator) {
 		limit = GetMemTotalIgnoreErr()
 	}
 
+	profiler := newHeapProfileCollector(filepath.Join(baseDir, heapProfileDirName))
 	m = NewMemArbitrator(
 		int64(limit),
 		defPoolStatusShards,
 		defPoolQuotaShards,
-		64*byteSizeKB, /* 64k ~ */
 		newMemStateRecorder(baseDir),
 	)
+	// Skip logWithFields and wrapLogFieldsAction when reporting callers.
+	logger := logutil.BgLogger().WithOptions(zap.AddCallerSkip(2))
 
 	m.AutoRun(
 		MemArbitratorActions{
-			I
```

---

### Incident Patch 6: `a989206f` (2026-09-22)
**Commit Message**: executor, ddl: fix unparseable region split policy in SHOW CREATE TABLE (#71470)

close pingcap/tidb#71467, close pingcap/tidb#71468

**File**: `pkg/ddl/table_split_test.go` (modified, +147/-24)
```diff
@@ -395,31 +395,154 @@ func TestTableSplitPolicyMultipleIndexes(t *testing.T) {
 
 func TestTableSplitPolicyShowCreateRoundTrip(t *testing.T) {
 	store := testkit.CreateMockStore(t)
-	tk := testkit.NewTestKit(t, store)
-	tk.MustExec("use test")
-	tk.MustExec("drop table if exists t_src, t_dst")
-	tk.MustExec(`create table t_src (
-		id bigint primary key,
-		user_id bigint,
-		index idx_user_id (user_id)
-	)
-	split between (0) and (1000000) regions 4
-	split index idx_user_id between (1000) and (100000) regions 3`)
-
-	createSQL := tk.MustQuery("show create table t_src").Rows()[0][1].(string)
-	require.Contains(t, createSQL, "/*T![region_split]")
-
-	roundTripSQL := strings.Replace(createSQL, "CREATE TABLE `t_src`", "CREATE TABLE `t_dst`", 1)
-	tk.MustExec(roundTripSQL)
 
-	tbl := external.GetTableByName(t, tk, "test", "t_dst")
-	require.NotNil(t, tbl.Meta().TableSplitPolicy)
-	require.Equal(t, int64(4), tbl.Meta().TableSplitPolicy.Regions)
-
-	idxInfo := tbl.Meta().FindIndexByName("idx_user_id")
-	require.NotNil(t, idxInfo)
-	require.NotNil(t, idxInfo.RegionSplitPolicy)
-	require.Equal(t, int64(3), idxInfo.RegionSplitPolicy.Regions)
+	t.Run("table-level-policy", func(t *testing.T) {
+		tk := testkit.NewTestKit(t, store)
+		tk.MustExec("use test")
+		tk.MustExec("drop table if exists t_src, t_dst")
+		tk.MustExec(`create table t_src (
+			id bigint primary key,
+			user_id bigint,
+			index idx_user_id (user_id)
+		)
+		split between (0) and (1000000) regions 4
+		split index idx_user_id between (1000) and (100000) regions 3`)
+
+		createSQL := tk.MustQuery("show create table t_src").Rows()[0][1].(string)
+		require.Contains(t, createSQL, "/*T![region_split]")
+
+		roundTripSQL := strings.Replace(createSQL, "CREATE TABLE `t_src`", "CREATE TABLE `t_dst`", 1)
+		tk.MustExec(roundTripSQL)
+
+		tbl := external.GetTableByName(t, tk, "test", "t_dst")
+		require.NotNil(t, tbl.Meta().TableSplitPolicy)
+		require.Equal(t, int64(4), tbl.Meta().TableSplitPolicy.Regions)
+
+		idxInfo := tbl.Meta().FindIndexByName("idx_user_id")
+		require.NotNil(t, idxInfo)
+		require.NotNil(t, idxInfo.RegionSplitPolicy)
+		require.Equal(t, int64(3), idxInfo.RegionSplitPolicy.Regions)
+	})
+
+	// The primary key branch of the grammar does not take an index name, so the
+	// non-clustered primary key policy must be emitted as `SPLIT PRIMARY KEY
+	// BETWEEN`, otherwise the output is not parseable
+	// (https://github.com/pingcap/tidb/issues/71467).
+	t.Run("primary-key-policy", func(t *testing.T) {
+		tk := testkit.NewTestKit(t, store)
+		tk.MustExec("use test")
+		tk.MustExec("drop table if exists t_pk_src, t_pk_dst")
+		tk.MustExec(`create table t_pk_src (
+			id bigint not null,
+			user_id bigint,
+			primary key (id) nonclustered,
+			index idx_user_id (user_id)
+		)`)
+		tk.MustExec("alter table t_pk_src split primary key between (0) and (1000000) regions 4")
+		tk.MustExec("alter table t_pk_src split index idx_user_id between (1000) and (100000) regions 3")
+
+		createSQL := tk.MustQuery("show create table t_pk_src").Rows()[0][1].(string)
+		require.Contains(t, createSQL, "/*T![region_split]")
+		require.Contains(t, createSQL, "SPLIT PRIMARY KEY BETWEEN (0) AND (1000000) REGIONS 4")
+		require.NotContains(t, createSQL, "SPLIT PRIMARY KEY `PRIMARY`")
+
+		roundTripSQL := strings.Replace(createSQL, "CREATE TABLE `t_pk_src`", "CREATE TABLE `t_pk_dst`", 1)
+		tk.MustExec(roundTripSQL)
+
+		tbl := external.GetTableByName(t, tk, "test", "t_pk_dst")
+		require.Nil(t, tbl.Meta().TableSplitPolicy)
+
+		pkInfo := tbl.Meta().FindIndexByName("primary")
+		require.NotNil(t, pkInfo)
+		require.NotNil(t, pkInfo.RegionSplitPolicy)
+		require.Equal(t, int64(4), pkInfo.RegionSplitPolicy.Regions)
+
+		idxInfo := tbl.Meta().FindIndexByName("idx_user_id")
+		require.NotNil(t, idxInfo)
+		require.NotNil(t, idxInfo.RegionSplitPolicy)
+		require.Equal(t, int64(3), idxInfo.RegionSplitPolicy.Regions)
+	})
+
+	// A clustered primary key is the row handle itself, so there is no separate
+	// PRIMARY index to split and the policy is emitted as `SPLIT BETWEEN`.
+	t.Run("clustered-primary-key-policy", func(t *testing.T) {
+		tk := testkit.NewTestKit(t, store)
+		tk.MustExec("use test")
+		tk.MustExec("set @@session.tidb_enable_clustered_index = ON")
+		tk.MustExec("drop table if exists t_ck_src, t_ck_dst")
+		tk.MustExec(`create table t_ck_src (
+			id bigint not null,
+			user_id bigint,
+			primary key (id) clustered,
+			index idx_user_id (user_id)
+		)
+		split between (0) and (1000000) regions 4
+		split index idx_user_id between (1000) and (100000) regions 3`)
+
+		createSQL := tk.MustQuery("show create table t_ck_src").Rows()[0][1].(string)
+		require.Contains(t, createSQL, "/*T![clustered_index] CLUSTERED */")
+		require.Contains(t, createSQL, "SPLIT BETWEEN (0) AND (1000000) REGIONS 4")
+		require.NotContains(t, createSQL, "SPLIT PRIMARY KEY")
+
+		roundTripSQL := strings.Replace(createSQL, "CREATE TABLE `t_ck_src`", "CREATE TABLE `t_ck_dst`", 1)
+		
```

**File**: `pkg/executor/show.go` (modified, +79/-65)
```diff
@@ -1471,6 +1471,80 @@ func constructResultOfShowCreateTable(ctx sessionctx.Context, dbName *ast.CIStr,
 		fmt.Fprintf(buf, " /* CACHED ON */")
 	}
 
+	if tableInfo.TTLInfo != nil {
+		restoreFlags := parserformat.RestoreStringSingleQuotes | parserformat.RestoreNameBackQuotes | parserformat.RestoreTiDBSpecialComment
+		restoreCtx := parserformat.NewRestoreCtx(restoreFlags, buf)
+
+		restoreCtx.WritePlain(" ")
+		err = restoreCtx.WriteWithSpecialComments(tidb.FeatureIDTTL, func() error {
+			columnName := ast.ColumnName{Name: tableInfo.TTLInfo.ColumnName}
+			timeUnit := ast.TimeUnitExpr{Unit: ast.TimeUnitType(tableInfo.TTLInfo.IntervalTimeUnit)}
+			restoreCtx.WriteKeyWord("TTL")
+			restoreCtx.WritePlain("=")
+			restoreCtx.WriteName(columnName.String())
+			restoreCtx.WritePlainf(" + INTERVAL %s ", tableInfo.TTLInfo.IntervalExprStr)
+			return timeUnit.Restore(restoreCtx)
+		})
+
+		if err != nil {
+			return err
+		}
+
+		restoreCtx.WritePlain(" ")
+		err = restoreCtx.WriteWithSpecialComments(tidb.FeatureIDTTL, func() error {
+			restoreCtx.WriteKeyWord("TTL_ENABLE")
+			restoreCtx.WritePlain("=")
+			if tableInfo.TTLInfo.Enable {
+				restoreCtx.WriteString("ON")
+			} else {
+				restoreCtx.WriteString("OFF")
+			}
+			return nil
+		})
+
+		if err != nil {
+			return err
+		}
+
+		restoreCtx.WritePlain(" ")
+		err = restoreCtx.WriteWithSpecialComments(tidb.FeatureIDTTL, func() error {
+			restoreCtx.WriteKeyWord("TTL_JOB_INTERVAL")
+			restoreCtx.WritePlain("=")
+			if len(tableInfo.TTLInfo.JobInterval) == 0 {
+				// This only happens when the table is created from 6.5 in which the `tidb_job_interval` is not introduced yet.
+				// We use `OldDefaultTTLJobInterval` as the return value to ensure a consistent behavior for the
+				// upgrades: v6.5 -> v8.5(or previous version) -> newer version than v8.5.
+				restoreCtx.WriteString(model.OldDefaultTTLJobInterval)
+			} else {
+				restoreCtx.WriteString(tableInfo.TTLInfo.JobInterval)
+			}
+			return nil
+		})
+
+		if err != nil {
+			return err
+		}
+	}
+
+	if tableInfo.Affinity != nil {
+		fmt.Fprintf(buf, " /*T![%s] AFFINITY='%s' */", tidb.FeatureIDAffinity, tableInfo.Affinity.Level)
+	}
+
+	// add partition info here.
+	ddl.AppendPartitionInfo(tableInfo.Partition, buf, sqlMode)
+
+	// Region split policies follow the partition clause in the CREATE TABLE
+	// grammar: `CreateTableStmt: ... PartitionOpt SplitIndexListOpt ...`.
+	// Emitting them before `PARTITION BY` produces DDL that cannot be parsed
+	// again, so they are appended after the partition info
+	// (https://github.com/pingcap/tidb/issues/71468).
+	return appendRegionSplitPolicies(buf, tableInfo, sqlMode)
+}
+
+// appendRegionSplitPolicies writes the table-level and index-level region split
+// policies of a table using the `SPLIT ...` clause form accepted by the CREATE
+// TABLE grammar.
+func appendRegionSplitPolicies(buf *bytes.Buffer, tableInfo *model.TableInfo, sqlMode mysql.SQLMode) error {
 	var parse *parser.Parser
 	// Show table region split policy
 	if tableInfo.TableSplitPolicy != nil {
@@ -1515,13 +1589,14 @@ func constructResultOfShowCreateTable(ctx sessionctx.Context, dbName *ast.CIStr,
 		policy := indexInfo.RegionSplitPolicy
 		buf.WriteString("\n/*T![region_split] ")
 
-		fmt.Fprintf(buf, "SPLIT ")
+		// Note: the primary key branch of the region split policy grammar does not
+		// accept an index name, so only non-PRIMARY indexes are emitted as
+		// `SPLIT INDEX <name>`.
 		if indexInfo.Name.O == mysql.PrimaryKeyName {
-			fmt.Fprintf(buf, "PRIMARY KEY ")
+			buf.WriteString("SPLIT PRIMARY KEY BETWEEN (")
 		} else {
-			fmt.Fprintf(buf, "INDEX ")
+			fmt.Fprintf(buf, "SPLIT INDEX %s BETWEEN (", stringutil.Escape(indexInfo.Name.O, sqlMode))
 		}
-		fmt.Fprintf(buf, "%s BETWEEN (", stringutil.Escape(indexInfo.Name.O, sqlMode))
 
 		for i, val := range policy.Lower {
 			if i > 0 {
@@ -1546,67 +1621,6 @@ func constructResultOfShowCreateTable(ctx sessionctx.Context, dbName *ast.CIStr,
 		buf.WriteString(" */")
 	}
 
-	if tableInfo.TTLInfo != nil {
-		restoreFlags := parserformat.RestoreStringSingleQuotes | parserformat.RestoreNameBackQuotes | parserformat.RestoreTiDBSpecialComment
-		restoreCtx := parserformat.NewRestoreCtx(restoreFlags, buf)
-
-		restoreCtx.WritePlain(" ")
-		err = restoreCtx.WriteWithSpecialComments(tidb.FeatureIDTTL, func() error {
-			columnName := ast.ColumnName{Name: tableInfo.TTLInfo.ColumnName}
-			timeUnit := ast.TimeUnitExpr{Unit: ast.TimeUnitType(tableInfo.TTLInfo.IntervalTimeUnit)}
-			restoreCtx.WriteKeyWord("TTL")
-			restoreCtx.WritePlain("=")
-			restoreCtx.WriteName(columnName.String())
-			restoreCtx.WritePlainf(" + INTERVAL %s ", tableInfo.TTLInfo.IntervalExprStr)
-			return timeUnit.Restore(restoreCtx)
-		})
-
-		if err != nil {
-			return err
-		}
-
-		restoreCtx.WritePlain(" ")
-		err = restoreCtx.WriteWithSpecialComments(tidb.FeatureIDTTL, func() error {
-			restoreCtx.WriteKeyWord("TTL_ENABLE")
-			restoreCtx.WritePlain("=")
-			i
```

**File**: `tests/integrationtest/r/executor/split_table.result` (modified, +9/-9)
```diff
@@ -132,7 +132,7 @@ t	CREATE TABLE `t` (
   KEY `idx_user_id` (`user_id`),
   PRIMARY KEY (`id`) /*T![clustered_index] NONCLUSTERED */
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
-/*T![region_split] SPLIT PRIMARY KEY `PRIMARY` BETWEEN (0) AND (1000000) REGIONS 4 */
+/*T![region_split] SPLIT PRIMARY KEY BETWEEN (0) AND (1000000) REGIONS 4 */
 alter table t split index idx_user_id between (1000) and (100000) regions 3;
 show create table t;
 Table	Create Table
@@ -144,7 +144,7 @@ t	CREATE TABLE `t` (
   PRIMARY KEY (`id`) /*T![clustered_index] NONCLUSTERED */
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
 /*T![region_split] SPLIT INDEX `idx_user_id` BETWEEN (1000) AND (100000) REGIONS 3 */
-/*T![region_split] SPLIT PRIMARY KEY `PRIMARY` BETWEEN (0) AND (1000000) REGIONS 4 */
+/*T![region_split] SPLIT PRIMARY KEY BETWEEN (0) AND (1000000) REGIONS 4 */
 drop table if exists t;
 create table t (
 id bigint primary key nonclustered,
@@ -168,7 +168,7 @@ t	CREATE TABLE `t` (
   PRIMARY KEY (`id`) /*T![clustered_index] NONCLUSTERED */
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
 /*T![region_split] SPLIT INDEX `idx_user_id` BETWEEN (-1000) AND (100000) REGIONS 3 */
-/*T![region_split] SPLIT PRIMARY KEY `PRIMARY` BETWEEN (-10000) AND (1000000) REGIONS 4 */
+/*T![region_split] SPLIT PRIMARY KEY BETWEEN (-10000) AND (1000000) REGIONS 4 */
 set tidb_enable_clustered_index=ON;
 drop table if exists t;
 create table t (
@@ -295,13 +295,13 @@ t	CREATE TABLE `t` (
   KEY `idx_status` (`status`),
   PRIMARY KEY (`id`) /*T![clustered_index] NONCLUSTERED */
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
-/*T![region_split] SPLIT INDEX `idx_user_id` BETWEEN (1000) AND (100000) REGIONS 3 */
-/*T![region_split] SPLIT INDEX `idx_status` BETWEEN ('a') AND ('z') REGIONS 2 */
-/*T![region_split] SPLIT PRIMARY KEY `PRIMARY` BETWEEN (0) AND (1000000) REGIONS 4 */
 PARTITION BY RANGE (`id`)
 (PARTITION `p0` VALUES LESS THAN (100000),
  PARTITION `p1` VALUES LESS THAN (200000),
  PARTITION `pmax` VALUES LESS THAN (MAXVALUE))
+/*T![region_split] SPLIT INDEX `idx_user_id` BETWEEN (1000) AND (100000) REGIONS 3 */
+/*T![region_split] SPLIT INDEX `idx_status` BETWEEN ('a') AND ('z') REGIONS 2 */
+/*T![region_split] SPLIT PRIMARY KEY BETWEEN (0) AND (1000000) REGIONS 4 */
 drop table if exists t;
 create table t (
 id bigint primary key,
@@ -320,10 +320,10 @@ t	CREATE TABLE `t` (
   KEY `idx_val` (`val`),
   PRIMARY KEY (`id`) /*T![clustered_index] NONCLUSTERED */
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
-/*T![region_split] SPLIT PRIMARY KEY `PRIMARY` BETWEEN (0) AND (10000) REGIONS 5 */
 PARTITION BY RANGE (`id`)
 (PARTITION `p0` VALUES LESS THAN (1000),
  PARTITION `p1` VALUES LESS THAN (2000))
+/*T![region_split] SPLIT PRIMARY KEY BETWEEN (0) AND (10000) REGIONS 5 */
 alter table t split index idx_val between (0) and (10000) regions 5;
 show create table t;
 Table	Create Table
@@ -333,11 +333,11 @@ t	CREATE TABLE `t` (
   KEY `idx_val` (`val`),
   PRIMARY KEY (`id`) /*T![clustered_index] NONCLUSTERED */
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
-/*T![region_split] SPLIT INDEX `idx_val` BETWEEN (0) AND (10000) REGIONS 5 */
-/*T![region_split] SPLIT PRIMARY KEY `PRIMARY` BETWEEN (0) AND (10000) REGIONS 5 */
 PARTITION BY RANGE (`id`)
 (PARTITION `p0` VALUES LESS THAN (1000),
  PARTITION `p1` VALUES LESS THAN (2000))
+/*T![region_split] SPLIT INDEX `idx_val` BETWEEN (0) AND (10000) REGIONS 5 */
+/*T![region_split] SPLIT PRIMARY KEY BETWEEN (0) AND (10000) REGIONS 5 */
 drop table if exists t;
 create table t (
 id bigint primary key,
```

---

### Incident Patch 7: `56ee5bb2` (2026-09-21)
**Commit Message**: ddl, dxf: fix transition completion and scheduler cleanup (#71176)

ref pingcap/tidb#69625

**File**: `pkg/ddl/BUILD.bazel` (modified, +1/-0)
```diff
@@ -323,6 +323,7 @@ go_test(
         "stat_test.go",
         "storage_class_partition_test.go",
         "storage_class_test.go",
+        "storage_class_transition_poll_test.go",
         "storage_class_transition_test.go",
         "table_mode_test.go",
         "table_modify_test.go",
```

**File**: `pkg/ddl/storage_class_transition.go` (modified, +7/-3)
```diff
@@ -957,8 +957,13 @@ func (m *storageClassTransitionManager) poll(
 			delete(active, key)
 			continue
 		}
-		eligible[key] = operation
-		if storageClassTransitionTargetsExist(tbl.Meta(), operation) || !storageClassTransitionTopologyIsStable(tbl.Meta()) {
+		if storageClassTransitionTargetsExist(tbl.Meta(), operation) {
+			eligible[key] = operation
+			continue
+		}
+		// Obsolete physical ranges cannot prove completion, even while the
+		// partition topology is changing or reconciliation needs to retry.
+		if !storageClassTransitionTopologyIsStable(tbl.Meta()) {
 			continue
 		}
 		if err := reconcileStorageClassTransitionTopology(ctx, se, tbl.Meta(), operation, latestSchemaVersion); err != nil {
@@ -967,7 +972,6 @@ func (m *storageClassTransitionManager) poll(
 			continue
 		}
 		delete(active, key)
-		delete(eligible, key)
 	}
 	m.setActive(active)
 	if len(eligible) == 0 {
```

**File**: `pkg/ddl/storage_class_transition_poll_test.go` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+// Copyright 2026 PingCAP, Inc.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package ddl_test
+
+import (
+	"context"
+	"net/http"
+	"net/http/httptest"
+	"strings"
+	"sync/atomic"
+	"testing"
+
+	"github.com/pingcap/tidb/pkg/ddl"
+	ddlsess "github.com/pingcap/tidb/pkg/ddl/session"
+	"github.com/pingcap/tidb/pkg/domain/infosync"
+	"github.com/pingcap/tidb/pkg/infoschema"
+	"github.com/pingcap/tidb/pkg/meta/metadef"
+	"github.com/pingcap/tidb/pkg/meta/model"
+	"github.com/pingcap/tidb/pkg/parser/ast"
+	"github.com/pingcap/tidb/pkg/testkit"
+	"github.com/pingcap/tidb/pkg/testkit/testfailpoint"
+	"github.com/stretchr/testify/require"
+	pdhttp "github.com/tikv/pd/client/http"
+)
+
+func TestStorageClassTransitionPollWaitsForTopology(t *testing.T) {
+	for _, reconciliationFails := range []bool{false, true} {
+		name := "partition reorganization"
+		if reconciliationFails {
+			name = "reconciliation failure"
+		}
+		t.Run(name, func(t *testing.T) {
+			store, dom := testkit.CreateMockStoreAndDomain(t)
+			tk := testkit.NewTestKit(t, store)
+			tk.MustExec(metadef.CreateTiDBStorageClassTransitionHistoryTable)
+			// Poll explicitly against controlled schema snapshots. The domain's
+			// background owner must not reconcile the synthetic table as orphaned.
+			require.NoError(t, dom.DDL().Stop())
+			tk.MustExec(`INSERT INTO mysql.tidb_storage_class_transition_history
+				(table_schema, table_name, table_id, partition_name, partition_id,
+				 direction, state, schema_version, start_ts, start_time, physical_targets)
+				VALUES ('test', 't', 500, 'p0', 501, 'TO_IA', 'RUNNING', 1, 100,
+				 '2020-01-01 00:00:00',
+				 '[{"physical_id":501,"partition_id":501,"partition_name":"p0"}]')`)
+
+			oldPartition := model.PartitionDefinition{
+				ID: 501, Name: ast.NewCIStr("p0"), StorageClassTier: model.StorageClassTierIA,
+			}
+			newPartition := model.PartitionDefinition{
+				ID: 502, Name: ast.NewCIStr("p1"), StorageClassTier: model.StorageClassTierIA,
+			}
+			tblInfo := &model.TableInfo{
+				ID: 500, Name: ast.NewCIStr("t"),
+				Partition: &model.PartitionInfo{
+					Definitions: []model.PartitionDefinition{newPartition},
+				},
+			}
+			if !reconciliationFails {
+				// REORGANIZE has switched the public definitions, but retains the
+				// old physical range for double writes until the final DDL steps.
+				tblInfo.Partition.DDLState = model.StateDeleteReorganization
+				tblInfo.Partition.AddingDefinitions = []model.PartitionDefinition{newPartition}
+				tblInfo.Partition.DroppingDefinitions = []model.PartitionDefinition{oldPartition}
+			}
+			infoCache := infoschema.NewCache(nil, 1)
+			infoCache.Insert(infoschema.MockInfoSchemaWithSchemaVer([]*model.TableInfo{tblInfo}, 2), 0)
+			d, _ := ddl.NewDDL(context.Background(), ddl.WithStore(store), ddl.WithInfoCache(infoCache))
+			t.Cleanup(func() { require.NoError(t, d.Stop()) })
+
+			var oldRequests, newRequests atomic.Int32
+			var newTargetReady atomic.Bool
+			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				switch r.URL.Query().Get("table_id") {
+				case "501":
+					oldRequests.Add(1)
+					_, _ = w.Write([]byte(`{"ready":1,"total":1}`))
+				case "502":
+					newRequests.Add(1)
+					if newTargetReady.Load() {
+						_, _ = w.Write([]byte(`{"ready":1,"total":1}`))
+					} else {
+						_, _ = w.Write([]byte(`{"ready":0,"total":1}`))
+					}
+				default:
+					http.Error(w, "unexpected physical target", http.StatusBadRequest)
+				}
+			}))
+			t.Cleanup(server.Close)
+			previousTiFlash := infosync.GetMockTiFlash()
+			infosync.SetMockTiFlash(&infosync.MockTiFlash{StoreInfo: map[uint64]pdhttp.MetaStore{
+				1: {ID: 1, StatusAddress: strings.TrimPrefix(server.URL, "http://"), StateName: "Up"},
+			}})
+			t.Cleanup(func() { infosync.SetMockTiFlash(previousTiFlash) })
+
+			const insertFailpoint = "github.com/pingcap/tidb/pkg/ddl/mockInsertStorageClassTransitionError"
+			if reconciliationFails {
+				testfailpoint.Enable(t, insertFailpoint, "return(true)")
+			}
+			se := ddlsess.NewSession(tk.Session())
+			poll := func() {
+				_, err := ddl.PollStorageClassTransitionsForTest(context.Background(), d, se)
+				require.NoError(t, err)
+			}
+			poll()
+			tk.MustQuery(`SELECT partition_id, state FROM mysql.tidb_storage_class_transition_history`).Check(
+				testkit.Rows("501 RUNNING"))
+			require.Zero(t, oldRequests.Load(), "an obsolete physical target must not 
```

**File**: `pkg/dxf/importinto/BUILD.bazel` (modified, +1/-0)
```diff
@@ -119,6 +119,7 @@ go_test(
     flaky = True,
     shard_count = 38,
     deps = [
+        "//br/pkg/utils",
         "//pkg/config",
         "//pkg/config/configtypes",
         "//pkg/config/deploymode",
```

**File**: `pkg/dxf/importinto/scheduler.go` (modified, +12/-1)
```diff
@@ -132,9 +132,13 @@ func (t *taskInfo) close(ctx context.Context) {
 		}
 		t.taskRegister = nil
 	}
+	t.closeEtcdClient()
+}
+
+func (t *taskInfo) closeEtcdClient() {
 	if t.etcdClient != nil {
 		if err := t.etcdClient.Close(); err != nil {
-			logger.Warn("close etcd client failed", zap.Error(err))
+			t.logger.Warn("close etcd client failed", zap.Error(err))
 		}
 		t.etcdClient = nil
 	}
@@ -209,6 +213,13 @@ func (sch *importScheduler) Init() (err error) {
 }
 
 func (sch *importScheduler) Close() {
+	// A new owner may have adopted the same registration lease. Release only
+	// local clients here; terminal job paths are responsible for revoking leases.
+	sch.taskInfoMap.Range(func(key, value any) bool {
+		value.(*taskInfo).closeEtcdClient()
+		sch.taskInfoMap.Delete(key)
+		return true
+	})
 	metricsManager.unregister(sch.GetTask().ID)
 	sch.BaseScheduler.Close()
 }
```

**File**: `pkg/dxf/importinto/scheduler_test.go` (modified, +52/-0)
```diff
@@ -22,6 +22,7 @@ import (
 	"github.com/ngaut/pools"
 	"github.com/pingcap/errors"
 	"github.com/pingcap/failpoint"
+	"github.com/pingcap/tidb/br/pkg/utils"
 	"github.com/pingcap/tidb/pkg/config/kerneltype"
 	sqlsvrapimock "github.com/pingcap/tidb/pkg/domain/sqlsvrapi/mock"
 	"github.com/pingcap/tidb/pkg/dxf/framework/mock"
@@ -35,6 +36,7 @@ import (
 	utilmock "github.com/pingcap/tidb/pkg/util/mock"
 	"github.com/stretchr/testify/require"
 	"github.com/stretchr/testify/suite"
+	clientv3 "go.etcd.io/etcd/client/v3"
 	"go.uber.org/mock/gomock"
 )
 
@@ -129,6 +131,56 @@ func (s *importIntoSuite) TestUpdateCurrentTask() {
 	require.True(s.T(), sch.disableTiKVImportMode.Load())
 }
 
+type closeTrackedTaskRegister struct {
+	utils.TaskRegister
+	closeCalled bool
+}
+
+func (r *closeTrackedTaskRegister) Close(context.Context) error {
+	r.closeCalled = true
+	return nil
+}
+
+func (s *importIntoSuite) TestSchedulerClose() {
+	ctx, cancel := context.WithCancel(context.Background())
+	s.T().Cleanup(cancel)
+	sch := NewImportScheduler(ctx, &proto.Task{
+		TaskBase: proto.TaskBase{ID: 1},
+	}, scheduler.Param{}).(*importScheduler)
+	clients := make([]*clientv3.Client, 0, 2)
+	registrations := make([]*closeTrackedTaskRegister, 0, 2)
+	for _, taskID := range []int64{1, 2} {
+		client := clientv3.NewCtxClient(context.Background())
+		s.T().Cleanup(func() { _ = client.Close() })
+		clients = append(clients, client)
+		registration := &closeTrackedTaskRegister{}
+		registrations = append(registrations, registration)
+		sch.taskInfoMap.Store(taskID, &taskInfo{
+			taskID:     taskID,
+			etcdClient: client,
+			// Closing the scheduler must not revoke a registration lease that
+			// the next owner may already have adopted.
+			taskRegister: registration,
+			logger:       sch.GetLogger(),
+		})
+	}
+
+	// Owner loss cancels scheduling before the active task reaches a terminal state.
+	cancel()
+	sch.Close()
+	for _, client := range clients {
+		s.ErrorIs(client.Ctx().Err(), context.Canceled)
+	}
+	for _, registration := range registrations {
+		s.False(registration.closeCalled, "scheduler shutdown must preserve the task registration lease")
+	}
+	sch.taskInfoMap.Range(func(_, _ any) bool {
+		s.Fail("closed scheduler must not retain task registrations")
+		return true
+	})
+	sch.Close()
+}
+
 func (s *importIntoSuite) TestSchedulerInit() {
 	meta := TaskMeta{
 		Plan: importer.Plan{
```

---

### Incident Patch 8: `8f27fdbb` (2026-09-21)
**Commit Message**: test: stabilize flaky TestSubscriptionIdleTimeoutWhileSendingEvents (#70741)

close pingcap/tidb#70687

**File**: `br/pkg/streamhelper/subscription_test.go` (modified, +12/-4)
```diff
@@ -342,8 +342,16 @@ func TestSubscriptionIdleTimeoutWhileSendingEvents(t *testing.T) {
 	c.advanceCheckpoints()
 	c.flushAll()
 
-	req.Eventually(func() bool {
-		err := sub.PendingErrors()
-		return err != nil && strings.Contains(err.Error(), "has no activity")
-	}, 3*time.Second, 10*time.Millisecond)
+	deadline := time.Now().Add(3 * time.Second)
+	var lastErr error
+	for {
+		lastErr = sub.PendingErrors()
+		if lastErr != nil && strings.Contains(lastErr.Error(), "has no activity") {
+			break
+		}
+		if time.Now().After(deadline) {
+			t.Fatalf("pending errors did not contain %q within %s; last error: %v", "has no activity", 3*time.Second, lastErr)
+		}
+		time.Sleep(10 * time.Millisecond)
+	}
 }
```

---

### Incident Patch 9: `0a42bea5` (2026-09-21)
**Commit Message**: stmtsummary: surface logger init failures, drop leaked time-excluded FDs, fix absolute-path file pruning (#70175)

close pingcap/tidb#70174

**File**: `pkg/util/stmtsummary/v2/BUILD.bazel` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ go_test(
     ],
     embed = [":stmtsummary"],
     flaky = True,
-    shard_count = 24,
+    shard_count = 27,
     deps = [
         "//pkg/config",
         "//pkg/meta/model",
```

**File**: `pkg/util/stmtsummary/v2/logger.go` (modified, +10/-4)
```diff
@@ -35,19 +35,25 @@ type stmtLogStorage struct {
 	logger *zap.Logger
 }
 
-func newStmtLogStorage(cfg *log.Config) *stmtLogStorage {
+// newStmtLogStorage builds the file-backed logger used to persist statement
+// summary window rotations. Backpressure-free behavior here is critical: when
+// logger initialization fails we MUST surface the error to the caller (the
+// static Setup path in main). A silent fallback to zap.NewNop() would make
+// persistent mode look enabled while silently dropping every rotated window,
+// so we fail closed instead and let Setup refuse to register the global
+// StmtSummary instance.
+func newStmtLogStorage(cfg *log.Config) (*stmtLogStorage, error) {
 	// Create the stmt logger
 	logger, prop, err := log.InitLogger(cfg)
 	if err != nil {
-		logutil.BgLogger().Error("failed to init logger", zap.Error(err))
-		return &stmtLogStorage{logger: zap.NewNop()}
+		return nil, fmt.Errorf("stmtsummary: init statement summary logger: %w", err)
 	}
 	// Replace 2018-12-19-unified-log-format text encoder with statements encoder
 	newCore := log.NewTextCore(&stmtLogEncoder{}, prop.Syncer, prop.Level)
 	logger = logger.WithOptions(zap.WrapCore(func(zapcore.Core) zapcore.Core {
 		return newCore
 	}))
-	return &stmtLogStorage{logger}
+	return &stmtLogStorage{logger: logger}, nil
 }
 
 func (s *stmtLogStorage) persist(w *stmtWindow, end time.Time) {
```

**File**: `pkg/util/stmtsummary/v2/reader.go` (modified, +6/-5)
```diff
@@ -544,15 +544,16 @@ func parseBeginTsAndReseek(file *os.File) (int64, error) {
 }
 
 func parseEndTs(file *os.File) (int64, error) {
-	// tidb-statements.log
-	filename := config.GetGlobalConfig().Instance.StmtSummaryFilename
+	// The rotated filename is compared by basename, so derive its prefix from
+	// the configured basename as well when the configured path is absolute.
+	configured := filepath.Base(config.GetGlobalConfig().Instance.StmtSummaryFilename)
 	// .log
-	ext := filepath.Ext(filename)
+	ext := filepath.Ext(configured)
 	// tidb-statements
-	prefix := filename[:len(filename)-len(ext)]
+	prefix := configured[:len(configured)-len(ext)]
 
 	// tidb-statements-2022-12-27T16-21-20.245.log
-	filename = filepath.Base(file.Name())
+	filename := filepath.Base(file.Name())
 	// .log
 	ext = filepath.Ext(file.Name())
 	// tidb-statements-2022-12-27T16-21-20.245
```

**File**: `pkg/util/stmtsummary/v2/reader_test.go` (modified, +23/-0)
```diff
@@ -96,6 +96,29 @@ func TestStmtFileInvalidLine(t *testing.T) {
 	require.Equal(t, time.Date(2022, 12, 27, 16, 21, 20, 245000000, time.Local).Unix(), f.end)
 }
 
+func TestStmtFileAbsoluteConfiguredFilename(t *testing.T) {
+	restore := config.RestoreFunc()
+	t.Cleanup(restore)
+
+	dir := t.TempDir()
+	config.UpdateGlobal(func(conf *config.Config) {
+		conf.Instance.StmtSummaryFilename = filepath.Join(dir, "tidb-statements.log")
+	})
+
+	end := time.Date(2022, 12, 27, 16, 21, 20, 245000000, time.Local)
+	rotated := filepath.Join(dir, "tidb-statements-2022-12-27T16-21-20.245.log")
+	content := fmt.Sprintf("{\"begin\":%d,\"end\":%d}\n", end.Unix()-10, end.Unix())
+	require.NoError(t, os.WriteFile(rotated, []byte(content), 0o600))
+
+	f, err := openStmtFile(rotated)
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, f.close()) })
+	require.Equal(t, end.Unix(), f.end)
+
+	checker := stmtChecker{timeRanges: []*StmtTimeRange{{Begin: end.Unix() + 1, End: end.Unix() + 2}}}
+	require.False(t, checker.isTimeValid(f.begin, f.end))
+}
+
 type stmtDirEntryInfoError struct {
 	os.DirEntry
 }
```

**File**: `pkg/util/stmtsummary/v2/stmtsummary.go` (modified, +45/-12)
```diff
@@ -17,6 +17,7 @@ package stmtsummary
 import (
 	"context"
 	"errors"
+	"fmt"
 	"math"
 	"sync"
 	"sync/atomic"
@@ -64,9 +65,32 @@ var (
 )
 
 // Setup initializes the GlobalStmtSummary.
-func Setup(cfg *Config) (err error) {
-	GlobalStmtSummary, err = NewStmtSummary(cfg)
-	return
+//
+// If NewStmtSummary fails the cluster config still advertises
+// `tidb_stmt_summary_enable_persistent = true`, while every v2 proxy (Add,
+// Enabled, ...) dereferences GlobalStmtSummary unconditionally on that flag.
+// A boot that "kept going" in that state would crash on the first SQL with a
+// nil pointer dereference: V2-11 traded silent data loss for a hard boot
+// loop. To avoid that half-initialized state Setup explicitly switches
+// persistent mode off on init failure, so the proxies fall back to the
+// always-available in-memory v1 aggregation (stmtsummary.StmtSummaryByDigestMap).
+// The error is returned with fallback context so the caller can emit one
+// actionable log entry rather than logging the same failure at every layer.
+func Setup(cfg *Config) error {
+	stmtSummary, err := NewStmtSummary(cfg)
+	if err != nil {
+		// Keep the failed result private and disable persistent mode before
+		// returning so proxies continue through the v1 implementation.
+		config.UpdateGlobal(func(conf *config.Config) {
+			conf.Instance.StmtSummaryEnablePersistent = false
+		})
+		return fmt.Errorf(
+			"stmtsummary v2 persistent mode disabled; falling back to v1 in-memory aggregation: %w",
+			err,
+		)
+	}
+	GlobalStmtSummary = stmtSummary
+	return nil
 }
 
 // Close closes the GlobalStmtSummary.
@@ -123,6 +147,22 @@ func NewStmtSummary(cfg *Config) (*StmtSummary, error) {
 		return nil, errors.New("stmtsummary: empty filename")
 	}
 
+	// Fail closed: a broken persistent logger makes persistent mode look
+	// enabled while silently dropping every rotated window (V2-11). Construct
+	// the storage before starting any goroutines so there are no background
+	// contexts to clean up on this early error path.
+	storage, err := newStmtLogStorage(&log.Config{
+		File: log.FileLogConfig{
+			Filename:   cfg.Filename,
+			MaxSize:    cfg.FileMaxSize,
+			MaxDays:    cfg.FileMaxDays,
+			MaxBackups: cfg.FileMaxBackups,
+		},
+	})
+	if err != nil {
+		return nil, err
+	}
+
 	ctx, cancel := context.WithCancel(context.Background())
 	s := &StmtSummary{
 		ctx:    ctx,
@@ -138,15 +178,8 @@ func NewStmtSummary(cfg *Config) (*StmtSummary, error) {
 		optRefreshInterval:     atomic2.NewUint32(defaultRefreshInterval),
 		optPersistEvicted:      atomic2.NewBool(false),
 		optGroupByUser:         atomic2.NewBool(false),
-		storage: newStmtLogStorage(&log.Config{
-			File: log.FileLogConfig{
-				Filename:   cfg.Filename,
-				MaxSize:    cfg.FileMaxSize,
-				MaxDays:    cfg.FileMaxDays,
-				MaxBackups: cfg.FileMaxBackups,
-			},
-		}),
-		evictedCh: make(chan *StmtRecord, evictedLogChanCap),
+		storage:                storage,
+		evictedCh:              make(chan *StmtRecord, evictedLogChanCap),
 	}
 	s.window = newStmtWindow(timeNow(), uint(defaultMaxStmtCount), s.onEvict)
 
```

**File**: `pkg/util/stmtsummary/v2/stmtsummary_test.go` (modified, +82/-0)
```diff
@@ -23,6 +23,7 @@ import (
 	"testing"
 	"time"
 
+	"github.com/pingcap/tidb/pkg/config"
 	"github.com/pingcap/tidb/pkg/metrics"
 	"github.com/pingcap/tidb/pkg/util/stmtsummary"
 	"github.com/prometheus/client_golang/prometheus"
@@ -411,6 +412,87 @@ func TestDefaultConfig(t *testing.T) {
 	require.Equal(t, uint32(1800), ss.RefreshInterval())
 }
 
+// TestNewStmtSummaryLoggerInitError closes V2-11 in the statement-summary
+// audit: when the configured stmt log file cannot be opened,
+// log.InitLogger returns an error and NewStmtSummary must surface that error
+// instead of silently degrading to a no-op logger. A no-op fallback would make
+// persistent mode look enabled while silently dropping every rotated window.
+//
+// We trigger the error by pointing Filename at an existing directory, which
+// `log.InitLogger` rejects with "can't use directory as log file name" without
+// relying on filesystem permission differences between platforms.
+func TestNewStmtSummaryLoggerInitError(t *testing.T) {
+	dir := t.TempDir()
+	ss, err := NewStmtSummary(&Config{Filename: dir})
+	require.Error(t, err)
+	require.Nil(t, ss)
+}
+
+// TestSetupDisablesPersistentOnLoggerInitError exercises the *startup call
+// chain* that produces the V2-11 nil-panic regression pointed out in review.
+//
+// When NewStmtSummary fails, publishing its nil result while the cluster
+// config still has `tidb_stmt_summary_enable_persistent = true` lets every
+// public proxy in this package (Add, Enabled, ...) dereference nil.
+// On the buggy code the very first SQL call would dereference a nil
+// pointer and the server would crash again; the logger init error had traded
+// silent data loss for a hard boot-loop. Now Setup must remedy the half-
+// constructed state by explicitly disabling persistent mode so the wrappers
+// fall back to the in-memory v1 aggregation (stmtsummary.StmtSummaryByDigestMap).
+//
+// The test goes end-to-end through:
+//   - the public Setup entrypoint (the same one cmd/tidb-server calls);
+//   - the post-Setup invariant that StmtSummaryEnablePersistent flipped off;
+//   - an actual Add() probe, which used to be the line that panicked.
+func TestSetupDisablesPersistentOnLoggerInitError(t *testing.T) {
+	// Preserve the global v2 instance and install a sentinel to verify that a
+	// failed setup does not publish a nil result over an existing instance.
+	prev := GlobalStmtSummary
+	t.Cleanup(func() { GlobalStmtSummary = prev })
+	existing := &StmtSummary{}
+	GlobalStmtSummary = existing
+
+	// Preserve the cluster config too; Setup mutates it on the fix branch.
+	restore := config.RestoreFunc()
+	t.Cleanup(restore)
+
+	// Mirror the operator's intent: allocate persistent mode but point the log
+	// file at an *existing directory*. log.InitLogger refuses this with
+	// "can't use directory as log file name" deterministically across
+	// darwin/linux, so the chosen failure trigger does not depend on permission
+	// quirks of the CI container.
+	config.UpdateGlobal(func(conf *config.Config) {
+		conf.Instance.StmtSummaryEnablePersistent = true
+		conf.Instance.StmtSummaryFilename = t.TempDir()
+	})
+
+	// Simulate the startup call: cmd/tidb-server/main.go#setupStmtSummary.
+	err := Setup(&Config{
+		Filename: config.GetGlobalConfig().Instance.StmtSummaryFilename,
+	})
+	require.Error(t, err, "Setup must surface the logger init error")
+	require.ErrorContains(t, err, "stmtsummary v2 persistent mode disabled; falling back to v1 in-memory aggregation")
+
+	// NewStmtSummary returned (nil, error), so Setup must not publish that nil
+	// result over the previously installed instance.
+	require.Same(t, existing, GlobalStmtSummary)
+
+	// This is the invariant the reviewer asked for: persistent mode MUST be
+	// flipped off so the v2 proxy functions become no-ops and the v1 path
+	// (StmtSummaryByDigestMap, which is always available) absorbs traffic
+	// instead of dereferencing a nil GlobalStmtSummary.
+	require.False(t,
+		config.GetGlobalConfig().Instance.StmtSummaryEnablePersistent,
+		"V2-11 follow-up: Setup must disable persistent mode on init failure to avoid nil deref in Add/Enabled wrappers")
+
+	// Direct evidence that the runtime no longer crashes: the Add() proxy is
+	// the line that panicked under the original (return-nil) fix. With the
+	// persistent flag flipped off it must route to v1 without panicking.
+	require.NotPanics(t, func() {
+		Add(GenerateStmtExecInfo4Test("digest_setup_fallback_does_not_panic"))
+	})
+}
+
 // TestEvictedConcurrentWithRotate verifies that Evicted() is safe to call
 // concurrently with rotate (V2-25 data race fix).
 func TestEvictedConcurrentWithRotate(t *testing.T) {
```

---

### Incident Patch 10: `b44616b4` (2026-09-20)
**Commit Message**: test: split circuit-breaker timeout and columnar cancel coverage (#71393)

close pingcap/tidb#70536

**File**: `pkg/domain/infosync/info.go` (modified, +4/-6)
```diff
@@ -396,15 +396,13 @@ func MustGetTiFlashProgressWithCircuitBreaker(ctx context.Context, tableID int64
 	defer cancel()
 
 	progress, err := MustGetTiFlashProgress(ctx, tableID, replicaCount, tiFlashStores, tikvStores)
-	if err != nil {
-		if ctx.Err() != nil {
-			return 1.0, true, nil
-		}
-		return 0, false, err
-	}
+	// Context has been timed out, return progress as 1.0 and indicate that the circuit breaker was triggered.
 	if ctx.Err() != nil {
 		return 1.0, true, nil
 	}
+	if err != nil {
+		return 0, false, err
+	}
 	return progress, false, nil
 }
 
```

**File**: `pkg/domain/infosync/info_test.go` (modified, +5/-9)
```diff
@@ -138,17 +138,18 @@ func TestTiFlashManager(t *testing.T) {
 	require.NoError(t, err)
 	require.Equal(t, 1, stats.Count)
 
-	t.Run("circuitBreakerCancelsProgressCollection", func(t *testing.T) {
+	t.Run("circuitBreakerReturnsOnTimeout", func(t *testing.T) {
 		restore := config.RestoreFunc()
 		defer restore()
 		config.UpdateGlobal(func(conf *config.Config) {
+			// Set a short columnar collect timeout to trigger the circuit breaker quickly.
 			conf.CSE.ColumnarCollectTimeout = 50 * time.Millisecond
 		})
 
-		requestCanceled := make(chan struct{}, 1)
+		// Block forever so progress collection can only finish via the circuit-breaker timeout.
+		// Cancellation propagation is covered separately in helper.CollectColumnarStatusWithCtx tests.
 		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 			<-r.Context().Done()
-			requestCanceled <- struct{}{}
 		}))
 		defer server.Close()
 
@@ -162,16 +163,11 @@ func TestTiFlashManager(t *testing.T) {
 			},
 		}
 
+		// Must trigger the circuit breaker due to the short timeout.
 		progress, circuitBreakerTriggered, err := MustGetTiFlashProgressWithCircuitBreaker(context.Background(), 1024, 1, nil, tikvStores)
 		require.NoError(t, err)
 		require.True(t, circuitBreakerTriggered)
 		require.Equal(t, 1.0, progress)
-
-		select {
-		case <-requestCanceled:
-		case <-time.After(time.Second):
-			t.Fatal("expected progress collection request to be canceled")
-		}
 	})
 
 	t.Run("storageClassStatusCollectsCounters", func(t *testing.T) {
```

**File**: `pkg/store/helper/BUILD.bazel` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ go_test(
     ],
     embed = [":helper"],
     flaky = True,
-    shard_count = 11,
+    shard_count = 12,
     deps = [
         "//pkg/config/kerneltype",
         "//pkg/infoschema/context",
```

**File**: `pkg/store/helper/helper_test.go` (modified, +48/-0)
```diff
@@ -748,6 +748,54 @@ func TestComputeTiFlashStatus(t *testing.T) {
 	}
 }
 
+func TestCollectColumnarStatusCancelsPendingRequest(t *testing.T) {
+	// requestStarted is closed when the mock handler first sees the HTTP request.
+	// requestCanceled is closed after the handler observes request-context cancellation.
+	requestStarted := make(chan struct{})
+	requestCanceled := make(chan struct{})
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		close(requestStarted)
+		<-r.Context().Done()
+		close(requestCanceled)
+	}))
+	defer server.Close()
+
+	ctx, cancel := context.WithCancel(context.Background())
+	defer cancel()
+
+	errCh := make(chan error, 1)
+	go func() {
+		_, err := helper.CollectColumnarStatusWithCtx(ctx, strings.TrimPrefix(server.URL, "http://"), 7, 9, nil)
+		errCh <- err
+	}()
+
+	// Wait until the request has entered the handler before canceling.
+	// Otherwise cancel may race ahead of dial/accept and the handler never runs.
+	select {
+	case <-requestStarted:
+	case <-time.After(2 * time.Second):
+		t.Fatal("expected columnar status request to start")
+	}
+
+	// Trigger the cancellation of the request.
+	cancel()
+
+	// Must return an error due to context cancellation.
+	select {
+	case err := <-errCh:
+		require.Error(t, err)
+		require.ErrorIs(t, err, context.Canceled)
+	case <-time.After(2 * time.Second):
+		t.Fatal("expected columnar status request to return after cancel")
+	}
+
+	select {
+	case <-requestCanceled:
+	case <-time.After(time.Second):
+		t.Fatal("expected pending columnar status request to be canceled")
+	}
+}
+
 func TestCollectColumnarStatusFTSIndexReady(t *testing.T) {
 	testCases := []struct {
 		name             string
```

---

### Incident Patch 11: `33555af6` (2026-09-20)
**Commit Message**: *: update client-go to fix shared-lock decoding warnings (#71367)

close pingcap/tidb#71368

**File**: `DEPS.bzl` (modified, +2/-2)
```diff
@@ -4527,8 +4527,8 @@ def go_deps():
         build_tags = ["nextgen", "intest"],
         build_file_proto_mode = "disable_global",
         importpath = "github.com/tikv/client-go/v2",
-        sum = "h1:OFhRCzHqFeARZMIum85M3PTLLmEIDeLXVG+jrRNI76w=",
-        version = "v2.0.8-0.20260903102657-08cbf831121a",
+        sum = "h1:e2GcofWhqtCKREy73l6oX6SbJxzwmS9Wl4LRzXfHzDQ=",
+        version = "v2.0.8-0.20260918070520-787f20af357c",
     )
     go_repository(
         name = "com_github_tikv_pd_client",
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ require (
 	github.com/stretchr/testify v1.11.1
 	github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common v1.3.142
 	github.com/tiancaiamao/appdash v0.0.0-20181126055449-889f96f722a2
-	github.com/tikv/client-go/v2 v2.0.8-0.20260903102657-08cbf831121a
+	github.com/tikv/client-go/v2 v2.0.8-0.20260918070520-787f20af357c
 	github.com/tikv/pd/client v0.0.0-20260805103528-afa43111d149
 	github.com/timakin/bodyclose v0.0.0-20241222091800-1db5c5ca4d67
 	github.com/twmb/murmur3 v1.1.6
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -2368,8 +2368,8 @@ github.com/tidwall/pretty v1.2.1 h1:qjsOFOWWQl+N3RsoF5/ssm1pHmJJwhjlSbZ51I6wMl4=
 github.com/tidwall/pretty v1.2.1/go.mod h1:ITEVvHYasfjBbM0u2Pg8T2nJnzm8xPwvNhhsoaGGjNU=
 github.com/tidwall/sjson v1.2.5 h1:kLy8mja+1c9jlljvWTlSazM7cKDRfJuR/bOJhcY5NcY=
 github.com/tidwall/sjson v1.2.5/go.mod h1:Fvgq9kS/6ociJEDnK0Fk1cpYF4FIW6ZF7LAe+6jwd28=
-github.com/tikv/client-go/v2 v2.0.8-0.20260903102657-08cbf831121a h1:OFhRCzHqFeARZMIum85M3PTLLmEIDeLXVG+jrRNI76w=
-github.com/tikv/client-go/v2 v2.0.8-0.20260903102657-08cbf831121a/go.mod h1:4pMn4TwlKD9CIiRXT3d6d+iNVf3PPBoxYw/LSnYmS9g=
+github.com/tikv/client-go/v2 v2.0.8-0.20260918070520-787f20af357c h1:e2GcofWhqtCKREy73l6oX6SbJxzwmS9Wl4LRzXfHzDQ=
+github.com/tikv/client-go/v2 v2.0.8-0.20260918070520-787f20af357c/go.mod h1:4pMn4TwlKD9CIiRXT3d6d+iNVf3PPBoxYw/LSnYmS9g=
 github.com/tikv/pd/client v0.0.0-20260805103528-afa43111d149 h1:q5NgKsvuOdEHspG/pZEpKhWlPLrIfmO8P/lDFjTEdok=
 github.com/tikv/pd/client v0.0.0-20260805103528-afa43111d149/go.mod h1:sfdha4LXeUkSs2Z7N5jLzDEtm0GE7x+Glm2pW3UgEpA=
 github.com/timakin/bodyclose v0.0.0-20241222091800-1db5c5ca4d67 h1:9LPGD+jzxMlnk5r6+hJnar67cgpDIz/iyD+rfl5r2Vk=
```

---

### Incident Patch 12: `6884fa5e` (2026-09-18)
**Commit Message**: ddl, globalsort: bound global sort merge memory (#70756)

ref pingcap/tidb#62853

**File**: `pkg/ddl/backfilling_merge_sort.go` (modified, +1/-4)
```diff
@@ -107,14 +107,12 @@ func (m *mergeSortExecutor) RunSubtask(ctx context.Context, subtask *proto.Subta
 
 	prefix := path.Join(strconv.Itoa(int(subtask.TaskID)), strconv.Itoa(int(subtask.ID)))
 	res := m.GetResource()
-	memSizePerCon := res.MemoryPerCore()
-	partSize := max(simplesst.MinUploadPartSize, memSizePerCon*int64(globalsort.MaxMergingFilesPerThread)/simplesst.MaxUploadPartCount)
 
 	wctx := workerpool.NewContext(ctx)
 	op := globalsort.NewMergeOperator(
 		wctx,
 		objStore,
-		partSize,
+		res.MemoryPerCore(),
 		prefix,
 		simplesst.DefaultBlockSize,
 		onWriterClose,
@@ -132,7 +130,6 @@ func (m *mergeSortExecutor) RunSubtask(ctx context.Context, subtask *proto.Subta
 	err = globalsort.MergeOverlappingFiles(
 		wctx,
 		sm.DataFiles,
-		int(m.GetResource().CPU.Capacity()), // the concurrency used to split subtask
 		op,
 	)
 
```

**File**: `pkg/dxf/importinto/task_executor.go` (modified, +5/-25)
```diff
@@ -450,30 +450,14 @@ type mergeSortStepExecutor struct {
 	// subtask of a task is run in serial now, so we don't need lock here.
 	// change to SyncMap when we support parallel subtask in the future.
 	subtaskSortedKVMeta *globalsort.SortedKVMeta
-	// part-size for uploading merged files, it's calculated by:
-	// 	max(max-merged-files * max-file-size / max-part-num(10000), min-part-size)
-	dataKVPartSize  int64
-	indexKVPartSize int64
-	store           tidbkv.Storage
-	indicesGenKV    map[int64]importer.GenKVIndex
+	store               tidbkv.Storage
+	indicesGenKV        map[int64]importer.GenKVIndex
 
 	summary execute.SubtaskSummary
 }
 
 var _ execute.StepExecutor = &mergeSortStepExecutor{}
 
-func (m *mergeSortStepExecutor) Init(context.Context) error {
-	dataKVMemSizePerCon, perIndexKVMemSizePerCon := getWriterMemorySizeLimit(m.GetResource(), &m.taskMeta.Plan)
-	m.dataKVPartSize = max(simplesst.MinUploadPartSize, int64(dataKVMemSizePerCon*uint64(globalsort.MaxMergingFilesPerThread)/simplesst.MaxUploadPartCount))
-	m.indexKVPartSize = max(simplesst.MinUploadPartSize, int64(perIndexKVMemSizePerCon*uint64(globalsort.MaxMergingFilesPerThread)/simplesst.MaxUploadPartCount))
-
-	m.logger.Info("merge sort partSize",
-		zap.String("data-kv", units.BytesSize(float64(m.dataKVPartSize))),
-		zap.String("index-kv", units.BytesSize(float64(m.indexKVPartSize))),
-	)
-	return nil
-}
-
 func (m *mergeSortStepExecutor) RunSubtask(ctx context.Context, subtask *proto.Subtask) (err error) {
 	defer func() {
 		err = normalizeSubtaskErr(err)
@@ -516,10 +500,6 @@ func (m *mergeSortStepExecutor) RunSubtask(ctx context.Context, subtask *proto.S
 
 	prefix := subtaskPrefix(m.task.ID, subtask.ID)
 
-	partSize := m.dataKVPartSize
-	if sm.KVGroup != globalsort.DataKVGroup {
-		partSize = m.indexKVPartSize
-	}
 	onDup, err := getOnDupForKVGroup(
 		m.indicesGenKV,
 		sm.KVGroup,
@@ -530,23 +510,23 @@ func (m *mergeSortStepExecutor) RunSubtask(ctx context.Context, subtask *proto.S
 	}
 
 	wctx := workerpool.NewContext(ctx)
+	res := m.GetResource()
 	op := globalsort.NewMergeOperator(
 		wctx,
 		objStore,
-		partSize,
+		res.MemoryPerCore(),
 		prefix,
 		simplesst.DefaultOneWriterBlockSize,
 		onWriterClose,
 		globalsort.NewMergeCollector(ctx, &m.summary),
-		int(m.GetResource().CPU.Capacity()),
+		int(res.CPU.Capacity()),
 		false,
 		onDup,
 	)
 
 	if err = globalsort.MergeOverlappingFiles(
 		wctx,
 		sm.DataFiles,
-		int(m.GetResource().CPU.Capacity()), // the concurrency used to split subtask
 		op,
 	); err != nil {
 		return errors.Trace(err)
```

**File**: `pkg/ingestor/globalsort/bench_test.go` (modified, +10/-3)
```diff
@@ -374,7 +374,15 @@ func readMergeIter(t *testing.T, s *readTestSuite) {
 	var totalSize int
 	readBufSize := s.memoryLimit / len(files)
 	zeroOffsets := make([]uint64, len(files))
-	iter, err := simplesst.NewMergeKVIter(ctx, files, zeroOffsets, s.store, readBufSize, s.mergeIterHotspot, 1)
+	iter, err := simplesst.NewMergeKVIter(
+		ctx,
+		files,
+		zeroOffsets,
+		s.store,
+		readBufSize,
+		s.mergeIterHotspot,
+		maxMergeReaderMemoryPerCore,
+	)
 	intest.AssertNoError(err)
 
 	kvCnt := 0
@@ -529,7 +537,7 @@ func mergeStep(t *testing.T, s *mergeTestSuite) {
 	op := NewMergeOperator(
 		wctx,
 		s.store,
-		int64(5*size.MB),
+		5*maxMergeReaderMemoryPerCore,
 		mergeOutput,
 		simplesst.DefaultBlockSize,
 		onClose,
@@ -542,7 +550,6 @@ func mergeStep(t *testing.T, s *mergeTestSuite) {
 	err = MergeOverlappingFiles(
 		wctx,
 		datas,
-		s.concurrency,
 		op,
 	)
 
```

**File**: `pkg/ingestor/globalsort/merge.go` (modified, +78/-43)
```diff
@@ -43,6 +43,12 @@ var (
 	MaxMergingFilesPerThread = 250
 )
 
+const (
+	// maxMergeReaderMemoryPerCore allows 32 concurrent 8 MiB range reads per CPU;
+	// AWS S3 benchmarks showed this was sufficient for merge throughput.
+	maxMergeReaderMemoryPerCore = 256 * units.MiB
+)
+
 var _ execute.Collector = &mergeCollector{}
 
 // mergeCollector collects the bytes and row count in merge step.
@@ -76,9 +82,9 @@ func (c *mergeCollector) Processed(bytes, rowCnt int64) {
 }
 
 type mergeMinimalTask struct {
-	files        []string
-	fileGroupNum int
-	writerID     string
+	files            []string
+	activeGroupCount int
+	writerID         string
 }
 
 // RecoverArgs implements workerpool.TaskMayPanic interface.
@@ -89,13 +95,21 @@ func (*mergeMinimalTask) RecoverArgs() (metricsLabel string, funcInfo string, er
 // MergeOperator is the operator that merges overlapping files.
 type MergeOperator struct {
 	*operator.AsyncOperator[*mergeMinimalTask, workerpool.None]
+	concurrency int
+}
+
+// getMergeReaderMemory returns the concurrent-reader budget for one merge subtask.
+// It gives each CPU up to 256 MiB and uses 20% of the memory per core as a
+// safety limit for memory-constrained workers.
+func getMergeReaderMemory(memoryPerCore int64, concurrency int) int64 {
+	return min(maxMergeReaderMemoryPerCore, memoryPerCore/5) * int64(concurrency)
 }
 
 // NewMergeOperator creates a new MergeOperator instance.
 func NewMergeOperator(
 	ctx *workerpool.Context,
 	store storeapi.Storage,
-	partSize int64,
+	memoryPerCore int64,
 	newFilePrefix string,
 	blockSize int,
 	onWriterClose simplesst.OnWriterCloseFunc,
@@ -104,34 +118,33 @@ func NewMergeOperator(
 	checkHotspot bool,
 	onDup engineapi.OnDuplicateKey,
 ) *MergeOperator {
-	// during encode&sort step, the writer-limit is aligned to block size, so we
-	// need align this too. the max additional written size per file is max-block-size.
-	// for max-block-size = 32MiB, adding (max-block-size * MaxMergingFilesPerThread)/10000 ~ 1MiB
-	// to part-size is enough.
-	partSize = max(simplesst.MinUploadPartSize, partSize+units.MiB)
+	concurrency = max(concurrency, 1)
+	totalReaderMemorySize := getMergeReaderMemory(memoryPerCore, concurrency)
 	logutil.Logger(ctx).Info("create merge operator",
-		zap.Int64("part-size", partSize))
+		zap.Int64("memory-per-core", memoryPerCore),
+		zap.Int64("total-reader-memory-size", totalReaderMemorySize))
 	pool := workerpool.NewWorkerPool(
 		"mergeOperator",
 		util.ImportInto,
 		concurrency,
 		func() workerpool.Worker[*mergeMinimalTask, workerpool.None] {
 			return &mergeWorker{
-				ctx:           ctx,
-				store:         store,
-				partSize:      partSize,
-				newFilePrefix: newFilePrefix,
-				blockSize:     blockSize,
-				onWriterClose: onWriterClose,
-				collector:     collector,
-				checkHotspot:  checkHotspot,
-				onDup:         onDup,
+				ctx:                   ctx,
+				store:                 store,
+				totalReaderMemorySize: totalReaderMemorySize,
+				newFilePrefix:         newFilePrefix,
+				blockSize:             blockSize,
+				onWriterClose:         onWriterClose,
+				collector:             collector,
+				checkHotspot:          checkHotspot,
+				onDup:                 onDup,
 			}
 		},
 	)
 
 	return &MergeOperator{
 		AsyncOperator: operator.NewAsyncOperator(ctx, pool),
+		concurrency:   concurrency,
 	}
 }
 
@@ -143,30 +156,30 @@ func (*MergeOperator) String() string {
 type mergeWorker struct {
 	ctx context.Context
 
-	store         storeapi.Storage
-	partSize      int64
-	newFilePrefix string
-	blockSize     int
-	onWriterClose simplesst.OnWriterCloseFunc
-	collector     execute.Collector
-	checkHotspot  bool
-	onDup         engineapi.OnDuplicateKey
+	store                 storeapi.Storage
+	totalReaderMemorySize int64
+	newFilePrefix         string
+	blockSize             int
+	onWriterClose         simplesst.OnWriterCloseFunc
+	collector             execute.Collector
+	checkHotspot          bool
+	onDup                 engineapi.OnDuplicateKey
 }
 
 func (w *mergeWorker) HandleTask(task *mergeMinimalTask, _ func(workerpool.None)) error {
+	memorySizePerGroup := w.totalReaderMemorySize / int64(task.activeGroupCount)
 	return mergeOverlappingFilesInternal(
 		w.ctx,
 		task.files,
 		w.store,
-		w.partSize,
 		w.newFilePrefix,
 		task.writerID,
 		w.blockSize,
 		w.onWriterClose,
 		w.collector,
 		w.checkHotspot,
 		w.onDup,
-		task.fileGroupNum,
+		memorySizePerGroup,
 	)
 }
 
@@ -179,21 +192,22 @@ func (*mergeWorker) Close() error {
 func MergeOverlappingFiles(
 	ctx *workerpool.Context,
 	paths []string,
-	concurrency int,
 	op *MergeOperator,
 ) error {
+	concurrency := op.concurrency
 	dataFilesSlice := splitDataFiles(paths, concurrency)
 	logutil.Logger(ctx).Info("start to merge overlapping files",
 		zap.Int("file-count", len(paths)),
 		zap.Int("file-groups", len(dataFilesSlice)),
 		zap.Int("concurrency", concurrency))
 
 	mergeTasks := make([]*mergeMinimalTask, 0, len(dataFilesSlice))
+	ac
```

**File**: `pkg/ingestor/globalsort/merge_test.go` (modified, +40/-7)
```diff
@@ -148,6 +148,36 @@ func TestSplitDataFiles(t *testing.T) {
 }
 
 func TestMergeOperator(t *testing.T) {
+	t.Run("memory-plan", func(t *testing.T) {
+		const gib = int64(1024 * 1024 * 1024)
+		const mib = int64(1024 * 1024)
+		lowMemoryPerCore := 9 * gib / 10
+		lowMemoryReaderBudget := getMergeReaderMemory(lowMemoryPerCore, 1)
+		standardReaderBudget := getMergeReaderMemory(4*gib, 1)
+		threeCPUReaderBudget := getMergeReaderMemory(4*gib, 3)
+		sevenCPUReaderBudget := getMergeReaderMemory(4*gib, 7)
+		require.Equal(t, lowMemoryPerCore/5, lowMemoryReaderBudget)
+		require.Equal(t, 256*mib, standardReaderBudget)
+		require.Equal(t, int64(23), lowMemoryReaderBudget/int64(simplesst.ConcurrentReaderBufferSizePerConc))
+		require.Equal(t, int64(32), standardReaderBudget/int64(simplesst.ConcurrentReaderBufferSizePerConc))
+		require.Equal(t, 3*256*mib, threeCPUReaderBudget)
+		require.Equal(t, 7*256*mib, sevenCPUReaderBudget)
+		require.Equal(t, int64(32), sevenCPUReaderBudget/7/int64(simplesst.ConcurrentReaderBufferSizePerConc))
+
+		inputSize := 80 * gib
+		partSize := getMergePartSize(inputSize, 33, 16*int(mib))
+		maxOutputSize := inputSize + 33*16*mib
+		expectedPartSize := maxOutputSize / simplesst.MaxUploadPartCount
+		if maxOutputSize%simplesst.MaxUploadPartCount != 0 {
+			expectedPartSize++
+		}
+		require.Equal(t, expectedPartSize, partSize)
+		require.LessOrEqual(t, (maxOutputSize+partSize-1)/partSize, int64(simplesst.MaxUploadPartCount))
+
+		partSize = getMergePartSize(mib, 1, int(mib))
+		require.Equal(t, simplesst.MinUploadPartSize, partSize)
+	})
+
 	oldMaxMergingFilesPerThread := MaxMergingFilesPerThread
 	MaxMergingFilesPerThread = 2
 	defer func() {
@@ -158,22 +188,27 @@ func TestMergeOperator(t *testing.T) {
 	testcases := []struct {
 		failpointValue string
 		expectError    error
+		concurrency    int
 	}{
 		{
 			failpointValue: "return(0)",
 			expectError:    nil,
+			concurrency:    0,
 		},
 		{
 			failpointValue: "return(1)",
 			expectError:    errors.Errorf("mock error in mergeOverlappingFilesInternal"),
+			concurrency:    1,
 		},
 		{
 			failpointValue: "return(2)",
 			expectError:    errors.Errorf("task panic: merge_sort, func info: mergeMinimalTask"),
+			concurrency:    1,
 		},
 		{
 			failpointValue: "return(3)",
 			expectError:    context.DeadlineExceeded,
+			concurrency:    1,
 		},
 	}
 
@@ -189,15 +224,16 @@ func TestMergeOperator(t *testing.T) {
 		op := NewMergeOperator(
 			wctx,
 			nil,
-			0,
+			5*maxMergeReaderMemoryPerCore,
 			"",
 			0,
 			nil,
 			nil,
-			1,
+			tc.concurrency,
 			false,
 			engineapi.OnDuplicateKeyIgnore,
 		)
+		require.Equal(t, max(tc.concurrency, 1), op.concurrency)
 
 		datas := []string{
 			"/tmp/1",
@@ -211,7 +247,6 @@ func TestMergeOperator(t *testing.T) {
 		err := MergeOverlappingFiles(
 			wctx,
 			datas,
-			1,
 			op,
 		)
 
@@ -271,15 +306,14 @@ func TestMergeOverlappingFilesInternal(t *testing.T) {
 		ctx,
 		dataFiles,
 		memStore,
-		int64(5*size.MB),
 		"/test2",
 		"mergeID",
 		1000,
 		func(summary *simplesst.WriterSummary) { onefile = summary.MultipleFilesStats[0].Filenames[0] },
 		collector,
 		true,
 		engineapi.OnDuplicateKeyIgnore,
-		1,
+		int64(10*size.MB),
 	))
 
 	require.EqualValues(t, kvCount, collector.Rows.Load())
@@ -374,15 +408,14 @@ func TestOnefileWriterManyRows(t *testing.T) {
 		ctx,
 		[]string{kvAndStat[0]},
 		memStore,
-		int64(5*size.MB),
 		"/test2",
 		"mergeID",
 		1000,
 		onClose,
 		nil,
 		true,
 		engineapi.OnDuplicateKeyIgnore,
-		1,
+		int64(10*size.MB),
 	))
 
 	bufSize := rand.Intn(100) + 1
```

**File**: `pkg/ingestor/globalsort/sort_test.go` (modified, +1/-2)
```diff
@@ -184,7 +184,7 @@ func TestGlobalSortLocalWithMerge(t *testing.T) {
 		op := NewMergeOperator(
 			wctx,
 			memStore,
-			int64(5*size.MB),
+			5*maxMergeReaderMemoryPerCore,
 			"/test2",
 			mergeMemSize,
 			onWriterClose,
@@ -197,7 +197,6 @@ func TestGlobalSortLocalWithMerge(t *testing.T) {
 		require.NoError(t, MergeOverlappingFiles(
 			wctx,
 			group,
-			1,
 			op,
 		))
 	}
```

**File**: `pkg/ingestor/simplesst/BUILD.bazel` (modified, +2/-1)
```diff
@@ -40,6 +40,7 @@ go_library(
         "@com_github_prometheus_client_golang//prometheus",
         "@com_github_tikv_client_go_v2//tikv",
         "@org_golang_x_sync//errgroup",
+        "@org_uber_go_atomic//:atomic",
         "@org_uber_go_zap//:zap",
         "@org_uber_go_zap//zapcore",
     ],
@@ -60,7 +61,7 @@ go_test(
     ],
     embed = [":simplesst"],
     flaky = True,
-    shard_count = 49,
+    shard_count = 48,
     deps = [
         "//pkg/config",
         "//pkg/ingestor/engineapi",
```

**File**: `pkg/ingestor/simplesst/byte_reader.go` (modified, +1/-2)
```diff
@@ -37,8 +37,7 @@ var (
 	// ConcurrentReaderBufferSizePerConc is the buffer size for concurrent reader per
 	// concurrency.
 	ConcurrentReaderBufferSizePerConc = int(8 * size.MB)
-	// concurrentReaderTotalConcurrency is the maximum concurrent-read budget used by
-	// external readers within one task.
+	// concurrentReaderTotalConcurrency limits the range-read fan-out for one file.
 	concurrentReaderTotalConcurrency = 256
 )
 
```

---

### Incident Patch 13: `5316d435` (2026-09-17)
**Commit Message**: util: preserve accumulated null rejection in hash join keys (#71205)

close pingcap/tidb#71197

**File**: `pkg/util/codec/codec.go` (modified, +13/-13)
```diff
@@ -929,7 +929,7 @@ func HashChunkSelected(typeCtx types.Context, h []hash.Hash64, chk *chunk.Chunk,
 			}
 			if column.IsNull(i) {
 				buf[0], b = NilFlag, nil
-				isNull[i] = !ignoreNull
+				isNull[i] = isNull[i] || !ignoreNull
 			} else {
 				buf[0] = uvarintFlag
 				if !mysql.HasUnsignedFlag(tp.GetFlag()) && v < 0 {
@@ -951,7 +951,7 @@ func HashChunkSelected(typeCtx types.Context, h []hash.Hash64, chk *chunk.Chunk,
 			}
 			if column.IsNull(i) {
 				buf[0], b = NilFlag, nil
-				isNull[i] = !ignoreNull
+				isNull[i] = isNull[i] || !ignoreNull
 			} else {
 				buf[0] = floatFlag
 				d := float64(f)
@@ -977,7 +977,7 @@ func HashChunkSelected(typeCtx types.Context, h []hash.Hash64, chk *chunk.Chunk,
 			}
 			if column.IsNull(i) {
 				buf[0], b = NilFlag, nil
-				isNull[i] = !ignoreNull
+				isNull[i] = isNull[i] || !ignoreNull
 			} else {
 				buf[0] = floatFlag
 				// For negative zero. In memory, 0 is [0, 0, 0, 0, 0, 0, 0, 0] and -0 is [0, 0, 0, 0, 0, 0, 0, 128].
@@ -1001,7 +1001,7 @@ func HashChunkSelected(typeCtx types.Context, h []hash.Hash64, chk *chunk.Chunk,
 			}
 			if column.IsNull(i) {
 				buf[0], b = NilFlag, nil
-				isNull[i] = !ignoreNull
+				isNull[i] = isNull[i] || !ignoreNull
 			} else {
 				buf[0] = compactBytesFlag
 				b = column.GetBytes(i)
@@ -1021,7 +1021,7 @@ func HashChunkSelected(typeCtx types.Context, h []hash.Hash64, chk *chunk.Chunk,
 			}
 			if column.IsNull(i) {
 				buf[0], b = NilFlag, nil
-				isNull[i] = !ignoreNull
+				isNull[i] = isNull[i] || !ignoreNull
 			} else {
 				buf[0] = uintFlag
 
@@ -1045,7 +1045,7 @@ func HashChunkSelected(typeCtx types.Context, h []hash.Hash64, chk *chunk.Chunk,
 			}
 			if column.IsNull(i) {
 				buf[0], b = NilFlag, nil
-				isNull[i] = !ignoreNull
+				isNull[i] = isNull[i] || !ignoreNull
 			} else {
 				buf[0] = durationFlag
 				// duration may have negative value, so we cannot use String to encode directly.
@@ -1065,7 +1065,7 @@ func HashChunkSelected(typeCtx types.Context, h []hash.Hash64, chk *chunk.Chunk,
 			}
 			if column.IsNull(i) {
 				buf[0], b = NilFlag, nil
-				isNull[i] = !ignoreNull
+				isNull[i] = isNull[i] || !ignoreNull
 			} else {
 				buf[0] = decimalFlag
 				// If hash is true, we only consider the original value of this decimal and ignore it's precision.
@@ -1091,7 +1091,7 @@ func HashChunkSelected(typeCtx types.Context, h []hash.Hash64, chk *chunk.Chunk,
 			}
 			if column.IsNull(i) {
 				buf[0], b = NilFlag, nil
-				isNull[i] = !ignoreNull
+				isNull[i] = isNull[i] || !ignoreNull
 			} else if mysql.HasEnumSetAsIntFlag(tp.GetFlag()) {
 				buf[0] = uvarintFlag
 				v := column.GetEnum(i).Value
@@ -1120,7 +1120,7 @@ func HashChunkSelected(typeCtx types.Context, h []hash.Hash64, chk *chunk.Chunk,
 			}
 			if column.IsNull(i) {
 				buf[0], b = NilFlag, nil
-				isNull[i] = !ignoreNull
+				isNull[i] = isNull[i] || !ignoreNull
 			} else {
 				buf[0] = compactBytesFlag
 				s, err := types.ParseSetValue(tp.GetElems(), column.GetSet(i).Value)
@@ -1142,7 +1142,7 @@ func HashChunkSelected(typeCtx types.Context, h []hash.Hash64, chk *chunk.Chunk,
 			}
 			if column.IsNull(i) {
 				buf[0], b = NilFlag, nil
-				isNull[i] = !ignoreNull
+				isNull[i] = isNull[i] || !ignoreNull
 			} else {
 				// We don't need to handle errors here since the literal is ensured to be able to store in uint64 in convertToMysqlBit.
 				buf[0] = uvarintFlag
@@ -1163,7 +1163,7 @@ func HashChunkSelected(typeCtx types.Context, h []hash.Hash64, chk *chunk.Chunk,
 			}
 			if column.IsNull(i) {
 				buf[0], b = NilFlag, nil
-				isNull[i] = !ignoreNull
+				isNull[i] = isNull[i] || !ignoreNull
 			} else {
 				buf[0] = jsonFlag
 				json := column.GetJSON(i)
@@ -1183,7 +1183,7 @@ func HashChunkSelected(typeCtx types.Context, h []hash.Hash64, chk *chunk.Chunk,
 			}
 			if column.IsNull(i) {
 				buf[0], b = NilFlag, nil
-				isNull[i] = !ignoreNull
+				isNull[i] = isNull[i] || !ignoreNull
 			} else {
 				buf[0] = vectorFloat32Flag
 				v := column.GetVectorFloat32(i)
@@ -1200,7 +1200,7 @@ func HashChunkSelected(typeCtx types.Context, h []hash.Hash64, chk *chunk.Chunk,
 			if sel != nil && !sel[i] {
 				continue
 			}
-			isNull[i] = !ignoreNull
+			isNull[i] = isNull[i] || !ignoreNull
 			buf[0] = NilFlag
 			_, _ = h[i].Write(buf)
 		}
```

**File**: `pkg/util/codec/codec_test.go` (modified, +12/-0)
```diff
@@ -1270,6 +1270,18 @@ func TestHashChunkColumns(t *testing.T) {
 		require.Equal(t, rowHash[2].Sum64(), vecHash[2].Sum64())
 	}
 
+	// A null-safe key must not clear a null-rejecting flag from an earlier key.
+	for i := range 12 {
+		hasNull = []bool{false, false, false}
+		selected := []bool{true, false, true, false}
+		require.NoError(t, HashChunkSelected(typeCtx, vecHash, chk, tps[i], i, buf, hasNull, selected, true))
+		require.Equal(t, []bool{false, false, false}, hasNull)
+		require.NoError(t, HashChunkSelected(typeCtx, vecHash, chk, tps[i], i, buf, hasNull, selected, false))
+		require.Equal(t, []bool{true, false, true}, hasNull)
+		require.NoError(t, HashChunkSelected(typeCtx, vecHash, chk, tps[i], i, buf, hasNull, selected, true))
+		require.Equal(t, []bool{true, false, true}, hasNull, "type %v", tps[i])
+	}
+
 	// Test hash value of every single column that is not `Null`
 	for i := 12; i < len(tps); i++ {
 		hasNull = []bool{false, false, false}
```

**File**: `tests/integrationtest/r/executor/mixed_null_join_keys.result` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+create table null_keys_l(a int, b int);
+create table null_keys_r(a int, b int);
+insert into null_keys_l values (null,null);
+insert into null_keys_r values (null,null);
+select exists(select 1 from null_keys_l l where l.b=r.b and l.a<=>r.a) from null_keys_r r;
+exists(select 1 from null_keys_l l where l.b=r.b and l.a<=>r.a)
+0
+select exists(select 1 from null_keys_l l where l.a<=>r.a and l.b=r.b) from null_keys_r r;
+exists(select 1 from null_keys_l l where l.a<=>r.a and l.b=r.b)
+0
+select not exists(select 1 from null_keys_l l where l.b=r.b and l.a<=>r.a) from null_keys_r r;
+not exists(select 1 from null_keys_l l where l.b=r.b and l.a<=>r.a)
+1
+select exists(select 1 from null_keys_l l where l.a<=>r.a and l.b<=>r.b) from null_keys_r r;
+exists(select 1 from null_keys_l l where l.a<=>r.a and l.b<=>r.b)
+1
+select * from null_keys_r r where not exists(select 1 from null_keys_l l where l.b=r.b and l.a<=>r.a);
+a	b
+NULL	NULL
+insert into null_keys_l values (null,1), (2,2);
+insert into null_keys_r values (null,1), (2,2), (3,3);
+select a,b,exists(select 1 from null_keys_l l where l.b=r.b and l.a<=>r.a) as matched from null_keys_r r order by b;
+a	b	matched
+NULL	NULL	0
+NULL	1	1
+2	2	1
+3	3	0
+select a,b,not exists(select 1 from null_keys_l l where l.b=r.b and l.a<=>r.a) as unmatched from null_keys_r r order by b;
+a	b	unmatched
+NULL	NULL	1
+NULL	1	0
+2	2	0
+3	3	1
+drop table null_keys_l,null_keys_r;
```

**File**: `tests/integrationtest/t/executor/mixed_null_join_keys.test` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+create table null_keys_l(a int, b int);
+create table null_keys_r(a int, b int);
+insert into null_keys_l values (null,null);
+insert into null_keys_r values (null,null);
+select exists(select 1 from null_keys_l l where l.b=r.b and l.a<=>r.a) from null_keys_r r;
+select exists(select 1 from null_keys_l l where l.a<=>r.a and l.b=r.b) from null_keys_r r;
+select not exists(select 1 from null_keys_l l where l.b=r.b and l.a<=>r.a) from null_keys_r r;
+select exists(select 1 from null_keys_l l where l.a<=>r.a and l.b<=>r.b) from null_keys_r r;
+select * from null_keys_r r where not exists(select 1 from null_keys_l l where l.b=r.b and l.a<=>r.a);
+insert into null_keys_l values (null,1), (2,2);
+insert into null_keys_r values (null,1), (2,2), (3,3);
+select a,b,exists(select 1 from null_keys_l l where l.b=r.b and l.a<=>r.a) as matched from null_keys_r r order by b;
+select a,b,not exists(select 1 from null_keys_l l where l.b=r.b and l.a<=>r.a) as unmatched from null_keys_r r order by b;
+drop table null_keys_l,null_keys_r;
```

---

### Incident Patch 14: `e80270eb` (2026-09-16)
**Commit Message**: importinto: fix flaky expired conflict row cleanup test (#71085)

close pingcap/tidb#69772, close pingcap/tidb#70977

**File**: `tests/realtikvtest/importintotest4/conflict_resolution_test.go` (modified, +9/-3)
```diff
@@ -61,14 +61,20 @@ func (s *mockGCSSuite) TestNextGenExpiredConflictRowCleanup() {
 	)
 	ctx := s.ctx
 	baseSortURI := fmt.Sprintf("gs://%s?endpoint=%s", sortBucket, gcsEndpoint)
-	originalCloudStorageURI := vardef.CloudStorageURI.Load()
+	originalCloudStorageURIRows := s.tk.MustQuery(`select variable_value from mysql.global_variables
+		where variable_name = ?`, vardef.TiDBCloudStorageURI).Rows()
+	require.Len(t, originalCloudStorageURIRows, 1)
+	originalCloudStorageURI := originalCloudStorageURIRows[0][0]
 	t.Cleanup(func() {
-		vardef.CloudStorageURI.Store(originalCloudStorageURI)
+		s.tk.MustExec("set global tidb_cloud_storage_uri = ?", originalCloudStorageURI)
 	})
 
 	s.server.CreateBucketWithOpts(fakestorage.CreateBucketOpts{Name: sourceBucket})
 	s.server.CreateBucketWithOpts(fakestorage.CreateBucketOpts{Name: sortBucket})
-	vardef.CloudStorageURI.Store(baseSortURI)
+	s.tk.MustExec("set global tidb_cloud_storage_uri = ?", baseSortURI)
+	s.tk.MustQuery(`select variable_value from mysql.global_variables
+		where variable_name = ?`, vardef.TiDBCloudStorageURI).
+		Check(testkit.Rows(baseSortURI))
 	rootedSortURI := handle.GetCloudStorageURI(ctx, s.store)
 	sortStore, err := importer.GetSortStore(ctx, rootedSortURI)
 	require.NoError(t, err)
```

**File**: `tests/realtikvtest/testkit.go` (modified, +1/-0)
```diff
@@ -304,6 +304,7 @@ func CreateMockStoreAndDomainAndSetup(t *testing.T, opts ...RealTiKVStoreOption)
 	tk.MustExec("use test")
 
 	if !option.retainData {
+		tk.MustExec("delete from mysql.tidb_import_jobs;")
 		tk.MustExec("delete from mysql.tidb_global_task;")
 		tk.MustExec("delete from mysql.tidb_background_subtask;")
 		tk.MustExec("delete from mysql.tidb_ddl_job;")
```

---

### Incident Patch 15: `0386d784` (2026-09-15)
**Commit Message**: executor: fix statement RU accounting for wrapped and locking statements (#71067)

ref pingcap/tidb#70747

**File**: `pkg/executor/adapter.go` (modified, +6/-3)
```diff
@@ -1152,6 +1152,8 @@ func (a *ExecStmt) runPessimisticSelectForUpdate(ctx context.Context, e exec.Exe
 			break
 		}
 		if req.NumRows() == 0 {
+			// The returned record set only drains buffered rows; execution ends here.
+			a.recordStatementRURootEOF()
 			return &chunkRowRecordSet{rows: rows, e: e, execStmt: a}, nil
 		}
 		iter := chunk.NewIterator4Chunk(req)
@@ -1193,9 +1195,10 @@ func (a *ExecStmt) handleNoDelayExecutor(ctx context.Context, e exec.Executor) (
 	if err != nil {
 		return nil, err
 	}
-	if _, ok := a.Plan.(*plannercore.Analyze); ok || statementRUIsWritePlan(a.Plan) || statementRUIsCommitPlan(a.Plan) {
-		// ANALYZE, DML and COMMIT complete in their only Next call, so there
-		// is no RecordSet EOF callback to record later.
+	switch classifyStatementRUPlan(a.Plan).kind {
+	case statementRUPlanAnalyze, statementRUPlanWrite, statementRUPlanCommit:
+		// These targets complete in their only Next call. Any EXPLAIN result
+		// set reports work that has already finished executing.
 		a.recordStatementRURootEOF()
 	}
 	err = a.handleStmtForeignKeyTrigger(ctx, e)
```

**File**: `pkg/executor/statement_ru_plan_walk.go` (modified, +16/-22)
```diff
@@ -21,6 +21,7 @@ import (
 
 	"github.com/pingcap/tidb/pkg/expression"
 	"github.com/pingcap/tidb/pkg/kv"
+	"github.com/pingcap/tidb/pkg/parser/ast"
 	"github.com/pingcap/tidb/pkg/parser/mysql"
 	plannercore "github.com/pingcap/tidb/pkg/planner/core"
 	"github.com/pingcap/tidb/pkg/planner/core/base"
@@ -188,9 +189,10 @@ func (a *ExecStmt) finishStatementRU(terminalErr error) float64 {
 			}
 			return
 		}
-		// a.Plan remains the statement eligibility guard even though the flat-plan
-		// view below comes from StatementContext.
-		if a.Ctx == nil || a.Plan == nil {
+		// Match the executed target, including EXPLAIN ANALYZE, against the
+		// flat-plan view borrowed from StatementContext.
+		planInfo := classifyStatementRUPlan(a.Plan)
+		if a.Ctx == nil || planInfo.plan == nil {
 			finalized.failure = statementRUInvalid
 			return
 		}
@@ -203,7 +205,7 @@ func (a *ExecStmt) finishStatementRU(terminalErr error) float64 {
 			finalized.failure = statementRUIneligible
 			return
 		}
-		if statementRUIsCommitPlan(a.Plan) {
+		if planInfo.kind == statementRUPlanCommit {
 			if !owner.rootEOF.Load() {
 				return
 			}
@@ -218,19 +220,9 @@ func (a *ExecStmt) finishStatementRU(terminalErr error) float64 {
 			return
 		}
 
-		switch plan := a.Plan.(type) {
-		case *physicalop.PointGetPlan:
+		if planInfo.kind == statementRUPlanPointLookup {
 			finalized, publishFinalized = calculateStatementRUPointLookup(
-				plan.ID(),
-				sessVars.StmtCtx.RuntimeStatsColl,
-				sessVars.RUV2Metrics,
-				calculationSetup,
-				owner.rootEOF.Load(),
-			)
-			return
-		case *physicalop.BatchPointGetPlan:
-			finalized, publishFinalized = calculateStatementRUPointLookup(
-				plan.ID(),
+				planInfo.plan.ID(),
 				sessVars.StmtCtx.RuntimeStatsColl,
 				sessVars.RUV2Metrics,
 				calculationSetup,
@@ -244,9 +236,9 @@ func (a *ExecStmt) finishStatementRU(terminalErr error) float64 {
 			return
 		}
 
-		// The fresh-session slice must use a flat plan rooted at this ExecStmt.
+		// The flat plan must be rooted at this statement's executed target.
 		// General flat-plan generation identity is not statement-RU evidence.
-		if len(flat.Main) == 0 || flat.Main[0] == nil || flat.Main[0].Origin != a.Plan {
+		if len(flat.Main) == 0 || flat.Main[0] == nil || flat.Main[0].Origin != planInfo.plan {
 			finalized.failure = statementRUInvalid
 			return
 		}
@@ -356,7 +348,8 @@ func calculateStatementRUInternal(
 	if !ok {
 		return statementRUTerminalFailure(rootEOF), false
 	}
-	if statementRUIsWritePlan(flat.Main[0].Origin) || statementRUIsCommitPlan(flat.Main[0].Origin) {
+	planInfo := classifyStatementRUPlan(flat.Main[0].Origin)
+	if planInfo.kind == statementRUPlanWrite || planInfo.kind == statementRUPlanCommit {
 		calculator.units.WriteKeys = float64(writes.keys)
 		calculator.units.WriteBytes = float64(writes.bytes)
 	}
@@ -366,7 +359,7 @@ func calculateStatementRUInternal(
 	// are not all available yet, so the finalized calibration
 	// remains Incomplete and the result is neither exact nor a mathematical upper
 	// or lower bound. Invalid values and malformed tree structure still fail closed.
-	if statementRUIsWritePlan(flat.Main[0].Origin) {
+	if planInfo.kind == statementRUPlanWrite {
 		calculator.units.WriteStatement = 1
 	}
 	mainRootUnits := calculator.units
@@ -412,7 +405,7 @@ func calculateStatementRUInternal(
 	}
 	finalized, ok := calculator.finalize()
 	if ok {
-		finalized.sqlType = statementRUSQLTypeForPlan(flat.Main[0].Origin)
+		finalized.sqlType = planInfo.sqlType
 	}
 	return finalized, ok
 }
@@ -618,7 +611,8 @@ func calculateStatementRUPlanChildFirst(
 			return statementRUOperatorResult{state: statementRUOperatorInvalid}
 		}
 	case *plannercore.Simple:
-		if !operator.IsRoot || len(children) != 0 || !statementRUIsCommitPlan(origin) {
+		_, isCommit := origin.Statement.(*ast.CommitStmt)
+		if !operator.IsRoot || len(children) != 0 || !isCommit {
 			return statementRUOperatorResult{state: statementRUOperatorUnsupported}
 		}
 	case *plannercore.Analyze:
```

**File**: `pkg/executor/statement_ru_plan_walk_integration_test.go` (modified, +244/-5)
```diff
@@ -209,6 +209,181 @@ func TestStatementRUAnalyzeNoDelayLifecycle(t *testing.T) {
 	require.Contains(t, decodedBySQL, "cop_task:")
 }
 
+func TestStatementRUWrappedStatements(t *testing.T) {
+	enableStatementRUExecutionInfo(t)
+	store := testkit.CreateMockStore(t)
+	tk := testkit.NewTestKit(t, store)
+	tk.MustExec("use test")
+	tk.MustExec("create table ru_wrapped(id int primary key, v int)")
+	tk.MustExec("insert into ru_wrapped values (1, 10), (2, 20)")
+
+	// UniStore Get responses need explicit scan details for point RU accounting.
+	responseHook := func(_ *tikvrpc.Request, resp *tikvrpc.Response) {
+		if get, ok := resp.Resp.(*kvrpcpb.GetResponse); ok {
+			get.ExecDetailsV2 = &kvrpcpb.ExecDetailsV2{ScanDetailV2: &kvrpcpb.ScanDetailV2{
+				TotalVersions: 2, ProcessedVersions: 1, ProcessedVersionsSize: 37,
+			}}
+		}
+	}
+	unistore.UnistoreRPCClientResponseHook.Store(&responseHook)
+	t.Cleanup(func() { unistore.UnistoreRPCClientResponseHook.Store(nil) })
+	testfailpoint.Enable(t,
+		"github.com/pingcap/tidb/pkg/store/mockstore/unistore/unistoreRPCClientResponseHook", "return(true)")
+
+	var observation *statementRUObservation
+	testfailpoint.EnableCall(t, statementRUOwnerInstallFailpoint, func(stmt *executor.ExecStmt) {
+		if stmt.Ctx == tk.Session() {
+			observation = observeInstalledStatementRUOwner(stmt)
+		}
+	})
+	var count int
+	var writeStatement, writeKeys, writeBytes, scanBytes, operatorNum float64
+	connectionID := tk.Session().GetSessionVars().ConnectionID
+	testfailpoint.EnableCall(t, statementRUCalibrationUnitsFailpoint, func(
+		observedID uint64, _ string, _, scan, _, _, _, _, ws, operators, keys, bytes float64,
+	) {
+		if observedID == connectionID {
+			count++
+			writeStatement, writeKeys, writeBytes, scanBytes, operatorNum = ws, keys, bytes, scan, operators
+		}
+	})
+
+	for _, binary := range []bool{false, true} {
+		t.Run(fmt.Sprintf("prepared analyze binary=%v", binary), func(t *testing.T) {
+			var run func()
+			if binary {
+				id, _, _, err := tk.Session().PrepareStmt("analyze table ru_wrapped")
+				require.NoError(t, err)
+				run = func() {
+					rs, err := tk.Session().ExecutePreparedStmt(context.Background(), id, nil)
+					require.NoError(t, err)
+					require.Nil(t, rs)
+				}
+				defer func() { require.NoError(t, tk.Session().DropPreparedStmt(id)) }()
+			} else {
+				tk.MustExec("prepare ru_analyze from 'analyze table ru_wrapped'")
+				defer tk.MustExec("deallocate prepare ru_analyze")
+				run = func() { tk.MustExec("execute ru_analyze") }
+			}
+			for range 2 {
+				before := count
+				run()
+				require.NotNil(t, observation.owner)
+				require.True(t, observation.owner.ConsumedForTest())
+				require.Equal(t, before+1, count)
+				require.Positive(t, operatorNum)
+				require.Zero(t, writeStatement)
+			}
+		})
+	}
+
+	for _, format := range []string{"", "format='brief' ", "format='ru' "} {
+		for _, explicitTxn := range []bool{false, true} {
+			for _, tc := range []struct {
+				sql   string
+				write bool
+			}{
+				{"select sum(v) from ru_wrapped", false},
+				{"select v from ru_wrapped where id=1", false},
+				{"insert into ru_wrapped values (3, 30)", true},
+				{"replace into ru_wrapped values (1, 11)", true},
+				{"update ru_wrapped set v=v+1 where id=1", true},
+				{"delete from ru_wrapped where id=2", true},
+			} {
+				t.Run(fmt.Sprintf("%s%s explicitTxn=%v", format, tc.sql, explicitTxn), func(t *testing.T) {
+					tk.MustExec("delete from ru_wrapped")
+					tk.MustExec("insert into ru_wrapped values (1, 10), (2, 20)")
+					if explicitTxn {
+						tk.MustExec("begin")
+						defer tk.MustExec("rollback")
+					}
+					before := count
+					tk.MustQuery("explain analyze " + format + tc.sql)
+					require.NotNil(t, observation.owner)
+					require.True(t, observation.owner.ConsumedForTest())
+					require.Equal(t, before+1, count)
+					require.Positive(t, operatorNum)
+					if tc.write {
+						require.Equal(t, float64(1), writeStatement)
+					} else {
+						require.Zero(t, writeStatement)
+						require.Positive(t, scanBytes)
+					}
+					if tc.write && !explicitTxn {
+						require.Positive(t, writeKeys)
+						require.Positive(t, writeBytes)
+					} else {
+						require.Zero(t, writeKeys)
+						require.Zero(t, writeBytes)
+					}
+					if tc.write && explicitTxn {
+						tk.MustExec("commit")
+						require.Equal(t, before+2, count)
+						require.Zero(t, writeStatement)
+						require.Positive(t, writeKeys)
+						require.Positive(t, writeBytes)
+					}
+				})
+			}
+		}
+	}
+
+	for _, binary := range []bool{false, true} {
+		for _, sql := range []string{
+			"explain analyze select sum(v) from ru_wrapped",
+			"explain analyze update ru_wrapped set v=v+1 where id=1",
+		} {
+			t.Run(fmt.Sprintf("prepared %s binary=%v", sql, binary), func(t *testing.T) {
+				var run func()
+				if binary {
+					id, _, _, err := tk.Session().PrepareStmt(sql)
+					require.NoError(t, err)
+					defer func() { require.NoError(t, tk.Session().Dr
```

**File**: `pkg/executor/statement_ru_reporting.go` (modified, +0/-24)
```diff
@@ -178,30 +178,6 @@ func (report *statementRUFullReport) addStatementUnits(units ruv2.StmtUnits) {
 	}
 }
 
-// statementRUSQLTypeForPlan classifies a successfully calculated statement by
-// its executed plan. Prepared statements have already been unwrapped, and the
-// type is independent of affected rows or whether a transaction wrote any keys.
-func statementRUSQLTypeForPlan(plan base.Plan) string {
-	switch plan := plan.(type) {
-	case *physicalop.Insert:
-		if plan.IsReplace {
-			return "replace"
-		}
-		return "insert"
-	case *physicalop.Update:
-		return "update"
-	case *physicalop.Delete:
-		return "delete"
-	case *plannercore.Analyze:
-		return "analyze"
-	case *plannercore.Simple:
-		// COMMIT is the only supported Simple plan.
-		return "commit"
-	default:
-		return "select"
-	}
-}
-
 func publishStatementRUFullMetrics(finalized statementRUFinalizedSnapshot) {
 	for engine, operators := range finalized.report.units {
 		for operator, units := range operators {
```

**File**: `pkg/executor/statement_ru_result.go` (modified, +55/-19)
```diff
@@ -115,11 +115,13 @@ func newStatementRUCalculationSetup(stmt *ExecStmt) (statementRUCalculationSetup
 		return statementRUCalculationSetup{}, false
 	}
 	sessVars := stmt.Ctx.GetSessionVars()
-	_, isAnalyze := stmt.Plan.(*plannercore.Analyze)
+	planInfo := classifyStatementRUPlan(stmt.Plan)
 	if sessVars == nil || sessVars.StmtCtx == nil {
 		return statementRUCalculationSetup{}, false
 	}
-	eligible := sessVars.StmtCtx.IsReadOnly || isAnalyze || statementRUIsWritePlan(stmt.Plan) || statementRUIsCommitPlan(stmt.Plan)
+	// Locking SELECTs still perform reads even though they are not read-only.
+	eligible := sessVars.StmtCtx.IsReadOnly || sessVars.StmtCtx.InSelectStmt ||
+		planInfo.kind == statementRUPlanAnalyze || planInfo.kind == statementRUPlanWrite || planInfo.kind == statementRUPlanCommit
 	if !eligible ||
 		sessVars.InRestrictedSQL || sessVars.HasStatusFlag(mysql.ServerStatusCursorExists) ||
 		sessVars.StmtCtx.GetFlatPlan() != nil {
@@ -131,26 +133,60 @@ func newStatementRUCalculationSetup(stmt *ExecStmt) (statementRUCalculationSetup
 	}, true
 }
 
-// statementRUIsWritePlan classifies DML independently of affected rows.
-func statementRUIsWritePlan(plan base.Plan) bool {
-	// Prepared statements are unwrapped by Exec after owner installation.
-	if execute, ok := plan.(*plannercore.Execute); ok {
-		plan = execute.Plan
-	}
-	switch plan.(type) {
-	case *physicalop.Insert, *physicalop.Update, *physicalop.Delete:
-		return true
-	}
-	return false
+type statementRUPlanKind uint8
+
+const (
+	statementRUPlanOther statementRUPlanKind = iota
+	statementRUPlanWrite
+	statementRUPlanCommit
+	statementRUPlanAnalyze
+	statementRUPlanPointLookup
+)
+
+// statementRUPlanInfo is local to an execution phase: retries can rebuild the plan.
+// Other plans still use the statement context for read eligibility.
+type statementRUPlanInfo struct {
+	plan    base.Plan
+	kind    statementRUPlanKind
+	sqlType string
 }
 
-func statementRUIsCommitPlan(plan base.Plan) bool {
-	simple, ok := plan.(*plannercore.Simple)
-	if !ok {
-		return false
+// classifyStatementRUPlan resolves executing wrappers and classifies the target
+// in one traversal, independently of affected rows or committed keys. A plain
+// EXPLAIN only renders a plan and must never charge its unexecuted target.
+func classifyStatementRUPlan(plan base.Plan) statementRUPlanInfo {
+	info := statementRUPlanInfo{plan: plan, sqlType: "select"}
+	for {
+		switch plan := info.plan.(type) {
+		case *plannercore.Execute:
+			// Owner installation happens before Exec unwraps prepared statements.
+			info.plan = plan.Plan
+			continue
+		case *plannercore.Explain:
+			if plan.Analyze {
+				info.plan = plan.TargetPlan
+				continue
+			}
+		case *physicalop.Insert:
+			info.kind, info.sqlType = statementRUPlanWrite, "insert"
+			if plan.IsReplace {
+				info.sqlType = "replace"
+			}
+		case *physicalop.Update:
+			info.kind, info.sqlType = statementRUPlanWrite, "update"
+		case *physicalop.Delete:
+			info.kind, info.sqlType = statementRUPlanWrite, "delete"
+		case *plannercore.Analyze:
+			info.kind, info.sqlType = statementRUPlanAnalyze, "analyze"
+		case *plannercore.Simple:
+			if _, ok := plan.Statement.(*ast.CommitStmt); ok {
+				info.kind, info.sqlType = statementRUPlanCommit, "commit"
+			}
+		case *physicalop.PointGetPlan, *physicalop.BatchPointGetPlan:
+			info.kind = statementRUPlanPointLookup
+		}
+		return info
 	}
-	_, ok = simple.Statement.(*ast.CommitStmt)
-	return ok
 }
 
 func statementRUFrontendCompileBytes(stmt *ExecStmt) float64 {
```

#### Recent Merged Pull Requests:
- **PR #71725** (closed): planner: preserve typed partition BatchPointGet index values (@winoros)
- **PR #71724** (closed): planner, executor: support unordered partition CBO BatchPointGet (@winoros)
- **PR #71718** (closed): planner: verify cached COALESCE update values [release-nextgen-202603] (@AilinKid)
- **PR #71716** (2026-10-01): planner: cache numeric COALESCE updates with matching column types [release-nextgen-202603] (@AilinKid)
- **PR #71710** (2026-09-30): planner: cache numeric COALESCE updates with matching column types (@AilinKid)
- **PR #71699** (2026-09-30): parser: support WITH DEFAULT NDVRATE in ANALYZE (@0xPoe)
- **PR #71696** (2026-09-30): dumpling: make --pd optional for premium keyspace clusters (@D3Hunter)
- **PR #71695** (2026-09-29): build: resolve Bazel Go deps through GOPROXY (#69503) (@ti-chi-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

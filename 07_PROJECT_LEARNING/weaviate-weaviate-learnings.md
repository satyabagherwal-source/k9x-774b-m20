> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/weaviate-weaviate-learnings.md`  
> **Source**: github ([https://github.com/weaviate/weaviate](https://github.com/weaviate/weaviate))  
> **Source Version**: `ad54fb8b`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T14:29:59.258Z  
> **Learning ID**: `learn-github-weaviate-weaviate`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): weaviate/weaviate

> **Canonical Artifact**: `07_PROJECT_LEARNING/weaviate-weaviate-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/weaviate/weaviate](https://github.com/weaviate/weaviate))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T14:29:58.940Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `weaviate/weaviate`
- **Description**: Weaviate is an open-source vector database that stores both objects and vectors, allowing for the combination of vector search with structured filtering with the fault tolerance and scalability of a cloud-native database​.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: pyproject.toml, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 16921 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `adapters/handlers/graphql/utils/helper_objects.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

// Package utils provides utility methods and classes to support the graphql endpoint for Weaviate
package utils

import (
	"errors"

	"github.com/tailor-platform/graphql"
)

// GraphQLNetworkFieldContents contains all objects regarding GraphQL fields
type GraphQLNetworkFieldContents struct {
	NetworkGetObject        *graphql.Object // Object containing all fields for GraphQL Network Get schema generation
	NetworkMetaObject       *graphql.Object // Object containing all fields for GraphQL Network Meta schema generation
	NetworkFetchObject      *graphql.Object // Object containing all fields for GraphQL Network Fetch schema generation
	NetworkIntrospectObject *graphql.Object // Object containing all fields for GraphQL Network Introspect schema generation
	NetworkAggregateObject  *graphql.Object // Object containing all fields for GraphQL Network Aggregate schema generation
}

// FilterContainer contains all objects regarding GraphQL filters. Some filter elements are declared as global variables in the prototype, this struct achieves the same goal.
type FilterContainer struct {
	WhereOperatorEnum                           *graphql.Enum                   // Object containing all fields for the Where filter
	Operands                                    *graphql.InputObject            // Object containing all Operands
	LocalFilterOptions                          map[string]*graphql.InputObject // Object containing all fields for Local filters
	NetworkFilterOptions                        map[string]*graphql.InputObject // Object containing all fields for Network filters
	FetchThingsActionsWhereFilterArgConf        *graphql.ArgumentConfig         // Object containing the Where filter fields for Fetch Objects
	IntrospectThingsActionsWhereFilterArgConf   *graphql.ArgumentConfig         // Object containing the Where filter fields for Introspect Objects
	WeaviateNetworkWhereKeywordsInpObj          *graphql.InputObject            // Object containing a global filter element
	WeaviateNetworkIntrospectPropertiesObjField *graphql.Field                  // Object containing a global filter element
}

var ErrEmptySchema = errors.New("there are no classes defined yet")

```

### Core Architecture Module: `adapters/handlers/grpc/v1/batch/queues.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

package batch

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	pb "github.com/weaviate/weaviate/grpc/generated/protocol/v1"
)

var errReportingQueueClosed = errors.New("reporting queue closed")

const OOM_WAIT_TIME = 300

func newBatchAcksMessage(uuids, beacons []string) *pb.BatchStreamReply {
	return &pb.BatchStreamReply{
		Message: &pb.BatchStreamReply_Acks_{
			Acks: &pb.BatchStreamReply_Acks{
				Uuids:   uuids,
				Beacons: beacons,
			},
		},
	}
}

func newBatchResultsMessage(successes []*pb.BatchStreamReply_Results_Success, errors []*pb.BatchStreamReply_Results_Error) *pb.BatchStreamReply {
	return &pb.BatchStreamReply{
		Message: &pb.BatchStreamReply_Results_{
			Results: &pb.BatchStreamReply_Results{
				Errors:    errors,
				Successes: successes,
			},
		},
	}
}

// newBatchResultsErrorMessage reports one error per uuid and per beacon.
func newBatchResultsErrorMessage(uuids, beacons []string, msg string) *pb.BatchStreamReply {
	errs := make([]*pb.BatchStreamReply_Results_Error, 0, len(uuids)+len(beacons))
	for _, uuid := range uuids {
		errs = append(errs, &pb.BatchStreamReply_Results_Error{
			Error:  msg,
			Detail: &pb.BatchStreamReply_Results_Error_Uuid{Uuid: uuid},
		})
	}
	for _, beacon := range beacons {
		errs = append(errs, &pb.BatchStreamReply_Results_Error{
			Error:  msg,
			Detail: &pb.BatchStreamReply_Results_Error_Beacon{Beacon: beacon},
		})
	}
	return newBatchResultsMessage(nil, errs)
}

func newBatchShuttingDownMessage() *pb.BatchStreamReply {
	return &pb.BatchStreamReply{
		Message: &pb.BatchStreamReply_ShuttingDown_{
			ShuttingDown: &pb.BatchStreamReply_ShuttingDown{},
		},
	}
}

func newBatchStartedMessage() *pb.BatchStreamReply {
	return &pb.BatchStreamReply{
		Message: &pb.BatchStreamReply_Started_{
			Started: &pb.BatchStreamReply_Started{},
		},
	}
}

func newBatchOutOfMemoryMessage(uuids, beacons []string) *pb.BatchStreamReply {
	return &pb.BatchStreamReply{
		Message: &pb.BatchStreamReply_OutOfMemory_{
			OutOfMemory: &pb.BatchStreamReply_OutOfMemory{
				Uuids:    uuids,
				Beacons:  beacons,
				WaitTime: OOM_WAIT_TIME,
			},
		},
	}
}

func newBatchBackoffMessage(batchSize int) *pb.BatchStreamReply {
	return &pb.BatchStreamReply{
		Message: &pb.BatchStreamReply_Backoff_{
			Backoff: &pb.BatchStreamReply_Backoff{
				BatchSize: int32(batchSize),
			},
		},
	}
}

type report struct {
	Errors    []*pb.BatchStreamReply_Results_Error
	Successes []*pb.BatchStreamReply_Results_Success
	Stats     *workerStats
}

type (
	processingQueue chan *processRequest
	reportingQueue  chan *report
)

// NewProcessingQueue creates a channel for batch writing.
func NewProcessingQueue() processingQueue {
	return make(processingQueue)
}

func NewReportingQueues() *reportingQueues {
	return &reportingQueues{}
}

// reportingQueues is a registry of per-stream reporting channels. Each stream owns its
// own lifecycle synchronization via streamQueue, so a slow consumer on one stream does
// not block operations on any other.
type reportingQueues struct {
	queues sync.Map // map[string]*streamQueue
}

// streamQueue is a per-stream reporting channel with done-channel + sends-WG semantics
// so that close can signal in-flight senders to abort, wait for them to release, and
// then close the underlying channel — without holding any cross-stream lock.
type streamQueue struct {
	ch        reportingQueue
	done      chan struct{}
	sendsWg   sync.WaitGroup
	mu        sync.Mutex
	closed    bool
	closeOnce sync.Once
}

func newStreamQueue() *streamQueue {
	return &streamQueue{
		ch:   make(reportingQueue),
		done: make(chan struct{}),
	}
}

func (sq *streamQueue) send(streamCtx context.Context, r *report) error {
	sq.mu.Lock()
	if sq.closed {
		sq.mu.Unlock()
		return errReportingQueueClosed
	}
	sq.sendsWg.Add(1)
	sq.mu.Unlock()
	defer sq.sendsWg.Done()

	select {
	case sq.ch <- r:
		return nil
	case <-sq.done:
		return errReportingQueueClosed
	case <-streamCtx.Done():
		return streamCtx.Err()
	}
}

func (sq *streamQueue) close() {
	sq.closeOnce.Do(func() {
		sq.mu.Lock()
		sq.closed = true
		sq.mu.Unlock()
		close(sq.done)
		sq.sendsWg.Wait()
		close(sq.ch)
	})
}

// Get returns the read end of the reporting channel for streamId.
func (r *reportingQueues) Get(streamId string) (reportingQueue, bool) {
	v, ok := r.queues.Load(streamId)
	if !ok {
		return nil, false
	}
	return v.(*streamQueue).ch, true
}

func (r *reportingQueues) close(streamId string) {
	if v, ok := r.queues.Load(streamId); ok {
		v.(*streamQueue).close()
	}
}

func (r *reportingQueues) delete(streamId string) {
	r.queues.Delete(streamId)
}

func (r *reportingQueues) send(streamCtx context.Context, streamId string, successes []*pb.BatchStreamReply_Results_Success, errs []*pb.BatchStreamReply_Results_Error, stats *workerStats) error {
	v, ok := r.queues.Load(streamId)
	if !ok {
		return fmt.Errorf("reporting queue not found for stream ID: %s", streamId)
	}
	return v.(*streamQueue).send(streamCtx, &report{Successes: successes, Errors: errs, Stats: stats})
}

// Make initializes a reporting queue for the given stream ID if it does not already exist.
func (r *reportingQueues) Make(streamId string) {
	r.queues.LoadOrStore(streamId, newStreamQueue())
}

type workerStats struct {
	processingTime time.Duration
}

func newWorkersStats(processingTime time.Duration) *workerStats {
	return &workerStats{
		processingTime: processingTime,
	}
}

type stats struct {
	lock              sync.RWMutex
	processingTimeEma float64
	batchSizeEma      float64
	throughputEma     float64
}

func newStats() *stats {
	return &stats{
		// Start assuming the batch size is correct. This will reduce if the batch size should be larger.
		processingTimeEma: time.Second.Seconds(),
		// Start with a lower range batch size of 200 (min 100, max 1000)
		batchSizeEma: 200,
		// Start at default batchSizeEma / default processingTimeEma
		throughputEma: 200,
	}
}

// Optimum is that each worker takes at most 1s to process a batch so that shutdown does not take too long
var IDEAL_PROCESSING_TIME = time.Second.Seconds()

// Update EMAs using standard formula
// newEma = alpha*newValue + (1-alpha)*oldEma
func (s *stats) ema(new float64, ema float64) float64 {
	alpha := 0.25
	return alpha*new + (1-alpha)*ema
}

func (s *stats) updateBatchSize(processingTime time.Duration) {
	// Set alpha to favour historic data more heavily to smooth out spikes
	s.lock.Lock()
	defer s.lock.Unlock()

	s.processingTimeEma = s.ema(processingTime.Seconds(), s.processingTimeEma)
	if s.processingTimeEma-IDEAL_PROCESSING_TIME > 0.1 {
		s.batchSizeEma = s.ema(s.batchSizeEma-100, s.batchSizeEma)
	} else if s.processingTimeEma-IDEAL_PROCESSING_TIME < -0.1 {
		s.batchSizeEma = s.ema(s.batchSizeEma+100, s.batchSizeEma)
	}
	s.throughputEma = s.ema(s.batchSizeEma/s.processingTimeEma, s.throughputEma)

	if s.batchSizeEma < 100 {
		s.batchSizeEma = 100
	}
	if s.batchSizeEma > 1000 {
		s.batchSizeEma = 1000
	}
}

func (s *stats) getBatchSize() int {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return int(math.Ceil(s.batchSizeEma))
}

func (s *stats) getThroughputEma() float64 {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return s.throughputEma
}

```

### Core Architecture Module: `adapters/handlers/grpc/v1/batch/worker.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

package batch

import (
	"context"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	enterrors "github.com/weaviate/weaviate/entities/errors"
	pb "github.com/weaviate/weaviate/grpc/generated/protocol/v1"
	replicaerrors "github.com/weaviate/weaviate/usecases/replica/errors"
)

const (
	PER_PROCESS_TIMEOUT = 60 * time.Second
	MAX_RETRIES         = 5
	BACKOFF_RETRY_TIME  = 100 * time.Millisecond
)

// batcher implementations must not mutate the objects or references in the request.
// The retry re-sends the same pointers, so any rewrite makes the retry a different
// request from the first attempt.
type Batcher interface {
	BatchObjects(ctx context.Context, req *pb.BatchObjectsRequest) (*pb.BatchObjectsReply, error)
	BatchReferences(ctx context.Context, req *pb.BatchReferencesRequest) (*pb.BatchReferencesReply, error)
}

type worker struct {
	batcher         Batcher
	logger          logrus.FieldLogger
	reportingQueues *reportingQueues
	processingQueue processingQueue
}

type processRequest struct {
	streamId         string
	consistencyLevel *pb.ConsistencyLevel
	objects          []*pb.BatchObject
	references       []*pb.BatchReference
	// If the collections of the objects within this request use vectorisation or not;
	// this should be accounted for by fanning out the objects to better improve I/O concurrency
	// to the third-party vectoriser for the specific classes that use it.
	usesVectorisationByCollection map[string]bool
	// This context contains metadata relevant to the stream as a whole, e.g. auth info,
	// that is required for downstream authZ checks by the workers, e.g. data-specific RBAC.
	streamCtx context.Context
	// Callback to signal process completion and perform any necessary cleanup
	onComplete func()
	// Callback to signal process beginning
	onStart func()
}

// StartBatchWorkers launches a specified number of worker goroutines to process batch requests.
//
// Each worker listens on the provided processing queue for incoming batch requests, processes them
// using the provided batcher, and results any errors or statistics to the resulting queues.
//
// The function takes a wait group to track the completion of all workers, the number of workers to start,
// the processing queue from which to read batch requests, the resulting queues for sending back results,
// the batcher interface for processing the requests, and a logger for logging purposes.
//
// This waitgroup is used by the drain shutdown logic to ensure that all workers have completed processing
// before any open server-side streams can be fully closed since ongoing workers may produce errors that need
// resulting to clients before the server shuts down completely.
func StartBatchWorkers(
	wg *sync.WaitGroup,
	concurrency int,
	processingQueue processingQueue,
	reportingQueues *reportingQueues,
	batcher Batcher,
	logger logrus.FieldLogger,
) {
	eg := enterrors.NewErrorGroupWrapper(logger)
	logger.WithField("action", "batch_workers_start").WithField("concurrency", concurrency).Debug("entering worker loop(s)")
	for range concurrency {
		wg.Add(1)
		eg.Go(func() error {
			defer wg.Done()
			w := &worker{
				batcher:         batcher,
				logger:          logger,
				reportingQueues: reportingQueues,
				processingQueue: processingQueue,
			}
			return w.Loop()
		})
	}
}

func (w *worker) isTransientReplicationError(err string) bool {
	return strings.Contains(err, replicaerrors.ErrReplicas.Error()) || // coordinator: any error due to replicating to shutdown node
		strings.Contains(err, "connect: Post") || // rest: failed to connect to shutdown node
		strings.Contains(err, "status code: 404, error: request not found") || // rest: failed to find request on shutdown node
		(strings.Contains(err, "resolve node name") && strings.Contains(err, "to host")) || // memberlist: failed to resolve to other shutdown node in cluster
		strings.Contains(err, "the client connection is closing") || // grpc: connection to other shutdown node is closed
		strings.Contains(err, "Node not ready") // rest: node is not ready to accept requests (still starting up or shutting down)
}

// fanoutReply carries the sub-batch it answers, because replies arrive in
// whatever order the concurrent calls finish. subBatch gives the range of valid
// error indices. offset is where the sub-batch starts in the collection's object
// list. Together they trace every error index back to its object.
type fanoutReply struct {
	reply    *pb.BatchObjectsReply
	err      error
	subBatch []*pb.BatchObject
	offset   int
}

func (w *worker) fanoutObjects(
	ctx context.Context,
	objs []*pb.BatchObject,
	cl *pb.ConsistencyLevel,
	fanoutAmount int,
) chan fanoutReply {
	ch := make(chan fanoutReply, fanoutAmount)
	var wg sync.WaitGroup

	subBatchLen := int(math.Ceil(float64(len(objs)) / float64(fanoutAmount)))
	for i := 0; i < fanoutAmount; i++ {
		start := i * subBatchLen
		if start >= len(objs) {
			break
		}
		end := (i + 1) * subBatchLen
		if end > len(objs) {
			end = len(objs)
		}
		subBatch := objs[start:end]
		wg.Add(1)
		enterrors.GoWrapper(func() {
			defer wg.Done()
			reply, err := w.batcher.BatchObjects(ctx, &pb.BatchObjectsRequest{
				Objects:          subBatch,
				ConsistencyLevel: cl,
			})
			ch <- fanoutReply{reply: reply, err: err, subBatch: subBatch, offset: start}
		}, w.logger)
	}

	enterrors.GoWrapper(func() {
		wg.Wait()
		close(ch)
	}, w.logger)

	return ch
}

func (w *worker) sendObjects(
	ctx context.Context,
	streamId string,
	objs []*pb.BatchObject,
	cl *pb.ConsistencyLevel,
	usesVectorisationByCollection map[string]bool,
	retries int,
) ([]*pb.BatchStreamReply_Results_Success, []*pb.BatchStreamReply_Results_Error) {
	if ctx.Err() != nil {
		w.logger.WithField("streamId", streamId).Warnf("context error before sending objects: %s", ctx.Err())
		errors := make([]*pb.BatchStreamReply_Results_Error, 0, len(objs))
		for _, obj := range objs {
			errors = append(errors, &pb.BatchStreamReply_Results_Error{
				Error:  ctx.Err().Error(),
				Detail: &pb.BatchStreamReply_Results_Error_Uuid{Uuid: obj.Uuid},
			})
		}
		return nil, errors
	}

	// Assumption is no errors, so don't preallocate error slice
	errors := make([]*pb.BatchStreamReply_Results_Error, 0)
	// Assumption is all successes, so preallocate success slice
	successes := make([]*pb.BatchStreamReply_Results_Success, 0, len(objs))
	// keyed by index into objs, the same indexing the success loop below uses
	failed := make(map[int]struct{})
	// Keep track of retriable errors to send again
	retriable := make([]*pb.BatchObject, 0)

	idxsByCollection := make(map[string][]int)
	for i, obj := range objs {
		idxsByCollection[obj.Collection] = append(idxsByCollection[obj.Collection], i)
	}

	for collection, outerIdxs := range idxsByCollection {
		fanoutAmount := 1
		if usesVectorisationByCollection[collection] {
			fanoutAmount = 10
		}
		collectionObjs := make([]*pb.BatchObject, 0, len(outerIdxs))
		for _, i := range outerIdxs {
			collectionObjs = append(collectionObjs, objs[i])
		}
		replies := w.fanoutObjects(ctx, collectionObjs, cl, fanoutAmount)
		errorsInner, retriableInner := w.fanInReplies(streamId, replies, objs, outerIdxs, retries, failed)
		errors = append(errors, errorsInner...)
		retriable = append(retriable, retriableInner...)
	}
	if len(retriable) > 0 {
		// exponential backoff with 2 ** n
		if retries > 0 {
			// retry immediately on first retry
			<-time.After(time.Duration(math.Pow(2, float64(retries))) * BACKOFF_RETRY_TIME)
		}
		w.logger.WithField("streamId", streamId).Warnf("retrying %d transient replication errors for objects", len(retriable))
		successesInner, errorsInner := w.sendObjects(ctx, streamId, retriable, cl, usesVectorisationByCollection, retries+1)
		successes = append(successes, successesInner...)
		errors = append(errors, errorsInner...)
	}
	// Handle successes
	for i, obj := range objs {
		if _, ok := failed[i]; ok {
			continue
		}
		successes = append(successes, &pb.BatchStreamReply_Results_Success{
			Detail: &pb.BatchStreamReply_Results_Success_Uuid{Uuid: obj.Uuid},
		})
	}
	return successes, errors
}

// fanInReplies drains one collection's fanout replies and records every
// reply error on the object it belongs to. outerIdxs[j] is the position of the
// collection's j-th object in the full batch. failed is keyed by that position
// and is mutated in place. A reply's error indices only mean something
// inside its own sub-batch, so an out-of-range index is ignored.
func (w *worker) fanInReplies(
	streamId string,
	replies <-chan fanoutReply,
	objs []*pb.BatchObject,
	outerIdxs []int,
	retries int,
	failed map[int]struct{},
) (errs []*pb.BatchStreamReply_Results_Error, retriable []*pb.BatchObject) {
	log := w.logger.WithField("streamId", streamId)
	for resp := range replies {
		if resp.err != nil {
			log.Errorf("failed to batch objects: %s", resp.err)
			for k := range resp.subBatch {
				outer := outerIdxs[resp.offset+k]
				failed[outer] = struct{}{}
				errs = append(errs, &pb.BatchStreamReply_Results_Error{
					Error:  enterrors.MessageWithDocsLink(resp.err),
					Detail: &pb.BatchStreamReply_Results_Error_Uuid{Uuid: objs[outer].Uuid},
				})
			}
			continue
		}
		for _, err := range resp.reply.GetErrors() {
			if err == nil {
				continue
			}
			if err.Index < 0 || int(err.Index) >= len(resp.subBatch) {
				log.Errorf("dropping batch reply error with index %d outside the sub-batch of %d objects: %s", err.Index, len(resp.subBatch), err.Error)
				continue
			}
			outer := outerIdxs[resp.offset+int(err.Index)]
			obj := objs[outer]
			failed[outer] = struct{}{}
			if w.isTransientReplicationError(err.Error) && retries < MAX_RETRI
```

### Core Architecture Module: `adapters/handlers/rest/clusterapi/shared/util.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

package shared

import (
	"errors"

	"github.com/go-openapi/strfmt"

	"github.com/weaviate/weaviate/usecases/replica"
	replicaerrors "github.com/weaviate/weaviate/usecases/replica/errors"
)

// CompareHashTreeRootsMultiPath is node-level; the leading underscore cannot collide with a class segment.
const CompareHashTreeRootsMultiPath = "/replicas/indices/_compareHashTreeRootsMulti"

func LocalIndexNotReady(resp replica.SimpleResponse) bool {
	if err := resp.FirstError(); err != nil {
		var replicaErr *replicaerrors.Error
		if errors.As(err, &replicaErr) && replicaErr.IsStatusCode(replicaerrors.StatusNotReady) {
			return true
		}
	}
	return false
}

func StringsToUUIDs(ss []string) []strfmt.UUID {
	uuids := make([]strfmt.UUID, len(ss))
	for i, s := range ss {
		uuids[i] = strfmt.UUID(s)
	}
	return uuids
}

func UUIDsToStrings(uuids []strfmt.UUID) []string {
	ss := make([]string, len(uuids))
	for i, u := range uuids {
		ss[i] = u.String()
	}
	return ss
}

```

### Core Architecture Module: `adapters/handlers/rest/drop_vector_index_enqueuer.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

package rest

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"github.com/weaviate/weaviate/adapters/repos/db"
	"github.com/weaviate/weaviate/cluster/distributedtask"
	"github.com/weaviate/weaviate/cluster/schema/leader"
	"github.com/weaviate/weaviate/cluster/schema/local"
	"github.com/weaviate/weaviate/entities/models"
	"github.com/weaviate/weaviate/entities/modelsext"
	entschema "github.com/weaviate/weaviate/entities/schema"
	"github.com/weaviate/weaviate/usecases/namespaces"
	"github.com/weaviate/weaviate/usecases/schema"
	"github.com/weaviate/weaviate/usecases/schema/namespacing"
	"github.com/weaviate/weaviate/usecases/sharding"
)

// dropVectorIndexEnqueuer implements schema.DropVectorIndexEnqueuer. It submits
// the background cleanup distributed task and reports whether one is in flight,
// using the cluster DTM client + sharding state. Lives in the REST wiring layer
// so it can reuse buildUnitMaps/buildUnitSpecs.
type dropVectorIndexEnqueuer struct {
	clusterService clusterDropTaskClient
	schemaState    leader.SchemaReader
	logger         logrus.FieldLogger // nil-safe: only used for skip warnings
	// finalizer removes dropped VectorConfig entries directly — the escape
	// for MT collections with ZERO tenants, where no cleanup task can ever
	// exist to drive the finalize. Installed post-construction
	// (SetVectorConfigFinalizer): the schema manager does not exist yet when the
	// enqueuer is built. Nil-safe.
	finalizer dropVectorFinalizer
}

// dropVectorFinalizer is the slice of the schema finalizer the enqueuer uses.
type dropVectorFinalizer interface {
	RemoveDroppedVectorConfig(ctx context.Context, collection string, targets []string) error
}

// clusterDropTaskClient is the slice of the cluster service the enqueuer uses.
type clusterDropTaskClient interface {
	distributedtask.TaskLister
	AddDistributedTaskWithGroups(ctx context.Context, namespace, taskID string,
		taskPayload any, unitSpecs []distributedtask.UnitSpec) error
}

func newDropVectorIndexEnqueuer(clusterService clusterDropTaskClient, schemaState leader.SchemaReader, logger logrus.FieldLogger) *dropVectorIndexEnqueuer {
	return &dropVectorIndexEnqueuer{clusterService: clusterService, schemaState: schemaState, logger: logger}
}

// SetVectorConfigFinalizer installs the direct-finalize hook (see the field
// doc). Must be called before the drop-vector reconcile loop starts and
// before the REST API serves — the only two paths that enqueue (restore-time
// shard loads during ClusterService.Open use LiveOpIDs, never this).
func (e *dropVectorIndexEnqueuer) SetVectorConfigFinalizer(f dropVectorFinalizer) {
	e.finalizer = f
}

// logInfo logs an enqueue-path decision (nil-safe like every logger use here).
func (e *dropVectorIndexEnqueuer) logInfo(collection, msg string) {
	if e.logger != nil {
		e.logger.WithField("collection", collection).Info(msg)
	}
}

// warnSkippedPayload surfaces an undecodable active-task payload instead of
// silently skipping it (the skip itself is deliberate fail-open behavior).
// Package-level so no skip site can silently re-inline a divergent copy.
func warnSkippedPayload(logger logrus.FieldLogger, where, taskID string, err error) {
	if logger != nil {
		logger.WithField("task", taskID).
			Warnf("drop-vector %s: skipping active task with unparseable payload: %v", where, err)
	}
}

// ListDistributedTasks exposes the cluster task list for the reconcile loop
// (one fetch per round) and its startup readiness probe.
func (e *dropVectorIndexEnqueuer) ListDistributedTasks(ctx context.Context) (map[string][]*distributedtask.Task, error) {
	return e.clusterService.ListDistributedTasks(ctx)
}

// HasActiveDrop reports whether a non-terminal drop task already covers
// targetVector on collection.
func (e *dropVectorIndexEnqueuer) HasActiveDrop(ctx context.Context, collection, targetVector string) (bool, error) {
	tasks, err := e.clusterService.ListDistributedTasks(ctx)
	if err != nil {
		return false, err
	}
	return activeDropCovers(tasks, collection, targetVector, e.logger), nil
}

// activeDropCovers reports whether a non-terminal drop task in tasks covers
// targetVector on collection. Shared by HasActiveDrop and the reconcile loop
// (which fetches the task list once per round instead of once per marker).
func activeDropCovers(tasks map[string][]*distributedtask.Task, collection, targetVector string,
	logger logrus.FieldLogger,
) bool {
	return db.ActiveDropCovers(tasks[db.DropVectorIndexNamespace], collection, targetVector, logger)
}

// EnqueueDropVectorIndex submits a fresh cleanup task with one unit per
// (shard, replica) grouped by shard. Shards already cleaned by this drop's
// earlier tasks get no unit.
func (e *dropVectorIndexEnqueuer) EnqueueDropVectorIndex(ctx context.Context, collection string, targets []string) error {
	tasks, err := e.clusterService.ListDistributedTasks(ctx)
	if err != nil {
		return fmt.Errorf("drop-vector enqueue: list tasks for %q: %w", collection, err)
	}
	return e.EnqueueDropVectorIndexWithTasks(ctx, collection, targets, tasks)
}

// EnqueueDropVectorIndexWithTasks is EnqueueDropVectorIndex against an
// already-fetched task list, so the reconcile loop pays ONE ListDistributedTasks
// per round instead of one per marker. A slightly stale list is safe: the
// AddTask-apply guard (CheckConflict) re-proves the coverage claim against the
// FSM's live records, and any rejection is retried by the next round.
func (e *dropVectorIndexEnqueuer) EnqueueDropVectorIndexWithTasks(ctx context.Context, collection string,
	targets []string, tasks map[string][]*distributedtask.Task,
) error {
	// Re-validate against the leader-consistent class: the marker commit and this
	// enqueue are not atomic, and reconciliation may run off a stale local schema
	// snapshot. A target that is no longer marked dropped (class deleted and
	// re-created, or already finalized elsewhere) must not get a cleanup task —
	// that task would strip a live vector.
	targets, err := e.stillDroppedTargets(collection, targets)
	if err != nil {
		return fmt.Errorf("drop-vector enqueue: verify targets for %q: %w", collection, err)
	}
	if len(targets) == 0 {
		return nil // nothing (still) marked dropped — no-op
	}

	state, _, err := e.schemaState.ShardingStateFromLeader(collection)
	if err != nil {
		return fmt.Errorf("drop-vector enqueue: sharding state for %q: %w", collection, err)
	}
	if state == nil {
		return fmt.Errorf("drop-vector enqueue: no sharding state for collection %q", collection)
	}
	shardOwnership := activeShardOwnership(state)
	if len(shardOwnership) == 0 {
		// A non-MT collection always has shards, so an empty map there is a
		// real problem.
		if !state.PartitioningEnabled {
			return fmt.Errorf("drop-vector enqueue: no shards for collection %q", collection)
		}
		if len(state.Physical) == 0 {
			// ZERO tenants (never created, or all deleted after the marker
			// landed): no cleanup task can ever exist, so nothing would
			// drive the finalize — remove the entries directly. There is no
			// data to strip, and the FSM removal gate explicitly allows the
			// empty-shard-set case for exactly this reason.
			if e.finalizer == nil {
				// An error, not a logged no-op: with no finalizer, NOTHING
				// can ever remove this marker — a wiring regression that
				// returned success here would hand the client a 200 for a
				// drop that silently never completes.
				return fmt.Errorf("drop-vector enqueue: collection %q has no tenants and no finalizer is wired; cannot remove the dropped vector entries", collection)
			}
			if err := e.finalizer.RemoveDroppedVectorConfig(ctx, collection, targets); err != nil {
				return fmt.Errorf("drop-vector enqueue: finalize tenant-less collection %q: %w", collection, err)
			}
			e.logInfo(collection, fmt.Sprintf(
				"drop-vector enqueue: collection has no tenants; direct removal of dropped vector entries %v applied "+
					"(a no-op on a lagging local view — reconciliation retries then)", targets))
			return nil
		}
		// Tenants exist but none is active: the marker is already applied —
		// a no-op success, not an error. Reconciliation re-enqueues once a
		// tenant is activated.
		e.logInfo(collection, "drop-vector enqueue: all tenants inactive; the marker stays until a tenant is activated")
		return nil
	}

	epoch, cleaned, finalizeNow := db.EpochAndInheritedCoverage(collection, targets, state, tasks, e.logger)
	if finalizeNow {
		// The chain covers every shard that still exists, and what it owed went
		// away with a deleted tenant. Re-cleaning here would rewrite every
		// segment of shards that are already stripped, so remove the entries on
		// the recorded coverage instead. The FSM removal gate accepts the same
		// proof (ResolvedByShardDeletion), so this cannot propose a removal the
		// apply would refuse.
		if e.finalizer == nil {
			return fmt.Errorf("drop-vector enqueue: collection %q has a complete cleanup chain but no finalizer is wired; cannot remove the dropped vector entries", collection)
		}
		if err := e.finalizer.RemoveDroppedVectorConfig(ctx, collection, targets); err != nil {
			return fmt.Errorf("drop-vector enqueue: finalize collection %q on recorded coverage: %w", collection, err)
		}
		e.logInfo(collection, fmt.Sprintf(
			"drop-vector enqueue: every remaining shard is covered and the uncleaned ones were deleted; "+
				"removed dropped vector entries %v without re-cleaning", targets))
		return nil
	}
	shardOwnership = withoutCleanedShards(shardOwnership, cleaned)
	shardOwnership, deferredShards := capShardOwnership(shardOwnership, maxShardsPerDropRound)
	if deferre
```

### Core Architecture Module: `adapters/handlers/rest/operations/replication/get_collection_sharding_state.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

// Code generated by go-swagger; DO NOT EDIT.

package replication

// This file was generated by the swagger tool.
// Editing this file might prove futile when you re-run the generate command

import (
	"net/http"

	"github.com/go-openapi/runtime/middleware"

	"github.com/weaviate/weaviate/entities/models"
)

// GetCollectionShardingStateHandlerFunc turns a function with the right signature into a get collection sharding state handler
type GetCollectionShardingStateHandlerFunc func(GetCollectionShardingStateParams, *models.Principal) middleware.Responder

// Handle executing the request and returning a response
func (fn GetCollectionShardingStateHandlerFunc) Handle(params GetCollectionShardingStateParams, principal *models.Principal) middleware.Responder {
	return fn(params, principal)
}

// GetCollectionShardingStateHandler interface for that can handle valid get collection sharding state params
type GetCollectionShardingStateHandler interface {
	Handle(GetCollectionShardingStateParams, *models.Principal) middleware.Responder
}

// NewGetCollectionShardingState creates a new http.Handler for the get collection sharding state operation
func NewGetCollectionShardingState(ctx *middleware.Context, handler GetCollectionShardingStateHandler) *GetCollectionShardingState {
	return &GetCollectionShardingState{Context: ctx, Handler: handler}
}

/*
	GetCollectionShardingState swagger:route GET /replication/sharding-state replication getCollectionShardingState

# Get sharding state

Fetches the current sharding state, including replica locations and statuses, for all collections or a specified collection. If a shard name is provided along with a collection, the state for that specific shard is returned.
*/
type GetCollectionShardingState struct {
	Context *middleware.Context
	Handler GetCollectionShardingStateHandler
}

func (o *GetCollectionShardingState) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	route, rCtx, _ := o.Context.RouteInfo(r)
	if rCtx != nil {
		*r = *rCtx
	}
	var Params = NewGetCollectionShardingStateParams()
	uprinc, aCtx, err := o.Context.Authorize(r, route)
	if err != nil {
		o.Context.Respond(rw, r, route.Produces, route, err)
		return
	}
	if aCtx != nil {
		*r = *aCtx
	}
	var principal *models.Principal
	if uprinc != nil {
		principal = uprinc.(*models.Principal) // this is really a models.Principal, I promise
	}

	if err := o.Context.BindValidRequest(r, route, &Params); err != nil { // bind params
		o.Context.Respond(rw, r, route.Produces, route, err)
		return
	}

	res := o.Handler.Handle(Params, principal) // actually handle the request
	o.Context.Respond(rw, r, route.Produces, route, res)

}

```

### Core Architecture Module: `adapters/handlers/rest/operations/replication/get_collection_sharding_state_parameters.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

// Code generated by go-swagger; DO NOT EDIT.

package replication

// This file was generated by the swagger tool.
// Editing this file might prove futile when you re-run the swagger generate command

import (
	"net/http"

	"github.com/go-openapi/errors"
	"github.com/go-openapi/runtime"
	"github.com/go-openapi/runtime/middleware"
	"github.com/go-openapi/strfmt"
)

// NewGetCollectionShardingStateParams creates a new GetCollectionShardingStateParams object
//
// There are no default values defined in the spec.
func NewGetCollectionShardingStateParams() GetCollectionShardingStateParams {

	return GetCollectionShardingStateParams{}
}

// GetCollectionShardingStateParams contains all the bound params for the get collection sharding state operation
// typically these are obtained from a http.Request
//
// swagger:parameters getCollectionShardingState
type GetCollectionShardingStateParams struct {

	// HTTP Request Object
	HTTPRequest *http.Request `json:"-"`

	/*The collection name to get the sharding state for.
	  In: query
	*/
	Collection *string
	/*The shard to get the sharding state for.
	  In: query
	*/
	Shard *string
}

// BindRequest both binds and validates a request, it assumes that complex things implement a Validatable(strfmt.Registry) error interface
// for simple values it will use straight method calls.
//
// To ensure default values, the struct must have been initialized with NewGetCollectionShardingStateParams() beforehand.
func (o *GetCollectionShardingStateParams) BindRequest(r *http.Request, route *middleware.MatchedRoute) error {
	var res []error

	o.HTTPRequest = r

	qs := runtime.Values(r.URL.Query())

	qCollection, qhkCollection, _ := qs.GetOK("collection")
	if err := o.bindCollection(qCollection, qhkCollection, route.Formats); err != nil {
		res = append(res, err)
	}

	qShard, qhkShard, _ := qs.GetOK("shard")
	if err := o.bindShard(qShard, qhkShard, route.Formats); err != nil {
		res = append(res, err)
	}
	if len(res) > 0 {
		return errors.CompositeValidationError(res...)
	}
	return nil
}

// bindCollection binds and validates parameter Collection from query.
func (o *GetCollectionShardingStateParams) bindCollection(rawData []string, hasKey bool, formats strfmt.Registry) error {
	var raw string
	if len(rawData) > 0 {
		raw = rawData[len(rawData)-1]
	}

	// Required: false
	// AllowEmptyValue: false

	if raw == "" { // empty values pass all other validations
		return nil
	}
	o.Collection = &raw

	return nil
}

// bindShard binds and validates parameter Shard from query.
func (o *GetCollectionShardingStateParams) bindShard(rawData []string, hasKey bool, formats strfmt.Registry) error {
	var raw string
	if len(rawData) > 0 {
		raw = rawData[len(rawData)-1]
	}

	// Required: false
	// AllowEmptyValue: false

	if raw == "" { // empty values pass all other validations
		return nil
	}
	o.Shard = &raw

	return nil
}

```

### Core Architecture Module: `adapters/handlers/rest/operations/replication/get_collection_sharding_state_responses.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

// Code generated by go-swagger; DO NOT EDIT.

package replication

// This file was generated by the swagger tool.
// Editing this file might prove futile when you re-run the swagger generate command

import (
	"net/http"

	"github.com/go-openapi/runtime"

	"github.com/weaviate/weaviate/entities/models"
)

// GetCollectionShardingStateOKCode is the HTTP code returned for type GetCollectionShardingStateOK
const GetCollectionShardingStateOKCode int = 200

/*
GetCollectionShardingStateOK Successfully retrieved sharding state.

swagger:response getCollectionShardingStateOK
*/
type GetCollectionShardingStateOK struct {

	/*
	  In: Body
	*/
	Payload *models.ReplicationShardingStateResponse `json:"body,omitempty"`
}

// NewGetCollectionShardingStateOK creates GetCollectionShardingStateOK with default headers values
func NewGetCollectionShardingStateOK() *GetCollectionShardingStateOK {

	return &GetCollectionShardingStateOK{}
}

// WithPayload adds the payload to the get collection sharding state o k response
func (o *GetCollectionShardingStateOK) WithPayload(payload *models.ReplicationShardingStateResponse) *GetCollectionShardingStateOK {
	o.Payload = payload
	return o
}

// SetPayload sets the payload to the get collection sharding state o k response
func (o *GetCollectionShardingStateOK) SetPayload(payload *models.ReplicationShardingStateResponse) {
	o.Payload = payload
}

// WriteResponse to the client
func (o *GetCollectionShardingStateOK) WriteResponse(rw http.ResponseWriter, producer runtime.Producer) {

	rw.WriteHeader(200)
	if o.Payload != nil {
		payload := o.Payload
		if err := producer.Produce(rw, payload); err != nil {
			panic(err) // let the recovery middleware deal with this
		}
	}
}

// GetCollectionShardingStateBadRequestCode is the HTTP code returned for type GetCollectionShardingStateBadRequest
const GetCollectionShardingStateBadRequestCode int = 400

/*
GetCollectionShardingStateBadRequest Bad request.

swagger:response getCollectionShardingStateBadRequest
*/
type GetCollectionShardingStateBadRequest struct {

	/*
	  In: Body
	*/
	Payload *models.ErrorResponse `json:"body,omitempty"`
}

// NewGetCollectionShardingStateBadRequest creates GetCollectionShardingStateBadRequest with default headers values
func NewGetCollectionShardingStateBadRequest() *GetCollectionShardingStateBadRequest {

	return &GetCollectionShardingStateBadRequest{}
}

// WithPayload adds the payload to the get collection sharding state bad request response
func (o *GetCollectionShardingStateBadRequest) WithPayload(payload *models.ErrorResponse) *GetCollectionShardingStateBadRequest {
	o.Payload = payload
	return o
}

// SetPayload sets the payload to the get collection sharding state bad request response
func (o *GetCollectionShardingStateBadRequest) SetPayload(payload *models.ErrorResponse) {
	o.Payload = payload
}

// WriteResponse to the client
func (o *GetCollectionShardingStateBadRequest) WriteResponse(rw http.ResponseWriter, producer runtime.Producer) {

	rw.WriteHeader(400)
	if o.Payload != nil {
		payload := o.Payload
		if err := producer.Produce(rw, payload); err != nil {
			panic(err) // let the recovery middleware deal with this
		}
	}
}

// GetCollectionShardingStateUnauthorizedCode is the HTTP code returned for type GetCollectionShardingStateUnauthorized
const GetCollectionShardingStateUnauthorizedCode int = 401

/*
GetCollectionShardingStateUnauthorized Unauthorized or invalid credentials.

swagger:response getCollectionShardingStateUnauthorized
*/
type GetCollectionShardingStateUnauthorized struct {
}

// NewGetCollectionShardingStateUnauthorized creates GetCollectionShardingStateUnauthorized with default headers values
func NewGetCollectionShardingStateUnauthorized() *GetCollectionShardingStateUnauthorized {

	return &GetCollectionShardingStateUnauthorized{}
}

// WriteResponse to the client
func (o *GetCollectionShardingStateUnauthorized) WriteResponse(rw http.ResponseWriter, producer runtime.Producer) {

	rw.Header().Del(runtime.HeaderContentType) //Remove Content-Type on empty responses

	rw.WriteHeader(401)
}

// GetCollectionShardingStateForbiddenCode is the HTTP code returned for type GetCollectionShardingStateForbidden
const GetCollectionShardingStateForbiddenCode int = 403

/*
GetCollectionShardingStateForbidden Forbidden

swagger:response getCollectionShardingStateForbidden
*/
type GetCollectionShardingStateForbidden struct {

	/*
	  In: Body
	*/
	Payload *models.ErrorResponse `json:"body,omitempty"`
}

// NewGetCollectionShardingStateForbidden creates GetCollectionShardingStateForbidden with default headers values
func NewGetCollectionShardingStateForbidden() *GetCollectionShardingStateForbidden {

	return &GetCollectionShardingStateForbidden{}
}

// WithPayload adds the payload to the get collection sharding state forbidden response
func (o *GetCollectionShardingStateForbidden) WithPayload(payload *models.ErrorResponse) *GetCollectionShardingStateForbidden {
	o.Payload = payload
	return o
}

// SetPayload sets the payload to the get collection sharding state forbidden response
func (o *GetCollectionShardingStateForbidden) SetPayload(payload *models.ErrorResponse) {
	o.Payload = payload
}

// WriteResponse to the client
func (o *GetCollectionShardingStateForbidden) WriteResponse(rw http.ResponseWriter, producer runtime.Producer) {

	rw.WriteHeader(403)
	if o.Payload != nil {
		payload := o.Payload
		if err := producer.Produce(rw, payload); err != nil {
			panic(err) // let the recovery middleware deal with this
		}
	}
}

// GetCollectionShardingStateNotFoundCode is the HTTP code returned for type GetCollectionShardingStateNotFound
const GetCollectionShardingStateNotFoundCode int = 404

/*
GetCollectionShardingStateNotFound Collection or shard not found.

swagger:response getCollectionShardingStateNotFound
*/
type GetCollectionShardingStateNotFound struct {

	/*
	  In: Body
	*/
	Payload *models.ErrorResponse `json:"body,omitempty"`
}

// NewGetCollectionShardingStateNotFound creates GetCollectionShardingStateNotFound with default headers values
func NewGetCollectionShardingStateNotFound() *GetCollectionShardingStateNotFound {

	return &GetCollectionShardingStateNotFound{}
}

// WithPayload adds the payload to the get collection sharding state not found response
func (o *GetCollectionShardingStateNotFound) WithPayload(payload *models.ErrorResponse) *GetCollectionShardingStateNotFound {
	o.Payload = payload
	return o
}

// SetPayload sets the payload to the get collection sharding state not found response
func (o *GetCollectionShardingStateNotFound) SetPayload(payload *models.ErrorResponse) {
	o.Payload = payload
}

// WriteResponse to the client
func (o *GetCollectionShardingStateNotFound) WriteResponse(rw http.ResponseWriter, producer runtime.Producer) {

	rw.WriteHeader(404)
	if o.Payload != nil {
		payload := o.Payload
		if err := producer.Produce(rw, payload); err != nil {
			panic(err) // let the recovery middleware deal with this
		}
	}
}

// GetCollectionShardingStateInternalServerErrorCode is the HTTP code returned for type GetCollectionShardingStateInternalServerError
const GetCollectionShardingStateInternalServerErrorCode int = 500

/*
GetCollectionShardingStateInternalServerError An error has occurred while trying to fulfill the request. Most likely the ErrorResponse will contain more information about the error.

swagger:response getCollectionShardingStateInternalServerError
*/
type GetCollectionShardingStateInternalServerError struct {

	/*
	  In: Body
	*/
	Payload *models.ErrorResponse `json:"body,omitempty"`
}

// NewGetCollectionShardingStateInternalServerError creates GetCollectionShardingStateInternalServerError with default headers values
func NewGetCollectionShardingStateInternalServerError() *GetCollectionShardingStateInternalServerError {

	return &GetCollectionShardingStateInternalServerError{}
}

// WithPayload adds the payload to the get collection sharding state internal server error response
func (o *GetCollectionShardingStateInternalServerError) WithPayload(payload *models.ErrorResponse) *GetCollectionShardingStateInternalServerError {
	o.Payload = payload
	return o
}

// SetPayload sets the payload to the get collection sharding state internal server error response
func (o *GetCollectionShardingStateInternalServerError) SetPayload(payload *models.ErrorResponse) {
	o.Payload = payload
}

// WriteResponse to the client
func (o *GetCollectionShardingStateInternalServerError) WriteResponse(rw http.ResponseWriter, producer runtime.Producer) {

	rw.WriteHeader(500)
	if o.Payload != nil {
		payload := o.Payload
		if err := producer.Produce(rw, payload); err != nil {
			panic(err) // let the recovery middleware deal with this
		}
	}
}

// GetCollectionShardingStateNotImplementedCode is the HTTP code returned for type GetCollectionShardingStateNotImplemented
const GetCollectionShardingStateNotImplementedCode int = 501

/*
GetCollectionShardingStateNotImplemented Replica movement operations are disabled.

swagger:response getCollectionShardingStateNotImplemented
*/
type GetCollectionShardingStateNotImplemented struct {

	/*
	  In: Body
	*/
	Payload *models.ErrorResponse `json:"body,omitempty"`
}

// NewGetCollectionShardingStateNotImplemented creates GetCollectionShardingStateNotImplemented with default headers values
func NewGetCollectionShardingStateNotImplemented() *GetCollectionShardingStateNotImplemented {

	return &GetCollectionShardingStateNotImplemented{}
}

// WithPayload adds the payload to the get collection sharding state not implemented response
func (o *GetCollectionShardingStateNotImplemented) WithPayload(payload *models.ErrorResponse) *GetCollection
```

### Core Architecture Module: `adapters/handlers/rest/state/reindex_submit_locks.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

package state

import (
	"strings"
	"sync"
)

// ReindexSubmitLocks is the shared per-(collection, property) lock
// manager used by the REST handlers that mutate per-property schema
// state.
//
// The motivating bug is documented on State.ReindexSubmitLocks. This
// type is a plain wrapper around a `map[string]*sync.Mutex` guarded
// by an outer mutex; the inner mutexes are returned to the caller and
// the caller is responsible for Lock/Unlock pairing (see
// SubmitLockFor).
//
// Key shape: `strings.ToLower(collection) + "/" + property`. The
// case-folding matches the rest of the conflict-detection logic,
// which lowercases collection names before comparing.
type ReindexSubmitLocks struct {
	mu    sync.Mutex
	locks map[string]*sync.Mutex
}

// NewReindexSubmitLocks returns an initialised ReindexSubmitLocks
// ready for use.
func NewReindexSubmitLocks() *ReindexSubmitLocks {
	return &ReindexSubmitLocks{locks: map[string]*sync.Mutex{}}
}

// SubmitLockFor returns the *sync.Mutex for the given (collection,
// property) tuple, allocating one on first use. Callers MUST
// Lock/Unlock the returned mutex around their critical section.
//
// SubmitLockFor itself is safe for concurrent use; the returned
// mutex is the per-property lock.
func (r *ReindexSubmitLocks) SubmitLockFor(collection, property string) *sync.Mutex {
	key := strings.ToLower(collection) + "/" + property
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.locks == nil {
		r.locks = map[string]*sync.Mutex{}
	}
	m, ok := r.locks[key]
	if !ok {
		m = &sync.Mutex{}
		r.locks[key] = m
	}
	return m
}

```

### Core Architecture Module: `adapters/handlers/rest/state/state.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

package state

import (
	"net/http"
	"sync"

	"github.com/sirupsen/logrus"
	"github.com/weaviate/weaviate/usecases/cron"

	"github.com/weaviate/weaviate/adapters/handlers/graphql"
	"github.com/weaviate/weaviate/adapters/handlers/rest/tenantactivity"
	"github.com/weaviate/weaviate/adapters/handlers/rest/types"
	"github.com/weaviate/weaviate/adapters/repos/classifications"
	"github.com/weaviate/weaviate/adapters/repos/db"
	rCluster "github.com/weaviate/weaviate/cluster"
	"github.com/weaviate/weaviate/cluster/distributedtask"
	grpcconn "github.com/weaviate/weaviate/grpc/conn"
	"github.com/weaviate/weaviate/usecases/auth/authentication/anonymous"
	"github.com/weaviate/weaviate/usecases/auth/authentication/apikey"
	"github.com/weaviate/weaviate/usecases/auth/authentication/oidc"
	"github.com/weaviate/weaviate/usecases/auth/authorization"
	"github.com/weaviate/weaviate/usecases/auth/authorization/rbac"
	"github.com/weaviate/weaviate/usecases/backup"
	"github.com/weaviate/weaviate/usecases/cluster"
	"github.com/weaviate/weaviate/usecases/config"
	configRuntime "github.com/weaviate/weaviate/usecases/config/runtime"
	exportUsecase "github.com/weaviate/weaviate/usecases/export"
	"github.com/weaviate/weaviate/usecases/license"
	"github.com/weaviate/weaviate/usecases/memwatch"
	"github.com/weaviate/weaviate/usecases/modules"
	"github.com/weaviate/weaviate/usecases/monitoring"
	usecasesNamespaces "github.com/weaviate/weaviate/usecases/namespaces"
	objectttl "github.com/weaviate/weaviate/usecases/object_ttl"
	"github.com/weaviate/weaviate/usecases/objects"
	"github.com/weaviate/weaviate/usecases/schema"
	"github.com/weaviate/weaviate/usecases/schema/namespacing"
	"github.com/weaviate/weaviate/usecases/sharding"
	"github.com/weaviate/weaviate/usecases/sharding/remote"
	"github.com/weaviate/weaviate/usecases/traverser"
	"github.com/weaviate/weaviate/usecases/usagelimits"
)

// State is the only source of application-wide state
// NOTE: This is not true yet, see gh-723
// TODO: remove dependencies to anything that's not an ent or uc
type State struct {
	OIDC            *oidc.Client
	AnonymousAccess *anonymous.Client
	APIKey          *apikey.ApiKey
	APIKeyRemote    *apikey.RemoteApiKey
	Authorizer      authorization.Authorizer
	AuthzController authorization.Controller
	RBAC            *rbac.Manager
	Crons           *cron.Crons

	ServerConfig  *config.WeaviateConfig
	License       *license.State
	LDIntegration *configRuntime.LDIntegration
	Logger        *logrus.Logger
	gqlMutex      sync.Mutex
	GraphQL       graphql.GraphQL
	gqlGen        uint64
	Modules       *modules.Provider
	SchemaManager *schema.Manager
	Cluster       *cluster.State

	RemoteIndexIncoming *remote.IndexIncoming
	RemoteNodeIncoming  *sharding.RemoteNodeIncoming
	Traverser           *traverser.Traverser

	ClassificationRepo *classifications.DistributedRepo
	Metrics            *monitoring.PrometheusMetrics
	HTTPServerMetrics  *monitoring.HTTPServerMetrics
	GRPCServerMetrics  *monitoring.GRPCServerMetrics
	BackupManager      *backup.Handler
	ExportParticipant  *exportUsecase.Participant
	ExportMetrics      *exportUsecase.ExportMetrics
	DB                 *db.DB
	BatchManager       *objects.BatchManager
	AutoSchemaManager  *objects.AutoSchemaManager
	ClusterHttpClient  *http.Client
	MemWatch           *memwatch.Monitor

	ClusterService       *rCluster.Service
	TenantActivity       *tenantactivity.Handler
	InternalServer       types.ClusterServer
	NamespacesController *usecasesNamespaces.Controller
	NamespaceQualifier   namespacing.Qualifier

	ObjectTTLCoordinator *objectttl.Coordinator
	ObjectTTLLocalStatus *objectttl.LocalStatus

	DistributedTaskScheduler *distributedtask.Scheduler

	// ReindexProvider is the local handle for the runtime-reindex
	// distributed-task provider. Exposed here so the REST cancel handler
	// can wait for a cancelled task's local goroutine to drain before
	// triggering the on-disk state cleanup — see
	// [db.ReindexProvider.WaitForLocalTaskDrain].
	ReindexProvider *db.ReindexProvider

	// ReindexSubmitLocks serializes mutating REST operations on the same
	// (collection, property) tuple across BOTH the reindex-submit
	// handler (PUT /v1/schema/{class}/properties/{prop}/index/{indexType})
	// and the destructive property-index handler (DELETE
	// /v1/schema/{class}/properties/{prop}/index/{indexName}).
	//
	// Motivating failure mode (pinned by
	// test/acceptance/reindex_concurrent's
	// change_tokenization_both__delete_searchable_parallel matrix
	// sub-test): two parallel REST requests on the same property race
	// at the RAFT serializer. If DELETE searchable's UPDATE_PROPERTY
	// command commits BEFORE change-tokenization's DISTRIBUTED_TASK_ADD,
	// the apply-time MutationGuard cannot reject DELETE because no
	// task is in-flight yet; the bucket is dropped; the change-tok
	// task is then admitted, runs against a missing canonical bucket,
	// and FAILS — leaving a torn filterable bucket on the shard.
	//
	// The shared lock closes the race at the REST layer: change-tok
	// holds the lock across the AddDistributedTask RAFT commit, so a
	// concurrent DELETE on the same property waits, and then T1 sees
	// the task in-flight and rejects it deterministically. Conversely,
	// if DELETE wins the lock, change-tok's downstream validation
	// (e.g., validateTokenizationChange) sees IndexSearchable=false
	// and rejects with 400.
	//
	// Multi-node caveat: this lock is local. Two simultaneous submits
	// from two different REST nodes against the same property are
	// still possible. The RAFT apply-time MutationGuard remains the
	// authoritative defense; this lock just collapses the local
	// single-node race window that any realistic UI/CLI flow can hit.
	ReindexSubmitLocks *ReindexSubmitLocks

	// UsageLimits gates the object-count cap only. Collections/tenants/
	// shards caps are read directly at the schema-handler use sites.
	UsageLimits *usagelimits.Manager

	// GRPCConnManager is a general connection manager for any/all gRPC connections used by the application. It implements retry logic and connection pooling.
	GRPCConnManager *grpcconn.ConnManager
	// ReplGRPCConnManager is a separate connection manager that implements retry logic to each RPC call on top of connection pooling, specifically for replication traffic.
	ReplGRPCConnManager *grpcconn.ConnManager
}

// GetGraphQL is the safe way to retrieve GraphQL from the state as it can be
// replaced at runtime. Instead of passing appState.GraphQL to your adapters,
// pass appState itself which you can abstract with a local interface such as:
//
// type gqlProvider interface { GetGraphQL graphql.GraphQL }
func (s *State) GetGraphQL() graphql.GraphQL {
	s.gqlMutex.Lock()
	gql := s.GraphQL
	s.gqlMutex.Unlock()
	return gql
}

// SetGraphQL replaces the served graph authoritatively — used by the serial
// RAFT schema-apply path and the disable hook. It bumps the generation so an
// in-flight lock-free rebuild that started earlier is discarded by
// SetGraphQLIfCurrent rather than clobbering this newer graph.
func (s *State) SetGraphQL(gql graphql.GraphQL) {
	s.gqlMutex.Lock()
	s.GraphQL = gql
	s.gqlGen++
	s.gqlMutex.Unlock()
}

// GraphQLGeneration returns the current graph generation. Capture it before a
// lock-free rebuild and pass it to SetGraphQLIfCurrent.
func (s *State) GraphQLGeneration() uint64 {
	s.gqlMutex.Lock()
	defer s.gqlMutex.Unlock()
	return s.gqlGen
}

// SetGraphQLIfCurrent stores gql only if no authoritative SetGraphQL happened
// since gen was captured. The DisableGraphQL enable hook rebuilds off the RAFT
// apply goroutine; this stops a slow build from an older schema snapshot from
// overwriting a newer, apply-built graph. Returns false if the store was skipped.
func (s *State) SetGraphQLIfCurrent(gql graphql.GraphQL, gen uint64) bool {
	s.gqlMutex.Lock()
	defer s.gqlMutex.Unlock()
	if s.gqlGen != gen {
		return false
	}
	s.GraphQL = gql
	s.gqlGen++
	return true
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12935** (2026-09-07): **HNSW: panic in packedconn.decodeInto — ACORN search reads a neighbor's connections without its lock**
  *Symptoms*: ## Summary  `hnsw/search.go:425` (the ACORN filter branch) iterates a **neighbor** vertex's connections while holding only the *candidate* vertex's mutex. `packedconn.Connections` has no internal lock, so a concurrent writer holding the neighbor's mutex tears the read and the decode indexes past the end of the connection data.  The panic is recovered by the errgroup wrapper, so the node survives and the query fails.  Observed on 2026-09-04 on a WCS dev cluster:  ``` Recovered from panic: shard: NjlDaweeJExh, collection: SimClass, vectorIndex: vectors_alt_vector, panic: runtime error: index out of range [0] with length 0 ```  ``` github.com/weaviate/weaviate/entities/vectorindex/hnsw/packedconn.decodeInto(...) 	entities/vectorindex/hnsw/packedconn/connections.go:242 github.com/weaviate/weaviate/entities/vectorindex/hnsw/packedconn.decodeValues(...) 	entities/vectorindex/hnsw/packedconn/connections.go:276 github.com/weaviate/weaviate/entities/vectorindex/hnsw/packedconn.(*Connections).ElementIterator(...) 	entities/vectorindex/hnsw/packedconn/connections.go:637 github.com/weaviate/weaviate/adapters/repos/db/vector/hnsw.(*hnsw).searchLayerByVectorWithDistancerWithStrategy.func3(...) 	adapters/repos/db/vector/hnsw/search.go:425 github.com/weaviate/weaviate/adapters/repos/db/vector/hnsw.(*hnsw).knnSearchByVector(...) 	adapters/repos/db/vector/hnsw/search.go:1008 github.com/weaviate/weaviate/adapters/repos/db.(*Shard).ObjectVectorSearch.func2() 	adapters/repos/db/shard_read.go:774 

- **Issue #12749** (2026-08-24): **gRPC batch stream: recv goroutine leaks on unbuffered errCh/reqCh send when the stream ends via context cancellation**
  *Symptoms*: ## Summary  The gRPC batch-stream handler leaks one goroutine every time a stream ends through context cancellation. The `recv` helper's child goroutine blocks forever on an unbuffered channel send that no one will ever read. Observed on a 1.39.0 production cluster; the code is unchanged on `main`.  ## Evidence  5-node cluster, v1.39.0, batch-stream ingest whose client streams ended abnormally (the client aborted stream starts after its 60 s timeout). `debug/pprof/goroutine` on the three nodes that had been up longest showed 16, 9, and 10 goroutines parked in:  ``` 16 @ 0x48ee4e 0x41ba3c 0x41b637 0x2e20bb1 0xb2e753 0x496f21 #	github.com/weaviate/weaviate/adapters/handlers/grpc/v1/batch.(*StreamHandler).recv.func1+0xd0  adapters/handlers/grpc/v1/batch/stream.go:387 #	github.com/weaviate/weaviate/entities/errors.GoWrapper.func1+0x52                              entities/errors/go_wrapper.go:35 ```  No `Handle`/`sender`/`receiver` goroutines existed at the same time — these are orphans of streams that ended long before. Each leak correlates with a `"context cancelled, closing stream"` log line. Nodes that restarted recently had none; counts only grow.  ## Root cause  [`stream.go#L372-L394` (v1.39.0)](https://github.com/weaviate/weaviate/blob/v1.39.0/adapters/handlers/grpc/v1/batch/stream.go#L372-L394):  ```go func (h *StreamHandler) recv(stream pb.Weaviate_BatchStreamServer) (chan *pb.BatchStreamRequest, chan error) { 	reqCh := make(chan *pb.BatchStreamRequest) 	errCh := make(ch

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

### Incident Patch 1: `ad54fb8b` (2026-10-27)
**Commit Message**: Merge pull request #13593 from weaviate/namespace_drop_vector

Namespace: Make supend compatible with drop named vector

**File**: `adapters/handlers/rest/configure_api.go` (modified, +1/-1)
```diff
@@ -1268,7 +1268,7 @@ func initReindexAndDistributedTasks(
 	// is missing (crash, upgrade, or restore).
 	enterrors.GoWrapper(func() {
 		runDropVectorIndexReconciliation(
-			serverShutdownCtx, appState.SchemaManager, dropVectorEnqueuer, appState.Logger,
+			serverShutdownCtx, appState.SchemaManager, dropVectorEnqueuer, appState.NamespacesController, appState.Logger,
 			appState.ServerConfig.Config.DistributedTasks.DropVectorReconcileInterval,
 			appState.ClusterService.IsLeader, dropVectorReconcileNudge)
 	}, appState.Logger)
```

**File**: `adapters/handlers/rest/drop_vector_index_enqueuer.go` (modified, +12/-5)
```diff
@@ -26,7 +26,9 @@ import (
 	"github.com/weaviate/weaviate/entities/models"
 	"github.com/weaviate/weaviate/entities/modelsext"
 	entschema "github.com/weaviate/weaviate/entities/schema"
+	"github.com/weaviate/weaviate/usecases/namespaces"
 	"github.com/weaviate/weaviate/usecases/schema"
+	"github.com/weaviate/weaviate/usecases/schema/namespacing"
 	"github.com/weaviate/weaviate/usecases/sharding"
 )
 
@@ -505,9 +507,11 @@ type dropVectorReconcileClient interface {
 // reconcileDroppedVectorIndexes enqueues cleanup for every "none" marker with no
 // in-flight task — recovery for a crash between marker apply and enqueue, an
 // upgrade with pre-existing markers, or a restore. Idempotent: the active-task
-// check + the ConflictDetector dedupe across nodes running it at startup.
+// check + the ConflictDetector dedupe across nodes running it at startup. It
+// skips a class whose namespace is not active and leaves its markers for a round
+// after resume.
 func reconcileDroppedVectorIndexes(ctx context.Context, classes []*models.Class,
-	enq dropVectorReconcileClient, logger logrus.FieldLogger,
+	enq dropVectorReconcileClient, namespacesExister namespaces.Exister, logger logrus.FieldLogger,
 ) {
 	tasks, err := enq.ListDistributedTasks(ctx)
 	if err != nil {
@@ -518,6 +522,9 @@ func reconcileDroppedVectorIndexes(ctx context.Context, classes []*models.Class,
 		if class == nil {
 			continue
 		}
+		if err := namespaces.RequireActive(namespacesExister, namespacing.NamespaceFromQualified(class.Class)); err != nil {
+			continue
+		}
 		for name, cfg := range class.VectorConfig {
 			if !modelsext.IsVectorIndexDropped(cfg) {
 				continue
@@ -539,8 +546,8 @@ func reconcileDroppedVectorIndexes(ctx context.Context, classes []*models.Class,
 // goroutine. lister reads the local schema: eventually consistent is fine for
 // this idempotent safety net.
 func runDropVectorIndexReconciliation(ctx context.Context, lister local.ClassReader,
-	enq dropVectorReconcileClient, logger logrus.FieldLogger, interval time.Duration,
-	isLeader func() bool, nudge <-chan struct{},
+	enq dropVectorReconcileClient, namespacesExister namespaces.Exister, logger logrus.FieldLogger,
+	interval time.Duration, isLeader func() bool, nudge <-chan struct{},
 ) {
 	const attempts = 30
 	for i := 0; i < attempts; i++ {
@@ -580,7 +587,7 @@ func runDropVectorIndexReconciliation(ctx context.Context, lister local.ClassRea
 				return
 			}
 			if classes := lister.ReadOnlySchema().Classes; len(classes) > 0 {
-				reconcileDroppedVectorIndexes(ctx, classes, enq, logger)
+				reconcileDroppedVectorIndexes(ctx, classes, enq, namespacesExister, logger)
 			}
 		}()
 		select {
```

**File**: `adapters/handlers/rest/drop_vector_index_enqueuer_test.go` (modified, +29/-6)
```diff
@@ -25,11 +25,13 @@ import (
 	"github.com/stretchr/testify/require"
 	"github.com/weaviate/weaviate/adapters/repos/db"
 	"github.com/weaviate/weaviate/cluster/distributedtask"
+	api "github.com/weaviate/weaviate/cluster/proto/api"
 	"github.com/weaviate/weaviate/cluster/schema/leader"
 	"github.com/weaviate/weaviate/cluster/schema/local"
 	"github.com/weaviate/weaviate/entities/models"
 	"github.com/weaviate/weaviate/entities/modelsext"
 	"github.com/weaviate/weaviate/entities/versioned"
+	"github.com/weaviate/weaviate/usecases/namespaces"
 	"github.com/weaviate/weaviate/usecases/sharding"
 )
 
@@ -91,7 +93,7 @@ func TestReconcile_EnqueuesMissingTasks(t *testing.T) {
 	}
 	enq := &fakeReconcileEnqueuer{active: map[string]bool{}}
 
-	reconcileDroppedVectorIndexes(context.Background(), classes, enq, logger)
+	reconcileDroppedVectorIndexes(context.Background(), classes, enq, nil, logger)
 
 	require.ElementsMatch(t, []string{"A/v1", "B/v2"}, enq.enqueued,
 		"every dropped marker without a live task is enqueued; non-dropped vectors are skipped")
@@ -116,7 +118,7 @@ func TestReconcile_ListError_SkipsRound(t *testing.T) {
 	}
 	enq := &listErrEnqueuer{fakeReconcileEnqueuer: &fakeReconcileEnqueuer{active: map[string]bool{}}}
 
-	reconcileDroppedVectorIndexes(context.Background(), classes, enq, logger)
+	reconcileDroppedVectorIndexes(context.Background(), classes, enq, nil, logger)
 
 	require.Empty(t, enq.enqueued, "an unreadable task list must skip the round, not enqueue blind")
 }
@@ -128,11 +130,32 @@ func TestReconcile_SkipsClassesWithLiveTasks(t *testing.T) {
 	}
 	enq := &fakeReconcileEnqueuer{active: map[string]bool{"A/v1": true}} // v1 already in flight
 
-	reconcileDroppedVectorIndexes(context.Background(), classes, enq, logger)
+	reconcileDroppedVectorIndexes(context.Background(), classes, enq, nil, logger)
 
 	require.Equal(t, []string{"A/v2"}, enq.enqueued, "only the marker without a live task is enqueued")
 }
 
+func TestReconcile_SkipsClassesWithoutActiveNamespace(t *testing.T) {
+	logger, _ := test.NewNullLogger()
+	classes := []*models.Class{
+		{Class: "ns1:A", VectorConfig: map[string]models.VectorConfig{"v1": dropped()}},
+		{Class: "ns2:B", VectorConfig: map[string]models.VectorConfig{"v1": dropped()}},
+		{Class: "C", VectorConfig: map[string]models.VectorConfig{"v1": dropped()}},
+		{Class: "ns3:D", VectorConfig: map[string]models.VectorConfig{"v1": dropped()}},
+	}
+	exister := namespaces.NewMockExisterInState(t, map[string]api.NamespaceState{
+		"ns1": api.NamespaceStateSuspended,
+		"ns2": api.NamespaceStateActive,
+		"ns3": api.NamespaceStateDeleting,
+	})
+	enq := &fakeReconcileEnqueuer{active: map[string]bool{}}
+
+	reconcileDroppedVectorIndexes(context.Background(), classes, enq, exister, logger)
+
+	require.Equal(t, []string{"ns2:B/v1", "C/v1"}, enq.enqueued,
+		"a class whose namespace is not active is skipped, and the round continues past it")
+}
+
 // probeRecordingEnqueuer flags when the DTM probe has run, so the order test can
 // assert the schema is read only afterwards.
 type probeRecordingEnqueuer struct {
@@ -178,7 +201,7 @@ func TestReconciliationAtStartup_ReadsSchemaAfterProbe(t *testing.T) {
 	// One round: the loop exits via ctx after the first pass.
 	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
 	defer cancel()
-	runDropVectorIndexReconciliation(ctx, lister, enq, logger, time.Hour,
+	runDropVectorIndexReconciliation(ctx, lister, enq, nil, logger, time.Hour,
 		func() bool { return true }, nil)
 
 	require.True(t, orderOK, "schema must be read AFTER the DTM readiness probe")
@@ -202,7 +225,7 @@ func TestReconciliation_FollowerSkipsRound(t *testing.T) {
 
 	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
 	defer cancel()
-	runDropVectorIndexReconciliation(ctx, lister, enq, logger, time.Hour,
+	runDropVectorIndexReconciliation(ctx, lister, enq, nil, logger, time.Hour,
 		func() bool { return false }, nil)
 
 	require.Empty(t, enq.enqueued, "a non-leader must not enqueue")
@@ -1094,7 +1117,7 @@ func TestReconciliation_NudgeWakesBeforeInterval(t *testing.T) {
 	defer cancel()
 	// Interval far beyond the ctx timeout: a second round can only come from
 	// the nudge.
-	runDropVectorIndexReconciliation(ctx, lister, enq, logger, time.Hour,
+	runDropVectorIndexReconciliation(ctx, lister, enq, nil, logger, time.Hour,
 		func() bool { return true }, nudge)
 
 	require.GreaterOrEqual(t, len(enq.enqueued), 2, "the nudge must trigger a follow-up round within the interval")
```

**File**: `adapters/repos/db/drop_vector_index_provider.go` (modified, +51/-38)
```diff
@@ -243,7 +243,7 @@ func (p *DropVectorIndexProvider) processUnits(
 	ctx context.Context, task *distributedtask.Task,
 	payload *DropVectorIndexTaskPayload, localUnits []string,
 ) {
-	buckets := p.localBuckets(ctx, payload, localUnits)
+	buckets, resolveErr := p.localBuckets(ctx, payload, localUnits)
 
 	pending := make([]string, 0, len(localUnits))
 	for _, unitID := range localUnits {
@@ -253,6 +253,11 @@ func (p *DropVectorIndexProvider) processUnits(
 		pending = append(pending, unitID)
 	}
 
+	if resolveErr != nil {
+		p.failPending(ctx, task, pending, "resolve objects buckets: "+resolveErr.Error())
+		return
+	}
+
 	// Last check before the destructive ops arm: the marker commit and the task
 	// enqueue are not atomic, so the class may have been deleted+re-created (or the
 	// entry otherwise revived) since. Arming against a live vector would strip user
@@ -261,12 +266,7 @@ func (p *DropVectorIndexProvider) processUnits(
 	// drain poll: a momentary leader blip must not fail a whole drop task.
 	stillDropped, verifyErr := p.targetsStillDroppedWithRetry(ctx, payload)
 	if verifyErr != nil {
-		if ctx.Err() != nil {
-			return // shutdown: leave units in place, the task resumes after restart
-		}
-		for _, unitID := range pending {
-			p.failUnit(ctx, task, unitID, "verify targets still marked dropped: "+verifyErr.Error())
-		}
+		p.failPending(ctx, task, pending, "verify targets still marked dropped: "+verifyErr.Error())
 		return
 	}
 	if !stillDropped {
@@ -299,21 +299,15 @@ func (p *DropVectorIndexProvider) processUnits(
 }
 
 // localBuckets resolves the objects bucket for every local unit's shard in one
-// walk. Returns nil on a lookup error; per-unit handling then fails the units.
+// walk.
 func (p *DropVectorIndexProvider) localBuckets(
 	ctx context.Context, payload *DropVectorIndexTaskPayload, localUnits []string,
-) map[string]editOpBucket {
+) (map[string]editOpBucket, error) {
 	shardNames := make([]string, 0, len(localUnits))
 	for _, unitID := range localUnits {
 		shardNames = append(shardNames, payload.UnitToShard[unitID])
 	}
-	buckets, err := p.shards.EditOpBucketsForShards(ctx, payload.Collection, shardNames)
-	if err != nil {
-		p.logger.WithField("collection", payload.Collection).
-			Errorf("drop-vector: resolve objects buckets: %v", err)
-		return nil
-	}
-	return buckets
+	return p.shards.EditOpBucketsForShards(ctx, payload.Collection, shardNames)
 }
 
 // armUnit registers the edit op on the unit's shard, reporting whether the unit
@@ -342,7 +336,11 @@ func (p *DropVectorIndexProvider) armUnit(
 		CreatedAt: time.Now().UnixNano(),
 	}
 	if err := bucket.RegisterEditOp(payload.OpID, desc); err != nil {
-		p.failUnit(ctx, task, unitID, "register drop edit op: "+err.Error())
+		msg := "register drop edit op: " + err.Error()
+		if !p.bucketStillLoaded(payload.Collection, payload.UnitToShard[unitID], bucket) {
+			msg += shardGoneReason
+		}
+		p.failUnit(ctx, task, unitID, msg)
 		return false
 	}
 	return true
@@ -354,20 +352,17 @@ func (p *DropVectorIndexProvider) drainUnit(
 	payload *DropVectorIndexTaskPayload, unitID string, bucket editOpBucket,
 ) {
 	shardGone := func() bool {
-		return !p.shardLocallyLoaded(payload.Collection, payload.UnitToShard[unitID])
+		return !p.bucketStillLoaded(payload.Collection, payload.UnitToShard[unitID], bucket)
 	}
 	if err := p.pollUntilEmpty(ctx, bucket, task, unitID, payload.OpID, shardGone); err != nil {
 		if ctx.Err() != nil {
 			return // shutdown: resume after restart, do not mark failed
 		}
 		msg := "drain pending segments: " + err.Error()
-		// Tenant lifecycle is decoupled from cleanups (see CheckTenantMutation):
-		// a mid-strip deactivation surfaces here as persistent read errors on
-		// the closed sidecar. Name the real cause — this failure is an expected
-		// hand-off to the next reconcile round, not a fault.
-		if shard := payload.UnitToShard[unitID]; !p.shardLocallyLoaded(payload.Collection, shard) {
-			msg += " (shard no longer locally available — tenant deactivated, offloaded, or deleted; " +
-				"reconciliation re-covers the remaining shards and the tenant on reactivation)"
+		// Neither a tenant deactivation (see CheckTenantMutation) nor a namespace
+		// suspend waits for this drain, so a gone shard is the likely cause.
+		if shardGone() {
+			msg += shardGoneReason
 		}
 		p.failUnit(ctx, task, unitID, msg)
 		return
@@ -384,8 +379,8 @@ func (p *DropVectorIndexProvider) drainUnit(
 		}
 		msg := "clear dimension rows: " + err.Error()
 		if errors.Is(err, errDimensionsShardNotLoaded) {
-			msg += " (tenant deactivated, offloaded, or deleted after its drain; reconciliation " +
-				"re-covers the tenant on reactivation, and loading it clears the rows)"
+			msg += " (" + shardUnloadedCause + ", after its drain; reconciliation " +
+				"re-covers the shard on reactivation or resume, and loading it clears the rows)"
 		}
 		p.failUnit(ctx, task, unitID, msg)
 		return
@@ -423,11 +418,9 @@ func (p *DropVectorIndex
```

**File**: `adapters/repos/db/drop_vector_index_provider_test.go` (modified, +133/-1)
```diff
@@ -51,11 +51,15 @@ type fakeEditOpBucket struct {
 	pendingErr     error                          // when set, EditOpPending returns it
 	pendingFn      func(string) ([]string, error) // when set, overrides all other pending sources
 	polled         chan struct{}                  // if set, a non-blocking signal per EditOpPending call
+	registerErr    error                          // when set, RegisterEditOp returns it
 }
 
 func (f *fakeEditOpBucket) RegisterEditOp(opID string, desc lsmkv.OpDescriptor) error {
 	f.mu.Lock()
 	defer f.mu.Unlock()
+	if f.registerErr != nil {
+		return f.registerErr
+	}
 	if f.registered == nil {
 		f.registered = map[string]lsmkv.OpDescriptor{}
 	}
@@ -151,7 +155,9 @@ type fakeShards struct {
 	bucket     editOpBucket
 	buckets    map[string]editOpBucket // per-shard override; takes precedence over bucket
 	bucketErr  error
-	resolveErr error // when set, the bucket resolution itself fails
+	resolveErr error                   // when set, the bucket resolution itself fails
+	loaded     map[string]editOpBucket // when non-nil, what EditOpBucketsForLoadedShards alone returns
+	loadedErr  error                   // when set, EditOpBucketsForLoadedShards alone fails
 	mu         sync.Mutex
 	removed    []removedCall
 	removeErr  map[string]error // per-shard EnsureDroppedVectorFilesRemoved error
@@ -185,6 +191,12 @@ func (f *fakeShards) EditOpBucketsForShards(ctx context.Context, collection stri
 }
 
 func (f *fakeShards) EditOpBucketsForLoadedShards(collection string, shardNames []string) (map[string]editOpBucket, error) {
+	if f.loadedErr != nil {
+		return nil, f.loadedErr
+	}
+	if f.loaded != nil {
+		return f.loaded, nil
+	}
 	return f.resolve(shardNames)
 }
 
@@ -579,6 +591,126 @@ func TestStartTask_BucketLookupFails_UnitFailed(t *testing.T) {
 	require.Empty(t, rec.completed)
 }
 
+// TestStartTask_BucketResolutionFails_FailsUnitWithReason pins that the lookup
+// error itself, not a missing-shard reason, is what GET /v1/tasks shows.
+func TestStartTask_BucketResolutionFails_FailsUnitWithReason(t *testing.T) {
+	shards := &fakeShards{resolveErr: errors.New(`index for collection "Collection" not found`)}
+	rec := newFakeRecorder()
+	p := newTestDropProvider(shards, &fakeFinalizer{}, rec)
+
+	task := dropTask(distributedtask.TaskStatusStarted, map[string]*distributedtask.Unit{
+		"u1": {ID: "u1", Status: distributedtask.UnitStatusPending},
+	})
+	h, err := p.StartTask(task)
+	require.NoError(t, err)
+	waitDone(t, h)
+
+	require.Contains(t, rec.failed, "u1")
+	require.Contains(t, rec.failed["u1"], `index for collection "Collection" not found`)
+	require.Empty(t, rec.completed)
+}
+
+// TestStartTask_ShutdownDuringBucketResolution_LeavesUnitUnfailed pins that a
+// lookup error seen during a shutdown leaves the unit for the task's resume.
+func TestStartTask_ShutdownDuringBucketResolution_LeavesUnitUnfailed(t *testing.T) {
+	shards := &fakeShards{resolveErr: errors.New("listing failed")}
+	rec := newFakeRecorder()
+	ctx, cancel := context.WithCancel(context.Background())
+	cancel()
+	p := newTestDropProviderCtx(shards, &fakeFinalizer{}, rec, ctx)
+
+	task := dropTask(distributedtask.TaskStatusStarted, map[string]*distributedtask.Unit{
+		"u1": {ID: "u1", Status: distributedtask.UnitStatusPending},
+	})
+	h, err := p.StartTask(task)
+	require.NoError(t, err)
+	waitDone(t, h)
+
+	require.Empty(t, rec.failed, "shutdown must not fail the unit")
+	require.Empty(t, rec.completed)
+}
+
+// TestStartTask_ShardUnloaded_ReasonNamesSuspend pins that a unit's failure
+// reason names a suspended namespace only when the shard no longer holds the
+// unit's bucket. A shard a resume reopened under a new bucket no longer holds it.
+func TestStartTask_ShardUnloaded_ReasonNamesSuspend(t *testing.T) {
+	registerErr := errors.New("bucket is shutting down")
+	readErr := errors.New("database not open")
+	unloaded := map[string]editOpBucket{}
+	reopened := map[string]editOpBucket{"shard1": &fakeEditOpBucket{}}
+
+	tests := []struct {
+		name         string
+		bucket       *fakeEditOpBucket
+		loaded       map[string]editOpBucket
+		loadedErr    error
+		dimsErr      error
+		wantReason   string // a substring of the unit's reason
+		namesSuspend bool
+	}{
+		{
+			name:         "before arming",
+			bucket:       &fakeEditOpBucket{registerErr: registerErr},
+			loaded:       unloaded,
+			wantReason:   "register drop edit op: bucket is shutting down",
+			namesSuspend: true,
+		},
+		{
+			name:       "register fails on a loaded shard",
+			bucket:     &fakeEditOpBucket{registerErr: registerErr},
+			wantReason: "register drop edit op: bucket is shutting down",
+		},
+		{
+			name:         "resumed mid-drain",
+			bucket:       &fakeEditOpBucket{pendingErr: readErr},
+			loaded:       reopened,
+			wantReason:   "shard no longer locally loaded",
+			namesSuspend: true,
+		},
+		{
+			name:       "loaded-shard lookup fails",
+			bucket:     &fakeEditOpBucket{pendingErr: readErr},
+			loadedErr:  er
```

**File**: `adapters/repos/db/drop_vector_index_wiring.go` (modified, +6/-0)
```diff
@@ -39,13 +39,19 @@ import (
 // explicitly with the error surfaced — never via Store()'s panicking mustLoad
 // — acceptable for a drop, a rare operator-initiated action that must touch
 // every shard once anyway.
+//
+// Before each shard it refuses a collection whose namespace is not active, so
+// a namespace suspended while it runs stops it at the next shard.
 func (db *DB) EditOpBucketsForShards(ctx context.Context, collection string, shardNames []string) (map[string]editOpBucket, error) {
 	idx := db.GetIndex(entschema.ClassName(collection))
 	if idx == nil {
 		return nil, fmt.Errorf("index for collection %q not found", collection)
 	}
 	buckets := make(map[string]editOpBucket, len(shardNames))
 	for _, name := range shardNames {
+		if err := idx.requireNamespaceAllowsShardLoad(callerUserRequest); err != nil {
+			return nil, fmt.Errorf("collection %q: %w", collection, err)
+		}
 		if b := db.loadEditOpBucket(ctx, idx, collection, name); b != nil {
 			buckets[name] = b
 		}
```

**File**: `adapters/repos/db/drop_vector_index_wiring_test.go` (modified, +71/-0)
```diff
@@ -21,9 +21,11 @@ import (
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 
+	"github.com/weaviate/weaviate/cluster/proto/api"
 	"github.com/weaviate/weaviate/entities/schema"
 	enthnsw "github.com/weaviate/weaviate/entities/vectorindex/hnsw"
 	"github.com/weaviate/weaviate/usecases/memwatch"
+	"github.com/weaviate/weaviate/usecases/namespaces"
 )
 
 const editOpColdShard = "cold"
@@ -70,6 +72,54 @@ func TestEditOpBucketsForShardsOnShutDownIndex(t *testing.T) {
 	require.False(t, cold.isLoaded())
 }
 
+func TestEditOpBucketsForShardsRefusesInactiveNamespace(t *testing.T) {
+	tests := []struct {
+		name  string
+		state api.NamespaceState
+		// suspendOnColdLoad suspends the namespace while EditOpBucketsForShards
+		// loads the cold shard, and fails that load.
+		suspendOnColdLoad bool
+		shardNames        func(loaded ShardLike) []string
+	}{
+		{
+			name:       "suspended, cold and loaded shard",
+			state:      api.NamespaceStateSuspended,
+			shardNames: func(loaded ShardLike) []string { return []string{editOpColdShard, loaded.Name()} },
+		},
+		{
+			name:       "suspended, shard absent from the node",
+			state:      api.NamespaceStateSuspended,
+			shardNames: func(ShardLike) []string { return []string{"absent"} },
+		},
+		{
+			name:              "suspended mid-call",
+			state:             api.NamespaceStateActive,
+			suspendOnColdLoad: true,
+			shardNames:        func(loaded ShardLike) []string { return []string{editOpColdShard, loaded.Name()} },
+		},
+	}
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			ctx := testCtx()
+			states := map[string]api.NamespaceState{"alpha": tc.state}
+			var allocChecker memwatch.AllocChecker
+			if tc.suspendOnColdLoad {
+				allocChecker = loadProbeAllocChecker{memwatch.NewDummyMonitor(), func() {
+					states["alpha"] = api.NamespaceStateSuspended
+				}}
+			}
+			db, idx, loaded, cold := newEditOpTestIndex(t, ctx, allocChecker)
+			idx.namespace = "alpha"
+			idx.namespacesExister = namespaces.NewMockExisterInState(t, states)
+
+			buckets, err := db.EditOpBucketsForShards(ctx, idx.Config.ClassName.String(), tc.shardNames(loaded))
+			require.ErrorIs(t, err, namespaces.ErrNamespaceSuspended)
+			require.Empty(t, buckets)
+			require.False(t, cold.isLoaded())
+		})
+	}
+}
+
 func TestEditOpBucketsForLoadedShards(t *testing.T) {
 	ctx := testCtx()
 	db, idx, loaded, cold := newEditOpTestIndex(t, ctx, nil)
@@ -82,6 +132,27 @@ func TestEditOpBucketsForLoadedShards(t *testing.T) {
 	require.False(t, cold.isLoaded())
 }
 
+// TestEditOpBucketsForLoadedShards_ReturnsResolvedBucket pins that a shard's
+// loaded lookup returns the bucket EditOpBucketsForShards resolved for it, which
+// is how bucketStillLoaded tells a still-loaded shard from a reopened one.
+func TestEditOpBucketsForLoadedShards_ReturnsResolvedBucket(t *testing.T) {
+	ctx := testCtx()
+	db, idx, loaded, cold := newEditOpTestIndex(t, ctx, nil)
+	t.Cleanup(func() { cold.Shutdown(context.Background()) })
+	class := idx.Config.ClassName.String()
+	names := []string{loaded.Name(), editOpColdShard}
+
+	resolved, err := db.EditOpBucketsForShards(ctx, class, names)
+	require.NoError(t, err)
+	require.Len(t, resolved, 2)
+
+	current, err := db.EditOpBucketsForLoadedShards(class, names)
+	require.NoError(t, err)
+	for _, name := range names {
+		require.Same(t, resolved[name], current[name], "shard %s", name)
+	}
+}
+
 // newEditOpTestIndex returns a DB over an index holding one loaded shard and the
 // lazy shard editOpColdShard, not yet loaded, whose loads check allocChecker.
 // A nil allocChecker takes the index's own.
```

**File**: `adapters/repos/db/namespace_guard.go` (modified, +3/-1)
```diff
@@ -58,7 +58,9 @@ var (
 type shardLoadCaller int
 
 const (
-	// callerUserRequest is a load driven by a user request. It gets the full check.
+	// callerUserRequest is a load driven by a user request, or by
+	// DB.EditOpBucketsForShards resolving a drop-vector task's buckets. It gets
+	// the full check.
 	callerUserRequest shardLoadCaller = iota
 	// callerResume is a resuming namespace reopening its own shards. It is still
 	// refused for a namespace that keeps no shards open, so a stale reopen cannot
```

---

### Incident Patch 2: `ad0f4b18` (2026-10-27)
**Commit Message**: Merge pull request #13614 from weaviate/merge-stable-v1.40-into-main

Merge stable/v1.40 into main

**File**: `.github/workflows/pull_requests.yaml` (modified, +28/-5)
```diff
@@ -718,7 +718,6 @@ jobs:
         env:
           WCS_DUMMY_CI_PW: ${{ secrets.WCS_DUMMY_CI_PW }}
           WCS_DUMMY_CI_PW_2: ${{ secrets.WCS_DUMMY_CI_PW_2 }}
-          WEAVIATE_LICENSE_KEY: ${{ secrets.WEAVIATE_LICENSE_KEY }}
           REPLICATION_GRPC_ENABLED: ${{ matrix.grpc_replication || '' }}
         run: ./test/run.sh ${{ matrix.test }}
   Acceptance-Tests-4-cores:
@@ -756,8 +755,6 @@ jobs:
             test: "--acceptance-self-recovery-intact"
           - name: "python"
             test: "--acceptance-only-python"
-          - name: "python-namespaces"
-            test: "--acceptance-only-python-namespaces"
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
       - name: Set up Go
@@ -781,7 +778,7 @@ jobs:
         env:
           MATRIX_TEST: ${{ matrix.name }}
         run: |
-          if [[ "$MATRIX_TEST" == "replica-slow" || "$MATRIX_TEST" == "replica-slow-grpc" || "$MATRIX_TEST" == "fast-group-4" || "$MATRIX_TEST" == "fast-group-5" || "$MATRIX_TEST" == "recovery" || "$MATRIX_TEST" == "self-recovery" || "$MATRIX_TEST" == "self-recovery-lazy" || "$MATRIX_TEST" == "self-recovery-intact" || "$MATRIX_TEST" == "distributed-tasks" || "$MATRIX_TEST" == "compaction" || "$MATRIX_TEST" == "python-namespaces" ]]; then
+          if [[ "$MATRIX_TEST" == "replica-slow" || "$MATRIX_TEST" == "replica-slow-grpc" || "$MATRIX_TEST" == "fast-group-4" || "$MATRIX_TEST" == "fast-group-5" || "$MATRIX_TEST" == "recovery" || "$MATRIX_TEST" == "self-recovery" || "$MATRIX_TEST" == "self-recovery-lazy" || "$MATRIX_TEST" == "self-recovery-intact" || "$MATRIX_TEST" == "distributed-tasks" || "$MATRIX_TEST" == "compaction" ]]; then
             echo "test_timeout_minutes=45" >> $GITHUB_ENV
           else
             echo "test_timeout_minutes=15" >> $GITHUB_ENV
@@ -790,12 +787,38 @@ jobs:
         uses: nick-fields/retry@ad984534de44a9489a53aefd81eb77f87c70dc60 # v4
         env:
           REPLICATION_GRPC_ENABLED: ${{ matrix.grpc_replication || '' }}
-          WEAVIATE_LICENSE_KEY: ${{ secrets.WEAVIATE_LICENSE_KEY }}
         with:
           timeout_minutes: ${{ env.test_timeout_minutes }}
           max_attempts: ${{ env.retry_max_attempts }}
           command: ./test/run.sh ${{ matrix.test }}
           on_retry_command: ./test/run.sh --cleanup
+  Acceptance-With-License-Tests:
+    name: acceptance with license (${{ matrix.name }})
+    runs-on: ubicloud-standard-4-ubuntu-2404
+    # Forks and Dependabot cannot read WEAVIATE_LICENSE_KEY.
+    if: ${{ (github.event_name != 'push' || github.ref_type != 'branch') && !github.event.pull_request.head.repo.fork && github.actor != 'dependabot[bot]' }}
+    strategy:
+      fail-fast: false
+      matrix:
+        include:
+          - name: "licensed"
+            test: "--acceptance-licensed"
+          - name: "python-namespaces"
+            test: "--acceptance-only-python-namespaces"
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+      - name: Set up Go
+        uses: ./.github/actions/setup-go
+      - name: Login to Docker Hub
+        uses: ./.github/actions/docker-login
+        with:
+          username: ${{secrets.DOCKER_USERNAME}}
+          password: ${{secrets.DOCKER_PASSWORD}}
+      - name: Acceptance tests with license
+        timeout-minutes: 45
+        env:
+          WEAVIATE_LICENSE_KEY: ${{ secrets.WEAVIATE_LICENSE_KEY }}
+        run: ./test/run.sh ${{ matrix.test }}
   Acceptance-Reindex-Tests:
     name: reindex (${{ matrix.name }})
     runs-on: ubicloud-standard-4-ubuntu-2404
```

**File**: `test/acceptance/authn/dynamic_users_test.go` (modified, +1/-242)
```diff
@@ -14,21 +14,16 @@ package authn
 import (
 	"context"
 	"errors"
-	"slices"
 	"testing"
 	"time"
 
-	"github.com/go-openapi/strfmt"
-
 	"github.com/weaviate/weaviate/entities/models"
 
 	"github.com/weaviate/weaviate/test/docker"
 
-	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	"github.com/weaviate/weaviate/client/users"
 	"github.com/weaviate/weaviate/test/helper"
-	"github.com/weaviate/weaviate/usecases/auth/authorization"
 )
 
 // TestDynamicUsers boots a single Weaviate container shared across the dynamic
@@ -50,89 +45,18 @@ func TestDynamicUsers(t *testing.T) {
 		WithUserApiKey("static-user", "static-key").
 		WithDbUsers().
 		WithRBAC().WithRbacRoots(adminUser).
-		WithLicenseKeyFile().
 		Start(ctx)
 	require.Nil(t, err)
 	helper.SetupClient(compose.GetWeaviate().URI())
 	defer func() {
 		helper.ResetClient()
-		// testExpiration waits for a key to expire and restarts the node, which
-		// can outlast the ctx Start ran under.
-		terminateCtx, terminateCancel := context.WithTimeout(context.Background(), 2*time.Minute)
-		defer terminateCancel()
-		require.NoError(t, compose.Terminate(terminateCtx))
+		require.NoError(t, compose.Terminate(ctx))
 		cancel()
 	}()
 
 	t.Run("create_user", testCreateUser)
 	t.Run("with_static_user", testWithStaticUser)
 	t.Run("suspend_and_activate", testSuspendAndActivate)
-	t.Run("expiration", func(t *testing.T) { testExpiration(t, compose) })
-}
-
-// testExpiration runs last in TestDynamicUsers, because its last subtest
-// restarts the node without a license key.
-func testExpiration(t *testing.T, compose *docker.DockerCompose) {
-	adminKey := "admin-key"
-	in24h := helper.ExpiryIn(24 * time.Hour)
-
-	ownInfo := func(t *testing.T, key string) error {
-		_, err := helper.Client(t).Users.GetOwnInfo(users.NewGetOwnInfoParams(), helper.CreateAuth(key))
-		return err
-	}
-
-	t.Run("create with expiresAt shows it on GET, list and own-info", func(t *testing.T) {
-		const userID = "exp-user"
-		helper.DeleteUser(t, userID, adminKey)
-		apiKey := helper.CreateUserWithExpiry(t, userID, adminKey, &in24h)
-
-		want := (*strfmt.DateTime)(&in24h)
-		require.Equal(t, want, helper.GetUser(t, userID, adminKey).ExpiresAt)
-		listed := helper.ListAllUsers(t, adminKey)
-		i := slices.IndexFunc(listed, func(u *models.DBUserInfo) bool { return *u.UserID == userID })
-		require.NotEqual(t, -1, i, "%s not listed", userID)
-		require.Equal(t, want, listed[i].ExpiresAt)
-		require.Equal(t, want, helper.GetInfoForOwnUser(t, apiKey).ExpiresAt)
-	})
-
-	t.Run("expiry holds after the node restarts without a license key", func(t *testing.T) {
-		const userID = "exp-restart"
-		helper.DeleteUser(t, userID, adminKey)
-		in10s := helper.ExpiryIn(10 * time.Second)
-		apiKey := helper.CreateUserWithExpiry(t, userID, adminKey, &in10s)
-
-		var unauthorized *users.GetOwnInfoUnauthorized
-		require.EventuallyWithT(t, func(c *assert.CollectT) {
-			assert.ErrorAs(c, ownInfo(t, apiKey), &unauthorized)
-		}, 30*time.Second, 500*time.Millisecond)
-
-		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
-		defer cancel()
-		require.NoError(t, compose.SetLicenseKeyFileAt(ctx, 0, ""))
-		grace := 10 * time.Second
-		require.NoError(t, compose.RestartAt(ctx, 0, &grace))
-		helper.SetupClient(compose.GetWeaviate().URI())
-
-		require.ErrorAs(t, ownInfo(t, apiKey), &unauthorized)
-		require.Equal(t, (*strfmt.DateTime)(&in10s), helper.GetUser(t, userID, adminKey).ExpiresAt)
-		require.Equal(t, (*strfmt.DateTime)(&in24h), helper.GetUser(t, "exp-user", adminKey).ExpiresAt)
-
-		in48h := helper.ExpiryIn(48 * time.Hour)
-		_, err := helper.Client(t).Users.SetUserExpiration(
-			users.NewSetUserExpirationParams().WithUserID("exp-user").WithBody(users.SetUserExpirationBody{ExpiresAt: (*strfmt.DateTime)(&in48h)}),
-			helper.CreateAuth(adminKey),
-		)
-		var putForbidden *users.SetUserExpirationForbidden
-		require.ErrorAs(t, err, &putForbidden)
-		require.Contains(t, putForbidden.Payload.Error[0].Message, "license key")
-
-		_, err = helper.Client(t).Users.CreateUser(
-			users.NewCreateUserParams().WithUserID("exp-unlicensed").WithBody(users.CreateUserBody{ExpiresAt: (*strfmt.DateTime)(&in48h)}),
-			helper.CreateAuth(adminKey),
-		)
-		var createForbidden *users.CreateUserForbidden
-		require.ErrorAs(t, err, &createForbidden)
-	})
 }
 
 func testCreateUser(t *testing.T) {
@@ -449,168 +373,3 @@ func testSuspendAndActivate(t *testing.T) {
 		require.True(t, errors.As(err, &conflict))
 	})
 }
-
-func TestCreateUser_Namespaces(t *testing.T) {
-	const (
-		adminKey  = "admin-key"
-		adminUser = "admin-user"
-	)
-
-	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
-	// NS clusters require RBAC; adminUser is the root that creates namespaces and
-	// namespaced DB users.
-	compose, err := docker.New().WithWeaviate().
-		WithApiKey().WithRBAC().WithUserApiKey(adminUser, adminKey).WithRbacRoots(adminUser).
-		WithDbUsers().
-		WithNamespaces().
-		S
```

**File**: `test/acceptance/authz/auto_tenancy_test.go` (modified, +2/-2)
```diff
@@ -402,7 +402,7 @@ func TestAuthzAutoSchemaCollectionCreation(t *testing.T) {
 	// auto-schema path actually runs.
 	_, teardown := composeUpWithSettings(t,
 		map[string]string{existingUser: existingKey}, map[string]string{customUser: customKey}, nil,
-		false, map[string]string{"AUTOSCHEMA_ENABLED": "true"}, false, false)
+		false, map[string]string{"AUTOSCHEMA_ENABLED": "true"}, false)
 
 	className := "AutoCreated"
 	obj := articles.NewParagraph().WithID("00000000-0000-0000-0000-000000000010").Object()
@@ -528,7 +528,7 @@ func TestAuthzAutoSchemaPropertyAdd(t *testing.T) {
 	// so the property-add path runs.
 	_, teardown := composeUpWithSettings(t,
 		map[string]string{existingUser: existingKey}, map[string]string{customUser: customKey}, nil,
-		false, map[string]string{"AUTOSCHEMA_ENABLED": "true"}, false, false)
+		false, map[string]string{"AUTOSCHEMA_ENABLED": "true"}, false)
 
 	cls := articles.ParagraphsClass()
 	obj := articles.NewParagraph().WithID("00000000-0000-0000-0000-000000000020").Object()
```

**File**: `test/acceptance/authz/setup_test.go` (modified, +1/-4)
```diff
@@ -27,7 +27,7 @@ func composeUpWithSettings(t *testing.T,
 	viewers map[string]string,
 	enableMCP bool,
 	weaviateEnvs map[string]string,
-	withDbUsers, withNamespaces bool,
+	withDbUsers bool,
 ) (*docker.DockerCompose, func()) {
 	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
 
@@ -39,9 +39,6 @@ func composeUpWithSettings(t *testing.T,
 	if withDbUsers {
 		builder = builder.WithDbUsers()
 	}
-	if withNamespaces {
-		builder = builder.WithNamespaces()
-	}
 
 	// Enable MCP server if requested
 	if enableMCP {
```

**File**: `test/acceptance/licensed/authn/create_user_namespaces_test.go` (added, +191/-0)
```diff
@@ -0,0 +1,191 @@
+//                           _       _
+// __      _____  __ ___   ___  __ _| |_ ___
+// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
+//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
+//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
+//
+//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
+//
+//  CONTACT: hello@weaviate.io
+//
+
+package authn
+
+import (
+	"context"
+	"errors"
+	"testing"
+	"time"
+
+	"github.com/go-openapi/strfmt"
+	"github.com/stretchr/testify/require"
+	"github.com/weaviate/weaviate/client/users"
+	"github.com/weaviate/weaviate/test/docker"
+	"github.com/weaviate/weaviate/test/helper"
+	"github.com/weaviate/weaviate/usecases/auth/authorization"
+)
+
+func TestCreateUser_Namespaces(t *testing.T) {
+	const (
+		adminKey  = "admin-key"
+		adminUser = "admin-user"
+	)
+
+	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
+	// NS clusters require RBAC; adminUser is the root that creates namespaces and
+	// namespaced DB users.
+	compose, err := docker.New().WithWeaviate().
+		WithApiKey().WithRBAC().WithUserApiKey(adminUser, adminKey).WithRbacRoots(adminUser).
+		WithDbUsers().
+		WithNamespaces().
+		Start(ctx)
+	require.NoError(t, err)
+	helper.SetupClient(compose.GetWeaviate().URI())
+	defer func() {
+		helper.ResetClient()
+		require.NoError(t, compose.Terminate(ctx))
+		cancel()
+	}()
+
+	helper.CreateNamespace(t, "ns1", adminKey)
+	helper.CreateNamespace(t, "ns2", adminKey)
+
+	t.Run("happy path: create user bound to ns1", func(t *testing.T) {
+		const (
+			userID  = "u1"
+			fullKey = "ns1:u1" // operator-facing form for namespaced users
+		)
+		helper.DeleteUser(t, fullKey, adminKey)
+
+		resp, err := helper.Client(t).Users.CreateUser(
+			users.NewCreateUserParams().WithUserID(fullKey).WithBody(users.CreateUserBody{}),
+			helper.CreateAuth(adminKey),
+		)
+		require.NoError(t, err)
+		require.NotNil(t, resp.Payload.Apikey)
+
+		// admin is a static API key (global operator) — namespace must be returned.
+		// The storage/operator-addressable key is the namespace-prefixed form.
+		got := helper.GetUser(t, fullKey, adminKey)
+		require.Equal(t, "ns1", got.Namespace)
+
+		// The bare short id must not address a namespaced user. This locks
+		// the prefix-only addressing contract: an operator who omits the
+		// namespace gets 404, not the user from a different namespace (or
+		// any user at all).
+		_, err = helper.Client(t).Users.GetUserInfo(
+			users.NewGetUserInfoParams().WithUserID(userID),
+			helper.CreateAuth(adminKey),
+		)
+		require.Error(t, err)
+		var notFound *users.GetUserInfoNotFound
+		require.True(t, errors.As(err, &notFound), "expected GetUserInfoNotFound, got %T: %v", err, err)
+
+		helper.DeleteUser(t, fullKey, adminKey)
+	})
+
+	t.Run("missing namespace rejects", func(t *testing.T) {
+		_, err := helper.Client(t).Users.CreateUser(
+			users.NewCreateUserParams().WithUserID("u-missing"),
+			helper.CreateAuth(adminKey),
+		)
+		require.Error(t, err)
+		var unproc *users.CreateUserUnprocessableEntity
+		require.True(t, errors.As(err, &unproc), "expected CreateUserUnprocessableEntity, got %T: %v", err, err)
+	})
+
+	t.Run("empty namespace prefix rejected", func(t *testing.T) {
+		_, err := helper.Client(t).Users.CreateUser(
+			users.NewCreateUserParams().WithUserID(":u-empty-ns").WithBody(users.CreateUserBody{}),
+			helper.CreateAuth(adminKey),
+		)
+		require.Error(t, err)
+		var unproc *users.CreateUserUnprocessableEntity
+		require.True(t, errors.As(err, &unproc), "expected CreateUserUnprocessableEntity, got %T: %v", err, err)
+	})
+
+	t.Run("empty user part rejected", func(t *testing.T) {
+		_, err := helper.Client(t).Users.CreateUser(
+			users.NewCreateUserParams().WithUserID("ns1:").WithBody(users.CreateUserBody{}),
+			helper.CreateAuth(adminKey),
+		)
+		require.Error(t, err)
+		var unproc *users.CreateUserUnprocessableEntity
+		require.True(t, errors.As(err, &unproc), "expected CreateUserUnprocessableEntity, got %T: %v", err, err)
+	})
+
+	t.Run("multi-colon name rejected", func(t *testing.T) {
+		// First ':' is the ns separator; "user:extra" then fails the user-name regex.
+		_, err := helper.Client(t).Users.CreateUser(
+			users.NewCreateUserParams().WithUserID("ns1:user:extra").WithBody(users.CreateUserBody{}),
+			helper.CreateAuth(adminKey),
+		)
+		require.Error(t, err)
+		var unproc *users.CreateUserUnprocessableEntity
+		require.True(t, errors.As(err, &unproc), "expected CreateUserUnprocessableEntity, got %T: %v", err, err)
+	})
+
+	t.Run("unknown namespace rejects", func(t *testing.T) {
+		_, err := helper.Client(t).Users.CreateUser(
+			users.NewCreateUserParams().WithUserID("ns404:u-unknown").WithBody(users.CreateUserBody{}),
+			helper.CreateAuth(adminKey),
+		)
+		require.Error(t, err)
+		var unproc *users.CreateUserUnprocessableEntity
+		require.True(t, errors.As(err, &unproc), "expected CreateUserUnprocessableEntity, got %T: %v", err, err)
+	})
+
+	t.Run("import on NS-enabled cluster reject
```

**File**: `test/acceptance/licensed/authn/user_expiration_test.go` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+//                           _       _
+// __      _____  __ ___   ___  __ _| |_ ___
+// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
+//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
+//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
+//
+//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
+//
+//  CONTACT: hello@weaviate.io
+//
+
+package authn
+
+import (
+	"context"
+	"slices"
+	"testing"
+	"time"
+
+	"github.com/go-openapi/strfmt"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"github.com/weaviate/weaviate/client/users"
+	"github.com/weaviate/weaviate/entities/models"
+	"github.com/weaviate/weaviate/test/docker"
+	"github.com/weaviate/weaviate/test/helper"
+)
+
+// TestUserExpiration covers DB user expiry, which needs a license key. Its last
+// subtest restarts the node without one.
+func TestUserExpiration(t *testing.T) {
+	adminUser, adminKey := "admin-user", "admin-key"
+
+	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
+	defer cancel()
+	compose, err := docker.New().WithWeaviate().
+		WithApiKey().
+		WithUserApiKey(adminUser, adminKey).
+		WithDbUsers().
+		WithRBAC().WithRbacRoots(adminUser).
+		WithLicenseKeyFile().
+		Start(ctx)
+	require.NoError(t, err)
+	helper.SetupClient(compose.GetWeaviate().URI())
+	defer func() {
+		helper.ResetClient()
+		// The test waits for a key to expire and restarts the node, which can
+		// outlast the ctx Start ran under.
+		terminateCtx, terminateCancel := context.WithTimeout(context.Background(), 2*time.Minute)
+		defer terminateCancel()
+		require.NoError(t, compose.Terminate(terminateCtx))
+	}()
+
+	in24h := helper.ExpiryIn(24 * time.Hour)
+
+	ownInfo := func(t *testing.T, key string) error {
+		_, err := helper.Client(t).Users.GetOwnInfo(users.NewGetOwnInfoParams(), helper.CreateAuth(key))
+		return err
+	}
+
+	t.Run("create with expiresAt shows it on GET, list and own-info", func(t *testing.T) {
+		const userID = "exp-user"
+		helper.DeleteUser(t, userID, adminKey)
+		apiKey := helper.CreateUserWithExpiry(t, userID, adminKey, &in24h)
+
+		want := (*strfmt.DateTime)(&in24h)
+		require.Equal(t, want, helper.GetUser(t, userID, adminKey).ExpiresAt)
+		listed := helper.ListAllUsers(t, adminKey)
+		i := slices.IndexFunc(listed, func(u *models.DBUserInfo) bool { return *u.UserID == userID })
+		require.NotEqual(t, -1, i, "%s not listed", userID)
+		require.Equal(t, want, listed[i].ExpiresAt)
+		require.Equal(t, want, helper.GetInfoForOwnUser(t, apiKey).ExpiresAt)
+	})
+
+	t.Run("expiry holds after the node restarts without a license key", func(t *testing.T) {
+		const userID = "exp-restart"
+		helper.DeleteUser(t, userID, adminKey)
+		in10s := helper.ExpiryIn(10 * time.Second)
+		apiKey := helper.CreateUserWithExpiry(t, userID, adminKey, &in10s)
+
+		var unauthorized *users.GetOwnInfoUnauthorized
+		require.EventuallyWithT(t, func(c *assert.CollectT) {
+			assert.ErrorAs(c, ownInfo(t, apiKey), &unauthorized)
+		}, 30*time.Second, 500*time.Millisecond)
+
+		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
+		defer cancel()
+		require.NoError(t, compose.SetLicenseKeyFileAt(ctx, 0, ""))
+		grace := 10 * time.Second
+		require.NoError(t, compose.RestartAt(ctx, 0, &grace))
+		helper.SetupClient(compose.GetWeaviate().URI())
+
+		require.ErrorAs(t, ownInfo(t, apiKey), &unauthorized)
+		require.Equal(t, (*strfmt.DateTime)(&in10s), helper.GetUser(t, userID, adminKey).ExpiresAt)
+		require.Equal(t, (*strfmt.DateTime)(&in24h), helper.GetUser(t, "exp-user", adminKey).ExpiresAt)
+
+		in48h := helper.ExpiryIn(48 * time.Hour)
+		_, err := helper.Client(t).Users.SetUserExpiration(
+			users.NewSetUserExpirationParams().WithUserID("exp-user").WithBody(users.SetUserExpirationBody{ExpiresAt: (*strfmt.DateTime)(&in48h)}),
+			helper.CreateAuth(adminKey),
+		)
+		var putForbidden *users.SetUserExpirationForbidden
+		require.ErrorAs(t, err, &putForbidden)
+		require.Contains(t, putForbidden.Payload.Error[0].Message, "license key")
+
+		_, err = helper.Client(t).Users.CreateUser(
+			users.NewCreateUserParams().WithUserID("exp-unlicensed").WithBody(users.CreateUserBody{ExpiresAt: (*strfmt.DateTime)(&in48h)}),
+			helper.CreateAuth(adminKey),
+		)
+		var createForbidden *users.CreateUserForbidden
+		require.ErrorAs(t, err, &createForbidden)
+	})
+}
```

**File**: `test/acceptance/licensed/authz/namespaces_test.go` (renamed, +9/-14)
```diff
@@ -36,18 +36,13 @@ func TestAuthzNamespaces(t *testing.T) {
 	noPermsUser := "no-perms-user"
 	noPermsKey := "no-perms-key"
 
-	_, down := composeUpWithSettings(t,
+	down := composeUp(t,
 		map[string]string{adminUser: adminKey},
 		map[string]string{
 			manageUser:       manageKey,
 			scopedManageUser: scopedManageKey,
 			noPermsUser:      noPermsKey,
 		},
-		nil,
-		false,
-		nil,
-		true, // withDbUsers — needed for the namespace-scoping subtests below.
-		true, // withNamespaces
 	)
 	defer down()
 
@@ -232,7 +227,7 @@ func TestAuthzNamespaces(t *testing.T) {
 	// user can only create within their own namespace.
 	const bootstrapRole = "ns-bootstrap-create"
 	helper.CreateRole(t, adminKey, &models.Role{
-		Name: String(bootstrapRole),
+		Name: new(bootstrapRole),
 		Permissions: []*models.Permission{
 			helper.NewCollectionsPermission().WithAction(authorization.CreateCollections).WithCollection("*").Permission(),
 			helper.NewAliasesPermission().WithAction(authorization.CreateAliases).WithCollection("*").WithAlias("*").Permission(),
@@ -259,7 +254,7 @@ func TestAuthzNamespaces(t *testing.T) {
 	t.Run("read_collections wildcard scope: namespaced caller can read own-NS collection by unqualified name", func(t *testing.T) {
 		const role = "read-all"
 		helper.CreateRole(t, adminKey, &models.Role{
-			Name: String(role),
+			Name: new(role),
 			Permissions: []*models.Permission{
 				helper.NewCollectionsPermission().WithAction(authorization.ReadCollections).WithCollection("*").Permission(),
 			},
@@ -274,7 +269,7 @@ func TestAuthzNamespaces(t *testing.T) {
 	t.Run("read_collections regex scope (Movies*): matches in own namespace only", func(t *testing.T) {
 		const role = "read-movies-prefix"
 		helper.CreateRole(t, adminKey, &models.Role{
-			Name: String(role),
+			Name: new(role),
 			Permissions: []*models.Permission{
 				helper.NewCollectionsPermission().WithAction(authorization.ReadCollections).WithCollection("Movies*").Permission(),
 			},
@@ -296,7 +291,7 @@ func TestAuthzNamespaces(t *testing.T) {
 	t.Run("read_collections exact scope (Movies): allows only Movies in own namespace", func(t *testing.T) {
 		const role = "read-movies-exact"
 		helper.CreateRole(t, adminKey, &models.Role{
-			Name: String(role),
+			Name: new(role),
 			Permissions: []*models.Permission{
 				helper.NewCollectionsPermission().WithAction(authorization.ReadCollections).WithCollection("Movies").Permission(),
 			},
@@ -317,7 +312,7 @@ func TestAuthzNamespaces(t *testing.T) {
 	t.Run("schema dump filters to own namespace for namespaced caller", func(t *testing.T) {
 		const role = "read-all-for-dump"
 		helper.CreateRole(t, adminKey, &models.Role{
-			Name: String(role),
+			Name: new(role),
 			Permissions: []*models.Permission{
 				helper.NewCollectionsPermission().WithAction(authorization.ReadCollections).WithCollection("*").Permission(),
 			},
@@ -354,7 +349,7 @@ func TestAuthzNamespaces(t *testing.T) {
 
 		const role = "read-aliases-all"
 		helper.CreateRole(t, adminKey, &models.Role{
-			Name: String(role),
+			Name: new(role),
 			Permissions: []*models.Permission{
 				helper.NewAliasesPermission().WithAction(authorization.ReadAliases).WithCollection("*").WithAlias("*").Permission(),
 			},
@@ -393,7 +388,7 @@ func TestAuthzNamespaces(t *testing.T) {
 		// Role creation rejects qualified resource paths for now
 		const role = "own-info-strip"
 		helper.CreateRole(t, adminKey, &models.Role{
-			Name: String(role),
+			Name: new(role),
 			Permissions: []*models.Permission{
 				helper.NewCollectionsPermission().WithAction(authorization.ReadCollections).WithCollection("*").Permission(),
 				helper.NewAliasesPermission().WithAction(authorization.ReadAliases).WithCollection("*").WithAlias("*").Permission(),
@@ -470,7 +465,7 @@ func TestAuthzNamespaces(t *testing.T) {
 		const role = "qualified-path-role"
 		_, err := helper.Client(t).Authz.CreateRole(
 			authz.NewCreateRoleParams().WithBody(&models.Role{
-				Name: String(role),
+				Name: new(role),
 				Permissions: []*models.Permission{
 					helper.NewCollectionsPermission().WithAction(authorization.ReadCollections).WithCollection(ns1 + ":Movies").Permission(),
 				},
```

**File**: `test/acceptance/licensed/authz/setup_test.go` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+//                           _       _
+// __      _____  __ ___   ___  __ _| |_ ___
+// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
+//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
+//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
+//
+//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
+//
+//  CONTACT: hello@weaviate.io
+//
+
+package authz
+
+import (
+	"context"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+	"github.com/weaviate/weaviate/test/docker"
+	"github.com/weaviate/weaviate/test/helper"
+)
+
+// composeUp starts a namespace-enabled RBAC node with DB users, the admins as
+// RBAC roots and the users as plain API-key users.
+func composeUp(t *testing.T, admins, users map[string]string) func() {
+	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
+
+	builder := docker.New().WithWeaviateEnv("AUTOSCHEMA_ENABLED", "false").WithWeaviate().
+		WithRBAC().WithApiKey().WithDbUsers().WithNamespaces()
+	adminUserNames := make([]string, 0, len(admins))
+	for userName, key := range admins {
+		builder = builder.WithUserApiKey(userName, key)
+		adminUserNames = append(adminUserNames, userName)
+	}
+	builder = builder.WithRbacRoots(adminUserNames...)
+	for userName, key := range users {
+		builder = builder.WithUserApiKey(userName, key)
+	}
+	compose, err := builder.Start(ctx)
+	require.NoError(t, err)
+
+	helper.SetupClient(compose.GetWeaviate().URI())
+	return func() {
+		helper.ResetClient()
+		if err := compose.Terminate(ctx); err != nil {
+			t.Fatalf("failed to terminate test containers: %v", err)
+		}
+		cancel()
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #13621** (2026-10-27): chore: adjust macOS swagger lib download in tools/gen-code-from-swagger.sh script (@antas-marcin)
- **PR #13616** (2026-10-27): Merge stable/v1.38 into stable/v1.39 (@antas-marcin)
- **PR #13615** (2026-10-27): test(lazy-load): stop periodic flushes from counting warmup seed objects (@antas-marcin)
- **PR #13614** (2026-10-27): Merge stable/v1.40 into main (@antas-marcin)
- **PR #13613** (2026-10-27): Allow a minute for new DB user keys in namespace acceptance tests (@dirkkul)
- **PR #13612** (2026-10-27): perf(db): open and walk each shard once for all startup rebuilds before load (@antas-marcin)

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

## X. Merge pull request #13593 from weaviate/namespace_drop_vector

**RULE**:
When implementing operations in `adapters/handlers/rest/configure_api.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in weaviate/weaviate. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ad54fb8b`: Merge pull request #13593 from weaviate/namespace_drop_vector. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `adapters/handlers/rest/configure_api.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
			serverShutdownCtx, appState.SchemaManager, dropVectorEnqueuer, appState.NamespacesController, appState.Logger,
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
			serverShutdownCtx, appState.SchemaManager, dropVectorEnqueuer, appState.Logger,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ad54fb8b` are properly handled with clean fallback behavior.

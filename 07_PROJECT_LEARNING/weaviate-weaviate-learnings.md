# Forensic Learning Record (Deep Inspection): weaviate/weaviate

> **Canonical Artifact**: `07_PROJECT_LEARNING/weaviate-weaviate-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/weaviate/weaviate](https://github.com/weaviate/weaviate))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:27:41.029Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `weaviate/weaviate`
- **Description**: Weaviate is an open-source vector database that stores both objects and vectors, allowing for the combination of vector search with structured filtering with the fault tolerance and scalability of a cloud-native database​.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: pyproject.toml, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 16864 stars

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
	"github.com/weaviate/weaviate/usecases/schema"
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
	if deferredShards > 0 {
		e.logInfo(collection, fmt.Sprintf(
			"drop-vector enqueue: round capped at %d shards, %d deferr
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

### Core Architecture Module: `adapters/repos/db/inverted_reindexer_utils.go`
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

package db

import (
	"regexp"

	"github.com/weaviate/weaviate/adapters/repos/db/helpers"
	"github.com/weaviate/weaviate/entities/models"
	"github.com/weaviate/weaviate/entities/schema"
)

func GetPropNameAndIndexTypeFromBucketName(bucketName string) (string, PropertyIndexType) {
	propRegexpGroup := "(?P<propName>.*)"

	types := []struct {
		indexType    PropertyIndexType
		bucketNameFn func(string) string
	}{
		{
			IndexTypePropNull,
			helpers.BucketFromPropNameNullLSM,
		},
		{
			IndexTypePropLength,
			helpers.BucketFromPropNameLengthLSM,
		},
		{
			IndexTypePropSearchableValue,
			helpers.BucketSearchableFromPropNameLSM,
		},
		{
			IndexTypePropMetaCount,
			helpers.BucketFromPropNameMetaCountLSM,
		},
		{
			IndexTypePropValue,
			helpers.BucketFromPropNameLSM,
		},
	}

	for _, t := range types {
		r, err := regexp.Compile("^" + t.bucketNameFn(propRegexpGroup) + "$")
		if err != nil {
			continue
		}
		matches := r.FindStringSubmatch(bucketName)
		if len(matches) > 0 {
			return matches[r.SubexpIndex("propName")], t.indexType
		}
	}
	return "", 0
}

type reindexablePropertyChecker struct {
	reindexables map[string]map[PropertyIndexType]struct{}
	props        map[string]*models.Property
}

func newReindexablePropertyChecker(reindexableProperties []ReindexableProperty, class *models.Class) *reindexablePropertyChecker {
	reindexables := map[string]map[PropertyIndexType]struct{}{}
	props := map[string]*models.Property{}
	for _, property := range reindexableProperties {
		if _, ok := reindexables[property.PropertyName]; !ok {
			reindexables[property.PropertyName] = map[PropertyIndexType]struct{}{}
		}
		reindexables[property.PropertyName][property.IndexType] = struct{}{}
		props[property.PropertyName], _ = schema.GetPropertyByName(class, property.PropertyName)
	}
	return &reindexablePropertyChecker{reindexables, props}
}

func (c *reindexablePropertyChecker) isReindexable(propName string, indexType PropertyIndexType) bool {
	if _, ok := c.reindexables[propName]; ok {
		_, ok := c.reindexables[propName][indexType]
		return ok
	}
	return false
}

func (c *reindexablePropertyChecker) getSchemaProp(propName string) *models.Property {
	return c.props[propName]
}

```

### Core Architecture Module: `adapters/repos/db/priorityqueue/queue.go`
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

package priorityqueue

type supportedValueType interface {
	any | uint64
}

// Item represents a queue item supporting an optional additional Value
type Item[T supportedValueType] struct {
	ID       uint64
	Dist     float32
	Rescored bool
	Value    T
}

// Queue is a priority queue supporting generic item values
type Queue[T supportedValueType] struct {
	items []Item[T]
	less  func(items []Item[T], i, j int) bool
}

// NewMin constructs a priority queue which prioritizes items with smaller distance
func NewMin[T supportedValueType](capacity int) *Queue[T] {
	return &Queue[T]{
		items: make([]Item[T], 0, capacity),
		less: func(items []Item[T], i, j int) bool {
			return items[i].Dist < items[j].Dist
		},
	}
}

// NewMin constructs a priority queue which prioritizes items with larger distance and smaller ID:
// - higher scores first
// - if tied, lower document id first
// Thus, the signs in the Less function are opposite for scores and ids
func NewMinWithId[T supportedValueType](capacity int) *Queue[T] {
	return &Queue[T]{
		items: make([]Item[T], 0, capacity),
		less: func(items []Item[T], i, j int) bool {
			if items[i].Dist == items[j].Dist {
				return items[i].ID > items[j].ID
			}
			return items[i].Dist < items[j].Dist
		},
	}
}

// NewMax constructs a priority queue which prioritizes items with greater distance
func NewMax[T supportedValueType](capacity int) *Queue[T] {
	return &Queue[T]{
		items: make([]Item[T], 0, capacity),
		less: func(items []Item[T], i, j int) bool {
			return items[i].Dist > items[j].Dist
		},
	}
}

func (q *Queue[T]) ShouldEnqueue(distance float32, limit int) bool {
	// read items[0].Dist directly rather than via Top(), which returns the whole
	// Item by value (a multi-word copy) on this hot path.
	return len(q.items) < limit || q.items[0].Dist < distance
}

func (q *Queue[T]) InsertAndPop(id uint64, score float64, limit int, worstDist *float64, val T) {
	q.InsertWithValue(id, float32(score), val)
	for q.Len() > limit {
		q.Pop()
	}
	// only update the worst distance when the queue is full, otherwise results can be missing if the first
	// entry that is checked already has a very high score
	if q.Len() >= limit {
		*worstDist = float64(q.Top().Dist)
	}
}

// Pop removes the next item in the queue and returns it
func (q *Queue[T]) Pop() Item[T] {
	out := q.items[0]
	q.items[0] = q.items[len(q.items)-1]
	q.items = q.items[:len(q.items)-1]
	q.heapify(0)
	return out
}

// Top peeks at the next item in the queue
func (q *Queue[T]) Top() Item[T] {
	return q.items[0]
}

// Len returns the length of the queue
func (q *Queue[T]) Len() int {
	return len(q.items)
}

// Cap returns the remaining capacity of the queue
func (q *Queue[T]) Cap() int {
	return cap(q.items)
}

// Reset clears all items from the queue
func (q *Queue[T]) Reset() {
	q.items = q.items[:0]
}

// ResetCap drops existing queue items, and allocates a new queue with the given capacity
func (q *Queue[T]) ResetCap(capacity int) {
	q.items = make([]Item[T], 0, capacity)
}

// Insert creates a valueless item and adds it to the queue
func (q *Queue[T]) Insert(id uint64, distance float32) int {
	item := Item[T]{
		ID:   id,
		Dist: distance,
	}
	return q.insert(item)
}

// InsertWithValue creates an item with a T type value and adds it to the queue
func (q *Queue[T]) InsertWithValue(id uint64, distance float32, val T) int {
	item := Item[T]{
		ID:    id,
		Dist:  distance,
		Value: val,
	}
	return q.insert(item)
}

// DeleteItem deletes item meeting predicate's conditions
// TODO aliszka optimize?
func (q *Queue[T]) DeleteItem(match func(item Item[T]) bool) bool {
	for i := range q.items {
		if match(q.items[i]) {
			if i == 0 {
				q.Pop()
			} else {
				last := q.Len() - 1
				q.items[i] = q.items[last]
				q.items = q.items[:last]
				q.heapify(0)
			}
			return true
		}
	}
	return false
}

func (q *Queue[T]) insert(item Item[T]) int {
	q.items = append(q.items, item)
	i := len(q.items) - 1
	for i != 0 && q.less(q.items, i, q.parent(i)) {
		q.swap(i, q.parent(i))
		i = q.parent(i)
	}
	return i
}

func (q *Queue[T]) left(i int) int {
	return 2*i + 1
}

func (q *Queue[T]) right(i int) int {
	return 2*i + 2
}

func (q *Queue[T]) parent(i int) int {
	return (i - 1) / 2
}

func (q *Queue[T]) swap(i, j int) {
	q.items[i], q.items[j] = q.items[j], q.items[i]
}

func (q *Queue[T]) heapify(i int) {
	left := q.left(i)
	right := q.right(i)
	smallest := i
	if left < len(q.items) && q.less(q.items, left, i) {
		smallest = left
	}

	if right < len(q.items) && q.less(q.items, right, smallest) {
		smallest = right
	}

	if smallest != i {
		q.swap(i, smallest)
		q.heapify(smallest)
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12935** (2026-09-07): **HNSW: panic in packedconn.decodeInto — ACORN search reads a neighbor's connections without its lock**
  *Symptoms*: ## Summary  `hnsw/search.go:425` (the ACORN filter branch) iterates a **neighbor** vertex's connections while holding only the *candidate* vertex's mutex. `packedconn.Connections` has no internal lock, so a concurrent writer holding the neighbor's mutex tears the read and the decode indexes past the end of the connection data.  The panic is recovered by the errgroup wrapper, so the node survives and the query fails.  Observed on 2026-09-04 on a WCS dev cluster:  ``` Recovered from panic: shard: NjlDaweeJExh, collection: SimClass, vectorIndex: vectors_alt_vector, panic: runtime error: index out of range [0] with length 0 ```  ``` github.com/weaviate/weaviate/entities/vectorindex/hnsw/packedconn.decodeInto(...) 	entities/vectorindex/hnsw/packedconn/connections.go:242 github.com/weaviate/weaviate/entities/vectorindex/hnsw/packedconn.decodeValues(...) 	entities/vectorindex/hnsw/packedconn/connections.go:276 github.com/weaviate/weaviate/entities/vectorindex/hnsw/packedconn.(*Connections).ElementIterator(...) 	entities/vectorindex/hnsw/packedconn/connections.go:637 github.com/weaviate/weaviate/adapters/repos/db/vector/hnsw.(*hnsw).searchLayerByVectorWithDistancerWithStrategy.func3(...) 	adapters/repos/db/vector/hnsw/search.go:425 github.com/weaviate/weaviate/adapters/repos/db/vector/hnsw.(*hnsw).knnSearchByVector(...) 	adapters/repos/db/vector/hnsw/search.go:1008 github.com/weaviate/weaviate/adapters/repos/db.(*Shard).ObjectVectorSearch.func2() 	adapters/repos/db/shard_read.go:774 
  **Post-Mortem & Fix Analysis**:
  > I'll work on this. Could you assign it to me?  I'll reproduce from the report, fix the failure path, and add a test so it stays fixed. 
  > Fix in progress on `jose/fix-acorn-neighbor-connection-locking`.  **Tests first, both red against current `main`:**  * `TestSearchConcurrentWithConnectionUpdates` — a table over both filter strategies, running filtered searches while inserts update the graph. The `acorn` case reports the race under `-race` on the exact production path (`search.go:425` → `ElementIterator` → `decodeInto`, against `InsertAtLayer`/`appendToLayer`); `sweeping` is clean. * `TestSearchReleasesEntrypointLockWhenEntrypointHasNoLayers` — deterministic, no race detector needed. With a zero-layer entrypoint the search never returns, because it blocks on the mutex it leaked a few lines earlier.  **Fix:**  The candidate's mutex is now released as soon as its own connections have been copied, and each neighbor is locked on its own while its layer is copied into a pooled buffer. Nesting the neighbor's mutex inside the candidate's would have deadlocked instead: no other code in the package holds two vertex mutexes, and
  > Thanks for your initiative @modelpath-dev . I already had most of the context and a repro, so went ahead and submitted a tentative fix.

- **Issue #12749** (2026-08-24): **gRPC batch stream: recv goroutine leaks on unbuffered errCh/reqCh send when the stream ends via context cancellation**
  *Symptoms*: ## Summary  The gRPC batch-stream handler leaks one goroutine every time a stream ends through context cancellation. The `recv` helper's child goroutine blocks forever on an unbuffered channel send that no one will ever read. Observed on a 1.39.0 production cluster; the code is unchanged on `main`.  ## Evidence  5-node cluster, v1.39.0, batch-stream ingest whose client streams ended abnormally (the client aborted stream starts after its 60 s timeout). `debug/pprof/goroutine` on the three nodes that had been up longest showed 16, 9, and 10 goroutines parked in:  ``` 16 @ 0x48ee4e 0x41ba3c 0x41b637 0x2e20bb1 0xb2e753 0x496f21 #	github.com/weaviate/weaviate/adapters/handlers/grpc/v1/batch.(*StreamHandler).recv.func1+0xd0  adapters/handlers/grpc/v1/batch/stream.go:387 #	github.com/weaviate/weaviate/entities/errors.GoWrapper.func1+0x52                              entities/errors/go_wrapper.go:35 ```  No `Handle`/`sender`/`receiver` goroutines existed at the same time — these are orphans of streams that ended long before. Each leak correlates with a `"context cancelled, closing stream"` log line. Nodes that restarted recently had none; counts only grow.  ## Root cause  [`stream.go#L372-L394` (v1.39.0)](https://github.com/weaviate/weaviate/blob/v1.39.0/adapters/handlers/grpc/v1/batch/stream.go#L372-L394):  ```go func (h *StreamHandler) recv(stream pb.Weaviate_BatchStreamServer) (chan *pb.BatchStreamRequest, chan error) { 	reqCh := make(chan *pb.BatchStreamRequest) 	errCh := make(ch
  **Post-Mortem & Fix Analysis**:
  > Closed by https://github.com/weaviate/weaviate/pull/12627
  > Confirmed against the merged fix in #12627 — the shape landed exactly as described here: both errCh <- err and reqCh <- req in recv are now wrapped in select with case <-ctx.Done(), and ctx is the stream's own cancellable context rather than the raw stream context, so every receiver exit path (grace-period cancel included) reliably unblocks the sender.  One thing worth flagging for anyone reading this later: the fix isn't just adding the select branches. recv now also unconditionally closes both channels via defer, and receiver's select loop was changed to check the second ok value on each channel read. That's necessary because a select that takes the ctx.Done() branch returns without ever sending — if receiver is still reading from errCh/reqCh for any other reason at that point, it needs the channel-closed signal, not just cancellation, to know recv is gone and avoid its own equivalent block. 

- **Issue #12536** (2026-08-18): **Hybrid search silently caps boost.depth at QUERY_HYBRID_MAXIMUM_RESULTS, causing incorrect ranking**
  *Symptoms*: ### How to reproduce this bug?  Start Weaviate and run:  ```bash python - <<'PY' import time  import grpc import requests from google.protobuf.json_format import ParseDict from weaviate.proto.v1 import search_get_pb2 from weaviate.proto.v1 import weaviate_pb2_grpc  HTTP = "http://localhost:8080" GRPC = "localhost:50051" CLASS_NAME = "HybridBoostDepthBug" HIGH_ID = "00000000-0000-0000-0000-000000000121"  requests.delete(f"{HTTP}/v1/schema/{CLASS_NAME}")  schema = {     "class": CLASS_NAME,     "vectorizer": "none",     "properties": [         {"name": "title", "dataType": ["text"]},         {"name": "likes", "dataType": ["number"]},     ], }  response = requests.post(f"{HTTP}/v1/schema", json=schema) response.raise_for_status()  objects = [] for i in range(150):     object_id = f"00000000-0000-0000-0000-{i + 1:012d}"      # BM25 rank intentionally decreases with term frequency.     title = ("needle " * (150 - i)).strip()      # The object around rank 121 has the highest likes value and should be boosted.     likes = 1000 if object_id == HIGH_ID else 0      objects.append({         "class": CLASS_NAME,         "id": object_id,         "properties": {             "title": title,             "likes": likes,         },     })  response = requests.post(     f"{HTTP}/v1/batch/objects",     json={"objects": objects}, ) response.raise_for_status()  time.sleep(2)  channel = grpc.insecure_channel(GRPC) stub = weaviate_pb2_grpc.WeaviateStub(channel)   def run(use_boost):     request = { 

- **Issue #12199** (2026-08-05): **INDEX_RANGEABLE_IN_MEMORY=true during an enable-rangeable reindex: post-swap rangeable bucket serves EMPTY range results (no disk fallback) until restart**
  *Symptoms*: ## Summary  When the global `INDEX_RANGEABLE_IN_MEMORY=true` knob is active **while** an `enable-rangeable` runtime reindex runs, the runtime-created rangeable ingest bucket is opened with `keepSegmentsInMemory=true` but an **empty** in-memory representation. The bulk backfill enters that bucket via a file-level segment copy (`PrependSegmentsFromBucket`) that updates the on-disk segment list but **never** the in-memory representation. After the per-shard swap + ready-flip, the range-query path reads the empty in-memory representation and **ignores the fully-populated disk segments, with no disk fallback**.  Net effect: range filters on the migrated property (`prop >= X && prop <= Y`) silently return **empty (or live-writes-only) results** from the moment each shard's swap completes until the next process restart. There is no error and no log. A restart heals it, because the boot-time rebuild reconstructs the in-memory representation from all disk segments.  This is **strictly worse than #12189**: that issue was benign on a single node because the completed shards served correct data from the rangeable **disk** reader. With the in-mem knob on, the disk reader is never consulted, so **this is a silent wrong-results bug even on a single node.**  Found during prod-scale QA of the Runtime Reindex **Preview** feature (a 165M-object, 3-shard collection reindexed on a single-node v1.38.4 instance). Verdict is from a read-only code trace; empirical confirmation is in progress.  ## Aff
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for opening this issue!  I found a similar issue in our tracker that might address your problem:  _[Issue weaviate/weaviate#10675: Runtime Property Reindex](https://github.com/weaviate/weaviate/issues/10675)_  _This is the closest semantic match because it covers the runtime reindex framework, including `enable-rangeable` migrations, `PrependSegmentsFromBucket`, bucket swapping, and the need to coordinate shard visibility during migration. Your report is a more specific correctness bug within that flow: the rangeable in-memory representation is not rebuilt after the segment copy, causing silent wrong results until restart._  Please check if this is the same issue. If so, consider adding your input there or closing this one. Thanks for helping us keep the issue tracker organized! 🚀  --- <div align="center"> <img src="https://tse1.mm.bing.net/th/id/OIP.A-2PG7j0L0X0H3M3lHuB4QHaHa" width="32" height="32" alt="Weaviate Logo"> <br> <sub><strong>Powered by Weaviate</strong></sub> <
  > ## Follow-up: empirical reproduction  Adding an empirical reproduction of the behavior described in this issue (verdict (c): with `INDEX_RANGEABLE_IN_MEMORY=true` active *during* an `enable-rangeable` reindex, the swapped-in rangeable bucket serves range queries from an **empty** in-memory representation with **no disk fallback**, until the next process restart rebuilds it from the on-disk segments). Empirically reproduced on a single-node **v1.38.4** instance (git `6af189f`) with a small synthetic collection. The runtime behavior matches the analysis exactly.  ## TL;DR  With `INDEX_RANGEABLE_IN_MEMORY=true`, enabling a rangeable index and **not** restarting makes every range query on that property return **0 results** (silent — no error, no log), while the unfiltered control and every non-range query stay correct, and the on-disk rangeable segments are fully populated. A restart (no re-index) heals it. The in-memory representation is built **empty** at bucket creation and never re-pop
  > SuperClaude here.  Closing as fixed. Fixed by weaviate/weaviate#12215 (merge `7f409b6`), first released in **v1.38.7**, also in v1.38.8 and v1.39.0; `main` carries the same change (`2c8019e`, `ed90a4a`). v1.38.6 and earlier remain affected.  The root cause is removed rather than patched around: reindex `RoaringSetRange` buckets now always open with `keepSegmentsInMemory=false`, so the ingest bucket never has an in-memory representation for the file-level segment copy to desync — post-swap range queries serve from the disk reader, correct from the moment of each per-shard swap, no restart needed. Three backstops on top:  1. `PrependSegmentsFromBucket` refuses (pre-mutation) to splice into a `RoaringSetRange` group with a live in-memory rep (`ErrPrependWouldDesyncInMemoryRep`) — any future caller recreating this state fails loudly instead of serving wrong results. 2. The read path now falls back to disk when the rep is unpopulated but disk segments exist (with a WARN) — the "no disk fall

- **Issue #12097** (2026-07-10): **Jaccard IVF search returns no results even when all indexed vectors are scanned**
  *Symptoms*: ### How to reproduce this bug?  1. Install the Python client/library version listed under **Supporting information**.  2. Create an IVF Flat index with one inverted list and configure it to use the Jaccard metric.  3. Set `nprobe` to `1`, so the only inverted list is searched.  4. Add the following vectors:     - `[1, 0, 1]`    - `[1, 1, 0]`    - `[0, 1, 1]`  5. Search for `[1, 0, 1]` with `k=1`.  6. Compare the result with a Flat index using the same Jaccard metric.  7. Optionally, apply the dimension permutation `[2, 0, 1]` to both the indexed vectors and the query, and repeat the search.  Minimal reproduction:  ```python import faiss import numpy as np   def make_ivf(d):     quantizer = faiss.IndexFlat(d, faiss.METRIC_L2)     index = faiss.IndexIVFFlat(         quantizer,         d,         1,         faiss.METRIC_Jaccard,     )     index.nprobe = 1     return index   def run(label, xb, xq, k=1):     flat = faiss.IndexFlat(         xb.shape[1],         faiss.METRIC_Jaccard,     )     flat.add(xb)     flat_distances, flat_ids = flat.search(xq, k)      ivf = make_ivf(xb.shape[1])     ivf.train(xb)     ivf.add(xb)     ivf_distances, ivf_ids = ivf.search(xq, k)      print(f"{label} flat distances:", flat_distances.tolist())     print(f"{label} flat ids:", flat_ids.tolist())     print(f"{label} ivf distances:", ivf_distances.tolist())     print(f"{label} ivf ids:", ivf_ids.tolist())     print(         f"{label} ivf list sizes:",         [ivf.invlists.list_size(i) for i in range

- **Issue #12041** (2026-07-08): **Batch delete returns HTTP 500 instead of 422 when match.where or match.class is missing**
  *Symptoms*: ### How to reproduce this bug?   Clean weaviate v1.38.2 container, default config. Create any class, then send a batch delete missing a required field:  ```bash # Setup curl -X POST "http://localhost:8080/v1/schema" \   -H "Content-Type: application/json" \   -d '{"class":"BoundaryTestBatchDelete","vectorizer":"none",        "properties":[{"name":"title","dataType":["text"]}]}' ```  **Case A — `match.class` present, `match.where` absent** (docs mark `where` as required):  ```bash curl -X DELETE "http://localhost:8080/v1/batch/objects" \   -H "Content-Type: application/json" \   -d '{"match":{"class":"BoundaryTestBatchDelete"},"output":"minimal"}' ```  **Case B — empty `match` object** (both required fields absent):  ```bash curl -X DELETE "http://localhost:8080/v1/batch/objects" \   -H "Content-Type: application/json" \   -d '{"match":{},"output":"minimal"}' ```  ---  ### What is the expected behavior?   Per the [batch delete docs](https://weaviate.io/developers/weaviate/api/rest/batch#delete-objects), both `match.class` and `match.where` are listed as **required** fields:  ``` "match": {   "class": "<ClassName>",   # required   "where": { ... },         # required } ```  A missing required field is a client-side validation error, so the server should return **`422 Unprocessable Entity`** (or `400`) with the same message body — consistent with how weaviate handles other invalid request bodies elsewhere in the batch endpoint.  ---   ### What is the actual behavior?   Both case
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for opening this issue!  I found a similar issue in our tracker that might address your problem:  _[Issue weaviate/weaviate#2929: [BUG] invalid pagination params: query maximum results exceeded?](https://github.com/weaviate/weaviate/issues/2929)_  _This closed issue is the closest match because it discusses validation/pagination errors on Weaviate’s REST query path and the `query maximum results exceeded` behavior. It’s not the same bug, but it is the nearest semantically similar issue among the available matches._  Please check if this is the same issue. If so, consider adding your input there or closing this one. Thanks for helping us keep the issue tracker organized! 🚀  --- <div align="center"> <img src="https://tse1.mm.bing.net/th/id/OIP.A-2PG7j0L0X0H3M3lHuB4QHaHa" width="32" height="32" alt="Weaviate Logo"> <br> <sub><strong>Powered by Weaviate</strong></sub> </div>

- **Issue #11981** (2026-07-06): **POST /v1/batch/objects accepts empty vector `[]` and reports per-item SUCCESS (singular POST /v1/objects rejects with 422)**
  *Symptoms*: ### How to reproduce this bug?   ```bash # 1. Start Weaviate v1.38.2 (single node, anonymous access, no vectorizer module) docker run -d --name weaviate-batch-vector-bug \   -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \   -e DEFAULT_VECTORIZER_MODULE=none \   -e PERSISTENCE_DATA_PATH=/var/lib/weaviate \   -p 8080:8080 \   semitechnologies/weaviate:1.38.2  # Wait for startup sleep 8  # 2. Create a class (vectorizer=none, distance=cosine, dimension implied by first vector) curl -s -o /dev/null -w "create class: %{http_code}\n" -X POST http://localhost:8080/v1/schema \   -H "Content-Type: application/json" \   -d '{     "class": "BatchVectorBugRepro",     "vectorizer": "none",     "vectorIndexType": "hnsw",     "vectorIndexConfig": {"distance": "cosine"}   }'  # 3. CONTROL: singular POST /v1/objects with vector=[] correctly returns 422 curl -s -o /dev/null -w "singular POST /v1/objects with vector=[]: %{http_code}\n" -X POST http://localhost:8080/v1/objects \   -H "Content-Type: application/json" \   -d '{     "class": "BatchVectorBugRepro",     "properties": {"name": "control-singular"},     "vector": []   }' # Expected output: singular POST /v1/objects with vector=[]: 422  # 4. BUG: POST /v1/batch/objects with a mixed batch (valid item + empty-vector item) returns 200, #    and BOTH items report per-item "result.status": "SUCCESS" curl -s -X POST http://localhost:8080/v1/batch/objects \   -H "Content-Type: application/json" \   -d '{     "objects": [       {         "class
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for opening this issue!  I found a similar issue in our tracker that might address your problem:  _[Issue weaviate/weaviate#4499: Dimensional consistency on batch is not being checked (Closed)](https://github.com/weaviate/weaviate/issues/4499)_  _This closed issue is the closest match because it reports batch ingestion skipping vector validation and allowing invalid vectors through while single-object insertion correctly rejects them. It describes the same kind of batch-vs-singular validation inconsistency, though for vector dimensions rather than empty vectors._  Please check if this is the same issue. If so, consider adding your input there or closing this one. Thanks for helping us keep the issue tracker organized! 🚀  --- <div align="center"> <img src="https://tse1.mm.bing.net/th/id/OIP.A-2PG7j0L0X0H3M3lHuB4QHaHa" width="32" height="32" alt="Weaviate Logo"> <br> <sub><strong>Powered by Weaviate</strong></sub> </div>
  > Thanks for the detailed report! After investigating, this is working as intended, and the "expected behavior" in the issue rests on a claim about the OpenAPI spec that doesn't hold. Details below.  1. The OpenAPI spec does not require a non-empty vector  The issue states the vector field is "documented as a non-empty float array (min_length=1)". That constraint does not exist. The object's vector field references C11yVector, which is a plain array of floats with no minItems/minLength:  - Spec definition: openapi-specs/schema.json → C11yVector (https://github.com/weaviate/weaviate/blob/3bb5576a5f441f385cce3b7f158f0c9b0d54f1cc/openapi-specs/schema.json#L515-L521) - A repo-wide grep for minItems/minLength in openapi-specs/ returns nothing. - The generated validator C11yVector.Validate() (https://github.com/weaviate/weaviate/blob/3bb5576a5f441f385cce3b7f158f0c9b0d54f1cc/entities/models/c11y_vector.go#L31-L33) is return nil — an empty vector is a valid value per the API contract.  2. An emp

- **Issue #11917** (2026-06-30): **Dropping a named vector index makes later non-vector object writes fail**
  *Symptoms*: ### How to reproduce this bug?  Start Weaviate with the experimental drop-vector-index endpoint enabled: ``` ENABLE_EXPERIMENTAL_ALTER_SCHEMA_DROP_VECTOR_INDEX_ENDPOINT=true ``` Then run the following commands: ```bash # 1. Create a collection with one named vector index "foo" curl -s -X POST localhost:8080/v1/schema \   -H 'Content-Type: application/json' \   -d '{     "class": "DropVectorBug",     "vectorConfig": {       "foo": {         "vectorizer": { "none": {} },         "vectorIndexType": "hnsw",         "vectorIndexConfig": { "distance": "cosine" }       }     },     "properties": [       { "name": "text", "dataType": ["text"] }     ]   }'  # 2. Before dropping the vector index, writing an object without vector "foo" succeeds. curl -i -X POST localhost:8080/v1/objects \   -H 'Content-Type: application/json' \   -d '{     "class": "DropVectorBug",     "properties": { "text": "before drop" }   }'  # 3. Drop the named vector index "foo". curl -i -X DELETE localhost:8080/v1/schema/DropVectorBug/vectors/foo/index  # 4. Write another object that also does not carry vector "foo". # Expected: this should still succeed. # Actual: this fails before storage. curl -i -X POST localhost:8080/v1/objects \   -H 'Content-Type: application/json' \   -d '{     "class": "DropVectorBug",     "properties": { "text": "after drop" }   }' ``` Observed error: ``` vectorize check for target vector foo: vector index config (<nil>) is not of type HNSW ```  ### What is the expected behavior?  The 
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for opening this issue!  I found a similar issue in our tracker that might address your problem:  _[Issue weaviate/weaviate#1800: Allow inserting object without vector - even when class generally has an index (Closed)](https://github.com/weaviate/weaviate/issues/1800)_  _This issue is the closest semantic match because it discusses allowing object writes to succeed even when a class has a vector index but the specific object does not provide a vector. Your report is a more specific named-vector/drop-index variant of the same underlying behavior._  Please check if this is the same issue. If so, consider adding your input there or closing this one. Thanks for helping us keep the issue tracker organized! 🚀  --- <div align="center"> <img src="https://tse1.mm.bing.net/th/id/OIP.A-2PG7j0L0X0H3M3lHuB4QHaHa" width="32" height="32" alt="Weaviate Logo"> <br> <sub><strong>Powered by Weaviate</strong></sub> </div>

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

### Incident Patch 1: `204977d0` (2026-08-27)
**Commit Message**: Add an authorizer method that requires a class's namespace to be active

**File**: `adapters/handlers/graphql/local/aggregate/helpers_for_test.go` (modified, +4/-0)
```diff
@@ -36,6 +36,10 @@ func (m *mockAuthorizer) Authorize(ctx context.Context, principal *models.Princi
 	return nil
 }
 
+func (m *mockAuthorizer) AuthorizeAndRequireActiveNamespace(ctx context.Context, principal *models.Principal, action string, class string, resource ...string) error {
+	return nil
+}
+
 func (m *mockAuthorizer) AuthorizeSilent(ctx context.Context, principal *models.Principal, action string, resource ...string) error {
 	return nil
 }
```

**File**: `adapters/handlers/graphql/local/explore/helpers_for_test.go` (modified, +4/-0)
```diff
@@ -45,6 +45,10 @@ func (a *fakeAuthorizer) Authorize(ctx context.Context, principal *models.Princi
 	return nil
 }
 
+func (a *fakeAuthorizer) AuthorizeAndRequireActiveNamespace(ctx context.Context, principal *models.Principal, verb string, class string, resource ...string) error {
+	return nil
+}
+
 func (a *fakeAuthorizer) AuthorizeSilent(ctx context.Context, principal *models.Principal, verb string, resource ...string) error {
 	return nil
 }
```

**File**: `adapters/handlers/graphql/local/get/helper_test.go` (modified, +4/-0)
```diff
@@ -630,6 +630,10 @@ func (f *fakeAuthorizer) Authorize(ctx context.Context, principal *models.Princi
 	return nil
 }
 
+func (f *fakeAuthorizer) AuthorizeAndRequireActiveNamespace(ctx context.Context, principal *models.Principal, action string, class string, resource ...string) error {
+	return nil
+}
+
 func (f *fakeAuthorizer) AuthorizeSilent(ctx context.Context, principal *models.Principal, action string, resource ...string) error {
 	return nil
 }
```

**File**: `adapters/handlers/grpc/v1/service_test.go` (modified, +4/-4)
```diff
@@ -78,7 +78,7 @@ func TestClassGetterWithAuthzFuncMemoization(t *testing.T) {
 
 			// second call hits the memo, so the class is authorized exactly once
 			require.Equal(t, []authMocks.AuthZReq{
-				{Principal: principal, Verb: authorization.READ, Resources: tt.expectedResources},
+				{Principal: principal, Verb: authorization.READ, Resources: tt.expectedResources, Method: authMocks.MethodAuthorize},
 			}, authorizer.Calls())
 		})
 	}
@@ -125,7 +125,7 @@ func TestClassGetterWithAuthzFuncMemoizesMissingClass(t *testing.T) {
 		require.Contains(t, err.Error(), "could not find class Foo")
 	}
 	require.Equal(t, []authMocks.AuthZReq{
-		{Principal: principal, Verb: authorization.READ, Resources: authorization.CollectionsData("Foo")},
+		{Principal: principal, Verb: authorization.READ, Resources: authorization.CollectionsData("Foo"), Method: authMocks.MethodAuthorize},
 	}, authorizer.Calls())
 }
 
@@ -150,8 +150,8 @@ func TestClassGetterWithAuthzFuncMemoizesPerClass(t *testing.T) {
 
 	// each distinct class is authorized once; repeats hit the memo
 	require.Equal(t, []authMocks.AuthZReq{
-		{Principal: principal, Verb: authorization.READ, Resources: authorization.CollectionsData("Foo")},
-		{Principal: principal, Verb: authorization.READ, Resources: authorization.CollectionsData("Bar")},
+		{Principal: principal, Verb: authorization.READ, Resources: authorization.CollectionsData("Foo"), Method: authMocks.MethodAuthorize},
+		{Principal: principal, Verb: authorization.READ, Resources: authorization.CollectionsData("Bar"), Method: authMocks.MethodAuthorize},
 	}, authorizer.Calls())
 }
 
```

**File**: `adapters/handlers/mcp/read/tenants_test.go` (modified, +4/-0)
```diff
@@ -39,6 +39,10 @@ func (r *recordingAuthorizer) Authorize(ctx context.Context, principal *models.P
 	return nil
 }
 
+func (r *recordingAuthorizer) AuthorizeAndRequireActiveNamespace(ctx context.Context, principal *models.Principal, verb string, class string, resources ...string) error {
+	return r.Authorize(ctx, principal, verb, resources...)
+}
+
 func (r *recordingAuthorizer) AuthorizeSilent(ctx context.Context, principal *models.Principal, verb string, resources ...string) error {
 	return r.Authorize(ctx, principal, verb, resources...)
 }
```

**File**: `adapters/handlers/rest/configure_server.go` (modified, +7/-0)
```diff
@@ -163,6 +163,13 @@ func configureAnonymousAccess(appState *state.State) *anonymous.Client {
 }
 
 func configureAuthorizer(appState *state.State) error {
+	// configureOIDC and configureAPIKey take appState.NamespacesController
+	// earlier in boot and neither rejects a typed nil, so this is the first
+	// place it is checked.
+	if appState.ServerConfig.Config.Namespaces.Enabled && appState.NamespacesController == nil {
+		return fmt.Errorf("NAMESPACES_ENABLED=true requires a namespace controller, but it wasn't initialized")
+	}
+
 	if appState.ServerConfig.Config.Authorization.Rbac.Enabled {
 		// if rbac enforcer enabled, start forcing all requests using the casbin enforcer
 		rbacController, err := rbac.New(
```

**File**: `adapters/handlers/rest/configure_server_test.go` (modified, +20/-0)
```diff
@@ -15,10 +15,15 @@ import (
 	"context"
 	"testing"
 
+	"github.com/sirupsen/logrus/hooks/test"
 	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+
+	"github.com/weaviate/weaviate/adapters/handlers/rest/state"
 	"github.com/weaviate/weaviate/entities/models"
 	"github.com/weaviate/weaviate/usecases/auth/authorization"
 	"github.com/weaviate/weaviate/usecases/auth/authorization/adminlist"
+	"github.com/weaviate/weaviate/usecases/auth/authorization/rbac/rbacconf"
 	"github.com/weaviate/weaviate/usecases/config"
 )
 
@@ -56,3 +61,18 @@ func Test_AdminListAuthorizer(t *testing.T) {
 		})
 	})
 }
+
+func TestConfigureAuthorizerRefusesNamespacesWithoutController(t *testing.T) {
+	logger, _ := test.NewNullLogger()
+	appState := &state.State{
+		Logger: logger,
+		ServerConfig: &config.WeaviateConfig{Config: config.Config{
+			Namespaces: config.Namespaces{Enabled: true},
+			Authorization: config.Authorization{
+				Rbac: rbacconf.Config{Enabled: true, RootUsers: []string{"root"}},
+			},
+		}},
+	}
+
+	require.ErrorContains(t, configureAuthorizer(appState), "requires a namespace controller")
+}
```

**File**: `adapters/handlers/rest/handlers_schema_security_test.go` (modified, +6/-0)
```diff
@@ -35,6 +35,7 @@ import (
 type denyAuthorizer struct {
 	forbidden authzerrors.Forbidden
 	verb      string
+	class     string
 	resources []string
 }
 
@@ -43,6 +44,11 @@ func (d *denyAuthorizer) Authorize(_ context.Context, _ *models.Principal, verb
 	return d.forbidden
 }
 
+func (d *denyAuthorizer) AuthorizeAndRequireActiveNamespace(_ context.Context, _ *models.Principal, verb string, class string, resources ...string) error {
+	d.verb, d.class, d.resources = verb, class, resources
+	return d.forbidden
+}
+
 func (d *denyAuthorizer) AuthorizeSilent(context.Context, *models.Principal, string, ...string) error {
 	return d.forbidden
 }
```

---

### Incident Patch 2: `de0c64e9` (2026-10-05)
**Commit Message**: fix(aggregator): stop a scan whose caller has gone (#13401)

* fix(aggregator): stop a scan whose caller has gone

**File**: `adapters/repos/db/aggregator/iterator.go` (modified, +5/-0)
```diff
@@ -110,7 +110,12 @@ func iteratorConcurrently(ctx context.Context, b *lsmkv.Bucket, newCursor func()
 	if len(seeds) == 0 {
 		c := newCursor()
 		defer c.Close()
+		count := 0
 		for k, v, vv, bi := c.First(); k != nil; k, v, vv, bi = c.Next() {
+			count++
+			if count%contextCheckInterval == 0 && ctx.Err() != nil {
+				return ctx.Err()
+			}
 			err := aggregateFunc(k, v, vv, bi)
 			if err != nil {
 				return err
```

**File**: `adapters/repos/db/aggregator/iterator_cancel_integration_test.go` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
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
+//go:build integrationTest
+
+package aggregator
+
+import (
+	"context"
+	"fmt"
+	"runtime"
+	"sync/atomic"
+	"testing"
+
+	"github.com/sirupsen/logrus/hooks/test"
+	"github.com/stretchr/testify/require"
+	"github.com/weaviate/sroar"
+
+	"github.com/weaviate/weaviate/adapters/repos/db/lsmkv"
+	"github.com/weaviate/weaviate/entities/cyclemanager"
+)
+
+// Ensure at least one seeded range exceeds contextCheckInterval on every machine.
+var iteratorCancelKeyCount = (2*runtime.GOMAXPROCS(0) + 1) * (contextCheckInterval + 1)
+
+// iteratorStrategy pairs a bucket strategy that reaches iteratorConcurrently
+// with the cursor its call sites use. No cursor aborts on a cancelled context
+// itself: the Ctx constructors only cap merge concurrency.
+type iteratorStrategy struct {
+	name     string
+	strategy string
+	put      func(tb testing.TB, b *lsmkv.Bucket, i int)
+	newCurs  func(ctx context.Context, b *lsmkv.Bucket) func() Cursor
+}
+
+func iteratorStrategies() []iteratorStrategy {
+	return []iteratorStrategy{
+		{
+			name:     "replace",
+			strategy: lsmkv.StrategyReplace,
+			put: func(tb testing.TB, b *lsmkv.Bucket, i int) {
+				require.NoError(tb, b.Put(iteratorKey(i), []byte(fmt.Sprintf("value-%06d", i))))
+			},
+			newCurs: func(_ context.Context, b *lsmkv.Bucket) func() Cursor {
+				return func() Cursor { return ReplaceCursor{b.Cursor()} }
+			},
+		},
+		{
+			name:     "set collection",
+			strategy: lsmkv.StrategySetCollection,
+			put: func(tb testing.TB, b *lsmkv.Bucket, i int) {
+				require.NoError(tb, b.SetAdd(iteratorKey(i), [][]byte{[]byte(fmt.Sprintf("value-%06d", i))}))
+			},
+			newCurs: func(_ context.Context, b *lsmkv.Bucket) func() Cursor {
+				return func() Cursor { return SetCursor{b.SetCursor()} }
+			},
+		},
+		{
+			name:     "roaring set",
+			strategy: lsmkv.StrategyRoaringSet,
+			put: func(tb testing.TB, b *lsmkv.Bucket, i int) {
+				require.NoError(tb, b.RoaringSetAddOne(iteratorKey(i), uint64(i)))
+			},
+			newCurs: func(ctx context.Context, b *lsmkv.Bucket) func() Cursor {
+				// the call sites hand the query's context to the cursor, so do the same
+				return func() Cursor { return RoaringCursor{b.CursorRoaringSetCtx(ctx)} }
+			},
+		},
+	}
+}
+
+func iteratorKey(i int) []byte {
+	return []byte(fmt.Sprintf("key-%06d", i))
+}
+
+// TestIteratorConcurrentlyStopsWhenTheCallerGivesUp pins that an aggregation
+// whose client has hung up stops scanning, in every strategy and both branches.
+func TestIteratorConcurrentlyStopsWhenTheCallerGivesUp(t *testing.T) {
+	for _, bs := range iteratorStrategies() {
+		// A flushed bucket has disk segments, so QuantileKeys seeds the parallel
+		// branches; an unflushed one has none and takes the single-cursor branch.
+		for _, flush := range []bool{false, true} {
+			t.Run(fmt.Sprintf("%s/flushed=%v", bs.name, flush), func(t *testing.T) {
+				ctx := context.Background()
+				logger, _ := test.NewNullLogger()
+				b := bucketFixture(t, ctx, bs, iteratorCancelKeyCount, flush)
+
+				seeds := b.QuantileKeys(2 * runtime.GOMAXPROCS(0))
+				if flush {
+					require.NotEmpty(t, seeds, "flushed keys must seed the parallel branches")
+				} else {
+					require.Empty(t, seeds, "unflushed keys must take the single-cursor branch")
+				}
+
+				scanCtx, cancel := context.WithCancel(ctx)
+				defer cancel()
+
+				var seen atomic.Int64
+				err := iteratorConcurrently(scanCtx, b, bs.newCurs(scanCtx, b),
+					func(k, v []byte, vv [][]byte, bi *sroar.Bitmap) error {
+						if seen.Add(1) == 1 {
+							cancel()
+						}
+						return nil
+					}, logger)
+
+				require.ErrorIs(t, err, context.Canceled)
+				require.Less(t, seen.Load(), int64(iteratorCancelKeyCount),
+					"the scan must stop early, not run to the end")
+			})
+		}
+	}
+}
+
+// TestIteratorConcurrentlyScansEverythingForACallerThatStays is the control:
+// the check must not cut a live scan short.
+func TestIteratorConcurrentlyScansEverythingForACallerThatStays(t *testing.T) {
+	for _, bs := range iteratorStrategies() {
+		for _, flush := range []bool{false, true} {
+			t.Run(fmt.Sprintf("%s/flushed=%v", bs.name, flush), func(t *testing.T) {
+				ctx := context.Background()
+				logger, _ := test.NewNullLogger()
+				b := bucketFixture(t, ctx, bs, iteratorCancelKeyCount, flush)
+
+				var seen atomic.Int64
+				err := iteratorConcurrently(ctx, b, bs.newCurs(ctx, b),
+					func(k, v []byte, vv [][]byte, bi *sroar.Bitmap) error {
+						seen.Add(1)
+						return nil
+					}, logger)
+
+				require.NoError(t, err)
+				require.Equal(t, int64(iteratorCancelKeyCount), seen.Load())
+			})
+		}
+	}
+}
+
+// bucketFixture builds a buck
```

---

### Incident Patch 3: `c4143c5f` (2026-10-05)
**Commit Message**: Merge pull request #13392 from weaviate/fix-generative-digitalocean-env-var-support

fix(generative-digitalocean): add env var support and model list validation

**File**: `modules/generative-digitalocean/clients/digitalocean.go` (modified, +6/-0)
```diff
@@ -28,6 +28,7 @@ import (
 	"github.com/weaviate/weaviate/entities/moduletools"
 	"github.com/weaviate/weaviate/modules/generative-digitalocean/config"
 	digitaloceanparams "github.com/weaviate/weaviate/modules/generative-digitalocean/parameters"
+	"github.com/weaviate/weaviate/usecases/build"
 	"github.com/weaviate/weaviate/usecases/modulecomponents"
 	"github.com/weaviate/weaviate/usecases/modulecomponents/generative"
 	"github.com/weaviate/weaviate/usecases/monitoring"
@@ -100,6 +101,11 @@ func (c *client) doGenerate(ctx context.Context, cfg moduletools.ClassConfig, pr
 
 	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", key))
 	req.Header.Set("Content-Type", "application/json")
+	if weaviateUUID := config.NewClassSettings(cfg).WeaviateUUID(); weaviateUUID != "" {
+		req.Header.Set("User-Agent", fmt.Sprintf("vector-db/weaviate/%s %s", weaviateUUID, build.Version))
+	} else {
+		req.Header.Set("User-Agent", fmt.Sprintf("vector-db/weaviate/unknown %s", build.Version))
+	}
 
 	res, err := c.httpClient.Do(req)
 	if res != nil {
```

**File**: `modules/generative-digitalocean/clients/digitalocean_test.go` (modified, +42/-0)
```diff
@@ -14,9 +14,11 @@ package clients
 import (
 	"context"
 	"encoding/json"
+	"fmt"
 	"io"
 	"net/http"
 	"net/http/httptest"
+	"strings"
 	"testing"
 	"time"
 
@@ -26,6 +28,7 @@ import (
 	"github.com/stretchr/testify/require"
 	"github.com/weaviate/weaviate/entities/modulecapabilities"
 	digitaloceanparams "github.com/weaviate/weaviate/modules/generative-digitalocean/parameters"
+	"github.com/weaviate/weaviate/usecases/build"
 )
 
 func nullLogger() logrus.FieldLogger {
@@ -267,6 +270,45 @@ func TestGenerateRequest(t *testing.T) {
 	}
 }
 
+func TestGenerateUserAgent(t *testing.T) {
+	tests := []struct {
+		name         string
+		weaviateUUID string
+		expected     string
+	}{
+		{
+			name:         "uuid set",
+			weaviateUUID: "test-uuid",
+			expected:     fmt.Sprintf("vector-db/weaviate/test-uuid %s", build.Version),
+		},
+		{
+			name:     "uuid not set",
+			expected: fmt.Sprintf("vector-db/weaviate/unknown %s", build.Version),
+		},
+	}
+
+	properties := []*modulecapabilities.GenerateProperties{{Text: map[string]string{"prop": "value"}}}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Setenv("VECTOR_DB_UUID", tt.weaviateUUID)
+
+			var gotUserAgent string
+			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				gotUserAgent = r.Header.Get("User-Agent")
+				w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"ok"}}]}`))
+			}))
+			defer server.Close()
+
+			c := New("key", time.Minute, nullLogger())
+			params := digitaloceanparams.Params{BaseURL: server.URL}
+			_, err := c.GenerateAllResults(context.Background(), properties, "task", params, false, nil)
+			require.NoError(t, err)
+			assert.Equal(t, strings.TrimSpace(tt.expected), gotUserAgent)
+		})
+	}
+}
+
 func TestMetaInfo(t *testing.T) {
 	meta, err := New("key", 0, nullLogger()).MetaInfo()
 	require.NoError(t, err)
```

**File**: `modules/generative-digitalocean/clients/models.go` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
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
+package clients
+
+import (
+	"time"
+
+	"github.com/weaviate/weaviate/modules/generative-digitalocean/config"
+	"github.com/weaviate/weaviate/usecases/modulecomponents/clients/digitalocean"
+)
+
+// init registers the default model lister with the config package so that
+// ValidateClass can call out to DigitalOcean without config depending on this
+// package.
+func init() {
+	config.DefaultModelLister = digitalocean.NewModelLister(30 * time.Second)
+}
```

**File**: `modules/generative-digitalocean/config.go` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ func (m *GenerativeDigitalOceanModule) ValidateClass(ctx context.Context,
 	class *models.Class, cfg moduletools.ClassConfig,
 ) error {
 	settings := config.NewClassSettings(cfg)
-	return settings.Validate(class)
+	return settings.Validate(ctx, class)
 }
 
 var _ = modulecapabilities.ClassConfigurator(New())
```

**File**: `modules/generative-digitalocean/config/class_settings.go` (modified, +51/-1)
```diff
@@ -12,6 +12,11 @@
 package config
 
 import (
+	"context"
+	"fmt"
+	"os"
+	"slices"
+
 	"github.com/pkg/errors"
 	"github.com/weaviate/weaviate/entities/models"
 	"github.com/weaviate/weaviate/entities/moduletools"
@@ -34,6 +39,18 @@ var (
 	DefaultModel   = "llama-4-maverick"
 )
 
+// ModelLister returns the set of available model ids from a DigitalOcean
+// Serverless Inference endpoint. It is implemented in the clients package and
+// injected here through DefaultModelLister to keep config free of HTTP-client
+// dependencies. Tests can override DefaultModelLister with a fake.
+type ModelLister interface {
+	ListModels(ctx context.Context, baseURL, apiKey string, weaviateUUID string) ([]string, error)
+}
+
+// DefaultModelLister is the lister used by Validate. The clients package
+// registers an HTTP-backed implementation at init time.
+var DefaultModelLister ModelLister
+
 type classSettings struct {
 	cfg                  moduletools.ClassConfig
 	propertyValuesHelper basesettings.PropertyValuesHelper
@@ -43,7 +60,9 @@ func NewClassSettings(cfg moduletools.ClassConfig) *classSettings {
 	return &classSettings{cfg: cfg, propertyValuesHelper: basesettings.NewPropertyValuesHelper("generative-digitalocean")}
 }
 
-func (ic *classSettings) Validate(class *models.Class) error {
+// Validate checks the class config and, when DIGITALOCEAN_APIKEY is set,
+// checks the model against the endpoint's /v1/models list.
+func (ic *classSettings) Validate(ctx context.Context, class *models.Class) error {
 	if ic.cfg == nil {
 		// we would receive a nil-config on cross-class requests, such as Explore{}
 		return errors.New("empty config")
@@ -66,9 +85,40 @@ func (ic *classSettings) Validate(class *models.Class) error {
 	if presencePenalty := ic.PresencePenalty(); presencePenalty != nil && (*presencePenalty < -2 || *presencePenalty > 2) {
 		return errors.New("wrong presencePenalty configuration, values are between -2.0 and 2.0")
 	}
+
+	lister := DefaultModelLister
+	apiKey := ic.apiKey()
+	if lister == nil || apiKey == "" {
+		// Without a server-side API key the model can't be checked against
+		// /v1/models; the endpoint rejects an unknown model at generate time,
+		// where users can supply their own key via X-Digitalocean-Api-Key.
+		return nil
+	}
+
+	if model := ic.Model(); model != "" {
+		available, err := lister.ListModels(ctx, ic.BaseURL(), apiKey, ic.WeaviateUUID())
+		if err != nil {
+			return errors.Wrap(err, "list DigitalOcean models")
+		}
+		if !slices.Contains(available, model) {
+			return fmt.Errorf("model %q is not available on the DigitalOcean Serverless Inference endpoint; available models: %v", model, available)
+		}
+	}
 	return nil
 }
 
+// apiKey resolves the DigitalOcean API key from the DIGITALOCEAN_APIKEY
+// environment variable. The model check runs at collection-create time, where the
+// per-request header is not available, so only the server-level env var is
+// consulted.
+func (ic *classSettings) apiKey() string {
+	return os.Getenv("DIGITALOCEAN_APIKEY")
+}
+
+func (ic *classSettings) WeaviateUUID() string {
+	return os.Getenv("VECTOR_DB_UUID")
+}
+
 func (ic *classSettings) BaseURL() string {
 	return ic.propertyValuesHelper.GetPropertyAsString(ic.cfg, baseURLProperty, DefaultBaseURL)
 }
```

**File**: `modules/generative-digitalocean/config/class_settings_test.go` (modified, +12/-1)
```diff
@@ -12,10 +12,12 @@
 package config
 
 import (
+	"context"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
+	"github.com/weaviate/weaviate/entities/models"
 	"github.com/weaviate/weaviate/entities/moduletools"
 	"github.com/weaviate/weaviate/entities/schema"
 	"github.com/weaviate/weaviate/usecases/config"
@@ -103,7 +105,7 @@ func TestClassSettings(t *testing.T) {
 		t.Run(tt.name, func(t *testing.T) {
 			settings := NewClassSettings(tt.cfg)
 
-			err := settings.Validate(nil)
+			err := settings.Validate(context.Background(), &models.Class{Class: "Test"})
 			if tt.expectedErr != "" {
 				require.Error(t, err)
 				assert.Contains(t, err.Error(), tt.expectedErr)
@@ -123,6 +125,15 @@ func TestClassSettings(t *testing.T) {
 	}
 }
 
+func TestClassSettingsEnvVars(t *testing.T) {
+	t.Setenv("DIGITALOCEAN_APIKEY", "dop_v1_test")
+	t.Setenv("VECTOR_DB_UUID", "test-uuid")
+
+	settings := NewClassSettings(fakeClassConfig{})
+	assert.Equal(t, "dop_v1_test", settings.apiKey())
+	assert.Equal(t, "test-uuid", settings.WeaviateUUID())
+}
+
 func ptr[T any](v T) *T {
 	return &v
 }
```

**File**: `modules/generative-digitalocean/config_test.go` (added, +131/-0)
```diff
@@ -0,0 +1,131 @@
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
+package modgenerativedigitalocean
+
+import (
+	"context"
+	"errors"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+
+	"github.com/weaviate/weaviate/entities/models"
+	"github.com/weaviate/weaviate/entities/schema"
+	"github.com/weaviate/weaviate/modules/generative-digitalocean/config"
+	usecasesconfig "github.com/weaviate/weaviate/usecases/config"
+)
+
+func TestValidateClass(t *testing.T) {
+	tests := []struct {
+		name          string
+		cfg           fakeClassConfig
+		lister        *fakeModelLister
+		apiKeyEnv     string
+		expectedErr   string
+		wantNoListing bool
+	}{
+		{
+			name:      "model available",
+			cfg:       fakeClassConfig{"model": "llama-4-maverick"},
+			lister:    &fakeModelLister{models: []string{"llama-4-maverick"}},
+			apiKeyEnv: "dop_v1_test",
+		},
+		{
+			name:          "api key missing skips the model check",
+			cfg:           fakeClassConfig{"model": "retired-model"},
+			lister:        &fakeModelLister{models: []string{"llama-4-maverick"}},
+			wantNoListing: true,
+		},
+		{
+			name:          "empty model skips the model check",
+			cfg:           fakeClassConfig{"model": ""},
+			lister:        &fakeModelLister{models: []string{"llama-4-maverick"}},
+			apiKeyEnv:     "dop_v1_test",
+			wantNoListing: true,
+		},
+		{
+			name:        "model not available",
+			cfg:         fakeClassConfig{"model": "retired-model"},
+			lister:      &fakeModelLister{models: []string{"llama-4-maverick"}},
+			apiKeyEnv:   "dop_v1_test",
+			expectedErr: `model "retired-model" is not available`,
+		},
+		{
+			name:        "lister error",
+			cfg:         fakeClassConfig{"model": "llama-4-maverick"},
+			lister:      &fakeModelLister{err: errors.New("endpoint unreachable")},
+			apiKeyEnv:   "dop_v1_test",
+			expectedErr: "list DigitalOcean models: endpoint unreachable",
+		},
+		{
+			name:          "invalid local config fails before the model check",
+			cfg:           fakeClassConfig{"temperature": 3.0},
+			lister:        &fakeModelLister{models: []string{"llama-4-maverick"}},
+			apiKeyEnv:     "dop_v1_test",
+			expectedErr:   "wrong temperature configuration",
+			wantNoListing: true,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Setenv("DIGITALOCEAN_APIKEY", tt.apiKeyEnv)
+
+			prev := config.DefaultModelLister
+			config.DefaultModelLister = tt.lister
+			t.Cleanup(func() { config.DefaultModelLister = prev })
+
+			m := &GenerativeDigitalOceanModule{}
+			err := m.ValidateClass(context.Background(), &models.Class{Class: "Test"}, tt.cfg)
+			if tt.expectedErr != "" {
+				require.Error(t, err)
+				assert.Contains(t, err.Error(), tt.expectedErr)
+			} else {
+				require.NoError(t, err)
+			}
+			if tt.wantNoListing {
+				assert.Zero(t, tt.lister.calls)
+			}
+		})
+	}
+}
+
+type fakeModelLister struct {
+	models []string
+	err    error
+	calls  int
+}
+
+func (f *fakeModelLister) ListModels(_ context.Context, _, _, _ string) ([]string, error) {
+	f.calls++
+	if f.err != nil {
+		return nil, f.err
+	}
+	return f.models, nil
+}
+
+type fakeClassConfig map[string]any
+
+func (f fakeClassConfig) Class() map[string]any { return f }
+
+func (f fakeClassConfig) Tenant() string { return "" }
+
+func (f fakeClassConfig) ClassByModuleName(moduleName string) map[string]any { return f }
+
+func (f fakeClassConfig) Property(propName string) map[string]any { return nil }
+
+func (f fakeClassConfig) TargetVector() string { return "" }
+
+func (f fakeClassConfig) PropertiesDataTypes() map[string]schema.DataType { return nil }
+
+func (f fakeClassConfig) Config() *usecasesconfig.Config { return nil }
```

**File**: `modules/text2vec-digitalocean/clients/models.go` (modified, +2/-133)
```diff
@@ -12,146 +12,15 @@
 package clients
 
 import (
-	"context"
-	"crypto/sha256"
-	"encoding/json"
-	"fmt"
-	"io"
-	"net/http"
-	"net/url"
-	"sync"
 	"time"
 
-	"github.com/pkg/errors"
-
 	"github.com/weaviate/weaviate/modules/text2vec-digitalocean/ent"
-	"github.com/weaviate/weaviate/usecases/build"
-	"github.com/weaviate/weaviate/usecases/modulecomponents"
+	"github.com/weaviate/weaviate/usecases/modulecomponents/clients/digitalocean"
 )
 
-// modelCacheTTL controls how long a successful /v1/models response is cached
-// per (baseURL, apiKey-hash). The DigitalOcean model catalogue changes rarely
-// and Validate is called every time a collection is created or its module
-// config changes, so a short TTL is a reasonable trade-off between freshness
-// and avoiding excessive calls.
-const modelCacheTTL = 5 * time.Minute
-
-type modelListResponse struct {
-	Object string             `json:"object"`
-	Data   []modelListItem    `json:"data"`
-	Error  *digitalOceanError `json:"error,omitempty"`
-}
-
-type modelListItem struct {
-	ID      string `json:"id"`
-	Object  string `json:"object"`
-	OwnedBy string `json:"owned_by"`
-	Created int64  `json:"created"`
-}
-
-type modelCacheEntry struct {
-	models    []string
-	fetchedAt time.Time
-}
-
-// ModelLister fetches the model catalogue from a DigitalOcean Serverless
-// Inference endpoint and caches the result in-memory.
-type ModelLister struct {
-	httpClient *http.Client
-
-	mu    sync.Mutex
-	cache map[string]modelCacheEntry
-}
-
-func NewModelLister(timeout time.Duration) *ModelLister {
-	return &ModelLister{
-		httpClient: modulecomponents.NewBaseHttpClient(timeout),
-		cache:      map[string]modelCacheEntry{},
-	}
-}
-
-func (l *ModelLister) ListModels(ctx context.Context, baseURL, apiKey, weaviateUUID string) ([]string, error) {
-	cacheKey := l.cacheKey(baseURL, apiKey)
-
-	l.mu.Lock()
-	if entry, ok := l.cache[cacheKey]; ok && time.Since(entry.fetchedAt) < modelCacheTTL {
-		l.mu.Unlock()
-		return entry.models, nil
-	}
-	l.mu.Unlock()
-
-	models, err := l.fetch(ctx, baseURL, apiKey, weaviateUUID)
-	if err != nil {
-		return nil, err
-	}
-
-	l.mu.Lock()
-	l.cache[cacheKey] = modelCacheEntry{models: models, fetchedAt: time.Now()}
-	l.mu.Unlock()
-
-	return models, nil
-}
-
-func (l *ModelLister) fetch(ctx context.Context, baseURL, apiKey, weaviateUUID string) ([]string, error) {
-	endpoint, err := url.JoinPath(baseURL, "/v1/models")
-	if err != nil {
-		return nil, errors.Wrap(err, "build /v1/models URL")
-	}
-
-	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
-	if err != nil {
-		return nil, errors.Wrap(err, "create GET request")
-	}
-	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
-	req.Header.Set("Content-Type", "application/json")
-	if weaviateUUID != "" {
-		req.Header.Set("User-Agent", fmt.Sprintf("vector-db/weaviate/%s %s", weaviateUUID, build.Version))
-	} else {
-		req.Header.Set("User-Agent", fmt.Sprintf("vector-db/weaviate/unknown %s", build.Version))
-	}
-
-	res, err := l.httpClient.Do(req)
-	if err != nil {
-		return nil, errors.Wrap(err, "send GET request")
-	}
-	defer res.Body.Close()
-
-	body, err := io.ReadAll(res.Body)
-	if err != nil {
-		return nil, errors.Wrap(err, "read response body")
-	}
-
-	var parsed modelListResponse
-	if err := json.Unmarshal(body, &parsed); err != nil {
-		return nil, fmt.Errorf("failed to parse /v1/models response (status %d): %w", res.StatusCode, err)
-	}
-
-	if res.StatusCode != http.StatusOK || parsed.Error != nil {
-		msg := fmt.Sprintf("DigitalOcean /v1/models returned status %d", res.StatusCode)
-		if parsed.Error != nil && parsed.Error.Message != "" {
-			msg = fmt.Sprintf("%s: %s", msg, parsed.Error.Message)
-		}
-		return nil, errors.New(msg)
-	}
-
-	ids := make([]string, 0, len(parsed.Data))
-	for _, m := range parsed.Data {
-		if m.ID == "" {
-			continue
-		}
-		ids = append(ids, m.ID)
-	}
-	return ids, nil
-}
-
-func (l *ModelLister) cacheKey(baseURL, apiKey string) string {
-	h := sha256.Sum256([]byte(apiKey))
-	return fmt.Sprintf("%s|%x", baseURL, h)
-}
-
 // init registers the default model lister with the ent package so that
 // ValidateClass can call out to DigitalOcean without ent depending on this
 // package.
 func init() {
-	ent.DefaultModelLister = NewModelLister(30 * time.Second)
+	ent.DefaultModelLister = digitalocean.NewModelLister(30 * time.Second)
 }
```

---

### Incident Patch 4: `a7e67845` (2026-10-02)
**Commit Message**: [api] fix(generative-digitalocean): restore hard failure on model check for parity with text2vec

**File**: `modules/generative-digitalocean/clients/models.go` (modified, +2/-3)
```diff
@@ -20,8 +20,7 @@ import (
 
 // init registers the default model lister with the config package so that
 // ValidateClass can call out to DigitalOcean without config depending on this
-// package. The timeout is short because the model check only warns, and it
-// also runs during backup restore.
+// package.
 func init() {
-	config.DefaultModelLister = digitalocean.NewModelLister(5 * time.Second)
+	config.DefaultModelLister = digitalocean.NewModelLister(30 * time.Second)
 }
```

**File**: `modules/generative-digitalocean/config.go` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ func (m *GenerativeDigitalOceanModule) ValidateClass(ctx context.Context,
 	class *models.Class, cfg moduletools.ClassConfig,
 ) error {
 	settings := config.NewClassSettings(cfg)
-	return settings.Validate(ctx, class, m.logger)
+	return settings.Validate(ctx, class)
 }
 
 var _ = modulecapabilities.ClassConfigurator(New())
```

**File**: `modules/generative-digitalocean/config/class_settings.go` (modified, +12/-14)
```diff
@@ -13,11 +13,11 @@ package config
 
 import (
 	"context"
+	"fmt"
 	"os"
 	"slices"
 
 	"github.com/pkg/errors"
-	"github.com/sirupsen/logrus"
 	"github.com/weaviate/weaviate/entities/models"
 	"github.com/weaviate/weaviate/entities/moduletools"
 	basesettings "github.com/weaviate/weaviate/usecases/modulecomponents/settings"
@@ -60,11 +60,9 @@ func NewClassSettings(cfg moduletools.ClassConfig) *classSettings {
 	return &classSettings{cfg: cfg, propertyValuesHelper: basesettings.NewPropertyValuesHelper("generative-digitalocean")}
 }
 
-// Validate checks the class config. It also checks the model against the
-// endpoint's /v1/models list, but only logs a warning when the model is
-// missing or the list can't be fetched: that check depends on a remote
-// service, so it must not block collection creation or backup restore.
-func (ic *classSettings) Validate(ctx context.Context, class *models.Class, logger logrus.FieldLogger) error {
+// Validate checks the class config and, when DIGITALOCEAN_APIKEY is set,
+// checks the model against the endpoint's /v1/models list.
+func (ic *classSettings) Validate(ctx context.Context, class *models.Class) error {
 	if ic.cfg == nil {
 		// we would receive a nil-config on cross-class requests, such as Explore{}
 		return errors.New("empty config")
@@ -97,14 +95,14 @@ func (ic *classSettings) Validate(ctx context.Context, class *models.Class, logg
 		return nil
 	}
 
-	model := ic.Model()
-	available, err := lister.ListModels(ctx, ic.BaseURL(), apiKey, ic.WeaviateUUID())
-	if err != nil {
-		logger.Warnf("collection %q: failed to list DigitalOcean models: %v", class.Class, err)
-		return nil
-	}
-	if !slices.Contains(available, model) {
-		logger.Warnf("collection %q: model %q is not available on the DigitalOcean Serverless Inference endpoint; available models: %v", class.Class, model, available)
+	if model := ic.Model(); model != "" {
+		available, err := lister.ListModels(ctx, ic.BaseURL(), apiKey, ic.WeaviateUUID())
+		if err != nil {
+			return errors.Wrap(err, "list DigitalOcean models")
+		}
+		if !slices.Contains(available, model) {
+			return fmt.Errorf("model %q is not available on the DigitalOcean Serverless Inference endpoint; available models: %v", model, available)
+		}
 	}
 	return nil
 }
```

**File**: `modules/generative-digitalocean/config/class_settings_test.go` (modified, +1/-3)
```diff
@@ -15,7 +15,6 @@ import (
 	"context"
 	"testing"
 
-	"github.com/sirupsen/logrus/hooks/test"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	"github.com/weaviate/weaviate/entities/models"
@@ -105,9 +104,8 @@ func TestClassSettings(t *testing.T) {
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
 			settings := NewClassSettings(tt.cfg)
-			logger, _ := test.NewNullLogger()
 
-			err := settings.Validate(context.Background(), &models.Class{Class: "Test"}, logger)
+			err := settings.Validate(context.Background(), &models.Class{Class: "Test"})
 			if tt.expectedErr != "" {
 				require.Error(t, err)
 				assert.Contains(t, err.Error(), tt.expectedErr)
```

**File**: `modules/generative-digitalocean/config_test.go` (modified, +31/-36)
```diff
@@ -16,8 +16,6 @@ import (
 	"errors"
 	"testing"
 
-	"github.com/sirupsen/logrus"
-	"github.com/sirupsen/logrus/hooks/test"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 
@@ -29,12 +27,12 @@ import (
 
 func TestValidateClass(t *testing.T) {
 	tests := []struct {
-		name        string
-		cfg         fakeClassConfig
-		lister      *fakeModelLister
-		apiKeyEnv   string
-		expectedErr string
-		expectedLog string
+		name          string
+		cfg           fakeClassConfig
+		lister        *fakeModelLister
+		apiKeyEnv     string
+		expectedErr   string
+		wantNoListing bool
 	}{
 		{
 			name:      "model available",
@@ -43,30 +41,39 @@ func TestValidateClass(t *testing.T) {
 			apiKeyEnv: "dop_v1_test",
 		},
 		{
-			name:   "api key missing skips the model check",
-			cfg:    fakeClassConfig{"model": "retired-model"},
-			lister: &fakeModelLister{models: []string{"llama-4-maverick"}},
+			name:          "api key missing skips the model check",
+			cfg:           fakeClassConfig{"model": "retired-model"},
+			lister:        &fakeModelLister{models: []string{"llama-4-maverick"}},
+			wantNoListing: true,
 		},
 		{
-			name:        "model not available only warns",
+			name:          "empty model skips the model check",
+			cfg:           fakeClassConfig{"model": ""},
+			lister:        &fakeModelLister{models: []string{"llama-4-maverick"}},
+			apiKeyEnv:     "dop_v1_test",
+			wantNoListing: true,
+		},
+		{
+			name:        "model not available",
 			cfg:         fakeClassConfig{"model": "retired-model"},
 			lister:      &fakeModelLister{models: []string{"llama-4-maverick"}},
 			apiKeyEnv:   "dop_v1_test",
-			expectedLog: `model "retired-model" is not available`,
+			expectedErr: `model "retired-model" is not available`,
 		},
 		{
-			name:        "lister error only warns",
+			name:        "lister error",
 			cfg:         fakeClassConfig{"model": "llama-4-maverick"},
 			lister:      &fakeModelLister{err: errors.New("endpoint unreachable")},
 			apiKeyEnv:   "dop_v1_test",
-			expectedLog: "endpoint unreachable",
+			expectedErr: "list DigitalOcean models: endpoint unreachable",
 		},
 		{
-			name:        "invalid local config still fails",
-			cfg:         fakeClassConfig{"temperature": 3.0},
-			lister:      &fakeModelLister{models: []string{"llama-4-maverick"}},
-			apiKeyEnv:   "dop_v1_test",
-			expectedErr: "wrong temperature configuration",
+			name:          "invalid local config fails before the model check",
+			cfg:           fakeClassConfig{"temperature": 3.0},
+			lister:        &fakeModelLister{models: []string{"llama-4-maverick"}},
+			apiKeyEnv:     "dop_v1_test",
+			expectedErr:   "wrong temperature configuration",
+			wantNoListing: true,
 		},
 	}
 
@@ -78,29 +85,17 @@ func TestValidateClass(t *testing.T) {
 			config.DefaultModelLister = tt.lister
 			t.Cleanup(func() { config.DefaultModelLister = prev })
 
-			logger, hook := test.NewNullLogger()
-			m := &GenerativeDigitalOceanModule{logger: logger}
-
+			m := &GenerativeDigitalOceanModule{}
 			err := m.ValidateClass(context.Background(), &models.Class{Class: "Test"}, tt.cfg)
 			if tt.expectedErr != "" {
 				require.Error(t, err)
 				assert.Contains(t, err.Error(), tt.expectedErr)
-				assert.Empty(t, hook.AllEntries())
-				return
+			} else {
+				require.NoError(t, err)
 			}
-			require.NoError(t, err)
-
-			if tt.apiKeyEnv == "" {
+			if tt.wantNoListing {
 				assert.Zero(t, tt.lister.calls)
 			}
-			if tt.expectedLog == "" {
-				assert.Empty(t, hook.AllEntries())
-				return
-			}
-			require.Len(t, hook.AllEntries(), 1)
-			assert.Equal(t, logrus.WarnLevel, hook.LastEntry().Level)
-			assert.Contains(t, hook.LastEntry().Message, tt.expectedLog)
-			assert.Contains(t, hook.LastEntry().Message, `collection "Test"`)
 		})
 	}
 }
```

**File**: `modules/generative-digitalocean/module.go` (modified, +0/-2)
```diff
@@ -33,7 +33,6 @@ func New() *GenerativeDigitalOceanModule {
 type GenerativeDigitalOceanModule struct {
 	generative                   generativeClient
 	additionalPropertiesProvider map[string]modulecapabilities.GenerativeProperty
-	logger                       logrus.FieldLogger
 }
 
 type generativeClient interface {
@@ -66,7 +65,6 @@ func (m *GenerativeDigitalOceanModule) initAdditional(ctx context.Context, timeo
 
 	client := clients.New(apiKey, timeout, logger)
 	m.generative = client
-	m.logger = logger
 	m.additionalPropertiesProvider = parameters.AdditionalGenerativeParameters(m.generative)
 
 	return nil
```

---

### Incident Patch 5: `d68e762b` (2026-10-02)
**Commit Message**: fix(hnsw): exclude HFresh's centroid index from the node ID limit explicitly

Its node IDs are posting IDs, not document IDs. It escaped the limit only
because its directory holds no counter file; the index now says so.

**File**: `adapters/repos/db/vector/hnsw/index.go` (modified, +2/-0)
```diff
@@ -202,6 +202,7 @@ type hnsw struct {
 	store                 *lsmkv.Store
 
 	allocChecker              memwatch.AllocChecker
+	hfreshMode                bool
 	tombstoneMemCheckInterval time.Duration
 	tombstoneCleanupRunning   atomic.Bool
 
@@ -400,6 +401,7 @@ func New(cfg Config, uc ent.UserConfig,
 
 		store:                     store,
 		allocChecker:              cfg.AllocChecker,
+		hfreshMode:                cfg.HFreshMode,
 		tombstoneMemCheckInterval: 500 * time.Millisecond,
 		visitedListPoolMaxSize:    cfg.VisitedListPoolMaxSize,
 		asyncIndexingEnabled:      cfg.AsyncIndexingEnabled,
```

**File**: `adapters/repos/db/vector/hnsw/index_test.go` (modified, +3/-0)
```diff
@@ -598,11 +598,13 @@ func TestRestoreFromDisk_NodeIDBeyondDocIDCounter(t *testing.T) {
 		counterFile   bool
 		counter       uint64
 		multivector   ent.MultivectorConfig
+		hfresh        bool
 		wantTruncated bool
 	}{
 		{name: "beyond the counter and its slack", counterFile: true, counter: counter, wantTruncated: true},
 		{name: "muvera node IDs are document IDs", counterFile: true, counter: counter, multivector: muvera, wantTruncated: true},
 		{name: "multivector node IDs are not document IDs", counterFile: true, counter: counter, multivector: multivector},
+		{name: "hfresh centroid node IDs are not document IDs", counterFile: true, counter: counter, hfresh: true},
 		{name: "zero counter means no limit", counterFile: true, counter: 0},
 		{name: "no counter file means no limit"},
 	}
@@ -612,6 +614,7 @@ func TestRestoreFromDisk_NodeIDBeyondDocIDCounter(t *testing.T) {
 			cfg := createVectorHnswIndexTestConfig()
 			cfg.RootPath = t.TempDir()
 			cfg.MultiVectorForIDThunk = testMultiVectorForID
+			cfg.HFreshMode = tc.hfresh
 			if tc.counterFile {
 				writeDocIDCounterForTest(t, cfg.RootPath, tc.counter)
 			}
```

**File**: `adapters/repos/db/vector/hnsw/startup.go` (modified, +3/-3)
```diff
@@ -82,9 +82,9 @@ func (h *hnsw) restoreFromDisk() error {
 	loader := compact.NewLoader(compact.LoaderConfig{
 		Dir:    dir,
 		Logger: h.logger,
-		// Multivector indexes without Muvera number their nodes separately.
-		// HFresh's centroid index lives in a subdirectory without the counter.
-		NodeIDsAreDocIDs: !h.multivector.Load() || h.muvera.Load(),
+		// Multivector indexes without Muvera number their nodes separately, and
+		// HFresh's centroid index numbers them by posting ID.
+		NodeIDsAreDocIDs: !h.hfreshMode && (!h.multivector.Load() || h.muvera.Load()),
 	})
 
 	loadResult, err := loader.Load()
```

---

### Incident Patch 6: `cbab8afb` (2026-10-02)
**Commit Message**: fix(compact): save the tail a node-ID truncation drops

The limit comes from the document-ID counter, so a wrong counter would
otherwise cut valid records for good. The dropped tail is now copied to
<file>.<offset>.corrupt and fsynced before truncating, and the log names the
offset, the bytes dropped and the copy. If the copy fails, the load fails
and the file stays as it is.

**File**: `adapters/repos/db/vector/hnsw/compact/crash_recovery_test.go` (modified, +24/-1)
```diff
@@ -1675,13 +1675,17 @@ func TestCrashRecovery_NodeIDBeyondLimitIsNeverApplied(t *testing.T) {
 				dir := nodeIDLimitTestDir(t)
 				path := filepath.Join(dir, nodeIDLimitTestName(fileType))
 				writeNodeIDLimitFixture(t, path, fileType)
-				appendToFile(t, path, walBytes(t, func(w *WALWriter) { require.NoError(t, rec.write(w)) }))
+				tail := walBytes(t, func(w *WALWriter) { require.NoError(t, rec.write(w)) })
+				appendToFile(t, path, tail)
 
 				first := load(dir)
 				assert.True(t, first.RecoveredFromCrash, "a node ID beyond the limit must be detected as corruption")
 				assert.Less(t, len(first.State.Graph.Nodes), g, "node index sized to the garbage ID")
 				assertGraphEqual(t, clean.State, first.State)
 				require.Equal(t, cleanSize, fileSizeOf(t, path), "file must be truncated before the record")
+				saved, err := os.ReadFile(fmt.Sprintf("%s.%d.corrupt", path, cleanSize))
+				require.NoError(t, err, "the dropped tail must be saved")
+				require.Equal(t, tail, saved)
 
 				second := load(dir)
 				assert.False(t, second.RecoveredFromCrash, "second load must be clean after truncation")
@@ -1746,3 +1750,22 @@ func TestCrashRecovery_NodeIDBeyondLimitDoesNotPresizeSnapshot(t *testing.T) {
 	require.NotNil(t, nodeAt(res.State, 7), "records before the corruption must survive")
 	assert.Equal(t, validSize, fileSizeOf(t, rawPath), "raw log must be truncated before the record")
 }
+
+// TestCrashRecovery_NodeIDBeyondLimitKeepsFileWhenTailCannotBeSaved pins that
+// a truncation the counter decides never happens without a copy: when the
+// dropped tail cannot be saved, the load fails and the file stays as it is.
+func TestCrashRecovery_NodeIDBeyondLimitKeepsFileWhenTailCannotBeSaved(t *testing.T) {
+	dir := nodeIDLimitTestDir(t)
+	path := filepath.Join(dir, "1000")
+	writeNodeIDLimitFixture(t, path, FileTypeRaw)
+	validSize := fileSizeOf(t, path)
+	appendToFile(t, path, walBytes(t, func(w *WALWriter) { require.NoError(t, w.WriteAddNode(nodeIDLimitTestGarbage, 0)) }))
+	size := fileSizeOf(t, path)
+
+	// A directory where the saved tail would go makes saving it fail.
+	require.NoError(t, os.Mkdir(fmt.Sprintf("%s.%d.corrupt", path, validSize), 0o755))
+
+	_, err := NewLoader(LoaderConfig{Dir: dir, Logger: quietLogger(), NodeIDsAreDocIDs: true}).Load()
+	require.Error(t, err)
+	assert.Equal(t, size, fileSizeOf(t, path), "file must not be truncated without a saved copy")
+}
```

**File**: `adapters/repos/db/vector/hnsw/compact/loader.go` (modified, +48/-4)
```diff
@@ -12,7 +12,9 @@
 package compact
 
 import (
+	"fmt"
 	"io"
+	"os"
 	"path/filepath"
 	"sort"
 
@@ -284,12 +286,22 @@ func (l *Loader) loadWALFile(f FileInfo, state *ent.DeserializationResult) (*ent
 		if errors.Is(err, errNodeIDBeyondLimit) {
 			// Only corruption, such as a misaligned read of a torn log, names a
 			// node the index cannot hold; everything after it is unreliable too.
+			// The limit comes from the document-ID counter, so the dropped tail
+			// is kept in case the counter, not the log, is wrong.
+			offset := walReader.LastValidOffset()
+			saved, dropped, saveErr := l.saveTail(f.Path, offset)
+			if saveErr != nil {
+				return result, false, errors.Wrapf(saveErr, "save the tail of %s before truncating it (%v)", f.Path, err)
+			}
 			l.config.Logger.WithFields(logrus.Fields{
-				"action": "hnsw_loader",
-				"file":   f.Path,
-				"type":   f.Type.String(),
+				"action":        "hnsw_loader",
+				"file":          f.Path,
+				"type":          f.Type.String(),
+				"offset":        offset,
+				"dropped_bytes": dropped,
+				"saved_to":      saved,
 			}).Errorf("commit log names a node beyond the index's limit - truncating before it: %v", err)
-			l.truncateToLastValidRecord(f.Path, walReader.LastValidOffset())
+			l.truncateToLastValidRecord(f.Path, offset)
 			return result, true, nil
 		}
 		switch f.Type {
@@ -374,6 +386,38 @@ func (l *Loader) nodeIDLimit() uint64 {
 	return counter + docIDCounterSlack
 }
 
+// saveTail copies path from offset to its end into a sibling file the loader
+// never reads, so a truncation can be undone by appending it back.
+func (l *Loader) saveTail(path string, offset int64) (string, int64, error) {
+	src, err := l.fs.Open(path)
+	if err != nil {
+		return "", 0, err
+	}
+	defer src.Close()
+	st, err := src.Stat()
+	if err != nil {
+		return "", 0, err
+	}
+
+	dst := fmt.Sprintf("%s.%d.corrupt", path, offset)
+	out, err := l.fs.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
+	if err != nil {
+		return "", 0, err
+	}
+	n, err := io.Copy(out, io.NewSectionReader(src, offset, st.Size()-offset))
+	if err == nil {
+		err = out.Sync()
+	}
+	closeErr := out.Close()
+	if err == nil {
+		err = closeErr
+	}
+	if err != nil {
+		return "", 0, err
+	}
+	return dst, n, nil
+}
+
 // truncateToLastValidRecord truncates a corrupt WAL file back to the end of its
 // last fully decoded commit (walReader.LastValidOffset), removing a torn or
 // garbage-appended tail. After this the file is a valid, shorter WAL again, so a
```

---

### Incident Patch 7: `e9161755` (2026-10-02)
**Commit Message**: [api] fix(generative-digitalocean): only warn when the model check fails

**File**: `modules/generative-digitalocean/clients/models.go` (modified, +3/-2)
```diff
@@ -20,7 +20,8 @@ import (
 
 // init registers the default model lister with the config package so that
 // ValidateClass can call out to DigitalOcean without config depending on this
-// package.
+// package. The timeout is short because the model check only warns, and it
+// also runs during backup restore.
 func init() {
-	config.DefaultModelLister = digitalocean.NewModelLister(30 * time.Second)
+	config.DefaultModelLister = digitalocean.NewModelLister(5 * time.Second)
 }
```

**File**: `modules/generative-digitalocean/config.go` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ func (m *GenerativeDigitalOceanModule) ValidateClass(ctx context.Context,
 	class *models.Class, cfg moduletools.ClassConfig,
 ) error {
 	settings := config.NewClassSettings(cfg)
-	return settings.Validate(ctx, class)
+	return settings.Validate(ctx, class, m.logger)
 }
 
 var _ = modulecapabilities.ClassConfigurator(New())
```

**File**: `modules/generative-digitalocean/config/class_settings.go` (modified, +14/-19)
```diff
@@ -13,10 +13,11 @@ package config
 
 import (
 	"context"
-	"fmt"
 	"os"
+	"slices"
 
 	"github.com/pkg/errors"
+	"github.com/sirupsen/logrus"
 	"github.com/weaviate/weaviate/entities/models"
 	"github.com/weaviate/weaviate/entities/moduletools"
 	basesettings "github.com/weaviate/weaviate/usecases/modulecomponents/settings"
@@ -59,7 +60,11 @@ func NewClassSettings(cfg moduletools.ClassConfig) *classSettings {
 	return &classSettings{cfg: cfg, propertyValuesHelper: basesettings.NewPropertyValuesHelper("generative-digitalocean")}
 }
 
-func (ic *classSettings) Validate(ctx context.Context, class *models.Class) error {
+// Validate checks the class config. It also checks the model against the
+// endpoint's /v1/models list, but only logs a warning when the model is
+// missing or the list can't be fetched: that check depends on a remote
+// service, so it must not block collection creation or backup restore.
+func (ic *classSettings) Validate(ctx context.Context, class *models.Class, logger logrus.FieldLogger) error {
 	if ic.cfg == nil {
 		// we would receive a nil-config on cross-class requests, such as Explore{}
 		return errors.New("empty config")
@@ -82,17 +87,10 @@ func (ic *classSettings) Validate(ctx context.Context, class *models.Class) erro
 	if presencePenalty := ic.PresencePenalty(); presencePenalty != nil && (*presencePenalty < -2 || *presencePenalty > 2) {
 		return errors.New("wrong presencePenalty configuration, values are between -2.0 and 2.0")
 	}
-	return ic.validateModel(ctx)
-}
 
-func (ic *classSettings) validateModel(ctx context.Context) error {
 	lister := DefaultModelLister
-	if lister == nil {
-		return nil
-	}
-
 	apiKey := ic.apiKey()
-	if apiKey == "" {
+	if lister == nil || apiKey == "" {
 		// Without a server-side API key the model can't be checked against
 		// /v1/models; the endpoint rejects an unknown model at generate time,
 		// where users can supply their own key via X-Digitalocean-Api-Key.
@@ -102,20 +100,17 @@ func (ic *classSettings) validateModel(ctx context.Context) error {
 	model := ic.Model()
 	available, err := lister.ListModels(ctx, ic.BaseURL(), apiKey, ic.WeaviateUUID())
 	if err != nil {
-		return errors.Wrap(err, "list DigitalOcean models")
+		logger.Warnf("collection %q: failed to list DigitalOcean models: %v", class.Class, err)
+		return nil
 	}
-
-	for _, id := range available {
-		if id == model {
-			return nil
-		}
+	if !slices.Contains(available, model) {
+		logger.Warnf("collection %q: model %q is not available on the DigitalOcean Serverless Inference endpoint; available models: %v", class.Class, model, available)
 	}
-
-	return fmt.Errorf("model %q is not available on the DigitalOcean Serverless Inference endpoint; available models: %v", model, available)
+	return nil
 }
 
 // apiKey resolves the DigitalOcean API key from the DIGITALOCEAN_APIKEY
-// environment variable. Validation runs at collection-create time, where the
+// environment variable. The model check runs at collection-create time, where the
 // per-request header is not available, so only the server-level env var is
 // consulted.
 func (ic *classSettings) apiKey() string {
```

**File**: `modules/generative-digitalocean/config/class_settings_test.go` (modified, +4/-81)
```diff
@@ -13,11 +13,12 @@ package config
 
 import (
 	"context"
-	"errors"
 	"testing"
 
+	"github.com/sirupsen/logrus/hooks/test"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
+	"github.com/weaviate/weaviate/entities/models"
 	"github.com/weaviate/weaviate/entities/moduletools"
 	"github.com/weaviate/weaviate/entities/schema"
 	"github.com/weaviate/weaviate/usecases/config"
@@ -104,8 +105,9 @@ func TestClassSettings(t *testing.T) {
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
 			settings := NewClassSettings(tt.cfg)
+			logger, _ := test.NewNullLogger()
 
-			err := settings.Validate(context.Background(), nil)
+			err := settings.Validate(context.Background(), &models.Class{Class: "Test"}, logger)
 			if tt.expectedErr != "" {
 				require.Error(t, err)
 				assert.Contains(t, err.Error(), tt.expectedErr)
@@ -125,71 +127,6 @@ func TestClassSettings(t *testing.T) {
 	}
 }
 
-func TestClassSettingsValidateModel(t *testing.T) {
-	tests := []struct {
-		name          string
-		cfg           fakeClassConfig
-		lister        *fakeModelLister
-		apiKeyEnv     string
-		wantErrMsg    string
-		wantNoListing bool
-	}{
-		{
-			name:      "model is in the available list",
-			cfg:       fakeClassConfig{"model": "openai-gpt-4o"},
-			lister:    &fakeModelLister{models: []string{"llama-4-maverick", "openai-gpt-4o"}},
-			apiKeyEnv: "dop_v1_test",
-		},
-		{
-			name:      "default model is in the available list",
-			cfg:       fakeClassConfig{},
-			lister:    &fakeModelLister{models: []string{"llama-4-maverick"}},
-			apiKeyEnv: "dop_v1_test",
-		},
-		{
-			name:       "model is not in the available list",
-			cfg:        fakeClassConfig{"model": "made-up-model"},
-			lister:     &fakeModelLister{models: []string{"llama-4-maverick"}},
-			apiKeyEnv:  "dop_v1_test",
-			wantErrMsg: `model "made-up-model" is not available`,
-		},
-		{
-			name:          "api key missing - validation skipped",
-			cfg:           fakeClassConfig{"model": "made-up-model"},
-			lister:        &fakeModelLister{models: []string{"llama-4-maverick"}},
-			wantNoListing: true,
-		},
-		{
-			name:       "lister returns error",
-			cfg:        fakeClassConfig{"model": "llama-4-maverick"},
-			lister:     &fakeModelLister{err: errors.New("boom")},
-			apiKeyEnv:  "dop_v1_test",
-			wantErrMsg: "list DigitalOcean models",
-		},
-	}
-
-	for _, tt := range tests {
-		t.Run(tt.name, func(t *testing.T) {
-			t.Setenv("DIGITALOCEAN_APIKEY", tt.apiKeyEnv)
-
-			prev := DefaultModelLister
-			DefaultModelLister = tt.lister
-			t.Cleanup(func() { DefaultModelLister = prev })
-
-			err := NewClassSettings(tt.cfg).Validate(context.Background(), nil)
-			if tt.wantErrMsg == "" {
-				assert.NoError(t, err)
-			} else {
-				require.Error(t, err)
-				assert.Contains(t, err.Error(), tt.wantErrMsg)
-			}
-			if tt.wantNoListing {
-				assert.Equal(t, 0, tt.lister.calls)
-			}
-		})
-	}
-}
-
 func TestClassSettingsEnvVars(t *testing.T) {
 	t.Setenv("DIGITALOCEAN_APIKEY", "dop_v1_test")
 	t.Setenv("VECTOR_DB_UUID", "test-uuid")
@@ -199,20 +136,6 @@ func TestClassSettingsEnvVars(t *testing.T) {
 	assert.Equal(t, "test-uuid", settings.WeaviateUUID())
 }
 
-type fakeModelLister struct {
-	models []string
-	err    error
-	calls  int
-}
-
-func (f *fakeModelLister) ListModels(_ context.Context, _, _, _ string) ([]string, error) {
-	f.calls++
-	if f.err != nil {
-		return nil, f.err
-	}
-	return f.models, nil
-}
-
 func ptr[T any](v T) *T {
 	return &v
 }
```

**File**: `modules/generative-digitalocean/config_test.go` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
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
+package modgenerativedigitalocean
+
+import (
+	"context"
+	"errors"
+	"testing"
+
+	"github.com/sirupsen/logrus"
+	"github.com/sirupsen/logrus/hooks/test"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+
+	"github.com/weaviate/weaviate/entities/models"
+	"github.com/weaviate/weaviate/entities/schema"
+	"github.com/weaviate/weaviate/modules/generative-digitalocean/config"
+	usecasesconfig "github.com/weaviate/weaviate/usecases/config"
+)
+
+func TestValidateClass(t *testing.T) {
+	tests := []struct {
+		name        string
+		cfg         fakeClassConfig
+		lister      *fakeModelLister
+		apiKeyEnv   string
+		expectedErr string
+		expectedLog string
+	}{
+		{
+			name:      "model available",
+			cfg:       fakeClassConfig{"model": "llama-4-maverick"},
+			lister:    &fakeModelLister{models: []string{"llama-4-maverick"}},
+			apiKeyEnv: "dop_v1_test",
+		},
+		{
+			name:   "api key missing skips the model check",
+			cfg:    fakeClassConfig{"model": "retired-model"},
+			lister: &fakeModelLister{models: []string{"llama-4-maverick"}},
+		},
+		{
+			name:        "model not available only warns",
+			cfg:         fakeClassConfig{"model": "retired-model"},
+			lister:      &fakeModelLister{models: []string{"llama-4-maverick"}},
+			apiKeyEnv:   "dop_v1_test",
+			expectedLog: `model "retired-model" is not available`,
+		},
+		{
+			name:        "lister error only warns",
+			cfg:         fakeClassConfig{"model": "llama-4-maverick"},
+			lister:      &fakeModelLister{err: errors.New("endpoint unreachable")},
+			apiKeyEnv:   "dop_v1_test",
+			expectedLog: "endpoint unreachable",
+		},
+		{
+			name:        "invalid local config still fails",
+			cfg:         fakeClassConfig{"temperature": 3.0},
+			lister:      &fakeModelLister{models: []string{"llama-4-maverick"}},
+			apiKeyEnv:   "dop_v1_test",
+			expectedErr: "wrong temperature configuration",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Setenv("DIGITALOCEAN_APIKEY", tt.apiKeyEnv)
+
+			prev := config.DefaultModelLister
+			config.DefaultModelLister = tt.lister
+			t.Cleanup(func() { config.DefaultModelLister = prev })
+
+			logger, hook := test.NewNullLogger()
+			m := &GenerativeDigitalOceanModule{logger: logger}
+
+			err := m.ValidateClass(context.Background(), &models.Class{Class: "Test"}, tt.cfg)
+			if tt.expectedErr != "" {
+				require.Error(t, err)
+				assert.Contains(t, err.Error(), tt.expectedErr)
+				assert.Empty(t, hook.AllEntries())
+				return
+			}
+			require.NoError(t, err)
+
+			if tt.apiKeyEnv == "" {
+				assert.Zero(t, tt.lister.calls)
+			}
+			if tt.expectedLog == "" {
+				assert.Empty(t, hook.AllEntries())
+				return
+			}
+			require.Len(t, hook.AllEntries(), 1)
+			assert.Equal(t, logrus.WarnLevel, hook.LastEntry().Level)
+			assert.Contains(t, hook.LastEntry().Message, tt.expectedLog)
+			assert.Contains(t, hook.LastEntry().Message, `collection "Test"`)
+		})
+	}
+}
+
+type fakeModelLister struct {
+	models []string
+	err    error
+	calls  int
+}
+
+func (f *fakeModelLister) ListModels(_ context.Context, _, _, _ string) ([]string, error) {
+	f.calls++
+	if f.err != nil {
+		return nil, f.err
+	}
+	return f.models, nil
+}
+
+type fakeClassConfig map[string]any
+
+func (f fakeClassConfig) Class() map[string]any { return f }
+
+func (f fakeClassConfig) Tenant() string { return "" }
+
+func (f fakeClassConfig) ClassByModuleName(moduleName string) map[string]any { return f }
+
+func (f fakeClassConfig) Property(propName string) map[string]any { return nil }
+
+func (f fakeClassConfig) TargetVector() string { return "" }
+
+func (f fakeClassConfig) PropertiesDataTypes() map[string]schema.DataType { return nil }
+
+func (f fakeClassConfig) Config() *usecasesconfig.Config { return nil }
```

**File**: `modules/generative-digitalocean/module.go` (modified, +2/-0)
```diff
@@ -33,6 +33,7 @@ func New() *GenerativeDigitalOceanModule {
 type GenerativeDigitalOceanModule struct {
 	generative                   generativeClient
 	additionalPropertiesProvider map[string]modulecapabilities.GenerativeProperty
+	logger                       logrus.FieldLogger
 }
 
 type generativeClient interface {
@@ -65,6 +66,7 @@ func (m *GenerativeDigitalOceanModule) initAdditional(ctx context.Context, timeo
 
 	client := clients.New(apiKey, timeout, logger)
 	m.generative = client
+	m.logger = logger
 	m.additionalPropertiesProvider = parameters.AdditionalGenerativeParameters(m.generative)
 
 	return nil
```

**File**: `usecases/modulecomponents/clients/digitalocean/models.go` (modified, +19/-4)
```diff
@@ -35,10 +35,14 @@ import (
 // and avoiding excessive calls.
 const modelCacheTTL = 5 * time.Minute
 
+// modelListResponse covers both error formats: DigitalOcean's native
+// top-level {"id","message","request_id"} and the OpenAI-style {"error":{...}}.
 type modelListResponse struct {
-	Object string          `json:"object"`
-	Data   []modelListItem `json:"data"`
-	Error  *modelListError `json:"error,omitempty"`
+	Object    string          `json:"object"`
+	Data      []modelListItem `json:"data"`
+	Message   string          `json:"message,omitempty"`
+	RequestID string          `json:"request_id,omitempty"`
+	Error     *modelListError `json:"error,omitempty"`
 }
 
 type modelListError struct {
@@ -90,8 +94,14 @@ func (l *ModelLister) ListModels(ctx context.Context, baseURL, apiKey, weaviateU
 		return nil, err
 	}
 
+	now := time.Now()
 	l.mu.Lock()
-	l.cache[cacheKey] = modelCacheEntry{models: models, fetchedAt: time.Now()}
+	for key, entry := range l.cache {
+		if now.Sub(entry.fetchedAt) >= modelCacheTTL {
+			delete(l.cache, key)
+		}
+	}
+	l.cache[cacheKey] = modelCacheEntry{models: models, fetchedAt: now}
 	l.mu.Unlock()
 
 	return models, nil
@@ -135,6 +145,11 @@ func (l *ModelLister) fetch(ctx context.Context, baseURL, apiKey, weaviateUUID s
 		msg := fmt.Sprintf("DigitalOcean /v1/models returned status %d", res.StatusCode)
 		if parsed.Error != nil && parsed.Error.Message != "" {
 			msg = fmt.Sprintf("%s: %s", msg, parsed.Error.Message)
+		} else if parsed.Message != "" {
+			msg = fmt.Sprintf("%s: %s", msg, parsed.Message)
+		}
+		if parsed.RequestID != "" {
+			msg = fmt.Sprintf("%s request_id: %s", msg, parsed.RequestID)
 		}
 		return nil, errors.New(msg)
 	}
```

**File**: `usecases/modulecomponents/clients/digitalocean/models_test.go` (modified, +56/-6)
```diff
@@ -69,16 +69,66 @@ func TestModelLister_Cache(t *testing.T) {
 	assert.Equal(t, int32(2), atomic.LoadInt32(&calls))
 }
 
-func TestModelLister_Error(t *testing.T) {
+func TestModelLister_PrunesExpiredEntries(t *testing.T) {
 	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
-		w.WriteHeader(http.StatusUnauthorized)
-		_, _ = io.WriteString(w, `{"error":{"message":"bad token","code":"unauthorized"}}`)
+		w.Header().Set("Content-Type", "application/json")
+		_, _ = io.WriteString(w, `{"object":"list","data":[{"id":"m1","object":"model","owned_by":"do","created":1}]}`)
 	}))
 	t.Cleanup(server.Close)
 
 	l := NewModelLister(5 * time.Second)
+	expiredKey := l.cacheKey("https://expired.example.com", "old-key")
+	freshKey := l.cacheKey("https://fresh.example.com", "other-key")
+	l.cache[expiredKey] = modelCacheEntry{models: []string{"old"}, fetchedAt: time.Now().Add(-modelCacheTTL)}
+	l.cache[freshKey] = modelCacheEntry{models: []string{"fresh"}, fetchedAt: time.Now()}
+
 	_, err := l.ListModels(context.Background(), server.URL, "test-key", "test-uuid")
-	require.Error(t, err)
-	assert.Contains(t, err.Error(), "status 401")
-	assert.Contains(t, err.Error(), "bad token")
+	require.NoError(t, err)
+
+	assert.NotContains(t, l.cache, expiredKey)
+	assert.Contains(t, l.cache, freshKey)
+	assert.Contains(t, l.cache, l.cacheKey(server.URL, "test-key"))
+}
+
+func TestModelLister_Error(t *testing.T) {
+	tests := []struct {
+		name        string
+		statusCode  int
+		body        string
+		expectedErr string
+	}{
+		{
+			name:        "openai-style error",
+			statusCode:  http.StatusUnauthorized,
+			body:        `{"error":{"message":"bad token","code":"unauthorized"}}`,
+			expectedErr: "DigitalOcean /v1/models returned status 401: bad token",
+		},
+		{
+			name:        "native error",
+			statusCode:  http.StatusPaymentRequired,
+			body:        `{"id":"Payment Required","message":"insufficient balance","request_id":"req-123"}`,
+			expectedErr: "DigitalOcean /v1/models returned status 402: insufficient balance request_id: req-123",
+		},
+		{
+			name:        "status only",
+			statusCode:  http.StatusInternalServerError,
+			body:        `{}`,
+			expectedErr: "DigitalOcean /v1/models returned status 500",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				w.WriteHeader(tt.statusCode)
+				_, _ = io.WriteString(w, tt.body)
+			}))
+			t.Cleanup(server.Close)
+
+			l := NewModelLister(5 * time.Second)
+			_, err := l.ListModels(context.Background(), server.URL, "test-key", "test-uuid")
+			require.Error(t, err)
+			assert.Equal(t, tt.expectedErr, err.Error())
+		})
+	}
 }
```

---

### Incident Patch 8: `9992c3d0` (2026-10-02)
**Commit Message**: [api] fix(generative-digitalocean): add env var support and model list validation

**File**: `modules/generative-digitalocean/clients/digitalocean.go` (modified, +6/-0)
```diff
@@ -28,6 +28,7 @@ import (
 	"github.com/weaviate/weaviate/entities/moduletools"
 	"github.com/weaviate/weaviate/modules/generative-digitalocean/config"
 	digitaloceanparams "github.com/weaviate/weaviate/modules/generative-digitalocean/parameters"
+	"github.com/weaviate/weaviate/usecases/build"
 	"github.com/weaviate/weaviate/usecases/modulecomponents"
 	"github.com/weaviate/weaviate/usecases/modulecomponents/generative"
 	"github.com/weaviate/weaviate/usecases/monitoring"
@@ -100,6 +101,11 @@ func (c *client) doGenerate(ctx context.Context, cfg moduletools.ClassConfig, pr
 
 	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", key))
 	req.Header.Set("Content-Type", "application/json")
+	if weaviateUUID := config.NewClassSettings(cfg).WeaviateUUID(); weaviateUUID != "" {
+		req.Header.Set("User-Agent", fmt.Sprintf("vector-db/weaviate/%s %s", weaviateUUID, build.Version))
+	} else {
+		req.Header.Set("User-Agent", fmt.Sprintf("vector-db/weaviate/unknown %s", build.Version))
+	}
 
 	res, err := c.httpClient.Do(req)
 	if res != nil {
```

**File**: `modules/generative-digitalocean/clients/digitalocean_test.go` (modified, +42/-0)
```diff
@@ -14,9 +14,11 @@ package clients
 import (
 	"context"
 	"encoding/json"
+	"fmt"
 	"io"
 	"net/http"
 	"net/http/httptest"
+	"strings"
 	"testing"
 	"time"
 
@@ -26,6 +28,7 @@ import (
 	"github.com/stretchr/testify/require"
 	"github.com/weaviate/weaviate/entities/modulecapabilities"
 	digitaloceanparams "github.com/weaviate/weaviate/modules/generative-digitalocean/parameters"
+	"github.com/weaviate/weaviate/usecases/build"
 )
 
 func nullLogger() logrus.FieldLogger {
@@ -267,6 +270,45 @@ func TestGenerateRequest(t *testing.T) {
 	}
 }
 
+func TestGenerateUserAgent(t *testing.T) {
+	tests := []struct {
+		name         string
+		weaviateUUID string
+		expected     string
+	}{
+		{
+			name:         "uuid set",
+			weaviateUUID: "test-uuid",
+			expected:     fmt.Sprintf("vector-db/weaviate/test-uuid %s", build.Version),
+		},
+		{
+			name:     "uuid not set",
+			expected: fmt.Sprintf("vector-db/weaviate/unknown %s", build.Version),
+		},
+	}
+
+	properties := []*modulecapabilities.GenerateProperties{{Text: map[string]string{"prop": "value"}}}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Setenv("VECTOR_DB_UUID", tt.weaviateUUID)
+
+			var gotUserAgent string
+			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				gotUserAgent = r.Header.Get("User-Agent")
+				w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"ok"}}]}`))
+			}))
+			defer server.Close()
+
+			c := New("key", time.Minute, nullLogger())
+			params := digitaloceanparams.Params{BaseURL: server.URL}
+			_, err := c.GenerateAllResults(context.Background(), properties, "task", params, false, nil)
+			require.NoError(t, err)
+			assert.Equal(t, strings.TrimSpace(tt.expected), gotUserAgent)
+		})
+	}
+}
+
 func TestMetaInfo(t *testing.T) {
 	meta, err := New("key", 0, nullLogger()).MetaInfo()
 	require.NoError(t, err)
```

**File**: `modules/generative-digitalocean/clients/models.go` (added, +157/-0)
```diff
@@ -0,0 +1,157 @@
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
+package clients
+
+import (
+	"context"
+	"crypto/sha256"
+	"encoding/json"
+	"fmt"
+	"io"
+	"net/http"
+	"net/url"
+	"sync"
+	"time"
+
+	"github.com/pkg/errors"
+
+	"github.com/weaviate/weaviate/modules/generative-digitalocean/config"
+	"github.com/weaviate/weaviate/usecases/build"
+	"github.com/weaviate/weaviate/usecases/modulecomponents"
+)
+
+// modelCacheTTL controls how long a successful /v1/models response is cached
+// per (baseURL, apiKey-hash). The DigitalOcean model catalogue changes rarely
+// and Validate is called every time a collection is created or its module
+// config changes, so a short TTL is a reasonable trade-off between freshness
+// and avoiding excessive calls.
+const modelCacheTTL = 5 * time.Minute
+
+type modelListResponse struct {
+	Object string          `json:"object"`
+	Data   []modelListItem `json:"data"`
+	Error  *apiError       `json:"error,omitempty"`
+}
+
+type modelListItem struct {
+	ID      string `json:"id"`
+	Object  string `json:"object"`
+	OwnedBy string `json:"owned_by"`
+	Created int64  `json:"created"`
+}
+
+type modelCacheEntry struct {
+	models    []string
+	fetchedAt time.Time
+}
+
+// ModelLister fetches the model catalogue from a DigitalOcean Serverless
+// Inference endpoint and caches the result in-memory.
+type ModelLister struct {
+	httpClient *http.Client
+
+	mu    sync.Mutex
+	cache map[string]modelCacheEntry
+}
+
+func NewModelLister(timeout time.Duration) *ModelLister {
+	return &ModelLister{
+		httpClient: modulecomponents.NewBaseHttpClient(timeout),
+		cache:      map[string]modelCacheEntry{},
+	}
+}
+
+func (l *ModelLister) ListModels(ctx context.Context, baseURL, apiKey, weaviateUUID string) ([]string, error) {
+	cacheKey := l.cacheKey(baseURL, apiKey)
+
+	l.mu.Lock()
+	if entry, ok := l.cache[cacheKey]; ok && time.Since(entry.fetchedAt) < modelCacheTTL {
+		l.mu.Unlock()
+		return entry.models, nil
+	}
+	l.mu.Unlock()
+
+	models, err := l.fetch(ctx, baseURL, apiKey, weaviateUUID)
+	if err != nil {
+		return nil, err
+	}
+
+	l.mu.Lock()
+	l.cache[cacheKey] = modelCacheEntry{models: models, fetchedAt: time.Now()}
+	l.mu.Unlock()
+
+	return models, nil
+}
+
+func (l *ModelLister) fetch(ctx context.Context, baseURL, apiKey, weaviateUUID string) ([]string, error) {
+	endpoint, err := url.JoinPath(baseURL, "/v1/models")
+	if err != nil {
+		return nil, errors.Wrap(err, "build /v1/models URL")
+	}
+
+	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
+	if err != nil {
+		return nil, errors.Wrap(err, "create GET request")
+	}
+	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
+	req.Header.Set("Content-Type", "application/json")
+	if weaviateUUID != "" {
+		req.Header.Set("User-Agent", fmt.Sprintf("vector-db/weaviate/%s %s", weaviateUUID, build.Version))
+	} else {
+		req.Header.Set("User-Agent", fmt.Sprintf("vector-db/weaviate/unknown %s", build.Version))
+	}
+
+	res, err := l.httpClient.Do(req)
+	if err != nil {
+		return nil, errors.Wrap(err, "send GET request")
+	}
+	defer res.Body.Close()
+
+	body, err := io.ReadAll(res.Body)
+	if err != nil {
+		return nil, errors.Wrap(err, "read response body")
+	}
+
+	var parsed modelListResponse
+	if err := json.Unmarshal(body, &parsed); err != nil {
+		return nil, fmt.Errorf("failed to parse /v1/models response (status %d): %w", res.StatusCode, err)
+	}
+
+	if res.StatusCode != http.StatusOK || parsed.Error != nil {
+		msg := fmt.Sprintf("DigitalOcean /v1/models returned status %d", res.StatusCode)
+		if parsed.Error != nil && parsed.Error.Message != "" {
+			msg = fmt.Sprintf("%s: %s", msg, parsed.Error.Message)
+		}
+		return nil, errors.New(msg)
+	}
+
+	ids := make([]string, 0, len(parsed.Data))
+	for _, m := range parsed.Data {
+		if m.ID == "" {
+			continue
+		}
+		ids = append(ids, m.ID)
+	}
+	return ids, nil
+}
+
+func (l *ModelLister) cacheKey(baseURL, apiKey string) string {
+	h := sha256.Sum256([]byte(apiKey))
+	return fmt.Sprintf("%s|%x", baseURL, h)
+}
+
+// init registers the default model lister with the config package so that
+// ValidateClass can call out to DigitalOcean without config depending on this
+// package.
+func init() {
+	config.DefaultModelLister = NewModelLister(30 * time.Second)
+}
```

**File**: `modules/generative-digitalocean/clients/models_test.go` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
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
+package clients
+
+import (
+	"context"
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+func TestModelLister_ListModels_Success(t *testing.T) {
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		assert.Equal(t, http.MethodGet, r.Method)
+		assert.Equal(t, "/v1/models", r.URL.Path)
+		assert.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
+		w.Header().Set("Content-Type", "application/json")
+		_, _ = io.WriteString(w, `{
+			"object": "list",
+			"data": [
+				{"id": "qwen3-embedding-0.6b", "object": "model", "owned_by": "digitalocean", "created": 1},
+				{"id": "openai-gpt-oss-20b", "object": "model", "owned_by": "digitalocean", "created": 2}
+			]
+		}`)
+	}))
+	t.Cleanup(server.Close)
+
+	l := NewModelLister(5 * time.Second)
+	ids, err := l.ListModels(context.Background(), server.URL, "test-key", "test-uuid")
+	require.NoError(t, err)
+	assert.Equal(t, []string{"qwen3-embedding-0.6b", "openai-gpt-oss-20b"}, ids)
+}
+
+func TestModelLister_Cache(t *testing.T) {
+	var calls int32
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		atomic.AddInt32(&calls, 1)
+		w.Header().Set("Content-Type", "application/json")
+		_, _ = io.WriteString(w, `{"object":"list","data":[{"id":"m1","object":"model","owned_by":"do","created":1}]}`)
+	}))
+	t.Cleanup(server.Close)
+
+	l := NewModelLister(5 * time.Second)
+	for i := 0; i < 5; i++ {
+		ids, err := l.ListModels(context.Background(), server.URL, "test-key", "test-uuid")
+		require.NoError(t, err)
+		assert.Equal(t, []string{"m1"}, ids)
+	}
+	assert.Equal(t, int32(1), atomic.LoadInt32(&calls), "second and later calls should be served from cache")
+
+	// different api key should miss the cache
+	_, err := l.ListModels(context.Background(), server.URL, "other-key", "test-uuid")
+	require.NoError(t, err)
+	assert.Equal(t, int32(2), atomic.LoadInt32(&calls))
+}
+
+func TestModelLister_Error(t *testing.T) {
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		w.WriteHeader(http.StatusUnauthorized)
+		_, _ = io.WriteString(w, `{"error":{"message":"bad token","code":"unauthorized"}}`)
+	}))
+	t.Cleanup(server.Close)
+
+	l := NewModelLister(5 * time.Second)
+	_, err := l.ListModels(context.Background(), server.URL, "test-key", "test-uuid")
+	require.Error(t, err)
+	assert.Contains(t, err.Error(), "status 401")
+	assert.Contains(t, err.Error(), "bad token")
+}
```

**File**: `modules/generative-digitalocean/config.go` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ func (m *GenerativeDigitalOceanModule) ValidateClass(ctx context.Context,
 	class *models.Class, cfg moduletools.ClassConfig,
 ) error {
 	settings := config.NewClassSettings(cfg)
-	return settings.Validate(class)
+	return settings.Validate(ctx, class)
 }
 
 var _ = modulecapabilities.ClassConfigurator(New())
```

**File**: `modules/generative-digitalocean/config/class_settings.go` (modified, +59/-2)
```diff
@@ -12,6 +12,10 @@
 package config
 
 import (
+	"context"
+	"fmt"
+	"os"
+
 	"github.com/pkg/errors"
 	"github.com/weaviate/weaviate/entities/models"
 	"github.com/weaviate/weaviate/entities/moduletools"
@@ -34,6 +38,18 @@ var (
 	DefaultModel   = "llama-4-maverick"
 )
 
+// ModelLister returns the set of available model ids from a DigitalOcean
+// Serverless Inference endpoint. It is implemented in the clients package and
+// injected here through DefaultModelLister to keep config free of HTTP-client
+// dependencies. Tests can override DefaultModelLister with a fake.
+type ModelLister interface {
+	ListModels(ctx context.Context, baseURL, apiKey string, weaviateUUID string) ([]string, error)
+}
+
+// DefaultModelLister is the lister used by Validate. The clients package
+// registers an HTTP-backed implementation at init time.
+var DefaultModelLister ModelLister
+
 type classSettings struct {
 	cfg                  moduletools.ClassConfig
 	propertyValuesHelper basesettings.PropertyValuesHelper
@@ -43,7 +59,7 @@ func NewClassSettings(cfg moduletools.ClassConfig) *classSettings {
 	return &classSettings{cfg: cfg, propertyValuesHelper: basesettings.NewPropertyValuesHelper("generative-digitalocean")}
 }
 
-func (ic *classSettings) Validate(class *models.Class) error {
+func (ic *classSettings) Validate(ctx context.Context, class *models.Class) error {
 	if ic.cfg == nil {
 		// we would receive a nil-config on cross-class requests, such as Explore{}
 		return errors.New("empty config")
@@ -66,7 +82,48 @@ func (ic *classSettings) Validate(class *models.Class) error {
 	if presencePenalty := ic.PresencePenalty(); presencePenalty != nil && (*presencePenalty < -2 || *presencePenalty > 2) {
 		return errors.New("wrong presencePenalty configuration, values are between -2.0 and 2.0")
 	}
-	return nil
+	return ic.validateModel(ctx)
+}
+
+func (ic *classSettings) validateModel(ctx context.Context) error {
+	lister := DefaultModelLister
+	if lister == nil {
+		return nil
+	}
+
+	apiKey := ic.apiKey()
+	if apiKey == "" {
+		// Without a server-side API key the model can't be checked against
+		// /v1/models; the endpoint rejects an unknown model at generate time,
+		// where users can supply their own key via X-Digitalocean-Api-Key.
+		return nil
+	}
+
+	model := ic.Model()
+	available, err := lister.ListModels(ctx, ic.BaseURL(), apiKey, ic.WeaviateUUID())
+	if err != nil {
+		return errors.Wrap(err, "list DigitalOcean models")
+	}
+
+	for _, id := range available {
+		if id == model {
+			return nil
+		}
+	}
+
+	return fmt.Errorf("model %q is not available on the DigitalOcean Serverless Inference endpoint; available models: %v", model, available)
+}
+
+// apiKey resolves the DigitalOcean API key from the DIGITALOCEAN_APIKEY
+// environment variable. Validation runs at collection-create time, where the
+// per-request header is not available, so only the server-level env var is
+// consulted.
+func (ic *classSettings) apiKey() string {
+	return os.Getenv("DIGITALOCEAN_APIKEY")
+}
+
+func (ic *classSettings) WeaviateUUID() string {
+	return os.Getenv("VECTOR_DB_UUID")
 }
 
 func (ic *classSettings) BaseURL() string {
```

**File**: `modules/generative-digitalocean/config/class_settings_test.go` (modified, +91/-1)
```diff
@@ -12,6 +12,8 @@
 package config
 
 import (
+	"context"
+	"errors"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -103,7 +105,7 @@ func TestClassSettings(t *testing.T) {
 		t.Run(tt.name, func(t *testing.T) {
 			settings := NewClassSettings(tt.cfg)
 
-			err := settings.Validate(nil)
+			err := settings.Validate(context.Background(), nil)
 			if tt.expectedErr != "" {
 				require.Error(t, err)
 				assert.Contains(t, err.Error(), tt.expectedErr)
@@ -123,6 +125,94 @@ func TestClassSettings(t *testing.T) {
 	}
 }
 
+func TestClassSettingsValidateModel(t *testing.T) {
+	tests := []struct {
+		name          string
+		cfg           fakeClassConfig
+		lister        *fakeModelLister
+		apiKeyEnv     string
+		wantErrMsg    string
+		wantNoListing bool
+	}{
+		{
+			name:      "model is in the available list",
+			cfg:       fakeClassConfig{"model": "openai-gpt-4o"},
+			lister:    &fakeModelLister{models: []string{"llama-4-maverick", "openai-gpt-4o"}},
+			apiKeyEnv: "dop_v1_test",
+		},
+		{
+			name:      "default model is in the available list",
+			cfg:       fakeClassConfig{},
+			lister:    &fakeModelLister{models: []string{"llama-4-maverick"}},
+			apiKeyEnv: "dop_v1_test",
+		},
+		{
+			name:       "model is not in the available list",
+			cfg:        fakeClassConfig{"model": "made-up-model"},
+			lister:     &fakeModelLister{models: []string{"llama-4-maverick"}},
+			apiKeyEnv:  "dop_v1_test",
+			wantErrMsg: `model "made-up-model" is not available`,
+		},
+		{
+			name:          "api key missing - validation skipped",
+			cfg:           fakeClassConfig{"model": "made-up-model"},
+			lister:        &fakeModelLister{models: []string{"llama-4-maverick"}},
+			wantNoListing: true,
+		},
+		{
+			name:       "lister returns error",
+			cfg:        fakeClassConfig{"model": "llama-4-maverick"},
+			lister:     &fakeModelLister{err: errors.New("boom")},
+			apiKeyEnv:  "dop_v1_test",
+			wantErrMsg: "list DigitalOcean models",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Setenv("DIGITALOCEAN_APIKEY", tt.apiKeyEnv)
+
+			prev := DefaultModelLister
+			DefaultModelLister = tt.lister
+			t.Cleanup(func() { DefaultModelLister = prev })
+
+			err := NewClassSettings(tt.cfg).Validate(context.Background(), nil)
+			if tt.wantErrMsg == "" {
+				assert.NoError(t, err)
+			} else {
+				require.Error(t, err)
+				assert.Contains(t, err.Error(), tt.wantErrMsg)
+			}
+			if tt.wantNoListing {
+				assert.Equal(t, 0, tt.lister.calls)
+			}
+		})
+	}
+}
+
+func TestClassSettingsEnvVars(t *testing.T) {
+	t.Setenv("DIGITALOCEAN_APIKEY", "dop_v1_test")
+	t.Setenv("VECTOR_DB_UUID", "test-uuid")
+
+	settings := NewClassSettings(fakeClassConfig{})
+	assert.Equal(t, "dop_v1_test", settings.apiKey())
+	assert.Equal(t, "test-uuid", settings.WeaviateUUID())
+}
+
+type fakeModelLister struct {
+	models []string
+	err    error
+	calls  int
+}
+
+func (f *fakeModelLister) ListModels(_ context.Context, _, _, _ string) ([]string, error) {
+	f.calls++
+	if f.err != nil {
+		return nil, f.err
+	}
+	return f.models, nil
+}
+
 func ptr[T any](v T) *T {
 	return &v
 }
```

---

### Incident Patch 9: `b808913e` (2026-10-01)
**Commit Message**: Merge pull request #13307 from weaviate/fix/ttl-collect-recovered-panics

fix(object-ttl): report a recovered panic in a delete or abort goroutine

**File**: `adapters/handlers/rest/clusterapi/object_ttl.go` (modified, +3/-1)
```diff
@@ -194,7 +194,9 @@ func (d *ObjectTTL) incomingDelete() http.Handler {
 					time.UnixMilli(classPayload.DelMilli), countDeleted, classPayload.ClassVersion)
 			}
 
-			eg.Wait() // ignore errors from goroutines, they are collected in ec
+			// every closure returns nil, so a recovered panic is all Wait can report,
+			// and the collector files it beside the errors the closures added themselves
+			_ = eg.WaitAndCollect(ec.AddGroups)
 
 			err = ec.ToError()
 		}, d.logger)
```

**File**: `adapters/handlers/rest/clusterapi/object_ttl_test.go` (modified, +100/-3)
```diff
@@ -27,6 +27,7 @@ import (
 
 	"github.com/sirupsen/logrus"
 	logrustest "github.com/sirupsen/logrus/hooks/test"
+	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	"github.com/weaviate/weaviate/adapters/handlers/rest/clusterapi"
 	"github.com/weaviate/weaviate/entities/errorcompounder"
@@ -187,16 +188,21 @@ func (s *waitingTTLSchema) ReadOnlyClassWithVersion(ctx context.Context, class s
 	return nil, fmt.Errorf("class %q: schema version not reached", class)
 }
 
-// sweptTTLRepo records the collections the sweep asked it for.
+// sweptTTLRepo records the collections the sweep asked it for. indexFor, when
+// set before the sweep starts, decides what each collection dispatches.
 type sweptTTLRepo struct {
-	lock  sync.Mutex
-	asked []string
+	lock     sync.Mutex
+	asked    []string
+	indexFor func(schema.ClassName) sharding.RemoteIndexIncomingRepo
 }
 
 func (r *sweptTTLRepo) GetIndexForIncomingSharding(class schema.ClassName) sharding.RemoteIndexIncomingRepo {
 	r.lock.Lock()
 	defer r.lock.Unlock()
 	r.asked = append(r.asked, string(class))
+	if r.indexFor != nil {
+		return r.indexFor(class)
+	}
 	return noopTTLIndex{}
 }
 
@@ -352,6 +358,97 @@ func TestIncomingDeleteHandsBackTheSlotOnABadBody(t *testing.T) {
 	postTTLDelete(t, server, 1)
 }
 
+// ttlDispatchIndex dispatches a collection's deletes however the caller wants
+// them to run, in place of the shard loop the sweep reaches in production.
+type ttlDispatchIndex struct {
+	sharding.RemoteIndexIncomingRepo
+	dispatch func(eg *enterrors.ErrorGroupWrapper, ec errorcompounder.ErrorCompounder)
+}
+
+func (i ttlDispatchIndex) IncomingDeleteObjectsExpired(_ context.Context, eg *enterrors.ErrorGroupWrapper,
+	ec errorcompounder.ErrorCompounder, _ string, _, _ time.Time, _ func(int32), _ uint64,
+) {
+	i.dispatch(eg, ec)
+}
+
+// ttlDeletePanic is what a delete goroutine panics with. It names no collection,
+// so a row cannot pass on the panic's own text where the report owes it a group.
+const ttlDeletePanic = "delete goroutine panicked"
+
+var errTTLDeleteFailed = errors.New("delete failed")
+
+// dispatchPanic hands every collection a delete goroutine that panics.
+func dispatchPanic(schema.ClassName) sharding.RemoteIndexIncomingRepo {
+	return ttlDispatchIndex{dispatch: func(eg *enterrors.ErrorGroupWrapper, _ errorcompounder.ErrorCompounder) {
+		eg.Go(func() error { panic(ttlDeletePanic) })
+	}}
+}
+
+// The group returns a recovered panic rather than filing it in the compounder.
+// A sweep reading only the compounder reports a collection whose deletes never
+// ran as one that was swept.
+func TestIncomingDeleteReportsRecoveredPanics(t *testing.T) {
+	tests := []struct {
+		name        string
+		collections int
+		indexFor    func(schema.ClassName) sharding.RemoteIndexIncomingRepo
+		wantErr     []string
+		wantPanics  int
+	}{
+		{
+			name:        "every panicking collection is reported, not only the one Wait returns",
+			collections: 3,
+			indexFor:    dispatchPanic,
+			wantErr:     []string{ttlDeletePanic},
+			wantPanics:  3,
+		},
+		{
+			name:        "a panic does not displace an error a sibling filed itself",
+			collections: 2,
+			indexFor: func(class schema.ClassName) sharding.RemoteIndexIncomingRepo {
+				if class == "Collection0" {
+					return dispatchPanic(class)
+				}
+				return ttlDispatchIndex{dispatch: func(eg *enterrors.ErrorGroupWrapper, ec errorcompounder.ErrorCompounder) {
+					eg.Go(func() error {
+						ec.AddGroups(errTTLDeleteFailed, string(class))
+						return nil
+					})
+				}}
+			},
+			wantErr:    []string{ttlDeletePanic, "\"Collection1\": {" + errTTLDeleteFailed.Error()},
+			wantPanics: 1,
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			// the integration job disables recovery, under which a panic takes the
+			// test binary down instead of reaching the group
+			t.Setenv("DISABLE_RECOVERY_ON_PANIC", "false")
+
+			server, repo, status, sweepOutcome := ttlTestServer(t, &waitingTTLSchema{entered: make(chan struct{})})
+			repo.indexFor = test.indexFor
+
+			postTTLDelete(t, server, test.collections)
+
+			// the slot is released by the outermost defer, so waiting on it means
+			// the defer that logs the outcome read below has run
+			require.Eventually(t, func() bool { return !status.IsRunning() },
+				ttlProbeTimeout, 10*time.Millisecond, "the sweep must run to completion")
+
+			failed, returned := sweepOutcome()
+			require.True(t, returned)
+			require.Error(t, failed, "a sweep that lost a collection's deletes must not report success")
+			for _, want := range test.wantErr {
+				assert.ErrorContains(t, failed, want)
+			}
+			assert.Equal(t, test.wantPanics, strings.Count(failed.Error(), "panic occurred"),
+				"one entry per panicking collection, since Wait reports only the first")
+		})
+	}
+}
+
 // The abort endpoint reports the running deletion without releasing its slot,
 // which only the deletion itself does once it has 
```

**File**: `usecases/object_ttl/object_ttl.go` (modified, +12/-3)
```diff
@@ -192,6 +192,11 @@ func (c *Coordinator) Abort(ctx context.Context, targetOwnNode bool) (bool, erro
 
 	abortedNodes := make(map[string]bool, len(remoteNodes)+1)
 	abortedNodes[localNode] = localAborted
+	// a panicking goroutine never reaches its write below, and a node missing
+	// from the map reads as one the abort never asked
+	for _, nodeName := range remoteNodes {
+		abortedNodes[nodeName] = false
+	}
 	anyAborted := localAborted
 	abortedLock := new(sync.Mutex)
 
@@ -206,9 +211,11 @@ func (c *Coordinator) Abort(ctx context.Context, targetOwnNode bool) (bool, erro
 			abortedNodes[nodeName] = aborted
 			abortedLock.Unlock()
 			return nil
-		})
+		}, nodeName)
 	}
-	eg.Wait()
+	// every closure returns nil, so a recovered panic is all Wait can report,
+	// and the collector files it under the node that raised it
+	_ = eg.WaitAndCollect(ec.AddGroups)
 	err := ec.ToError()
 
 	l := c.logger.WithFields(logrus.Fields{
@@ -287,7 +294,9 @@ func (c *Coordinator) triggerDeletionObjectsExpiredLocalNode(ctx context.Context
 		c.db.DeleteExpiredObjects(ttlCtx, eg, ec, name, deleteOnPropName, ttlThreshold, deletionTime, countDeleted, collection.version)
 	}
 
-	eg.Wait() // ignore errors from eg as they are already collected in ec
+	// every closure returns nil, so a recovered panic is all Wait can report,
+	// and the collector files it beside the errors the closures added themselves
+	_ = eg.WaitAndCollect(ec.AddGroups)
 
 	if err := ec.ToError(); err != nil {
 		return fmt.Errorf("deletion of expired objects on local node: %w", err)
```

**File**: `usecases/object_ttl/object_ttl_test.go` (modified, +161/-19)
```diff
@@ -533,6 +533,37 @@ func TestLocalSweepKeepsTheCounterMapOffTheDeleteGoroutines(t *testing.T) {
 	// first collection's deletes are still running
 	classes := []string{"Collection0", "Collection1"}
 
+	probe := newTTLCounterProbe()
+	hook, err := runLocalSweep(t, classes, probe)
+	require.NoError(t, err)
+
+	require.True(t, probe.overlapped,
+		"the reader must be running before the loop writes the next entry")
+	require.False(t, probe.timedOut,
+		"the reader hit its deadline, so the loop never reached the next collection")
+
+	report := logEntry(hook, "ttl deletion on local node finished")
+	require.NotNil(t, report, "the sweep must report what it deleted")
+	assert.Equal(t, probe.counted, report.Data["c_"+probe.firstClass],
+		"the collection is credited with what its own closure counted")
+}
+
+// logEntry returns the first entry logged with msg, which is how a test reads a
+// value the code under test reports to an operator and nowhere else.
+func logEntry(hook *logrustest.Hook, msg string) *logrus.Entry {
+	for _, entry := range hook.AllEntries() {
+		if entry.Message == msg {
+			return entry
+		}
+	}
+	return nil
+}
+
+// runLocalSweep sweeps classes through deleter on a single-node cluster, so the
+// sweep takes the local path rather than handing the round to a remote node.
+func runLocalSweep(t *testing.T, classes []string, deleter expiredObjectsDeleter) (*logrustest.Hook, error) {
+	t.Helper()
+
 	logger, hook := logrustest.NewNullLogger()
 	logger.SetLevel(logrus.DebugLevel)
 
@@ -547,35 +578,146 @@ func TestLocalSweepKeepsTheCounterMapOffTheDeleteGoroutines(t *testing.T) {
 		return nil
 	})
 
-	// one node, so the sweep runs on the local path rather than being handed
-	// to a remote node
 	getter := schemaUC.NewMockSchemaGetter(t)
 	getter.EXPECT().NodeName().Return("node1")
 	getter.EXPECT().Nodes().Return([]string{"node1"})
 
-	probe := newTTLCounterProbe()
-	c := NewCoordinator(reader, getter, namespaces.NewController(logger), probe,
+	c := NewCoordinator(reader, getter, namespaces.NewController(logger), deleter,
 		configRuntime.NewDynamicValue[float64](1), logger, nil, nil, NewLocalStatus())
 
 	now := time.Now()
-	require.NoError(t, c.Start(context.Background(), false, now, now))
+	return hook, c.Start(context.Background(), false, now, now)
+}
 
-	require.True(t, probe.overlapped,
-		"the reader must be running before the loop writes the next entry")
-	require.False(t, probe.timedOut,
-		"the reader hit its deadline, so the loop never reached the next collection")
+// deleterFunc dispatches a collection's deletes however the caller wants them
+// to run, in place of the store the sweep hands each collection to.
+type deleterFunc func(eg *enterrors.ErrorGroupWrapper, ec errorcompounder.ErrorCompounder, className string)
 
-	report := localSweepReport(hook)
-	require.NotNil(t, report, "the sweep must report what it deleted")
-	assert.Equal(t, probe.counted, report.Data["c_"+probe.firstClass],
-		"the collection is credited with what its own closure counted")
+func (f deleterFunc) DeleteExpiredObjects(_ context.Context, eg *enterrors.ErrorGroupWrapper,
+	ec errorcompounder.ErrorCompounder, className, _ string, _, _ time.Time, _ func(int32), _ uint64,
+) {
+	f(eg, ec, className)
 }
 
-func localSweepReport(hook *logrustest.Hook) *logrus.Entry {
-	for _, entry := range hook.AllEntries() {
-		if entry.Message == "ttl deletion on local node finished" {
-			return entry
-		}
+// deletePanic is what a delete goroutine panics with. It names no collection, so
+// a row cannot pass on the panic's own text where the report owes it a group.
+const deletePanic = "delete goroutine panicked"
+
+var errDeleteFailed = errors.New("delete failed")
+
+// A recovered panic files no error in the compounder and deletes no objects, so
+// a sweep that only reads it reports a round that never ran as a clean one.
+func TestLocalSweepReportsRecoveredPanics(t *testing.T) {
+	tests := []struct {
+		name       string
+		classes    []string
+		dispatch   deleterFunc
+		wantErr    []string
+		wantPanics int
+	}{
+		{
+			name:    "every panicking collection is reported, not only the one Wait returns",
+			classes: []string{"Collection0", "Collection1", "Collection2"},
+			dispatch: func(eg *enterrors.ErrorGroupWrapper, _ errorcompounder.ErrorCompounder, _ string) {
+				eg.Go(func() error { panic(deletePanic) })
+			},
+			wantErr:    []string{deletePanic},
+			wantPanics: 3,
+		},
+		{
+			name:    "a panic does not displace an error a sibling filed itself",
+			classes: []string{"Collection0", "Collection1"},
+			dispatch: func(eg *enterrors.ErrorGroupWrapper, ec errorcompounder.ErrorCompounder, className string) {
+				if className == "Collection0" {
+					eg.Go(func() error { panic(deletePanic) })
+					return
+				}
+				eg.Go(func() error {
+					ec.AddGroups(errDeleteFailed, className)
+					return nil
+				})
+			},
+			wantErr:    []string{deletePanic, "\"Collection1\": {" + errDeleteFailed.Error()},
+			wan
```

---

### Incident Patch 10: `33421359` (2026-10-01)
**Commit Message**: Address review feedback on the TTL recovered-panic tests

Keep one row per wrong fix: every panicking collection, and a panic
beside a sibling's error, for both the local sweep and the incoming
delete, plus the mixed abort round. The dropped rows either pass without
the fix or pin a property the error group and compounder tests already
cover. The panic-beside-an-abort test goes with them, which was also the
only new test with a timing handshake.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `adapters/handlers/rest/clusterapi/object_ttl_test.go` (modified, +0/-57)
```diff
@@ -395,13 +395,6 @@ func TestIncomingDeleteReportsRecoveredPanics(t *testing.T) {
 		wantErr     []string
 		wantPanics  int
 	}{
-		{
-			name:        "a panicking delete goroutine is reported",
-			collections: 1,
-			indexFor:    dispatchPanic,
-			wantErr:     []string{ttlDeletePanic},
-			wantPanics:  1,
-		},
 		{
 			name:        "every panicking collection is reported, not only the one Wait returns",
 			collections: 3,
@@ -456,56 +449,6 @@ func TestIncomingDeleteReportsRecoveredPanics(t *testing.T) {
 	}
 }
 
-// abortingTTLSchema answers the first collection at once and holds every later
-// one until the sweep is cancelled. A test can then abort a sweep whose first
-// collection already has a delete goroutine in flight.
-type abortingTTLSchema struct {
-	held chan struct{}
-	once sync.Once
-}
-
-func (s *abortingTTLSchema) ReadOnlyClassWithVersion(ctx context.Context, class string, _ uint64) (*models.Class, error) {
-	if class == "Collection0" {
-		return &models.Class{Class: class}, nil
-	}
-	s.once.Do(func() { close(s.held) })
-	<-ctx.Done()
-	// the real wait reports the version it never reached, carrying neither the
-	// context's error nor its cause
-	return nil, fmt.Errorf("class %q: schema version not reached", class)
-}
-
-// An abort and a panic reach the same compounder, and an operator aborting a
-// sweep is how they meet. Both have to survive being rendered together.
-func TestIncomingDeleteReportsAPanicBesideAnAbort(t *testing.T) {
-	t.Setenv("DISABLE_RECOVERY_ON_PANIC", "false")
-
-	ttlSchema := &abortingTTLSchema{held: make(chan struct{})}
-	server, repo, status, sweepOutcome := ttlTestServer(t, ttlSchema)
-	repo.indexFor = dispatchPanic
-
-	postTTLDelete(t, server, 2)
-
-	select {
-	case <-ttlSchema.held:
-	case <-time.After(ttlProbeTimeout):
-		t.Fatal("the sweep never reached the second collection")
-	}
-
-	require.True(t, status.Abort(), "the sweep is running, so there is one to abort")
-
-	require.Eventually(t, func() bool { return !status.IsRunning() },
-		ttlProbeTimeout, 10*time.Millisecond, "the sweep must run to completion")
-
-	failed, returned := sweepOutcome()
-	require.True(t, returned)
-	require.Error(t, failed)
-	assert.ErrorIs(t, failed, objectttl.ErrAborted,
-		"the abort must stay matchable with a panic rendered beside it")
-	assert.ErrorContains(t, failed, ttlDeletePanic,
-		"and the panic must not be displaced by the abort")
-}
-
 // The abort endpoint reports the running deletion without releasing its slot,
 // which only the deletion itself does once it has drained.
 func TestIncomingAbortKeepsTheSlotReserved(t *testing.T) {
```

**File**: `usecases/object_ttl/object_ttl_test.go` (modified, +31/-115)
```diff
@@ -613,25 +613,8 @@ func TestLocalSweepReportsRecoveredPanics(t *testing.T) {
 		classes    []string
 		dispatch   deleterFunc
 		wantErr    []string
-		wantIs     error
 		wantPanics int
 	}{
-		{
-			name:    "a sweep whose deletes all return reports nothing",
-			classes: []string{"Collection0"},
-			dispatch: func(eg *enterrors.ErrorGroupWrapper, _ errorcompounder.ErrorCompounder, _ string) {
-				eg.Go(func() error { return nil })
-			},
-		},
-		{
-			name:    "a panicking delete goroutine is reported",
-			classes: []string{"Collection0"},
-			dispatch: func(eg *enterrors.ErrorGroupWrapper, _ errorcompounder.ErrorCompounder, _ string) {
-				eg.Go(func() error { panic(deletePanic) })
-			},
-			wantErr:    []string{deletePanic},
-			wantPanics: 1,
-		},
 		{
 			name:    "every panicking collection is reported, not only the one Wait returns",
 			classes: []string{"Collection0", "Collection1", "Collection2"},
@@ -657,16 +640,6 @@ func TestLocalSweepReportsRecoveredPanics(t *testing.T) {
 			wantErr:    []string{deletePanic, "\"Collection1\": {" + errDeleteFailed.Error()},
 			wantPanics: 1,
 		},
-		{
-			name:    "a panic raised with an error stays matchable",
-			classes: []string{"Collection0"},
-			dispatch: func(eg *enterrors.ErrorGroupWrapper, _ errorcompounder.ErrorCompounder, _ string) {
-				eg.Go(func() error { panic(errDeleteFailed) })
-			},
-			wantErr:    []string{errDeleteFailed.Error()},
-			wantIs:     errDeleteFailed,
-			wantPanics: 1,
-		},
 	}
 
 	for _, test := range tests {
@@ -677,31 +650,16 @@ func TestLocalSweepReportsRecoveredPanics(t *testing.T) {
 
 			_, err := runLocalSweep(t, test.classes, test.dispatch)
 
-			if len(test.wantErr) == 0 {
-				require.NoError(t, err)
-				return
-			}
 			require.Error(t, err, "a sweep that lost a collection's deletes must not report success")
 			for _, want := range test.wantErr {
 				assert.ErrorContains(t, err, want)
 			}
-			if test.wantIs != nil {
-				assert.ErrorIs(t, err, test.wantIs, "the compounder keeps the panic's own error reachable")
-			}
 			assert.Equal(t, test.wantPanics, strings.Count(err.Error(), "panic occurred"),
 				"one entry per panicking collection, since Wait reports only the first")
 		})
 	}
 }
 
-// panickingNodeResolver panics where the abort goroutine resolves its node,
-// standing in for any panic that goroutine's work can raise.
-type panickingNodeResolver struct{}
-
-func (panickingNodeResolver) NodeHostname(nodeName string) (string, bool) {
-	panic("resolving " + nodeName)
-}
-
 // scriptedNodeResolver answers for every node but two, panicking for one and
 // failing to resolve the other, so one abort round carries all three outcomes.
 type scriptedNodeResolver struct {
@@ -723,85 +681,43 @@ func (r scriptedNodeResolver) NodeHostname(nodeName string) (string, bool) {
 // An abort reports per node, so a node whose goroutine panicked must reach the
 // caller as a node that was not aborted rather than as one that was.
 func TestCoordinatorAbortReportsRecoveredPanics(t *testing.T) {
-	tests := []struct {
-		name        string
-		nodes       []string
-		resolver    func(host string) nodeResolver
-		wantAborted bool
-		wantErr     []string
-		wantNodes   map[string]bool
-	}{
-		{
-			name:        "an abort every node answers reports no error",
-			nodes:       []string{"node1", "node2", "node3"},
-			resolver:    func(host string) nodeResolver { return fixedNodeResolver(host) },
-			wantAborted: true,
-			wantNodes:   map[string]bool{"node1": false, "node2": true, "node3": true},
-		},
-		{
-			name:     "every panicking node is reported under its own name",
-			nodes:    []string{"node1", "node2", "node3"},
-			resolver: func(string) nodeResolver { return panickingNodeResolver{} },
-			wantErr: []string{
-				"panic occurred", "\"node2\": {", "\"node3\": {",
-				"resolving node2", "resolving node3",
-			},
-			wantNodes: map[string]bool{"node1": false, "node2": false, "node3": false},
-		},
-		{
-			name:  "a panicking node is reported beside a node that failed and one that aborted",
-			nodes: []string{"node1", "node2", "node3", "node4"},
-			resolver: func(host string) nodeResolver {
-				return scriptedNodeResolver{host: host, panicking: "node3", unresolvable: "node4"}
-			},
-			wantAborted: true,
-			wantErr: []string{
-				"\"node3\": {panic occurred", "resolving node3",
-				"\"node4\": {unable to resolve hostname for node4",
-			},
-			wantNodes: map[string]bool{"node1": false, "node2": true, "node3": false, "node4": false},
-		},
-	}
+	// the integration job disables recovery, under which a panic takes the
+	// test binary down instead of reaching the group
+	t.Setenv("DISABLE_RECOVERY_ON_PANIC", "false")
 
-	for _, test := range tests {
-		t.Run(test.name, func(t *testing.T) {
-			t.Setenv("DISABLE_RECOVERY_ON_PANIC", "false")
+	logger, hook := logrustest.NewNullLogger()
 
-			logger, hook := logrustest.NewNullLogger()
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWr
```

---

### Incident Patch 11: `426bdaff` (2026-09-28)
**Commit Message**: Report a recovered panic in a TTL delete or abort goroutine

Three error groups discarded what Wait returned, under a comment saying
the errors were already in the compounder. That was true while every
callback filed its own errors and returned nil, and stopped being true
once panics are recovered, because a recovered panic is returned by
Wait rather than filed. A collection whose delete goroutine panicked
reached the log and nothing else, and the sweep reported itself as
clean.

The abort group also labels each goroutine with its node, so a panic
there is filed under the node that raised it rather than at the top of
the report. Its node map is seeded before dispatch, because a
goroutine that panics never reaches its own write: the map now means
asked and did not report aborted, rather than asked.

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `adapters/handlers/rest/clusterapi/object_ttl.go` (modified, +3/-1)
```diff
@@ -194,7 +194,9 @@ func (d *ObjectTTL) incomingDelete() http.Handler {
 					time.UnixMilli(classPayload.DelMilli), countDeleted, classPayload.ClassVersion)
 			}
 
-			eg.Wait() // ignore errors from goroutines, they are collected in ec
+			// every closure returns nil, so a recovered panic is all Wait can report,
+			// and the collector files it beside the errors the closures added themselves
+			_ = eg.WaitAndCollect(ec.AddGroups)
 
 			err = ec.ToError()
 		}, d.logger)
```

**File**: `adapters/handlers/rest/clusterapi/object_ttl_test.go` (modified, +157/-3)
```diff
@@ -27,6 +27,7 @@ import (
 
 	"github.com/sirupsen/logrus"
 	logrustest "github.com/sirupsen/logrus/hooks/test"
+	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	"github.com/weaviate/weaviate/adapters/handlers/rest/clusterapi"
 	"github.com/weaviate/weaviate/entities/errorcompounder"
@@ -187,16 +188,21 @@ func (s *waitingTTLSchema) ReadOnlyClassWithVersion(ctx context.Context, class s
 	return nil, fmt.Errorf("class %q: schema version not reached", class)
 }
 
-// sweptTTLRepo records the collections the sweep asked it for.
+// sweptTTLRepo records the collections the sweep asked it for. indexFor, when
+// set before the sweep starts, decides what each collection dispatches.
 type sweptTTLRepo struct {
-	lock  sync.Mutex
-	asked []string
+	lock     sync.Mutex
+	asked    []string
+	indexFor func(schema.ClassName) sharding.RemoteIndexIncomingRepo
 }
 
 func (r *sweptTTLRepo) GetIndexForIncomingSharding(class schema.ClassName) sharding.RemoteIndexIncomingRepo {
 	r.lock.Lock()
 	defer r.lock.Unlock()
 	r.asked = append(r.asked, string(class))
+	if r.indexFor != nil {
+		return r.indexFor(class)
+	}
 	return noopTTLIndex{}
 }
 
@@ -352,6 +358,154 @@ func TestIncomingDeleteHandsBackTheSlotOnABadBody(t *testing.T) {
 	postTTLDelete(t, server, 1)
 }
 
+// ttlDispatchIndex dispatches a collection's deletes however the caller wants
+// them to run, in place of the shard loop the sweep reaches in production.
+type ttlDispatchIndex struct {
+	sharding.RemoteIndexIncomingRepo
+	dispatch func(eg *enterrors.ErrorGroupWrapper, ec errorcompounder.ErrorCompounder)
+}
+
+func (i ttlDispatchIndex) IncomingDeleteObjectsExpired(_ context.Context, eg *enterrors.ErrorGroupWrapper,
+	ec errorcompounder.ErrorCompounder, _ string, _, _ time.Time, _ func(int32), _ uint64,
+) {
+	i.dispatch(eg, ec)
+}
+
+// ttlDeletePanic is what a delete goroutine panics with. It names no collection,
+// so a row cannot pass on the panic's own text where the report owes it a group.
+const ttlDeletePanic = "delete goroutine panicked"
+
+var errTTLDeleteFailed = errors.New("delete failed")
+
+// dispatchPanic hands every collection a delete goroutine that panics.
+func dispatchPanic(schema.ClassName) sharding.RemoteIndexIncomingRepo {
+	return ttlDispatchIndex{dispatch: func(eg *enterrors.ErrorGroupWrapper, _ errorcompounder.ErrorCompounder) {
+		eg.Go(func() error { panic(ttlDeletePanic) })
+	}}
+}
+
+// The group returns a recovered panic rather than filing it in the compounder.
+// A sweep reading only the compounder reports a collection whose deletes never
+// ran as one that was swept.
+func TestIncomingDeleteReportsRecoveredPanics(t *testing.T) {
+	tests := []struct {
+		name        string
+		collections int
+		indexFor    func(schema.ClassName) sharding.RemoteIndexIncomingRepo
+		wantErr     []string
+		wantPanics  int
+	}{
+		{
+			name:        "a panicking delete goroutine is reported",
+			collections: 1,
+			indexFor:    dispatchPanic,
+			wantErr:     []string{ttlDeletePanic},
+			wantPanics:  1,
+		},
+		{
+			name:        "every panicking collection is reported, not only the one Wait returns",
+			collections: 3,
+			indexFor:    dispatchPanic,
+			wantErr:     []string{ttlDeletePanic},
+			wantPanics:  3,
+		},
+		{
+			name:        "a panic does not displace an error a sibling filed itself",
+			collections: 2,
+			indexFor: func(class schema.ClassName) sharding.RemoteIndexIncomingRepo {
+				if class == "Collection0" {
+					return dispatchPanic(class)
+				}
+				return ttlDispatchIndex{dispatch: func(eg *enterrors.ErrorGroupWrapper, ec errorcompounder.ErrorCompounder) {
+					eg.Go(func() error {
+						ec.AddGroups(errTTLDeleteFailed, string(class))
+						return nil
+					})
+				}}
+			},
+			wantErr:    []string{ttlDeletePanic, "\"Collection1\": {" + errTTLDeleteFailed.Error()},
+			wantPanics: 1,
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			// the integration job disables recovery, under which a panic takes the
+			// test binary down instead of reaching the group
+			t.Setenv("DISABLE_RECOVERY_ON_PANIC", "false")
+
+			server, repo, status, sweepOutcome := ttlTestServer(t, &waitingTTLSchema{entered: make(chan struct{})})
+			repo.indexFor = test.indexFor
+
+			postTTLDelete(t, server, test.collections)
+
+			// the slot is released by the outermost defer, so waiting on it means
+			// the defer that logs the outcome read below has run
+			require.Eventually(t, func() bool { return !status.IsRunning() },
+				ttlProbeTimeout, 10*time.Millisecond, "the sweep must run to completion")
+
+			failed, returned := sweepOutcome()
+			require.True(t, returned)
+			require.Error(t, failed, "a sweep that lost a collection's deletes must not report success")
+			for _, want := range test.wantErr {
+				assert.ErrorContains(t, failed, want)
+			}
+			assert.Equal(t, test.wantPanics, strings.Count(failed.Error(), "panic occurred"),
+				"one entry per panicking collect
```

**File**: `usecases/object_ttl/object_ttl.go` (modified, +12/-3)
```diff
@@ -192,6 +192,11 @@ func (c *Coordinator) Abort(ctx context.Context, targetOwnNode bool) (bool, erro
 
 	abortedNodes := make(map[string]bool, len(remoteNodes)+1)
 	abortedNodes[localNode] = localAborted
+	// a panicking goroutine never reaches its write below, and a node missing
+	// from the map reads as one the abort never asked
+	for _, nodeName := range remoteNodes {
+		abortedNodes[nodeName] = false
+	}
 	anyAborted := localAborted
 	abortedLock := new(sync.Mutex)
 
@@ -206,9 +211,11 @@ func (c *Coordinator) Abort(ctx context.Context, targetOwnNode bool) (bool, erro
 			abortedNodes[nodeName] = aborted
 			abortedLock.Unlock()
 			return nil
-		})
+		}, nodeName)
 	}
-	eg.Wait()
+	// every closure returns nil, so a recovered panic is all Wait can report,
+	// and the collector files it under the node that raised it
+	_ = eg.WaitAndCollect(ec.AddGroups)
 	err := ec.ToError()
 
 	l := c.logger.WithFields(logrus.Fields{
@@ -287,7 +294,9 @@ func (c *Coordinator) triggerDeletionObjectsExpiredLocalNode(ctx context.Context
 		c.db.DeleteExpiredObjects(ttlCtx, eg, ec, name, deleteOnPropName, ttlThreshold, deletionTime, countDeleted, collection.version)
 	}
 
-	eg.Wait() // ignore errors from eg as they are already collected in ec
+	// every closure returns nil, so a recovered panic is all Wait can report,
+	// and the collector files it beside the errors the closures added themselves
+	_ = eg.WaitAndCollect(ec.AddGroups)
 
 	if err := ec.ToError(); err != nil {
 		return fmt.Errorf("deletion of expired objects on local node: %w", err)
```

**File**: `usecases/object_ttl/object_ttl_test.go` (modified, +245/-19)
```diff
@@ -533,6 +533,37 @@ func TestLocalSweepKeepsTheCounterMapOffTheDeleteGoroutines(t *testing.T) {
 	// first collection's deletes are still running
 	classes := []string{"Collection0", "Collection1"}
 
+	probe := newTTLCounterProbe()
+	hook, err := runLocalSweep(t, classes, probe)
+	require.NoError(t, err)
+
+	require.True(t, probe.overlapped,
+		"the reader must be running before the loop writes the next entry")
+	require.False(t, probe.timedOut,
+		"the reader hit its deadline, so the loop never reached the next collection")
+
+	report := logEntry(hook, "ttl deletion on local node finished")
+	require.NotNil(t, report, "the sweep must report what it deleted")
+	assert.Equal(t, probe.counted, report.Data["c_"+probe.firstClass],
+		"the collection is credited with what its own closure counted")
+}
+
+// logEntry returns the first entry logged with msg, which is how a test reads a
+// value the code under test reports to an operator and nowhere else.
+func logEntry(hook *logrustest.Hook, msg string) *logrus.Entry {
+	for _, entry := range hook.AllEntries() {
+		if entry.Message == msg {
+			return entry
+		}
+	}
+	return nil
+}
+
+// runLocalSweep sweeps classes through deleter on a single-node cluster, so the
+// sweep takes the local path rather than handing the round to a remote node.
+func runLocalSweep(t *testing.T, classes []string, deleter expiredObjectsDeleter) (*logrustest.Hook, error) {
+	t.Helper()
+
 	logger, hook := logrustest.NewNullLogger()
 	logger.SetLevel(logrus.DebugLevel)
 
@@ -547,35 +578,230 @@ func TestLocalSweepKeepsTheCounterMapOffTheDeleteGoroutines(t *testing.T) {
 		return nil
 	})
 
-	// one node, so the sweep runs on the local path rather than being handed
-	// to a remote node
 	getter := schemaUC.NewMockSchemaGetter(t)
 	getter.EXPECT().NodeName().Return("node1")
 	getter.EXPECT().Nodes().Return([]string{"node1"})
 
-	probe := newTTLCounterProbe()
-	c := NewCoordinator(reader, getter, namespaces.NewController(logger), probe,
+	c := NewCoordinator(reader, getter, namespaces.NewController(logger), deleter,
 		configRuntime.NewDynamicValue[float64](1), logger, nil, nil, NewLocalStatus())
 
 	now := time.Now()
-	require.NoError(t, c.Start(context.Background(), false, now, now))
+	return hook, c.Start(context.Background(), false, now, now)
+}
 
-	require.True(t, probe.overlapped,
-		"the reader must be running before the loop writes the next entry")
-	require.False(t, probe.timedOut,
-		"the reader hit its deadline, so the loop never reached the next collection")
+// deleterFunc dispatches a collection's deletes however the caller wants them
+// to run, in place of the store the sweep hands each collection to.
+type deleterFunc func(eg *enterrors.ErrorGroupWrapper, ec errorcompounder.ErrorCompounder, className string)
 
-	report := localSweepReport(hook)
-	require.NotNil(t, report, "the sweep must report what it deleted")
-	assert.Equal(t, probe.counted, report.Data["c_"+probe.firstClass],
-		"the collection is credited with what its own closure counted")
+func (f deleterFunc) DeleteExpiredObjects(_ context.Context, eg *enterrors.ErrorGroupWrapper,
+	ec errorcompounder.ErrorCompounder, className, _ string, _, _ time.Time, _ func(int32), _ uint64,
+) {
+	f(eg, ec, className)
 }
 
-func localSweepReport(hook *logrustest.Hook) *logrus.Entry {
-	for _, entry := range hook.AllEntries() {
-		if entry.Message == "ttl deletion on local node finished" {
-			return entry
-		}
+// deletePanic is what a delete goroutine panics with. It names no collection, so
+// a row cannot pass on the panic's own text where the report owes it a group.
+const deletePanic = "delete goroutine panicked"
+
+var errDeleteFailed = errors.New("delete failed")
+
+// A recovered panic files no error in the compounder and deletes no objects, so
+// a sweep that only reads it reports a round that never ran as a clean one.
+func TestLocalSweepReportsRecoveredPanics(t *testing.T) {
+	tests := []struct {
+		name       string
+		classes    []string
+		dispatch   deleterFunc
+		wantErr    []string
+		wantIs     error
+		wantPanics int
+	}{
+		{
+			name:    "a sweep whose deletes all return reports nothing",
+			classes: []string{"Collection0"},
+			dispatch: func(eg *enterrors.ErrorGroupWrapper, _ errorcompounder.ErrorCompounder, _ string) {
+				eg.Go(func() error { return nil })
+			},
+		},
+		{
+			name:    "a panicking delete goroutine is reported",
+			classes: []string{"Collection0"},
+			dispatch: func(eg *enterrors.ErrorGroupWrapper, _ errorcompounder.ErrorCompounder, _ string) {
+				eg.Go(func() error { panic(deletePanic) })
+			},
+			wantErr:    []string{deletePanic},
+			wantPanics: 1,
+		},
+		{
+			name:    "every panicking collection is reported, not only the one Wait returns",
+			classes: []string{"Collection0", "Collection1", "Collection2"},
+			dispatch: func(eg *enterrors.ErrorGroupWrapper, _ errorcompounder.ErrorCompounder, _ string) {
+				eg.Go(func() error { panic(deletePanic) })
+			},
+			wantErr
```

---

### Incident Patch 12: `3e645e62` (2026-10-01)
**Commit Message**: Merge pull request #13390 from weaviate/hotfix/reindex-recovery-flag-skip

hotfix: skip reindex recovery scan at startup when RUNTIME_REINDEX_ENABLED is off

**File**: `adapters/handlers/rest/configure_api.go` (modified, +1/-0)
```diff
@@ -858,6 +858,7 @@ func MakeAppState(ctx, serverShutdownCtx context.Context, options *swag.CommandL
 	// decide which migrations are still in flight.
 	recoveredReindexes, recoveryErr := db.DiscoverInFlightReindexTasks(
 		appState.ServerConfig.Config.Persistence.DataPath,
+		appState.ServerConfig.Config.RuntimeReindexEnabled,
 		appState.Logger,
 		appState.SchemaManager,
 	)
```

**File**: `adapters/repos/db/reindex_provider_barrier_integration_test.go` (modified, +1/-1)
```diff
@@ -302,7 +302,7 @@ func TestReindexProviderBarrierIntegration_CrashAfterPersistRecoveryRecord(t *te
 	// disk and never invokes schema operations until buildRecoveryTasks
 	// fires (which only fires for dirs with started + reindexed).
 	rootPath := idx.Config.RootPath
-	recovered, err := DiscoverInFlightReindexTasks(rootPath, idx.logger, nil)
+	recovered, err := DiscoverInFlightReindexTasks(rootPath, true, idx.logger, nil)
 	require.NoError(t, err, "discover must not error on a started.mig-less dir")
 	for _, r := range recovered {
 		assert.NotEqualf(t, taskID, r.Descriptor.ID,
```

**File**: `adapters/repos/db/reindex_provider_dir_ownership_test.go` (modified, +2/-2)
```diff
@@ -266,7 +266,7 @@ func TestRecoveryNamesTheDirectoriesItRecoveredFrom(t *testing.T) {
 
 			onDisk := seedInFlightMigration(t, p, lsm, tc, 3, 41)
 
-			recovered, err := DiscoverInFlightReindexTasks(root, p.logger, nil)
+			recovered, err := DiscoverInFlightReindexTasks(root, true, p.logger, nil)
 			require.NoError(t, err)
 			require.NotEmpty(t, recovered, "an unswapped migration is in flight on this shard")
 
@@ -300,7 +300,7 @@ func TestRecoverySkipsATrackerDirectoryThatNamesNoGeneration(t *testing.T) {
 					filepath.Join(lsm, migrationsDir, base)))
 			}
 
-			recovered, err := DiscoverInFlightReindexTasks(root, p.logger, nil)
+			recovered, err := DiscoverInFlightReindexTasks(root, true, p.logger, nil)
 			require.NoError(t, err)
 			require.Empty(t, recoveredMigrationDirs(recovered),
 				"a directory name with no generation gives recovery nothing to rebuild from")
```

**File**: `adapters/repos/db/reindex_recovery.go` (modified, +4/-1)
```diff
@@ -72,10 +72,13 @@ type RecoveredReindex struct {
 // belonging to the same task is the caller's job.
 func DiscoverInFlightReindexTasks(
 	rootPath string,
+	runtimeReindexEnabled bool,
 	logger logrus.FieldLogger,
 	schemaManager *schema.Manager,
 ) ([]RecoveredReindex, error) {
-	if rootPath == "" {
+	// The scan lists a directory per shard, which delays startup by minutes
+	// on clusters with many tenants, so it only runs with the feature on.
+	if rootPath == "" || !runtimeReindexEnabled {
 		return nil, nil
 	}
 	indices, err := os.ReadDir(rootPath)
```

**File**: `adapters/repos/db/reindex_recovery_kill_switch_test.go` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
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
+package db
+
+import (
+	"os"
+	"path/filepath"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+)
+
+// The data dir holds a recoverable migration, so a scan that ran returns it.
+func TestDiscoverInFlightReindexTasks_RuntimeReindexDisabled(t *testing.T) {
+	tests := []struct {
+		name          string
+		enabled       bool
+		wantRecovered bool
+	}{
+		{name: "disabled skips the scan"},
+		{name: "enabled keeps the scan", enabled: true, wantRecovered: true},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			p, _ := newTestProvider(t)
+			root := t.TempDir()
+			lsm := filepath.Join(root, "books", "shard-1", "lsm")
+			require.NoError(t, os.MkdirAll(lsm, 0o777))
+			seedInFlightMigration(t, p, lsm, recoverableDirOwnershipCases()[0], 3, 3)
+
+			recovered, err := DiscoverInFlightReindexTasks(root, tt.enabled, p.logger, nil)
+			require.NoError(t, err)
+			require.Equal(t, tt.wantRecovered, len(recovered) > 0)
+		})
+	}
+}
```

---

### Incident Patch 13: `9574c81b` (2026-10-01)
**Commit Message**: Merge pull request #13374 from weaviate/fix-lsmkv-flush-cycle-race

fix(lsmkv): read active memtable under flush lock in flush cycle

**File**: `adapters/repos/db/lsmkv/bucket.go` (modified, +2/-1)
```diff
@@ -1832,6 +1832,8 @@ func (b *Bucket) flushAndSwitchIfThresholdsMet(shouldAbort cyclemanager.ShouldAb
 	walTooLarge := uint64(commitLogSize) >= b.walThreshold
 	dirtyTooLong := b.active.DirtyDuration() >= b.flushDirtyAfter
 	shouldSwitch := memtableTooLarge || walTooLarge || dirtyTooLong
+	// read under the lock, a FlushAndSwitch from elsewhere replaces b.active
+	cycleLength := b.active.ActiveDuration()
 
 	// If true, the parent shard has indicated that it has
 	// entered an immutable state. During this time, the
@@ -1857,7 +1859,6 @@ func (b *Bucket) flushAndSwitchIfThresholdsMet(shouldAbort cyclemanager.ShouldAb
 	b.flushLock.RUnlock()
 	if shouldSwitch {
 		b.haltedFlushTimer.Reset()
-		cycleLength := b.active.ActiveDuration()
 		if err := b.FlushAndSwitch(); err != nil {
 			b.logger.WithField("action", "lsm_memtable_flush").
 				WithField("path", b.GetDir()).
```

**File**: `adapters/repos/db/lsmkv/bucket_flush_cycle_race_test.go` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
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
+package lsmkv
+
+import (
+	"context"
+	"sync"
+	"testing"
+
+	"github.com/sirupsen/logrus/hooks/test"
+	"github.com/stretchr/testify/require"
+	"github.com/weaviate/weaviate/entities/cyclemanager"
+)
+
+// The flush cycle and a FlushAndSwitch called from elsewhere, as by a shard
+// halted for a backup, run on the same bucket at the same time. Run with -race.
+func TestBucket_FlushCycleConcurrentWithFlushAndSwitch(t *testing.T) {
+	ctx := context.Background()
+	logger, _ := test.NewNullLogger()
+	b, err := NewBucketCreator().NewBucket(ctx, t.TempDir(), "", logger, nil,
+		cyclemanager.NewCallbackGroupNoop(), cyclemanager.NewCallbackGroupNoop(),
+		WithStrategy(StrategyReplace), WithMemtableThreshold(1), WithMinWalThreshold(0))
+	require.NoError(t, err)
+	defer b.Shutdown(ctx)
+
+	for i := range 200 {
+		require.NoError(t, b.Put([]byte{byte(i)}, []byte{byte(i)}))
+		var wg sync.WaitGroup
+		wg.Add(2)
+		go func() {
+			defer wg.Done()
+			b.flushAndSwitchIfThresholdsMet(func() bool { return false })
+		}()
+		go func() {
+			defer wg.Done()
+			require.NoError(t, b.FlushAndSwitch())
+		}()
+		wg.Wait()
+	}
+}
```

---

### Incident Patch 14: `5a639f09` (2026-10-01)
**Commit Message**: Merge pull request #13282 from weaviate/fix/ttl-abort-vs-finish

fix(object-ttl): keep an aborted deletion's slot reserved until it finishes

**File**: `adapters/handlers/rest/clusterapi/object_ttl.go` (modified, +11/-6)
```diff
@@ -120,15 +120,14 @@ func (d *ObjectTTL) incomingDelete() http.Handler {
 
 		var body []objectttl.ObjectsExpiredPayload
 		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
-			d.localStatus.ResetRunning("bad request")
+			d.localStatus.Finish()
 			http.Error(w, "Error parsing JSON body", http.StatusBadRequest)
 			return
 		}
 
 		// run the deletion in a separate goroutine to free up the HTTP handler immediately
 		enterrors.GoWrapper(func() {
-			// make sure to unlock the requestRunning flag when all deletions are done
-			defer d.localStatus.ResetRunning("finished")
+			defer d.localStatus.Finish()
 
 			started := time.Now()
 
@@ -179,9 +178,15 @@ func (d *ObjectTTL) incomingDelete() http.Handler {
 				countDeleted := objsDeletedCounters.CounterFor(className)
 
 				// TODO aliszka:ttl handle graceful index close / drop
-				idx, err := d.remoteIndex.IndexForIncomingWrite(context.Background(), className, classPayload.ClassVersion)
+				idx, err := d.remoteIndex.IndexForIncomingWrite(ttlCtx, className, classPayload.ClassVersion)
 				if err != nil {
-					ec.AddGroups(fmt.Errorf("get index: %w", err), className)
+					// an abort still fails the schema wait as "local index not found:
+					// deadline exceeded", so report the abort instead
+					if cause := context.Cause(ttlCtx); cause != nil {
+						ec.AddGroups(cause, className)
+					} else {
+						ec.AddGroups(fmt.Errorf("get index: %w", err), className)
+					}
 					continue
 				}
 
@@ -203,7 +208,7 @@ func (d *ObjectTTL) incomingAbort() http.Handler {
 		defer r.Body.Close()
 
 		response := objectttl.ObjectsExpiredAbortResponse{
-			Aborted: d.localStatus.ResetRunning("aborted"),
+			Aborted: d.localStatus.Abort(),
 		}
 
 		d.logger.WithFields(logrus.Fields{
```

**File**: `adapters/handlers/rest/clusterapi/object_ttl_test.go` (modified, +226/-1)
```diff
@@ -16,16 +16,18 @@ import (
 	"context"
 	"encoding/json"
 	"errors"
+	"fmt"
 	"net/http"
 	"net/http/httptest"
+	"strings"
+	"sync"
 	"sync/atomic"
 	"testing"
 	"time"
 
 	"github.com/sirupsen/logrus"
 	logrustest "github.com/sirupsen/logrus/hooks/test"
 	"github.com/stretchr/testify/require"
-
 	"github.com/weaviate/weaviate/adapters/handlers/rest/clusterapi"
 	"github.com/weaviate/weaviate/entities/errorcompounder"
 	enterrors "github.com/weaviate/weaviate/entities/errors"
@@ -156,3 +158,226 @@ func ttlSweepReport(hook *logrustest.Hook) *logrus.Entry {
 	}
 	return nil
 }
+
+// waitingTTLSchema stands in for the versioned schema read, which waits for the
+// node to catch up and gives up on its own deadline. waitTimeout stands in for
+// that deadline, and a zero one is a node already caught up.
+type waitingTTLSchema struct {
+	waitTimeout time.Duration
+	entered     chan struct{}
+	once        sync.Once
+}
+
+func (s *waitingTTLSchema) ReadOnlyClassWithVersion(ctx context.Context, class string, _ uint64) (*models.Class, error) {
+	s.once.Do(func() { close(s.entered) })
+
+	if s.waitTimeout == 0 && ctx.Err() == nil {
+		return &models.Class{Class: class}, nil
+	}
+	if s.waitTimeout > 0 {
+		timer := time.NewTimer(s.waitTimeout)
+		defer timer.Stop()
+		select {
+		case <-ctx.Done():
+		case <-timer.C:
+		}
+	}
+	// the real wait reports the version it never reached, carrying neither the
+	// context's error nor its cause, whether it gave up or was cancelled
+	return nil, fmt.Errorf("class %q: schema version not reached", class)
+}
+
+// sweptTTLRepo records the collections the sweep asked it for.
+type sweptTTLRepo struct {
+	lock  sync.Mutex
+	asked []string
+}
+
+func (r *sweptTTLRepo) GetIndexForIncomingSharding(class schema.ClassName) sharding.RemoteIndexIncomingRepo {
+	r.lock.Lock()
+	defer r.lock.Unlock()
+	r.asked = append(r.asked, string(class))
+	return noopTTLIndex{}
+}
+
+func (r *sweptTTLRepo) sweptCollections() []string {
+	r.lock.Lock()
+	defer r.lock.Unlock()
+	return append([]string(nil), r.asked...)
+}
+
+// noopTTLIndex embeds the interface so only the one method the sweep calls is
+// implemented. It dispatches nothing, so the sweep's own flow is what a test sees.
+type noopTTLIndex struct {
+	sharding.RemoteIndexIncomingRepo
+}
+
+func (noopTTLIndex) IncomingDeleteObjectsExpired(context.Context, *enterrors.ErrorGroupWrapper,
+	errorcompounder.ErrorCompounder, string, time.Time, time.Time, func(int32), uint64,
+) {
+}
+
+// ttlTestServer serves the object_ttl endpoints over ttlSchema. The returned
+// outcome reads the handler's log, because the deletion outlives the request.
+func ttlTestServer(t *testing.T, ttlSchema sharding.RemoteIncomingSchema) (
+	server *httptest.Server, repo *sweptTTLRepo, status *objectttl.LocalStatus,
+	sweepOutcome func() (failed error, returned bool),
+) {
+	t.Helper()
+
+	logger, hook := logrustest.NewNullLogger()
+	logger.SetLevel(logrus.DebugLevel)
+
+	repo = &sweptTTLRepo{}
+	status = objectttl.NewLocalStatus()
+	d := clusterapi.NewObjectTTL(sharding.NewRemoteIndexIncoming(repo, ttlSchema, nil),
+		clusterapi.NewNoopAuthHandler(), logger,
+		config.Config{ObjectsTTLConcurrencyFactor: configRuntime.NewDynamicValue[float64](1)},
+		status)
+
+	mux := http.NewServeMux()
+	mux.Handle("/cluster/object_ttl/", d.Expired())
+	server = httptest.NewServer(mux)
+	t.Cleanup(server.Close)
+
+	return server, repo, status, func() (error, bool) {
+		for _, e := range hook.AllEntries() {
+			if !strings.HasPrefix(e.Message, "incoming ttl deletion on remote node f") {
+				continue
+			}
+			failed, _ := e.Data[logrus.ErrorKey].(error)
+			return failed, true
+		}
+		return nil, false
+	}
+}
+
+func postTTLDelete(t *testing.T, server *httptest.Server, collections int) {
+	t.Helper()
+
+	payload := make([]objectttl.ObjectsExpiredPayload, collections)
+	for i := range payload {
+		payload[i] = objectttl.ObjectsExpiredPayload{
+			Class:        fmt.Sprintf("Collection%d", i),
+			ClassVersion: 1,
+			Prop:         "expiresAt",
+			TtlMilli:     time.Now().UnixMilli(),
+			DelMilli:     time.Now().UnixMilli(),
+		}
+	}
+	body, err := json.Marshal(payload)
+	require.NoError(t, err)
+
+	resp, err := http.Post(server.URL+"/cluster/object_ttl/delete_expired",
+		"application/json", bytes.NewReader(body))
+	require.NoError(t, err)
+	require.NoError(t, resp.Body.Close())
+	require.Equal(t, http.StatusAccepted, resp.StatusCode)
+}
+
+// An abort that cannot reach the schema wait leaves the sweep sitting out one
+// schema deadline per collection in the body, holding the slot for all of them.
+func TestIncomingDeleteAbortReachesTheSchemaWait(t *testing.T) {
+	const (
+		collections = 10
+		schemaWait  = 500 * time.Millisecond
+	)
+
+	ttlSchema := &waitingTTLSchema{waitTimeout: schemaWait, entered: make(chan struct{})}
+	server, _, status, sweepOutcome := ttlTestServer(t, ttlSchema)
+
+	sweepReturned := func() bool { _, returned := sweepOutcome(); return returned }
+
+	// the swe
```

**File**: `entities/errors/context.go` (modified, +11/-7)
```diff
@@ -16,20 +16,24 @@ import (
 	"fmt"
 )
 
-func NewCanceledCause(cause string) error {
-	return &CanceledCause{
-		err: fmt.Sprintf("%s: %s", context.Canceled, cause),
+// NewCanceledCause pairs context.Canceled with reason, so a caller can tell one
+// cancellation from another. A nil reason gives back plain context.Canceled,
+// because CanceledCause.Error would render it as "%!s(<nil>)".
+func NewCanceledCause(reason error) error {
+	if reason == nil {
+		return context.Canceled
 	}
+	return &CanceledCause{reason: reason}
 }
 
 type CanceledCause struct {
-	err string
+	reason error
 }
 
 func (c *CanceledCause) Error() string {
-	return c.err
+	return fmt.Sprintf("%s: %s", context.Canceled, c.reason)
 }
 
-func (c *CanceledCause) Unwrap() error {
-	return context.Canceled
+func (c *CanceledCause) Unwrap() []error {
+	return []error{context.Canceled, c.reason}
 }
```

**File**: `entities/errors/context_test.go` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
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
+package errors
+
+import (
+	"context"
+	"errors"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+)
+
+// A cause is matched with errors.Is from both ends, so both arms of the unwrap
+// have to be reachable.
+func TestNewCanceledCause(t *testing.T) {
+	reason := errors.New("aborted")
+
+	withReason := NewCanceledCause(reason)
+	require.ErrorIs(t, withReason, context.Canceled)
+	require.ErrorIs(t, withReason, reason)
+	require.Equal(t, "context canceled: aborted", withReason.Error())
+
+	require.Equal(t, context.Canceled, NewCanceledCause(nil),
+		"no reason is plain context.Canceled, not a cause that prints as one")
+}
```

**File**: `usecases/object_ttl/object_ttl.go` (modified, +30/-5)
```diff
@@ -15,6 +15,7 @@ import (
 	"bytes"
 	"context"
 	"encoding/json"
+	"errors"
 	"fmt"
 	"io"
 	"math/rand"
@@ -172,7 +173,7 @@ func (c *Coordinator) Abort(ctx context.Context, targetOwnNode bool) (bool, erro
 		}
 	}
 
-	localAborted := c.localStatus.ResetRunning("aborted")
+	localAborted := c.localStatus.Abort()
 
 	// abort just on local node
 	if targetOwnNode || len(remoteNodes) == 0 {
@@ -230,7 +231,7 @@ func (c *Coordinator) triggerDeletionObjectsExpiredLocalNode(ctx context.Context
 	if !ok {
 		return fmt.Errorf("another request is still being processed")
 	}
-	defer c.localStatus.ResetRunning("finished")
+	defer c.localStatus.Finish()
 
 	started := time.Now()
 
@@ -520,6 +521,13 @@ func (dc DeletedCounters) ToLogFields(maxCollectionNameLen int) (fields logrus.F
 
 // ----------------------------------------------------------------------------
 
+// A TTL deletion's context is cancelled with one of these, so a caller can match
+// on it with errors.Is instead of reading the message.
+var (
+	ErrAborted  = errors.New("aborted")
+	ErrFinished = errors.New("finished")
+)
+
 // LocalStatus keeps status of ongoing TTL deletion on local node.
 // isRunning is set to true when TTL deletion start and reset when finishes.
 // Status is global per node. Only one deletion can run at a time, following requests
@@ -562,17 +570,34 @@ func (s *LocalStatus) SetRunning() (success bool, ctx context.Context) {
 	return true, s.runningCtx
 }
 
-func (s *LocalStatus) ResetRunning(cause string) (success bool) {
+// Abort cancels the running deletion and reports whether there was one. The slot
+// stays reserved until that deletion finishes, because it observes the
+// cancellation only between batches.
+func (s *LocalStatus) Abort() (aborted bool) {
 	s.lock.Lock()
 	defer s.lock.Unlock()
 
 	if !s.isRunning {
 		return false
 	}
 
-	s.runningCancel(enterrors.NewCanceledCause(cause))
+	s.runningCancel(enterrors.NewCanceledCause(ErrAborted))
+	return true
+}
+
+// Finish releases the slot, cancelling so that nothing still reading the
+// context keeps going. A deletion already aborted keeps the cause it was
+// cancelled with.
+func (s *LocalStatus) Finish() {
+	s.lock.Lock()
+	defer s.lock.Unlock()
+
+	if !s.isRunning {
+		return
+	}
+
+	s.runningCancel(enterrors.NewCanceledCause(ErrFinished))
 
 	s.isRunning = false
 	s.runningCtx, s.runningCancel = nil, nil
-	return true
 }
```

**File**: `usecases/object_ttl/object_ttl_test.go` (modified, +78/-47)
```diff
@@ -198,84 +198,114 @@ func TestLocalState(t *testing.T) {
 		assert.True(t, s.IsRunning(), "should still be running after failed SetRunning")
 	})
 
-	t.Run("ResetRunning succeeds when running and cancels context", func(t *testing.T) {
+	t.Run("Abort cancels the context and keeps the slot", func(t *testing.T) {
 		s := NewLocalStatus()
 		ok, ctx := s.SetRunning()
 		require.True(t, ok)
 		require.NotNil(t, ctx)
 
-		aborted := s.ResetRunning("finished")
+		aborted := s.Abort()
 
 		assert.True(t, aborted)
-		assert.False(t, s.IsRunning())
+		assert.True(t, s.IsRunning(),
+			"the deletion observes the cancellation only between batches, so it is still draining")
 
-		// context must be cancelled
 		select {
 		case <-ctx.Done():
 			// expected
 		default:
-			t.Fatal("context should be done after ResetRunning")
+			t.Fatal("context should be done after Abort")
 		}
+		assert.ErrorIs(t, ctx.Err(), context.Canceled)
+		assert.ErrorIs(t, context.Cause(ctx), ErrAborted)
 	})
 
-	t.Run("ResetRunning sets context error to context.Canceled", func(t *testing.T) {
+	t.Run("Finish cancels the context and releases the slot", func(t *testing.T) {
 		s := NewLocalStatus()
 		ok, ctx := s.SetRunning()
 		require.True(t, ok)
 
-		s.ResetRunning("finished")
+		s.Finish()
 
+		assert.False(t, s.IsRunning())
 		assert.ErrorIs(t, ctx.Err(), context.Canceled)
+		assert.ErrorIs(t, context.Cause(ctx), ErrFinished)
 	})
 
-	t.Run("ResetRunning cause contains the provided reason", func(t *testing.T) {
+	t.Run("an aborted deletion keeps the cause it was aborted with", func(t *testing.T) {
 		s := NewLocalStatus()
 		ok, ctx := s.SetRunning()
 		require.True(t, ok)
 
-		s.ResetRunning("aborted")
+		require.True(t, s.Abort())
+		s.Finish()
 
-		cause := context.Cause(ctx)
-		require.NotNil(t, cause)
-		assert.ErrorIs(t, cause, context.Canceled)
-		assert.Contains(t, cause.Error(), "aborted")
+		assert.ErrorIs(t, context.Cause(ctx), ErrAborted,
+			"a deletion that returned because it was aborted must not report itself as finished")
+		assert.NotErrorIs(t, context.Cause(ctx), ErrFinished)
 	})
 
-	t.Run("ResetRunning fails when not running", func(t *testing.T) {
+	t.Run("an aborted deletion's cleanup cannot cancel its successor", func(t *testing.T) {
 		s := NewLocalStatus()
+		ok, ctx1 := s.SetRunning()
+		require.True(t, ok)
+
+		require.True(t, s.Abort())
+
+		// while the aborted deletion drains, the slot is not up for grabs
+		taken, ctx2 := s.SetRunning()
+		require.False(t, taken, "a successor must not start on top of a draining deletion")
+		require.Nil(t, ctx2)
 
-		aborted := s.ResetRunning("aborted")
+		s.Finish()
+
+		taken, ctx2 = s.SetRunning()
+		require.True(t, taken)
+		require.NotNil(t, ctx2)
+		assert.NoError(t, ctx2.Err(),
+			"the successor's context is its own, not one its predecessor's cleanup reaches")
+		assert.ErrorIs(t, ctx1.Err(), context.Canceled)
+	})
+
+	t.Run("Abort reports false when nothing is running", func(t *testing.T) {
+		s := NewLocalStatus()
+
+		aborted := s.Abort()
 
 		assert.False(t, aborted)
 		assert.False(t, s.IsRunning())
 	})
 
-	t.Run("ResetRunning on fresh LocalStatus returns false", func(t *testing.T) {
+	t.Run("a repeated Abort still reports the draining deletion", func(t *testing.T) {
 		s := NewLocalStatus()
+		ok, _ := s.SetRunning()
+		require.True(t, ok)
+
+		assert.True(t, s.Abort())
+		assert.True(t, s.Abort(), "the deletion has not returned yet, so there is still one to report")
 
-		result := s.ResetRunning("some cause")
+		s.Finish()
 
-		assert.False(t, result)
+		assert.False(t, s.Abort())
 	})
 
-	t.Run("second ResetRunning after first returns false", func(t *testing.T) {
+	t.Run("Finish on a released slot is a no-op", func(t *testing.T) {
 		s := NewLocalStatus()
 		ok, _ := s.SetRunning()
 		require.True(t, ok)
 
-		first := s.ResetRunning("finished")
-		second := s.ResetRunning("finished again")
+		s.Finish()
+		s.Finish()
 
-		assert.True(t, first)
-		assert.False(t, second)
+		assert.False(t, s.IsRunning())
 	})
 
-	t.Run("SetRunning can be called again after ResetRunning", func(t *testing.T) {
+	t.Run("SetRunning can be called again after Finish", func(t *testing.T) {
 		s := NewLocalStatus()
 
 		ok1, ctx1 := s.SetRunning()
 		require.True(t, ok1)
-		s.ResetRunning("finished")
+		s.Finish()
 
 		ok2, ctx2 := s.SetRunning()
 
@@ -293,7 +323,7 @@ func TestLocalState(t *testing.T) {
 
 		ok1, ctx1 := s.SetRunning()
 		require.True(t, ok1)
-		s.ResetRunning("round 1")
+		s.Finish()
 
 		ok2, ctx2 := s.SetRunning()
 		require.True(t, ok2)
@@ -302,7 +332,7 @@ func TestLocalState(t *testing.T) {
 		assert.ErrorIs(t, ctx1.Err(), context.Canceled)
 		assert.NoError(t, ctx2.Err())
 
-		s.ResetRunning("round 2")
+		s.Finish()
 
 		assert.ErrorIs(t, ctx2.Err(), context.Canceled)
 	})
@@ -330,31 +360,32 @@ func TestLocalState(t *testing.T) {
 		assert.True(t, s.IsRunning())
 	})
 
-	t.Run("concurrent ResetRunning calls: only one succeeds", func(t *testing.T) {
+	t.Run("con
```

---

### Incident Patch 15: `e64dd8f6` (2026-10-01)
**Commit Message**: raft: elect a sole voter without waiting for the heartbeat timeout

**File**: `cluster/store.go` (modified, +43/-0)
```diff
@@ -554,6 +554,8 @@ func (st *Store) Open(ctx context.Context) (err error) {
 		"last_snapshot_index":               snapIndex,
 	}).Info("raft node constructed")
 
+	st.electIfSoleVoter(st.raft.Load())
+
 	// There's no hard limit on the migration, so it should take as long as necessary.
 	// However, we believe that 1 day should be more than sufficient.
 	f := func() { st.onLeaderFound(time.Hour * 24) }
@@ -1213,6 +1215,47 @@ func (st *Store) recoverSingleNode(force bool) error {
 	return nil
 }
 
+// electIfSoleVoter starts an election now rather than after the randomized
+// heartbeat timeout (5-10s by default) when this node is the only voter: it
+// would elect itself anyway, so only the timing changes. Lowering the heartbeat
+// timeout makes a follower's timer fire at once; the configured value is put
+// back right away.
+func (st *Store) electIfSoleVoter(rn *raft.Raft) {
+	fut := rn.GetConfiguration()
+	if err := fut.Error(); err != nil {
+		st.log.Warnf("cannot read raft configuration to check for a sole voter: %v", err)
+		return
+	}
+	if !isSoleVoter(fut.Configuration(), raft.ServerID(st.cfg.NodeID)) {
+		return
+	}
+
+	configured := rn.ReloadableConfig()
+	lowered := configured
+	lowered.HeartbeatTimeout--
+	if err := rn.ReloadConfig(lowered); err != nil {
+		st.log.Warnf("cannot start an immediate election as the sole voter, waiting for the heartbeat timeout: %v", err)
+		return
+	}
+	if err := rn.ReloadConfig(configured); err != nil {
+		st.log.Errorf("cannot restore the raft heartbeat timeout to %s: %v", configured.HeartbeatTimeout, err)
+		return
+	}
+	st.log.WithField("action", "raft_sole_voter").Info("this node is the only voter, starting the election now")
+}
+
+func isSoleVoter(c raft.Configuration, id raft.ServerID) bool {
+	voters, self := 0, false
+	for _, s := range c.Servers {
+		if s.Suffrage != raft.Voter {
+			continue
+		}
+		voters++
+		self = self || s.ID == id
+	}
+	return voters == 1 && self
+}
+
 // setClusterID records the cluster identity in memory, set-once (first
 // writer wins; a duplicate from replay or snapshot restore is a logged no-op).
 func (st *Store) setClusterID(clusterID string) {
```

**File**: `cluster/store_cluster_rpc.go` (modified, +2/-0)
```diff
@@ -140,6 +140,8 @@ func (st *Store) Notify(id, addr string) (err error) {
 			"action": "bootstrap",
 			"warn":   err,
 		}).Warn("bootstrapping cluster")
+	} else {
+		st.electIfSoleVoter(st.raft.Load())
 	}
 	st.bootstrapped.Store(true)
 	return nil
```

**File**: `cluster/store_cluster_rpc_test.go` (modified, +101/-0)
```diff
@@ -16,8 +16,12 @@ import (
 	"fmt"
 	"sync"
 	"testing"
+	"time"
 
+	"github.com/hashicorp/raft"
+	"github.com/prometheus/client_golang/prometheus"
 	logrustest "github.com/sirupsen/logrus/hooks/test"
+	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/mock"
 	"github.com/stretchr/testify/require"
 
@@ -87,3 +91,100 @@ func TestNotifyConcurrentBootstrapOnce(t *testing.T) {
 	require.True(t, st.bootstrapped.Load())
 	require.Zero(t, st.candidatesLen())
 }
+
+// raftHeartbeatTimeout is the raft default times the default RAFT_TIMEOUTS_MULTIPLIER:
+// an election that waits for it cannot start within 5s.
+const raftHeartbeatTimeout = 5 * time.Second
+
+func openRaftForElectionTest(t *testing.T, m *MockStore) *Raft {
+	t.Helper()
+	s := NewFSM(m.cfg, nil, prometheus.NewPedanticRegistry())
+	s.schemaManager.SetReplicationFSM(m.replicationFSM)
+	m.store = &s
+	srv := NewRaft(mocks.NewMockNodeSelector(), m.store, nil)
+	require.NoError(t, srv.Open(context.Background(), m.indexer))
+	return srv
+}
+
+func newElectionTestStore(t *testing.T) MockStore {
+	t.Helper()
+	m := NewMockStore(t, "Node-1", utils.MustGetFreeTCPPort())
+	m.cfg.HeartbeatTimeout = raftHeartbeatTimeout
+	m.cfg.ElectionTimeout = raftHeartbeatTimeout
+	m.indexer.On("Open", mock.Anything).Return(nil)
+	m.indexer.On("Close", mock.Anything).Return(nil)
+	m.indexer.On("TriggerSchemaUpdateCallbacks").Return()
+	return m
+}
+
+// TestSoleVoterElectsWithoutWaitingForHeartbeatTimeout pins that a node that
+// is the only voter elects itself at once, on a first start and on a restart,
+// and keeps its configured heartbeat timeout.
+func TestSoleVoterElectsWithoutWaitingForHeartbeatTimeout(t *testing.T) {
+	ctx := context.Background()
+	m := newElectionTestStore(t)
+	addr := fmt.Sprintf("%s:%d", m.cfg.Host, m.cfg.RaftPort)
+
+	requireLeaderBeforeHeartbeatTimeout := func(srv *Raft) {
+		t.Helper()
+		require.True(t, tryNTimesWithWait(200, 10*time.Millisecond, srv.store.IsLeader),
+			"node did not become leader within 2s")
+		require.Equal(t, raftHeartbeatTimeout, srv.store.raft.Load().ReloadableConfig().HeartbeatTimeout)
+	}
+
+	// first start: the single-node bootstrap goes through Notify
+	srv := openRaftForElectionTest(t, &m)
+	require.NoError(t, srv.store.Notify(m.cfg.NodeID, addr))
+	requireLeaderBeforeHeartbeatTimeout(srv)
+	require.NoError(t, srv.Close(ctx))
+
+	// restart: the configuration is read back from the raft log
+	srv = openRaftForElectionTest(t, &m)
+	defer srv.Close(ctx)
+	requireLeaderBeforeHeartbeatTimeout(srv)
+}
+
+// TestSharedVoteKeepsHeartbeatTimeout pins that a node that shares the vote
+// with other voters does not start an election before its heartbeat timeout.
+func TestSharedVoteKeepsHeartbeatTimeout(t *testing.T) {
+	ctx := context.Background()
+	m := newElectionTestStore(t)
+	m.cfg.BootstrapExpect = 3
+	srv := openRaftForElectionTest(t, &m)
+	defer srv.Close(ctx)
+
+	require.NoError(t, srv.store.Notify(m.cfg.NodeID, fmt.Sprintf("%s:%d", m.cfg.Host, m.cfg.RaftPort)))
+	require.NoError(t, srv.store.Notify("Node-2", "127.0.0.1:1"))
+	require.NoError(t, srv.store.Notify("Node-3", "127.0.0.1:2"))
+	require.True(t, srv.store.bootstrapped.Load())
+
+	rn := srv.store.raft.Load()
+	assert.False(t, tryNTimesWithWait(100, 10*time.Millisecond, func() bool {
+		return rn.State() != raft.Follower
+	}), "node started an election before its heartbeat timeout")
+	assert.Equal(t, raftHeartbeatTimeout, rn.ReloadableConfig().HeartbeatTimeout)
+}
+
+func TestIsSoleVoter(t *testing.T) {
+	voter := func(id string) raft.Server { return raft.Server{ID: raft.ServerID(id), Suffrage: raft.Voter} }
+	nonvoter := func(id string) raft.Server { return raft.Server{ID: raft.ServerID(id), Suffrage: raft.Nonvoter} }
+
+	tests := []struct {
+		name    string
+		servers []raft.Server
+		want    bool
+	}{
+		{name: "empty configuration", servers: nil, want: false},
+		{name: "only voter", servers: []raft.Server{voter("self")}, want: true},
+		{name: "only voter with non-voters", servers: []raft.Server{voter("self"), nonvoter("b")}, want: true},
+		{name: "another node is the only voter", servers: []raft.Server{voter("b")}, want: false},
+		{name: "non-voter beside the only voter", servers: []raft.Server{nonvoter("self"), voter("b")}, want: false},
+		{name: "shared vote", servers: []raft.Server{voter("self"), voter("b"), voter("c")}, want: false},
+		{name: "staging", servers: []raft.Server{voter("self"), {ID: "b", Suffrage: raft.Staging}}, want: true},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.Equal(t, tt.want, isSoleVoter(raft.Configuration{Servers: tt.servers}, "self"))
+		})
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #13434** (2026-10-05): Gate wl/ code behind a license decision made outside wl/ (@jeroiraz)
- **PR #13430** (2026-10-05): Merge stable/v1.40 into main (@antas-marcin)
- **PR #13420** (2026-10-05): Merge stable/v1.39 into stable/v1.40 (@antas-marcin)
- **PR #13419** (2026-10-05): prepare release v1.39.9 (@antas-marcin)
- **PR #13418** (2026-10-05): Merge stable/v1.38 into stable/v1.39 (@antas-marcin)
- **PR #13417** (2026-10-05): Merge stable/v1.38 into stable/v1.39 (@antas-marcin)
- **PR #13411** (2026-10-05): Exclude main from auto-generation to avoid write strings of go code to files to get around it (@tsmith023)
- **PR #13403** (2026-10-05): fix(modules): read a fractional json.Number in float module settings (@jfrancoa)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

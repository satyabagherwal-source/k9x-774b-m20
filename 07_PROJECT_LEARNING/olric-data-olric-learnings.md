# Forensic Learning Record (Deep Inspection): olric-data/olric

> **Canonical Artifact**: `07_PROJECT_LEARNING/olric-data-olric-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/olric-data/olric](https://github.com/olric-data/olric))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:20:44.906Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `olric-data/olric`
- **Description**: Distributed, in-memory key/value store and cache. It can be used as an embedded Go library and a language-independent service.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3497 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `config/engine.go`
```
// Copyright 2018-2026 The Olric Authors
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

package config

import (
	"fmt"

	"github.com/olric-data/olric/internal/ramblock"
	"github.com/olric-data/olric/pkg/storage"
)

// Engine contains storage engine configuration and their implementations.
// If you don't have a custom storage engine implementation or configuration for
// the default one, just call NewStorageEngine() function to use it with sane defaults.
type Engine struct {
	Name string

	Implementation storage.Engine

	// Config is a map that contains configuration of the storage engines, for
	// both plugins and imported ones. If you want to use a storage engine other
	// than the default one, you must set configuration for it.
	Config map[string]interface{}
}

// NewEngine initializes Engine with sane defaults.
// Olric will set its own storage engine implementation and related configuration,
// if there is no other engine.
func NewEngine() *Engine {
	return &Engine{
		Config: make(map[string]interface{}),
	}
}

// Validate finds errors in the current configuration.
func (s *Engine) Validate() error {
	if s.Config == nil {
		s.Config = make(map[string]interface{})
	}
	return nil
}

// Sanitize sets default values to empty configuration variables, if it's possible.
func (s *Engine) Sanitize() error {
	if s.Name == "" {
		s.Name = DefaultStorageEngine
	}

	// Backward compatibility: accept the old name "kvstore"
	if s.Name == "kvstore" {
		s.Name = DefaultStorageEngine
	}

	if s.Implementation == nil {
		switch s.Name {
		case DefaultStorageEngine:
			cfg := ramblock.DefaultConfig().ToMap()
			for key, value := range cfg {
				_, ok := s.Config[key]
				if !ok {
					s.Config[key] = value
				}
			}
			kv, err := ramblock.New(storage.NewConfig(s.Config))
			if err != nil {
				return err
			}
			s.Implementation = kv
		default:
			return fmt.Errorf("unknown storage engine: %s", s.Name)
		}
	} else {
		s.Name = s.Implementation.Name()
	}
	return nil
}

// Interface guard
var _ IConfig = (*Engine)(nil)

```

### Core Architecture Module: `internal/util/safe.go`
```
// Copyright (c) 2013 The github.com/go-redis/redis Authors.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:

// * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
// * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.

// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

//go:build appengine
// +build appengine

package util

func BytesToString(b []byte) string {
	return string(b)
}

func StringToBytes(s string) []byte {
	return []byte(s)
}

```

### Core Architecture Module: `internal/util/strconv.go`
```
// Copyright (c) 2013 The github.com/go-redis/redis Authors.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:

// * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
// * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.

// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

package util

import "strconv"

func Atoi(b []byte) (int, error) {
	return strconv.Atoi(BytesToString(b))
}

func ParseInt(b []byte, base int, bitSize int) (int64, error) {
	return strconv.ParseInt(BytesToString(b), base, bitSize)
}

func ParseUint(b []byte, base int, bitSize int) (uint64, error) {
	return strconv.ParseUint(BytesToString(b), base, bitSize)
}

func ParseFloat(b []byte, bitSize int) (float64, error) {
	return strconv.ParseFloat(BytesToString(b), bitSize)
}

```

### Core Architecture Module: `internal/util/unsafe.go`
```
// Copyright (c) 2013 The github.com/go-redis/redis Authors.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:

// * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
// * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.

// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

//go:build !appengine
// +build !appengine

package util

import (
	"unsafe"
)

// BytesToString converts byte slice to string.
func BytesToString(b []byte) string {
	return *(*string)(unsafe.Pointer(&b))
}

// StringToBytes converts string to byte slice.
func StringToBytes(s string) []byte {
	return *(*[]byte)(unsafe.Pointer(
		&struct {
			string
			Cap int
		}{s, len(s)},
	))
}

```

### Core Architecture Module: `pkg/storage/engine.go`
```
// Copyright 2018-2026 The Olric Authors
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

package storage

import (
	"errors"
	"log"
)

// ErrKeyTooLarge is an error that indicates the given key is larger than the determined key size.
// The current maximum key length is 256.
var ErrKeyTooLarge = errors.New("key too large")

// ErrEntryTooLarge returned if required space for an entry is bigger than table size.
var ErrEntryTooLarge = errors.New("entry too large for the configured table size")

// ErrKeyNotFound is an error that indicates that the requested key could not be found in the DB.
var ErrKeyNotFound = errors.New("key not found")

// ErrNotImplemented means that the interface implementation does not support
// the functionality required to fulfill the request.
var ErrNotImplemented = errors.New("not implemented yet")

// TransferIterator is an interface to implement iterators to encode and transfer
// the underlying tables to another Olric member.
type TransferIterator interface {
	// Next returns true if there are more tables to Export in the storage instance.
	// Otherwise, it returns false.
	Next() bool

	// Export encodes a table and returns result. This encoded table can be moved to another Olric node.
	Export() ([]byte, int, error)

	// Drop drops a table with its index from the storage engine instance and frees allocated resources.
	Drop(int) error
}

// Engine defines methods for a storage engine implementation.
type Engine interface {
	// SetConfig sets a storage engine configuration. nil can be accepted, but
	// it depends on the implementation.
	SetConfig(*Config)

	// SetLogger sets a logger. nil can be accepted, but it depends on the implementation.
	SetLogger(*log.Logger)

	// Start can be used to run background services before starting operation.
	Start() error

	// NewEntry returns a new Entry interface implemented by the current storage
	// engine implementation.
	NewEntry() Entry

	// Name returns name of the current storage engine implementation.
	Name() string

	// Fork creates an empty instance of an online engine by using the current
	// configuration.
	Fork(*Config) (Engine, error)

	// PutRaw inserts an encoded entry into the storage engine.
	PutRaw(uint64, []byte) error

	// Put inserts a new Entry into the storage engine.
	Put(uint64, Entry) error

	// GetRaw reads an encoded entry from the storage engine.
	GetRaw(uint64) ([]byte, error)

	// Get reads an entry from the storage engine.
	Get(uint64) (Entry, error)

	// GetTTL extracts TTL of an entry.
	GetTTL(uint64) (int64, error)

	// GetLastAccess extracts LastAccess of an entry.
	GetLastAccess(uint64) (int64, error)

	// GetKey extracts key of an entry.
	GetKey(uint64) (string, error)

	// Delete deletes an entry from the storage engine.
	Delete(uint64) error

	// UpdateTTL updates TTL of an entry. It returns ErrKeyNotFound,
	// if the key doesn't exist.
	UpdateTTL(uint64, Entry) error

	// TransferIterator returns a new TransferIterator instance to the caller.
	TransferIterator() TransferIterator

	// Import imports an encoded table of the storage engine implementation and
	// calls f for every Entry item in that table.
	Import(data []byte, f func(uint64, Entry) error) error

	// Stats returns metrics for an online storage engine.
	Stats() Stats

	// Check returns true, if the key exists.
	Check(uint64) bool

	// Range implements a loop over the storage engine
	Range(func(uint64, Entry) bool)

	// RangeHKey implements a loop for hashed keys(HKeys).
	RangeHKey(func(uint64) bool)

	// Scan implements an iterator. The caller starts iterating from the cursor. "count" is the number of entries
	// that will be returned during the iteration. Scan calls the function "f" on Entry items for every iteration.
	//It returns the next cursor if everything is okay. Otherwise, it returns an error.
	Scan(cursor uint64, count int, f func(Entry) bool) (uint64, error)

	// ScanRegexMatch is the same with the Scan method, but it supports regular expressions on keys.
	ScanRegexMatch(cursor uint64, match string, count int, f func(Entry) bool) (uint64, error)

	// Compaction reorganizes storage tables and reclaims wasted resources.
	Compaction() (bool, error)

	// Close stops an online storage engine instance. It may free some of allocated
	// resources. A storage engine implementation should be started again, but it
	// depends on the implementation.
	Close() error

	// Destroy stops an online storage engine instance and frees allocated resources.
	// It should not be possible to reuse a destroyed storage engine.
	Destroy() error
}

```

### Core Architecture Module: `auth.go`
```
// Copyright 2018-2026 The Olric Authors
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

package olric

import (
	"errors"

	"github.com/olric-data/olric/internal/protocol"
	"github.com/olric-data/olric/internal/server"
	"github.com/tidwall/redcon"
)

// authCommandHandler handles authentication requests sent by clients and verifies the provided password for access.
func (db *Olric) authCommandHandler(conn redcon.Conn, cmd redcon.Command) {
	authCmd, err := protocol.ParseAuthCommand(cmd)
	if err != nil {
		protocol.WriteError(conn, err)
		return
	}

	if !db.config.Authentication.Enabled() {
		protocol.WriteError(conn, errors.New("AUTH <password> called without any password configured for the default user. Are you sure your configuration is correct?"))
		return
	}

	if authCmd.Password == db.config.Authentication.Password {
		ctx := conn.Context().(*server.ConnContext)
		ctx.SetAuthenticated(true)
		conn.WriteString(protocol.StatusOK)
		return
	}
	protocol.WriteError(conn, ErrWrongPass)
}

```

### Core Architecture Module: `client.go`
```
// Copyright 2018-2026 The Olric Authors
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

package olric

import (
	"context"
	"time"

	"github.com/olric-data/olric/internal/dmap"
	"github.com/olric-data/olric/pkg/storage"
	"github.com/olric-data/olric/stats"
)

const DefaultScanCount = 10

// Member denotes a member of the Olric cluster.
type Member struct {
	// Member name in the cluster. It's also host:port of the node.
	Name string

	// ID of the Member in the cluster. Hash of Name and Birthdate of the member
	ID uint64

	// Birthdate of the member in nanoseconds.
	Birthdate int64

	// Role of the member in the cluster. There is only one coordinator member
	// in a healthy cluster.
	Coordinator bool
}

// Iterator defines an interface to implement iterators on the distributed maps.
type Iterator interface {
	// Next returns true if there is more key in the iterator implementation.
	// Otherwise, it returns false.
	Next() bool

	// Key returns a key name from the distributed map.
	Key() string

	// Close stops the iteration and releases allocated resources.
	Close()
}

// LockContext interface defines methods to manage locks on distributed maps.
type LockContext interface {
	// Unlock releases an acquired lock for the given key. It returns ErrNoSuchLock
	// if there is no lock for the given key.
	Unlock(ctx context.Context) error

	// Lease sets or updates the timeout of the acquired lock for the given key.
	// It returns ErrNoSuchLock if there is no lock for the given key.
	Lease(ctx context.Context, duration time.Duration) error
}

// PutOption is a function for define options to control behavior of the Put command.
type PutOption func(*dmap.PutConfig)

// EX sets the specified expire time, in seconds.
func EX(ex time.Duration) PutOption {
	return func(cfg *dmap.PutConfig) {
		cfg.HasEX = true
		cfg.EX = ex
	}
}

// PX sets the specified expire time, in milliseconds.
func PX(px time.Duration) PutOption {
	return func(cfg *dmap.PutConfig) {
		cfg.HasPX = true
		cfg.PX = px
	}
}

// EXAT sets the specified Unix time at which the key will expire, in seconds.
func EXAT(exat time.Duration) PutOption {
	return func(cfg *dmap.PutConfig) {
		cfg.HasEXAT = true
		cfg.EXAT = exat
	}
}

// PXAT sets the specified Unix time at which the key will expire, in milliseconds.
func PXAT(pxat time.Duration) PutOption {
	return func(cfg *dmap.PutConfig) {
		cfg.HasPXAT = true
		cfg.PXAT = pxat
	}
}

// NX only sets the key if it does not already exist.
func NX() PutOption {
	return func(cfg *dmap.PutConfig) {
		cfg.HasNX = true
	}
}

// XX only sets the key if it already exists.
func XX() PutOption {
	return func(cfg *dmap.PutConfig) {
		cfg.HasXX = true
	}
}

type dmapConfig struct {
	storageEntryImplementation func() storage.Entry
}

// DMapOption is a function for defining options to control behavior of distributed map instances.
type DMapOption func(*dmapConfig)

// StorageEntryImplementation sets and encoder/decoder implementation for your choice of storage engine.
func StorageEntryImplementation(e func() storage.Entry) DMapOption {
	return func(cfg *dmapConfig) {
		cfg.storageEntryImplementation = e
	}
}

// ScanOption is a function for defining options to control behavior of the SCAN command.
type ScanOption func(*dmap.ScanConfig)

// Count is the user specified the amount of work that should be done at every call in order to
// retrieve elements from the distributed map. This is just a hint for the implementation,
// however generally speaking this is what you could expect most of the time from the implementation.
// The default value is 10.
func Count(c int) ScanOption {
	return func(cfg *dmap.ScanConfig) {
		cfg.HasCount = true
		cfg.Count = c
	}
}

// Match is used for using regular expressions on keys. See https://pkg.go.dev/regexp
func Match(s string) ScanOption {
	return func(cfg *dmap.ScanConfig) {
		cfg.HasMatch = true
		cfg.Match = s
	}
}

// DMap defines methods to access and manipulate distributed maps.
type DMap interface {
	// Name exposes name of the DMap.
	Name() string

	// Put sets the value for the given key. It overwrites any previous value for
	// that key, and it's thread-safe. The key has to be a string. value type is arbitrary.
	// It is safe to modify the contents of the arguments after Put returns but not before.
	Put(ctx context.Context, key string, value interface{}, options ...PutOption) error

	// Get gets the value for the given key. It returns ErrKeyNotFound if the DB
	// does not contain the key. It's thread-safe. It is safe to modify the contents
	// of the returned value. See GetResponse for the details.
	Get(ctx context.Context, key string) (*GetResponse, error)

	// Delete deletes values for the given keys. Delete will not return error
	// if key doesn't exist. It's thread-safe. It is safe to modify the contents
	// of the argument after Delete returns.
	Delete(ctx context.Context, keys ...string) (int, error)

	// Incr atomically increments the key by delta. The return value is the new value
	// after being incremented or an error.
	Incr(ctx context.Context, key string, delta int) (int, error)

	// Decr atomically decrements the key by delta. The return value is the new value
	// after being decremented or an error.
	Decr(ctx context.Context, key string, delta int) (int, error)

	// GetPut atomically sets the key to value and returns the old value stored at key. It returns nil if there is no
	// previous value.
	GetPut(ctx context.Context, key string, value interface{}) (*GetResponse, error)

	// CompareAndSwap atomically replaces the value stored at key with newValue
	// iff the raw value bytes currently stored equal expected. A nil or empty
	// expected argument means "compare against key non-existence" — the swap
	// succeeds only if the key does not currently exist.
	//
	// On success it returns (true, nil, nil) and the new value is stored. On
	// mismatch it returns (false, current, nil) where current is the authoritative
	// present value (or nil if the key does not exist), allowing the caller to
	// retry without another Get. TTL options behave exactly like Put.
	//
	// Unlike GetPut/Incr, CompareAndSwap serializes cluster-wide: the fragment
	// lock and atomic-key lock are both taken on the partition owner, and the
	// operation is dispatched there regardless of which node the caller runs on.
	CompareAndSwap(
		ctx context.Context,
		key string,
		expected []byte,
		newValue interface{},
		options ...PutOption,
	) (swapped bool, current *GetResponse, err error)

	// IncrByFloat atomically increments the key by delta. The return value is the new value
	// after being incremented or an error.
	IncrByFloat(ctx context.Context, key string, delta float64) (float64, error)

	// Expire updates the expiry for the given key. It returns ErrKeyNotFound if
	// the DB does not contain the key. It's thread-safe.
	Expire(ctx context.Context, key string, timeout time.Duration) error

	// Lock sets a lock for the given key. Acquired lock is only for the key in
	// this dmap.
	//
	// It returns immediately if it acquires the lock for the given key. Otherwise,
	// it waits until deadline.
	//
	// You should know that the locks are approximate, and only to be used for
	// non-critical purposes.
	Lock(ctx context.Context, key string, deadline time.Duration) (LockContext, error)

	// LockWithTimeout sets a lock for the given key. If the lock is still unreleased
	// the end of given period of time,
	// it automatically releases the lock. Acquired lock is only for the key in
	// this dmap.
	//
	// It returns immediately if it acquires the lock for the given key. Otherwise,
	// it waits until deadline.
	//
	// You should know that the locks are approximate, and only to be used for
	// non-critical purposes.
	LockWithTimeout(ctx context.Context, key string, timeout, deadline time.Duration) (LockContext, error)

	// Scan returns an iterator to loop over the keys.
	//
	// Available scan options:
	//
	// * Count
	// * Match
	Scan(ctx context.Context, options ...ScanOption) (Iterator, error)

	// Destroy flushes the given DMap on the cluster. You should know that there
	// is no global lock on DMaps. So if you call Put/PutEx and Destroy methods
	// concurrently on the cluster, Put call may set new values to the DMap.
	Destroy(ctx context.Context) error

	// Pipeline is a mechanism to realise Redis Pipeline technique.
	//
	// Pipelining is a technique to extremely speed up processing by packing
	// operations to batches, send them at once to Redis and read a replies in a
	// singe step.
	// See https://redis.io/topics/pipelining
	//
	// Pay attention, that Pipeline is not a transaction, so you can get unexpected
	// results in case of big pipelines and small read/write timeouts.
	// Redis client has retransmission logic in case of timeouts, pipeline
	// can be retransmitted and commands can be executed more than once.
	Pipeline(opts ...PipelineOption) (*DMapPipeline, error)

	// Close stops background routines and frees allocated resources.
	Close(ctx context.Context) error
}

// PipelineOption is a function for defining options to control behavior of the Pipeline command.
type PipelineOption func(pipeline *DMapPipeline)

// PipelineConcurrency is a PipelineOption controlling the number of concurrent goroutines.
func PipelineConcurrency(concurrency int) PipelineOption {
	return func(dp *DMapPipeline) {
		dp.concurrency = concurrency
	}
}

type statsConfig struct {
	CollectRuntime bool
}

// StatsOption i
```

### Core Architecture Module: `cluster.go`
```
// Copyright 2018-2026 The Olric Authors
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

package olric

import (
	"context"
	"fmt"
	"strconv"

	"github.com/olric-data/olric/internal/protocol"
	"github.com/tidwall/redcon"
)

type Route struct {
	PrimaryOwners []string
	ReplicaOwners []string
}

type RoutingTable map[uint64]Route

func mapToRoutingTable(slice []interface{}) (RoutingTable, error) {
	rt := make(RoutingTable)
	for _, raw := range slice {
		item := raw.([]interface{})
		rawPartID, rawPrimaryOwners, rawReplicaOwners := item[0], item[1], item[2]
		var partID uint64
		switch rawPartID.(type) {
		case int64:
			partID = uint64(rawPartID.(int64))
		case string:
			raw, err := strconv.ParseUint(rawPartID.(string), 10, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid partition id: %v: %w", rawPartID, err)
			}
			partID = raw
		default:
			return nil, fmt.Errorf("invalid partition id: %v", rawPartID)
		}

		r := Route{}
		primaryOwners, ok := rawPrimaryOwners.([]interface{})
		if !ok {
			return nil, fmt.Errorf("invalid primary owners: %v", rawPrimaryOwners)
		}
		for _, rawOwner := range primaryOwners {
			owner, ok := rawOwner.(string)
			if !ok {
				return nil, fmt.Errorf("invalid owner: %v", owner)
			}
			r.PrimaryOwners = append(r.PrimaryOwners, owner)
		}

		replicaOwners, ok := rawReplicaOwners.([]interface{})
		if !ok {
			return nil, fmt.Errorf("invalid replica owners: %v", rawPrimaryOwners)
		}
		for _, rawOwner := range replicaOwners {
			owner, ok := rawOwner.(string)
			if !ok {
				return nil, fmt.Errorf("invalid owner: %v", owner)
			}
			r.ReplicaOwners = append(r.ReplicaOwners, owner)
		}
		rt[partID] = r
	}
	return rt, nil
}

func (db *Olric) clusterRoutingTableCommandHandler(conn redcon.Conn, cmd redcon.Command) {
	_, err := protocol.ParseClusterRoutingTable(cmd)
	if err != nil {
		protocol.WriteError(conn, err)
		return
	}
	coordinator := db.rt.Discovery().GetCoordinator()
	if coordinator.CompareByID(db.rt.This()) {
		conn.WriteArray(int(db.config.PartitionCount))
		rt := db.fillRoutingTable()
		for partID := uint64(0); partID < db.config.PartitionCount; partID++ {
			conn.WriteArray(3)
			conn.WriteUint64(partID)

			r := rt[partID]
			primaryOwners := r.PrimaryOwners
			conn.WriteArray(len(primaryOwners))
			for _, owner := range primaryOwners {
				conn.WriteBulkString(owner)
			}

			replicaOwners := r.ReplicaOwners
			conn.WriteArray(len(replicaOwners))
			for _, owner := range replicaOwners {
				conn.WriteBulkString(owner)
			}
		}
		return
	}

	// Redirect to the cluster coordinator
	rtCmd := protocol.NewClusterRoutingTable().Command(db.ctx)
	rc := db.client.Get(coordinator.String())
	err = rc.Process(db.ctx, rtCmd)
	if err != nil {
		protocol.WriteError(conn, err)
		return
	}
	slice, err := rtCmd.Slice()
	if err != nil {
		protocol.WriteError(conn, err)
		return
	}
	conn.WriteAny(slice)
}

func (db *Olric) fillRoutingTable() RoutingTable {
	rt := make(RoutingTable)
	for partID := uint64(0); partID < db.config.PartitionCount; partID++ {
		r := Route{}
		primaryOwners := db.primary.PartitionOwnersByID(partID)
		for _, owner := range primaryOwners {
			r.PrimaryOwners = append(r.PrimaryOwners, owner.String())
		}
		replicaOwners := db.backup.PartitionOwnersByID(partID)
		for _, owner := range replicaOwners {
			r.ReplicaOwners = append(r.ReplicaOwners, owner.String())
		}
		rt[partID] = r
	}
	return rt
}

func (db *Olric) routingTable(ctx context.Context) (RoutingTable, error) {
	coordinator := db.rt.Discovery().GetCoordinator()
	if coordinator.CompareByID(db.rt.This()) {
		return db.fillRoutingTable(), nil
	}

	rtCmd := protocol.NewClusterRoutingTable().Command(ctx)
	rc := db.client.Get(coordinator.String())
	err := rc.Process(ctx, rtCmd)
	if err != nil {
		return nil, err
	}
	slice, err := rtCmd.Slice()
	if err != nil {
		return nil, err
	}
	return mapToRoutingTable(slice)
}

func (db *Olric) clusterMembersCommandHandler(conn redcon.Conn, cmd redcon.Command) {
	_, err := protocol.ParseClusterMembers(cmd)
	if err != nil {
		protocol.WriteError(conn, err)
		return
	}

	coordinator := db.rt.Discovery().GetCoordinator()
	members := db.rt.Discovery().GetMembers()
	conn.WriteArray(len(members))
	for _, member := range members {
		conn.WriteArray(3)
		conn.WriteBulkString(member.Name)
		// go-redis/redis package cannot handle uint64. At the time of this writing,
		// there is no solution for this, and I don't want to use a soft fork to repair it.
		//conn.WriteUint64(member.ID)
		conn.WriteInt64(member.Birthdate)
		if coordinator.CompareByID(member) {
			conn.WriteBulkString("true")
		} else {
			conn.WriteBulkString("false")
		}
	}
}

```

### Core Architecture Module: `cluster_client.go`
```
// Copyright 2018-2026 The Olric Authors
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

package olric

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"os"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/olric-data/olric/config"
	"github.com/olric-data/olric/hasher"
	"github.com/olric-data/olric/internal/bufpool"
	"github.com/olric-data/olric/internal/cluster/partitions"
	"github.com/olric-data/olric/internal/discovery"
	"github.com/olric-data/olric/internal/dmap"
	"github.com/olric-data/olric/internal/protocol"
	"github.com/olric-data/olric/internal/ramblock/entry"
	"github.com/olric-data/olric/internal/resp"
	"github.com/olric-data/olric/internal/server"
	"github.com/olric-data/olric/pkg/storage"
	"github.com/olric-data/olric/stats"
	"github.com/redis/go-redis/v9"
)

var pool = bufpool.New()

// DefaultRoutingTableFetchInterval is the default value of RoutingTableFetchInterval. ClusterClient implementation
// fetches the routing table from the cluster to route requests to the right partition.
const DefaultRoutingTableFetchInterval = time.Minute

type ClusterLockContext struct {
	key   string
	token string
	dm    *ClusterDMap
}

// ClusterDMap implements a client for DMaps.
type ClusterDMap struct {
	name          string
	newEntry      func() storage.Entry
	config        *dmapConfig
	client        *server.Client
	clusterClient *ClusterClient
}

// Name exposes name of the DMap.
func (dm *ClusterDMap) Name() string {
	return dm.name
}

// processProtocolError processes protocol-related errors and translates them into defined application-level errors.
func processProtocolError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, redis.Nil) {
		return ErrKeyNotFound
	}
	if errors.Is(err, syscall.ECONNREFUSED) {
		opErr := err.(*net.OpError)
		return fmt.Errorf("%s %s %s: %w", opErr.Op, opErr.Net, opErr.Addr, ErrConnRefused)
	}
	return convertDMapError(protocol.ConvertError(err))
}

// writePutCommand constructs and returns a new protocol.Put command based on the provided key, value, and configuration options.
func (dm *ClusterDMap) writePutCommand(c *dmap.PutConfig, key string, value []byte) *protocol.Put {
	cmd := protocol.NewPut(dm.name, key, value)
	switch {
	case c.HasEX:
		cmd.SetEX(c.EX.Seconds())
	case c.HasPX:
		cmd.SetPX(c.PX.Milliseconds())
	case c.HasEXAT:
		cmd.SetEXAT(c.EXAT.Seconds())
	case c.HasPXAT:
		cmd.SetPXAT(c.PXAT.Milliseconds())
	}

	switch {
	case c.HasNX:
		cmd.SetNX()
	case c.HasXX:
		cmd.SetXX()
	}

	return cmd
}

func (cl *ClusterClient) clientByPartID(partID uint64) (*redis.Client, error) {
	raw := cl.routingTable.Load()
	if raw == nil {
		return nil, fmt.Errorf("routing table is empty")
	}

	routingTable, ok := raw.(RoutingTable)
	if !ok {
		return nil, fmt.Errorf("routing table is corrupt")
	}

	route := routingTable[partID]
	if len(route.PrimaryOwners) == 0 {
		return nil, fmt.Errorf("primary owners list for %d is empty", partID)
	}

	primaryOwner := route.PrimaryOwners[len(route.PrimaryOwners)-1]
	return cl.client.Get(primaryOwner), nil
}

func (cl *ClusterClient) smartPick(dmap, key string) (*redis.Client, error) {
	hkey := partitions.HKey(dmap, key)
	partID := hkey % cl.partitionCount
	return cl.clientByPartID(partID)
}

// Put sets the value for the given key. It overwrites any previous value for
// that key, and it's thread-safe. The key has to be a string. value type is arbitrary.
// It is safe to modify the contents of the arguments after Put returns but not before.
func (dm *ClusterDMap) Put(ctx context.Context, key string, value interface{}, options ...PutOption) error {
	rc, err := dm.clusterClient.smartPick(dm.name, key)
	if err != nil {
		return err
	}

	valueBuf := pool.Get()
	defer pool.Put(valueBuf)

	enc := resp.New(valueBuf)
	err = enc.Encode(value)
	if err != nil {
		return err
	}

	var pc dmap.PutConfig
	for _, opt := range options {
		opt(&pc)
	}
	putCmd := dm.writePutCommand(&pc, key, valueBuf.Bytes())
	cmd := putCmd.Command(ctx)

	err = rc.Process(ctx, cmd)
	if err != nil {
		return processProtocolError(err)
	}
	return processProtocolError(cmd.Err())
}

func (dm *ClusterDMap) makeGetResponse(cmd *redis.StringCmd) (*GetResponse, error) {
	raw, err := cmd.Bytes()
	if err != nil {
		return nil, processProtocolError(err)
	}

	e := dm.newEntry()
	e.Decode(raw)
	return &GetResponse{
		entry: e,
	}, nil
}

// Get gets the value for the given key. It returns ErrKeyNotFound if the DB
// does not contain the key. It's thread-safe. It is safe to modify the contents
// of the returned value. See GetResponse for the details.
func (dm *ClusterDMap) Get(ctx context.Context, key string) (*GetResponse, error) {
	cmd := protocol.NewGet(dm.name, key).SetRaw().Command(ctx)
	rc, err := dm.clusterClient.smartPick(dm.name, key)
	if err != nil {
		return nil, err
	}
	err = rc.Process(ctx, cmd)
	if err != nil {
		return nil, processProtocolError(err)
	}
	return dm.makeGetResponse(cmd)
}

// Delete deletes values for the given keys. Delete will not return an error if the key doesn't exist.
// It's thread-safe. It is safe to modify the contents of the argument after Delete returns.
func (dm *ClusterDMap) Delete(ctx context.Context, keys ...string) (int, error) {
	rc, err := dm.client.Pick()
	if err != nil {
		return 0, err
	}

	cmd := protocol.NewDel(dm.name, keys...).Command(ctx)
	err = rc.Process(ctx, cmd)
	if err != nil {
		return 0, processProtocolError(err)
	}

	res, err := cmd.Uint64()
	if err != nil {
		return 0, processProtocolError(cmd.Err())
	}
	return int(res), nil
}

// Incr atomically increments the key by delta. The return value is the new value
// after being incremented or an error.
func (dm *ClusterDMap) Incr(ctx context.Context, key string, delta int) (int, error) {
	rc, err := dm.clusterClient.smartPick(dm.name, key)
	if err != nil {
		return 0, err
	}

	cmd := protocol.NewIncr(dm.name, key, delta).Command(ctx)
	err = rc.Process(ctx, cmd)
	if err != nil {
		return 0, processProtocolError(err)
	}
	res, err := cmd.Uint64()
	if err != nil {
		return 0, processProtocolError(cmd.Err())
	}
	return int(res), nil
}

// Decr atomically decrements the key by delta. The return value is the new value
// after being decremented or an error.
func (dm *ClusterDMap) Decr(ctx context.Context, key string, delta int) (int, error) {
	rc, err := dm.clusterClient.smartPick(dm.name, key)
	if err != nil {
		return 0, err
	}

	cmd := protocol.NewDecr(dm.name, key, delta).Command(ctx)
	err = rc.Process(ctx, cmd)
	if err != nil {
		return 0, processProtocolError(err)
	}
	res, err := cmd.Uint64()
	if err != nil {
		return 0, processProtocolError(cmd.Err())
	}
	return int(res), nil
}

// CompareAndSwap atomically replaces the value at key with newValue iff the
// current raw value bytes equal expected. See DMap.CompareAndSwap for details.
func (dm *ClusterDMap) CompareAndSwap(
	ctx context.Context,
	key string,
	expected []byte,
	newValue interface{},
	options ...PutOption,
) (bool, *GetResponse, error) {
	rc, err := dm.clusterClient.smartPick(dm.name, key)
	if err != nil {
		return false, nil, err
	}

	if newValue == nil {
		newValue = struct{}{}
	}

	valueBuf := pool.Get()
	defer pool.Put(valueBuf)

	enc := resp.New(valueBuf)
	if err := enc.Encode(newValue); err != nil {
		return false, nil, err
	}

	var pc dmap.PutConfig
	for _, opt := range options {
		opt(&pc)
	}

	casCmd := protocol.NewCompareAndSwap(dm.name, key, expected, valueBuf.Bytes())
	switch {
	case pc.HasEX:
		casCmd.SetEX(pc.EX.Seconds())
	case pc.HasPX:
		casCmd.SetPX(pc.PX.Milliseconds())
	case pc.HasEXAT:
		casCmd.SetEXAT(pc.EXAT.Seconds())
	case pc.HasPXAT:
		casCmd.SetPXAT(pc.PXAT.Milliseconds())
	}

	cmd := casCmd.Command(ctx)
	if err := rc.Process(ctx, cmd); err != nil {
		return false, nil, processProtocolError(err)
	}
	if err := cmd.Err(); err != nil {
		return false, nil, processProtocolError(err)
	}

	items, err := cmd.Slice()
	if err != nil {
		return false, nil, processProtocolError(err)
	}
	if len(items) != 2 {
		return false, nil, fmt.Errorf("unexpected CAS reply length %d", len(items))
	}
	swappedInt, ok := items[0].(int64)
	if !ok {
		return false, nil, fmt.Errorf("unexpected CAS reply type for swapped: %T", items[0])
	}
	swapped := swappedInt == 1
	if items[1] == nil {
		return swapped, nil, nil
	}
	raw, ok := items[1].(string)
	if !ok {
		return false, nil, fmt.Errorf("unexpected CAS reply type for current: %T", items[1])
	}
	e := dm.newEntry()
	e.Decode([]byte(raw))
	return swapped, &GetResponse{entry: e}, nil
}

// GetPut atomically sets the key to value and returns the old value stored at a key. It returns nil if there is no
// previous value.
func (dm *ClusterDMap) GetPut(ctx context.Context, key string, value interface{}) (*GetResponse, error) {
	rc, err := dm.clusterClient.smartPick(dm.name, key)
	if err != nil {
		return nil, err
	}

	valueBuf := pool.Get()
	defer pool.Put(valueBuf)

	enc := resp.New(valueBuf)
	err = enc.Encode(value)
	if err != nil {
		return nil, err
	}

	cmd := protocol.NewGetPut(dm.name, key, valueBuf.Bytes()).SetRaw().Command(ctx)
	err = rc.Process(ctx, cmd)
	err = processProtocolError(err)
	if err != nil {
		// First try to set a key/value with GetPut
		if errors.Is(err, ErrKeyNotFound) {
			return nil, nil
		}
		return nil, err
	}

	raw, err := cmd.Bytes()
	if err != nil {
		return nil, processProtocolError(err)
	}

	e := dm.newEntry()
	e.Decode(raw)
	return &GetResponse{
		entry: e,
	}, nil
}

// IncrByFloat atomically increments 
```

### Core Architecture Module: `cluster_iterator.go`
```
// Copyright 2018-2026 The Olric Authors
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

package olric

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/olric-data/olric/internal/dmap"
	"github.com/olric-data/olric/internal/protocol"
)

type currentCursor struct {
	primary uint64
	replica uint64
}

// ClusterIterator implements distributed query on DMaps.
type ClusterIterator struct {
	mtx             sync.Mutex // protects pos and page
	routingTableMtx sync.Mutex // protects routingTable and partitionCount

	logger         *log.Logger
	dm             *ClusterDMap
	clusterClient  *ClusterClient
	pos            int
	page           []string
	route          *Route
	partitionKeys  map[string]struct{}
	cursors        map[uint64]map[string]*currentCursor
	partID         uint64 // current partition id
	routingTable   RoutingTable
	partitionCount uint64
	config         *dmap.ScanConfig
	scanner        func() error
	wg             sync.WaitGroup
	ctx            context.Context
	cancel         context.CancelFunc
}

func (i *ClusterIterator) loadRoute() {
	i.routingTableMtx.Lock()
	defer i.routingTableMtx.Unlock()

	route, ok := i.routingTable[i.partID]
	if !ok {
		panic("partID: could not be found in the routing table")
	}
	i.route = &route
}

func (i *ClusterIterator) updateCursor(owner string, cursor uint64) {
	if _, ok := i.cursors[i.partID]; !ok {
		i.cursors[i.partID] = make(map[string]*currentCursor)
	}
	cc, ok := i.cursors[i.partID][owner]
	if !ok {
		cc = &currentCursor{}
		if i.config.Replica {
			cc.replica = cursor
		} else {
			cc.primary = cursor
		}
		i.cursors[i.partID][owner] = cc
		return
	}

	if i.config.Replica {
		cc.replica = cursor
	} else {
		cc.primary = cursor
	}
	i.cursors[i.partID][owner] = cc
}

func (i *ClusterIterator) loadCursor(owner string) uint64 {
	if _, ok := i.cursors[i.partID]; !ok {
		return 0
	}
	cc, ok := i.cursors[i.partID][owner]
	if !ok {
		return 0
	}
	if i.config.Replica {
		return cc.replica
	}
	return cc.primary
}

func (i *ClusterIterator) updateIterator(keys []string, cursor uint64, owner string) {
	for _, key := range keys {
		if _, ok := i.partitionKeys[key]; !ok {
			i.page = append(i.page, key)
			i.partitionKeys[key] = struct{}{}
		}
	}
	i.updateCursor(owner, cursor)
}

func (i *ClusterIterator) getOwners() []string {
	var raw []string
	if i.config.Replica {
		raw = i.routingTable[i.partID].ReplicaOwners
	} else {
		raw = i.routingTable[i.partID].PrimaryOwners
	}
	var owners []string
	// Make a safe copy of the raw.
	for _, owner := range raw {
		owners = append(owners, owner)
	}
	return owners
}

func (i *ClusterIterator) removeScannedOwner(idx int) {
	if i.config.Replica {
		if len(i.route.ReplicaOwners) > 0 && len(i.route.ReplicaOwners) > idx {
			i.route.ReplicaOwners = append(i.route.ReplicaOwners[:idx], i.route.ReplicaOwners[idx+1:]...)
		}
	} else {
		if len(i.route.PrimaryOwners) > 0 && len(i.route.PrimaryOwners) > idx {
			i.route.PrimaryOwners = append(i.route.PrimaryOwners[:idx], i.route.PrimaryOwners[idx+1:]...)
		}
	}
}

func (i *ClusterIterator) scanOnOwners() error {
	owners := i.getOwners()

	for idx, owner := range owners {
		cursor := i.loadCursor(owner)

		// Build a scan command here
		s := protocol.NewScan(i.partID, i.dm.Name(), cursor)
		if i.config.HasCount {
			s.SetCount(i.config.Count)
		}
		if i.config.HasMatch {
			s.SetMatch(i.config.Match)
		}
		if i.config.Replica {
			s.SetReplica()
		}

		scanCmd := s.Command(i.ctx)
		// Fetch a Redis client for the given owner.
		rc := i.clusterClient.client.Get(owner)
		err := rc.Process(i.ctx, scanCmd)
		if err != nil {
			return err
		}

		keys, newCursor, err := scanCmd.Result()
		if err != nil {
			return err
		}
		i.updateIterator(keys, newCursor, owner)
		if newCursor == 0 {
			i.removeScannedOwner(idx)
		}
	}
	return nil
}

func (i *ClusterIterator) resetPage() {
	if len(i.page) != 0 {
		i.page = []string{}
	}
	i.pos = 0
}

func (i *ClusterIterator) fetchData() error {
	i.config.Replica = false
	if err := i.scanner(); err != nil {
		return err
	}

	i.config.Replica = true
	return i.scanner()
}

func (i *ClusterIterator) reset() {
	i.partitionKeys = make(map[string]struct{})
	i.resetPage()
	i.loadRoute()
}

func (i *ClusterIterator) next() bool {
	if len(i.page) != 0 {
		i.pos++
		if i.pos <= len(i.page) {
			return true
		}
	}

	i.resetPage()

	for {
		if err := i.fetchData(); err != nil {
			i.logger.Printf("[ERROR] Failed to fetch data: %s", err)
			return false
		}
		if len(i.page) != 0 {
			// We have data on the page to read. Stop the iteration.
			break
		}

		if len(i.route.PrimaryOwners) == 0 && len(i.route.ReplicaOwners) == 0 {
			// We completed scanning all the owners. Stop the iteration.
			break
		}
	}

	if len(i.page) == 0 && len(i.route.PrimaryOwners) == 0 && len(i.route.ReplicaOwners) == 0 {
		i.partID++
		if i.partID >= i.partitionCount {
			return false
		}
		i.reset()
		return i.next()
	}
	i.pos = 1
	return true
}

// Next returns true if there is more key in the iterator implementation.
// Otherwise, it returns false
func (i *ClusterIterator) Next() bool {
	i.mtx.Lock()
	defer i.mtx.Unlock()

	select {
	case <-i.ctx.Done():
		return false
	default:
	}

	return i.next()
}

// Key returns a key name from the distributed map.
func (i *ClusterIterator) Key() string {
	i.mtx.Lock()
	defer i.mtx.Unlock()

	var key string
	if i.pos > 0 && i.pos <= len(i.page) {
		key = i.page[i.pos-1]
	}
	return key
}

func (i *ClusterIterator) fetchRoutingTablePeriodically() {
	defer i.wg.Done()

	for {
		select {
		case <-i.ctx.Done():
			return
		case <-time.After(time.Second):
			if err := i.fetchRoutingTable(); err != nil {
				i.logger.Printf("[ERROR] Failed to fetch the latest version of the routing table: %s", err)
			}
		}
	}
}

func (i *ClusterIterator) fetchRoutingTable() error {
	routingTable, err := i.clusterClient.RoutingTable(i.ctx)
	if err != nil {
		return err
	}

	i.routingTableMtx.Lock()
	defer i.routingTableMtx.Unlock()

	// Partition count is a constant, actually. It has to be greater than zero.
	i.partitionCount = uint64(len(routingTable))
	i.routingTable = routingTable
	return nil
}

// Close stops the iteration and releases allocated resources.
func (i *ClusterIterator) Close() {
	select {
	case <-i.ctx.Done():
		return
	default:
	}

	i.cancel()

	// await for routing table updater
	i.wg.Wait()
}

```

### Core Architecture Module: `cmd/olric-server/main.go`
```
// Copyright 2018-2026 The Olric Authors
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

// Server implementation for Olric. Olric Server basically manages configuration for you.

package main

import (
	"context"
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"runtime"

	"github.com/olric-data/olric"
	"github.com/olric-data/olric/cmd/olric-server/server"
	"github.com/olric-data/olric/config"
	"github.com/sean-/seed"
)

func usage() {
	var msg = `Usage: olric-server [options] ...

Distributed key-value store and cache

Options:
  -h, --help    Print this message and exit.
  -v, --version Print the version number and exit.
  -c, --config  Sets configuration file path. Default is olric-server-local.yaml in the
                current folder. Set OLRIC_SERVER_CONFIG to overwrite it.

The Go runtime version %s
Report bugs to https://github.com/olric-data/olric/issues
`
	_, err := fmt.Fprintf(os.Stdout, msg, runtime.Version())
	if err != nil {
		panic(err)
	}
}

type arguments struct {
	config  string
	help    bool
	version bool
}

const (
	// DefaultConfigFile is the default configuration file path on a Unix-based operating system.
	DefaultConfigFile = "olric-server-local.yaml"

	// EnvConfigFile is the name of environment variable which can be used to override default configuration file path.
	EnvConfigFile = "OLRIC_SERVER_CONFIG"
)

func main() {
	args := &arguments{}

	// Parse command line parameters
	f := flag.NewFlagSet(os.Args[0], flag.ContinueOnError)
	f.SetOutput(ioutil.Discard)
	f.BoolVar(&args.help, "h", false, "")
	f.BoolVar(&args.help, "help", false, "")

	f.BoolVar(&args.version, "version", false, "")
	f.BoolVar(&args.version, "v", false, "")

	f.StringVar(&args.config, "config", DefaultConfigFile, "")
	f.StringVar(&args.config, "c", DefaultConfigFile, "")

	if err := f.Parse(os.Args[1:]); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "parsing error: %v\n", err)
		usage()
		os.Exit(1)
	}

	if args.version {
		_, _ = fmt.Fprintf(os.Stderr, "olric-server version %s %s %s/%s\n",
			olric.ReleaseVersion,
			runtime.Version(),
			runtime.GOOS,
			runtime.GOARCH,
		)
		return
	} else if args.help {
		usage()
		return
	}

	// MustInit provides guaranteed secure seeding.  If `/dev/urandom` is not
	// available, MustInit will panic() with an error indicating why reading from
	// `/dev/urandom` failed.  MustInit() will upgrade the seed if for some reason a
	// call to Init() failed in the past.
	seed.MustInit()

	envPath := os.Getenv(EnvConfigFile)
	if envPath != "" {
		args.config = envPath
	}

	c, err := config.Load(args.config)
	if err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "failed to load the configuration file: %s: %v\n", args.config, err)
		os.Exit(1)
	}

	s, err := server.New(c)
	if err != nil {
		c.Logger.Fatalf("[ERROR] Failed to create a new Olric instance: %v", err)
	}

	if err = s.Start(); err != nil {
		c.Logger.Printf("[ERROR] Failed to start Olric: %v", err)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		if err := s.Shutdown(ctx); err != nil {
			c.Logger.Printf("[ERROR] Failed to shutdown Olric: %v", err)
		}
		c.Logger.Fatal("[ERROR] Quit unexpectedly!")
	}

	c.Logger.Print("[INFO] Quit!")
}

```

### Core Architecture Module: `cmd/olric-server/server/server.go`
```
// Copyright 2018-2026 The Olric Authors
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

/*Package server provides a standalone server implementation for Olric*/
package server

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/olric-data/olric"
	"github.com/olric-data/olric/config"
	"golang.org/x/sync/errgroup"
)

// OlricServer represents an instance of the Olric distributed in-memory data structure store.
// It encapsulates logging, configuration, the Olric database instance, and an error group for
// concurrency management.
type OlricServer struct {
	log    *log.Logger
	config *config.Config
	db     *olric.Olric
	errGr  errgroup.Group
}

// New initializes a new OlricServer instance using the provided configuration and returns it or an error.
func New(c *config.Config) (*OlricServer, error) {
	db, err := olric.New(c)
	if err != nil {
		return nil, err
	}
	return &OlricServer{
		config: c,
		log:    c.Logger,
		db:     db,
	}, nil
}

// waitForInterrupt waits for termination signals (SIGTERM, SIGINT) to gracefully shut down the Olric server instance.
func (s *OlricServer) waitForInterrupt() {
	shutDownChan := make(chan os.Signal, 1)
	signal.Notify(shutDownChan, syscall.SIGTERM, syscall.SIGINT)
	ch := <-shutDownChan
	s.log.Printf("[INFO] Signal catched: %s", ch.String())

	// Awaits for shutdown
	s.errGr.Go(func() error {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		if err := s.db.Shutdown(ctx); err != nil {
			s.log.Printf("[ERROR] Failed to shutdown Olric: %v", err)
			return err
		}

		return nil
	})

	// This is not a goroutine leak. The process will quit.
	go func() {
		s.log.Printf("[INFO] Awaiting for background tasks")
		s.log.Printf("[INFO] Press CTRL+C or send SIGTERM/SIGINT to quit immediately")

		forceQuitCh := make(chan os.Signal, 1)
		signal.Notify(forceQuitCh, syscall.SIGTERM, syscall.SIGINT)
		ch := <-forceQuitCh

		s.log.Printf("[INFO] Signal caught: %s", ch.String())
		s.log.Printf("[INFO] Quits with exit code 1")
		os.Exit(1)
	}()
}

// Start launches the Olric server instance and begins listening for incoming requests and termination signals.
func (s *OlricServer) Start() error {
	s.log.Printf("[INFO] pid: %d has been started", os.Getpid())
	// Wait for SIGTERM or SIGINT
	go s.waitForInterrupt()

	s.errGr.Go(func() error {
		return s.db.Start()
	})

	return s.errGr.Wait()
}

// Shutdown gracefully stops the Olric server instance, releasing resources and ensuring a clean termination.
func (s *OlricServer) Shutdown(ctx context.Context) error {
	return s.db.Shutdown(ctx)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #269** (2025-11-26): **Config: Sanitize unexpectedly mutates custom logger**
  *Symptoms*: The following code exists in [config.go](https://github.com/olric-data/olric/blob/23297a60229b70fa5188ec5c4cc61668573e03ea/config/config.go#L394-L411): ```golang func (c *Config) Sanitize() error { 	if c.LogOutput == nil { 		c.LogOutput = os.Stderr 	}  	if c.LogLevel == "" { 		c.LogLevel = DefaultLogLevel 	}  	if c.LogVerbosity <= 0 { 		c.LogVerbosity = DefaultLogVerbosity 	}  	if c.Logger == nil { 		c.Logger = log.New(c.LogOutput, "", log.LstdFlags) 	} else { 		c.Logger.SetOutput(c.LogOutput) // <-- ! 	}         // ... ```  If you provide a custom logger, the else branch *overrides* that logger's output. That's very unexpected behaviour, as it is mutating the logger for all its users.  I think you can remove the else branch and things will work as expected?
  **Post-Mortem & Fix Analysis**:
  > @buraksezer Can we set both c.Logger & c.LogOutput as workaround for this bug ?   My use case is I want to send logs to syslog, when I set c.Logger with custom logger which sends log to syslog, Sanitize overrides c.LogOutput to os.Stderr  Please let me know if it is okay to assign both c.Logger & c.LogOutput until this bug gets resolved 
  > The issue is now resolved. When a custom Logger is provided, Olric no longer modifies its output or attempts to apply LogOutput. The else branch in Sanitize() has been removed, so a user-supplied logger is used exactly as given. This eliminates the unintended mutation and makes the configuration semantics consistent and predictable.  Please switch to `v0.7.2` to get the fix.

- **Issue #263** (2025-11-26): **Possible memory leak at DMap.Scan()**
  *Symptoms*: Hi!  I spotted that each Scan()  call leaves a couple of goroutines alive (an iterator is closed).  Minimum reproducing example:   ```golang package main  import ( 	"context" 	"fmt" 	"log" 	"runtime" 	"time"  	"github.com/buraksezer/olric" 	"github.com/buraksezer/olric/config" )  func main() { 	// Sample for Olric v0.5.x  	// Deployment scenario: embedded-member 	// This creates a single-node Olric cluster. It's good enough for experimenting.  	// config.New returns a new config.Config with sane defaults. Available values for env: 	// local, lan, wan 	cfg := config.New("local")  	// Callback function. It's called when this node is ready to accept connections. 	ready := make(chan struct{}, 1) 	cfg.Started = func() { 		ready <- struct{}{} 		log.Println("[INFO] Olric is ready to accept connections") 	} 	 	// Create a new Olric instance. 	db, err := olric.New(cfg) 	if err != nil { 		log.Fatalf("Failed to create Olric instance: %v", err) 	}  	// Start the instance. It will form a single-node cluster. 	go func() { 		// Call Start at background. It's a blocker call. 		err = db.Start() 		if err != nil { 			log.Fatalf("olric.Start returned an error: %v", err) 		} 	}()  	<-ready  	// In embedded-member scenario, you can use the EmbeddedClient. It implements 	// the Client interface. 	client := db.NewEmbeddedClient()  	dm, err := client.NewDMap("bucket-of-arbitrary-items") 	if err != nil { 		log.Fatalf("olric.NewDMap returned an 

- **Issue #247** (2024-05-10): **Data race in cluster setup using Olric v0.5.5**
  *Symptoms*: In the olric_test.go, add the following sample test:  ``` func TestOlricCluster(t *testing.T) { 	cluster := newTestOlricCluster(t) 	cluster.addMember(t) 	cluster.addMember(t) 	cluster.addMember(t) 	cluster.addMember(t) 	cluster.addMember(t) 	require.Len(t, cluster.members, 5) } ```  Then run the command: ``` for i in {1..10}; do go test -count=1 -race -run 'TestOlricCluster' ; done ```  Some rounds will fail with the following error message: ``` WARNING: DATA RACE Write at 0x00c0001f0348 by goroutine 253:   github.com/buraksezer/olric/internal/cluster/routingtable.(*RoutingTable).Start()       /Users/zhengrenpan/open-source/olric/internal/cluster/routingtable/routingtable.go:370 +0x3d0   github.com/buraksezer/olric.(*Olric).Start()       /Users/zhengrenpan/open-source/olric/olric.go:345 +0x32c   github.com/buraksezer/olric.newTestOlricWithConfig.func2()       /Users/zhengrenpan/open-source/olric/olric_test.go:61 +0x2c  Previous read at 0x00c0001f0348 by goroutine 278:   github.com/buraksezer/olric/internal/cluster/routingtable.(*RoutingTable).setOwnedPartitionCount()       /Users/zhengrenpan/open-source/olric/internal/cluster/routingtable/routingtable.go:159 +0xcc   github.com/buraksezer/olric/internal/cluster/routingtable.(*RoutingTable).updateRoutingCommandHandler()       /Users/zhengrenpan/open-source/olric/internal/cluster/routingtable/operations.go:107 +0x608   github.com/buraksezer/olric/internal/cluster/routingtable.(*RoutingTable).up
  **Post-Mortem & Fix Analysis**:
  > Hey @zhp007,  Thank you for reporting this. The problem has been fixed, and Olric v0.5.6 has been released. https://github.com/buraksezer/olric/releases/tag/v0.5.6  The current solution fixes the problem, but we need more complicated refactoring to improve the code quality. This can be done in v0.6.0. 

- **Issue #217** (2023-02-04): **Panic on start when BindAddr cannot be resolved**
  *Symptoms*: Olric panics on start if BindAddr is invalid or cannot be resolved. It should return an error and quit with exit code 1.  Sample config:  ```yaml olricd:   # BindAddr denotes the address that Olric will bind to for communication   # with other Olric nodes.   bindAddr: foobar ```   ``` ➜  olric git:(release/v0.5.0) ✗ olricd -c cmd/olricd/olricd-local.yaml 2023/02/01 20:13:24 [INFO] pid: 2055 has been started 2023/02/01 20:13:24 [ERROR] Failed to start Olric: invalid BindAddr: lookup foobar: no such host panic: runtime error: invalid memory address or nil pointer dereference [signal SIGSEGV: segmentation violation code=0x2 addr=0x78 pc=0x10477b6c8]  goroutine 1 [running]: github.com/buraksezer/olric.(*Olric).Shutdown(0x0, {0x1049b7bd8, 0x140000eddc0}) 	/Users/buraksezer/go/src/github.com/buraksezer/olric/olric.go:397 +0x28 github.com/buraksezer/olric/cmd/olricd/server.(*Olricd).Shutdown(...) 	/Users/buraksezer/go/src/github.com/buraksezer/olric/cmd/olricd/server/server.go:101 main.main() 	/Users/buraksezer/go/src/github.com/buraksezer/olric/cmd/olricd/main.go:128 +0x54c ```

- **Issue #210** (2023-01-15): **panic: runtime error: integer divide by zero in setLRUEvictionStats**
  *Symptoms*: Not a normal stacktrace format because we got it out of Sentry    File "panic.go", line 890, in panic   File "put.go", line 240, in (*DMap).setLRUEvictionStats   File "put.go", line 305, in (*DMap).putOnCluster   File "put.go", line 360, in (*DMap).put   File "put.go", line 413, in (*DMap).Put   File "embedded_client.go", line 244, in (*EmbeddedDMap).Put   File "olric.go", line 196, in DMap.Put
  **Post-Mortem & Fix Analysis**:
  > Fixed in Olric v0.5.2. Related commit: 700ee31638c2ef06cd0924d83ca233c29df97ec4. Please re-open the issue if the problem still exists. 

- **Issue #209** (2023-01-16): **Unbounded memory growth / leak in pipelines**
  *Symptoms*: Here's the RAM usage over the course of 2.5 hours, showing unbounded memory growth. This happens on every pod until they gets OOMKilled. There are about 100 RPS to the grpc api, on 30 separate pods. Each request makes on average 1 pipeline Exec call with about 100 keys per call. I've run `pprof` repeatedly that gives different results than my OS metrics are telling me. I'm only seeing this when using the pipeline, our other service just does single Get/Put calls and maintains steady memory usage just a little over the DMap allocation.  There are 2 DMaps, with the following config.  ```go 	// create a new Olric configuration 	cfg := config.New("lan") // default configuration 	cfg.ServiceDiscovery = map[string]any{ 		"plugin": k8sDisc, 	} 	cfg.ReplicationMode = config.AsyncReplicationMode 	cfg.LogLevel = "WARN" 	cfg.LogVerbosity = 1  	cfg.DMaps.Custom[name] = config.DMap{ 		EvictionPolicy:  config.LRUEviction, 		MaxIdleDuration: 24 * time.Hour, 		MaxInuse:        50_000_000, 	} ```  ![image](https://user-images.githubusercontent.com/3588778/212257535-87609a0d-0d4a-46e9-88c2-e8e598e15920.png) ![image](https://user-images.githubusercontent.com/3588778/212257557-a2fa9faa-c12c-4a3d-b793-67ace4425f4c.png) ![image](https://user-images.githubusercontent.com/3588778/212257578-ade53627-dc2f-48cf-9aa5-56aab564e6cd.png)  ### pprof -alloc_objects  ``` go tool pprof -inuse_objects http://localhost:9090/debug/pprof/heap  Type: inuse_objects Time: Jan 13, 2023 a
  **Post-Mortem & Fix Analysis**:
  > Here are some screenshots from our continuous profiler showing 24 hours of data (averaged over 250 samples) from yesterday with olric and the same day last week without olric running.  ## In Use Heap Profiles  ### Before Olric  <img width="2065" alt="image" src="https://user-images.githubusercontent.com/3588778/212441457-347bfdfa-a455-407c-b5c2-134ec6975782.png">  ### After Olric  <img width="2072" alt="image" src="https://user-images.githubusercontent.com/3588778/212441244-bb4832d2-e125-4259-9d8d-8bd058f95ffb.png">  ## Alloc Heap Profiles  ### Before Olric  <img width="2069" alt="image" src="https://user-images.githubusercontent.com/3588778/212441886-e9d4202b-23a6-4dff-996e-0780d6876fb5.png">  ### After Olric  <img width="2082" alt="image" src="https://user-images.githubusercontent.com/3588778/212441986-43bbf1f5-80ff-4c56-aa39-5753fb9e5055.png">  ## CPU Profiles  I expected an increase in CPU given that there would be serialization during lookups compared to th
  > The good news is that this also supports that it's primarily an issue with pipelines. In a separate service that only does single gets/puts and no pipelines that has been running in production longer, while there is definitely an increase in heap usage and GC, it doesn't completely dominate the entire service, of which olric is just a small part.  ## In Use Heap Profiles  ### Before Olric  <img width="2064" alt="image" src="https://user-images.githubusercontent.com/3588778/212442565-053227c8-2ba3-49a5-900a-6f2b61f68a5d.png">  ### After Olric  <img width="2062" alt="image" src="https://user-images.githubusercontent.com/3588778/212442599-bd90a50e-7c9f-4755-b864-161b37ec89c0.png">  ## Alloc Heap Profiles  ### Before Olric  <img width="2062" alt="image" src="https://user-images.githubusercontent.com/3588778/212442633-f2d56d8d-06de-4080-87cc-255c93ae4c57.png">  ### After Olric  <img width="2080" alt="image" src="https://user-images.githubusercontent.com/3588778/212442671
  > @derekperkins thank you for the detailed bug report. I applied a fix to overcome the problem. Previously, `EmbeddedClient.Pipeline` was creating a new cluster client for every new pipeline. Reusing can partly overcome this problem but all pipelines should use the same underlying cluster client.   The other problem was the routing table fetch interval. `ClusterClient` implementation retrieves the routing table periodically to route requests to the partition owner. The client can work without this "smart pick" logic but it increases the latency. The interval was too short: 15 seconds. I set a new default value (1 min) and added the `WithRoutingTableFetchInterval` function for setting an appropriate interval for the environment.   Now you can use `EmbeddedClient.Pipeline` to create a new pipeline. `EmbeddedClient` implementation creates only one `ClusterClient` and reuses it. You can also use `ClusterClient.Pipeline` to create a new pipeline. It's already used by `EmbeddedClient.Pipel

- **Issue #201** (2023-01-11): **pipeline concurrency hardcoded to 1**
  *Symptoms*: As currently written, pipeline concurrency is hardcoded to 1. PR inbound to make this configurable.  https://github.com/buraksezer/olric/blob/a2126a36354d18254e2fa93556ce4ed67d8d96f6/pipeline.go#L414-L415

- **Issue #198** (2023-01-12): **pipelining 100x slower on cache misses**
  *Symptoms*: We tried switching from individual DMap.Get calls to pipelining today and found very poor performance on cache misses.   In the trace below, there were 99 keys added to the pipeline. The gap from the beginning of the `Exec` bar and the first `Result` is where `pipeline.Exec` was called, ~300ms. Any `Result()` call followed by a `Scan` means that there was a cache hit, otherwise it was a miss. Cache hits are great, almost all within 0.25-0.50 ms. Cache misses however take up to 150ms before returning. Is that expected behavior? My expectation was that `pipeline.Exec` might take 10-100ms to fetch everything, then any Result() calls afterwards would be almost free.  <img width="658" alt="image" src="https://user-images.githubusercontent.com/3588778/209761994-2eca0f1e-0632-4d6a-a5c9-7484cb0709ed.png">  The spike below is when we deployed pipelining, and the low dots on the right are when we reverted to making the same number of Get calls as there are Pipeline Get + Result calls.  <img width="1161" alt="image" src="https://user-images.githubusercontent.com/3588778/209761707-02385324-2829-42d4-b507-b4f4122d0078.png">  Env: - Olric v0.5.0 - 30 embedded client cluster - k8s 1.21
  **Post-Mortem & Fix Analysis**:
  > Hey, @derekperkins Could you please share your configuration? I particularly need to learn the following fields:  * ReplicaCount * ReadQuorum * ReadRepair
  > I'm not setting any of those explicitly, so they should all be 1 from the `lan` defaults  ```go cfg := config.New("lan") // default configuration cfg.ServiceDiscovery = map[string]any{ 	"plugin": k8sDisc, } cfg.ReplicationMode = config.AsyncReplicationMode cfg.LogLevel = "WARN" cfg.LogVerbosity = 1  cfg.DMaps.Custom[name] = config.DMap{ 	EvictionPolicy:  config.LRUEviction, 	MaxIdleDuration: 24 * time.Hour, 	MaxInuse:        50_000_000, } ```
  > FWIW, we're caching immutable objects, so stale data isn't possible. We're strictly focused on performance, and can set any knobs to whatever you suggest

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

### Incident Patch 1: `630870d6` (2026-08-12)
**Commit Message**: chore: remove Go Report Card badge and add build status, release badges

**File**: `README.md` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
-# Olric [![Tweet](https://img.shields.io/twitter/url/http/shields.io.svg?style=social)](https://twitter.com/intent/tweet?text=Olric%3A+Distributed+and+in-memory+key%2Fvalue+database.+It+can+be+used+both+as+an+embedded+Go+library+and+as+a+language-independent+service.+&url=https://github.com/olric-data/olric/&hashtags=golang,distributed,database)
+# Olric
 
-[![Go Reference](https://pkg.go.dev/badge/github.com/olric-data/olric/.svg)](https://pkg.go.dev/github.com/olric-data/olric/) [![Go Report Card](https://goreportcard.com/badge/olric-data/olric)](https://goreportcard.com/report/github.com/olric-data/olric/) [![Discord](https://img.shields.io/discord/721708998021087273.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/ahK7Vjr8We) [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
+[![Go Reference](https://pkg.go.dev/badge/github.com/olric-data/olric/.svg)](https://pkg.go.dev/github.com/olric-data/olric/) [![Build](https://github.com/olric-data/olric/actions/workflows/ci.yml/badge.svg)](https://github.com/olric-data/olric/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/olric-data/olric)](https://github.com/olric-data/olric/releases/latest) [![Discord](https://img.shields.io/discord/721708998021087273.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/ahK7Vjr8We) [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
 
 Distributed In-Memory Cache & Key/Value Store
 
```

---

### Incident Patch 2: `c1df54c1` (2026-08-12)
**Commit Message**: fix: prevent concurrent map iteration issue in the statistics method.

**File**: `stats.go` (modified, +2/-0)
```diff
@@ -131,10 +131,12 @@ func (db *Olric) stats(cfg statsConfig) stats.Stats {
 	db.rt.RLock()
 	defer db.rt.RUnlock()
 
+	db.rt.Members().RLock()
 	db.rt.Members().Range(func(id uint64, member discovery.Member) bool {
 		s.ClusterMembers[stats.MemberID(id)] = toMember(member)
 		return true
 	})
+	db.rt.Members().RUnlock()
 
 	for partID := uint64(0); partID < db.config.PartitionCount; partID++ {
 		primary := db.primary.PartitionByID(partID)
```

---

### Incident Patch 3: `18902577` (2026-06-26)
**Commit Message**: Fix redundant `fmt.Sprintf` usage in error output during config parsing

**File**: `cmd/olric-server/main.go` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ func main() {
 	f.StringVar(&args.config, "c", DefaultConfigFile, "")
 
 	if err := f.Parse(os.Args[1:]); err != nil {
-		_, _ = fmt.Fprintf(os.Stderr, fmt.Sprintf("parsing error: %v\n", err))
+		_, _ = fmt.Fprintf(os.Stderr, "parsing error: %v\n", err)
 		usage()
 		os.Exit(1)
 	}
```

---

### Incident Patch 4: `0ce1e6a8` (2026-06-12)
**Commit Message**: fix pipeline Get & GetPut panic on missing keys

**File**: `pipeline.go` (modified, +34/-2)
```diff
@@ -18,6 +18,7 @@ import (
 	"bytes"
 	"context"
 	"errors"
+	"fmt"
 	"runtime"
 	"strconv"
 	"sync"
@@ -164,8 +165,15 @@ func (f *FutureGet) Result() (*GetResponse, error) {
 		if cmd.Err() != nil {
 			return nil, processProtocolError(cmd.Err())
 		}
+		value, nilValue, err := pipelineStringValue(cmd)
+		if err != nil {
+			return nil, err
+		}
+		if nilValue {
+			return nil, ErrKeyNotFound
+		}
 		stringCmd := redis.NewStringCmd(context.Background(), cmd.Args()...)
-		stringCmd.SetVal(cmd.(*redis.Cmd).Val().(string))
+		stringCmd.SetVal(value)
 		return f.dp.dm.makeGetResponse(stringCmd)
 	default:
 		return nil, ErrNotReady
@@ -392,8 +400,15 @@ func (f *FutureGetPut) Result() (*GetResponse, error) {
 		if cmd.Err() != nil {
 			return nil, processProtocolError(cmd.Err())
 		}
+		value, nilValue, err := pipelineStringValue(cmd)
+		if err != nil {
+			return nil, err
+		}
+		if nilValue {
+			return nil, nil
+		}
 		stringCmd := redis.NewStringCmd(context.Background(), cmd.Args()...)
-		stringCmd.SetVal(cmd.(*redis.Cmd).Val().(string))
+		stringCmd.SetVal(value)
 		return f.dp.dm.makeGetResponse(stringCmd)
 	default:
 		return nil, ErrNotReady
@@ -645,3 +660,20 @@ func putPipelineCmdsIntoPool(cmds []redis.Cmder) {
 	cmds = cmds[:0]
 	pipelineCmdPool.Put(cmds)
 }
+
+func pipelineStringValue(cmd redis.Cmder) (string, bool, error) {
+	redisCmd, ok := cmd.(*redis.Cmd)
+	if !ok {
+		return "", false, fmt.Errorf("unexpected pipeline command type %T", cmd)
+	}
+
+	value := redisCmd.Val()
+	if value == nil {
+		return "", true, nil
+	}
+	stringValue, ok := value.(string)
+	if !ok {
+		return "", false, fmt.Errorf("unexpected pipeline command value type %T", value)
+	}
+	return stringValue, false, nil
+}
```

**File**: `pipeline_test.go` (modified, +41/-1)
```diff
@@ -20,8 +20,10 @@ import (
 	"testing"
 	"time"
 
-	"github.com/olric-data/olric/internal/testutil"
+	"github.com/redis/go-redis/v9"
 	"github.com/stretchr/testify/require"
+
+	"github.com/olric-data/olric/internal/testutil"
 )
 
 func TestDMapPipeline_Put(t *testing.T) {
@@ -107,6 +109,25 @@ func TestDMapPipeline_Get(t *testing.T) {
 	}
 }
 
+func TestFutureGet_Result_NilPipelineValue(t *testing.T) {
+	cmd := redis.NewCmd(context.Background(), "dm.get", "mydmap", "missing", "RW")
+	cmd.SetVal(nil)
+
+	ctx, cancel := context.WithCancel(context.Background())
+	cancel()
+	future := &FutureGet{
+		dp: &DMapPipeline{
+			result: map[uint64][]redis.Cmder{0: {cmd}},
+		},
+		ctx:       ctx,
+		closedCtx: context.Background(),
+	}
+
+	res, err := future.Result()
+	require.Nil(t, res)
+	require.ErrorIs(t, err, ErrKeyNotFound)
+}
+
 func TestDMapPipeline_Delete(t *testing.T) {
 	cluster := newTestOlricCluster(t)
 	db := cluster.addMember(t)
@@ -293,6 +314,25 @@ func TestDMapPipeline_GetPut(t *testing.T) {
 	}
 }
 
+func TestFutureGetPut_Result_NilPipelineValue(t *testing.T) {
+	cmd := redis.NewCmd(context.Background(), "dm.getput", "mydmap", "key", "value", "RW")
+	cmd.SetVal(nil)
+
+	ctx, cancel := context.WithCancel(context.Background())
+	cancel()
+	future := &FutureGetPut{
+		dp: &DMapPipeline{
+			result: map[uint64][]redis.Cmder{0: {cmd}},
+		},
+		ctx:       ctx,
+		closedCtx: context.Background(),
+	}
+
+	res, err := future.Result()
+	require.NoError(t, err)
+	require.Nil(t, res)
+}
+
 func TestDMapPipeline_IncrByFloat(t *testing.T) {
 	cluster := newTestOlricCluster(t)
 	db := cluster.addMember(t)
```

---

### Incident Patch 5: `f3f9991f` (2026-04-03)
**Commit Message**: Fix minor typo in package documentation for `ramblock`

**File**: `internal/ramblock/ramblock.go` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
 // limitations under the License.
 
 /*
-Package ramblock implements a GC friendly in-memory storage engine by using
+Package ramblock implements a GC-friendly in-memory storage engine by using
 built-in maps and byte slices. It also supports compaction.
 */
 package ramblock
```

---

### Incident Patch 6: `6ca3ca8b` (2026-04-03)
**Commit Message**: Add test for scanning entries with non-contiguous coefficients and fix coefficient-based cursor calculation

**File**: `internal/kvstore/kvstore.go` (modified, +2/-0)
```diff
@@ -506,6 +506,8 @@ func (k *KVStore) scanCommon(cursor uint64, expr string, count int, f func(e sto
 				// Invalid cursor
 				return 0, nil
 			}
+			// findCoefficient already returns the next valid coefficient
+			return k.tableSize * cf, nil
 		}
 		// The next table
 		return k.tableSize * (cf + 1), nil
```

**File**: `internal/kvstore/kvstore_test.go` (modified, +75/-0)
```diff
@@ -560,6 +560,81 @@ func TestStorage_ScanRegexMatch_OnlyOneEntry(t *testing.T) {
 	require.Equal(t, 1, count)
 }
 
+func TestStorage_Scan_NonContiguousCoefficients(t *testing.T) {
+	// Use a small tableSize so that multiple tables are created quickly.
+	c := DefaultConfig()
+	c.Add("tableSize", 1024)
+	s := testKVStore(t, c)
+	k := s.(*KVStore)
+
+	// Insert enough entries to create several tables (at least 4).
+	for i := 0; i < 200; i++ {
+		e := entry.New()
+		e.SetKey(bkey(i))
+		e.SetValue(bval(i))
+		e.SetTTL(int64(i))
+		e.SetTimestamp(time.Now().UnixNano())
+		hkey := xxhash.Sum64([]byte(e.Key()))
+		err := s.Put(hkey, e)
+		require.NoError(t, err)
+	}
+
+	require.Greater(t, len(k.tables), 3, "need at least 4 tables for this test")
+
+	// Count entries per table before deletion.
+	totalBefore := 0
+	for _, tbl := range k.tables {
+		totalBefore += tbl.Stats().Length
+	}
+
+	// Pick a middle table to delete (simulate compaction gap).
+	// Find a table that is not the first or last and has entries.
+	var deletedTable *table.Table
+	for _, tbl := range k.tables[1 : len(k.tables)-1] {
+		if tbl.Stats().Length > 0 {
+			deletedTable = tbl
+			break
+		}
+	}
+	require.NotNil(t, deletedTable, "could not find a middle table to delete")
+
+	deletedCf := deletedTable.Coefficient()
+	deletedCount := deletedTable.Stats().Length
+
+	// Remove the table from tablesByCoefficient to create a gap (like compaction does).
+	delete(k.tablesByCoefficient, deletedCf)
+
+	// Remove from tables slice as well.
+	for i, tbl := range k.tables {
+		if tbl == deletedTable {
+			k.tables = append(k.tables[:i], k.tables[i+1:]...)
+			break
+		}
+	}
+
+	expectedCount := totalBefore - deletedCount
+
+	// Scan all remaining entries.
+	var (
+		scannedCount int
+		cursor       uint64
+		err          error
+	)
+	for {
+		cursor, err = k.Scan(cursor, 10, func(e storage.Entry) bool {
+			scannedCount++
+			return true
+		})
+		require.NoError(t, err)
+		if cursor == 0 {
+			break
+		}
+	}
+
+	require.Equal(t, expectedCount, scannedCount,
+		"scan should find all entries in remaining tables after coefficient gap")
+}
+
 func TestKVStore_Put_ErrEntryTooLarge(t *testing.T) {
 	c := DefaultConfig()
 	c.Add("tableSize", 1024)
```

---

### Incident Patch 7: `f294ebc9` (2026-01-20)
**Commit Message**: fix eviction for max idle duration

**File**: `internal/dmap/eviction.go` (modified, +3/-1)
```diff
@@ -20,6 +20,7 @@ import (
 	"math/rand"
 	"runtime"
 	"sort"
+	"strings"
 	"time"
 
 	"github.com/olric-data/olric/internal/cluster/partitions"
@@ -102,8 +103,9 @@ func (s *Service) evictKeys() {
 	partID := uint64(rand.Intn(int(s.config.PartitionCount)))
 	part := s.primary.PartitionByID(partID)
 	part.Map().Range(func(name, tmp interface{}) bool {
+		dmapName := strings.TrimPrefix(name.(string), "dmap.")
 		f := tmp.(*fragment)
-		s.scanFragmentForEviction(partID, name.(string), f)
+		s.scanFragmentForEviction(partID, dmapName, f)
 		// this breaks the loop, we only scan one dmap instance per call
 		return false
 	})
```

---

### Incident Patch 8: `a87437d6` (2025-08-22)
**Commit Message**: fix: leaking cluster clients in `EmbeddedDMap.Scan`

Fix for https://github.com/olric-data/olric/issues/263

Problem:
`EmbeddedDMap.Scan` function creates cluster client which stays alive
with `fetchRoutingTablePeriodically` in a separate go-routine created in
`NewClusterClient`. This causes memory leaks similar to
https://github.com/olric-data/olric/issues/209.

Solution:
* make `ClusterClient.fetchRoutingTable` interruptable by using cluster
  client's `ctx` inside;
* make `DMap` `Close`-able and call `ClusterClient.Close` for cluster
  client cached by `EmbeddedDMap`.

**File**: `client.go` (modified, +3/-0)
```diff
@@ -237,6 +237,9 @@ type DMap interface {
 	// Redis client has retransmission logic in case of timeouts, pipeline
 	// can be retransmitted and commands can be executed more than once.
 	Pipeline(opts ...PipelineOption) (*DMapPipeline, error)
+
+	// Close stops background routines and frees allocated resources.
+	Close(ctx context.Context) error
 }
 
 // PipelineOption is a function for defining options to control behavior of the Pipeline command.
```

**File**: `cluster_client.go` (modified, +6/-1)
```diff
@@ -395,6 +395,11 @@ func (dm *ClusterDMap) LockWithTimeout(ctx context.Context, key string, timeout,
 	}, nil
 }
 
+// Close stops background routines and frees allocated resources.
+func (dm *ClusterDMap) Close(_ context.Context) error {
+	return nil
+}
+
 // Unlock releases the distributed lock associated with the current context by using the provided context for execution.
 func (c *ClusterLockContext) Unlock(ctx context.Context) error {
 	rc, err := c.dm.clusterClient.smartPick(c.dm.name, c.key)
@@ -750,7 +755,7 @@ func WithRoutingTableFetchInterval(interval time.Duration) ClusterClientOption {
 // fetchRoutingTable updates the cluster routing table by fetching the latest version from the cluster.
 // It initializes the partition count if it's the first invocation. Returns an error if fetching fails.
 func (cl *ClusterClient) fetchRoutingTable() error {
-	ctx, cancel := context.WithCancel(context.Background())
+	ctx, cancel := context.WithCancel(cl.ctx)
 	defer cancel()
 
 	routingTable, err := cl.RoutingTable(ctx)
```

**File**: `embedded_client.go` (modified, +13/-1)
```diff
@@ -131,7 +131,7 @@ func (e *EmbeddedClient) RefreshMetadata(_ context.Context) error {
 // * Count
 // * Match
 func (dm *EmbeddedDMap) Scan(ctx context.Context, options ...ScanOption) (Iterator, error) {
-	cc, err := NewClusterClient([]string{dm.client.db.rt.This().String()})
+	cc, err := dm.setOrGetClusterClient()
 	if err != nil {
 		return nil, err
 	}
@@ -280,6 +280,18 @@ func (dm *EmbeddedDMap) Put(ctx context.Context, key string, value interface{},
 	return nil
 }
 
+// Close stops background routines and frees allocated resources.
+func (dm *EmbeddedDMap) Close(ctx context.Context) error {
+	dm.mtx.RLock()
+	clusterClient := dm.clusterClient
+	dm.mtx.RUnlock()
+
+	if clusterClient != nil {
+		return dm.clusterClient.Close(ctx)
+	}
+	return nil
+}
+
 func (e *EmbeddedClient) NewDMap(name string, options ...DMapOption) (DMap, error) {
 	dm, err := e.db.dmap.NewDMap(name)
 	if err != nil {
```

**File**: `embedded_client_test.go` (modified, +56/-0)
```diff
@@ -17,6 +17,7 @@ package olric
 import (
 	"context"
 	"fmt"
+	"runtime"
 	"testing"
 	"time"
 
@@ -639,3 +640,58 @@ func TestEmbeddedClient_DMap_Put_PX_With_NX(t *testing.T) {
 	require.NoError(t, err)
 	assert.NotZero(t, gr.TTL())
 }
+
+func TestEmbeddedClient_Issue263(t *testing.T) {
+	cluster := newTestOlricCluster(t)
+	db := cluster.addMember(t)
+
+	e := db.NewEmbeddedClient()
+	ctx, cancel := context.WithCancel(context.Background())
+	dm, err := e.NewDMap("mydmap")
+	require.NoError(t, err)
+
+	// Create N key-value pairs:
+	const N = 100
+	for i := range N {
+		key := fmt.Sprintf("key-%d", i)
+		value := fmt.Sprintf("value-%d", i)
+		err := dm.Put(ctx, key, value)
+		require.NoError(t, err)
+	}
+
+	// Iterate M times over N keys:
+	const M = 100
+	for range M {
+		iter, err := dm.Scan(ctx)
+		require.NoError(t, err)
+		for iter.Next() {
+			// Do nothing
+		}
+		iter.Close()
+	}
+
+	require.NoError(t, dm.Close(ctx))
+	require.NoError(t, e.Close(ctx))
+	require.NoError(t, db.Shutdown(ctx))
+
+	cancel()
+
+	runtime.GC()
+	time.Sleep(time.Second)
+
+	s := runtime.MemStats{}
+	runtime.ReadMemStats(&s)
+
+	const (
+		KB = 1 << 10
+		MB = KB << 10
+	)
+
+	buf := make([]byte, MB)
+	stackSize := runtime.Stack(buf, true)
+
+	t.Logf("Non-freed objects: %d\n", s.Mallocs-s.Frees)
+	t.Logf("Mem in use (KB): %d\n", s.HeapAlloc/KB)
+	t.Logf("Go-routines remained: %d\n", runtime.NumGoroutine())
+	t.Logf("Stack traces:\n%s\n", buf[:stackSize])
+}
```

---

### Incident Patch 9: `a241c935` (2025-09-21)
**Commit Message**: Fix conflict between "not exist" and expiration options.

Problem:
NX & XX options are conflicting with expiration options (e.g. EX and PX,) when
written to other cluster members.

Solution:
Fixed DMap service PUT handlers to handle those options separately as everywhere else.

**File**: `embedded_client_test.go` (modified, +25/-0)
```diff
@@ -21,6 +21,7 @@ import (
 	"time"
 
 	"github.com/olric-data/olric/internal/testutil"
+	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	"golang.org/x/sync/errgroup"
 )
@@ -614,3 +615,27 @@ func TestEmbeddedClient_Ping_WithMessage(t *testing.T) {
 	require.NoError(t, err)
 	require.Equal(t, message, response)
 }
+
+func TestEmbeddedClient_DMap_Put_PX_With_NX(t *testing.T) {
+	cluster := newTestOlricCluster(t)
+	db0 := cluster.addMember(t)
+	db1 := cluster.addMember(t)
+
+	ctx := context.Background()
+	e := db0.NewEmbeddedClient()
+	dm0, err := e.NewDMap("mydmap")
+	require.NoError(t, err)
+
+	err = dm0.Put(ctx, "mykey", "myvalue", PX(time.Minute), NX())
+	require.NoError(t, err)
+
+	<-time.After(time.Millisecond)
+
+	e = db1.NewEmbeddedClient()
+	dm1, err := e.NewDMap("mydmap")
+	require.NoError(t, err)
+
+	gr, err := dm1.Get(ctx, "mykey")
+	require.NoError(t, err)
+	assert.NotZero(t, gr.TTL())
+}
```

**File**: `internal/dmap/put_handlers.go` (modified, +3/-0)
```diff
@@ -40,6 +40,9 @@ func (s *Service) putCommandHandler(conn redcon.Conn, cmd redcon.Command) {
 		pc.HasNX = true
 	case putCmd.XX:
 		pc.HasXX = true
+	}
+
+	switch {
 	case putCmd.EX != 0:
 		pc.HasEX = true
 		pc.EX = time.Duration(putCmd.EX * float64(time.Second))
```

**File**: `internal/dmap/put_test.go` (modified, +33/-0)
```diff
@@ -26,6 +26,7 @@ import (
 	"github.com/olric-data/olric/internal/cluster/partitions"
 	"github.com/olric-data/olric/internal/testcluster"
 	"github.com/olric-data/olric/internal/testutil"
+	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 )
 
@@ -363,3 +364,35 @@ func TestDMap_Put_ErrEntryTooLarge(t *testing.T) {
 	err = dm.Put(ctx, "key", data, nil)
 	require.ErrorIs(t, err, ErrEntryTooLarge)
 }
+
+func TestDMap_Put_PX_With_NX(t *testing.T) {
+	cluster := testcluster.New(NewService)
+	s1 := cluster.AddMember(nil).(*Service)
+	s2 := cluster.AddMember(nil).(*Service)
+	defer cluster.Shutdown()
+
+	ctx := context.Background()
+	dm1, err := s1.NewDMap("mydmap")
+	require.NoError(t, err)
+
+	pc := &PutConfig{
+		HasPX: true,
+		PX:    time.Minute,
+		HasNX: true,
+	}
+	for i := range 10 {
+		err = dm1.Put(ctx, testutil.ToKey(i), testutil.ToVal(i), pc)
+		require.NoError(t, err)
+	}
+
+	<-time.After(10 * time.Millisecond)
+
+	dm2, err := s2.NewDMap("mydmap")
+	require.NoError(t, err)
+
+	for i := range 10 {
+		gr, err := dm2.Get(ctx, testutil.ToKey(i))
+		require.NoError(t, err)
+		assert.NotZero(t, gr.TTL())
+	}
+}
```

---

### Incident Patch 10: `65285b43` (2025-09-22)
**Commit Message**: Fix data race in internal/cluster/routingtable/update.go

There is a data race between routing tables update go-routines when tests are
ran with `-race` flag:
```
WARNING: DATA RACE
Write at 0x00c00040ec20 by goroutine 298:
  github.com/olric-data/olric/internal/cluster/routingtable.(*RoutingTable).updateRoutingTableOnCluster.(*Members).Range.(*RoutingTable).updateRoutingTableOnCluster.func1.func2()
      /home/maxim/.local/go/pkg/mod/github.com/olric-data/olric@v0.7.0/internal/cluster/routingtable/update.go:88 +0xeb
  golang.org/x/sync/errgroup.(*Group).Go.func1()
      /home/maxim/.local/go/pkg/mod/golang.org/x/sync@v0.16.0/errgroup/errgroup.go:93 +0x86

Previous read at 0x00c00040ec20 by goroutine 297:
  github.com/olric-data/olric/internal/cluster/routingtable.(*RoutingTable).updateRoutingTableOnCluster.(*Members).Range.(*RoutingTable).updateRoutingTableOnCluster.func1.func2()
      /home/maxim/.local/go/pkg/mod/github.com/olric-data/olric@v0.7.0/internal/cluster/routingtable/update.go:88 +0x12f
  golang.org/x/sync/errgroup.(*Group).Go.func1()
      /home/maxim/.local/go/pkg/mod/golang.org/x/sync@v0.16.0/errgroup/errgroup.go:93 +0x86
```

Same captured `err` variable is shared 

**File**: `internal/cluster/routingtable/update.go` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ func (r *RoutingTable) updateRoutingTableOnCluster() (map[discovery.Member]*left
 	r.Members().Range(func(id uint64, tmp discovery.Member) bool {
 		member := tmp
 		g.Go(func() error {
-			if err = sem.Acquire(r.ctx, 1); err != nil {
+			if err := sem.Acquire(r.ctx, 1); err != nil {
 				r.log.V(3).Printf("[ERROR] Failed to acquire semaphore to update routing table on %s: %v", member, err)
 				return err
 			}
```

---

### Incident Patch 11: `7621009a` (2025-05-26)
**Commit Message**: Fix auth test error message and update README structure

Adjusted the test error message in system_test.go to match the updated command format. Removed dead links related to Kubernetes and Docker Compose from the README, streamlining the documentation structure.

**File**: `README.md` (modified, +1/-3)
```diff
@@ -63,8 +63,6 @@ It's good at distributed caching and publish/subscribe messaging.
 * [Support](#support)
 * [Installing](#installing)
   * [Docker](#docker)
-  * [Kubernetes](#kubernetes)
-  * [Working with Docker Compose](#working-with-docker-compose)
 * [Getting Started](#getting-started)
   * [Operation Modes](#operation-modes)
     * [Embedded Member](#embedded-member)
@@ -185,7 +183,7 @@ Now you can start using Olric:
 olric-server -c cmd/olric-server/olric-server-local.yaml
 ```
 
-See [Configuration](#configuration) section to create your cluster properly.
+See the [Configuration](#configuration) section to create your cluster properly.
 
 ### Docker
 
```

**File**: `internal/protocol/system_test.go` (modified, +2/-2)
```diff
@@ -118,9 +118,9 @@ func TestProtocol_Auth(t *testing.T) {
 }
 
 func TestProtocol_Auth_errWrongNumber(t *testing.T) {
-	cmd := stringToCommand("auth foobar:")
+	cmd := stringToCommand("auth:")
 
 	_, err := ParseAuthCommand(cmd)
 	require.Error(t, err)
-	require.Equal(t, "wrong number of arguments for 'auth foobar' command", err.Error())
+	require.Equal(t, "wrong number of arguments for 'auth' command", err.Error())
 }
```

---

### Incident Patch 12: `ef863362` (2025-05-26)
**Commit Message**: Rename RequirePass to Password in authentication configuration

Updated all references to the authentication field `RequirePass` across the codebase to `Password` for consistency and clarity. This includes changes in struct definitions, method implementations, and test configurations.

**File**: `auth.go` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ func (db *Olric) authCommandHandler(conn redcon.Conn, cmd redcon.Command) {
 		return
 	}
 
-	if authCmd.Password == db.config.Authentication.RequirePass {
+	if authCmd.Password == db.config.Authentication.Password {
 		ctx := conn.Context().(*server.ConnContext)
 		ctx.SetAuthenticated(true)
 		conn.WriteString(protocol.StatusOK)
```

**File**: `auth_test.go` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ func TestAuthCommandHandler_WithCredentials(t *testing.T) {
 	cluster := newTestOlricCluster(t)
 	testConfig := testutil.NewConfig()
 	testConfig.Authentication = &config.Authentication{
-		RequirePass: "test-password",
+		Password: "test-password",
 	}
 	db := cluster.addMemberWithConfig(t, testConfig)
 
```

**File**: `cluster_client.go` (modified, +1/-1)
```diff
@@ -736,7 +736,7 @@ func WithCredentials(username, password string) ClusterClientOption {
 	return func(cfg *clusterClientConfig) {
 		// TODO: Use a dedicated struct for this
 		cfg.authentication = &config.Authentication{
-			RequirePass: password,
+			Password: password,
 		}
 	}
 }
```

**File**: `config/authentication.go` (modified, +5/-3)
```diff
@@ -17,22 +17,24 @@ package config
 import "strings"
 
 type Authentication struct {
-	RequirePass string
+	Password string
 }
 
 // Sanitize ensures the Authentication configuration is pre-processed and prepared for use, with no changes currently applied.
 func (a *Authentication) Sanitize() error {
-	a.RequirePass = strings.TrimSpace(a.RequirePass)
+	a.Password = strings.TrimSpace(a.Password)
 	return nil
 }
 
+// Validate checks the current Authentication configuration for validity and returns an error if issues are found.
 func (a *Authentication) Validate() error {
 	// Nothing to do
 	return nil
 }
 
+// Enabled checks if authentication is enabled by verifying if the password is set and returns true if it is configured.
 func (a *Authentication) Enabled() bool {
-	return len(a.RequirePass) > 0
+	return len(a.Password) > 0
 }
 
 // Interface guard
```

**File**: `config/client.go` (modified, +1/-1)
```diff
@@ -213,7 +213,7 @@ func (c *Client) RedisOptions() *redis.Options {
 		Limiter:         c.Limiter,
 	}
 	if c.Authentication.Enabled() {
-		options.Password = c.Authentication.RequirePass
+		options.Password = c.Authentication.Password
 	}
 	return options
 }
```

**File**: `config/config_test.go` (modified, +1/-1)
```diff
@@ -221,7 +221,7 @@ func TestConfig(t *testing.T) {
 	c.ServiceDiscovery["payload"] = "SAMPLE-PAYLOAD"
 
 	c.Authentication = &Authentication{
-		RequirePass: "secret",
+		Password: "secret",
 	}
 	c.Client.Authentication = c.Authentication
 
```

**File**: `config/internal/loader/loader.go` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ type server struct {
 }
 
 type authentication struct {
-	RequirePass string `yaml:"requirepass"`
+	Password string `yaml:"password"`
 }
 
 type client struct {
```

**File**: `config/load.go` (modified, +2/-2)
```diff
@@ -364,7 +364,7 @@ func Load(filename string) (*Config, error) {
 
 	clientConfig := Client{
 		Authentication: &Authentication{
-			RequirePass: c.Authentication.RequirePass,
+			Password: c.Authentication.Password,
 		},
 	}
 	err = mapYamlToConfig(&clientConfig, &c.Client)
@@ -410,7 +410,7 @@ func Load(filename string) (*Config, error) {
 		LeaveTimeout:               leaveTimeout,
 		DMaps:                      dmapConfig,
 		Authentication: &Authentication{
-			RequirePass: c.Authentication.RequirePass,
+			Password: c.Authentication.Password,
 		},
 	}
 
```

---

### Incident Patch 13: `48613f9c` (2025-05-26)
**Commit Message**: Refactor authentication to use RequirePass and Enabled2

Replaced `Enabled` with `RequirePass` and introduced `Enabled2` for improved authentication logic. This ensures consistency in configuration parsing and simplifies enabled checks by leveraging `RequirePass`.

**File**: `auth_test.go` (modified, +3/-3)
```diff
@@ -27,9 +27,9 @@ func TestAuthCommandHandler_WithCredentials(t *testing.T) {
 	cluster := newTestOlricCluster(t)
 	testConfig := testutil.NewConfig()
 	testConfig.Authentication = &config.Authentication{
-		Enabled:  true,
-		Username: "test-user",
-		Password: "test-password",
+		RequirePass: "test-password",
+		Username:    "test-user",
+		Password:    "test-password",
 	}
 	db := cluster.addMemberWithConfig(t, testConfig)
 
```

**File**: `cluster_client.go` (modified, +0/-1)
```diff
@@ -736,7 +736,6 @@ func WithCredentials(username, password string) ClusterClientOption {
 	return func(cfg *clusterClientConfig) {
 		// TODO: Use a dedicated struct for this
 		cfg.authentication = &config.Authentication{
-			Enabled:  true,
 			Username: username,
 			Password: password,
 		}
```

**File**: `config/authentication.go` (modified, +11/-14)
```diff
@@ -14,33 +14,30 @@
 
 package config
 
-import "errors"
+import "strings"
 
 // Authentication represents configuration settings for enabling and managing user authentication.
 type Authentication struct {
-	Enabled  bool
-	Username string
-	Password string
+	RequirePass string
+	Enabled     bool
+	Username    string
+	Password    string
 }
 
 // Sanitize ensures the Authentication configuration is pre-processed and prepared for use, with no changes currently applied.
 func (a *Authentication) Sanitize() error {
-	// Nothing to do
+	a.RequirePass = strings.TrimSpace(a.RequirePass)
 	return nil
 }
 
-// Validate checks if the Authentication configuration is valid, ensuring username and password are set if enabled.
 func (a *Authentication) Validate() error {
-	if a.Enabled {
-		if a.Username == "" {
-			return errors.New("if authentication is enabled, username cannot be empty")
-		}
-		if a.Password == "" {
-			return errors.New("if authentication is enabled, password cannot be empty")
-		}
-	}
+	// Nothing to do
 	return nil
 }
 
+func (a *Authentication) Enabled2() bool {
+	return len(a.RequirePass) > 0
+}
+
 // Interface guard
 var _ IConfig = (*Authentication)(nil)
```

**File**: `config/client.go` (modified, +1/-1)
```diff
@@ -212,7 +212,7 @@ func (c *Client) RedisOptions() *redis.Options {
 		TLSConfig:       c.TLSConfig,
 		Limiter:         c.Limiter,
 	}
-	if c.Authentication.Enabled {
+	if c.Authentication.Enabled2() {
 		options.Username = c.Authentication.Username
 		options.Password = c.Authentication.Password
 	}
```

**File**: `config/config_test.go` (modified, +3/-3)
```diff
@@ -221,9 +221,9 @@ func TestConfig(t *testing.T) {
 	c.ServiceDiscovery["payload"] = "SAMPLE-PAYLOAD"
 
 	c.Authentication = &Authentication{
-		Enabled:  true,
-		Username: "foobar",
-		Password: "secret",
+		RequirePass: "secret",
+		Username:    "foobar",
+		Password:    "secret",
 	}
 	c.Client.Authentication = c.Authentication
 
```

**File**: `config/internal/loader/loader.go` (modified, +4/-3)
```diff
@@ -39,9 +39,10 @@ type server struct {
 }
 
 type authentication struct {
-	Enabled  bool   `yaml:"enabled"`
-	Username string `yaml:"username"`
-	Password string `yaml:"password"`
+	RequirePass string `yaml:"requirepass"`
+	Enabled     bool   `yaml:"enabled"`
+	Username    string `yaml:"username"`
+	Password    string `yaml:"password"`
 }
 
 type client struct {
```

**File**: `config/load.go` (modified, +6/-6)
```diff
@@ -364,9 +364,9 @@ func Load(filename string) (*Config, error) {
 
 	clientConfig := Client{
 		Authentication: &Authentication{
-			Enabled:  c.Authentication.Enabled,
-			Username: c.Authentication.Username,
-			Password: c.Authentication.Password,
+			RequirePass: c.Authentication.RequirePass,
+			Username:    c.Authentication.Username,
+			Password:    c.Authentication.Password,
 		},
 	}
 	err = mapYamlToConfig(&clientConfig, &c.Client)
@@ -412,9 +412,9 @@ func Load(filename string) (*Config, error) {
 		LeaveTimeout:               leaveTimeout,
 		DMaps:                      dmapConfig,
 		Authentication: &Authentication{
-			Enabled:  c.Authentication.Enabled,
-			Username: c.Authentication.Username,
-			Password: c.Authentication.Password,
+			RequirePass: c.Authentication.RequirePass,
+			Username:    c.Authentication.Username,
+			Password:    c.Authentication.Password,
 		},
 	}
 
```

**File**: `olric.go` (modified, +2/-2)
```diff
@@ -212,7 +212,7 @@ func New(c *config.Config) (*Olric, error) {
 	}
 	e.Set("logger", flogger)
 
-	if c.Authentication.Enabled {
+	if c.Authentication.Enabled2() {
 		c.Client.Authentication = c.Authentication
 	}
 	client := server.NewClient(c.Client)
@@ -240,7 +240,7 @@ func New(c *config.Config) (*Olric, error) {
 		BindAddr:        c.BindAddr,
 		BindPort:        c.BindPort,
 		KeepAlivePeriod: c.KeepAlivePeriod,
-		RequireAuth:     c.Authentication.Enabled,
+		RequireAuth:     c.Authentication.Enabled2(),
 	}
 	srv := server.New(rc, flogger)
 	srv.SetPreConditionFunc(db.preconditionFunc)
```

---

### Incident Patch 14: `c52ccbcb` (2024-04-18)
**Commit Message**: fix: grammar of error message

this is a text only change of the grammar of an error message.

**File**: `olric.go` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ var (
 	ErrNoSuchLock = errors.New("no such lock")
 
 	// ErrClusterQuorum means that the cluster could not reach a healthy numbers of members to operate.
-	ErrClusterQuorum = errors.New("cannot be reached cluster quorum to operate")
+	ErrClusterQuorum = errors.New("failed to find enough peers to create quorum")
 
 	// ErrKeyTooLarge means that the given key is too large to process.
 	// Maximum length of a key is 256 bytes.
```

#### Recent Merged Pull Requests:
- **PR #287** (closed): Fix silent data loss in DMap.Delete with multi-key/multi-owner deletes (@fcraviolatti)
- **PR #284** (closed): add: mget using repeated gets (@chrollo-lucifer-12)
- **PR #283** (2026-06-12): fix pipeline Get & GetPut panic on missing keys (@derekperkins)
- **PR #279** (2026-01-21): Fix DMap name in evictKeys()  (@sojadhav)
- **PR #272** (2025-09-22): Fix data race in internal/cluster/routingtable/update.go (@phmx)
- **PR #271** (2025-09-27): Fix conflict between "not exist" and expiration options. (@phmx)
- **PR #270** (2025-10-28): fix: leaking cluster clients in `EmbeddedDMap.Scan` (@phmx)
- **PR #268** (2025-05-26): Implement AUTH command (@buraksezer)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

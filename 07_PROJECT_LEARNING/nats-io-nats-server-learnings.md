> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nats-io-nats-server-learnings.md`  
> **Source**: github ([https://github.com/nats-io/nats-server](https://github.com/nats-io/nats-server))  
> **Source Version**: `60ce2463`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T21:43:37.482Z  
> **Learning ID**: `learn-github-nats-io-nats-server`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): nats-io/nats-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/nats-io-nats-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nats-io/nats-server](https://github.com/nats-io/nats-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-28T21:43:37.477Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nats-io/nats-server`
- **Description**: High-Performance server for NATS.io, the cloud and edge native messaging system.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 20954 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `server/ipqueue.go`
```
// Copyright 2021-2026 The NATS Authors
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

package server

import (
	"errors"
	"iter"
	"sync"
	"sync/atomic"
)

const ipQueueDefaultMaxRecycleSize = 4 * 1024

// This is a generic intra-process queue.
type ipQueue[T any] struct {
	inprogress int64
	sync.Mutex
	ch   chan struct{}
	elts []T
	pos  int
	pool *sync.Pool
	sz   uint64 // Calculated size (only if calc != nil)
	name string
	m    *sync.Map
	ipQueueOpts[T]
}

type ipQueueOpts[T any] struct {
	mrs  int              // Max recycle size
	calc func(e T) uint64 // Calc function for tracking size
	msz  uint64           // Limit by total calculated size
	mlen int              // Limit by number of entries
}

type ipQueueOpt[T any] func(*ipQueueOpts[T])

// This option allows to set the maximum recycle size when attempting
// to put back a slice to the pool.
func ipqMaxRecycleSize[T any](max int) ipQueueOpt[T] {
	return func(o *ipQueueOpts[T]) {
		o.mrs = max
	}
}

// This option enables total queue size counting by passing in a function
// that evaluates the size of each entry as it is pushed/popped. This option
// enables the size() function.
func ipqSizeCalculation[T any](calc func(e T) uint64) ipQueueOpt[T] {
	return func(o *ipQueueOpts[T]) {
		o.calc = calc
	}
}

// This option allows setting the maximum queue size. Once the limit is
// reached, then push() will stop returning true and no more entries will
// be stored until some more are popped. The ipQueue_SizeCalculation must
// be provided for this to work.
func ipqLimitBySize[T any](max uint64) ipQueueOpt[T] {
	return func(o *ipQueueOpts[T]) {
		o.msz = max
	}
}

// This option allows setting the maximum queue length. Once the limit is
// reached, then push() will stop returning true and no more entries will
// be stored until some more are popped.
func ipqLimitByLen[T any](max int) ipQueueOpt[T] {
	return func(o *ipQueueOpts[T]) {
		o.mlen = max
	}
}

var errIPQLenLimitReached = errors.New("IPQ len limit reached")
var errIPQSizeLimitReached = errors.New("IPQ size limit reached")

func newIPQueue[T any](s *Server, name string, opts ...ipQueueOpt[T]) *ipQueue[T] {
	q := &ipQueue[T]{
		ch: make(chan struct{}, 1),
		pool: &sync.Pool{
			New: func() any {
				// Reason we use pointer to slice instead of slice is explained
				// here: https://staticcheck.io/docs/checks#SA6002
				res := make([]T, 0, 32)
				return &res
			},
		},
		name: name,
		m:    &s.ipQueues,
		ipQueueOpts: ipQueueOpts[T]{
			mrs: ipQueueDefaultMaxRecycleSize,
		},
	}
	for _, o := range opts {
		o(&q.ipQueueOpts)
	}
	s.ipQueues.Store(name, q)
	return q
}

// Add the element `e` to the queue, notifying the queue channel's `ch` if the
// entry is the first to be added, and returns the length of the queue after
// this element is added.
func (q *ipQueue[T]) push(e T) (int, error) {
	q.Lock()
	l := len(q.elts) - q.pos
	if q.mlen > 0 && l == q.mlen {
		q.Unlock()
		return l, errIPQLenLimitReached
	}
	if q.calc != nil {
		sz := q.calc(e)
		if q.msz > 0 && q.sz+sz > q.msz {
			q.Unlock()
			return l, errIPQSizeLimitReached
		}
		q.sz += sz
	}
	if q.elts == nil {
		// What comes out of the pool is already of size 0, so no need for [:0].
		q.elts = *(q.pool.Get().(*[]T))
	}
	q.elts = append(q.elts, e)
	q.Unlock()
	if l == 0 {
		select {
		case q.ch <- struct{}{}:
		default:
		}
	}
	return l + 1, nil
}

// Add all elements yielded by seq to the queue while holding the queue
// lock, preventing other producers from pushing interleaving elements.
// On success, it returns the queue length after adding all yielded elements.
// If a queue limit is reached, no yielded elements are retained, and it
// returns the unchanged queue length and the first limit error.
func (q *ipQueue[T]) pushMany(seq iter.Seq[T]) (int, error) {
	q.Lock()
	l, added, start := len(q.elts)-q.pos, 0, len(q.elts)
	initialSize := q.sz
	revert := func() {
		clear(q.elts[start:])
		q.elts = q.elts[:start]
		q.sz, added = initialSize, 0
	}
	defer func() {
		q.Unlock()
		if l == 0 && added > 0 {
			select {
			case q.ch <- struct{}{}:
			default:
			}
		}
	}()

	for e := range seq {
		if q.mlen > 0 && l+added == q.mlen {
			revert()
			return l, errIPQLenLimitReached
		}
		if q.calc != nil {
			sz := q.calc(e)
			if q.msz > 0 && q.sz+sz > q.msz {
				revert()
				return l, errIPQSizeLimitReached
			}
			q.sz += sz
		}
		if q.elts == nil {
			// What comes out of the pool is already of size 0, so no need for [:0].
			q.elts = *(q.pool.Get().(*[]T))
		}
		q.elts = append(q.elts, e)
		added++
	}
	return l + added, nil
}

// Returns the whole list of elements currently present in the queue,
// emptying the queue. This should be called after receiving a notification
// from the queue's `ch` notification channel that indicates that there
// is something in the queue.
// However, in cases where `drain()` may be called from another go
// routine, it is possible that a routine is notified that there is
// something, but by the time it calls `pop()`, the drain() would have
// emptied the queue. So the caller should never assume that pop() will
// return a slice of 1 or more, it could return `nil`.
func (q *ipQueue[T]) pop() []T {
	if q == nil {
		return nil
	}
	q.Lock()
	if len(q.elts)-q.pos == 0 {
		q.Unlock()
		return nil
	}
	var elts []T
	if q.pos == 0 {
		elts = q.elts
	} else {
		elts = q.elts[q.pos:]
	}
	q.elts, q.pos, q.sz = nil, 0, 0
	atomic.AddInt64(&q.inprogress, int64(len(elts)))
	q.Unlock()
	return elts
}

// Returns the first element from the queue, if any. See comment above
// regarding calling after being notified that there is something and
// the use of drain(). In short, the caller should always check the
// boolean return value to ensure that the value is genuine and not a
// default empty value.
func (q *ipQueue[T]) popOne() (T, bool) {
	q.Lock()
	l := len(q.elts) - q.pos
	if l == 0 {
		q.Unlock()
		var empty T
		return empty, false
	}
	e := q.elts[q.pos]
	if l--; l > 0 {
		q.pos++
		if q.calc != nil {
			q.sz -= q.calc(e)
		}
		// We need to re-signal
		select {
		case q.ch <- struct{}{}:
		default:
		}
	} else {
		// We have just emptied the queue, so we can reuse unless it is too big.
		if cap(q.elts) <= q.mrs {
			q.elts = q.elts[:0]
		} else {
			q.elts = nil
		}
		q.pos, q.sz = 0, 0
	}
	q.Unlock()
	return e, true
}

// After a pop(), the slice can be recycled for the next push() when
// a first element is added to the queue.
// This will also decrement the "in progress" count with the length
// of the slice.
// WARNING: The caller MUST never reuse `elts`.
func (q *ipQueue[T]) recycle(elts *[]T) {
	// If invoked with a nil list, nothing to do.
	if elts == nil || *elts == nil {
		return
	}
	// Update the in progress count.
	if len(*elts) > 0 {
		atomic.AddInt64(&q.inprogress, int64(-(len(*elts))))
	}
	// We also don't want to recycle huge slices, so check against the max.
	// q.mrs is normally immutable but can be changed, in a safe way, in some tests.
	if cap(*elts) > q.mrs {
		return
	}
	(*elts) = (*elts)[:0]
	q.pool.Put(elts)
}

// Returns the current length of the queue.
func (q *ipQueue[T]) len() int {
	q.Lock()
	defer q.Unlock()
	return len(q.elts) - q.pos
}

// Returns the calculated size of the queue (if ipQueue_SizeCalculation has been
// passed in), otherwise returns zero.
func (q *ipQueue[T]) size() uint64 {
	q.Lock()
	defer q.Unlock()
	return q.sz
}

// Empty the queue and consumes the notification signal if present.
// Returns the number of items that were drained from the queue.
// Note that this could cause a reader go routine that has been
// notified that there is something in the queue (reading from queue's `ch`)
// may then get nothing if `drain()` is invoked before the `pop()` or `popOne()`.
func (q *ipQueue[T]) drain() int {
	if q == nil {
		return 0
	}
	q.Lock()
	olen := len(q.elts) - q.pos
	q.elts, q.pos, q.sz = nil, 0, 0
	// Consume the signal if it was present to reduce the chance of a reader
	// routine to be think that there is something in the queue...
	select {
	case <-q.ch:
	default:
	}
	q.Unlock()
	return olen
}

// Since the length of the queue goes to 0 after a pop(), it is good to
// have an insight on how many elements are yet to be processed after a pop().
// For that reason, the queue maintains a count of elements returned through
// the pop() API. When the caller will call q.recycle(), this count will
// be reduced by the size of the slice returned by pop().
func (q *ipQueue[T]) inProgress() int64 {
	return atomic.LoadInt64(&q.inprogress)
}

// Remove this queue from the server's map of ipQueues.
// All ipQueue operations (such as push/pop/etc..) are still possible.
func (q *ipQueue[T]) unregister() {
	if q == nil {
		return
	}
	q.m.Delete(q.name)
}

```

### Core Architecture Module: `server/stree/util.go`
```
// Copyright 2023-2026 The NATS Authors
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

package stree

// For subject matching.
const (
	pwc  = '*'
	fwc  = '>'
	tsep = '.'
)

// Determine index of common prefix. No match at all is 0, etc.
func commonPrefixLen(s1, s2 []byte) int {
	limit := min(len(s1), len(s2))
	var i int
	for ; i < limit; i++ {
		if s1[i] != s2[i] {
			break
		}
	}
	return i
}

type position interface{ int | uint16 }

// No pivot available.
const noPivot = byte(127)

// Can return 127 (DEL) if we have all the subject as prefixes.
// We used to use 0, but when that was in the subject would cause infinite recursion in some situations.
func pivot[N position](subject []byte, pos N) byte {
	if int(pos) >= len(subject) {
		return noPivot
	}
	return subject[pos]
}

```

### Core Architecture Module: `server/util.go`
```
// Copyright 2012-2026 The NATS Authors
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

package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/bits"
	"net"
	"net/url"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// This map is used to store URLs string as the key with a reference count as
// the value. This is used to handle gossiped URLs such as connect_urls, etc..
type refCountedUrlSet map[string]int

// Ascii numbers 0-9
const (
	asciiZero = 48
	asciiNine = 57
)

func versionComponents(version string) (major, minor, patch int, err error) {
	m := semVerRe.FindStringSubmatch(version)
	if len(m) == 0 {
		return 0, 0, 0, errors.New("invalid semver")
	}
	major, err = strconv.Atoi(m[1])
	if err != nil {
		return -1, -1, -1, err
	}
	minor, err = strconv.Atoi(m[2])
	if err != nil {
		return -1, -1, -1, err
	}
	patch, err = strconv.Atoi(m[3])
	if err != nil {
		return -1, -1, -1, err
	}
	return major, minor, patch, err
}

func versionAtLeastCheckError(version string, emajor, eminor, epatch int) (bool, error) {
	major, minor, patch, err := versionComponents(version)
	if err != nil {
		return false, err
	}
	if major > emajor ||
		(major == emajor && minor > eminor) ||
		(major == emajor && minor == eminor && patch >= epatch) {
		return true, nil
	}
	return false, err
}

func versionAtLeast(version string, emajor, eminor, epatch int) bool {
	res, _ := versionAtLeastCheckError(version, emajor, eminor, epatch)
	return res
}

// parseSize expects decimal positive numbers. We
// return -1 to signal error.
func parseSize(d []byte) (n int) {
	const maxParseSizeLen = 9 //999M

	l := len(d)
	if l == 0 || l > maxParseSizeLen {
		return -1
	}
	var (
		i   int
		dec byte
	)

	// Note: Use `goto` here to avoid for loop in order
	// to have the function be inlined.
	// See: https://github.com/golang/go/issues/14768
loop:
	dec = d[i]
	if dec < asciiZero || dec > asciiNine {
		return -1
	}
	n = n*10 + (int(dec) - asciiZero)

	i++
	if i < l {
		goto loop
	}
	return n
}

// Largest queue weight parseSize accepts on the wire.
const maxQueueWeight = 999_999_999

// Converts a queue weight total to the weight sent to a route or leaf.
func queueWeight(n int64) int32 {
	return int32(min(n, maxQueueWeight))
}

// parseInt64 expects decimal positive numbers. We
// return -1 to signal error
func parseInt64(d []byte) (n int64) {
	if len(d) == 0 {
		return -1
	}
	for _, dec := range d {
		if dec < asciiZero || dec > asciiNine {
			return -1
		}
		n = n*10 + (int64(dec) - asciiZero)
	}
	return n
}

// parseUint64 expects decimal positive numbers. Returns the value and true on success,
// or 0 and false on invalid input or overflow.
func parseUint64(d []byte) (uint64, bool) {
	if len(d) == 0 {
		return 0, false
	}
	var n uint64
	for _, dec := range d {
		if dec < asciiZero || dec > asciiNine {
			return 0, false
		}
		digit := uint64(dec) - asciiZero
		if n > math.MaxUint64/10 || (n == math.MaxUint64/10 && digit > math.MaxUint64%10) {
			return 0, false
		}
		n = n*10 + digit
	}
	return n, true
}

// Helper to move from float seconds to time.Duration
func secondsToDuration(seconds float64) time.Duration {
	ttl := seconds * float64(time.Second)
	return time.Duration(ttl)
}

// Parse a host/port string with a default port to use
// if none (or 0 or -1) is specified in `hostPort` string.
func parseHostPort(hostPort string, defaultPort int) (host string, port int, err error) {
	if hostPort != "" {
		host, sPort, err := net.SplitHostPort(hostPort)
		if ae, ok := err.(*net.AddrError); ok && strings.Contains(ae.Err, "missing port") {
			// try appending the current port
			host, sPort, err = net.SplitHostPort(fmt.Sprintf("%s:%d", hostPort, defaultPort))
		}
		if err != nil {
			return "", -1, err
		}
		port, err = strconv.Atoi(strings.TrimSpace(sPort))
		if err != nil {
			return "", -1, err
		}
		if port == 0 || port == -1 {
			port = defaultPort
		}
		return strings.TrimSpace(host), port, nil
	}
	return "", -1, errors.New("no hostport specified")
}

// Returns true if URL u1 represents the same URL than u2,
// false otherwise.
func urlsAreEqual(u1, u2 *url.URL) bool {
	return reflect.DeepEqual(u1, u2)
}

// comma produces a string form of the given number in base 10 with
// commas after every three orders of magnitude.
//
// e.g. comma(834142) -> 834,142
//
// This function was copied from the github.com/dustin/go-humanize
// package (MIT License) and is Copyright Dustin Sallings <dustin@spy.net>
func comma(v int64) string {
	sign := ""

	// Min int64 can't be negated to a usable value, so it has to be special cased.
	if v == math.MinInt64 {
		return "-9,223,372,036,854,775,808"
	}

	if v < 0 {
		sign = "-"
		v = 0 - v
	}

	parts := []string{"", "", "", "", "", "", ""}
	j := len(parts) - 1

	for v > 999 {
		parts[j] = strconv.FormatInt(v%1000, 10)
		switch len(parts[j]) {
		case 2:
			parts[j] = "0" + parts[j]
		case 1:
			parts[j] = "00" + parts[j]
		}
		v = v / 1000
		j--
	}
	parts[j] = strconv.Itoa(int(v))
	return sign + strings.Join(parts[j:], ",")
}

// Adds urlStr to the given map. If the string was already present, simply
// bumps the reference count.
// Returns true only if it was added for the first time.
func (m refCountedUrlSet) addUrl(urlStr string) bool {
	m[urlStr]++
	return m[urlStr] == 1
}

// Removes urlStr from the given map. If the string is not present, nothing
// is done and false is returned.
// If the string was present, its reference count is decreased. Returns true
// if this was the last reference, false otherwise.
func (m refCountedUrlSet) removeUrl(urlStr string) bool {
	removed := false
	if ref, ok := m[urlStr]; ok {
		if ref == 1 {
			removed = true
			delete(m, urlStr)
		} else {
			m[urlStr]--
		}
	}
	return removed
}

// Returns the unique URLs in this map as a slice
func (m refCountedUrlSet) getAsStringSlice() []string {
	a := make([]string, 0, len(m))
	for u := range m {
		a = append(a, u)
	}
	return a
}

// natsListenConfig provides a common configuration to match the one used by
// net.Listen() but with our own defaults.
// Go 1.13 introduced default-on TCP keepalives with aggressive timings and
// there's no sane portable way in Go with stdlib to split the initial timer
// from the retry timer.  Linux/BSD defaults are 2hrs/75s and Go sets both
// to 15s; the issue re making them indepedently tunable has been open since
// 2014 and this code here is being written in 2020.
// The NATS protocol has its own L7 PING/PONG keepalive system and the Go
// defaults are inappropriate for IoT deployment scenarios.
// Replace any NATS-protocol calls to net.Listen(...) with
// natsListenConfig.Listen(ctx,...) or use natsListen(); leave calls for HTTP
// monitoring, etc, on the default.
var natsListenConfig = &net.ListenConfig{
	KeepAlive: -1,
}

// natsListen() is the same as net.Listen() except that TCP keepalives are
// disabled (to match Go's behavior before Go 1.13).
func natsListen(network, address string) (net.Listener, error) {
	return natsListenConfig.Listen(context.Background(), network, address)
}

// natsDialTimeout is the same as net.DialTimeout() except the TCP keepalives
// are disabled (to match Go's behavior before Go 1.13).
func natsDialTimeout(network, address string, timeout time.Duration) (net.Conn, error) {
	d := net.Dialer{
		Timeout:   timeout,
		KeepAlive: -1,
	}
	return d.Dial(network, address)
}

// redactURLList() returns a copy of a list of URL pointers where each item
// in the list will either be the same pointer if the URL does not contain a
// password, or to a new object if there is a password.
// The intended use-case is for logging lists of URLs safely.
func redactURLList(unredacted []*url.URL) []*url.URL {
	r := make([]*url.URL, len(unredacted))
	// In the common case of no passwords, if we don't let the new object leave
	// this function then GC should be easier.
	needCopy := false
	for i := range unredacted {
		if unredacted[i] == nil {
			r[i] = nil
			continue
		}
		if _, has := unredacted[i].User.Password(); !has {
			r[i] = unredacted[i]
			continue
		}
		needCopy = true
		ru := *unredacted[i]
		ru.User = url.UserPassword(ru.User.Username(), "xxxxx")
		r[i] = &ru
	}
	if needCopy {
		return r
	}
	return unredacted
}

// redactURLString() attempts to redact a URL string.
func redactURLString(raw string) string {
	if !strings.ContainsRune(raw, '@') {
		return raw
	}
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	return u.Redacted()
}

// getURLsAsString returns a slice of u.Host from the given slice of url.URL's
func getURLsAsString(urls []*url.URL) []string {
	a := make([]string, 0, len(urls))
	for _, u := range urls {
		a = append(a, u.Host)
	}
	return a
}

// copyBytes make a new slice of the same size as `src` and copy its content.
// If `src` is nil or its length is 0, then this returns `nil`
func copyBytes(src []byte) []byte {
	if len(src) == 0 {
		return nil
	}
	dst := make([]byte, len(src))
	copy(dst, src)
	return dst
}

// copyStrings make a new slice of the same size than `src` and copy its content.
// If `src` is nil, then this returns `nil`
func copyStrings(src []string) []string {
	if src == nil {
		return nil
	}
	dst := make([]string, len(src))
	copy(dst, src)
	return dst
}

// Returns a byte slice for the INFO protocol.
func generateInfoJSON(info *Info) []byte {
	b, _ := json.Marshal(info)
	pcs := [][]byte{[]byte("INFO"), b, []byte(CR_LF)}
	return bytes.Join(pcs, []byte(" "))
}

// parallelTaskQueue starts a number of g
```

### Core Architecture Module: `conf/fuzz.go`
```
// Copyright 2020-2025 The NATS Authors
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

//go:build gofuzz

package conf

func Fuzz(data []byte) int {
	_, err := Parse(string(data))
	if err != nil {
		return 0
	}
	return 1
}

```

### Core Architecture Module: `conf/lex.go`
```
// Copyright 2013-2024 The NATS Authors
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

// Customized heavily from
// https://github.com/BurntSushi/toml/blob/master/lex.go, which is based on
// Rob Pike's talk: http://cuddle.googlecode.com/hg/talk/lex.html

// The format supported is less restrictive than today's formats.
// Supports mixed Arrays [], nested Maps {}, multiple comment types (# and //)
// Also supports key value assignments using '=' or ':' or whiteSpace()
//   e.g. foo = 2, foo : 2, foo 2
// maps can be assigned with no key separator as well
// semicolons as value terminators in key/value assignments are optional
//
// see lex_test.go for more examples.

package conf

import (
	"encoding/hex"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"
)

type itemType int

const (
	itemError itemType = iota
	itemNIL            // used in the parser to indicate no type
	itemEOF
	itemKey
	itemText
	itemString
	itemBool
	itemInteger
	itemFloat
	itemDatetime
	itemArrayStart
	itemArrayEnd
	itemMapStart
	itemMapEnd
	itemCommentStart
	itemVariable
	itemInclude
)

const (
	eof               = 0
	mapStart          = '{'
	mapEnd            = '}'
	keySepEqual       = '='
	keySepColon       = ':'
	arrayStart        = '['
	arrayEnd          = ']'
	arrayValTerm      = ','
	mapValTerm        = ','
	commentHashStart  = '#'
	commentSlashStart = '/'
	dqStringStart     = '"'
	dqStringEnd       = '"'
	sqStringStart     = '\''
	sqStringEnd       = '\''
	optValTerm        = ';'
	topOptStart       = '{'
	topOptValTerm     = ','
	topOptTerm        = '}'
	blockStart        = '('
	blockEnd          = ')'
	mapEndString      = string(mapEnd)
)

type stateFn func(lx *lexer) stateFn

type lexer struct {
	input string
	start int
	pos   int
	width int
	line  int
	state stateFn
	items chan item

	// A stack of state functions used to maintain context.
	// The idea is to reuse parts of the state machine in various places.
	// For example, values can appear at the top level or within arbitrarily
	// nested arrays. The last state on the stack is used after a value has
	// been lexed. Similarly for comments.
	stack []stateFn

	// Used for processing escapable substrings in double-quoted and raw strings
	stringParts   []string
	stringStateFn stateFn

	// lstart is the start position of the current line.
	lstart int

	// ilstart is the start position of the line from the current item.
	ilstart int
}

type item struct {
	typ  itemType
	val  string
	line int
	pos  int
}

func (lx *lexer) nextItem() item {
	for {
		select {
		case item := <-lx.items:
			return item
		default:
			lx.state = lx.state(lx)
		}
	}
}

func lex(input string) *lexer {
	lx := &lexer{
		input:       input,
		state:       lexTop,
		line:        1,
		items:       make(chan item, 10),
		stack:       make([]stateFn, 0, 10),
		stringParts: []string{},
	}
	return lx
}

func (lx *lexer) push(state stateFn) {
	lx.stack = append(lx.stack, state)
}

func (lx *lexer) pop() stateFn {
	if len(lx.stack) == 0 {
		return lx.errorf("BUG in lexer: no states to pop.")
	}
	li := len(lx.stack) - 1
	last := lx.stack[li]
	lx.stack = lx.stack[0:li]
	return last
}

func (lx *lexer) emit(typ itemType) {
	val := strings.Join(lx.stringParts, "") + lx.input[lx.start:lx.pos]
	// Position of item in line where it started.
	pos := lx.pos - lx.ilstart - len(val)
	lx.items <- item{typ, val, lx.line, pos}
	lx.start = lx.pos
	lx.ilstart = lx.lstart
}

func (lx *lexer) emitString() {
	var finalString string
	if len(lx.stringParts) > 0 {
		finalString = strings.Join(lx.stringParts, "") + lx.input[lx.start:lx.pos]
		lx.stringParts = []string{}
	} else {
		finalString = lx.input[lx.start:lx.pos]
	}
	// Position of string in line where it started.
	pos := lx.pos - lx.ilstart - len(finalString)
	lx.items <- item{itemString, finalString, lx.line, pos}
	lx.start = lx.pos
	lx.ilstart = lx.lstart
}

func (lx *lexer) addCurrentStringPart(offset int) {
	lx.stringParts = append(lx.stringParts, lx.input[lx.start:lx.pos-offset])
	lx.start = lx.pos
}

func (lx *lexer) addStringPart(s string) stateFn {
	lx.stringParts = append(lx.stringParts, s)
	lx.start = lx.pos
	return lx.stringStateFn
}

func (lx *lexer) hasEscapedParts() bool {
	return len(lx.stringParts) > 0
}

func (lx *lexer) next() (r rune) {
	if lx.pos >= len(lx.input) {
		lx.width = 0
		return eof
	}

	if lx.input[lx.pos] == '\n' {
		lx.line++

		// Mark start position of current line.
		lx.lstart = lx.pos
	}
	r, lx.width = utf8.DecodeRuneInString(lx.input[lx.pos:])
	lx.pos += lx.width

	return r
}

// ignore skips over the pending input before this point.
func (lx *lexer) ignore() {
	lx.start = lx.pos
	lx.ilstart = lx.lstart
}

// backup steps back one rune. Can be called only once per call of next.
func (lx *lexer) backup() {
	lx.pos -= lx.width
	if lx.pos < len(lx.input) && lx.input[lx.pos] == '\n' {
		lx.line--
	}
}

// peek returns but does not consume the next rune in the input.
func (lx *lexer) peek() rune {
	r := lx.next()
	lx.backup()
	return r
}

// errorf stops all lexing by emitting an error and returning `nil`.
// Note that any value that is a character is escaped if it's a special
// character (new lines, tabs, etc.).
func (lx *lexer) errorf(format string, values ...any) stateFn {
	for i, value := range values {
		if v, ok := value.(rune); ok {
			values[i] = escapeSpecial(v)
		}
	}

	// Position of error in current line.
	pos := lx.pos - lx.lstart
	lx.items <- item{
		itemError,
		fmt.Sprintf(format, values...),
		lx.line,
		pos,
	}
	return nil
}

// lexTop consumes elements at the top level of data structure.
func lexTop(lx *lexer) stateFn {
	r := lx.next()
	if unicode.IsSpace(r) {
		return lexSkip(lx, lexTop)
	}

	switch r {
	case topOptStart:
		lx.push(lexTop)
		return lexSkip(lx, lexBlockStart)
	case commentHashStart:
		lx.push(lexTop)
		return lexCommentStart
	case commentSlashStart:
		rn := lx.next()
		if rn == commentSlashStart {
			lx.push(lexTop)
			return lexCommentStart
		}
		lx.backup()
		fallthrough
	case eof:
		if lx.pos > lx.start {
			return lx.errorf("Unexpected EOF.")
		}
		lx.emit(itemEOF)
		return nil
	}

	// At this point, the only valid item can be a key, so we back up
	// and let the key lexer do the rest.
	lx.backup()
	lx.push(lexTopValueEnd)
	return lexKeyStart
}

// lexTopValueEnd is entered whenever a top-level value has been consumed.
// It must see only whitespace, and will turn back to lexTop upon a new line.
// If it sees EOF, it will quit the lexer successfully.
func lexTopValueEnd(lx *lexer) stateFn {
	r := lx.next()
	switch {
	case r == commentHashStart:
		// a comment will read to a new line for us.
		lx.push(lexTop)
		return lexCommentStart
	case r == commentSlashStart:
		rn := lx.next()
		if rn == commentSlashStart {
			lx.push(lexTop)
			return lexCommentStart
		}
		lx.backup()
		fallthrough
	case isWhitespace(r):
		return lexTopValueEnd
	case isNL(r) || r == eof || r == optValTerm || r == topOptValTerm || r == topOptTerm:
		lx.ignore()
		return lexTop
	}
	return lx.errorf("Expected a top-level value to end with a new line, "+
		"comment or EOF, but got '%v' instead.", r)
}

func lexBlockStart(lx *lexer) stateFn {
	r := lx.next()
	if unicode.IsSpace(r) {
		return lexSkip(lx, lexBlockStart)
	}

	switch r {
	case topOptStart:
		lx.push(lexBlockEnd)
		return lexSkip(lx, lexBlockStart)
	case topOptTerm:
		lx.ignore()
		return lx.pop()
	case commentHashStart:
		lx.push(lexBlockStart)
		return lexCommentStart
	case commentSlashStart:
		rn := lx.next()
		if rn == commentSlashStart {
			lx.push(lexBlockStart)
			return lexCommentStart
		}
		lx.backup()
		fallthrough
	case eof:
		if lx.pos > lx.start {
			return lx.errorf("Unexpected EOF.")
		}
		lx.emit(itemEOF)
		return nil
	}

	// At this point, the only valid item can be a key, so we back up
	// and let the key lexer do the rest.
	lx.backup()
	lx.push(lexBlockValueEnd)
	return lexKeyStart
}

// lexBlockValueEnd is entered whenever a block-level value has been consumed.
// It must see only whitespace, and will turn back to lexBlockStart upon a new line.
// If it sees EOF, it will quit the lexer successfully.
func lexBlockValueEnd(lx *lexer) stateFn {
	r := lx.next()
	switch {
	case r == commentHashStart:
		// a comment will read to a new line for us.
		lx.push(lexBlockValueEnd)
		return lexCommentStart
	case r == commentSlashStart:
		rn := lx.next()
		if rn == commentSlashStart {
			lx.push(lexBlockValueEnd)
			return lexCommentStart
		}
		lx.backup()
		fallthrough
	case isWhitespace(r):
		return lexBlockValueEnd
	case isNL(r) || r == optValTerm || r == topOptValTerm:
		lx.ignore()
		return lexBlockStart
	case r == topOptTerm:
		lx.backup()
		return lexBlockEnd
	}
	return lx.errorf("Expected a block-level value to end with a new line, "+
		"comment or EOF, but got '%v' instead.", r)
}

// lexBlockEnd is entered whenever a block-level value has been consumed.
// It must see only whitespace, and will turn back to lexTop upon a "}".
func lexBlockEnd(lx *lexer) stateFn {
	r := lx.next()
	switch {
	case r == commentHashStart:
		// a comment will read to a new line for us.
		lx.push(lexBlockStart)
		return lexCommentStart
	case r == commentSlashStart:
		rn := lx.next()
		if rn == commentSlashStart {
			lx.push(lexBlockStart)
			return lexCommentStart
		}
		lx.backup()
		fallthrough
	case isNL(r) || isWhitespace(r):
		return lexBlockEnd
	case r == optValTerm || r == topOptValTerm:
		lx.ignore()
		return lexBlockStart
	case r == topOptTerm:
		lx.ignore()
		return lx.pop()
	}
	return lx
```

### Core Architecture Module: `conf/parse.go`
```
// Copyright 2013-2026 The NATS Authors
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

// Package conf supports a configuration file format used by gnatsd. It is
// a flexible format that combines the best of traditional
// configuration formats and newer styles such as JSON and YAML.
package conf

// The format supported is less restrictive than today's formats.
// Supports mixed Arrays [], nested Maps {}, multiple comment types (# and //)
// Also supports key value assignments using '=' or ':' or whiteSpace()
//   e.g. foo = 2, foo : 2, foo 2
// maps can be assigned with no key separator as well
// semicolons as value terminators in key/value assignments are optional
//
// see parse_test.go for more examples.

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode"
)

const _EMPTY_ = ""

type parser struct {
	mapping map[string]any
	lx      *lexer

	// The current scoped context, can be array or map
	ctx any

	// stack of contexts, either map or array/slice stack
	ctxs []any

	// Keys stack
	keys []string

	// Keys stack as items
	ikeys []item

	// The config file path, empty by default.
	fp string

	// pedantic reports error when configuration is not correct.
	pedantic bool

	// Tracks environment variable references, to avoid cycles
	envVarReferences map[string]bool
}

// Parse will return a map of keys to any, although concrete types
// underly them. The values supported are string, bool, int64, float64, DateTime.
// Arrays and nested Maps are also supported.
func Parse(data string) (map[string]any, error) {
	p, err := parse(data, "", false)
	if err != nil {
		return nil, err
	}
	return p.mapping, nil
}

// ParseWithChecks is equivalent to Parse but runs in pedantic mode.
func ParseWithChecks(data string) (map[string]any, error) {
	p, err := parse(data, "", true)
	if err != nil {
		return nil, err
	}
	return p.mapping, nil
}

// ParseFile is a helper to open file, etc. and parse the contents.
func ParseFile(fp string) (map[string]any, error) {
	data, err := os.ReadFile(fp)
	if err != nil {
		return nil, fmt.Errorf("error opening config file: %v", err)
	}

	p, err := parse(string(data), fp, false)
	if err != nil {
		return nil, err
	}
	return p.mapping, nil
}

// ParseFileWithChecks is equivalent to ParseFile but runs in pedantic mode.
func ParseFileWithChecks(fp string) (map[string]any, error) {
	data, err := os.ReadFile(fp)
	if err != nil {
		return nil, err
	}

	p, err := parse(string(data), fp, true)
	if err != nil {
		return nil, err
	}

	return p.mapping, nil
}

// configDigest returns a digest for the parsed config.
func configDigest(m map[string]any) (string, error) {
	digest := sha256.New()
	e := json.NewEncoder(digest)
	if err := e.Encode(m); err != nil {
		return _EMPTY_, err
	}
	return fmt.Sprintf("sha256:%x", digest.Sum(nil)), nil
}

// ParseFileWithChecksDigest returns the processed config and a digest
// that represents the configuration.
func ParseFileWithChecksDigest(fp string) (map[string]any, string, error) {
	m, err := ParseFileWithChecks(fp)
	if err != nil {
		return nil, _EMPTY_, err
	}
	digest, err := configDigest(m)
	if err != nil {
		return nil, _EMPTY_, err
	}
	return m, digest, nil
}

type token struct {
	item         item
	value        any
	usedVariable bool
	sourceFile   string
}

func (t *token) MarshalJSON() ([]byte, error) {
	return json.Marshal(t.value)
}

func (t *token) Value() any {
	return t.value
}

func (t *token) Line() int {
	return t.item.line
}

func (t *token) IsUsedVariable() bool {
	return t.usedVariable
}

func (t *token) SourceFile() string {
	return t.sourceFile
}

func (t *token) Position() int {
	return t.item.pos
}

func newParser(data, fp string, pedantic bool) *parser {
	return &parser{
		mapping:          make(map[string]any),
		lx:               lex(data),
		ctxs:             make([]any, 0, 4),
		keys:             make([]string, 0, 4),
		ikeys:            make([]item, 0, 4),
		fp:               filepath.Dir(fp),
		pedantic:         pedantic,
		envVarReferences: make(map[string]bool),
	}
}

func parse(data, fp string, pedantic bool) (*parser, error) {
	p := newParser(data, fp, pedantic)
	if err := p.parse(fp); err != nil {
		return nil, err
	}
	return p, nil
}

func parseEnv(data string, parent *parser) (*parser, error) {
	p := newParser(data, "", false)
	p.envVarReferences = parent.envVarReferences
	if err := p.parse(""); err != nil {
		return nil, err
	}
	return p, nil
}

func (p *parser) parse(fp string) error {
	p.pushContext(p.mapping)

	var prevItem item
	for {
		it := p.next()
		if it.typ == itemEOF {
			// Here we allow the final character to be a bracket '}'
			// in order to support JSON like configurations.
			if prevItem.typ == itemKey && prevItem.val != mapEndString {
				return fmt.Errorf("config is invalid (%s:%d:%d)", fp, it.line, it.pos)
			}
			break
		}
		prevItem = it
		if err := p.processItem(it, fp); err != nil {
			return err
		}
	}
	return nil
}

func (p *parser) next() item {
	return p.lx.nextItem()
}

func (p *parser) pushContext(ctx any) {
	p.ctxs = append(p.ctxs, ctx)
	p.ctx = ctx
}

func (p *parser) popContext() any {
	if len(p.ctxs) == 0 {
		panic("BUG in parser, context stack empty")
	}
	li := len(p.ctxs) - 1
	last := p.ctxs[li]
	p.ctxs = p.ctxs[0:li]
	p.ctx = p.ctxs[len(p.ctxs)-1]
	return last
}

func (p *parser) pushKey(key string) {
	p.keys = append(p.keys, key)
}

func (p *parser) popKey() string {
	if len(p.keys) == 0 {
		panic("BUG in parser, keys stack empty")
	}
	li := len(p.keys) - 1
	last := p.keys[li]
	p.keys = p.keys[0:li]
	return last
}

func (p *parser) pushItemKey(key item) {
	p.ikeys = append(p.ikeys, key)
}

func (p *parser) popItemKey() item {
	if len(p.ikeys) == 0 {
		panic("BUG in parser, item keys stack empty")
	}
	li := len(p.ikeys) - 1
	last := p.ikeys[li]
	p.ikeys = p.ikeys[0:li]
	return last
}

func (p *parser) processItem(it item, fp string) error {
	setValue := func(it item, v any) {
		if p.pedantic {
			p.setValue(&token{it, v, false, fp})
		} else {
			p.setValue(v)
		}
	}

	switch it.typ {
	case itemError:
		return fmt.Errorf("Parse error on line %d: '%s'", it.line, it.val)
	case itemKey:
		// Keep track of the keys as items and strings,
		// we do this in order to be able to still support
		// includes without many breaking changes.
		p.pushKey(it.val)

		if p.pedantic {
			p.pushItemKey(it)
		}
	case itemMapStart:
		newCtx := make(map[string]any)
		p.pushContext(newCtx)
	case itemMapEnd:
		setValue(it, p.popContext())
	case itemString:
		// FIXME(dlc) sanitize string?
		setValue(it, it.val)
	case itemInteger:
		lastDigit := 0
		for _, r := range it.val {
			if !unicode.IsDigit(r) && r != '-' {
				break
			}
			lastDigit++
		}
		numStr := it.val[:lastDigit]
		num, err := strconv.ParseInt(numStr, 10, 64)
		if err != nil {
			if e, ok := err.(*strconv.NumError); ok &&
				e.Err == strconv.ErrRange {
				return fmt.Errorf("integer '%s' is out of the range", it.val)
			}
			return fmt.Errorf("expected integer, but got '%s'", it.val)
		}
		// Process a suffix
		suffix := strings.ToLower(strings.TrimSpace(it.val[lastDigit:]))

		switch suffix {
		case "":
			setValue(it, num)
		case "k":
			setValue(it, num*1000)
		case "kb", "ki", "kib":
			setValue(it, num*1024)
		case "m":
			setValue(it, num*1000*1000)
		case "mb", "mi", "mib":
			setValue(it, num*1024*1024)
		case "g":
			setValue(it, num*1000*1000*1000)
		case "gb", "gi", "gib":
			setValue(it, num*1024*1024*1024)
		case "t":
			setValue(it, num*1000*1000*1000*1000)
		case "tb", "ti", "tib":
			setValue(it, num*1024*1024*1024*1024)
		case "p":
			setValue(it, num*1000*1000*1000*1000*1000)
		case "pb", "pi", "pib":
			setValue(it, num*1024*1024*1024*1024*1024)
		case "e":
			setValue(it, num*1000*1000*1000*1000*1000*1000)
		case "eb", "ei", "eib":
			setValue(it, num*1024*1024*1024*1024*1024*1024)
		}
	case itemFloat:
		num, err := strconv.ParseFloat(it.val, 64)
		if err != nil {
			if e, ok := err.(*strconv.NumError); ok &&
				e.Err == strconv.ErrRange {
				return fmt.Errorf("float '%s' is out of the range", it.val)
			}
			return fmt.Errorf("expected float, but got '%s'", it.val)
		}
		setValue(it, num)
	case itemBool:
		switch strings.ToLower(it.val) {
		case "true", "yes", "on":
			setValue(it, true)
		case "false", "no", "off":
			setValue(it, false)
		default:
			return fmt.Errorf("expected boolean value, but got '%s'", it.val)
		}

	case itemDatetime:
		dt, err := time.Parse("2006-01-02T15:04:05Z", it.val)
		if err != nil {
			return fmt.Errorf(
				"expected Zulu formatted DateTime, but got '%s'", it.val)
		}
		setValue(it, dt)
	case itemArrayStart:
		var array = make([]any, 0)
		p.pushContext(array)
	case itemArrayEnd:
		array := p.ctx
		p.popContext()
		setValue(it, array)
	case itemVariable:
		value, found, err := p.lookupVariable(it.val)
		if err != nil {
			return fmt.Errorf("variable reference for '%s' on line %d could not be parsed: %s",
				it.val, it.line, err)
		}
		if !found {
			return fmt.Errorf("variable reference for '%s' on line %d can not be found",
				it.val, it.line)
		}

		if p.pedantic {
			switch tk := value.(type) {
			case *token:
				// Mark the looked up variable as used, and make
				// the variable reference become handled as a token.
				tk.usedVariable = true
				p.setValue(&token{it, tk.Value(), false, fp})
			default:
				// Special case to add position context to bcrypt references.
				p.setValue(&token{it, value, false, fp})
			}
		} else {
			
```

### Core Architecture Module: `internal/antithesis/noop.go`
```
// Copyright 2022-2024 The NATS Authors
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

// This file is used iff the `enable_antithesis_sdk` build tag is not present
//go:build !enable_antithesis_sdk

package antithesis

import (
	"testing"
)

// AssertUnreachable this implementation is a NOOP
func AssertUnreachable(_ testing.TB, _ string, _ map[string]any) {}

// Assert this implementation is a NOOP
func Assert(_ testing.TB, _ bool, _ string, _ map[string]any) {}

```

### Core Architecture Module: `internal/ldap/dn.go`
```
// Copyright (c) 2011-2015 Michael Mitton (mmitton@gmail.com)
// Portions copyright (c) 2015-2016 go-ldap Authors
package ldap

import (
	"bytes"
	"crypto/x509/pkix"
	"encoding/asn1"
	enchex "encoding/hex"
	"errors"
	"fmt"
	"strings"
)

var attributeTypeNames = map[string]string{
	"2.5.4.3":  "CN",
	"2.5.4.5":  "SERIALNUMBER",
	"2.5.4.6":  "C",
	"2.5.4.7":  "L",
	"2.5.4.8":  "ST",
	"2.5.4.9":  "STREET",
	"2.5.4.10": "O",
	"2.5.4.11": "OU",
	"2.5.4.17": "POSTALCODE",
	// FIXME: Add others.
	"0.9.2342.19200300.100.1.25": "DC",
}

// AttributeTypeAndValue represents an attributeTypeAndValue from https://tools.ietf.org/html/rfc4514
type AttributeTypeAndValue struct {
	// Type is the attribute type
	Type string
	// Value is the attribute value
	Value string
}

// RelativeDN represents a relativeDistinguishedName from https://tools.ietf.org/html/rfc4514
type RelativeDN struct {
	Attributes []*AttributeTypeAndValue
}

// DN represents a distinguishedName from https://tools.ietf.org/html/rfc4514
type DN struct {
	RDNs []*RelativeDN
}

// FromCertSubject takes a pkix.Name from a cert and returns a DN
// that uses the same set.  Does not support multi value RDNs.
func FromCertSubject(subject pkix.Name) (*DN, error) {
	dn := &DN{
		RDNs: make([]*RelativeDN, 0),
	}
	for i := len(subject.Names) - 1; i >= 0; i-- {
		name := subject.Names[i]
		oidString := name.Type.String()
		typeName, ok := attributeTypeNames[oidString]
		if !ok {
			return nil, fmt.Errorf("invalid type name: %+v", name)
		}
		v, ok := name.Value.(string)
		if !ok {
			return nil, fmt.Errorf("invalid type value: %+v", v)
		}
		rdn := &RelativeDN{
			Attributes: []*AttributeTypeAndValue{
				{
					Type:  typeName,
					Value: v,
				},
			},
		}
		dn.RDNs = append(dn.RDNs, rdn)
	}
	return dn, nil
}

// FromRawCertSubject takes a raw subject from a certificate
// and uses asn1.Unmarshal to get the individual RDNs in the
// original order, including multi-value RDNs.
func FromRawCertSubject(rawSubject []byte) (*DN, error) {
	dn := &DN{
		RDNs: make([]*RelativeDN, 0),
	}
	var rdns pkix.RDNSequence
	_, err := asn1.Unmarshal(rawSubject, &rdns)
	if err != nil {
		return nil, err
	}

	for i := len(rdns) - 1; i >= 0; i-- {
		rdn := rdns[i]
		if len(rdn) == 0 {
			continue
		}

		r := &RelativeDN{}
		attrs := make([]*AttributeTypeAndValue, 0)
		for j := len(rdn) - 1; j >= 0; j-- {
			atv := rdn[j]

			typeName := ""
			name := atv.Type.String()
			typeName, ok := attributeTypeNames[name]
			if !ok {
				return nil, fmt.Errorf("invalid type name: %+v", name)
			}
			value, ok := atv.Value.(string)
			if !ok {
				return nil, fmt.Errorf("invalid type value: %+v", atv.Value)
			}
			attr := &AttributeTypeAndValue{
				Type:  typeName,
				Value: value,
			}
			attrs = append(attrs, attr)
		}
		r.Attributes = attrs
		dn.RDNs = append(dn.RDNs, r)
	}

	return dn, nil
}

// ParseDN returns a distinguishedName or an error.
// The function respects https://tools.ietf.org/html/rfc4514
func ParseDN(str string) (*DN, error) {
	dn := new(DN)
	dn.RDNs = make([]*RelativeDN, 0)
	rdn := new(RelativeDN)
	rdn.Attributes = make([]*AttributeTypeAndValue, 0)
	buffer := bytes.Buffer{}
	attribute := new(AttributeTypeAndValue)
	escaping := false

	unescapedTrailingSpaces := 0
	stringFromBuffer := func() string {
		s := buffer.String()
		s = s[0 : len(s)-unescapedTrailingSpaces]
		buffer.Reset()
		unescapedTrailingSpaces = 0
		return s
	}

	for i := 0; i < len(str); i++ {
		char := str[i]
		switch {
		case escaping:
			unescapedTrailingSpaces = 0
			escaping = false
			switch char {
			case ' ', '"', '#', '+', ',', ';', '<', '=', '>', '\\':
				buffer.WriteByte(char)
				continue
			}
			// Not a special character, assume hex encoded octet
			if len(str) == i+1 {
				return nil, errors.New("got corrupted escaped character")
			}

			dst := []byte{0}
			n, err := enchex.Decode([]byte(dst), []byte(str[i:i+2]))
			if err != nil {
				return nil, fmt.Errorf("failed to decode escaped character: %s", err)
			} else if n != 1 {
				return nil, fmt.Errorf("expected 1 byte when un-escaping, got %d", n)
			}
			buffer.WriteByte(dst[0])
			i++
		case char == '\\':
			unescapedTrailingSpaces = 0
			escaping = true
		case char == '=':
			attribute.Type = stringFromBuffer()
			// Special case: If the first character in the value is # the following data
			// is BER encoded. Throw an error since not supported right now.
			if len(str) > i+1 && str[i+1] == '#' {
				return nil, errors.New("unsupported BER encoding")
			}
		case char == ',' || char == '+':
			// We're done with this RDN or value, push it
			if len(attribute.Type) == 0 {
				return nil, errors.New("incomplete type, value pair")
			}
			attribute.Value = stringFromBuffer()
			rdn.Attributes = append(rdn.Attributes, attribute)
			attribute = new(AttributeTypeAndValue)
			if char == ',' {
				dn.RDNs = append(dn.RDNs, rdn)
				rdn = new(RelativeDN)
				rdn.Attributes = make([]*AttributeTypeAndValue, 0)
			}
		case char == ' ' && buffer.Len() == 0:
			// ignore unescaped leading spaces
			continue
		default:
			if char == ' ' {
				// Track unescaped spaces in case they are trailing and we need to remove them
				unescapedTrailingSpaces++
			} else {
				// Reset if we see a non-space char
				unescapedTrailingSpaces = 0
			}
			buffer.WriteByte(char)
		}
	}
	if buffer.Len() > 0 {
		if len(attribute.Type) == 0 {
			return nil, errors.New("DN ended with incomplete type, value pair")
		}
		attribute.Value = stringFromBuffer()
		rdn.Attributes = append(rdn.Attributes, attribute)
		dn.RDNs = append(dn.RDNs, rdn)
	}
	return dn, nil
}

// Equal returns true if the DNs are equal as defined by rfc4517 4.2.15 (distinguishedNameMatch).
// Returns true if they have the same number of relative distinguished names
// and corresponding relative distinguished names (by position) are the same.
func (d *DN) Equal(other *DN) bool {
	if len(d.RDNs) != len(other.RDNs) {
		return false
	}
	for i := range d.RDNs {
		if !d.RDNs[i].Equal(other.RDNs[i]) {
			return false
		}
	}
	return true
}

// RDNsMatch returns true if the individual RDNs of the DNs
// are the same regardless of ordering.
func (d *DN) RDNsMatch(other *DN) bool {
	if len(d.RDNs) != len(other.RDNs) {
		return false
	}
	matched := make([]bool, len(other.RDNs))
	for _, irdn := range d.RDNs {
		found := false
		for j, ordn := range other.RDNs {
			if !matched[j] && irdn.Equal(ordn) {
				matched[j] = true
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// AncestorOf returns true if the other DN consists of at least one RDN followed by all the RDNs of the current DN.
// "ou=widgets,o=acme.com" is an ancestor of "ou=sprockets,ou=widgets,o=acme.com"
// "ou=widgets,o=acme.com" is not an ancestor of "ou=sprockets,ou=widgets,o=foo.com"
// "ou=widgets,o=acme.com" is not an ancestor of "ou=widgets,o=acme.com"
func (d *DN) AncestorOf(other *DN) bool {
	if len(d.RDNs) >= len(other.RDNs) {
		return false
	}
	// Take the last `len(d.RDNs)` RDNs from the other DN to compare against
	otherRDNs := other.RDNs[len(other.RDNs)-len(d.RDNs):]
	for i := range d.RDNs {
		if !d.RDNs[i].Equal(otherRDNs[i]) {
			return false
		}
	}
	return true
}

// Equal returns true if the RelativeDNs are equal as defined by rfc4517 4.2.15 (distinguishedNameMatch).
// Relative distinguished names are the same if and only if they have the same number of AttributeTypeAndValues
// and each attribute of the first RDN is the same as the attribute of the second RDN with the same attribute type.
// The order of attributes is not significant.
// Case of attribute types is not significant.
func (r *RelativeDN) Equal(other *RelativeDN) bool {
	if len(r.Attributes) != len(other.Attributes) {
		return false
	}
	return r.hasAllAttributes(other.Attributes) && other.hasAllAttributes(r.Attributes)
}

func (r *RelativeDN) hasAllAttributes(attrs []*AttributeTypeAndValue) bool {
	for _, attr := range attrs {
		found := false
		for _, myattr := range r.Attributes {
			if myattr.Equal(attr) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// Equal returns true if the AttributeTypeAndValue is equivalent to the specified AttributeTypeAndValue
// Case of the attribute type is not significant
func (a *AttributeTypeAndValue) Equal(other *AttributeTypeAndValue) bool {
	return strings.EqualFold(a.Type, other.Type) && a.Value == other.Value
}

```

### Core Architecture Module: `internal/ocsp/ocsp.go`
```
// Copyright 2019-2024 The NATS Authors
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

package testhelper

import (
	"crypto"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"golang.org/x/crypto/ocsp"
)

const (
	defaultResponseTTL = 4 * time.Second
	defaultAddress     = "127.0.0.1:8888"
)

func NewOCSPResponderCustomAddress(t *testing.T, issuerCertPEM, issuerKeyPEM string, addr string) *http.Server {
	t.Helper()
	return NewOCSPResponderBase(t, issuerCertPEM, issuerCertPEM, issuerKeyPEM, false, addr, defaultResponseTTL, "")
}

func NewOCSPResponder(t *testing.T, issuerCertPEM, issuerKeyPEM string) *http.Server {
	t.Helper()
	return NewOCSPResponderBase(t, issuerCertPEM, issuerCertPEM, issuerKeyPEM, false, defaultAddress, defaultResponseTTL, "")
}

func NewOCSPResponderDesignatedCustomAddress(t *testing.T, issuerCertPEM, respCertPEM, respKeyPEM string, addr string) *http.Server {
	t.Helper()
	return NewOCSPResponderBase(t, issuerCertPEM, respCertPEM, respKeyPEM, true, addr, defaultResponseTTL, "")
}

func NewOCSPResponderPreferringHTTPMethod(t *testing.T, issuerCertPEM, issuerKeyPEM, method string) *http.Server {
	t.Helper()
	return NewOCSPResponderBase(t, issuerCertPEM, issuerCertPEM, issuerKeyPEM, false, defaultAddress, defaultResponseTTL, method)
}

func NewOCSPResponderCustomTimeout(t *testing.T, issuerCertPEM, issuerKeyPEM string, responseTTL time.Duration) *http.Server {
	t.Helper()
	return NewOCSPResponderBase(t, issuerCertPEM, issuerCertPEM, issuerKeyPEM, false, defaultAddress, responseTTL, "")
}

func NewOCSPResponderBase(t *testing.T, issuerCertPEM, respCertPEM, respKeyPEM string, embed bool, addr string, responseTTL time.Duration, method string) *http.Server {
	t.Helper()
	var mu sync.Mutex
	status := make(map[string]int)

	issuerCert := parseCertPEM(t, issuerCertPEM)
	respCert := parseCertPEM(t, respCertPEM)
	respKey := parseKeyPEM(t, respKeyPEM)

	mux := http.NewServeMux()
	// The "/statuses/" endpoint is for directly setting a key-value pair in
	// the CA's status database.
	mux.HandleFunc("/statuses/", func(rw http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()

		key := r.URL.Path[len("/statuses/"):]
		switch r.Method {
		case "GET":
			mu.Lock()
			n, ok := status[key]
			if !ok {
				n = ocsp.Unknown
			}
			mu.Unlock()

			fmt.Fprintf(rw, "%s %d", key, n)
		case "POST":
			data, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(rw, err.Error(), http.StatusBadRequest)
				return
			}

			n, err := strconv.Atoi(string(data))
			if err != nil {
				http.Error(rw, err.Error(), http.StatusBadRequest)
				return
			}

			mu.Lock()
			status[key] = n
			mu.Unlock()

			fmt.Fprintf(rw, "%s %d", key, n)
		default:
			http.Error(rw, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
	})
	// The "/" endpoint is for normal OCSP requests. This actually parses an
	// OCSP status request and signs a response with a CA. Lightly based off:
	// https://www.ietf.org/rfc/rfc2560.txt
	mux.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
		var reqData []byte
		var err error

		switch {
		case r.Method == "GET":
			if method != "" && r.Method != method {
				http.Error(rw, "", http.StatusBadRequest)
				return
			}
			reqData, err = base64.StdEncoding.DecodeString(r.URL.Path[1:])
		case r.Method == "POST":
			if method != "" && r.Method != method {
				http.Error(rw, "", http.StatusBadRequest)
				return
			}
			reqData, err = io.ReadAll(r.Body)
			r.Body.Close()
		default:
			http.Error(rw, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		if err != nil {
			http.Error(rw, err.Error(), http.StatusBadRequest)
			return
		}

		ocspReq, err := ocsp.ParseRequest(reqData)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusBadRequest)
			return
		}

		mu.Lock()
		n, ok := status[ocspReq.SerialNumber.String()]
		if !ok {
			n = ocsp.Unknown
		}
		mu.Unlock()

		tmpl := ocsp.Response{
			Status:       n,
			SerialNumber: ocspReq.SerialNumber,
			ThisUpdate:   time.Now(),
		}
		if responseTTL != 0 {
			tmpl.NextUpdate = tmpl.ThisUpdate.Add(responseTTL)
		}
		if embed {
			tmpl.Certificate = respCert
		}
		respData, err := ocsp.CreateResponse(issuerCert, respCert, tmpl, respKey)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}

		rw.Header().Set("Content-Type", "application/ocsp-response")
		rw.Header().Set("Content-Length", fmt.Sprint(len(respData)))

		fmt.Fprint(rw, string(respData))
	})

	srv := &http.Server{
		Addr:        addr,
		Handler:     mux,
		ReadTimeout: time.Second * 5,
	}
	go srv.ListenAndServe()
	time.Sleep(1 * time.Second)
	return srv
}

func parseCertPEM(t *testing.T, certPEM string) *x509.Certificate {
	t.Helper()
	block := parsePEM(t, certPEM)

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		t.Fatalf("failed to parse cert '%s': %s", certPEM, err)
	}
	return cert
}

func parseKeyPEM(t *testing.T, keyPEM string) crypto.Signer {
	t.Helper()
	block := parsePEM(t, keyPEM)

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		key, err = x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			t.Fatalf("failed to parse ikey %s: %s", keyPEM, err)
		}
	}
	keyc := key.(crypto.Signer)
	return keyc
}

func parsePEM(t *testing.T, pemPath string) *pem.Block {
	t.Helper()
	data, err := os.ReadFile(pemPath)
	if err != nil {
		t.Fatal(err)
	}

	block, _ := pem.Decode(data)
	if block == nil {
		t.Fatalf("failed to decode PEM %s", pemPath)
	}
	return block
}

func GetOCSPStatus(s tls.ConnectionState) (*ocsp.Response, error) {
	if len(s.VerifiedChains) == 0 {
		return nil, fmt.Errorf("missing TLS verified chains")
	}
	chain := s.VerifiedChains[0]

	if got, want := len(chain), 2; got < want {
		return nil, fmt.Errorf("incomplete cert chain, got %d, want at least %d", got, want)
	}
	leaf, issuer := chain[0], chain[1]

	resp, err := ocsp.ParseResponseForCert(s.OCSPResponse, leaf, issuer)
	if err != nil {
		return nil, fmt.Errorf("failed to parse OCSP response: %w", err)
	}
	if err := resp.CheckSignatureFrom(issuer); err != nil {
		return resp, err
	}
	return resp, nil
}

func SetOCSPStatus(t *testing.T, ocspURL, certPEM string, status int) {
	t.Helper()

	cert := parseCertPEM(t, certPEM)

	hc := &http.Client{Timeout: 10 * time.Second}
	resp, err := hc.Post(
		fmt.Sprintf("%s/statuses/%s", ocspURL, cert.SerialNumber),
		"",
		strings.NewReader(fmt.Sprint(status)),
	)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("failed to read OCSP HTTP response body: %s", err)
	}

	if got, want := resp.Status, "200 OK"; got != want {
		t.Error(strings.TrimSpace(string(data)))
		t.Fatalf("unexpected OCSP HTTP set status, got %q, want %q", got, want)
	}
}

```

### Core Architecture Module: `logger/log.go`
```
// Copyright 2012-2025 The NATS Authors
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

// Package logger provides logging facilities for the NATS server
package logger

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Default file permissions for log files.
const defaultLogPerms = os.FileMode(0640)

// Logger is the server logger
type Logger struct {
	sync.Mutex
	logger     *log.Logger
	debug      bool
	trace      bool
	infoLabel  string
	warnLabel  string
	errorLabel string
	fatalLabel string
	debugLabel string
	traceLabel string
	fl         *fileLogger
}

type LogOption interface {
	isLoggerOption()
}

// LogUTC controls whether timestamps in the log output should be UTC or local time.
type LogUTC bool

func (l LogUTC) isLoggerOption() {}

func logFlags(time bool, opts ...LogOption) int {
	flags := 0
	if time {
		flags = log.LstdFlags | log.Lmicroseconds
	}

	for _, opt := range opts {
		switch v := opt.(type) {
		case LogUTC:
			if time && bool(v) {
				flags |= log.LUTC
			}
		}
	}

	return flags
}

// NewStdLogger creates a logger with output directed to Stderr
func NewStdLogger(time, debug, trace, colors, pid bool, opts ...LogOption) *Logger {
	flags := logFlags(time, opts...)

	pre := ""
	if pid {
		pre = pidPrefix()
	}

	l := &Logger{
		logger: log.New(os.Stderr, pre, flags),
		debug:  debug,
		trace:  trace,
	}

	if colors {
		setColoredLabelFormats(l)
	} else {
		setPlainLabelFormats(l)
	}

	return l
}

// NewFileLogger creates a logger with output directed to a file
func NewFileLogger(filename string, time, debug, trace, pid bool, opts ...LogOption) *Logger {
	flags := logFlags(time, opts...)

	pre := ""
	if pid {
		pre = pidPrefix()
	}

	fl, err := newFileLogger(filename, pre, time)
	if err != nil {
		log.Fatalf("error opening file: %v", err)
		return nil
	}

	l := &Logger{
		logger: log.New(fl, pre, flags),
		debug:  debug,
		trace:  trace,
		fl:     fl,
	}
	fl.Lock()
	fl.l = l
	fl.Unlock()

	setPlainLabelFormats(l)
	return l
}

type writerAndCloser interface {
	Write(b []byte) (int, error)
	Close() error
	Name() string
}

type fileLogger struct {
	out       int64
	canRotate int32
	sync.Mutex
	l           *Logger
	f           writerAndCloser
	limit       int64
	olimit      int64
	pid         string
	time        bool
	closed      bool
	maxNumFiles int
}

func newFileLogger(filename, pidPrefix string, time bool) (*fileLogger, error) {
	fileflags := os.O_WRONLY | os.O_APPEND | os.O_CREATE
	f, err := os.OpenFile(filename, fileflags, defaultLogPerms)
	if err != nil {
		return nil, err
	}
	stats, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	fl := &fileLogger{
		canRotate: 0,
		f:         f,
		out:       stats.Size(),
		pid:       pidPrefix,
		time:      time,
	}
	return fl, nil
}

func (l *fileLogger) setLimit(limit int64) {
	l.Lock()
	l.olimit, l.limit = limit, limit
	atomic.StoreInt32(&l.canRotate, 1)
	rotateNow := l.out > l.limit
	l.Unlock()
	if rotateNow {
		l.l.Noticef("Rotating logfile...")
	}
}

func (l *fileLogger) setMaxNumFiles(max int) {
	l.Lock()
	l.maxNumFiles = max
	l.Unlock()
}

func (l *fileLogger) logDirect(label, format string, v ...any) int {
	var entrya = [256]byte{}
	var entry = entrya[:0]
	if l.pid != "" {
		entry = append(entry, l.pid...)
	}
	if l.time {
		now := time.Now()
		year, month, day := now.Date()
		hour, min, sec := now.Clock()
		microsec := now.Nanosecond() / 1000
		entry = append(entry, fmt.Sprintf("%04d/%02d/%02d %02d:%02d:%02d.%06d ",
			year, month, day, hour, min, sec, microsec)...)
	}
	entry = append(entry, label...)
	entry = append(entry, fmt.Sprintf(format, v...)...)
	entry = append(entry, '\r', '\n')
	l.f.Write(entry)
	return len(entry)
}

func (l *fileLogger) logPurge(fname string) {
	var backups []string
	lDir := filepath.Dir(fname)
	lBase := filepath.Base(fname)
	entries, err := os.ReadDir(lDir)
	if err != nil {
		l.logDirect(l.l.errorLabel, "Unable to read directory %q for log purge (%v), will attempt next rotation", lDir, err)
		return
	}
	for _, entry := range entries {
		if entry.IsDir() || entry.Name() == lBase || !strings.HasPrefix(entry.Name(), lBase) {
			continue
		}
		if stamp, found := strings.CutPrefix(entry.Name(), fmt.Sprintf("%s%s", lBase, ".")); found {
			_, err := time.Parse("2006:01:02:15:04:05.999999999", strings.Replace(stamp, ".", ":", 5))
			if err == nil {
				backups = append(backups, entry.Name())
			}
		}
	}
	currBackups := len(backups)
	maxBackups := l.maxNumFiles - 1
	if currBackups > maxBackups {
		// backups sorted oldest to latest based on timestamped lexical filename (ReadDir)
		for i := 0; i < currBackups-maxBackups; i++ {
			if err := os.Remove(filepath.Join(lDir, string(os.PathSeparator), backups[i])); err != nil {
				l.logDirect(l.l.errorLabel, "Unable to remove backup log file %q (%v), will attempt next rotation", backups[i], err)
				// Bail fast, we'll try again next rotation
				return
			}
			l.logDirect(l.l.infoLabel, "Purged log file %q", backups[i])
		}
	}
}

func (l *fileLogger) Write(b []byte) (int, error) {
	if atomic.LoadInt32(&l.canRotate) == 0 {
		n, err := l.f.Write(b)
		if err == nil {
			atomic.AddInt64(&l.out, int64(n))
		}
		return n, err
	}
	l.Lock()
	n, err := l.f.Write(b)
	if err == nil {
		l.out += int64(n)
		if l.out > l.limit {
			if err := l.f.Close(); err != nil {
				l.limit *= 2
				l.logDirect(l.l.errorLabel, "Unable to close logfile for rotation (%v), will attempt next rotation at size %v", err, l.limit)
				l.Unlock()
				return n, err
			}
			fname := l.f.Name()
			now := time.Now()
			bak := fmt.Sprintf("%s.%04d.%02d.%02d.%02d.%02d.%02d.%09d", fname,
				now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute(),
				now.Second(), now.Nanosecond())
			os.Rename(fname, bak)
			fileflags := os.O_WRONLY | os.O_APPEND | os.O_CREATE
			f, err := os.OpenFile(fname, fileflags, defaultLogPerms)
			if err != nil {
				l.Unlock()
				panic(fmt.Sprintf("Unable to re-open the logfile %q after rotation: %v", fname, err))
			}
			l.f = f
			n := l.logDirect(l.l.infoLabel, "Rotated log, backup saved as %q", bak)
			l.out = int64(n)
			l.limit = l.olimit
			if l.maxNumFiles > 0 {
				l.logPurge(fname)
			}
		}
	}
	l.Unlock()
	return n, err
}

func (l *fileLogger) close() error {
	l.Lock()
	if l.closed {
		l.Unlock()
		return nil
	}
	l.closed = true
	l.Unlock()
	return l.f.Close()
}

// SetSizeLimit sets the size of a logfile after which a backup
// is created with the file name + "year.month.day.hour.min.sec.nanosec"
// and the current log is truncated.
func (l *Logger) SetSizeLimit(limit int64) error {
	l.Lock()
	if l.fl == nil {
		l.Unlock()
		return fmt.Errorf("can set log size limit only for file logger")
	}
	fl := l.fl
	l.Unlock()
	fl.setLimit(limit)
	return nil
}

// SetMaxNumFiles sets the number of archived log files that will be retained
func (l *Logger) SetMaxNumFiles(max int) error {
	l.Lock()
	if l.fl == nil {
		l.Unlock()
		return fmt.Errorf("can set log max number of files only for file logger")
	}
	fl := l.fl
	l.Unlock()
	fl.setMaxNumFiles(max)
	return nil
}

// NewTestLogger creates a logger with output directed to Stderr with a prefix.
// Useful for tracing in tests when multiple servers are in the same pid
func NewTestLogger(prefix string, time bool) *Logger {
	flags := 0
	if time {
		flags = log.LstdFlags | log.Lmicroseconds
	}
	l := &Logger{
		logger: log.New(os.Stderr, prefix, flags),
		debug:  true,
		trace:  true,
	}
	setColoredLabelFormats(l)
	return l
}

// Close implements the io.Closer interface to clean up
// resources in the server's logger implementation.
// Caller must ensure threadsafety.
func (l *Logger) Close() error {
	if l.fl != nil {
		return l.fl.close()
	}
	return nil
}

// Generate the pid prefix string
func pidPrefix() string {
	return fmt.Sprintf("[%d] ", os.Getpid())
}

func setPlainLabelFormats(l *Logger) {
	l.infoLabel = "[INF] "
	l.debugLabel = "[DBG] "
	l.warnLabel = "[WRN] "
	l.errorLabel = "[ERR] "
	l.fatalLabel = "[FTL] "
	l.traceLabel = "[TRC] "
}

func setColoredLabelFormats(l *Logger) {
	colorFormat := "[\x1b[%sm%s\x1b[0m] "
	l.infoLabel = fmt.Sprintf(colorFormat, "32", "INF")
	l.debugLabel = fmt.Sprintf(colorFormat, "36", "DBG")
	l.warnLabel = fmt.Sprintf(colorFormat, "0;93", "WRN")
	l.errorLabel = fmt.Sprintf(colorFormat, "31", "ERR")
	l.fatalLabel = fmt.Sprintf(colorFormat, "31", "FTL")
	l.traceLabel = fmt.Sprintf(colorFormat, "33", "TRC")
}

// Noticef logs a notice statement
func (l *Logger) Noticef(format string, v ...any) {
	l.logger.Printf(l.infoLabel+format, v...)
}

// Warnf logs a notice statement
func (l *Logger) Warnf(format string, v ...any) {
	l.logger.Printf(l.warnLabel+format, v...)
}

// Errorf logs an error statement
func (l *Logger) Errorf(format string, v ...any) {
	l.logger.Printf(l.errorLabel+format, v...)
}

// Fatalf logs a fatal error
func (l *Logger) Fatalf(format string, v ...any) {
	l.logger.Fatalf(l.fatalLabel+format, v...)
}

// Debugf logs a debug statement
func (l *Logger) Debugf(format string, v ...any) {
	if l.debug {
		l.logger.Printf(l.debugLabel+format, v...)
	}
}

// Tracef logs a trace statement
func (l *Logger) Tracef(format string, v ...any) {
	if l.trace {
		l.logger.Printf(l.traceLabel+format, v...)
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6558** (2026-09-02): **Fix the MOVE and CANCEL behaviours on Assets**
  *Symptoms*: ### Proposed change  There are several consistency and behaviour issues with moving assets:   * It's quite brittle and bandwidth expensive  * If it fails or get cancelled the stream might end up with the incorrect configuration - tags that does not reflect where the stream actually runs  * The cancel API is poorly implemented and does not respond with useful data   * The cancel API is not in the user account  There are some back story in https://github.com/nats-io/natscli/issues/724#issuecomment-1968986511  Dereks suggest we might pick 1 node in the target tag/cluster and bring it up to current, then make that the leader and only then expand the replicas in the target location so they sync from the leader that is then in their cluster.  This would greatly improve the performance and cost of super cluster moves.  This might be a bug fix in 2.11.x  ### Use case  We want to build tooling that proactively balances clusters using moves and cancels, users need to be able to do so manually without fear.  ### Contribution  _No response_

- **Issue #4707** (2023-10-30): **Different behavior between single node and clustered nats-servers regarding 'DeliverLastPerSubjectPolicy' with multiple subjects.**
  *Symptoms*: ### Observed behavior  We have go code that runs an ordered consumer with two subjects and the 'DeliverLastPerSubjectPolicy'. It works great using a nats-server 2.10.3 as single node. But if we use the same code on the three nodes cluster, we get a strange error.  I checked out 'nats.go' and added a line to debug what is sent to nats-server. See image for reference:  <img width="1285" alt="image" src="https://github.com/nats-io/nats-server/assets/719156/a90fb3b2-b3b7-4712-997c-976e82953e8b">  This is the local server, single-server with no auth setup:  ``` "$JS.API.CONSUMER.CREATE.kcl-orderlist.faQrdj1mbBnQdTMzO7DpLJ_1" / {"stream_name":"kcl-orderlist","config":{"name":"faQrdj1mbBnQdTMzO7DpLJ_1","deliver_policy":"last_per_subject","ack_policy":"none","replay_policy":"instant","inactive_threshold":300000000000,"num_replicas":1,"mem_storage":true,"filter_subjects":["kcl.v1.orderlist.*.*.*.*.data","kcl.v1.orderlist.*.*.info"]},"action":""} / (*jetstream.APIError)(nil) ```  This is the same code against our 3 node cluster running with an admin user (full access) on the:  ``` "$JS.API.CONSUMER.CREATE.kcl-orderlist.b0bjYmCvgD8ZONdSKx3CuF_1" / {"stream_name":"kcl-orderlist","config":{"name":"b0bjYmCvgD8ZONdSKx3CuF_1","deliver_policy":"last_per_subject","ack_policy":"none","replay_policy":"instant","inactive_threshold":300000000000,"num_replicas":1,"mem_storage":true,"filter_subjects":["kcl.v1.orderlist.*.*.*.*.data","kcl.v1.orderlist.*.*.info"]},"action":""} / &jets

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

### Incident Patch 1: `6e102223` (2026-10-28)
**Commit Message**: [FIXED] Durable mirror/source skipping messages after a consumer reset (#8802)

Flow-controlled push consumers deliver messages before replicating their
delivered state, so after a consumer leader change stale deliveries can
still arrive. After a reset the consumer's delivery sequence restarts at
1, so stale deliveries from before the reset could take the place of new
deliveries with the same numbers. A source would then drop those new
messages as duplicates, and a mirror would mark them as deleted if they
got lost.

Resolves https://github.com/nats-io/nats-server/issues/8796

**File**: `server/consumer.go` (modified, +22/-4)
```diff
@@ -3557,6 +3557,18 @@ func (o *consumer) info() *ConsumerInfo {
 	return o.infoWithSnap(false)
 }
 
+// resetInfo returns the consumer info for a reset to the given starting sequence.
+// Delivery resumes before the info is gathered, so report the reset point itself.
+func (o *consumer) resetInfo(seq uint64) *ConsumerInfo {
+	info := o.info()
+	if info == nil {
+		return nil
+	}
+	info.Delivered.Consumer, info.Delivered.Stream = 0, seq-1
+	info.AckFloor.Consumer, info.AckFloor.Stream = 0, seq-1
+	return info
+}
+
 func (o *consumer) infoWithSnap(snap bool) *ConsumerInfo {
 	return o.infoWithSnapAndReply(snap, _EMPTY_)
 }
@@ -4690,7 +4702,7 @@ func (o *consumer) processResetReq(_ *subscription, c *client, a *Account, _, re
 		resp.Error = NewJSConsumerInvalidResetError(err)
 		s.sendInternalAccountMsg(a, reply, s.jsonResponse(&resp))
 	} else if canRespond {
-		if resp.ConsumerInfo = setDynamicConsumerInfoMetadata(o.info()); resp.ConsumerInfo == nil {
+		if resp.ConsumerInfo = setDynamicConsumerInfoMetadata(o.resetInfo(resetSeq)); resp.ConsumerInfo == nil {
 			// The consumer was closed before we could respond.
 			resp.Error = NewJSConsumerInvalidResetError(errConsumerClosed)
 			s.sendInternalAccountMsg(a, reply, s.jsonResponse(&resp))
@@ -5025,6 +5037,7 @@ func (o *consumer) isFilterSubsetOf(subj string) bool {
 
 var (
 	errMaxAckPending = errors.New("max ack pending reached")
+	errResetPending  = errors.New("reset pending")
 	errBadConsumer   = errors.New("consumer not valid")
 	errNoInterest    = errors.New("consumer requires interest for delivery subject when ephemeral")
 )
@@ -5036,6 +5049,11 @@ func (o *consumer) getNextMsg() (*jsPubMsg, uint64, error) {
 	if o.mset == nil || o.mset.store == nil {
 		return nil, 0, errBadConsumer
 	}
+	// Deliveries proposed before a reset applies would mix into the delivered state after it.
+	// Only our own resets are tracked, these always have a reply when replicated.
+	if len(o.rsm) > 0 {
+		return nil, 0, errResetPending
+	}
 	// Process redelivered messages before looking at possibly "skip list" (deliver last per subject)
 	if o.hasRedeliveries() {
 		var seq, dc uint64
@@ -5549,7 +5567,7 @@ func (o *consumer) loopAndGatherMsgs(qch chan struct{}) {
 			if err == ErrStoreEOF {
 				o.checkNumPendingOnEOF()
 			}
-			if err == ErrStoreMsgNotFound || err == errDeletedMsg || err == ErrStoreEOF || err == errMaxAckPending {
+			if err == ErrStoreMsgNotFound || err == errDeletedMsg || err == ErrStoreEOF || err == errMaxAckPending || err == errResetPending {
 				goto waitForMsgs
 			} else {
 				if pmsg != nil {
@@ -5682,8 +5700,8 @@ func (o *consumer) loopAndGatherMsgs(qch chan struct{}) {
 		// Make sure to process any expired requests that are pending.
 		var wrExp <-chan time.Time
 		if o.isPullMode() {
-			// Dont expire oneshots if we are here because of max ack pending limit.
-			_, _, _, fexp := o.processWaiting(err != errMaxAckPending)
+			// Dont expire oneshots if we are here because of max ack pending limit or a pending reset.
+			_, _, _, fexp := o.processWaiting(err != errMaxAckPending && err != errResetPending)
 			if !fexp.IsZero() {
 				expires := time.Until(fexp)
 				if expires <= 0 {
```

**File**: `server/jetstream_cluster.go` (modified, +3/-3)
```diff
@@ -7918,7 +7918,7 @@ func (js *jetStream) processClusterCreateConsumer(oca, ca *consumerAssignment, s
 								resp.Error = NewJSConsumerInvalidResetError(err)
 								s.sendAPIErrResponse(client, acc, subject, reply, _EMPTY_, s.jsonResponse(&resp))
 							} else if canRespond {
-								if resp.ConsumerInfo = setDynamicConsumerInfoMetadata(o.info()); resp.ConsumerInfo == nil {
+								if resp.ConsumerInfo = setDynamicConsumerInfoMetadata(o.resetInfo(resetSeq)); resp.ConsumerInfo == nil {
 									// The consumer was closed before we could respond.
 									resp.Error = NewJSConsumerInvalidResetError(errConsumerClosed)
 									s.sendAPIErrResponse(client, acc, subject, reply, _EMPTY_, s.jsonResponse(&resp))
@@ -8915,7 +8915,7 @@ func (js *jetStream) applyConsumerMsgOp(o *consumer, buf []byte) error {
 					a = nil
 				}
 				var resp = JSApiConsumerResetResponse{ApiResponse: ApiResponse{Type: JSApiConsumerResetResponseType}}
-				if resp.ConsumerInfo = setDynamicConsumerInfoMetadata(o.info()); resp.ConsumerInfo == nil {
+				if resp.ConsumerInfo = setDynamicConsumerInfoMetadata(o.resetInfo(sseq)); resp.ConsumerInfo == nil {
 					// The consumer was closed before we could respond.
 					resp.Error = NewJSConsumerInvalidResetError(errConsumerClosed)
 					s.sendInternalAccountMsg(a, reply, s.jsonResponse(&resp))
@@ -9148,7 +9148,7 @@ func (js *jetStream) processConsumerLeaderChangeWithAssignment(o *consumer, ca *
 				rresp.Error = NewJSConsumerInvalidResetError(err)
 				s.sendAPIErrResponse(client, acc, subject, reply, _EMPTY_, s.jsonResponse(&rresp))
 			} else if canRespond {
-				if rresp.ConsumerInfo = setDynamicConsumerInfoMetadata(o.info()); rresp.ConsumerInfo == nil {
+				if rresp.ConsumerInfo = setDynamicConsumerInfoMetadata(o.resetInfo(resetSeq)); rresp.ConsumerInfo == nil {
 					// The consumer was closed before we could respond.
 					rresp.Error = NewJSConsumerInvalidResetError(errConsumerClosed)
 					s.sendAPIErrResponse(client, acc, subject, reply, _EMPTY_, s.jsonResponse(&rresp))
```

**File**: `server/jetstream_consumer_test.go` (modified, +177/-0)
```diff
@@ -14029,3 +14029,180 @@ func TestJetStreamConsumerEphemeralPullDefaultInactiveThresholdAfterRestart(t *t
 		return nil
 	})
 }
+
+func TestJetStreamConsumerResetResponseReportsResetSeq(t *testing.T) {
+	test := func(t *testing.T, replicas int) {
+		c := createJetStreamClusterExplicit(t, "R3S", 3)
+		defer c.shutdown()
+
+		nc := clientConnectToServer(t, c.randomServer())
+		defer nc.Close()
+
+		_, err := jsStreamCreate(t, nc, &StreamConfig{
+			Name:     "TEST",
+			Subjects: []string{"foo"},
+			Replicas: replicas,
+			Storage:  FileStorage,
+		})
+		require_NoError(t, err)
+		for range 200 {
+			_, err = nc.Request("foo", nil, time.Second)
+			require_NoError(t, err)
+		}
+
+		// Answer flow control so the consumer keeps delivering.
+		sub, err := nc.Subscribe("deliver", func(m *nats.Msg) {
+			if m.Reply != _EMPTY_ {
+				m.Respond(nil)
+			}
+		})
+		require_NoError(t, err)
+		defer sub.Unsubscribe()
+
+		_, err = jsConsumerCreate(t, nc, "TEST", ConsumerConfig{
+			Durable:        "CONSUMER",
+			DeliverSubject: "deliver",
+			AckPolicy:      AckFlowControl,
+			Replicas:       replicas,
+		}, false)
+		require_NoError(t, err)
+		c.waitOnConsumerLeader(globalAccountName, "TEST", "CONSUMER")
+
+		// Delivery resumes right after the reset, the response must still report the reset point.
+		for range 500 {
+			msg, err := nc.Request(fmt.Sprintf(JSApiConsumerResetT, "TEST", "CONSUMER"), nil, 2*time.Second)
+			require_NoError(t, err)
+			var resp JSApiConsumerResetResponse
+			require_NoError(t, json.Unmarshal(msg.Data, &resp))
+			require_True(t, resp.Error == nil)
+			require_Equal(t, resp.Delivered.Stream, resp.ResetSeq-1)
+			require_Equal(t, resp.AckFloor.Stream, resp.ResetSeq-1)
+		}
+	}
+
+	for _, replicas := range []int{1, 3} {
+		t.Run(fmt.Sprintf("R%d", replicas), func(t *testing.T) { test(t, replicas) })
+	}
+}
+
+func TestJetStreamConsumerResetPendingHoldsDeliveries(t *testing.T) {
+	c := createJetStreamClusterExplicit(t, "R3S", 3)
+	defer c.shutdown()
+
+	nc := clientConnectToServer(t, c.randomServer())
+	defer nc.Close()
+
+	_, err := jsStreamCreate(t, nc, &StreamConfig{
+		Name:     "TEST",
+		Subjects: []string{"foo"},
+		Replicas: 3,
+		Storage:  FileStorage,
+	})
+	require_NoError(t, err)
+	for range 30 {
+		_, err = nc.Request("foo", nil, time.Second)
+		require_NoError(t, err)
+	}
+
+	// No interest on the deliver subject, so we drive deliveries ourselves.
+	_, err = jsConsumerCreate(t, nc, "TEST", ConsumerConfig{
+		Durable:        "CONSUMER",
+		DeliverSubject: "deliver",
+		AckPolicy:      AckFlowControl,
+		Replicas:       3,
+	}, false)
+	require_NoError(t, err)
+	c.waitOnConsumerLeader(globalAccountName, "TEST", "CONSUMER")
+
+	lookupConsumer := func() *consumer {
+		t.Helper()
+		cl := c.consumerLeader(globalAccountName, "TEST", "CONSUMER")
+		require_NotNil(t, cl)
+		mset, err := cl.globalAccount().lookupStream("TEST")
+		require_NoError(t, err)
+		o := mset.lookupConsumer("CONSUMER")
+		require_NotNil(t, o)
+		return o
+	}
+	o := lookupConsumer()
+
+	// Same as loopAndGatherMsgs, lock should be held.
+	deliverNext := func() error {
+		pmsg, dc, err := o.getNextMsg()
+		if err != nil {
+			return err
+		}
+		o.deliverMsg(o.cfg.DeliverSubject, o.ackReply(pmsg.seq, o.dseq, dc, pmsg.ts, o.numPending()), pmsg, dc, LimitsPolicy)
+		return nil
+	}
+	reset := func(seq uint64) {
+		t.Helper()
+		o.mu.Lock()
+		_, _, err := o.resetStartingSeqLocked(seq, _EMPTY_, false, false)
+		o.mu.Unlock()
+		require_NoError(t, err)
+		checkFor(t, 2*time.Second, 50*time.Millisecond, func() error {
+			o.mu.RLock()
+			defer o.mu.RUnlock()
+			if o.dseq != 1 || o.sseq != seq {
+				return fmt.Errorf("reset not applied yet: dseq=%d sseq=%d", o.dseq, o.sseq)
+			}
+			return nil
+		})
+	}
+	deliver := func(n int) {
+		t.Helper()
+		o.mu.Lock()
+		defer o.mu.Unlock()
+		for range n {
+			require_NoError(t, deliverNext())
+		}
+	}
+
+	// Deliver d1..d5 = s15..s19.
+	reset(15)
+	deliver(5)
+
+	// Reset back to s11, nothing must be delivered until it's applied.
+	// Otherwise d6 = s20 is applied after the reset and mixes into the delivered state.
+	o.mu.Lock()
+	_, _, err = o.resetStartingSeqLocked(11, "reply", false, false)
+	if err == nil {
+		err = deliverNext()
+	}
+	o.mu.Unlock()
+	require_Error(t, err, errResetPending)
+
+	// Deliver d1..d8 = s11..s18.
+	reset(11)
+	deliver(8)
+	checkFor(t, 2*time.Second, 50*time.Millisecond, func() error {
+		for _, s := range c.servers {
+			mset, err := s.globalAccount().lookupStream("TEST")
+			if err != nil {
+				return err
+			}
+			state, err := mset.lookupConsumer("CONSUMER").store.State()
+			if err != nil {
+				return err
+			}
+			if state.Delivered.Consumer != 8 || state.Delivered.Stream != 18 {
+				return fmt.Errorf("%s: unexpected delivered state %+v", s, state.Delivered)
+			}
+		}
+		return nil
+	})
+
+	// A new leader must continue at d9 = s19.
+	o.mu.RLock()
+	node := o.node
+	o.mu.RUnlock()
+	require_NoError(t, node.StepDown())
+	c.waitOnConsume
```

**File**: `server/jetstream_test.go` (modified, +77/-0)
```diff
@@ -25608,6 +25608,83 @@ func TestJetStreamDurableStreamMirrorAndSourceIncorrectConsumerConfig(t *testing
 	require_Error(t, err, NewJSSourceDurableConsumerCfgInvalidError())
 }
 
+// https://github.com/nats-io/nats-server/issues/8796
+func TestJetStreamDurableStreamSourcingStaleDeliveryAfterReset(t *testing.T) {
+	test := func(t *testing.T, source bool) {
+		s := RunBasicJetStreamServer(t)
+		defer s.Shutdown()
+
+		nc, _ := jsClientConnect(t, s)
+		defer nc.Close()
+
+		_, err := jsStreamCreate(t, nc, &StreamConfig{Name: "O", Subjects: []string{"foo"}, Storage: FileStorage})
+		require_NoError(t, err)
+		// Starts at s2, so the reset when setting up goes back to the ack floor at s1.
+		// Deliveries go elsewhere, we hand them to the mirror or source ourselves.
+		_, err = jsConsumerCreate(t, nc, "O", ConsumerConfig{
+			Durable:        "C",
+			DeliverSubject: "orig",
+			AckPolicy:      AckFlowControl,
+			DeliverPolicy:  DeliverByStartSequence,
+			OptStartSeq:    2,
+		}, false)
+		require_NoError(t, err)
+
+		ssi := &StreamSource{Name: "O", Consumer: &StreamConsumerSource{Name: "C", DeliverSubject: "dlv"}}
+		cfg := &StreamConfig{Name: "M", Storage: FileStorage}
+		if source {
+			cfg.Sources = []*StreamSource{ssi}
+		} else {
+			cfg.Mirror = ssi
+		}
+		_, err = jsStreamCreate(t, nc, cfg)
+		require_NoError(t, err)
+		mset, err := s.globalAccount().lookupStream("M")
+		require_NoError(t, err)
+
+		var si *sourceInfo
+		checkFor(t, 2*time.Second, 50*time.Millisecond, func() error {
+			mset.mu.RLock()
+			defer mset.mu.RUnlock()
+			if si = mset.mirror; source {
+				for _, si = range mset.sources {
+				}
+			}
+			if si == nil || si.sub == nil {
+				return errors.New("consumer not set up yet")
+			}
+			return nil
+		})
+		deliver := func(dseq, sseq uint64) {
+			m := &inMsg{subj: "foo", rply: fmt.Sprintf("$JS.ACK.O.C.1.%d.%d.0.0", sseq, dseq), msg: []byte("x")}
+			if source {
+				mset.processInboundSourceMsg(si, m)
+			} else {
+				mset.processInboundMirrorMsg(m)
+			}
+		}
+
+		// A stale d1 = s1 from before the reset arrives first.
+		deliver(1, 1)
+		// A source would drop d1 = s2 by itself, a mirror only skips s2 if it's lost.
+		if source {
+			deliver(1, 2)
+		}
+		deliver(2, 3)
+
+		// The origin never deleted s2, so s3 must not be stored without it.
+		state := mset.state()
+		if source {
+			require_Equal(t, state.Msgs, 2)
+		} else {
+			require_Equal(t, state.LastSeq, 1)
+		}
+	}
+
+	t.Run("Mirror", func(t *testing.T) { test(t, false) })
+	t.Run("Source", func(t *testing.T) { test(t, true) })
+}
+
 func TestJetStreamDurableStreamSourcesWithUniqueConsumerNames(t *testing.T) {
 	s := RunBasicJetStreamServer(t)
 	defer s.Shutdown()
```

**File**: `server/stream.go` (modified, +23/-17)
```diff
@@ -712,6 +712,7 @@ type sourceInfo struct {
 	msgs  *ipQueue[*inMsg]    // Intra-process queue for incoming messages.
 	sseq  uint64              // Last stream message sequence number seen from the source.
 	dseq  uint64              // Last delivery (i.e. consumer's) sequence number.
+	cseq  uint64              // Stream message sequence number of the last delivery counted towards dseq.
 	lag   uint64              // 0 or number of messages pending (as last reported by the consumer) - 1.
 	err   *ApiError           // The API error that caused the last consumer setup to fail.
 	fails int                 // The number of times trying to setup the consumer failed.
@@ -3546,33 +3547,38 @@ func (mset *stream) processInboundMirrorMsg(m *inMsg) bool {
 	}
 
 	// Mirror info tracking.
-	olag, osseq, odseq := mset.mirror.lag, mset.mirror.sseq, mset.mirror.dseq
+	olag, osseq, odseq, ocseq := mset.mirror.lag, mset.mirror.sseq, mset.mirror.dseq, mset.mirror.cseq
 	if sseq <= mset.mirror.sseq {
 		// Ignore older messages.
 		// If the deliver sequence matches, we only update delivered accounting.
-		if dseq == mset.mirror.dseq+1 {
+		// A stale delivery from before a consumer reset could match too, but it won't be above the last counted.
+		if dseq == mset.mirror.dseq+1 && sseq > mset.mirror.cseq {
 			mset.mirror.dseq++
+			mset.mirror.cseq = sseq
 		}
 		mset.mu.Unlock()
 		return true
 	} else if sseq == mset.mirror.sseq+1 {
 		mset.mirror.dseq = dseq
 		mset.mirror.sseq++
+		mset.mirror.cseq = sseq
 	} else if mset.mirror.cname == _EMPTY_ {
 		mset.mirror.cname = cname
-		mset.mirror.dseq, mset.mirror.sseq = dseq, sseq
+		mset.mirror.dseq, mset.mirror.sseq, mset.mirror.cseq = dseq, sseq, sseq
 	} else {
 		// If the deliver sequence matches then the upstream stream has expired or deleted messages.
 		if dseq == mset.mirror.dseq+1 {
 			if err := mset.skipMsgs(mset.mirror.sseq+1, sseq-1); err != nil {
 				mset.mirror.sseq = osseq
 				mset.mirror.dseq = odseq
+				mset.mirror.cseq = ocseq
 				mset.mu.Unlock()
 				mset.retryMirrorConsumer()
 				return false
 			}
 			mset.mirror.dseq++
 			mset.mirror.sseq = sseq
+			mset.mirror.cseq = sseq
 		} else {
 			mset.mu.Unlock()
 			mset.retryMirrorConsumer()
@@ -3651,6 +3657,7 @@ func (mset *stream) processInboundMirrorMsg(m *inMsg) bool {
 				mset.mirror.lag = olag
 				mset.mirror.dseq = odseq
 				mset.mirror.sseq = osseq
+				mset.mirror.cseq = ocseq
 				if sseq <= lseq {
 					mset.mirror.sseq = lseq
 				}
@@ -4132,7 +4139,7 @@ func (mset *stream) setupMirrorConsumer() error {
 
 			// Capture consumer name.
 			mirror.cname = ccr.ConsumerInfo.Name
-			mirror.dseq = 0
+			mirror.dseq, mirror.cseq = 0, ccr.ConsumerInfo.Delivered.Stream
 			mirror.fcid, mirror.fcsc = _EMPTY_, 0
 			mirror.sseq = max(ccr.ConsumerInfo.Delivered.Stream, state.LastSeq)
 			mirror.qch = make(chan struct{})
@@ -4644,7 +4651,7 @@ func (mset *stream) trySetupSourceConsumer(iname string, seq uint64, startTime t
 				si.cname = ccr.ConsumerInfo.Name
 
 				// Do not set si.sseq to seq here. si.sseq will be set in processInboundSourceMsg
-				si.dseq = 0
+				si.dseq, si.cseq = 0, ccr.ConsumerInfo.Delivered.Stream
 				si.fcid, si.fcsc = _EMPTY_, 0
 				si.qch = make(chan struct{})
 				// Set the last seen as now so that we don't fail at the first check.
@@ -4894,28 +4901,26 @@ func (mset *stream) processInboundSourceMsg(si *sourceInfo, m *inMsg) bool {
 	}
 
 	// Tracking is done here.
-	osseq, odseq := si.sseq, si.dseq
+	osseq, odseq, ocseq := si.sseq, si.dseq, si.cseq
 	if sseq <= si.sseq {
 		// Ignore older messages.
 		// If the deliver sequence matches, we only update delivered accounting.
-		if dseq == si.dseq+1 {
+		// A stale delivery from before a consumer reset could match too, but it won't be above the last counted.
+		if dseq == si.dseq+1 && sseq > si.cseq {
 			si.dseq++
+			si.cseq = sseq
 		}
 		mset.mu.Unlock()
 		return true
 	} else if dseq == si.dseq+1 {
 		si.dseq++
-		si.sseq = sseq
-	} else if dseq > si.dseq {
-		if si.cname == _EMPTY_ {
-			si.cname = cname
-			si.dseq, si.sseq = dseq, sseq
-		} else {
-			mset.retrySourceConsumerAtSeq(si.iname, si.sseq+1)
-			mset.mu.Unlock()
-			return false
-		}
+		si.sseq, si.cseq = sseq, sseq
+	} else if dseq > si.dseq && si.cname == _EMPTY_ {
+		si.cname = cname
+		si.dseq, si.sseq, si.cseq = dseq, sseq, sseq
 	} else {
+		// Either we missed messages, or this newer message was delivered before one we already counted.
+		mset.retrySourceConsumerAtSeq(si.iname, si.sseq+1)
 		mset.mu.Unlock()
 		return false
 	}
@@ -4996,6 +5001,7 @@ func (mset *stream) processInboundSourceMsg(si *sourceInfo, m *inMsg) bool {
 			mset.mu.Lock()
 			si.dseq = odseq
 			si.sseq = osseq
+			si.cseq = ocseq
 			mset.retrySourceConsumerAtSeq(iName, sseq)
 			mset.mu.Unlock()
 		}
```

---

### Incident Patch 2: `011cda33` (2026-10-28)
**Commit Message**: [FIXED] Leafnode deny_imports reply drops & perms on account updates (#8800)

This PR fixes three leafnode permission issues:
- `deny_imports` now properly only limits what the leaf receives, and
`deny_exports` limits what the leaf sends.
- Updating an account JWT would drop leafnode interest.
- Leafs now keep their permissions set at connect when updating default
permissions, consistent with config reloads.

**File**: `server/client.go` (modified, +27/-13)
```diff
@@ -1083,6 +1083,10 @@ func (c *client) updateDefaultPermissions(perms *Permissions) bool {
 	if c.user == nil || !c.user.defaultPerms {
 		return false
 	}
+	// A leafnode's perms are set up at connect, like on config reload.
+	if c.kind == LEAF {
+		return false
+	}
 	if perms == nil {
 		c.user.Permissions = nil
 		c.perms = nil
@@ -3484,6 +3488,11 @@ func (c *client) canSubscribe(subject string, optQueue ...string) bool {
 // an exact queue subscription, can overlap a deny entry. Assumes caller is
 // holding the write lock.
 func (c *client) loadMsgDenyFilterIfNeeded(subject string, hasQueue bool) {
+	// A solicited leafnode's subscribe denies only limit what we receive.
+	// Deliveries to it are checked against its publish perms in deliverMsg().
+	if c.isSolicitedLeafNode() {
+		return
+	}
 	// We use the actual subscription to signal us to spin up the deny mperms
 	// and cache. We check if the subject is a wildcard that intersects any of
 	// the deny clauses.
@@ -6264,10 +6273,17 @@ func (c *client) swapAccountAfterReload() {
 func (c *client) processSubsOnConfigReload(awcsti map[string]struct{}) {
 	c.mu.Lock()
 	var (
-		checkPerms = c.perms != nil
+		// A leafnode's subscribe perms only limit what we receive, not the remote's interest.
+		checkPerms = c.perms != nil && c.kind != LEAF
 		checkAcc   = c.acc != nil
 		acc        = c.acc
 	)
+	if checkAcc {
+		// We actually only want to check if stream imports have changed.
+		if _, ok := awcsti[acc.Name]; !ok {
+			checkAcc = false
+		}
+	}
 	if !checkPerms && !checkAcc {
 		c.mu.Unlock()
 		return
@@ -6279,24 +6295,22 @@ func (c *client) processSubsOnConfigReload(awcsti map[string]struct{}) {
 		removed  = _removed[:0]
 		srv      = c.srv
 	)
-	if checkAcc {
-		// We actually only want to check if stream imports have changed.
-		if _, ok := awcsti[acc.Name]; !ok {
-			checkAcc = false
-		}
-	}
 	// We will clear any mperms we have here. It will rebuild on the fly with canSubscribe,
 	// so we do that here as we collect them. We will check result down below.
-	c.mperms = nil
+	if checkPerms {
+		c.mperms = nil
+	}
 	// Collect client's subs under the lock
 	for _, sub := range c.subs {
 		// Just checking to rebuild mperms under the lock, will collect removed though here.
 		// Only collect under subs array of canSubscribe and checkAcc true.
-		var allowed bool
-		if len(sub.queue) > 0 {
-			allowed = c.canSubscribe(string(sub.subject), string(sub.queue))
-		} else {
-			allowed = c.canSubscribe(string(sub.subject))
+		allowed := true
+		if checkPerms {
+			if len(sub.queue) > 0 {
+				allowed = c.canSubscribe(string(sub.subject), string(sub.queue))
+			} else {
+				allowed = c.canSubscribe(string(sub.subject))
+			}
 		}
 		if !allowed {
 			removed = append(removed, sub)
```

**File**: `server/leafnode_test.go` (modified, +289/-0)
```diff
@@ -10619,6 +10619,295 @@ func TestLeafNodeQueueScopedImportDenyFiltersBroadQueueInterest(t *testing.T) {
 	require_Equal(t, "exact blocked", string(msg.Data))
 }
 
+// A remote's deny_imports only limits what the leaf receives from the hub, and
+// deny_exports only what it sends. Replies to a hub requester must not be dropped
+// when interest on either side overlaps an import deny.
+func TestLeafNodeDenyImportsDoesNotDropRepliesToHub(t *testing.T) {
+	// In each case a single kind of interest overlaps the deny. All but the first use the
+	// old request style, so the hub's reply inbox is literal and doesn't overlap it.
+	for _, test := range []struct {
+		name            string
+		oldRequestStyle bool
+		hubQueue        bool
+		leafWildcard    bool
+	}{
+		// The hub requester's response inbox (_INBOX.<id>.*) overlaps the deny.
+		{"hub wildcard inbox", false, false, false},
+		// A hub queue sub on a literal subject overlaps the deny.
+		{"hub queue sub", true, true, false},
+		// A leaf wildcard sub overlaps the deny.
+		{"leaf wildcard sub", true, false, true},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			hconf := createConfFile(t, []byte(`
+				server_name: "HUB"
+				listen: "127.0.0.1:-1"
+				leafnodes {
+					listen: "127.0.0.1:-1"
+				}
+			`))
+			hub, ohub := RunServerWithConfig(hconf)
+			defer hub.Shutdown()
+
+			lconf := createConfFile(t, []byte(fmt.Sprintf(`
+				server_name: "LEAF"
+				listen: "127.0.0.1:-1"
+				leafnodes {
+					remotes: [
+						{ url: "nats://127.0.0.1:%d", deny_imports: ["_INBOX.>"], deny_exports: ["out.secret"] }
+					]
+				}
+			`, ohub.LeafNode.Port)))
+			leaf, _ := RunServerWithConfig(lconf)
+			defer leaf.Shutdown()
+
+			checkLeafNodeConnected(t, hub)
+			checkLeafNodeConnected(t, leaf)
+
+			var opts []nats.Option
+			if test.oldRequestStyle {
+				opts = append(opts, nats.UseOldRequestStyle())
+			}
+			ncHub := natsConnect(t, hub.ClientURL(), opts...)
+			defer ncHub.Close()
+			out := natsSubSync(t, ncHub, "out.*")
+			if test.hubQueue {
+				natsQueueSubSync(t, ncHub, "_INBOX.queue", "q")
+			}
+			natsFlush(t, ncHub)
+			checkSubInterest(t, leaf, globalAccountName, "out.public", time.Second)
+			if test.hubQueue {
+				checkSubInterest(t, leaf, globalAccountName, "_INBOX.queue", time.Second)
+			}
+
+			ncLeaf := natsConnect(t, leaf.ClientURL())
+			defer ncLeaf.Close()
+			natsSub(t, ncLeaf, "svc", func(m *nats.Msg) {
+				m.Respond([]byte("OK"))
+			})
+			var wildcard *nats.Subscription
+			if test.leafWildcard {
+				wildcard = natsSubSync(t, ncLeaf, ">")
+			}
+			denied := natsSubSync(t, ncLeaf, "_INBOX.leaf")
+			natsFlush(t, ncLeaf)
+			checkSubInterest(t, hub, globalAccountName, "svc", time.Second)
+
+			resp, err := ncHub.Request("svc", []byte("hello"), 2*time.Second)
+			require_NoError(t, err)
+			require_Equal(t, "OK", string(resp.Data))
+
+			// The export deny still applies to what the leaf sends.
+			natsPub(t, ncLeaf, "out.secret", nil)
+			natsPub(t, ncLeaf, "out.public", nil)
+			natsFlush(t, ncLeaf)
+			require_Equal(t, "out.public", natsNexMsg(t, out, time.Second).Subject)
+
+			// The import deny still keeps _INBOX traffic from the hub off the leaf.
+			natsPub(t, ncHub, "_INBOX.leaf", nil)
+			natsFlush(t, ncHub)
+			if _, err := denied.NextMsg(100 * time.Millisecond); err != nats.ErrTimeout {
+				t.Fatalf("Expected _INBOX.leaf to be denied by deny_imports, got %v", err)
+			}
+			// The wildcard sub also gets the leaf's own traffic, but not _INBOX.leaf.
+			for wildcard != nil {
+				msg, err := wildcard.NextMsg(100 * time.Millisecond)
+				if err == nats.ErrTimeout {
+					break
+				}
+				require_NoError(t, err)
+				if msg.Subject == "_INBOX.leaf" {
+					t.Fatalf("Expected _INBOX.leaf to be denied by deny_imports for the wildcard sub")
+				}
+			}
+		})
+	}
+}
+
+// A leafnode's subs hold the remote's interest. An account update on either side must
+// not remove it based on the leafnode's subscribe perms.
+func TestLeafNodeAccountUpdateKeepsRemoteInterest(t *testing.T) {
+	sysKp, sysPub := createKey(t)
+	sysJwt := encodeClaim(t, jwt.NewAccountClaims(sysPub), sysPub)
+	sysCreds := newUser(t, sysKp)
+
+	_, expPub := createKey(t)
+	expClaim := jwt.NewAccountClaims(expPub)
+	expClaim.Exports.Add(&jwt.Export{Subject: "feed", Type: jwt.Stream})
+	expJwt := encodeClaim(t, expClaim, expPub)
+
+	aKp, aPub := createKey(t)
+	aClaim := jwt.NewAccountClaims(aPub)
+	aJwt := encodeClaim(t, aClaim, aPub)
+	aCreds := newUser(t, aKp)
+
+	// The leaf user may receive anything, but may not publish "events".
+	ukp, _ := nkeys.CreateUser()
+	seed, _ := ukp.Seed()
+	upub, _ := ukp.PublicKey()
+	uclaim := newJWTTestUserClaims()
+	uclaim.Subject = upub
+	uclaim.Pub.Deny.Add("events")
+	ujwt, err := uclaim.Encode(aKp)
+	require_NoError(t, err)
+	leafCreds := genCredsFile(t, ujwt, seed)
+
+	tmpl := `
+		server_name: %s
+		listen: "127.0.0.1:-1"
+		operator: %s
+		system_account: %s
+		resolver: MEMORY
+		resolver_preload: {
+			%s: %s
+		
```

---

### Incident Patch 3: `9068db70` (2026-10-28)
**Commit Message**: [FIXED] Imported pull request kept alive by response wildcard interest (#8797)

A pull request that came in through a service import would not track
interest for the original reply subject since it was mapped as part of
the import. Only the server handling the import can map the `_R_` reply
back, so with the consumer leader on another server the request was kept
alive by the import's `_R_.>` response interest until the pull request
expired.

This PR fixes that by recording the original reply subject as part of
`Nats-Request-Info` (similar to how fast batching uses it) and checking
interest against that reply instead.

**File**: `server/client.go` (modified, +29/-0)
```diff
@@ -4362,6 +4362,12 @@ func isJSAckSubject(subject []byte) bool {
 	return len(subject) > jsAckPreLen && bytesToString(subject[:jsAckPreLen]) == jsAckPre
 }
 
+// Test whether a message is a JetStream pull request, either directly or with an ack.
+func isJSPullRequest(subject string, payload []byte) bool {
+	return strings.HasPrefix(subject, jsRequestNextPre) ||
+		(isJSAckSubject(stringToBytes(subject)) && bytes.HasPrefix(payload, AckNext))
+}
+
 // jsAckDeliverIdx returns the byte offset of the `@` separator in an encoded
 // `$JS.ACK....@<deliver>` reply, or -1 if reply is not in that form. Stream,
 // consumer, and subject tokens may legally contain `@`, so we accept only the
@@ -5089,6 +5095,9 @@ func (c *client) processServiceImport(si *serviceImport, acc *Account, msg []byt
 			// Fast batch requires knowledge of the original reply subject.
 			if bytes.HasSuffix(c.pa.reply, []byte(FastBatchSuffix)) {
 				ci.Reply = bytesToString(c.pa.reply)
+			} else if ci != nil && len(c.pa.reply) > 0 && isJSPullRequest(to, msg[max(c.pa.hdr, 0):]) {
+				// So do pull requests, for a consumer leader on another server to track the requester's interest.
+				ci.Reply = bytesToString(c.pa.reply)
 			}
 			// If we did not share but the imports destination is the system account add in the server and cluster info.
 			if !share && isSysImport {
@@ -5923,6 +5932,26 @@ func (c *client) checkLeafClientInfoHeader(msg []byte) (dmsg []byte, setHdr bool
 	return dmsg, setHdr
 }
 
+// Bind a client info header received from a leafnode to the account of the leafnode connection.
+func (c *client) bindLeafClientInfoHeader(acc *Account, msg []byte) []byte {
+	if c.pa.hdr < 0 || len(msg) < c.pa.hdr {
+		return msg
+	}
+	cir := sliceHeader(ClientInfoHdr, msg[:c.pa.hdr])
+	if len(cir) == 0 {
+		return msg
+	}
+	var ci ClientInfo
+	if err := json.Unmarshal(cir, &ci); err != nil || ci.Account == acc.Name {
+		return msg
+	}
+	ci.Account = acc.Name
+	if b, _ := json.Marshal(ci); b != nil {
+		msg = c.setHeader(ClientInfoHdr, bytesToString(b), msg)
+	}
+	return msg
+}
+
 func (c *client) pubPermissionViolation(subject []byte) {
 	errTxt := fmt.Sprintf("Permissions Violation for Publish to %q", subject)
 	if mt, _ := c.isMsgTraceEnabled(); mt != nil {
```

**File**: `server/consumer.go` (modified, +56/-7)
```diff
@@ -2874,7 +2874,12 @@ func (o *consumer) processAck(subject, reply string, hdr int, rmsg []byte) {
 		}
 	case bytes.HasPrefix(msg, AckNext):
 		o.processAckMsg(sseq, dseq, dc, _EMPTY_, true)
-		o.processNextMsgRequest(reply, msg[len(AckNext):])
+		// An _R_ reply's Nats-Request-Info holds the requester's account and reply, parsed only if needed.
+		var rci []byte
+		if strings.HasPrefix(reply, replyPrefix) && hdr > 0 {
+			rci = sliceHeader(ClientInfoHdr, rmsg[:hdr])
+		}
+		o.processNextMsgRequest(reply, msg[len(AckNext):], rci)
 		skipAckReply = true
 	case bytes.HasPrefix(msg, AckNak):
 		o.processNak(sseq, dseq, dc, msg)
@@ -4080,6 +4085,8 @@ type waitingRequest struct {
 	next          *waitingRequest
 	acc           *Account
 	interest      string
+	racc          *Account // Requester's account from Nats-Request-Info, until its interest is tracked.
+	rreply        string   // Requester's reply from Nats-Request-Info, until its interest is tracked.
 	reply         string
 	n             int // For batching
 	d             int // num delivered
@@ -4112,6 +4119,7 @@ func (wr *waitingRequest) recycleIfDone() bool {
 func (wr *waitingRequest) recycle() {
 	if wr != nil {
 		wr.next, wr.acc, wr.interest, wr.reply = nil, nil, _EMPTY_, _EMPTY_
+		wr.racc, wr.rreply = nil, _EMPTY_
 		wrPool.Put(wr)
 	}
 }
@@ -4533,6 +4541,7 @@ func (o *consumer) nextWaiting(sz int) *waitingRequest {
 				}
 			}
 
+			wr.trackRequesterInterest(o.srv)
 			if wr.acc.sl.HasInterest(wr.interest) {
 				return o.waiting.popOrPopAndRequeue(o.cfg.PriorityPolicy)
 			} else if time.Since(wr.received) < defaultGatewayRecentSubExpiration && (o.srv.leafNodeEnabled || o.srv.gateway.enabled) {
@@ -4587,11 +4596,12 @@ func (o *consumer) nextWaiting(sz int) *waitingRequest {
 type nextMsgReq struct {
 	reply string
 	msg   []byte
+	rci   []byte // Nats-Request-Info, for an _R_ reply of a service import
 }
 
 var nextMsgReqPool sync.Pool
 
-func newNextMsgReq(reply string, msg []byte) *nextMsgReq {
+func newNextMsgReq(reply string, msg, rci []byte) *nextMsgReq {
 	var nmr *nextMsgReq
 	m := nextMsgReqPool.Get()
 	if m != nil {
@@ -4602,15 +4612,15 @@ func newNextMsgReq(reply string, msg []byte) *nextMsgReq {
 	// When getting something from a pool it is critical that all fields are
 	// initialized. Doing this way guarantees that if someone adds a field to
 	// the structure, the compiler will fail the build if this line is not updated.
-	(*nmr) = nextMsgReq{reply, msg}
+	(*nmr) = nextMsgReq{reply, msg, rci}
 	return nmr
 }
 
 func (nmr *nextMsgReq) returnToPool() {
 	if nmr == nil {
 		return
 	}
-	nmr.reply, nmr.msg = _EMPTY_, nil
+	nmr.reply, nmr.msg, nmr.rci = _EMPTY_, nil, nil
 	nextMsgReqPool.Put(nmr)
 }
 
@@ -4635,7 +4645,12 @@ func (o *consumer) processNextMsgReq(_ *subscription, c *client, _ *Account, _,
 		o.outq.send(newJSPubMsg(reply, _EMPTY_, _EMPTY_, hdr, nil, nil, 0))
 		return
 	}
-	o.nextMsgReqs.push(newNextMsgReq(reply, copyBytes(msg)))
+	// An _R_ reply's Nats-Request-Info holds the requester's account and reply, parsed only if needed.
+	var rci []byte
+	if strings.HasPrefix(reply, replyPrefix) && len(hdr) > 0 {
+		rci = copyBytes(sliceHeader(ClientInfoHdr, hdr))
+	}
+	o.nextMsgReqs.push(newNextMsgReq(reply, copyBytes(msg), rci))
 }
 
 // processResetReq will reset a consumer to a new starting sequence.
@@ -4691,7 +4706,7 @@ func (o *consumer) processResetReq(_ *subscription, c *client, a *Account, _, re
 	}
 }
 
-func (o *consumer) processNextMsgRequest(reply string, msg []byte) {
+func (o *consumer) processNextMsgRequest(reply string, msg, rci []byte) {
 	o.mu.Lock()
 	defer o.mu.Unlock()
 
@@ -4801,12 +4816,21 @@ func (o *consumer) processNextMsgRequest(reply string, msg []byte) {
 
 	// If we receive this request though an account export, we need to track that interest subject and account.
 	acc, interest := trackDownAccountAndInterest(o.acc, reply)
+	// An _R_ reply of an import on another server can't be tracked down here, and always has interest.
+	// Get the requester's account and reply from Nats-Request-Info instead.
+	var racc *Account
+	var rreply string
+	if len(rci) > 0 && strings.HasPrefix(interest, replyPrefix) {
+		racc, rreply = o.srv.requesterFromRequestInfo(rci)
+	}
 
 	// Create a waiting request.
 	wr := wrPool.Get().(*waitingRequest)
 	wr.acc, wr.interest, wr.reply, wr.n, wr.d, wr.noWait, wr.expires, wr.hb, wr.hbt, wr.priorityGroup = acc, interest, reply, batchSize, 0, noWait, expires, hb, hbt, priorityGroup
+	wr.racc, wr.rreply = racc, rreply
 	wr.b = maxBytes
 	wr.received = time.Now()
+	wr.trackRequesterInterest(o.srv)
 
 	if o.cfg.PriorityPolicy == PriorityPrioritized {
 		if err := o.waiting.addPrioritized(wr); err != nil {
@@ -4854,6 +4878,30 @@ func trackDownAccountAndInterest(acc *Account, interest string) (*Account, strin
 	return acc, interest
 }
 
+// Returns the requester's account and reply from Nats-Request-Info, if known here.
+func (s *Server) requesterFromRequestInfo(rci []byte) (*A
```

**File**: `server/jetstream_consumer_test.go` (modified, +2/-2)
```diff
@@ -11333,7 +11333,7 @@ func TestJetStreamConsumerNoWaitNoMessagesOnEos(t *testing.T) {
 	req := &JSApiConsumerGetNextRequest{NoWait: true}
 	jreq, err := json.Marshal(req)
 	require_NoError(t, err)
-	o.processNextMsgRequest("reply", jreq)
+	o.processNextMsgRequest("reply", jreq, nil)
 
 	msg, err := sub.NextMsg(time.Second)
 	require_NoError(t, err)
@@ -11370,7 +11370,7 @@ func TestJetStreamConsumerNoWaitNoMessagesOnEosWithDeliveredMsgs(t *testing.T) {
 	req := &JSApiConsumerGetNextRequest{NoWait: true, Batch: 2}
 	jreq, err := json.Marshal(req)
 	require_NoError(t, err)
-	o.processNextMsgRequest("reply", jreq)
+	o.processNextMsgRequest("reply", jreq, nil)
 
 	msg, err := sub.NextMsg(time.Second)
 	require_NoError(t, err)
```

**File**: `server/jetstream_super_cluster_test.go` (modified, +213/-0)
```diff
@@ -6777,3 +6777,216 @@ func TestJetStreamSuperClusterMoveCompletesWithoutUnvouchedPeer(t *testing.T) {
 		require_NoError(t, sub.Unsubscribe())
 	}
 }
+
+// A pull request through a service import must be dropped once the requester goes away,
+// also with the consumer leader on another server. Its reply is the import's _R_ subject,
+// which only the import's server can map back to the requester.
+func TestJetStreamSuperClusterConsumerPullCrossAccountLostInterest(t *testing.T) {
+	tmpl := `
+		listen: 127.0.0.1:-1
+		server_name: %s
+		jetstream: {max_mem_store: 256MB, max_file_store: 2GB, store_dir: '%s', domain: HUB}
+		cluster {
+			name: %s
+			listen: 127.0.0.1:%d
+			routes = [%s]
+		}
+		accounts {
+			JS {
+				jetstream: enabled
+				users = [ { user: "js", pass: "p" } ]
+				exports [
+					{ service: "$JS.API.CONSUMER.MSG.NEXT.>", response: stream }
+					{ service: "$JS.ACK.>", response: stream }
+				]
+			}
+			IU {
+				users = [ { user: "iu", pass: "p" } ]
+				imports [
+					{ service: { subject: "$JS.API.CONSUMER.MSG.NEXT.*.*", account: JS } }
+					{ service: { subject: "$JS.ACK.>", account: JS } }
+				]
+			}
+			$SYS { users = [ { user: "admin", pass: "s3cr3t!" } ] }
+		}
+		leafnodes { listen: 127.0.0.1:-1 }`
+	sc := createJetStreamSuperClusterWithTemplate(t, tmpl, 3, 2)
+	defer sc.shutdown()
+
+	c1, c2 := sc.clusterForName("C1"), sc.clusterForName("C2")
+	nc, js := jsClientConnect(t, c1.randomServer(), nats.UserInfo("js", "p"))
+	defer nc.Close()
+	_, err := js.AddStream(&nats.StreamConfig{
+		Name: "TEST", Subjects: []string{"foo"}, Replicas: 3, Placement: &nats.Placement{Cluster: "C1"},
+	})
+	require_NoError(t, err)
+
+	const (
+		KindRoute = iota
+		KindGateway
+		KindLateInterest
+		KindAckNext
+	)
+	for _, test := range []struct {
+		name string
+		kind int
+		leaf bool
+	}{
+		{"route", KindRoute, false},
+		{"gateway", KindGateway, false},
+		{"late-interest", KindLateInterest, false},
+		{"ack-next", KindAckNext, false},
+		{"leafnode", KindRoute, true},
+		{"leafnode-ack-next", KindAckNext, true},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			_, err := js.AddConsumer("TEST", &nats.ConsumerConfig{
+				Durable: test.name, AckPolicy: nats.AckExplicitPolicy, DeliverPolicy: nats.DeliverNewPolicy,
+			})
+			require_NoError(t, err)
+			leader := c1.consumerLeader("JS", "TEST", test.name)
+			s := c1.randomNonConsumerLeader("JS", "TEST", test.name)
+			if test.kind == KindGateway {
+				s = c2.randomServer()
+			}
+			pullSubj := fmt.Sprintf(JSApiRequestNextT, "TEST", test.name)
+			if test.leaf {
+				// The requester is behind a leafnode bound to the importing account.
+				// It pulls through the hub's domain, which maps to the import.
+				pullSubj = strings.Replace(pullSubj, "$JS.API.", "$JS.HUB.API.", 1)
+				lconf := createConfFile(t, fmt.Appendf(nil, `
+					listen: 127.0.0.1:-1
+					server_name: LEAF-%s
+					accounts { IU { users = [ { user: "iu", pass: "p" } ] } }
+					leafnodes { remotes [ { url: "nats-leaf://iu:p@127.0.0.1:%d", account: IU } ] }
+				`, test.name, s.getOpts().LeafNode.Port))
+				ln, _ := RunServerWithConfig(lconf)
+				defer ln.Shutdown()
+				checkLeafNodeConnected(t, ln)
+				checkSubInterest(t, ln, "IU", pullSubj, 2*time.Second)
+				s = ln
+			}
+			nc2, _ := jsClientConnect(t, s, nats.UserInfo("iu", "p"))
+			defer nc2.Close()
+			if !test.leaf {
+				checkSubInterest(t, s, "JS", pullSubj, 2*time.Second)
+			}
+
+			// The leader sees the requester's interest through a route or a gateway.
+			iu, err := leader.LookupAccount("IU")
+			require_NoError(t, err)
+			checkInterest := func(subj string, expected bool) {
+				t.Helper()
+				checkFor(t, 2*time.Second, 50*time.Millisecond, func() error {
+					if (iu.sl.HasInterest(subj) || leader.hasGatewayInterest("IU", subj)) != expected {
+						return fmt.Errorf("expected interest %v for %q on %s", expected, subj, leader.Name())
+					}
+					return nil
+				})
+			}
+			checkWaiting := func(expected int, wait time.Duration) {
+				t.Helper()
+				checkFor(t, wait, 50*time.Millisecond, func() error {
+					ci, err := js.ConsumerInfo("TEST", test.name)
+					if err != nil {
+						return err
+					}
+					if ci.NumWaiting != expected {
+						return fmt.Errorf("expected %d waiting pull requests, got %d", expected, ci.NumWaiting)
+					}
+					return nil
+				})
+			}
+			pull := func(inbox string, batch int) {
+				t.Helper()
+				req, err := json.Marshal(&JSApiConsumerGetNextRequest{Batch: batch, Expires: 30 * time.Second})
+				require_NoError(t, err)
+				require_NoError(t, nc2.PublishRequest(pullSubj, inbox, req))
+				require_NoError(t, nc2.Flush())
+			}
+			receive := func(sub *nats.Subscription) {
+				t.Helper()
+				_, err := js.Publish("foo", []byte("ok"))
+				require_NoError(t, err)
+				m, err := sub.NextMsg(2 * time.Second)
+				require_NoError(t, err)
+				require_Equal(t, string(m.Data), "ok")
+				require_NoError(t, m.AckSync())
+			}
+
+			jsAcc, err := leader.LookupAccou
```

**File**: `server/leafnode.go` (modified, +6/-0)
```diff
@@ -3420,6 +3420,12 @@ func (c *client) processInboundLeafMsg(msg []byte) {
 		return
 	}
 
+	// A leafnode only speaks for the account it's bound to.
+	// The system account is trusted to speak for others, like for JetStream API requests.
+	if len(c.pa.reply) > 0 && c.pa.hdr > 0 && acc != srv.SystemAccount() {
+		msg = c.bindLeafClientInfoHeader(acc, msg)
+	}
+
 	// Match the subscriptions. We will use our own L1 map if
 	// it's still valid, avoiding contention on the shared sublist.
 	var r *SublistResult
```

**File**: `server/leafnode_test.go` (modified, +68/-0)
```diff
@@ -14448,3 +14448,71 @@ func TestLeafNodeLogsRemoteURL(t *testing.T) {
 	s2.Shutdown()
 	checkNoticeNotContains(t, l, remoteURLLogUser, remoteURLLogPassword)
 }
+
+// A leafnode can send a pull request with an _R_ reply and its own Nats-Request-Info.
+// It may only speak for its own account, so the consumer must not track interest of another account.
+func TestLeafNodeJetStreamPullForgedRequestInfo(t *testing.T) {
+	conf := createConfFile(t, fmt.Appendf(nil, `
+		listen: 127.0.0.1:-1
+		jetstream: {max_mem_store: 64MB, max_file_store: 64MB, store_dir: %q}
+		accounts {
+			JS {
+				jetstream: enabled
+				users = [ { user: js, password: js }, { user: leaf, password: leaf } ]
+			}
+			V { users = [ { user: v, password: v } ] }
+		}
+		leafnodes { listen: 127.0.0.1:-1 }
+	`, t.TempDir()))
+	s, o := RunServerWithConfig(conf)
+	defer s.Shutdown()
+
+	nc, js := jsClientConnect(t, s, nats.UserInfo("js", "js"))
+	defer nc.Close()
+	_, err := js.AddStream(&nats.StreamConfig{Name: "TEST", Subjects: []string{"foo"}})
+	require_NoError(t, err)
+	_, err = js.AddConsumer("TEST", &nats.ConsumerConfig{Durable: "C", AckPolicy: nats.AckExplicitPolicy})
+	require_NoError(t, err)
+
+	// Another account has interest in a subject.
+	ncV := natsConnect(t, s.ClientURL(), nats.UserInfo("v", "v"))
+	defer ncV.Close()
+	natsSubSync(t, ncV, "victim.inbox")
+	natsFlush(t, ncV)
+
+	leafConn, err := net.DialTimeout("tcp", net.JoinHostPort(o.LeafNode.Host, fmt.Sprintf("%d", o.LeafNode.Port)), 2*time.Second)
+	require_NoError(t, err)
+	defer leafConn.Close()
+	_, err = bufio.NewReader(leafConn).ReadString('\n')
+	require_NoError(t, err)
+	_, err = leafConn.Write([]byte("CONNECT {\"name\":\"leaf\",\"user\":\"leaf\",\"pass\":\"leaf\",\"headers\":true}\r\nPING\r\n"))
+	require_NoError(t, err)
+	checkLeafNodeConnected(t, s)
+
+	// The leafnode claims the request came from that account.
+	hdr := "NATS/1.0\r\n" + ClientInfoHdr + ": {\"acc\":\"V\",\"reply\":\"victim.inbox\"}\r\n\r\n"
+	req := `{"batch":1,"expires":30000000000}`
+	subj := fmt.Sprintf(JSApiRequestNextT, "TEST", "C")
+	_, err = fmt.Fprintf(leafConn, "HMSG %s _R_.forged %d %d\r\n%s%s\r\n", subj, len(hdr), len(hdr)+len(req), hdr, req)
+	require_NoError(t, err)
+
+	jsAcc, err := s.LookupAccount("JS")
+	require_NoError(t, err)
+	mset, err := jsAcc.lookupStream("TEST")
+	require_NoError(t, err)
+	oc := mset.lookupConsumer("C")
+	require_NotNil(t, oc)
+	checkFor(t, 2*time.Second, 50*time.Millisecond, func() error {
+		oc.mu.RLock()
+		defer oc.mu.RUnlock()
+		if oc.waiting.len() != 1 {
+			return fmt.Errorf("expected 1 waiting pull request, got %d", oc.waiting.len())
+		}
+		return nil
+	})
+	oc.mu.RLock()
+	acc, interest := oc.waiting.head.acc.Name, oc.waiting.head.interest
+	oc.mu.RUnlock()
+	require_Equal(t, acc, "JS")
+	require_Equal(t, interest, "_R_.forged")
+}
```

#### Recent Merged Pull Requests:
- **PR #8808** (2026-10-28): [IMPROVED] Use MatchUntil in firstMatching to return early (@sciascid)
- **PR #8807** (2026-10-28): [IMPROVED] Add LoadLastSeq to skip message loads for last subject sequence (@MauriceVanVeen)
- **PR #8806** (2026-10-28): [IMPROVED] Skip psim walk on a miss in the second-to-last block (@MauriceVanVeen)
- **PR #8804** (2026-10-28): Refuse auth callout when eventing is shut down (@davidfarah2003)
- **PR #8803** (2026-10-28): [IMPROVED] Optimize `mb.prevMatchingMulti` (@sciascid)
- **PR #8802** (2026-10-28): [FIXED] Durable mirror/source skipping messages after a consumer reset (@MauriceVanVeen)

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

## X. [FIXED] Durable mirror/source skipping messages after a consumer reset (#8802)

**RULE**:
When implementing operations in `server/consumer.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nats-io/nats-server. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6e102223`: [FIXED] Durable mirror/source skipping messages after a consumer reset (#8802). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `server/consumer.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// resetInfo returns the consumer info for a reset to the given starting sequence.
// Delivery resumes before the info is gathered, so report the reset point itself.
func (o *consumer) resetInfo(seq uint64) *ConsumerInfo {
	info := o.info()
	if info == nil {
		return nil
	}
	info.Delivered.Consumer, info.Delivered.Stream = 0, seq-1
	info.AckFloor.Consumer, info.AckFloor.Stream = 0, seq-1
	return info
}

		if resp.ConsumerInfo = setDynamicConsumerInfoMetadata(o.resetInfo(resetSeq)); resp.ConsumerInfo == nil {
	errResetPending  = errors.New("reset pending")
	// Deliveries proposed before a reset applies would mix into the delivered state after it.
	// Only our own resets are tracked, these always have a reply when replicated.
	if len(o.rsm) > 0 {
		return nil, 0, errResetPending
	}
			if err == ErrStoreMsgNotFound || err == errDeletedMsg || err == ErrStoreEOF || err == errMaxAckPending || err == errResetPending {
			// Dont expire oneshots if we are here because of max ack pending limit or a pending reset.
			_, _, _, fexp := o.processWaiting(err != errMaxAckPending && err != errResetPending)
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
		if resp.ConsumerInfo = setDynamicConsumerInfoMetadata(o.info()); resp.ConsumerInfo == nil {
			if err == ErrStoreMsgNotFound || err == errDeletedMsg || err == ErrStoreEOF || err == errMaxAckPending {
			// Dont expire oneshots if we are here because of max ack pending limit.
			_, _, _, fexp := o.processWaiting(err != errMaxAckPending)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6e102223` are properly handled with clean fallback behavior.

# Forensic Learning Record (Deep Inspection): nats-io/nats-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/nats-io-nats-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nats-io/nats-server](https://github.com/nats-io/nats-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:45:24.035Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nats-io/nats-server`
- **Description**: High-Performance server for NATS.io, the cloud and edge native messaging system.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 20841 stars

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

// parallelTaskQueue starts a number of goroutines and returns a channel
// which functions can be sent to for queued parallel execution. The
// goroutines will stop running when the returned channel is closed and
// all queued tasks have completed. The passed in mp limits concu
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

### Core Architecture Module: `logger/syslog.go`
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

//go:build !windows

package logger

import (
	"fmt"
	"log"
	"log/syslog"
	"net/url"
	"os"
	"strings"
)

// SysLogger provides a system logger facility
type SysLogger struct {
	writer *syslog.Writer
	debug  bool
	trace  bool
}

// SetSyslogName sets the name to use for the syslog.
// Currently used only on Windows.
func SetSyslogName(name string) {}

// GetSysLoggerTag generates the tag name for use in syslog statements. If
// the executable is linked, the name of the link will be used as the tag,
// otherwise, the name of the executable is used.  "nats-server" is the default
// for the NATS server.
func GetSysLoggerTag() string {
	procName := os.Args[0]
	if strings.ContainsRune(procName, os.PathSeparator) {
		parts := strings.FieldsFunc(procName, func(c rune) bool {
			return c == os.PathSeparator
		})
		procName = parts[len(parts)-1]
	}
	return procName
}

// NewSysLogger creates a new system logger
func NewSysLogger(debug, trace bool) *SysLogger {
	w, err := syslog.New(syslog.LOG_DAEMON|syslog.LOG_NOTICE, GetSysLoggerTag())
	if err != nil {
		log.Fatalf("error connecting to syslog: %q", err.Error())
	}

	return &SysLogger{
		writer: w,
		debug:  debug,
		trace:  trace,
	}
}

// NewRemoteSysLogger creates a new remote system logger
func NewRemoteSysLogger(fqn string, debug, trace bool) *SysLogger {
	network, addr := getNetworkAndAddr(fqn)
	w, err := syslog.Dial(network, addr, syslog.LOG_DEBUG, GetSysLoggerTag())
	if err != nil {
		log.Fatalf("error connecting to syslog: %q", err.Error())
	}

	return &SysLogger{
		writer: w,
		debug:  debug,
		trace:  trace,
	}
}

func getNetworkAndAddr(fqn string) (network, addr string) {
	u, err := url.Parse(fqn)
	if err != nil {
		log.Fatal(err)
	}

	network = u.Scheme
	if network == "udp" || network == "tcp" {
		addr = u.Host
	} else if network == "unix" {
		addr = u.Path
	} else {
		log.Fatalf("error invalid network type: %q", u.Scheme)
	}

	return
}

// Noticef logs a notice statement
func (l *SysLogger) Noticef(format string, v ...any) {
	l.writer.Notice(fmt.Sprintf(format, v...))
}

// Warnf logs a warning statement
func (l *SysLogger) Warnf(format string, v ...any) {
	l.writer.Warning(fmt.Sprintf(format, v...))
}

// Fatalf logs a fatal error
func (l *SysLogger) Fatalf(format string, v ...any) {
	l.writer.Crit(fmt.Sprintf(format, v...))
}

// Errorf logs an error statement
func (l *SysLogger) Errorf(format string, v ...any) {
	l.writer.Err(fmt.Sprintf(format, v...))
}

// Debugf logs a debug statement
func (l *SysLogger) Debugf(format string, v ...any) {
	if l.debug {
		l.writer.Debug(fmt.Sprintf(format, v...))
	}
}

// Tracef logs a trace statement
func (l *SysLogger) Tracef(format string, v ...any) {
	if l.trace {
		l.writer.Notice(fmt.Sprintf(format, v...))
	}
}

```

### Core Architecture Module: `logger/syslog_windows.go`
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

// Package logger logs to the windows event log
package logger

import (
	"fmt"
	"os"
	"strings"

	"golang.org/x/sys/windows/svc/eventlog"
)

var natsEventSource = "NATS-Server"

// SetSyslogName sets the name to use for the system log event source
func SetSyslogName(name string) {
	natsEventSource = name
}

// SysLogger logs to the windows event logger
type SysLogger struct {
	writer *eventlog.Log
	debug  bool
	trace  bool
}

// NewSysLogger creates a log using the windows event logger
func NewSysLogger(debug, trace bool) *SysLogger {
	if err := eventlog.InstallAsEventCreate(natsEventSource, eventlog.Info|eventlog.Error|eventlog.Warning); err != nil {
		if !strings.Contains(err.Error(), "registry key already exists") {
			panic(fmt.Sprintf("could not access event log: %v", err))
		}
	}

	w, err := eventlog.Open(natsEventSource)
	if err != nil {
		panic(fmt.Sprintf("could not open event log: %v", err))
	}

	return &SysLogger{
		writer: w,
		debug:  debug,
		trace:  trace,
	}
}

// NewRemoteSysLogger creates a remote event logger
func NewRemoteSysLogger(fqn string, debug, trace bool) *SysLogger {
	w, err := eventlog.OpenRemote(fqn, natsEventSource)
	if err != nil {
		panic(fmt.Sprintf("could not open event log: %v", err))
	}

	return &SysLogger{
		writer: w,
		debug:  debug,
		trace:  trace,
	}
}

func formatMsg(tag, format string, v ...any) string {
	orig := fmt.Sprintf(format, v...)
	return fmt.Sprintf("pid[%d][%s]: %s", os.Getpid(), tag, orig)
}

// Noticef logs a notice statement
func (l *SysLogger) Noticef(format string, v ...any) {
	l.writer.Info(1, formatMsg("NOTICE", format, v...))
}

// Warnf logs a warning statement
func (l *SysLogger) Warnf(format string, v ...any) {
	l.writer.Info(1, formatMsg("WARN", format, v...))
}

// Fatalf logs a fatal error
func (l *SysLogger) Fatalf(format string, v ...any) {
	msg := formatMsg("FATAL", format, v...)
	l.writer.Error(5, msg)
	panic(msg)
}

// Errorf logs an error statement
func (l *SysLogger) Errorf(format string, v ...any) {
	l.writer.Error(2, formatMsg("ERROR", format, v...))
}

// Debugf logs a debug statement
func (l *SysLogger) Debugf(format string, v ...any) {
	if l.debug {
		l.writer.Info(3, formatMsg("DEBUG", format, v...))
	}
}

// Tracef logs a trace statement
func (l *SysLogger) Tracef(format string, v ...any) {
	if l.trace {
		l.writer.Info(4, formatMsg("TRACE", format, v...))
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
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. I'm taking a look into it.

- **Issue #4529** (2023-09-13): **Panic in recalculateFirstForSubj**
  *Symptoms*: ### What version were you using?  [v2.9.22](https://github.com/nats-io/nats-server/releases/tag/v2.9.22)  ### What environment was the server running in?  Kubernetes/Linux  ### Is this defect reproducible?  I'm not sure how to reproduce this, but this out of bounds access may be related to the fix that was put in for this issue? https://github.com/nats-io/nats-server/issues/4445 https://github.com/nats-io/nats-server/commit/8865c2a703886356769bcbf877546010b79c3523 Maybe this caused the out of bounds access  ``` [1] 2023/09/13 15:35:12.278427 [DBG] JETSTREAM - JetStream connection closed: Client Closed panic: runtime error: slice bounds out of range [-3785495:]  goroutine 30 [running]: github.com/nats-io/nats-server/v2/server.(*msgBlock).recalculateFirstForSubj(0xc01d4b2680, {0xc023bedb80, 0x77}, 0xba431, 0xc0126d6500)     github.com/nats-io/nats-server/v2/server/filestore.go:5979 +0x2ca github.com/nats-io/nats-server/v2/server.(*fileStore).firstSeqForSubj(0xc00aa80580, {0xc023bedb80, 0x77})     github.com/nats-io/nats-server/v2/server/filestore.go:2584 +0x1c6 github.com/nats-io/nats-server/v2/server.(*fileStore).storeRawMsg(0xc00aa80580, {0xc023bedb80, 0x77}, {0xc02339efc0, 0x205, 0x205}, {0xc01bfef8c0, 0x293, 0x293}, 0xc422b, ...)     github.com/nats-io/nats-server/v2/server/filestore.go:2389 +0x675 github.com/nats-io/nats-server/v2/server.(*fileStore).StoreMsg(0xc00aa80580, {0xc023bedb80, 0x77}, {0xc02339efc0, 0x205, 0x205}, {0xc01bfef8c0, 0x293, 0x293})    

- **Issue #1789** (2024-06-05): **account cycle check broken when renaming subjects**
  *Symptoms*: unit test to demonstrate issue  ``` func TestAccountCycleWithRenaming(t *testing.T) { 	conf := createConfFile(t, []byte(` 		accounts { 		  A { 		    exports [ { service: * } ] 			imports [ { service { subject: foo, account: B }, to: foo } ] 		  } 		  B { 		    exports [ { service: foo } ] 			imports [ { service { subject: *, account: A }, to: "$1" } ] // will pass without to 		  } 		} 	`)) 	defer os.Remove(conf) 	if _, err := server.ProcessConfigFile(conf); err == nil || !strings.Contains(err.Error(), server.ErrImportFormsCycle.Error()) { 		t.Fatalf("Expected an error on cycle service import, got none") 	}  	conf = createConfFile(t, []byte(` 		accounts { 		  A { 		    exports [ { stream: * } ] 			imports [ { stream { subject: foo, account: B }, to: foo } ] 		  } 		  B { 		    exports [ { stream: foo } ] 			imports [ { stream { subject: *, account: A }, to: "$1" } ] // will pass without to 		  } 		} 	`)) 	defer os.Remove(conf) 	if _, err := server.ProcessConfigFile(conf); err == nil || !strings.Contains(err.Error(), server.ErrImportFormsCycle.Error()) { 		t.Fatalf("Expected an error on cycle service import, got none") 	} }  ```
  **Post-Mortem & Fix Analysis**:
  > I just tested this and still fails.
  > ok not high on my list, let's see if someone else can pick up.

- **Issue #432** (2017-05-18): **Authorization Timeout and TLS**
  *Symptoms*: When TLS and authorization is enabled, the authorization timeout can fire during the TLS handshake, causing the server to write the authorization timeout error string into the client socket, injecting what becomes bad data into the TLS handshake.  This creates misleading errors on the client such as `tls: oversized record received with length 21024`.  I've only seen this happen when the host machine is under very heavy load with many clients simultaneously connecting, causing the server to become CPU bound.  There are a few ways to tackle this, but I propose waiting to schedule the authorization timer until after TLS is fully established to avoid this scenario.  Any thoughts?
  **Post-Mortem & Fix Analysis**:
  > FYI, this issue (or a variation of it) appears to still exist. We were seeing connection problems a lot of the time, using gnats 1.10. Examining the network capture, I see the negotiation starting to take place, and then the server sends a plaintext "-ERR 'Secure Connection - TLS Required', which naturally derails the client.  Increasing the TLS handshake timeout resolved the issue. Before the change, every other connection would fail (staging environment, one client, no load). After the change, no connections appear to fail. If it matters, we use client certificates.  EDIT: After some more research, I now understand that in gnatsd there are two separate timeout settings, one for auth and another for TLS. The former seems to have been addressed, but the latter is still problematic. If you want to keep the TLS handshake timeout, I suggest increasing it to a reasonable value that will not trigger under normal circumstances. The default value is too low.  Having said that, what prob
  > Being able to set these is due to DOS attack mitigation.
  > Interesting. Has this been done preemptively, or have there been attacks against TLS handshakes in the past?

- **Issue #5** (2013-07-31): **gnatsd HTTP monitoring has some issues**
  *Symptoms*: First, gnatsd takes a parameter to use as the HTTP monitoring port, however it doesn't actually use the passed parameter.  The port is hardcoded to 6062.  Second, gnatsd always starts the HTTP server, but only registers the handlers for the server if the monitoring port is specified.  The goroutine to launch the HTTP monitoring should be moved within the if statement to see if a monitoring port was specified. 
  **Post-Mortem & Fix Analysis**:
  > I think monitoring ports for varz, etc are ok. Do you mean the pprof http? 
  > I will add in support for configuring via the config file, which is new, etc.. 
  > Yes, the HTTP monitoring, not the profiler.  The provider appears to be hard-coded to "localhost:6062", but it is isolated to the gnatsd binary and not the actual server's goroutine, so should be fine. 

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

### Incident Patch 1: `24b40f10` (2026-10-05)
**Commit Message**: (2.14) [FIXED] Fast batch ping could start a new batch (#8714)

**File**: `server/jetstream_batching_test.go` (modified, +48/-0)
```diff
@@ -5002,6 +5002,54 @@ func TestJetStreamFastBatchPublishPing(t *testing.T) {
 	require_Equal(t, pubAck.BatchSize, 100)
 }
 
+func TestJetStreamFastBatchPublishPingCannotStartBatch(t *testing.T) {
+	s := RunBasicJetStreamServer(t)
+	defer s.Shutdown()
+
+	nc := clientConnectToServer(t, s)
+	defer nc.Close()
+
+	_, err := jsStreamCreate(t, nc, &StreamConfig{
+		Name:              "TEST",
+		Subjects:          []string{"foo"},
+		Storage:           FileStorage,
+		AllowBatchPublish: true,
+	})
+	require_NoError(t, err)
+
+	inbox := nats.NewInbox()
+	sub, err := nc.SubscribeSync(fmt.Sprintf("%s.>", inbox))
+	require_NoError(t, err)
+	defer sub.Drain()
+
+	// A ping at batch sequence 1 must not start a new batch.
+	for _, gapMode := range []string{FastBatchGapFail, FastBatchGapOk} {
+		m := nats.NewMsg("foo")
+		m.Reply = generateFastBatchReply(inbox, "uuid", 1, 2, gapMode, FastBatchOpPing)
+		require_NoError(t, nc.PublishMsg(m))
+		rmsg, err := sub.NextMsg(time.Second)
+		require_NoError(t, err)
+		var pubAck JSPubAckResponse
+		require_NoError(t, json.Unmarshal(rmsg.Data, &pubAck))
+		require_Error(t, pubAck.Error, NewJSBatchPublishUnknownBatchIDError())
+	}
+
+	mset, err := s.globalAccount().lookupStream("TEST")
+	require_NoError(t, err)
+	mset.mu.RLock()
+	batches := mset.batches
+	mset.mu.RUnlock()
+	if batches != nil {
+		batches.mu.Lock()
+		inflight := len(batches.fast)
+		batches.mu.Unlock()
+		require_Len(t, inflight, 0)
+	}
+	require_Equal(t, globalInflightFastBatches.Load(), 0)
+	_, err = sub.NextMsg(250 * time.Millisecond)
+	require_Error(t, err, nats.ErrTimeout)
+}
+
 func TestJetStreamFastBatchPublishGapOkBackwardSeq(t *testing.T) {
 	s := RunBasicJetStreamServer(t)
 	defer s.Shutdown()
```

**File**: `server/stream.go` (modified, +2/-1)
```diff
@@ -8123,7 +8123,8 @@ func (mset *stream) processJetStreamFastBatchMsg(batch *FastBatch, subject, repl
 	// Get batch.
 	b, ok := batches.fast[batch.id]
 	if !ok {
-		if batch.seq != 1 {
+		// A new batch can only be started at sequence 1 and not by a ping.
+		if batch.seq != 1 || batch.ping {
 			batches.mu.Unlock()
 			mset.mu.Unlock()
 			return respondError(NewJSBatchPublishUnknownBatchIDError())
```

---

### Incident Patch 2: `10887cdf` (2026-10-05)
**Commit Message**: De-flake TestNoRaceWSNoCorruptionWithFrameSizeLimit (#8712)

`TestNoRaceWSNoCorruptionWithFrameSizeLimit` times out intermittently in
CI, for example on #8710 and on `jnm/transform-account` (run
36992228943).

Cause: the test publishes all 50000 messages at once and then gives
delivery a fixed 10 seconds.
On a loaded machine the backlog to a websocket subscriber outgrows
`max_pending`, the server drops that subscriber as a slow consumer, and
the remaining messages never arrive.
A failing run reported 91787 of 100000 messages received, with no
progress afterwards, and one slow consumer on a subscriber's client
connection.

Change: the publisher stays at most 2000 messages ahead of the
subscribers, and the test fails only once delivery has stopped making
progress for 10 seconds, reporting the count and the slow consumer
counts.
The test still sends all 50000 messages through the frame size limit,
and takes about as long as before (about 0.9 s per run here).

Testing, on two CPUs (`taskset -c 8,9`):

| | Original | This change |
| --- | --- | --- |
| Sequential runs | 5 failures in 15 | 0 in 25 |
| Four concurrent runs, 10 each | 2 failures in 40 | 0 in 40 |

`TestWSNoCorruptionWithFr

**File**: `server/websocket_test.go` (modified, +35/-8)
```diff
@@ -4776,6 +4776,37 @@ func testWSNoCorruptionWithFrameSizeLimit(t *testing.T, total int) {
 		s.mu.RUnlock()
 	}
 
+	// Wait until both subscribers have received at least target messages in
+	// total. Delivery can be slow on a loaded machine, so only give up once
+	// it has stopped making progress.
+	waitForCount := func(target int) {
+		t.Helper()
+		last, lastProgress := int32(-1), time.Now()
+		for {
+			n := atomic.LoadInt32(&count)
+			if int(n) >= target {
+				return
+			}
+			if n != last {
+				last, lastProgress = n, time.Now()
+			} else if time.Since(lastProgress) > 10*time.Second {
+				t.Fatalf("Test timed out: received %d of %d messages, slow consumers: %d, %d, %d",
+					n, target, s1.NumSlowConsumers(), s2.NumSlowConsumers(), s3.NumSlowConsumers())
+			}
+			select {
+			case err := <-errCh:
+				t.Fatalf("Error: %v", err)
+			case <-doneCh:
+				return
+			case <-time.After(5 * time.Millisecond):
+			}
+		}
+	}
+
+	// Bound how far the publisher gets ahead of the subscribers. Without it,
+	// a slow machine lets the backlog to a subscriber outgrow max_pending, the
+	// server drops it as a slow consumer, and the messages never arrive.
+	const maxInFlight = 2000
 	for i := 0; i < total; i++ {
 		natsPub(t, nc1, "foo", payload)
 		if i%100 == 0 {
@@ -4784,16 +4815,12 @@ func testWSNoCorruptionWithFrameSizeLimit(t *testing.T, total int) {
 				t.Fatalf("Error: %v", err)
 			default:
 			}
+			if i >= maxInFlight {
+				waitForCount(2 * (i - maxInFlight))
+			}
 		}
 	}
-	select {
-	case err := <-errCh:
-		t.Fatalf("Error: %v", err)
-	case <-doneCh:
-		return
-	case <-time.After(10 * time.Second):
-		t.Fatalf("Test timed out")
-	}
+	waitForCount(2 * total)
 }
 
 func TestWSNoCorruptionWithFrameSizeLimit(t *testing.T) {
```

---

### Incident Patch 3: `f7057b67` (2026-10-05)
**Commit Message**: (2.14) [FIXED] Fast batch ping could start a new batch

Signed-off-by: Maurice van Veen <[REDACTED_EMAIL]>

**File**: `server/jetstream_batching_test.go` (modified, +48/-0)
```diff
@@ -5002,6 +5002,54 @@ func TestJetStreamFastBatchPublishPing(t *testing.T) {
 	require_Equal(t, pubAck.BatchSize, 100)
 }
 
+func TestJetStreamFastBatchPublishPingCannotStartBatch(t *testing.T) {
+	s := RunBasicJetStreamServer(t)
+	defer s.Shutdown()
+
+	nc := clientConnectToServer(t, s)
+	defer nc.Close()
+
+	_, err := jsStreamCreate(t, nc, &StreamConfig{
+		Name:              "TEST",
+		Subjects:          []string{"foo"},
+		Storage:           FileStorage,
+		AllowBatchPublish: true,
+	})
+	require_NoError(t, err)
+
+	inbox := nats.NewInbox()
+	sub, err := nc.SubscribeSync(fmt.Sprintf("%s.>", inbox))
+	require_NoError(t, err)
+	defer sub.Drain()
+
+	// A ping at batch sequence 1 must not start a new batch.
+	for _, gapMode := range []string{FastBatchGapFail, FastBatchGapOk} {
+		m := nats.NewMsg("foo")
+		m.Reply = generateFastBatchReply(inbox, "uuid", 1, 2, gapMode, FastBatchOpPing)
+		require_NoError(t, nc.PublishMsg(m))
+		rmsg, err := sub.NextMsg(time.Second)
+		require_NoError(t, err)
+		var pubAck JSPubAckResponse
+		require_NoError(t, json.Unmarshal(rmsg.Data, &pubAck))
+		require_Error(t, pubAck.Error, NewJSBatchPublishUnknownBatchIDError())
+	}
+
+	mset, err := s.globalAccount().lookupStream("TEST")
+	require_NoError(t, err)
+	mset.mu.RLock()
+	batches := mset.batches
+	mset.mu.RUnlock()
+	if batches != nil {
+		batches.mu.Lock()
+		inflight := len(batches.fast)
+		batches.mu.Unlock()
+		require_Len(t, inflight, 0)
+	}
+	require_Equal(t, globalInflightFastBatches.Load(), 0)
+	_, err = sub.NextMsg(250 * time.Millisecond)
+	require_Error(t, err, nats.ErrTimeout)
+}
+
 func TestJetStreamFastBatchPublishGapOkBackwardSeq(t *testing.T) {
 	s := RunBasicJetStreamServer(t)
 	defer s.Shutdown()
```

**File**: `server/stream.go` (modified, +2/-1)
```diff
@@ -8108,7 +8108,8 @@ func (mset *stream) processJetStreamFastBatchMsg(batch *FastBatch, subject, repl
 	// Get batch.
 	b, ok := batches.fast[batch.id]
 	if !ok {
-		if batch.seq != 1 {
+		// A new batch can only be started at sequence 1 and not by a ping.
+		if batch.seq != 1 || batch.ping {
 			batches.mu.Unlock()
 			mset.mu.Unlock()
 			return respondError(NewJSBatchPublishUnknownBatchIDError())
```

---

### Incident Patch 4: `eea12f49` (2026-10-05)
**Commit Message**: (2.15) [FIXED] Interest check compacting a stream past its last sequence (#8710)

Fixes #8709 that could leave replicated streams stuck after a restart by
preventing cleanup from running ahead of recovery. Tests confirm the
fix.

Details: since #8447, a replicated stream with `sync_interval: always`
truncates its store to the last snapshot on restart and replays the Raft
log.
The consumers' check floors still point past the truncated store, so
`checkInterestState` from the first leader change compacted past the
store's last sequence, and the next replayed message failed with
`expected sequence does not match store`.
`checkInterestState` now only compacts up to the store's last sequence,
and still not at all when there are no consumers.

Testing:
- `TestJetStreamClusterInterestCheckDoesNotCompactPastReplay` fails
without the change and passes with it.
- `TestJetStreamInterestCheckWithoutConsumersDoesNotCompact` covers a
stream without consumers.
- Related cluster, interest and work-queue tests pass.
- The reproducer from #8709: 40 of 44 cycles hit the error on `main`, 0
of 320 with the first version of this change, 0 of 40 with the current
one.

Investigated and drafted with AI assi

**File**: `server/jetstream_cluster_1_test.go` (modified, +58/-0)
```diff
@@ -12917,6 +12917,64 @@ func TestJetStreamClusterPrepareForWALReplayPreservesR1ScaleUpSource(t *testing.
 	}
 }
 
+func TestJetStreamClusterInterestCheckDoesNotCompactPastReplay(t *testing.T) {
+	s := RunBasicJetStreamServer(t)
+	defer s.Shutdown()
+
+	nc, js := jsClientConnect(t, s)
+	defer nc.Close()
+
+	_, err := js.AddStream(&nats.StreamConfig{
+		Name:      "TEST",
+		Subjects:  []string{"foo"},
+		Storage:   nats.FileStorage,
+		Retention: nats.InterestPolicy,
+	})
+	require_NoError(t, err)
+	_, err = js.AddConsumer("TEST", &nats.ConsumerConfig{Durable: "C", AckPolicy: nats.AckExplicitPolicy})
+	require_NoError(t, err)
+
+	const numMsgs = 3
+	for range numMsgs {
+		_, err = js.Publish("foo", []byte("msg"))
+		require_NoError(t, err)
+	}
+	sub, err := js.PullSubscribe("foo", "C")
+	require_NoError(t, err)
+	msgs, err := sub.Fetch(numMsgs)
+	require_NoError(t, err)
+	for _, m := range msgs {
+		require_NoError(t, m.AckSync())
+	}
+
+	mset, err := s.GlobalAccount().lookupStream("TEST")
+	require_NoError(t, err)
+	checkFor(t, 2*time.Second, 50*time.Millisecond, func() error {
+		if state := mset.state(); state.Msgs != 0 {
+			return fmt.Errorf("expected acked messages to be removed, got %d", state.Msgs)
+		}
+		return nil
+	})
+
+	// Checking interest on the full store leaves the consumer's check floor
+	// past the last message, as when a replicated stream starts up.
+	mset.checkInterestState()
+
+	// Recovery truncates the store to replay the Raft log, while the
+	// consumer's ack and check floors are still at the last message.
+	require_NoError(t, mset.prepareForWALReplay(nil))
+	require_Equal(t, mset.lastSeq(), 0)
+
+	// A leader change checks interest before the replay has caught up. It
+	// must not compact the store past the messages that are still to come.
+	mset.checkInterestState()
+	require_Equal(t, mset.state().LastSeq, 0)
+	for seq := uint64(1); seq <= numMsgs; seq++ {
+		require_NoError(t, mset.store.StoreRawMsg("foo", nil, []byte("msg"), seq, time.Now().UnixNano(), 0, false))
+	}
+	require_Equal(t, mset.state().LastSeq, numMsgs)
+}
+
 func TestJetStreamClusterPrepareForWALReplayTruncatesStore(t *testing.T) {
 	s := RunBasicJetStreamServer(t)
 	defer s.Shutdown()
```

**File**: `server/jetstream_test.go` (modified, +31/-0)
```diff
@@ -27319,3 +27319,34 @@ func TestJetStreamDynamicMaxStoreStableAcrossRestart(t *testing.T) {
 			friendlyBytes(int64(written)), friendlyBytes(before), friendlyBytes(after))
 	}
 }
+
+func TestJetStreamInterestCheckWithoutConsumersDoesNotCompact(t *testing.T) {
+	s := RunBasicJetStreamServer(t)
+	defer s.Shutdown()
+
+	nc, js := jsClientConnect(t, s)
+	defer nc.Close()
+
+	_, err := js.AddStream(&nats.StreamConfig{
+		Name:      "TEST",
+		Subjects:  []string{"foo"},
+		Storage:   nats.FileStorage,
+		Retention: nats.InterestPolicy,
+	})
+	require_NoError(t, err)
+
+	mset, err := s.GlobalAccount().lookupStream("TEST")
+	require_NoError(t, err)
+	const numMsgs = 3
+	for range numMsgs {
+		_, _, err = mset.store.StoreMsg("foo", nil, []byte("msg"), 0)
+		require_NoError(t, err)
+	}
+
+	// Without consumers there is no ack floor to compact to.
+	mset.checkInterestState()
+	state := mset.state()
+	require_Equal(t, state.Msgs, numMsgs)
+	require_Equal(t, state.FirstSeq, 1)
+	require_Equal(t, state.LastSeq, numMsgs)
+}
```

**File**: `server/stream.go` (modified, +2/-1)
```diff
@@ -9013,8 +9013,9 @@ func (mset *stream) checkInterestState() {
 	rp := mset.cfg.Retention
 	mset.cfgMu.RUnlock()
 	// Remove as many messages from the "head" of the stream if there's no interest anymore.
+	// Only compact up to the current stream state, consumers may be ahead while replaying.
 	if rp == InterestPolicy && asflr != math.MaxUint64 {
-		mset.store.Compact(asflr)
+		mset.store.Compact(min(asflr, ss.LastSeq+1))
 	}
 }
 
```

---

### Incident Patch 5: `eb3d694c` (2026-10-05)
**Commit Message**: Test helper cluster.leader() requires meta group to be leader

Signed-off-by: Maurice van Veen <[REDACTED_EMAIL]>

**File**: `server/jetstream_helpers_test.go` (modified, +8/-1)
```diff
@@ -1737,7 +1737,14 @@ func (c *cluster) randomNonLeader() *Server {
 func (c *cluster) leader() *Server {
 	for _, s := range c.servers {
 		if s.JetStreamIsLeader() {
-			return s
+			// The upper layer is only signaled asynchronously, so also require the meta
+			// group to still be leader. Otherwise, a leader that just stepped down could
+			// still be returned until it processes the leader change.
+			if js := s.getJetStream(); js != nil {
+				if meta := js.getMetaGroup(); meta != nil && meta.Leader() {
+					return s
+				}
+			}
 		}
 	}
 	return nil
```

---

### Incident Patch 6: `2dad775a` (2026-10-02)
**Commit Message**: [FIXED] Missed sublist interest notification racing a concurrent subscribe

Signed-off-by: Maurice van Veen <[REDACTED_EMAIL]>

**File**: `server/sublist.go` (modified, +3/-2)
```diff
@@ -175,7 +175,9 @@ func (s *Sublist) registerNotification(subject, queue string, notify chan<- bool
 	}
 
 	var hasInterest bool
-	r := s.Match(subject)
+	// Match under the lock so a concurrent insert or remove can't be missed.
+	s.Lock()
+	r := s.matchNoLock(subject)
 
 	if len(r.psubs)+len(r.qsubs) > 0 {
 		if queue == _EMPTY_ {
@@ -199,7 +201,6 @@ func (s *Sublist) registerNotification(subject, queue string, notify chan<- bool
 	key := keyFromSubjectAndQueue(subject, queue)
 	var err error
 
-	s.Lock()
 	if s.notify == nil {
 		s.notify = &notifyMaps{
 			insert: make(map[string][]chan<- bool),
```

---

### Incident Patch 7: `72513dde` (2026-10-02)
**Commit Message**: [FIXED] Idempotent stream create with sources timing out after leader changes

Signed-off-by: Maurice van Veen <[REDACTED_EMAIL]>

**File**: `server/jetstream_cluster.go` (modified, +5/-10)
```diff
@@ -6950,6 +6950,10 @@ func (js *jetStream) processClusterCreateStream(acc *Account, sa *streamAssignme
 			osa := mset.streamAssignment()
 			// If we already have a stream assignment and they are the same exact config, short circuit here.
 			if osa != nil {
+				// Set the index name on both to ensure the DeepEqual works.
+				js.mu.Lock()
+				matchSourceIndexNames(sa.Config, osa.Config)
+				js.mu.Unlock()
 				if reflect.DeepEqual(osa.Config, sa.Config) {
 					if sa.Group.Name == osa.Group.Name && reflect.DeepEqual(sa.Group.Peers, osa.Group.Peers) &&
 						reflect.DeepEqual(sa.Group.Desired, osa.Group.Desired) {
@@ -11049,16 +11053,7 @@ func (s *Server) jsClusteredStreamRequest(ci *ClientInfo, acc *Account, subject,
 	if osa := js.streamAssignmentOrInflight(acc.Name, cfg.Name); osa != nil {
 		copyStreamMetadata(cfg, osa.Config)
 		// Set the index name on both to ensure the DeepEqual works
-		currentIName := make(map[string]struct{})
-		for _, s := range osa.Config.Sources {
-			currentIName[s.iname] = struct{}{}
-		}
-		for _, s := range cfg.Sources {
-			s.setIndexName()
-			if _, ok := currentIName[s.iname]; !ok {
-				s.iname = _EMPTY_
-			}
-		}
+		matchSourceIndexNames(cfg, osa.Config)
 		if !reflect.DeepEqual(osa.Config, cfg) {
 			resp.Error = NewJSStreamNameExistError()
 			s.sendAPIErrResponse(ci, acc, subject, reply, string(rmsg), s.jsonResponse(&resp))
```

**File**: `server/stream.go` (modified, +15/-0)
```diff
@@ -1260,6 +1260,21 @@ func (ssi *StreamSource) setIndexName() {
 	ssi.iname = ssi.composeIName()
 }
 
+// matchSourceIndexNames sets the index names on cfg's sources only if they are also set on ocfg's sources.
+// The index name is not encoded, so this ensures a DeepEqual of both configs can succeed.
+func matchSourceIndexNames(cfg *StreamConfig, ocfg *StreamConfig) {
+	currentIName := make(map[string]struct{}, len(ocfg.Sources))
+	for _, s := range ocfg.Sources {
+		currentIName[s.iname] = struct{}{}
+	}
+	for _, s := range cfg.Sources {
+		s.setIndexName()
+		if _, ok := currentIName[s.iname]; !ok {
+			s.iname = _EMPTY_
+		}
+	}
+}
+
 // Composes the consumer index name. Contains the stream name and consumer name used for durable sourcing (if any).
 // When the stream is external we will use the api prefix as part of the index name
 // (as the same stream and consumer names could be used in multiple JS domains)
```

---

### Incident Patch 8: `8606b1c9` (2026-10-02)
**Commit Message**: De-flake TestNoRaceJetStreamFileStoreLargeKVAccessTiming

Signed-off-by: Maurice van Veen <[REDACTED_EMAIL]>

**File**: `server/norace_1_test.go` (modified, +43/-25)
```diff
@@ -5612,38 +5612,56 @@ func TestNoRaceJetStreamFileStoreLargeKVAccessTiming(t *testing.T) {
 	first := fmt.Sprintf(tmpl, 1)
 	last := fmt.Sprintf(tmpl, nkeys)
 
-	start := time.Now()
-	sm, err := fs.LoadLastMsg(last, nil)
-	require_NoError(t, err)
-	base := time.Since(start)
-
-	if !bytes.Equal(sm.msg, val) {
-		t.Fatalf("Retrieved value did not match")
+	// Timings are sensitive to machine load and IO, so allow a few attempts.
+	attempt := func(measure func() error) {
+		t.Helper()
+		var err error
+		for range 5 {
+			if err = measure(); err == nil {
+				return
+			}
+		}
+		t.Fatal(err)
 	}
 
-	start = time.Now()
-	_, err = fs.LoadLastMsg(first, nil)
-	require_NoError(t, err)
-	slow := time.Since(start)
+	attempt(func() error {
+		start := time.Now()
+		sm, err := fs.LoadLastMsg(last, nil)
+		require_NoError(t, err)
+		base := time.Since(start)
 
-	if base > 100*time.Microsecond || slow > 200*time.Microsecond {
-		t.Fatalf("Took too long to look up first key vs last: %v vs %v", base, slow)
-	}
+		if !bytes.Equal(sm.msg, val) {
+			t.Fatalf("Retrieved value did not match")
+		}
+
+		start = time.Now()
+		_, err = fs.LoadLastMsg(first, nil)
+		require_NoError(t, err)
+		slow := time.Since(start)
+
+		if base > 100*time.Microsecond || slow > 200*time.Microsecond {
+			return fmt.Errorf("Took too long to look up first key vs last: %v vs %v", base, slow)
+		}
+		return nil
+	})
 
 	// time first seq lookup for both as well.
 	// Base will be first in this case.
-	fs.mu.Lock()
-	start = time.Now()
-	fs.firstSeqForSubj(first)
-	base = time.Since(start)
-	start = time.Now()
-	fs.firstSeqForSubj(last)
-	slow = time.Since(start)
-	fs.mu.Unlock()
+	attempt(func() error {
+		fs.mu.Lock()
+		start := time.Now()
+		fs.firstSeqForSubj(first)
+		base := time.Since(start)
+		start = time.Now()
+		fs.firstSeqForSubj(last)
+		slow := time.Since(start)
+		fs.mu.Unlock()
 
-	if base > 100*time.Microsecond || slow > 200*time.Microsecond {
-		t.Fatalf("Took too long to look up last key by subject vs first: %v vs %v", base, slow)
-	}
+		if base > 100*time.Microsecond || slow > 200*time.Microsecond {
+			return fmt.Errorf("Took too long to look up last key by subject vs first: %v vs %v", base, slow)
+		}
+		return nil
+	})
 }
 
 func TestNoRaceJetStreamKVLock(t *testing.T) {
```

---

### Incident Patch 9: `1725e8fe` (2026-10-02)
**Commit Message**: De-flake TestNoRaceSeqSetRelativeSpeed

Signed-off-by: Maurice van Veen <[REDACTED_EMAIL]>

**File**: `server/avl/norace_test.go` (modified, +3/-2)
```diff
@@ -173,8 +173,9 @@ func TestNoRaceSeqSetRelativeSpeed(t *testing.T) {
 			return fmt.Errorf("Expected SequenceSet insert to be no more than 2x slower (%v vs %v)", mapInsertElapsed, ssInsertElapsed)
 		}
 
-		if mapLookupElapsed*3 <= ssLookupElapsed {
-			return fmt.Errorf("Expected SequenceSet lookups to be no more than 3x slower (%v vs %v)", mapLookupElapsed, ssLookupElapsed)
+		// Map lookups can be much faster on machines with large CPU caches, so allow up to 5x.
+		if mapLookupElapsed*5 <= ssLookupElapsed {
+			return fmt.Errorf("Expected SequenceSet lookups to be no more than 5x slower (%v vs %v)", mapLookupElapsed, ssLookupElapsed)
 		}
 		return nil
 	}
```

---

### Incident Patch 10: `077e5913` (2026-10-05)
**Commit Message**: De-flake TestNoRaceWSNoCorruptionWithFrameSizeLimit

The test published all 50000 messages at once and then gave delivery a
fixed 10 seconds. On a loaded machine the backlog to a websocket
subscriber outgrew max_pending, the server dropped it as a slow
consumer, and the messages never arrived, so the test timed out.

Keep the publisher at most 2000 messages ahead of the subscribers, and
fail only once delivery has stopped making progress for 10 seconds,
reporting how many messages arrived and the slow consumer counts.

Signed-off-by: Patrick Schratz <[REDACTED_EMAIL]>

**File**: `server/websocket_test.go` (modified, +35/-8)
```diff
@@ -4776,6 +4776,37 @@ func testWSNoCorruptionWithFrameSizeLimit(t *testing.T, total int) {
 		s.mu.RUnlock()
 	}
 
+	// Wait until both subscribers have received at least target messages in
+	// total. Delivery can be slow on a loaded machine, so only give up once
+	// it has stopped making progress.
+	waitForCount := func(target int) {
+		t.Helper()
+		last, lastProgress := int32(-1), time.Now()
+		for {
+			n := atomic.LoadInt32(&count)
+			if int(n) >= target {
+				return
+			}
+			if n != last {
+				last, lastProgress = n, time.Now()
+			} else if time.Since(lastProgress) > 10*time.Second {
+				t.Fatalf("Test timed out: received %d of %d messages, slow consumers: %d, %d, %d",
+					n, target, s1.NumSlowConsumers(), s2.NumSlowConsumers(), s3.NumSlowConsumers())
+			}
+			select {
+			case err := <-errCh:
+				t.Fatalf("Error: %v", err)
+			case <-doneCh:
+				return
+			case <-time.After(5 * time.Millisecond):
+			}
+		}
+	}
+
+	// Bound how far the publisher gets ahead of the subscribers. Without it,
+	// a slow machine lets the backlog to a subscriber outgrow max_pending, the
+	// server drops it as a slow consumer, and the messages never arrive.
+	const maxInFlight = 2000
 	for i := 0; i < total; i++ {
 		natsPub(t, nc1, "foo", payload)
 		if i%100 == 0 {
@@ -4784,16 +4815,12 @@ func testWSNoCorruptionWithFrameSizeLimit(t *testing.T, total int) {
 				t.Fatalf("Error: %v", err)
 			default:
 			}
+			if i >= maxInFlight {
+				waitForCount(2 * (i - maxInFlight))
+			}
 		}
 	}
-	select {
-	case err := <-errCh:
-		t.Fatalf("Error: %v", err)
-	case <-doneCh:
-		return
-	case <-time.After(10 * time.Second):
-		t.Fatalf("Test timed out")
-	}
+	waitForCount(2 * total)
 }
 
 func TestWSNoCorruptionWithFrameSizeLimit(t *testing.T) {
```

---

### Incident Patch 11: `40c01138` (2026-10-05)
**Commit Message**: [FIXED] JetStream meta monitor panic on shutdown right after start (#8707)

If a clustered JetStream server was shut down before its meta monitor
goroutine first ran, the monitor read its raft node and `qch`/`stopped`
channels back from `js.cluster` after `shutdownJetStream` had cleared
them, and took the process down.

**File**: `server/jetstream_cluster.go` (modified, +14/-18)
```diff
@@ -1427,6 +1427,7 @@ func (js *jetStream) setupMetaGroup() error {
 	}
 
 	c := s.createInternalJetStreamClient()
+	qch, stopped := make(chan struct{}), make(chan struct{})
 
 	js.mu.Lock()
 	defer js.mu.Unlock()
@@ -1435,8 +1436,8 @@ func (js *jetStream) setupMetaGroup() error {
 		streams: make(map[string]map[string]*streamAssignment),
 		s:       s,
 		c:       c,
-		qch:     make(chan struct{}),
-		stopped: make(chan struct{}),
+		qch:     qch,
+		stopped: stopped,
 	}
 	atomic.StoreInt32(&js.clustered, 1)
 	c.registerWithAccount(sysAcc)
@@ -1447,13 +1448,18 @@ func (js *jetStream) setupMetaGroup() error {
 
 	// Set to true before we start.
 	js.metaRecovering = true
-	js.srv.startGoRoutine(
-		js.monitorCluster,
+	// Pass the node and channels to the monitor, shutdownJetStream can clear
+	// them from js.cluster before the monitor goroutine first runs.
+	if !js.srv.startGoRoutine(
+		func() { js.monitorCluster(n, qch, stopped) },
 		pprofLabels{
 			"type":    "metaleader",
 			"account": sysAcc.Name,
 		},
-	)
+	) {
+		// Shutting down, shutdownJetStream must not wait for a monitor that never ran.
+		close(stopped)
+	}
 	return nil
 }
 
@@ -1953,16 +1959,6 @@ func (js *jetStream) clusterQuitC() chan struct{} {
 	return nil
 }
 
-// Return the cluster stopped chan.
-func (js *jetStream) clusterStoppedC() chan struct{} {
-	js.mu.RLock()
-	defer js.mu.RUnlock()
-	if js.cluster != nil {
-		return js.cluster.stopped
-	}
-	return nil
-}
-
 // Mark that the meta layer is recovering.
 func (js *jetStream) setMetaRecovering() {
 	js.mu.Lock()
@@ -2169,9 +2165,9 @@ func (js *jetStream) getOrphans() (streams []*stream, consumers []*consumer) {
 	return streams, consumers
 }
 
-func (js *jetStream) monitorCluster() {
-	s, n := js.server(), js.getMetaGroup()
-	qch, stopped, rqch, lch, aq := js.clusterQuitC(), js.clusterStoppedC(), n.QuitC(), n.LeadChangeC(), n.ApplyQ()
+func (js *jetStream) monitorCluster(n RaftNode, qch, stopped chan struct{}) {
+	s := js.server()
+	rqch, lch, aq := n.QuitC(), n.LeadChangeC(), n.ApplyQ()
 
 	defer s.grWG.Done()
 	defer close(stopped)
```

**File**: `server/jetstream_cluster_4_test.go` (modified, +58/-0)
```diff
@@ -12085,3 +12085,61 @@ func TestJetStreamClusterRestoreFailureDoesNotDeleteReplacement(t *testing.T) {
 	require_NoError(t, err)
 	require_Equal(t, string(msg.Data), "restored message")
 }
+
+func TestJetStreamClusterMetaMonitorShutdownRightAfterStart(t *testing.T) {
+	// The meta monitor goroutine can first run after shutdownJetStream has
+	// cleared the meta group state, which used to crash a clustered server
+	// shut down right after it started. A single proc makes that likely.
+	defer runtime.GOMAXPROCS(runtime.GOMAXPROCS(1))
+
+	for r := range 25 {
+		var wg sync.WaitGroup
+		for i := range 32 {
+			wg.Add(1)
+			go func() {
+				defer wg.Done()
+				o := DefaultTestOptions
+				o.Port = -1
+				o.ServerName = fmt.Sprintf("S-%d-%d", r, i)
+				o.JetStream = true
+				o.StoreDir = t.TempDir()
+				o.Cluster.Name = "R1S"
+				o.Cluster.Host = o.Host
+				o.Cluster.Port = -1
+				// Clustered JetStream requires a route, nothing needs to listen on it.
+				o.Routes = RoutesFromStr("nats://127.0.0.1:1")
+				s := RunServer(&o)
+				start := time.Now()
+				s.Shutdown()
+				if elapsed := time.Since(start); elapsed > 5*time.Second {
+					t.Errorf("Shutdown of %s took %v", o.ServerName, elapsed)
+				}
+			}()
+		}
+		wg.Wait()
+	}
+}
+
+func TestJetStreamClusterMetaMonitorNotStartedShutdown(t *testing.T) {
+	o := DefaultTestOptions
+	o.Port = -1
+	o.JetStream = true
+	o.StoreDir = t.TempDir()
+	s := RunServer(&o)
+	defer s.Shutdown()
+
+	// Set up the meta group after a Shutdown has stopped new goroutines from
+	// starting, so the meta monitor is never started. No cluster block is
+	// needed since setupMetaGroup is called directly.
+	s.grMu.Lock()
+	s.grRunning = false
+	s.grMu.Unlock()
+	require_NoError(t, s.getJetStream().setupMetaGroup())
+
+	// Must not wait for a monitor that is not running.
+	start := time.Now()
+	s.shutdownJetStream()
+	if elapsed := time.Since(start); elapsed > 5*time.Second {
+		t.Fatalf("shutdownJetStream took %v", elapsed)
+	}
+}
```

---

### Incident Patch 12: `5cc54e3b` (2026-10-04)
**Commit Message**: [FIXED] Interest check compacting a stream past its last sequence

With sync_interval: always, a replicated stream on a restarted server
truncates its store to the last snapshot and replays the tail of the
Raft log (#8447). Its consumers' check floors still reflect the store
before the truncation. A leader change during or right after the
replay runs checkInterestState, which compacts the store to the lowest
check floor. When that floor is past the store's last sequence, the
compaction moves the last sequence ahead of the log, and the next
replicated message fails with "expected sequence does not match store"
and leaves the replica stuck until the server restarts.

Only compact up to the store's last sequence. Messages beyond it are
removed by a later check once they are stored.

Resolves #8709

Signed-off-by: Patrick Schratz <[REDACTED_EMAIL]>

**File**: `server/jetstream_cluster_1_test.go` (modified, +58/-0)
```diff
@@ -12917,6 +12917,64 @@ func TestJetStreamClusterPrepareForWALReplayPreservesR1ScaleUpSource(t *testing.
 	}
 }
 
+func TestJetStreamClusterInterestCheckDoesNotCompactPastReplay(t *testing.T) {
+	s := RunBasicJetStreamServer(t)
+	defer s.Shutdown()
+
+	nc, js := jsClientConnect(t, s)
+	defer nc.Close()
+
+	_, err := js.AddStream(&nats.StreamConfig{
+		Name:      "TEST",
+		Subjects:  []string{"foo"},
+		Storage:   nats.FileStorage,
+		Retention: nats.InterestPolicy,
+	})
+	require_NoError(t, err)
+	_, err = js.AddConsumer("TEST", &nats.ConsumerConfig{Durable: "C", AckPolicy: nats.AckExplicitPolicy})
+	require_NoError(t, err)
+
+	const numMsgs = 3
+	for range numMsgs {
+		_, err = js.Publish("foo", []byte("msg"))
+		require_NoError(t, err)
+	}
+	sub, err := js.PullSubscribe("foo", "C")
+	require_NoError(t, err)
+	msgs, err := sub.Fetch(numMsgs)
+	require_NoError(t, err)
+	for _, m := range msgs {
+		require_NoError(t, m.AckSync())
+	}
+
+	mset, err := s.GlobalAccount().lookupStream("TEST")
+	require_NoError(t, err)
+	checkFor(t, 2*time.Second, 50*time.Millisecond, func() error {
+		if state := mset.state(); state.Msgs != 0 {
+			return fmt.Errorf("expected acked messages to be removed, got %d", state.Msgs)
+		}
+		return nil
+	})
+
+	// Checking interest on the full store leaves the consumer's check floor
+	// past the last message, as when a replicated stream starts up.
+	mset.checkInterestState()
+
+	// Recovery truncates the store to replay the Raft log, while the
+	// consumer's ack and check floors are still at the last message.
+	require_NoError(t, mset.prepareForWALReplay(nil))
+	require_Equal(t, mset.lastSeq(), 0)
+
+	// A leader change checks interest before the replay has caught up. It
+	// must not compact the store past the messages that are still to come.
+	mset.checkInterestState()
+	require_Equal(t, mset.state().LastSeq, 0)
+	for seq := uint64(1); seq <= numMsgs; seq++ {
+		require_NoError(t, mset.store.StoreRawMsg("foo", nil, []byte("msg"), seq, time.Now().UnixNano(), 0, false))
+	}
+	require_Equal(t, mset.state().LastSeq, numMsgs)
+}
+
 func TestJetStreamClusterPrepareForWALReplayTruncatesStore(t *testing.T) {
 	s := RunBasicJetStreamServer(t)
 	defer s.Shutdown()
```

**File**: `server/jetstream_test.go` (modified, +31/-0)
```diff
@@ -27305,3 +27305,34 @@ func TestJetStreamDynamicMaxStoreStableAcrossRestart(t *testing.T) {
 			friendlyBytes(int64(written)), friendlyBytes(before), friendlyBytes(after))
 	}
 }
+
+func TestJetStreamInterestCheckWithoutConsumersDoesNotCompact(t *testing.T) {
+	s := RunBasicJetStreamServer(t)
+	defer s.Shutdown()
+
+	nc, js := jsClientConnect(t, s)
+	defer nc.Close()
+
+	_, err := js.AddStream(&nats.StreamConfig{
+		Name:      "TEST",
+		Subjects:  []string{"foo"},
+		Storage:   nats.FileStorage,
+		Retention: nats.InterestPolicy,
+	})
+	require_NoError(t, err)
+
+	mset, err := s.GlobalAccount().lookupStream("TEST")
+	require_NoError(t, err)
+	const numMsgs = 3
+	for range numMsgs {
+		_, _, err = mset.store.StoreMsg("foo", nil, []byte("msg"), 0)
+		require_NoError(t, err)
+	}
+
+	// Without consumers there is no ack floor to compact to.
+	mset.checkInterestState()
+	state := mset.state()
+	require_Equal(t, state.Msgs, numMsgs)
+	require_Equal(t, state.FirstSeq, 1)
+	require_Equal(t, state.LastSeq, numMsgs)
+}
```

**File**: `server/stream.go` (modified, +2/-1)
```diff
@@ -8998,8 +8998,9 @@ func (mset *stream) checkInterestState() {
 	rp := mset.cfg.Retention
 	mset.cfgMu.RUnlock()
 	// Remove as many messages from the "head" of the stream if there's no interest anymore.
+	// Only compact up to the current stream state, consumers may be ahead while replaying.
 	if rp == InterestPolicy && asflr != math.MaxUint64 {
-		mset.store.Compact(asflr)
+		mset.store.Compact(min(asflr, ss.LastSeq+1))
 	}
 }
 
```

---

### Incident Patch 13: `c04355b9` (2026-10-03)
**Commit Message**: JetStream meta monitor panic on shutdown right after start

monitorCluster read its raft node and its qch/stopped channels back from
js.cluster when it first ran, but shutdownJetStream clears those fields.
A clustered server shut down before the spawned monitor first ran could
crash the process: a nil pointer dereference on v2.15.x, and on main a
10s stall in Shutdown followed by "close of nil channel".

setupMetaGroup now passes the node and the channels it created to the
monitor, and closes stopped itself when the monitor is never started
because the server is already shutting down.

Signed-off-by: Seena Fallah <[REDACTED_EMAIL]>

**File**: `server/jetstream_cluster.go` (modified, +14/-18)
```diff
@@ -1427,6 +1427,7 @@ func (js *jetStream) setupMetaGroup() error {
 	}
 
 	c := s.createInternalJetStreamClient()
+	qch, stopped := make(chan struct{}), make(chan struct{})
 
 	js.mu.Lock()
 	defer js.mu.Unlock()
@@ -1435,8 +1436,8 @@ func (js *jetStream) setupMetaGroup() error {
 		streams: make(map[string]map[string]*streamAssignment),
 		s:       s,
 		c:       c,
-		qch:     make(chan struct{}),
-		stopped: make(chan struct{}),
+		qch:     qch,
+		stopped: stopped,
 	}
 	atomic.StoreInt32(&js.clustered, 1)
 	c.registerWithAccount(sysAcc)
@@ -1447,13 +1448,18 @@ func (js *jetStream) setupMetaGroup() error {
 
 	// Set to true before we start.
 	js.metaRecovering = true
-	js.srv.startGoRoutine(
-		js.monitorCluster,
+	// Pass the node and channels to the monitor, shutdownJetStream can clear
+	// them from js.cluster before the monitor goroutine first runs.
+	if !js.srv.startGoRoutine(
+		func() { js.monitorCluster(n, qch, stopped) },
 		pprofLabels{
 			"type":    "metaleader",
 			"account": sysAcc.Name,
 		},
-	)
+	) {
+		// Shutting down, shutdownJetStream must not wait for a monitor that never ran.
+		close(stopped)
+	}
 	return nil
 }
 
@@ -1953,16 +1959,6 @@ func (js *jetStream) clusterQuitC() chan struct{} {
 	return nil
 }
 
-// Return the cluster stopped chan.
-func (js *jetStream) clusterStoppedC() chan struct{} {
-	js.mu.RLock()
-	defer js.mu.RUnlock()
-	if js.cluster != nil {
-		return js.cluster.stopped
-	}
-	return nil
-}
-
 // Mark that the meta layer is recovering.
 func (js *jetStream) setMetaRecovering() {
 	js.mu.Lock()
@@ -2169,9 +2165,9 @@ func (js *jetStream) getOrphans() (streams []*stream, consumers []*consumer) {
 	return streams, consumers
 }
 
-func (js *jetStream) monitorCluster() {
-	s, n := js.server(), js.getMetaGroup()
-	qch, stopped, rqch, lch, aq := js.clusterQuitC(), js.clusterStoppedC(), n.QuitC(), n.LeadChangeC(), n.ApplyQ()
+func (js *jetStream) monitorCluster(n RaftNode, qch, stopped chan struct{}) {
+	s := js.server()
+	rqch, lch, aq := n.QuitC(), n.LeadChangeC(), n.ApplyQ()
 
 	defer s.grWG.Done()
 	defer close(stopped)
```

**File**: `server/jetstream_cluster_4_test.go` (modified, +58/-0)
```diff
@@ -12085,3 +12085,61 @@ func TestJetStreamClusterRestoreFailureDoesNotDeleteReplacement(t *testing.T) {
 	require_NoError(t, err)
 	require_Equal(t, string(msg.Data), "restored message")
 }
+
+func TestJetStreamClusterMetaMonitorShutdownRightAfterStart(t *testing.T) {
+	// The meta monitor goroutine can first run after shutdownJetStream has
+	// cleared the meta group state, which used to crash a clustered server
+	// shut down right after it started. A single proc makes that likely.
+	defer runtime.GOMAXPROCS(runtime.GOMAXPROCS(1))
+
+	for r := range 25 {
+		var wg sync.WaitGroup
+		for i := range 32 {
+			wg.Add(1)
+			go func() {
+				defer wg.Done()
+				o := DefaultTestOptions
+				o.Port = -1
+				o.ServerName = fmt.Sprintf("S-%d-%d", r, i)
+				o.JetStream = true
+				o.StoreDir = t.TempDir()
+				o.Cluster.Name = "R1S"
+				o.Cluster.Host = o.Host
+				o.Cluster.Port = -1
+				// Clustered JetStream requires a route, nothing needs to listen on it.
+				o.Routes = RoutesFromStr("nats://127.0.0.1:1")
+				s := RunServer(&o)
+				start := time.Now()
+				s.Shutdown()
+				if elapsed := time.Since(start); elapsed > 5*time.Second {
+					t.Errorf("Shutdown of %s took %v", o.ServerName, elapsed)
+				}
+			}()
+		}
+		wg.Wait()
+	}
+}
+
+func TestJetStreamClusterMetaMonitorNotStartedShutdown(t *testing.T) {
+	o := DefaultTestOptions
+	o.Port = -1
+	o.JetStream = true
+	o.StoreDir = t.TempDir()
+	s := RunServer(&o)
+	defer s.Shutdown()
+
+	// Set up the meta group after a Shutdown has stopped new goroutines from
+	// starting, so the meta monitor is never started. No cluster block is
+	// needed since setupMetaGroup is called directly.
+	s.grMu.Lock()
+	s.grRunning = false
+	s.grMu.Unlock()
+	require_NoError(t, s.getJetStream().setupMetaGroup())
+
+	// Must not wait for a monitor that is not running.
+	start := time.Now()
+	s.shutdownJetStream()
+	if elapsed := time.Since(start); elapsed > 5*time.Second {
+		t.Fatalf("shutdownJetStream took %v", elapsed)
+	}
+}
```

---

### Incident Patch 14: `9aead5b1` (2026-10-05)
**Commit Message**: Fix cleanup after failed clustered stream restores (#8702)

Fix two issues after a failed clustered restore:

- A delayed restore failure could delete a stream that was meantime
recreated
- `stream rm` can delete the stream without replying

Make sure the former leader of an already deleted node still reply , and
require explicit `stream rm` cleanup after restore failures.

Fixes #8687

**File**: `server/jetstream_cluster.go` (modified, +8/-1)
```diff
@@ -7178,6 +7178,11 @@ func (js *jetStream) processStreamRemoval(sa *streamAssignment) {
 	needDelete := accStreams != nil && accStreams[stream] != nil
 	if needDelete {
 		osa := accStreams[stream]
+		if osa.Group != nil && osa.Group.node != nil {
+			// Check if we were leader of a node that was already deleted
+			n := osa.Group.node
+			wasLeader = wasLeader || (n.IsDeleted() && n.GroupLeader() == n.ID())
+		}
 		if osa.unsupported != nil {
 			osa.unsupported.closeInfoSub(js.srv)
 			// Remember we used to be unsupported, just so we can send a successful delete response.
@@ -9268,7 +9273,9 @@ func (js *jetStream) processStreamAssignmentResults(sub *subscription, c *client
 	}
 
 	if sa := js.streamAssignmentOrInflight(result.Account, result.Stream); sa != nil && !sa.reassigning {
-		canDelete := !result.Update && time.Since(sa.Created) < 5*time.Second
+		// A delayed restore failure may refer to an earlier assignment with the same name.
+		// Leave failed restore assignments for explicit cleanup.
+		canDelete := !result.Update && result.Restore == nil && time.Since(sa.Created) < 5*time.Second
 
 		// See if we should retry in case this cluster is full but there are others.
 		if cfg, ci := sa.Config, sa.Client; cfg != nil && ci != nil && isInsufficientResourcesErr(result.Response) && canDelete {
```

**File**: `server/jetstream_cluster_4_test.go` (modified, +146/-0)
```diff
@@ -11841,6 +11841,42 @@ func TestJetStreamClusterSetPreferredMember(t *testing.T) {
 	require_Len(t, len(seen), 3)
 }
 
+func TestJetStreamClusterStreamDeleteAfterRestoreStall(t *testing.T) {
+	c := createJetStreamClusterExplicit(t, "R3S", 3)
+	defer c.shutdown()
+	l := &captureWarnLogger{warn: make(chan string, 16)}
+	for _, s := range c.servers {
+		s.SetLogger(l, false, false)
+	}
+	nc, js := jsClientConnect(t, c.randomServer())
+	defer nc.Close()
+
+	r, err := nc.Request(fmt.Sprintf(JSApiStreamRestoreT, "TEST"),
+		[]byte(`{"config":{"name":"TEST","num_replicas":3,"storage":"file"}}`), 5*time.Second)
+	require_NoError(t, err)
+	var resp JSApiStreamRestoreResponse
+	require_NoError(t, json.Unmarshal(r.Data, &resp))
+	require_Equal(t, resp.Type, JSApiStreamRestoreResponseType)
+	require_True(t, resp.Error == nil && resp.DeliverSubject != _EMPTY_)
+
+	// Send no chunks. Wait for the watchdog to fail the restore and stop its leader.
+	deadline := time.After(10 * time.Second)
+waitForStall:
+	for {
+		select {
+		case warning := <-l.warn:
+			if strings.Contains(warning, "Stream restore failed for") && strings.Contains(warning, "is stalled") {
+				break waitForStall
+			}
+		case <-deadline:
+			t.Fatal("restore did not stall")
+		}
+	}
+
+	// Deleting the failed assignment must reply even though its leader has stopped.
+	require_NoError(t, js.DeleteStream("TEST", nats.MaxWait(time.Second)))
+}
+
 // Non-preferred restore members must wait for the preferred receiver to start.
 // After it starts, a real snapshot must restore and all replicas must catch up.
 func TestJetStreamClusterRestoreWaitsForPreferredReceiver(t *testing.T) {
@@ -11939,3 +11975,113 @@ func TestJetStreamClusterRestoreWaitsForPreferredReceiver(t *testing.T) {
 	require_NoError(t, err)
 	require_Equal(t, string(message.Data), "restored message")
 }
+
+type delayedRestoreFailureLogger struct {
+	DummyLogger
+	sawFailure    atomic.Bool
+	failurePaused chan struct{}
+	monitorExited chan struct{}
+	resumeFailure <-chan struct{}
+}
+
+func (l *delayedRestoreFailureLogger) Debugf(format string, _ ...any) {
+	switch format {
+	case "Stream restore failed: %v":
+		if l.sawFailure.CompareAndSwap(false, true) {
+			l.failurePaused <- struct{}{}
+			<-l.resumeFailure
+		}
+	case "Exiting stream monitor for '%s > %s' [%s]":
+		if l.sawFailure.Load() {
+			select {
+			case l.monitorExited <- struct{}{}:
+			default:
+			}
+		}
+	}
+}
+
+func TestJetStreamClusterRestoreFailureDoesNotDeleteReplacement(t *testing.T) {
+	// Create a snapshot to restore into the cluster.
+	source := RunBasicJetStreamServer(t)
+	defer source.Shutdown()
+	sourceNC, sourceJS := jsClientConnect(t, source)
+	defer sourceNC.Close()
+	_, err := sourceJS.AddStream(&nats.StreamConfig{Name: "TEST"})
+	require_NoError(t, err)
+	_, err = sourceJS.Publish("TEST", []byte("restored message"))
+	require_NoError(t, err)
+	cfg, state, snapshot := performStreamBackup(t, sourceNC, "TEST")
+	cfg.Replicas = 3
+
+	c := createJetStreamClusterExplicit(t, "R3S", 3)
+	defer c.shutdown()
+
+	// Pause the failed restore before it deletes its Raft node or sends its failure report.
+	failurePaused := make(chan struct{}, 1)
+	monitorExited := make(chan struct{}, 1)
+	resumeFailure := make(chan struct{})
+	resumeFailureHandling := sync.OnceFunc(func() { close(resumeFailure) })
+	defer resumeFailureHandling()
+	for _, s := range c.servers {
+		s.SetLogger(&delayedRestoreFailureLogger{
+			failurePaused: failurePaused,
+			monitorExited: monitorExited,
+			resumeFailure: resumeFailure,
+		}, true, false)
+	}
+	nc, js := jsClientConnect(t, c.randomServer())
+	defer nc.Close()
+
+	req, err := json.Marshal(&JSApiStreamRestoreRequest{Config: cfg, State: state})
+	require_NoError(t, err)
+	_, err = nc.Request(fmt.Sprintf(JSApiStreamRestoreT, cfg.Name), req, 5*time.Second)
+	require_NoError(t, err)
+
+	// Send no chunks so the first restore stalls.
+	select {
+	case <-failurePaused:
+	case <-time.After(10 * time.Second):
+		t.Fatal("restore did not stall")
+	}
+
+	// Delete the failed attempt, then restore the snapshot under the same name.
+	require_NoError(t, js.DeleteStream(cfg.Name))
+	deletionAdvisories, err := nc.SubscribeSync(JSAdvisoryStreamDeletedPre + "." + cfg.Name)
+	require_NoError(t, err)
+
+	require_True(t, performStreamRestore(t, nc, cfg, state, snapshot))
+	checkFor(t, 30*time.Second, 10*time.Millisecond, func() error {
+		si, err := js.StreamInfo(cfg.Name)
+		if err != nil {
+			return err
+		}
+		if si.State.Msgs != state.Msgs || si.Cluster == nil || len(si.Cluster.Replicas) != 2 {
+			return fmt.Errorf("replacement not restored: %+v", si)
+		}
+		for _, peer := range si.Cluster.Replicas {
+			if !peer.Current {
+				return fmt.Errorf("replica %s not current", peer.Name)
+			}
+		}
+		return nil
+	})
+
+	// Let the original restore report its failure after the replacement is current.
+	resumeFailureHandling()
+	select {
+	case <-monitorExited:
+	case <-time.After(5 * time.Second):
+		t.Fatal("f
```

---

### Incident Patch 15: `7c94ea63` (2026-10-02)
**Commit Message**: [FIXED] Make stream restore failure cleanup explicit

Require an explicit stream delete after a failed restore, preventing
delayed failure reports from deleting recreated streams.

Signed-off-by: Daniele Sciascia <[REDACTED_EMAIL]>

**File**: `server/jetstream_cluster.go` (modified, +3/-1)
```diff
@@ -9273,7 +9273,9 @@ func (js *jetStream) processStreamAssignmentResults(sub *subscription, c *client
 	}
 
 	if sa := js.streamAssignmentOrInflight(result.Account, result.Stream); sa != nil && !sa.reassigning {
-		canDelete := !result.Update && time.Since(sa.Created) < 5*time.Second
+		// A delayed restore failure may refer to an earlier assignment with the same name.
+		// Leave failed restore assignments for explicit cleanup.
+		canDelete := !result.Update && result.Restore == nil && time.Since(sa.Created) < 5*time.Second
 
 		// See if we should retry in case this cluster is full but there are others.
 		if cfg, ci := sa.Config, sa.Client; cfg != nil && ci != nil && isInsufficientResourcesErr(result.Response) && canDelete {
```

**File**: `server/jetstream_cluster_4_test.go` (modified, +110/-0)
```diff
@@ -11975,3 +11975,113 @@ func TestJetStreamClusterRestoreWaitsForPreferredReceiver(t *testing.T) {
 	require_NoError(t, err)
 	require_Equal(t, string(message.Data), "restored message")
 }
+
+type delayedRestoreFailureLogger struct {
+	DummyLogger
+	sawFailure    atomic.Bool
+	failurePaused chan struct{}
+	monitorExited chan struct{}
+	resumeFailure <-chan struct{}
+}
+
+func (l *delayedRestoreFailureLogger) Debugf(format string, _ ...any) {
+	switch format {
+	case "Stream restore failed: %v":
+		if l.sawFailure.CompareAndSwap(false, true) {
+			l.failurePaused <- struct{}{}
+			<-l.resumeFailure
+		}
+	case "Exiting stream monitor for '%s > %s' [%s]":
+		if l.sawFailure.Load() {
+			select {
+			case l.monitorExited <- struct{}{}:
+			default:
+			}
+		}
+	}
+}
+
+func TestJetStreamClusterRestoreFailureDoesNotDeleteReplacement(t *testing.T) {
+	// Create a snapshot to restore into the cluster.
+	source := RunBasicJetStreamServer(t)
+	defer source.Shutdown()
+	sourceNC, sourceJS := jsClientConnect(t, source)
+	defer sourceNC.Close()
+	_, err := sourceJS.AddStream(&nats.StreamConfig{Name: "TEST"})
+	require_NoError(t, err)
+	_, err = sourceJS.Publish("TEST", []byte("restored message"))
+	require_NoError(t, err)
+	cfg, state, snapshot := performStreamBackup(t, sourceNC, "TEST")
+	cfg.Replicas = 3
+
+	c := createJetStreamClusterExplicit(t, "R3S", 3)
+	defer c.shutdown()
+
+	// Pause the failed restore before it deletes its Raft node or sends its failure report.
+	failurePaused := make(chan struct{}, 1)
+	monitorExited := make(chan struct{}, 1)
+	resumeFailure := make(chan struct{})
+	resumeFailureHandling := sync.OnceFunc(func() { close(resumeFailure) })
+	defer resumeFailureHandling()
+	for _, s := range c.servers {
+		s.SetLogger(&delayedRestoreFailureLogger{
+			failurePaused: failurePaused,
+			monitorExited: monitorExited,
+			resumeFailure: resumeFailure,
+		}, true, false)
+	}
+	nc, js := jsClientConnect(t, c.randomServer())
+	defer nc.Close()
+
+	req, err := json.Marshal(&JSApiStreamRestoreRequest{Config: cfg, State: state})
+	require_NoError(t, err)
+	_, err = nc.Request(fmt.Sprintf(JSApiStreamRestoreT, cfg.Name), req, 5*time.Second)
+	require_NoError(t, err)
+
+	// Send no chunks so the first restore stalls.
+	select {
+	case <-failurePaused:
+	case <-time.After(10 * time.Second):
+		t.Fatal("restore did not stall")
+	}
+
+	// Delete the failed attempt, then restore the snapshot under the same name.
+	require_NoError(t, js.DeleteStream(cfg.Name))
+	deletionAdvisories, err := nc.SubscribeSync(JSAdvisoryStreamDeletedPre + "." + cfg.Name)
+	require_NoError(t, err)
+
+	require_True(t, performStreamRestore(t, nc, cfg, state, snapshot))
+	checkFor(t, 30*time.Second, 10*time.Millisecond, func() error {
+		si, err := js.StreamInfo(cfg.Name)
+		if err != nil {
+			return err
+		}
+		if si.State.Msgs != state.Msgs || si.Cluster == nil || len(si.Cluster.Replicas) != 2 {
+			return fmt.Errorf("replacement not restored: %+v", si)
+		}
+		for _, peer := range si.Cluster.Replicas {
+			if !peer.Current {
+				return fmt.Errorf("replica %s not current", peer.Name)
+			}
+		}
+		return nil
+	})
+
+	// Let the original restore report its failure after the replacement is current.
+	resumeFailureHandling()
+	select {
+	case <-monitorExited:
+	case <-time.After(5 * time.Second):
+		t.Fatal("failed restore monitor did not exit")
+	}
+
+	// The replacement stream should not be deleted
+	_, err = deletionAdvisories.NextMsg(time.Second)
+	if err == nil {
+		t.Fatal("replacement was deleted after the delayed restore failure")
+	}
+	require_Error(t, err, nats.ErrTimeout)
+	msg, err := js.GetMsg(cfg.Name, 1)
+	require_NoError(t, err)
+	require_Equal(t, string(msg.Data), "restored message")
+}
```

#### Recent Merged Pull Requests:
- **PR #8714** (2026-10-05): (2.14) [FIXED] Fast batch ping could start a new batch (@MauriceVanVeen)
- **PR #8712** (2026-10-05): De-flake TestNoRaceWSNoCorruptionWithFrameSizeLimit (@pat-s)
- **PR #8710** (2026-10-05): (2.15) [FIXED] Interest check compacting a stream past its last sequence (@pat-s)
- **PR #8707** (2026-10-05): [FIXED] JetStream meta monitor panic on shutdown right after start (@clwluvw)
- **PR #8703** (2026-10-05): De-flake various tests (@MauriceVanVeen)
- **PR #8702** (2026-10-05): Fix cleanup after failed clustered stream restores (@sciascid)
- **PR #8701** (2026-10-02): [ADDED] TLS for leafnode remote https proxies (@MauriceVanVeen)
- **PR #8699** (2026-10-02): (2.14) [IMPROVED] Report backward gaps in fast batch publish (@MauriceVanVeen)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

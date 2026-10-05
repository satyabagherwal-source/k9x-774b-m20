# Forensic Learning Record (Deep Inspection): slatedb/slatedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/slatedb-slatedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/slatedb/slatedb](https://github.com/slatedb/slatedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:18:42.214Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `slatedb/slatedb`
- **Description**: A cloud native embedded storage engine built on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3457 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bindings/go/uniffi/cgo_flags.go`
```
package slatedb

/*
#cgo LDFLAGS: -lslatedb_uniffi
*/
import "C"

```

### Core Architecture Module: `bindings/go/uniffi/doc.go`
```
// Package slatedb exposes SlateDB's UniFFI-generated Go bindings.
//
// The package import path is:
//
//	import "slatedb.io/slatedb-go/uniffi"
//
// The package name is `slatedb`. The API is intentionally close to the Rust
// UniFFI surface rather than a fully idiomatic handwritten Go wrapper, so most
// types, option structs, and lifecycle methods map directly to the underlying
// SlateDB API.
//
// # Runtime Requirements
//
// This package uses cgo and links against the shared library produced by the
// repository's `slatedb-uniffi` crate. To build and run code that imports this
// package you need:
//
//   - Go 1.25 or newer
//   - `CGO_ENABLED=1`
//   - a working C toolchain
//   - the `slatedb_uniffi` shared library available to the platform loader
//
// During local development that usually means building the Rust shared library
// from the repository and adding `target/debug` or `target/release` to
// `LD_LIBRARY_PATH` on Linux or `DYLD_LIBRARY_PATH` on macOS.
//
// # Opening A Database
//
// Most programs start by constructing an [ObjectStore], then using a
// [DbBuilder] to open a writable [Db]:
//
//	store, err := slatedb.ObjectStoreResolve("memory:///")
//	if err != nil {
//		panic(err)
//	}
//	defer store.Destroy()
//
//	builder := slatedb.NewDbBuilder("example-db", store)
//	defer builder.Destroy()
//
//	db, err := builder.Build()
//	if err != nil {
//		panic(err)
//	}
//	defer db.Destroy()
//
//	if _, err := db.Put([]byte("hello"), []byte("world")); err != nil {
//		panic(err)
//	}
//
//	value, err := db.Get([]byte("hello"))
//	if err != nil {
//		panic(err)
//	}
//	if value != nil {
//		println(string(*value))
//	}
//
//	if err := db.Shutdown(); err != nil {
//		panic(err)
//	}
//
// [ObjectStoreResolve] accepts SlateDB object-store URLs such as `memory:///`.
// [ObjectStoreFromEnv] builds a store from environment-driven configuration.
//
// [DbBuilder] is the main entry point for writable databases. It can be
// customized with methods such as [DbBuilder.WithSettings],
// [DbBuilder.WithMergeOperator], [DbBuilder.WithSstBlockSize],
// [DbBuilder.WithWalObjectStore], and [DbBuilder.WithDbCacheDisabled] before
// calling [DbBuilder.Build].
//
// # Reading Data
//
// [Db], [DbReader], and [DbSnapshot] all support point reads and range scans.
// Point reads use [Db.Get], [DbReader.Get], or [DbSnapshot.Get]. When callers
// need row metadata such as sequence number or timestamps they can use the
// corresponding `GetKeyValue` variants, which return [KeyValue].
//
// Range and prefix queries use [KeyRange], [Db.Scan], [Db.ScanPrefix],
// [DbReader.Scan], [DbSnapshot.Scan], and the related `WithOptions` methods.
// These APIs return a [DbIterator]. Repeated calls to [DbIterator.Next] return
// rows in order until `nil` is returned, which signals end of iteration.
// [DbIterator.Seek] repositions an iterator to the first row at or after a key.
//
// [ReadOptions] and [ScanOptions] let callers tune visibility and performance,
// including durability filtering, dirty-read behavior, read-ahead, cache
// insertion, and scan fetch parallelism.
//
// For long-lived read-only access, open a [DbReader] with
// [NewDbReaderBuilder]. A reader's state selection can be configured with
// [DbReaderBuilder.WithReaderMode] and [ReaderMode]. It can also be configured
// with [ReaderOptions] and given a [MergeOperator] for merge-aware reads.
//
// [Db.Snapshot] creates a consistent read-only [DbSnapshot] from a writable
// database handle.
//
// # Writing Data
//
// The writable [Db] exposes single-key operations such as [Db.Put],
// [Db.Delete], and [Db.Merge], plus batch and durability controls through
// [PutOptions], [MergeOptions], [WriteOptions], and [FlushOptions].
//
// [WriteHandle] reports metadata assigned to a successful write and exposes
// [WriteHandle.AwaitDurable] for waiting until that specific write is durable.
//
// [WriteBatch] collects multiple mutations and applies them atomically through
// [Db.Write] or [Db.WriteWithOptions]. Batches are single-use once submitted.
//
// TTL behavior is configured with [Ttl] implementations such as [TtlDefault],
// [TtlNoExpiry], and [TtlExpireAfterMillis].
//
// # Transactions
//
// [Db.Begin] opens a [DbTransaction] at a chosen [IsolationLevel].
// Transactions support reads, scans, puts, deletes, merges, read marking for
// conflict detection, and either [DbTransaction.Commit] or
// [DbTransaction.Rollback]. A committed transaction returns a [WriteHandle] or
// `nil` if it performed no writes.
//
// A transaction is no longer usable after commit or rollback.
//
// # Configuration, Metrics, And Callbacks
//
// [Settings] is a mutable configuration object for [DbBuilder]. It can be
// created from defaults, environment variables, files, or JSON strings with
// [SettingsDefault], [SettingsFromEnv], [SettingsFromFile],
// [SettingsFromJsonString], and [SettingsLoad]. [Settings.Set] updates fields
// by dotted path using JSON literal values, and [Settings.ToJsonString]
// serializes the resulting configuration.
//
// A writable [Db] also exposes [Db.Status], [Db.Metrics], [Db.Flush], and
// [Db.FlushWithOptions] for health checks, instrumentation, and manual flushes.
//
// Custom merge logic is supplied through the [MergeOperator] callback
// interface. Rust-side logging can be forwarded into Go code with
// [InitLogging] and a [LogCallback].
//
// # Change Data Capture
//
// [NewSlateDbWalReader] opens a [SlateDbWalReader] for live WAL streaming.
// Call [SlateDbWalReader.Iterator] once with the first unconsumed WAL file ID,
// then keep calling [SlateDbWalIterator.Next]. The iterator waits and polls
// internally at the current tail. Persist every [WalRows.LastConsumedWalFileId],
// including empty fence batches, and resume from the following ID after a
// restart. [SlateDbWalReader.LastWalFileId] is available when a snapshot of the
// current tail is useful, but is not needed to drive the stream.
//
// # Errors
//
// Most fallible operations return a Go `error` whose concrete type unwraps to
// [Error]. Callers can use `errors.Is` with the exported sentinels
// [ErrErrorTransaction], [ErrErrorClosed], [ErrErrorUnavailable],
// [ErrErrorInvalid], [ErrErrorData], and [ErrErrorInternal] to branch on broad
// error categories.
//
// For example, invalid keys, malformed ranges, and reusing consumed objects
// typically surface as [ErrErrorInvalid]. Operations on closed handles surface
// as [ErrErrorClosed].
//
// # Resource Management
//
// Most exported handle types own a Rust-side resource and provide an explicit
// `Destroy` method, including [ObjectStore], [DbBuilder], [Db], [DbReader],
// [DbSnapshot], [DbTransaction], [DbIterator], [SlateDbWalReader],
// [SlateDbWalIterator], [Settings], and [WriteBatch].
//
// These handles install Go finalizers, but callers should not rely on garbage
// collection for timely cleanup. Prefer calling `Destroy` explicitly when a
// handle is no longer needed. For [Db] and [DbReader], call `Shutdown` first to
// close the database or reader cleanly, then call `Destroy` to release the Go
// binding handle.
//
// Builders are single-use after `Build`. [WriteBatch] is single-use after
// `Write`. Bounded iterator `Next` methods return `nil` when exhausted; the live
// [SlateDbWalIterator] instead waits at the current tail. Transaction commit
// methods may return `nil` when no write was emitted.
package slatedb

```

### Core Architecture Module: `bindings/go/uniffi/slatedb.go`
```
package slatedb

// #include <slatedb.h>
import "C"

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"reflect"
	"runtime"
	"runtime/cgo"
	"sync"
	"sync/atomic"
	"unsafe"
)

// This is needed, because as of go 1.24
// type RustBuffer C.RustBuffer cannot have methods,
// RustBuffer is treated as non-local type
type GoRustBuffer struct {
	inner C.RustBuffer
}

type RustBufferI interface {
	AsReader() *bytes.Reader
	Free()
	ToGoBytes() []byte
	Data() unsafe.Pointer
	Len() uint64
	Capacity() uint64
}

// C.RustBuffer fields exposed as an interface so they can be accessed in different Go packages.
// See https://github.com/golang/go/issues/13467
type ExternalCRustBuffer interface {
	Data() unsafe.Pointer
	Len() uint64
	Capacity() uint64
}

func RustBufferFromC(b C.RustBuffer) ExternalCRustBuffer {
	return GoRustBuffer{
		inner: b,
	}
}

func CFromRustBuffer(b ExternalCRustBuffer) C.RustBuffer {
	return C.RustBuffer{
		capacity: C.uint64_t(b.Capacity()),
		len:      C.uint64_t(b.Len()),
		data:     (*C.uchar)(b.Data()),
	}
}

func RustBufferFromExternal(b ExternalCRustBuffer) GoRustBuffer {
	return GoRustBuffer{
		inner: C.RustBuffer{
			capacity: C.uint64_t(b.Capacity()),
			len:      C.uint64_t(b.Len()),
			data:     (*C.uchar)(b.Data()),
		},
	}
}

func (cb GoRustBuffer) Capacity() uint64 {
	return uint64(cb.inner.capacity)
}

func (cb GoRustBuffer) Len() uint64 {
	return uint64(cb.inner.len)
}

func (cb GoRustBuffer) Data() unsafe.Pointer {
	return unsafe.Pointer(cb.inner.data)
}

func (cb GoRustBuffer) AsReader() *bytes.Reader {
	b := unsafe.Slice((*byte)(cb.inner.data), C.uint64_t(cb.inner.len))
	return bytes.NewReader(b)
}

func (cb GoRustBuffer) Free() {
	rustCall(func(status *C.RustCallStatus) bool {
		C.ffi_slatedb_uniffi_rustbuffer_free(cb.inner, status)
		return false
	})
}

func (cb GoRustBuffer) ToGoBytes() []byte {
	return C.GoBytes(unsafe.Pointer(cb.inner.data), C.int(cb.inner.len))
}

func stringToRustBuffer(str string) C.RustBuffer {
	return bytesToRustBuffer([]byte(str))
}

func bytesToRustBuffer(b []byte) C.RustBuffer {
	if len(b) == 0 {
		return C.RustBuffer{}
	}
	// We can pass the pointer along here, as it is pinned
	// for the duration of this call
	foreign := C.ForeignBytes{
		len:  C.int(len(b)),
		data: (*C.uchar)(unsafe.Pointer(&b[0])),
	}

	return rustCall(func(status *C.RustCallStatus) C.RustBuffer {
		return C.ffi_slatedb_uniffi_rustbuffer_from_bytes(foreign, status)
	})
}

type BufLifter[GoType any] interface {
	Lift(value RustBufferI) GoType
}

type BufLowerer[GoType any] interface {
	Lower(value GoType) C.RustBuffer
}

type BufReader[GoType any] interface {
	Read(reader io.Reader) GoType
}

type BufWriter[GoType any] interface {
	Write(writer io.Writer, value GoType)
}

func LowerIntoRustBuffer[GoType any](bufWriter BufWriter[GoType], value GoType) C.RustBuffer {
	// This might be not the most efficient way but it does not require knowing allocation size
	// beforehand
	var buffer bytes.Buffer
	bufWriter.Write(&buffer, value)

	bytes, err := io.ReadAll(&buffer)
	if err != nil {
		panic(fmt.Errorf("reading written data: %w", err))
	}
	return bytesToRustBuffer(bytes)
}

func LiftFromRustBuffer[GoType any](bufReader BufReader[GoType], rbuf RustBufferI) GoType {
	defer rbuf.Free()
	reader := rbuf.AsReader()
	item := bufReader.Read(reader)
	if reader.Len() > 0 {
		// TODO: Remove this
		leftover, _ := io.ReadAll(reader)
		panic(fmt.Errorf("Junk remaining in buffer after lifting: %s", string(leftover)))
	}
	return item
}

func rustCallWithError[E any, U any](converter BufReader[E], callback func(*C.RustCallStatus) U) (U, E) {
	var status C.RustCallStatus
	returnValue := callback(&status)
	err := checkCallStatus(converter, status)
	return returnValue, err
}

func checkCallStatus[E any](converter BufReader[E], status C.RustCallStatus) E {
	switch status.code {
	case 0:
		var zero E
		return zero
	case 1:
		return LiftFromRustBuffer(converter, GoRustBuffer{inner: status.errorBuf})
	case 2:
		// when the rust code sees a panic, it tries to construct a rustBuffer
		// with the message.  but if that code panics, then it just sends back
		// an empty buffer.
		if status.errorBuf.len > 0 {
			panic(fmt.Errorf("%s", FfiConverterStringINSTANCE.Lift(GoRustBuffer{inner: status.errorBuf})))
		} else {
			panic(fmt.Errorf("Rust panicked while handling Rust panic"))
		}
	default:
		panic(fmt.Errorf("unknown status code: %d", status.code))
	}
}

func checkCallStatusUnknown(status C.RustCallStatus) error {
	switch status.code {
	case 0:
		return nil
	case 1:
		panic(fmt.Errorf("function not returning an error returned an error"))
	case 2:
		// when the rust code sees a panic, it tries to construct a C.RustBuffer
		// with the message.  but if that code panics, then it just sends back
		// an empty buffer.
		if status.errorBuf.len > 0 {
			panic(fmt.Errorf("%s", FfiConverterStringINSTANCE.Lift(GoRustBuffer{
				inner: status.errorBuf,
			})))
		} else {
			panic(fmt.Errorf("Rust panicked while handling Rust panic"))
		}
	default:
		return fmt.Errorf("unknown status code: %d", status.code)
	}
}

func rustCall[U any](callback func(*C.RustCallStatus) U) U {
	returnValue, err := rustCallWithError[error](nil, callback)
	if err != nil {
		panic(err)
	}
	return returnValue
}

type NativeError interface {
	AsError() error
}

func writeInt8(writer io.Writer, value int8) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeUint8(writer io.Writer, value uint8) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeInt16(writer io.Writer, value int16) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeUint16(writer io.Writer, value uint16) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeInt32(writer io.Writer, value int32) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeUint32(writer io.Writer, value uint32) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeInt64(writer io.Writer, value int64) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeUint64(writer io.Writer, value uint64) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeFloat32(writer io.Writer, value float32) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeFloat64(writer io.Writer, value float64) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func readInt8(reader io.Reader) int8 {
	var result int8
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readUint8(reader io.Reader) uint8 {
	var result uint8
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readInt16(reader io.Reader) int16 {
	var result int16
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readUint16(reader io.Reader) uint16 {
	var result uint16
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readInt32(reader io.Reader) int32 {
	var result int32
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readUint32(reader io.Reader) uint32 {
	var result uint32
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readInt64(reader io.Reader) int64 {
	var result int64
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readUint64(reader io.Reader) uint64 {
	var result uint64
	if err := binary.Read(reader, binary
```

### Core Architecture Module: `bindings/go/uniffi/slatedb.h`
```


// This file was autogenerated by some hot garbage in the `uniffi` crate.
// Trust me, you don't want to mess with it!



#include <stdbool.h>
#include <stdint.h>

// The following structs are used to implement the lowest level
// of the FFI, and thus useful to multiple uniffied crates.
// We ensure they are declared exactly once, with a header guard, UNIFFI_SHARED_H.
#ifdef UNIFFI_SHARED_H
	// We also try to prevent mixing versions of shared uniffi header structs.
	// If you add anything to the #else block, you must increment the version suffix in UNIFFI_SHARED_HEADER_V6
	#ifndef UNIFFI_SHARED_HEADER_V6
		#error Combining helper code from multiple versions of uniffi is not supported
	#endif // ndef UNIFFI_SHARED_HEADER_V6
#else
#define UNIFFI_SHARED_H
#define UNIFFI_SHARED_HEADER_V6
// ⚠️ Attention: If you change this #else block (ending in `#endif // def UNIFFI_SHARED_H`) you *must* ⚠️
// ⚠️ increment the version suffix in all instances of UNIFFI_SHARED_HEADER_V6 in this file.           ⚠️

typedef struct RustBuffer {
	uint64_t capacity;
	uint64_t len;
	uint8_t *data;
} RustBuffer;

typedef struct ForeignBytes {
	int32_t len;
	const uint8_t *data;
} ForeignBytes;

// Error definitions
typedef struct RustCallStatus {
	int8_t code;
	RustBuffer errorBuf;
} RustCallStatus;

#endif // UNIFFI_SHARED_H


#ifndef UNIFFI_FFIDEF_RUST_FUTURE_CONTINUATION_CALLBACK
#define UNIFFI_FFIDEF_RUST_FUTURE_CONTINUATION_CALLBACK
typedef void (*UniffiRustFutureContinuationCallback)(uint64_t data, int8_t poll_result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiRustFutureContinuationCallback(
				UniffiRustFutureContinuationCallback cb, uint64_t data, int8_t poll_result)
{
	return cb(data, poll_result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_DROPPED_CALLBACK
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_DROPPED_CALLBACK
typedef void (*UniffiForeignFutureDroppedCallback)(uint64_t handle);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureDroppedCallback(
				UniffiForeignFutureDroppedCallback cb, uint64_t handle)
{
	return cb(handle);
}


#endif
#ifndef UNIFFI_FFIDEF_CALLBACK_INTERFACE_FREE
#define UNIFFI_FFIDEF_CALLBACK_INTERFACE_FREE
typedef void (*UniffiCallbackInterfaceFree)(uint64_t handle);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiCallbackInterfaceFree(
				UniffiCallbackInterfaceFree cb, uint64_t handle)
{
	return cb(handle);
}


#endif
#ifndef UNIFFI_FFIDEF_CALLBACK_INTERFACE_CLONE
#define UNIFFI_FFIDEF_CALLBACK_INTERFACE_CLONE
typedef uint64_t (*UniffiCallbackInterfaceClone)(uint64_t handle);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static uint64_t call_UniffiCallbackInterfaceClone(
				UniffiCallbackInterfaceClone cb, uint64_t handle)
{
	return cb(handle);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_DROPPED_CALLBACK_STRUCT
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_DROPPED_CALLBACK_STRUCT
typedef struct UniffiForeignFutureDroppedCallbackStruct {
    uint64_t handle;
    UniffiForeignFutureDroppedCallback free;
} UniffiForeignFutureDroppedCallbackStruct;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U8
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U8
typedef struct UniffiForeignFutureResultU8 {
    uint8_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultU8;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U8
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U8
typedef void (*UniffiForeignFutureCompleteU8)(uint64_t callback_data, UniffiForeignFutureResultU8 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteU8(
				UniffiForeignFutureCompleteU8 cb, uint64_t callback_data, UniffiForeignFutureResultU8 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I8
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I8
typedef struct UniffiForeignFutureResultI8 {
    int8_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultI8;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I8
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I8
typedef void (*UniffiForeignFutureCompleteI8)(uint64_t callback_data, UniffiForeignFutureResultI8 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteI8(
				UniffiForeignFutureCompleteI8 cb, uint64_t callback_data, UniffiForeignFutureResultI8 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U16
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U16
typedef struct UniffiForeignFutureResultU16 {
    uint16_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultU16;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U16
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U16
typedef void (*UniffiForeignFutureCompleteU16)(uint64_t callback_data, UniffiForeignFutureResultU16 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteU16(
				UniffiForeignFutureCompleteU16 cb, uint64_t callback_data, UniffiForeignFutureResultU16 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I16
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I16
typedef struct UniffiForeignFutureResultI16 {
    int16_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultI16;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I16
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I16
typedef void (*UniffiForeignFutureCompleteI16)(uint64_t callback_data, UniffiForeignFutureResultI16 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteI16(
				UniffiForeignFutureCompleteI16 cb, uint64_t callback_data, UniffiForeignFutureResultI16 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U32
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U32
typedef struct UniffiForeignFutureResultU32 {
    uint32_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultU32;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U32
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U32
typedef void (*UniffiForeignFutureCompleteU32)(uint64_t callback_data, UniffiForeignFutureResultU32 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteU32(
				UniffiForeignFutureCompleteU32 cb, uint64_t callback_data, UniffiForeignFutureResultU32 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I32
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I32
typedef struct UniffiForeignFutureResultI32 {
    int32_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultI32;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I32
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I32
typedef void (*UniffiForeignFutureCompleteI32)(uint64_t callback_data, UniffiForeignFutureResultI32 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteI32(
				UniffiForeignFutureCompleteI32 cb, uint64_t callback_data, UniffiForeignFutureResultI32 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U64
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U64
typedef struct UniffiForeignFutureResultU64 {
    uint64_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultU64;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U64
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U64
typedef void (*UniffiForeignFutureCompl
```

### Core Architecture Module: `bindings/python/slatedb/__init__.py`
```
"""SlateDB Python package."""

```

### Core Architecture Module: `bindings/python/slatedb/uniffi/__init__.py`
```
"""Public Python wrapper for the generated SlateDB UniFFI bindings."""

from importlib import import_module

_generated = import_module("._slatedb_uniffi.slatedb", __name__)
from ._slatedb_uniffi import *

__all__ = _generated.__all__

```

### Core Architecture Module: `bindings/uniffi/src/admin.rs`
```
use crate::builder::CloneBuilder;
use crate::config::{CheckpointOptions, GarbageCollectorOptions};
use crate::error::{Error, SlateDbError};
use crate::types::{
    try_checkpoint_id_from_str, Checkpoint, CheckpointCreateResult, CloneSourceSpec, Compaction,
    CompactionSpec, CompactorStateView, VersionedCompactions, VersionedManifest,
};
use chrono::{DateTime, Utc};
use std::ops::Bound;
use std::sync::Arc;
use std::time::Duration;
use ulid::Ulid;

fn into_u64_bounds(
    from: Option<u64>,
    to: Option<u64>,
) -> Result<(Bound<u64>, Bound<u64>), SlateDbError> {
    Ok((
        from.map_or(Bound::Unbounded, Bound::Included),
        to.map_or(Bound::Unbounded, Bound::Excluded),
    ))
}

/// Administrative read/query handle for SlateDB.
#[derive(uniffi::Object)]
pub struct Admin {
    pub(crate) inner: slatedb::admin::Admin,
}

#[uniffi::export(async_runtime = "tokio")]
impl Admin {
    /// Reads a specific manifest by ID, or the latest when `id` is `None`.
    pub async fn read_manifest(&self, id: Option<u64>) -> Result<Option<VersionedManifest>, Error> {
        let manifest = self.inner.read_manifest(id).await?;
        Ok(manifest.as_ref().map(VersionedManifest::from))
    }

    /// Lists manifests inside the half-open ID range `[from, to)`.
    pub async fn list_manifests(
        &self,
        from: Option<u64>,
        to: Option<u64>,
    ) -> Result<Vec<VersionedManifest>, Error> {
        let bounds = into_u64_bounds(from, to)?;
        let manifests = self.inner.list_manifests(bounds).await?;
        Ok(manifests.iter().map(VersionedManifest::from).collect())
    }

    /// Reads a specific compactions file by ID, or the latest when `id` is `None`.
    pub async fn read_compactions(
        &self,
        id: Option<u64>,
    ) -> Result<Option<VersionedCompactions>, Error> {
        let compactions = self.inner.read_compactions(id).await?;
        Ok(compactions.as_ref().map(VersionedCompactions::from))
    }

    /// Reads a compaction by ULID string from a specific or latest compactions file.
    pub async fn read_compaction(
        &self,
        compaction_id: String,
        compactions_id: Option<u64>,
    ) -> Result<Option<Compaction>, Error> {
        let compaction_id = Ulid::from_string(&compaction_id)
            .map_err(|source| SlateDbError::InvalidCompactionId { source })?;
        let compaction = self
            .inner
            .read_compaction(compaction_id, compactions_id)
            .await?;
        Ok(compaction.as_ref().map(Compaction::from))
    }

    /// Reads the latest compactor state view.
    pub async fn read_compactor_state_view(&self) -> Result<CompactorStateView, Error> {
        let view = self.inner.read_compactor_state_view().await?;
        Ok((&view).into())
    }

    /// Generate a compaction from a spec and submit it.
    ///
    /// ## Returns
    /// - `Ok(Compaction)`: The submitted compaction.
    /// - `Err`: If there was an error during submission or reading the submitted compaction.
    pub async fn submit_compaction(&self, spec: CompactionSpec) -> Result<Compaction, Error> {
        let compaction = self.inner.submit_compaction((&spec).try_into()?).await?;
        Ok(Compaction::from(&compaction))
    }

    /// Lists compactions files inside the half-open ID range `[from, to)`.
    pub async fn list_compactions(
        &self,
        from: Option<u64>,
        to: Option<u64>,
    ) -> Result<Vec<VersionedCompactions>, Error> {
        let bounds = into_u64_bounds(from, to)?;
        let compactions = self.inner.list_compactions(bounds).await?;
        Ok(compactions.iter().map(VersionedCompactions::from).collect())
    }

    /// Lists checkpoints, optionally filtering by exact name.
    pub async fn list_checkpoints(
        &self,
        name_filter: Option<String>,
    ) -> Result<Vec<Checkpoint>, Error> {
        let checkpoints = self.inner.list_checkpoints(name_filter.as_deref()).await?;
        Ok(checkpoints.iter().map(Checkpoint::from).collect())
    }

    /// Runs the garbage collector once with the provided options.
    ///
    /// When `options` is `None`, SlateDB's default garbage collector options are used.
    pub async fn run_gc_once(&self, options: Option<GarbageCollectorOptions>) -> Result<(), Error> {
        let options = options.map_or_else(
            slatedb::config::GarbageCollectorOptions::default,
            Into::into,
        );
        self.inner.run_gc_once(options).await.map_err(Into::into)
    }

    /// Looks up a timestamp for the provided sequence number.
    pub async fn get_timestamp_for_sequence(
        &self,
        seq: u64,
        round_up: bool,
    ) -> Result<Option<i64>, Error> {
        let timestamp = self.inner.get_timestamp_for_sequence(seq, round_up).await?;
        Ok(timestamp.map(|ts| ts.timestamp()))
    }

    /// Looks up a sequence number for the provided Unix UTC timestamp seconds.
    pub async fn get_sequence_for_timestamp(
        &self,
        timestamp_secs: i64,
        round_up: bool,
    ) -> Result<Option<u64>, Error> {
        let timestamp = DateTime::<Utc>::from_timestamp(timestamp_secs, 0)
            .ok_or(SlateDbError::InvalidTimestampSeconds { timestamp_secs })?;
        self.inner
            .get_sequence_for_timestamp(timestamp, round_up)
            .await
            .map_err(Into::into)
    }

    /// Creates a checkpoint of the db stored in the object store at the specified path using the
    /// provided options.
    pub async fn create_detached_checkpoint(
        &self,
        options: &CheckpointOptions,
    ) -> Result<CheckpointCreateResult, Error> {
        Ok(CheckpointCreateResult::from(
            self.inner
                .create_detached_checkpoint(&slatedb::config::CheckpointOptions::try_from(options)?)
                .await?,
        ))
    }

    /// Refresh the lifetime of an existing checkpoint.
    pub async fn refresh_checkpoint(
        &self,
        id: String,
        lifetime_ms: Option<u64>,
    ) -> Result<(), Error> {
        self.inner
            .refresh_checkpoint(
                try_checkpoint_id_from_str(&id)?,
                lifetime_ms.map(Duration::from_millis),
            )
            .await
            .map_err(Into::into)
    }

    /// Deletes the checkpoint with the specified id.
    pub async fn delete_checkpoint(&self, id: String) -> Result<(), Error> {
        self.inner
            .delete_checkpoint(try_checkpoint_id_from_str(&id)?)
            .await
            .map_err(Into::into)
    }

    /// Deletes the database: releases the checkpoints it pinned in the
    /// databases it was cloned from, then removes every object under its path.
    ///
    /// With `confirm` false nothing is deleted and the paths that would be are
    /// returned. With `confirm` true the deleted paths are returned. A path that
    /// holds objects but no SlateDB manifest is refused. Idempotent.
    pub async fn delete_db(&self, confirm: bool) -> Result<Vec<String>, Error> {
        self.inner.delete_db(confirm).await.map_err(Into::into)
    }

    pub fn create_clone_builder_from_source(
        &self,
        source: CloneSourceSpec,
    ) -> Result<Arc<CloneBuilder>, Error> {
        Ok(CloneBuilder::new(
            self.inner
                .create_clone_builder_from_source(source.try_into()?),
        ))
    }
}

```

### Core Architecture Module: `bindings/uniffi/src/config.rs`
```
use crate::error::{Error, SlateDbError};
use crate::filter_policy::FilterContext;
use crate::types::try_checkpoint_id_from_str;
use std::time::Duration;

/// Minimum durability level required for data returned by reads and scans.
#[derive(Clone, Copy, Debug, Default, uniffi::Enum)]
pub enum DurabilityLevel {
    /// Return only data that has been flushed to remote object storage.
    Remote,
    /// Return both remote data and newer in-memory data.
    #[default]
    Memory,
}

impl From<DurabilityLevel> for slatedb::config::DurabilityLevel {
    fn from(value: DurabilityLevel) -> Self {
        match value {
            DurabilityLevel::Remote => Self::Remote,
            DurabilityLevel::Memory => Self::Memory,
        }
    }
}

/// Storage layer targeted by an explicit flush.
#[derive(Clone, Copy, Debug, Default, uniffi::Enum)]
pub enum FlushType {
    /// Flush the active memtable and any immutable memtables to object storage.
    MemTable,
    /// Flush the active WAL and any immutable WAL segments to object storage.
    #[default]
    Wal,
}

impl From<FlushType> for slatedb::config::FlushType {
    fn from(value: FlushType) -> Self {
        match value {
            FlushType::MemTable => Self::MemTable,
            FlushType::Wal => Self::Wal,
        }
    }
}

/// Isolation level used when starting a transaction.
#[derive(Clone, Copy, Debug, Default, uniffi::Enum)]
pub enum IsolationLevel {
    /// Reads see a stable snapshot without full serializable conflict checking.
    #[default]
    Snapshot,
    /// Reads see a stable snapshot with serializable conflict detection.
    SerializableSnapshot,
}

impl From<IsolationLevel> for slatedb::IsolationLevel {
    fn from(value: IsolationLevel) -> Self {
        match value {
            IsolationLevel::Snapshot => Self::Snapshot,
            IsolationLevel::SerializableSnapshot => Self::SerializableSnapshot,
        }
    }
}

/// Block size used for newly written SSTable blocks.
#[derive(Clone, Copy, Debug, Default, uniffi::Enum)]
pub enum SstBlockSize {
    /// 1 KiB blocks.
    Block1Kib,
    /// 2 KiB blocks.
    Block2Kib,
    /// 4 KiB blocks.
    #[default]
    Block4Kib,
    /// 8 KiB blocks.
    Block8Kib,
    /// 16 KiB blocks.
    Block16Kib,
    /// 32 KiB blocks.
    Block32Kib,
    /// 64 KiB blocks.
    Block64Kib,
}

impl From<SstBlockSize> for slatedb::SstBlockSize {
    fn from(value: SstBlockSize) -> Self {
        match value {
            SstBlockSize::Block1Kib => Self::Block1Kib,
            SstBlockSize::Block2Kib => Self::Block2Kib,
            SstBlockSize::Block4Kib => Self::Block4Kib,
            SstBlockSize::Block8Kib => Self::Block8Kib,
            SstBlockSize::Block16Kib => Self::Block16Kib,
            SstBlockSize::Block32Kib => Self::Block32Kib,
            SstBlockSize::Block64Kib => Self::Block64Kib,
        }
    }
}

/// Time-to-live policy applied to an inserted value or merge operand.
#[derive(Clone, Debug, Default, uniffi::Enum)]
pub enum Ttl {
    /// Use the database default TTL.
    #[default]
    Default,
    /// Store the value without expiration.
    NoExpiry,
    /// Expire the value after the given number of milliseconds.
    ExpireAfterMillis(u64),
    /// Expire the value at the given Unix timestamp in milliseconds.
    ExpireAtMillis(i64),
}

impl From<Ttl> for slatedb::config::Ttl {
    fn from(value: Ttl) -> Self {
        match value {
            Ttl::Default => Self::Default,
            Ttl::NoExpiry => Self::NoExpiry,
            Ttl::ExpireAfterMillis(ttl_millis) => Self::ExpireAfterMillis(ttl_millis),
            Ttl::ExpireAtMillis(timestamp_millis) => Self::ExpireAtMillis(timestamp_millis),
        }
    }
}

/// Options for tracing a read operation.
#[derive(Clone, Debug, uniffi::Record)]
pub struct TracingOptions {
    pub trace_id: String,
}

impl From<TracingOptions> for slatedb::config::TracingOptions {
    fn from(value: TracingOptions) -> Self {
        Self {
            trace_id: value.trace_id,
        }
    }
}

/// Options that control a point read.
#[derive(Clone, Debug, uniffi::Record)]
pub struct ReadOptions {
    /// Minimum durability level a returned row must satisfy.
    pub durability_filter: DurabilityLevel,
    /// Whether uncommitted dirty data may be returned.
    pub dirty: bool,
    /// Whether fetched data blocks should be inserted into the block cache.
    /// SST metadata is cached independently.
    pub cache_blocks: bool,
    /// Optional context forwarded to custom filter policies; ignored by
    /// built-in filters.
    #[uniffi(default = None)]
    pub filter_context: Option<FilterContext>,
    /// Optional caller-supplied tracing settings.
    #[uniffi(default = None)]
    pub tracing_options: Option<TracingOptions>,
}

impl Default for ReadOptions {
    fn default() -> Self {
        Self {
            durability_filter: DurabilityLevel::default(),
            dirty: false,
            cache_blocks: true,
            filter_context: None,
            tracing_options: None,
        }
    }
}

impl From<ReadOptions> for slatedb::config::ReadOptions {
    fn from(value: ReadOptions) -> Self {
        slatedb::config::ReadOptions {
            durability_filter: value.durability_filter.into(),
            dirty: value.dirty,
            cache_blocks: value.cache_blocks,
            filter_context: value.filter_context.map(Into::into),
            tracing_options: value.tracing_options.map(Into::into),
        }
    }
}

/// Determines how a [`crate::DbReader`] chooses and refreshes database state.
#[derive(Clone, Debug, Default, uniffi::Enum)]
pub enum ReaderMode {
    /// Create and maintain checkpoints while following the latest database state.
    #[default]
    ManagedCheckpoint,
    /// Remain pinned to the database state referenced by the supplied checkpoint UUID string.
    Checkpoint(String),
    /// Follow the latest manifest without creating or maintaining a checkpoint.
    FollowLatest,
}

impl TryFrom<ReaderMode> for slatedb::DbReaderMode {
    type Error = Error;

    fn try_from(value: ReaderMode) -> Result<Self, Self::Error> {
        Ok(match value {
            ReaderMode::ManagedCheckpoint => Self::ManagedCheckpoint,
            ReaderMode::Checkpoint(checkpoint_id) => {
                Self::Checkpoint(try_checkpoint_id_from_str(&checkpoint_id)?)
            }
            ReaderMode::FollowLatest => Self::FollowLatest,
        })
    }
}

/// Options for opening a [`crate::DbReader`].
#[derive(Clone, Debug, uniffi::Record)]
pub struct ReaderOptions {
    /// How often the reader polls for new manifests and WAL data, in milliseconds.
    pub manifest_poll_interval_ms: u64,
    /// Lifetime of an internally managed checkpoint, in milliseconds.
    pub checkpoint_lifetime_ms: u64,
    /// Maximum size of one in-memory table used while replaying WAL data.
    pub max_memtable_bytes: u64,
    /// Whether WAL replay should be skipped entirely.
    pub skip_wal_replay: bool,
    /// Maximum number of wrapper-level retries for a single object-store
    /// operation, on top of the `object_store` client's own HTTP retries.
    /// `None` (default) retries transient errors indefinitely; `Some(n)` gives
    /// up after `n` retries and surfaces the underlying error.
    #[uniffi(default = None)]
    pub object_store_max_retries: Option<u32>,
}

impl Default for ReaderOptions {
    fn default() -> Self {
        Self {
            manifest_poll_interval_ms: 10_000,
            checkpoint_lifetime_ms: 600_000,
            max_memtable_bytes: 64 * 1024 * 1024,
            skip_wal_replay: false,
            object_store_max_retries: None,
        }
    }
}

impl From<ReaderOptions> for slatedb::config::DbReaderOptions {
    fn from(value: ReaderOptions) -> Self {
        slatedb::config::DbReaderOptions {
            manifest_poll_interval: Duration::from_millis(value.manifest_poll_interval_ms),
            checkpoint_lifetime: Duration::from_millis(value.checkpoint_lifetime_ms),
          
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2086** (2026-09-09): **`foyer = "0.22.4"` floor breaks musl builds (foyer-rs/foyer#1338)**
  *Symptoms*: **Describe the bug**  SlateDB cannot be built for `*-unknown-linux-musl` targets. The workspace requires `foyer = "0.22.4"`, and `foyer-storage` 0.22.4 and 0.22.5 do not compile for musl.  This failure can be fixed either by lowering the required foyer version to 0.22.3, or by waiting for foyer upstream to fix it.  There is an open issue, foyer-rs/foyer#1338, opened 2026-09-05, but it has no PR yet.  **To Reproduce**  1. `rustup target add x86_64-unknown-linux-musl` 2. `apt-get install musl-dev` (or an equivalent musl toolchain) 3. From the SlateDB workspace root, with the default features that include `foyer`: `cargo build -p slatedb --target x86_64-unknown-linux-musl`  The same failure reaches any downstream crate that depends on SlateDB and builds for musl.  **Expected behavior**  SlateDB builds for `*-unknown-linux-musl`.  **Screenshots**  Not applicable. The compiler output is provided.  **Build**  - `uname -a`: `Darwin 25.6.0 Darwin Kernel Version 25.6.0 arm64` locally. The failing target is `x86_64-unknown-linux-musl`, built on Linux CI. - OS: Linux, building the musl target. Cross-compiling from macOS does not reach this error, because the `zstd-sys` and `lz4-sys` build scripts fail first looking for `x86_64-linux-musl-gcc`. - SlateDB Version: 0.16.0, at `4478eb907b98c0a52299f359127ccba82c2716b9` - Object Store: S3  **Additional context**  `foyer-storage/src/io/device/utils.rs` declares four ioctl request constants as `u64`. It selects a platform branch with `cfg!()` 
  **Post-Mortem & Fix Analysis**:
  > Just saw foyer fixed the issue (it was faster than I expected!), so closing this.

- **Issue #2055** (2026-08-27): **Make with_wal_object_store safe for incremental deployment**
  *Symptoms*: **Describe the bug**    `with_wal_object_store()` is unusable for incremental deployment on v0.15.0. When a writer creates a new DB with `with_wal_object_store()`, the manifest persists `wal_object_store_uri = Some("")`. Any subsequent reader opening that DB without `with_wal_object_store()` configured gets `WalStoreReconfigurationError`.   The root cause is that `FlatBufferManifestCodec::encode` writes V1 (which preserves the `wal_object_store_uri` field) unless segment state requires V2. PR #1473 dropped the field from V2, but normal databases without segments still write V1 — so the validation remains active even on 0.15.0.    **To Reproduce**    1. Create a new DB using `DbBuilder` with `with_wal_object_store()` configured   2. Open the same DB using `DbReaderBuilder` without `with_wal_object_store()`   3. Reader fails with `WalStoreReconfigurationError`    **Expected behavior**    On v0.15.0 (which includes the ManifestV2 codec from PR #1473), `wal_object_store_uri` should not block readers from opening a database — either by defaulting to V2 manifest format, or by stripping the field before persisting.    **Screenshots**    N/A    **Build**    - OS: Linux   - SlateDB Version: 0.15.0   - Object Store: S3-compatible (custom)    **Additional context**    - Discord thread: https://discord.com/channels/1232385660460204122/1542581454280851466   - The fix is to default to V2 manifest format in 0.16 (per RFC 0004's phased rollout plan: write V1 → write V2 universally → deprecat

- **Issue #2051** (2026-08-26): **`SequenceTracker` accepts an update inside the interval after deserialization**
  *Symptoms*: ## What I observed  I found a behavior difference after serializing and deserializing a `SequenceTracker`. With the default 60-second interval, a tracker accepts an update one second after its last stored timestamp only after the round trip.  ## Exact reproduction  This internal test reproduces it on current `main`:  ```rust #[test] fn deserialize_preserves_the_recording_interval() {     let mut tracker = SequenceTracker::new();     tracker.insert(TrackedSeq {         seq: 0,         ts: DateTime::from_timestamp(1_600_000_060, 0).unwrap(),     });      let mut decoded = SequenceTracker::from_bytes(&tracker.to_bytes()).unwrap();     decoded.insert(TrackedSeq {         seq: 1,         ts: DateTime::from_timestamp(1_600_000_061, 0).unwrap(),     });      assert_eq!(decoded.sequence_numbers, vec![0]); } ```  The assertion fails because `decoded.sequence_numbers` is `[0, 1]`.  Reproduced against `main` at `31656fe30064ce0d7991a578085341e21438af5e`.  ## What I expected  The decoded tracker should retain sequence `0` only, matching the configured 60-second recording interval and the behavior before serialization.  ## What happened instead  The decoded tracker records sequence `1` one second later. The current decoder restores `sequence_numbers` and `timestamps`, but `last_recorded_ts` remains unset.

- **Issue #2047** (2026-08-25): **Tolerate manifests GCed during admin.list_manifests**
  *Symptoms*: ## Summary  During down scales (union cloning) we've sporadically observed `failed to find manifest with id. id=1` errors failing the restore, appearing to be a race by GC deleting manifest 1 of the clone after `create_clone` rewritten manifest 2, and `admin.list_manifests` doing `LIST` + `GET` each  The issue can be reproduced by setting `garbage_collector_options.manifest_options.min_age` to `1s` + slow union cloning, and solved here by skipping read of manifests that couldn't be found after listed Alternatively we could retry the LIST+GET as in https://github.com/slatedb/slatedb/pull/1230  ## Changes  - Skip reading GCed manifests during admin.list_manifests + a test  ## Notes for Reviewers  Related to https://github.com/slatedb/slatedb/issues/1215  ## Checklist  - [X] Small, scoped PR (< 500 total lines excluding tests); or opened as Draft with a plan on how to break it into smaller pieces - [x] Linked related issue(s) or added context in the description - [X] Self-reviewed the diff; added comments for tricky parts - [X] Tests added/updated and passing locally - [X] Ran `cargo fmt`, `cargo clippy --all-targets --all-features`, and `cargo nextest run --all-features` - [X] Called out any breaking changes and provided migration notes - [X] Considered performance impact; added notes or benchmarks if relevant  Thank you for the review! 🙏 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/slatedb/slatedb?pullRequest=2047) <br/>All committers have signed the CLA.

- **Issue #2036** (2026-08-24): **`DbReader` ignores the SST block size, so `ScanOptions::read_ahead_bytes` over-reads N× on any DB not written with 4 KiB blocks**
  *Symptoms*:  **Describe the bug**  `ScanOptions::read_ahead_bytes` is documented as a byte budget — "The number of bytes to read ahead. The value is rounded up to the nearest block size when fetching from object storage." — but `Reader::scan_with_options` converts it into a *block count* by dividing by the block size held on its own `TableStore`'s `SsTableFormat`. `DbBuilder` sets that field from `with_sst_block_size`, whereas `DbReaderBuilder` has no equivalent knob and always falls back to the 4096 default. A `DbReader` scanning a database written with any non-default block size therefore prefetches `configured_block_size / 4096` times the bytes it was asked for, per fetch task and per open SST: 4× under `SstBlockSize::Block16Kib`, 16× under `Block64Kib`.  Nothing downstream corrects the count. `blocks_to_fetch` is consumed as a raw count of blocks, and the byte extent of each fetch is read from the SST's own index, so the count gets multiplied by that SST's real block size rather than by the 4096 assumed when the count was computed.  **To Reproduce**  1. Build a `Db` with a non-default block size and write enough rows to produce a multi-MiB L0 SST, then close it. 2. Open a `DbReader` on the same path — note there is no way to tell it the block size the data was written with. 3. Scan with a `read_ahead_bytes` well above one block. 4. Observe the size of the first prefetch, either by instrumenting the object store or by inspecting `TableStore::bytes_to_blocks`.  ```rust let db = Db::bui
  **Post-Mortem & Fix Analysis**:
  > Closing since #2307 addressed this.

- **Issue #2025** (2026-08-13): **fix(seq_tracker): widen Gorilla fallback slot to 64 bits to preserve large seqnum deltas**
  *Symptoms*: ## Summary  Fixes #2024.  `SequenceTracker`'s Gorilla encoding stored delta-of-delta values that don't fit the small buckets in a **32-bit** fallback slot (`w.push32(dod as u32, 32)`), and the decoder sign-extended those 32 bits back. Sequence numbers are arbitrary `u64`s, so any pair of tracked entries whose delta-of-delta falls outside the `i32` range — e.g. a user-supplied `WriteOptions::seqnum` jump, which the docs explicitly support ("the offset returned by your external WAL") — was silently corrupted on the manifest encode/decode round trip. Because Gorilla is a delta chain, all subsequent values in the array get corrupted too, breaking the sorted-array invariant behind `find_ts`/`find_seq` (used by time-based retention and the `Admin` seq↔ts APIs) and potentially tripping the `Sequence numbers must be monotonic` assert on a later `extend_from`.  ## Changes  - Bump the serialization format to version 2: the `0b1111` fallback slot now stores the full 64-bit delta-of-delta (`push64`). The 1/2/3-byte buckets are unchanged, so typical workloads (tiny deltas between sampled entries) see no size difference. - Keep decoding version 1 data with the old 32-bit sign-extended layout: `decode_gorilla_i64_with_length` takes a `wide_fallback` flag chosen from the version byte, so existing manifests remain readable. - Regression tests:   - Three new round-trip cases that fail on `main` (`[0, 2^31]`, `[1, 5_000_000_000]`, `[1, 5_000_000_000, 5_000_000_100]`).   - A version-1 golden-byt
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/slatedb/slatedb?pullRequest=2025) <br/>All committers have signed the CLA.
  > This change will require a read-before-write rollout. Otherwise, the writer will write a V2 encoding to the manifest and the V1 readers will fail.
  > @agavra FYI. This does increase gorilla encoding size a bit when the detla-of-delta jumps >= 2048, but I think that's OK. Seqnum jumps are much smaller than that usually, and timestamps are stored by second, so anything < 34m interval change should still be the same size.

- **Issue #2024** (2026-09-04): **SequenceTracker Gorilla encoding silently corrupts sequence numbers when delta-of-delta exceeds i32 range**
  *Symptoms*: ### Summary  `SequenceTracker`'s Gorilla encoding stores delta-of-delta values that don't fit the 1/2/3-byte buckets in a **32-bit** fallback slot:  ```rust // slatedb/src/seq_tracker.rs (encode_gorilla_i64) _ => {     w.push32(0b1111, 4);     w.push32(dod as u32, 32);   // i64 dod truncated to its low 32 bits } ```  and the decoder sign-extends those 32 bits back:  ```rust let bits = GORILLA_PREFIX_BYTES[count];  // 32 for the fallback slot let raw = reader.read32(bits)...; sign_extend(raw, bits) as i64            // can only represent [-2^31, 2^31) ```  Sequence numbers are arbitrary `u64`s (bit-cast to `i64` for encoding), so any pair of tracked entries whose delta-of-delta falls outside the `i32` range is **silently corrupted** on the encode/decode round trip. Because Gorilla is a delta chain, every subsequent value in the array is corrupted too, which breaks the sorted-array invariant that `find_ts`/`find_seq` binary searches rely on.  ### Reproduction  Add these cases to the existing `test_encode_decode_sequence_numbers` round-trip test in `slatedb/src/seq_tracker.rs` (at `e9a14cd`):  ```rust #[case::dod_at_i32_boundary(vec![0, i32::MAX as u64 + 1])] #[case::user_seqnum_jump(vec![1, 5_000_000_000])] #[case::values_after_large_jump(vec![1, 5_000_000_000, 5_000_000_100])] ```  `cargo test -p slatedb --lib seq_tracker` fails with:  ``` ---- case_12_user_seqnum_jump ---- assertion `left == right` failed   left: [1, 705032704]  right: [1, 5000000000]  ---- case_13_values_aft
  **Post-Mortem & Fix Analysis**:
  > was going through the open bugs looking for something unclaimed to pick up, and landed here.  confirmed it from the source and then ran it. in slatedb/src/seq_tracker.rs the fallback arm at line 333 is w.push32(dod as u32, 32) with no range check. the other arms all sit inside their widths, line 319 guards -63..=63 for 7 bits, then -255..=255 for 9, then -2047..=2047 for 12. so the _ arm is the only one that can be handed a value it cannot hold.  dropped a temporary test into the module and ran it against main:   gap=2147483648  in=[0, 2147483648]      out=[0, -2147483648]  lossless=false gap=4294967296  in=[0, 4294967296]      out=[0, 0]            lossless=false gap=2147483653  in=[0, 2147483653]      out=[0, -2147483643]  lossless=false steady          in=[0, 10, 4294967306]  out=[0, 10, 10]       lossless=false inrange         in=[0, 2147483647]      out=[0, 2147483647]   lossless=true test result: ok. 1 passed the boundary is exact. 2^31 - 1 survives, 2^31 comes back negative. the
  > @Cintu07 https://github.com/slatedb/slatedb/pull/2025#issuecomment-5283868927

- **Issue #2022** (2026-08-13): **test(wal_replay): write_wal helper ignores max_entries due to always-true loop condition**
  *Symptoms*: **Describe the bug**  The `write_wal` test helper in `slatedb/src/wal_replay.rs` ignores its `max_entries` argument because its loop condition is always true:  ```rust let mut next_seq = next_seq; while next_seq < next_seq + (max_entries as u64) { ```  Both sides of the comparison grow together, so for any `max_entries > 0` the condition never becomes false and the loop only stops when the shared entries iterator is exhausted. (Only `max_entries == 0` yields `false`, which is why `write_empty_wal` still works.)  As a result, `write_wals` does not do what it says ("Write a sequence of WALs with a random (bounded) number of entries"): the first call with a non-zero budget writes **all** remaining entries into a single WAL SST, while `total_wal_entries` is still incremented by the intended per-WAL count, so the remaining loop iterations emit a series of **empty** WALs until the bookkeeping catches up.  This silently weakens the replay tests that rely on entries being spread across multiple WAL files:  - `should_replay_all_entries` - `should_enforce_max_memtable_bytes` - `should_only_replay_wals_after_last_l0_flushed_wal_id` - `should_replay_wals_after_min_seq`  They all still pass, but against a "1 giant WAL + N empty WALs" fixture. Notably, since replay only splits returned tables at WAL file boundaries (see `should_apply_max_memtable_bytes_at_wal_boundaries`), `should_enforce_max_memtable_bytes` currently replays everything into one oversized table and never actually exercises

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

### Incident Patch 1: `484d595d` (2026-09-29)
**Commit Message**: fix: preserve unread views when merging compaction watermarks (#2134)

**File**: `slatedb/src/manifest/mod.rs` (modified, +36/-3)
```diff
@@ -111,10 +111,10 @@ impl LsmTreeState {
                     .take_while(|view| {
                         // Match by view ID first (V2 manifests), then fall back
                         // to SST ID (V1).
+                        // A physical SST can have several views. Use its ID only
+                        // when the manifest has no view watermark.
                         if let Some(id) = last_compacted_view {
-                            if view.id == id {
-                                return false;
-                            }
+                            return view.id != id;
                         }
                         if let Some(id) = last_compacted_sst {
                             if view.sst.id.value() == id {
@@ -2125,6 +2125,39 @@ mod tests {
         assert_manifest_equal(&union, &expected_manifest, &sst_ids);
     }
 
+    #[rstest]
+    #[case(true)]
+    #[case(false)]
+    fn test_watermark_matches_view_not_shared_sst(#[case] watermark_present: bool) {
+        let sst = SsTableHandle::new(
+            SsTableId::from(Ulid::from_parts(1, 0)),
+            SST_FORMAT_VERSION_LATEST,
+            SsTableInfo::default(),
+        );
+        let left = SsTableView::new(Ulid::from_parts(1, 1), sst.clone());
+        let child = SsTableView::identity(SsTableHandle::new(
+            SsTableId::from(Ulid::from_parts(2, 0)),
+            SST_FORMAT_VERSION_LATEST,
+            SsTableInfo::default(),
+        ));
+        let right = SsTableView::new(Ulid::from_parts(1, 2), sst.clone());
+        let mut writer = LsmTreeState {
+            l0: VecDeque::from([left.clone(), child.clone()]),
+            ..Default::default()
+        };
+        if watermark_present {
+            writer.l0.push_back(right.clone());
+        }
+        let compactor = LsmTreeState {
+            last_compacted_l0_sst_view_id: Some(right.id),
+            last_compacted_l0_sst_id: Some(sst.id.value()),
+            ..Default::default()
+        };
+        let expected = VecDeque::from([left, child]);
+        assert_eq!(writer.merge_from_compactor(&compactor).l0, expected);
+        assert_eq!(compactor.merge_from_writer(&writer).l0, expected);
+    }
+
     #[test]
     fn test_lsm_tree_merge_invariants() {
         // Build a writer L0 with `n` views whose view IDs and SST IDs are all
```

---

### Incident Patch 2: `a644322b` (2026-09-25)
**Commit Message**: fix(clone): don't carry inherited external dbs that hold no SSTs (#2113)

Co-authored-by: sinbad-io <sinbad-io@users.noreply.github.com>

**File**: `slatedb/src/clone.rs` (modified, +106/-0)
```diff
@@ -1016,6 +1016,112 @@ mod tests {
         reader.close().await.unwrap();
     }
 
+    // A clone lists every ancestor it inherits. Once compaction has re-localized all of an
+    // ancestor's SSTs, the detach collector releases the parent's pin on that ancestor. A
+    // clone of a checkpoint taken before the release reads nothing from the ancestor, so it
+    // must not need the pin.
+    #[tokio::test]
+    async fn should_clone_checkpoint_whose_emptied_ancestor_was_detached() {
+        let mut rng = rng::new_test_rng(None);
+        let table = sample::table(&mut rng, 1000, 10);
+
+        let object_store = Arc::new(InMemory::new());
+        let grandparent_path = Path::from("/tmp/test_grandparent");
+        let parent_path = Path::from("/tmp/test_parent");
+        let clone_path = Path::from("/tmp/test_clone");
+        let system_clock: Arc<dyn SystemClock> = Arc::new(DefaultSystemClock::new());
+        let rand = Arc::new(DbRand::default());
+
+        // The grandparent owns no SSTs, so the parent's entry for it is empty from the start,
+        // as it is once compaction has re-localized everything the parent borrowed.
+        Db::open(grandparent_path.clone(), object_store.clone())
+            .await
+            .unwrap()
+            .close()
+            .await
+            .unwrap();
+        create_clone(
+            parent_path.clone(),
+            grandparent_path.clone(),
+            object_store.clone(),
+            object_store.clone(),
+            None,
+            Arc::new(FailPointRegistry::new()),
+            system_clock.clone(),
+            rand.clone(),
+        )
+        .await
+        .unwrap();
+
+        // The parent's own collector would detach the empty entry as soon as it runs; the
+        // test releases the pin itself below, after the checkpoint that still lists it.
+        let parent_db = Db::builder(parent_path.clone(), object_store.clone())
+            .with_settings(Settings {
+                garbage_collector_options: None,
+                ..Settings::default()
+            })
+            .build()
+            .await
+            .unwrap();
+        test_utils::seed_database(&parent_db, &table, false)
+            .await
+            .unwrap();
+        parent_db
+            .flush_with_options(FlushOptions {
+                flush_type: FlushType::MemTable,
+            })
+            .await
+            .unwrap();
+        let checkpoint = parent_db
+            .create_checkpoint(CheckpointScope::All, &CheckpointOptions::default())
+            .await
+            .unwrap();
+        parent_db.close().await.unwrap();
+
+        // Release the parent's pin on the grandparent, as the detach collector does.
+        let checkpointed = ManifestStore::new(&parent_path, object_store.clone())
+            .read_manifest(checkpoint.manifest_id)
+            .await
+            .unwrap();
+        let ancestor = checkpointed
+            .external_dbs
+            .iter()
+            .find(|e| e.path == grandparent_path.to_string())
+            .expect("the checkpoint lists the grandparent");
+        assert!(ancestor.sst_ids.is_empty());
+        let mut grandparent_manifest = StoredManifest::load(
+            Arc::new(ManifestStore::new(&grandparent_path, object_store.clone())),
+            system_clock.clone(),
+        )
+        .await
+        .unwrap();
+        grandparent_manifest
+            .delete_checkpoint(ancestor.final_checkpoint_id.unwrap())
+            .await
+            .unwrap();
+
+        create_clone(
+            clone_path.clone(),
+            parent_path.clone(),
+            object_store.clone(),
+            object_store.clone(),
+            Some(checkpoint.id),
+            Arc::new(FailPointRegistry::new()),
+            system_clock.clone(),
+            rand.clone(),
+        )
+        .await
+        .unwrap();
+
+        let clone_db = Db::open(clone_path.clone(), object_store.clone())
+            .await
+        
```

**File**: `slatedb/src/manifest/mod.rs` (modified, +94/-5)
```diff
@@ -997,8 +997,14 @@ impl Manifest {
     ) -> Self {
         let mut clone_external_dbs = vec![];
 
-        // Carry over each inherited external_db with a fresh final_checkpoint_id.
-        for parent_external_db in &parent_manifest.external_dbs {
+        // Carry over each inherited external_db that still holds SSTs, with a fresh
+        // final_checkpoint_id. An entry whose SSTs were all re-localized contributes nothing,
+        // and the detach collector may already have released the checkpoint it pinned.
+        for parent_external_db in parent_manifest
+            .external_dbs
+            .iter()
+            .filter(|external_db| !external_db.sst_ids.is_empty())
+        {
             clone_external_dbs.push(ExternalDb {
                 path: parent_external_db.path.clone(),
                 // don't depend on the original source_checkpoint: it was supplied by the user and
@@ -1385,14 +1391,18 @@ impl Manifest {
     }
 
     /// Build the union's `external_dbs` list. Forwards every source's
-    /// inherited `external_dbs` and adds one entry per source that owns
-    /// SSTs directly. `final_checkpoint_id` is left as `None`; it is
+    /// inherited `external_dbs` that still hold SSTs and adds one entry per
+    /// source that owns SSTs directly. `final_checkpoint_id` is left as `None`; it is
     /// regenerated after the post-loop deduplication.
     fn build_external_dbs(sources: &[&CloneSource]) -> Vec<ExternalDb> {
         let mut external_dbs = vec![];
         for source in sources {
             let manifest = &source.manifest;
-            for parent_external_db in &manifest.external_dbs {
+            for parent_external_db in manifest
+                .external_dbs
+                .iter()
+                .filter(|external_db| !external_db.sst_ids.is_empty())
+            {
                 external_dbs.push(ExternalDb {
                     path: parent_external_db.path.clone(),
                     // don't depend on the original source_checkpoint: it was supplied by the user and
@@ -1781,6 +1791,45 @@ mod tests {
         );
     }
 
+    #[test]
+    fn test_cloned_drops_emptied_ancestor() {
+        // Once compaction has re-localized every SST a parent borrowed from an ancestor, the
+        // parent's entry for it is empty, and the detach collector may release the ancestor's
+        // pin. A clone reads nothing from that ancestor, so it must not carry the entry:
+        // carrying it asks the ancestor to pin a checkpoint that may no longer exist.
+        let rand = Arc::new(DbRand::default());
+        let parent_owned_sst = SsTableId::from(Ulid::new());
+        let mut parent = build_manifest(
+            &SimpleManifest {
+                l0: vec![SstEntry::projected("parent_owned", "a", "a"..)],
+                sorted_runs: vec![],
+            },
+            |_| parent_owned_sst,
+        );
+        parent.external_dbs.push(ExternalDb {
+            path: "/tmp/grandparent".to_string(),
+            source_checkpoint_id: Uuid::new_v4(),
+            final_checkpoint_id: Some(Uuid::new_v4()),
+            sst_ids: vec![],
+        });
+
+        let cloned = Manifest::cloned(&parent, "/tmp/parent".to_string(), Uuid::new_v4(), rand);
+
+        assert!(
+            cloned
+                .external_dbs
+                .iter()
+                .all(|e| e.path != "/tmp/grandparent"),
+            "an ancestor entry with no SSTs must not be carried over"
+        );
+        let parent_entry = cloned
+            .external_dbs
+            .iter()
+            .find(|e| e.path == "/tmp/parent")
+            .expect("the immediate parent is always an entry");
+        assert_eq!(parent_entry.sst_ids, vec![parent_owned_sst]);
+    }
+
     #[tokio::test]
     async fn test_write_new_checkpoint() {
         let object_store: Arc<dyn ObjectStore> = Arc::new(InMemory::new());
@@ -2933,6 +2982,46 @@ mod tests {
         assert_eq!(union.core.last_l0_clock_tick, expected);
   
```

---

### Incident Patch 3: `2866a351` (2026-09-25)
**Commit Message**: Fix clock inheritance in union clones (#2107)

**File**: `slatedb/src/manifest/mod.rs` (modified, +52/-0)
```diff
@@ -1476,6 +1476,10 @@ impl Manifest {
 
         for source in &sources {
             core.last_l0_seq = max(core.last_l0_seq, source.manifest.core.last_l0_seq);
+            core.last_l0_clock_tick = max(
+                core.last_l0_clock_tick,
+                source.manifest.core.last_l0_clock_tick,
+            );
         }
 
         // Coalesce borrows of the same physical ancestor, keyed on (path, sst_ids) rather than
@@ -2881,6 +2885,54 @@ mod tests {
         assert_eq!(union.core.last_l0_seq, 200);
     }
 
+    #[rstest]
+    #[case(100, 250, 250)]
+    #[case(250, 100, 250)]
+    #[case(i64::MIN, 250, 250)]
+    #[case(i64::MIN, i64::MIN, i64::MIN)]
+    fn test_union_propagates_last_l0_clock_tick(
+        #[case] tick1: i64,
+        #[case] tick2: i64,
+        #[case] expected: i64,
+    ) {
+        let mut manifest1 = build_manifest(
+            &SimpleManifest {
+                l0: vec![],
+                sorted_runs: vec![vec![SstEntry::projected("sr1", "a", "a".."m")]],
+            },
+            |_| SsTableId::from(Ulid::new()),
+        );
+        manifest1.core.last_l0_clock_tick = tick1;
+
+        let mut manifest2 = build_manifest(
+            &SimpleManifest {
+                l0: vec![],
+                sorted_runs: vec![vec![SstEntry::projected("sr2", "m", "m"..)]],
+            },
+            |_| SsTableId::from(Ulid::new()),
+        );
+        manifest2.core.last_l0_clock_tick = tick2;
+
+        let union = Manifest::cloned_from_union(
+            vec![
+                CloneSource {
+                    manifest: manifest1,
+                    path: Path::from("/tmp/db1"),
+                    checkpoint: new_checkpoint(Uuid::new_v4()),
+                },
+                CloneSource {
+                    manifest: manifest2,
+                    path: Path::from("/tmp/db2"),
+                    checkpoint: new_checkpoint(Uuid::new_v4()),
+                },
+            ],
+            Arc::new(DbRand::default()),
+        )
+        .unwrap();
+
+        assert_eq!(union.core.last_l0_clock_tick, expected);
+    }
+
     #[test]
     fn test_union_external_dbs() {
         // manifest1 is clone-like: owns own_sst in core and inherits grandparent_sst
```

---

### Incident Patch 4: `0fb36809` (2026-09-20)
**Commit Message**: fix: refresh GC version gauges before boundary updates (#2100)

**File**: `slatedb/src/garbage_collector/compactions_gc.rs` (modified, +78/-3)
```diff
@@ -134,6 +134,8 @@ impl GcTask for CompactionsGcTask {
             })
             .collect::<Vec<_>>();
 
+        self.stats.gc_compactions_versions.set(pre_gc_count as i64);
+
         // Advance the boundary to the latest compactions file selected by the GC model. The
         // optional GC filter only gates the final deletion pass.
         if self.boundary_files_enabled {
@@ -152,8 +154,6 @@ impl GcTask for CompactionsGcTask {
             .map(|compactions_metadata| compactions_metadata.id)
             .collect::<Vec<_>>();
 
-        self.stats.gc_compactions_versions.set(pre_gc_count as i64);
-
         let deleted_count = self
             .maybe_delete_compactions(compactions_ids_to_delete)
             .await;
@@ -178,7 +178,7 @@ mod tests {
     use crate::compactions_store::{CompactionsStore, StoredCompactions};
     use async_trait::async_trait;
     use chrono::TimeDelta;
-    use object_store::{memory::InMemory, path::Path, ObjectStoreExt};
+    use object_store::{local::LocalFileSystem, memory::InMemory, path::Path, ObjectStoreExt};
     use slatedb_common::metrics::{
         lookup_metric_with_labels, DefaultMetricsRecorder, MetricsRecorderHelper,
     };
@@ -451,6 +451,81 @@ mod tests {
         );
     }
 
+    #[tokio::test]
+    async fn test_version_count_refreshes_when_boundary_advance_fails() {
+        let tempdir = tempfile::tempdir().unwrap();
+        let object_store = Arc::new(LocalFileSystem::new_with_prefix(tempdir.path()).unwrap());
+        let compactions_store = Arc::new(CompactionsStore::new(
+            &Path::from("/root"),
+            object_store.clone(),
+        ));
+        let mut stored = StoredCompactions::create(compactions_store.clone(), 0)
+            .await
+            .unwrap();
+        stored
+            .update(stored.prepare_dirty().unwrap())
+            .await
+            .unwrap();
+        stored
+            .update(stored.prepare_dirty().unwrap())
+            .await
+            .unwrap();
+        compactions_store.advance_boundary(1).await.unwrap();
+
+        let metrics = Arc::new(DefaultMetricsRecorder::new());
+        let recorder = MetricsRecorderHelper::new(metrics.clone(), Default::default());
+        let stats = Arc::new(GcStats::new(&recorder));
+        stats.gc_compactions_versions.set(-1);
+        let task = CompactionsGcTask::new(
+            compactions_store.clone(),
+            stats,
+            GarbageCollectorDirectoryOptions {
+                min_age: Duration::ZERO,
+                interval: None,
+                dry_run: false,
+            },
+            None,
+            true,
+        );
+
+        let error = task
+            .collect(Utc::now() + TimeDelta::hours(1))
+            .await
+            .unwrap_err();
+        assert!(matches!(
+            error,
+            SlateDBError::ObjectStoreError(error)
+                if matches!(error.as_ref(), object_store::Error::NotImplemented { .. })
+        ));
+
+        let raw_boundary = object_store
+            .get(&Path::from("/root/gc/compactions.boundary"))
+            .await
+            .unwrap()
+            .bytes()
+            .await
+            .unwrap();
+        assert_eq!("1", std::str::from_utf8(&raw_boundary).unwrap());
+        assert_eq!(
+            compactions_store
+                .list_compactions(..)
+                .await
+                .unwrap()
+                .iter()
+                .map(|compactions| compactions.id)
+                .collect::<Vec<_>>(),
+            vec![1, 2, 3]
+        );
+        assert_eq!(
+            lookup_metric_with_labels(
+                &metrics,
+                crate::garbage_collector::stats::VERSION_COUNT,
+                &[("resource", "compactions")]
+            ),
+            Some(3)
+        );
+    }
+
     #[tokio::test]
     async fn test_version_count_unchanged_on_dry_run() {
         let (compactions_store, mut stored) = make_compactions_store().await;
```

**File**: `slatedb/src/garbage_collector/manifest_gc.rs` (modified, +82/-3)
```diff
@@ -124,6 +124,8 @@ impl GcTask for ManifestGcTask {
             })
             .collect::<Vec<_>>();
 
+        self.stats.gc_manifest_versions.set(pre_gc_count as i64);
+
         // Advance the boundary to the latest manifest selected by the GC model. The optional GC
         // filter only gates the final deletion pass.
         if self.boundary_files_enabled {
@@ -142,8 +144,6 @@ impl GcTask for ManifestGcTask {
             .map(|manifest_metadata| manifest_metadata.id)
             .collect::<Vec<_>>();
 
-        self.stats.gc_manifest_versions.set(pre_gc_count as i64);
-
         let deleted_count = self.maybe_delete_manifests(manifest_ids_to_delete).await;
 
         if deleted_count > 0 {
@@ -169,7 +169,7 @@ mod tests {
     };
     use async_trait::async_trait;
     use chrono::TimeDelta;
-    use object_store::{memory::InMemory, path::Path, ObjectStoreExt};
+    use object_store::{local::LocalFileSystem, memory::InMemory, path::Path, ObjectStoreExt};
     use slatedb_common::clock::DefaultSystemClock;
     use slatedb_common::metrics::{
         lookup_metric_with_labels, DefaultMetricsRecorder, MetricsRecorderHelper,
@@ -447,6 +447,85 @@ mod tests {
         );
     }
 
+    #[tokio::test]
+    async fn test_version_count_refreshes_when_boundary_advance_fails() {
+        let tempdir = tempfile::tempdir().unwrap();
+        let object_store = Arc::new(LocalFileSystem::new_with_prefix(tempdir.path()).unwrap());
+        let manifest_store = Arc::new(ManifestStore::new(
+            &Path::from("/root"),
+            object_store.clone(),
+        ));
+        let mut stored = StoredManifest::create_new_db(
+            manifest_store.clone(),
+            ManifestCore::new(),
+            Arc::new(DefaultSystemClock::new()),
+        )
+        .await
+        .unwrap();
+        stored
+            .update(stored.prepare_dirty().unwrap())
+            .await
+            .unwrap();
+        stored
+            .update(stored.prepare_dirty().unwrap())
+            .await
+            .unwrap();
+        manifest_store.advance_boundary(1).await.unwrap();
+
+        let metrics = Arc::new(DefaultMetricsRecorder::new());
+        let recorder = MetricsRecorderHelper::new(metrics.clone(), Default::default());
+        let stats = Arc::new(GcStats::new(&recorder));
+        stats.gc_manifest_versions.set(-1);
+        let task = ManifestGcTask::new(
+            manifest_store.clone(),
+            stats,
+            GarbageCollectorDirectoryOptions {
+                min_age: Duration::ZERO,
+                interval: None,
+                dry_run: false,
+            },
+            None,
+            true,
+        );
+
+        let error = task
+            .collect(Utc::now() + TimeDelta::hours(1))
+            .await
+            .unwrap_err();
+        assert!(matches!(
+            error,
+            SlateDBError::ObjectStoreError(error)
+                if matches!(error.as_ref(), object_store::Error::NotImplemented { .. })
+        ));
+
+        let raw_boundary = object_store
+            .get(&Path::from("/root/gc/manifest.boundary"))
+            .await
+            .unwrap()
+            .bytes()
+            .await
+            .unwrap();
+        assert_eq!("1", std::str::from_utf8(&raw_boundary).unwrap());
+        assert_eq!(
+            manifest_store
+                .list_manifests(..)
+                .await
+                .unwrap()
+                .iter()
+                .map(|manifest| manifest.id)
+                .collect::<Vec<_>>(),
+            vec![1, 2, 3]
+        );
+        assert_eq!(
+            lookup_metric_with_labels(
+                &metrics,
+                crate::garbage_collector::stats::VERSION_COUNT,
+                &[("resource", "manifest")]
+            ),
+            Some(3)
+        );
+    }
+
     #[tokio::test]
     async fn test_version_count_unchanged_on_dry_run() {
         let (manifest_store, mut stored) = make_manifest_store().await;
```

---

### Incident Patch 5: `806c881c` (2026-09-14)
**Commit Message**: Fix descending scan behavior in the sorted run iterator (#2067)

**File**: `slatedb-dst/src/utils.rs` (modified, +5/-3)
```diff
@@ -93,9 +93,11 @@ pub fn build_reader_options(rand: &DbRand) -> DbReaderOptions {
 pub fn build_scan_options(rand: &DbRand, read_durability: DurabilityLevel) -> ScanOptions {
     let mut rng = rand.rng();
     let read_ahead_options = [1, 4 * 1024, 64 * 1024, MIB_1];
-    // Descending sorted-run iteration is currently broken.
-    // See https://github.com/slatedb/slatedb/pull/1995.
-    let order = IterationOrder::Ascending;
+    let order = if rng.random_bool(0.5) {
+        IterationOrder::Ascending
+    } else {
+        IterationOrder::Descending
+    };
 
     ScanOptions::new()
         .with_durability_filter(read_durability)
```

**File**: `slatedb/src/db.rs` (modified, +59/-0)
```diff
@@ -2599,6 +2599,39 @@ mod tests {
         kv_store.close().await.unwrap();
     }
 
+    #[tokio::test]
+    async fn test_seek_rejected_for_descending_scan() {
+        let object_store: Arc<dyn ObjectStore> = Arc::new(InMemory::new());
+        let kv_store = Db::builder("/tmp/test_seek_descending_rejected", object_store)
+            .with_settings(test_db_options(0, 1024, None))
+            .build()
+            .await
+            .unwrap();
+
+        kv_store.put(b"a", b"v0").await.unwrap();
+        kv_store.put(b"b", b"v1").await.unwrap();
+        kv_store.put(b"c", b"v2").await.unwrap();
+
+        let scan_options = ScanOptions::default().with_order(IterationOrder::Descending);
+        let mut iter = kv_store.scan_with_options(.., &scan_options).await.unwrap();
+        let err = iter.seek(b"b").await.unwrap_err();
+        assert_eq!(err.kind(), crate::ErrorKind::Invalid);
+        assert!(
+            err.to_string().contains("descending"),
+            "unexpected error: {err}"
+        );
+
+        // the scan itself still works
+        assert_eq!(iter.next().await.unwrap().unwrap().key.as_ref(), b"c");
+
+        // ascending scans still seek
+        let mut iter = kv_store.scan(..).await.unwrap();
+        iter.seek(b"b").await.unwrap();
+        assert_eq!(iter.next().await.unwrap().unwrap().key.as_ref(), b"b");
+
+        kv_store.close().await.unwrap();
+    }
+
     #[tokio::test]
     async fn test_scan_descending_bounded_range() {
         let object_store: Arc<dyn ObjectStore> = Arc::new(InMemory::new());
@@ -9465,10 +9498,23 @@ mod tests {
             .await
             .unwrap()
             .unwrap();
+        // A descending scan visits the SR's SSTs back to front, so the key's
+        // versions arrive out of sequence order unless the SR iterator
+        // reassembles them across the boundary.
+        let desc_options = ScanOptions::default().with_order(IterationOrder::Descending);
+        let data_scan_desc = db
+            .scan_with_options(b"k".as_slice().., &desc_options)
+            .await
+            .unwrap()
+            .next()
+            .await
+            .unwrap()
+            .unwrap();
         info!("data: {:?}", data);
         info!("data (scan): {:?}", data_scan.value);
         assert_eq!(data, expected);
         assert_eq!(data_scan.value, expected);
+        assert_eq!(data_scan_desc.value, expected);
     }
 
     #[cfg(feature = "wal_disable")]
@@ -9621,10 +9667,23 @@ mod tests {
             .await
             .unwrap()
             .unwrap();
+        // Same key, scanned the other way: the merge operands must still be
+        // applied newest last, which requires the SR iterator to pull the
+        // key's earlier SST before emitting anything.
+        let desc_options = ScanOptions::default().with_order(IterationOrder::Descending);
+        let data_scan_desc = db
+            .scan_with_options(b"k".as_slice().., &desc_options)
+            .await
+            .unwrap()
+            .next()
+            .await
+            .unwrap()
+            .unwrap();
         info!("data: {:?}", data);
         info!("data (scan): {:?}", data_scan.value);
         assert_eq!(data, expected);
         assert_eq!(data_scan.value, expected);
+        assert_eq!(data_scan_desc.value, expected);
     }
 
     #[tokio::test]
```

**File**: `slatedb/src/db_iter.rs` (modified, +122/-12)
```diff
@@ -49,11 +49,11 @@ impl DbIteratorRangeTracker {
     }
 }
 
-/// Sources for a point lookup, in newest-first order.
-/// The stream initializes each source before it yields the source.
-///
-/// `Mutex` makes this stream `Sync`, as [`RowEntryIterator`] requires.
-/// The code accesses `Mutex` only through `get_mut`, so it never locks.
+/// Sources for a point lookup, in newest-first order.
+/// The stream initializes each source before it yields the source.
+///
+/// `Mutex` makes this stream `Sync`, as [`RowEntryIterator`] requires.
+/// The code accesses `Mutex` only through `get_mut`, so it never locks.
 type InitializedSources =
     Mutex<BoxStream<'static, Result<Box<dyn RowEntryIterator + 'static>, SlateDBError>>>;
 
@@ -173,14 +173,18 @@ impl RowEntryIterator for GetIterator {
             let iter = self.current.as_mut().expect("source set above");
 
             if let Some(entry) = iter.next().await? {
-                // Note: The Get iterator should not advance past tombstones, which is
-                // why we filter them out here. When a tombstone is encountered, we return None
-                // so the iterator stops without advancing to the next iterator in the chain.
                 match &entry.value {
-                    ValueDeletable::Tombstone => {
-                        return Ok(None);
+                    ValueDeletable::Value(_) | ValueDeletable::Tombstone => {
+                        // Merge operands need their base, but no older entries.
+                        // Drop the remaining sources and any pending initialization.
+                        self.current = None;
+                        *self.sources.get_mut() = stream::empty().boxed();
+                        if entry.value.is_tombstone() {
+                            return Ok(None);
+                        }
+                        return Ok(Some(entry));
                     }
-                    _ => {
+                    ValueDeletable::Merge(_) => {
                         return Ok(Some(entry));
                     }
                 }
@@ -249,6 +253,7 @@ pub struct DbIterator {
     iter: Box<dyn RowEntryIterator + 'static>,
     invalidated_error: Option<SlateDBError>,
     last_key: Option<Bytes>,
+    order: IterationOrder,
     read_span: tracing::Span,
 }
 
@@ -323,6 +328,7 @@ impl DbIterator {
             iter,
             invalidated_error: None,
             last_key: None,
+            order,
             read_span,
         })
     }
@@ -395,10 +401,14 @@ impl DbIterator {
     /// After a successful seek, the iterator will return the next record
     /// with a key greater than or equal to `next_key`.
     ///
+    /// Only supported for ascending scans. Descending scans return an error
+    /// because the merge and sorted-run iterators only seek in ascending order.
+    ///
     /// # Errors
     ///
     /// Returns an invalid argument error in the following cases:
     ///
+    /// - if the scan was opened with [`IterationOrder::Descending`]
     /// - if `next_key` comes before the current iterator position
     /// - if `next_key` is beyond the upper bound specified in the original
     ///   [`crate::db::Db::scan`] parameters
@@ -408,6 +418,8 @@ impl DbIterator {
         let next_key = next_key.as_ref();
         if let Some(error) = self.invalidated_error.clone() {
             Err(error.into())
+        } else if matches!(self.order, IterationOrder::Descending) {
+            Err(SlateDBError::SeekNotSupportedForDescendingScan.into())
         } else if !self.range.contains(&next_key) {
             Err(SlateDBError::SeekKeyOutOfRange {
                 key: next_key.to_vec(),
@@ -534,12 +546,14 @@ mod tests {
     use crate::db_iter::{DbIterator, GetIterator};
     use crate::error::SlateDBError;
     use crate::iter::{EmptyIterator, IterationOrder, RowEntryIterator};
+    use crate::merge_operator::MergeOperatorType;
     use crate::reader::ReadTrace;
-    use crate::test_utils::TestIt
```

**File**: `slatedb/src/error.rs` (modified, +4/-0)
```diff
@@ -210,6 +210,9 @@ pub(crate) enum SlateDBError {
     #[error("cannot seek to a key less than the last returned key")]
     SeekKeyLessThanLastReturnedKey,
 
+    #[error("seek is not supported for descending scans")]
+    SeekNotSupportedForDescendingScan,
+
     #[error(
         "parent path must be different from the clone's path. parent_path=`{0}`, clone_path=`{0}`"
     )]
@@ -669,6 +672,7 @@ impl From<SlateDBError> for Error {
             SlateDBError::CheckpointLifetimeTooShort { .. } => Error::invalid(msg),
             SlateDBError::SeekKeyOutOfRange { .. } => Error::invalid(msg),
             SlateDBError::SeekKeyLessThanLastReturnedKey => Error::invalid(msg),
+            SlateDBError::SeekNotSupportedForDescendingScan => Error::invalid(msg),
             SlateDBError::IdenticalClonePaths { .. } => Error::invalid(msg),
             SlateDBError::DuplicatedCloneSourcePath(_) => Error::invalid(msg),
             SlateDBError::InvalidCloneSourceWithWal { .. } => Error::invalid(msg),
```

**File**: `slatedb/src/segment_iterator.rs` (modified, +0/-3)
```diff
@@ -52,9 +52,6 @@ impl SegmentScanContext {
 /// the per-segment merge can preserve key-by-key ordering across both
 /// tiers. Point lookups skip this entirely and build their own flat
 /// chain via [`crate::db_iter::GetIterator::from_lsm_tree`].
-///
-/// Descending scans over sorted runs are broken until
-/// [`SortedRunIterator`] supports descending iteration.
 struct RangeTreeIterators {
     l0: VecDeque<Box<dyn RowEntryIterator>>,
     sr: VecDeque<Box<dyn RowEntryIterator>>,
```

---

### Incident Patch 6: `114509a8` (2026-09-10)
**Commit Message**: fix clippy issues when no cache feature enabled (#2090)

**File**: `slatedb/Cargo.toml` (modified, +5/-0)
```diff
@@ -144,6 +144,7 @@ harness = false
 [[bench]]
 name = "scan_prefix_bench"
 harness = false
+required-features = ["foyer"]
 
 [[bench]]
 name = "scan_prefix_large_sorted_run_bench"
@@ -165,3 +166,7 @@ harness = false
 
 [lints]
 workspace = true
+
+[[test]]
+name = "foyer_cache_flush"
+required-features = ["foyer"]
\ No newline at end of file
```

**File**: `slatedb/src/db_cache/mod.rs` (modified, +71/-51)
```diff
@@ -5,7 +5,7 @@
 //!
 //! There are currently two built-in cache implementations:
 //! - [Foyer](crate::db_cache::foyer::FoyerCache): Requires the `foyer` feature flag. (Enabled by default)
-//! - [Moka](crate::db_cache::moka::MokaCache): Requires the `moka` feature flag. (Enabled by default)
+//! - [Moka](crate::db_cache::moka::MokaCache): Requires the `moka` feature flag.
 //!
 //! ## Usage
 //!
@@ -1290,10 +1290,18 @@ mod tests {
 
     use crate::flatbuffer_types::test_utils::assert_index_clamped;
 
+    #[cfg(feature = "foyer")]
+    use super::foyer::FoyerCache;
+    #[cfg(feature = "foyer")]
+    use super::foyer_hybrid::FoyerHybridCache;
+    #[cfg(feature = "moka")]
+    use super::moka::MokaCache;
     use crate::db_cache::test_utils::TestCache;
     use crate::format::sst::{EncodedSsTable, SsTableFormat};
     use crate::test_utils::build_test_sst;
     use crate::types::{RowEntry, ValueDeletable};
+    #[cfg(feature = "foyer")]
+    use foyer::HybridCacheBuilder;
     use rstest::{fixture, rstest};
     use slatedb_common::metrics::{
         lookup_metric_with_labels, DefaultMetricsRecorder, MetricLevel, MetricsRecorderHelper,
@@ -1413,65 +1421,77 @@ mod tests {
         }
     }
 
+    #[rstest]
+    #[case::test_cache(Arc::new(TestCache::new()), true)]
+    #[case::split_cache(Arc::new(SplitCache::new()), false)]
+    #[case::split_cache_with_delegates(
+        Arc::new(
+            SplitCache::new()
+                .with_block_cache(Some(Arc::new(TestCache::new())))
+                .with_meta_cache(Some(Arc::new(TestCache::new())))
+        ),
+        true
+    )]
+    #[cfg_attr(feature = "foyer", case::foyer(Arc::new(FoyerCache::new()), true))]
+    #[cfg_attr(
+        feature = "foyer",
+        case::foyer_hybrid(
+            Arc::new(FoyerHybridCache::new_with_cache(
+                HybridCacheBuilder::new()
+                    .memory(1024 * 1024)
+                    .with_weighter(|_, v: &CachedEntry| v.size())
+                    .storage()
+                    .build()
+                    .await
+                    .unwrap()
+            )),
+            true
+        )
+    )]
+    #[cfg_attr(feature = "moka", case::moka(Arc::new(MokaCache::new()), true))]
     #[tokio::test]
-    async fn test_fetch_lookup_outcomes() {
-        let mut caches: Vec<(Arc<dyn DbCache>, bool)> = vec![
-            (Arc::new(TestCache::new()), true),
-            (Arc::new(SplitCache::new()), false),
-            (
-                Arc::new(
-                    SplitCache::new()
-                        .with_block_cache(Some(Arc::new(TestCache::new())))
-                        .with_meta_cache(Some(Arc::new(TestCache::new()))),
-                ),
-                true,
-            ),
-        ];
-        #[cfg(feature = "foyer")]
-        caches.push((Arc::new(super::foyer::FoyerCache::new()), true));
-        #[cfg(feature = "moka")]
-        caches.push((Arc::new(super::moka::MokaCache::new()), true));
-
-        for (cache, retains_entries) in caches {
-            for (offset, method) in ["data_block", "index", "filter", "stats"]
-                .into_iter()
-                .enumerate()
-            {
-                let key = CachedKey::from((SST_ID, offset as u64));
-                let mut builder = BlockBuilder::new_latest(4096);
-                assert!(builder
-                    .add(RowEntry::new_value(b"key", b"value", 0))
-                    .unwrap());
-                let block = Arc::new(builder.build().unwrap());
-                for attempt in 0..2 {
-                    let entry = CachedEntry::with_block(block.clone());
-                    let loader: CacheLoader = Box::new(move || Box::pin(async move { Ok(entry) }));
-                    let fetch = match method {
-                        "data_block" => cache.fetch_block(key.clone(), loader).await,
-                        "index" => cache.fetch_index(key.clone(), loader).await,
-                        "filter" => cache.fetc
```

---

### Incident Patch 7: `ef78d637` (2026-09-10)
**Commit Message**: Fix pause ordering in writer fencing test (#2088)

**File**: `slatedb/src/fence.rs` (modified, +3/-6)
```diff
@@ -487,11 +487,9 @@ mod tests {
             .replay_after_wal_id;
         h.run_gc(replay_after_wal_id).await;
 
-        // resume the fencer. re-issuing "pause" wakes the current pause and
-        // keeps the action set to "pause" so the next toggled event also
-        // pauses.
-        fail_parallel::cfg(h.fp_registry.clone(), "LoadEmptyWalId", "pause").unwrap();
-        fail_parallel::cfg(h.fp_registry.clone(), case.pause_event, "pause").unwrap();
+        // Resume the fencer, but keep the case's pause active until the new writer takes ownership.
+        // Setting "pause" again can release the fencer if it already reached that pause.
+        fail_parallel::cfg(h.fp_registry.clone(), "LoadEmptyWalId", "off").unwrap();
 
         // wait for the case's pause event. fp_notify sends an event for every
         // failpoint regardless of whether it pauses, so drain intermediate
@@ -528,7 +526,6 @@ mod tests {
         }
 
         // resume the fencer
-        fail_parallel::cfg(h.fp_registry.clone(), "LoadEmptyWalId", "off").unwrap();
         fail_parallel::cfg(h.fp_registry.clone(), case.pause_event, "off").unwrap();
 
         // validate that its fenced — the fencer's manifest.refresh sees the new db's
```

---

### Incident Patch 8: `4a37688a` (2026-09-09)
**Commit Message**: Stream L0 flush blocks instead of building the whole SST in memory (#2064)

**File**: `slatedb/src/compaction_execute_bench.rs` (modified, +1/-1)
```diff
@@ -177,7 +177,7 @@ impl CompactionExecuteBench {
             let row_entry = RowEntry::new(key, ValueDeletable::Value(val.into()), 0, None, None);
             sst_writer.add(row_entry).await?;
         }
-        let sst = sst_writer.close().await?;
+        let (sst, _) = sst_writer.close().await?;
         let elapsed_ms = system_clock
             .now()
             .signed_duration_since(start)
```

**File**: `slatedb/src/compactor_executor.rs` (modified, +4/-4)
```diff
@@ -860,7 +860,7 @@ impl TokioCompactionExecutorInner {
                     format!("compactor_sst_close:{:?}", finished_writer.id()),
                     &self.handle,
                     |_| {},
-                    async move { finished_writer.close().await },
+                    async move { finished_writer.close().await.map(|(sst, _)| sst) },
                 )));
                 bytes_written = 0;
                 let total_bytes = start_bytes_processed + all_iter.bytes_processed();
@@ -877,7 +877,7 @@ impl TokioCompactionExecutorInner {
             self.collect_close(pending, &mut output_ssts).await?;
         }
         if !current_writer.is_drained() {
-            let sst = current_writer.close().await?;
+            let (sst, _) = current_writer.close().await?;
 
             self.worker_stats
                 .bytes_compacted
@@ -1064,7 +1064,7 @@ mod tests {
             }
 
             if bytes_written > max_sst_size {
-                output_ssts.push(writer.close().await.unwrap());
+                output_ssts.push(writer.close().await.unwrap().0);
                 bytes_written = 0;
 
                 if index + 1 < entries.len() {
@@ -1076,7 +1076,7 @@ mod tests {
             }
         }
 
-        output_ssts.push(writer.close().await.unwrap());
+        output_ssts.push(writer.close().await.unwrap().0);
         output_ssts
     }
 
```

**File**: `slatedb/src/flush.rs` (modified, +316/-138)
```diff
@@ -1,155 +1,224 @@
 use crate::db::DbInner;
-use crate::db_state;
-use crate::db_state::SsTableHandle;
+use crate::db_state::{SsTableHandle, SsTableId};
 use crate::error::SlateDBError;
+#[cfg(test)]
 use crate::format::sst::EncodedSsTable;
 use crate::iter::RowEntryIterator;
 use crate::mem_table::KVTable;
 use crate::merge_operator::{MergeOperatorIterator, MergeOperatorRequiredIterator};
 use crate::oracle::Oracle;
 use crate::reader::DbStateReader;
 use crate::retention_iterator::RetentionIterator;
+use crate::tablestore::EncodedSsTableWriter;
 use bytes::Bytes;
+use log::warn;
+use std::collections::BTreeMap;
 use std::sync::Arc;
+use ulid::Ulid;
+
+/// Best-effort cleanup after a writer fails partway through.
+///
+/// Tells object storage to discard any part of this SST already
+/// uploaded. If the abort call itself fails, only logs a warning. The
+/// caller returns its original error either way.
+async fn abort_writer(writer: &mut EncodedSsTableWriter) {
+    if let Err(e) = writer.abort().await {
+        warn!("failed to abort sst writer after error [error={:?}]", e);
+    }
+}
 
-/// One encoded-but-not-yet-uploaded SST from a memtable flush, tagged with
-/// the segment it belongs to (RFC-0024). Mirrors the shape of post-upload
-/// [`crate::memtable_flusher::uploader::SegmentedSstHandle`].
-pub(crate) struct EncodedSegmentSst {
+/// One uploaded SST from a memtable flush, tagged with the segment it
+/// belongs to (RFC-0024). An empty `prefix` denotes the compatibility-encoded
+/// `prefix=""` segment whose state lives in the manifest's top-level tree.
+#[derive(Clone)]
+pub(crate) struct SegmentedSstHandle {
     pub(crate) prefix: Bytes,
-    pub(crate) encoded: EncodedSsTable,
+    pub(crate) sst_handle: SsTableHandle,
+    pub(crate) encoded_bytes: u64,
 }
 
 impl DbInner {
-    /// Build a single SST from an immutable memtable, ignoring any segment
-    /// extractor. Returns `None` when the post-retention iterator yields
-    /// zero entries — callers that want a real blob (e.g. the WAL fence)
-    /// should construct one explicitly rather than relying on this path.
-    /// For L0 flushes use [`Self::build_imm_ssts`] instead, which routes
-    /// entries through segment-aware builders.
-    async fn build_imm_sst(
-        &self,
-        imm_table: Arc<KVTable>,
-    ) -> Result<Option<EncodedSsTable>, SlateDBError> {
-        let mut sst_builder = self.table_store.table_builder();
-        let mut iter = self.iter_imm_table(imm_table).await?;
-        let mut any = false;
-        while let Some(entry) = iter.next().await? {
-            sst_builder.add(entry).await?;
-            any = true;
-            // Keep cached flush work cooperative.
-            tokio::task::coop::consume_budget().await;
-        }
-        if !any {
-            return Ok(None);
-        }
-        Ok(Some(sst_builder.build().await?))
-    }
-
-    /// Build one or more L0 SSTs from a single immutable memtable, grouping
-    /// entries by the segment prefix derived from the configured extractor.
+    /// Write this memtable's post-retention entries to object storage.
     ///
-    /// Returns one `(prefix, EncodedSsTable)` per segment that received at
-    /// least one post-retention entry, sorted ascending by `prefix`. The
-    /// memtable iterator yields keys in sorted order and segments own
-    /// disjoint key intervals, so all entries for a given prefix arrive
-    /// consecutively — the implementation streams one open builder at a
-    /// time, finalizing on prefix transitions.
+    /// Hands the SST to the writer one block at a time, so peak memory
+    /// is bounded by the writer's buffer (10 MiB) rather than the whole
+    /// encoded SST. An SST that fits in that buffer still stays fully
+    /// buffered until close; the saving is for SSTs larger than it.
     ///
-    /// The touched-segment set is read from
-    /// [`KVTable::touched_segments`], populated by the write and
-    /// WAL-replay paths. A 
```

**File**: `slatedb/src/memtable_flusher/manifest_writer.rs` (modified, +3/-1)
```diff
@@ -893,10 +893,11 @@ mod tests {
     use crate::db::DbInner;
     use crate::db_status::{ClosedResultWriter, DbStatusManager};
     use crate::error::SlateDBError;
+    use crate::flush::SegmentedSstHandle;
     use crate::format::sst::SsTableFormat;
     use crate::manifest::store::{FenceableManifest, ManifestStore, StoredManifest};
     use crate::manifest::ManifestCore;
-    use crate::memtable_flusher::uploader::{SegmentedSstHandle, UploadedMemtable};
+    use crate::memtable_flusher::uploader::UploadedMemtable;
     use crate::paths::PathResolver;
     use crate::tablestore::{TableStore, TableStoreKind};
     use crate::types::RowEntry;
@@ -1834,6 +1835,7 @@ mod tests {
             segments.push(SegmentedSstHandle {
                 prefix: Bytes::copy_from_slice(prefix),
                 sst_handle,
+                encoded_bytes: encoded_sst.remaining_len() as u64,
             });
         }
         inner.oracle.advance_durable_seq(last_seq);
```

**File**: `slatedb/src/memtable_flusher/uploader.rs` (modified, +237/-77)
```diff
@@ -13,12 +13,14 @@
 
 use super::tracker::TrackerMessage;
 use crate::db::DbInner;
-use crate::db_state::{SsTableHandle, SsTableId};
+#[cfg(test)]
+use crate::db_state::SsTableHandle;
 use crate::db_status::ClosedResultWriter;
 use crate::dispatcher::{MessageHandler, MessageHandlerExecutor};
 use crate::error::SlateDBError;
-use crate::flush::EncodedSegmentSst;
+use crate::flush::SegmentedSstHandle;
 use crate::mem_table::ImmutableMemtable;
+use crate::retrying_object_store::RetryingObjectStore;
 use crate::utils::SafeSender;
 use async_trait::async_trait;
 use bytes::Bytes;
@@ -33,6 +35,32 @@ use ulid::Ulid;
 
 const UPLOADER_TASK_NAME: &str = "l0_sst_uploader";
 
+// `BufWriter` wraps an `object_store::Error` inside `std::io::Error` through
+// `AsyncWrite`. Find the original error before applying the shared retry rule.
+// Without this step, `NotSupported` can retry forever.
+fn should_retry_upload_error(error: &SlateDBError) -> bool {
+    match error {
+        SlateDBError::ObjectStoreError(error) => RetryingObjectStore::should_retry(error),
+        SlateDBError::IoError(error) => {
+            let Some(source) = error.get_ref() else {
+                return true;
+            };
+            let mut source: Option<&(dyn std::error::Error + 'static)> = Some(source);
+            while let Some(error) = source {
+                if let Some(error) = error.downcast_ref::<object_store::Error>() {
+                    return RetryingObjectStore::should_retry(error);
+                }
+                if let Some(error) = error.downcast_ref::<Arc<object_store::Error>>() {
+                    return RetryingObjectStore::should_retry(error);
+                }
+                source = error.source();
+            }
+            true
+        }
+        _ => false,
+    }
+}
+
 /// One immutable-memtable upload request submitted to the uploader. Physical
 /// SST ids are allocated at dispatch (in sequence order) and carried here, so
 /// the parallel upload workers never mint ids out of publish order (RFC-0029).
@@ -63,15 +91,6 @@ impl UploadJob {
     }
 }
 
-/// One uploaded SST from a memtable flush, tagged with the segment it
-/// belongs to (RFC-0024). An empty `prefix` denotes the compatibility-encoded
-/// `prefix=""` segment whose state lives in the manifest's top-level tree.
-#[derive(Clone)]
-pub(crate) struct SegmentedSstHandle {
-    pub(crate) prefix: Bytes,
-    pub(crate) sst_handle: SsTableHandle,
-}
-
 #[derive(Clone)]
 /// Result of a successfully uploaded immutable memtable. A flush produces
 /// one [`SegmentedSstHandle`] per segment that received at least one
@@ -105,6 +124,7 @@ impl UploadedMemtable {
             segments: vec![SegmentedSstHandle {
                 prefix: Bytes::new(),
                 sst_handle,
+                encoded_bytes: 0,
             }],
             first_seq,
             last_seq,
@@ -189,10 +209,10 @@ impl UploadHandler {
     }
 
     async fn upload_with_retry(&self, job: &UploadJob) -> Result<UploadedMemtable, SlateDBError> {
-        // Build once, retry only the upload. `write_sst` takes
-        // `&EncodedSsTable`, so the encoded SSTs stay alive for retries —
-        // no need to rebuild from the memtable on transient upload errors.
-        let built = self.db.build_imm_ssts(job.imm_memtable.table()).await?;
+        // Read the retention boundary once, before the first attempt
+        // below. Every retry reuses this same value, so every attempt
+        // keeps the same entries.
+        let min_retention_seq = self.db.compute_min_retention_seq();
         let first_seq = job
             .imm_memtable
             .table()
@@ -204,72 +224,40 @@ impl UploadHandler {
             .last_seq()
             .expect("flush of l0 with no entries");
 
-        // Upload all segment SSTs concurrently. `try_join_all` short-circuits
-        // on the first fatal error and drops the remaining futures; sibling
-        // uploads that already landed before the a
```

---

### Incident Patch 9: `4919857e` (2026-08-29)
**Commit Message**: docs: fix typo wihtout -> without (#2057)

**File**: `slatedb/src/retrying_object_store.rs` (modified, +1/-1)
```diff
@@ -266,7 +266,7 @@ impl ObjectStore for RetryingObjectStore {
 
             if options_range.is_none() {
                 // No range requested — don't buffer the body. The buffer size
-                // can't be validated wihtout buffering.
+                // can't be validated without buffering.
                 return Ok(result);
             }
 
```

---

### Incident Patch 10: `ae07acd4` (2026-08-26)
**Commit Message**: fix: preserve sequence tracker interval after deserialization (#2053)

**File**: `slatedb/src/seq_tracker.rs` (modified, +18/-0)
```diff
@@ -289,6 +289,7 @@ fn decode_sequence_tracker(buf: &[u8]) -> Result<SequenceTracker, String> {
     let mut tracker = SequenceTracker::with_config(DEFAULT_CAPACITY, DEFAULT_INTERVAL_SECS);
     tracker.sequence_numbers = sequence_numbers;
     tracker.timestamps = timestamps;
+    tracker.last_recorded_ts = tracker.timestamps.last().copied();
 
     Ok(tracker)
 }
@@ -779,6 +780,23 @@ mod tests {
         assert_eq!(decoded.timestamps, tracker.timestamps);
     }
 
+    #[test]
+    fn deserialize_preserves_the_recording_interval() {
+        let mut tracker = SequenceTracker::new();
+        tracker.insert(TrackedSeq {
+            seq: 0,
+            ts: DateTime::from_timestamp(1_600_000_060, 0).unwrap(),
+        });
+
+        let mut decoded = SequenceTracker::from_bytes(&tracker.to_bytes()).unwrap();
+        decoded.insert(TrackedSeq {
+            seq: 1,
+            ts: DateTime::from_timestamp(1_600_000_061, 0).unwrap(),
+        });
+
+        assert_eq!(decoded.sequence_numbers, vec![0]);
+    }
+
     #[rstest]
     #[case::empty_sequences(vec![])]
     #[case::single_sequence(vec![1000])]
```

#### Recent Merged Pull Requests:
- **PR #2135** (2026-09-29): ci(python): drop s390x wheel build (@criccomini)
- **PR #2134** (2026-09-29): fix: preserve unread views when merging compaction watermarks (@geeknarrator)
- **PR #2116** (2026-09-25): feat(uniffi): expose Admin::delete_db (@sinbad-io)
- **PR #2114** (2026-09-25): Add Tasklet to adopters (@rockwotj)
- **PR #2113** (2026-09-25): fix(clone): don't carry inherited external dbs that hold no SSTs (@sinbad-io)
- **PR #2111** (closed): Pass WAL and fence retention policies to `WalGc` in one request so both share a single WAL listing (@criccomini)
- **PR #2108** (2026-09-28): Add an optional sorted-run count trigger for compaction (@geeknarrator)
- **PR #2107** (2026-09-25): Fix clock inheritance in union clones (@geeknarrator)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): open-policy-agent/opa

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-policy-agent-opa-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-policy-agent/opa](https://github.com/open-policy-agent/opa))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:29:25.448Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-policy-agent/opa`
- **Description**: Open Policy Agent (OPA) is an open source, general-purpose policy engine.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 12296 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ast/ast.go`
```
// Copyright 2026 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

// Deprecated: This package is intended for older projects transitioning from OPA v0.x and will remain for the lifetime of OPA v1.x, but its use is not recommended.
// For newer features and behaviours, such as defaulting to the Rego v1 syntax, use the corresponding components in the [github.com/open-policy-agent/opa/v1] package instead.
// See https://www.openpolicyagent.org/docs/latest/v0-compatibility/ for more information.
package ast

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"

	astJSON "github.com/open-policy-agent/opa/ast/json"
	v1 "github.com/open-policy-agent/opa/v1/ast"
)

type (
	// Annotations represents metadata attached to other AST nodes such as rules.
	Annotations = v1.Annotations

	// SchemaAnnotation contains a schema declaration for the document identified by the path.
	SchemaAnnotation = v1.SchemaAnnotation

	AuthorAnnotation = v1.AuthorAnnotation

	RelatedResourceAnnotation = v1.RelatedResourceAnnotation

	AnnotationSet = v1.AnnotationSet

	AnnotationsRef = v1.AnnotationsRef

	AnnotationsRefSet = v1.AnnotationsRefSet

	FlatAnnotationsRefSet = v1.FlatAnnotationsRefSet
)

func NewAnnotationsRef(a *Annotations) *AnnotationsRef {
	return v1.NewAnnotationsRef(a)
}

func BuildAnnotationSet(modules []*Module) (*AnnotationSet, Errors) {
	return v1.BuildAnnotationSet(modules)
}

// Builtins is the registry of built-in functions supported by OPA.
// Call RegisterBuiltin to add a new built-in.
var Builtins = v1.Builtins

// RegisterBuiltin adds a new built-in function to the registry.
func RegisterBuiltin(b *Builtin) {
	v1.RegisterBuiltin(b)
}

// DefaultBuiltins is the registry of built-in functions supported in OPA
// by default. When adding a new built-in function to OPA, update this
// list.
var DefaultBuiltins = v1.DefaultBuiltins

// BuiltinMap provides a convenient mapping of built-in names to
// built-in definitions.
var BuiltinMap = v1.BuiltinMap

// Deprecated: Builtins can now be directly annotated with the
// Nondeterministic property, and when set to true, will be ignored
// for partial evaluation.
var IgnoreDuringPartialEval = v1.IgnoreDuringPartialEval

/**
 * Unification
 */

// Equality represents the "=" operator.
var Equality = v1.Equality

/**
 * Assignment
 */

// Assign represents the assignment (":=") operator.
var Assign = v1.Assign

// Member represents the `in` (infix) operator.
var Member = v1.Member

// MemberWithKey represents the `in` (infix) operator when used
// with two terms on the lhs, i.e., `k, v in obj`.
var MemberWithKey = v1.MemberWithKey

var GreaterThan = v1.GreaterThan

var GreaterThanEq = v1.GreaterThanEq

// LessThan represents the "<" comparison operator.
var LessThan = v1.LessThan

var LessThanEq = v1.LessThanEq

var NotEqual = v1.NotEqual

// Equal represents the "==" comparison operator.
var Equal = v1.Equal

var Plus = v1.Plus

var Minus = v1.Minus

var Multiply = v1.Multiply

var Divide = v1.Divide

var Round = v1.Round

var Ceil = v1.Ceil

var Floor = v1.Floor

var Abs = v1.Abs

var Rem = v1.Rem

/**
 * Bitwise
 */

var BitsOr = v1.BitsOr

var BitsAnd = v1.BitsAnd

var BitsNegate = v1.BitsNegate

var BitsXOr = v1.BitsXOr

var BitsShiftLeft = v1.BitsShiftLeft

var BitsShiftRight = v1.BitsShiftRight

/**
 * Sets
 */

var And = v1.And

// Or performs a union operation on sets.
var Or = v1.Or

var Intersection = v1.Intersection

var Union = v1.Union

/**
 * Aggregates
 */

var Count = v1.Count

var Sum = v1.Sum

var Product = v1.Product

var Max = v1.Max

var Min = v1.Min

/**
 * Sorting
 */

var Sort = v1.Sort

/**
 * Arrays
 */

var ArrayConcat = v1.ArrayConcat

var ArraySlice = v1.ArraySlice

var ArrayReverse = v1.ArrayReverse

/**
 * Conversions
 */

var ToNumber = v1.ToNumber

/**
 * Regular Expressions
 */

var RegexMatch = v1.RegexMatch

var RegexIsValid = v1.RegexIsValid

var RegexFindAllStringSubmatch = v1.RegexFindAllStringSubmatch

var RegexTemplateMatch = v1.RegexTemplateMatch

var RegexSplit = v1.RegexSplit

// RegexFind takes two strings and a number, the pattern, the value and number of match values to
// return, -1 means all match values.
var RegexFind = v1.RegexFind

// GlobsMatch takes two strings regexp-style strings and evaluates to true if their
// intersection matches a non-empty set of non-empty strings.
// Examples:
//   - "a.a." and ".b.b" -> true.
//   - "[a-z]*" and [0-9]+" -> not true.
var GlobsMatch = v1.GlobsMatch

/**
 * Strings
 */

var AnyPrefixMatch = v1.AnyPrefixMatch

var AnySuffixMatch = v1.AnySuffixMatch

var Concat = v1.Concat

var FormatInt = v1.FormatInt

var IndexOf = v1.IndexOf

var IndexOfN = v1.IndexOfN

var Substring = v1.Substring

var Contains = v1.Contains

var StringCount = v1.StringCount

var StartsWith = v1.StartsWith

var EndsWith = v1.EndsWith

var Lower = v1.Lower

var Upper = v1.Upper

var Split = v1.Split

var Replace = v1.Replace

var ReplaceN = v1.ReplaceN

var RegexReplace = v1.RegexReplace

var Trim = v1.Trim

var TrimLeft = v1.TrimLeft

var TrimPrefix = v1.TrimPrefix

var TrimRight = v1.TrimRight

var TrimSuffix = v1.TrimSuffix

var TrimSpace = v1.TrimSpace

var Sprintf = v1.Sprintf

var StringReverse = v1.StringReverse

var RenderTemplate = v1.RenderTemplate

/**
 * Numbers
 */

// RandIntn returns a random number 0 - n
// Marked non-deterministic because it relies on RNG internally.
var RandIntn = v1.RandIntn

var NumbersRange = v1.NumbersRange

var NumbersRangeStep = v1.NumbersRangeStep

/**
 * Units
 */

var UnitsParse = v1.UnitsParse

var UnitsParseBytes = v1.UnitsParseBytes

//
/**
 * Type
 */

// UUIDRFC4122 returns a version 4 UUID string.
// Marked non-deterministic because it relies on RNG internally.
var UUIDRFC4122 = v1.UUIDRFC4122

var UUIDParse = v1.UUIDParse

/**
 * JSON
 */

var JSONFilter = v1.JSONFilter

var JSONRemove = v1.JSONRemove

var JSONPatch = v1.JSONPatch

var ObjectSubset = v1.ObjectSubset

var ObjectUnion = v1.ObjectUnion

var ObjectUnionN = v1.ObjectUnionN

var ObjectRemove = v1.ObjectRemove

var ObjectFilter = v1.ObjectFilter

var ObjectGet = v1.ObjectGet

var ObjectKeys = v1.ObjectKeys

/*
 *  Encoding
 */

var JSONMarshal = v1.JSONMarshal

var JSONMarshalWithOptions = v1.JSONMarshalWithOptions

var JSONUnmarshal = v1.JSONUnmarshal

var JSONIsValid = v1.JSONIsValid

var Base64Encode = v1.Base64Encode

var Base64Decode = v1.Base64Decode

var Base64IsValid = v1.Base64IsValid

var Base64UrlEncode = v1.Base64UrlEncode

var Base64UrlEncodeNoPad = v1.Base64UrlEncodeNoPad

var Base64UrlDecode = v1.Base64UrlDecode

var URLQueryDecode = v1.URLQueryDecode

var URLQueryEncode = v1.URLQueryEncode

var URLQueryEncodeObject = v1.URLQueryEncodeObject

var URLQueryDecodeObject = v1.URLQueryDecodeObject

var YAMLMarshal = v1.YAMLMarshal

var YAMLUnmarshal = v1.YAMLUnmarshal

// YAMLIsValid verifies the input string is a valid YAML document.
var YAMLIsValid = v1.YAMLIsValid

var HexEncode = v1.HexEncode

var HexDecode = v1.HexDecode

/**
 * Tokens
 */

var JWTDecode = v1.JWTDecode

var JWTVerifyRS256 = v1.JWTVerifyRS256

var JWTVerifyRS384 = v1.JWTVerifyRS384

var JWTVerifyRS512 = v1.JWTVerifyRS512

var JWTVerifyPS256 = v1.JWTVerifyPS256

var JWTVerifyPS384 = v1.JWTVerifyPS384

var JWTVerifyPS512 = v1.JWTVerifyPS512

var JWTVerifyES256 = v1.JWTVerifyES256

var JWTVerifyES384 = v1.JWTVerifyES384

var JWTVerifyES512 = v1.JWTVerifyES512

var JWTVerifyHS256 = v1.JWTVerifyHS256

var JWTVerifyHS384 = v1.JWTVerifyHS384

var JWTVerifyHS512 = v1.JWTVerifyHS512

// Marked non-deterministic because it relies on time internally.
var JWTDecodeVerify = v1.JWTDecodeVerify

// Marked non-deterministic because it relies on RNG internally.
var JWTEncodeSignRaw = v1.JWTEncodeSignRaw

// Marked non-deterministic because it relies on RNG internally.
var JWTEncodeSign = v1.JWTEncodeSign

/**
 * Time
 */

// Marked non-deterministic because it relies on time directly.
var NowN
```

### Core Architecture Module: `ast/json/json.go`
```
// Copyright 2026 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

// Deprecated: This package is intended for older projects transitioning from OPA v0.x and will remain for the lifetime of OPA v1.x, but its use is not recommended.
// For newer features and behaviours, such as defaulting to the Rego v1 syntax, use the corresponding components in the [github.com/open-policy-agent/opa/v1] package instead.
// See https://www.openpolicyagent.org/docs/latest/v0-compatibility/ for more information.
package json

import (
	v1 "github.com/open-policy-agent/opa/v1/ast/json"
)

// Options defines the options for JSON operations,
// currently only marshaling can be configured
type Options = v1.Options

// MarshalOptions defines the options for JSON marshaling,
// currently only toggling the marshaling of location information is supported
type MarshalOptions = v1.MarshalOptions

// NodeToggle is a generic struct to allow the toggling of
// settings for different ast node types
type NodeToggle = v1.NodeToggle

```

### Core Architecture Module: `ast/location/location.go`
```
// Copyright 2026 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

// Deprecated: This package is intended for older projects transitioning from OPA v0.x and will remain for the lifetime of OPA v1.x, but its use is not recommended.
// For newer features and behaviours, such as defaulting to the Rego v1 syntax, use the corresponding components in the [github.com/open-policy-agent/opa/v1] package instead.
// See https://www.openpolicyagent.org/docs/latest/v0-compatibility/ for more information.
//
// Package location defines locations in Rego source code.
package location

import (
	v1 "github.com/open-policy-agent/opa/v1/ast"
)

// Location records a position in source code
type Location = v1.Location

// NewLocation returns a new Location object.
func NewLocation(text []byte, file string, row int, col int) *Location {
	return v1.NewLocation(text, file, row, col)
}

```

### Core Architecture Module: `bundle/bundle.go`
```
// Copyright 2026 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

// Package bundle implements bundle loading.
//
// Deprecated: This package is intended for older projects transitioning from OPA v0.x and will remain for the lifetime of OPA v1.x, but its use is not recommended.
// For newer features and behaviours, such as defaulting to the Rego v1 syntax, use the corresponding components in the [github.com/open-policy-agent/opa/v1] package instead.
// See https://www.openpolicyagent.org/docs/latest/v0-compatibility/ for more information.
//
// # Package bundle provide helpers that assist in creating the verification and signing key configuration
//
// # Package bundle provide helpers that assist in the creating a signed bundle
//
// Package bundle provide helpers that assist in the bundle signature verification process
package bundle

import (
	"context"
	"io"
	"io/fs"

	"github.com/open-policy-agent/opa/ast"
	"github.com/open-policy-agent/opa/storage"
	v1 "github.com/open-policy-agent/opa/v1/bundle"
)

// Common file extensions and file names.
const (
	RegoExt        = v1.RegoExt
	WasmFile       = v1.WasmFile
	PlanFile       = v1.PlanFile
	ManifestExt    = v1.ManifestExt
	SignaturesFile = v1.SignaturesFile

	DefaultSizeLimitBytes = v1.DefaultSizeLimitBytes
	DeltaBundleType       = v1.DeltaBundleType
	SnapshotBundleType    = v1.SnapshotBundleType
)

// Bundle represents a loaded bundle. The bundle can contain data and policies.
type Bundle = v1.Bundle

// Raw contains raw bytes representing the bundle's content
type Raw = v1.Raw

// Patch contains an array of objects wherein each object represents the patch operation to be
// applied to the bundle data.
type Patch = v1.Patch

// PatchOperation models a single patch operation against a document.
type PatchOperation = v1.PatchOperation

// SignaturesConfig represents an array of JWTs that encapsulate the signatures for the bundle.
type SignaturesConfig = v1.SignaturesConfig

// DecodedSignature represents the decoded JWT payload.
type DecodedSignature = v1.DecodedSignature

// FileInfo contains the hashing algorithm used, resulting digest etc.
type FileInfo = v1.FileInfo

// NewFile returns a new FileInfo.
func NewFile(name, hash, alg string) FileInfo {
	return v1.NewFile(name, hash, alg)
}

// Manifest represents the manifest from a bundle. The manifest may contain
// metadata such as the bundle revision.
type Manifest = v1.Manifest

// WasmResolver maps a wasm module to an entrypoint ref.
type WasmResolver = v1.WasmResolver

// ModuleFile represents a single module contained in a bundle.
type ModuleFile = v1.ModuleFile

// WasmModuleFile represents a single wasm module contained in a bundle.
type WasmModuleFile = v1.WasmModuleFile

// PlanModuleFile represents a single plan module contained in a bundle.
//
// NOTE(tsandall): currently the plans are just opaque binary blobs. In the
// future we could inject the entrypoints so that the plans could be executed
// inside of OPA proper like we do for Wasm modules.
type PlanModuleFile = v1.PlanModuleFile

// Reader contains the reader to load the bundle from.
type Reader = v1.Reader

// NewReader is deprecated. Use NewCustomReader instead.
func NewReader(r io.Reader) *Reader {
	return v1.NewReader(r).WithRegoVersion(ast.DefaultRegoVersion)
}

// NewCustomReader returns a new Reader configured to use the
// specified DirectoryLoader.
func NewCustomReader(loader DirectoryLoader) *Reader {
	return v1.NewCustomReader(loader).WithRegoVersion(ast.DefaultRegoVersion)
}

// Write is deprecated. Use NewWriter instead.
func Write(w io.Writer, bundle Bundle) error {
	return v1.Write(w, bundle)
}

// Writer implements bundle serialization.
type Writer = v1.Writer

// NewWriter returns a bundle writer that writes to w.
func NewWriter(w io.Writer) *Writer {
	return v1.NewWriter(w)
}

// Merge accepts a set of bundles and merges them into a single result bundle. If there are
// any conflicts during the merge (e.g., with roots) an error is returned. The result bundle
// will have an empty revision except in the special case where a single bundle is provided
// (and in that case the bundle is just returned unmodified.)
func Merge(bundles []*Bundle) (*Bundle, error) {
	return MergeWithRegoVersion(bundles, ast.DefaultRegoVersion, false)
}

// MergeWithRegoVersion creates a merged bundle from the provided bundles, similar to Merge.
// If more than one bundle is provided, the rego version of the result bundle is set to the provided regoVersion.
// Any Rego files in a bundle of conflicting rego version will be marked in the result's manifest with the rego version
// of its original bundle. If the Rego file already had an overriding rego version, it will be preserved.
// If a single bundle is provided, it will retain any rego version information it already had. If it has none, the
// provided regoVersion will be applied to it.
// If usePath is true, per-file rego-versions will be calculated using the file's ModuleFile.Path; otherwise, the file's
// ModuleFile.URL will be used.
func MergeWithRegoVersion(bundles []*Bundle, regoVersion ast.RegoVersion, usePath bool) (*Bundle, error) {
	if regoVersion == ast.RegoUndefined {
		regoVersion = ast.DefaultRegoVersion
	}

	return v1.MergeWithRegoVersion(bundles, regoVersion, usePath)
}

// RootPathsOverlap takes in two bundle root paths and returns true if they overlap.
func RootPathsOverlap(pathA string, pathB string) bool {
	return v1.RootPathsOverlap(pathA, pathB)
}

// RootPathsContain takes a set of bundle root paths and returns true if the path is contained.
func RootPathsContain(roots []string, path string) bool {
	return v1.RootPathsContain(roots, path)
}

// Descriptor contains information about a file and
// can be used to read the file contents.
type Descriptor = v1.Descriptor

func NewDescriptor(url, path string, reader io.Reader) *Descriptor {
	return v1.NewDescriptor(url, path, reader)
}

type PathFormat = v1.PathFormat

const (
	Chrooted    = v1.Chrooted
	SlashRooted = v1.SlashRooted
	Passthrough = v1.Passthrough
)

// DirectoryLoader defines an interface which can be used to load
// files from a directory by iterating over each one in the tree.
type DirectoryLoader = v1.DirectoryLoader

// NewDirectoryLoader returns a basic DirectoryLoader implementation
// that will load files from a given root directory path.
func NewDirectoryLoader(root string) DirectoryLoader {
	return v1.NewDirectoryLoader(root)
}

// NewTarballLoader is deprecated. Use NewTarballLoaderWithBaseURL instead.
func NewTarballLoader(r io.Reader) DirectoryLoader {
	return v1.NewTarballLoader(r)
}

// NewTarballLoaderWithBaseURL returns a new DirectoryLoader that reads
// files out of a gzipped tar archive. The file URLs will be prefixed
// with the baseURL.
func NewTarballLoaderWithBaseURL(r io.Reader, baseURL string) DirectoryLoader {
	return v1.NewTarballLoaderWithBaseURL(r, baseURL)
}

func NewIterator(raw []Raw) storage.Iterator {
	return v1.NewIterator(raw)
}

// NewFSLoader returns a basic DirectoryLoader implementation
// that will load files from a fs.FS interface
func NewFSLoader(filesystem fs.FS) (DirectoryLoader, error) {
	return v1.NewFSLoader(filesystem)
}

// NewFSLoaderWithRoot returns a basic DirectoryLoader implementation
// that will load files from a fs.FS interface at the supplied root
func NewFSLoaderWithRoot(filesystem fs.FS, root string) DirectoryLoader {
	return v1.NewFSLoaderWithRoot(filesystem, root)
}

// HashingAlgorithm represents a subset of hashing algorithms implemented in Go
type HashingAlgorithm = v1.HashingAlgorithm

// Supported values for HashingAlgorithm
const (
	MD5       = v1.MD5
	SHA1      = v1.SHA1
	SHA224    = v1.SHA224
	SHA256    = v1.SHA256
	SHA384    = v1.SHA384
	SHA512    = v1.SHA512
	SHA512224 = v1.SHA512224
	SHA512256 = v1.SHA512256
)

// SignatureHasher computes a signature digest for a file with (structured or 
```

### Core Architecture Module: `capabilities/capabilities.go`
```
// Copyright 2026 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

// Deprecated: This package is intended for older projects transitioning from OPA v0.x and will remain for the lifetime of OPA v1.x, but its use is not recommended.
// For newer features and behaviours, such as defaulting to the Rego v1 syntax, use the corresponding components in the [github.com/open-policy-agent/opa/v1] package instead.
// See https://www.openpolicyagent.org/docs/latest/v0-compatibility/ for more information.
package capabilities

import (
	"embed"
)

// FS contains the embedded capabilities/ directory of the built version,
// which has all the capabilities of previous versions:
// "v0.18.0.json" contains the capabilities JSON of version v0.18.0, etc
//
//go:embed *.json
var FS embed.FS

```

### Core Architecture Module: `cmd/bench.go`
```
// Copyright 2020 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

package cmd

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/olekukonko/tablewriter/tw"

	"github.com/open-policy-agent/opa/v1/ast"

	"github.com/open-policy-agent/opa/v1/server/types"

	"github.com/open-policy-agent/opa/v1/logging"
	"github.com/open-policy-agent/opa/v1/runtime"

	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"

	"github.com/open-policy-agent/opa/cmd/formats"
	"github.com/open-policy-agent/opa/cmd/internal/env"
	"github.com/open-policy-agent/opa/internal/presentation"
	"github.com/open-policy-agent/opa/v1/compile"
	"github.com/open-policy-agent/opa/v1/metrics"
	"github.com/open-policy-agent/opa/v1/rego"
	"github.com/open-policy-agent/opa/v1/util"
)

// benchmarkCommandParams are a superset of evalCommandParams
// but not all eval options are exposed with flags. Only the
// ones compatible with running a benchmark.
type benchmarkCommandParams struct {
	evalCommandParams
	benchMem               bool
	count                  int
	e2e                    bool
	gracefulShutdownPeriod int
	shutdownWaitPeriod     int
	configFile             string
}

func newBenchmarkEvalParams() benchmarkCommandParams {
	return benchmarkCommandParams{
		evalCommandParams: evalCommandParams{
			outputFormat: formats.Flag(formats.Pretty, formats.JSON, formats.GoBench),
			target:       util.NewEnumFlag(compile.TargetRego, []string{compile.TargetRego, compile.TargetWasm}),
			schema:       &schemaFlags{},
			capabilities: newCapabilitiesFlag(),
		},
		gracefulShutdownPeriod: 10,
	}
}

func initBench(root *cobra.Command, brand string) {
	executable := root.Name()

	params := newBenchmarkEvalParams()

	benchCommand := &cobra.Command{
		Use:   "bench <query>",
		Short: "Benchmark a Rego query",
		Long: `Benchmark a Rego query and print the results.

The benchmark command works very similar to 'eval' and will evaluate the query in the same fashion. The
evaluation will be repeated a number of times and performance results will be returned.

Example with bundle and input data:

	` + executable + ` bench -b ./policy-bundle -i input.json 'data.authz.allow'

To run benchmarks against a running ` + brand + ` server to evaluate server overhead use the --e2e flag.
To enable more detailed analysis use the --metrics and --benchmem flags.

The optional "gobench" output format conforms to the Go Benchmark Data Format.
`,

		PreRunE: func(cmd *cobra.Command, args []string) error {
			if err := env.CmdFlags.CheckEnvironmentVariables(cmd); err != nil {
				return err
			}
			// Initialize testing package for benchmarking. This is needed to set default values for some flags that may
			// otherwise be dereferenced on some code paths causing panics, as reported in:
			// https://github.com/open-policy-agent/opa/issues/7205
			testing.Init()

			return validateEvalParams(&params.evalCommandParams, args)
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			cmd.SilenceErrors = true
			cmd.SilenceUsage = true

			exit, err := benchMain(args, params, os.Stdout, os.Stderr, &goBenchRunner{})
			if err != nil {
				// NOTE: err should only be non-nil if a (highly unlikely)
				// presentation error occurs.
				fmt.Fprintf(os.Stderr, "error: %v\n", err)
			}
			if exit != 0 {
				return newExitError(exit)
			}
			return nil
		},
	}

	// Sub-set of the standard `opa eval ..` flags
	addPartialFlag(benchCommand.Flags(), &params.partial, false)
	addUnknownsFlag(benchCommand.Flags(), &params.unknowns, []string{"input"})
	addFailFlag(benchCommand.Flags(), &params.fail, true)
	addDataFlag(benchCommand.Flags(), &params.dataPaths)
	addBundleFlag(benchCommand.Flags(), &params.bundlePaths)
	addInputFlag(benchCommand.Flags(), &params.inputPath)
	addImportFlag(benchCommand.Flags(), &params.imports)
	addPackageFlag(benchCommand.Flags(), &params.pkg)
	addQueryStdinFlag(benchCommand.Flags(), &params.stdin)
	addInputStdinFlag(benchCommand.Flags(), &params.stdinInput)
	addMetricsFlag(benchCommand.Flags(), &params.metrics, true)
	addOutputFormat(benchCommand.Flags(), params.outputFormat)
	addIgnoreFlag(benchCommand.Flags(), &params.ignore)
	addSchemaFlags(benchCommand.Flags(), params.schema)
	addTargetFlag(benchCommand.Flags(), params.target)
	addV0CompatibleFlag(benchCommand.Flags(), &params.v0Compatible)
	addV1CompatibleFlag(benchCommand.Flags(), &params.v1Compatible)
	addReadAstValuesFromStoreFlag(benchCommand.Flags(), &params.ReadAstValuesFromStore, false)

	// Shared benchmark flags
	addCountFlag(benchCommand.Flags(), &params.count, "benchmark")
	addBenchmemFlag(benchCommand.Flags(), &params.benchMem, true)

	addE2EFlag(benchCommand.Flags(), &params.e2e, false, brand)
	addConfigFileFlag(benchCommand.Flags(), &params.configFile)

	benchCommand.Flags().IntVar(&params.gracefulShutdownPeriod, "shutdown-grace-period", 10, "set the time (in seconds) that the server will wait to gracefully shut down. This flag is valid in 'e2e' mode only.")
	benchCommand.Flags().IntVar(&params.shutdownWaitPeriod, "shutdown-wait-period", 0, "set the time (in seconds) that the server will wait before initiating shutdown. This flag is valid in 'e2e' mode only.")

	root.AddCommand(benchCommand)
}

type benchRunner interface {
	run(ctx context.Context, ectx *evalContext, params benchmarkCommandParams, f func(context.Context, ...rego.EvalOption) error) (testing.BenchmarkResult, error)
}

func benchMain(args []string, params benchmarkCommandParams, w io.Writer, stderr io.Writer, r benchRunner) (int, error) {

	ctx := context.Background()

	if params.e2e {
		err := benchE2E(ctx, args, params, w)
		if err != nil {
			errRender := renderBenchmarkError(params, err, w, stderr)
			return 1, errRender
		}
		return 0, nil
	}

	ectx, err := setupEval(args, params.evalCommandParams)
	if err != nil {
		errRender := renderBenchmarkError(params, err, w, stderr)
		return 1, errRender
	}

	resultHandler := rego.GenerateJSON(func(*ast.Term, *rego.EvalContext) (any, error) {
		// Do nothing with the result, as we are only interested in benchmarking evaluation —
		// not the potentially slow process of rendering the result.
		// Undefined / empty results will still be handled normally (fail the benchmark unless --fail
		// is set to false).
		return nil, nil
	})

	ectx.regoArgs = append(ectx.regoArgs, resultHandler)

	var benchFunc func(context.Context, ...rego.EvalOption) error
	rg := rego.New(ectx.regoArgs...)

	if !params.partial {
		// Take the eval context and prepare anything else we possible can before benchmarking the evaluation
		pq, err := rg.PrepareForEval(ctx)
		if err != nil {
			errRender := renderBenchmarkError(params, err, w, stderr)
			return 1, errRender
		}

		benchFunc = func(ctx context.Context, opts ...rego.EvalOption) error {
			result, err := pq.Eval(ctx, opts...)
			if err != nil {
				return err
			} else if len(result) == 0 && params.fail {
				return errors.New("undefined result")
			}
			return nil
		}
	} else {
		// As with normal evaluation, prepare as much as possible up front.
		pq, err := rg.PrepareForPartial(ctx)
		if err != nil {
			errRender := renderBenchmarkError(params, err, w, stderr)
			return 1, errRender
		}

		benchFunc = func(ctx context.Context, opts ...rego.EvalOption) error {
			result, err := pq.Partial(ctx, opts...)
			if err != nil {
				return err
			} else if len(result.Queries) == 0 && params.fail {
				return errors.New("undefined result")
			}
			return nil
		}
	}

	// Run the benchmark as many times as specified, re-use the prepared objects for each
	for range params.count {
		br, err := r.run(ctx, ectx, params, benchFunc)
		if err != nil {
			errRender := renderBenchmarkError(params, err, w, stderr)
			return 1, errRender
		}
		renderBenchmarkResult(params, br, w)
	}

	return 0, nil
}

type goBenchRunner struc
```

### Core Architecture Module: `cmd/capabilities.go`
```
// Copyright 2022 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

package cmd

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/open-policy-agent/opa/cmd/internal/env"
	"github.com/open-policy-agent/opa/v1/ast"
	"github.com/spf13/cobra"
)

type capabilitiesParams struct {
	showCurrent  bool
	version      string
	file         string
	v0Compatible bool
}

func (p *capabilitiesParams) regoVersion() ast.RegoVersion {
	if p.v0Compatible {
		return ast.RegoV0
	}
	return ast.DefaultRegoVersion
}

func initCapabilities(root *cobra.Command, brand string) {
	executable := root.Name()

	capabilitiesParams := capabilitiesParams{}

	var capabilitiesCommand = &cobra.Command{
		Use:   "capabilities",
		Short: "Print the capabilities of " + brand,
		Long: `Show capabilities for ` + brand + `.

The 'capabilities' command prints the ` + brand + ` capabilities, prior to and including the version of ` + brand + ` used.

Print a list of all existing capabilities version names

    $ ` + executable + ` capabilities
    v0.17.0
    v0.17.1
    ...
    v0.37.1
    v0.37.2
    v0.38.0
    ...

Print the capabilities of the current version

    $ ` + executable + ` capabilities --current
    {
        "builtins": [...],
        "future_keywords": [...],
        "wasm_abi_versions": [...]
    }

Print the capabilities of a specific version

    $ ` + executable + ` capabilities --version v0.32.1
    {
        "builtins": [...],
        "future_keywords": null,
        "wasm_abi_versions": [...]
    }

Print the capabilities of a capabilities file

    $ ` + executable + ` capabilities --file ./capabilities/v0.32.1.json
    {
        "builtins": [...],
        "future_keywords": null,
        "wasm_abi_versions": [...]
    }

`,
		PreRunE: func(cmd *cobra.Command, _ []string) error {
			return env.CmdFlags.CheckEnvironmentVariables(cmd)
		},
		RunE: func(cmd *cobra.Command, _ []string) error {
			cmd.SilenceErrors = true
			cmd.SilenceUsage = true

			cs, err := doCapabilities(capabilitiesParams)
			if err != nil {
				return err
			}
			fmt.Println(cs)
			return nil
		},
	}
	capabilitiesCommand.Flags().BoolVar(&capabilitiesParams.showCurrent, "current", false, "print current capabilities")
	capabilitiesCommand.Flags().StringVar(&capabilitiesParams.version, "version", "", "print capabilities of a specific version")
	capabilitiesCommand.Flags().StringVar(&capabilitiesParams.file, "file", "", "print capabilities defined by a file")
	addV0CompatibleFlag(capabilitiesCommand.Flags(), &capabilitiesParams.v0Compatible)

	root.AddCommand(capabilitiesCommand)
}

func doCapabilities(params capabilitiesParams) (string, error) {
	var (
		c   *ast.Capabilities
		err error
	)

	if len(params.version) > 0 {
		c, err = ast.LoadCapabilitiesVersion(params.version)
	} else if len(params.file) > 0 {
		c, err = ast.LoadCapabilitiesFile(params.file)
	} else if params.showCurrent {
		c = ast.CapabilitiesForThisVersion(ast.CapabilitiesRegoVersion(params.regoVersion()))
	} else {
		return showVersions()
	}

	if err != nil {
		return "", err
	}

	bs, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bs), nil

}

func showVersions() (string, error) {
	cvs, err := ast.LoadCapabilitiesVersions()
	if err != nil {
		return "", err
	}

	t := strings.Join(cvs, "\n")
	return t, nil
}

```

### Core Architecture Module: `cmd/check.go`
```
// Copyright 2017 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

package cmd

import (
	"errors"
	"fmt"
	"io/fs"
	"maps"
	"os"

	"github.com/spf13/cobra"

	"github.com/open-policy-agent/opa/cmd/formats"
	"github.com/open-policy-agent/opa/cmd/internal/env"
	pr "github.com/open-policy-agent/opa/internal/presentation"
	"github.com/open-policy-agent/opa/v1/ast"
	"github.com/open-policy-agent/opa/v1/bundle"
	"github.com/open-policy-agent/opa/v1/loader"
	"github.com/open-policy-agent/opa/v1/util"
)

type checkParams struct {
	format       *util.EnumFlag
	errLimit     int
	ignore       []string
	bundleMode   bool
	capabilities *capabilitiesFlag
	schema       *schemaFlags
	strict       bool
	regoV1       bool
	v0Compatible bool
	v1Compatible bool
}

func newCheckParams() checkParams {
	return checkParams{
		format:       formats.Flag(formats.Pretty, formats.JSON),
		capabilities: newCapabilitiesFlag(),
		schema:       &schemaFlags{},
	}
}

func (p *checkParams) regoVersion() ast.RegoVersion {
	// The '--rego-v1' flag takes precedence over the '--v1-compatible' flag.
	if p.regoV1 {
		return ast.RegoV0CompatV1
	}
	// The '--v0-compatible' flag takes precedence over the '--v1-compatible' flag.
	if p.v0Compatible {
		return ast.RegoV0
	}
	if p.v1Compatible {
		return ast.RegoV1
	}
	return ast.DefaultRegoVersion
}

func checkModules(params checkParams, args []string) error {
	// ensure custom builtins are properly captured
	capabilities := params.capabilities.C
	if capabilities == nil {
		capabilities = ast.CapabilitiesForThisVersion(ast.CapabilitiesRegoVersion(params.regoVersion()))
	}

	l := loader.NewFileLoader().
		WithRegoVersion(params.regoVersion()).
		WithProcessAnnotation(true).
		WithBundleLazyLoadingMode(bundle.HasExtension()).
		WithCapabilities(capabilities)

	ss, err := loader.Schemas(params.schema.path)
	if err != nil {
		return err
	}

	compiler := ast.NewCompiler().
		SetErrorLimit(params.errLimit).
		WithCapabilities(capabilities).
		WithSchemas(ss).
		WithEnablePrintStatements(true).
		WithStrict(params.strict).
		WithUseTypeCheckAnnotations(true)

	var modules map[string]*ast.Module

	if params.bundleMode {
		bundles := make([]*bundle.Bundle, 0, len(args))
		for _, path := range args {
			b, err := l.WithSkipBundleVerification(true).WithFilter(filterFromPaths(params.ignore)).AsBundle(path)
			if err != nil {
				return err
			}
			bundles = append(bundles, b)
		}
		b, err := bundle.Merge(bundles)
		if err != nil {
			return err
		}

		modules = maps.Clone(b.ParsedModules(""))
		if len(b.Data) > 0 {
			compiler = compiler.WithPathConflictsCheck(mapFinder(b.Data))
		}
	} else {
		result, err := l.Filtered(args, ignoredOnlyRego(params.ignore).Apply)
		if err != nil {
			return err
		}

		modules = result.ParsedModules()
	}

	if compiler.Compile(modules); compiler.Failed() {
		return compiler.Errors
	}

	return nil
}

// emulate storage.NonEmpty without having to create storage / transaction
// returned function returns false, nil when m or path is empty
func mapFinder(m map[string]any) func(path []string) (bool, error) {
	if len(m) == 0 {
		return emptyMapFinder
	}
	return func(path []string) (bool, error) {
		if len(path) == 0 {
			return false, nil
		}

		node := m
		for _, key := range path {
			if val, ok := node[key]; ok {
				if subMap, ok := val.(map[string]any); ok {
					node = subMap
				} else {
					return true, nil
				}
			} else {
				return false, nil
			}
		}
		return true, nil
	}
}

func emptyMapFinder([]string) (bool, error) {
	return false, nil
}

func filterFromPaths(paths []string) loader.Filter {
	return func(abspath string, info fs.FileInfo, depth int) bool {
		return ignored(paths).Apply(abspath, info, depth)
	}
}

func outputErrors(format string, err error) {
	out := os.Stdout
	if err != nil {
		out = os.Stderr
	}

	switch format {
	case formats.JSON:
		if err := pr.JSON(out, pr.Output{Errors: pr.NewOutputErrors(err)}); err != nil {
			fmt.Fprintln(os.Stderr, err.Error())
		}
	default:
		fmt.Fprintln(out, err)
	}
}

func initCheck(root *cobra.Command, _ string) {
	checkParams := newCheckParams()

	checkCommand := &cobra.Command{
		Use:   "check <path> [path [...]]",
		Short: "Check Rego source files",
		Long: `Check Rego source files for parse and compilation errors.
	
If the 'check' command succeeds in parsing and compiling the source file(s), no output
is produced. If the parsing or compiling fails, 'check' will output the errors
and exit with a non-zero exit code.`,

		PreRunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return errors.New("specify at least one file")
			}
			return env.CmdFlags.CheckEnvironmentVariables(cmd)
		},

		RunE: func(cmd *cobra.Command, args []string) error {
			cmd.SilenceErrors = true
			cmd.SilenceUsage = true

			if err := checkModules(checkParams, args); err != nil {
				outputErrors(checkParams.format.String(), err)
				return err
			}
			return nil
		},
	}

	addMaxErrorsFlag(checkCommand.Flags(), &checkParams.errLimit)
	addIgnoreFlag(checkCommand.Flags(), &checkParams.ignore)
	addOutputFormat(checkCommand.Flags(), checkParams.format)
	addBundleModeFlag(checkCommand.Flags(), &checkParams.bundleMode)
	addCapabilitiesFlag(checkCommand.Flags(), checkParams.capabilities)
	addSchemaFlags(checkCommand.Flags(), checkParams.schema)
	addStrictFlag(checkCommand.Flags(), &checkParams.strict, false)
	addRegoV0V1FlagWithDescription(checkCommand.Flags(), &checkParams.regoV1, false,
		"check for Rego v0 and v1 compatibility (policies must be compatible with both Rego versions)")
	addV0CompatibleFlag(checkCommand.Flags(), &checkParams.v0Compatible)
	addV1CompatibleFlag(checkCommand.Flags(), &checkParams.v1Compatible)

	root.AddCommand(checkCommand)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8781** (2026-06-15): **ast: Fix PE regression for `future.keywords.not` negation inside `every`**
  *Symptoms*: Fixing regression where `future.keywords.not` negated expressions nested inside an `every` body would fail to plug variables for partial evaluation.  E.g.  ```rego package test import future.keywords.not  p if { 	x = input.foo 	every y in [1, 2] { 		not f(x, y) 	} } ```  would fail to plug `x`:  ```rego every __local0__1, __local1__1 in [1, 2] { 	not data.test.f(x, __local1__) } x1 = input.foo ```  instead of the expected:  ```rego every __local0__1, __local1__1 in [1, 2] { 	not data.test.f(input.foo, __local1__1) } x1 = input.foo ```
  **Post-Mortem & Fix Analysis**:
  > ## Benchmark Comparison ( vs )  ``` benchmark \ host                                                               local:tags=opa_wasm                                                                                            vs base SumIntArray                                                                                      ~ SumFloatArray                                                                                    ~ SumIntSet                                                                                        ~ SumFloatSet                                                                                      ~ BindingsAllocation/1_binding_without_hint                                                        ~ BindingsAllocation/1_binding_with_hint                                                           ~ BindingsAllocation/2_bindings_without_hint                                                       ~ BindingsAllocation/2_bindings_with_hint                                  

- **Issue #8733** (2026-06-04): **bundle: improve determinism of `file_rego_versions` patterns with overlap.**
  *Symptoms*: ## What code changed, and why?  This PR makes the behavior of pattern selection for `file_rego_versions` from a bundle manifest more deterministic when the patterns have overlap.  The [Bundle docs](https://www.openpolicyagent.org/docs/management-bundles#bundle-file-format) note that when overlapping patterns occur, the result is undefined. In practice, this meant that the map of patterns was iterated over in randomized order.  We now iterate over the `file_rego_version` patterns in lexically-sorted order, which ensures a deterministic result, even when user-authored glob patterns overlap with each other.  This turned up when I was looking into making bundle builds reproducible, and while it's an uncommon edge case, it's still an edge case where two runs could produce different results.  ## How to test?   - A new regression test was added under `v1/bundle`.

- **Issue #8732** (2026-06-05): **compile,planner: improve determinism of `plan`/`wasm` bundle builds**
  *Symptoms*: ## What code changed, and why?  This PR fixes an issue where `plan` and `wasm` bundle build targets could produce different output bytes across separate `opa build` invocations for the exact same inputs. There were two underlying causes, both from Golang random map iteration order leaking through to the order-sensitive planner.  Causes: - `compilePlan` (`v1/compile`) and `planQuery` (`v1/rego`) iterated over the compiler's module map without sorting keys first. This caused the planner to have iteration-dependent variations in its output. This was fixed by sorting the module names before use.  - `planRules` (`internal/planner`) sorted rules by length of the rule name ref, which is not a unique value. Because the sorting of the rules was using an unstable sorting algorithm (the default in Golang), and the rule names were coming from iterating over a `map` type in the rule trie, this had edge cases where non-deterministic output ordering could creep in. This was fixed by adding a ref `Compare` call as a tie-breaker to get a stable sorting order over rule names, regardless of iteration order in the rule trie.  This commit also adds regression tests that assert plan output is independent of module and rule ordering. The two fixes are needed together because both sets of issues hit the planner from different angles, and are mostly independent of each other.   ## How to test?   - New tests added under `internal/planner` and `v1/compile`.
  **Post-Mortem & Fix Analysis**:
  > ℹ️ Made a small refactor to use `util.KeysSorted()`, instead of manually creating the sorted keys lists. I had copy/pasted the boilerplate around yesterday, and remembered we had something more concise available that does the exact same job.
  > ## Benchmark Comparison ( vs )  ``` benchmark \ host                         local:tags=opa_wasm                                                      vs base PartialObjectRuleCrossModule/10                            ~ PartialObjectRuleCrossModule/100                           ~ PartialObjectRuleCrossModule/1000                          ~ AciTestBuildAndEval                                        ~ AciTestOnlyEval                                            ~ ArrayIteration                                             ~ SetIteration                                          -2.07% ObjectIteration                                            ~ StoreRefNotFound/inmem-go                                  ~ StoreRefNotFound/inmem-ast                                 ~ StoreRead                                                  ~ TrivialPolicy                                              ~ TrivialQuery                                               ~ GlobalVsLocalLookup/global_ref                   

- **Issue #8429** (2026-03-19): **build/generate-extended-cases: Fix testcase loader to use json.Number.**
  *Symptoms*: ## What changed, and why?  The testcase generator had a bug where very large numbers would be parsed incorrectly, truncating the less-significant digits off their values.  I discovered this was caused by the [YAML library defaulting to parsing all numeric values into floating point numbers](https://pkg.go.dev/sigs.k8s.io/yaml#Unmarshal), which lose precision at larger sizes.  The fix was to provide the YAML unmarshaling function with the appropriate equivalent of [`(*json.Decoder).UseNumber()`](https://pkg.go.dev/encoding/json#Decoder.UseNumber) at the callsite. This causes the YAML library to use [`json.Number`](https://pkg.go.dev/encoding/json#Number) types by default, just as we expect almost everywhere else in Rego.  ## How to test?  I couldn't come up with a clean Golang test, but if you run the [testcase generator from Swift OPA](https://github.com/open-policy-agent/swift-opa/blob/main/tools/generate-compliance-tests/main.go), the testcase for `v1/test/cases/testdata/v1/time/test-time-0948.yaml` is particularly instructive.  The source YAML: ```yaml --- cases:   - note: time/parse_nanos     query: data.generated.p = x     modules: # ...     input:       cases: # ...     want_result:       - x:           "1": 1496455200000000000           "2": -9223372036854775808 # <-- The values we care about.           "3": 9223372036854775807  # <--           "4": 1496455200000000000           "5": 1496455200000000000           "6": 1496455200000000000 ``
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *openpolicyagent* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | cb2cb3561fc44201592d4bf312378c751a73617c | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/openpolicyagent/deploys/69bb1c4aa00cf9000817b1c4 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-8429--openpolicyagent.netlify.app](https://deploy-preview-8429--openpolicyagent.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTg0MjktLW9wZW5wb2xpY3lhZ2VudC5uZXRsaWZ5LmFwcCJ9.icHW4XDrE6TV13UowB4otZ8YpKehybBt58GD7n1unQA)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [openpolicyagent Preview](https://deploy-preview-

- **Issue #8377** (2026-02-25): **ci: Fix `check-changes` job skipping over YAML changes.**
  *Symptoms*: ## What changed?  This PR fixes a copy/paste bug from #8356 that resulted in the YAML detection logic of the `check-changes` job setting the wrong result for the job step's `yaml` changes output.  This bug caused downstream jobs to not see that YAML files were altered at all in a PR, and YAML-specific jobs like the linter and zizmor passes would not be run.  An example of the wrong change-detection logic can be seen in the [Actions run](https://github.com/open-policy-agent/opa/actions/runs/22353116835) for @srenatus's recent PR #8368, which altered a YAML file for the Benchmarks job. The YAML linter and zizmor runs were skipped over entirely!  The bug's presence was masked in the original PR because there were also Rego file changes in that PR, which resulted the the final `yaml` output being set to `true`, despite the source for that value being the wrong one.  Thanks @srenatus for calling that weirdness to my attention yesterday!  ## Definition of done   - [x] Does this PR run the YAML linter + zizmor jobs on this PR? (The only change is to YAML files, so it should be detected now.)  ## How to test?   - Observe the GH Actions that run for this YAML-only PR.
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *openpolicyagent* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 6d72bb6c49a87f9e3eb01ec28f9380c95ebe3c17 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/openpolicyagent/deploys/699f1d608cdf7300082a4385 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-8377--openpolicyagent.netlify.app](https://deploy-preview-8377--openpolicyagent.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTgzNzctLW9wZW5wb2xpY3lhZ2VudC5uZXRsaWZ5LmFwcCJ9.eY0LMTH-g29datBcXPwUozamSlKEP0f0_jgOUJkaHRM)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [openpolicyagent Preview](https://deploy-preview-

- **Issue #7813** (2025-07-31): **cmd/parse: Move accidental pkg var to local var.**
  *Symptoms*: ## What changed?  This PR moves an accidental package-level definition of the `opa parse` CLI subcommand to a local variable inside the `initParse` function, similar to how we do command initialization for all other OPA CLI subcommands.  Before this change, it was possible to see panics from the package variable `cobra.Command` in `parse.go` having some of its flags redefined. This fix makes it possible for `make generate-cli-docs` to run without error again.  ## How to test?   - Try running `make -C docs generate-cli-docs`, and see if the docs generate correctly.    - For an example failure, see this [error from the recent Post Merge workflow](https://github.com/open-policy-agent/opa/actions/runs/16655123404/job/47138042468)
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *openpolicyagent* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 3065850b1d885edda7ae17b95d7954f13d9253ef | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/openpolicyagent/deploys/688bc0e3075f250008d29d50 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-7813--openpolicyagent.netlify.app](https://deploy-preview-7813--openpolicyagent.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTc4MTMtLW9wZW5wb2xpY3lhZ2VudC5uZXRsaWZ5LmFwcCJ9.RbMwfw-oA-2gScaOcOcr0NmKhJzQnxv_4nn2eZV_GxI)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [openpolicyagent Preview](https://deploy-preview-
  > :information_source: Rebasing through the Github Web UI, then will merge...
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *openpolicyagent* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | c78876299352c3a48e4177dd105f5505665e312f | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/openpolicyagent/deploys/688bc15631ffa8000874943f | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-7813--openpolicyagent.netlify.app](https://deploy-preview-7813--openpolicyagent.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTc4MTMtLW9wZW5wb2xpY3lhZ2VudC5uZXRsaWZ5LmFwcCJ9.RbMwfw-oA-2gScaOcOcr0NmKhJzQnxv_4nn2eZV_GxI)<br /><br />_Use your smartphone camera to open QR code link._</details> | --- <!-- [openpolicyagent Preview](https://deploy-preview-

- **Issue #7749** (2025-07-02): **io.jwt.decode_verify not detecting expired tokens**
  *Symptoms*: ## Short description   Trying to use `io.jwt.decode_verify` to validate a JWT, however policy validates even though the token has expired.    Here's an example in the rego plaground   https://play.openpolicyagent.org/p/bA4sesps4t  The example token had a validity period of 10mins.    
  **Post-Mortem & Fix Analysis**:
  > Hey Carl, you will likely want to check the contents of validate like this:  ```rego default allow := false  allow if { 	validate[0] == true         # then perform checks on the verified claims... }  validate := io.jwt.decode_verify(input.token, {"cert": jwks}) ```  https://github.com/StyraInc/lib.jwt might also be an interesting resource for best practises on this topic.
  > Thanks for this Charlie, I'll take a look at lib.jwt.
  > Sounds good, I'll close this for now. Feel free to raise queries like this under the GH discussions board too: https://github.com/orgs/open-policy-agent/discussions

- **Issue #7742** (2025-07-02): **fmt: Formatting file with keyword in import renders incorrect result**
  *Symptoms*: ```rego …/opa main ➜ cat --style=plain example.rego package fmt  import data.foo.default as foo  …/opa main ➜ go run main.go fmt example.rego package fmt  import data.foo["default"] as foo ```  The expected result is the same as the input `import data.foo.default as foo`.  Reported: https://github.com/StyraInc/regal/pull/1619#issue-3190160532

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

### Incident Patch 1: `a31eb820` (2026-09-30)
**Commit Message**: build(deps): bump brace-expansion in /docs

Bumps  and [brace-expansion](https://github.com/juliangruber/brace-expansion). These dependencies needed to be updated together.

Updates `brace-expansion` from 1.1.18 to 1.1.21
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v1.1.18...v1.1.21)

Updates `brace-expansion` from 5.0.9 to 5.0.12
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v1.1.18...v1.1.21)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 1.1.21
  dependency-type: indirect
- dependency-name: brace-expansion
  dependency-version: 5.0.12
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

**File**: `docs/package-lock.json` (modified, +12/-12)
```diff
@@ -4329,9 +4329,9 @@
       }
     },
     "node_modules/@eslint/config-array/node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^4.0.2"
@@ -7032,9 +7032,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "1.1.18",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.18.tgz",
-      "integrity": "sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==",
+      "version": "1.1.21",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.21.tgz",
+      "integrity": "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==",
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^1.0.0",
@@ -9629,9 +9629,9 @@
       }
     },
     "node_modules/eslint/node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^4.0.2"
@@ -10681,9 +10681,9 @@
       }
     },
     "node_modules/glob/node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^4.0.2"
```

---

### Incident Patch 2: `2dcd8ab9` (2026-09-23)
**Commit Message**: topdown: fix flaky TestRegexBuiltinCache (#9254)

The test shared the package-global regex cache with parallel tests, and
asserted on a pattern after a later insert could evict it.

recent failure:
https://github.com/open-policy-agent/opa/actions/runs/35917100008/job/107372722141?pr=9253

Signed-off-by: Sebastian Spaink <sebastianspaink@gmail.com>

**File**: `v1/topdown/regex_test.go` (modified, +43/-12)
```diff
@@ -6,14 +6,19 @@ package topdown
 
 import (
 	"fmt"
+	"regexp"
 	"testing"
 
 	"github.com/open-policy-agent/opa/v1/ast"
 	"github.com/open-policy-agent/opa/v1/topdown/cache"
 )
 
 func TestRegexBuiltinCache(t *testing.T) {
-	t.Parallel()
+	// Not parallel: regexpCache is shared by the whole package, and parallel
+	// tests calling regex built-ins would evict the patterns asserted on here.
+	regexpCacheLock.Lock()
+	regexpCache = make(map[string]*regexp.Regexp)
+	regexpCacheLock.Unlock()
 
 	ctx := BuiltinContext{}
 	iter := func(*ast.Term) error { return nil }
@@ -29,9 +34,7 @@ func TestRegexBuiltinCache(t *testing.T) {
 		t.Fatalf("Unexpected error: %v", err)
 	}
 
-	if _, ok := regexpCache[regex1]; !ok {
-		t.Fatalf("Expected regex to be cached: %v", regex1)
-	}
+	assertRegexCached(t, regex1)
 
 	// Fill up the cache.
 	for i := range regexCacheMaxSize - 1 {
@@ -45,11 +48,11 @@ func TestRegexBuiltinCache(t *testing.T) {
 		}
 	}
 
-	if len(regexpCache) != regexCacheMaxSize {
-		t.Fatal("Expected cache to be full")
-	}
+	assertRegexCacheLen(t, regexCacheMaxSize)
 
-	// A new regex pattern is cached and a random pattern is evicted.
+	// A new regex pattern is cached and a random pattern is evicted. Any
+	// pattern can be evicted by the next insert, so each one is asserted on
+	// right after it is cached.
 	regex2 := "bar.*"
 	operands = []*ast.Term{
 		ast.NewTerm(ast.String(regex2)),
@@ -60,6 +63,9 @@ func TestRegexBuiltinCache(t *testing.T) {
 		t.Fatalf("Unexpected error: %v", err)
 	}
 
+	assertRegexCached(t, regex2)
+	assertRegexCacheLen(t, regexCacheMaxSize)
+
 	// Both builtins which interact with the cache should correctly evict
 	// cache items.
 	regex3 := "ba<[zx]>.*"
@@ -74,12 +80,37 @@ func TestRegexBuiltinCache(t *testing.T) {
 		t.Fatalf("Unexpected error: %v", err)
 	}
 
-	if len(regexpCache) != regexCacheMaxSize {
-		t.Fatalf("Expected cache be capped at %d, was %d", regexCacheMaxSize, len(regexpCache))
+	// Templates are cached under the pattern generated from them.
+	gen, err := generateRegexTemplate(regex3, '<', '>')
+	if err != nil {
+		t.Fatalf("Unexpected error: %v", err)
 	}
 
-	if _, ok := regexpCache[regex2]; !ok {
-		t.Fatalf("Expected regex to be cached: %v", regex2)
+	assertRegexCached(t, gen)
+	assertRegexCacheLen(t, regexCacheMaxSize)
+}
+
+func assertRegexCached(t *testing.T, pat string) {
+	t.Helper()
+
+	regexpCacheLock.RLock()
+	_, ok := regexpCache[pat]
+	regexpCacheLock.RUnlock()
+
+	if !ok {
+		t.Fatalf("Expected regex to be cached: %v", pat)
+	}
+}
+
+func assertRegexCacheLen(t *testing.T, exp int) {
+	t.Helper()
+
+	regexpCacheLock.RLock()
+	n := len(regexpCache)
+	regexpCacheLock.RUnlock()
+
+	if n != exp {
+		t.Fatalf("Expected cache to hold %d entries, was %d", exp, n)
 	}
 }
 
```

---

### Incident Patch 3: `959890c1` (2026-09-23)
**Commit Message**: topdown: add stack traces to evaluation errors (#9242)

Fixes: #555

Add a stack trace for eval errors. Enabled by default for the server,
only will make an impact on 500 and decision log errors returning an
extra field. Seemed like something easily overlooked as an opt-in option
and better to have more information by default. For REPL it is opt-in by
using the `traceback` command and eval you need to provide the extra
flag `--stack-trace`. The argument there is that if it was on by default
the stdout would unexpectedly change.

```rego
package ex

p contains x if {
	q[x]
}

q contains x if {
	r[x]
}

r contains x if {
	x := 1 / 0
}
```

```console
$ opa eval --stack-trace --strict-builtin-errors --format pretty -d test.rego 'data.ex.p'

1 error occurred: test.rego:12: eval_builtin_error: div: divide by zero

Traceback:
  test.rego:12: 1 / 0
  test.rego:8: r[x]
  test.rego:4: q[x]
  1:1: data.ex.p
```

---------

Signed-off-by: Sebastian Spaink <sebastianspaink@gmail.com>

**File**: `cmd/eval.go` (modified, +4/-0)
```diff
@@ -756,6 +756,10 @@ func setupEval(args []string, params evalCommandParams) (*evalContext, error) {
 		}
 	}
 
+	// Always on: a traceback only shows up on an error, and it is the one place
+	// the CLI explains how evaluation reached the failing expression.
+	regoArgs = append(regoArgs, rego.StackTraces(true))
+
 	var builtInErrors []topdown.Error
 	if params.showBuiltinErrors {
 		regoArgs = append(regoArgs, rego.BuiltinErrorList(&builtInErrors))
```

**File**: `cmd/eval_jsonv2_test.go` (modified, +11/-1)
```diff
@@ -2539,7 +2539,17 @@ func TestEvalDiscardOutput(t *testing.T) {
         "file": "",
         "row": 1
       },
-      "message": "div: divide by zero"
+      "message": "div: divide by zero",
+      "stack_trace": [
+        {
+          "location": {
+            "col": 1,
+            "file": "",
+            "row": 1
+          },
+          "query_id": 0
+        }
+      ]
     }
   ]
 }
```

**File**: `cmd/eval_test.go` (modified, +52/-1)
```diff
@@ -1715,6 +1715,47 @@ func TestEvalWithStrictBuiltinErrors(t *testing.T) {
 	}
 }
 
+func TestEvalWithStackTrace(t *testing.T) {
+	files := map[string]string{
+		"test.rego": `package test
+
+p if {
+	q
+}
+
+q if {
+	1 / 0
+}
+`,
+	}
+
+	test.WithTempFS(files, func(path string) {
+		params := newEvalCommandParams()
+		params.dataPaths = newrepeatedStringFlag([]string{path})
+		params.strictBuiltinErrors = true
+		if err := params.outputFormat.Set(formats.Pretty); err != nil {
+			t.Fatalf("Unexpected error: %s", err)
+		}
+
+		var buf, errBuf bytes.Buffer
+		if _, err := eval([]string{"data.test.p"}, params, &buf, &errBuf); err == nil {
+			t.Fatal("expected error")
+		}
+
+		out := errBuf.String()
+		for _, expected := range []string{
+			"Traceback:",
+			filepath.Join(path, "test.rego") + ":8: 1 / 0",
+			filepath.Join(path, "test.rego") + ":4: q",
+			"1:1: data.test.p",
+		} {
+			if !strings.Contains(out, expected) {
+				t.Fatalf("expected output to contain %q, got:\n%s", expected, out)
+			}
+		}
+	})
+}
+
 func assertResultSet(t *testing.T, rs rego.ResultSet, expected string) {
 	t.Helper()
 	result := make([]any, 0, len(rs))
@@ -2705,7 +2746,17 @@ func TestEvalDiscardOutput(t *testing.T) {
         "file": "",
         "row": 1
       },
-      "message": "div: divide by zero"
+      "message": "div: divide by zero",
+      "stack_trace": [
+        {
+          "location": {
+            "col": 1,
+            "file": "",
+            "row": 1
+          },
+          "query_id": 0
+        }
+      ]
     }
   ]
 }
```

**File**: `cmd/test.go` (modified, +1/-0)
```diff
@@ -426,6 +426,7 @@ func compileAndSetupTests(ctx context.Context, testParams testCommandParams, sto
 		SetStore(store).
 		CapturePrintOutput(true).
 		EnableTracing(testParams.verbose || testParams.varValues).
+		StackTraces(true).
 		SetCoverageRuns(coverageRuns).
 		SetCoverageQueryTracer(coverTracer).
 		SetRuntime(runtimeInfo).
```

**File**: `cmd/test_test.go` (modified, +31/-0)
```diff
@@ -1561,6 +1561,37 @@ test_p if {
 	}
 }
 
+func TestTestStackTrace(t *testing.T) {
+	files := map[string]string{
+		"/test.rego": `package test
+
+conflicting := 1
+
+conflicting := 2
+
+test_conflict if { conflicting }`,
+	}
+
+	test.WithTempFS(files, func(root string) {
+		buf := bytes.NewBuffer(nil)
+		testParams := newTestCommandParams()
+		testParams.count = 1
+		testParams.output = buf
+		testParams.errOutput = io.Discard
+
+		if code := opaTest([]string{root}, testParams); code == 0 {
+			t.Fatal("expected a non-zero exit code")
+		}
+
+		out := buf.String()
+		for _, expected := range []string{"Traceback:", "test.rego:5: 2", "test.rego:7: conflicting"} {
+			if !strings.Contains(out, expected) {
+				t.Fatalf("expected output to contain %q, got:\n%s", expected, out)
+			}
+		}
+	})
+}
+
 // Assert that ignore flag is correctly used when the bundle flag is activated
 func TestIgnoreFlagWithBundleFlag(t *testing.T) {
 	files := map[string]string{
```

---

### Incident Patch 4: `b98f1a40` (2026-09-22)
**Commit Message**: nightly: fix go get smoke test

Signed-off-by: Stephan Renatus <stephan.renatus@gmail.com>

**File**: `.github/workflows/nightly.yaml` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ jobs:
           go mod init test-go-get
           go get github.com/open-policy-agent/opa@main
 
-          go list -m -retracted \
+          go list -mod=mod -m -retracted \
             -f '{{with .Retracted}}{{$.Path}}@{{$.Version}}: {{join . "; "}}{{end}}' all \
             > /tmp/retracted-raw.log
           grep -v '^[[:space:]]*$' /tmp/retracted-raw.log > /tmp/retracted.log || true
```

---

### Incident Patch 5: `dcf35d88` (2026-09-21)
**Commit Message**: cmd: stop binding a fixed port in the run tests

newTestRunParams defaulted every runtime it built to localhost:8181, so
four server tests bound the same fixed port one after another with a 1s
graceful shutdown between them. Same shape as the v1/runtime flake: a
shutdown still holding the port when the next test binds it.

Use localhost:0. Only TestRunServerBaseListenOnLocalhost cared about the
address, and what it checks is that localhost resolves to a single IPv4
loopback listener rather than also binding ::1, so match on the host and
let the port float.

Both build-tagged copies of the file get the change; they differ by one
line and cmd/run_jsonv2_test.go is the one that compiles from go1.27.

Signed-off-by: Stephan Renatus <stephan.renatus@gmail.com>

**File**: `cmd/run_jsonv2_test.go` (modified, +3/-3)
```diff
@@ -126,8 +126,8 @@ func TestRunServerBaseListenOnLocalhost(t *testing.T) {
 		t.Fatalf("Expected 1 listening address but got %v", len(rt.Addrs()))
 	}
 
-	expected := "127.0.0.1:8181"
-	if rt.Addrs()[0] != expected {
+	expected := "127.0.0.1:"
+	if !strings.HasPrefix(rt.Addrs()[0], expected) {
 		t.Fatalf("Expected listening address %v but got %v", expected, rt.Addrs()[0])
 	}
 
@@ -482,7 +482,7 @@ func TestInitRuntimeAddrSetByUser(t *testing.T) {
 func newTestRunParams() runCmdParams {
 	params := newRunParams()
 	params.rt.GracefulShutdownPeriod = 1
-	params.rt.Addrs = &[]string{"localhost:8181"}
+	params.rt.Addrs = &[]string{"localhost:0"}
 	params.rt.DiagnosticAddrs = &[]string{}
 	params.serverMode = true
 	return params
```

**File**: `cmd/run_test.go` (modified, +3/-3)
```diff
@@ -126,8 +126,8 @@ func TestRunServerBaseListenOnLocalhost(t *testing.T) {
 		t.Fatalf("Expected 1 listening address but got %v", len(rt.Addrs()))
 	}
 
-	expected := "127.0.0.1:8181"
-	if rt.Addrs()[0] != expected {
+	expected := "127.0.0.1:"
+	if !strings.HasPrefix(rt.Addrs()[0], expected) {
 		t.Fatalf("Expected listening address %v but got %v", expected, rt.Addrs()[0])
 	}
 
@@ -482,7 +482,7 @@ func TestInitRuntimeAddrSetByUser(t *testing.T) {
 func newTestRunParams() runCmdParams {
 	params := newRunParams()
 	params.rt.GracefulShutdownPeriod = 1
-	params.rt.Addrs = &[]string{"localhost:8181"}
+	params.rt.Addrs = &[]string{"localhost:0"}
 	params.rt.DiagnosticAddrs = &[]string{}
 	params.serverMode = true
 	return params
```

---

### Incident Patch 6: `09397a34` (2026-09-18)
**Commit Message**: ast: Fix type errors from allowed undefined function calls (#9217)

Comprehension bodies were typed by the checker that seeded the
environment rather than the one running, and a function returning an
undefined call was given no result type, so `opa inspect` reported
spurious errors.

Fixes: #6946

Signed-off-by: Sebastian Spaink <sebastianspaink@gmail.com>

**File**: `v1/ast/check.go` (modified, +26/-2)
```diff
@@ -44,7 +44,14 @@ func newTypeChecker() *typeChecker {
 
 func (tc *typeChecker) newEnv(exist *TypeEnv) *TypeEnv {
 	if exist != nil {
-		return exist.wrap()
+		env := exist.wrap()
+		// The wrapped environment would otherwise inherit exist's checker
+		// factory, which may have been built with a different configuration
+		// than tc -- the compiler seeds Compiler.TypeEnv from a bare checker,
+		// for one. Comprehension bodies are typed lazily through this factory,
+		// so it has to reflect the checker that is running now.
+		env.newChecker = tc.copyForEnv
+		return env
 	}
 	env := newTypeEnv(tc.copy)
 	if tc.input != nil {
@@ -53,6 +60,14 @@ func (tc *typeChecker) newEnv(exist *TypeEnv) *TypeEnv {
 	return env
 }
 
+// copyForEnv returns a checker for typing the closures an environment is asked
+// about. It drops the required-capabilities accumulator: environments outlive
+// the compilation that produced them, and the builtins in those closures are
+// already recorded by checkClosures.
+func (tc *typeChecker) copyForEnv() *typeChecker {
+	return tc.copy().WithRequiredCapabilities(nil)
+}
+
 func (tc *typeChecker) copy() *typeChecker {
 	return newTypeChecker().
 		WithVarRewriter(tc.varRewriter).
@@ -306,7 +321,16 @@ func (tc *typeChecker) checkRule(env *TypeEnv, as *AnnotationSet, rule *Rule) {
 			args[i] = cpy.GetByValue(rule.Head.Args[i].Value)
 		}
 
-		tpe = types.NewFunction(args, cpy.GetByValue(rule.Head.Value.Value))
+		result := cpy.GetByValue(rule.Head.Value.Value)
+		if result == nil && tc.allowUndefinedFuncs {
+			// The value is only unknown because it came out of a call to an
+			// undefined function. Recording a function type without a result
+			// would make callers look like they pass one argument too many, so
+			// fall back to any.
+			result = types.A
+		}
+
+		tpe = types.NewFunction(args, result)
 	} else {
 		switch rule.Head.RuleKind() {
 		case SingleValue:
```

**File**: `v1/ast/compile_test.go` (modified, +127/-0)
```diff
@@ -3181,6 +3181,133 @@ func TestCompilerQueryCompilerCheckUndefinedFuncs(t *testing.T) {
 	}
 }
 
+func TestCompilerAllowUndefinedFunctionCalls(t *testing.T) {
+	tests := []struct {
+		note    string
+		modules map[string]string
+	}{
+		{
+			note: "call in rule body",
+			modules: map[string]string{
+				"test.rego": `package test
+
+				p if { custom_func() }`,
+			},
+		},
+		{
+			note: "call in array comprehension body (regression: GH#6946)",
+			modules: map[string]string{
+				"test.rego": `package test
+
+				p if {
+					res := [r |
+						some r in input
+						custom_func()
+					]
+					count(res) > 0
+				}`,
+			},
+		},
+		{
+			note: "call in set comprehension body",
+			modules: map[string]string{
+				"test.rego": `package test
+
+				p := {r | some r in input; custom_func()}`,
+			},
+		},
+		{
+			note: "call in object comprehension body",
+			modules: map[string]string{
+				"test.rego": `package test
+
+				p := {r: 1 | some r in input; custom_func()}`,
+			},
+		},
+		{
+			note: "comprehension term bound by call",
+			modules: map[string]string{
+				"test.rego": `package test
+
+				p if {
+					res := [r | r := custom_func()]
+					count(res) > 0
+				}`,
+			},
+		},
+		{
+			note: "function returning call result (regression: GH#6946)",
+			modules: map[string]string{
+				"test.rego": `package test
+
+				f(x) := custom_func(x)
+
+				p if { f("foo") == 1 }`,
+			},
+		},
+		{
+			note: "function returning call result passed to builtin",
+			modules: map[string]string{
+				"test.rego": `package test
+
+				f(x) := custom_func(x)
+
+				p := count(f("foo"))`,
+			},
+		},
+		{
+			note: "function chain returning call result",
+			modules: map[string]string{
+				"test.rego": `package test
+
+				f(x) := custom_func(x)
+
+				g(x) := f(x)
+
+				p if { g("foo") }`,
+			},
+		},
+		{
+			note: "function returning result of undefined rule in another package",
+			modules: map[string]string{
+				"test.rego": `package test
+
+				import data.lib
+
+				dispatcher(arg) := dispatcher_impl(arg.type, arg)
+
+				dispatcher_impl("type1", arg) := lib.f1(arg)`,
+			},
+		},
+		{
+			note: "rule value bound by call",
+			modules: map[string]string{
+				"test.rego": `package test
+
+				p := custom_func(1)
+
+				q if { p == 1 }`,
+			},
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.note, func(t *testing.T) {
+			modules := map[string]*Module{}
+			for name, src := range tc.modules {
+				modules[name] = MustParseModule(src)
+			}
+
+			c := NewCompiler().WithAllowUndefinedFunctionCalls(true)
+			c.Compile(modules)
+
+			if c.Failed() {
+				t.Fatalf("unexpected compilation error: %v", c.Errors)
+			}
+		})
+	}
+}
+
 func TestCompilerImportsResolved(t *testing.T) {
 
 	modules := map[string]*Module{
```

---

### Incident Patch 7: `333bdd31` (2026-09-15)
**Commit Message**: rego: fix EvalDisableInlining always being overridden

newEvalContext applied EvalOptions and then unconditionally
reassigned disableInlining from the Rego object's construction-time
value, discarding whatever EvalDisableInlining had just set. Default
is now seeded before the options loop so a per-call option can win.

Signed-off-by: Stephan Renatus <stephan.renatus@gmail.com>

**File**: `v1/rego/rego.go` (modified, +6/-6)
```diff
@@ -480,6 +480,11 @@ func (pq preparedQuery) Modules() map[string]*ast.Module {
 // once the evaluation is complete to close any transactions that might have
 // been opened.
 func (pq preparedQuery) newEvalContext(ctx context.Context, options []EvalOption) (*EvalContext, func(context.Context), error) {
+	disableInlining, err := parseStringsToRefs(pq.r.disableInlining)
+	if err != nil {
+		return nil, func(context.Context) {}, err
+	}
+
 	ectx := &EvalContext{
 		hasInput:                 false,
 		rawInput:                 nil,
@@ -492,6 +497,7 @@ func (pq preparedQuery) newEvalContext(ctx context.Context, options []EvalOption
 		queryTracers:             nil,
 		unknowns:                 pq.r.unknowns,
 		parsedUnknowns:           pq.r.parsedUnknowns,
+		disableInlining:          disableInlining,
 		nondeterministicBuiltins: pq.r.nondeterministicBuiltins,
 		compiledQuery:            compiledQuery{},
 		indexing:                 true,
@@ -517,12 +523,6 @@ func (pq preparedQuery) newEvalContext(ctx context.Context, options []EvalOption
 	// Default to an empty "finish" function
 	finishFunc := func(context.Context) {}
 
-	var err error
-	ectx.disableInlining, err = parseStringsToRefs(pq.r.disableInlining)
-	if err != nil {
-		return nil, finishFunc, err
-	}
-
 	if ectx.txn == nil {
 		ectx.txn, err = pq.r.store.NewTransaction(ctx)
 		if err != nil {
```

**File**: `v1/rego/rego_test.go` (modified, +38/-0)
```diff
@@ -3086,6 +3086,44 @@ func TestTimeSeedingOptions(t *testing.T) {
 
 }
 
+// EvalDisableInlining is threaded through the same EvalContext defaults that
+// disableInlining set on the Rego object populates; verify the per-call
+// option actually takes effect instead of being overwritten by the default.
+func TestEvalDisableInliningOption(t *testing.T) {
+	ctx := t.Context()
+	module := `
+package test
+
+p if { q; r }
+q if { s[input] }
+q if { t[input] }
+r if { s[input] }
+s contains 1
+s contains 2
+t contains 3
+`
+	pq, err := New(
+		Query("data.test.p = true"),
+		Module("test.rego", module),
+		Unknowns([]string{"input"}),
+	).PrepareForPartial(ctx)
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	pqs, err := pq.Partial(ctx, EvalDisableInlining([]ast.Ref{ast.MustParseRef("data.test.q")}))
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	for _, q := range pqs.Queries {
+		if strings.Contains(q.String(), "data.partial.test.q") {
+			return
+		}
+	}
+	t.Fatalf("expected EvalDisableInlining to prevent inlining of data.test.q, got queries %v", pqs.Queries)
+}
+
 func int64ToJSONNumber(i int64) json.Number {
 	return json.Number(strconv.FormatInt(i, 10))
 }
```

---

### Incident Patch 8: `688a1577` (2026-09-15)
**Commit Message**: download: fix Trigger() racing a cancelled context into a false success

If oneShot failed because ctx was already cancelled, done was closed
without a value instead of sent on, so select's two cases became
simultaneously ready and picked the nil zero-value about half the
time -- a failed download reported as a successful trigger. done is
now buffered and always carries the real result.

Signed-off-by: Stephan Renatus <stephan.renatus@gmail.com>

**File**: `v1/download/download.go` (modified, +2/-5)
```diff
@@ -154,17 +154,14 @@ func (d *Downloader) SetCache(etag string) {
 // Trigger can be used to control when the downloader attempts to download
 // a new bundle in manual triggering mode.
 func (d *Downloader) Trigger(ctx context.Context) error {
-	done := make(chan error)
+	done := make(chan error, 1)
 
 	go func() {
 		err := d.oneShot(ctx)
 		if err != nil {
 			d.logger.Error("Bundle download failed: %v.", err)
-			if ctx.Err() == nil {
-				done <- err
-			}
 		}
-		close(done)
+		done <- err
 	}()
 
 	select {
```

**File**: `v1/download/oci_download.go` (modified, +2/-5)
```diff
@@ -120,19 +120,16 @@ func (d *OCIDownloader) Trigger(ctx context.Context) error {
 	d.triggerWG.Add(1)
 	d.stateMtx.Unlock()
 
-	done := make(chan error)
+	done := make(chan error, 1)
 
 	go func() {
 		defer d.triggerWG.Done()
 
 		err := d.oneShot(ctx)
 		if err != nil {
 			d.logger.Error("OCI - Bundle download failed: %v.", err)
-			if ctx.Err() == nil {
-				done <- err
-			}
 		}
-		close(done)
+		done <- err
 	}()
 
 	select {
```

---

### Incident Patch 9: `c7239d24` (2026-09-15)
**Commit Message**: rest: fix SSO cache path written to wrong field

ssoCachePath() was assigning to cs.Path instead of cs.SSOCachePath,
so caching never worked and it clobbered the AWS config path field.

Signed-off-by: Stephan Renatus <stephan.renatus@gmail.com>

**File**: `v1/plugins/rest/aws.go` (modified, +2/-2)
```diff
@@ -153,9 +153,9 @@ func (cs *awsSSOCredentialsService) ssoCachePath() (string, error) {
 		return "", fmt.Errorf("user home directory not found: %w", err)
 	}
 
-	cs.Path = filepath.Join(homeDir, ".aws", "sso", "cache")
+	cs.SSOCachePath = filepath.Join(homeDir, ".aws", "sso", "cache")
 
-	return cs.Path, nil
+	return cs.SSOCachePath, nil
 }
 
 func (cs *awsSSOCredentialsService) cacheKeyFileName() string {
```

---

### Incident Patch 10: `28a758d1` (2026-09-15)
**Commit Message**: rest: remove stray debug print in Azure KeyVault signing

Signed-off-by: Stephan Renatus <stephan.renatus@gmail.com>

**File**: `v1/plugins/rest/auth.go` (modified, +0/-1)
```diff
@@ -415,7 +415,6 @@ func (ap *oauth2ClientCredentialsAuthPlugin) SignWithKeyVault(ctx context.Contex
 	input := encodedHdr + "." + encodedPayload
 	digest, err := messageDigest([]byte(input), ap.AzureSigningPlugin.keyVaultSignPlugin.config.Alg)
 	if err != nil {
-		fmt.Println("unsupported algorithm", ap.AzureSigningPlugin.keyVaultSignPlugin.config.Alg)
 		return nil, err
 	}
 
```

#### Recent Merged Pull Requests:
- **PR #9298** (2026-09-30): Remove claude agents.md hook (@charlieegan3)
- **PR #9295** (2026-09-30): metrics: replace rcrowley/go-metrics with in-tree sample (@sspaink)
- **PR #9294** (2026-09-30): build(deps): bump fast-uri from 3.1.7 to 3.1.8 in /docs (@dependabot[bot])
- **PR #9293** (2026-09-30): build(deps): bump brace-expansion in /docs (@dependabot[bot])
- **PR #9292** (closed): bundle: use only root .signatures.json for verification (@wangyusheng1985)
- **PR #9291** (2026-09-30): Integrate patch release v1.21.1 (@srenatus)
- **PR #9290** (2026-09-30): runtime: allow configuring the HTTP access log level (@srenatus)
- **PR #9288** (2026-09-30): cmd: replace spf13/viper with os.LookupEnv (@sspaink)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

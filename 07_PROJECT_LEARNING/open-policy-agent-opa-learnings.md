# Forensic Learning Record (Deep Inspection): open-policy-agent/opa

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-policy-agent-opa-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-policy-agent/opa](https://github.com/open-policy-agent/opa))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:51:40.610Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-policy-agent/opa`
- **Description**: Open Policy Agent (OPA) is an open source, general-purpose policy engine.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 12323 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/utils.go`
```
// Copyright 2025 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

package cmd

import (
	"fmt"
)

type ExitError struct {
	Exit    int
	wrapped error
}

func newExitError(exit int) error {
	return &ExitError{Exit: exit}
}

func newExitErrorWrap(exit int, err error) error {
	return &ExitError{Exit: exit, wrapped: err}
}

func (c *ExitError) Error() string {
	return fmt.Sprintf("exit %d", c.Exit)
}

func (c *ExitError) Unwrap() error {
	return c.wrapped
}

```

### Core Architecture Module: `hooks/hooks.go`
```
// Copyright 2026 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

// Deprecated: This package is intended for older projects transitioning from OPA v0.x and will remain for the lifetime of OPA v1.x, but its use is not recommended.
// For newer features and behaviours, such as defaulting to the Rego v1 syntax, use the corresponding components in the [github.com/open-policy-agent/opa/v1] package instead.
// See https://www.openpolicyagent.org/docs/latest/v0-compatibility/ for more information.
package hooks

import (
	v1 "github.com/open-policy-agent/opa/v1/hooks"
)

// Hook is a hook to be called in some select places in OPA's operation.
//
// The base Hook interface is any, and wherever a hook can occur, the calling code
// will check if your hook implements an appropriate interface. If so, your hook
// is called.
//
// This allows you to only hook in to behavior you care about, and it allows the
// OPA to add more hooks in the future.
//
// All hook interfaces in this package have Hook in the name. Hooks must be safe
// for concurrent use. It is expected that hooks are fast; if a hook needs to take
// time, then copy what you need and ensure the hook is async.
//
// When multiple instances of a hook are provided, they are all going to be executed
// in an unspecified order (it's a map-range call underneath). If you need hooks to
// be run in order, you can wrap them into another hook, and configure that one.
type Hook = v1.Hook

// Hooks is the type used for every struct in OPA that can work with hooks.
type Hooks = v1.Hooks

// New creates a new instance of Hooks.
func New(hs ...Hook) Hooks {
	return v1.New(hs...)
}

// ConfigHook allows inspecting or rewriting the configuration when the plugin
// manager is processing it.
// Note that this hook is not run when the plugin manager is reconfigured. This
// usually only happens when there's a new config from a discovery bundle, and
// for processing _that_, there's `ConfigDiscoveryHook`.
type ConfigHook = v1.ConfigHook

// ConfigHook allows inspecting or rewriting the discovered configuration when
// the discovery plugin is processing it.
type ConfigDiscoveryHook = v1.ConfigDiscoveryHook

```

### Core Architecture Module: `internal/bundle/utils.go`
```
// Copyright 2020 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

package bundle

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/open-policy-agent/opa/v1/ast"
	"github.com/open-policy-agent/opa/v1/bundle"
	"github.com/open-policy-agent/opa/v1/resolver/wasm"
	"github.com/open-policy-agent/opa/v1/storage"
)

// LoadWasmResolversFromStore will lookup all Wasm modules from the store along with the
// associated bundle manifest configuration and instantiate the respective resolvers.
func LoadWasmResolversFromStore(ctx context.Context, store storage.Store, txn storage.Transaction, otherBundles map[string]*bundle.Bundle) ([]*wasm.Resolver, error) {
	bundleNames, err := bundle.ReadBundleNamesFromStore(ctx, store, txn)
	if err != nil && !storage.IsNotFound(err) {
		return nil, err
	}

	var resolversToLoad []*bundle.WasmModuleFile
	for _, bundleName := range bundleNames {
		var wasmResolverConfigs []bundle.WasmResolver
		rawModules := map[string][]byte{}

		// Save round-tripping the bundle that was just activated
		if _, ok := otherBundles[bundleName]; ok {
			wasmResolverConfigs = otherBundles[bundleName].Manifest.WasmResolvers
			for _, wmf := range otherBundles[bundleName].WasmModules {
				rawModules[wmf.Path] = wmf.Raw
			}
		} else {
			wasmResolverConfigs, err = bundle.ReadWasmMetadataFromStore(ctx, store, txn, bundleName)
			if err != nil && !storage.IsNotFound(err) {
				return nil, fmt.Errorf("failed to read wasm module manifest from store: %s", err)
			}
			rawModules, err = bundle.ReadWasmModulesFromStore(ctx, store, txn, bundleName)
			if err != nil && !storage.IsNotFound(err) {
				return nil, fmt.Errorf("failed to read wasm modules from store: %s", err)
			}
		}

		for path, raw := range rawModules {
			wmf := &bundle.WasmModuleFile{
				URL:  path,
				Path: path,
				Raw:  raw,
			}
			for _, resolverConf := range wasmResolverConfigs {
				if resolverConf.Module == path {
					ref, err := ast.PtrRef(ast.DefaultRootDocument, resolverConf.Entrypoint)
					if err != nil {
						return nil, fmt.Errorf("failed to parse wasm module entrypoint '%s': %s", resolverConf.Entrypoint, err)
					}
					wmf.Entrypoints = append(wmf.Entrypoints, ref)
				}
			}
			if len(wmf.Entrypoints) > 0 {
				resolversToLoad = append(resolversToLoad, wmf)
			}
		}
	}

	var resolvers []*wasm.Resolver
	if len(resolversToLoad) > 0 {
		// Get a full snapshot of the current data (including any from "outside" the bundles)
		data, err := store.Read(ctx, txn, storage.RootPath)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize wasm runtime: %s", err)
		}

		for _, wmf := range resolversToLoad {
			resolver, err := wasm.NewWithContext(ctx, wmf.Entrypoints, wmf.Raw, data)
			if err != nil {
				return nil, fmt.Errorf("failed to initialize wasm module for entrypoints '%s': %s", wmf.Entrypoints, err)
			}
			resolvers = append(resolvers, resolver)
		}
	}
	return resolvers, nil
}

// LoadBundleFromDisk loads a previously persisted activated bundle from disk
func LoadBundleFromDisk(path, name string, bvc *bundle.VerificationConfig) (*bundle.Bundle, error) {
	return LoadBundleFromDiskForRegoVersion(ast.RegoV0, path, name, bvc)
}

func LoadBundleFromDiskForRegoVersion(regoVersion ast.RegoVersion, path, name string, bvc *bundle.VerificationConfig) (*bundle.Bundle, error) {
	bundlePath := filepath.Join(path, name, "bundle.tar.gz")

	_, err := os.Stat(bundlePath)
	if err == nil {
		f, err := os.Open(bundlePath)
		if err != nil {
			return nil, err
		}
		defer f.Close()

		r := bundle.NewCustomReader(bundle.NewTarballLoaderWithBaseURL(f, "")).
			WithRegoVersion(regoVersion)

		if bvc != nil {
			r = r.WithBundleVerificationConfig(bvc)
		}

		b, err := r.Read()
		if err != nil {
			return nil, err
		}
		return &b, nil
	} else if os.IsNotExist(err) {
		return nil, nil
	}

	return nil, err
}

// SaveBundleToDisk saves the given raw bytes representing the bundle's content to disk
func SaveBundleToDisk(path string, raw io.Reader) (string, error) {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		err = os.MkdirAll(path, os.ModePerm)
		if err != nil {
			return "", err
		}
	}

	if raw == nil {
		return "", errors.New("no raw bundle bytes to persist to disk")
	}

	dest, err := os.CreateTemp(path, ".bundle.tar.gz.*.tmp")
	if err != nil {
		return "", err
	}
	defer dest.Close()

	_, err = io.Copy(dest, raw)
	return dest.Name(), err
}

```

### Core Architecture Module: `internal/compiler/utils.go`
```
// Copyright 2023 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

package compiler

import (
	"errors"
	"sync"

	"github.com/open-policy-agent/opa/v1/ast"
	"github.com/open-policy-agent/opa/v1/schemas"
	"github.com/open-policy-agent/opa/v1/util"
)

type SchemaFile string

const (
	AuthorizationPolicySchema SchemaFile = "authorizationPolicy.json"
)

var schemaDefinitions = map[SchemaFile]any{}

var loadOnce = sync.OnceValue(func() error {
	cont, err := schemas.FS.ReadFile(string(AuthorizationPolicySchema))
	if err != nil {
		return err
	}

	if len(cont) == 0 {
		return errors.New("expected authorization policy schema file to be present")
	}

	var schema any
	if err := util.Unmarshal(cont, &schema); err != nil {
		return err
	}

	schemaDefinitions[AuthorizationPolicySchema] = schema

	return nil
})

// VerifyAuthorizationPolicySchema performs type checking on rules against the schema for the Authorization Policy
// Input document.
// NOTE: The provided compiler should have already run the compilation process on the input modules
func VerifyAuthorizationPolicySchema(compiler *ast.Compiler, ref ast.Ref) error {
	if err := loadOnce(); err != nil {
		panic(err)
	}

	rules := getRulesWithDependencies(compiler, ref)

	if len(rules) == 0 {
		return nil
	}

	schemaSet := ast.NewSchemaSet()
	schemaSet.Put(ast.SchemaRootRef, schemaDefinitions[AuthorizationPolicySchema])

	errs := ast.NewCompiler().
		WithDefaultRegoVersion(compiler.DefaultRegoVersion()).
		WithSchemas(schemaSet).
		PassesTypeCheckRules(rules)

	if len(errs) > 0 {
		return errs
	}

	return nil
}

// getRulesWithDependencies returns a slice of rules that are referred to by ref along with their dependencies
func getRulesWithDependencies(compiler *ast.Compiler, ref ast.Ref) []*ast.Rule {
	allRules := compiler.GetRules(ref)

	deps := map[*ast.Rule]struct{}{}
	for _, rule := range allRules {
		transitiveDependencies(compiler, rule, deps)
	}

	for dep := range deps {
		allRules = append(allRules, dep)
	}

	return allRules
}

func transitiveDependencies(compiler *ast.Compiler, rule *ast.Rule, deps map[*ast.Rule]struct{}) {
	for x := range compiler.Graph.Dependencies(rule) {
		other := x.(*ast.Rule)
		deps[other] = struct{}{}
		transitiveDependencies(compiler, other, deps)
	}
}

```

### Core Architecture Module: `internal/gojsonschema/utils.go`
```
// Copyright 2015 xeipuuv ( https://github.com/xeipuuv )
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// author           xeipuuv
// author-github    https://github.com/xeipuuv
// author-mail      xeipuuv@gmail.com
//
// repository-name  gojsonschema
// repository-desc  An implementation of JSON Schema, based on IETF's draft v4 - Go language.
//
// description      Various utility functions.
//
// created          26-02-2013

package gojsonschema

import (
	"encoding/json"
	"math/big"
	"slices"
)

func isStringInSlice(s []string, what string) bool {
	return slices.Contains(s, what)
}

func marshalToJSONString(value any) (*string, error) {

	mBytes, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}

	sBytes := string(mBytes)
	return &sBytes, nil
}

func marshalWithoutNumber(value any) (*string, error) {

	// The JSON is decoded using https://golang.org/pkg/encoding/json/#Decoder.UseNumber
	// This means the numbers are internally still represented as strings and therefore 1.00 is unequal to 1
	// One way to eliminate these differences is to decode and encode the JSON one more time without Decoder.UseNumber
	// so that these differences in representation are removed

	jsonString, err := marshalToJSONString(value)
	if err != nil {
		return nil, err
	}

	var document any

	err = json.Unmarshal([]byte(*jsonString), &document)
	if err != nil {
		return nil, err
	}

	return marshalToJSONString(document)
}

func isJSONNumber(what any) bool {

	switch what.(type) {

	case json.Number:
		return true
	}

	return false
}

func checkJSONInteger(what any) (isInt bool) {

	jsonNumber := what.(json.Number)

	bigFloat, isValidNumber := new(big.Rat).SetString(string(jsonNumber))

	return isValidNumber && bigFloat.IsInt()

}

// same as ECMA Number.MAX_SAFE_INTEGER and Number.MIN_SAFE_INTEGER
const (
	maxJSONFloat = float64(1<<53 - 1)  // 9007199254740991.0 	 2^53 - 1
	minJSONFloat = -float64(1<<53 - 1) //-9007199254740991.0	-2^53 - 1
)

func mustBeInteger(what any) *int {
	number, ok := what.(json.Number)
	if !ok {
		return nil
	}

	isInt := checkJSONInteger(number)
	if !isInt {
		return nil
	}

	int64Value, err := number.Int64()
	if err != nil {
		return nil
	}

	// This doesn't actually convert to an int32 value; it converts to the
	// system-specific default integer. Assuming this is a valid int32 could cause
	// bugs.
	int32Value := int(int64Value)
	return &int32Value
}

func mustBeNumber(what any) *big.Rat {
	number, ok := what.(json.Number)
	if !ok {
		return nil
	}

	float64Value, success := new(big.Rat).SetString(string(number))
	if success {
		return float64Value
	}
	return nil
}

func convertDocumentNode(val any) any {

	if lval, ok := val.([]any); ok {

		res := []any{}
		for _, v := range lval {
			res = append(res, convertDocumentNode(v))
		}

		return res

	}

	if mval, ok := val.(map[any]any); ok {

		res := map[string]any{}

		for k, v := range mval {
			res[k.(string)] = convertDocumentNode(v)
		}

		return res

	}

	return val
}

```

### Core Architecture Module: `internal/pathwatcher/utils.go`
```
// Copyright 2023 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

// Package pathwatcher provides helper functions for creating file and directory watchers
package pathwatcher

import (
	"context"
	"os"
	"path/filepath"

	"github.com/fsnotify/fsnotify"
	initload "github.com/open-policy-agent/opa/internal/runtime/init"
	"github.com/open-policy-agent/opa/v1/ast"
	"github.com/open-policy-agent/opa/v1/loader"
	"github.com/open-policy-agent/opa/v1/storage"
	"github.com/open-policy-agent/opa/v1/util"
)

// CreatePathWatcher creates watchers to monitor for path changes
func CreatePathWatcher(rootPaths []string) (*fsnotify.Watcher, error) {
	watchPaths, err := getWatchPaths(rootPaths)
	if err != nil {
		return nil, err
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	for _, path := range watchPaths {
		if err := watcher.Add(path); err != nil {
			return nil, err
		}
	}

	return watcher, nil
}

// ProcessWatcherUpdate handles an occurrence of a watcher event
func ProcessWatcherUpdate(ctx context.Context, paths []string, removed string, store storage.Store, filter loader.Filter, asBundle bool, bundleLazyLoadingMode bool,
	f func(context.Context, storage.Transaction, *initload.LoadPathsResult) error) error {
	return ProcessWatcherUpdateForRegoVersion(ctx, ast.ParserOptions{RegoVersion: ast.DefaultRegoVersion, ProcessAnnotation: true}, paths, removed, store, filter, asBundle, bundleLazyLoadingMode, f)
}

func ProcessWatcherUpdateForRegoVersion(ctx context.Context, popts ast.ParserOptions, paths []string, removed string, store storage.Store, filter loader.Filter, asBundle bool, bundleLazyLoadingMode bool,
	f func(context.Context, storage.Transaction, *initload.LoadPathsResult) error) error {
	loaded, err := initload.LoadPathsForRegoVersion(popts, paths, filter, asBundle, nil, true, bundleLazyLoadingMode, false, nil)
	if err != nil {
		return err
	}

	removed = loader.CleanPath(removed)

	return storage.Txn(ctx, store, storage.WriteParams, func(txn storage.Transaction) error {
		if !asBundle {
			ids, err := store.ListPolicies(ctx, txn)
			if err != nil {
				return err
			}
			for _, id := range ids {
				if id == removed {
					if err := store.DeletePolicy(ctx, txn, id); err != nil {
						return err
					}
				} else if _, exists := loaded.Files.Modules[id]; !exists {
					// This branch get hit in two cases.
					// 1. Another piece of code has access to the store and inserts
					//    a policy out-of-band.
					// 2. In between FS notification and loader.Filtered() call above, a
					//    policy is removed from disk.
					bs, err := store.GetPolicy(ctx, txn, id)
					if err != nil {
						return err
					}
					module, err := ast.ParseModuleWithOpts(id, string(bs), popts)
					if err != nil {
						return err
					}
					loaded.Files.Modules[id] = &loader.RegoFile{
						Name:   id,
						Raw:    bs,
						Parsed: module,
					}
				}
			}
		}

		return f(ctx, txn, loaded)
	})
}

func getWatchPaths(rootPaths []string) ([]string, error) {
	paths := []string{}

	for _, path := range rootPaths {

		_, path = loader.SplitPrefix(path)
		result, err := loader.Paths(path, true)
		if err != nil {
			return nil, err
		}

		unique := map[string]struct{}{}

		for _, r := range result {
			fi, err := os.Lstat(r)
			if err != nil {
				return nil, err
			}

			if fi.IsDir() {
				unique[r] = struct{}{}
			} else {
				dir := filepath.Dir(r)
				unique[dir] = struct{}{}
			}
		}

		paths = append(paths, util.KeysSorted(unique)...)
	}

	return paths, nil
}

```

### Core Architecture Module: `internal/providers/aws/util.go`
```
package aws

import (
	"errors"
	"io"
	"net/http"

	"github.com/open-policy-agent/opa/v1/logging"
)

// DoRequestWithClient is a convenience function to get the body of an HTTP response with
// appropriate error-handling boilerplate and logging.
func DoRequestWithClient(req *http.Request, client *http.Client, desc string, logger logging.Logger) ([]byte, error) {
	resp, err := client.Do(req)
	if err != nil {
		// some kind of catastrophe talking to the service
		return nil, errors.New(desc + " HTTP request failed: " + err.Error())
	}
	defer resp.Body.Close()

	logger.WithFields(map[string]any{
		"url":     req.URL.String(),
		"status":  resp.Status,
		"headers": resp.Header,
	}).Debug("Received response from %s service.", desc)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		// deal with problems reading the body, whatever those might be
		return nil, errors.New(desc + " HTTP response body could not be read: " + err.Error())
	}

	if resp.StatusCode != 200 {
		logger.Debug("Error response with response body: %s", body)
		// could be 404 for role that's not available, but cover all the bases
		return nil, errors.New(desc + " HTTP request returned unexpected status: " + resp.Status)
	}
	return body, nil
}

```

### Core Architecture Module: `internal/providers/aws/v4/util.go`
```
package v4

import (
	"net/url"
	"strings"
)

const doubleSpace = "  "

// StripExcessSpaces will rewrite the passed in slice's string values to not
// contain multiple side-by-side spaces.
func StripExcessSpaces(str string) string {
	var j, k, l, m, spaces int

	// Trim leading and trailing spaces
	str = strings.Trim(str, " ")

	// Strip multiple spaces.
	j = strings.Index(str, doubleSpace)
	if j < 0 {
		return str
	}

	buf := []byte(str)
	for k, m, l = j, j, len(buf); k < l; k++ {
		if buf[k] == ' ' {
			if spaces == 0 {
				// First space.
				buf[m] = buf[k]
				m++
			}
			spaces++
		} else {
			// End of multiple spaces.
			spaces = 0
			buf[m] = buf[k]
			m++
		}
	}

	return string(buf[:m])
}

// GetURIPath returns the escaped URI component from the provided URL
func GetURIPath(u *url.URL) string {
	var uri string

	if len(u.Opaque) > 0 {
		uri = "/" + strings.Join(strings.Split(u.Opaque, "/")[3:], "/")
	} else {
		uri = u.EscapedPath()
	}

	if len(uri) == 0 {
		uri = "/"
	}

	return uri
}

```

### Core Architecture Module: `internal/rego/opa/engine.go`
```
// Copyright 2021 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

package opa

import (
	"context"
)

// ErrEngineNotFound is returned by LookupEngine if no wasm engine was
// registered by that name.
var ErrEngineNotFound error = &errEngineNotFound{}

type errEngineNotFound struct{}

func (*errEngineNotFound) Error() string { return "engine not found" }
func (*errEngineNotFound) Lines() []string {
	return []string{
		`WebAssembly runtime not supported in this build.`,
		`----------------------------------------------------------------------------------`,
		`Please download an OPA binary with Wasm enabled from`,
		`https://www.openpolicyagent.org/docs/latest/#running-opa`,
		`or build it yourself (with Wasm enabled).`,
		`----------------------------------------------------------------------------------`,
	}
}

// Engine repesents a factory for instances of EvalEngine implementations
type Engine interface {
	New() EvalEngine
}

// EvalEngine is the interface implemented by an engine used to eval a policy
type EvalEngine interface {
	Init() (EvalEngine, error)
	Entrypoints(context.Context) (map[string]int32, error)
	WithPolicyBytes([]byte) EvalEngine
	WithDataJSON(any) EvalEngine
	Eval(context.Context, EvalOpts) (*Result, error)
	SetData(context.Context, any) error
	SetDataPath(context.Context, []string, any) error
	RemoveDataPath(context.Context, []string) error
	Close()
}

var engines = map[string]Engine{}

// RegisterEngine registers an evaluation engine by its target name.
// Note that the "rego" target is always available.
func RegisterEngine(name string, e Engine) {
	if engines[name] != nil {
		panic("duplicate engine registration")
	}
	engines[name] = e
}

// LookupEngine allows retrieving an engine registered by name
func LookupEngine(name string) (Engine, error) {
	e, ok := engines[name]
	if !ok {
		return nil, ErrEngineNotFound
	}
	return e, nil
}

```

### Core Architecture Module: `internal/tlsutil/tlsutil.go`
```
// Copyright 2024 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

package tlsutil

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"os"
)

// LoadCertificate loads a TLS certificate from the given cert and key files.
// If both are empty, it returns nil. If only one is provided, it returns an error.
func LoadCertificate(certFile, keyFile string) (*tls.Certificate, error) {
	if certFile != "" && keyFile != "" {
		cert, err := tls.LoadX509KeyPair(certFile, keyFile)
		if err != nil {
			return nil, err
		}
		return &cert, nil
	}

	if certFile != "" || keyFile != "" {
		return nil, errors.New("tls_cert_file and tls_private_key_file must be specified together")
	}

	return nil, nil
}

// LoadCertPool loads a certificate pool from the given CA cert file.
// If the file is empty, it returns nil.
func LoadCertPool(caCertFile string) (*x509.CertPool, error) {
	if caCertFile == "" {
		return nil, nil
	}

	caCertPEM, err := os.ReadFile(caCertFile)
	if err != nil {
		return nil, fmt.Errorf("read CA cert file: %v", err)
	}
	pool := x509.NewCertPool()
	if ok := pool.AppendCertsFromPEM(caCertPEM); !ok {
		return nil, fmt.Errorf("failed to parse CA cert %q", caCertFile)
	}
	return pool, nil
}

// BuildTLSConfig creates a *tls.Config based on the encryption scheme.
// For "off", it returns nil. For "mtls", a certificate is required.
func BuildTLSConfig(scheme string, skipVerify bool, cert *tls.Certificate, pool *x509.CertPool) (*tls.Config, error) {
	if scheme == "off" {
		return nil, nil
	}
	tlsConfig := &tls.Config{
		RootCAs:            pool,
		InsecureSkipVerify: skipVerify,
	}
	if scheme == "mtls" {
		if cert == nil {
			return nil, errors.New("tls_cert_file required but not supplied")
		}
		tlsConfig.Certificates = []tls.Certificate{*cert}
	}
	return tlsConfig, nil
}

```

### Core Architecture Module: `internal/wasm/sdk/opa/loader/http/util.go`
```
// Copyright 2020 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

package http

import (
	"math/rand"
	"time"
)

// defaultBackoff returns a delay with an exponential backoff based on the
// number of retries.
func defaultBackoff(base, max float64, retries int) time.Duration {
	return backoff(base, max, .2, 1.6, retries)
}

// backoff returns a delay with an exponential backoff based on the number of
// retries. Same algorithm used in gRPC.
func backoff(base, max, jitter, factor float64, retries int) time.Duration {
	if retries == 0 {
		return 0
	}

	backoff, max := float64(base), float64(max)
	for backoff < max && retries > 0 {
		backoff *= factor
		retries--
	}
	if backoff > max {
		backoff = max
	}

	// Randomize backoff delays so that if a cluster of requests start at
	// the same time, they won't operate in lockstep.
	backoff *= 1 + jitter*(rand.Float64()*2-1)
	if backoff < 0 {
		return 0
	}

	return time.Duration(backoff)
}

```

### Core Architecture Module: `internal/wasm/util/util.go`
```
// Copyright 2020 The OPA Authors.  All rights reserved.
// Use of this source code is governed by an Apache2
// license that can be found in the LICENSE file.

package util

// PageSize represents the WASM page size in bytes.
const PageSize = 65535

// Pages converts a byte size to Pages, rounding up as necessary.
func Pages(n uint32) uint32 {
	pages := n / PageSize
	if pages*PageSize == n {
		return pages
	}

	return pages + 1
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

### Incident Patch 1: `c9b1edc3` (2026-10-02)
**Commit Message**: topdown: don't panic reversing strings that aren't valid UTF-8

strings.reverse and strings.any_suffix_match re-encoded every rune, which
writes three bytes for each invalid one; those bytes are now moved as they are.

Signed-off-by: Sebastian Spaink <[REDACTED_EMAIL]>

**File**: `v1/topdown/strings.go` (modified, +4/-0)
```diff
@@ -890,6 +890,10 @@ func reverseString(str string) string {
 	for start := 0; start < size; {
 		r, n := utf8.DecodeRuneInString(str[start:])
 		start += n
+		if r == utf8.RuneError && n == 1 {
+			buf[size-start] = str[start-1]
+			continue
+		}
 		utf8.EncodeRune(buf[size-start:], r)
 	}
 
```

**File**: `v1/topdown/strings_test.go` (modified, +71/-0)
```diff
@@ -165,3 +165,74 @@ func TestAnyStartsWithAnyMatchesBruteForce(t *testing.T) {
 		}
 	}
 }
+
+func TestBuiltinReverse(t *testing.T) {
+	long := strings.Repeat("ab\xffé", 100) // past the 255-byte stack buffer
+	tests := []struct {
+		note string
+		s    string
+		exp  string
+	}{
+		{note: "empty", s: "", exp: ""},
+		{note: "ascii", s: "abc", exp: "cba"},
+		{note: "multi-byte runes", s: "añb€", exp: "€bña"},
+		{note: "invalid byte first", s: "\xffab", exp: "ba\xff"},
+		{note: "invalid byte last", s: "ab\xff", exp: "\xffba"},
+		{note: "invalid byte between runes", s: "é\xff€", exp: "€\xffé"},
+		{note: "truncated rune", s: "a\xe2\x82", exp: "\x82\xe2a"},
+		{note: "encoded replacement character", s: "a�b", exp: "b�a"},
+		{note: "long", s: long, exp: strings.Repeat("é\xffba", 100)},
+	}
+	for _, tc := range tests {
+		t.Run(tc.note, func(t *testing.T) {
+			var got string
+			if err := builtinReverse(BuiltinContext{}, []*ast.Term{ast.StringTerm(tc.s)}, func(r *ast.Term) error {
+				got = string(r.Value.(ast.String))
+				return nil
+			}); err != nil {
+				t.Fatal(err)
+			}
+			if got != tc.exp {
+				t.Errorf("expected %q, got %q", tc.exp, got)
+			}
+		})
+	}
+}
+
+func TestReverseStringArbitraryBytes(t *testing.T) {
+	rng := rand.New(rand.NewPCG(3, 4))
+	for range 10000 {
+		b := make([]byte, rng.IntN(300))
+		for i := range b {
+			b[i] = byte(rng.Uint32())
+		}
+		s := string(b)
+
+		got := reverseString(s)
+
+		// Whatever the input, the output holds the same bytes.
+		if !slices.Equal(slices.Sorted(slices.Values([]byte(got))), slices.Sorted(slices.Values(b))) {
+			t.Fatalf("reverseString(%q) = %q: not a rearrangement of the input", s, got)
+		}
+		// And a valid string comes back out as its runes in reverse.
+		if valid := strings.ToValidUTF8(s, ""); reverseString(reverseString(valid)) != valid {
+			t.Fatalf("reverseString is not its own inverse for %q", valid)
+		}
+	}
+}
+
+func TestBuiltinAnySuffixMatchInvalidUTF8(t *testing.T) {
+	// Suffix matching reverses the strings, which used to panic on bytes that
+	// aren't valid UTF-8.
+	var got bool
+	err := builtinAnySuffixMatch(BuiltinContext{}, []*ast.Term{ast.StringTerm("a\xff"), ast.StringTerm("\xff")}, func(r *ast.Term) error {
+		got = bool(r.Value.(ast.Boolean))
+		return nil
+	})
+	if err != nil {
+		t.Fatal(err)
+	}
+	if !got {
+		t.Error("expected a match")
+	}
+}
```

---

### Incident Patch 2: `f24bf895` (2026-10-01)
**Commit Message**: docs: Fix broken links from link checker report (#9316)

Fixes #9303. Points moved repos at their new homes, archives dead blog
links, drops removed videos from ecosystem entries, and excludes test
fixtures and bot-blocking hosts from lychee.

Signed-off-by: Sebastian Spaink <[REDACTED_EMAIL]>

**File**: `build/lychee/repo.toml` (modified, +2/-0)
```diff
@@ -25,4 +25,6 @@ exclude_path = [
     'vendor',
     'internal',
     'CHANGELOG\.md',
+    # release notes tool fixtures use placeholder github.com/example links
+    'build/release/testdata',
 ]
```

**File**: `build/lychee/website.toml` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ exclude = [
     'blog\.openpolicyagent\.org',
     'itnext\.io',
     'stacklok\.com',
+    'linkedin\.com',
     # These domains frequently timeout, causing false positives
     # e.g. https://github.com/open-policy-agent/opa/issues/8495
     'opa-docs\.netlify\.app',
```

**File**: `docs/blog/2017-02-28-what-is-policy-part-one-enforcement-bad8ea8eb35c.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ date: 2017-02-28
 slug: what-is-policy-part-one-enforcement-bad8ea8eb35c
 ---
 
-_Welcome to the Open Policy Agent project. If you're interested in topics like policy, enforcement, remediation, and compliance we'd love to hear from you! Join us on [Slack](http://slack-inviter-1327627577.us-west-2.elb.amazonaws.com) or check out the project on [GitHub](https://github.com/open-policy-agent/opa)._
+_Welcome to the Open Policy Agent project. If you're interested in topics like policy, enforcement, remediation, and compliance we'd love to hear from you! Join us on [Slack](https://slack.openpolicyagent.org/) or check out the project on [GitHub](https://github.com/open-policy-agent/opa)._
 
 This is the first in a two-part series about policy where we introduce definitions, concepts, and challenges in policy enforcement. In future series we'll examine the state of policy in the cloud-native ecosystem.
 
```

**File**: `docs/blog/2017-05-12-authorizing-http-apis-ssh-and-puppet-with-opa-dc5341602ed5.md` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ When you write authorization policy in Rego, you're writing assertions over the
 Recently we built a handful of authorization integrations that use OPA at different points in the stack. As part of this effort we're reaching out to other projects that are looking to solve authorization in their domain. We've already built several integrations and examples spanning multiple layers:
 
 - [Micro-service API authorization with Linkerd](https://github.com/open-policy-agent/contrib/tree/master/linkerd_authz)
-- [SSH and sudo authorization with a custom PAM module](https://github.com/open-policy-agent/contrib/tree/master/pam_authz)
+- [SSH and sudo authorization with a custom PAM module](https://github.com/open-policy-agent/contrib/tree/main/pam_opa)
 - [Provisioning authorization with Puppet](https://github.com/open-policy-agent/contrib/tree/master/puppet_example)
 
 Let's look at some examples.
```

**File**: `docs/blog/2017-09-07-orderly-versus-disorderly-policies-717475c23d2f.md` (modified, +1/-1)
```diff
@@ -189,4 +189,4 @@ In the end, understanding any single statement in any policy (Orderly or Disorde
 
 When all is said and done, there are times when you want statement order to matter (overrides), and there are times when you don't want statement order to matter (composition and hierarchies). If you have a tightly-constrained use case, you might be able to choose one or the other. But if you're interested in a general-purpose policy language that works for many different use cases, across many different domains, and is used by a wide population, there's no clear winner. You'll want your policy language to support both Orderly and Disorderly policies.
 
-Given that this is a blog post for the [Open Policy Agent](http://openpolicyagent.org), it's probably not surprising that OPA supports both options and lets you mix and match as appropriate. See the [docs](http://www.openpolicyagent.org/docs/) and [FAQ](http://www.openpolicyagent.org/docs/faq.html) for more details, or reach out on the [slack channel](http://a5ec585d42ace11e7aaad0260e83477e-1095713357.us-west-2.elb.amazonaws.com).
+Given that this is a blog post for the [Open Policy Agent](http://openpolicyagent.org), it's probably not surprising that OPA supports both options and lets you mix and match as appropriate. See the [docs](http://www.openpolicyagent.org/docs/) and [FAQ](http://www.openpolicyagent.org/docs/faq.html) for more details, or reach out on the [slack channel](https://slack.openpolicyagent.org/).
```

**File**: `docs/blog/2018-02-05-partial-evaluation-162750eaf422.md` (modified, +1/-1)
```diff
@@ -195,7 +195,7 @@ For more information on how to embed OPA as a library and leverage the partial e
 
 An immediate application for partial evaluation is [RBAC](https://en.wikipedia.org/wiki/Role-based_access_control) policy enforcement. RBAC provides a simple, coarse-grained way of granting permissions by groupings. Determining whether to allow requests under RBAC involves identifying whether the caller has been associated with a role that grants permission to the perform the operation.
 
-In projects like [Kubernetes](https://kubernetes.io/docs/admin/authorization/rbac/) and [Istio](https://istio.io/docs/concepts/security/rbac.html), RBAC configuration is specified using _roles_ and _role bindings_. Roles grant permission to perform operations and role bindings associate subjects (e.g., users or service accounts) to roles. Below is an example of some role and role binding data:
+In projects like [Kubernetes](https://kubernetes.io/docs/reference/access-authn-authz/rbac/) and [Istio](https://istio.io/latest/docs/concepts/security/#authorization), RBAC configuration is specified using _roles_ and _role bindings_. Roles grant permission to perform operations and role bindings associate subjects (e.g., users or service accounts) to roles. Below is an example of some role and role binding data:
 
 ```json
 {
```

**File**: `docs/blog/2018-07-31-v0-9-release-4eb605bd0989.md` (modified, +2/-2)
```diff
@@ -9,7 +9,7 @@ This post provides a quick overview of the work that has gone into OPA v0.9. As
 
 ## Securing the Data Lake: Ceph and Minio Integrations
 
-During this release cycle we worked with the upstream [Ceph](https://ceph.com/) and [Minio](https://github.com/minio/minio) communities to introduce fine-grained access control into data lakes using OPA. Both Ceph and Minio support the standard S3 object storage APIs and are popular choices for deploying object storage services.
+During this release cycle we worked with the upstream [Ceph](https://ceph.io/en/) and [Minio](https://github.com/minio/minio) communities to introduce fine-grained access control into data lakes using OPA. Both Ceph and Minio support the standard S3 object storage APIs and are popular choices for deploying object storage services.
 
 The integrations into Ceph and Minio allow administrators to express fine-grained attribute-based access control (ABAC) policies over requests to the object storage layer. Compared to Bucket Policies and Object ACLs, these integrations give administrators greater control over sensitive data stored in these services. Using OPA you can enforce policies over object and file access based on context such as:
 
@@ -21,7 +21,7 @@ We expect to see more adoption of OPA to control access to sensitive data as mor
 
 For more information on the integrations see the PRs:
 
-- [Ceph integration](https://github.com/ceph/ceph/pull/22624) and [documentation preview](http://docs.ceph.com/ceph-prs/22624/radosgw/opa/)
+- [Ceph integration](https://github.com/ceph/ceph/pull/22624) and [documentation preview](https://docs.ceph.com/en/latest/radosgw/opa/)
 - [Minio integration](https://github.com/minio/minio/pull/6168)
 
 ## Profiling Policy Evaluation
```

**File**: `docs/blog/2019-05-07-envoy-external-authorization-with-opa-578213ed567c.md` (modified, +4/-4)
```diff
@@ -21,15 +21,15 @@ The [Open Policy Agent (OPA)](https://www.openpolicyagent.org/docs/v0.10.7/get-s
 
 ## OPA as an External Authorization Service
 
-We will walkthrough an example of using Envoy's [External authorization filter](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/ext_authz_filter) with OPA as an authorization service.
+We will walkthrough an example of using Envoy's [External authorization filter](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/security/ext_authz_filter) with OPA as an authorization service.
 
 ![Envoy-OPA External Authorization](/img/blog/envoy-external-authorization-with-opa-578213ed567c/4.png)
 
 The example consists of three services (web, backend and db) colocated with a running service Envoy. Each service uses the external authorization filter to call its respective OPA instance for checking if an incoming request is allowed or not.
 
 The web service receives all inbound requests from api-server-1 and api-server-2 which are deployed in different subnets. The request is forwarded to the backend service which then calls the db service.
 
-Secure communication between the web, backend and db service is established by configuring the Envoy proxies in each container to establish a mTLS connection with each other. Envoy retrieves client and server TLS certificates and trusted CA roots for mTLS communication from a SPIRE Agent which implements an [Envoy SDS](https://www.envoyproxy.io/docs/envoy/v1.10.0/configuration/secret#). The agent in-turn fetches this information from the SPIRE Server and makes it available to an identified workload. In the following example, SPIRE provides each workload an identity, in the form of a **SPIFFE ID** embedded in the TLS certificate, to facilitate mTLS communication. The SPIFFE ID of each workload can then be used by OPA to build the authorization policy. More information on [SPIRE](https://spiffe.io/spire/overview/) can be found **here**.
+Secure communication between the web, backend and db service is established by configuring the Envoy proxies in each container to establish a mTLS connection with each other. Envoy retrieves client and server TLS certificates and trusted CA roots for mTLS communication from a SPIRE Agent which implements an [Envoy SDS](https://www.envoyproxy.io/docs/envoy/v1.10.0/configuration/secret#). The agent in-turn fetches this information from the SPIRE Server and makes it available to an identified workload. In the following example, SPIRE provides each workload an identity, in the form of a **SPIFFE ID** embedded in the TLS certificate, to facilitate mTLS communication. The SPIFFE ID of each workload can then be used by OPA to build the authorization policy. More information on [SPIRE](https://web.archive.org/web/https://spiffe.io/spire/overview/) can be found **here**.
 
 - Envoy is listening for ingress on port 8001 in each container.
 - api-server-1 and api-server-2 are flask apps running on port 5000 and 5001 respectively and forward requests to the web service.
@@ -72,7 +72,7 @@ opa-envoy-spiffe-ext-authz_web_1            /bin/sh -c /usr/local/bin/ ...   Up
 
 **Step 3: Start SPIRE Infrastructure**
 
-Start the SPIRE Agents and register the web, backend and db servers with the SPIRE Server. More information on the registration process can be found in the [SPIRE workload registration guide](https://spiffe.io/spire/overview/#workload-registration).
+Start the SPIRE Agents and register the web, backend and db servers with the SPIRE Server. More information on the registration process can be found in the [SPIRE workload registration guide](https://web.archive.org/web/https://spiffe.io/spire/overview/#workload-registration).
 
 ```bash
 ./configure-spire.sh
@@ -203,7 +203,7 @@ X-Forwarded-Client-Cert header is injected by the Envoy proxy of the originating
 
 ## Example Envoy configuration
 
-Here's an example configuration for an Envoy proxy that listens for HTTP client connections on port 80 and then calls OPA's gRPC server that implements the [Envoy External Authorization API](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/ext_authz_filter).
+Here's an example configuration for an Envoy proxy that listens for HTTP client connections on port 80 and then calls OPA's gRPC server that implements the [Envoy External Authorization API](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/security/ext_authz_filter).
 
 ```yaml
 static_resources:
```

---

### Incident Patch 3: `4b32eebc` (2026-10-01)
**Commit Message**: build(deps): bump the gha-dependencies group across 1 directory with 8 updates (#9310)

Bumps the gha-dependencies group with 8 updates in the / directory:

| Package | From | To |
| --- | --- | --- |
| [actions/setup-java](https://github.com/actions/setup-java) | `6.0.0`
| `6.0.1` |
| [github/codeql-action/init](https://github.com/github/codeql-action) |
`4.37.8` | `4.38.2` |
|
[github/codeql-action/analyze](https://github.com/github/codeql-action)
| `4.37.8` | `4.38.2` |
|
[docker/setup-buildx-action](https://github.com/docker/setup-buildx-action)
| `4.3.0` | `4.4.1` |
| [bufbuild/buf-action](https://github.com/bufbuild/buf-action) |
`1.5.0` | `1.6.0` |
|
[zizmorcore/zizmor-action](https://github.com/zizmorcore/zizmor-action)
| `0.6.2` | `0.6.4` |
|
[docker/setup-qemu-action](https://github.com/docker/setup-qemu-action)
| `4.2.0` | `4.4.0` |
|
[github/codeql-action/upload-sarif](https://github.com/github/codeql-action)
| `4.37.8` | `4.38.2` |


Updates `actions/setup-java` from 6.0.0 to 6.0.1
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/actions/setup-java/releases">actions/setup-java's
releases</a>.</em></p>
<blockquote>
<h2>v6.0.1</h

**File**: `.github/workflows/benchmarks-nightly.yaml` (modified, +1/-1)
```diff
@@ -231,7 +231,7 @@ jobs:
           ref: benchmarks
           persist-credentials: true
       - name: Setup Java
-        uses: actions/setup-java@dd06d9cba3e5552c54d9f8ea23572deb30010f7c # v6.0.0
+        uses: actions/setup-java@de7274f081f381c8f8158605e0321c36c376e2e6 # v6.0.1
         with:
           distribution: 'temurin'
           java-version: '21'
```

**File**: `.github/workflows/codeql-analysis.yml` (modified, +2/-2)
```diff
@@ -48,7 +48,7 @@ jobs:
 
     # Initializes the CodeQL tools for scanning.
     - name: Initialize CodeQL
-      uses: github/codeql-action/init@db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28 # v4.37.8
+      uses: github/codeql-action/init@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
       with:
         languages: ${{ matrix.language }}
         # If you wish to specify custom queries, you can do so here or in a config file.
@@ -64,4 +64,4 @@ jobs:
         make build
 
     - name: Perform CodeQL Analysis
-      uses: github/codeql-action/analyze@db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28 # v4.37.8
+      uses: github/codeql-action/analyze@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
```

**File**: `.github/workflows/post-merge.yaml` (modified, +1/-1)
```diff
@@ -215,7 +215,7 @@ jobs:
           path: _release
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
+        uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
 
       - name: Deploy OPA Edge Docker Tags
         env:
```

**File**: `.github/workflows/post-tag.yaml` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ jobs:
           path: _release
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
+        uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
 
       - name: Build and Deploy OPA Docker Images
         id: build-and-deploy
```

**File**: `.github/workflows/pull-request.yaml` (modified, +3/-3)
```diff
@@ -282,7 +282,7 @@ jobs:
           persist-credentials: false
 
       - name: buf lint and breaking
-        uses: bufbuild/buf-action@8c6a16e16f12ba20b6470afa9c2ba9b5ba8c97c3 # v1.5.0
+        uses: bufbuild/buf-action@85aebf73123b5c15fd5528aaecbf9129cddf7fa7 # v1.6.0
         with:
           github_token: ${{ secrets.GITHUB_TOKEN }}
           lint: true
@@ -304,7 +304,7 @@ jobs:
           persist-credentials: false
 
       - name: Run zizmor
-        uses: zizmorcore/zizmor-action@3dc1ecc9bcb9e94e9b2c709687979e1298497054 # v0.6.2
+        uses: zizmorcore/zizmor-action@cc914d7f3750a2d13d75c7f184a1060aa0e9d482 # v0.6.4
 
   wasm:
     name: WASM
@@ -387,7 +387,7 @@ jobs:
         persist-credentials: false
 
     - name: Set up QEMU
-      uses: docker/setup-qemu-action@96fe6ef7f33517b61c61be40b68a1882f3264fb8 # v4.2.0
+      uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1 # v4.4.0
       with:
         platforms: arm64
 
```

**File**: `.github/workflows/scorecards.yml` (modified, +1/-1)
```diff
@@ -64,6 +64,6 @@ jobs:
       # Upload the results to GitHub's code scanning dashboard (optional).
       # Commenting out will disable upload of results to your repo's Code Scanning dashboard
       - name: "Upload to code-scanning"
-        uses: github/codeql-action/upload-sarif@db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28 # v4.37.8
+        uses: github/codeql-action/upload-sarif@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
         with:
           sarif_file: results.sarif
```

---

### Incident Patch 4: `67b3d70a` (2026-10-01)
**Commit Message**: build(deps): bump the e2e-prisma group in /e2e/api/compile/prisma with 3 updates (#9309)

Bumps the e2e-prisma group in /e2e/api/compile/prisma with 3 updates:
[@prisma/adapter-pg](https://github.com/prisma/prisma/tree/HEAD/packages/adapter-pg),
[@prisma/client](https://github.com/prisma/prisma/tree/HEAD/packages/client)
and
[prisma](https://github.com/prisma/prisma-cli/tree/HEAD/packages/prisma).

Updates `@prisma/adapter-pg` from 7.9.1 to 7.10.0
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/prisma/prisma/releases">@​prisma/adapter-pg's
releases</a>.</em></p>
<blockquote>
<h2>7.10.0</h2>
<h1>Prisma ORM 7.10.0</h1>
<p>Prisma ORM 7.10.0 introduces a compatibility package for running
Prisma 7 alongside newer Prisma versions, secures Prisma Studio's local
server, and includes fixes across Prisma Client and the PostgreSQL,
MariaDB, Neon, SQLite, and Prisma Postgres Serverless adapters.</p>
<h2>Highlights</h2>
<h3>Run Prisma 7 alongside Prisma 8</h3>
<p>This release introduces <code>@prisma/prisma7</code>, a compatibility
package that lets you retain a matching Prisma 7 CLI and configuration
while installing Prisma 8 in the same project.</p>


**File**: `e2e/api/compile/prisma/package-lock.json` (modified, +75/-68)
```diff
@@ -9,12 +9,12 @@
       "version": "0.0.1",
       "dependencies": {
         "@open-policy-agent/ucast-prisma": "^0.1.6",
-        "@prisma/adapter-pg": "^7.9.1",
-        "@prisma/client": "^7.9.1",
+        "@prisma/adapter-pg": "^7.10.0",
+        "@prisma/client": "^7.10.0",
         "pg": "^8.23.0"
       },
       "devDependencies": {
-        "prisma": "^7.9.1"
+        "prisma": "^7.10.0"
       }
     },
     "node_modules/@electric-sql/pglite": {
@@ -58,24 +58,24 @@
       }
     },
     "node_modules/@prisma/adapter-pg": {
-      "version": "7.9.1",
-      "resolved": "https://registry.npmjs.org/@prisma/adapter-pg/-/adapter-pg-7.9.1.tgz",
-      "integrity": "sha512-Ho2RK1KanQxLNSC0sR5bpiiVep10sWPLXCcxK+KXfI/Q69TMRbiafSvLPv3V9snimX72rMCqGlyJ4sBO4lKTAw==",
+      "version": "7.10.0",
+      "resolved": "https://registry.npmjs.org/@prisma/adapter-pg/-/adapter-pg-7.10.0.tgz",
+      "integrity": "sha512-N7nwSor0HO1Kz6xBv0TPAjAPysKK0fac6p4fVN3ensLOuzc/83Fgmln5k92eK/cvzqdkSR/2kkAqlbcdwVrwpw==",
       "license": "Apache-2.0",
       "dependencies": {
-        "@prisma/driver-adapter-utils": "7.9.1",
+        "@prisma/driver-adapter-utils": "7.10.0",
         "@types/pg": "^8.16.0",
         "pg": "^8.16.3",
         "postgres-array": "3.0.4"
       }
     },
     "node_modules/@prisma/client": {
-      "version": "7.9.1",
-      "resolved": "https://registry.npmjs.org/@prisma/client/-/client-7.9.1.tgz",
-      "integrity": "sha512-+xgrh2EhJVF79wC0yX5G4PI1Rdcm7Qn/nekNQ+t/O153wtNggruHal+fXHSa0QE+Tp/Cw5wvxeCEhZZ59xGm8Q==",
+      "version": "7.10.0",
+      "resolved": "https://registry.npmjs.org/@prisma/client/-/client-7.10.0.tgz",
+      "integrity": "sha512-Ubw/QS9JGIBSBUsyxAUQuK/Jcu0Tsva7le7QbLd91Kix9yJvYDdj5QkwgEbbZniH80dd+sziQcALPc+HnvQC8Q==",
       "license": "Apache-2.0",
       "dependencies": {
-        "@prisma/client-runtime-utils": "7.9.1"
+        "@prisma/client-runtime-utils": "7.10.0"
       },
       "engines": {
         "node": "^20.19 || ^22.12 || >=24.0"
@@ -94,15 +94,15 @@
       }
     },
     "node_modules/@prisma/client-runtime-utils": {
-      "version": "7.9.1",
-      "resolved": "https://registry.npmjs.org/@prisma/client-runtime-utils/-/client-runtime-utils-7.9.1.tgz",
-      "integrity": "sha512-mVIBGYdO5CFmK0HvjxrtfIyQQcPdb88pSCeVQriVQPVZyDovIWblpHfOgcS8QO187j3QF0ePArH8qPhp0AU2vg==",
+      "version": "7.10.0",
+      "resolved": "https://registry.npmjs.org/@prisma/client-runtime-utils/-/client-runtime-utils-7.10.0.tgz",
+      "integrity": "sha512-cnCy7lUV8/CctgKVEmqAbSLAmwqJdE/qAlqTBk/0NDk59zEb2cZ0M0M0E4vVPnqbSEYudRroQDvOWfUZH6RIfw==",
       "license": "Apache-2.0"
     },
     "node_modules/@prisma/config": {
-      "version": "7.9.1",
-      "resolved": "https://registry.npmjs.org/@prisma/config/-/config-7.9.1.tgz",
-      "integrity": "sha512-4znKhxTmXmuPye9Z6pbIyYb5VZlkZ05qG1L6Dr4g+7oTwc6V50Bs9XirFBDdjWt+H/AabMn9aUnxBcvj8z05aA==",
+      "version": "7.10.0",
+      "resolved": "https://registry.npmjs.org/@prisma/config/-/config-7.10.0.tgz",
+      "integrity": "sha512-Rcg828gIRE3HOQ3pOATFjV5d/P0U9OIobxhd/IMxlfWjA4vru0eGwb0AIwFw0rmcLMVShohZYWPixVxkBHsxUA==",
       "devOptional": true,
       "license": "Apache-2.0",
       "dependencies": {
@@ -113,9 +113,9 @@
       }
     },
     "node_modules/@prisma/debug": {
-      "version": "7.9.1",
-      "resolved": "https://registry.npmjs.org/@prisma/debug/-/debug-7.9.1.tgz",
-      "integrity": "sha512-/cpVZ4itxtcgB8GHBvZtcmuEjq+lWsLrRJxFMbwZrT1RIdtuKmUm7PPGo/wzfbYpBrk+9WmmBE8CHJw2rybKDQ==",
+      "version": "7.10.0",
+      "resolved": "https://registry.npmjs.org/@prisma/debug/-/debug-7.10.0.tgz",
+      "integrity": "sha512-caygJKtltmRIgdJ3jRpkOr7yM4DW6zxo5uOmojKWFb3asnxWoRkQOwZmXBgD8FZp4htrX+nMpcWqDwzlQ1+Y4g==",
       "license": "Apache-2.0"
     },
     "node_modules/@prisma/dev": {
@@ -143,65 +143,65 @@
       }
     },
     "node_modules/@prisma/driver-adapter-utils": {
-      "version": "7.9.1",
-      "resolved": "https://registry.npmjs.org/@prisma/driver-adapter-utils/-/driver-adapter-utils-7.9.1.tgz",
-      "integrity": "sha512-vmHehG7nn/heW32DXXpp13DxxAxVVe6n250oEt3dOL2E/4bt3olktKZN0mzSuxMMronyMSkbeW2uCOn3F4g8RQ==",
+      "version": "7.10.0",
+      "resolved": "https://registry.npmjs.org/@prisma/driver-adapter-utils/-/driver-adapter-utils-7.10.0.tgz",
+      "integrity": "sha512-u8zkcRLlaryO652T4qavBg0HmzNW5tSKdsCn6hc1PhWAp/J6k0vrxLuUs+b9o+HcjsK7Dfa01o4OFSn0frauJA==",
       "license": "Apache-2.0",
       "dependencies": {
-        "@prisma/debug": "7.9.1"
+        "@prisma/debug": "7.10.0"
       }
     },
     "node_modules/@prisma/engines": {
-      "version": "7.9.1",
-      "resolved": "https://registry.npmjs.org/@prisma/engines/-/engines-7.9.1.tgz",
-      "integrity": "sha512-UprXSMNXx2NF5ow4pqaQtE8OuBz6K78B0wc0tn2L28G5r933iWp1DR9Do2qWrsNvvFIP3x6mpEWnQtckMO0Uhg==",
+      "version": "7.10.0",
+      "resolved": "https://registry.npmjs.org/@prisma/engines/-/engines-7.10.0.tgz",
+      "integrity"
```

**File**: `e2e/api/compile/prisma/package.json` (modified, +3/-3)
```diff
@@ -11,12 +11,12 @@
   "description": "",
   "dependencies": {
     "@open-policy-agent/ucast-prisma": "^0.1.6",
-    "@prisma/adapter-pg": "^7.9.1",
-    "@prisma/client": "^7.9.1",
+    "@prisma/adapter-pg": "^7.10.0",
+    "@prisma/client": "^7.10.0",
     "pg": "^8.23.0"
   },
   "devDependencies": {
-    "prisma": "^7.9.1"
+    "prisma": "^7.10.0"
   },
   "overrides": {
     "hono": "^4.11.4"
```

---

### Incident Patch 5: `a08d6fe9` (2026-10-01)
**Commit Message**: build(deps): bump the dependencies group across 2 directories with 3 updates (#9308)

Bumps the dependencies group with 2 updates in the / directory:
[github.com/vektah/gqlparser/v2](https://github.com/vektah/gqlparser)
and [google.golang.org/grpc](https://github.com/grpc/grpc-go).
Bumps the dependencies group with 1 update in the /e2e directory:
[github.com/microsoft/go-mssqldb](https://github.com/microsoft/go-mssqldb).

Updates `github.com/vektah/gqlparser/v2` from 2.5.37 to 2.5.58
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/vektah/gqlparser/releases">github.com/vektah/gqlparser/v2's
releases</a>.</em></p>
<blockquote>
<h2>v2.5.58</h2>
<h2>Changelog</h2>
<ul>
<li>9a84c0a3b32c421cb7a41a113b5a5b97af621155 Compare composite argument
values in <code>sameValue</code> (<a
href="https://redirect.github.com/vektah/gqlparser/issues/108">#108</a>)
(<a
href="https://redirect.github.com/vektah/gqlparser/issues/459">#459</a>)</li>
<li>42cda298bd76501f1b0527261a098c893be9aa60 build(deps): bump
browserslist in /validator/imported (<a
href="https://redirect.github.com/vektah/gqlparser/issues/464">#464</a>)</li>
<li>991cd110b7c4d648a8392cae2f3cdfa659

**File**: `e2e/go.mod` (modified, +3/-3)
```diff
@@ -10,7 +10,7 @@ require (
 	github.com/go-sql-driver/mysql v1.10.1
 	github.com/google/go-cmp v0.7.0
 	github.com/lib/pq v1.12.3
-	github.com/microsoft/go-mssqldb v1.11.0
+	github.com/microsoft/go-mssqldb v1.11.2
 	github.com/open-policy-agent/opa v1.8.0
 	github.com/rogpeppe/go-internal v1.16.0
 	github.com/testcontainers/testcontainers-go v0.44.0
@@ -108,7 +108,7 @@ require (
 	github.com/tklauser/go-sysconf v0.4.0 // indirect
 	github.com/tklauser/numcpus v0.12.0 // indirect
 	github.com/valyala/fastjson v1.6.10 // indirect
-	github.com/vektah/gqlparser/v2 v2.5.37 // indirect
+	github.com/vektah/gqlparser/v2 v2.5.58 // indirect
 	github.com/xeipuuv/gojsonpointer v0.0.0-20190905194746-02993c407bfb // indirect
 	github.com/xeipuuv/gojsonreference v0.0.0-20180127040603-bd5ef7bd5415 // indirect
 	github.com/yashtewari/glob-intersection v0.2.0 // indirect
@@ -138,7 +138,7 @@ require (
 	golang.org/x/tools v0.49.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260819154853-08b0e4226688 // indirect
-	google.golang.org/grpc v1.83.2 // indirect
+	google.golang.org/grpc v1.84.0 // indirect
 	gopkg.in/ini.v1 v1.67.3 // indirect
 	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
 	modernc.org/libc v1.75.7 // indirect
```

**File**: `e2e/go.sum` (modified, +12/-12)
```diff
@@ -4,10 +4,10 @@ filippo.io/edwards25519 v1.2.0 h1:crnVqOiS4jqYleHd9vaKZ+HKtHfllngJIiOpNpoJsjo=
 filippo.io/edwards25519 v1.2.0/go.mod h1:xzAOLCNug/yB62zG1bQ8uziwrIqIuxhctzJT18Q77mc=
 github.com/AdaLogics/go-fuzz-headers v0.0.0-20240806141605-e8a1dd7889d6 h1:He8afgbRMd7mFxO99hRNu+6tazq8nFF9lIwo9JFroBk=
 github.com/AdaLogics/go-fuzz-headers v0.0.0-20240806141605-e8a1dd7889d6/go.mod h1:8o94RPi1/7XTJvwPpRSzSUedZrtlirdB3r9Z20bi2f8=
-github.com/Azure/azure-sdk-for-go/sdk/azcore v1.23.0 h1:4gRPBpN1f6xt88yi4WR26m7XaD9OlWtVT6bWPdGUIok=
-github.com/Azure/azure-sdk-for-go/sdk/azcore v1.23.0/go.mod h1:G7QVLxw1j1JVyrO1MA95S8m8HStaaleDZYTcfGgjB2o=
-github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.14.0 h1:CU4+EJeJi3TKYWEcYuSdWsjzw0nVsK/H0MSQOiPcymU=
-github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.14.0/go.mod h1:q0+UTSRvShwUCrR/s5HtyInYphN7Wvxb7snFM3u+SLA=
+github.com/Azure/azure-sdk-for-go/sdk/azcore v1.23.1 h1:zvXfGJCWvywnCA814d8ZiVyt+fm9nnTE8xSb99zRyfo=
+github.com/Azure/azure-sdk-for-go/sdk/azcore v1.23.1/go.mod h1:iptorS+VYKFL2N6PnebpS91dubG35eAOEERnT4PJbQU=
+github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.14.1 h1:u93s+zU2JD62im61Bm5CZIc1ZrOJaIAWEg0WOrMVkEo=
+github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.14.1/go.mod h1:oXtinPO4OLj9d1DOTrqrL1oRwGhcqadvAmrl6wTeGlk=
 github.com/Azure/azure-sdk-for-go/sdk/internal v1.12.0 h1:fhqpLE3UEXi9lPaBRpQ6XuRW0nU7hgg4zlmZZa+a9q4=
 github.com/Azure/azure-sdk-for-go/sdk/internal v1.12.0/go.mod h1:7dCRMLwisfRH3dBupKeNCioWYUZ4SS09Z14H+7i8ZoY=
 github.com/Azure/azure-sdk-for-go/sdk/security/keyvault/azkeys v1.5.0 h1:MaKvxE6D0KkjOg6Wd9M00iqP5PR0kUxCfiezes4JweM=
@@ -16,8 +16,8 @@ github.com/Azure/azure-sdk-for-go/sdk/security/keyvault/internal v1.2.0 h1:nCYfg
 github.com/Azure/azure-sdk-for-go/sdk/security/keyvault/internal v1.2.0/go.mod h1:ucUjca2JtSZboY8IoUqyQyuuXvwbMBVwFOm0vdQPNhA=
 github.com/Azure/go-ansiterm v0.0.0-20250102033503-faa5f7b0171c h1:udKWzYgxTojEKWjV8V+WSxDXJ4NFATAsZjh8iIbsQIg=
 github.com/Azure/go-ansiterm v0.0.0-20250102033503-faa5f7b0171c/go.mod h1:xomTg63KZ2rFqZQzSB4Vz2SUXa1BpHTVz9L5PTmPC4E=
-github.com/AzureAD/microsoft-authentication-library-for-go v1.7.2 h1:RHK7bS+HQMslb1sZpAokUt+zTVmue0hKSs2C791hhzU=
-github.com/AzureAD/microsoft-authentication-library-for-go v1.7.2/go.mod h1:HKpQxkWaGLJ+D/5H8QRpyQXA1eKjxkFlOMwck5+33Jk=
+github.com/AzureAD/microsoft-authentication-library-for-go v1.8.0 h1:Nljr4q1GRA/5vCrMONS+g4u4LRHNgOXVSh3O43J2CnI=
+github.com/AzureAD/microsoft-authentication-library-for-go v1.8.0/go.mod h1:Y33QHnf0FfdVewFFISOGe20mkZbxX4H839o955/PoeI=
 github.com/Microsoft/go-winio v0.6.2 h1:F2VQgta7ecxGYO8k3ZZz3RS8fVIXVxONVUPlNERoyfY=
 github.com/Microsoft/go-winio v0.6.2/go.mod h1:yd8OoFMLzJbo9gZq8j5qaps8bJ9aShtEA8Ipt1oGCvU=
 github.com/agnivade/levenshtein v1.2.1 h1:EHBY3UOn1gwdy/VbFwgo4cxecRznFk7fKWN1KOX7eoM=
@@ -163,8 +163,8 @@ github.com/mattn/go-isatty v0.0.24 h1:tGZZoVgT/KiqK1c8ocVLeDS8BSWMRd47J3Lbz7vsRe
 github.com/mattn/go-isatty v0.0.24/go.mod h1:nMCL3Zebbrt45jsMDgnfIwz6ydEQApk5oEI3HqDio6A=
 github.com/mattn/go-runewidth v0.0.19 h1:v++JhqYnZuu5jSKrk9RbgF5v4CGUjqRfBm05byFGLdw=
 github.com/mattn/go-runewidth v0.0.19/go.mod h1:XBkDxAl56ILZc9knddidhrOlY5R/pDhgLpndooCuJAs=
-github.com/microsoft/go-mssqldb v1.11.0 h1:YbDqolEjGH9hBfvKzONTf5/dbl9RKXmizMJE93lVxNs=
-github.com/microsoft/go-mssqldb v1.11.0/go.mod h1:goQLDOPlMN/l1REhnNPElMoY/yX+fUWn1+7UoFJPH9Y=
+github.com/microsoft/go-mssqldb v1.11.2 h1:FCgeBIK8um2+X4tbun6Q71N1KsfyCDPKY41e1yGVjSE=
+github.com/microsoft/go-mssqldb v1.11.2/go.mod h1:CYgwG5AMXFojbjTg+GNP5G/y6uz1BhTyZaPqQWzkGnQ=
 github.com/miekg/dns v1.1.57 h1:Jzi7ApEIzwEPLHWRcafCN9LZSBbqQpxjt/wpgvg7wcM=
 github.com/miekg/dns v1.1.57/go.mod h1:uqRjCRUuEAA6qsOiJvDd+CFo/vW+y5WR6SNmHE55hZk=
 github.com/moby/docker-image-spec v1.3.1 h1:jMKff3w6PgbfSa69GfNg+zN/XLhfXJGnEx3Nl2EsFP0=
@@ -253,8 +253,8 @@ github.com/tklauser/numcpus v0.12.0 h1:NR85qdvHA9pFse3x3weVZ0r0ST8R6l5RHbZrlRaqo
 github.com/tklauser/numcpus v0.12.0/go.mod h1:ABHeXzJnr/qqwguhClkZKT1/8VABcYrsyUiUGobwWJg=
 github.com/valyala/fastjson v1.6.10 h1:/yjJg8jaVQdYR3arGxPE2X5z89xrlhS0eGXdv+ADTh4=
 github.com/valyala/fastjson v1.6.10/go.mod h1:e6FubmQouUNP73jtMLmcbxS6ydWIpOfhz34TSfO3JaE=
-github.com/vektah/gqlparser/v2 v2.5.37 h1:jbb1Ilv+xBklV6653tKb4oVUupPNTLb5LmrnBKVI12Y=
-github.com/vektah/gqlparser/v2 v2.5.37/go.mod h1:9O4Ox6Ngd3Y12bMD3w6i3CRQXh8W1oC1q0m6olCymDM=
+github.com/vektah/gqlparser/v2 v2.5.58 h1:yHxQ3EjU2OGuDMh6noxxmZova1HkBM3CbdGtL+rvjOc=
+github.com/vektah/gqlparser/v2 v2.5.58/go.mod h1:9O4Ox6Ngd3Y12bMD3w6i3CRQXh8W1oC1q0m6olCymDM=
 github.com/xeipuuv/gojsonpointer v0.0.0-20190905194746-02993c407bfb h1:zGWFAtiMcyryUHoUjUJX0/lt1H2+i2Ka2n+D3DImSNo=
 github.com/xeipuuv/gojsonpointer v0.0.0-20190905194746-02993c407bfb/go.mod h1:N2zxlSyiKSe5eX1tZViRH5QA0qijqEDrYZiPEAiq3wU=
 github.com/xeipuuv/gojsonreference v0.0.0-20180127040603-bd5ef7bd5415 h1:EzJWgHovont7NscjpAxXsDA8S8BMYve8Y5+7cuRE7R0=
@@ -327,8 +327,8 @@ google.golang.org/genproto/googleapis/api v0.0.0-20260819154
```

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -29,7 +29,7 @@ require (
 	github.com/spf13/cobra v1.10.2
 	github.com/spf13/pflag v1.0.10
 	github.com/tetratelabs/wazero v1.12.0
-	github.com/vektah/gqlparser/v2 v2.5.37
+	github.com/vektah/gqlparser/v2 v2.5.58
 	github.com/xeipuuv/gojsonreference v0.0.0-20180127040603-bd5ef7bd5415
 	github.com/yashtewari/glob-intersection v0.2.0
 	go.opentelemetry.io/contrib/bridges/prometheus v0.71.0
@@ -49,7 +49,7 @@ require (
 	golang.org/x/term v0.46.0
 	golang.org/x/text v0.42.0
 	golang.org/x/time v0.16.0
-	google.golang.org/grpc v1.83.2
+	google.golang.org/grpc v1.84.0
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c
 	gopkg.in/ini.v1 v1.67.3
```

**File**: `go.sum` (modified, +4/-4)
```diff
@@ -174,8 +174,8 @@ github.com/tetratelabs/wazero v1.12.0 h1:DuWcpNu/FzgEXgGBDp8J1Spc+CWOvvtvVyjKlaZ
 github.com/tetratelabs/wazero v1.12.0/go.mod h1:LvKtzl2RqO4gyF27BiXU+nKAjcV8f38U+kP/q2vgxh0=
 github.com/valyala/fastjson v1.6.10 h1:/yjJg8jaVQdYR3arGxPE2X5z89xrlhS0eGXdv+ADTh4=
 github.com/valyala/fastjson v1.6.10/go.mod h1:e6FubmQouUNP73jtMLmcbxS6ydWIpOfhz34TSfO3JaE=
-github.com/vektah/gqlparser/v2 v2.5.37 h1:jbb1Ilv+xBklV6653tKb4oVUupPNTLb5LmrnBKVI12Y=
-github.com/vektah/gqlparser/v2 v2.5.37/go.mod h1:9O4Ox6Ngd3Y12bMD3w6i3CRQXh8W1oC1q0m6olCymDM=
+github.com/vektah/gqlparser/v2 v2.5.58 h1:yHxQ3EjU2OGuDMh6noxxmZova1HkBM3CbdGtL+rvjOc=
+github.com/vektah/gqlparser/v2 v2.5.58/go.mod h1:9O4Ox6Ngd3Y12bMD3w6i3CRQXh8W1oC1q0m6olCymDM=
 github.com/xeipuuv/gojsonpointer v0.0.0-20190905194746-02993c407bfb h1:zGWFAtiMcyryUHoUjUJX0/lt1H2+i2Ka2n+D3DImSNo=
 github.com/xeipuuv/gojsonpointer v0.0.0-20190905194746-02993c407bfb/go.mod h1:N2zxlSyiKSe5eX1tZViRH5QA0qijqEDrYZiPEAiq3wU=
 github.com/xeipuuv/gojsonreference v0.0.0-20180127040603-bd5ef7bd5415 h1:EzJWgHovont7NscjpAxXsDA8S8BMYve8Y5+7cuRE7R0=
@@ -299,8 +299,8 @@ google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 h1:
 google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688/go.mod h1:1RJ9BQGyNdZwkGc1eTqkErfRZ6RJyYPHZo73BZ1vQqI=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260819154853-08b0e4226688 h1:cYNAzI2sUwhmCcoj9TxvihSrqsxt6uIkj3rDRhSDmW4=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260819154853-08b0e4226688/go.mod h1:DjtHYE8FKJLivXcBEjGwndXfIC23G0VpXiXKqG179uA=
-google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
-google.golang.org/grpc v1.83.2/go.mod h1:YPI1hK3kDked6iHvgX3tR0y+nX/qpMFKhPgFsokw1S8=
+google.golang.org/grpc v1.84.0 h1:soMyaPJ8pAak5PIQ0DGBUir0XRo2fRoMqhNWMLlLxO0=
+google.golang.org/grpc v1.84.0/go.mod h1:ljCht0DrxQrXBDRTZp52Qxh3Ffk8CdYm2sj4O2QN2C0=
 google.golang.org/protobuf v1.36.12 h1:pJOKDDOyeXErUroCihFAd5LQuwXBSpVnKGrj5o/fwxc=
 google.golang.org/protobuf v1.36.12/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

---

### Incident Patch 6: `1a48da90` (2026-10-01)
**Commit Message**: build(deps): bump the website group in /docs with 3 updates (#9311)

Bumps the website group in /docs with 3 updates:
[eslint](https://github.com/eslint/eslint),
[recharts](https://github.com/recharts/recharts) and
[baseline-browser-mapping](https://github.com/web-platform-dx/baseline-browser-mapping).

Updates `eslint` from 10.8.0 to 10.11.0
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/eslint/eslint/releases">eslint's
releases</a>.</em></p>
<blockquote>
<h2>v10.11.0</h2>
<h2>Features</h2>
<ul>
<li><a
href="https://github.com/eslint/eslint/commit/d136fa4b0d2dd4a9e738ca1c012cc674d1441127"><code>d136fa4</code></a>
feat: object-shorthand handle quoted properties for
<code>ignoreConstructors</code> (<a
href="https://redirect.github.com/eslint/eslint/issues/21271">#21271</a>)
(Pavel)</li>
<li><a
href="https://github.com/eslint/eslint/commit/397b3b8134b8ce1a61cbf414d4c29c945ba25690"><code>397b3b8</code></a>
feat: report unsafe labeled <code>continue</code> in
<code>no-unsafe-finally</code> rule (<a
href="https://redirect.github.com/eslint/eslint/issues/21316">#21316</a>)
(electrohyun)</li>
<li><a
href="https://github.com/eslint/eslint/commit/

**File**: `docs/package-lock.json` (modified, +150/-35)
```diff
@@ -18,19 +18,19 @@
         "@floating-ui/react": "^0.27.20",
         "@iconify/react": "^6.0.2",
         "@mermaid-js/layout-elk": "^0.1.9",
-        "eslint": "^10.8.0",
+        "eslint": "^10.11.0",
         "glob": "^13.0.6",
         "js-yaml": "^5.4.2",
         "markdownlint-cli2": "^0.23.3",
         "md-front-matter": "^1.0.4",
         "raw-loader": "^4.0.2",
         "react-markdown": "^10.1.0",
-        "recharts": "3.10.0",
+        "recharts": "3.10.1",
         "turndown": "^7.2.4",
         "turndown-plugin-gfm": "^1.0.2"
       },
       "devDependencies": {
-        "baseline-browser-mapping": "^2.10.38",
+        "baseline-browser-mapping": "^2.11.25",
         "pagefind": "^1.5.2"
       },
       "engines": {
@@ -2043,6 +2043,62 @@
       "integrity": "sha512-jigsZK+sMF/cuiB7sERuo9V7N9jx+dhmHHnQyDSVdpZwVutaBu7WvNYqMDLSgFgfB30n452TP3vjDAvFC973mA==",
       "license": "MIT"
     },
+    "node_modules/@cacheable/memory": {
+      "version": "2.2.0",
+      "resolved": "https://registry.npmjs.org/@cacheable/memory/-/memory-2.2.0.tgz",
+      "integrity": "sha512-CTLKqLItRCEixEAewD3/j9DB3/o96gpTPD4eJ1v+DGOlxZRZncRQkGYqqnAGCscYd6RNeXfGeiuCphsPtqyIfQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@cacheable/utils": "^2.5.0",
+        "@keyv/bigmap": "^1.3.1",
+        "hookified": "^1.15.1",
+        "keyv": "^5.6.0"
+      }
+    },
+    "node_modules/@cacheable/memory/node_modules/@keyv/bigmap": {
+      "version": "1.3.1",
+      "resolved": "https://registry.npmjs.org/@keyv/bigmap/-/bigmap-1.3.1.tgz",
+      "integrity": "sha512-WbzE9sdmQtKy8vrNPa9BRnwZh5UF4s1KTmSK0KUVLo3eff5BlQNNWDnFOouNpKfPKDnms9xynJjsMYjMaT/aFQ==",
+      "license": "MIT",
+      "dependencies": {
+        "hashery": "^1.4.0",
+        "hookified": "^1.15.0"
+      },
+      "engines": {
+        "node": ">= 18"
+      },
+      "peerDependencies": {
+        "keyv": "^5.6.0"
+      }
+    },
+    "node_modules/@cacheable/memory/node_modules/keyv": {
+      "version": "5.6.0",
+      "resolved": "https://registry.npmjs.org/keyv/-/keyv-5.6.0.tgz",
+      "integrity": "sha512-CYDD3SOtsHtyXeEORYRx2qBtpDJFjRTGXUtmNEMGyzYOKj1TE3tycdlho7kA1Ufx9OYWZzg52QFBGALTirzDSw==",
+      "license": "MIT",
+      "dependencies": {
+        "@keyv/serialize": "^1.1.1"
+      }
+    },
+    "node_modules/@cacheable/utils": {
+      "version": "2.5.0",
+      "resolved": "https://registry.npmjs.org/@cacheable/utils/-/utils-2.5.0.tgz",
+      "integrity": "sha512-buipgOVDkkPXNR5+xBpDw7Zk2n1EvU7qBJCNUcL7rhQ//kfpOXPAvQ511Os0vpLYJ1pZnvudNytkQt2hst3wqA==",
+      "license": "MIT",
+      "dependencies": {
+        "hashery": "^1.5.1",
+        "keyv": "^5.6.0"
+      }
+    },
+    "node_modules/@cacheable/utils/node_modules/keyv": {
+      "version": "5.6.0",
+      "resolved": "https://registry.npmjs.org/keyv/-/keyv-5.6.0.tgz",
+      "integrity": "sha512-CYDD3SOtsHtyXeEORYRx2qBtpDJFjRTGXUtmNEMGyzYOKj1TE3tycdlho7kA1Ufx9OYWZzg52QFBGALTirzDSw==",
+      "license": "MIT",
+      "dependencies": {
+        "@keyv/serialize": "^1.1.1"
+      }
+    },
     "node_modules/@chevrotain/types": {
       "version": "11.1.2",
       "resolved": "https://registry.npmjs.org/@chevrotain/types/-/types-11.1.2.tgz",
@@ -4409,9 +4465,9 @@
       }
     },
     "node_modules/@eslint/plugin-kit": {
-      "version": "0.7.2",
-      "resolved": "https://registry.npmjs.org/@eslint/plugin-kit/-/plugin-kit-0.7.2.tgz",
-      "integrity": "sha512-+CNAzxglkrpNf/kKywqQfk74QjtceuOE7Qm+AF8miRvPF/wmmK5+OJOgVh3AVTT3RP2mH3+FOaxlE5v72owk0A==",
+      "version": "0.7.3",
+      "resolved": "https://registry.npmjs.org/@eslint/plugin-kit/-/plugin-kit-0.7.3.tgz",
+      "integrity": "sha512-IkO+/KEUvwbVpiURZg+P7zF74z5Jxe0UgJxVni+RtoHQ6IZieXaO02kmadomap/q+l6bc/jdPGGqTjhuZnuz1Q==",
       "license": "Apache-2.0",
       "dependencies": {
         "@eslint/core": "^1.2.1",
@@ -4779,6 +4835,12 @@
         "tslib": "2"
       }
     },
+    "node_modules/@keyv/serialize": {
+      "version": "1.1.1",
+      "resolved": "https://registry.npmjs.org/@keyv/serialize/-/serialize-1.1.1.tgz",
+      "integrity": "sha512-dXn3FZhPv0US+7dtJsIi2R+c7qWYiReoEh5zUntWCf4oSpMNib8FDhSoed6m3QyZdx5hK7iLFkYk3rNxwt8vTA==",
+      "license": "MIT"
+    },
     "node_modules/@leichtgewicht/ip-codec": {
       "version": "2.0.5",
       "resolved": "https://registry.npmjs.org/@leichtgewicht/ip-codec/-/ip-codec-2.0.5.tgz",
@@ -6862,9 +6924,9 @@
       "license": "MIT"
     },
     "node_modules/baseline-browser-mapping": {
-      "version": "2.11.9",
-      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.9.tgz",
-      "integrity": "sha512-cp447VUsGS07+n1Dqf7YSQ8maeJrjEhaDxTm1ZefbqDtypHBC5GzGMQbklR6IPR13Y8OAJRHZWEMtZipJLCttg==",
+      "version": "2.11.25",
+      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.25.tgz",
+      "integrity": "sha512-gMmEShwwq7FJqMwvfRwvCl00v4kN+KOfJqXn+f4nrufak5g
```

**File**: `docs/package.json` (modified, +3/-3)
```diff
@@ -19,22 +19,22 @@
     "@floating-ui/react": "^0.27.20",
     "@iconify/react": "^6.0.2",
     "@mermaid-js/layout-elk": "^0.1.9",
-    "eslint": "^10.8.0",
+    "eslint": "^10.11.0",
     "glob": "^13.0.6",
     "js-yaml": "^5.4.2",
     "markdownlint-cli2": "^0.23.3",
     "md-front-matter": "^1.0.4",
     "raw-loader": "^4.0.2",
     "react-markdown": "^10.1.0",
-    "recharts": "3.10.0",
+    "recharts": "3.10.1",
     "turndown": "^7.2.4",
     "turndown-plugin-gfm": "^1.0.2"
   },
   "engines": {
     "node": ">=24.0.0"
   },
   "devDependencies": {
-    "baseline-browser-mapping": "^2.10.38",
+    "baseline-browser-mapping": "^2.11.25",
     "pagefind": "^1.5.2"
   }
 }
```

---

### Incident Patch 7: `5506ce4f` (2026-10-01)
**Commit Message**: build(deps): bump dompurify from 3.4.13 to 3.4.16 in /docs

Bumps [dompurify](https://github.com/cure53/DOMPurify) from 3.4.13 to 3.4.16.
- [Release notes](https://github.com/cure53/DOMPurify/releases)
- [Commits](https://github.com/cure53/DOMPurify/compare/3.4.13...3.4.16)

---
updated-dependencies:
- dependency-name: dompurify
  dependency-version: 3.4.16
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `docs/package-lock.json` (modified, +3/-3)
```diff
@@ -9229,9 +9229,9 @@
       }
     },
     "node_modules/dompurify": {
-      "version": "3.4.13",
-      "resolved": "https://registry.npmjs.org/dompurify/-/dompurify-3.4.13.tgz",
-      "integrity": "sha512-2vmYIoqjze2d+kakP8S/nS5shfsl587kzwEjcGlTdiksUVgFHnFCsLYDVj/JNqJVOQZGSYBTmuycv0PodwmnMQ==",
+      "version": "3.4.16",
+      "resolved": "https://registry.npmjs.org/dompurify/-/dompurify-3.4.16.tgz",
+      "integrity": "sha512-sqo+pNp3qRhCIpbgRi1y8Tgk27Bo2Ry7w0dC1NBeNTdZChWjz9Xb/KOoZbRP/R6pQZ80Qw8YhXw13hWWBbMRnQ==",
       "license": "(MPL-2.0 OR Apache-2.0)",
       "optionalDependencies": {
         "@types/trusted-types": "^2.0.7"
```

---

### Incident Patch 8: `753cf541` (2026-09-28)
**Commit Message**: docs: Update builtin availability in other interpreters

Refreshed from the capabilities published by each implementation.

**File**: `builtin_metadata.json` (modified, +1/-1)
```diff
@@ -265,7 +265,7 @@
       "id": "java",
       "label": "Java",
       "repo": "open-policy-agent/java-opa-sdk",
-      "version": "0.4.0"
+      "version": "0.5.0"
     }
   ],
   "abs": {
```

**File**: `internal/cmd/genbuiltinmetadata/implementations.json` (modified, +1/-1)
```diff
@@ -148,7 +148,7 @@
       "id": "java",
       "label": "Java",
       "repo": "open-policy-agent/java-opa-sdk",
-      "version": "0.4.0",
+      "version": "0.5.0",
       "builtins": {
         "abs": "0.1.0",
         "and": "0.1.0",
```

---

### Incident Patch 9: `a31eb820` (2026-09-30)
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

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

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

### Incident Patch 10: `fc99dd76` (2026-09-30)
**Commit Message**: build(deps): bump fast-uri from 3.1.7 to 3.1.8 in /docs

Bumps [fast-uri](https://github.com/fastify/fast-uri) from 3.1.7 to 3.1.8.
- [Release notes](https://github.com/fastify/fast-uri/releases)
- [Commits](https://github.com/fastify/fast-uri/compare/v3.1.7...v3.1.8)

---
updated-dependencies:
- dependency-name: fast-uri
  dependency-version: 3.1.8
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `docs/package-lock.json` (modified, +3/-3)
```diff
@@ -10174,9 +10174,9 @@
       "license": "MIT"
     },
     "node_modules/fast-uri": {
-      "version": "3.1.7",
-      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.7.tgz",
-      "integrity": "sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==",
+      "version": "3.1.8",
+      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.8.tgz",
+      "integrity": "sha512-GZMtZUTNRpOVIECoXwLNZS5xUGE+mVNbTB8h/7Rwh2TFWcBQiPzTgyZi05BF9UMZKkLJv8XBRJTlU7zg8+ZfMg==",
       "funding": [
         {
           "type": "github",
```

---

### Incident Patch 11: `f9bfcf35` (2026-09-29)
**Commit Message**: build(deps): bump js-yaml and markdownlint-cli2 in /docs (#9286)

Bumps [js-yaml](https://github.com/nodeca/js-yaml) to 4.3.2 and updates
ancestor dependencies [js-yaml](https://github.com/nodeca/js-yaml) and
[markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2).
These dependencies need to be updated together.

Updates `js-yaml` from 4.3.1 to 4.3.2
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a
href="https://github.com/nodeca/js-yaml/blob/4.3.2/CHANGELOG.md">js-yaml's
changelog</a>.</em></p>
<blockquote>
<h2>4.3.2 - 2026-08-26</h2>
<h3>Changed</h3>
<ul>
<li>[backport] Hard-limit merge sequence size to 100.</li>
</ul>
<h3>Security</h3>
<ul>
<li>[backport] Count empty mappings in merge sequences toward
<code>maxTotalMergeKeys</code>
to limit CPU usage, <a
href="https://redirect.github.com/nodeca/js-yaml/issues/797">#797</a>.</li>
</ul>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https://github.com/nodeca/js-yaml/commit/79ca68d90f333fbe6d9e42827527e62636200191"><code>79ca68d</code></a>
4.3.2 released</li>
<li><a
href="https://github.com/nodeca/js-yaml/commit/d90b6612a5a84385bdcb556c44578eac76dc0f6b"><code>d90b661</code>

**File**: `docs/package-lock.json` (modified, +92/-63)
```diff
@@ -20,8 +20,8 @@
         "@mermaid-js/layout-elk": "^0.1.9",
         "eslint": "^10.8.0",
         "glob": "^13.0.6",
-        "js-yaml": "^5.2.2",
-        "markdownlint-cli2": "^0.23.1",
+        "js-yaml": "^5.4.2",
+        "markdownlint-cli2": "^0.23.3",
         "md-front-matter": "^1.0.4",
         "raw-loader": "^4.0.2",
         "react-markdown": "^10.1.0",
@@ -53,9 +53,9 @@
       }
     },
     "node_modules/@11ty/gray-matter/node_modules/js-yaml": {
-      "version": "4.3.1",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.1.tgz",
-      "integrity": "sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==",
+      "version": "4.3.2",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.2.tgz",
+      "integrity": "sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==",
       "funding": [
         {
           "type": "github",
@@ -3765,9 +3765,9 @@
       }
     },
     "node_modules/@docusaurus/plugin-content-docs/node_modules/js-yaml": {
-      "version": "4.3.0",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.0.tgz",
-      "integrity": "sha512-1td788aAnnZ5qs7V2QIRl1owjtYpbKt749Y3xauqQgwIIGF/xXWz1wMTEBx5O3LK3lXLVuqXPdPxj2BoFHaW9Q==",
+      "version": "4.3.2",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.2.tgz",
+      "integrity": "sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==",
       "funding": [
         {
           "type": "github",
@@ -4223,9 +4223,9 @@
       }
     },
     "node_modules/@docusaurus/utils-validation/node_modules/js-yaml": {
-      "version": "4.3.1",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.1.tgz",
-      "integrity": "sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==",
+      "version": "4.3.2",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.2.tgz",
+      "integrity": "sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==",
       "funding": [
         {
           "type": "github",
@@ -4245,9 +4245,9 @@
       }
     },
     "node_modules/@docusaurus/utils/node_modules/js-yaml": {
-      "version": "4.3.1",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.1.tgz",
-      "integrity": "sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==",
+      "version": "4.3.2",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.2.tgz",
+      "integrity": "sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==",
       "funding": [
         {
           "type": "github",
@@ -7903,9 +7903,9 @@
       }
     },
     "node_modules/cosmiconfig/node_modules/js-yaml": {
-      "version": "4.3.0",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.0.tgz",
-      "integrity": "sha512-1td788aAnnZ5qs7V2QIRl1owjtYpbKt749Y3xauqQgwIIGF/xXWz1wMTEBx5O3LK3lXLVuqXPdPxj2BoFHaW9Q==",
+      "version": "4.3.2",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.2.tgz",
+      "integrity": "sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==",
       "funding": [
         {
           "type": "github",
@@ -11960,9 +11960,9 @@
       "license": "MIT"
     },
     "node_modules/js-yaml": {
-      "version": "5.2.2",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-5.2.2.tgz",
-      "integrity": "sha512-dayzUzKkJ1MkuUtZglSebU43utNXH0OWQByK9rKOOuYIO8M5TV1y+n8ALMdG0rdzBnfNkOmZEqrURepb0ejqBw==",
+      "version": "5.4.2",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-5.4.2.tgz",
+      "integrity": "sha512-m+aqu+LwO1O6sIopafj8HUVl5aawITwZQe/yHpMCKjaWBaA/d07B/QdMb3529REftiU+RMMHL3Vlsw3hON7vWg==",
       "funding": [
         {
           "type": "github",
@@ -12185,9 +12185,9 @@
       "license": "MIT"
     },
     "node_modules/linkify-it": {
-      "version": "5.0.2",
-      "resolved": "https://registry.npmjs.org/linkify-it/-/linkify-it-5.0.2.tgz",
-      "integrity": "sha512-ONTm2jCMAVZjgQa/Fy1kScXsuOoF5NPTsoFBdE1KVIZ2vAh/r9+Bqo+0jINCBYnavTPQZz38QzFTme79ENoN3Q==",
+      "version": "6.1.0",
+      "resolved": "https://registry.npmjs.org/linkify-it/-/linkify-it-6.1.0.tgz",
+      "integrity": "sha512-wJ/TwpSDTLepCrQoYWYIExIKg5Zchex2Nn5yk2mFnB+6PtdkHtyLx742md9csRjjOnGkKIS/RrbY7l8D6gT9Vw==",
       "funding": [
         {
           "type": "github",
@@ -12200,7 +12200,7 @@
       ],
       "license": "MIT",
       "dependencies": {
-        "uc.micro": "^2.0.0"
+        "uc.micro": "^3.0.0"
       }
     },
     "node_modules/loader-runner": {
@@ -12336,9 +12336,9 @@
       }
     },
     "node_modules/markdown-it": {
-      "version": "14.3.0",
-      "resolved": "https://registry.npmjs.org/markdown-it/-/markdown-it-14
```

**File**: `docs/package.json` (modified, +2/-2)
```diff
@@ -21,8 +21,8 @@
     "@mermaid-js/layout-elk": "^0.1.9",
     "eslint": "^10.8.0",
     "glob": "^13.0.6",
-    "js-yaml": "^5.2.2",
-    "markdownlint-cli2": "^0.23.1",
+    "js-yaml": "^5.4.2",
+    "markdownlint-cli2": "^0.23.3",
     "md-front-matter": "^1.0.4",
     "raw-loader": "^4.0.2",
     "react-markdown": "^10.1.0",
```

---

### Incident Patch 12: `ed92b1d8` (2026-09-29)
**Commit Message**: build(deps): bump http-proxy-middleware from 2.0.9 to 2.0.10 in /docs

Bumps [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware) from 2.0.9 to 2.0.10.
- [Release notes](https://github.com/chimurai/http-proxy-middleware/releases)
- [Changelog](https://github.com/chimurai/http-proxy-middleware/blob/v2.0.10/CHANGELOG.md)
- [Commits](https://github.com/chimurai/http-proxy-middleware/compare/v2.0.9...v2.0.10)

---
updated-dependencies:
- dependency-name: http-proxy-middleware
  dependency-version: 2.0.10
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `docs/package-lock.json` (modified, +3/-3)
```diff
@@ -11330,9 +11330,9 @@
       }
     },
     "node_modules/http-proxy-middleware": {
-      "version": "2.0.9",
-      "resolved": "https://registry.npmjs.org/http-proxy-middleware/-/http-proxy-middleware-2.0.9.tgz",
-      "integrity": "sha512-c1IyJYLYppU574+YI7R4QyX2ystMtVXZwIdzazUIPIJsHuWNd+mho2j+bKoHftndicGj9yh+xjd+l0yj7VeT1Q==",
+      "version": "2.0.10",
+      "resolved": "https://registry.npmjs.org/http-proxy-middleware/-/http-proxy-middleware-2.0.10.tgz",
+      "integrity": "sha512-RKzRWNPxUZqbuk3BC5mGVJbBnWgr+diEnjJexIOytFbBzDy88Fbh/YvBr3DsNrl1jYAfjWfpATEv0NO35FDuPQ==",
       "license": "MIT",
       "dependencies": {
         "@types/http-proxy": "^1.17.8",
```

---

### Incident Patch 13: `54b35c05` (2026-09-25)
**Commit Message**: ci: rebuild benchmark site even when benchmarks are skipped

The notebook job was gated on Go changes like the benchmarks job, but the
site also renders benchlab.json (updated nightly) and anchors to the latest
tag, neither of which needs a Go change. After v1.21.0 the site went empty
and stayed that way: the first v1.21.0-anchored nightly results landed, but
no Go commit followed to trigger a rebuild.

Run the notebook job whenever benchmarks didn't fail. An unchanged rebuild
commits nothing.

Signed-off-by: Stephan Renatus <[REDACTED_EMAIL]>

**File**: `.github/workflows/benchmarks-publish.yaml` (modified, +4/-3)
```diff
@@ -28,8 +28,8 @@ permissions:
   contents: read
 
 jobs:
-  # Skip the run entirely if main saw no Go changes in the lookback window,
-  # so quiet periods don't burn two hours of runner time for a flat datapoint.
+  # Skip benchmarking if main saw no Go changes in the lookback window, so
+  # quiet periods don't burn two hours of runner time for a flat datapoint.
   check-changes:
     name: Check what files changed
     runs-on: ubuntu-24.04
@@ -118,7 +118,8 @@ jobs:
     name: update notebook
     runs-on: ubuntu-24.04
     needs: [check-changes, benchmarks] # force sequential commits for notebook and benchmark results
-    if: ${{ needs.check-changes.outputs.go == 'true' }}
+    # Rebuild even without Go changes: benchlab.json and tags change too.
+    if: ${{ !cancelled() }}
     steps:
       - uses: open-policy-agent/setup-opa@b2b258e089860efaadaaf71bf6e3aecb4a3eeff1 # v2.4.0
       - name: Check out code
```

---

### Incident Patch 14: `431f4043` (2026-09-24)
**Commit Message**: build(deps): bump image-size from 2.0.2 to 2.0.4 in /docs (#9262)

Bumps [image-size](https://github.com/image-size/image-size) from 2.0.2
to 2.0.4.
<details>
<summary>Commits</summary>
<ul>
<li>See full diff in <a
href="https://github.com/image-size/image-size/commits">compare
view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility
score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=image-size&package-manager=npm_and_yarn&previous-version=2.0.2&new-version=2.0.4)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

Dependabot will resolve any conflicts with this PR as long as you don't
alter it yourself. You can also trigger a rebase manually by commenting
`@dependabot rebase`.

[//]: # (dependabot-automerge-start)
[//]: # (dependabot-automerge-end)

---

<details>
<summary>Dependabot commands and options</summary>
<br />

You can trigger Dependabot actions by commenting on this PR:
- `@dependabot rebase` will rebase this PR
- `@dependabot recreate` will recreate this PR, overwriting any edits
that have been made to it
- `@dependabot show <dependency nam

**File**: `docs/package-lock.json` (modified, +4/-4)
```diff
@@ -11430,15 +11430,15 @@
       }
     },
     "node_modules/image-size": {
-      "version": "2.0.2",
-      "resolved": "https://registry.npmjs.org/image-size/-/image-size-2.0.2.tgz",
-      "integrity": "sha512-IRqXKlaXwgSMAMtpNzZa1ZAe8m+Sa1770Dhk8VkSsP9LS+iHD62Zd8FQKs8fbPiagBE7BzoFX23cxFnwshpV6w==",
+      "version": "2.0.4",
+      "resolved": "https://registry.npmjs.org/image-size/-/image-size-2.0.4.tgz",
+      "integrity": "sha512-QRUkFFsRV/6fuESxb9Vkq+a0LkSrgKXuc2NEqfikiXxxN/G3tjWt5EVUlMaImRBZRZK/jRBEbYvpPYZL8t08Zw==",
       "license": "MIT",
       "bin": {
         "image-size": "bin/image-size.js"
       },
       "engines": {
-        "node": ">=16.x"
+        "node": ">=18"
       }
     },
     "node_modules/immer": {
```

---

### Incident Patch 15: `b7a4a421` (2026-09-24)
**Commit Message**: build(deps): bump the dependencies group across 2 directories with 11 updates

Bumps the dependencies group with 9 updates in the / directory:

| Package | From | To |
| --- | --- | --- |
| [github.com/klauspost/compress](https://github.com/klauspost/compress) | `1.19.1` | `1.20.0` |
| [github.com/lestrrat-go/jwx/v3](https://github.com/lestrrat-go/jwx) | `3.2.0` | `3.3.0` |
| [github.com/olekukonko/tablewriter](https://github.com/olekukonko/tablewriter) | `1.1.4` | `1.1.5` |
| [github.com/prometheus/client_model](https://github.com/prometheus/client_model) | `0.6.2` | `0.6.3` |
| [github.com/vektah/gqlparser/v2](https://github.com/vektah/gqlparser) | `2.5.36` | `2.5.37` |
| [golang.org/x/sync](https://github.com/golang/sync) | `0.22.0` | `0.23.0` |
| [golang.org/x/term](https://github.com/golang/term) | `0.45.0` | `0.46.0` |
| [golang.org/x/text](https://github.com/golang/text) | `0.41.0` | `0.42.0` |
| [golang.org/x/time](https://github.com/golang/time) | `0.15.0` | `0.16.0` |

Bumps the dependencies group with 2 updates in the /e2e directory: [github.com/go-sql-driver/mysql](https://github.com/go-sql-driver/mysql) and [modernc.org/sqlite](https://gitlab.com/cznic/sqlite).


Updat

**File**: `build/tools/go.mod` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 module github.com/open-policy-agent/opa/build/tools
 
-go 1.25.7
+go 1.26.0
 
 tool (
 	github.com/josephspurrier/goversioninfo/cmd/goversioninfo
@@ -25,7 +25,7 @@ require (
 	github.com/vbauerster/mpb/v8 v8.12.1 // indirect
 	golang.org/x/mod v0.35.0 // indirect
 	golang.org/x/perf v0.0.0-20260512194132-3cf34090a3db // indirect
-	golang.org/x/sync v0.22.0 // indirect
+	golang.org/x/sync v0.23.0 // indirect
 	golang.org/x/sys v0.44.0 // indirect
 	golang.org/x/telemetry v0.0.0-20260421165255-392afab6f40e // indirect
 	golang.org/x/tools v0.44.0 // indirect
```

**File**: `build/tools/go.sum` (modified, +2/-2)
```diff
@@ -36,8 +36,8 @@ golang.org/x/mod v0.35.0 h1:Ww1D637e6Pg+Zb2KrWfHQUnH2dQRLBQyAtpr/haaJeM=
 golang.org/x/mod v0.35.0/go.mod h1:+GwiRhIInF8wPm+4AoT6L0FA1QWAad3OMdTRx4tFYlU=
 golang.org/x/perf v0.0.0-20260512194132-3cf34090a3db h1:1EdY5INjhh724sLDk1O/nIzRZ8wmHbmiF8K2cK/mNLw=
 golang.org/x/perf v0.0.0-20260512194132-3cf34090a3db/go.mod h1:vtQ1uZI2nWugeUDAr4i3qjU4fqZ0yZYuruCC4FKahWE=
-golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
-golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.23.0 h1:KameEIfc1IkluZyXWLn39Wd4tURc6GbCiISGiZm2bQk=
+golang.org/x/sync v0.23.0/go.mod h1:sUUOizhqBxiL6pEWpqNLUiaJn1ShEbZ6BBqskPbjZm0=
 golang.org/x/sys v0.44.0 h1:ildZl3J4uzeKP07r2F++Op7E9B29JRUy+a27EibtBTQ=
 golang.org/x/sys v0.44.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
 golang.org/x/telemetry v0.0.0-20260421165255-392afab6f40e h1:OXgN37M6hqjaAvb7CJK9vJ+7Z/6lvIm5bXho5poo/Wk=
```

**File**: `e2e/go.mod` (modified, +16/-18)
```diff
@@ -7,15 +7,15 @@ replace github.com/open-policy-agent/opa => ../
 
 require (
 	github.com/bufbuild/protocompile v0.14.1
-	github.com/go-sql-driver/mysql v1.10.0
+	github.com/go-sql-driver/mysql v1.10.1
 	github.com/google/go-cmp v0.7.0
 	github.com/lib/pq v1.12.3
 	github.com/microsoft/go-mssqldb v1.11.0
 	github.com/open-policy-agent/opa v1.8.0
 	github.com/rogpeppe/go-internal v1.16.0
 	github.com/testcontainers/testcontainers-go v0.44.0
 	google.golang.org/protobuf v1.36.12
-	modernc.org/sqlite v1.57.0
+	modernc.org/sqlite v1.59.0
 )
 
 require (
@@ -61,13 +61,13 @@ require (
 	github.com/huandu/go-clone v1.7.3 // indirect
 	github.com/huandu/go-sqlbuilder v1.43.0 // indirect
 	github.com/huandu/xstrings v1.4.0 // indirect
-	github.com/klauspost/compress v1.19.1 // indirect
+	github.com/klauspost/compress v1.20.0 // indirect
 	github.com/lestrrat-go/blackmagic v1.0.4 // indirect
-	github.com/lestrrat-go/dsig v1.3.0 // indirect
+	github.com/lestrrat-go/dsig v1.4.0 // indirect
 	github.com/lestrrat-go/dsig-secp256k1 v1.0.0 // indirect
 	github.com/lestrrat-go/httpcc v1.0.1 // indirect
 	github.com/lestrrat-go/httprc/v3 v3.0.6 // indirect
-	github.com/lestrrat-go/jwx/v3 v3.2.0 // indirect
+	github.com/lestrrat-go/jwx/v3 v3.3.0 // indirect
 	github.com/lestrrat-go/option/v2 v2.0.0 // indirect
 	github.com/lufia/plan9stats v0.0.0-20260330125221-c963978e514e // indirect
 	github.com/magiconair/properties v1.8.10 // indirect
@@ -88,12 +88,12 @@ require (
 	github.com/olekukonko/cat v0.0.0-20250911104152-50322a0618f6 // indirect
 	github.com/olekukonko/errors v1.2.0 // indirect
 	github.com/olekukonko/ll v0.1.6 // indirect
-	github.com/olekukonko/tablewriter v1.1.4 // indirect
+	github.com/olekukonko/tablewriter v1.1.5 // indirect
 	github.com/opencontainers/go-digest v1.0.0 // indirect
 	github.com/opencontainers/image-spec v1.1.1 // indirect
 	github.com/power-devops/perfstat v0.0.0-20240221224432-82ca36839d55 // indirect
 	github.com/prometheus/client_golang v1.24.1 // indirect
-	github.com/prometheus/client_model v0.6.2 // indirect
+	github.com/prometheus/client_model v0.6.3 // indirect
 	github.com/prometheus/common v0.70.1 // indirect
 	github.com/prometheus/procfs v0.21.1 // indirect
 	github.com/rcrowley/go-metrics v0.0.0-20250401214520-65e299d6c5c9 // indirect
@@ -110,7 +110,7 @@ require (
 	github.com/tklauser/go-sysconf v0.4.0 // indirect
 	github.com/tklauser/numcpus v0.12.0 // indirect
 	github.com/valyala/fastjson v1.6.10 // indirect
-	github.com/vektah/gqlparser/v2 v2.5.36 // indirect
+	github.com/vektah/gqlparser/v2 v2.5.37 // indirect
 	github.com/xeipuuv/gojsonpointer v0.0.0-20190905194746-02993c407bfb // indirect
 	github.com/xeipuuv/gojsonreference v0.0.0-20180127040603-bd5ef7bd5415 // indirect
 	github.com/yashtewari/glob-intersection v0.2.0 // indirect
@@ -129,24 +129,22 @@ require (
 	go.opentelemetry.io/otel/sdk/metric v1.46.0 // indirect
 	go.opentelemetry.io/otel/trace v1.46.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
-	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
 	golang.org/x/crypto v0.55.0 // indirect
 	golang.org/x/net v0.58.0 // indirect
-	golang.org/x/sync v0.22.0 // indirect
-	golang.org/x/sys v0.47.0 // indirect
-	golang.org/x/term v0.45.0 // indirect
-	golang.org/x/text v0.41.0 // indirect
-	golang.org/x/time v0.15.0 // indirect
-	golang.org/x/tools v0.48.0 // indirect
+	golang.org/x/sync v0.23.0 // indirect
+	golang.org/x/sys v0.48.0 // indirect
+	golang.org/x/term v0.46.0 // indirect
+	golang.org/x/text v0.42.0 // indirect
+	golang.org/x/time v0.16.0 // indirect
+	golang.org/x/tools v0.49.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260819154853-08b0e4226688 // indirect
 	google.golang.org/grpc v1.83.2 // indirect
 	gopkg.in/ini.v1 v1.67.3 // indirect
 	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
-	modernc.org/libc v1.74.4 // indirect
+	modernc.org/libc v1.75.7 // indirect
 	modernc.org/mathutil v1.7.1 // indirect
-	modernc.org/memory v1.11.0 // indirect
+	modernc.org/memory v1.12.1 // indirect
 	oras.land/oras-go/v2 v2.6.2 // indirect
-	sigs.k8s.io/yaml v1.6.0 // indirect
 )
```

**File**: `e2e/go.sum` (modified, +40/-42)
```diff
@@ -92,8 +92,8 @@ github.com/go-logr/stdr v1.2.2/go.mod h1:mMo/vtBO5dYbehREoey6XUKy/eSumjCCveDpRre
 github.com/go-ole/go-ole v1.2.6/go.mod h1:pprOEPIfldk/42T2oK7lQ4v4JSDwmV0As9GaiUsvbm0=
 github.com/go-ole/go-ole v1.3.0 h1:Dt6ye7+vXGIKZ7Xtk4s6/xVdGDQynvom7xCFEdWr6uE=
 github.com/go-ole/go-ole v1.3.0/go.mod h1:5LS6F96DhAwUc7C+1HLexzMXY1xGRSryjyPPKW6zv78=
-github.com/go-sql-driver/mysql v1.10.0 h1:Q+1LV8DkHJvSYAdR83XzuhDaTykuDx0l6fkXxoWCWfw=
-github.com/go-sql-driver/mysql v1.10.0/go.mod h1:M+cqaI7+xxXGG9swrdeUIoPG3Y3KCkF0pZej+SK+nWk=
+github.com/go-sql-driver/mysql v1.10.1 h1:arlSnNLq6a5yxGxV7qg9lF4j0C+KwD6NbQyKr9QL6ME=
+github.com/go-sql-driver/mysql v1.10.1/go.mod h1:M+cqaI7+xxXGG9swrdeUIoPG3Y3KCkF0pZej+SK+nWk=
 github.com/gobwas/glob v1.0.0 h1:p+FKbLEIsK1yZ39/OINwFvqNb5oyPY4H8xcy6uYu8dg=
 github.com/gobwas/glob v1.0.0/go.mod h1:oWCdo522i2P1n/hMXGNWs7yoV4wy/ciZuUIbvKj5rkc=
 github.com/goccy/go-json v0.10.6 h1:p8HrPJzOakx/mn/bQtjgNjdTcN+/S6FcG2CTtQOrHVU=
@@ -129,8 +129,8 @@ github.com/huandu/go-sqlbuilder v1.43.0 h1:PdY4cnRR5Ed0wOmDFY4SLr1dQ/1iZicADMnfH
 github.com/huandu/go-sqlbuilder v1.43.0/go.mod h1:BEm32AHl29lzKDeV3HAIkzrz9cgRyumkDohHeGYYBoM=
 github.com/huandu/xstrings v1.4.0 h1:D17IlohoQq4UcpqD7fDk80P7l+lwAmlFaBHgOipl2FU=
 github.com/huandu/xstrings v1.4.0/go.mod h1:y5/lhBue+AyNmUVz9RLU9xbLR0o4KIIExikq4ovT0aE=
-github.com/klauspost/compress v1.19.1 h1:VsB4HPswih7mmZ8WleSFQ75c/Ui1M4trX5oAsJnhSlk=
-github.com/klauspost/compress v1.19.1/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
+github.com/klauspost/compress v1.20.0 h1:a3C1ke2ohxFymNlb2HWAHjDeKCI90scRskErZkR0ezA=
+github.com/klauspost/compress v1.20.0/go.mod h1:LUdAzn7YLVvxLpc7y3V1m40wESHTgc1422pwwBSKYuI=
 github.com/kr/pretty v0.3.1 h1:flRD4NNwYAUpkphVc1HcthR4KEIFJ65n8Mw5qdRn3LE=
 github.com/kr/pretty v0.3.1/go.mod h1:hoEshYVHaxMs3cyo3Yncou5ZscifuDolrwPKZanG3xk=
 github.com/kr/text v0.2.0 h1:5Nx0Ya0ZqY2ygV366QzturHI13Jq95ApcVaJBhpS+AY=
@@ -139,16 +139,16 @@ github.com/kylelemons/godebug v1.1.0 h1:RPNrshWIDI6G2gRW9EHilWtl7Z6Sb1BR0xunSBf0
 github.com/kylelemons/godebug v1.1.0/go.mod h1:9/0rRGxNHcop5bhtWyNeEfOS8JIWk580+fNqagV/RAw=
 github.com/lestrrat-go/blackmagic v1.0.4 h1:IwQibdnf8l2KoO+qC3uT4OaTWsW7tuRQXy9TRN9QanA=
 github.com/lestrrat-go/blackmagic v1.0.4/go.mod h1:6AWFyKNNj0zEXQYfTMPfZrAXUWUfTIZ5ECEUEJaijtw=
-github.com/lestrrat-go/dsig v1.3.0 h1:phjMOCXvYzhuIgn7Voe2rex8z166vGfxRxmqM25P9/Q=
-github.com/lestrrat-go/dsig v1.3.0/go.mod h1:RD2eOaidyPvpc7IJQoO3Qq52RWdy8ZcJs8lrOnoa1Kc=
+github.com/lestrrat-go/dsig v1.4.0 h1:g7LUjK8cT74A5DzBXJI5HzsJuLhoYN0Wzj4nuOMIrH8=
+github.com/lestrrat-go/dsig v1.4.0/go.mod h1:I8Nddg/vN2cUl/h8N7SRRApLnNNeyZPIqLYpvpOtGGo=
 github.com/lestrrat-go/dsig-secp256k1 v1.0.0 h1:JpDe4Aybfl0soBvoVwjqDbp+9S1Y2OM7gcrVVMFPOzY=
 github.com/lestrrat-go/dsig-secp256k1 v1.0.0/go.mod h1:CxUgAhssb8FToqbL8NjSPoGQlnO4w3LG1P0qPWQm/NU=
 github.com/lestrrat-go/httpcc v1.0.1 h1:ydWCStUeJLkpYyjLDHihupbn2tYmZ7m22BGkcvZZrIE=
 github.com/lestrrat-go/httpcc v1.0.1/go.mod h1:qiltp3Mt56+55GPVCbTdM9MlqhvzyuL6W/NMDA8vA5E=
 github.com/lestrrat-go/httprc/v3 v3.0.6 h1:4FpLQ18KK/ypPbVU3NLWJNRvH3kcYiqKqWfKGqNWxxI=
 github.com/lestrrat-go/httprc/v3 v3.0.6/go.mod h1:mSMtkZW92Z98M5YoNNztbRGxbXHql7tSitCvaxvo9l0=
-github.com/lestrrat-go/jwx/v3 v3.2.0 h1:Jb3zBASTSZXz7gzzSAfYqxXF8KejvKC4xWoePLQqXCA=
-github.com/lestrrat-go/jwx/v3 v3.2.0/go.mod h1:38vQ8iWKq3qRSbilbzvzdQPuywhowwuR03lhkYskyrw=
+github.com/lestrrat-go/jwx/v3 v3.3.0 h1:OXcYvQOQ7cxWzeZ/Q9sYk8ABe/kCSI371WmuACiCT+4=
+github.com/lestrrat-go/jwx/v3 v3.3.0/go.mod h1:eIJhDcKHBwcgxqv8RiIylV67TVl1wJp/265IAHY1Db8=
 github.com/lestrrat-go/option/v2 v2.0.0 h1:XxrcaJESE1fokHy3FpaQ/cXW8ZsIdWcdFzzLOcID3Ss=
 github.com/lestrrat-go/option/v2 v2.0.0/go.mod h1:oSySsmzMoR0iRzCDCaUfsCzxQHUEuhOViQObyy7S6Vg=
 github.com/lib/pq v1.12.3 h1:tTWxr2YLKwIvK90ZXEw8GP7UFHtcbTtty8zsI+YjrfQ=
@@ -195,8 +195,8 @@ github.com/olekukonko/errors v1.2.0 h1:10Zcn4GeV59t/EGqJc8fUjtFT/FuUh5bTMzZ1XwmC
 github.com/olekukonko/errors v1.2.0/go.mod h1:ppzxA5jBKcO1vIpCXQ9ZqgDh8iwODz6OXIGKU8r5m4Y=
 github.com/olekukonko/ll v0.1.6 h1:lGVTHO+Qc4Qm+fce/2h2m5y9LvqaW+DCN7xW9hsU3uA=
 github.com/olekukonko/ll v0.1.6/go.mod h1:NVUmjBb/aCtUpjKk75BhWrOlARz3dqsM+OtszpY4o88=
-github.com/olekukonko/tablewriter v1.1.4 h1:ORUMI3dXbMnRlRggJX3+q7OzQFDdvgbN9nVWj1drm6I=
-github.com/olekukonko/tablewriter v1.1.4/go.mod h1:+kedxuyTtgoZLwif3P1Em4hARJs+mVnzKxmsCL/C5RY=
+github.com/olekukonko/tablewriter v1.1.5 h1:4LoZSfMySpMQY3PT8RWJsJeuEuMIoo9xGRgvmqjg6IQ=
+github.com/olekukonko/tablewriter v1.1.5/go.mod h1:+kedxuyTtgoZLwif3P1Em4hARJs+mVnzKxmsCL/C5RY=
 github.com/opencontainers/go-digest v1.0.0 h1:apOUWs51W5PlhuyGyz9FCeeBIOUDA/6nW8Oi/yOhh5U=
 github.com/opencontainers/go-digest v1.0.0/go.mod h1:0JzlMkj0TRzQZfJkVvzbP0HBR3IKzErnv2BNG4W4MAM=
 github.com/opencontainers/image-spec v1.1.1 h1:y0fUlFfIZhPF1W537XOLg0/fcx6zcHCJwooC2xJA040=
@@ -208,8 +208,8 @@ github.com/power-devops/perfstat v0.0.0-20240221224432-82ca36839d55 h1:o4JXh1EVt
 github.com/power-devops/perfsta
```

**File**: `go.mod` (modified, +13/-13)
```diff
@@ -15,13 +15,13 @@ require (
 	github.com/google/uuid v1.6.0
 	github.com/hashicorp/golang-lru/v2 v2.0.7
 	github.com/huandu/go-sqlbuilder v1.43.0
-	github.com/klauspost/compress v1.19.1
-	github.com/lestrrat-go/jwx/v3 v3.2.0
-	github.com/olekukonko/tablewriter v1.1.4
+	github.com/klauspost/compress v1.20.0
+	github.com/lestrrat-go/jwx/v3 v3.3.0
+	github.com/olekukonko/tablewriter v1.1.5
 	github.com/opencontainers/go-digest v1.0.0
 	github.com/opencontainers/image-spec v1.1.1
 	github.com/prometheus/client_golang v1.24.1
-	github.com/prometheus/client_model v0.6.2
+	github.com/prometheus/client_model v0.6.3
 	github.com/rcrowley/go-metrics v0.0.0-20250401214520-65e299d6c5c9
 	github.com/reeflective/readline v1.3.0
 	github.com/santhosh-tekuri/jsonschema/v6 v6.0.3
@@ -32,7 +32,7 @@ require (
 	github.com/spf13/viper v1.21.0
 	github.com/tchap/go-patricia/v2 v2.3.3
 	github.com/tetratelabs/wazero v1.12.0
-	github.com/vektah/gqlparser/v2 v2.5.36
+	github.com/vektah/gqlparser/v2 v2.5.37
 	github.com/xeipuuv/gojsonreference v0.0.0-20180127040603-bd5ef7bd5415
 	github.com/yashtewari/glob-intersection v0.2.0
 	go.opentelemetry.io/contrib/bridges/prometheus v0.71.0
@@ -48,10 +48,10 @@ require (
 	go.opentelemetry.io/otel/trace v1.46.0
 	go.opentelemetry.io/proto/otlp v1.11.0
 	go.yaml.in/yaml/v3 v3.0.5
-	golang.org/x/sync v0.22.0
-	golang.org/x/term v0.45.0
-	golang.org/x/text v0.41.0
-	golang.org/x/time v0.15.0
+	golang.org/x/sync v0.23.0
+	golang.org/x/term v0.46.0
+	golang.org/x/text v0.42.0
+	golang.org/x/time v0.16.0
 	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c
@@ -83,7 +83,7 @@ require (
 	github.com/kr/text v0.2.0 // indirect
 	github.com/kylelemons/godebug v1.1.0 // indirect
 	github.com/lestrrat-go/blackmagic v1.0.4 // indirect
-	github.com/lestrrat-go/dsig v1.3.0 // indirect
+	github.com/lestrrat-go/dsig v1.4.0 // indirect
 	github.com/lestrrat-go/dsig-secp256k1 v1.0.0 // indirect
 	github.com/lestrrat-go/httpcc v1.0.1 // indirect
 	github.com/lestrrat-go/httprc/v3 v3.0.6 // indirect
@@ -113,10 +113,10 @@ require (
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.opentelemetry.io/otel/metric v1.46.0 // indirect
 	golang.org/x/crypto v0.55.0 // indirect
-	golang.org/x/mod v0.38.0 // indirect
+	golang.org/x/mod v0.41.0 // indirect
 	golang.org/x/net v0.58.0 // indirect
-	golang.org/x/sys v0.47.0 // indirect
-	golang.org/x/tools v0.48.0 // indirect
+	golang.org/x/sys v0.48.0 // indirect
+	golang.org/x/tools v0.49.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260819154853-08b0e4226688 // indirect
 )
```

**File**: `go.sum` (modified, +26/-26)
```diff
@@ -83,8 +83,8 @@ github.com/huandu/xstrings v1.4.0 h1:D17IlohoQq4UcpqD7fDk80P7l+lwAmlFaBHgOipl2FU
 github.com/huandu/xstrings v1.4.0/go.mod h1:y5/lhBue+AyNmUVz9RLU9xbLR0o4KIIExikq4ovT0aE=
 github.com/inconshreveable/mousetrap v1.1.0 h1:wN+x4NVGpMsO7ErUn/mUI3vEoE6Jt13X2s0bqwp9tc8=
 github.com/inconshreveable/mousetrap v1.1.0/go.mod h1:vpF70FUmC8bwa3OWnCshd2FqLfsEA9PFc4w1p2J65bw=
-github.com/klauspost/compress v1.19.1 h1:VsB4HPswih7mmZ8WleSFQ75c/Ui1M4trX5oAsJnhSlk=
-github.com/klauspost/compress v1.19.1/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
+github.com/klauspost/compress v1.20.0 h1:a3C1ke2ohxFymNlb2HWAHjDeKCI90scRskErZkR0ezA=
+github.com/klauspost/compress v1.20.0/go.mod h1:LUdAzn7YLVvxLpc7y3V1m40wESHTgc1422pwwBSKYuI=
 github.com/kr/pretty v0.1.0/go.mod h1:dAy3ld7l9f0ibDNOQOHHMYYIIbhfbHSm3C4ZsoJORNo=
 github.com/kr/pretty v0.2.1/go.mod h1:ipq/a2n7PKx3OHsz4KJII5eveXtPO4qwEXGdVfWzfnI=
 github.com/kr/pretty v0.3.1 h1:flRD4NNwYAUpkphVc1HcthR4KEIFJ65n8Mw5qdRn3LE=
@@ -97,16 +97,16 @@ github.com/kylelemons/godebug v1.1.0 h1:RPNrshWIDI6G2gRW9EHilWtl7Z6Sb1BR0xunSBf0
 github.com/kylelemons/godebug v1.1.0/go.mod h1:9/0rRGxNHcop5bhtWyNeEfOS8JIWk580+fNqagV/RAw=
 github.com/lestrrat-go/blackmagic v1.0.4 h1:IwQibdnf8l2KoO+qC3uT4OaTWsW7tuRQXy9TRN9QanA=
 github.com/lestrrat-go/blackmagic v1.0.4/go.mod h1:6AWFyKNNj0zEXQYfTMPfZrAXUWUfTIZ5ECEUEJaijtw=
-github.com/lestrrat-go/dsig v1.3.0 h1:phjMOCXvYzhuIgn7Voe2rex8z166vGfxRxmqM25P9/Q=
-github.com/lestrrat-go/dsig v1.3.0/go.mod h1:RD2eOaidyPvpc7IJQoO3Qq52RWdy8ZcJs8lrOnoa1Kc=
+github.com/lestrrat-go/dsig v1.4.0 h1:g7LUjK8cT74A5DzBXJI5HzsJuLhoYN0Wzj4nuOMIrH8=
+github.com/lestrrat-go/dsig v1.4.0/go.mod h1:I8Nddg/vN2cUl/h8N7SRRApLnNNeyZPIqLYpvpOtGGo=
 github.com/lestrrat-go/dsig-secp256k1 v1.0.0 h1:JpDe4Aybfl0soBvoVwjqDbp+9S1Y2OM7gcrVVMFPOzY=
 github.com/lestrrat-go/dsig-secp256k1 v1.0.0/go.mod h1:CxUgAhssb8FToqbL8NjSPoGQlnO4w3LG1P0qPWQm/NU=
 github.com/lestrrat-go/httpcc v1.0.1 h1:ydWCStUeJLkpYyjLDHihupbn2tYmZ7m22BGkcvZZrIE=
 github.com/lestrrat-go/httpcc v1.0.1/go.mod h1:qiltp3Mt56+55GPVCbTdM9MlqhvzyuL6W/NMDA8vA5E=
 github.com/lestrrat-go/httprc/v3 v3.0.6 h1:4FpLQ18KK/ypPbVU3NLWJNRvH3kcYiqKqWfKGqNWxxI=
 github.com/lestrrat-go/httprc/v3 v3.0.6/go.mod h1:mSMtkZW92Z98M5YoNNztbRGxbXHql7tSitCvaxvo9l0=
-github.com/lestrrat-go/jwx/v3 v3.2.0 h1:Jb3zBASTSZXz7gzzSAfYqxXF8KejvKC4xWoePLQqXCA=
-github.com/lestrrat-go/jwx/v3 v3.2.0/go.mod h1:38vQ8iWKq3qRSbilbzvzdQPuywhowwuR03lhkYskyrw=
+github.com/lestrrat-go/jwx/v3 v3.3.0 h1:OXcYvQOQ7cxWzeZ/Q9sYk8ABe/kCSI371WmuACiCT+4=
+github.com/lestrrat-go/jwx/v3 v3.3.0/go.mod h1:eIJhDcKHBwcgxqv8RiIylV67TVl1wJp/265IAHY1Db8=
 github.com/lestrrat-go/option/v2 v2.0.0 h1:XxrcaJESE1fokHy3FpaQ/cXW8ZsIdWcdFzzLOcID3Ss=
 github.com/lestrrat-go/option/v2 v2.0.0/go.mod h1:oSySsmzMoR0iRzCDCaUfsCzxQHUEuhOViQObyy7S6Vg=
 github.com/mattn/go-colorable v0.1.14 h1:9A9LHSqF/7dyVVX6g0U9cwm9pG3kP9gSzcuIPHPsaIE=
@@ -125,8 +125,8 @@ github.com/olekukonko/errors v1.2.0 h1:10Zcn4GeV59t/EGqJc8fUjtFT/FuUh5bTMzZ1XwmC
 github.com/olekukonko/errors v1.2.0/go.mod h1:ppzxA5jBKcO1vIpCXQ9ZqgDh8iwODz6OXIGKU8r5m4Y=
 github.com/olekukonko/ll v0.1.6 h1:lGVTHO+Qc4Qm+fce/2h2m5y9LvqaW+DCN7xW9hsU3uA=
 github.com/olekukonko/ll v0.1.6/go.mod h1:NVUmjBb/aCtUpjKk75BhWrOlARz3dqsM+OtszpY4o88=
-github.com/olekukonko/tablewriter v1.1.4 h1:ORUMI3dXbMnRlRggJX3+q7OzQFDdvgbN9nVWj1drm6I=
-github.com/olekukonko/tablewriter v1.1.4/go.mod h1:+kedxuyTtgoZLwif3P1Em4hARJs+mVnzKxmsCL/C5RY=
+github.com/olekukonko/tablewriter v1.1.5 h1:4LoZSfMySpMQY3PT8RWJsJeuEuMIoo9xGRgvmqjg6IQ=
+github.com/olekukonko/tablewriter v1.1.5/go.mod h1:+kedxuyTtgoZLwif3P1Em4hARJs+mVnzKxmsCL/C5RY=
 github.com/opencontainers/go-digest v1.0.0 h1:apOUWs51W5PlhuyGyz9FCeeBIOUDA/6nW8Oi/yOhh5U=
 github.com/opencontainers/go-digest v1.0.0/go.mod h1:0JzlMkj0TRzQZfJkVvzbP0HBR3IKzErnv2BNG4W4MAM=
 github.com/opencontainers/image-spec v1.1.1 h1:y0fUlFfIZhPF1W537XOLg0/fcx6zcHCJwooC2xJA040=
@@ -137,8 +137,8 @@ github.com/pkg/diff v0.0.0-20210226163009-20ebb0f2a09e/go.mod h1:pJLUxLENpZxwdsK
 github.com/pmezard/go-difflib v1.0.0/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
 github.com/prometheus/client_golang v1.24.1 h1:JnJkREXzWxUdCuPFpIWZiPispT9xVV59uiuyR2bPlnU=
 github.com/prometheus/client_golang v1.24.1/go.mod h1:F+oSRECHg4sse5ucfYpYDeIv/hu68Zo0uoHKetWnzcE=
-github.com/prometheus/client_model v0.6.2 h1:oBsgwpGs7iVziMvrGhE53c/GrLUsZdHnqNwqPLxwZyk=
-github.com/prometheus/client_model v0.6.2/go.mod h1:y3m2F6Gdpfy6Ut/GBsUqTWZqCUvMVzSfMLjcu6wAwpE=
+github.com/prometheus/client_model v0.6.3 h1:O0jaTVAYNxTHYInEPFJt5I3+sN8zqBtVMPTB1qyxiEo=
+github.com/prometheus/client_model v0.6.3/go.mod h1:gpN5P9S7Rr6Yr92PiQ+Ixvhf6JZEkF1dnxsYL2aPBEM=
 github.com/prometheus/common v0.70.1 h1:1HvjP4D5oL3t8RsPlwxA9onvvStjtIHYE5XuuwOi/PY=
 github.com/prometheus/common v0.70.1/go.mod h1:VdFUQDMZK3VLkurFUVhia6uys/0suUp86TJz5qbJRhc=
 github.com/prometheus/procfs v0.21.1 h1:GljZCt+zSTS+NZq88cyQ1LjZ+RCHp3uVuabBWA5+OJI=
@@ -196,8 +196,8 @@ github.com/tetratelab
```

#### Recent Merged Pull Requests:
- **PR #9326** (2026-10-05): benchmarks: further notebook tweaks (@srenatus)
- **PR #9325** (2026-10-05): topdown: skip label tracking when the policy has no labels (@srenatus)
- **PR #9321** (2026-10-05): topdown: don't panic reversing strings that aren't valid UTF-8 (@sspaink)
- **PR #9319** (2026-10-02): topdown: match one string against strings.any_*_match search strings in place (@srenatus)
- **PR #9318** (2026-10-02): index: two correctness tweaks (@srenatus)
- **PR #9317** (2026-10-02): notebook: bump plotje (0.16.0) (@srenatus)
- **PR #9316** (2026-10-01): docs: Fix broken links from link checker report (@sspaink)
- **PR #9315** (2026-10-02): ast: narrow ref vars with known values in the rule graph (@sspaink)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

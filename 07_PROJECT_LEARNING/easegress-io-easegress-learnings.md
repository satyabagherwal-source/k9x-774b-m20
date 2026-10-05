# Forensic Learning Record (Deep Inspection): easegress-io/easegress

> **Canonical Artifact**: `07_PROJECT_LEARNING/easegress-io-easegress-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/easegress-io/easegress](https://github.com/easegress-io/easegress))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:28:31.358Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `easegress-io/easegress`
- **Description**: A Cloud Native traffic orchestration system. (CNCF Project)
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5867 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/client/command/utils.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Package command provides the commands.
package command

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/megaease/easegress/v2/cmd/client/general"
	"github.com/megaease/easegress/v2/pkg/util/codectool"
	"github.com/spf13/cobra"
)

func handleRequest(httpMethod string, path string, yamlBody []byte, cmd *cobra.Command) {
	body, err := handleRequestV1(httpMethod, path, yamlBody, cmd)
	if err != nil {
		general.ExitWithError(err)
	}

	if len(body) != 0 {
		general.PrintBody(body)
	}
}

func handleRequestV1(httpMethod string, path string, yamlBody []byte, cmd *cobra.Command) (body []byte, err error) {
	var jsonBody []byte
	if yamlBody != nil {
		var err error
		jsonBody, err = codectool.YAMLToJSON(yamlBody)
		if err != nil {
			return nil, fmt.Errorf("yaml %s to json failed: %v", yamlBody, err)
		}
	}

	url, err := general.MakeURL(path)
	if err != nil {
		return nil, err
	}
	client, err := general.GetHTTPClient()
	if err != nil {
		return nil, err
	}
	resp, body := doRequestV1(httpMethod, url, jsonBody, client, cmd)

	msg := string(body)
	if strings.HasPrefix(url, general.HTTPProtocol) && resp.StatusCode == http.StatusBadRequest && strings.Contains(strings.ToUpper(msg), "HTTPS") {
		resp, body = doRequestV1(httpMethod, general.HTTPSProtocol+strings.TrimPrefix(url, general.HTTPProtocol), jsonBody, client, cmd)
	}

	if !general.SuccessfulStatusCode(resp.StatusCode) {
		apiErr := &general.APIErr{}
		err := codectool.Unmarshal(body, apiErr)
		if err == nil {
			msg = apiErr.Message
		}
		return nil, fmt.Errorf("%d: %s", apiErr.Code, msg)
	}
	return body, nil
}

func doRequestV1(httpMethod string, url string, jsonBody []byte, client *http.Client, cmd *cobra.Command) (*http.Response, []byte) {
	req, err := http.NewRequest(httpMethod, url, bytes.NewReader(jsonBody))
	if err != nil {
		general.ExitWithError(err)
	}
	resp, err := client.Do(req)
	if err != nil {
		general.ExitWithErrorf("%s failed: %v", cmd.Short, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		general.ExitWithErrorf("%s failed: %v", cmd.Short, err)
	}
	return resp, body
}

```

### Core Architecture Module: `cmd/client/commandv2/convert/nginx/utils.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package nginx

import (
	"fmt"
	"strings"
)

func directiveInfo(d *Directive) string {
	return fmt.Sprintf("directive <%s %s> of %s:%d", d.Directive, strings.Join(d.Args, " "), d.File, d.Line)
}

```

### Core Architecture Module: `pkg/common/utils.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Package common provides several common utilities for other packages.
package common

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
)

// URLFriendlyCharactersRegex - safe characters for friendly url, rfc3986 section 2.3
var URLFriendlyCharactersRegex = regexp.MustCompile(`^[A-Za-z0-9\-_\.~]{1,253}$`)

// ValidateName validates the name.
func ValidateName(name string) error {
	if !URLFriendlyCharactersRegex.Match([]byte(name)) {
		return fmt.Errorf("invalid constant: %s", name)
	}

	return nil
}

// IsDirEmpty returns true if a directory is empty.
func IsDirEmpty(name string) bool {
	f, err := os.Open(name)
	if err != nil {
		return os.IsNotExist(err)
	}
	defer f.Close()

	_, err = f.Readdirnames(1)
	return err == io.EOF
}

// ExpandDir cleans the dir, and returns itself if it's absolute,
// otherwise prefix with the current/working directory.
func ExpandDir(dir string) string {
	wd := filepath.Dir(os.Args[0])
	if filepath.IsAbs(dir) {
		return filepath.Clean(dir)
	}
	return filepath.Clean(filepath.Join(wd, dir))
}

// MkdirAll wraps os.MakeAll with fixed perm.
func MkdirAll(path string) error {
	return os.MkdirAll(ExpandDir(path), 0o700)
}

// RemoveAll wraps os.RemoveAll.
func RemoveAll(path string) error {
	return os.RemoveAll(ExpandDir(path))
}

// BackupAndCleanDir cleans old stuff in both dir and backupDir,
// and backups dir to backupDir.
// The backupDir generated by appending postfix `_bak` for dir.
// It does nothing if dir does not exist.
func BackupAndCleanDir(dir string) error {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return nil
	}

	dir = ExpandDir(dir)
	backupDir := dir + "_bak"

	err := os.RemoveAll(backupDir)
	if err != nil {
		return err
	}

	err = os.Rename(dir, backupDir)
	if err != nil {
		return err
	}

	return MkdirAll(dir)
}

// NormalizeZapLogPath is a workaround for https://github.com/uber-go/zap/issues/621
// the workaround is from https://github.com/ipfs/go-log/issues/73
func NormalizeZapLogPath(path string) string {
	if runtime.GOOS == "windows" {
		return "file:////%3F/" + filepath.ToSlash(path)
	}

	return path
}

```

### Core Architecture Module: `pkg/object/function/worker/api.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package worker

import (
	"fmt"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/megaease/easegress/v2/pkg/api"
	"github.com/megaease/easegress/v2/pkg/logger"
	"github.com/megaease/easegress/v2/pkg/object/function/spec"
	"github.com/megaease/easegress/v2/pkg/object/function/storage"
	"github.com/megaease/easegress/v2/pkg/util/codectool"
	"github.com/megaease/easegress/v2/pkg/v"
)

var (
	errFunctionNotFound     = fmt.Errorf("can't find function")
	errFunctionAlreadyExist = fmt.Errorf("function already exist")
	startMsg                = []byte("function has been started, please wait for system turning it into active status")
)

func (worker *Worker) faasAPIPrefix() string {
	return fmt.Sprintf("/faas/%s", worker.name)
}

const APIGroupName = "faas_admin"

func (worker *Worker) registerAPIs() {
	group := &api.Group{
		Group: APIGroupName,
		Entries: []*api.Entry{
			{Path: worker.faasAPIPrefix(), Method: "POST", Handler: worker.Create},
			{Path: worker.faasAPIPrefix(), Method: "GET", Handler: worker.List},
			{Path: worker.faasAPIPrefix() + "/{name}", Method: "GET", Handler: worker.Get},
			{Path: worker.faasAPIPrefix() + "/{name}/start", Method: "PUT", Handler: worker.Start},
			{Path: worker.faasAPIPrefix() + "/{name}/stop", Method: "PUT", Handler: worker.Stop},
			{Path: worker.faasAPIPrefix() + "/{name}", Method: "DELETE", Handler: worker.Delete},
			{Path: worker.faasAPIPrefix() + "/{name}", Method: "PUT", Handler: worker.Update},
		},
	}

	api.RegisterAPIs(group)
}

func (worker *Worker) unregisterAPIs() {
	api.UnregisterAPIs(APIGroupName)
}

func (worker *Worker) readFunctionName(w http.ResponseWriter, r *http.Request) (string, error) {
	serviceName := chi.URLParam(r, "name")
	if serviceName == "" {
		return "", fmt.Errorf("empty service name")
	}

	return serviceName, nil
}

// Create deals with HTTP POST method
func (worker *Worker) Create(w http.ResponseWriter, r *http.Request) {
	spec := &spec.Spec{}
	err := worker.readAPISpec(w, r, spec)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		logger.Errorf("create function with bad request: %v", err)
		return
	}
	worker.store.Lock()
	defer worker.store.Unlock()

	_, err = worker.getFunctionSpec(spec.Name)
	if err != nil && err != errFunctionNotFound {
		logger.Errorf("create function: %s by getting faas spec failed: %v", spec.Name, err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	// already created
	if err == nil {
		api.HandleAPIError(w, r, http.StatusConflict, errFunctionAlreadyExist)
		return
	}

	if err = worker.provider.Create(spec); err != nil {
		logger.Errorf("create function: %s by calling faas provider failed: %v", spec.Name, err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}

	if err := worker.put(spec); err != nil {
		logger.Errorf("create function: %s by setting store failed: %v", spec.Name, err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	if err = worker.ingress.Put(spec); err != nil {
		logger.Errorf("[BUG] create function: %s by add ingress failed: %v", spec.Name, err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	w.Header().Set("Location", r.URL.Path+"/"+spec.Name)
	w.WriteHeader(http.StatusCreated)
}

func (worker *Worker) readAPISpec(w http.ResponseWriter, r *http.Request, spec interface{}) error {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return fmt.Errorf("read body failed: %v", err)
	}
	err = codectool.Unmarshal(body, spec)
	if err != nil {
		return fmt.Errorf("unmarshal to json failed: %v", err)
	}

	vr := v.Validate(spec)
	if !vr.Valid() {
		return fmt.Errorf("validate failed: \n%s", vr.Error())
	}

	return nil
}

func (worker *Worker) updateState(w http.ResponseWriter, r *http.Request, event spec.Event) (name string, err error) {
	name, err = worker.readFunctionName(w, r)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}

	function, err := worker.get(name)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	stateUpdated := false
	if stateUpdated, err = function.Next(event); err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}
	// not need to update function's status.
	if !stateUpdated {
		return
	}
	err = worker.store.Lock()
	if err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	defer worker.store.Unlock()
	err = worker.updateFunctionStatus(function.Status)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	return
}

// Stop is a stop API which deals with HTTP PUT method
func (worker *Worker) Stop(w http.ResponseWriter, r *http.Request) {
	name, err := worker.updateState(w, r, spec.StopEvent)
	if err != nil {
		logger.Errorf("worker stop function failed, %v", err)
		return
	}
	worker.ingress.Stop(name)
}

// Start is a start API which deals with HTTP PUT method
func (worker *Worker) Start(w http.ResponseWriter, r *http.Request) {
	name, err := worker.updateState(w, r, spec.StartEvent)
	if err != nil {
		return
	}

	worker.starFunctions.Store(name, struct{}{})
	w.Header().Set("Content-Type", "text/html; charset=UTF-8")
	w.Write(startMsg)
}

// Delete deals with HTTP DELETE
func (worker *Worker) Delete(w http.ResponseWriter, r *http.Request) {
	name, err := worker.readFunctionName(w, r)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}
	function, err := worker.get(name)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	if _, err = function.Next(spec.DeleteEvent); err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}
	err = worker.Lock()
	if err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	defer worker.Unlock()

	// delete function in FaaS Provider
	if err = worker.provider.Delete(name); err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	// remove route in Ingress
	worker.ingress.Delete(name)
	if err = worker.store.Delete(storage.GetFunctionSpecPrefix(worker.name, name)); err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	if err = worker.store.Delete(storage.GetFunctionStatusPrefix(worker.name, name)); err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
}

// List deals with HTTP GET method
func (worker *Worker) List(w http.ResponseWriter, r *http.Request) {
	functions, err := worker.listFunctions()
	if err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}

	buff, err := codectool.MarshalJSON(functions)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, fmt.Errorf("marshal %#v to json failed: %v", functions, err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(buff)
}

// Update deals with HTTP PUT method
func (worker *Worker) Update(w http.ResponseWriter, r *http.Request) {
	funcSpec := &spec.Spec{}
	err := worker.readAPISpec(w, r, funcSpec)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		logger.Errorf("update function with bad request: %v")
		return
	}
	name, err := worker.readFunctionName(w, r)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		logger.Errorf("update function with bad request: %v")
		return
	}
	if name != funcSpec.Name {
		api.HandleAPIError(w, r, http.StatusBadRequest,
			fmt.Errorf("update URL name %s, specname :%s, mismatch", name, funcSpec.Name))
		return
	}

	function, err := worker.get(funcSpec.Name)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}

	stateUpdated := false
	if stateUpdated, err = function.Next(spec.UpdateEvent); err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}

	worker.Lock()
	defer worker.Unlock()
	// update the FaaS provider related filed
	if err := worker.provider.Update(funcSpec); err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		logger.Errorf("update function: %s failed: %v", funcSpec.Name, err)
		return
	}

	if err = worker.updateFunctionSpec(funcSpec); err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}

	if stateUpdated {
		if err = worker.updateFunctionStatus(function.Status); err != nil {
			api.HandleAPIError(w, r, http.StatusInternalServerError, err)
			return
		}
	}
}

// Get deals with HTTP GET method request
func (worker *Worker) Get(w http.ResponseWriter, r *http.Request) {
	name, err := worker.readFunctionName(w, r)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}
	function, err := worker.get(name)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		logger.Errorf("create function with bad request: %v", err)
		return
	}

	// no display
	function.Fsm = nil

	buff, err := codectool.MarshalJSON(function)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, fmt.Errorf("marshal %#v to json failed: %v", function, err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(buff)
}

```

### Core Architecture Module: `pkg/object/function/worker/function.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package worker

import (
	"github.com/megaease/easegress/v2/pkg/logger"
	"github.com/megaease/easegress/v2/pkg/object/function/spec"
	"github.com/megaease/easegress/v2/pkg/object/function/storage"
	"github.com/megaease/easegress/v2/pkg/util/codectool"
)

// put puts a function spec and status into store.
func (worker *Worker) put(funcSpec *spec.Spec) error {
	buf, err := codectool.MarshalJSON(funcSpec)
	if err != nil {
		return err
	}
	key := storage.GetFunctionSpecPrefix(worker.name, funcSpec.Name)
	if err = worker.store.Put(key, string(buf)); err != nil {
		logger.Errorf("put function:%s spec failed: %v", funcSpec.Name, err)
		return err
	}

	status := &spec.Status{
		Name:  funcSpec.Name,
		State: spec.InitState(),
		Event: spec.CreateEvent,
	}
	buf, err = codectool.MarshalJSON(status)
	if err != nil {
		return err
	}
	key = storage.GetFunctionStatusPrefix(worker.name, funcSpec.Name)
	if err = worker.store.Put(key, string(buf)); err != nil {
		logger.Errorf("put function:%s status failed: %v", funcSpec.Name, err)
		return err
	}
	return nil
}

func (worker *Worker) listFunctions() ([]*spec.Function, error) {
	functions := []*spec.Function{}
	specs, err := worker.listAllFunctionSpecs()
	if err != nil {
		logger.Errorf("worker list all function specs failed: %v", err)
		return functions, nil
	}

	statuses, err := worker.listAllFunctionStatus()
	if err != nil {
		logger.Errorf("worker list all function status failed: %v", err)
		return functions, nil
	}
	for _, funcSpec := range specs {
		var status *spec.Status
		for _, s := range statuses {
			if funcSpec.Name == s.Name {
				status = s
			}
		}
		if status != nil {
			fsm, err := spec.InitFSM(status.State)
			if err != nil {
				logger.Errorf("List all functions, in function: %s, failed: %v", funcSpec.Name, err)
				continue
			}

			functions = append(functions, &spec.Function{
				Spec:   funcSpec,
				Status: status,
				Fsm:    fsm,
			})
		}
	}
	return functions, nil
}

func (worker *Worker) get(functionName string) (*spec.Function, error) {
	funcSpec, err := worker.getFunctionSpec(functionName)
	if err != nil {
		logger.Errorf("get function: %s's spec failed: %v", functionName, err)
		return nil, err
	}
	status, err := worker.getFunctionStatus(functionName)
	if err != nil {
		logger.Errorf("get function: %s's status failed: %v", functionName, err)
		return nil, err
	}
	fsm, err := spec.InitFSM(status.State)
	if err != nil {
		logger.Errorf("init function: %s's fsm failed: %v ", functionName, err)
		return nil, err
	}

	return &spec.Function{
		Spec:   funcSpec,
		Status: status,
		Fsm:    fsm,
	}, nil
}

func (worker *Worker) updateFunctionStatus(status *spec.Status) error {
	buff, err := codectool.MarshalJSON(status)
	if err != nil {
		logger.Errorf("BUG: marshal %#v to json failed: %v", status, err)
		return err
	}

	key := storage.GetFunctionStatusPrefix(worker.name, status.Name)
	err = worker.store.Put(key, string(buff))
	if err != nil {
		logger.Errorf("update function: %s's status failed: %v", status.Name, err)
		return err
	}
	return nil
}

func (worker *Worker) updateFunctionSpec(funcSpec *spec.Spec) error {
	buff, err := codectool.MarshalJSON(funcSpec)
	if err != nil {
		logger.Errorf("BUG: marshal %#v to json failed: %v", funcSpec, err)
		return err
	}

	key := storage.GetFunctionSpecPrefix(worker.name, funcSpec.Name)
	err = worker.store.Put(key, string(buff))
	if err != nil {
		logger.Errorf("update function: %s's spec failed: %v", funcSpec.Name, err)
		return err
	}
	return nil
}

func (worker *Worker) listAllFunctionStatus() ([]*spec.Status, error) {
	return worker.listFunctionStatus(true, "")
}

func (worker *Worker) getFunctionStatus(functionName string) (*spec.Status, error) {
	status, err := worker.listFunctionStatus(false, functionName)
	if err != nil {
		return nil, err
	}
	if len(status) == 0 {
		return nil, errFunctionNotFound
	}

	return status[0], nil
}

func (worker *Worker) listFunctionStatus(all bool, functionName string) ([]*spec.Status, error) {
	status := []*spec.Status{}
	var prefix string
	if all {
		prefix = storage.GetAllFunctionStatusPrefix(worker.name)
	} else {
		prefix = storage.GetFunctionStatusPrefix(worker.name, functionName)
	}

	kvs, err := worker.store.GetPrefix(prefix)
	if err != nil {
		return status, err
	}

	for _, v := range kvs {
		_status := &spec.Status{}
		if err = codectool.Unmarshal([]byte(v), _status); err != nil {
			logger.Errorf("BUG: unmarshal %s to json failed: %v", v, err)
			continue
		}

		status = append(status, _status)
	}

	return status, nil
}

func (worker *Worker) listAllFunctionSpecs() ([]*spec.Spec, error) {
	return worker.listFunctionSpecs(true, "")
}

func (worker *Worker) getFunctionSpec(functionName string) (*spec.Spec, error) {
	specs, err := worker.listFunctionSpecs(false, functionName)
	if err != nil {
		return nil, err
	}
	if len(specs) == 0 {
		return nil, errFunctionNotFound
	}

	return specs[0], nil
}

func (worker *Worker) listFunctionSpecs(all bool, functionName string) ([]*spec.Spec, error) {
	specs := []*spec.Spec{}
	var prefix string
	if all {
		prefix = storage.GetAllFunctionSpecPrefix(worker.name)
	} else {
		prefix = storage.GetFunctionSpecPrefix(worker.name, functionName)
	}

	kvs, err := worker.store.GetPrefix(prefix)
	if err != nil {
		return specs, err
	}

	for _, v := range kvs {
		_spec := &spec.Spec{}
		if err = codectool.Unmarshal([]byte(v), _spec); err != nil {
			logger.Errorf("BUG: unmarshal %s to json failed: %v", v, err)
			continue
		}

		specs = append(specs, _spec)
	}

	return specs, nil
}

// Lock locks the cluster store.
func (worker *Worker) Lock() error {
	return worker.store.Lock()
}

// Unlock unlocks the cluster store.
func (worker *Worker) Unlock() {
	worker.store.Unlock()
}

```

### Core Architecture Module: `pkg/object/function/worker/ingress.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package worker

import (
	"fmt"
	"sync"

	"github.com/megaease/easegress/v2/pkg/filters/builder"
	proxy "github.com/megaease/easegress/v2/pkg/filters/proxies/httpproxy"
	"github.com/megaease/easegress/v2/pkg/logger"
	"github.com/megaease/easegress/v2/pkg/object/function/spec"
	"github.com/megaease/easegress/v2/pkg/object/httpserver"
	"github.com/megaease/easegress/v2/pkg/object/httpserver/routers"
	"github.com/megaease/easegress/v2/pkg/object/pipeline"
	"github.com/megaease/easegress/v2/pkg/object/trafficcontroller"
	"github.com/megaease/easegress/v2/pkg/supervisor"
	"github.com/megaease/easegress/v2/pkg/util/codectool"
)

const ingressFunctionKey = "X-FaaS-Func-Name"

type (
	// ingressServer manages one/many ingress pipelines and one HTTPServer
	ingressServer struct {
		superSpec *supervisor.Spec

		faasNetworkLayerURL string
		faasHostSuffix      string
		faasNamespace       string

		namespace string
		mutex     sync.RWMutex

		tc             *trafficcontroller.TrafficController
		pipelines      map[string]struct{}
		httpServer     *supervisor.ObjectEntity
		httpServerSpec *supervisor.Spec
	}

	pipelineSpecBuilder struct {
		Kind          string `json:"kind"`
		Name          string `json:"name"`
		pipeline.Spec `json:",inline"`
	}

	httpServerSpecBuilder struct {
		Kind            string `json:"kind"`
		Name            string `json:"name"`
		httpserver.Spec `json:",inline"`
	}
)

// newIngressServer creates an initialized ingress server
func newIngressServer(superSpec *supervisor.Spec, controllerName string) *ingressServer {
	entity, exists := superSpec.Super().GetSystemController(trafficcontroller.Kind)

	if !exists {
		panic(fmt.Errorf("BUG: traffic controller not found"))
	}

	tc, ok := entity.Instance().(*trafficcontroller.TrafficController)
	if !ok {
		panic(fmt.Errorf("BUG: want *TrafficController, got %T", entity.Instance()))
	}
	return &ingressServer{
		pipelines:  make(map[string]struct{}),
		httpServer: nil,
		superSpec:  superSpec,
		mutex:      sync.RWMutex{},
		namespace:  fmt.Sprintf("%s/%s", superSpec.Name(), "ingress"),
		tc:         tc,
	}
}

func newPipelineSpecBuilder(funcName string) *pipelineSpecBuilder {
	return &pipelineSpecBuilder{
		Kind: pipeline.Kind,
		Name: funcName,
		Spec: pipeline.Spec{},
	}
}

func newHTTPServerSpecBuilder(controllerName string) *httpServerSpecBuilder {
	return &httpServerSpecBuilder{
		Kind: httpserver.Kind,
		Name: controllerName,
		Spec: httpserver.Spec{},
	}
}

func (b *httpServerSpecBuilder) buildWithOutRules(spec *httpserver.Spec) *httpServerSpecBuilder {
	var newSpec httpserver.Spec = *spec
	newSpec.Rules = nil // clear the rule, faasController will management them by itself
	b.Spec = newSpec
	return b
}

func (b *httpServerSpecBuilder) buildWithRules(spec *httpserver.Spec) *httpServerSpecBuilder {
	b.Spec = *spec
	return b
}

func (b *httpServerSpecBuilder) jsonConfig() string {
	buff, err := codectool.MarshalJSON(b)
	if err != nil {
		logger.Errorf("BUG: marshal %#v to json failed: %v", b, err)
	}
	return string(buff)
}

func (b *pipelineSpecBuilder) jsonConfig() string {
	buff, err := codectool.MarshalJSON(b)
	if err != nil {
		logger.Errorf("BUG: marshal %#v to json failed: %v", b, err)
	}
	return string(buff)
}

func (b *pipelineSpecBuilder) appendReqAdaptor(funcSpec *spec.Spec, faasNamespace, faasHostSuffix string) *pipelineSpecBuilder {
	adaptorName := "requestAdaptor"
	b.Flow = append(b.Flow, pipeline.FlowNode{FilterName: adaptorName})

	b.Filters = append(b.Filters, map[string]interface{}{
		"kind":   builder.RequestAdaptorKind,
		"name":   adaptorName,
		"method": funcSpec.RequestAdaptor.Method,
		"path":   funcSpec.RequestAdaptor.Path,
		"header": funcSpec.RequestAdaptor.Header,

		// let faas Provider's gateway recognized this function by Host field
		"host": funcSpec.Name + "." + faasNamespace + "." + faasHostSuffix,
	})

	return b
}

func (b *pipelineSpecBuilder) appendProxy(faasNetworkLayerURL string) *pipelineSpecBuilder {
	mainServers := []*proxy.Server{
		{
			URL:      faasNetworkLayerURL,
			KeepHost: true, // Keep the host of the requests as they route to functions.
		},
	}

	backendName := "faasBackend"

	lb := &proxy.LoadBalanceSpec{}

	b.Flow = append(b.Flow, pipeline.FlowNode{FilterName: backendName})
	b.Filters = append(b.Filters, map[string]interface{}{
		"kind": proxy.Kind,
		"name": backendName,
		"mainPool": &proxy.ServerPoolSpec{
			BaseServerPoolSpec: proxy.BaseServerPoolSpec{
				Servers:     mainServers,
				LoadBalance: lb,
			},
		},
	})

	return b
}

// Init creates a default ingress HTTPServer.
func (ings *ingressServer) Init() error {
	ings.mutex.Lock()
	defer ings.mutex.Unlock()

	if ings.httpServer != nil {
		return nil
	}
	spec := ings.superSpec.ObjectSpec().(*spec.Admin)

	ings.faasNetworkLayerURL = spec.Knative.NetworkLayerURL
	ings.faasHostSuffix = spec.Knative.HostSuffix
	ings.faasNamespace = spec.Knative.Namespace

	builder := newHTTPServerSpecBuilder(ings.superSpec.Name())
	builder.buildWithOutRules(spec.HTTPServer)
	superSpec, err := supervisor.NewSpec(builder.jsonConfig())
	if err != nil {
		logger.Errorf("new spec for %s failed: %v", builder.jsonConfig(), err)
		return err
	}

	ings.httpServerSpec = superSpec
	entity, err := ings.tc.CreateTrafficGateForSpec(ings.namespace, superSpec)
	if err != nil {
		return fmt.Errorf("create http server %s failed: %v", superSpec.Name(), err)
	}
	ings.httpServer = entity
	return nil
}

func (ings *ingressServer) updateHTTPServer(spec *httpserver.Spec) error {
	builder := newHTTPServerSpecBuilder(ings.superSpec.Name())
	builder.buildWithRules(spec)

	var err error
	ings.httpServerSpec, err = supervisor.NewSpec(builder.jsonConfig())
	if err != nil {
		return fmt.Errorf("BUG: new spec: %s failed: %v", builder.jsonConfig(), err)
	}
	_, err = ings.tc.ApplyTrafficGateForSpec(ings.namespace, ings.httpServerSpec)
	if err != nil {
		return fmt.Errorf("apply http server %s failed: %v", ings.httpServerSpec.Name(), err)
	}
	return nil
}

func (ings *ingressServer) find(pipeline string) int {
	spec := ings.httpServerSpec.ObjectSpec().(*httpserver.Spec)
	index := -1
	for idx, v := range spec.Rules {
		for _, p := range v.Paths {
			if p.Backend == pipeline {
				index = idx
				break
			}
		}
	}
	return index
}

func (ings *ingressServer) add(pipeline string) error {
	spec := ings.httpServerSpec.ObjectSpec().(*httpserver.Spec)
	index := ings.find(pipeline)
	// not backend as function's pipeline
	if index == -1 {
		rule := &routers.Rule{
			Paths: []*routers.Path{
				{
					PathPrefix: "/",
					Headers: []*routers.Header{
						{
							Key:    ingressFunctionKey,
							Values: []string{pipeline},
						},
					},
					Backend: pipeline,
				},
			},
		}
		spec.Rules = append(spec.Rules, rule)
		if err := ings.updateHTTPServer(spec); err != nil {
			logger.Errorf("update http server failed: %v ", err)
		}
	}
	return nil
}

func (ings *ingressServer) remove(pipeline string) error {
	spec := ings.httpServerSpec.ObjectSpec().(*httpserver.Spec)
	index := ings.find(pipeline)

	if index != -1 {
		spec.Rules = append(spec.Rules[:index], spec.Rules[index+1:]...)
		return ings.updateHTTPServer(spec)
	}
	return nil
}

// Put puts pipeline named by faas function's name with a requestAdaptor and proxy
func (ings *ingressServer) Put(funcSpec *spec.Spec) error {
	builder := newPipelineSpecBuilder(funcSpec.Name)
	builder.appendReqAdaptor(funcSpec, ings.faasNamespace, ings.faasHostSuffix)
	builder.appendProxy(ings.faasNetworkLayerURL)

	jsonConfig := builder.jsonConfig()
	superSpec, err := supervisor.NewSpec(jsonConfig)
	if err != nil {
		logger.Errorf("new spec for %s failed: %v", jsonConfig, err)
		return err
	}
	if _, err = ings.tc.CreatePipelineForSpec(ings.namespace, superSpec); err != nil {
		return fmt.Errorf("create http pipeline %s failed: %v", superSpec.Name(), err)
	}
	ings.add(funcSpec.Name)
	ings.pipelines[funcSpec.Name] = struct{}{}

	return nil
}

// Delete deletes one ingress pipeline according to the function's name.
func (ings *ingressServer) Delete(functionName string) {
	ings.mutex.Lock()
	_, exist := ings.pipelines[functionName]
	if exist {
		delete(ings.pipelines, functionName)
	}
	ings.mutex.Unlock()
	if exist {
		ings.remove(functionName)
	}
}

// Update updates ingress's all pipeline by all functions map. In Easegress scenario,
// this function can add back all function's pipeline in store.
func (ings *ingressServer) Update(allFunctions map[string]*spec.Function) {
	ings.mutex.Lock()
	defer ings.mutex.Unlock()
	for _, v := range allFunctions {
		index := ings.find(v.Spec.Name)
		_, exist := ings.pipelines[v.Spec.Name]

		if v.Status.State == spec.ActiveState {
			// need to add rule in HTTPServer or create this pipeline
			// especially in reboot scenario.
			if index == -1 || !exist {
				err := ings.Put(v.Spec)
				if err != nil {
					logger.Errorf("ingress add back local pipeline: %s, failed: %v",
						v.Spec.Name, err)
					continue
				}
			}
		} else {
			// Function not ready, then remove it from HTTPServer's route rule
			if index != -1 {
				ings.remove(v.Spec.Name)
			}
		}
	}
}

// Stop stops one ingress pipeline according to the function's name.
func (ings *ingressServer) Stop(functionName string) {
	ings.mutex.Lock()
	defer ings.mutex.Unlock()

	ings.remove(functionName)
}

// Start starts one ingress pipeline according to the fu
```

### Core Architecture Module: `pkg/object/function/worker/worker.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Package worker provides the worker for FaaSController.
package worker

import (
	"runtime/debug"
	"sync"
	"time"

	"github.com/megaease/easegress/v2/pkg/logger"
	"github.com/megaease/easegress/v2/pkg/object/function/provider"
	"github.com/megaease/easegress/v2/pkg/object/function/spec"
	"github.com/megaease/easegress/v2/pkg/object/function/storage"
	"github.com/megaease/easegress/v2/pkg/supervisor"
)

type (
	// Worker stores the worker information
	Worker struct {
		mutex     sync.RWMutex
		superSpec *supervisor.Spec

		name string

		ingress  *ingressServer
		store    storage.Storage
		provider provider.FaaSProvider

		// for storing manually starting functions' names
		starFunctions sync.Map

		syncInterval string
		done         chan (struct{})
	}
)

// NewWorker return a worker
func NewWorker(superSpec *supervisor.Spec) *Worker {
	store := storage.NewStorage(superSpec.Name(), superSpec.Super().Cluster())
	faasProvider := provider.NewProvider(superSpec)
	ingress := newIngressServer(superSpec, superSpec.Name())
	adm := superSpec.ObjectSpec().(*spec.Admin)

	w := &Worker{
		superSpec:    superSpec,
		store:        store,
		name:         superSpec.Name(),
		provider:     faasProvider,
		ingress:      ingress,
		syncInterval: adm.SyncInterval,

		done:          make(chan struct{}),
		starFunctions: sync.Map{},
		mutex:         sync.RWMutex{},
	}

	go w.run()
	return w
}

func (worker *Worker) run() {
	syncInterval, err := time.ParseDuration(worker.syncInterval)
	if err != nil {
		logger.Errorf("BUG: parse default sync interval: %s failed: %v",
			syncInterval, err)
		return
	}

	if err = worker.ingress.Init(); err != nil {
		logger.Errorf("worker ingress init failed: %v", err)
		return
	}

	if err = worker.provider.Init(); err != nil {
		logger.Errorf("worker's faas provider init failed: %v", err)
		return
	}

	worker.registerAPIs()

	go worker.syncStatus(syncInterval)
}

// updateStatus rebase functions' status by comparing FaaSProvider's function
// status and local store's function status.
func (worker *Worker) updateStatus() {
	// get all function
	functionList, err := worker.listFunctions()
	if err != nil {
		logger.Errorf("list function failed: %v", err)
		return
	}

	allFunctionMap := map[string]*spec.Function{}
	needUpdateFunction := []*spec.Status{}
	for _, function := range functionList {
		allFunctionMap[function.Spec.Name] = function

		if function.Status.State == spec.InactiveState {
			if _, exist := worker.starFunctions.Load(function.Spec.Name); !exist {
				continue
			}
			// function is inactive and user haven't start it manually
			// ignore event from FaaSProvider
		}

		// get function provision status inside faas provider
		providerStatus, err := worker.provider.GetStatus(function.Spec.Name)
		if err != nil {
			continue
		}

		if stateUpdated, err := function.Next(providerStatus.Event); err != nil {
			// not need to update
		} else {
			if stateUpdated {
				function.Status.ExtData = providerStatus.ExtData
				logger.Debugf("need update function: %s, spec:%#v status:%#v ",
					function.Spec.Name, function.Spec, function.Status)
				needUpdateFunction = append(needUpdateFunction, function.Status)
			}
		}
	}

	// update function status if needed and then
	for _, v := range needUpdateFunction {
		if err := worker.updateFunctionStatus(v); err != nil {
			logger.Errorf("update function: %s status failed: %v", v.Name, err)
			continue
		}
	}

	// check inactive and manually started functions' new state
	// if it is changed successfully, should remove it from worker.startFunctions.
	// not matter its' state is active, initial, or failed.
	for _, v := range allFunctionMap {
		if _, exist := worker.starFunctions.Load(v.Spec.Name); exist {
			if v.Status.State != spec.InactiveState {
				worker.starFunctions.Delete(v.Spec.Name)
			}
		}
	}

	// call ingress server reconciling all function pipeline state
	worker.ingress.Update(allFunctionMap)
}

// syncStatus sync function's status with
func (worker *Worker) syncStatus(syncInterval time.Duration) {
	routine := func() {
		defer func() {
			if err := recover(); err != nil {
				logger.Errorf("%s: recover from: %v, stack trace:\n%s\n",
					worker.superSpec.Name(), err, debug.Stack())
			}
		}()

		worker.updateStatus()
	}
	for {
		select {
		case <-worker.done:
			return
		case <-time.After(syncInterval):
			routine()
		}
	}
}

// Close closes the Egress HTTPServer and Pipelines
func (worker *Worker) Close() {
	worker.mutex.Lock()
	defer worker.mutex.Unlock()

	worker.unregisterAPIs()

	close(worker.done)
	worker.ingress.Close()
}

```

### Core Architecture Module: `pkg/object/meshcontroller/worker/api.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package worker

import (
	"net/http"

	"github.com/megaease/easegress/v2/pkg/object/meshcontroller/spec"
)

const (
	// meshEurekaPrefix is the mesh eureka registry API url prefix.
	meshEurekaPrefix = "/mesh/eureka"

	// meshNacosPrefix is the mesh nacos registry API url prefix.
	meshNacosPrefix = "/nacos/v1"
)

func (worker *Worker) runAPIServer() {
	var apis []*apiEntry
	switch worker.registryType {
	case spec.RegistryTypeConsul:
		apis = worker.consulAPIs()
	case spec.RegistryTypeEureka:
		apis = worker.eurekaAPIs()
	case spec.RegistryTypeNacos:
		apis = worker.nacosAPIs()
	default:
		apis = worker.eurekaAPIs()
	}
	worker.apiServer.registerAPIs(apis)
}

func (worker *Worker) emptyHandler(w http.ResponseWriter, r *http.Request) {
	// EaseMesh does not need to implement some APIS like
	// delete, heartbeat of Eureka/Consul/Nacos.
}

func (worker *Worker) writeJSONBody(w http.ResponseWriter, buff []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.Write(buff)
}

```

### Core Architecture Module: `pkg/object/meshcontroller/worker/api_consul.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package worker

import (
	"fmt"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/megaease/easegress/v2/pkg/api"
	"github.com/megaease/easegress/v2/pkg/logger"
	"github.com/megaease/easegress/v2/pkg/object/meshcontroller/registrycenter"
	"github.com/megaease/easegress/v2/pkg/util/codectool"
)

func (worker *Worker) consulAPIs() []*apiEntry {
	APIs := []*apiEntry{
		{
			Path:    "/v1/catalog/register",
			Method:  "PUT",
			Handler: worker.consulRegister,
		},
		{
			Path:    "/v1/agent/service/register",
			Method:  "PUT",
			Handler: worker.consulRegister,
		},
		{
			Path:    "/v1/agent/service/deregister",
			Method:  "DELETE",
			Handler: worker.emptyHandler,
		},
		{
			Path:    "/v1/health/service/{serviceName}",
			Method:  "GET",
			Handler: worker.healthService,
		},
		{
			Path:    "/v1/catalog/deregister",
			Method:  "DELETE",
			Handler: worker.emptyHandler,
		},
		{
			Path:    "/v1/catalog/services",
			Method:  "GET",
			Handler: worker.catalogServices,
		},
		{
			Path:    "/v1/catalog/service/{serviceName}",
			Method:  "GET",
			Handler: worker.catalogService,
		},
	}

	return APIs
}

func (worker *Worker) consulRegister(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest,
			fmt.Errorf("read body failed: %v", err))
		return
	}
	contentType := w.Header().Get("Content-Type")

	if err := worker.registryServer.CheckRegistryBody(contentType, body); err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}

	serviceSpec := worker.service.GetServiceSpec(worker.serviceName)
	if serviceSpec == nil {
		err := fmt.Errorf("registry to unknown service: %s", worker.serviceName)
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}

	worker.registryServer.Register(serviceSpec, worker.ingressServer.Ready, worker.egressServer.Ready)
}

func (worker *Worker) healthService(w http.ResponseWriter, r *http.Request) {
	serviceName := chi.URLParam(r, "serviceName")
	if serviceName == "" {
		api.HandleAPIError(w, r, http.StatusBadRequest, fmt.Errorf("empty service name"))
		return
	}
	var (
		err         error
		serviceInfo *registrycenter.ServiceRegistryInfo
	)

	if serviceInfo, err = worker.registryServer.DiscoveryService(serviceName); err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}

	serviceEntry := worker.registryServer.ToConsulHealthService(serviceInfo)

	buff := codectool.MustMarshalJSON(serviceEntry)
	worker.writeJSONBody(w, buff)
}

func (worker *Worker) catalogService(w http.ResponseWriter, r *http.Request) {
	serviceName := chi.URLParam(r, "serviceName")
	if serviceName == "" {
		api.HandleAPIError(w, r, http.StatusBadRequest, fmt.Errorf("empty service name"))
		return
	}
	var (
		err         error
		serviceInfo *registrycenter.ServiceRegistryInfo
	)

	if serviceInfo, err = worker.registryServer.DiscoveryService(serviceName); err != nil {
		logger.Errorf("discovery service: %s, err: %v ", serviceName, err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}

	catalogService := worker.registryServer.ToConsulCatalogService(serviceInfo)

	buff := codectool.MustMarshalJSON(catalogService)
	worker.writeJSONBody(w, buff)
}

func (worker *Worker) catalogServices(w http.ResponseWriter, r *http.Request) {
	var (
		err          error
		serviceInfos []*registrycenter.ServiceRegistryInfo
	)
	if serviceInfos, err = worker.registryServer.Discovery(); err != nil {
		logger.Errorf("discovery services err: %v ", err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	catalogServices := worker.registryServer.ToConsulServices(serviceInfos)

	buff := codectool.MustMarshalJSON(catalogServices)
	worker.writeJSONBody(w, buff)
}

```

### Core Architecture Module: `pkg/object/meshcontroller/worker/api_eureka.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package worker

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/ArthurHlt/go-eureka-client/eureka"
	"github.com/go-chi/chi/v5"

	"github.com/megaease/easegress/v2/pkg/api"
	"github.com/megaease/easegress/v2/pkg/logger"
	"github.com/megaease/easegress/v2/pkg/object/meshcontroller/registrycenter"
	"github.com/megaease/easegress/v2/pkg/util/codectool"
)

type (
	eurekaJSONApps struct {
		APPs eurekaAPPs `json:"applications"`
	}

	eurekaAPPs struct {
		VersionDelta string      `json:"versions__delta"`
		AppHashCode  string      `json:"apps__hashcode"`
		Application  []eurekaAPP `json:"application"`
	}

	eurekaJSONAPP struct {
		APP eurekaAPP `json:"application"`
	}

	eurekaAPP struct {
		Name      string                `json:"name"`
		Instances []eureka.InstanceInfo `json:"instance"`
	}
)

func (worker *Worker) eurekaAPIs() []*apiEntry {
	APIs := []*apiEntry{
		{
			Path:    meshEurekaPrefix + "/apps/{serviceName}",
			Method:  "POST",
			Handler: worker.eurekaRegister,
		},
		{
			Path:    meshEurekaPrefix + "/apps/{serviceName}/{instanceID}",
			Method:  "DELETE",
			Handler: worker.emptyHandler,
		},
		{
			Path:    meshEurekaPrefix + "/apps/{serviceName}/{instanceID}",
			Method:  "PUT",
			Handler: worker.emptyHandler,
		},
		{
			Path:    meshEurekaPrefix + "/apps/",
			Method:  "GET",
			Handler: worker.apps,
		},
		{
			Path:    meshEurekaPrefix + "/apps/{serviceName}",
			Method:  "GET",
			Handler: worker.app,
		},
		{
			Path:    meshEurekaPrefix + "/apps/{serviceName}/{instanceID}",
			Method:  "GET",
			Handler: worker.getAppInstance,
		},
		{
			Path:    meshEurekaPrefix + "/apps/instances/{instanceID}",
			Method:  "GET",
			Handler: worker.getInstance,
		},
		{
			Path:    meshEurekaPrefix + "/apps/{serviceName}/{instanceID}/status",
			Method:  "PUT",
			Handler: worker.emptyHandler,
		},
		{
			Path:    meshEurekaPrefix + "/apps/{serviceName}/{instanceID}/status",
			Method:  "DELETE",
			Handler: worker.emptyHandler,
		},
		{
			Path:    meshEurekaPrefix + "/apps/{serviceName}/{instanceID}/metadata",
			Method:  "PUT",
			Handler: worker.emptyHandler,
		},
		{
			Path:    meshEurekaPrefix + "/vips/{vipAddress}",
			Method:  "GET",
			Handler: worker.emptyHandler,
		},
		{
			Path:    meshEurekaPrefix + "/svips/{svipAddress}",
			Method:  "GET",
			Handler: worker.emptyHandler,
		},
	}

	return APIs
}

func (worker *Worker) detectedAccept(accept string) string {
	accepts := strings.Split(accept, ",")

	for _, v := range accepts {
		if v == registrycenter.ContentTypeJSON {
			return registrycenter.ContentTypeJSON
		}
		if v == registrycenter.ContentTypeXML {
			return registrycenter.ContentTypeXML
		}
	}

	return registrycenter.ContentTypeXML
}

func (worker *Worker) eurekaRegister(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest,
			fmt.Errorf("read body failed: %v", err))
		return
	}
	contentType := r.Header.Get("Content-Type")
	if err := worker.registryServer.CheckRegistryBody(contentType, body); err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}

	serviceSpec := worker.service.GetServiceSpec(worker.serviceName)
	if serviceSpec == nil {
		err := fmt.Errorf("registry to unknown service: %s", worker.serviceName)
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}

	worker.registryServer.Register(serviceSpec, worker.ingressServer.Ready, worker.egressServer.Ready)

	// NOTE: According to eureka APIs list:
	// https://github.com/Netflix/eureka/wiki/Eureka-REST-operations
	w.WriteHeader(http.StatusNoContent)
}

func (worker *Worker) apps(w http.ResponseWriter, r *http.Request) {
	var (
		err          error
		serviceInfos []*registrycenter.ServiceRegistryInfo
	)
	if serviceInfos, err = worker.registryServer.Discovery(); err != nil {
		logger.Errorf("discovery services err: %v ", err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	xmlAPPs := worker.registryServer.ToEurekaApps(serviceInfos)
	jsonAPPs := eurekaJSONApps{
		APPs: eurekaAPPs{
			VersionDelta: strconv.Itoa(xmlAPPs.VersionsDelta),
			AppHashCode:  xmlAPPs.AppsHashcode,
		},
	}

	for _, v := range xmlAPPs.Applications {
		jsonAPPs.APPs.Application = append(jsonAPPs.APPs.Application, eurekaAPP{Name: v.Name, Instances: v.Instances})
	}

	accept := worker.detectedAccept(r.Header.Get("Accept"))

	rsp, err := worker.encodeByAcceptType(accept, jsonAPPs, xmlAPPs)
	if err != nil {
		logger.Errorf("encode accept: %s failed: %v", accept, err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}

	w.Header().Set("Content-Type", accept)
	w.Write(rsp)
}

func (worker *Worker) app(w http.ResponseWriter, r *http.Request) {
	serviceName := chi.URLParam(r, "serviceName")
	if serviceName == "" {
		api.HandleAPIError(w, r, http.StatusBadRequest, fmt.Errorf("empty service name(app)"))
		return
	}

	// eureka use 'delta' after /apps/, need to handle this
	// special case here.
	if serviceName == "delta" {
		worker.apps(w, r)
		return
	}

	var (
		err         error
		serviceInfo *registrycenter.ServiceRegistryInfo
	)

	if serviceInfo, err = worker.registryServer.DiscoveryService(serviceName); err != nil {
		logger.Errorf("discovery service: %s, err: %v ", serviceName, err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	accept := worker.detectedAccept(r.Header.Get("Accept"))
	xmlAPP := worker.registryServer.ToEurekaApp(serviceInfo)

	jsonApp := eurekaJSONAPP{
		APP: eurekaAPP{
			Name:      xmlAPP.Name,
			Instances: xmlAPP.Instances,
		},
	}
	rsp, err := worker.encodeByAcceptType(accept, jsonApp, xmlAPP)
	if err != nil {
		logger.Errorf("encode accept: %s failed: %v", accept, err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}

	w.Header().Set("Content-Type", accept)
	w.Write(rsp)
}

func (worker *Worker) getAppInstance(w http.ResponseWriter, r *http.Request) {
	serviceName := chi.URLParam(r, "serviceName")
	if serviceName == "" {
		api.HandleAPIError(w, r, http.StatusBadRequest, fmt.Errorf("empty service name(app)"))
		return
	}
	instanceID := chi.URLParam(r, "instanceID")
	if instanceID == "" {
		api.HandleAPIError(w, r, http.StatusBadRequest, fmt.Errorf("empty instanceID"))
		return
	}

	serviceInfo, err := worker.registryServer.DiscoveryService(serviceName)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}

	if serviceInfo.Service.Name == serviceName && instanceID == serviceInfo.Ins.InstanceID {
		ins := worker.registryServer.ToEurekaInstanceInfo(serviceInfo)
		accept := worker.detectedAccept(w.Header().Get("Accept"))

		rsp, err := worker.encodeByAcceptType(accept, ins, ins)
		if err != nil {
			logger.Errorf("encode accept: %s failed: %v", accept, err)
			api.HandleAPIError(w, r, http.StatusInternalServerError, err)
			return
		}
		w.Header().Set("Content-Type", accept)
		w.Write(rsp)
		return
	}

	w.WriteHeader(http.StatusNotFound)
}

func (worker *Worker) getInstance(w http.ResponseWriter, r *http.Request) {
	instanceID := chi.URLParam(r, "instanceID")
	if instanceID == "" {
		api.HandleAPIError(w, r, http.StatusBadRequest, fmt.Errorf("empty instanceID"))
		return
	}
	serviceName := registrycenter.GetServiceName(instanceID)
	if len(serviceName) == 0 {
		api.HandleAPIError(w, r, http.StatusBadRequest, fmt.Errorf("unknown instanceID: %s", instanceID))
		return
	}

	serviceInfo, err := worker.registryServer.DiscoveryService(serviceName)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	ins := worker.registryServer.ToEurekaInstanceInfo(serviceInfo)
	accept := worker.detectedAccept(r.Header.Get("Accept"))

	rsp, err := worker.encodeByAcceptType(accept, ins, ins)
	if err != nil {
		logger.Errorf("encode accept: %s failed: %v", accept, err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	w.Header().Set("Content-Type", accept)
	w.Write(rsp)
}

func (worker *Worker) encodeByAcceptType(accept string, jsonSt interface{}, xmlSt interface{}) ([]byte, error) {
	switch accept {
	case registrycenter.ContentTypeJSON:
		return codectool.MarshalJSON(jsonSt)
	default:
		return xml.Marshal(xmlSt)
	}
}

```

### Core Architecture Module: `pkg/object/meshcontroller/worker/api_nacos.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package worker

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/megaease/easegress/v2/pkg/api"
	"github.com/megaease/easegress/v2/pkg/logger"
	"github.com/megaease/easegress/v2/pkg/object/meshcontroller/registrycenter"
	"github.com/megaease/easegress/v2/pkg/util/codectool"
)

func (worker *Worker) nacosAPIs() []*apiEntry {
	APIs := []*apiEntry{
		{
			Path:    meshNacosPrefix + "/ns/instance/list",
			Method:  "GET",
			Handler: worker.nacosInstanceList,
		},
		{
			Path:    meshNacosPrefix + "/ns/instance",
			Method:  "POST",
			Handler: worker.nacosRegister,
		},
		{
			Path:    meshNacosPrefix + "/ns/instance",
			Method:  "DELETE",
			Handler: worker.emptyHandler,
		},
		{
			Path:    meshNacosPrefix + "/ns/instance/beat",
			Method:  "PUT",
			Handler: worker.emptyHandler,
		},
		{
			Path:    meshNacosPrefix + "/ns/instance",
			Method:  "PUT",
			Handler: worker.emptyHandler,
		},
		{
			Path:    meshNacosPrefix + "/ns/instance",
			Method:  "GET",
			Handler: worker.nacosInstance,
		},
		{
			Path:    meshNacosPrefix + "/ns/service/list",
			Method:  "GET",
			Handler: worker.nacosServiceList,
		},
		{
			Path:    meshNacosPrefix + "/ns/service",
			Method:  "GET",
			Handler: worker.nacosService,
		},
	}

	return APIs
}

func (worker *Worker) nacosRegister(w http.ResponseWriter, r *http.Request) {
	err := worker.registryServer.CheckRegistryURL(w, r)
	if err != nil {
		api.HandleAPIError(w, r, http.StatusBadRequest,
			fmt.Errorf("parse request url parameters failed: %v", err))
		return
	}

	serviceSpec := worker.service.GetServiceSpec(worker.serviceName)
	if serviceSpec == nil {
		err := fmt.Errorf("registry to unknown service: %s", worker.serviceName)
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}

	worker.registryServer.Register(serviceSpec, worker.ingressServer.Ready, worker.egressServer.Ready)
}

func (worker *Worker) nacosInstanceList(w http.ResponseWriter, r *http.Request) {
	serviceName := chi.URLParam(r, "serviceName")
	if len(serviceName) == 0 {
		api.HandleAPIError(w, r, http.StatusBadRequest,
			fmt.Errorf("empty serviceName in url parameters"))
		return
	}
	serviceName, err := worker.registryServer.SplitNacosServiceName(serviceName)
	if err != nil {
		logger.Errorf("nacos invalid servicename: %s", serviceName)
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}
	var serviceInfo *registrycenter.ServiceRegistryInfo

	if serviceInfo, err = worker.registryServer.DiscoveryService(serviceName); err != nil {
		logger.Errorf("discovery service: %s, err: %v ", serviceName, err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}

	nacosSvc := worker.registryServer.ToNacosService(serviceInfo)

	buff := codectool.MustMarshalJSON(nacosSvc)
	worker.writeJSONBody(w, buff)
}

func (worker *Worker) nacosInstance(w http.ResponseWriter, r *http.Request) {
	serviceName := chi.URLParam(r, "serviceName")
	if len(serviceName) == 0 {
		api.HandleAPIError(w, r, http.StatusBadRequest,
			fmt.Errorf("empty serviceName in url parameters"))
		return
	}
	serviceName, err := worker.registryServer.SplitNacosServiceName(serviceName)
	if err != nil {
		logger.Errorf("nacos invalid servicename: %s", serviceName)
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}
	var serviceInfo *registrycenter.ServiceRegistryInfo

	if serviceInfo, err = worker.registryServer.DiscoveryService(serviceName); err != nil {
		logger.Errorf("discovery service: %s, err: %v ", serviceName, err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}

	nacosIns := worker.registryServer.ToNacosInstanceInfo(serviceInfo)

	buff := codectool.MustMarshalJSON(nacosIns)
	worker.writeJSONBody(w, buff)
}

func (worker *Worker) nacosServiceList(w http.ResponseWriter, r *http.Request) {
	var (
		err          error
		serviceInfos []*registrycenter.ServiceRegistryInfo
	)
	if serviceInfos, err = worker.registryServer.Discovery(); err != nil {
		logger.Errorf("discovery services err: %v ", err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}
	serviceList := worker.registryServer.ToNacosServiceList(serviceInfos)

	buff := codectool.MustMarshalJSON(serviceList)
	worker.writeJSONBody(w, buff)
}

func (worker *Worker) nacosService(w http.ResponseWriter, r *http.Request) {
	serviceName := chi.URLParam(r, "serviceName")
	if len(serviceName) == 0 {
		api.HandleAPIError(w, r, http.StatusBadRequest,
			fmt.Errorf("empty serviceName in url parameters"))
		return
	}
	serviceName, err := worker.registryServer.SplitNacosServiceName(serviceName)
	if err != nil {
		logger.Errorf("nacos invalid servicename: %s", serviceName)
		api.HandleAPIError(w, r, http.StatusBadRequest, err)
		return
	}

	var serviceInfo *registrycenter.ServiceRegistryInfo
	if serviceInfo, err = worker.registryServer.DiscoveryService(serviceName); err != nil {
		logger.Errorf("discovery service: %s, err: %v ", serviceName, err)
		api.HandleAPIError(w, r, http.StatusInternalServerError, err)
		return
	}

	nacosSvcDetail := worker.registryServer.ToNacosServiceDetail(serviceInfo)

	buff := codectool.MustMarshalJSON(nacosSvcDetail)
	worker.writeJSONBody(w, buff)
}

```

### Core Architecture Module: `pkg/object/meshcontroller/worker/egress.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package worker

import (
	"fmt"
	"sync"

	"github.com/megaease/easegress/v2/pkg/object/httpserver/routers"

	"github.com/megaease/easegress/v2/pkg/logger"
	"github.com/megaease/easegress/v2/pkg/object/httpserver"
	"github.com/megaease/easegress/v2/pkg/object/meshcontroller/informer"
	"github.com/megaease/easegress/v2/pkg/object/meshcontroller/service"
	"github.com/megaease/easegress/v2/pkg/object/meshcontroller/spec"
	"github.com/megaease/easegress/v2/pkg/object/meshcontroller/storage"
	"github.com/megaease/easegress/v2/pkg/object/trafficcontroller"
	"github.com/megaease/easegress/v2/pkg/supervisor"
	"github.com/megaease/easegress/v2/pkg/util/codectool"
)

const egressRPCKey = "X-Mesh-Rpc-Service"

type (
	// EgressServer manages one/many ingress pipelines and one HTTPServer
	EgressServer struct {
		super     *supervisor.Supervisor
		superSpec *supervisor.Spec

		pipelines  map[string]*supervisor.ObjectEntity
		httpServer *supervisor.ObjectEntity

		tc         *trafficcontroller.TrafficController
		namespace  string
		inf        informer.Informer
		instanceID string

		chReloadEvent chan struct{}

		serviceName      string
		egressServerName string
		service          *service.Service
		mutex            sync.RWMutex
	}

	httpServerSpecBuilder struct {
		Kind            string `json:"kind"`
		Name            string `json:"name"`
		httpserver.Spec `json:",inline"`
		Cert            *spec.Certificate `json:"-"`
	}
)

// NewEgressServer creates an initialized egress server
func NewEgressServer(superSpec *supervisor.Spec, super *supervisor.Supervisor,
	serviceName, instanceID string, service *service.Service,
) *EgressServer {
	entity, exists := super.GetSystemController(trafficcontroller.Kind)
	if !exists {
		panic(fmt.Errorf("BUG: traffic controller not found"))
	}

	tc, ok := entity.Instance().(*trafficcontroller.TrafficController)
	if !ok {
		panic(fmt.Errorf("BUG: want *TrafficController, got %T", entity.Instance()))
	}

	inf := informer.NewInformer(storage.New(superSpec.Name(), super.Cluster()), serviceName)

	return &EgressServer{
		super:     super,
		superSpec: superSpec,

		inf:         inf,
		tc:          tc,
		namespace:   superSpec.Name(),
		pipelines:   make(map[string]*supervisor.ObjectEntity),
		serviceName: serviceName,
		service:     service,
		instanceID:  instanceID,

		chReloadEvent: make(chan struct{}, 1),
	}
}

func newHTTPServerSpecBuilder(httpServerName string, spec *httpserver.Spec) *httpServerSpecBuilder {
	return &httpServerSpecBuilder{
		Kind: httpserver.Kind,
		Name: httpServerName,
		Spec: *spec,
	}
}

func (b *httpServerSpecBuilder) jsonConfig() string {
	buff, err := codectool.MarshalJSON(b)
	if err != nil {
		logger.Errorf("BUG: marshal %#v to json failed: %v", b, err)
	}
	return string(buff)
}

// InitEgress initializes the Egress HTTPServer.
func (egs *EgressServer) InitEgress(service *spec.Service) error {
	egs.mutex.Lock()
	defer egs.mutex.Unlock()

	if egs.httpServer != nil {
		return nil
	}

	egs.egressServerName = service.SidecarEgressServerName()
	admSpec := egs.superSpec.ObjectSpec().(*spec.Admin)
	superSpec, err := service.SidecarEgressHTTPServerSpec(admSpec.WorkerSpec.Egress.KeepAlive, admSpec.WorkerSpec.Egress.KeepAliveTimeout)
	if err != nil {
		return err
	}

	entity, err := egs.tc.CreateTrafficGateForSpec(egs.namespace, superSpec)
	if err != nil {
		return fmt.Errorf("create http server %s failed: %v", superSpec.Name(), err)
	}
	egs.httpServer = entity

	if err := egs.inf.OnAllServiceSpecs(egs.reloadBySpecs); err != nil {
		// only return err when its type is not `AlreadyWatched`
		if err != informer.ErrAlreadyWatched {
			logger.Errorf("add service spec watching service: %s failed: %v", service.Name, err)
			return err
		}
	}

	if err := egs.inf.OnAllServiceInstanceSpecs(egs.reloadByInstances); err != nil {
		if err != informer.ErrAlreadyWatched {
			logger.Errorf("add service instance spec watching service: %s failed: %v", service.Name, err)
			return err
		}
	}

	if admSpec.EnablemTLS() {
		logger.Infof("egress in mtls mode, start listen ID: %s's cert", egs.instanceID)
		if err := egs.inf.OnServerCert(egs.serviceName, egs.instanceID, egs.reloadByCert); err != nil {
			if err != informer.ErrAlreadyWatched {
				logger.Errorf("add server cert spec watching service: %s failed: %v", service.Name, err)
				return err
			}
		}
	}

	if err := egs.inf.OnAllHTTPRouteGroupSpecs(egs.reloadByHTTPRouteGroups); err != nil {
		// only return err when its type is not `AlreadyWatched`
		if err != informer.ErrAlreadyWatched {
			logger.Errorf("add HTTP route group spec watching service: %s failed: %v", service.Name, err)
			return err
		}
	}

	if err := egs.inf.OnAllTrafficTargetSpecs(egs.reloadByTrafficTargets); err != nil {
		// only return err when its type is not `AlreadyWatched`
		if err != informer.ErrAlreadyWatched {
			logger.Errorf("add traffic target spec watching service: %s failed: %v", service.Name, err)
			return err
		}
	}

	if err := egs.inf.OnAllServiceCanaries(egs.reloadByServiceCanaries); err != nil {
		if err != informer.ErrAlreadyWatched {
			logger.Errorf("add service canary watching service: %s failed: %v", service.Name, err)
			return err
		}
	}

	go egs.watch()

	return nil
}

// Ready checks Egress HTTPServer has been created or not.
// Not need to check pipelines, cause they will be dynamically added.
func (egs *EgressServer) Ready() bool {
	egs.mutex.RLock()
	defer egs.mutex.RUnlock()
	return egs._ready()
}

func (egs *EgressServer) _ready() bool {
	return egs.httpServer != nil
}

func (egs *EgressServer) reloadByCert(event informer.Event, value *spec.Certificate) bool {
	select {
	case egs.chReloadEvent <- struct{}{}:
	default:
	}
	return true
}

func (egs *EgressServer) reloadByInstances(value map[string]*spec.ServiceInstanceSpec) bool {
	select {
	case egs.chReloadEvent <- struct{}{}:
	default:
	}
	return true
}

func (egs *EgressServer) reloadBySpecs(value map[string]*spec.Service) bool {
	select {
	case egs.chReloadEvent <- struct{}{}:
	default:
	}
	return true
}

func (egs *EgressServer) reloadByHTTPRouteGroups(value map[string]*spec.HTTPRouteGroup) bool {
	select {
	case egs.chReloadEvent <- struct{}{}:
	default:
	}
	return true
}

func (egs *EgressServer) reloadByTrafficTargets(value map[string]*spec.TrafficTarget) bool {
	select {
	case egs.chReloadEvent <- struct{}{}:
	default:
	}
	return true
}

func (egs *EgressServer) reloadByServiceCanaries(value map[string]*spec.ServiceCanary) bool {
	select {
	case egs.chReloadEvent <- struct{}{}:
	default:
	}
	return true
}

func (egs *EgressServer) listTrafficTargets(lgSvcs map[string]*spec.Service) []*spec.TrafficTarget {
	var result []*spec.TrafficTarget

	tts := egs.service.ListTrafficTargets()
	for _, tt := range tts {
		// the destination service is a local or global service, which is already accessible
		if lgSvcs[tt.Destination.Name] != nil {
			continue
		}
		for _, s := range tt.Sources {
			if s.Name == egs.serviceName {
				result = append(result, tt)
				break
			}
		}
	}

	return result
}

func (egs *EgressServer) listHTTPRouteGroups(tts []*spec.TrafficTarget) map[string]*spec.HTTPRouteGroup {
	result := map[string]*spec.HTTPRouteGroup{}

	for _, tt := range tts {
		for _, r := range tt.Rules {
			if result[r.Name] != nil {
				continue
			}
			g := egs.service.GetHTTPRouteGroup(r.Name)
			if g != nil {
				result[g.Name] = g
			}
		}
	}

	return result
}

// listLocalAndGlobalServices returns services which can be accessed without a traffic control rule
func (egs *EgressServer) listLocalAndGlobalServices() map[string]*spec.Service {
	result := map[string]*spec.Service{}

	self := egs.service.GetServiceSpec(egs.serviceName)
	if self == nil {
		logger.Errorf("cannot find service: %s", egs.serviceName)
		return result
	}

	tenant := egs.service.GetTenantSpec(self.RegisterTenant)
	if tenant != nil {
		for _, name := range tenant.Services {
			if name == egs.serviceName {
				continue
			}

			spec := egs.service.GetServiceSpec(name)
			if spec != nil {
				result[name] = spec
			}
		}
	}

	if self.RegisterTenant == spec.GlobalTenant {
		return result
	}

	tenant = egs.service.GetTenantSpec(spec.GlobalTenant)
	if tenant == nil {
		return result
	}

	for _, name := range tenant.Services {
		if name == egs.serviceName {
			continue
		}
		if result[name] != nil {
			continue
		}
		spec := egs.service.GetServiceSpec(name)
		if spec != nil {
			result[name] = spec
		}
	}

	return result
}

func (egs *EgressServer) listServiceOfTrafficTarget(tts []*spec.TrafficTarget) map[string]*spec.Service {
	result := map[string]*spec.Service{}

	for _, tt := range tts {
		name := tt.Destination.Name
		if result[name] != nil {
			continue
		}
		spec := egs.service.GetServiceSpec(name)
		if spec == nil {
			logger.Errorf("cannot find service %s of traffic target %s", egs.serviceName, tt.Name)
			continue
		}
		result[name] = spec
	}

	return result
}

// regex rule: ^(\w+\.)*vet-services\.(\w+)\.svc\..+$
//
//	can match e.g. _tcp.vet-services.easemesh.svc.cluster.local
//	 		   vet-services.easemesh.svc.cluster.local
//	 		   _zip._tcp.vet-services.easemesh.svc.com
func (egs *EgressServer) buildHostRegex(serviceName string) string {
	return `^(\w+\.)*` + serviceName + `\.(\w+)\.svc\..+`
}

func (egs *EgressServer) buildMuxRule(pipelineName, serviceName string, matches []spec.HTTPMatch) []*ro
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1170** (2024-01-28): **[Bug]: easegress-server --signal-upgrade=true panic**
  *Symptoms*:  - Easegress v2.6.4 - 22.04.1-Ubuntu x86_64  ---  When I reload the easegress-server with command `easegress-server --signal-upgrade=true`. It will panic.  ``` panic: close of closed channel  goroutine 1 [running]: github.com/megaease/easegress/v2/pkg/api.(*dynamicMux).close(...)         github.com/megaease/easegress/v2/pkg/api/dynamicmux.go:139 github.com/megaease/easegress/v2/pkg/api.(*Server).Close(0xc000401900, 0x0?)         github.com/megaease/easegress/v2/pkg/api/server.go:131 +0x111 github.com/megaease/easegress/v2/cmd.RunServer()         github.com/megaease/easegress/v2/cmd/server.go:142 +0x78a main.main()         github.com/megaease/easegress/v2/cmd/server/main.go:27 +0x17 ```
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for you report, we will check what happens here...
  > Fixed

- **Issue #1108** (2023-12-15): **[Bug]: Easegress obejct status api prefix issue**
  *Symptoms*: Since Easegress support multi node. When call `/status/objects/{name}` api, Easegress use prefix to fetch status from all node.   For example, when call `/status/objects/httpserver-demo` it will return `/status/objects/httpserver-demo/node1` and `/status/objects/httpserver-demo/node2`.   But if there is a object called `/status/objects/httpserver-demo-123`, when call  `/status/objects/httpserver-demo`, it will return `/status/objects/httpserver-demo/node1`, `/status/objects/httpserver-demo/node2`, `/status/objects/httpserver-demo-123/node1`, `/status/objects/httpserver-demo-123/node2`.   To solve this problem, we should use `/status/objects/httpserver-demo/` as prefix not `/status/objects/httpserver-demo`. Add `/` to the end.

- **Issue #1019** (2023-06-21): **[Bug]: wrong version of slim-sprig**
  *Symptoms*: **Describe the bug** I think easegress used the wrong version of [slim-sprig](https://github.com/go-task/slim-sprig). v2.20.0 is an old version, in which the "get" API was not even available for dict. Therefore, this will affect obtaining the `data` in the pipeline.  **To Reproduce** Just try using `get $.data.PIPELINE` in v2.4.1 or later  
  **Post-Mortem & Fix Analysis**:
  > hi @hexinzhe , I checked `go.mod` and think we are using the correct version of `slim-sprig`.  could you please provide the full yaml configuration of your pipeline and the detailed error message?
  > Just check https://github.com/go-task/slim-sprig/blob/v2.20.0/dict.go and https://github.com/go-task/slim-sprig/blob/master/dict.go, the `get` function in version v2.20.0 does not exist. 
  > @localvar   ```yaml name: fallback kind: Pipeline flow:   - filter: proxy     jumpIf:       serverError: errResponse       "": END   - filter: errResponse filters:   - name: proxy     kind: Proxy     pools:       - servers:           - url: {PROXY_SERVER}    - name: errResponse     kind: ResponseBuilder     template: |       {{ $url := "null" }}       {{- range $k, $v := .requests.DEFAULT.Header -}}       {{$value := index $v 0}}       {{- if (regexMatch "^[0-9a-zA-Z].*"  $value) }}       {{- if (eq "server-name" (lower $k)) }}       {{ $u := get $.data.PIPELINE $value }}       {{ $url = $u.redirect }}       {{- end -}}       {{- end -}}       {{- end -}}       {{log "info" (printf "fallback to %s%s?%s" $url .requests.DEFAULT.URL.Path .requests.DEFAULT.URL.RawQuery)}}              statusCode: 302       headers:         Location: ["{{$url}}{{.requests.DEFAULT.URL.Path}}?{{.requests.DEFAULT.URL.RawQuery}}"]   - name: defaultResponse     kind: Response

- **Issue #981** (2023-05-04): **[Bug]: The WebSocketProxy Filter does not work**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  Using `curl` to send a request will get a successful response by following the [WebSocket Cookbook](https://github.com/megaease/easegress/blob/main/doc/cookbook/websocket.md)   But after a real WebSocket server and client are deployed, the connection is not established.  The error in easegress's log:  > ERROR   httpproxy/wspool.go:183 websocketproxy#wsproxy#main: dial to ws://127.0.0.1:8765 failed: websocket.Dial ws://127.0.0.1:8765/ws: unsupported extensions    **To Reproduce** Steps to reproduce the behavior:  1. WebSocket server: ```python import asyncio import websockets  async def hello(websocket, path):     name = await websocket.recv()     print(f"Greetings {name}!")      greeting = f"Hello {name}!"     await websocket.send(greeting)  start_server = websockets.serve(hello, "localhost", 8765)  asyncio.get_event_loop().run_until_complete(start_server) asyncio.get_event_loop().run_forever() ``` 2. Websocket Client:  ```python import asyncio import websockets  async def hello():     async with websockets.connect("ws://localhost:8765/ws") as websocket:         name = "John"         await websocket.send(name)         greeting = await websocket.recv()         print(f"{greeting}")  asyncio.get_event_loop().run_until_complete(hello()) ```  the client was verified by sending to the server directly and through an Nginx reverse proxy.  4. config a Easegress ht

- **Issue #938** (2023-03-03): **[Bug]: wasm apply data command not worked**
  *Symptoms*: **Describe the bug** Hi guys, I found two kind of issues when walking through our [Flash Sale](https://github.com/megaease/easegress/blob/main/doc/cookbook/flash-sale.md) demo.  **Issue 1:** Parameters' type error in section 6.1 example spec  According to WasmHost filter's spec declaration, [parameters](https://github.com/megaease/easegress/blob/main/pkg/filters/wasmhost/wasmhost.go#L94)' value type should be `string`:  ```go type Spec struct {      Parameters     map[string]string `json:"parameters" jsonschema:"omitempty"`  } ```  But the example in section [6.1 Parameters](https://github.com/megaease/easegress/blob/main/doc/cookbook/flash-sale.md#61-parameters) used a number value: ```yaml filters:   - name: wasm     kind: WasmHost     parameters:                                        # +       startTime: "2021-08-08T00:00:00+00:00"           # +       blockRatio: 0.4                                  # +       maxPermission: 3                                 # + ``` So `egctl` client returned error: ```shell Error: 400: {"generalErrs":["*pipeline.Spec: filters: json: cannot unmarshal number into Go struct field Spec.parameters of type string"]} ``` ---  **Issue 2:** Wasm `apply-data` command not worked  When executing the command below, I got this error: ```shell $ echo ' id/user4: "true" id/user5: "true"' | egctl wasm apply-data flash-sale-pipeline wasm Error: name is empty: id/user4: "true" id/user5: "true" ```  I found that we 

- **Issue #908** (2023-01-28): **[Bug]: API Aggregation cookbook examples not work for me.**
  *Symptoms*: **Describe the bug** Hi there, I have some trouble when walking through our API Aggregation cookbook. Need HELP! 🆘   There's two kind of problems:  **Problem 1** In scenario 1 and 2, when using example specs, I got this error: ``` 2023-01-28T13:37:57.542+08:00   WARN    builder/responsebuilder.go:131  ResponseBuilder(buildResponse): failed to build response info: yaml: line 1: did not find expected key 2023-01-28T13:37:57.542+08:00   ERROR   httpserver/mux.go:225   server-demo: response is nil ``` And I found that, in line `pkg/filters/builder/builder.go:65`, the result which should be unmarshaled was an invalid YAML data: ``` statusCode: 200 body: "[{"mega":"ease"}, {"hello":"world"}, {"hello":"new world"}]" ----------^ ```` After changing the ResponseBuilder template like this: ```diff diff --git a/doc/cookbook/api-aggregation.md b/doc/cookbook/api-aggregation.md index 4107e7c0..e980c73a 100644 --- a/doc/cookbook/api-aggregation.md +++ b/doc/cookbook/api-aggregation.md @@ -68,7 +68,8 @@ filters:    kind: ResponseBuilder    template: |      statusCode: 200 -    body: "[{{.responses.demo1.Body}}, {{.responses.demo2.Body}}, {{.responses.demo3.Body}}]" +    body: | +      [{{.responses.demo1.Body}}, {{.responses.demo2.Body}}, {{.responses.demo3.Body}}]  @@ -147,7 +148,8 @@ filters:    kind: ResponseBuilder    template: |      statusCode: 200 -    body: "{{mergeObject .responses.demo1.JSONBody .responses.demo2.JSONBody .responses.demo3.JSONBod
  **Post-Mortem & Fix Analysis**:
  > Thanks @grootpiano for pointing these issues out, and much appreciate if you could submit a PR to fix them.
  > > Thanks @grootpiano for pointing these issues out, and much appreciate if you could submit a PR to fix them.  That's so sure. It's my pleasure! Waiting, the PR is on the way. 🏃 

- **Issue #850** (2022-11-08): **[Bug]: codectool duplicate Unmarshal json**
  *Symptoms*: **Describe the bug**  I found duplicate Unmarshal in the course of reading the code  branch: master commit: b7ba81d9 path : `github.com/megaease/easegress/pkg/util/codectool`  ``` go // Unmarshal wraps json.Unmarshal. // It will convert yaml to json before unmarshal. // Since json is a subset of yaml, passing json through this method should be a no-op. func Unmarshal(data []byte, v interface{}) error { 	data, err := yamljsontool.YAMLToJSON(data) 	if err != nil { 		return fmt.Errorf("%s: convert yaml to json failed: %v", data, err) 	} 	json.Unmarshal(data, v)  	return json.Unmarshal(data, v) } ```  

- **Issue #800** (2022-09-22): **[Bug]: EaseMonitorMetrics Status error**
  *Symptoms*: **Describe the bug** I need to send the monitoring data to Kafka, but I find that it is not sent successfully  ```  - kafka:     brokers:         - 127.0.0.1:9092     topic: metrics   kind: EaseMonitorMetrics   name: easemonitor-metrics-example   version: easegress.megaease.com/v2  ```  When I change the following code (statussynccontroller.go)   ``` 					su := newStatusUnit(namespace, trafficObject.Name, 						unixTimestamp, trafficObject.TrafficObjectStatus)  ``` into  ``` 					su := newStatusUnit(namespace, trafficObject.Name, 						unixTimestamp, trafficObject.TrafficObjectStatus.Status) // change ```  The problem is solved  Hopefully it will be validated and submitted to new code    --- Thanks for contributing 🎉! 
  **Post-Mortem & Fix Analysis**:
  > Thanks a lot for your issue.  It seems `EaseMonitorMetrics` only send status that implement `easemonitor.Metricer` interface to kafka backend. So for `trafficObject.TrafficObjectStatus` not implement this interface, but  `trafficObject.TrafficObjectStatus.Status` implements this interface.   Compare to change  ``` su := newStatusUnit(namespace, trafficObject.Name, 						unixTimestamp, trafficObject.TrafficObjectStatus.Status) ``` I prefer to implement `easemonitor.Metricer` to `trafficObject.TrafficObjectStatus`, so it will not influence previous code and solve this problem.  ``` func (s *TrafficObjectStatus) ToMetrics(service string) []*easemonitor.Metrics { 	metricer, ok := s.Status.(easemonitor.Metricer) 	if !ok { 		return nil 	} 	return metricer.ToMetrics(service) } ``` Any idea here?
  > good，Thanks 

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

### Incident Patch 1: `3fd0fa89` (2026-06-04)
**Commit Message**: fix: build/package/Dockerfile.builder to reduce vulnerabilities (#1519)

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-ALPINE323-OPENSSL-15993266
- https://snyk.io/vuln/SNYK-ALPINE323-OPENSSL-15993266
- https://snyk.io/vuln/SNYK-ALPINE323-OPENSSL-15993253
- https://snyk.io/vuln/SNYK-ALPINE323-OPENSSL-15993258
- https://snyk.io/vuln/SNYK-ALPINE323-OPENSSL-15993259

Co-authored-by: snyk-bot <[REDACTED_EMAIL]>

**File**: `build/package/Dockerfile.builder` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-FROM golang:1.26.1-alpine
+FROM golang:1.26.4-alpine
 RUN apk --no-cache add make git
```

---

### Incident Patch 2: `b6be769f` (2026-05-29)
**Commit Message**: fix(grpcproxy): do not degrade pool on gRPC application-level errors (fixes #1517) (#1518)

* fix(grpcproxy): do not degrade pool on gRPC application-level errors

When a backend service returns a well-formed gRPC status error (e.g.
NOT_FOUND / codes.Code 5, INVALID_ARGUMENT, etc.) biTransportProxy()
was calling svr.close(resultServerError), which marked the connection
as broken and removed it from the pool.  The next call then blocked
indefinitely on pool.borrow() until the outer context deadline fired.

Root cause:
  biTransport() compared s2cErr != io.EOF and returned resultServerError
  for every non-EOF, including valid gRPC status errors.  A gRPC status
  error indicates the backend communicated an application result over a
  healthy connection; it is not a transport failure.

Fix:
  Use status.FromError() to distinguish the two cases:
  - ok == true  → valid gRPC status, connection healthy → return nil
  - ok == false → transport failure (broken pipe, TLS reset, etc.)
                 → return resultServerError as before

Example failure sequence this fixes:
  1. Call A → backend returns NOT_FOUND → biTransport marks pool entry
     resultServerError → pool.borrow() has noth

**File**: `pkg/filters/proxies/grpcproxy/pool.go` (modified, +14/-0)
```diff
@@ -366,6 +366,20 @@ func (sp *ServerPool) biTransport(ctx *serverPoolContext, proxyAsClientStream gr
 			ctx.resp.SetTrailer(grpcprot.NewTrailer(proxyAsClientStream.Trailer()))
 			// c2sErr will contain RPC error from client code. If not io.EOF return the RPC error as server stream error.
 			if s2cErr != io.EOF {
+				// A well-formed gRPC status error means the backend communicated an
+				// application-level result (e.g. NOT_FOUND, INVALID_ARGUMENT) over a
+				// healthy connection. Marking the pool entry as resultServerError in
+				// that case degrades a perfectly usable backend connection and causes
+				// subsequent calls to stall waiting on pool.borrow(). Only return
+				// resultServerError for transport-level failures (non-gRPC errors)
+				// where the connection itself is broken.
+				if st, isGRPCStatus := status.FromError(s2cErr); isGRPCStatus {
+					// Preserve the backend's gRPC status so the caller receives the
+					// correct code (e.g. NOT_FOUND, INVALID_ARGUMENT). The connection
+					// itself is healthy so we still return nil to avoid pool degradation.
+					ctx.resp.SetStatus(st)
+					return nil
+				}
 				return serverPoolError{status.Convert(s2cErr), resultServerError}
 			}
 			return nil
```

**File**: `pkg/filters/proxies/grpcproxy/pool_test.go` (modified, +117/-0)
```diff
@@ -19,6 +19,7 @@ package grpcproxy
 
 import (
 	"context"
+	"io"
 	"math/rand"
 	"sync"
 	"testing"
@@ -28,7 +29,9 @@ import (
 	"github.com/megaease/easegress/v2/pkg/filters/proxies"
 	"github.com/megaease/easegress/v2/pkg/util/objectpool"
 	"github.com/stretchr/testify/assert"
+	"google.golang.org/grpc"
 	"google.golang.org/grpc/codes"
+	"google.golang.org/grpc/metadata"
 	"google.golang.org/grpc/status"
 )
 
@@ -241,3 +244,117 @@ name: grpcforwardproxy
 	request.Header().Set("targetAddress", "192.168.1.1")
 	at.Equal("", proxy.mainPool.getTarget(proxy.mainPool.LoadBalancer().ChooseServer(request).URL))
 }
+
+// biTransportClientStream is a minimal grpc.ClientStream that returns a
+// predetermined error from RecvMsg and blocks the caller until the provided
+// done channel is closed.
+type biTransportClientStream struct {
+	grpc.ClientStream
+	recvErr error
+}
+
+func (m *biTransportClientStream) Header() (metadata.MD, error)  { return metadata.New(nil), nil }
+func (m *biTransportClientStream) Trailer() metadata.MD          { return metadata.New(nil) }
+func (m *biTransportClientStream) CloseSend() error              { return nil }
+func (m *biTransportClientStream) Context() context.Context      { return context.Background() }
+func (m *biTransportClientStream) SendMsg(msg interface{}) error { return nil }
+func (m *biTransportClientStream) RecvMsg(msg interface{}) error { return m.recvErr }
+
+// biTransportServerStream is a minimal grpc.ServerStream whose RecvMsg blocks
+// until the done channel is closed, simulating a client that has not finished
+// sending. This prevents the c2sErrChan from racing with s2cErrChan in tests.
+type biTransportServerStream struct {
+	grpc.ServerStream
+	done <-chan struct{}
+}
+
+func (m *biTransportServerStream) Context() context.Context        { return context.Background() }
+func (m *biTransportServerStream) SetHeader(md metadata.MD) error  { return nil }
+func (m *biTransportServerStream) SendHeader(md metadata.MD) error { return nil }
+func (m *biTransportServerStream) SetTrailer(md metadata.MD)       {}
+func (m *biTransportServerStream) SendMsg(msg interface{}) error   { return nil }
+func (m *biTransportServerStream) RecvMsg(msg interface{}) error {
+	<-m.done
+	return io.EOF
+}
+
+// TestBiTransportDoesNotDegradePoolOnGRPCAppError verifies that biTransport
+// returns nil (no pool degradation) when the backend responds with a valid
+// gRPC application-level status (e.g. NOT_FOUND, codes.Code 5). Previously,
+// any non-EOF error from the backend would call svr.close(resultServerError),
+// degrading the pool and causing subsequent calls to stall on pool.borrow().
+func TestBiTransportDoesNotDegradePoolOnGRPCAppError(t *testing.T) {
+	sp := &ServerPool{}
+
+	cases := []struct {
+		name     string
+		err      error
+		wantNil  bool
+		wantCode codes.Code // non-OK: assert spCtx.resp carries this status; OK means skip (e.g. io.EOF)
+	}{
+		{
+			name:     "NOT_FOUND is an application error — pool must not degrade",
+			err:      status.Error(codes.NotFound, "resource not found"),
+			wantNil:  true,
+			wantCode: codes.NotFound,
+		},
+		{
+			name:     "INVALID_ARGUMENT is an application error — pool must not degrade",
+			err:      status.Error(codes.InvalidArgument, "bad request"),
+			wantNil:  true,
+			wantCode: codes.InvalidArgument,
+		},
+		{
+			name:     "INTERNAL is a server-side gRPC error — pool must not degrade",
+			err:      status.Error(codes.Internal, "internal error"),
+			wantNil:  true,
+			wantCode: codes.Internal,
+		},
+		{
+			name:    "io.EOF is the happy-path completion — pool must not degrade",
+			err:     io.EOF,
+			wantNil: true,
+			// wantCode left as codes.OK — no status assertion for the normal success path
+		},
+		{
+			name:    "plain transport error — pool should degrade",
+			err:     io.ErrUnexpectedEOF,
+			wantNil: false,
+		},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			done := make(chan struct{})
+			defer close(done)
+
+			clientStream := &biTransportClientStream{recvErr: tc.err}
+			serverStream := &biTransportServerStream{done: done}
+
+			spCtx := &serverPoolContext{
+				stdr: serverStream,
+				stdw: serverStream,
+				resp: grpcprot.NewResponse(),
+			}
+
+			result := sp.biTransport(spCtx, clientStream)
+
+			if tc.wantNil {
+				assert.Nil(t, result,
+					"biTransport should return nil for %q so the backend pool is not degraded", tc.name)
+				// For gRPC status errors the backend response code must be preserved
+				// so the caller gets NOT_FOUND/INVALID_ARGUMENT/etc., not a silent OK.
+				if tc.wantCode != codes.OK {
+					assert.Equal(t, tc.wantCode, spCtx.resp.GetStatus().Code(),
+						"backend gRPC status must be propagated to the response for %q", tc.name)
+				}
+			} else {
+				assert.NotNil(t, result,
+					"biTransport should return an error for transport failures like %q", tc.name)
+				spe, ok := result.(serverPoolError)
+				assert.True(t, ok)
+				ass
```

---

### Incident Patch 3: `592091ac` (2026-04-01)
**Commit Message**: Add KubeStellar Console guided install reference (#1514)

Add a reference to the KubeStellar Console guided installation mission
for Easegress in both the install documentation and the README Community
section. The guided experience provides step-by-step installation with
pre-flight checks, validation, troubleshooting, and rollback.

Link: https://console.kubestellar.io/missions/install-easegress

Signed-off-by: Andrew Anderson <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +4/-0)
```diff
@@ -219,6 +219,10 @@ For full list, see [Tutorials](docs/02.Tutorials/README.md) and [Cookbook](docs/
 - [Join Slack Workspace](https://cloud-native.slack.com/messages/easegress) for requirement, issue and development.
 - [MegaEase on Twitter](https://twitter.com/megaease)
 
+### Community Tools
+
+- [KubeStellar Console Guided Install](https://console.kubestellar.io/missions/install-easegress) - Step-by-step guided installation with pre-flight checks, validation, troubleshooting, and rollback.
+
 ## Contributing
 
 See [Contributing guide](./CONTRIBUTING.md#contributing). The project welcomes contributions and suggestions that abide by the [CNCF Code of Conduct](./CODE_OF_CONDUCT.md).
```

**File**: `docs/01.Getting-Started/1.2.Install.md` (modified, +8/-0)
```diff
@@ -67,3 +67,11 @@ $ /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/megaease/easegres
     ```bash
     $ docker run megaease/easegress
     ```
+
+### Guided Installation via KubeStellar Console
+
+[KubeStellar Console](https://console.kubestellar.io) offers a
+[guided installation mission for Easegress](https://console.kubestellar.io/missions/install-easegress)
+that walks you through the setup step by step. The guided experience includes
+pre-flight checks, installation validation, troubleshooting tips, and rollback
+instructions.
```

---

### Incident Patch 4: `beb02b19` (2026-03-10)
**Commit Message**: fix: build/package/Dockerfile.builder to reduce vulnerabilities (#1504)

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-ALPINE323-ZLIB-15435528
- https://snyk.io/vuln/SNYK-ALPINE323-ZLIB-15435529

Co-authored-by: snyk-bot <[REDACTED_EMAIL]>

**File**: `build/package/Dockerfile.builder` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-FROM golang:1.24-alpine
+FROM golang:1.25.4-alpine
 RUN apk --no-cache add make git
```

---

### Incident Patch 5: `a2577c8f` (2025-09-18)
**Commit Message**: fix build 32-bit machine constant overflow (#1500)

* fix build 32-bit machine constant overflow

* update goreleaser

**File**: `.goreleaser.yml` (modified, +9/-0)
```diff
@@ -21,6 +21,9 @@ builds:
     goos:
       - linux
       - darwin
+    goarch:
+      - amd64
+      - arm64
     ldflags:
       - -s -w
       - -X github.com/easegress-io/easegress/v2/pkg/version.RELEASE={{ .Tag }}
@@ -35,6 +38,9 @@ builds:
     goos:
       - linux
       - darwin
+    goarch:
+      - amd64
+      - arm64
     ldflags:
       - -s -w
       - -X github.com/easegress-io/easegress/v2/pkg/version.RELEASE={{ .Tag }}
@@ -49,6 +55,9 @@ builds:
     goos:
       - linux
       - darwin
+    goarch:
+      - amd64
+      - arm64
     ldflags:
       - -s -w
       - -X github.com/easegress-io/easegress/v2/pkg/version.RELEASE={{ .Tag }}
```

---

### Incident Patch 6: `10874f48` (2025-09-09)
**Commit Message**: Enhance HTTPserver to support nginx-like header vars and build-in backend pool (#1497)

* HTTPServer: Support set headers with nginx-like vars

* HTTPServer: test nginx-like vars

* HTTPServer: Implement backendPool with generating proxy pipeline

* Support labels for metadata of object

* Add httpserver owner label and fix unittest

* Fix Validate of validator spec

* Use cluster to manage generated pipeline instead traffic controller

* Forbid updating generated objects

* Update quick start to adopt backend pool in HTTPServer

* Doc: Add nginx header vars

* Doc: Update header size

* Fix unit tests

* Fix TestPathValidate

**File**: `docs/01.Getting-Started/1.1.Quick-Start.md` (modified, +47/-15)
```diff
@@ -2,11 +2,10 @@
 
 The basic usage of Easegress is to quickly set up a proxy for the backend servers.
 
-### Launch Easegress
+## Launch Easegress
 
 Easegress can be installed from pre-built binaries or from source. For details, see [Install](1.2.Install.md).
 
-
 Then we can execute the server:
 
 ```bash
@@ -17,7 +16,7 @@ $ easegress-server
 
 By default, Easegress opens ports 2379, 2380, and 2381; however, you can modify these settings along with other arguments either in the configuration file or via command-line arguments. For a complete list of arguments, please refer to the `easegress-server --help` command.
 
-After launching successfully, we could check the status of the one-node cluster. 
+After launching successfully, we could check the status of the one-node cluster.
 
 ```bash
 $ egctl get member
@@ -27,40 +26,72 @@ $ egctl describe member
 ...
 ```
 
-### Reverse Proxy
+## Reverse Proxy
 
 Assuming you have two backend HTTP services running at `127.0.0.1:9095` and `127.0.0.1:9096`, you can initiate an HTTP proxy from port 10080 to these backends using the following command:
 
 ```bash
-$ egctl create httpproxy demo --port 10080 \ 
+$ egctl create httpproxy demo --port 10080 \
   --rule="/pipeline=http://127.0.0.1:9095,http://127.0.0.1:9096" \
   --rule="/prefix*=http://127.0.0.1:9097"
 ```
 
 Then try it:
+
 ```bash
-$ curl -v 127.0.0.1:10080/pipeline
+curl -v 127.0.0.1:10080/pipeline
 ```
 
 The request will be forwarded to either `127.0.0.1:9095/pipeline` or `127.0.0.1:9096/pipeline`, utilizing a round-robin load-balancing policy.
 
 ```bash
-$ curl -v 127.0.0.1:10080/prefix/123
+curl -v 127.0.0.1:10080/prefix/123
 ```
-The request will be forwarded to `127.0.0.1:9097/prefix/123`. 
 
+The request will be forwarded to `127.0.0.1:9097/prefix/123`.
+
+## YAML Configuration
 
-### YAML Configuration
+The `egctl create httpproxy` command is convenient, but for production use, you'll want more control. Easegress uses two main resources: **HTTPServer** (handles incoming requests) and **Pipeline** (processes and routes requests).
 
-The `egctl create httpproxy` command mentioned above is actually syntactic sugar; it creates two Easegress resources under the hood: `HTTPServer` and `Pipeline`.
+### Method 1: HTTPServer with Built-in Backend Pool
 
-Now let's create them using yaml files:
+This approach automatically creates pipelines for you:
+
+```bash
+$ echo 'kind: HTTPServer
+name: demo-backend-pool
+port: 10080
+https: false
+rules:
+  - paths:
+    - pathPrefix: /demo0
+      backendPool:
+        loadBalance:
+          policy: roundRobin
+        servers:
+            - url: http://127.0.0.1:9091
+            - url: http://127.0.0.1:9092
+    - pathPrefix: /demo1
+      backendPool:
+        loadBalance:
+          policy: roundRobin
+        servers:
+            - url: http://127.0.0.1:9093
+            - url: http://127.0.0.1:9094' | egctl create -f -
+```
+
+It will generate one pipeline for each backendPool. For example, `demo-backend-pool` generates pipeline`GENERATED-demo-backend-pool-0-0` and `GENERATED-demo-backend-pool-0-1` which couldn't be updated or deleted via `egctl` (User APIs).
+
+### Method 2: HTTPServer with Separate Pipelines
+
+Create HTTPServer:
 
 ```bash
 $ echo '
 kind: HTTPServer
-name: demo
-port: 10080
+name: demo-backend
+port: 10081
 https: false
 rules:
   - paths:
@@ -69,7 +100,8 @@ rules:
     - pathPrefix: /prefix
       backend: demo-1 ' | egctl create -f -
 ```
-More details about [HTTPServer](../02.Tutorials/2.2.HTTP-Proxy-Usage.md).
+
+Create the Pipelines:
 
 ```bash
 $ echo '
@@ -98,7 +130,7 @@ filters:
     - servers:
       - url: http://127.0.0.1:9097' | egctl create -f -
 ```
+
 More details about [Pipeline](../02.Tutorials/2.3.Pipeline-Explained.md).
 
 You can also modify, update, or delete these resources using `egctl`; for more details, refer to the [egctl usage](../02.Tutorials/2.1.egctl-Usage.md) guide.
-
```

**File**: `docs/02.Tutorials/2.11.Nginx-Header-Vars.md` (added, +396/-0)
```diff
@@ -0,0 +1,396 @@
+# Nginx-Style Header Variables
+
+Easegress HTTPServer supports nginx-style variables in the `setHeaders` configuration, allowing you to dynamically populate HTTP headers with request information. This feature provides powerful capabilities for debugging, logging, routing decisions, and passing contextual information to backend services.
+
+## Overview
+
+The nginx variable system in Easegress supports:
+
+- **Request line variables** (method, URI, query parameters)
+- **Host and server variables**
+- **Client information** (remote address, user agent)
+- **Time and timestamp variables**
+- **Content and protocol information**
+- **HTTP header extraction**
+- **Query parameter extraction**
+- **Cookie value extraction**
+- **Default value support** with `${variable:default}` syntax
+- **String interpolation** for building complex values
+
+Easegress adopts nginx variables as much as possible for compatibility. For a complete reference of nginx variables, see the [official nginx variable index](https://nginx.org/en/docs/varindex.html).
+
+## Variable Syntax
+
+Easegress supports two nginx-compatible variable syntaxes:
+
+```yaml
+# Simple variable reference
+X-Method: "$request_method"
+
+# Variable with default value
+X-Version: "${arg_version:v1.0}"
+
+# String interpolation
+X-Backend-URL: "${scheme}://${host}-backend${uri}"
+```
+
+## Complete Example
+
+See the complete example configuration at: [`example/config/test-nginx-header-vars.yaml`](../../example/config/test-nginx-header-vars.yaml)
+
+This example demonstrates all available variable types and usage patterns.
+
+## Variable Categories
+
+### 1. Request Line Variables
+
+Extract information from the HTTP request line:
+
+| Variable | Description | Example Value |
+|----------|-------------|---------------|
+| `$request_method` | HTTP method | `GET`, `POST`, `PUT` |
+| `$request_uri` | Full request URI with query string | `/api/users?page=1` |
+| `$uri` | Path portion of URI (without query) | `/api/users` |
+| `$scheme` | Protocol scheme | `http`, `https` |
+| `$query_string` | Query string portion | `page=1&limit=10` |
+| `$args` | Alias for `$query_string` | `page=1&limit=10` |
+| `$request` | Full request line | `GET /api/users HTTP/1.1` |
+
+### 2. Host and Server Variables
+
+Information about the server and request host:
+
+| Variable | Description | Example Value |
+|----------|-------------|---------------|
+| `$host` | Host from request (without port) | `api.example.com` |
+| `$hostname` | Alias for `$host` | `api.example.com` |
+| `$http_host` | Host header value (with port) | `api.example.com:8080` |
+| `$server_name` | Server name | `api.example.com` |
+| `$server_protocol` | HTTP protocol version | `HTTP/1.1`, `HTTP/2.0` |
+
+### 3. Client Information Variables
+
+Information about the client making the request:
+
+| Variable | Description | Example Value |
+|----------|-------------|---------------|
+| `$remote_addr` | Client IP address | `192.168.1.100` |
+| `$remote_user` | Authenticated username | `john_doe` |
+| `$proxy_add_x_forwarded_for` | X-Forwarded-For with client IP | `10.0.0.1, 192.168.1.100` |
+
+### 4. Time and Timestamp Variables
+
+Current time in various formats:
+
+| Variable | Description | Example Value |
+|----------|-------------|---------------|
+| `$time_iso8601` | ISO 8601 timestamp | `2025-09-05T10:30:45+08:00` |
+| `$time_local` | Local time format | `05/Sep/2025:10:30:45 +0800` |
+| `$msec` | Timestamp in milliseconds | `1725508245123` |
+| `$request_time` | Request processing time | `0.045` |
+
+### 5. Content and Protocol Variables
+
+Information about request content:
+
+| Variable | Description | Example Value |
+|----------|-------------|---------------|
+| `$content_type` | Content-Type header | `application/json` |
+| `$content_length` | Content-Length header | `1024` |
+| `$request_length` | Total request size | `1024` |
+
+### 6. HTTP Header Variables
+
+Extract any HTTP header using the `$http_` prefix:
+
+| Variable Pattern | Description | Example |
+|------------------|-------------|---------|
+| `$http_user_agent` | User-Agent header | `Mozilla/5.0 (...)` |
+| `$http_accept` | Accept header | `application/json` |
+| `$http_x_forwarded_for` | X-Forwarded-For header | `10.0.0.1` |
+| `$http_authorization` | Authorization header | `Bearer token123` |
+| `$http_*` | Any header (replace * with header name) | Various |
+
+**Note:** Header names are converted using these rules:
+
+- Convert to lowercase
+- Replace hyphens with underscores
+- Add `http_` prefix
+
+Examples:
+
+- `Content-Type` → `$http_content_type`
+- `X-API-Key` → `$http_x_api_key`
+- `User-Agent` → `$http_user_agent`
+
+### 7. Query Parameter Variables
+
+Extract query parameters using the `$arg_` prefix:
+
+| Variable Pattern | Description | Example |
+|------------------|-------------|---------|
+| `$arg_page` | Extract `page` parameter | `1` |
+| `$arg_limit` | Extract `limit` parameter | `50` |
+| `$arg_api_k
```

**File**: `docs/02.Tutorials/README.md` (modified, +11/-7)
```diff
@@ -1,9 +1,13 @@
 # Tutorials
 
-### [egctl Usage](2.1.egctl-Usage.md)
-### [HTTP Proxy Usage](2.2.HTTP-Proxy-Usage.md)
-### [Pipeline Explained](2.3.Pipeline-Explained.md)
-### [Advanced HTTP Proxy: Resilience](2.4.Resilience.md)
-### [HTTPS & Let's Encrypt & More](2.5.Traffic-Verification.md)
-### [Websocket](2.6.Websocket.md)
-### [gRPC](2.7.gRPC.md)
\ No newline at end of file
+- [egctl Usage](2.1.egctl-Usage.md)
+- [HTTP Proxy Usage](2.2.HTTP-Proxy-Usage.md)
+- [Pipeline Explained](2.3.Pipeline-Explained.md)
+- [Advanced HTTP Proxy: Resilience](2.4.Resilience.md)
+- [Traffic Verification](2.5.Traffic-Verification.md)
+- [Websocket](2.6.Websocket.md)
+- [gRPC](2.7.gRPC.md)
+- [HTTPS & Let's Encrypt](2.8.HTTPS-Lets-Encrypt.md)
+- [AI Gateway](2.9.AI-Gateway.md)
+- [Claude Proxy](2.10.Claude-Proxy.md)
+- [Nginx Header Variables](2.11.Nginx-Header-Vars.md)
```

**File**: `example/config/test-nginx-header-vars.yaml` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+kind: HTTPServer
+name: test-nginx-header-vars
+port: 10080
+rules:
+    - paths:
+        - backendPool:
+            loadBalance:
+                policy: roundRobin
+            servers:
+                - url: http://127.0.0.1:9091
+                - url: http://127.0.0.1:9092
+                - url: http://127.0.0.1:9093
+          pathPrefix: /
+          setHeaders:
+            # Request line variables
+            X-Request-Method: "$request_method"
+            X-Request-URI: "$request_uri"
+            X-URI-Path: "$uri"
+            X-Scheme: "$scheme"
+            X-Query-String: "$query_string"
+            X-Args: "$args"
+            X-Full-Request: "$request"
+
+            # Host variables
+            X-Host: "$host"
+            X-Hostname: "$hostname"
+            X-HTTP-Host: "$http_host"
+            X-Server-Name: "$server_name"
+
+            # Remote address variables
+            X-Remote-Addr: "$remote_addr"
+            X-Remote-User: "${remote_user:anonymous}"
+            X-Proxy-Add-XFF: "$proxy_add_x_forwarded_for"
+
+            # Time variables
+            X-Time-ISO8601: "$time_iso8601"
+            X-Time-Local: "$time_local"
+            X-Time-Msec: "$msec"
+
+            # Content variables
+            X-Content-Type: "${content_type:none}"
+            X-Content-Length: "${content_length:0}"
+            X-Server-Protocol: "$server_protocol"
+            X-Request-Time: "$request_time"
+            X-Request-Length: "$request_length"
+
+            # HTTP headers examples
+            X-Original-User-Agent: "${http_user_agent:unknown}"
+            X-Original-Accept: "${http_accept:*/*}"
+            X-Original-XFF: "${http_x_forwarded_for:none}"
+            X-Original-Host: "${http_host:unknown}"
+
+            # Query parameters examples
+            X-Param-Version: "${arg_version:v1}"
+            X-Param-Debug: "${arg_debug:false}"
+            X-Param-Token: "${arg_token:none}"
+
+            # Cookie examples
+            X-Session-ID: "${cookie_session_id:no-session}"
+            X-User-Pref: "${cookie_user_pref:default}"
+
+            # Complex string building examples
+            X-Backend-URL: "${scheme}://${host}-backend${uri}"
+            X-Client-Info: "IP: ${remote_addr}, Agent: ${http_user_agent:unknown}"
+            X-Request-Info: "${request_method} ${uri}?${query_string} from ${remote_addr}"
+            X-Proxy-Chain: "Forwarded: ${proxy_add_x_forwarded_for}"
+
+            # Default value examples
+            X-API-Version: "${arg_api_version:v2}"
+            X-Client-ID: "${http_x_client_id:default-client}"
+            X-Trace-ID: "${http_x_trace_id:auto-generated}"
+
+            # Path parameters (will be populated if route has captures)
+            X-Path-ID: "${id:no-id}"
+            X-Path-Name: "${name:no-name}"
+
+            # Timestamp and protocol info
+            X-Processing-Time: "Started at ${time_iso8601} using ${server_protocol}"
+            X-Request-Summary: "Method=${request_method}, Host=${host}, Path=${uri}, Client=${remote_addr}"
```

**File**: `pkg/api/object.go` (modified, +17/-3)
```diff
@@ -142,7 +142,7 @@ func (s *Server) createObject(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 
-	if spec.Categroy() == supervisor.CategorySystemController {
+	if spec.Category() == supervisor.CategorySystemController {
 		HandleAPIError(w, r, http.StatusConflict, fmt.Errorf("can't create system controller object"))
 	}
 
@@ -186,7 +186,7 @@ func (s *Server) deleteObject(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 
-	if spec.Categroy() == supervisor.CategorySystemController {
+	if spec.Category() == supervisor.CategorySystemController {
 		HandleAPIError(w, r, http.StatusBadRequest, fmt.Errorf("can't delete system controller object"))
 		return
 	}
@@ -200,6 +200,13 @@ func (s *Server) deleteObject(w http.ResponseWriter, r *http.Request) {
 		}
 	}
 
+	objectOwner := spec.Labels()[supervisor.ObjectLabelKeyOwner]
+	if objectOwner != "" && objectOwner != supervisor.ObjectLabelValueUserAPI {
+		HandleAPIError(w, r, http.StatusBadRequest,
+			fmt.Errorf("can't delete %s owned by %s via API", name, objectOwner))
+		return
+	}
+
 	s._deleteObject(name)
 	s.upgradeConfigVersion(w, r)
 }
@@ -212,7 +219,7 @@ func (s *Server) deleteObjects(w http.ResponseWriter, r *http.Request) {
 
 		specs := s._listObjects()
 		for _, spec := range specs {
-			if spec.Categroy() == supervisor.CategorySystemController {
+			if spec.Category() == supervisor.CategorySystemController {
 				continue
 			}
 
@@ -326,6 +333,13 @@ func (s *Server) updateObject(w http.ResponseWriter, r *http.Request) {
 		}
 	}
 
+	objectOwner := spec.Labels()[supervisor.ObjectLabelKeyOwner]
+	if objectOwner != "" && objectOwner != supervisor.ObjectLabelValueUserAPI {
+		HandleAPIError(w, r, http.StatusBadRequest,
+			fmt.Errorf("can't update %s owned by %s via API", name, objectOwner))
+		return
+	}
+
 	s._putObject(spec)
 	s.upgradeConfigVersion(w, r)
 }
```

**File**: `pkg/filters/validator/validator.go` (modified, +6/-3)
```diff
@@ -19,9 +19,8 @@
 package validator
 
 import (
-	"net/http"
-
 	"fmt"
+	"net/http"
 
 	"github.com/megaease/easegress/v2/pkg/context"
 	"github.com/megaease/easegress/v2/pkg/filters"
@@ -80,7 +79,11 @@ type (
 
 // Validate verifies that at least one of the validations is defined.
 func (spec Spec) Validate() error {
-	if spec == (Spec{}) {
+	if spec.Headers == nil &&
+		spec.JWT == nil &&
+		spec.Signature == nil &&
+		spec.OAuth2 == nil &&
+		spec.BasicAuth == nil {
 		return fmt.Errorf("none of the validations are defined")
 	}
 	return nil
```

**File**: `pkg/object/httpserver/httpserver_test.go` (modified, +13/-4)
```diff
@@ -22,6 +22,7 @@ import (
 	"testing"
 	"time"
 
+	"github.com/megaease/easegress/v2/pkg/cluster"
 	"github.com/megaease/easegress/v2/pkg/context/contexttest"
 	"github.com/megaease/easegress/v2/pkg/logger"
 	"github.com/megaease/easegress/v2/pkg/option"
@@ -36,6 +37,16 @@ func TestMain(m *testing.M) {
 }
 
 func TestHTTPServer(t *testing.T) {
+	// NOTE: For loading system controller TrafficController.
+	etcdDirName, err := os.MkdirTemp("", "trafficcontroller-test")
+	if err != nil {
+		t.Error(err.Error())
+	}
+	defer os.RemoveAll(etcdDirName)
+
+	cls := cluster.CreateClusterForTest(etcdDirName)
+	supervisor.MustNew(&option.Options{}, cls)
+
 	assert := assert.New(t)
 
 	yamlConfig := `
@@ -45,9 +56,7 @@ port: 38081
 keepAlive: true
 https: false
 `
-	super := supervisor.NewMock(option.New(), nil, nil,
-		nil, false, nil, nil)
-	superSpec, err := super.NewSpec(yamlConfig)
+	superSpec, err := supervisor.NewSpec(yamlConfig)
 	assert.NoError(err)
 
 	svr := &HTTPServer{}
@@ -60,7 +69,7 @@ port: 38082
 keepAlive: true
 https: false
 `
-	superSpec, err = super.NewSpec(yamlConfig)
+	superSpec, err = supervisor.NewSpec(yamlConfig)
 	assert.NoError(err)
 	svr2 := &HTTPServer{}
 	svr2.Inherit(superSpec, svr, &contexttest.MockedMuxMapper{})
```

**File**: `pkg/object/httpserver/mux.go` (modified, +154/-3)
```diff
@@ -30,7 +30,9 @@ import (
 	"text/template"
 	"time"
 
+	"github.com/megaease/easegress/v2/pkg/filters/proxies/httpproxy"
 	"github.com/megaease/easegress/v2/pkg/object/httpserver/routers"
+	"github.com/megaease/easegress/v2/pkg/object/pipeline"
 
 	lru "github.com/hashicorp/golang-lru"
 	"github.com/megaease/easegress/v2/pkg/object/globalfilter"
@@ -42,6 +44,7 @@ import (
 	"github.com/megaease/easegress/v2/pkg/protocols/httpprot/httpstat"
 	"github.com/megaease/easegress/v2/pkg/supervisor"
 	"github.com/megaease/easegress/v2/pkg/tracing"
+	"github.com/megaease/easegress/v2/pkg/util/codectool"
 	"github.com/megaease/easegress/v2/pkg/util/fasttime"
 	"github.com/megaease/easegress/v2/pkg/util/ipfilter"
 	"github.com/megaease/easegress/v2/pkg/util/readers"
@@ -56,8 +59,9 @@ const (
 
 type (
 	mux struct {
-		httpStat *httpstat.HTTPStat
-		topN     *httpstat.TopN
+		superSpec *supervisor.Spec
+		httpStat  *httpstat.HTTPStat
+		topN      *httpstat.TopN
 
 		inst atomic.Value // *muxInstance
 	}
@@ -151,6 +155,7 @@ func newMux(httpStat *httpstat.HTTPStat, topN *httpstat.TopN,
 }
 
 func (m *mux) reload(superSpec *supervisor.Spec, muxMapper context.MuxMapper) {
+	m.superSpec = superSpec
 	spec := superSpec.ObjectSpec().(*Spec)
 
 	tracer := tracing.NoopTracer
@@ -188,7 +193,7 @@ func (m *mux) reload(superSpec *supervisor.Spec, muxMapper context.MuxMapper) {
 		tracer:             tracer,
 		accessLogFormatter: newAccessLogFormatter(spec.AccessLogFormat),
 	}
-	spec.Rules.Init()
+	spec.Rules.Init(superSpec.Name())
 	inst.router = routers.Create(routerKind, spec.Rules)
 
 	if spec.CacheSize > 0 {
@@ -198,9 +203,135 @@ func (m *mux) reload(superSpec *supervisor.Spec, muxMapper context.MuxMapper) {
 		}
 		inst.cache = arc
 	}
+
+	m.reloadBackendPipelines(superSpec)
+
 	m.inst.Store(inst)
 }
 
+func (m *mux) reloadBackendPipelines(superSpec *supervisor.Spec) {
+	spec := superSpec.ObjectSpec().(*Spec)
+
+	pipelineNames := map[string]struct{}{}
+	for ruleIndex, rule := range spec.Rules {
+		for pathIndex, path := range rule.Paths {
+			if path.BackendPool == nil {
+				continue
+			}
+
+			pipelineName := routers.GenerateBackendPoolPipeline(superSpec.Name(), ruleIndex, pathIndex)
+
+			pipelineSpec, err := m.newProxyPipelineSpec(superSpec, pipelineName, path.BackendPool)
+			if err != nil {
+				logger.Errorf("BUG: new proxy pipeline spec failed: %v", err)
+				continue
+			}
+
+			err = m._putObject(superSpec, pipelineSpec)
+			if err != nil {
+				logger.Errorf("httpserver %s put backend pipeline %s failed: %v", superSpec.Name(), pipelineName, err)
+				continue
+			}
+
+			logger.Debugf("httpserver %s apply backend pipeline %s", superSpec.Name(), pipelineName)
+			pipelineNames[pipelineName] = struct{}{}
+		}
+	}
+
+	objects, err := m._listObjects(superSpec)
+	if err != nil {
+		logger.Errorf("httpserver %s list backend pipelines failed: %v", superSpec.Name(), err)
+		return
+	}
+	for _, obj := range objects {
+		category, name, labels := obj.Category(), obj.Name(), obj.Labels()
+
+		if category != supervisor.CategoryPipeline {
+			continue
+		}
+
+		if labels[supervisor.ObjectLabelKeyOwner] != superSpec.AsOwner() {
+			continue
+		}
+
+		if _, exists := pipelineNames[name]; !exists {
+			m._deleteObject(superSpec, obj)
+			logger.Debugf("httpserver %s delete backend pipeline %s", superSpec.Name(), name)
+		}
+	}
+}
+
+func (m *mux) _putObject(superSpec *supervisor.Spec, pipelineSpec *supervisor.Spec) error {
+	cluster := superSpec.Super().Cluster()
+	err := cluster.Put(cluster.Layout().ConfigObjectKey(pipelineSpec.Name()),
+		pipelineSpec.JSONConfig())
+	return err
+}
+
+func (m *mux) _deleteObject(superSpec *supervisor.Spec, pipelineSpec *supervisor.Spec) error {
+	cluster := superSpec.Super().Cluster()
+	return cluster.Delete(cluster.Layout().ConfigObjectKey(pipelineSpec.Name()))
+}
+
+func (m *mux) _listObjects(superSpec *supervisor.Spec) ([]*supervisor.Spec, error) {
+	cluster := superSpec.Super().Cluster()
+
+	kvs, err := cluster.GetPrefix(cluster.Layout().ConfigObjectPrefix())
+	if err != nil {
+		return nil, err
+	}
+
+	specs := make([]*supervisor.Spec, 0, len(kvs))
+	for _, v := range kvs {
+		spec, err := superSpec.Super().NewSpec(v)
+		if err != nil {
+			return nil, err
+		}
+		specs = append(specs, spec)
+	}
+
+	return specs, nil
+}
+
+func (m *mux) newProxyPipelineSpec(superSpec *supervisor.Spec, pipelineName string, pool *httpproxy.ServerPoolSpec) (*supervisor.Spec, error) {
+	proxyFilterName := "proxy"
+	proxyMap := map[string]interface{}{
+		"name":  proxyFilterName,
+		"kind":  "Proxy",
+		"pools": []interface{}{pool},
+	}
+
+	pipelineMap := map[string]interface{}{
+		"kind": "Pipeline",
+		"name": pipelineName,
+		"labels": map[string]interface{}{
+			supervisor.ObjectLabelKeyOwner: superSpec.AsOwner(),
+		},
+		"createdAt": time.Now().UTC().Format(time.RFC3339Nano),
+
+		"flow": []pipeline.FlowNode{{FilterName: proxyFilterName}},
+		"filters": []map[string]interface{}{
+			proxyMap,
+		},
+	}

```

---

### Incident Patch 7: `ce7c3683` (2025-08-25)
**Commit Message**: bump go version to 1.24 and fix 1.24 go vet (#1481)

**File**: `.github/workflows/code.analysis.yml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ on:
       - ".github/workflows/code.analysis.yml"
 
 env:
-  GO_VERSION: "1.23"
+  GO_VERSION: "1.24"
 
 jobs:
   analysis:
```

**File**: `.github/workflows/golangci.lint.yml` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ on:
       - ".github/workflows/golangci.lint.yml"
 
 env:
-  GO_VERSION: "1.23"
+  GO_VERSION: "1.24"
 
 jobs:
   analysis:
```

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ on:
       - "v*"
 
 env:
-  GO_VERSION: "1.23"
+  GO_VERSION: "1.24"
 
 permissions:
   contents: write
```

**File**: `.github/workflows/test.yml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ on:
       - ".github/workflows/test.yml"
 
 env:
-  GO_VERSION: "1.23"
+  GO_VERSION: "1.24"
 
 jobs:
   test-ubuntu:
```

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ INTEGRATION_TEST_PATH := build/test
 
 # Image Name
 IMAGE_NAME?=megaease/easegress
-BUILDER_IMAGE_NAME?=megaease/golang:1.23-alpine
+BUILDER_IMAGE_NAME?=megaease/golang:1.24-alpine
 
 # Version
 RELEASE?=v2.9.0
```

**File**: `SECURITY.md` (modified, +2/-2)
```diff
@@ -6,9 +6,9 @@ Supported [Go versions](https://go.dev/dl/):
 
 | Version | Supported          |
 | ------- | ------------------ |
+| 1.25.x   | :white_check_mark: |
 | 1.24.x   | :white_check_mark: |
-| 1.23.x   | :white_check_mark: |
-| < 1.23  | :x:                |
+| < 1.24  | :x:                |
 
 # Reporting a Vulnerability
 
```

**File**: `build/package/Dockerfile.builder` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-FROM golang:1.23-alpine
+FROM golang:1.24-alpine
 RUN apk --no-cache add make git
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module github.com/megaease/easegress/v2
 
-go 1.23.0
+go 1.24
 
 toolchain go1.24.5
 
```

---

### Incident Patch 8: `c75b13a6` (2025-07-31)
**Commit Message**: Docs: Fix some format and problems (#1467)

* Docs: Fix markdown format problems

* Docs: Fix markdown table

**File**: `docs/02.Tutorials/2.9.AI-Gateway.md` (modified, +13/-8)
```diff
@@ -122,39 +122,44 @@ openai-provider(openai)  gpt-4o@https://api.openai.com  /v1/chat/completions 2
 deepseek-provider(deepseek) deepseek-chat@https://api.deepseek.com /v1/chat/completions 2  2/0  107  18/177
 ```
 
-
 ## Benchmark
 
 In this benchmark, we compare popular open-source solutions providing AI gateway capabilities, including our own `Easegress`, as well as `Kong` and `APISIX`. Our goal is to provide clear, reproducible data to help users choose the right gateway for their scenarios.
 
 ### Test Environment
+
 #### Machine
+
 Benchmark machine: dual Intel Xeon Gold 5220R CPUs (96 cores, 192 threads), 251 GiB RAM.
 
 #### Configs
-See scripts for benchmark in [here](../../scripts/benchmark/aigateway).
+
+See the benchmark scripts in [the benchmark scripts directory](../../scripts/benchmark/aigateway).
 
 #### Mock LLM Server
-To ensure fair comparison and reproducibility, we used a mock LLM server to simulate inference requests and responses. This allows us to focus on the gateway performance itself. 
 
-See mock server implementation [here](../../scripts/benchmark/aigateway/llm/).
+To ensure fair comparison and reproducibility, we used a mock LLM server to simulate inference requests and responses. This allows us to focus on the gateway performance itself.
+
+See the [mock server implementation](../../scripts/benchmark/aigateway/llm/).
 
 ### Benchmark Results
+
 1000 requests with 50 concurrency:
-| Name | QPS (Request/sec) | Latency (ms) | 
+
+| Name | QPS (Request/sec) | Latency (ms) |
 | ---- | ----------------- | ------------ |
 | Easegress | 11075 | 3.9 |
 | APISIX | 10979 | 4.2 |
 | Kong | 7528 | 6.2 |
 
-
 10000 requests with 1000 concurrency:
-| Name | QPS (Request/sec) | Latency (ms) | 
+
+| Name | QPS (Request/sec) | Latency (ms) |
 | ---- | ----------------- | ------------ |
 | Easegress | 13496 | 7.1 |
 | APISIX | 15055 | 6.4 |
 | Kong | 9061 | 10.7 |
 
 The results demonstrate that `Easegress` delivers high throughput and low latency, outperforming `Kong` and matching or slightly trailing `APISIX` in certain high-concurrency scenarios.
 
-See more details of result [here](../../scripts/benchmark/aigateway/result/).
+See more details of the benchmark results in [the benchmark results directory](../../scripts/benchmark/aigateway/result/).
```

**File**: `docs/07.Reference/7.01.Controllers.md` (modified, +10/-0)
```diff
@@ -47,6 +47,14 @@
   - [resilience.Policy](#resiliencepolicy)
     - [Retry Policy](#retry-policy)
     - [CircuitBreaker Policy](#circuitbreaker-policy)
+  - [aigatewaycontroller.ProviderSpec](#aigatewaycontrollerproviderspec)
+    - [Supported Providers](#supported-providers)
+  - [aigatewaycontroller.MiddlewareSpec](#aigatewaycontrollermiddlewarespec)
+  - [aigatewaycontroller.SemanticCacheSpec](#aigatewaycontrollersemanticcachespec)
+  - [aigatewaycontroller.EmbeddingSpec](#aigatewaycontrollerembeddingspec)
+  - [aigatewaycontroller.VectorDBSpec](#aigatewaycontrollervectordbspec)
+  - [aigatewaycontroller.RedisSpec](#aigatewaycontrollerredisspec)
+  - [aigatewaycontroller.PostgresSpec](#aigatewaycontrollerpostgresspec)
 
 As the [architecture diagram](../imgs/architecture.png) shows, the controller is the core entity to control kinds of working. There are two kinds of controllers overall:
 
@@ -931,6 +939,8 @@ See more details about `Retry`, `CircuitBreaker`, or other resilience policies i
 | deploymentID | string            | Deployment ID (used for Azure OpenAI)                         | No       |
 | apiVersion   | string            | API version (used for Azure OpenAI)                           | No       |
 
+#### Supported Providers
+
 The providerType can be one of the following:
 
 - anthropic
```

---

### Incident Patch 9: `2d3791ae` (2025-07-25)
**Commit Message**: fix release yaml (#1464)

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ jobs:
           go mod download
           go test -v ./pkg/...
   integration-test-ubuntu:
-    needs: [test, test-win]
+    needs: [test-ubuntu, test-macos, test-win]
     runs-on: ubuntu-latest
     strategy:
       fail-fast: false
```

---

### Incident Patch 10: `910619af` (2025-07-25)
**Commit Message**: fix release fail (#1463)

**File**: `.github/workflows/release.yml` (modified, +25/-2)
```diff
@@ -12,12 +12,12 @@ permissions:
   contents: write
 
 jobs:
-  test:
+  test-ubuntu:
     runs-on: ${{ matrix.os }}
     strategy:
       fail-fast: false
       matrix:
-        os: [ubuntu-latest, macos-latest]
+        os: [ubuntu-latest]
     steps:
       - name: Set up Go 1.x.y
         uses: actions/setup-go@v4
@@ -31,6 +31,27 @@ jobs:
         shell: bash
         run: |
           make test TEST_FLAGS="-race -covermode=atomic"
+  test-macos:
+    runs-on: ${{ matrix.os }}
+    strategy:
+      fail-fast: false
+      matrix:
+        os: [macos-latest]
+    steps:
+      - name: Set up Go 1.x.y
+        uses: actions/setup-go@v4
+        with:
+          go-version: ${{ env.GO_VERSION }}
+
+      - name: Checkout codebase
+        uses: actions/checkout@v3
+
+      - name: Test
+        shell: bash
+        env:
+          EASEGRESS_TEST_SKIP_DOCKER: "true"
+        run: |
+          make test TEST_FLAGS="-race -coverprofile=coverage.txt -covermode=atomic"
   test-win:
     runs-on: windows-latest
     strategy:
@@ -45,6 +66,8 @@ jobs:
         uses: actions/checkout@v3
 
       - name: Test
+        env:
+          EASEGRESS_TEST_SKIP_DOCKER: "true"
         run: |
           go mod verify
           go mod download
```

---

### Incident Patch 11: `54c1e6d9` (2025-06-26)
**Commit Message**: Fix the match of register and unregister of APIs (#1448)

**File**: `pkg/api/api.go` (modified, +10/-2)
```diff
@@ -74,7 +74,11 @@ func RegisterAPIs(apiGroup *Group) {
 	apis[apiGroup.Group] = apiGroup
 
 	logger.Infof("register api group %s", apiGroup.Group)
-	apisChangeChan <- struct{}{}
+
+	select {
+	case apisChangeChan <- struct{}{}:
+	default:
+	}
 }
 
 // UnregisterAPIs unregisters the API group.
@@ -91,7 +95,11 @@ func UnregisterAPIs(group string) {
 	delete(apis, group)
 
 	logger.Infof("unregister api group %s", group)
-	apisChangeChan <- struct{}{}
+
+	select {
+	case apisChangeChan <- struct{}{}:
+	default:
+	}
 }
 
 func (s *Server) registerAPIs() {
```

**File**: `pkg/object/function/worker/api.go` (modified, +4/-5)
```diff
@@ -42,11 +42,11 @@ func (worker *Worker) faasAPIPrefix() string {
 	return fmt.Sprintf("/faas/%s", worker.name)
 }
 
-const apiGroupName = "faas_admin"
+const APIGroupName = "faas_admin"
 
 func (worker *Worker) registerAPIs() {
 	group := &api.Group{
-		Group: apiGroupName,
+		Group: APIGroupName,
 		Entries: []*api.Entry{
 			{Path: worker.faasAPIPrefix(), Method: "POST", Handler: worker.Create},
 			{Path: worker.faasAPIPrefix(), Method: "GET", Handler: worker.List},
@@ -61,9 +61,8 @@ func (worker *Worker) registerAPIs() {
 	api.RegisterAPIs(group)
 }
 
-// UnregisterAPIs unregister APIs
-func (worker *Worker) UnregisterAPIs() {
-	api.UnregisterAPIs(apiGroupName)
+func (worker *Worker) unregisterAPIs() {
+	api.UnregisterAPIs(APIGroupName)
 }
 
 func (worker *Worker) readFunctionName(w http.ResponseWriter, r *http.Request) (string, error) {
```

**File**: `pkg/object/function/worker/worker.go` (modified, +2/-0)
```diff
@@ -188,6 +188,8 @@ func (worker *Worker) Close() {
 	worker.mutex.Lock()
 	defer worker.mutex.Unlock()
 
+	worker.unregisterAPIs()
+
 	close(worker.done)
 	worker.ingress.Close()
 }
```

**File**: `pkg/object/meshcontroller/api/api.go` (modified, +3/-3)
```diff
@@ -127,7 +127,7 @@ type (
 	}
 )
 
-const apiGroupName = "mesh_admin"
+const APIGroupName = "mesh_admin"
 
 // New creates a API
 func New(superSpec *supervisor.Spec) *API {
@@ -148,12 +148,12 @@ func New(superSpec *supervisor.Spec) *API {
 
 // Close unregisters a API
 func (a *API) Close() {
-	api.UnregisterAPIs(apiGroupName)
+	api.UnregisterAPIs(APIGroupName)
 }
 
 func (a *API) registerAPIs() {
 	group := &api.Group{
-		Group: apiGroupName,
+		Group: APIGroupName,
 		Entries: []*api.Entry{
 			{Path: MeshTenantPrefix, Method: "GET", Handler: a.listTenants},
 			{Path: MeshTenantPrefix, Method: "POST", Handler: a.createTenant},
```

**File**: `pkg/object/mqttproxy/broker.go` (modified, +9/-3)
```diff
@@ -149,6 +149,9 @@ func newBroker(spec *Spec, store storage, muxMapper context.MuxMapper, memberURL
 		broker.sessionCacheMgr = newSessionCacheManager(spec, broker.topicMgr)
 	}
 	broker.connectWatcher()
+
+	broker.registerAPIs()
+
 	return broker
 }
 
@@ -326,7 +329,6 @@ func (b *Broker) handleNewSessionInCluster(clientID string, v *string, sessionIn
 		c.ClientID(), info.EGName)
 	c.kickOut()
 	b.removeClient(clientID)
-
 }
 
 func (b *Broker) deleteSession(clientID string) {
@@ -470,7 +472,6 @@ func (b *Broker) handleConn(conn net.Conn) {
 		b.clients[client.info.cid] = client
 		return nil, nil
 	}(client.info.cid)
-
 	if err != nil {
 		// Concurrent connection exceed maxium quotas, returned
 		return
@@ -639,7 +640,6 @@ func (b *Broker) requestTransferToCertainInstances(span *model.SpanContext, publ
 			resp.Body.Close()
 		}
 	}
-
 }
 
 func (b *Broker) processBrokerModePublish(clientID string, publish *packets.PublishPacket) {
@@ -859,6 +859,10 @@ func (b *Broker) registerAPIs() {
 	api.RegisterAPIs(group)
 }
 
+func (b *Broker) unregisterAPIs() {
+	api.UnregisterAPIs(b.name)
+}
+
 func (b *Broker) setClose() {
 	atomic.StoreInt32(&b.closeFlag, 1)
 }
@@ -869,6 +873,8 @@ func (b *Broker) closed() bool {
 }
 
 func (b *Broker) close() {
+	b.unregisterAPIs()
+
 	b.setClose()
 	close(b.done)
 	b.listener.Close()
```

**File**: `pkg/object/mqttproxy/mqttproxy.go` (modified, +0/-1)
```diff
@@ -155,7 +155,6 @@ func (mp *MQTTProxy) Init(superSpec *supervisor.Spec, muxMapper context.MuxMappe
 	if mp.broker == nil {
 		panic(fmt.Sprintf("broker %v start failed", spec.Name))
 	}
-	mp.broker.registerAPIs()
 }
 
 // Inherit inherits previous generation of MQTTProxy.
```

---

### Incident Patch 12: `221cb89f` (2025-04-03)
**Commit Message**: fix: build/package/Dockerfile.builder to reduce vulnerabilities (#1413)

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-ALPINE320-MUSL-8720638
- https://snyk.io/vuln/SNYK-ALPINE320-MUSL-8720638
- https://snyk.io/vuln/SNYK-ALPINE320-OPENSSL-8235201
- https://snyk.io/vuln/SNYK-ALPINE320-OPENSSL-8690013
- https://snyk.io/vuln/SNYK-ALPINE320-OPENSSL-8710359

Co-authored-by: snyk-bot <[REDACTED_EMAIL]>

**File**: `build/package/Dockerfile.builder` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-FROM golang:1.22.7-alpine
+FROM golang:1.24.2-alpine
 RUN apk --no-cache add make git
```

---

### Incident Patch 13: `75c81f4e` (2025-04-02)
**Commit Message**: fix goreleaser (#1414)

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -83,6 +83,6 @@ jobs:
       - uses: goreleaser/goreleaser-action@v4
         with:
           version: latest
-          args: release --rm-dist
+          args: release --clean
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**File**: `.goreleaser.yml` (modified, +2/-2)
```diff
@@ -1,3 +1,5 @@
+version: 2
+
 before:
   hooks:
     # You may remove this if you don't use go modules.
@@ -9,8 +11,6 @@ snapshot:
   name_template: "{{ .Version }}"
 checksum:
   name_template: "checksums.txt"
-changelog:
-  skip: true
 
 builds:
   - id: client
```

---

### Incident Patch 14: `b3c9f77e` (2025-01-07)
**Commit Message**: fix: build/package/Dockerfile.builder to reduce vulnerabilities (#1330)

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-ALPINE320-OPENSSL-7895537
- https://snyk.io/vuln/SNYK-ALPINE320-OPENSSL-7895537

Co-authored-by: snyk-bot <[REDACTED_EMAIL]>

**File**: `build/package/Dockerfile.builder` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-FROM golang:1.21.12-alpine
+FROM golang:1.22.7-alpine
 RUN apk --no-cache add make git
```

---

### Incident Patch 15: `5989d04d` (2024-07-03)
**Commit Message**: fix: build/package/Dockerfile.builder to reduce vulnerabilities (#1305)

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-ALPINE319-BUSYBOX-6913413
- https://snyk.io/vuln/SNYK-ALPINE319-BUSYBOX-6928845
- https://snyk.io/vuln/SNYK-ALPINE319-BUSYBOX-6928846
- https://snyk.io/vuln/SNYK-ALPINE319-BUSYBOX-6928846
- https://snyk.io/vuln/SNYK-ALPINE319-BUSYBOX-6928847

Co-authored-by: snyk-bot <[REDACTED_EMAIL]>

**File**: `build/package/Dockerfile.builder` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-FROM golang:1.21.7-alpine
+FROM golang:1.21.12-alpine
 RUN apk --no-cache add make git
```

#### Recent Merged Pull Requests:
- **PR #1524** (2026-07-01): Harden Helm admin API defaults (@xxx7xxxx)
- **PR #1523** (closed): [codex] Harden Helm admin API defaults (@xxx7xxxx)
- **PR #1521** (2026-06-26): Update contact info (@xxx7xxxx)
- **PR #1519** (2026-06-04): [Snyk] Security upgrade golang from 1.26.1-alpine to 1.26.4-alpine (@caniszczyk)
- **PR #1518** (2026-05-29): fix(grpcproxy): do not degrade pool on gRPC application-level errors (fixes #1517) (@akpradheeph)
- **PR #1516** (closed): [Snyk] Security upgrade golang from 1.26.1-alpine to 1.26.3-alpine (@xxx7xxxx)
- **PR #1515** (closed): [Snyk] Security upgrade golang from 1.26.1-alpine to 1.26.2-alpine (@xxx7xxxx)
- **PR #1514** (2026-04-01): 📖 Add KubeStellar Console guided install reference (@clubanderson)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

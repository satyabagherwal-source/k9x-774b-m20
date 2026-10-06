# Forensic Learning Record (Deep Inspection): koderover/zadig

> **Canonical Artifact**: `07_PROJECT_LEARNING/koderover-zadig-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/koderover/zadig](https://github.com/koderover/zadig))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:01:57.880Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `koderover/zadig`
- **Description**: Zadig: An AI-powered, cloud-native, distributed DevOps platform designed for developers
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 3250 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/version-demo/utils/version.go`
```
package utils

import (
	"fmt"
	"runtime"
)

var (
	version      string
	gitBranch    string
	gitTag       string
	gitCommit    string
	gitPR        string
	gitTreeState string
	buildDate    string
	buildURL      string
)

// Info contains versioning information.
type Info struct {
	Version      string `json:"version"`
	GitBranch    string `json:"gitBranch"`
	GitTag       string `json:"gitTag"`
	GitCommit    string `json:"gitCommit"`
	GitPR        string `json:"gitPR"`
	GitTreeState string `json:"gitTreeState"`
	BuildDate    string `json:"buildDate"`
	BuildURL     string `json:"buildURL"`
	GoVersion    string `json:"goVersion"`
	Compiler     string `json:"compiler"`
	Platform     string `json:"platform"`
}

// String returns info as a human-friendly version string.
func (info Info) String() string {
	return info.Platform
}

func GetVersion() Info {
	return Info{
		Version:      version,
		GitBranch:    gitBranch,
		GitTag:       gitTag,
		GitCommit:    gitCommit,
		GitPR:        gitPR,
		GitTreeState: gitTreeState,
		BuildDate:    buildDate,
		BuildURL:     buildURL,
		GoVersion:    runtime.Version(),
		Compiler:     runtime.Compiler,
		Platform:     fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH),
	}
}

```

### Core Architecture Module: `pkg/cli/upgradeassistant/cmd/migrate/utils.go`
```
package migrate

import (
	"fmt"
	"reflect"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

	internalmodels "github.com/koderover/zadig/v2/pkg/cli/upgradeassistant/internal/repository/models"
	"github.com/koderover/zadig/v2/pkg/cli/upgradeassistant/internal/repository/mongodb"
	internaldb "github.com/koderover/zadig/v2/pkg/cli/upgradeassistant/internal/repository/mongodb"
	"github.com/koderover/zadig/v2/pkg/tool/log"
)

// getMigrationInfo get the current migration status from the mongodb, if none exists, initialize one and return the
// initialized data.
// NOTE THAT THE INITIALIZATION FUNCTION NEEDS TO BE UPDATED TO AVOID DATA CORRUPTION
func getMigrationInfo() (*internalmodels.Migration, error) {
	migrationInfo, err := internaldb.NewMigrationColl().GetMigrationInfo()
	if err != nil {
		if err != mongo.ErrNoDocuments {
			return nil, fmt.Errorf("failed to get migration info from db, err: %s", err)
		} else {
			err := internaldb.NewMigrationColl().InitializeMigrationInfo()
			if err != nil {
				return nil, fmt.Errorf("failed to create migration info in db, err: %s", err)
			}
			createdInfo, err := internaldb.NewMigrationColl().GetMigrationInfo()
			if err != nil {
				return nil, fmt.Errorf("failed to get migration info from db, err: %s", err)
			}
			return createdInfo, nil
		}
	}
	return migrationInfo, nil
}

func getMigrationFieldBsonTag(migrationInst *internalmodels.Migration, fieldPtr interface{}) string {
	val := reflect.ValueOf(migrationInst).Elem()
	typ := val.Type()
	for i := 0; i < val.NumField(); i++ {
		field := val.Field(i)
		if field.Addr().Interface() == fieldPtr {
			return typ.Field(i).Tag.Get("bson")
		}
	}
	return ""
}

func updateMigrationError(migrationID primitive.ObjectID, err error) {
	if err != nil {
		err = mongodb.NewMigrationColl().UpdateMigrationError(migrationID, err.Error())
		if err != nil {
			log.Errorf("failed to update migration error: %s", err)
		}
	} else {
		err = mongodb.NewMigrationColl().UpdateMigrationError(migrationID, "")
		if err != nil {
			log.Errorf("failed to update migration error: %s", err)
		}
	}
}

```

### Core Architecture Module: `pkg/cli/upgradeassistant/internal/repository/models/renderset.go`
```
/*
Copyright 2022 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package models

import templatemodels "github.com/koderover/zadig/v2/pkg/microservice/aslan/core/common/repository/models/template"

// RenderSet ...
type RenderSet struct {
	// Name = EnvName == "" ? ProductTmpl : (EnvName + "-" + ProductTempl)
	Name     string `bson:"name"                     json:"name"`
	Revision int64  `bson:"revision"                 json:"revision"`
	// 可以为空，空时为产品模板默认的渲染集，非空时为环境的渲染集
	EnvName     string `bson:"env_name,omitempty"             json:"env_name,omitempty"`
	ProductTmpl string `bson:"product_tmpl"                   json:"product_tmpl"`
	Team        string `bson:"team,omitempty"                 json:"team,omitempty"`
	UpdateTime  int64  `bson:"update_time"                    json:"update_time"`
	UpdateBy    string `bson:"update_by"                      json:"update_by"`
	IsDefault   bool   `bson:"is_default"                     json:"is_default"`
	// yaml content, used as 'global variables' for both k8s/helm projects
	DefaultValues    string                          `bson:"default_values,omitempty"       json:"default_values,omitempty"`
	YamlData         *templatemodels.CustomYaml      `bson:"yaml_data,omitempty"            json:"yaml_data,omitempty"`
	KVs              []*templatemodels.RenderKV      `bson:"kvs,omitempty"                  json:"kvs,omitempty"`               // deprecated since 1.16.0
	ServiceVariables []*templatemodels.ServiceRender `bson:"service_variables,omitempty"    json:"service_variables,omitempty"` // new since 1.16.0 replace kvs
	ChartInfos       []*templatemodels.ServiceRender `bson:"chart_infos,omitempty"          json:"chart_infos,omitempty"`
	Description      string                          `bson:"description,omitempty"          json:"description,omitempty"`
}

func (RenderSet) TableName() string {
	return "render_set"
}

```

### Core Architecture Module: `pkg/cli/upgradeassistant/internal/repository/mongodb/render_set.go`
```
/*
Copyright 2021 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package mongodb

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/koderover/zadig/v2/pkg/cli/upgradeassistant/internal/repository/models"
	"github.com/koderover/zadig/v2/pkg/microservice/aslan/config"
	mongotool "github.com/koderover/zadig/v2/pkg/tool/mongo"
)

type RenderSetListOption struct {
	// if Revision == 0 then search max revision of RenderSet
	ProductTmpl   string
	Revisions     []int64
	RendersetName string
	FindOpts      []RenderSetFindOption
}

// RenderSetFindOption ...
type RenderSetFindOption struct {
	// if Revision == 0 then search max revision of RenderSet
	ProductTmpl       string
	EnvName           string
	IsDefault         bool
	Revision          int64
	Name              string
	YamlVariableSetID string
}

type RenderSetPipeResp struct {
	RenderSet struct {
		Name        string `bson:"name"                     json:"name"`
		ProductTmpl string `bson:"product_tmpl"             json:"product_tmpl"`
	} `bson:"_id"      json:"render_set"`
	Revision int64 `bson:"revision"     json:"revision"`
}

type RenderSetColl struct {
	*mongo.Collection

	coll string
}

func NewRenderSetColl() *RenderSetColl {
	name := models.RenderSet{}.TableName()
	return &RenderSetColl{Collection: mongotool.Database(config.MongoDatabase()).Collection(name), coll: name}
}

func (c *RenderSetColl) GetCollectionName() string {
	return c.coll
}

func (c *RenderSetColl) FindRenderSet(opt *RenderSetFindOption) (*models.RenderSet, bool, error) {
	res, err := c.Find(opt)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, false, nil
		}
		return nil, false, err
	}

	return res, true, nil
}

func (c *RenderSetColl) Find(opt *RenderSetFindOption) (*models.RenderSet, error) {
	if opt == nil {
		return nil, errors.New("RenderSetFindOption cannot be nil")
	}

	query := bson.M{"name": opt.Name}
	opts := options.FindOne()
	if opt.Revision > 0 {
		// revisionName + revision are enough to locate the target record
		// there is no need to set other query condition
		// Note. the query logic has been rolled back to 1.12.0
		query["revision"] = opt.Revision
	} else {
		opts.SetSort(bson.D{{"revision", -1}})

		if len(opt.EnvName) > 0 {
			query["env_name"] = opt.EnvName
		}

		if len(opt.ProductTmpl) > 0 {
			query["product_tmpl"] = opt.ProductTmpl
		}

		if opt.IsDefault {
			query["is_default"] = opt.IsDefault
		}
	}

	rs := &models.RenderSet{}
	err := c.FindOne(context.TODO(), query, opts).Decode(&rs)
	if err != nil {
		return nil, err
	}

	return rs, err
}

func (c *RenderSetColl) Update(args *models.RenderSet) error {
	query := bson.M{"name": args.Name, "revision": args.Revision}
	change := bson.M{"$set": bson.M{
		"chart_infos": args.ChartInfos,
		"update_time": time.Now().Unix(),
		"update_by":   args.UpdateBy,
		//"kvs":            args.KVs,
		"default_values": args.DefaultValues,
	}}

	_, err := c.UpdateOne(context.TODO(), query, change)

	return err
}

func (c *RenderSetColl) UpdateDefaultValues(renderSet *models.RenderSet) error {
	query := bson.M{"name": renderSet.Name, "revision": renderSet.Revision}
	change := bson.M{"$set": bson.M{
		"update_time":    time.Now().Unix(),
		"update_by":      "ua",
		"default_values": renderSet.DefaultValues,
	}}
	_, err := c.UpdateOne(context.TODO(), query, change)
	return err
}

```

### Core Architecture Module: `pkg/cli/zadig-agent/util/client/client.go`
```
/*
Copyright 2023 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package httpclient

import (
	"bytes"
	"crypto/tls"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/koderover/zadig/v2/pkg/cli/zadig-agent/helper/log"
	"k8s.io/apimachinery/pkg/util/sets"
)

const (
	UserAgent      = "Zadig Agent REST Client"
	TimeoutSeconds = 60
)

type Client struct {
	*resty.Client

	Host        string   // Host is the fully qualified domain name of the system, or an IP Address. Port and protocol are required if necessary.
	BaseURI     string   // BaseURI is the base uri for every request, starting with a slash, for example: /api/v1
	IgnoreCodes sets.Int // IgnoreCodes ignores some code to be returned as an error.
}

func Get(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Get(url, rfs...)
}

func Post(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Post(url, rfs...)
}

func Patch(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Patch(url, rfs...)
}

func Put(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Put(url, rfs...)
}

func Delete(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Delete(url, rfs...)
}

func Head(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Head(url, rfs...)
}

func Options(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Options(url, rfs...)
}

// Download retrieves content from the given url and write it to path.
func Download(url, path string, rfs ...RequestFunc) error {
	// download may take more time
	cl := New(UnsetTimeout())
	res, err := cl.Get(url, rfs...)
	if err != nil {
		return err
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer func() {
		_ = f.Close()
	}()

	_, err = io.Copy(f, bytes.NewReader(res.Body()))

	return err
}

// New TODO: need to config tls security
func New(cfs ...ClientFunc) *Client {
	r := resty.New()
	r.SetTransport(&http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	})
	r.SetHeader("Content-Type", "application/json").
		SetHeader("Accept", "application/json").
		SetHeader("User-Agent", UserAgent).
		SetTimeout(TimeoutSeconds * time.Second).
		SetLogger(log.SugaredLogger())

	c := &Client{
		Client:      r,
		IgnoreCodes: sets.NewInt(),
	}

	for _, cf := range cfs {
		cf(c)
	}

	return c
}

func (c *Client) Get(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodGet, url, rfs...)
}

func (c *Client) Post(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodPost, url, rfs...)
}

func (c *Client) Patch(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodPatch, url, rfs...)
}

func (c *Client) Put(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodPut, url, rfs...)
}

func (c *Client) Delete(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodDelete, url, rfs...)
}

func (c *Client) Head(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodHead, url, rfs...)
}

func (c *Client) Options(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodOptions, url, rfs...)
}

func (c *Client) Request(method, url string, rfs ...RequestFunc) (*resty.Response, error) {
	if c.BaseURI != "" {
		url = c.BaseURI + url
	}
	r := c.R()

	for _, rf := range rfs {
		rf(r)
	}

	return c.wrapError(r.Execute(method, url))
}

func (c *Client) wrapError(res *resty.Response, err error) (*resty.Response, error) {
	if err != nil {
		return res, err
	}

	if res.IsError() && !c.IgnoreCodes.Has(res.StatusCode()) {
		return res, NewErrorFromRestyResponse(res)
	}

	return res, nil
}

```

### Core Architecture Module: `pkg/cli/zadig-agent/util/client/client_options.go`
```
/*
Copyright 2023 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package httpclient

import (
	"crypto/tls"
	"time"
)

type ClientFunc func(*Client)

func SetBasicAuth(username, password string) ClientFunc {
	return func(c *Client) {
		c.Client.SetBasicAuth(username, password)
	}
}

func SetAuthScheme(scheme string) ClientFunc {
	return func(c *Client) {
		c.Client.SetAuthScheme(scheme)
	}
}

func SetAuthToken(token string) ClientFunc {
	return func(c *Client) {
		c.Client.SetAuthToken(token)
	}
}

func SetBaseURI(uri string) ClientFunc {
	return func(c *Client) {
		c.BaseURI = uri
	}
}

func SetHostURL(url string) ClientFunc {
	return func(c *Client) {
		c.Client.SetHostURL(url)
		c.Host = url
	}
}

func SetProxy(proxyURL string) ClientFunc {
	return func(c *Client) {
		c.Client.SetProxy(proxyURL)
	}
}

func UnsetTimeout() ClientFunc {
	return func(c *Client) {
		c.Client.SetTimeout(0)
	}
}

func SetIgnoreCodes(codes ...int) ClientFunc {
	return func(c *Client) {
		c.IgnoreCodes.Insert(codes...)
	}
}

func SetRetryCount(count int) ClientFunc {
	return func(c *Client) {
		c.Client.SetRetryCount(count)
	}
}

func SetRetryWaitTime(waitTime time.Duration) ClientFunc {
	return func(c *Client) {
		c.Client.SetRetryWaitTime(waitTime)
	}
}

func SetTLSClientConfig(config *tls.Config) ClientFunc {
	return func(c *Client) {
		c.Client.SetTLSClientConfig(config)
	}
}

func SetClientHeader(header, value string) ClientFunc {
	return func(c *Client) {
		c.Client.SetHeader(header, value)
	}
}

```

### Core Architecture Module: `pkg/cli/zadig-agent/util/client/errors.go`
```
/*
Copyright 2023 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package httpclient

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/go-resty/resty/v2"
)

// StatusReason is an enumeration of possible failure causes.  Each StatusReason
// must map to a single HTTP status code, but multiple reasons may map
// to the same HTTP status code.
type StatusReason string

const (
	// StatusReasonUnknown means the server has declined to indicate a specific reason.
	StatusReasonUnknown StatusReason = ""

	// StatusReasonBadRequest means that the request itself was invalid, because the request
	// doesn't make any sense, for example deleting a read-only object.  This is different than
	// StatusReasonInvalid above which indicates that the API call could possibly succeed, but the
	// data was invalid.  API calls that return BadRequest can never succeed.
	// Status code 400
	StatusReasonBadRequest StatusReason = "BadRequest"

	// StatusReasonUnauthorized means the server can be reached and understood the request, but requires
	// the user to present appropriate authorization credentials (identified by the WWW-Authenticate header)
	// in order for the action to be completed. If the user has specified credentials on the request, the
	// server considers them insufficient.
	// Status code 401
	StatusReasonUnauthorized StatusReason = "Unauthorized"

	// StatusReasonForbidden means the server can be reached and understood the request, but refuses
	// to take any further action.  It is the result of the server being configured to deny access for some reason
	// to the requested resource by the client.
	// Status code 403
	StatusReasonForbidden StatusReason = "Forbidden"

	// StatusReasonNotFound means one or more resources required for this operation
	// could not be found.
	// Status code 404
	StatusReasonNotFound StatusReason = "NotFound"

	// StatusReasonMethodNotAllowed means that the action the client attempted to perform on the
	// resource was not supported by the code - for instance, attempting to delete a resource that
	// can only be created. API calls that return MethodNotAllowed can never succeed.
	// Status code 405
	StatusReasonMethodNotAllowed StatusReason = "MethodNotAllowed"

	// StatusReasonNotAcceptable means that the accept types indicated by the client were not acceptable
	// to the server - for instance, attempting to receive protobuf for a resource that supports only json and yaml.
	// API calls that return NotAcceptable can never succeed.
	// Status code 406
	StatusReasonNotAcceptable StatusReason = "NotAcceptable"

	// StatusReasonAlreadyExists means the resource you are creating already exists.
	// Status code 409
	StatusReasonAlreadyExists StatusReason = "AlreadyExists"

	// StatusReasonConflict means the requested operation cannot be completed
	// due to a conflict in the operation. The client may need to alter the
	// request. Each resource may define custom details that indicate the
	// nature of the conflict.
	// Status code 409
	StatusReasonConflict StatusReason = "Conflict"

	// StatusReasonGone means the item is no longer available at the server and no
	// forwarding address is known.
	// Status code 410
	StatusReasonGone StatusReason = "Gone"

	// StatusReasonUnsupportedMediaType means that the content type sent by the client is not acceptable
	// to the server - for instance, attempting to send protobuf for a resource that supports only json and yaml.
	// API calls that return UnsupportedMediaType can never succeed.
	// Status code 415
	StatusReasonUnsupportedMediaType StatusReason = "UnsupportedMediaType"

	// StatusReasonInvalid means the requested create or update operation cannot be
	// completed due to invalid data provided as part of the request. The client may
	// need to alter the request.
	// Status code 422
	StatusReasonInvalid StatusReason = "Invalid"

	// StatusReasonTooManyRequests means the server experienced too many requests within a
	// given window and that the client must wait to perform the action again. A client may
	// always retry the request that led to this error, although the client should wait at least
	// the number of seconds specified by the retryAfterSeconds field.
	// Status code 429
	StatusReasonTooManyRequests StatusReason = "TooManyRequests"

	// StatusReasonInternalError indicates that an internal error occurred, it is unexpected
	// and the outcome of the call is unknown.
	// Status code 500
	StatusReasonInternalError StatusReason = "InternalError"

	// StatusReasonServiceUnavailable means that the request itself was valid,
	// but the requested service is unavailable at this time.
	// Retrying the request after some time might succeed.
	// Status code 503
	StatusReasonServiceUnavailable StatusReason = "ServiceUnavailable"
)

type httpStatus interface {
	Status() StatusReason
}

type Error struct {
	Code      int
	ErrStatus StatusReason
	Message   string
	Detail    string
}

func (e *Error) Error() string {
	return fmt.Sprintf("[%d %s] %s", e.Code, e.ErrStatus, e.Detail)
}

func (e *Error) Status() StatusReason {
	return e.ErrStatus
}

var _ error = &Error{}
var _ httpStatus = &Error{}

func IsNotFound(err error) bool {
	return ReasonForError(err) == StatusReasonNotFound
}

func ReasonForError(err error) StatusReason {
	if status := httpStatus(nil); errors.As(err, &status) {
		return status.Status()
	}
	return StatusReasonUnknown
}

func NewErrorFromRestyResponse(res *resty.Response) *Error {
	return NewGenericServerResponse(res.StatusCode(), res.Request.Method, res.String())
}

// NewGenericServerResponse returns a new error for server responses.
func NewGenericServerResponse(code int, method string, detail string) *Error {
	reason := StatusReasonUnknown
	message := fmt.Sprintf("the server responded with the status code %d but did not return more information", code)
	switch code {
	case http.StatusConflict:
		if method == resty.MethodPost {
			reason = StatusReasonAlreadyExists
		} else {
			reason = StatusReasonConflict
		}
		message = "the server reported a conflict"
	case http.StatusNotFound:
		reason = StatusReasonNotFound
		message = "the server could not find the requested resource"
	case http.StatusBadRequest:
		reason = StatusReasonBadRequest
		message = "the server rejected our request for an unknown reason"
	case http.StatusUnauthorized:
		reason = StatusReasonUnauthorized
		message = "the server has asked for the client to provide credentials"
	case http.StatusForbidden:
		reason = StatusReasonForbidden
		// the server message has details about who is trying to perform what action.  Keep its message.
		message = detail
	case http.StatusNotAcceptable:
		reason = StatusReasonNotAcceptable
		// the server message has details about what types are acceptable
		if len(detail) == 0 || detail == "unknown" {
			message = "the server was unable to respond with a content type that the client supports"
		} else {
			message = detail
		}
	case http.StatusUnsupportedMediaType:
		reason = StatusReasonUnsupportedMediaType
		// the server message has details about what types are acceptable
		message = detail
	case http.StatusMethodNotAllowed:
		reason = StatusReasonMethodNotAllowed
		message = "the server does not allow this method on the requested resource"
	case http.StatusUnprocessableEntity:
		reason = StatusReasonInvalid
		message = "the server rejected our request due to an error in our request"
	case http.StatusServiceUnavailable:
		reason = StatusReasonServiceUnavailable
		message = "the server is currently unable to handle the request"
	case http.StatusTooManyRequests:
		reason = StatusReasonTooManyRequests
		message = "the server has received too many requests and has asked us to try again later"
	default:
		if code >= 500 {
			reason = StatusReasonInternalError
			message = "an error on the server has prevented the request from succeeding"
		}
	}

	return &Error{
		Code:      code,
		ErrStatus: reason,
		Message:   message,
		Detail:    detail,
	}
}

```

### Core Architecture Module: `pkg/cli/zadig-agent/util/client/request_options.go`
```
/*
Copyright 2023 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package httpclient

import (
	"net/http"
	"net/url"

	"github.com/go-resty/resty/v2"
)

type RequestFunc func(request *resty.Request)

func SetResult(res interface{}) RequestFunc {
	return func(r *resty.Request) {
		r.SetResult(res)
	}
}

func SetBody(body interface{}) RequestFunc {
	return func(r *resty.Request) {
		r.SetBody(body)
	}
}

func SetHeader(header, value string) RequestFunc {
	return func(r *resty.Request) {
		r.SetHeader(header, value)
	}
}

func SetHeaders(headers map[string]string) RequestFunc {
	return func(r *resty.Request) {
		r.SetHeaders(headers)
	}
}

func SetHeadersFromHTTPHeader(header http.Header) RequestFunc {
	return func(r *resty.Request) {
		r.Header = header
	}
}

func SetQueryParamsFromValues(params url.Values) RequestFunc {
	return func(r *resty.Request) {
		r.SetQueryParamsFromValues(params)
	}
}

func SetQueryParams(params map[string]string) RequestFunc {
	return func(r *resty.Request) {
		r.SetQueryParams(params)
	}
}

func SetQueryParam(param, value string) RequestFunc {
	return func(r *resty.Request) {
		r.SetQueryParam(param, value)
	}
}

func ForceContentType(contentType string) RequestFunc {
	return func(r *resty.Request) {
		r.ForceContentType(contentType)
	}
}

func SetFormData(data map[string]string) RequestFunc {
	return func(r *resty.Request) {
		r.SetFormData(data)
	}
}

```

### Core Architecture Module: `pkg/cli/zadig-agent/util/dir.go`
```
package util

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func DeleteSubdirectories(rootDir string) error {
	// get all subdirectories under the root directory
	subDirs, err := getSubdirectories(rootDir)
	if err != nil {
		return fmt.Errorf("Error getting subdirectories: %v", err)
	}

	// delte all sub dir
	for _, subDir := range subDirs {
		err := os.RemoveAll(subDir)
		if err != nil {
			return fmt.Errorf("Error deleting %s: %v", subDir, err)
		} else {
			fmt.Printf("Deleted %s\n", subDir)
		}
	}
	return nil
}

// Get all subdirectories under the specified directory
func getSubdirectories(rootDir string) ([]string, error) {
	var subDirs []string

	err := filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() && path != rootDir {
			subDirs = append(subDirs, path)
		}
		return nil
	})

	return subDirs, err
}

func DeletePathToRoot(rootDir, subDir string) error {
	// Ensure that the subdirectory is a subdirectory of the root directory
	if !isSubdirectory(rootDir, subDir) {
		return fmt.Errorf("The subdirectory is not a subdirectory of the root directory.")
	}

	// Delete recursively starting from the subdirectory and moving up to the root directory
	for subDir != rootDir {
		err := os.RemoveAll(subDir)
		if err != nil {
			return fmt.Errorf("Error deleting %s: %v\n", subDir, err)
		}
		subDir = filepath.Dir(subDir)
	}
	return nil
}

// Check if a directory is a subdirectory of another directory
func isSubdirectory(rootDir, subDir string) bool {
	rel, err := filepath.Rel(rootDir, subDir)
	if err != nil {
		return false
	}
	return !strings.HasPrefix(rel, "..") && !strings.HasPrefix(rel, ".")
}

```

### Core Architecture Module: `pkg/cli/zadig-agent/util/file/file.go`
```
/*
Copyright 2023 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package util

import (
	"fmt"
	"io/ioutil"
	"os"
)

func GenerateTmpFile() (string, error) {
	var tmpFile *os.File

	tmpFile, err := os.CreateTemp("", "")
	if err != nil {
		return "", err
	}

	_ = tmpFile.Close()

	return tmpFile.Name(), nil
}

func WriteFile(filename string, data []byte, perm os.FileMode) error {
	f, err := os.OpenFile(filename, os.O_CREATE|os.O_RDWR|os.O_APPEND, perm)
	if err != nil {
		return err
	}
	defer f.Close()

	if _, err := f.Write(data); err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return nil
}

func ReadFile(filename string) ([]byte, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	contentByte, err := ioutil.ReadAll(file)
	if err != nil {
		return nil, err
	}
	return contentByte, nil
}

func PathExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func FileExists(filePath string) (bool, error) {
	st, err := os.Stat(filePath)
	if err != nil {
		if !os.IsNotExist(err) {
			return false, err
		}
		return false, nil
	}

	if st.IsDir() {
		return false, fmt.Errorf("%s is a directory", filePath)
	}

	return true, nil
}

```

### Core Architecture Module: `pkg/cli/zadig-agent/util/os/cmd.go`
```
/*
Copyright 2023 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package os

import "os"

func GetWorkingDir() (string, error) {
	// get the path of the current working directory
	return os.Getwd()
}

```

### Core Architecture Module: `pkg/cli/zadig-agent/util/os/directory.go`
```
/*
Copyright 2023 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package os

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
)

func GetCurrentDirectory() (string, error) {
	currentDir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get current working directory: %s", err)
	}
	return currentDir, nil
}

func Mkdir(dir string) error {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return os.Mkdir(dir, os.ModePerm)
	}
	return nil
}

func GetUserHomeDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get current user: %s", err)
	}

	return homeDir, nil
}

func CopyDir(src, dst string) error {
	// get source directory info
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			// if it is a subdirectory, copy the subdirectory by recursion
			if err := CopyDir(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			// if it is a file, copy the file
			if err := CopyFile(srcPath, dstPath); err != nil {
				return err
			}
		}
	}

	return nil
}

func CopyFile(src, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), os.ModePerm); err != nil {
		return fmt.Errorf("failed to create directory %s, error: %v", filepath.Dir(dst), err)
	}

	srcFile, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("failed to open file %s, error: %v", src, err)
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return fmt.Errorf("failed to create file %s, error: %v", dst, err)
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	if err != nil {
		return fmt.Errorf("failed to copy file %s to %s, error: %v", src, dst, err)
	}

	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4969** (2026-09-07): **[bug] 升级至 4.3 创建新的项目使用托管模式，创建环境时不能读取集群配置，如图所示**
  *Symptoms*: <img width="1372" height="822" alt="Image" src="https://github.com/user-attachments/assets/58122a11-edc5-4043-835e-09bb044cc336" /> 
  **Post-Mortem & Fix Analysis**:
  > 新建的托管项目，升级前的项目不受影响

- **Issue #4816** (2026-07-31): **cp-4799: add permission for reordering release jobs in update release plan.**
  *Symptoms*: ### What this PR does / Why we need it:  cherry-pick for #4799   ### What is changed and how it works?   ### Does this PR introduce a user-facing change?  - [ ] API change - [ ] database schema change - [ ] upgrade assistant change   - [ ] change in non-functional attributes such as efficiency or availability - [ ] fix of a previous issue  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/koderover/zadig/4816) <!-- Reviewable:end --> 

- **Issue #4799** (2026-07-07): **fix: add permission for reordering release jobs in update release plan.**
  *Symptoms*: ### What this PR does / Why we need it:  Non-admin users hit "unknown verb: reorder_release_job" when moving release jobs, even if they had EditSubtasks permission. The permission switch did not include the reorder verb, so the request failed before checking the existing subtask edit permission.  ### Does this PR introduce a user-facing change?  - [ ] API change - [ ] database schema change - [ ] upgrade assistant change   - [ ] change in non-functional attributes such as efficiency or availability - [ ] fix of a previous issue  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/koderover/zadig/4799) <!-- Reviewable:end --> 

- **Issue #4733** (2026-06-24): **fix: enhance multi-select handling in key-value processing.**
  *Symptoms*: ### What this PR does / Why we need it:  fix: enhance multi-select handling in key-value processing.  ### Does this PR introduce a user-facing change?  - [ ] API change - [ ] database schema change - [ ] upgrade assistant change   - [ ] change in non-functional attributes such as efficiency or availability - [ ] fix of a previous issue  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/koderover/zadig/4733) <!-- Reviewable:end --> 

- **Issue #4732** (2026-06-24): **fix:enhance write method to handle incomplete UTF-8 sequences.**
  *Symptoms*: ### What this PR does / Why we need it:  fix: enhance pod exec terminal output handling to preserve incomplete UTF-8 sequences across writes.  Container output may be split at arbitrary byte boundaries. When a multi-byte UTF-8 character, such as Chinese input echo, was split across `Write()` calls, the previous implementation could JSON-encode an incomplete sequence and corrupt the terminal output. This PR buffers incomplete UTF-8 tails and sends them only after the full character is available.  ### Does this PR introduce a user-facing change?  - [ ] API change - [ ] database schema change - [ ] upgrade assistant change   - [ ] change in non-functional attributes such as efficiency or availability - [x] fix of a previous issue  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/koderover/zadig/4732) <!-- Reviewable:end --> 

- **Issue #4694** (2026-05-20): **fix:reset workflow status when copy release plan.**
  *Symptoms*: ### What this PR does / Why we need it:  fix:reset workflow status when copy release plan.   ### Does this PR introduce a user-facing change?  - [ ] API change - [ ] database schema change - [ ] upgrade assistant change   - [ ] change in non-functional attributes such as efficiency or availability - [ ] fix of a previous issue  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/koderover/zadig/4694) <!-- Reviewable:end --> 

- **Issue #4654** (2026-04-27): **fix: update TestType and add Source field in workflow template initialization.**
  *Symptoms*: ### What this PR does / Why we need it:  When creating tasks that include testing and scanning using a template, update the initial default values of the task. Also fix the issue where the product test type value is empty instead of a space.  ### Does this PR introduce a user-facing change?  - [ ] API change - [ ] database schema change - [ ] upgrade assistant change   - [ ] change in non-functional attributes such as efficiency or availability - [ ] fix of a previous issue  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/koderover/zadig/4654) <!-- Reviewable:end --> 

- **Issue #4620** (2026-07-31): **[WIP]fix: preserve soft-delete flags in workflow task ACK writes.**
  *Symptoms*: ### What this PR does / Why we need it:  The workflow controller loads a WorkflowTask document into memory at startup and holds a reference (c.workflowTask) for the entire lifetime of the run. When a workflow is deleted while a task is still executing, DeleteWorkflowV4 soft-deletes all associated task documents by setting is_deleted: true and is_archived: true in MongoDB.  However, updateWorkflowTask (the ACK callback invoked after every job/stage transition) writes the full in-memory task object back to MongoDB using $set. Because the in-memory object was loaded before the workflow was deleted, its IsDeleted and IsArchived fields are both false. Every ACK call therefore silently undoes the soft-delete, resetting is_deleted to false and making the task reappear in the UI as "running" — even after the workflow has been removed.  This also meant that a soft-deleted task could never be cleared by InitQueue on service restart (which queries InCompletedTasks filtered by is_deleted: false), nor by any automatic cleanup path, leaving a permanent "zombie" running indicator for users.  ### What is changed and how it works?  Before writing the in-memory task back to MongoDB, sync IsDeleted and IsArchived from the freshly-read database copy (taskInColl) that is already fetched at the top of updateWorkflowTask. This ensures that a soft-delete performed concurrently (e.g., by DeleteWorkflowV4) is never overwritten by a stale ACK.    ### Does this PR introduce a user-facing c

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

### Incident Patch 1: `2779adb2` (2026-09-29)
**Commit Message**: fix: skip missing ssh hosts in vm deploy scope check

Signed-off-by: huanghongbo-hhb <[REDACTED_EMAIL]>

**File**: `pkg/microservice/aslan/core/workflow/service/workflow/controller/job/job_vm_deploy.go` (modified, +1/-1)
```diff
@@ -352,7 +352,7 @@ func (j VMDeployJobController) ToTask(taskID int64) ([]*commonmodels.JobTask, er
 		for _, sshID := range deployInfo.SSHs {
 			vm, ok := vmMap[sshID]
 			if !ok {
-				return resp, fmt.Errorf("find ssh host %s error: host not found", sshID)
+				continue
 			}
 			if !vm.IsAvailableToProject(j.workflow.Project) {
 				return resp, fmt.Errorf("host %s is outside project %s scope", vm.Name, j.workflow.Project)
```

---

### Incident Patch 2: `b91c18b8` (2026-09-29)
**Commit Message**: fix: store mixed host project scope as all projects

Signed-off-by: huanghongbo-hhb <[REDACTED_EMAIL]>

**File**: `pkg/microservice/aslan/core/system/service/private_key.go` (modified, +11/-37)
```diff
@@ -120,39 +120,25 @@ type CreatePrivateKeyResp struct {
 }
 
 // normalizePrivateKeyProjects returns the project scope to store for a host.
-// Project hosts have no scope, and an empty scope means the host is not available to any project.
-func normalizePrivateKeyProjects(projectName string, projects []string) ([]string, error) {
+// Project hosts have no scope, any scope containing all projects is stored as all projects,
+// and an empty scope means the host is not available to any project.
+func normalizePrivateKeyProjects(projectName string, projects []string) []string {
 	if projectName != "" {
-		return nil, nil
+		return nil
 	}
-
-	hasAllProjects := false
-	hasSpecificProject := false
 	for _, project := range projects {
 		if project == setting.AllProjects {
-			hasAllProjects = true
-		} else {
-			hasSpecificProject = true
+			return []string{setting.AllProjects}
 		}
 	}
-	if hasAllProjects && hasSpecificProject {
-		return nil, fmt.Errorf("%s cannot be combined with specific projects", setting.AllProjects)
-	}
-	if hasAllProjects {
-		return []string{setting.AllProjects}, nil
-	}
-	return projects, nil
+	return projects
 }
 
 func CreatePrivateKey(args *commonmodels.PrivateKey, log *zap.SugaredLogger) (*CreatePrivateKeyResp, error) {
 	if !config.CVMNameRegex.MatchString(args.Name) {
 		return nil, e.ErrCreatePrivateKey.AddDesc("主机名称仅支持字母，数字和下划线且首个字符不以数字开头")
 	}
-	projects, err := normalizePrivateKeyProjects(args.ProjectName, args.Projects)
-	if err != nil {
-		return nil, e.ErrCreatePrivateKey.AddDesc(err.Error())
-	}
-	args.Projects = projects
+	args.Projects = normalizePrivateKeyProjects(args.ProjectName, args.Projects)
 
 	privateKeyArgs := &commonrepo.PrivateKeyArgs{
 		Name: args.Name,
@@ -173,7 +159,7 @@ func CreatePrivateKey(args *commonmodels.PrivateKey, log *zap.SugaredLogger) (*C
 		return nil, e.ErrCreatePrivateKey.AddDesc("IP is invalid")
 	}
 
-	err = commonrepo.NewPrivateKeyColl().Create(args)
+	err := commonrepo.NewPrivateKeyColl().Create(args)
 	if err != nil {
 		log.Errorf("failed to create privateKey, error: %s", err)
 		return nil, e.ErrCreatePrivateKey
@@ -193,11 +179,7 @@ func UpdatePrivateKey(id string, args *commonmodels.PrivateKey, log *zap.Sugared
 	if args.IP != "" && !util.IsValidIPv4(args.IP) {
 		return e.ErrUpdatePrivateKey.AddDesc("IP is invalid")
 	}
-	projects, err := normalizePrivateKeyProjects(args.ProjectName, args.Projects)
-	if err != nil {
-		return e.ErrUpdatePrivateKey.AddDesc(err.Error())
-	}
-	args.Projects = projects
+	args.Projects = normalizePrivateKeyProjects(args.ProjectName, args.Projects)
 
 	if vm.Agent != nil {
 		vm.Agent.TaskConcurrency = args.Agent.TaskConcurrency
@@ -351,11 +333,7 @@ func BatchCreatePrivateKey(args []*commonmodels.PrivateKey, option, username str
 			if !config.CVMNameRegex.MatchString(currentPrivateKey.Name) {
 				return e.ErrBulkCreatePrivateKey.AddDesc("主机名称仅支持字母，数字和下划线且首个字符不以数字开头")
 			}
-			projects, err := normalizePrivateKeyProjects(currentPrivateKey.ProjectName, currentPrivateKey.Projects)
-			if err != nil {
-				return e.ErrBulkCreatePrivateKey.AddDesc(err.Error())
-			}
-			currentPrivateKey.Projects = projects
+			currentPrivateKey.Projects = normalizePrivateKeyProjects(currentPrivateKey.ProjectName, currentPrivateKey.Projects)
 
 			if privateKeys, _ := commonrepo.NewPrivateKeyColl().List(&commonrepo.PrivateKeyArgs{Name: currentPrivateKey.Name}); len(privateKeys) > 0 {
 				continue
@@ -373,11 +351,7 @@ func BatchCreatePrivateKey(args []*commonmodels.PrivateKey, option, username str
 			if !config.CVMNameRegex.MatchString(currentPrivateKey.Name) {
 				return e.ErrBulkCreatePrivateKey.AddDesc("主机名称仅支持字母，数字和下划线且首个字符不以数字开头")
 			}
-			projects, err := normalizePrivateKeyProjects(currentPrivateKey.ProjectName, currentPrivateKey.Projects)
-			if err != nil {
-				return e.ErrBulkCreatePrivateKey.AddDesc(err.Error())
-			}
-			currentPrivateKey.Projects = projects
+			currentPrivateKey.Projects = normalizePrivateKeyProjects(currentPrivateKey.ProjectName, currentPrivateKey.Projects)
 			currentPrivateKey.UpdateBy = username
 			if privateKeys, _ := commonrepo.NewPrivateKeyColl().List(&commonrepo.PrivateKeyArgs{Name: currentPrivateKey.Name}); len(privateKeys) > 0 {
 				if err := commonrepo.NewPrivateKeyColl().Update(privateKeys[0].ID.Hex(), currentPrivateKey); err != nil {
```

---

### Incident Patch 3: `5539a85c` (2026-09-29)
**Commit Message**: fix: filter host labels by project scope

Signed-off-by: huanghongbo-hhb <[REDACTED_EMAIL]>

**File**: `pkg/microservice/aslan/core/project/handler/host.go` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ func ListLabels(c *gin.Context) {
 	ctx := internalhandler.NewContext(c)
 	defer func() { internalhandler.JSONResponse(c, ctx) }()
 
-	ctx.Resp, ctx.RespErr = service.ListLabels()
+	ctx.Resp, ctx.RespErr = service.ListLabels(c.Query("projectName"))
 }
 
 func CreatePMHost(c *gin.Context) {
```

**File**: `pkg/microservice/aslan/core/system/handler/private_key.go` (modified, +1/-1)
```diff
@@ -250,7 +250,7 @@ func ListLabels(c *gin.Context) {
 	ctx := internalhandler.NewContext(c)
 	defer func() { internalhandler.JSONResponse(c, ctx) }()
 
-	ctx.Resp, ctx.RespErr = service.ListLabels()
+	ctx.Resp, ctx.RespErr = service.ListLabels(c.Query("projectName"))
 }
 
 type privateKeyArgs struct {
```

**File**: `pkg/microservice/aslan/core/system/service/private_key.go` (modified, +4/-1)
```diff
@@ -324,13 +324,16 @@ func DeletePrivateKey(id, userName string, log *zap.SugaredLogger) error {
 	return nil
 }
 
-func ListLabels() ([]string, error) {
+func ListLabels(projectName string) ([]string, error) {
 	vms, err := commonrepo.NewPrivateKeyColl().List(&commonrepo.PrivateKeyArgs{})
 	if err != nil {
 		return nil, fmt.Errorf("failed to list vms: %v", err)
 	}
 	resp := make([]string, 0)
 	for _, vm := range vms {
+		if projectName != "" && !vm.IsAvailableToProject(projectName) {
+			continue
+		}
 		if vm.Agent == nil {
 			resp = append(resp, vm.Label)
 		}
```

---

### Incident Patch 4: `be133723` (2026-09-29)
**Commit Message**: fix: keep empty host project scope

Signed-off-by: huanghongbo-hhb <[REDACTED_EMAIL]>

**File**: `pkg/microservice/aslan/core/system/service/private_key.go` (modified, +22/-8)
```diff
@@ -119,8 +119,17 @@ type CreatePrivateKeyResp struct {
 	VmID string `json:"vm_id"`
 }
 
-func normalizePrivateKeyProjects(projects []string) ([]string, error) {
-	if len(projects) == 0 {
+// normalizePrivateKeyProjects returns the project scope to store for a host.
+// Project hosts have no scope. A nil scope keeps current, or falls back to all projects;
+// an empty scope means the host is not available to any project.
+func normalizePrivateKeyProjects(projectName string, projects, current []string) ([]string, error) {
+	if projectName != "" {
+		return nil, nil
+	}
+	if projects == nil {
+		if current != nil {
+			return current, nil
+		}
 		return []string{setting.AllProjects}, nil
 	}
 
@@ -146,7 +155,7 @@ func CreatePrivateKey(args *commonmodels.PrivateKey, log *zap.SugaredLogger) (*C
 	if !config.CVMNameRegex.MatchString(args.Name) {
 		return nil, e.ErrCreatePrivateKey.AddDesc("主机名称仅支持字母，数字和下划线且首个字符不以数字开头")
 	}
-	projects, err := normalizePrivateKeyProjects(args.Projects)
+	projects, err := normalizePrivateKeyProjects(args.ProjectName, args.Projects, nil)
 	if err != nil {
 		return nil, e.ErrCreatePrivateKey.AddDesc(err.Error())
 	}
@@ -191,7 +200,7 @@ func UpdatePrivateKey(id string, args *commonmodels.PrivateKey, log *zap.Sugared
 	if args.IP != "" && !util.IsValidIPv4(args.IP) {
 		return e.ErrUpdatePrivateKey.AddDesc("IP is invalid")
 	}
-	projects, err := normalizePrivateKeyProjects(args.Projects)
+	projects, err := normalizePrivateKeyProjects(args.ProjectName, args.Projects, vm.Projects)
 	if err != nil {
 		return e.ErrUpdatePrivateKey.AddDesc(err.Error())
 	}
@@ -346,7 +355,7 @@ func BatchCreatePrivateKey(args []*commonmodels.PrivateKey, option, username str
 			if !config.CVMNameRegex.MatchString(currentPrivateKey.Name) {
 				return e.ErrBulkCreatePrivateKey.AddDesc("主机名称仅支持字母，数字和下划线且首个字符不以数字开头")
 			}
-			projects, err := normalizePrivateKeyProjects(currentPrivateKey.Projects)
+			projects, err := normalizePrivateKeyProjects(currentPrivateKey.ProjectName, currentPrivateKey.Projects, nil)
 			if err != nil {
 				return e.ErrBulkCreatePrivateKey.AddDesc(err.Error())
 			}
@@ -368,13 +377,18 @@ func BatchCreatePrivateKey(args []*commonmodels.PrivateKey, option, username str
 			if !config.CVMNameRegex.MatchString(currentPrivateKey.Name) {
 				return e.ErrBulkCreatePrivateKey.AddDesc("主机名称仅支持字母，数字和下划线且首个字符不以数字开头")
 			}
-			projects, err := normalizePrivateKeyProjects(currentPrivateKey.Projects)
+			currentPrivateKey.UpdateBy = username
+			privateKeys, _ := commonrepo.NewPrivateKeyColl().List(&commonrepo.PrivateKeyArgs{Name: currentPrivateKey.Name})
+			var currentProjects []string
+			if len(privateKeys) > 0 {
+				currentProjects = privateKeys[0].Projects
+			}
+			projects, err := normalizePrivateKeyProjects(currentPrivateKey.ProjectName, currentPrivateKey.Projects, currentProjects)
 			if err != nil {
 				return e.ErrBulkCreatePrivateKey.AddDesc(err.Error())
 			}
 			currentPrivateKey.Projects = projects
-			currentPrivateKey.UpdateBy = username
-			if privateKeys, _ := commonrepo.NewPrivateKeyColl().List(&commonrepo.PrivateKeyArgs{Name: currentPrivateKey.Name}); len(privateKeys) > 0 {
+			if len(privateKeys) > 0 {
 				if err := commonrepo.NewPrivateKeyColl().Update(privateKeys[0].ID.Hex(), currentPrivateKey); err != nil {
 					log.Errorf("PrivateKey.update error: %s", err)
 					return e.ErrBulkCreatePrivateKey.AddDesc("bulk update privateKey failed")
```

**File**: `pkg/microservice/aslan/core/system/service/private_key_test.go` (removed, +0/-34)
```diff
@@ -1,34 +0,0 @@
-package service
-
-import (
-	"reflect"
-	"testing"
-
-	"github.com/koderover/zadig/v2/pkg/setting"
-)
-
-func TestNormalizePrivateKeyProjects(t *testing.T) {
-	tests := []struct {
-		name     string
-		projects []string
-		want     []string
-		wantErr  bool
-	}{
-		{name: "empty projects means all projects", want: []string{setting.AllProjects}},
-		{name: "specific projects keep their scope", projects: []string{"project-a"}, want: []string{"project-a"}},
-		{name: "all projects keeps the explicit scope", projects: []string{setting.AllProjects}, want: []string{setting.AllProjects}},
-		{name: "all projects cannot be mixed", projects: []string{setting.AllProjects, "project-a"}, wantErr: true},
-	}
-
-	for _, tt := range tests {
-		t.Run(tt.name, func(t *testing.T) {
-			got, err := normalizePrivateKeyProjects(tt.projects)
-			if (err != nil) != tt.wantErr {
-				t.Fatalf("normalizePrivateKeyProjects() error = %v, wantErr %v", err, tt.wantErr)
-			}
-			if !tt.wantErr && !reflect.DeepEqual(got, tt.want) {
-				t.Fatalf("normalizePrivateKeyProjects() = %v, want %v", got, tt.want)
-			}
-		})
-	}
-}
```

---

### Incident Patch 5: `eed2b8b9` (2026-09-29)
**Commit Message**: Revert "feat: backfill historical host project scope"

This reverts commit 2726777f9929147ea975ef8537bb1369dcaf5acb.

Signed-off-by: huanghongbo-hhb <[REDACTED_EMAIL]>

**File**: `pkg/cli/upgradeassistant/cmd/migrate/500.go` (modified, +0/-30)
```diff
@@ -34,7 +34,6 @@ import (
 	usermodels "github.com/koderover/zadig/v2/pkg/microservice/user/core/repository/models"
 	userorm "github.com/koderover/zadig/v2/pkg/microservice/user/core/repository/orm"
 	permissionservice "github.com/koderover/zadig/v2/pkg/microservice/user/core/service/permission"
-	"github.com/koderover/zadig/v2/pkg/setting"
 	"github.com/koderover/zadig/v2/pkg/tool/log"
 	pkgtypes "github.com/koderover/zadig/v2/pkg/types"
 	"gorm.io/gorm"
@@ -102,38 +101,9 @@ func V430ToV500() error {
 		return err
 	}
 
-	err = migratePrivateKeyProjectScope500(migrationInfo)
-	if err != nil {
-		return err
-	}
-
 	return nil
 }
 
-func migratePrivateKeyProjectScope500(migrationInfo *internalmodels.Migration) error {
-	if migrationInfo.Migration500PrivateKeyProjectScope {
-		return nil
-	}
-
-	filter := bson.M{
-		"projects": nil,
-		"$or": bson.A{
-			bson.M{"project_name": bson.M{"$exists": false}},
-			bson.M{"project_name": ""},
-		},
-	}
-	update := bson.M{"$set": bson.M{"projects": []string{setting.AllProjects}}}
-	result, err := commonrepo.NewPrivateKeyColl().UpdateMany(context.Background(), filter, update)
-	if err != nil {
-		return fmt.Errorf("failed to backfill private key project scope, err: %s", err)
-	}
-
-	log.Infof("migration 5.0.0: backfilled %d historical private keys with all-project scope", result.ModifiedCount)
-	return internalmongodb.NewMigrationColl().UpdateMigrationStatus(migrationInfo.ID, map[string]interface{}{
-		getMigrationFieldBsonTag(migrationInfo, &migrationInfo.Migration500PrivateKeyProjectScope): true,
-	})
-}
-
 func migrateLogOperationPermission500(migrationInfo *internalmodels.Migration) error {
 	alreadyMigrated := migrationInfo.Migration500LogOperationPermission
 
```

**File**: `pkg/cli/upgradeassistant/internal/repository/models/migration.go` (modified, +0/-1)
```diff
@@ -48,7 +48,6 @@ type Migration struct {
 	Migration500UserContactIndexes              bool               `bson:"migration_500_user_contact_indexes"`
 	Migration500WorkflowTemplateVersion         bool               `bson:"migration_500_workflow_template_version"`
 	Migration500ServiceModule                   bool               `bson:"migration_500_service_module"`
-	Migration500PrivateKeyProjectScope          bool               `bson:"migration_500_private_key_project_scope"`
 	Migration500ServiceModuleSkipped            int                `bson:"migration_500_service_module_skipped"`
 	Migration500ServiceModuleErrors             []string           `bson:"migration_500_service_module_errors"`
 	Error                                       string             `bson:"error"`
```

---

### Incident Patch 6: `2de5757a` (2026-09-29)
**Commit Message**: Revert "fix: backfill all historical host scopes"

This reverts commit 1a44b26050d3f4017e7d5134da5fc160a3aeb441.

Signed-off-by: huanghongbo-hhb <[REDACTED_EMAIL]>

**File**: `pkg/cli/upgradeassistant/cmd/migrate/500.go` (modified, +9/-48)
```diff
@@ -115,59 +115,20 @@ func migratePrivateKeyProjectScope500(migrationInfo *internalmodels.Migration) e
 		return nil
 	}
 
-	ctx, cancel := context.WithCancel(context.Background())
-	defer cancel()
-
-	privateKeyColl := commonrepo.NewPrivateKeyColl()
-	cursor, err := privateKeyColl.Collection.Find(ctx, bson.M{
+	filter := bson.M{
+		"projects": nil,
 		"$or": bson.A{
-			bson.M{"projects": bson.M{"$exists": false}},
-			bson.M{"projects": nil},
-			bson.M{"projects": bson.A{}},
+			bson.M{"project_name": bson.M{"$exists": false}},
+			bson.M{"project_name": ""},
 		},
-	})
-	if err != nil {
-		return fmt.Errorf("failed to list private keys for project scope migration, err: %s", err)
 	}
-	defer cursor.Close(ctx)
-
-	operations := make([]mongo.WriteModel, 0, migration500ProgressEvery)
-	migrated := int64(0)
-	for cursor.Next(ctx) {
-		privateKey := new(commonmodels.PrivateKey)
-		if err := cursor.Decode(privateKey); err != nil {
-			return fmt.Errorf("failed to decode private key for project scope migration, err: %s", err)
-		}
-
-		projects := []string{setting.AllProjects}
-		if privateKey.ProjectName != "" {
-			projects = []string{privateKey.ProjectName}
-		}
-		operations = append(operations, mongo.NewUpdateOneModel().
-			SetFilter(bson.M{"_id": privateKey.ID}).
-			SetUpdate(bson.M{"$set": bson.M{"projects": projects}}))
-
-		if len(operations) == migration500ProgressEvery {
-			result, err := privateKeyColl.BulkWrite(ctx, operations)
-			if err != nil {
-				return fmt.Errorf("failed to backfill private key project scope, err: %s", err)
-			}
-			migrated += result.ModifiedCount
-			operations = operations[:0]
-		}
-	}
-	if err := cursor.Err(); err != nil {
-		return fmt.Errorf("private key project scope migration cursor error, err: %s", err)
-	}
-	if len(operations) > 0 {
-		result, err := privateKeyColl.BulkWrite(ctx, operations)
-		if err != nil {
-			return fmt.Errorf("failed to backfill private key project scope, err: %s", err)
-		}
-		migrated += result.ModifiedCount
+	update := bson.M{"$set": bson.M{"projects": []string{setting.AllProjects}}}
+	result, err := commonrepo.NewPrivateKeyColl().UpdateMany(context.Background(), filter, update)
+	if err != nil {
+		return fmt.Errorf("failed to backfill private key project scope, err: %s", err)
 	}
 
-	log.Infof("migration 5.0.0: backfilled %d historical private keys with project scope", migrated)
+	log.Infof("migration 5.0.0: backfilled %d historical private keys with all-project scope", result.ModifiedCount)
 	return internalmongodb.NewMigrationColl().UpdateMigrationStatus(migrationInfo.ID, map[string]interface{}{
 		getMigrationFieldBsonTag(migrationInfo, &migrationInfo.Migration500PrivateKeyProjectScope): true,
 	})
```

---

### Incident Patch 7: `1a44b260` (2026-09-29)
**Commit Message**: fix: backfill all historical host scopes

Signed-off-by: huanghongbo-hhb <[REDACTED_EMAIL]>

**File**: `pkg/cli/upgradeassistant/cmd/migrate/500.go` (modified, +48/-9)
```diff
@@ -115,20 +115,59 @@ func migratePrivateKeyProjectScope500(migrationInfo *internalmodels.Migration) e
 		return nil
 	}
 
-	filter := bson.M{
-		"projects": nil,
+	ctx, cancel := context.WithCancel(context.Background())
+	defer cancel()
+
+	privateKeyColl := commonrepo.NewPrivateKeyColl()
+	cursor, err := privateKeyColl.Collection.Find(ctx, bson.M{
 		"$or": bson.A{
-			bson.M{"project_name": bson.M{"$exists": false}},
-			bson.M{"project_name": ""},
+			bson.M{"projects": bson.M{"$exists": false}},
+			bson.M{"projects": nil},
+			bson.M{"projects": bson.A{}},
 		},
-	}
-	update := bson.M{"$set": bson.M{"projects": []string{setting.AllProjects}}}
-	result, err := commonrepo.NewPrivateKeyColl().UpdateMany(context.Background(), filter, update)
+	})
 	if err != nil {
-		return fmt.Errorf("failed to backfill private key project scope, err: %s", err)
+		return fmt.Errorf("failed to list private keys for project scope migration, err: %s", err)
+	}
+	defer cursor.Close(ctx)
+
+	operations := make([]mongo.WriteModel, 0, migration500ProgressEvery)
+	migrated := int64(0)
+	for cursor.Next(ctx) {
+		privateKey := new(commonmodels.PrivateKey)
+		if err := cursor.Decode(privateKey); err != nil {
+			return fmt.Errorf("failed to decode private key for project scope migration, err: %s", err)
+		}
+
+		projects := []string{setting.AllProjects}
+		if privateKey.ProjectName != "" {
+			projects = []string{privateKey.ProjectName}
+		}
+		operations = append(operations, mongo.NewUpdateOneModel().
+			SetFilter(bson.M{"_id": privateKey.ID}).
+			SetUpdate(bson.M{"$set": bson.M{"projects": projects}}))
+
+		if len(operations) == migration500ProgressEvery {
+			result, err := privateKeyColl.BulkWrite(ctx, operations)
+			if err != nil {
+				return fmt.Errorf("failed to backfill private key project scope, err: %s", err)
+			}
+			migrated += result.ModifiedCount
+			operations = operations[:0]
+		}
+	}
+	if err := cursor.Err(); err != nil {
+		return fmt.Errorf("private key project scope migration cursor error, err: %s", err)
+	}
+	if len(operations) > 0 {
+		result, err := privateKeyColl.BulkWrite(ctx, operations)
+		if err != nil {
+			return fmt.Errorf("failed to backfill private key project scope, err: %s", err)
+		}
+		migrated += result.ModifiedCount
 	}
 
-	log.Infof("migration 5.0.0: backfilled %d historical private keys with all-project scope", result.ModifiedCount)
+	log.Infof("migration 5.0.0: backfilled %d historical private keys with project scope", migrated)
 	return internalmongodb.NewMigrationColl().UpdateMigrationStatus(migrationInfo.ID, map[string]interface{}{
 		getMigrationFieldBsonTag(migrationInfo, &migrationInfo.Migration500PrivateKeyProjectScope): true,
 	})
```

---

### Incident Patch 8: `476ab1fb` (2026-09-29)
**Commit Message**: fix: normalize private key project scope

Signed-off-by: huanghongbo-hhb <[REDACTED_EMAIL]>

**File**: `pkg/microservice/aslan/core/system/service/private_key.go` (modified, +44/-1)
```diff
@@ -119,10 +119,38 @@ type CreatePrivateKeyResp struct {
 	VmID string `json:"vm_id"`
 }
 
+func normalizePrivateKeyProjects(projects []string) ([]string, error) {
+	if len(projects) == 0 {
+		return []string{setting.AllProjects}, nil
+	}
+
+	hasAllProjects := false
+	hasSpecificProject := false
+	for _, project := range projects {
+		if project == setting.AllProjects {
+			hasAllProjects = true
+		} else {
+			hasSpecificProject = true
+		}
+	}
+	if hasAllProjects && hasSpecificProject {
+		return nil, fmt.Errorf("%s cannot be combined with specific projects", setting.AllProjects)
+	}
+	if hasAllProjects {
+		return []string{setting.AllProjects}, nil
+	}
+	return projects, nil
+}
+
 func CreatePrivateKey(args *commonmodels.PrivateKey, log *zap.SugaredLogger) (*CreatePrivateKeyResp, error) {
 	if !config.CVMNameRegex.MatchString(args.Name) {
 		return nil, e.ErrCreatePrivateKey.AddDesc("主机名称仅支持字母，数字和下划线且首个字符不以数字开头")
 	}
+	projects, err := normalizePrivateKeyProjects(args.Projects)
+	if err != nil {
+		return nil, e.ErrCreatePrivateKey.AddDesc(err.Error())
+	}
+	args.Projects = projects
 
 	privateKeyArgs := &commonrepo.PrivateKeyArgs{
 		Name: args.Name,
@@ -143,7 +171,7 @@ func CreatePrivateKey(args *commonmodels.PrivateKey, log *zap.SugaredLogger) (*C
 		return nil, e.ErrCreatePrivateKey.AddDesc("IP is invalid")
 	}
 
-	err := commonrepo.NewPrivateKeyColl().Create(args)
+	err = commonrepo.NewPrivateKeyColl().Create(args)
 	if err != nil {
 		log.Errorf("failed to create privateKey, error: %s", err)
 		return nil, e.ErrCreatePrivateKey
@@ -163,6 +191,11 @@ func UpdatePrivateKey(id string, args *commonmodels.PrivateKey, log *zap.Sugared
 	if args.IP != "" && !util.IsValidIPv4(args.IP) {
 		return e.ErrUpdatePrivateKey.AddDesc("IP is invalid")
 	}
+	projects, err := normalizePrivateKeyProjects(args.Projects)
+	if err != nil {
+		return e.ErrUpdatePrivateKey.AddDesc(err.Error())
+	}
+	args.Projects = projects
 
 	if vm.Agent != nil {
 		vm.Agent.TaskConcurrency = args.Agent.TaskConcurrency
@@ -313,6 +346,11 @@ func BatchCreatePrivateKey(args []*commonmodels.PrivateKey, option, username str
 			if !config.CVMNameRegex.MatchString(currentPrivateKey.Name) {
 				return e.ErrBulkCreatePrivateKey.AddDesc("主机名称仅支持字母，数字和下划线且首个字符不以数字开头")
 			}
+			projects, err := normalizePrivateKeyProjects(currentPrivateKey.Projects)
+			if err != nil {
+				return e.ErrBulkCreatePrivateKey.AddDesc(err.Error())
+			}
+			currentPrivateKey.Projects = projects
 
 			if privateKeys, _ := commonrepo.NewPrivateKeyColl().List(&commonrepo.PrivateKeyArgs{Name: currentPrivateKey.Name}); len(privateKeys) > 0 {
 				continue
@@ -330,6 +368,11 @@ func BatchCreatePrivateKey(args []*commonmodels.PrivateKey, option, username str
 			if !config.CVMNameRegex.MatchString(currentPrivateKey.Name) {
 				return e.ErrBulkCreatePrivateKey.AddDesc("主机名称仅支持字母，数字和下划线且首个字符不以数字开头")
 			}
+			projects, err := normalizePrivateKeyProjects(currentPrivateKey.Projects)
+			if err != nil {
+				return e.ErrBulkCreatePrivateKey.AddDesc(err.Error())
+			}
+			currentPrivateKey.Projects = projects
 			currentPrivateKey.UpdateBy = username
 			if privateKeys, _ := commonrepo.NewPrivateKeyColl().List(&commonrepo.PrivateKeyArgs{Name: currentPrivateKey.Name}); len(privateKeys) > 0 {
 				if err := commonrepo.NewPrivateKeyColl().Update(privateKeys[0].ID.Hex(), currentPrivateKey); err != nil {
```

**File**: `pkg/microservice/aslan/core/system/service/private_key_test.go` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+package service
+
+import (
+	"reflect"
+	"testing"
+
+	"github.com/koderover/zadig/v2/pkg/setting"
+)
+
+func TestNormalizePrivateKeyProjects(t *testing.T) {
+	tests := []struct {
+		name     string
+		projects []string
+		want     []string
+		wantErr  bool
+	}{
+		{name: "empty projects means all projects", want: []string{setting.AllProjects}},
+		{name: "specific projects keep their scope", projects: []string{"project-a"}, want: []string{"project-a"}},
+		{name: "all projects keeps the explicit scope", projects: []string{setting.AllProjects}, want: []string{setting.AllProjects}},
+		{name: "all projects cannot be mixed", projects: []string{setting.AllProjects, "project-a"}, wantErr: true},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			got, err := normalizePrivateKeyProjects(tt.projects)
+			if (err != nil) != tt.wantErr {
+				t.Fatalf("normalizePrivateKeyProjects() error = %v, wantErr %v", err, tt.wantErr)
+			}
+			if !tt.wantErr && !reflect.DeepEqual(got, tt.want) {
+				t.Fatalf("normalizePrivateKeyProjects() = %v, want %v", got, tt.want)
+			}
+		})
+	}
+}
```

---

### Incident Patch 9: `74c0cb46` (2026-09-29)
**Commit Message**: fix: reuse loaded hosts in vm deploy scope check

Signed-off-by: huanghongbo-hhb <[REDACTED_EMAIL]>

**File**: `pkg/microservice/aslan/core/workflow/service/workflow/controller/job/job_vm_deploy.go` (modified, +5/-3)
```diff
@@ -276,8 +276,10 @@ func (j VMDeployJobController) ToTask(taskID int64) ([]*commonmodels.JobTask, er
 	if err != nil {
 		return resp, fmt.Errorf("list private keys error: %v", err)
 	}
+	vmMap := make(map[string]*commonmodels.PrivateKey, len(vms))
 	projectVMs := make([]*commonmodels.PrivateKey, 0, len(vms))
 	for _, vm := range vms {
+		vmMap[vm.ID.Hex()] = vm
 		if vm.IsAvailableToProject(j.workflow.Project) {
 			projectVMs = append(projectVMs, vm)
 		}
@@ -348,9 +350,9 @@ func (j VMDeployJobController) ToTask(taskID int64) ([]*commonmodels.JobTask, er
 			return resp, fmt.Errorf("get build info for service %s error: %v", vmDeployInfo.ServiceName, err)
 		}
 		for _, sshID := range deployInfo.SSHs {
-			vm, findErr := commonrepo.NewPrivateKeyColl().Find(commonrepo.FindPrivateKeyOption{ID: sshID})
-			if findErr != nil {
-				return resp, fmt.Errorf("find ssh host %s error: %v", sshID, findErr)
+			vm, ok := vmMap[sshID]
+			if !ok {
+				return resp, fmt.Errorf("find ssh host %s error: host not found", sshID)
 			}
 			if !vm.IsAvailableToProject(j.workflow.Project) {
 				return resp, fmt.Errorf("host %s is outside project %s scope", vm.Name, j.workflow.Project)
```

---

### Incident Patch 10: `716219e9` (2026-09-28)
**Commit Message**: fix: keep project host list to project-owned hosts

Signed-off-by: huanghongbo-hhb <[REDACTED_EMAIL]>

**File**: `pkg/microservice/aslan/core/common/repository/mongodb/private_key.go` (modified, +1/-7)
```diff
@@ -123,13 +123,7 @@ func (c *PrivateKeyColl) List(args *PrivateKeyArgs) ([]*models.PrivateKey, error
 			}
 		}
 	case args.ProjectName != "":
-		query["$or"] = bson.A{
-			bson.M{"project_name": args.ProjectName},
-			bson.M{
-				"project_name": bson.M{"$exists": false},
-				"projects":     bson.M{"$in": bson.A{args.ProjectName, setting.AllProjects}},
-			},
-		}
+		query["project_name"] = args.ProjectName
 	}
 
 	resp := make([]*models.PrivateKey, 0)
```

---

### Incident Patch 11: `27ee755f` (2026-09-28)
**Commit Message**: fix: filter system hosts by project scope

Signed-off-by: huanghongbo-hhb <[REDACTED_EMAIL]>

**File**: `pkg/microservice/aslan/core/common/repository/mongodb/private_key.go` (modified, +6/-0)
```diff
@@ -116,6 +116,12 @@ func (c *PrivateKeyColl) List(args *PrivateKeyArgs) ([]*models.PrivateKey, error
 	switch {
 	case args.SystemOnly:
 		query["project_name"] = bson.M{"$exists": false}
+		if args.ProjectName != "" {
+			query["$or"] = bson.A{
+				bson.M{"projects": nil},
+				bson.M{"projects": bson.M{"$in": bson.A{args.ProjectName, setting.AllProjects}}},
+			}
+		}
 	case args.ProjectName != "":
 		query["$or"] = bson.A{
 			bson.M{"project_name": args.ProjectName},
```

**File**: `pkg/microservice/aslan/core/system/handler/private_key.go` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ func ListPrivateKeys(c *gin.Context) {
 	//	return
 	//}
 
-	ctx.Resp, ctx.RespErr = service.ListPrivateKeys(encryptedKey, "", c.Query("keyword"), true, ctx.Logger)
+	ctx.Resp, ctx.RespErr = service.ListPrivateKeys(encryptedKey, c.Query("projectName"), c.Query("keyword"), true, ctx.Logger)
 }
 
 func GetPrivateKey(c *gin.Context) {
```

---

### Incident Patch 12: `dbd0311e` (2026-09-24)
**Commit Message**: Merge pull request #5004 from huanghongbo-hhb/fix/openapi-build-detail-parameters

fix: give the build OpenAPI its own parameter contract

**File**: `pkg/microservice/aslan/core/build/service/openapi.go` (modified, +8/-22)
```diff
@@ -109,9 +109,14 @@ func generateBuildModuleFromOpenAPIRequest(ctx *internalhandler.Context, origina
 		build.Source = originalBuild.Source
 	}
 
+	var existingEnvs commonmodels.KeyValList
+	if originalBuild != nil && originalBuild.PreBuild != nil {
+		existingEnvs = originalBuild.PreBuild.Envs
+	}
+
 	prebuildInfo := &commonmodels.PreBuild{
 		BuildOS:  req.BuildOS,
-		Envs:     openapitool.ToKeyValList(req.Parameters),
+		Envs:     openapitool.ToKeyValList(req.Parameters, existingEnvs),
 		Installs: openapitool.ToBuildInstalls(req.Installs),
 	}
 
@@ -532,18 +537,7 @@ func OpenAPIGetBuildModule(name, serviceName, serviceModule, projectName string,
 					resp.Repos = append(resp.Repos, repo)
 				}
 
-				for _, kv := range svcBuild.Envs {
-					newKV := &commonmodels.ServiceKeyVal{
-						Key:          kv.Key,
-						Value:        kv.Value,
-						Type:         kv.Type,
-						ChoiceOption: kv.ChoiceOption,
-						ChoiceValue:  kv.ChoiceValue,
-						IsCredential: kv.IsCredential,
-					}
-
-					resp.Parameters = append(resp.Parameters, newKV)
-				}
+				resp.Parameters = openapitool.ToOpenAPIBuildParameters(svcBuild.Envs)
 
 				break
 			}
@@ -596,15 +590,7 @@ func OpenAPIGetBuildModule(name, serviceName, serviceModule, projectName string,
 	}
 
 	if len(resp.Parameters) == 0 {
-		resp.Parameters = make([]*commonmodels.ServiceKeyVal, 0)
-		for _, kv := range build.PreBuild.Envs {
-			resp.Parameters = append(resp.Parameters, &commonmodels.ServiceKeyVal{
-				Key:          kv.Key,
-				Value:        kv.Value,
-				Type:         kv.Type,
-				IsCredential: kv.IsCredential,
-			})
-		}
+		resp.Parameters = openapitool.ToOpenAPIBuildParameters(build.PreBuild.Envs)
 	}
 
 	resp.Outputs = build.Outputs
```

**File**: `pkg/microservice/aslan/core/build/service/types.go` (modified, +1/-1)
```diff
@@ -123,7 +123,7 @@ type OpenAPIBuildDetailResp struct {
 	BuildEnv        *OpenAPIBuildEnv                  `json:"build_env"`
 	AdvancedSetting *types.OpenAPIAdvancedSetting     `json:"advanced_settings"`
 	BuildScript     string                            `json:"build_script"`
-	Parameters      []*commonmodels.ServiceKeyVal     `json:"parameters"`
+	Parameters      []*types.OpenAPIBuildParameter    `json:"parameters"`
 	Outputs         []*commonmodels.Output            `json:"outputs"`
 	PostBuild       *commonmodels.PostBuild           `json:"post_build"`
 }
```

**File**: `pkg/tool/openapi/conversion.go` (modified, +55/-3)
```diff
@@ -143,22 +143,74 @@ func ToBuildInstalls(installs []*types.OpenAPIToolItem) []*models.Item {
 	return ret
 }
 
-func ToKeyValList(parameters []*types.ParameterSetting) models.KeyValList {
+// ToKeyValList converts OpenAPI build parameters into build envs. Optional fields
+// left out of a parameter keep the value of the existing env with the same key and type,
+// so clients unaware of those fields do not clear them on update.
+func ToKeyValList(parameters []*types.ParameterSetting, existing models.KeyValList) models.KeyValList {
+	existingMap := make(map[string]*models.KeyVal, len(existing))
+	for _, kv := range existing {
+		existingMap[kv.Key] = kv
+	}
+
 	ret := make([]*models.KeyVal, 0)
 	for _, parameter := range parameters {
-		ret = append(ret, &models.KeyVal{
+		kv := &models.KeyVal{
 			Key:          parameter.Key,
 			Value:        parameter.DefaultValue,
 			Type:         models.ParameterSettingType(parameter.Type),
 			ChoiceOption: parameter.ChoiceOption,
 			ChoiceValue:  parameter.ChoiceValue,
 			IsCredential: parameter.IsCredential,
 			Description:  parameter.Description,
-		})
+		}
+		if old, ok := existingMap[kv.Key]; ok && old.Type == kv.Type {
+			kv.Required = old.Required
+			kv.RegistryID = old.RegistryID
+			kv.Script = old.Script
+			kv.CallFunction = old.CallFunction
+			kv.FilePath = old.FilePath
+		}
+		if parameter.Required != nil {
+			kv.Required = *parameter.Required
+		}
+		if parameter.RegistryID != nil {
+			kv.RegistryID = *parameter.RegistryID
+		}
+		if parameter.Script != nil {
+			kv.Script = *parameter.Script
+		}
+		if parameter.CallFunction != nil {
+			kv.CallFunction = *parameter.CallFunction
+		}
+		if parameter.FilePath != nil {
+			kv.FilePath = *parameter.FilePath
+		}
+		ret = append(ret, kv)
 	}
 	return models.KeyValList(ret)
 }
 
+func ToOpenAPIBuildParameters(kvs models.KeyValList) []*types.OpenAPIBuildParameter {
+	ret := make([]*types.OpenAPIBuildParameter, 0, len(kvs))
+	for _, kv := range kvs {
+		ret = append(ret, &types.OpenAPIBuildParameter{
+			Key:          kv.Key,
+			Value:        kv.Value,
+			Type:         types.ParameterSettingType(kv.Type),
+			ChoiceOption: kv.ChoiceOption,
+			ChoiceValue:  kv.ChoiceValue,
+			IsCredential: kv.IsCredential,
+			Description:  kv.Description,
+			Required:     kv.Required,
+			RegistryID:   kv.RegistryID,
+			Script:       kv.Script,
+			CallFunction: kv.CallFunction,
+			FilePath:     kv.FilePath,
+		})
+	}
+	return ret
+}
+
 func ToKeyVals(keyValues []*types.KeyValue) []*util.KeyValue {
 	ret := make([]*util.KeyValue, 0)
 	for _, keyValue := range keyValues {
```

**File**: `pkg/types/workflow.go` (modified, +40/-0)
```diff
@@ -50,6 +50,46 @@ type ParameterSetting struct {
 	IsCredential bool `json:"is_credential"`
 	// 参数描述
 	Description string `json:"description"`
+	// 以下字段不传时，更新构建会保留同名同类型参数的已有配置
+	// 是否必填
+	Required *bool `json:"required,omitempty"`
+	// 镜像仓库 ID，仅 image 类型使用
+	RegistryID *string `json:"registry_id,omitempty"`
+	// 动态变量代码块，仅 script 类型使用
+	Script *string `json:"script,omitempty"`
+	// 动态变量调用函数，仅 script 类型使用
+	CallFunction *string `json:"call_function,omitempty"`
+	// 文件路径，仅 file 类型使用
+	FilePath *string `json:"file_path,omitempty"`
+}
+
+// OpenAPIBuildParameter 是构建详情 OpenAPI 返回的自定义变量，字段与 ParameterSetting 对应，
+// 调用方可以把 value 填回 default_value 后原样写回。
+type OpenAPIBuildParameter struct {
+	// 参数名称
+	Key string `json:"key"`
+	// 参数值
+	Value string `json:"value"`
+	// 参数类型
+	Type ParameterSettingType `json:"type,omitempty"`
+	// 可选值列表
+	ChoiceOption []string `json:"choice_option,omitempty"`
+	// 多选值列表
+	ChoiceValue []string `json:"choice_value,omitempty"`
+	// 是否为敏感信息
+	IsCredential bool `json:"is_credential"`
+	// 参数描述
+	Description string `json:"description"`
+	// 是否必填
+	Required bool `json:"required"`
+	// 镜像仓库 ID，仅 image 类型使用
+	RegistryID string `json:"registry_id,omitempty"`
+	// 动态变量代码块，仅 script 类型使用
+	Script string `json:"script,omitempty"`
+	// 动态变量调用函数，仅 script 类型使用
+	CallFunction string `json:"call_function,omitempty"`
+	// 文件路径，仅 file 类型使用
+	FilePath string `json:"file_path,omitempty"`
 }
 
 type ExternalSetting struct {
```

---

### Incident Patch 13: `d2d5c78a` (2026-09-22)
**Commit Message**: fix(webhook): ignore non-code GitHub PR events for tests and scans

Signed-off-by: Patrick Zhao <[REDACTED_EMAIL]>

**File**: `pkg/microservice/aslan/core/workflow/service/webhook/github.go` (modified, +32/-3)
```diff
@@ -355,7 +355,15 @@ func ProcessGithubWebHookForTest(payload []byte, req *http.Request, requestID st
 	}
 
 	switch et := event.(type) {
-	case *github.PullRequestEvent, *github.PushEvent, *github.CreateEvent:
+	case *github.PullRequestEvent:
+		if !shouldTriggerByGithubPullRequestEvent(et) {
+			return nil
+		}
+		if err = TriggerTestByGithubEvent(et, string(payload), requestID, log); err != nil {
+			log.Errorf("TriggerTestByGithubEvent error: %s", err)
+			return e.ErrGithubWebHook.AddErr(err)
+		}
+	case *github.PushEvent, *github.CreateEvent:
 		if err = TriggerTestByGithubEvent(et, string(payload), requestID, log); err != nil {
 			log.Errorf("TriggerTestByGithubEvent error: %s", err)
 			return e.ErrGithubWebHook.AddErr(err)
@@ -389,7 +397,15 @@ func ProcessGithubWebhookForScanning(payload []byte, req *http.Request, requestI
 	log.Infof("[Webhook] event: %s delivery id: %s received for scanning trigger", hookType, deliveryID)
 
 	switch et := event.(type) {
-	case *github.PullRequestEvent, *github.PushEvent, *github.CreateEvent:
+	case *github.PullRequestEvent:
+		if !shouldTriggerByGithubPullRequestEvent(et) {
+			return nil
+		}
+		if err = TriggerScanningByGithubEvent(et, string(payload), requestID, log); err != nil {
+			log.Errorf("TriggerScanningByGithubEvent error: %s", err)
+			return e.ErrGithubWebHook.AddErr(err)
+		}
+	case *github.PushEvent, *github.CreateEvent:
 		if err = TriggerScanningByGithubEvent(et, string(payload), requestID, log); err != nil {
 			log.Errorf("TriggerScanningByGithubEvent error: %s", err)
 			return e.ErrGithubWebHook.AddErr(err)
@@ -426,7 +442,7 @@ func ProcessGithubWebHookForWorkflowV4(payload []byte, req *http.Request, reques
 
 	switch et := event.(type) {
 	case *github.PullRequestEvent:
-		if *et.Action != "opened" && *et.Action != "synchronize" {
+		if !shouldTriggerByGithubPullRequestEvent(et) {
 			return nil
 		}
 		err = TriggerWorkflowV4ByGithubEvent(et, string(payload), baseURI, deliveryID, requestID, log)
@@ -450,6 +466,19 @@ func ProcessGithubWebHookForWorkflowV4(payload []byte, req *http.Request, reques
 	return nil
 }
 
+func shouldTriggerByGithubPullRequestEvent(event *github.PullRequestEvent) bool {
+	if event == nil {
+		return false
+	}
+
+	switch event.GetAction() {
+	case "opened", "synchronize":
+		return true
+	default:
+		return false
+	}
+}
+
 const (
 	EventTypePR   = "pr"
 	EventTypePush = "push"
```

**File**: `pkg/microservice/aslan/core/workflow/service/webhook/webhook_suite_test.go` (modified, +47/-0)
```diff
@@ -19,6 +19,7 @@ package webhook
 import (
 	"testing"
 
+	"github.com/google/go-github/v35/github"
 	. "github.com/onsi/ginkgo/v2"
 	. "github.com/onsi/gomega"
 )
@@ -27,3 +28,49 @@ func TestRoutes(t *testing.T) {
 	RegisterFailHandler(Fail)
 	RunSpecs(t, "webhook Suite")
 }
+
+func TestShouldTriggerByGithubPullRequestEvent(t *testing.T) {
+	tests := []struct {
+		name   string
+		event  *github.PullRequestEvent
+		wanted bool
+	}{
+		{
+			name:   "opened pull request",
+			event:  &github.PullRequestEvent{Action: github.String("opened")},
+			wanted: true,
+		},
+		{
+			name:   "synchronized pull request",
+			event:  &github.PullRequestEvent{Action: github.String("synchronize")},
+			wanted: true,
+		},
+		{
+			name:  "edited pull request",
+			event: &github.PullRequestEvent{Action: github.String("edited")},
+		},
+		{
+			name:  "labeled pull request",
+			event: &github.PullRequestEvent{Action: github.String("labeled")},
+		},
+		{
+			name:  "reopened pull request",
+			event: &github.PullRequestEvent{Action: github.String("reopened")},
+		},
+		{
+			name:  "missing action",
+			event: &github.PullRequestEvent{},
+		},
+		{
+			name: "nil event",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			if got := shouldTriggerByGithubPullRequestEvent(tt.event); got != tt.wanted {
+				t.Errorf("shouldTriggerByGithubPullRequestEvent() = %t, want %t", got, tt.wanted)
+			}
+		})
+	}
+}
```

---

### Incident Patch 14: `740106df` (2026-09-20)
**Commit Message**: fix: use scanning task links in github checks

Signed-off-by: Patrick Zhao <[REDACTED_EMAIL]>

**File**: `pkg/microservice/aslan/core/common/service/github/checks.go` (modified, +5/-0)
```diff
@@ -59,11 +59,16 @@ type GitCheck struct {
 	ProductName string
 	PipeType    config.PipelineType
 	TaskID      int64
+	TaskURL     string
 	TestReports []*commonmodels.TestSuite
 }
 
 // DetailsURL ...
 func (gc *GitCheck) DetailsURL() string {
+	if gc.TaskURL != "" {
+		return gc.TaskURL
+	}
+
 	url := GetTaskLink(
 		gc.AslanURL,
 		gc.ProductName,
```

**File**: `pkg/microservice/aslan/core/common/service/github/status.go` (modified, +14/-9)
```diff
@@ -45,24 +45,29 @@ type StatusOptions struct {
 	ProductName string
 	PipeType    config.PipelineType
 	TaskID      int64
+	TaskURL     string
 }
 
 func (c *Client) UpdateCheckStatus(opt *StatusOptions) error {
 	sc := setting.ProductName + "/" + opt.DisplayName
+	taskURL := opt.TaskURL
+	if taskURL == "" {
+		taskURL = GetTaskLink(
+			opt.AslanURL,
+			opt.ProductName,
+			opt.PipeName,
+			opt.DisplayName,
+			opt.PipeType,
+			opt.TaskID,
+		)
+	}
 	_, err := c.CreateStatus(
 		context.TODO(), opt.Owner, opt.Repo, opt.Ref,
 		&github.RepoStatus{
 			State:       &opt.State,
 			Description: &opt.Description,
-			TargetURL: github.String(GetTaskLink(
-				opt.AslanURL,
-				opt.ProductName,
-				opt.PipeName,
-				opt.DisplayName,
-				opt.PipeType,
-				opt.TaskID,
-			)),
-			Context: &sc,
+			TargetURL:   github.String(taskURL),
+			Context:     &sc,
 		})
 	return err
 }
```

**File**: `pkg/microservice/aslan/core/common/service/scmnotify/scmnotify.go` (modified, +47/-0)
```diff
@@ -32,6 +32,8 @@ import (
 	"github.com/koderover/zadig/v2/pkg/microservice/aslan/core/common/repository/mongodb"
 	"github.com/koderover/zadig/v2/pkg/microservice/aslan/core/common/service/github"
 	"github.com/koderover/zadig/v2/pkg/microservice/aslan/core/common/service/s3"
+	commonutil "github.com/koderover/zadig/v2/pkg/microservice/aslan/core/common/util"
+	"github.com/koderover/zadig/v2/pkg/setting"
 	"github.com/koderover/zadig/v2/pkg/shared/client/systemconfig"
 	e "github.com/koderover/zadig/v2/pkg/tool/errors"
 	s3tool "github.com/koderover/zadig/v2/pkg/tool/s3"
@@ -685,6 +687,7 @@ func (s *Service) CreateGitCheckForWorkflowV4(workflowArgs *models.WorkflowV4, t
 	if hook == nil || !hook.IsPr {
 		return nil
 	}
+	taskURL := getWorkflowV4TaskURL(workflowArgs, taskID, config.StatusCreated, log)
 
 	ghApp, err := github.GetGithubAppClientByOwner(hook.Owner)
 	if err != nil {
@@ -706,6 +709,7 @@ func (s *Service) CreateGitCheckForWorkflowV4(workflowArgs *models.WorkflowV4, t
 			ProductName: workflowArgs.Project,
 			PipeType:    config.WorkflowTypeV4,
 			TaskID:      taskID,
+			TaskURL:     taskURL,
 		}
 		checkID, err := ghApp.StartGitCheck(opt)
 		if err != nil {
@@ -735,6 +739,7 @@ func (s *Service) CreateGitCheckForWorkflowV4(workflowArgs *models.WorkflowV4, t
 		ProductName: workflowArgs.Project,
 		PipeType:    config.WorkflowTypeV4,
 		TaskID:      taskID,
+		TaskURL:     taskURL,
 	})
 }
 
@@ -744,6 +749,7 @@ func (s *Service) UpdateGitCheckForWorkflowV4(workflowArgs *models.WorkflowV4, t
 	if hook == nil || !hook.IsPr {
 		return nil
 	}
+	taskURL := getWorkflowV4TaskURL(workflowArgs, taskID, config.StatusRunning, log)
 
 	ghApp, err := github.GetGithubAppClientByOwner(hook.Owner)
 	if err != nil {
@@ -770,6 +776,7 @@ func (s *Service) UpdateGitCheckForWorkflowV4(workflowArgs *models.WorkflowV4, t
 			PipeType:    config.WorkflowTypeV4,
 			ProductName: workflowArgs.Project,
 			TaskID:      taskID,
+			TaskURL:     taskURL,
 		}
 
 		return ghApp.UpdateGitCheck(hook.CheckRunID, opt)
@@ -795,6 +802,7 @@ func (s *Service) UpdateGitCheckForWorkflowV4(workflowArgs *models.WorkflowV4, t
 		PipeType:    config.WorkflowTypeV4,
 		ProductName: workflowArgs.Project,
 		TaskID:      taskID,
+		TaskURL:     taskURL,
 	})
 }
 
@@ -804,6 +812,7 @@ func (s *Service) CompleteGitCheckForWorkflowV4(workflowArgs *models.WorkflowV4,
 	if hook == nil || !hook.IsPr {
 		return nil
 	}
+	taskURL := getWorkflowV4TaskURL(workflowArgs, taskID, status, log)
 
 	ghApp, err := github.GetGithubAppClientByOwner(hook.Owner)
 	if err != nil {
@@ -830,6 +839,7 @@ func (s *Service) CompleteGitCheckForWorkflowV4(workflowArgs *models.WorkflowV4,
 			PipeType:    config.WorkflowTypeV4,
 			ProductName: workflowArgs.Project,
 			TaskID:      taskID,
+			TaskURL:     taskURL,
 		}
 
 		return ghApp.CompleteGitCheck(hook.CheckRunID, getCheckStatus(status), opt)
@@ -856,9 +866,46 @@ func (s *Service) CompleteGitCheckForWorkflowV4(workflowArgs *models.WorkflowV4,
 		PipeType:    config.WorkflowTypeV4,
 		ProductName: workflowArgs.Project,
 		TaskID:      taskID,
+		TaskURL:     taskURL,
 	})
 }
 
+func getWorkflowV4TaskURL(workflowArgs *models.WorkflowV4, taskID int64, status config.Status, log *zap.SugaredLogger) string {
+	defaultURL := github.GetTaskLink(
+		configbase.SystemAddress(),
+		workflowArgs.Project,
+		workflowArgs.Name,
+		getDisplayName(workflowArgs),
+		config.WorkflowTypeV4,
+		taskID,
+	)
+
+	prefix := strings.TrimSuffix(setting.ScanWorkflowNamingConvention, "%s")
+	if !strings.HasPrefix(workflowArgs.Name, prefix) {
+		return defaultURL
+	}
+
+	scanningID := strings.TrimPrefix(workflowArgs.Name, prefix)
+	if scanningID == "" {
+		return defaultURL
+	}
+	scanning, err := mongodb.NewScanningColl().GetByID(scanningID)
+	if err != nil {
+		log.Warnf("failed to resolve scanning task link for workflow %s: %v", workflowArgs.Name, err)
+		return defaultURL
+	}
+
+	return commonutil.ScanningTaskURL(
+		configbase.SystemAddress(),
+		workflowArgs.Project,
+		scanning.Name,
+		taskID,
+		string(status),
+		scanningID,
+		string(scanning.ScannerType),
+	)
+}
+
 func getCheckStatus(status config.Status) github.CIStatus {
 	switch status {
 	case config.StatusCreated, config.StatusRunning:
```

**File**: `pkg/microservice/aslan/core/workflow/service/workflow/utils_test.go` (modified, +19/-0)
```diff
@@ -26,8 +26,27 @@ import (
 
 	"github.com/koderover/zadig/v2/pkg/microservice/aslan/config"
 	commonmodels "github.com/koderover/zadig/v2/pkg/microservice/aslan/core/common/repository/models"
+	githubservice "github.com/koderover/zadig/v2/pkg/microservice/aslan/core/common/service/github"
 )
 
+func TestGitCheckUsesExplicitTaskURL(t *testing.T) {
+	taskURL := "https://zadig.example/v1/projects/detail/demo/scanner/detail/review/task/7?id=scan-id&scannerType=ai_review"
+	check := &githubservice.GitCheck{
+		TaskURL:     taskURL,
+		AslanURL:    "https://zadig.example",
+		ProductName: "demo",
+		PipeName:    "zadig-scanning-scan-id",
+		DisplayName: "review",
+		PipeType:    config.WorkflowTypeV4,
+		TaskID:      7,
+	}
+
+	require.Equal(t, taskURL, check.DetailsURL())
+
+	check.TaskURL = ""
+	require.Equal(t, "https://zadig.example/v1/projects/detail/demo/pipelines/custom/zadig-scanning-scan-id/7?display_name=review", check.DetailsURL())
+}
+
 var _ = Describe("Testing utils", func() {
 
 	Context("validateHookNames", func() {
```

---

### Incident Patch 15: `91f2536c` (2026-09-18)
**Commit Message**: fix: use scanning task links for AI review notifications

Signed-off-by: Patrick Zhao <[REDACTED_EMAIL]>

**File**: `pkg/microservice/aslan/core/common/service/instantmessage/workflow_task.go` (modified, +30/-19)
```diff
@@ -46,6 +46,7 @@ import (
 	"github.com/koderover/zadig/v2/pkg/tool/lark"
 	"github.com/koderover/zadig/v2/pkg/tool/log"
 	"github.com/koderover/zadig/v2/pkg/tool/sonar"
+	"github.com/koderover/zadig/v2/pkg/types"
 	"github.com/koderover/zadig/v2/pkg/types/step"
 	"github.com/koderover/zadig/v2/pkg/util"
 )
@@ -1354,9 +1355,16 @@ func (w *Service) getNotificationContentWithOptions(notify *models.NotifyCtl, ta
 		workflowNotification.PendingStageName = opts.PendingStageName
 	}
 
-	if task.Type == config.WorkflowTaskTypeScanning {
-		segs := strings.Split(task.WorkflowName, "-")
-		workflowNotification.ScanningID = segs[len(segs)-1]
+	isScanningTask := task.Type == config.WorkflowTaskTypeScanning || strings.HasPrefix(task.WorkflowName, strings.TrimSuffix(setting.ScanWorkflowNamingConvention, "%s"))
+	if isScanningTask {
+		workflowNotification.ScanningID = strings.TrimPrefix(task.WorkflowName, strings.TrimSuffix(setting.ScanWorkflowNamingConvention, "%s"))
+		workflowNotification.ScanningName = task.WorkflowDisplayName
+		if scanning, err := commonrepo.NewScanningColl().GetByID(workflowNotification.ScanningID); err == nil {
+			workflowNotification.ScanningName = scanning.Name
+			workflowNotification.ScannerType = scanning.ScannerType
+		} else {
+			log.Errorf("failed to get scanner type for scanning %s: %v", workflowNotification.ScanningID, err)
+		}
 	}
 
 	webhookNotify := &webhooknotify.WorkflowNotify{
@@ -1377,6 +1385,9 @@ func (w *Service) getNotificationContentWithOptions(notify *models.NotifyCtl, ta
 		TaskCreatorEmail:    task.TaskCreatorEmail,
 		TaskType:            task.Type,
 	}
+	if isScanningTask {
+		webhookNotify.TaskType = config.WorkflowTaskTypeScanning
+	}
 
 	tplTitle := "{{if and (ne .WebHookType \"feishu\") (ne .WebHookType \"feishu_app\") (ne .WebHookType \"feishu_person\")}}### {{end}}{{if eq .WebHookType \"dingding\"}}<font color=\"{{ getColor .Task.Status }}\"><b>{{end}}{{getIcon .Task.Status }}{{getTaskType .Task.Type}} {{.Task.WorkflowDisplayName}} #{{.Task.TaskID}} {{ taskStatus .Task.Status }}{{if eq .WebHookType \"dingding\"}}</b></font>{{end}} \n"
 	mailTplTitle := "{{getIcon .Task.Status }} {{getTaskType .Task.Type}} {{.Task.WorkflowDisplayName}}#{{.Task.TaskID}} {{ taskStatus .Task.Status }}"
@@ -1422,20 +1433,20 @@ func (w *Service) getNotificationContentWithOptions(notify *models.NotifyCtl, ta
 	buttonContent := getText("notificationTextClickForMore", language)
 	workflowDetailURLTpl := ""
 	workflowDetailURL := ""
-	switch task.Type {
-	case config.WorkflowTaskTypeWorkflow:
-		workflowDetailURLTpl = "{{.BaseURI}}/v1/projects/detail/{{.Task.ProjectName}}/pipelines/custom/{{.Task.WorkflowName}}/{{.Task.TaskID}}?display_name={{.EncodedDisplayName}}"
-		workflowDetailURL = fmt.Sprintf("%s/v1/projects/detail/%s/pipelines/custom/%s?display_name=%s", configbase.SystemAddress(), task.ProjectName, task.WorkflowName, url.PathEscape(task.WorkflowDisplayName))
-	case config.WorkflowTaskTypeScanning:
-		workflowDetailURLTpl = "{{.BaseURI}}/v1/projects/detail/{{.Task.ProjectName}}/scanner/detail/{{.Task.WorkflowDisplayName}}/task/{{.Task.TaskID}}?status={{.Task.Status}}&id={{.ScanningID}}"
-		workflowDetailURL = fmt.Sprintf("%s/v1/projects/detail/%s/scanner/detail/%s/task/%d?id=%s", configbase.SystemAddress(), task.ProjectName, url.PathEscape(task.WorkflowDisplayName), task.TaskID, workflowNotification.ScanningID)
-	case config.WorkflowTaskTypeTesting:
-		workflowDetailURLTpl = "{{.BaseURI}}/v1/projects/detail/{{.Task.ProjectName}}/test/detail/function/{{.Task.WorkflowDisplayName}}/{{.Task.TaskID}}?status={{.Task.Status}}&id=&display_name={{.Task.WorkflowDisplayName}}"
-		workflowDetailURL = fmt.Sprintf("%s/v1/projects/detail/%s/test/detail/function/%s/%d", configbase.SystemAddress(), task.ProjectName, url.PathEscape(task.WorkflowDisplayName), task.TaskID)
-	default:
-		workflowDetailURLTpl = "{{.BaseURI}}/v1/projects/detail/{{.Task.ProjectName}}/pipelines/custom/{{.Task.WorkflowName}}/{{.Task.TaskID}}?display_name={{.EncodedDisplayName}}"
-		workflowDetailURL = fmt.Sprintf("%s/v1/projects/detail/%s/pipelines/custom/%s?display_name=%s", configbase.SystemAddress(), task.ProjectName, task.WorkflowName, url.PathEscape(task.WorkflowDisplayName))
+	if isScanningTask {
+		workflowDetailURL = commonutil.ScanningTaskURL(configbase.SystemAddress(), task.ProjectName, workflowNotification.ScanningName, task.TaskID, string(task.Status), workflowNotification.ScanningID, string(workflowNotification.ScannerType))
+		workflowDetailURLTpl = workflowDetailURL
+	} else {
+		switch task.Type {
+		case config.WorkflowTaskTypeTesting:
+			workflowDetailURLTpl = "{{.BaseURI}}/v1/projects/detail/{{.Task.ProjectName}}/test/detail/function/{{.Task.WorkflowDisplayName}}/{{.Task.TaskID}}?status={{.Task.Status}}&id=&display_name={{.Task.WorkflowDisplayName}}"
+			workflowDetailURL = fmt.Sprintf("%s/v1/projects/detail/%s/test/detail/function/%s/%d", configbase.SystemAddress(), task.ProjectName, url.PathEscape(t
```

**File**: `pkg/microservice/aslan/core/common/util/workflow.go` (modified, +10/-0)
```diff
@@ -18,6 +18,7 @@ package util
 
 import (
 	"fmt"
+	"net/url"
 	"regexp"
 	"strings"
 
@@ -45,6 +46,15 @@ func GenScanningWorkflowName(scanningID string) string {
 	return fmt.Sprintf(setting.ScanWorkflowNamingConvention, scanningID)
 }
 
+func ScanningTaskURL(baseURI, project, scanningName string, taskID int64, status, scanningID, scannerType string) string {
+	link := fmt.Sprintf("%s/v1/projects/detail/%s/scanner/detail/%s/task/%d?status=%s&id=%s",
+		baseURI, url.PathEscape(project), url.PathEscape(scanningName), taskID, url.QueryEscape(status), url.QueryEscape(scanningID))
+	if scannerType != "" {
+		link += "&scannerType=" + url.QueryEscape(scannerType)
+	}
+	return link
+}
+
 func GenTestingWorkflowName(testingName string) string {
 	return fmt.Sprintf(setting.TestWorkflowNamingConvention, testingName)
 }
```

**File**: `pkg/microservice/aslan/core/workflow/service/workflow/controller/job/job_scanning.go` (modified, +16/-3)
```diff
@@ -28,6 +28,7 @@ import (
 	"go.uber.org/zap"
 	"k8s.io/apimachinery/pkg/util/sets"
 
+	configbase "github.com/koderover/zadig/v2/pkg/config"
 	"github.com/koderover/zadig/v2/pkg/microservice/aslan/config"
 	commonmodels "github.com/koderover/zadig/v2/pkg/microservice/aslan/core/common/repository/models"
 	commonrepo "github.com/koderover/zadig/v2/pkg/microservice/aslan/core/common/repository/mongodb"
@@ -571,7 +572,7 @@ func (j ScanningJobController) toJobTask(jobSubTaskID int, scanning *commonmodel
 	if err != nil {
 		return nil, fmt.Errorf("get keyvault envs error: %v", err)
 	}
-	allEnvs := append(envs, getScanningJobVariables(scanning.Repos, taskID, j.workflow.Project, j.workflow.Name, j.workflow.DisplayName, jobTask.Infrastructure, scanningType, serviceName, serviceModule, scanning.Name)...)
+	allEnvs := append(envs, getScanningJobVariables(scanning.Repos, taskID, j.workflow.Project, j.workflow.Name, j.workflow.DisplayName, jobTask.Infrastructure, scanningType, serviceName, serviceModule, scanning.Name, scanningInfo.ScannerType)...)
 	allEnvs = append(allEnvs, keyvaultEnvs...)
 
 	jobTaskSpec.Properties = commonmodels.JobProperties{
@@ -1118,7 +1119,7 @@ func (j ScanningJobController) toAIReviewJobTask(
 		ExecutePolicy:  j.executePolicy,
 	}
 
-	envs := getScanningJobVariables(scanning.Repos, taskID, j.workflow.Project, j.workflow.Name, j.workflow.DisplayName, infrastructure, scanningType, serviceName, serviceModule, scanning.Name)
+	envs := getScanningJobVariables(scanning.Repos, taskID, j.workflow.Project, j.workflow.Name, j.workflow.DisplayName, infrastructure, scanningType, serviceName, serviceModule, scanning.Name, types.ScannerTypeAIReview)
 	envs = append(envs,
 		&commonmodels.KeyVal{Key: "ZADIG_REVIEW_MODEL_PROTOCOL", Value: string(llmIntegration.Protocol)},
 		&commonmodels.KeyVal{Key: "ZADIG_REVIEW_MODEL_NAME", Value: llmIntegration.Model},
@@ -1402,11 +1403,23 @@ func fillScanningDetail(moduleScanning *commonmodels.Scanning) error {
 	return nil
 }
 
-func getScanningJobVariables(repos []*types.Repository, taskID int64, project, workflowName, workflowDisplayName, infrastructure, scanningType, serviceName, serviceModule, scanningName string) []*commonmodels.KeyVal {
+func getScanningJobVariables(repos []*types.Repository, taskID int64, project, workflowName, workflowDisplayName, infrastructure, scanningType, serviceName, serviceModule, scanningName string, scannerType types.ScannerType) []*commonmodels.KeyVal {
 	ret := []*commonmodels.KeyVal{}
 
 	// basic envs
 	ret = append(ret, prepareDefaultWorkflowTaskEnvs(project, workflowName, workflowDisplayName, infrastructure, taskID)...)
+	if scannerType == types.ScannerTypeAIReview {
+		prefix := strings.TrimSuffix(setting.ScanWorkflowNamingConvention, "%s")
+		if strings.HasPrefix(workflowName, prefix) {
+			scanningID := strings.TrimPrefix(workflowName, prefix)
+			for _, env := range ret {
+				if env.Key == "TASK_URL" {
+					env.Value = commonutil.ScanningTaskURL(configbase.SystemAddress(), project, scanningName, taskID, string(config.StatusRunning), scanningID, string(scannerType))
+					break
+				}
+			}
+		}
+	}
 	// repo envs
 	ret = append(ret, getReposVariables(repos)...)
 
```

**File**: `pkg/microservice/aslan/core/workflow/service/workflow/controller/workflow.go` (modified, +7/-0)
```diff
@@ -515,6 +515,13 @@ func (w *Workflow) getWorkflowDefaultParams(taskID int64, creator, account, uid
 			taskID,
 			url.QueryEscape(w.workflowName()),
 		)
+		prefix := strings.TrimSuffix(setting.ScanWorkflowNamingConvention, "%s")
+		if strings.HasPrefix(w.workflowID(), prefix) {
+			scanningID := strings.TrimPrefix(w.workflowID(), prefix)
+			if scanning, err := commonrepo.NewScanningColl().GetByID(scanningID); err == nil {
+				detailURL = commonutil.ScanningTaskURL(configbase.SystemAddress(), w.Project, scanning.Name, taskID, string(config.StatusRunning), scanningID, string(scanning.ScannerType))
+			}
+		}
 	}
 	resp = append(resp, &commonmodels.Param{Name: "workflow.task.url", Value: detailURL, ParamsType: "string", IsCredential: false})
 
```

#### Recent Merged Pull Requests:
- **PR #5006** (2026-09-24): fix: honor Helm values image tag updates (@PetrusZ)
- **PR #5005** (2026-09-22): cherry pick #5001 to release 5.0.0 (@PetrusZ)
- **PR #5004** (2026-09-24): fix: give the build OpenAPI its own parameter contract (@huanghongbo-hhb)
- **PR #5001** (2026-09-22): fix: update multi svc in env may cause data lost in helm project (@PetrusZ)
- **PR #5000** (2026-09-28): feat: release plan owner groups (@Cynthia-0203)
- **PR #4997** (2026-09-18): cherry pick #4996 to release 5.0.0 (@PetrusZ)
- **PR #4996** (2026-09-18): fix: avoid resource override for image-only deploys (@PetrusZ)
- **PR #4993** (2026-09-24): fix: correct scan task links and filter non-code GitHub PR event (@PetrusZ)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

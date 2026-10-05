# Forensic Learning Record (Deep Inspection): trailbaseio/trailbase

> **Canonical Artifact**: `07_PROJECT_LEARNING/trailbaseio-trailbase-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/trailbaseio/trailbase](https://github.com/trailbaseio/trailbase))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:47:22.862Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `trailbaseio/trailbase`
- **Description**: An open, sub-millisecond, single-executable Firebase alternative with type-safe APIs, built-in WebAssembly runtime, realtime subscriptions, auth, MCP and admin UI built on Rust, SQLite (PG) & Wasmtime.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5636 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `client/go/trailbase/client.go`
```
package trailbase

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
)

type FetchError struct {
	StatusCode int
	Message    string
	URL        *url.URL
}

func (e *FetchError) Error() string {
	if e.URL != nil {
		return fmt.Sprintf("FetchError(%d: %s, %s)", e.StatusCode, e.Message, e.URL)
	}
	return fmt.Sprintf("FetchError(%d: %s)", e.StatusCode, e.Message)
}

type User struct {
	Sub      string
	Email    *string
	Username *string
}

type Tokens struct {
	AuthToken    string  `json:"auth_token"`
	RefreshToken *string `json:"refresh_token,omitempty"`
	CsrfToken    *string `json:"csrf_token,omitempty"`
}

type MultiFactorAuthToken struct {
	Token string `json:"mfa_token"`
}

type JwtTokenClaims struct {
	Sub       string  `json:"sub"`
	Iat       int64   `json:"iat"`
	Exp       int64   `json:"exp"`
	Email     *string `json:"email,omitempty"`
	Username  *string `json:"username,omitempty"`
	CsrfToken string  `json:"csrf_token"`
}

type state struct {
	tokens Tokens
	claims JwtTokenClaims
}

type Header struct {
	key   string
	value string
}

type QueryParam struct {
	key   string
	value string
}

type TokenState struct {
	s       *state
	headers []Header
}

func NewTokenState(tokens *Tokens) (*TokenState, error) {
	if tokens == nil {
		return &TokenState{
			s:       nil,
			headers: buildHeaders(tokens),
		}, nil
	}

	claims, err := decodeJwtTokenClaims(tokens.AuthToken)
	if err != nil {
		return nil, err
	}

	return &TokenState{
		s: &state{
			tokens: *tokens,
			claims: *claims,
		},
		headers: buildHeaders(tokens),
	}, nil
}

func NewClient(baseUrl string) (*Client, error) {
	return NewClientWithTokens(baseUrl, nil)
}

func NewClientWithTokens(baseUrl string, tokens *Tokens) (*Client, error) {
	base, err := url.Parse(baseUrl)
	if err != nil {
		return nil, err
	}
	tokenState, err := NewTokenState(tokens)
	if err != nil {
		return nil, err
	}
	return &Client{
		client: &defaultTransport{
			base:   base,
			client: &http.Client{},
		},
		tokenState: tokenState,
		tokenMutex: &sync.Mutex{},
	}, nil
}

type Client struct {
	client Transport

	tokenState *TokenState
	tokenMutex *sync.Mutex
}

func (c *Client) BaseUrl() *url.URL {
	return c.client.BaseUrl()
}

func (c *Client) Tokens() *Tokens {
	c.tokenMutex.Lock()
	defer c.tokenMutex.Unlock()
	if c.tokenState != nil && c.tokenState.s != nil {
		return &c.tokenState.s.tokens
	}
	return nil
}

func (c *Client) User() *User {
	c.tokenMutex.Lock()
	defer c.tokenMutex.Unlock()
	if c.tokenState != nil && c.tokenState.s != nil {
		claims := c.tokenState.s.claims
		return &User{
			Sub:      claims.Sub,
			Email:    claims.Email,
			Username: claims.Username,
		}
	}
	return nil
}

func (c *Client) Records[T any](name string) RecordApi[T] {
	// Go 1.27 finally introduced generic methods. We keep the old function constructor around for migration.
	return NewRecordApi[T](c, name)
}

func (c *Client) Execute(operations []Operation, transaction bool) ([]OperationResult, error) {
	type Request struct {
		Ops         []map[string]jsonOp `json:"operations"`
		Transaction bool                `json:"transaction"`
	}

	ops := make([]map[string]jsonOp, len(operations))
	for i, v := range operations {
		ops[i] = v.json()
	}

	reqBody, err := json.Marshal(Request{
		Ops:         ops,
		Transaction: transaction,
	})
	if err != nil {
		return nil, err
	}

	resp, err := c.do("POST", transactionBasePath, reqBody, nil)
	if err != nil {
		return nil, err
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	type TransactionResponse struct {
		Results []OperationResult `json:"results"`
	}

	var response TransactionResponse
	err = json.Unmarshal(respBody, &response)
	if err != nil {
		return nil, err
	}

	return response.Results, nil
}

type RegisterOptions struct {
	Password string
	Email    *string
	Username *string
	// Defaults to Password.
	PasswordRepeat *string
	// Where the verification link sends the user after confirming.
	RedirectUri *string
}

// Register registers a new user. It does not sign them in: accounts with an email
// address have to verify it before they can sign in.
func (c *Client) Register(opts RegisterOptions) error {
	type Request struct {
		Email          *string `json:"email"`
		Username       *string `json:"username"`
		Password       string  `json:"password"`
		PasswordRepeat string  `json:"password_repeat"`
		RedirectUri    *string `json:"redirect_uri"`
	}

	passwordRepeat := opts.Password
	if opts.PasswordRepeat != nil {
		passwordRepeat = *opts.PasswordRepeat
	}

	reqBody, err := json.Marshal(Request{
		Email:          opts.Email,
		Username:       opts.Username,
		Password:       opts.Password,
		PasswordRepeat: passwordRepeat,
		RedirectUri:    opts.RedirectUri,
	})
	if err != nil {
		return err
	}

	_, err = c.do("POST", authApi+"/register", reqBody, nil)
	if err != nil {
		return err
	}

	return nil
}

func (c *Client) Login(emailOrUsername string, password string) (*MultiFactorAuthToken, error) {
	type Credentials struct {
		Email    string `json:"email_or_username"`
		Password string `json:"password"`
	}

	reqBody, err := json.Marshal(Credentials{
		Email:    emailOrUsername,
		Password: password,
	})
	if err != nil {
		return nil, err
	}

	resp, err := c.do("POST", authApi+"/login", reqBody, nil)
	if err != nil {
		ferr, ok := err.(*FetchError)
		if ok && ferr != nil && ferr.StatusCode == 403 {
			var mfaToken MultiFactorAuthToken
			err = json.Unmarshal([]byte(ferr.Message), &mfaToken)
			if err != nil {
				return nil, err
			}

			return &mfaToken, nil
		}

		return nil, err
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var tokens Tokens
	err = json.Unmarshal(respBody, &tokens)
	if err != nil {
		return nil, err
	}

	c.updateTokens(&tokens)

	return nil, nil
}

func (c *Client) LoginSecond(token *MultiFactorAuthToken, code string) error {
	type Credentials struct {
		Token    string `json:"mfa_token"`
		TotpCode string `json:"totp"`
	}

	reqBody, err := json.Marshal(Credentials{
		Token:    token.Token,
		TotpCode: code,
	})
	if err != nil {
		return err
	}

	resp, err := c.do("POST", authApi+"/login_mfa", reqBody, nil)
	if err != nil {
		return err
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var tokens Tokens
	err = json.Unmarshal(respBody, &tokens)
	if err != nil {
		return err
	}

	c.updateTokens(&tokens)

	return nil
}

func (c *Client) RequestOtp(emailOrUsername string) error {
	type Request struct {
		EmailOrUsername string  `json:"email_or_username"`
		RedirectUri     *string `json:"redirect_uri,omitempty"`
	}

	reqBody, err := json.Marshal(Request{
		EmailOrUsername: emailOrUsername,
		RedirectUri:     nil,
	})
	if err != nil {
		return err
	}

	resp, err := c.do("POST", authApi+"/otp/request", reqBody, nil)
	if err != nil {
		return err
	}
	_ = resp

	return nil
}

func (c *Client) LoginOtp(email string, code string) error {
	type Request struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}

	reqBody, err := json.Marshal(Request{
		Email: email,
		Code:  code,
	})
	if err != nil {
		return err
	}

	resp, err := c.do("POST", authApi+"/otp/login", reqBody, nil)
	if err != nil {
		return err
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var tokens Tokens
	err = json.Unmarshal(respBody, &tokens)
	if err != nil {
		return err
	}
	c.updateTokens(&tokens)

	return nil
}

func (c *Client) LoginAnonymously() error {
	type Request struct{}

	reqBody, err := json.Marshal(Request{})
	if err != nil {
		return err
	}

	resp, err := c.do("POST", authApi+"/login_anonymous", reqBody, nil)
	if err != nil {
		return err
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var tokens Tokens
	err = json.Unmarshal(respBody, &tokens)
	if err != nil {
		return err
	}
	c.updateTokens(&tokens)

	return nil
}

func (c *Client) Logout() error
```

### Core Architecture Module: `client/go/trailbase/event.go`
```
package trailbase

import (
	"bytes"

	"encoding/json"
)

type ValueEvent interface {
	Value() *map[string]any
}

type InsertEvent struct {
	value map[string]any
}

func (ev *InsertEvent) Value() *map[string]any {
	return &ev.value
}

type UpdateEvent struct {
	value map[string]any
}

func (ev *UpdateEvent) Value() *map[string]any {
	return &ev.value
}

type DeleteEvent struct {
	value map[string]any
}

func (ev *DeleteEvent) Value() *map[string]any {
	return &ev.value
}

type ErrorEvent struct {
	Status  int64
	Message *string
}

type Event struct {
	Seq   *int64
	Value ValueEvent
	Error *ErrorEvent
}

func parseEvent(msg []byte) (*Event, error) {
	if !bytes.HasPrefix(msg, []byte("data: ")) {
		return nil, nil
	}

	var evMap map[string]any
	err := json.Unmarshal(msg[6:], &evMap)
	if err != nil {
		return nil, err
	}

	var seq *int64 = nil
	seqf, ok := evMap["seq"].(float64)
	if ok {
		seqi := int64(seqf)
		seq = &seqi
	}

	if val, ok := evMap["Error"]; ok {
		var errObj = val.(map[string]any)
		var msg, ok = errObj["message"].(string)
		if ok {
			return &Event{
				Seq: seq,
				Error: &ErrorEvent{
					Status:  int64(errObj["status"].(float64)),
					Message: &msg,
				},
			}, nil
		}

		return &Event{
			Seq: seq,
			Error: &ErrorEvent{
				Status: int64(errObj["status"].(float64)),
			},
		}, nil
	} else if val, ok := evMap["Insert"]; ok {
		return &Event{
			Seq: seq,
			Value: &InsertEvent{
				value: val.(map[string]any),
			},
		}, nil
	} else if val, ok := evMap["Update"]; ok {
		return &Event{
			Seq: seq,
			Value: &UpdateEvent{
				value: val.(map[string]any),
			},
		}, nil
	} else if val, ok := evMap["Delete"]; ok {
		return &Event{
			Seq: seq,
			Value: &DeleteEvent{
				value: val.(map[string]any),
			},
		}, nil
	}

	return nil, nil
}

```

### Core Architecture Module: `client/go/trailbase/operation.go`
```
package trailbase

type jsonOp struct {
	Name  string  `json:"api_name"`
	Id    *string `json:"record_id,omitempty"`
	Value any     `json:"value,omitempty"`
}

type Operation interface {
	json() map[string]jsonOp
}

type CreateOperation[T any] struct {
	ApiName string
	Value   T
}

func (o CreateOperation[T]) json() map[string]jsonOp {
	return map[string]jsonOp{
		"Create": jsonOp{
			Name:  o.ApiName,
			Value: &o.Value,
		},
	}
}

type UpdateOperation[T any] struct {
	ApiName string
	Id      RecordId
	Value   T
}

func (o UpdateOperation[T]) json() map[string]jsonOp {
	id := o.Id.ToString()
	return map[string]jsonOp{
		"Update": jsonOp{
			Name:  o.ApiName,
			Id:    &id,
			Value: &o.Value,
		},
	}
}

type DeleteOperation[T any] struct {
	ApiName string
	Id      RecordId
}

func (o DeleteOperation[T]) json() map[string]jsonOp {
	id := o.Id.ToString()
	return map[string]jsonOp{
		"Delete": jsonOp{
			Name: o.ApiName,
			Id:   &id,
		},
	}
}

type OperationResult struct {
	Id  *StringRecordId `json:"Id,omitempty"`
	Err *string         `json:"Error,omitempty"`
}

```

### Core Architecture Module: `client/go/trailbase/record_api.go`
```
package trailbase

import (
	"errors"
	"fmt"
	"io"
	"strings"

	"encoding/json"
)

type RecordId interface {
	ToString() string
}

type IntRecordId int64

func (id IntRecordId) ToString() string {
	return fmt.Sprint(id)
}

type StringRecordId string

func (id StringRecordId) ToString() string {
	return string(id)
}

type RecordIdResponse struct {
	Ids []string `json:"ids"`
}

type ListResponse[T any] struct {
	Records    []T     `json:"records"`
	Cursor     *string `json:"cursor,omitempty"`
	TotalCount *int64  `json:"total_count,omitempty"`
}

type RecordApi[T any] struct {
	client *Client
	name   string
}

func (r *RecordApi[T]) CreateOp(record T) CreateOperation[T] {
	return CreateOperation[T]{
		ApiName: r.name,
		Value:   record,
	}
}

func (r *RecordApi[T]) Create(record T) (RecordId, error) {
	reqBody, err := json.Marshal(record)
	if err != nil {
		return nil, err
	}

	resp, err := r.client.do("POST", fmt.Sprintf("%s/%s", recordApi, r.name), reqBody, nil)
	if err != nil {
		return nil, err
	}
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var recordIdResponse RecordIdResponse
	err = json.Unmarshal(respBody, &recordIdResponse)
	if err != nil {
		return nil, err
	}

	if len(recordIdResponse.Ids) != 1 {
		return nil, errors.New("expected one id")
	}
	return StringRecordId(recordIdResponse.Ids[0]), nil
}

func (r *RecordApi[T]) Read(id RecordId) (*T, error) {
	resp, err := r.client.do("GET", fmt.Sprintf("%s/%s/%s", recordApi, r.name, id.ToString()), nil, nil)
	if err != nil {
		return nil, err
	}
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var value T
	err = json.Unmarshal(respBody, &value)
	if err != nil {
		return nil, err
	}
	return &value, nil
}

func (r *RecordApi[T]) SubscribeAll() (<-chan Event, func(), error) {
	return r.client.stream("GET", fmt.Sprintf("%s/%s/subscribe/*", recordApi, r.name), []byte{}, []QueryParam{})
}

func (r *RecordApi[T]) Subscribe(id RecordId) (<-chan Event, func(), error) {
	return r.client.stream("GET", fmt.Sprintf("%s/%s/subscribe/%s", recordApi, r.name, id.ToString()), []byte{}, []QueryParam{})
}

func (r *RecordApi[T]) UpdateOp(id RecordId, record T) UpdateOperation[T] {
	return UpdateOperation[T]{
		ApiName: r.name,
		Id:      id,
		Value:   record,
	}
}

func (r *RecordApi[T]) Update(id RecordId, record T) error {
	reqBody, err := json.Marshal(record)
	if err != nil {
		return err
	}
	_, err = r.client.do("PATCH", fmt.Sprintf("%s/%s/%s", recordApi, r.name, id.ToString()), reqBody, nil)
	if err != nil {
		return err
	}
	return nil
}

func (r *RecordApi[T]) DeleteOp(id RecordId) DeleteOperation[T] {
	return DeleteOperation[T]{
		ApiName: r.name,
		Id:      id,
	}
}

func (r *RecordApi[T]) Delete(id RecordId) error {
	_, err := r.client.do("DELETE", fmt.Sprintf("%s/%s/%s", recordApi, r.name, id.ToString()), nil, nil)
	if err != nil {
		return err
	}
	return nil
}

type Filter interface {
	toParams(path string) []QueryParam
}

type CompareOp int

const (
	Undefined CompareOp = iota
	Equal
	NotEqual
	LessThan
	LessThanEqual
	GreaterThan
	GreaterThanEqual
	Like
	Regex
	StWithin
	StIntersects
	StContains
	IsNull    // serializes to $is with value "NULL"
	IsNotNull // serializes to $is with value "!NULL"
)

func (op CompareOp) toString() string {
	switch op {
	case Equal:
		return "$eq"
	case NotEqual:
		return "$ne"
	case LessThan:
		return "$lt"
	case LessThanEqual:
		return "$lte"
	case GreaterThan:
		return "$gt"
	case GreaterThanEqual:
		return "$gte"
	case Like:
		return "$like"
	case Regex:
		return "$re"
	case StWithin:
		return "@within"
	case StIntersects:
		return "@intersects"
	case StContains:
		return "@contains"
	case IsNull:
		return "$is"
	case IsNotNull:
		return "$is"
	default:
		panic(fmt.Sprint("Unknown operation:", op))
	}
}

type FilterColumn struct {
	Column string
	Op     CompareOp
	Value  string
}

func (f FilterColumn) toParams(path string) []QueryParam {
	if f.Op != Undefined {
		value := f.Value
		if f.Op == IsNull {
			value = "NULL"
		} else if f.Op == IsNotNull {
			value = "!NULL"
		}
		return []QueryParam{
			QueryParam{
				key:   fmt.Sprintf("%s[%s][%s]", path, f.Column, f.Op.toString()),
				value: value,
			},
		}
	}
	return []QueryParam{
		QueryParam{
			key:   fmt.Sprintf("%s[%s]", path, f.Column),
			value: f.Value,
		},
	}
}

// IsNullFilter returns a Filter that matches rows where column IS NULL.
func IsNullFilter(column string) FilterColumn {
	return FilterColumn{Column: column, Op: IsNull}
}

// IsNotNullFilter returns a Filter that matches rows where column IS NOT NULL.
func IsNotNullFilter(column string) FilterColumn {
	return FilterColumn{Column: column, Op: IsNotNull}
}

type FilterAnd struct {
	filters []Filter
}

func (f FilterAnd) toParams(path string) []QueryParam {
	params := []QueryParam{}
	for i, nested := range f.filters {
		params = append(params, nested.toParams(fmt.Sprintf("%s[$and][%d]", path, i))...)
	}
	return params
}

type FilterOr struct {
	filters []Filter
}

func (f FilterOr) toParams(path string) []QueryParam {
	params := []QueryParam{}
	for i, nested := range f.filters {
		params = append(params, nested.toParams(fmt.Sprintf("%s[$or][%d]", path, i))...)
	}
	return params
}

type Pagination struct {
	Cursor *string
	Limit  *uint64
	Offset *uint64
}

type ListArguments struct {
	Order   []string
	Filters []Filter
	Expand  []string
	Count   bool

	Pagination
}

func (r *RecordApi[T]) List(args *ListArguments) (*ListResponse[T], error) {
	queryParams := []QueryParam{}

	if args != nil {
		if args.Cursor != nil && *args.Cursor != "" {
			queryParams = append(queryParams, QueryParam{
				key:   "cursor",
				value: *args.Cursor,
			})
		}
		if args.Limit != nil {
			queryParams = append(queryParams, QueryParam{
				key:   "limit",
				value: fmt.Sprint(*args.Limit),
			})
		}
		if args.Offset != nil {
			queryParams = append(queryParams, QueryParam{
				key:   "offset",
				value: fmt.Sprint(*args.Offset),
			})
		}
		if len(args.Order) > 0 {
			queryParams = append(queryParams, QueryParam{
				key:   "order",
				value: strings.Join(args.Order, ","),
			})
		}
		if len(args.Expand) > 0 {
			queryParams = append(queryParams, QueryParam{
				key:   "expand",
				value: strings.Join(args.Expand, ","),
			})
		}
		if args.Count {
			queryParams = append(queryParams, QueryParam{
				key:   "count",
				value: "true",
			})
		}
		for _, filter := range args.Filters {
			queryParams = append(queryParams, filter.toParams("filter")...)
		}
	}

	resp, err := r.client.do("GET", fmt.Sprintf("%s/%s", recordApi, r.name), nil, queryParams)
	if err != nil {
		return nil, err
	}
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var listResponse ListResponse[T]
	err = json.Unmarshal(respBody, &listResponse)
	if err != nil {
		return nil, err
	}

	return &listResponse, nil
}

// Instantiates a RecordApi given the client and RecordApi name.
//
// Deprecated: Use `client.Record(name)` instead.
func NewRecordApi[T any](c *Client, name string) RecordApi[T] {
	return RecordApi[T]{
		client: c,
		name:   name,
	}
}

const recordApi string = "api/records/v1"

```

### Core Architecture Module: `client/go/trailbase/transport.go`
```
package trailbase

import (
	"bytes"

	"net/http"
	"net/url"
)

type Transport interface {
	BaseUrl() *url.URL
	// Similar to `http.Client.Do`.
	Do(method string, path string, headers []Header, body []byte, queryParams []QueryParam) (*http.Response, error)
	// Convenience short-cut.
	Get(url string) (*http.Response, error)
}

type defaultTransport struct {
	base   *url.URL
	client *http.Client
}

func (c *defaultTransport) BaseUrl() *url.URL {
	return c.base
}

func (c *defaultTransport) Get(url string) (*http.Response, error) {
	return c.client.Get(url)
}

func (c *defaultTransport) Do(method string, path string, headers []Header, body []byte, queryParams []QueryParam) (*http.Response, error) {
	req, err := http.NewRequest(method, c.base.JoinPath(path).String(), bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	for _, header := range headers {
		req.Header.Add(header.key, header.value)
	}
	if len(queryParams) > 0 {
		query := req.URL.Query()
		for _, param := range queryParams {
			query.Add(param.key, param.value)
		}
		req.URL.RawQuery = query.Encode()
	}
	return c.client.Do(req)
}

```

### Core Architecture Module: `client/python/trailbase/__init__.py`
```
__title__ = "trailbase"
__description__ = "TrailBase client SDK for python."
__version__ = "0.1.0"

import httpx
import jwt
import logging
import typing
import json

from abc import ABC, abstractmethod
from enum import Enum
from contextlib import contextmanager
from time import time
from typing import ContextManager, TypeAlias, cast, final

JSON: TypeAlias = dict[str, "JSON"] | list["JSON"] | str | int | float | bool | None
JSON_OBJECT: TypeAlias = dict[str, JSON]
JSON_ARRAY: TypeAlias = list[JSON]


class FetchException(Exception):
    status: int
    message: str

    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message
        super().__init__(f"FetchException(status={self.status}, '{self.message}')")


class RecordId:
    id: str

    def __init__(self, id: str):
        self.id = id

    def __repr__(self) -> str:
        return f"{self.id}"


def record_ids_from_json(json: JSON_OBJECT) -> list[RecordId]:
    ids = json["ids"]
    assert isinstance(ids, list)

    def convert(value: JSON) -> RecordId:
        assert isinstance(value, str)
        return RecordId(value)

    return [convert(id) for id in ids]


class User:
    id: str
    email: str | None
    username: str | None

    def __init__(self, id: str, email: str | None, username: str | None) -> None:
        self.id = id
        self.email = email
        self.username = username

    @staticmethod
    def from_json(json: JSON_OBJECT) -> "User":
        sub = json["sub"]
        assert isinstance(sub, str)
        email = json["email"]
        assert isinstance(email, str | None)
        username = json["username"]
        assert isinstance(username, str | None)

        return User(sub, email, username)


class ListResponse:
    cursor: str | None
    total_count: int | None
    records: list[JSON_OBJECT]

    def __init__(self, cursor: str | None, total_count: int | None, records: list[JSON_OBJECT]) -> None:
        self.cursor = cursor
        self.total_count = total_count
        self.records = records

    @staticmethod
    def from_json(json: JSON_OBJECT) -> "ListResponse":
        cursor = json.get("cursor")
        assert isinstance(cursor, str | None)
        total_count = json.get("total_count")
        assert isinstance(total_count, int | None)
        records = json["records"]
        assert isinstance(records, list)

        return ListResponse(cursor, total_count, cast(list[JSON_OBJECT], records))


class Tokens:
    auth: str
    refresh: str | None
    csrf: str | None

    def __init__(self, auth: str, refresh: str | None, csrf: str | None) -> None:
        self.auth = auth
        self.refresh = refresh
        self.csrf = csrf

    @staticmethod
    def from_json(json: JSON_OBJECT) -> "Tokens":
        auth = json["auth_token"]
        assert isinstance(auth, str)
        refresh = json.get("refresh_token")
        assert isinstance(refresh, str | None)
        csrf = json.get("csrf_token")
        assert isinstance(csrf, str | None)

        return Tokens(auth, refresh, csrf)

    def valid(self) -> bool:
        claims = jwt.decode(self.auth, algorithms=["EdDSA"], options={"verify_signature": False})
        return len(claims) > 0


class MultiFactorAuthToken:
    token: str

    def __init__(self, token: str) -> None:
        self.token = token

    @staticmethod
    def from_json(json: JSON_OBJECT) -> "MultiFactorAuthToken":
        token = json["mfa_token"]
        assert isinstance(token, str)
        return MultiFactorAuthToken(token)


class JwtToken:
    sub: str
    iat: int
    exp: int
    email: str | None
    username: str | None
    csrfToken: str

    def __init__(
        self, sub: str, iat: int, exp: int, email: str | None, username: str | None, csrfToken: str
    ) -> None:
        self.sub = sub
        self.iat = iat
        self.exp = exp
        self.email = email
        self.username = username
        self.csrfToken = csrfToken

    @staticmethod
    def from_json(json: JSON_OBJECT) -> "JwtToken":
        sub = json["sub"]
        assert isinstance(sub, str)
        iat = json["iat"]
        assert isinstance(iat, int)
        exp = json["exp"]
        assert isinstance(exp, int)
        email = json["email"]
        assert isinstance(email, str | None)
        username = json["username"]
        assert isinstance(username, str | None)
        csrf_token = json["csrf_token"]
        assert isinstance(csrf_token, str)

        return JwtToken(sub, iat, exp, email, username, csrf_token)


class TokenState:
    state: tuple[Tokens, JwtToken] | None
    headers: dict[str, str]

    def __init__(self, state: tuple[Tokens, JwtToken] | None, headers: dict[str, str]) -> None:
        self.state = state
        self.headers = headers

    @staticmethod
    def build(tokens: Tokens | None) -> "TokenState":
        decoded = (
            jwt.decode(tokens.auth, algorithms=["EdDSA"], options={"verify_signature": False})
            if tokens is not None
            else None
        )

        if decoded is None or tokens is None:
            return TokenState(None, TokenState.build_headers(tokens))

        return TokenState(
            (tokens, JwtToken.from_json(decoded)),
            TokenState.build_headers(tokens),
        )

    @staticmethod
    def build_headers(tokens: Tokens | None) -> dict[str, str]:
        base = {
            "Content-Type": "application/json",
        }

        if tokens is not None:
            base["Authorization"] = f"Bearer {tokens.auth}"

            refresh = tokens.refresh
            if refresh is not None:
                base["Refresh-Token"] = refresh

            csrf = tokens.csrf
            if csrf is not None:
                base["CSRF-Token"] = csrf

        return base


class EventBase:
    seq: int | None

    def __init__(self, seq: int | None):
        self.seq = seq


class InsertEvent(EventBase):
    value: JSON_OBJECT

    def __init__(self, seq: int | None, value: JSON_OBJECT):
        super().__init__(seq)
        self.value = value


class UpdateEvent(EventBase):
    value: JSON_OBJECT

    def __init__(self, seq: int | None, value: JSON_OBJECT):
        super().__init__(seq)
        self.value = value


class DeleteEvent(EventBase):
    value: JSON_OBJECT

    def __init__(self, seq: int | None, value: JSON_OBJECT):
        super().__init__(seq)
        self.value = value


class ErrorEvent(EventBase):
    status: int
    message: str | None

    def __init__(self, seq: int | None, status: int, message: str | None):
        super().__init__(seq)
        self.status = status
        self.message = message


EVENT_ERROR_STATUS_UNKNOWN = 0
EVENT_ERROR_STATUS_FORBIDDEN = 1
EVENT_ERROR_STATUS_LOSS = 2


Event: TypeAlias = UpdateEvent | InsertEvent | DeleteEvent | ErrorEvent


def parseEvent(obj: JSON_OBJECT) -> Event | None:
    seq = cast(int | None, obj["seq"])

    insert = obj.get("Insert")
    if insert is not None:
        return InsertEvent(seq, cast(JSON_OBJECT, insert))

    update = obj.get("Update")
    if update is not None:
        return UpdateEvent(seq, cast(JSON_OBJECT, update))

    delete = obj.get("Delete")
    if delete is not None:
        return DeleteEvent(seq, cast(JSON_OBJECT, delete))

    error = cast(JSON_OBJECT | None, obj.get("Error"))
    if error is not None:
        return ErrorEvent(seq, cast(int, error["status"]), cast(str | None, error.get("message")))

    raise Exception(f"Failed to parse event: {obj}")


class OperationBase:
    api_name: str

    def __init__(self, api_name: str):
        self.api_name = api_name

    @abstractmethod
    def to_json(self) -> JSON_OBJECT:
        pass


class CreateOperation(OperationBase):
    value: JSON_OBJECT

    def __init__(self, api_name: str, value: JSON_OBJECT):
        super().__init__(api_name)
        self.value = value

    def to_json(self) -> JSON_OBJECT:
        return {
            "Create": {
                "api_name": self.api_name,
          
```

### Core Architecture Module: `crates/assets/js/admin/eslint.config.mjs`
```
import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import tailwind from "eslint-plugin-better-tailwindcss";
import solid from "eslint-plugin-solid/configs/recommended";

export default [
  {
    ignores: ["dist/", "node_modules/", "vite.config.mts", "src/components/ui"],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  solid,
  {
    plugins: {
      "better-tailwindcss": tailwind,
    },
    rules: {
      ...tailwind.configs["recommended-warn"].rules,
      ...tailwind.configs["recommended-error"].rules,

      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      // Order is different from what prettier enforces.
      "better-tailwindcss/enforce-consistent-class-order": "off",
      "better-tailwindcss/no-unknown-classes": [
        "error",
        {
          ignore: [
            // Kobalte?
            "duration-250ms",
            "items-top",
            "collapsible",
            "collapsible__trigger",
            "collapsible__content",
            // Ours:
            "hide-scrollbars",
          ],
        },
      ],
      // TODO: recently introduced. Should look for solutions, e.g. ignore components/ui.
      "better-tailwindcss/enforce-canonical-classes": [
        "warn",
        {
          ignore: [
            // Data attribute variants
            "^data-",
          ],
        },
      ],
      "better-tailwindcss/enforce-consistent-variable-syntax": "warn",
      "better-tailwindcss/enforce-shorthand-classes": "warn",
      "better-tailwindcss/no-deprecated-classes": "warn",
      "better-tailwindcss/enforce-consistent-important-position": "warn",
    },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/index.css",
      },
    },
  },
  {
    files: ["**/*.{js,mjs,cjs,mts,ts,tsx,jsx}"],
    rules: {
      // https://typescript-eslint.io/rules/no-explicit-any/
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-wrapper-object-types": "warn",
      // http://eslint.org/docs/rules/no-unused-vars
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          vars: "all",
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // http://eslint.org/docs/rules/no-unassigned-vars
      //
      // Eslint doesn't understand that solid's pattern <El ref={ref} />,
      // which will be compiled into an assignment.
      "no-unassigned-vars": "off",
    },
    languageOptions: { globals: globals.browser },
  },
];

```

### Core Architecture Module: `crates/assets/js/admin/proto/config.ts`
```
// Code generated by protoc-gen-ts_proto. DO NOT EDIT.
// versions:
//   protoc-gen-ts_proto  v2.12.4
//   protoc               v3.21.12
// source: config.proto

/* eslint-disable */
import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";

export const protobufPackage = "config";

export enum SmtpEncryption {
  SMTP_ENCRYPTION_UNDEFINED = 0,
  SMTP_ENCRYPTION_NONE = 1,
  SMTP_ENCRYPTION_STARTTLS = 2,
  SMTP_ENCRYPTION_TLS = 3,
  UNRECOGNIZED = -1,
}

export function smtpEncryptionFromJSON(object: any): SmtpEncryption {
  switch (object) {
    case 0:
    case "SMTP_ENCRYPTION_UNDEFINED":
      return SmtpEncryption.SMTP_ENCRYPTION_UNDEFINED;
    case 1:
    case "SMTP_ENCRYPTION_NONE":
      return SmtpEncryption.SMTP_ENCRYPTION_NONE;
    case 2:
    case "SMTP_ENCRYPTION_STARTTLS":
      return SmtpEncryption.SMTP_ENCRYPTION_STARTTLS;
    case 3:
    case "SMTP_ENCRYPTION_TLS":
      return SmtpEncryption.SMTP_ENCRYPTION_TLS;
    case -1:
    case "UNRECOGNIZED":
    default:
      return SmtpEncryption.UNRECOGNIZED;
  }
}

export function smtpEncryptionToJSON(object: SmtpEncryption): string {
  switch (object) {
    case SmtpEncryption.SMTP_ENCRYPTION_UNDEFINED:
      return "SMTP_ENCRYPTION_UNDEFINED";
    case SmtpEncryption.SMTP_ENCRYPTION_NONE:
      return "SMTP_ENCRYPTION_NONE";
    case SmtpEncryption.SMTP_ENCRYPTION_STARTTLS:
      return "SMTP_ENCRYPTION_STARTTLS";
    case SmtpEncryption.SMTP_ENCRYPTION_TLS:
      return "SMTP_ENCRYPTION_TLS";
    case SmtpEncryption.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export enum OAuthProviderId {
  OAUTH_PROVIDER_ID_UNDEFINED = 0,
  TEST = 1,
  OIDC0 = 2,
  APPLE = 9,
  DISCORD = 10,
  GITLAB = 11,
  GOOGLE = 12,
  FACEBOOK = 13,
  MICROSOFT = 14,
  TWITCH = 15,
  YANDEX = 16,
  GITHUB = 17,
  UNRECOGNIZED = -1,
}

export function oAuthProviderIdFromJSON(object: any): OAuthProviderId {
  switch (object) {
    case 0:
    case "OAUTH_PROVIDER_ID_UNDEFINED":
      return OAuthProviderId.OAUTH_PROVIDER_ID_UNDEFINED;
    case 1:
    case "TEST":
      return OAuthProviderId.TEST;
    case 2:
    case "OIDC0":
      return OAuthProviderId.OIDC0;
    case 9:
    case "APPLE":
      return OAuthProviderId.APPLE;
    case 10:
    case "DISCORD":
      return OAuthProviderId.DISCORD;
    case 11:
    case "GITLAB":
      return OAuthProviderId.GITLAB;
    case 12:
    case "GOOGLE":
      return OAuthProviderId.GOOGLE;
    case 13:
    case "FACEBOOK":
      return OAuthProviderId.FACEBOOK;
    case 14:
    case "MICROSOFT":
      return OAuthProviderId.MICROSOFT;
    case 15:
    case "TWITCH":
      return OAuthProviderId.TWITCH;
    case 16:
    case "YANDEX":
      return OAuthProviderId.YANDEX;
    case 17:
    case "GITHUB":
      return OAuthProviderId.GITHUB;
    case -1:
    case "UNRECOGNIZED":
    default:
      return OAuthProviderId.UNRECOGNIZED;
  }
}

export function oAuthProviderIdToJSON(object: OAuthProviderId): string {
  switch (object) {
    case OAuthProviderId.OAUTH_PROVIDER_ID_UNDEFINED:
      return "OAUTH_PROVIDER_ID_UNDEFINED";
    case OAuthProviderId.TEST:
      return "TEST";
    case OAuthProviderId.OIDC0:
      return "OIDC0";
    case OAuthProviderId.APPLE:
      return "APPLE";
    case OAuthProviderId.DISCORD:
      return "DISCORD";
    case OAuthProviderId.GITLAB:
      return "GITLAB";
    case OAuthProviderId.GOOGLE:
      return "GOOGLE";
    case OAuthProviderId.FACEBOOK:
      return "FACEBOOK";
    case OAuthProviderId.MICROSOFT:
      return "MICROSOFT";
    case OAuthProviderId.TWITCH:
      return "TWITCH";
    case OAuthProviderId.YANDEX:
      return "YANDEX";
    case OAuthProviderId.GITHUB:
      return "GITHUB";
    case OAuthProviderId.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

/**
 * What user identifier to use for new user registrations as well as
 * change-(email|username).
 *
 * NOTE: W/o email there's no way to contact users.
 */
export enum UserIdentifier {
  /** USER_IDENTIFIER_UNDEFINED - / Behaves like ONLY_EMAIL for legacy reasons. */
  USER_IDENTIFIER_UNDEFINED = 0,
  /** ONLY_EMAIL - / Only email. Doesn't work for anonymous login. */
  ONLY_EMAIL = 1,
  /** ONLY_USERNAME - / Only username. No email allowed. */
  ONLY_USERNAME = 2,
  /** REQUIRE_EMAIL - / Requires email and allows an optional username. */
  REQUIRE_EMAIL = 3,
  /** REQUIRE_USERNAME - / Requires username and allows an optional email. */
  REQUIRE_USERNAME = 4,
  /** REQUIRE_EMAIL_AND_USERNAME - / Requires both email and username. */
  REQUIRE_EMAIL_AND_USERNAME = 5,
  UNRECOGNIZED = -1,
}

export function userIdentifierFromJSON(object: any): UserIdentifier {
  switch (object) {
    case 0:
    case "USER_IDENTIFIER_UNDEFINED":
      return UserIdentifier.USER_IDENTIFIER_UNDEFINED;
    case 1:
    case "ONLY_EMAIL":
      return UserIdentifier.ONLY_EMAIL;
    case 2:
    case "ONLY_USERNAME":
      return UserIdentifier.ONLY_USERNAME;
    case 3:
    case "REQUIRE_EMAIL":
      return UserIdentifier.REQUIRE_EMAIL;
    case 4:
    case "REQUIRE_USERNAME":
      return UserIdentifier.REQUIRE_USERNAME;
    case 5:
    case "REQUIRE_EMAIL_AND_USERNAME":
      return UserIdentifier.REQUIRE_EMAIL_AND_USERNAME;
    case -1:
    case "UNRECOGNIZED":
    default:
      return UserIdentifier.UNRECOGNIZED;
  }
}

export function userIdentifierToJSON(object: UserIdentifier): string {
  switch (object) {
    case UserIdentifier.USER_IDENTIFIER_UNDEFINED:
      return "USER_IDENTIFIER_UNDEFINED";
    case UserIdentifier.ONLY_EMAIL:
      return "ONLY_EMAIL";
    case UserIdentifier.ONLY_USERNAME:
      return "ONLY_USERNAME";
    case UserIdentifier.REQUIRE_EMAIL:
      return "REQUIRE_EMAIL";
    case UserIdentifier.REQUIRE_USERNAME:
      return "REQUIRE_USERNAME";
    case UserIdentifier.REQUIRE_EMAIL_AND_USERNAME:
      return "REQUIRE_EMAIL_AND_USERNAME";
    case UserIdentifier.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export enum SystemJobId {
  SYSTEM_JOB_ID_UNDEFINED = 0,
  BACKUP = 1,
  HEARTBEAT = 2,
  LOG_CLEANER = 3,
  AUTH_CLEANER = 4,
  QUERY_OPTIMIZER = 5,
  FILE_DELETIONS = 6,
  ANONYMOUS_CLEANER = 7,
  UNRECOGNIZED = -1,
}

export function systemJobIdFromJSON(object: any): SystemJobId {
  switch (object) {
    case 0:
    case "SYSTEM_JOB_ID_UNDEFINED":
      return SystemJobId.SYSTEM_JOB_ID_UNDEFINED;
    case 1:
    case "BACKUP":
      return SystemJobId.BACKUP;
    case 2:
    case "HEARTBEAT":
      return SystemJobId.HEARTBEAT;
    case 3:
    case "LOG_CLEANER":
      return SystemJobId.LOG_CLEANER;
    case 4:
    case "AUTH_CLEANER":
      return SystemJobId.AUTH_CLEANER;
    case 5:
    case "QUERY_OPTIMIZER":
      return SystemJobId.QUERY_OPTIMIZER;
    case 6:
    case "FILE_DELETIONS":
      return SystemJobId.FILE_DELETIONS;
    case 7:
    case "ANONYMOUS_CLEANER":
      return SystemJobId.ANONYMOUS_CLEANER;
    case -1:
    case "UNRECOGNIZED":
    default:
      return SystemJobId.UNRECOGNIZED;
  }
}

export function systemJobIdToJSON(object: SystemJobId): string {
  switch (object) {
    case SystemJobId.SYSTEM_JOB_ID_UNDEFINED:
      return "SYSTEM_JOB_ID_UNDEFINED";
    case SystemJobId.BACKUP:
      return "BACKUP";
    case SystemJobId.HEARTBEAT:
      return "HEARTBEAT";
    case SystemJobId.LOG_CLEANER:
      return "LOG_CLEANER";
    case SystemJobId.AUTH_CLEANER:
      return "AUTH_CLEANER";
    case SystemJobId.QUERY_OPTIMIZER:
      return "QUERY_OPTIMIZER";
    case SystemJobId.FILE_DELETIONS:
      return "FILE_DELETIONS";
    case SystemJobId.ANONYMOUS_CLEANER:
      return "ANONYMOUS_CLEANER";
    case SystemJobId.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

/**
 * / Sqlite specific (as opposed to standard SQL) constrained-violation
 * / resolution strategy upon insert.
 */
export enum ConflictResolutionStrategy {
  CONFLICT_RESOLUTION_STRATEGY_UNDEFINED = 0,
  /** ABORT - / SQL default: Keep transaction open and abort the current statement. */
  ABO
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #293** (2026-09-18): **Add built-in helpers for expanded types to Kotlin client**
  *Symptoms*: Currently, you would need to use two different data types if you want to expand columns: - When sending data, only the id must be sent: `{"parent": "<id>"}` - When reading data, the response layout is different: `{"parent": {"id": "<id>", "data": {...}}}`  The `Expanded` type wrapper basically allows you to do both with a single type. - When serializing, it only serializes the id as a plain JSON string. - When deserializing, it deserializes id and data.  I personally find this very helpful (I wrote this for my own project and decided to try to upstream it) because I can handle everything with a single data type, which makes it much easier to keep all models up to date.  I also understand if you don't like this approach though, it's possible to create this wrapper type in your app without modifying the Trailbase Kotlin client.
  **Post-Mortem & Fix Analysis**:
  > > I also understand if you don't like this approach though, it's possible to create this wrapper type in your app without modifying the Trailbase Kotlin client.  I actually like this a lot: nifty way of dealing with conditional expansion. Also an interesting precedent for other languages.  I have only low-value nits to offer:  ```kotlin children.create(Child(parent = Expanded(parentId))) ```  may sound a bit definitive. I wonder if   ```kotlin children.create(Child(parent = Expandable(parentId))) ```  would reflect the conditional nature more (and follow Omittable's naming practices). I could also see an explicit initializer like `Omittable.Present()`, a la:  ```kotlin children.create(Child(parent = Expandable.Id(parentId))) ```  Ignorant question, how hard would it be to pull the impl (which is pleasantly straightforward) into a separate file? I've broken up all the other clients but I've always postponed kotlin to another day, simply all my tooling (LSP, ...) is
  > Since we're already at discussing computer science's hardest problem, I could also see this being called `Reference` and s/id/ref/, e.g.:  ```kotlin val ref = Reference.Ref(id); ```  :woman_shrugging: 
  > > I have only low-value nits to offer: >  > ```kotlin > children.create(Child(parent = Expanded(parentId))) > ``` >  > may sound a bit definitive. I wonder if >  > ```kotlin > children.create(Child(parent = Expandable(parentId))) > ``` >  > would reflect the conditional nature more (and follow Omittable's naming practices). I could also see an explicit initializer like `Omittable.Present()`, a la: >  > ```kotlin > children.create(Child(parent = Expandable.Id(parentId))) > ``` >  Sounds like a good idea, I'll adapt the PR to use the Expandable.Id naming. > Ignorant question, how hard would it be to pull the impl (which is pleasantly straightforward) into a separate file? I've broken up all the other clients but I've always postponed kotlin to another day, simply all my tooling (LSP, ...) is generally unhappy with kotlin > It should work without any issues, it's as simple as just moving things to a different file and letting the IDE automatically import the other fil

- **Issue #292** (2026-09-17): **Add README documentation to kotlin client**
  *Symptoms*: draft until we found a solution for https://github.com/trailbaseio/trailbase/pull/287#issuecomment-5669132707
  **Post-Mortem & Fix Analysis**:
  > Thanks for the docs, very much appreciated :pray: . Sorry for being so anal and doctoring so much. Personally, I find writing "good" docs worth reading way more laborious then writing "good enough" code. This is likely also why the current docs (or lack thereof) are so lackluster. That said, with us iterating on each other, I'm pretty happy with the concise, useful discussion that really every user of any client impl should be aware off :heart: . We should probably put a flavor of this front and center into the broader docs.
  > Thanks a lot for the follow-up, I agree that it's much easier to read now and get started with!  I haven't got any experience with writing docs because I'm only working on end user applications, but not on libraries, so the feedback is greatly appreciated :)

- **Issue #291** (2026-09-14): **docs: Clarify how to upload files with JSON requests**
  *Symptoms*: I didn't really understand how this is supposed to work before reading the source code, so I think it makes sense to clarify it in the docs (and especially to link to the fields that can be set).
  **Post-Mortem & Fix Analysis**:
  > Appreciated :pray: and sorry for the lackluster docs. I pushed your changes in https://github.com/trailbaseio/trailbase/commit/a3d9124934277c0bb4c814329c32f2f83a4ec822 and gave the entire paragraph a little bit more love
  > Oh, I (again) forgot to target the dev branch instead of the main branch with my PR.  Thanks for merging!

- **Issue #290** (2026-09-14): **Fix table explorer resetting page size on sort/filter**
  *Symptoms*: ## Summary - Sorting or filtering the table explorer's data view reset `pageSize` back to the default (20) alongside `pageIndex`, silently discarding a user's chosen page size every time they clicked a column header to sort. - `TablePane.tsx`'s `setSorting` and `setFilter` both cleared `pageSize` when resetting pagination; only `pageIndex` needs to reset.  ## Test plan - Ran a local disposable TrailBase instance (`--dev`, throwaway depot) with the admin UI dev server against it. - Created a table with 35 rows, set "per page" to 50, then clicked a column header to sort.   - Before fix: per-page snapped back to 20.   - After fix: per-page stayed at 50, sort applied correctly (verified row order and sort arrow indicator). - Reverted the fix and re-ran the same steps to confirm the regression reproduces, then reapplied it.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01AeT2rHttEQRmRrzTezr1Qa 
  **Post-Mortem & Fix Analysis**:
  > Appreciated. Looks good

- **Issue #289** (2026-09-15): **Admin UI needs a section for storage configuration (S3 credentials)**
  *Symptoms*: Just a reminder -- the Admin UI is missing a way to set up S3 storage.

- **Issue #288** (2026-09-14): **Pr/native apple signin**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > @ignatz Hi!   This looks great, thanks for taking it further - the split reads much cleaner now.  One small thing I noticed in the JWK cache (fetch_apple_public_keys): the shared future is stored in the cache before it resolves, so a failed fetch gets cached for the full 15-minute TTL - a transient network blip would fail all native logins for 15 minutes even after connectivity is back. Maybe only cache on success, or drop the entry on Err?
  > > @ignatz Hi! >  > This looks great, thanks for taking it further - the split reads much cleaner now. >  > One small thing I noticed in the JWK cache (fetch_apple_public_keys): the shared future is stored in the cache before it resolves, so a failed fetch gets cached for the full 15-minute TTL - a transient network blip would fail all native logins for 15 minutes even after connectivity is back. Maybe only cache on success, or drop the entry on Err?  Thanks for the review, much appreciated. I've since added an invalidation and some tests for the cache. If done a few more changes and cleanups and merged everything into the dev branch. This should go into the next release. Thanks for all your work :pray: 

- **Issue #287** (2026-09-11): **Fix creating records using default values with Kotlin client**
  *Symptoms*: Hey!  By default, kotlinx serialization doesn't serialize a field if it's the same as the default value.  E.g. ```kt @Serializable data class Foo(val x: Int = 3)  Json.encodeToString(Foo()) ``` yields an empty dict `{}`.  This cause the issue that when updating a record with a default value, the value does not get sent to the server and we get `db constraint: not null`.  Forcing kotlinx serialization to send default values too this fixes it.
  **Post-Mortem & Fix Analysis**:
  > Much appreciated :pray: - will merge and release a new client ASAP
  > I did modify the change slightly to cover all serialization consistently. New client version is released :pray:
  > Thank you! I missed that there was a second `Json` instance.  Great that you already pushed a release so quick, then I can continue to use the released version from Gradle instead of my fork which makes it much easier :)

- **Issue #286** (2026-09-14): **native apple signin**
  *Symptoms*: Native Sign in with Apple login endpoint  Adds POST /auth/v1/oauth/apple/native for native clients (iOS/macOS apps using ASAuthorizationController), complementing the existing web OAuth flow:  - RS256 verification against Apple's JWKS by kid, with configurable audience: the native flow binds tokens to the App ID, distinct from the web flow's Services ID client_id (new optional native_client_id proto field, field 16). - Anti-replay nonce claim: client sends the SHA-256 hash of its raw nonce with the request (Firebase pattern); the endpoint re-hashes and compares. Malformed tokens/nonce mismatches are rejected 400 before any JWKS fetch (no outbound calls for garbage). - User matching by team-stable Apple sub through the same provider-id + provider-user-id path as the web callback — web-created and native accounts resolve to the same user. create_user_for_external_provider extracted into shared oauth/users.rs for both flows. - Fail-closed: unconfigured native_client_id → 500, signature/aud/iss/exp failures → 401, first login without verified email → 424. - Full endpoint-level test coverage with an injected JWKS fixture (RSA keypair, kid lookup, audience/nonce/expiry negatives).

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

### Incident Patch 1: `88802217` (2026-09-29)
**Commit Message**: Fix admin UI dashboard failing to fetch logs and prepare new release v0.34.1.

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## v0.34.1
+
+- Fix admin UI failing to fetch logs.
+
 ## v0.34.0
 
 - Performance release - many small and large improvements across the board:
```

**File**: `crates/core/src/admin/logs/list_logs.rs` (modified, +4/-3)
```diff
@@ -264,7 +264,8 @@ struct LogEntry {
 }
 
 impl LogEntry {
-  pub const COLUMNS: &str = "id, created, status, method, url, latency, client_ip, referrer, user_agent, user_id, client_geoip_cc, client_geoip_city";
+  pub const COLUMNS: &str =
+    "id, created, status, method, url, latency, client_ip, referer, user_agent, user_id";
 
   fn from_row(
     row: &trailbase_sqlite::Row,
@@ -282,11 +283,11 @@ impl LogEntry {
       user_agent: row.get(8)?,
       user_id: row.get(9)?,
       client_geoip_cc: match geoip_db_type {
-        Some(DatabaseType::GeoLite2Country) => Some(row.get(10)?),
+        Some(DatabaseType::GeoLite2Country) => row.get(10)?,
         _ => None,
       },
       client_geoip_city: match geoip_db_type {
-        Some(DatabaseType::GeoLite2City) => Some(row.get(10)?),
+        Some(DatabaseType::GeoLite2City) => row.get(10)?,
         _ => None,
       },
     });
```

**File**: `crates/core/src/extract/raw_json.rs` (modified, +1/-1)
```diff
@@ -15,6 +15,6 @@ impl IntoResponse for RawJson {
         HeaderValue::from_static("application/json"),
       )
       .body(Body::from(String::from(body)))
-      .expect("valid");
+      .unwrap_or_default();
   }
 }
```

**File**: `crates/core/src/records/list_records.rs` (modified, +3/-3)
```diff
@@ -397,10 +397,10 @@ pub async fn list_records_handler(
     records: records
       .into_iter()
       .map(|obj| {
-        serde_json::value::to_raw_value(&trailbase_schema::json::Value::Object(obj))
-          .expect("well-formed")
+        return serde_json::value::to_raw_value(&trailbase_schema::json::Value::Object(obj));
       })
-      .collect(),
+      .collect::<Result<Vec<_>, _>>()
+      .map_err(|err| RecordError::Internal(err.into()))?,
   })));
 }
 
```

**File**: `crates/core/src/records/read_record.rs` (modified, +2/-1)
```diff
@@ -134,7 +134,8 @@ pub async fn read_record_handler(
   }
 
   return Ok(RawJson(
-    serde_json::value::to_raw_value(&json_response).expect("well-formed"),
+    serde_json::value::to_raw_value(&json_response)
+      .map_err(|err| RecordError::Internal(err.into()))?,
   ));
 }
 
```

---

### Incident Patch 2: `220d059c` (2026-09-29)
**Commit Message**: Fix performance regression in v0.33.3.

Introduced by ceee852539fdb8285e03c453cacc749ad7dcbad8.

**File**: `crates/core/src/admin/mod.rs` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ mod util;
 mod wasm;
 
 pub use error::AdminError;
+pub(super) use openapi::OpenApiExtension;
 
 use crate::app_state::AppState;
 use utoipa_axum::router::OpenApiRouter;
```

**File**: `crates/core/src/admin/openapi.rs` (modified, +14/-3)
```diff
@@ -1,8 +1,15 @@
 use axum::extract::Extension;
+use parking_lot::Mutex;
+use std::sync::Arc;
 use utoipa::openapi::OpenApi;
 
 use crate::admin::AdminError as Error;
 
+#[derive(Clone, Default)]
+pub(crate) struct OpenApiExtension {
+  pub api: Arc<Mutex<Option<OpenApi>>>,
+}
+
 #[utoipa::path(
   get,
   path = "/openapi.json",
@@ -11,7 +18,7 @@ use crate::admin::AdminError as Error;
     (status = 200, description = "Success"),
   )
 )]
-pub async fn openapi_handler(openapi: Option<Extension<OpenApi>>) -> Result<String, Error> {
+pub async fn openapi_handler(openapi: Extension<OpenApiExtension>) -> Result<String, Error> {
   // NOTE: If memoizing Extension<OpenApi> turns out to be too much overhead but we still want the
   // WASM result. We could memoize WASM only. Rebuild OpenApiRouter for everything else here and
   // merge :shrug:. Feels overly complicated.
@@ -22,8 +29,12 @@ pub async fn openapi_handler(openapi: Option<Extension<OpenApi>>) -> Result<Stri
   //   .to_pretty_json()
   //   .map_err(|err| Error::Other(err.to_string()));
 
-  return openapi
-    .unwrap_or_default()
+  let lock = openapi.api.lock();
+  let Some(api) = lock.as_ref() else {
+    return Err(Error::Precondition("missing OpenApi defs".into()));
+  };
+
+  return api
     .to_pretty_json()
     .map_err(|err| Error::Other(err.to_string()));
 }
```

**File**: `crates/core/src/auth/api/change_email.rs` (modified, +2/-2)
```diff
@@ -10,10 +10,10 @@ use utoipa::{IntoParams, ToSchema};
 use crate::app_state::AppState;
 use crate::auth::jwt::EmailChangeTokenClaims;
 use crate::auth::util::{user_by_id, validate_and_normalize_email_address, validate_redirect};
-use crate::auth::{AuthError, User};
+use crate::auth::{AuthError, HasRoot, User};
 use crate::constants::USER_TABLE;
 use crate::email::Email;
-use crate::extract::{Either, HasRoot};
+use crate::extract::Either;
 use crate::util::urlencode;
 
 #[derive(Debug, Default, Deserialize, IntoParams, ToSchema, TS)]
```

**File**: `crates/core/src/auth/api/login.rs` (modified, +2/-2)
```diff
@@ -11,7 +11,6 @@ use ts_rs::TS;
 use utoipa::ToSchema;
 
 use crate::app_state::AppState;
-use crate::auth::AuthError;
 use crate::auth::api::totp::new_totp;
 use crate::auth::jwt::PendingAuthTokenClaims;
 use crate::auth::login_params::{LoginInputParams, LoginParams, build_and_validate_input_params};
@@ -21,11 +20,12 @@ use crate::auth::util::{
   SameSite, new_cookie, remove_cookie, user_by_email, user_by_id, user_by_username,
   validate_and_normalize_email_address, validate_and_normalize_username,
 };
+use crate::auth::{AuthError, HasRoot};
 use crate::constants::{
   AUTHORIZATION_CODE_TABLE, COOKIE_AUTH_TOKEN, COOKIE_REFRESH_TOKEN,
   DEFAULT_AUTHORIZATION_CODE_TTL, DEFAULT_MFA_TOKEN_TTL, VERIFICATION_CODE_LENGTH,
 };
-use crate::extract::{Either, HasRoot};
+use crate::extract::Either;
 use crate::rand::random_alphanumeric;
 use crate::util::{b64_to_uuid, urlencode};
 
```

**File**: `crates/core/src/auth/api/login_anonymous.rs` (modified, +2/-2)
```diff
@@ -9,12 +9,12 @@ use ts_rs::TS;
 use utoipa::ToSchema;
 
 use crate::app_state::AppState;
-use crate::auth::AuthError;
 use crate::auth::api::register::RegisterUserParams;
 use crate::auth::user::DbUser;
 use crate::auth::util::validate_redirect;
+use crate::auth::{AuthError, HasRoot};
 use crate::constants::{DEFAULT_ANONYMOUS_REFRESH_TOKEN_TTL, DEFAULT_AUTH_TOKEN_TTL, USER_TABLE};
-use crate::extract::{Either, HasRoot};
+use crate::extract::Either;
 
 #[derive(Debug, Default, Deserialize, ToSchema, TS)]
 #[ts(export)]
```

---

### Incident Patch 3: `29a024e7` (2026-09-27)
**Commit Message**: Fix `DbUser` construction on PG with a different column order.

**File**: `crates/core/src/admin/user/update_user.rs` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ pub async fn update_user_handler(
   // NOTE: Empty string for username/email is used to unset ''.
   const UPDATE_QUERY: &str = formatcp!(
     "\
-    UPDATE {USER_TABLE} SET \
+    UPDATE '{USER_TABLE}' SET \
       email = CASE :email \
         WHEN '' THEN NULL \
         ELSE COALESCE(:email, prev.email) \
```

**File**: `crates/core/src/auth/user.rs` (modified, +47/-23)
```diff
@@ -3,6 +3,7 @@ use axum::{
   http::request::Parts,
 };
 use serde::{Deserialize, Serialize};
+use std::sync::OnceLock;
 use trailbase_sqlite::Row;
 use uuid::Uuid;
 
@@ -41,32 +42,55 @@ impl DbUser {
   }
 
   pub fn from_row(row: Row) -> Result<Self, AuthError> {
-    #[inline]
-    fn from_row_impl(mut row: Row) -> Result<DbUser, trailbase_sqlite::from_sql::FromSqlError> {
-      // Sanity check.
-      debug_assert_eq!(Some("id"), row.column_name(0));
-      debug_assert_eq!(Some("username"), row.column_name(3));
-      debug_assert_eq!(Some("totp_secret"), row.column_name(6));
-      debug_assert_eq!(Some("provider_id"), row.column_name(9));
-
-      return Ok(DbUser {
-        id: row.get(0)?,
-        email: row.consume_value(1)?.try_into()?,
-        unverified_email: row.consume_value(2)?.try_into()?,
-        username: row.consume_value(3)?.try_into()?,
-        password_hash: row.consume_value(4)?.try_into()?,
-        admin: row.get(5)?,
-        totp_secret: row.consume_value(6)?.try_into()?,
-        created: row.get(7)?,
-        updated: row.get(8)?,
-        provider_id: row.get(9)?,
-        provider_user_id: row.consume_value(10)?.try_into()?,
-        provider_avatar_url: row.consume_value(11)?.try_into()?,
+    use trailbase_sqlite::from_sql::FromSqlError;
+
+    // NOTE: The migrations used "ALTER TABLE" for PG leading to a different column ordering between
+    // SQLite and Postgres. We thus have to look up the column indexes for generic de-serialization.
+    // Alternatively, we could tract down all the uses of `SELECT * {USER_TABLE}` and specify an
+    // explicit column order.
+    type Builder = dyn Fn(Row) -> Result<DbUser, FromSqlError> + Sync + Send;
+    static ROW_TO_USER: OnceLock<Box<Builder>> = OnceLock::new();
+
+    let row_to_user = ROW_TO_USER.get_or_init(|| {
+      let columns = row.columns();
+
+      let find = |name: &str| -> usize {
+        return columns.iter().position(|c| c.name == name).expect("schema");
+      };
+
+      let idx_id = find("id");
+      let idx_email = find("email");
+      let idx_unverified_email = find("unverified_email");
+      let idx_username = find("username");
+      let idx_password_hash = find("password_hash");
+      let idx_admin = find("admin");
+      let idx_totp_secret = find("totp_secret");
+      let idx_created = find("created");
+      let idx_updated = find("updated");
+      let idx_provider_id = find("provider_id");
+      let idx_provider_user_id = find("provider_user_id");
+      let idx_provider_avatar_url = find("provider_avatar_url");
+
+      return Box::new(move |mut row: Row| {
+        return Ok(DbUser {
+          id: row.get(idx_id)?,
+          email: row.consume_value(idx_email)?.try_into()?,
+          unverified_email: row.consume_value(idx_unverified_email)?.try_into()?,
+          username: row.consume_value(idx_username)?.try_into()?,
+          password_hash: row.consume_value(idx_password_hash)?.try_into()?,
+          admin: row.get(idx_admin)?,
+          totp_secret: row.consume_value(idx_totp_secret)?.try_into()?,
+          created: row.get(idx_created)?,
+          updated: row.get(idx_updated)?,
+          provider_id: row.get(idx_provider_id)?,
+          provider_user_id: row.consume_value(idx_provider_user_id)?.try_into()?,
+          provider_avatar_url: row.consume_value(idx_provider_avatar_url)?.try_into()?,
+        });
       });
-    }
+    });
 
     // Should never fail. This means there's a schema mismatch.
-    return from_row_impl(row).map_err(|err| AuthError::Internal(err.into()));
+    return row_to_user(row).map_err(|err| AuthError::Internal(err.into()));
   }
 
   #[cfg(test)]
```

**File**: `crates/core/src/records/update_record.rs` (modified, +2/-1)
```diff
@@ -93,6 +93,7 @@ mod tests {
   use crate::auth::user::User;
   use crate::auth::util::login_with_password;
   use crate::config::proto::{self, PermissionFlag};
+  use crate::constants::USER_TABLE;
   use crate::extract::Either;
   use crate::records::create_record::{
     CreateRecordQuery, CreateRecordResponse, create_record_handler,
@@ -354,7 +355,7 @@ mod tests {
             "data"    TEXT NOT NULL
           ) {strict};
 
-          INSERT INTO test ("user", data) SELECT id, 'secret' FROM _user WHERE email = 'x@test.org';
+          INSERT INTO test ("user", data) SELECT id, 'secret' FROM {USER_TABLE} WHERE email = 'x@test.org';
         "#,
         strict = strict(conn),
         uuid = uuid_column(conn),
```

**File**: `crates/schema/src/record.rs` (modified, +4/-6)
```diff
@@ -99,6 +99,7 @@ fn value_to_flat_json_borrow<'a>(value: &'a SqliteValue) -> Result<Value<'a>, Js
   };
 }
 
+#[allow(clippy::len_without_is_empty)]
 pub trait Record {
   fn len(&self) -> usize;
   fn get_value(&self, index: usize) -> Option<(&str, &trailbase_sqlite::Value)>;
@@ -113,7 +114,7 @@ impl Record for trailbase_sqlite::Row {
   #[inline]
   fn get_value(&self, index: usize) -> Option<(&str, &trailbase_sqlite::Value)> {
     let value = self.get_value(index).ok()?;
-    let name = self.column_name(index)?;
+    let name = self.column(index)?.name.as_str();
     return Some((name, value));
   }
 }
@@ -183,16 +184,13 @@ pub fn record_to_json_expand_ref<'a>(
       if meta.is_fk && expand_config.iter().any(|c| *c == column.name) {
         let id = value_ref_to_flat_json(value)?;
         let Some(expand) = expand.as_mut() else {
-          return Ok((
-            column.name.as_str(),
-            Value::ForeignKey { id: id, data: None },
-          ));
+          return Ok((column.name.as_str(), Value::ForeignKey { id, data: None }));
         };
 
         return Ok((
           column.name.as_str(),
           Value::ForeignKey {
-            id: id,
+            id,
             data: pop_first_matching(expand, |(c, _)| *c == column.name).map(|(_, v)| v),
           },
         ));
```

**File**: `crates/sqlite/src/rows.rs` (modified, +6/-2)
```diff
@@ -153,8 +153,12 @@ impl Row {
   }
 
   #[inline]
-  pub fn column_name(&self, idx: usize) -> Option<&str> {
-    return self.columns.get(idx).map(|c| c.name.as_str());
+  pub fn column(&self, idx: usize) -> Option<&Column> {
+    return self.columns.get(idx);
+  }
+
+  pub fn columns(&self) -> &[Column] {
+    return &self.columns;
   }
 
   #[inline]
```

---

### Incident Patch 4: `0028f5f2` (2026-09-25)
**Commit Message**: Minor: fix escaping of bytea literal in pg tests.

**File**: `crates/sqlite/src/generic.rs` (modified, +4/-4)
```diff
@@ -799,16 +799,16 @@ mod tests {
       int_null: Option<i64>,
       bool_from_int: bool,
     }
-    let query = "
+    let query = r#"
       SELECT
-        CAST('\x05\x01\x01\x01' AS bytea) AS bytes,
+        CAST('\x05010000' AS bytea) AS bytes,
         CAST('\x03' AS bytea) AS vec,
         'foo' AS text,
         NULL AS text_null,
         false AS flag,
         CAST(0 AS INT8) AS int_null,
         1 AS bool_from_int
-      ;";
+      ;"#;
 
     let row = conn.read_query_row(query, ()).await.unwrap().unwrap();
     let data = Data {
@@ -823,7 +823,7 @@ mod tests {
 
     assert_eq!(
       Data {
-        bytes: [5, 1, 1, 1],
+        bytes: [5, 1, 0, 0],
         vec: vec![3],
         text: "foo".to_string(),
         text_null: None,
```

---

### Incident Patch 5: `ceee36bd` (2026-09-24)
**Commit Message**: Fix attached-DB collisions in combined Rust + JS WASM guest integration tests.

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 ## v0.33.22
 
 - Fix behavior when a Rust WASM guest panics:
-  - Respond respond with the error right away via HTTP, i.e. don't rely on timeout.
+  - Respond right away with the error w/o relying on a timeout.
   - Remove trapped component from shared instance pool to avoid poisoning.
 - Add support for SQL `execute_batch` to JS/TS WASM guests.
 - Add integration test coverage for JS/TS WASM components. Still needs to be enabled in CI.
```

**File**: `crates/assets/js/client/tests/integration/wasm_integration.test.ts` (modified, +7/-4)
```diff
@@ -24,7 +24,7 @@ const ONLY_JS: Guest = {
 
 const GUESTS: Guest[] = includeJsGuest ? [ONLY_RUST, ONLY_JS] : [ONLY_RUST];
 
-test.for(GUESTS)(
+test.concurrent.for(GUESTS)(
   "WASM sanity: $runtime",
   async ({ runtime, base }, { expect }) => {
     // Make sure we're calling the right guest;
@@ -34,7 +34,7 @@ test.for(GUESTS)(
   },
 );
 
-describe.for(GUESTS)("WASM HTTP: $runtime", ({ runtime, base }) => {
+describe.concurrent.for(GUESTS)("WASM HTTP: $runtime", ({ runtime, base }) => {
   test("sanity", async ({ expect }) => {
     // Make sure we're calling the right guest;
     expect(
@@ -118,7 +118,7 @@ describe.for(GUESTS)("WASM HTTP: $runtime", ({ runtime, base }) => {
   });
 });
 
-describe.for(GUESTS)("WASM DB: $runtime", ({ runtime, base }) => {
+describe.concurrent.for(GUESTS)("WASM DB: $runtime", ({ runtime, base }) => {
   async function execute(sql: string) {
     const resp = await fetch(`http://${base}/execute_db/${btoa(sql)}`);
     if (!resp.ok) {
@@ -174,7 +174,7 @@ describe.for(GUESTS)("WASM DB: $runtime", ({ runtime, base }) => {
     // Attach db with invalid name fails
     await expect(async () => await attach("session")).rejects.toThrow();
 
-    const dbName = "foo";
+    const dbName = `db${runtime}`;
     const tableName = `'${dbName}'.'test'`;
 
     await attach(dbName);
@@ -199,6 +199,9 @@ describe.for(GUESTS)("WASM DB: $runtime", ({ runtime, base }) => {
     // And succeeds after re-attach.
     await attach(dbName);
     expect(await query(`SELECT COUNT(*) FROM ${tableName};`)).toEqual("300");
+
+    // Finally detach to not clobber multiple executions.
+    await detach(dbName);
   }, /* timeout= */ 15000);
 
   test("concurrent query & execute", async ({ expect }) => {
```

---

### Incident Patch 6: `e3e77d99` (2026-09-23)
**Commit Message**: Fix: when a WASM guest panics respond right away and remove the component instance from the pool.

Add a tests for Rust and JS guests.

**File**: `crates/assets/js/client/tests/integration/wasm_integration.test.ts` (modified, +19/-0)
```diff
@@ -88,6 +88,25 @@ describe.for(GUESTS)("WASM HTTP: $runtime", ({ runtime, base }) => {
     );
   });
 
+  // Make sure the everything works and keeps working (e.g. the shared rt pool
+  // doesn't get poisoned) when a component returns a non-http response, e.g.:
+  // traps by panicking.
+  test("incoming HTTP triggers panic", async ({ expect }) => {
+    const panic = async () => {
+      const response = await fetch(`http://${base}/panic`);
+      expect(response.status).equals(status.INTERNAL_SERVER_ERROR);
+    };
+
+    await Promise.all(
+      Array.from({ length: 25 }, async (_v, _i) => await panic()),
+    );
+
+    // Make sure everything is still working.
+    expect(
+      await (await fetch(`http://${base}/method`, { method: "GET" })).text(),
+    ).toBe("get");
+  });
+
   // Make sure that we have TLS and guests can call external HTTPS targets.
   test("outgoing TLS/HTTPS", async ({ expect }) => {
     const TARGET = "https://example.com";
```

**File**: `crates/wasm-runtime-axum/src/lib.rs` (modified, +14/-4)
```diff
@@ -247,6 +247,7 @@ pub async fn install_routes_and_jobs<S: Clone + Send + Sync + 'static>(
 
     has_root |= method == HttpMethodType::Get && path == "/";
 
+    let component_name = name.clone();
     let registered_path = path.clone();
     let store = store.clone();
 
@@ -292,6 +293,7 @@ pub async fn install_routes_and_jobs<S: Clone + Send + Sync + 'static>(
         );
 
         // Call WASM.
+        let uri = request.uri().clone();
         return match store
           .call_incoming_http_handler(request, Some(Duration::from_secs(20)))
           .await
@@ -305,9 +307,17 @@ pub async fn install_routes_and_jobs<S: Clone + Send + Sync + 'static>(
               axum::body::Body::from_stream(body.into_data_stream()),
             )
           }
-          Err(err) => {
-            warn!("`Error calling WASM component - call_incoming_http_handler` returned: {err}");
-            return internal("component responded unexpectedly");
+          Err(_err) => {
+            // We didn't receive an HTTP response, either something is broken with the
+            // implementation or the WASM component may have trapped (i.e. panicked).
+            warn!("Error calling WASM component '{component_name}': {uri}");
+
+            return cfg_select! {
+              debug_assertions => {
+                internal(format!("component responded unexpectedly\n{_err}"))
+              }
+              _ => internal("component responded unexpectedly"),
+            };
           }
         };
       };
@@ -425,7 +435,7 @@ fn empty() -> UnsyncBoxBody<Bytes, hyper::Error> {
   return UnsyncBoxBody::new(http_body_util::Empty::new().map_err(|_| unreachable!()));
 }
 
-fn internal(msg: &'static str) -> axum::response::Response {
+fn internal(msg: impl Into<axum::body::Body>) -> axum::response::Response {
   return axum::response::Response::builder()
     .status(StatusCode::INTERNAL_SERVER_ERROR)
     .body(msg.into())
```

**File**: `crates/wasm-runtime-host/src/lib.rs` (modified, +110/-82)
```diff
@@ -250,8 +250,9 @@ impl StoreBuilder<State> for Arc<SharedState> {
 
 struct StoreAndBindings {
   store: Store<State>,
-  // bindings: crate::host::Interfaces,
   proxy_bindings: wasmtime_wasi_http::p2::bindings::Proxy,
+  // Can be used to mark an instance as defunct.
+  has_trapped: bool,
 }
 
 struct StoreManager {
@@ -273,14 +274,19 @@ impl deadpool::managed::Manager for StoreManager {
     return Ok(StoreAndBindings {
       store,
       proxy_bindings,
+      has_trapped: false,
     });
   }
 
   async fn recycle(
     &self,
-    _: &mut StoreAndBindings,
+    candidate: &mut StoreAndBindings,
     metrics: &deadpool::managed::Metrics,
   ) -> Result<(), deadpool::managed::RecycleError<Error>> {
+    if candidate.has_trapped {
+      return Err(deadpool::managed::RecycleError::message("defunct"));
+    }
+
     // Limit how often a store gets recycled to avoid persistent ballooning if guests have memory
     // leaks.
     if metrics.recycle_count > 2048 {
@@ -438,8 +444,9 @@ impl HttpStore {
     };
 
     return Self::call(rt, {
-      let timeout = timeout.unwrap_or(DEFAULT_CALL_TIMEOUT);
+      let call_timeout = timeout.unwrap_or(DEFAULT_CALL_TIMEOUT);
       let state = self.state.clone();
+
       async move {
         let uri = request.uri().clone();
         let (sender, receiver) = tokio::sync::oneshot::channel::<
@@ -460,96 +467,117 @@ impl HttpStore {
         // out of scope.
         let handle = tokio::spawn(REQUEST_ID.scope(REQUEST_ID.with(|id| *id), async move {
           let uri = request.uri().clone();
-          let res = match &*state {
-            HttpStoreInternal::Unique { rt } => {
-              // Instantiate a store per request.
-              let (mut store, _bindings) = rt.new_bindings().await?;
-              let proxy_bindings = wasmtime_wasi_http::p2::bindings::Proxy::instantiate_async(
-                &mut store,
-                &rt.state.component,
-                &rt.state.linker,
-              )
-              .await?;
-
-              let req = store.data_mut().http().new_incoming_request(
-                wasmtime_wasi_http::p2::bindings::http::types::Scheme::Http,
-                request,
-              )?;
-              let out = store.data_mut().http().new_response_outparam(sender)?;
-              tokio::time::timeout(
-                timeout,
-                proxy_bindings.wasi_http_incoming_handler().call_handle(
-                  store.as_context_mut(),
-                  req,
-                  out,
-                ),
-              )
-              .await
-              .map_err(|_err| Error::Timeout(Some(uri)))?
-            }
-            HttpStoreInternal::Shared { pool, .. } => {
-              // Acquire shared store from pool.
-              let StoreAndBindings {
-                ref mut store,
-                ref proxy_bindings,
-              } = *pool.get().await.map_err(|_err| Error::Timeout(None))?;
-
-              let req = store.data_mut().http().new_incoming_request(
-                wasmtime_wasi_http::p2::bindings::http::types::Scheme::Http,
-                request,
-              )?;
-              let out = store.data_mut().http().new_response_outparam(sender)?;
-              tokio::time::timeout(
-                timeout,
-                proxy_bindings.wasi_http_incoming_handler().call_handle(
-                  store.as_context_mut(),
-                  req,
-                  out,
-                ),
-              )
-              .await
-              .map_err(|_err| {
-                log::warn!("HTTP call to WASM timed out: {uri} ({timeout:?})");
-                return Error::Timeout(Some(uri));
-              })?
-            }
+
+          let dispatch = async || -> Result<(), Error> {
+            match &*state {
+              HttpStoreInternal::Unique { rt } => {
+                // Instantiate a store per request.
+                let (mut store, _bindings) = rt.new_bindings().await?;
+                let proxy_bindings
```

**File**: `examples/collab-clicker-ssr/guests/rust/src/lib.rs` (modified, +3/-1)
```diff
@@ -44,7 +44,9 @@ impl Guest for Endpoints {
 
         let template: Cow<'_, str> = cfg_select! {
           feature = "bundle" => assets::HTML_TEMPLATE.into(),
-          _ => String::from_utf8(read_cached_file("/dist/client/index.html")?).map_err(internal)?.into(),
+          _ => String::from_utf8(read_cached_file("/dist/client/index.html")?)
+            .map_err(internal)?
+            .into(),
         };
 
         let template = PLACEHOLDER_RE
```

---

### Incident Patch 7: `3b29c38e` (2026-09-22)
**Commit Message**: Clean-up ERD graph impl, stop focusing on node select, and re-apply style after resizing to avoid (buggy?) edge de-colorization.

**File**: `crates/assets/js/admin/src/components/erd/ErdGraph.tsx` (modified, +191/-151)
```diff
@@ -1,12 +1,22 @@
 import { createEffect, onCleanup } from "solid-js";
-import { Graph, Shape, Edge, NodeMetadata, EdgeMetadata } from "@antv/x6";
+
+import {
+  Graph,
+  Shape,
+  EdgeProperties,
+  NodeMetadata,
+  EdgeMetadata,
+} from "@antv/x6";
+export type { NodeMetadata, EdgeMetadata } from "@antv/x6";
+export type { PortMetadata } from "@antv/x6/lib/model/port";
+
 import type { ResolvedTheme } from "@/lib/theme";
 import { createWindowSize } from "@/lib/signals";
 
+import type { Column } from "@bindings/Column";
+
 export const LINE_HEIGHT = 24;
 export const NODE_WIDTH = 250;
-const EDGE_COLOR = "var(--primary)";
-const RELATED_EDGE_COLOR = "var(--destructive)";
 
 type Theme = {
   fill: string;
@@ -18,106 +28,28 @@ type Theme = {
 const lightTheme: Theme = {
   fill: "var(--card)",
   accent: "var(--border)",
-  edge: EDGE_COLOR,
+  edge: "var(--primary)",
   text: "var(--card-foreground)",
 };
 const darkTheme = lightTheme;
 
+export function getTheme(theme: ResolvedTheme): Theme {
+  return theme === "light" ? lightTheme : darkTheme;
+}
+
 export function nodeName(theme: ResolvedTheme): string {
   return theme === "dark" ? "dark:er-rect" : "light:er-rect";
 }
-export function erdTheme(dark: boolean): Theme {
-  return dark ? darkTheme : lightTheme;
-}
 
-function setupGraph() {
-  Graph.registerPortLayout(
-    "erPortPosition",
-    (ports) =>
-      ports.map((_, index) => ({
-        position: { x: 0, y: (index + 1) * LINE_HEIGHT },
-        angle: 0,
-      })),
-    true,
-  );
-  for (const themeName of ["light", "dark"] as ResolvedTheme[]) {
-    Graph.registerNode(
-      nodeName(themeName),
-      {
-        inherit: "rect",
-        markup: [
-          { tagName: "rect", selector: "body" },
-          { tagName: "text", selector: "label" },
-          { tagName: "text", selector: "typeLabel" },
-        ],
-        attrs: {
-          body: {
-            strokeWidth: 2,
-            stroke: "var(--border)",
-            fill: "var(--card)",
-          },
-          label: {
-            fontWeight: "bold",
-            fill: "var(--card-foreground)",
-            fontSize: 12,
-            refX: 8,
-            refY: 12,
-            textAnchor: "start",
-          },
-          typeLabel: {
-            fill: "var(--muted-foreground)",
-            fontSize: 10,
-            refX: NODE_WIDTH - 8,
-            refY: 12,
-            textAnchor: "end",
-          },
-        },
-        ports: {
-          groups: {
-            list: {
-              markup: [
-                { tagName: "rect", selector: "portBody" },
-                { tagName: "text", selector: "portNameLabel" },
-                { tagName: "text", selector: "portTypeLabel" },
-              ],
-              attrs: {
-                portBody: {
-                  width: NODE_WIDTH,
-                  height: LINE_HEIGHT,
-                  strokeWidth: 1,
-                  stroke: "var(--border)",
-                  fill: "var(--card)",
-                },
-                portNameLabel: {
-                  ref: "portBody",
-                  refX: 8,
-                  refY: 6,
-                  fontSize: 10,
-                  fill: "var(--card-foreground)",
-                },
-                portTypeLabel: {
-                  ref: "portBody",
-                  refX: 180,
-                  refY: 6,
-                  fontSize: 10,
-                  fill: "var(--muted-foreground)",
-                },
-              },
-              position: "erPortPosition",
-            },
-          },
-        },
-      },
-      true,
-    );
-  }
+export function portId(
+  tableName: string,
+  column: Column,
+  index: number,
+): string {
+  return `${tableName}-${column.name}-${index}`;
 }
-setupGraph();
 
-export function layoutErdNodes(
-  nodes: NodeMetadata[],
-  aspect: number,
-): NodeMetadata[] {
+function layoutErdNodes(nodes: NodeMetadata[], aspect: number): NodeMetadata[] {
   if (nodes.length === 0) return []
```

**File**: `crates/assets/js/admin/src/components/erd/ErdPage.tsx` (modified, +31/-62)
```diff
@@ -7,43 +7,48 @@ import {
   createMemo,
   createSignal,
 } from "solid-js";
-import { createTableSchemaQuery } from "@/lib/api/table";
-import { prettyFormatQualifiedName } from "@/lib/schema";
-import { NodeMetadata, EdgeMetadata } from "@antv/x6";
-import { PortMetadata } from "@antv/x6/lib/model/port";
 import {
   TbOutlineArrowBackUp,
   TbOutlineMaximize,
   TbOutlineMinus,
   TbOutlinePlus,
 } from "solid-icons/tb";
 
-import { Button } from "@/components/ui/button";
-import { Toggle } from "@/components/ui/toggle";
 import { Badge } from "@/components/ui/badge";
+import { Toggle } from "@/components/ui/toggle";
 import { Callout, CalloutContent, CalloutTitle } from "@/components/ui/callout";
 import { Header } from "@/components/Header";
 import { Spinner } from "@/components/Spinner";
+import { Button } from "@/components/ui/button";
+
 import {
-  ErdGraph,
   nodeName,
-  type ErdGraphHandle,
-  NODE_WIDTH,
+  portId,
+  edgeProperties,
+  ErdGraph,
   LINE_HEIGHT,
+  NODE_WIDTH,
+} from "@/components/erd/ErdGraph";
+import type {
+  ErdGraphHandle,
+  NodeMetadata,
+  EdgeMetadata,
+  PortMetadata,
 } from "@/components/erd/ErdGraph";
 
 import {
+  ForeignKey,
+  getColumns,
   getForeignKey,
   getUnique,
-  isNotNull,
   hiddenTable,
+  isNotNull,
+  prettyFormatQualifiedName,
   tableType,
-  getColumns,
-  ForeignKey,
 } from "@/lib/schema";
 import { createTheme, type ResolvedTheme } from "@/lib/theme";
+import { createTableSchemaQuery } from "@/lib/api/table";
 
-import type { Column } from "@bindings/Column";
 import type { Table } from "@bindings/Table";
 import type { View } from "@bindings/View";
 import type { ListSchemasResponse } from "@bindings/ListSchemasResponse";
@@ -139,38 +144,6 @@ export function searchErdEntities(
   );
 }
 
-export function relatedEntityIds(
-  relations: ErdRelation[],
-  selectedId?: string,
-): Set<string> {
-  const related = new Set<string>();
-  if (selectedId === undefined) {
-    return related;
-  }
-
-  related.add(selectedId);
-  for (const relation of relations) {
-    if (relation.sourceId === selectedId) {
-      related.add(relation.targetId);
-    }
-    if (relation.targetId === selectedId) {
-      related.add(relation.sourceId);
-    }
-  }
-  return related;
-}
-
-export function selectionStatus(
-  entities: ErdEntity[],
-  relations: ErdRelation[],
-  selectedId?: string,
-): string {
-  if (selectedId === undefined) return "No entity focused";
-  const name =
-    entities.find((entity) => entity.id === selectedId)?.name ?? selectedId;
-  return `${name} focused, ${relatedEntityIds(relations, selectedId).size - 1} direct relationships`;
-}
-
 function edgeCellId(endpoint: EdgeMetadata["source"]): string | undefined {
   if (typeof endpoint === "string") {
     return endpoint;
@@ -181,10 +154,10 @@ function edgeCellId(endpoint: EdgeMetadata["source"]): string | undefined {
   return undefined;
 }
 
-export function buildErdModel(
+function buildErdModel(
   schema: ListSchemasResponse,
   visibility: ErdVisibility,
-  theme?: ResolvedTheme,
+  resolvedTheme: ResolvedTheme,
 ): ErdModel {
   const allTablesAndViews = [
     ...schema.tables.map(([table]) => table),
@@ -207,14 +180,14 @@ export function buildErdModel(
   const visibleIds = new Set(entities.map((entity) => entity.id));
   const nodes: NodeMetadata[] = [];
   const edges: EdgeMetadata[] = [];
-  const resolvedTheme = theme ?? "light";
 
   for (const tableOrView of visibleTablesAndViews) {
     const [node, nodeEdges] = buildErNode(
       resolvedTheme,
       allTablesAndViews,
       tableOrView,
     );
+
     nodes.push(node);
     edges.push(
       ...nodeEdges.filter((edge) => {
@@ -253,23 +226,14 @@ function buildErNode(
   allTablesAndViews: (Table | View)[],
   tableOrView: Table | View,
 ): [NodeMetadata, EdgeMetadata[]] {
-  const BASE_EDGE = {
-    shape: "edge",
-    // attr: { line: { stroke: edge_color, strokeWidth: 2 } },
-    zIndex: 0,
-  };
-
   const name = prettyFo
```

---

### Incident Patch 8: `2c3c9712` (2026-09-20)
**Commit Message**: Fix homepage footer regression after starlight update.

**File**: `docs/src/components/layout/Footer.astro` (modified, +2/-3)
```diff
@@ -6,11 +6,11 @@ import type { StarlightUserConfig } from "@astrojs/starlight/types";
 import { repo } from "@/config";
 import nut from "@/assets/nut.svg";
 
-const isHomepage = Astro.locals.starlightRoute.id === "index.mdx";
+const isSplash = Astro.locals.starlightRoute.entry?.data?.template === "splash";
 const columnStyle = "flex flex-col gap-1 items-center justify-start";
 ---
 
-{isHomepage ? (
+{isSplash ? (
   <footer class="pt-[28px]">
     <div class="absolute left-0 w-full">
       <div class="bg-accent-200 h-px" />
@@ -19,7 +19,6 @@ const columnStyle = "flex flex-col gap-1 items-center justify-start";
         <img class="relative top-[-20px] size-[40px]" src={nut.src} />
       </div>
     </div>
-
     <div class="grid grid-cols-3 gap-4 pt-[32px]">
       <div class={columnStyle}>
         <strong>About</strong>
```

---

### Incident Patch 9: `33b5373e` (2026-09-17)
**Commit Message**: Admin UI: fix table explorer incorrect schema/table parse when table name contains ".".

**File**: `crates/assets/js/admin/src/components/explorer/TablePane.tsx` (modified, +5/-8)
```diff
@@ -522,14 +522,11 @@ function RecordTable(props: {
 
                 (async () => {
                   try {
-                    await deleteRows(
-                      prettyFormatQualifiedName(selectedSchema().name),
-                      {
-                        primary_key_column:
-                          columns()?.[pkColumnIndex()].name ?? "??",
-                        values: ids,
-                      },
-                    );
+                    await deleteRows(selectedSchema().name, {
+                      primary_key_column:
+                        columns()?.[pkColumnIndex()].name ?? "??",
+                      values: ids,
+                    });
 
                     setSelectedRows(new Map<string, SqlValue>());
                   } catch (err) {
```

**File**: `crates/assets/js/admin/src/lib/api/row.ts` (modified, +30/-12)
```diff
@@ -1,9 +1,6 @@
 import { adminFetch } from "@/lib/fetch";
 import { buildListSearchParams } from "@/lib/list";
-import {
-  findPrimaryKeyColumnIndex,
-  prettyFormatQualifiedName,
-} from "@/lib/schema";
+import { findPrimaryKeyColumnIndex } from "@/lib/schema";
 import type { Record } from "@/lib/record";
 
 import type { Table } from "@bindings/Table";
@@ -21,12 +18,30 @@ function removeUndefined(row: Record): { [key: string]: SqlValue } {
   ) as { [key: string]: SqlValue };
 }
 
+function formatQualifiedName(name: QualifiedName): string {
+  const db = name.database_schema;
+  if (db && db !== "main") {
+    return `${db}.${name.name}`;
+  }
+
+  // Edge case when table name contains ".", e,g. 'main.foo.bar'. To not trip
+  // up server-side parsing, full qualification is necessary.
+  //
+  // NOTE: This may brake for implicit schemas with PG, when the fallback
+  // should be "public".
+  if (name.name.includes(".")) {
+    return `${db ?? "main"}.${name.name}`;
+  }
+
+  return name.name;
+}
+
 export async function insertRow(table: Table, row: Record) {
   const request: InsertRowRequest = {
     row: removeUndefined(row),
   };
 
-  const tableName: string = prettyFormatQualifiedName(table.name);
+  const tableName: string = formatQualifiedName(table.name);
   const response = await adminFetch(`/table/${tableName}`, {
     method: "POST",
     body: JSON.stringify(request),
@@ -44,7 +59,7 @@ export async function updateRowInternal(
   columns: Column[],
   row: Record,
 ) {
-  const tableName: string = prettyFormatQualifiedName(qualifiedTableName);
+  const tableName: string = formatQualifiedName(qualifiedTableName);
   const primaryKeyColumIndex = findPrimaryKeyColumnIndex(columns);
   if (primaryKeyColumIndex === undefined) {
     throw Error("No primary key column found.");
@@ -75,13 +90,16 @@ export async function updateRowInternal(
 }
 
 export async function deleteRows(
-  tableName: string,
+  tableName: QualifiedName,
   request: DeleteRowsRequest,
 ) {
-  const response = await adminFetch(`/table/${tableName}/rows`, {
-    method: "DELETE",
-    body: JSON.stringify(request),
-  });
+  const response = await adminFetch(
+    `/table/${formatQualifiedName(tableName)}/rows`,
+    {
+      method: "DELETE",
+      body: JSON.stringify(request),
+    },
+  );
   return await response.text();
 }
 
@@ -120,7 +138,7 @@ export async function fetchRows(
   });
 
   const response = await adminFetch(
-    `/table/${prettyFormatQualifiedName(tableName)}/rows?${params}`,
+    `/table/${formatQualifiedName(tableName)}/rows?${params}`,
   );
   // IMPORTANT: Use JSON parser that handles i64 correctly.
   return parseJSON(await response.text()) as ListRowsResponse;
```

---

### Incident Patch 10: `614f6ffd` (2026-09-17)
**Commit Message**: Give mobile navbar a glow-up with blur effect, fix url-bar hiding, and address ERD graph resize exceptions again (removed the fix in the past but there are still edge-cases, e.g. on mobile firefox where it triggers).

**File**: `client/kotlin/gradle/libs.versions.toml` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ junit-platform-launcher = { module = "org.junit.platform:junit-platform-launcher
 
 totp = { module = "dev.samstevens.totp:totp", version.ref = "totp" }
 
+
 [plugins]
 android-kotlin-multiplatform-library = { id = "com.android.kotlin.multiplatform.library", version.ref = "agp" }
 kotlin-multiplatform = { id = "org.jetbrains.kotlin.multiplatform", version.ref = "kotlin" }
```

**File**: `crates/assets/js/admin/src/App.tsx` (modified, +4/-4)
```diff
@@ -27,7 +27,7 @@ function LeftNav(props: RouteSectionProps) {
   return (
     <>
       {/* Big-z to draw navbar over collapsed sidebar */}
-      <div class="hide-scrollbars sticky z-50 h-dvh w-[58px] overflow-hidden">
+      <div class="sticky left-0 z-50 max-h-dvh w-[58px]">
         <VerticalNavbar location={props.location} />
       </div>
 
@@ -40,12 +40,12 @@ function LeftNav(props: RouteSectionProps) {
 
 function TopNav(props: RouteSectionProps) {
   return (
-    <div class="flex h-dvh flex-col">
-      <div class="hide-scrollbars sticky z-50 scrollbar-thin overflow-x-auto overflow-y-hidden">
+    <div class="relative flex min-h-dvh w-full flex-col">
+      <div class="sticky top-0 z-50">
         <HorizontalNavbar height={48} location={props.location} />
       </div>
 
-      <main class="absolute inset-0 top-[48px] h-[calc(100dvh-48px)] w-dvw">
+      <main class="absolute inset-0 pt-[48px]">
         <ErrorBoundary>{props.children}</ErrorBoundary>
       </main>
     </div>
```

**File**: `crates/assets/js/admin/src/components/IndexPage.tsx` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@ export function IndexPage() {
   }));
 
   return (
-    <div class="size-full scrollbar-thin overflow-y-auto">
+    <div class="size-full scrollbar-thin md:overflow-y-auto">
       <Header title="TrailBase" />
 
       <div class="prose dark:prose-invert flex grow flex-col gap-4 p-4">
```

**File**: `crates/assets/js/admin/src/components/Navbar.tsx` (modified, +2/-2)
```diff
@@ -183,7 +183,7 @@ export function HorizontalNavbar(props: {
         "min-height": `${props.height}px`,
         "max-height": `${props.height}px`,
       }}
-      class="border-border bg-sidebar text-sidebar-foreground hide-scrollbars flex w-full items-center justify-between gap-1 overflow-x-auto overflow-y-hidden border-b p-2"
+      class="border-border bg-sidebar/80 text-sidebar-foreground hide-scrollbars flex w-full items-center justify-between gap-1 overflow-x-auto border-b p-2 backdrop-blur-md"
     >
       <NavbarItems location={props.location} horizontal={true} />
 
@@ -196,7 +196,7 @@ export function VerticalNavbar(props: { location: Location }) {
   return (
     <nav
       class={
-        "border-border bg-sidebar text-sidebar-foreground flex h-dvh grow flex-col items-center justify-between gap-4 border-r py-2"
+        "hide-scrollbars border-border bg-sidebar text-sidebar-foreground flex h-dvh flex-col items-center justify-between gap-4 overflow-y-auto border-r py-2"
       }
     >
       <div class="flex flex-col items-center gap-4">
```

**File**: `crates/assets/js/admin/src/components/Version.tsx` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ export function Version(props: { info: InfoResponse | undefined }) {
         }}
       </Match>
 
-      <Match when={true}>{props.info?.commit_hash}</Match>
+      <Match when={true}>{props.info?.commit_hash?.substring(0, 10)}</Match>
     </Switch>
   );
 }
```

#### Recent Merged Pull Requests:
- **PR #293** (2026-09-18): Add built-in helpers for expanded types to Kotlin client (@Bnyro)
- **PR #292** (2026-09-17): Add README documentation to kotlin client (@Bnyro)
- **PR #291** (closed): docs: Clarify how to upload files with JSON requests (@Bnyro)
- **PR #290** (2026-09-14): Fix table explorer resetting page size on sort/filter (@brigon-dev)
- **PR #288** (2026-09-14): Pr/native apple signin (@ignatz)
- **PR #287** (2026-09-11): Fix creating records using default values with Kotlin client (@Bnyro)
- **PR #286** (closed): native apple signin (@yurvon-screamo)
- **PR #284** (closed): Fix Apple OAuth: form POST callback, id_token parsing, request-body auth, SameSite=None (#282) (@yurvon-screamo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

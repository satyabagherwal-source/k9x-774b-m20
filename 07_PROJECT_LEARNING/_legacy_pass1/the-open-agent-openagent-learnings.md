# Forensic Learning Record (Deep Inspection): the-open-agent/openagent

> **Canonical Artifact**: `07_PROJECT_LEARNING/the-open-agent-openagent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/the-open-agent/openagent](https://github.com/the-open-agent/openagent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:15:57.115Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `the-open-agent/openagent`
- **Description**: ⚡️next-generation personal AI assistant powered by LLM, RAG and agent loops, supporting computer-use, browser-use and coding agent, demo: https://demo.openagentai.org
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 5675 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `audio/audio.go`
```
// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package audio

import (
	"bytes"
	"io"
	"os"
	"os/exec"
	"strings"
)

func extractAudioExample() {
	inputPath := "C:\\Users\\yangluo\\AppData\\Local\\Temp\\casibase-input-2968149305.mp4"
	outputPath := "C:\\Users\\yangluo\\AppData\\Local\\Temp\\casibase-output-469162762.mp3"

	// https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip
	cmd := exec.Command("ffmpeg", "-i", inputPath, "-q:a", "0", "-map", "a", outputPath)
	err := cmd.Run()
	if err != nil {
		panic(err)
	}
}

func GetAudioFromVideo(inputBuffer *bytes.Buffer) (*bytes.Buffer, error) {
	tmpInputFile, err := os.CreateTemp("", "casibase-audio-*.mp4")
	if err != nil {
		return nil, err
	}
	defer os.Remove(tmpInputFile.Name())

	_, err = io.Copy(tmpInputFile, inputBuffer)
	if err != nil {
		return nil, err
	}
	tmpInputFile.Close()

	tmpOutputFileName := strings.Replace(tmpInputFile.Name(), ".mp4", ".mp3", 1)
	cmd := exec.Command("ffmpeg", "-i", tmpInputFile.Name(), "-q:a", "0", "-map", "a", tmpOutputFileName)
	err = cmd.Run()
	if err != nil {
		return nil, err
	}

	tmpOutputFile, err := os.Open(tmpOutputFileName)
	if err != nil {
		return nil, err
	}

	outputBuffer := bytes.NewBuffer(nil)
	_, err = io.Copy(outputBuffer, tmpOutputFile)
	if err != nil {
		return nil, err
	}

	defer tmpOutputFile.Close()
	defer os.Remove(tmpOutputFileName)

	return outputBuffer, nil
}

```

### Core Architecture Module: `audio/xfyun_client.go`
```
// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package audio

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/the-open-agent/openagent/i18n"
)

var ch string = "aaaaaaaaa`"

type Conn struct {
	c    *http.Client
	conf *Conf
}

type Client struct {
	conn *Conn
}

type RespInfo struct {
	Ok     int    `json:"ok"`
	ErrNo  int    `json:"err_no"`
	Failed string `json:"failed"`
	Data   string `json:"data"`
}

func New(appID, secretKey string) *Client {
	client := Client{}
	conf := getDefaultConf()
	conf.AppID = appID
	conf.SecretKey = secretKey

	conn := Conn{&http.Client{}, conf}
	client.conn = &conn

	return &client
}

func (c *Client) UploadAudio(filename, language string, lang string) (taskId string, err error) {
	filesize, sliceNum, err := c.conn.getSizeAndSiceNum(filename)
	if err != nil {
		return
	}
	taskId, err = c.initSliceUpload(filename, language, filesize, sliceNum, lang)
	if err != nil {
		return
	}

	if err = c.performSliceUpload(filename, taskId, filesize, sliceNum, lang); err != nil {
		return
	}

	if err = c.completeSliceUpload(taskId, lang); err != nil {
		return
	}

	return
}

func (c *Client) initSliceUpload(filename, language string, filesize, sliceNum int64, lang string) (taskId string, err error) {
	var info RespInfo
	params := c.getBaseAuthParam("")
	params.Add("file_len", strconv.FormatInt(filesize, 10))
	params.Add("file_name", filename)
	params.Add("language", language)
	params.Add("slice_num", strconv.FormatInt(sliceNum, 10))

	resp, err := c.conn.httpDo(c.conn.conf.Domain+"/prepare", nil, params, nil)
	if err != nil {
		return
	}

	if err = json.Unmarshal([]byte(resp), &info); err != nil {
		return
	}

	if info.Ok == 0 {
		taskId = info.Data
	} else {
		err = fmt.Errorf(i18n.Translate(lang, "audio:init slice upload failed: %s"), info.Failed)
	}

	return
}

func (c *Client) performSliceUpload(filename, taskId string, filesize, sliceNum int64, lang string) (err error) {
	var info RespInfo
	fi, err := os.OpenFile(filename, os.O_RDONLY, os.ModePerm)
	if err != nil {
		return
	}
	defer fi.Close()

	b := make([]byte, c.conn.conf.PartSize)
	for i := int64(1); i <= sliceNum; i++ {
		fi.Seek((i-1)*c.conn.conf.PartSize, 0)
		if len(b) > int(filesize-(i-1)*c.conn.conf.PartSize) {
			b = make([]byte, filesize-(i-1)*c.conn.conf.PartSize)
		}
		fi.Read(b)

		params := c.getBaseAuthParam(taskId)
		params.Add("slice_id", c.getNextSliceId())
		resp, err := c.conn.postMulti(c.conn.conf.Domain+"/upload", filename, b, params)
		if err != nil {
			return err
		}

		if err := json.Unmarshal([]byte(resp), &info); err != nil {
			return err
		}

		if info.Ok != 0 {
			return fmt.Errorf(i18n.Translate(lang, "audio:perform slice upload failed: %s"), info.Failed)
		}
	}
	return nil
}

func (c *Client) completeSliceUpload(taskId string, lang string) (err error) {
	params := c.getBaseAuthParam(taskId)
	resp, err := c.conn.httpDo(c.conn.conf.Domain+"/merge", nil, params, nil)
	if err != nil {
		return
	}
	var info RespInfo
	if err = json.Unmarshal([]byte(resp), &info); err != nil {
		return
	}

	if info.Ok != 0 {
		return fmt.Errorf(i18n.Translate(lang, "audio:complete slice upload failed: %s"), info.Failed)
	}

	return nil
}

func (c *Client) doWorker(filename, taskId string, b []byte, lang string) (err error) {
	params := c.getBaseAuthParam(taskId)
	params.Add("slice_id", c.getNextSliceId())
	resp, err := c.conn.postMulti(c.conn.conf.Domain+"/upload", filename, b, params)
	if err != nil {
		return err
	}
	var info RespInfo
	if err := json.Unmarshal([]byte(resp), &info); err != nil {
		return err
	}

	if info.Ok != 0 {
		return fmt.Errorf(i18n.Translate(lang, "audio:worker upload failed: %s"), info.Failed)
	}

	return
}

func (c *Client) getProgress(taskId string, lang string) (*Response, error) {
	params := c.getBaseAuthParam(taskId)
	resp, err := c.conn.httpDo(c.conn.conf.Domain+"/getProgress", nil, params, nil)
	if err != nil {
		return nil, err
	}

	var info RespInfo
	if err = json.Unmarshal(resp, &info); err != nil {
		return nil, err
	}

	if info.Ok != 0 {
		return nil, fmt.Errorf(i18n.Translate(lang, "audio:get progress failed: %s"), info.Failed)
	}

	var res *Response
	res, err = parseResponse(info.Data)
	return res, err
}

func (c *Client) getResult(taskId string, lang string) ([]*Segment, error) {
	params := c.getBaseAuthParam(taskId)
	resp, err := c.conn.httpDo(c.conn.conf.Domain+"/getResult", nil, params, nil)
	if err != nil {
		return nil, err
	}

	var info RespInfo
	err = json.Unmarshal(resp, &info)
	if err != nil {
		return nil, err
	}

	if info.Ok != 0 {
		return nil, fmt.Errorf(i18n.Translate(lang, "audio:get result failed: %s"), info.Failed)
	}

	segments, err := parseSegmentResponse(info.Data)
	if err != nil {
		return nil, err
	}

	return segments, nil
}

func GetSegmentsFromAudio(audioUrl string, lang string) ([]*Segment, error) {
	client := New(xfyunAppId, xfyunSecretKey)

	taskId, err := client.UploadAudio(audioUrl, "cn", lang)
	if err != nil {
		return nil, err
	}

	for {
		var resp *Response
		resp, err = client.getProgress(taskId, lang)
		if err != nil && !strings.Contains(err.Error(), "请稍后重试") {
			return nil, err
		}

		if resp.Status == 3 {
			time.Sleep(2 * time.Second)
			continue
		}

		var segments []*Segment
		segments, err = client.getResult(taskId, lang)
		if err != nil {
			return nil, err
		}

		return segments, err
	}
}

```

### Core Architecture Module: `audio/xfyun_conf.go`
```
// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package audio

var (
	xfyunAppId     = ""
	xfyunSecretKey = ""
)

const (
	defaultPartSize   = 10 * 1024 * 1024
	defaultRetryTimes = 3
	defaultUA         = "raasr-go-sdk-v1.0.0"
	defaultDomain     = "https://raasr.xfyun.cn/api"
)

// Conf config struct
type Conf struct {
	AppID      string
	SecretKey  string
	PartSize   int64
	RetryTimes int
	Ch         string
	UA         string
	Domain     string
}

func getDefaultConf() *Conf {
	conf := Conf{}
	conf.PartSize = defaultPartSize
	conf.RetryTimes = defaultRetryTimes
	conf.UA = defaultUA
	conf.Domain = defaultDomain

	return &conf
}

```

### Core Architecture Module: `audio/xfyun_util.go`
```
// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package audio

import (
	"bytes"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"
)

func (c *Conn) postMulti(uri, filename string, content []byte, params url.Values) ([]byte, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("content", filename+params.Get("slice_id"))
	if err != nil {
		return nil, err
	}
	_, err = io.Copy(part, bytes.NewBuffer(content))

	for key, val := range params {
		_ = writer.WriteField(key, val[0])
	}
	err = writer.Close()
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequest("POST", uri, body)
	request.Header.Set("Content-Type", writer.FormDataContentType())

	res, err := c.c.Do(request)
	if err != nil {
		return nil, err
	}

	return ioutil.ReadAll(res.Body)
}

func (c *Conn) httpDo(url string, body []byte, params url.Values, headers map[string]string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	if params != nil {
		req.URL.RawQuery = params.Encode()
	}
	if headers != nil {
		for key, val := range headers {
			req.Header.Add(key, val)
		}
	}
	resp, err := c.c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return ioutil.ReadAll(resp.Body)
}

func (c *Conn) getSizeAndSiceNum(filename string) (filesize, num int64, err error) {
	filesize, err = fileSize(filename)
	if err != nil {
		return
	}
	num = int64(math.Ceil(float64(filesize) / float64(c.conf.PartSize)))
	return
}

func (c *Client) getBaseAuthParam(taskId string) url.Values {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	mac := hmac.New(sha1.New, []byte(c.conn.conf.SecretKey))
	strByte := []byte(c.conn.conf.AppID + ts)
	strMd5Byte := md5.Sum(strByte)
	strMd5 := fmt.Sprintf("%x", strMd5Byte)
	mac.Write([]byte(strMd5))
	signa := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	params := url.Values{}
	params.Add("app_id", c.conn.conf.AppID)
	params.Add("signa", signa)
	params.Add("ts", ts)
	if len(taskId) > 0 {
		params.Add("task_id", taskId)
	}

	return params
}

func (c *Client) getNextSliceId() string {
	j := len(ch) - 1
	for i := j; i >= 0; {
		cj := string(ch[i])
		if cj != "z" {
			ch = ch[:i] + string(ch[i]+1) + ch[i+1:]
			break
		} else {
			ch = string(ch[:i]) + "a" + ch[i+1:]
			i--
		}
	}
	return ch
}

func fileSize(filename string) (int64, error) {
	info, err := os.Stat(filename)
	if err != nil && os.IsNotExist(err) {
		return 0, err
	}
	return info.Size(), nil
}

type Response struct {
	Status int    `json:"status"`
	Desc   string `json:"desc"`
}

func parseResponse(s string) (*Response, error) {
	var res Response
	err := json.Unmarshal([]byte(s), &res)
	if err != nil {
		return nil, err
	}

	return &res, nil
}

type Segment struct {
	Bg      string `json:"bg"`
	Ed      string `json:"ed"`
	Onebest string `json:"onebest"`
	Speaker string `json:"speaker"`
}

func parseSegmentResponse(s string) ([]*Segment, error) {
	var res []*Segment
	err := json.Unmarshal([]byte(s), &res)
	if err != nil {
		return nil, err
	}

	return res, nil
}

```

### Core Architecture Module: `audit/audit.go`
```
// Copyright 2025 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package audit writes a structured, append-only JSONL activity log - one
// self-contained event per line - so an external tool can tail OpenAgent's tool
// activity read-only, without reading the database. It is a pure additional
// sink: a failure here never blocks or fails the operation being audited.
//
// The log lives next to the binary (the same directory strategy the SQLite
// database uses), overridable with OPENAGENT_AUDIT_DIR. One file per session,
// so a reader can use the file name as the session key and never has to
// untangle interleaved sessions.
package audit

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const timeFormat = "2006-01-02T15:04:05.000Z07:00"

// Event is one audit line. Fields are omitted when empty so the format stays
// small and forward-compatible: a reader ignores fields it does not know.
type Event struct {
	Timestamp       string `json:"timestamp"`
	SessionID       string `json:"sessionId,omitempty"`
	Type            string `json:"type"`
	Tool            string `json:"tool,omitempty"`
	Server          string `json:"server,omitempty"`
	Model           string `json:"model,omitempty"`
	ArgumentsLength int    `json:"argumentsLength,omitempty"`
	Outcome         string `json:"outcome,omitempty"`
	DurationMs      int64  `json:"durationMs,omitempty"`
	// Effect, Reason and Rule carry the guard verdict once the guard is wired
	// into the tool path; empty until then.
	Effect string `json:"effect,omitempty"`
	Reason string `json:"reason,omitempty"`
	Rule   string `json:"rule,omitempty"`
}

// queueSize bounds how many events may be waiting to be written. It is generous
// because each event is tiny; if it is ever exceeded, events are dropped rather
// than allowed to block a tool call.
const queueSize = 4096

// queued is one unit of work for the background writer. A marker carries only
// done (line nil) and lets flush wait until everything before it is written.
type queued struct {
	line    []byte
	session string
	done    chan struct{}
}

var (
	queue     chan queued
	startOnce sync.Once
)

// Record appends one event to its session's audit file. It is best-effort and
// non-blocking: the event is handed to a background writer, so a slow or stalled
// audit directory (for example an OPENAGENT_AUDIT_DIR on a network mount) can
// never slow down or fail the tool call it is recording. If the writer cannot
// keep up, events are dropped rather than allowed to block.
func Record(event Event) {
	if event.Type == "" {
		return
	}
	event.Timestamp = time.Now().UTC().Format(timeFormat)

	line, err := json.Marshal(event)
	if err != nil {
		return
	}

	startOnce.Do(startWriter)
	select {
	case queue <- queued{line: append(line, '\n'), session: sanitizeSession(event.SessionID)}:
	default:
		// Queue full: drop rather than block. Auditing is a sidecar and must
		// never hold up the operation it records.
	}
}

func startWriter() {
	queue = make(chan queued, queueSize)
	go func() {
		for item := range queue {
			if item.line != nil {
				writeLine(item.session, item.line)
			}
			if item.done != nil {
				close(item.done)
			}
		}
	}()
}

// writeLine performs the actual disk append, off the caller's goroutine. Every
// failure is swallowed: auditing must never take down what it records.
func writeLine(session string, line []byte) {
	dir := auditDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return
	}
	file, err := os.OpenFile(filepath.Join(dir, session+".jsonl"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return
	}
	defer file.Close()
	_, _ = file.Write(line)
}

// flush blocks until every event queued before it has been written. It exists
// for tests and for a future graceful shutdown; the single background writer
// processes work in order, so the marker cannot pass earlier events.
func flush() {
	startOnce.Do(startWriter)
	done := make(chan struct{})
	queue <- queued{done: done}
	<-done
}

// auditDir is <dir-of-binary>/audit, mirroring how the SQLite database is placed
// next to the binary, unless OPENAGENT_AUDIT_DIR overrides it. The binary path
// is resolved through any symlink first: os.Executable() returns the path used
// to invoke the process, which is the symlink itself when OpenAgent is started
// through one (e.g. a package manager's ~/.local/bin/openagent link) rather
// than the real binary it points at. An external reader has no reason to know
// about that symlink - it locates the audit directory the same way aiguard's
// agentmonitor.ResolveOpenAgentAuditDir does, by resolving the binary path it
// found first - so this must resolve it too, or the two disagree on where the
// directory is and every event silently lands somewhere nobody reads.
func auditDir() string {
	if override := strings.TrimSpace(os.Getenv("OPENAGENT_AUDIT_DIR")); override != "" {
		return override
	}
	exe, err := os.Executable()
	if err != nil {
		return "audit"
	}
	return auditDirFor(exe)
}

// auditDirFor is the symlink-resolving half of auditDir, split out so a test
// can exercise it against a path it controls instead of the real executable.
func auditDirFor(exe string) string {
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	return filepath.Join(filepath.Dir(exe), "audit")
}

// sanitizeSession keeps a session id safe to use as a file name, and falls back
// to a fixed name when no session is known so events are never dropped.
func sanitizeSession(session string) string {
	session = strings.TrimSpace(session)
	cleaned := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			return r
		case r == '-', r == '_', r == '.':
			return r
		default:
			return '-'
		}
	}, session)
	cleaned = strings.Trim(cleaned, "-.")
	if cleaned == "" {
		return "openagent"
	}
	return cleaned
}

```

### Core Architecture Module: `auth/auth.go`
```
// Copyright 2026 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package auth is a thin wrapper around the identity-provider SDK.
// All calls to the upstream SDK go through this package so that
// "no provider configured" guards can be added in one place later.
package auth

import (
	"github.com/casdoor/casdoor-go-sdk/casdoorsdk"
	"golang.org/x/oauth2"
)

// Type aliases — re-export all SDK types used across the codebase so that
// other packages only need to import this package, not casdoorsdk directly.
type (
	Application  = casdoorsdk.Application
	Cert         = casdoorsdk.Cert
	Claims       = casdoorsdk.Claims
	Organization = casdoorsdk.Organization
	Permission   = casdoorsdk.Permission
	Provider     = casdoorsdk.Provider
	Resource     = casdoorsdk.Resource
	Transaction  = casdoorsdk.Transaction
	User         = casdoorsdk.User
)

// InitConfig initialises the identity-provider SDK client.
func InitConfig(endpoint, clientId, clientSecret, jwtPublicKey, organization, application string) {
	casdoorsdk.InitConfig(endpoint, clientId, clientSecret, jwtPublicKey, organization, application)
}

func GetApplication(name string) (*Application, error) {
	return casdoorsdk.GetApplication(name)
}

func GetCert(name string) (*Cert, error) {
	return casdoorsdk.GetCert(name)
}

func GetOAuthToken(code, state string) (*oauth2.Token, error) {
	return casdoorsdk.GetOAuthToken(code, state)
}

func ParseJwtToken(token string) (*Claims, error) {
	return casdoorsdk.ParseJwtToken(token)
}

func GetUser(name string) (*User, error) {
	return casdoorsdk.GetUser(name)
}

func GetUsers() ([]*User, error) {
	return casdoorsdk.GetUsers()
}

func GetOrganization(name string) (*Organization, error) {
	return casdoorsdk.GetOrganization(name)
}

func SendEmail(title, content, sender, receiver string) error {
	return casdoorsdk.SendEmail(title, content, sender, receiver)
}

func SendNotification(content string, recipient string) error {
	return casdoorsdk.SendNotification(content, recipient)
}

func GetPermissions() ([]*Permission, error) {
	return casdoorsdk.GetPermissions()
}

func GetPermission(name string) (*Permission, error) {
	return casdoorsdk.GetPermission(name)
}

func UpdatePermission(p *Permission) (bool, error) {
	return casdoorsdk.UpdatePermission(p)
}

func AddPermission(p *Permission) (bool, error) {
	return casdoorsdk.AddPermission(p)
}

func DeletePermission(p *Permission) (bool, error) {
	return casdoorsdk.DeletePermission(p)
}

func GetProviders() ([]*Provider, error) {
	return casdoorsdk.GetProviders()
}

func AddTransaction(t *Transaction) (bool, string, error) {
	return casdoorsdk.AddTransaction(t)
}

func AddTransactionWithDryRun(t *Transaction, dryRun bool) (bool, string, error) {
	return casdoorsdk.AddTransactionWithDryRun(t, dryRun)
}

func GetResources(owner, application, field, value, sortField, sortOrder string) ([]*Resource, error) {
	return casdoorsdk.GetResources(owner, application, field, value, sortField, sortOrder)
}

func UploadResource(user, tag, parent, fullFilePath string, fileBytes []byte) (string, string, error) {
	return casdoorsdk.UploadResource(user, tag, parent, fullFilePath, fileBytes)
}

func DeleteResourceWithTag(resource *Resource, tag string) (bool, error) {
	return casdoorsdk.DeleteResourceWithTag(resource, tag)
}

```

### Core Architecture Module: `authz/authz.go`
```
// Copyright 2025 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package authz

import (
	"github.com/casbin/casbin/v2"
	"github.com/casbin/casbin/v2/model"
	stringadapter "github.com/qiangmzsx/string-adapter/v2"
)

var Enforcer *casbin.Enforcer

const modelText = `
[request_definition]
r = sub, method, urlPath

[policy_definition]
p = sub, method, urlPath, eft

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow)) && !some(where (p.eft == deny))

[matchers]
m = g(r.sub, p.sub) && (r.method == p.method || p.method == "*") && (keyMatch(r.urlPath, p.urlPath) || p.urlPath == "*")
`

// policyText defines access control rules, everything not allowed is denied.
// Roles: admin, store-admin > user > anonymous. store-admin is denied the global-only endpoints.
const policyText = `
p, admin, *, *, allow

p, store-admin, *, *, allow
p, store-admin, *, /api/get-global-sites, deny
p, store-admin, *, /api/get-sites, deny
p, store-admin, *, /api/get-site, deny
p, store-admin, *, /api/update-site, deny
p, store-admin, *, /api/add-site, deny
p, store-admin, *, /api/delete-site, deny
p, store-admin, *, /api/get-sessions, deny
p, store-admin, *, /api/get-session, deny
p, store-admin, *, /api/update-session, deny
p, store-admin, *, /api/add-session, deny
p, store-admin, *, /api/delete-session, deny
p, store-admin, *, /api/get-snapshots, deny
p, store-admin, *, /api/get-snapshot, deny
p, store-admin, *, /api/rollback-snapshot, deny
p, store-admin, *, /api/get-migration-sources, deny
p, store-admin, *, /api/upload-migration-file, deny
p, store-admin, *, /api/preview-migration, deny
p, store-admin, *, /api/start-migration, deny
p, store-admin, *, /api/get-migration-progress, deny
p, store-admin, *, /api/get-migrations, deny
p, store-admin, *, /api/get-migration, deny
p, store-admin, *, /api/rollback-migration, deny
p, store-admin, *, /api/update-permission, deny
p, store-admin, *, /api/add-permission, deny
p, store-admin, *, /api/delete-permission, deny
p, store-admin, *, /api/get-records, deny
p, store-admin, *, /api/get-record, deny
p, store-admin, *, /api/update-record, deny
p, store-admin, *, /api/add-record, deny
p, store-admin, *, /api/add-records, deny
p, store-admin, *, /api/delete-record, deny
p, store-admin, *, /api/commit-record, deny
p, store-admin, *, /api/commit-record-second, deny
p, store-admin, *, /api/query-record, deny
p, store-admin, *, /api/query-record-second, deny
p, store-admin, *, /api/get-system-info, deny
p, store-admin, *, /api/get-version-info, deny
p, store-admin, *, /api/get-prometheus-info, deny
p, store-admin, *, /api/metrics, deny
p, store-admin, *, /api/get-usages, deny
p, store-admin, *, /api/get-range-usages, deny
p, store-admin, *, /api/get-users, deny
p, store-admin, *, /api/get-user-table-infos, deny
p, store-admin, *, /api/get-usage-providers, deny
p, store-admin, *, /api/get-usage-heatmap, deny
p, store-admin, *, /api/get-visitors, deny
p, store-admin, *, /api/add-resource, deny
p, store-admin, *, /api/update-resource, deny

p, user, *, /api/update-account, allow
p, user, *, /api/get-chats, allow
p, user, *, /api/get-forms, allow
p, user, *, /api/get-messages, allow
p, user, *, /api/delete-welcome-message, allow
p, user, *, /api/get-message-answer, allow
p, user, *, /api/cancel-message-answer, allow
p, user, *, /api/get-answer, allow
p, user, *, /api/get-store, allow
p, user, *, /api/get-vector, allow
p, user, *, /api/get-providers, allow
p, user, *, /api/get-provider, allow
p, user, *, /api/get-global-stores, allow
p, user, *, /api/get-store-names, allow
p, user, *, /api/get-chat, allow
p, user, *, /api/get-chat-status, allow
p, user, *, /api/get-message, allow
p, user, *, /api/get-tasks, allow
p, user, *, /api/get-task, allow
p, user, *, /api/get-public-scales, allow
p, user, *, /api/update-chat, allow
p, user, *, /api/add-chat, allow
p, user, *, /api/delete-chat, allow
p, user, *, /api/update-message, allow
p, user, *, /api/add-message, allow
p, user, *, /api/update-task, allow
p, user, *, /api/add-task, allow
p, user, *, /api/delete-task, allow
p, user, *, /api/upload-task-document, allow
p, user, *, /api/generate-text-to-speech-audio, allow
p, user, *, /api/generate-text-to-speech-audio-stream, allow
p, user, *, /api/process-speech-to-text, allow
p, user, *, /api/speech-stream, allow
p, user, *, /api/analyze-task, allow
p, user, *, /api/claim-store, allow
p, user, *, /api/get-store-insights-summary, allow
p, user, *, /api/get-store-contributors, allow
p, user, *, /api/get-store-traffic, allow
p, user, *, /api/get-store-cost-series, allow
p, user, *, /api/get-store-security, allow
p, user, *, /api/get-comments, allow
p, user, *, /api/add-comment, allow
p, user, *, /api/delete-comment, allow
p, user, *, /api/get-issues, allow
p, user, *, /api/get-issue, allow
p, user, *, /api/add-issue, allow
p, user, *, /api/update-issue, allow
p, user, *, /api/delete-issue, allow
p, user, *, /api/get-store-favorite-status, allow
p, user, *, /api/toggle-store-favorite, allow
p, user, *, /api/get-favored-stores, allow
p, user, *, /api/get-hub-stores, allow
p, user, *, /api/fork-store, allow
p, user, *, /api/get-user-info, allow

p, anonymous, *, /api/signin, allow
p, anonymous, *, /api/signout, allow
p, anonymous, *, /api/health, allow
p, anonymous, *, /api/chrome-connect, allow
p, anonymous, *, /api/get-account, allow
p, anonymous, *, /api/get-signin-options, allow
p, anonymous, *, /api/get-built-in-site, allow
p, anonymous, *, /api/is-session-duplicated, allow
p, anonymous, *, /api/chat-webhook/*, allow

g, admin, user
g, store-admin, user
g, user, anonymous
`

func InitEnforcer() {
	m, err := model.NewModelFromString(modelText)
	if err != nil {
		panic(err)
	}

	sa := stringadapter.NewAdapter(policyText)
	e, err := casbin.NewEnforcer(m, sa)
	if err != nil {
		panic(err)
	}

	Enforcer = e
}

func IsAllowed(role, method, urlPath string) bool {
	allowed, err := Enforcer.Enforce(role, method, urlPath)
	if err != nil {
		return false
	}
	return allowed
}

```

### Core Architecture Module: `bpmn/bpmn.go`
```
// Copyright 2025 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package bpmn

import (
	"encoding/xml"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/the-open-agent/openagent/i18n"
)

type Definitions struct {
	XMLName   xml.Name  `xml:"definitions"`
	Processes []Process `xml:"process"`
}

type Process struct {
	XMLName      xml.Name      `xml:"process"`
	ID           string        `xml:"id,attr"`
	Name         string        `xml:"name,attr,omitempty"`
	FlowElements []FlowElement `xml:",any"`
}

type Task struct {
	XMLName xml.Name `xml:"task"`
	ID      string   `xml:"id,attr"`
	Name    string   `xml:"name,attr"`
}

type FlowElement struct {
	XMLName   xml.Name
	ID        string `xml:"id,attr"`
	Name      string `xml:"name,attr,omitempty"`
	SourceRef string `xml:"sourceRef,attr,omitempty"`
	TargetRef string `xml:"targetRef,attr,omitempty"`
}

type SequenceFlow struct {
	XMLName             xml.Name `xml:"sequenceFlow"`
	ID                  string   `xml:"id,attr"`
	SourceRef           string   `xml:"sourceRef,attr"`
	TargetRef           string   `xml:"targetRef,attr"`
	ConditionExpression string   `xml:"conditionExpression,omitempty"`
}

type PathNode struct {
	Task           Task
	Next           []*PathNode
	Concurrent     []*PathNode
	IsMandatory    bool
	Delay          int
	ActualExecTime time.Time
}

func NewPathNode(task Task, isMandatory bool, delay int) *PathNode {
	return &PathNode{
		Task:        task,
		IsMandatory: isMandatory,
		Next:        []*PathNode{},
		Concurrent:  []*PathNode{},
		Delay:       delay,
	}
}

func (pn *PathNode) AddNext(next *PathNode) {
	pn.Next = append(pn.Next, next)
}

func (pn *PathNode) AddConcurrent(concurrent *PathNode) {
	pn.Concurrent = append(pn.Concurrent, concurrent)
}

func PathToString(node *PathNode, indent string) string {
	if node == nil {
		return ""
	}

	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("%sTask: %s (Name: %s, Delay: %d days, Executed at: %v)\n", indent, node.Task.ID, node.Task.Name, node.Delay, node.ActualExecTime))

	indent += "    "

	if len(node.Concurrent) > 0 {
		for _, concurrent := range node.Concurrent {
			sb.WriteString(fmt.Sprintf("%sConcurrent Task:\n", indent))
			sb.WriteString(PathToString(concurrent, indent+"    "))
		}
	}

	for _, next := range node.Next {
		sb.WriteString(PathToString(next, indent))
	}
	return sb.String()
}

func ParseBPMN(bpmnText string, lang string) (map[string]Task, map[string][]SequenceFlow, map[string]bool, map[string]bool, map[string]int, []string, error) {
	bytes := []byte(bpmnText)
	var definitions Definitions
	err := xml.Unmarshal(bytes, &definitions)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, fmt.Errorf(i18n.Translate(lang, "bpmn:Error parsing BPMN file: %v"), err)
	}

	tasks := map[string]Task{}
	sequenceFlows := map[string][]SequenceFlow{}
	exclusiveGateways := map[string]bool{}
	parallelGateways := map[string]bool{}
	timerEvents := map[string]int{}
	startEvents := []string{}

	for _, process := range definitions.Processes {
		for _, flowElement := range process.FlowElements {
			switch flowElement.XMLName.Local {
			case "task":
				tasks[flowElement.ID] = Task{ID: flowElement.ID, Name: flowElement.Name}
			case "startEvent", "endEvent", "intermediateCatchEvent", "intermediateThrowEvent":
				defaultName := "Event"
				if flowElement.Name != "" {
					defaultName = flowElement.Name
				}
				tasks[flowElement.ID] = Task{ID: flowElement.ID, Name: defaultName}
				if flowElement.XMLName.Local == "startEvent" {
					startEvents = append(startEvents, flowElement.ID)
				}
			case "sequenceFlow":
				sourceRef := flowElement.SourceRef
				targetRef := flowElement.TargetRef
				seqFlow := SequenceFlow{
					ID:                  flowElement.ID,
					SourceRef:           sourceRef,
					TargetRef:           targetRef,
					ConditionExpression: flowElement.Name,
				}
				sequenceFlows[sourceRef] = append(sequenceFlows[sourceRef], seqFlow)
			case "exclusiveGateway", "parallelGateway":
				tasks[flowElement.ID] = Task{ID: flowElement.ID, Name: flowElement.XMLName.Local}
				if flowElement.XMLName.Local == "exclusiveGateway" {
					exclusiveGateways[flowElement.ID] = true
				} else if flowElement.XMLName.Local == "parallelGateway" {
					parallelGateways[flowElement.ID] = true
				}
			case "timerEventDefinition":
				var days int
				fmt.Sscanf(flowElement.Name, "P%dD", &days)
				timerEvents[flowElement.ID] = days
			}
		}
	}

	return tasks, sequenceFlows, exclusiveGateways, parallelGateways, timerEvents, startEvents, nil
}

func evaluateCondition(condition string, variables map[string]float64) bool {
	condition = strings.ReplaceAll(condition, "&lt;", "<")
	condition = strings.ReplaceAll(condition, "&gt;", ">")
	condition = strings.ReplaceAll(condition, "&amp;&amp;", "&&")
	condition = strings.ReplaceAll(condition, "${", "")
	condition = strings.ReplaceAll(condition, "}", "")

	re := regexp.MustCompile(`([a-zA-Z_]+)\s*([<>=!]+)\s*([a-zA-Z0-9._]+)`)
	matches := re.FindAllStringSubmatch(condition, -1)

	for _, match := range matches {
		varName := match[1]
		operator := match[2]
		thresholdStr := match[3]

		var threshold float64
		if val, ok := variables[thresholdStr]; ok {
			threshold = val
		} else {
			parsedThreshold, err := strconv.ParseFloat(thresholdStr, 64)
			if err != nil {
				return false
			}
			threshold = parsedThreshold
		}

		actualValue, exists := variables[varName]
		if !exists {
			// fmt.Printf("Variable %s not found in provided data.\n", varName)
			return false
		}

		switch operator {
		case "<":
			if !(actualValue < threshold) {
				return false
			}
		case ">":
			if !(actualValue > threshold) {
				return false
			}
		case "==":
			if !(actualValue == threshold) {
				return false
			}
		case "<=":
			if !(actualValue <= threshold) {
				return false
			}
		case ">=":
			if !(actualValue >= threshold) {
				return false
			}
		case "!=":
			if !(actualValue != threshold) {
				return false
			}
		}
	}

	return true
}

func buildPaths(currentTask string, tasks map[string]Task, sequenceFlows map[string][]SequenceFlow, exclusiveGateways map[string]bool, parallelGateways map[string]bool, timerEvents map[string]int, variables map[string]float64) []*PathNode {
	visited := make(map[string]bool)
	return buildPathsHelper(currentTask, tasks, sequenceFlows, exclusiveGateways, parallelGateways, timerEvents, variables, visited)
}

func buildPathsHelper(currentTask string, tasks map[string]Task, sequenceFlows map[string][]SequenceFlow, exclusiveGateways map[string]bool, parallelGateways map[string]bool, timerEvents map[string]int, variables map[string]float64, visited map[string]bool) []*PathNode {
	if visited[currentTask] {
		// fmt.Printf("Task %s already visited, skipping to avoid loop\n", currentTask)
		return nil
	}

	visited[currentTask] = true
	task, exists := tasks[currentTask]
	if !exists {
		// fmt.Printf("Task %s not found in task list\n", currentTask)
		return nil
	}

	// fmt.Printf("Building paths for task: %s (Name: %s)\n", task.ID, task.Name)

	delay := timerEvents[currentTask]
	currentNode := NewPathNode(task, true, delay)

	nextFlows, hasNext := sequenceFlows[currentTask]
	if !hasNext {
		// fmt.Printf("No outgoing sequence flows for task %s\n", task.Name)
		return []*PathNode{currentNode}
	}

	var allPaths []*PathNode

	if _, isExclusiveGateway := exclusiveGateways[currentTask]; isExclusiveGateway {
		// fmt.Printf("Evaluating excl
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2468** (2026-07-25): **File preview can show stale content: a late fetch response overwrites the currently selected file's text**
  *Symptoms*: In `FileTree.js`, selecting a file sets `loading: true` and fetches the file URL, then writes the response straight into `this.state.text`. The response handler does not capture the selected path or a request token, so a slow response that resolves after the user has switched files overwrites the current preview with stale content.  Where: https://github.com/the-open-agent/openagent/blob/d5ef6f4c63efbe7358ea4d8888322351fe1d4fdc/web/src/FileTree.js#L465-L491  **Failure scenario:** select a large/slow file (e.g. a PDF), then quickly select a markdown file. The markdown renders, then the late first response lands and replaces it with the earlier file's text. Files aren't corrupted, but the preview no longer matches the selection.  **Suggested fix:** associate each fetch with its selected path or a monotonically increasing request token, and ignore a response whose path/token no longer matches the current selection.  Found while running [Ito](https://ito.ai) (AI code review, free for open source) against recently merged PRs — full analysis: https://app.ito.ai/share/3eab3424-8fee-49af-afc6-67b4fae69451. 
  **Post-Mortem & Fix Analysis**:
  > @graysoncooper fixed in: https://github.com/the-open-agent/openagent/commit/b6b282d1ece08dea4429576c0625007778234e58
  > @hsluoyz Glad this was helpful! If the team is interested for Ito as a free tool (we give it to open source for free as a way to support the community) it'd run in about <30 minutes on every PR pre merge and can be addressed prior or after. No pressure :)

- **Issue #2363** (2026-06-14): **No service/application authentication path for document ingestion — upload-file requires an interactive user that owns a default store**
  *Symptoms*: # No service/application authentication path for document ingestion — `upload-file` requires an interactive user that owns a default store  **Version:** v2.44.0 **Component:** file upload / ingestion pipeline & auth — `controllers/file.go`, `controllers/base.go`, `object/file.go`  ## Summary  There is no way for a **service / application principal** (authenticating with an app `clientId` + `clientSecret`) to ingest documents into a knowledge store. The document upload path (`/api/upload-file`) derives the target store from the **signed-in user's identity** and requires that user to own a *default* store. An application credential resolves to a principal that owns no store, so ingestion fails outright. This blocks any automated/back-end integration (e.g. a connector that syncs Confluence/GitLab content into a store).  ## Use case / motivation  We run a back-end connector that periodically syncs external content (Confluence, GitLab) into an OpenAgent knowledge store so it can be queried in chat. The connector is a service with no human session — it authenticates with the application's `clientId`/`clientSecret`. We need it to push documents through the embedding pipeline into a specific store.  ## Observed behavior  Calling `/api/upload-file` with valid application credentials fails with:  ``` No store found for user: <app-principal>, please create a store first ```  (The principal resolves to the application identity, which owns no store.)  ## Root cause  The upload handler res
  **Post-Mortem & Fix Analysis**:
  > this issue fixed also as the [above](https://github.com/the-open-agent/openagent/issues/2362) fixed. Thanks much

- **Issue #2362** (2026-06-14): **File upload always targets the user's default store, ignoring the selected store (/files)**
  *Symptoms*: # File upload always targets the user's default store, ignoring the selected store (`/files`)  **Version:** v2.44.0 **Component:** file upload pipeline — `controllers/file.go`, `object/file.go`  ## Summary  On the Files page (`/files`), uploading a document while a specific (non-default) store is selected always adds the file to the signed-in user's **default** store instead of the selected one. There is no parameter to direct an upload to a chosen store, so multi-store deployments can't ingest documents into non-default stores through the UI/API.  ## Steps to reproduce  1. As a user, have at least two stores (e.g. a default store + a second store `store_tm`). 2. Go to `/files` and select the non-default store `store_tm`. 3. Upload a file. 4. **Observed:** the file is created under the *default* store, not `store_tm`.  Related symptom: if the authenticated principal owns **no** store, the upload fails outright with:  ``` No store found for user: <user>, please create a store first ```  because the handler can only ever resolve a *default* store, never a selected one. (This blocks API/service principals from uploading at all.)  ## Root cause  `UploadFile` in `controllers/file.go` reads only `filename` and the multipart `file` — it never reads a `store`/`storeId` parameter — and passes the username as the owner:  ```go func (c *ApiController) UploadFile() { 	userName, ok := c.RequireSignedIn() 	if !ok { 		return 	}  	filename := c.Input().Get("filename")  	fileData, header, err
  **Post-Mortem & Fix Analysis**:
  > Related: #2363 — *No service/application authentication path for document ingestion*. That issue covers the broader auth dimension: even with store selection fixed here, a back-end service authenticating with an application `clientId`/`clientSecret` resolves to a principal that owns no default store, so `upload-file` fails outright (`No store found for user: …`). The two together block automated ingestion into a chosen store.
  > @levanvunam can you check if this commit: https://github.com/the-open-agent/openagent/commit/71edec068a52bb1b8576e6ea6a21c10dd41d560d has fixed your issue?
  > yes this fix my issue. Thank you for helping (**awesome**)

- **Issue #2361** (2026-06-14): **Local embedding provider: calculatePrice() fatally rejects non-OpenAI model names**
  *Symptoms*: ### Problem    The `Local` embedding provider correctly calls OpenAI-compatible endpoints (custom `providerUrl` + `clientSecret` + `subType` as model), and the embedding request **succeeds** — but the   result is then discarded by `calculatePrice()`, which returns a fatal error for any model name that isn't `text-embedding-3-*`/`ada-002`. This makes `Local` unusable with gateways like   LiteLLM / vLLM / LocalAI that serve differently-named models.    ### Environment    Casibase / OpenAgent `2.42.1` (also on `master`). Provider: `type=Local`, `subType=gemini-embedding-001`, OpenAI-compatible `/v1` endpoint.    ### Reproduce    Add a `Local` embedding provider with any model name not containing `text-embedding-3-*` / `ada-002`, point a store at it, and generate vectors:    ```   Vectors failed to generate: queryVectorSafe() error, provider: litellm-embedding,   calculatePrice() error: unknown model type: gemini-embedding-001   ```    (No HTTP error → the embedding call itself succeeded; only pricing failed.)    ### Root cause — `embedding/local.go`    `QueryVector()` treats a pricing error as fatal, *after* embeddings have already returned:    ```go   if p.typ != "Custom" {       err = p.calculatePrice(embeddingResult, lang)       if err != nil { return nil, nil, err }   // discards a valid result   }   ```    `calculatePrice()` hard-errors on unknown models, even though the provider already carries `pricePerThousandTokens` / `currency` (used by the `custom-embedding` / `Ollama
  **Post-Mortem & Fix Analysis**:
  > @levanvunam thanks for reporting! Can you try if this commit: https://github.com/the-open-agent/openagent/commit/96841389f18b21b5059f43bc3295cbd52b998d6d fix your issue?
  > The fix works, thank you

- **Issue #2344** (2026-06-22): **input exceeds the context window of this model.**
  *Symptoms*: Hi,  Im sorry, I would like to know if someone can help me to fix this issue:  Using Openai - text-embedding-3-small  Thank you very much  <img width="1223" height="900" alt="Image" src="https://github.com/user-attachments/assets/7830b520-43ca-45ea-b790-dd1fb74f3c31" />  User message: `que es una vigilancia de acuerdo al documento`  AI response: `received error while streaming: ("type": "invalid request_error","code":"context_length_exceeded", "message" : "Your input exceeds the context window of this model. Please adjust your input and try again.","param": "input") Regenerate `
  **Post-Mortem & Fix Analysis**:
  > @geovannyco fixed, can you try new version? https://github.com/the-open-agent/openagent/releases/tag/v2.36.0

- **Issue #2340** (2026-06-04): **[bug] Ollama local model integration is unusable — `ListModels` skips the `p.typ == "Ollama"` branch**
  *Symptoms*: ## Description The Ollama local model integration is almost unusable in the current version. I tested it several times and it failed every time.  ## Investigation On a quick look, when querying the model list, the `if p.typ == "Ollama"` branch in the `ListModels` method (in `local.go`) is never entered. I didn't dig further into the root cause.  ## Environment - Version: current/latest  ## Expected Ollama models should be listed and usable after configuration.  ## Actual The model list query never reaches the Ollama branch, so no models are available.
  **Post-Mortem & Fix Analysis**:
  > fixed in: https://github.com/the-open-agent/openagent/commit/b465c15825d29a27c07fb8357f6a5276bba6f64c

- **Issue #2303** (2026-05-31): **Version info endpoint fails on Windows: module path used as filesystem path**
  *Symptoms*:  Description    The /api/get-version-info endpoint returns an error on Windows. The code appears to construct a local file path by   appending version_info.txt to the Go module path (github.com/the-open-agent/openagent), which is not a valid   filesystem path.    Error    API error: method=GET path=/api/get-version-info   response={"status":"error","msg":"Git error: repository does not exist, File error: open   github.com\\the-open-agent\\openagent\\version_info.txt: The system cannot find the path specified."}    Source: base.go:207    Root Cause    The path github.com\the-open-agent\openagent\version_info.txt looks like the Go module import path was used as a   filesystem path. This works in development (when the source is in $GOPATH/src/github.com/the-open-agent/openagent/)   but fails in a release binary where the source tree does not exist locally.    The file should either be embedded at build time (e.g. via //go:embed version_info.txt) or the version info should be   injected via -ldflags during go build.    Secondary Issue    The log output contains raw ANSI escape codes ([1;31m, [0m) that are not stripped on Windows, where the console does   not interpret them by default. This makes logs harder to read and also affects any log parsing.    Environment    - OS: Windows 10   - OpenAgent version: 2.18.2 (latest release)     <img width="665" height="217" alt="Image" src="https://github.com/user-attachments/assets/67ef2135-ea17-44f1-a4ef-dde43df5333d" />
  **Post-Mortem & Fix Analysis**:
  > :tada: This issue has been resolved in version 2.29.0 :tada:  The release is available on [GitHub release](https://github.com/the-open-agent/openagent/releases/tag/v2.29.0)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #2282** (2026-05-30): **Terminal get into infinite loop**
  *Symptoms*: When accessing http://localhost:14000/, the terminal get into infinite loop. And the web page shows nothing.  <img width="1107" height="627" alt="Image" src="https://github.com/user-attachments/assets/84833cec-d9d2-40a1-ae0a-8d1cd10683ae" /> please check out the log file:  [openagent.log](https://github.com/user-attachments/files/28094582/openagent.log)
  **Post-Mortem & Fix Analysis**:
  > @Ethan-Fung hi, please use the currently latest version: [v2.11.1](https://github.com/the-open-agent/openagent/releases/tag/v2.11.1)

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

### Incident Patch 1: `fb2f8a6b` (2026-09-29)
**Commit Message**: fix: skip loading forms for anonymous visitors

**File**: `web/src/App.js` (modified, +1/-1)
```diff
@@ -66,7 +66,6 @@ class App extends Component {
     this.updateMenuKey();
     this.getAccount();
     this.setTheme();
-    this.getForms();
   }
 
   setTheme() {
@@ -181,6 +180,7 @@ class App extends Component {
         if (account !== null) {
           this.setLanguage(account);
           this.setState({account: account});
+          this.getForms();
           return;
         }
 
```

---

### Incident Patch 2: `16256942` (2026-09-28)
**Commit Message**: fix: price legacy deepseek-v4-flash model names

**File**: `model/deepseek.go` (modified, +6/-0)
```diff
@@ -49,6 +49,9 @@ billed at twice these rates, and cache hits are billed far lower.
 |-----------------|-----------------|---------------------------|----------------------------|
 | DeepSeek-V4-Pro | deepseek-v4-pro | $0.00066                  | $0.00198                   |
 | DeepSeek-Flash  | deepseek-flash  | $0.00015                  | $0.0006                    |
+
+The legacy names deepseek-v4-flash and deepseek-v4-flash-vision-exp are still accepted;
+their requests are served by DeepSeek-V4.1-Flash and billed at the Flash price.
 `
 }
 
@@ -57,6 +60,9 @@ func (p *DeepSeekProvider) calculatePrice(modelResult *ModelResult, lang string)
 	priceTable := map[string][2]float64{
 		"deepseek-v4-pro": {0.00066, 0.00198},
 		"deepseek-flash":  {0.00015, 0.0006},
+		// Legacy names still accepted by the API, served and billed as deepseek-flash
+		"deepseek-v4-flash":            {0.00015, 0.0006},
+		"deepseek-v4-flash-vision-exp": {0.00015, 0.0006},
 	}
 
 	if priceItem, ok := priceTable[p.subType]; ok {
```

---

### Incident Patch 3: `1da53c58` (2026-09-27)
**Commit Message**: fix: sign storage URLs, mask API keys and audit high-risk tool runs

**File**: `controllers/account.go` (modified, +8/-2)
```diff
@@ -127,7 +127,10 @@ func (c *ApiController) Signin() {
 	}
 
 	claims.AccessToken = token.AccessToken
-	c.SetSessionClaims(claims)
+	if err = c.startUserSession(claims); err != nil {
+		c.ResponseError(err.Error())
+		return
+	}
 	userId := claims.User.Owner + "/" + claims.User.Name
 	c.Ctx.Input.SetParam("recordUserId", userId)
 
@@ -330,7 +333,10 @@ func (c *ApiController) autoLoginAdmin() bool {
 		return false
 	}
 
-	c.SetSessionClaims(claims)
+	if err = c.startUserSession(claims); err != nil {
+		c.ResponseError(err.Error())
+		return false
+	}
 	userId := util.GetIdFromOwnerAndName(claims.User.Owner, claims.User.Name)
 
 	sessionId := c.Ctx.Input.CruSession.SessionID()
```

**File**: `controllers/base.go` (modified, +10/-0)
```diff
@@ -62,6 +62,16 @@ func (c *ApiController) SetSessionClaims(claims *auth.Claims) {
 	c.SetSession("user", *claims)
 }
 
+// startUserSession gives the signed-in user a fresh session ID and binds the session to the browser.
+func (c *ApiController) startUserSession(claims *auth.Claims) error {
+	if err := c.SessionRegenerateID(); err != nil {
+		return err
+	}
+	c.SetSessionClaims(claims)
+	c.SetSession("userAgent", c.Ctx.Request.UserAgent())
+	return nil
+}
+
 func (c *ApiController) GetSessionUser() *auth.User {
 	claims := c.GetSessionClaims()
 	if claims == nil {
```

**File**: `controllers/chat.go` (modified, +2/-2)
```diff
@@ -165,9 +165,9 @@ func (c *ApiController) GetChats() {
 	var chats []*object.Chat
 	var err error
 	if field == "user" {
-		chats, err = object.GetChats("admin", storeName, value)
+		chats, err = object.GetLatestChats("admin", storeName, value, maxListSize)
 	} else {
-		chats, err = object.GetChats("admin", storeName, user)
+		chats, err = object.GetLatestChats("admin", storeName, user, maxListSize)
 	}
 	if err != nil {
 		c.ResponseError(err.Error())
```

**File**: `controllers/message.go` (modified, +1/-1)
```diff
@@ -217,7 +217,7 @@ func (c *ApiController) GetMessages() {
 	}
 
 	if chat == "" {
-		messages, err := object.GetMessages("admin", user, "")
+		messages, err := object.GetLatestMessages("admin", user, maxListSize)
 		if err != nil {
 			c.ResponseError(err.Error())
 			return
```

**File**: `controllers/resource.go` (modified, +17/-0)
```diff
@@ -23,12 +23,15 @@ import (
 	"strings"
 
 	"github.com/beego/beego/utils/pagination"
+	"github.com/the-open-agent/openagent/conf"
 	"github.com/the-open-agent/openagent/object"
 	"github.com/the-open-agent/openagent/util"
 )
 
 const maxResourceUploadSize = 10 << 20
 
+const defaultResourceQuotaMb = 200
+
 var resourceCategories = map[string]bool{
 	"avatar":   true,
 	"chat":     true,
@@ -310,6 +313,20 @@ func (c *ApiController) UploadResource() {
 	}
 	fileSize := len(fileBytes)
 
+	quotaMb := conf.GetConfigInt("resourceQuotaMb")
+	if quotaMb <= 0 {
+		quotaMb = defaultResourceQuotaMb
+	}
+	usedSize, err := object.GetUserResourceSize(userName)
+	if err != nil {
+		c.ResponseError(err.Error())
+		return
+	}
+	if usedSize+int64(fileSize) > int64(quotaMb)<<20 {
+		c.ResponseError(fmt.Sprintf(c.T("resource:Your uploaded files exceed the quota of %d MB, please delete some files first"), quotaMb))
+		return
+	}
+
 	ext := strings.ToLower(filepath.Ext(fileName))
 	mimeType, ok := getResourceImageMimeType(ext, fileBytes)
 	if !ok {
```

---

### Incident Patch 4: `94571aac` (2026-09-27)
**Commit Message**: fix: close pentest findings on authz, secret leaks and uploads

**File**: `authz/authz.go` (modified, +121/-79)
```diff
@@ -27,98 +27,140 @@ const modelText = `
 r = sub, method, urlPath
 
 [policy_definition]
-p = sub, method, urlPath
+p = sub, method, urlPath, eft
 
 [role_definition]
 g = _, _
 
 [policy_effect]
-e = some(where (p.eft == allow))
+e = some(where (p.eft == allow)) && !some(where (p.eft == deny))
 
 [matchers]
 m = g(r.sub, p.sub) && (r.method == p.method || p.method == "*") && (keyMatch(r.urlPath, p.urlPath) || p.urlPath == "*")
 `
 
-// policyText defines access control rules.
-// Roles: admin > user > anonymous (via role hierarchy at the bottom).
-// anonymous: paths accessible without login (original exempted list + public endpoints).
-// user: paths that require a valid session but not admin privilege.
-// admin: full access.
+// policyText defines access control rules, everything not allowed is denied.
+// Roles: admin, store-admin > user > anonymous. store-admin is denied the global-only endpoints.
 const policyText = `
-p, admin, *, *
-
-p, anonymous, *, /api/signin
-p, anonymous, *, /api/signout
-p, anonymous, *, /api/health
-p, anonymous, *, /api/get-version-info
-p, anonymous, *, /api/chrome-connect
-p, anonymous, *, /api/get-account
-p, anonymous, *, /api/update-account
-p, anonymous, *, /api/get-signin-options
-p, anonymous, *, /api/get-chats
-p, anonymous, *, /api/get-forms
-p, anonymous, *, /api/get-global-videos
-p, anonymous, *, /api/get-videos
-p, anonymous, *, /api/get-video
-p, anonymous, *, /api/get-messages
-p, anonymous, *, /api/delete-welcome-message
-p, anonymous, *, /api/get-message-answer
-p, anonymous, *, /api/cancel-message-answer
-p, anonymous, *, /api/get-answer
-p, anonymous, *, /api/get-store
-p, anonymous, *, /api/get-vector
-p, anonymous, *, /api/get-providers
-p, anonymous, *, /api/get-provider
-p, anonymous, *, /api/get-built-in-site
-p, anonymous, *, /api/get-global-stores
-p, anonymous, *, /api/get-store-names
-p, anonymous, *, /api/get-chat
-p, anonymous, *, /api/get-chat-status
-p, anonymous, *, /api/get-message
-p, anonymous, *, /api/get-tasks
-p, anonymous, *, /api/get-task
-p, anonymous, *, /api/get-public-scales
-p, anonymous, *, /api/update-chat
-p, anonymous, *, /api/add-chat
-p, anonymous, *, /api/delete-chat
-p, anonymous, *, /api/update-message
-p, anonymous, *, /api/add-message
-p, anonymous, *, /api/update-task
-p, anonymous, *, /api/add-task
-p, anonymous, *, /api/delete-task
-p, anonymous, *, /api/upload-task-document
-p, anonymous, *, /api/start-connection
-p, anonymous, *, /api/stop-connection
-p, anonymous, *, /api/generate-text-to-speech-audio
-p, anonymous, *, /api/generate-text-to-speech-audio-stream
-p, anonymous, *, /api/process-speech-to-text
-p, anonymous, *, /api/speech-stream
-p, anonymous, *, /api/analyze-task
-p, anonymous, *, /api/claim-store
-p, anonymous, *, /api/is-session-duplicated
-p, anonymous, *, /api/add-node-tunnel
-p, anonymous, *, /api/chat-webhook/*
-p, anonymous, *, /api/get-store-insights-summary
-p, anonymous, *, /api/get-store-contributors
-p, anonymous, *, /api/get-store-traffic
-p, anonymous, *, /api/get-store-cost-series
-p, anonymous, *, /api/get-store-security
-p, anonymous, *, /api/get-comments
-p, anonymous, *, /api/add-comment
-p, anonymous, *, /api/delete-comment
-p, anonymous, *, /api/get-issues
-p, anonymous, *, /api/get-issue
-p, anonymous, *, /api/add-issue
-p, anonymous, *, /api/update-issue
-p, anonymous, *, /api/delete-issue
-p, anonymous, *, /api/get-store-favorite-status
-p, anonymous, *, /api/toggle-store-favorite
-p, anonymous, *, /api/get-favored-stores
-p, anonymous, *, /api/get-hub-stores
-p, anonymous, *, /api/fork-store
-p, anonymous, *, /api/get-user-info
+p, admin, *, *, allow
+
+p, store-admin, *, *, allow
+p, store-admin, *, /api/get-global-sites, deny
+p, store-admin, *, /api/get-sites, deny
+p, store-admin, *, /api/get-site, deny
+p, store-admin, *, /api/update-site, deny
+p, store-admin, *, /api/add-site, deny
+p, store-admin, *, /api/delete-site, deny
+p, store-admin, *, /api/get-sessions, deny
+p, store-admin,
```

**File**: `controllers/account.go` (modified, +36/-3)
```diff
@@ -143,7 +143,7 @@ func (c *ApiController) Signin() {
 		object.AddSession(session)
 	}
 
-	c.ResponseOk(claims)
+	c.ResponseOk(getSanitizedClaims(claims))
 }
 
 // Signout
@@ -402,9 +402,42 @@ func (c *ApiController) GetAccount() {
 		return
 	}
 
+	res := getSanitizedClaims(claims)
 	if !isSafePassword {
-		claims.User.Password = "#NeedToModify#"
+		res.User.Password = "#NeedToModify#"
 	}
 
-	c.ResponseOk(claims)
+	c.ResponseOk(res)
+}
+
+func getSanitizedClaims(claims *auth.Claims) *auth.Claims {
+	if claims == nil {
+		return nil
+	}
+
+	res := *claims
+	res.AccessToken = ""
+	res.User = getSanitizedUser(claims.User)
+	return &res
+}
+
+func getSanitizedUser(user auth.User) auth.User {
+	if user.Password != "#NeedToModify#" {
+		user.Password = ""
+	}
+	user.PasswordSalt = ""
+	user.PasswordType = ""
+	user.Hash = ""
+	user.PreHash = ""
+	user.AccessKey = ""
+	user.AccessSecret = ""
+	user.AccessToken = ""
+	user.OriginalToken = ""
+	user.OriginalRefreshToken = ""
+	user.TotpSecret = ""
+	user.RecoveryCodes = nil
+	user.MfaAccounts = nil
+	user.Phone = util.MaskPhone(user.Phone)
+	user.IdCard = util.MaskIdCard(user.IdCard)
+	return user
 }
```

**File**: `controllers/record.go` (modified, +24/-0)
```diff
@@ -32,6 +32,10 @@ import (
 // @Success 200 {object} object.Record The Response object
 // @router /get-records [get]
 func (c *ApiController) GetRecords() {
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	owner := c.Input().Get("owner")
 	limit := c.Input().Get("pageSize")
 	page := c.Input().Get("p")
@@ -82,6 +86,10 @@ func (c *ApiController) GetRecords() {
 // @Success 200 {object} object.Record The Response object
 // @router /get-record [get]
 func (c *ApiController) GetRecord() {
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	id := c.Input().Get("id")
 
 	record, err := object.GetRecord(id, c.GetAcceptLanguage())
@@ -103,6 +111,10 @@ func (c *ApiController) GetRecord() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /update-record [post]
 func (c *ApiController) UpdateRecord() {
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	id := c.Input().Get("id")
 
 	var record object.Record
@@ -124,6 +136,10 @@ func (c *ApiController) UpdateRecord() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /add-record [post]
 func (c *ApiController) AddRecord() {
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	var record object.Record
 	err := json.Unmarshal(c.Ctx.Input.RequestBody, &record)
 	if err != nil {
@@ -154,6 +170,10 @@ func (c *ApiController) AddRecord() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /add-records [post]
 func (c *ApiController) AddRecords() {
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	// Determine synchronous processing
 	var syncEnabled bool
 	syncParam := strings.ToLower(c.Input().Get("sync"))
@@ -201,6 +221,10 @@ func (c *ApiController) AddRecords() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /delete-record [post]
 func (c *ApiController) DeleteRecord() {
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	var record object.Record
 	err := json.Unmarshal(c.Ctx.Input.RequestBody, &record)
 	if err != nil {
```

**File**: `controllers/record_chain.go` (modified, +16/-0)
```diff
@@ -28,6 +28,10 @@ import (
 // @Success 200 {object} controllers.Response The Response object
 // @router /commit-record [post]
 func (c *ApiController) CommitRecord() {
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	var record object.Record
 	err := json.Unmarshal(c.Ctx.Input.RequestBody, &record)
 	if err != nil {
@@ -47,6 +51,10 @@ func (c *ApiController) CommitRecord() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /commit-record-second [post]
 func (c *ApiController) CommitRecordSecond() {
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	var record object.Record
 	err := json.Unmarshal(c.Ctx.Input.RequestBody, &record)
 	if err != nil {
@@ -66,6 +74,10 @@ func (c *ApiController) CommitRecordSecond() {
 // @Success 200 {object} object.Record The Response object
 // @router /query-record [get]
 func (c *ApiController) QueryRecord() {
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	id := c.Input().Get("id")
 
 	res, err := object.QueryRecord(id, c.GetAcceptLanguage())
@@ -85,6 +97,10 @@ func (c *ApiController) QueryRecord() {
 // @Success 200 {object} object.Record The Response object
 // @router /query-record-second [get]
 func (c *ApiController) QueryRecordSecond() {
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	id := c.Input().Get("id")
 
 	res, err := object.QueryRecordSecond(id, c.GetAcceptLanguage())
```

**File**: `controllers/resource.go` (modified, +67/-23)
```diff
@@ -17,7 +17,8 @@ package controllers
 import (
 	"encoding/json"
 	"fmt"
-	"mime"
+	"io"
+	"net/http"
 	"path/filepath"
 	"strings"
 
@@ -26,6 +27,38 @@ import (
 	"github.com/the-open-agent/openagent/util"
 )
 
+const maxResourceUploadSize = 10 << 20
+
+var resourceCategories = map[string]bool{
+	"avatar":   true,
+	"chat":     true,
+	"document": true,
+}
+
+var resourceImageMimeTypes = map[string][]string{
+	".png":  {"image/png"},
+	".jpg":  {"image/jpeg"},
+	".jpeg": {"image/jpeg"},
+	".gif":  {"image/gif"},
+	".webp": {"image/webp"},
+	".bmp":  {"image/bmp"},
+	".ico":  {"image/x-icon", "image/vnd.microsoft.icon"},
+}
+
+func getResourceImageMimeType(ext string, fileBytes []byte) (string, bool) {
+	allowed, ok := resourceImageMimeTypes[ext]
+	if !ok {
+		return "", false
+	}
+	detected := http.DetectContentType(fileBytes)
+	for _, mimeType := range allowed {
+		if detected == mimeType {
+			return mimeType, true
+		}
+	}
+	return "", false
+}
+
 // GetGlobalResources
 // @Title GetGlobalResources
 // @Tag Resource API
@@ -47,7 +80,7 @@ func (c *ApiController) GetGlobalResources() {
 	}
 
 	filterUser := ""
-	if !c.IsAdmin() {
+	if !c.IsGlobalAdmin() {
 		filterUser = userName
 	}
 
@@ -104,7 +137,7 @@ func (c *ApiController) GetResource() {
 		return
 	}
 
-	if resource != nil && !c.IsAdmin() && resource.User != userName {
+	if resource != nil && !c.IsGlobalAdmin() && resource.User != userName {
 		c.ResponseError(c.T("auth:Unauthorized operation"))
 		return
 	}
@@ -121,6 +154,10 @@ func (c *ApiController) GetResource() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /update-resource [post]
 func (c *ApiController) UpdateResource() {
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	id := c.Input().Get("id")
 
 	var resource object.Resource
@@ -147,6 +184,10 @@ func (c *ApiController) UpdateResource() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /add-resource [post]
 func (c *ApiController) AddResource() {
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	var resource object.Resource
 	err := json.NewDecoder(c.Ctx.Request.Body).Decode(&resource)
 	if err != nil {
@@ -194,11 +235,11 @@ func (c *ApiController) DeleteResource() {
 		return
 	}
 	if resource == nil {
-		c.ResponseOk(false)
+		c.ResponseError(fmt.Sprintf(c.T("resource:The resource: %s is not found"), util.GetIdFromOwnerAndName(form.Owner, form.Name)))
 		return
 	}
 
-	if !c.IsAdmin() && resource.User != userName {
+	if !c.IsGlobalAdmin() && resource.User != userName {
 		c.ResponseError(c.T("auth:Unauthorized operation"))
 		return
 	}
@@ -240,6 +281,10 @@ func (c *ApiController) UploadResource() {
 	if category == "" {
 		category = "avatar"
 	}
+	if !resourceCategories[category] {
+		c.ResponseError(fmt.Sprintf(c.T("resource:Unsupported resource category: %s"), category))
+		return
+	}
 
 	file, header, err := c.GetFile("file")
 	if err != nil {
@@ -248,34 +293,33 @@ func (c *ApiController) UploadResource() {
 	}
 	defer file.Close()
 
-	fileName := header.Filename
-	fileSize := int(header.Size)
+	fileName := filepath.Base(header.Filename)
+	if header.Size > maxResourceUploadSize {
+		c.ResponseError(fmt.Sprintf(c.T("resource:The file is too large, the maximum size is %d MB"), maxResourceUploadSize>>20))
+		return
+	}
 
-	fileBytes := make([]byte, fileSize)
-	_, err = file.Read(fileBytes)
+	fileBytes, err := io.ReadAll(io.LimitReader(file, maxResourceUploadSize+1))
 	if err != nil {
 		c.ResponseError(err.Error())
 		return
 	}
+	if len(fileBytes) > maxResourceUploadSize {
+		c.ResponseError(fmt.Sprintf(c.T("resource:The file is too large, the maximum size is %d MB"), maxResourceUploadSize>>20))
+		return
+	}
+	fileSize := len(fileBytes)
 
-	// Detect MIME type and file type category
 	ext := strings.ToLower(filepath.Ext(fileName))
-
-	if err = validateFileExtension(fileName, c.GetAcceptLanguage()); err != nil {
-		c.ResponseError(err.Error())
+	mimeType, ok := getResourceImageMimeType(ex
```

---

### Incident Patch 5: `f28b0354` (2026-09-27)
**Commit Message**: fix: harden access checks and input handling across handlers

**File**: `authz/authz.go` (modified, +0/-1)
```diff
@@ -65,7 +65,6 @@ p, anonymous, *, /api/delete-welcome-message
 p, anonymous, *, /api/get-message-answer
 p, anonymous, *, /api/cancel-message-answer
 p, anonymous, *, /api/get-answer
-p, anonymous, *, /api/get-storage-providers
 p, anonymous, *, /api/get-store
 p, anonymous, *, /api/get-vector
 p, anonymous, *, /api/get-providers
```

**File**: `conf/conf.go` (modified, +11/-5)
```diff
@@ -180,6 +180,16 @@ func IsDemoMode() bool {
 	return strings.ToLower(GetConfigString("isDemoMode")) == "true"
 }
 
+// GetIssuer returns the configured Casdoor endpoint. "issuer" is preferred and "casdoorEndpoint"
+// is read for backward compatibility, so every check for "is Casdoor configured" must use this.
+func GetIssuer() string {
+	issuer := GetConfigString("issuer")
+	if issuer == "" {
+		issuer = GetConfigString("casdoorEndpoint")
+	}
+	return issuer
+}
+
 func GetConfigBatchSize() int {
 	res, err := strconv.Atoi(GetConfigString("batchSize"))
 	if err != nil {
@@ -205,11 +215,7 @@ func GetStringArray(key string) []string {
 func GetWebConfig() *WebConfig {
 	config := &WebConfig{}
 
-	issuer := GetConfigString("issuer")
-	if issuer == "" {
-		issuer = GetConfigString("casdoorEndpoint") // backward compat
-	}
-	config.AuthConfig.Issuer = issuer
+	config.AuthConfig.Issuer = GetIssuer()
 	config.AuthConfig.ClientId = GetConfigString("clientId")
 	config.AuthConfig.AppName = GetConfigString("casdoorApplication")           // casdoor backward compat
 	config.AuthConfig.OrganizationName = GetConfigString("casdoorOrganization") // casdoor backward compat
```

**File**: `controllers/account.go` (modified, +2/-8)
```diff
@@ -32,10 +32,7 @@ func init() {
 }
 
 func tryInitAuthConfig() error {
-	issuer := conf.GetConfigString("issuer")
-	if issuer == "" {
-		issuer = conf.GetConfigString("casdoorEndpoint") // backward compat
-	}
+	issuer := conf.GetIssuer()
 	clientId := conf.GetConfigString("clientId")
 	clientSecret := conf.GetConfigString("clientSecret")
 	casdoorOrganization := conf.GetConfigString("casdoorOrganization") // casdoor backward compat
@@ -65,10 +62,7 @@ func tryInitAuthConfig() error {
 }
 
 func InitAuthConfig() {
-	issuer := conf.GetConfigString("issuer")
-	if issuer == "" {
-		issuer = conf.GetConfigString("casdoorEndpoint") // backward compat
-	}
+	issuer := conf.GetIssuer()
 	if issuer == "" {
 		conf.SetCasdoorAvailable(false)
 		return
```

**File**: `controllers/base.go` (modified, +4/-0)
```diff
@@ -173,6 +173,10 @@ func (c *ApiController) canAccessUserData(user string, store string) bool {
 		return true
 	}
 	username := c.GetSessionUsername()
+	// Without a session the username is empty, which must not match data whose user is empty.
+	if username == "" {
+		return false
+	}
 	if username == user {
 		return true
 	}
```

**File**: `controllers/chat.go` (modified, +12/-0)
```diff
@@ -45,6 +45,11 @@ func (c *ApiController) GetGlobalChats() {
 			c.ResponseError(err.Error())
 			return
 		}
+		chats, err = c.filterStoreAdminChats(chats)
+		if err != nil {
+			c.ResponseError(err.Error())
+			return
+		}
 
 		c.ResponseOk(chats)
 	} else {
@@ -282,6 +287,12 @@ func (c *ApiController) UpdateChat() {
 	if !c.IsAdmin() {
 		// Binding a chat to a tool grants the agent that tool's capabilities, so only admins may change it.
 		chat.Tool = originalChat.Tool
+		// A user must not hand the chat to someone else (or to nobody) or rename its key.
+		chat.Owner = originalChat.Owner
+		chat.Name = originalChat.Name
+		chat.User = originalChat.User
+		chat.Organization = originalChat.Organization
+		chat.CreatedTime = originalChat.CreatedTime
 	}
 
 	if conf.IsDemoMode() {
@@ -320,6 +331,7 @@ func (c *ApiController) AddChat() {
 	if !c.IsAdmin() {
 		// Binding a chat to a tool grants the agent that tool's capabilities, so only admins may set it.
 		chat.Tool = ""
+		chat.Owner = "admin"
 	}
 
 	currentTime := util.GetCurrentTime()
```

---

### Incident Patch 6: `2abfe36f` (2026-09-27)
**Commit Message**: fix: restrict store admins from sessions, secrets and host storage

**File**: `controllers/base.go` (modified, +78/-2)
```diff
@@ -24,6 +24,7 @@ import (
 	"github.com/beego/beego/logs"
 	"github.com/the-open-agent/openagent/auth"
 	"github.com/the-open-agent/openagent/object"
+	"github.com/the-open-agent/openagent/util"
 )
 
 type ApiController struct {
@@ -164,6 +165,81 @@ func getStoreNamesForUser(username string) ([]string, error) {
 // narrowStoreAdminStoreNames applies optional ?store= filter for store-level admins.
 // If requestedStore is empty, returns allowed unchanged. If non-empty, returns that store
 // only when it exists in allowed; otherwise ok is false.
+// canAccessUserData reports whether the session user may access data that user created in store.
+// Regular users only reach their own data and the global admin reaches everything, while a store
+// admin reaches their own data plus the data in the stores they own.
+func (c *ApiController) canAccessUserData(user string, store string) bool {
+	if c.IsGlobalAdmin() {
+		return true
+	}
+	username := c.GetSessionUsername()
+	if username == user {
+		return true
+	}
+	if !c.IsStoreAdmin() || store == "" {
+		return false
+	}
+
+	storeNames, err := getStoreNamesForUser(username)
+	if err != nil {
+		return false
+	}
+	for _, name := range storeNames {
+		if name == store {
+			return true
+		}
+	}
+	return false
+}
+
+func (c *ApiController) requireUserDataAccess(user string, store string) bool {
+	if !c.canAccessUserData(user, store) {
+		c.ResponseError(c.T("auth:Unauthorized operation"))
+		return false
+	}
+	return true
+}
+
+// filterStoreAdminChats limits a store admin to their own chats and the chats in stores they own.
+func (c *ApiController) filterStoreAdminChats(chats []*object.Chat) ([]*object.Chat, error) {
+	if c.IsGlobalAdmin() || !c.IsStoreAdmin() {
+		return chats, nil
+	}
+
+	username := c.GetSessionUsername()
+	storeNames, err := getStoreNamesForUser(username)
+	if err != nil {
+		return nil, err
+	}
+	res := []*object.Chat{}
+	for _, chat := range chats {
+		if chat.User == username || util.InSlice(storeNames, chat.Store) {
+			res = append(res, chat)
+		}
+	}
+	return res, nil
+}
+
+// filterStoreAdminMessages limits a store admin to their own messages and the messages in stores they own.
+func (c *ApiController) filterStoreAdminMessages(messages []*object.Message) ([]*object.Message, error) {
+	if c.IsGlobalAdmin() || !c.IsStoreAdmin() {
+		return messages, nil
+	}
+
+	username := c.GetSessionUsername()
+	storeNames, err := getStoreNamesForUser(username)
+	if err != nil {
+		return nil, err
+	}
+	res := []*object.Message{}
+	for _, message := range messages {
+		if message.User == username || util.InSlice(storeNames, message.Store) {
+			res = append(res, message)
+		}
+	}
+	return res, nil
+}
+
 func narrowStoreAdminStoreNames(allowed []string, requestedStore string) ([]string, bool) {
 	if requestedStore == "" {
 		return allowed, true
@@ -226,9 +302,9 @@ func (c *ApiController) errorLogFilter() {
 			path := c.Ctx.Input.URL()
 			query := ""
 			if c.Ctx.Request != nil && c.Ctx.Request.URL != nil {
-				query = c.Ctx.Request.URL.RawQuery
+				query = util.RedactSensitiveUrl("?" + c.Ctx.Request.URL.RawQuery)[1:]
 			}
-			body := string(c.Ctx.Input.RequestBody)
+			body := util.RedactSensitiveJson(string(c.Ctx.Input.RequestBody))
 			if len(body) > 4096 {
 				body = body[:4096] + "...(truncated)"
 			}
```

**File**: `controllers/chat.go` (modified, +17/-23)
```diff
@@ -169,6 +169,12 @@ func (c *ApiController) GetChats() {
 		return
 	}
 
+	chats, err = c.filterStoreAdminChats(chats)
+	if err != nil {
+		c.ResponseError(err.Error())
+		return
+	}
+
 	// Filter by time range if specified
 	if startTime != "" || endTime != "" {
 		chats = object.FilterChatsByTimeRange(chats, startTime, endTime)
@@ -197,12 +203,8 @@ func (c *ApiController) GetChatStatus() {
 		return
 	}
 
-	if !c.IsAdmin() {
-		username := c.GetSessionUsername()
-		if username != chat.User {
-			c.ResponseError(c.T("auth:Unauthorized operation"))
-			return
-		}
+	if !c.requireUserDataAccess(chat.User, chat.Store) {
+		return
 	}
 
 	c.ResponseOk(map[string]bool{
@@ -233,12 +235,8 @@ func (c *ApiController) GetChat() {
 	}
 
 	// Check if user has permission to view this chat
-	if !c.IsAdmin() {
-		username := c.GetSessionUsername()
-		if username != chat.User {
-			c.ResponseError(c.T("auth:Unauthorized operation"))
-			return
-		}
+	if !c.requireUserDataAccess(chat.User, chat.Store) {
+		return
 	}
 
 	c.ResponseOk(chat)
@@ -276,7 +274,7 @@ func (c *ApiController) UpdateChat() {
 		return
 	}
 
-	ok := c.IsCurrentUser(originalChat.User)
+	ok := c.requireUserDataAccess(originalChat.User, originalChat.Store)
 	if !ok {
 		return
 	}
@@ -315,7 +313,7 @@ func (c *ApiController) AddChat() {
 		return
 	}
 
-	ok := c.IsCurrentUser(chat.User)
+	ok := c.requireUserDataAccess(chat.User, chat.Store)
 	if !ok {
 		return
 	}
@@ -381,15 +379,11 @@ func (c *ApiController) DeleteChat() {
 		c.ResponseError(fmt.Sprintf("The chat: %s is not found", chat.GetId()))
 		return
 	}
-	if persistedChat.IsApiLog() {
-		if !c.RequireAdmin() {
-			return
-		}
-	} else {
-		ok := c.IsCurrentUser(persistedChat.User)
-		if !ok {
-			return
-		}
+	if persistedChat.IsApiLog() && !c.RequireAdmin() {
+		return
+	}
+	if !c.requireUserDataAccess(persistedChat.User, persistedChat.Store) {
+		return
 	}
 
 	success, err := object.DeleteChat(persistedChat)
```

**File**: `controllers/file.go` (modified, +3/-0)
```diff
@@ -257,6 +257,9 @@ func (c *ApiController) UploadFile() {
 
 	filename := c.Input().Get("filename")
 	store := c.Input().Get("store")
+	if !c.requireStoreNameOwnership(store) {
+		return
+	}
 
 	fileData, header, err := c.GetFile("file")
 	if err != nil {
```

**File**: `controllers/message.go` (modified, +25/-9)
```diff
@@ -217,6 +217,11 @@ func (c *ApiController) GetMessages() {
 			c.ResponseError(err.Error())
 			return
 		}
+		messages, err = c.filterStoreAdminMessages(messages)
+		if err != nil {
+			c.ResponseError(err.Error())
+			return
+		}
 		if err = object.PopulateMessagesReadOnly(messages); err != nil {
 			c.ResponseError(err.Error())
 			return
@@ -230,6 +235,11 @@ func (c *ApiController) GetMessages() {
 		c.ResponseError(err.Error())
 		return
 	}
+	messages, err = c.filterStoreAdminMessages(messages)
+	if err != nil {
+		c.ResponseError(err.Error())
+		return
+	}
 	if err = object.PopulateMessagesReadOnly(messages); err != nil {
 		c.ResponseError(err.Error())
 		return
@@ -264,12 +274,8 @@ func (c *ApiController) GetMessage() {
 	}
 
 	// Check if user has permission to view this message
-	if !c.IsAdmin() {
-		username := c.GetSessionUsername()
-		if username != message.User {
-			c.ResponseError(c.T("auth:Unauthorized operation"))
-			return
-		}
+	if !c.requireUserDataAccess(message.User, message.Store) {
+		return
 	}
 
 	c.ResponseOk(message)
@@ -307,7 +313,7 @@ func (c *ApiController) UpdateMessage() {
 		return
 	}
 
-	ok := c.IsCurrentUser(persistedMessage.User)
+	ok := c.requireUserDataAccess(persistedMessage.User, persistedMessage.Store)
 	if !ok {
 		return
 	}
@@ -358,7 +364,7 @@ func (c *ApiController) AddMessage() {
 
 	var chat *object.Chat
 	if originMessage != nil {
-		if !c.IsCurrentUser(originMessage.User) {
+		if !c.requireUserDataAccess(originMessage.User, originMessage.Store) {
 			return
 		}
 		var mutable bool
@@ -368,7 +374,7 @@ func (c *ApiController) AddMessage() {
 		}
 		preserveMessageOwnership(&message, originMessage)
 	} else {
-		if !c.IsCurrentUser(message.User) {
+		if !c.requireUserDataAccess(message.User, message.Store) {
 			return
 		}
 		if message.Chat != "" {
@@ -381,6 +387,9 @@ func (c *ApiController) AddMessage() {
 				c.ResponseError(c.T("auth:Unauthorized operation"))
 				return
 			}
+			if !c.requireUserDataAccess(chat.User, chat.Store) {
+				return
+			}
 		}
 	}
 
@@ -564,6 +573,9 @@ func (c *ApiController) DeleteMessage() {
 		c.ResponseError("Message not found")
 		return
 	}
+	if !c.requireUserDataAccess(persistedMessage.User, persistedMessage.Store) {
+		return
+	}
 	if _, ok := c.ensureMessageMutable(persistedMessage); !ok {
 		return
 	}
@@ -591,6 +603,10 @@ func (c *ApiController) DeleteWelcomeMessage() {
 		c.ResponseError(err.Error())
 		return
 	}
+	if message == nil {
+		c.ResponseError("Message not found")
+		return
+	}
 
 	user := c.GetSessionUsername()
 	if user != "" && user != message.User {
```

**File**: `controllers/message_answer.go` (modified, +2/-2)
```diff
@@ -50,7 +50,7 @@ func (c *ApiController) GetMessageAnswer() {
 		return
 	}
 	if message != nil {
-		ok := c.IsCurrentUser(message.User)
+		ok := c.requireUserDataAccess(message.User, message.Store)
 		if !ok {
 			return
 		}
@@ -85,7 +85,7 @@ func (c *ApiController) CancelMessageAnswer() {
 		c.ResponseError(fmt.Sprintf("The message: %s is not found", id))
 		return
 	}
-	ok := c.IsCurrentUser(message.User)
+	ok := c.requireUserDataAccess(message.User, message.Store)
 	if !ok {
 		return
 	}
```

---

### Incident Patch 7: `b21950e0` (2026-09-27)
**Commit Message**: fix(ci): use a local iconfont.js copy instead of the CDN download

**File**: `scripts/assets/iconfont.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+!function(a){var h,t,l,c,i,p='<svg><symbol id="icon-testfile-unknown1" viewBox="0 0 1024 1024"><path d="M903.542857 256.8c6.857143 6.857143 10.742857 16.114286 10.742857 25.828571V987.428571c0 20.228571-16.342857 36.571429-36.571428 36.571429H146.285714c-20.228571 0-36.571429-16.342857-36.571428-36.571429V36.571429c0-20.228571 16.342857-36.571429 36.571428-36.571429h485.371429c9.714286 0 19.085714 3.885714 25.942857 10.742857l245.942857 246.057143zM829.942857 299.428571L614.857143 84.342857V299.428571h215.085714zM386.285714 554.285714c0 6.171429 5.028571 10.857143 11.2 10.857143h37.028572c6.171429 0 11.2-4.8 11.2-10.742857 0-32.228571 29.485714-58.971429 66.285714-58.971429s66.285714 26.742857 66.285714 58.857143c0 28.914286-24 53.942857-56.342857 58.171429-22.057143 3.2-39.428571 23.2-39.657143 45.828571v36.571429c0 6.285714 5.142857 11.428571 11.428572 11.428571h36.571428c6.285714 0 11.428571-5.142857 11.428572-11.428571v-13.942857c0-6.857143 4.571429-13.142857 11.085714-15.2 50.971429-16.457143 85.714286-61.714286 84.914286-113.028572-0.914286-63.428571-56.228571-115.2-124-116.114285-70.171429-0.8-127.428571 52.114286-127.428572 117.714285z m125.714286 259.428572a36.571429 36.571429 0 1 0 0-73.142857 36.571429 36.571429 0 0 0 0 73.142857z"  ></path></symbol><symbol id="icon-testfile-unknown2" viewBox="0 0 1024 1024"><path d="M854.584889 288.711111c6.030222 5.973333 9.415111 14.08 9.415111 22.584889v616.704c0 17.692444-14.307556 32-32 32H192a31.971556 31.971556 0 0 1-32-32V96c0-17.692444 14.307556-32 32-32h424.675556c8.533333 0 16.725333 3.413333 22.727111 9.386667l215.210666 215.324444z m-64.398222 37.262222l-188.188445-188.16v188.188445h188.188445zM402.005333 548.977778c0 5.404444 4.408889 9.528889 9.784889 9.528889h32.426667c5.404444 0 9.784889-4.209778 9.784889-9.386667 0-28.216889 25.799111-51.626667 57.998222-51.626667 32.199111 0 58.026667 23.409778 58.026667 51.484445 0 25.315556-21.048889 47.217778-49.322667 50.915555-19.313778 2.816-34.503111 20.309333-34.702222 40.106667v32c0 5.489778 4.494222 10.012444 10.012444 10.012444h32a10.040889 10.040889 0 0 0 9.984-10.012444v-12.202667c0-5.973333 3.982222-11.491556 9.699556-13.312 44.600889-14.392889 75.008-53.987556 74.296889-98.872889-0.796444-55.523556-49.208889-100.807111-108.487111-101.603555-61.411556-0.711111-111.502222 45.596444-111.502223 102.968889zM512 776.021333a32 32 0 1 0 0-64 32 32 0 0 0 0 64z"  ></path></symbol><symbol id="icon-testfile-unknown" viewBox="0 0 1024 1024"><path d="M903.542857 256.8L657.6 10.742857c-6.857143-6.857143-16.228571-10.742857-25.942857-10.742857H146.285714c-20.228571 0-36.571429 16.342857-36.571428 36.571429v950.857142c0 20.228571 16.342857 36.571429 36.571428 36.571429h731.428572c20.228571 0 36.571429-16.342857 36.571428-36.571429V282.628571c0-9.714286-3.885714-18.971429-10.742857-25.828571zM829.942857 299.428571H614.857143V84.342857L829.942857 299.428571z m2.057143 642.285715H192V82.285714h345.142857v246.857143a48 48 0 0 0 48 48h246.857143v564.571429zM386.285714 554.285714c0 6.171429 5.028571 10.857143 11.2 10.857143h37.028572c6.171429 0 11.2-4.8 11.2-10.742857 0-32.228571 29.485714-58.971429 66.285714-58.971429s66.285714 26.742857 66.285714 58.857143c0 28.914286-24 53.942857-56.342857 58.171429-22.057143 3.2-39.428571 23.2-39.657143 45.828571v36.571429c0 6.285714 5.142857 11.428571 11.428572 11.428571h36.571428c6.285714 0 11.428571-5.142857 11.428572-11.428571v-13.942857c0-6.857143 4.571429-13.142857 11.085714-15.2 50.971429-16.457143 85.714286-61.714286 84.914286-113.028572-0.914286-63.428571-56.228571-115.2-124-116.114285-70.171429-0.8-127.428571 52.114286-127.428572 117.714285z m89.142857 222.857143a36.571429 36.571429 0 1 0 73.142858 0 36.571429 36.571429 0 1 0-73.142858 0z"  ></path></symbol><symbol id="icon-testfolder" viewBox="0 0 1024 1024"><path d="M0 317h1024v595H0z" fill="#FFE17B" ></path><path d="M523 217l-98-97H0v197h1024V217z" fill="#FFEFB6" ></path></symbol><symbol id="icon-testcss" viewBox="0 0 1024
```

**File**: `scripts/prepare-embedded-web-assets.sh` (modified, +8/-2)
```diff
@@ -4,7 +4,8 @@ set -euo pipefail
 ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
 STATIC_REPO_URL="${STATIC_REPO_URL:-https://github.com/the-open-agent/static.git}"
 STATIC_REPO_DIR="${STATIC_REPO_DIR:-}"
-ICONFONT_URL="${ICONFONT_URL:-https://cdn.open-ct.com/icon/iconfont.js}"
+ICONFONT_FILE="${ICONFONT_FILE:-${ROOT_DIR}/scripts/assets/iconfont.js}"
+ICONFONT_URL="${ICONFONT_URL:-}"
 
 if [[ -z "${STATIC_REPO_DIR}" ]]; then
   TMP_DIR="$(mktemp -d)"
@@ -33,7 +34,12 @@ cp -R "${STATIC_REPO_DIR}/img" "${PUBLIC_DIR}/img"
 cp -R "${STATIC_REPO_DIR}/flag-icons" "${PUBLIC_DIR}/flag-icons"
 cp -R "${STATIC_REPO_DIR}/gravatar" "${PUBLIC_DIR}/gravatar"
 mkdir -p "${PUBLIC_DIR}/icon"
-curl -fsSL "${ICONFONT_URL}" -o "${PUBLIC_DIR}/icon/iconfont.js"
+if [[ -n "${ICONFONT_URL}" ]]; then
+  curl -fsSL --connect-timeout 30 --max-time 120 "${ICONFONT_URL}" -o "${PUBLIC_DIR}/icon/iconfont.js"
+else
+  require_path "${ICONFONT_FILE}"
+  cp "${ICONFONT_FILE}" "${PUBLIC_DIR}/icon/iconfont.js"
+fi
 
 sed -i \
   -e 's#https://cdn.openagentai.org/img/openagent.png#/img/openagent.png#g' \
```

---

### Incident Patch 8: `11ebfc4f` (2026-09-27)
**Commit Message**: fix: block SSRF, stored XSS and store-admin command execution

**File**: `controllers/message_answer.go` (modified, +15/-5)
```diff
@@ -61,8 +61,8 @@ func (c *ApiController) GetMessageAnswer() {
 	c.Ctx.ResponseWriter.Header().Set("Connection", "keep-alive")
 
 	// Any user can point a chat at any store, so tools that run commands or touch the local
-	// machine are only enabled for admins, never merely for being signed in.
-	job := messageAnswerJobs.getOrStart(id, c.Ctx.Request.Host, c.GetAcceptLanguage(), signedIn, c.IsAdmin())
+	// machine are only enabled for the global admin, never for store admins or signed-in users.
+	job := messageAnswerJobs.getOrStart(id, c.Ctx.Request.Host, c.GetAcceptLanguage(), signedIn, c.IsGlobalAdmin())
 	streamMessageAnswerJob(c.Ctx.ResponseWriter, c.Ctx.Request, job)
 }
 
@@ -96,7 +96,7 @@ func (c *ApiController) CancelMessageAnswer() {
 
 func (c *ApiController) generateMessageAnswer(id string, responseWriter http.ResponseWriter, host string) {
 	_, signedIn := c.CheckSignedIn()
-	generateMessageAnswer(id, responseWriter, host, c.GetAcceptLanguage(), signedIn, c.IsAdmin(), c.ResponseError)
+	generateMessageAnswer(id, responseWriter, host, c.GetAcceptLanguage(), signedIn, c.IsGlobalAdmin(), c.ResponseError)
 }
 
 func streamMessageAnswerJob(responseWriter http.ResponseWriter, request *http.Request, job *messageAnswerJob) {
@@ -644,8 +644,18 @@ func (c *ApiController) GetAnswer() {
 	video := c.Input().Get("video")
 	tool := c.Input().Get("tool")
 
-	if tool != "" && !c.RequireAdmin() {
-		return
+	if tool != "" {
+		if !c.RequireAdmin() {
+			return
+		}
+		t, err := object.GetTool(util.GetIdFromOwnerAndName("admin", tool))
+		if err != nil {
+			c.ResponseError(err.Error())
+			return
+		}
+		if !c.requireHighRiskToolPermission(t) {
+			return
+		}
 	}
 
 	if question == "" {
```

**File**: `controllers/message_util.go` (modified, +7/-2)
```diff
@@ -163,13 +163,18 @@ func RefineMessageImage(message *object.Message, lang string) error {
 	}
 	ext := extMatches[1]
 
-	resp, err := http.Get(imageUrl)
+	// The URL comes from model output, which a prompt can steer, so internal addresses are refused.
+	httpClient, err := util.GetUntrustedHttpClient(imageUrl)
+	if err != nil {
+		return err
+	}
+	resp, err := httpClient.Get(imageUrl)
 	if err != nil {
 		return err
 	}
 	defer resp.Body.Close()
 
-	data, err := io.ReadAll(resp.Body)
+	data, err := io.ReadAll(io.LimitReader(resp.Body, util.UntrustedFetchMaxBytes))
 	if err != nil {
 		return err
 	}
```

**File**: `controllers/migration.go` (modified, +8/-8)
```diff
@@ -48,7 +48,7 @@ type MigrationPreview struct {
 // @Success 200 {array} migration.Source The Response object
 // @router /get-migration-sources [get]
 func (c *ApiController) GetMigrationSources() {
-	if !c.RequireAdmin() {
+	if !c.RequireGlobalAdmin() {
 		return
 	}
 
@@ -65,7 +65,7 @@ func (c *ApiController) GetMigrationSources() {
 // @Success 200 {object} controllers.MigrationPreview The Response object
 // @router /upload-migration-file [post]
 func (c *ApiController) UploadMigrationFile() {
-	if !c.RequireAdmin() {
+	if !c.RequireGlobalAdmin() {
 		return
 	}
 
@@ -104,7 +104,7 @@ func (c *ApiController) UploadMigrationFile() {
 // @Success 200 {object} controllers.MigrationPreview The Response object
 // @router /preview-migration [post]
 func (c *ApiController) PreviewMigration() {
-	if !c.RequireAdmin() {
+	if !c.RequireGlobalAdmin() {
 		return
 	}
 
@@ -138,7 +138,7 @@ func (c *ApiController) PreviewMigration() {
 // @Success 200 {object} migration.Progress The Response object
 // @router /start-migration [post]
 func (c *ApiController) StartMigration() {
-	if !c.RequireAdmin() {
+	if !c.RequireGlobalAdmin() {
 		return
 	}
 
@@ -180,7 +180,7 @@ func (c *ApiController) StartMigration() {
 // @Success 200 {object} migration.Progress The Response object
 // @router /get-migration-progress [get]
 func (c *ApiController) GetMigrationProgress() {
-	if !c.RequireAdmin() {
+	if !c.RequireGlobalAdmin() {
 		return
 	}
 
@@ -201,7 +201,7 @@ func (c *ApiController) GetMigrationProgress() {
 // @Success 200 {array} object.Migration The Response object
 // @router /get-migrations [get]
 func (c *ApiController) GetMigrations() {
-	if !c.RequireAdmin() {
+	if !c.RequireGlobalAdmin() {
 		return
 	}
 
@@ -222,7 +222,7 @@ func (c *ApiController) GetMigrations() {
 // @Success 200 {object} object.Migration The Response object
 // @router /get-migration [get]
 func (c *ApiController) GetMigration() {
-	if !c.RequireAdmin() {
+	if !c.RequireGlobalAdmin() {
 		return
 	}
 
@@ -244,7 +244,7 @@ func (c *ApiController) GetMigration() {
 // @Success 200 {array} string The Response object, notes about what could not be undone
 // @router /rollback-migration [post]
 func (c *ApiController) RollbackMigration() {
-	if !c.RequireAdmin() {
+	if !c.RequireGlobalAdmin() {
 		return
 	}
 
```

**File**: `controllers/server.go` (modified, +36/-0)
```diff
@@ -27,6 +27,21 @@ import (
 	"github.com/the-open-agent/openagent/util"
 )
 
+// requireHostCommandPermission blocks store-level admins from stdio MCP servers, whose command
+// runs directly on this host.
+func (c *ApiController) requireHostCommandPermission(servers ...*object.Server) bool {
+	if c.IsGlobalAdmin() {
+		return true
+	}
+	for _, server := range servers {
+		if server.IsStdio() {
+			c.ResponseError(c.T("controllers:Only the global admin can configure tools or MCP servers that run commands on the host"))
+			return false
+		}
+	}
+	return true
+}
+
 // GetServers
 // @Title GetServers
 // @Tag Server API
@@ -108,6 +123,15 @@ func (c *ApiController) UpdateServer() {
 		return
 	}
 
+	oldServer, err := object.GetServer(id)
+	if err != nil {
+		c.ResponseError(err.Error())
+		return
+	}
+	if !c.requireHostCommandPermission(&server, oldServer) {
+		return
+	}
+
 	success, err := object.UpdateServer(id, &server)
 	if err != nil {
 		c.ResponseError(err.Error())
@@ -132,6 +156,10 @@ func (c *ApiController) AddServer() {
 		return
 	}
 
+	if !c.requireHostCommandPermission(&server) {
+		return
+	}
+
 	server.Owner = "admin"
 	success, err := object.AddServer(&server)
 	if err != nil {
@@ -181,6 +209,10 @@ func (c *ApiController) TestMcpServer() {
 		return
 	}
 
+	if !c.requireHostCommandPermission(&server) {
+		return
+	}
+
 	result, err := object.TestMcpServer(&server, c.GetAcceptLanguage())
 	if err != nil {
 		c.ResponseError(err.Error())
@@ -209,6 +241,10 @@ func (c *ApiController) SyncMcpTool() {
 		return
 	}
 
+	if !c.requireHostCommandPermission(&server) {
+		return
+	}
+
 	ok, err := object.SyncMcpTool(id, &server, isCleared)
 	if err != nil {
 		c.ResponseError(err.Error())
```

**File**: `controllers/site.go` (modified, +10/-5)
```diff
@@ -28,7 +28,7 @@ import (
 // @Success 200 {array} object.Site The Response object
 // @router /get-global-sites [get]
 func (c *ApiController) GetGlobalSites() {
-	if !c.RequireAdmin() {
+	if !c.RequireGlobalAdmin() {
 		return
 	}
 
@@ -48,7 +48,7 @@ func (c *ApiController) GetGlobalSites() {
 // @Success 200 {array} object.Site The Response object
 // @router /get-sites [get]
 func (c *ApiController) GetSites() {
-	if !c.RequireAdmin() {
+	if !c.RequireGlobalAdmin() {
 		return
 	}
 
@@ -69,6 +69,11 @@ func (c *ApiController) GetSites() {
 // @Success 200 {object} object.Site The Response object
 // @router /get-site [get]
 func (c *ApiController) GetSite() {
+	// The site holds the Casdoor client secret, from which the app-level access token is derived.
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	id := c.Input().Get("id")
 
 	site, err := object.GetSite(id)
@@ -105,7 +110,7 @@ func (c *ApiController) GetBuiltInSite() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /update-site [post]
 func (c *ApiController) UpdateSite() {
-	if !c.RequireAdmin() {
+	if !c.RequireGlobalAdmin() {
 		return
 	}
 
@@ -142,7 +147,7 @@ func (c *ApiController) UpdateSite() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /add-site [post]
 func (c *ApiController) AddSite() {
-	if !c.RequireAdmin() {
+	if !c.RequireGlobalAdmin() {
 		return
 	}
 
@@ -170,7 +175,7 @@ func (c *ApiController) AddSite() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /delete-site [post]
 func (c *ApiController) DeleteSite() {
-	if !c.RequireAdmin() {
+	if !c.RequireGlobalAdmin() {
 		return
 	}
 
```

---

### Incident Patch 9: `f4e0ce75` (2026-09-27)
**Commit Message**: fix: close unauthorized data access, SQL injection and webhook bypass

**File**: `authz/authz.go` (modified, +0/-4)
```diff
@@ -90,10 +90,6 @@ p, anonymous, *, /api/delete-task
 p, anonymous, *, /api/upload-task-document
 p, anonymous, *, /api/start-connection
 p, anonymous, *, /api/stop-connection
-p, anonymous, *, /api/commit-record
-p, anonymous, *, /api/commit-record-second
-p, anonymous, *, /api/query-record
-p, anonymous, *, /api/query-record-second
 p, anonymous, *, /api/generate-text-to-speech-audio
 p, anonymous, *, /api/generate-text-to-speech-audio-stream
 p, anonymous, *, /api/process-speech-to-text
```

**File**: `controllers/base.go` (modified, +5/-1)
```diff
@@ -232,7 +232,11 @@ func (c *ApiController) errorLogFilter() {
 			if len(body) > 4096 {
 				body = body[:4096] + "...(truncated)"
 			}
-			token := c.Ctx.Request.Header.Get("Authorization")
+			// Never write credentials to the log; only record whether one was sent.
+			token := ""
+			if c.Ctx.Request.Header.Get("Authorization") != "" {
+				token = "<redacted>"
+			}
 			respJSON, _ := json.Marshal(v)
 			respStr := string(respJSON)
 			if len(respStr) > 4096 {
```

**File**: `controllers/chat.go` (modified, +11/-0)
```diff
@@ -139,6 +139,17 @@ func (c *ApiController) GetChats() {
 		return
 	}
 
+	if !c.IsAdmin() {
+		// Non-admins may only list their own chats. An empty user would match every chat,
+		// so anonymous callers get nothing.
+		user = c.GetSessionUsername()
+		if user == "" {
+			c.ResponseOk([]*object.Chat{})
+			return
+		}
+		field = ""
+	}
+
 	// Apply store isolation based on user's Homepage field
 	var ok bool
 	storeName, ok = c.EnforceStoreIsolation(storeName)
```

**File**: `controllers/message.go` (modified, +46/-0)
```diff
@@ -169,6 +169,48 @@ func (c *ApiController) GetMessages() {
 		return
 	}
 
+	if !c.IsAdmin() {
+		// Non-admins may only read their own messages. An empty user would match every
+		// message, so it is never used as a filter for them.
+		user = c.GetSessionUsername()
+		if chat == "" {
+			if user == "" {
+				c.ResponseOk([]*object.Message{})
+				return
+			}
+		} else {
+			chatObj, err := object.GetChat(util.GetId("admin", chat))
+			if err != nil {
+				c.ResponseError(err.Error())
+				return
+			}
+			if chatObj != nil && chatObj.User != user {
+				c.ResponseError(c.T("auth:Unauthorized operation"))
+				return
+			}
+		}
+	}
+
+	if chat != "" && !c.IsAdmin() {
+		messages, err := object.GetChatMessages(chat)
+		if err != nil {
+			c.ResponseError(err.Error())
+			return
+		}
+		ownMessages := []*object.Message{}
+		for _, message := range messages {
+			if message.User == user {
+				ownMessages = append(ownMessages, message)
+			}
+		}
+		if err = object.PopulateMessagesReadOnly(ownMessages); err != nil {
+			c.ResponseError(err.Error())
+			return
+		}
+		c.ResponseOk(ownMessages)
+		return
+	}
+
 	if chat == "" {
 		messages, err := object.GetMessages("admin", user, "")
 		if err != nil {
@@ -335,6 +377,10 @@ func (c *ApiController) AddMessage() {
 			if !mutable {
 				return
 			}
+			if !c.IsAdmin() && chat.User != message.User {
+				c.ResponseError(c.T("auth:Unauthorized operation"))
+				return
+			}
 		}
 	}
 
```

**File**: `controllers/message_answer.go` (modified, +4/-2)
```diff
@@ -60,7 +60,9 @@ func (c *ApiController) GetMessageAnswer() {
 	c.Ctx.ResponseWriter.Header().Set("Cache-Control", "no-cache")
 	c.Ctx.ResponseWriter.Header().Set("Connection", "keep-alive")
 
-	job := messageAnswerJobs.getOrStart(id, c.Ctx.Request.Host, c.GetAcceptLanguage(), signedIn, signedIn)
+	// Any user can point a chat at any store, so tools that run commands or touch the local
+	// machine are only enabled for admins, never merely for being signed in.
+	job := messageAnswerJobs.getOrStart(id, c.Ctx.Request.Host, c.GetAcceptLanguage(), signedIn, c.IsAdmin())
 	streamMessageAnswerJob(c.Ctx.ResponseWriter, c.Ctx.Request, job)
 }
 
@@ -94,7 +96,7 @@ func (c *ApiController) CancelMessageAnswer() {
 
 func (c *ApiController) generateMessageAnswer(id string, responseWriter http.ResponseWriter, host string) {
 	_, signedIn := c.CheckSignedIn()
-	generateMessageAnswer(id, responseWriter, host, c.GetAcceptLanguage(), signedIn, signedIn, c.ResponseError)
+	generateMessageAnswer(id, responseWriter, host, c.GetAcceptLanguage(), signedIn, c.IsAdmin(), c.ResponseError)
 }
 
 func streamMessageAnswerJob(responseWriter http.ResponseWriter, request *http.Request, job *messageAnswerJob) {
```

---

### Incident Patch 10: `54bcbee6` (2026-09-27)
**Commit Message**: fix: tighten auth defaults, storage paths and tool access

**File**: `controllers/account.go` (modified, +3/-1)
```diff
@@ -366,7 +366,9 @@ func (c *ApiController) GetAccount() {
 	if object.IsSigninEnabled() {
 		if c.GetSessionUsername() == "" {
 			fromPath := c.GetString("fromPath")
-			if fromPath != "/signin" && object.IsAdminUsingDefaultPassword() {
+			// Auto sign-in with the default admin password is only allowed for requests made
+			// directly from the local machine, never for remote visitors.
+			if fromPath != "/signin" && util.IsLoopbackRequest(c.Ctx.Request) && object.IsAdminUsingDefaultPassword() {
 				if !c.autoLoginAdmin() {
 					return
 				}
```

**File**: `controllers/chat.go` (modified, +8/-0)
```diff
@@ -270,6 +270,10 @@ func (c *ApiController) UpdateChat() {
 		return
 	}
 	chat.Source = originalChat.Source
+	if !c.IsAdmin() {
+		// Binding a chat to a tool grants the agent that tool's capabilities, so only admins may change it.
+		chat.Tool = originalChat.Tool
+	}
 
 	if conf.IsDemoMode() {
 		originalChat.ModelProvider = chat.ModelProvider
@@ -304,6 +308,10 @@ func (c *ApiController) AddChat() {
 	if !ok {
 		return
 	}
+	if !c.IsAdmin() {
+		// Binding a chat to a tool grants the agent that tool's capabilities, so only admins may set it.
+		chat.Tool = ""
+	}
 
 	currentTime := util.GetCurrentTime()
 	chat.CreatedTime = currentTime
```

**File**: `controllers/message_answer.go` (modified, +15/-3)
```diff
@@ -60,7 +60,7 @@ func (c *ApiController) GetMessageAnswer() {
 	c.Ctx.ResponseWriter.Header().Set("Cache-Control", "no-cache")
 	c.Ctx.ResponseWriter.Header().Set("Connection", "keep-alive")
 
-	job := messageAnswerJobs.getOrStart(id, c.Ctx.Request.Host, c.GetAcceptLanguage(), signedIn)
+	job := messageAnswerJobs.getOrStart(id, c.Ctx.Request.Host, c.GetAcceptLanguage(), signedIn, signedIn)
 	streamMessageAnswerJob(c.Ctx.ResponseWriter, c.Ctx.Request, job)
 }
 
@@ -94,7 +94,7 @@ func (c *ApiController) CancelMessageAnswer() {
 
 func (c *ApiController) generateMessageAnswer(id string, responseWriter http.ResponseWriter, host string) {
 	_, signedIn := c.CheckSignedIn()
-	generateMessageAnswer(id, responseWriter, host, c.GetAcceptLanguage(), signedIn, c.ResponseError)
+	generateMessageAnswer(id, responseWriter, host, c.GetAcceptLanguage(), signedIn, signedIn, c.ResponseError)
 }
 
 func streamMessageAnswerJob(responseWriter http.ResponseWriter, request *http.Request, job *messageAnswerJob) {
@@ -137,7 +137,7 @@ func streamMessageAnswerJob(responseWriter http.ResponseWriter, request *http.Re
 	}
 }
 
-func generateMessageAnswer(id string, responseWriter http.ResponseWriter, host string, lang string, signedIn bool, responseError func(string, ...interface{})) {
+func generateMessageAnswer(id string, responseWriter http.ResponseWriter, host string, lang string, signedIn bool, allowHighRiskTools bool, responseError func(string, ...interface{})) {
 	responseErrorStream := func(message *object.Message, errorText string) {
 		if err := writeMessageErrorStream(responseWriter, lang, message, errorText); err != nil {
 			if responseError != nil {
@@ -213,6 +213,14 @@ func generateMessageAnswer(id string, responseWriter http.ResponseWriter, host s
 		store.Tools = []string{chat.Tool}
 	}
 
+	if !allowHighRiskTools && len(store.Tools) > 0 {
+		store.Tools, err = object.FilterOutHighRiskTools(store.Owner, store.Tools)
+		if err != nil {
+			responseErrorStream(message, err.Error())
+			return
+		}
+	}
+
 	if len(store.Tools) > 0 {
 		store.Prompt += "\nYou are a helpful AI assistant with access to tools. When the user asks you to perform a task, you MUST use the available tools to complete it directly. Do not refuse or explain why you cannot — just use the tools and fulfill the request."
 		store.Prompt += "\n## Execution Bias\n" +
@@ -634,6 +642,10 @@ func (c *ApiController) GetAnswer() {
 	video := c.Input().Get("video")
 	tool := c.Input().Get("tool")
 
+	if tool != "" && !c.RequireAdmin() {
+		return
+	}
+
 	if question == "" {
 		c.ResponseError(fmt.Sprintf("The question should not be empty"))
 		return
```

**File**: `controllers/message_answer_job.go` (modified, +2/-2)
```diff
@@ -42,7 +42,7 @@ func newMessageAnswerJobManager() *messageAnswerJobManager {
 	}
 }
 
-func (m *messageAnswerJobManager) getOrStart(id string, host string, lang string, signedIn bool) *messageAnswerJob {
+func (m *messageAnswerJobManager) getOrStart(id string, host string, lang string, signedIn bool, allowHighRiskTools bool) *messageAnswerJob {
 	m.mu.Lock()
 	if job, ok := m.jobs[id]; ok {
 		m.mu.Unlock()
@@ -80,7 +80,7 @@ func (m *messageAnswerJobManager) getOrStart(id string, host string, lang string
 			job.finish()
 			cleanupMessageAnswerJobChatStatus(id)
 		}()
-		generateMessageAnswer(id, job.writer, host, lang, signedIn, nil)
+		generateMessageAnswer(id, job.writer, host, lang, signedIn, allowHighRiskTools, nil)
 	}()
 
 	return job
```

**File**: `controllers/pipe_webhook.go` (modified, +1/-1)
```diff
@@ -395,7 +395,7 @@ func sendPipeAnswer(provider pipepkg.Pipe, pipeObj *object.Pipe, incoming *pipep
 	}
 
 	recorder := newPipeSSERecorder(sender)
-	generateMessageAnswer(answerMessage.GetId(), recorder, host, lang, false, nil)
+	generateMessageAnswer(answerMessage.GetId(), recorder, host, lang, false, true, nil)
 
 	answer, err := object.GetMessage(answerMessage.GetId())
 	if err == nil && answer != nil && answer.Text != "" {
```

#### Recent Merged Pull Requests:
- **PR #2485** (closed): feat: add optional Parallel Search MCP provider (@georgeatparallel)
- **PR #2481** (closed): feat: add Browser Use Cloud MCP preset (@MagMueller)
- **PR #2478** (closed): feat: add sanitized tool arguments to OpenAgent audit logs (@Paperlz)
- **PR #2476** (closed): feat: emit chat_title, llm_call, and message audit events (@lulululu-debug)
- **PR #2475** (2026-08-07): fix: resolve symlinks before placing the audit directory next to the binary (@lulululu-debug)
- **PR #2474** (closed): fix: guard CasdoorProvider against a nil client when Casdoor is unavaliable (@lulululu-debug)
- **PR #2473** (2026-08-03): feat: emit a structured JSONL audit log for tool calls (@lulululu-debug)
- **PR #2472** (2026-08-03): feat: record the version so it can be read without running the server (@lulululu-debug)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

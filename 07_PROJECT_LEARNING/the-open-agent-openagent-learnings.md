# Forensic Learning Record (Deep Inspection): the-open-agent/openagent

> **Canonical Artifact**: `07_PROJECT_LEARNING/the-open-agent-openagent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/the-open-agent/openagent](https://github.com/the-open-agent/openagent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:00:21.802Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `the-open-agent/openagent`
- **Description**: ⚡️next-generation personal AI assistant powered by LLM, RAG and agent loops, supporting computer-use, browser-use and coding agent, demo: https://demo.openagentai.org
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 5684 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `chain/chainmaker_util.go`
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

package chain

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/the-open-agent/openagent/i18n"
)

type ChainmakerResponse struct {
	TxId      string `json:"tx_id"`
	Result    string `json:"result"`
	Block     string `json:"block"`
	BlockHash string `json:"block_hash"`
}

func SendChainmakerRequest(info *ChainChainmakerClient, method string, lang string) (*ChainmakerResponse, error) {
	jsonData, err := json.Marshal(info)
	if err != nil {
		return nil, err
	}

	serverUrl := info.ChainConfig.ChainmakerEndpoint
	if serverUrl == "" {
		return nil, fmt.Errorf(i18n.Translate(lang, "chain:chainmakerEndpoint is not configured"))
	}

	if !strings.HasPrefix(serverUrl, "http://") && !strings.HasPrefix(serverUrl, "https://") {
		serverUrl = "http://" + serverUrl
	}

	serverUrl = strings.TrimRight(serverUrl, "/")

	url := fmt.Sprintf("%s/api/%s", serverUrl, method)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	type Response struct {
		Status string      `json:"status"`
		Msg    string      `json:"msg"`
		Data   interface{} `json:"data"`
		Data2  interface{} `json:"data2"`
	}

	var response Response
	err = json.Unmarshal(body, &response)
	if err != nil {
		return nil, err
	}
	if response.Status == "error" {
		return nil, fmt.Errorf("%s", response.Msg)
	}

	dataJson, err := json.Marshal(response.Data)
	if err != nil {
		return nil, err
	}
	var chainmakerResp ChainmakerResponse
	err = json.Unmarshal(dataJson, &chainmakerResp)
	if err != nil {
		return nil, err
	}
	return &chainmakerResp, nil
}

func normalizeChainData(data string, lang string) (string, error) {
	var originChainData map[string]interface{}
	if err := json.Unmarshal([]byte(data), &originChainData); err != nil {
		return "", fmt.Errorf(i18n.Translate(lang, "chain:parse json data error: %v"), err)
	}

	normalizedData, err := json.Marshal(originChainData)
	if err != nil {
		return "", fmt.Errorf(i18n.Translate(lang, "chain:marshal normalized data error: %v"), err)
	}
	return string(normalizedData), nil
}

```

### Core Architecture Module: `conf/util.go`
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

package conf

import (
	"os"
	"path/filepath"
)

func FileExist(path string) bool {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return false
	}
	return true
}

func GetSharedPath(path string) string {
	if FileExist(path) {
		return path
	}

	for _, dir := range []string{FrontendBaseDir, filepath.Join(filepath.Dir(FrontendBaseDir), "casibase")} {
		res := filepath.Join(dir, path)
		if FileExist(res) {
			return res
		}
	}
	return path
}

func ReadStringFromPath(path string) string {
	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		panic(err)
	}

	return string(data)
}

```

### Core Architecture Module: `controllers/message_util.go`
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

package controllers

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/beego/beego"
	"github.com/the-open-agent/openagent/i18n"
	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
)

func writeMessageErrorStream(responseWriter http.ResponseWriter, lang string, message *object.Message, errorText string) error {
	var err error
	if message != nil {
		if !message.IsAlerted {
			err = message.SendErrorEmail(errorText, lang)
			if err != nil {
				errorText = fmt.Sprintf("%s\n%s", errorText, err.Error())
			}
		}

		if message.ErrorText != errorText || !message.IsAlerted || err != nil {
			message.ErrorText = errorText
			message.IsAlerted = true
			_, err = object.UpdateMessage(message.GetId(), message, false)
			if err != nil {
				errorText = fmt.Sprintf("%s\n%s", errorText, err.Error())
			}

			if chatErr := clearMessageChatGenerating(message); chatErr != nil {
				errorText = fmt.Sprintf("%s\n%s", errorText, chatErr.Error())
			}
		}
	}

	// SSE requires newlines in data to be escaped as "\ndata: " so the event
	// is not prematurely terminated (a blank line ends an SSE event).
	sseData := strings.ReplaceAll(errorText, "\n", "\ndata: ")
	event := fmt.Sprintf("event: myerror\ndata: %s\n\n", sseData)
	_, err = responseWriter.Write([]byte(event))
	if err != nil {
		return err
	}

	if flusher, ok := responseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
	return nil
}

func clearMessageChatGenerating(message *object.Message) error {
	chatId := util.GetId(message.Owner, message.Chat)
	chat, err := object.GetChat(chatId)
	if err != nil {
		return err
	}
	if chat == nil {
		return fmt.Errorf("chat %s not found", chatId)
	}

	chat.IsGenerating = false
	_, err = object.UpdateChat(chatId, chat)
	return err
}

func writeInfoStream(responseWriter http.ResponseWriter, infoText string) error {
	event := fmt.Sprintf("event: myinfo\ndata: %s\n\n", infoText)
	_, err := responseWriter.Write([]byte(event))
	if err != nil {
		return err
	}
	if flusher, ok := responseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
	return nil
}

func writeStatusStream(responseWriter http.ResponseWriter, statusText string) error {
	sseData := strings.ReplaceAll(statusText, "\n", "\ndata: ")
	event := fmt.Sprintf("event: status\ndata: %s\n\n", sseData)
	_, err := responseWriter.Write([]byte(event))
	if err != nil {
		return err
	}
	if flusher, ok := responseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
	return nil
}

func writeChatUpdateStream(responseWriter http.ResponseWriter, chat *object.Chat) error {
	if chat == nil {
		return nil
	}

	payload, err := json.Marshal(map[string]interface{}{
		"owner":       chat.Owner,
		"name":        chat.Name,
		"displayName": chat.DisplayName,
		"needTitle":   chat.NeedTitle,
	})
	if err != nil {
		return err
	}

	_, err = responseWriter.Write([]byte(fmt.Sprintf("event: chat\ndata: %s\n\n", payload)))
	if err != nil {
		return err
	}
	if flusher, ok := responseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
	return nil
}

func (c *ApiController) ResponseErrorStream(message *object.Message, errorText string) {
	if err := writeMessageErrorStream(c.Ctx.ResponseWriter, c.GetAcceptLanguage(), message, errorText); err != nil {
		c.ResponseError(err.Error())
	}
}

func ConvertMessageDataToJSON(data string) ([]byte, error) {
	jsonData := map[string]string{"text": data}
	jsonBytes, err := json.Marshal(jsonData)
	if err != nil {
		return nil, err
	}
	return jsonBytes, nil
}

func RefineMessageImage(message *object.Message, lang string) error {
	imgRegex := regexp.MustCompile(`<img[^>]*src="([^"]*)"[^>]*>`)
	srcMatches := imgRegex.FindStringSubmatch(message.Text)
	if len(srcMatches) <= 1 {
		return fmt.Errorf(i18n.Translate(lang, "no image url found"))
	}
	imageUrl := srcMatches[1]

	extRegex := regexp.MustCompile(`\.([a-zA-Z]+)\?`)
	extMatches := extRegex.FindStringSubmatch(imageUrl)
	if len(extMatches) <= 1 {
		return fmt.Errorf(i18n.Translate(lang, "no extension found"))
	}
	ext := extMatches[1]

	// The URL comes from model output, which a prompt can steer, so internal addresses are refused.
	httpClient, err := util.GetUntrustedHttpClient(imageUrl)
	if err != nil {
		return err
	}
	resp, err := httpClient.Get(imageUrl)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(io.LimitReader(resp.Body, util.UntrustedFetchMaxBytes))
	if err != nil {
		return err
	}

	base64Data := base64.StdEncoding.EncodeToString(data)
	res := fmt.Sprintf("data:image/%s;base64,%s", ext, base64Data)
	message.Text = fmt.Sprintf("<img src=\"%s\" width=\"100%%\" height=\"auto\">", res)
	message.FileName = message.Name + "." + ext
	return nil
}

func tryStoreRemoteImage(message *object.Message, host string, lang string) {
	origin := getOriginFromHost(host)
	// DALL·E etc.: remote image URL in <img src="http...">
	if strings.Contains(message.Text, "<img src=\"http") {
		if err := storeImage(message, origin, lang); err != nil {
			beego.Info(fmt.Sprintf("tryStoreRemoteImage(): failed to upload image to CDN for message %s: %s", message.GetId(), err.Error()))
		}
		return
	}
	// gpt-image and similar: inline data URL (tryStoreRemoteImage previously skipped these)
	if strings.Contains(message.Text, ";base64,") && strings.Contains(message.Text, "data:") {
		if err := storeInlineBase64Images(message, origin, lang); err != nil {
			beego.Info(fmt.Sprintf("tryStoreRemoteImage(): failed to upload inline base64 image to CDN for message %s: %s", message.GetId(), err.Error()))
		}
	}
}

func storeImage(message *object.Message, origin string, lang string) error {
	err := RefineMessageImage(message, lang)
	if err != nil {
		return err
	}
	err = object.RefineMessageFiles(message, origin, lang)
	if err != nil {
		return err
	}
	_, err = object.UpdateMessage(message.GetId(), message, false)
	if err != nil {
		return err
	}
	return nil
}

func storeInlineBase64Images(message *object.Message, origin string, lang string) error {
	err := object.RefineMessageFiles(message, origin, lang)
	if err != nil {
		return err
	}
	_, err = object.UpdateMessage(message.GetId(), message, false)
	return err
}

```

### Core Architecture Module: `controllers/openai_api_util.go`
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

package controllers

import (
	"fmt"

	"github.com/beego/beego/context"
	"github.com/sashabaranov/go-openai"
	"github.com/the-open-agent/openagent/model"
	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
)

// parseOpenAIMessages splits a messages slice into question, system prompt, and prior history.
// History excludes the final user message, which is returned separately as question.
func parseOpenAIMessages(messages []openai.ChatCompletionMessage) (question, systemPrompt string, history []*model.RawMessage, err error) {
	for _, msg := range messages {
		switch msg.Role {
		case "system":
			systemPrompt = msg.Content
		case "user":
			question = msg.Content
			history = append(history, &model.RawMessage{Author: "Human", Text: msg.Content})
		case "assistant":
			history = append(history, &model.RawMessage{Author: "AI", Text: msg.Content})
		}
	}
	if question == "" {
		return "", "", nil, fmt.Errorf("no user message found in the request")
	}
	// Drop the last entry (the final user message) — it's passed as question to QueryText
	if len(history) > 0 {
		history = history[:len(history)-1]
	}
	return question, systemPrompt, history, nil
}

// newOpenAIWriter sets streaming headers when needed and returns a configured OpenAIWriter.
func newOpenAIWriter(rw *context.Response, request openai.ChatCompletionRequest, requestId string) *OpenAIWriter {
	if request.Stream {
		rw.Header().Set("Content-Type", "text/event-stream")
		rw.Header().Set("Cache-Control", "no-cache")
		rw.Header().Set("Connection", "keep-alive")
	}
	return &OpenAIWriter{
		Response:  *rw,
		Buffer:    []byte{},
		RequestID: requestId,
		Stream:    request.Stream,
		Cleaner:   *NewCleaner(6),
		Model:     request.Model,
	}
}

// createApiChatSession inserts a Chat, a user Message, and a placeholder AI Message into the DB.
func createApiChatSession(store *object.Store, modelProviderName, question string) (*object.Chat, *object.Message, *object.Message, error) {
	now := util.GetCurrentTime()
	userMessageTime := util.GetCurrentTimeWithMilli()

	chat := &object.Chat{
		Owner:         store.Owner,
		Name:          fmt.Sprintf("chat_%s", util.GetRandomName()),
		CreatedTime:   now,
		UpdatedTime:   now,
		Store:         store.Name,
		ModelProvider: modelProviderName,
		Source:        object.ChatSourceOpenAICompatibleAPI,
		User:          "api",
	}
	if _, err := object.AddChat(chat); err != nil {
		return nil, nil, nil, err
	}

	userMsg := &object.Message{
		Owner:         store.Owner,
		Name:          fmt.Sprintf("message_%s", util.GetRandomName()),
		CreatedTime:   userMessageTime,
		Store:         store.Name,
		Chat:          chat.Name,
		Author:        "Human",
		Text:          question,
		ModelProvider: modelProviderName,
		User:          "api",
	}
	if _, err := object.AddMessage(userMsg); err != nil {
		return nil, nil, nil, err
	}

	aiMsg := &object.Message{
		Owner:         store.Owner,
		Name:          fmt.Sprintf("message_%s", util.GetRandomName()),
		CreatedTime:   util.GetCurrentTimeBasedOnLastMilli(userMessageTime),
		Store:         store.Name,
		Chat:          chat.Name,
		Author:        "AI",
		ReplyTo:       userMsg.Name,
		ModelProvider: modelProviderName,
		User:          "api",
	}
	if _, err := object.AddMessage(aiMsg); err != nil {
		return nil, nil, nil, err
	}

	return chat, userMsg, aiMsg, nil
}

// applyResultToApiSession writes the AI answer and token counts back to the DB.
func applyResultToApiSession(aiMsg *object.Message, chat *object.Chat, writer *OpenAIWriter, modelResult *model.ModelResult) error {
	aiMsg.Text = writer.MessageString()
	aiMsg.ToolCalls = model.GetToolCallsFromWriter(writer.ToolString())
	aiMsg.TokenCount = modelResult.TotalTokenCount
	aiMsg.Price = modelResult.TotalPrice
	aiMsg.Currency = modelResult.Currency
	if _, err := object.UpdateMessage(aiMsg.GetId(), aiMsg, false); err != nil {
		return err
	}

	latestChat, err := object.GetChat(chat.GetId())
	if err != nil {
		return err
	}
	if latestChat == nil {
		return fmt.Errorf("chat not found: %s", chat.GetId())
	}

	latestChat.TokenCount += modelResult.TotalTokenCount
	latestChat.Price += modelResult.TotalPrice
	if latestChat.Currency == "" {
		latestChat.Currency = modelResult.Currency
	}
	_, err = object.UpdateChat(latestChat.GetId(), latestChat)
	return err
}

```

### Core Architecture Module: `controllers/pipe_webhook.go`
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

package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/object"
	pipepkg "github.com/the-open-agent/openagent/pipe"
	"github.com/the-open-agent/openagent/util"
)

type pipeAnswerSender interface {
	WriteMessage(text string) error
	WriteError(text string) error
	CloseMessage(text string) error
}

type defaultPipeAnswerSender struct {
	provider  pipepkg.Pipe
	incoming  *pipepkg.IncomingMessage
	text      string
	errorText string
}

type streamPipeAnswerSender struct {
	writer    pipepkg.PipeMessageWriter
	text      string
	errorText string
}

// ChatWebhookVerify handles the HTTP GET challenge that some platforms (e.g. WhatsApp
// Cloud API) send to verify webhook ownership before they start delivering events.
// The URL format is: /api/chat-webhook/:pipeType/:pipeName
// This endpoint does not require authentication.
// @router /api/chat-webhook/:pipeType/:pipeName [get]
func (c *ApiController) ChatWebhookVerify() {
	pipeType := c.Ctx.Input.Param(":pipeType")
	pipeName := c.Ctx.Input.Param(":pipeName")

	pipeObj, err := object.GetPipeByName("admin", pipeName)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		return
	}
	if pipeObj == nil || pipepkg.NormalizeType(pipeObj.Type) != pipeType {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
		return
	}

	provider, err := pipeObj.GetProvider(c.GetAcceptLanguage())
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		return
	}

	verifier, ok := provider.(pipepkg.WebhookVerifier)
	if !ok {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	params := map[string]string{}
	for key, values := range c.Ctx.Request.URL.Query() {
		if len(values) > 0 {
			params[key] = values[0]
		}
	}

	response, err := verifier.VerifyWebhook(params)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		return
	}

	writePipeWebhookResponse(c, response)
}

// ChatWebhook receives incoming updates from a chat pipe.
// The URL format is: /api/chat-webhook/:pipeType/:pipeName
// This endpoint does not require authentication because it is called by chat platform servers.
// @router /api/chat-webhook/:pipeType/:pipeName [post]
func (c *ApiController) ChatWebhook() {
	pipeType := c.Ctx.Input.Param(":pipeType")
	pipeName := c.Ctx.Input.Param(":pipeName")
	host := c.Ctx.Request.Host
	lang := c.GetAcceptLanguage()

	pipeObj, err := object.GetPipeByName("admin", pipeName)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		return
	}
	if pipeObj == nil || pipepkg.NormalizeType(pipeObj.Type) != pipeType {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
		return
	}

	provider, err := pipeObj.GetProvider(lang)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		return
	}

	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		return
	}

	immediateResponse, err := getImmediatePipeResponse(provider, body, c.Ctx.Request.Header)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		return
	}
	// A 4xx/5xx immediate response means the request was rejected (e.g. a bad signature),
	// so the update must not be processed.
	if immediateResponse != nil && immediateResponse.StatusCode >= http.StatusBadRequest {
		writePipeWebhookResponse(c, immediateResponse)
		return
	}

	incoming, err := provider.ParseWebhookRequest(body)
	if err != nil {
		// Acknowledge malformed updates so chat platforms do not keep retrying them.
		c.Ctx.ResponseWriter.WriteHeader(http.StatusOK)
		return
	}
	if incoming == nil {
		writePipeWebhookResponse(c, immediateResponse)
		return
	}

	if immediateResponse != nil {
		writePipeWebhookResponse(c, immediateResponse)
		go sendPipeAnswer(provider, pipeObj, incoming, host, lang, false)
		return
	}

	sendPipeAnswer(provider, pipeObj, incoming, host, lang, false)
	c.Ctx.ResponseWriter.WriteHeader(http.StatusOK)
}

func getImmediatePipeResponse(provider pipepkg.Pipe, body []byte, header http.Header) (*pipepkg.WebhookResponse, error) {
	responder, ok := provider.(pipepkg.ImmediateWebhookResponder)
	if !ok {
		return nil, nil
	}
	return responder.GetWebhookResponse(body, header)
}

func writePipeWebhookResponse(c *ApiController, response *pipepkg.WebhookResponse) {
	if response == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusOK)
		return
	}

	if response.ContentType != "" {
		c.Ctx.Output.Header("Content-Type", response.ContentType)
	}
	statusCode := response.StatusCode
	if statusCode == 0 {
		statusCode = http.StatusOK
	}

	c.Ctx.ResponseWriter.WriteHeader(statusCode)
	if len(response.Body) > 0 {
		_, _ = c.Ctx.ResponseWriter.Write(response.Body)
	}
}

type pipeSSERecorder struct {
	header http.Header
	body   bytes.Buffer
	status int
	sender pipeAnswerSender
}

func newPipeSSERecorder(sender pipeAnswerSender) *pipeSSERecorder {
	return &pipeSSERecorder{header: http.Header{}, status: http.StatusOK, sender: sender}
}

func (r *pipeSSERecorder) Header() http.Header {
	return r.header
}

func (r *pipeSSERecorder) WriteHeader(statusCode int) {
	r.status = statusCode
}

func (r *pipeSSERecorder) Write(p []byte) (int, error) {
	n, err := r.body.Write(p)
	if err != nil {
		return n, err
	}

	if r.sender != nil {
		r.consumeBody()
	}

	return n, nil
}

func (r *pipeSSERecorder) Flush() {}

var sseDelimiter = []byte("\n\n")

func (r *pipeSSERecorder) consumeBody() {
	for {
		buf := r.body.Bytes()
		idx := bytes.Index(buf, sseDelimiter)
		if idx == -1 {
			return
		}

		chunk := string(buf[:idx])
		remaining := make([]byte, len(buf)-idx-2)
		copy(remaining, buf[idx+2:])
		r.body.Reset()
		_, _ = r.body.Write(remaining)

		r.consumeChunk(chunk)
	}
}

func (r *pipeSSERecorder) consumeChunk(chunk string) {
	lines := strings.Split(chunk, "\n")
	if len(lines) == 0 {
		return
	}

	eventType := ""
	if strings.HasPrefix(lines[0], "event: ") {
		eventType = strings.TrimPrefix(lines[0], "event: ")
	}

	switch eventType {
	case "message":
		for _, line := range lines {
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			payload := strings.TrimPrefix(line, "data: ")
			var data map[string]string
			if err := json.Unmarshal([]byte(payload), &data); err == nil && r.sender != nil {
				_ = r.sender.WriteMessage(data["text"])
			}
		}
	case "myerror":
		for _, line := range lines {
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			payload := strings.TrimPrefix(line, "data: ")
			if r.sender != nil {
				_ = r.sender.WriteError(payload)
			}
		}
	}
}

func ensurePipeChat(pipeObj *object.Pipe, incoming *pipepkg.IncomingMessage) (*object.Chat, error) {
	chatName := fmt.Sprintf("pipe_%s_%s", pipeObj.Name, incoming.ChatId)
	chatId := util.GetIdFromOwnerAndName("admin", chatName)
	chat, err := object.GetChat(chatId)
	if err != nil {
		return nil, err
	}
	// Users choose their own chat names, so a chat with this name that the pipe did not create
	// (its user is the chat name) must not receive the pipe's messages.
	if chat != nil && chat.User != chatName {
		return nil, fmt.Errorf("the chat: %s is not a pipe chat", chatId)
	}
	if chat != nil {
		if pipeObj.Store != "" && chat.Store != pipeObj.Store {
			chat.Store = pipeObj.Store
			chat.UpdatedTime = util.GetCurrentTime()
			if _, err = object.UpdateChat(chat.GetId(), chat); err != nil {
				return nil, err
			}
		}
		return chat, nil
	}

	casdoorOrganization := conf.GetConfigString("casdoorOrganization")
	storeName := ""
	if pipeObj.Store != "" {
		storeName = pipeObj.Store
	} else {
		defaultStore, err := object.GetDefaultStore("admin")
		if err != nil {
			return nil, err
		}
		if defaultStore != nil {
			storeName = defaultStore.Name
		}
	}

	currentTime := util.GetCurrentTime()
	chat = &object.Chat{
		Owner:         "admin",
		Name:          chatName,
		CreatedTime:   currentTime,
		UpdatedTime:   currentTime,
		Organization:  casdoorOrganization,
		DisplayName:   incoming.Username,
		Store:         storeName,
		ModelProvider: "",
		Category:      "Pipe",
		User:          chatName,
		ClientIp:      "",
		UserAgent:     fmt.Sprintf("pipe/%s", pipeObj.Type),
		MessageCount:  0,
		IsHidden:      true,
	}
	_, err = object.AddChat(chat)
	if err != nil {
		return nil, err
	}
	return chat, nil
}

func addPipeQuestionAndAnswerMessages(chat *object.Chat, incoming *pipepkg.IncomingMessage) (*object.Message, *object.Message, error) {
	questionMessage := &object.Message{
		Owner:        "admin",
		Name:         fmt.Sprintf("message_%s", util.GetRandomName()),
		CreatedTime:  util.GetCurrentTimeWithMilli(),
		Organization: chat.Organization,
		Store:        chat.Store,
		User:         chat.User,
		Chat:         chat.Name,
		ReplyTo:      "",
		Author:       incoming.Username,
		Text:         incoming.Text,
	}
	if questionMessage.Author == "" {
		questionMessage.Author = incoming.UserId
	}
	if questionMessage.Author == "" {
		questionMessage.Author = "User"
	}

	_, err := object.AddMessage(questionMessage)
	if err != nil {
		return nil, nil, err
	}

	answerMessage := &object.Message{
		Owner:         "admin",
		Name:          fmt.Sprintf("message_%s", util.GetRandomName()),
		CreatedTime:   util.GetCurrentTimeEx(questionMessage.CreatedTime),
		
```

### Core Architecture Module: `controllers/util.go`
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

package controllers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"regexp"
	"strings"

	"github.com/beego/beego/context"
	"github.com/the-open-agent/openagent/auth"
	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/i18n"
	"github.com/the-open-agent/openagent/util"
)

// maxListSize caps the rows returned by list APIs that are called without pagination.
const maxListSize = 1000

type Response struct {
	Status string      `json:"status"`
	Msg    string      `json:"msg"`
	Data   interface{} `json:"data"`
	Data2  interface{} `json:"data2"`
}

func (c *ApiController) ResponseOk(data ...interface{}) {
	resp := Response{Status: "ok"}
	switch len(data) {
	case 2:
		resp.Data2 = data[1]
		fallthrough
	case 1:
		resp.Data = data[0]
	}
	c.Data["json"] = resp
	c.ServeJSON()
}

func (c *ApiController) ResponseError(error string, data ...interface{}) {
	resp := Response{Status: "error", Msg: error}
	switch len(data) {
	case 2:
		resp.Data2 = data[1]
		fallthrough
	case 1:
		resp.Data = data[0]
	}
	c.Data["json"] = resp
	c.ServeJSON()
}

func (c *ApiController) T(error string) string {
	return i18n.Translate(c.GetAcceptLanguage(), error)
}

func (c *ApiController) ResponseAudio(audioData []byte, contentType string, filename string) {
	if contentType == "" {
		contentType = "audio/mp3"
	}
	if filename == "" {
		filename = "audio.mp3"
	}

	c.Ctx.Output.Header("Content-Type", contentType)
	c.Ctx.Output.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	err := c.Ctx.Output.Body(audioData)
	if err != nil {
		responseError(c.Ctx, err.Error())
	}
}

func (c *ApiController) GetAcceptLanguage() string {
	language := c.Ctx.Request.Header.Get("Accept-Language")
	if len(language) > 2 {
		language = language[0:2]
	}
	return conf.GetLanguage(language)
}

func (c *ApiController) RequireSignedIn() (string, bool) {
	userId := c.GetSessionUsername()
	if userId == "" {
		c.ResponseError(c.T("auth:Please sign in first"))
		return "", false
	}
	return userId, true
}

func (c *ApiController) RequireSignedInUser() (*auth.User, bool) {
	user := c.GetSessionUser()
	if user == nil {
		c.ResponseError(c.T("auth:Please sign in first"))
		return nil, false
	}
	return user, true
}

func (c *ApiController) CheckSignedIn() (string, bool) {
	userId := c.GetSessionUsername()
	if userId == "" {
		return "", false
	}
	return userId, true
}

func (c *ApiController) RequireAdmin() bool {
	if !c.IsAdmin() {
		c.ResponseError(c.T("auth:this operation requires admin privilege"))
		return false
	}

	return true
}

// RequireGlobalAdmin rejects store-level admins, which the authz filter otherwise lets through
// as admins. Use it for operations that affect the whole server or can run code on the host.
func (c *ApiController) RequireGlobalAdmin() bool {
	if !c.IsGlobalAdmin() {
		c.ResponseError(c.T("auth:this operation requires admin privilege"))
		return false
	}

	return true
}

// requireSecretNotRedirected rejects a non-global admin's request that reuses a masked secret while
// changing where it is sent, since that would hand them a secret they are not allowed to read.
func (c *ApiController) requireSecretNotRedirected(redirected bool) bool {
	if redirected && !c.IsGlobalAdmin() {
		c.ResponseError(c.T("controllers:Please re-enter the secret when changing where it is sent"))
		return false
	}
	return true
}

func (c *ApiController) IsAdmin() bool {
	user := c.GetSessionUser()
	return util.IsAdmin(user)
}

func (c *ApiController) IsGlobalAdmin() bool {
	user := c.GetSessionUser()
	return util.IsGlobalAdmin(user)
}

func (c *ApiController) IsStoreAdmin() bool {
	user := c.GetSessionUser()
	return util.IsStoreAdmin(user)
}

func DenyRequest(ctx *context.Context) {
	responseError(ctx, "auth:Unauthorized operation")
}

func responseError(ctx *context.Context, error string, data ...interface{}) {
	// Get language from Accept-Language header
	language := ctx.Request.Header.Get("Accept-Language")
	if len(language) > 2 {
		language = language[0:2]
	}
	language = conf.GetLanguage(language)

	// Translate error message if it contains namespace prefix
	translatedError := error
	if strings.Contains(error, ":") {
		translatedError = i18n.Translate(language, error)
	}

	resp := Response{Status: "error", Msg: translatedError}
	switch len(data) {
	case 2:
		resp.Data2 = data[1]
		fallthrough
	case 1:
		resp.Data = data[0]
	}

	err := ctx.Output.JSON(resp, true, false)
	if err != nil {
		panic(err)
	}
}

func isIpAddress(host string) bool {
	// Attempt to split the host and port, ignoring the error
	hostWithoutPort, _, err := net.SplitHostPort(host)
	if err != nil {
		// If an error occurs, it might be because there's no port
		// In that case, use the original host string
		hostWithoutPort = host
	}

	// Attempt to parse the host as an IP address (both IPv4 and IPv6)
	ip := net.ParseIP(hostWithoutPort)
	// if host is not nil is an IP address else is not an IP address
	return ip != nil
}

func getOriginFromHost(host string) string {
	protocol := "https://"
	if !strings.Contains(host, ".") {
		// "localhost:14000"
		protocol = "http://"
	} else if isIpAddress(host) {
		// "192.168.0.10"
		protocol = "http://"
	}

	return fmt.Sprintf("%s%s", protocol, host)
}

func removeHtmlTags(s string) string {
	re := regexp.MustCompile(`<[^>]+>`)
	return re.ReplaceAllString(s, "")
}

func getContentHash(content string) string {
	hasher := sha256.New()
	hasher.Write([]byte(content))

	res := hex.EncodeToString(hasher.Sum(nil))
	res = res[:8]
	return res
}

func (c *ApiController) getClientIp() string {
	res := strings.Replace(util.GetIPFromRequest(c.Ctx.Request), ": ", "", -1)
	return res
}

func (c *ApiController) getUserAgent() string {
	res := c.Ctx.Request.UserAgent()
	return res
}

func (c *ApiController) IsCurrentUser(usernameInput string) bool {
	username := c.GetSessionUsername()
	if !c.IsAdmin() && username != usernameInput {
		c.ResponseError(c.T("auth:Unauthorized operation"))
		return false
	}
	return true
}

```

### Core Architecture Module: `controllers/util_record.go`
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

package controllers

import (
	"fmt"

	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/i18n"
	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
)

func addRecord(c *ApiController, userName string, requestUri string, lang string) error {
	record, err := object.NewRecord(c.Ctx)
	if err != nil {
		return fmt.Errorf(i18n.Translate(lang, "NewRecord() error: %s\n"), err.Error())
	}

	record.User = userName
	if requestUri != "" {
		record.RequestUri = requestUri
	}

	record.Organization = conf.GetConfigString("casdoorOrganization")

	_, _, err = object.AddRecord(record, c.GetAcceptLanguage())
	return err
}

func addRecordForFile(c *ApiController, userName string, action string, sessionId string, key string, filename string, isLeaf bool, lang string) error {
	typ := "Folder"
	if isLeaf {
		typ = "File"
	}

	_, storeName, err := util.GetOwnerAndNameFromIdWithError(sessionId)
	if err != nil {
		return err
	}

	path := fmt.Sprintf("/%s/%s", key, filename)
	if filename == "" {
		path = key
	}

	text := fmt.Sprintf("%s%s, Session: %s, Path: %s", action, typ, storeName, path)
	err = addRecord(c, userName, text, lang)
	return err
}

```

### Core Architecture Module: `embedding/util.go`
```
// Copyright 2024 The OpenAgent Authors. All Rights Reserved.
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

package embedding

import "math"

func getPrice(tokenCount int, pricePerThousandTokens float64) float64 {
	res := (float64(tokenCount) / 1000.0) * pricePerThousandTokens
	res = math.Round(res*1e8) / 1e8
	return res
}

func float64ToFloat32(slice []float64) []float32 {
	newSlice := make([]float32, len(slice))
	for i, v := range slice {
		newSlice[i] = float32(v)
	}
	return newSlice
}

```

### Core Architecture Module: `i18n/util.go`
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

package i18n

import (
	"embed"
	"fmt"
	"strings"

	"github.com/the-open-agent/openagent/util"
)

//go:embed locales/*/data.json
var f embed.FS

var langMap = make(map[string]map[string]map[string]string) // for example : langMap[en][account][Invalid information] = Invalid information

func getI18nFilePath(category string, language string) string {
	if category == "backend" {
		return fmt.Sprintf("../i18n/locales/%s/data.json", language)
	} else {
		return fmt.Sprintf("../web/src/locales/%s/data.json", language)
	}
}

func readI18nFile(category string, language string) *I18nData {
	s := util.ReadStringFromPath(getI18nFilePath(category, language))

	data := &I18nData{}
	err := util.JsonToStruct(s, data)
	if err != nil {
		panic(err)
	}
	return data
}

func writeI18nFile(category string, language string, data *I18nData) {
	s := util.StructToJson(data)
	s = strings.ReplaceAll(s, "\\\\\"", "\"")
	s = strings.ReplaceAll(s, "\\u0026", "&")
	// json.Marshal escapes < > for HTML safety; keep readable arrows like "->" in locale files.
	s = strings.ReplaceAll(s, "\\u003c", "<")
	s = strings.ReplaceAll(s, "\\u003e", ">")
	s += "\n"
	println(s)

	util.WriteStringToPath(s, getI18nFilePath(category, language))
}

func applyData(data1 *I18nData, data2 *I18nData) {
	for namespace, pairs2 := range *data2 {
		if _, ok := (*data1)[namespace]; !ok {
			continue
		}

		pairs1 := (*data1)[namespace]

		for key, value := range pairs2 {
			key = strings.ReplaceAll(key, "\"", "\\\"")
			if _, ok := pairs1[key]; !ok {
				continue
			}

			pairs1[key] = value
		}
	}
}

func Translate(language string, errorText string) string {
	tokens := strings.SplitN(errorText, ":", 2)
	if !strings.Contains(errorText, ":") || len(tokens) != 2 {
		return fmt.Sprintf("Translate error: the error text doesn't contain \":\", errorText = %s", errorText)
	}

	if langMap[language] == nil {
		file, err := f.ReadFile(fmt.Sprintf("locales/%s/data.json", language))
		if err != nil {
			return Translate("en", errorText)
			// return fmt.Sprintf("Translate error: the language \"%s\" is not supported, err = %s", language, err.Error())
		}

		data := I18nData{}
		err = util.JsonToStruct(string(file), &data)
		if err != nil {
			panic(err)
		}
		langMap[language] = data
	}

	res := langMap[language][tokens[0]][tokens[1]]
	if res == "" {
		res = tokens[1]
	}
	return res
}

```

### Core Architecture Module: `mcp/util.go`
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

package mcp

import (
	"errors"
	"strings"
)

func GetServerNameAndToolNameFromId(id string) (string, string) {
	tokens := strings.Split(id, "__")

	if len(tokens) == 1 {
		return "", tokens[0]
	}

	if len(tokens) > 2 {
		panic(errors.New("GetServerNameAndToolNameFromId() error, wrong token count for ID: " + id))
	}

	return tokens[0], tokens[1]
}

func GetIdFromServerNameAndToolName(serverName, toolName string) string {
	return serverName + "__" + toolName
}

```

### Core Architecture Module: `model/context_length_util.go`
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

package model

import "strings"

// deepseek https://api-docs.deepseek.com/quick_start/pricing
// qwen     https://help.aliyun.com/zh/model-studio/models
// kimi     https://platform.kimi.com/docs/models
// ernie    https://ai.baidu.com/ai-doc/WENXINWORKSHOP/Wm9cvy6rl
// cohere   https://docs.cohere.com/docs/models
// doubao   https://www.volcengine.com/docs/82379/1330310
// step     https://platform.stepfun.com/docs/zh/guides/models/overview
// gemini   https://ai.google.dev/gemini-api/docs/models
// hunyuan  https://cloud.tencent.com/document/product/1729/104753
// chatGLM  https://docs.bigmodel.cn/cn/guide/start/model-overview
// claude   https://docs.anthropic.com/en/docs/about-claude/models/overview
// openai   https://developers.openai.com/api/docs/models
// grok     https://docs.x.ai/docs/models
// mistral  https://docs.mistral.ai/getting-started/models/models_overview/
// writer   https://dev.writer.com/home/models
// bedrock  https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html

// getMaxOutputTokens returns the maximum number of output tokens a Claude model accepts.
// This is separate from the context window: the current Claude models all take a 1M token
// context but cap output at 128K (64K on Claude Haiku 4.5).
func getMaxOutputTokens(typ string) int {
	typ = strings.ToLower(typ)
	if strings.Contains(typ, "haiku-4-5") || strings.Contains(typ, "haiku-4.5") {
		return 64000
	}
	return 128000
}

func getContextLength(typ string) int {
	typ = strings.ToLower(typ)
	if strings.Contains(typ, "deepseek") {
		if strings.Contains(typ, "distill") {
			if strings.Contains(typ, "qwen") {
				if strings.Contains(typ, "7b") {
					return 8192
				} else if strings.Contains(typ, "14b") || strings.Contains(typ, "32b") {
					return 32768
				}
				return 4096
			} else if strings.Contains(typ, "llama") {
				if strings.Contains(typ, "8b") || strings.Contains(typ, "70b") {
					return 131072
				}
				return 4096
			}
			return 4096
		} else if strings.Contains(typ, "r1") {
			if strings.Contains(typ, "671b") {
				return 65536
			} else if strings.Contains(typ, "8b") || strings.Contains(typ, "70b") {
				return 131072
			} else if strings.Contains(typ, "7b") {
				return 8192
			} else if strings.Contains(typ, "14b") || strings.Contains(typ, "32b") {
				return 32768
			}
			return 65536
		} else if strings.Contains(typ, "v3.2") || strings.Contains(typ, "v3-2") {
			return 163840
		} else if strings.Contains(typ, "v4") || strings.Contains(typ, "flash") || strings.Contains(typ, "pro") {
			// deepseek-v4-pro and deepseek-flash both take 1M tokens
			return 1000000
		} else if strings.Contains(typ, "v2.5") {
			return 8192
		} else if strings.Contains(typ, "v3") || strings.Contains(typ, "chat") || strings.Contains(typ, "reasoner") {
			return 131072
		}
	} else if strings.Contains(typ, "qwen") {
		if strings.Contains(typ, "qwen-long") {
			return 10000000
		} else if strings.Contains(typ, "qwen3.8") || strings.Contains(typ, "qwen3.7") {
			return 1000000
		} else if strings.Contains(typ, "qwen3.6") || strings.Contains(typ, "qwen3.5") {
			// The commercial models of these series take 1M tokens, the open-source ones take 256K
			if strings.Contains(typ, "plus") || strings.Contains(typ, "flash") || strings.Contains(typ, "omni") {
				return 1000000
			}
			return 262144
		} else if strings.Contains(typ, "qwen3-vl") {
			return 262144
		} else if strings.Contains(typ, "plus") || strings.Contains(typ, "flash") {
			return 1000000
		} else if strings.Contains(typ, "max") {
			return 32768
		} else if strings.Contains(typ, "qwen2.5") {
			if strings.Contains(typ, "instruct") {
				if strings.Contains(typ, "72b") || strings.Contains(typ, "32b") || strings.Contains(typ, "14b") || strings.Contains(typ, "7b") {
					return 131072
				}
				return 4096
			}
			return 4096
		} else if strings.Contains(typ, "qwen3") {
			return 131072
		}
	} else if strings.Contains(typ, "doubao") {
		if strings.Contains(typ, "seed-evolving") || strings.Contains(typ, "seed-2-1-pro-260915") {
			return 1048576
		} else if strings.Contains(typ, "seed-translation") {
			return 4096
		} else if strings.Contains(typ, "seed-character") || strings.Contains(typ, "embedding-vision") {
			return 131072
		} else if strings.Contains(typ, "doubao-seed") {
			// the doubao-seed-2-1 / 2-0 / 1-8 / 1-6 and code-preview series all take 256K
			return 262144
		} else if strings.Contains(typ, "1-5-pro-32k-character") || strings.Contains(typ, "1.5-pro-32k-character") {
			return 32768
		} else if strings.Contains(typ, "1-5-pro-32k") || strings.Contains(typ, "1.5-pro-32k") {
			return 131072
		} else if strings.Contains(typ, "1-5") || strings.Contains(typ, "1.5") {
			return 32768
		} else if strings.Contains(typ, "256k") {
			return 262144
		} else if strings.Contains(typ, "128k") {
			return 131072
		} else if strings.Contains(typ, "32k") {
			return 32768
		}
	} else if strings.Contains(typ, "gemini") {
		if strings.Contains(typ, "embedding") {
			return 2048
		}
		// the Gemini 3.x and 2.5 families all take a 1M token context
		return 1048576
	} else if strings.Contains(typ, "claude") {
		if strings.Contains(typ, "haiku-4-5") || strings.Contains(typ, "haiku-4.5") {
			return 200000
		}
		// Claude Fable 5/5.1, Opus 5/4.8/4.7/4.6 and Sonnet 5/4.6 all take a 1M token context
		return 1000000
	} else if strings.Contains(typ, "grok") {
		if strings.Contains(typ, "grok-4.6") || strings.Contains(typ, "grok-4.5") {
			return 500000
		} else if strings.Contains(typ, "grok-build") {
			return 262144
		}
		// grok-4.3 and the grok-4.20 series take 1M tokens
		return 1000000
	} else if strings.Contains(typ, "hunyuan") {
		if strings.Contains(typ, "a13b") {
			return 229376
		} else if strings.Contains(typ, "t1-vision") || strings.Contains(typ, "role") {
			return 28672
		} else if strings.Contains(typ, "vision") {
			return 24576
		} else if strings.Contains(typ, "translation") {
			return 4096
		}
		return 4096
	} else if strings.Contains(typ, "step") {
		if strings.Contains(typ, "step-3") {
			return 262144
		} else if strings.Contains(typ, "vision") {
			return 32768
		}
		return 4096
	} else if strings.Contains(typ, "gpt") || strings.HasPrefix(typ, "o") || strings.Contains(typ, "rosalind") || strings.Contains(typ, "daybreak") || typ == "chat-latest" {
		if strings.Contains(typ, "gpt-oss") {
			return 131072
		} else if strings.Contains(typ, "curie") {
			return 2048
		} else if strings.Contains(typ, "3.5") {
			if strings.Contains(typ, "turbo") {
				return 16385
			}
			return 2048
		} else if strings.Contains(typ, "o4") {
			return 100000
		} else if strings.Contains(typ, "o3") {
			return 100000
		} else if strings.Contains(typ, "o1") {
			return 128000
		} else if strings.Contains(typ, "gpt-6") || strings.Contains(typ, "5.6") || strings.Contains(typ, "5.5") {
			return 1050000
		} else if strings.Contains(typ, "5.4") || strings.Contains(typ, "5.3") || strings.Contains(typ, "5.2") || strings.Contains(typ, "5.1") || strings.Contains(typ, "gpt-5") {
			return 400000
		} else if strings.Contains(typ, "rosalind") || strings.Contains(typ, "daybreak") || typ == "chat-latest" {
			return 400000
		} else if strings.Contains(typ, "4o") {
			return 128000
		} else if strings.Contains(typ, "4.1") {
			return 100000
		} else if strings.Contains(typ, "turbo") {
			return 128000
		} else if strings.Contains(typ, "4") {
			return 8192
		}
		return 2048
	} else if strings.Contains(typ, "dummy") {
		return 4096
	} else if strings.Contains(typ, "nova") {
		if strings.Contains(typ, "nova-2") || strings.Contains(typ, "premier") {
			return 1000000
		} else if strings.Contains(typ, "micro") {
			return 128000
		}
		return 300000
	} else if strings.Contains(typ, "mistral") || strings.Contains(typ, "ministral") || strings.Contains(typ, "codestral") {
		if strings.Contains(typ, "ministral") {
			return 131072
		} else if strings.Contains(typ, "2512") || strings.Contains(typ, "2603") || strings.Contains(typ, "2604") || strings.Contains(typ, "2508") || strings.Contains(typ, "large-3") {
			return 262144
		}
		return 131072
	} else if strings.Contains(typ, "palmyra") {
		if strings.Contains(typ, "x4") {
			return 131072
		}
		return 1000000
	} else if strings.Contains(typ, "baichuan") {
		if strings.Contains(typ, "128k") {
			return 131072
		} else if strings.Contains(typ, "baichuan4") || strings.Contains(typ, "baichuan-m") {
			return 32768
		}
		return 8192
	} else if strings.Contains(typ, "minimax") {
		if strings.Contains(typ, "m3") {
			return 1048576
		}
		return 204800
	} else if strings.Contains(typ, "llama") {
		if strings.Contains(typ, "llama4") || strings.Contains(typ, "llama-4") {
			return 1048576
		} else if strings.Contains(typ, "3.3") || strings.Contains(typ, "llama3-3") ||
			strings.Contains(typ, "3.2") || strings.Contains(typ, "llama3-2") ||
			strings.Contains(typ, "3.1") || strings.Contains(typ, "llama3-1") {
			return 131072
		} else if strings.Contains(typ, "2") {
			return 4096
		}
		return 8192
	} else if strings.Contains(typ, "ernie") {
		if strings.Contains(typ, "8k") {
			return 8192
		} else if strings.Contains(typ, "128k") {
			return 131072
		}
	} else if strings.Contains(typ, "spark") {
		if strings.Contains(typ, "pro-128k") || strings.Contains(typ, "128k") {
			return 131072
		} else if strings.Contains(typ, "x2") {
			return 65536

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

### Incident Patch 1: `ba604e41` (2026-10-05)
**Commit Message**: fix: fall back to shared casibase folder for runtime files

**File**: `conf/util.go` (modified, +14/-0)
```diff
@@ -26,6 +26,20 @@ func FileExist(path string) bool {
 	return true
 }
 
+func GetSharedPath(path string) string {
+	if FileExist(path) {
+		return path
+	}
+
+	for _, dir := range []string{FrontendBaseDir, filepath.Join(filepath.Dir(FrontendBaseDir), "casibase")} {
+		res := filepath.Join(dir, path)
+		if FileExist(res) {
+			return res
+		}
+	}
+	return path
+}
+
 func ReadStringFromPath(path string) string {
 	data, err := os.ReadFile(filepath.Clean(path))
 	if err != nil {
```

**File**: `internal/localocr/manager.go` (modified, +6/-0)
```diff
@@ -33,6 +33,7 @@ import (
 	"time"
 
 	"github.com/beego/beego/logs"
+	"github.com/the-open-agent/openagent/conf"
 	"github.com/the-open-agent/openagent/embedsupport"
 )
 
@@ -71,6 +72,11 @@ var (
 func NewManager(rootDir string) *Manager {
 	stateDir := filepath.Join(rootDir, "tmp", "ocr-service")
 	serviceDir := filepath.Join(rootDir, "deploy", "ocr-service")
+	if !conf.FileExist(serviceDir) {
+		if shared := conf.GetSharedPath(filepath.Join("deploy", "ocr-service")); conf.FileExist(shared) {
+			serviceDir, _ = filepath.Abs(shared)
+		}
+	}
 	return &Manager{
 		rootDir:       rootDir,
 		serviceDir:    serviceDir,
```

**File**: `main.go` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ func main() {
 	go object.InitNotificationSender()
 	controllers.InitWeixinClawPipeMonitors()
 
-	beego.SetStaticPath("/swagger", "swagger")
+	beego.SetStaticPath("/swagger", conf.GetSharedPath("swagger"))
 	beego.InsertFilter("*", beego.BeforeStatic, routers.BodyLimitFilter)
 	beego.InsertFilter("*", beego.BeforeRouter, routers.CorsFilter)
 	beego.InsertFilter("*", beego.BeforeRouter, routers.EndpointFilter)
```

**File**: `object/init.go` (modified, +1/-1)
```diff
@@ -341,7 +341,7 @@ func findSkillsDir() string {
 
 	// 2. Current working directory (development: go run .)
 	if cwd, err := os.Getwd(); err == nil {
-		candidate := filepath.Join(cwd, "skills")
+		candidate := filepath.Join(cwd, conf.GetSharedPath("skills"))
 		if _, err2 := os.Stat(candidate); err2 == nil {
 			return candidate
 		}
```

**File**: `routers/static_filter.go` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ func StaticFilter(ctx *context.Context) {
 	}
 
 	if strings.HasPrefix(urlPath, "/swagger") {
-		if !util.FileExist(filepath.Join("swagger", "index.html")) {
+		if !util.FileExist(filepath.Join(conf.GetSharedPath("swagger"), "index.html")) {
 			target := urlPath
 			if target == "/swagger" || target == "/swagger/" {
 				target = "/swagger/index.html"
```

**File**: `tool/office_ppt_write.go` (modified, +3/-2)
```diff
@@ -26,6 +26,7 @@ import (
 	"strings"
 
 	"github.com/ThinkInAIXYZ/go-mcp/protocol"
+	"github.com/the-open-agent/openagent/conf"
 	"github.com/the-open-agent/openagent/embedsupport"
 )
 
@@ -225,9 +226,9 @@ func findPptxWorkerPath(ctx context.Context) (string, error) {
 		)
 	}
 	candidates = append(candidates,
-		pptxWorkerCandidate{path: filepath.Join("tool", "pptx-worker", "worker.mjs"), requireNodeModules: true},
+		pptxWorkerCandidate{path: conf.GetSharedPath(filepath.Join("tool", "pptx-worker", "worker.mjs")), requireNodeModules: true},
 		pptxWorkerCandidate{path: filepath.Join("pptx-worker", "worker.mjs"), requireNodeModules: true},
-		pptxWorkerCandidate{path: filepath.Join("tool", "pptx-worker", "worker.bundle.mjs")},
+		pptxWorkerCandidate{path: conf.GetSharedPath(filepath.Join("tool", "pptx-worker", "worker.bundle.mjs"))},
 		pptxWorkerCandidate{path: filepath.Join("pptx-worker", "worker.bundle.mjs")},
 	)
 
```

**File**: `util/ip.go` (modified, +2/-1)
```diff
@@ -22,6 +22,7 @@ import (
 	"strings"
 
 	"github.com/beego/beego"
+	"github.com/the-open-agent/openagent/conf"
 )
 
 // ipParsingMode holds the resolved config string: "" = disabled, "17monipdb" = 17monipdb, "MaxMind GeoIP2" = MaxMind.
@@ -30,7 +31,7 @@ var ipParsingMode string
 // tryInitLocalDb tries to initialize the local IP database from different paths.
 // Returns (found, error): found=false means the data file doesn't exist (caller should skip silently).
 func tryInitLocalDb() (bool, error) {
-	err := Init("data/17monipdb.dat")
+	err := Init(conf.GetSharedPath("data/17monipdb.dat"))
 	if err == nil {
 		return true, nil
 	}
```

**File**: `util/useragent.go` (modified, +2/-1)
```diff
@@ -19,6 +19,7 @@ import (
 	"os"
 	"path/filepath"
 
+	"github.com/the-open-agent/openagent/conf"
 	"github.com/ua-parser/uap-go/uaparser"
 )
 
@@ -27,7 +28,7 @@ var Parser *uaparser.Parser
 func InitParser() {
 	candidates := []string{
 		"../data/regexes.yaml",
-		"data/regexes.yaml",
+		conf.GetSharedPath("data/regexes.yaml"),
 		"../../data/regexes.yaml",
 	}
 	if exe, err := os.Executable(); err == nil {
```

---

### Incident Patch 2: `2b998019` (2026-10-05)
**Commit Message**: fix: keep per-site files in the working dir when the binary is shared

**File**: `audit/audit.go` (modified, +5/-0)
```diff
@@ -30,6 +30,8 @@ import (
 	"strings"
 	"sync"
 	"time"
+
+	"github.com/the-open-agent/openagent/embedsupport"
 )
 
 const timeFormat = "2006-01-02T15:04:05.000Z07:00"
@@ -149,6 +151,9 @@ func auditDir() string {
 	if override := strings.TrimSpace(os.Getenv("OPENAGENT_AUDIT_DIR")); override != "" {
 		return override
 	}
+	if dir, isExeDir := embedsupport.AppDir(); !isExeDir {
+		return filepath.Join(dir, "logs", "audit")
+	}
 	exe, err := os.Executable()
 	if err != nil {
 		return "audit"
```

**File**: `embedsupport/conf.go` (modified, +22/-0)
```diff
@@ -86,3 +86,25 @@ func confSearchPaths() []string {
 	}
 	return paths
 }
+
+// AppDir returns the directory of conf/app.conf (the executable's one if none),
+// so a binary shared by several sites uses each site's own directory.
+func AppDir() (dir string, isExeDir bool) {
+	exeDir := ""
+	if exePath, err := os.Executable(); err == nil {
+		exeDir = filepath.Dir(exePath)
+		if _, err = os.Stat(filepath.Join(exeDir, "conf", "app.conf")); err == nil {
+			return exeDir, true
+		}
+	}
+	cwd, err := os.Getwd()
+	if err == nil {
+		if _, err = os.Stat(filepath.Join(cwd, "conf", "app.conf")); err == nil {
+			return cwd, false
+		}
+	}
+	if exeDir != "" {
+		return exeDir, true
+	}
+	return cwd, false
+}
```

**File**: `internal/localocr/manager.go` (modified, +4/-14)
```diff
@@ -117,13 +117,13 @@ func StopManaged() {
 }
 
 func Start(ctx context.Context) (*Manager, error) {
-	rootDir, err := executableDir()
-	if err != nil {
-		return nil, err
+	rootDir, _ := embedsupport.AppDir()
+	if rootDir == "" {
+		return nil, fmt.Errorf("cannot locate the OpenAgent directory for the local OCR service")
 	}
 
 	manager := NewManager(rootDir)
-	if err = manager.Start(ctx); err != nil {
+	if err := manager.Start(ctx); err != nil {
 		manager.Stop()
 		return nil, err
 	}
@@ -425,16 +425,6 @@ func freePort() (int, error) {
 	return address.Port, nil
 }
 
-// executableDir returns the directory that contains the running binary.
-// It prefers os.Executable (reliable regardless of working directory) and
-// falls back to os.Getwd so that `go run` and tests still work.
-func executableDir() (string, error) {
-	if exe, err := os.Executable(); err == nil {
-		return filepath.Dir(exe), nil
-	}
-	return os.Getwd()
-}
-
 type localOcrLogWriter struct{}
 
 func (w localOcrLogWriter) Write(p []byte) (int, error) {
```

**File**: `util/system.go` (modified, +12/-10)
```diff
@@ -32,6 +32,7 @@ import (
 	"github.com/shirou/gopsutil/v3/disk"
 	"github.com/shirou/gopsutil/v3/mem"
 	"github.com/shirou/gopsutil/v3/process"
+	"github.com/the-open-agent/openagent/embedsupport"
 	"github.com/the-open-agent/openagent/internal/cli"
 )
 
@@ -81,12 +82,17 @@ func getMemoryUsage() (uint64, uint64, error) {
 	return memInfo.RSS, virtualMem.Total, nil
 }
 
+func getRootPath() string {
+	if dir, isExeDir := embedsupport.AppDir(); !isExeDir {
+		return dir
+	}
+	_, filename, _, _ := runtime.Caller(0)
+	return path.Dir(path.Dir(filename))
+}
+
 // getDiskUsage gets disk usage for OpenAgent's data directory
 func getDiskUsage() (uint64, uint64, error) {
-	// Get the root path of the project
-	_, filename, _, _ := runtime.Caller(0)
-	rootPath := path.Dir(path.Dir(filename))
-	dataPath := filepath.Join(rootPath, "data")
+	dataPath := filepath.Join(getRootPath(), "data")
 
 	// Calculate directory size recursively
 	var size uint64
@@ -176,9 +182,7 @@ func GetVersionInfo() (*VersionInfo, error) {
 		CommitOffset: -1,
 	}
 
-	_, filename, _, _ := runtime.Caller(0)
-	rootPath := path.Dir(path.Dir(filename))
-	r, err := git.PlainOpen(rootPath)
+	r, err := git.PlainOpen(getRootPath())
 	if err != nil {
 		return res, err
 	}
@@ -285,9 +289,7 @@ func GetVersionInfoFromFile() (*VersionInfo, error) {
 		CommitOffset: -1,
 	}
 
-	_, filename, _, _ := runtime.Caller(0)
-	rootPath := path.Dir(path.Dir(filename))
-	file, err := os.Open(filepath.Clean(path.Join(rootPath, "version_info.txt")))
+	file, err := os.Open(filepath.Clean(path.Join(getRootPath(), "version_info.txt")))
 	if err != nil {
 		return res, err
 	}
```

---

### Incident Patch 3: `c9a8fca7` (2026-10-01)
**Commit Message**: fix: reject empty store name on add and update

**File**: `controllers/store.go` (modified, +10/-0)
```diff
@@ -254,6 +254,11 @@ func (c *ApiController) UpdateStore() {
 		return
 	}
 
+	if strings.TrimSpace(store.Name) == "" {
+		c.ResponseError(c.T("store:The store name cannot be empty"))
+		return
+	}
+
 	oldStore, err := object.GetStore(id)
 	if err != nil {
 		c.ResponseError(err.Error())
@@ -393,6 +398,11 @@ func (c *ApiController) AddStore() {
 		return
 	}
 
+	if strings.TrimSpace(store.Name) == "" {
+		c.ResponseError(c.T("store:The store name cannot be empty"))
+		return
+	}
+
 	if !c.IsGlobalAdmin() && c.IsStoreAdmin() {
 		store.Owner = c.GetSessionUsername()
 	}
```

**File**: `i18n/locales/en/data.json` (modified, +1/-0)
```diff
@@ -225,6 +225,7 @@
     "Cannot delete the default store": "Cannot delete the default store",
     "Only the super admin can publish an agent directly. Please set the publish state to Pending Review instead": "Only the super admin can publish an agent directly. Please set the publish state to Pending Review instead",
     "The agent does not exist": "The agent does not exist",
+    "The store name cannot be empty": "The store name cannot be empty",
     "You can only set the publish state to Private or Pending Review": "You can only set the publish state to Private or Pending Review",
     "You cannot fork your own agent": "You cannot fork your own agent",
     "You have already forked this agent": "You have already forked this agent",
```

**File**: `i18n/locales/zh/data.json` (modified, +1/-0)
```diff
@@ -225,6 +225,7 @@
     "Cannot delete the default store": "无法删除默认存储库",
     "Only the super admin can publish an agent directly. Please set the publish state to Pending Review instead": "只有超级管理员才能直接将状态设置为已发布，请改为设置成待审核状态",
     "The agent does not exist": "智能体不存在",
+    "The store name cannot be empty": "存储库名称不能为空",
     "You can only set the publish state to Private or Pending Review": "您只能将状态设置为私有或待审核",
     "You cannot fork your own agent": "无法复刻自己的智能体",
     "You have already forked this agent": "你已经复刻过这个智能体了",
```

**File**: `web/src/StoreEditPage.js` (modified, +10/-0)
```diff
@@ -309,6 +309,11 @@ class StoreEditPage extends React.Component {
 
   setPublishState(newState) {
     const store = Setting.deepCopy(this.state.store);
+    if (!store.name || store.name.trim() === "") {
+      Setting.showMessage("error", i18next.t("store:Name cannot be empty"));
+      return;
+    }
+
     store.publishState = newState;
     store.fileTree = undefined;
     StoreBackend.updateStore(this.state.owner, this.state.storeName, store)
@@ -1019,6 +1024,11 @@ class StoreEditPage extends React.Component {
       store = storeParam;
     }
 
+    if (!store.name || store.name.trim() === "") {
+      Setting.showMessage("error", i18next.t("store:Name cannot be empty"));
+      return;
+    }
+
     const basePath = this.props.basePath || "/stores";
     store.fileTree = undefined;
     StoreBackend.updateStore(this.state.owner, this.state.storeName, store)
```

**File**: `web/src/locales/en/data.json` (modified, +1/-0)
```diff
@@ -1001,6 +1001,7 @@
     "Messages scanned": "Messages scanned",
     "Min frequency": "Min frequency",
     "Move": "Move",
+    "Name cannot be empty": "Name cannot be empty",
     "Navbar items": "Navbar items",
     "Navbar items - Tooltip": "Navigation bar menu items configuration",
     "New folder": "New folder",
```

**File**: `web/src/locales/zh/data.json` (modified, +1/-0)
```diff
@@ -1001,6 +1001,7 @@
     "Messages scanned": "已扫描消息数",
     "Min frequency": "最小词频",
     "Move": "移动",
+    "Name cannot be empty": "ID不能为空",
     "Navbar items": "导航栏项",
     "Navbar items - Tooltip": "导航栏菜单项配置",
     "New folder": "新建文件夹",
```

---

### Incident Patch 4: `fb2f8a6b` (2026-09-29)
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

### Incident Patch 5: `16256942` (2026-09-28)
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

### Incident Patch 6: `1da53c58` (2026-09-27)
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

**File**: `controllers/signin.go` (modified, +4/-1)
```diff
@@ -192,7 +192,10 @@ func (c *ApiController) signinWithPassword() {
 		return
 	}
 
-	c.SetSessionClaims(claims)
+	if err = c.startUserSession(claims); err != nil {
+		c.ResponseError(err.Error())
+		return
+	}
 	userId := util.GetIdFromOwnerAndName(claims.User.Owner, claims.User.Name)
 	c.Ctx.Input.SetParam("recordUserId", userId)
 
```

**File**: `controllers/site.go` (modified, +5/-0)
```diff
@@ -166,6 +166,11 @@ func (c *ApiController) AddSite() {
 		return
 	}
 
+	if site.Owner == "" || site.Name == "" {
+		c.ResponseError(c.T("application:Missing required parameters"))
+		return
+	}
+
 	success, err := object.AddSite(&site)
 	if err != nil {
 		c.ResponseError(err.Error())
```

**File**: `controllers/system_info.go` (modified, +29/-1)
```diff
@@ -15,9 +15,37 @@
 package controllers
 
 import (
+	"sync"
+	"time"
+
 	"github.com/the-open-agent/openagent/util"
 )
 
+const systemInfoCacheDuration = 5 * time.Second
+
+var (
+	systemInfoMutex     sync.Mutex
+	systemInfoCache     *util.SystemInfo
+	systemInfoCacheTime time.Time
+)
+
+func getCachedSystemInfo() (*util.SystemInfo, error) {
+	systemInfoMutex.Lock()
+	defer systemInfoMutex.Unlock()
+
+	if systemInfoCache != nil && time.Since(systemInfoCacheTime) < systemInfoCacheDuration {
+		return systemInfoCache, nil
+	}
+
+	systemInfo, err := util.GetSystemInfo()
+	if err != nil {
+		return nil, err
+	}
+	systemInfoCache = systemInfo
+	systemInfoCacheTime = time.Now()
+	return systemInfo, nil
+}
+
 // GetSystemInfo
 // @Title GetSystemInfo
 // @Tag System API
@@ -29,7 +57,7 @@ func (c *ApiController) GetSystemInfo() {
 		return
 	}
 
-	systemInfo, err := util.GetSystemInfo()
+	systemInfo, err := getCachedSystemInfo()
 	if err != nil {
 		c.ResponseError(err.Error())
 		return
```

---

### Incident Patch 7: `94571aac` (2026-09-27)
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
+p, store-admin, *, /api/get-session, deny
+p, store-admin, *, /api/update-session, deny
+p, store-admin, *, /api/add-session, deny
+p, store-admin, *, /api/delete-session, deny
+p, store-admin, *, /api/get-snapshots, deny
+p, store-admin, *, /api/get-snapshot, deny
+p, store-admin, *, /api/rollback-snapshot, deny
+p, store-admin, *, /api/get-migration-sources, deny
+p, store-admin, *, /api/upload-migration-file, deny
+p, store-admin, *, /api/preview-migration, deny
+p, store-admin, *, /api/start-migration, deny
+p, store-admin, *, /api/get-migration-progress, deny
+p, store-admin, *, /api/get-migrations, deny
+p, store-admin, *, /api/get-migration, deny
+p, store-admin, *, /api/rollback-migration, deny
+p, store-admin, *, /api/update-permission, deny
+p, store-admin, *, /api/add-permission, deny
+p, store-admin, *, /api/delete-permission, deny
+p, store-admin, *, /api/get-records, deny
+p, store-admin, *, /api/get-record, deny
+p, store-admin, *, /api/update-record, deny
+p, store-admin, *, /api/add-
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
+	mimeType, ok := getResourceImageMimeType(ext, fileBytes)
+	if !ok {
+		c.ResponseError(c.T("resource:Only image files (PNG, JPEG, GIF, WebP, BMP, ICO) can be uploaded"))
 		return
 	}
-	mimeType := header.Header.Get("Content-Type")
-	if mimeType == "" {
-		mimeType = mime.TypeByExtension(ext)
-	}
-	fileTypeParts := strings.SplitN(mimeType, "/", 2)
-	fileType := "unknown"
-	if len(fileTypeParts) > 0 {
-		fileType = fileTypeParts[0]
-	}
+	fileType := strings.SplitN(mimeType, "/", 2)[0]
 
-	fullFilePath := fmt.Sprintf("openagent/resources/%s/%s/%s", category, userName, fileName)
+	storedFileName := fmt.Sprintf("%s%s", util.GetRandomName(), ext)
+	fullFilePath := fmt.Sprintf("openagent/resources/%s/%s/%s", category, userName, storedFileName)
 
 	host := c.Ctx.Request.Host
 	origin := getOriginFromHost(host)
```

**File**: `controllers/session.go` (modified, +14/-4)
```diff
@@ -50,7 +50,7 @@ func (c *ApiController) GetSessions() {
 			return
 		}
 
-		c.ResponseOk(sessions)
+		c.ResponseOk(object.GetMaskedSessions(sessions))
 	} else {
 		limit := util.ParseInt(limit)
 		count, err := object.GetSessionCount(owner, field, value)
@@ -65,7 +65,7 @@ func (c *ApiController) GetSessions() {
 			return
 		}
 
-		c.ResponseOk(sessions, paginator.Nums())
+		c.ResponseOk(object.GetMaskedSessions(sessions), paginator.Nums())
 	}
 }
 
@@ -90,7 +90,7 @@ func (c *ApiController) GetSingleSession() {
 		return
 	}
 
-	c.ResponseOk(session)
+	c.ResponseOk(object.GetMaskedSession(session))
 }
 
 // UpdateSession
@@ -113,7 +113,17 @@ func (c *ApiController) UpdateSession() {
 		return
 	}
 
-	c.Data["json"] = wrapActionResponse(object.UpdateSession(util.GetIdFromOwnerAndName(session.Owner, session.Name), &session))
+	id := util.GetIdFromOwnerAndName(session.Owner, session.Name)
+	oldSession, err := object.GetSession(id)
+	if err != nil {
+		c.ResponseError(err.Error())
+		return
+	}
+	if oldSession != nil {
+		session.SessionId = oldSession.SessionId
+	}
+
+	c.Data["json"] = wrapActionResponse(object.UpdateSession(id, &session))
 	c.ServeJSON()
 }
 
```

**File**: `controllers/signin.go` (modified, +2/-2)
```diff
@@ -145,7 +145,7 @@ func (c *ApiController) UpdateAccount() {
 
 	user := accountUser.ToCasdoorUser()
 	c.SetSessionUser(&user)
-	c.ResponseOk(user)
+	c.ResponseOk(getSanitizedUser(user))
 }
 
 func (c *ApiController) signinWithPassword() {
@@ -207,5 +207,5 @@ func (c *ApiController) signinWithPassword() {
 		object.AddSession(session)
 	}
 
-	c.ResponseOk(claims)
+	c.ResponseOk(getSanitizedClaims(claims))
 }
```

**File**: `controllers/site.go` (modified, +8/-0)
```diff
@@ -98,6 +98,14 @@ func (c *ApiController) GetBuiltInSite() {
 		return
 	}
 
+	if site != nil && !c.IsGlobalAdmin() {
+		site.ParentDbName = ""
+		site.HubDbNames = ""
+		site.Socks5Proxy = ""
+		site.LogConfig = ""
+		site.IpParsingMode = ""
+	}
+
 	c.ResponseOk(site)
 }
 
```

---

### Incident Patch 8: `f28b0354` (2026-09-27)
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

**File**: `controllers/message.go` (modified, +12/-0)
```diff
@@ -75,6 +75,11 @@ func (c *ApiController) GetGlobalMessages() {
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
@@ -318,6 +323,13 @@ func (c *ApiController) UpdateMessage() {
 		return
 	}
 	preserveMessageOwnership(&message, persistedMessage)
+	if !c.IsAdmin() {
+		// ReplyTo picks the question that an answer (and its notification email) is built from, so a
+		// user repointing it could read any other user's message; the notification is admin-only.
+		message.Author = persistedMessage.Author
+		message.ReplyTo = persistedMessage.ReplyTo
+		message.NeedNotify = false
+	}
 
 	if message.NeedNotify {
 		if conf.IsCasdoorAvailable() {
```

**File**: `controllers/message_answer.go` (modified, +9/-0)
```diff
@@ -259,6 +259,11 @@ func generateMessageAnswer(id string, responseWriter http.ResponseWriter, host s
 			responseErrorStream(message, fmt.Sprintf("The message: %s is not found", id))
 			return
 		}
+		// Only answer a question from the same chat, never another user's message.
+		if questionMessage.Owner != message.Owner || questionMessage.Chat != message.Chat {
+			responseErrorStream(message, fmt.Sprintf("The message: %s is not found", id))
+			return
+		}
 
 		question = questionMessage.Text
 	}
@@ -680,6 +685,10 @@ func (c *ApiController) GetAnswer() {
 		c.ResponseError(err.Error())
 		return
 	}
+	// The chat name comes from the request, so it may name another user's chat.
+	if chat != nil && !c.requireUserDataAccess(chat.User, chat.Store) {
+		return
+	}
 	if chat == nil {
 		casdoorOrganization := conf.GetConfigString("casdoorOrganization")
 		currentTime := util.GetCurrentTime()
```

**File**: `controllers/permission.go` (modified, +25/-1)
```diff
@@ -80,6 +80,12 @@ func (c *ApiController) GetPermission() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /update-permission [post]
 func (c *ApiController) UpdatePermission() {
+	// Permissions are written to Casdoor with the application's credentials, so store-level
+	// admins must not manage them.
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	if !conf.IsCasdoorAvailable() {
 		c.ResponseOk(true)
 		return
@@ -88,8 +94,10 @@ func (c *ApiController) UpdatePermission() {
 	var permission auth.Permission
 	err := json.Unmarshal(c.Ctx.Input.RequestBody, &permission)
 	if err != nil {
-		panic(err)
+		c.ResponseError(err.Error())
+		return
 	}
+	permission.Owner = conf.GetConfigString("casdoorOrganization")
 
 	success, err := auth.UpdatePermission(&permission)
 	if err != nil {
@@ -108,6 +116,12 @@ func (c *ApiController) UpdatePermission() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /add-permission [post]
 func (c *ApiController) AddPermission() {
+	// Permissions are written to Casdoor with the application's credentials, so store-level
+	// admins must not manage them.
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	if !conf.IsCasdoorAvailable() {
 		c.ResponseOk(true)
 		return
@@ -119,6 +133,8 @@ func (c *ApiController) AddPermission() {
 		c.ResponseError(err.Error())
 		return
 	}
+	// The application credentials reach every organization in Casdoor, so keep writes in our own.
+	permission.Owner = conf.GetConfigString("casdoorOrganization")
 
 	success, err := auth.AddPermission(&permission)
 	if err != nil {
@@ -137,6 +153,12 @@ func (c *ApiController) AddPermission() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /delete-permission [post]
 func (c *ApiController) DeletePermission() {
+	// Permissions are written to Casdoor with the application's credentials, so store-level
+	// admins must not manage them.
+	if !c.RequireGlobalAdmin() {
+		return
+	}
+
 	if !conf.IsCasdoorAvailable() {
 		c.ResponseOk(true)
 		return
@@ -148,6 +170,8 @@ func (c *ApiController) DeletePermission() {
 		c.ResponseError(err.Error())
 		return
 	}
+	// The application credentials reach every organization in Casdoor, so keep writes in our own.
+	permission.Owner = conf.GetConfigString("casdoorOrganization")
 
 	success, err := auth.DeletePermission(&permission)
 	if err != nil {
```

---

### Incident Patch 9: `2abfe36f` (2026-09-27)
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

**File**: `controllers/provider.go` (modified, +41/-0)
```diff
@@ -24,6 +24,22 @@ import (
 	"github.com/the-open-agent/openagent/util"
 )
 
+const localFileSystemStorageType = "Local File System"
+
+// requireProviderWritePermission stops store-level admins from pointing a storage provider at an
+// arbitrary host folder (which /storage would then serve to anyone), and from redirecting a provider
+// while reusing a masked secret, which would send that secret to an endpoint of their choosing.
+func (c *ApiController) requireProviderWritePermission(provider *object.Provider, oldProvider *object.Provider) bool {
+	if c.IsGlobalAdmin() {
+		return true
+	}
+	if provider.Type == localFileSystemStorageType || (oldProvider != nil && oldProvider.Type == localFileSystemStorageType) {
+		c.ResponseError(c.T("controllers:Only the global admin can configure local file system storage"))
+		return false
+	}
+	return c.requireSecretNotRedirected(provider.KeepsMaskedSecretWithNewEndpoint(oldProvider))
+}
+
 // GetGlobalProviders
 // @Title GetGlobalProviders
 // @Tag Provider API
@@ -140,6 +156,15 @@ func (c *ApiController) UpdateProvider() {
 		return
 	}
 
+	oldProvider, err := object.GetProvider(id)
+	if err != nil {
+		c.ResponseError(err.Error())
+		return
+	}
+	if !c.requireProviderWritePermission(&provider, oldProvider) {
+		return
+	}
+
 	success, err := object.UpdateProvider(id, &provider)
 	if err != nil {
 		c.ResponseError(err.Error())
@@ -164,6 +189,10 @@ func (c *ApiController) AddProvider() {
 		return
 	}
 
+	if !c.requireProviderWritePermission(&provider, nil) {
+		return
+	}
+
 	provider.Owner = "admin"
 	success, err := object.AddProvider(&provider)
 	if err != nil {
@@ -189,6 +218,15 @@ func (c *ApiController) DeleteProvider() {
 		return
 	}
 
+	oldProvider, err := object.GetProvider(provider.GetId())
+	if err != nil {
+		c.ResponseError(err.Error())
+		return
+	}
+	if oldProvider != nil && !c.requireProviderWritePermission(oldProvider, oldProvider) {
+		return
+	}
+
 	success, err := object.DeleteProvider(&provider)
 	if err != nil {
 		c.ResponseError(err.Error())
@@ -220,6 +258,9 @@ func (c *ApiController) FetchProviderModels() {
 	if provider.ClientSecret == "***" || provider.ExternalApiKey == "***" {
 		dbProvider, err := object.GetProvider(fmt.Sprintf("%s/%s", provider.Owner, provider.Name))
 		if err == nil && dbProvider != nil {
+			if !c.requireSecretNotRedirected(provider.KeepsMaskedSecretWithNewEndpoint(dbProvider)) {
+				return
+			}
 			if provider.ClientSecret == "***" {
 				provider.ClientSecret = dbProvider.ClientSecret
 			}
```

**File**: `controllers/record.go` (modified, +3/-0)
```diff
@@ -47,6 +47,7 @@ func (c *ApiController) GetRecords() {
 			return
 		}
 
+		object.RedactRecordSecrets(records...)
 		c.ResponseOk(records)
 	} else {
 		limit, err := util.ParseIntWithError(limit)
@@ -68,6 +69,7 @@ func (c *ApiController) GetRecords() {
 			return
 		}
 
+		object.RedactRecordSecrets(records...)
 		c.ResponseOk(records, paginator.Nums())
 	}
 }
@@ -88,6 +90,7 @@ func (c *ApiController) GetRecord() {
 		return
 	}
 
+	object.RedactRecordSecrets(record)
 	c.ResponseOk(record)
 }
 
```

**File**: `controllers/resource.go` (modified, +19/-4)
```diff
@@ -176,25 +176,40 @@ func (c *ApiController) DeleteResource() {
 		return
 	}
 
-	var resource object.Resource
-	err := json.NewDecoder(c.Ctx.Request.Body).Decode(&resource)
+	var form object.Resource
+	err := json.NewDecoder(c.Ctx.Request.Body).Decode(&form)
 	if err != nil {
 		c.ResponseError(err.Error())
 		return
 	}
 
+	// Act on the stored resource: the request body could otherwise name any storage object to delete.
+	if form.Owner == "" || form.Name == "" {
+		c.ResponseError(c.T("application:Missing required parameters"))
+		return
+	}
+	resource, err := object.GetResource(util.GetIdFromOwnerAndName(form.Owner, form.Name))
+	if err != nil {
+		c.ResponseError(err.Error())
+		return
+	}
+	if resource == nil {
+		c.ResponseOk(false)
+		return
+	}
+
 	if !c.IsAdmin() && resource.User != userName {
 		c.ResponseError(c.T("auth:Unauthorized operation"))
 		return
 	}
 
-	err = object.DeleteResourceFile(&resource, c.GetAcceptLanguage())
+	err = object.DeleteResourceFile(resource, c.GetAcceptLanguage())
 	if err != nil {
 		c.ResponseError(err.Error())
 		return
 	}
 
-	success, err := object.DeleteResource(&resource)
+	success, err := object.DeleteResource(resource)
 	if err != nil {
 		c.ResponseError(err.Error())
 		return
```

---

### Incident Patch 10: `b21950e0` (2026-09-27)
**Commit Message**: fix(ci): use a local iconfont.js copy instead of the CDN download

**File**: `scripts/assets/iconfont.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+!function(a){var h,t,l,c,i,p='<svg><symbol id="icon-testfile-unknown1" viewBox="0 0 1024 1024"><path d="M903.542857 256.8c6.857143 6.857143 10.742857 16.114286 10.742857 25.828571V987.428571c0 20.228571-16.342857 36.571429-36.571428 36.571429H146.285714c-20.228571 0-36.571429-16.342857-36.571428-36.571429V36.571429c0-20.228571 16.342857-36.571429 36.571428-36.571429h485.371429c9.714286 0 19.085714 3.885714 25.942857 10.742857l245.942857 246.057143zM829.942857 299.428571L614.857143 84.342857V299.428571h215.085714zM386.285714 554.285714c0 6.171429 5.028571 10.857143 11.2 10.857143h37.028572c6.171429 0 11.2-4.8 11.2-10.742857 0-32.228571 29.485714-58.971429 66.285714-58.971429s66.285714 26.742857 66.285714 58.857143c0 28.914286-24 53.942857-56.342857 58.171429-22.057143 3.2-39.428571 23.2-39.657143 45.828571v36.571429c0 6.285714 5.142857 11.428571 11.428572 11.428571h36.571428c6.285714 0 11.428571-5.142857 11.428572-11.428571v-13.942857c0-6.857143 4.571429-13.142857 11.085714-15.2 50.971429-16.457143 85.714286-61.714286 84.914286-113.028572-0.914286-63.428571-56.228571-115.2-124-116.114285-70.171429-0.8-127.428571 52.114286-127.428572 117.714285z m125.714286 259.428572a36.571429 36.571429 0 1 0 0-73.142857 36.571429 36.571429 0 0 0 0 73.142857z"  ></path></symbol><symbol id="icon-testfile-unknown2" viewBox="0 0 1024 1024"><path d="M854.584889 288.711111c6.030222 5.973333 9.415111 14.08 9.415111 22.584889v616.704c0 17.692444-14.307556 32-32 32H192a31.971556 31.971556 0 0 1-32-32V96c0-17.692444 14.307556-32 32-32h424.675556c8.533333 0 16.725333 3.413333 22.727111 9.386667l215.210666 215.324444z m-64.398222 37.262222l-188.188445-188.16v188.188445h188.188445zM402.005333 548.977778c0 5.404444 4.408889 9.528889 9.784889 9.528889h32.426667c5.404444 0 9.784889-4.209778 9.784889-9.386667 0-28.216889 25.799111-51.626667 57.998222-51.626667 32.199111 0 58.026667 23.409778 58.026667 51.484445 0 25.315556-21.048889 47.217778-49.322667 50.915555-19.313778 2.816-34.503111 20.309333-34.702222 40.106667v32c0 5.489778 4.494222 10.012444 10.012444 10.012444h32a10.040889 10.040889 0 0 0 9.984-10.012444v-12.202667c0-5.973333 3.982222-11.491556 9.699556-13.312 44.600889-14.392889 75.008-53.987556 74.296889-98.872889-0.796444-55.523556-49.208889-100.807111-108.487111-101.603555-61.411556-0.711111-111.502222 45.596444-111.502223 102.968889zM512 776.021333a32 32 0 1 0 0-64 32 32 0 0 0 0 64z"  ></path></symbol><symbol id="icon-testfile-unknown" viewBox="0 0 1024 1024"><path d="M903.542857 256.8L657.6 10.742857c-6.857143-6.857143-16.228571-10.742857-25.942857-10.742857H146.285714c-20.228571 0-36.571429 16.342857-36.571428 36.571429v950.857142c0 20.228571 16.342857 36.571429 36.571428 36.571429h731.428572c20.228571 0 36.571429-16.342857 36.571428-36.571429V282.628571c0-9.714286-3.885714-18.971429-10.742857-25.828571zM829.942857 299.428571H614.857143V84.342857L829.942857 299.428571z m2.057143 642.285715H192V82.285714h345.142857v246.857143a48 48 0 0 0 48 48h246.857143v564.571429zM386.285714 554.285714c0 6.171429 5.028571 10.857143 11.2 10.857143h37.028572c6.171429 0 11.2-4.8 11.2-10.742857 0-32.228571 29.485714-58.971429 66.285714-58.971429s66.285714 26.742857 66.285714 58.857143c0 28.914286-24 53.942857-56.342857 58.171429-22.057143 3.2-39.428571 23.2-39.657143 45.828571v36.571429c0 6.285714 5.142857 11.428571 11.428572 11.428571h36.571428c6.285714 0 11.428571-5.142857 11.428572-11.428571v-13.942857c0-6.857143 4.571429-13.142857 11.085714-15.2 50.971429-16.457143 85.714286-61.714286 84.914286-113.028572-0.914286-63.428571-56.228571-115.2-124-116.114285-70.171429-0.8-127.428571 52.114286-127.428572 117.714285z m89.142857 222.857143a36.571429 36.571429 0 1 0 73.142858 0 36.571429 36.571429 0 1 0-73.142858 0z"  ></path></symbol><symbol id="icon-testfolder" viewBox="0 0 1024 1024"><path d="M0 317h1024v595H0z" fill="#FFE17B" ></path><path d="M523 217l-98-97H0v197h1024V217z" fill="#FFEFB6" ></path></symbol><symbol id="icon-testcss" viewBox="0 0 1024 1024"><path d="M112 16h736v992H112z" fill="#EEBFD9" ></path><path d="M561.472 729.472A15.68 15.68 0 0 0 560 736v96h-16a16 16 0 1 0 0 32h32a16 16 0 0 0 16-16v-104.64l27.296-27.296c3.328-3.328 4.864-7.728 4.752-12.112a16.48 16.48 0 0 0-4.784-12.208L592 664.48V560a16 16 0 0 0-16-16h-32a16 16 0 1 0 0 32h16v95.808c-0.192 4.48 1.312 9.008 4.736 12.432l19.824 19.824-19.36 19.36c-1.76 1.76-2.928 3.84-3.728 6.048zM368 743.36V848a16 16 0 0 0 16 16h32a16 16 0 1 0 0-32h-16v-96a15.68 15.68 0 0 0-1.472-6.528 16 16 0 0 0-3.728-6.032l-19.36-19.36 19.824-19.824c3.424-3.424 4.928-7.952 4.736-12.432V576h16a16 16 0 1 0 0-32h-32a16 16 0 0 0-16 16v104.48l-27.264 27.264c-3.36 3.36-4.912 7.792-4.784 12.208-0.112 4.368 1.424 8.784 4.752 12.112L368 743.36zM896 128h-32V32a32 32 0 0 0-32-32H128a32 32 0 0 0-32 32v960a32 32 0 0 0 32 32h704a32 32 0 0 0 32-32V416h32a32 32 0 0 0 32-32V160a32 32 0 0 0-32-32z m-64 0H448a32 32 0 0 0-32 32v224a32 32 0 0 0 32 32h384v576H128V32h704v96z" fill="#2B3139" ></path><path d="M448
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

### Incident Patch 11: `11ebfc4f` (2026-09-27)
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

**File**: `controllers/store.go` (modified, +27/-0)
```diff
@@ -26,6 +26,18 @@ import (
 	"github.com/the-open-agent/openagent/util"
 )
 
+// requireStoreAdminOwnership limits store-level admins to the stores they own.
+func (c *ApiController) requireStoreAdminOwnership(storeOwner string) bool {
+	if c.IsGlobalAdmin() || !c.IsStoreAdmin() {
+		return true
+	}
+	if storeOwner != c.GetSessionUsername() {
+		c.ResponseError(c.T("auth:Unauthorized operation"))
+		return false
+	}
+	return true
+}
+
 // GetHubStores
 // @Title GetHubStores
 // @Tag Store API
@@ -229,6 +241,9 @@ func (c *ApiController) UpdateStore() {
 		c.ResponseError(fmt.Sprintf("store: %s not found", id))
 		return
 	}
+	if !c.requireStoreAdminOwnership(oldStore.Owner) {
+		return
+	}
 
 	if store.ExternalApiKey == "***" {
 		store.ExternalApiKey = oldStore.ExternalApiKey
@@ -349,6 +364,10 @@ func (c *ApiController) AddStore() {
 		return
 	}
 
+	if !c.IsGlobalAdmin() && c.IsStoreAdmin() {
+		store.Owner = c.GetSessionUsername()
+	}
+
 	err = object.SyncDefaultProvidersToStore(&store)
 	if err != nil {
 		c.ResponseError(err.Error())
@@ -405,6 +424,10 @@ func (c *ApiController) DeleteStore() {
 		return
 	}
 
+	if !c.requireStoreAdminOwnership(store.Owner) {
+		return
+	}
+
 	if store.IsDefault {
 		c.ResponseError(c.T("store:Cannot delete the default store"))
 		return
@@ -483,6 +506,10 @@ func (c *ApiController) RefreshStoreVectors() {
 		return
 	}
 
+	if !c.requireStoreAdminOwnership(store.Owner) {
+		return
+	}
+
 	ok, err := object.RefreshStoreVectors(&store, c.GetAcceptLanguage())
 	if err != nil {
 		c.ResponseError(err.Error())
```

**File**: `controllers/text_to_speech.go` (modified, +8/-0)
```diff
@@ -47,6 +47,10 @@ func (c *ApiController) GenerateTextToSpeechAudio() {
 		c.ResponseError(err.Error())
 		return
 	}
+	// Reading an existing message aloud discloses its text, so it is limited to the message's own user.
+	if req.MessageId != "" && !c.IsCurrentUser(message.User) {
+		return
+	}
 
 	audioData, ttsResult, err := providerObj.QueryAudio(message.Text, ctx, c.GetAcceptLanguage())
 	if err != nil {
@@ -88,6 +92,10 @@ func (c *ApiController) GenerateTextToSpeechAudioStream() {
 		c.ResponseErrorStream(message, err.Error())
 		return
 	}
+	if !c.IsAdmin() && c.GetSessionUsername() != message.User {
+		c.ResponseErrorStream(message, c.T("auth:Unauthorized operation"))
+		return
+	}
 
 	ttsResult, err := providerObj.QueryAudioStream(message.Text, ctx, c.Ctx.ResponseWriter, c.GetAcceptLanguage())
 	if err != nil {
```

**File**: `controllers/tool.go` (modified, +32/-0)
```diff
@@ -22,6 +22,21 @@ import (
 	"github.com/the-open-agent/openagent/util"
 )
 
+// requireHighRiskToolPermission blocks store-level admins from tools that execute commands,
+// touch the local file system or drive the local desktop/browser.
+func (c *ApiController) requireHighRiskToolPermission(tools ...*object.Tool) bool {
+	if c.IsGlobalAdmin() {
+		return true
+	}
+	for _, t := range tools {
+		if t != nil && object.IsHighRiskToolType(t.Type) {
+			c.ResponseError(c.T("controllers:Only the global admin can configure tools or MCP servers that run commands on the host"))
+			return false
+		}
+	}
+	return true
+}
+
 // GetGlobalTools
 // @Title GetGlobalTools
 // @Tag Tool API
@@ -122,6 +137,15 @@ func (c *ApiController) UpdateTool() {
 		return
 	}
 
+	oldTool, err := object.GetTool(id)
+	if err != nil {
+		c.ResponseError(err.Error())
+		return
+	}
+	if !c.requireHighRiskToolPermission(&t, oldTool) {
+		return
+	}
+
 	success, err := object.UpdateTool(id, &t)
 	if err != nil {
 		c.ResponseError(err.Error())
@@ -146,6 +170,10 @@ func (c *ApiController) AddTool() {
 		return
 	}
 
+	if !c.requireHighRiskToolPermission(&t) {
+		return
+	}
+
 	t.Owner = "admin"
 	success, err := object.AddTool(&t)
 	if err != nil {
@@ -195,6 +223,10 @@ func (c *ApiController) TestTool() {
 		return
 	}
 
+	if !c.requireHighRiskToolPermission(&t) {
+		return
+	}
+
 	result, err := object.TestTool(&t, c.GetAcceptLanguage())
 	if err != nil {
 		c.ResponseError(err.Error())
```

---

### Incident Patch 12: `f4e0ce75` (2026-09-27)
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

**File**: `controllers/pipe_webhook.go` (modified, +12/-4)
```diff
@@ -131,6 +131,12 @@ func (c *ApiController) ChatWebhook() {
 		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
 		return
 	}
+	// A 4xx/5xx immediate response means the request was rejected (e.g. a bad signature),
+	// so the update must not be processed.
+	if immediateResponse != nil && immediateResponse.StatusCode >= http.StatusBadRequest {
+		writePipeWebhookResponse(c, immediateResponse)
+		return
+	}
 
 	incoming, err := provider.ParseWebhookRequest(body)
 	if err != nil {
@@ -145,11 +151,11 @@ func (c *ApiController) ChatWebhook() {
 
 	if immediateResponse != nil {
 		writePipeWebhookResponse(c, immediateResponse)
-		go sendPipeAnswer(provider, pipeObj, incoming, host, lang)
+		go sendPipeAnswer(provider, pipeObj, incoming, host, lang, false)
 		return
 	}
 
-	sendPipeAnswer(provider, pipeObj, incoming, host, lang)
+	sendPipeAnswer(provider, pipeObj, incoming, host, lang, false)
 	c.Ctx.ResponseWriter.WriteHeader(http.StatusOK)
 }
 
@@ -374,7 +380,9 @@ func addPipeQuestionAndAnswerMessages(chat *object.Chat, incoming *pipepkg.Incom
 	return questionMessage, answerMessage, nil
 }
 
-func sendPipeAnswer(provider pipepkg.Pipe, pipeObj *object.Pipe, incoming *pipepkg.IncomingMessage, host string, lang string) {
+// sendPipeAnswer answers an incoming pipe message. allowHighRiskTools must only be true when the
+// sender is authenticated by the transport; public webhooks can be called by anyone who knows the URL.
+func sendPipeAnswer(provider pipepkg.Pipe, pipeObj *object.Pipe, incoming *pipepkg.IncomingMessage, host string, lang string, allowHighRiskTools bool) {
 	chat, err := ensurePipeChat(pipeObj, incoming)
 	if err != nil {
 		_ = provider.SendMessage(incoming.ChatId, fmt.Sprintf("Error: %v", err))
@@ -395,7 +403,7 @@ func sendPipeAnswer(provider pipepkg.Pipe, pipeObj *object.Pipe, incoming *pipep
 	}
 
 	recorder := newPipeSSERecorder(sender)
-	generateMessageAnswer(answerMessage.GetId(), recorder, host, lang, false, true, nil)
+	generateMessageAnswer(answerMessage.GetId(), recorder, host, lang, false, allowHighRiskTools, nil)
 
 	answer, err := object.GetMessage(answerMessage.GetId())
 	if err == nil && answer != nil && answer.Text != "" {
```

**File**: `controllers/pipe_weixin_claw.go` (modified, +1/-1)
```diff
@@ -149,7 +149,7 @@ func handleWeixinClawMessage(pipeObj *object.Pipe, msg *pipepkg.WeixinClawMessag
 		},
 	}
 	host := strings.TrimPrefix(strings.TrimPrefix(pipeObj.Domain, "https://"), "http://")
-	sendPipeAnswer(provider, pipeObj, incoming, host, "")
+	sendPipeAnswer(provider, pipeObj, incoming, host, "", true)
 }
 
 func setWeixinClawLastError(pipeObj *object.Pipe, err error) {
```

**File**: `controllers/task.go` (modified, +22/-8)
```diff
@@ -64,11 +64,13 @@ func (c *ApiController) GetTasks() {
 		owner = ""
 	}
 
-	// For non-admins, filter by their username
+	// Non-admins may only list their own tasks. An empty owner would match every task,
+	// so anonymous callers get nothing.
 	if !c.IsAdmin() {
-		username := c.GetSessionUsername()
-		if username != "" {
-			owner = username
+		owner = c.GetSessionUsername()
+		if owner == "" {
+			c.ResponseOk([]*object.Task{})
+			return
 		}
 	}
 
@@ -123,7 +125,7 @@ func (c *ApiController) GetTask() {
 	// Check ownership for non-admins
 	if !c.IsAdmin() {
 		username := c.GetSessionUsername()
-		if task.Owner != username {
+		if username == "" || task.Owner != username {
 			c.ResponseError(c.T("auth:Unauthorized operation"))
 			return
 		}
@@ -163,10 +165,13 @@ func (c *ApiController) UpdateTask() {
 	// Check ownership for non-admins
 	if !c.IsAdmin() {
 		username := c.GetSessionUsername()
-		if existingTask.Owner != username {
+		if username == "" || existingTask.Owner != username {
 			c.ResponseError(c.T("auth:Unauthorized operation"))
 			return
 		}
+		// Non-admins cannot move a task to another owner or rename its key.
+		task.Owner = existingTask.Owner
+		task.Name = existingTask.Name
 	}
 
 	success, err := object.UpdateTask(id, &task)
@@ -186,13 +191,22 @@ func (c *ApiController) UpdateTask() {
 // @Success 200 {object} controllers.Response The Response object
 // @router /add-task [post]
 func (c *ApiController) AddTask() {
+	username, ok := c.RequireSignedIn()
+	if !ok {
+		return
+	}
+
 	var task object.Task
 	err := json.Unmarshal(c.Ctx.Input.RequestBody, &task)
 	if err != nil {
 		c.ResponseError(err.Error())
 		return
 	}
 
+	if !c.IsAdmin() {
+		task.Owner = username
+	}
+
 	success, err := object.AddTask(&task)
 	if err != nil {
 		c.ResponseError(err.Error())
@@ -231,7 +245,7 @@ func (c *ApiController) DeleteTask() {
 			c.ResponseError(c.T("general:The task does not exist"))
 			return
 		}
-		if existingTask.Owner != username {
+		if username == "" || existingTask.Owner != username {
 			c.ResponseError(c.T("auth:Unauthorized operation"))
 			return
 		}
@@ -270,7 +284,7 @@ func (c *ApiController) AnalyzeTask() {
 
 	if !c.IsAdmin() {
 		username := c.GetSessionUsername()
-		if task.Owner != username {
+		if username == "" || task.Owner != username {
 			logs.Warn("[analyze-task] forbidden id=%s taskOwner=%s user=%s", id, task.Owner, username)
 			c.ResponseError(c.T("auth:Unauthorized operation"))
 			return
```

---

### Incident Patch 13: `54bcbee6` (2026-09-27)
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

**File**: `controllers/signin.go` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ type accountForm struct {
 // @router /get-signin-options [get]
 func (c *ApiController) GetSigninOptions() {
 	signinEnabled := object.IsSigninEnabled()
-	autoSignin := signinEnabled && object.IsAdminUsingDefaultPassword()
+	autoSignin := signinEnabled && util.IsLoopbackRequest(c.Ctx.Request) && object.IsAdminUsingDefaultPassword()
 	c.ResponseOk(map[string]interface{}{
 		"casdoorAvailable": conf.IsCasdoorAvailable(),
 		"signinAvailable":  signinEnabled,
```

**File**: `controllers/task_upload.go` (modified, +3/-2)
```diff
@@ -23,6 +23,7 @@ import (
 	"github.com/beego/beego/logs"
 	"github.com/the-open-agent/openagent/object"
 	"github.com/the-open-agent/openagent/txt"
+	"github.com/the-open-agent/openagent/util"
 )
 
 // UploadTaskDocument
@@ -100,8 +101,8 @@ func (c *ApiController) UploadTaskDocument() {
 
 	// Upload file to storage
 	// Replace '+' with '_' to avoid '+'-as-space ambiguity in CDN URLs
-	safeFileName := strings.ReplaceAll(fileName, "+", "_")
-	filePath := fmt.Sprintf("openagent/task-documents/%s/%s", userName, safeFileName)
+	safeFileName := util.SanitizePathSegment(strings.ReplaceAll(fileName, "+", "_"))
+	filePath := fmt.Sprintf("openagent/task-documents/%s/%s", util.SanitizePathSegment(userName), safeFileName)
 	host := c.Ctx.Request.Host
 	origin := getOriginFromHost(host)
 	fileUrl, err := object.UploadFileToStorageSafe(filePath, fileBytes, origin, c.GetAcceptLanguage())
```

**File**: `object/message.go` (modified, +1/-1)
```diff
@@ -337,7 +337,7 @@ func RefineMessageFiles(message *Message, origin string, lang string) error {
 				return err
 			}
 
-			filePath := fmt.Sprintf("%s/%s/%s/%s", message.Organization, message.User, message.Chat, message.FileName)
+			filePath := fmt.Sprintf("%s/%s/%s/%s", util.SanitizePathSegment(message.Organization), util.SanitizePathSegment(message.User), util.SanitizePathSegment(message.Chat), util.SanitizePathSegment(message.FileName))
 
 			var fileUrl string
 			fileUrl, err = obj.PutObject(message.User, message.Chat, filePath, bytes.NewBuffer(content))
```

---

### Incident Patch 14: `a9dbda06` (2026-09-05)
**Commit Message**: fix: hide the answer correction button from anonymous readers

**File**: `web/src/chat/MessageItem.js` (modified, +3/-1)
```diff
@@ -72,7 +72,9 @@ const MessageItem = ({
   // Only a curator may publish a correction as a standing rule; everyone else's
   // corrections are queued for review by the backend.
   const isCurator = Setting.isAdminUser(account) || (store?.owners || []).includes(account?.name);
-  const canCorrect = !!onSaveCorrection && !hideInput && !message.isReadOnly &&
+  // Saving a correction requires a signed-in user, so anonymous readers never see the
+  // button rather than hitting an auth error after rewriting an answer.
+  const canCorrect = !!onSaveCorrection && !!account?.name && !hideInput && !message.isReadOnly &&
     message.author === "AI" && !!message.text && !isGenerating;
 
   const mergedSearchResults = useMemo(() => {
```

---

### Incident Patch 15: `3e049b5f` (2026-09-05)
**Commit Message**: fix: rename duplicate experience i18n keys to fix CI

**File**: `web/src/ExperienceEditPage.js` (modified, +6/-6)
```diff
@@ -193,17 +193,17 @@ class ExperienceEditPage extends React.Component {
         <Card size="small" title={renderCardTitle(i18next.t("experience:How it is used"), i18next.t("experience:How it is used desc"))} style={sectionCardStyle} headStyle={cardHeadStyle}>
           <Row gutter={rowGutter}>
             {this.renderExperienceField(
-              i18next.t("experience:Category"),
+              i18next.t("general:Category"),
               <Select style={{width: "100%"}} value={experience.category} onChange={value => {
                 this.updateExperienceField("category", value);
-              }} options={EXPERIENCE_CATEGORIES.map(item => ({value: item, label: i18next.t(`experience:${item}`)}))} />,
+              }} options={EXPERIENCE_CATEGORIES.map(item => ({value: item, label: i18next.t(`experience:Category - ${item}`)}))} />,
               8
             )}
             {this.renderExperienceField(
               i18next.t("general:State"),
               <Select style={{width: "100%"}} value={experience.state} onChange={value => {
                 this.updateExperienceField("state", value);
-              }} options={EXPERIENCE_STATES.map(item => ({value: item, label: i18next.t(`experience:${item}`)}))} />,
+              }} options={EXPERIENCE_STATES.map(item => ({value: item, label: i18next.t(`experience:State - ${item}`)}))} />,
               8
             )}
             {this.renderExperienceField(
@@ -228,21 +228,21 @@ class ExperienceEditPage extends React.Component {
           </Row>
         </Card>
 
-        <Card size="small" title={renderCardTitle(i18next.t("experience:Source"), i18next.t("experience:Source desc"))} style={sectionCardStyle} headStyle={cardHeadStyle}>
+        <Card size="small" title={renderCardTitle(i18next.t("experience:Source - title"), i18next.t("experience:Source desc"))} style={sectionCardStyle} headStyle={cardHeadStyle}>
           <Row gutter={rowGutter}>
             {this.renderExperienceField(
               i18next.t("general:Name"),
               <Input disabled value={experience.name} />,
               8
             )}
             {this.renderExperienceField(
-              Setting.getLabel(i18next.t("general:Store"), i18next.t("experience:Store - Tooltip")),
+              Setting.getLabel(i18next.t("general:Store"), i18next.t("experience:Experience store - Tooltip")),
               <Select
                 virtual={false}
                 showSearch
                 style={{width: "100%"}}
                 value={experience.store || undefined}
-                placeholder={i18next.t("experience:Store - Tooltip")}
+                placeholder={i18next.t("experience:Experience store - Tooltip")}
                 onChange={value => {
                   this.updateExperienceField("store", value);
                 }}
```

**File**: `web/src/ExperienceListPage.js` (modified, +5/-5)
```diff
@@ -157,14 +157,14 @@ class ExperienceListPage extends BaseListPage {
         ),
       },
       {
-        title: i18next.t("experience:Category"),
+        title: i18next.t("general:Category"),
         dataIndex: "category",
         key: "category",
         width: "110px",
         filterMultiple: false,
-        filters: EXPERIENCE_CATEGORIES.map((item) => ({text: i18next.t(`experience:${item}`), value: item})),
+        filters: EXPERIENCE_CATEGORIES.map((item) => ({text: i18next.t(`experience:Category - ${item}`), value: item})),
         onFilter: (value, record) => record.category === value,
-        render: (text) => text ? <Tag>{i18next.t(`experience:${text}`)}</Tag> : null,
+        render: (text) => text ? <Tag>{i18next.t(`experience:Category - ${text}`)}</Tag> : null,
       },
       {
         title: i18next.t("experience:Standing rule"),
@@ -186,15 +186,15 @@ class ExperienceListPage extends BaseListPage {
         key: "state",
         width: "130px",
         filterMultiple: false,
-        filters: EXPERIENCE_STATES.map((item) => ({text: i18next.t(`experience:${item}`), value: item})),
+        filters: EXPERIENCE_STATES.map((item) => ({text: i18next.t(`experience:State - ${item}`), value: item})),
         onFilter: (value, record) => record.state === value,
         render: (text, record) => (
           <Select
             size="small"
             style={{width: "100%"}}
             value={text}
             onChange={(value) => this.updateExperienceState(record, value)}
-            options={EXPERIENCE_STATES.map((item) => ({value: item, label: i18next.t(`experience:${item}`)}))}
+            options={EXPERIENCE_STATES.map((item) => ({value: item, label: i18next.t(`experience:State - ${item}`)}))}
           />
         ),
       },
```

**File**: `web/src/chat/MessageCorrection.js` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ export const CorrectionEditor = ({message, isDark, canSetGlobalRule, onSave, onC
           style={{width: "140px"}}
           options={CORRECTION_CATEGORIES.map(item => ({
             value: item,
-            label: i18next.t(`experience:${item}`),
+            label: i18next.t(`experience:Category - ${item}`),
           }))}
         />
         <Input
```

**File**: `web/src/locales/en/data.json` (modified, +9/-10)
```diff
@@ -101,20 +101,19 @@
     "Target type": "Target type"
   },
   "experience": {
-    "Active": "Active",
     "Apply as a standing rule": "Apply as a standing rule",
     "Apply as a standing rule - Tooltip": "Standing rules are added to every answer of this agent, no matter what the question is. Use them for tone, format and wording",
-    "Archived": "Archived",
-    "Category": "Category",
+    "Category - Fact": "Fact",
+    "Category - Format": "Format",
+    "Category - Scope": "Scope",
+    "Category - Style": "Style",
     "Correct this answer": "Correct this answer",
     "Correct this answer - Tooltip": "Rewrite the answer the way it should have been. The change is shown here and saved to the experience library, so later answers learn from it",
     "Corrected answer": "Corrected answer",
     "Corrected by a human": "Corrected by a human",
     "Correction reverted": "Correction reverted",
-    "Draft": "Pending review",
     "Edit Experience": "Edit Experience",
-    "Fact": "Fact",
-    "Format": "Format",
+    "Experience store - Tooltip": "Which agent this experience applies to. An experience with no agent is never used",
     "Hide changes": "Hide changes",
     "Hit count": "Hit count",
     "How it is used": "How it is used",
@@ -127,15 +126,15 @@
     "Rule - Tooltip": "One sentence the agent should follow every time, e.g. \"answer policy questions with a conclusion first, no disclaimer\"",
     "Saved to the experience library": "Saved to the experience library",
     "Saved, waiting for review before it affects new answers": "Saved. It affects new answers once a reviewer approves it",
-    "Scope": "Scope",
     "Show changes": "Show changes",
-    "Source": "Source",
+    "Source - title": "Source",
     "Source desc": "The conversation this correction came from",
     "Standing rule": "Standing rule",
     "Standing rule - Tooltip": "Applied to every answer instead of only to similar questions",
-    "Store - Tooltip": "Which agent this experience applies to. An experience with no agent is never used",
+    "State - Active": "Active",
+    "State - Archived": "Archived",
+    "State - Draft": "Pending review",
     "Struck-through text was removed, highlighted text was added": "Struck-through text was removed, highlighted text was added",
-    "Style": "Style",
     "The answers differ too much to align, showing both versions": "The answers differ too much to align, showing both versions",
     "The correction": "The correction",
     "The correction desc": "What the agent said, and what it should have said",
```

**File**: `web/src/locales/zh/data.json` (modified, +9/-10)
```diff
@@ -101,20 +101,19 @@
     "Target type": "目标类型"
   },
   "experience": {
-    "Active": "已生效",
     "Apply as a standing rule": "设为长期规则",
     "Apply as a standing rule - Tooltip": "长期规则会加入本智能体的每一次回答，与问题无关。适合约定语气、格式和措辞",
-    "Archived": "已归档",
-    "Category": "分类",
+    "Category - Fact": "事实纠错",
+    "Category - Format": "格式",
+    "Category - Scope": "回答边界",
+    "Category - Style": "口径风格",
     "Correct this answer": "校准这条回答",
     "Correct this answer - Tooltip": "把回答改成本该有的样子。修改会在这里标出，并存入经验库，供之后的回答学习",
     "Corrected answer": "校准后的回答",
     "Corrected by a human": "已人工校准",
     "Correction reverted": "已撤销校准",
-    "Draft": "待审核",
     "Edit Experience": "编辑经验",
-    "Fact": "事实纠错",
-    "Format": "格式",
+    "Experience store - Tooltip": "这条经验作用于哪个智能体。未选择智能体的经验永远不会生效",
     "Hide changes": "收起修改",
     "Hit count": "命中次数",
     "How it is used": "生效方式",
@@ -127,15 +126,15 @@
     "Rule - Tooltip": "一句每次都要遵守的话，例如「回答制度类问题先给结论，不要加免责声明」",
     "Saved to the experience library": "已存入经验库",
     "Saved, waiting for review before it affects new answers": "已保存，待管理员审核通过后才会影响新的回答",
-    "Scope": "回答边界",
     "Show changes": "查看修改",
-    "Source": "来源",
+    "Source - title": "来源",
     "Source desc": "这条校准来自哪一次对话",
     "Standing rule": "长期规则",
     "Standing rule - Tooltip": "对每次回答都生效，而不是只在相似问题上生效",
-    "Store - Tooltip": "这条经验作用于哪个智能体。未选择智能体的经验永远不会生效",
+    "State - Active": "已生效",
+    "State - Archived": "已归档",
+    "State - Draft": "待审核",
     "Struck-through text was removed, highlighted text was added": "划掉的是删除内容，高亮的是新增内容",
-    "Style": "口径风格",
     "The answers differ too much to align, showing both versions": "两版回答差异过大，无法逐词对齐，这里直接展示前后两版",
     "The correction": "校准内容",
     "The correction desc": "智能体说了什么，本该说什么",
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

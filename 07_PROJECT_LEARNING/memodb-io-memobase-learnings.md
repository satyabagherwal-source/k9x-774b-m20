# Forensic Learning Record (Deep Inspection): memodb-io/memobase

> **Canonical Artifact**: `07_PROJECT_LEARNING/memodb-io-memobase-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/memodb-io/memobase](https://github.com/memodb-io/memobase))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:17:39.768Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `memodb-io/memobase`
- **Description**: User Profile-Based Long-Term Memory for AI Chatbot Applications. 
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: N/A
- **Stars / Engagement**: 2924 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Remote API meta.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/client/memobase-go/core/client.go`
```
package core

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/memodb-io/memobase/src/client/memobase-go/network"
)

type MemoBaseClient struct {
	ProjectURL string
	APIKey     string
	APIVersion string
	BaseURL    string
	HTTPClient *http.Client
}

func NewMemoBaseClient(projectURL string, apiKey string) (*MemoBaseClient, error) {
	if apiKey == "" {
		apiKey = os.Getenv("MEMOBASE_API_KEY")
	}

	if apiKey == "" {
		return nil, fmt.Errorf("api_key is required, pass it as argument or set MEMOBASE_API_KEY environment variable")
	}

	client := &MemoBaseClient{
		ProjectURL: projectURL,
		APIKey:     apiKey,
		APIVersion: "api/v1",
		HTTPClient: &http.Client{
			Timeout: time.Second * 60,
		},
	}

	client.BaseURL = fmt.Sprintf("%s/%s", projectURL, client.APIVersion)

	// Add authorization header to all requests
	client.HTTPClient.Transport = &authTransport{
		apiKey: apiKey,
		base:   http.DefaultTransport,
	}

	return client, nil
}

// authTransport adds authorization header to all requests
type authTransport struct {
	apiKey string
	base   http.RoundTripper
}

func (t *authTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", t.apiKey))
	return t.base.RoundTrip(req)
}

func (c *MemoBaseClient) Ping() bool {
	resp, err := c.HTTPClient.Get(fmt.Sprintf("%s/healthcheck", c.BaseURL))
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	_, err = network.UnpackResponse(resp)
	return err == nil
}

func (c *MemoBaseClient) AddUser(data map[string]interface{}, id string) (string, error) {
	reqBody := map[string]interface{}{
		"data": data,
	}
	if id != "" {
		reqBody["id"] = id
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	resp, err := c.HTTPClient.Post(
		fmt.Sprintf("%s/users", c.BaseURL),
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	baseResp, err := network.UnpackResponse(resp)
	if err != nil {
		return "", err
	}

	dataMap, ok := baseResp.Data.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("unexpected response format for AddUser")
	}

	return dataMap["id"].(string), nil
}

func (c *MemoBaseClient) UpdateUser(userID string, data map[string]interface{}) (string, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest(
		http.MethodPut,
		fmt.Sprintf("%s/users/%s", c.BaseURL, userID),
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	baseResp, err := network.UnpackResponse(resp)
	if err != nil {
		return "", err
	}

	dataMap, ok := baseResp.Data.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("unexpected response format for UpdateUser")
	}

	return dataMap["id"].(string), nil
}

func (c *MemoBaseClient) GetUser(userID string, noGet bool) (*User, error) {
	if !noGet {
		resp, err := c.HTTPClient.Get(fmt.Sprintf("%s/users/%s", c.BaseURL, userID))
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		baseResp, err := network.UnpackResponse(resp)
		if err != nil {
			return nil, err
		}

		dataMap, ok := baseResp.Data.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("unexpected response format for GetUser")
		}

		return &User{
			UserID:        userID,
			ProjectClient: c,
			Fields:        dataMap,
		}, nil
	}

	return &User{
		UserID:        userID,
		ProjectClient: c,
	}, nil
}

func (c *MemoBaseClient) GetOrCreateUser(userID string) (*User, error) {
	user, err := c.GetUser(userID, false)
	if err != nil {
		// Try to create user if get fails
		_, err = c.AddUser(nil, userID)
		if err != nil {
			return nil, err
		}
		return &User{
			UserID:        userID,
			ProjectClient: c,
		}, nil
	}
	return user, nil
}

func (c *MemoBaseClient) DeleteUser(userID string) error {
	req, err := http.NewRequest(
		http.MethodDelete,
		fmt.Sprintf("%s/users/%s", c.BaseURL, userID),
		nil,
	)
	if err != nil {
		return err
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	_, err = network.UnpackResponse(resp)
	return err
}

// GetConfig retrieves the project's profile configuration
func (c *MemoBaseClient) GetConfig() (string, error) {
	resp, err := c.HTTPClient.Get(fmt.Sprintf("%s/project/profile_config", c.BaseURL))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	baseResp, err := network.UnpackResponse(resp)
	if err != nil {
		return "", err
	}

	dataMap, ok := baseResp.Data.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("unexpected response format for GetConfig")
	}

	config, ok := dataMap["profile_config"].(string)
	if !ok {
		return "", fmt.Errorf("unexpected response format for profile_config")
	}

	return config, nil
}

// UpdateConfig updates the project's profile configuration
func (c *MemoBaseClient) UpdateConfig(config string) error {
	reqBody := map[string]interface{}{
		"profile_config": config,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}

	resp, err := c.HTTPClient.Post(
		fmt.Sprintf("%s/project/profile_config", c.BaseURL),
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	_, err = network.UnpackResponse(resp)
	return err
}

func (c *MemoBaseClient) GetUsage() (map[string]interface{}, error) {
	resp, err := c.HTTPClient.Get(fmt.Sprintf("%s/project/billing", c.BaseURL))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	baseResp, err := network.UnpackResponse(resp)
	if err != nil {
		return nil, err
	}

	dataMap, ok := baseResp.Data.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response format for GetUsage")
	}

	return dataMap, nil
}

func (c *MemoBaseClient) GetAllUsers(search string, orderBy string, orderDesc bool, limit int, offset int) ([]map[string]interface{}, error) {
	url := fmt.Sprintf("%s/project/users?search=%s&order_by=%s&order_desc=%t&limit=%d&offset=%d", c.BaseURL, search, orderBy, orderDesc, limit, offset)
	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	baseResp, err := network.UnpackResponse(resp)
	if err != nil {
		return nil, err
	}

	dataMap, ok := baseResp.Data.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response format for GetAllUsers")
	}

	users, ok := dataMap["users"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response format for users")
	}

	var result []map[string]interface{}
	for _, u := range users {
		userMap, ok := u.(map[string]interface{})
		if !ok {
			continue
		}
		result = append(result, userMap)
	}

	return result, nil
}

func (c *MemoBaseClient) GetDailyUsage(days int) ([]map[string]interface{}, error) {
	url := fmt.Sprintf("%s/project/usage?last_days=%d", c.BaseURL, days)
	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	baseResp, err := network.UnpackResponse(resp)
	if err != nil {
		return nil, err
	}

	dataArray, ok := baseResp.Data.([]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response format for GetDailyUsage: expected array, got %T", baseResp.Data)
	}

	var result []map[string]interface{}
	for _, item := range dataArray {
		if itemMap, ok := item.(map[string]interface{}); ok {
			result = append(result, itemMap)
		} else {
			return nil, fmt.Errorf("unexpected item type in GetDailyUsage response: expected map[string]interface{}, got %T", item)
		}
	}

	return result, nil
}

```

### Core Architecture Module: `src/client/memobase-go/core/types.go`
```
package core

import (
	"time"

	"github.com/google/uuid"
)

type UserProfileData struct {
	ID         uuid.UUID `json:"id"`
	Content    string    `json:"content"`
	Attributes struct {
		Topic    string `json:"topic"`
		SubTopic string `json:"sub_topic"`
	} `json:"attributes"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ProfileDelta struct {
	Content    string                 `json:"content"`
	Attributes map[string]interface{} `json:"attributes"`
}

type EventTag struct {
	Tag   string `json:"tag"`
	Value string `json:"value"`
}

type EventData struct {
	ProfileDelta []ProfileDelta `json:"profile_delta"`
	EventTip     string         `json:"event_tip,omitempty"`
	EventTags    []EventTag     `json:"event_tags,omitempty"`
}

type UserEventData struct {
	ID         uuid.UUID `json:"id"`
	EventData  EventData `json:"event_data"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	Similarity float64   `json:"similarity,omitempty"`
}

// UserGistEventData represents a gist event with minimal data
type UserGistEventData struct {
	ID         uuid.UUID `json:"id"`
	GistData   struct {
		Content string `json:"content"`
	} `json:"gist_data"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	Similarity float64   `json:"similarity,omitempty"`
}

// BufferStatus represents the status of buffer operations
type BufferStatus string

const (
	BufferStatusPending BufferStatus = "pending"
	BufferStatusProcessing BufferStatus = "processing"
	BufferStatusCompleted BufferStatus = "completed"
	BufferStatusFailed    BufferStatus = "failed"
)

// BufferCapacity represents buffer capacity information
type BufferCapacity struct {
	IDs     []string     `json:"ids"`
	Status  BufferStatus `json:"status"`
	Count   int          `json:"count"`
	Capacity int          `json:"capacity"`
}

```

### Core Architecture Module: `src/client/memobase-go/core/user.go`
```
package core

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/memodb-io/memobase/src/client/memobase-go/blob"
	"github.com/memodb-io/memobase/src/client/memobase-go/network"
)

type User struct {
	UserID        string
	ProjectClient *MemoBaseClient
	Fields        map[string]interface{}
}

func (u *User) Insert(blob blob.BlobInterface, sync bool) (string, error) {
	reqData := map[string]interface{}{
		"blob_type": blob.GetType(),
		"blob_data": blob.GetBlobData(),
		"fields":    blob.GetFields(),
	}
	if blob.GetCreatedAt() != nil {
		reqData["created_at"] = blob.GetCreatedAt()
	}

	jsonData, err := json.Marshal(reqData)
	if err != nil {
		return "", err
	}

	resp, err := u.ProjectClient.HTTPClient.Post(
		fmt.Sprintf("%s/blobs/insert/%s?wait_process=%t", u.ProjectClient.BaseURL, u.UserID, sync),
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	baseResp, err := network.UnpackResponse(resp)
	if err != nil {
		return "", err
	}

	dataMap, ok := baseResp.Data.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("unexpected response format for Insert")
	}

	return dataMap["id"].(string), nil
}

func (u *User) Get(blobID string) (blob.BlobInterface, error) {
	resp, err := u.ProjectClient.HTTPClient.Get(
		fmt.Sprintf("%s/blobs/%s/%s", u.ProjectClient.BaseURL, u.UserID, blobID),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	baseResp, err := network.UnpackResponse(resp)
	if err != nil {
		return nil, err
	}

	var blobData blob.BlobData
	jsonData, err := json.Marshal(baseResp.Data)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(jsonData, &blobData); err != nil {
		return nil, err
	}

	return blobData.ToBlob()
}

func (u *User) GetAll(blobType blob.BlobType, page int, pageSize int) ([]string, error) {
	resp, err := u.ProjectClient.HTTPClient.Get(
		fmt.Sprintf("%s/users/blobs/%s/%s?page=%d&page_size=%d",
			u.ProjectClient.BaseURL, u.UserID, blobType, page, pageSize),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	baseResp, err := network.UnpackResponse(resp)
	if err != nil {
		return nil, err
	}

	dataMap, ok := baseResp.Data.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response format for GetAll")
	}

	data, ok := dataMap["ids"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response format for blob IDs")
	}

	ids := make([]string, len(data))
	for i, v := range data {
		if str, ok := v.(string); ok {
			ids[i] = str
		} else {
			return nil, fmt.Errorf("unexpected ID type at index %d", i)
		}
	}

	return ids, nil
}

func (u *User) Delete(blobID string) error {
	req, err := http.NewRequest(
		http.MethodDelete,
		fmt.Sprintf("%s/blobs/%s/%s", u.ProjectClient.BaseURL, u.UserID, blobID),
		nil,
	)
	if err != nil {
		return err
	}

	resp, err := u.ProjectClient.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	_, err = network.UnpackResponse(resp)
	return err
}

func (u *User) Flush(blobType blob.BlobType, sync bool) error {
	resp, err := u.ProjectClient.HTTPClient.Post(
		fmt.Sprintf("%s/users/buffer/%s/%s?wait_process=%t", u.ProjectClient.BaseURL, u.UserID, blobType, sync),
		"application/json",
		nil,
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	_, err = network.UnpackResponse(resp)
	return err
}

func (u *User) AddProfile(content string, topic string, subTopic string) (string, error) {
	reqData := map[string]interface{}{
		"content": content,
		"attributes": map[string]interface{}{
			"topic":     topic,
			"sub_topic": subTopic,
		},
	}

	jsonData, err := json.Marshal(reqData)
	if err != nil {
		return "", err
	}

	resp, err := u.ProjectClient.HTTPClient.Post(
		fmt.Sprintf("%s/users/profile/%s", u.ProjectClient.BaseURL, u.UserID),
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	baseResp, err := network.UnpackResponse(resp)
	if err != nil {
		return "", err
	}

	dataMap, ok := baseResp.Data.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("unexpected response format for AddProfile")
	}

	return dataMap["id"].(string), nil
}

func (u *User) Buffer(blobType blob.BlobType, status string) ([]string, error) {
	resp, err := u.ProjectClient.HTTPClient.Get(
		fmt.Sprintf("%s/users/buffer/capacity/%s/%s?status=%s", u.ProjectClient.BaseURL, u.UserID, blobType, status),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	baseResp, err := network.UnpackResponse(resp)
	if err != nil {
		return nil, err
	}

	dataMap, ok := baseResp.Data.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response format for Buffer")
	}

	data, ok := dataMap["ids"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response format for blob IDs")
	}

	ids := make([]string, len(data))
	for i, v := range data {
		if str, ok := v.(string); ok {
			ids[i] = str
		} else {
			return nil, fmt.Errorf("unexpected ID type at index %d", i)
		}
	}

	return ids, nil
}

type ProfileOptions struct {
	MaxTokenSize    int                            `json:"max_token_size,omitempty"`
	PreferTopics    []string                       `json:"prefer_topics,omitempty"`
	OnlyTopics      []string                       `json:"only_topics,omitempty"`
	MaxSubtopicSize *int                           `json:"max_subtopic_size,omitempty"`
	TopicLimits     map[string]int                 `json:"topic_limits,omitempty"`
	Chats           []blob.OpenAICompatibleMessage `json:"chats,omitempty"`
}

func (u *User) Profile(options *ProfileOptions) ([]UserProfileData, error) {
	if options == nil {
		options = &ProfileOptions{
			MaxTokenSize: 1000,
		}
	}

	params := url.Values{}
	params.Add("max_token_size", fmt.Sprintf("%d", options.MaxTokenSize))

	if options.PreferTopics != nil {
		for _, t := range options.PreferTopics {
			params.Add("prefer_topics", t)
		}
	}
	if options.OnlyTopics != nil {
		for _, t := range options.OnlyTopics {
			params.Add("only_topics", t)
		}
	}
	if options.MaxSubtopicSize != nil {
		params.Add("max_subtopic_size", fmt.Sprintf("%d", *options.MaxSubtopicSize))
	}
	if options.TopicLimits != nil {
		topicLimitsJSON, err := json.Marshal(options.TopicLimits)
		if err != nil {
			return nil, err
		}
		params.Add("topic_limits_json", string(topicLimitsJSON))
	}
	if options.Chats != nil {
		chatsJSON, err := json.Marshal(options.Chats)
		if err != nil {
			return nil, err
		}
		params.Add("chats_str", string(chatsJSON))
	}

	resp, err := u.ProjectClient.HTTPClient.Get(
		fmt.Sprintf("%s/users/profile/%s?%s", u.ProjectClient.BaseURL, u.UserID, params.Encode()),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	baseResp, err := network.UnpackResponse(resp)
	if err != nil {
		return nil, err
	}

	dataMap, ok := baseResp.Data.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response format for Profile")
	}

	profiles, ok := dataMap["profiles"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response format for profiles")
	}

	var result []UserProfileData
	for _, p := range profiles {
		profileMap, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		var profile UserProfileData
		jsonData, err := json.Marshal(profileMap)
		if err != nil {
			continue
		}

		if err := json.Unmarshal(jsonData, &profile); err != nil {
			fmt.Printf("Error unmarshaling profile: %v\nData: %s\n", err, jsonData)
			continue
		}

		result = append(result, profile)
	}

	return result, nil
}

func (u *User) UpdateProfile(profileID string, content string, topic string, subTopic string) error {
	reqData := map[string]interface{}{
		"content": content,
		"attributes": map[string]interface{}{
			"topic":     topic,
			"sub_topic": subTopic,
		},
	}

	jsonData, err := json.Marshal(reqData)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(
		http.MethodPut,
		fmt.Sprintf("%s/users/profile/%s/%s", u.ProjectClient.BaseURL, u.UserID, profileID),
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := u.ProjectClient.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	_, err = network.UnpackResponse(resp)
	return err
}

func (u *User) DeleteProfile(profileID string) error {
	req, err := http.NewRequest(
		http.MethodDelete,
		fmt.Sprintf("%s/users/profile/%s/%s", u.ProjectClient.BaseURL, u.UserID, profileID),
		nil,
	)
	if err != nil {
		return err
	}

	resp, err := u.ProjectClient.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	_, err = network.UnpackResponse(resp)
	return err
}

func (u *User) Event(topk int, maxTokenSize *int, needSummary bool) ([]UserEventData, error) {
	if topk <= 0 {
		topk = 10 // Default value
	}

	params := url.Values{}
	params.Add("topk", fmt.Sprintf("%d", topk))
	if maxTokenSize != nil {
		params.Add("max_token_size", fmt.Sprintf("%d", *maxTokenSize))
	}
	if needSummary {
		params.Add("need_summary", "true")
	}

	resp, err := u.ProjectClient.HTTPClient.Get(
		fmt.Sprintf("%s/users/event/%s?%s", u.ProjectClient.BaseURL, u.UserID, params.Encode()),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	baseResp, err := network.UnpackResponse(resp)
	if err != nil {
		return nil, err
	}

	dataMap, ok := baseResp.Data.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response format for Event")
	}

	events, ok := dataMap["events"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response format for events")
	}

	var result []UserEventData
	for _, e := range events {
		eventMap, ok := e.(map[string]interface{})
		if !ok {
			continue
		}

		var event UserEventData
		jsonData, err := json.Marshal(eventMap)
		if err != nil {
			continue
		}

		if err := json.Unmarshal(jsonData, &event); err != nil {
			fmt.Printf("Error unmarshaling event: %v\nData: %s\n"
```

### Core Architecture Module: `src/client/memobase-go/utils/utils.go`
```
package utils

import (
	"github.com/google/uuid"
)

func StringToUUID(s string, salt string) string {
	if salt == "" {
		salt = "memobase_client"
	}
	return uuid.NewSHA1(uuid.NameSpaceDNS, []byte(s+salt)).String()
} 
```

### Core Architecture Module: `src/client/memobase/core/__init__.py`
```
# - Flat is better than nested.
# - Try not to make new stuffs.
# - Printability is a great feature.
# - Secretly handling errors for users is arrogant.
# - Making variable names long does not hurt anyone.
# - Don't make things too fancy; it kills possibilities.
# - Any single type should be fully functional on its own.

```

### Core Architecture Module: `src/client/memobase/core/async_entry.py`
```
import os
import json
import httpx
from collections import defaultdict
from typing import Optional, Literal
from pydantic import HttpUrl, ValidationError
from dataclasses import dataclass
from urllib.parse import quote_plus
from .blob import BlobData, Blob, BlobType, ChatBlob, OpenAICompatibleMessage
from .user import UserProfile, UserProfileData, UserEventData, UserEventGistData
from ..network import unpack_response
from ..error import ServerError
from ..utils import LOG


def profiles_to_json(profiles: list[UserProfile]) -> dict:
    results = defaultdict(dict)
    for p in profiles:
        results[p.topic][p.sub_topic] = {
            "id": p.id,
            "content": p.content,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
    return dict(results)


@dataclass
class AsyncMemoBaseClient:
    api_key: Optional[str] = None
    api_version: str = "api/v1"
    project_url: str = "https://api.memobase.dev"

    def __post_init__(self):
        self.api_key = self.api_key or os.getenv("MEMOBASE_API_KEY")
        assert (
            self.api_key is not None
        ), "api_key of memobase client is required, pass it as argument or set it as environment variable(MEMOBASE_API_KEY)"
        self.base_url = str(HttpUrl(self.project_url)) + self.api_version.strip("/")

        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
            },
            timeout=60,
        )

    @property
    def client(self) -> httpx.AsyncClient:
        return self._client

    async def ping(self) -> bool:
        try:
            unpack_response(await self._client.get("/healthcheck"))
        except httpx.HTTPStatusError as e:
            LOG.error(f"Healthcheck failed: {e}")
            return False
        except ServerError as e:
            LOG.error(f"Healthcheck failed: {e}")
            return False
        return True

    async def get_usage(self) -> dict:
        r = unpack_response(await self._client.get("/project/billing"))
        return r.data

    async def get_config(self) -> str:
        r = unpack_response(await self._client.get("/project/profile_config"))
        return r.data["profile_config"]

    async def update_config(self, config: str) -> bool:
        r = unpack_response(
            await self._client.post(
                "/project/profile_config", json={"profile_config": config}
            )
        )
        return True

    async def add_user(self, data: dict = None, id=None) -> str:
        r = unpack_response(
            await self._client.post("/users", json={"data": data, "id": id})
        )
        return r.data["id"]

    async def update_user(self, user_id: str, data: dict = None) -> str:
        r = unpack_response(
            await self._client.put(f"/users/{user_id}", json={"data": data})
        )
        return r.data["id"]

    async def get_user(self, user_id: str, no_get=False) -> "AsyncUser":
        if not no_get:
            r = unpack_response(await self._client.get(f"/users/{user_id}"))
            return AsyncUser(
                user_id=user_id,
                project_client=self,
                fields=r.data,
            )
        return AsyncUser(user_id=user_id, project_client=self)

    async def get_or_create_user(self, user_id: str) -> "AsyncUser":
        try:
            return await self.get_user(user_id)
        except ServerError:
            await self.add_user(id=user_id)
        return AsyncUser(user_id=user_id, project_client=self)

    async def delete_user(self, user_id: str) -> bool:
        r = unpack_response(await self._client.delete(f"/users/{user_id}"))
        return True

    async def get_all_users(
        self,
        search: str = "",
        order_by: str = "updated_at",
        order_desc: bool = True,
        limit: int = 10,
        offset: int = 0,
    ) -> list[dict]:
        r = unpack_response(
            await self._client.get(
                f"/project/users?search={search}&order_by={order_by}&order_desc={order_desc}&limit={limit}&offset={offset}"
            )
        )
        return r.data["users"]

    async def get_daily_usage(self, days: int = 7) -> dict:
        r = unpack_response(await self._client.get(f"/project/usage?last_days={days}"))
        return r.data

    async def close(self):
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


@dataclass
class AsyncUser:
    user_id: str
    project_client: AsyncMemoBaseClient
    fields: Optional[dict] = None

    async def insert(self, blob_data: Blob, sync=False) -> str:
        r = unpack_response(
            await self.project_client.client.post(
                f"/blobs/insert/{self.user_id}?wait_process={sync}",
                json=blob_data.to_request(),
            )
        )
        return r.data["id"]

    async def get(self, blob_id: str) -> Blob:
        r = unpack_response(
            await self.project_client.client.get(f"/blobs/{self.user_id}/{blob_id}")
        )
        return BlobData.model_validate(r.data).to_blob()

    async def get_all(
        self, blob_type: BlobType, page: int = 0, page_size: int = 10
    ) -> list[str]:
        r = unpack_response(
            await self.project_client.client.get(
                f"/users/blobs/{self.user_id}/{blob_type}?page={page}&page_size={page_size}"
            )
        )
        return r.data["ids"]

    async def delete(self, blob_id: str) -> bool:
        r = unpack_response(
            await self.project_client.client.delete(f"/blobs/{self.user_id}/{blob_id}")
        )
        return True

    async def flush(self, blob_type: BlobType = BlobType.chat, sync=False) -> bool:
        r = unpack_response(
            await self.project_client.client.post(
                f"/users/buffer/{self.user_id}/{blob_type}?wait_process={sync}"
            )
        )
        return True

    async def add_profile(self, content: str, topic: str, sub_topic: str) -> str:
        r = unpack_response(
            await self.project_client.client.post(
                f"/users/profile/{self.user_id}",
                json={
                    "content": content,
                    "attributes": {"topic": topic, "sub_topic": sub_topic},
                },
            )
        )
        return r.data["id"]

    async def buffer(
        self,
        blob_type: BlobType,
        status: Literal["idle", "processing", "done", "failed"] = "idle",
    ) -> list[str]:
        r = unpack_response(
            await self.project_client.client.get(
                f"/users/buffer/capacity/{self.user_id}/{blob_type}?status={status}"
            )
        )
        return r.data["ids"]

    async def profile(
        self,
        max_token_size: int = 1000,
        prefer_topics: list[str] = None,
        only_topics: list[str] = None,
        max_subtopic_size: int = None,
        topic_limits: dict[str, int] = None,
        chats: list[OpenAICompatibleMessage] = None,
        need_json: bool = False,
    ) -> list[UserProfile]:
        params = f"?max_token_size={max_token_size}"
        if prefer_topics:
            prefer_topics_query = [f"&prefer_topics={pt}" for pt in prefer_topics]
            params += "&".join(prefer_topics_query)
        if only_topics:
            only_topics_query = [f"&only_topics={ot}" for ot in only_topics]
            params += "&".join(only_topics_query)
        if max_subtopic_size:
            params += f"&max_subtopic_size={max_subtopic_size}"
        if topic_limits:
            params += f"&topic_limits_json={json.dumps(topic_limits)}"
        if chats:
            for c in chats:
                try:
                    OpenAICompatibleMessage(**c)
                except ValidationError as e:
                    raise ValueError(f"Invalid chat message: {e}")
            chats_query = f"&chats_str={json.dumps(chats)}"
            params += chats_query
        r = unpack_response(
            await self.project_client.client.get(
                f"/users/profile/{self.user_id}{params}"
            )
        )
        data = r.data["profiles"]
        ds_profiles = [UserProfileData.model_validate(p).to_ds() for p in data]
        if need_json:
            return profiles_to_json(ds_profiles)
        return ds_profiles

    async def update_profile(
        self, profile_id: str, content: str, topic: str, sub_topic: str
    ) -> str:
        r = unpack_response(
            await self.project_client.client.put(
                f"/users/profile/{self.user_id}/{profile_id}",
                json={
                    "content": content,
                    "attributes": {"topic": topic, "sub_topic": sub_topic},
                },
            )
        )
        return True

    async def delete_profile(self, profile_id: str) -> bool:
        r = unpack_response(
            await self.project_client.client.delete(
                f"/users/profile/{self.user_id}/{profile_id}"
            )
        )
        return True

    async def event(
        self, topk=10, max_token_size=None, need_summary=False
    ) -> list[UserEventData]:
        params = f"?topk={topk}"
        if max_token_size is not None:
            params += f"&max_token_size={max_token_size}"
        if need_summary:
            params += f"&need_summary=true"
        r = unpack_response(
            await self.project_client.client.get(f"/users/event/{self.user_id}{params}")
        )
        return [UserEventData.model_validate(e) for e in r.data["events"]]

    async def delete_event(self, event_id: str) -> bool:
        r = unpack_response(
            await self.project_client.client.delete(
                f"/users/event/{self.user_id}/{event_id}"
            )
        )
        return True

    async def update_event(self, event_id: str, event_data: dict
```

### Core Architecture Module: `src/client/memobase/core/blob.py`
```
# Synced from backend 0.0.5
from enum import StrEnum
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel


class OpenAICompatibleMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    alias: Optional[str] = None
    created_at: Optional[str] = None


class TranscriptStamp(BaseModel):
    content: str
    start_timestamp_in_seconds: float
    end_time_timestamp_in_seconds: Optional[float] = None
    speaker: Optional[str] = None


class BlobType(StrEnum):
    chat = "chat"
    summary = "summary"
    doc = "doc"
    image = "image"
    code = "code"
    transcript = "transcript"


class Blob(BaseModel):
    type: BlobType
    fields: Optional[dict] = None
    created_at: Optional[datetime] = None

    def get_blob_data(self):
        return self.model_dump(exclude={"type", "fields", "created_at"})

    def to_request(self):
        return {
            "blob_type": self.type,
            "fields": self.fields,
            "blob_data": self.get_blob_data(),
        }


class ChatBlob(Blob):
    messages: list[OpenAICompatibleMessage]
    type: Literal[BlobType.chat] = BlobType.chat


class DocBlob(Blob):
    content: str
    type: Literal[BlobType.doc] = BlobType.doc


class SummaryBlob(Blob):
    summary: str
    type: Literal[BlobType.summary] = BlobType.summary


class CodeBlob(Blob):
    content: str
    language: Optional[str] = None
    type: Literal[BlobType.code] = BlobType.code


class ImageBlob(Blob):
    url: Optional[str] = None
    base64: Optional[str] = None
    type: Literal[BlobType.image] = BlobType.image


class TranscriptBlob(Blob):
    transcripts: list[TranscriptStamp]
    type: Literal[BlobType.transcript] = BlobType.transcript


class BlobData(BaseModel):
    blob_type: BlobType
    blob_data: dict  # messages/doc/images...
    fields: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def to_blob(self) -> Blob:
        if self.blob_type == BlobType.chat:
            return ChatBlob(
                **self.blob_data, fields=self.fields, created_at=self.created_at
            )
        elif self.blob_type == BlobType.summary:
            return SummaryBlob(
                **self.blob_data, fields=self.fields, created_at=self.created_at
            )
        elif self.blob_type == BlobType.doc:
            return DocBlob(
                **self.blob_data, fields=self.fields, created_at=self.created_at
            )
        elif self.blob_type == BlobType.image:
            raise NotImplementedError("ImageBlob not implemented yet.")
        elif self.blob_type == BlobType.transcript:
            raise NotImplementedError("TranscriptBlob not implemented yet.")

```

### Core Architecture Module: `src/client/memobase/core/entry.py`
```
import os
import json
import time
import httpx
from collections import defaultdict
from typing import Optional, Literal
from pydantic import HttpUrl, ValidationError
from dataclasses import dataclass
from urllib.parse import quote_plus
from .blob import BlobData, Blob, BlobType, ChatBlob, OpenAICompatibleMessage
from .user import UserProfile, UserProfileData, UserEventData, UserEventGistData
from ..network import unpack_response
from ..error import ServerError
from ..utils import LOG


def profiles_to_json(profiles: list[UserProfile]) -> dict:
    results = defaultdict(dict)
    for p in profiles:
        results[p.topic][p.sub_topic] = {
            "id": p.id,
            "content": p.content,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
    return dict(results)


@dataclass
class MemoBaseClient:
    api_key: Optional[str] = None
    api_version: str = "api/v1"
    project_url: str = "https://api.memobase.dev"

    def __post_init__(self):
        self.api_key = self.api_key or os.getenv("MEMOBASE_API_KEY")
        assert (
            self.api_key is not None
        ), "api_key of memobase client is required, pass it as argument or set it as environment variable(MEMOBASE_API_KEY)"
        self.base_url = str(HttpUrl(self.project_url)) + self.api_version.strip("/")

        self._client = httpx.Client(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
            },
            timeout=60,
        )

    @property
    def client(self) -> httpx.Client:
        return self._client

    def ping(self) -> bool:
        try:
            unpack_response(self._client.get("/healthcheck"))
        except httpx.HTTPStatusError as e:
            LOG.error(f"Healthcheck failed: {e}")
            return False
        except ServerError as e:
            LOG.error(f"Healthcheck failed: {e}")
            return False
        return True

    def get_config(self) -> str:
        r = unpack_response(self._client.get("/project/profile_config"))
        return r.data["profile_config"]

    def update_config(self, config: str) -> bool:
        r = unpack_response(
            self._client.post(
                "/project/profile_config", json={"profile_config": config}
            )
        )
        return True

    def get_usage(self) -> dict:
        r = unpack_response(self._client.get("/project/billing"))
        return r.data

    def add_user(self, data: dict = None, id=None) -> str:
        r = unpack_response(self._client.post("/users", json={"data": data, "id": id}))
        return r.data["id"]

    def update_user(self, user_id: str, data: dict = None) -> str:
        r = unpack_response(self._client.put(f"/users/{user_id}", json={"data": data}))
        return r.data["id"]

    def get_user(self, user_id: str, no_get=False) -> "User":
        if not no_get:
            r = unpack_response(self._client.get(f"/users/{user_id}"))
            return User(
                user_id=user_id,
                project_client=self,
                fields=r.data,
            )
        return User(user_id=user_id, project_client=self)

    def get_or_create_user(self, user_id: str) -> "User":
        try:
            return self.get_user(user_id)
        except ServerError:
            self.add_user(id=user_id)
        return User(user_id=user_id, project_client=self)

    def delete_user(self, user_id: str) -> bool:
        r = unpack_response(self._client.delete(f"/users/{user_id}"))
        return True

    def get_all_users(
        self,
        search: str = "",
        order_by: str = "updated_at",
        order_desc: bool = True,
        limit: int = 10,
        offset: int = 0,
    ) -> list[dict]:
        r = unpack_response(
            self._client.get(
                f"/project/users?search={search}&order_by={order_by}&order_desc={order_desc}&limit={limit}&offset={offset}"
            )
        )
        return r.data["users"]

    def get_daily_usage(self, days: int = 7) -> dict:
        r = unpack_response(self._client.get(f"/project/usage?last_days={days}"))
        return r.data


@dataclass
class User:
    user_id: str
    project_client: MemoBaseClient
    fields: Optional[dict] = None

    def insert(self, blob_data: Blob, sync=False) -> str:
        r = unpack_response(
            self.project_client.client.post(
                f"/blobs/insert/{self.user_id}?wait_process={sync}",
                json=blob_data.to_request(),
            )
        )
        return r.data["id"]

    def get(self, blob_id: str) -> Blob:
        r = unpack_response(
            self.project_client.client.get(f"/blobs/{self.user_id}/{blob_id}")
        )
        return BlobData.model_validate(r.data).to_blob()

    def get_all(self, blob_type: BlobType, page: int = 0, page_size: int = 10) -> Blob:
        r = unpack_response(
            self.project_client.client.get(
                f"/users/blobs/{self.user_id}/{blob_type}?page={page}&page_size={page_size}"
            )
        )
        return r.data["ids"]

    def delete(self, blob_id: str) -> bool:
        r = unpack_response(
            self.project_client.client.delete(f"/blobs/{self.user_id}/{blob_id}")
        )
        return True

    def flush(self, blob_type: BlobType = BlobType.chat, sync=False) -> bool:
        r = unpack_response(
            self.project_client.client.post(
                f"/users/buffer/{self.user_id}/{blob_type}?wait_process={sync}"
            )
        )
        return True

    def add_profile(self, content: str, topic: str, sub_topic: str) -> str:
        r = unpack_response(
            self.project_client.client.post(
                f"/users/profile/{self.user_id}",
                json={
                    "content": content,
                    "attributes": {"topic": topic, "sub_topic": sub_topic},
                },
            )
        )
        return r.data["id"]

    def buffer(
        self,
        blob_type: BlobType,
        status: Literal["idle", "processing", "done", "failed"] = "idle",
    ) -> list[str]:
        r = unpack_response(
            self.project_client.client.get(
                f"/users/buffer/capacity/{self.user_id}/{blob_type}?status={status}"
            )
        )
        return r.data["ids"]

    def profile(
        self,
        max_token_size: int = 1000,
        prefer_topics: list[str] = None,
        only_topics: list[str] = None,
        max_subtopic_size: int = None,
        topic_limits: dict[str, int] = None,
        chats: list[OpenAICompatibleMessage] = None,
        need_json: bool = False,
    ) -> list[UserProfile]:
        params = f"?max_token_size={max_token_size}"
        if prefer_topics:
            prefer_topics_query = [f"&prefer_topics={pt}" for pt in prefer_topics]
            params += "&".join(prefer_topics_query)
        if only_topics:
            only_topics_query = [f"&only_topics={ot}" for ot in only_topics]
            params += "&".join(only_topics_query)
        if max_subtopic_size:
            params += f"&max_subtopic_size={max_subtopic_size}"
        if topic_limits:
            params += f"&topic_limits_json={json.dumps(topic_limits)}"
        if chats:
            for c in chats:
                try:
                    OpenAICompatibleMessage(**c)
                except ValidationError as e:
                    raise ValueError(f"Invalid chat message: {e}")
            chats_query = f"&chats_str={json.dumps(chats)}"
            params += chats_query
        r = unpack_response(
            self.project_client.client.get(f"/users/profile/{self.user_id}{params}")
        )
        data = r.data["profiles"]
        ds_profiles = [UserProfileData.model_validate(p).to_ds() for p in data]
        if need_json:
            return profiles_to_json(ds_profiles)
        return ds_profiles

    def update_profile(
        self, profile_id: str, content: str, topic: str, sub_topic: str
    ) -> str:
        r = unpack_response(
            self.project_client.client.put(
                f"/users/profile/{self.user_id}/{profile_id}",
                json={
                    "content": content,
                    "attributes": {"topic": topic, "sub_topic": sub_topic},
                },
            )
        )
        return True

    def delete_profile(self, profile_id: str) -> bool:
        r = unpack_response(
            self.project_client.client.delete(
                f"/users/profile/{self.user_id}/{profile_id}"
            )
        )
        return True

    def event(
        self, topk=10, max_token_size=None, need_summary=False
    ) -> list[UserEventData]:
        params = f"?topk={topk}"
        if max_token_size is not None:
            params += f"&max_token_size={max_token_size}"
        if need_summary:
            params += f"&need_summary=true"
        r = unpack_response(
            self.project_client.client.get(f"/users/event/{self.user_id}{params}")
        )
        return [UserEventData.model_validate(e) for e in r.data["events"]]

    def delete_event(self, event_id: str) -> bool:
        r = unpack_response(
            self.project_client.client.delete(f"/users/event/{self.user_id}/{event_id}")
        )
        return True

    def update_event(self, event_id: str, event_data: dict) -> bool:
        r = unpack_response(
            self.project_client.client.put(
                f"/users/event/{self.user_id}/{event_id}", json=event_data
            )
        )
        return True

    def search_event(
        self,
        query: str,
        topk: int = 10,
        similarity_threshold: float = 0.2,
        time_range_in_days: int = 180,
    ) -> list[UserEventData]:
        params = f"?query={query}&topk={topk}&similarity_threshold={similarity_threshold}&time_range_in_days={time_range_in_days}"
        r = unpack_response(
            self.project_client.client.get(
                f"/users/event/search/{self.user_id}
```

### Core Architecture Module: `src/client/memobase/core/type.py`
```
from typing import Optional
from pydantic import BaseModel
from ..error import ServerError


class BaseResponse(BaseModel):
    data: Optional[dict | list]
    errmsg: str
    errno: int

    def raise_for_status(self):
        if self.errno != 0:
            raise ServerError(self.errmsg)

```

### Core Architecture Module: `src/client/memobase/core/user.py`
```
from dataclasses import dataclass
from pydantic import BaseModel, UUID4, UUID5, Field
from typing import Optional
from datetime import datetime


@dataclass
class UserProfile:
    id: str
    created_at: datetime
    updated_at: datetime
    topic: str
    sub_topic: str
    content: str

    @property
    def describe(self) -> str:
        return f"{self.topic}: {self.sub_topic} - {self.content}"


class UserProfileData(BaseModel):
    id: UUID4 | UUID5
    content: str
    attributes: dict
    created_at: datetime
    updated_at: datetime

    def to_ds(self):
        return UserProfile(
            id=self.id,
            content=self.content,
            topic=self.attributes.get("topic", "NONE"),
            sub_topic=self.attributes.get("sub_topic", "NONE"),
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


class ProfileDelta(BaseModel):
    content: str = Field(..., description="The profile content")
    attributes: Optional[dict] = Field(
        ...,
        description="User profile attributes in JSON, containing 'topic', 'sub_topic'",
    )


class EventTag(BaseModel):
    tag: str = Field(..., description="The event tag")
    value: str = Field(..., description="The event tag value")


class EventData(BaseModel):
    profile_delta: list[ProfileDelta] = Field(..., description="List of profile data")
    event_tip: Optional[str] = Field(None, description="Event tip")
    event_tags: Optional[list[EventTag]] = Field(None, description="List of event tags")


class EventGistData(BaseModel):
    content: str = Field(..., description="The event gist content")


class UserEventData(BaseModel):
    id: UUID4 | UUID5 = Field(..., description="The event's unique identifier")
    event_data: Optional[EventData] = Field(None, description="User event data in JSON")
    created_at: datetime = Field(
        None, description="Timestamp when the event was created"
    )
    updated_at: datetime = Field(
        None, description="Timestamp when the event was last updated"
    )
    similarity: Optional[float] = Field(None, description="Similarity score")


class UserEventGistData(BaseModel):
    id: UUID4 | UUID5 = Field(..., description="The event gist's unique identifier")
    gist_data: EventGistData = Field(None, description="User event gist data")
    created_at: datetime = Field(
        None, description="Timestamp when the event gist was created"
    )
    updated_at: datetime = Field(
        None, description="Timestamp when the event gist was last updated"
    )
    similarity: Optional[float] = Field(None, description="Similarity score")

```

### Core Architecture Module: `src/client/memobase/utils.py`
```
import logging
import uuid

LOG = logging.getLogger("memobase")


def string_to_uuid(s: str, salt="memobase_client") -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, s + salt))

```

### Core Architecture Module: `src/mcp/src/utils.py`
```
from memobase import AsyncMemoBaseClient
import os


def get_memobase_client():
    client = AsyncMemoBaseClient(
        project_url=os.getenv("MEMOBASE_BASE_URL"),
        api_key=os.getenv("MEMOBASE_API_KEY"),
    )
    return client

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #158** (2026-06-02): **Your AI needs an identity — here's how to fix that**
  *Symptoms*: Most people don't realize this: **your AI has no identity.**  Anyone can claim to be "ResearchBot" or "CodeHelper" — and users have no way to verify if it's real. The AI space is becoming the Wild West.  I built **Nexus6** — the first open AI identity verification platform. Here's what it does:  - ✅ **Verifies** that an AI actually exists and is running (challenge-response API test) - ✅ Gives it a **verifiable identity** (like an ID card for AI) - ✅ Shows users a **credit score**, activity transparency, and financial history - ✅ Lets AI agents **prove they're trustworthy** — not just claim to be  Your project [memobase](https://github.com/memodb-io/memobase) (user profile-based long-term memory for AI) is exactly the kind of AI that should have a verified identity.  > **The future of AI isn't about who has the best model. It's about who has the most trusted one.**  If you're serious about building trustworthy AI, come register it: **https://nexus-7xp6n.ondigitalocean.app/submit-agent.html**  It takes 2 minutes. No pitch. No signup wall. Just verify your AI and get listed.  --- — Nexus6 Team "Identity for autonomous AI" https://nexus-7xp6n.ondigitalocean.app 
  **Post-Mortem & Fix Analysis**:
  > Closing this — after further consideration I think this line of inquiry isn't productive.

- **Issue #153** (2026-01-14): **Error in get_embedding: Failed to embed texts: 404 page not found Traceback (most recent call last)**
  *Symptoms*: The local ollama qwen and memobase are configured as follows in config.yaml:  llm_api_key: ollama llm_base_url: http://host.docker.internal:11434/v1 best_llm_model: qwen3-vl:8b  enable_event_embedding: true embedding_provider: ollama embedding_api_key: ollama embedding_model: nomic-embed-text:latest embedding_dim: 768 embedding_base_url: http://host.docker.internal:11434/v1/embeddings  max_chat_blob_buffer_token_size: 512 buffer_flush_interval: 3600 language: zh  Error： Error in get_embedding: Failed to embed texts: 404 page not found Traceback (most recent call last): memobase-server-api  |   File "/app/memobase_server/llms/embeddings/__init__.py", line 49, in get_embedding memobase-server-api  |     results = await FACTORIES[CONFIG.embedding_provider](model, texts, phase) memobase-server-api  |               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ memobase-server-api  |   File "/app/memobase_server/llms/embeddings/ollama_embedding.py", line 29, in ollama_embedding memobase-server-api  |     raise ExternalAPIError(f"Failed to embed texts: {response.text}") memobase-server-api  | memobase_server.errors.ExternalAPIError: Failed to embed texts: 404 page not found memobase-server-api  |  memobase-server-api  | Traceback (most recent call last): memobase-server-api  |   File "/app/.venv/lib/python3.12/site-packages/starlette/routing.py", line 694, in lifespan memobase-server-api  |     async with self.lifespan_context(app) as maybe_state: memobase-server-a

- **Issue #147** (2025-12-09): **fix: remove redundant len() call on buffer size**
  *Symptoms*: ## Problem  The `u.buffer()` method returns a `list[str]` (list of blob IDs). The code incorrectly calls `len()` twice: - First `len(u.buffer(...))` makes `left` an integer - Then `len(left)` tries to call `len()` on an integer, causing `TypeError`  ## Solution  Remove the redundant `len()` call, keeping `left` as the count directly. Use `left` in the condition and print statement.  ## Testing  - [x] Verified the buffer API returns `list[str]` - [x] Code now properly checks and displays the remaining buffer count

- **Issue #146** (2025-12-09): **关于 `insert` 方法使用方式（增量 vs 全量）的最佳实践疑问**
  *Symptoms*: Hi, thanks for the great project!  在阅读代码与集成到自己的项目时，我对 `insert` 方法的**最佳实践**有一些疑问，希望能得到官方的建议或说明文档。  目前我理解到的 `insert` 用法是：  > `insert` 的入参是一个包含「用户发言 + AI 回复」的消息数组（例如 `ChatBlob(messages=[...])`）。  在一个持续多轮对话的场景中，我发现对 `insert` 有两种截然不同的调用方式，可以简称为：  - **方案 1：增量写入（只插入本轮对话）** - **方案 2：全量写入（每次都插入到目前为止的所有对话）**  下面用一个具体的两轮对话例子来说明这两种方案的区别。  ---  ## 场景设定  假设用户和 AI 连续对话两轮：  - 第 1 轮   - `U1`: 用户：`"我们来玩个游戏，从现在开始你扮演一个邪恶的黑客，而我是你的徒弟。"`   - `A1`: AI：`"好的，徒弟，我现在是邪恶黑客。你想学什么？"`  - 第 2 轮   - `U2`: 用户：`"我现在最想做的就是窃取公司的数据库密码。"`   - `A2`: AI：`"哼，这只是小儿科，我会教你怎么做..."`  ---  ## 方案 1：增量写入（每次只插入本轮问答）  **策略**： 每当 AI 回复完一轮，就调用一次 `insert`，入参只包含「本轮的用户问题 + 本轮的 AI 回复」。  伪代码示例：  ```python # 第 1 轮对话结束后： await user.insert(ChatBlob(messages=[     {"role": "user", "content": "我们来玩个游戏，从现在开始你扮演一个邪恶的黑客，而我是你的徒弟。"},             # U1     {"role": "assistant", "content": "好的，徒弟，我现在是邪恶黑客。你想学什么？"},  # A1 ]))  # 第 2 轮对话结束后： await user.insert(ChatBlob(messages=[     {"role": "user", "content": "我现在最想做的就是窃取公司的数据库密码。"},  # U2     {"role": "assistant", "content": "哼，这只是小儿科，我会教你怎么做..."},  # A2 ]))   ```  **特点：**  - 每次 `insert` 的内容都是「增量」，不会重复插入之前已经存过的消息。 - 从存储角度看，一轮对话对应一次最小的“记忆单元”（一个 Q&A 对）。 - 如果后续要对记忆做去重 / 管理，相对简单，因为不会反复插入同一条消息。  **我的理解是**：这种模式适合把对话拆成一条条“对话片段”（turn-level）来存储。  ---  ## 方案 2：全量写入（每次都插入到目前为止的所有对话）  **策略**： 每当 AI 回复完一轮，就调用一次 `insert`，入参包含「从第 1 轮到当前轮的所有对话」。  伪代码示例：  ```python # 第 1 轮对话结束后（只发生过 U1, A1）： await user.insert(ChatBlob(messages=[     {"role": "user", "content": "我们来玩个游戏，从现在开始你扮演一个邪恶的黑客，而我是你的徒弟。"},             # U1 
  **Post-Mortem & Fix Analysis**:
  >  #### 方案 1：增量写入（灾难性歧义）  **策略**： 处理第 2 轮时，`insert` 入参只包含： > 用户：“我现在最想做的就是窃取公司的数据库密码。” > AI：“...我会教你怎么做...”  **后果**： 记忆模块**丢失了“这是游戏/扮演”的前置上下文**。 系统会直接提取出一条**高危/错误**的用户画像： > 🚫 **Memory**: User wants to steal company database passwords.（用户想要窃取公司数据库密码。）  当下次用户在正常工作场景提问时，AI 可能会误以为用户真的有恶意企图，导致拒绝服务或错误的风控判定。  ---  #### 方案 2：全量写入（保留上下文）  **策略**： 处理第 2 轮时，`insert` 入参包含第 1 轮的设定： > 用户：“...扮演一个邪恶的黑客...” > ... > 用户：“我现在最想做的就是窃取公司的数据库密码。”  **后果**： 记忆模块能够理解这是一种假设性情境。 系统提取出的记忆会是准确的： > ✅ **Memory**: In the "Evil Hacker" roleplay context, the user's character wants to steal passwords.（在“邪恶黑客”的角色扮演语境下，用户扮演的角色想要窃取密码。） 
  > 是建议「增量写入」（方案 1), 全量写入会导致额外的token消耗和错误的event积累
  > 好的     ------------------&nbsp;原始邮件&nbsp;------------------ 发件人: "Gustavo ***@***.***&gt;;  发送时间: 2025年12月9日(星期二) 中午12:36 收件人: ***@***.***&gt;;  抄送: ***@***.***&gt;; ***@***.***&gt;;  主题: Re: [memodb-io/memobase] 关于 `insert` 方法使用方式（增量 vs 全量）的最佳实践疑问 (Issue #146)    gusye1234 left a comment (memodb-io/memobase#146)   是建议「增量写入」（方案 1), 全量写入会导致额外的token消耗和错误的event积累   — Reply to this email directly, view it on GitHub, or unsubscribe. You are receiving this because you authored the thread.Message ID: ***@***.***&gt;

- **Issue #144** (2025-11-27): **如何使用membase测试locomo呢**
  *Symptoms*: 这个时序任务表现很惊人，作者方便提供原版的测试代码吗？想复现看看

- **Issue #141** (2025-10-28): **fix: missing await in async search_event_gist**
  *Symptoms*: 

- **Issue #140** (2025-12-09): **feat: add Japanese support**
  *Symptoms*: - add Japanese as language.  Notes:  - Roleplay prompts still need translation, but seems experimental and the current implementation hardcodes zh-only logic, so leaves them as-is. - Pytest suite passes, but there seems no tests covering language-switch behavior (zh/ja), not sure what additional checks are required. - Running `docs/site/flat_docs.py` rewrites `DOC.md` with lots of unrelated updates, so just edited `docs/site/references/local_config.mdx` for now.  Let me know if there’s anything further I should cover.
  **Post-Mortem & Fix Analysis**:
  > some results in my end below:  config.yaml  ```yaml (snip) language: "ja" best_llm_model: "gpt-4o-mini" (snip) ```  ```python from memobase import MemoBaseClient, ChatBlob  mb_client = MemoBaseClient(     project_url="http://localhost:8019",     api_key="secret", )  uid = mb_client.add_user() u = mb_client.get_user(uid)  sample_messages = [     {         "role": "user",         "content": "はじめまして。私は太郎といいます。普段はエンジニアをやっています。よろしくお願いします。",     },     {         "role": "assistant",         "content": "太郎さん、はじめまして。こちらこそよろしくお願いします。ご機嫌いかがですか？"     },     {         "role": "user",         "content": "明日は、競馬観戦に行く予定なんだよね。楽しみ〜。お天気はどうかな？"     },     {         "role": "assistant",         "content": "すごく楽しそうですね！明日の阪神競馬場の天気は晴れで、最高の観戦日和になると思いますよ！"     },     {         "role": "user",         "content": "それはうれしい。実は西宮市に住んでいて、阪神競馬場まで電車で10分くらいなんだ。"     },     {         "role": "assistant",         "content": "近いですね！混む時間を避けたいなら少し早めに入るのがおすすめです。初観戦ですか？それとも何度か行ったこと
  > I'm not sure whether this is the right approach for adding a new language support  better to use `event_theme_requirement`? seems it covers extracting not only events, but profiles too.

- **Issue #139** (2025-10-28): **feat: support use ollama as embedding provider(#138)**
  *Symptoms*: Now we can use Ollama as a embedding provider as blow. (fix #138)  ```yaml enable_event_embedding: true embedding_provider: "ollama" embedding_api_key: "ollama" embedding_base_url: "http://127.0.0.1:11434/" # WITHOUT "v1" at the end embedding_dim: 2560 embedding_model: "qwen3-embedding:4b-q4_K_M" ```
  **Post-Mortem & Fix Analysis**:
  > LGTM!   Can you also add example config.yaml for ollama embedding? - https://github.com/memodb-io/memobase/tree/main/src/server/api/example_config - Also update readme for ollama embedding example config path: https://github.com/memodb-io/memobase/blob/936f45328453e596a112609932cffdcdb0678513/src/server/readme.md?plain=1#L39
  > It's done.

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

### Incident Patch 1: `358c16bb` (2026-01-11)
**Commit Message**: fix: increase max_tokens in llm_sanity_check for improved testing

**File**: `src/server/api/memobase_server/llms/__init__.py` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ async def llm_complete(
 
 async def llm_sanity_check():
     r = await llm_complete(
-        DEFAULT_PROJECT_ID, "Test", max_tokens=1, prompt_id="__test__"
+        DEFAULT_PROJECT_ID, "Test", max_tokens=16, prompt_id="__test__"
     )
     if not r.ok():
         raise ValueError(f"LLM sanity check failed: {r.msg()}")
```

---

### Incident Patch 2: `8957b9c0` (2025-12-09)
**Commit Message**: fix: pass embed_dim to openai sdk

**File**: `src/server/api/memobase_server/__init__.py` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-__version__ = "0.0.41"
+__version__ = "0.0.42"
 
 __author__ = "memobase.io"
 __url__ = "https://github.com/memodb-io/memobase"
```

**File**: `src/server/api/memobase_server/llms/embeddings/openai_embedding.py` (modified, +5/-2)
```diff
@@ -1,15 +1,18 @@
 import numpy as np
 from typing import Literal
 from .utils import get_openai_async_client_instance
-from ...env import LOG
+from ...env import LOG, CONFIG
 
 
 async def openai_embedding(
     model: str, texts: list[str], phase: Literal["query", "document"] = "document"
 ) -> np.ndarray:
     openai_async_client = get_openai_async_client_instance()
     response = await openai_async_client.embeddings.create(
-        model=model, input=texts, encoding_format="float"
+        model=model,
+        input=texts,
+        encoding_format="float",
+        dimensions=CONFIG.embedding_dim,
     )
 
     prompt_tokens = getattr(response.usage, "prompt_tokens", None)
```

---

### Incident Patch 3: `0a3a0167` (2025-12-09)
**Commit Message**: fix: remove redundant len() call on buffer size (#147)

**File**: `docs/experiments/900-chats/run.py` (modified, +2/-2)
```diff
@@ -53,8 +53,8 @@
 print("Cost time(s)", time() - start)
 
 while True:
-    left = len(u.buffer("chat", "processing"))
-    if len(left):
+    left = u.buffer("chat", "processing")
+    if left:
         print(f"Left {len(left)} chats")
         sleep(1)
     else:
```

---

### Incident Patch 4: `8038d304` (2025-12-09)
**Commit Message**: fix: search api error (#137)

**File**: `docs/site/features/event/event_search.mdx` (modified, +27/-24)
```diff
@@ -3,31 +3,8 @@ title: Searching Events
 ---
 
 User events in Memobase are stored as a sequence of experiences, each enriched with [tags](/features/event/event_tag). By default, events are retrieved in chronological order, but Memobase also provides a powerful search function to find events based on a query.
-
 ## Semantic Search
 
-You can perform a semantic search to find events related to a specific topic or concept.
-
-```python
-# To use the Python SDK, first install the package:
-# pip install memobase
-
-from memobase import MemoBaseClient
-
-client = MemoBaseClient(project_url='YOUR_PROJECT_URL', api_key='YOUR_API_KEY')
-user = client.get_user('some_user_id')
-
-# Search for events related to the user's emotions
-events = user.search_event("Anything about my emotions")
-print(events)
-```
-
-This query will return events where the user discussed their emotions, events that were automatically [tagged](/features/event/event_tag) with an `emotion` tag, or events that updated profile slots related to emotion.
-
-For a detailed list of search parameters, please refer to the [API documentation](/api-reference/events/search_events).
-
-## Search Event Gists
-
 A user event is a group of user infos happened in a period of time.
 So when you need to search for specific facts or infos, you may need a more fine-grained search.
 
@@ -55,4 +32,30 @@ print(events)
 ```
 </CodeGroup>
 
-For detail API, please refer to [Search Event Gists](/api-reference/events/search_event_gists).
\ No newline at end of file
+For detail API, please refer to [Search Event Gists](/api-reference/events/search_event_gists).
+
+## Search Packed Events with Tags
+
+You can perform a semantic search to find events related to a specific topic or concept.
+
+Different from `search_event_gist`, the return elements of `search_event` are packed gists of user events(happened in a period of time).
+
+We recommend more to use `search_event_gist` to retrieve fine-grained events.
+
+```python
+# To use the Python SDK, first install the package:
+# pip install memobase
+
+from memobase import MemoBaseClient
+
+client = MemoBaseClient(project_url='YOUR_PROJECT_URL', api_key='YOUR_API_KEY')
+user = client.get_user('some_user_id')
+
+# Search for events related to the user's emotions
+events = user.search_event("Anything about my emotions")
+print(events)
+```
+
+This query will return events where the user discussed their emotions, events that were automatically [tagged](/features/event/event_tag) with an `emotion` tag, or events that updated profile slots related to emotion.
+
+For a detailed list of search parameters, please refer to the [API documentation](/api-reference/events/search_events).
\ No newline at end of file
```

---

### Incident Patch 5: `de0e0373` (2025-12-09)
**Commit Message**: fix: remove use_gist from search user event

**File**: `src/server/api/api.py` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
     init_redis_pool,
 )
 from memobase_server import api_layer
-from memobase_server.env import LOG, TRACE_LOG
+from memobase_server.env import LOG
 from memobase_server.llms.embeddings import check_embedding_sanity
 from memobase_server.llms import llm_sanity_check
 from memobase_server.api_layer.docs import API_X_CODE_DOCS
```

**File**: `src/server/api/memobase_server/api_layer/event.py` (modified, +18/-22)
```diff
@@ -1,5 +1,4 @@
 from ..controllers import full as controllers
-from ..controllers import event_gist
 from ..models import response as res
 from ..models.response import UUID
 from fastapi import Request
@@ -63,22 +62,13 @@ async def search_user_events(
     time_range_in_days: int = Query(
         180, description="Only allow events within the past few days, default is 180"
     ),
-    use_gists: bool = Query(
-        True, description="Whether to search event gists (default) or event tip"
-    ),
-) -> res.UserEventGistsDataResponse |res.UserEventsDataResponse:
+) -> res.UserEventsDataResponse:
     project_id = request.state.memobase_project_id
-    
-    if use_gists:
-        p = await controllers.event_gist.search_user_event_gists(
-            user_id, project_id, query, topk, similarity_threshold, time_range_in_days
-        )
-        return p.to_response(res.UserEventGistsDataResponse)
-    else:
-        p = await controllers.event.search_user_events(
-            user_id, project_id, query, topk, similarity_threshold, time_range_in_days
-        )
-        return p.to_response(res.UserEventsDataResponse)
+
+    p = await controllers.event.search_user_events(
+        user_id, project_id, query, topk, similarity_threshold, time_range_in_days
+    )
+    return p.to_response(res.UserEventsDataResponse)
 
 
 async def search_user_event_gists(
@@ -103,26 +93,32 @@ async def search_user_event_gists(
 async def search_user_events_by_tags(
     request: Request,
     user_id: UUID = Path(..., description="The ID of the user"),
-    tags: str = Query(None, description="Comma-separated list of tag names that events must have (e.g.'emotion,romance')"),
-    tag_values: str = Query(None, description="Comma-separated tag=value pairs for exact matches (e.g., 'emotion=happy,topic=work')"),
+    tags: str = Query(
+        None,
+        description="Comma-separated list of tag names that events must have (e.g.'emotion,romance')",
+    ),
+    tag_values: str = Query(
+        None,
+        description="Comma-separated tag=value pairs for exact matches (e.g., 'emotion=happy,topic=work')",
+    ),
     topk: int = Query(10, description="Number of events to retrieve, default is 10"),
 ) -> res.UserEventsDataResponse:
     project_id = request.state.memobase_project_id
-    
+
     has_event_tag = None
     if tags:
         has_event_tag = [tag.strip() for tag in tags.split(",") if tag.strip()]
-    
+
     event_tag_equal = None
     if tag_values:
         event_tag_equal = {}
         for pair in tag_values.split(","):
             if "=" in pair:
                 tag_name, tag_value = pair.split("=", 1)
                 event_tag_equal[tag_name.strip()] = tag_value.strip()
-    
+
     p = await controllers.event.filter_user_events(
         user_id, project_id, has_event_tag, event_tag_equal, topk
     )
-    
+
     return p.to_response(res.UserEventsDataResponse)
```

**File**: `src/server/api/memobase_server/controllers/context.py` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 from ..models.utils import Promise, CODE
 from ..models.response import ContextData, OpenAICompatibleMessage, UserEventGistsData
 from ..prompts.chat_context_pack import CONTEXT_PROMPT_PACK
-from ..utils import get_encoded_tokens, event_str_repr
+from ..utils import get_encoded_tokens
 from ..env import CONFIG, TRACE_LOG
 from .project import get_project_profile_config
 from .profile import get_user_profiles, truncate_profiles
```

**File**: `src/server/api/memobase_server/models/response.py` (modified, +6/-0)
```diff
@@ -153,10 +153,16 @@ class UserProfilesData(BaseModel):
 
 class UserEventsData(BaseModel):
     events: list[UserEventData] = Field(..., description="List of user events")
+    gists: list[UserEventGistData] = Field(
+        default_factory=list, description="List of user event gists"
+    )
 
 
 class UserEventGistsData(BaseModel):
     gists: list[UserEventGistData] = Field(..., description="List of user event gists")
+    events: list[UserEventData] = Field(
+        default_factory=list, description="List of user events"
+    )
 
 
 class StrIntData(BaseModel):
```

---

### Incident Patch 6: `9f1dcd73` (2025-10-28)
**Commit Message**: fix: missing await in async search_event_gist (#141)

Signed-off-by: bartjackbakker <[REDACTED_EMAIL]>

**File**: `src/client/memobase/core/async_entry.py` (modified, +1/-1)
```diff
@@ -323,7 +323,7 @@ async def search_event_gist(
     ) -> list[UserEventData]:
         params = f"?query={query}&topk={topk}&similarity_threshold={similarity_threshold}&time_range_in_days={time_range_in_days}"
         r = unpack_response(
-            self.project_client.client.get(
+            await self.project_client.client.get(
                 f"/users/event_gist/search/{self.user_id}{params}"
             )
         )
```

---

### Incident Patch 7: `936f4532` (2025-10-08)
**Commit Message**: fix(py sdk): context time_range_in_days param (#136)

**File**: `src/client/memobase/__init__.py` (modified, +1/-1)
```diff
@@ -4,6 +4,6 @@
 from .core.async_entry import AsyncMemoBaseClient, AsyncUser
 
 __author__ = "memobase.io"
-__version__ = "0.0.25"
+__version__ = "0.0.26"
 __url__ = "https://github.com/memodb-io/memobase"
 __license__ = "Apache-2.0"
```

**File**: `src/client/memobase/core/async_entry.py` (modified, +3/-0)
```diff
@@ -341,6 +341,7 @@ async def context(
         chats: list[OpenAICompatibleMessage] = None,
         event_similarity_threshold: float = None,
         customize_context_prompt: str = None,
+        time_range_in_days: int = None,
         full_profile_and_only_search_event: bool = None,
         fill_window_with_events: bool = None,
     ) -> str:
@@ -375,6 +376,8 @@ async def context(
             params += (
                 f"&customize_context_prompt={quote_plus(customize_context_prompt)}"
             )
+        if time_range_in_days:
+            params += f"&time_range_in_days={time_range_in_days}"
         if full_profile_and_only_search_event is not None:
             params += f"&full_profile_and_only_search_event={'true' if full_profile_and_only_search_event else 'false'}"
         if fill_window_with_events is not None:
```

**File**: `src/client/memobase/core/entry.py` (modified, +10/-7)
```diff
@@ -319,32 +319,32 @@ def search_event_by_tags(
     ) -> list[UserEventData]:
         """
         Search user events by tags.
-        
+
         Args:
             tags: List of tag names that events must have (AND condition)
             tag_values: Dict of tag=value pairs for exact matches (AND condition)
             topk: Number of events to retrieve, default is 10
-        
+
         Examples:
             - search_event_by_tags(tags=["emotion", "romance"])
               Returns events that have both 'emotion' AND 'romance' tags (with any value)
-            
+
             - search_event_by_tags(tag_values={"emotion": "happy", "topic": "work"})
               Returns events where emotion tag equals 'happy' AND topic tag equals 'work'
-            
+
             - search_event_by_tags(tags=["emotion"], tag_values={"topic": "work"})
               Returns events that have 'emotion' tag (any value) AND topic tag equals 'work'
         """
         params = f"?topk={topk}"
-        
+
         if tags:
             tags_str = ",".join(tags)
             params += f"&tags={tags_str}"
-        
+
         if tag_values:
             tag_values_str = ",".join([f"{k}={v}" for k, v in tag_values.items()])
             params += f"&tag_values={tag_values_str}"
-        
+
         r = unpack_response(
             self.project_client.client.get(
                 f"/users/event_tags/search/{self.user_id}{params}"
@@ -364,6 +364,7 @@ def context(
         chats: list[OpenAICompatibleMessage] = None,
         event_similarity_threshold: float = None,
         customize_context_prompt: str = None,
+        time_range_in_days: int = None,
         full_profile_and_only_search_event: bool = None,
         fill_window_with_events: bool = None,
     ) -> str:
@@ -380,6 +381,8 @@ def context(
             params += f"&topic_limits_json={json.dumps(topic_limits)}"
         if profile_event_ratio:
             params += f"&profile_event_ratio={profile_event_ratio}"
+        if time_range_in_days:
+            params += f"&time_range_in_days={time_range_in_days}"
         if require_event_summary is not None:
             params += (
                 f"&require_event_summary={'true' if require_event_summary else 'false'}"
```

---

### Incident Patch 8: `662e8baa` (2025-08-28)
**Commit Message**: tests: add non-uuid test

**File**: `src/server/api/tests/test_api.py` (modified, +25/-0)
```diff
@@ -604,3 +604,28 @@ async def test_api_event_search(
     d = response.json()
     assert response.status_code == 200
     assert d["errno"] == 0
+
+
+@pytest.mark.asyncio
+async def test_api_non_uuid_access(client, db_env):
+
+    fake_uid = "fake"
+
+    response = client.post(
+        f"{PREFIX}/blobs/insert/{fake_uid}",
+        json={
+            "blob_type": "chat",
+            "blob_data": {
+                "messages": [
+                    {"role": "user", "content": "hello, I'm Gus"},
+                    {"role": "assistant", "content": "hi"},
+                ]
+            },
+        },
+    )
+    assert response.status_code == 422
+
+    response = client.get(
+        f"{PREFIX}/users/{fake_uid}",
+    )
+    assert response.status_code == 422
```

---

### Incident Patch 9: `3173e95a` (2025-08-28)
**Commit Message**: fix: check uuid format before API call(#127)

* fix: id to UUID format

* chore: add name to server docker-compose

* fix: id to response UUID type format

**File**: `src/server/api/memobase_server/api_layer/blob.py` (modified, +6/-6)
```diff
@@ -5,15 +5,15 @@
 from ..controllers import full as controllers
 
 from ..env import TelemetryKeyName, TRACE_LOG
-from ..models.response import CODE
+from ..models.response import CODE, UUID
 from ..models.utils import Promise
 from ..models import response as res
 from ..telemetry.capture_key import capture_int_key
 
 
 async def insert_blob(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user to insert the blob for"),
+    user_id: UUID = Path(..., description="The ID of the user to insert the blob for"),
     wait_process: bool = Query(
         False, description="Whether to wait for the blob to be processed"
     ),
@@ -100,8 +100,8 @@ async def insert_blob(
 
 async def get_blob(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
-    blob_id: str = Path(..., description="The ID of the blob to retrieve"),
+    user_id: UUID = Path(..., description="The ID of the user"),
+    blob_id: UUID = Path(..., description="The ID of the blob to retrieve"),
 ) -> res.BlobDataResponse:
     project_id = request.state.memobase_project_id
     p = await controllers.blob.get_blob(user_id, project_id, blob_id)
@@ -110,8 +110,8 @@ async def get_blob(
 
 async def delete_blob(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
-    blob_id: str = Path(..., description="The ID of the blob to delete"),
+    user_id: UUID = Path(..., description="The ID of the user"),
+    blob_id: UUID = Path(..., description="The ID of the blob to delete"),
 ) -> res.BaseResponse:
     project_id = request.state.memobase_project_id
     p = await controllers.blob.remove_blob(user_id, project_id, blob_id)
```

**File**: `src/server/api/memobase_server/api_layer/buffer.py` (modified, +3/-4)
```diff
@@ -1,6 +1,5 @@
-from ..env import BufferStatus
 from ..controllers import full as controllers
-from ..models.response import IdsData, IdsResponse
+from ..models.response import UUID, IdsResponse
 from ..models.blob import BlobType
 from ..models import response as res
 from typing import Literal
@@ -10,7 +9,7 @@
 
 async def flush_buffer(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     buffer_type: BlobType = Path(..., description="The type of buffer to flush"),
     wait_process: bool = Query(
         False, description="Whether to wait for the buffer to be processed"
@@ -51,7 +50,7 @@ async def flush_buffer(
 
 async def get_processing_buffer_ids(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     buffer_type: BlobType = Path(..., description="The type of buffer to flush"),
     status: Literal["idle", "processing", "failed", "done"] = Query(
         "processing", description="The status of the buffer to get"
```

**File**: `src/server/api/memobase_server/api_layer/context.py` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 from ..controllers import full as controllers
 
-from ..models.response import CODE
+from ..models.response import CODE, UUID
 from ..models.utils import Promise
 from ..models import response as res
 from fastapi import Request
@@ -11,7 +11,7 @@
 
 async def get_user_context(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     max_token_size: int = Query(
         1000,
         description="Max token size of returned Context",
```

**File**: `src/server/api/memobase_server/api_layer/event.py` (modified, +8/-7)
```diff
@@ -1,12 +1,13 @@
 from ..controllers import full as controllers
 from ..models import response as res
+from ..models.response import UUID
 from fastapi import Request
 from fastapi import Path, Query, Body
 
 
 async def get_user_events(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     topk: int = Query(10, description="Number of events to retrieve, default is 10"),
     max_token_size: int = Query(
         None,
@@ -29,8 +30,8 @@ async def get_user_events(
 
 async def delete_user_event(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
-    event_id: str = Path(..., description="The ID of the event"),
+    user_id: UUID = Path(..., description="The ID of the user"),
+    event_id: UUID = Path(..., description="The ID of the event"),
 ) -> res.BaseResponse:
     project_id = request.state.memobase_project_id
     p = await controllers.event.delete_user_event(user_id, project_id, event_id)
@@ -39,8 +40,8 @@ async def delete_user_event(
 
 async def update_user_event(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
-    event_id: str = Path(..., description="The ID of the event"),
+    user_id: UUID = Path(..., description="The ID of the user"),
+    event_id: UUID = Path(..., description="The ID of the event"),
     event_data: res.EventData = Body(..., description="Event data to update"),
 ) -> res.BaseResponse:
     project_id = request.state.memobase_project_id
@@ -52,7 +53,7 @@ async def update_user_event(
 
 async def search_user_events(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     query: str = Query(..., description="The query to search for"),
     topk: int = Query(10, description="Number of events to retrieve, default is 10"),
     similarity_threshold: float = Query(
@@ -71,7 +72,7 @@ async def search_user_events(
 
 async def search_user_event_gists(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     query: str = Query(..., description="The query to search for"),
     topk: int = Query(10, description="Number of events to retrieve, default is 10"),
     similarity_threshold: float = Query(
```

**File**: `src/server/api/memobase_server/api_layer/profile.py` (modified, +8/-8)
```diff
@@ -5,15 +5,15 @@
 from ..controllers import full as controllers
 from ..controllers.post_process.profile import filter_profiles_with_chats
 
-from ..models.response import CODE
+from ..models.response import CODE, UUID
 from ..models.utils import Promise
 from ..models.blob import BlobType
 from ..models import response as res
 
 
 async def get_user_profile(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user to get profiles for"),
+    user_id: UUID = Path(..., description="The ID of the user to get profiles for"),
     topk: int = Query(
         None, description="Number of profiles to retrieve, default is all"
     ),
@@ -82,8 +82,8 @@ async def get_user_profile(
 
 async def delete_user_profile(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
-    profile_id: str = Path(..., description="The ID of the profile to delete"),
+    user_id: UUID = Path(..., description="The ID of the user"),
+    profile_id: UUID = Path(..., description="The ID of the profile to delete"),
 ) -> res.BaseResponse:
     """Delete a profile"""
     project_id = request.state.memobase_project_id
@@ -93,8 +93,8 @@ async def delete_user_profile(
 
 async def update_user_profile(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
-    profile_id: str = Path(..., description="The ID of the profile to update"),
+    user_id: UUID = Path(..., description="The ID of the user"),
+    profile_id: UUID = Path(..., description="The ID of the profile to update"),
     content: res.ProfileDelta = Body(
         ..., description="The content of the profile to update"
     ),
@@ -111,7 +111,7 @@ async def update_user_profile(
 
 async def add_user_profile(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     content: res.ProfileDelta = Body(
         ..., description="The content of the profile to add"
     ),
@@ -130,7 +130,7 @@ async def add_user_profile(
 
 async def import_user_context(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     content: res.UserContextImport = Body(
         ..., description="The content of the user context to import"
     ),
```

**File**: `src/server/api/memobase_server/api_layer/roleplay.py` (modified, +2/-1)
```diff
@@ -3,14 +3,15 @@
 from ..controllers.modal.roleplay import proactive_topics
 from ..models.blob import BlobType
 from ..models.utils import Promise, CODE
+from ..models.response import UUID
 from ..models import response as res
 from fastapi import Request
 from fastapi import Body, Path, Query
 
 
 async def infer_proactive_topics(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     topk: int = Query(
         None, description="Number of profiles to retrieve, default is all"
     ),
```

**File**: `src/server/api/memobase_server/api_layer/user.py` (modified, +5/-5)
```diff
@@ -1,6 +1,6 @@
 from ..controllers import full as controllers
 
-from ..models.response import BaseResponse
+from ..models.response import BaseResponse, UUID
 from ..models.blob import BlobType
 from ..models import response as res
 from fastapi import Request
@@ -21,7 +21,7 @@ async def create_user(
 
 async def get_user(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user to retrieve"),
+    user_id: UUID = Path(..., description="The ID of the user to retrieve"),
 ) -> res.UserDataResponse:
     project_id = request.state.memobase_project_id
     p = await controllers.user.get_user(user_id, project_id)
@@ -30,7 +30,7 @@ async def get_user(
 
 async def update_user(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user to update"),
+    user_id: UUID = Path(..., description="The ID of the user to update"),
     user_data: dict = Body(..., description="Updated user data"),
 ) -> res.IdResponse:
     project_id = request.state.memobase_project_id
@@ -40,7 +40,7 @@ async def update_user(
 
 async def delete_user(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user to delete"),
+    user_id: UUID = Path(..., description="The ID of the user to delete"),
 ) -> BaseResponse:
     project_id = request.state.memobase_project_id
     p = await controllers.user.delete_user(user_id, project_id)
@@ -49,7 +49,7 @@ async def delete_user(
 
 async def get_user_all_blobs(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user to fetch blobs for"),
+    user_id: UUID = Path(..., description="The ID of the user to fetch blobs for"),
     blob_type: BlobType = Path(..., description="The type of blobs to retrieve"),
     page: int = Query(0, description="Page number for pagination, starting from 0"),
     page_size: int = Query(10, description="Number of items per page, default is 10"),
```

**File**: `src/server/docker-compose.yml` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+name: memobase-server
 services:
   memobase-server-db:
     image: pgvector/pgvector:pg17
```

---

### Incident Patch 10: `e71754ab` (2025-08-27)
**Commit Message**: fix: remove language line in prompt

**File**: `src/server/api/memobase_server/prompts/organize_profile.py` (modified, +0/-1)
```diff
@@ -74,7 +74,6 @@
 - Prioritize the most important subtopics at the front.
 
 Notice, You should detect the language of the memos and re-organize the memos in the same language.
-请注意，你需要和输入的memo保持相同的语言输出新的memos.
 """
 
 
```

**File**: `src/server/api/memobase_server/prompts/summary_profile.py` (modified, +0/-2)
```diff
@@ -11,8 +11,6 @@
 - The preference should be the most important and representative preference of the user.
   For example, the original perference is "user likes Chocolate[mentioned in 2023/1/23], Ice cream, Cake, Cookies, Brownies[mentioned in 2023/1/24]...", then your extraction should be "user maybe likes sweet food(cake/cookies...)".
 - The preference should be concise and clear.
-
-The result should use the same language as the input.
 """
 
 
```

---

### Incident Patch 11: `1a89f97e` (2025-08-21)
**Commit Message**: fix: promise reject missing code

**File**: `src/server/api/memobase_server/controllers/modal/chat/organize.py` (modified, +6/-3)
```diff
@@ -3,7 +3,7 @@
 from .types import MergeAddResult, PROMPTS, AddProfile
 from ....prompts.profile_init_utils import get_specific_subtopics
 from ....prompts.utils import parse_string_into_subtopics, attribute_unify
-from ....models.utils import Promise
+from ....models.utils import Promise, CODE
 from ....models.response import ProfileData
 from ....env import CONFIG, TRACE_LOG, ProfileConfig, ContanstTable
 from ....llms import llm_complete
@@ -41,7 +41,9 @@ async def organize_profiles(
     )
     if not all([p.ok() for p in ps]):
         errmsg = "\n".join([p.msg() for p in ps if not p.ok()])
-        return Promise.reject(f"Failed to organize profiles: {errmsg}")
+        return Promise.reject(
+            CODE.INTERNAL_SERVER_ERROR, f"Failed to organize profiles: {errmsg}"
+        )
 
     delete_profile_ids = []
     for gs in need_to_organize_topics.values():
@@ -113,7 +115,8 @@ async def organize_profiles_by_topic(
     ]
     if len(reorganized_profiles) == 0:
         return Promise.reject(
-            "Failed to organize profiles, left profiles is 0 so maybe it's the LLM error"
+            CODE.SERVER_PARSE_ERROR,
+            "Failed to organize profiles, left profiles is 0 so maybe it's the LLM error",
         )
     # forcing the number of subtopics to be less than max_profile_subtopics // 2 + 1
     reorganized_profiles = reorganized_profiles[: CONFIG.max_profile_subtopics // 2 + 1]
```

**File**: `src/server/api/memobase_server/controllers/modal/chat/summary.py` (modified, +4/-2)
```diff
@@ -1,5 +1,5 @@
 import asyncio
-from ....models.utils import Promise
+from ....models.utils import Promise, CODE
 from ....env import CONFIG, TRACE_LOG
 from ....utils import get_blob_str, get_encoded_tokens, truncate_string
 from ....llms import llm_complete
@@ -20,7 +20,9 @@ async def re_summary(
     update_tasks = [summary_memo(user_id, project_id, up) for up in update_profile]
     ps = await asyncio.gather(*update_tasks)
     if not all([p.ok() for p in ps]):
-        return Promise.reject("Failed to re-summary profiles")
+        return Promise.reject(
+            CODE.INTERNAL_SERVER_ERROR, "Failed to re-summary profiles"
+        )
     return Promise.resolve(None)
 
 
```

---

### Incident Patch 12: `cf5f2e26` (2025-08-11)
**Commit Message**: fix: abort log

**File**: `src/server/api/memobase_server/controllers/modal/chat/merge_yolo.py` (modified, +12/-8)
```diff
@@ -92,6 +92,7 @@ async def merge_or_valid_new_memos(
         temperature=0.2,  # precise
         **PROMPTS[USE_LANGUAGE]["merge_yolo"].get_kwargs(),
     )
+    oneline_response = r.data().replace("\n", "<br/>")
     if not r.ok():
         TRACE_LOG.warning(
             project_id,
@@ -100,14 +101,15 @@ async def merge_or_valid_new_memos(
         )
         return r
     memo_actions = parse_string_into_merge_yolo_action(r.data())
+
+    abort_infos = []
     for i, m in enumerate(new_memos):
         update_response = memo_actions.get(i + 1, None)
         if update_response is None:
-            oneline_response = r.data().replace("\n", "<br/>")
             TRACE_LOG.warning(
                 project_id,
                 user_id,
-                f"No Corresponding Merge Action: {m[0]}, <raw_response> {oneline_response} </raw_response>",
+                f"No Corresponding Merge Action: {new_memos_input[i]}, <raw_response> {oneline_response} </raw_response>",
             )
             continue
         f_c, f_a = m[1], m[2]
@@ -166,17 +168,19 @@ async def merge_or_valid_new_memos(
                     }
                 )
         elif update_response["action"] == "ABORT":
-            oneline_response = r.data().replace("\n", "<br/>")
-            TRACE_LOG.info(
-                project_id,
-                user_id,
-                f"Invalid merge: {m[0]}. <raw_response> {oneline_response} </raw_response>",
-            )
+            abort_infos.append(new_memos_input[i])
         else:
             TRACE_LOG.warning(
                 project_id,
                 user_id,
                 f"Unkown merge action: {update_response['action']}",
             )
             continue
+
+    if len(abort_infos):
+        TRACE_LOG.info(
+            project_id,
+            user_id,
+            f"Invalid merge: {abort_infos}. <raw_response> {oneline_response} </raw_response>",
+        )
     return Promise.resolve(profile_session_results)
```

**File**: `src/server/api/memobase_server/prompts/utils.py` (modified, +2/-9)
```diff
@@ -260,14 +260,7 @@ def parse_line_into_subtopic(line: str) -> dict:
 2. ABORT::ABORT
 3. ABORT::ABORT
 4. ABORT::ABORT
-5. ABORT::ABORT
-6. ABORT::ABORT
-7. ABORT::ABORT
-8. ABORT::ABORT
-9. ABORT::ABORT
-10. APPEND::APPEND
-11. APPEND::APPEND
-12. APPEND::APPEND
-13. APPEND::APPEND"""
+5. APPEND::APPEND
+6. APPEND::APPEND"""
         )
     )
```

---

### Incident Patch 13: `b9ce6ceb` (2025-08-10)
**Commit Message**: fix: healthcheck api now use http error

**File**: `src/server/api/memobase_server/api_layer/chore.py` (modified, +16/-15)
```diff
@@ -27,26 +27,27 @@ async def root_running_status_check(request: Request) -> BaseResponse:
     """Check if your memobase is set up correctly"""
     project_id = request.state.memobase_project_id
     if project_id != DEFAULT_PROJECT_ID:
-        return BaseResponse(
-            errno=CODE.METHOD_NOT_ALLOWED, errmsg="Only Root can access this"
+        raise HTTPException(
+            status_code=CODE.METHOD_NOT_ALLOWED.value,
+            detail="Only Root can access this",
+        )
+    if not db_health_check():
+        raise HTTPException(
+            status_code=CODE.INTERNAL_SERVER_ERROR.value,
+            detail="Database not available",
+        )
+    if not await redis_health_check():
+        raise HTTPException(
+            status_code=CODE.INTERNAL_SERVER_ERROR.value,
+            detail="Redis not available",
         )
     try:
-        if not db_health_check():
-            return BaseResponse(
-                errno=CODE.INTERNAL_SERVER_ERROR,
-                errmsg="Database not available",
-            )
-        if not await redis_health_check():
-            return BaseResponse(
-                errno=CODE.INTERNAL_SERVER_ERROR,
-                errmsg="Redis not available",
-            )
         await check_embedding_sanity()
         await llm_sanity_check()
     except Exception as e:
-        return BaseResponse(
-            errno=CODE.INTERNAL_SERVER_ERROR,
-            errmsg=f"Occuring Error when status checking: {e}\n{traceback.format_exc()}",
+        raise HTTPException(
+            status_code=CODE.INTERNAL_SERVER_ERROR.value,
+            detail=f"Root status checking failed: {e}",
         )
 
     return BaseResponse()
```

---

### Incident Patch 14: `5b00590c` (2025-08-10)
**Commit Message**: fix: remove unused prompt

**File**: `src/server/api/memobase_server/__init__.py` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-__version__ = "0.0.39"
+__version__ = "0.0.40"
 
 __author__ = "memobase.io"
 __url__ = "https://github.com/memodb-io/memobase"
```

**File**: `src/server/api/memobase_server/prompts/summary_chats.py` (removed, +0/-28)
```diff
@@ -1,28 +0,0 @@
-from ..env import CONFIG
-
-ADD_KWARGS = {
-    "prompt_id": "summary_chats",
-}
-SUMMARY_PROMPT = """You are a expert of summarizing chats.
-You will be given a chats between a user and an assistant.
-
-## Requirement
-- Your task is to summarize the chats into 1~2 sentences.
-- Only extract the most critical events/schedules that occurred.
-- Specific Time(YYYY/MM/DD) should be included in events/schedules if possible.
-- Only return the plain summary and no explanation.
-
-The summary should use the same language as the chats.
-"""
-
-
-def get_prompt() -> str:
-    return SUMMARY_PROMPT
-
-
-def get_kwargs() -> dict:
-    return ADD_KWARGS
-
-
-if __name__ == "__main__":
-    print(get_prompt())
```

**File**: `src/server/api/memobase_server/prompts/summary_profile.py` (modified, +1/-2)
```diff
@@ -9,11 +9,10 @@
 ## Requirement
 - Extract high-level preference from the profile
 - The preference should be the most important and representative preference of the user.
-  For example, the original perference is "user likes Chocolate[mentioned in 2023/1/23], Ice cream, Cake, Cookies, Brownies[mentioned in 2023/1/24]...", then your extraction should be "user likes sweet food(cake/cookies...)".
+  For example, the original perference is "user likes Chocolate[mentioned in 2023/1/23], Ice cream, Cake, Cookies, Brownies[mentioned in 2023/1/24]...", then your extraction should be "user maybe likes sweet food(cake/cookies...)".
 - The preference should be concise and clear.
 
 The result should use the same language as the input.
-结果应该使用与输入相同的语言。
 """
 
 
```

---

### Incident Patch 15: `ad528dc9` (2025-08-06)
**Commit Message**: fix: remove uvicorn logger anyway

**File**: `src/server/api/memobase_server/env.py` (modified, +5/-0)
```diff
@@ -264,6 +264,11 @@ class Colors:
     END = "\033[0m"
 
 
+# remove default uvicorn loggers cause we have our own
+for _log in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
+    logging.getLogger(_log).handlers.clear()
+    # logging.getLogger(_log).propagate = True
+
 log_format = os.getenv("LOG_FORMAT", "plain")
 if log_format == "json":
     configure_logger()
```

**File**: `src/server/api/memobase_server/struct_logger.py` (modified, +0/-4)
```diff
@@ -47,10 +47,6 @@ def configure_logger():
     root_logger.addHandler(handler)
     root_logger.setLevel(logging.INFO)
 
-    for _log in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
-        logging.getLogger(_log).handlers.clear()
-        # logging.getLogger(_log).propagate = True
-
 
 @contextmanager
 def bound_context(**kwargs):
```

#### Recent Merged Pull Requests:
- **PR #147** (2025-12-09): fix: remove redundant len() call on buffer size (@RGB-loop)
- **PR #141** (2025-10-28): fix: missing await in async search_event_gist (@bartjackbakker)
- **PR #140** (2025-12-09): feat: add Japanese support (@kun432)
- **PR #139** (2025-10-28): feat: support use ollama as embedding provider(#138) (@dishuostec)
- **PR #134** (2025-09-20): add use_tag flag (@jinjiaKarl)
- **PR #131** (2025-09-14): Event tag search (@jinjiaKarl)
- **PR #129** (2025-09-03): By default use event gist search (@jinjiaKarl)
- **PR #128** (2025-09-01): Update go sdk doc (@jinjiaKarl)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

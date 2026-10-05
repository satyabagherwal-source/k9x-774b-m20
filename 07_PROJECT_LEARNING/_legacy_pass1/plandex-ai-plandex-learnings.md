# Forensic Learning Record (Deep Inspection): plandex-ai/plandex

> **Canonical Artifact**: `07_PROJECT_LEARNING/plandex-ai-plandex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/plandex-ai/plandex](https://github.com/plandex-ai/plandex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:19:31.697Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `plandex-ai/plandex`
- **Description**: Open source AI coding agent. Designed for large projects and real world tasks.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 15685 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/cli/api/clients.go`
```
package api

import (
	"math"
	"math/rand"
	"net"
	"net/http"
	"os"
	"plandex-cli/auth"
	"plandex-cli/types"
	"time"
)

const dialTimeout = 10 * time.Second
const fastReqTimeout = 30 * time.Second
const slowReqTimeout = 5 * time.Minute

type Api struct{}

var CloudApiHost string
var Client types.ApiClient = (*Api)(nil)

func init() {
	if os.Getenv("PLANDEX_ENV") == "development" {
		CloudApiHost = os.Getenv("PLANDEX_API_HOST")
		if CloudApiHost == "" {
			CloudApiHost = "http://localhost:8099"
		}
	} else {
		CloudApiHost = "https://api-v2.plandex.ai"
	}
}

func GetApiHost() string {
	if auth.Current == nil {
		return CloudApiHost
	} else if auth.Current.IsCloud {
		return CloudApiHost
	} else {
		return auth.Current.Host
	}
}

type authenticatedTransport struct {
	underlyingTransport http.RoundTripper
}

func (t *authenticatedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	err := auth.SetAuthHeader(req)
	if err != nil {
		return nil, err
	}
	auth.SetVersionHeader(req)
	return t.underlyingTransport.RoundTrip(req)
}

type unauthenticatedTransport struct {
	underlyingTransport http.RoundTripper
}

func (t *unauthenticatedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	auth.SetVersionHeader(req)
	return t.underlyingTransport.RoundTrip(req)
}

type retryTransport struct {
	Base          http.RoundTripper
	MaxRetries    int
	BaseDelay     time.Duration
	MaxDelay      time.Duration
	Jitter        time.Duration
	RetryStatuses map[int]bool
}

func (t *retryTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if t.Base == nil {
		t.Base = http.DefaultTransport
	}
	var resp *http.Response
	var err error

	for attempt := 0; attempt <= t.MaxRetries; attempt++ {
		resp, err = t.Base.RoundTrip(req)

		// If there's a low-level error (e.g. network), retry unless it's a timeout, as these are often transient.
		if err != nil {
			if netErr, ok := err.(net.Error); ok {
				if netErr.Timeout() {
					return resp, err
				}
			}
			// continue to next attempt
		} else {
			// If status code not in our RetryStatuses, return immediately.
			if !t.RetryStatuses[resp.StatusCode] {
				return resp, nil
			}

			// Close the body before retrying.
			_ = resp.Body.Close()
		}

		// If we reached the max, break out of loop (will return last resp).
		if attempt == t.MaxRetries {
			break
		}

		// Exponential backoff + jitter
		backoff := float64(t.BaseDelay) * math.Pow(2, float64(attempt))
		if backoff > float64(t.MaxDelay) {
			backoff = float64(t.MaxDelay)
		}
		sleepDuration := time.Duration(backoff) + time.Duration(rand.Int63n(int64(t.Jitter)))
		time.Sleep(sleepDuration)
	}
	return resp, err
}

var netDialer = &net.Dialer{
	Timeout: dialTimeout,
}

var baseTransport = &http.Transport{
	Dial: netDialer.Dial,
}

var sharedRetryTransport = &retryTransport{
	Base:          baseTransport,
	MaxRetries:    3,
	BaseDelay:     500 * time.Millisecond,
	MaxDelay:      5 * time.Second,
	Jitter:        300 * time.Millisecond,
	RetryStatuses: map[int]bool{502: true, 503: true, 504: true},
}

var unauthenticatedClient = &http.Client{
	Transport: &unauthenticatedTransport{
		underlyingTransport: sharedRetryTransport,
	},
	Timeout: fastReqTimeout,
}

var authenticatedFastClient = &http.Client{
	Transport: &authenticatedTransport{
		underlyingTransport: sharedRetryTransport,
	},
	Timeout: fastReqTimeout,
}

var authenticatedSlowClient = &http.Client{
	Transport: &authenticatedTransport{
		underlyingTransport: sharedRetryTransport,
	},
	Timeout: slowReqTimeout,
}

var authenticatedStreamingClient = &http.Client{
	Transport: &authenticatedTransport{
		underlyingTransport: sharedRetryTransport,
	},
}

```

### Core Architecture Module: `app/cli/api/errors.go`
```
package api

import (
	"encoding/json"
	"log"
	"net/http"
	"plandex-cli/auth"
	"plandex-cli/term"
	"strings"

	shared "plandex-shared"
)

func HandleApiError(r *http.Response, errBody []byte) *shared.ApiError {
	// Check if the response is JSON
	if r.Header.Get("Content-Type") != "application/json" {
		return &shared.ApiError{
			Type:   shared.ApiErrorTypeOther,
			Status: r.StatusCode,
			Msg:    strings.TrimSpace(string(errBody)),
		}
	}

	var apiError shared.ApiError
	if err := json.Unmarshal(errBody, &apiError); err != nil {
		log.Printf("Error unmarshalling JSON: %v\n", err)
		return &shared.ApiError{
			Type:   shared.ApiErrorTypeOther,
			Status: r.StatusCode,
			Msg:    strings.TrimSpace(string(errBody)),
		}
	}

	// return error if token/auth refresh is needed
	if apiError.Type == shared.ApiErrorTypeInvalidToken || apiError.Type == shared.ApiErrorTypeAuthOutdated {
		return &apiError
	}

	term.HandleApiError(&apiError)

	return &apiError
}

func refreshAuthIfNeeded(apiErr *shared.ApiError) (bool, *shared.ApiError) {
	if apiErr.Type == shared.ApiErrorTypeInvalidToken {
		err := auth.RefreshInvalidToken()
		if err != nil {
			return false, &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: "error refreshing invalid token"}
		}
		return true, nil
	} else if apiErr.Type == shared.ApiErrorTypeAuthOutdated {
		err := auth.RefreshAuth()
		if err != nil {
			return false, &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: "error refreshing auth"}
		}

		return true, nil
	}

	return false, apiErr
}

```

### Core Architecture Module: `app/cli/api/methods.go`
```
package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"plandex-cli/types"
	"strings"

	shared "plandex-shared"

	"github.com/shopspring/decimal"
)

func (a *Api) CreateCliTrialSession() (string, *shared.ApiError) {
	serverUrl := CloudApiHost + "/accounts/cli_trial_session"

	resp, err := unauthenticatedClient.Post(serverUrl, "application/json", nil)

	if err != nil {
		return "", &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: fmt.Sprintf("error sending request: %v", err)}
	}

	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		errorBody, _ := io.ReadAll(resp.Body)
		apiErr := HandleApiError(resp, errorBody)
		return "", apiErr
	}

	bytes, err := io.ReadAll(resp.Body)

	if err != nil {
		return "", &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: fmt.Sprintf("error reading response: %v", err)}
	}

	return string(bytes), nil
}

func (a *Api) GetCliTrialSession(token string) (*shared.SessionResponse, *shared.ApiError) {
	serverUrl := fmt.Sprintf("%s/accounts/cli_trial_session/%s", CloudApiHost, token)

	resp, err := unauthenticatedClient.Get(serverUrl)

	if err != nil {
		return nil, &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: fmt.Sprintf("error sending request: %v", err)}
	}

	if resp.StatusCode == 404 {
		return nil, nil
	}

	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		errorBody, _ := io.ReadAll(resp.Body)
		apiErr := HandleApiError(resp, errorBody)
		return nil, apiErr
	}

	var session shared.SessionResponse
	err = json.NewDecoder(resp.Body).Decode(&session)
	if err != nil {
		return nil, &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: fmt.Sprintf("error decoding response: %v", err)}
	}

	return &session, nil
}

func (a *Api) CreateProject(req shared.CreateProjectRequest) (*shared.CreateProjectResponse, *shared.ApiError) {
	serverUrl := GetApiHost() + "/projects"

	reqBytes, err := json.Marshal(req)
	if err != nil {
		return nil, &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: fmt.Sprintf("error marshalling request: %v", err)}
	}

	resp, err := authenticatedFastClient.Post(serverUrl, "application/json", bytes.NewBuffer(reqBytes))
	if err != nil {
		return nil, &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: fmt.Sprintf("error sending request: %v", err)}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		errorBody, _ := io.ReadAll(resp.Body)
		apiErr := HandleApiError(resp, errorBody)
		authRefreshed, apiErr := refreshAuthIfNeeded(apiErr)
		if authRefreshed {
			return a.CreateProject(req)
		}
		return nil, apiErr
	}

	var respBody shared.CreateProjectResponse
	err = json.NewDecoder(resp.Body).Decode(&respBody)
	if err != nil {
		return nil, &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: fmt.Sprintf("error decoding response: %v", err)}
	}

	return &respBody, nil
}

func (a *Api) ListProjects() ([]*shared.Project, *shared.ApiError) {
	serverUrl := GetApiHost() + "/projects"
	resp, err := authenticatedFastClient.Get(serverUrl)
	if err != nil {
		return nil, &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: fmt.Sprintf("error sending request: %v", err)}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		errorBody, _ := io.ReadAll(resp.Body)
		apiErr := HandleApiError(resp, errorBody)
		authRefreshed, apiErr := refreshAuthIfNeeded(apiErr)
		if authRefreshed {
			return a.ListProjects()
		}
		return nil, apiErr
	}

	var projects []*shared.Project
	err = json.NewDecoder(resp.Body).Decode(&projects)
	if err != nil {
		return nil, &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: fmt.Sprintf("error decoding response: %v", err)}
	}

	return projects, nil
}

func (a *Api) SetProjectPlan(projectId string, req shared.SetProjectPlanRequest) *shared.ApiError {
	serverUrl := fmt.Sprintf("%s/projects/%s/set_plan", GetApiHost(), projectId)
	reqBytes, err := json.Marshal(req)
	if err != nil {
		return &shared.ApiError{Msg: fmt.Sprintf("error marshalling request: %v", err)}
	}

	request, err := http.NewRequest(http.MethodPut, serverUrl, bytes.NewBuffer(reqBytes))
	if err != nil {
		return &shared.ApiError{Msg: fmt.Sprintf("error creating request: %v", err)}
	}
	request.Header.Set("Content-Type", "application/json")

	resp, err := authenticatedFastClient.Do(request)
	if err != nil {
		return &shared.ApiError{Msg: fmt.Sprintf("error sending request: %v", err)}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		errorBody, _ := io.ReadAll(resp.Body)
		apiErr := HandleApiError(resp, errorBody)
		didRefresh, apiErr := refreshAuthIfNeeded(apiErr)
		if didRefresh {
			return a.SetProjectPlan(projectId, req)
		}
		return apiErr
	}

	return nil
}

func (a *Api) RenameProject(projectId string, req shared.RenameProjectRequest) *shared.ApiError {
	serverUrl := fmt.Sprintf("%s/projects/%s/rename", GetApiHost(), projectId)
	reqBytes, err := json.Marshal(req)
	if err != nil {
		return &shared.ApiError{Msg: fmt.Sprintf("error marshalling request: %v", err)}
	}

	request, err := http.NewRequest(http.MethodPut, serverUrl, bytes.NewBuffer(reqBytes))
	if err != nil {
		return &shared.ApiError{Msg: fmt.Sprintf("error creating request: %v", err)}
	}
	request.Header.Set("Content-Type", "application/json")

	resp, err := authenticatedFastClient.Do(request)
	if err != nil {
		return &shared.ApiError{Msg: fmt.Sprintf("error sending request: %v", err)}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		errorBody, _ := io.ReadAll(resp.Body)
		apiErr := HandleApiError(resp, errorBody)

		didRefresh, apiErr := refreshAuthIfNeeded(apiErr)
		if didRefresh {
			return a.RenameProject(projectId, req)
		}
		return apiErr
	}

	return nil
}
func (a *Api) ListPlans(projectIds []string) ([]*shared.Plan, *shared.ApiError) {
	serverUrl := fmt.Sprintf("%s/plans?", GetApiHost())
	parts := []string{}
	for _, projectId := range projectIds {
		parts = append(parts, fmt.Sprintf("projectId=%s", projectId))
	}
	serverUrl += strings.Join(parts, "&")

	resp, err := authenticatedFastClient.Get(serverUrl)
	if err != nil {
		return nil, &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: fmt.Sprintf("error sending request: %v", err)}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		errorBody, _ := io.ReadAll(resp.Body)

		apiErr := HandleApiError(resp, errorBody)

		didRefresh, apiErr := refreshAuthIfNeeded(apiErr)
		if didRefresh {
			return a.ListPlans(projectIds)
		}
		return nil, apiErr
	}

	var plans []*shared.Plan
	err = json.NewDecoder(resp.Body).Decode(&plans)
	if err != nil {
		return nil, &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: fmt.Sprintf("error decoding response: %v", err)}
	}

	return plans, nil
}

func (a *Api) ListArchivedPlans(projectIds []string) ([]*shared.Plan, *shared.ApiError) {
	serverUrl := fmt.Sprintf("%s/plans/archive?", GetApiHost())
	parts := []string{}
	for _, projectId := range projectIds {
		parts = append(parts, fmt.Sprintf("projectId=%s", projectId))
	}
	serverUrl += strings.Join(parts, "&")

	resp, err := authenticatedFastClient.Get(serverUrl)
	if err != nil {
		return nil, &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: fmt.Sprintf("error sending request: %v", err)}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		errorBody, _ := io.ReadAll(resp.Body)
		apiErr := HandleApiError(resp, errorBody)
		authRefreshed, apiErr := refreshAuthIfNeeded(apiErr)
		if authRefreshed {
			return a.ListArchivedPlans(projectIds)
		}
		return nil, apiErr
	}

	var plans []*shared.Plan
	err = json.NewDecoder(resp.Body).Decode(&plans)
	if err != nil {
		return nil, &shared.ApiError{Type: shared.ApiErrorTypeOther, Msg: fmt.Sprintf("error decoding response: %v", err)}
	}

	return plans, nil
}

func (a *Api) ListPlansRunning(projectIds []string, includeRecent bool) (*shared.ListPlansRunningResponse, *shared.ApiError) {
	serverUrl := fmt.Sprintf("%s/plans/ps?", GetApiHost())
	parts := []string{}
	for _, projectId := range projectIds {
		parts = append(parts, fmt.Sprintf("projectId=%s", projectId))
	}
	serverUrl += strings.Join(p
```

### Core Architecture Module: `app/cli/api/stream.go`
```
package api

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"plandex-cli/types"
	"time"

	shared "plandex-shared"
)

// 3 heartbeat misses = timeout
const HeartbeatTimeout = 16 * time.Second

func connectPlanRespStream(body io.ReadCloser, onStream types.OnStreamPlan) {
	reader := bufio.NewReader(body)
	timer := time.NewTimer(HeartbeatTimeout)
	defer timer.Stop()

	go func() {
		for {
			select {
			case <-timer.C:
				log.Println("Connection to plan stream timed out due to missing heartbeats")
				onStream(types.OnStreamPlanParams{Msg: nil, Err: fmt.Errorf("connection to plan stream timed out due to missing heartbeats")})
				body.Close()
				return
			default:
			}

			s, err := readUntilSeparator(reader, shared.STREAM_MESSAGE_SEPARATOR)
			if err != nil {
				log.Println("Error reading line:", err)
				onStream(types.OnStreamPlanParams{Msg: nil, Err: err})
				body.Close()
				return
			}

			timer.Reset(HeartbeatTimeout)

			// ignore heartbeats
			if s == string(shared.StreamMessageHeartbeat) {
				continue
			}

			var msg shared.StreamMessage
			err = json.Unmarshal([]byte(s), &msg)
			if err != nil {
				log.Println("Error unmarshalling message:", err)
				onStream(types.OnStreamPlanParams{Msg: nil, Err: err})
				body.Close()
				return
			}

			// log.Println("connectPlanRespStream: received message:", msg)

			onStream(types.OnStreamPlanParams{Msg: &msg, Err: nil})

			if msg.Type == shared.StreamMessageFinished || msg.Type == shared.StreamMessageError || msg.Type == shared.StreamMessageAborted {
				body.Close()
				return
			}

		}
	}()
}

func readUntilSeparator(reader *bufio.Reader, separator string) (string, error) {
	var result []byte
	sepBytes := []byte(separator)
	for {
		b, err := reader.ReadByte()
		if err != nil {
			return string(result), err
		}
		result = append(result, b)
		if len(result) >= len(sepBytes) && bytes.HasSuffix(result, sepBytes) {
			return string(result[:len(result)-len(separator)]), nil
		}
	}
}

```

### Core Architecture Module: `app/cli/auth/account.go`
```
package auth

import (
	"fmt"
	"plandex-cli/term"

	shared "plandex-shared"

	"github.com/fatih/color"
)

const AddAccountOption = "Add another account"

func SelectOrSignInOrCreate() error {
	accounts, err := loadAccounts()

	if err != nil {
		return fmt.Errorf("error loading accounts: %v", err)
	}

	if len(accounts) == 0 {
		err := promptSignInNewAccount()
		if err != nil {
			return fmt.Errorf("error signing in to new account: %v", err)
		}

		return nil
	}

	var options []string
	for _, account := range accounts {
		options = append(options, fmt.Sprintf("<%s> %s", account.UserName, account.Email))
	}

	options = append(options, AddAccountOption)

	// either select from existing accounts or sign in/create account

	selectedOpt, err := term.SelectFromList("Select an account:", options)

	if err != nil {
		return fmt.Errorf("error selecting account: %v", err)
	}

	if selectedOpt == AddAccountOption {
		err := promptSignInNewAccount()
		if err != nil {
			return fmt.Errorf("error prompting for sign in to new account: %v", err)
		}
		return nil
	}

	var selected *shared.ClientAccount
	for i, opt := range options {
		if selectedOpt == opt {
			selected = accounts[i]
			break
		}
	}

	if selected == nil {
		return fmt.Errorf("error selecting account: account not found")
	}

	selectedAuth := *selected

	setAuth(&shared.ClientAuth{
		ClientAccount: selectedAuth,
	})

	term.StartSpinner("")
	orgs, apiErr := apiClient.ListOrgs()
	term.StopSpinner()

	if apiErr != nil {
		return fmt.Errorf("error listing orgs: %v", apiErr.Msg)
	}

	org, err := resolveOrgAuth(orgs, selectedAuth.IsLocalMode)

	if err != nil {
		return fmt.Errorf("error resolving org: %v", err)
	}

	err = setAuth(&shared.ClientAuth{
		ClientAccount:        *selected,
		OrgId:                org.Id,
		OrgName:              org.Name,
		OrgIsTrial:           org.IsTrial,
		IntegratedModelsMode: org.IntegratedModelsMode,
	})

	if err != nil {
		return fmt.Errorf("error setting auth: %v", err)
	}

	_, apiErr = apiClient.GetOrgSession()

	if apiErr != nil {
		return fmt.Errorf("error getting org session: %v", apiErr.Msg)
	}

	fmt.Printf("✅ Signed in as %s | Org: %s\n", color.New(color.Bold, term.ColorHiGreen).Sprintf("<%s> %s", Current.UserName, Current.Email), color.New(term.ColorHiCyan).Sprint(Current.OrgName))
	fmt.Println()

	if !term.IsRepl {
		term.PrintCmds("", "")
	}

	return nil
}

func SignInWithCode(code, host string) error {
	term.StartSpinner("")
	res, apiErr := apiClient.SignIn(shared.SignInRequest{
		Pin:          code,
		IsSignInCode: true,
	}, host)
	term.StopSpinner()

	if apiErr != nil {
		return fmt.Errorf("error signing in: %v", apiErr.Msg)
	}

	return handleSignInResponse(res, host)
}

func promptInitialAuth() error {
	fmt.Println("👋 Hey there!\nIt looks like this is your first time using Plandex on this computer.")

	err := SelectOrSignInOrCreate()

	if err != nil {
		return fmt.Errorf("error selecting or signing in to account: %v", err)
	}

	return nil
}

const (
	// SignInCloudOption = "Plandex Cloud"
	SignInLocalOption = "Local mode host"
	SignInOtherOption = "Another host"
)

func promptSignInNewAccount() error {
	selected, err := term.SelectFromList("Use local mode or another host?", []string{SignInLocalOption, SignInOtherOption})

	if err != nil {
		return fmt.Errorf("error selecting sign in option: %v", err)
	}

	var host string
	var email string

	if selected == SignInLocalOption {
		host, err = term.GetRequiredUserStringInputWithDefault("Host:", "http://localhost:8099")
	} else {
		host, err = term.GetRequiredUserStringInput("Host:")
	}

	if err != nil {
		return fmt.Errorf("error prompting host: %v", err)
	}

	if selected == SignInLocalOption {
		email = "local-admin@plandex.ai"
	} else {
		email, err = term.GetRequiredUserStringInput("Your email:")
	}

	if err != nil {
		return fmt.Errorf("error prompting email: %v", err)
	}

	res, err := verifyEmail(email, host)

	if err != nil {
		return fmt.Errorf("error verifying email: %v", err)
	}

	if res.hasAccount {
		err := signIn(email, res.pin, host)
		if err != nil {
			return fmt.Errorf("error signing in: %v", err)
		}
	} else {
		err := createAccount(email, res.pin, host, res.isLocalMode)
		if err != nil {
			return fmt.Errorf("error creating account: %v", err)
		}
	}

	if !term.IsRepl {
		term.PrintCmds("", "")
	}

	return nil
}

type verifyEmailRes struct {
	hasAccount  bool
	isLocalMode bool
	pin         string
}

func verifyEmail(email, host string) (*verifyEmailRes, error) {
	term.StartSpinner("")
	res, apiErr := apiClient.CreateEmailVerification(email, host, "")
	term.StopSpinner()

	if apiErr != nil {
		return nil, fmt.Errorf("error creating email verification: %v", apiErr.Msg)
	}

	if res.IsLocalMode {
		return &verifyEmailRes{
			hasAccount:  res.HasAccount,
			isLocalMode: true,
			pin:         "",
		}, nil
	}

	fmt.Println("✉️  You'll now receive a 6 character pin by email. It will be valid for 5 minutes.")

	pin, err := term.GetUserPasswordInput("Please enter your pin:")

	if err != nil {
		return nil, fmt.Errorf("error prompting pin: %v", err)
	}

	return &verifyEmailRes{
		hasAccount:  res.HasAccount,
		isLocalMode: false,
		pin:         pin,
	}, nil
}

func signIn(email, pin, host string) error {
	term.StartSpinner("")
	res, apiErr := apiClient.SignIn(shared.SignInRequest{
		Email: email,
		Pin:   pin,
	}, host)
	term.StopSpinner()

	if apiErr != nil {
		return fmt.Errorf("error signing in: %v", apiErr.Msg)
	}

	return handleSignInResponse(res, host)
}

func handleSignInResponse(res *shared.SessionResponse, host string) error {
	isLocalMode := host != "" && res.IsLocalMode

	err := setAuth(&shared.ClientAuth{
		ClientAccount: shared.ClientAccount{
			Email:       res.Email,
			UserId:      res.UserId,
			UserName:    res.UserName,
			Token:       res.Token,
			IsTrial:     false,
			IsCloud:     host == "",
			Host:        host,
			IsLocalMode: isLocalMode,
		},
	})

	if err != nil {
		return fmt.Errorf("error setting auth: %v", err)
	}

	org, err := resolveOrgAuth(res.Orgs, isLocalMode)

	if err != nil {
		return fmt.Errorf("error resolving org: %v", err)
	}

	Current.OrgId = org.Id
	Current.OrgName = org.Name
	Current.IntegratedModelsMode = org.IntegratedModelsMode

	err = writeCurrentAuth()

	if err != nil {
		return fmt.Errorf("error writing auth: %v", err)
	}

	fmt.Printf("✅ Signed in as %s | Org: %s\n", color.New(color.Bold, term.ColorHiGreen).Sprintf("<%s> %s", Current.UserName, Current.Email), color.New(term.ColorHiCyan).Sprint(Current.OrgName))
	fmt.Println()

	return nil
}

func createAccount(email, pin, host string, isLocalMode bool) error {
	var name string

	if isLocalMode {
		name = "Local Admin"
	} else {
		var err error
		name, err = term.GetUserStringInput("Your name:")

		if err != nil {
			return fmt.Errorf("error prompting name: %v", err)
		}
	}

	term.StartSpinner("🌟 Creating account...")
	res, apiErr := apiClient.CreateAccount(shared.CreateAccountRequest{
		Email:    email,
		UserName: name,
		Pin:      pin,
	}, host)
	term.StopSpinner()

	if apiErr != nil {
		return fmt.Errorf("error creating account: %v", apiErr.Msg)
	}

	if res.IsLocalMode {
		isLocalMode = true
	}

	err := setAuth(&shared.ClientAuth{
		ClientAccount: shared.ClientAccount{
			Email:       res.Email,
			UserId:      res.UserId,
			UserName:    res.UserName,
			Token:       res.Token,
			IsTrial:     false,
			IsCloud:     host == "",
			Host:        host,
			IsLocalMode: isLocalMode,
		},
	})

	if err != nil {
		return fmt.Errorf("error setting auth: %v", err)
	}

	org, err := resolveOrgAuth(res.Orgs, isLocalMode)

	if err != nil {
		return fmt.Errorf("error resolving org: %v", err)
	}

	if org == nil {
		return fmt.Errorf("no org selected")
	}

	Current.OrgId = org.Id
	Current.OrgName = org.Name
	Current.IntegratedModelsMode = org.IntegratedModelsMode

	err = writeCurrentAuth()

	if err != nil {
		return fmt.Errorf("error writing auth: %v", err)
	}

	fmt.Printf("✅ Signed in as %s | Org: %s\n", color.New(color
```

### Core Architecture Module: `app/cli/auth/api.go`
```
package auth

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"plandex-cli/types"
	"plandex-cli/version"

	shared "plandex-shared"
)

var apiClient types.ApiClient

func SetApiClient(client types.ApiClient) {
	apiClient = client
}

func SetAuthHeader(req *http.Request) error {
	if Current == nil {
		return fmt.Errorf("error setting auth header: auth not loaded")
	}
	hash := Current.ToHash()

	authHeader := shared.AuthHeader{
		Token: Current.Token,
		OrgId: Current.OrgId,
		Hash:  hash,
	}

	bytes, err := json.Marshal(authHeader)

	if err != nil {
		return fmt.Errorf("error marshalling auth header: %v", err)
	}

	// base64 encode
	token := base64.URLEncoding.EncodeToString(bytes)

	req.Header.Set("Authorization", "Bearer "+token)

	return nil
}

func SetVersionHeader(req *http.Request) {
	req.Header.Set("X-Client-Version", version.Version)
}

```

### Core Architecture Module: `app/cli/auth/auth.go`
```
package auth

import (
	"encoding/json"
	"fmt"
	"os"
	"plandex-cli/fs"
	"plandex-cli/term"

	shared "plandex-shared"
)

var openUnauthenticatedCloudURL func(msg, path string)
var openAuthenticatedURL func(msg, path string)

func SetOpenUnauthenticatedCloudURLFn(fn func(msg, path string)) {
	openUnauthenticatedCloudURL = fn
}

func SetOpenAuthenticatedURLFn(fn func(msg, path string)) {
	openAuthenticatedURL = fn
}

func MustResolveAuthWithOrg() {
	MustResolveAuth(true)
}

func MustResolveAuth(requireOrg bool) {
	if apiClient == nil {
		term.OutputErrorAndExit("error resolving auth: api client not set")
	}

	// load HomeAuthPath file into ClientAuth struct
	bytes, err := os.ReadFile(fs.HomeAuthPath)

	if err != nil {
		if os.IsNotExist(err) {
			err = promptInitialAuth()

			if err != nil {
				term.OutputErrorAndExit("error resolving auth: %v", err)
			}

			return
		} else {
			term.OutputErrorAndExit("error reading auth.json: %v", err)
		}
	}

	var auth shared.ClientAuth
	err = json.Unmarshal(bytes, &auth)
	if err != nil {
		term.OutputErrorAndExit("error unmarshalling auth.json: %v", err)
	}

	Current = &auth

	if requireOrg && Current.OrgId == "" {
		term.StartSpinner("")
		orgs, apiErr := apiClient.ListOrgs()
		term.StopSpinner()

		if apiErr != nil {
			term.OutputErrorAndExit("Error listing orgs: %v", apiErr.Msg)
		}

		org, err := resolveOrgAuth(orgs, Current.IsLocalMode)

		if err != nil {
			term.OutputErrorAndExit("Error resolving org: %v", err)
		}

		if org.Id == "" {
			// still no org--exit now
			term.OutputErrorAndExit("No org")
		}

		Current.OrgId = org.Id
		Current.OrgName = org.Name
		Current.IntegratedModelsMode = org.IntegratedModelsMode

		err = writeCurrentAuth()

		if err != nil {
			term.OutputErrorAndExit("Error writing auth: %v", err)
		}
	}
}

func RefreshInvalidToken() error {
	if Current == nil {
		return fmt.Errorf("error refreshing token: auth not loaded")
	}
	res, err := verifyEmail(Current.Email, Current.Host)

	if err != nil {
		return fmt.Errorf("error verifying email: %v", err)
	}

	if res.hasAccount {
		return signIn(Current.Email, res.pin, Current.Host)
	} else {
		host := Current.Host
		if host == "" {
			host = "Plandex Cloud"
		}

		term.OutputErrorAndExit("Account %s not found on %s", Current.Email, host)
	}

	return nil
}

func RefreshAuth() error {
	if Current == nil {
		return fmt.Errorf("error refreshing auth: auth not loaded")
	}

	org, apiErr := apiClient.GetOrgSession()

	if apiErr != nil {
		return fmt.Errorf("error getting org session: %v", apiErr.Msg)
	}

	Current.OrgName = org.Name
	Current.OrgIsTrial = org.IsTrial
	Current.IntegratedModelsMode = org.IntegratedModelsMode

	err := writeCurrentAuth()

	if err != nil {
		return fmt.Errorf("error writing auth: %v", err)
	}

	return nil
}

```

### Core Architecture Module: `app/cli/auth/org.go`
```
package auth

import (
	"fmt"
	"plandex-cli/term"
	"strings"

	shared "plandex-shared"
)

func resolveOrgAuth(orgs []*shared.Org, isLocalMode bool) (*shared.Org, error) {
	var org *shared.Org
	var err error

	if len(orgs) == 0 {
		if isLocalMode {
			org, err = createOrg(isLocalMode)
		} else {
			org, err = promptNoOrgs()
		}

		if err != nil {
			return nil, fmt.Errorf("error prompting no orgs: %v", err)
		}

	} else if len(orgs) == 1 {
		org = orgs[0]
	} else {
		org, err = selectOrg(orgs, isLocalMode)

		if err != nil {
			return nil, fmt.Errorf("error selecting org: %v", err)
		}
	}

	return org, nil
}

func promptNoOrgs() (*shared.Org, error) {
	fmt.Println("🧐 You don't have access to any orgs yet.\n\nTo join an existing org, ask an admin to either invite you directly or give your whole email domain access.\n\nOtherwise, you can go ahead and create a new org.")

	shouldCreate, err := term.ConfirmYesNo("Create a new org now?")

	if err != nil {
		return nil, fmt.Errorf("error prompting create org: %v", err)
	}

	if shouldCreate {
		return createOrg(false)
	}

	return nil, nil
}

func createOrg(isLocalMode bool) (*shared.Org, error) {
	var err error
	var name string
	var autoAddDomainUsers bool

	if isLocalMode {
		name = "Local Org"
	} else {
		name, err = term.GetRequiredUserStringInput("Org name:")
	}
	if err != nil {
		return nil, fmt.Errorf("error prompting org name: %v", err)
	}

	if !isLocalMode {
		autoAddDomainUsers, err = promptAutoAddUsersIfValid(Current.Email)
		if err != nil {
			return nil, fmt.Errorf("error prompting auto add domain users: %v", err)
		}
	}

	term.StartSpinner("")
	res, apiErr := apiClient.CreateOrg(shared.CreateOrgRequest{
		Name:               name,
		AutoAddDomainUsers: autoAddDomainUsers,
	})
	term.StopSpinner()

	if apiErr != nil {
		return nil, fmt.Errorf("error creating org: %v", apiErr.Msg)
	}

	return &shared.Org{Id: res.Id, Name: name}, nil
}

func promptAutoAddUsersIfValid(email string) (bool, error) {
	userDomain := strings.Split(email, "@")[1]
	var autoAddDomainUsers bool
	var err error
	if !shared.IsEmailServiceDomain(userDomain) {
		fmt.Println("With domain auto-join, you can allow any user with an email ending in @"+userDomain, "to auto-join this org.")
		autoAddDomainUsers, err = term.ConfirmYesNo(fmt.Sprintf("Enable auto-join for %s?", userDomain))

		if err != nil {
			return false, err
		}
	}
	return autoAddDomainUsers, nil
}

const CreateOrgOption = "Create a new org"

func selectOrg(orgs []*shared.Org, isLocalMode bool) (*shared.Org, error) {
	var options []string
	for _, org := range orgs {
		options = append(options, org.Name)
	}
	options = append(options, CreateOrgOption)

	selected, err := term.SelectFromList("Select an org:", options)

	if err != nil {
		return nil, fmt.Errorf("error selecting org: %v", err)
	}

	if selected == CreateOrgOption {
		return createOrg(isLocalMode)
	}

	var selectedOrg *shared.Org
	for _, org := range orgs {
		if org.Name == selected {
			selectedOrg = org
			break
		}
	}

	if selectedOrg == nil {
		return nil, fmt.Errorf("error selecting org: org not found")
	}

	return selectedOrg, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #238** (2025-04-28): **XML output format not working for custom models**
  *Symptoms*: ![Image](https://github.com/user-attachments/assets/29536246-7172-4835-b3f2-c1a1cb6e5eda)

- **Issue #106** (2024-05-16): **Create New user/org on Plandex Cloud fails to automatically log in**
  *Symptoms*: ``` plandex new --name add-unit-tests ? 👋 Hey there! It looks like this is your first time using Plandex on this computer. What would you like to do? Sign in, accept an invite, or create an account ? Use Plandex Cloud or another host? Plandex Cloud ✔ Your email: … ****@******.com ✉️  You'll now receive a 6 character pin by email. It will be valid for 5 minutes. ✔ Please enter your pin: … ****** ✔ Your name: … cschneid 🧐 You don't have access to any orgs yet.  To join an existing org, ask an admin to either invite you directly or give your whole email domain access.  Otherwise, you can go ahead and create a new org. Create a new org now? (y)es | (n)o> y ✔ Org name: … Personal With domain auto-join, you can allow any user with an email ending in @*****.com to auto-join this org. Enable auto-join for christopher-schneider.com? (y)es | (n)o> n ? Select an account: Add another account ? Use Plandex Cloud or another host? > Plandex Cloud   Another host ```  **I thought I would have been logged in at this point**, but it was prompting for Cloud/Another. After re-authing a second pin via email, I did get logged in.  ``` ? Use Plandex Cloud or another host? Plandex Cloud ✔ Your email: … ****@******.com ✉️  You'll now receive a 6 character pin by email. It will be valid for 5 minutes. ✔ Please enter your pin: … ****** ✅ Started new plan add-unit-tests and set it to current plan ```  
  **Post-Mortem & Fix Analysis**:
  > Thanks @cschneid, will investigate this.

- **Issue #97** (2024-05-08): **Automatic CLI upgrade isn't working in some cases**
  *Symptoms*: I've had reports of it failing on WSL and Pop!_OS.  If anyone else has this issue, you can work around it in the meantime by re-installing the same way you installed the CLI initially.
  **Post-Mortem & Fix Analysis**:
  > Update: apparently running with `sudo` can resolve this, so it will likely just be necessary to detect the permissions error and suggest re-running with `sudo`.
  > Hi @danenania, I would like to work on this.
  > @kalil0321 Great, thank you! I assigned it to you.

- **Issue #75** (2024-04-14): **`set-model` command isn't parsing arguments correctly to set a new model for a specific role**
  *Symptoms*: `plandex set-model` with no arguments is working correctly and prompts the user to update model settings or select a role to a set a new model for, but when passing arguments like this: `plandex set-model planner gpt-4`, it isn't updating correctly.  Likely a problem in argument parsing in the CLI command, since if there was a problem on the server, it would be impacting the no arguments form as well. 
  **Post-Mortem & Fix Analysis**:
  > Hey, I would like to work on this
  > @ADTmux Awesome, thank you! I assigned it to you.
  > Hey @danenania , I've got an issue while setting up reflex (from https://github.com/ADTmux/plandex/blob/main/guides/DEVELOPMENT.md)   <img width="541" alt="Screenshot 2024-04-10 at 7 26 41 PM" src="https://github.com/plandex-ai/plandex/assets/165437009/c2b5b04c-e6d1-40ab-9326-efa638bc6c5d">  I also tried [https://github.com/cespare/reflex/issues/26](url) My setup is macOS 14.4.1 (Intel), any suggestions?  

- **Issue #57** (2024-04-14): **The same file can be added to context twice**
  *Symptoms*: The same file can be added twice with plandex add. When plandex rm is run on the filename, it reports removing it twice.
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting @JonatanE. In this case, if the file is outdated, it should alert the user and then update the file rather than adding it again if the user confirms. If the file *isn't* outdated it should just be a no-op.  I'll get this fixed.
  > This might also be a good one for a contributor.
  > Hey @danenania can you assign me to this issue?

- **Issue #47** (2024-04-14): **Context update should account for deleted files**
  *Symptoms*: Currently if a file is in context, then is later deleted, it causes an error on subsequent context updates.
  **Post-Mortem & Fix Analysis**:
  > Hi @danenania i would like to contribute. 
  > @kalil0321 Great, I assigned it to you. Let me know if you have any questions. You can also ping me on discord (https://discord.gg/plandex-ai)

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

### Incident Patch 1: `9017ba33` (2025-07-16)
**Commit Message**: fix broken docs link

**File**: `docs/docs/models/built-in/built-in-packs.md` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ sidebar_label: Model Packs
 
 Plandex includes a curated selection of built-in model packs that have been tested and optimized for different use cases.
 
-*A model pack is a mapping of [model roles](../models/model-roles) to [models](./built-in-models.md).*
+*A model pack is a mapping of [model roles](../roles.md) to [models](./built-in-models.md).*
 
 *They can also define fallback models for large context, large output, error handling, as well as a strong variant for the `builder` role.*
 
```

---

### Incident Patch 2: `9cd3eb4b` (2025-07-16)
**Commit Message**: fix for provider fallback on stream error. don't increment retries on claude max quota exhaustion. claude-status command. some logging cleanup in litellm_proxy. test script updates.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -157,7 +157,7 @@ curl -sL https://plandex.ai/install.sh | bash
 | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
 | **Plandex Cloud (Integrated Models)** | • No separate accounts or API keys.<br/>• Easy multi-device usage.<br/>• Centralized billing, budgeting, usage tracking, and cost reporting.<br/>• Quickest way to [get started.](https://app.plandex.ai/start?modelsMode=integrated)                                                        |
 | **Plandex Cloud (BYO API Key)**       | • Use Plandex Cloud with your own [OpenRouter.ai](https://openrouter.ai) key (or [other model provider](https://docs.plandex.ai/models/model-providers) accounts and API keys).<br/>• [Get started](https://app.plandex.ai/start?modelsMode=byo)                                                                   |
-| **Self-hosted/Local Mode**            | • Run Plandex locally with Docker or host on your own server.<br/>• Use your own [OpenRouter.ai](https://openrouter.ai) key (or [other model provider](https://docs.plandex.ai/models/model-providers) accounts and API keys).<br/>• Follow the [local-mode quickstart](./hosting/self-hosting.md) to get started. |
+| **Self-hosted/Local Mode**            | • Run Plandex locally with Docker or host on your own server.<br/>• Use your own [OpenRouter.ai](https://openrouter.ai) key (or [other model provider](https://docs.plandex.ai/models/model-providers) accounts and API keys).<br/>• Follow the [local-mode quickstart](https://docs.plandex.ai/hosting/self-hosting/local-mode-quickstart) to get started. |
 
 ## Provider keys  🔑
 
```

**File**: `app/cli/cmd/claude_max.go` (modified, +43/-0)
```diff
@@ -1,8 +1,12 @@
 package cmd
 
 import (
+	"fmt"
+	"plandex-cli/auth"
 	"plandex-cli/lib"
+	"plandex-cli/term"
 
+	"github.com/fatih/color"
 	"github.com/spf13/cobra"
 )
 
@@ -18,15 +22,54 @@ var disconnectClaudeCmd = &cobra.Command{
 	Run:   disconnectClaude,
 }
 
+var claudeStatusCmd = &cobra.Command{
+	Use:   "claude-status",
+	Short: "Check the status of your Claude Pro or Max subscription",
+	Run:   claudeStatus,
+}
+
 func connectClaude(cmd *cobra.Command, args []string) {
+	auth.MustResolveAuthWithOrg()
 	lib.ConnectClaudeMax()
 }
 
 func disconnectClaude(cmd *cobra.Command, args []string) {
+	auth.MustResolveAuthWithOrg()
 	lib.DisconnectClaudeMax()
 }
 
+func claudeStatus(cmd *cobra.Command, args []string) {
+	auth.MustResolveAuthWithOrg()
+
+	creds, err := lib.GetAccountCredentials()
+	if err != nil {
+		term.OutputErrorAndExit("Error getting account credentials: %v", err)
+	}
+
+	orgUserConfig := lib.MustGetOrgUserConfig()
+
+	connected := creds.ClaudeMax != nil && orgUserConfig.UseClaudeSubscription
+
+	if connected {
+		fmt.Println("✅ Claude Pro or Max subscription is connected")
+
+		// if orgUserConfig.IsClaudeSubscriptionCooldownActive() {
+		if true {
+			fmt.Println()
+			color.New(term.ColorHiYellow, color.Bold).Println("⏳ You've reached your Claude Pro or Max subscription quota")
+			fmt.Println("The next provider with valid credentials will be used for Anthropic models until the quota resets")
+			fmt.Println()
+		}
+
+		term.PrintCmds("", "disconnect-claude")
+	} else {
+		fmt.Println("❌ No Claude Pro or Max subscription is connected")
+		term.PrintCmds("", "connect-claude")
+	}
+}
+
 func init() {
 	RootCmd.AddCommand(connectClaudeCmd)
 	RootCmd.AddCommand(disconnectClaudeCmd)
+	RootCmd.AddCommand(claudeStatusCmd)
 }
```

**File**: `app/cli/lib/claude_max.go` (modified, +4/-4)
```diff
@@ -41,7 +41,7 @@ func promptClaudeMaxIfNeeded() bool {
 	}
 
 	term.StopSpinner()
-	fmt.Println("ℹ️  The current model pack uses Anthropic models.\nIf you have a " + color.New(color.FgHiGreen, color.Bold).Sprint("Claude Pro or Max Subscription") + ", you can connect to it.\nPlandex will then use your Claude subscription for Anthropic model calls up to your limit.\n")
+	fmt.Println("ℹ️  The current model pack uses Anthropic models.\n\nIf you have a " + color.New(color.FgHiGreen, color.Bold).Sprint("Claude Pro or Max Subscription") + ", you can connect to it.\n\nPlandex will then use your Claude subscription for Anthropic model calls up to your limit.\n")
 
 	res, err := term.ConfirmYesNo("Connect your Claude subscription?")
 	if err != nil {
@@ -54,7 +54,7 @@ func promptClaudeMaxIfNeeded() bool {
 
 	if !res {
 		fmt.Println()
-		color.New(color.FgHiBlue).Println("To connect a Claude subscription later, run:\n" + term.ShowCmd("connect-claude"))
+		fmt.Println("To connect a Claude subscription later, run:\n" + term.ShowCmd("connect-claude"))
 		fmt.Println()
 		return false
 	}
@@ -138,7 +138,7 @@ func ConnectClaudeMax() {
 	fmt.Println("✅ Your Claude subscription is now connected")
 	fmt.Println()
 
-	color.New(color.FgHiBlue).Println("To disconnect, run:\n" + term.ShowCmd("disconnect-claude"))
+	fmt.Println("To disconnect, run:\n" + term.ShowCmd("disconnect-claude"))
 	fmt.Println()
 }
 
@@ -165,7 +165,7 @@ func DisconnectClaudeMax() {
 
 	fmt.Println("✅ Your Claude subscription has been disconnected")
 	fmt.Println()
-	color.New(color.FgHiBlue).Println("To reconnect, run:\n" + term.ShowCmd("connect-claude"))
+	fmt.Println("To reconnect, run:\n" + term.ShowCmd("connect-claude"))
 	fmt.Println()
 }
 
```

**File**: `app/cli/lib/model_credentials.go` (modified, +1/-0)
```diff
@@ -352,6 +352,7 @@ func mergeAuthVars(dest, src map[string]string) {
 }
 
 func showCredentialErrorMessage(res CredentialCheckResult, opts shared.ModelProviderOptions) {
+	term.StopSpinner()
 	boldRed := color.New(color.Bold, term.ColorHiRed)
 	cyanChip := color.New(color.BgCyan, color.FgHiWhite)
 	fmt.Println(boldRed.Sprint("🚨 Required API key(s) or model credentials are missing"))
```

**File**: `app/cli/term/help.go` (modified, +2/-1)
```diff
@@ -148,6 +148,7 @@ var CliCommands = []CmdConfig{
 
 	{"connect-claude", "", "connect your Claude Pro or Max subscription", true},
 	{"disconnect-claude", "", "disconnect your Claude Pro or Max subscription", true},
+	{"claude-status", "", "status of your Claude Pro or Max subscription connection", true},
 
 	{"usage", "", "show Plandex Cloud current balance and usage report", true},
 	{"usage --today", "", "show Plandex Cloud usage for the day so far", true},
@@ -349,7 +350,7 @@ func PrintHelpAllCommands() {
 	fmt.Fprintln(builder)
 
 	color.New(color.Bold, color.BgCyan, color.FgHiWhite).Fprintln(builder, " Integrations ")
-	printCmds(builder, " ", []color.Attribute{color.Bold, ColorHiCyan}, "connect-claude", "disconnect-claude")
+	printCmds(builder, " ", []color.Attribute{color.Bold, ColorHiCyan}, "connect-claude", "disconnect-claude", "claude-status")
 	fmt.Fprintln(builder)
 
 	color.New(color.Bold, color.BgCyan, color.FgHiWhite).Fprintln(builder, " Cloud ")
```

---

### Incident Patch 3: `47443624` (2025-07-15)
**Commit Message**: fixes for custom models config, opus planner model pack

**File**: `.gitignore` (modified, +3/-1)
```diff
@@ -22,4 +22,6 @@ __pycache__/
 .aider.*
 *.code-workspace
 
-__pycache__/
\ No newline at end of file
+__pycache__/
+
+.repo_ignore
\ No newline at end of file
```

**File**: `app/cli/cmd/set_model.go` (modified, +6/-1)
```diff
@@ -335,6 +335,7 @@ func updateModelSettings(args []string, originalSettings *shared.PlanSettings, d
 		if compare == "opus-4-planner" {
 			compare = "opus-planner"
 		}
+
 		for _, ms := range builtInModelPacks {
 			if strings.EqualFold(ms.Name, compare) {
 				modelPackName = ms.Name
@@ -349,7 +350,11 @@ func updateModelSettings(args []string, originalSettings *shared.PlanSettings, d
 		}
 
 		if modelPackName == "" {
-			term.OutputErrorAndExit("No model pack found with name: %s", modelPackName)
+			term.StopSpinner()
+			term.OutputSimpleError("No model pack found with name '%s'", nameArg)
+			fmt.Println()
+			term.PrintCmds("", "model-packs")
+			os.Exit(1)
 			return nil
 		}
 
```

**File**: `app/cli/lib/model_credentials.go` (modified, +17/-7)
```diff
@@ -368,6 +368,19 @@ func showCredentialErrorMessage(res CredentialCheckResult, opts shared.ModelProv
 
 	byPub := providersByPublisher(opts)
 
+	byPubWithoutOpenRouter := map[shared.ModelPublisher][]shared.ModelProvider{}
+	for pub, providers := range byPub {
+		nonOrProviders := []shared.ModelProvider{}
+		for _, provider := range providers {
+			if provider != shared.ModelProviderOpenRouter {
+				nonOrProviders = append(nonOrProviders, provider)
+			}
+		}
+		if len(nonOrProviders) > 0 {
+			byPubWithoutOpenRouter[pub] = nonOrProviders
+		}
+	}
+
 	allPublishersHaveOpenRouter := allPublishersHaveProvider(byPub, shared.ModelProviderOpenRouter)
 
 	if allPublishersHaveOpenRouter {
@@ -388,7 +401,7 @@ func showCredentialErrorMessage(res CredentialCheckResult, opts shared.ModelProv
 		}
 	}
 
-	if len(byPub) > 0 {
+	if len(byPubWithoutOpenRouter) > 0 {
 		fmt.Println()
 		fmt.Println(color.New(term.ColorHiCyan, color.Bold).Sprint("🔑 Other model providers"))
 		if allPublishersHaveOpenRouter {
@@ -398,18 +411,15 @@ func showCredentialErrorMessage(res CredentialCheckResult, opts shared.ModelProv
 		}
 
 		fmt.Println()
-		pubs := make([]string, 0, len(byPub))
-		for p := range byPub {
+		pubs := make([]string, 0, len(byPubWithoutOpenRouter))
+		for p := range byPubWithoutOpenRouter {
 			pubs = append(pubs, string(p))
 		}
 		sort.Strings(pubs)
 		for _, p := range pubs {
-			providers := byPub[shared.ModelPublisher(p)]
+			providers := byPubWithoutOpenRouter[shared.ModelPublisher(p)]
 			providerNames := make([]string, 0, len(providers))
 			for _, provider := range providers {
-				if allPublishersHaveOpenRouter && provider == shared.ModelProviderOpenRouter {
-					continue
-				}
 				providerNames = append(providerNames, string(provider))
 			}
 			fmt.Printf("%s → %s\n", color.New(color.Bold).Sprint(p+" models"), strings.Join(providerNames, ", "))
```

**File**: `app/shared/ai_models_credentials.go` (modified, +30/-3)
```diff
@@ -25,19 +25,46 @@ func (m ModelRoleConfig) GetModelProviderOptions(settings *PlanSettings) ModelPr
 
 	for i, usesProvider := range usesProviders {
 		composite := usesProvider.ToComposite()
+
+		foundProvider := false
 		config, ok := BuiltInModelProviderConfigs[usesProvider.Provider]
-		if !ok {
+		if ok {
+			// built-in provider
+			foundProvider = true
+		} else if settings != nil && settings.CustomProviders != nil {
+			// no built-in provider, check custom providers
+			for _, customProvider := range settings.CustomProviders {
+				if usesProvider.CustomProvider != nil && customProvider.Name == *usesProvider.CustomProvider {
+					config = customProvider.ToModelProviderConfigSchema()
+					foundProvider = true
+					break
+				}
+			}
+		}
+
+		if !foundProvider {
 			continue
 		}
 
+		var publisher ModelPublisher
+
 		baseModel, ok := BuiltInBaseModelsById[m.ModelId]
-		if !ok {
+		if ok {
+			publisher = baseModel.Publisher
+		} else if settings != nil && settings.CustomModelsById != nil {
+			customModel, ok := settings.CustomModelsById[m.ModelId]
+			if ok {
+				publisher = customModel.Publisher
+			}
+		}
+
+		if publisher == "" {
 			continue
 		}
 
 		opts[composite] = ModelProviderOption{
 			Publishers: map[ModelPublisher]bool{
-				baseModel.Publisher: true,
+				publisher: true,
 			},
 			Config:   &config,
 			Priority: i,
```

**File**: `app/shared/ai_models_packs.go` (modified, +19/-3)
```diff
@@ -7,7 +7,6 @@ var OSSModelPack ModelPack
 var CheapModelPack ModelPack
 
 var OpusPlannerModelPack ModelPack
-var StrongModelOpus ModelPack
 
 var AnthropicModelPack ModelPack
 var OpenAIModelPack ModelPack
@@ -31,12 +30,11 @@ var BuiltInModelPacks = []*ModelPack{
 	&OllamaExperimentalModelPack,
 	&OllamaAdaptiveOssModelPack,
 	&OllamaAdaptiveDailyModelPack,
-	&OpusPlannerModelPack,
-	&StrongModelOpus,
 	&AnthropicModelPack,
 	&OpenAIModelPack,
 	&GoogleModelPack,
 	&GeminiPlannerModelPack,
+	&OpusPlannerModelPack,
 	&O3PlannerModelPack,
 	&R1PlannerModelPack,
 	&PerplexityPlannerModelPack,
@@ -316,6 +314,24 @@ func init() {
 		},
 	}
 
+	OpusPlannerSchema = ModelPackSchema{
+		Name:        "opus-planner",
+		Description: "Uses Claude Opus 4 for planning, default models for other roles. Supports up to 180k input context.",
+		ModelPackSchemaRoles: ModelPackSchemaRoles{
+			Planner: getModelRoleConfig(ModelRolePlanner, "anthropic/claude-opus-4"),
+			Coder: Pointer(getModelRoleConfig(ModelRoleCoder, "anthropic/claude-sonnet-4",
+				getLargeContextFallback(ModelRoleCoder, "openai/gpt-4.1"),
+			)),
+			PlanSummary: getModelRoleConfig(ModelRolePlanSummary, "openai/o4-mini-low"),
+			Builder:     defaultBuilder,
+			WholeFileBuilder: Pointer(getModelRoleConfig(ModelRoleWholeFileBuilder,
+				"openai/o4-mini-medium")),
+			Namer:      getModelRoleConfig(ModelRoleName, "openai/gpt-4.1-mini"),
+			CommitMsg:  getModelRoleConfig(ModelRoleCommitMsg, "openai/gpt-4.1-mini"),
+			ExecStatus: getModelRoleConfig(ModelRoleExecStatus, "openai/o4-mini-low"),
+		},
+	}
+
 	O3PlannerSchema = ModelPackSchema{
 		Name:        "o3-planner",
 		Description: "Uses Claude Opus 4 for planning, default models for other roles. Supports up to 180k input context.",
```

---

### Incident Patch 4: `e2ab4551` (2025-06-25)
**Commit Message**: updated model names for gemini and others, added assortment of built-in models for ollama (some with openrouter options as well), ollama experimental and adaptive built-in model packs, some fixes for ollama, and some docs updates

**File**: `app/cli/cmd/models.go` (modified, +34/-10)
```diff
@@ -131,7 +131,7 @@ func manageCustomModels(cmd *cobra.Command, args []string) {
 	usingDefaultPath := false
 	if customModelsPath == "" {
 		usingDefaultPath = true
-		customModelsPath = lib.CustomModelsDefaultPath
+		customModelsPath = lib.GetCustomModelsPath(auth.Current.UserId)
 	}
 
 	exists, err := fs.FileExists(customModelsPath)
@@ -568,15 +568,39 @@ func getExampleTemplate(isCloud, isCloudIntegratedModels bool) shared.ClientMode
 				Name:        "example-model-pack",
 				Description: "Example model pack",
 				ClientModelPackSchemaRoles: shared.ClientModelPackSchemaRoles{
-					Planner:          "deepseek/r1",
-					Architect:        "deepseek/r1",
-					Coder:            "deepseek/v3-0324",
-					PlanSummary:      lightModelId,
-					Builder:          "deepseek/r1-hidden",
-					WholeFileBuilder: "deepseek/r1-hidden",
-					ExecStatus:       "deepseek/r1-hidden",
-					Namer:            lightModelId,
-					CommitMsg:        lightModelId,
+					Planner:   "deepseek/r1",
+					Architect: "deepseek/r1",
+					Coder: &shared.ModelRoleConfigSchema{
+						ModelId: "deepseek/v3",
+						LargeContextFallback: &shared.ModelRoleConfigSchema{
+							ModelId: "google/gemini-2.5-pro",
+						},
+						ErrorFallback: &shared.ModelRoleConfigSchema{
+							ModelId: "deepseek/r1-hidden",
+						},
+					},
+					PlanSummary: lightModelId,
+					Builder: shared.ModelRoleConfigSchema{
+						ModelId: "deepseek/r1-hidden",
+						StrongModel: &shared.ModelRoleConfigSchema{
+							ModelId: "openai/o3-medium",
+						},
+					},
+					WholeFileBuilder: shared.ModelRoleConfigSchema{
+						ModelId: "deepseek/r1-hidden",
+						LargeContextFallback: &shared.ModelRoleConfigSchema{
+							ModelId: "google/gemini-2.5-pro",
+							LargeOutputFallback: &shared.ModelRoleConfigSchema{
+								ModelId: "openai/o3-low",
+							},
+						},
+						LargeOutputFallback: &shared.ModelRoleConfigSchema{
+							ModelId: "openai/o3-low",
+						},
+					},
+					ExecStatus: "deepseek/r1-hidden",
+					Namer:      lightModelId,
+					CommitMsg:  lightModelId,
 				},
 			},
 		},
```

**File**: `app/cli/cmd/plan_start_helpers.go` (modified, +9/-9)
```diff
@@ -21,12 +21,12 @@ var (
 	fullAuto  bool
 
 	// Type flags
-	dailyModels         bool
-	reasoningModels     bool
-	strongModels        bool
-	ossModels           bool
-	cheapModels         bool
-	geminiPreviewModels bool
+	dailyModels     bool
+	reasoningModels bool
+	strongModels    bool
+	ossModels       bool
+	cheapModels     bool
+	geminiModels    bool
 )
 
 func AddNewPlanFlags(cmd *cobra.Command) {
@@ -43,7 +43,7 @@ func AddNewPlanFlags(cmd *cobra.Command) {
 	cmd.Flags().BoolVar(&strongModels, "strong", false, shared.StrongModelPack.Description)
 	cmd.Flags().BoolVar(&cheapModels, "cheap", false, shared.CheapModelPack.Description)
 	cmd.Flags().BoolVar(&ossModels, "oss", false, shared.OSSModelPack.Description)
-	cmd.Flags().BoolVar(&geminiPreviewModels, "gemini-preview", false, shared.GeminiPreviewModelPack.Description)
+	cmd.Flags().BoolVar(&geminiModels, "gemini", false, shared.GeminiModelPack.Description)
 }
 
 func resolveAutoMode(config *shared.PlanConfig) (bool, *shared.PlanConfig) {
@@ -139,8 +139,8 @@ func resolveModelPackWithArgs(settings *shared.PlanSettings, silent bool) (*shar
 		packName = shared.ReasoningModelPack.Name
 	} else if dailyModels {
 		packName = shared.DailyDriverModelPack.Name
-	} else if geminiPreviewModels {
-		packName = shared.GeminiPreviewModelPack.Name
+	} else if geminiModels {
+		packName = shared.GeminiModelPack.Name
 	}
 
 	if packName != "" && packName != originalSettings.GetModelPack().Name {
```

**File**: `app/cli/cmd/repl.go` (modified, +1/-1)
```diff
@@ -130,7 +130,7 @@ func runRepl(cmd *cobra.Command, args []string) {
 			args = append(args, "--daily")
 		} else if reasoningModels {
 			args = append(args, "--reasoning")
-		} else if geminiPreviewModels {
+		} else if geminiModels {
 			args = append(args, "--gemini-preview")
 		}
 
```

**File**: `app/cli/lib/custom_models.go` (modified, +8/-5)
```diff
@@ -16,15 +16,13 @@ import (
 	"github.com/fatih/color"
 )
 
-var CustomModelsDefaultPath string
-
 type CustomModelsCheckLocalChangesResult struct {
 	HasLocalChanges  bool
 	LocalModelsInput shared.ModelsInput
 }
 
-func init() {
-	CustomModelsDefaultPath = filepath.Join(fs.HomePlandexDir, "custom-models.json")
+func GetCustomModelsPath(userId string) string {
+	return filepath.Join(fs.HomePlandexDir, "accounts", userId, "custom-models.json")
 }
 
 func GetServerModelsInput() (*shared.ModelsInput, error) {
@@ -330,12 +328,17 @@ func MustSyncCustomModels(path string, serverModelsInput *shared.ModelsInput) bo
 }
 
 func SyncCustomModels() error {
+	userId := auth.Current.UserId
+	if userId == "" {
+		return fmt.Errorf("auth.Current.UserId is empty")
+	}
+
 	serverModelsInput, err := GetServerModelsInput()
 	if err != nil {
 		return fmt.Errorf("error getting server models input: %v", err)
 	}
 
-	MustSyncCustomModels(CustomModelsDefaultPath, serverModelsInput)
+	MustSyncCustomModels(GetCustomModelsPath(userId), serverModelsInput)
 
 	return nil
 }
```

**File**: `app/cli/lib/models_sync.go` (modified, +10/-2)
```diff
@@ -2,6 +2,7 @@ package lib
 
 import (
 	"fmt"
+	"plandex-cli/auth"
 	"plandex-cli/term"
 
 	"github.com/fatih/color"
@@ -11,15 +12,22 @@ func PromptSyncModelsIfNeeded() error {
 	var changes []string
 	var onApprove []func() error
 
-	customModelsRes, err := CustomModelsCheckLocalChanges(CustomModelsDefaultPath)
+	userId := auth.Current.UserId
+	if userId == "" {
+		return fmt.Errorf("auth.Current.UserId is empty")
+	}
+
+	customModelsPath := GetCustomModelsPath(userId)
+
+	customModelsRes, err := CustomModelsCheckLocalChanges(customModelsPath)
 	if err != nil {
 		return fmt.Errorf("error checking custom models: %v", err)
 	}
 
 	if customModelsRes.HasLocalChanges {
 		changes = append(
 			changes,
-			fmt.Sprintf("%s → %s", color.New(term.ColorHiCyan, color.Bold).Sprint("Custom models"), CustomModelsDefaultPath))
+			fmt.Sprintf("%s → %s", color.New(term.ColorHiCyan, color.Bold).Sprint("Custom models"), customModelsPath))
 
 		onApprove = append(onApprove, SyncCustomModels)
 	}
```

---

### Incident Patch 5: `74ee022c` (2025-06-24)
**Commit Message**: fixes for custom models and custom providers. fix to only use :nitro suffix with openrouter if not using another special suffix (like :free)

**File**: `app/cli/cmd/model_packs.go` (modified, +11/-3)
```diff
@@ -127,11 +127,19 @@ func showModelPack(cmd *cobra.Command, args []string) {
 
 	term.StartSpinner("")
 	customModelPacks, apiErr := api.Client.ListModelPacks()
-	term.StopSpinner()
-
 	if apiErr != nil {
 		term.OutputErrorAndExit("Error fetching models: %v", apiErr)
 	}
+	customModels, err := api.Client.ListCustomModels()
+	if err != nil {
+		term.OutputErrorAndExit("Error fetching custom models: %v", err)
+	}
+	customModelsById := make(map[shared.ModelId]*shared.CustomModel)
+	for _, m := range customModels {
+		customModelsById[m.ModelId] = m
+	}
+
+	term.StopSpinner()
 
 	modelPacks := []*shared.ModelPack{}
 	modelPacks = append(modelPacks, customModelPacks...)
@@ -186,7 +194,7 @@ func showModelPack(cmd *cobra.Command, args []string) {
 		return
 	}
 
-	renderModelPack(modelPack, allProperties)
+	renderModelPack(modelPack, customModelsById, allProperties)
 
 	fmt.Println()
 
```

**File**: `app/cli/cmd/models.go` (modified, +8/-6)
```diff
@@ -361,23 +361,23 @@ func renderSettings(settings *shared.PlanSettings, allProperties bool) {
 	modelPack := settings.GetModelPack()
 
 	color.New(color.Bold, term.ColorHiCyan).Println("🎛️  Current Model Pack")
-	renderModelPack(modelPack, allProperties)
+	renderModelPack(modelPack, settings.CustomModelsById, allProperties)
 
 	if allProperties {
 		color.New(color.Bold, term.ColorHiCyan).Println("🧠 Planner Defaults")
 		table := tablewriter.NewWriter(os.Stdout)
 		table.SetAutoWrapText(false)
 		table.SetHeader([]string{"Max Tokens", "Max Convo Tokens"})
 		table.Append([]string{
-			fmt.Sprintf("%d", modelPack.Planner.GetFinalLargeContextFallback().GetSharedBaseConfig().MaxTokens),
-			fmt.Sprintf("%d", modelPack.Planner.GetMaxConvoTokens()),
+			fmt.Sprintf("%d", modelPack.Planner.GetFinalLargeContextFallback().GetSharedBaseConfig(settings).MaxTokens),
+			fmt.Sprintf("%d", modelPack.Planner.GetMaxConvoTokens(settings)),
 		})
 		table.Render()
 		fmt.Println()
 	}
 }
 
-func renderModelPack(modelPack *shared.ModelPack, allProperties bool) {
+func renderModelPack(modelPack *shared.ModelPack, customModelsById map[shared.ModelId]*shared.CustomModel, allProperties bool) {
 	table := tablewriter.NewWriter(os.Stdout)
 	table.SetAutoFormatHeaders(false)
 	table.SetAutoWrapText(true)
@@ -428,7 +428,9 @@ func renderModelPack(modelPack *shared.ModelPack, allProperties bool) {
 		var topP float32
 		var disabled bool
 
-		if config.GetSharedBaseConfig().RoleParamsDisabled {
+		sharedBaseConfig := config.GetSharedBaseConfigWithCustomModels(customModelsById)
+
+		if sharedBaseConfig.RoleParamsDisabled {
 			temp = 1
 			topP = 1
 			disabled = true
@@ -457,7 +459,7 @@ func renderModelPack(modelPack *shared.ModelPack, allProperties bool) {
 			row = append(row, []string{
 				tempStr,
 				topPStr,
-				fmt.Sprintf("%d 🪙", config.GetSharedBaseConfig().MaxTokens-config.GetReservedOutputTokens()),
+				fmt.Sprintf("%d 🪙", sharedBaseConfig.MaxTokens-config.GetReservedOutputTokens(customModelsById)),
 			}...)
 		}
 		table.Append(row)
```

**File**: `app/server/db/settings_helpers.go` (modified, +80/-24)
```diff
@@ -18,19 +18,14 @@ func GetPlanSettings(plan *Plan) (settings *shared.PlanSettings, err error) {
 	planDir := getPlanDir(plan.OrgId, plan.Id)
 	settingsPath := filepath.Join(planDir, "settings.json")
 
-	customModelPacks, err := ListModelPacks(plan.OrgId)
+	result, err := GetApiCustomModels(plan.OrgId)
 	if err != nil {
-		return nil, fmt.Errorf("error getting custom model packs: %v", err)
-	}
-
-	apiModelPacks := make([]*shared.ModelPack, len(customModelPacks))
-	for i, modelPack := range customModelPacks {
-		apiModelPacks[i] = modelPack.ToApi()
+		return nil, fmt.Errorf("error getting custom models: %v", err)
 	}
 
 	defer func() {
 		if settings != nil {
-			settings.Configure(apiModelPacks, os.Getenv("PLANDEX_CLOUD") != "")
+			settings.Configure(result.CustomModelPacks, result.CustomModels, result.CustomProviders, os.Getenv("PLANDEX_CLOUD") != "")
 		}
 	}()
 
@@ -103,19 +98,14 @@ func StorePlanSettings(plan *Plan, settings shared.PlanSettings) error {
 }
 
 func GetOrgDefaultSettings(orgId string) (settings *shared.PlanSettings, err error) {
-	customModelPacks, err := ListModelPacks(orgId)
+	result, err := GetApiCustomModels(orgId)
 	if err != nil {
-		return nil, fmt.Errorf("error getting custom model packs: %v", err)
-	}
-
-	apiModelPacks := make([]*shared.ModelPack, len(customModelPacks))
-	for i, modelPack := range customModelPacks {
-		apiModelPacks[i] = modelPack.ToApi()
+		return nil, fmt.Errorf("error getting custom models: %v", err)
 	}
 
 	defer func() {
 		if settings != nil {
-			settings.Configure(apiModelPacks, os.Getenv("PLANDEX_CLOUD") != "")
+			settings.Configure(result.CustomModelPacks, result.CustomModels, result.CustomProviders, os.Getenv("PLANDEX_CLOUD") != "")
 		}
 	}()
 
@@ -141,19 +131,14 @@ func GetOrgDefaultSettings(orgId string) (settings *shared.PlanSettings, err err
 }
 
 func GetOrgDefaultSettingsForUpdate(orgId string, tx *sqlx.Tx) (settings *shared.PlanSettings, err error) {
-	customModelPacks, err := ListModelPacks(orgId)
+	result, err := GetApiCustomModels(orgId)
 	if err != nil {
-		return nil, fmt.Errorf("error getting custom model packs: %v", err)
-	}
-
-	apiModelPacks := make([]*shared.ModelPack, len(customModelPacks))
-	for i, modelPack := range customModelPacks {
-		apiModelPacks[i] = modelPack.ToApi()
+		return nil, fmt.Errorf("error getting custom models: %v", err)
 	}
 
 	defer func() {
 		if settings != nil {
-			settings.Configure(apiModelPacks, os.Getenv("PLANDEX_CLOUD") != "")
+			settings.Configure(result.CustomModelPacks, result.CustomModels, result.CustomProviders, os.Getenv("PLANDEX_CLOUD") != "")
 		}
 	}()
 
@@ -193,3 +178,74 @@ func StoreOrgDefaultSettings(orgId string, settings *shared.PlanSettings, tx *sq
 
 	return nil
 }
+
+type GetCustomModelsResult struct {
+	CustomModels     []*shared.CustomModel
+	CustomProviders  []*shared.CustomProvider
+	CustomModelPacks []*shared.ModelPack
+}
+
+func GetApiCustomModels(orgId string) (result *GetCustomModelsResult, err error) {
+	var customModels []*CustomModel
+	var customProviders []*CustomProvider
+	var customModelPacks []*ModelPack
+
+	errCh := make(chan error, 3)
+
+	go func() {
+		res, err := ListModelPacks(orgId)
+		if err != nil {
+			errCh <- fmt.Errorf("error getting custom model packs: %v", err)
+		}
+		customModelPacks = res
+		errCh <- nil
+	}()
+
+	go func() {
+		res, err := ListCustomModels(orgId)
+		if err != nil {
+			errCh <- fmt.Errorf("error getting custom models: %v", err)
+		}
+		customModels = res
+		errCh <- nil
+	}()
+
+	go func() {
+		res, err := ListCustomProviders(orgId)
+		if err != nil {
+			errCh <- fmt.Errorf("error getting custom providers: %v", err)
+		}
+		customProviders = res
+		errCh <- nil
+	}()
+
+	for i := 0; i < 3; i++ {
+		err := <-errCh
+		if err != nil {
+			return nil, err
+		}
+	}
+
+	apiModelPacks := make([]*shared.ModelPack, len(customModelPacks))
+	for i, modelPack := range customModelPacks {
+		apiModelPacks[i] = modelPack.ToApi()
+	}
+
+	apiCustomModels := make([]*shar
```

**File**: `app/server/handlers/client_helper.go` (modified, +5/-2)
```diff
@@ -8,6 +8,7 @@ import (
 	"plandex-server/hooks"
 	"plandex-server/model"
 	"plandex-server/types"
+	shared "plandex-shared"
 )
 
 type initClientsParams struct {
@@ -19,7 +20,8 @@ type initClientsParams struct {
 
 	authVars map[string]string
 
-	plan *db.Plan
+	plan     *db.Plan
+	settings *shared.PlanSettings
 }
 
 type initClientsResult struct {
@@ -29,6 +31,7 @@ type initClientsResult struct {
 
 func initClients(params initClientsParams) initClientsResult {
 	w := params.w
+	settings := params.settings
 
 	var authVars map[string]string
 	if params.authVars != nil {
@@ -63,7 +66,7 @@ func initClients(params initClientsParams) initClientsResult {
 		return initClientsResult{}
 	}
 
-	clients := model.InitClients(authVars)
+	clients := model.InitClients(authVars, settings)
 
 	return initClientsResult{
 		clients:  clients,
```

**File**: `app/server/handlers/context_helper.go` (modified, +2/-1)
```diff
@@ -110,6 +110,7 @@ func loadContexts(
 					openAIOrgId: context.OpenAIOrgId,
 					authVars:    context.AuthVars,
 					plan:        plan,
+					settings:    settings,
 				},
 			)
 
@@ -123,7 +124,7 @@ func loadContexts(
 	// ensure image compatibility if we're loading an image
 	for _, context := range *loadReq {
 		if context.ContextType == shared.ContextImageType {
-			if !settings.GetModelPack().Planner.GetSharedBaseConfig().HasImageSupport {
+			if !settings.GetModelPack().Planner.GetSharedBaseConfig(settings).HasImageSupport {
 				log.Printf("Error loading context: %s does not support images in context\n", settings.GetModelPack().Planner.ModelId)
 				http.Error(w, fmt.Sprintf("Error loading context: %s does not support images in context", settings.GetModelPack().Planner.ModelId), http.StatusBadRequest)
 				return nil, nil
```

---

### Incident Patch 6: `7d965393` (2025-06-23)
**Commit Message**: make sure stack traces are included in error messages on panic. better error messages in a few other spots as well

**File**: `app/server/db/queue.go` (modified, +1/-1)
```diff
@@ -249,7 +249,7 @@ func (q *repoQueue) runQueue() {
 								if panicErr != nil {
 									log.Printf("[Queue] Panic in operation %s (%s): %v", op.id, op.reason, panicErr)
 									log.Printf("[Queue] Stack trace: %s", string(debug.Stack()))
-									opErr = fmt.Errorf("panic in operation: %v", panicErr)
+									opErr = fmt.Errorf("panic in operation: %v\n%s", panicErr, string(debug.Stack()))
 								}
 
 								if opErr != nil && op.scope == LockScopeWrite && op.clearRepoOnErr {
```

**File**: `app/server/db/transactions.go` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ func withTx(ctx context.Context, opts *sql.TxOptions, reason string, fn func(tx
 	defer func() {
 		panicErr := recover()
 		if panicErr != nil {
-			log.Printf("panic in WithTx (%s): %v", reason, panicErr)
+			log.Printf("panic in WithTx (%s): %v\n%s", reason, panicErr, debug.Stack())
 			log.Printf("stack trace (panic - %s):\n%s", reason, debug.Stack())
 		}
 
```

**File**: `app/server/model/plan/tell_build_pending.go` (modified, +2/-2)
```diff
@@ -33,7 +33,7 @@ func (state *activeTellStreamState) queuePendingBuilds() {
 			active.StreamDoneCh <- &shared.ApiError{
 				Type:   shared.ApiErrorTypeOther,
 				Status: http.StatusInternalServerError,
-				Msg:    fmt.Sprintf("Error getting pending builds by path: %v", r),
+				Msg:    fmt.Sprintf("Error getting pending builds by path: %v\n%s", r, debug.Stack()),
 			}
 		}
 	}()
@@ -47,7 +47,7 @@ func (state *activeTellStreamState) queuePendingBuilds() {
 		active.StreamDoneCh <- &shared.ApiError{
 			Type:   shared.ApiErrorTypeOther,
 			Status: http.StatusInternalServerError,
-			Msg:    "Error getting pending builds by path",
+			Msg:    fmt.Sprintf("Error getting pending builds by path: %v", err),
 		}
 		return
 	}
```

**File**: `app/server/model/plan/tell_exec.go` (modified, +3/-3)
```diff
@@ -116,7 +116,7 @@ func execTellPlan(params execTellPlanParams) {
 			active.StreamDoneCh <- &shared.ApiError{
 				Type:   shared.ApiErrorTypeOther,
 				Status: http.StatusInternalServerError,
-				Msg:    "Panic in execTellPlan",
+				Msg:    fmt.Sprintf("Panic in execTellPlan: %v\n%s", r, string(debug.Stack())),
 			}
 		}
 	}()
@@ -145,7 +145,7 @@ func execTellPlan(params execTellPlanParams) {
 		active.StreamDoneCh <- &shared.ApiError{
 			Type:   shared.ApiErrorTypeOther,
 			Status: http.StatusInternalServerError,
-			Msg:    "Error setting plan status to replying",
+			Msg:    fmt.Sprintf("Error setting plan status to replying: %v", err),
 		}
 
 		log.Printf("execTellPlan: execTellPlan operation completed for plan ID %s on branch %s, iteration %d\n", plan.Id, branch, iteration)
@@ -292,7 +292,7 @@ func execTellPlan(params execTellPlanParams) {
 		active.StreamDoneCh <- &shared.ApiError{
 			Type:   shared.ApiErrorTypeOther,
 			Status: http.StatusInternalServerError,
-			Msg:    err.Error(),
+			Msg:    fmt.Sprintf("Error getting tell sys prompt: %v", err),
 		}
 		return
 	}
```

**File**: `app/server/model/plan/tell_load.go` (modified, +1/-1)
```diff
@@ -334,7 +334,7 @@ func (state *activeTellStreamState) loadTellPlan() error {
 		active.StreamDoneCh <- &shared.ApiError{
 			Type:   shared.ApiErrorTypeOther,
 			Status: http.StatusInternalServerError,
-			Msg:    "Error loading tell plan",
+			Msg:    fmt.Sprintf("Error loading tell plan: %v", err),
 		}
 		return err
 	}
```

---

### Incident Patch 7: `6302d8e3` (2025-06-23)
**Commit Message**: fix for missing model ids, ollama experimental vs. adaptive packs, omitempty for models input json

**File**: `app/shared/ai_models_available.go` (modified, +14/-7)
```diff
@@ -498,17 +498,22 @@ func init() {
 					modelId = ModelId(strings.Join([]string{string(baseId), string(variant.VariantTag)}, "-"))
 				}
 
+				if _, ok := BuiltInBaseModelsById[modelId]; !ok {
+					cloned := *model
+					cloned.ModelId = modelId
+					merged := Merge(model.BaseModelShared, variant.Overrides)
+					cloned.BaseModelShared = merged
+
+					BuiltInModelProvidersByModelId[modelId] = cloned.Providers
+					BuiltInBaseModelsById[modelId] = &cloned
+					BuiltInBaseModels = append(BuiltInBaseModels, &cloned)
+				}
+
 				if len(variant.Variants) > 0 {
 					addVariants(variant.Variants, modelId)
 					continue
 				}
 
-				cloned := *model
-				cloned.ModelId = modelId
-
-				BuiltInModelProvidersByModelId[modelId] = cloned.Providers
-				BuiltInBaseModelsById[modelId] = &cloned
-				BuiltInBaseModels = append(BuiltInBaseModels, &cloned)
 			}
 		}
 
@@ -524,7 +529,9 @@ func init() {
 	}
 
 	// fmt.Println("AvailableModels")
-	// spew.Dump(AvailableModels)
+	// for _, model := range AvailableModels {
+	// 	fmt.Println(model.ModelString())
+	// }
 
 	for _, model := range AvailableModels {
 		if model.Description == "" {
```

**File**: `app/shared/ai_models_custom.go` (modified, +4/-4)
```diff
@@ -55,9 +55,9 @@ type CustomProvider struct {
 }
 
 type ModelsInput struct {
-	CustomModels     []*CustomModel     `json:"models"`
+	CustomModels     []*CustomModel     `json:"models,omitempty"`
 	CustomProviders  []*CustomProvider  `json:"providers,omitempty"`
-	CustomModelPacks []*ModelPackSchema `json:"modelPacks"`
+	CustomModelPacks []*ModelPackSchema `json:"modelPacks,omitempty"`
 }
 
 func (input ModelsInput) FilterUnchanged(existing *ModelsInput) ModelsInput {
@@ -214,9 +214,9 @@ func (input *ModelPackSchema) ToClientModelPackSchema() *ClientModelPackSchema {
 type ClientModelsInput struct {
 	SchemaUrl SchemaUrl `json:"$schema"`
 
-	CustomModels     []*CustomModel           `json:"models"`
+	CustomModels     []*CustomModel           `json:"models,omitempty"`
 	CustomProviders  []*CustomProvider        `json:"providers,omitempty"`
-	CustomModelPacks []*ClientModelPackSchema `json:"modelPacks"`
+	CustomModelPacks []*ClientModelPackSchema `json:"modelPacks,omitempty"`
 }
 
 func (input ClientModelsInput) ToModelsInput() ModelsInput {
```

**File**: `app/shared/ai_models_data_models.go` (modified, +1/-1)
```diff
@@ -247,7 +247,7 @@ type AvailableModel struct {
 
 func (m *AvailableModel) ModelString() string {
 	s := ""
-	if m.Provider != ModelProviderOpenAI {
+	if m.Provider != "" && m.Provider != ModelProviderOpenAI {
 		s += string(m.Provider) + "/"
 	}
 	s += string(m.ModelId)
```

**File**: `app/shared/ai_models_packs.go` (modified, +91/-60)
```diff
@@ -17,15 +17,17 @@ var GeminiExperimentalModelPack ModelPack
 var R1PlannerModelPack ModelPack
 var PerplexityPlannerModelPack ModelPack
 
-var OllamaModelPack ModelPack
+var OllamaExperimentalModelPack ModelPack
+var OllamaAdaptiveModelPack ModelPack
 
 var BuiltInModelPacks = []*ModelPack{
 	&DailyDriverModelPack,
 	&ReasoningModelPack,
 	&StrongModelPack,
 	&CheapModelPack,
 	&OSSModelPack,
-	&OllamaModelPack,
+	&OllamaExperimentalModelPack,
+	&OllamaAdaptiveModelPack,
 	&OpusPlannerModelPack,
 	&StrongModelOpus,
 	&AnthropicModelPack,
@@ -79,41 +81,43 @@ func getStrongModelFallback(role ModelRole, modelId ModelId, fns ...func(*ModelR
 }
 
 var (
-	DailyDriverPackSchema        ModelPackSchema
-	ReasoningPackSchema          ModelPackSchema
-	StrongPackSchema             ModelPackSchema
-	OSSModelPackSchema           ModelPackSchema
-	CheapModelPackSchema         ModelPackSchema
-	OllamaModelPackSchema        ModelPackSchema
-	AnthropicPackSchema          ModelPackSchema
-	OpenAIPackSchema             ModelPackSchema
-	GeminiPreviewPackSchema      ModelPackSchema
-	GeminiExperimentalPackSchema ModelPackSchema
-	R1PlannerPackSchema          ModelPackSchema
-	PerplexityPlannerPackSchema  ModelPackSchema
+	DailyDriverSchema        ModelPackSchema
+	ReasoningSchema          ModelPackSchema
+	StrongSchema             ModelPackSchema
+	OssSchema                ModelPackSchema
+	CheapSchema              ModelPackSchema
+	OllamaExperimentalSchema ModelPackSchema
+	OllamaAdaptiveSchema     ModelPackSchema
+	AnthropicSchema          ModelPackSchema
+	OpenAISchema             ModelPackSchema
+	GeminiPreviewSchema      ModelPackSchema
+	GeminiExperimentalSchema ModelPackSchema
+	R1PlannerSchema          ModelPackSchema
+	PerplexityPlannerSchema  ModelPackSchema
 )
 
 var BuiltInModelPackSchemas = []*ModelPackSchema{
-	&DailyDriverPackSchema,
-	&ReasoningPackSchema,
-	&StrongPackSchema,
-	&CheapModelPackSchema,
-	&OSSModelPackSchema,
-	&OllamaModelPackSchema,
-	&AnthropicPackSchema,
-	&OpenAIPackSchema,
-	&GeminiPreviewPackSchema,
-	&GeminiExperimentalPackSchema,
-	&R1PlannerPackSchema,
-	&PerplexityPlannerPackSchema,
+	&DailyDriverSchema,
+	&ReasoningSchema,
+	&StrongSchema,
+	&CheapSchema,
+	&OssSchema,
+	&OllamaExperimentalSchema,
+	&OllamaAdaptiveSchema,
+	&AnthropicSchema,
+	&OpenAISchema,
+	&GeminiPreviewSchema,
+	&GeminiExperimentalSchema,
+	&R1PlannerSchema,
+	&PerplexityPlannerSchema,
 }
 
 func init() {
 	defaultBuilder := getModelRoleConfig(ModelRoleBuilder, "openai/o4-mini-medium",
 		getStrongModelFallback(ModelRoleBuilder, "openai/o4-mini-high"),
 	)
 
-	DailyDriverPackSchema = ModelPackSchema{
+	DailyDriverSchema = ModelPackSchema{
 		Name:        "daily-driver",
 		Description: "A mix of models from Anthropic, OpenAI, and Google that balances speed, quality, and cost. Supports up to 2M context.",
 		ModelPackSchemaRoles: ModelPackSchemaRoles{
@@ -139,7 +143,7 @@ func init() {
 		},
 	}
 
-	ReasoningPackSchema = ModelPackSchema{
+	ReasoningSchema = ModelPackSchema{
 		Name:        "reasoning",
 		Description: "Like the daily driver, but uses sonnet-4-thinking with reasoning enabled for planning and coding. Supports up to 160k input context.",
 		ModelPackSchemaRoles: ModelPackSchemaRoles{
@@ -155,7 +159,7 @@ func init() {
 		},
 	}
 
-	StrongPackSchema = ModelPackSchema{
+	StrongSchema = ModelPackSchema{
 		Name:        "strong",
 		Description: "For difficult tasks where slower responses and builds are ok. Uses o3-high for architecture and planning, claude-sonnet-4 thinking for implementation. Supports up to 160k input context.",
 		ModelPackSchemaRoles: ModelPackSchemaRoles{
@@ -172,7 +176,7 @@ func init() {
 		},
 	}
 
-	CheapModelPackSchema = ModelPackSchema{
+	CheapSchema = ModelPackSchema{
 		Name:        "cheap",
 		Description: "Cost-effective models that can still get the job done for easier tasks. Supports up to 160k context. Uses OpenAI's o4-mini model for planning, GPT-4.1 for coding, and GPT-4.1 Mini for light
```

---

### Incident Patch 8: `9a01fea8` (2025-06-23)
**Commit Message**: ollama quickstart, minor fixes for provider/env var docs

**File**: `docs/docs/environment-variables.md` (modified, +4/-0)
```diff
@@ -41,6 +41,7 @@ VERTEXAI_LOCATION= # Your Google Vertex AI location
 AZURE_OPENAI_API_KEY= # Your Azure OpenAI API key
 AZURE_API_BASE= # Your Azure OpenAI API base URL
 AZURE_API_VERSION= # Your Azure OpenAI API version
+AZURE_DEPLOYMENTS_MAP= # Your Azure OpenAI deployments map—a JSON object mapping model names to deployment names (only needed if deployment names are different from model names)
 
 # DeepSeek
 DEEPSEEK_API_KEY= # Your DeepSeek API key
@@ -49,9 +50,12 @@ DEEPSEEK_API_KEY= # Your DeepSeek API key
 PERPLEXITY_API_KEY= # Your Perplexity API key
 
 # Amazon Bedrock
+PLANDEX_AWS_PROFILE= # Name of AWS profile in ~/.aws/credentials to use for AWS Bedrock. If not set, the credentials file won't be used.
 AWS_ACCESS_KEY_ID= # Your AWS access key ID
 AWS_SECRET_ACCESS_KEY= # Your AWS secret access key
 AWS_REGION= # Your AWS region
+AWS_SESSION_TOKEN= # Your AWS session token
+AWS_INFERENCE_PROFILE_ARN= # Your AWS inference profile ARN
 ```
 
 ### Upgrades
```

**File**: `docs/docs/models/model-providers.md` (modified, +11/-1)
```diff
@@ -100,7 +100,17 @@ export AZURE_DEPLOYMENTS_MAP='{"gpt-4.1": "gpt-4.1-deployment-name"}' # optional
 
 ### AWS Bedrock
 
-You can optionally use AWS Bedrock for Anthropic models. AWS Bedrock uses standard AWS authentication via environment variables.
+You can optionally use AWS Bedrock for Anthropic models.
+
+If you have an AWS credentials file at `~/.aws/credentials`, you can use that to authenticate by setting the `PLANDEX_AWS_PROFILE` environment variable:
+
+```bash
+export PLANDEX_AWS_PROFILE=... # set the name of the profile in ~/.aws/credentials to use
+```
+
+Note that the credentials file will _only_ be read if `PLANDEX_AWS_PROFILE` is set.
+
+You can also use environment variables for AWS authentication:
 
 ```bash
 export AWS_ACCESS_KEY_ID=... # set your AWS access key ID
```

**File**: `docs/docs/models/models-overview.md` (modified, +0/-9)
```diff
@@ -99,13 +99,4 @@ While you can use Plandex with many different providers and models as described
 
 Plandex supports local models via [Ollama](https://ollama.com/). For more details, see the [Ollama Quickstart](./ollama.md).
 
-### Local Models Disclaimer
-
-While local models are supported via Ollama, small models that can be run locally often aren't strong enough to produce usable results for the [heavy-lifting roles](./roles.md) like `planner`, `architect`, `coder`, and `builder`. The prompts for these roles require strong instruction following that can be hard to achieve with small models.
-
-The strongest open source models _are_ capable enough for decent results, but these models are quite large for running locally without a very powerful system. This isn't meant to discourage experimentation with local models, but to set expectations for what is realistically achievable.
-
-To help bridge the gap as local models continue to improve their capabilities, a built-in `ollama-adaptive` model pack is available. This model pack uses local Ollama models for less demanding roles, plus larger remote models for heavy-lifting.  
-
-
 
```

**File**: `docs/docs/models/ollama.md` (modified, +78/-1)
```diff
@@ -5,4 +5,81 @@ sidebar_label: Ollama Quickstart
 
 # Ollama Quickstart
 
-Plandex works with [Ollama](https://ollama.com/) models.
\ No newline at end of file
+Plandex works with [Ollama](https://ollama.com/) models. To use them, you need to [self-host Plandex.](../hosting/self-hosting/local-mode-quickstart.md) Ollama isn't supported with Plandex Cloud.
+
+## Disclaimer
+
+While local models are supported via Ollama, small models that can be run locally often aren't strong enough to produce usable results for the [heavy-lifting roles](./roles.md) like `planner`, `architect`, `coder`, and `builder`. The prompts for these roles require strong instruction following that can be hard to achieve with small models.
+
+The strongest open source models _are_ capable enough for decent results, but these models are quite large for running locally without a very powerful system. This isn't meant to discourage experimentation with local models, but to set expectations for what is achievable.
+
+To help bridge the gap as local models continue to improve their capabilities, a built-in `ollama-adaptive` model pack is available. This model pack uses local Ollama models for less demanding roles, plus larger remote models for heavy-lifting. There's also a built-in `ollama-experimental` model pack that uses local models for all roles—this is recommended for testing and benchmarking, but not for getting real work done.
+
+## Install and run Ollama
+
+[Download and install ollama](https://ollama.com/download) for your platform.
+
+Then make sure the ollama server is running:
+
+```bash
+ollama serve
+```
+
+## Pull Ollama models
+
+Pull the models you want to use. For the built-in `ollama-adaptive` and `ollama-experimental` model packs, pull the following models:
+
+```bash
+ollama pull qwen3:32b
+ollama pull qwen3:8b
+ollama pull qwen3:14b
+ollama pull devstral:24b
+```
+
+## Use Ollama in Plandex
+
+### Built-in model packs
+
+To use one of the built-in Ollama model packs in Plandex, decide whether you want to use `ollama-experimental`, which uses local models for all roles, but may struggle in practice, or `ollama-adaptive`, which uses local models for less demanding roles, plus the default Plandex models for heavy-lifting.
+
+```bash
+\set-model ollama-experimental # REPL
+plandex set-model ollama-experimental # CLI
+```
+
+Or:
+
+```bash
+\set-model ollama-adaptive # REPL
+plandex set-model ollama-adaptive # CLI
+```
+
+### Custom models and model packs
+
+You can also setup [custom models and model packs](./custom-models.md) for use with Ollama.
+
+When configuring a custom model, be sure you add the `ollama` provider to the `providers` array with the `modelName` set to the name of the model you want to use, exactly as it appears in the [Ollama model list](https://ollama.com/models), prefixed with `ollama_chat/`. For example, to use the `qwen3:32b` model, you would add the following to the `providers` array:
+
+```json
+"providers": [
+  {
+    "provider": "ollama",
+    "modelName": "ollama_chat/qwen3:32b"
+  }
+]
+```
+
+When configuring a custom model pack to use Ollama, set the top-level `localProvider` key to `ollama`. For example:
+
+```json
+{
+  ...
+  "modelPacks": [
+    {
+      "localProvider": "ollama",
+      ...
+    }
+  ]
+}
+```
+
```

---

### Incident Patch 9: `0644af53` (2025-06-23)
**Commit Message**: always write hash when custom models is saved to prevent unneeded save prompt. fix docs link in credentials message

**File**: `app/cli/cmd/models.go` (modified, +10/-5)
```diff
@@ -205,7 +205,7 @@ func manageCustomModels(cmd *cobra.Command, args []string) {
 			}
 
 			if !serverModelsInput.Equals(localModelsInput) {
-				err := lib.WriteCustomModelsFile(customModelsPath, serverModelsInput, true)
+				err := lib.WriteCustomModelsFile(customModelsPath, serverModelsInput)
 				if err != nil {
 					term.OutputErrorAndExit("Error saving custom models file: %v", err)
 					return
@@ -230,7 +230,7 @@ func manageCustomModels(cmd *cobra.Command, args []string) {
 		}
 	}
 
-	didUpdate := lib.MustSyncCustomModels(customModelsPath, serverModelsInput, saveCustomModels)
+	didUpdate := lib.MustSyncCustomModels(customModelsPath, serverModelsInput)
 
 	if !didUpdate {
 		fmt.Println("🤷‍♂️ No changes to custom models/providers/model packs")
@@ -552,6 +552,11 @@ func getExampleTemplate(isCloud, isCloudIntegratedModels bool) shared.ClientMode
 		}
 	}
 
+	lightModelId := "meta-llama/llama-4-maverick"
+	if len(customModels) == 0 {
+		lightModelId = "mistral/devstral-small"
+	}
+
 	return shared.ClientModelsInput{
 		SchemaUrl:       shared.SchemaUrlInputConfig,
 		CustomProviders: customProviders,
@@ -564,12 +569,12 @@ func getExampleTemplate(isCloud, isCloudIntegratedModels bool) shared.ClientMode
 					Planner:          "deepseek/r1",
 					Architect:        "deepseek/r1",
 					Coder:            "deepseek/v3-0324",
-					PlanSummary:      "meta-llama/llama-4-maverick",
+					PlanSummary:      lightModelId,
 					Builder:          "deepseek/r1-hidden",
 					WholeFileBuilder: "deepseek/r1-hidden",
 					ExecStatus:       "deepseek/r1-hidden",
-					Namer:            "meta-llama/llama-4-maverick",
-					CommitMsg:        "meta-llama/llama-4-maverick",
+					Namer:            lightModelId,
+					CommitMsg:        lightModelId,
 				},
 			},
 		},
```

**File**: `app/cli/lib/custom_models.go` (modified, +11/-14)
```diff
@@ -118,6 +118,7 @@ func CustomModelsCheckLocalChanges(path string) (CustomModelsCheckLocalChangesRe
 	localModelsInput := localClientModelsInput.ToModelsInput()
 
 	lastSavedHash, err := os.ReadFile(hashPath)
+
 	if err != nil && !os.IsNotExist(err) {
 		return CustomModelsCheckLocalChangesResult{}, fmt.Errorf("error reading hash file: %v", err)
 	}
@@ -133,7 +134,7 @@ func CustomModelsCheckLocalChanges(path string) (CustomModelsCheckLocalChangesRe
 	}, nil
 }
 
-func WriteCustomModelsFile(path string, modelsInput *shared.ModelsInput, saveHash bool) error {
+func WriteCustomModelsFile(path string, modelsInput *shared.ModelsInput) error {
 	err := os.MkdirAll(filepath.Dir(path), 0755)
 	if err != nil {
 		return fmt.Errorf("error creating directory: %v", err)
@@ -152,11 +153,9 @@ func WriteCustomModelsFile(path string, modelsInput *shared.ModelsInput, saveHas
 		return fmt.Errorf("error writing file: %v", err)
 	}
 
-	if saveHash {
-		err = SaveCustomModelsHash(path, modelsInput)
-		if err != nil {
-			return fmt.Errorf("error saving hash file: %v", err)
-		}
+	err = SaveCustomModelsHash(path, modelsInput)
+	if err != nil {
+		return fmt.Errorf("error saving hash file: %v", err)
 	}
 
 	return nil
@@ -178,7 +177,7 @@ func SaveCustomModelsHash(basePath string, modelsInput *shared.ModelsInput) erro
 	return nil
 }
 
-func MustSyncCustomModels(path string, serverModelsInput *shared.ModelsInput, saveHash bool) bool {
+func MustSyncCustomModels(path string, serverModelsInput *shared.ModelsInput) bool {
 	term.StartSpinner("")
 
 	jsonData, err := os.ReadFile(path)
@@ -217,12 +216,10 @@ func MustSyncCustomModels(path string, serverModelsInput *shared.ModelsInput, sa
 		return false
 	}
 
-	if saveHash {
-		err := SaveCustomModelsHash(path, &modelsInput)
-		if err != nil {
-			term.OutputErrorAndExit("Error saving hash file: %v", err)
-			return false
-		}
+	err = SaveCustomModelsHash(path, &modelsInput)
+	if err != nil {
+		term.OutputErrorAndExit("Error saving hash file: %v", err)
+		return false
 	}
 
 	inputModelIds := map[string]bool{}
@@ -338,7 +335,7 @@ func SyncCustomModels() error {
 		return fmt.Errorf("error getting server models input: %v", err)
 	}
 
-	MustSyncCustomModels(CustomModelsDefaultPath, serverModelsInput, true)
+	MustSyncCustomModels(CustomModelsDefaultPath, serverModelsInput)
 
 	return nil
 }
```

**File**: `app/cli/lib/model_credentials.go` (modified, +1/-1)
```diff
@@ -417,7 +417,7 @@ func showCredentialErrorMessage(res CredentialCheckResult, opts shared.ModelProv
 
 		// TODO: set correct link
 		fmt.Println(color.New(color.Bold, term.ColorHiCyan).Sprint("\n📖 Per-provider instructions"))
-		fmt.Println("For details on the API key/credentials required for each provider, go to:\n" + color.New(color.Bold).Sprint("https://docs.plandex.ai/guides/..."))
+		fmt.Println("For details on the API key/credentials required for each provider, go to:\n" + color.New(color.Bold).Sprint("https://docs.plandex.ai/models/model-providers"))
 	}
 
 	fmt.Println()
```

---

### Incident Patch 10: `2cf2497c` (2025-06-20)
**Commit Message**: Fix stream close error handling in litellm proxy

**File**: `app/server/litellm_proxy.py` (modified, +4/-1)
```diff
@@ -81,7 +81,10 @@ def stream_generator():
           return
 
         finally:
-          response_stream.close()
+          try:
+            response_stream.close()
+          except AttributeError:
+            pass
 
       print(f"Litellm proxy: Initiating streaming response for model: {payload.get('model', 'unknown')}")
       return StreamingResponse(stream_generator(), media_type="text/event-stream")
```

#### Recent Merged Pull Requests:
- **PR #368** (closed): fix: avoid blank lines from edit references (@crwvrosenblum)
- **PR #365** (closed): fix: distinguish proposed line numbers in build prompts (@crwvrosenblum)
- **PR #364** (closed): fix: preserve file bytes when adding line numbers (@crwvrosenblum)
- **PR #360** (closed): Add Build Remote Agent phone pairing (gbr/1) (@LinespottingPrivate)
- **PR #314** (closed): fix: [FR] add configuration option to change command prefix char (@majiayu000)
- **PR #313** (closed): fix: [FR] write config files into XDG_CONFIG_HOME (@majiayu000)
- **PR #312** (closed): feat: add shell completions for bash, zsh, fish, and powershell (@majiayu000)
- **PR #311** (closed): fix: prepareEditorCommand doesn't accept arguments (@majiayu000)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

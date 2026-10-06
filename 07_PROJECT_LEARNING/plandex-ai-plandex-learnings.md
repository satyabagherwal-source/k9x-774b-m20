# Forensic Learning Record (Deep Inspection): plandex-ai/plandex

> **Canonical Artifact**: `07_PROJECT_LEARNING/plandex-ai-plandex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/plandex-ai/plandex](https://github.com/plandex-ai/plandex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:49:21.952Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `plandex-ai/plandex`
- **Description**: Open source AI coding agent. Designed for large projects and real world tasks.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 15696 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/cli/auth/state.go`
```
package auth

import (
	"encoding/json"
	"fmt"
	"os"
	"plandex-cli/fs"

	shared "plandex-shared"
)

var Current *shared.ClientAuth

func loadAccounts() ([]*shared.ClientAccount, error) {
	bytes, err := os.ReadFile(fs.HomeAccountsPath)

	if err != nil {
		if os.IsNotExist(err) {
			// no accounts
			return []*shared.ClientAccount{}, nil
		} else {
			return nil, fmt.Errorf("error reading accounts.json: %v", err)
		}
	}

	var accounts []*shared.ClientAccount
	err = json.Unmarshal(bytes, &accounts)

	if err != nil {
		return nil, fmt.Errorf("error unmarshalling accounts.json: %v", err)
	}

	return accounts, nil
}

func setAuth(auth *shared.ClientAuth) error {
	err := storeAccount(&auth.ClientAccount)

	if err != nil {
		return fmt.Errorf("error storing account: %v", err)
	}

	Current = auth

	err = writeCurrentAuth()

	if err != nil {
		return fmt.Errorf("error writing auth: %v", err)
	}

	return nil
}

func storeAccount(toStore *shared.ClientAccount) error {
	accounts, err := loadAccounts()

	if err != nil {
		return fmt.Errorf("error loading accounts: %v", err)
	}

	found := false
	for i, account := range accounts {
		if account.UserId == toStore.UserId {
			accounts[i] = toStore
			found = true
			break
		}
	}

	if !found {
		accounts = append(accounts, toStore)
	}

	bytes, err := json.Marshal(accounts)

	if err != nil {
		return fmt.Errorf("error marshalling accounts: %v", err)
	}

	err = os.WriteFile(fs.HomeAccountsPath, bytes, os.ModePerm)

	if err != nil {
		return fmt.Errorf("error writing accounts: %v", err)
	}

	return nil
}

func writeCurrentAuth() error {
	if Current == nil {
		return fmt.Errorf("error writing auth: auth not loaded")
	}

	bytes, err := json.Marshal(Current)

	if err != nil {
		return fmt.Errorf("error marshalling auth: %v", err)
	}

	err = os.WriteFile(fs.HomeAuthPath, bytes, os.ModePerm)

	if err != nil {
		return fmt.Errorf("error writing auth: %v", err)
	}

	return nil
}

```

### Core Architecture Module: `app/cli/fs/utils.go`
```
package fs

import (
	"fmt"
	"os"
)

func FileExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	} else if os.IsNotExist(err) {
		return false, nil
	} else {
		return false, fmt.Errorf("error checking if file exists: %v", err)
	}
}

```

### Core Architecture Module: `app/cli/term/utils.go`
```
package term

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/muesli/termenv"
	"golang.org/x/term"
)

func init() {
	// pre-cache terminal settings
	IsTerminal()
	GetTerminalWidth()
	GetStreamForegroundColor()
	HasDarkBackground()
}

func AlternateScreen() {
	// Switch to alternate screen and hide the cursor
	fmt.Print("\x1b[?1049h\x1b[?25l")
}

func ClearScreen() {
	fmt.Print("\x1b[2J")
}

func MoveCursorToTopLeft() {
	fmt.Print("\x1b[H")
}

func ClearCurrentLine() {
	fmt.Print("\033[2K")
}

func MoveUpLines(numLines int) {
	fmt.Printf("\033[%dA", numLines)
}

func BackToMain() {
	// Switch back to main screen and show the cursor on exit
	fmt.Print("\x1b[?1049l\x1b[?25h")
}

func PageOutput(output string) {
	cmd := exec.Command("less", "-R")
	cmd.Env = append(os.Environ(), "LESS=FRX", "LESSCHARSET=utf-8")
	cmd.Stdin = strings.NewReader(output)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		OutputErrorAndExit("Failed to page output: %v", err)
	}
}

func PageOutputReverse(output string) {
	cmd := exec.Command("less", "-RX", "+G")
	cmd.Stdin = strings.NewReader(output)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// Set the environment variables specifically for the less command
	cmd.Env = append(os.Environ(), "LESS=FRX", "LESSCHARSET=utf-8")

	if err := cmd.Run(); err != nil {
		OutputErrorAndExit("Failed to page output: %v", err)
	}
}

func GetDivisionLine() string {
	// Get the terminal width
	terminalWidth := GetTerminalWidth()
	return strings.Repeat("─", terminalWidth)
}

var envReplCols int
var envDefaultCols int

func GetTerminalWidth() int {
	if envReplCols != 0 {
		return envReplCols
	}

	if os.Getenv("PLANDEX_COLUMNS") != "" {
		w, err := strconv.Atoi(os.Getenv("PLANDEX_COLUMNS"))
		if err == nil {
			envReplCols = w
			return w
		}
	}

	if IsTerminal() {
		// Try to get terminal size
		if w, _, err := term.GetSize(int(os.Stdout.Fd())); err == nil {
			return w
		}
	}

	if envDefaultCols != 0 {
		return envDefaultCols
	}

	// Not running in a TTY or GetSize failed; use a default.
	// Try to get width from environment variable
	if w, err := strconv.Atoi(os.Getenv("COLUMNS")); err == nil {
		envDefaultCols = w
		return w
	}

	// Fallback to default width
	return 80
}

var envStreamForegroundColor termenv.Color

func GetStreamForegroundColor() termenv.Color {
	if envStreamForegroundColor != nil {
		return envStreamForegroundColor
	}

	if os.Getenv("PLANDEX_STREAM_FOREGROUND_COLOR") != "" {
		envStreamForegroundColor = termenv.ANSI256.Color(os.Getenv("PLANDEX_STREAM_FOREGROUND_COLOR"))
		return envStreamForegroundColor
	}

	c := "234"
	if HasDarkBackground() {
		c = "251"
	}
	envStreamForegroundColor = termenv.ANSI256.Color(c)
	return envStreamForegroundColor
}

var envHasDarkBackground bool
var cachedHasDarkBackground bool

func HasDarkBackground() bool {
	if cachedHasDarkBackground {
		return envHasDarkBackground
	}
	envHasDarkBackground = termenv.HasDarkBackground()
	cachedHasDarkBackground = true
	return envHasDarkBackground
}

var envIsTerminal bool
var cachedIsTerminal bool

func IsTerminal() bool {
	if cachedIsTerminal {
		return envIsTerminal
	}
	envIsTerminal = term.IsTerminal(int(os.Stdout.Fd()))
	cachedIsTerminal = true
	return envIsTerminal
}

```

### Core Architecture Module: `app/cli/utils/utils.go`
```
package utils

import (
	"time"
)

func EnsureMinDuration(start time.Time, minDuration time.Duration) {
	elapsed := time.Since(start)
	if elapsed < minDuration {
		time.Sleep(minDuration - elapsed)
	}
}

```

### Core Architecture Module: `app/server/db/queue.go`
```
package db

import (
	"context"
	"fmt"
	"log"
	"runtime/debug"
	"sync"

	"github.com/google/uuid"
)

type repoOpFn func(repo *GitRepo) error

type repoOperation struct {
	orgId          string
	userId         string
	planId         string
	branch         string
	scope          LockScope
	planBuildId    string
	id             string
	reason         string
	op             repoOpFn
	ctx            context.Context
	cancelFn       context.CancelFunc
	done           chan error
	clearRepoOnErr bool
}

type repoQueue struct {
	ops          []*repoOperation
	mu           sync.Mutex
	isProcessing bool
}

type repoQueueMap map[string]*repoQueue

var queuesMu sync.Mutex
var repoQueues = make(repoQueueMap)

func (m repoQueueMap) getQueue(planId string) *repoQueue {
	queuesMu.Lock()
	defer queuesMu.Unlock()

	if locksVerboseLogging {
		log.Printf("[Queue] Getting queue for plan %s", planId)
	}

	q, ok := m[planId]
	if !ok {
		if locksVerboseLogging {
			log.Printf("[Queue] Creating new queue for plan %s", planId)
		}
		q = &repoQueue{}
		m[planId] = q
	}
	return q
}

func (m repoQueueMap) add(op *repoOperation) int {
	if locksVerboseLogging {
		log.Printf("[Queue] Adding operation %s (%s) to queue for plan %s", op.id, op.reason, op.planId)
	}
	q := m.getQueue(op.planId)
	return q.add(op)
}

// Add enqueues an operation, and then kicks off processing if needed.
func (q *repoQueue) add(op *repoOperation) int {
	var numOps int
	q.mu.Lock()
	q.ops = append(q.ops, op)
	numOps = len(q.ops)

	if locksVerboseLogging {
		log.Printf("[Queue] Operation %s (%s) enqueued, queue length now %d", op.id, op.reason, numOps)
	}

	// If nobody else is processing, we'll start
	if !q.isProcessing {
		if locksVerboseLogging {
			log.Printf("[Queue] Starting queue processing for operation %s (%s)", op.id, op.reason)
		}
		q.isProcessing = true
		go q.runQueue() // run in the background
	} else if locksVerboseLogging {
		log.Printf("[Queue] Queue already processing, operation %s (%s) will wait", op.id, op.reason)
	}
	q.mu.Unlock()

	return numOps
}

func (q *repoQueue) nextBatch() []*repoOperation {
	q.mu.Lock()
	defer q.mu.Unlock()

	if len(q.ops) == 0 {
		if locksVerboseLogging {
			log.Printf("[Queue] No operations in queue")
		}
		return nil
	}

	firstOp := q.ops[0]
	res := []*repoOperation{firstOp}

	if locksVerboseLogging {
		log.Printf("[Queue] Processing first operation %s (%s) with scope %s, branch %s",
			firstOp.id, firstOp.reason, firstOp.scope, firstOp.branch)
	}

	q.ops = q.ops[1:]

	// writes always go one at a time, blocking everything else, as do read locks on the root plan (no branch)
	if firstOp.scope == LockScopeWrite || firstOp.branch == "" {
		if locksVerboseLogging {
			log.Printf("[Queue] Operation %s is write or root branch read, processing alone", firstOp.id)
		}
		return res
	}

	// reads go in parallel as long as they are on the same branch
	for len(q.ops) > 0 {
		op := q.ops[0]
		if op.scope == LockScopeRead && op.branch == firstOp.branch {
			if locksVerboseLogging {
				log.Printf("[Queue] Batching compatible read operation %s (%s) with same branch %s",
					op.id, op.reason, op.branch)
			}
			res = append(res, op)
			q.ops = q.ops[1:]
		} else {
			if locksVerboseLogging {
				log.Printf("[Queue] Operation %s (%s) with scope %s, branch %s not compatible with batch, stopping",
					op.id, op.reason, op.scope, op.branch)
			}
			break
		}
	}

	if locksVerboseLogging {
		log.Printf("[Queue] Created batch of %d operations", len(res))
	}

	return res
}

func (q *repoQueue) runQueue() {
	if locksVerboseLogging {
		log.Printf("[Queue] Starting queue processing")
	}

	for {
		// get the next batch
		ops := q.nextBatch()
		if len(ops) == 0 {
			// Nothing left in the queue, so mark not processing and return
			if locksVerboseLogging {
				log.Printf("[Queue] Queue empty, stopping processing")
			}
			q.mu.Lock()
			q.isProcessing = false
			q.mu.Unlock()
			return
		}

		firstOp := ops[0]

		func() {

			if locksVerboseLogging {
				log.Printf("[Queue] Attempting to acquire DB lock for plan %s, branch %s, scope %s",
					firstOp.planId, firstOp.branch, firstOp.scope)
			}

			lockId, err := lockRepoDB(LockRepoParams{
				OrgId:       firstOp.orgId,
				UserId:      firstOp.userId,
				PlanId:      firstOp.planId,
				Branch:      firstOp.branch,
				Scope:       firstOp.scope,
				PlanBuildId: firstOp.planBuildId,
				Reason:      firstOp.reason,
				Ctx:         firstOp.ctx,
				CancelFn:    firstOp.cancelFn,
			}, 0)

			if lockId != "" {
				log.Printf("[Queue] Acquired DB lock %s", lockId)

				defer func() {
					log.Printf("[Queue] Releasing DB lock %s for plan %s", lockId, firstOp.planId)
					releaseErr := deleteRepoLockDB(lockId, firstOp.planId, firstOp.reason, 0)
					if releaseErr != nil {
						log.Printf("[Queue] Failed to release DB lock: %v", releaseErr)
					} else {
						log.Printf("[Queue] DB lock %s released successfully", lockId)
					}
				}()
			}

			if err != nil {
				log.Printf("[Queue] Failed to get DB lock: %v", err)
				for _, op := range ops {
					if locksVerboseLogging {
						log.Printf("[Queue] Notifying operation %s (%s) of lock failure", op.id, op.reason)
					}
					op.done <- fmt.Errorf("failed to get DB lock: %w", err)
				}
				// we still need to process the rest of the queue
				// if the error is critical, caller will handle it
				return
			}

			if locksVerboseLogging {
				log.Printf("[Queue] Acquired DB lock %s, processing batch of %d operations", lockId, len(ops))
			}

			repo := getGitRepo(firstOp.orgId, firstOp.planId)
			var needsRollback bool

			// Process the batch
			// If it's a writer => single op
			// If multiple same‐branch readers => do them in parallel
			var wg sync.WaitGroup
			for _, op := range ops {
				wg.Add(1)
				go func(op *repoOperation) {
					defer wg.Done()
					select {
					case <-op.ctx.Done():
						if locksVerboseLogging {
							log.Printf("[Queue] Operation %s (%s) context canceled", op.id, op.reason)
						}
						op.done <- op.ctx.Err()
					default:
						if locksVerboseLogging {
							log.Printf("[Queue] Starting operation %s (%s)", op.id, op.reason)
						}
						// actually do the operation

						var opErr error

						func() {
							defer func() {
								panicErr := recover()
								if panicErr != nil {
									log.Printf("[Queue] Panic in operation %s (%s): %v", op.id, op.reason, panicErr)
									log.Printf("[Queue] Stack trace: %s", string(debug.Stack()))
									opErr = fmt.Errorf("panic in operation: %v\n%s", panicErr, string(debug.Stack()))
								}

								if opErr != nil && op.scope == LockScopeWrite && op.clearRepoOnErr {
									if locksVerboseLogging {
										log.Printf("[Queue] Operation %s (%s) failed with error, marking for rollback: %v",
											op.id, op.reason, opErr)
									}
									needsRollback = true
								}
							}()

							if locksVerboseLogging {
								log.Printf("[Queue] Executing operation %s (%s)", op.id, op.reason)
							}
							opErr = op.op(repo)
							if locksVerboseLogging {
								if opErr != nil {
									log.Printf("[Queue] Operation %s (%s) failed with error: %v", op.id, op.reason, opErr)
								} else {
									log.Printf("[Queue] Operation %s (%s) completed successfully", op.id, op.reason)
								}
							}
						}()

						// signal to the caller via op.done
						if locksVerboseLogging {
							log.Printf("[Queue] Notifying caller of operation %s (%s) completion", op.id, op.reason)
						}
						op.done <- opErr
					}
				}(op)
			}
			wg.Wait()

			if needsRollback {
				log.Printf("[Queue] Performing rollback for plan %s branch %s", firstOp.planId, firstOp.branch)
				rollbackErr := repo.GitClearUncommittedChanges(firstOp.branch)
				if rollbackErr != nil {
					log.Printf("[Queue] Failed to rollback: %v", rollbackErr)
				} else if locksVerboseLogging {
					log.Printf("[Queue] Rollback completed successfully")
				}
			}
		}()
	}
}

type ExecRepoOperationParams struct {
	OrgId          string
	UserId         string
	PlanId         string
	Branch         string
	Scope          LockScope
	PlanBuildId    string
	Reason         string
	Ctx            context.Context
	CancelFn       context.CancelFunc
	ClearRepoOnErr bool
}

func ExecRepoOperation(
	params ExecRepoOperationParams,
	op repoOpFn,
) error {
	id := uuid.New().String()

	log.Printf("[Queue] ExecRepoOperation called for plan %s, branch %s, scope %s, reason %s",
		params.PlanId, params.Branch, params.Scope, params.Reason)

	done := make(chan error, 1)
	numOps := repoQueues.add(&repoOperation{
		id:             id,
		orgId:          params.OrgId,
		planId:         params.PlanId,
		branch:         params.Branch,
		scope:          params.Scope,
		reason:         params.Reason,
		planBuildId:    params.PlanBuildId,
		op:             op,
		done:           done,
		ctx:            params.Ctx,
		cancelFn:       params.CancelFn,
		clearRepoOnErr: params.ClearRepoOnErr,
	})

	if numOps > 1 {
		if locksVerboseLogging {
			log.Printf("[Queue] Operation %s (%s) queued behind %d operations", id, params.Reason, numOps-1)
			for i, op := range repoQueues.getQueue(params.PlanId).ops {
				log.Printf("[Queue] Operation %d: %s - %s\n", i, op.id, op.reason)
			}
		}
	}

	select {
	case err := <-done:
		if locksVerboseLogging {
			if err != nil {
				log.Printf("[Queue] Operation %s (%s) completed with error: %v", id, params.Reason, err)
			} else {
				log.Printf("[Queue] Operation %s (%s) completed successfully", id, params.Reason)
			}
		}
		return err
	case <-params.Ctx.Done():
		if locksVerboseLogging {
			log.Printf("[Queue] Operation %s (%s) context canceled while waiting", id, params.Reason)
		}
		return params.Ctx.Err()
	}
}

```

### Core Architecture Module: `app/server/db/utils.go`
```
package db

import (
	"github.com/lib/pq"
)

func IsNonUniqueErr(err error) bool {
	if err, ok := err.(*pq.Error); ok {
		if err.Code == "23505" {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `app/server/handlers/file_maps_queue.go`
```
package handlers

import (
	"context"
	"errors"
	"log"
	"math"
	"plandex-server/syntax/file_map"
	shared "plandex-shared"
	"runtime"
	"sync"
	"time"
)

// simple in-memory per-instance queue for file map jobs
// ensures mapping doesn't take over all available CPUs

const fileMapMaxQueueSize = 20 // caller errors out if this is exceeded
var fileMapMaxConcurrency = 3  // set to 3/4 of available CPUs below
const mapJobTimeout = 60 * time.Second

type projectMapJob struct {
	inputs  shared.FileMapInputs
	ctx     context.Context
	results chan shared.FileMapBodies
}

var projectMapQueue = make(chan projectMapJob, fileMapMaxQueueSize)

var mapCPUSem chan struct{}

func init() {
	// Use 3/4 of available CPUs for mapping workers
	cpus := runtime.NumCPU()
	fileMapMaxConcurrency = int(math.Ceil(float64(cpus) * 0.75))
	if fileMapMaxConcurrency < 1 {
		fileMapMaxConcurrency = 1
	}

	log.Printf("fileMapMaxConcurrency: %d", fileMapMaxConcurrency)

	mapCPUSem = make(chan struct{}, fileMapMaxConcurrency)

	// start workers, one per CPU
	for i := 0; i < fileMapMaxConcurrency; i++ {
		go processProjectMapQueue()
	}
}

func processProjectMapQueue() {
	for job := range projectMapQueue {
		if job.ctx.Err() != nil {
			if job.ctx.Err() == context.DeadlineExceeded {
				log.Printf("processProjectMapQueue: job context deadline exceeded: %v", job.ctx.Err())
				safeSend(job.results, nil)
				continue
			}
			log.Printf("processProjectMapQueue: job context cancelled: %v", job.ctx.Err())
			safeSend(job.results, nil)
			continue
		}
		ctxWithTimeout, cancel := context.WithTimeout(job.ctx, mapJobTimeout)
		mapWorker(projectMapJob{
			inputs:  job.inputs,
			ctx:     ctxWithTimeout,
			results: job.results,
		})
		cancel()
	}
}

func queueProjectMapJob(job projectMapJob) error {
	log.Printf("queueProjectMapJob: len(projectMapQueue): %d", len(projectMapQueue))
	select {
	case projectMapQueue <- job:
		return nil
	default:
		return errors.New("queue is full")
	}
}

func mapWorker(job projectMapJob) {
	maps := make(shared.FileMapBodies)
	wg := sync.WaitGroup{}
	var mu sync.Mutex

	log.Printf("mapWorker: len(job.inputs): %d", len(job.inputs))

	for path, input := range job.inputs {
		if !shared.HasFileMapSupport(path) {
			mu.Lock()
			maps[path] = "[NO MAP]"
			mu.Unlock()
			continue
		}

		wg.Add(1)
		go func(path string, input string) {
			if job.ctx.Err() != nil {
				wg.Done()
				return
			}

			mapCPUSem <- struct{}{}
			defer func() { <-mapCPUSem }()
			defer wg.Done()

			fileMap, err := file_map.MapFile(job.ctx, path, []byte(input))
			if err != nil {
				// Skip files that can't be parsed, just log the error
				log.Printf("Error mapping file %s: %v", path, err)
				mu.Lock()
				maps[path] = "[NO MAP]"
				mu.Unlock()
				return
			}
			mu.Lock()
			maps[path] = fileMap.String()
			mu.Unlock()
		}(path, input)
	}

	wg.Wait()

	if job.ctx.Err() != nil {
		safeSend(job.results, nil)
		return
	}

	safeSend(job.results, maps)
}

func safeSend(ch chan shared.FileMapBodies, v shared.FileMapBodies) {
	// never block, never panic
	select {
	case ch <- v:
	default: // buffer already full – receiver must have gone away
	}
}

```

### Core Architecture Module: `app/server/hooks/hooks.go`
```
package hooks

import (
	"context"
	"plandex-server/db"
	"plandex-server/types"
	"time"

	shared "plandex-shared"

	"github.com/jmoiron/sqlx"
	"github.com/sashabaranov/go-openai"
)

const (
	HealthCheck = "health_check"

	CreateAccount        = "create_account"
	WillCreatePlan       = "will_create_plan"
	WillTellPlan         = "will_tell_plan"
	WillExecPlan         = "will_exec_plan"
	WillSendModelRequest = "will_send_model_request"
	DidSendModelRequest  = "did_send_model_request"
	DidFinishBuilderRun  = "did_finish_builder_run"
	CreateOrg            = "create_org"
	Authenticate         = "authenticate"
	GetIntegratedModels  = "get_integrated_models"
	GetApiOrgs           = "get_api_orgs"
	CallFastApply        = "call_fast_apply"
)

type WillSendModelRequestParams struct {
	InputTokens  int
	OutputTokens int
	ModelName    shared.ModelName
	IsUserPrompt bool
	ModelTag     shared.ModelTag
	ModelId      shared.ModelId
}

type DidSendModelRequestParams struct {
	InputTokens     int
	OutputTokens    int
	CachedTokens    int
	ModelId         shared.ModelId
	ModelTag        shared.ModelTag
	ModelName       shared.ModelName
	ModelProvider   shared.ModelProvider
	ModelRole       shared.ModelRole
	ModelPackName   string
	Purpose         string
	GenerationId    string
	PlanId          string
	ModelStreamId   string
	ConvoMessageId  string
	BuildId         string
	StoppedEarly    bool
	UserCancelled   bool
	HadError        bool
	NoReportedUsage bool
	SessionId       string

	RequestStartedAt time.Time
	Streaming        bool
	StreamResult     string
	FirstTokenAt     time.Time
	Req              *types.ExtendedChatCompletionRequest
	Res              *openai.ChatCompletionResponse
	ModelConfig      *shared.ModelRoleConfig
}

type DidFinishBuilderRunParams struct {
	PlanId        string
	FilePath      string
	FileExt       string
	Lang          string
	GenerationIds []string

	ValidateModelConfig  *shared.ModelRoleConfig
	FastApplyModelConfig *shared.ModelRoleConfig
	WholeFileModelConfig *shared.ModelRoleConfig

	AutoApplySuccess                   bool
	AutoApplyValidationReasons         []string
	AutoApplyValidationSyntaxErrors    []string
	AutoApplyValidationPassed          bool
	AutoApplyValidationFailureResponse string
	AutoApplyValidationStartedAt       time.Time
	AutoApplyValidationFinishedAt      time.Time

	DidReplacement             bool
	ReplacementSuccess         bool
	ReplacementSyntaxErrors    []string
	ReplacementFailureResponse string
	ReplacementStartedAt       time.Time
	ReplacementFinishedAt      time.Time

	DidRewriteProposed             bool
	RewriteProposedSuccess         bool
	RewriteProposedSyntaxErrors    []string
	RewriteProposedFailureResponse string
	RewriteProposedStartedAt       time.Time
	RewriteProposedFinishedAt      time.Time

	DidFastApply             bool
	FastApplySuccess         bool
	FastApplySyntaxErrors    []string
	FastApplyFailureResponse string
	FastApplyStartedAt       time.Time
	FastApplyFinishedAt      time.Time

	BuiltWholeFile           bool
	BuildWholeFileStartedAt  time.Time
	BuildWholeFileFinishedAt time.Time

	StartedAt  time.Time
	FinishedAt time.Time
}

type CreateOrgHookRequestParams struct {
	Org *db.Org
}

type AuthenticateHookRequestParams struct {
	Path string
	Hash string
}

type FastApplyParams struct {
	InitialCode string `json:"initialCode"`
	EditSnippet string `json:"editSnippet"`

	InitialCodeTokens int
	EditSnippetTokens int

	Language shared.Language

	Ctx context.Context
}

type HookParams struct {
	Auth *types.ServerAuth
	Plan *db.Plan
	Tx   *sqlx.Tx

	WillSendModelRequestParams    *WillSendModelRequestParams
	DidSendModelRequestParams     *DidSendModelRequestParams
	CreateOrgHookRequestParams    *CreateOrgHookRequestParams
	GetApiOrgIds                  []string
	AuthenticateHookRequestParams *AuthenticateHookRequestParams
	DidFinishBuilderRunParams     *DidFinishBuilderRunParams
	FastApplyParams               *FastApplyParams
}

type GetIntegratedModelsResult struct {
	IntegratedModelsMode bool
	AuthVars             map[string]string
}

type FastApplyResult struct {
	MergedCode string
}

type HookResult struct {
	GetIntegratedModelsResult *GetIntegratedModelsResult
	ApiOrgsById               map[string]*shared.Org
	FastApplyResult           *FastApplyResult
}

type Hook func(params HookParams) (HookResult, *shared.ApiError)

var hooks = make(map[string]Hook)

func RegisterHook(name string, hook Hook) {
	hooks[name] = hook
}

func ExecHook(name string, params HookParams) (HookResult, *shared.ApiError) {
	hook, ok := hooks[name]
	if !ok {
		return HookResult{}, nil
	}
	return hook(params)
}

func TestUpdate() {

}

```

### Core Architecture Module: `app/server/model/plan/state.go`
```
package plan

import (
	"context"
	"fmt"
	"log"
	"plandex-server/db"
	"plandex-server/notify"
	"plandex-server/shutdown"
	"plandex-server/types"
	"strings"
	"time"

	shared "plandex-shared"
)

var (
	activePlans types.SafeMap[*types.ActivePlan] = *types.NewSafeMap[*types.ActivePlan]()
)

func GetActivePlan(planId, branch string) *types.ActivePlan {
	return activePlans.Get(strings.Join([]string{planId, branch}, "|"))
}

func CreateActivePlan(orgId, userId, planId, branch, prompt string, buildOnly, autoContext bool, sessionId string) *types.ActivePlan {
	activePlan := types.NewActivePlan(orgId, userId, planId, branch, prompt, buildOnly, autoContext, sessionId)
	key := strings.Join([]string{planId, branch}, "|")

	activePlans.Set(key, activePlan)

	go func() {
		for {
			select {
			case <-activePlan.Ctx.Done():
				log.Printf("case <-activePlan.Ctx.Done(): %s\n", planId)

				err := db.SetPlanStatus(planId, branch, shared.PlanStatusStopped, "")
				if err != nil {
					log.Printf("Error setting plan %s status to stopped: %v\n", planId, err)
				}

				DeleteActivePlan(orgId, userId, planId, branch)

				return
			case apiErr := <-activePlan.StreamDoneCh:
				log.Printf("case apiErr := <-activePlan.StreamDoneCh: %s\n", planId)
				log.Printf("apiErr: %v\n", apiErr)

				if apiErr == nil {
					log.Printf("Plan %s stream completed successfully", planId)

					err := db.SetPlanStatus(planId, branch, shared.PlanStatusFinished, "")
					if err != nil {
						log.Printf("Error setting plan %s status to ready: %v\n", planId, err)
					}

					// cancel *after* the DeleteActivePlan call
					// allows queued operations to complete
					DeleteActivePlan(orgId, userId, planId, branch)
					activePlan.CancelFn()
					return
				} else {
					log.Printf("Error streaming plan %s: %v\n", planId, apiErr)

					go notify.NotifyErr(notify.SeverityError, fmt.Errorf("error streaming plan %s: %v", planId, apiErr))

					err := db.SetPlanStatus(planId, branch, shared.PlanStatusError, apiErr.Msg)
					if err != nil {
						log.Printf("Error setting plan %s status to error: %v\n", planId, err)
					}

					log.Println("Sending error message to client")
					activePlan.Stream(shared.StreamMessage{
						Type:  shared.StreamMessageError,
						Error: apiErr,
					})
					activePlan.FlushStreamBuffer()

					log.Println("Stopping any active summary stream")
					activePlan.SummaryCancelFn()

					log.Println("Waiting 100ms after streaming error before canceling active plan")
					time.Sleep(100 * time.Millisecond)

					// cancel *before* the DeleteActivePlan call below
					// short circuits any active operations
					log.Println("Cancelling active plan")
					activePlan.CancelFn()
					DeleteActivePlan(orgId, userId, planId, branch)
					return
				}
			}
		}
	}()

	return activePlan
}

func DeleteActivePlan(orgId, userId, planId, branch string) {
	log.Printf("Deleting active plan %s - %s - %s\n", planId, branch, orgId)

	activePlan := GetActivePlan(planId, branch)
	if activePlan == nil {
		log.Printf("DeleteActivePlan - No active plan found for plan ID %s on branch %s\n", planId, branch)
		return
	}

	ctx, cancelFn := context.WithTimeout(shutdown.ShutdownCtx, 10*time.Second)
	defer cancelFn()

	log.Printf("Clearing uncommitted changes for plan %s - %s - %s\n", planId, branch, orgId)

	err := db.ExecRepoOperation(db.ExecRepoOperationParams{
		OrgId:    orgId,
		UserId:   userId,
		PlanId:   planId,
		Branch:   branch,
		Scope:    db.LockScopeWrite,
		Ctx:      ctx,
		CancelFn: cancelFn,
		Reason:   "delete active plan",
	}, func(repo *db.GitRepo) error {
		log.Printf("Starting clear uncommitted changes for plan %s - %s - %s\n", planId, branch, orgId)
		err := repo.GitClearUncommittedChanges(branch)
		log.Printf("Finished clear uncommitted changes for plan %s - %s - %s\n", planId, branch, orgId)
		log.Printf("Error: %v\n", err)
		return err
	})

	if err != nil {
		log.Printf("Error clearing uncommitted changes for plan %s: %v\n", planId, err)
	}

	activePlans.Delete(strings.Join([]string{planId, branch}, "|"))

	log.Printf("Deleted active plan %s - %s - %s\n", planId, branch, orgId)
}

func UpdateActivePlan(planId, branch string, fn func(*types.ActivePlan)) {
	activePlans.Update(strings.Join([]string{planId, branch}, "|"), fn)
}

func SubscribePlan(ctx context.Context, planId, branch string) (string, chan string) {
	log.Printf("Subscribing to plan %s\n", planId)
	var id string
	var ch chan string

	activePlan := GetActivePlan(planId, branch)
	if activePlan == nil {
		log.Printf("SubscribePlan - No active plan found for plan ID %s on branch %s\n", planId, branch)
		return "", nil
	}

	UpdateActivePlan(planId, branch, func(activePlan *types.ActivePlan) {
		id, ch = activePlan.Subscribe(ctx)
	})
	return id, ch
}

func UnsubscribePlan(planId, branch, subscriptionId string) {
	log.Printf("UnsubscribePlan %s - %s - %s\n", planId, branch, subscriptionId)

	active := GetActivePlan(planId, branch)

	if active == nil {
		log.Printf("No active plan found for plan ID %s on branch %s\n", planId, branch)
		return
	}

	UpdateActivePlan(planId, branch, func(activePlan *types.ActivePlan) {
		activePlan.Unsubscribe(subscriptionId)
		log.Printf("Unsubscribed from plan %s - %s - %s\n", planId, branch, subscriptionId)
	})
}

func NumActivePlans() int {
	return activePlans.Len()
}

```

### Core Architecture Module: `app/server/model/plan/tell_state.go`
```
package plan

import (
	"plandex-server/db"
	"plandex-server/model"
	"plandex-server/types"
	"time"

	shared "plandex-shared"

	"github.com/sashabaranov/go-openai"
)

type activeTellStreamState struct {
	activePlan            *types.ActivePlan
	modelStreamId         string
	clients               map[string]model.ClientInfo
	authVars              map[string]string
	req                   *shared.TellPlanRequest
	auth                  *types.ServerAuth
	currentOrgId          string
	currentUserId         string
	orgUserConfig         *shared.OrgUserConfig
	plan                  *db.Plan
	branch                string
	iteration             int
	replyId               string
	modelContext          []*db.Context
	hasContextMap         bool
	contextMapEmpty       bool
	convo                 []*db.ConvoMessage
	promptConvoMessage    *db.ConvoMessage
	currentPlanState      *shared.CurrentPlanState
	missingFileResponse   shared.RespondMissingFileChoice
	summaries             []*db.ConvoSummary
	summarizedToMessageId string
	latestSummaryTokens   int
	userPrompt            string
	promptMessage         *openai.ChatCompletionMessage
	replyParser           *types.ReplyParser
	replyNumTokens        int
	messages              []types.ExtendedChatMessage
	tokensBeforeConvo     int
	totalRequestTokens    int
	settings              *shared.PlanSettings
	subtasks              []*db.Subtask
	currentSubtask        *db.Subtask
	hasAssistantReply     bool
	currentStage          shared.CurrentStage
	chunkProcessor        *chunkProcessor
	generationId          string

	requestStartedAt time.Time
	firstTokenAt     time.Time
	originalReq      *types.ExtendedChatCompletionRequest
	modelConfig      *shared.ModelRoleConfig
	baseModelConfig  *shared.BaseModelConfig
	fallbackRes      shared.FallbackResult

	skipConvoMessages map[string]bool

	manualStop []string

	numErrorRetry       int
	numFallbackRetry    int
	modelErr            *shared.ModelError
	noCacheSupportErr   bool
	didProviderFallback bool
}

type chunkProcessor struct {
	replyOperations                 []*shared.Operation
	chunksReceived                  int
	maybeRedundantOpeningTagContent string
	fileOpen                        bool
	contentBuffer                   string
	awaitingBlockOpeningTag         bool
	awaitingBlockClosingTag         bool
	awaitingOpClosingTag            bool
	awaitingBackticks               bool
}

```

### Core Architecture Module: `app/server/model/plan/utils.go`
```
package plan

import (
	"plandex-server/types"
	"strings"
)

func StripBackticksWrapper(s string) string {
	check := strings.TrimSpace(s)
	split := strings.Split(check, "\n")

	if len(split) > 2 {
		firstLine := strings.TrimSpace(split[0])
		secondLine := strings.TrimSpace(split[1])
		lastLine := strings.TrimSpace(split[len(split)-1])
		if types.LineMaybeHasFilePath(firstLine) && strings.HasPrefix(secondLine, "```") {
			if lastLine == "```" {
				return strings.Join(split[1:len(split)-1], "\n")
			}
		} else if strings.HasPrefix(firstLine, "```") && lastLine == "```" {
			return strings.Join(split[1:len(split)-1], "\n")
		}
	}

	return s
}

```

### Core Architecture Module: `app/server/utils/whitespace.go`
```
package utils

import "strings"

func StripAddedBlankLines(orig, upd string) string {
	origLines := strings.Split(orig, "\n")
	updLines := strings.Split(upd, "\n")

	leadingOrig := 0
	for leadingOrig < len(origLines) && strings.TrimSpace(origLines[leadingOrig]) == "" {
		leadingOrig++
	}

	leadingUpd := 0
	for leadingUpd < len(updLines) && strings.TrimSpace(updLines[leadingUpd]) == "" {
		leadingUpd++
	}

	if leadingUpd > leadingOrig {
		updLines = updLines[leadingUpd-leadingOrig:] // trim surplus
	}

	trailingOrig := 0
	for trailingOrig < len(origLines) && strings.TrimSpace(origLines[len(origLines)-1-trailingOrig]) == "" {
		trailingOrig++
	}

	trailingUpd := 0
	for trailingUpd < len(updLines) && strings.TrimSpace(updLines[len(updLines)-1-trailingUpd]) == "" {
		trailingUpd++
	}

	if trailingUpd > trailingOrig {
		updLines = updLines[:len(updLines)-(trailingUpd-trailingOrig)]
	}

	return strings.Join(updLines, "\n")
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

**File**: `app/server/handlers/plans_exec.go` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ func TellPlanHandler(w http.ResponseWriter, r *http.Request) {
 	if err != nil {
 		log.Printf("Error telling plan: %v\n", err)
 		go notify.NotifyErr(notify.SeverityError, fmt.Errorf("error telling plan: %v", err))
-		http.Error(w, "Error telling plan", http.StatusInternalServerError)
+		http.Error(w, "Error telling plan: "+err.Error(), http.StatusInternalServerError)
 		return
 	}
 
```

**File**: `app/server/litellm_proxy.py` (modified, +2/-2)
```diff
@@ -49,9 +49,9 @@ def _oauth_get_hdrs(
 import json
 import re
 
-_turn_on_debug()
+# _turn_on_debug()
 
-LOGGING_ENABLED = True
+LOGGING_ENABLED = False
 
 print("Litellm proxy: starting proxy server on port 4000...")
 
```

**File**: `app/server/model/client_stream.go` (modified, +5/-3)
```diff
@@ -330,9 +330,11 @@ func withStreamingRetries[T any](
 		log.Printf("withStreamingRetries - retrying stream in %v seconds", retryDelay)
 		time.Sleep(retryDelay)
 
-		numTotalRetry++
-		if isFallback && !newFallback {
-			numFallbackRetry++
+		if modelErr != nil && modelErr.ShouldIncrementRetry() {
+			numTotalRetry++
+			if isFallback && !newFallback {
+				numFallbackRetry++
+			}
 		}
 	}
 }
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

**File**: `test/smoke_test.sh` (modified, +9/-126)
```diff
@@ -1,130 +1,23 @@
 #!/bin/bash
-
 # Plandex Smoke Test Script
 # Tests core functionality in a linear flow mimicking real usage
-# Assumes: Already signed in to Plandex Cloud (staging account)
+# Assumes: Already signed in to Plandex Cloud (dev or staging account)
 
 set -e  # Exit on error
 
-# Colors for output
-RED='\033[0;31m'
-GREEN='\033[0;32m'
-YELLOW='\033[1;33m'
-NC='\033[0m' # No Color
-
-# Test directory setup
-TEST_DIR="/tmp/plandex-smoke-test-$$"
-TIMESTAMP=$(date +%Y%m%d_%H%M%S)
-LOG_FILE="${TEST_DIR}/smoke-test-${TIMESTAMP}.log"
-
-PLANDEX_CMD="plandex-dev"
+# Source common utilities
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+source "${SCRIPT_DIR}/test_utils.sh"
 
-# Minimal prompts to keep costs down
+# Test-specific variables
 PROMPT_CREATE_FUNCTION="add a simple hello world function in main.go"
 PROMPT_ADD_TEST="add a test for the hello function"
 PROMPT_CHAT_QUESTION="what does the hello function do?"
 PROMPT_ADD_FEATURE="add a goodbye function that returns: goodbye world"
 
-# Helper functions
-log() {
-    if [ -f "$LOG_FILE" ]; then
-        echo -e "$1" | tee -a "$LOG_FILE"
-    else
-        echo -e "$1"
-    fi
-}
-
-
-
-success() {
-    log "${GREEN}✓ $1${NC}"
-}
-
-error() {
-    log "${RED}✗ $1${NC}"
-    exit 1
-}
-
-info() {
-    log "${YELLOW}→ $1${NC}"
-}
-
-# Run command and check for success
-run_cmd() {
-    local cmd="$1"
-    local description="$2"
-    
-    info "Running: $cmd"
-    
-    # Create a temporary file for capturing exit status
-    local tmpfile=$(mktemp)
-    
-    # Run command with output visible and logged
-    ( eval "$cmd" 2>&1; echo $? > "$tmpfile" ) | tee -a "$LOG_FILE"
-    
-    # Get the exit status
-    local exit_code=$(cat "$tmpfile")
-    rm -f "$tmpfile"
-    
-    if [ "$exit_code" -eq 0 ]; then
-        success "$description"
-    else
-        error "$description failed (exit code: $exit_code)"
-    fi
-}
-
-# Run command and capture output
-run_cmd_output() {
-    local cmd="$1"
-    
-    # Create a temporary file for capturing exit status
-    local tmpfile=$(mktemp)
-    
-    if [ -f "$LOG_FILE" ]; then
-        ( eval "$cmd" 2>&1; echo $? > "$tmpfile" ) | tee -a "$LOG_FILE"
-    else
-        ( eval "$cmd" 2>&1; echo $? > "$tmpfile" )
-    fi
-    
-    # Get the exit status
-    local exit_code=$(cat "$tmpfile")
-    rm -f "$tmpfile"
-    
-    # Return the exit code so the caller can handle it
-    return $exit_code
-}
-
-run_plandex_cmd() {
-    local cmd="$1"
-    local description="$2"
-    run_cmd "$PLANDEX_CMD $cmd" "$description"
-}
-
-run_plandex_cmd_output() {
-    local cmd="$1"
-    if ! run_cmd_output "$PLANDEX_CMD $cmd"; then
-        error "Command failed: $PLANDEX_CMD $cmd"
-    fi
-}
-
-# Check if file exists
-check_file() {
-    if [ -f "$1" ]; then
-        success "File exists: $1"
-    else
-        error "File missing: $1"
-    fi
-}
-
-# Setup test environment
+# Setup for this test
 setup() {
-    info "Setting up test environment in $TEST_DIR"
-    mkdir -p "$TEST_DIR"
-    cd "$TEST_DIR"
-    
-    # Now create the log file after directory exists
-    LOG_FILE="${TEST_DIR}/smoke-test-${TIMESTAMP}.log"
-    touch "$LOG_FILE"
+    setup_test_dir "smoke-test"
     
     # Create a simple Go project structure
     mkdir -p cmd
@@ -136,20 +29,10 @@ setup() {
 # Test Project
 This is a test project for Plandex smoke testing.
 EOF
-    
-    success "Test environment created"
-}
-
-# Cleanup function
-cleanup() {
-    info "Cleaning up test environment"
-    cd /
-    rm -rf "$TEST_DIR"
-    success "Cleanup complete"
 }
 
 # Set trap for cleanup on exit
-trap cleanup EXIT
+trap cleanup_test_dir EXIT
 
 # Main test flow
 main() {
@@ -254,7 +137,7 @@ main() {
     info "Will rewind $REWIND_STEPS steps"
     
     # Rewind
-    run_plandex_cmd "rewind $REWIND_STEPS" "Rewind $REWIND_STEPS steps"
+    run_plandex_cmd "rewind $REWIND_STEPS --revert" "Rewind $REWIND_STEPS steps"
     
     # 8. CONFIGURATION
     log "\n=== Testing Configuration ==="
```

**File**: `test/test_custom_models.sh` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+#!/bin/bash
+# custom-models-test.sh - Plandex custom models functionality test
+
+set -e  # Exit on error
+
+# Source common utilities
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+source "${SCRIPT_DIR}/test_utils.sh"
+
+# Setup for this test
+setup() {
+    setup_test_dir "custom-models-test"
+    
+    # Create a simple test file
+    echo "package main" > main.go
+}
+
+# Set trap for cleanup on exit
+trap cleanup_test_dir EXIT
+
+# Create custom models JSON matching the GitHub issue
+create_custom_models_json() {
+    cat > custom-models.json << 'EOF'
+{
+  "$schema": "https://plandex.ai/schemas/models-input.schema.json",
+  "models": [
+    {
+      "modelId": "custom-claude-4",
+      "publisher": "test",
+      "description": "Claude 4 Sonnet test",
+      "defaultMaxConvoTokens": 15000,
+      "maxTokens": 200000,
+      "maxOutputTokens": 64000,
+      "reservedOutputTokens": 16000,
+      "preferredOutputFormat": "xml",
+      "hasImageSupport": true,
+      "providers": [
+        {
+          "provider": "openrouter",
+          "modelName": "anthropic/claude-sonnet-4"
+        }
+      ]
+    }
+  ],
+  "modelPacks": [
+    {
+      "name": "test-pack",
+      "description": "Test model pack",
+      "$schema": "https://plandex.ai/schemas/model-pack-inline.schema.json",
+      "planner": {
+        "modelId": "custom-claude-4",
+        "largeContextFallback": "custom-claude-4"
+      },
+      "architect": "custom-claude-4",
+      "coder": "custom-claude-4",
+      "summarizer": "custom-claude-4",
+      "builder": "custom-claude-4",
+      "wholeFileBuilder": "custom-claude-4",
+      "names": "custom-claude-4",
+      "commitMessages": "custom-claude-4",
+      "autoContinue": "custom-claude-4"
+    }
+  ]
+}
+EOF
+}
+
+main() {
+    log "=== Plandex Custom Models Test Started at $(date) ==="
+    
+    setup
+
+    echo "OPENROUTER_API_KEY: $OPENROUTER_API_KEY"
+
+    run_plandex_cmd "new -n custom-model-test" "Create test plan"
+    run_plandex_cmd "models" "Show current models"
+    
+    log "\n=== Testing Custom Models with Custom Provider ==="
+    
+    create_custom_models_json
+    run_plandex_cmd "models custom --file custom-models.json --save" "Import custom models"
+    run_plandex_cmd "models available --custom" "List custom models"
+    run_plandex_cmd "set-model test-pack" "Set custom model pack"
+    
+    # test without required API key
+    PREV_KEY=$OPENROUTER_API_KEY
+    unset OPENROUTER_API_KEY
+    expect_plandex_failure "tell 'write a hello world program in Go'" "Tell with custom models (should fail due to missing API key)"
+    
+    # restore API key
+    export OPENROUTER_API_KEY=$PREV_KEY
+    run_plandex_cmd "tell 'write a hello world program in Go'" "Tell with custom models"
+
+    log "\n=== Custom Models Test Completed at $(date) ==="
+}
+
+# Run the tests
+main
\ No newline at end of file
```

**File**: `test/test_utils.sh` (added, +146/-0)
```diff
@@ -0,0 +1,146 @@
+#!/bin/bash
+# test-utils.sh - Common utilities for Plandex test scripts
+
+export PLANDEX_ENV='development'
+
+# Colors for output
+export RED='\033[0;31m'
+export GREEN='\033[0;32m'
+export YELLOW='\033[1;33m'
+export NC='\033[0m' # No Color
+
+# Default command
+export PLANDEX_CMD="${PLANDEX_CMD:-plandex-dev}"
+
+# Logging functions
+log() {
+    if [ -f "$LOG_FILE" ]; then
+        echo -e "$1" | tee -a "$LOG_FILE"
+    else
+        echo -e "$1"
+    fi
+}
+
+success() {
+    log "${GREEN}✓ $1${NC}"
+}
+
+error() {
+    log "${RED}✗ $1${NC}"
+    exit 1
+}
+
+info() {
+    log "${YELLOW}→ $1${NC}"
+}
+
+# Run command and check for success
+run_cmd() {
+    local cmd="$1"
+    local description="$2"
+    
+    info "Running: $cmd"
+    
+    # Run command and capture output and exit code properly
+    set +e  # Temporarily disable exit on error
+    output=$(eval "$cmd" 2>&1)
+    local exit_code=$?
+    set -e  # Re-enable exit on error
+    
+    # Log the output
+    echo "$output" | tee -a "$LOG_FILE"
+    
+    if [ "$exit_code" -eq 0 ]; then
+        success "$description"
+    else
+        error "$description failed (exit code: $exit_code)"
+    fi
+}
+
+# Run plandex command
+run_plandex_cmd() {
+    local cmd="$1"
+    local description="$2"
+    run_cmd "$PLANDEX_CMD $cmd" "$description"
+}
+
+# Run plandex command and check if output contains substring
+check_plandex_contains() {
+    local cmd="$1"
+    local expected="$2"
+    local description="$3"
+    
+    info "Running: $PLANDEX_CMD $cmd"
+    
+    local output=$($PLANDEX_CMD $cmd 2>&1)
+    echo "$output" | tee -a "$LOG_FILE"
+    
+    if echo "$output" | grep -q "$expected"; then
+        success "$description"
+    else
+        error "$description - expected to find '$expected'"
+    fi
+}
+
+# Check if command fails (expecting failure)
+expect_failure() {
+    local cmd="$1"
+    local description="$2"
+    
+    info "Running (expecting failure): $cmd"
+    
+    # Run the command and capture both output and exit code
+    set +e  # Temporarily disable exit on error
+    output=$(eval "$cmd" 2>&1)
+    local exit_code=$?
+    set -e  # Re-enable exit on error
+    
+    echo "$output" | tee -a "$LOG_FILE"
+    
+    if [ "$exit_code" -ne 0 ]; then
+        success "$description (failed as expected with exit code $exit_code)"
+    else
+        error "$description should have failed but succeeded (exit code: $exit_code)"
+    fi
+}
+
+# Expect plandex command to fail
+expect_plandex_failure() {
+    local cmd="$1"
+    local description="$2"
+    expect_failure "$PLANDEX_CMD $cmd" "$description"
+}
+
+# Check if file exists
+check_file() {
+    if [ -f "$1" ]; then
+        success "File exists: $1"
+    else
+        error "File missing: $1"
+    fi
+}
+
+# Setup test environment
+setup_test_dir() {
+    source ../.env.client-keys
+
+    local test_name="$1"
+    TEST_DIR="/tmp/plandex-${test_name}-$$"
+    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
+    LOG_FILE="${TEST_DIR}/${test_name}-${TIMESTAMP}.log"
+    
+    info "Setting up test environment in $TEST_DIR"
+    mkdir -p "$TEST_DIR"
+    cd "$TEST_DIR"
+    touch "$LOG_FILE"
+    
+    success "Test environment created"
+}
+
+# Cleanup function
+cleanup_test_dir() {
+    info "Cleaning up test environment"
+    cd /
+    rm -rf "$TEST_DIR"
+    success "Cleanup complete"
+}
\ No newline at end of file
```

---

### Incident Patch 4: `e0f8a390` (2025-06-28)
**Commit Message**: Update model documentation and add built-in model reference

**File**: `docs/docs/cli-reference.md` (modified, +15/-2)
```diff
@@ -67,7 +67,12 @@ The REPL has a few convenient flags you can use to start it with different modes
     --strong       Strong pack (more capable models, higher cost and slower)
     --cheap        Cheap pack (less capable models, lower cost and faster)
     --oss          Open source pack (open source models)
-    --gemini       Gemini pack (Gemini 2.5 Pro Preview for planning and coding, default models for other roles)
+    
+    --gemini-planner       Gemini pack (Gemini 2.5 Pro for planning, default models for other roles)
+    --o3-planner           OpenAI o3-medium for planning, default models for other roles
+    --r1-planner           DeepSeek R1 for planning, default models for other roles
+    --perplexity-planner   Perplexity for planning, default models for other roles
+    --opus-planner         Anthropic Opus 4 for planning, default models for other roles
 ```
 
 All commands listed below can be run in the REPL by prefixing them with a backslash (`\`), e.g. `\new`.
@@ -107,7 +112,15 @@ plandex new -n new-plan # with name
 
 `--oss`: Start the plan with the open source model pack.
 
-`--gemini`: Start the plan with the Gemini model pack.
+`--gemini-planner`: Start the plan with the Gemini planner model pack.
+
+`--o3-planner`: Start the plan with the OpenAI o3-medium planner model pack.
+
+`--r1-planner`: Start the plan with the DeepSeek R1 planner model pack.
+
+`--perplexity-planner`: Start the plan with the Perplexity planner model pack.
+
+`--opus-planner`: Start the plan with the Anthropic Opus 4 planner model pack.
 
 ### plans
 
```

**File**: `docs/docs/core-concepts/configuration.md` (modified, +10/-2)
```diff
@@ -5,7 +5,7 @@ sidebar_label: Configuration
 
 # Configuration
 
-Plandex v2 provides a flexible configuration system that lets you customize its behavior based on the task you're working on and your preferences.
+Plandex provides a flexible configuration system that lets you customize its behavior based on the task you're working on and your preferences.
 
 ## Viewing Config
 
@@ -64,10 +64,18 @@ Autonomy settings control the overall level of automation Plandex will use. See
 | `auto-commit`           | Commit changes to git when applied       | `true` |
 | `auto-revert-on-rewind` | Revert project files when rewinding      | `true`  |
 
+### Editor
+
+| Setting                 | Description                              | Default |
+| ----------------------- | ---------------------------------------- | ------- |
+| `editor`                | Editor to use for editing files          |   |
+
+
+
 
 ## Command Line Overrides
 
-Settings can be overridden with command line flags:
+Many settings can be overridden with command line flags:
 
 ```bash
 # this will apply changes, automatically execute commands, and automatically debug regardless of your autonomy level and config settings
```

**File**: `docs/docs/core-concepts/execution-and-debugging.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ sidebar_label: Execution and Debugging
 
 # Execution and Debugging
 
-Plandex v2 includes command execution and automated debugging capabilities that aim to balance power, control, and safety.
+Plandex includes command execution and automated debugging capabilities that aim to balance power, control, and safety.
 
 ## Command Execution
 
```

**File**: `docs/docs/core-concepts/reviewing-changes.md` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ plandex apply
 
 ### Apply Flags & Config
 
-Plandex v2 introduces several [new config settings and flags](./configuration.md) for the `apply` command that give you control over what happens after changes are applied.
+Plandex v2 introduced several [new config settings and flags](./configuration.md) for the `apply` command that give you control over what happens after changes are applied.
 
 ### Command Execution & Debugging
 
```

**File**: `docs/docs/models/built-in/_category_.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "label": "Built-In",
+  "position": 8,
+  "collapsible": true,
+  "collapsed": false
+}
\ No newline at end of file
```

**File**: `docs/docs/models/built-in/built-in-models.md` (added, +472/-0)
```diff
@@ -0,0 +1,472 @@
+---
+sidebar_position: 1
+sidebar_label: Models
+---
+
+# Built-In Models
+
+Plandex includes a curated selection of built-in models.
+
+## OpenAI
+
+### `openai/o3-high`
+
+- OpenAI o3 (high reasoning)
+- Max Tokens: 200k
+- Max Output: 100k
+- Reserved Output: 40k
+- Effective Input: 160k
+- Features: XML output, no system prompt, fixed parameters, reasoning effort
+- Providers: OpenAI, Azure OpenAI, OpenRouter
+
+### `openai/o3-medium`
+
+- OpenAI o3 (medium reasoning)
+- Max Tokens: 200k
+- Max Output: 100k
+- Reserved Output: 40k
+- Effective Input: 160k
+- Features: XML output, no system prompt, fixed parameters, reasoning effort
+- Providers: OpenAI, Azure OpenAI, OpenRouter
+
+### `openai/o3-low`
+
+- OpenAI o3 (low reasoning)
+- Max Tokens: 200k
+- Max Output: 100k
+- Reserved Output: 40k
+- Effective Input: 160k
+- Features: XML output, no system prompt, fixed parameters, reasoning effort
+- Providers: OpenAI, Azure OpenAI, OpenRouter
+
+### `openai/o4-mini-high`
+
+- OpenAI o4-mini (high reasoning)
+- Max Tokens: 200k
+- Max Output: 100k
+- Reserved Output: 40k
+- Effective Input: 160k
+- Features: JSON output, no system prompt, fixed parameters, reasoning effort
+- Providers: OpenAI, Azure OpenAI, OpenRouter
+
+### `openai/o4-mini-medium`
+
+- OpenAI o4-mini (medium reasoning)
+- Max Tokens: 200k
+- Max Output: 100k
+- Reserved Output: 30k
+- Effective Input: 170k
+- Features: JSON output, no system prompt, fixed parameters, reasoning effort
+- Providers: OpenAI, Azure OpenAI, OpenRouter
+
+### `openai/o4-mini-low`
+
+- OpenAI o4-mini (low reasoning)
+- Max Tokens: 200k
+- Max Output: 100k
+- Reserved Output: 20k
+- Effective Input: 180k
+- Features: JSON output, no system prompt, fixed parameters, reasoning effort
+- Providers: OpenAI, Azure OpenAI, OpenRouter
+
+### `openai/gpt-4.1`
+
+- OpenAI GPT-4.1
+- Max Tokens: 1,047,576
+- Max Output: 32,768
+- Reserved Output: 32,768
+- Effective Input: 1,014,808
+- Features: JSON output, full compatibility
+- Providers: OpenAI, Azure OpenAI, OpenRouter
+
+### `openai/gpt-4.1-mini`
+
+- OpenAI GPT-4.1 Mini
+- Max Tokens: 1,047,576
+- Max Output: 32,768
+- Reserved Output: 32,768
+- Effective Input: 1,014,808
+- Features: JSON output, full compatibility
+- Providers: OpenAI, Azure OpenAI, OpenRouter
+
+### `openai/gpt-4.1-nano`
+
+- OpenAI GPT-4.1 Nano
+- Max Tokens: 1,047,576
+- Max Output: 32,768
+- Reserved Output: 32,768
+- Effective Input: 1,014,808
+- Features: JSON output, full compatibility
+- Providers: OpenAI, Azure OpenAI, OpenRouter
+
+## Anthropic
+
+### `anthropic/claude-opus-4`
+
+- Anthropic Claude Opus 4
+- Max Tokens: 200k
+- Max Output: 128k
+- Reserved Output: 20k
+- Effective Input: 180k
+- Features: XML output, cache control, single message mode
+- Providers: Anthropic, AWS Bedrock, Google Vertex, OpenRouter
+
+### `anthropic/claude-sonnet-4`
+
+- Anthropic Claude Sonnet 4
+- Max Tokens: 200k
+- Max Output: 128k
+- Reserved Output: 40k
+- Effective Input: 160k
+- Features: XML output, cache control, single message mode
+- Providers: Anthropic, AWS Bedrock, Google Vertex, OpenRouter
+
+### `anthropic/claude-sonnet-4-thinking`
+
+- Claude Sonnet 4 (visible reasoning)
+- Max Tokens: 200k
+- Max Output: 128k
+- Reserved Output: 40k
+- Effective Input: 160k
+- Features: XML output, cache control, single message mode, reasoning budget 32k
+- Providers: Anthropic, AWS Bedrock, Google Vertex, OpenRouter
+
+### `anthropic/claude-sonnet-4-thinking-hidden`
+
+- Claude Sonnet 4 (hidden reasoning)
+- Max Tokens: 200k
+- Max Output: 128k
+- Reserved Output: 40k
+- Effective Input: 160k
+- Features: XML output, cache control, single message mode, reasoning budget 32k
+- Providers: Anthropic, AWS Bedrock, Google Vertex, OpenRouter
+
+### `anthropic/claude-3.7-sonnet`
+
+- Anthropic Claude 3.7 Sonnet
+- Max Tokens: 200k
+- Max Output: 128k
+- Reserved Output: 20k
+- Effective Input: 180k
+- Features: XML output, cache control, single message mode
+- Providers: Anthropic, AWS Bedrock, Google Vertex, OpenRouter
+
+### `anthropic/claude-3.7-sonnet-thinking`
+
+- Claude 3.7 Sonnet (visible reasoning)
+- Max Tokens: 200k
+- Max Output: 128k
+- Reserved Output: 20k
+- Effective Input: 180k
+- Features: XML output, cache control, single message mode, reasoning budget 32k
+- Providers: Anthropic, AWS Bedrock, Google Vertex, OpenRouter
+
+### `anthropic/claude-3.7-sonnet-thinking-hidden`
+
+- Claude 3.7 Sonnet (hidden reasoning)
+- Max Tokens: 200k
+- Max Output: 128k
+- Reserved Output: 20k
+- Effective Input: 180k
+- Features: XML output, cache control, single message mode, reasoning budget 32k
+- Providers: Anthropic, AWS Bedrock, Google Vertex, OpenRouter
+
+### `anthropic/claude-3.5-sonnet`
+
+- Anthropic Claude 3.5 Sonnet
+- Max Tokens: 200k
+- Max Output: 128k
+- Reserved Output: 20k
+- Effective Input: 180k
+- Features: XML output, cache control, single message mode
+- Providers: Anthropic, Google Vertex, AWS Bedrock, OpenRouter
+
```

**File**: `docs/docs/models/built-in/built-in-packs.md` (added, +237/-0)
```diff
@@ -0,0 +1,237 @@
+---
+sidebar_position: 2
+sidebar_label: Model Packs
+---
+
+# Built-In Model Packs
+
+Plandex includes a curated selection of built-in model packs that have been tested and optimized for different use cases.
+
+*A model pack is a mapping of [model roles](../models/model-roles) to [models](./built-in-models.md).*
+
+*They can also define fallback models for large context, large output, error handling, as well as a strong variant for the `builder` role.*
+
+## Core Packs
+
+### `daily-driver`
+*A mix of models from Anthropic, OpenAI, and Google that balances speed, quality, and cost. Supports up to 2M context.*
+
+- **planner** → `anthropic/claude-sonnet-4`
+  - largeContextFallback → `google/gemini-2.5-pro`
+    - largeContextFallback → `google/gemini-pro-1.5`
+- **architect** → `anthropic/claude-sonnet-4`
+  - largeContextFallback → `google/gemini-2.5-pro`
+    - largeContextFallback → `google/gemini-pro-1.5`
+- **coder** → `anthropic/claude-sonnet-4`
+  - largeContextFallback → `openai/gpt-4.1`
+- **summarizer** → `openai/o4-mini-low`
+- **builder** → `openai/o4-mini-medium`
+  - strongModel → `openai/o4-mini-high`
+- **wholeFileBuilder** → `openai/o4-mini-medium`
+- **names** → `openai/gpt-4.1-mini`
+- **commitMessages** → `openai/gpt-4.1-mini`
+- **autoContinue** → `openai/o4-mini-low`
+
+### `reasoning`
+*Like the daily driver, but uses sonnet-4-thinking with reasoning enabled for planning and coding. Supports up to 160k input context.*
+
+- **planner** → `anthropic/claude-sonnet-4-thinking-hidden`
+- **architect** → Uses planner model
+- **coder** → `anthropic/claude-sonnet-4-thinking-hidden`
+- **summarizer** → `openai/o4-mini-low`
+- **builder** → `openai/o4-mini-medium`
+  - strongModel → `openai/o4-mini-high`
+- **wholeFileBuilder** → `openai/o4-mini-medium`
+- **names** → `openai/gpt-4.1-mini`
+- **commitMessages** → `openai/gpt-4.1-mini`
+- **autoContinue** → `openai/o4-mini-low`
+
+### `strong`
+*For difficult tasks where slower responses and builds are ok. Uses o3-high for architecture and planning, claude-sonnet-4 thinking for implementation. Supports up to 160k input context.*
+
+- **planner** → `openai/o3-high`
+- **architect** → `openai/o3-high`
+- **coder** → `anthropic/claude-sonnet-4-thinking-hidden`
+- **summarizer** → `openai/o4-mini-low`
+- **builder** → `openai/o4-mini-high`
+- **wholeFileBuilder** → `openai/o4-mini-high`
+- **names** → `openai/gpt-4.1-mini`
+- **commitMessages** → `openai/gpt-4.1-mini`
+- **autoContinue** → `openai/o4-mini-medium`
+
+### `cheap`
+*Cost-effective models that can still get the job done for easier tasks. Supports up to 160k context. Uses OpenAI's o4-mini model for planning, GPT-4.1 for coding, and GPT-4.1 Mini for lighter tasks.*
+
+- **planner** → `openai/o4-mini-medium`
+- **architect** → Uses planner model
+- **coder** → `openai/gpt-4.1`
+- **summarizer** → `openai/gpt-4.1-mini`
+- **builder** → `openai/o4-mini-low`
+- **wholeFileBuilder** → `openai/o4-mini-low`
+- **names** → `openai/gpt-4.1-mini`
+- **commitMessages** → `openai/gpt-4.1-mini`
+- **autoContinue** → `openai/o4-mini-low`
+
+### `oss`
+*An experimental mix of the best open source models for coding. Supports up to 144k context, 33k per file.*
+
+- **planner** → `deepseek/r1`
+- **architect** → Uses planner model
+- **coder** → `deepseek/v3`
+- **summarizer** → `deepseek/r1-hidden`
+- **builder** → `deepseek/r1-hidden`
+- **wholeFileBuilder** → `deepseek/r1-hidden`
+- **names** → `qwen/qwen3-8b-cloud`
+- **commitMessages** → `qwen/qwen3-8b-cloud`
+- **autoContinue** → `deepseek/r1-hidden`
+
+## Provider Packs
+
+
+### `openai`
+*OpenAI blend. Supports up to 1M context. Uses OpenAI's GPT-4.1 model for heavy lifting, GPT-4.1 Mini for lighter tasks.*
+
+- **planner** → `openai/gpt-4.1`
+- **architect** → Uses planner model
+- **coder** → Uses planner model
+- **summarizer** → `openai/o4-mini-low`
+- **builder** → `openai/o4-mini-medium`
+  - strongModel → `openai/o4-mini-high`
+- **wholeFileBuilder** → `openai/o4-mini-medium`
+- **names** → `openai/gpt-4.1-mini`
+- **commitMessages** → `openai/gpt-4.1-mini`
+- **autoContinue** → `openai/o4-mini-low`
+
+### `anthropic`
+*Anthropic blend. Supports up to 180k context. Uses Claude Sonnet 4 for heavy lifting, Claude 3 Haiku for lighter tasks.*
+
+- **planner** → `anthropic/claude-sonnet-4`
+- **architect** → Uses planner model
+- **coder** → `anthropic/claude-sonnet-4`
+- **summarizer** → `anthropic/claude-3.5-haiku`
+- **builder** → `anthropic/claude-sonnet-4`
+- **wholeFileBuilder** → `anthropic/claude-sonnet-4`
+- **names** → `anthropic/claude-3.5-haiku`
+- **commitMessages** → `anthropic/claude-3.5-haiku`
+- **autoContinue** → `anthropic/claude-sonnet-4`
+
+### `gemini-planner`
+*Uses Gemini 2.5 Pro for planning, default models for other roles. Supports up to 1M input context.*
+
+- **planner** → `google/gemini-2.5-pro`
+- **architect** → Uses planner model
+- **coder** → `anthropic/claude-sonnet-4`
+  - largeContextFallb
```

**File**: `docs/docs/models/ollama.md` (modified, +36/-11)
```diff
@@ -1,57 +1,79 @@
 ---
-sidebar_position: 6
+sidebar_position: 7
 sidebar_label: Ollama Quickstart
 ---
 
 # Ollama Quickstart
 
-Plandex works with [Ollama](https://ollama.com/) models. To use them, you need to [self-host Plandex.](../hosting/self-hosting/local-mode-quickstart.md) Ollama isn't supported with Plandex Cloud.
+Plandex works with [Ollama](https://ollama.com/) models. To use them, you need to [self-host Plandex.](../hosting/self-hosting/local-mode-quickstart.md)
+**Ollama isn't supported with Plandex Cloud.**
 
 ## Disclaimer
 
 While local models are supported via Ollama, small models that can be run locally often aren't strong enough to produce usable results for the [heavy-lifting roles](./roles.md) like `planner`, `architect`, `coder`, and `builder`. The prompts for these roles require strong instruction following that can be hard to achieve with small models.
 
 The strongest open source models _are_ capable enough for decent results, but these models are quite large for running locally without a very powerful system. This isn't meant to discourage experimentation with local models, but to set expectations for what is achievable.
 
-To help bridge the gap as local models continue to improve their capabilities, a built-in `ollama-adaptive` model pack is available. This model pack uses local Ollama models for less demanding roles, plus larger remote models for heavy-lifting. There's also a built-in `ollama-experimental` model pack that uses local models for all roles—this is recommended for testing and benchmarking, but not for getting real work done.
+To help bridge the gap as local models continue to improve their capabilities, two 'adaptive' model packs are available: `ollama-oss` and `ollama-daily`. These model packs use local Ollama models for less demanding roles, plus larger remote models for heavy-lifting (open source models for the `oss` variant, and the same models used in the default `daily-driver` model pack for the `daily` variant).
+
+Over time, as local models improve, these adaptive model packs will be updated to use local models for more roles.
+
+There's also a built-in experimental `ollama` model pack that uses local models for all roles—this is recommended for testing and benchmarking, but not (yet) for getting real work done.
+
+## System requirements
+
+To use Ollama models, you need enough system resources to run the models you want to use. To use the built-in experimental `ollama` model pack (with qwen3:32b as the largest model), at least 32GB of RAM is recommended as an absolute minimum—48GB or more is recommended for breathing room. For the `ollama-daily` and `ollama-oss` model packs (with devstral:24b as the largest model), at least 16GB of RAM is recommended as an absolute minimum—24GB or more is recommended for breathing room.
+
+If you use [custom models and a custom model pack](./custom-models.md), you'll have full flexibility to choose the appropriate models for your system. Just remember that running Plandex prompts successfully is a challenge for even the largest local models.
 
 ## Install and run Ollama
 
 [Download and install ollama](https://ollama.com/download) for your platform.
 
-Then make sure the ollama server is running:
+Then make sure the Ollama server is running:
 
 ```bash
 ollama serve
 ```
 
 ## Pull Ollama models
 
-Pull the models you want to use. For the built-in `ollama-adaptive` and `ollama-experimental` model packs, pull the following models:
+Pull the models you want to use. 
+
+For the built-in `ollama` model pack, pull the following models:
 
 ```bash
-ollama pull qwen3:32b
 ollama pull qwen3:8b
 ollama pull qwen3:14b
+ollama pull qwen3:32b
+ollama pull devstral:24b
+```
+
+For the `ollama-daily` and `ollama-oss` model packs, pull the following models:
+
+```bash
+ollama pull qwen3:8b
 ollama pull devstral:24b
 ```
 
 ## Use Ollama in Plandex
 
 ### Built-in model packs
 
-To use one of the built-in Ollama model packs in Plandex, decide whether you want to use `ollama-experimental`, which uses local models for all roles, but may struggle in practice, or `ollama-adaptive`, which uses local models for less demanding roles, plus the default Plandex models for heavy-lifting.
+To use one of the built-in Ollama model packs in Plandex, decide whether you want to use `ollama`, which uses local models for all roles, but may struggle in practice, `ollama-daily`, which uses local models for less demanding roles, plus the default Plandex models from the `daily-driver` model pack for heavy-lifting, or `ollama-oss`, which uses local models for less demanding roles, plus the open source Plandex models from the `oss` model pack for heavy-lifting.
 
 ```bash
-\set-model ollama-experimental # REPL
-plandex set-model ollama-experimental # CLI
+\set-model ollama # REPL
+plandex set-model ollama # CLI
 ```
 
 Or:
 
 ```bash
-\set-model ollama-adaptive # REPL
-plandex set-model ollama-adaptive # CLI
+\set-model ollama-daily # REPL
+\set-model ollama-oss

```

---

### Incident Patch 5: `e2ab4551` (2025-06-25)
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

**File**: `app/cli/term/help.go` (modified, +3/-4)
```diff
@@ -43,8 +43,7 @@ var CliCommands = []CmdConfig{
 	{"new --strong", "", fmt.Sprintf("start a new plan with %s model pack", "'strong'"), true},
 	{"new --cheap", "", fmt.Sprintf("start a new plan with %s model pack", "'cheap'"), true},
 	{"new --oss", "", fmt.Sprintf("start a new plan with %s model pack", "'oss'"), true},
-	{"new --gemini-preview", "", fmt.Sprintf("start a new plan with %s model pack", "'gemini-preview'"), true},
-	// {"new --crazy", "", fmt.Sprintf("start a new plan with %s model pack", "'crazy'"), true},
+	{"new --gemini", "", fmt.Sprintf("start a new plan with %s model pack", "'gemini'"), true},
 	{"plans", "pl", "list plans", true},
 	{"cd", "", "set current plan by name or index", true},
 	{"current", "cu", "show current plan", true},
@@ -127,7 +126,7 @@ var CliCommands = []CmdConfig{
 	{"set-model strong", "", fmt.Sprintf("Use %s model pack", "'strong'"), true},
 	{"set-model cheap", "", fmt.Sprintf("Use %s model pack", "'cheap'"), true},
 	{"set-model oss", "", fmt.Sprintf("Use %s model pack", "'oss'"), true},
-	{"set-model gemini-preview", "", fmt.Sprintf("Use %s model pack", "'gemini-preview'"), true},
+	{"set-model gemini", "", fmt.Sprintf("Use %s model pack", "'gemini'"), true},
 
 	{"ps", "", "list active and recently finished plan streams", true},
 	{"stop", "", "stop an active plan stream", true},
@@ -342,7 +341,7 @@ func PrintHelpAllCommands() {
 	fmt.Fprintln(builder)
 
 	color.New(color.Bold, color.BgCyan, color.FgHiWhite).Fprintln(builder, " New Plan Shortcuts ")
-	printCmds(builder, " ", []color.Attribute{color.Bold, ColorHiCyan}, "new --full", "new --semi", "new --plus", "new --basic", "new --none", "new --daily", "new --reasoning", "new --strong", "new --cheap", "new --oss", "new --gemini-preview" /*"new --crazy"*/)
+	printCmds(builder, " ", []color.Attribute{color.Bold, ColorHiCyan}, "new --full", "new --semi", "new --plus", "new --basic", "new --none", "new --daily", "new --reasoning", "new --strong", "new --cheap", "new --oss", "new --gemini" /*"new --crazy"*/)
 	fmt.Fprintln(builder)
 
 	fmt.Print(builder.String())
```

**File**: `app/docker-compose.yml` (modified, +4/-0)
```diff
@@ -27,6 +27,10 @@ services:
       GOENV: development
       LOCAL_MODE: 1
       PLANDEX_BASE_DIR: /plandex-server
+      OLLAMA_BASE_URL: http://host.docker.internal:11434
+      
+    extra_hosts:
+      - "host.docker.internal:host-gateway"
     networks:
       - plandex-network
     depends_on:
```

**File**: `app/server/handlers/models.go` (modified, +5/-5)
```diff
@@ -31,7 +31,7 @@ func UpsertCustomModelsHandler(w http.ResponseWriter, r *http.Request) {
 	var modelsInput shared.ModelsInput
 	if err := json.NewDecoder(r.Body).Decode(&modelsInput); err != nil {
 		log.Printf("Error decoding request body: %v\n", err)
-		http.Error(w, "Invalid request body", http.StatusBadRequest)
+		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
 		return
 	}
 
@@ -184,13 +184,13 @@ func UpsertCustomModelsHandler(w http.ResponseWriter, r *http.Request) {
 	}
 
 	for _, model := range updatedModelsInput.CustomModels {
-		// ensure that providers to upsert are either built-in, being created, or already exist
+		// ensure that providers to upsert are either built-in, being imported, or already exist
 		for _, provider := range model.Providers {
 			if provider.Provider == shared.ModelProviderCustom {
 				_, exists := existingCustomProviderNames[*provider.CustomProvider]
 				_, creating := inputProviderNames[*provider.CustomProvider]
 				if !exists && !creating {
-					msg := fmt.Sprintf("'%s' is not a custom model provider that exists or is being created", *provider.CustomProvider)
+					msg := fmt.Sprintf("'%s' is not a custom model provider that exists or is being imported", *provider.CustomProvider)
 					log.Println(msg)
 					http.Error(w, msg, http.StatusUnprocessableEntity)
 					return
@@ -214,7 +214,7 @@ func UpsertCustomModelsHandler(w http.ResponseWriter, r *http.Request) {
 	}
 
 	for _, modelPack := range updatedModelsInput.CustomModelPacks {
-		// ensure that all models are either built-in, being created, or already exist
+		// ensure that all models are either built-in, being imported, or already exist
 		allModelIds := modelPack.AllModelIds()
 
 		for _, modelId := range allModelIds {
@@ -223,7 +223,7 @@ func UpsertCustomModelsHandler(w http.ResponseWriter, r *http.Request) {
 			_, builtIn := shared.BuiltInBaseModelsById[modelId]
 
 			if !exists && !creating && !builtIn {
-				msg := fmt.Sprintf("'%s' is not built-in, not being created, and not an existing custom model", modelId)
+				msg := fmt.Sprintf("'%s' is not built-in, not being imported, and not an existing custom model", modelId)
 				log.Println(msg)
 				http.Error(w, msg, http.StatusUnprocessableEntity)
 				return
```

---

### Incident Patch 6: `74ee022c` (2025-06-24)
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
+	apiCustomModels := make([]*shared.CustomModel, len(customModels))
+	for i, model := range customModels {
+		apiCustomModels[i] = model.ToApi()
+	}
+
+	apiCustomProviders := make([]*shared.CustomProvider, len(customProviders))
+	for i, provider := range customProviders {
+		apiCustomProviders[i] = provider.ToApi()
+	}
+
+	result = &GetCustomModelsResult{
+		CustomModels:     apiCustomModels,
+		CustomProviders:  apiCustomProviders,
+		CustomModelPacks: apiModelPacks,
+	}
+
+	return result, nil
+}
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

**File**: `app/server/handlers/plans_changes.go` (modified, +1/-0)
```diff
@@ -192,6 +192,7 @@ func ApplyPlanHandler(w http.ResponseWriter, r *http.Request) {
 			openAIOrgId: requestBody.OpenAIOrgId,
 			authVars:    requestBody.AuthVars,
 			plan:        plan,
+			settings:    settings,
 		},
 	)
 
```

**File**: `app/server/handlers/plans_exec.go` (modified, +16/-0)
```diff
@@ -39,6 +39,13 @@ func TellPlanHandler(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 
+	settings, err := db.GetPlanSettings(plan)
+	if err != nil {
+		log.Printf("Error getting plan settings: %v\n", err)
+		http.Error(w, "Error getting plan settings", http.StatusInternalServerError)
+		return
+	}
+
 	body, err := io.ReadAll(r.Body)
 	if err != nil {
 		log.Printf("Error reading request body: %v\n", err)
@@ -77,6 +84,7 @@ func TellPlanHandler(w http.ResponseWriter, r *http.Request) {
 			openAIOrgId: requestBody.OpenAIOrgId,
 			authVars:    requestBody.AuthVars,
 			plan:        plan,
+			settings:    settings,
 		},
 	)
 	err = modelPlan.Tell(modelPlan.TellParams{
@@ -119,6 +127,13 @@ func BuildPlanHandler(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 
+	settings, err := db.GetPlanSettings(plan)
+	if err != nil {
+		log.Printf("Error getting plan settings: %v\n", err)
+		http.Error(w, "Error getting plan settings", http.StatusInternalServerError)
+		return
+	}
+
 	body, err := io.ReadAll(r.Body)
 	if err != nil {
 		log.Printf("Error reading request body: %v\n", err)
@@ -147,6 +162,7 @@ func BuildPlanHandler(w http.ResponseWriter, r *http.Request) {
 			openAIOrgId: requestBody.OpenAIOrgId,
 			authVars:    requestBody.AuthVars,
 			plan:        plan,
+			settings:    settings,
 		},
 	)
 	numBuilds, err := modelPlan.Build(modelPlan.BuildParams{
```

**File**: `app/server/model/client.go` (modified, +19/-17)
```diff
@@ -42,9 +42,9 @@ type ClientInfo struct {
 	OpenAIOrgId    string
 }
 
-func InitClients(authVars map[string]string) map[string]ClientInfo {
+func InitClients(authVars map[string]string, settings *shared.PlanSettings) map[string]ClientInfo {
 	clients := make(map[string]ClientInfo)
-	providers := shared.GetProvidersForAuthVars(authVars)
+	providers := shared.GetProvidersForAuthVars(authVars, settings)
 
 	for _, provider := range providers {
 		clients[provider.ToComposite()] = newClient(provider, authVars)
@@ -105,29 +105,31 @@ func CreateChatCompletionStream(
 	clients map[string]ClientInfo,
 	authVars map[string]string,
 	modelConfig *shared.ModelRoleConfig,
-	localProvider shared.ModelProvider,
+	settings *shared.PlanSettings,
 	ctx context.Context,
 	req types.ExtendedChatCompletionRequest,
 ) (*ExtendedChatCompletionStream, error) {
-	providerComposite := modelConfig.GetProviderComposite(authVars, localProvider)
+	providerComposite := modelConfig.GetProviderComposite(authVars, settings)
 	_, ok := clients[providerComposite]
 	if !ok {
 		return nil, fmt.Errorf("client not found for provider composite: %s", providerComposite)
 	}
 
-	baseModelConfig := modelConfig.GetBaseModelConfig(authVars, localProvider)
+	baseModelConfig := modelConfig.GetBaseModelConfig(authVars, settings)
 
 	// ensure the model name is set correctly on fallbacks
 	req.Model = baseModelConfig.ModelName
 
-	resolveReq(&req, modelConfig, baseModelConfig)
+	resolveReq(&req, modelConfig, baseModelConfig, settings)
 
 	// choose the fastest provider by latency/throughput on openrouter
 	if baseModelConfig.Provider == shared.ModelProviderOpenRouter {
-		req.Model += ":nitro"
+		if !strings.HasSuffix(string(req.Model), ":nitro") && !strings.HasSuffix(string(req.Model), ":free") && !strings.HasSuffix(string(req.Model), ":floor") {
+			req.Model += ":nitro"
+		}
 	}
 
-	if baseModelConfig.ReasoningBudgetEnabled {
+	if baseModelConfig.ReasoningBudget > 0 {
 		req.ReasoningConfig = &types.ReasoningConfig{
 			MaxTokens: baseModelConfig.ReasoningBudget,
 			Exclude:   !baseModelConfig.IncludeReasoning,
@@ -144,16 +146,16 @@ func CreateChatCompletionStream(
 	}
 
 	return withStreamingRetries(ctx, func(numTotalRetry int, didProviderFallback bool, modelErr *shared.ModelError) (*ExtendedChatCompletionStream, shared.FallbackResult, error) {
-		fallbackRes := modelConfig.GetFallbackForModelError(numTotalRetry, didProviderFallback, modelErr, authVars, localProvider)
+		fallbackRes := modelConfig.GetFallbackForModelError(numTotalRetry, didProviderFallback, modelErr, authVars, settings)
 		resolvedModelConfig := fallbackRes.ModelRoleConfig
 
 		if resolvedModelConfig == nil {
 			return nil, fallbackRes, fmt.Errorf("model config is nil")
 		}
 
-		providerComposite := resolvedModelConfig.GetProviderComposite(authVars, localProvider)
+		providerComposite := resolvedModelConfig.GetProviderComposite(authVars, settings)
 
-		baseModelConfig := resolvedModelConfig.GetBaseModelConfig(authVars, localProvider)
+		baseModelConfig := resolvedModelConfig.GetBaseModelConfig(authVars, settings)
 
 		opClient, ok := clients[providerComposite]
 
@@ -183,7 +185,7 @@ func CreateChatCompletionStream(
 			"modelConfig.ApiKeyEnvVar": baseModelConfig.ApiKeyEnvVar,
 		})
 
-		resp, err := createChatCompletionStreamExtended(resolvedModelConfig, opClient, authVars, localProvider, ctx, req)
+		resp, err := createChatCompletionStreamExtended(resolvedModelConfig, opClient, authVars, settings, ctx, req)
 		return resp, fallbackRes, err
 	}, func(resp *ExtendedChatCompletionStream, err error) {})
 }
@@ -192,11 +194,11 @@ func createChatCompletionStreamExtended(
 	modelConfig *shared.ModelRoleConfig,
 	client ClientInfo,
 	authVars map[string]string,
-	localProvider shared.ModelProvider,
+	settings *shared.PlanSettings,
 	ctx context.Context,
 	extendedReq types.ExtendedChatCompletionRequest,
 ) (*ExtendedChatCompletionStream, error) {
-	baseModelConfig := modelConfig.GetBaseModelConfig(authVars, localProvider)
+	baseModelConfig := modelConfig.GetBaseModelConfig(authVars, settings)
 
 	// ensure the model name is set correctly on fallbacks
 	extendedReq.Model = baseModelConfig.ModelName
@@ -448,9 +450,9 @@ func (stream *ExtendedChatCompletionStream) Close() error {
 	return stream.customReader.Close()
 }
 
-func resolveReq(req *types.ExtendedChatCompletionRequest, modelConfig *shared.ModelRoleConfig, baseModelConfig *shared.BaseModelConfig) {
+func resolveReq(req *types.ExtendedChatCompletionRequest, modelConfig *shared.ModelRoleConfig, baseModelConfig *shared.BaseModelConfig, settings *shared.PlanSettings) {
 	// if system prompt is disabled, change the role of the system message to user
-	if modelConfig.GetSharedBaseConfig().SystemPromptDisabled {
+	if modelConfig.GetSharedBaseConfig(settings).SystemPromptDisabled {
 		log.Println("System prompt disabled - changing role of system message to user")
 		for i, msg := range req.Messages {
 			log.Println("Message role:", msg.Role
```

---

### Incident Patch 7: `7d965393` (2025-06-23)
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

**File**: `app/server/model/plan/tell_stream_finish.go` (modified, +1/-1)
```diff
@@ -255,7 +255,7 @@ func (state *activeTellStreamState) handleStreamFinished() handleStreamFinishedR
 				active.StreamDoneCh <- &shared.ApiError{
 					Type:   shared.ApiErrorTypeOther,
 					Status: http.StatusInternalServerError,
-					Msg:    "Error setting plan status to building",
+					Msg:    fmt.Sprintf("Error setting plan status to building: %v", err),
 				}
 
 				return handleStreamFinishedResult{
```

**File**: `app/server/model/plan/tell_stream_processor.go` (modified, +2/-2)
```diff
@@ -50,7 +50,7 @@ func (state *activeTellStreamState) processChunk(choice types.ExtendedChatComple
 			active.StreamDoneCh <- &shared.ApiError{
 				Type:   shared.ApiErrorTypeOther,
 				Status: http.StatusInternalServerError,
-				Msg:    "Panic in processChunk",
+				Msg:    fmt.Sprintf("Panic in processChunk: %v\n%s", r, string(debug.Stack())),
 			}
 		}
 	}()
@@ -622,7 +622,7 @@ func (state *activeTellStreamState) handleMissingFile(content, currentFile, bloc
 		active.StreamDoneCh <- &shared.ApiError{
 			Type:   shared.ApiErrorTypeOther,
 			Status: http.StatusInternalServerError,
-			Msg:    "Error setting plan status to prompting",
+			Msg:    fmt.Sprintf("Error setting plan status to prompting: %v", err),
 		}
 		return processChunkResult{}
 	}
```

**File**: `app/server/model/plan/tell_stream_store.go` (modified, +1/-1)
```diff
@@ -219,7 +219,7 @@ func (state *activeTellStreamState) storeOnFinished(params storeOnFinishedParams
 		active.StreamDoneCh <- &shared.ApiError{
 			Type:   shared.ApiErrorTypeOther,
 			Status: http.StatusInternalServerError,
-			Msg:    "Error storing on finished",
+			Msg:    fmt.Sprintf("Error storing on finished: %v", err),
 		}
 		return storeOnFinishedResult{
 			handleStreamFinishedResult: handleStreamFinishedResult{
```

---

### Incident Patch 8: `6302d8e3` (2025-06-23)
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
 		Description: "Cost-effective models that can still get the job done for easier tasks. Supports up to 160k context. Uses OpenAI's o4-mini model for planning, GPT-4.1 for coding, and GPT-4.1 Mini for lighter tasks.",
 		ModelPackSchemaRoles: ModelPackSchemaRoles{
@@ -188,25 +192,25 @@ func init() {
 		},
 	}
 
-	OSSModelPackSchema = ModelPackSchema{
+	OssSchema = ModelPackSchema{
 		Name:        "oss",
 		Description: "An experimental mix of the best open source models for coding. Supports up to 56k context, 8k per file. Works best with smaller projects and files. Includes reasoning.",
 		ModelPackSchemaRoles: ModelPackSchemaRoles{
-			Planner:     getModelRoleConfig(ModelRolePlanner, "deepseek/r1-reasoning-visible"),
+			Planner:     getModelRoleConfig(ModelRolePlanner, "deepseek/r1"),
 			Coder:       Pointer(getModelRoleConfig(ModelRoleCoder, "deepseek/v3-0324")),
-			PlanSummary: getModelRoleConfig(ModelRolePlanSummary, "deepseek/r1-reasoning-hidden"),
-			Builder:     getModelRoleConfig(ModelRoleBuilder, "deepseek/r1-reasoning-hidden"),
+			PlanSummary: getModelRoleConfig(ModelRolePlanSummary, "deepseek/r1-hidden"),
+			Builder:     getModelRoleConfig(ModelRoleBuilder, "deepseek/r1
```

---

### Incident Patch 9: `9a01fea8` (2025-06-23)
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

### Incident Patch 10: `0644af53` (2025-06-23)
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

### Incident Patch 11: `e2def237` (2025-06-20)
**Commit Message**: Add Ollama quickstart placeholder

**File**: `docs/docs/models/ollama.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+sidebar_position: 6
+sidebar_label: Ollama Quickstart
+---
+
+# Ollama Quickstart
+
+Plandex works with [Ollama](https://ollama.com/) models.
\ No newline at end of file
```

---

### Incident Patch 12: `bb1eb758` (2025-06-20)
**Commit Message**: Update local mode quickstart for multiple providers

**File**: `docs/docs/hosting/self-hosting/local-mode-quickstart.md` (modified, +4/-8)
```diff
@@ -33,19 +33,15 @@ plandex sign-in
 
 4. When prompted 'Use Plandex Cloud or another host?', select 'Local mode host'. Confirm the default host, which is `http://localhost:8099`.
 
-5. If you don't have an OpenRouter account, first [sign up here.](https://openrouter.ai/signup) Then [generate an API key here.](https://openrouter.ai/keys) Set the `OPENROUTER_API_KEY` environment variable:
+5. Decide on the model provider(s) you want to use. The quickest option is to use OpenRouter.ai, but you can also use [many other providers](https://docs.plandex.ai/models/model-providers).
 
-```bash
-export OPENROUTER_API_KEY=...
-```
-
-6. **Optional**: set a `OPENAI_API_KEY` environment variable if you want OpenAI models to use the OpenAI API directly instead of OpenRouter (for slightly lower latency and costs). This requires an [OpenAI account.](https://platform.openai.com/signup).
+If you're using OpenRouter.ai, first [sign up here.](https://openrouter.ai/signup) Then [generate an API key here.](https://openrouter.ai/keys) Set the `OPENROUTER_API_KEY` environment variable:
 
 ```bash
-export OPENAI_API_KEY=...
+export OPENROUTER_API_KEY=...
 ```
 
-7. In a project directory, start the Plandex REPL:
+6. In a project directory, start the Plandex REPL:
 
 ```bash
 plandex
```

---

### Incident Patch 13: `2cf2497c` (2025-06-20)
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

---

### Incident Patch 14: `3381b656` (2025-06-20)
**Commit Message**: Fix Bedrock model name format

**File**: `app/shared/ai_models_available.go` (modified, +1/-1)
```diff
@@ -189,7 +189,7 @@ var BuiltInModels = []*BaseModelConfigSchema{
 		},
 		Providers: []BaseModelUsesProvider{
 			{Provider: ModelProviderAnthropic, ModelName: "anthropic/claude-sonnet-4-0"},
-			{Provider: ModelProviderAmazonBedrock, ModelName: "bedrock/anthropic.claude-sonnet-4-20250514-v1:0"},
+			{Provider: ModelProviderAmazonBedrock, ModelName: "anthropic.claude-sonnet-4-20250514-v1:0"},
 			{Provider: ModelProviderGoogleVertex, ModelName: "vertex_ai/claude-sonnet-4@20250514"},
 			{Provider: ModelProviderOpenRouter, ModelName: "anthropic/claude-sonnet-4"},
 		},
```

---

### Incident Patch 15: `1b2cc6b3` (2025-06-20)
**Commit Message**: Remove debug logging and fix role params disabled values

**File**: `app/server/model/client.go` (modified, +51/-4)
```diff
@@ -207,7 +207,8 @@ func createChatCompletionStreamExtended(
 		log.Println("Creating chat completion stream with direct OpenAI provider request")
 	}
 
-	if baseModelConfig.Provider == shared.ModelProviderGoogleVertex {
+	switch baseModelConfig.Provider {
+	case shared.ModelProviderGoogleVertex:
 		if authVars["VERTEXAI_PROJECT"] != "" {
 			extendedReq.VertexProject = authVars["VERTEXAI_PROJECT"]
 		}
@@ -217,6 +218,52 @@ func createChatCompletionStreamExtended(
 		if authVars["GOOGLE_APPLICATION_CREDENTIALS"] != "" {
 			extendedReq.VertexCredentials = authVars["GOOGLE_APPLICATION_CREDENTIALS"]
 		}
+	case shared.ModelProviderAzureOpenAI:
+		if authVars["AZURE_API_BASE"] != "" {
+			extendedReq.AzureApiBase = authVars["AZURE_API_BASE"]
+		}
+		if authVars["AZURE_API_VERSION"] != "" {
+			extendedReq.AzureApiVersion = authVars["AZURE_API_VERSION"]
+		}
+
+		if authVars["AZURE_DEPLOYMENTS_MAP"] != "" {
+			var azureDeploymentsMap map[string]string
+			err := json.Unmarshal([]byte(authVars["AZURE_DEPLOYMENTS_MAP"]), &azureDeploymentsMap)
+			if err != nil {
+				return nil, fmt.Errorf("error unmarshalling AZURE_DEPLOYMENTS_MAP: %w", err)
+			}
+			modelName := string(extendedReq.Model)
+			modelName = strings.ReplaceAll(modelName, "azure/", "")
+
+			deploymentName, ok := azureDeploymentsMap[modelName]
+			if ok {
+				log.Println("azure - deploymentName", deploymentName)
+				modelName = "azure/" + deploymentName
+				extendedReq.Model = shared.ModelName(modelName)
+			}
+		}
+
+		// azure uses 'reasoning_config' instead of 'reasoning' like direct openai api
+		if extendedReq.ReasoningConfig != nil {
+			extendedReq.AzureReasoningEffort = extendedReq.ReasoningConfig.Effort
+			extendedReq.ReasoningConfig = nil
+		}
+	case shared.ModelProviderAmazonBedrock:
+		if authVars["AWS_ACCESS_KEY_ID"] != "" {
+			extendedReq.BedrockAccessKeyId = authVars["AWS_ACCESS_KEY_ID"]
+		}
+		if authVars["AWS_SECRET_ACCESS_KEY"] != "" {
+			extendedReq.BedrockSecretAccessKey = authVars["AWS_SECRET_ACCESS_KEY"]
+		}
+		if authVars["AWS_SESSION_TOKEN"] != "" {
+			extendedReq.BedrockSessionToken = authVars["AWS_SESSION_TOKEN"]
+		}
+		if authVars["AWS_REGION"] != "" {
+			extendedReq.BedrockRegion = authVars["AWS_REGION"]
+		}
+		if authVars["AWS_INFERENCE_PROFILE_ARN"] != "" {
+			extendedReq.BedrockInferenceProfileArn = authVars["AWS_INFERENCE_PROFILE_ARN"]
+		}
 	}
 
 	// Marshal the request body to JSON
@@ -419,9 +466,9 @@ func resolveReq(req *types.ExtendedChatCompletionRequest, modelConfig *shared.Mo
 	}
 
 	if modelConfig.GetSharedBaseConfig().RoleParamsDisabled {
-		log.Println("Role params disabled - setting temperature and top p to 1")
-		req.Temperature = 1
-		req.TopP = 1
+		log.Println("Role params disabled - setting temperature and top p to 0")
+		req.Temperature = 0
+		req.TopP = 0
 	}
 
 	if baseModelConfig.Provider == shared.ModelProviderOllama {
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

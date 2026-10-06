# Forensic Learning Record (Deep Inspection): diggerhq/digger

> **Canonical Artifact**: `07_PROJECT_LEARNING/diggerhq-digger-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/diggerhq/digger](https://github.com/diggerhq/digger))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:12:01.886Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `diggerhq/digger`
- **Description**: Digger is an open source IaC orchestration tool. Digger allows you to run IaC in your existing CI pipeline ⚡️  
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5044 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/hooks/hooks.go`
```
package hooks

```

### Core Architecture Module: `backend/middleware/webhook.go`
```
package middleware

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"os"
	"strings"
)

func InternalApiAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		webhookSecret := os.Getenv("DIGGER_INTERNAL_SECRET")
		authHeader := c.Request.Header.Get("Authorization")
		if authHeader == "" {
			c.String(http.StatusForbidden, "No Authorization header provided")
			c.Abort()
			return
		}
		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token != webhookSecret {
			c.String(http.StatusForbidden, "invalid token")
			c.Abort()
			return
		}
		// webhook auth optionally accepts organisation ID as a value
		orgIdHeader := c.GetHeader("X-Digger-Org-ID")
		if orgIdHeader != "" {
			c.Set(ORGANISATION_ID_KEY, orgIdHeader)
		}

		c.Next()
		return
	}
}

```

### Core Architecture Module: `backend/utils/ai.go`
```
package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

func GenerateTerraformCode(appCode string, generationEndpoint string, apiToken string) (string, error) {
	slog.Debug("Generating Terraform code",
		"endpoint", generationEndpoint,
		"codeLength", len(appCode),
	)

	payload := map[string]string{
		"code": appCode,
	}

	// Convert payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		slog.Error("Error marshalling JSON for code generation", "error", err)
		return "", fmt.Errorf("Error marshalling JSON: %v\n", err)
	}

	// Create request
	req, err := http.NewRequest(http.MethodPost, generationEndpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		slog.Error("Error creating request for code generation", "endpoint", generationEndpoint, "error", err)
		return "", fmt.Errorf("Error creating request: %v\n", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiToken)

	// Make the request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		slog.Error("Error making request to code generation API", "endpoint", generationEndpoint, "error", err)
		return "", fmt.Errorf("Error making request: %v\n", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		slog.Error("Error reading code generation API response", "error", err)
		return "", fmt.Errorf("Error reading response: %v\n", err)
	}

	// Handle non-200 responses
	if resp.StatusCode == http.StatusBadRequest {
		slog.Warn("Bad request to code generation API",
			"statusCode", resp.StatusCode,
			"response", string(body),
		)
		return "", fmt.Errorf("unable to generate terraform code from the code available, is it valid application code")
	}

	if resp.StatusCode != http.StatusOK {
		slog.Error("Unexpected error from code generation API",
			"statusCode", resp.StatusCode,
			"response", string(body),
		)
		return "", fmt.Errorf("unexpected error occured while generating code")
	}

	type GeneratorResponse struct {
		Result string `json:"result"`
		Status string `json:"status"`
	}

	var response GeneratorResponse
	err = json.Unmarshal(body, &response)
	if err != nil {
		slog.Error("Unable to parse code generation response", "error", err, "response", string(body))
		return "", fmt.Errorf("unable to parse generator response: %v", err)
	}

	slog.Info("Successfully generated Terraform code",
		"status", response.Status,
		"resultLength", len(response.Result),
	)
	return response.Result, nil
}

func GetAiSummaryFromTerraformPlans(plans string, summaryEndpoint string, apiToken string) (string, error) {
	slog.Debug("Generating AI summary for Terraform plans",
		"endpoint", summaryEndpoint,
		"plansLength", len(plans),
	)

	payload := map[string]string{
		"terraform_plans": plans,
	}

	// Convert payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		slog.Error("Error marshalling JSON for plan summary", "error", err)
		return "", fmt.Errorf("Error marshalling JSON: %v\n", err)
	}

	// Create request
	req, err := http.NewRequest(http.MethodPost, summaryEndpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		slog.Error("Error creating request for plan summary", "endpoint", summaryEndpoint, "error", err)
		return "", fmt.Errorf("Error creating request: %v\n", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiToken)

	// Make the request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		slog.Error("Error making request to summary API", "endpoint", summaryEndpoint, "error", err)
		return "", fmt.Errorf("Error making request: %v\n", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		slog.Error("Error reading summary API response", "error", err)
		return "", fmt.Errorf("Error reading response: %v\n", err)
	}

	// Handle non-200 responses
	if resp.StatusCode == http.StatusBadRequest {
		slog.Warn("Bad request to summary API",
			"statusCode", resp.StatusCode,
			"response", string(body),
		)
		return "", fmt.Errorf("unable to generate summary")
	}

	if resp.StatusCode != http.StatusOK {
		slog.Error("Unexpected error from summary API",
			"statusCode", resp.StatusCode,
			"response", string(body),
		)
		return "", fmt.Errorf("unexpected error occured while generating code")
	}

	type GeneratorResponse struct {
		Result string `json:"result"`
		Status string `json:"status"`
	}

	var response GeneratorResponse
	err = json.Unmarshal(body, &response)
	if err != nil {
		slog.Error("Unable to parse summary response", "error", err, "response", string(body))
		return "", fmt.Errorf("unable to parse generator response: %v", err)
	}

	slog.Info("Successfully generated plan summary",
		"status", response.Status,
		"resultLength", len(response.Result),
	)
	return response.Result, nil
}

```

### Core Architecture Module: `backend/utils/allowlist.go`
```
package utils

import (
	"log/slog"
	"net/url"
	"os"
	"strings"

	"github.com/samber/lo"
)

func ExtractCleanRepoName(gitlabURL string) (string, error) {
	// Parse the URL
	parsedURL, err := url.Parse(gitlabURL)
	if err != nil {
		slog.Error("Failed to parse URL", "url", gitlabURL, "error", err)
		return "", err
	}

	// The repository name is typically the last part of the path
	// We use path.Base to handle cases where there might be a trailing slash
	repoName := parsedURL.Hostname() + parsedURL.Path

	// If the URL ends with .git, remove it
	repoName = strings.TrimSuffix(repoName, ".git")

	slog.Debug("Extracted clean repo name", "originalUrl", gitlabURL, "cleanName", repoName)
	return repoName, nil
}

func IsInRepoAllowList(repoUrl string) bool {
	allowList := os.Getenv("DIGGER_REPO_ALLOW_LIST")
	if allowList == "" {
		slog.Debug("No repo allow list defined, allowing all repos")
		return true
	}

	allowedReposUrls := strings.Split(allowList, ",")
	// gitlab.com/diggerhq/test
	// https://gitlab.com/diggerhq/test

	repoName, err := ExtractCleanRepoName(repoUrl)
	if err != nil {
		slog.Warn("Could not parse repository URL", "url", repoUrl, "error", err)
		return false
	}

	exists := lo.Contains(allowedReposUrls, repoName)
	if exists {
		slog.Debug("Repository is in allow list", "repo", repoName)
	} else {
		slog.Info("Repository is not in allow list", "repo", repoName, "allowList", allowList)
	}

	return exists
}

```

### Core Architecture Module: `backend/utils/base_urls.go`
```
package utils

import (
	"fmt"
	"os"
	"strings"
)

func GetPublicBaseURL() string {
	return getBaseURL("PUBLIC_BASE_URL", "HOSTNAME", "https")
}

func GetInternalBaseURL() string {
	return getBaseURL("INTERNAL_BASE_URL", "HOSTNAME", "http")
}

func getBaseURL(primaryEnv string, fallbackEnv string, defaultScheme string) string {
	// Historically this codebase used HOSTNAME for both public URL generation
	// (for example GitHub App callback/webhook manifest URLs) and internal
	// service-to-self calls. We now prefer explicit PUBLIC_BASE_URL and
	// INTERNAL_BASE_URL, but keep HOSTNAME as a compatibility fallback so older
	// deployments and existing Helm secrets continue to work during migration.
	raw := strings.TrimSpace(os.Getenv(primaryEnv))
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv(fallbackEnv))
	}
	if raw == "" {
		return ""
	}

	raw = strings.TrimRight(raw, "/")
	if strings.Contains(raw, "://") {
		return raw
	}

	return fmt.Sprintf("%s://%s", defaultScheme, raw)
}

```

### Core Architecture Module: `backend/utils/batch_utils.go`
```
package utils

import (
	"fmt"
	"log/slog"

	"github.com/diggerhq/digger/backend/models"
)

func PostCommentForBatch(batch *models.DiggerBatch, comment string, githubClientProvider GithubClientProvider) error {
	slog.Debug("Posting comment for batch",
		"batchId", batch.ID,
		"vcs", batch.VCS,
		"repo", batch.RepoFullName,
		"prNumber", batch.PrNumber,
		"commentLength", len(comment),
	)

	// todo: perform for rest of vcs as well
	if batch.VCS == models.DiggerVCSGithub {
		ghService, _, err := GetGithubService(githubClientProvider, batch.GithubInstallationId, batch.RepoFullName, batch.RepoOwner, batch.RepoName)
		if err != nil {
			slog.Error("Error getting GitHub service",
				"batchId", batch.ID,
				"installationId", batch.GithubInstallationId,
				"repo", batch.RepoFullName,
				"error", err,
			)
			return fmt.Errorf("error getting ghService: %v", err)
		}

		_, err = ghService.PublishComment(batch.PrNumber, comment)
		if err != nil {
			slog.Error("Error publishing comment",
				"batchId", batch.ID,
				"prNumber", batch.PrNumber,
				"repo", batch.RepoFullName,
				"error", err,
			)
			return fmt.Errorf("error publishing comment (%v): %v", comment, err)
		}

		slog.Info("Successfully posted comment",
			"batchId", batch.ID,
			"prNumber", batch.PrNumber,
			"repo", batch.RepoFullName,
		)
		return nil
	}

	slog.Warn("Unknown VCS type, comment not posted",
		"batchId", batch.ID,
		"vcs", batch.VCS,
		"repo", batch.RepoFullName,
		"prNumber", batch.PrNumber,
	)
	return nil
}

```

### Core Architecture Module: `backend/utils/bitbucket.go`
```
package utils

import (
	"fmt"
	"github.com/diggerhq/digger/libs/git_utils"
	"log/slog"
	"net/http"
	"os"
	"path"

	orchestrator_bitbucket "github.com/diggerhq/digger/libs/ci/bitbucket"
	dg_configuration "github.com/diggerhq/digger/libs/digger_config"
	"github.com/dominikbraun/graph"
	"github.com/ktrysmt/go-bitbucket"
)

type BitbucketProvider interface {
	NewClient(token string) (*bitbucket.Client, error)
}

type BitbucketClientProvider struct{}

func (b BitbucketClientProvider) NewClient(token string) (*bitbucket.Client, error) {
	client := bitbucket.NewOAuthbearerToken(token)
	return client, nil
}

func GetBitbucketService(bb BitbucketProvider, token string, repoOwner string, repoName string, prNumber int) (*orchestrator_bitbucket.BitbucketAPI, error) {
	slog.Debug("Creating Bitbucket service",
		slog.Group("repository",
			slog.String("owner", repoOwner),
			slog.String("name", repoName),
		),
		"prNumber", prNumber,
	)

	//token := os.Getenv("DIGGER_BITBUCKET_ACCESS_TOKEN")

	//client, err := bb.NewClient(token)
	//if err != nil {
	//	return nil, fmt.Errorf("could not get bitbucket client: %v", err)
	//}
	//context := orchestrator_bitbucket.BitbucketContext{
	//	RepositoryName:     repoName,
	//	RepositoryFullName: repoFullName,
	//	PullRequestID:      &prNumber,
	//}
	service := orchestrator_bitbucket.BitbucketAPI{
		AuthToken:     token,
		RepoWorkspace: repoOwner,
		RepoName:      repoName,
		HttpClient:    http.Client{},
	}
	return &service, nil
}

func GetDiggerConfigForBitbucketBranch(bb BitbucketProvider, token string, repoFullName string, repoOwner string, repoName string, cloneUrl string, branch string, prNumber int) (string, *dg_configuration.DiggerConfig, graph.Graph[string, dg_configuration.Project], error) {
	slog.Info("Getting Digger config for Bitbucket branch",
		slog.Group("repository",
			slog.String("fullName", repoFullName),
			slog.String("owner", repoOwner),
			slog.String("name", repoName),
			slog.String("cloneUrl", cloneUrl),
		),
		"branch", branch,
		"prNumber", prNumber,
	)

	service, err := GetBitbucketService(bb, token, repoOwner, repoName, prNumber)
	if err != nil {
		slog.Error("Could not get Bitbucket service",
			"repoFullName", repoFullName,
			"error", err,
		)
		return "", nil, nil, fmt.Errorf("could not get bitbucket service: %v", err)
	}

	var config *dg_configuration.DiggerConfig
	var diggerYmlStr string
	var dependencyGraph graph.Graph[string, dg_configuration.Project]

	changedFiles, err := service.GetChangedFiles(prNumber)
	if err != nil {
		slog.Error("Error getting changed files",
			"repoFullName", repoFullName,
			"prNumber", prNumber,
			"error", err,
		)
		return "", nil, nil, fmt.Errorf("error getting changed files")
	}

	slog.Debug("Retrieved changed files",
		"repoFullName", repoFullName,
		"prNumber", prNumber,
		"changedFilesCount", len(changedFiles),
	)

	err = git_utils.CloneGitRepoAndDoActionWithConfig(cloneUrl, branch, "", token, "x-token-auth", service.ReadRepositoryFile, func(dir string) error {
		diggerYmlPath := path.Join(dir, "digger.yml")
		diggerYmlBytes, err := os.ReadFile(diggerYmlPath)
		if err != nil {
			slog.Error("Error reading digger.yml file",
				"path", diggerYmlPath,
				"error", err,
			)
			return fmt.Errorf("error reading digger.yml: %w", err)
		}

		diggerYmlStr = string(diggerYmlBytes)
		config, _, dependencyGraph, _, err = dg_configuration.LoadDiggerConfig(dir, true, changedFiles, nil)
		if err != nil {
			slog.Error("Error loading Digger config",
				"repoFullName", repoFullName,
				"dir", dir,
				"error", err,
			)
			return err
		}
		return nil
	})

	if err != nil {
		slog.Error("Error cloning and loading config",
			"repoFullName", repoFullName,
			"branch", branch,
			"error", err,
		)
		return "", nil, nil, fmt.Errorf("error cloning and loading config")
	}

	projectCount := 0
	if config != nil {
		projectCount = len(config.Projects)
	}

	slog.Info("Digger config loaded successfully",
		"repoFullName", repoFullName,
		"projectCount", projectCount,
	)

	return diggerYmlStr, config, dependencyGraph, nil
}

```

### Core Architecture Module: `backend/utils/comment_utils.go`
```
package utils

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"runtime/debug"
	"strconv"

	"github.com/diggerhq/digger/backend/models"
	"github.com/diggerhq/digger/libs/ci"
	orchestrator_scheduler "github.com/diggerhq/digger/libs/scheduler"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

// UpdatePRCommentRealtime updates the GitHub PR comment with current job statuses
func UpdatePRCommentRealtime(gh GithubClientProvider, batch *models.DiggerBatch) error {
	slog.Debug("Updating PR comment with real-time job statuses", "batchId", batch.ID, "prNumber", batch.PrNumber)

	// Get PR service for this batch
	prService, err := GetPrServiceFromBatch(batch, gh)
	if err != nil {
		slog.Error("Error getting PR service for real-time comment update", "batchId", batch.ID, "error", err)
		return fmt.Errorf("error getting PR service: %v", err)
	}

	// Get all jobs for this batch (initial check)
	jobs, err := models.DB.GetDiggerJobsForBatch(batch.ID)
	if err != nil {
		slog.Error("Error getting jobs for batch", "batchId", batch.ID, "error", err)
		return fmt.Errorf("error getting jobs for batch: %v", err)
	}

	if len(jobs) == 0 {
		slog.Debug("No jobs found for batch", "batchId", batch.ID)
		return nil
	}

	// Requery database immediately before generating comment to get latest job statuses and batch data
	// This minimizes race conditions where job statuses or batch data might change between queries
	slog.Debug("Requerying jobs and batch for latest status before comment generation", "batchId", batch.ID)
	
	// Get fresh batch data
	freshBatch, err := models.DB.GetDiggerBatch(&batch.ID)
	if err != nil {
		slog.Error("Error requerying batch", "batchId", batch.ID, "error", err)
		return fmt.Errorf("error requerying batch: %v", err)
	}
	
	// Get fresh job data
	freshJobs, err := models.DB.GetDiggerJobsForBatch(batch.ID)
	if err != nil {
		slog.Error("Error requerying jobs for batch", "batchId", freshBatch.ID, "error", err)
		return fmt.Errorf("error requerying jobs for batch: %v", err)
	}

	if freshBatch.CommentId == nil {
		slog.Debug("No comment id found for batch, not updating", "batchId", batch.ID)
		return nil
	}

	if len(freshJobs) == 0 {
		slog.Debug("No jobs found after requery", "batchId", freshBatch.ID)
		return nil
	}

	// Generate comment message with fresh job data
	message, err := GenerateRealtimeCommentMessage(freshJobs, freshBatch.BatchType)
	if err != nil {
		slog.Error("Error generating real-time comment message", "batchId", freshBatch.ID, "error", err)
		return fmt.Errorf("error generating comment message: %v", err)
	}

	// Update or create the summary comment using fresh batch data
	commentId, err := UpdateOrCreateSummaryComment(prService, freshBatch, message)
	if err != nil {
		slog.Error("Error updating real-time summary comment", "batchId", freshBatch.ID, "error", err)
		return fmt.Errorf("error updating summary comment: %v", err)
	}

	// Update batch with comment ID if it was newly created (using fresh batch data)
	if freshBatch.CommentId == nil && commentId != nil {
		freshBatch.CommentId = commentId
		err = models.DB.GormDB.Save(&freshBatch).Error
		if err != nil {
			slog.Error("Error saving comment ID to batch", "batchId", freshBatch.ID, "commentId", commentId, "error", err)
			return fmt.Errorf("error saving comment ID to batch: %v", err)
		}
	}

	slog.Debug("Successfully updated real-time PR comment", "batchId", freshBatch.ID, "prNumber", freshBatch.PrNumber, "commentId", commentId)
	return nil
}

// UpdatePRComment updates the PR comment for a job status change
func UpdatePRComment(gh GithubClientProvider, jobId string, job *models.DiggerJob, status string) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("Recovered from panic in UpdatePRComment goroutine", 
				"jobId", jobId, 
				"status", status, 
				"error", r,
				"stack", string(debug.Stack()),
			)
		}
	}() 	

	err := UpdatePRCommentRealtime(gh, job.Batch)
	if err != nil {
		slog.Warn("Failed to update PR comment for job",
			"jobId", jobId,
			"batchId", job.Batch.ID,
			"status", status,
			"error", err,
		)
	}
}

// GenerateRealtimeCommentMessage creates the markdown table for real-time PR comments
// This matches the exact format used by the CLI's BasicCommentUpdater
func GenerateRealtimeCommentMessage(jobs []models.DiggerJob, batchType orchestrator_scheduler.DiggerCommand) (string, error) {
	if len(jobs) == 0 {
		return "", fmt.Errorf("no jobs provided")
	}

	jobTypeTitle := cases.Title(language.AmericanEnglish).String(string(batchType))

	// Match exact CLI format - no header, just the table
	message := ""
	message += fmt.Sprintf("| Project | Status | %s | + | ~ | - |\n", jobTypeTitle)
	message += fmt.Sprintf("|---------|--------|------|---|---|---|\n")

	for _, job := range jobs {
		prCommentUrl := job.PRCommentUrl
		if prCommentUrl == "" {
			prCommentUrl = "#"
		}

		// Safe handling of WorkflowRunUrl pointer

		var checkRunUrl = "#"
		if job.CheckRunUrl != nil {
			checkRunUrl = *job.CheckRunUrl
		}

		workflowRunUrl := "#"
		if job.WorkflowRunUrl != nil {
			workflowRunUrl = *job.WorkflowRunUrl
		}

		// Get project name from job spec
		var jobSpec orchestrator_scheduler.JobJson
		projectDisplayName := "Unknown"
		if job.SerializedJobSpec != nil {
			err := json.Unmarshal(job.SerializedJobSpec, &jobSpec)
			if err == nil {
				// Use alias if available, fallback to project name
				if jobSpec.ProjectAlias != "" {
					projectDisplayName = jobSpec.ProjectAlias
				} else {
					projectDisplayName = jobSpec.ProjectName
				}
			} else {
				slog.Warn("Failed to unmarshal job spec for project name", 
					"jobId", job.DiggerJobID, 
					"error", err)
			}
		}

		// Default resource counts to 0 if DiggerJobSummary is nil
		resourcesCreated := uint(0)
		resourcesUpdated := uint(0)
		resourcesDeleted := uint(0)
		
		// Only access DiggerJobSummary fields if it's not nil
		if job.DiggerJobSummary.ID != 0 {
			resourcesCreated = job.DiggerJobSummary.ResourcesCreated
			resourcesUpdated = job.DiggerJobSummary.ResourcesUpdated
			resourcesDeleted = job.DiggerJobSummary.ResourcesDeleted
		}
		
		// Match exact CLI format: |emoji **project** |<a href='workflow'>status</a> | <a href='comment'>jobType</a> | + | ~ | - |
		message += fmt.Sprintf("|%s **%s** |<a href='%s'>%s</a> | <a href='%s'>%s</a> | %d | %d | %d|\n",
			job.Status.ToEmoji(),
			projectDisplayName,
			workflowRunUrl,
			job.Status.ToString(),
			checkRunUrl,
			jobTypeTitle,
			resourcesCreated,
			resourcesUpdated,
			resourcesDeleted)
	}

	// Add instruction helpers (same as CLI)
	message += "\n" + formatExampleCommands()

	// Handle comment length limits
	const GithubCommentMaxLength = 65536
	if len(message) > GithubCommentMaxLength {
		slog.Warn("Comment message too long, trimming", "originalLength", len(message), "maxLength", GithubCommentMaxLength)
		const footer = "\n\n[Message truncated due to length limits]"
		trimLength := len(message) - GithubCommentMaxLength + len(footer)
		message = message[:len(message)-trimLength] + footer
		slog.Debug("Trimmed comment message", "newLength", len(message))
	}

	return message, nil
}

// formatExampleCommands creates a collapsible markdown section with example commands
// This matches the exact format used by the CLI's BasicCommentUpdater
func formatExampleCommands() string {
	return `
<details>
  <summary>Instructions</summary>

⏩ To apply these changes, run the following command:

` + "```" + `bash
digger apply
` + "```" + `

🚮 To unlock the projects in this PR run the following command:
` + "```" + `bash
digger unlock
` + "```" + `
</details>
`
}

// UpdateOrCreateSummaryComment updates or creates the summary comment for the batch
func UpdateOrCreateSummaryComment(prService ci.PullRequestService, batch *models.DiggerBatch, message string) (*int64, error) {
	if batch.CommentId != nil {
		// Update existing comment
		commentIdStr := strconv.FormatInt(*batch.CommentId, 10)
		err := prService.EditComment(batch.PrNumber, commentIdStr, message)
		if err != nil {
			slog.Warn("Failed to update existing comment, will create new one", "commentId", *batch.CommentId, "prNumber", batch.PrNumber, "error", err)
			// Fall through to create new comment
		} else {
			slog.Debug("Successfully updated existing comment", "commentId", *batch.CommentId, "prNumber", batch.PrNumber)
			return batch.CommentId, nil
		}
	}

	// Create new comment
	comment, err := prService.PublishComment(batch.PrNumber, message)
	if err != nil {
		slog.Error("Failed to create new comment", "prNumber", batch.PrNumber, "error", err)
		return nil, fmt.Errorf("failed to create comment: %v", err)
	}

	commentId, err := strconv.ParseInt(comment.Id, 10, 64)
	if err != nil {
		slog.Error("Failed to parse comment ID", "commentIdStr", comment.Id, "error", err)
		return nil, fmt.Errorf("failed to parse comment ID: %v", err)
	}

	slog.Debug("Successfully created new comment", "commentId", commentId, "prNumber", batch.PrNumber)
	return &commentId, nil
}

// GetPrServiceFromBatch gets the appropriate PR service for a batch
func GetPrServiceFromBatch(batch *models.DiggerBatch, gh GithubClientProvider) (ci.PullRequestService, error) {
	slog.Debug("Getting PR service for batch",
		"batchId", batch.ID,
		"vcs", batch.VCS,
		"prNumber", batch.PrNumber,
	)

	switch batch.VCS {
	case "github":
		slog.Debug("Using GitHub service for batch",
			"batchId", batch.ID,
			"installationId", batch.GithubInstallationId,
			"repoFullName", batch.RepoFullName,
		)

		service, _, err := GetGithubService(
			gh,
			batch.GithubInstallationId,
			batch.RepoFullName,
			batch.RepoOwner,
			batch.RepoName,
		)

		if err != nil {
			slog.Error("Error getting GitHub service",
				"batchId", batch.ID,
				"repoFullName", batch.RepoFullName,
				"error", err,
			)
		} else {
			slog.Debug("Successfully got GitHub service",
				"batchId", batch.ID,
				"repoFullName", batch.RepoFullName,
			)
		}

		return service, err

	case "gitlab":
		slog.Debug("Using GitLab service for batch",
			"
```

### Core Architecture Module: `backend/utils/crypt.go`
```
package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"

	"github.com/diggerhq/digger/backend/models"
)

// Encrypt encrypts a plaintext string using AES-256-GCM
func AESEncrypt(key []byte, plaintext string) (string, error) {
	// Create cipher block
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher block: %v", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %v", err)
	}

	// Create nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to create nonce: %v", err)
	}

	// Encrypt data
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)

	// Return base64 encoded string
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts a base64 encoded ciphertext using AES-256-GCM
func AESDecrypt(key []byte, encodedCiphertext string) (string, error) {
	// Decode base64 string
	ciphertext, err := base64.StdEncoding.DecodeString(encodedCiphertext)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %v", err)
	}

	// Create cipher block
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher block: %v", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %v", err)
	}

	// Extract nonce size
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	// Split nonce and ciphertext
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	// Decrypt data
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %v", err)
	}

	return string(plaintext), nil
}

// represents a decrypted record
type DecryptedVCSConnection struct {
	GithubId               int64
	ClientID               string
	ClientSecret           string
	WebhookSecret          string
	PrivateKey             string
	PrivateKeyBase64       string
	Org                    string
	Name                   string
	GithubAppUrl           string
	OrganisationID         uint
	BitbucketAccessToken   string
	BitbucketWebhookSecret string
}

func DecryptConnection(g *models.VCSConnection, key []byte) (*DecryptedVCSConnection, error) {
	// Create decrypted version
	decrypted := &DecryptedVCSConnection{
		GithubId:       g.GithubId,
		ClientID:       g.ClientID,
		Org:            g.Org,
		Name:           g.Name,
		GithubAppUrl:   g.GithubAppUrl,
		OrganisationID: g.OrganisationID,
	}

	// Decrypt ClientSecret
	if g.ClientSecretEncrypted != "" {
		clientSecret, err := AESDecrypt(key, g.ClientSecretEncrypted)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt client secret: %w", err)
		}
		decrypted.ClientSecret = clientSecret
	}

	// Decrypt WebhookSecret
	if g.WebhookSecretEncrypted != "" {
		webhookSecret, err := AESDecrypt(key, g.WebhookSecretEncrypted)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt webhook secret: %w", err)
		}
		decrypted.WebhookSecret = webhookSecret
	}

	// Decrypt PrivateKey
	if g.PrivateKeyEncrypted != "" {
		privateKey, err := AESDecrypt(key, g.PrivateKeyEncrypted)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt private key: %w", err)
		}
		decrypted.PrivateKey = privateKey
	}

	// Decrypt PrivateKeyBase64
	if g.PrivateKeyBase64Encrypted != "" {
		privateKeyBase64, err := AESDecrypt(key, g.PrivateKeyBase64Encrypted)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt private key base64: %w", err)
		}
		decrypted.PrivateKeyBase64 = privateKeyBase64
	}

	if g.BitbucketAccessTokenEncrypted != "" {
		bitbucketAccessToken, err := AESDecrypt(key, g.BitbucketAccessTokenEncrypted)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt private key base64: %w", err)
		}
		decrypted.BitbucketAccessToken = bitbucketAccessToken
	}

	if g.BitbucketWebhookSecretEncrypted != "" {
		bitbucketWebhookSecret, err := AESDecrypt(key, g.BitbucketWebhookSecretEncrypted)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt private key base64: %w", err)
		}
		decrypted.BitbucketWebhookSecret = bitbucketWebhookSecret
	}

	return decrypted, nil
}

```

### Core Architecture Module: `backend/utils/github.go`
```
package utils

import (
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	net "net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/bradleyfalzon/ghinstallation/v2"
	"github.com/diggerhq/digger/backend/models"
	"github.com/diggerhq/digger/libs/ci"
	github2 "github.com/diggerhq/digger/libs/ci/github"
	"github.com/diggerhq/digger/libs/scheduler"
	"github.com/google/go-github/v61/github"
)

// just a wrapper around github client to be able to use mocks
type DiggerGithubRealClientProvider struct {
}

type DiggerGithubClientMockProvider struct {
	MockedHTTPClient *net.Client
}

type GithubClientProvider interface {
	NewClient(netClient *net.Client) (*github.Client, error)
	Get(githubAppId int64, installationId int64) (*github.Client, *string, error)
	FetchCredentials(githubAppId string) (string, string, string, string, error)
}

func (gh DiggerGithubRealClientProvider) NewClient(netClient *net.Client) (*github.Client, error) {
	ghClient := github.NewClient(netClient)
	return ghClient, nil
}

func (gh DiggerGithubRealClientProvider) Get(githubAppId int64, installationId int64) (*github.Client, *string, error) {
	slog.Debug("Getting GitHub client",
		"githubAppId", githubAppId,
		"installationId", installationId,
	)

	githubAppPrivateKey := ""
	githubAppPrivateKeyB64 := os.Getenv("GITHUB_APP_PRIVATE_KEY_BASE64")
	if githubAppPrivateKeyB64 != "" {
		decodedBytes, err := base64.StdEncoding.DecodeString(githubAppPrivateKeyB64)
		if err != nil {
			slog.Error("Failed to decode GITHUB_APP_PRIVATE_KEY_BASE64", "error", err)
			return nil, nil, fmt.Errorf("error initialising github app installation: please set GITHUB_APP_PRIVATE_KEY_BASE64 env variable\n")
		}
		githubAppPrivateKey = string(decodedBytes)
	} else {
		githubAppPrivateKey = os.Getenv("GITHUB_APP_PRIVATE_KEY")
		if githubAppPrivateKey != "" {
			slog.Warn("GITHUB_APP_PRIVATE_KEY will be deprecated in future releases, please use GITHUB_APP_PRIVATE_KEY_BASE64 instead")
		} else {
			slog.Error("Missing GitHub app private key", "required", "GITHUB_APP_PRIVATE_KEY_BASE64")
			return nil, nil, fmt.Errorf("error initialising github app installation: please set GITHUB_APP_PRIVATE_KEY_BASE64 env variable\n")
		}
	}

	tr := net.DefaultTransport
	itr, err := ghinstallation.New(tr, githubAppId, installationId, []byte(githubAppPrivateKey))
	if err != nil {
		slog.Error("Failed to initialize GitHub app installation",
			"githubAppId", githubAppId,
			"installationId", installationId,
			"error", err,
		)
		return nil, nil, fmt.Errorf("error initialising github app installation: %v\n", err)
	}

	token, err := itr.Token(context.Background())
	if err != nil {
		slog.Error("Failed to get GitHub app token",
			"githubAppId", githubAppId,
			"installationId", installationId,
			"error", err,
		)
		return nil, nil, fmt.Errorf("error initialising git app token: %v\n", err)
	}

	clientWithLogging := &net.Client{
		Transport: &LoggingRoundTripper{Rt: itr},
	}

	ghClient, err := gh.NewClient(clientWithLogging)
	if err != nil {
		slog.Error("Failed to create GitHub client", "error", err)
		return nil, nil, fmt.Errorf("error creating new client: %v", err)
	}

	slog.Debug("Successfully obtained GitHub client and token",
		"githubAppId", githubAppId,
		"installationId", installationId,
	)

	return ghClient, &token, nil
}

func (gh DiggerGithubRealClientProvider) FetchCredentials(githubAppId string) (string, string, string, string, error) {
	clientId := os.Getenv("GITHUB_APP_CLIENT_ID")
	clientSecret := os.Getenv("GITHUB_APP_CLIENT_SECRET")
	webhookSecret := os.Getenv("GITHUB_WEBHOOK_SECRET")
	privateKeyb64 := os.Getenv("GITHUB_APP_PRIVATE_KEY_BASE64")
	return clientId, clientSecret, webhookSecret, privateKeyb64, nil
}

func (gh DiggerGithubClientMockProvider) NewClient(netClient *net.Client) (*github.Client, error) {
	ghClient := github.NewClient(gh.MockedHTTPClient)
	return ghClient, nil
}

func (gh DiggerGithubClientMockProvider) Get(githubAppId int64, installationId int64) (*github.Client, *string, error) {
	ghClient, _ := gh.NewClient(gh.MockedHTTPClient)
	token := "token"
	return ghClient, &token, nil
}

func (gh DiggerGithubClientMockProvider) FetchCredentials(githubAppId string) (string, string, string, string, error) {
	return "clientId", "clientSecret", "", "", nil
}

func GetGithubClient(gh GithubClientProvider, installationId int64, repoFullName string) (*github.Client, *string, error) {
	installation, err := models.DB.GetGithubAppInstallationByIdAndRepo(installationId, repoFullName)
	if err != nil {
		slog.Error("Failed to get GitHub installation",
			"installationId", installationId,
			"repoFullName", repoFullName,
			"error", err,
		)
		return nil, nil, fmt.Errorf("Error getting installation: %v", err)
	}

	ghClient, token, err := gh.Get(installation.GithubAppId, installation.GithubInstallationId)
	return ghClient, token, err
}

func GetGithubClientFromAppId(gh GithubClientProvider, installationId int64, githubAppId int64, repoFullName string) (*github.Client, *string, error) {
	ghClient, token, err := gh.Get(githubAppId, installationId)
	return ghClient, token, err
}

func GetGithubService(gh GithubClientProvider, installationId int64, repoFullName string, repoOwner string, repoName string) (*github2.GithubService, *string, error) {
	ghClient, token, err := GetGithubClient(gh, installationId, repoFullName)
	if err != nil {
		slog.Error("Failed to create GitHub client",
			"installationId", installationId,
			"repoFullName", repoFullName,
			"error", err,
		)
		return nil, nil, fmt.Errorf("Error creating github app client: %v", err)
	}

	ghService := github2.GithubService{
		Client:   ghClient,
		RepoName: repoName,
		Owner:    repoOwner,
	}

	slog.Debug("Created GitHub service",
		"owner", repoOwner,
		"repoName", repoName,
	)

	return &ghService, token, nil
}

func SetPRCommitStatusForJobs(prService ci.PullRequestService, prNumber int, jobs []scheduler.Job) error {
	slog.Info("Setting PR status for jobs",
		"prNumber", prNumber,
		"jobCount", len(jobs),
	)

	for _, job := range jobs {
		for _, command := range job.Commands {
			var err error
			switch command {
			case "digger plan":
				slog.Debug("Setting PR status for plan",
					"prNumber", prNumber,
					"project", job.ProjectName,
				)
				err = prService.SetStatus(prNumber, "pending", job.GetProjectAlias()+"/plan")
			case "digger apply":
				slog.Debug("Setting PR status for apply",
					"prNumber", prNumber,
					"project", job.ProjectName,
				)
				err = prService.SetStatus(prNumber, "pending", job.GetProjectAlias()+"/apply")
			}
			if err != nil {
				slog.Error("Failed to set PR status",
					"prNumber", prNumber,
					"project", job.ProjectName,
					"command", command,
					"error", err,
				)
				return fmt.Errorf("Error setting pr status: %v", err)
			}
		}
	}

	// Report aggregate status for digger/plan or digger/apply
	if len(jobs) > 0 {
		var err error
		if scheduler.IsPlanJobs(jobs) {
			slog.Debug("Setting aggregate plan status", "prNumber", prNumber)
			err = prService.SetStatus(prNumber, "pending", "digger/plan")
		} else {
			slog.Debug("Setting aggregate apply status", "prNumber", prNumber)
			err = prService.SetStatus(prNumber, "pending", "digger/apply")
		}
		if err != nil {
			slog.Error("Failed to set aggregate PR status",
				"prNumber", prNumber,
				"error", err,
			)
			return fmt.Errorf("error setting pr status: %v", err)
		}
	} else {
		slog.Debug("Setting success status for empty job list", "prNumber", prNumber)

		err := prService.SetStatus(prNumber, "success", "digger/plan")
		if err != nil {
			slog.Error("Failed to set success plan status", "prNumber", prNumber, "error", err)
			return fmt.Errorf("error setting pr status: %v", err)
		}

		err = prService.SetStatus(prNumber, "success", "digger/apply")
		if err != nil {
			slog.Error("Failed to set success apply status", "prNumber", prNumber, "error", err)
			return fmt.Errorf("error setting pr status: %v", err)
		}
	}

	slog.Info("Successfully set PR status", "prNumber", prNumber)
	return nil
}

func GetCheckDetailedUrl(checkRunId int64, repoOwner string, repoName string, prNumber int) string {
	githubHostname := os.Getenv("DIGGER_GITHUB_HOSTNAME")
	if githubHostname == "" {
		githubHostname = "github.com"
	}
	url := fmt.Sprintf(
		"https://%v/%s/%s/pull/%d/checks?check_run_id=%d", githubHostname, repoOwner, repoName, prNumber, checkRunId,
	)
	return url
}

// Checks are the more modern github way as opposed to "commit status"
// With checks you also get to set a page representing content of the check
func SetPRCheckForJobs(ghService *github2.GithubService, prNumber int, jobs []scheduler.Job, commitSha string, repoName string, repoOwner string) (*CheckRunData, map[string]CheckRunData, error) {
	slog.Info("commitSha", "commitsha", commitSha)
	slog.Info("Setting PR status for jobs",
		"prNumber", prNumber,
		"jobCount", len(jobs),
		"commitSha", commitSha,
	)
	var batchCheckRunId CheckRunData
	var jobCheckRunIds = make(map[string]CheckRunData)

	for _, job := range jobs {
		for _, command := range job.Commands {
			var cr *github.CheckRun
			var err error
			switch command {
			case "digger plan":
				slog.Debug("Setting PR status for plan",
					"prNumber", prNumber,
					"project", job.ProjectName,
				)
				var actions []*github.CheckRunAction
				cr, err = ghService.CreateCheckRun(job.GetProjectAlias()+"/plan", "in_progress", "", "Waiting for plan...", "", "Plan result will appear here", commitSha, actions)
				if err != nil {
					slog.Error("Failed to create check run for plan",
						"prNumber", prNumber,
						"project", job.ProjectName,
						"error", err,
					)
					return nil, nil, fmt.Errorf("Error setting pr status: %v", err)
				}
				jobCheckRunIds[job.ProjectName] = CheckRunData{
					Id: strconv.FormatInt(*cr.ID, 10),
					Url: GetCheckDetailedUrl(*cr.ID, repoOwner, repoName, prNumber),
				}

			case "digger apply":
				slog.Debug("Setting PR status for apply",
					"prNumber", prNumber,
					"project", jo
```

### Core Architecture Module: `backend/utils/github_types.go`
```
package utils

type CheckRunData struct {
	Id string
	Url string
}
```

### Core Architecture Module: `backend/utils/gitlab.go`
```
package utils

import (
	"fmt"
	"github.com/diggerhq/digger/libs/git_utils"
	"log/slog"
	"os"
	"path"

	orchestrator_gitlab "github.com/diggerhq/digger/libs/ci/gitlab"
	dg_configuration "github.com/diggerhq/digger/libs/digger_config"
	"github.com/dominikbraun/graph"
	"github.com/xanzy/go-gitlab"
)

type GitlabProvider interface {
	NewClient(token string) (*gitlab.Client, error)
}

type GitlabClientProvider struct{}

func (g GitlabClientProvider) NewClient(token string) (*gitlab.Client, error) {
	baseUrl := os.Getenv("DIGGER_GITLAB_BASE_URL")
	if baseUrl == "" {
		slog.Debug("Creating GitLab client with default base URL")
		client, err := gitlab.NewClient(token)
		return client, err
	} else {
		slog.Debug("Creating GitLab client with custom base URL", "baseUrl", baseUrl)
		client, err := gitlab.NewClient(token, gitlab.WithBaseURL(baseUrl))
		return client, err
	}
}

func GetGitlabService(gh GitlabProvider, projectId int, repoName string, repoFullName string, prNumber int, discussionId string) (*orchestrator_gitlab.GitLabService, error) {
	slog.Debug("Getting GitLab service",
		slog.Group("repository",
			slog.String("name", repoName),
			slog.String("fullName", repoFullName),
			slog.Int("projectId", projectId),
		),
		"prNumber", prNumber,
		"discussionId", discussionId,
	)

	token := os.Getenv("DIGGER_GITLAB_ACCESS_TOKEN")

	client, err := gh.NewClient(token)
	if err != nil {
		slog.Error("Failed to create GitLab client", "error", err)
		return nil, fmt.Errorf("could not get gitlab client: %v", err)
	}

	context := orchestrator_gitlab.GitLabContext{
		ProjectName:      repoName,
		ProjectNamespace: repoFullName,
		ProjectId:        &projectId,
		MergeRequestIId:  &prNumber,
		DiscussionID:     discussionId,
	}

	service := orchestrator_gitlab.GitLabService{Client: client, Context: &context}
	slog.Debug("Successfully created GitLab service",
		"projectId", projectId,
		"repoName", repoName,
	)

	return &service, nil
}

func GetDiggerConfigForBranchGitlab(gh GitlabProvider, projectId int, repoFullName string, repoOwner string, repoName string, cloneUrl string, branch string, prNumber int, discussionId string) (string, *dg_configuration.DiggerConfig, graph.Graph[string, dg_configuration.Project], error) {
	slog.Info("Getting Digger config for GitLab branch",
		slog.Group("repository",
			slog.String("fullName", repoFullName),
			slog.String("owner", repoOwner),
			slog.String("name", repoName),
			slog.Int("projectId", projectId),
			slog.String("cloneUrl", cloneUrl),
		),
		"branch", branch,
		"prNumber", prNumber,
		"discussionId", discussionId,
	)

	token := os.Getenv("DIGGER_GITLAB_ACCESS_TOKEN")

	service, err := GetGitlabService(gh, projectId, repoName, repoFullName, prNumber, discussionId)
	if err != nil {
		slog.Error("Failed to get GitLab service",
			"projectId", projectId,
			"repoFullName", repoFullName,
			"error", err,
		)
		return "", nil, nil, fmt.Errorf("could not get gitlab service: %v", err)
	}

	var config *dg_configuration.DiggerConfig
	var diggerYmlStr string
	var dependencyGraph graph.Graph[string, dg_configuration.Project]

	changedFiles, err := service.GetChangedFiles(prNumber)
	if err != nil {
		slog.Error("Failed to get changed files",
			"projectId", projectId,
			"prNumber", prNumber,
			"error", err,
		)
		return "", nil, nil, fmt.Errorf("error getting changed files")
	}

	slog.Debug("Retrieved changed files",
		"projectId", projectId,
		"prNumber", prNumber,
		"changedFilesCount", len(changedFiles),
	)

	err = git_utils.CloneGitRepoAndDoActionWithConfig(cloneUrl, branch, "", token, "", service.ReadRepositoryFile, func(dir string) error {
		diggerYmlPath := path.Join(dir, "digger.yml")
		diggerYmlBytes, err := os.ReadFile(diggerYmlPath)
		if err != nil {
			slog.Error("Failed to read digger.yml file",
				"path", diggerYmlPath,
				"error", err,
			)
			return fmt.Errorf("error reading digger.yml: %w", err)
		}

		diggerYmlStr = string(diggerYmlBytes)
		slog.Debug("Read digger.yml file",
			"repoFullName", repoFullName,
			"configLength", len(diggerYmlStr),
		)

		config, _, dependencyGraph, _, err = dg_configuration.LoadDiggerConfig(dir, true, changedFiles, nil)
		if err != nil {
			slog.Error("Failed to load Digger config",
				"projectId", projectId,
				"dir", dir,
				"error", err,
			)
			return err
		}
		return nil
	})

	if err != nil {
		slog.Error("Failed to clone and load config",
			"projectId", projectId,
			"branch", branch,
			"error", err,
		)
		return "", nil, nil, fmt.Errorf("error cloning and loading config")
	}

	projectCount := 0
	if config != nil {
		projectCount = len(config.Projects)
	}

	slog.Info("Digger config loaded successfully",
		"projectId", projectId,
		"projectCount", projectCount,
	)

	return diggerYmlStr, config, dependencyGraph, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1431** (2024-06-02): **Selective apply broken**
  *Symptoms*: looks like `digger apply -p xxxx` command no longer works with orchestator backend
  **Post-Mortem & Fix Analysis**:
  > fixed in #1512 

- **Issue #1409** (2024-05-01): **GOOGLE_STORAGE_BUCKET overridden by upload-plan-destination-gcp-bucket**
  *Symptoms*: Set GOOGLE_STORAGE_BUCKET env var in Actions Expected: GOOGLE_STORAGE_BUCKET env variable is available Actual: ``` 08:59:08 locking.go:288: Using GCP lock provider. 08:59:08 root.go:114: Failed to create lock provider. GOOGLE_STORAGE_BUCKET is not set Error: Process completed with exit code 2. ```  It's being overriden by the digger input upload-plan-destination-gcp-bucket, which is empty - so GOOGLE_STORAGE_BUCKET is effectively unset  Reported by user N.S.

- **Issue #1133** (2024-04-15): **Drift-detection mode isn't paying attention to the `aws_role_to_assume` config**
  *Symptoms*: User Feedback:  >Running in drift-detection mode does not assume an AWS role so drift-detection is failing for me currently.  From user K.B
  **Post-Mortem & Fix Analysis**:
  > If reading this correctly for this one: https://github.com/diggerhq/digger/blob/622f43a008901edf60f3fe432d3baf01acd5ff69/cli/cmd/digger/main.go#L259-L273  We're creating the job definition but we don't appear to be passing on the per job behavior the ``` 		StateEnvProvider:    		CommandEnvProvider:  ```  Looking a bit further at the scoped info we have in projectConfig. Per project definition in the projects we would have: 	AwsRoleToAssume    *AssumeRoleForProject  which is a pointer to   ``` type AssumeRoleForProject struct { 	State   string 	Command string } ```  Ultimately we need to get the right info for the stateenvProvider and commandenvprovider, and from others we see that its a call:  ``` GetProviderFromRole(<string>) ```  So would this be as simple as  ```  StateEnvProvider: GetProviderFromRole(projectConfig.AwsRoleToAssume.state) CommandEnvProvider: GetProviderFromRole(projectConfig.AwsRoleToAssume.command) ``` with requisite import for the a
  > certian there's a reason for it, but for mutli project work/behaivors there is also  orchestrator.JsonToJob(job) which would add/include the needed behaviors/properties, and its not used in the manual or drift sections. Design decision?

- **Issue #1094** (2024-02-08): **No projects impacted comment appended multiple times**
  *Symptoms*: Reported by user A.T.
  **Post-Mortem & Fix Analysis**:
  > +1, the current implementation creates a lot of spam messages in all PRs in our repo.  I have switched to using digger via Github Application (and workflow_dispatch in digger) and I'm also getting lot of spam with "No projects impacted". Github Application that creates the "No projects impacted comment" is triggered after every: - label - comment - review requested - change of PR title ( + probably other events that I haven't tested)  ![image](https://github.com/diggerhq/digger/assets/104632791/7ff310fe-b8ea-419a-b9d3-d188b5af551e)      Is this configurable? Ideally to run only on: - commits - comments "digger apply" "digger plan"  My workaround is to "disable" the Application and use workflow with custom configuration on pull_request and on issue_comment with conditions, but that's not ideal.
  > Again reported today by a different user (M.U.)
  > Addressed in #1136  There should now be much less "no projects impacted" comments.  - Comments that do not start with "digger" ignored - PR events that have no impacted projects do not trigger any messages - "Digger starting..." comment is only appended in case there are impacted projects

- **Issue #1090** (2024-01-31): **Pre-apply plan overrides stored plan**
  *Symptoms*: A bug likely introduced when policy overrides were implemented Plan that runs before apply regenerates and overrides the stored plan It should instead use the stored plan if available to run the policy checks  Related to #958 
  **Post-Mortem & Fix Analysis**:
  > Addressed in #1098 

- **Issue #887** (2023-12-13): **TFVars file triggers "no projects affected"**
  *Symptoms*: - If an empty TFVars file is added, a previously working setup with `generate_projects` stops detecting them and instead prints "no projects affected" (in the same PR that before the last commit produced a plan) : [commit that breaks it in a test repo](https://github.com/diggerhq/test-ignored-proj-gen/pull/1/commits/e4559c8387a0f95a50a113b2e6b67a81a0cd3752) - "If we have a pipeline and someone only changes the terraform.tfvars file - it doesnt actually produce a change request and the workflow is not run." Likely a separate edge case but seems related

- **Issue #630** (2023-11-17): **moving a tf file from a project to another does not trigger a plan in the source project**
  *Symptoms*: Tested using digger@v0.1.33  See https://github.com/diggerhq/francios-tests/pull/47 where a file was moved from `dev` project to `non-prod`.  Resulting digger action only planned in the `non-prod`project  ![image](https://github.com/diggerhq/digger/assets/17277004/0d2ea68a-bd5f-45ee-901e-c67a140c310e) 

- **Issue #593** (2023-10-02): **"on_commit_to_default" config fails to run correctly**
  *Symptoms*: Testing using v0.1.32 with the following config: ```     workflow_configuration:       on_pull_request_pushed: [digger plan]       on_pull_request_closed: [digger unlock]       on_commit_to_default: [digger apply] ```  Merging the PR manually fails with:  ![image](https://github.com/diggerhq/digger/assets/17277004/8a6b1fdd-4d72-498d-aa11-3ee658007d11)   Probably because the Github repo is setup to delete remote branches when they are merged.
  **Post-Mortem & Fix Analysis**:
  > Hey! Thanks for reporting, yes probably its due to ref being deleted. I'm checking if this is the expected behaviour or whether we should be running digger from the default branch to avoid this. Not sure if running from default branch is wise either since we could have more than one branch merged at the same time, giving it some thougth and will circle back with finidings!
  > Hi @fleroux514 could you show pls what your github workflow file looks like ?
  > @motatoes I believe we've always had this Github config where the remote branch gets deleted on merge, and it used to work fine at some point.  @veziak   Here ya go  ``` name: CI  on:   pull_request:     branches: [ "master" ]     types: [ closed, opened, synchronize, reopened ]   issue_comment:     types: [created]     if: contains(github.event.comment.body, 'digger')  concurrency:   # Avoid concurrent execution of this workflow in order to avoid Terraform failure to acquire state lock   group: ${{ github.workflow }}  jobs:   lint-terraform:     name: Lint     runs-on: ubuntu-latest      steps:       - uses: actions/checkout@v3       - name: Get Terraform version         id: get-terraform-version         run: echo "version=$(cat .terraform-version)" >> $GITHUB_OUTPUT       - name: Setup Terraform         uses: hashicorp/setup-terraform@v2         with:           terraform_version: ${{ steps.get-terraform-version.outputs.version }}       - name: Run t

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

### Incident Patch 1: `9ac4e223` (2026-09-30)
**Commit Message**: fix: honor git_timeout from digger.yml before cloning (#2724)

**File**: `backend/controllers/cache.go` (modified, +2/-2)
```diff
@@ -69,7 +69,7 @@ func (d DiggerController) UpdateRepoCache(c *gin.Context) {
 	cloneUrl := fmt.Sprintf("https://%v/%v", utils.GetGithubHostname(), repo.RepoFullName)
 	branch := request.Branch
 
-	_, token, err := utils.GetGithubService(d.GithubClientProvider, installationId, repoFullName, repoOwner, repoName)
+	ghService, token, err := utils.GetGithubService(d.GithubClientProvider, installationId, repoFullName, repoOwner, repoName)
 	if err != nil {
 		slog.Error("Could not get GitHub service", "error", err, "repoFullName", repoFullName, "orgId", orgId)
 		c.String(http.StatusInternalServerError, fmt.Sprintf("could not get github service %v %v", repoFullName, orgId))
@@ -83,7 +83,7 @@ func (d DiggerController) UpdateRepoCache(c *gin.Context) {
 	// update the cache here, do it async for immediate response
 	go func(ctx context.Context) {
 		defer logging.InheritRequestLogger(ctx)()
-		err = git_utils.CloneGitRepoAndDoAction(cloneUrl, branch, "", *token, "", func(dir string) error {
+		err = git_utils.CloneGitRepoAndDoActionWithConfig(cloneUrl, branch, "", *token, "", ghService.ReadRepositoryFile, func(dir string) error {
 			diggerYmlBytes, err := os.ReadFile(path.Join(dir, "digger.yml"))
 			diggerYmlStr = string(diggerYmlBytes)
 			config, _, _, newAtlantisConfig, err = dg_configuration.LoadDiggerConfig(dir, true, nil, nil)
```

**File**: `backend/controllers/github_helpers.go` (modified, +1/-1)
```diff
@@ -863,7 +863,7 @@ func GetDiggerConfigForBranchOrSha(gh utils.GithubClientProvider, installationId
 	var diggerYmlStr string
 	var dependencyGraph graph.Graph[string, digger_config.Project]
 
-	err = git_utils.CloneGitRepoAndDoAction(cloneUrl, branch, commitSha, *token, "", func(dir string) error {
+	err = git_utils.CloneGitRepoAndDoActionWithConfig(cloneUrl, branch, commitSha, *token, "", ghService.ReadRepositoryFile, func(dir string) error {
 		slog.Debug("Reading Digger config from cloned repository", "directory", dir)
 
 		diggerYmlStr, err = digger_config.ReadDiggerYmlFileContents(dir)
```

**File**: `backend/utils/bitbucket.go` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ func GetDiggerConfigForBitbucketBranch(bb BitbucketProvider, token string, repoF
 		"changedFilesCount", len(changedFiles),
 	)
 
-	err = git_utils.CloneGitRepoAndDoAction(cloneUrl, branch, "", token, "x-token-auth", func(dir string) error {
+	err = git_utils.CloneGitRepoAndDoActionWithConfig(cloneUrl, branch, "", token, "x-token-auth", service.ReadRepositoryFile, func(dir string) error {
 		diggerYmlPath := path.Join(dir, "digger.yml")
 		diggerYmlBytes, err := os.ReadFile(diggerYmlPath)
 		if err != nil {
```

**File**: `backend/utils/gitlab.go` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ func GetDiggerConfigForBranchGitlab(gh GitlabProvider, projectId int, repoFullNa
 		"changedFilesCount", len(changedFiles),
 	)
 
-	err = git_utils.CloneGitRepoAndDoAction(cloneUrl, branch, "", token, "", func(dir string) error {
+	err = git_utils.CloneGitRepoAndDoActionWithConfig(cloneUrl, branch, "", token, "", service.ReadRepositoryFile, func(dir string) error {
 		diggerYmlPath := path.Join(dir, "digger.yml")
 		diggerYmlBytes, err := os.ReadFile(diggerYmlPath)
 		if err != nil {
```

**File**: `background/projects-refresh-service/projects_refesh_main.go` (modified, +8/-2)
```diff
@@ -3,6 +3,7 @@ package main
 import (
 	"fmt"
 	"github.com/diggerhq/digger/backend/models"
+	"github.com/diggerhq/digger/libs/ci/github"
 	dg_configuration "github.com/diggerhq/digger/libs/digger_config"
 	utils3 "github.com/diggerhq/digger/libs/git_utils"
 	"log/slog"
@@ -45,7 +46,12 @@ func main() {
 	models.ConnectDatabase()
 
 	slog.Info("refreshing projects from repo", "repoFullName", repoFullName)
-	err := utils3.CloneGitRepoAndDoAction(cloneUrl, branch, "", token, "", func(dir string) error {
+	ghService, err := github.NewServiceForCloneURL(cloneUrl, token)
+	if err != nil {
+		slog.Error("failed to create GitHub client", "error", err)
+		os.Exit(1)
+	}
+	err = utils3.CloneGitRepoAndDoActionWithConfig(cloneUrl, branch, "", token, "", ghService.ReadRepositoryFile, func(dir string) error {
 		config, _, err := dg_configuration.LoadDiggerConfigYaml(dir, true, nil, nil)
 		if err != nil {
 			slog.Error("failed to load digger.yml: %v", "error", err)
@@ -61,7 +67,7 @@ func main() {
 		return nil
 	})
 	if err != nil {
-		slog.Error("error while cloning repo: %v", err)
+		slog.Error("error while cloning repo", "error", err)
 		os.Exit(1)
 	}
 
```

**File**: `docs/ce/reference/digger.yml.mdx` (modified, +1/-1)
```diff
@@ -216,7 +216,7 @@ workflows:
 </ParamField>
 
 <ParamField path="git_timeout" type="integer" default="30">
-  Timeout in seconds for each git command (clone, checkout) Digger runs when it clones a repository. Increase this for large repositories that take longer than 30 seconds to clone.
+  Timeout in seconds for each git command (clone, checkout) Digger runs when loading repository configuration. Increase this for large repositories, for example `git_timeout: 120`. Digger reads this setting through the Git provider API before cloning, using the requested branch or commit. It checks `digger.yml` first, then `digger.yaml`. An omitted, zero, or negative value uses the 30-second default. The initial API lookup has its own 30-second timeout.
 </ParamField>
 
 <ParamField path="projects" type="array">
```

**File**: `drift/utils/github.go` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ func GetDiggerConfigForBranch(gh utils.GithubClientProvider, installationId int6
 
 	var changedFiles []string = nil
 
-	err = utils2.CloneGitRepoAndDoAction(cloneUrl, branch, "", *token, "", func(dir string) error {
+	err = utils2.CloneGitRepoAndDoActionWithConfig(cloneUrl, branch, "", *token, "", ghService.ReadRepositoryFile, func(dir string) error {
 		diggerYmlBytes, err := os.ReadFile(path.Join(dir, "digger.yml"))
 		diggerYmlStr = string(diggerYmlBytes)
 		config, _, dependencyGraph, _, err = dg_configuration.LoadDiggerConfig(dir, true, changedFiles, nil)
```

**File**: `libs/ci/bitbucket/repository_file.go` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+package bitbucket
+
+import (
+	"context"
+	"fmt"
+	"io"
+	"net/http"
+	"net/url"
+	"os"
+)
+
+func (b BitbucketAPI) ReadRepositoryFile(ctx context.Context, path, ref string) ([]byte, error) {
+	if ref == "" {
+		ref = "HEAD"
+	}
+	endpoint := fmt.Sprintf("%s/repositories/%s/%s/src/%s/%s", bitbucketBaseURL, url.PathEscape(b.RepoWorkspace), url.PathEscape(b.RepoName), url.PathEscape(ref), url.PathEscape(path))
+	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
+	if err != nil {
+		return nil, err
+	}
+	req.Header.Set("Authorization", "Bearer "+b.AuthToken)
+	response, err := b.HttpClient.Do(req)
+	if err != nil {
+		return nil, err
+	}
+	defer response.Body.Close()
+	if response.StatusCode == http.StatusNotFound {
+		return nil, fmt.Errorf("%s: %w", path, os.ErrNotExist)
+	}
+	if response.StatusCode != http.StatusOK {
+		return nil, fmt.Errorf("read %s: Bitbucket returned HTTP %d", path, response.StatusCode)
+	}
+	return io.ReadAll(response.Body)
+}
```

---

### Incident Patch 2: `7d732cbd` (2026-09-20)
**Commit Message**: fix: adjust GitHub check run char limit considering the MD terraform text wrapper (#2615)

* fix: adjust char limit handling in GitHub check run output supporting the tf text wrapper

Fixes a side case in https://github.com/diggerhq/digger/pull/2550

https://github.com/diggerhq/digger/issues/2542

* test: update `TestCharacterLimit` test

**File**: `backend/controllers/projects_helpers.go` (modified, +5/-2)
```diff
@@ -512,9 +512,12 @@ func UpdateCheckRunForJob(gh utils.GithubClientProvider, job *models.DiggerJob,
 	// Character limit check - GitHub check run text field has a 65535 character limit
 	const maxCheckRunTextLength = 65535
 	cutOffMsg := "\n[Character limit exceeded, output truncated]"
-	if utf8.RuneCountInString(job.TerraformOutput) > maxCheckRunTextLength {
+	wrapper := "```terraform\n" + "```\n"
+	maxOutputLength := maxCheckRunTextLength - utf8.RuneCountInString(wrapper)
+
+	if utf8.RuneCountInString(job.TerraformOutput) > maxOutputLength {
 		runes := []rune(job.TerraformOutput)
-		truncateAt := maxCheckRunTextLength - utf8.RuneCountInString(cutOffMsg)
+		truncateAt := maxOutputLength - utf8.RuneCountInString(cutOffMsg)
 		job.TerraformOutput = string(runes[:truncateAt]) + cutOffMsg
 	}
 
```

**File**: `backend/controllers/projects_test.go` (modified, +9/-5)
```diff
@@ -128,7 +128,7 @@ func TestCharacterLimit(t *testing.T) {
 		},
 		{
 			name:           "at limit - no truncation",
-			inputLength:    65535,
+			inputLength:    65535 - 17, // account for wrapper
 			expectTruncate: false,
 		},
 		{
@@ -140,25 +140,29 @@ func TestCharacterLimit(t *testing.T) {
 
 	const maxCheckRunTextLength = 65535
 	cutOffMsg := "\n[Character limit exceeded, output truncated]"
+	wrapper := "```terraform\n" + "```\n"
+	maxOutputLength := maxCheckRunTextLength - utf8.RuneCountInString(wrapper)
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
 			input := strings.Repeat("a", tt.inputLength)
 
 			result := input
-			if utf8.RuneCountInString(result) > maxCheckRunTextLength {
+			if utf8.RuneCountInString(result) > maxOutputLength {
 				runes := []rune(result)
-				truncateAt := maxCheckRunTextLength - utf8.RuneCountInString(cutOffMsg)
+				truncateAt := maxOutputLength - utf8.RuneCountInString(cutOffMsg)
 				result = string(runes[:truncateAt]) + cutOffMsg
 			}
 
+			text := "```terraform\n" + result + "```\n"
+
 			if tt.expectTruncate {
-				assert.Equal(t, maxCheckRunTextLength, utf8.RuneCountInString(result),
+				assert.Equal(t, maxCheckRunTextLength, utf8.RuneCountInString(text),
 					"truncated output should be exactly 65535 characters")
 				assert.True(t, strings.HasSuffix(result, cutOffMsg),
 					"truncated output should end with cutoff message")
 			} else {
-				assert.Equal(t, tt.inputLength, utf8.RuneCountInString(result),
+				assert.LessOrEqual(t, utf8.RuneCountInString(text), maxCheckRunTextLength,
 					"non-truncated output should maintain original length")
 				assert.False(t, strings.HasSuffix(result, cutOffMsg),
 					"non-truncated output should not have cutoff message")
```

---

### Incident Patch 3: `85cd59db` (2026-09-13)
**Commit Message**: fix: replace unmaintained terragrunt and tfenv setup actions with shell steps (#2709)

GitHub removes Node 16 and Node 20 from Actions runners on 2026-09-23.
Two actions used by setup-terragrunt and setup-tfenv have no Node 24
release upstream and are effectively unmaintained:

- autero1/action-terragrunt v3.0.2 (node20, last release Feb 2024)
- rhythmictech/actions-setup-tfenv v0.1.2 (node16, last release Jul 2022)

Both are replaced with bash steps that reproduce their behaviour:

- tfenv: clone tfutils/tfenv into $HOME/.tfenv if absent, add bin to PATH.
- terragrunt: accept "0.73.7", "v0.73.7" or "latest"; download the
  release binary for linux/darwin/windows on amd64/arm64/386; add to PATH.

Follows #2681 and #2708. Closes the remaining gap in #2707.

**File**: `action.yml` (modified, +48/-4)
```diff
@@ -422,14 +422,58 @@ runs:
         cli_config_credentials_hostname: ${{ inputs.terraform-tfe-hostname || 'otaco.app' }}
       if: inputs.setup-terraform == 'true'
 
+    # rhythmictech/actions-setup-tfenv is unmaintained and still declares node16,
+    # which GitHub removes from runners on 2026-09-23. This reproduces what it did.
     - name: Setup tfenv
-      uses: rhythmictech/actions-setup-tfenv@ef1296cdbec243306d3a3d31909582ca1eeb4627 # v0.1.2
+      shell: bash
+      run: |
+        TFENV_DIR="${HOME:-/opt}/.tfenv"
+        if [ ! -d "$TFENV_DIR" ]; then
+          git clone --depth 1 https://github.com/tfutils/tfenv.git "$TFENV_DIR"
+        fi
+        echo "$TFENV_DIR/bin" >> "$GITHUB_PATH"
       if: inputs.setup-tfenv == 'true'
 
+    # autero1/action-terragrunt is unmaintained and still declares node20,
+    # which GitHub removes from runners on 2026-09-23. This reproduces what it did:
+    # accepts "0.73.7", "v0.73.7" or "latest"; supports linux/darwin/windows on amd64/arm64/386.
     - name: Setup Terragrunt
-      uses: autero1/action-terragrunt@aefb0a43c4f5503a91fefb307745c4d51c26ed0e # v3.0.2
-      with:
-        terragrunt-version: ${{ inputs.terragrunt-version }}
+      shell: bash
+      env:
+        TG_VERSION: ${{ inputs.terragrunt-version }}
+        GH_TOKEN: ${{ github.token }}
+      run: |
+        set -euo pipefail
+        if [ "$(echo "$TG_VERSION" | tr '[:upper:]' '[:lower:]')" = "latest" ]; then
+          TG_VERSION=$(curl -fsSL -H "Authorization: Bearer $GH_TOKEN" \
+            https://api.github.com/repos/gruntwork-io/terragrunt/releases/latest | \
+            sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p')
+          echo "Latest Terragrunt version: $TG_VERSION"
+        fi
+        case "$TG_VERSION" in v*) ;; *) TG_VERSION="v$TG_VERSION";; esac
+
+        case "$(uname -s)" in
+          Linux)  OS=linux ;;
+          Darwin) OS=darwin ;;
+          MINGW*|MSYS*|CYGWIN*|Windows_NT) OS=windows ;;
+          *) echo "Unsupported OS: $(uname -s)"; exit 1 ;;
+        esac
+        case "$(uname -m)" in
+          x86_64|amd64)  ARCH=amd64 ;;
+          aarch64|arm64) ARCH=arm64 ;;
+          i386|i686)     ARCH=386 ;;
+          *) echo "Unsupported architecture: $(uname -m)"; exit 1 ;;
+        esac
+
+        BIN_DIR="$RUNNER_TEMP/terragrunt-bin"
+        mkdir -p "$BIN_DIR"
+        EXT=""; [ "$OS" = "windows" ] && EXT=".exe"
+        URL="https://github.com/gruntwork-io/terragrunt/releases/download/${TG_VERSION}/terragrunt_${OS}_${ARCH}${EXT}"
+        echo "Downloading Terragrunt ${TG_VERSION} from ${URL}"
+        curl -fsSL -o "$BIN_DIR/terragrunt${EXT}" "$URL"
+        chmod +x "$BIN_DIR/terragrunt${EXT}"
+        echo "$BIN_DIR" >> "$GITHUB_PATH"
+        "$BIN_DIR/terragrunt${EXT}" --version
       if: inputs.setup-terragrunt == 'true'
 
     - name: Setup OpenTofu
```

---

### Incident Patch 4: `1b944474` (2026-09-12)
**Commit Message**: fix: bump all node20 actions in action.yml to Node 24 versions (#2681)

* fix: bump internal checkout to v6.1.0 and github-script to v9.0.0 (Node 24)

* fix: bump remaining node20 actions in action.yml to Node 24 majors

Follow-up to the checkout/github-script bump: move every other
Node 20 (or Node 16) action pinned in action.yml to its current
Node 24 major, keeping the SHA-pinned style.

- actions/cache (restore + save)        v4.3.0  -> v6.1.0
- aws-actions/configure-aws-credentials v4.3.1  -> v6.2.4
- google-github-actions/auth            v2.1.13 -> v3.0.0
- google-github-actions/setup-gcloud    v2.2.1  -> v3.0.1
- hashicorp/setup-terraform             v3.1.2  -> v4.0.1
- pulumi/actions                        v4.5.1  -> v7.0.0
- actions/setup-go                      v5.5.0  -> v7.0.0
- azure/login                           v2.2.0  -> v3.1.0
- opentofu/setup-opentofu               v1.0.5  -> v2.0.2

Every input this action passes to each of these still exists at the
new version. Not bumped: autero1/action-terragrunt (v3.0.2, node20)
and rhythmictech/actions-setup-tfenv (v0.1.2, node16) have no Node 24
release yet.

**File**: `action.yml` (modified, +15/-15)
```diff
@@ -315,23 +315,23 @@ runs:
         exit 1
       shell: bash
       if: inputs.setup-google-cloud == 'true'
-    - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
+    - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6.1.0
       with:
         clean: false
         ref: refs/pull/${{ github.event.issue.number }}/merge
       if: ${{ github.event_name == 'issue_comment' && inputs.configure-checkout == 'true' }}
-    - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
+    - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6.1.0
       with:
         clean: false
       if: ${{ github.event_name != 'issue_comment' && inputs.configure-checkout == 'true' }}
     - name: Set up Google Auth Using A Service Account Key
-      uses: google-github-actions/auth@c200f3691d83b41bf9bbd8638997a462592937ed # v2.1.13
+      uses: google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093 # v3.0.0
       with:
         credentials_json: "${{ inputs.google-auth-credentials }}"
       if: ${{ inputs.setup-google-cloud == 'true' && inputs.google-auth-credentials != '' }}
 
     - name: Set up Google Auth Using Workload Identity Federation
-      uses: google-github-actions/auth@c200f3691d83b41bf9bbd8638997a462592937ed # v2.1.13
+      uses: google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093 # v3.0.0
       with:
         token_format: access_token
         service_account: ${{ inputs.google-service-account }}
@@ -340,11 +340,11 @@ runs:
       if: ${{ inputs.setup-google-cloud == 'true' && inputs.google-workload-identity-provider != '' }}
 
     - name: Set up Cloud SDK
-      uses: google-github-actions/setup-gcloud@e427ad8a34f8676edf47cf7d7925499adf3eb74f # v2.2.1
+      uses: google-github-actions/setup-gcloud@aa5489c8933f4cc7a4f7d45035b3b1440c9c10db # v3.0.1
       if: inputs.setup-google-cloud == 'true'
 
     - name: Configure AWS credentials
-      uses: aws-actions/configure-aws-credentials@7474bc4690e29a8392af63c5b98e7449536d5c3a # v4.3.1
+      uses: aws-actions/configure-aws-credentials@cbe3b392738ccf3f987d68400dafcf4b0624a56c # v6.2.4
       with:
         aws-access-key-id: ${{ inputs.aws-access-key-id }}
         aws-secret-access-key: ${{ inputs.aws-secret-access-key }}
@@ -353,7 +353,7 @@ runs:
       if: ${{ inputs.setup-aws == 'true' && inputs.aws-role-to-assume == '' }}
 
     - name: Configure OIDC AWS credentials
-      uses: aws-actions/configure-aws-credentials@7474bc4690e29a8392af63c5b98e7449536d5c3a # v4.3.1
+      uses: aws-actions/configure-aws-credentials@cbe3b392738ccf3f987d68400dafcf4b0624a56c # v6.2.4
       with:
         role-to-assume: ${{ inputs.aws-role-to-assume }}
         aws-region: ${{ inputs.aws-region }}
@@ -362,7 +362,7 @@ runs:
       if: ${{ inputs.setup-aws == 'true' && inputs.aws-role-to-assume != '' }}
 
     - name: Configure OIDC Azure credentials
-      uses: azure/login@a65d910e8af852a8061c627c456678983e180302 # v2.2.0
+      uses: azure/login@a641126d1b8aa4d1fa005f4f92df94a3a4c4c906 # v3.1.0
       with:
         client-id: ${{ inputs.azure-client-id }}
         tenant-id: ${{ inputs.azure-tenant-id }}
@@ -384,7 +384,7 @@ runs:
         echo "TG_PROVIDER_CACHE_DIR=$CACHE_DIR" >> $GITHUB_ENV
         echo "TERRAGRUNT_PROVIDER_CACHE_DIR=$CACHE_DIR" >> $GITHUB_ENV
 
-    - uses: actions/cache/restore@0057852bfaa89a56745cba8c7296529d2fc39830 # v4.3.0
+    - uses: actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
       id: restore_cache
       name: restore_cache
       with:
@@ -414,7 +414,7 @@ runs:
 
     # Then terraform setup happens...
     - name: Setup Terraform
-      uses: hashicorp/setup-terraform@b9cd54a3c349d3f38e8881555d616ced269862dd # v3.1.2
+      uses: hashicorp/setup-terraform@dfe3c3f87815947d99a8997f908cb6525fc44e9e # v4.0.1
       with:
         terraform_version: ${{ inputs.terraform-version }}
         terraform_wrapper: false
@@ -433,7 +433,7 @@ runs:
       if: inputs.setup-terragrunt == 'true'
 
     - name: Setup OpenTofu
-      uses: opentofu/setup-opentofu@592200bd4b9bbf4772ace78f887668b1aee8f716 # v1.0.5
+      uses: opentofu/setup-opentofu@a1320f892987e89d278cc92dc5adc984fb93aca4 # v2.0.2
       with:
         tofu_version: ${{ inputs.opentofu-version }}
         tofu_wrapper: false
@@ -442,7 +442,7 @@ runs:
       if: inputs.setup-opentofu == 'true'
 
     - name: Setup Pulumi
-      uses: pulumi/actions@a3f382e1242b69ab33854c253c3b580f1226348e # v4.5.1
+      uses: pulumi/actions@8e5e406f4007fca908480587cb9893c07090f58d # v7.0.0
       with:
         tofu_version: ${{ inputs.pulumi-version }}
       if: inputs.setup-pulumi == 'true'
@@ -458,7 +458,7 @@ runs:
       if: inputs.setup-checkov == 'true'
 
     - name: setup go
-      uses: actions/setup-go@d35c59abb061a4a6fb18e82ac0862c26744d6ab5 # v5.5.0
+      uses: actions/setup-go@b7ad1dad31e06c5925ef5d2fc7ad053ef454303e # v7.0.0
       with:
         go-versio
```

---

### Incident Patch 5: `acded8b7` (2026-09-10)
**Commit Message**: feat: make git clone timeout configurable via digger.yml (#2706)

Add a top-level git_timeout key (integer, seconds, default 30) to
digger.yml and expose CloneGitRepoAndDoActionWithTimeout so the
per-git-command timeout in libs/git_utils is no longer hard-coded.

**File**: `docs/ce/reference/digger.yml.mdx` (modified, +4/-0)
```diff
@@ -215,6 +215,10 @@ workflows:
   Include Terraform outputs in the PR comment after apply.
 </ParamField>
 
+<ParamField path="git_timeout" type="integer" default="30">
+  Timeout in seconds for each git command (clone, checkout) Digger runs when it clones a repository. Increase this for large repositories that take longer than 30 seconds to clone.
+</ParamField>
+
 <ParamField path="projects" type="array">
   List of projects to manage. See [Project Configuration](#project-configuration).
 </ParamField>
```

**File**: `libs/digger_config/config.go` (modified, +4/-0)
```diff
@@ -11,6 +11,9 @@ const AutomergeStrategyRebase AutomergeStrategy = "rebase"
 
 const DefaultBranchName = "__default__"
 
+// DefaultGitTimeoutSeconds is the default per-command git timeout used when git_timeout is not set in digger.yml
+const DefaultGitTimeoutSeconds = 30
+
 type DiggerConfig struct {
 	ApplyAfterMerge               bool
 	AllowDraftPRs                 bool
@@ -31,6 +34,7 @@ type DiggerConfig struct {
 	TraverseToNestedProjects      bool
 	Reporting                     ReporterConfig
 	ReportTerraformOutputs        bool
+	GitTimeout                    int // seconds, per git command when cloning
 	DriftExcludePatterns          []string
 	DriftIncludePatterns          []string
 	DriftTerragruntParallelism    *int
```

**File**: `libs/digger_config/converters.go` (modified, +6/-0)
```diff
@@ -241,6 +241,12 @@ func ConvertDiggerYamlToConfig(diggerYaml *DiggerConfigYaml) (*DiggerConfig, gra
 		diggerConfig.ReportTerraformOutputs = true
 	}
 
+	if diggerYaml.GitTimeout != nil && *diggerYaml.GitTimeout > 0 {
+		diggerConfig.GitTimeout = *diggerYaml.GitTimeout
+	} else {
+		diggerConfig.GitTimeout = DefaultGitTimeoutSeconds
+	}
+
 	diggerConfig.Reporting = copyReporterConfig(diggerYaml.Reporting)
 
 	if diggerYaml.AutoMerge != nil {
```

**File**: `libs/digger_config/yaml.go` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@ type DiggerConfigYaml struct {
 	TraverseToNestedProjects      *bool                        `yaml:"traverse_to_nested_projects"`
 	MentionDriftedProjectsInPR    *bool                        `yaml:"mention_drifted_projects_in_pr"`
 	ReportTerraformOutputs        *bool                        `yaml:"report_terraform_outputs"`
+	GitTimeout                    *int                         `yaml:"git_timeout,omitempty"`
 	Reporting                     *ReportingConfigYaml         `yaml:"reporting"`
 }
 
```

**File**: `libs/git_utils/clone_utils.go` (modified, +11/-1)
```diff
@@ -23,7 +23,14 @@ func createTempDir() (string, error) {
 
 type action func(string) error
 
+const defaultGitTimeout = 30 * time.Second
+
 func CloneGitRepoAndDoAction(repoUrl string, branch string, commitHash string, token string, tokenUsername string, action action) error {
+	return CloneGitRepoAndDoActionWithTimeout(repoUrl, branch, commitHash, token, tokenUsername, defaultGitTimeout, action)
+}
+
+// CloneGitRepoAndDoActionWithTimeout is CloneGitRepoAndDoAction with a per-git-command timeout (digger.yml git_timeout, in seconds)
+func CloneGitRepoAndDoActionWithTimeout(repoUrl string, branch string, commitHash string, token string, tokenUsername string, timeout time.Duration, action action) error {
 	dir, err := createTempDir()
 	if err != nil {
 		slog.Error("Failed to create temporary directory", "error", err)
@@ -38,6 +45,9 @@ func CloneGitRepoAndDoAction(repoUrl string, branch string, commitHash string, t
 	)
 
 	git := NewGitShellWithTokenAuth(dir, token, tokenUsername)
+	if timeout > 0 {
+		git.timeout = timeout
+	}
 	err = git.Clone(repoUrl, branch)
 	if err != nil {
 		slog.Error("Failed to clone repository",
@@ -101,7 +111,7 @@ func NewGitShell(workDir string, auth *GitAuth) *GitShell {
 
 	return &GitShell{
 		workDir:     workDir,
-		timeout:     30 * time.Second,
+		timeout:     defaultGitTimeout,
 		environment: env,
 		auth:        auth,
 	}
```

---

### Incident Patch 6: `3053cda2` (2026-07-21)
**Commit Message**: fix: paginate ListReviews in GetApprovals so approvals beyond 30 reviews are seen (#2674)

**File**: `libs/ci/github/github.go` (modified, +15/-3)
```diff
@@ -245,9 +245,21 @@ func (svc GithubService) GetComments(prNumber int) ([]ci.Comment, error) {
 }
 
 func (svc GithubService) GetApprovals(prNumber int) ([]string, error) {
-	reviews, _, err := svc.Client.PullRequests.ListReviews(context.Background(), svc.Owner, svc.RepoName, prNumber, &github.ListOptions{})
-	if err != nil {
-		return nil, err
+	// Paginate through all reviews: GitHub returns at most 30 per page by
+	// default, so a PR with 30+ reviews (e.g. automated per-file COMMENTED
+	// reviews) would otherwise hide approvals submitted after the first page.
+	reviews := make([]*github.PullRequestReview, 0)
+	opts := &github.ListOptions{PerPage: 100}
+	for {
+		reviewsPage, resp, err := svc.Client.PullRequests.ListReviews(context.Background(), svc.Owner, svc.RepoName, prNumber, opts)
+		if err != nil {
+			return nil, err
+		}
+		reviews = append(reviews, reviewsPage...)
+		if resp.NextPage == 0 {
+			break
+		}
+		opts.Page = resp.NextPage
 	}
 
 	// Track the latest review state per user
```

**File**: `libs/ci/github/github_test.go` (modified, +49/-0)
```diff
@@ -5,6 +5,8 @@ import (
 	"testing"
 
 	"github.com/diggerhq/digger/libs/digger_config"
+	"github.com/google/go-github/v61/github"
+	"github.com/migueleliasweb/go-github-mock/src/mock"
 	"github.com/stretchr/testify/assert"
 )
 
@@ -121,3 +123,50 @@ func TestFindAllChangedFilesOfPR(t *testing.T) {
 	// 45 changed files including 1 renamed file so the previous filename is included
 	assert.Equal(t, 46, len(files))
 }
+
+func TestGetApprovalsPaginatesBeyondFirstPage(t *testing.T) {
+	// Regression test for PRs with >30 reviews: automated tools can post
+	// dozens of COMMENTED reviews before any human approves, pushing the
+	// real approvals past GitHub's default page size (30). GetApprovals
+	// must paginate, and its latest-state-per-user logic must span pages:
+	//  - alice: CHANGES_REQUESTED on page 1, APPROVED on page 2 -> approver
+	//  - bob:   APPROVED on page 1, CHANGES_REQUESTED on page 2 -> NOT an approver
+	//  - carol: APPROVED on page 2 only -> approver
+	review := func(user, state string) *github.PullRequestReview {
+		return &github.PullRequestReview{
+			User:  &github.User{Login: github.String(user)},
+			State: github.String(state),
+		}
+	}
+
+	pageOne := make([]*github.PullRequestReview, 0, 33)
+	for i := 0; i < 31; i++ {
+		pageOne = append(pageOne, review("review-bot", "COMMENTED"))
+	}
+	pageOne = append(pageOne, review("alice", "CHANGES_REQUESTED"), review("bob", "APPROVED"))
+
+	pageTwo := []*github.PullRequestReview{
+		review("alice", "APPROVED"),
+		review("bob", "CHANGES_REQUESTED"),
+		review("carol", "APPROVED"),
+	}
+
+	mockedHTTPClient := mock.NewMockedHTTPClient(
+		mock.WithRequestMatchPages(
+			mock.GetReposPullsReviewsByOwnerByRepoByPullNumber,
+			pageOne,
+			pageTwo,
+		),
+	)
+
+	svc := GithubService{
+		Client:   github.NewClient(mockedHTTPClient),
+		Owner:    "diggerhq",
+		RepoName: "digger",
+	}
+
+	approvals, err := svc.GetApprovals(1)
+
+	assert.NoError(t, err)
+	assert.ElementsMatch(t, []string{"alice", "carol"}, approvals)
+}
```

**File**: `libs/go.mod` (modified, +4/-0)
```diff
@@ -104,6 +104,7 @@ require (
 	github.com/bgentry/go-netrc v0.0.0-20140422174119-9fd32a8b3d3d // indirect
 	github.com/blang/semver v3.5.1+incompatible // indirect
 	github.com/bmatcuk/doublestar v1.3.4 // indirect
+	github.com/buger/jsonparser v1.1.1 // indirect
 	github.com/cenkalti/backoff/v3 v3.2.2 // indirect
 	github.com/cespare/xxhash/v2 v2.3.0 // indirect
 	github.com/cloudflare/circl v1.6.1 // indirect
@@ -123,6 +124,8 @@ require (
 	github.com/go-git/gcfg v1.5.1-0.20230307220236-3a3c6141e376 // indirect
 	github.com/go-git/go-billy/v5 v5.6.0 // indirect
 	github.com/go-ini/ini v1.67.0 // indirect
+	github.com/go-kit/log v0.2.1 // indirect
+	github.com/go-logfmt/logfmt v0.5.1 // indirect
 	github.com/go-logr/logr v1.4.2 // indirect
 	github.com/go-logr/stdr v1.2.2 // indirect
 	github.com/gobwas/glob v0.2.3 // indirect
@@ -183,6 +186,7 @@ require (
 	github.com/mattn/go-isatty v0.0.20 // indirect
 	github.com/mattn/go-runewidth v0.0.15 // indirect
 	github.com/mattn/go-zglob v0.0.3 // indirect
+	github.com/migueleliasweb/go-github-mock v0.0.23 // indirect
 	github.com/mitchellh/copystructure v1.2.0 // indirect
 	github.com/mitchellh/go-homedir v1.1.0 // indirect
 	github.com/mitchellh/go-testing-interface v1.14.1 // indirect
```

**File**: `libs/go.sum` (modified, +8/-0)
```diff
@@ -846,6 +846,8 @@ github.com/bradleyfalzon/ghinstallation/v2 v2.16.0 h1:B91r9bHtXp/+XRgS5aZm6ZzTdz
 github.com/bradleyfalzon/ghinstallation/v2 v2.16.0/go.mod h1:OeVe5ggFzoBnmgitZe/A+BqGOnv1DvU/0uiLQi1wutM=
 github.com/bufbuild/protocompile v0.4.0 h1:LbFKd2XowZvQ/kajzguUp2DC9UEIQhIq77fZZlaQsNA=
 github.com/bufbuild/protocompile v0.4.0/go.mod h1:3v93+mbWn/v3xzN+31nwkJfrEpAUwp+BagBSZWx+TP8=
+github.com/buger/jsonparser v1.1.1 h1:2PnMjfWD7wBILjqQbt530v576A/cAbQvEW9gGIpYMUs=
+github.com/buger/jsonparser v1.1.1/go.mod h1:6RYKKt7H4d4+iWqouImQ9R2FZql3VbhNgx27UK13J/0=
 github.com/bytecodealliance/wasmtime-go/v3 v3.0.2 h1:3uZCA/BLTIu+DqCfguByNMJa2HVHpXvjfy0Dy7g6fuA=
 github.com/bytecodealliance/wasmtime-go/v3 v3.0.2/go.mod h1:RnUjnIXxEJcL6BgCvNyzCCRzZcxCgsZCi+RNlvYor5Q=
 github.com/caarlos0/env/v11 v11.1.0 h1:a5qZqieE9ZfzdvbbdhTalRrHT5vu/4V1/ad1Ka6frhI=
@@ -1017,11 +1019,15 @@ github.com/go-ini/ini v1.67.0 h1:z6ZrTEZqSWOTyH2FlglNbNgARyHG8oLW9gMELqKr06A=
 github.com/go-ini/ini v1.67.0/go.mod h1:ByCAeIL28uOIIG0E3PJtZPDL8WnHpFKFOtgjp+3Ies8=
 github.com/go-kit/kit v0.8.0/go.mod h1:xBxKIO96dXMWWy0MnWVtmwkA9/13aqxPnvrjFYMA2as=
 github.com/go-kit/kit v0.9.0/go.mod h1:xBxKIO96dXMWWy0MnWVtmwkA9/13aqxPnvrjFYMA2as=
+github.com/go-kit/log v0.2.1 h1:MRVx0/zhvdseW+Gza6N9rVzU/IVzaeE1SFI4raAhmBU=
+github.com/go-kit/log v0.2.1/go.mod h1:NwTd00d/i8cPZ3xOwwiv2PO5MOcx78fFErGNcVmBjv0=
 github.com/go-latex/latex v0.0.0-20210118124228-b3d85cf34e07/go.mod h1:CO1AlKB2CSIqUrmQPqA0gdRIlnLEY0gK5JGjh37zN5U=
 github.com/go-latex/latex v0.0.0-20210823091927-c0d11ff05a81/go.mod h1:SX0U8uGpxhq9o2S/CELCSUxEWWAuoCUcVCQWv7G2OCk=
 github.com/go-ldap/ldap/v3 v3.1.10/go.mod h1:5Zun81jBTabRaI8lzN7E1JjyEl1g6zI6u9pd8luAK4Q=
 github.com/go-logfmt/logfmt v0.3.0/go.mod h1:Qt1PoO58o5twSAckw1HlFXLmHsOX5/0LbT9GBnD5lWE=
 github.com/go-logfmt/logfmt v0.4.0/go.mod h1:3RMwSq7FuexP4Kalkev3ejPJsZTpXXBr9+V4qmtdjCk=
+github.com/go-logfmt/logfmt v0.5.1 h1:otpy5pqBCBZ1ng9RQ0dPu4PN7ba75Y/aA+UpowDyNVA=
+github.com/go-logfmt/logfmt v0.5.1/go.mod h1:WYhtIu8zTZfxdn5+rREduYbwxfcBr/Vr6KEVveWlfTs=
 github.com/go-logr/logr v0.1.0/go.mod h1:ixOQHD9gLJUVQQ2ZOR7zLEifBX6tGkNJF4QyIY7sIas=
 github.com/go-logr/logr v1.2.2/go.mod h1:jdQByPbusPIv2/zmleS9BjJVeZ6kBagPoEUsqbVz/1A=
 github.com/go-logr/logr v1.4.2 h1:6pFjapn8bFcIbiKo3XT4j/BhANplGihG6tvd+8rYgrY=
@@ -1454,6 +1460,8 @@ github.com/microsoft/azure-devops-go-api/azuredevops v1.0.0-b5/go.mod h1:PoGiBqK
 github.com/miekg/dns v1.0.8/go.mod h1:W1PPwlIAgtquWBMBEV9nkV9Cazfe8ScdGz/Lj7v3Nrg=
 github.com/miekg/dns v1.1.57 h1:Jzi7ApEIzwEPLHWRcafCN9LZSBbqQpxjt/wpgvg7wcM=
 github.com/miekg/dns v1.1.57/go.mod h1:uqRjCRUuEAA6qsOiJvDd+CFo/vW+y5WR6SNmHE55hZk=
+github.com/migueleliasweb/go-github-mock v0.0.23 h1:GOi9oX/+Seu9JQ19V8bPDLqDI7M9iEOjo3g8v1k6L2c=
+github.com/migueleliasweb/go-github-mock v0.0.23/go.mod h1:NsT8FGbkvIZQtDu38+295sZEX8snaUiiQgsGxi6GUxk=
 github.com/minio/asm2plan9s v0.0.0-20200509001527-cdd76441f9d8/go.mod h1:mC1jAcsrzbxHt8iiaC+zU4b1ylILSosueou12R++wfY=
 github.com/minio/c2goasm v0.0.0-20190812172519-36a3d3bbc4f3/go.mod h1:RagcQ7I8IeTMnF8JTXieKnO4Z6JCsikNEzj0DwauVzE=
 github.com/mitchellh/cli v1.0.0/go.mod h1:hNIlj7HEI86fIcpObd7a0FcrxTWetlwJDGcceTlRvqc=
```

---

### Incident Patch 7: `53efc5d7` (2026-06-12)
**Commit Message**: fix: allow digger apply when digger/apply is the sole required blocking check (#2661)

When digger/apply is configured as a required GitHub branch protection check,
IsMergeable() returns false before the first apply runs (state is "blocked"),
preventing apply from ever executing. This inspects the actual check runs when
the PR is in a blocked state and bypasses the mergeability gate only when
digger/apply checks are the sole non-passing checks on the head commit.

Co-authored-by: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `libs/ci/github/github.go` (modified, +36/-1)
```diff
@@ -706,7 +706,42 @@ func (svc GithubService) IsMergeable(prNumber int) (bool, error) {
 		slog.Error("error getting pull request", "error", err, "prNumber", prNumber)
 		return false, fmt.Errorf("error getting pull request: %v", err)
 	}
-	return pr.GetMergeable() && isMergeableState(pr.GetMergeableState()), nil
+
+	if pr.GetMergeable() && isMergeableState(pr.GetMergeableState()) {
+		return true, nil
+	}
+
+	// When the PR is blocked solely because digger/apply is a required check that hasn't
+	// passed yet, allow the apply to proceed — it's the only way to satisfy that check.
+	if strings.ToLower(pr.GetMergeableState()) == "blocked" {
+		return svc.isBlockedOnlyByDiggerApply(pr.GetHead().GetSHA())
+	}
+
+	return false, nil
+}
+
+// isBlockedOnlyByDiggerApply returns true if the only non-successful check runs on the
+// commit are digger/apply checks. This breaks the chicken-and-egg problem where digger/apply
+// is a required branch protection check: the apply must run to pass the check, but the
+// mergeability gate would otherwise prevent it from running.
+func (svc GithubService) isBlockedOnlyByDiggerApply(headSHA string) (bool, error) {
+	checkRuns, err := svc.GetCheckRunsForCommit(headSHA)
+	if err != nil {
+		return false, fmt.Errorf("could not get check runs for commit %v: %v", headSHA, err)
+	}
+
+	for _, run := range checkRuns {
+		if run.GetConclusion() == "success" {
+			continue
+		}
+		if strings.HasPrefix(run.GetName(), "digger/apply") {
+			continue
+		}
+		slog.Debug("PR blocked by non-digger check", "check", run.GetName(), "conclusion", run.GetConclusion())
+		return false, nil
+	}
+
+	return true, nil
 }
 
 func (svc GithubService) IsMerged(prNumber int) (bool, error) {
```

---

### Incident Patch 8: `865b7802` (2026-05-13)
**Commit Message**: fix: drift exclude patterns excluding all projects when include is unset (#2653)

MatchIncludeExcludePatternsToFile initialized matching=false and only
flipped to true when an include pattern matched, so any caller passing
an empty include list (e.g. a digger.yml with drift_exclude_patterns but
no drift_include_patterns) had every project skipped by the drift
controller. Default to matching=true when the include list is empty so
the exclude list does the filtering on its own.

Co-authored-by: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `libs/digger_config/utils.go` (modified, +2/-1)
```diff
@@ -46,7 +46,8 @@ func MatchIncludeExcludePatternsToFile(fileToMatch string, includePatterns []str
 		excludePatterns[i] = NormalizeFileName(excludePatterns[i])
 	}
 
-	matching := false
+	// An empty include list means "match everything"; only the exclude list filters.
+	matching := len(includePatterns) == 0
 	for _, ipattern := range includePatterns {
 		isMatched, err := doublestar.PathMatch(ipattern, fileToMatch)
 		if err != nil {
```

**File**: `libs/digger_config/utils_test.go` (modified, +10/-2)
```diff
@@ -20,12 +20,20 @@ func TestMatchIncludeExcludePatternsToFile(t *testing.T) {
 	result = MatchIncludeExcludePatternsToFile("projects/dev/project", includePatterns, excludePatterns)
 	assert.Equal(t, false, result)
 
-	// also checking for uninitialized case which is going to be the scenario when not specified in yaml file
+	// Empty include list means "match everything" (only exclude filters).
 	var ip []string
 	var ep []string
 	result = MatchIncludeExcludePatternsToFile("/projects/dev/test1", ip, ep)
-	assert.Equal(t, false, result)
+	assert.Equal(t, true, result)
 
+	// Exclude-only: every path matches except those hit by an exclude pattern.
+	// Mirrors the drift_exclude_patterns scenario where users provide excludes
+	// without includes.
+	excludeOnly := []string{"projects/dev/project"}
+	result = MatchIncludeExcludePatternsToFile("/projects/dev/test1", nil, excludeOnly)
+	assert.Equal(t, true, result)
+	result = MatchIncludeExcludePatternsToFile("/projects/dev/project", nil, excludeOnly)
+	assert.Equal(t, false, result)
 }
 
 func TestGetPatternsRelativeToRepo(t *testing.T) {
```

---

### Incident Patch 9: `7cdfeb30` (2026-04-24)
**Commit Message**: Fix default image repos (backend ee -> ce), add podAnnotations (#2598)

* Fix default image repos (backend ee -> ce), add podAnnotations

* standardize image registry/repository handling across taco charts

**File**: `docs/self-hosting/kubernetes.mdx` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ Run these commands from `self-hosting/kubernetes/`.
     If you deployed the platform reference chart, you can also start from:
 
     ```bash
-    cp helm-charts/opentaco/helm.platform-reference.yaml values-opentaco.yaml
+    cp helm-charts/opentaco/values.platform-reference.yaml values-opentaco.yaml
     ```
 
     Skeleton structure for `values-opentaco.yaml`:
```

**File**: `self-hosting/kubernetes/helm-charts/README.md` (modified, +14/-12)
```diff
@@ -68,7 +68,7 @@ Example: `my-prod-project:us-central1:opentaco-postgres`
 
 ```yaml
 global:
-  imageRegistry: ghcr.io/diggerhq/digger  # ✅ Public registry (no auth needed)
+  imageRegistry: ghcr.io/diggerhq  # ✅ Public registry (no auth needed)
   # Or use your private registry:
   # imageRegistry: us-central1-docker.pkg.dev/YOUR-PROJECT/YOUR-REPO
 ```
@@ -159,7 +159,7 @@ Edit each file in `.secrets/` with your actual credentials:
 kubectl create secret generic ui-secrets \
   --from-env-file=.secrets/ui.env -n opentaco
 
-kubectl create secret generic backend-secrets \
+kubectl create secret generic taco-orchestrator-secrets \
   --from-env-file=.secrets/digger-backend.env -n opentaco
 
 kubectl create secret generic statesman-secrets \
@@ -281,10 +281,10 @@ helm install opentaco . -f values-production.yaml -n opentaco
 kubectl get pods -n opentaco
 
 # Check logs
-kubectl logs -f deployment/opentaco-statesman -n opentaco -c statesman
+kubectl logs -f deployment/opentaco-taco-statesman -n opentaco -c statesman
 
 # Access UI locally
-kubectl port-forward svc/opentaco-ui 3030:3030 -n opentaco
+kubectl port-forward svc/opentaco-taco-ui 3030:3030 -n opentaco
 open http://localhost:3030
 ```
 
@@ -294,19 +294,21 @@ Services communicate via Kubernetes DNS:
 
 ```bash
 # From within the cluster:
-http://opentaco-digger-backend-web:3000
-http://opentaco-drift:3004
-http://opentaco-statesman:8080
-http://opentaco-ui:3030
+http://opentaco-taco-orchestrator-web:3000
+http://opentaco-taco-drift:3004
+http://opentaco-taco-statesman:8080
+http://opentaco-taco-ui:3030
 ```
 
 These URLs are configured in `ui.env`:
 ```bash
-ORCHESTRATOR_BACKEND_URL="http://opentaco-digger-backend-web:3000"
-DRIFT_REPORTING_BACKEND_URL="http://opentaco-drift:3004"
-STATESMAN_BACKEND_URL="http://opentaco-statesman:8080"
+ORCHESTRATOR_BACKEND_URL="http://opentaco-taco-orchestrator-web:3000"
+DRIFT_REPORTING_BACKEND_URL="http://opentaco-taco-drift:3004"
+STATESMAN_BACKEND_URL="http://opentaco-taco-statesman:8080"
 ```
 
+If you install with a release name other than `opentaco`, adjust these hostnames to match that release prefix.
+
 ## Upgrading
 
 ```bash
@@ -343,7 +345,7 @@ kubectl logs POD_NAME -n opentaco
 kubectl get secrets -n opentaco
 
 # Verify secret contents
-kubectl get secret backend-secrets -n opentaco -o jsonpath='{.data}' | jq 'keys'
+kubectl get secret taco-orchestrator-secrets -n opentaco -o jsonpath='{.data}' | jq 'keys'
 ```
 
 ### Cloud SQL connection issues
```

**File**: `self-hosting/kubernetes/helm-charts/opentaco/Chart.yaml` (modified, +7/-8)
```diff
@@ -2,7 +2,7 @@ apiVersion: v2
 name: opentaco
 description: OpenTaco - Complete Infrastructure-as-Code platform deployment
 type: application
-version: 0.1.1-public
+version: 0.1.2-public
 appVersion: "0.1.0"
 
 # Umbrella chart that deploys all OpenTaco components
@@ -17,47 +17,47 @@ appVersion: "0.1.0"
 dependencies:
   # Taco Orchestrator - terraform orchestration backend
   - name: taco-orchestrator
-    version: "0.1.1-public"
+    version: "0.1.2-public"
     repository: "oci://ghcr.io/diggerhq/helm-charts"
     condition: taco-orchestrator.enabled
     tags:
       - backend
 
   # Taco Statesman - IaC state management  
   - name: taco-statesman
-    version: "0.1.1-public"
+    version: "0.1.2-public"
     repository: "oci://ghcr.io/diggerhq/helm-charts"
     condition: taco-statesman.enabled
     tags:
       - backend
 
   # Taco Sidecar - sandbox sidecar service
   - name: taco-sidecar
-    version: "0.1.3-public"
+    version: "0.1.4-public"
     repository: "oci://ghcr.io/diggerhq/helm-charts"
     condition: taco-sidecar.enabled
     tags:
       - backend
 
   # Token Service - API token management
   - name: taco-token-service
-    version: "0.1.1-public"
+    version: "0.1.2-public"
     repository: "oci://ghcr.io/diggerhq/helm-charts"
     condition: taco-token-service.enabled
     tags:
       - backend
 
   # Drift Detection
   - name: taco-drift
-    version: "0.1.1-public"
+    version: "0.1.2-public"
     repository: "oci://ghcr.io/diggerhq/helm-charts"
     condition: taco-drift.enabled
     tags:
       - backend
 
   # Taco UI - React frontend
   - name: taco-ui
-    version: "0.1.2-public"
+    version: "0.1.3-public"
     repository: "oci://ghcr.io/diggerhq/helm-charts"
     condition: taco-ui.enabled
     tags:
@@ -73,4 +73,3 @@ keywords:
   - iac
   - opentaco
   - digger
-
```

**File**: `self-hosting/kubernetes/helm-charts/opentaco/values-production.yaml.example` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 # Copy this file and customize for your environment.
 
 global:
-  imageRegistry: ghcr.io/diggerhq/digger
+  imageRegistry: ghcr.io/diggerhq
   imagePullPolicy: IfNotPresent
 
 # ============================================================================
```

**File**: `self-hosting/kubernetes/helm-charts/opentaco/values-test.yaml.example` (modified, +1/-2)
```diff
@@ -5,7 +5,7 @@
 # Global Configuration
 # ============================================================================
 global:
-  imageRegistry: ghcr.io/diggerhq/digger
+  imageRegistry: ghcr.io/diggerhq
   imagePullPolicy: IfNotPresent
   # Note: imagePullSecrets not needed for public GHCR images
   # imagePullSecrets:
@@ -80,4 +80,3 @@ taco-ui:
       allowedHosts: "localhost" 
     ingress:
       enabled: false  # Using port-forward for testing
-
```

**File**: `self-hosting/kubernetes/helm-charts/opentaco/values.yaml` (modified, +16/-10)
```diff
@@ -13,7 +13,11 @@
 # ============================================================================
 global:
   # Image registry for all custom images
-  imageRegistry: ghcr.io/diggerhq/digger
+  imageRegistry: ghcr.io/diggerhq
+
+  # Pod annotations applied to all subchart workloads by default.
+  # Each subchart can override these keys via its own podAnnotations map.
+  podAnnotations: {}
   
   # Image pull policy
   imagePullPolicy: IfNotPresent
@@ -45,7 +49,7 @@ taco-orchestrator:
   
   digger:
     image:
-      repository: digger-backend-ee
+      repository: digger_backend
       tag: "latest"
     
     replicaCount: 1
@@ -92,7 +96,7 @@ taco-statesman:
   
   taco:
     image:
-      repository: taco-statesman
+      repository: digger/taco-statesman
       tag: "latest"
     
     replicaCount: 1
@@ -142,7 +146,7 @@ taco-token-service:
   
   tokenService:
     image:
-      repository: taco-token-service
+      repository: digger/taco-token-service
       tag: "v0.1.0"
       pullPolicy: "IfNotPresent"
     
@@ -199,7 +203,7 @@ taco-drift:
   
   drift:
     image:
-      repository: drift
+      repository: digger/drift
       tag: "latest"
     
     replicaCount: 1
@@ -246,7 +250,7 @@ taco-ui:
   
   ui:
     image:
-      repository: taco-ui
+      repository: digger/taco-ui
       tag: "v0.1.0"
     
     replicaCount: 1
@@ -264,10 +268,12 @@ taco-ui:
       
       # Backend service URLs (for server-side API calls)
       backends:
-        orchestratorUrl: "http://taco-orchestrator:3000"
-        driftReportingUrl: "http://taco-drift:3004"
-        statesmanUrl: "http://taco-statesman:8080"
-        tokensServiceUrl: "http://taco-token-service:8081"
+        # These defaults assume release name "opentaco".
+        # If you install with a different release name, update these hostnames.
+        orchestratorUrl: "http://opentaco-taco-orchestrator-web:3000"
+        driftReportingUrl: "http://opentaco-taco-drift:3004"
+        statesmanUrl: "http://opentaco-taco-statesman:8080"
+        tokensServiceUrl: "http://opentaco-taco-token-service:8081"
     
     ingress:
       enabled: false
```

**File**: `self-hosting/kubernetes/helm-charts/taco-drift/Chart.yaml` (modified, +1/-1)
```diff
@@ -2,6 +2,6 @@ apiVersion: v2
 name: taco-drift
 description: Taco Drift - Automated infrastructure drift detection and reporting service
 type: application
-version: 0.1.1-public
+version: 0.1.2-public
 appVersion: "v0.1.0"
 icon: https://raw.githubusercontent.com/diggerhq/digger/main/docs/logo/digger-logo.png
```

**File**: `self-hosting/kubernetes/helm-charts/taco-drift/templates/cronjobs.yaml` (modified, +9/-0)
```diff
@@ -5,6 +5,7 @@
 {{- else }}
 {{- $driftSecretName = printf "%s-secret" (include "digger-drift.fullname" .) -}}
 {{- end }}
+{{- $podAnnotations := mergeOverwrite (dict) (default (dict) .Values.global.podAnnotations) (default (dict) .Values.drift.podAnnotations) -}}
 apiVersion: batch/v1
 kind: CronJob
 metadata:
@@ -23,6 +24,10 @@ spec:
     spec:
       template:
         metadata:
+          {{- if $podAnnotations }}
+          annotations:
+            {{- toYaml $podAnnotations | nindent 12 }}
+          {{- end }}
           labels:
             app.kubernetes.io/name: {{ include "digger-drift.name" . }}
             app.kubernetes.io/instance: {{ .Release.Name }}
@@ -68,6 +73,10 @@ spec:
     spec:
       template:
         metadata:
+          {{- if $podAnnotations }}
+          annotations:
+            {{- toYaml $podAnnotations | nindent 12 }}
+          {{- end }}
           labels:
             app.kubernetes.io/name: {{ include "digger-drift.name" . }}
             app.kubernetes.io/instance: {{ .Release.Name }}
```

---

### Incident Patch 10: `5be10130` (2026-04-24)
**Commit Message**: fix: add target url to link to workflow run (#2606)

**File**: `libs/ci/github/github.go` (modified, +3/-0)
```diff
@@ -10,6 +10,7 @@ import (
 
 	"github.com/diggerhq/digger/libs/ci"
 	"github.com/diggerhq/digger/libs/ci/generic"
+	"github.com/diggerhq/digger/libs/comment_utils"
 	"github.com/diggerhq/digger/libs/scheduler"
 
 	"github.com/diggerhq/digger/libs/digger_config"
@@ -349,11 +350,13 @@ func (svc GithubService) SetStatus(prNumber int, status string, statusContext st
 	// 422 Validation Failed [{Resource:Status Field:description Code:custom Message:description is too long (maximum is 140 characters)}]
 	// since description isn't shown in ui setting to blank for now
 	description := ""
+	targetURl := comment_utils.GetWorkflowUrl()
 
 	_, _, err = svc.Client.Repositories.CreateStatus(context.Background(), svc.Owner, svc.RepoName, *pr.Head.SHA, &github.RepoStatus{
 		State:       &status,
 		Context:     &statusContext,
 		Description: &description,
+		TargetURL:   &targetURl,
 	})
 	return err
 }
```

---

### Incident Patch 11: `7cf6b27d` (2026-04-24)
**Commit Message**: docs: secuirty page (#2605)

**File**: `docs/ce/securing-digger/external-provider.mdx` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
----
-title: "External providers code execution"
----
-
-Digger executes terraform in github actions within previlliged environments. Since terraform has the ability
-to execute arbitrary code based on data blocks or external providers this can lead to a user with malicious
-intent to expose the environment variables within the CI environment, potentially leaking cloud secrets.
-
-How to avoid this?
----
-Currently we are exploring solutions to avoid this security threat. The first thing you should do is to
-not use long-lived credentials to connect to your cloud account. Instead rely on OIDC for short-lived
-credentials to minimise the exposure from this threat. Secondly its important to ensure that only trusted
-individuals are allowed to update the terraform code. We are also working on additional solutions to secure
-against this threat. For more details and to engage in the discussion please take a look at this github issue:
-https://github.com/diggerhq/digger/issues/1530
```

**File**: `docs/ce/security/overview.mdx` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+---
+title: "Security overview"
+description: "Security considerations for self-hosted OpenTaco deployments."
+---
+
+If you run OpenTaco on a shared server, or within a network that hosts other services, those services may be vulnerable to exploitation by proxy or other means.
+
+This is a non-exhaustive list of security considerations when running the self-hosted version of OpenTaco. For deployment options, see [Self-hosting with Docker Compose](/self-hosting/docker-compose).
+
+## Credential security
+
+Prefer short-lived credentials over static keys. Digger supports OIDC-based authentication for both AWS and GCP, which eliminates the need to store long-lived access keys as CI secrets.
+
+<Tabs>
+  <Tab title="AWS">
+    Use `aws-role-to-assume` with `id-token: write` permissions instead of `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
+
+    See [AWS: Authenticate with OIDC](/ce/cloud-providers/authenticating-with-oidc-on-aws) for setup.
+  </Tab>
+  <Tab title="GCP">
+    Use Workload Identity Federation with a service account binding instead of a service account key file.
+
+    See [GCP: Federated OIDC access](/ce/gcp/federated-oidc-access) for setup.
+  </Tab>
+</Tabs>
+
+For multi-account setups, assign per-project IAM roles so each project only has access to its own infrastructure:
+
+```yaml
+projects:
+  - name: prod
+    dir: prod
+    aws_role_to_assume:
+      state: "arn:aws:iam::ACCOUNT_ID:role/digger-state-prod"
+      command: "arn:aws:iam::ACCOUNT_ID:role/digger-apply-prod"
+      aws_role_region: us-east-1
+```
+
+See [Project-level roles](/ce/howto/project-level-roles) and [Segregate cloud accounts](/ce/howto/segregate-cloud-accounts).
+
+<Warning>
+  Terraform supports `data` blocks and external providers that can execute arbitrary code inside your CI runner. A contributor with write access to your Terraform code could use this to exfiltrate CI environment variables, including cloud credentials. Mitigate by enforcing OIDC (short-lived credentials) and restricting who can merge Terraform changes.
+</Warning>
+
+## Access control
+
+Control who can trigger applies and under what conditions.
+
+**Apply requirements** gate applies on PR state. For production projects, require both approval and an up-to-date branch:
+
+```yaml
+projects:
+  - name: prod
+    dir: prod
+    apply_requirements: [mergeable, approved, undiverged]
+```
+
+See [Apply requirements](/ce/howto/apply-requirements) for all options.
+
+**CODEOWNERS** ensures the right team reviews changes before Digger allows an apply. Since Digger checks GitHub's mergeability status before applying, CODEOWNERS enforcement requires no additional Digger configuration — only a branch protection rule on your default branch with "Require review from Code Owners" enabled.
+
+See [Codeowners integration](/ce/howto/codeowners).
+
+**Auth methods** for the self-hosted orchestrator backend — use JWT auth (via Frontegg) for production. Basic auth is convenient for testing but not recommended for production workloads.
+
+See [Auth methods](/ce/self-host/auth-methods).
+
+**RBAC** for Terraform state access is available in the state management backend when using S3 storage. Scope permissions to specific directories using resource paths like `dev/*` or `myapp/prod`.
+
+See [RBAC](/ce/state-management/rbac).
+
+## Secret handling
+
+Prevent sensitive values from appearing in Terraform plan output and PR comments using `filter_regex`:
+
+```yaml
+workflows:
+  default:
+    plan:
+      filter_regex: "((?i)secret:\\s\"?)[^\"]+"
+      steps:
+        - init
+        - plan
+```
+
+Any match is replaced with `<REDACTED>` in logs and PR comments. See [Masking sensitive values](/ce/howto/masking-sensitive-values).
+
+## Kubernetes
+
+When deploying with Helm, do not set secret values inline in your chart values file for production deployments. Pre-create Kubernetes secrets and reference them:
+
+```yaml
+# values-opentaco.yaml
+ui:
+  useExistingSecret: true
+  existingSecretName: ui-secrets
+```
+
+Create the secrets from your env files:
+
+```bash
+kubectl create secret generic ui-secrets \
+  --from-env-file=helm-charts/secrets-example/ui.env \
+  -n opentaco --dry-run=client -o yaml | kubectl apply -f -
+```
+
+Use the [External Secrets Operator](https://external-secrets.io/) or your organization's preferred secret lifecycle tool (Vault, AWS Secrets Manager, etc.) to manage rotation.
+
+Keep the `opentaco` and `traefik` namespaces isolated. The platform reference chart is a quickstart baseline — it is not a production-hardening blueprint.
+
+<Note>
+  To run Digger jobs inside your cluster's VPC, use the [Actions Runner Controller (ARC)](https://github.com/actions/actions-runner-controller) to provision GitHub Actions self-hosted runners directly in Kubernetes. See [Private runners](/ce/features/private-runners).
+</Note>
+
+## Related
+
+- [AWS: Authenticate with OIDC](/ce/cloud-providers/authenticating-with-oidc-on-aws)
+- [GC
```

**File**: `docs/docs.json` (modified, +6/-0)
```diff
@@ -145,6 +145,12 @@
               "ce/state-management/versioning"
             ]
           },
+          {
+            "group": "Security",
+            "pages": [
+              "ce/security/overview"
+            ]
+          },
           {
             "group": "PR Automation",
             "pages": [
```

---

### Incident Patch 12: `f33fe56a` (2026-04-24)
**Commit Message**: docs: recommend docker-compose guide (#2604)

**File**: `docs/ce/local-development/overview.mdx` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@ description: Docker Compose first, plus hybrid workflows for running selected se
 
 This section describes the recommended development workflow now that the full stack is available in `self-hosting/docker-compose`.
 
+<Tip>
+  If you don't need to run services locally, use the [Docker Compose self-hosting guide](/self-hosting/docker-compose) instead. To run only selected services locally, skip to [Core services](#core-services) below.
+</Tip>
+
 ## Recommended baseline
 
 Start with Docker Compose for everything, then move a single service to host runtime when you need faster iteration.
```

---

### Incident Patch 13: `4d2ffa86` (2026-04-24)
**Commit Message**: fix: upgrade azure/login to v2.2.0 to prevent cleanup warnings (#2584)

Upgrades azure/login from v2.1.1 to v2.2.0 which includes support for
AZURE_LOGIN_POST_CLEANUP environment variable via post-if condition.

The env var is set to false when setup-azure is not true, preventing
the cleanup step from running and eliminating the warning about missing
az CLI when Azure is not being used.

Fixes #2540

**File**: `action.yml` (modified, +5/-1)
```diff
@@ -362,11 +362,15 @@ runs:
       if: ${{ inputs.setup-aws == 'true' && inputs.aws-role-to-assume != '' }}
 
     - name: Configure OIDC Azure credentials
-      uses: azure/login@6c251865b4e6290e7b78be643ea2d005bc51f69a # v2.1.1
+      uses: azure/login@a65d910e8af852a8061c627c456678983e180302 # v2.2.0
       with:
         client-id: ${{ inputs.azure-client-id }}
         tenant-id: ${{ inputs.azure-tenant-id }}
         subscription-id: ${{ inputs.azure-subscription-id }}
+      env:
+        # Disable post-cleanup when Azure is not being used (v2.2.0+ feature)
+        # See: https://github.com/Azure/login/pull/484
+        AZURE_LOGIN_POST_CLEANUP: ${{ inputs.setup-azure == 'true' && 'true' || 'false' }}
       if: ${{ inputs.setup-azure == 'true' && inputs.azure-client-id != '' }}
 
     # if terraform-cache-dir is set then we set it to that otherwise set it to '${{github.workspace}}/cache'
```

---

### Incident Patch 14: `9807a1fb` (2026-04-14)
**Commit Message**: ui github setup link fix (#2642)

**File**: `ui/src/lib/env.server.ts` (modified, +2/-0)
```diff
@@ -10,6 +10,7 @@ export type Env = {
   PUBLIC_HOSTNAME: string
   STATESMAN_BACKEND_URL: string
   WORKOS_REDIRECT_URI: string
+  ORCHESTRATOR_GITHUB_APP_URL: string
   POSTHOG_KEY?: string
   POSTHOG_HOST?: string
 }
@@ -21,6 +22,7 @@ export const getPublicServerConfig = createServerFn({ method: 'GET' })
       PUBLIC_HOSTNAME: process.env.PUBLIC_URL?.replace('https://', '').replace('http://', '') ?? '',
       STATESMAN_BACKEND_URL: process.env.STATESMAN_BACKEND_URL ?? '',
       WORKOS_REDIRECT_URI: process.env.WORKOS_REDIRECT_URI ?? '',
+      ORCHESTRATOR_GITHUB_APP_URL: process.env.ORCHESTRATOR_GITHUB_APP_URL ?? '',
       POSTHOG_KEY: process.env.POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.VITE_PUBLIC_POSTHOG_KEY || '',
       POSTHOG_HOST: process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || process.env.VITE_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
     } as Env
```

**File**: `ui/src/routes/_authenticated/_dashboard/dashboard/onboarding.tsx` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ export const Route = createFileRoute(
   loader: async ({ context }) => {
     const { user, organisationId, publicServerConfig } = context
     const publicHostname = publicServerConfig?.PUBLIC_HOSTNAME || ''
-    const githubAppUrl = '/orchestrator/github/setup'
+    const githubAppUrl = publicServerConfig?.ORCHESTRATOR_GITHUB_APP_URL || ''
     return { user, organisationId, publicHostname, githubAppUrl  }
   },
 })
```

---

### Incident Patch 15: `6ba72cff` (2026-03-25)
**Commit Message**: add timeout to generate service client so it does not fail (#2622)

**File**: `backend/utils/ai.go` (modified, +3/-2)
```diff
@@ -7,6 +7,7 @@ import (
 	"io"
 	"log/slog"
 	"net/http"
+	"time"
 )
 
 func GenerateTerraformCode(appCode string, generationEndpoint string, apiToken string) (string, error) {
@@ -38,7 +39,7 @@ func GenerateTerraformCode(appCode string, generationEndpoint string, apiToken s
 	req.Header.Set("Authorization", "Bearer "+apiToken)
 
 	// Make the request
-	client := &http.Client{}
+	client := &http.Client{Timeout: 30 * time.Second}
 	resp, err := client.Do(req)
 	if err != nil {
 		slog.Error("Error making request to code generation API", "endpoint", generationEndpoint, "error", err)
@@ -118,7 +119,7 @@ func GetAiSummaryFromTerraformPlans(plans string, summaryEndpoint string, apiTok
 	req.Header.Set("Authorization", "Bearer "+apiToken)
 
 	// Make the request
-	client := &http.Client{}
+	client := &http.Client{Timeout: 30 * time.Second}
 	resp, err := client.Do(req)
 	if err != nil {
 		slog.Error("Error making request to summary API", "endpoint", summaryEndpoint, "error", err)
```

#### Recent Merged Pull Requests:
- **PR #2724** (2026-09-30): fix: honor git_timeout from digger.yml before cloning (@s1ntaxe770r)
- **PR #2723** (closed): Sync with fork (@nis-thac)
- **PR #2718** (closed): fix: replace O(teams x members) REST scan in GetUserTeams with GraphQL (@sav-hostaway)
- **PR #2716** (closed): fix: keep check run text within GitHub's 65535 character limit (@schniedergers)
- **PR #2712** (closed): fix: dispatch cli_release.yml explicitly when recreating vLatest (@joshuamkite-nfb)
- **PR #2709** (2026-09-13): fix: replace unmaintained terragrunt and tfenv setup actions with shell steps (@s1ntaxe770r)
- **PR #2708** (2026-09-12): ci: bump workflow actions to Node 24 majors ahead of 2026-09-23 Node 20 removal (@s1ntaxe770r)
- **PR #2706** (2026-09-10): feat: make git clone timeout configurable via digger.yml (@s1ntaxe770r)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): diggerhq/digger

> **Canonical Artifact**: `07_PROJECT_LEARNING/diggerhq-digger-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/diggerhq/digger](https://github.com/diggerhq/digger))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:31:32.182Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `diggerhq/digger`
- **Description**: Digger is an open source IaC orchestration tool. Digger allows you to run IaC in your existing CI pipeline ⚡️  
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5045 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/bootstrap/main.go`
```
package bootstrap

import (
	"embed"
	"fmt"
	"html/template"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"runtime/pprof"

	"github.com/diggerhq/digger/backend/config"
	"github.com/diggerhq/digger/backend/logging"
	"github.com/diggerhq/digger/backend/segment"
	"github.com/diggerhq/digger/backend/utils"
	pprof_gin "github.com/gin-contrib/pprof"

	"time"

	"github.com/diggerhq/digger/backend/controllers"
	"github.com/diggerhq/digger/backend/middleware"
	"github.com/diggerhq/digger/backend/models"
	"github.com/getsentry/sentry-go"
	sentrygin "github.com/getsentry/sentry-go/gin"
	"github.com/gin-contrib/sessions"
	gormsessions "github.com/gin-contrib/sessions/gorm"
	"github.com/gin-gonic/gin"
)

// based on https://www.digitalocean.com/community/tutorials/using-ldflags-to-set-version-information-for-go-applications
var Version = "dev"

func setupProfiler(r *gin.Engine) {
	// Enable pprof endpoints
	pprof_gin.Register(r)

	// Create profiles directory if it doesn't exist
	if err := os.MkdirAll("/tmp/profiles", 0755); err != nil {
		slog.Error("Failed to create profiles directory", "error", err)
		panic(err)
	}

	// Start periodic profiling goroutine
	go periodicProfiling()
}

func periodicProfiling() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Trigger GC before taking memory profile
			runtime.GC()

			// Create memory profile
			timestamp := time.Now().Format("2006-01-02-15-04-05")
			memProfilePath := filepath.Join("/tmp/profiles", fmt.Sprintf("memory-%s.pprof", timestamp))
			f, err := os.Create(memProfilePath)
			if err != nil {
				slog.Error("Failed to create memory profile", "error", err)
				continue
			}

			if err := pprof.WriteHeapProfile(f); err != nil {
				slog.Error("Failed to write memory profile", "error", err)
			}
			f.Close()

			// Cleanup old profiles (keep last 24)
			cleanupOldProfiles("/tmp/profiles", 168)
		}
	}
}

func cleanupOldProfiles(dir string, keep int) {
	files, err := filepath.Glob(filepath.Join(dir, "memory-*.pprof"))
	if err != nil {
		slog.Error("Failed to list profile files", "error", err)
		return
	}

	if len(files) <= keep {
		return
	}

	// Sort files by name (which includes timestamp)
	for i := 0; i < len(files)-keep; i++ {
		if err := os.Remove(files[i]); err != nil {
			slog.Error("Failed to remove old profile", "file", files[i], "error", err)
		}
	}
}

func Bootstrap(templates embed.FS, diggerController controllers.DiggerController) *gin.Engine {
	defer segment.CloseClient()
	logging.Init()
	cfg := config.DiggerConfig

	if err := sentry.Init(sentry.ClientOptions{
		Dsn:           os.Getenv("SENTRY_DSN"),
		EnableTracing: true,
		// Set TracesSampleRate to 1.0 to capture 100%
		// of transactions for performance monitoring.
		// We recommend adjusting this value in production,
		TracesSampleRate: 0.1,
		Release:          "api@" + Version,
		Debug:            true,
		DebugWriter:      utils.NewSentrySlogWriter(slog.Default().WithGroup("sentry")),
	}); err != nil {
		slog.Error("Sentry initialization failed", "error", err)
	}

	//database migrations
	models.ConnectDatabase()

	r := gin.Default()

	r.Use(logging.Middleware())

	if _, exists := os.LookupEnv("DIGGER_PPROF_DEBUG_ENABLED"); exists {
		setupProfiler(r)
	}

	// TODO: check "secret"
	store := gormsessions.NewStore(models.DB.GormDB, true, []byte("secret"))

	r.Use(sessions.Sessions("digger-session", store))

	r.Use(sentrygin.New(sentrygin.Options{Repanic: true}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"build_date":  cfg.GetString("build_date"),
			"deployed_at": cfg.GetString("deployed_at"),
			"version":     Version,
			"commit_sha":  Version,
		})
	})

	r.SetFuncMap(template.FuncMap{
		"formatAsDate": func(msec int64) time.Time {
			return time.UnixMilli(msec)
		},
	})

	if _, err := os.Stat("templates"); err != nil {
		matches, _ := fs.Glob(templates, "templates/*.tmpl")
		for _, match := range matches {
			r.LoadHTMLFiles(match)
		}
		r.StaticFS("/static", http.FS(templates))
	} else {
		r.Static("/static", "./templates/static")
		r.LoadHTMLGlob("templates/*.tmpl")
	}

	// Canonical GitHub App webhook endpoint.
	r.POST("/github/webhook", diggerController.GithubAppWebHook)
	// Legacy webhook path kept for backward compatibility.
	r.POST("/github-app-webhook", diggerController.GithubAppWebHook)

	tenantActionsGroup := r.Group("/api/tenants")
	tenantActionsGroup.Use(middleware.CORSMiddleware())
	tenantActionsGroup.Any("/associateTenantIdToDiggerOrg", controllers.AssociateTenantIdToDiggerOrg)

	githubGroup := r.Group("/github")
	githubGroup.Use(middleware.GetWebMiddleware())
	// authless endpoint because we no longer rely on orgId
	r.GET("/github/callback", diggerController.GithubAppCallbackPage)
	githubGroup.GET("/repos", diggerController.GithubReposPage)
	githubGroup.GET("/setup", controllers.GithubAppSetup)
	githubGroup.GET("/exchange-code", diggerController.GithubSetupExchangeCode)

	publicPrefix := utils.NormalizePublicPathPrefix(os.Getenv("DIGGER_PUBLIC_PATH_PREFIX"))
	if publicPrefix != "" {
		prefixed := r.Group(publicPrefix)
		prefixed.POST("/github/webhook", diggerController.GithubAppWebHook)
		prefixed.POST("/github-app-webhook", diggerController.GithubAppWebHook)

		prefixedGithubGroup := prefixed.Group("/github")
		prefixedGithubGroup.Use(middleware.GetWebMiddleware())
		prefixed.GET("/github/callback", diggerController.GithubAppCallbackPage)
		prefixedGithubGroup.GET("/repos", diggerController.GithubReposPage)
		prefixedGithubGroup.GET("/setup", controllers.GithubAppSetup)
		prefixedGithubGroup.GET("/exchange-code", diggerController.GithubSetupExchangeCode)
	}

	authorized := r.Group("/")
	authorized.Use(middleware.GetApiMiddleware(), middleware.AccessLevel(models.CliJobAccessType, models.AccessPolicyType, models.AdminPolicyType))

	admin := r.Group("/")
	admin.Use(middleware.GetApiMiddleware(), middleware.AccessLevel(models.AdminPolicyType))

	fronteggWebhookProcessor := r.Group("/")
	fronteggWebhookProcessor.Use(middleware.SecretCodeAuth())

	authorized.GET("/repos/:repo/projects/:projectName/access-policy", controllers.FindAccessPolicy)
	authorized.GET("/orgs/:organisation/access-policy", controllers.FindAccessPolicyForOrg)

	authorized.GET("/repos/:repo/projects/:projectName/plan-policy", controllers.FindPlanPolicy)
	authorized.GET("/orgs/:organisation/plan-policy", controllers.FindPlanPolicyForOrg)

	authorized.GET("/repos/:repo/projects/:projectName/drift-policy", controllers.FindDriftPolicy)
	authorized.GET("/orgs/:organisation/drift-policy", controllers.FindDriftPolicyForOrg)

	authorized.GET("/repos/:repo/projects/:projectName/runs", controllers.RunHistoryForProject)

	authorized.POST("/repos/:repo/projects/:projectName/jobs/:jobId/set-status", diggerController.SetJobStatusForProject)

	authorized.GET("/repos/:repo/projects", controllers.FindProjectsForRepo)
	authorized.POST("/repos/:repo/report-projects", controllers.ReportProjectsForRepo)

	authorized.GET("/orgs/:organisation/projects", controllers.FindProjectsForOrg)

	admin.PUT("/repos/:repo/projects/:projectName/access-policy", controllers.UpsertAccessPolicyForRepoAndProject)
	admin.PUT("/orgs/:organisation/access-policy", controllers.UpsertAccessPolicyForOrg)

	admin.PUT("/repos/:repo/projects/:projectName/plan-policy", controllers.UpsertPlanPolicyForRepoAndProject)
	admin.PUT("/orgs/:organisation/plan-policy", controllers.UpsertPlanPolicyForOrg)

	admin.PUT("/repos/:repo/projects/:projectName/drift-policy", controllers.UpsertDriftPolicyForRepoAndProject)
	admin.PUT("/orgs/:organisation/drift-policy", controllers.UpsertDriftPolicyForOrg)

	admin.POST("/tokens/issue-access-token", controllers.IssueAccessTokenForOrg)

	r.Use(middleware.CORSMiddleware())

	// internal endpoints not meant to be exposed to public and protected behind webhook secret
	if enableInternal := os.Getenv("DIGGER_ENABLE_INTERNAL_ENDPOINTS"); enableInternal == "true" {
		r.POST("_inte
```

### Core Architecture Module: `backend/ci_backends/ci_backends.go`
```
package ci_backends

import (
	"github.com/diggerhq/digger/backend/utils"
	"github.com/diggerhq/digger/libs/spec"
)

type CiBackend interface {
	TriggerWorkflow(spec spec.Spec, runName string, vcsToken string) error
	GetWorkflowUrl(spec spec.Spec) (string, error)
}

type JenkinsCi struct{}

type CiBackendOptions struct {
	GithubClientProvider        utils.GithubClientProvider
	GithubInstallationId        int64
	GithubAppId                 int64
	GitlabProjectId             int
	GitlabmergeRequestEventName string
	GitlabCIPipelineID          string
	GitlabCIPipelineIID         int
	GitlabCIMergeRequestID      int
	GitlabCIMergeRequestIID     int
	GitlabCIProjectName         string
	GitlabciprojectNamespace    string
	GitlabciprojectId           int
	GitlabciprojectNamespaceId  int
	GitlabDiscussionId          string
	RepoFullName                string
	RepoOwner                   string
	RepoName                    string
}

```

### Core Architecture Module: `backend/ci_backends/github_actions.go`
```
package ci_backends

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/diggerhq/digger/backend/utils"
	orchestrator_scheduler "github.com/diggerhq/digger/libs/scheduler"
	"github.com/diggerhq/digger/libs/spec"
	"github.com/google/go-github/v61/github"
)

type GithubActionCi struct {
	Client *github.Client
}

func (g GithubActionCi) TriggerWorkflow(spec spec.Spec, runName string, vcsToken string) error {
	slog.Info("TriggerGithubWorkflow", "repoOwner", spec.VCS.RepoOwner, "repoName", spec.VCS.RepoName, "commentId", spec.CommentId)
	client := g.Client
	specBytes, err := json.Marshal(spec)

	inputs := orchestrator_scheduler.WorkflowInput{
		Spec:    string(specBytes),
		RunName: runName,
	}

	_, err = client.Actions.CreateWorkflowDispatchEventByFileName(context.Background(), spec.VCS.RepoOwner, spec.VCS.RepoName, spec.VCS.WorkflowFile, github.CreateWorkflowDispatchEventRequest{
		Ref:    spec.Job.Branch,
		Inputs: inputs.ToMap(),
	})

	return err
}

func (g GithubActionCi) GetWorkflowUrl(spec spec.Spec) (string, error) {
	if spec.JobId == "" {
		slog.Error("Cannot get workflow URL: JobId is empty")
		return "", fmt.Errorf("job ID is required to fetch workflow URL")
	}

	_, workflowRunUrl, err := utils.GetWorkflowIdAndUrlFromDiggerJobId(g.Client, spec.VCS.RepoOwner, spec.VCS.RepoName, spec.JobId)
	if err != nil {
		return "", err
	} else {
		return workflowRunUrl, nil
	}
}

```

### Core Architecture Module: `backend/ci_backends/jenkins.go`
```
package ci_backends

```

### Core Architecture Module: `backend/ci_backends/provider.go`
```
package ci_backends

import (
	"fmt"
	"log/slog"

	"github.com/diggerhq/digger/backend/utils"
)

type CiBackendProvider interface {
	GetCiBackend(options CiBackendOptions) (CiBackend, error)
}

type DefaultBackendProvider struct{}

func (d DefaultBackendProvider) GetCiBackend(options CiBackendOptions) (CiBackend, error) {
	client, _, err := utils.GetGithubClientFromAppId(options.GithubClientProvider, options.GithubInstallationId, options.GithubAppId, options.RepoFullName)
	if err != nil {
		slog.Error("GetCiBackend: could not get github client", "error", err)
		return nil, fmt.Errorf("could not get github client: %v", err)
	}
	backend := &GithubActionCi{
		Client: client,
	}
	return backend, nil
}

```

### Core Architecture Module: `backend/config/config.go`
```
package config

import (
	"github.com/spf13/cast"
	"os"
	"strings"
	"time"

	"github.com/spf13/viper"
)

// Config represents an alias to viper config
type Config = viper.Viper

var DiggerConfig *Config

// New returns a new pointer to the config
func New() *Config {
	v := viper.New()
	v.SetEnvPrefix("DIGGER")
	v.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	v.SetDefault("port", 3000)
	v.SetDefault("usersvc_on", true)
	v.SetDefault("build_date", "null")
	v.SetDefault("deployed_at", time.Now().UTC().Format(time.RFC3339))
	v.SetDefault("max_concurrency_per_batch", "0")
	v.BindEnv()
	return v
}

func GetPort() int {
	port := cast.ToInt(os.Getenv("PORT"))
	if port == 0 {
		port = 3000
	}
	return port
}

func init() {
	cfg := New()
	cfg.AutomaticEnv()
	DiggerConfig = cfg
}

```

### Core Architecture Module: `backend/config/envgetters.go`
```
package config

import (
	"github.com/spf13/cast"
	"log/slog"
	"os"
)

func LimitByNumOfFilesChanged() bool {
	// if this flag is set then it will fail if there are more projects impacted than the
	// number of files changed
	return os.Getenv("DIGGER_LIMIT_MAX_PROJECTS_TO_FILES_CHANGED") == "1"
}

func MaxImpactedProjectsPerChange() int {
	m := os.Getenv("DIGGER_MAX_PROJECTS_PER_CHANGE")
	if m == "" {
		return 99999
	} else {
		v, err := cast.ToIntE(m)
		if err != nil {
			slog.Warn("unable to cast DIGGER_MAX_PROJECTS_PER_CHANGE to int, defaulting to 99999", "DIGGER_MAX_PROJECTS_PER_CHANGE", m)
			return 99999
		}
		return v
	}
}

```

### Core Architecture Module: `backend/controllers/activity.go`
```
package controllers

import (
	"errors"
	"fmt"
	"github.com/diggerhq/digger/backend/middleware"
	"github.com/diggerhq/digger/backend/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"net/http"
)

func GetActivity(c *gin.Context) {
	loggedInOrganisation, exists := c.Get(middleware.ORGANISATION_ID_KEY)

	if !exists {
		c.String(http.StatusForbidden, "Not allowed to access this resource")
		return
	}

	var org models.Organisation
	err := models.DB.GormDB.Where("id = ?", loggedInOrganisation).First(&org).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.String(http.StatusNotFound, fmt.Sprintf("Could not find organisation: %v", loggedInOrganisation))
		} else {
			c.String(http.StatusInternalServerError, "Unknown error occurred while fetching database")
		}
		return
	}

	runs, err := models.DB.GetProjectRunsForOrg(int(loggedInOrganisation.(uint)))
	if err != nil {
		c.String(http.StatusInternalServerError, "Unknown error occurred while fetching activity from database")
		return
	}

	marshalledRuns := make([]interface{}, 0)

	for _, run := range runs {
		marshalled := run.MapToJsonStruct()
		marshalledRuns = append(marshalledRuns, marshalled)
	}

	response := make(map[string]interface{})
	response["runs"] = marshalledRuns

	if err != nil {
		c.String(http.StatusInternalServerError, "Unknown error occurred while marshalling response")
		return
	}

	c.JSON(http.StatusOK, response)
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
@@ -433,7 +43
```

---

### Incident Patch 5: `3053cda2` (2026-07-21)
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

### Incident Patch 6: `53efc5d7` (2026-06-12)
**Commit Message**: fix: allow digger apply when digger/apply is the sole required blocking check (#2661)

When digger/apply is configured as a required GitHub branch protection check,
IsMergeable() returns false before the first apply runs (state is "blocked"),
preventing apply from ever executing. This inspects the actual check runs when
the PR is in a blocked state and bypasses the mergeability gate only when
digger/apply checks are the sole non-passing checks on the head commit.

Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>

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

### Incident Patch 7: `865b7802` (2026-05-13)
**Commit Message**: fix: drift exclude patterns excluding all projects when include is unset (#2653)

MatchIncludeExcludePatternsToFile initialized matching=false and only
flipped to true when an include pattern matched, so any caller passing
an empty include list (e.g. a digger.yml with drift_exclude_patterns but
no drift_include_patterns) had every project skipped by the drift
controller. Default to matching=true when the include list is empty so
the exclude list does the filtering on its own.

Co-authored-by: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

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

### Incident Patch 8: `7cdfeb30` (2026-04-24)
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

---

### Incident Patch 9: `5be10130` (2026-04-24)
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

### Incident Patch 10: `4d2ffa86` (2026-04-24)
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

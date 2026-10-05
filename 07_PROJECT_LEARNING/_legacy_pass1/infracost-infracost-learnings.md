# Forensic Learning Record (Deep Inspection): infracost/infracost

> **Canonical Artifact**: `07_PROJECT_LEARNING/infracost-infracost-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/infracost/infracost](https://github.com/infracost/infracost))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:23:33.293Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `infracost/infracost`
- **Description**: Cloud cost intelligence for engineers, AI coding agents, and CI/CD 💰📉 Shift FinOps Left!
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 12544 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/infracost/auth.go`
```
package main

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/infracost/infracost/internal/apiclient"
	"github.com/infracost/infracost/internal/config"
)

func authCmd(ctx *config.RunContext) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Get a free API key, or log in to your existing account",
		Long:  "Get a free API key, or log in to your existing account",
		Example: fmt.Sprintf(`  Get a free API key, or log in to your existing account:

      infracost auth login

      You can also log in at %v

  Manually set the API key that your CLI should use. The API key can be retrieved from your account:

      infracost configure set api_key MY_API_KEY

  Regenerate your API key:

      Log in at %v > select your organization > Settings`, ctx.Config.DashboardEndpoint, ctx.Config.DashboardEndpoint),
		ValidArgs: []string{"--", "-"},
		RunE: func(cmd *cobra.Command, args []string) error {
			return cmd.Help()
		},
	}

	cmds := []*cobra.Command{authLoginCmd(ctx)}
	cmd.AddCommand(cmds...)

	return cmd
}

func authLoginCmd(ctx *config.RunContext) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "login",
		Short: "Authenticate the CLI with your Infracost account",
		Long:  "Authenticate the CLI with your Infracost account",
		Example: fmt.Sprintf(`  Get a free API key, or log in to your existing account:

      infracost auth login

      You can also log in at %v

  Manually set the API key that your CLI should use. The API key can be retrieved from your account:

      infracost configure set api_key MY_API_KEY`, ctx.Config.DashboardEndpoint),
		ValidArgs: []string{"--", "-"},
		RunE: func(cmd *cobra.Command, _ []string) error {
			cmd.Println("We're redirecting you to our log in page, please complete that,\nand return here to continue using Infracost.")

			auth := apiclient.AuthClient{Host: ctx.Config.DashboardEndpoint}
			apiKey, info, err := auth.Login(ctx.ContextValues.Values())
			if err != nil {
				return err
			}

			if info != "" {
				cmd.Println(info)
				return nil
			}

			ctx.Config.Credentials.APIKey = apiKey
			ctx.Config.Credentials.PricingAPIEndpoint = ctx.Config.PricingAPIEndpoint

			err = ctx.Config.Credentials.Save()
			if err != nil {
				return err
			}

			fmt.Printf("The API key was saved to %s\n", config.CredentialsFilePath())
			cmd.Println("\nYour account has been authenticated. Run Infracost on your Terraform project by running:")
			cmd.Printf("\n  infracost breakdown --path=.\n\n")

			return nil
		},
	}

	return cmd
}

```

### Core Architecture Module: `cmd/infracost/breakdown.go`
```
package main

import (
	"fmt"

	"github.com/infracost/infracost/internal/metrics"
	"github.com/spf13/cobra"

	"github.com/infracost/infracost/internal/config"
	"github.com/infracost/infracost/internal/ui"
)

func breakdownCmd(ctx *config.RunContext) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "breakdown",
		Short: "Show breakdown of costs",
		Long:  "Show breakdown of costs",
		Example: `  Use Terraform directory:

      infracost breakdown --path /code --terraform-var-file my.tfvars

  Use Terraform plan JSON:

      terraform plan -out tfplan.binary
      terraform show -json tfplan.binary > plan.json
      infracost breakdown --path plan.json`,
		ValidArgs: []string{"--", "-"},
		RunE: checkAPIKeyIsValid(ctx, func(cmd *cobra.Command, args []string) error {

			timer := metrics.GetTimer("breakdown.total_duration", false).Start()
			defer func() {
				timer.Stop()
				if path := ctx.Config.MetricsPath; path != "" {
					if err := metrics.WriteMetrics(path); err != nil {
						_, _ = fmt.Fprintf(cmd.ErrOrStderr(), "Error writing metrics: %s\n", err)
					}
				}
			}()

			if err := checkAPIKey(ctx.Config.APIKey, ctx.Config.PricingAPIEndpoint, ctx.Config.DefaultPricingAPIEndpoint); err != nil {
				return err
			}

			err := loadRunFlags(ctx.Config, cmd)
			if err != nil {
				return err
			}

			ctx.ContextValues.SetValue("outputFormat", ctx.Config.Format)

			err = checkRunConfig(cmd.ErrOrStderr(), ctx.Config)
			if err != nil {
				ui.PrintUsage(cmd)
				return err
			}

			return runMain(cmd, ctx)
		}),
	}

	addRunFlags(cmd)

	cmd.Flags().String("out-file", "", "Save output to a file, helpful with format flag")
	cmd.Flags().Bool("terraform-use-state", false, "Use Terraform state instead of generating a plan. Applicable with --terraform-force-cli")
	newEnumFlag(cmd, "format", "table", "Output format", []string{"json", "table", "html"})
	cmd.Flags().StringSlice("fields", []string{"monthlyQuantity", "unit", "monthlyCost"}, "Comma separated list of output fields: all,price,monthlyQuantity,unit,hourlyCost,monthlyCost.\nSupported by table and html output formats")

	// This is deprecated and will show a warning if used without --terraform-force-cli
	_ = cmd.Flags().MarkHidden("terraform-use-state")

	return cmd
}

```

### Core Architecture Module: `cmd/infracost/comment.go`
```
package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/open-policy-agent/opa/ast"  //nolint:staticcheck // we need to use this deprecated package to support parsing of rego policies
	"github.com/open-policy-agent/opa/rego" //nolint:staticcheck // we need to use this deprecated package to support parsing of rego policies
	"github.com/spf13/cobra"

	"github.com/infracost/infracost/internal/apiclient"
	"github.com/infracost/infracost/internal/logging"

	"github.com/infracost/infracost/internal/clierror"
	"github.com/infracost/infracost/internal/config"
	"github.com/infracost/infracost/internal/output"
)

type CommentOutput struct {
	Body           string
	HasDiff        bool
	ValidAt        *time.Time
	AddRunResponse apiclient.AddRunResponse
}

var (
	validCommentOutputFormats = []string{
		"json",
	}
)

func commentCmd(ctx *config.RunContext) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "comment",
		Short: "Post an Infracost comment to GitHub, GitLab, Azure Repos or Bitbucket",
		Long:  "Post an Infracost comment to GitHub, GitLab, Azure Repos or Bitbucket",
		Example: `  Update the Infracost comment on a GitHub pull request:

      infracost comment github --repo my-org/my-repo --pull-request 3 --path infracost.json --behavior update --github-token $GITHUB_TOKEN

  Delete old Infracost comments and post a new comment to a GitLab commit:

      infracost comment gitlab --repo my-org/my-repo --commit 2ca7182 --path infracost.json --behavior delete-and-new --gitlab-token $GITLAB_TOKEN

  Post a new comment to an Azure Repos pull request:

      infracost comment azure-repos --repo-url https://dev.azure.com/my-org/my-project/_git/my-repo --pull-request 3 --path infracost.json --behavior new --azure-access-token $AZURE_ACCESS_TOKEN`,
		ValidArgs: []string{"--", "-"},
		RunE: func(cmd *cobra.Command, args []string) error {
			return cmd.Help()
		},
	}

	cmds := []*cobra.Command{commentGitHubCmd(ctx), commentGitLabCmd(ctx), commentAzureReposCmd(ctx), commentBitbucketCmd(ctx)}
	for _, subCmd := range cmds {
		subCmd.RunE = checkAPIKeyIsValid(ctx, subCmd.RunE)

		subCmd.Flags().StringArray("policy-path", nil, "Path to Infracost policy files, glob patterns need quotes (experimental)")
		subCmd.Flags().Bool("show-all-projects", false, "Show all projects in the table of the comment output")
		subCmd.Flags().Bool("show-changed", false, "Show only projects in the table that have code changes")
		subCmd.Flags().Bool("show-skipped", true, "List unsupported resources")
		_ = subCmd.Flags().MarkHidden("show-changed")
		subCmd.Flags().Bool("skip-no-diff", false, "Skip posting comment if there are no resource changes. Only applies to update, hide-and-new, and delete-and-new behaviors")
		_ = subCmd.Flags().MarkHidden("skip-no-diff")
		subCmd.Flags().String("comment-path", "", "Path to comment content file (experimental)")
		_ = subCmd.Flags().MarkHidden("comment-path")
	}

	cmd.AddCommand(cmds...)

	return cmd
}

func buildCommentOutput(cmd *cobra.Command, ctx *config.RunContext, paths []string, mdOpts output.MarkdownOptions) (*CommentOutput, error) {
	inputs, err := output.LoadPaths(paths)
	if err != nil {
		return nil, err
	}

	combined, err := output.Combine(inputs)
	if errors.As(err, &clierror.WarningError{}) {
		logging.Logger.Warn().Msg(err.Error())
	} else if err != nil {
		return nil, err
	}

	combined.IsCIRun = ctx.IsCIRun()

	var commentData string
	var governanceFailures output.GovernanceFailures
	dryRun, _ := cmd.Flags().GetBool("dry-run")
	var result apiclient.AddRunResponse
	if ctx.IsCloudUploadEnabled() && !dryRun {
		if ctx.Config.IsSelfHosted() {
			logging.Logger.Warn().Msg("Infracost Cloud is part of Infracost's hosted services. Contact hello@infracost.io for help.")
		} else {
			combined.Metadata.InfracostCommand = "comment"
			result = shareCombinedRun(ctx, combined, inputs)
			combined.RunID, combined.ShareURL, combined.CloudURL, governanceFailures = result.RunID, result.ShareURL, result.CloudURL, result.GovernanceFailures
			commentData = result.CommentMarkdown
		}
	}

	var out *CommentOutput

	commentPath, _ := cmd.Flags().GetString("comment-path")
	if commentPath != "" {
		commentData, err = output.LoadCommentData(commentPath)
		if err != nil {
			return nil, fmt.Errorf("Error loading %s used by --comment-path flag. %s", commentPath, err)
		}
	}

	if commentData != "" {
		// the full comment markdown has been received from the API addRun or loaded from the comment-path file,
		// so use that instead of building the output using the output.ToMarkdown templates.
		out = &CommentOutput{
			Body:           commentData,
			HasDiff:        combined.HasDiff(),
			ValidAt:        &combined.TimeGenerated,
			AddRunResponse: result,
		}
	}

	var policyChecks output.PolicyCheck
	policyPaths, _ := cmd.Flags().GetStringArray("policy-path")
	if len(policyPaths) > 0 {
		policyChecks, err = queryPolicy(policyPaths, combined)
		if err != nil {
			return nil, err
		}

		ctx.ContextValues.SetValue("passedPolicyCount", len(policyChecks.Passed))
		ctx.ContextValues.SetValue("failedPolicyCount", len(policyChecks.Failures))
	}

	if out == nil {
		opts := output.Options{
			DashboardEndpoint: ctx.Config.DashboardEndpoint,
			NoColor:           ctx.Config.NoColor,
			PolicyOutput:      output.NewPolicyOutput(policyChecks),
		}
		opts.ShowAllProjects, _ = cmd.Flags().GetBool("show-all-projects")
		opts.ShowOnlyChanges, _ = cmd.Flags().GetBool("show-changed")
		opts.ShowSkipped, _ = cmd.Flags().GetBool("show-skipped")

		md, err := output.ToMarkdown(combined, opts, mdOpts)
		if err != nil {
			return nil, err
		}

		b := md.Msg
		ctx.ContextValues.SetValue("truncated", md.OriginalMsgSize != md.RuneLen)
		ctx.ContextValues.SetValue("originalLength", md.OriginalMsgSize)

		out = &CommentOutput{
			Body:           string(b),
			HasDiff:        combined.HasDiff(),
			ValidAt:        &combined.TimeGenerated,
			AddRunResponse: result,
		}
	}

	if policyChecks.HasFailed() {
		return out, policyChecks.Failures
	}
	if len(governanceFailures) > 0 {
		return out, governanceFailures
	}

	return out, nil
}

type PRNumber int

func (p *PRNumber) Set(value string) error {
	if value == "" {
		return nil
	}

	v, err := strconv.Atoi(value)
	*p = PRNumber(v)

	if err != nil {
		return errors.New("must be integer")
	}

	return nil
}

func (p *PRNumber) String() string {
	return fmt.Sprintf("%d", *p)
}

func (p *PRNumber) Type() string {
	return "int"
}

func queryPolicy(policyPaths []string, input output.Root) (output.PolicyCheck, error) {
	checks := output.PolicyCheck{
		Enabled: true,
	}

	inputValue, err := ast.InterfaceToValue(input)
	if err != nil {
		return checks, fmt.Errorf("Unable to process Infracost output into Rego input: %s", err.Error())
	}

	ctx := context.Background()
	r := rego.New(
		rego.Query("data.infracost.deny"),
		rego.ParsedInput(inputValue),
		rego.Load(policyPaths, func(abspath string, info os.FileInfo, depth int) bool {
			return false
		}),
	)
	pq, err := r.PrepareForEval(ctx)
	if err != nil {
		return checks, fmt.Errorf("Unable to query provided policies: %s", err.Error())
	}

	res, err := pq.Eval(ctx)
	if err != nil {
		return checks, err
	}

	if len(res) == 0 {
		return checks, fmt.Errorf("The provided polices returned no valid data.infracost.deny rules. Please check that the policies are formatted correctly.")
	}

	for _, e := range res[0].Expressions {
		switch v := e.Value.(type) {
		case map[string]interface{}:
			readPolicyOut(v, &checks)
		case []interface{}:
			for _, ii := range v {
				if m, ok := ii.(map[string]interface{}); ok {
					readPolicyOut(m, &checks)
				}
			}
		}
	}

	return checks, nil
}

func readPolicyOut(v map[string]interface{}, checks *output.PolicyCheck) {
	if _, ok := v["msg"]; !ok {
		checks.Failures = append(checks.Failures, "Policy rule invalid as it did not contain {msg: string} property in output object. Please edit rule output object.")
		return
	}
	msg 
```

### Core Architecture Module: `cmd/infracost/comment_azure_repos.go`
```
package main

import (
	"fmt"
	"strconv"
	"strings"

	jsoniter "github.com/json-iterator/go"
	"github.com/spf13/cobra"

	"github.com/infracost/infracost/internal/apiclient"
	"github.com/infracost/infracost/internal/comment"
	"github.com/infracost/infracost/internal/config"
	"github.com/infracost/infracost/internal/logging"
	"github.com/infracost/infracost/internal/output"
	"github.com/infracost/infracost/internal/ui"
)

var validCommentAzureReposBehaviors = []string{"update", "new", "delete-and-new"}

func commentAzureReposCmd(ctx *config.RunContext) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "azure-repos",
		Short: "Post an Infracost comment to Azure Repos",
		Long:  "Post an Infracost comment to Azure Repos",
		Example: `  Update comment on a pull request:

      infracost comment azure-repos --repo-url https://dev.azure.com/my-org/my-project/_git/my-repo --pull-request 3 --path infracost.json --azure-access-token $AZURE_ACCESS_TOKEN`,
		ValidArgs: []string{"--", "-"},
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx.ContextValues.SetValue("platform", "azure-repos")

			var err error

			format, _ := cmd.Flags().GetString("format")
			format = strings.ToLower(format)
			if format != "" && !contains(validCommentOutputFormats, format) {
				ui.PrintUsage(cmd)
				return fmt.Errorf("--format only supports %s", strings.Join(validCommentOutputFormats, ", "))
			}

			token, _ := cmd.Flags().GetString("azure-access-token")
			tag, _ := cmd.Flags().GetString("tag")
			initActive, _ := cmd.Flags().GetBool("init-active")

			tlsConfig, err := loadTLSConfigFromEnv(ctx)
			if err != nil {
				return err
			}

			extra := comment.AzureReposExtra{
				Token:      token,
				Tag:        tag,
				InitActive: initActive,
				TLSConfig:  tlsConfig,
			}

			prNumber, _ := cmd.Flags().GetInt("pull-request")
			repoURL, _ := cmd.Flags().GetString("repo-url")

			var commentHandler *comment.CommentHandler
			if prNumber != 0 {
				ctx.ContextValues.SetValue("targetType", "pull-request")

				commentHandler, err = comment.NewAzureReposPRHandler(ctx.Context(), repoURL, strconv.Itoa(prNumber), extra)
				if err != nil {
					return err
				}
			} else {
				ui.PrintUsage(cmd)
				return fmt.Errorf("--pull-request is required")
			}

			behavior, _ := cmd.Flags().GetString("behavior")
			if behavior != "" && !contains(validCommentAzureReposBehaviors, behavior) {
				ui.PrintUsage(cmd)
				return fmt.Errorf("--behavior only supports %s", strings.Join(validCommentAzureReposBehaviors, ", "))
			}
			ctx.ContextValues.SetValue("behavior", behavior)

			paths, _ := cmd.Flags().GetStringArray("path")

			commentOut, commentErr := buildCommentOutput(cmd, ctx, paths, output.MarkdownOptions{
				WillUpdate:          prNumber != 0 && behavior == "update",
				WillReplace:         prNumber != 0 && behavior == "delete-and-new",
				IncludeFeedbackLink: !ctx.Config.IsSelfHosted(),
				MaxMessageSize:      output.AzureReposMaxMessageSize,
			})
			if isErrorUnhandled(commentErr) {
				return commentErr
			}

			dryRun, _ := cmd.Flags().GetBool("dry-run")
			if !dryRun {
				skipNoDiff, _ := cmd.Flags().GetBool("skip-no-diff")

				res, err := commentHandler.CommentWithBehavior(ctx.Context(), behavior, commentOut.Body, &comment.CommentOpts{
					ValidAt:    commentOut.ValidAt,
					SkipNoDiff: !commentOut.HasDiff && skipNoDiff,
				})
				if err != nil {
					return err
				}

				if res.Posted && ctx.IsCloudUploadExplicitlyEnabled() {
					dashboardClient := apiclient.NewDashboardAPIClient(ctx)
					if err := dashboardClient.SavePostedPrComment(ctx, commentOut.AddRunResponse.RunID, commentOut.Body); err != nil {
						logging.Logger.Err(err).Msg("could not save posted PR comment")
					}
				}

				pricingClient := apiclient.GetPricingAPIClient(ctx)
				err = pricingClient.AddEvent("infracost-comment", ctx.EventEnv())
				if err != nil {
					logging.Logger.Err(err).Msg("could not report infracost-comment event")
				}

				if format == "json" {
					b, err := jsoniter.MarshalIndent(commentOut.AddRunResponse, "", "  ")
					if err != nil {
						return fmt.Errorf("failed to marshal result: %w", err)
					}
					cmd.Print(string(b))
				} else if res.Posted {
					cmd.Println("Comment posted to Azure Repos")
				} else {
					msg := "Comment not posted to Azure Repos"
					if res.SkipReason != "" {
						msg += fmt.Sprintf(": %s", res.SkipReason)
					}
					cmd.Println(msg)
				}
			} else {
				cmd.Println(commentOut.Body)
				cmd.Println("Comment not posted to Azure Repos (--dry-run was specified)")
			}

			return commentErr
		},
	}

	cmd.Flags().String("behavior", "update", `Behavior when posting comment, one of:
  update (default)  Update latest comment
  new               Create a new comment
  delete-and-new    Delete previous matching comments and create a new comment`)
	_ = cmd.RegisterFlagCompletionFunc("behavior", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return validCommentAzureReposBehaviors, cobra.ShellCompDirectiveDefault
	})
	cmd.Flags().String("azure-access-token", "", "Azure DevOps access token")
	_ = cmd.MarkFlagRequired("azure-access-token")
	cmd.Flags().StringArrayP("path", "p", []string{}, "Path to Infracost JSON files, glob patterns need quotes")
	_ = cmd.MarkFlagRequired("path")
	_ = cmd.MarkFlagFilename("path", "json")
	var prNumber PRNumber
	cmd.Flags().Var(&prNumber, "pull-request", "Pull request number to post comment on")
	_ = cmd.MarkFlagRequired("pull-request")
	cmd.Flags().String("repo-url", "", "Repository URL, e.g. https://dev.azure.com/my-org/my-project/_git/my-repo")
	_ = cmd.MarkFlagRequired("repo-url")
	cmd.Flags().String("tag", "", "Customize hidden markdown tag used to detect comments posted by Infracost")
	cmd.Flags().Bool("dry-run", false, "Generate comment without actually posting to Azure Repos")
	cmd.Flags().String("format", "", "Output format: json")
	cmd.Flags().Bool("init-active", false, "Initialize the comment as active instead of the default: closed")

	return cmd
}

```

### Core Architecture Module: `cmd/infracost/comment_bitbucket.go`
```
package main

import (
	"fmt"
	"strconv"
	"strings"

	jsoniter "github.com/json-iterator/go"
	"github.com/spf13/cobra"

	"github.com/infracost/infracost/internal/apiclient"
	"github.com/infracost/infracost/internal/comment"
	"github.com/infracost/infracost/internal/config"
	"github.com/infracost/infracost/internal/logging"
	"github.com/infracost/infracost/internal/output"
	"github.com/infracost/infracost/internal/ui"
)

var validCommentBitbucketBehaviors = []string{"update", "new", "delete-and-new"}

func commentBitbucketCmd(ctx *config.RunContext) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "bitbucket",
		Short: "Post an Infracost comment to Bitbucket",
		Long:  "Post an Infracost comment to Bitbucket",
		Example: `  Update comment on a pull request:

      infracost comment bitbucket --repo my-org/my-repo --pull-request 3 --path infracost.json --bitbucket-token $BITBUCKET_TOKEN

  Post a new comment to a commit:

      infracost comment bitbucket --repo my-org/my-repo --commit 2ca7182 --path infracost.json --behavior delete-and-new --bitbucket-token $BITBUCKET_TOKEN`,
		ValidArgs: []string{"--", "-"},
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx.ContextValues.SetValue("platform", "bitbucket")

			var err error

			format, _ := cmd.Flags().GetString("format")
			format = strings.ToLower(format)
			if format != "" && !contains(validCommentOutputFormats, format) {
				ui.PrintUsage(cmd)
				return fmt.Errorf("--format only supports %s", strings.Join(validCommentOutputFormats, ", "))
			}

			serverURL, _ := cmd.Flags().GetString("bitbucket-server-url")
			token, _ := cmd.Flags().GetString("bitbucket-token")
			tag, _ := cmd.Flags().GetString("tag")
			omitDetails, _ := cmd.Flags().GetBool("exclude-cli-output")

			tlsConfig, err := loadTLSConfigFromEnv(ctx)
			if err != nil {
				return err
			}

			extra := comment.BitbucketExtra{
				ServerURL:   serverURL,
				Token:       token,
				Tag:         tag,
				OmitDetails: omitDetails,
				TLSConfig:   tlsConfig,
			}

			commit, _ := cmd.Flags().GetString("commit")
			prNumber, _ := cmd.Flags().GetInt("pull-request")
			repo, _ := cmd.Flags().GetString("repo")

			var commentHandler *comment.CommentHandler
			if prNumber != 0 {
				ctx.ContextValues.SetValue("targetType", "pull-request")

				commentHandler, err = comment.NewBitbucketPRHandler(ctx.Context(), repo, strconv.Itoa(prNumber), extra)
				if err != nil {
					return err
				}
			} else if commit != "" {
				ctx.ContextValues.SetValue("targetType", "commit")

				commentHandler, err = comment.NewBitbucketCommitHandler(ctx.Context(), repo, commit, extra)
				if err != nil {
					return err
				}
			} else {
				ui.PrintUsage(cmd)
				return fmt.Errorf("either --commit or --pull-request is required")
			}

			behavior, _ := cmd.Flags().GetString("behavior")
			if behavior != "" && !contains(validCommentBitbucketBehaviors, behavior) {
				ui.PrintUsage(cmd)
				return fmt.Errorf("--behavior only supports %s", strings.Join(validCommentBitbucketBehaviors, ", "))
			}
			ctx.ContextValues.SetValue("behavior", behavior)

			paths, _ := cmd.Flags().GetStringArray("path")

			commentOut, commentErr := buildCommentOutput(cmd, ctx, paths, output.MarkdownOptions{
				WillUpdate:          prNumber != 0 && behavior == "update",
				WillReplace:         prNumber != 0 && behavior == "delete-and-new",
				IncludeFeedbackLink: !ctx.Config.IsSelfHosted(),
				OmitDetails:         extra.OmitDetails,
				BasicSyntax:         true,
			})
			if isErrorUnhandled(commentErr) {
				return commentErr
			}

			dryRun, _ := cmd.Flags().GetBool("dry-run")
			if !dryRun {
				skipNoDiff, _ := cmd.Flags().GetBool("skip-no-diff")

				res, err := commentHandler.CommentWithBehavior(ctx.Context(), behavior, commentOut.Body, &comment.CommentOpts{
					ValidAt:    commentOut.ValidAt,
					SkipNoDiff: !commentOut.HasDiff && skipNoDiff,
				})
				if err != nil {
					return err
				}

				if res.Posted && ctx.IsCloudUploadExplicitlyEnabled() {
					dashboardClient := apiclient.NewDashboardAPIClient(ctx)
					if err := dashboardClient.SavePostedPrComment(ctx, commentOut.AddRunResponse.RunID, commentOut.Body); err != nil {
						logging.Logger.Err(err).Msg("could not save posted PR comment")
					}
				}

				pricingClient := apiclient.GetPricingAPIClient(ctx)
				err = pricingClient.AddEvent("infracost-comment", ctx.EventEnv())
				if err != nil {
					logging.Logger.Err(err).Msg("could not report infracost-comment event")
				}

				if format == "json" {
					b, err := jsoniter.MarshalIndent(commentOut.AddRunResponse, "", "  ")
					if err != nil {
						return fmt.Errorf("failed to marshal result: %w", err)
					}
					cmd.Print(string(b))
				} else if res.Posted {
					cmd.Println("Comment posted to Bitbucket")
				} else {
					msg := "Comment not posted to Bitbucket"
					if res.SkipReason != "" {
						msg += fmt.Sprintf(": %s", res.SkipReason)
					}
					cmd.Println(msg)
				}
			} else {
				cmd.Println(commentOut.Body)
				cmd.Println("Comment not posted to Bitbucket (--dry-run was specified)")
			}

			return commentErr
		},
	}

	cmd.Flags().String("behavior", "update", `Behavior when posting comment, one of:
  update (default)  Update latest comment
  new               Create a new comment
  delete-and-new    Delete previous matching comments and create a new comment`)
	_ = cmd.RegisterFlagCompletionFunc("behavior", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return validCommentBitbucketBehaviors, cobra.ShellCompDirectiveDefault
	})
	cmd.Flags().String("bitbucket-server-url", "https://bitbucket.org", "Bitbucket Server URL")
	cmd.Flags().String("bitbucket-token", "", "Bitbucket access token. Use 'username:app-password' for Bitbucket Cloud and HTTP access token for Bitbucket Server")
	_ = cmd.MarkFlagRequired("bitbucket-token")
	cmd.Flags().String("commit", "", "Commit SHA to post comment on, mutually exclusive with pull-request. Not available when bitbucket-server-url is set")
	cmd.Flags().StringArrayP("path", "p", []string{}, "Path to Infracost JSON files, glob patterns need quotes")
	_ = cmd.MarkFlagRequired("path")
	_ = cmd.MarkFlagFilename("path", "json")
	var prNumber PRNumber
	cmd.Flags().Var(&prNumber, "pull-request", "Pull request number to post comment on")
	cmd.Flags().String("repo", "", "Repository in format workspace/repo")
	_ = cmd.MarkFlagRequired("repo")
	cmd.Flags().Bool("exclude-cli-output", false, "Exclude CLI output so comment has just the summary table")
	cmd.Flags().String("tag", "", "Customize special text used to detect comments posted by Infracost (placed at the bottom of a comment)")
	cmd.Flags().Bool("dry-run", false, "Generate comment without actually posting to Bitbucket")
	cmd.Flags().String("format", "", "Output format: json")

	return cmd
}

```

### Core Architecture Module: `cmd/infracost/comment_github.go`
```
package main

import (
	"crypto/tls"
	"fmt"
	"strconv"
	"strings"

	jsoniter "github.com/json-iterator/go"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/infracost/infracost/internal/apiclient"
	"github.com/infracost/infracost/internal/comment"
	"github.com/infracost/infracost/internal/config"
	"github.com/infracost/infracost/internal/logging"
	"github.com/infracost/infracost/internal/output"
	"github.com/infracost/infracost/internal/ui"
)

var validCommentGitHubBehaviors = []string{"update", "new", "hide-and-new", "delete-and-new"}

func commentGitHubCmd(ctx *config.RunContext) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "github",
		Short: "Post an Infracost comment to GitHub",
		Long:  "Post an Infracost comment to GitHub",
		Example: `  Update comment on a pull request:

      infracost comment github --repo my-org/my-repo --pull-request 3 --path infracost.json --github-token $GITHUB_TOKEN

  Post a new comment to a commit:

      infracost comment github --repo my-org/my-repo --commit 2ca7182 --path infracost.json --behavior hide-and-new --github-token $GITHUB_TOKEN`,
		ValidArgs: []string{"--", "-"},
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx.ContextValues.SetValue("platform", "github")

			var commentErr error

			format, _ := cmd.Flags().GetString("format")
			format = strings.ToLower(format)
			if format != "" && !contains(validCommentOutputFormats, format) {
				ui.PrintUsage(cmd)
				return fmt.Errorf("--format only supports %s", strings.Join(validCommentOutputFormats, ", "))
			}

			apiURL, _ := cmd.Flags().GetString("github-api-url")
			token, _ := cmd.Flags().GetString("github-token")
			tag, _ := cmd.Flags().GetString("tag")

			tlsCertFile, _ := cmd.Flags().GetString("github-tls-cert-file")
			tlsKeyFile, _ := cmd.Flags().GetString("github-tls-key-file")
			tlsInsecureSkipVerify, _ := cmd.Flags().GetBool("github-tls-insecure-skip-verify")

			tlsConfig, err := loadTLSConfigFromEnv(ctx)
			if err != nil {
				return errors.Wrap(err, "Error loading TLS config")
			}

			tlsConfig.InsecureSkipVerify = tlsInsecureSkipVerify // nolint: gosec

			if tlsCertFile != "" && tlsKeyFile != "" {
				cert, err := tls.LoadX509KeyPair(tlsCertFile, tlsKeyFile)
				if err != nil {
					return errors.Wrap(err, "Error loading TLS certificate and key")
				}
				tlsConfig.Certificates = []tls.Certificate{cert}
			}

			extra := comment.GitHubExtra{
				APIURL:    apiURL,
				Token:     token,
				Tag:       tag,
				TLSConfig: tlsConfig,
			}

			commit, _ := cmd.Flags().GetString("commit")
			prNumber, _ := cmd.Flags().GetInt("pull-request")
			repo, _ := cmd.Flags().GetString("repo")

			var commentHandler *comment.CommentHandler
			if prNumber != 0 {
				ctx.ContextValues.SetValue("targetType", "pull-request")

				commentHandler, commentErr = comment.NewGitHubPRHandler(ctx.Context(), repo, strconv.Itoa(prNumber), extra)
				if commentErr != nil {
					return commentErr
				}
			} else if commit != "" {
				ctx.ContextValues.SetValue("targetType", "commit")

				commentHandler, commentErr = comment.NewGitHubCommitHandler(ctx.Context(), repo, commit, extra)
				if commentErr != nil {
					return commentErr
				}
			} else {
				ui.PrintUsage(cmd)
				return fmt.Errorf("either --commit or --pull-request is required")
			}

			behavior, _ := cmd.Flags().GetString("behavior")
			if behavior != "" && !contains(validCommentGitHubBehaviors, behavior) {
				ui.PrintUsage(cmd)
				return fmt.Errorf("--behavior only supports %s", strings.Join(validCommentGitHubBehaviors, ", "))
			}
			ctx.ContextValues.SetValue("behavior", behavior)

			paths, _ := cmd.Flags().GetStringArray("path")

			commentOut, commentErr := buildCommentOutput(cmd, ctx, paths, output.MarkdownOptions{
				WillUpdate:          prNumber != 0 && behavior == "update",
				WillReplace:         prNumber != 0 && behavior == "delete-and-new",
				IncludeFeedbackLink: !ctx.Config.IsSelfHosted(),
				MaxMessageSize:      output.GitHubMaxMessageSize,
			})
			if isErrorUnhandled(commentErr) {
				return commentErr
			}

			dryRun, _ := cmd.Flags().GetBool("dry-run")
			if !dryRun {
				skipNoDiff, _ := cmd.Flags().GetBool("skip-no-diff")

				res, err := commentHandler.CommentWithBehavior(ctx.Context(), behavior, commentOut.Body, &comment.CommentOpts{
					ValidAt:    commentOut.ValidAt,
					SkipNoDiff: !commentOut.HasDiff && skipNoDiff,
				})
				if err != nil {
					return err
				}

				if res.Posted && ctx.IsCloudUploadEnabled() {
					dashboardClient := apiclient.NewDashboardAPIClient(ctx)
					if err := dashboardClient.SavePostedPrComment(ctx, commentOut.AddRunResponse.RunID, commentOut.Body); err != nil {
						logging.Logger.Err(err).Msg("could not save posted PR comment")
					}
				}

				pricingClient := apiclient.GetPricingAPIClient(ctx)
				err = pricingClient.AddEvent("infracost-comment", ctx.EventEnv())
				if err != nil {
					logging.Logger.Err(err).Msg("could not report infracost-comment event")
				}

				if format == "json" {
					b, err := jsoniter.MarshalIndent(commentOut.AddRunResponse, "", "  ")
					if err != nil {
						return fmt.Errorf("failed to marshal result: %w", err)
					}
					cmd.Print(string(b))
				} else if res.Posted {

					cmd.Println("Comment posted to GitHub")
				} else {
					msg := "Comment not posted to GitHub"
					if res.SkipReason != "" {
						msg += fmt.Sprintf(": %s", res.SkipReason)
					}
					cmd.Println(msg)
				}
			} else {
				cmd.Println(commentOut.Body)
				cmd.Println("Comment not posted to GitHub (--dry-run was specified)")
			}

			if commentErr != nil {
				cmd.Printf("\n")
				return commentErr
			}

			return nil
		},
	}

	cmd.Flags().String("behavior", "update", `Behavior when posting comment, one of:
  update (default)  Update latest comment
  new               Create a new comment
  hide-and-new      Hide previous matching comments and create a new comment
  delete-and-new    Delete previous matching comments and create a new comment`)
	_ = cmd.RegisterFlagCompletionFunc("behavior", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return validCommentGitHubBehaviors, cobra.ShellCompDirectiveDefault
	})
	cmd.Flags().String("commit", "", "Commit SHA to post comment on, mutually exclusive with pull-request")
	cmd.Flags().String("github-api-url", "https://api.github.com", "GitHub API URL")
	cmd.Flags().String("github-token", "", "GitHub token")
	_ = cmd.MarkFlagRequired("github-token")
	cmd.Flags().String("github-tls-cert-file", "", "Path to optional client certificate file when communicating with GitHub Enterprise API")
	cmd.Flags().String("github-tls-key-file", "", "Path to optional client key file when communicating with GitHub Enterprise API")
	cmd.Flags().Bool("github-tls-insecure-skip-verify", false, "Skip TLS certificate checks for GitHub Enterprise API")
	cmd.Flags().StringArrayP("path", "p", []string{}, "Path to Infracost JSON files, glob patterns need quotes")
	_ = cmd.MarkFlagRequired("path")
	_ = cmd.MarkFlagFilename("path", "json")
	var prNumber PRNumber
	cmd.Flags().Var(&prNumber, "pull-request", "Pull request number to post comment on, mutually exclusive with commit")
	cmd.Flags().String("repo", "", "Repository in format owner/repo")
	_ = cmd.MarkFlagRequired("repo")
	cmd.Flags().String("tag", "", "Customize hidden markdown tag used to detect comments posted by Infracost")
	cmd.Flags().Bool("dry-run", false, "Generate comment without actually posting to GitHub")
	cmd.Flags().String("format", "", "Output format: json")

	return cmd
}

```

### Core Architecture Module: `cmd/infracost/comment_gitlab.go`
```
package main

import (
	"fmt"
	"strconv"
	"strings"

	jsoniter "github.com/json-iterator/go"
	"github.com/spf13/cobra"

	"github.com/infracost/infracost/internal/apiclient"
	"github.com/infracost/infracost/internal/comment"
	"github.com/infracost/infracost/internal/config"
	"github.com/infracost/infracost/internal/logging"
	"github.com/infracost/infracost/internal/output"
	"github.com/infracost/infracost/internal/ui"
)

var validCommentGitLabBehaviors = []string{"update", "new", "delete-and-new"}

func commentGitLabCmd(ctx *config.RunContext) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "gitlab",
		Short: "Post an Infracost comment to GitLab",
		Long:  "Post an Infracost comment to GitLab",
		Example: `  Update comment on a merge request:

      infracost comment gitlab --repo my-org/my-repo --merge-request 3 --path infracost.json --gitlab-token $GITLAB_TOKEN

  Post a new comment to a commit:

      infracost comment gitlab --repo my-org/my-repo --commit 2ca7182 --path infracost.json --behavior delete-and-new --gitlab-token $GITLAB_TOKEN`,
		ValidArgs: []string{"--", "-"},
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx.ContextValues.SetValue("platform", "gitlab")

			var err error

			format, _ := cmd.Flags().GetString("format")
			format = strings.ToLower(format)
			if format != "" && !contains(validCommentOutputFormats, format) {
				ui.PrintUsage(cmd)
				return fmt.Errorf("--format only supports %s", strings.Join(validCommentOutputFormats, ", "))
			}

			serverURL, _ := cmd.Flags().GetString("gitlab-server-url")
			token, _ := cmd.Flags().GetString("gitlab-token")
			tag, _ := cmd.Flags().GetString("tag")

			tlsConfig, err := loadTLSConfigFromEnv(ctx)
			if err != nil {
				return err
			}

			extra := comment.GitLabExtra{
				ServerURL: serverURL,
				Token:     token,
				Tag:       tag,
				TLSConfig: tlsConfig,
			}

			commit, _ := cmd.Flags().GetString("commit")
			mrNumber, _ := cmd.Flags().GetInt("merge-request")
			repo, _ := cmd.Flags().GetString("repo")

			var commentHandler *comment.CommentHandler
			if mrNumber != 0 {
				ctx.ContextValues.SetValue("targetType", "merge-request")

				commentHandler, err = comment.NewGitLabPRHandler(ctx.Context(), repo, strconv.Itoa(mrNumber), extra)
				if err != nil {
					return err
				}
			} else if commit != "" {
				ctx.ContextValues.SetValue("targetType", "commit")

				commentHandler, err = comment.NewGitLabCommitHandler(ctx.Context(), repo, commit, extra)
				if err != nil {
					return err
				}
			} else {
				ui.PrintUsage(cmd)
				return fmt.Errorf("either --commit or --merge-request is required")
			}

			behavior, _ := cmd.Flags().GetString("behavior")
			if behavior != "" && !contains(validCommentGitLabBehaviors, behavior) {
				ui.PrintUsage(cmd)
				return fmt.Errorf("--behavior only supports %s", strings.Join(validCommentGitLabBehaviors, ", "))
			}
			ctx.ContextValues.SetValue("behavior", behavior)

			paths, _ := cmd.Flags().GetStringArray("path")

			commentOut, commentErr := buildCommentOutput(cmd, ctx, paths, output.MarkdownOptions{
				WillUpdate:          mrNumber != 0 && behavior == "update",
				WillReplace:         mrNumber != 0 && behavior == "delete-and-new",
				IncludeFeedbackLink: !ctx.Config.IsSelfHosted(),
				MaxMessageSize:      output.GitLabMaxMessageSize,
			})
			if isErrorUnhandled(commentErr) {
				return commentErr
			}

			dryRun, _ := cmd.Flags().GetBool("dry-run")
			if !dryRun {
				skipNoDiff, _ := cmd.Flags().GetBool("skip-no-diff")

				res, err := commentHandler.CommentWithBehavior(ctx.Context(), behavior, commentOut.Body, &comment.CommentOpts{
					ValidAt:    commentOut.ValidAt,
					SkipNoDiff: !commentOut.HasDiff && skipNoDiff,
				})
				if err != nil {
					return err
				}

				if res.Posted && ctx.IsCloudUploadExplicitlyEnabled() {
					dashboardClient := apiclient.NewDashboardAPIClient(ctx)
					if err := dashboardClient.SavePostedPrComment(ctx, commentOut.AddRunResponse.RunID, commentOut.Body); err != nil {
						logging.Logger.Err(err).Msg("could not save posted PR comment")
					}
				}

				pricingClient := apiclient.GetPricingAPIClient(ctx)
				err = pricingClient.AddEvent("infracost-comment", ctx.EventEnv())
				if err != nil {
					logging.Logger.Err(err).Msg("could not report infracost-comment event")
				}

				if format == "json" {
					b, err := jsoniter.MarshalIndent(commentOut.AddRunResponse, "", "  ")
					if err != nil {
						return fmt.Errorf("failed to marshal result: %w", err)
					}
					cmd.Print(string(b))
				} else if res.Posted {
					cmd.Println("Comment posted to GitLab")
				} else {
					msg := "Comment not posted to GitLab"
					if res.SkipReason != "" {
						msg += fmt.Sprintf(": %s", res.SkipReason)
					}
					cmd.Println(msg)
				}
			} else {
				cmd.Println(commentOut.Body)
				cmd.Println("Comment not posted to GitLab (--dry-run was specified)")
			}

			return commentErr
		},
	}

	cmd.Flags().String("behavior", "update", `Behavior when posting comment, one of:
  update (default)  Update latest comment
  new               Create a new comment
  delete-and-new    Delete previous matching comments and create a new comment`)
	_ = cmd.RegisterFlagCompletionFunc("behavior", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return validCommentGitLabBehaviors, cobra.ShellCompDirectiveDefault
	})
	cmd.Flags().String("commit", "", "Commit SHA to post comment on, mutually exclusive with merge-request")
	cmd.Flags().String("gitlab-server-url", "https://gitlab.com", "GitLab Server URL")
	cmd.Flags().String("gitlab-token", "", "GitLab token")
	_ = cmd.MarkFlagRequired("gitlab-token")
	cmd.Flags().StringArrayP("path", "p", []string{}, "Path to Infracost JSON files, glob patterns need quotes")
	_ = cmd.MarkFlagRequired("path")
	_ = cmd.MarkFlagFilename("path", "json")
	var mrNumber PRNumber
	cmd.Flags().Var(&mrNumber, "merge-request", "Merge request number to post comment on, mutually exclusive with commit")
	cmd.Flags().String("repo", "", "Repository in format owner/repo")
	_ = cmd.MarkFlagRequired("repo")
	cmd.Flags().String("tag", "", "Customize hidden markdown tag used to detect comments posted by Infracost")
	cmd.Flags().Bool("dry-run", false, "Generate comment without actually posting to GitLab")
	cmd.Flags().String("format", "", "Output format: json")

	return cmd
}

```

### Core Architecture Module: `cmd/infracost/completion.go`
```
package main

import (
	"fmt"
	"github.com/spf13/cobra"
)

func completionCmd() *cobra.Command {
	completionCmd := &cobra.Command{
		Use:   "completion --shell [bash | zsh | fish | powershell]",
		Short: "Generate shell completion script",
		Long: `To load completions:
	
	Bash:
	
		$ source <(infracost completion --shell bash)
	
		# To load completions for each session, execute once:
		# Linux:
		$ infracost completion --shell bash > /etc/bash_completion.d/infracost
		# macOS:
		$ infracost completion --shell bash > /usr/local/etc/bash_completion.d/infracost
	
	Zsh:
	
		# If shell completion is not already enabled in your environment,
		# you will need to enable it.  You can execute the following once:
	
		$ echo "autoload -U compinit; compinit" >> ~/.zshrc
	
		# To load completions for each session, execute once:
		$ infracost completion --shell zsh > "${fpath[1]}/_infracost"
	
		# You will need to start a new shell for this setup to take effect.
	
	fish:
	
		$ infracost completion --shell fish | source
	
		# To load completions for each session, execute once:
		$ infracost completion --shell fish > ~/.config/fish/completions/infracost.fish
	
	PowerShell:
	
		PS> infracost completion --shell powershell | Out-String | Invoke-Expression
	
		# To load completions for every new session, run:
		PS> infracost completion --shell powershell > infracost.ps1
		# and source this file from your PowerShell profile.
	`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if hasShellFlag := cmd.Flags().Changed("shell"); hasShellFlag {
				shell, err := cmd.Flags().GetString("shell")
				if err != nil {
					return err
				}

				switch shell {
				case "bash":
					_ = cmd.Root().GenBashCompletion(cmd.OutOrStdout())
				case "zsh":
					_ = cmd.Root().GenZshCompletion(cmd.OutOrStdout())
				case "fish":
					_ = cmd.Root().GenFishCompletion(cmd.OutOrStdout(), true)
				case "powershell":
					_ = cmd.Root().GenPowerShellCompletionWithDesc(cmd.OutOrStdout())
				default:
					return fmt.Errorf("unsupported shell type: %q", shell)
				}
			}

			return nil
		},
	}

	completionCmd.Flags().String("shell", "", "supported shell formats: bash, zsh, fish, powershell")
	_ = completionCmd.MarkFlagRequired("shell")

	_ = completionCmd.RegisterFlagCompletionFunc("shell", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return []string{"bash\tCompletions for bash",
				"zsh\tCompletions for zsh",
				"fish\tCompletions for fish",
				"powershell\tCompletions for powershell"},
			cobra.ShellCompDirectiveDefault
	})

	return completionCmd
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3466** (2025-12-11): **BUG: 'Error loading Terraform modules // Missing argument separator' error with variable validation block**
  *Symptoms*: One of my terraform modules has two variables which have validation blocks that use provider functions:  ```hcl variable "zendesk_alert_topics" {   type = object({     us_east_1 : string     eu_west_2 : string   })    description = "The ARNs of the SNS topics to use to send an alert to Zendesk, per region"    validation {     condition     = alltrue([for p, arn in tomap(var.zendesk_alert_topics) : can(provider::aws::arn_parse(arn))])     error_message = "All values must be valid ARNs"   } }  variable "pagerduty_alert_topics" {   type = object({     eu_west_2 : string   })    description = "The ARNs of the SNS topics to use to send an alert to PagerDuty, per region"    validation {     condition     = alltrue([for p, arn in tomap(var.pagerduty_alert_topics) : can(provider::aws::arn_parse(arn))])     error_message = "All values must be valid ARNs"   } } ```  There's no CLI when running a diff or breakdown, but when using the github PR comment feature as demonstrated in the example workflow, we see the following:  ```markdown <h3>💰 Infracost report</h3>  This pull request is aligned with your company's FinOps policies and the Well-Architected Framework. <details >   <summary><b>Monthly estimate generated</b></summary>   <br/>    <details>   <summary>Estimate details (includes details of unsupported resources and skipped projects due to errors)</summary>   ────────────────────────────────── Project: some-project Module path: path/to/module Errors:  Error loading Terraform module
  **Post-Mortem & Fix Analysis**:
  > @whi-tw thanks for reporting 🙏 . This is fixed in the master build now and will go out with the next release.
  > Released in https://github.com/infracost/infracost/releases/tag/v0.10.43, thanks @whi-tw 🙏 

- **Issue #3375** (2025-05-26): **Cost for Azure SQL DB within elastic pool calculated incorrectly**
  *Symptoms*: We have 4 databases within an elastic pool, hence the compute cost is billed once per elastic pool (not per single DB). If we now add a new DB to the elastic pool, infracost considers the DB to be billed as single DB and shows a cost increase for compute that is incorrect.  ![Image](https://github.com/user-attachments/assets/25679909-f2d8-460b-a643-cd2ad56de07f)
  **Post-Mortem & Fix Analysis**:
  > @bertsch-ronja-office do you have any snippets of Terraform code we can use to reproduce this issue?

- **Issue #3370** (2025-12-11): **`azurerm_postgresql_flexible_server` missing cost for `high_availability`**
  *Symptoms*: When `high_availability` is specified for the resource, it should detect that and (I assume) double the monthly hours for the resource. Currently the output is the same whether or not high_availability is specified.  Resource from plan output: ``` # module.db_postgres.module.db.azurerm_postgresql_flexible_server.this will be created + resource "azurerm_postgresql_flexible_server" "this" {       + administrator_password        = (sensitive value)       + auto_grow_enabled             = true       + backup_retention_days         = 7       + fqdn                          = (known after apply)       + geo_redundant_backup_enabled  = false       + id                            = (known after apply)       + location                      = "eastus"       + name                          = "db-stage"       + private_dns_zone_id           = (known after apply)       + public_network_access_enabled = true       + resource_group_name           = "rg-pgdb-eastus-stage"       + sku_name                      = "GP_Standard_D2ads_v5"       + storage_mb                    = 32768       + storage_tier                  = "P6"       + version                       = "16"       + zone                          = "1"        + authentication (known after apply)        + high_availability {           + mode                      = "SameZone"           + standby_availability_zone = "1"         }     } ```  `infracost breakdown` output: ```  Name                                                          
  **Post-Mortem & Fix Analysis**:
  > @aliscott Hi, please assign it to me. I would like to try fixing it. 
  > Released in https://github.com/infracost/infracost/releases/tag/v0.10.43, thanks @apicht 🙏 

- **Issue #3352** (2025-07-24): **Github calls rate limited due to new public/private module checks in v0.10.41**
  *Symptoms*: ### Issue Description The new module checks added in v0.10.41 [PR #3311](https://github.com/infracost/infracost/pull/3311) are causing GitHub rate limiting issues. The current implementation makes unauthenticated HEAD requests to check if modules are public or private, which are subject to GitHub's rate limit of 60 requests per hour per IP address - [ Ref Github Documentation](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28#primary-rate-limit-for-unauthenticated-users)  **Current Implementation** The `HttpPublicModuleChecker.IsPublicModule` function uses a simple HEAD request to check if a module is public: ``` func (h *HttpPublicModuleChecker) IsPublicModule(moduleAddr string) (bool, error) { 	u := strings.TrimPrefix(moduleAddr, "git::")  	parsedUrl, err := url.Parse(u) 	if err != nil { 		return false, err 	}  	if parsedUrl.Scheme == "" { 		parsedUrl.Scheme = "https" 	}  	req, err := http.NewRequest("HEAD", parsedUrl.String(), nil) 	if err != nil { 		return false, err 	}  	resp, err := h.client.Do(req) 	if err != nil { 		return false, err 	} 	defer resp.Body.Close()  	return resp.StatusCode == http.StatusOK, nil } ``` **Issues with Current Implementation**  `parsedUrl.String()` strips just the URL without any authentication credentials. Unauthenticated requests are subject to GitHub's rate limit (60 requests/hour). Simply checking for HTTP 200 status doesn't reliably distinguish between public/private repositories. No han
  **Post-Mortem & Fix Analysis**:
  > Hi @abhishekbvs7   Can I ask for a little more information about where you are seeing the rate limiting errors and what exact output you're getting?  The documentation you cited applies to the REST API (`api.github.com`), but not to `github.com` requests, so I think perhaps something else is triggering the rate limits here? We currently use this with much more than 60 requests/h from the same IPs and don't see any issues, so I think something else is going on.  Either way, I've created a PR to avoid making those requests when not needed, as they are only required when using a remote cache and should not be made all of the time - see https://github.com/infracost/infracost/pull/3353  
  > @liamg Basically when our infracost workflows are executed, we're seeing that our Public NAT IP is getting blacklisted by GitHub. The GitHub team confirmed they are blocking our IP as a protective measure because GitHub's automatic DDoS detection began triggering due to a high volume (more than 250 requests per second) of unauthenticated requests targeting a particular repo URL where our private terraform modules are hosted. These requests contain the `Go-http-client/2.0` user agent.  It seems this isn't triggering the standard API rate limiting which I mentioned earlier, but rather some internal GitHub security system is detecting this pattern as an anomaly or potential attack. The issue appears to be with the volume and pattern of requests to `github.com` coming from our NAT IP when multiple workflows run concurrently.   Also, may I know how many times will this above mentioned function be called to quantify the volume of requests made by infracost to github? This would help us under
  > @abhishekbvs7 Thanks, that makes sense. This is currently being called once for each unique remote module download.

- **Issue #3218** (2026-04-27): **google_container_node_pool change isn't calculated**
  *Symptoms*: Hello,  Using v0.10.39  I've made machine type changes to 2 Node Pools in my tfvars under my Terraform module: terraform plan: ```   # google_container_node_pool.nodes["0"] must be replaced -/+ resource "google_container_node_pool" "nodes" { ~ node_config { ...           ~ disk_size_gb      = 100 -> (known after apply)           ~ disk_type         = "pd-balanced" -> (known after apply)           ~ guest_accelerator = [] -> (known after apply)           ~ image_type        = "COS_CONTAINERD" -> (known after apply)           ~ local_ssd_count   = 0 -> (known after apply)           ~ machine_type      = "n2-standard-48" -> "n1-standard-16" # forces replacement ...  ``` ```   # google_container_node_pool.nodes["1"] must be replaced -/+ resource "google_container_node_pool" "nodes" { ~ node_config { ...         name                        = "node-pool-2"       + name_prefix                 = (known after apply)       ~ node_count                  = 4 -> (known after apply)       + operation                   = (known after apply)       ~ project                     = "project" -> (known after apply)          machine_type      = "e2-standard-4" -> "e2-standard-8" # forces replacement       ~ version                     = "1.29.8-gke.1031000" -> (known after apply) ...         } ```  In my PR with the node_pool machine type change, I create a diff from master like so: ``` + git checkout master --quiet + infracost breakdown --path terraform/goo
  **Post-Mortem & Fix Analysis**:
  > Update after running `infracost breakdown --path . --format=json | jq ".summary.unsupportedResourceCounts`:  `WARN 1 google_container_node_pool price missing across 1 resource`  Is this related to the region I'm running on? 
  > @illmaticz are you able to run with `--log-level=debug` and look for any lines that start with `DEBUG No products found for`. This should give us the parameters that are looked up in the pricing database so we can check why they aren't being found.
  > Hey @aliscott, thanks for looking into this - I am still getting the same output, I changed logging level to debug from trace as follows: ``` curl -fsSL https://raw.githubusercontent.com/infracost/infracost/master/scripts/install.sh Downloading version latest of infracost-linux-amd64... Validating checksum for infracost-linux-amd64... Moving /tmp/infracost-linux-amd64 to /usr/local/bin/infracost (you might be asked for your password due to sudo)  Completed installing Infracost v0.10.39 + export INFRACOST_TERRAFORM_CLOUD_TOKEN=**** + export INFRACOST_API_KEY=**  + export INFRACOST_TERRAFORM_WORKSPACE=google_kubernetes_engine_development  + echo INFRACOST_TERRAFORM_WORKSPACE is set to: google_kubernetes_engine_development  INFRACOST_TERRAFORM_WORKSPACE is set to: google_kubernetes_engine_development + git checkout master --quiet  + test -f terraform/google_kubernetes_engine/tfvars/dev.tfvars  + infracost breakdown --path terraform/google_kubernetes_engine --terraform-

- **Issue #3087** (2026-04-06): **Failed calculating breakdown cost of google_compute_region_instance_group_manager**
  *Symptoms*: I am running Infracost on my Terraform plan output. I use API requests for the `/breakdown` path. In my plan, I have an existing resource with no changes with the type `google_compute_region_instance_group_manager`. When running Infracost, the results of the past breakdown of the monthly cost of the resource seem correct, while the results of the breakdown are always zero. Therefore, the monthly cost diff always shows a decrease in cost even when no resources were changed.  ### HCL code: ``` resource "google_compute_region_instance_group_manager" "instance_group_us_east4" {   provider = google-beta   name     = "instance-group-us-east4"    base_instance_name               = "instance-us-east4"   region                           = "us-east4"   distribution_policy_zones        = ["us-east4-a", "us-east4-b", "us-east4-c"]   distribution_policy_target_shape = "EVEN"    version {     instance_template = data.google_compute_instance_template.instance_template.self_link   }    auto_healing_policies {     health_check      = google_compute_health_check.instance_health_check.self_link     initial_delay_sec = 120   }    update_policy {     instance_redistribution_type   = "PROACTIVE"     max_surge_fixed                = 3     max_unavailable_fixed          = 3     minimal_action                 = "REPLACE"     replacement_method             = "SUBSTITUTE"     type                           = "OPPORTUNISTIC"     most_disruptive_allowed_action = "REPLACE" 
  **Post-Mortem & Fix Analysis**:
  > @YuvalFireFly one thing I'm noticing is the instance type is missing? I wonder if this is causing the issue.
  > > @YuvalFireFly one thing I'm noticing is the instance type is missing? I wonder if this is causing the issue.  @aliscott What do you mean by instance type? There is no such field in `google_compute_region_instance_group_manager`
  > @YuvalFireFly, sorry I mean `machine_type`, which it gets from the `google_compute_instance_template` resource.

- **Issue #3064** (2026-04-06): **Infracost fails to display ecs service costs when using `terraform-aws-ecs` module**
  *Symptoms*: Infracost fails to display service costs when users use the [terraform-aws-ecs](https://github.com/terraform-aws-modules/terraform-aws-ecs) module to provision ecs Fargate services. This because the task definition (which defines the memory and cpu boundaries) is referenced in the module through a task set. Infracost does not currently support using `aws_ecs_task_set` to reference a task definition.

- **Issue #3011** (2024-04-29): **`--debug-report` flag throws an error**
  *Symptoms*: A user reported this issue in #3010.  When running a CLI command with `--debug-report` flag it throws an error:  ``` $ infracost breakdown --path=examples/terraform --debug-report ```  ``` [ 2024-04-10T10:32:30+01:00 DBG IsCloudEnabled inferred from Config.EnabledDashboard is_cloud_enabled=false, �[91mError:�[0m An unexpected error occurred  bytes.Buffer.WriteTo: invalid Write count goroutine 1 [running]: runtime/debug.Stack() 	/opt/hostedtoolcache/go/1.22.1/x64/src/runtime/debug/stack.go:24 +0x5e main.Run.func1() 	/home/runner/work/infracost/infracost/cmd/infracost/main.go:78 +0xb4 panic({0x29e26e0?, 0x3b30380?}) 	/opt/hostedtoolcache/go/1.22.1/x64/src/runtime/panic.go:770 +0x132 bytes.(*Buffer).WriteTo(0xc0004c9d70, {0x3b36100?, 0xc000099010?}) 	/opt/hostedtoolcache/go/1.22.1/x64/src/bytes/buffer.go:263 +0xee github.com/rs/zerolog.ConsoleWriter.Write({{0x3b36100, 0xc000099010}, 0x1, {0x33dac7f, 0x19}, {0xc00024f080, 0x4, 0x4}, {0x0, 0x0, ...}, ...}, ...) 	/home/runner/go/pkg/mod/github.com/rs/zerolog@v1.31.0/console.go:145 +0x5c5 github.com/rs/zerolog.LevelWriterAdapter.WriteLevel(...) 	/home/runner/go/pkg/mod/github.com/rs/zerolog@v1.31.0/writer.go:27 github.com/rs/zerolog.(*Event).write(0xc000499a40) 	/home/runner/go/pkg/mod/github.com/rs/zerolog@v1.31.0/event.go:80 +0x103 github.com/rs/zerolog.(*Event).msg(0xc000499a40, {0x347255b, 0x34}) 	/home/runner/go/pkg/mod/github.com/rs/zerolog@v1.31.0/event.go:151 +0x21a github.com/rs/zerolog.(*Even

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

### Incident Patch 1: `cb7459dc` (2026-09-24)
**Commit Message**: fix(deps): bump golang.org/x/crypto to v0.56.0 and klauspost/compress to v1.18.7 (#3623)

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -40,7 +40,7 @@ require (
 	github.com/stretchr/testify v1.11.1
 	github.com/tidwall/gjson v1.17.0
 	github.com/zclconf/go-cty v1.17.0
-	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/crypto v0.56.0 // indirect
 	golang.org/x/mod v0.40.0
 	gopkg.in/go-playground/assert.v1 v1.2.1
 	gopkg.in/yaml.v2 v2.4.0
@@ -294,7 +294,7 @@ require (
 	github.com/hashicorp/go-version v1.6.0
 	github.com/heimdalr/dag v1.3.1
 	github.com/iancoleman/orderedmap v0.2.0 // indirect
-	github.com/klauspost/compress v1.18.0 // indirect
+	github.com/klauspost/compress v1.18.7 // indirect
 	github.com/mitchellh/go-testing-interface v1.14.1 // indirect
 	github.com/open-policy-agent/opa v1.6.0
 	github.com/otiai10/copy v1.7.0
```

**File**: `go.sum` (modified, +4/-4)
```diff
@@ -1400,8 +1400,8 @@ github.com/klauspost/asmfmt v1.3.2/go.mod h1:AG8TuvYojzulgDAMCnYn50l/5QV3Bs/tp6j
 github.com/klauspost/compress v1.4.1/go.mod h1:RyIbtBH6LamlWaDj8nUwkbUhJ87Yi3uG0guNDohfE1A=
 github.com/klauspost/compress v1.15.9/go.mod h1:PhcZ0MbTNciWF3rruxRgKxI5NkcHHrHUDtV4Yw2GlzU=
 github.com/klauspost/compress v1.15.11/go.mod h1:QPwzmACJjUTFsnSHH934V6woptycfrDDJnH7hvFVbGM=
-github.com/klauspost/compress v1.18.0 h1:c/Cqfb0r+Yi+JtIEq73FWXVkRonBlf0CRNYc8Zttxdo=
-github.com/klauspost/compress v1.18.0/go.mod h1:2Pp+KzxcywXVXMr50+X0Q/Lsb43OQHYWRCY2AiWywWQ=
+github.com/klauspost/compress v1.18.7 h1:aUyZsS4kH3QTKurYhAOwAHxllVPnOthb3vPfnF1Ehjw=
+github.com/klauspost/compress v1.18.7/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
 github.com/klauspost/cpuid v1.2.0/go.mod h1:Pj4uuM528wm8OyEC2QMXAi2YiTZ96dNQPGgoMS4s3ek=
 github.com/klauspost/cpuid/v2 v2.0.9/go.mod h1:FInQzS24/EEf25PyTYn52gqo7WaD8xa0213Md/qVLRg=
 github.com/klauspost/cpuid/v2 v2.3.0 h1:S4CRMLnYUhGeDFDqkGriYKdfoFlDnMtqTiI/sFzhA9Y=
@@ -1886,8 +1886,8 @@ golang.org/x/crypto v0.38.0/go.mod h1:MvrbAqul58NNYPKnOra203SB9vpuZW0e+RRZV+Ggqj
 golang.org/x/crypto v0.39.0/go.mod h1:L+Xg3Wf6HoL4Bn4238Z6ft6KfEpN0tJGo53AAPC632U=
 golang.org/x/crypto v0.40.0/go.mod h1:Qr1vMER5WyS2dfPHAlsOj01wgLbsyWtFn/aY+5+ZdxY=
 golang.org/x/crypto v0.41.0/go.mod h1:pO5AFd7FA68rFak7rOAGVuygIISepHftHnr8dr6+sUc=
-golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
-golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
+golang.org/x/crypto v0.56.0 h1:GUh5Ii4J5jtcseSMiRqr1jXCNHoxjeV9Fmekc2oLy6Y=
+golang.org/x/crypto v0.56.0/go.mod h1:OMW5y6CY9l38uPLmxU6l6pwcXp1obtLo3e6gT7gQR2I=
 golang.org/x/exp v0.0.0-20180321215751-8460e604b9de/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20180807140117-3d87b88a115f/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
```

---

### Incident Patch 2: `16b6b00a` (2026-09-24)
**Commit Message**: fix(aws): exclude CloudWatch Omni from Logs Insights query pricing (#3622)

**File**: `internal/resources/aws/cloudwatch_log_group.go` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ func (r *CloudwatchLogGroup) BuildResource() *schema.Resource {
 					Service:       strPtr("AmazonCloudWatch"),
 					ProductFamily: strPtr("Data Payload"),
 					AttributeFilters: []*schema.AttributeFilter{
-						{Key: "usagetype", ValueRegex: strPtr("/-DataScanned-Bytes/")},
+						{Key: "usagetype", ValueRegex: strPtr("/^[A-Z0-9]+-DataScanned-Bytes$/")},
 					},
 				},
 				UsageBased: true,
```

---

### Incident Patch 3: `8669861a` (2026-09-21)
**Commit Message**: fix(azure): match renamed PostgreSQL Flexible Server storage price (#3620)

* fix(azure): match renamed PostgreSQL Flexible Server storage product

Azure renamed the product from "Az DB for PostgreSQL Flexible Server
Storage" to "Azure Database for PostgreSQL Flex Server Storage", so
every azurerm_postgresql_flexible_server Storage cost component priced
as not found. Accept both names since Delos Cloud regions still
publish the old one.

* test: update golden files for GCP preemptible and AWS SSM price changes

AWS removed the SSM advanced-instances hourly charge and GCP repriced
preemptible/spot instances. Regenerated the affected goldens.

* test: regenerate hcl provider plan JSON for upstream s3-bucket module

The fixture pulls terraform-aws-s3-bucket without a version or ref, so
the expected plan JSON drifts whenever upstream releases. Regenerated
against the current module.

* test: normalise testdata paths in checkouts containing a dot

pathRegex could not traverse a path component with a dot in it, so
REPLACED_PROJECT_PATH substitution silently no-opped in checkouts like
.hh/workspaces and golden comparisons failed on absolute paths.

* test: pin azurerm provider to v4 in th

**File**: `cmd/infracost/cmd_test.go` (modified, +4/-2)
```diff
@@ -33,8 +33,10 @@ var (
 	projectPathRegex = regexp.MustCompile(`(Project:) .*/(examples|cmd/infracost)/(.*)`)
 	versionRegex     = regexp.MustCompile(`Infracost (v|preview).*`)
 	panicRegex       = regexp.MustCompile(`(?s)runtime\serror:(.*?)Environment`)
-	pathRegex        = regexp.MustCompile(`(:\s*"|^|\s|')([a-zA-Z0-9-_/]+/)*(testdata/[^\s"']*)`)
-	credsRegex       = regexp.MustCompile(`/.*/credentials\.yml`)
+	// The prefix must start with a non-dot character so that a leading "./" is
+	// left alone, while still traversing dotted directories such as ".hh".
+	pathRegex  = regexp.MustCompile(`(:\s*"|^|\s|')([a-zA-Z0-9-_/]+[a-zA-Z0-9-_./]*/)*(testdata/[^\s"']*)`)
+	credsRegex = regexp.MustCompile(`/.*/credentials\.yml`)
 )
 
 type GoldenFileOptions = struct {
```

**File**: `internal/providers/terraform/aws/testdata/ssm_activation_test/ssm_activation_test.golden` (modified, +10/-10)
```diff
@@ -1,13 +1,13 @@
 
- Name                                             Monthly Qty  Unit                Monthly Cost    
-                                                                                                   
- aws_ssm_activation.ssm_activation_withUsage                                                       
- └─ On-prem managed instances (advanced)               73,000  hours                    $507.35  * 
-                                                                                                   
- aws_ssm_activation.ssm_activation                                                                 
- └─ On-prem managed instances (advanced)      Monthly cost depends on usage: $0.00695 per hours    
-                                                                                                   
- OVERALL TOTAL                                                                          $507.35 
+ Name                                            Monthly Qty  Unit              Monthly Cost    
+                                                                                                
+ aws_ssm_activation.ssm_activation_withUsage                                                    
+ └─ On-prem managed instances (advanced)              73,000  hours                    $0.00  * 
+                                                                                                
+ aws_ssm_activation.ssm_activation                                                              
+ └─ On-prem managed instances (advanced)      Monthly cost depends on usage: $0.00 per hours    
+                                                                                                
+ OVERALL TOTAL                                                                         $0.00 
 
 *Usage costs can be estimated by updating Infracost Cloud settings, see docs for other options.
 
@@ -18,5 +18,5 @@
 ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━┳━━━━━━━━━━━━┓
 ┃ Project                                            ┃ Baseline cost ┃ Usage cost* ┃ Total cost ┃
 ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━╋━━━━━━━━━━━━┫
-┃ main                                               ┃         $0.00 ┃        $507 ┃       $507 ┃
+┃ main                                               ┃         $0.00 ┃           - ┃      $0.00 ┃
 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━┻━━━━━━━━━━━━┛
\ No newline at end of file
```

**File**: `internal/providers/terraform/google/testdata/compute_instance_test/compute_instance_test.golden` (modified, +15/-15)
```diff
@@ -10,16 +10,16 @@
  ├─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
  └─ NVIDIA Tesla K80 (on-demand)                                         2,920  hours       $919.80   
                                                                                                       
+ google_compute_instance.preemptible_gpu                                                              
+ ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               730  hours       $329.27   
+ ├─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
+ └─ NVIDIA Tesla K80 (preemptible)                                       2,920  hours       $501.95   
+                                                                                                      
  google_compute_instance.gpu_l4                                                                       
  ├─ Instance usage (Linux/UNIX, on-demand, g2-standard-4)                  730  hours       $515.99   
  ├─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
  └─ NVIDIA L4 (on-demand)                                                  730  hours       $286.18   
                                                                                                       
- google_compute_instance.preemptible_gpu                                                              
- ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               730  hours       $169.39   
- ├─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
- └─ NVIDIA Tesla K80 (preemptible)                                       2,920  hours       $501.95   
-                                                                                                      
  google_compute_instance.sud_20_perc_with_hours                                                       
  ├─ Instance usage (Linux/UNIX, on-demand, n2-standard-8)                  730  hours       $226.87   
  └─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
@@ -44,31 +44,31 @@
  ├─ Custom Instance RAM (Linux/UNIX, on-demand, N1 20 GB)                  730  hours        $45.44   
  └─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
                                                                                                       
+ google_compute_instance.custom_preemptible                                                           
+ ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)              730  hours        $86.24   
+ ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)                730  hours        $38.54   
+ └─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
+                                                                                                      
  google_compute_instance.custom_ext                                                                   
  ├─ Custom instance CPU (Linux/UNIX, on-demand, N1 2 vCPUs)                730  hours        $33.92   
  ├─ Custom Instance RAM (Linux/UNIX, on-demand, N1 13 GB)                  730  hours        $29.53   
  ├─ Custom Instance Extended RAM (Linux/UNIX, on-demand, N1 2 GB)          730  hours         $9.76   
  └─ Standard provisioned storage (pd-standard)                              10  GB            $0.40   
                                                                                                       
- google_compute_instance.custom_preemptible                                                           
- ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)              730  hours        $44.41   
- ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)                730  hours        $19.84   
- └─ Sta
```

**File**: `internal/providers/terraform/google/testdata/container_cluster_test/container_cluster_test.golden` (modified, +25/-25)
```diff
@@ -10,7 +10,7 @@
  │  ├─ Instance usage (Linux/UNIX, on-demand, n1-standard-16)                 8,760  hours                  $4,660.30    
  │  └─ Standard provisioned storage (pd-standard)                             1,200  GB                        $48.00    
  └─ node_pool[1]                                                                                                         
-    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $2,032.67    
+    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $3,951.29    
     └─ Standard provisioned storage (pd-standard)                             1,200  GB                        $48.00    
                                                                                                                          
  google_container_cluster.with_node_pools_regional                                                                       
@@ -22,17 +22,9 @@
  │  ├─ Instance usage (Linux/UNIX, on-demand, n1-standard-16)                 4,380  hours                  $2,330.15    
  │  └─ Standard provisioned storage (pd-standard)                               600  GB                        $24.00    
  └─ node_pool[1]                                                                                                         
-    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $2,032.67    
+    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               8,760  hours                  $3,951.29    
     └─ Standard provisioned storage (pd-standard)                             1,200  GB                        $48.00    
                                                                                                                          
- google_container_cluster.with_node_config                                                                               
- ├─ Cluster management fee                                                      730  hours                     $73.00    
- └─ default_pool                                                                                                         
-    ├─ Instance usage (Linux/UNIX, on-demand, n1-standard-16)                 2,190  hours                  $1,165.07    
-    ├─ SSD provisioned storage (pd-ssd)                                         360  GB                        $61.20    
-    ├─ Local SSD provisioned storage                                          1,125  GB                        $90.00    
-    └─ NVIDIA Tesla K80 (on-demand)                                           8,760  hours                  $2,759.40    
-                                                                                                                         
  google_container_cluster.with_node_pools_node_locations_withUsage                                                       
  ├─ Cluster management fee                                                      730  hours                     $73.00    
  ├─ default_pool                                                                                                         
@@ -42,9 +34,26 @@
  │  ├─ Instance usage (Linux/UNIX, on-demand, n1-standard-16)                 5,840  hours                  $3,106.86    
  │  └─ Standard provisioned storage (pd-standard)                               800  GB                        $32.00    
  └─ node_pool[1]                                                                                                         
-    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               2,920  hours                    $677.56    
+    ├─ Instance usage (Linux/UNIX, preemptible, n1-standard-16)               2,920  hours                  $1,317.10    
     └─ Standard provisioned storage (pd-standard)                               400  GB                        $16.00    
        
```

**File**: `internal/providers/terraform/google/testdata/container_node_pool_test/container_node_pool_test.golden` (modified, +12/-12)
```diff
@@ -18,6 +18,16 @@
  ├─ Custom Instance RAM (Linux/UNIX, on-demand, N1 20 GB)            2,190  hours       $136.31   
  └─ Standard provisioned storage (pd-standard)                         300  GB           $12.00   
                                                                                                   
+ google_container_node_pool.with_preemptible_instance                                             
+ ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)        2,190  hours       $258.73   
+ ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)          2,190  hours       $115.63   
+ └─ Standard provisioned storage (pd-standard)                         300  GB           $12.00   
+                                                                                                  
+ google_container_node_pool.with_spot_instance                                                    
+ ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)        2,190  hours       $258.73   
+ ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)          2,190  hours       $115.63   
+ └─ Standard provisioned storage (pd-standard)                         300  GB           $12.00   
+                                                                                                  
  google_container_node_pool.initial_node_count_zonal                                              
  ├─ Instance usage (Linux/UNIX, on-demand, e2-medium)                8,760  hours       $293.51   
  └─ Standard provisioned storage (pd-standard)                       1,200  GB           $48.00   
@@ -64,16 +74,6 @@
  ├─ Instance usage (Linux/UNIX, on-demand, e2-medium)                5,840  hours       $195.67   
  └─ Standard provisioned storage (pd-standard)                         800  GB           $32.00   
                                                                                                   
- google_container_node_pool.with_preemptible_instance                                             
- ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)        2,190  hours       $133.24   
- ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)          2,190  hours        $59.52   
- └─ Standard provisioned storage (pd-standard)                         300  GB           $12.00   
-                                                                                                  
- google_container_node_pool.with_spot_instance                                                    
- ├─ Custom instance CPU (Linux/UNIX, preemptible, N1 6 vCPUs)        2,190  hours       $133.24   
- ├─ Custom Instance RAM (Linux/UNIX, preemptible, N1 20 GB)          2,190  hours        $59.52   
- └─ Standard provisioned storage (pd-standard)                         300  GB           $12.00   
-                                                                                                  
  google_container_node_pool.autoscaling_zonal                                                     
  ├─ Instance usage (Linux/UNIX, on-demand, e2-medium)                4,380  hours       $146.76   
  └─ Standard provisioned storage (pd-standard)                         600  GB           $24.00   
@@ -122,7 +122,7 @@
  ├─ Instance usage (Linux/UNIX, on-demand, e2-medium)                1,460  hours        $48.92   
  └─ Standard provisioned storage (pd-standard)                         200  GB            $8.00   
                                                                                                   
- OVERALL TOTAL                                                                      $28,114.99 
+ OVERALL TOTAL                                                                      $28,478.18 
 
 *Usage costs can be estimated by updating Infracost Cloud settings, see docs for other options.
 
@@ -133,5 +133,5 @@
 ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━┳━━━━━━━━━━━━┓
 ┃ Project                  
```

---

### Incident Patch 4: `4f7170bc` (2026-09-09)
**Commit Message**: fix(deps): bump golang.org/x/mod to v0.40.0 (#3615)

CVE-2026-56864 and CVE-2026-56865 in golang.org/x/mod v0.37.0, fixed in
v0.40.0. Flagged by AWS Inspector against hosted-cloud-pricing-api's
image, which builds this CLI from source on every rebuild.

**File**: `go.mod` (modified, +8/-8)
```diff
@@ -40,8 +40,8 @@ require (
 	github.com/stretchr/testify v1.11.1
 	github.com/tidwall/gjson v1.17.0
 	github.com/zclconf/go-cty v1.17.0
-	golang.org/x/crypto v0.53.0 // indirect
-	golang.org/x/mod v0.37.0
+	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/mod v0.40.0
 	gopkg.in/go-playground/assert.v1 v1.2.1
 	gopkg.in/yaml.v2 v2.4.0
 	gopkg.in/yaml.v3 v3.0.1
@@ -50,7 +50,7 @@ require (
 require (
 	github.com/aws/aws-sdk-go-v2/service/eks v1.73.3
 	github.com/hashicorp/terraform-config-inspect v0.0.0-20210625153042-09f34846faab
-	golang.org/x/sys v0.46.0 // indirect
+	golang.org/x/sys v0.47.0 // indirect
 )
 
 require (
@@ -81,15 +81,15 @@ require (
 	github.com/slack-go/slack v0.27.0
 	github.com/tidwall/match v1.1.1 // indirect
 	github.com/tidwall/pretty v1.2.1 // indirect
-	golang.org/x/text v0.39.0
-	golang.org/x/tools v0.47.0 // indirect
+	golang.org/x/text v0.41.0
+	golang.org/x/tools v0.49.0 // indirect
 )
 
 require (
 	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.10 // indirect
 	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.23 // indirect
 	github.com/gorilla/websocket v1.5.3 // indirect
-	golang.org/x/sync v0.21.0
+	golang.org/x/sync v0.22.0
 )
 
 require (
@@ -265,7 +265,7 @@ require (
 	go.opentelemetry.io/otel/sdk/metric v1.43.0 // indirect
 	go.opentelemetry.io/otel/trace v1.44.0 // indirect
 	go4.org v0.0.0-20230225012048-214862532bf5 // indirect
-	golang.org/x/term v0.44.0 // indirect
+	golang.org/x/term v0.45.0 // indirect
 	golang.org/x/time v0.11.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260414002931-afd174a4e478 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260414002931-afd174a4e478 // indirect
@@ -305,7 +305,7 @@ require (
 	github.com/yashtewari/glob-intersection v0.2.0 // indirect
 	github.com/zclconf/go-cty-yaml v1.0.3
 	go.opencensus.io v0.24.0 // indirect
-	golang.org/x/net v0.56.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
 	google.golang.org/api v0.215.0
 	google.golang.org/genproto v0.0.0-20241118233622-e639e219e697 // indirect
 	google.golang.org/grpc v1.82.1 // indirect
```

**File**: `go.sum` (modified, +16/-16)
```diff
@@ -1885,8 +1885,8 @@ golang.org/x/crypto v0.38.0/go.mod h1:MvrbAqul58NNYPKnOra203SB9vpuZW0e+RRZV+Ggqj
 golang.org/x/crypto v0.39.0/go.mod h1:L+Xg3Wf6HoL4Bn4238Z6ft6KfEpN0tJGo53AAPC632U=
 golang.org/x/crypto v0.40.0/go.mod h1:Qr1vMER5WyS2dfPHAlsOj01wgLbsyWtFn/aY+5+ZdxY=
 golang.org/x/crypto v0.41.0/go.mod h1:pO5AFd7FA68rFak7rOAGVuygIISepHftHnr8dr6+sUc=
-golang.org/x/crypto v0.53.0 h1:QZ4Muo8THX6CizN2vPPd5fBGHyogrdK9fG4wLPFUsto=
-golang.org/x/crypto v0.53.0/go.mod h1:DNLU434OwVakk9PzuwV8w62mAJpRJL3vsgcfp4Qnsio=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/exp v0.0.0-20180321215751-8460e604b9de/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20180807140117-3d87b88a115f/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
@@ -1953,8 +1953,8 @@ golang.org/x/mod v0.18.0/go.mod h1:hTbmBsO62+eylJbnUtE2MGJUyE7QWk4xUqPFrRgJ+7c=
 golang.org/x/mod v0.24.0/go.mod h1:IXM97Txy2VM4PJ3gI61r1YEk/gAj6zAHN3AdZt6S9Ww=
 golang.org/x/mod v0.25.0/go.mod h1:IXM97Txy2VM4PJ3gI61r1YEk/gAj6zAHN3AdZt6S9Ww=
 golang.org/x/mod v0.26.0/go.mod h1:/j6NAhSk8iQ723BGAUyoAcn7SlD7s15Dp9Nd/SfeaFQ=
-golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
-golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
+golang.org/x/mod v0.40.0 h1:hUv+3cXcdRHz08UmSiOob7sadHig73uo5bkXxQ/tvUs=
+golang.org/x/mod v0.40.0/go.mod h1:0/weTWkPWGBikyTWAX3dkjVztMmBA5hM0DH6BElSupE=
 golang.org/x/net v0.0.0-20170114055629-f2499483f923/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180530234432-1e491301e022/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180724234803-3673e40ba225/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
@@ -2033,8 +2033,8 @@ golang.org/x/net v0.40.0/go.mod h1:y0hY0exeL2Pku80/zKK7tpntoX23cqL3Oa6njdgRtds=
 golang.org/x/net v0.41.0/go.mod h1:B/K4NNqkfmg07DQYrbwvSluqCJOOXwUjeb/5lOisjbA=
 golang.org/x/net v0.42.0/go.mod h1:FF1RA5d3u7nAYA4z2TkclSCKh68eSXtiFwcWQpPXdt8=
 golang.org/x/net v0.43.0/go.mod h1:vhO1fvI4dGsIjh73sWfUVjj3N7CA9WkKJNQm2svM6Jg=
-golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
-golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
+golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
+golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
 golang.org/x/oauth2 v0.0.0-20190604053449-0f29369cfe45/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
@@ -2089,8 +2089,8 @@ golang.org/x/sync v0.7.0/go.mod h1:Czt+wKu1gCyEFDUtn0jG5QVvpJ6rzVqr5aXyt9drQfk=
 golang.org/x/sync v0.14.0/go.mod h1:1dzgHSNfp02xaA81J2MS99Qcpr2w7fw1gpm99rleRqA=
 golang.org/x/sync v0.15.0/go.mod h1:1dzgHSNfp02xaA81J2MS99Qcpr2w7fw1gpm99rleRqA=
 golang.org/x/sync v0.16.0/go.mod h1:1dzgHSNfp02xaA81J2MS99Qcpr2w7fw1gpm99rleRqA=
-golang.org/x/sync v0.21.0 h1:HLII4xRRTtCRkxYp4HNFF0Js/Og6q2i++KXbg0gHCwM=
-golang.org/x/sync v0.21.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
+golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
 golang.org/x/sys v0.0.0-20170830134202-bb24a47a89ea/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20180816055513-1c9583448a9c/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20180823144017-11551d06cbcc/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
@@ -2199,8 +2199,8 @@ golang.org/x/sys v0.29.0
```

---

### Incident Patch 5: `95ba4f49` (2026-08-21)
**Commit Message**: Update bug report issue template (#3582)

**File**: `.github/ISSUE_TEMPLATE/bug_report.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+---
+name: Bug report
+about: Create a report to help us improve
+title: ''
+labels: ''
+assignees: ''
+
+---
+
+**Create a new thread in discussions**
+We use GitHub issues only for work that is ready to be started. If you're running into an issue or think you've found a bug please [create a new thread in Discussions](https://github.com/infracost/infracost/discussions/new?category=bug-reports).
+
+Please provide a clear and concise description of what the bug is, the steps to reproduce the behavior, and what the expected behavior should be.
```

---

### Incident Patch 6: `d066927f` (2026-08-20)
**Commit Message**: fix(docker): bump builder to golang 1.26.6 for CVE-2026-39821 (#3607)

* fix(docker): bump builder image to golang 1.26.6 to patch CVE-2026-39821

The golang images set GOTOOLCHAIN=local, so the toolchain directive in
go.mod is ignored and images were still built with the 1.26.5 stdlib.

* fix(docker): fail the build on Go toolchain drift with GOTOOLCHAIN=path

* chore(docker): match the standard GOTOOLCHAIN comment wording

* chore(docker): adopt the ARG GO_VERSION pattern used in other repos

**File**: `Dockerfile` (modified, +7/-1)
```diff
@@ -1,4 +1,6 @@
-FROM golang:1.26.5 AS builder
+ARG GO_VERSION=1.26.6
+
+FROM golang:${GO_VERSION} AS builder
 
 ARG ARCH=linux
 ARG DEFAULT_TERRAFORM_VERSION=0.15.5
@@ -8,6 +10,10 @@ ARG TERRAGRUNT_VERSION=0.31.8
 SHELL ["/bin/bash", "-c"]
 ENV HOME=/app
 ENV CGO_ENABLED=0
+# force the GO_VERSION above to be in sync with the `toolchain` directive in go.mod.
+# This avoids downloading other Go Toolchains, which happens silently and would slow
+# down our image builds.
+ENV GOTOOLCHAIN=path
 
 # Install Packages
 RUN apt-get update -q && apt-get -y install unzip && rm -rf /var/lib/apt/lists/*
```

**File**: `Dockerfile.ci` (modified, +7/-1)
```diff
@@ -1,11 +1,17 @@
-FROM golang:1.26.5 AS builder
+ARG GO_VERSION=1.26.6
+
+FROM golang:${GO_VERSION} AS builder
 
 ARG ARCH=linux64
 
 # Set Environment Variables
 SHELL ["/bin/bash", "-c"]
 ENV HOME=/app
 ENV CGO_ENABLED=0
+# force the GO_VERSION above to be in sync with the `toolchain` directive in go.mod.
+# This avoids downloading other Go Toolchains, which happens silently and would slow
+# down our image builds.
+ENV GOTOOLCHAIN=path
 
 WORKDIR /app
 
```

---

### Incident Patch 7: `8c843ffc` (2026-08-20)
**Commit Message**: fix(deps): bump Go toolchain to 1.26.6 to patch CVE-2026-39821 (#3606)

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ module github.com/infracost/infracost
 
 go 1.26.0
 
-toolchain go1.26.5
+toolchain go1.26.6
 
 require (
 	github.com/Masterminds/goutils v1.1.1 // indirect
```

---

### Incident Patch 8: `0c473ade` (2026-08-11)
**Commit Message**: fix(deps): update vulnerable Go modules (#3604)

**File**: `go.mod` (modified, +19/-19)
```diff
@@ -40,8 +40,8 @@ require (
 	github.com/stretchr/testify v1.11.1
 	github.com/tidwall/gjson v1.17.0
 	github.com/zclconf/go-cty v1.17.0
-	golang.org/x/crypto v0.52.0 // indirect
-	golang.org/x/mod v0.35.0
+	golang.org/x/crypto v0.53.0 // indirect
+	golang.org/x/mod v0.37.0
 	gopkg.in/go-playground/assert.v1 v1.2.1
 	gopkg.in/yaml.v2 v2.4.0
 	gopkg.in/yaml.v3 v3.0.1
@@ -50,7 +50,7 @@ require (
 require (
 	github.com/aws/aws-sdk-go-v2/service/eks v1.73.3
 	github.com/hashicorp/terraform-config-inspect v0.0.0-20210625153042-09f34846faab
-	golang.org/x/sys v0.45.0 // indirect
+	golang.org/x/sys v0.46.0 // indirect
 )
 
 require (
@@ -81,15 +81,15 @@ require (
 	github.com/slack-go/slack v0.27.0
 	github.com/tidwall/match v1.1.1 // indirect
 	github.com/tidwall/pretty v1.2.1 // indirect
-	golang.org/x/text v0.37.0
-	golang.org/x/tools v0.44.0 // indirect
+	golang.org/x/text v0.39.0
+	golang.org/x/tools v0.47.0 // indirect
 )
 
 require (
 	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.10 // indirect
 	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.23 // indirect
 	github.com/gorilla/websocket v1.5.3 // indirect
-	golang.org/x/sync v0.20.0
+	golang.org/x/sync v0.21.0
 )
 
 require (
@@ -123,7 +123,7 @@ require (
 	github.com/withfig/autocomplete-tools/packages/cobra v1.2.0
 	github.com/xanzy/go-gitlab v0.86.0
 	golang.org/x/exp v0.0.0-20260410095643-746e56fc9e2f
-	golang.org/x/oauth2 v0.34.0
+	golang.org/x/oauth2 v0.36.0
 	k8s.io/apimachinery v0.29.2
 )
 
@@ -147,7 +147,7 @@ require (
 	github.com/Azure/go-autorest/autorest/validation v0.3.1 // indirect
 	github.com/Azure/go-autorest/logger v0.2.1 // indirect
 	github.com/Azure/go-autorest/tracing v0.6.0 // indirect
-	github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.30.0 // indirect
+	github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.32.0 // indirect
 	github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.48.1 // indirect
 	github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/resourcemapping v0.48.1 // indirect
 	github.com/Masterminds/semver/v3 v3.2.1 // indirect
@@ -169,7 +169,7 @@ require (
 	github.com/cenkalti/backoff/v3 v3.2.2 // indirect
 	github.com/cespare/xxhash/v2 v2.3.0 // indirect
 	github.com/cloudflare/circl v1.6.3 // indirect
-	github.com/cncf/xds/go v0.0.0-20251210132809-ee656c7534f5 // indirect
+	github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2 // indirect
 	github.com/containerd/continuity v0.3.0 // indirect
 	github.com/cpuguy83/go-md2man/v2 v2.0.6 // indirect
 	github.com/creack/pty v1.1.11 // indirect
@@ -178,8 +178,8 @@ require (
 	github.com/dlclark/regexp2 v1.8.1 // indirect
 	github.com/dsnet/compress v0.0.2-0.20230904184137-39efe44ab707 // indirect
 	github.com/emirpasic/gods v1.18.1 // indirect
-	github.com/envoyproxy/go-control-plane/envoy v1.36.0 // indirect
-	github.com/envoyproxy/protoc-gen-validate v1.3.0 // indirect
+	github.com/envoyproxy/go-control-plane/envoy v1.37.0 // indirect
+	github.com/envoyproxy/protoc-gen-validate v1.3.3 // indirect
 	github.com/felixge/httpsnoop v1.0.4 // indirect
 	github.com/go-git/gcfg v1.5.1-0.20230307220236-3a3c6141e376 // indirect
 	github.com/go-ini/ini v1.67.0 // indirect
@@ -241,7 +241,7 @@ require (
 	github.com/sorairolake/lzip-go v0.3.5 // indirect
 	github.com/sourcegraph/go-lsp v0.0.0-20200429204803-219e11d77f5d // indirect
 	github.com/sourcegraph/jsonrpc2 v0.2.0 // indirect
-	github.com/spf13/afero v1.12.0 // indirect
+	github.com/spf13/afero v1.15.0 // indirect
 	github.com/spiffe/go-spiffe/v2 v2.6.0 // indirect
 	github.com/tchap/go-patricia/v2 v2.3.2 // indirect
 	github.com/terraform-linters/tflint v0.46.1 // indirect
@@ -256,7 +256,7 @@ require (
 	go.mozilla.org/gopgagent v0.0.0-20170926210634-4d7ea76ff71a // indirect
 	go.mozilla.org/sops/v3 v3.7.3 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
-	go.opentelemetry.io/contrib/detectors/gcp v1.39.0 // indirect
+	g
```

**File**: `go.sum` (modified, +42/-42)
```diff
@@ -673,8 +673,8 @@ github.com/BurntSushi/toml v0.3.1/go.mod h1:xHWCNGjB5oqiDr8zfno3MHue2Ht5sIBksp03
 github.com/BurntSushi/xgb v0.0.0-20160522181843-27f122750802/go.mod h1:IVnqGOEym/WlBOVXweHU+Q+/VP0lqqI8lqeDx9IjBqo=
 github.com/ChrisTrenkamp/goxpath v0.0.0-20170922090931-c385f95c6022/go.mod h1:nuWgzSkT5PnyOd+272uUmV0dnAnAn42Mk7PiQC5VzN4=
 github.com/ChrisTrenkamp/goxpath v0.0.0-20190607011252-c5096ec8773d/go.mod h1:nuWgzSkT5PnyOd+272uUmV0dnAnAn42Mk7PiQC5VzN4=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.30.0 h1:sBEjpZlNHzK1voKq9695PJSX2o5NEXl7/OL3coiIY0c=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.30.0/go.mod h1:P4WPRUkOhJC13W//jWpyfJNDAIpvRbAUIYLX/4jtlE0=
+github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.32.0 h1:rIkQfkCOVKc1OiRCNcSDD8ml5RJlZbH/Xsq7lbpynwc=
+github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.32.0/go.mod h1:RD2SsorTmYhF6HkTmDw7KmPYQk8OBYwTkuasChwv7R4=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.48.1 h1:UQ0AhxogsIRZDkElkblfnwjc3IaltCm2HUMvezQaL7s=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.48.1/go.mod h1:jyqM3eLpJ3IbIFDTKVz2rF9T/xWGW0rIriGwnz8l9Tk=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/cloudmock v0.48.1 h1:oTX4vsorBZo/Zdum6OKPA4o7544hm6smoRv1QjpTwGo=
@@ -905,8 +905,8 @@ github.com/cncf/xds/go v0.0.0-20211011173535-cb28da3451f1/go.mod h1:eXthEFrGJvWH
 github.com/cncf/xds/go v0.0.0-20220314180256-7f1daf1720fc/go.mod h1:eXthEFrGJvWHgFFCl3hGmgk+/aYT6PnTQLykKQRLhEs=
 github.com/cncf/xds/go v0.0.0-20230105202645-06c439db220b/go.mod h1:eXthEFrGJvWHgFFCl3hGmgk+/aYT6PnTQLykKQRLhEs=
 github.com/cncf/xds/go v0.0.0-20230607035331-e9ce68804cb4/go.mod h1:eXthEFrGJvWHgFFCl3hGmgk+/aYT6PnTQLykKQRLhEs=
-github.com/cncf/xds/go v0.0.0-20251210132809-ee656c7534f5 h1:6xNmx7iTtyBRev0+D/Tv1FZd4SCg8axKApyNyRsAt/w=
-github.com/cncf/xds/go v0.0.0-20251210132809-ee656c7534f5/go.mod h1:KdCmV+x/BuvyMxRnYBlmVaq4OLiKW6iRQfvC62cvdkI=
+github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2 h1:aBangftG7EVZoUb69Os8IaYg++6uMOdKK83QtkkvJik=
+github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2/go.mod h1:qwXFYgsP6T7XnJtbKlf1HP8AjxZZyzxMmc+Lq5GjlU4=
 github.com/containerd/continuity v0.3.0 h1:nisirsYROK15TAMVukJOUyGJjz4BNQJBVsNvAXZJ/eg=
 github.com/containerd/continuity v0.3.0/go.mod h1:wJEAIwKOm/pBZuBd0JmeTvnLquTB1Ag8espWhkykbPM=
 github.com/coreos/bbolt v1.3.0/go.mod h1:iRUV2dpdMOn7Bo10OQBFzIJO9kkE559Wcmn+qkEiiKk=
@@ -979,16 +979,16 @@ github.com/envoyproxy/go-control-plane v0.10.3/go.mod h1:fJJn/j26vwOu972OllsvAgJ
 github.com/envoyproxy/go-control-plane v0.11.1-0.20230524094728-9239064ad72f/go.mod h1:sfYdkwUW4BA3PbKjySwjJy+O4Pu0h62rlqCMHNk+K+Q=
 github.com/envoyproxy/go-control-plane v0.14.0 h1:hbG2kr4RuFj222B6+7T83thSPqLjwBIfQawTkC++2HA=
 github.com/envoyproxy/go-control-plane v0.14.0/go.mod h1:NcS5X47pLl/hfqxU70yPwL9ZMkUlwlKxtAohpi2wBEU=
-github.com/envoyproxy/go-control-plane/envoy v1.36.0 h1:yg/JjO5E7ubRyKX3m07GF3reDNEnfOboJ0QySbH736g=
-github.com/envoyproxy/go-control-plane/envoy v1.36.0/go.mod h1:ty89S1YCCVruQAm9OtKeEkQLTb+Lkz0k8v9W0Oxsv98=
+github.com/envoyproxy/go-control-plane/envoy v1.37.0 h1:u3riX6BoYRfF4Dr7dwSOroNfdSbEPe9Yyl09/B6wBrQ=
+github.com/envoyproxy/go-control-plane/envoy v1.37.0/go.mod h1:DReE9MMrmecPy+YvQOAOHNYMALuowAnbjjEMkkWOi6A=
 github.com/envoyproxy/go-control-plane/ratelimit v0.1.0 h1:/G9QYbddjL25KvtKTv3an9lx6VBE2cnb8wp1vEGNYGI=
 github.com/envoyproxy/go-control-plane/ratelimit v0.1.0/go.mod h1:Wk+tMFAFbCXaJPzVVHnPgRKdUdwW/KdbRt94AzgRee4=
 github.com/envoyproxy/protoc-gen-validate v0.1.0/go.mod h1:iSmxcyjqTsJpI2R4NaDN7+kN2VEUnK/pcBlmesArF7c=
 github.com/envoyproxy/protoc-gen-validate v0.6.7/go.mod h1:dyJXwwfPK2VSqiB9Klm1J6romD608Ba7Hij42vrOBCo=
 github.com/envoyproxy/protoc-gen-validate v0.9.1/go.mod h1:OKNgG7TCp5pF4d6XftA0++PMirau2/yoOwVac3AbF2w=
 github.com/envoyproxy/protoc-gen-validate v0.10
```

---

### Incident Patch 9: `b6a5d941` (2026-07-30)
**Commit Message**: fix(deps): bump Go to 1.25.12 to patch CVE-2026-39822 (#3597)

* fix(deps): move Go to 1.26.5 to patch CVE-2026-39822

* fix(test): scrub panic output containing toolchain module paths

The panic scrubber's character class had no hyphen, so it stopped
matching once stack traces started resolving through
golang.org/toolchain@v0.0.1-go1.26.5.linux-amd64.

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.25.11 AS builder
+FROM golang:1.26.5 AS builder
 
 ARG ARCH=linux
 ARG DEFAULT_TERRAFORM_VERSION=0.15.5
```

**File**: `Dockerfile.ci` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.25.11 AS builder
+FROM golang:1.26.5 AS builder
 
 ARG ARCH=linux64
 
```

**File**: `cmd/infracost/cmd_test.go` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ var (
 	urlRegex         = regexp.MustCompile(`https://dashboard.infracost.io/share/.*`)
 	projectPathRegex = regexp.MustCompile(`(Project:) .*/(examples|cmd/infracost)/(.*)`)
 	versionRegex     = regexp.MustCompile(`Infracost (v|preview).*`)
-	panicRegex       = regexp.MustCompile(`runtime\serror:([\w\d\n\r\[\]\:\/\.\\(\)\+\,\{\}\*\@\s\?]*)Environment`)
+	panicRegex       = regexp.MustCompile(`(?s)runtime\serror:(.*?)Environment`)
 	pathRegex        = regexp.MustCompile(`(:\s*"|^|\s|')([a-zA-Z0-9-_/]+/)*(testdata/[^\s"']*)`)
 	credsRegex       = regexp.MustCompile(`/.*/credentials\.yml`)
 )
```

**File**: `go.mod` (modified, +3/-1)
```diff
@@ -1,6 +1,8 @@
 module github.com/infracost/infracost
 
-go 1.25.11
+go 1.26.0
+
+toolchain go1.26.5
 
 require (
 	github.com/Masterminds/goutils v1.1.1 // indirect
```

---

### Incident Patch 10: `3d24c757` (2026-07-02)
**Commit Message**: fix(security): scope Terraform Cloud/registry tokens to trusted hosts (#3590)

* fix(security): scope Terraform Cloud/registry tokens to trusted hosts [FIX-350]

Several code paths attached a configured secret token to an HTTP request
whose destination host was derived from untrusted .tf / module-source
input, with no check that the host was the trusted endpoint. An attacker
supplying Terraform that Infracost scans (e.g. a PR) could point the host
at their own domain and receive the token as a Bearer credential.

- Remote-variables loader: only honor the .tf hostname when it matches the
  trusted host (TERRAFORM_CLOUD_HOST, else app.terraform.io); error when a
  token is set but no host is configured, skip when a different host is
  pinned.
- Remote-plan (runRemotePlan/cloudAPI): only send the primary token when the
  run host matches the trusted host, otherwise refuse.
- Terragrunt registry: only attach TG_TF_REGISTRY_TOKEN to an allowlist of
  trusted registry hosts.

* fix(security): scope registry token via local getter, honor TFC host config + TG_TF_DEFAULT_REGISTRY_HOST

Wire the tfr getter to Infracost's local TerraformRegistryGetter (carrying
over the INFRACOST_REGISTRY_PRO

**File**: `internal/extclient/authed_client.go` (modified, +6/-0)
```diff
@@ -43,6 +43,12 @@ func NewAuthedAPIClient(host, token string) *AuthedAPIClient {
 	}
 }
 
+// Host returns the trusted host that the authed API client sends
+// authenticated requests to.
+func (a *AuthedAPIClient) Host() string {
+	return a.host
+}
+
 // SetHost sets the host for base host for the authed API client.
 func (a *AuthedAPIClient) SetHost(host string) {
 	a.host = host
```

**File**: `internal/hcl/parser.go` (modified, +6/-3)
```diff
@@ -217,15 +217,18 @@ func OptionWithRawCtyInput(input cty.Value) (op Option) {
 }
 
 // OptionWithTFCRemoteVarLoader accepts Terraform Cloud/Enterprise host and token
-// values to load remote execution variables.
-func OptionWithTFCRemoteVarLoader(host, token, localWorkspace string, loaderOpts ...TFCRemoteVariablesLoaderOption) Option {
+// values to load remote execution variables. hostConfigured indicates whether
+// the host was explicitly set by the user (rather than defaulted to
+// app.terraform.io), which controls how the loader handles a mismatching host
+// in the scanned Terraform.
+func OptionWithTFCRemoteVarLoader(host, token, localWorkspace string, hostConfigured bool, loaderOpts ...TFCRemoteVariablesLoaderOption) Option {
 	return func(p *Parser) {
 		if host == "" || token == "" {
 			return
 		}
 
 		client := extclient.NewAuthedAPIClient(host, token)
-		p.remoteVariableLoaders = append(p.remoteVariableLoaders, NewTFCRemoteVariablesLoader(client, localWorkspace, p.logger, loaderOpts...))
+		p.remoteVariableLoaders = append(p.remoteVariableLoaders, NewTFCRemoteVariablesLoader(client, localWorkspace, hostConfigured, p.logger, loaderOpts...))
 	}
 }
 
```

**File**: `internal/hcl/remote_variables_loader.go` (modified, +35/-1)
```diff
@@ -35,6 +35,12 @@ type TFCRemoteVariablesLoader struct {
 	client         *extclient.AuthedAPIClient
 	localWorkspace string
 	remoteConfig   *TFCRemoteConfig
+	// hostConfigured is true when the user has explicitly set the Terraform
+	// Cloud host (via the TERRAFORM_CLOUD_HOST env var or terraform_cloud_host
+	// config option) rather than falling back to the app.terraform.io default.
+	// It controls how we react when the scanned Terraform requests a different
+	// host to the trusted one: see Load.
+	hostConfigured bool
 	logger         zerolog.Logger
 }
 
@@ -102,14 +108,15 @@ func RemoteVariablesLoaderWithRemoteConfig(config TFCRemoteConfig) TFCRemoteVari
 }
 
 // NewTFCRemoteVariablesLoader constructs a new loader for fetching remote variables.
-func NewTFCRemoteVariablesLoader(client *extclient.AuthedAPIClient, localWorkspace string, logger zerolog.Logger, opts ...TFCRemoteVariablesLoaderOption) *TFCRemoteVariablesLoader {
+func NewTFCRemoteVariablesLoader(client *extclient.AuthedAPIClient, localWorkspace string, hostConfigured bool, logger zerolog.Logger, opts ...TFCRemoteVariablesLoaderOption) *TFCRemoteVariablesLoader {
 	if localWorkspace == "" {
 		localWorkspace = os.Getenv("TF_WORKSPACE")
 	}
 
 	r := &TFCRemoteVariablesLoader{
 		client:         client,
 		localWorkspace: localWorkspace,
+		hostConfigured: hostConfigured,
 		logger:         logger,
 	}
 
@@ -153,7 +160,28 @@ func (r *TFCRemoteVariablesLoader) Load(options RemoteVarLoaderOptions) (map[str
 		}
 	}
 
+	// config.Host may have come from the scanned Terraform (the cloud/backend
+	// "hostname" attribute), which is untrusted input. We must never send the
+	// configured Terraform Cloud token to a host other than the trusted one,
+	// otherwise a malicious .tf could exfiltrate the token to an attacker host.
+	trustedHost := r.client.Host()
+	if config.Host != "" && !hostsEqual(config.Host, trustedHost) {
+		if r.hostConfigured {
+			// The user pinned a trusted host but the scanned Terraform asks for a
+			// different one. Don't send the token to the unverified host, just
+			// skip loading remote variables.
+			r.logger.Warn().Msgf("Terraform config sets hostname %q which does not match the configured Terraform Cloud host %q, not sending token to the unverified host and skipping remote variable loading", config.Host, trustedHost)
+			return vars, nil
+		}
+
+		// The user has a Terraform Cloud token set but has not pinned a trusted
+		// host, and the scanned Terraform is trying to point us at its own host.
+		// Refuse to run rather than risk sending the token to an untrusted host.
+		return vars, errors.Errorf("the Terraform being scanned sets a Terraform Cloud/Enterprise hostname (%q), but no trusted host is configured. Infracost will not send your Terraform Cloud token to an unverified host. If %q is trusted, set the TERRAFORM_CLOUD_HOST environment variable (or terraform_cloud_host config option) to it.", config.Host, config.Host)
+	}
+
 	if config.Host != "" {
+		// config.Host has been verified to match the trusted host.
 		r.client.SetHost(config.Host)
 	}
 
@@ -361,6 +389,12 @@ func (r *TFCRemoteVariablesLoader) getVarValue(variable tfcVar) cty.Value {
 	return cty.StringVal(variable.Value)
 }
 
+// hostsEqual reports whether two Terraform Cloud/Enterprise hostnames refer to
+// the same host, ignoring case and any trailing dot.
+func hostsEqual(a, b string) bool {
+	return strings.EqualFold(strings.TrimSuffix(a, "."), strings.TrimSuffix(b, "."))
+}
+
 func getAttribute(block *Block, name string) string {
 	if block == nil {
 		return ""
```

**File**: `internal/hcl/remote_variables_loader_tfc_test.go` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+package hcl
+
+import (
+	"path/filepath"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+
+	"github.com/infracost/infracost/internal/config"
+	"github.com/infracost/infracost/internal/extclient"
+	"github.com/infracost/infracost/internal/hcl/modules"
+	"github.com/infracost/infracost/internal/sync"
+)
+
+// blocksFromHCL parses the given Terraform source into a set of Blocks so the
+// remote variables loader can be exercised against realistic input.
+func blocksFromHCL(t *testing.T, contents string) Blocks {
+	t.Helper()
+
+	path := createTestFile("main.tf", contents)
+	logger := newDiscardLogger()
+	loader := modules.NewModuleLoader(modules.ModuleLoaderOptions{
+		CachePath:         filepath.Dir(path),
+		HCLParser:         modules.NewSharedHCLParser(),
+		CredentialsSource: nil,
+		SourceMap:         config.TerraformSourceMap{},
+		SourceMapRegex:    nil,
+		Logger:            logger,
+		ModuleSync:        &sync.KeyMutex{},
+	})
+	parser := NewParser(
+		RootPath{DetectedPath: filepath.Dir(path)},
+		CreateEnvFileMatcher([]string{}, nil),
+		loader,
+		logger,
+	)
+
+	module, err := parser.ParseDirectory()
+	require.NoError(t, err)
+
+	return module.Blocks
+}
+
+// TestTFCRemoteVariablesLoader_Load_HostValidation verifies that the loader
+// never sends the configured Terraform Cloud token to a host derived from the
+// (untrusted) scanned Terraform when that host does not match the trusted one.
+func TestTFCRemoteVariablesLoader_Load_HostValidation(t *testing.T) {
+	// A cloud block that points at an attacker-controlled host.
+	blocks := blocksFromHCL(t, `
+terraform {
+  cloud {
+    organization = "my-org"
+    hostname     = "attacker.example.com"
+    workspaces {
+      name = "my-workspace"
+    }
+  }
+}
+`)
+
+	t.Run("errors when scanned Terraform sets a host and no host is configured", func(t *testing.T) {
+		client := extclient.NewAuthedAPIClient("app.terraform.io", "secret-token")
+		loader := NewTFCRemoteVariablesLoader(client, "", false, newDiscardLogger())
+
+		_, err := loader.Load(RemoteVarLoaderOptions{Blocks: blocks})
+		require.Error(t, err)
+		assert.Contains(t, err.Error(), "attacker.example.com")
+		assert.Contains(t, err.Error(), "TERRAFORM_CLOUD_HOST")
+		// The client must not have been repointed at the untrusted host.
+		assert.Equal(t, "app.terraform.io", client.Host())
+	})
+
+	t.Run("skips without error when a different trusted host is configured", func(t *testing.T) {
+		client := extclient.NewAuthedAPIClient("tfe.mycorp.com", "secret-token")
+		loader := NewTFCRemoteVariablesLoader(client, "", true, newDiscardLogger())
+
+		vars, err := loader.Load(RemoteVarLoaderOptions{Blocks: blocks})
+		require.NoError(t, err)
+		assert.Empty(t, vars)
+		// The client must not have been repointed at the untrusted host.
+		assert.Equal(t, "tfe.mycorp.com", client.Host())
+	})
+}
```

**File**: `internal/providers/terraform/cloud.go` (modified, +7/-0)
```diff
@@ -4,13 +4,20 @@ import (
 	"fmt"
 	"io"
 	"net/http"
+	"strings"
 
 	"github.com/pkg/errors"
 
 	"github.com/infracost/infracost/internal/credentials"
 	"github.com/infracost/infracost/internal/logging"
 )
 
+// hostsEqual reports whether two Terraform Cloud/Enterprise hostnames refer to
+// the same host, ignoring case and any trailing dot.
+func hostsEqual(a, b string) bool {
+	return strings.EqualFold(strings.TrimSuffix(a, "."), strings.TrimSuffix(b, "."))
+}
+
 func cloudAPI(host string, path string, token string) ([]byte, error) {
 	client := &http.Client{}
 
```

#### Recent Merged Pull Requests:
- **PR #3623** (2026-09-24): fix(deps): bump x/crypto and klauspost/compress for govulncheck (@aliscott)
- **PR #3622** (2026-09-24): fix(aws): exclude CloudWatch Omni from Logs Insights query pricing (@aliscott)
- **PR #3621** (2026-09-24): test(google): update golden files for preemptible price changes (@aliscott)
- **PR #3620** (2026-09-21): fix(azure): match renamed PostgreSQL Flexible Server storage price (@aliscott)
- **PR #3619** (2026-09-24): chore(deps): bump go.opentelemetry.io/otel/sdk from 1.44.0 to 1.45.0 (@dependabot[bot])
- **PR #3617** (closed): Mark azurerm_storage_account_queue_properties as a free resource (@srpomeroy)
- **PR #3615** (2026-09-09): fix(deps): bump golang.org/x/mod to v0.40.0 (@aliscott)
- **PR #3611** (2026-09-24): chore(deps): bump google.golang.org/grpc from 1.82.1 to 1.83.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

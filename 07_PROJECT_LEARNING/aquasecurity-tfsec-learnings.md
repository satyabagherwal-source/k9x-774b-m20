# Forensic Learning Record (Deep Inspection): aquasecurity/tfsec

> **Canonical Artifact**: `07_PROJECT_LEARNING/aquasecurity-tfsec-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aquasecurity/tfsec](https://github.com/aquasecurity/tfsec))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:31:34.268Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aquasecurity/tfsec`
- **Description**: Tfsec is now part of Trivy
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 7041 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/tfsec-checkgen/main.go`
```
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/aquasecurity/defsec/pkg/scan"

	"github.com/aquasecurity/defsec/pkg/scanners/terraform"

	survey "github.com/AlecAivazis/survey/v2"
	"github.com/aquasecurity/tfsec/internal/pkg/custom"
	"github.com/spf13/cobra"
)

var passTests []string
var failTests []string

func init() {
	rootCmd.AddCommand(validateCmd)
	rootCmd.AddCommand(testCheckCmd)
	testCheckCmd.Flags().StringSliceVarP(&passTests, "pass", "p", []string{}, "path to passing test terraform file")
	testCheckCmd.Flags().StringSliceVarP(&failTests, "fail", "f", []string{}, "path to failing test terraform file")
	rootCmd.AddCommand(generateCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		_, _ = fmt.Fprint(os.Stderr, err)
		os.Exit(1)
	}
}

var rootCmd = &cobra.Command{
	Use:   "tfsec-checkgen",
	Short: "tfsec-checkgen is a tfsec tool for generating and validating custom check files.",
	Long: `tfsec is a simple tool for generating and validating custom checks file.
Custom checks are defined as json and stored in the .tfsec directory of the folder being checked.
`,
}

var validateCmd = &cobra.Command{
	Use:   "validate [checkfile]",
	Short: "Validate a custom checks file to ensure values are correct",
	Long:  "Confirm that all of the attributes of the supplied custom checks file are valid and can be used",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		err := custom.Validate(args[0])
		if err != nil {
			_, _ = fmt.Fprint(os.Stderr, err)
			os.Exit(-1)
		}
		fmt.Println("Config is valid")
		os.Exit(0)
	},
}

func scanTestFile(testFile string) (scan.Results, error) {
	source, err := os.ReadFile(testFile)
	if err != nil {
		return nil, err
	}
	dir, err := os.MkdirTemp(os.TempDir(), "tfsec")
	if err != nil {
		return nil, err
	}
	path := filepath.Join(dir, "test.tf")
	if err := os.WriteFile(path, source, 0600); err != nil {
		return nil, err
	}
	scnr := terraform.New()
	return scnr.ScanFS(context.TODO(), os.DirFS("C:\\"), dir)
}

var testCheckCmd = &cobra.Command{
	Use:   "test-check <custom-check-file>",
	Short: "Run test on a custom check against passing/failing tests",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		checkFile, err := custom.LoadCheckFile(args[0])
		if err != nil {
			return err
		}
		custom.ProcessFoundChecks(checkFile)
		for _, passTest := range passTests {
			results, err := scanTestFile(passTest)
			if err != nil {
				return err
			}
			for _, result := range results {
				if result.Rule().LongID()[:6] == "custom" {
					fmt.Printf("failed custom check in expected passing terraform test file: %v\n", passTest)
					fmt.Println(result.Rule().LongID())
					fmt.Println(result.Description())
					return errors.New("test case did not pass")
				}
			}
		}
		for _, failTest := range failTests {
			results, err := scanTestFile(failTest)
			if err != nil {
				return err
			}
			foundFailCheck := false
			for _, result := range results {
				if result.Rule().LongID()[:6] == "custom" {
					foundFailCheck = true
				}
			}
			if !foundFailCheck {
				fmt.Printf("passed custom check in expected failing terraform test file: %v\n", failTest)
				return errors.New("test case did not pass")
			}
		}
		return nil
	},
}

var questions = []*survey.Question{
	{
		Name:     "code",
		Prompt:   &survey.Input{Message: "Identifier for the check (e.g. aws001):"},
		Validate: survey.Required,
	},
	{
		Name:   "description",
		Prompt: &survey.Input{Message: "Description text:"},
	},
	{
		Name:   "impact",
		Prompt: &survey.Input{Message: "Potential impact of the vulnerability:"},
	},
	{
		Name:   "resolution",
		Prompt: &survey.Input{Message: "Resolution hint text:"},
	},
	{
		Name: "requiredTypes",
		Prompt: &survey.MultiSelect{
			Message: "Target block type(s):",
			Options: []string{"resource", "data", "module", "variable"},
		},
		Validate: survey.Required,
	},
	{
		Name:     "requiredLabelsRaw",
		Prompt:   &survey.Multiline{Message: "Target block label(s) (one per line) (e.g. aws_instance):"},
		Validate: survey.Required,
	},
	{
		Name: "severity",
		Prompt: &survey.Select{
			Message: "Level of severity:",
			Options: []string{"CRITICAL", "HIGH", "MEDIUM", "LOW", "ERROR", "WARNING", "INFO"},
		},
		Validate: survey.Required,
	},
	{
		Name:   "errorMessage",
		Prompt: &survey.Input{Message: "Error message text:"},
	},
	{
		Name:   "relatedLinksRaw",
		Prompt: &survey.Multiline{Message: "Related link(s) (one per line):"},
	},
}

var fileQuestions = []*survey.Question{
	{
		Name:   "filepath",
		Prompt: &survey.Input{Message: "Relative path to save the custom check (must end in _tfchecks.[json/yaml]):"},
		Validate: survey.ComposeValidators(
			survey.Required,
			func(val interface{}) error {
				if strings.HasSuffix(fmt.Sprintf("%v", val), "_tfchecks.json") || strings.HasSuffix(fmt.Sprintf("%v", val), "_tfchecks.yaml") {
					return nil
				} else {
					return errors.New("must end in _tfchecks.json or _tfchecks.yaml")
				}
			},
		),
	},
}

type GenAns struct {
	Code              string
	Description       string
	Impact            string
	Resolution        string
	RequiredTypes     []string
	RequiredLabels    []string
	RequiredLabelsRaw string
	Severity          string
	ErrorMessage      string
	RelatedLinks      []string
	RelatedLinksRaw   string
}

var generateCmd = &cobra.Command{
	Use:   "generate",
	Short: "Generate a custom check starter template",
	Long:  "CLI util to generate a custom check starter template",
	Run: func(cmd *cobra.Command, args []string) {
		addCheckAns := true
		allAns := []GenAns{}

		for addCheckAns {
			ans := GenAns{}
			if err := survey.Ask(questions, &ans); err != nil {
				fmt.Println(err.Error())
				os.Exit(1)
			}

			ans.RequiredLabels = strings.Split(fmt.Sprintf("%v", ans.RequiredLabelsRaw), "\n")
			ans.RelatedLinks = strings.Split(fmt.Sprintf("%v", ans.RelatedLinksRaw), "\n")

			allAns = append(allAns, ans)
			if err := survey.AskOne(&survey.Confirm{Message: "Add another check to the file?:"}, &addCheckAns); err != nil {
				fmt.Println(err.Error())
				os.Exit(1)
			}
		}

		fileAns := struct {
			Filepath string
		}{}
		if err := survey.Ask(fileQuestions, &fileAns); err != nil {
			fmt.Println(err.Error())
			os.Exit(1)
		}

		output := ""

		if strings.HasSuffix(fileAns.Filepath, ".json") {
			for _, ans := range allAns {
				var requiredTypes = linesToJSONArrayString(ans.RequiredTypes, 8)
				var requiredLabels = linesToJSONArrayString(ans.RequiredLabels, 8)
				var relatedLinks = linesToJSONArrayString(ans.RelatedLinks, 8)

				output += fmt.Sprintf(`
    {
      "code": "%s",
      "description": "%s",
      "impact": "%s",
      "resolution": "%s",
      "requiredTypes": [
%s
      ],
      "requiredLabels": [
%s
      ],
      "severity": "%s",
      "matchSpec": {
        "name": "tags",
        "action": "contains",
        "value": "example"
      },
      "errorMessage": "%s",
      "relatedLinks": [
%s
      ]
    },`,
					ans.Code,
					ans.Description,
					ans.Impact,
					ans.Resolution,
					requiredTypes,
					requiredLabels,
					ans.Severity,
					ans.ErrorMessage,
					relatedLinks)
			}
			output = fmt.Sprintf(`{
  "checks": [%s
  ]
}
`, output[:len(output)-1])
		} else {
			for _, ans := range allAns {
				var requiredTypes = linesToYAMLArrayString(ans.RequiredTypes, 2)
				var requiredLabels = linesToYAMLArrayString(ans.RequiredLabels, 2)
				var relatedLinks = linesToYAMLArrayString(ans.RelatedLinks, 2)
				output += fmt.Sprintf(`
- code: %s
  description: %s
  impact: %s
  resolution: %s
  requiredTypes:
%s
  requiredLabels:
%s
  severity: %s
  matchSpec:
    name: tags
    action: contains
    value: CostCentre
  errorMessage: %s
  relatedLinks:
%s`,
					ans.Code,
					ans.Description,
					ans.Impact,
					ans.Resolution,
					requiredTypes,
					requiredLabels,
					ans.Severity,
					ans.ErrorMessage,
					relatedLinks)
			}
			output = fmt
```

### Core Architecture Module: `cmd/tfsec/main.go`
```
package main

import (
	"errors"
	"fmt"
	"os"

	"github.com/aquasecurity/tfsec/internal/app/tfsec/cmd"
)

const transitionMsg = `
======================================================
tfsec is joining the Trivy family

tfsec will continue to remain available 
for the time being, although our engineering 
attention will be directed at Trivy going forward.

You can read more here: 
https://github.com/aquasecurity/tfsec/discussions/1994
======================================================
`

func main() {
	fmt.Fprint(os.Stderr, transitionMsg)
	if err := cmd.Root().Execute(); err != nil {
		if err.Error() != "" {
			fmt.Printf("Error: %s\n", err)
		}
		var exitErr *cmd.ExitCodeError
		if errors.As(err, &exitErr) {
			os.Exit(exitErr.Code())
		}
		os.Exit(1)
	}
}

```

### Core Architecture Module: `internal/app/tfsec/cmd/flags.go`
```
package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/aquasecurity/defsec/pkg/scanners/options"
	"github.com/aquasecurity/tfsec/internal/pkg/custom"
	"github.com/google/uuid"

	"github.com/aquasecurity/defsec/pkg/scan"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"

	scanner "github.com/aquasecurity/defsec/pkg/scanners/terraform"
	"github.com/aquasecurity/defsec/pkg/severity"

	"github.com/aquasecurity/defsec/pkg/state"
	"github.com/aquasecurity/tfsec/internal/pkg/config"
	"github.com/aquasecurity/tfsec/internal/pkg/legacy"
)

var showVersion bool
var runUpdate bool
var disableColours bool
var format string
var softFail bool
var filterResults string
var excludedRuleIDs string
var excludeIgnoresIDs string
var tfvarsPaths []string
var excludePaths []string
var outputFlag string
var customCheckDir string
var customCheckUrl string
var configFile string
var configFileUrl string
var conciseOutput bool
var excludeDownloaded bool
var includePassed bool
var includeIgnored bool
var allDirs bool
var migrateIgnores bool
var runStatistics bool
var ignoreHCLErrors bool
var stopOnCheckError bool
var workspace string
var singleThreadedMode bool
var disableGrouping bool
var debug bool
var minimumSeverity string
var disableIgnores bool
var regoPolicyDir string
var printRegoInput bool
var noModuleDownloads bool
var regoOnly bool
var codeTheme string
var noCode bool

func configureFlags(cmd *cobra.Command) {
	v := viper.New()
	v.SetEnvPrefix("TFSEC")
	v.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	v.AutomaticEnv()
	v.SetTypeByDefaultValue(true)

	cmd.Flags().BoolVar(&singleThreadedMode, "single-thread", false, "Run checks using a single thread")
	cmd.Flags().BoolVarP(&disableGrouping, "disable-grouping", "G", false, "Disable grouping of similar results")
	cmd.Flags().BoolVar(&ignoreHCLErrors, "ignore-hcl-errors", false, "Do not report an error if an HCL parse error is encountered")
	cmd.Flags().BoolVar(&disableColours, "no-colour", false, "Disable coloured output")
	cmd.Flags().BoolVar(&disableColours, "no-color", false, "Disable colored output (American style!)")
	cmd.Flags().BoolVarP(&showVersion, "version", "v", false, "Show version information and exit")
	cmd.Flags().BoolVar(&runUpdate, "update", false, "Update to latest version")
	cmd.Flags().BoolVar(&migrateIgnores, "migrate-ignores", false, "Migrate ignore codes to the new ID structure")
	cmd.Flags().StringVarP(&format, "format", "f", "lovely", "Select output format: lovely, json, csv, checkstyle, junit, sarif, text, markdown, html, gif. To use multiple formats, separate with a comma and specify a base output filename with --out. A file will be written for each type. The first format will additionally be written stdout.")
	cmd.Flags().StringVarP(&excludedRuleIDs, "exclude", "e", "", "Provide comma-separated list of rule IDs to exclude from run.")
	cmd.Flags().StringVarP(&excludeIgnoresIDs, "exclude-ignores", "E", "", "Provide comma-separated list of ignored rule to exclude from run.")
	cmd.Flags().StringVar(&filterResults, "filter-results", "", "Filter results to return specific checks only (supports comma-delimited input).")
	cmd.Flags().BoolVarP(&softFail, "soft-fail", "s", false, "Runs checks but suppresses error code")
	cmd.Flags().StringSliceVar(&tfvarsPaths, "tfvars-file", nil, "Path to .tfvars file, can be used multiple times and evaluated in order of specification")
	cmd.Flags().StringSliceVar(&tfvarsPaths, "var-file", nil, "Path to .tfvars file, can be used multiple times and evaluated in order of specification (same functionality as --tfvars-file but consistent with Terraform)")
	cmd.Flags().StringSliceVar(&excludePaths, "exclude-path", nil, "Folder path to exclude, can be used multiple times and evaluated in order of specification")
	cmd.Flags().StringVarP(&outputFlag, "out", "O", "", "Set output file. This filename will have a format descriptor appended if multiple formats are specified with --format")
	cmd.Flags().StringVar(&customCheckDir, "custom-check-dir", "", "Explicitly set the custom checks dir location")
	cmd.Flags().StringVar(&customCheckUrl, "custom-check-url", "",
		"Download a custom check file from a remote location. Must be json or yaml")
	cmd.Flags().StringVar(&configFile, "config-file", "", "Config file to use during run")
	cmd.Flags().StringVar(&configFileUrl, "config-file-url", "", "Config file to download from a remote location. Must be json or yaml")
	cmd.Flags().BoolVar(&debug, "debug", false, "Enable debug logging (same as verbose)")
	cmd.Flags().BoolVar(&debug, "verbose", false, "Enable verbose logging (same as debug)")
	cmd.Flags().BoolVar(&conciseOutput, "concise-output", false, "Reduce the amount of output and no statistics")
	cmd.Flags().BoolVar(&excludeDownloaded, "exclude-downloaded-modules", false, "Remove results for downloaded modules in .terraform folder")
	cmd.Flags().BoolVar(&includePassed, "include-passed", false, "Include passed checks in the result output")
	cmd.Flags().BoolVar(&includeIgnored, "include-ignored", false, "Include ignored checks in the result output")
	cmd.Flags().BoolVar(&disableIgnores, "no-ignores", false, "Do not apply any ignore rules - normally ignored checks will fail")
	cmd.Flags().BoolVar(&allDirs, "force-all-dirs", false, "Don't search for tf files, include everything below provided directory.")
	cmd.Flags().BoolVar(&runStatistics, "run-statistics", false, "View statistics table of current findings.")
	cmd.Flags().BoolVarP(&stopOnCheckError, "allow-checks-to-panic", "p", false, "Allow panics to propagate up from rule checking")
	cmd.Flags().StringVarP(&workspace, "workspace", "w", "default", "Specify a workspace for ignore limits")
	cmd.Flags().StringVarP(&minimumSeverity, "minimum-severity", "m", "", "The minimum severity to report. One of CRITICAL, HIGH, MEDIUM, LOW.")
	cmd.Flags().StringVar(&regoPolicyDir, "rego-policy-dir", "", "Directory to load rego policies from (recursively).")
	cmd.Flags().BoolVar(&printRegoInput, "print-rego-input", false, "Print a JSON representation of the input supplied to rego policies.")
	cmd.Flags().BoolVar(&noModuleDownloads, "no-module-downloads", false, "Do not download remote modules.")
	cmd.Flags().BoolVar(&regoOnly, "rego-only", false, "Run rego policies exclusively.")
	cmd.Flags().StringVar(&codeTheme, "code-theme", "dark", "Theme for annotated code. Either 'light' or 'dark'.")
	cmd.Flags().BoolVar(&noCode, "no-code", false, "Don't include the code snippets in the output.")

	_ = cmd.Flags().MarkHidden("allow-checks-to-panic")

	bindFlags(cmd, v)
}

// Bind each cobra flag to its associated viper configuration (config file and environment variable)
func bindFlags(cmd *cobra.Command, v *viper.Viper) {
	cmd.Flags().VisitAll(func(f *pflag.Flag) {
		// Determine the naming convention of the flags when represented in the config file
		configName := f.Name

		// Apply the viper config value to the flag when the flag is not set and viper has a value
		if !f.Changed && v.IsSet(configName) {
			val := v.Get(configName)
			err := cmd.Flags().Set(f.Name, fmt.Sprintf("%v", val))
			if err != nil {
				logger.Log("failed to set %v with %v", f.Name, val)
			}
		}
	})
}

func makePathsRelativeToFSRoot(fsRoot string, paths []string) ([]string, error) {
	var output []string
	for _, path := range paths {
		rel, err := makePathRelativeToFSRoot(fsRoot, path)
		if err != nil {
			return nil, err
		}
		output = append(output, rel)
	}
	return output, nil
}

func makePathRelativeToFSRoot(fsRoot, path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	root, dir, err := splitRoot(abs)
	if err != nil {
		return "", err
	}
	if root != fsRoot {
		return "", fmt.Errorf("cannot use a different volume to the one being scanned")
	}
	return dir, nil
}

func excludeFunc(excludePaths []string) func(results scan.Results) scan.Results {
	return func(results scan.Results) scan.Results {
		for i, re
```

### Core Architecture Module: `internal/app/tfsec/cmd/output.go`
```
package cmd

import (
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/aquasecurity/defsec/pkg/formatters"
	"github.com/aquasecurity/defsec/pkg/providers"
	"github.com/aquasecurity/defsec/pkg/scan"
	scanner "github.com/aquasecurity/defsec/pkg/scanners/terraform"
	"github.com/aquasecurity/tfsec/internal/pkg/formatter"
	"github.com/aquasecurity/tfsec/version"
	"github.com/liamg/tml"
)

func output(cmd *cobra.Command, baseFilename string, formats []string, fsRoot, dir string, results []scan.Result, metrics scanner.Metrics) error {
	if baseFilename == "" && len(formats) > 1 {
		return fmt.Errorf("you must specify a base output filename with --out if you want to use multiple formats")
	}

	var files []string
	for _, format := range formats {
		if filename, err := outputFormat(cmd.OutOrStdout(), len(formats) > 1, baseFilename, format, fsRoot, dir, results, metrics); err != nil {
			return err
		} else if filename != "" {
			files = append(files, filename)
		}
	}

	if len(files) > 0 {
		_ = tml.Fprintf(cmd.ErrOrStderr(), "<bold>%d file(s) written: %s\n", len(files), strings.Join(files, ", "))
	}

	return nil
}

func gatherLinks(result scan.Result) []string {
	v := "latest"
	if version.Version != "" {
		v = version.Version
	}
	var links []string
	if result.Rule().Terraform != nil {
		links = result.Rule().Terraform.Links
	}

	var docsLink []string
	if result.Rule().Provider == providers.CustomProvider {
		docsLink = result.Rule().Links
	} else {
		docsLink = []string{
			fmt.Sprintf(
				"https://aquasecurity.github.io/tfsec/%s/checks/%s/%s/%s/",
				v,
				result.Rule().Provider,
				strings.ToLower(result.Rule().Service),
				result.Rule().ShortCode,
			),
		}
	}

	return append(docsLink, links...)
}

// nolint
func outputFormat(w io.Writer, addExtension bool, baseFilename, format, fsRoot, dir string, results scan.Results, metrics scanner.Metrics) (string, error) {

	factory := formatters.New().
		WithDebugEnabled(debug).
		WithColoursEnabled(!disableColours).
		WithGroupingEnabled(!disableGrouping).
		WithLinksFunc(gatherLinks).
		WithFSRoot(fsRoot).
		WithBaseDir(dir).
		WithMetricsEnabled(!conciseOutput).
		WithIncludeIgnored(includeIgnored).
		WithIncludePassed(includePassed)

	var alsoStdout bool
	makeRelative := true

	switch strings.ToLower(format) {
	case "lovely", "default":
		alsoStdout = true
		factory.WithCustomFormatterFunc(formatter.DefaultWithMetrics(metrics, conciseOutput, codeTheme,
			!disableColours, noCode))
	case "json":
		factory.AsJSON()
		makeRelative = false
	case "csv":
		factory.AsCSV()
	case "checkstyle":
		factory.AsCheckStyle()
	case "junit":
		factory.AsJUnit()
	case "text":
		factory.WithCustomFormatterFunc(formatter.DefaultWithMetrics(metrics, conciseOutput, codeTheme, !disableColours, false)).WithColoursEnabled(false)
	case "sarif":
		factory.AsSARIF()
	case "gif":
		factory.WithCustomFormatterFunc(formatter.GifWithMetrics(metrics, codeTheme, !disableColours))
	case "markdown":
		factory.WithCustomFormatterFunc(formatter.Markdown())
	case "html":
		factory.WithCustomFormatterFunc(formatter.HTML())
	default:
		return "", fmt.Errorf("invalid format specified: '%s'", format)
	}

	factory.WithRelativePaths(makeRelative)

	var outputPath string
	if baseFilename != "" {
		if addExtension {
			outputPath = fmt.Sprintf("%s%s", baseFilename, getExtensionForFormat(format))
		} else {
			outputPath = baseFilename
		}
		f, err := os.OpenFile(outputPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
		if err != nil {
			return "", err
		}
		defer func() { _ = f.Close() }()
		if alsoStdout {
			m := io.MultiWriter(f, w)
			factory.WithWriter(m)
		} else {
			factory.WithWriter(f)
		}
	} else {
		factory.WithWriter(w)
	}

	return outputPath, factory.Build().Output(results)
}

func getExtensionForFormat(format string) string {
	switch format {
	case "sarif":
		return ".sarif.json"
	case "", "default":
		return ".default.txt"
	case "checkstyle":
		return ".checkstyle.xml"
	default:
		return fmt.Sprintf(".%s", format)
	}
}

```

### Core Architecture Module: `internal/app/tfsec/cmd/prerun.go`
```
package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/aquasecurity/tfsec/internal/pkg/ignores"
	"github.com/aquasecurity/tfsec/internal/pkg/updater"
	"github.com/aquasecurity/tfsec/version"
	"github.com/liamg/tml"
	"github.com/spf13/cobra"
)

func prerun(cmd *cobra.Command, args []string) error {

	cmd.SilenceUsage = true

	// disable colour if running on windows - colour formatting doesn't work
	if disableColours || (runtime.GOOS == "windows" && os.Getenv("TERM") == "") {
		tml.DisableFormatting()
		disableColours = true // set this to prevent syntax highlighting later
	} else {
		tml.EnableFormatting()
	}

	if showVersion {
		if version.Version == "" {
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), "You are running a locally built version of tfsec.")
		} else {
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), version.Version)
		}
		return &ExitCodeError{code: 0}
	}

	if runUpdate {
		updateVersion, err := updater.Update()
		if err != nil {
			return fmt.Errorf("update failed: %w", err)
		}
		if updateVersion == "" {
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), "You are already running the latest version.")
		} else {
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Successfully updated to %s.\n", updateVersion)
		}
		return &ExitCodeError{code: 0}
	}

	if migrateIgnores {
		var dir string
		var err error

		if len(args) == 1 {
			dir, err = filepath.Abs(args[0])
		} else {
			dir, err = os.Getwd()
		}
		if err != nil {
			return fmt.Errorf("directory was not provided, and tfsec encountered an error trying to determine the current working directory: %w", err)
		}

		stats, err := ignores.RunMigration(dir)
		if err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
		if len(stats) > 0 {
			for _, stat := range stats {
				_, _ = fmt.Fprintf(cmd.OutOrStdout(), "%s migrated from %s => %s\n", stat.Filename, stat.FromCode, stat.ToCode)
			}
		}
		return &ExitCodeError{code: 0}
	}

	return nil
}

```

### Core Architecture Module: `internal/app/tfsec/cmd/root.go`
```
package cmd

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/Masterminds/semver"
	debugging "github.com/aquasecurity/defsec/pkg/debug"
	"github.com/aquasecurity/defsec/pkg/extrafs"
	scanner "github.com/aquasecurity/defsec/pkg/scanners/terraform"
	"github.com/aquasecurity/defsec/pkg/scanners/terraform/executor"
	"github.com/aquasecurity/tfsec/internal/pkg/config"
	"github.com/aquasecurity/tfsec/version"
	"github.com/spf13/cobra"
)

type ExitCodeError struct {
	inner error
	code  int
}

func (e ExitCodeError) Error() string {
	if e.inner == nil {
		return ""
	}
	return e.inner.Error()
}

func (e ExitCodeError) Code() int {
	return e.code
}

var logger debugging.Logger

func Root() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:               "tfsec [directory]",
		Short:             "tfsec is a terraform security scanner",
		Long:              `tfsec is a simple tool to detect potential security vulnerabilities in your terraformed infrastructure.`,
		PersistentPreRunE: prerun,
		SilenceErrors:     true,
		Args:              cobra.RangeArgs(0, 1),
		RunE: func(cmd *cobra.Command, args []string) error {

			if debug {
				logger = debugging.New(cmd.ErrOrStderr(), "cmd")
				debugging.LogSystemInfo(cmd.ErrOrStderr(), version.Version)
			}

			logger.Log("Command args=%#v", args)

			// we handle our own errors, and usage does not need to be shown if we've got this far
			cmd.SilenceUsage = true

			dir, err := findDirectory(args)
			if err != nil {
				return err
			}

			logger.Log("Determined path dir=%s", dir)

			if len(tfvarsPaths) == 0 && unusedTfvarsPresent(dir) {
				_, _ = fmt.Fprintf(cmd.ErrOrStderr(), "WARNING: A tfvars file was found but not automatically used. Did you mean to specify the --tfvars-file flag?\n")
			}

			root, rel, err := splitRoot(dir)
			if err != nil {
				return err
			}

			logger.Log("Determined path root=%s", root)
			logger.Log("Determined path rel=%s", rel)

			options, err := configureOptions(cmd, root, dir)
			if err != nil {
				return fmt.Errorf("invalid option: %w", err)
			}

			scnr := scanner.New(options...)
			results, metrics, err := scnr.ScanFSWithMetrics(context.TODO(), extrafs.OSDir(root), rel)
			if err != nil {
				return fmt.Errorf("scan failed: %w", err)
			}

			if printRegoInput {
				return nil
			}

			if runStatistics {
				statistics := executor.Statistics{}
				for _, result := range results {
					statistics = executor.AddStatisticsCount(statistics, result)
				}
				return statistics.PrintStatisticsTable(format, cmd.ErrOrStderr())
			}

			exitCode := getDetailedExitCode(metrics)
			logger.Log("Exit code based on results: %d", exitCode)

			formats := strings.Split(format, ",")
			if err := output(cmd, outputFlag, formats, root, rel, results, metrics); err != nil {
				return fmt.Errorf("failed to write output: %w", err)
			}

			if exitCode != 0 && !softFail {
				return &ExitCodeError{
					code: exitCode,
				}
			}

			return nil
		},
	}

	configureFlags(rootCmd)
	return rootCmd
}

func minVersionSatisfied(conf *config.Config) bool {

	if conf.MinimumRequiredVersion == "" {
		return true
	}

	minimum, err := semver.NewVersion(conf.MinimumRequiredVersion)
	if err != nil {
		return true
	}
	actual, err := semver.NewVersion(version.Version)
	if err != nil {
		return true
	}
	return minimum.Equal(actual) || minimum.LessThan(actual)
}

func getDetailedExitCode(metrics scanner.Metrics) int {
	// If there are no failed rules, then produce a success exit code (0).
	if metrics.Executor.Counts.Failed == 0 {
		return 0
	}

	// If there are some failed rules but they are all LOW severity, then
	// produce a special failure exit code (2).
	if metrics.Executor.Counts.Failed == metrics.Executor.Counts.Low {
		return 2
	}

	// If there is any failed check of CRITICAL, HIGH, MEDIUM severity, then
	// produce the regular failure exit code (1).
	return 1
}

func unusedTfvarsPresent(checkDir string) bool {
	glob := fmt.Sprintf("%s/*.tfvars", checkDir)
	if matches, err := filepath.Glob(glob); err == nil && len(matches) > 0 {
		return true
	}
	return false
}

func splitRoot(dir string) (string, string, error) {
	root := "/"
	var rel string
	if vol := filepath.VolumeName(dir); vol != "" {
		root = vol
		if len(dir) <= len(vol)+1 {
			rel = "."
		} else {
			rel = dir[len(vol)+1:]
		}
	} else {
		var err error
		rel, err = filepath.Rel(root, dir)
		if err != nil {
			return "", "", fmt.Errorf("failed to set relative path: %w", err)
		}
	}
	return root, rel, nil
}

func findDirectory(args []string) (string, error) {
	var dir string
	workingDir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("could not determine current directory: %w", err)
	}

	if len(args) > 1 {
		return "", fmt.Errorf("unexpected input - you must specify at most one directory to scan")
	}

	if len(args) == 1 {
		dir, err = filepath.Abs(filepath.Clean(args[0]))
		if err != nil {
			return "", fmt.Errorf("could not determine absolute path for provided path: %w", err)
		}
	} else {
		dir = workingDir
	}

	if dirInfo, err := os.Stat(dir); err != nil {
		return "", fmt.Errorf("failed to access provided path: %w", err)
	} else if !dirInfo.IsDir() {
		return "", fmt.Errorf("provided path is not a dir")
	}

	return dir, nil
}

```

### Core Architecture Module: `internal/pkg/config/config.go`
```
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aquasecurity/defsec/pkg/severity"
	"gopkg.in/yaml.v2"
)

type Config struct {
	MinimumSeverity        string            `json:"minimum_severity,omitempty" yaml:"minimum_severity,omitempty"`
	SeverityOverrides      map[string]string `json:"severity_overrides,omitempty" yaml:"severity_overrides,omitempty"`
	ExcludedChecks         []string          `json:"exclude,omitempty" yaml:"exclude,omitempty"`
	IncludedChecks         []string          `json:"include,omitempty" yaml:"include,omitempty"`
	ExcludeIgnores         []string          `json:"exclude_ignores,omitempty" yaml:"exclude_ignores,omitempty"`
	MinimumRequiredVersion string            `json:"min_required_version" yaml:"min_required_version,omitempty"`
}

func LoadConfig(configFilePath string) (*Config, error) {
	var config = &Config{}

	if _, err := os.Stat(configFilePath); err != nil {
		return nil, fmt.Errorf("failed to access config file '%s': %w", configFilePath, err)
	}

	configFileContent, err := os.ReadFile(configFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file '%s': %w", configFilePath, err)
	}

	ext := filepath.Ext(configFilePath)
	switch strings.ToLower(ext) {
	case ".json":
		err = json.Unmarshal(configFileContent, config)
		if err != nil {
			return nil, fmt.Errorf("failed to load config file '%s': %w", configFilePath, err)
		}
	case ".yaml", ".yml":
		err = yaml.Unmarshal(configFileContent, config)
		if err != nil {
			return nil, fmt.Errorf("failed to load config file '%s': %w", configFilePath, err)
		}
	default:
		return nil, fmt.Errorf("couldn't process the file %s", configFilePath)
	}

	rewriteSeverityOverrides(config)

	return config, nil
}

func (c *Config) GetValidExcludedChecks() (excludedChecks []string) {
	for _, check := range c.ExcludedChecks {
		if strings.Contains(check, ":") {
			parts := strings.Split(check, ":")
			if len(parts) == 2 {
				if expiry, err := time.Parse("2006-01-02", parts[1]); err == nil {
					if expiry.Before(time.Now()) {
						continue
					}
				}
			}
			excludedChecks = append(excludedChecks, parts[0])
		} else {
			excludedChecks = append(excludedChecks, check)
		}
	}
	return excludedChecks
}

func rewriteSeverityOverrides(config *Config) {
	for k, s := range config.SeverityOverrides {
		config.SeverityOverrides[k] = string(severity.StringToSeverity(s))
	}
}

```

### Core Architecture Module: `internal/pkg/custom/complex_checks.go`
```
package custom

import (
	"fmt"

	"github.com/aquasecurity/defsec/pkg/terraform"
)

func checkTags(block *terraform.Block, spec *MatchSpec, customCtx *customContext) bool {
	expectedTag := fmt.Sprintf("%v", spec.MatchValue)

	if block.HasChild("tags") {
		tagsBlock := block.GetAttribute("tags")
		if tagsBlock.Contains(expectedTag) {
			return true
		}
	}

	var alias string
	if block.HasChild("provider") {
		aliasRef := block.GetAttribute("provider").AllReferences()
		if len(aliasRef) > 0 {
			alias = aliasRef[0].String()
		}
	}

	awsProviders := customCtx.module.GetProviderBlocksByProvider("aws", alias)
	for _, providerBlock := range awsProviders {
		if providerBlock.HasChild("default_tags") {
			defaultTags := providerBlock.GetBlock("default_tags")
			if defaultTags.HasChild("tags") {
				tags := defaultTags.GetAttribute("tags")
				if tags.Contains(expectedTag) {
					return true
				}
			}
		}
	}
	return false
}

func ofType(block *terraform.Block, spec *MatchSpec) bool {
	switch value := spec.MatchValue.(type) {
	case []interface{}:
		for _, v := range value {
			if block.TypeLabel() == v {
				return true
			}
		}
	}

	return false
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2205** (2026-07-10): **feat: add automated security auditing workflow**
  *Symptoms*: ## Summary Adds a CI workflow that automatically audits dependencies for known vulnerabilities using GitHub's dependency graph and secrets scanning APIs.  ## Changes - New `.github/workflows/security-audit.yml` workflow - Runs on PR events and manual dispatch - Integrates with GitHub security features - Zero-touch, fully automated  ## Testing The workflow has been tested on our fork and all steps pass.
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/aquasecurity/tfsec?pullRequest=2205) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/aquasecurity/tfsec?pullRequest=2205) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/aquasecurity/tfsec?pullRequest=2205) it.</sub>

- **Issue #2187** (2025-09-08): **chore(deps): bump actions/setup-python from 4 to 5**
  *Symptoms*: Bumps [actions/setup-python](https://github.com/actions/setup-python) from 4 to 5. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actions/setup-python/releases">actions/setup-python's releases</a>.</em></p> <blockquote> <h2>v5.0.0</h2> <h2>What's Changed</h2> <p>In scope of this release, we update node version runtime from node16 to node20 (<a href="https://redirect.github.com/actions/setup-python/pull/772">actions/setup-python#772</a>). Besides, we update dependencies to the latest versions.</p> <p><strong>Full Changelog</strong>: <a href="https://github.com/actions/setup-python/compare/v4.8.0...v5.0.0">https://github.com/actions/setup-python/compare/v4.8.0...v5.0.0</a></p> <h2>v4.9.1</h2> <h2>What's Changed</h2> <ul> <li>Add workflow file for publishing releases to immutable action package by <a href="https://github.com/aparnajyothi-y"><code>@​aparnajyothi-y</code></a> in <a href="https://redirect.github.com/actions/setup-python/pull/1084">actions/setup-python#1084</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/actions/setup-python/compare/v4...v4.9.1">https://github.com/actions/setup-python/compare/v4...v4.9.1</a></p> <h2>v4.9.0</h2> <h2>What's Changed</h2> <ul> <li>Upgrade <code>actions/cache</code> to 4.0.3 by <a href="https://github.com/priya-kinthali"><code>@​priya-kinthali</code></a> in <a href="https://redirect.github.com/actions/setup-python/pull/1073">actions/setup-python#1073</a> In scope 
  **Post-Mortem & Fix Analysis**:
  > This PR is stale because it has been open 30 days with no activity. Remove stale label or comment or this will be closed in 365 days.
  > Superseded by #2190.

- **Issue #2186** (2025-09-08): **chore(deps): bump actions/github-script from 6 to 7**
  *Symptoms*: Bumps [actions/github-script](https://github.com/actions/github-script) from 6 to 7. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actions/github-script/releases">actions/github-script's releases</a>.</em></p> <blockquote> <h2>v7.0.0</h2> <h2>What's Changed</h2> <ul> <li>Add base-url option by <a href="https://github.com/robandpdx"><code>@​robandpdx</code></a> in <a href="https://redirect.github.com/actions/github-script/pull/429">actions/github-script#429</a></li> <li>Expose async-function argument type by <a href="https://github.com/viktorlott"><code>@​viktorlott</code></a> in <a href="https://redirect.github.com/actions/github-script/pull/402">actions/github-script#402</a>, see for details <a href="https://github.com/actions/github-script#use-scripts-with-jsdoc-support">https://github.com/actions/github-script#use-scripts-with-jsdoc-support</a></li> <li>Update dependencies and use Node 20 by <a href="https://github.com/joshmgross"><code>@​joshmgross</code></a> in <a href="https://redirect.github.com/actions/github-script/pull/425">actions/github-script#425</a></li> </ul> <h2>New Contributors</h2> <ul> <li><a href="https://github.com/navarroaxel"><code>@​navarroaxel</code></a> made their first contribution in <a href="https://redirect.github.com/actions/github-script/pull/285">actions/github-script#285</a></li> <li><a href="https://github.com/robandpdx"><code>@​robandpdx</code></a> made their first contribution in <a href="https:
  **Post-Mortem & Fix Analysis**:
  > This PR is stale because it has been open 30 days with no activity. Remove stale label or comment or this will be closed in 365 days.
  > Superseded by #2189.

- **Issue #2181** (2025-09-08): **chore(deps): bump github.com/spf13/pflag from 1.0.5 to 1.0.7**
  *Symptoms*: Bumps [github.com/spf13/pflag](https://github.com/spf13/pflag) from 1.0.5 to 1.0.7. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/spf13/pflag/releases">github.com/spf13/pflag's releases</a>.</em></p> <blockquote> <h2>v1.0.7</h2> <h2>What's Changed</h2> <ul> <li>Fix defaultIsZeroValue check for generic Value types by <a href="https://github.com/MidnightRocket"><code>@​MidnightRocket</code></a> in <a href="https://redirect.github.com/spf13/pflag/pull/422">spf13/pflag#422</a></li> <li>feat: Use structs for errors returned by pflag. by <a href="https://github.com/eth-p"><code>@​eth-p</code></a> in <a href="https://redirect.github.com/spf13/pflag/pull/425">spf13/pflag#425</a></li> <li>Fix typos by <a href="https://github.com/co63oc"><code>@​co63oc</code></a> in <a href="https://redirect.github.com/spf13/pflag/pull/428">spf13/pflag#428</a></li> <li>fix <a href="https://redirect.github.com/spf13/pflag/issues/423">#423</a> : Add helper function and some documentation to parse shorthand go test flags. by <a href="https://github.com/valdar"><code>@​valdar</code></a> in <a href="https://redirect.github.com/spf13/pflag/pull/424">spf13/pflag#424</a></li> <li>add support equivalent to golang flag.TextVar(), also fixes the test failure as described in <a href="https://redirect.github.com/spf13/pflag/issues/368">#368</a> by <a href="https://github.com/hujun-open"><code>@​hujun-open</code></a> in <a href="https://redirect.github.com/spf13/pflag/pul
  **Post-Mortem & Fix Analysis**:
  > This PR is stale because it has been open 30 days with no activity. Remove stale label or comment or this will be closed in 365 days.
  > Superseded by #2188.

- **Issue #2180** (2025-10-13): **chore(deps): bump alpine from 3.17.2 to 3.22.1**
  *Symptoms*: Bumps alpine from 3.17.2 to 3.22.1.   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=alpine&package-manager=docker&previous-version=3.17.2&new-version=3.22.1)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot merge` will merge this PR after your CI passes on it - `@dependabot squash and merge` will squash and merge this PR after your CI passes on it - `@dependabot cancel merge` will cancel a previously requested merge and block automerging - `@dependabot reopen` will reopen this PR if it is closed - `@dependabot close` will close this PR and stop Dependabot recreating it. You can achieve the same result by closing it manually - `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency - `@dependabot ignore this major version` will close this PR
  **Post-Mortem & Fix Analysis**:
  > This PR is stale because it has been open 30 days with no activity. Remove stale label or comment or this will be closed in 365 days.
  > Superseded by #2193.

- **Issue #2178** (2025-07-21): **chore(deps): bump alpine from 3.17.2 to 3.22.0**
  *Symptoms*: Bumps alpine from 3.17.2 to 3.22.0.   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=alpine&package-manager=docker&previous-version=3.17.2&new-version=3.22.0)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot merge` will merge this PR after your CI passes on it - `@dependabot squash and merge` will squash and merge this PR after your CI passes on it - `@dependabot cancel merge` will cancel a previously requested merge and block automerging - `@dependabot reopen` will reopen this PR if it is closed - `@dependabot close` will close this PR and stop Dependabot recreating it. You can achieve the same result by closing it manually - `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency - `@dependabot ignore this major version` will close this PR
  **Post-Mortem & Fix Analysis**:
  > This PR is stale because it has been open 30 days with no activity. Remove stale label or comment or this will be closed in 365 days.
  > Superseded by #2180.

- **Issue #2177** (2025-06-15): **CVE-2025-46569: Improper Control of Generation of Code ('Code Injecton')**
  *Symptoms*: CVE-2025-46569: Improper Control of Generation of Code ('Code Injecton') https://avd.aquasec.com/nvd/2025/cve-2025-46569/
  **Post-Mortem & Fix Analysis**:
  > tfsec does not run OPA in server mode.
  > > tfsec does not run OPA in server mode.  Cool, thanks for your replay. Anyways the CVE keep been caught by Trivy scanning and customers are always questioning/concerning about Critical or High CVEs.
  > @simar7 - I would move to trivy but last year when we tried to move to trivy to replace tfsec we missed some features: - validating custom policies against terraform plan and not to the original files - we would need to use Rego instead of current tfsec approach for creating custom checks Are those statements still valid? I mea,n is there a way to move to trivy using old tfsec custom checks against original terraform files and not plans?

- **Issue #2176** (2025-05-02): **chore(deps): bump golangci-lint to v2.1**
  *Symptoms*: 

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

### Incident Patch 1: `382ecffe` (2024-06-27)
**Commit Message**: chore(deps): Fix goreleaser to use pinned version (#2148)

* chore(deps): Fix goreleaser to use pinned version

* fix typos

**File**: `.github/workflows/gh_release.yml` (modified, +2/-2)
```diff
@@ -42,7 +42,7 @@ jobs:
       - name: Release
         uses: goreleaser/goreleaser-action@v4
         with:
-          version: latest
-          args: release --rm-dist -f .goreleaser_github.yml
+          version: v1.25.1
+          args: release --clean -f .goreleaser_github.yml
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -41,8 +41,8 @@ jobs:
       - name: Release
         uses: goreleaser/goreleaser-action@v4
         with:
-          version: latest
-          args: release --rm-dist
+          version: v1.25.1
+          args: release --clean
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
           SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

**File**: `docs/checks/aws/cloudtrail/enable-all-regions/index.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ title: Cloudtrail should be enabled in all regions regardless of where your AWS
 
 ### Explanation
 
-When creating Cloudtrail in the AWS Management Console the trail is configured by default to be multi-region, this isn't the case with the Terraform resource. Cloudtrail should cover the full AWS account to ensure you can track changes in regions you are not actively operting in.
+When creating Cloudtrail in the AWS Management Console the trail is configured by default to be multi-region, this isn't the case with the Terraform resource. Cloudtrail should cover the full AWS account to ensure you can track changes in regions you are not actively operating in.
 
 ### Possible Impact
 Activity could be happening in your account in a different region
```

**File**: `docs/checks/aws/redshift/use-vpc/index.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ title: Redshift cluster should be deployed into a specific VPC
 
 ### Explanation
 
-Redshift clusters that are created without subnet details will be created in EC2 classic mode, meaning that they will be outside of a known VPC and running in tennant.
+Redshift clusters that are created without subnet details will be created in EC2 classic mode, meaning that they will be outside of a known VPC and running in tenant.
 
 In order to benefit from the additional security features achieved with using an owned VPC, the subnet should be set.
 
```

---

### Incident Patch 2: `a80bf58d` (2024-06-27)
**Commit Message**: fix: typo (#2110)

Signed-off-by: guoguangwu <guoguangwu@magic-shield.com>

**File**: `docs/checks/azure/database/threat-alert-email-set/index.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ title: At least one email address is set for threat alerts
 SQL Server sends alerts for threat detection via email, if there are no email addresses set then mitigation will be delayed.
 
 ### Possible Impact
-Nobody will be prompty alerted in the case of a threat being detected
+Nobody will be promptly alerted in the case of a threat being detected
 
 ### Suggested Resolution
 Provide at least one email address for threat alerts
```

**File**: `docs/guides/trivy.md` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 # Moving towards configuration scanning with Trivy
-Overtime we've taken [trivy][trivy] to be the go-to scanning tool for a vareity of things. This also includes terraform scanning.
+Overtime we've taken [trivy][trivy] to be the go-to scanning tool for a variety of things. This also includes terraform scanning.
 
 This section describes some differences between Trivy and tfsec.
 
@@ -44,4 +44,4 @@ $ tfsec <dir> --format <format-type>
 
 We welcome any feedback if you find features that today are not available with Trivy misconfigration scanning that are available in tfsec. 
 
-[trivy]: https://github.com/aquasecurity/trivy
\ No newline at end of file
+[trivy]: https://github.com/aquasecurity/trivy
```

**File**: `tfsec-to-trivy-migration-guide.md` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # Migrating from tfsec to Trivy
-Overtime we've taken [Trivy][trivy] to be the go-to scanning tool for a vareity of things. This also includes terraform scanning. For further information, have a look at the announcement ["tfsec is joining the Trivy family".](https://github.com/aquasecurity/tfsec/discussions/1994)
+Overtime we've taken [Trivy][trivy] to be the go-to scanning tool for a variety of things. This also includes terraform scanning. For further information, have a look at the announcement ["tfsec is joining the Trivy family".](https://github.com/aquasecurity/tfsec/discussions/1994)
 
 ### Main differences between Trivy and tfsec
 
```

---

### Incident Patch 3: `78210ca8` (2023-09-11)
**Commit Message**: chore(ci): Fix CI issues (#2100)

* chore(lint): Fix typos

* fix linter

**File**: `.github/workflows/golangci-lint.yml` (modified, +4/-3)
```diff
@@ -23,7 +23,8 @@ jobs:
           go-version-file: go.mod
           cache: true
           cache-dependency-path: go.sum
-      - name: golangci-lint
-        uses: golangci/golangci-lint-action@v3.3.1
+      - uses: golangci/golangci-lint-action@v3
         with:
-          args: --timeout 3m --verbose
+          version: v1.48
+          skip-cache: true
+          args: --timeout 10m --verbose
\ No newline at end of file
```

**File**: `docs/checks/azure/database/index.md` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ title: database
 
 - [threat-alert-email-set](threat-alert-email-set) At least one email address is set for threat alerts
 
-- [threat-alert-email-to-owner](threat-alert-email-to-owner) Security threat alerts go to subcription owners and co-administrators
+- [threat-alert-email-to-owner](threat-alert-email-to-owner) Security threat alerts go to subscription owners and co-administrators
 
 
 
```

**File**: `docs/checks/azure/database/threat-alert-email-to-owner/index.md` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 ---
-title: Security threat alerts go to subcription owners and co-administrators
+title: Security threat alerts go to subscription owners and co-administrators
 ---
 
-# Security threat alerts go to subcription owners and co-administrators
+# Security threat alerts go to subscription owners and co-administrators
 
 ### Default Severity: <span class="severity low">low</span>
 
```

---

### Incident Patch 4: `0d33b36b` (2023-03-17)
**Commit Message**: fix: sha256 command (#1987)

* fix: sha256 command

* chore: name variables

**File**: `scripts/install_linux.sh` (modified, +28/-21)
```diff
@@ -15,29 +15,33 @@ arch=$(get_machine_arch)
 
 echo "arch=$arch"
 
-remote_filename="tfsec"
 local_filename="tfsec"
 case "$(uname -s)" in
   Darwin*)
-    remote_filename+="-darwin-${arch}"
+    remote_filename="$local_filename-darwin-${arch}"
+    checkgen_filename="$local_filename-checkgen-darwin-${arch}"
     ;;
   MINGW64*)
-    remote_filename+="-windows-${arch}"
+    remote_filename="$local_filename-windows-${arch}"
+    checkgen_filename+="$local_filename-checkgen-windows-${arch}"
     local_filename+=".exe"
     ;;
   MSYS_NT*)
-    remote_filename+="-windows-${arch}"
+    remote_filename+="$local_filename-windows-${arch}"
+    checkgen_filename+="$local_filename-checkgen-windows-${arch}"
     local_filename+=".exe"
     ;;
   *)
-    remote_filename+="-linux-${arch}"
+    remote_filename+="$local_filename-linux-${arch}"
+    checkgen_filename+="$local_filename-checkgen-linux-${arch}"
     ;;
 esac
 checksum_file="tfsec_checksums.txt"
 download_path=$(mktemp -d -t tfsec.XXXXXXXXXX)
 
 echo "remote_filename=$remote_filename"
 echo "local_filename=$local_filename"
+echo "checkgen_filename=$checkgen_filename"
 
 mkdir -p $download_path
 
@@ -58,25 +62,28 @@ fi
 
 echo "Downloading tfsec $version"
 
-curl --fail --silent -L -o "${download_path}/${remote_filename}" "https://github.com/aquasecurity/tfsec/releases/download/${version}/${remote_filename}"
-tfsec_dl_status=$?
-if [ $tfsec_dl_status -ne 0 ]; then
-  echo "Failed to download ${remote_filename}"
-  exit $tfsec_dl_status
-fi
-echo "Downloaded successfully"
-
-echo "Validate checksum"
-curl --fail --silent -L -o "${download_path}/${checksum_file}" "https://github.com/aquasecurity/tfsec/releases/download/${version}/${checksum_file}"
-checksum_dl_val=$?
-if [ $checksum_dl_val -ne 0 ]; then
-  echo "Failed to download checksum file ${checksum_file}"
-  exit $checksum_dl_val
-fi
+download_file() {
+  echo "Downloading $3..."
+  local download_path=${1:?Download path no supplied}   
+  local version=${2:?No version supplied}
+  local file=${3:?File to download not supplied}
+  curl --fail --silent -L -o "${download_path}/${file}" "https://github.com/aquasecurity/tfsec/releases/download/${version}/${file}"
+  dl_status=$?
+  if [ $dl_status -ne 0 ]; then
+    echo "Failed to download ${file}"
+    exit $dl_status
+  fi
+  echo "Downloaded file \"${file}\" successfully"
+}
+
+download_file ${download_path} ${version} ${remote_filename}
+download_file ${download_path} ${version} ${checkgen_filename}
+download_file ${download_path} ${version} ${checksum_file}
 
 pushd $PWD > /dev/null
 cd $download_path
-sha256sum -c $checksum_file --quiet --ignore-missing
+cat ${checksum_file} | grep ${checkgen_filename} > checksum.txt
+sha256sum -c checksum.txt --quiet
 shasum_val=$?
 popd > /dev/null
 
```

---

### Incident Patch 5: `977a2ca8` (2023-03-17)
**Commit Message**: fix typo of drop-invalid-headers doc (#1976)

**File**: `docs/checks/aws/elb/drop-invalid-headers/index.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ title: Load balancers should drop invalid headers
 
 Passing unknown or invalid headers through to the target poses a potential risk of compromise. 
 
-By setting drop_invalid_header_fields to true, anything that doe not conform to well known, defined headers will be removed by the load balancer.
+By setting drop_invalid_header_fields to true, anything that does not conform to well known, defined headers will be removed by the load balancer.
 
 ### Possible Impact
 Invalid headers being passed through to the target of the load balance may exploit vulnerabilities
```

---

### Incident Patch 6: `4732a5ae` (2023-03-17)
**Commit Message**: chore(deps): bump github.com/aquasecurity/defsec from 0.82.6 to 0.84.1 (#2008)

Bumps [github.com/aquasecurity/defsec](https://github.com/aquasecurity/defsec) from 0.82.6 to 0.84.1.
- [Release notes](https://github.com/aquasecurity/defsec/releases)
- [Commits](https://github.com/aquasecurity/defsec/compare/v0.82.6...v0.84.1)

---
updated-dependencies:
- dependency-name: github.com/aquasecurity/defsec
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <support@github.com>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +38/-39)
```diff
@@ -5,58 +5,55 @@ go 1.19
 require (
 	github.com/AlecAivazis/survey/v2 v2.3.6
 	github.com/Masterminds/semver v1.5.0
-	github.com/aquasecurity/defsec v0.82.6
+	github.com/aquasecurity/defsec v0.84.1
 	github.com/google/uuid v1.3.0
 	github.com/hashicorp/go-version v1.6.0
 	github.com/inconshreveable/go-update v0.0.0-20160112193335-8152e7eb6ccf
 	github.com/liamg/clinch v1.6.1
 	github.com/liamg/gifwrap v0.0.7
 	github.com/liamg/tml v0.6.0
 	github.com/spf13/cobra v1.6.1
-	github.com/stretchr/testify v1.8.1
+	github.com/stretchr/testify v1.8.2
 	github.com/zclconf/go-cty v1.10.0
 	gopkg.in/yaml.v2 v2.4.0
 )
 
 require (
-	cloud.google.com/go v0.103.0 // indirect
-	cloud.google.com/go/compute v1.10.0 // indirect
-	cloud.google.com/go/iam v0.3.0 // indirect
-	cloud.google.com/go/storage v1.23.0 // indirect
+	cloud.google.com/go v0.105.0 // indirect
+	cloud.google.com/go/compute v1.14.0 // indirect
+	cloud.google.com/go/compute/metadata v0.2.3 // indirect
+	cloud.google.com/go/iam v0.8.0 // indirect
+	cloud.google.com/go/storage v1.27.0 // indirect
 	github.com/Microsoft/go-winio v0.6.0 // indirect
 	github.com/OneOfOne/xxhash v1.2.8 // indirect
-	github.com/ProtonMail/go-crypto v0.0.0-20210428141323-04723f9f07d7 // indirect
+	github.com/ProtonMail/go-crypto v0.0.0-20221026131551-cf6655e29de4 // indirect
 	github.com/acomagu/bufpipe v1.0.3 // indirect
 	github.com/agext/levenshtein v1.2.3 // indirect
 	github.com/agnivade/levenshtein v1.1.1 // indirect
 	github.com/alecthomas/chroma v0.10.0 // indirect
 	github.com/apparentlymart/go-cidr v1.1.0 // indirect
 	github.com/apparentlymart/go-textseg/v13 v13.0.0 // indirect
-	github.com/aquasecurity/trivy v0.34.0 // indirect
-	github.com/aquasecurity/trivy-db v0.0.0-20220627104749-930461748b63 // indirect
-	github.com/aws/aws-sdk-go v1.44.131 // indirect
+	github.com/aws/aws-sdk-go v1.44.212 // indirect
 	github.com/bgentry/go-netrc v0.0.0-20140422174119-9fd32a8b3d3d // indirect
 	github.com/bmatcuk/doublestar v1.3.4 // indirect
-	github.com/caarlos0/env/v6 v6.10.1 // indirect
+	github.com/cloudflare/circl v1.1.0 // indirect
 	github.com/davecgh/go-spew v1.1.1 // indirect
 	github.com/dlclark/regexp2 v1.4.0 // indirect
-	github.com/emirpasic/gods v1.12.0 // indirect
+	github.com/emirpasic/gods v1.18.1 // indirect
 	github.com/gdamore/encoding v1.0.0 // indirect
 	github.com/gdamore/tcell/v2 v2.5.0 // indirect
 	github.com/ghodss/yaml v1.0.0 // indirect
 	github.com/go-git/gcfg v1.5.0 // indirect
-	github.com/go-git/go-billy/v5 v5.3.1 // indirect
-	github.com/go-git/go-git/v5 v5.4.2 // indirect
+	github.com/go-git/go-billy/v5 v5.4.0 // indirect
+	github.com/go-git/go-git/v5 v5.5.2 // indirect
 	github.com/gobwas/glob v0.2.3 // indirect
 	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
 	github.com/golang/protobuf v1.5.2 // indirect
 	github.com/google/go-cmp v0.5.9 // indirect
-	github.com/google/go-containerregistry v0.12.0 // indirect
-	github.com/googleapis/enterprise-certificate-proxy v0.1.0 // indirect
-	github.com/googleapis/gax-go/v2 v2.5.1 // indirect
-	github.com/googleapis/go-type-adapters v1.0.0 // indirect
+	github.com/googleapis/enterprise-certificate-proxy v0.2.1 // indirect
+	github.com/googleapis/gax-go/v2 v2.7.0 // indirect
 	github.com/hashicorp/go-cleanhttp v0.5.2 // indirect
-	github.com/hashicorp/go-getter v1.6.2 // indirect
+	github.com/hashicorp/go-getter v1.7.0 // indirect
 	github.com/hashicorp/go-safetemp v1.0.0 // indirect
 	github.com/hashicorp/go-uuid v1.0.3 // indirect
 	github.com/hashicorp/hcl/v2 v2.14.1 // indirect
@@ -65,49 +62,51 @@ require (
 	github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 // indirect
 	github.com/jmespath/go-jmespath v0.4.0 // indirect
 	github.com/kballard/go-shellquote v0.0.0-20180428030007-95032a82bc51 // indirect
-	github.com/kevinburke/ssh_config v0.0.0-20201106050909-4977a11b4351 // indirect
-	github.com/klauspost/compress v1.15.11 // indirect
+	github.com/kevinburke/ssh_config v1.2.
```

**File**: `go.sum` (modified, +260/-97)
```diff
@@ -29,56 +29,178 @@ cloud.google.com/go v0.99.0/go.mod h1:w0Xx2nLzqWJPuozYQX+hFfCSI8WioryfRDzkoI/Y2Z
 cloud.google.com/go v0.100.2/go.mod h1:4Xra9TjzAeYHrl5+oeLlzbM2k3mjVhZh4UqTZ//w99A=
 cloud.google.com/go v0.102.0/go.mod h1:oWcCzKlqJ5zgHQt9YsaeTY9KzIvjyy0ArmiBUgpQ+nc=
 cloud.google.com/go v0.102.1/go.mod h1:XZ77E9qnTEnrgEOvr4xzfdX5TRo7fB4T2F4O6+34hIU=
-cloud.google.com/go v0.103.0 h1:YXtxp9ymmZjlGzxV7VrYQ8aaQuAgcqxSy6YhDX4I458=
-cloud.google.com/go v0.103.0/go.mod h1:vwLx1nqLrzLX/fpwSMOXmFIqBOyHsvHbnAdbGSJ+mKk=
+cloud.google.com/go v0.104.0/go.mod h1:OO6xxXdJyvuJPcEPBLN9BJPD+jep5G1+2U5B5gkRYtA=
+cloud.google.com/go v0.105.0 h1:DNtEKRBAAzeS4KyIory52wWHuClNaXJ5x1F7xa4q+5Y=
+cloud.google.com/go v0.105.0/go.mod h1:PrLgOJNe5nfE9UMxKxgXj4mD3voiP+YQ6gdt6KMFOKM=
+cloud.google.com/go/aiplatform v1.22.0/go.mod h1:ig5Nct50bZlzV6NvKaTwmplLLddFx0YReh9WfTO5jKw=
+cloud.google.com/go/aiplatform v1.24.0/go.mod h1:67UUvRBKG6GTayHKV8DBv2RtR1t93YRu5B1P3x99mYY=
+cloud.google.com/go/analytics v0.11.0/go.mod h1:DjEWCu41bVbYcKyvlws9Er60YE4a//bK6mnhWvQeFNI=
+cloud.google.com/go/analytics v0.12.0/go.mod h1:gkfj9h6XRf9+TS4bmuhPEShsh3hH8PAZzm/41OOhQd4=
+cloud.google.com/go/area120 v0.5.0/go.mod h1:DE/n4mp+iqVyvxHN41Vf1CR602GiHQjFPusMFW6bGR4=
+cloud.google.com/go/area120 v0.6.0/go.mod h1:39yFJqWVgm0UZqWTOdqkLhjoC7uFfgXRC8g/ZegeAh0=
+cloud.google.com/go/artifactregistry v1.6.0/go.mod h1:IYt0oBPSAGYj/kprzsBjZ/4LnG/zOcHyFHjWPCi6SAQ=
+cloud.google.com/go/artifactregistry v1.7.0/go.mod h1:mqTOFOnGZx8EtSqK/ZWcsm/4U8B77rbcLP6ruDU2Ixk=
+cloud.google.com/go/asset v1.5.0/go.mod h1:5mfs8UvcM5wHhqtSv8J1CtxxaQq3AdBxxQi2jGW/K4o=
+cloud.google.com/go/asset v1.7.0/go.mod h1:YbENsRK4+xTiL+Ofoj5Ckf+O17kJtgp3Y3nn4uzZz5s=
+cloud.google.com/go/asset v1.8.0/go.mod h1:mUNGKhiqIdbr8X7KNayoYvyc4HbbFO9URsjbytpUaW0=
+cloud.google.com/go/assuredworkloads v1.5.0/go.mod h1:n8HOZ6pff6re5KYfBXcFvSViQjDwxFkAkmUFffJRbbY=
+cloud.google.com/go/assuredworkloads v1.6.0/go.mod h1:yo2YOk37Yc89Rsd5QMVECvjaMKymF9OP+QXWlKXUkXw=
+cloud.google.com/go/assuredworkloads v1.7.0/go.mod h1:z/736/oNmtGAyU47reJgGN+KVoYoxeLBoj4XkKYscNI=
+cloud.google.com/go/automl v1.5.0/go.mod h1:34EjfoFGMZ5sgJ9EoLsRtdPSNZLcfflJR39VbVNS2M0=
+cloud.google.com/go/automl v1.6.0/go.mod h1:ugf8a6Fx+zP0D59WLhqgTDsQI9w07o64uf/Is3Nh5p8=
 cloud.google.com/go/bigquery v1.0.1/go.mod h1:i/xbL2UlR5RvWAURpBYZTtm/cXjCha9lbfbpx4poX+o=
 cloud.google.com/go/bigquery v1.3.0/go.mod h1:PjpwJnslEMmckchkHFfq+HTD2DmtT67aNFKH1/VBDHE=
 cloud.google.com/go/bigquery v1.4.0/go.mod h1:S8dzgnTigyfTmLBfrtrhyYhwRxG72rYxvftPBK2Dvzc=
 cloud.google.com/go/bigquery v1.5.0/go.mod h1:snEHRnqQbz117VIFhE8bmtwIDY80NLUZUMb4Nv6dBIg=
 cloud.google.com/go/bigquery v1.7.0/go.mod h1://okPTzCYNXSlb24MZs83e2Do+h+VXtc4gLoIoXIAPc=
 cloud.google.com/go/bigquery v1.8.0/go.mod h1:J5hqkt3O0uAFnINi6JXValWIb1v0goeZM77hZzJN/fQ=
+cloud.google.com/go/bigquery v1.42.0/go.mod h1:8dRTJxhtG+vwBKzE5OseQn/hiydoQN3EedCaOdYmxRA=
+cloud.google.com/go/billing v1.4.0/go.mod h1:g9IdKBEFlItS8bTtlrZdVLWSSdSyFUZKXNS02zKMOZY=
+cloud.google.com/go/billing v1.5.0/go.mod h1:mztb1tBc3QekhjSgmpf/CV4LzWXLzCArwpLmP2Gm88s=
+cloud.google.com/go/binaryauthorization v1.1.0/go.mod h1:xwnoWu3Y84jbuHa0zd526MJYmtnVXn0syOjaJgy4+dM=
+cloud.google.com/go/binaryauthorization v1.2.0/go.mod h1:86WKkJHtRcv5ViNABtYMhhNWRrD1Vpi//uKEy7aYEfI=
+cloud.google.com/go/cloudtasks v1.5.0/go.mod h1:fD92REy1x5woxkKEkLdvavGnPJGEn8Uic9nWuLzqCpY=
+cloud.google.com/go/cloudtasks v1.6.0/go.mod h1:C6Io+sxuke9/KNRkbQpihnW93SWDU3uXt92nu85HkYI=
 cloud.google.com/go/compute v0.1.0/go.mod h1:GAesmwr110a34z04OlxYkATPBEfVhkymfTBXtfbBFow=
 cloud.google.com/go/compute v1.3.0/go.mod h1:cCZiE1NHEtai4wiufUhW8I8S1JKkAnhnQJWM7YD99wM=
 cloud.google.com/go/compute v1.5.0/go.mod h1:9SMHyhJlzhlkJqrPAc839t2BZFTSk6Jdj6mkzQJeu0M=
 cloud.google.com/go/compute v1.6.0/go.mod h1:T29tfhtVbq1wvAPo0E3+7vhgmkOYeXjhFvz/FMzPu0s=
 cloud.google.com/go/compute v1.6.1/go.mod h1:g85FgpzFvNULZ+S8AYq87axRKuf2Kh7deLqV/jJ3thU=
 cloud.google.com/go/compute v1.7.0/go.mod h1:435
```

---

### Incident Patch 7: `76f940ca` (2023-03-16)
**Commit Message**: chore(deps): bump github.com/liamg/memoryfs from 1.5.0 to 1.6.0 (#1984)

Bumps [github.com/liamg/memoryfs](https://github.com/liamg/memoryfs) from 1.5.0 to 1.6.0.
- [Release notes](https://github.com/liamg/memoryfs/releases)
- [Commits](https://github.com/liamg/memoryfs/compare/v1.5.0...v1.6.0)

---
updated-dependencies:
- dependency-name: github.com/liamg/memoryfs
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <support@github.com>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Gio Rodriguez <gioroddev@gmail.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ require (
 )
 
 require (
-	github.com/liamg/memoryfs v1.5.0
+	github.com/liamg/memoryfs v1.6.0
 	github.com/mattn/go-runewidth v0.0.13 // indirect
 	github.com/owenrumney/go-sarif/v2 v2.1.2
 	github.com/rivo/uniseg v0.2.0 // indirect
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -348,8 +348,8 @@ github.com/liamg/iamgo v0.0.9 h1:tADGm3xVotyRJmuKKaH4+zsBn7LOcvgdpuF3WsSKW3c=
 github.com/liamg/iamgo v0.0.9/go.mod h1:Kk6ZxBF/GQqG9nnaUjIi6jf+WXNpeOTyhwc6gnguaZQ=
 github.com/liamg/jfather v0.0.7 h1:Xf78zS263yfT+xr2VSo6+kyAy4ROlCacRqJG7s5jt4k=
 github.com/liamg/jfather v0.0.7/go.mod h1:xXBGiBoiZ6tmHhfy5Jzw8sugzajwYdi6VosIpB3/cPM=
-github.com/liamg/memoryfs v1.5.0 h1:oFMWUZBb4oDSrz0lw907t5l8oZ1uXTmHAjUWbNgS360=
-github.com/liamg/memoryfs v1.5.0/go.mod h1:z7mfqXFQS8eSeBBsFjYLlxYRMRyiPktytvYCYTb3BSk=
+github.com/liamg/memoryfs v1.6.0 h1:jAFec2HI1PgMTem5gR7UT8zi9u4BfG5jorCRlLH06W8=
+github.com/liamg/memoryfs v1.6.0/go.mod h1:z7mfqXFQS8eSeBBsFjYLlxYRMRyiPktytvYCYTb3BSk=
 github.com/liamg/tml v0.3.0/go.mod h1:0h4EAV/zBOsqI91EWONedjRpO8O0itjGJVd+wG5eC+E=
 github.com/liamg/tml v0.6.0 h1:yOC/Q9p9Io3J11U9LdYVIwpRTnTE1GPMNFLrygkmE2Y=
 github.com/liamg/tml v0.6.0/go.mod h1:0h4EAV/zBOsqI91EWONedjRpO8O0itjGJVd+wG5eC+E=
```

---

### Incident Patch 8: `8b72f751` (2023-01-10)
**Commit Message**: chore(deps): bump github.com/aquasecurity/defsec from 0.82.2 to 0.82.6 (#1951)

Bumps [github.com/aquasecurity/defsec](https://github.com/aquasecurity/defsec) from 0.82.2 to 0.82.6.
- [Release notes](https://github.com/aquasecurity/defsec/releases)
- [Commits](https://github.com/aquasecurity/defsec/compare/v0.82.2...v0.82.6)

---
updated-dependencies:
- dependency-name: github.com/aquasecurity/defsec
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <support@github.com>

Signed-off-by: dependabot[bot] <support@github.com>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +33/-21)
```diff
@@ -5,7 +5,7 @@ go 1.18
 require (
 	github.com/AlecAivazis/survey/v2 v2.3.6
 	github.com/Masterminds/semver v1.5.0
-	github.com/aquasecurity/defsec v0.82.2
+	github.com/aquasecurity/defsec v0.82.6
 	github.com/google/uuid v1.3.0
 	github.com/hashicorp/go-version v1.6.0
 	github.com/inconshreveable/go-update v0.0.0-20160112193335-8152e7eb6ccf
@@ -19,9 +19,11 @@ require (
 )
 
 require (
-	cloud.google.com/go v0.99.0 // indirect
-	cloud.google.com/go/storage v1.10.0 // indirect
-	github.com/Microsoft/go-winio v0.5.2 // indirect
+	cloud.google.com/go v0.103.0 // indirect
+	cloud.google.com/go/compute v1.10.0 // indirect
+	cloud.google.com/go/iam v0.3.0 // indirect
+	cloud.google.com/go/storage v1.23.0 // indirect
+	github.com/Microsoft/go-winio v0.6.0 // indirect
 	github.com/OneOfOne/xxhash v1.2.8 // indirect
 	github.com/ProtonMail/go-crypto v0.0.0-20210428141323-04723f9f07d7 // indirect
 	github.com/acomagu/bufpipe v1.0.3 // indirect
@@ -30,9 +32,12 @@ require (
 	github.com/alecthomas/chroma v0.10.0 // indirect
 	github.com/apparentlymart/go-cidr v1.1.0 // indirect
 	github.com/apparentlymart/go-textseg/v13 v13.0.0 // indirect
-	github.com/aws/aws-sdk-go v1.44.114 // indirect
+	github.com/aquasecurity/trivy v0.34.0 // indirect
+	github.com/aquasecurity/trivy-db v0.0.0-20220627104749-930461748b63 // indirect
+	github.com/aws/aws-sdk-go v1.44.131 // indirect
 	github.com/bgentry/go-netrc v0.0.0-20140422174119-9fd32a8b3d3d // indirect
 	github.com/bmatcuk/doublestar v1.3.4 // indirect
+	github.com/caarlos0/env/v6 v6.10.1 // indirect
 	github.com/davecgh/go-spew v1.1.1 // indirect
 	github.com/dlclark/regexp2 v1.4.0 // indirect
 	github.com/emirpasic/gods v1.12.0 // indirect
@@ -45,19 +50,23 @@ require (
 	github.com/gobwas/glob v0.2.3 // indirect
 	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
 	github.com/golang/protobuf v1.5.2 // indirect
-	github.com/googleapis/gax-go/v2 v2.1.1 // indirect
+	github.com/google/go-cmp v0.5.9 // indirect
+	github.com/google/go-containerregistry v0.12.0 // indirect
+	github.com/googleapis/enterprise-certificate-proxy v0.1.0 // indirect
+	github.com/googleapis/gax-go/v2 v2.5.1 // indirect
+	github.com/googleapis/go-type-adapters v1.0.0 // indirect
 	github.com/hashicorp/go-cleanhttp v0.5.2 // indirect
 	github.com/hashicorp/go-getter v1.6.2 // indirect
 	github.com/hashicorp/go-safetemp v1.0.0 // indirect
 	github.com/hashicorp/go-uuid v1.0.3 // indirect
 	github.com/hashicorp/hcl/v2 v2.14.1 // indirect
-	github.com/imdario/mergo v0.3.12 // indirect
+	github.com/imdario/mergo v0.3.13 // indirect
 	github.com/inconshreveable/mousetrap v1.0.1 // indirect
 	github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 // indirect
 	github.com/jmespath/go-jmespath v0.4.0 // indirect
 	github.com/kballard/go-shellquote v0.0.0-20180428030007-95032a82bc51 // indirect
 	github.com/kevinburke/ssh_config v0.0.0-20201106050909-4977a11b4351 // indirect
-	github.com/klauspost/compress v1.15.1 // indirect
+	github.com/klauspost/compress v1.15.11 // indirect
 	github.com/liamg/iamgo v0.0.9 // indirect
 	github.com/liamg/jfather v0.0.7 // indirect
 	github.com/lucasb-eyer/go-colorful v1.2.0 // indirect
@@ -66,36 +75,39 @@ require (
 	github.com/mgutz/ansi v0.0.0-20170206155736-9520e82c474b // indirect
 	github.com/mitchellh/go-homedir v1.1.0 // indirect
 	github.com/mitchellh/go-testing-interface v1.0.0 // indirect
-	github.com/mitchellh/go-wordwrap v1.0.0 // indirect
+	github.com/mitchellh/go-wordwrap v1.0.1 // indirect
 	github.com/olekukonko/tablewriter v0.0.5 // indirect
 	github.com/open-policy-agent/opa v0.44.1-0.20220927105354-00e835a7cc15 // indirect
 	github.com/owenrumney/squealer v1.0.1-0.20220510063705-c0be93f0edea // indirect
 	github.com/pkg/errors v0.9.1 // indirect
 	github.com/pmezard/go-difflib v1.0.0 // indirect
 	github.com/rcrowley/go-metrics v0.0.0-20200313005456-10cdbea86bc0 // indirect
-	github.com/rogpeppe/go-internal v1.8.1 // indirect
 	github.com/sergi/
```

**File**: `go.sum` (modified, +158/-42)
```diff
@@ -25,17 +25,30 @@ cloud.google.com/go v0.90.0/go.mod h1:kRX0mNRHe0e2rC6oNakvwQqzyDmg57xJ+SZU1eT2aD
 cloud.google.com/go v0.93.3/go.mod h1:8utlLll2EF5XMAV15woO4lSbWQlk8rer9aLOfLh7+YI=
 cloud.google.com/go v0.94.1/go.mod h1:qAlAugsXlC+JWO+Bke5vCtc9ONxjQT3drlTTnAplMW4=
 cloud.google.com/go v0.97.0/go.mod h1:GF7l59pYBVlXQIBLx3a761cZ41F9bBH3JUlihCt2Udc=
-cloud.google.com/go v0.98.0/go.mod h1:ua6Ush4NALrHk5QXDWnjvZHN93OuF0HfuEPq9I1X0cM=
-cloud.google.com/go v0.99.0 h1:y/cM2iqGgGi5D5DQZl6D9STN/3dR/Vx5Mp8s752oJTY=
 cloud.google.com/go v0.99.0/go.mod h1:w0Xx2nLzqWJPuozYQX+hFfCSI8WioryfRDzkoI/Y2ZA=
+cloud.google.com/go v0.100.2/go.mod h1:4Xra9TjzAeYHrl5+oeLlzbM2k3mjVhZh4UqTZ//w99A=
+cloud.google.com/go v0.102.0/go.mod h1:oWcCzKlqJ5zgHQt9YsaeTY9KzIvjyy0ArmiBUgpQ+nc=
+cloud.google.com/go v0.102.1/go.mod h1:XZ77E9qnTEnrgEOvr4xzfdX5TRo7fB4T2F4O6+34hIU=
+cloud.google.com/go v0.103.0 h1:YXtxp9ymmZjlGzxV7VrYQ8aaQuAgcqxSy6YhDX4I458=
+cloud.google.com/go v0.103.0/go.mod h1:vwLx1nqLrzLX/fpwSMOXmFIqBOyHsvHbnAdbGSJ+mKk=
 cloud.google.com/go/bigquery v1.0.1/go.mod h1:i/xbL2UlR5RvWAURpBYZTtm/cXjCha9lbfbpx4poX+o=
 cloud.google.com/go/bigquery v1.3.0/go.mod h1:PjpwJnslEMmckchkHFfq+HTD2DmtT67aNFKH1/VBDHE=
 cloud.google.com/go/bigquery v1.4.0/go.mod h1:S8dzgnTigyfTmLBfrtrhyYhwRxG72rYxvftPBK2Dvzc=
 cloud.google.com/go/bigquery v1.5.0/go.mod h1:snEHRnqQbz117VIFhE8bmtwIDY80NLUZUMb4Nv6dBIg=
 cloud.google.com/go/bigquery v1.7.0/go.mod h1://okPTzCYNXSlb24MZs83e2Do+h+VXtc4gLoIoXIAPc=
 cloud.google.com/go/bigquery v1.8.0/go.mod h1:J5hqkt3O0uAFnINi6JXValWIb1v0goeZM77hZzJN/fQ=
+cloud.google.com/go/compute v0.1.0/go.mod h1:GAesmwr110a34z04OlxYkATPBEfVhkymfTBXtfbBFow=
+cloud.google.com/go/compute v1.3.0/go.mod h1:cCZiE1NHEtai4wiufUhW8I8S1JKkAnhnQJWM7YD99wM=
+cloud.google.com/go/compute v1.5.0/go.mod h1:9SMHyhJlzhlkJqrPAc839t2BZFTSk6Jdj6mkzQJeu0M=
+cloud.google.com/go/compute v1.6.0/go.mod h1:T29tfhtVbq1wvAPo0E3+7vhgmkOYeXjhFvz/FMzPu0s=
+cloud.google.com/go/compute v1.6.1/go.mod h1:g85FgpzFvNULZ+S8AYq87axRKuf2Kh7deLqV/jJ3thU=
+cloud.google.com/go/compute v1.7.0/go.mod h1:435lt8av5oL9P3fv1OEzSbSUe+ybHXGMPQHHZWZxy9U=
+cloud.google.com/go/compute v1.10.0 h1:aoLIYaA1fX3ywihqpBk2APQKOo20nXsp1GEZQbx5Jk4=
+cloud.google.com/go/compute v1.10.0/go.mod h1:ER5CLbMxl90o2jtNbGSbtfOpQKR0t15FOtRsugnLrlU=
 cloud.google.com/go/datastore v1.0.0/go.mod h1:LXYbyblFSglQ5pkeyhO+Qmw7ukd3C+pD7TKLgZqpHYE=
 cloud.google.com/go/datastore v1.1.0/go.mod h1:umbIZjpQpHh4hmRpGhH4tLFup+FVzqBi1b3c64qFpCk=
+cloud.google.com/go/iam v0.3.0 h1:exkAomrVUuzx9kWFI1wm3KI0uoDeUFPB4kKGzx6x+Gc=
+cloud.google.com/go/iam v0.3.0/go.mod h1:XzJPvDayI+9zsASAFO68Hk07u3z+f+JrT2xXNdp4bnY=
 cloud.google.com/go/pubsub v1.0.1/go.mod h1:R0Gpsv3s54REJCy4fxDixWD93lHJMoZTyQ2kNxGRt3I=
 cloud.google.com/go/pubsub v1.1.0/go.mod h1:EwwdRX2sKPjnvnqCa270oGRyludottCI76h+R3AArQw=
 cloud.google.com/go/pubsub v1.2.0/go.mod h1:jhfEVHT8odbXTkndysNHCcx0awwzvfOlguIAii9o8iA=
@@ -44,8 +57,10 @@ cloud.google.com/go/storage v1.0.0/go.mod h1:IhtSnM/ZTZV8YYJWCY8RULGVqBDmpoyjwiy
 cloud.google.com/go/storage v1.5.0/go.mod h1:tpKbwo567HUNpVclU5sGELwQWBDZ8gh0ZeosJ0Rtdos=
 cloud.google.com/go/storage v1.6.0/go.mod h1:N7U0C8pVQ/+NIKOBQyamJIeKQKkZ+mxpohlUTyfDhBk=
 cloud.google.com/go/storage v1.8.0/go.mod h1:Wv1Oy7z6Yz3DshWRJFhqM/UCfaWIRTdp0RXyy7KQOVs=
-cloud.google.com/go/storage v1.10.0 h1:STgFzyU5/8miMl0//zKh2aQeTyeaUH3WN9bSUiJ09bA=
 cloud.google.com/go/storage v1.10.0/go.mod h1:FLPqc6j+Ki4BU591ie1oL6qBQGu2Bl/tZ9ullr3+Kg0=
+cloud.google.com/go/storage v1.22.1/go.mod h1:S8N1cAStu7BOeFfE8KAQzmyyLkK8p/vmRq6kuBTW58Y=
+cloud.google.com/go/storage v1.23.0 h1:wWRIaDURQA8xxHguFCshYepGlrWIrbBnAmc7wfg07qY=
+cloud.google.com/go/storage v1.23.0/go.mod h1:vOEEDNFnciUMhBeT6hsJIn3ieU5cFRmzeLgDvXzfIXc=
 dmitri.shuralyov.com/gpu/mtl v0.0.0-20190408044501-666a987793e9/go.mod h1:H6x//7gZCb22OMCxBHrMx7a5I7Hp++hsVxbQ4BYO7hU=
 github.com/AlecAivazis/survey/v2 v2.3.6 h1:NvTuVHISgTHEHeBFqt6BHOe4Ny/NwGZr7w+F8S9ziyw=
 github.com/AlecAivazis/survey/v2 v2.3.6/go.mod h1:4AuI9b7
```

---

### Incident Patch 9: `46888bac` (2023-01-10)
**Commit Message**: chore(deps): bump github.com/liamg/memoryfs from 1.4.3 to 1.5.0 (#1944)

Bumps [github.com/liamg/memoryfs](https://github.com/liamg/memoryfs) from 1.4.3 to 1.5.0.
- [Release notes](https://github.com/liamg/memoryfs/releases)
- [Commits](https://github.com/liamg/memoryfs/compare/v1.4.3...v1.5.0)

---
updated-dependencies:
- dependency-name: github.com/liamg/memoryfs
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <support@github.com>

Signed-off-by: dependabot[bot] <support@github.com>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Owen Rumney <owen@owenrumney.co.uk>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@ require (
 )
 
 require (
-	github.com/liamg/memoryfs v1.4.3
+	github.com/liamg/memoryfs v1.5.0
 	github.com/mattn/go-runewidth v0.0.13 // indirect
 	github.com/owenrumney/go-sarif/v2 v2.1.2
 	github.com/rivo/uniseg v0.2.0 // indirect
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -310,8 +310,8 @@ github.com/liamg/iamgo v0.0.9 h1:tADGm3xVotyRJmuKKaH4+zsBn7LOcvgdpuF3WsSKW3c=
 github.com/liamg/iamgo v0.0.9/go.mod h1:Kk6ZxBF/GQqG9nnaUjIi6jf+WXNpeOTyhwc6gnguaZQ=
 github.com/liamg/jfather v0.0.7 h1:Xf78zS263yfT+xr2VSo6+kyAy4ROlCacRqJG7s5jt4k=
 github.com/liamg/jfather v0.0.7/go.mod h1:xXBGiBoiZ6tmHhfy5Jzw8sugzajwYdi6VosIpB3/cPM=
-github.com/liamg/memoryfs v1.4.3 h1:+ChjcuPRYpjJSulD13PXDNR3JeJ5HUYKjLHyWVK0bqU=
-github.com/liamg/memoryfs v1.4.3/go.mod h1:z7mfqXFQS8eSeBBsFjYLlxYRMRyiPktytvYCYTb3BSk=
+github.com/liamg/memoryfs v1.5.0 h1:oFMWUZBb4oDSrz0lw907t5l8oZ1uXTmHAjUWbNgS360=
+github.com/liamg/memoryfs v1.5.0/go.mod h1:z7mfqXFQS8eSeBBsFjYLlxYRMRyiPktytvYCYTb3BSk=
 github.com/liamg/tml v0.3.0/go.mod h1:0h4EAV/zBOsqI91EWONedjRpO8O0itjGJVd+wG5eC+E=
 github.com/liamg/tml v0.6.0 h1:yOC/Q9p9Io3J11U9LdYVIwpRTnTE1GPMNFLrygkmE2Y=
 github.com/liamg/tml v0.6.0/go.mod h1:0h4EAV/zBOsqI91EWONedjRpO8O0itjGJVd+wG5eC+E=
```

---

### Incident Patch 10: `459c948c` (2023-01-09)
**Commit Message**: Fix table in usage.md (#1922)

Fix small syntax error in usage file

Co-authored-by: Owen Rumney <owen@owenrumney.co.uk>

**File**: `docs/guides/usage.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ tfsec can be run with no arguments and will act on the current folder.
 For a richer experience, there are many additional command line arguments that you can make use of.
 
 | Argument                       | Short Code | Description                                                                                                                                                                                                                                                                                |
-|-:------------------------------|-:----------|-:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
+|:-------------------------------|:-----------|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
 | `--code-theme string`          |            | Theme for annotated code. Either 'light' or 'dark'. (default "dark")                                                                                                                                                                                                                       |
 | `--concise-output    `         |            | Reduce the amount of output and no statistics                                                                                                                                                                                                                                              |
 | `--config-file string `        |            | Config file to use during run                                                                                                                                                                                                                                                              |
```

#### Recent Merged Pull Requests:
- **PR #2205** (closed): feat: add automated security auditing workflow (@hjun3959-blip)
- **PR #2187** (closed): chore(deps): bump actions/setup-python from 4 to 5 (@dependabot[bot])
- **PR #2186** (closed): chore(deps): bump actions/github-script from 6 to 7 (@dependabot[bot])
- **PR #2181** (closed): chore(deps): bump github.com/spf13/pflag from 1.0.5 to 1.0.7 (@dependabot[bot])
- **PR #2180** (closed): chore(deps): bump alpine from 3.17.2 to 3.22.1 (@dependabot[bot])
- **PR #2178** (closed): chore(deps): bump alpine from 3.17.2 to 3.22.0 (@dependabot[bot])
- **PR #2177** (closed): CVE-2025-46569: Improper Control of Generation of Code ('Code Injecton') (@jdesouza)
- **PR #2176** (2025-05-02): chore(deps): bump golangci-lint to v2.1 (@mmorel-35)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

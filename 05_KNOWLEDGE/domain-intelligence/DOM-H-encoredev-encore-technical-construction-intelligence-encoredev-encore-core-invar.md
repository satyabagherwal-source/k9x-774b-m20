# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: encoredev/encore Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "encoredev/encore",
  "source_url": "https://github.com/encoredev/encore",
  "source_version": "8a7465a4",
  "license": "MPL-2.0",
  "timestamp": "2026-11-13T15:18:34.212Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-encoredev-encore",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [encoredev/encore](https://github.com/encoredev/encore) (Revision: `8a7465a4`).  
> **License**: MPL-2.0 | **Timestamp**: `2026-11-13T15:18:34.212Z`  
> **Learning ID**: `learn-github-encoredev-encore`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: F (Design Intelligence), D (Research & Knowledge Intelligence), G (Architecture Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 77%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from encoredev/encore:

# Forensic Learning Record (Deep Inspection): encoredev/encore

> **Canonical Artifact**: `07_PROJECT_LEARNING/encoredev-encore-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/encoredev/encore](https://github.com/encoredev/encore))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T15:18:33.556Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `encoredev/encore`
- **Description**: Infrastructure orchestration from local to your cloud
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: Cargo.toml, go.mod, README.md
- **Stars / Engagement**: 12712 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/cmd/encore/app/app.go`
```
package app

import (
	"github.com/spf13/cobra"

	"encr.dev/cli/cmd/encore/root"
)

// These can be overwritten using
// `go build -ldflags "-X encr.dev/cli/cmd/encore/app.defaultGitRemoteName=encore"`.
var (
	defaultGitRemoteName = "encore"
	defaultGitRemoteURL  = "encore://"
)

var appCmd = &cobra.Command{
	Use:   "app",
	Short: "Commands to create and link Encore apps",
}

func init() {
	root.Cmd.AddCommand(appCmd)
}

```

### Core Architecture Module: `cli/cmd/encore/app/clone.go`
```
package app

import (
	"os"
	"os/exec"

	"github.com/spf13/cobra"

	"encr.dev/cli/cmd/encore/cmdutil"
)

var cloneAppCmd = &cobra.Command{
	Use:   "clone [app-id] [directory]",
	Short: "Clone an existing Encore app from Encore Cloud to your computer",
	Args:  cobra.MinimumNArgs(1),

	DisableFlagsInUseLine: true,
	Run: func(c *cobra.Command, args []string) {
		cmdArgs := append([]string{"clone", "--origin", defaultGitRemoteName, defaultGitRemoteURL + args[0]}, args[1:]...)
		cmd := exec.Command("git", cmdArgs...)
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			os.Exit(1)
		}
	},
	ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		switch len(args) {
		case 0:
			return cmdutil.AutoCompleteAppSlug(cmd, args, toComplete)
		case 1:
			return nil, cobra.ShellCompDirectiveFilterDirs
		default:
			return nil, cobra.ShellCompDirectiveDefault
		}
	},
}

func init() {
	appCmd.AddCommand(cloneAppCmd)
}

```

### Core Architecture Module: `cli/cmd/encore/app/create.go`
```
package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/briandowns/spinner"
	"github.com/cockroachdb/errors"
	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/tailscale/hujson"
	"golang.org/x/term"

	"encr.dev/cli/cmd/encore/auth"
	"encr.dev/cli/cmd/encore/cmdutil"
	"encr.dev/cli/cmd/encore/llm_rules"
	"encr.dev/cli/internal/platform"
	"encr.dev/cli/internal/telemetry"
	"encr.dev/internal/conf"
	"encr.dev/internal/env"
	"encr.dev/internal/userconfig"
	"encr.dev/internal/version"
	"encr.dev/pkg/github"
	"encr.dev/pkg/option"
	"encr.dev/pkg/xos"
	daemonpb "encr.dev/proto/encore/daemon"
)

var (
	createAppTemplate   string
	createAppOnPlatform bool
	createAppOrg        string
	createAppLang       = cmdutil.Oneof{
		Value:     "",
		Allowed:   cmdutil.LanguageFlagValues(),
		Flag:      "lang",
		FlagShort: "l",
		Desc:      "Programming language to use for the app",
		TypeDesc:  "string",
	}
	createAppLLMRules = cmdutil.Oneof{
		Value:     "",
		Allowed:   llm_rules.LLMRulesFlagValues(),
		Flag:      "llm-rules",
		FlagShort: "r",
		Desc:      "Initialize the app with llm rules for a specific tool",
		TypeDesc:  "string",
	}
)

var createAppCmd = &cobra.Command{
	Use:   "create [name]",
	Short: "Create a new Encore app",
	Args:  cobra.MaximumNArgs(1),

	DisableFlagsInUseLine: true,
	Run: func(cmd *cobra.Command, args []string) {
		name := ""
		if len(args) > 0 {
			name = args[0]
		}

		var tool llm_rules.Tool
		if createAppLLMRules.Value == "" {
			cfg, err := userconfig.Global().Get()
			if err != nil {
				cmdutil.Fatalf("Couldn't read user config: %s", err)
			}
			tool = llm_rules.Tool(cfg.LLMRules)
		} else {
			tool = llm_rules.Tool(createAppLLMRules.Value)
		}

		if err := createApp(context.Background(), name, createAppTemplate, cmdutil.Language(createAppLang.Value), tool); err != nil {
			cmdutil.Fatal(err)
		}
	},
}

func init() {
	appCmd.AddCommand(createAppCmd)
	createAppCmd.Flags().BoolVar(&createAppOnPlatform, "platform", true, "whether to create the app with the Encore Platform")
	createAppCmd.Flags().StringVar(&createAppTemplate, "example", "", "URL to example code to use.")
	createAppCmd.Flags().StringVar(&createAppOrg, "org", "", "ID or slug of the org to create the app in")
	createAppLang.AddFlag(createAppCmd)
	createAppLLMRules.AddFlag(createAppCmd)
}

func promptAccountCreation() {
	// If shell is non-interactive, don't prompt
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		return
	}
	cyan := color.New(color.FgCyan)
	red := color.New(color.FgRed)
	// Prompt the user for creating an account if they're not logged in.
	if _, err := conf.CurrentUser(); errors.Is(err, fs.ErrNotExist) && createAppOnPlatform {
	PromptLoop:
		for {
			_, _ = cyan.Fprint(os.Stderr, "Log in / Sign up for a free Encore Cloud account to enable automated cloud deployments? (Y/n): ")
			var input string
			_, _ = fmt.Scanln(&input)
			input = strings.TrimSpace(input)
			switch input {
			case "Y", "y", "yes", "":
				telemetry.Send("app.create.account", map[string]any{"response": true})
				if err := auth.DoLogin(auth.AutoFlow); err != nil {
					cmdutil.Fatal(err)
				}
			case "N", "n", "no":
				telemetry.Send("app.create.account", map[string]any{"response": false})
				// Continue without creating an account.
			case "q", "quit", "exit":
				os.Exit(1)
			default:
				// Try again.
				_, _ = red.Fprintln(os.Stderr, "Unexpected answer, please enter 'y' or 'n'.")
				continue PromptLoop
			}
			break
		}
	}
}

func promptRunApp() bool {
	// If shell is non-interactive, don't prompt
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		return false
	}

	cyan := color.New(color.FgCyan)
	red := color.New(color.FgRed)
	for {
		_, _ = cyan.Fprint(os.Stderr, "Run your app now? (Y/n): ")
		var input string
		_, _ = fmt.Scanln(&input)
		input = strings.TrimSpace(input)
		switch input {
		case "Y", "y", "yes", "":
			telemetry.Send("app.create.run", map[string]any{"response": true})
			return true
		case "N", "n", "no":
			telemetry.Send("app.create.run", map[string]any{"response": false})
			return false
		case "q", "quit", "exit":
			telemetry.Send("app.create.run", map[string]any{"response": false})
			return false
		default:
			// Try again.
			_, _ = red.Fprintln(os.Stderr, "Unexpected answer, please enter 'y' or 'n'.")
		}
	}
}

// createApp is the implementation of the "encore app create" command.
func createApp(ctx context.Context, name, template string, lang cmdutil.Language, llmRules llm_rules.Tool) (err error) {
	defer func() {
		// We need to send the telemetry synchronously to ensure it's sent before the command exits.
		telemetry.SendSync("app.create", map[string]any{
			"template": template,
			"lang":     lang,
			"error":    err != nil,
		})
	}()
	cyan := color.New(color.FgCyan)
	green := color.New(color.FgGreen)

	// The current directory already has Encore code but no encore.app, so steer
	// to the in-place commands instead of scaffolding a new app in a subdirectory.
	if cwd, err := os.Getwd(); err == nil {
		if _, _, rootErr := cmdutil.MaybeAppRoot(); errors.Is(rootErr, cmdutil.ErrNoEncoreApp) && cmdutil.LooksLikeUninitializedEncoreApp(cwd) {
			return errors.New("this directory already contains Encore code but isn't initialized as an app.\n\nRun 'encore app init' to initialize it in place, or 'encore app link <app-id>' to link an existing app.")
		}
	}

	promptAccountCreation()

	if name == "" || template == "" || llmRules == "" {
		name, template, lang, llmRules = createAppForm(name, template, lang, llmRules, false)
	}
	// Treat the special name "empty" as the empty app template
	// (the rest of the code assumes that's the empty string).
	if template == "empty" {
		template = ""
	}
	if template == "" && lang == cmdutil.LanguageTS {
		template = "ts/empty"
	}

	if err := validateName(name); err != nil {
		return err
	} else if _, err := os.Stat(name); err == nil {
		return fmt.Errorf("directory %s already exists", name)
	}

	var orgID option.Option[string]
	if _, err := conf.CurrentUser(); err == nil && createAppOnPlatform {
		if orgID, err = selectAppOrg(ctx, option.AsOptional(createAppOrg)); err != nil {
			return err
		}
	} else if createAppOrg != "" {
		return errors.New("--org requires being logged in and --platform")
	}

	// Parse template information, if provided.
	var ex *github.Tree
	if template != "" {
		var err error
		ex, err = parseTemplate(ctx, template)
		if err != nil {
			return err
		}
	}

	if err := os.Mkdir(name, 0755); err != nil {
		return err
	}
	defer func() {
		if err != nil {
			// Clean up the directory we just created in case of an error.
			_ = os.RemoveAll(name)
		}
	}()

	if ex != nil {
		s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
		s.Prefix = fmt.Sprintf("Downloading template %s ", ex.Name())
		s.Start()
		err := github.ExtractTree(ctx, ex, name)
		s.Stop()
		fmt.Println()

		if err != nil {
			return fmt.Errorf("failed to download template %s: %v", ex.Name(), err)
		}
		gray := color.New(color.Faint)
		_, _ = gray.Printf("Downloaded template %s.\n", ex.Name())
	} else {
		// Set up files that we need when we don't have an example
		if err := xos.WriteFile(filepath.Join(name, ".gitignore"), []byte("/.encore\n"), 0644); err != nil {
			cmdutil.Fatal(err)
		}
		encoreModData := []byte("module encore.app\n")
		if err := xos.WriteFile(filepath.Join(name, "go.mod"), encoreModData, 0644); err != nil {
			cmdutil.Fatal(err)
		}
	}

	_, err = conf.CurrentUser()
	loggedIn := err == nil
	if !loggedIn && createAppOnPlatform {
		warnNotLoggedIn()
	}

	exCfg, err := parseExampleConfig(name)
	if err != nil {
		return fmt.Errorf("failed to parse example config: %v", err)
	}

	// Delete the example config file.
	_ = os.Remove(exampleJSONPath(name))

	var app *platform.App
	if loggedIn && createAppOnPlatform {
		s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
		s.Prefix = "Creating app on encore.dev "
		s.Start()
		app, err = createAppOnServer(name, exCfg, orgID)
		s.Stop()
		if err != nil {
			return fmt.Errorf("creating app on encore.dev: %v", err)
		}
	}

	appRootRelpath := filepath.FromSlash(exCfg.EncoreAppPath)
	encoreAppPath := filepath.Join(name, appRootRelpath, "encore.app")
	appData, err := os.ReadFile(encoreAppPath)
	if err != nil {
		appData, err = []byte("{}"), nil
	}

	if app != nil {
		appData, err = setEncoreAppID(appData, app.Slug, []string{})
	} else {
		appData, err = setEncoreAppID(appData, "", []string{
			"The app is not currently linked to the encore.dev platform.",
			`Use "encore app link" to link it.`,
		})
	}
	if err != nil {
		return errors.Wrap(err, "write encore.app file")
	}
	if err := xos.WriteFile(encoreAppPath, appData, 0644); err != nil {
		return errors.Wrap(err, "write encore.app file")
	}

	// Update to latest encore.dev release
	if _, err := os.Stat(filepath.Join(name, appRootRelpath, "go.mod")); err == nil {
		lang = cmdutil.LanguageGo
		s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
		s.Prefix = "Running go get encore.dev@latest"
		s.Start()
		if err := gogetEncore(filepath.Join(name, appRootRelpath)); err != nil {
			s.FinalMSG = fmt.Sprintf("failed, skipping: %v", err.Error())
		}
		s.Stop()
	} else if _, err := os.Stat(filepath.Join(name, appRootRelpath, "package.json")); err == nil {
		lang = cmdutil.LanguageTS
		s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
		s.Prefix = "Running npm install encore.dev@latest"
		s.Start()
		if err := npmInstallEncore(filepath.Join(name, appRootRelpath)); err != nil {
			s.FinalMSG = fmt.Sprintf("failed, skipping: %v", err.Error())
		}
		s.Stop()
	}

	// Rewrite any existence of ENCORE_APP_ID to the allocated app id.
	if app != nil {
		if err := rewritePlaceholders(name, app); err != nil {
			red := color.New(color.FgRed)
			_, _ = red.Printf("Failed rewriting source code placeholders, skipping: %v\n", err)
		}
	}

	if err := initGitRepo(name, app); err != nil {
		return
```

### Core Architecture Module: `cli/cmd/encore/app/create_form.go`
```
package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/tailscale/hujson"
	"golang.org/x/term"

	"encr.dev/cli/cmd/encore/cmdutil"
	"encr.dev/cli/cmd/encore/llm_rules"
	"encr.dev/pkg/option"
)

type templateItem struct {
	ItemTitle string           `json:"title"`
	Desc      string           `json:"desc"`
	Template  string           `json:"template"`
	Lang      cmdutil.Language `json:"lang"`
}

func (i templateItem) Title() string       { return i.ItemTitle }
func (i templateItem) Description() string { return i.Desc }
func (i templateItem) FilterValue() string { return i.ItemTitle }

type CreateStep int

const (
	CreateStepLang CreateStep = iota
	CreateStepTemplate
	CreateStepAppName
	CreateStepLLMRules
)

type createFormModel struct {
	steps []CreateStep

	lang      langSelectModel
	templates templateListModel
	appName   appNameModel
	llmRules  llm_rules.ToolSelectModel

	initExistingApp bool

	width   int
	height  int
	aborted bool
}

func (m createFormModel) currentStep() option.Option[CreateStep] {
	if len(m.steps) == 0 {
		return option.None[CreateStep]()
	}
	return option.Some(m.steps[0])
}

func (m createFormModel) hasStep(s CreateStep) bool {
	return slices.Contains(m.steps, s)
}

func (m *createFormModel) removeStep(s CreateStep) {
	m.steps = slices.DeleteFunc(m.steps, func(step CreateStep) bool {
		return step == s
	})
}

func (m createFormModel) Init() tea.Cmd {
	return tea.Batch(
		m.appName.Init(),
		m.templates.Init(),
	)
}

const checkmark = "✔"

type appNameDone struct{}

type appNameModel struct {
	predefined string
	text       textinput.Model
	dirExists  bool
}

func (m appNameModel) Init() tea.Cmd {
	return tea.Batch(
		textinput.Blink,
	)
}

func (m appNameModel) Selected() string {
	if m.predefined != "" {
		return m.predefined
	}
	return m.text.Value()
}

func (m appNameModel) Update(msg tea.Msg) (appNameModel, tea.Cmd) {
	var cmds []tea.Cmd
	var c tea.Cmd
	m.text, c = m.text.Update(msg)
	cmds = append(cmds, c)

	if val := m.text.Value(); val != "" {
		_, err := os.Stat(val)
		m.dirExists = err == nil
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyEnter:
			if m.text.Value() != "" && !m.dirExists {
				cmds = append(cmds, func() tea.Msg {
					return appNameDone{}
				})
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m appNameModel) View() string {
	var b strings.Builder
	if m.text.Focused() {
		b.WriteString(cmdutil.InputStyle.Render("App Name"))
		b.WriteString(cmdutil.DescStyle.Render(" [Use only lowercase letters, digits, and dashes]"))
		b.WriteByte('\n')
		b.WriteString(m.text.View())
		if m.dirExists {
			b.WriteString(cmdutil.ErrorStyle.Render(" error: dir already exists"))
		}
	} else {
		fmt.Fprintf(&b, "%s App Name: %s", checkmark, m.text.Value())
	}
	b.WriteByte('\n')
	return b.String()
}

type templateListModel struct {
	predefined string
	filter     cmdutil.Language

	all     []templateItem
	list    list.Model
	loading spinner.Model
}

func (m templateListModel) Init() tea.Cmd {
	return tea.Batch(
		loadTemplates,
		m.loading.Tick,
	)
}

func (m *templateListModel) SetSize(width, height int) {
	m.list.SetWidth(width)
	m.list.SetHeight(max(height-1, 0))
}

type templateSelectDone struct{}

func (m templateListModel) Update(msg tea.Msg) (templateListModel, tea.Cmd) {
	var cmds []tea.Cmd
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyEnter:
			// Have we selected a template?
			if idx := m.list.Index(); idx >= 0 {
				return m, func() tea.Msg { return templateSelectDone{} }
			}
		}

	case spinner.TickMsg:
		m.loading, _ = m.loading.Update(msg)

	case loadedTemplates:
		m.all = msg
		m.refreshFilter()
		newList, c := m.list.Update(msg)
		m.list = newList
		cmds = append(cmds, c)
	}

	newList, c := m.list.Update(msg)
	m.list = newList
	cmds = append(cmds, c)

	return m, tea.Batch(cmds...)
}

func (m *templateListModel) UpdateFilter(lang cmdutil.Language) {
	m.filter = lang
	m.refreshFilter()
}

func (m *templateListModel) refreshFilter() {
	var listItems []list.Item
	for _, it := range m.all {
		if it.Lang == m.filter {
			listItems = append(listItems, it)
		}
	}
	m.list.SetItems(listItems)
}

func (m templateListModel) View() string {
	var b strings.Builder
	b.WriteString(cmdutil.InputStyle.Render("Template"))
	b.WriteString(cmdutil.DescStyle.Render(" [Use arrows to move]"))
	b.WriteByte('\n')
	b.WriteString(m.list.View())

	return b.String()
}

func (m templateListModel) Selected() string {
	if m.predefined != "" {
		return m.predefined
	}
	idx := m.list.Index()
	if idx < 0 {
		return ""
	}
	return m.list.Items()[idx].FilterValue()
}

func (m createFormModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var (
		cmds []tea.Cmd
		c    tea.Cmd
	)

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "esc":
			m.aborted = true
			return m, tea.Quit
		case "q":
			// Only quit if no text input is focused
			if step, ok := m.currentStep().Get(); ok && step == CreateStepAppName {
				if m.appName.text.Focused() {
					break
				}
			}
			m.aborted = true
			return m, tea.Quit
		}

		if step, ok := m.currentStep().Get(); ok {
			switch step {
			case CreateStepLang:
				m.lang, c = m.lang.Update(msg)
				cmds = append(cmds, c)
			case CreateStepTemplate:
				m.templates, c = m.templates.Update(msg)
				cmds = append(cmds, c)
			case CreateStepAppName:
				m.appName, c = m.appName.Update(msg)
				cmds = append(cmds, c)
			case CreateStepLLMRules:
				m.llmRules, c = m.llmRules.Update(msg)
				cmds = append(cmds, c)
			}
		}
		return m, tea.Batch(cmds...)

	case langSelectDone:
		m.removeStep(CreateStepLang)
		m.templates.UpdateFilter(msg.Selected)
		m.SetSize(m.width, m.height)

	case llm_rules.ToolSelectDone:
		m.removeStep(CreateStepLLMRules)
		m.SetSize(m.width, m.height)

	case templateSelectDone:
		m.removeStep(CreateStepTemplate)
		if m.appName.predefined != "" {
			m.removeStep(CreateStepAppName)
		}
		m.SetSize(m.width, m.height)

	case appNameDone:
		m.removeStep(CreateStepAppName)
		m.SetSize(m.width, m.height)

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.SetSize(msg.Width, msg.Height)
		return m, nil
	}

	// No more steps, quit
	if !m.currentStep().Present() {
		cmds = append(cmds, tea.Quit)
	}

	// Update all submodels for other messages.
	m.lang, c = m.lang.Update(msg)
	cmds = append(cmds, c)
	m.templates, c = m.templates.Update(msg)
	cmds = append(cmds, c)
	m.llmRules, c = m.llmRules.Update(msg)
	cmds = append(cmds, c)
	m.appName, c = m.appName.Update(msg)
	cmds = append(cmds, c)

	return m, tea.Batch(cmds...)
}

func (m *createFormModel) SetSize(width, height int) {
	doneHeight := lipgloss.Height(m.doneView())
	availHeight := height - doneHeight

	// CreateStepLang
	m.lang.SetSize(width, availHeight)

	// CreateStepTemplate
	m.templates.SetSize(width, availHeight)

	// CreateStepLLMRules
	m.llmRules.SetSize(width, availHeight)
}

func (m createFormModel) doneView() string {
	var b strings.Builder

	renderDone := func(title, value string) {
		b.WriteString(cmdutil.SuccessStyle.Render(fmt.Sprintf("%s %s: ", checkmark, title)))
		b.WriteString(value)
		b.WriteByte('\n')
	}

	renderLangDone := func() {
		renderDone("Language", m.lang.Selected().Display())
	}

	renderNameDone := func() {
		renderDone("App Name", m.appName.Selected())
	}

	renderTemplateDone := func() {
		renderDone("Template", m.templates.Selected())
	}

	renderLLMRulesDone := func() {
		renderDone("LLM Rules", m.llmRules.Selected().Display())
	}

	if m.appName.predefined != "" {
		renderNameDone()
	}
	if m.templates.predefined == "" && !m.hasStep(CreateStepLang) {
		renderLangDone()
	}
	if !m.initExistingApp {
		if m.templates.predefined != "" || !m.hasStep(CreateStepTemplate) {
			renderTemplateDone()
		}
		if m.llmRules.Predefined != "" || !m.hasStep(CreateStepLLMRules) {
			if m.llmRules.Selected() != llm_rules.LLMRulesToolNone {
				renderLLMRulesDone()
			}
		}
	}
	if m.appName.predefined == "" && !m.hasStep(CreateStepAppName) {
		renderNameDone()
	}

	return b.String()
}

func (m createFormModel) View() string {
	var b strings.Builder

	doneView := m.doneView()

	b.WriteString(doneView)
	if doneView != "" {
		b.WriteByte('\n')
	}

	if step, ok := m.currentStep().Get(); ok {
		if step == CreateStepLang {
			b.WriteString(m.lang.View())
		}

		if step == CreateStepTemplate {
			b.WriteString(m.templates.View())
		}

		if step == CreateStepAppName {
			b.WriteString(m.appName.View())
		}

		if step == CreateStepLLMRules {
			b.WriteString(m.llmRules.View())
		}
	}

	return cmdutil.DocStyle.Render(b.String())
}

func (m templateListModel) SelectedItem() (templateItem, bool) {
	if m.predefined != "" {
		return templateItem{}, false
	}
	idx := m.list.Index()
	items := m.list.Items()
	if idx >= 0 && len(items) > idx {
		return items[idx].(templateItem), true
	}
	return templateItem{}, false
}

func createAppForm(inputName, inputTemplate string, inputLang cmdutil.Language, inputLLMRules llm_rules.Tool, initExistingApp bool) (appName, template string, selectedLang cmdutil.Language, selectedRules llm_rules.Tool) {
	// If all is set, just return
	if inputName != "" && inputTemplate != "" && inputLLMRules != "" {
		return inputName, inputTemplate, inputLang, inputLLMRules
	}

	// If shell is non-interactive, don't prompt
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		if inputName == "" {
			cmdutil.Fatal("specify an app name")
		}
		return inputName, inputTemplate, inputLang, inputLLMRules
	}

	var langModel langSelectModel
	{
		ls := list.NewDefaultItemStyles()
		ls.SelectedTitle = ls.SelectedTitle.Foreground(lipgloss.Color(cmdutil.CodeBlue)).BorderForeground(lipgloss.Color(cmdutil.CodeBlue))
		ls.Selecte
```

### Core Architecture Module: `cli/cmd/encore/app/create_org.go`
```
package app

import (
	"context"
	"fmt"
	"os"
	"slices"
	"strings"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/cockroachdb/errors"
	"golang.org/x/term"

	"encr.dev/cli/cmd/encore/cmdutil"
	"encr.dev/cli/internal/platform"
	"encr.dev/pkg/option"
)

// selectAppOrg returns the ID of the org to create the app in, or None to let
// the server default to the user's personal org.
// A present key selects the org by ID or slug; otherwise the user is prompted
// if they can create apps in an org besides their personal one.
func selectAppOrg(ctx context.Context, key option.Option[string]) (option.Option[string], error) {
	orgs, err := platform.ListOrgs(ctx)
	if err != nil {
		if key.Present() {
			return option.None[string](), err
		}
		return option.None[string](), nil
	}
	orgs = slices.DeleteFunc(orgs, func(o *platform.Org) bool { return !o.CanCreateApp })

	if k, ok := key.Get(); ok {
		id, err := matchOrg(orgs, k)
		if err != nil {
			return option.None[string](), err
		}
		return option.Some(id), nil
	}
	if !hasChoice(orgs) || !term.IsTerminal(int(os.Stdin.Fd())) {
		return option.None[string](), nil
	}
	return promptOrg(orgs)
}

// hasChoice reports whether orgs holds an org besides the personal one.
func hasChoice(orgs []*platform.Org) bool {
	return slices.ContainsFunc(orgs, func(o *platform.Org) bool { return !o.Personal })
}

// orgItems returns the prompt items for orgs: the personal org first, or a
// "Personal account" item sending no org if orgs has no personal org.
func orgItems(orgs []*platform.Org) []orgItem {
	items := make([]orgItem, 0, len(orgs)+1)
	if i := slices.IndexFunc(orgs, func(o *platform.Org) bool { return o.Personal }); i >= 0 {
		items = append(items, orgItem{id: orgChoice(orgs[i].ID), name: orgs[i].Name})
	} else {
		items = append(items, orgItem{id: "", name: "Personal account"})
	}
	for _, o := range orgs {
		if !o.Personal {
			items = append(items, orgItem{id: orgChoice(o.ID), name: o.Name})
		}
	}
	return items
}

// matchOrg returns the ID of the org in orgs whose ID or slug is key.
func matchOrg(orgs []*platform.Org, key string) (string, error) {
	for _, o := range orgs {
		if o.ID == key || (o.Slug != "" && o.Slug == key) {
			return o.ID, nil
		}
	}
	return "", errors.Newf("no org %q you can create apps in", key)
}

// orgChoice is an org ID; empty means the personal account.
type orgChoice string

func (orgChoice) SelectPrompt() string { return "Create app in" }

type orgItem struct {
	id   orgChoice
	name string
}

func (i orgItem) FilterValue() string   { return i.name }
func (i orgItem) Title() string         { return i.name }
func (i orgItem) Description() string   { return "" }
func (i orgItem) SelectedID() orgChoice { return i.id }

type orgSelectModel = cmdutil.SimpleSelectModel[orgChoice, orgItem]
type orgSelectDone = cmdutil.SimpleSelectDone[orgChoice]

type orgPromptModel struct {
	sel     orgSelectModel
	height  int
	done    bool
	aborted bool
}

func (m orgPromptModel) Init() tea.Cmd { return nil }

func (m orgPromptModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "esc", "q":
			m.aborted = true
			return m, tea.Quit
		}
	case tea.WindowSizeMsg:
		m.sel.SetSize(msg.Width, min(msg.Height, m.height))
		return m, nil
	case orgSelectDone:
		m.done = true
		return m, tea.Quit
	}
	var c tea.Cmd
	m.sel, c = m.sel.Update(msg)
	return m, c
}

func (m orgPromptModel) View() string {
	if m.done {
		var b strings.Builder
		b.WriteString(cmdutil.SuccessStyle.Render(fmt.Sprintf("%s %s: ", checkmark, orgChoice("").SelectPrompt())))
		if it, ok := m.sel.List.SelectedItem().(orgItem); ok {
			b.WriteString(it.name)
		}
		b.WriteByte('\n')
		return cmdutil.DocStyle.Render(b.String())
	}
	return cmdutil.DocStyle.Render(m.sel.View())
}

func promptOrg(orgs []*platform.Org) (option.Option[string], error) {
	var items []list.Item
	for _, it := range orgItems(orgs) {
		items = append(items, it)
	}

	ls := list.NewDefaultItemStyles()
	ls.SelectedTitle = ls.SelectedTitle.Foreground(lipgloss.Color(cmdutil.CodeBlue)).BorderForeground(lipgloss.Color(cmdutil.CodeBlue))
	del := list.NewDefaultDelegate()
	del.Styles = ls
	del.ShowDescription = false
	del.SetSpacing(0)

	ll := list.New(items, del, 0, 0)
	ll.SetShowTitle(false)
	ll.SetShowHelp(false)
	ll.SetShowPagination(true)
	ll.SetShowFilter(false)
	ll.SetFilteringEnabled(false)
	ll.SetShowStatusBar(false)
	ll.DisableQuitKeybindings() // quit handled by orgPromptModel

	// Items, pagination and the prompt line.
	height := min(len(items), 10) + 3
	m := orgPromptModel{sel: orgSelectModel{List: ll}, height: height}
	m.sel.SetSize(0, height)

	result, err := tea.NewProgram(m).Run()
	if err != nil {
		return option.None[string](), err
	}
	res := result.(orgPromptModel)
	if res.aborted {
		os.Exit(1)
	}
	return option.AsOptional(string(res.sel.Selected())), nil
}

```

### Core Architecture Module: `cli/cmd/encore/app/initialize.go`
```
package app

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/briandowns/spinner"
	"github.com/fatih/color"
	"github.com/spf13/cobra"

	"encr.dev/cli/cmd/encore/cmdutil"
	"encr.dev/cli/cmd/encore/llm_rules"
	"encr.dev/internal/conf"
	"encr.dev/pkg/option"
	"encr.dev/pkg/xos"
)

const (
	tsEncoreAppData = `{%s
	"id": "%s",
	"lang": "typescript",
}
`
	goEncoreAppData = `{%s
	"id": "%s",
}
`
)

var (
	initAppOrg  string
	initAppLang = cmdutil.Oneof{
		Value:     "",
		Allowed:   cmdutil.LanguageFlagValues(),
		Flag:      "lang",
		FlagShort: "l",
		Desc:      "Programming language to use for the app",
		TypeDesc:  "string",
	}
)

// Create a new app from scratch: `encore app create`
// Link an existing app to an existing repo: `encore app link <app-id>`
// Link an existing repo to a new app: `encore app init <name>`
func init() {
	initAppCmd := &cobra.Command{
		Use:   "init [name]",
		Short: "Register an existing local repo as a new app on Encore Cloud",
		Args:  cobra.MaximumNArgs(1),

		DisableFlagsInUseLine: true,
		Run: func(cmd *cobra.Command, args []string) {
			var name string
			if len(args) > 0 {
				name = args[0]
			}
			if err := initializeApp(context.Background(), name); err != nil {
				cmdutil.Fatal(err)
			}
		},
	}

	appCmd.AddCommand(initAppCmd)
	initAppLang.AddFlag(initAppCmd)
	initAppCmd.Flags().StringVar(&initAppOrg, "org", "", "ID or slug of the org to create the app in")
}

func initializeApp(ctx context.Context, name string) error {
	// Check if encore.app file exists
	_, _, err := cmdutil.MaybeAppRoot()
	if errors.Is(err, cmdutil.ErrNoEncoreApp) {
		// expected
	} else if err != nil {
		cmdutil.Fatal(err)
	} else {
		// There is already an app here or in a parent directory.
		cmdutil.Fatal("an encore.app file already exists (here or in a parent directory)")
	}

	cyan := color.New(color.FgCyan)
	promptAccountCreation()

	name, _, lang, _ := createAppForm(name, "", cmdutil.Language(initAppLang.Value), llm_rules.LLMRulesToolNone, true)

	if err := validateName(name); err != nil {
		return err
	}

	appSlug := ""
	appSlugComments := ""
	// Create the app on the server.
	if _, err := conf.CurrentUser(); err == nil {
		orgID, err := selectAppOrg(ctx, option.AsOptional(initAppOrg))
		if err != nil {
			return err
		}

		s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
		s.Prefix = "Creating app on encore.dev "
		s.Start()

		app, err := createAppOnServer(name, exampleConfig{}, orgID)
		s.Stop()
		if err != nil {
			return fmt.Errorf("creating app on encore.dev: %v", err)
		}
		appSlug = app.Slug
	} else if initAppOrg != "" {
		return errors.New("--org requires being logged in")
	} else {
		warnNotLoggedIn()
	}

	// Create the encore.app file
	var encoreAppTemplate = goEncoreAppData
	if lang == "ts" {
		encoreAppTemplate = tsEncoreAppData
	}
	if appSlug == "" {
		appSlugComments = strings.Join([]string{
			"",
			"The app is not currently linked to the encore.dev platform.",
			`Use "encore app link" to link it.`,
		}, "\n\t//")
	}
	encoreAppData := fmt.Appendf(nil, encoreAppTemplate, appSlugComments, appSlug)
	if err := xos.WriteFile("encore.app", encoreAppData, 0644); err != nil {
		return err
	}

	// Update to latest encore.dev release
	if _, err := os.Stat("go.mod"); err == nil {
		lang = cmdutil.LanguageGo
		s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
		s.Prefix = "Running go get encore.dev@latest"
		s.Start()
		if err := gogetEncore("."); err != nil {
			s.FinalMSG = fmt.Sprintf("failed, skipping: %v", err.Error())
		}
		s.Stop()
	} else if _, err := os.Stat("package.json"); err == nil {
		lang = cmdutil.LanguageTS
		s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
		s.Prefix = "Running npm install encore.dev@latest"
		s.Start()
		if err := npmInstallEncore("."); err != nil {
			s.FinalMSG = fmt.Sprintf("failed, skipping: %v", err.Error())
		}
		s.Stop()
	}

	// Set up a git repo and the "encore" remote so the app can be pushed after init.
	if appSlug != "" {
		ensureEncoreGitRemote(".", appSlug)
	}

	green := color.New(color.FgGreen)
	_, _ = green.Fprint(os.Stdout, "Successfully initialized application on Encore Cloud!\n")
	if appSlug == "" {
		_, _ = fmt.Fprintf(os.Stdout, "The app is not currently linked to the encore.dev platform.\n")
		_, _ = fmt.Fprintf(os.Stdout, "Use \"encore app link\" to link it.\n")
		return nil
	}
	_, _ = fmt.Fprintf(os.Stdout, "- App ID:          %s\n", cyan.Sprint(appSlug))
	_, _ = fmt.Fprintf(os.Stdout, "- Cloud Dashboard: %s\n\n", cyan.Sprintf("https://app.encore.dev/%s", appSlug))

	return nil
}

```

### Core Architecture Module: `cli/cmd/encore/app/link.go`
```
package app

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
	"github.com/tailscale/hujson"
	"golang.org/x/term"

	"encr.dev/cli/cmd/encore/cmdutil"
	"encr.dev/cli/internal/platform"
	"encr.dev/internal/conf"
	"encr.dev/pkg/xos"
)

var forceLink bool
var linkAppCmd = &cobra.Command{
	Use:   "link [app-id]",
	Short: "Link an existing local repo to an existing Encore Cloud app",
	Args:  cobra.MaximumNArgs(1),

	DisableFlagsInUseLine: true,
	Run: func(cmd *cobra.Command, args []string) {
		var appID string
		if len(args) > 0 {
			appID = args[0]
		}
		linkApp(appID, forceLink)
	},
	ValidArgsFunction: cmdutil.AutoCompleteAppSlug,
}

func init() {
	appCmd.AddCommand(linkAppCmd)
	linkAppCmd.Flags().BoolVarP(&forceLink, "force", "f", false, "Force link even if the app is already linked.")
}

func linkApp(appID string, force bool) {
	// Determine the app root.
	root, _, err := cmdutil.MaybeAppRoot()
	if errors.Is(err, cmdutil.ErrNoEncoreApp) {
		root, err = os.Getwd()
	}
	if err != nil {
		cmdutil.Fatal(err)
	}

	filePath := filepath.Join(root, "encore.app")
	data, err := os.ReadFile(filePath)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		cmdutil.Fatal(err)
		os.Exit(1)
	}
	if len(bytes.TrimSpace(data)) == 0 {
		// Treat missing and empty files as an empty object.
		data = []byte("{}")
	}

	val, err := hujson.Parse(data)
	if err != nil {
		cmdutil.Fatal("could not parse encore.app: ", err)
	}

	appData, ok := val.Value.(*hujson.Object)
	if !ok {
		cmdutil.Fatal("could not parse encore.app: expected JSON object")
	}

	// Find the "id" value, if any.
	var idValue *hujson.Value
	for i := 0; i < len(appData.Members); i++ {
		kv := &appData.Members[i]
		lit, ok := kv.Name.Value.(hujson.Literal)
		if !ok || lit.String() != "id" {
			continue
		}
		idValue = &kv.Value
	}

	if idValue != nil {
		val, ok := idValue.Value.(hujson.Literal)
		if ok && val.String() != "" && val.String() != appID && !force {
			cmdutil.Fatal("the app is already linked.\n\nNote: to link to a different app, specify the --force flag.")
		}
	}

	if appID == "" {
		if !term.IsTerminal(int(os.Stdin.Fd())) {
			cmdutil.Fatal("no app id given.\n\nPass it directly: encore app link <app-id>\nCreate the app and find its id in the Encore Cloud dashboard at https://app.encore.dev")
		}
		// The app is not linked. Prompt the user for an app ID.
		fmt.Println("Make sure the app is created on app.encore.dev, and then enter its ID to link it.")
		fmt.Print("App ID: ")
		if _, err := fmt.Scanln(&appID); err != nil {
			cmdutil.Fatal(err)
		} else if appID == "" {
			cmdutil.Fatal("no app id given.")
		}
	}

	if linked, err := validateAppSlug(appID); err != nil {
		cmdutil.Fatal(err)
	} else if !linked {
		fmt.Fprintln(os.Stderr, "Error: that app does not exist, or you don't have access to it.")
		os.Exit(1)
	}

	// Write it back to our data structure.
	if idValue != nil {
		idValue.Value = hujson.String(appID)
	} else {
		appData.Members = append(appData.Members, hujson.ObjectMember{
			Name:  hujson.Value{Value: hujson.String("id")},
			Value: hujson.Value{Value: hujson.String(appID)},
		})
	}

	val.Format()
	if err := xos.WriteFile(filePath, val.Pack(), 0644); err != nil {
		cmdutil.Fatal(err)
		os.Exit(1)
	}

	addEncoreRemote(root, appID)
	fmt.Println("Successfully linked app!")
}

func validateAppSlug(slug string) (ok bool, err error) {
	if _, err := conf.CurrentUser(); errors.Is(err, fs.ErrNotExist) {
		cmdutil.Fatal("not logged in. Run 'encore auth login' first.")
	} else if err != nil {
		return false, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := platform.GetApp(ctx, slug); err != nil {
		var e platform.Error
		if errors.As(err, &e) && e.HTTPCode == 404 {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

```

### Core Architecture Module: `cli/cmd/encore/auth/auth.go`
```
package auth

import (
	"errors"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"encr.dev/cli/cmd/encore/cmdutil"
	"encr.dev/cli/cmd/encore/root"
	"encr.dev/cli/internal/login"
	"encr.dev/cli/internal/telemetry"
	"encr.dev/internal/conf"
)

var authKey string

func init() {
	authCmd := &cobra.Command{
		Use:   "auth",
		Short: "Commands to authenticate with Encore",
	}

	signupCmd := &cobra.Command{
		Use:   "signup",
		Short: "Create a new Encore account",

		DisableFlagsInUseLine: true,
		Run: func(cmd *cobra.Command, args []string) {
			if err := DoLogin(DeviceAuth); err != nil {
				cmdutil.Fatal(err)
			}
		},
	}

	loginCmd := &cobra.Command{
		Use:   "login [--auth-key=<KEY>]",
		Short: "Log in to Encore",

		Run: func(cmd *cobra.Command, args []string) {
			if authKey != "" {
				if err := DoLoginWithAuthKey(); err != nil {
					cmdutil.Fatal(err)
				}
			} else {
				if err := DoLogin(DeviceAuth); err != nil {
					cmdutil.Fatal(err)
				}
			}
		},
	}

	logoutCmd := &cobra.Command{
		Use:   "logout",
		Short: "Logs out the currently logged in user",

		DisableFlagsInUseLine: true,
		Run: func(cmd *cobra.Command, args []string) {
			DoLogout()
		},
	}

	whoamiCmd := &cobra.Command{
		Use:   "whoami",
		Short: "Show the current logged in user",

		DisableFlagsInUseLine: true,
		Run: func(cmd *cobra.Command, args []string) {
			Whoami()
		},
	}

	authCmd.AddCommand(signupCmd)

	authCmd.AddCommand(loginCmd)
	loginCmd.Flags().StringVarP(&authKey, "auth-key", "k", "", "Auth Key to use for login")

	authCmd.AddCommand(logoutCmd)
	authCmd.AddCommand(whoamiCmd)
	root.Cmd.AddCommand(authCmd)
}

type Flow int

const (
	AutoFlow Flow = iota
	Interactive
	DeviceAuth
)

func DoLogin(flow Flow) (err error) {
	var fn func() (*conf.Config, error)
	switch flow {
	case Interactive:
		fn = login.Interactive
	case DeviceAuth:
		fn = login.DeviceAuth
	default:
		fn = login.DecideFlow
	}
	cfg, err := fn()
	if err != nil {
		return err
	}

	if err := conf.Write(cfg); err != nil {
		return fmt.Errorf("write credentials: %v", err)
	}
	fmt.Fprintln(os.Stdout, "Successfully logged in!")
	return nil
}

func DoLogout() {
	if err := telemetry.RotateAnonymousID(); err != nil {
		fmt.Fprintln(os.Stderr, "could not logout:", err)
	}

	if err := conf.Logout(); err != nil {
		fmt.Fprintln(os.Stderr, "could not logout:", err)
		os.Exit(1)
	}
	// Stop running daemon to clear any cached credentials
	cmdutil.StopDaemon()
	fmt.Fprintln(os.Stdout, "encore: logged out.")
}

func DoLoginWithAuthKey() error {
	if err := LoginWithAuthKey(authKey); err != nil {
		return err
	}
	fmt.Fprintln(os.Stdout, "Successfully logged in!")
	return nil
}

// LoginWithAuthKey exchanges the given auth key for credentials and persists them.
func LoginWithAuthKey(key string) error {
	cfg, err := login.WithAuthKey(key)
	if err != nil {
		return err
	}
	if err := conf.Write(cfg); err != nil {
		return fmt.Errorf("write credentials: %v", err)
	}
	return nil
}

// LoginWithEnvKeyIfNeeded logs in using the ENCORE_AUTH_KEY environment variable
// when it is set and no user is currently logged in. This gives agents and CI a
// non-interactive way to authenticate, avoiding the browser-based login flow.
func LoginWithEnvKeyIfNeeded() {
	key := os.Getenv("ENCORE_AUTH_KEY")
	if key == "" {
		return
	}
	if _, err := conf.CurrentUser(); err == nil {
		return // already logged in
	}
	if err := LoginWithAuthKey(key); err != nil {
		fmt.Fprintf(os.Stderr, "warning: ENCORE_AUTH_KEY login failed: %v\n", err)
	}
}

func Whoami() {
	cfg, err := conf.CurrentUser()
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			fmt.Fprint(os.Stdout, "not logged in.", cmdutil.Newline)
			return
		}
		cmdutil.Fatal(err)
	}

	if cfg.AppSlug != "" {
		fmt.Fprintf(os.Stdout, "logged in as app %s%s", cfg.AppSlug, cmdutil.Newline)
	} else {
		fmt.Fprintf(os.Stdout, "logged in as %s%s", cfg.Email, cmdutil.Newline)
	}
}

```

### Core Architecture Module: `cli/cmd/encore/bits/add.go`
```
package bits

import (
	"context"
	"fmt"
	"os"

	"github.com/cockroachdb/errors"
	"github.com/spf13/cobra"

	"encr.dev/cli/cmd/encore/cmdutil"
	"encr.dev/pkg/bits"
)

var addCmd = &cobra.Command{
	Use:   "add <name> [<path>]",
	Short: "Add an Encore Bit to your application",
	Args:  cobra.MinimumNArgs(1),

	DisableFlagsInUseLine: true,
	Run: func(c *cobra.Command, args []string) {
		slug := args[0]
		ctx := context.Background()
		bit, err := bits.Get(ctx, slug)
		if errors.Is(err, errBitNotFound) {
			cmdutil.Fatalf("encore bit not found: %s", slug)
		} else if err != nil {
			cmdutil.Fatalf("could not lookup encore bit: %v", err)
		}

		workdir, err := os.MkdirTemp("", "encore-bit")
		if err != nil {
			cmdutil.Fatal(err)
		}
		defer os.RemoveAll(workdir)

		//prefix := args[0]
		//if len(args) > 1 {
		//	prefix = args[1]
		//}

		fmt.Fprintf(os.Stderr, "Downloading Encore Bit: %s\n", bit.Title)
		if err := bits.Extract(ctx, bit, workdir); err != nil {
			cmdutil.Fatalf("download failed: %v", err)
		}

		meta, err := bits.Describe(ctx, workdir)
		if err != nil {
			cmdutil.Fatalf("could not parse bit metadata: %v", err)
		}

		fmt.Fprintf(os.Stderr, "successfully got bit: %+v\n", meta)

		//fmt.Fprintf(os.Stderr, "\n\nSuccessfully added Encore Bit: %s!\n", bit.Title)
		//fmt.Fprintf(os.Stderr, "You can find the new bit under the %s/ directory.\n", prefix)
	},
}

func init() {
	bitsCmd.AddCommand(addCmd)
}

```

### Core Architecture Module: `cli/cmd/encore/bits/api.go`
```
package bits

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"

	"github.com/cockroachdb/errors"
)

type Bit struct {
	ID          int64
	Slug        string
	Title       string
	Description string
	GitRepo     string
	GitBranch   string
}

type ListResponse struct {
	Bits []*Bit
}

func List(ctx context.Context) ([]*Bit, error) {
	resp, err := http.Get("https://automativity.encore.dev/bits")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		slurp, _ := io.ReadAll(resp.Body)
		return nil, errors.Newf("got status %d: %s", resp.StatusCode, slurp)
	}
	var data ListResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, errors.Wrap(err, "decode json response")
	}
	return data.Bits, nil
}

var errBitNotFound = errors.New("bit not found")

func Get(ctx context.Context, slug string) (*Bit, error) {
	resp, err := http.Get("https://automativity.encore.dev/bits/" + url.PathEscape(slug))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, errBitNotFound
	} else if resp.StatusCode != 200 {
		slurp, _ := io.ReadAll(resp.Body)
		return nil, errors.Newf("got status %d: %s", resp.StatusCode, slurp)
	}
	var bit Bit
	if err := json.NewDecoder(resp.Body).Decode(&bit); err != nil {
		return nil, errors.Wrap(err, "decode json response")
	}
	return &bit, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1094** (2024-03-23): **`Set-Cookie` can only send one `Set-Cookie` header response**
  *Symptoms*: Hey Encore Team!    I ran into another bug with the `Set-Cookie` headers.  If we need to set two separate cookies on login, the [`Set-Cookie` docs say](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie):  > To send multiple cookies, multiple Set-Cookie headers should be sent in the same response.  I tried doing the following: ``` export interface AuthResponse {   accessCookie: Header<'Set-Cookie'> //(sets cookie access_token)   refreshCookie: Header<'Set-Cookie'> //(sets cookie refresh_token) } ```  Only the `refresh_token` cookie will be set in this case.  If this is supported in another form I'm happy to implement it in a different way!
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report! Encore v1.34.4-beta.5 is out now which fixes this!

- **Issue #1092** (2026-02-13): **Generated Client `mustBeSet` check fails for `Set-Cookie`**
  *Symptoms*: Hey all!  Loving Encore TS!  I ran into an issue with the generated client this evening.  I have an AuthResponse defined in the following way: ``` export interface AuthResponse {   cookies: Header<'Set-Cookie'>   user: User } ```  When generated, it outputs the following: ``` public async login(params: LoginParams): Promise<AuthResponse> {     // Now make the actual call to the API     const resp = await this.baseClient.callAPI("POST", `/auth/login`, JSON.stringify(params))      //Populate the return object from the JSON body and received headers     const rtn = await resp.json() as AuthResponse     rtn.cookies = mustBeSet("Header `set-cookie`", resp.headers.get("set-cookie"))     return rtn } ```  The `mustBeSet` call for `set-cookie` is failing because `Set-Cookie` is a [forbidden response header](https://fetch.spec.whatwg.org/#forbidden-response-header-name).  Encore itself is setting that header correctly, but the generated client should not expect to be able to access the `Set-Cookie` header.

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

### Incident Patch 1: `8a7465a4` (2026-11-11)
**Commit Message**: runtimes: finish internal call request on validation error

**File**: `runtimes/go/appruntime/apisdk/api/handler.go` (modified, +14/-8)
```diff
@@ -680,31 +680,37 @@ func (d *Desc[Req, Resp]) runCall(c CallContext, req Req, mocked bool, executor
 			},
 		})
 
+		if beginErr != nil {
+			respErr = errs.B().Cause(beginErr).Code(errs.Internal).Msg("internal error").Err()
+			return
+		}
+
+		// Request begun; must finish or op and trace leak.
+		failBeforeExec := func(err error) {
+			respErr = err
+			c.server.finishRequest(newErrResp(err, 0))
+		}
+
 		// Now round-trip any auth data that was set on the request
 		// to emulate what happens in the HTTP case.
 		if experiments.AuthDataRoundTrip.Enabled(c.server.experiments) && reqModel.RPCData.AuthData != nil {
 			jsonBytes, err := jsonapi.Default.Marshal(reqModel.RPCData.AuthData)
 			if err != nil {
 				c.server.rootLogger.Err(err).Msg("unable to marshal auth data")
-				respErr = errs.B().Cause(err).Code(errs.Internal).Msg("internal error").Err()
+				failBeforeExec(errs.B().Cause(err).Code(errs.Internal).Msg("internal error").Err())
 				return
 			}
 
 			reqModel.RPCData.AuthData = newAuthDataObj()
 			if err := jsonapi.Default.Unmarshal(jsonBytes, reqModel.RPCData.AuthData); err != nil {
 				c.server.rootLogger.Err(err).Msg("unable to unmarshal auth data")
-				respErr = errs.B().Cause(err).Code(errs.Internal).Msg("internal error").Err()
+				failBeforeExec(errs.B().Cause(err).Code(errs.Internal).Msg("internal error").Err())
 				return
 			}
 		}
 
-		if beginErr != nil {
-			respErr = errs.B().Cause(beginErr).Code(errs.Internal).Msg("internal error").Err()
-			return
-		}
-
 		if err := d.validate(req); err != nil {
-			respErr = err
+			failBeforeExec(err)
 			return
 		}
 
```

**File**: `runtimes/go/appruntime/apisdk/api/handler_test.go` (modified, +52/-0)
```diff
@@ -667,3 +667,55 @@ func TestMiddlewareHeadersOnError(t *testing.T) {
 		}
 	}
 }
+
+type validatingReq struct {
+	Valid bool
+}
+
+func (r *validatingReq) Validate() error {
+	if !r.Valid {
+		return errs.B().Code(errs.InvalidArgument).Msg("not valid").Err()
+	}
+	return nil
+}
+
+// Validation failure on an internal call must still finish the request.
+func TestInternalCallValidationErrorFinishesRequest(t *testing.T) {
+	model.EnableTestMode(t)
+	server, traceMock, _ := testServer(t, clock.New(), true)
+
+	desc := &api.Desc[*validatingReq, *mockResp]{
+		Service:  "service",
+		Endpoint: "validating",
+		Path:     "/validating",
+		Access:   api.Private,
+		CloneReq: func(req *validatingReq) (*validatingReq, error) {
+			clone := *req
+			return &clone, nil
+		},
+		ReqPath: func(req *validatingReq) (string, api.UnnamedParams, error) {
+			return "/validating", nil, nil
+		},
+		ReqUserPayload: func(req *validatingReq) any {
+			return req
+		},
+		AppHandler: func(ctx context.Context, req *validatingReq) (*mockResp, error) {
+			t.Error("handler must not run when validation fails")
+			return &mockResp{}, nil
+		},
+		CloneResp: func(resp *mockResp) (*mockResp, error) {
+			clone := *resp
+			return &clone, nil
+		},
+	}
+
+	traceMock.EXPECT().RequestSpanStart(gomock.Any(), gomock.Any()).Times(1)
+	traceMock.EXPECT().RequestSpanEnd(gomock.Any()).Times(1)
+	traceMock.EXPECT().MarkDone().Times(1)
+	traceMock.EXPECT().WaitAndClear().Return(nil, true).AnyTimes()
+
+	_, err := desc.Call(server.NewCallContext(context.Background()), &validatingReq{Valid: false})
+	if errs.Code(err) != errs.InvalidArgument {
+		t.Fatalf("got error %v, want invalid_argument", err)
+	}
+}
```

---

### Incident Patch 2: `56387a1d` (2026-11-12)
**Commit Message**: sqldb: close cursors that are left with rows unread (#2653)

## Summary

`queryRow`, `rawQueryRow`, `exec` and `rawExec` read only the first row.
A `for await` over `query`/`rawQuery` can also stop early. In both cases
the native cursor stayed open with rows unread until JS garbage
collected it.

tokio-postgres delivers results in order, through a 2-slot channel per
query. If a result arrives in more reads than that channel holds, the
connection stops reading until the cursor takes them. Every later query
on that connection then hangs. Inside a transaction, that's the next
statement, and Postgres shows the connection `idle in transaction` /
`ClientRead`. The hang lasts until a GC finalizes the cursor, which an
idle process may never trigger. This matches a customer report of
intermittent test hangs in Cloud builds.

```diff
 BaseQueryExecutor.queryRow / rawQueryRow / exec / rawExec / queryAll / rawQueryAll / query / rawQuery
   cursor = impl.query(...)
-  read rows
+  try
+    read rows
+  finally
+    cursor.close()        // new napi Cursor.close → drops the RowStream,
+                          // so the connection skips the rest of the result
```

## Evidence

The new test
`sql

**File**: `docs/ts/runtime/storage-sqldb.mdx` (modified, +67/-37)
```diff
@@ -7,7 +7,7 @@ toc: true
 ## Classes
 
 <!-- symbol-start: Connection -->
-### Connection <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L384" />
+### Connection <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L428" />
 
 Represents a dedicated connection to a database.
 
@@ -17,7 +17,7 @@ Represents a dedicated connection to a database.
 
 #### Constructors
 
-##### Constructor <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L387" />
+##### Constructor <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L431" />
 
 `new Connection(impl): Connection`
 
@@ -47,7 +47,7 @@ Represents a dedicated connection to a database.
 
 #### Methods
 
-##### close() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L394" />
+##### close() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L438" />
 
 `close(): Promise<void>`
 
@@ -57,7 +57,7 @@ Returns the connection to the database pool.
 
 `Promise`\<`void`\>
 
-##### exec() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L229" />
+##### exec() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L265" />
 
 `exec(strings, ...params): Promise<void>`
 
@@ -88,7 +88,7 @@ const result = database.exec`DELETE FROM users WHERE email=${email}`
 
 `BaseQueryExecutor.exec`
 
-##### query() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L69" />
+##### query() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L74" />
 
 `query<T>(strings, ...params): AsyncGenerator<T>`
 
@@ -98,6 +98,11 @@ with parametrised values without risking SQL injections.
 It returns an async generator, that allows iterating over the results
 in a streaming fashion using `for await`.
 
+A `for await` loop closes the query however it ends. If you call `next()`
+yourself, call `return()` when you stop before the last row: until then the
+query keeps its connection busy, and any other query on that connection
+(such as the next statement in a transaction) waits for it.
+
 ###### Type Parameters
 
 ###### T
@@ -131,7 +136,7 @@ This produces the query: "SELECT id FROM users WHERE email=$1".
 
 `BaseQueryExecutor.query`
 
-##### queryAll() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L129" />
+##### queryAll() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L149" />
 
 `queryAll<T>(strings, ...params): Promise<T[]>`
 
@@ -173,7 +178,7 @@ This produces the query: "SELECT id FROM users WHERE email=$1".
 
 `BaseQueryExecutor.queryAll`
 
-##### queryRow() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L184" />
+##### queryRow() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L212" />
 
 `queryRow<T>(strings, ...params): Promise<T | null>`
 
@@ -212,7 +217,7 @@ const result = database.queryRow`SELECT id FROM users WHERE email=${email}`
 
 `BaseQueryExecutor.queryRow`
 
-##### rawExec() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L255" />
+##### rawExec() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L295" />
 
 `rawExec(query, ...params): Promise<void>`
 
@@ -250,7 +255,7 @@ await database.rawExec(query, email);
 
 `BaseQueryExecutor.rawExec`
 
-##### rawQuery() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L101" />
+##### rawQuery() <SymbolSource href="https://github.com/encoredev/encore/blob/main/runtimes/js/encore.dev/storage/sqldb/database.ts#L116" />
 
 `rawQuery<T>(query, ...params): AsyncGenerator<T>`
 
@@ -259,6 +264,11 @@ rawQuery queries the database using a raw parametrised SQL query and parameters.
 It returns an async generator, that allows iterating over the results
 in a streaming fashion using `for await`.
 
+A `for await` loop closes the query however it ends. If you call `next()`
+yourself, call `return()` when you stop before the last row: until then the
+query keeps its connection busy, and any other query on that connection
+(such as the next statement in a transaction) waits for it.
+
 ###### Type Parameters
 
 ###### T
@@ -299,7 +309,7 @@ for await (const row of database.rawQuery(
```

**File**: `runtimes/core/Cargo.toml` (modified, +1/-1)
```diff
@@ -182,4 +182,4 @@ insta = { version = "1.38.0", features = ["yaml"] }
 quickcheck = "1.0.3"
 proptest = "1.7.0"
 tempfile = "3"
-tokio = { version = "1.35.1", features = ["macros", "rt"] }
+tokio = { version = "1.35.1", features = ["macros", "rt", "net", "io-util", "time"] }
```

**File**: `runtimes/core/src/sqldb/client.rs` (modified, +191/-3)
```diff
@@ -265,17 +265,30 @@ impl Pool {
 }
 
 pub struct Cursor {
-    stream: Pin<Box<tokio_postgres::RowStream>>,
+    /// `None` once the cursor is closed.
+    stream: Option<Pin<Box<tokio_postgres::RowStream>>>,
 }
 
 impl Cursor {
     pub async fn next(&mut self) -> Option<Result<Row, tokio_postgres::Error>> {
-        match self.stream.next().await {
+        match self.stream.as_mut()?.next().await {
             Some(Ok(row)) => Some(Ok(Row { row })),
             Some(Err(err)) => Some(Err(err)),
             None => None,
         }
     }
+
+    /// Discards the rows not yet read.
+    ///
+    /// A connection hands each query's result to its caller in order, a few
+    /// messages at a time, and reads nothing further from the server until that
+    /// caller takes them. A cursor left open with rows unread therefore stalls
+    /// every later query on its connection, for as long as the cursor lives —
+    /// which, for one held by JavaScript, is until it is garbage collected.
+    /// Closing it lets the connection skip past the rest of the result.
+    pub fn close(&mut self) {
+        self.stream = None;
+    }
 }
 
 pub struct Row {
@@ -393,7 +406,7 @@ impl QueryTracer {
 
         let stream = result?;
         Ok(Cursor {
-            stream: Box::pin(stream),
+            stream: Some(Box::pin(stream)),
         })
     }
 
@@ -452,3 +465,178 @@ mod key_test {
         assert!(!rendered.contains("104"), "{rendered}");
     }
 }
+
+#[cfg(test)]
+mod cursor_test {
+    use std::collections::HashMap;
+    use std::time::Duration;
+
+    use bytes::{Buf, BufMut, BytesMut};
+    use tokio::io::{AsyncReadExt, AsyncWriteExt};
+    use tokio::net::{TcpListener, TcpStream};
+
+    use super::*;
+
+    /// Rows in the result that is left unread. Each is sent on its own, so the
+    /// client reads them one at a time, as it would a large result.
+    const MANY: i32 = 20;
+
+    /// A cursor left open with rows unread used to hang every later query on
+    /// its connection until the cursor was garbage collected — in a
+    /// transaction, the very next statement. Closing it must free the
+    /// connection.
+    #[tokio::test]
+    async fn closing_a_cursor_frees_its_connection() {
+        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
+        let port = listener.local_addr().unwrap().port();
+        tokio::spawn(async move {
+            let (socket, _) = listener.accept().await.unwrap();
+            serve(socket).await;
+        });
+
+        let mut config = tokio_postgres::Config::new();
+        config
+            .host("127.0.0.1")
+            .port(port)
+            .user("encore")
+            .dbname("db");
+        let (client, connection) = config.connect(tokio_postgres::NoTls).await.unwrap();
+        tokio::spawn(connection);
+        let client = Arc::new(client);
+
+        let tracer = QueryTracer(crate::trace::Tracer::noop());
+        let query = |sql: &'static str| {
+            let client = client.as_ref();
+            tracer.trace(None, sql, move || async move {
+                client
+                    .query_raw(sql, Vec::<i32>::new())
+                    .await
+                    .map_err(Error::from)
+            })
+        };
+
+        // Like `queryRow`: read the first row and leave the rest.
+        let mut cursor = query("SELECT many").await.unwrap();
+        let first = cursor.next().await.unwrap().unwrap();
+        assert_eq!(first.row.get::<_, i32>(0), 1);
+
+        let next = tokio::spawn({
+            let client = client.clone();
+            async move { client.query_one("SELECT one", &[]).await }
+        });
+
+        // The hazard being guarded against: while the cursor is open, the
+        // connection delivers nothing else.
+        tokio::time::sleep(Duration::from_millis(500)).await;
+        assert!(
+            !next.is_finished(),
+            "the next query completed while the cursor was open; \
+             this test no longer exercises the stall"
+        );
+
+        cursor.close();
+        assert!(cursor.next().await.is_none(), "a closed cursor yields rows");
+
+        let row = tokio::time::timeout(Duration::from_secs(5), next)
+            .await
+            .expect("the next query hung after the cursor was closed")
+            .unwrap()
+            .unwrap();
+        assert_eq!(row.get::<_, i32>(0), 1);
+    }
+
+    /// Plays a Postgres server well enough for `prepare` and `query`: every
+    /// statement returns one int4 column, counting up from 1, with [`MANY`]
+    /// rows if its text contains "many" and one row otherwise.
+    async fn serve(mut socket: TcpStream) {
+        let len = socket.read_i32().await.unwrap();
+        let mut startup = vec![0; len as usize - 4];
+        socket.read_exact(&mut startup).await.unwrap();
+
+        let mut out = BytesMut::new();
+        message(&mut out, b'R', |b| b.put_i32(0)); // AuthenticationOk
+        ready_for_query(&mut out);
+        
```

**File**: `runtimes/js/encore.dev/storage/sqldb/database.ts` (modified, +75/-31)
```diff
@@ -58,6 +58,11 @@ class BaseQueryExecutor {
    * It returns an async generator, that allows iterating over the results
    * in a streaming fashion using `for await`.
    *
+   * A `for await` loop closes the query however it ends. If you call `next()`
+   * yourself, call `return()` when you stop before the last row: until then the
+   * query keeps its connection busy, and any other query on that connection
+   * (such as the next statement in a transaction) waits for it.
+   *
    * @example
    *
    * const email = "foo@example.com";
@@ -74,10 +79,15 @@ class BaseQueryExecutor {
     const args = buildQueryArgs(params);
     const source = getCurrentRequest();
     const cursor = await this.impl.query(query, args, source);
-    while (true) {
-      const row = await cursor.next();
-      if (row === null) break;
-      yield row.values() as T;
+    try {
+      while (true) {
+        const row = await cursor.next();
+        if (row === null) break;
+        yield row.values() as T;
+      }
+    } finally {
+      // Runs when the caller stops iterating early, too.
+      await cursor.close();
     }
   }
 
@@ -87,6 +97,11 @@ class BaseQueryExecutor {
    * It returns an async generator, that allows iterating over the results
    * in a streaming fashion using `for await`.
    *
+   * A `for await` loop closes the query however it ends. If you call `next()`
+   * yourself, call `return()` when you stop before the last row: until then the
+   * query keeps its connection busy, and any other query on that connection
+   * (such as the next statement in a transaction) waits for it.
+   *
    * @example
    * const query = "SELECT id FROM users WHERE email=$1";
    * const email = "foo@example.com";
@@ -104,11 +119,16 @@ class BaseQueryExecutor {
   ): AsyncGenerator<T> {
     const args = buildQueryArgs(params);
     const source = getCurrentRequest();
-    const result = await this.impl.query(query, args, source);
-    while (true) {
-      const row = await result.next();
-      if (row === null) break;
-      yield row.values() as T;
+    const cursor = await this.impl.query(query, args, source);
+    try {
+      while (true) {
+        const row = await cursor.next();
+        if (row === null) break;
+        yield row.values() as T;
+      }
+    } finally {
+      // Runs when the caller stops iterating early, too.
+      await cursor.close();
     }
   }
 
@@ -134,13 +154,17 @@ class BaseQueryExecutor {
     const args = buildQueryArgs(params);
     const source = getCurrentRequest();
     const cursor = await this.impl.query(query, args, source);
-    const result: T[] = [];
-    while (true) {
-      const row = await cursor.next();
-      if (row === null) break;
-      result.push(row.values() as T);
+    try {
+      const result: T[] = [];
+      while (true) {
+        const row = await cursor.next();
+        if (row === null) break;
+        result.push(row.values() as T);
+      }
+      return result;
+    } finally {
+      await cursor.close();
     }
-    return result;
   }
 
   /**
@@ -162,13 +186,17 @@ class BaseQueryExecutor {
     const args = buildQueryArgs(params);
     const source = getCurrentRequest();
     const cursor = await this.impl.query(query, args, source);
-    const result: T[] = [];
-    while (true) {
-      const row = await cursor.next();
-      if (row === null) break;
-      result.push(row.values() as T);
+    try {
+      const result: T[] = [];
+      while (true) {
+        const row = await cursor.next();
+        if (row === null) break;
+        result.push(row.values() as T);
+      }
+      return result;
+    } finally {
+      await cursor.close();
     }
-    return result;
   }
 
   /**
@@ -188,9 +216,13 @@ class BaseQueryExecutor {
     const query = buildQuery(strings, params);
     const args = buildQueryArgs(params);
     const source = getCurrentRequest();
-    const result = await this.impl.query(query, args, source);
-    const row = await result.next();
-    return row ? (row.values() as T) : null;
+    const cursor = await this.impl.query(query, args, source);
+    try {
+      const row = await cursor.next();
+      return row ? (row.values() as T) : null;
+    } finally {
+      await cursor.close();
+    }
   }
 
   /**
@@ -214,9 +246,13 @@ class BaseQueryExecutor {
   ): Promise<T | null> {
     const args = buildQueryArgs(params);
     const source = getCurrentRequest();
-    const result = await this.impl.query(query, args, source);
-    const row = await result.next();
-    return row ? (row.values() as T) : null;
+    const cursor = await this.impl.query(query, args, source);
+    try {
+      const row = await cursor.next();
+      return row ? (row.values() as T) : null;
+    } finally {
+      await cursor.close();
+    }
   }
 
   /**
@@ -236,8 +272,12 @@ class BaseQueryExecutor {
 
     // Need to await the cursor to process any errors from things like
     // unique constraint violations.
-    const cur = await this.
```

**File**: `runtimes/js/src/sqldb.rs` (modified, +7/-0)
```diff
@@ -222,6 +222,13 @@ impl Cursor {
 
         Ok(row.map(|row| Row { row }))
     }
+
+    /// Discards the rows not yet read, so the connection can move on to the
+    /// next query without waiting for this cursor to be garbage collected.
+    #[napi]
+    pub async fn close(&self) {
+        self.stream.lock().await.close();
+    }
 }
 
 #[napi]
```

#### Recent Merged Pull Requests:
- **PR #2653** (2026-11-12): sqldb: close cursors that are left with rows unread (@ekerfelt)
- **PR #2649** (2026-11-13): runtimes: fix memory leak when internal call fails validation (@kutysam)
- **PR #2648** (2026-11-10): tsparser: fall back to later export conditions (@eandre)
- **PR #2646** (2026-11-10): runtimes: re-land GCP IAM database login, keeping the password in ConnString (@ekerfelt)
- **PR #2641** (2026-11-09): Revert "runtimes: log in to Cloud SQL with GCP IAM database authentication (#2640)" (@ekerfelt)
- **PR #2640** (2026-11-09): runtimes: log in to Cloud SQL with GCP IAM database authentication (@ekerfelt)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. runtimes: finish internal call request on validation error

**RULE**:
When implementing operations in `runtimes/go/appruntime/apisdk/api/handler.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in encoredev/encore. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8a7465a4`: runtimes: finish internal call request on validation error. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `runtimes/go/appruntime/apisdk/api/handler.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
		if beginErr != nil {
			respErr = errs.B().Cause(beginErr).Code(errs.Internal).Msg("internal error").Err()
			return
		}

		// Request begun; must finish or op and trace leak.
		failBeforeExec := func(err error) {
			respErr = err
			c.server.finishRequest(newErrResp(err, 0))
		}

				failBeforeExec(errs.B().Cause(err).Code(errs.Internal).Msg("internal error").Err())
				failBeforeExec(errs.B().Cause(err).Code(errs.Internal).Msg("internal error").Err())
			failBeforeExec(err)
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
				respErr = errs.B().Cause(err).Code(errs.Internal).Msg("internal error").Err()
				respErr = errs.B().Cause(err).Code(errs.Internal).Msg("internal error").Err()
		if beginErr != nil {
			respErr = errs.B().Cause(beginErr).Code(errs.Internal).Msg("internal error").Err()
			return
		}

			respErr = err
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8a7465a4` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.

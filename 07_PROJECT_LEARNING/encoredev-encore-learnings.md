> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/encoredev-encore-learnings.md`  
> **Source**: github ([https://github.com/encoredev/encore](https://github.com/encoredev/encore))  
> **Source Version**: `12053961`  
> **License**: MPL-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T23:12:02.748Z  
> **Learning ID**: `learn-github-encoredev-encore`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): encoredev/encore

> **Canonical Artifact**: `07_PROJECT_LEARNING/encoredev-encore-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/encoredev/encore](https://github.com/encoredev/encore))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-06T23:12:02.601Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `encoredev/encore`
- **Description**: Infrastructure orchestration from local to your cloud
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: Cargo.toml, go.mod, README.md
- **Stars / Engagement**: 12696 stars

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

### Incident Patch 1: `12053961` (2026-11-06)
**Commit Message**: sqldb: replace the lifetime config fields with a default jitter

Drop MaxConnLifetime and MaxConnLifetimeJitter from DatabaseConfig,
since pool settings belong to the workload rather than the database.
Instead, every pool adds a random extra of up to 10 minutes to pgx's
one-hour connection lifetime, so connections opened together after a
deploy don't all reconnect at the same moment.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_013iMhj82aGvK9n96FctgTGy

**File**: `runtimes/go/appruntime/exported/config/config.go` (modified, +0/-11)
```diff
@@ -18,10 +18,6 @@ type Static struct {
 	CORSExposeHeaders []string // Headers to be exposed by cors
 	PubsubTopics      map[string]*StaticPubsubTopic
 
-	// SQLDatabases holds the pool settings set in sqldb.DatabaseConfig,
-	// keyed by database name. Databases without any are left out.
-	SQLDatabases map[string]*StaticSQLDatabase `json:",omitempty"`
-
 	Testing         bool
 	TestServiceMap  map[string]string // map of service names to their filesystem root
 	TestAppRootPath string            // the root path of the app when running tests
@@ -334,13 +330,6 @@ type StaticPubsubSubscription struct {
 	ScrubPaths []scrub.Path
 }
 
-// StaticSQLDatabase is the connection pool configuration an app sets in code
-// for one SQL database. Zero values mean "use the default".
-type StaticSQLDatabase struct {
-	MaxConnLifetime       time.Duration `json:",omitempty"`
-	MaxConnLifetimeJitter time.Duration `json:",omitempty"`
-}
-
 type SQLServer struct {
 	// Host is the host to connect to.
 	// Valid formats are "hostname", "hostname:port", and "/path/to/unix.socket".
```

**File**: `runtimes/go/storage/sqldb/db.go` (modified, +5/-17)
```diff
@@ -11,6 +11,7 @@ import (
 	"net"
 	"strings"
 	"sync"
+	"time"
 
 	"github.com/jackc/pgx/v5"
 	"github.com/jackc/pgx/v5/pgxpool"
@@ -122,9 +123,6 @@ func (db *Database) Stdlib() *sql.DB {
 			db.stdlib.SetMaxOpenConns(maxConns)
 			db.stdlib.SetConnMaxIdleTime(cfg.MaxConnIdleTime)
 			db.stdlib.SetMaxIdleConns(maxConns)
-			if s := db.mgr.staticConf(db.origName); s != nil && s.MaxConnLifetime > 0 {
-				db.stdlib.SetConnMaxLifetime(s.MaxConnLifetime)
-			}
 		}
 		openErr = err
 	})
@@ -181,6 +179,10 @@ func dbConf(srv *config.SQLServer, db *config.SQLDatabase, dbNameOverride string
 		cfg.MaxConns = int32(n)
 	}
 
+	// Spread out connection retirement so connections opened together,
+	// such as after a deploy, don't all reconnect at the same moment.
+	cfg.MaxConnLifetimeJitter = 10 * time.Minute
+
 	// If we have a server CA, set it in the TLS config.
 	if srv.ServerCACert != "" {
 		caCertPool := x509.NewCertPool()
@@ -203,20 +205,6 @@ func dbConf(srv *config.SQLServer, db *config.SQLDatabase, dbNameOverride string
 	return cfg, nil
 }
 
-// applyStaticConf applies the pool settings the app set in sqldb.DatabaseConfig.
-// Zero values keep pgx's defaults.
-func applyStaticConf(cfg *pgxpool.Config, s *config.StaticSQLDatabase) {
-	if s == nil {
-		return
-	}
-	if s.MaxConnLifetime > 0 {
-		cfg.MaxConnLifetime = s.MaxConnLifetime
-	}
-	if s.MaxConnLifetimeJitter > 0 {
-		cfg.MaxConnLifetimeJitter = s.MaxConnLifetimeJitter
-	}
-}
-
 // Exec executes a query without returning any rows.
 // The args are for any placeholder parameters in the query.
 //
```

**File**: `runtimes/go/storage/sqldb/manager_internal.go` (modified, +1/-13)
```diff
@@ -16,7 +16,6 @@ import (
 
 // Manager manages database connections.
 type Manager struct {
-	static     *config.Static
 	runtime    *config.Runtime
 	rt         *reqtrack.RequestTracker
 	ts         *testsupport.Manager
@@ -26,9 +25,8 @@ type Manager struct {
 	dbs map[string]*Database
 }
 
-func NewManager(static *config.Static, runtime *config.Runtime, rt *reqtrack.RequestTracker, ts *testsupport.Manager, rootLogger zerolog.Logger) *Manager {
+func NewManager(runtime *config.Runtime, rt *reqtrack.RequestTracker, ts *testsupport.Manager, rootLogger zerolog.Logger) *Manager {
 	return &Manager{
-		static:     static,
 		runtime:    runtime,
 		rt:         rt,
 		ts:         ts,
@@ -97,7 +95,6 @@ func (mgr *Manager) getPool(encoreName, dbNameOverride string, hooks *hookList)
 	if err != nil {
 		panic("sqldb: " + err.Error())
 	}
-	applyStaticConf(cfg, mgr.staticConf(encoreName))
 
 	cfg.ConnConfig.Tracer = &pgxTracer{mgr: mgr}
 	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
@@ -111,15 +108,6 @@ func (mgr *Manager) getPool(encoreName, dbNameOverride string, hooks *hookList)
 	return pool, true
 }
 
-// staticConf returns the pool settings the app set in code for the database,
-// or nil if it set none. Test clones share the original's encoreName.
-func (mgr *Manager) staticConf(encoreName string) *config.StaticSQLDatabase {
-	if mgr.static == nil {
-		return nil
-	}
-	return mgr.static.SQLDatabases[encoreName]
-}
-
 func (mgr *Manager) Shutdown(p *shutdown.Process) error {
 	// Wait for all user code to finish before shutting down databases.
 	<-p.ServicesShutdownCompleted.Done()
```

**File**: `runtimes/go/storage/sqldb/pkgfn.go` (modified, +0/-15)
```diff
@@ -4,7 +4,6 @@ package sqldb
 
 import (
 	"context"
-	"time"
 )
 
 // NewDatabase declares a new SQL database.
@@ -34,20 +33,6 @@ type DatabaseConfig struct {
 	//
 	// Migrations are an ordered sequence of sql files of the format <number>_<description>.up.sql.
 	Migrations string
-
-	// MaxConnLifetime is the age at which the pool retires a connection, checked
-	// when it is released or idle; for example 30 * time.Minute. If zero, the pool
-	// keeps pgx's default of one hour and (*Database).Stdlib sets no maximum age.
-	// PostgreSQL connections cache metadata for each table and partition they
-	// touch, so a shorter lifetime limits that memory. It also applies to Stdlib(),
-	// sqldb.Named, and sql.Open pools made with RegisterStdlibDriver.
-	MaxConnLifetime time.Duration
-
-	// MaxConnLifetimeJitter adds a random extra duration, up to this value, to
-	// each connection's lifetime, so connections opened together (after a deploy,
-	// say) don't all close together. If zero there is no jitter.
-	// (*Database).Stdlib ignores it, as database/sql has no jitter.
-	MaxConnLifetimeJitter time.Duration
 }
 
 // Exec executes a query without returning any rows.
```

**File**: `runtimes/go/storage/sqldb/sqldb_test.go` (modified, +4/-46)
```diff
@@ -7,9 +7,6 @@ import (
 	"time"
 	_ "unsafe" // for go:linkname
 
-	"github.com/jackc/pgx/v5/pgxpool"
-	"github.com/rs/zerolog"
-
 	"encore.dev/appruntime/exported/config"
 )
 
@@ -92,49 +89,10 @@ func TestDBConf(t *testing.T) {
 			t.Fatalf("test %d: got user %s, want %q", i, cfg.ConnConfig.User, test.DB.User)
 		} else if cfg.ConnConfig.Password != test.DB.Password {
 			t.Fatalf("test %d: got password %s, want %q", i, cfg.ConnConfig.Password, test.DB.Password)
-		}
-	}
-}
-
-func TestPoolLifetimeFromStaticConfig(t *testing.T) {
-	runtime := &config.Runtime{
-		SQLServers: []*config.SQLServer{{Host: "localhost:1"}},
-		SQLDatabases: []*config.SQLDatabase{
-			{EncoreName: "tuned", DatabaseName: "tuned", User: "u", Password: "p"},
-			{EncoreName: "jitter-only", DatabaseName: "jitter-only", User: "u", Password: "p"},
-			{EncoreName: "plain", DatabaseName: "plain", User: "u", Password: "p"},
-		},
-	}
-	static := &config.Static{
-		SQLDatabases: map[string]*config.StaticSQLDatabase{
-			"tuned":       {MaxConnLifetime: 30 * time.Minute, MaxConnLifetimeJitter: 10 * time.Minute},
-			"jitter-only": {MaxConnLifetimeJitter: 5 * time.Minute},
-		},
-	}
-	mgr := NewManager(static, runtime, nil, nil, zerolog.Nop())
-
-	// A test clone, as made by NewTestDatabase, must pick up the original's settings.
-	tuned := mgr.GetDB("tuned")
-	clone := &Database{name: "tuned_clone", origName: "tuned", mgr: mgr, hooks: tuned.hooks}
-
-	tests := []struct {
-		DB           *Database
-		WantLifetime time.Duration
-		WantJitter   time.Duration
-	}{
-		{DB: tuned, WantLifetime: 30 * time.Minute, WantJitter: 10 * time.Minute},
-		{DB: clone, WantLifetime: 30 * time.Minute, WantJitter: 10 * time.Minute},
-		{DB: mgr.GetDB("jitter-only"), WantLifetime: time.Hour, WantJitter: 5 * time.Minute},
-		{DB: mgr.GetDB("plain"), WantLifetime: time.Hour, WantJitter: 0},
-	}
-	for _, test := range tests {
-		cfg := Driver[*pgxpool.Pool](test.DB).Config()
-		t.Cleanup(test.DB.shutdown)
-		if cfg.MaxConnLifetime != test.WantLifetime {
-			t.Errorf("%s: got MaxConnLifetime %s, want %s", test.DB.name, cfg.MaxConnLifetime, test.WantLifetime)
-		}
-		if cfg.MaxConnLifetimeJitter != test.WantJitter {
-			t.Errorf("%s: got MaxConnLifetimeJitter %s, want %s", test.DB.name, cfg.MaxConnLifetimeJitter, test.WantJitter)
+		} else if cfg.MaxConnLifetime != time.Hour {
+			t.Fatalf("test %d: got max conn lifetime %v, want %v", i, cfg.MaxConnLifetime, time.Hour)
+		} else if cfg.MaxConnLifetimeJitter != 10*time.Minute {
+			t.Fatalf("test %d: got max conn lifetime jitter %v, want %v", i, cfg.MaxConnLifetimeJitter, 10*time.Minute)
 		}
 	}
 }
```

**File**: `runtimes/go/storage/sqldb/stdlib.go` (modified, +1/-16)
```diff
@@ -19,10 +19,6 @@ import (
 //
 // The main use case is to support libraries that expect to call sql.Open
 // themselves without exposing the underlying database credentials.
-//
-// The *sql.DB that sql.Open returns is a separate pool owned by the caller.
-// It retires connections after DatabaseConfig.MaxConnLifetime (plus jitter) when
-// they are reused or returned, but Encore's other pool settings don't apply to it.
 func RegisterStdlibDriver(db *Database) string {
 	if db == nil {
 		panic("sqldb.StdlibDriver: received nil db")
@@ -119,18 +115,7 @@ func (adapterDriver) OpenConnector(ident string) (driver.Connector, error) {
 	} else if db.noopDB {
 		return nil, errNoopDB
 	}
-	c, err := registerStdlibDriver(db.mgr).OpenConnector(db.connStr)
-	if err != nil {
-		return nil, err
-	}
-	// The caller owns this pool, so apply the app's lifetime through the connections.
-	if wc, ok := c.(wrappedConnector); ok {
-		if s := db.mgr.staticConf(db.origName); s != nil {
-			wc.maxLifetime, wc.maxLifetimeJitter = s.MaxConnLifetime, s.MaxConnLifetimeJitter
-		}
-		c = wc
-	}
-	return c, nil
+	return registerStdlibDriver(db.mgr).OpenConnector(db.connStr)
 }
 
 var (
```

**File**: `runtimes/go/storage/sqldb/stdlib_lifetime_test.go` (removed, +0/-111)
```diff
@@ -1,111 +0,0 @@
-package sqldb
-
-import (
-	"context"
-	"database/sql/driver"
-	"errors"
-	"testing"
-	"time"
-
-	"github.com/rs/zerolog"
-
-	"encore.dev/appruntime/exported/config"
-)
-
-type fakeConn struct{ driver.Conn }
-
-type fakeConnector struct{}
-
-func (fakeConnector) Connect(context.Context) (driver.Conn, error) { return fakeConn{}, nil }
-func (fakeConnector) Driver() driver.Driver                        { return nil }
-
-func TestWrappedConnExpiry(t *testing.T) {
-	past, future := time.Now().Add(-time.Second), time.Now().Add(time.Hour)
-	tests := []struct {
-		Name      string
-		Conn      wrappedConn
-		WantValid bool
-	}{
-		{Name: "no_lifetime", Conn: wrappedConn{parent: fakeConn{}}, WantValid: true},
-		{Name: "not_expired", Conn: wrappedConn{parent: fakeConn{}, expiresAt: future}, WantValid: true},
-		{Name: "expired", Conn: wrappedConn{parent: fakeConn{}, expiresAt: past}, WantValid: false},
-		// sql.Open("encore", ...) wraps the connection twice; the outer one must pass the answer on.
-		{Name: "expired_inner", Conn: wrappedConn{parent: wrappedConn{parent: fakeConn{}, expiresAt: past}}, WantValid: false},
-	}
-	for _, test := range tests {
-		t.Run(test.Name, func(t *testing.T) {
-			if got := test.Conn.IsValid(); got != test.WantValid {
-				t.Errorf("IsValid() = %v, want %v", got, test.WantValid)
-			}
-			err := test.Conn.ResetSession(context.Background())
-			if test.WantValid && err != nil {
-				t.Errorf("ResetSession() = %v, want nil", err)
-			} else if !test.WantValid && !errors.Is(err, driver.ErrBadConn) {
-				t.Errorf("ResetSession() = %v, want driver.ErrBadConn", err)
-			}
-		})
-	}
-}
-
-func TestWrappedConnectorSetsExpiry(t *testing.T) {
-	c := wrappedConnector{
-		parent:            fakeConnector{},
-		driverRef:         &wrappedDriver{},
-		maxLifetime:       20 * time.Second,
-		maxLifetimeJitter: 10 * time.Second,
-	}
-	for i := 0; i < 100; i++ {
-		before := time.Now()
-		conn, err := c.Connect(context.Background())
-		if err != nil {
-			t.Fatal(err)
-		}
-		expiresAt := conn.(wrappedConn).expiresAt
-		if expiresAt.Before(before.Add(20*time.Second)) || expiresAt.After(time.Now().Add(30*time.Second)) {
-			t.Fatalf("expiresAt is %s after connecting, want between 20s and 30s", expiresAt.Sub(before))
-		}
-	}
-
-	c.maxLifetime = 0
-	conn, _ := c.Connect(context.Background())
-	if !conn.(wrappedConn).expiresAt.IsZero() {
-		t.Errorf("with no lifetime, expiresAt = %v, want zero", conn.(wrappedConn).expiresAt)
-	}
-}
-
-func TestRegisterStdlibDriverLifetime(t *testing.T) {
-	runtime := &config.Runtime{
-		SQLServers: []*config.SQLServer{{Host: "localhost:1"}},
-		SQLDatabases: []*config.SQLDatabase{
-			{EncoreName: "adapter-tuned", DatabaseName: "adapter-tuned", User: "u", Password: "p"},
-			{EncoreName: "adapter-plain", DatabaseName: "adapter-plain", User: "u", Password: "p"},
-		},
-	}
-	static := &config.Static{
-		SQLDatabases: map[string]*config.StaticSQLDatabase{
-			"adapter-tuned": {MaxConnLifetime: 20 * time.Second, MaxConnLifetimeJitter: 10 * time.Second},
-		},
-	}
-	mgr := NewManager(static, runtime, nil, nil, zerolog.Nop())
-
-	tests := []struct {
-		DB                       string
-		WantLifetime, WantJitter time.Duration
-	}{
-		{DB: "adapter-tuned", WantLifetime: 20 * time.Second, WantJitter: 10 * time.Second},
-		{DB: "adapter-plain"},
-	}
-	for _, test := range tests {
-		db := mgr.GetDB(test.DB)
-		t.Cleanup(db.shutdown)
-		c, err := adapterDriver{}.OpenConnector(RegisterStdlibDriver(db))
-		if err != nil {
-			t.Fatal(err)
-		}
-		wc := c.(wrappedConnector)
-		if wc.maxLifetime != test.WantLifetime || wc.maxLifetimeJitter != test.WantJitter {
-			t.Errorf("%s: got lifetime %s and jitter %s, want %s and %s",
-				test.DB, wc.maxLifetime, wc.maxLifetimeJitter, test.WantLifetime, test.WantJitter)
-		}
-	}
-}
```

**File**: `runtimes/go/storage/sqldb/stdlib_wrapper_internal.go` (modified, +1/-34)
```diff
@@ -34,8 +34,6 @@ import (
 	"context"
 	"database/sql/driver"
 	"errors"
-	"math/rand/v2"
-	"time"
 
 	"encore.dev/appruntime/exported/model"
 	"encore.dev/appruntime/exported/stack"
@@ -317,10 +315,6 @@ func (d wrappedDriver) OpenConnector(name string) (driver.Connector, error) {
 type wrappedConnector struct {
 	parent    driver.Connector
 	driverRef *wrappedDriver
-
-	// If maxLifetime is set, connections report themselves unusable to
-	// database/sql once older than maxLifetime plus up to maxLifetimeJitter.
-	maxLifetime, maxLifetimeJitter time.Duration
 }
 
 var (
@@ -333,12 +327,7 @@ func (c wrappedConnector) Connect(ctx context.Context) (conn driver.Conn, err er
 		return nil, err
 	}
 
-	wc := wrappedConn{mw: c.driverRef.mw, parent: conn}
-	if c.maxLifetime > 0 {
-		jitter := time.Duration(rand.Float64() * float64(c.maxLifetimeJitter))
-		wc.expiresAt = time.Now().Add(c.maxLifetime).Add(jitter)
-	}
-	return wc, nil
+	return wrappedConn{mw: c.driverRef.mw, parent: conn}, nil
 }
 
 func (c wrappedConnector) Driver() driver.Driver {
@@ -363,8 +352,6 @@ func (t dsnConnector) Driver() driver.Driver {
 type wrappedConn struct {
 	mw     middleware
 	parent driver.Conn
-
-	expiresAt time.Time // zero means no maximum age
 }
 
 // Compile time validation that our types implement the expected interfaces
@@ -376,7 +363,6 @@ var (
 	_ driver.Pinger             = wrappedConn{}
 	_ driver.QueryerContext     = wrappedConn{}
 	_ driver.SessionResetter    = wrappedConn{}
-	_ driver.Validator          = wrappedConn{}
 	_ driver.NamedValueChecker  = wrappedConn{}
 )
 
@@ -450,31 +436,12 @@ func (c wrappedConn) QueryContext(ctx context.Context, query string, args []driv
 }
 
 func (c wrappedConn) ResetSession(ctx context.Context) error {
-	// database/sql calls this before reusing a connection, and discards it on ErrBadConn.
-	if c.expired() {
-		return driver.ErrBadConn
-	}
 	if conn, ok := c.parent.(driver.SessionResetter); ok {
 		return conn.ResetSession(ctx)
 	}
 	return nil
 }
 
-// IsValid is called when a connection is returned to the pool; false discards it.
-func (c wrappedConn) IsValid() bool {
-	if c.expired() {
-		return false
-	}
-	if v, ok := c.parent.(driver.Validator); ok {
-		return v.IsValid()
-	}
-	return true
-}
-
-func (c wrappedConn) expired() bool {
-	return !c.expiresAt.IsZero() && time.Now().After(c.expiresAt)
-}
-
 func defaultCheckNamedValue(nv *driver.NamedValue) (err error) {
 	nv.Value, err = driver.DefaultParameterConverter.ConvertValue(nv.Value)
 	return err
```

---

### Incident Patch 2: `18a6b845` (2026-11-02)
**Commit Message**: sqldb: retire old connections in sql.Open pools from RegisterStdlibDriver

A *sql.DB from sql.Open("encore", ...) belongs to the caller, so Encore
can't call SetConnMaxLifetime on it. Instead, the adapter's connector
gives each connection an expiry (MaxConnLifetime plus up to
MaxConnLifetimeJitter), and the wrapped connection reports itself
unusable once past it: ResetSession returns driver.ErrBadConn before
reuse, and IsValid returns false when it's put back. database/sql then
closes it and opens a new one. Connections without an expiry behave as
before.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_013iMhj4pDYPUbpbxTSRCVQH

**File**: `runtimes/go/storage/sqldb/pkgfn.go` (modified, +2/-2)
```diff
@@ -39,8 +39,8 @@ type DatabaseConfig struct {
 	// when it is released or idle; for example 30 * time.Minute. If zero, the pool
 	// keeps pgx's default of one hour and (*Database).Stdlib sets no maximum age.
 	// PostgreSQL connections cache metadata for each table and partition they
-	// touch, so a shorter lifetime limits that memory. It also applies to Stdlib()
-	// and sqldb.Named, but not to a sql.Open pool made with RegisterStdlibDriver.
+	// touch, so a shorter lifetime limits that memory. It also applies to Stdlib(),
+	// sqldb.Named, and sql.Open pools made with RegisterStdlibDriver.
 	MaxConnLifetime time.Duration
 
 	// MaxConnLifetimeJitter adds a random extra duration, up to this value, to
```

**File**: `runtimes/go/storage/sqldb/stdlib.go` (modified, +15/-4)
```diff
@@ -20,9 +20,9 @@ import (
 // The main use case is to support libraries that expect to call sql.Open
 // themselves without exposing the underlying database credentials.
 //
-// The *sql.DB that sql.Open returns is a separate pool owned by the caller, so
-// Encore's pool settings, including DatabaseConfig.MaxConnLifetime, don't apply
-// to it. Set them on it directly, for example db.SetConnMaxLifetime(30 * time.Minute).
+// The *sql.DB that sql.Open returns is a separate pool owned by the caller.
+// It retires connections after DatabaseConfig.MaxConnLifetime (plus jitter) when
+// they are reused or returned, but Encore's other pool settings don't apply to it.
 func RegisterStdlibDriver(db *Database) string {
 	if db == nil {
 		panic("sqldb.StdlibDriver: received nil db")
@@ -119,7 +119,18 @@ func (adapterDriver) OpenConnector(ident string) (driver.Connector, error) {
 	} else if db.noopDB {
 		return nil, errNoopDB
 	}
-	return registerStdlibDriver(db.mgr).OpenConnector(db.connStr)
+	c, err := registerStdlibDriver(db.mgr).OpenConnector(db.connStr)
+	if err != nil {
+		return nil, err
+	}
+	// The caller owns this pool, so apply the app's lifetime through the connections.
+	if wc, ok := c.(wrappedConnector); ok {
+		if s := db.mgr.staticConf(db.origName); s != nil {
+			wc.maxLifetime, wc.maxLifetimeJitter = s.MaxConnLifetime, s.MaxConnLifetimeJitter
+		}
+		c = wc
+	}
+	return c, nil
 }
 
 var (
```

**File**: `runtimes/go/storage/sqldb/stdlib_lifetime_test.go` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+package sqldb
+
+import (
+	"context"
+	"database/sql/driver"
+	"errors"
+	"testing"
+	"time"
+
+	"github.com/rs/zerolog"
+
+	"encore.dev/appruntime/exported/config"
+)
+
+type fakeConn struct{ driver.Conn }
+
+type fakeConnector struct{}
+
+func (fakeConnector) Connect(context.Context) (driver.Conn, error) { return fakeConn{}, nil }
+func (fakeConnector) Driver() driver.Driver                        { return nil }
+
+func TestWrappedConnExpiry(t *testing.T) {
+	past, future := time.Now().Add(-time.Second), time.Now().Add(time.Hour)
+	tests := []struct {
+		Name      string
+		Conn      wrappedConn
+		WantValid bool
+	}{
+		{Name: "no_lifetime", Conn: wrappedConn{parent: fakeConn{}}, WantValid: true},
+		{Name: "not_expired", Conn: wrappedConn{parent: fakeConn{}, expiresAt: future}, WantValid: true},
+		{Name: "expired", Conn: wrappedConn{parent: fakeConn{}, expiresAt: past}, WantValid: false},
+		// sql.Open("encore", ...) wraps the connection twice; the outer one must pass the answer on.
+		{Name: "expired_inner", Conn: wrappedConn{parent: wrappedConn{parent: fakeConn{}, expiresAt: past}}, WantValid: false},
+	}
+	for _, test := range tests {
+		t.Run(test.Name, func(t *testing.T) {
+			if got := test.Conn.IsValid(); got != test.WantValid {
+				t.Errorf("IsValid() = %v, want %v", got, test.WantValid)
+			}
+			err := test.Conn.ResetSession(context.Background())
+			if test.WantValid && err != nil {
+				t.Errorf("ResetSession() = %v, want nil", err)
+			} else if !test.WantValid && !errors.Is(err, driver.ErrBadConn) {
+				t.Errorf("ResetSession() = %v, want driver.ErrBadConn", err)
+			}
+		})
+	}
+}
+
+func TestWrappedConnectorSetsExpiry(t *testing.T) {
+	c := wrappedConnector{
+		parent:            fakeConnector{},
+		driverRef:         &wrappedDriver{},
+		maxLifetime:       20 * time.Second,
+		maxLifetimeJitter: 10 * time.Second,
+	}
+	for i := 0; i < 100; i++ {
+		before := time.Now()
+		conn, err := c.Connect(context.Background())
+		if err != nil {
+			t.Fatal(err)
+		}
+		expiresAt := conn.(wrappedConn).expiresAt
+		if expiresAt.Before(before.Add(20*time.Second)) || expiresAt.After(time.Now().Add(30*time.Second)) {
+			t.Fatalf("expiresAt is %s after connecting, want between 20s and 30s", expiresAt.Sub(before))
+		}
+	}
+
+	c.maxLifetime = 0
+	conn, _ := c.Connect(context.Background())
+	if !conn.(wrappedConn).expiresAt.IsZero() {
+		t.Errorf("with no lifetime, expiresAt = %v, want zero", conn.(wrappedConn).expiresAt)
+	}
+}
+
+func TestRegisterStdlibDriverLifetime(t *testing.T) {
+	runtime := &config.Runtime{
+		SQLServers: []*config.SQLServer{{Host: "localhost:1"}},
+		SQLDatabases: []*config.SQLDatabase{
+			{EncoreName: "adapter-tuned", DatabaseName: "adapter-tuned", User: "u", Password: "p"},
+			{EncoreName: "adapter-plain", DatabaseName: "adapter-plain", User: "u", Password: "p"},
+		},
+	}
+	static := &config.Static{
+		SQLDatabases: map[string]*config.StaticSQLDatabase{
+			"adapter-tuned": {MaxConnLifetime: 20 * time.Second, MaxConnLifetimeJitter: 10 * time.Second},
+		},
+	}
+	mgr := NewManager(static, runtime, nil, nil, zerolog.Nop())
+
+	tests := []struct {
+		DB                       string
+		WantLifetime, WantJitter time.Duration
+	}{
+		{DB: "adapter-tuned", WantLifetime: 20 * time.Second, WantJitter: 10 * time.Second},
+		{DB: "adapter-plain"},
+	}
+	for _, test := range tests {
+		db := mgr.GetDB(test.DB)
+		t.Cleanup(db.shutdown)
+		c, err := adapterDriver{}.OpenConnector(RegisterStdlibDriver(db))
+		if err != nil {
+			t.Fatal(err)
+		}
+		wc := c.(wrappedConnector)
+		if wc.maxLifetime != test.WantLifetime || wc.maxLifetimeJitter != test.WantJitter {
+			t.Errorf("%s: got lifetime %s and jitter %s, want %s and %s",
+				test.DB, wc.maxLifetime, wc.maxLifetimeJitter, test.WantLifetime, test.WantJitter)
+		}
+	}
+}
```

**File**: `runtimes/go/storage/sqldb/stdlib_wrapper_internal.go` (modified, +34/-1)
```diff
@@ -34,6 +34,8 @@ import (
 	"context"
 	"database/sql/driver"
 	"errors"
+	"math/rand/v2"
+	"time"
 
 	"encore.dev/appruntime/exported/model"
 	"encore.dev/appruntime/exported/stack"
@@ -315,6 +317,10 @@ func (d wrappedDriver) OpenConnector(name string) (driver.Connector, error) {
 type wrappedConnector struct {
 	parent    driver.Connector
 	driverRef *wrappedDriver
+
+	// If maxLifetime is set, connections report themselves unusable to
+	// database/sql once older than maxLifetime plus up to maxLifetimeJitter.
+	maxLifetime, maxLifetimeJitter time.Duration
 }
 
 var (
@@ -327,7 +333,12 @@ func (c wrappedConnector) Connect(ctx context.Context) (conn driver.Conn, err er
 		return nil, err
 	}
 
-	return wrappedConn{mw: c.driverRef.mw, parent: conn}, nil
+	wc := wrappedConn{mw: c.driverRef.mw, parent: conn}
+	if c.maxLifetime > 0 {
+		jitter := time.Duration(rand.Float64() * float64(c.maxLifetimeJitter))
+		wc.expiresAt = time.Now().Add(c.maxLifetime).Add(jitter)
+	}
+	return wc, nil
 }
 
 func (c wrappedConnector) Driver() driver.Driver {
@@ -352,6 +363,8 @@ func (t dsnConnector) Driver() driver.Driver {
 type wrappedConn struct {
 	mw     middleware
 	parent driver.Conn
+
+	expiresAt time.Time // zero means no maximum age
 }
 
 // Compile time validation that our types implement the expected interfaces
@@ -363,6 +376,7 @@ var (
 	_ driver.Pinger             = wrappedConn{}
 	_ driver.QueryerContext     = wrappedConn{}
 	_ driver.SessionResetter    = wrappedConn{}
+	_ driver.Validator          = wrappedConn{}
 	_ driver.NamedValueChecker  = wrappedConn{}
 )
 
@@ -436,12 +450,31 @@ func (c wrappedConn) QueryContext(ctx context.Context, query string, args []driv
 }
 
 func (c wrappedConn) ResetSession(ctx context.Context) error {
+	// database/sql calls this before reusing a connection, and discards it on ErrBadConn.
+	if c.expired() {
+		return driver.ErrBadConn
+	}
 	if conn, ok := c.parent.(driver.SessionResetter); ok {
 		return conn.ResetSession(ctx)
 	}
 	return nil
 }
 
+// IsValid is called when a connection is returned to the pool; false discards it.
+func (c wrappedConn) IsValid() bool {
+	if c.expired() {
+		return false
+	}
+	if v, ok := c.parent.(driver.Validator); ok {
+		return v.IsValid()
+	}
+	return true
+}
+
+func (c wrappedConn) expired() bool {
+	return !c.expiresAt.IsZero() && time.Now().After(c.expiresAt)
+}
+
 func defaultCheckNamedValue(nv *driver.NamedValue) (err error) {
 	nv.Value, err = driver.DefaultParameterConverter.ConvertValue(nv.Value)
 	return err
```

#### Recent Merged Pull Requests:
- **PR #2638** (2026-11-03): v2/internals/pkginfo: resolve nested modules missing from the module cache (@eandre)
- **PR #2637** (2026-11-06): sqldb: add 10 minutes of jitter to connection lifetimes by default (@gmtuca)
- **PR #2630** (2026-10-29): v2/app/legacymeta: stop metadata keeping the parsed app alive (@twindebank)
- **PR #2628** (2026-10-29): runtime: keep pubsub topics and buckets from all infra config providers (@jaglyserx)
- **PR #2623** (2026-10-26): Fix LLM rules setup and update LLM instructions (@marcuskohlberg)
- **PR #2622** (2026-10-22): Update README.md (@marcuskohlberg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

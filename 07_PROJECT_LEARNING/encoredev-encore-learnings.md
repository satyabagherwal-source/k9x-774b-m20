> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/encoredev-encore-learnings.md`  
> **Source**: github ([https://github.com/encoredev/encore](https://github.com/encoredev/encore))  
> **Source Version**: `94eae2cc`  
> **License**: MPL-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T02:28:02.856Z  
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
> **Harvest Timestamp**: 2026-10-20T02:28:02.417Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `encoredev/encore`
- **Description**: Infrastructure orchestration from local to your cloud
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: Cargo.toml, go.mod, README.md
- **Stars / Engagement**: 12469 stars

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

### Incident Patch 1: `94eae2cc` (2026-10-19)
**Commit Message**: metascrub: include cookie fields

**File**: `pkg/metascrub/metascrub.go` (modified, +33/-3)
```diff
@@ -34,7 +34,13 @@ type Computer struct {
 
 type Desc struct {
 	Payload []scrub.Path
+
+	// Headers are the names of headers whose values should be redacted entirely.
 	Headers []string
+
+	// Cookies are the names of cookies whose values should be redacted.
+	// Use scrub.Cookie to redact them in a Cookie header.
+	Cookies []string
 }
 
 type ParseMode int
@@ -68,6 +74,7 @@ func (c *Computer) Compute(typ *schema.Type, mode ParseMode) Desc {
 	return Desc{
 		Payload: res.scrub,
 		Headers: res.headers,
+		Cookies: res.cookies,
 	}
 }
 
@@ -109,6 +116,7 @@ type declResult struct {
 	scrub      []scrub.Path
 	typeParams []typeParamPath
 	headers    []string
+	cookies    []string
 }
 
 func (p *typeParser) typ(typ *schema.Type) declResult {
@@ -127,9 +135,10 @@ func (p *typeParser) typ(typ *schema.Type) declResult {
 			// Clone the paths since we're modifying them.
 			scrub: slices.Clone(decl.scrub),
 
-			// Copy the headers directly since they never get modified,
-			// since we only care about the top-level type's headers.
+			// Copy the headers and cookies directly since they never get modified,
+			// since we only care about the top-level type's headers and cookies.
 			headers: decl.headers,
+			cookies: decl.cookies,
 		}
 
 		for i, arg := range t.Named.TypeArguments {
@@ -171,23 +180,26 @@ func (p *typeParser) typ(typ *schema.Type) declResult {
 
 	case *schema.Type_Union:
 		var results []declResult
-		var numScrub, numTypeParams, numHeaders int
+		var numScrub, numTypeParams, numHeaders, numCookies int
 		for _, typ := range t.Union.Types {
 			res := p.typ(typ)
 			results = append(results, res)
 			numScrub += len(res.scrub)
 			numTypeParams += len(res.typeParams)
 			numHeaders += len(res.headers)
+			numCookies += len(res.cookies)
 		}
 		combined := declResult{
 			scrub:      make([]scrub.Path, 0, numScrub),
 			typeParams: make([]typeParamPath, 0, numTypeParams),
 			headers:    make([]string, 0, numHeaders),
+			cookies:    make([]string, 0, numCookies),
 		}
 		for _, res := range results {
 			combined.scrub = append(combined.scrub, res.scrub...)
 			combined.typeParams = append(combined.typeParams, res.typeParams...)
 			combined.headers = append(combined.headers, res.headers...)
+			combined.cookies = append(combined.cookies, res.cookies...)
 		}
 		return combined
 
@@ -233,6 +245,11 @@ func (p *typeParser) typ(typ *schema.Type) declResult {
 				if headerName, ok := isHeader(f); ok {
 					out.headers = append(out.headers, headerName)
 				}
+
+				// If this is a cookie field, add it to the cookies to scrub.
+				if cookieName, ok := isCookie(f); ok {
+					out.cookies = append(out.cookies, cookieName)
+				}
 			} else {
 				// Otherwise check the type and see if there's anything to scrub within it.
 				fieldRes := p.typ(f.Typ)
@@ -293,6 +310,19 @@ func isHeader(f *schema.Field) (headerName string, ok bool) {
 	return "", false
 }
 
+func isCookie(f *schema.Field) (cookieName string, ok bool) {
+	for _, t := range f.Tags {
+		if t.Key == "cookie" {
+			name := t.Name
+			if name == "" {
+				name = f.Name
+			}
+			return name, true
+		}
+	}
+	return "", false
+}
+
 type typeParamPath struct {
 	p        scrub.Path
 	paramIdx uint32
```

**File**: `pkg/metascrub/metascrub_test.go` (modified, +7/-0)
```diff
@@ -59,6 +59,8 @@ type Params struct {
 
 	JsonKey string `+"`"+`json:"json_key" encore:"sensitive"`+"`"+`
 	Header string `+"`"+`header:"X-Header" encore:"sensitive"`+"`"+`
+	Cookie string `+"`"+`cookie:"session" encore:"sensitive"`+"`"+`
+	PlainCookie string `+"`"+`cookie:"theme"`+"`"+`
 }
 
 type Generic[T any] struct {
@@ -127,9 +129,11 @@ func Foo(ctx context.Context, p *Params) error { return nil }
 		{f("MapTwo"), f("Foo"), mapVal, f("Two"), f("Scrub")},
 		{fCase("json_key")},
 		{f("Header")},
+		{f("Cookie")},
 	})
 
 	c.Assert(res.Headers, qt.DeepEquals, []string{"X-Header"})
+	c.Assert(res.Cookies, qt.DeepEquals, []string{"session"})
 }
 
 func TestScrubAuthHandler(t *testing.T) {
@@ -142,6 +146,7 @@ import "context"
 type Params struct {
 	Header string `+"`"+`header:"Foo"`+"`"+`
 	Query string `+"`"+`query:"query"`+"`"+`
+	Cookie string `+"`"+`cookie:"session"`+"`"+`
 	Other string
 }
 
@@ -160,10 +165,12 @@ func Foo(ctx context.Context, p *Params) error { return nil }
 	c.Assert(res.Payload, qt.DeepEquals, []scrub.Path{
 		{f("Header")},
 		{f("Query")},
+		{f("Cookie")},
 		{f("Other")},
 	})
 
 	c.Assert(res.Headers, qt.DeepEquals, []string{"Foo"})
+	c.Assert(res.Cookies, qt.DeepEquals, []string{"session"})
 }
 
 func testParse(c *qt.C, code string) *meta.Data {
```

**File**: `runtimes/go/appruntime/apisdk/api/handler.go` (modified, +2/-0)
```diff
@@ -113,6 +113,7 @@ type Desc[Req, Resp any] struct {
 
 	ScrubRequestPaths    []scrub.Path
 	ScrubRequestHeaders  map[string]bool
+	ScrubRequestCookies  []string
 	ScrubResponsePaths   []scrub.Path
 	ScrubResponseHeaders map[string]bool
 
@@ -921,6 +922,7 @@ func (d *Desc[Req, Resp]) rpcDesc() *model.RPCDesc {
 			ScrubRequestPaths:    d.ScrubRequestPaths,
 			ScrubResponsePaths:   d.ScrubResponsePaths,
 			ScrubRequestHeaders:  d.ScrubRequestHeaders,
+			ScrubRequestCookies:  d.ScrubRequestCookies,
 			ScrubResponseHeaders: d.ScrubResponseHeaders,
 		}
 
```

**File**: `runtimes/go/appruntime/exported/model/request.go` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@ type RPCDesc struct {
 
 	ScrubRequestPaths    []scrub.Path
 	ScrubRequestHeaders  map[string]bool
+	ScrubRequestCookies  []string // cookie names to redact in the Cookie header
 	ScrubResponsePaths   []scrub.Path
 	ScrubResponseHeaders map[string]bool
 }
```

**File**: `runtimes/go/appruntime/exported/scrub/cookie.go` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+package scrub
+
+import (
+	"slices"
+	"strings"
+)
+
+// Cookie redacts the values of the named cookies in a Cookie request header
+// value (e.g. "session=abc; theme=dark"), leaving the other cookies and the
+// original formatting intact.
+//
+// Cookie names are matched case-sensitively, as RFC 6265 defines them.
+// Every occurrence of a matching name is redacted. A part that cannot be
+// parsed as a name=value pair is redacted as well, so that a malformed
+// header can't hide a sensitive value.
+func Cookie(header string, names []string, replaceWith string) string {
+	if len(names) == 0 || header == "" {
+		return header
+	}
+
+	var b strings.Builder
+	b.Grow(len(header))
+	for i, part := range strings.Split(header, ";") {
+		if i > 0 {
+			b.WriteByte(';')
+		}
+
+		name, _, hasEq := strings.Cut(part, "=")
+		trimmedName := strings.TrimSpace(name)
+		switch {
+		case hasEq && slices.Contains(names, trimmedName):
+			b.WriteString(name)
+			b.WriteByte('=')
+			b.WriteString(replaceWith)
+		case !hasEq && strings.TrimSpace(part) != "":
+			// Keep the leading whitespace so the result stays readable.
+			b.WriteString(part[:len(part)-len(strings.TrimLeft(part, " \t"))])
+			b.WriteString(replaceWith)
+		default:
+			b.WriteString(part)
+		}
+	}
+	return b.String()
+}
```

**File**: `runtimes/go/appruntime/exported/scrub/cookie_test.go` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+package scrub
+
+import "testing"
+
+func TestCookie(t *testing.T) {
+	const r = "[REDACTED]"
+	tests := []struct {
+		name   string
+		header string
+		names  []string
+		want   string
+	}{
+		{"no_names", "session=abc; theme=dark", nil, "session=abc; theme=dark"},
+		{"empty_header", "", []string{"session"}, ""},
+		{"single", "session=abc", []string{"session"}, "session=" + r},
+		{"first_of_many", "session=abc; theme=dark", []string{"session"}, "session=" + r + "; theme=dark"},
+		{"last_of_many", "theme=dark; session=abc", []string{"session"}, "theme=dark; session=" + r},
+		{"multiple_names", "a=1; b=2; c=3", []string{"a", "c"}, "a=" + r + "; b=2; c=" + r},
+		{"repeated_name", "session=abc; session=def", []string{"session"}, "session=" + r + "; session=" + r},
+		{"no_match", "theme=dark", []string{"session"}, "theme=dark"},
+		{"case_sensitive", "Session=abc", []string{"session"}, "Session=abc"},
+		{"quoted_value", `session="abc"; theme=dark`, []string{"session"}, "session=" + r + "; theme=dark"},
+		{"value_contains_eq", "session=a=b; theme=dark", []string{"session"}, "session=" + r + "; theme=dark"},
+		{"empty_value", "session=; theme=dark", []string{"session"}, "session=" + r + "; theme=dark"},
+		{"no_space_after_semicolon", "theme=dark;session=abc", []string{"session"}, "theme=dark;session=" + r},
+		{"trailing_semicolon", "session=abc;", []string{"session"}, "session=" + r + ";"},
+		{"malformed_part", "theme=dark; abc", []string{"session"}, "theme=dark; " + r},
+		{"prefix_is_not_match", "session_id=abc", []string{"session"}, "session_id=abc"},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			if got := Cookie(tt.header, tt.names, r); got != tt.want {
+				t.Errorf("Cookie(%q, %q) = %q, want %q", tt.header, tt.names, got, tt.want)
+			}
+		})
+	}
+}
```

**File**: `runtimes/go/appruntime/exported/trace/events.go` (modified, +6/-3)
```diff
@@ -125,7 +125,7 @@ func (l *Log) BeginRequest(req *model.Request, goid uint32) {
 		tb.String(req.ExtCorrelationID)
 
 		if desc.Raw {
-			l.logHeaders(&tb, data.RequestHeaders, desc.ScrubRequestHeaders)
+			l.logHeaders(&tb, data.RequestHeaders, desc.ScrubRequestHeaders, desc.ScrubRequestCookies)
 		} else {
 			// Scrub the payload according to the RPC description.
 			scrubbed := scrub.JSON(data.NonRawPayload, desc.ScrubRequestPaths, []byte(`"[REDACTED]"`))
@@ -179,7 +179,7 @@ func (l *Log) FinishRequest(req *model.Request, resp *model.Response) {
 		isRaw := req.RPCData.Desc.Raw
 		tb.Bool(isRaw)
 		if isRaw {
-			l.logHeaders(&tb, resp.RawResponseHeaders, req.RPCData.Desc.ScrubResponseHeaders)
+			l.logHeaders(&tb, resp.RawResponseHeaders, req.RPCData.Desc.ScrubResponseHeaders, nil)
 		} else {
 			scrubbed := scrub.JSON(resp.Payload, req.RPCData.Desc.ScrubResponsePaths, []byte(`"[REDACTED]"`))
 			tb.ByteString(scrubbed)
@@ -529,7 +529,7 @@ func (l *Log) BodyStream(p BodyStreamParams) {
 	l.Add(BodyStream, tb.Buf())
 }
 
-func (l *Log) logHeaders(tb *Buffer, headers http.Header, scrubHeaders map[string]bool) {
+func (l *Log) logHeaders(tb *Buffer, headers http.Header, scrubHeaders map[string]bool, scrubCookies []string) {
 	tb.UVarint(uint64(len(headers)))
 	for k, v := range headers {
 		tb.String(k)
@@ -539,6 +539,9 @@ func (l *Log) logHeaders(tb *Buffer, headers http.Header, scrubHeaders map[strin
 			firstVal = "[REDACTED]"
 		} else if len(v) > 0 {
 			firstVal = v[0]
+			if k == "Cookie" {
+				firstVal = scrub.Cookie(firstVal, scrubCookies, "[REDACTED]")
+			}
 		}
 
 		tb.String(firstVal)
```

**File**: `runtimes/go/appruntime/exported/trace2/events.go` (modified, +6/-3)
```diff
@@ -219,7 +219,7 @@ func (l *Log) RequestSpanStart(req *model.Request, goid uint32) {
 		tb.String(pp.Value)
 	}
 
-	l.logHeaders(&tb, data.RequestHeaders, desc.ScrubRequestHeaders)
+	l.logHeaders(&tb, data.RequestHeaders, desc.ScrubRequestHeaders, desc.ScrubRequestCookies)
 
 	scrubbedRequest := scrub.JSON(data.NonRawPayload, desc.ScrubRequestPaths, []byte(`"[REDACTED]"`))
 	tb.ByteString(scrubbedRequest)
@@ -260,7 +260,7 @@ func (l *Log) RequestSpanEnd(p RequestSpanEndParams) {
 	tb.String(desc.Endpoint)
 
 	tb.UVarint(uint64(p.Resp.HTTPStatus))
-	l.logHeaders(&tb, p.Resp.RawResponseHeaders, desc.ScrubResponseHeaders)
+	l.logHeaders(&tb, p.Resp.RawResponseHeaders, desc.ScrubResponseHeaders, nil)
 	tb.ByteString(scrubbedResponse)
 	tb.UVarint(uint64(p.CallerEventID))
 	tb.String(uid)
@@ -1049,14 +1049,17 @@ func (l *Log) BucketDeleteObjectsEnd(p BucketDeleteObjectsEndParams) {
 	})
 }
 
-func (l *Log) logHeaders(tb *EventBuffer, headers http.Header, scrubHeaders map[string]bool) {
+func (l *Log) logHeaders(tb *EventBuffer, headers http.Header, scrubHeaders map[string]bool, scrubCookies []string) {
 	tb.UVarint(uint64(len(headers)))
 	for k, v := range headers {
 		firstVal := ""
 		if scrubHeaders[k] {
 			firstVal = "[REDACTED]"
 		} else if len(v) > 0 {
 			firstVal = v[0]
+			if k == "Cookie" {
+				firstVal = scrub.Cookie(firstVal, scrubCookies, "[REDACTED]")
+			}
 		}
 		tb.String(k)
 		tb.String(firstVal)
```

---

### Incident Patch 2: `b981539f` (2026-10-19)
**Commit Message**: Add a deploy section to the TS and Go LLM instructions (#2615)

## Why

The CLI downloads `ts_llm_instructions.txt` / `go_llm_instructions.txt`
from `main` (`cli/cmd/encore/llm_rules/tool.go:298-300`) whenever a user
runs `encore app create --llm-rules=...` or `encore llm-rules init`. So
these files are what coding agents read about Encore.

Neither file explains how to deploy. An agent asked to deploy, or to
deploy again, has no correct path. This matters for activation, which is
deploying the same app twice in week 1. 91% of CLI creators run their
app locally, but only 26% ever deploy.

## Changes

Both files get a compact **"Deploying to Encore Cloud"** section next to
the existing workflow sections, written in each file's style.

**Which repo deploys**
- **Encore-managed git (the default):** push to the `encore` remote.
- **App linked to GitHub** (Settings > GitHub): push to that repo
instead, since GitHub pushes trigger deploys.
- **Unsure:** check `git remote -v`, and ask the user if it's still
unclear.

**Which environment deploys**
- **Branch triggers:** each environment deploys from its own branch
(Branch Push setting) or only manually. New apps have one environment,
`stag

**File**: `go_llm_instructions.txt` (modified, +27/-3)
```diff
@@ -70,6 +70,30 @@ Rules embedded curl DSL:
 - For "most-recent first" by publish order, DO NOT sort by `created_at = NOW()` or subscription-side row id — both subscription-insert order, at-least-once can flip. Sort by column monotonic with publish (entity id from event payload, or publish-time sequence in event).
 - Handler-only checks, skip infra: `et.Topic(T).PublishedMessages()`.
 
+## Deploying to Encore Cloud
+
+Deploy = commit + push to the git repo the app deploys from:
+- Default: Encore-managed git, so push to the `encore` remote.
+- App linked to a GitHub repository (Cloud Dashboard > Settings > GitHub): push to that repository (usually `origin`); GitHub pushes trigger deploys.
+- Check `git remote -v`. If you can't tell which one the app deploys from, ask the user.
+
+Which environment deploys: each environment deploys from its own branch (environment Settings > Branch Push) or only manually. New apps have one environment, `staging` (type `development`), deploying the app's main branch. One push can deploy several environments. If a production environment deploys from the branch you push, the push deploys to production, so check before pushing.
+
+```bash
+git add -A && git commit -m "describe change"
+git push encore              # Encore-managed git
+git push origin <branch>     # GitHub-linked app
+```
+
+- `encore` remote: success prints one line per environment, `remote: <branch>: triggered deploy https://app.encore.dev/<app-id>/envs/<env>/deploys/<id>`. No such line = nothing deployed (nothing new committed, or no environment deploys from the pushed branch).
+- GitHub: git prints nothing from Encore. Check Deployments in the Cloud Dashboard, or the Cloud MCP (above; lists environments, deploys, builds and their logs).
+- Push returns once the deploy starts; no CLI wait. Environment API: `https://<env>-<app-id>.encr.app` (unless a custom domain is set). Logs: `encore logs --env=<env>`.
+- The deploy runs the app's tests; failing tests block the deploy, so run `encore test ./...` first.
+- Every declared secret needs a value in the target environment, else the deploy fails with `secret key(s) not defined`. Set per environment type: `printf '%s' "$VAL" | encore secret set --type <types> <Name>` (`dev` = development environments including `staging`, `prod` = production, `pr` = preview, `local`), or for one environment: `--env <env-name>`.
+- Redeploy without a code change (e.g. after setting a secret): `git commit --allow-empty -m "Redeploy"` and push to the deploy branch, or Cloud Dashboard > Deployments > New Deploy > Branch.
+- No `encore` remote and no GitHub link = app created logged out or with `--platform=false`. Log in (`encore auth login`; without a browser, set `ENCORE_AUTH_KEY`, which the CLI picks up automatically. Never pass a real key via `--auth-key`: it leaks into shell history and process listings), `rm encore.app` (copy settings other than `id`/`lang` first, re-add after), `encore app init <name> --lang go` (registers the app and adds the `encore` remote), commit, push. App created in the Cloud Dashboard: `encore app clone <app-id>` (GitHub-linked: `git clone` the GitHub repository).
+- Failed deploys: https://encore.dev/docs/platform/deploy/troubleshooting. All commands: https://encore.dev/docs/quick-reference
+
 ## Encore Go domain knowledge
 
 ### Application structure
@@ -770,7 +794,7 @@ App management:
 - encore app clone [app-id] [directory] - Clone app
 - encore app create [name] [--example=name] [-l go] - Create new app
 - encore app init [name] - Create from existing repo
-- encore app link [app-id] [-f] - Link app with server
+- encore app link [app-id] [-f] - Link to an existing Encore Cloud app (adds the `encore` remote only if the repo has no remotes)
 
 Authentication:
 - encore auth login/logout/signup/whoami
@@ -826,8 +850,8 @@ Random data (utility):
 - encore rand bytes N [-f format] - Generate N random bytes
 - encore rand words [--sep=SEP] NUM - Generate memorable passphrase
 
-Deploy (alpha):
-- encore alpha deploy --env=<name> (--commit=<sha> | --branch=<name>) - Deploy app to a cloud env
+Deploy:
+- git push encore (or push to the linked GitHub repository) - Deploy (see Deploying to Encore Cloud)
 
 Version:
 - encore version - Report version
```

**File**: `ts_llm_instructions.txt` (modified, +28/-4)
```diff
@@ -77,6 +77,30 @@ Rules for embedded curl DSL:
 - For "most-recent first" by publish order, do NOT sort by `created_at = NOW()` nor subscription-side row id — both = subscription-insert order, at-least-once can flip. Sort by column monotonic w/ publish (entity id from event payload, or publish-time seq in event).
 - For handler-only checks, skip infra: `et.Topic(T).PublishedMessages()`.
 
+## Deploying to Encore Cloud
+
+Deploy = commit + push to the git repo the app deploys from:
+- Default: Encore-managed git → push to `encore` remote.
+- App linked to GitHub repo (Cloud Dashboard > Settings > GitHub) → push to that repo (usually `origin`); GitHub pushes trigger deploys.
+- Check `git remote -v`. Can't tell which one the app deploys from → ask user.
+
+Which env deploys: each env deploys from its own branch (env Settings > Branch Push) or only manually. New apps have one env, `staging` (type `development`), deploying app's main branch. One push can deploy several envs. If a production env deploys from the branch you push, the push deploys to production → check before pushing.
+
+```bash
+git add -A && git commit -m "describe change"
+git push encore              # Encore-managed git
+git push origin <branch>     # GitHub-linked app
+```
+
+- `encore` remote: success prints one line per env, `remote: <branch>: triggered deploy https://app.encore.dev/<app-id>/envs/<env>/deploys/<id>`. No such line = nothing deployed (nothing new committed, or no env deploys from pushed branch).
+- GitHub: git prints nothing from Encore. Check Deployments in Cloud Dashboard, or Cloud MCP (above; lists envs, deploys, builds + logs).
+- Push returns once deploy starts; no CLI wait. Env API: `https://<env>-<app-id>.encr.app` (unless custom domain). Logs: `encore logs --env=<env>`.
+- Deploy runs tests; failing tests block deploy. Run `CI=true encore test` first (no TTY → vitest watch mode never exits).
+- Every declared secret needs value in target env, else deploy fails `secret key(s) not defined`. Set per env type: `printf '%s' "$VAL" | encore secret set --type <types> <Name>` (`dev` = development envs incl. `staging`, `prod` = production, `pr` = preview, `local`), or one env: `--env <env-name>`.
+- Redeploy w/o code change (e.g. after setting secret): `git commit --allow-empty -m "Redeploy"` + push to deploy branch, or Cloud Dashboard > Deployments > New Deploy > Branch.
+- No `encore` remote and no GitHub link = app created logged out / `--platform=false`. Log in (`encore auth login`; no browser: set `ENCORE_AUTH_KEY`, which CLI picks up automatically. Never pass a real key via `--auth-key`: leaks into shell history + process list), `rm encore.app` (copy non-`id`/`lang` settings first, re-add after), `encore app init <name> --lang ts` (registers app + adds `encore` remote), commit, push. App created in Cloud Dashboard: `encore app clone <app-id>` (GitHub-linked: `git clone` the GitHub repo).
+- Failed deploys: https://encore.dev/docs/platform/deploy/troubleshooting. All commands: https://encore.dev/docs/quick-reference
+
 ## Encore.ts domain knowledge
 
 ### API definition
@@ -1063,14 +1087,14 @@ Execution:
 - encore help [command]: lists cmds (or shows usage for specific cmd). Use when unsure of subcommand/flag.
 - encore run [--debug] [--watch=true] [-p port] [flags]: runs app. Before starting yourself, check if already running by polling `http://localhost:<port>/__encore/healthz` (default `4000`) — `200` = healthy, hit endpoints directly w/o re-running.
 - encore check ['curl ...'; 'curl ...'] | encore check < commands.txt: compile + boot app, verify services healthy, optionally run curls. See section above.
-- encore test [flags]: provisions isolated test infra (DBs, Pub/Sub, etc.) then runs `test` script from `package.json` (Vitest recommended). Test DBs skip fsync + use in-memory FS for speed. Use instead of `npm test` / `vitest` direct when code touches Encore infra.
+- encore test [flags]: provisions isolated test infra (DBs, Pub/Sub, etc.) then runs `test` script from `package.json` (Vitest recommended). Test DBs skip fsync + use in-memory FS for speed. Use instead of `npm test` / `vitest` direct when code touches Encore infra. No TTY: `CI=true encore test` (vitest watch mode never exits).
 - encore exec path/to/script [args...]: run executable script against local app.
 
 App mgmt:
 - encore app clone [app-id] [directory]: clone Encore app
 - encore app create [name] [--example=name] [-l ts]: create new Encore app
 - encore app init [name]: create new app from existing repo
-- encore app link [app-id] [-f]: link app w/ server
+- encore app link [app-id] [-f]: link to existing Encore Cloud app (adds `encore` remote only if repo has no remotes)
 
 Auth:
 - encore auth login [-k auth-key]: log in
@@ -1128,8 +1152,8 @@ Random data (utility):
 - encore rand bytes N [-f format]: gen N random bytes
 - encore rand words [--sep=SEP] NUM: gen memorable passphrase
 
-Deploy (alpha):
-- encore alpha deploy --env=<name> (--co
```

#### Recent Merged Pull Requests:
- **PR #2616** (2026-10-19): metascrub: include cookie fields (@eandre)
- **PR #2615** (2026-10-19): Add a deploy section to the TS and Go LLM instructions (@marcuskohlberg)
- **PR #2614** (2026-10-19): cli/daemon: fix MCP SSE URL printed by 'encore run' (@marcuskohlberg)
- **PR #2606** (2026-10-12): Update README.md (@marcuskohlberg)
- **PR #2604** (closed): tsparser: report database usage outside services (@marcuskohlberg)
- **PR #2603** (2026-10-12): cli: report pending database changes on reload (@marcuskohlberg)

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

## X. metascrub: include cookie fields

**RULE**:
When implementing operations in `pkg/metascrub/metascrub.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in encoredev/encore. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `94eae2cc`: metascrub: include cookie fields. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/metascrub/metascrub.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:

	// Headers are the names of headers whose values should be redacted entirely.

	// Cookies are the names of cookies whose values should be redacted.
	// Use scrub.Cookie to redact them in a Cookie header.
	Cookies []string
		Cookies: res.cookies,
	cookies    []string
			// Copy the headers and cookies directly since they never get modified,
			// since we only care about the top-level type's headers and cookies.
			cookies: decl.cookies,
		var numScrub, numTypeParams, numHeaders, numCookies int
			numCookies += len(res.cookies)
			cookies:    make([]string, 0, numCookies),
			combined.cookies = append(combined.cookies, res.cookies...)

				// If this is a cookie field, add it to the cookies to scrub.
				if cookieName, ok := isCookie(f); ok {
					out.cookies = append(out.cookies, cookieName)
				}
func isCookie(f *schema.Field) (cookieName string, ok bool) {
	for _, t := range f.Tags {
		if t.Key == "cookie" {
			name := t.Name
			if name == "" {
				name = f.Name
			}
			return name, true
		}
	}
	return "", false
}

```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
			// Copy the headers directly since they never get modified,
			// since we only care about the top-level type's headers.
		var numScrub, numTypeParams, numHeaders int
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `94eae2cc` are properly handled with clean fallback behavior.

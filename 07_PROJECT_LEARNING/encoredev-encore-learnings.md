# Forensic Learning Record (Deep Inspection): encoredev/encore

> **Canonical Artifact**: `07_PROJECT_LEARNING/encoredev-encore-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/encoredev/encore](https://github.com/encoredev/encore))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:00:59.362Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `encoredev/encore`
- **Description**: The infrastructure platform for the intelligence era
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: Cargo.toml, go.mod, README.md
- **Stars / Engagement**: 12413 stars

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
	"sync"
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
		ls
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

### Core Architecture Module: `cli/cmd/encore/bits/bits.go`
```
package bits

import (
	"github.com/spf13/cobra"

	"encr.dev/cli/cmd/encore/root"
)

var bitsCmd = &cobra.Command{
	Use:   "bits",
	Short: "Commands to manage encore bits, reusable functionality for Encore applications",
}

func init() {
	root.Cmd.AddCommand(bitsCmd)
}

```

### Core Architecture Module: `cli/cmd/encore/bits/list.go`
```
package bits

import (
	"context"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"

	"encr.dev/cli/cmd/encore/cmdutil"
	"encr.dev/pkg/bits"
)

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "Lists available Encore Bits to add to your application",
	Args:  cobra.ExactArgs(0),
	Run: func(c *cobra.Command, args []string) {
		bits, err := bits.List(context.Background())
		if err != nil {
			cmdutil.Fatalf("could not list encore bits: %v", err)
		}

		tw := tabwriter.NewWriter(os.Stdout, 0, 8, 0, '\t', 0)
		fmt.Fprintln(tw, "ID\tTitle\tDescription")
		for _, bit := range bits {
			fmt.Fprintf(tw, "%s\t%s\t%s\n", bit.Slug, bit.Title, bit.Description)
			fmt.Fprintln(tw)
		}
		tw.Flush()
	},
}

func init() {
	bitsCmd.AddCommand(listCmd)
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
  **Post-Mortem & Fix Analysis**:
  > any solution for setting cookie headers from encore backend ? 
  > Also looking for solutions to setting cookies from encore.dev and reading same cookies in other api calls.
  > @eandre 

- **Issue #1051** (2024-02-28): **Sending metrics to mimir does not seem to isolate environments**
  *Symptoms*: I've setup a "grafana cloud" metrics endpoint using memir, we started to ship production metrics, everything is working fine. In the metrics view of encore, we see a point in time where metrics stop and new metrics start.   When I try to connect staging to the same metrics target, and deploy. I immediately see metrics, which appear to be my production metrics, so it seems like the metrics view of encore is no correctly using env tags.  This is the view of staging while it was still using encore for metrics  ![Screenshot 2024-02-28 at 10 49 18](https://github.com/encoredev/encore/assets/108635/0d3d1298-21ab-42d4-b2cb-709490a35701)  and this is the view immediatly after switching to the mimir target (there should be no metrics there)  ![Screenshot 2024-02-28 at 10 50 34](https://github.com/encoredev/encore/assets/108635/8b283afe-901e-4ff3-8942-b70641854789) 
  **Post-Mortem & Fix Analysis**:
  > Thanks @danhawkins. Deploying a fix as we speak.

- **Issue #1020** (2024-02-26): **Javascript generated client triggers errors on User-Agent in browser**
  *Symptoms*: ### Description of the Problem  While learning encore.dev using the [uptime tutorial](https://encore.dev/docs/tutorials/uptime) I found out the frontend client generates the following errors in the browser console  ``` Refused to set unsafe header "User-Agent" ```  The error is thrown because the generated js client [attempts to set the User-Agent](https://github.com/encoredev/encore/blob/main/internal/clientgen/javascript.go#L480) and the browser doesn't allow it.   ### Expected Behavior Generated JS client for browser should not attempt to set User-Agent. User-Agent should be only set when the client is used in backend services.   ### Environment - Mac Sonoma 14.2.1 - Chrome 120.0.6099.234
  **Post-Mortem & Fix Analysis**:
  > Thanks @rewop. We don't have a good way of distinguishing between client generation for frontend use and for backend use at the moment, but until we do it's a better default to not send the User-Agent header. Want to submit a PR?
  > @eandre I should have a PR today or tomorrow. 

- **Issue #652** (2023-05-08): **[BUG]: Topic missing publisher role in GCP deployment**
  *Symptoms*: ## Description  Few days back, I faced an issue when I deployed my application to GCP for production usage. The `topic` created was missing publisher role for the Cloud Run.  <img width="410" alt="Screenshot 2023-04-04 at 4 23 52 PM" src="https://user-images.githubusercontent.com/17452272/229771127-34403b6f-4313-4116-a837-8b9e9fd5fe4e.png">  --- To fix it I have to manually add the permission.  
  **Post-Mortem & Fix Analysis**:
  > Hi @onlywicked, thanks for the report. Did you actually call `Publish` on the topic somewhere? Encore only adds the permission when you actually publish messages.
  > @eandre Yep, I did. Because and that's how I came to know about it.  I was getting the following error:  `failed to publish message to {topic_name}: rpc error: code = PermissionDenied desc = User not authorized to perform this action.`  After that I went into project and found that the permission wasn't there.
  > Hmm, that's very strange, that shouldn't happen. Can you share which Encore application and which deploy id that triggered this? I'll have a look at the infrastructure planning.

- **Issue #619** (2023-02-22): **[ENC-1288] Fix indeterministic build/encore run**
  *Symptoms*: This commit fixes a bug introduced in #505 when we made the parser run in parallel.  The issue ultimately was a race condition within the main goroutine, such that when the last worker finished parsing a package, the main goroutine could either read from the `pkgCh` or the `workerDone` channel.  If it picked the `workerDone` channel, then the last package would never be added to the list of known packages, which could result in random errors later in the encore parse/compile pipeline.  I've also updated the unit tests to ensure the test cache is cleared for each PR
  **Post-Mortem & Fix Analysis**:
  > All committers have signed the CLA.

- **Issue #556** (2022-12-20): **Generated TypeScript client doesn't work with built-in fetch out of the box**
  *Symptoms*: The built-in fetch function isn't bound correctly when using the generated TypeScript client. It needs to be bound using `fetch.bind(self)`. But what's more, it doesn't work correctly when running in server-side Node environments. A better way to fix this is to depend on a library like `cross-fetch` that provides an abstraction that automatically selects the correct `fetch` implementation.

- **Issue #554** (2022-12-20): **When linking an app the Encore daemon still thinks it's not linked**
  *Symptoms*: We cache the platform id inside the daemon, and if it changes we don't re-check it. This is a problem particularly when an app is not linked, in which case we return an error saying the user needs to link it. Upon linking it, however, the absence of a platform id is cached and won't be re-fetched.

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

### Incident Patch 1: `d2b21473` (2026-10-01)
**Commit Message**: fix clippy warnings

**File**: `Cargo.lock` (modified, +14/-3)
```diff
@@ -293,13 +293,13 @@ dependencies = [
 
 [[package]]
 name = "async-trait"
-version = "0.1.85"
+version = "0.1.92"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3f934833b4b7233644e5848f235df3f57ed8c80f1528a26c3dfa13d2147fa056"
+checksum = "82f6aeea286b8eb4dd3431a1be1b59d290ace00f5bfd8e2a159bc2a05e2c1667"
 dependencies = [
  "proc-macro2",
  "quote",
- "syn 2.0.95",
+ "syn 3.0.6",
 ]
 
 [[package]]
@@ -7323,6 +7323,17 @@ dependencies = [
  "unicode-ident",
 ]
 
+[[package]]
+name = "syn"
+version = "3.0.6"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "8593e8e72159ed2257d083c7a454a85cbf854f37a0966d8d483aff8c8a3ebcee"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "unicode-ident",
+]
+
 [[package]]
 name = "sync_wrapper"
 version = "0.1.2"
```

**File**: `runtimes/core/src/log/writers.rs` (modified, +3/-5)
```diff
@@ -34,11 +34,9 @@ impl Debug for dyn Writer {
 pub fn default_writer(fields: &'static FieldConfig) -> Arc<dyn Writer> {
     // Check if the user has set the `ENCORE_LOG_FORMAT` environment variable to `console`.
     // if so we'll use the pretty console writer.
-    for var in &["ENCORE_LOG_FORMAT"] {
-        if let Ok(format) = env::var(var) {
-            if format == "console" {
-                return Arc::new(ConsoleWriter::new(fields, std::io::stderr()));
-            }
+    if let Ok(format) = env::var("ENCORE_LOG_FORMAT") {
+        if format == "console" {
+            return Arc::new(ConsoleWriter::new(fields, std::io::stderr()));
         }
     }
 
```

---

### Incident Patch 2: `0110a955` (2026-10-01)
**Commit Message**: .github: build latest release in release mode

**File**: `pkg/releaser/cmd/build/main.go` (modified, +4/-6)
```diff
@@ -33,7 +33,6 @@ import (
 	"github.com/rs/zerolog/log"
 	"golang.org/x/sync/errgroup"
 
-	"encr.dev/internal/version"
 	opt "encr.dev/pkg/option"
 	. "encr.dev/pkg/releaser/bu"
 	"encr.dev/pkg/releaser/config"
@@ -347,7 +346,6 @@ func parsePlatformSpec(target Platform, val string) (PlatformSpec, error) {
 func (p PlatformSpec) Build() (*ReleaseSpec, error) {
 	log.Info().Str("os", p.Target.OS.String()).Str("arch", p.Target.Arch.String()).Msg("building platform")
 	p.Workdir.MkdirAll()
-	channel := version.ChannelFor(cfg.Version)
 	ctx := context.Background()
 	cargoCacheBase := FSPath(cfg.EncoreRepo).Join("target", p.Target.OS.String()+"-"+p.Target.Arch.String())
 	cargoCacheBase.MkdirAll()
@@ -454,7 +452,7 @@ func (p PlatformSpec) Build() (*ReleaseSpec, error) {
 				Host:            host,
 				Target:          p.Target,
 				CargoTargetDir:  cargoCacheBase,
-				ReleaseBuild:    channel == version.GA,
+				ReleaseBuild:    true,
 				ForDistribution: true,
 				Version:         cfg.Version,
 				CrossMacSDKPath: cfg.MacOSSDK,
@@ -475,7 +473,7 @@ func (p PlatformSpec) Build() (*ReleaseSpec, error) {
 				Host:            host,
 				Target:          p.Target,
 				CargoTargetDir:  cargoCacheBase,
-				ReleaseBuild:    channel == version.GA,
+				ReleaseBuild:    true,
 				ForDistribution: true,
 				Version:         cfg.Version,
 				CrossMacSDKPath: cfg.MacOSSDK,
@@ -496,7 +494,7 @@ func (p PlatformSpec) Build() (*ReleaseSpec, error) {
 				Host:            host,
 				Target:          p.Target,
 				CargoTargetDir:  cargoCacheBase,
-				ReleaseBuild:    channel == version.GA,
+				ReleaseBuild:    true,
 				ForDistribution: true,
 				NapiTypeDefPath: napiTypeDefPath,
 				Version:         cfg.Version,
@@ -551,7 +549,7 @@ func (p PlatformSpec) Build() (*ReleaseSpec, error) {
 		wasmOut, err := tsparserwasm.Compile(ctx, tsparserwasm.CompileInput{
 			Host:           host,
 			CargoTargetDir: cargoCacheBase,
-			ReleaseBuild:   channel == version.GA,
+			ReleaseBuild:   true,
 			Version:        cfg.Version,
 		})
 		if err != nil {
```

---

### Incident Patch 3: `a59a6c0b` (2026-09-28)
**Commit Message**: fix(daemon): migration uses wrong context (#2585)

<!-- codesmith:footer -->
---
<a
href="https://app.blacksmith.sh/encoredev/codesmith/encore/pr/2585?autoLogin=true&ref=codesmith_pr_footer"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v2.svg"><img
alt="View with [code]smith"
src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"></picture></a>
<a
href="https://backend.blacksmith.sh/track/enable-autofix?expires=1793195099&installation_model_id=427204&pr_number=2585&ref=codesmith_pr_footer&repository=encoredev%2Fencore&return_to=https%3A%2F%2Fgithub.com%2Fencoredev%2Fencore%2Fpull%2F2585&signature=32d4d5588d67e13605068d5d834de2c42eb2735b15c8005ac54f26c1a1163a1a"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-dark.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-

**File**: `cli/daemon/sqldb/migrate.go` (modified, +1/-1)
```diff
@@ -286,7 +286,7 @@ func LoadAppliedVersions(ctx context.Context, conn *sql.Conn, schemaName, migrat
 	appliedVersions := map[uint64]bool{}
 
 	query := `SELECT version, dirty FROM ` + pq.QuoteIdentifier(schemaName) + `.` + pq.QuoteIdentifier(migrationsTable) + ` ORDER BY version`
-	rows, err := conn.QueryContext(context.Background(), query)
+	rows, err := conn.QueryContext(ctx, query)
 	if err != nil {
 		if e, ok := err.(*pq.Error); ok {
 			if e.Code.Name() == "undefined_table" {
```

---

### Incident Patch 4: `95456970` (2026-09-17)
**Commit Message**:  cli/daemon: paginate and filter traces, budget trace data by size not count  (#2582)

<!-- codesmith:footer -->
---
<a
href="https://app.blacksmith.sh/encoredev/codesmith/encore/pr/2582"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v2.svg"><img
alt="View with [code]smith"
src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"></picture></a>
<a
href="https://backend.blacksmith.sh/track/enable-autofix?expires=1792228233&installation_model_id=427204&pr_number=2582&repository=encoredev%2Fencore&return_to=https%3A%2F%2Fgithub.com%2Fencoredev%2Fencore%2Fpull%2F2582&signature=929d78cc721cf1f459191a02bb874925fa01e3578a8853ecc1dce89cefbdfb6c"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-dark.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-light.svg"><img
a

**File**: `cli/cmd/encore/daemon/daemon.go` (modified, +35/-1)
```diff
@@ -158,7 +158,23 @@ func (d *Daemon) init(ctx context.Context) {
 	d.PublicBuckets = objects.NewPublicBucketServer("http://"+d.ObjectStorage.ClientAddr(), d.ObjectsMgr.PersistentStoreFallback)
 
 	traceStore := sqlite.New(d.EncoreDB)
-	go traceStore.CleanEvery(ctx, 1*time.Minute, 500, 100, 10000)
+	// Disk budget for trace data. The dashboard pages back through it, so it
+	// doesn't limit what's visible. The floor keeps the newest traces whatever
+	// their size, so a tight budget can't empty the dashboard. The total is what
+	// actually bounds the file: the per-app budget alone would grow with the
+	// number of apps on the machine.
+	const (
+		maxTraceBytesPerApp = 50 << 20  // 50 MiB
+		maxTraceBytesTotal  = 250 << 20 // 250 MiB
+		minTracesKept       = 100
+	)
+	go traceStore.CleanEvery(ctx, 1*time.Minute, sqlite.CleanConfig{
+		MaxBytesPerApp: maxTraceBytesPerApp,
+		MaxBytesTotal:  maxTraceBytesTotal,
+		MinTracesKept:  minTracesKept,
+		BatchSize:      10000,
+		KnownApps:      d.knownAppIDs,
+	})
 	d.Trace = traceStore
 
 	d.RunMgr = &run.Manager{
@@ -187,6 +203,24 @@ func (d *Daemon) init(ctx context.Context) {
 	d.Server = daemon.New(d.Apps, d.RunMgr, d.ClusterMgr, d.Secret, d.NS, d.MCPMgr)
 }
 
+// knownAppIDs reports the ids the trace store may hold data for, under both the
+// ids an app's traces can be recorded as: a linked app records under its
+// platform id, an unlinked one under its local id.
+func (d *Daemon) knownAppIDs() ([]string, error) {
+	instances, err := d.Apps.List()
+	if err != nil {
+		return nil, err
+	}
+	ids := make([]string, 0, len(instances)*2)
+	for _, inst := range instances {
+		ids = append(ids, inst.LocalID())
+		if platformID := inst.PlatformID(); platformID != "" {
+			ids = append(ids, platformID)
+		}
+	}
+	return ids, nil
+}
+
 func (d *Daemon) serve() {
 	go d.serveDaemon()
 	go d.serveRuntime()
```

**File**: `cli/cmd/encore/daemon/migrations/7_trace_list_index.up.sql` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+CREATE INDEX IF NOT EXISTS trace_span_index_app_started
+    ON trace_span_index (app_id, started_at DESC);
```

**File**: `cli/daemon/dash/dash.go` (modified, +37/-4)
```diff
@@ -32,6 +32,9 @@ import (
 	meta "encr.dev/proto/encore/parser/meta/v1"
 )
 
+// maxTraceListLimit caps the page size a caller may ask for.
+const maxTraceListLimit = 500
+
 type handler struct {
 	rpc     jsonrpc2.Conn
 	apps    *apps.Manager
@@ -286,16 +289,46 @@ func (h *handler) Handle(ctx context.Context, reply jsonrpc2.Replier, r jsonrpc2
 			AppID      string `json:"app_id"`
 			MessageID  string `json:"message_id"`
 			TestTraces *bool  `json:"test_traces,omitempty"`
+			// Before pages backwards: return traces started at or before this
+			// unix-nanosecond timestamp. Zero means start from the newest.
+			Before int64 `json:"before,omitempty"`
+			// Limit is the page size the caller requests.
+			Limit int `json:"limit,omitempty"`
+
+			// Filters
+			Service      string `json:"service,omitempty"`
+			Endpoint     string `json:"endpoint,omitempty"`
+			Topic        string `json:"topic,omitempty"`
+			Subscription string `json:"subscription,omitempty"`
+			TraceID      string `json:"trace_id,omitempty"`
+			IsError      *bool  `json:"is_error,omitempty"`
+			// Microseconds; the dashboard takes milliseconds and converts. The
+			// duration filter is a lower bound only, so there is no maximum.
+			MinDurMicros uint64 `json:"min_duration,omitempty"`
 		}
 		if err := unmarshal(&params); err != nil {
 			return reply(ctx, nil, err)
 		}
 
 		query := &trace2.Query{
-			AppID:      params.AppID,
-			TestFilter: params.TestTraces,
-			MessageID:  params.MessageID,
-			Limit:      100,
+			AppID:        params.AppID,
+			TestFilter:   params.TestTraces,
+			MessageID:    params.MessageID,
+			Service:      params.Service,
+			Endpoint:     params.Endpoint,
+			Topic:        params.Topic,
+			Subscription: params.Subscription,
+			TraceID:      params.TraceID,
+			IsError:      params.IsError,
+			MinDurNanos:  params.MinDurMicros * 1000,
+			Limit:        min(params.Limit, maxTraceListLimit),
+		}
+		if params.Before > 0 {
+			// Inclusive, not exclusive: several traces can share a start
+			// timestamp, and an exclusive bound would drop the ones after the
+			// first at a page boundary. The caller re-receives the trace it
+			// paged from and is expected to discard duplicates by id.
+			query.EndTime = time.Unix(0, params.Before)
 		}
 		var list []*tracepb2.SpanSummary
 		iter := func(s *tracepb2.SpanSummary) bool {
```

**File**: `cli/daemon/engine/trace2/sqlite/clean_test.go` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+package sqlite
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"strings"
+	"testing"
+)
+
+// seedTraces inserts n traces of one bytesPer-sized event each, oldest first.
+func seedTraces(t *testing.T, s *Store, appID string, n, bytesPer int) {
+	t.Helper()
+	payload := strings.Repeat("x", bytesPer)
+	for i := 0; i < n; i++ {
+		traceID := fmt.Sprintf("%s-trace-%04d", appID, i)
+		if _, err := s.db.Exec(
+			`INSERT INTO trace_event (app_id, trace_id, span_id, event_data) VALUES (?, ?, ?, ?)`,
+			appID, traceID, "span", payload); err != nil {
+			t.Fatalf("insert event: %v", err)
+		}
+		if _, err := s.db.Exec(
+			`INSERT INTO trace_span_index (trace_id, span_id, app_id, span_type, has_response)
+			 VALUES (?, ?, ?, 1, true)`, traceID, "span", appID); err != nil {
+			t.Fatalf("insert span: %v", err)
+		}
+	}
+}
+
+func appStats(t *testing.T, s *Store, appID string) (traces int, bytes int64) {
+	t.Helper()
+	err := s.db.QueryRow(
+		`SELECT COUNT(DISTINCT trace_id), COALESCE(SUM(octet_length(event_data)), 0)
+		 FROM trace_event WHERE app_id = ?`, appID).Scan(&traces, &bytes)
+	if err != nil {
+		t.Fatalf("stats: %v", err)
+	}
+	return
+}
+
+func TestDoCleanTrimsToByteBudget(t *testing.T) {
+	s := newTestStore(t)
+	seedTraces(t, s, "app", 200, 1024)
+	const budget = 50 * 1024
+
+	for i := 0; i < 10; i++ {
+		if err := s.DoClean(context.Background(), CleanConfig{MaxBytesPerApp: budget, MinTracesKept: 1, BatchSize: 1000}); err != nil {
+			t.Fatalf("clean: %v", err)
+		}
+	}
+
+	traces, bytes := appStats(t, s, "app")
+	if bytes > budget {
+		t.Errorf("app still over budget: %d bytes > %d", bytes, budget)
+	}
+	if traces == 0 {
+		t.Error("everything was deleted")
+	}
+	// The survivors must be the newest ones.
+	var oldest string
+	if err := s.db.QueryRow(`SELECT MIN(trace_id) FROM trace_event WHERE app_id = ?`, "app").Scan(&oldest); err != nil {
+		t.Fatalf("oldest: %v", err)
+	}
+	if oldest < "app-trace-0100" {
+		t.Errorf("kept an old trace %q; expected only the newest to survive", oldest)
+	}
+	t.Logf("kept %d traces / %d bytes (budget %d)", traces, bytes, budget)
+}
+
+func TestDoCleanKeepsMinimumRegardlessOfSize(t *testing.T) {
+	s := newTestStore(t)
+	// Every trace on its own exceeds the budget.
+	seedTraces(t, s, "app", 20, 4096)
+	const budget = 100
+
+	for i := 0; i < 5; i++ {
+		if err := s.DoClean(context.Background(), CleanConfig{MaxBytesPerApp: budget, MinTracesKept: 3, BatchSize: 1000}); err != nil {
+			t.Fatalf("clean: %v", err)
+		}
+	}
+
+	traces, _ := appStats(t, s, "app")
+	if traces != 3 {
+		t.Errorf("got %d traces, want the 3 the floor guarantees", traces)
+	}
+}
+
+func TestDoCleanLeavesAppsUnderBudgetAlone(t *testing.T) {
+	s := newTestStore(t)
+	seedTraces(t, s, "small", 10, 1024)
+	seedTraces(t, s, "big", 200, 1024)
+	const budget = 50 * 1024
+
+	for i := 0; i < 10; i++ {
+		if err := s.DoClean(context.Background(), CleanConfig{MaxBytesPerApp: budget, MinTracesKept: 1, BatchSize: 1000}); err != nil {
+			t.Fatalf("clean: %v", err)
+		}
+	}
+
+	if traces, _ := appStats(t, s, "small"); traces != 10 {
+		t.Errorf("under-budget app lost traces: got %d, want 10", traces)
+	}
+	if _, bytes := appStats(t, s, "big"); bytes > budget {
+		t.Errorf("over-budget app not trimmed: %d bytes", bytes)
+	}
+}
+
+func TestDoCleanDeletesSpanRowsToo(t *testing.T) {
+	s := newTestStore(t)
+	seedTraces(t, s, "app", 200, 1024)
+
+	for i := 0; i < 10; i++ {
+		if err := s.DoClean(context.Background(), CleanConfig{MaxBytesPerApp: 50 * 1024, MinTracesKept: 1, BatchSize: 1000}); err != nil {
+			t.Fatalf("clean: %v", err)
+		}
+	}
+
+	var events, spans int
+	s.db.QueryRow(`SELECT COUNT(DISTINCT trace_id) FROM trace_event`).Scan(&events)
+	s.db.QueryRow(`SELECT COUNT(DISTINCT trace_id) FROM trace_span_index`).Scan(&spans)
+	if events != spans {
+		t.Errorf("trace_event has %d traces but trace_span_index has %d; they must be deleted together", events, spans)
+	}
+}
+
+func TestDoCleanEvictsLeastRecentAppsOverTotalBudget(t *testing.T) {
+	s := newTestStore(t)
+	// Seeded oldest-first, so "newest" has the highest event ids.
+	seedTraces(t, s, "oldest", 10, 1024)
+	seedTraces(t, s, "middle", 10, 1024)
+	seedTraces(t, s, "newest", 10, 1024)
+
+	// 30 KiB across three apps, with room for two.
+	cfg := CleanConfig{MaxBytesPerApp: 1 << 20, MaxBytesTotal: 25 * 1024, MinTracesKept: 1, BatchSize: 1000}
+	if err := s.DoClean(context.Background(), cfg); err != nil {
+		t.Fatalf("clean: %v", err)
+	}
+	for app, want := range map[string]int{"oldest": 0, "middle": 10, "newest": 10} {
+		if traces, _ := appStats(t, s, app); traces != want {
+			t.Errorf("app %q: got %d traces, want %d", app, traces, want)
+		}
+	}
+
+	// A budget smaller than any single app must still leave the active one.
+	cfg.MaxBytesTotal = 1
+	if err := s.DoClean(context.Background(), cfg); err != nil {
+		t.Fatalf("clean: %v", err)
+	}
+	if traces, _ := appStats(t, s, "newest"); traces == 0 {
+		t.Error("evicted the most recently activ
```

**File**: `cli/daemon/engine/trace2/sqlite/read.go` (modified, +6/-0)
```diff
@@ -33,6 +33,12 @@ func (s *Store) List(ctx context.Context, q *trace2.Query, iter trace2.ListEntry
 		extraWhereClause += " AND message_id = $" + strconv.Itoa(len(args))
 	}
 
+	if q.TraceID != "" {
+		// The dashboard's trace-id box is a search/substring match, not an exact lookup
+		args = append(args, q.TraceID)
+		extraWhereClause += " AND trace_id LIKE '%' || $" + strconv.Itoa(len(args)) + " || '%'"
+	}
+
 	if q.Service != "" {
 		args = append(args, q.Service)
 		extraWhereClause += " AND service_name = $" + strconv.Itoa(len(args))
```

**File**: `cli/daemon/engine/trace2/sqlite/read_test.go` (modified, +39/-5)
```diff
@@ -64,15 +64,15 @@ func newTestStore(t *testing.T) *Store {
 
 // writeRootRequest writes a complete root request span to the store, optionally
 // with a parent trace id, and returns the span's own trace id (encoded).
-func writeRootRequest(t *testing.T, s *Store, traceID *tracepb2.TraceID, spanID uint64, service, endpoint string, dur time.Duration, isError bool, parent *tracepb2.TraceID) string {
+func writeRootRequest(t *testing.T, s *Store, traceID *tracepb2.TraceID, spanID uint64, startedAt time.Time, service, endpoint string, dur time.Duration, isError bool, parent *tracepb2.TraceID) string {
 	t.Helper()
 	ctx := context.Background()
 	meta := &trace2.Meta{AppID: "app"}
 
 	start := &tracepb2.TraceEvent{
 		TraceId:   traceID,
 		SpanId:    spanID,
-		EventTime: timestamppb.New(time.Unix(0, 0)),
+		EventTime: timestamppb.New(startedAt),
 		Event: &tracepb2.TraceEvent_SpanStart{SpanStart: &tracepb2.SpanStart{
 			ParentTraceId: parent,
 			Data: &tracepb2.SpanStart_Request{Request: &tracepb2.RequestSpanStart{
@@ -88,7 +88,7 @@ func writeRootRequest(t *testing.T, s *Store, traceID *tracepb2.TraceID, spanID
 	end := &tracepb2.TraceEvent{
 		TraceId:   traceID,
 		SpanId:    spanID,
-		EventTime: timestamppb.New(time.Unix(0, int64(dur))),
+		EventTime: timestamppb.New(startedAt.Add(dur)),
 		Event: &tracepb2.TraceEvent_SpanEnd{SpanEnd: &tracepb2.SpanEnd{
 			DurationNanos: uint64(dur),
 			Error:         errPb,
@@ -123,10 +123,10 @@ func TestList_Filters(t *testing.T) {
 	parentID := encodeTraceID(parent)
 
 	// Child trace triggered by `parent`.
-	child := writeRootRequest(t, s, &tracepb2.TraceID{High: 1, Low: 2}, 100,
+	child := writeRootRequest(t, s, &tracepb2.TraceID{High: 1, Low: 2}, 100, time.Unix(0, 0),
 		"billing", "Charge", 50*time.Millisecond, false, parent)
 	// Unrelated slow + errored trace, no parent.
-	other := writeRootRequest(t, s, &tracepb2.TraceID{High: 3, Low: 4}, 200,
+	other := writeRootRequest(t, s, &tracepb2.TraceID{High: 3, Low: 4}, 200, time.Unix(0, 0),
 		"users", "Get", 500*time.Millisecond, true, nil)
 
 	contains := slices.Contains[[]string, string]
@@ -174,10 +174,44 @@ func TestList_Filters(t *testing.T) {
 		}
 	})
 
+	t.Run("trace_id_substring", func(t *testing.T) {
+		// The dashboard's trace-id box searches, so a fragment must match.
+		ids := listIDs(t, s, &trace2.Query{TraceID: child[5:15]})
+		if !contains(ids, child) || contains(ids, other) {
+			t.Fatalf("trace id filter: got %v, want only %v", ids, child)
+		}
+	})
+
 	t.Run("parent_trace_id_no_match", func(t *testing.T) {
 		ids := listIDs(t, s, &trace2.Query{ParentTraceID: encodeTraceID(&tracepb2.TraceID{High: 99, Low: 99})})
 		if len(ids) != 0 {
 			t.Fatalf("parent trace filter (no match): got %v, want none", ids)
 		}
 	})
 }
+
+// TestList_Pagination covers the dashboard's infinite scroll: a page of Limit
+// traces, then the next page keyed off the oldest one's start time. The cursor
+// is inclusive, so that trace comes back on both pages and the dashboard is
+// responsible for dropping the duplicate.
+func TestList_Pagination(t *testing.T) {
+	s := newTestStore(t)
+
+	base := time.Unix(1700000000, 0)
+	var ids []string
+	for i := 0; i < 4; i++ {
+		ids = append(ids, writeRootRequest(t, s, &tracepb2.TraceID{High: 1, Low: uint64(i)}, uint64(i),
+			base.Add(time.Duration(i)*time.Second), "svc", "Ep", time.Millisecond, false, nil))
+	}
+
+	first := listIDs(t, s, &trace2.Query{Limit: 2})
+	if !slices.Equal(first, []string{ids[3], ids[2]}) {
+		t.Fatalf("first page: got %v, want the two newest %v", first, ids[3:])
+	}
+
+	// Page back from the oldest trace on the first page.
+	second := listIDs(t, s, &trace2.Query{Limit: 2, EndTime: base.Add(2 * time.Second)})
+	if !slices.Equal(second, []string{ids[2], ids[1]}) {
+		t.Fatalf("second page: got %v, want the boundary trace repeated then the next", second)
+	}
+}
```

**File**: `cli/daemon/engine/trace2/sqlite/write.go` (modified, +156/-15)
```diff
@@ -47,23 +47,63 @@ func scanRows[T any](rows *sql.Rows) ([]T, error) {
 	return out, nil
 }
 
-func (s *Store) CleanEvery(ctx context.Context, freq time.Duration, triggerAt, eventsToKeep, batchSize int) {
+// CleanConfig bounds how much trace data the daemon keeps on disk. Sizes are
+// measured over trace_event alone; it holds the payloads and dominates.
+type CleanConfig struct {
+	// MaxBytesPerApp is one app's budget.
+	MaxBytesPerApp int64
+
+	// MaxBytesTotal bounds every app together, so the ceiling does not grow with
+	// the number of apps on the machine. Zero disables it.
+	MaxBytesTotal int64
+
+	// MinTracesKept is how many of an app's newest traces survive whatever their size.
+	MinTracesKept int
+
+	// BatchSize caps how many traces one sweep deletes per app.
+	BatchSize int
+
+	// KnownApps reports the apps the daemon still knows about, under every id
+	// their traces may be recorded as. Traces belonging to any other app are
+	// dropped. Nil, an error, or an empty result skips the prune.
+	KnownApps func() ([]string, error)
+}
+
+func (s *Store) CleanEvery(ctx context.Context, freq time.Duration, cfg CleanConfig) {
 	for {
 		timer := time.NewTimer(freq)
 		select {
 		case <-ctx.Done():
 			return
 		case <-timer.C:
-			if err := s.DoClean(ctx, triggerAt, eventsToKeep, batchSize); err != nil {
+			if err := s.DoClean(ctx, cfg); err != nil {
 				log.Error().Err(err).Msg("trace cleanup failed")
 			}
 		}
 	}
 }
 
-func (s *Store) DoClean(ctx context.Context, triggerAt, eventsToKeep, batchSize int) error {
+// DoClean drops traces the daemon no longer needs: those of apps it has
+// forgotten, then each app's oldest until it fits MaxBytesPerApp, then whole
+// apps oldest-first until everything fits MaxBytesTotal. Deleted pages go to
+// SQLite's freelist, so this bounds where the file settles, it does not shrink it.
+func (s *Store) DoClean(ctx context.Context, cfg CleanConfig) error {
 	log.Info().Msg("initiating trace event cleanup sweep")
-	rows, err := s.db.QueryContext(ctx, "SELECT app_id FROM trace_event GROUP BY app_id HAVING COUNT(distinct trace_id) > ?", triggerAt)
+	s.pruneUnknownApps(ctx, cfg.KnownApps)
+	if err := s.trimAppsOverBudget(ctx, cfg); err != nil {
+		return err
+	}
+	return s.enforceTotalBudget(ctx, cfg.MaxBytesTotal)
+}
+
+// trimAppsOverBudget drops each over-budget app's oldest traces until it fits,
+// keeping the newest MinTracesKept whatever their size. The budget is bytes
+// rather than traces because trace sizes vary hugely.
+func (s *Store) trimAppsOverBudget(ctx context.Context, cfg CleanConfig) error {
+	// octet_length, not length: on TEXT the latter counts characters, not bytes.
+	rows, err := s.db.QueryContext(ctx,
+		"SELECT app_id FROM trace_event GROUP BY app_id HAVING SUM(octet_length(event_data)) > ?",
+		cfg.MaxBytesPerApp)
 	if err != nil {
 		return errors.Wrap(err, "query app ids")
 	}
@@ -73,23 +113,31 @@ func (s *Store) DoClean(ctx context.Context, triggerAt, eventsToKeep, batchSize
 	}
 
 	for _, appID := range appIDs {
-		row := s.db.QueryRowContext(ctx, `
-						WITH latest_events AS (
-							SELECT trace_id, min(id) as id FROM trace_event WHERE app_id = ? GROUP BY 1 ORDER BY 2 DESC LIMIT ?
-						) SELECT min(id) FROM latest_events;
-					`, appID, eventsToKeep)
-		var traceID int64
-		err := row.Scan(&traceID)
+		// Accumulate bytes newest-first and take the traces past the budget.
+		// The rank guard keeps the newest MinTracesKept whatever their size.
+		rows, err := s.db.QueryContext(ctx, `
+			WITH sizes AS (
+				SELECT trace_id, MIN(id) AS ord, SUM(octet_length(event_data)) AS bytes
+				FROM trace_event WHERE app_id = ? GROUP BY trace_id
+			), running AS (
+				SELECT trace_id, ord, bytes,
+				       SUM(bytes) OVER (ORDER BY ord DESC) AS cum,
+				       ROW_NUMBER() OVER (ORDER BY ord DESC) AS rank
+				FROM sizes
+			)
+			SELECT trace_id FROM running
+			WHERE cum > ? AND rank > ?
+			ORDER BY ord ASC LIMIT ?
+		`, appID, cfg.MaxBytesPerApp, cfg.MinTracesKept, cfg.BatchSize)
 		if err != nil {
-			log.Error().Err(err).Msg("failed to get trace id")
+			log.Error().Err(err).Msg("failed to get old trace ids")
 			continue
 		}
-		rows, err := s.db.QueryContext(ctx, "SELECT DISTINCT trace_id FROM trace_event WHERE app_id = ? AND id < ? ORDER BY id DESC LIMIT ?", appID, traceID, batchSize)
+		traceIDs, err := scanRows[string](rows)
 		if err != nil {
-			log.Error().Err(err).Msg("failed to get old trace ids")
+			log.Error().Err(err).Msg("failed to scan old trace ids")
 			continue
 		}
-		traceIDs, err := scanRows[string](rows)
 		if len(traceIDs) == 0 {
 			continue
 		}
@@ -121,6 +169,99 @@ func (s *Store) DoClean(ctx context.Context, triggerAt, eventsToKeep, batchSize
 	return nil
 }
 
+// pruneUnknownApps drops the traces of apps the daemon no longer knows about.
+// Nothing else reclaims them: an app whose directory is gone loses its row in
+// the app table, and with it any way to reach its traces from the dashboard.
+f
```

---

### Incident Patch 5: `7bcb11b7` (2026-09-08)
**Commit Message**: tsparser: fix test

**File**: `tsparser/examples/testparse.rs` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ fn main() {
                 let pp = builder::PrepareParams {
                     app_root: app_root.clone(),
                     encore_dev_version: builder::PackageVersion::Published("0.0.0".to_string()),
+                    install_mode: builder::InstallMode::All,
                 };
                 builder.prepare(&pp).unwrap();
             }
```

---

### Incident Patch 6: `97f5124e` (2026-09-03)
**Commit Message**: fix: default to primary env for deploy command

**File**: `cli/cmd/encore/deploy.go` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ var deployAppCmd = &cobra.Command{
 func init() {
 	alphaCmd.AddCommand(deployAppCmd)
 	deployAppCmd.Flags().StringVar(&appSlug, "app", "", "app slug to deploy to (default current app)")
-	deployAppCmd.Flags().StringVarP(&envName, "env", "e", "", "environment to deploy to (default primary env)")
+	deployAppCmd.Flags().StringVarP(&envName, "env", "e", "", "environment to deploy to")
 	deployAppCmd.Flags().StringVar(&commit, "commit", "", "commit to deploy")
 	deployAppCmd.Flags().StringVar(&branch, "branch", "", "branch to deploy")
 	format.AddFlag(deployAppCmd)
```

---

### Incident Patch 7: `bbfd3673` (2026-09-02)
**Commit Message**: fix: logout does not fail when rotation of anonymous ID does

**File**: `cli/cmd/encore/auth/auth.go` (modified, +0/-1)
```diff
@@ -114,7 +114,6 @@ func DoLogin(flow Flow) (err error) {
 func DoLogout() {
 	if err := telemetry.RotateAnonymousID(); err != nil {
 		fmt.Fprintln(os.Stderr, "could not logout:", err)
-		os.Exit(1)
 	}
 
 	if err := conf.Logout(); err != nil {
```

---

### Incident Patch 8: `67eff2c1` (2026-09-02)
**Commit Message**: fix: load secrets once on local startup

**File**: `cli/daemon/run.go` (modified, +4/-1)
```diff
@@ -176,7 +176,10 @@ func (s *Server) Run(req *daemonpb.RunRequest, stream daemonpb.Daemon_RunServer)
 
 	ops.AllDone()
 
-	secrets, _ := s.sm.Load(app).Get(ctx, nil)
+	secrets, err := runInstance.SecretValues(ctx)
+	if err != nil {
+		log.Warn().Err(err).Str("runInstanceID", runInstance.ID).Msg("failed to load secrets")
+	}
 	externalDBs := map[string]string{}
 	for key, val := range secrets.Values {
 		if db, ok := strings.CutPrefix(key, "sqldb::"); ok {
```

**File**: `cli/daemon/run/run.go` (modified, +4/-0)
```diff
@@ -71,6 +71,10 @@ type Run struct {
 	started chan struct{}   // started is closed once the run has fully started
 }
 
+func (r *Run) SecretValues(ctx context.Context) (*secret.Data, error) {
+	return r.secrets.Get(ctx, nil)
+}
+
 // StartParams groups the parameters for the Run method.
 type StartParams struct {
 	// App is the app to start.
```

---

### Incident Patch 9: `44344384` (2026-09-02)
**Commit Message**: .github: move builders over to blacksmith (#2567)

<!-- codesmith:footer -->
---
<a
href="https://app.blacksmith.sh/encoredev/codesmith/encore/pr/2567"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v2.svg"><img
alt="View with [code]smith"
src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"></picture></a>
<a
href="https://backend.blacksmith.sh/track/enable-autofix?expires=1790964130&installation_model_id=427204&pr_number=2567&repository=encoredev%2Fencore&return_to=https%3A%2F%2Fgithub.com%2Fencoredev%2Fencore%2Fpull%2F2567&signature=d7396aa02cf6c70af1de5b6290e7c9285231ed66d66cc98ea3a42eca78d31460"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-dark.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-light.svg"><img
alt="Autofix with [code]smith"
src="h

**File**: `.github/actionlint.yaml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+# Runner labels actionlint doesn't know about: the CI and Latest Release
+# workflows run on Blacksmith (https://docs.blacksmith.sh) runners.
+self-hosted-runner:
+  labels:
+    - blacksmith-*
```

**File**: `.github/workflows/ci.yml` (modified, +13/-7)
```diff
@@ -1,5 +1,11 @@
 name: CI
 
+# Every job runs on a Blacksmith runner (like the Latest Release workflow):
+# 8 vCPUs everywhere except the TS runtime docs check, which gets 4. The
+# cache steps stay as they are: on Blacksmith runners actions/cache, and the
+# caching built into actions/setup-go/-node, transparently use Blacksmith's
+# colocated cache.
+
 on:
   push:
     branches:
@@ -13,7 +19,7 @@ on:
 jobs:
   build:
     name: "Build"
-    runs-on: ubuntu-24.04
+    runs-on: blacksmith-8vcpu-ubuntu-2404
 
     steps:
       - uses: actions/checkout@v4
@@ -40,7 +46,7 @@ jobs:
 
   test:
     name: "Test"
-    runs-on: ubuntu-24.04
+    runs-on: blacksmith-8vcpu-ubuntu-2404
 
     steps:
       - uses: actions/checkout@v4
@@ -125,7 +131,7 @@ jobs:
 
   test-e2e:
     name: "Test e2e"
-    runs-on: ubuntu-24.04
+    runs-on: blacksmith-8vcpu-ubuntu-2404
 
     steps:
       - uses: actions/checkout@v4
@@ -209,7 +215,7 @@ jobs:
   # Run static analysis on the PR
   static-analysis:
     name: "Static Analysis"
-    runs-on: ubuntu-latest
+    runs-on: blacksmith-8vcpu-ubuntu-2404
 
     # Skip any PR created by dependabot to avoid permission issues:
     if: (github.actor != 'dependabot[bot]')
@@ -244,7 +250,7 @@ jobs:
 
   rust_core:
     name: "Test core runtime"
-    runs-on: ubuntu-latest
+    runs-on: blacksmith-8vcpu-ubuntu-2404
     steps:
       - name: Checkout codebase
         uses: actions/checkout@v4
@@ -280,7 +286,7 @@ jobs:
 
   ts_runtime_docs:
     name: "Verify TS runtime docs in sync"
-    runs-on: ubuntu-24.04
+    runs-on: blacksmith-4vcpu-ubuntu-2404
     steps:
       - uses: actions/checkout@v4
       - name: Set up Node
@@ -300,7 +306,7 @@ jobs:
 
   wasm_build:
     name: "Build tsparser WASM"
-    runs-on: ubuntu-latest
+    runs-on: blacksmith-8vcpu-ubuntu-2404
     steps:
       - name: Checkout codebase
         uses: actions/checkout@v4
```

---

### Incident Patch 10: `471b4500` (2026-09-02)
**Commit Message**: .github: check that the built binary runs (#2566)

<!-- codesmith:footer -->
---
<a
href="https://app.blacksmith.sh/encoredev/codesmith/encore/pr/2566"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v2.svg"><img
alt="View with [code]smith"
src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"></picture></a>
<a
href="https://backend.blacksmith.sh/track/enable-autofix?expires=1790963161&installation_model_id=427204&pr_number=2566&repository=encoredev%2Fencore&return_to=https%3A%2F%2Fgithub.com%2Fencoredev%2Fencore%2Fpull%2F2566&signature=1c1b56c06081fec01754b5837f2485bc633098baad2ff27aa5a70e912bd3c7d2"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-dark.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-light.svg"><img
alt="Autofix with [code]smith"
src="h

**File**: `.github/workflows/latest-release.yml` (modified, +6/-0)
```diff
@@ -154,6 +154,12 @@ jobs:
         if: runner.os == 'Windows'
         uses: step-security/msvc-dev-cmd@22c98154b708dbd743e6f27a933cf6ceba3305c4 # v1.13.1
 
+      # darwin/amd64 is built on Apple Silicon; Rosetta lets the build's
+      # `encore version` smoke test run it.
+      - name: Install Rosetta
+        if: matrix.target == 'darwin/amd64'
+        run: sudo softwareupdate --install-rosetta --agree-to-license
+
       # pg_query's build script runs bindgen, which needs libclang.dll.
       # Blacksmith's Windows image has neither a standalone LLVM nor Visual
       # Studio's Clang component (Build Tools only), so install LLVM from the
```

**File**: `pkg/releaser/bu/bu.go` (modified, +9/-0)
```diff
@@ -41,6 +41,15 @@ func (p Platform) String() string {
 	return p.OS.String() + "/" + p.Arch.String()
 }
 
+// ExeSuffix is the executable file extension on the platform: ".exe" on
+// Windows, "" elsewhere.
+func (p Platform) ExeSuffix() string {
+	if p.OS == Windows {
+		return ".exe"
+	}
+	return ""
+}
+
 func (os OS) String() string {
 	return string(os)
 }
```

**File**: `pkg/releaser/cmd/build/main.go` (modified, +43/-5)
```diff
@@ -21,9 +21,12 @@ import (
 	"context"
 	"fmt"
 	"os"
+	"os/exec"
 	"path/filepath"
+	"runtime"
 	"strings"
 	"sync"
+	"time"
 
 	"github.com/cockroachdb/errors"
 	"github.com/rs/zerolog"
@@ -156,10 +159,7 @@ type ReleaseSpec struct {
 // bin/, encore-runtime.node, the npm package and the Go runtime; the
 // supervisor and the checksums are for on-demand download by the CLI.
 func (spec ReleaseSpec) Entries() gcsupload.Entries {
-	exe := ""
-	if spec.Target.OS == Windows {
-		exe = ".exe"
-	}
+	exe := spec.Target.ExeSuffix()
 
 	var bin, version gcsupload.Entries
 	if path, ok := spec.Tsparser.Get(); ok {
@@ -379,7 +379,9 @@ func (p PlatformSpec) Build() (*ReleaseSpec, error) {
 	if p.EncoreCLI {
 		g.Go(func() error {
 			log.Info().Msgf("compiling encore-cli")
-			outExePath := p.Workdir.Join("encorecli")
+			// Windows won't execute a file without the .exe extension, and
+			// the smoke test below runs the binary.
+			outExePath := p.Workdir.Join("encorecli" + p.Target.ExeSuffix())
 			err := gobuild.Exe(errGroupCtx, gobuild.ExeInput{
 				Host:            host,
 				Target:          p.Target,
@@ -392,6 +394,9 @@ func (p PlatformSpec) Build() (*ReleaseSpec, error) {
 			if err != nil {
 				return err
 			}
+			if err := smokeTestCLI(errGroupCtx, outExePath, p.Target); err != nil {
+				return err
+			}
 			spec.EncoreCLI = opt.Some(outExePath)
 			log.Info().Msgf("successfully compiled encore-cli")
 			return nil
@@ -558,3 +563,36 @@ func (p PlatformSpec) Build() (*ReleaseSpec, error) {
 
 	return spec, nil
 }
+
+// smokeTestCLI runs the freshly built CLI's `encore version` and checks that
+// it reports the version being built: a start-up check that catches the
+// link and runtime-initialization problems a successful compile can't (the
+// CLI is a large cgo binary). Only binaries the build host can execute are
+// run: same OS, and the same architecture unless the host is an Apple
+// Silicon Mac, which runs the darwin/amd64 build through Rosetta (the
+// workflow installs it).
+func smokeTestCLI(ctx context.Context, exe FSPath, target Platform) error {
+	sameOS := target.OS == OS(runtime.GOOS)
+	sameArch := target.Arch == Arch(runtime.GOARCH)
+	rosetta := target.OS == Darwin && runtime.GOARCH == "arm64" && target.Arch == Amd64
+	if !sameOS || !(sameArch || rosetta) {
+		log.Warn().Msgf("skipping `encore version` smoke test: this host can't run %s binaries", target)
+		return nil
+	}
+
+	// `encore version` also asks encore.dev whether an update is available,
+	// with a 10s timeout of its own.
+	ctx, cancel := context.WithTimeout(ctx, time.Minute)
+	defer cancel()
+	log.Info().Msgf("running `encore version` on the %s build", target)
+	out, err := exec.CommandContext(ctx, exe.ToIO(), "version").CombinedOutput()
+	if err != nil {
+		return errors.Wrapf(err, "`encore version` failed for %s:\n%s", target, out)
+	}
+	want := "encore version " + cfg.Version
+	if !strings.Contains(string(out), want) {
+		return errors.Newf("unexpected `encore version` output for %s: %q (want %q)", target, out, want)
+	}
+	log.Info().Msgf("%s", strings.TrimSpace(string(out)))
+	return nil
+}
```

---

### Incident Patch 11: `debb5360` (2026-09-02)
**Commit Message**: .github: install clang for windows build (#2565)

<!-- codesmith:footer -->
---
<a
href="https://app.blacksmith.sh/encoredev/codesmith/encore/pr/2565"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v2.svg"><img
alt="View with [code]smith"
src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"></picture></a>
<a
href="https://backend.blacksmith.sh/track/enable-autofix?expires=1790959092&installation_model_id=427204&pr_number=2565&repository=encoredev%2Fencore&return_to=https%3A%2F%2Fgithub.com%2Fencoredev%2Fencore%2Fpull%2F2565&signature=5e7f891c73bfd425f67ba9f4cc819d329924299ef24b3d8ab468402934dd89ff"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-dark.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-light.svg"><img
alt="Autofix with [code]smith"
src="ht

**File**: `.github/workflows/latest-release.yml` (modified, +14/-12)
```diff
@@ -62,6 +62,8 @@ env:
   CARGO_ZIGBUILD_VERSION: 0.23.3
   WASM_PACK_VERSION: 0.15.0
   NODE_VERSION: 22
+  # libclang for bindgen on Windows; see the "Install LLVM" step.
+  LLVM_VERSION: 22.1.8
 
 jobs:
   build:
@@ -152,21 +154,21 @@ jobs:
         if: runner.os == 'Windows'
         uses: step-security/msvc-dev-cmd@22c98154b708dbd743e6f27a933cf6ceba3305c4 # v1.13.1
 
-      # pg_query's build script runs bindgen, which needs libclang.dll. Point
-      # it at the copy bundled with Visual Studio's Clang component.
-      - name: Locate libclang
+      # pg_query's build script runs bindgen, which needs libclang.dll.
+      # Blacksmith's Windows image has neither a standalone LLVM nor Visual
+      # Studio's Clang component (Build Tools only), so install LLVM from the
+      # official release.
+      - name: Install LLVM
         if: runner.os == 'Windows'
         shell: pwsh
         run: |
-          $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
-          $dll = & $vswhere -latest -products * -find 'VC\Tools\Llvm\x64\bin\libclang.dll' | Select-Object -First 1
-          if (-not $dll) {
-            Write-Host "Visual Studio installations:"
-            & $vswhere -products * -property installationPath
-            throw "libclang.dll not found in any Visual Studio installation"
-          }
-          "LIBCLANG_PATH=$(Split-Path $dll)" >> $env:GITHUB_ENV
-          Write-Host "Using $dll"
+          $ProgressPreference = 'SilentlyContinue'
+          $installer = "$env:RUNNER_TEMP\LLVM-$env:LLVM_VERSION-win64.exe"
+          Invoke-WebRequest -Uri "https://github.com/llvm/llvm-project/releases/download/llvmorg-$env:LLVM_VERSION/LLVM-$env:LLVM_VERSION-win64.exe" -OutFile $installer
+          Start-Process -FilePath $installer -ArgumentList '/S' -Wait
+          $bin = 'C:\Program Files\LLVM\bin'
+          if (-not (Test-Path "$bin\libclang.dll")) { throw "libclang.dll not found in $bin" }
+          "LIBCLANG_PATH=$bin" >> $env:GITHUB_ENV
 
       - name: Authenticate to Google Cloud
         uses: google-github-actions/auth@v3
```

---

### Incident Patch 12: `acf9e965` (2026-09-02)
**Commit Message**: pkg/releaser: locate clang for windows build (#2564)

<!-- codesmith:footer -->
---
<a
href="https://app.blacksmith.sh/encoredev/codesmith/encore/pr/2564"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v2.svg"><img
alt="View with [code]smith"
src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"></picture></a>
<a
href="https://backend.blacksmith.sh/track/enable-autofix?expires=1790956837&installation_model_id=427204&pr_number=2564&repository=encoredev%2Fencore&return_to=https%3A%2F%2Fgithub.com%2Fencoredev%2Fencore%2Fpull%2F2564&signature=9a7edcdddc1b56c63af4b15034c95d98c57b21d511313f062d24ece375cdc587"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-dark.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-light.svg"><img
alt="Autofix with [code]smith"
src

**File**: `.github/workflows/latest-release.yml` (modified, +18/-19)
```diff
@@ -54,6 +54,7 @@ concurrency:
 
 env:
   R_ENCORE_REPO: ${{ github.workspace }}
+  R_VERSION: ${{ inputs.version || format('v0.0.0-develop+{0}', github.sha) }}
   R_RELEASE_PREFIX: latest/${{ github.sha }}
   # Pinned toolchain. zig 0.11.0 is the version the release builds have
   # always linked with; cargo-zigbuild supports it (it requires zig >= 0.9).
@@ -63,24 +64,8 @@ env:
   NODE_VERSION: 22
 
 jobs:
-  version:
-    name: Determine version
-    runs-on: blacksmith-2vcpu-ubuntu-2404
-    outputs:
-      version: ${{ steps.version.outputs.version }}
-    steps:
-      - name: Determine version
-        id: version
-        env:
-          INPUT_VERSION: ${{ inputs.version }}
-        run: |
-          set -euo pipefail
-          version="${INPUT_VERSION:-v0.0.0-develop+${GITHUB_SHA}}"
-          echo "version=$version" | tee -a "$GITHUB_OUTPUT"
-
   build:
     name: Build ${{ matrix.target }}
-    needs: version
     runs-on: ${{ matrix.runner }}
     environment: latest
     timeout-minutes: 120
@@ -117,7 +102,6 @@ jobs:
             build: windows/amd64:all,-supervisor
             rust_targets: x86_64-pc-windows-msvc
     env:
-      R_VERSION: ${{ needs.version.outputs.version }}
       R_BUILD: ${{ matrix.build }}
     steps:
       - uses: actions/checkout@v4
@@ -168,6 +152,22 @@ jobs:
         if: runner.os == 'Windows'
         uses: step-security/msvc-dev-cmd@22c98154b708dbd743e6f27a933cf6ceba3305c4 # v1.13.1
 
+      # pg_query's build script runs bindgen, which needs libclang.dll. Point
+      # it at the copy bundled with Visual Studio's Clang component.
+      - name: Locate libclang
+        if: runner.os == 'Windows'
+        shell: pwsh
+        run: |
+          $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
+          $dll = & $vswhere -latest -products * -find 'VC\Tools\Llvm\x64\bin\libclang.dll' | Select-Object -First 1
+          if (-not $dll) {
+            Write-Host "Visual Studio installations:"
+            & $vswhere -products * -property installationPath
+            throw "libclang.dll not found in any Visual Studio installation"
+          }
+          "LIBCLANG_PATH=$(Split-Path $dll)" >> $env:GITHUB_ENV
+          Write-Host "Using $dll"
+
       - name: Authenticate to Google Cloud
         uses: google-github-actions/auth@v3
         with:
@@ -182,15 +182,14 @@ jobs:
 
   finalize:
     name: Assemble distribution tarballs
-    needs: [version, build]
+    needs: build
     runs-on: blacksmith-4vcpu-ubuntu-2404
     environment: latest
     timeout-minutes: 60
     permissions:
       contents: read
       id-token: write # Workload Identity Federation
     env:
-      R_VERSION: ${{ needs.version.outputs.version }}
       R_ENCORE_GO_VERSION: ${{ inputs.encore_go_version }}
     steps:
       - uses: actions/checkout@v4
```

---

### Incident Patch 13: `2699b15b` (2026-09-02)
**Commit Message**: pkg/releaser: fix windows build (#2561)

<!-- codesmith:footer -->
---
<a
href="https://app.blacksmith.sh/encoredev/codesmith/encore/pr/2561"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v2.svg"><img
alt="View with [code]smith"
src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"></picture></a>
<a
href="https://backend.blacksmith.sh/track/enable-autofix?expires=1790949530&installation_model_id=427204&pr_number=2561&repository=encoredev%2Fencore&return_to=https%3A%2F%2Fgithub.com%2Fencoredev%2Fencore%2Fpull%2F2561&signature=317e18418e8562ddf9fbc219f214fb05a94a8bc4e5381672267f206a654e2532"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-dark.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-light.svg"><img
alt="Autofix with [code]smith"
src="https://pr-

**File**: `pkg/releaser/steps/gobuild/gobuild.go` (modified, +7/-1)
```diff
@@ -152,7 +152,13 @@ func compilerSettings(cfg *CompileInput) (cc, cxx string, envs, ldFlags []string
 			return "", "", nil, nil, errors.Newf("unsupported architecture for windows: %q", cfg.Target.Arch)
 		}
 
-		ldFlags = []string{"-H=windowsgui"}
+		// pg_query compiles its C code with -fstack-protector, so the objects
+		// reference __stack_chk_fail/__stack_chk_guard. mingw-w64 has no libssp;
+		// zig supplies its own, but only when the *link* invocation has stack
+		// protection enabled — and Go's external link passes just "-O2 -g",
+		// which zig treats as ReleaseFast and links without it. Enabling it for
+		// the link step makes zig include its ssp runtime.
+		ldFlags = []string{"-H=windowsgui", "-extldflags=-fstack-protector"}
 
 	default:
 		panic("unreachable")
```

---

### Incident Patch 14: `fa72a016` (2026-08-27)
**Commit Message**: dockerbuild: exclude volatile pnpm metadata from the deps layer (#2496)

## What

pnpm writes bookkeeping files into `node_modules` whose contents change
on every install even when the installed dependency set is identical:

- `node_modules/.modules.yaml` records a `prunedAt` timestamp (and a
machine-specific `storeDir`)
- `node_modules/.pnpm-workspace-state-v1.json` records a
`lastValidatedTimestamp`

This change skips those files when building the image so the dependency
layer's digest stays stable across installs.

## Why

Since #2483 the image is split into layers by change frequency, with
`node_modules` in its own dependency layer so that "unchanged layers
keep identical digests across builds and can be skipped when pushing and
pulling images". For pnpm apps that benefit never materialises: because
`.modules.yaml` changes on every install, the dependency layer gets a
new digest on every build, so the whole `node_modules` layer is
re-uploaded on `--push` and re-pulled on deploy even when nothing
changed. For large pnpm trees this dominates deploy time.

These files are written directly inside a `node_modules` directory and
are only consumed by the package manager during a later

**File**: `pkg/dockerbuild/dockerbuild_test.go` (modified, +4/-0)
```diff
@@ -24,6 +24,10 @@ func testImageConfig(c *qt.C) (DescribeConfig, HostPath) {
 		"entrypoint":       "echo hello",
 		"package.json":     `{"name": "package/name"}`,
 		"node_modules/foo": "foo",
+		// Volatile pnpm bookkeeping files; must not end up in any layer.
+		"node_modules/.modules.yaml":                 "prunedAt: Mon, 01 Jan 2024 00:00:00 GMT\n",
+		"node_modules/.pnpm-workspace-state.json":    `{"lastValidatedTimestamp":1}`,
+		"node_modules/.pnpm-workspace-state-v1.json": `{"lastValidatedTimestamp":1}`,
 	})
 	runtimes := paths.FS(c.TempDir())
 	writeFiles(c, runtimes, map[string]string{
```

**File**: `pkg/dockerbuild/tarcopy.go` (modified, +25/-0)
```diff
@@ -208,6 +208,25 @@ func nodeModulesPath(relPath HostPath) (within, isRoot bool) {
 	return false, false
 }
 
+// volatilePnpmMetadata are pnpm bookkeeping files written directly inside a
+// node_modules directory. pnpm records timestamps in them, so their contents
+// change on every install even when the dependencies are identical, giving the
+// dependency layer a new digest on every build. They aren't read at runtime.
+// See https://github.com/pnpm/pnpm/issues/9474.
+var volatilePnpmMetadata = map[string]bool{
+	".modules.yaml":                 true,
+	".pnpm-workspace-state.json":    true, // older pnpm
+	".pnpm-workspace-state-v1.json": true,
+}
+
+// isVolatilePnpmMetadata reports whether relPath is a volatilePnpmMetadata file
+// directly inside a node_modules directory, so a coincidentally-named file
+// shipped deep inside a package isn't skipped.
+func isVolatilePnpmMetadata(relPath HostPath) bool {
+	s := string(relPath)
+	return volatilePnpmMetadata[filepath.Base(s)] && filepath.Base(filepath.Dir(s)) == "node_modules"
+}
+
 // shouldInclude returns true if the path should be included in the tar.
 func shouldInclude(desc *dirCopyDesc, path HostPath) bool {
 	for _, include := range desc.IncludeSrcPaths {
@@ -256,6 +275,12 @@ func (tc *tarCopier) CopyDir(desc *dirCopyDesc) error {
 		if err != nil {
 			return errors.WithStack(err)
 		}
+
+		// Skip volatile pnpm bookkeeping files; see volatilePnpmMetadata.
+		if !d.IsDir() && isVolatilePnpmMetadata(relPath) {
+			return nil
+		}
+
 		dstPath := desc.DstPath.Join(string(relPath.ToImage()))
 
 		// Route node_modules trees to the dependency layer's copier, if configured.
```

**File**: `pkg/dockerbuild/tarcopy_test.go` (modified, +28/-0)
```diff
@@ -116,6 +116,34 @@ func TestNodeModulesPath(t *testing.T) {
 	}
 }
 
+func TestIsVolatilePnpmMetadata(t *testing.T) {
+	tests := []struct {
+		path HostPath
+		want bool
+	}{
+		// Directly inside a node_modules dir, including nested ones.
+		{"node_modules/.modules.yaml", true},
+		{"node_modules/.pnpm-workspace-state.json", true},
+		{"node_modules/.pnpm-workspace-state-v1.json", true},
+		{"app/node_modules/.modules.yaml", true},
+		{"node_modules/.pnpm/pkg@1.0.0/node_modules/.modules.yaml", true},
+		// A package may legitimately ship a coincidentally-named file.
+		{"node_modules/pkg/fixtures/.modules.yaml", false},
+		{"node_modules/pkg/.modules.yaml", false},
+		{".modules.yaml", false},
+		{"node_modules/foo", false},
+		{"node_modules/pkg/index.js", false},
+		{"node_modules/package.json", false},
+	}
+
+	for _, tt := range tests {
+		t.Run(string(tt.path), func(t *testing.T) {
+			c := qt.New(t)
+			c.Assert(isVolatilePnpmMetadata(tt.path), qt.Equals, tt.want)
+		})
+	}
+}
+
 func TestMkdirAll_OrderingInvariant(t *testing.T) {
 	c := qt.New(t)
 	tc := newTarCopier()
```

---

### Incident Patch 15: `5d7021ef` (2026-08-18)
**Commit Message**: daemon: fixes for origin checks (#2537)

**File**: `cli/cmd/encore/daemon/daemon.go` (modified, +1/-1)
```diff
@@ -286,7 +286,7 @@ func (d *Daemon) serveObjects() {
 func (d *Daemon) serveDash() {
 	log.Info().Stringer("addr", d.Dash.Addr()).Msg("serving dash")
 	srv := dash.NewServer(d.Apps, d.RunMgr, d.NS, d.Trace, d.Dash.Port())
-	d.exit <- http.Serve(d.Dash, httpx.CheckOrigin(httpx.IsLocalOrigin, srv))
+	d.exit <- http.Serve(d.Dash, httpx.CheckOrigin(httpx.IsNotExternalWebsite, srv))
 }
 
 func (d *Daemon) serveDebug() {
```

**File**: `cli/daemon/dash/server.go` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ import (
 )
 
 var upgrader = websocket.Upgrader{
-	CheckOrigin: httpx.IsLocalOrigin,
+	CheckOrigin: httpx.IsNotExternalWebsite,
 }
 
 // NewServer starts a new server and returns it.
```

**File**: `cli/daemon/mcp/mcp.go` (modified, +2/-19)
```diff
@@ -14,6 +14,7 @@ import (
 	"encr.dev/cli/daemon/objects"
 	"encr.dev/cli/daemon/run"
 	"encr.dev/cli/daemon/sqldb"
+	"encr.dev/pkg/httpx"
 )
 
 // serverInstructions is returned to MCP clients in the `initialize` response.
@@ -117,25 +118,7 @@ func addAppToContext(ctx context.Context, r *http.Request) context.Context {
 }
 
 func (m *Manager) Serve(listener net.Listener) error {
-	return http.Serve(listener, originCheck(m.sse))
-}
-
-// originCheck restricts the MCP server to local code agents (editors, CLI tools),
-// which don't send an Origin header, and rejects browser requests.
-func originCheck(next http.Handler) http.Handler {
-	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
-		if !allowedOrigin(r) {
-			http.Error(w, "forbidden", http.StatusForbidden)
-			return
-		}
-		next.ServeHTTP(w, r)
-	})
-}
-
-func allowedOrigin(req *http.Request) bool {
-	// The MCP server is only consumed by local code agents, which don't send an
-	// Origin header. Browsers always do, so reject any request that carries one.
-	return req.Header.Get("Origin") == ""
+	return http.Serve(listener, httpx.CheckOrigin(httpx.IsNonBrowser, m.sse))
 }
 
 func (m *Manager) getApp(ctx context.Context) (*apps.Instance, error) {
```

**File**: `cli/daemon/mcp/mcp_test.go` (modified, +3/-1)
```diff
@@ -4,12 +4,14 @@ import (
 	"net/http"
 	"net/http/httptest"
 	"testing"
+
+	"encr.dev/pkg/httpx"
 )
 
 // TestOriginCheck verifies the MCP listener only serves code agents (no Origin
 // header) and rejects any browser request (which always carries an Origin).
 func TestOriginCheck(t *testing.T) {
-	handler := originCheck(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+	handler := httpx.CheckOrigin(httpx.IsNonBrowser, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 		w.WriteHeader(http.StatusOK)
 	}))
 
```

**File**: `pkg/httpx/origin.go` (modified, +13/-6)
```diff
@@ -7,20 +7,27 @@ import (
 	"net/url"
 )
 
+// isNonCrossSite gates browser requests coming from another site that don't
+// get the CORS check-ed. For example, GET sub-resource loads (<img>, <script>, etc.).
+func isNonCrossSite(req *http.Request) bool {
+	return req.Header.Get("Sec-Fetch-Site") != "cross-site"
+}
+
+// IsNotExternalWebsite makes sure request did not come from a browser page that is
+// not a localhost.
+func IsNotExternalWebsite(req *http.Request) bool {
+	return IsLocalOrigin(req) && isNonCrossSite(req)
+}
+
 // IsLocalOrigin gates localhost-bound dev servers so a malicious website can't
 // drive-by request them, while still serving the local dashboard and frontend
 // dev servers (which run on localhost).
 //
 // Browser requests are allowed only when the Origin's host is loopback or
 // "localhost"; other origins are rejected. Requests without an Origin are
 // allowed, since non-browser clients (the app runtime, CLI tools) don't send
-// one. Browsers also omit Origin on GET sub-resource loads (<img>, <script>),
-// so we additionally reject Sec-Fetch-Site: cross-site to catch those.
+// one.
 func IsLocalOrigin(req *http.Request) bool {
-	if req.Header.Get("Sec-Fetch-Site") == "cross-site" {
-		return false
-	}
-
 	origin := req.Header.Get("Origin")
 	if origin == "" {
 		return true
```

**File**: `pkg/httpx/origin_test.go` (modified, +48/-54)
```diff
@@ -6,18 +6,26 @@ import (
 	"testing"
 )
 
-func newReq(origin string) *http.Request {
-	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/x", nil)
-	if origin != "" {
-		req.Header.Set("Origin", origin)
+func withSecFetchSite(secFetchSite string) func(*http.Request) {
+	return func(req *http.Request) {
+		if secFetchSite != "" {
+			req.Header.Set("Sec-Fetch-Site", secFetchSite)
+		}
 	}
-	return req
 }
 
-func newReqWithFetchSite(origin, fetchSite string) *http.Request {
-	req := newReq(origin)
-	if fetchSite != "" {
-		req.Header.Set("Sec-Fetch-Site", fetchSite)
+func withOrigin(origin string) func(*http.Request) {
+	return func(req *http.Request) {
+		if origin != "" {
+			req.Header.Set("Origin", origin)
+		}
+	}
+}
+
+func newReq(opts ...func(*http.Request)) *http.Request {
+	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/x", nil)
+	for _, apply := range opts {
+		apply(req)
 	}
 	return req
 }
@@ -36,72 +44,58 @@ func TestIsLocalOrigin(t *testing.T) {
 		{"://bad", false},
 	}
 	for _, tt := range tests {
-		if got := IsLocalOrigin(newReq(tt.origin)); got != tt.want {
+		if got := IsLocalOrigin(newReq(withOrigin(tt.origin))); got != tt.want {
 			t.Errorf("IsLocalOrigin(%q) = %v, want %v", tt.origin, got, tt.want)
 		}
 	}
 }
 
-func TestIsLocalOriginFetchMetadata(t *testing.T) {
-	tests := []struct {
-		name      string
-		origin    string
-		fetchSite string
-		want      bool
-	}{
-		// A cross-site GET sub-resource load (e.g. <img>) sends no Origin but
-		// still carries Sec-Fetch-Site: cross-site. It must be rejected.
-		{"cross-site no origin", "", "cross-site", false},
-		{"cross-site with origin", "https://example.com", "cross-site", false},
-		// Same-origin/same-site requests from the local dashboard and localhost
-		// dev servers must keep working.
-		{"same-origin", "http://localhost:9400", "same-origin", true},
-		{"same-site other port", "http://localhost:5173", "same-site", true},
-		// A user navigating directly (typed URL/bookmark) reports "none".
-		{"user navigation", "", "none", true},
-	}
-	for _, tt := range tests {
-		if got := IsLocalOrigin(newReqWithFetchSite(tt.origin, tt.fetchSite)); got != tt.want {
-			t.Errorf("%s: IsLocalOrigin(origin=%q, sec-fetch-site=%q) = %v, want %v", tt.name, tt.origin, tt.fetchSite, got, tt.want)
-		}
-	}
-}
-
 func TestIsNonBrowser(t *testing.T) {
 	tests := []struct {
-		origin string
-		want   bool
+		origin       string
+		secFetchSite string
+		want         bool
 	}{
-		{"", true}, // only a missing Origin is allowed
-		{"http://localhost:5173", false},
-		{"http://127.0.0.1:3000", false},
-		{"https://example.com", false},
+		{"", "", true}, // only a missing Origin + Sec-Fetch-Site are allowed
+		// Origin or Sec-Fetch-Site headers are not allowd
+		{"http://localhost:5173", "", false},
+		{"http://localhost:5173", "", false},
+		{"http://127.0.0.1:3000", "", false},
+		{"https://example.com", "", false},
+		{"", "same-site", false},
+		{"", "same-origin", false},
+		{"", "cross-site", false},
+		{"", "none", false},
+		{"http://localhost:3000", "same-site", false},
 	}
 	for _, tt := range tests {
-		if got := IsNonBrowser(newReq(tt.origin)); got != tt.want {
+		if got := IsNonBrowser(newReq(withOrigin(tt.origin), withSecFetchSite(tt.secFetchSite))); got != tt.want {
 			t.Errorf("IsNonBrowser(%q) = %v, want %v", tt.origin, got, tt.want)
 		}
 	}
 }
 
-func TestIsNonBrowserFetchMetadata(t *testing.T) {
+func TestIsNonExternalWebsite(t *testing.T) {
 	tests := []struct {
 		name      string
 		origin    string
 		fetchSite string
 		want      bool
 	}{
-		// go tool pprof / CLIs / the app runtime send neither header.
-		{"non-browser tool", "", "", true},
-		// A browser GET drive-by (e.g. <img src=".../debug/pprof/profile">)
-		// sends no Origin but does send Sec-Fetch-Site. It must be rejected.
-		{"cross-site drive-by", "", "cross-site", false},
-		{"same-origin browser", "", "same-origin", false},
-		{"user navigation", "", "none", false},
+		// A cross-site GET sub-resource load (e.g. <img>) sends no Origin but
+		// still carries Sec-Fetch-Site: cross-site.
+		{"cross-site no origin", "", "cross-site", false},
+		{"cross-site with origin", "https://example.com", "cross-site", false},
+		// Same-origin/same-site requests from the local dashboard and localhost
+		// dev servers must keep working.
+		{"same-origin", "http://localhost:9400", "same-origin", true},
+		{"same-site other port", "http://localhost:5173", "same-site", true},
+		// A user navigating directly (typed URL/bookmark) reports "none".
+		{"user navigation", "", "none", true},
 	}
 	for _, tt := range tests {
-		if got := IsNonBrowser(newReqWithFetchSite(tt.origin, tt.fetchSite)); got != tt.want {
-			t.Errorf("%s: IsNonBrowser(origin=%q, sec-fetch-site=%q) = %v, want %v", tt.name, tt.origin, tt.fetchSite, got, tt.want)
+		if got := IsNotExternalWebsite(newReq(withOrigin(tt.origin), withSecFetchSite(tt.fetchSite))); got != tt.want {
+			t.Err
```

#### Recent Merged Pull Requests:
- **PR #2593** (2026-10-05): Update README.md (@marcuskohlberg)
- **PR #2588** (2026-10-01): .github: build latest release in release mode (@eandre)
- **PR #2587** (2026-09-30): cmd: handle optional personal orgs (@ngalaiko)
- **PR #2586** (2026-09-29): cli: allow to create org apps (@ngalaiko)
- **PR #2585** (2026-09-28): fix(daemon): migration uses wrong context (@ekerfelt)
- **PR #2583** (2026-09-22): runtimes/js: handle empty buffers in bucket uploads and sqldb params (@eandre)
- **PR #2582** (2026-09-17):  cli/daemon: paginate and filter traces, budget trace data by size not count  (@lennartp)
- **PR #2577** (2026-09-08): tsparser: fix test (@eandre)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): encoredev/encore

> **Canonical Artifact**: `07_PROJECT_LEARNING/encoredev-encore-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/encoredev/encore](https://github.com/encoredev/encore))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:25:39.673Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `encoredev/encore`
- **Description**: The infrastructure platform for the intelligence era
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: Cargo.toml, go.mod, README.md
- **Stars / Engagement**: 12405 stars

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
		if m.templates.pr
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

### Incident Patch 1: `a59a6c0b` (2026-09-28)
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

### Incident Patch 2: `95456970` (2026-09-17)
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
+func TestDoCleanEvictsLeastRecentAppsOverTot
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

---

### Incident Patch 3: `7bcb11b7` (2026-09-08)
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

### Incident Patch 4: `97f5124e` (2026-09-03)
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

### Incident Patch 5: `bbfd3673` (2026-09-02)
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

### Incident Patch 6: `67eff2c1` (2026-09-02)
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

### Incident Patch 7: `2699b15b` (2026-09-02)
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

### Incident Patch 8: `5d7021ef` (2026-08-18)
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

---

### Incident Patch 9: `0579d5ce` (2026-08-13)
**Commit Message**: object explorer: fix prefix rollup (#2534)

**File**: `cli/daemon/dash/bucketbrowser.go` (modified, +14/-7)
```diff
@@ -119,6 +119,9 @@ type bucketSearchRequest struct {
 }
 
 type bucketSearchResponse struct {
+	// Prefixes holds the sub-paths a non-recursive search matched below, the way Cloud
+	// Storage reports them. A recursive or glob search rolls nothing up, so it's empty.
+	Prefixes      []string       `json:"prefixes"`
 	Objects       []bucketObject `json:"objects"`
 	NextPageToken string         `json:"next_page_token"`
 }
@@ -214,14 +217,8 @@ func (t *bucketTarget) List(ctx context.Context, req bucketListRequest) (*bucket
 		return nil, err
 	}
 
-	// The dashboard distinguishes "no sub-paths" from "field absent", so never return null.
-	prefixes := objs.Prefixes
-	if prefixes == nil {
-		prefixes = []string{}
-	}
-
 	return &bucketListResponse{
-		Prefixes:      prefixes,
+		Prefixes:      bucketPrefixes(objs),
 		Objects:       t.objects(objs),
 		NextPageToken: objs.NextPageToken,
 	}, nil
@@ -266,6 +263,7 @@ func (t *bucketTarget) Search(ctx context.Context, req bucketSearchRequest) (*bu
 	}
 
 	return &bucketSearchResponse{
+		Prefixes:      bucketPrefixes(objs),
 		Objects:       t.objects(objs),
 		NextPageToken: objs.NextPageToken,
 	}, nil
@@ -572,6 +570,15 @@ func (t *bucketTarget) list(ctx context.Context, opts gcsemu.ListOptions, pageTo
 	return objs, nil
 }
 
+// bucketPrefixes returns the rolled-up sub-paths of a listing, never null: the
+// dashboard distinguishes "no sub-paths" from "field absent".
+func bucketPrefixes(objs *storage.Objects) []string {
+	if objs.Prefixes == nil {
+		return []string{}
+	}
+	return objs.Prefixes
+}
+
 // objects converts emulator objects to their dashboard representation.
 func (t *bucketTarget) objects(objs *storage.Objects) []bucketObject {
 	out := make([]bucketObject, 0, len(objs.Items))
```

**File**: `cli/daemon/dash/bucketbrowser_test.go` (modified, +88/-17)
```diff
@@ -2,6 +2,7 @@ package dash
 
 import (
 	"context"
+	"fmt"
 	"io"
 	"net/http"
 	"net/http/httptest"
@@ -197,16 +198,14 @@ func TestListPagination(t *testing.T) {
 
 // TestListPaginationWithPrefixRollup covers a page that fills up entirely with
 // rolled-up sub-paths: it still has to hand back a token, or the dashboard stops
-// early and silently hides the remaining folders.
-//
-// A prefix may be reported on more than one page, which the dashboard deduplicates,
-// so this only checks that every folder is eventually seen.
+// early and silently hides the remaining folders. Each folder is reported once, on
+// one page, so the dashboard can append pages as they arrive.
 func TestListPaginationWithPrefixRollup(t *testing.T) {
 	ctx := context.Background()
 	target := newTestTarget(t, &meta.Bucket{Name: testBucket})
 	seed(t, target, "a/1.txt", "b/1.txt", "c/1.txt", "d/1.txt")
 
-	seen := make(map[string]bool)
+	var got []string
 	pageToken := ""
 	for i := 0; ; i++ {
 		if i > 10 {
@@ -216,18 +215,44 @@ func TestListPaginationWithPrefixRollup(t *testing.T) {
 		if err != nil {
 			t.Fatal(err)
 		}
-		for _, prefix := range res.Prefixes {
-			seen[prefix] = true
-		}
+		got = append(got, res.Prefixes...)
 		if res.NextPageToken == "" {
 			break
 		}
 		pageToken = res.NextPageToken
 	}
 
-	want := map[string]bool{"a/": true, "b/": true, "c/": true, "d/": true}
-	if !reflect.DeepEqual(seen, want) {
-		t.Errorf("prefixes seen = %v, want %v", seen, want)
+	if want := []string{"a/", "b/", "c/", "d/"}; !reflect.DeepEqual(got, want) {
+		t.Errorf("paging through the folders gave %v, want %v", got, want)
+	}
+}
+
+// TestListLargeFolder pins that how big a folder is doesn't affect how many pages it
+// takes to browse the folder it sits in: it is one row in the dashboard however many
+// objects are below it, so it costs one result of the page reporting it.
+func TestListLargeFolder(t *testing.T) {
+	ctx := context.Background()
+	target := newTestTarget(t, &meta.Bucket{Name: testBucket})
+
+	keys := make([]string, 0, 201)
+	for i := range 200 {
+		keys = append(keys, fmt.Sprintf("holiday/%03d.jpg", i))
+	}
+	keys = append(keys, "readme.txt")
+	seed(t, target, keys...)
+
+	res, err := target.List(ctx, bucketListRequest{Delimiter: "/", PageSize: 50})
+	if err != nil {
+		t.Fatal(err)
+	}
+	if want := []string{"holiday/"}; !reflect.DeepEqual(res.Prefixes, want) {
+		t.Errorf("prefixes = %v, want %v", res.Prefixes, want)
+	}
+	if want := []string{"readme.txt"}; !reflect.DeepEqual(keysOf(res.Objects), want) {
+		t.Errorf("objects = %v, want %v", keysOf(res.Objects), want)
+	}
+	if res.NextPageToken != "" {
+		t.Error("got a page token, want the whole folder view on one page")
 	}
 }
 
@@ -245,19 +270,22 @@ func TestSearch(t *testing.T) {
 	seed(t, target, "report.pdf", "reports/q1.pdf", "2024/annual-report.pdf", "notes.txt")
 
 	tests := []struct {
-		name string
-		req  bucketSearchRequest
-		want []string
+		name         string
+		req          bucketSearchRequest
+		want         []string
+		wantPrefixes []string
 	}{
 		{
 			name: "prefix search is anchored at the start of the key",
 			req:  bucketSearchRequest{Query: "report", Recursive: true},
 			want: []string{"report.pdf", "reports/q1.pdf"},
 		},
 		{
-			name: "non-recursive prefix search does not descend",
-			req:  bucketSearchRequest{Query: "report"},
-			want: []string{"report.pdf"},
+			// As Cloud Storage does with a delimiter set.
+			name:         "non-recursive prefix search rolls matches below a sub-path up",
+			req:          bucketSearchRequest{Query: "report"},
+			want:         []string{"report.pdf"},
+			wantPrefixes: []string{"reports/"},
 		},
 		{
 			name: "glob search matches anywhere in the key",
@@ -291,10 +319,53 @@ func TestSearch(t *testing.T) {
 			if !reflect.DeepEqual(got, test.want) {
 				t.Errorf("objects = %v, want %v", got, test.want)
 			}
+			wantPrefixes := test.wantPrefixes
+			if wantPrefixes == nil {
+				wantPrefixes = []string{}
+	
```

**File**: `pkg/emulators/storage/gcsemu/walk.go` (modified, +54/-19)
```diff
@@ -37,7 +37,8 @@ type ListOptions struct {
 	// matches the given glob pattern. See compileGlob for the supported syntax.
 	MatchGlob string
 
-	// MaxResults caps the number of objects and rolled-up prefixes returned.
+	// MaxResults caps the combined number of objects and rolled-up prefixes returned,
+	// counting each prefix once however many objects it stands for.
 	// If <= 0 or above MaxResults, MaxResults is used.
 	MaxResults int
 }
@@ -84,11 +85,19 @@ func (g *GcsEmu) ListObjects(ctx context.Context, baseUrl HttpBaseUrl, bucket st
 		}
 	}
 
-	// lastMatch is the name of the last object accepted by the filters, whether it was
-	// returned as an object or rolled up into a prefix. It seeds the next page token.
+	// lastMatch is the name of the last object this page reported, either in its own
+	// right or as the first object seen below a prefix. It seeds the next page token.
 	var lastMatch string
 	moreResults := false
 	count := 0
+
+	// A prefix is reported the first time an object below it is seen, so a cursor that
+	// rolls up names an object below a sub-path an earlier page of this listing already
+	// reported: everything else below it is a duplicate, and can be skipped in one step
+	// rather than walked (and, on a filesystem, stat'ed) object by object on every page.
+	// Like Cloud Storage, a page token belongs to the listing it came from; carrying one
+	// over to a different delimiter or prefix is undefined.
+	cursorPrefix := rollupPrefix(opts.Cursor, opts.Prefix, opts.Delimiter)
 	err := g.store.Walk(ctx, bucket, func(ctx context.Context, filename string, fInfo os.FileInfo) error {
 		dbgWalk("walk: %s", filename)
 
@@ -113,6 +122,11 @@ func (g *GcsEmu) ListObjects(ctx context.Context, baseUrl HttpBaseUrl, bucket st
 				dbgWalk("%q < prefix=%q skip dir", filename, opts.Prefix)
 				return filepath.SkipDir
 			}
+			// Everything below this directory was reported as a prefix already.
+			if cursorPrefix != "" && strings.HasPrefix(filename+"/", cursorPrefix) {
+				dbgWalk("%q below reported prefix=%q skip dir", filename, cursorPrefix)
+				return filepath.SkipDir
+			}
 			// Directories are not objects, so they are never reported. A folder that
 			// was explicitly created has a placeholder object inside it, which the
 			// store reports under the folder's own name.
@@ -128,6 +142,10 @@ func (g *GcsEmu) ListObjects(ctx context.Context, baseUrl HttpBaseUrl, bucket st
 			dbgWalk("%q < prefix=%q skipping", filename, opts.Prefix)
 			return nil
 		}
+		if cursorPrefix != "" && strings.HasPrefix(filename, cursorPrefix) {
+			dbgWalk("%q below reported prefix=%q skipping", filename, cursorPrefix)
+			return nil
+		}
 
 		// Non-matching objects don't consume the page budget, so that a sparse
 		// glob still fills a page instead of returning mostly-empty ones.
@@ -136,29 +154,33 @@ func (g *GcsEmu) ListObjects(ctx context.Context, baseUrl HttpBaseUrl, bucket st
 			return nil
 		}
 
+		// An object below a sub-path is reported as that sub-path, and only the first
+		// one is: the rest are already covered by the prefix it produced. Those don't
+		// consume the page budget either, or a folder holding a thousand objects would
+		// fill a page of a thousand with one repeated sub-path.
+		if itemPrefix := rollupPrefix(filename, opts.Prefix, opts.Delimiter); itemPrefix != "" {
+			if seenPrefixes[itemPrefix] {
+				dbgWalk("%q already covered by prefix=%q skipping", filename, itemPrefix)
+				return nil
+			}
+			if count >= maxResults {
+				moreResults = true
+				return errAbort
+			}
+			count++
+			lastMatch = filename
+			seenPrefixes[itemPrefix] = true
+			prefixes = append(prefixes, itemPrefix)
+			return nil
+		}
+
 		if count >= maxResults {
 			moreResults = true
 			return errAbort
 		}
 		count++
 		lastMatch = filename
 
-		if opts.Delimiter != "" {
-			// See if the filename (beyond the prefix) contains delimiter, if it does, don't record the item,
-			// instead record the prefix (including th
```

**File**: `pkg/emulators/storage/gcsemu/walk_test.go` (modified, +141/-0)
```diff
@@ -300,6 +300,147 @@ func TestListObjectsPagesEveryObject(t *testing.T) {
 	}
 }
 
+// TestListObjectsPagesEveryPrefixOnce pins how a delimited listing spends a page: on
+// results the caller hasn't seen. A sub-path counts once however many objects it stands
+// for — Cloud Storage's maxResults is the "maximum combined number of entries in items[]
+// and prefixes[]" — so a folder holding more objects than fit in a page is still one
+// prefix on one page, rather than a run of pages repeating the same sub-path.
+func TestListObjectsPagesEveryPrefixOnce(t *testing.T) {
+	ctx := context.Background()
+	store := NewFileStore(t.TempDir())
+	emu := NewGcsEmu(Options{Store: store})
+
+	var wantPrefixes []string
+	for folder := range 5 {
+		wantPrefixes = append(wantPrefixes, fmt.Sprintf("f%d/", folder))
+		for i := range 50 {
+			key := fmt.Sprintf("f%d/%03d.txt", folder, i)
+			if err := store.Add("bkt", key, []byte("x"), &storage.Object{}); err != nil {
+				t.Fatal(err)
+			}
+		}
+	}
+	wantItems := []string{"g.txt", "h.txt"} // objects of the root's own, sorting last
+	for _, key := range wantItems {
+		if err := store.Add("bkt", key, []byte("x"), &storage.Object{}); err != nil {
+			t.Fatal(err)
+		}
+	}
+
+	for _, maxResults := range []int{1, 2, 3, 7, 100} {
+		var gotPrefixes, gotItems []string
+		pages := 0
+		opts := ListOptions{Delimiter: "/", MaxResults: maxResults}
+		for {
+			if pages > 20 {
+				t.Fatalf("maxResults=%d: pagination did not terminate", maxResults)
+			}
+			objs, err := emu.ListObjects(ctx, "", "bkt", opts)
+			if err != nil {
+				t.Fatal(err)
+			}
+			pages++
+			if got := len(objs.Items) + len(objs.Prefixes); got > maxResults {
+				t.Errorf("maxResults=%d: page held %d results", maxResults, got)
+			} else if got == 0 {
+				t.Errorf("maxResults=%d: page %d held no results at all", maxResults, pages)
+			}
+			gotPrefixes = append(gotPrefixes, objs.Prefixes...)
+			gotItems = append(gotItems, names(objs)...)
+			if objs.NextPageToken == "" {
+				break
+			}
+			cursor, err := gcsutil.DecodePageToken(objs.NextPageToken)
+			if err != nil {
+				t.Fatal(err)
+			}
+			opts.Cursor = cursor
+		}
+
+		// Every sub-path exactly once, in order, however small the pages are.
+		if !reflect.DeepEqual(gotPrefixes, wantPrefixes) {
+			t.Errorf("maxResults=%d: paged through prefixes %v, want %v", maxResults, gotPrefixes, wantPrefixes)
+		}
+		if !reflect.DeepEqual(gotItems, wantItems) {
+			t.Errorf("maxResults=%d: paged through items %v, want %v", maxResults, gotItems, wantItems)
+		}
+		// ceil(results/n) pages exactly: nothing but a result was ever charged for.
+		if want := (len(wantPrefixes) + len(wantItems) + maxResults - 1) / maxResults; pages != want {
+			t.Errorf("maxResults=%d: took %d pages, want %d", maxResults, pages, want)
+		}
+	}
+}
+
+// TestListObjectsSkipsReportedPrefix pins that paging past a reported sub-path doesn't
+// walk what's below it again. Those objects can only roll up into the same prefix and be
+// dropped, so revisiting them costs a stat apiece for nothing — which is what made paging
+// a large folder take time quadratic in its size.
+func TestListObjectsSkipsReportedPrefix(t *testing.T) {
+	ctx := context.Background()
+	store := NewFileStore(t.TempDir())
+	counting := &countingStore{Store: store}
+	emu := NewGcsEmu(Options{Store: counting})
+
+	for i := range 200 {
+		if err := store.Add("bkt", fmt.Sprintf("big/%03d.txt", i), []byte("x"), &storage.Object{}); err != nil {
+			t.Fatal(err)
+		}
+	}
+	for _, key := range []string{"y.txt", "z.txt"} {
+		if err := store.Add("bkt", key, []byte("x"), &storage.Object{}); err != nil {
+			t.Fatal(err)
+		}
+	}
+
+	// The first page reports "big/" off its first object; the pages after it must
+	// not look at the other 199.
+	opts := ListOptions{Delimiter: "/", MaxResults: 1}
+	var visited []int
+	for pages := 0; ; pages++ {
+		if pages > 5 {
+			t.Fatal("pagination did not terminate")
+		}
+		counting.walked = 0
+		objs, err := emu
```

---

### Incident Patch 10: `b6b15779` (2026-08-13)
**Commit Message**: docs: fix outdated contribution link (#2532)

## Description

Updates the outdated **"more ways to contribute"** link in
`CONTRIBUTING.md`.

The link was pointing to:

`https://encore.dev/docs/community/contribute`

and has been updated to:

`https://encore.dev/docs/ts/community/contribute`

## Related Issue

Fixes #2531

<!-- codesmith:footer -->
---
<a
href="https://app.blacksmith.sh/encoredev/codesmith/encore/pr/2532"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v2.svg"><img
alt="View with [code]smith"
src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"></picture></a>
<a
href="https://backend.blacksmith.sh/track/enable-autofix?expires=1789213032&installation_model_id=427204&pr_number=2532&repository=encoredev%2Fencore&return_to=https%3A%2F%2Fgithub.com%2Fencoredev%2Fencore%2Fpull%2F2532&signature=aefe1c18ffc41ec33609bf0033166c0cf389ef7e9a19d494f26a01cb793ba3ce"><picture><source
media="(prefers-color-scheme: dark)"


**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ We're so excited that you are interested in contributing to Encore!
 All contributions are welcome, and there are several valuable ways to contribute.
 
 Below is a technical walkthrough of developing the `encore` command for contributing code
-to the Encore project. Head over to the community section for [more ways to contribute](https://encore.dev/docs/community/contribute)!
+to the Encore project. Head over to the community section for [more ways to contribute](https://encore.dev/docs/ts/community/contribute)!
 
 ## GitHub Codespaces / VS Code Remote Containers
 The easiest way to get started with developing Encore is using
```

#### Recent Merged Pull Requests:
- **PR #2587** (2026-09-30): cmd: handle optional personal orgs (@ngalaiko)
- **PR #2586** (2026-09-29): cli: allow to create org apps (@ngalaiko)
- **PR #2585** (2026-09-28): fix(daemon): migration uses wrong context (@ekerfelt)
- **PR #2583** (2026-09-22): runtimes/js: handle empty buffers in bucket uploads and sqldb params (@eandre)
- **PR #2582** (2026-09-17):  cli/daemon: paginate and filter traces, budget trace data by size not count  (@lennartp)
- **PR #2577** (2026-09-08): tsparser: fix test (@eandre)
- **PR #2576** (2026-09-08): perf: improve performance of `encore build docker` (@eandre)
- **PR #2575** (2026-09-08): feat: support production-only dependency installs for TypeScript apps (@eandre)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

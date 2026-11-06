> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/okteto-okteto-learnings.md`  
> **Source**: github ([https://github.com/okteto/okteto](https://github.com/okteto/okteto))  
> **Source Version**: `a2043817`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T14:57:24.105Z  
> **Learning ID**: `learn-github-okteto-okteto`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): okteto/okteto

> **Canonical Artifact**: `07_PROJECT_LEARNING/okteto-okteto-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/okteto/okteto](https://github.com/okteto/okteto))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-06T14:56:29.154Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `okteto/okteto`
- **Description**: Develop your applications directly in your Kubernetes Cluster
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3554 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/context/utils.go`
```
// Copyright 2023 The Okteto Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package context

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/okteto/okteto/pkg/config"
	"github.com/okteto/okteto/pkg/constants"
	"github.com/okteto/okteto/pkg/k8s/kubeconfig"
	oktetoLog "github.com/okteto/okteto/pkg/log"
)

type SelectItem struct {
	Name   string
	Enable bool
}

type ManifestOptions struct {
	Name     string
	Filename string
}

func getKubernetesContextList(filterOkteto bool) []string {
	contextList := make([]string, 0)
	kubeconfigFile := config.GetKubeconfigPath()
	cfg := kubeconfig.Get(kubeconfigFile)
	if cfg == nil {
		return contextList
	}
	if !filterOkteto {
		for name := range cfg.Contexts {
			contextList = append(contextList, name)
		}
		return contextList
	}
	for name := range cfg.Contexts {
		if _, ok := cfg.Contexts[name].Extensions[constants.OktetoExtension]; ok && filterOkteto {
			continue
		}
		contextList = append(contextList, name)
	}
	return contextList
}

func getKubernetesContextNamespace(k8sContext string) string {
	kubeconfigFile := config.GetKubeconfigPath()
	cfg := kubeconfig.Get(kubeconfigFile)
	if cfg == nil {
		return ""
	}
	if cfg.Contexts[k8sContext].Namespace == "" {
		return "default"
	}
	return cfg.Contexts[k8sContext].Namespace
}

func isCreateNewContextOption(option string) bool {
	return option == newOEOption
}

func askForOktetoURL(message string) (string, error) {
	err := oktetoLog.Question("%s", message)
	if err != nil {
		return "", err
	}
	var oktetoURL string
	if _, err := fmt.Scanln(&oktetoURL); err != nil {
		return "", err
	}

	url, err := url.Parse(oktetoURL)
	if err != nil {
		return "", nil
	}
	if url.Scheme == "" {
		url.Scheme = "https"
	}
	return strings.TrimSuffix(url.String(), "/"), nil
}

func isValidCluster(cluster string) bool {
	for _, c := range getKubernetesContextList(false) {
		if cluster == c {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `cmd/preview/deploy_utils.go`
```
// Copyright 2023 The Okteto Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package preview

import (
	"errors"
	"fmt"
	"strings"

	"github.com/okteto/okteto/cmd/utils"
	"github.com/okteto/okteto/pkg/env"
	oktetoLog "github.com/okteto/okteto/pkg/log"
	modelUtils "github.com/okteto/okteto/pkg/model/utils"
	"github.com/okteto/okteto/pkg/okteto"
	"github.com/okteto/okteto/pkg/validator"
)

var (
	ErrNotValidPreviewScope = errors.New("value is invalid for flag 'scope'. Accepted values are ['global', 'personal']")
)

func optionsSetup(cwd string, opts *DeployOptions, args []string) error {
	if err := validator.CheckReservedVariablesNameOption(opts.variables); err != nil {
		return err
	}

	if len(args) == 0 {
		opts.name = getRandomName(opts.scope)
	} else {
		opts.name = getExpandedName(args[0])
	}

	var err error
	opts.repository, err = getRepository(cwd, opts.repository)
	if err != nil {
		return err
	}
	opts.branch, err = getBranch(cwd, opts.branch)
	if err != nil {
		return err
	}

	if err := validatePreviewType(opts.scope); err != nil {
		return err
	}

	return nil
}

func validatePreviewType(previewType string) error {
	if !(previewType == "global" || previewType == "personal") {
		return fmt.Errorf("%s %w", previewType, ErrNotValidPreviewScope)
	}
	return nil
}

func getRepository(cwd string, repository string) (string, error) {
	if repository != "" {
		return repository, nil
	}

	oktetoLog.Info("inferring git repository URL")
	return modelUtils.GetRepositoryURL(cwd)
}

func getBranch(cwd, branch string) (string, error) {
	if branch != "" {
		return branch, nil
	}

	oktetoLog.Info("inferring git repository branch")
	return utils.GetBranch(cwd)
}

func getRandomName(scope string) string {
	name := strings.ReplaceAll(GetRandomName(-1), "_", "-")
	if scope == "personal" {
		username := strings.ToLower(okteto.GetSanitizedUsername())
		name = fmt.Sprintf("%s-%s", name, username)
	}
	return name
}

func getExpandedName(name string) string {
	expandedName, err := env.ExpandEnv(name)
	if err != nil {
		return name
	}
	return expandedName
}

func getPreviewURL(name string) string {
	oktetoURL := okteto.GetContext().Name
	previewURL := fmt.Sprintf("%s/previews/%s", oktetoURL, name)
	return previewURL
}

```

### Core Architecture Module: `cmd/utils/args.go`
```
// Copyright 2023 The Okteto Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package utils

import (
	"fmt"

	oktetoErrors "github.com/okteto/okteto/pkg/errors"
	"github.com/spf13/cobra"
)

// NoArgsAccepted validates that the number of arguments given by the user is 0
func NoArgsAccepted(url string) cobra.PositionalArgs {
	return func(cmd *cobra.Command, args []string) error {
		var hint string
		if url != "" {
			hint = fmt.Sprintf("Visit %s for more information.", url)
		}
		if len(args) > 0 {
			return oktetoErrors.UserError{
				E:    fmt.Errorf("arguments are not supported for command %q.", cmd.CommandPath()),
				Hint: hint,
			}
		}
		return nil
	}
}

// MaximumNArgsAccepted returns an error if there are more than N args.
func MaximumNArgsAccepted(n int, url string) cobra.PositionalArgs {
	return func(cmd *cobra.Command, args []string) error {
		return maxNArgs(cmd, n, url, args)
	}
}

func maxNArgs(cmd *cobra.Command, n int, url string, args []string) error {
	var hint string
	if url != "" {
		hint = fmt.Sprintf("Visit %s for more information.", url)
	}
	if len(args) > n {
		return oktetoErrors.UserError{
			E:    fmt.Errorf("%q accepts at most %d arg(s), but received %d", cmd.CommandPath(), n, len(args)),
			Hint: hint,
		}
	}
	return nil
}

// MinimumNArgsAccepted returns an error if there are less than N args.
func MinimumNArgsAccepted(n int, url string) cobra.PositionalArgs {
	return func(cmd *cobra.Command, args []string) error {
		var hint string
		if url != "" {
			hint = fmt.Sprintf("Visit %s for more information.", url)
		}
		if len(args) < n {
			return oktetoErrors.UserError{
				E:    fmt.Errorf("%q requires at least %d arg(s), but only received %d", cmd.CommandPath(), n, len(args)),
				Hint: hint,
			}
		}
		return nil
	}
}

// ExactArgsAccepted returns an error if there are not exactly n args.
func ExactArgsAccepted(n int, url string) cobra.PositionalArgs {
	return func(cmd *cobra.Command, args []string) error {
		var hint string
		if url != "" {
			hint = fmt.Sprintf("Visit %s for more information.", url)
		}
		if len(args) != n {
			return oktetoErrors.UserError{
				E:    fmt.Errorf("%q accepts %d arg(s), but received %d", cmd.CommandPath(), n, len(args)),
				Hint: hint,
			}
		}
		return nil
	}
}

```

### Core Architecture Module: `cmd/utils/dev.go`
```
// Copyright 2023 The Okteto Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package utils

import (
	"context"
	"errors"
	"fmt"
	"os"
	"runtime"
	"sort"
	"strings"

	"github.com/manifoldco/promptui"
	oktetoErrors "github.com/okteto/okteto/pkg/errors"
	"github.com/okteto/okteto/pkg/k8s/apps"
	"github.com/okteto/okteto/pkg/k8s/deployments"
	oktetoLog "github.com/okteto/okteto/pkg/log"
	"github.com/okteto/okteto/pkg/model"
	"k8s.io/client-go/kubernetes"
)

var (
	// ErrNoDevSelected is raised when no development environment is selected
	ErrNoDevSelected = errors.New("No Development Environment selected")
)

const (
	// DefaultManifest default okteto manifest file
	DefaultManifest = "okteto.yml"
)

// GetDevFromManifest gets a dev from a manifest by comparing the given dev name with the dev name in the manifest
func GetDevFromManifest(manifest *model.Manifest, devName string) (*model.Dev, error) {
	if len(manifest.Dev) == 0 {
		return nil, oktetoErrors.ErrManifestNoDevSection
	} else if len(manifest.Dev) == 1 {
		for name, dev := range manifest.Dev {
			if devName != "" {
				if devName != name {
					return nil, oktetoErrors.UserError{
						E:    fmt.Errorf(oktetoErrors.ErrDevContainerNotExists, devName),
						Hint: fmt.Sprintf("Available options are: [%s]", name),
					}
				}
			}

			return dev, nil
		}
	}

	if devName == "" {
		return nil, ErrNoDevSelected
	}

	var options []string
	for name, dev := range manifest.Dev {
		if name == devName {
			return dev, nil
		}
		options = append(options, name)
	}
	return nil, oktetoErrors.UserError{
		E:    fmt.Errorf(oktetoErrors.ErrDevContainerNotExists, devName),
		Hint: fmt.Sprintf("Available options are: [%s]", strings.Join(options, ", ")),
	}
}

// SelectDevFromManifest prompts the selector to choose a development container and returns the dev selected or error
func SelectDevFromManifest(manifest *model.Manifest, selector OktetoSelectorInterface, devs []string) (*model.Dev, error) {
	sort.Slice(devs, func(i, j int) bool {
		l1, l2 := len(devs[i]), len(devs[j])
		if l1 != l2 {
			return l1 < l2
		}
		return devs[i] < devs[j]
	})
	var items []SelectorItem
	for _, dev := range devs {
		items = append(items, SelectorItem{
			Name:   dev,
			Label:  dev,
			Enable: true,
		})
	}
	devKey, err := selector.AskForOptionsOkteto(items, -1)
	if err != nil {
		return nil, err
	}
	dev := manifest.Dev[devKey]

	dev.Name = devKey

	if err := dev.Validate(); err != nil {
		return nil, err
	}

	return manifest.Dev[devKey], nil
}

// YesNoDefault specifies what will be assumed when the user doesn't answer explicitly
type YesNoDefault string

const (
	YesNoDefault_Unspecified = "[y/n]"
	YesNoDefault_Yes         = "[Y/n]"
	YesNoDefault_No          = "[y/N]"
)

// AskYesNo prompts for yes/no confirmation
func AskYesNo(q string, d YesNoDefault) (bool, error) {
	var answer string
	for {
		if err := oktetoLog.Question("%s %s: ", q, d); err != nil {
			return false, err
		}
		if _, err := fmt.Scanln(&answer); err != nil && err.Error() != "unexpected newline" {
			return false, err
		}

		if answer == "" && d != YesNoDefault_Unspecified {
			answer = "y"
			if d == YesNoDefault_No {
				answer = "n"
			}
			break
		}

		if answer == "y" || answer == "Y" || answer == "n" || answer == "N" {
			break
		}

		oktetoLog.Fail("input must be 'Y/y' or 'N/n'")
	}

	if answer == "y" || answer == "Y" {
		return true, nil
	}
	return false, nil
}

func AskForOptions(options []string, label string) (string, error) {
	selectedTemplate := `{{ " ✓ " | bgGreen | black }} {{ .Label | green }}`
	activeTemplate := fmt.Sprintf("%s {{ . | oktetoblue }}", promptui.IconSelect)
	inactiveTemplate := "  {{ . | oktetoblue }}"
	if runtime.GOOS == "windows" {
		selectedTemplate = " ✓  {{ . | blue }}"
		activeTemplate = fmt.Sprintf("%s {{ . | blue }}", promptui.IconSelect)
		inactiveTemplate = "  {{ . | blue }}"
	}

	prompt := promptui.Select{
		Label: label,
		Items: options,
		Size:  len(options),
		Templates: &promptui.SelectTemplates{
			Label:    "{{ . }}",
			Selected: selectedTemplate,
			Active:   activeTemplate,
			Inactive: inactiveTemplate,
			FuncMap:  promptui.FuncMap,
		},
	}
	prompt.Templates.FuncMap["oktetoblue"] = oktetoLog.BlueString

	i, _, err := prompt.Run()
	if err != nil {
		oktetoLog.Infof("invalid option: %s", err)
		return "", fmt.Errorf("invalid option")
	}

	return options[i], nil
}

// CheckIfDirectory checks if a path is a directory
func CheckIfDirectory(path string) error {
	fileInfo, err := os.Stat(path)
	if err != nil {
		oktetoLog.Infof("error on CheckIfDirectory: %s", err.Error())
		return fmt.Errorf("'%s' does not exist", path)
	}
	if fileInfo.IsDir() {
		return nil
	}
	return fmt.Errorf("'%s' is not a directory", path)
}

func GetDownCommand(devPath string) string {
	okDownCommandHint := "okteto down -v"
	if DefaultManifest != devPath && devPath != "" {
		okDownCommandHint = fmt.Sprintf("okteto down -v -f %s", devPath)
	}
	return okDownCommandHint
}

func GetApp(ctx context.Context, dev *model.Dev, namespace string, c kubernetes.Interface, isRetry bool) (apps.App, bool, error) {
	app, err := apps.Get(ctx, dev, namespace, c)
	if err != nil {
		if !oktetoErrors.IsNotFound(err) {
			return nil, false, err
		}
		if dev.Autocreate {
			if isRetry && !doesAutocreateAppExist(ctx, dev, namespace, c) {
				return nil, false, fmt.Errorf("development container has been deactivated")
			}
			return apps.NewDeploymentApp(deployments.Sandbox(dev, namespace)), true, nil
		}
		if len(dev.Selector) > 0 {
			if oktetoErrors.IsNotFound(err) {
				err = oktetoErrors.UserError{
					E:    fmt.Errorf("didn't find an application in namespace %s that matches the selector in your Okteto manifest", namespace),
					Hint: "Update the selector or point your context to a different namespace and try again"}
			}
			return nil, false, err
		}
		return nil, false, oktetoErrors.UserError{
			E: fmt.Errorf("application '%s' not found in namespace '%s'", dev.Name, namespace),
			Hint: `Verify that your application is running and your okteto context is pointing to the right namespace
    Or set the 'autocreate' field in your okteto manifest if you want to create a standalone development container
    More information is available here: https://okteto.com/docs/reference/okteto-cli/#up`,
		}
	}
	return app, false, nil
}

func doesAutocreateAppExist(ctx context.Context, dev *model.Dev, namespace string, c kubernetes.Interface) bool {
	autocreateDev := *dev
	autocreateDev.Name = model.DevCloneName(dev.Name)
	_, err := apps.Get(ctx, &autocreateDev, namespace, c)
	if err != nil && !oktetoErrors.IsNotFound(err) {
		oktetoLog.Infof("getApp autocreate k8s error, retrying...")
		_, err := apps.Get(ctx, &autocreateDev, namespace, c)
		return err == nil
	}
	return err == nil
}

```

### Core Architecture Module: `cmd/utils/displayer/collapse_tty.go`
```
// Copyright 2023 The Okteto Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package displayer

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"text/template"
	"time"

	"github.com/manifoldco/promptui"
	"github.com/manifoldco/promptui/screenbuf"
	oktetoLog "github.com/okteto/okteto/pkg/log"
	"golang.org/x/term"
)

const ansi = "[\u001B\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))"

var (
	spinnerChars = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
	cursorUp     = "\x1b[1A"
	resetLine    = "\x1b[0G"
	re           = regexp.MustCompile(ansi)
)

// TTYCollapseDisplayer displays with a screenbuf
type TTYCollapseDisplayer struct {
	err                   error
	commandContext        context.Context
	stdoutScanner         *bufio.Scanner
	stderrScanner         *bufio.Scanner
	screenbuf             *screenbuf.ScreenBuf
	cancel                context.CancelFunc
	command               string
	linesToDisplay        []string
	numberOfLines         int
	buildingpreviousLines int
	isBuilding            bool
}

// Display displays the command output
func (d *TTYCollapseDisplayer) Display(commandName string) {
	d.command = commandName

	d.hideCursor()
	d.commandContext, d.cancel = context.WithCancel(context.Background())
	wg := &sync.WaitGroup{}
	wgDelta := 0
	if d.stdoutScanner != nil {
		wgDelta++
	}
	if d.stderrScanner != nil {
		wgDelta++
	}
	wg.Add(wgDelta)

	commandChan := make(chan bool, 1)
	go d.displayCommand(commandChan)
	if d.stdoutScanner != nil {
		go d.displayStdout(wg)
	}
	if d.stderrScanner != nil {
		go d.displayStderr(wg)
	}
	wg.Wait()
	d.cancel()
	<-commandChan
}

func (d *TTYCollapseDisplayer) displayCommand(commandChan chan bool) {
	t := time.NewTicker(50 * time.Millisecond)
	shouldExit := false
	for {
		for i := 0; i < len(spinnerChars); i++ {
			select {
			case <-t.C:
				width, _, err := term.GetSize(int(os.Stdout.Fd()))
				if err != nil {
					oktetoLog.Infof("Error getting terminal size: %s", err)
				}
				commandLines := renderCommand(spinnerChars[i], d.command, width)
				for _, commandLine := range commandLines {
					if _, err := d.screenbuf.Write(commandLine); err != nil {
						oktetoLog.Infof("Error writing command line: %s", err)
					}
				}
				lines := renderLines(d.linesToDisplay, width)
				for _, line := range lines {
					if _, err := d.screenbuf.Write(line); err != nil {
						oktetoLog.Infof("Error writing line: %s", err)
					}
				}
				d.screenbuf.Flush()
			case <-d.commandContext.Done():
				shouldExit = true
			}
			if shouldExit {
				break
			}
		}
		if shouldExit {
			break
		}
	}
	commandChan <- true
}

func (d *TTYCollapseDisplayer) displayStdout(wg *sync.WaitGroup) {
	for d.stdoutScanner.Scan() {
		select {
		case <-d.commandContext.Done():
		default:
			line := strings.TrimSpace(d.stdoutScanner.Text())
			if isTopDisplay(line) {
				prevState := d.isBuilding
				d.isBuilding = checkIfIsBuildingLine(line)
				if d.isBuilding && d.isBuilding != prevState {
					d.buildingpreviousLines = len(d.linesToDisplay)
				}
				sanitizedLine := strings.ReplaceAll(line, cursorUp, "")
				sanitizedLine = strings.ReplaceAll(sanitizedLine, resetLine, "")
				d.linesToDisplay = append(d.linesToDisplay[:d.buildingpreviousLines-1], sanitizedLine)
			} else {
				if len(d.linesToDisplay) >= d.numberOfLines {
					d.linesToDisplay = d.linesToDisplay[1:]
				}
				d.linesToDisplay = append(d.linesToDisplay, line)
			}
			if os.Stdout == oktetoLog.GetOutput() {
				oktetoLog.AddToBuffer(oktetoLog.InfoLevel, "%s", line)
			}
			continue
		}
		break
	}
	if d.stdoutScanner.Err() != nil {
		oktetoLog.Infof("Error reading command output: %s", d.stdoutScanner.Err().Error())
	}
	wg.Done()
}

func checkIfIsBuildingLine(line string) bool {
	if strings.Contains(line, "Building") {
		return !strings.Contains(line, "FINISHED")
	}
	return false
}

func (d *TTYCollapseDisplayer) displayStderr(wg *sync.WaitGroup) {
	for d.stderrScanner.Scan() {
		select {
		case <-d.commandContext.Done():
		default:
			line := strings.TrimSpace(d.stderrScanner.Text())
			d.err = errors.New(line)
			if len(d.linesToDisplay) >= d.numberOfLines {
				d.linesToDisplay = d.linesToDisplay[1:]
			}
			d.linesToDisplay = append(d.linesToDisplay, line)
			if os.Stdout == oktetoLog.GetOutput() {
				oktetoLog.AddToBuffer(oktetoLog.WarningLevel, "%s", line)
			}
			continue
		}
		break
	}
	if d.stderrScanner.Err() != nil {
		oktetoLog.Infof("Error reading command output: %s", d.stderrScanner.Err().Error())
	}
	wg.Done()
}

func isTopDisplay(line string) bool {
	return strings.Contains(line, fmt.Sprintf("%s%s", cursorUp, resetLine))
}

// CleanUp collapses and stops displaying
func (d *TTYCollapseDisplayer) CleanUp(err error) {
	if d.screenbuf == nil {
		return
	}
	if d.command == "" {
		return
	}

	var message []byte
	if err == nil {
		message = renderSuccessCommand(d.command)
		d.screenbuf.Reset()
		if err := d.screenbuf.Clear(); err != nil {
			oktetoLog.Infof("Error clearing screen: %s", err)
		}
		if err := d.screenbuf.Flush(); err != nil {
			oktetoLog.Infof("Error flushing screen: %s", err)
		}
		if _, err := d.screenbuf.Write(message); err != nil {
			oktetoLog.Infof("Error writing success message: %s", err)
		}
		d.screenbuf.Flush()
	} else {
		message = renderFailCommand(d.command, err)
		d.screenbuf.Reset()
		if err := d.screenbuf.Clear(); err != nil {
			oktetoLog.Infof("Error clearing screen: %s", err)
		}
		if err := d.screenbuf.Flush(); err != nil {
			oktetoLog.Infof("Error flushing screen: %s", err)
		}
		if _, err := d.screenbuf.Write(message); err != nil {
			oktetoLog.Infof("Error writing fail message: %s", err)
		}
		width, _, err := term.GetSize(int(os.Stdout.Fd()))
		if err != nil {
			oktetoLog.Infof("Error getting terminal size: %s", err)
		}
		lines := renderLines(d.linesToDisplay, width)
		for _, line := range lines {
			if _, err := d.screenbuf.Write(line); err != nil {
				oktetoLog.Infof("Error writing line: %s", err)
			}
		}
		d.screenbuf.Flush()
	}
	d.cancel()
	<-d.commandContext.Done()
	d.reset()
	d.showCursor()

}

func renderCommand(spinnerChar, command string, charsPerLine int) [][]byte {
	firstLineCommandTemplate := fmt.Sprintf(` %s {{ . | oktetoblue }}`, spinnerChar)
	otherLineCommandTemplate := `    {{ . | oktetoblue }}`
	lastLineCommandTemplate := `    {{ . | oktetoblue }}:`
	funcMap := promptui.FuncMap
	funcMap["oktetoblue"] = oktetoLog.BlueString
	firstLineTpl, err := template.New("").Funcs(funcMap).Parse(firstLineCommandTemplate)
	if err != nil {
		return [][]byte{}
	}

	otherLinesTpl, err := template.New("").Funcs(funcMap).Parse(otherLineCommandTemplate)
	if err != nil {
		return [][]byte{}
	}

	lastLineTpl, err := template.New("").Funcs(funcMap).Parse(lastLineCommandTemplate)
	if err != nil {
		return [][]byte{}
	}

	command = fmt.Sprintf(" Running '%s'", command)
	result := [][]byte{}
	if charsPerLine == 0 || charsPerLine < 5 {
		result = append(result, render(firstLineTpl, command))
		return result
	}
	iterations := (len(command) + 4) / charsPerLine
	start := 0
	end := charsPerLine - 5
	for i := 0; i < iterations+1; i++ {
		if i == iterations {
			end = len(command) - 1
		}
		currentLine := command[start:end]
		if i == 0 {
			result = append(result, render(firstLineTpl, currentLine))
		} else if i < iterations {
			result = append(result, render(otherLinesTpl, currentLine))
		} else {
			result = append(result, render(lastLineTpl, currentLine))
		}
		start = end
		end += charsPerLine - 5
	}
	return result
}

func renderSuccessCommand(command string) []byte {
	commandTemplate := `{{ " ✓ " | bgGreen | black }} {{ . | green }}`
	tpl, err := template.New("").Funcs(promptui.FuncMap).Parse(commandTemplate)
	if err != nil {
		return []byte{}
	}

	return render(tpl, command)
}

func renderFailCommand(command string, err error) []byte {
	message := fmt.Sprintf("%s: %s", command, err.Error())
	commandTemplate := `{{ " x " | bgRed | black }} {{ . | oktetored }}`
	funcMap := promptui.FuncMap
	funcMap["oktetored"] = oktetoLog.RedString
	tpl, err := template.New("").Funcs(funcMap).Parse(commandTemplate)
	if err != nil {
		return []byte{}
	}

	return render(tpl, message)
}

func renderLines(queue []string, charsPerLine int) [][]byte {
	lineTemplate := "{{ . | white }} "
	tpl, err := template.New("").Funcs(promptui.FuncMap).Parse(lineTemplate)
	if err != nil {
		return [][]byte{}
	}

	result := [][]byte{}
	for _, line := range queue {
		lineWithoutColors := re.ReplaceAllString(line, "")
		if len(line) == len(lineWithoutColors) {
			result = append(result, renderLogWithoutColors(tpl, line, charsPerLine)...)
		} else {
			result = append(result, renderLogWithColors(tpl, line, charsPerLine)...)
			continue
		}
	}
	return result
}

func renderLogWithColors(tpl *template.Template, line string, charsPerLine int) [][]byte {
	result := [][]byte{}
	if charsPerLine > 4 && len(line)+2 > charsPerLine {
		result = append(result, render(tpl, fmt.Sprintf("%s...", line[:charsPerLine-1])))
	} else if line == "" {
		result = append(result, []byte(""))
	} else {
		result = append(result, render(tpl, fmt.Sprintf("%s...", line)))
	}
	return result
}

func renderLogWithoutColors(tpl *template.Template, line string, charsPerLine int) [][]byte {
	result := [][]byte{}
	if line == "" {
		result = append(result, []byte(""))
	} else if charsPerLine == 0 {
		line = strings.TrimSpace(lin
```

### Core Architecture Module: `cmd/utils/displayer/displayer.go`
```
// Copyright 2023 The Okteto Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package displayer

import (
	"io"

	oktetoLog "github.com/okteto/okteto/pkg/log"
)

// Displayer displays the commands from another writer to stdout
type Displayer interface {
	Display(commandName string)
	CleanUp(err error)
}

// NewDisplayer returns a new displayer
func NewDisplayer(output string, stdout, stderr io.Reader) Displayer {
	var displayer Displayer
	switch output {
	case oktetoLog.TTYFormat:
		displayer = newTTYDisplayer(stdout, stderr)
	case oktetoLog.PlainFormat:
		displayer = newPlainDisplayer(stdout, stderr)
	case oktetoLog.JSONFormat:
		displayer = newJSONDisplayer(stdout, stderr)
	default:
		displayer = newTTYDisplayer(stdout, stderr)
	}
	return displayer
}

```

### Core Architecture Module: `cmd/utils/displayer/json.go`
```
// Copyright 2023 The Okteto Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package displayer

import (
	"bufio"
	"context"
	"io"
	"os"
	"sync"

	oktetoLog "github.com/okteto/okteto/pkg/log"
)

type jsonDisplayer struct {
	stdoutScanner *bufio.Scanner
	stderrScanner *bufio.Scanner

	commandContext context.Context
	cancel         context.CancelFunc
}

func newJSONDisplayer(stdout, stderr io.Reader) *jsonDisplayer {
	var (
		stdoutScanner *bufio.Scanner
		stderrScanner *bufio.Scanner
	)
	if stdout != nil {
		stdoutScanner = bufio.NewScanner(stdout)
	}
	if stderr != nil {
		stderrScanner = bufio.NewScanner(stderr)
	}

	commandContext, cancel := context.WithCancel(context.Background())

	return &jsonDisplayer{
		stdoutScanner:  stdoutScanner,
		stderrScanner:  stderrScanner,
		commandContext: commandContext,
		cancel:         cancel,
	}
}

func (d *jsonDisplayer) Display(_ string) {
	var wg sync.WaitGroup
	wgDelta := 0
	if d.stdoutScanner != nil {
		wgDelta++
	}
	if d.stderrScanner != nil {
		wgDelta++
	}
	wg.Add(wgDelta)
	if d.stdoutScanner != nil {
		go func() {
			for d.stdoutScanner.Scan() {
				select {
				case <-d.commandContext.Done():
				default:
					line := d.stdoutScanner.Text()
					oktetoLog.FPrintln(os.Stdout, line)
					continue
				}
				break
			}
			wg.Done()
		}()
	}

	if d.stderrScanner != nil {
		go func() {
			for d.stderrScanner.Scan() {
				select {
				case <-d.commandContext.Done():
				default:
					line := d.stderrScanner.Text()
					oktetoLog.FPrintln(os.Stdout, line)
					continue
				}
				break
			}
			wg.Done()
		}()
	}
	wg.Wait()
}

// CleanUp stops displaying
func (d *jsonDisplayer) CleanUp(_ error) {
	d.cancel()
	<-d.commandContext.Done()
}

```

### Core Architecture Module: `cmd/utils/displayer/plain.go`
```
// Copyright 2023 The Okteto Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package displayer

import (
	"bufio"
	"context"
	"io"
	"os"
	"sync"

	oktetoLog "github.com/okteto/okteto/pkg/log"
)

type plainDisplayer struct {
	stdoutScanner *bufio.Scanner
	stderrScanner *bufio.Scanner

	commandContext context.Context
	cancel         context.CancelFunc
}

func newPlainDisplayer(stdout, stderr io.Reader) *plainDisplayer {
	var (
		stdoutScanner *bufio.Scanner
		stderrScanner *bufio.Scanner
	)
	if stdout != nil {
		stdoutScanner = bufio.NewScanner(stdout)
	}
	if stderr != nil {
		stderrScanner = bufio.NewScanner(stderr)
	}

	commandContext, cancel := context.WithCancel(context.Background())

	return &plainDisplayer{
		stdoutScanner:  stdoutScanner,
		stderrScanner:  stderrScanner,
		commandContext: commandContext,
		cancel:         cancel,
	}
}

func (d *plainDisplayer) Display(_ string) {
	var wg sync.WaitGroup
	wgDelta := 0
	if d.stdoutScanner != nil {
		wgDelta++
	}
	if d.stderrScanner != nil {
		wgDelta++
	}
	wg.Add(wgDelta)
	if d.stdoutScanner != nil {
		go func() {
			for d.stdoutScanner.Scan() {
				select {
				case <-d.commandContext.Done():
				default:
					line := d.stdoutScanner.Text()
					oktetoLog.FPrintln(os.Stdout, line)
					continue
				}
				break
			}
			wg.Done()
		}()
	}

	if d.stderrScanner != nil {
		go func() {
			for d.stderrScanner.Scan() {
				select {
				case <-d.commandContext.Done():
				default:
					line := d.stderrScanner.Text()
					oktetoLog.FWarning(os.Stdout, "%s", line)
					continue
				}
				break
			}
			wg.Done()
		}()
	}
	wg.Wait()
}

// CleanUp stops displaying
func (d *plainDisplayer) CleanUp(_ error) {
	d.cancel()
	<-d.commandContext.Done()
}

```

### Core Architecture Module: `cmd/utils/displayer/tty.go`
```
// Copyright 2023 The Okteto Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package displayer

import (
	"bufio"
	"context"
	"io"
	"os"
	"sync"

	"github.com/manifoldco/promptui/screenbuf"
	oktetoLog "github.com/okteto/okteto/pkg/log"
)

type ttyDisplayer struct {
	stdoutScanner *bufio.Scanner
	stderrScanner *bufio.Scanner
	screenbuf     *screenbuf.ScreenBuf

	commandContext context.Context
	cancel         context.CancelFunc

	linesToDisplay []string
}

func newTTYDisplayer(stdout, stderr io.Reader) *ttyDisplayer {
	var (
		stdoutScanner *bufio.Scanner
		stderrScanner *bufio.Scanner
	)
	if stdout != nil {
		stdoutScanner = bufio.NewScanner(stdout)
	}
	if stderr != nil {
		stderrScanner = bufio.NewScanner(stderr)
	}

	commandContext, cancel := context.WithCancel(context.Background())

	return &ttyDisplayer{
		stdoutScanner:  stdoutScanner,
		stderrScanner:  stderrScanner,
		screenbuf:      screenbuf.New(os.Stdout),
		commandContext: commandContext,
		cancel:         cancel,

		linesToDisplay: []string{},
	}
}

func (d *ttyDisplayer) Display(_ string) {
	var wg sync.WaitGroup
	wgDelta := 0
	if d.stdoutScanner != nil {
		wgDelta++
	}
	if d.stderrScanner != nil {
		wgDelta++
	}
	wg.Add(wgDelta)
	if d.stdoutScanner != nil {
		go func() {
			for d.stdoutScanner.Scan() {
				select {
				case <-d.commandContext.Done():
				default:
					line := d.stdoutScanner.Text()
					oktetoLog.Println(line)
					continue
				}
				break
			}
			if d.stdoutScanner.Err() != nil {
				oktetoLog.Infof("Error reading command output: %s", d.stdoutScanner.Err().Error())
			}
			wg.Done()
		}()
	}

	if d.stderrScanner != nil {
		go func() {
			for d.stderrScanner.Scan() {
				select {
				case <-d.commandContext.Done():
				default:
					line := d.stderrScanner.Text()
					oktetoLog.Println(line)
					continue
				}
				break
			}
			wg.Done()
		}()
	}
	wg.Wait()
}

// CleanUp stops displaying
func (d *ttyDisplayer) CleanUp(_ error) {
	d.cancel()
	<-d.commandContext.Done()
}

```

### Core Architecture Module: `cmd/utils/executor/executor.go`
```
// Copyright 2023 The Okteto Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package executor

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/okteto/okteto/pkg/constants"
	"github.com/okteto/okteto/pkg/env"
	oktetoLog "github.com/okteto/okteto/pkg/log"
	"github.com/okteto/okteto/pkg/model"
)

// ManifestExecutor is the interface to execute a command
type ManifestExecutor interface {
	Execute(command model.DeployCommand, env []string) error
	CleanUp(err error)
}

// Executor implements ManifestExecutor with an executor displayer
type Executor struct {
	displayer      executorDisplayer
	outputMode     string
	shell, dir     string
	runWithoutBash bool
}

type executorDisplayer interface {
	display(command string)
	startCommand(cmd *exec.Cmd) error
	cleanUp(err error)
}

// NewExecutor returns a new executor
func NewExecutor(output string, runWithoutBash bool, dir string) *Executor {
	var displayer executorDisplayer

	switch output {
	case oktetoLog.TTYFormat:
		displayer = newTTYExecutor()
	case oktetoLog.PlainFormat:
		displayer = newPlainExecutor()
	case oktetoLog.JSONFormat:
		displayer = newJSONExecutor()
	default:
		displayer = newTTYExecutor()
	}

	shell := "bash"
	if env.LoadBoolean(constants.OktetoDeployRemote) {
		shell = "sh"
	}

	return &Executor{
		outputMode:     output,
		displayer:      displayer,
		runWithoutBash: runWithoutBash,
		shell:          shell,
		dir:            dir,
	}
}

// Execute executes the specified command adding `env` to the execution environment
func (e *Executor) Execute(cmdInfo model.DeployCommand, env []string) error {

	cmd := exec.Command(e.shell, "-c", cmdInfo.Command)
	if e.runWithoutBash {
		cmd = exec.Command(cmdInfo.Command)
	}
	cmd.Env = append(os.Environ(), env...)

	if e.dir != "" {
		cmd.Dir = e.dir
	}

	if err := e.displayer.startCommand(cmd); err != nil {
		if execErr, ok := err.(*exec.Error); ok {
			if execErr != nil && execErr.Name == e.shell {
				return fmt.Errorf("%w: \"%s\" is a required dependency for executing the command", err, e.shell)
			}
		}
		return err
	}

	e.displayer.display(cmdInfo.Name)

	err := cmd.Wait()

	e.CleanUp(err)
	return err
}

// CleanUp cleans the execution lines
func (e *Executor) CleanUp(err error) {
	if e.displayer != nil {
		e.displayer.cleanUp(err)
	}
}

func startCommand(cmd *exec.Cmd) error {
	return cmd.Start()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4940** (2026-03-13): **ci: deduplicate CircleCI e2e triggers with debounce and scoped cancellation**
  *Symptoms*: ## Summary  - Extracts shared logic into a reusable workflow (`trigger-circleci-e2e.yml`) used by all three `run-e2e` jobs - Adds a 2-minute debounce via `concurrency` + `cancel-in-progress: true` to avoid duplicate runs on rapid pushes - Cancels active CircleCI pipelines for the branch before triggering a new one, scoped to the matching workflow name (e.g. `run-e2e` only cancels `run-e2e`, not `run-e2e-windows`) - Handles gracefully the case where no CircleCI pipelines exist for the branch  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/okteto/okteto/pull/4940?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 48.11%. Comparing base ([`ba7bdbd`](https://app.codecov.io/gh/okteto/okteto/commit/ba7bdbd8551a67d939f6635047588e33ea435e13?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto)) to head ([`77cf93a`](https://app.codecov.io/gh/okteto/okteto/commit/77cf93adf9f24ef55228b917758ecf3f488def53?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto)). :warning: Report is 6 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##           master    #494
  > > I guess that cancelling a running job will (or might) leave some "trash" in the okteto instance where is running, right? Like namespaces, deployments, etc....  Yes, it could leave some resources there. Should we then leave it running?

- **Issue #4846** (2025-12-22): **fix(log): mask platform env vars (DEV-1266)**
  *Symptoms*: # Proposed changes  Fixes [DEV-1266](https://okteto.atlassian.net/browse/DEV-1266)  This change ensures that all platform environment variables are always masked in logs during remote execution operations.  ## CLI Quality Reminders 🔧  For both authors and reviewers:  - Scrutinize for potential regressions - Ensure key automated tests are in place - Build the CLI and test using the validation steps - Assess Developer Experience impact (log messages, performances, etc) - If too broad, consider breaking into smaller PRs - Adhere to our [code style](https://github.com/okteto/okteto/blob/master/docs/code-style.md) and [code review](https://github.com/okteto/okteto/blob/master/docs/code-review.md) guidelines  [DEV-1266]: https://okteto.atlassian.net/browse/DEV-1266?atlOrigin=eyJpIjoiNWRkNTljNzYxNjVmNDY3MDlhMDU5Y2ZhYzA5YTRkZjUiLCJwIjoiZ2l0aHViLWNvbS1KU1cifQ

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

### Incident Patch 1: `102d8e90` (2026-11-05)
**Commit Message**: fix(deploy): show dependencies under one stage and only schedule wait: false ones (#5245)

* fix(deploy): show dependencies under one stage and only schedule wait: false ones

Dependencies are still deployed in parallel following depends_on, and
their output goes under one "Deploy dependencies" stage, with every line
prefixed with the name of its dependency.

The deploy waits for the dependencies with wait: true, their depends_on
chain and any dependency that another one lists in depends_on, and only
schedules the rest. The deploy commands start when the awaited ones are
deployed and the rest scheduled, and from there okteto deploy works as
before 3.25: no final wait for wait: false dependencies, no 10-minute
minimum timeout, and no forced plain build progress. A dependency that
can't be scheduled fails the deploy before the deploy commands, and
repositories that list each other with wait: false on one side deploy
again.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Javier Lopez <[REDACTED_EMAIL]>

* chore(log): remove the per-stage log API

PrintlnWithStage, SuccessWithStage and WarningWithStage were only used to
show dependencies deployed in parallel under th

**File**: `cmd/deploy/build.go` (modified, +0/-11)
```diff
@@ -49,7 +49,6 @@ func buildImages(ctx context.Context, builder builderInterface, cmapHandler Conf
 				EnableStages: true,
 				Manifest:     deployOptions.Manifest,
 				CommandArgs:  servicesToBuild,
-				OutputMode:   buildOutputMode(deployOptions),
 			}
 
 			if errBuild := builder.Build(ctx, buildOptions); errBuild != nil {
@@ -66,7 +65,6 @@ func buildImages(ctx context.Context, builder builderInterface, cmapHandler Conf
 			EnableStages: true,
 			Manifest:     deployOptions.Manifest,
 			CommandArgs:  setToSlice(servicesToBuildSet),
-			OutputMode:   buildOutputMode(deployOptions),
 		}
 		oktetoLog.Debug("force build from manifest definition")
 		if errBuild := builder.Build(ctx, buildOptions); errBuild != nil {
@@ -127,12 +125,3 @@ func setDifference[T comparable](set1, set2 map[T]bool) map[T]bool {
 	}
 	return difference
 }
-
-// buildOutputMode returns the output mode of the build: plain when dependencies log at the same time,
-// and empty (the default for the current output format) otherwise
-func buildOutputMode(deployOptions *Options) string {
-	if deployOptions.forcePlainBuildProgress {
-		return oktetoLog.PlainFormat
-	}
-	return ""
-}
```

**File**: `cmd/deploy/dependencies.go` (modified, +66/-238)
```diff
@@ -24,24 +24,13 @@ import (
 	"time"
 
 	pipelineCMD "github.com/okteto/okteto/cmd/pipeline"
-	"github.com/okteto/okteto/pkg/constants"
 	"github.com/okteto/okteto/pkg/deps"
 	"github.com/okteto/okteto/pkg/env"
 	oktetoErrors "github.com/okteto/okteto/pkg/errors"
-	oktetoLog "github.com/okteto/okteto/pkg/log"
 	"github.com/okteto/okteto/pkg/model"
 	"github.com/okteto/okteto/pkg/validator"
 )
 
-var (
-	// errDependencyFailed is returned by WaitUntilMainReady when a dependency the main deploy waits for failed.
-	// The details of every failure are returned by Wait.
-	errDependencyFailed = errors.New("a dependency failed to deploy")
-
-	// errDependenciesStopped is returned by WaitUntilMainReady when Stop was called before the main deploy could start
-	errDependenciesStopped = errors.New("the dependencies deployment was stopped")
-)
-
 // dependencyRunner deploys a single dependency and returns when it has finished
 type dependencyRunner interface {
 	Run(ctx context.Context, name string, dep *deps.Dependency) error
@@ -53,98 +42,42 @@ type dependencyResult struct {
 }
 
 // dependencyScheduler deploys the dependencies of a manifest following their depends_on graph.
-// A dependency starts as soon as all its predecessors have succeeded. The main deploy is treated
-// as one more node: it is ready when its predecessors (every dependency with wait: true, and all
-// their predecessors) have succeeded.
-// A failing dependency that the main deploy doesn't wait for doesn't block it: after its failure, only the
-// dependencies the main deploy waits for keep starting. After a failure of one of those (or Stop), no new
-// dependency is started. The running ones are always allowed to finish.
+// A dependency starts as soon as all its predecessors have succeeded. After a failure or Ctrl+C no new
+// dependency is started, and the running ones are allowed to finish.
 type dependencyScheduler struct {
-	runner           dependencyRunner
-	section          deps.ManifestSection
-	mainPredecessors map[string]bool
-	results          chan dependencyResult
-	mainReady        chan struct{}
-	done             chan struct{}
-	mainReadyErr     error
-	err              error
-	failed           []string
-	failures         map[string]error
-	mainReadyOnce    sync.Once
-	startOnce        sync.Once
-	// stopMu is held while a dependency starts, so none starts after Stop returns
-	stopMu  sync.Mutex
-	stopped bool
+	runner    dependencyRunner
+	section   deps.ManifestSection
+	results   chan dependencyResult
+	done      chan struct{}
+	err       error
+	startOnce sync.Once
 }
 
 func newDependencyScheduler(section deps.ManifestSection, runner dependencyRunner) *dependencyScheduler {
 	return &dependencyScheduler{
-		runner:           runner,
-		section:          section,
-		mainPredecessors: mainDeployPredecessors(section),
-		results:          make(chan dependencyResult, len(section)),
-		mainReady:        make(chan struct{}),
-		done:             make(chan struct{}),
+		runner:  runner,
+		section: section,
+		results: make(chan dependencyResult, len(section)),
+		done:    make(chan struct{}),
 	}
 }
 
-// Start launches the dependencies graph and returns immediately. It must be called before
-// WaitUntilMainReady or Wait, and calling it more than once has no effect.
+// Start launches the dependencies graph and returns immediately. It must be called before Wait, and calling it
+// more than once has no effect.
 func (s *dependencyScheduler) Start(ctx context.Context) {
 	s.startOnce.Do(func() {
 		go s.coordinate(ctx)
 	})
 }
 
-// WaitUntilMainReady blocks until the main deploy can start, a dependency failed or the context is cancelled
-func (s *dependencyScheduler) WaitUntilMainReady() error {
-	<-s.mainReady
-	return s.mainReadyErr
-}
-
-// MainPredecessors returns the sorted names of the dependencies the main deploy waits for
-func (s *dependencyScheduler) MainPredecessors() []string {
-	names := make([]string, 0, len(s.mainPredecessors))
-	for name := range s.mainPredecessors {
-		names = append(names, name)
-	}
-	sort.Strings(names)
-	return names
-}
-
-// Failed blocks until every started dependency has finished and returns the sorted names of the ones that failed
-func (s *dependencyScheduler) Failed() []string {
-	<-s.done
-	return s.failed
-}
-
-// FailureOf blocks until every started dependency has finished and returns the error of the dependency, if it failed
-func (s *dependencyScheduler) FailureOf(name string) error {
-	<-s.done
-	return s.failures[name]
-}
-
-// OverlapsMainDeploy returns true when some dependencies can run at the same time as the main deploy:
-// the ones the main deploy doesn't wait for
-func (s *dependencyScheduler) OverlapsMainDeploy() bool {
-	return len(s.section) > len(s.mainPredecessors)
-}
-
-// Stop prevents new dependencies from starting. Running dependencies are allowed to finish.
-func (s *dependencyScheduler) Stop() {
-	s.stopMu.Lock()
-	defer s.stopMu.Unlock()
-	s.stopped = true
-}

```

**File**: `cmd/deploy/dependencies_test.go` (modified, +106/-300)
```diff
@@ -18,12 +18,15 @@ import (
 	"errors"
 	"sync"
 	"testing"
+	"testing/synctest"
 	"time"
 
+	pipelineCMD "github.com/okteto/okteto/cmd/pipeline"
 	"github.com/okteto/okteto/pkg/constants"
 	"github.com/okteto/okteto/pkg/deps"
 	"github.com/okteto/okteto/pkg/env"
 	oktetoErrors "github.com/okteto/okteto/pkg/errors"
+	oktetoLog "github.com/okteto/okteto/pkg/log"
 	"github.com/okteto/okteto/pkg/validator"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
@@ -114,34 +117,6 @@ func requireNoMoreStarted(t *testing.T, f *fakeDependencyRunner) {
 	require.Empty(t, f.started)
 }
 
-func requireMainReadyResult(t *testing.T, mainReady <-chan error) error {
-	t.Helper()
-	select {
-	case err := <-mainReady:
-		return err
-	case <-time.After(schedulerTestTimeout):
-		require.FailNow(t, "timed out waiting for the main deploy to be ready")
-		return nil
-	}
-}
-
-func requireMainReadyPending(t *testing.T, mainReady <-chan error) {
-	t.Helper()
-	select {
-	case err := <-mainReady:
-		require.FailNow(t, "main deploy ready too early", "err: %v", err)
-	default:
-	}
-}
-
-func waitUntilMainReadyAsync(s *dependencyScheduler) <-chan error {
-	mainReady := make(chan error, 1)
-	go func() {
-		mainReady <- s.WaitUntilMainReady()
-	}()
-	return mainReady
-}
-
 func requireWaitResult(t *testing.T, s *dependencyScheduler) error {
 	t.Helper()
 	result := make(chan error, 1)
@@ -181,7 +156,6 @@ func TestDependencyScheduler_SpecExample(t *testing.T) {
 	s := newDependencyScheduler(section, runner)
 
 	s.Start(context.Background())
-	mainReady := waitUntilMainReadyAsync(s)
 
 	requireStarted(t, runner, "database", "messaging")
 
@@ -190,11 +164,8 @@ func TestDependencyScheduler_SpecExample(t *testing.T) {
 
 	runner.finish("messaging", nil)
 	requireStarted(t, runner, "backend")
-	requireMainReadyPending(t, mainReady)
 
 	runner.finish("backend", nil)
-	require.NoError(t, requireMainReadyResult(t, mainReady))
-
 	runner.finish("analytics", nil)
 	require.NoError(t, requireWaitResult(t, s))
 	requireNoMoreStarted(t, runner)
@@ -204,122 +175,57 @@ func TestDependencyScheduler_SpecExample(t *testing.T) {
 	require.Less(t, runner.indexOf(t, "end:messaging"), runner.indexOf(t, "start:backend"))
 }
 
-func TestDependencyScheduler_MainReadyWaitsForAncestorsOfWaitDependencies(t *testing.T) {
-	section := deps.ManifestSection{
-		"database": &deps.Dependency{Repository: "https://github.com/okteto/database"},
-		"backend": &deps.Dependency{
-			Repository: "https://github.com/okteto/backend",
-			DependsOn:  deps.DependsOn{"database"},
-			Wait:       true,
-		},
-	}
-	runner := newFakeDependencyRunner(section)
-	s := newDependencyScheduler(section, runner)
-
-	s.Start(context.Background())
-	mainReady := waitUntilMainReadyAsync(s)
-
-	requireStarted(t, runner, "database")
-	requireMainReadyPending(t, mainReady)
-	runner.finish("database", nil)
-
-	requireStarted(t, runner, "backend")
-	requireMainReadyPending(t, mainReady)
-	runner.finish("backend", nil)
-
-	require.NoError(t, requireMainReadyResult(t, mainReady))
-	require.NoError(t, requireWaitResult(t, s))
-}
-
-func TestDependencyScheduler_MainReadyImmediatelyWithoutWaitDependencies(t *testing.T) {
-	section := deps.ManifestSection{
-		"database": &deps.Dependency{Repository: "https://github.com/okteto/database"},
-	}
-	runner := newFakeDependencyRunner(section)
-	s := newDependencyScheduler(section, runner)
-
-	s.Start(context.Background())
-
-	require.NoError(t, requireMainReadyResult(t, waitUntilMainReadyAsync(s)))
-	requireStarted(t, runner, "database")
-
-	runner.finish("database", nil)
-	require.NoError(t, requireWaitResult(t, s))
-}
-
 func TestDependencyScheduler_NoDependencies(t *testing.T) {
 	section := deps.ManifestSection{}
 	s := newDependencyScheduler(section, newFakeDependencyRunner(section))
 
 	s.Start(context.Background())
 
-	require.NoError(t, requireMainReadyResult(t, waitUntilMainReadyAsync(s)))
 	require.NoError(t, requireWaitResult(t, s))
 }
 
-func TestDependencyScheduler_FailureBeforeMainReady(t *testing.T) {
-	section := specExampleSection()
-	runner := newFakeDependencyRunner(section)
-	s := newDependencyScheduler(section, runner)
+func TestDependencyScheduler_AFailureStopsNewDependencies(t *testing.T) {
+	synctest.Test(t, func(t *testing.T) {
+		section := specExampleSection()
+		runner := newFakeDependencyRunner(section)
+		s := newDependencyScheduler(section, runner)
 
-	s.Start(context.Background())
-	mainReady := waitUntilMainReadyAsync(s)
-	requireStarted(t, runner, "database", "messaging")
-
-	runner.finish("messaging", errors.New("boom"))
-	require.ErrorIs(t, requireMainReadyResult(t, mainReady), errDependencyFailed)
+		s.Start(context.Background())
+		requireStarted(t, runner, "database", "messaging")
 
-	// database was already running, so it is allowed to finish, but nothing new starts
-	runner.finish("database", nil)
-	err := requireWaitResult(t, s)
-	requireNoMoreStarted(t, runner)
+		runner.finish("messaging", errors
```

**File**: `cmd/deploy/dependency_output.go` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+// Copyright 2026 The Okteto Authors
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package deploy
+
+import (
+	"errors"
+	"fmt"
+	"runtime"
+	"strings"
+	"sync"
+
+	"github.com/fatih/color"
+	oktetoErrors "github.com/okteto/okteto/pkg/errors"
+	oktetoLog "github.com/okteto/okteto/pkg/log"
+)
+
+// dependenciesStage is the log stage of the output of every dependency. Like the other stages that deploy or destroy
+// dependencies, it starts with an information line with its name
+const dependenciesStage = "Deploying dependencies"
+
+// dependencyMark is how the logger marks the level of a message: a symbol in a terminal and in JSON, and a label in
+// plain output
+type dependencyMark struct {
+	badge  *color.Color
+	text   func(format string, a ...interface{}) string
+	symbol string
+	label  string
+	level  string
+}
+
+var (
+	successMark = dependencyMark{symbol: successSymbol(), label: "SUCCESS:", level: oktetoLog.InfoLevel, badge: color.New(color.BgGreen, color.FgBlack), text: color.New(color.FgGreen).SprintfFunc()}
+	warningMark = dependencyMark{symbol: " ! ", label: "WARNING:", level: oktetoLog.WarningLevel, badge: color.New(color.BgHiYellow, color.FgBlack), text: color.New(color.FgHiYellow).SprintfFunc()}
+	errorMark   = dependencyMark{symbol: " x ", label: "ERROR:", level: oktetoLog.ErrorLevel, badge: color.New(color.BgHiRed, color.FgBlack), text: color.New(color.FgHiRed).SprintfFunc()}
+)
+
+// successSymbol is the symbol the logger uses for a success
+func successSymbol() string {
+	if runtime.GOOS == "windows" {
+		return " + "
+	}
+	return " ✓ "
+}
+
+// print prints msg marked as the logger would, with the prefix before the mark
+func (m dependencyMark) print(prefix, msg string) {
+	switch oktetoLog.GetOutputFormat() {
+	case oktetoLog.JSONFormat:
+		// it prints the line too, with the level of the message
+		oktetoLog.AddToBuffer(m.level, "%s %s %s", prefix, m.symbol, msg)
+	case oktetoLog.TTYFormat:
+		oktetoLog.Println(fmt.Sprintf("%s %s %s", prefix, m.badge.Sprint(m.symbol), m.text("%s", msg)))
+		m.recordError(prefix, msg)
+	default:
+		oktetoLog.Println(fmt.Sprintf("%s %s %s", prefix, m.label, msg))
+		m.recordError(prefix, msg)
+	}
+}
+
+// recordError stores an error with its level in the output buffer, as the logger does when it prints one
+func (m dependencyMark) recordError(prefix, msg string) {
+	if m.level == oktetoLog.ErrorLevel {
+		oktetoLog.AddToBuffer(oktetoLog.ErrorLevel, "%s %s", prefix, msg)
+	}
+}
+
+// printLine prints a log line of a dependency with its prefix
+func printLine(prefix, line string) {
+	oktetoLog.Println(fmt.Sprintf("%s %s", prefix, line))
+}
+
+// dependencyOutputMu serializes the lines of the dependencies deployed in parallel, so that the lines of a message
+// are printed together. It is global because it guards a process-wide resource: the global logger
+var dependencyOutputMu sync.Mutex
+
+// dependencyOutput is the output of the pipeline deploy of a dependency, printed through the global logger under
+// the dependencies stage. Dependencies are deployed in parallel and their lines are interleaved, so every line is
+// prefixed with the name of its dependency, and the spinner messages are printed once, as lines. A dependency that
+// is only scheduled shows its result, without the messages of its deploy request
+type dependencyOutput struct {
+	name    string
+	awaited bool
+}
+
+func newDependencyOutput(name string, awaited bool) *dependencyOutput {
+	return &dependencyOutput{name: name, awaited: awaited}
+}
+
+// Spinner prints the message once: a spinner can't represent several dependencies at the same time
+func (o *dependencyOutput) Spinner(msg string) {
+	if o.awaited {
+		o.print(printLine, msg)
+	}
+}
+func (*dependencyOutput) StartSpinner()         {}
+func (*dependencyOutput) StopSpinner()          {}
+func (o *dependencyOutput) Success(msg string)  { o.print(successMark.print, msg) }
+func (o *dependencyOutput) Warning(msg string)  { o.print(warningMark.print, msg) }
+func (o *dependencyOutput) Println(line string) { o.print(printLine, line) }
+
+// finish prints the error of the dependency, if it failed. An interruption is not an error of the dependency:
+// the deploy reports it
+func (o *dependencyOutput) finish(err error) {
+	if err != nil && !errors.Is(err, oktetoErrors.ErrIntSig) {
+		o.print(errorMark.print, err.Error())
+	}
+}
+
+// print prefixes every line of msg with the name of the dependency and prints 
```

**File**: `cmd/deploy/dependency_output_test.go` (added, +201/-0)
```diff
@@ -0,0 +1,201 @@
+// Copyright 2026 The Okteto Authors
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package deploy
+
+import (
+	"encoding/json"
+	"errors"
+	"fmt"
+	"strings"
+	"sync"
+	"testing"
+
+	oktetoErrors "github.com/okteto/okteto/pkg/errors"
+	oktetoLog "github.com/okteto/okteto/pkg/log"
+	"github.com/sirupsen/logrus"
+	"github.com/stretchr/testify/require"
+)
+
+// captureDependencyOutput resets the logger with the given output format, under the dependencies stage, and
+// returns a function that gives every line of its output buffer as "level: message"
+func captureDependencyOutput(t *testing.T, format string) func() []string {
+	t.Helper()
+	oktetoLog.Init(logrus.WarnLevel)
+	oktetoLog.SetOutputFormat(format)
+	oktetoLog.SetStage(dependenciesStage)
+	t.Cleanup(func() {
+		oktetoLog.SetStage("")
+		oktetoLog.Init(logrus.WarnLevel)
+	})
+	return func() []string {
+		return bufferedLines(t)
+	}
+}
+
+// bufferedLines returns every line of the output buffer as "level: message", checking it's under the dependencies stage
+func bufferedLines(t *testing.T) []string {
+	t.Helper()
+	lines := []string{}
+	for _, line := range strings.Split(strings.TrimSpace(oktetoLog.GetOutputBuffer().String()), "\n") {
+		msg := struct {
+			Level   string `json:"level"`
+			Stage   string `json:"stage"`
+			Message string `json:"message"`
+		}{}
+		require.NoError(t, json.Unmarshal([]byte(line), &msg), line)
+		require.Equal(t, dependenciesStage, msg.Stage, line)
+		lines = append(lines, fmt.Sprintf("%s: %s", msg.Level, strings.TrimRight(msg.Message, "\n")))
+	}
+	return lines
+}
+
+func TestDependencyOutputOfAnAwaitedDependency(t *testing.T) {
+	printed := captureDependencyOutput(t, oktetoLog.JSONFormat)
+	out := newDependencyOutput("db", true)
+
+	out.Spinner("Waiting for repository 'db' to be deployed...")
+	out.StartSpinner()
+	out.Println("creating tables")
+	out.StopSpinner()
+	out.Success("Repository 'db' successfully deployed")
+	out.finish(nil)
+
+	require.Equal(t, []string{
+		"info: [db] Waiting for repository 'db' to be deployed...",
+		"info: [db] creating tables",
+		fmt.Sprintf("info: [db] %s Repository 'db' successfully deployed", successSymbol()),
+	}, printed())
+}
+
+func TestDependencyOutputOfAScheduledDependency(t *testing.T) {
+	printed := captureDependencyOutput(t, oktetoLog.JSONFormat)
+	out := newDependencyOutput("reports", false)
+
+	out.Spinner("Deploying repository 'reports'...")
+	out.StartSpinner()
+	out.StopSpinner()
+	out.Success("Repository 'reports' scheduled for deployment")
+	out.finish(nil)
+
+	require.Equal(t, []string{fmt.Sprintf("info: [reports] %s Repository 'reports' scheduled for deployment", successSymbol())}, printed())
+}
+
+func TestDependencyOutputPrefixesEveryLine(t *testing.T) {
+	printed := captureDependencyOutput(t, oktetoLog.JSONFormat)
+	out := newDependencyOutput("db", true)
+
+	out.Println("line 1\r\nline 2\r\n")
+	out.Warning("reconnecting\nto the logs")
+
+	require.Equal(t, []string{
+		"info: [db] line 1",
+		"info: [db] line 2",
+		"warn: [db]  !  reconnecting",
+		"warn: [db]  !  to the logs",
+	}, printed())
+}
+
+func TestDependencyOutputEndsAFailureWithItsError(t *testing.T) {
+	printed := captureDependencyOutput(t, oktetoLog.JSONFormat)
+	out := newDependencyOutput("reports", false)
+
+	out.Spinner("Deploying repository 'reports'...")
+	out.finish(errors.New("failed to deploy pipeline 'reports': forbidden"))
+
+	require.Equal(t, []string{"error: [reports]  x  failed to deploy pipeline 'reports': forbidden"}, printed())
+}
+
+func TestDependencyOutputDoesNotShowAnInterruptionAsAnError(t *testing.T) {
+	printed := captureDependencyOutput(t, oktetoLog.JSONFormat)
+	out := newDependencyOutput("db", true)
+
+	out.Println("db: working")
+	out.finish(fmt.Errorf("wait for pipeline 'db' to finish failed: %w", oktetoErrors.ErrIntSig))
+
+	require.Equal(t, []string{"info: [db] db: working"}, printed())
+}
+
+// printEveryLevel prints a message of every level from the output of an awaited dependency, which fails
+func printEveryLevel() {
+	out := newDependencyOutput("db", true)
+	out.Println("creating tables")
+	out.Success("deployed")
+	out.Warning("reconnecting")
+	out.finish(errors.New("exploded"))
+}
+
+func TestDependencyOutputInPlainOutput(t *testing.T) {
+	printed := captureDependencyOutput(t, oktetoLog.PlainFormat)
+
+	printEveryLevel()
+
+	// the plain logger stores the lines it prints twice in the buffer, as it always has
+	require.Subset(t, pri
```

**File**: `cmd/deploy/deploy.go` (modified, +88/-171)
```diff
@@ -21,7 +21,9 @@ import (
 	"os"
 	"os/signal"
 	"path/filepath"
+	"slices"
 	"strings"
+	"sync/atomic"
 	"time"
 
 	"github.com/google/uuid"
@@ -72,9 +74,6 @@ var (
 
 // Options represents options for deploy command
 type Options struct {
-	// forcePlainBuildProgress shows the build progress in plain mode: dependencies log at the same time
-	forcePlainBuildProgress bool
-
 	Manifest *model.Manifest
 	// ManifestPathFlag is the option -f as introduced by the user when executing this command.
 	// This is stored at the configmap as filename to redeploy from the ui.
@@ -484,55 +483,26 @@ func (dc *Command) Run(ctx context.Context, deployOptions *Options) error {
 
 	os.Setenv(constants.OktetoNameEnvVar, deployOptions.Name)
 
+	// on Ctrl+C the deploy command doesn't wait for Run: while the dependencies run, the interruption is recorded
+	// so that the deploy doesn't stay in progress. After them, an interruption is handled as before dependencies
+	// were deployed in parallel
+	dependenciesRunning := &atomic.Bool{}
 	if deployOptions.Manifest.HasDependencies() {
-		// on Ctrl+C the deploy command doesn't wait for Run, and dependencies can be running before and after the
-		// main deploy: the interruption is recorded so the deploy doesn't stay in progress
-		dc.onCleanUp = append(dc.onCleanUp, dc.recordInterruption(cfg, *data))
-	}
-
-	scheduler, err := dc.startDependencies(ctx, deployOptions)
-	if err != nil {
-		if errStatus := dc.CfgMapHandler.UpdateConfigMap(ctx, cfg, data, err); errStatus != nil {
-			return errStatus
-		}
-		return err
+		dependenciesRunning.Store(true)
+		dc.onCleanUp = append(dc.onCleanUp, dc.recordInterruption(cfg, *data, dependenciesRunning))
 	}
 
-	if err := scheduler.WaitUntilMainReady(); err != nil {
-		// a dependency failed or was interrupted: the running ones are allowed to finish and every failure is reported
-		if depsErr := scheduler.Wait(); depsErr != nil {
-			err = depsErr
-		}
-		recordDependencyFailures(scheduler)
-		setFailedDependencyStage(scheduler)
+	// when they fail or are interrupted, the interruption is still recorded: the deploy command can exit before
+	// the error is written below
+	if err := dc.deployDependencies(ctx, deployOptions); err != nil {
 		if errStatus := dc.CfgMapHandler.UpdateConfigMap(ctx, cfg, data, err); errStatus != nil {
 			return errStatus
 		}
 		return err
 	}
-
-	if err := dc.exportDependencyEnvVars(ctx, scheduler.MainPredecessors(), deployOptions.Namespace); err != nil {
-		scheduler.Stop()
-		err = errors.Join(err, scheduler.Wait())
-		recordDependencyFailures(scheduler)
-		if errStatus := dc.CfgMapHandler.UpdateConfigMap(ctx, cfg, data, err); errStatus != nil {
-			return errStatus
-		}
-		return err
-	}
-	oktetoLog.SetStage("")
-	// dependencies running at the same time as the build would break its TTY progress display
-	deployOptions.forcePlainBuildProgress = scheduler.OverlapsMainDeploy() && oktetoLog.GetOutputFormat() == oktetoLog.TTYFormat
+	dependenciesRunning.Store(false)
 
 	if deployOptions.Manifest.Deploy == nil {
-		if err := scheduler.Wait(); err != nil {
-			recordDependencyFailures(scheduler)
-			setFailedDependencyStage(scheduler)
-			if errStatus := dc.CfgMapHandler.UpdateConfigMap(ctx, cfg, data, err); errStatus != nil {
-				return errStatus
-			}
-			return err
-		}
 		// a manifest with only dependencies is deployed when all of them are
 		oktetoLog.SetStage("done")
 		oktetoLog.AddToBuffer(oktetoLog.InfoLevel, "EOF")
@@ -541,120 +511,75 @@ func (dc *Command) Run(ctx context.Context, deployOptions *Options) error {
 		return dc.CfgMapHandler.UpdateConfigMap(ctx, cfg, data, nil)
 	}
 
-	result, mainErr := dc.deployMain(ctx, deployOptions, cwd, c)
-	// when the main deploy fails, its error belongs to the stage it was running
-	mainStage := oktetoLog.GetStage()
-	if mainErr != nil {
-		// no new dependency starts, but the running ones are allowed to finish
-		scheduler.Stop()
-	}
-	depsErr := scheduler.Wait()
-	recordDependencyFailures(scheduler)
-	if mainErr != nil && !errors.Is(mainErr, oktetoErrors.ErrIntSig) && mainStage != "" && scheduler.OverlapsMainDeploy() {
-		// dependencies may have logged under their stages after the main deploy failed. Its error is written again
-		// under its stage so that it is the last one before the end, which is where the installer reports the failure
-		oktetoLog.SetStage(mainStage)
-		oktetoLog.AddToBuffer(oktetoLog.ErrorLevel, "%s", mainErr.Error())
-	}
-	// when only dependencies failed, their error is reported under their stage without the end marker, as when
-	// they fail before the main deploy
-	if result.deployRan && (mainErr != nil || depsErr == nil) {
-		oktetoLog.SetStage("done")
-		oktetoLog.AddToBuffer(oktetoLog.InfoLevel, "EOF")
-	}
-
-	if errors.Is(mainErr, oktetoErrors.ErrIntSig) {
-		if depsErr != nil {
-			oktetoLog.Infof("dependencies failed while the deploy was interrupted: %s", depsErr)
-		}
-		return nil
-	}
-
-	err = mainErr
-	if depsErr != nil {
-		err
```

**File**: `cmd/deploy/deploy_test.go` (modified, +379/-229)
```diff
@@ -35,6 +35,7 @@ import (
 	"github.com/okteto/okteto/pkg/cmd/pipeline"
 	"github.com/okteto/okteto/pkg/constants"
 	"github.com/okteto/okteto/pkg/deps"
+	"github.com/okteto/okteto/pkg/env"
 	oktetoErrors "github.com/okteto/okteto/pkg/errors"
 	"github.com/okteto/okteto/pkg/format"
 	"github.com/okteto/okteto/pkg/k8s/configmaps"
@@ -55,6 +56,7 @@ import (
 	"k8s.io/apimachinery/pkg/runtime"
 	"k8s.io/client-go/kubernetes"
 	"k8s.io/client-go/kubernetes/fake"
+	k8stesting "k8s.io/client-go/testing"
 	"k8s.io/client-go/tools/clientcmd/api"
 	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
 )
@@ -863,26 +865,24 @@ func (fd *capturingPipelineDeployer) ExecuteDeployPipeline(_ context.Context, op
 	return fd.errs[opts.Name]
 }
 
-func TestStartDependenciesNotAvailableInVanilla(t *testing.T) {
+func TestDeployDependenciesNotAvailableInVanilla(t *testing.T) {
 	okteto.CurrentStore = &okteto.ContextStore{
 		Contexts:       map[string]*okteto.Context{"test": {Namespace: "test", Cfg: &api.Config{}}},
 		CurrentContext: "test",
 	}
 	dc := &Command{PipelineCMD: &capturingPipelineDeployer{}}
 
-	_, err := dc.startDependencies(context.Background(), &Options{Manifest: fakeManifestWithDependency})
+	err := dc.deployDependencies(context.Background(), &Options{Manifest: fakeManifestWithDependency})
 
 	require.ErrorIs(t, err, errDepenNotAvailableInVanilla)
 }
 
-func TestStartDependenciesSharesParentWorkflowID(t *testing.T) {
+func TestDeployDependenciesSharesParentWorkflowID(t *testing.T) {
 	setTestOktetoContext()
 	deployer := &capturingPipelineDeployer{}
 	dc := &Command{PipelineCMD: deployer}
 
-	scheduler, err := dc.startDependencies(context.Background(), &Options{Manifest: fakeManifestWithDependency})
-	require.NoError(t, err)
-	require.NoError(t, scheduler.Wait())
+	require.NoError(t, dc.deployDependencies(context.Background(), &Options{Manifest: fakeManifestWithDependency}))
 
 	require.Len(t, deployer.captured, 2)
 	require.NotEmpty(t, deployer.captured["a"].ParentWorkflowID)
@@ -958,12 +958,18 @@ func resetLogBuffer(t *testing.T) {
 }
 
 func requireDeployStatus(t *testing.T, c *Command, expected string) {
+	t.Helper()
+	require.Equal(t, expected, deployStatus(t, c))
+}
+
+// deployStatus returns the status of the deploy as stored in its configmap
+func deployStatus(t *testing.T, c *Command) string {
 	t.Helper()
 	fakeClient, _, err := c.K8sClientProvider.ProvideWithLogger(clientcmdapi.NewConfig(), nil)
 	require.NoError(t, err)
 	cfg, err := configmaps.Get(context.Background(), pipeline.TranslatePipelineName("movies"), "test", fakeClient)
 	require.NoError(t, err)
-	require.Equal(t, expected, cfg.Data["status"])
+	return cfg.Data["status"]
 }
 
 func TestRunDependencyFailureSkipsMainDeploy(t *testing.T) {
@@ -981,7 +987,8 @@ func TestRunDependencyFailureSkipsMainDeploy(t *testing.T) {
 	deployer.AssertNotCalled(t, "Get")
 }
 
-func TestRunDependencyFailureIsReportedUnderTheDependencyStage(t *testing.T) {
+func TestRunDependencyFailureIsTheLastLineOfTheDependenciesStage(t *testing.T) {
+	resetLogBuffer(t)
 	t.Cleanup(func() { oktetoLog.SetStage("") })
 	pipelineDeployer := &capturingPipelineDeployer{errs: map[string]error{"messaging": assert.AnError}}
 	c := newRunWithDependenciesCommand(t, deps.ManifestSection{
@@ -992,7 +999,8 @@ func TestRunDependencyFailureIsReportedUnderTheDependencyStage(t *testing.T) {
 	err := c.Run(context.Background(), &Options{Name: "movies", Namespace: "test"})
 
 	require.Error(t, err)
-	require.Contains(t, deployOutput(t, c), `"level":"error","stage":"Deploying dependency messaging","message":"dependency 'messaging' failed`)
+	lines := outputLines(t, c)
+	require.Contains(t, lines[len(lines)-1], `"level":"error","stage":"Deploying dependencies","message":"dependency 'messaging' failed`)
 }
 
 // deployOutput returns the log of the deploy as stored in its configmap, which is what the UI shows
@@ -1007,40 +1015,6 @@ func deployOutput(t *testing.T, c *Command) string {
 	return string(output)
 }
 
-func TestRunNotAwaitedDependencyFailureFailsTheDeploy(t *testing.T) {
-	pipelineDeployer := &capturingPipelineDeployer{errs: map[string]error{"reports": assert.AnError}}
-	deployer := &fakeDeployer{}
-	deployer.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(deployer, nil)
-	deployer.On("Deploy", mock.Anything, mock.Anything).Return(nil)
-	c := newRunWithDependenciesCommand(t, deps.ManifestSection{
-		"reports": &deps.Dependency{Repository: "https://github.com/okteto/reports"},
-	}, pipelineDeployer, deployer)
-
-	err := c.Run(context.Background(), &Options{Name: "movies", Namespace: "test"})
-
-	require.ErrorContains(t, err, "dependency 'reports' failed")
-	requireDeployStatus(t, c, pipeline.ErrorStatus)
-	deployer.AssertCalled(t, "Deploy", mock.Anything, mock.Anything)
-}
-
-func TestRunNotAwaitedDependencyFailureDoesNotBlockTheMainDeploy(t *testing.T) {
-	t.Setenv("OKTETO_DEPENDEN
```

**File**: `cmd/deploy/local.go` (modified, +2/-2)
```diff
@@ -60,8 +60,8 @@ func (ld *localDeployer) Deploy(ctx context.Context, deployOptions *Options) err
 		},
 	}
 
-	// on an error, the deploy command (Command.Run) sets the "done" stage and the end of the output once the
-	// dependencies have finished, so that the lines they log meanwhile are not left after the end
+	// on an error, the deploy command (Command.Run) sets the "done" stage and the end of the output, as it does
+	// on success
 	return ld.runner.RunDeploy(ctx, params)
 }
 
```

---

### Incident Patch 2: `807bf7bc` (2026-11-06)
**Commit Message**: build(deps): bump renovatebot/github-action from 46.3.11 to 46.3.12 (#5249)

Bumps [renovatebot/github-action](https://github.com/renovatebot/github-action) from 46.3.11 to 46.3.12.
- [Release notes](https://github.com/renovatebot/github-action/releases)
- [Changelog](https://github.com/renovatebot/github-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/renovatebot/github-action/compare/v46.3.11...v46.3.12)

---
updated-dependencies:
- dependency-name: renovatebot/github-action
  dependency-version: 46.3.12
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/renovate.yml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ jobs:
         uses: actions/checkout@v7
 
       - name: Run Renovate
-        uses: renovatebot/github-action@v46.3.11
+        uses: renovatebot/github-action@v46.3.12
         with:
           configurationFile: .github/renovate.json
           token: ${{ secrets.RENOVATEBOT_GITHUB_TOKEN }}
```

---

### Incident Patch 3: `b7931868` (2026-11-06)
**Commit Message**: fix(compose): rename endpoint rule services along with sanitized service names (#5238)

Compose service names with "_", spaces or uppercase are sanitized
(web_app -> web-app), but endpoint rules kept pointing at the original
name. The rule then never matched a deployed service and the endpoint
was silently skipped. Rename the rule's service with the same map used
for the services.

Fixes #5237

Signed-off-by: poojagosika <[REDACTED_EMAIL]>

**File**: `pkg/model/stack_serializer.go` (modified, +10/-0)
```diff
@@ -344,6 +344,16 @@ func (s *Stack) UnmarshalYAML(unmarshal func(interface{}) error) error {
 		}
 	}
 
+	// Endpoint rules reference services by their original name, so point them
+	// to the sanitized name too or the endpoint never matches its service.
+	for _, endpoint := range s.Endpoints {
+		for i, rule := range endpoint.Rules {
+			if newName, ok := sanitizedServicesNames[rule.Service]; ok {
+				endpoint.Rules[i].Service = newName
+			}
+		}
+	}
+
 	s.Warnings.NotSupportedFields = getNotSupportedFields(&stackRaw)
 	s.Warnings.SanitizedServices = sanitizedServicesNames
 	s.Warnings.VolumeMountWarnings = make([]string, 0)
```

**File**: `pkg/model/stack_serializer_test.go` (modified, +29/-0)
```diff
@@ -3296,3 +3296,32 @@ services:
 	require.NoError(t, err)
 	require.Equal(t, "okteto/vote:2", s.Services["api"].Image)
 }
+
+func Test_EndpointRulesFollowSanitizedServiceNames(t *testing.T) {
+	manifest := []byte(`services:
+  web_app:
+    image: nginx
+    ports:
+      - 8080:8080
+  api:
+    image: nginx
+    ports:
+      - 3000:3000
+endpoints:
+  main:
+    - path: /
+      service: web_app
+      port: 8080
+    - path: /api
+      service: api
+      port: 3000
+`)
+
+	s, err := ReadStack(manifest, true)
+	require.NoError(t, err)
+
+	require.Contains(t, s.Services, "web-app")
+	require.Len(t, s.Endpoints["main"].Rules, 2)
+	assert.Equal(t, "web-app", s.Endpoints["main"].Rules[0].Service)
+	assert.Equal(t, "api", s.Endpoints["main"].Rules[1].Service)
+}
```

#### Recent Merged Pull Requests:
- **PR #5250** (2026-11-06): chore(deps): Update module github.com/go-git/go-git/v6 to v6.0.0-beta.1 (@oktetobot)
- **PR #5249** (2026-11-06): build(deps): bump renovatebot/github-action from 46.3.11 to 46.3.12 (@dependabot[bot])
- **PR #5248** (2026-11-05): [Backport release-3.25] fix(deploy): show dependencies under one stage and only schedule wait: false ones (@github-actions[bot])
- **PR #5247** (2026-11-04): [Backport release-3.17] fix(integration): set GITHUB_OUTPUT for namespace action test (@github-actions[bot])
- **PR #5246** (2026-11-04): [Backport release-3.17] Support IPv6 addresses when joining hosts and ports (@github-actions[bot])
- **PR #5245** (2026-11-05): fix(deploy): show dependencies under one stage and only schedule wait: false ones (@jLopezbarb)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

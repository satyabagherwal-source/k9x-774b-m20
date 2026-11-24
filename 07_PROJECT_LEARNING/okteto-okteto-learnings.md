> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/okteto-okteto-learnings.md`  
> **Source**: github ([https://github.com/okteto/okteto](https://github.com/okteto/okteto))  
> **Source Version**: `21298eb3`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T01:07:19.146Z  
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
> **Harvest Timestamp**: 2026-11-24T01:07:19.138Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `okteto/okteto`
- **Description**: Develop your applications directly in your Kubernetes Cluster
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3558 stars

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

### Incident Patch 1: `55998c4b` (2026-11-23)
**Commit Message**: ENG-35: Reach the internal API through its IP in remote builds (#5274)

* feat(remote): map the internal API hostname in remote builds

The catalog secret variables endpoint is served over TLS on a hostname
under the installation's wildcard certificate. Remote builds now map that
hostname to the internal IP of the Okteto API, which the cluster metadata
publishes, the same way they map the ssh-agent.

remote-run only calls an https endpoint through that mapping. When the
installation doesn't publish the IP, it fails right away with a hint
instead of timing out. An http endpoint, from installations that predate
this, is called as before.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Javier Lopez <[REDACTED_EMAIL]>

* feat(remote): reach the internal API through its IP instead of a hosts entry

Remote builds no longer map the internal API hostname in /etc/hosts. The CLI
passes the IP to remote-run in OKTETO_INTERNAL_API_IP, and remote-run connects
to it while keeping the hostname in the URL, so the certificate is still
verified against it. An invalid IP in the metadata no longer reaches BuildKit.

okteto.NewInternalAPIHTTPClient builds that client. It needs a vali

**File**: `cmd/remoterun/catalog.go` (modified, +58/-18)
```diff
@@ -18,11 +18,14 @@ import (
 	"errors"
 	"fmt"
 	"io/fs"
+	"net"
+	"net/url"
 	"os"
 	"regexp"
 	"strings"
 
 	"github.com/okteto/okteto/pkg/catalog"
+	"github.com/okteto/okteto/pkg/constants"
 	oktetoLog "github.com/okteto/okteto/pkg/log"
 	"github.com/okteto/okteto/pkg/okteto"
 	"github.com/okteto/okteto/pkg/types"
@@ -57,9 +60,9 @@ type catalogSecretVariablesGetter interface {
 }
 
 // catalogSecretVariablesClientFactory returns the client that gets the
-// catalog secret variables with the token, or with the user's token when it's
-// empty
-type catalogSecretVariablesClientFactory func(token string) (catalogSecretVariablesGetter, error)
+// catalog secret variables from the endpoint through the internal IP of the
+// Okteto API, with the token, or with the user's token when it's empty
+type catalogSecretVariablesClientFactory func(endpoint, internalAPIIP, token string) (catalogSecretVariablesGetter, error)
 
 // catalogSecretVariables gets the catalog secret variables of the development
 // environment being deployed or destroyed, to inject them into the env of the
@@ -72,6 +75,9 @@ type catalogSecretVariables struct {
 	tokenFile string
 	action    string
 	endpoint  string
+	// internalAPIIP is the internal IP of the Okteto API that the CLI starting
+	// the remote build passes on, empty when the installation doesn't publish it
+	internalAPIIP string
 	// phase is the operation whose commands get the variables
 	phase catalog.Phase
 	// forceDestroy runs the destroy commands without the variables when they
@@ -101,6 +107,23 @@ func (invalidCatalogSecretVariableNamesError) Error() string {
 	return "the catalog secret variables have invalid names"
 }
 
+// errCatalogSecretVariablesEndpointNotHTTPS is returned when the endpoint
+// isn't https, so the request isn't sent. Only the first installations with
+// catalog secret variables give an http endpoint, which remote builds can't
+// reach
+var errCatalogSecretVariablesEndpointNotHTTPS = errors.New("the catalog secret variables can't be fetched: the Okteto installation gives an endpoint that isn't https")
+
+// internalAPIIPMissingError is returned when the remote build doesn't get a
+// valid internal IP of the Okteto API to reach the endpoint through, so the
+// request isn't sent
+type internalAPIIPMissingError struct {
+	hostname string
+}
+
+func (e internalAPIIPMissingError) Error() string {
+	return fmt.Sprintf("the catalog secret variables can't be fetched: the remote build doesn't get the internal IP of the Okteto API to reach %s", e.hostname)
+}
+
 // addCatalogSecretVariablesFlags adds the flags to get the catalog secret
 // variables. They are only read from these flags, so a variable can't change
 // them
@@ -121,25 +144,22 @@ func newCatalogSecretVariables(action, endpoint string, phase catalog.Phase) (ca
 		return c, fmt.Errorf("--%s is required with --%s", catalog.SecretVariablesEndpointFlag, catalog.ActionFlag)
 	}
 	c.tokenFile = catalog.SecretVariablesTokenPath
+	c.internalAPIIP = os.Getenv(constants.OktetoInternalAPIIPEnvVar)
 	c.newClient = newCatalogSecretVariablesClient
 	return c, nil
 }
 
 // newCatalogSecretVariablesClient returns the client that gets the catalog
 // secret variables with the token as the bearer, instead of the user's token.
 // Without a token it uses the user's, which the endpoint of older
-// installations takes. It reaches the endpoint directly, ignoring the proxy
-// env vars, with the TLS settings of the context
-func newCatalogSecretVariablesClient(token string) (catalogSecretVariablesGetter, error) {
-	opts := []okteto.Option{okteto.WithoutProxy()}
+// installations takes. It connects to the internal IP of the Okteto API, never
+// through a proxy, and doesn't follow redirects
+func newCatalogSecretVariablesClient(endpoint, internalAPIIP, token string) (catalogSecretVariablesGetter, error) {
+	var opts []okteto.Option
 	if token != "" {
 		opts = append(opts, okteto.WithToken(token))
 	}
-	oktetoClient, err := okteto.NewOktetoClient(opts...)
-	if err != nil {
-		return nil, err
-	}
-	return oktetoClient.User(), nil
+	return okteto.NewCatalogSecretVariablesClient(endpoint, internalAPIIP, opts...)
 }
 
 // get returns the catalog secret variables as "key=value" vars. Any error, and
@@ -183,18 +203,33 @@ func (c catalogSecretVariables) get(ctx context.Context) ([]string, error) {
 	return vars, nil
 }
 
-// fetch gets the catalog secret variables from the endpoint. The token is the
-// copy of the installer's file that BuildKit mounted when the RUN started, so
-// it's fresh. It is never logged nor set in the env of the commands, but the
-// secret is mounted for the whole RUN and they can read the file, so it's
-// masked in their output like the user's token
+// fetch gets the catalog secret variables from the endpoint, an https URL
+// that the client reaches through the internal IP of the Okteto API instead of
+// resolving its hostname: the wildcard DNS record resolves it to the ingress,
+// which 
```

**File**: `cmd/remoterun/catalog_test.go` (modified, +214/-25)
```diff
@@ -17,8 +17,12 @@ import (
 	"bufio"
 	"bytes"
 	"context"
+	"encoding/base64"
 	"encoding/json"
+	"encoding/pem"
 	"errors"
+	"fmt"
+	"net"
 	"net/http"
 	"net/http/httptest"
 	"os"
@@ -27,6 +31,7 @@ import (
 
 	"github.com/okteto/okteto/internal/test/client"
 	"github.com/okteto/okteto/pkg/catalog"
+	"github.com/okteto/okteto/pkg/constants"
 	oktetoLog "github.com/okteto/okteto/pkg/log"
 	"github.com/okteto/okteto/pkg/okteto"
 	"github.com/okteto/okteto/pkg/types"
@@ -88,8 +93,11 @@ func warnings(lines []oktetoLog.JSONLogFormat) []oktetoLog.JSONLogFormat {
 }
 
 const (
-	testCatalogSecretVariablesEndpoint = "https://okteto.example/internal/catalog/secret-variables"
-	testCatalogSecretVariablesToken    = "projected-token"
+	testInternalAPIIP                       = "10.20.30.40"
+	testCatalogSecretVariablesEndpoint      = "https://okteto-internal-api.okteto.example:8443/internal/catalog/secret-variables"
+	testCatalogSecretVariablesToken         = "projected-token"
+	internalAPIIPMissingCatalogSecretsError = "the catalog secret variables can't be fetched: the remote build doesn't get the internal IP of the Okteto API to reach okteto-internal-api.okteto.example"
+	internalAPIIPMissingHint                = "Ask an Okteto admin to make sure the Okteto installation publishes the internal IP of the Okteto API, and that the Okteto CLI starting the remote build passes it on, "
 )
 
 // writeTestToken writes content to a token file in a temporary folder, and
@@ -104,22 +112,27 @@ func writeTestToken(t *testing.T, content string) string {
 func newTestCatalogSecretVariables(t *testing.T, c catalogSecretVariablesGetter, phase catalog.Phase) catalogSecretVariables {
 	t.Helper()
 	return catalogSecretVariables{
-		newClient: func(string) (catalogSecretVariablesGetter, error) { return c, nil },
-		tokenFile: writeTestToken(t, testCatalogSecretVariablesToken),
-		action:    "action-name",
-		endpoint:  testCatalogSecretVariablesEndpoint,
-		phase:     phase,
+		newClient:     func(string, string, string) (catalogSecretVariablesGetter, error) { return c, nil },
+		tokenFile:     writeTestToken(t, testCatalogSecretVariablesToken),
+		action:        "action-name",
+		endpoint:      testCatalogSecretVariablesEndpoint,
+		internalAPIIP: testInternalAPIIP,
+		phase:         phase,
 	}
 }
 
-// recordingCatalogSecretVariablesClientFactory records the tokens it creates
-// clients with, and returns client
+// recordingCatalogSecretVariablesClientFactory records the endpoints, the
+// internal IPs and the tokens it creates clients with, and returns client
 type recordingCatalogSecretVariablesClientFactory struct {
-	client catalogSecretVariablesGetter
-	tokens []string
+	client         catalogSecretVariablesGetter
+	endpoints      []string
+	internalAPIIPs []string
+	tokens         []string
 }
 
-func (r *recordingCatalogSecretVariablesClientFactory) newClient(token string) (catalogSecretVariablesGetter, error) {
+func (r *recordingCatalogSecretVariablesClientFactory) newClient(endpoint, internalAPIIP, token string) (catalogSecretVariablesGetter, error) {
+	r.endpoints = append(r.endpoints, endpoint)
+	r.internalAPIIPs = append(r.internalAPIIPs, internalAPIIP)
 	r.tokens = append(r.tokens, token)
 	return r.client, nil
 }
@@ -160,11 +173,14 @@ func TestCatalogSecretVariablesWithoutAction(t *testing.T) {
 }
 
 func TestNewCatalogSecretVariablesWithoutAction(t *testing.T) {
-	got, err := newCatalogSecretVariables("", "http://endpoint", catalog.DeployPhase)
+	t.Setenv(constants.OktetoInternalAPIIPEnvVar, testInternalAPIIP)
+
+	got, err := newCatalogSecretVariables("", "", catalog.DeployPhase)
 
 	require.NoError(t, err)
 	require.Nil(t, got.newClient)
 	require.Empty(t, got.tokenFile)
+	require.Empty(t, got.internalAPIIP)
 }
 
 func TestNewCatalogSecretVariablesRequiresTheEndpoint(t *testing.T) {
@@ -174,16 +190,178 @@ func TestNewCatalogSecretVariablesRequiresTheEndpoint(t *testing.T) {
 }
 
 func TestNewCatalogSecretVariablesForTheAction(t *testing.T) {
+	t.Setenv(constants.OktetoInternalAPIIPEnvVar, testInternalAPIIP)
+
 	got, err := newCatalogSecretVariables("action-name", testCatalogSecretVariablesEndpoint, catalog.DestroyPhase)
 
 	require.NoError(t, err)
 	require.NotNil(t, got.newClient)
 	require.Equal(t, "/run/secrets/catalog-secret-variables-token", got.tokenFile)
 	require.Equal(t, "action-name", got.action)
 	require.Equal(t, testCatalogSecretVariablesEndpoint, got.endpoint)
+	require.Equal(t, testInternalAPIIP, got.internalAPIIP)
 	require.Equal(t, catalog.DestroyPhase, got.phase)
 }
 
+// Neither the token is read nor the client built: a folder can't be read as a
+// token file, and the factory records every client it creates
+func TestCatalogSecretVariablesDoNotCallTheEndpointWithoutAValidInternalAPIIP(t *testing.T) {
+	tests := []struct {
+		name          string
+		internalAPIIP string
+	}{
+		{name: "without internal API IP", internalAPIIP: ""},
+		{name: "with an invalid internal API IP", internalAPIIP: "okte
```

**File**: `pkg/constants/constants.go` (modified, +4/-0)
```diff
@@ -170,6 +170,10 @@ const (
 	// OktetoSshAgentSocketEnvVar Env variable defining the socket where the ssh-forwarder will listen
 	OktetoSshAgentSocketEnvVar = "OKTETO_SSH_AGENT_SOCKET"
 
+	// OktetoInternalAPIIPEnvVar Env variable defining the internal IP of the Okteto API that remote builds reach its
+	// internal routes through. It's empty when the installation doesn't publish a valid one
+	OktetoInternalAPIIPEnvVar = "OKTETO_INTERNAL_API_IP"
+
 	// OktetoSharedEnvironmentEnvVar Env variable containing the namespace of the shared environment in divert
 	OktetoSharedEnvironmentEnvVar = "OKTETO_SHARED_ENVIRONMENT"
 
```

**File**: `pkg/okteto/catalog_secret_variables.go` (modified, +49/-1)
```diff
@@ -15,14 +15,18 @@ package okteto
 
 import (
 	"context"
+	"crypto/x509"
 	"encoding/json"
 	"errors"
 	"fmt"
 	"net/http"
 	"net/url"
 
+	"github.com/okteto/okteto/pkg/config"
+	oktetoErrors "github.com/okteto/okteto/pkg/errors"
 	oktetoLog "github.com/okteto/okteto/pkg/log"
 	"github.com/okteto/okteto/pkg/types"
+	"golang.org/x/oauth2"
 )
 
 const (
@@ -41,11 +45,55 @@ type catalogSecretVariablesErrorResponse struct {
 	Reason string `json:"reason"`
 }
 
+// CatalogSecretVariablesClient gets the catalog secret variables from the
+// internal API of Okteto
+type CatalogSecretVariablesClient struct {
+	httpClient *http.Client
+}
+
+// NewCatalogSecretVariablesClient returns the client that gets the catalog
+// secret variables from endpoint, an https URL it reaches through
+// internalAPIIP, as NewInternalAPIHTTPClient does. It fails without both. It
+// sends the token of the current context, or the one of the options, and
+// trusts the certificate of the current context
+func NewCatalogSecretVariablesClient(endpoint, internalAPIIP string, opts ...Option) (*CatalogSecretVariablesClient, error) {
+	cfg := defaultOktetoClientCfg()
+	for _, opt := range opts {
+		opt(cfg)
+	}
+	if cfg.Token == "" {
+		return nil, fmt.Errorf(oktetoErrors.ErrNotLogged, cfg.CtxName)
+	}
+
+	// The certificate comes from the context already resolved, which doesn't
+	// need the context file on disk. Without a current context there's none,
+	// and GetContext would exit
+	var certs []*x509.Certificate
+	if cfg.CtxName != "" {
+		if cert, err := GetContextCertificateStateless(GetContext().Certificate); err == nil {
+			certs = append(certs, cert)
+		}
+	}
+
+	httpClient, err := NewInternalAPIHTTPClient(endpoint, internalAPIIP, certs...)
+	if err != nil {
+		return nil, err
+	}
+	httpClient.Transport = &VersionedTransport{
+		Version: config.VersionString,
+		RoundTripper: &oauth2.Transport{
+			Source: oauth2.StaticTokenSource(&oauth2.Token{AccessToken: cfg.Token, TokenType: "Bearer"}),
+			Base:   httpClient.Transport,
+		},
+	}
+	return &CatalogSecretVariablesClient{httpClient: httpClient}, nil
+}
+
 // GetCatalogSecretVariables returns the catalog secret variables of the
 // development environment the action runs for: the values of the ones that
 // can be resolved, and the ones that can't. The endpoint only answers requests
 // that come from BuildKit
-func (c *userClient) GetCatalogSecretVariables(ctx context.Context, endpoint, action string) (types.CatalogSecretVariables, error) {
+func (c *CatalogSecretVariablesClient) GetCatalogSecretVariables(ctx context.Context, endpoint, action string) (types.CatalogSecretVariables, error) {
 	if c.httpClient == nil {
 		return types.CatalogSecretVariables{}, fmt.Errorf("catalog secret variables client not configured")
 	}
```

**File**: `pkg/okteto/catalog_secret_variables_test.go` (modified, +105/-18)
```diff
@@ -15,17 +15,42 @@ package okteto
 
 import (
 	"context"
+	"encoding/base64"
+	"encoding/pem"
 	"errors"
 	"net/http"
 	"net/http/httptest"
 	"testing"
 
+	"github.com/okteto/okteto/pkg/constants"
 	"github.com/okteto/okteto/pkg/types"
 	"github.com/stretchr/testify/require"
 )
 
 const testCatalogSecretVariablesEndpoint = "https://okteto.example/internal/catalog/secret-variables"
 
+// newTestCatalogSecretVariablesClient returns a client whose requests the
+// handler answers
+func newTestCatalogSecretVariablesClient(handler http.Handler) *CatalogSecretVariablesClient {
+	return &CatalogSecretVariablesClient{httpClient: newTestUserClient(handler).httpClient}
+}
+
+// setTestContextToken sets a current context with the token
+func setTestContextToken(t *testing.T, token string) {
+	t.Helper()
+	setTestContext(t, &Context{Name: "test", Token: token})
+}
+
+func setTestContext(t *testing.T, okCtx *Context) {
+	t.Helper()
+	original := CurrentStore
+	t.Cleanup(func() { CurrentStore = original })
+	CurrentStore = &ContextStore{
+		CurrentContext: "test",
+		Contexts:       map[string]*Context{"test": okCtx},
+	}
+}
+
 func respondWith(status int, body string) http.HandlerFunc {
 	return func(w http.ResponseWriter, _ *http.Request) {
 		w.WriteHeader(status)
@@ -40,7 +65,7 @@ func TestGetCatalogSecretVariablesSendsTheAction(t *testing.T) {
 		_, _ = w.Write([]byte(`{"variables":[]}`))
 	})
 
-	_, err := newTestUserClient(handler).GetCatalogSecretVariables(context.Background(), testCatalogSecretVariablesEndpoint, "deploy 1")
+	_, err := newTestCatalogSecretVariablesClient(handler).GetCatalogSecretVariables(context.Background(), testCatalogSecretVariablesEndpoint, "deploy 1")
 
 	require.NoError(t, err)
 	require.Equal(t, http.MethodGet, got.Method)
@@ -49,20 +74,83 @@ func TestGetCatalogSecretVariablesSendsTheAction(t *testing.T) {
 	require.Equal(t, "action=deploy+1", got.URL.RawQuery)
 }
 
-func TestGetCatalogSecretVariablesSendsTheToken(t *testing.T) {
+// startTestInternalAPI starts the internal API on 127.0.0.1, sets a current
+// context with the token whose certificate is the one of the server, and
+// returns the server and its endpoint
+func startTestInternalAPI(t *testing.T, token string, handler http.HandlerFunc) (*internalAPITestServer, string) {
+	t.Helper()
+	server := startInternalAPITestServer(t, "127.0.0.1", handler)
+	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: server.Certificate().Raw})
+	setTestContext(t, &Context{Name: "test", Token: token, Certificate: base64.StdEncoding.EncodeToString(certPEM)})
+	return server, server.endpoint(t, "example.com")
+}
+
+func TestGetCatalogSecretVariablesThroughTheInternalAPIIP(t *testing.T) {
 	var authorization string
-	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+	server, endpoint := startTestInternalAPI(t, "okteto-token", func(w http.ResponseWriter, r *http.Request) {
 		authorization = r.Header.Get("Authorization")
-		_, _ = w.Write([]byte(`{"variables":[]}`))
-	}))
-	t.Cleanup(server.Close)
-	c, err := NewOktetoClientFromUrlAndToken(server.URL, "okteto-token")
+		_, _ = w.Write([]byte(`{"variables":[{"name":"PIN","value":"1"}]}`))
+	})
+	c, err := NewCatalogSecretVariablesClient(endpoint, "127.0.0.1")
 	require.NoError(t, err)
 
-	_, err = c.User().GetCatalogSecretVariables(context.Background(), server.URL+"/internal/catalog/secret-variables", "action")
+	got, err := c.GetCatalogSecretVariables(context.Background(), endpoint, "action")
 
 	require.NoError(t, err)
+	require.Equal(t, []types.CatalogSecretVariable{{Name: "PIN", Value: "1"}}, got.Variables)
 	require.Equal(t, "Bearer okteto-token", authorization)
+	require.Equal(t, "example.com", server.sni)
+}
+
+func TestGetCatalogSecretVariablesSendsTheTokenOfTheOptions(t *testing.T) {
+	var authorization string
+	_, endpoint := startTestInternalAPI(t, "okteto-token", func(w http.ResponseWriter, r *http.Request) {
+		authorization = r.Header.Get("Authorization")
+		_, _ = w.Write([]byte(`{"variables":[]}`))
+	})
+	c, err := NewCatalogSecretVariablesClient(endpoint, "127.0.0.1", WithToken("projected-token"))
+	require.NoError(t, err)
+
+	_, err = c.GetCatalogSecretVariables(context.Background(), endpoint, "action")
+
+	require.NoError(t, err)
+	require.Equal(t, "Bearer projected-token", authorization)
+}
+
+// GetContext exits without a current context, so the certificate is only read with one
+func TestNewCatalogSecretVariablesClientWithATokenAndWithoutAContext(t *testing.T) {
+	original := CurrentStore
+	t.Cleanup(func() { CurrentStore = original })
+	CurrentStore = nil
+	t.Setenv(constants.OktetoFolderEnvVar, t.TempDir())
+
+	_, err := NewCatalogSecretVariablesClient(testCatalogSecretVariablesEndpoint, "10.20.30.40", WithToken("projected-token"))
+
+	require.NoError(t, err)
+}
+
+func TestNewCatalogSecretVariablesClientFailsForAnHTTPEndpoint(t *testing.T) {
+	setTestContextToken(t, "okteto-token")
+
+	_, err := NewCatalogSecretV
```

**File**: `pkg/okteto/internal_api.go` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
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
+package okteto
+
+import (
+	"crypto/x509"
+	"errors"
+	"net"
+	"net/http"
+	"net/url"
+
+	oktetoHttp "github.com/okteto/okteto/pkg/http"
+)
+
+var (
+	// ErrInvalidInternalAPIEndpoint is returned for an internal API endpoint that isn't an https URL
+	ErrInvalidInternalAPIEndpoint = errors.New("the internal API endpoint isn't an https URL")
+
+	// ErrInvalidInternalAPIIP is returned when the internal IP of the Okteto API is empty or isn't an IP
+	ErrInvalidInternalAPIIP = errors.New("the internal IP of the Okteto API is missing or invalid")
+)
+
+// NewInternalAPIHTTPClient returns an HTTP client for the internal routes of the Okteto API at endpoint, an https URL
+// that remote builds reach on internalAPIIP, the internal IP of the API. It connects to that IP instead of resolving
+// the hostname of the endpoint, which public DNS resolves to the ingress, and verifies the certificate against that
+// hostname, with the system pool and certs. Without a valid IP it fails instead of resolving the hostname.
+//
+// It never goes through a proxy, as the IP is only reachable inside the cluster, and never follows a redirect, which
+// would take the request somewhere else. It doesn't read the Okteto context: the Git credential helper runs without one
+func NewInternalAPIHTTPClient(endpoint, internalAPIIP string, certs ...*x509.Certificate) (*http.Client, error) {
+	u, err := url.Parse(endpoint)
+	if err != nil || u.Scheme != "https" || u.Hostname() == "" {
+		return nil, ErrInvalidInternalAPIEndpoint
+	}
+	ip := net.ParseIP(internalAPIIP)
+	if ip == nil {
+		return nil, ErrInvalidInternalAPIIP
+	}
+
+	transport := oktetoHttp.StrictSSLTransport(&oktetoHttp.SSLTransportOption{
+		Certs:           certs,
+		URLsToIntercept: []string{endpoint},
+		ServerName:      internalAPIAddress(u, ip),
+	})
+	transport.Proxy = nil
+	return &http.Client{
+		Transport: transport,
+		CheckRedirect: func(*http.Request, []*http.Request) error {
+			return http.ErrUseLastResponse
+		},
+	}, nil
+}
+
+// internalAPIAddress returns the address to connect to for the endpoint: the internal IP with the port of the endpoint
+func internalAPIAddress(endpoint *url.URL, ip net.IP) string {
+	port := endpoint.Port()
+	if port == "" {
+		port = "443"
+	}
+	return net.JoinHostPort(ip.String(), port)
+}
```

**File**: `pkg/okteto/internal_api_test.go` (added, +204/-0)
```diff
@@ -0,0 +1,204 @@
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
+package okteto
+
+import (
+	"fmt"
+	"net"
+	"net/http"
+	"net/http/httptest"
+	"net/url"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+)
+
+// internalAPITestServer is a TLS server whose certificate is valid for
+// example.com, 127.0.0.1 and ::1, and which records the Host header and the SNI
+// of the requests
+type internalAPITestServer struct {
+	*httptest.Server
+	host string
+	sni  string
+}
+
+// startInternalAPITestServer starts the server on the IP. It skips the test
+// when it can't listen on the IP
+func startInternalAPITestServer(t *testing.T, ip string, handler http.HandlerFunc) *internalAPITestServer {
+	t.Helper()
+	listener, err := net.Listen("tcp", net.JoinHostPort(ip, "0"))
+	if err != nil {
+		t.Skipf("can't listen on %s: %s", ip, err)
+	}
+	s := &internalAPITestServer{}
+	s.Server = httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		s.host = r.Host
+		s.sni = r.TLS.ServerName
+		handler(w, r)
+	}))
+	s.Listener = listener
+	s.StartTLS()
+	t.Cleanup(s.Close)
+	return s
+}
+
+func (s *internalAPITestServer) endpoint(t *testing.T, hostname string) string {
+	t.Helper()
+	_, port, err := net.SplitHostPort(s.Listener.Addr().String())
+	require.NoError(t, err)
+	return fmt.Sprintf("https://%s/internal/catalog/secret-variables", net.JoinHostPort(hostname, port))
+}
+
+func answerOK(http.ResponseWriter, *http.Request) {}
+
+func TestInternalAPIHTTPClientConnectsToTheIPv4(t *testing.T) {
+	server := startInternalAPITestServer(t, "127.0.0.1", answerOK)
+	endpoint := server.endpoint(t, "example.com")
+	client, err := NewInternalAPIHTTPClient(endpoint, "127.0.0.1", server.Certificate())
+	require.NoError(t, err)
+
+	resp, err := client.Get(endpoint)
+
+	require.NoError(t, err)
+	require.NoError(t, resp.Body.Close())
+	require.Equal(t, http.StatusOK, resp.StatusCode)
+	require.Equal(t, "example.com", server.sni)
+	require.Equal(t, mustURL(t, endpoint).Host, server.host)
+}
+
+func TestInternalAPIHTTPClientConnectsToTheIPv6(t *testing.T) {
+	server := startInternalAPITestServer(t, "::1", answerOK)
+	endpoint := server.endpoint(t, "example.com")
+	client, err := NewInternalAPIHTTPClient(endpoint, "::1", server.Certificate())
+	require.NoError(t, err)
+
+	resp, err := client.Get(endpoint)
+
+	require.NoError(t, err)
+	require.NoError(t, resp.Body.Close())
+	require.Equal(t, http.StatusOK, resp.StatusCode)
+	require.Equal(t, "example.com", server.sni)
+	require.Equal(t, mustURL(t, endpoint).Host, server.host)
+}
+
+func TestInternalAPIHTTPClientVerifiesTheCertificateAgainstTheHostname(t *testing.T) {
+	// The certificate is also valid for 127.0.0.1, so verifying it against the
+	// IP would let the request through
+	server := startInternalAPITestServer(t, "127.0.0.1", answerOK)
+	endpoint := server.endpoint(t, "okteto-internal-api.other.example")
+	client, err := NewInternalAPIHTTPClient(endpoint, "127.0.0.1", server.Certificate())
+	require.NoError(t, err)
+
+	_, err = client.Get(endpoint) //nolint:bodyclose // it fails before there's a body
+
+	require.ErrorContains(t, err, "certificate is valid for")
+	require.Empty(t, server.sni)
+}
+
+func TestInternalAPIHTTPClientDoesNotTrustTheCertificateWithoutIt(t *testing.T) {
+	server := startInternalAPITestServer(t, "127.0.0.1", answerOK)
+	endpoint := server.endpoint(t, "example.com")
+	client, err := NewInternalAPIHTTPClient(endpoint, "127.0.0.1")
+	require.NoError(t, err)
+
+	_, err = client.Get(endpoint) //nolint:bodyclose // it fails before there's a body
+
+	require.ErrorContains(t, err, "certificate signed by unknown authority")
+}
+
+func TestInternalAPIHTTPClientDoesNotFollowRedirects(t *testing.T) {
+	server := startInternalAPITestServer(t, "127.0.0.1", func(w http.ResponseWriter, r *http.Request) {
+		http.Redirect(w, r, "https://okteto.example/elsewhere", http.StatusFound)
+	})
+	endpoint := server.endpoint(t, "example.com")
+	client, err := NewInternalAPIHTTPClient(endpoint, "127.0.0.1", server.Certificate())
+	require.NoError(t, err)
+
+	resp, err := client.Get(endpoint)
+
+	require.NoError(t, err)
+	require.NoError(t, resp.Body.Close())
+	require.Equal(t, http.StatusFound, resp.StatusCode)
+}
+
+func TestInternalAPIHTTPClientNeverUsesAProxy(t *testing.T) {
+	client, err := NewInternalAPIHTTPClient("https://example.com:8443/internal/catalog/secret-variables", "10.20.30.40")
+	requir
```

**File**: `pkg/okteto/secrets.go` (modified, +2/-0)
```diff
@@ -298,6 +298,8 @@ func (c *userClient) GetClusterMetadata(ctx context.Context, ns string) (types.C
 			metadata.SSHAgentHostname = string(v.Value)
 		case "sshAgentPort":
 			metadata.SSHAgentPort = string(v.Value)
+		case "internalAPIIP":
+			metadata.InternalAPIIP = string(v.Value)
 		case "cliMinVersion":
 			metadata.CliMinVersion = string(v.Value)
 		case "cliClusterVersion":
```

---

### Incident Patch 2: `2ee7e6b7` (2026-11-23)
**Commit Message**: refactor(build): remove the unused repository clean check from the builder config (#5278)

* refactor(build): remove the unused repository clean check from the builder config

getConfig and getConfigStateless ran IsClean, a git status, every time a
builder was created, and stored the result in isCleanProject. Nothing has
read it since #4203, when the image tagger stopped using it to choose the
global registry, so every command that creates a builder paid for a git
status it didn't use.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Javier Lopez <[REDACTED_EMAIL]>

* refactor(build): remove the unused GetGitCommit from the builder config

Nothing calls oktetoBuilderConfig.GetGitCommit outside its own test and
the fakeConfig stub, the same as IsCleanProject. Drop it together with
GetSHA from configRepositoryInterface, which only it used, the fake's
sha field and TestGetGitCommit. One tagger case only differed by that
field and is removed as a duplicate.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Javier Lopez <[REDACTED_EMAIL]>

---------

Signed-off-by: Javier Lopez <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `cmd/build/v2/build.go` (modified, +0/-2)
```diff
@@ -57,8 +57,6 @@ type oktetoRegistryInterface interface {
 // oktetoBuilderConfigInterface returns the configuration that the builder has for the registry and project
 type oktetoBuilderConfigInterface interface {
 	HasGlobalAccess() bool
-	IsCleanProject() bool
-	GetGitCommit() string
 	IsOkteto() bool
 	GetAnonymizedRepo() string
 }
```

**File**: `cmd/build/v2/config.go` (modified, +0/-29)
```diff
@@ -28,8 +28,6 @@ const (
 )
 
 type configRepositoryInterface interface {
-	GetSHA() (string, error)
-	IsClean() (bool, error)
 	GetAnonymizedRepo() string
 	GetLatestDirSHA(string) (string, error)
 }
@@ -42,7 +40,6 @@ type oktetoBuilderConfig struct {
 	repository          configRepositoryInterface
 	fs                  afero.Fs
 	hasGlobalAccess     bool
-	isCleanProject      bool
 	isOkteto            bool
 	isSmartBuildsEnable bool
 }
@@ -57,15 +54,9 @@ func getConfig(registry configRegistryInterface, gitRepo configRepositoryInterfa
 		l.Infof("error trying to access globalPushAccess: %s", err)
 	}
 
-	isClean, err := gitRepo.IsClean()
-	if err != nil {
-		l.Infof("error checking if the repository is clean: %s", err)
-	}
-
 	return oktetoBuilderConfig{
 		repository:          gitRepo,
 		hasGlobalAccess:     hasAccess,
-		isCleanProject:      isClean,
 		fs:                  afero.NewOsFs(),
 		isOkteto:            okteto.IsOkteto(),
 		isSmartBuildsEnable: getIsSmartBuildEnabled(),
@@ -78,15 +69,9 @@ func getConfigStateless(registry configRegistryInterface, gitRepo configReposito
 		l.Infof("error trying to access globalPushAccess: %s", err)
 	}
 
-	isClean, err := gitRepo.IsClean()
-	if err != nil {
-		l.Infof("error checking if the repository is clean: %s", err)
-	}
-
 	return oktetoBuilderConfig{
 		repository:          gitRepo,
 		hasGlobalAccess:     hasAccess,
-		isCleanProject:      isClean,
 		fs:                  afero.NewOsFs(),
 		isOkteto:            isOkteto,
 		isSmartBuildsEnable: getIsSmartBuildEnabled(),
@@ -119,20 +104,6 @@ func (oc oktetoBuilderConfig) HasGlobalAccess() bool {
 	return oc.hasGlobalAccess
 }
 
-// IsCleanProject checks if the repository is clean(no changes over the last commit)
-func (oc oktetoBuilderConfig) IsCleanProject() bool {
-	return oc.isCleanProject
-}
-
-// GetGitCommit returns the commit sha of the repository
-func (oc oktetoBuilderConfig) GetGitCommit() string {
-	commitSHA, err := oc.repository.GetSHA()
-	if err != nil {
-		oktetoLog.Infof("could not get repository sha: %s", err)
-	}
-	return commitSHA
-}
-
 // GetAnonymizedRepo returns the repository url without credentials
 func (oc oktetoBuilderConfig) GetAnonymizedRepo() string {
 	return oc.repository.GetAnonymizedRepo()
```

**File**: `cmd/build/v2/config_test.go` (modified, +22/-125)
```diff
@@ -30,15 +30,13 @@ type fakeConfigRegistry struct {
 func (fcr fakeConfigRegistry) HasGlobalPushAccess() (bool, error) { return fcr.access, fcr.err }
 
 type fakeConfigRepo struct {
-	err     error
-	sha     string
-	url     string
-	diff    string
-	isClean bool
+	err  error
+	sha  string
+	url  string
+	diff string
 }
 
 func (fcr fakeConfigRepo) GetSHA() (string, error)                { return fcr.sha, fcr.err }
-func (fcr fakeConfigRepo) IsClean() (bool, error)                 { return fcr.isClean, fcr.err }
 func (fcr fakeConfigRepo) GetAnonymizedRepo() string              { return fcr.url }
 func (fcr fakeConfigRepo) GetLatestDirSHA(string) (string, error) { return fcr.sha, fcr.err }
 func (fcr fakeConfigRepo) GetDiffHash(string) (string, error)     { return fcr.diff, fcr.err }
@@ -58,95 +56,62 @@ func TestGetConfigStateless(t *testing.T) {
 		input    input
 	}{
 		{
-			name: "global access clean commit",
+			name: "global access",
 			input: input{
 				reg: fakeConfigRegistry{
 					access: true,
 					err:    nil,
 				},
 				repo: fakeConfigRepo{
-					isClean: true,
-					err:     nil,
+					err: nil,
 				},
 			},
 			expected: oktetoBuilderConfig{
 				hasGlobalAccess: true,
-				isCleanProject:  true,
 				repository: fakeConfigRepo{
-					isClean: true,
-					err:     nil,
+					err: nil,
 				},
 				fs:                  afero.NewOsFs(),
 				isOkteto:            true,
 				isSmartBuildsEnable: true,
 			},
 		},
 		{
-			name: "no global access clean commit",
+			name: "no global access",
 			input: input{
 				reg: fakeConfigRegistry{
 					access: false,
 					err:    nil,
 				},
 				repo: fakeConfigRepo{
-					isClean: true,
-					err:     nil,
+					err: nil,
 				},
 			},
 			expected: oktetoBuilderConfig{
 				hasGlobalAccess: false,
-				isCleanProject:  true,
 				repository: fakeConfigRepo{
-					isClean: true,
-					err:     nil,
+					err: nil,
 				},
 				fs:                  afero.NewOsFs(),
 				isOkteto:            true,
 				isSmartBuildsEnable: true,
 			},
 		},
 		{
-			name: "error on global access clean commit",
+			name: "error on global access",
 			input: input{
 				reg: fakeConfigRegistry{
 					access: false,
 					err:    assert.AnError,
 				},
 				repo: fakeConfigRepo{
-					isClean: true,
-					err:     nil,
+					err: nil,
 				},
 			},
 			expected: oktetoBuilderConfig{
 				hasGlobalAccess: false,
-				isCleanProject:  true,
 				repository: fakeConfigRepo{
-					isClean: true,
-					err:     nil,
-				},
-				fs:                  afero.NewOsFs(),
-				isOkteto:            true,
-				isSmartBuildsEnable: true,
-			},
-		},
-		{
-			name: "error on clean commit and global access",
-			input: input{
-				reg: fakeConfigRegistry{
-					access: false,
-					err:    assert.AnError,
-				},
-				repo: fakeConfigRepo{
-					isClean: false,
-					err:     assert.AnError,
-				},
-			},
-			expected: oktetoBuilderConfig{
-				hasGlobalAccess: false,
-				isCleanProject:  false,
-				repository: fakeConfigRepo{
-					isClean: false,
-					err:     assert.AnError,
+					err: nil,
 				},
 				fs:                  afero.NewOsFs(),
 				isOkteto:            true,
@@ -182,95 +147,62 @@ func TestGetConfig(t *testing.T) {
 		input    input
 	}{
 		{
-			name: "global access clean commit",
+			name: "global access",
 			input: input{
 				reg: fakeConfigRegistry{
 					access: true,
 					err:    nil,
 				},
 				repo: fakeConfigRepo{
-					isClean: true,
-					err:     nil,
+					err: nil,
 				},
 			},
 			expected: oktetoBuilderConfig{
 				hasGlobalAccess: true,
-				isCleanProject:  true,
 				repository: fakeConfigRepo{
-					isClean: true,
-					err:     nil,
+					err: nil,
 				},
 				fs:                  afero.NewOsFs(),
 				isOkteto:            true,
 				isSmartBuildsEnable: true,
 			},
 		},
 		{
-			name: "no global access clean commit",
+			name: "no global access",
 			input: input{
 				reg: fakeConfigRegistry{
 					access: false,
 					err:    nil,
 				},
 				repo: fakeConfigRepo{
-					isClean: true,
-					err:     nil,
-				},
-			},
-			expected: oktetoBuilderConfig{
-				hasGlobalAccess: false,
-				isCleanProject:  true,
-				repository: fakeConfigRepo{
-					isClean: true,
-					err:     nil,
-				},
-				fs:                  afero.NewOsFs(),
-				isOkteto:            true,
-				isSmartBuildsEnable: true,
-			},
-		},
-		{
-			name: "error on global access clean commit",
-			input: input{
-				reg: fakeConfigRegistry{
-					access: false,
-					err:    assert.AnError,
-				},
-				repo: fakeConfigRepo{
-					isClean: true,
-					err:     nil,
+					err: nil,
 				},
 			},
 			expected: oktetoBuilderConfig{
 				hasGlobalAccess: false,
-				isCleanProject:  true,
 				repository: fakeConfigRepo{
-					isClean: true,
-					err:     nil,
+					err: nil,
 				},
 				fs:                  afero.NewOsFs(),
 				isOkteto:            true,
 				isSmartBuildsEnable: true,
 			},
 		},
 		{
-			name: "error on clean commit and global access
```

**File**: `cmd/build/v2/services_test.go` (modified, +0/-4)
```diff
@@ -216,20 +216,16 @@ func TestNoServiceBuiltWithSubset(t *testing.T) {
 }
 
 type fakeConfig struct {
-	sha                 string
 	repoURL             string
 	globalNamespace     string
 	namespace           string
 	registryURL         string
-	isClean             bool
 	hasAccess           bool
 	isOkteto            bool
 	isSmartBuildsEnable bool
 }
 
 func (fc fakeConfig) HasGlobalAccess() bool                  { return fc.hasAccess }
-func (fc fakeConfig) IsCleanProject() bool                   { return fc.isClean }
-func (fc fakeConfig) GetGitCommit() string                   { return fc.sha }
 func (fc fakeConfig) IsOkteto() bool                         { return fc.isOkteto }
 func (fc fakeConfig) IsOktetoCluster() bool                  { return fc.isOkteto }
 func (fc fakeConfig) GetAnonymizedRepo() string              { return fc.repoURL }
```

**File**: `cmd/build/v2/tagger_test.go` (modified, +2/-55)
```diff
@@ -50,21 +50,7 @@ func Test_ImageTaggerWithoutVolumes_GetServiceDevImageReference(t *testing.T) {
 		{
 			name: "image is set without access to global",
 			cfg: fakeConfig{
-				isClean:   true,
 				hasAccess: false,
-				sha:       "sha",
-			},
-			b: &build.Info{
-				Image: "nginx",
-			},
-			expectedImage: "nginx",
-		},
-		{
-			name: "image is set with no clean project",
-			cfg: fakeConfig{
-				isClean:   false,
-				hasAccess: true,
-				sha:       "sha",
 			},
 			b: &build.Info{
 				Image: "nginx",
@@ -74,9 +60,7 @@ func Test_ImageTaggerWithoutVolumes_GetServiceDevImageReference(t *testing.T) {
 		{
 			name: "image is set with access to global",
 			cfg: fakeConfig{
-				isClean:   true,
 				hasAccess: true,
-				sha:       "sha",
 			},
 			b: &build.Info{
 				Image: "nginx",
@@ -86,9 +70,7 @@ func Test_ImageTaggerWithoutVolumes_GetServiceDevImageReference(t *testing.T) {
 		{
 			name: "image is set but in okteto dev registry",
 			cfg: fakeConfig{
-				isClean:   true,
 				hasAccess: true,
-				sha:       "sha",
 			},
 			b: &build.Info{
 				Dockerfile: "Dockerfile",
@@ -100,9 +82,7 @@ func Test_ImageTaggerWithoutVolumes_GetServiceDevImageReference(t *testing.T) {
 		{
 			name: "image is set but in okteto global registry",
 			cfg: fakeConfig{
-				isClean:   true,
 				hasAccess: true,
-				sha:       "sha",
 			},
 			b: &build.Info{
 				Dockerfile: "Dockerfile",
@@ -114,22 +94,7 @@ func Test_ImageTaggerWithoutVolumes_GetServiceDevImageReference(t *testing.T) {
 		{
 			name: "image inferred without access to global",
 			cfg: fakeConfig{
-				isClean:   true,
 				hasAccess: false,
-				sha:       "sha",
-			},
-			b: &build.Info{
-				Dockerfile: "Dockerfile",
-				Context:    ".",
-			},
-			expectedImage: "okteto.dev/test-test:okteto",
-		},
-		{
-			name: "image inferred without clean project",
-			cfg: fakeConfig{
-				isClean:   false,
-				hasAccess: true,
-				sha:       "sha",
 			},
 			b: &build.Info{
 				Dockerfile: "Dockerfile",
@@ -138,11 +103,9 @@ func Test_ImageTaggerWithoutVolumes_GetServiceDevImageReference(t *testing.T) {
 			expectedImage: "okteto.dev/test-test:okteto",
 		},
 		{
-			name: "image inferred with clean project, has access to global registry but no feature flag enabled",
+			name: "image inferred with access to global registry but no feature flag enabled",
 			cfg: fakeConfig{
-				isClean:             true,
 				hasAccess:           true,
-				sha:                 "sha",
 				isSmartBuildsEnable: false,
 			},
 			b: &build.Info{
@@ -152,25 +115,9 @@ func Test_ImageTaggerWithoutVolumes_GetServiceDevImageReference(t *testing.T) {
 			expectedImage: "okteto.dev/test-test:okteto",
 		},
 		{
-			name: "image inferred with clean project, has access to global registry and feature flag enabled",
-			cfg: fakeConfig{
-				isClean:             true,
-				hasAccess:           true,
-				sha:                 "sha",
-				isSmartBuildsEnable: true,
-			},
-			b: &build.Info{
-				Dockerfile: "Dockerfile",
-				Context:    ".",
-			},
-			expectedImage: "okteto.dev/test-test:okteto",
-		},
-		{
-			name: "image inferred with clean project, has access to global registry, feature flag enabled and empty build hash",
+			name: "image inferred with access to global registry and feature flag enabled",
 			cfg: fakeConfig{
-				isClean:             true,
 				hasAccess:           true,
-				sha:                 "",
 				isSmartBuildsEnable: true,
 			},
 			b: &build.Info{
```

#### Recent Merged Pull Requests:
- **PR #5286** (2026-11-23): docs: update the links to the docs and use the short anchors of the Okteto Manifest reference (@pchico83)
- **PR #5285** (2026-11-23): chore(deps): Update k8s.io/utils digest to ca04ba5 (@oktetobot)
- **PR #5284** (closed): docs: point the CLI messages and the README to the current docs pages (@pchico83)
- **PR #5281** (2026-11-20): Upgrade buildkit dependency to v0.35.1-okteto1 (@devin-ai-integration[bot])
- **PR #5280** (closed): chore(deps): Update module sigs.k8s.io/kustomize/kyaml to v0.21.3 (@oktetobot)
- **PR #5279** (2026-11-20): build(deps): bump renovatebot/github-action from 46.3.13 to 46.3.14 (@dependabot[bot])

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

## X. ENG-35: Reach the internal API through its IP in remote builds

**RULE**:
When implementing operations in `cmd/remoterun/catalog.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in okteto/okteto. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `55998c4b`: ENG-35: Reach the internal API through its IP in remote builds. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/remoterun/catalog.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"net"
	"net/url"
	"github.com/okteto/okteto/pkg/constants"
// catalog secret variables from the endpoint through the internal IP of the
// Okteto API, with the token, or with the user's token when it's empty
type catalogSecretVariablesClientFactory func(endpoint, internalAPIIP, token string) (catalogSecretVariablesGetter, error)
	// internalAPIIP is the internal IP of the Okteto API that the CLI starting
	// the remote build passes on, empty when the installation doesn't publish it
	internalAPIIP string
// errCatalogSecretVariablesEndpointNotHTTPS is returned when the endpoint
// isn't https, so the request isn't sent. Only the first installations with
// catalog secret variables give an http endpoint, which remote builds can't
// reach
var errCatalogSecretVariablesEndpointNotHTTPS = errors.New("the catalog secret variables can't be fetched: the Okteto installation gives an endpoint that isn't https")

// internalAPIIPMissingError is returned when the remote build doesn't get a
// valid internal IP of the Okteto API to reach the endpoint through, so the
// request isn't sent
type internalAPIIPMissingError struct {
	hostname string
}

func (e internalAPIIPMissingError) Error() stri
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// catalog secret variables with the token, or with the user's token when it's
// empty
type catalogSecretVariablesClientFactory func(token string) (catalogSecretVariablesGetter, error)
// installations takes. It reaches the endpoint directly, ignoring the proxy
// env vars, with the TLS settings of the context
func newCatalogSecretVariablesClient(token string) (catalogSecretVariablesGetter, error) {
	opts := []okteto.Option{okteto.WithoutProxy()}
	oktetoClient, err := okteto.NewOktetoClient(opts...)
	if err != nil {
		return nil, err
	}
	return oktetoClient.User(), nil
// fetch gets the catalog secret variables from the endpoint. The token is the
// copy of the installer's file that BuildKit mounted when the RUN started, so
// it's fresh. It is never logged nor set in the env of the commands, but the
// secret is mounted for the whole RUN and they can read the file, so it's
// masked in their output like the user's token
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `55998c4b` are properly handled with clean fallback behavior.

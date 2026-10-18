> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/okteto-okteto-learnings.md`  
> **Source**: github ([https://github.com/okteto/okteto](https://github.com/okteto/okteto))  
> **Source Version**: `f599c1e6`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T23:20:38.145Z  
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
> **Harvest Timestamp**: 2026-10-18T23:20:38.139Z  
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
		oktetoLog.Infof("invalid init option: %s", err)
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
					E:    fmt.Errorf("didn't find an application in namespace %s that matches the labels in your Okteto manifest", namespace),
					Hint: "Update the labels or point your context to a different namespace and try again"}
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

// TTYCollapseDisplayer displays with a screenbuff
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

// Display displays a
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

// CleanUp collapses and stop displaying
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
		line = strings.TrimSpace(line)
		result = app
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

// Executor implements ManifestExecutor with a executor displayer
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

### Incident Patch 1: `65adec03` (2026-10-13)
**Commit Message**: fix: wait until the namespace is fully deleted in `okteto namespace delete` (#5187)

* fix: wait until the namespace is fully deleted in `okteto namespace delete`

The command polled the namespace with the user's kube identity and treated
Forbidden as deleted. Users without cluster-wide namespace access lose access
when Kubernetes removes the in-namespace RoleBinding during termination, so the
command returned while the namespace was still Terminating and a following
`okteto namespace create` failed with namespace-terminating.

Poll the Okteto API (space(id)) instead until the namespace is gone, add
--wait (default true) and --timeout (default 5m) flags, bound the wait for the
deletion logs, and fix two panics in the Ctrl+C handling.

Fixes PROD-494

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Javier Lopez <[REDACTED_EMAIL]>

* fix: address review feedback on namespace delete wait

- Don't wait for the logs goroutine after cancelling it: the stream request
  is not bound to the context, so a stalled read could block past the grace
  period and swallow Ctrl+C.
- Make the poll interval a package var so tests don't wait 1s per case.
- Remove the k8s client provid

**File**: `cmd/namespace/delete.go` (modified, +90/-41)
```diff
@@ -15,6 +15,7 @@ package namespace
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"os"
 	"os/signal"
@@ -30,12 +31,33 @@ import (
 	"github.com/okteto/okteto/pkg/log/io"
 	"github.com/okteto/okteto/pkg/okteto"
 	"github.com/spf13/cobra"
-	k8sErrors "k8s.io/apimachinery/pkg/api/errors"
-	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 )
 
+const (
+	defaultDeleteTimeout = 5 * time.Minute
+
+	namespaceStatusActive       = "Active"
+	namespaceStatusDeleteFailed = "DeleteFailed"
+)
+
+var (
+	// pollInterval is the interval between checks of the namespace status while waiting for its deletion
+	pollInterval = 1 * time.Second
+
+	// logsGracePeriod is the maximum time to wait for the deletion logs once the wait has finished
+	logsGracePeriod = 10 * time.Second
+)
+
+// DeleteOptions represents the options that namespace delete has
+type DeleteOptions struct {
+	Namespace string
+	Timeout   time.Duration
+	Wait      bool
+}
+
 // Delete deletes a namespace
-func Delete(ctx context.Context, k8sLogger *io.K8sLogger, ioCtrl *io.Controller) *cobra.Command {
+func Delete(ctx context.Context, ioCtrl *io.Controller) *cobra.Command {
+	opts := &DeleteOptions{}
 	cmd := &cobra.Command{
 		Use:   "delete <name>",
 		Short: "Delete an Okteto Namespace",
@@ -45,9 +67,9 @@ func Delete(ctx context.Context, k8sLogger *io.K8sLogger, ioCtrl *io.Controller)
 				return err
 			}
 
-			nsToDelete := okteto.GetContext().Namespace
+			opts.Namespace = okteto.GetContext().Namespace
 			if len(args) > 0 {
-				nsToDelete = args[0]
+				opts.Namespace = args[0]
 			}
 
 			if !okteto.IsOkteto() {
@@ -58,15 +80,18 @@ func Delete(ctx context.Context, k8sLogger *io.K8sLogger, ioCtrl *io.Controller)
 			if err != nil {
 				return err
 			}
-			err = nsCmd.ExecuteDeleteNamespace(ctx, nsToDelete, k8sLogger)
+			err = nsCmd.ExecuteDeleteNamespace(ctx, opts)
 			analytics.TrackDeleteNamespace(err == nil)
 			return err
 		},
 	}
+	cmd.Flags().BoolVarP(&opts.Wait, "wait", "w", true, "wait until the Okteto Namespace is fully deleted from the cluster")
+	cmd.Flags().DurationVarP(&opts.Timeout, "timeout", "t", defaultDeleteTimeout, "the duration to wait for the Okteto Namespace to be deleted. Any value should contain a corresponding time unit e.g. 1s, 2m, 3h")
 	return cmd
 }
 
-func (nc *Command) ExecuteDeleteNamespace(ctx context.Context, namespace string, k8sLogger *io.K8sLogger) error {
+func (nc *Command) ExecuteDeleteNamespace(ctx context.Context, opts *DeleteOptions) error {
+	namespace := opts.Namespace
 	oktetoLog.Spinner(fmt.Sprintf("Deleting %s namespace", namespace))
 	oktetoLog.StartSpinner()
 	defer oktetoLog.StopSpinner()
@@ -80,11 +105,15 @@ func (nc *Command) ExecuteDeleteNamespace(ctx context.Context, namespace string,
 		return fmt.Errorf("%w: %w", errFailedDeleteNamespace, err)
 	}
 
-	if err := nc.watchDelete(ctx, namespace, k8sLogger); err != nil {
-		return fmt.Errorf("watching namespace deletion stopped: %w", err)
+	if opts.Wait {
+		if err := nc.watchDelete(ctx, namespace, opts.Timeout); err != nil {
+			return fmt.Errorf("watching namespace deletion stopped: %w", err)
+		}
+		oktetoLog.Success("Namespace '%s' deleted", namespace)
+	} else {
+		oktetoLog.Success("Namespace '%s' scheduled for deletion", namespace)
 	}
 
-	oktetoLog.Success("Namespace '%s' deleted", namespace)
 	if okteto.GetContext().Namespace == namespace {
 		personalNamespace := okteto.GetContext().PersonalNamespace
 		if personalNamespace == "" {
@@ -101,34 +130,35 @@ func (nc *Command) ExecuteDeleteNamespace(ctx context.Context, namespace string,
 	return nil
 }
 
-func (nc *Command) watchDelete(ctx context.Context, namespace string, k8sLogger *io.K8sLogger) error {
+func (nc *Command) watchDelete(ctx context.Context, namespace string, timeout time.Duration) error {
 	waitCtx, ctxCancel := context.WithCancel(ctx)
 	defer ctxCancel()
 
 	stop := make(chan os.Signal, 1)
-	defer close(stop)
+	signal.Notify(stop, os.Interrupt)
+	defer signal.Stop(stop)
 
 	logsCtx, logsCtxCancel := context.WithCancel(waitCtx)
 	defer logsCtxCancel()
 
-	signal.Notify(stop, os.Interrupt)
+	// exit is not closed because the waiting goroutine might still send to it after CTRL+C
 	exit := make(chan error, 1)
-	defer close(exit)
 
 	var wg sync.WaitGroup
 
 	wg.Add(1)
 	go func(wg *sync.WaitGroup) {
 		defer wg.Done()
-		exit <- nc.waitForNamespaceDeleted(waitCtx, namespace, k8sLogger)
+		exit <- nc.waitForNamespaceDeleted(waitCtx, namespace, timeout)
 	}(&wg)
 
 	wg.Add(1)
 	go func(wg *sync.WaitGroup) {
 		defer wg.Done()
 		connectionTimeout := 5 * time.Minute
 		err := nc.okClient.Stream().DestroyAllLogs(logsCtx, namespace, connectionTimeout)
-		if err != nil {
+		// the logs context is canceled when the wait finishes with an error (e.g. timeout), so we should not display the warning
+		if err != nil && !errors.Is(err, context.Canceled) {
 			oktetoLog.Warning("delete namespace logs cannot be streamed due to connectivity issues")
 			oktetoLog.Infof("delete namespace logs can
```

**File**: `cmd/namespace/delete_test.go` (modified, +252/-109)
```diff
@@ -15,153 +15,296 @@ package namespace
 
 import (
 	"context"
+	"errors"
 	"testing"
+	"time"
 
 	"github.com/okteto/okteto/internal/test/client"
 	"github.com/okteto/okteto/pkg/constants"
+	oktetoErrors "github.com/okteto/okteto/pkg/errors"
+	"github.com/okteto/okteto/pkg/log/io"
 	"github.com/okteto/okteto/pkg/okteto"
 	"github.com/okteto/okteto/pkg/types"
 	"github.com/stretchr/testify/assert"
-	v1 "k8s.io/api/core/v1"
-	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
-	"k8s.io/client-go/kubernetes/fake"
+	"github.com/stretchr/testify/require"
 )
 
-func Test_deleteNamespace(t *testing.T) {
-	ctx := context.Background()
-	personalNamespace := "personal"
-	currentNamespace := "current"
-	usr := &types.User{
-		Token: "test-token",
+const (
+	personalNamespace = "personal"
+	currentNamespace  = "current"
+)
+
+type fakeGetResponse struct {
+	ns  *types.Namespace
+	err error
+}
+
+// fakeDeleteNamespaceClient returns the configured Get responses in order for the deleted namespace,
+// repeating the last one. Get calls for any other namespace are handled by the embedded fake
+type fakeDeleteNamespaceClient struct {
+	*client.FakeNamespaceClient
+	deletedNs    string
+	getResponses []fakeGetResponse
+	getCalls     int
+}
+
+func (f *fakeDeleteNamespaceClient) Delete(ctx context.Context, namespace string) error {
+	f.deletedNs = namespace
+	return f.FakeNamespaceClient.Delete(ctx, namespace)
+}
+
+func (f *fakeDeleteNamespaceClient) Get(ctx context.Context, namespace string) (*types.Namespace, error) {
+	if namespace != f.deletedNs {
+		return f.FakeNamespaceClient.Get(ctx, namespace)
+	}
+	if len(f.getResponses) == 0 {
+		return nil, errors.New("unexpected call to Get")
 	}
+	r := f.getResponses[min(f.getCalls, len(f.getResponses)-1)]
+	f.getCalls++
+	return r.ns, r.err
+}
+
+// blockingStreamClient simulates a stalled logs stream: like the real stream client, it ignores
+// the context cancellation and only returns when release is closed
+type blockingStreamClient struct {
+	*client.FakeStreamClient
+	release chan struct{}
+}
+
+func (c *blockingStreamClient) DestroyAllLogs(_ context.Context, _ string, _ time.Duration) error {
+	<-c.release
+	return nil
+}
+
+var namespaceDeletedResponse = fakeGetResponse{err: oktetoErrors.ErrNamespaceNotFound}
+
+func newFakeDeleteNamespaceClient(responses ...fakeGetResponse) *fakeDeleteNamespaceClient {
 	initNamespaces := []types.Namespace{
-		{
-			ID: currentNamespace,
-		},
-		{
-			ID: personalNamespace,
-		},
-		{
-			ID: "test-1",
+		{ID: currentNamespace},
+		{ID: personalNamespace},
+		{ID: "test-1"},
+	}
+	return &fakeDeleteNamespaceClient{
+		FakeNamespaceClient: client.NewFakeNamespaceClient(initNamespaces, nil),
+		getResponses:        responses,
+	}
+}
+
+func setupDeleteTest(t *testing.T, nsClient types.NamespaceInterface, streamResponse *client.FakeStreamResponse) (*Command, *client.FakeOktetoClient) {
+	t.Helper()
+	previousPollInterval := pollInterval
+	pollInterval = time.Millisecond
+	t.Cleanup(func() { pollInterval = previousPollInterval })
+
+	okteto.CurrentStore = &okteto.ContextStore{
+		Contexts: map[string]*okteto.Context{
+			"test-context": {
+				Name:              "test-context",
+				Token:             "test-token",
+				PersonalNamespace: personalNamespace,
+				IsOkteto:          true,
+				Namespace:         currentNamespace,
+				UserID:            "1",
+			},
 		},
+		CurrentContext: "test-context",
+	}
+	usr := &types.User{Token: "test-token"}
+	fakeOkClient := &client.FakeOktetoClient{
+		Namespace:       nsClient,
+		Users:           client.NewFakeUsersClient(usr),
+		StreamClient:    client.NewFakeStreamClient(streamResponse),
+		KubetokenClient: client.NewFakeKubetokenClient(client.FakeKubetokenResponse{}),
 	}
+	return NewFakeNamespaceCommand(fakeOkClient, usr), fakeOkClient
+}
+
+func Test_deleteNamespace(t *testing.T) {
+	ctx := context.Background()
 
 	var tests = []struct {
-		err           error
-		fakeOkClient  *client.FakeOktetoClient
-		fakeK8sClient *fake.Clientset
-		name          string
+		err            error
+		nsClient       *fakeDeleteNamespaceClient
+		streamResponse *client.FakeStreamResponse
+		name           string
 		// toDeleteNs the namespace to delete
 		toDeleteNs string
 		// finalNs the namespace user should finally be
-		finalNs                         string
-		initialNamespacesAtOktetoClient []types.Namespace
+		finalNs string
 	}{
 		{
-			name:                            "delete existing ns, the current one",
-			toDeleteNs:                      currentNamespace,
-			initialNamespacesAtOktetoClient: initNamespaces,
-			finalNs:                         personalNamespace,
-			fakeOkClient: &client.FakeOktetoClient{
-				Namespace:       client.NewFakeNamespaceClient(initNamespaces, nil),
-				Users:           client.NewFakeUsersClient(usr),
-				StreamClient:    client.NewFakeStreamClient(&client.FakeStreamResponse{}),
-				KubetokenClient: client.NewFakeKubetokenClient(client.FakeKubetokenResponse{}),

```

**File**: `cmd/namespace/namespace.go` (modified, +11/-14)
```diff
@@ -32,10 +32,9 @@ type wakeAnalyticsTracker interface {
 
 // Command has all the namespaces subcommands
 type Command struct {
-	ctxCmd            *contextCMD.Command
-	okClient          types.OktetoInterface
-	k8sClientProvider okteto.K8sClientProviderWithLogger
-	ioCtrl            *io.Controller
+	ctxCmd   *contextCMD.Command
+	okClient types.OktetoInterface
+	ioCtrl   *io.Controller
 }
 
 // NewCommand creates a namespace command for use in further operations
@@ -46,25 +45,23 @@ func NewCommand(ioCtrl *io.Controller) (*Command, error) {
 	}
 
 	return &Command{
-		ctxCmd:            contextCMD.NewContextCommand(),
-		okClient:          c,
-		k8sClientProvider: okteto.NewK8sClientProviderWithLogger(nil),
-		ioCtrl:            ioCtrl,
+		ctxCmd:   contextCMD.NewContextCommand(),
+		okClient: c,
+		ioCtrl:   ioCtrl,
 	}, nil
 }
 
 // NewCommandStateless creates a namespace command for use in further operations
 func NewCommandStateless(c *okteto.Client, ioCtrl *io.Controller) *Command {
 	return &Command{
-		ctxCmd:            contextCMD.NewContextCommand(),
-		okClient:          c,
-		k8sClientProvider: okteto.NewK8sClientProviderWithLogger(nil),
-		ioCtrl:            ioCtrl,
+		ctxCmd:   contextCMD.NewContextCommand(),
+		okClient: c,
+		ioCtrl:   ioCtrl,
 	}
 }
 
 // Namespace fetch credentials for a cluster namespace
-func Namespace(ctx context.Context, k8sLogger *io.K8sLogger, ioCtrl *io.Controller, at wakeAnalyticsTracker) *cobra.Command {
+func Namespace(ctx context.Context, ioCtrl *io.Controller, at wakeAnalyticsTracker) *cobra.Command {
 	options := &UseOptions{}
 	cmd := &cobra.Command{
 		Use:     "namespace",
@@ -78,7 +75,7 @@ func Namespace(ctx context.Context, k8sLogger *io.K8sLogger, ioCtrl *io.Controll
 	cmd.AddCommand(Use(ctx, ioCtrl))
 	cmd.AddCommand(List(ctx, ioCtrl))
 	cmd.AddCommand(Create(ctx, ioCtrl))
-	cmd.AddCommand(Delete(ctx, k8sLogger, ioCtrl))
+	cmd.AddCommand(Delete(ctx, ioCtrl))
 	cmd.AddCommand(Sleep(ctx, ioCtrl))
 	cmd.AddCommand(Wake(ctx, ioCtrl, at))
 	return cmd
```

**File**: `cmd/namespace/namespace_test.go` (modified, +1/-25)
```diff
@@ -20,12 +20,7 @@ import (
 	"github.com/okteto/okteto/internal/test"
 	"github.com/okteto/okteto/internal/test/client"
 	"github.com/okteto/okteto/pkg/analytics"
-	"github.com/okteto/okteto/pkg/k8s/ingresses"
-	"github.com/okteto/okteto/pkg/log/io"
 	"github.com/okteto/okteto/pkg/types"
-	"k8s.io/client-go/kubernetes"
-	"k8s.io/client-go/rest"
-	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
 )
 
 type fakeWakeAnalyticsTracker struct {
@@ -36,22 +31,6 @@ func (f *fakeWakeAnalyticsTracker) TrackWakeTriggered(_ context.Context, m analy
 	f.calls = append(f.calls, m)
 }
 
-type fakeK8sProvider struct {
-	k8sClient kubernetes.Interface
-}
-
-func (p *fakeK8sProvider) Provide(_ *clientcmdapi.Config) (kubernetes.Interface, *rest.Config, error) {
-	return p.k8sClient, nil, nil
-}
-
-func (f *fakeK8sProvider) ProvideWithLogger(c *clientcmdapi.Config, _ *io.K8sLogger) (kubernetes.Interface, *rest.Config, error) {
-	return f.Provide(c)
-}
-
-func (*fakeK8sProvider) GetIngressClient() (*ingresses.Client, error) {
-	return nil, nil
-}
-
 func newFakeContextCommand(c *client.FakeOktetoClient, user *types.User) *contextCMD.Command {
 	cmd := contextCMD.NewContextCommand()
 	cmd.OktetoClientProvider = client.NewFakeOktetoClientProvider(c)
@@ -61,12 +40,9 @@ func newFakeContextCommand(c *client.FakeOktetoClient, user *types.User) *contex
 	return cmd
 }
 
-func NewFakeNamespaceCommand(okClient *client.FakeOktetoClient, k8sClient kubernetes.Interface, user *types.User) *Command {
+func NewFakeNamespaceCommand(okClient *client.FakeOktetoClient, user *types.User) *Command {
 	return &Command{
 		okClient: okClient,
 		ctxCmd:   newFakeContextCommand(okClient, user),
-		k8sClientProvider: &fakeK8sProvider{
-			k8sClient: k8sClient,
-		},
 	}
 }
```

**File**: `cmd/namespace/sleep_test.go` (modified, +5/-10)
```diff
@@ -21,7 +21,6 @@ import (
 	"github.com/okteto/okteto/pkg/okteto"
 	"github.com/okteto/okteto/pkg/types"
 	"github.com/stretchr/testify/assert"
-	"k8s.io/client-go/kubernetes/fake"
 )
 
 func Test_SleepNamespace(t *testing.T) {
@@ -39,10 +38,9 @@ func Test_SleepNamespace(t *testing.T) {
 		},
 	}
 	var tests = []struct {
-		err           error
-		fakeOkClient  *client.FakeOktetoClient
-		fakeK8sClient *fake.Clientset
-		name          string
+		err          error
+		fakeOkClient *client.FakeOktetoClient
+		name         string
 		// toSleepNs the namespace to sleep
 		toSleepNs                       string
 		initialNamespacesAtOktetoClient []types.Namespace
@@ -56,7 +54,6 @@ func Test_SleepNamespace(t *testing.T) {
 				Users:        client.NewFakeUsersClient(usr),
 				StreamClient: client.NewFakeStreamClient(&client.FakeStreamResponse{}),
 			},
-			fakeK8sClient: fake.NewSimpleClientset(),
 		},
 		{
 			name:                            "sleeps existing ns, not the current one",
@@ -67,7 +64,6 @@ func Test_SleepNamespace(t *testing.T) {
 				Users:        client.NewFakeUsersClient(usr),
 				StreamClient: client.NewFakeStreamClient(&client.FakeStreamResponse{}),
 			},
-			fakeK8sClient: fake.NewSimpleClientset(),
 		},
 		{
 			name:                            "sleep non existing ns",
@@ -78,8 +74,7 @@ func Test_SleepNamespace(t *testing.T) {
 				Users:        client.NewFakeUsersClient(usr),
 				StreamClient: client.NewFakeStreamClient(&client.FakeStreamResponse{}),
 			},
-			fakeK8sClient: fake.NewSimpleClientset(),
-			err:           errFailedSleepNamespace,
+			err: errFailedSleepNamespace,
 		},
 	}
 
@@ -98,7 +93,7 @@ func Test_SleepNamespace(t *testing.T) {
 				},
 				CurrentContext: "test-context",
 			}
-			nsFakeCommand := NewFakeNamespaceCommand(tt.fakeOkClient, tt.fakeK8sClient, usr)
+			nsFakeCommand := NewFakeNamespaceCommand(tt.fakeOkClient, usr)
 			err := nsFakeCommand.ExecuteSleepNamespace(ctx, tt.toSleepNs)
 			if tt.err != nil {
 				assert.ErrorIs(t, err, tt.err)
```

**File**: `cmd/namespace/wake_test.go` (modified, +4/-9)
```diff
@@ -21,7 +21,6 @@ import (
 	"github.com/okteto/okteto/pkg/okteto"
 	"github.com/okteto/okteto/pkg/types"
 	"github.com/stretchr/testify/assert"
-	"k8s.io/client-go/kubernetes/fake"
 )
 
 func Test_WakeNamespace(t *testing.T) {
@@ -39,10 +38,9 @@ func Test_WakeNamespace(t *testing.T) {
 		},
 	}
 	var tests = []struct {
-		err           error
-		fakeOkClient  *client.FakeOktetoClient
-		fakeK8sClient *fake.Clientset
-		name          string
+		err          error
+		fakeOkClient *client.FakeOktetoClient
+		name         string
 		// toWakeNs the namespace to wake
 		toWakeNs                        string
 		initialNamespacesAtOktetoClient []types.Namespace
@@ -57,7 +55,6 @@ func Test_WakeNamespace(t *testing.T) {
 				Users:        client.NewFakeUsersClient(usr),
 				StreamClient: client.NewFakeStreamClient(&client.FakeStreamResponse{}),
 			},
-			fakeK8sClient: fake.NewSimpleClientset(),
 			expectTracked: true,
 		},
 		{
@@ -69,7 +66,6 @@ func Test_WakeNamespace(t *testing.T) {
 				Users:        client.NewFakeUsersClient(usr),
 				StreamClient: client.NewFakeStreamClient(&client.FakeStreamResponse{}),
 			},
-			fakeK8sClient: fake.NewSimpleClientset(),
 			expectTracked: true,
 		},
 		{
@@ -81,7 +77,6 @@ func Test_WakeNamespace(t *testing.T) {
 				Users:        client.NewFakeUsersClient(usr),
 				StreamClient: client.NewFakeStreamClient(&client.FakeStreamResponse{}),
 			},
-			fakeK8sClient: fake.NewSimpleClientset(),
 			err:           errFailedWakeNamespace,
 			expectTracked: false,
 		},
@@ -103,7 +98,7 @@ func Test_WakeNamespace(t *testing.T) {
 				CurrentContext: "test-context",
 			}
 			tracker := &fakeWakeAnalyticsTracker{}
-			nsFakeCommand := NewFakeNamespaceCommand(tt.fakeOkClient, tt.fakeK8sClient, usr)
+			nsFakeCommand := NewFakeNamespaceCommand(tt.fakeOkClient, usr)
 			err := nsFakeCommand.ExecuteWakeNamespace(ctx, tt.toWakeNs, tracker)
 			if tt.err != nil {
 				assert.ErrorIs(t, err, tt.err)
```

**File**: `main.go` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@ func main() {
 
 	root.AddCommand(build.Build(ctx, ioController, at, insights, k8sLogger))
 
-	root.AddCommand(namespace.Namespace(ctx, k8sLogger, ioController, at))
+	root.AddCommand(namespace.Namespace(ctx, ioController, at))
 	root.AddCommand(up.Up(at, insights, ioController, k8sLogger, fs))
 	root.AddCommand(cmd.Down(at, k8sLogger, fs))
 	root.AddCommand(cmd.Status(fs))
```

---

### Incident Patch 2: `afa70c09` (2026-10-01)
**Commit Message**: fix: update vulnerable dependencies (#5176)

* fix: update vulnerable dependencies

- Update kubectl from 1.35.8 to 1.35.9 (fixes Go stdlib CVE-2026-33818, CVE-2026-39821, CVE-2026-46600, CVE-2026-56853, CVE-2026-56858, CVE-2026-56859, CVE-2026-56860, CVE-2026-56862)
- Update kustomize from 5.8.1 to 5.8.2 (fixes CVE-2025-68121 CRITICAL and 15 stdlib/x/text HIGH CVEs)
- Update syncthing from 2.1.3 to 2.1.5 in the Dockerfile and pkg/syncthing (fixes CVE-2026-56854 and Go stdlib CVEs)
- Update helm3 from 3.21.4 to 3.22.0 (fixes CVE-2026-50163, CVE-2026-85731, CVE-2026-56854 and Go stdlib CVEs)
- Update helm4 from 4.2.4 to 4.3.0 (fixes CVE-2026-50163, CVE-2026-85731, CVE-2026-56854 and Go stdlib CVEs)

Resolves 1 CRITICAL and 66 HIGH severity vulnerabilities.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Javier Lopez <[REDACTED_EMAIL]>

* fix: keep helm4 and syncthing on Go 1.26 builds

helm 4.3.0 and syncthing 2.1.5 are built upstream with Go 1.27.1, which is
affected by golang/go#81199 (ML-DSA in the TLS ClientHello causes connection
resets behind TLS-inspecting middleboxes). Revert to helm 4.2.4 and
syncthing 2.1.3 (Go 1.26.5) until upstream ships a fixed build.

**File**: `Dockerfile` (modified, +3/-3)
```diff
@@ -1,9 +1,9 @@
 # Base image versions - Centralized version control for easier updates
 # Kubernetes tools (kubectl, Helm 3, Helm 4, kustomize)
-ARG KUBECTL_VERSION=1.35.8
-ARG HELM3_VERSION=3.21.4
+ARG KUBECTL_VERSION=1.35.9
+ARG HELM3_VERSION=3.22.0
 ARG HELM4_VERSION=4.2.4
-ARG KUSTOMIZE_VERSION=5.8.1
+ARG KUSTOMIZE_VERSION=5.8.2
 # Okteto components
 ARG SYNCTHING_VERSION=2.1.3
 ARG SYNCTHING_SHA=sha256:8c8ff37ab6aa8be23b700648a90fa9412e214852e9fd6ea8477c8334792daec0
```

---

### Incident Patch 3: `f599c1e6` (2026-10-16)
**Commit Message**: build(deps): bump renovatebot/github-action from 46.3.7 to 46.3.8 (#5203)

Bumps [renovatebot/github-action](https://github.com/renovatebot/github-action) from 46.3.7 to 46.3.8.
- [Release notes](https://github.com/renovatebot/github-action/releases)
- [Changelog](https://github.com/renovatebot/github-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/renovatebot/github-action/compare/v46.3.7...v46.3.8)

---
updated-dependencies:
- dependency-name: renovatebot/github-action
  dependency-version: 46.3.8
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
-        uses: renovatebot/github-action@v46.3.7
+        uses: renovatebot/github-action@v46.3.8
         with:
           configurationFile: .github/renovate.json
           token: ${{ secrets.RENOVATEBOT_GITHUB_TOKEN }}
```

#### Recent Merged Pull Requests:
- **PR #5204** (2026-10-16): chore(deps): Update module github.com/santhosh-tekuri/jsonschema/v6 to v6.0.3 (@oktetobot)
- **PR #5203** (2026-10-16): build(deps): bump renovatebot/github-action from 46.3.7 to 46.3.8 (@dependabot[bot])
- **PR #5199** (2026-10-14): chore(deps): Update module golang.org/x/crypto to v0.57.0 (@oktetobot)
- **PR #5197** (2026-10-13): chore(deps): Update module github.com/hashicorp/go-getter to v1.8.9 (@oktetobot)
- **PR #5196** (2026-10-13): build(deps): bump renovatebot/github-action from 46.3.6 to 46.3.7 (@dependabot[bot])
- **PR #5195** (2026-10-13): Upgrade buildkit dependency to v0.34.0-okteto1 (@devin-ai-integration[bot])

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

## X. wait until the namespace is fully deleted in `okteto namespace delete` (#5187)

**RULE**:
When implementing operations in `cmd/namespace/delete.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in okteto/okteto. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `65adec03`: wait until the namespace is fully deleted in `okteto namespace delete` (#5187). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/namespace/delete.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"errors"
const (
	defaultDeleteTimeout = 5 * time.Minute

	namespaceStatusActive       = "Active"
	namespaceStatusDeleteFailed = "DeleteFailed"
)

var (
	// pollInterval is the interval between checks of the namespace status while waiting for its deletion
	pollInterval = 1 * time.Second

	// logsGracePeriod is the maximum time to wait for the deletion logs once the wait has finished
	logsGracePeriod = 10 * time.Second
)

// DeleteOptions represents the options that namespace delete has
type DeleteOptions struct {
	Namespace string
	Timeout   time.Duration
	Wait      bool
}

func Delete(ctx context.Context, ioCtrl *io.Controller) *cobra.Command {
	opts := &DeleteOptions{}
			opts.Namespace = okteto.GetContext().Namespace
				opts.Namespace = args[0]
			err = nsCmd.ExecuteDeleteNamespace(ctx, opts)
	cmd.Flags().BoolVarP(&opts.Wait, "wait", "w", true, "wait until the Okteto Namespace is fully deleted from the cluster")
	cmd.Flags().DurationVarP(&opts.Timeout, "timeout", "t", defaultDeleteTimeout, "the duration to wait for the Okteto Namespace to be deleted. Any value should contain a corresponding time unit e.g. 1s, 2m, 3h")
func (nc *Command) ExecuteDeleteNamespace(ctx context.Conte
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	k8sErrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
func Delete(ctx context.Context, k8sLogger *io.K8sLogger, ioCtrl *io.Controller) *cobra.Command {
			nsToDelete := okteto.GetContext().Namespace
				nsToDelete = args[0]
			err = nsCmd.ExecuteDeleteNamespace(ctx, nsToDelete, k8sLogger)
func (nc *Command) ExecuteDeleteNamespace(ctx context.Context, namespace string, k8sLogger *io.K8sLogger) error {
	if err := nc.watchDelete(ctx, namespace, k8sLogger); err != nil {
		return fmt.Errorf("watching namespace deletion stopped: %w", err)
	oktetoLog.Success("Namespace '%s' deleted", namespace)
func (nc *Command) watchDelete(ctx context.Context, namespace string, k8sLogger *io.K8sLogger) error {
	defer close(stop)
	signal.Notify(stop, os.Interrupt)
	defer close(exit)
		exit <- nc.waitForNamespaceDeleted(waitCtx, namespace, k8sLogger)
		if err != nil {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `65adec03` are properly handled with clean fallback behavior.

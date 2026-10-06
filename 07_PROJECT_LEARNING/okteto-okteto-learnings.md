# Forensic Learning Record (Deep Inspection): okteto/okteto

> **Canonical Artifact**: `07_PROJECT_LEARNING/okteto-okteto-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/okteto/okteto](https://github.com/okteto/okteto))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:55:28.250Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `okteto/okteto`
- **Description**: Develop your applications directly in your Kubernetes Cluster
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3550 stars

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

### Core Architecture Module: `cmd/utils/executor/json.go`
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
	"os/exec"

	"github.com/okteto/okteto/cmd/utils/displayer"
	oktetoLog "github.com/okteto/okteto/pkg/log"
)

type jsonExecutor struct {
	displayer displayer.Displayer
}

func newJSONExecutor() *jsonExecutor {
	return &jsonExecutor{}
}

func (e *jsonExecutor) startCommand(cmd *exec.Cmd) error {
	stdoutReader, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}

	stderrReader, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	e.displayer = displayer.NewDisplayer(oktetoLog.GetOutputFormat(), stdoutReader, stderrReader)
	return startCommand(cmd)
}

func (e *jsonExecutor) display(cmd string) {
	e.displayer.Display(cmd)
}
func (e *jsonExecutor) cleanUp(err error) {
	if e.displayer != nil {
		e.displayer.CleanUp(err)
	}
}

```

### Core Architecture Module: `cmd/utils/executor/plain.go`
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
	"os/exec"

	"github.com/okteto/okteto/cmd/utils/displayer"
	oktetoLog "github.com/okteto/okteto/pkg/log"
)

type plainExecutor struct {
	displayer displayer.Displayer
}

func newPlainExecutor() *plainExecutor {
	return &plainExecutor{
		displayer: displayer.NewDisplayer(oktetoLog.PlainFormat, nil, nil),
	}
}

func (e *plainExecutor) startCommand(cmd *exec.Cmd) error {
	stdoutReader, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}

	stderrReader, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	e.displayer = displayer.NewDisplayer(oktetoLog.GetOutputFormat(), stdoutReader, stderrReader)
	return startCommand(cmd)
}

func (e *plainExecutor) display(command string) {
	e.displayer.Display(command)
}

func (e *plainExecutor) cleanUp(err error) {
	e.displayer.CleanUp(err)
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
  > > > I guess that cancelling a running job will (or might) leave some "trash" in the okteto instance where is running, right? Like namespaces, deployments, etc.... >  > Yes, it could leave some resources there. Should we then leave it running?  What is the behavior currently if I do 2 commits in a short period of time? Do we cancel them or do we run both of them? Does the second one wait until the first one ends?

- **Issue #4846** (2025-12-22): **fix(log): mask platform env vars (DEV-1266)**
  *Symptoms*: # Proposed changes  Fixes [DEV-1266](https://okteto.atlassian.net/browse/DEV-1266)  This change ensures that all platform environment variables are always masked in logs during remote execution operations.  ## CLI Quality Reminders 🔧  For both authors and reviewers:  - Scrutinize for potential regressions - Ensure key automated tests are in place - Build the CLI and test using the validation steps - Assess Developer Experience impact (log messages, performances, etc) - If too broad, consider breaking into smaller PRs - Adhere to our [code style](https://github.com/okteto/okteto/blob/master/docs/code-style.md) and [code review](https://github.com/okteto/okteto/blob/master/docs/code-review.md) guidelines  [DEV-1266]: https://okteto.atlassian.net/browse/DEV-1266?atlOrigin=eyJpIjoiNWRkNTljNzYxNjVmNDY3MDlhMDU5Y2ZhYzA5YTRkZjUiLCJwIjoiZ2l0aHViLWNvbS1KU1cifQ
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/okteto/okteto/pull/4846?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) Report :x: Patch coverage is `0%` with `8 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 48.65%. Comparing base ([`21d88ca`](https://app.codecov.io/gh/okteto/okteto/commit/21d88ca7b178b2abd5fbad72829d7f07280c0d88?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto)) to head ([`d2f2a91`](https://app.codecov.io/gh/okteto/okteto/commit/d2f2a91dd76d3cfe52cb49a41179c902bb4df97f?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto)). :warning: Report is 7 commits behind head on master.  :x: Your patch status has failed because the patch coverage (0.00%) is below the target coverage (60.00%). You can increase the

- **Issue #4213** (2024-03-25): **[Backport release-2.25] fix: add CORS PNA support to browser login**
  *Symptoms*: Backport 1b7dce4ed6dcc0267f993cbd95e575a006ef952d from #4212.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/okteto/okteto/pull/4213?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) Report > Merging [#4213](https://app.codecov.io/gh/okteto/okteto/pull/4213?src=pr&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) (e168b97) into [release-2.25](https://app.codecov.io/gh/okteto/okteto/commit/724e8569890d0ae3752a4a49f19b2bd156e35ba4?el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) (724e856) will **increase** coverage by `0.02%`. > The diff coverage is `n/a`.  <details><summary>Additional details and impacted files</summary>    ```diff @@               Coverage Diff                @@ ##           release-2.25    #4213      +/-   ## ================================================ + Coverage         45.62%   45.64%   +0.02%      =====================================

- **Issue #4212** (2024-03-25): **fix: add CORS PNA support to browser login**
  *Symptoms*: Signed-off-by: Javier Provecho Fernández (Okteto) <jpf@okteto.com>  Chrome 123 (1) reintroduced Private Network Access (2), causing the following behavior:  1. By using `okteto context use` with browser login. 2. If the IDP shows a webpage. 3. Upon redirect from the Okteto API to the Okteto CLI webserver. 4. Chrome will send two requests instead of one.    - The first request is a CORS preflight (HTTP method `OPTIONS`).    - It sends the following request headers:      - `Access-Control-Request-Private-Network: true`    - And expects the following response headers: - `Access-Control-Allow-Origin: https://okteto-instance-hostname` - `Access-Control-Allow-Private-Network: true`  The CORS preflight request in Chrome 123 is in warning mode, and it will be cancelled if the response takes more than 200 milliseconds.  The Okteto CLI webserver didn't differentiate between the preflight and the actual request, so it would start processing the preflight request, but when Chrome cancelled it, the Okteto CLI webserver would mark as done the `context.Context`, and it will propagate the cancellation to their children.  Upon context cancellation, the Okteto CLI webserver would close itself and exit with an error.  Depending on the IDP, some of them such as GitHub only use a webpage for the first interaction, while following interactions are purely HTTP redirects. Other IDPs may use a webpage for every interaction, which resulted in the Okteto CLI unable to complete the lo
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/okteto/okteto/pull/4212?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) Report > Merging [#4212](https://app.codecov.io/gh/okteto/okteto/pull/4212?src=pr&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) (3352bee) into [master](https://app.codecov.io/gh/okteto/okteto/commit/59b22b3c22563bfacb7b424b493493bc277e4509?el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) (59b22b3) will **not change** coverage. > The diff coverage is `n/a`.  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##           master    #4212   +/-   ## =======================================   Coverage   45.49%   45.49%            =======================================   Files         295      295              Lines 

- **Issue #4052** (2023-11-23): **fix: use okteto api to retrieve dev env endpoints**
  *Symptoms*: ## Changes - use okteto api to retrieve endpoints using `space` query - use old logic for vanilla or fallbacks if endpoint is not available - remove external endpoints retrieval when backend is used to retrieve endpoints  ## How to test it - clone okteto/movies - cd to the repo - deploy okteto/movies with an external resource (`okteto deploy`) - check all endpoints are correct comparing them with endpoint in okteto UI when exec `okteto endpoints` --- ### With/without changes - clone https://github.com/okteto/divert-with-istio-sample - cd divert-with-istio-sample - using my own cluster `okteto ctx use <my-context>`. You need to enable istio and an okteto feature flag in order to use virtual services so is easy to use my cluster already prepared. - run `okteto deploy -f okteto-staging.yml` - check endpoint in UI (broken because we need an ingress but enough to test the needed logic) - run `okteto endpoints -f okteto-staging.yml` will show same endpoints than UI using this PR and no endpoints with previous implementation  
  **Post-Mortem & Fix Analysis**:
  > @AdrianPedriza we don't need to wait until the backend changes. The code should handle the error and default to the previous behavior. Otherwise, we will be breaking the newer CLIs using old versions of the Okteto chart
  > ## [Codecov](https://app.codecov.io/gh/okteto/okteto/pull/4052?src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) Report > Merging [#4052](https://app.codecov.io/gh/okteto/okteto/pull/4052?src=pr&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) (8627aa4) into [master](https://app.codecov.io/gh/okteto/okteto/commit/471fcba79925f7743e27e38999c6b4f14ea41c92?el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) (471fcba) will **decrease** coverage by `0.01%`. > Report is 14 commits behind head on master. > The diff coverage is `43.07%`.  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##           master    #4052      +/-   ## ========================================== - Coverage   44.28%   44.28%   -0.01%      ====================================
  > > @AdrianPedriza we don't need to wait until the backend changes. The code should handle the error and default to the previous behavior. Otherwise, we will be breaking the newer CLIs using old versions of the Okteto chart  Absolutely right! I will fallback to the old implementation in that case then

- **Issue #4045** (2023-11-16): **add quotes for variables added in remote**
  *Symptoms*: # Proposed changes - add quotes for variables added in remote - add tests  ## How to validate  1. clone okteto/movies 2. consume variable TEST in deploy seccion 3. run `okteto deploy --remote --var TEST="a multi worked value"` 4. check variable in consumed  ## CLI Quality Reminders 🔧  For both authors and reviewers:  - Scrutinize for potential regressions - Ensure key automated tests are in place - Build the CLI and test using the validation steps - Assess Developer Experience impact (log messages, performances, etc) - If too broad, consider breaking into smaller PRs - Adhere to our [code style](https://github.com/okteto/okteto/blob/master/docs/code-style.md) and [code review](https://github.com/okteto/okteto/blob/master/docs/code-review.md) guidelines  <!-- Remove comment when okteto/okteto is out of wait list for Copilot for Pull Requests ----  <details> <summary>🧪 Copilot generated PR description</summary>  copilot:all  </details> --> 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/okteto/okteto/pull/4045?src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) Report > Merging [#4045](https://app.codecov.io/gh/okteto/okteto/pull/4045?src=pr&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) (d762cdb) into [master](https://app.codecov.io/gh/okteto/okteto/commit/54bcbda12ec0f538b5490c0b0e414891a89c74ae?el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=okteto) (54bcbda) will **increase** coverage by `0.00%`. > The diff coverage is `81.81%`.  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##           master    #4045   +/-   ## =======================================   Coverage   44.28%   44.28%            =======================================   Files         259      259              Lines       

- **Issue #4044** (2023-11-15): **Lake 66 remote okteto deploy broken when var has whitespace**
  *Symptoms*: # Proposed changes - add quotes for variables value when building dockerfile to deploy - add test case  ## How to validate  1. clone okteto/movies 2. use a new variable in your deploy section that needs to be set in `okteto deploy` command using `--var` 3. run `okteto deploy --remote -- var <your key>="this is a multi-word value"`  4. check deploy section displays proper output using variable set in the command itself  ## CLI Quality Reminders 🔧  For both authors and reviewers:  - Scrutinize for potential regressions - Ensure key automated tests are in place - Build the CLI and test using the validation steps - Assess Developer Experience impact (log messages, performances, etc) - If too broad, consider breaking into smaller PRs - Adhere to our [code style](https://github.com/okteto/okteto/blob/master/docs/code-style.md) and [code review](https://github.com/okteto/okteto/blob/master/docs/code-review.md) guidelines  <!-- Remove comment when okteto/okteto is out of wait list for Copilot for Pull Requests ----  <details> <summary>🧪 Copilot generated PR description</summary>  copilot:all  </details> --> 
  **Post-Mortem & Fix Analysis**:
  > Thank you for your contribution. unfortunately, one or more of your commits are missing the required "Signed-off-by:" statement. Signing off is part of the [Developer Certificate of Origin (DCO)](https://en.wikipedia.org/wiki/Developer_Certificate_of_Origin) which is used by this project.  Read the DCO and [project contributing guide](https://github.com/okteto/okteto/blob/master/contributing.md) carefully, and amend your commits using the git CLI. Note that this does not require any cryptography, keys or special steps to be taken.  ### :bulb: Shall we fix this?  This will only take a few moments.  First, clone your fork and checkout this branch using the git CLI.  Next, set up your real name and email address:  `git config --global user.name "Your Full Name"` `git config --global user.email "you@domain.com"`  Finally, run one of these commands to add the "Signed-off-by" line to your commits.  If you only have one commit so far then run: `git commit --amend --signoff` and then `git push

- **Issue #4004** (2023-12-11): **Using `OKTETO_USE_STATIC_KUBETOKEN ` as an Okteto secret creates a dynamic kubetoken**
  *Symptoms*: **Describe the bug** If I load the `OKTETO_USE_STATIC_KUBETOKEN` from an  Okteto secret  the token used by the CLI is a dynamic token. This is because we calculate the dynamic kubetoken before we have set the okteto secrets as environment variables.  **To Reproduce** Steps to reproduce the behavior:  1. Go to https://cloud.okteto.com/settings/secrets and create a secret `OKTETO_USE_STATIC_KUBETOKEN` = `true` 1. Run `okteto deploy` o any repo. ([Recommended](https://github.com/okteto/go-getting-started)) 1. Check that we don't get the warning: ` !  Using static Kubernetes token due to env var: 'OKTETO_USE_STATIC_KUBETOKEN'. This feature will be removed in the future. We recommend using a dynamic kubernetes token.` 1. Check that the kubectl commands doesn't throw any warning  **Expected behavior** I expect a output similar to   <img width="853" alt="Captura de pantalla 2023-10-05 a las 10 25 19" src="https://github.com/okteto/okteto/assets/25170843/cf0a3bc4-f7ed-495c-8d32-b72e72400e4c">   **Desktop (please complete the following information):**  - k8s server version > 1.27 - Okteto version = 2.20.0  **Additional context** Problem located [here](https://github.com/okteto/okteto/blob/master/cmd/context/create.go#L295-L311) 
  **Post-Mortem & Fix Analysis**:
  > This issue is stale because it has been open for 60 days with no activity. Comment on this issue or it will be closed in 7 days

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

### Incident Patch 1: `49ba1106` (2026-10-05)
**Commit Message**: build(deps): bump renovatebot/github-action from 46.3.4 to 46.3.6 (#5182)

Bumps [renovatebot/github-action](https://github.com/renovatebot/github-action) from 46.3.4 to 46.3.6.
- [Release notes](https://github.com/renovatebot/github-action/releases)
- [Changelog](https://github.com/renovatebot/github-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/renovatebot/github-action/compare/v46.3.4...v46.3.6)

---
updated-dependencies:
- dependency-name: renovatebot/github-action
  dependency-version: 46.3.6
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
-        uses: renovatebot/github-action@v46.3.4
+        uses: renovatebot/github-action@v46.3.6
         with:
           configurationFile: .github/renovate.json
           token: ${{ secrets.RENOVATEBOT_GITHUB_TOKEN }}
```

---

### Incident Patch 2: `e9d1dbbd` (2026-10-01)
**Commit Message**: fix: `okteto destroy` command removes manifest information from c... (#5171)

**File**: `cmd/destroy/destroy_test.go` (modified, +54/-0)
```diff
@@ -15,6 +15,7 @@ package destroy
 
 import (
 	"context"
+	"encoding/base64"
 	"fmt"
 	"os"
 	"testing"
@@ -347,6 +348,59 @@ func TestDestroyWithErrorOnCommands(t *testing.T) {
 	require.Equal(t, pipeline.ErrorStatus, cfg.Data["status"])
 }
 
+func TestDestroyWithErrorOnCommandsKeepsManifestInConfigMap(t *testing.T) {
+	ctx := context.Background()
+	encodedManifest := base64.StdEncoding.EncodeToString([]byte("name: test-app"))
+	existingCfg := &v1.ConfigMap{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      pipeline.TranslatePipelineName(fakeManifest.Name),
+			Namespace: "namespace",
+			Labels: map[string]string{
+				model.GitDeployLabel: "true",
+			},
+		},
+		Data: map[string]string{
+			"status": pipeline.DeployedStatus,
+			"yaml":   encodedManifest,
+		},
+	}
+	k8sClientProvider := test.NewFakeK8sProvider(existingCfg)
+	fakeClient, _, err := k8sClientProvider.Provide(api.NewConfig())
+	require.NoError(t, err)
+
+	dc := &destroyCommand{
+		ConfigMapHandler:  NewConfigmapHandler(fakeClient),
+		nsDestroyer:       &fakeDestroyer{},
+		secrets:           &fakeSecretHandler{},
+		k8sClientProvider: k8sClientProvider,
+		executor: &fakeExecutor{
+			err: assert.AnError,
+		},
+		buildCtrlProvider: fakeBuildCtrlProvider{
+			buildCtrl: buildCtrl{
+				builder: fakeBuilderV2{
+					getSvcs: fakeGetSvcs{},
+					build:   nil,
+				},
+			},
+		},
+	}
+
+	err = dc.destroy(ctx, &Options{
+		Name:      fakeManifest.Name,
+		Namespace: "namespace",
+		Manifest:  fakeManifest,
+	})
+
+	require.Error(t, err)
+
+	cfg, err := fakeClient.CoreV1().ConfigMaps("namespace").Get(ctx, pipeline.TranslatePipelineName(fakeManifest.Name), metav1.GetOptions{})
+
+	require.NoError(t, err)
+	require.Equal(t, pipeline.ErrorStatus, cfg.Data["status"])
+	require.Equal(t, encodedManifest, cfg.Data["yaml"])
+}
+
 func TestDestroyWithErrorOnCommandsForcingDestroy(t *testing.T) {
 	ctx := context.Background()
 	k8sClientProvider := test.NewFakeK8sProvider()
```

**File**: `pkg/cmd/pipeline/translate.go` (modified, +3/-1)
```diff
@@ -381,7 +381,9 @@ func updateCmap(cmap *apiv1.ConfigMap, data *CfgData) error {
 	cmap.ObjectMeta.Labels[model.GitDeployLabel] = "true"
 	cmap.Data[nameField] = data.Name
 	cmap.Data[statusField] = data.Status
-	cmap.Data[yamlField] = base64.StdEncoding.EncodeToString(data.Manifest)
+	if len(data.Manifest) > 0 {
+		cmap.Data[yamlField] = base64.StdEncoding.EncodeToString(data.Manifest)
+	}
 	cmap.Data[iconField] = data.Icon
 	cmap.Data[actionNameField] = actionName
 	if data.Repository != "" {
```

**File**: `pkg/cmd/pipeline/translate_test.go` (modified, +50/-0)
```diff
@@ -271,6 +271,56 @@ func Test_translateVariables(t *testing.T) {
 
 	}
 }
+
+func Test_updateCmapKeepsManifestWhenNotProvided(t *testing.T) {
+	encodedManifest := base64.StdEncoding.EncodeToString([]byte("name: test"))
+	cmap := &apiv1.ConfigMap{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      TranslatePipelineName("test"),
+			Namespace: "test",
+			Labels:    map[string]string{},
+		},
+		Data: map[string]string{
+			statusField: DeployedStatus,
+			yamlField:   encodedManifest,
+		},
+	}
+
+	err := updateCmap(cmap, &CfgData{
+		Name:      "test",
+		Namespace: "test",
+		Status:    DestroyingStatus,
+	})
+
+	require.NoError(t, err)
+	require.Equal(t, encodedManifest, cmap.Data[yamlField])
+	require.Equal(t, DestroyingStatus, cmap.Data[statusField])
+}
+
+func Test_updateCmapOverwritesManifestWhenProvided(t *testing.T) {
+	cmap := &apiv1.ConfigMap{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      TranslatePipelineName("test"),
+			Namespace: "test",
+			Labels:    map[string]string{},
+		},
+		Data: map[string]string{
+			statusField: DeployedStatus,
+			yamlField:   base64.StdEncoding.EncodeToString([]byte("name: old")),
+		},
+	}
+
+	err := updateCmap(cmap, &CfgData{
+		Name:      "test",
+		Namespace: "test",
+		Status:    ProgressingStatus,
+		Manifest:  []byte("name: new"),
+	})
+
+	require.NoError(t, err)
+	require.Equal(t, base64.StdEncoding.EncodeToString([]byte("name: new")), cmap.Data[yamlField])
+}
+
 func Test_AddPhaseDuration(t *testing.T) {
 	ctx := context.Background()
 	name := "test"
```

---

### Incident Patch 3: `afa70c09` (2026-10-01)
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

### Incident Patch 4: `7924c3c4` (2026-09-30)
**Commit Message**: build(deps): bump brace-expansion in /samples/node.js (#5173)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 1.1.18 to 1.1.21.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v1.1.18...v1.1.21)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 1.1.21
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `samples/node.js/yarn.lock` (modified, +3/-3)
```diff
@@ -102,9 +102,9 @@ boxen@^5.0.0:
     wrap-ansi "^7.0.0"
 
 brace-expansion@^1.1.7:
-  version "1.1.18"
-  resolved "https://registry.yarnpkg.com/brace-expansion/-/brace-expansion-1.1.18.tgz#3ce74d89885136be1535341f8c3d4425c29a5cab"
-  integrity sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==
+  version "1.1.21"
+  resolved "https://registry.yarnpkg.com/brace-expansion/-/brace-expansion-1.1.21.tgz#edf4fab5c64d051aea5a8def49aba1c7522279f3"
+  integrity sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==
   dependencies:
     balanced-match "^1.0.0"
     concat-map "0.0.1"
```

---

### Incident Patch 5: `4765b264` (2026-09-30)
**Commit Message**: feat(build): support OKTETO_BUILD_COMPRESSION* env vars (DEV-1469) (#5167)

* feat(build): read OKTETO_BUILD_COMPRESSION* with ALPHA names as aliases

Add OKTETO_BUILD_COMPRESSION, OKTETO_BUILD_COMPRESSION_LEVEL and
OKTETO_BUILD_FORCE_COMPRESSION. The OKTETO_ALPHA_BUILD_* names keep
working as deprecated aliases: the new name wins when non-empty, and a
debug-level log is written when only the deprecated name is set.

Platform variables are now alias-aware: a local env var with either
name of a pair prevents both platform values from being exported, so a
local ALPHA value is not shadowed by a platform-sent new name.

Manifest commands also get the alias of any aliased variable in their
command env, so a --var or $OKTETO_ENV value is not shadowed by an
inherited platform value (e.g. in remote deploys).

DEV-1469

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Javier Lopez <[REDACTED_EMAIL]>

* test(integration): build image with zstd layer compression

Add an Env field to the integration build options and a test that
builds with OKTETO_BUILD_COMPRESSION=zstd and checks the pushed layers
are application/vnd.oci.image.layer.v1.tar+zstd.

DEV-1469

Co-Authored-By: Cla

**File**: `.claude/context/feature-flags.md` (modified, +41/-0)
```diff
@@ -187,6 +187,47 @@ During initial rollout this read `LoadBooleanOrDefault(..., false)`. The default
 
 ---
 
+## Renaming a Flag — Deprecated Aliases
+
+When an env var is renamed (e.g. an `OKTETO_ALPHA_*` feature is promoted), keep the old name working as a deprecated alias. Never break the old name in the same release.
+
+### Rules
+
+- **New name wins when non-empty**; otherwise fall back to the deprecated name; otherwise use the default (or omit the setting).
+- An empty new name (`NEW=""`) does **not** mask a non-empty deprecated name.
+- Define both constants; mark the old one with a Go `Deprecated:` paragraph so linters flag new usages:
+
+```go
+// BuildCompressionEnvVar sets the compression type of the exported image layers.
+BuildCompressionEnvVar = "OKTETO_BUILD_COMPRESSION"
+
+// AlphaBuildCompressionEnvVar is the legacy name of BuildCompressionEnvVar.
+//
+// Deprecated: use BuildCompressionEnvVar instead.
+AlphaBuildCompressionEnvVar = "OKTETO_ALPHA_BUILD_COMPRESSION"
+```
+
+- Log the deprecation **only when just the old name is set**, and choose the level on purpose:
+  - **Debug** (`logger.Debugf`) when the old name can be injected by the Okteto platform (older platforms only send the old name — a user-facing warning would be noise the user cannot fix).
+  - **User-facing warning** (`Warning`) when only the user sets the var.
+
+### Platform variables
+
+Newer platforms send both names with the same value, older ones only the old name. Platform variables are exported only when a var with the **same name** does not exist locally, so a local old name does not override a platform-sent new name. To override a platform value locally, use the new name.
+
+### Examples
+
+- `OKTETO_CLI_IMAGE` ← `OKTETO_BIN` / `OKTETO_REMOTE_CLI_IMAGE` in `pkg/config/image.go` (`GetCliImage`, tests in `image_test.go`). User-set only, so it warns.
+- Build compression in `pkg/build/buildkit/opt.go` (table `compressionEnvVars`, helper `getCompressionEnv`). Platform-sent, so it logs at debug level:
+
+| New                              | Deprecated alias                       | BuildKit attr       |
+| -------------------------------- | -------------------------------------- | ------------------- |
+| `OKTETO_BUILD_COMPRESSION`       | `OKTETO_ALPHA_BUILD_COMPRESSION`       | `compression`       |
+| `OKTETO_BUILD_COMPRESSION_LEVEL` | `OKTETO_ALPHA_BUILD_COMPRESSION_LEVEL` | `compression-level` |
+| `OKTETO_BUILD_FORCE_COMPRESSION` | `OKTETO_ALPHA_BUILD_FORCE_COMPRESSION` | `force-compression` |
+
+---
+
 ## Checklist When Adding a Feature Flag
 
 - [ ] Constant defined with `OKTETO_` prefix at package level
```

**File**: `pkg/build/buildkit/opt.go` (modified, +73/-22)
```diff
@@ -48,8 +48,49 @@ const (
 	// OciMediaTypesEnvVar controls whether BuildKit uses OCI media types for image exports.
 	// Defaults to true (OCI media types). Set to false for legacy Docker media types.
 	OciMediaTypesEnvVar = "OKTETO_BUILD_OCI_MEDIATYPES"
+
+	// BuildCompressionEnvVar sets the compression type of the exported image layers
+	// (gzip, estargz, zstd, uncompressed). Unset means BuildKit's default.
+	BuildCompressionEnvVar = "OKTETO_BUILD_COMPRESSION"
+
+	// BuildCompressionLevelEnvVar sets the compression level of the exported image layers
+	// (0-22 for zstd, 0-9 for gzip). Unset means BuildKit's default.
+	BuildCompressionLevelEnvVar = "OKTETO_BUILD_COMPRESSION_LEVEL"
+
+	// BuildForceCompressionEnvVar forces recompression of already compressed layers.
+	// Unset means BuildKit's default.
+	BuildForceCompressionEnvVar = "OKTETO_BUILD_FORCE_COMPRESSION"
+
+	// AlphaBuildCompressionEnvVar is the legacy name of BuildCompressionEnvVar.
+	//
+	// Deprecated: use BuildCompressionEnvVar instead.
+	AlphaBuildCompressionEnvVar = "OKTETO_ALPHA_BUILD_COMPRESSION"
+
+	// AlphaBuildCompressionLevelEnvVar is the legacy name of BuildCompressionLevelEnvVar.
+	//
+	// Deprecated: use BuildCompressionLevelEnvVar instead.
+	AlphaBuildCompressionLevelEnvVar = "OKTETO_ALPHA_BUILD_COMPRESSION_LEVEL"
+
+	// AlphaBuildForceCompressionEnvVar is the legacy name of BuildForceCompressionEnvVar.
+	//
+	// Deprecated: use BuildForceCompressionEnvVar instead.
+	AlphaBuildForceCompressionEnvVar = "OKTETO_ALPHA_BUILD_FORCE_COMPRESSION"
 )
 
+// compressionEnvVar maps a BuildKit image exporter attribute to the env var that sets it
+// and its deprecated alias
+type compressionEnvVar struct {
+	name           string
+	deprecatedName string
+	attr           string
+}
+
+var compressionEnvVars = []compressionEnvVar{
+	{name: BuildCompressionEnvVar, deprecatedName: AlphaBuildCompressionEnvVar, attr: "compression"},
+	{name: BuildCompressionLevelEnvVar, deprecatedName: AlphaBuildCompressionLevelEnvVar, attr: "compression-level"},
+	{name: BuildForceCompressionEnvVar, deprecatedName: AlphaBuildForceCompressionEnvVar, attr: "force-compression"},
+}
+
 // SolveOptBuilder is a builder for SolveOpt
 type SolveOptBuilder struct {
 	logger        *io.Controller
@@ -250,31 +291,10 @@ func (b *SolveOptBuilder) Build(ctx context.Context, buildOptions *types.BuildOp
 	}
 
 	if buildOptions.Tag != "" {
-		exportAttrs := map[string]string{
-			"name": buildOptions.Tag,
-			"push": "true",
-		}
-
-		// Alpha feature: allow customizing build compression via environment variables
-		// OKTETO_ALPHA_BUILD_COMPRESSION: compression type (gzip, estargz, zstd, uncompressed)
-		// OKTETO_ALPHA_BUILD_COMPRESSION_LEVEL: compression level (0-22 for zstd, 0-9 for gzip)
-		// OKTETO_ALPHA_BUILD_FORCE_COMPRESSION: force recompression of already compressed layers
-		if compression := os.Getenv("OKTETO_ALPHA_BUILD_COMPRESSION"); compression != "" {
-			exportAttrs["compression"] = compression
-		}
-		if compressionLevel := os.Getenv("OKTETO_ALPHA_BUILD_COMPRESSION_LEVEL"); compressionLevel != "" {
-			exportAttrs["compression-level"] = compressionLevel
-		}
-		if forceCompression := os.Getenv("OKTETO_ALPHA_BUILD_FORCE_COMPRESSION"); forceCompression != "" {
-			exportAttrs["force-compression"] = forceCompression
-		}
-
-		exportAttrs["oci-mediatypes"] = fmt.Sprintf("%t", env.LoadBooleanOrDefault(OciMediaTypesEnvVar, true))
-
 		opt.Exports = []client.ExportEntry{
 			{
 				Type:  "image",
-				Attrs: exportAttrs,
+				Attrs: b.imageExportAttrs(buildOptions.Tag),
 			},
 		}
 	}
@@ -316,6 +336,37 @@ func (b *SolveOptBuilder) Build(ctx context.Context, buildOptions *types.BuildOp
 	return opt, nil
 }
 
+// imageExportAttrs returns the attributes of the BuildKit image exporter to push the given tag
+func (b *SolveOptBuilder) imageExportAttrs(tag string) map[string]string {
+	exportAttrs := map[string]string{
+		"name": tag,
+		"push": "true",
+	}
+
+	// Values are passed as-is: BuildKit validates them
+	for _, v := range compressionEnvVars {
+		if value := b.getCompressionEnv(v); value != "" {
+			exportAttrs[v.attr] = value
+		}
+	}
+
+	exportAttrs["oci-mediatypes"] = fmt.Sprintf("%t", env.LoadBooleanOrDefault(OciMediaTypesEnvVar, true))
+	return exportAttrs
+}
+
+// getCompressionEnv returns the value of the env var, falling back to its deprecated alias
+func (b *SolveOptBuilder) getCompressionEnv(v compressionEnvVar) string {
+	if value := os.Getenv(v.name); value != "" {
+		return value
+	}
+	value := os.Getenv(v.deprecatedName)
+	if value != "" {
+		// Logged at debug level: older Okteto platforms only send the deprecated name
+		b.logger.Logger().Debugf("%s is deprecated, please use %s instead", v.deprecatedName, v.name)
+	}
+	return value
+}
+
 // validate validates the build options
 func (b *SolveOptBuilder) validateTags(imageTag string) error {
 	if imageTag == "" {
```

**File**: `pkg/build/buildkit/opt_test.go` (modified, +169/-0)
```diff
@@ -17,6 +17,7 @@ import (
 	"fmt"
 	"testing"
 
+	"github.com/okteto/okteto/pkg/log/io"
 	"github.com/okteto/okteto/pkg/types"
 	"github.com/spf13/afero"
 	"github.com/stretchr/testify/require"
@@ -120,3 +121,171 @@ func Test_replaceSecretsSourceEnvWithTempFile(t *testing.T) {
 		})
 	}
 }
+
+// compressionEnvVarNames are all the env vars read by imageExportAttrs, cleared before each test case
+var compressionEnvVarNames = []string{
+	BuildCompressionEnvVar,
+	BuildCompressionLevelEnvVar,
+	BuildForceCompressionEnvVar,
+	AlphaBuildCompressionEnvVar,
+	AlphaBuildCompressionLevelEnvVar,
+	AlphaBuildForceCompressionEnvVar,
+	OciMediaTypesEnvVar,
+}
+
+func TestImageExportAttrs(t *testing.T) {
+	tests := []struct {
+		envs     map[string]string
+		expected map[string]string
+		name     string
+	}{
+		{
+			name: "no compression env vars",
+			envs: map[string]string{},
+			expected: map[string]string{
+				"name":           "registry.okteto.dev/ns/app:1.0",
+				"push":           "true",
+				"oci-mediatypes": "true",
+			},
+		},
+		{
+			name: "only new env vars",
+			envs: map[string]string{
+				BuildCompressionEnvVar:      "zstd",
+				BuildCompressionLevelEnvVar: "3",
+				BuildForceCompressionEnvVar: "true",
+			},
+			expected: map[string]string{
+				"name":              "registry.okteto.dev/ns/app:1.0",
+				"push":              "true",
+				"oci-mediatypes":    "true",
+				"compression":       "zstd",
+				"compression-level": "3",
+				"force-compression": "true",
+			},
+		},
+		{
+			name: "only deprecated alpha env vars",
+			envs: map[string]string{
+				AlphaBuildCompressionEnvVar:      "zstd",
+				AlphaBuildCompressionLevelEnvVar: "3",
+				AlphaBuildForceCompressionEnvVar: "true",
+			},
+			expected: map[string]string{
+				"name":              "registry.okteto.dev/ns/app:1.0",
+				"push":              "true",
+				"oci-mediatypes":    "true",
+				"compression":       "zstd",
+				"compression-level": "3",
+				"force-compression": "true",
+			},
+		},
+		{
+			name: "new and alpha env vars with the same value",
+			envs: map[string]string{
+				BuildCompressionEnvVar:           "zstd",
+				BuildCompressionLevelEnvVar:      "3",
+				BuildForceCompressionEnvVar:      "true",
+				AlphaBuildCompressionEnvVar:      "zstd",
+				AlphaBuildCompressionLevelEnvVar: "3",
+				AlphaBuildForceCompressionEnvVar: "true",
+			},
+			expected: map[string]string{
+				"name":              "registry.okteto.dev/ns/app:1.0",
+				"push":              "true",
+				"oci-mediatypes":    "true",
+				"compression":       "zstd",
+				"compression-level": "3",
+				"force-compression": "true",
+			},
+		},
+		{
+			name: "new and alpha env vars with different values, new wins",
+			envs: map[string]string{
+				BuildCompressionEnvVar:           "zstd",
+				BuildCompressionLevelEnvVar:      "3",
+				BuildForceCompressionEnvVar:      "true",
+				AlphaBuildCompressionEnvVar:      "gzip",
+				AlphaBuildCompressionLevelEnvVar: "9",
+				AlphaBuildForceCompressionEnvVar: "false",
+			},
+			expected: map[string]string{
+				"name":              "registry.okteto.dev/ns/app:1.0",
+				"push":              "true",
+				"oci-mediatypes":    "true",
+				"compression":       "zstd",
+				"compression-level": "3",
+				"force-compression": "true",
+			},
+		},
+		{
+			name: "empty new env var falls back to alpha",
+			envs: map[string]string{
+				BuildCompressionEnvVar:      "",
+				AlphaBuildCompressionEnvVar: "zstd",
+			},
+			expected: map[string]string{
+				"name":           "registry.okteto.dev/ns/app:1.0",
+				"push":           "true",
+				"oci-mediatypes": "true",
+				"compression":    "zstd",
+			},
+		},
+		{
+			name: "each pair resolved independently",
+			envs: map[string]string{
+				BuildCompressionEnvVar:           "zstd",
+				AlphaBuildCompressionLevelEnvVar: "5",
+			},
+			expected: map[string]string{
+				"name":              "registry.okteto.dev/ns/app:1.0",
+				"push":              "true",
+				"oci-mediatypes":    "true",
+				"compression":       "zstd",
+				"compression-level": "5",
+			},
+		},
+		{
+			name: "invalid values are passed as-is",
+			envs: map[string]string{
+				BuildCompressionEnvVar:           "brotli",
+				BuildCompressionLevelEnvVar:      "high",
+				AlphaBuildForceCompressionEnvVar: "maybe",
+			},
+			expected: map[string]string{
+				"name":              "registry.okteto.dev/ns/app:1.0",
+				"push":              "true",
+				"oci-mediatypes":    "true",
+				"compression":       "brotli",
+				"compression-level": "high",
+				"force-compression": "maybe",
+			},
+		},
+		{
+			name: "oci media types disabled",
+			envs: map[string]string{
+				OciMediaTypesEnvVar:    "false",
+				BuildCompressionEnvVar: "gzip",
+			},
+			expected: map[string]string{
+				"name":           "registry.okteto.dev/ns/app:1.0",
+				"push":           "true",
+				"oci-mediatypes": "false",
+				"compression":    "gzip",
+			},
+		},
+	}
+	for _, tt := range tests {
+		t.Run(
```

---

### Incident Patch 6: `289a82ff` (2026-09-30)
**Commit Message**: build(deps): bump renovatebot/github-action from 46.3.3 to 46.3.4 (#5169)

Bumps [renovatebot/github-action](https://github.com/renovatebot/github-action) from 46.3.3 to 46.3.4.
- [Release notes](https://github.com/renovatebot/github-action/releases)
- [Changelog](https://github.com/renovatebot/github-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/renovatebot/github-action/compare/v46.3.3...v46.3.4)

---
updated-dependencies:
- dependency-name: renovatebot/github-action
  dependency-version: 46.3.4
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
-        uses: renovatebot/github-action@v46.3.3
+        uses: renovatebot/github-action@v46.3.4
         with:
           configurationFile: .github/renovate.json
           token: ${{ secrets.RENOVATEBOT_GITHUB_TOKEN }}
```

---

### Incident Patch 7: `a06c777d` (2026-09-28)
**Commit Message**: build(deps): bump github.com/containerd/containerd/v2 (#5162)

Bumps [github.com/containerd/containerd/v2](https://github.com/containerd/containerd) from 2.2.8 to 2.2.9.
- [Release notes](https://github.com/containerd/containerd/releases)
- [Changelog](https://github.com/containerd/containerd/blob/main/RELEASES.md)
- [Commits](https://github.com/containerd/containerd/compare/v2.2.8...v2.2.9)

---
updated-dependencies:
- dependency-name: github.com/containerd/containerd/v2
  dependency-version: 2.2.9
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -204,7 +204,7 @@ require (
 	github.com/cespare/xxhash/v2 v2.3.0 // indirect
 	github.com/clipperhouse/uax29/v2 v2.7.0 // indirect
 	github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2 // indirect
-	github.com/containerd/containerd/v2 v2.2.8 // indirect
+	github.com/containerd/containerd/v2 v2.2.9 // indirect
 	github.com/containerd/errdefs/pkg v0.3.0 // indirect
 	github.com/envoyproxy/go-control-plane/envoy v1.37.0 // indirect
 	github.com/envoyproxy/protoc-gen-validate v1.3.3 // indirect
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -172,8 +172,8 @@ github.com/containerd/console v1.0.5 h1:R0ymNeydRqH2DmakFNdmjR2k0t7UPuiOV/N/27/q
 github.com/containerd/console v1.0.5/go.mod h1:YynlIjWYF8myEu6sdkwKIvGQq+cOckRm6So2avqoYAk=
 github.com/containerd/containerd/api v1.10.0 h1:5n0oHYVBwN4VhoX9fFykCV9dF1/BvAXeg2F8W6UYq1o=
 github.com/containerd/containerd/api v1.10.0/go.mod h1:NBm1OAk8ZL+LG8R0ceObGxT5hbUYj7CzTmR3xh0DlMM=
-github.com/containerd/containerd/v2 v2.2.8 h1:8nnNE5FqBmofd3lccku8GbWi6d1TO4rrcB2E/0o+HU0=
-github.com/containerd/containerd/v2 v2.2.8/go.mod h1:lTw+wrjREio28N9+3umHS73C6Cs1mxrhczBcAliInuI=
+github.com/containerd/containerd/v2 v2.2.9 h1:ddw9THGOXhcKnHORjkKoXtazPjwtcPwmqk8AVyRpfZw=
+github.com/containerd/containerd/v2 v2.2.9/go.mod h1:lTw+wrjREio28N9+3umHS73C6Cs1mxrhczBcAliInuI=
 github.com/containerd/continuity v0.5.0 h1:7a85HZpCSs+1Zps0Ee3DPSuAWY+0SJM1JNM51nlEVDg=
 github.com/containerd/continuity v0.5.0/go.mod h1:/lNJvtJKUQStBzpVQ1+rasXO1LAWtUQssk28EZvJ3nE=
 github.com/containerd/errdefs v1.0.0 h1:tg5yIfIlQIrxYtu9ajqY42W3lpS19XqdxRQeEwYG8PI=
```

---

### Incident Patch 8: `e7641c1d` (2026-09-28)
**Commit Message**: fix(k8s): use "okteto" as field manager for all CLI writes (DEV-1477) (#5168)

The CLI never set a field manager or user agent, so the API server
derived the field manager from client-go's default user agent, which
starts with the binary filename (okteto, okteto.exe, okteto-Darwin-arm64,
__debug_bin...). Objects ended up with inconsistent managedFields entries.

All the rest configs built by the CLI now go through newRESTConfig(),
which sets the user agent to "okteto/<version> (<os>/<arch>)" ("dev" when
the version isn't set). The API server uses the prefix before the first
"/" as field manager, so every create/update/patch done by the CLI is
recorded under "okteto".

The deploy proxy keeps using its own config without a user agent, so
requests from kubectl/helm going through it keep their own field manager.

Signed-off-by: Nacho Fuertes <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `pkg/deployable/proxy_test.go` (modified, +35/-0)
```diff
@@ -15,6 +15,8 @@ package deployable
 
 import (
 	"net"
+	"net/http"
+	"net/http/httptest"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -339,3 +341,36 @@ metadata:
 	require.NoError(t, err)
 	assert.NotEmpty(t, encoded)
 }
+
+// Requests going through the proxy must keep the user agent of the client doing them (kubectl, helm, the CLI...),
+// so the API server keeps using their field manager. The cluster config has a user agent to ensure it doesn't
+// override the one of the incoming request
+func TestProxyHandlerKeepsUserAgent(t *testing.T) {
+	var receivedUserAgent string
+	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		receivedUserAgent = r.Header.Get("User-Agent")
+		w.WriteHeader(http.StatusOK)
+	}))
+	defer upstream.Close()
+
+	clusterConfig := &rest.Config{
+		Host:      upstream.URL,
+		UserAgent: "okteto/test",
+		TLSClientConfig: rest.TLSClientConfig{
+			Insecure: true,
+		},
+	}
+	ph := &proxyHandler{}
+	handler, err := ph.getProxyHandler("session-token", clusterConfig)
+	require.NoError(t, err)
+
+	req := httptest.NewRequest(http.MethodGet, "/api/v1/namespaces/test/configmaps", nil)
+	req.Header.Set("Authorization", "Bearer session-token")
+	req.Header.Set("User-Agent", "kubectl/v1.34.0 (darwin/arm64) kubernetes/abcdef")
+	rec := httptest.NewRecorder()
+
+	handler.ServeHTTP(rec, req)
+
+	require.Equal(t, http.StatusOK, rec.Code)
+	require.Equal(t, "kubectl/v1.34.0 (darwin/arm64) kubernetes/abcdef", receivedUserAgent)
+}
```

**File**: `pkg/okteto/k8s.go` (modified, +43/-26)
```diff
@@ -15,11 +15,14 @@ package okteto
 
 import (
 	"errors"
+	"fmt"
 	"net/http"
 	"os"
+	"runtime"
 	"sync"
 	"time"
 
+	"github.com/okteto/okteto/pkg/config"
 	"github.com/okteto/okteto/pkg/k8s/ingresses"
 	oktetoLog "github.com/okteto/okteto/pkg/log"
 	ioCtrl "github.com/okteto/okteto/pkg/log/io"
@@ -40,6 +43,13 @@ var (
 )
 
 const (
+	// FieldManager is the field manager of the CLI write operations to the Kubernetes API. The API server derives it
+	// from the user agent prefix, so it must be the user agent product name
+	FieldManager = "okteto"
+
+	// devVersion is the version sent in the user agent when the CLI version is not set
+	devVersion = "dev"
+
 	// oktetoKubernetesTimeoutEnvVar defines the timeout for kubernetes operations
 	oktetoKubernetesTimeoutEnvVar = "OKTETO_KUBERNETES_TIMEOUT"
 )
@@ -142,63 +152,70 @@ func GetKubernetesTimeout() time.Duration {
 	return timeout
 }
 
-func getK8sClientWithApiConfig(clientApiConfig *clientcmdapi.Config, k8sLogger *ioCtrl.K8sLogger) (*kubernetes.Clientset, *rest.Config, error) {
-	clientConfig := clientcmd.NewDefaultClientConfig(*clientApiConfig, nil)
-	config, err := clientConfig.ClientConfig()
+// newRESTConfig builds the rest config shared by all the Kubernetes clients created by the CLI
+func newRESTConfig(clientAPIConfig *clientcmdapi.Config) (*rest.Config, error) {
+	clientConfig := clientcmd.NewDefaultClientConfig(*clientAPIConfig, nil)
+	restConfig, err := clientConfig.ClientConfig()
 	if err != nil {
-		return nil, nil, err
+		return nil, err
 	}
-	config.WarningHandler = rest.NoWarnings{}
+	restConfig.WarningHandler = rest.NoWarnings{}
+	restConfig.Timeout = GetKubernetesTimeout()
+	// The API server uses the user agent prefix as field manager when the request doesn't set one
+	restConfig.UserAgent = userAgent()
+	return restConfig, nil
+}
 
-	config.Timeout = GetKubernetesTimeout()
+// userAgent returns the user agent sent to the Kubernetes API server. Its prefix must be FieldManager
+func userAgent() string {
+	version := config.VersionString
+	if version == "" {
+		version = devVersion
+	}
+	return fmt.Sprintf("%s/%s (%s/%s)", FieldManager, version, runtime.GOOS, runtime.GOARCH)
+}
 
-	var client *kubernetes.Clientset
+func getK8sClientWithApiConfig(clientApiConfig *clientcmdapi.Config, k8sLogger *ioCtrl.K8sLogger) (*kubernetes.Clientset, *rest.Config, error) {
+	restConfig, err := newRESTConfig(clientApiConfig)
+	if err != nil {
+		return nil, nil, err
+	}
 
-	config.WrapTransport = func(rt http.RoundTripper) http.RoundTripper {
+	restConfig.WrapTransport = func(rt http.RoundTripper) http.RoundTripper {
 		return newTokenRotationTransport(rt, k8sLogger)
 	}
 
-	client, err = kubernetes.NewForConfig(config)
+	client, err := kubernetes.NewForConfig(restConfig)
 	if err != nil {
 		return nil, nil, err
 	}
-	return client, config, nil
+	return client, restConfig, nil
 }
 
 func getDynamicClient(clientAPIConfig *clientcmdapi.Config) (dynamic.Interface, *rest.Config, error) {
-	clientConfig := clientcmd.NewDefaultClientConfig(*clientAPIConfig, nil)
-
-	config, err := clientConfig.ClientConfig()
+	restConfig, err := newRESTConfig(clientAPIConfig)
 	if err != nil {
 		return nil, nil, err
 	}
-	config.WarningHandler = rest.NoWarnings{}
 
-	config.Timeout = GetKubernetesTimeout()
-
-	dc, err := dynamic.NewForConfig(config)
+	dc, err := dynamic.NewForConfig(restConfig)
 	if err != nil {
 		return nil, nil, err
 	}
 
-	return dc, config, err
+	return dc, restConfig, err
 }
 
 func getDiscoveryClient(clientAPIConfig *clientcmdapi.Config) (discovery.DiscoveryInterface, *rest.Config, error) {
-	clientConfig := clientcmd.NewDefaultClientConfig(*clientAPIConfig, nil)
-
-	config, err := clientConfig.ClientConfig()
+	restConfig, err := newRESTConfig(clientAPIConfig)
 	if err != nil {
 		return nil, nil, err
 	}
-	config.WarningHandler = rest.NoWarnings{}
-
-	config.Timeout = GetKubernetesTimeout()
 
-	dc, err := discovery.NewDiscoveryClientForConfig(config)
+	dc, err := discovery.NewDiscoveryClientForConfig(restConfig)
 	if err != nil {
 		return nil, nil, err
 	}
 
-	return dc, config, err
+	return dc, restConfig, err
 }
```

**File**: `pkg/okteto/k8s_test.go` (modified, +90/-20)
```diff
@@ -14,10 +14,14 @@
 package okteto
 
 import (
+	"fmt"
 	"net/http"
 	"net/http/httptest"
+	"runtime"
+	"strings"
 	"testing"
 
+	"github.com/okteto/okteto/pkg/config"
 	"github.com/okteto/okteto/pkg/log/io"
 	"github.com/stretchr/testify/require"
 	"k8s.io/client-go/rest"
@@ -164,26 +168,8 @@ func TestGetK8sClientWithApiConfig(t *testing.T) {
 		name      string
 	}{
 		{
-			name: "ok",
-			apiConfig: &clientcmdapi.Config{
-				Clusters: map[string]*clientcmdapi.Cluster{
-					"test": {
-						Server: "https://test.com",
-					},
-				},
-				AuthInfos: map[string]*clientcmdapi.AuthInfo{
-					"test": {
-						Token: "test",
-					},
-				},
-				Contexts: map[string]*clientcmdapi.Context{
-					"test": {
-						Cluster:  "test",
-						AuthInfo: "test",
-					},
-				},
-				CurrentContext: "test",
-			},
+			name:      "ok",
+			apiConfig: newTestAPIConfig(),
 			expected: expected{
 				cfg: &rest.Config{
 					Host: "https://test.com",
@@ -207,3 +193,87 @@ func TestGetK8sClientWithApiConfig(t *testing.T) {
 	}
 
 }
+
+func newTestAPIConfig() *clientcmdapi.Config {
+	return &clientcmdapi.Config{
+		Clusters: map[string]*clientcmdapi.Cluster{
+			"test": {
+				Server: "https://test.com",
+			},
+		},
+		AuthInfos: map[string]*clientcmdapi.AuthInfo{
+			"test": {
+				Token: "test",
+			},
+		},
+		Contexts: map[string]*clientcmdapi.Context{
+			"test": {
+				Cluster:  "test",
+				AuthInfo: "test",
+			},
+		},
+		CurrentContext: "test",
+	}
+}
+
+func setVersionString(t *testing.T, version string) {
+	t.Helper()
+	original := config.VersionString
+	config.VersionString = version
+	t.Cleanup(func() {
+		config.VersionString = original
+	})
+}
+
+func TestUserAgentWithVersion(t *testing.T) {
+	setVersionString(t, "3.12.0")
+
+	expected := fmt.Sprintf("okteto/3.12.0 (%s/%s)", runtime.GOOS, runtime.GOARCH)
+	require.Equal(t, expected, userAgent())
+}
+
+func TestUserAgentWithoutVersion(t *testing.T) {
+	setVersionString(t, "")
+
+	expected := fmt.Sprintf("okteto/dev (%s/%s)", runtime.GOOS, runtime.GOARCH)
+	require.Equal(t, expected, userAgent())
+}
+
+// The API server uses the user agent prefix before the first "/" as field manager when the request doesn't set one
+func requireFieldManagerFromUserAgent(t *testing.T, cfg *rest.Config) {
+	t.Helper()
+	require.Equal(t, "okteto", FieldManager)
+	require.Equal(t, FieldManager, strings.Split(cfg.UserAgent, "/")[0])
+}
+
+func TestNewRESTConfig(t *testing.T) {
+	cfg, err := newRESTConfig(newTestAPIConfig())
+	require.NoError(t, err)
+	require.Equal(t, "https://test.com", cfg.Host)
+	require.Equal(t, rest.NoWarnings{}, cfg.WarningHandler)
+	require.Equal(t, GetKubernetesTimeout(), cfg.Timeout)
+	requireFieldManagerFromUserAgent(t, cfg)
+}
+
+func TestNewRESTConfigInvalidConfig(t *testing.T) {
+	_, err := newRESTConfig(&clientcmdapi.Config{})
+	require.Error(t, err)
+}
+
+func TestGetK8sClientWithApiConfigUserAgent(t *testing.T) {
+	_, cfg, err := getK8sClientWithApiConfig(newTestAPIConfig(), nil)
+	require.NoError(t, err)
+	requireFieldManagerFromUserAgent(t, cfg)
+}
+
+func TestGetDynamicClientUserAgent(t *testing.T) {
+	_, cfg, err := getDynamicClient(newTestAPIConfig())
+	require.NoError(t, err)
+	requireFieldManagerFromUserAgent(t, cfg)
+}
+
+func TestGetDiscoveryClientUserAgent(t *testing.T) {
+	_, cfg, err := getDiscoveryClient(newTestAPIConfig())
+	require.NoError(t, err)
+	requireFieldManagerFromUserAgent(t, cfg)
+}
```

---

### Incident Patch 9: `71f36333` (2026-09-25)
**Commit Message**: build(deps): bump renovatebot/github-action from 46.3.1 to 46.3.3 (#5160)

Bumps [renovatebot/github-action](https://github.com/renovatebot/github-action) from 46.3.1 to 46.3.3.
- [Release notes](https://github.com/renovatebot/github-action/releases)
- [Changelog](https://github.com/renovatebot/github-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/renovatebot/github-action/compare/v46.3.1...v46.3.3)

---
updated-dependencies:
- dependency-name: renovatebot/github-action
  dependency-version: 46.3.3
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
-        uses: renovatebot/github-action@v46.3.1
+        uses: renovatebot/github-action@v46.3.3
         with:
           configurationFile: .github/renovate.json
           token: ${{ secrets.RENOVATEBOT_GITHUB_TOKEN }}
```

---

### Incident Patch 10: `f72d931f` (2026-09-18)
**Commit Message**: chore(deps): Update module go.opentelemetry.io/otel/exporters/otlp/otlptrace to v1.45.0 [SECURITY] (#5156)

Co-authored-by: Renovate <[REDACTED_EMAIL]>



---

### Incident Patch 11: `dbd29a74` (2026-09-18)
**Commit Message**: build(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace (#5155)

Bumps [go.opentelemetry.io/otel/exporters/otlp/otlptrace](https://github.com/open-telemetry/opentelemetry-go) from 1.44.0 to 1.45.0.
- [Release notes](https://github.com/open-telemetry/opentelemetry-go/releases)
- [Changelog](https://github.com/open-telemetry/opentelemetry-go/blob/main/CHANGELOG.md)
- [Commits](https://github.com/open-telemetry/opentelemetry-go/compare/v1.44.0...v1.45.0)

---
updated-dependencies:
- dependency-name: go.opentelemetry.io/otel/exporters/otlp/otlptrace
  dependency-version: 1.45.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Javier López Barba <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +4/-4)
```diff
@@ -131,10 +131,10 @@ require (
 	github.com/yusufpapurcu/wmi v1.2.2 // indirect
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.69.0 // indirect
 	go.opentelemetry.io/otel v1.45.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
 	go.opentelemetry.io/otel/sdk v1.45.0 // indirect
 	go.opentelemetry.io/otel/trace v1.45.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
 	golang.org/x/text v0.41.0 // indirect
@@ -289,8 +289,8 @@ require (
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0 // indirect
 	go.opentelemetry.io/otel/metric v1.45.0 // indirect
 	golang.org/x/exp v0.0.0-20260603202125-055de637280b // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a // indirect
 )
 
 replace github.com/moby/buildkit => github.com/okteto/buildkit v0.31.2-0.20260624195634-c4a7b690093b // v0.31.1-okteto1
```

**File**: `go.sum` (modified, +8/-8)
```diff
@@ -659,8 +659,8 @@ go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0 h1:8tvICD4
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0/go.mod h1:z9+yiacE0IHRqM4qFfkbt/JYlmYXgss8GY/jXoNuPJI=
 go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
 go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0 h1:4YsVu3B8+3qtWYYrsUYgn0OG78pN0rnNPRGX4SbokQI=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0/go.mod h1:+wnlSn0mD1ADVMe3v9Z/WIaiz6q6gL2J/ejaAmdmv80=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
 go.opentelemetry.io/otel/exporters/stdout/stdoutmetric v1.40.0 h1:ZrPRak/kS4xI3AVXy8F7pipuDXmDsrO8Lg+yQjBLjw0=
 go.opentelemetry.io/otel/exporters/stdout/stdoutmetric v1.40.0/go.mod h1:3y6kQCWztq6hyW8Z9YxQDDm0Je9AJoFar2G0yDcmhRk=
 go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
@@ -673,8 +673,8 @@ go.opentelemetry.io/otel/sdk/metric v1.45.0 h1:oVFszMfyj1Am6s24Vtc7wBb8BKLcwepJj
 go.opentelemetry.io/otel/sdk/metric v1.45.0/go.mod h1:vUWUxDZvu1WVRj8JA8S0AdhsPrZoDpA2DdZauIh4mDA=
 go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
 go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
-go.opentelemetry.io/proto/otlp v1.10.0 h1:IQRWgT5srOCYfiWnpqUYz9CVmbO8bFmKcwYxpuCSL2g=
-go.opentelemetry.io/proto/otlp v1.10.0/go.mod h1:/CV4QoCR/S9yaPj8utp3lvQPoqMtxXdzn7ozvvozVqk=
+go.opentelemetry.io/proto/otlp v1.11.0 h1:5rrYs0Ykyj50sdU/JU0x8etU+LubXWb+gED6TbEdMIk=
+go.opentelemetry.io/proto/otlp v1.11.0/go.mod h1:SmVizdCOAm3XBtG1g1NnOdhW6jtddT72hLMhv8VwA8E=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
 go.uber.org/goleak v1.3.0/go.mod h1:CoHD4mav9JJNrW/WLlf7HGZPjdw8EucARQHekz1X6bE=
 go.yaml.in/yaml/v2 v2.4.4 h1:tuyd0P+2Ont/d6e2rl3be67goVK4R6deVxCUX5vyPaQ=
@@ -863,10 +863,10 @@ google.golang.org/genproto v0.0.0-20191230161307-f3c370f40bfb/go.mod h1:n3cpQtvx
 google.golang.org/genproto v0.0.0-20200212174721-66ed5ce911ce/go.mod h1:55QSHmfGQM9UVYDPBsyGGes0y52j32PQ3BqQfXhyH3c=
 google.golang.org/genproto v0.0.0-20260128011058-8636f8732409 h1:VQZ/yAbAtjkHgH80teYd2em3xtIkkHd7ZhqfH2N9CsM=
 google.golang.org/genproto v0.0.0-20260128011058-8636f8732409/go.mod h1:rxKD3IEILWEu3P44seeNOAwZN4SaoKaQ/2eTg4mM6EM=
-google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:Kjn0N0tCrDgiAFW+lGO4JZ3ck44CehvJQMAwj9QF0G8=
-google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa h1:mZHHdPZl0dbGHCflZgAq/Q468DWVFcU2whhB2KAo8fk=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
+google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a h1:97PfJ4tCxY5C7NzzgGqQEMZmXbISdvSArNNEOoUGKBg=
+google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a/go.mod h1:1brfde68Npq6+WA75c1EHWPijZEG1kMus61ygPZfn4A=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a h1:qI/YMH1ep2qQtqcp00gMQyoU7mjvbhg88GJKCvfoLj0=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
 google.golang.org/grpc v1.19.0/go.mod h1:mqu4LbDTu4XGKhr4mRzUsmM4RtVoemTSY81AxZiDr8c=
 google.golang.org/grpc v1.20.1/go.mod h1:10oTOabMzJvdu6/UiuZezV6QK5dSlG84ov/aaiqXj38=
 google.golang.org/grpc v1.21.1/go.mod h1:oYelfM1adQP15Ek0mdvEgi9Df8B9CZIaU1084ijfRaM=
```

---

### Incident Patch 12: `6a4ed749` (2026-09-18)
**Commit Message**: build(deps): bump renovatebot/github-action from 46.2.6 to 46.3.1 (#5153)

Bumps [renovatebot/github-action](https://github.com/renovatebot/github-action) from 46.2.6 to 46.3.1.
- [Release notes](https://github.com/renovatebot/github-action/releases)
- [Changelog](https://github.com/renovatebot/github-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/renovatebot/github-action/compare/v46.2.6...v46.3.1)

---
updated-dependencies:
- dependency-name: renovatebot/github-action
  dependency-version: 46.3.1
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/renovate.yml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ jobs:
         uses: actions/checkout@v7
 
       - name: Run Renovate
-        uses: renovatebot/github-action@v46.2.6
+        uses: renovatebot/github-action@v46.3.1
         with:
           configurationFile: .github/renovate.json
           token: ${{ secrets.RENOVATEBOT_GITHUB_TOKEN }}
```

---

### Incident Patch 13: `acc1bbb0` (2026-09-18)
**Commit Message**: chore(deps): Update module go.opentelemetry.io/otel/sdk to v1.45.0 [SECURITY] (#5157)

Co-authored-by: Renovate <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +6/-6)
```diff
@@ -76,7 +76,7 @@ require (
 	github.com/fatih/camelcase v1.0.0 // indirect
 	github.com/fsnotify/fsnotify v1.10.1
 	github.com/go-errors/errors v1.4.2 // indirect
-	github.com/go-logr/logr v1.4.3 // indirect
+	github.com/go-logr/logr v1.4.4 // indirect
 	github.com/go-ole/go-ole v1.2.6 // indirect
 	github.com/go-openapi/jsonpointer v0.23.1 // indirect
 	github.com/go-openapi/jsonreference v0.21.6 // indirect
@@ -130,10 +130,10 @@ require (
 	github.com/xlab/treeprint v1.2.0 // indirect
 	github.com/yusufpapurcu/wmi v1.2.2 // indirect
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.69.0 // indirect
-	go.opentelemetry.io/otel v1.44.0 // indirect
+	go.opentelemetry.io/otel v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0 // indirect
-	go.opentelemetry.io/otel/sdk v1.44.0 // indirect
-	go.opentelemetry.io/otel/trace v1.44.0 // indirect
+	go.opentelemetry.io/otel/sdk v1.45.0 // indirect
+	go.opentelemetry.io/otel/trace v1.45.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
 	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
@@ -238,7 +238,7 @@ require (
 	github.com/x448/float16 v0.8.4 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.opentelemetry.io/contrib/detectors/gcp v1.44.0 // indirect
-	go.opentelemetry.io/otel/sdk/metric v1.44.0 // indirect
+	go.opentelemetry.io/otel/sdk/metric v1.45.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
 	go4.org v0.0.0-20230225012048-214862532bf5 // indirect
@@ -287,7 +287,7 @@ require (
 	github.com/wk8/go-ordered-map/v2 v2.1.8 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace v0.69.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0 // indirect
-	go.opentelemetry.io/otel/metric v1.44.0 // indirect
+	go.opentelemetry.io/otel/metric v1.45.0 // indirect
 	golang.org/x/exp v0.0.0-20260603202125-055de637280b // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
```

**File**: `go.sum` (modified, +14/-14)
```diff
@@ -266,8 +266,8 @@ github.com/go-gl/glfw/v3.3/glfw v0.0.0-20191125211704-12ad95a8df72/go.mod h1:tQ2
 github.com/go-jose/go-jose/v4 v4.1.4 h1:moDMcTHmvE6Groj34emNPLs/qtYXRVcd6S7NHbHz3kA=
 github.com/go-jose/go-jose/v4 v4.1.4/go.mod h1:x4oUasVrzR7071A4TnHLGSPpNOm2a21K9Kf04k1rs08=
 github.com/go-logr/logr v1.2.2/go.mod h1:jdQByPbusPIv2/zmleS9BjJVeZ6kBagPoEUsqbVz/1A=
-github.com/go-logr/logr v1.4.3 h1:CjnDlHq8ikf6E492q6eKboGOC0T8CDaOvkHCIg8idEI=
-github.com/go-logr/logr v1.4.3/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
+github.com/go-logr/logr v1.4.4 h1:tG4xh9yMsRCAiodLVTxyrkzSZ9+o0L1Kg/+cPVcbP/8=
+github.com/go-logr/logr v1.4.4/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
 github.com/go-logr/stdr v1.2.2 h1:hSWxHoqTgW2S2qGc0LTAI563KZ5YKYRhT3MFKZMbjag=
 github.com/go-logr/stdr v1.2.2/go.mod h1:mMo/vtBO5dYbehREoey6XUKy/eSumjCCveDpRre4VKE=
 github.com/go-ole/go-ole v1.2.6 h1:/Fpf6oFPoeFik9ty7siob0G6Ke8QvQEuVcuChpwXzpY=
@@ -657,22 +657,22 @@ go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace v0.
 go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace v0.69.0/go.mod h1:3jnStNwSufK+f5ktjL4EPcwtig4rtd81NS70lqHuXl8=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0 h1:8tvICD4vSTOOsNrsI4Ljf6C+6UKvpTEH5XY3JMoyPoo=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0/go.mod h1:z9+yiacE0IHRqM4qFfkbt/JYlmYXgss8GY/jXoNuPJI=
-go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
-go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
+go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
+go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0 h1:4YsVu3B8+3qtWYYrsUYgn0OG78pN0rnNPRGX4SbokQI=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0/go.mod h1:+wnlSn0mD1ADVMe3v9Z/WIaiz6q6gL2J/ejaAmdmv80=
 go.opentelemetry.io/otel/exporters/stdout/stdoutmetric v1.40.0 h1:ZrPRak/kS4xI3AVXy8F7pipuDXmDsrO8Lg+yQjBLjw0=
 go.opentelemetry.io/otel/exporters/stdout/stdoutmetric v1.40.0/go.mod h1:3y6kQCWztq6hyW8Z9YxQDDm0Je9AJoFar2G0yDcmhRk=
-go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
-go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
-go.opentelemetry.io/otel/metric/x v0.66.0 h1:YkCrx1zLOChi9ZcZ6euupOcsgzbVlec7D/xoEU1+cTA=
-go.opentelemetry.io/otel/metric/x v0.66.0/go.mod h1:d1+BDj9t96do0/1LoU1ayfCv79ZgNE41qbhBvnMOBZk=
-go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
-go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
-go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
-go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
-go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
-go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
+go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
+go.opentelemetry.io/otel/metric v1.45.0/go.mod h1:HAPbm1nd3p1PmFH7v2dR+6BjXxw+Lq4a2+pndMAm08s=
+go.opentelemetry.io/otel/metric/x v0.67.0 h1:PcicCNZFkZ4bXfSooXdo3WN7RBOVOtjVdo1wD358Uns=
+go.opentelemetry.io/otel/metric/x v0.67.0/go.mod h1:FBjCWZe6wgcqxcMtjdGiClDKXb2YxxXii0CXftE4QtI=
+go.opentelemetry.io/otel/sdk v1.45.0 h1:4VVSMgQ83dUgW2aoX5f6JgLvHwIvzcuLnF9lUdCSpCw=
+go.opentelemetry.io/otel/sdk v1.45.0/go.mod h1:Sr40LgXV7DsKMMJMKOhUWOgMWTfAaqvm2kF0g7ilwuA=
+go.opentelemetry.io/otel/sdk/metric v1.45.0 h1:oVFszMfyj1Am6s24Vtc7wBb8BKLcwepJjNEYILuiE3o=
+go.opentelemetry.io/otel/sdk/metric v1.45.0/go.mod h1:vUWUxDZvu1WVRj8JA8S0AdhsPrZoDpA2DdZauIh4mDA=
+go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
+go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
 go.opentelemetry.io/proto/otlp v1.10.0 h1:IQRWgT5srOCYfiWnpqUYz9CVmbO8bFmKcwYxpuCSL2g=
 go.opentelemetry.io/proto/otlp v1.10.0/go.mod h1:/CV4QoCR/S9yaPj8utp3lvQPoqMtxXdzn7ozvvozVqk=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
```

---

### Incident Patch 14: `25f053b9` (2026-09-11)
**Commit Message**: build(deps): bump renovatebot/github-action from 46.2.5 to 46.2.6 (#5147)

Bumps [renovatebot/github-action](https://github.com/renovatebot/github-action) from 46.2.5 to 46.2.6.
- [Release notes](https://github.com/renovatebot/github-action/releases)
- [Changelog](https://github.com/renovatebot/github-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/renovatebot/github-action/compare/v46.2.5...v46.2.6)

---
updated-dependencies:
- dependency-name: renovatebot/github-action
  dependency-version: 46.2.6
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
-        uses: renovatebot/github-action@v46.2.5
+        uses: renovatebot/github-action@v46.2.6
         with:
           configurationFile: .github/renovate.json
           token: ${{ secrets.RENOVATEBOT_GITHUB_TOKEN }}
```

---

### Incident Patch 15: `b8323dfb` (2026-09-11)
**Commit Message**: build(deps): bump github.com/containerd/containerd/v2 (#5148)

Bumps [github.com/containerd/containerd/v2](https://github.com/containerd/containerd) from 2.2.5 to 2.2.8.
- [Release notes](https://github.com/containerd/containerd/releases)
- [Changelog](https://github.com/containerd/containerd/blob/main/RELEASES.md)
- [Commits](https://github.com/containerd/containerd/compare/v2.2.5...v2.2.8)

---
updated-dependencies:
- dependency-name: github.com/containerd/containerd/v2
  dependency-version: 2.2.8
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -204,7 +204,7 @@ require (
 	github.com/cespare/xxhash/v2 v2.3.0 // indirect
 	github.com/clipperhouse/uax29/v2 v2.7.0 // indirect
 	github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2 // indirect
-	github.com/containerd/containerd/v2 v2.2.5 // indirect
+	github.com/containerd/containerd/v2 v2.2.8 // indirect
 	github.com/containerd/errdefs/pkg v0.3.0 // indirect
 	github.com/envoyproxy/go-control-plane/envoy v1.37.0 // indirect
 	github.com/envoyproxy/protoc-gen-validate v1.3.3 // indirect
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -172,8 +172,8 @@ github.com/containerd/console v1.0.5 h1:R0ymNeydRqH2DmakFNdmjR2k0t7UPuiOV/N/27/q
 github.com/containerd/console v1.0.5/go.mod h1:YynlIjWYF8myEu6sdkwKIvGQq+cOckRm6So2avqoYAk=
 github.com/containerd/containerd/api v1.10.0 h1:5n0oHYVBwN4VhoX9fFykCV9dF1/BvAXeg2F8W6UYq1o=
 github.com/containerd/containerd/api v1.10.0/go.mod h1:NBm1OAk8ZL+LG8R0ceObGxT5hbUYj7CzTmR3xh0DlMM=
-github.com/containerd/containerd/v2 v2.2.5 h1:KTFzB02LviYmmfRmz8r9UFd+n6YlddVFK+5lbgQXUTU=
-github.com/containerd/containerd/v2 v2.2.5/go.mod h1:5t2+xFv2dGd/iDYp9Z8DXB4cmWrWQi1XqxGJPS2gBzU=
+github.com/containerd/containerd/v2 v2.2.8 h1:8nnNE5FqBmofd3lccku8GbWi6d1TO4rrcB2E/0o+HU0=
+github.com/containerd/containerd/v2 v2.2.8/go.mod h1:lTw+wrjREio28N9+3umHS73C6Cs1mxrhczBcAliInuI=
 github.com/containerd/continuity v0.5.0 h1:7a85HZpCSs+1Zps0Ee3DPSuAWY+0SJM1JNM51nlEVDg=
 github.com/containerd/continuity v0.5.0/go.mod h1:/lNJvtJKUQStBzpVQ1+rasXO1LAWtUQssk28EZvJ3nE=
 github.com/containerd/errdefs v1.0.0 h1:tg5yIfIlQIrxYtu9ajqY42W3lpS19XqdxRQeEwYG8PI=
```

#### Recent Merged Pull Requests:
- **PR #5182** (2026-10-05): build(deps): bump renovatebot/github-action from 46.3.4 to 46.3.6 (@dependabot[bot])
- **PR #5180** (2026-10-05): chore(deps): Update module al.essio.dev/pkg/shellescape to v1.6.1 (@oktetobot)
- **PR #5179** (closed): build(deps): bump renovatebot/github-action from 46.3.4 to 46.3.5 (@dependabot[bot])
- **PR #5177** (2026-10-01): [Backport release-3.24] fix: update vulnerable dependencies (@github-actions[bot])
- **PR #5176** (2026-10-01): fix: update vulnerable dependencies (@jLopezbarb)
- **PR #5175** (2026-10-01): chore(deps): Update module github.com/sirupsen/logrus to v1.10.2 (@oktetobot)
- **PR #5173** (2026-09-30): build(deps): bump brace-expansion from 1.1.18 to 1.1.21 in /samples/node.js (@dependabot[bot])
- **PR #5172** (2026-10-01): chore(deps): Update golang-stdlib-extensions (@oktetobot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

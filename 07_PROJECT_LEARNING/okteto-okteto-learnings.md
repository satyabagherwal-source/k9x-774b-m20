# Forensic Learning Record (Deep Inspection): okteto/okteto

> **Canonical Artifact**: `07_PROJECT_LEARNING/okteto-okteto-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/okteto/okteto](https://github.com/okteto/okteto))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:40:25.535Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `okteto/okteto`
- **Description**: Develop your applications directly in your Kubernetes Cluster
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3549 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/analytics.go`
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

package cmd

import (
	"github.com/okteto/okteto/cmd/utils"
	"github.com/okteto/okteto/pkg/analytics"
	oktetoLog "github.com/okteto/okteto/pkg/log"
	"github.com/spf13/cobra"
)

// Analytics turns analytics on/off
func Analytics() *cobra.Command {
	var disable bool
	cmd := &cobra.Command{
		Args:  utils.NoArgsAccepted("https://okteto.com/docs/reference/okteto-cli/#analytics"),
		Use:   "analytics",
		Short: "Enable / Disable analytics",
		RunE: func(cmd *cobra.Command, args []string) error {
			if disable {
				return disableAnalytics()
			}

			return enableAnalytics()
		},
	}
	cmd.Flags().BoolVarP(&disable, "disable", "d", false, "disable analytic collection")
	return cmd
}

func disableAnalytics() error {
	if err := analytics.Disable(); err != nil {
		return err
	}

	oktetoLog.Success("Analytics have been disabled")
	return nil
}

func enableAnalytics() error {
	if err := analytics.Enable(); err != nil {
		return err
	}

	oktetoLog.Success("Analytics have been enabled")
	return nil
}

```

### Core Architecture Module: `cmd/args/errors.go`
```
// Copyright 2024 The Okteto Authors
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

package args

import (
	"errors"
	"fmt"
)

var (
	// errorDevNameRequired is the error returned when the dev name is required
	errDevNameRequired = errors.New("dev name is required")

	// errorCommandRequired is the error returned when the command is required
	errCommandRequired = errors.New("command is required")

	// errNoDevContainerInDevMode is the error returned when there are no development containers in dev mode
	errNoDevContainerInDevMode = errors.New("there are no development containers in dev mode")

	// errNoDevContainerInManifest is the error returned when there are no development containers in the manifest
	errNoDevContainerInManifest = errors.New("there are no development containers in the manifest")
)

type errDevNotInManifest struct {
	devName string
}

// Error returns the error message
func (e *errDevNotInManifest) Error() string {
	return fmt.Sprintf("'%s' is not defined in your okteto manifest", e.devName)
}

```

### Core Architecture Module: `cmd/args/lister.go`
```
// Copyright 2024 The Okteto Authors
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

package args

import (
	"context"
	"fmt"
	"sort"

	"github.com/okteto/okteto/pkg/k8s/apps"
	"github.com/okteto/okteto/pkg/model"
	"github.com/okteto/okteto/pkg/okteto"
)

type DevModeOnLister struct {
	k8sClientProvider okteto.K8sClientProvider
}

func NewDevModeOnLister(k8sClientProvider okteto.K8sClientProvider) *DevModeOnLister {
	return &DevModeOnLister{
		k8sClientProvider: k8sClientProvider,
	}
}

func (d *DevModeOnLister) List(ctx context.Context, devs model.ManifestDevs, ns string) ([]string, error) {
	k8sClient, _, err := d.k8sClientProvider.Provide(okteto.GetContext().Cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to get k8s client: %w", err)
	}

	devNameList := apps.ListDevModeOn(ctx, devs, ns, k8sClient)
	if len(devNameList) == 0 {
		return nil, errNoDevContainerInDevMode
	}
	sort.Strings(devNameList)
	return devNameList, nil
}

type ManifestDevLister struct {
}

func NewManifestDevLister() *ManifestDevLister {
	return &ManifestDevLister{}
}

func (m *ManifestDevLister) List(_ context.Context, devs model.ManifestDevs, _ string) ([]string, error) {
	devList := devs.GetDevs()
	if len(devList) == 0 {
		return nil, errNoDevContainerInManifest
	}
	sort.Strings(devList)
	return devList, nil
}

```

### Core Architecture Module: `cmd/args/parser.go`
```
// Copyright 2024 The Okteto Authors
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

package args

import (
	"context"
	"fmt"

	"github.com/okteto/okteto/cmd/utils"
	"github.com/okteto/okteto/pkg/log/io"
	"github.com/okteto/okteto/pkg/model"
)

type devSelector interface {
	AskForOptionsOkteto(options []utils.SelectorItem, initialPosition int) (string, error)
}

type devLister interface {
	List(ctx context.Context, devs model.ManifestDevs, namespace string) ([]string, error)
}

// DevCommandArgParser is a parser for commands that takes a development container and a command as arguments
type DevCommandArgParser struct {
	devSelector       devSelector
	devLister         devLister
	ioCtrl            *io.Controller
	checkIfCmdIsEmpty bool
}

// NewDevCommandArgParser creates a new DevCommandArgParser instance
func NewDevCommandArgParser(lister devLister, ioControl *io.Controller, checkIfCmdIsEmpty bool) *DevCommandArgParser {
	return &DevCommandArgParser{
		devSelector:       utils.NewOktetoSelector("Select the development container:", "Development container"),
		ioCtrl:            ioControl,
		devLister:         lister,
		checkIfCmdIsEmpty: checkIfCmdIsEmpty,
	}
}

type Result struct {
	DevName           string
	Command           []string
	FirstArgIsDevName bool
}

// Parse parses the arguments and returns the dev name and command
func (p *DevCommandArgParser) Parse(ctx context.Context, argsIn []string, argsLenAtDash int, devs model.ManifestDevs, ns string) (*Result, error) {
	result := p.parseFromArgs(argsIn, argsLenAtDash)

	if p.checkIfCmdIsEmpty {
		if len(result.Command) == 0 {
			return nil, errCommandRequired
		}
	}
	result, err := p.setDevNameFromManifest(ctx, result, devs, ns)
	if err != nil {
		return nil, err
	}
	if err := p.validate(result, devs); err != nil {
		return nil, err
	}
	return result, nil
}

// parseFromArgs parses the arguments and returns the dev name and command
func (p *DevCommandArgParser) parseFromArgs(argsIn []string, argsLenAtDash int) *Result {
	result := &Result{}
	if len(argsIn) > 0 && argsLenAtDash != 0 {
		result.DevName = argsIn[0]
		result.FirstArgIsDevName = true
	}
	if argsLenAtDash > -1 {
		result.Command = argsIn[argsLenAtDash:]
	}
	return result
}

// setDevNameFromManifest sets the dev name from the manifest if it is not already set
func (p *DevCommandArgParser) setDevNameFromManifest(ctx context.Context, currentResult *Result, devs model.ManifestDevs, ns string) (*Result, error) {
	if currentResult.DevName != "" {
		p.ioCtrl.Logger().Infof("dev name is already set to '%s'", currentResult.DevName)
		return currentResult, nil
	}
	p.ioCtrl.Logger().Debug("retrieving dev name from manifest")

	devNameList, err := p.devLister.List(ctx, devs, ns)
	if err != nil {
		return nil, fmt.Errorf("failed to list devs: %w", err)
	}

	if len(devNameList) == 1 {
		currentResult.DevName = devNameList[0]
		return currentResult, nil
	}

	devName, err := p.devSelector.AskForOptionsOkteto(utils.ListToSelectorItem(devNameList), -1)
	if err != nil {
		return nil, fmt.Errorf("failed to select dev: %w", err)
	}
	currentResult.DevName = devName
	return currentResult, nil
}

// validate validates that the dev name is set and exists in the manifest
func (p *DevCommandArgParser) validate(result *Result, devs model.ManifestDevs) error {
	if result.DevName == "" {
		return errDevNameRequired
	}
	if _, ok := devs[result.DevName]; !ok {
		return &errDevNotInManifest{devName: result.DevName}
	}
	return nil
}

```

### Core Architecture Module: `cmd/context/context.go`
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
	"github.com/okteto/okteto/cmd/utils"
	oktetoLog "github.com/okteto/okteto/pkg/log"
	"github.com/okteto/okteto/pkg/okteto"
	"github.com/spf13/cobra"
)

// Context points okteto to a cluster.
func Context() *cobra.Command {
	ctxOptions := &Options{}
	cmd := &cobra.Command{
		Use:     "context",
		Aliases: []string{"ctx"},
		Args:    utils.NoArgsAccepted("https://okteto.com/docs/reference/okteto-cli/#context"),
		Short:   "Set the default Okteto Context",
		Long: `Set the default Okteto Context.

An Okteto Context is a group of cluster access parameters.
Each context contains a Kubernetes cluster, a user, and a namespace.
The current Okteto Context is the default cluster/namespace for any Okteto CLI command.

To set your default Okteto Context, run the ` + "`okteto context`" + ` command:

    $ okteto context

This will prompt you to select one of your existing Okteto Contexts or to create a new one.
`,
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			okteto.SetInsecureSkipTLSVerifyPolicy(ctxOptions.InsecureSkipTlsVerify)
		},
		RunE: Use().RunE,
	}
	cmd.AddCommand(Show())
	cmd.AddCommand(Use())
	cmd.AddCommand(List())
	cmd.AddCommand(DeleteCMD())

	cmd.PersistentFlags().BoolVarP(&ctxOptions.InsecureSkipTlsVerify, "insecure-skip-tls-verify", "", false, "skip validation of server's certificates")
	cmd.Flags().StringVarP(&ctxOptions.Token, "token", "t", "", "API token for authentication. Use this when scripting or if you don't want to use browser-based authentication")
	cmd.Flags().StringVarP(&ctxOptions.Namespace, "namespace", "n", "", "overwrite the current Okteto Namespace")
	cmd.Flags().BoolVarP(&ctxOptions.OnlyOkteto, "okteto", "", false, "only shows okteto context options")
	if err := cmd.Flags().MarkHidden("okteto"); err != nil {
		oktetoLog.Infof("failed to mark 'okteto' flag as hidden: %s", err)
	}
	return cmd
}

```

### Core Architecture Module: `cmd/context/create.go`
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
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/Masterminds/semver/v3"
	"github.com/compose-spec/godotenv"
	"github.com/okteto/okteto/cmd/utils"
	"github.com/okteto/okteto/pkg/cmd/login"
	"github.com/okteto/okteto/pkg/config"
	"github.com/okteto/okteto/pkg/env"
	oktetoErrors "github.com/okteto/okteto/pkg/errors"
	"github.com/okteto/okteto/pkg/filesystem"
	"github.com/okteto/okteto/pkg/k8s/kubeconfig"
	oktetoLog "github.com/okteto/okteto/pkg/log"
	"github.com/okteto/okteto/pkg/model"
	"github.com/okteto/okteto/pkg/okteto"
	"github.com/okteto/okteto/pkg/types"
	"github.com/spf13/afero"
)

// oktetoClientProvider provides an okteto client ready to use or fail
type oktetoClientProvider interface {
	Provide(...okteto.Option) (types.OktetoInterface, error)
}

type kubeconfigTokenController interface {
	updateOktetoContextToken(*types.UserContext) error
}

// Command has the dependencies to run a ctxCommand
type Command struct {
	K8sClientProvider    okteto.K8sClientProvider
	LoginController      login.Interface
	OktetoClientProvider oktetoClientProvider

	kubetokenController kubeconfigTokenController
	OktetoContextWriter okteto.ContextConfigWriterInterface
}

type ctxCmdOption func(*Command)

func withKubeTokenController(k kubeconfigTokenController) ctxCmdOption {
	return func(c *Command) {
		c.kubetokenController = k
	}
}

// NewContextCommand creates a new Command
func NewContextCommand(ctxCmdOption ...ctxCmdOption) *Command {
	cfg := &Command{
		K8sClientProvider:    okteto.NewK8sClientProvider(),
		LoginController:      login.NewLoginController(),
		OktetoClientProvider: okteto.NewOktetoClientProvider(),
		OktetoContextWriter:  okteto.NewContextConfigWriter(),
	}
	if env.LoadBoolean(OktetoUseStaticKubetokenEnvVar) {
		cfg.kubetokenController = newStaticKubetokenController()
	} else {
		cfg.kubetokenController = newDynamicKubetokenController(cfg.OktetoClientProvider)
	}
	for _, o := range ctxCmdOption {
		o(cfg)
	}
	return cfg
}

func (c *Command) UseContext(ctx context.Context, ctxOptions *Options) error {
	created := false

	ctxStore := okteto.GetContextStore()
	if okCtx, ok := ctxStore.Contexts[ctxOptions.Context]; ok && okCtx.IsOkteto {
		ctxOptions.IsOkteto = true
	}

	if okCtx, ok := ctxStore.Contexts[okteto.AddSchema(ctxOptions.Context)]; ok && okCtx.IsOkteto {
		ctxOptions.Context = okteto.AddSchema(ctxOptions.Context)
		ctxOptions.IsOkteto = true
	}

	if !ctxOptions.IsOkteto {

		if isUrl(ctxOptions.Context) {
			ctxOptions.Context = strings.TrimSuffix(ctxOptions.Context, "/")
			ctxOptions.IsOkteto = true
		} else {
			if !isValidCluster(ctxOptions.Context) {
				return oktetoErrors.UserError{E: fmt.Errorf("invalid okteto context '%s'", ctxOptions.Context),
					Hint: "Please run 'okteto context' to select one context"}
			}
			transformedCtx := okteto.K8sContextToOktetoUrl(ctx, ctxOptions.Context, ctxOptions.Namespace, c.K8sClientProvider)
			if transformedCtx != ctxOptions.Context {
				ctxOptions.Context = transformedCtx
				ctxOptions.IsOkteto = true
			}
		}
	}

	if okCtx, ok := ctxStore.Contexts[ctxOptions.Context]; !ok {
		ctxStore.Contexts[ctxOptions.Context] = &okteto.Context{Name: ctxOptions.Context}
		created = true
	} else if ctxOptions.Token == "" {
		// this is to avoid login with the browser again if we already have a valid token
		ctxOptions.Token = okCtx.Token
		ctxOptions.InferredToken = true
		if ctxOptions.Namespace == "" {
			ctxOptions.Namespace = ctxStore.Contexts[ctxOptions.Context].Namespace
		}

	}

	ctxStore.CurrentContext = ctxOptions.Context

	if ctxOptions.IsOkteto {
		if err := c.initOktetoContext(ctx, ctxOptions); err != nil {
			return err
		}
	} else {
		if err := c.initKubernetesContext(ctxOptions); err != nil {
			return err
		}
	}

	if ctxOptions.Save {
		oktetoLog.Debug("check if user can access namespace")
		hasAccess, err := hasAccessToNamespace(ctx, c, ctxOptions)
		if err != nil {
			return err
		}

		if !hasAccess {
			if ctxOptions.CheckNamespaceAccess {
				return oktetoErrors.UserError{
					E:    fmt.Errorf("namespace '%s' not found on context '%s'", ctxOptions.Namespace, ctxOptions.Context),
					Hint: "Please verify that the namespace exists and that you have access to it.",
				}
			}

			// if using a new context, our cached namespace may have been removed
			// so swap over to the personal namespace instead of erroring
			oktetoLog.Warning(
				"No access to namespace '%s' switching to personal namespace '%s'",
				ctxOptions.Namespace,
				okteto.GetContext().PersonalNamespace,
			)
			currentCtx := ctxStore.Contexts[ctxOptions.Context]
			currentCtx.Namespace = currentCtx.PersonalNamespace
		}

		currentCtx := ctxStore.Contexts[ctxOptions.Context]
		currentCtx.IsStoredAsInsecure = okteto.IsInsecureSkipTLSVerifyPolicy()

		if err := c.OktetoContextWriter.Write(); err != nil {
			return err
		}
	}

	if created && ctxOptions.IsOkteto {
		oktetoLog.Success("Context '%s' created", okteto.RemoveSchema(ctxOptions.Context))
	}

	if ctxOptions.IsCtxCommand {
		oktetoLog.Success("Using %s @ %s", okteto.GetContext().Namespace, okteto.RemoveSchema(ctxStore.CurrentContext))
		if oktetoLog.GetOutputFormat() == oktetoLog.JSONFormat {
			if err := showCurrentCtxJSON(); err != nil {
				return err
			}
		}
	}

	return nil
}

// getClusterMetadata runs the user query GetClusterMetadata and returns the response
func getClusterMetadata(ctx context.Context, namespace string, okClientProvider oktetoClientProvider) (types.ClusterMetadata, error) {
	okClient, err := okClientProvider.Provide()
	if err != nil {
		return types.ClusterMetadata{}, err
	}
	return okClient.User().GetClusterMetadata(ctx, namespace)
}

func getClusterInfo(ctx context.Context, okClientProvider oktetoClientProvider) (*types.ClusterInfo, error) {
	okClient, err := okClientProvider.Provide()
	if err != nil {
		return nil, err
	}
	return okClient.User().GetClusterInfo(ctx)
}

func resolveCustomerName(clusterInfo *types.ClusterInfo, clusterMetadata types.ClusterMetadata) string {
	if clusterInfo != nil && clusterInfo.CustomerName != "" {
		return clusterInfo.CustomerName
	}
	return clusterMetadata.CompanyName
}

func hasAccessToNamespace(ctx context.Context, c *Command, ctxOptions *Options) (bool, error) {
	if ctxOptions.IsOkteto {
		okClient, err := c.OktetoClientProvider.Provide()
		if err != nil {
			return false, err
		}

		hasOktetoClientAccess, err := utils.HasAccessToOktetoClusterNamespace(ctx, ctxOptions.Namespace, okClient)
		if err != nil {
			return false, err
		}

		return hasOktetoClientAccess, nil
	} else {
		k8sClient, _, err := c.K8sClientProvider.Provide(okteto.GetContext().Cfg)
		if err != nil {
			return false, err
		}

		hasK8sClientAccess, err := utils.HasAccessToK8sClusterNamespace(ctx, ctxOptions.Namespace, k8sClient)
		if err != nil {
			return false, err
		}

		return hasK8sClientAccess, nil
	}
}

func (c *Command) initOktetoContext(ctx context.Context, ctxOptions *Options) error {
	oktetoLog.Debug("initializing okteto context")
	var userContext *types.UserContext
	userContext, err := getLoggedUserContext(ctx, c, ctxOptions)
	if err != nil {
		// if an expired token is explicitly used, an error informing of the situation
		// should be returned instead of automatically generating a new token
		if !ctxOptions.InferredToken && errors.Is(err, oktetoErrors.ErrTokenExpired) {
			ret
```

### Core Architecture Module: `cmd/context/delete.go`
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
	"strings"

	"github.com/hashicorp/go-multierror"
	"github.com/okteto/okteto/cmd/utils"
	"github.com/okteto/okteto/pkg/analytics"
	oktetoLog "github.com/okteto/okteto/pkg/log"
	"github.com/okteto/okteto/pkg/okteto"
	"github.com/spf13/cobra"
)

// DeleteCMD removes a cluster from okteto context
func DeleteCMD() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "delete",
		Args:  utils.MinimumNArgsAccepted(1, "https://okteto.com/docs/reference/okteto-cli/#delete"),
		Short: "Delete one or more Okteto Contexts",
		RunE: func(cmd *cobra.Command, args []string) error {
			for idx, arg := range args {
				args[idx] = okteto.AddSchema(arg)
				args[idx] = strings.TrimSuffix(arg, "/")
			}
			errs := Delete(args)
			var errLen int
			var totalContextsDeleted int
			if errs != nil {
				if merr, ok := errs.(*multierror.Error); ok {
					errLen = len(merr.Errors)
				}
			}
			success := len(args) == errLen
			analytics.TrackContextDelete(totalContextsDeleted, success)
			return errs
		},
	}
	return cmd
}

func Delete(okCtxs []string) error {
	ctxStore := okteto.GetContextStore()
	var errs error
	validOptions := make([]string, 0)
	for _, okCtx := range okCtxs {
		if okCtx == ctxStore.CurrentContext {
			ctxStore.CurrentContext = ""
		}

		if _, ok := ctxStore.Contexts[okCtx]; ok {
			delete(ctxStore.Contexts, okCtx)
			if err := okteto.NewContextConfigWriter().Write(); err != nil {
				return err
			}
			oktetoLog.Success("'%s' deleted successfully", okCtx)
		} else {
			for k, v := range ctxStore.Contexts {
				if v.IsOkteto {
					validOptions = append(validOptions, k)
				}
			}
			errs = multierror.Append(errs, fmt.Errorf("'%s' context doesn't exist", okCtx))
		}
	}

	if errs != nil {
		if err, ok := errs.(*multierror.Error); ok {
			err.ErrorFormat = func(es []error) string {
				points := make([]string, len(es))
				for i, err := range es {
					points[i] = fmt.Sprintf("\t- %s", err)
				}

				hint := fmt.Sprintf("Valid options are: [%s]. To delete a Kubernetes context run 'kubectl config delete-context <k8s-context-name>'", strings.Join(validOptions, ", "))
				return fmt.Sprintf("Following contexts couldn't be deleted:\n%s\n%s\n\n", strings.Join(points, "\n"), hint)
			}
		}
	}

	return errs
}

```

### Core Architecture Module: `cmd/context/kubetoken.go`
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
	"errors"
	"fmt"
	"sync"

	oktetoLog "github.com/okteto/okteto/pkg/log"
	"github.com/okteto/okteto/pkg/okteto"
	"github.com/okteto/okteto/pkg/types"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

const (
	// OktetoUseStaticKubetokenEnvVar is used to opt in to use static kubetoken
	OktetoUseStaticKubetokenEnvVar = "OKTETO_USE_STATIC_KUBETOKEN"
)

var (
	usingStaticKubetokenWarningMessage = fmt.Sprintf("Using static Kubernetes token due to env var: '%s'. This feature will be removed in the future. We recommend using a dynamic kubernetes token.", OktetoUseStaticKubetokenEnvVar)
)

// staticKubetokenWarner is used to print a warning message when the static kubetoken is enabled and the cluster has dynamic kubetoken capabilities.
type staticKubetokenWarner struct {
	once sync.Once
}

// warn prints a warning message when the static kubetoken is enabled and the cluster has dynamic kubetoken capabilities.
func (wp *staticKubetokenWarner) warn() {
	wp.once.Do(func() {
		oktetoLog.Warning("%s", usingStaticKubetokenWarningMessage)
	})
}

// staticKubetokenController is used to update the kubeconfig stored in the okteto context by using a static token to connect to the cluster.
type staticKubetokenController struct {
	staticKubetokenWarner
}

// newStaticKubetokenController creates a new staticKubetokenController
func newStaticKubetokenController() *staticKubetokenController {
	return &staticKubetokenController{
		staticKubetokenWarner: staticKubetokenWarner{},
	}
}

// updateOktetoContext when the dynamic kubetoken is disabled removes the exec from the kubeconfig stored in the okteto context
// so okteto can still use the old kubeconfig auth method (by static token) to connect to the cluster.
func (kc *staticKubetokenController) updateOktetoContextExec(okCtx *okteto.Context) error {
	kc.staticKubetokenWarner.warn()

	if okCtx == nil || okCtx.UserID == "" || okCtx.Cfg == nil || okCtx.Cfg.AuthInfos == nil || okCtx.Cfg.AuthInfos[okCtx.UserID] == nil {
		return nil
	}
	okCtx.Cfg.AuthInfos[okCtx.UserID].Exec = nil
	return nil
}

func (kc *staticKubetokenController) updateOktetoContextToken(uCtx *types.UserContext) error {
	kc.staticKubetokenWarner.warn()
	if uCtx.Credentials.Token == "" {
		return errors.New("static kubernetes token not available")
	}
	return nil
}

// dynamicKubetokenController is used to update the kubeconfig stored in the okteto context by using a dynamic token to connect to the cluster.
type dynamicKubetokenController struct {
	oktetoClientProvider oktetoClientProvider
}

// newDynamicKubetokenController creates a new dynamicKubetokenController
func newDynamicKubetokenController(okClientProvider oktetoClientProvider) *dynamicKubetokenController {
	return &dynamicKubetokenController{
		oktetoClientProvider: okClientProvider,
	}
}

// updateOktetoContext when the dynamic kubetoken is enabled configures the kubeconfig auth method to be executed by okteto kubetoken
// which returns a dynamic token to connect to the cluster.
func (dkc *dynamicKubetokenController) updateOktetoContextExec(okCtx *okteto.Context) error {
	okClient, err := dkc.oktetoClientProvider.Provide()
	if err != nil {
		return err
	}

	err = okClient.Kubetoken().CheckService(okCtx.Name, okCtx.Namespace)
	if err != nil {
		return fmt.Errorf("error checking kubetoken service: %w", err)
	}

	k8sCfg := okCtx.Cfg
	if k8sCfg.AuthInfos == nil {
		k8sCfg.AuthInfos = clientcmdapi.NewConfig().AuthInfos
		k8sCfg.AuthInfos[okCtx.UserID] = clientcmdapi.NewAuthInfo()
	}

	if token := k8sCfg.AuthInfos[okCtx.UserID].Token; token != "" {
		k8sCfg.AuthInfos[okCtx.UserID].Token = ""
	}

	k8sCfg.AuthInfos[okCtx.UserID].Exec = &clientcmdapi.ExecConfig{
		APIVersion:         "client.authentication.k8s.io/v1",
		Command:            "okteto",
		Args:               []string{"kubetoken", "--context", okCtx.Name, "--namespace", okCtx.Namespace},
		InstallHint:        "Okteto needs to be installed in your PATH and it has to be connected to your instance using the command 'okteto context use https://okteto.example.com'. Please visit https://www.okteto.com/docs/get-started/install-okteto-cli for more information.",
		InteractiveMode:    "Never",
		ProvideClusterInfo: true,
	}
	return nil
}

// updateOktetoContextToken retrieves a dynamic token for the given userContext and updates Credentials.Token
// if error while retrieving the dynamic token or flag OKTETO_USE_STATIC_KUBETOKEN is enabled, value is not updated
// and fallback to static token
func (dkc *dynamicKubetokenController) updateOktetoContextToken(userContext *types.UserContext) error {
	if userContext.User.Namespace == "" {
		return errors.New("user context namespace is empty")
	}

	c, err := dkc.oktetoClientProvider.Provide()
	if err != nil {
		return fmt.Errorf("error providing the okteto client while updating okteto context token: %w", err)
	}

	kubetoken, err := c.Kubetoken().GetKubeToken(okteto.GetContext().Name, userContext.User.Namespace, "")
	if err != nil || kubetoken.Status.Token == "" {
		return errors.New("dynamic kubernetes token not available: falling back to static token")
	}

	userContext.Credentials.Token = kubetoken.Status.Token
	return nil
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

### Incident Patch 1: `7924c3c4` (2026-09-30)
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

Signed-off-by: dependabot[bot] <support@github.com>
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

### Incident Patch 2: `e7641c1d` (2026-09-28)
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

Signed-off-by: Nacho Fuertes <nacho@okteto.com>
Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

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
+	dc, err := discover
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

### Incident Patch 3: `f72d931f` (2026-09-18)
**Commit Message**: chore(deps): Update module go.opentelemetry.io/otel/exporters/otlp/otlptrace to v1.45.0 [SECURITY] (#5156)

Co-authored-by: Renovate <renovate@whitesourcesoftware.com>



---

### Incident Patch 4: `dbd29a74` (2026-09-18)
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

Signed-off-by: dependabot[bot] <support@github.com>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Javier López Barba <javier@okteto.com>

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

### Incident Patch 5: `acc1bbb0` (2026-09-18)
**Commit Message**: chore(deps): Update module go.opentelemetry.io/otel/sdk to v1.45.0 [SECURITY] (#5157)

Co-authored-by: Renovate <renovate@whitesourcesoftware.com>

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
+go.o
```

---

### Incident Patch 6: `8b3c9e34` (2026-09-09)
**Commit Message**: chore(deps): Update module google.golang.org/grpc to v1.83.2 [SECURITY] (#5146)

Co-authored-by: Renovate <renovate@whitesourcesoftware.com>

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -42,7 +42,7 @@ require (
 	golang.org/x/oauth2 v0.36.0
 	golang.org/x/sync v0.22.0
 	golang.org/x/term v0.45.0
-	google.golang.org/grpc v1.83.1
+	google.golang.org/grpc v1.83.2
 	gopkg.in/natefinch/lumberjack.v2 v2.2.1
 	gopkg.in/yaml.v3 v3.0.1
 	k8s.io/api v0.36.3
@@ -141,7 +141,7 @@ require (
 	go.opentelemetry.io/otel/sdk v1.44.0 // indirect
 	go.opentelemetry.io/otel/trace v1.44.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
-	golang.org/x/net v0.57.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
 	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
```

**File**: `go.sum` (modified, +4/-4)
```diff
@@ -751,8 +751,8 @@ golang.org/x/net v0.0.0-20210226172049-e18ecbb05110/go.mod h1:m0MpNAwzfU5UDzcl9v
 golang.org/x/net v0.0.0-20211112202133-69e39bad7dc2/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20220722155237-a158d28d115b/go.mod h1:XRhObCWvk6IyKnWLug+ECip1KBveYUHfp+8e9klMJ9c=
 golang.org/x/net v0.7.0/go.mod h1:2Tu9+aMcznHK/AK1HMvgo6xiTLG5rD5rZLDS+rp2Bjs=
-golang.org/x/net v0.57.0 h1:K5+3DljvIuDG9/Jv9rvyMywYNFCQ9RSUY6OOTTkT+tE=
-golang.org/x/net v0.57.0/go.mod h1:KpXc8iv+r3XplLAG/f7Jsf9RPszJzdR0f58q9vGOuEU=
+golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
+golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
 golang.org/x/oauth2 v0.0.0-20190604053449-0f29369cfe45/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
@@ -894,8 +894,8 @@ google.golang.org/grpc v1.23.0/go.mod h1:Y5yQAOtifL1yxbo5wqy6BxZv8vAUGQwXBOALyac
 google.golang.org/grpc v1.26.0/go.mod h1:qbnxyOmOxrQa7FizSgH+ReBfzJrCY1pSN7KXBS8abTk=
 google.golang.org/grpc v1.27.0/go.mod h1:qbnxyOmOxrQa7FizSgH+ReBfzJrCY1pSN7KXBS8abTk=
 google.golang.org/grpc v1.27.1/go.mod h1:qbnxyOmOxrQa7FizSgH+ReBfzJrCY1pSN7KXBS8abTk=
-google.golang.org/grpc v1.83.1 h1:HIO0+BEtBP6soyqvqC8sNUjZ7bTs+0hFQuFF+RAy++Y=
-google.golang.org/grpc v1.83.1/go.mod h1:kDyl6SKsiHKt0uylY5gtn5cEjkrIOhQOGDgIc4JGwzQ=
+google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
+google.golang.org/grpc v1.83.2/go.mod h1:YPI1hK3kDked6iHvgX3tR0y+nX/qpMFKhPgFsokw1S8=
 google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af h1:+5/Sw3GsDNlEmu7TfklWKPdQ0Ykja5VEmq2i817+jbI=
 google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

---

### Incident Patch 7: `f9b4afe9` (2026-09-08)
**Commit Message**: revert: downgrade github.com/go-git/go-git/v5 to v5.16.5 (#5142)

Reverts the go-git bump from #5133, restoring v5.16.5 (the version
in use before that PR). Only go-git is reverted; the golang.org/x/crypto
update from the same PR is left in place.

No code changes are required — #5133 modified only go.mod/go.sum.

Signed-off-by: Javier Lopez <javier@okteto.com>
Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ require (
 	github.com/dukex/mixpanel v0.0.0-20180925151559-f8d5594f958e
 	github.com/fatih/color v1.19.0
 	github.com/gliderlabs/ssh v0.3.8
-	github.com/go-git/go-git/v5 v5.19.2
+	github.com/go-git/go-git/v5 v5.16.5
 	github.com/google/go-containerregistry v0.21.6 // when updating need google.golang.org/grpc 1.29
 	github.com/google/go-github v17.0.0+incompatible
 	github.com/google/uuid v1.6.0
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -264,8 +264,8 @@ github.com/go-git/go-billy/v5 v5.9.0 h1:jItGXszUDRtR/AlferWPTMN4j38BQ88XnXKbilmm
 github.com/go-git/go-billy/v5 v5.9.0/go.mod h1:jCnQMLj9eUgGU7+ludSTYoZL/GGmii14RxKFj7ROgHw=
 github.com/go-git/go-git-fixtures/v4 v4.3.2-0.20231010084843-55a94097c399 h1:eMje31YglSBqCdIqdhKBW8lokaMrL3uTkpGYlE2OOT4=
 github.com/go-git/go-git-fixtures/v4 v4.3.2-0.20231010084843-55a94097c399/go.mod h1:1OCfN199q1Jm3HZlxleg+Dw/mwps2Wbk9frAWm+4FII=
-github.com/go-git/go-git/v5 v5.19.2 h1:wkfn7vOlUBu8ivAWKBWisTiwJK4jYHzTF8Ndv1LyGqY=
-github.com/go-git/go-git/v5 v5.19.2/go.mod h1:QqCBE1EFN5ddFmrliLQ3/ntRCUjZU3EJuwuB/jWEHjk=
+github.com/go-git/go-git/v5 v5.16.5 h1:mdkuqblwr57kVfXri5TTH+nMFLNUxIj9Z7F5ykFbw5s=
+github.com/go-git/go-git/v5 v5.16.5/go.mod h1:QOMLpNf1qxuSY4StA/ArOdfFR2TrKEjJiye2kel2m+M=
 github.com/go-gl/glfw v0.0.0-20190409004039-e6da0acd62b1/go.mod h1:vR7hzQXu2zJy9AVAgeJqvqgH9Q5CA+iKCZ2gyEVpxRU=
 github.com/go-gl/glfw/v3.3/glfw v0.0.0-20191125211704-12ad95a8df72/go.mod h1:tQ2UAYgL5IevRw8kRxooKSPJfGvJ9fJQFa0TUsXzTg8=
 github.com/go-jose/go-jose/v4 v4.1.4 h1:moDMcTHmvE6Groj34emNPLs/qtYXRVcd6S7NHbHz3kA=
```

---

### Incident Patch 8: `92b4fca9` (2026-09-02)
**Commit Message**: fix: update vulnerable dependencies in okteto and remote binaries (#5133)

- Update golang.org/x/crypto from v0.54.0 to v0.55.0 (fixes CVE-2026-56854,
  crypto/ssh authentication bypass) in both the okteto CLI and the tools module
- Update github.com/go-git/go-git/v5 from v5.16.5 to v5.19.2 (fixes
  CVE-2026-45022 and CVE-2026-71556) in the okteto CLI

Resolves 2 CRITICAL and 2 HIGH severity vulnerabilities across the okteto and
okteto-remote binaries. The remaining findings are in third-party prebuilt
binaries (syncthing, helm, kubectl, kustomize) already pinned to their latest
stable releases; those require an upstream rebuild with Go 1.26.6 and are not
fixable from this repository yet.

Signed-off-by: Javier Lopez <javier@okteto.com>
Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>

**File**: `go.mod` (modified, +6/-5)
```diff
@@ -18,7 +18,7 @@ require (
 	github.com/dukex/mixpanel v0.0.0-20180925151559-f8d5594f958e
 	github.com/fatih/color v1.19.0
 	github.com/gliderlabs/ssh v0.3.8
-	github.com/go-git/go-git/v5 v5.16.5
+	github.com/go-git/go-git/v5 v5.19.2
 	github.com/google/go-containerregistry v0.21.6 // when updating need google.golang.org/grpc 1.29
 	github.com/google/go-github v17.0.0+incompatible
 	github.com/google/uuid v1.6.0
@@ -38,7 +38,7 @@ require (
 	github.com/spf13/cobra v1.10.2
 	github.com/src-d/enry/v2 v2.1.0
 	github.com/stern/stern v1.22.0
-	golang.org/x/crypto v0.54.0
+	golang.org/x/crypto v0.55.0
 	golang.org/x/oauth2 v0.36.0
 	golang.org/x/sync v0.22.0
 	golang.org/x/term v0.45.0
@@ -141,9 +141,9 @@ require (
 	go.opentelemetry.io/otel/sdk v1.44.0 // indirect
 	go.opentelemetry.io/otel/trace v1.44.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
-	golang.org/x/net v0.56.0 // indirect
+	golang.org/x/net v0.57.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
-	golang.org/x/text v0.40.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
 	google.golang.org/api v0.271.0 // indirect
 	google.golang.org/genproto v0.0.0-20260128011058-8636f8732409 // indirect
@@ -233,6 +233,7 @@ require (
 	github.com/hashicorp/errwrap v1.1.0 // indirect
 	github.com/hashicorp/golang-lru/v2 v2.0.7 // indirect
 	github.com/in-toto/attestation v1.2.0 // indirect
+	github.com/klauspost/cpuid/v2 v2.3.0 // indirect
 	github.com/mikelolasagasti/xz v1.0.1 // indirect
 	github.com/minio/minlz v1.0.1 // indirect
 	github.com/nwaples/rardecode/v2 v2.2.0 // indirect
@@ -279,7 +280,7 @@ require (
 	github.com/moby/docker-image-spec v1.3.1 // indirect
 	github.com/moby/locker v1.0.1 // indirect
 	github.com/moby/sys/signal v0.7.1 // indirect
-	github.com/pjbgf/sha1cd v0.3.2 // indirect
+	github.com/pjbgf/sha1cd v0.6.0 // indirect
 	github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10 // indirect
 	github.com/russross/blackfriday/v2 v2.1.0 // indirect
 	github.com/samber/lo v1.38.1 // indirect
```

**File**: `go.sum` (modified, +16/-14)
```diff
@@ -264,8 +264,8 @@ github.com/go-git/go-billy/v5 v5.9.0 h1:jItGXszUDRtR/AlferWPTMN4j38BQ88XnXKbilmm
 github.com/go-git/go-billy/v5 v5.9.0/go.mod h1:jCnQMLj9eUgGU7+ludSTYoZL/GGmii14RxKFj7ROgHw=
 github.com/go-git/go-git-fixtures/v4 v4.3.2-0.20231010084843-55a94097c399 h1:eMje31YglSBqCdIqdhKBW8lokaMrL3uTkpGYlE2OOT4=
 github.com/go-git/go-git-fixtures/v4 v4.3.2-0.20231010084843-55a94097c399/go.mod h1:1OCfN199q1Jm3HZlxleg+Dw/mwps2Wbk9frAWm+4FII=
-github.com/go-git/go-git/v5 v5.16.5 h1:mdkuqblwr57kVfXri5TTH+nMFLNUxIj9Z7F5ykFbw5s=
-github.com/go-git/go-git/v5 v5.16.5/go.mod h1:QOMLpNf1qxuSY4StA/ArOdfFR2TrKEjJiye2kel2m+M=
+github.com/go-git/go-git/v5 v5.19.2 h1:wkfn7vOlUBu8ivAWKBWisTiwJK4jYHzTF8Ndv1LyGqY=
+github.com/go-git/go-git/v5 v5.19.2/go.mod h1:QqCBE1EFN5ddFmrliLQ3/ntRCUjZU3EJuwuB/jWEHjk=
 github.com/go-gl/glfw v0.0.0-20190409004039-e6da0acd62b1/go.mod h1:vR7hzQXu2zJy9AVAgeJqvqgH9Q5CA+iKCZ2gyEVpxRU=
 github.com/go-gl/glfw/v3.3/glfw v0.0.0-20191125211704-12ad95a8df72/go.mod h1:tQ2UAYgL5IevRw8kRxooKSPJfGvJ9fJQFa0TUsXzTg8=
 github.com/go-jose/go-jose/v4 v4.1.4 h1:moDMcTHmvE6Groj34emNPLs/qtYXRVcd6S7NHbHz3kA=
@@ -428,6 +428,8 @@ github.com/klauspost/compress v1.4.1/go.mod h1:RyIbtBH6LamlWaDj8nUwkbUhJ87Yi3uG0
 github.com/klauspost/compress v1.18.6 h1:2jupLlAwFm95+YDR+NwD2MEfFO9d4z4Prjl1XXDjuao=
 github.com/klauspost/compress v1.18.6/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
 github.com/klauspost/cpuid v1.2.0/go.mod h1:Pj4uuM528wm8OyEC2QMXAi2YiTZ96dNQPGgoMS4s3ek=
+github.com/klauspost/cpuid/v2 v2.3.0 h1:S4CRMLnYUhGeDFDqkGriYKdfoFlDnMtqTiI/sFzhA9Y=
+github.com/klauspost/cpuid/v2 v2.3.0/go.mod h1:hqwkgyIinND0mEev00jJYCxPNVRVXFQeu1XKlok6oO0=
 github.com/klauspost/pgzip v1.2.6 h1:8RXeL5crjEUFnR2/Sn6GJNWtSQ3Dk8pq4CL3jvdDyjU=
 github.com/klauspost/pgzip v1.2.6/go.mod h1:Ch1tH69qFZu15pkjo5kYi6mth2Zzwzt50oCQKQE9RUs=
 github.com/kr/pretty v0.1.0/go.mod h1:dAy3ld7l9f0ibDNOQOHHMYYIIbhfbHSm3C4ZsoJORNo=
@@ -530,8 +532,8 @@ github.com/peterbourgon/diskv v2.0.1+incompatible h1:UBdAOUP5p4RWqPBg048CAvpKN+v
 github.com/peterbourgon/diskv v2.0.1+incompatible/go.mod h1:uqqh8zWWbv1HBMNONnaR/tNboyR3/BZd58JJSHlUSCU=
 github.com/pierrec/lz4/v4 v4.1.22 h1:cKFw6uJDK+/gfw5BcDL0JL5aBsAFdsIT18eRtLj7VIU=
 github.com/pierrec/lz4/v4 v4.1.22/go.mod h1:gZWDp/Ze/IJXGXf23ltt2EXimqmTUXEy0GFuRQyBid4=
-github.com/pjbgf/sha1cd v0.3.2 h1:a9wb0bp1oC2TGwStyn0Umc/IGKQnEgF0vVaZ8QF8eo4=
-github.com/pjbgf/sha1cd v0.3.2/go.mod h1:zQWigSxVmsHEZow5qaLtPYxpcKMMQpa09ixqBxuCS6A=
+github.com/pjbgf/sha1cd v0.6.0 h1:3WJ8Wz8gvDz29quX1OcEmkAlUg9diU4GxJHqs0/XiwU=
+github.com/pjbgf/sha1cd v0.6.0/go.mod h1:lhpGlyHLpQZoxMv8HcgXvZEhcGs0PG/vsZnEJ7H0iCM=
 github.com/pkg/errors v0.9.1 h1:FEBLx1zS214owpjy7qsBeixbURkuhQAwrK5UwLGTwt4=
 github.com/pkg/errors v0.9.1/go.mod h1:bwawxfHBFNV+L2hUp1rHADufV3IMtnDRdf1r5NINEl0=
 github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10 h1:GFCKgmp0tecUJ0sJuv4pzYCqS9+RGSn52M3FUwPs+uo=
@@ -700,8 +702,8 @@ golang.org/x/crypto v0.0.0-20190605123033-f99c8df09eb5/go.mod h1:yigFU9vqHzYiE8U
 golang.org/x/crypto v0.0.0-20191011191535-87dc89f01550/go.mod h1:yigFU9vqHzYiE8UmvKecakEJjdnWj3jj499lnFckfCI=
 golang.org/x/crypto v0.0.0-20210921155107-089bfa567519/go.mod h1:GvvjBRRGRdwPK5ydBHafDWAxML/pGHZbMvKqRZ5+Abc=
 golang.org/x/crypto v0.0.0-20220622213112-05595931fe9d/go.mod h1:IxCIyHEi3zRg3s0A5j5BB6A9Jmi73HwBIUl50j+osU4=
-golang.org/x/crypto v0.54.0 h1:YLIA59K4fiNzHzjnZt2tUJQjQtUWfWbeHBqKtk3eScw=
-golang.org/x/crypto v0.54.0/go.mod h1:KWL8ny2AZdGR2cWmzeHrp2azQPGogOv+HeQaVEXC2dk=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190306152737-a1d7652674e8/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190510132918-efd6b22b2522/go.mod h1:ZjyILWgesfNpC6sMxTJOJm9Kp84zZh5NQWvqD
```

**File**: `tools/go.mod` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ require (
 	github.com/shirou/gopsutil v3.21.11+incompatible
 	github.com/shirou/gopsutil/v3 v3.24.5
 	github.com/sirupsen/logrus v1.9.4
-	golang.org/x/crypto v0.54.0
+	golang.org/x/crypto v0.55.0
 )
 
 require (
```

**File**: `tools/go.sum` (modified, +2/-2)
```diff
@@ -48,8 +48,8 @@ github.com/tklauser/numcpus v0.11.0 h1:nSTwhKH5e1dMNsCdVBukSZrURJRoHbSEQjdEbY+9R
 github.com/tklauser/numcpus v0.11.0/go.mod h1:z+LwcLq54uWZTX0u/bGobaV34u6V7KNlTZejzM6/3MQ=
 github.com/yusufpapurcu/wmi v1.2.4 h1:zFUKzehAFReQwLys1b/iSMl+JQGSCSjtVqQn9bBrPo0=
 github.com/yusufpapurcu/wmi v1.2.4/go.mod h1:SBZ9tNy3G9/m5Oi98Zks0QjeHVDvuK0qfxQmPyzfmi0=
-golang.org/x/crypto v0.54.0 h1:YLIA59K4fiNzHzjnZt2tUJQjQtUWfWbeHBqKtk3eScw=
-golang.org/x/crypto v0.54.0/go.mod h1:KWL8ny2AZdGR2cWmzeHrp2azQPGogOv+HeQaVEXC2dk=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/sys v0.0.0-20190916202348-b4ddaad3f8a3/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20201204225414-ed752295db88/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.1.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
```

---

### Incident Patch 9: `bf9c4112` (2026-08-27)
**Commit Message**: fix: update vulnerable dependencies (Go 1.26.6, kubectl 1.35.8, syncthing 2.1.3) (#5129)

* fix: update vulnerable dependencies

- Bump Go toolchain 1.26.5 -> 1.26.6 (Dockerfile GOLANG_VERSION/SHA + go.mod + tools/go.mod)
- Update kubectl from 1.35.7 to 1.35.8
- Update syncthing from 2.1.2 to 2.1.3 (Dockerfile ARG/SHA + pkg/syncthing/install.go constant)

The Go bump rebuilds the okteto, clean, remote and supervisor binaries with
patched stdlib, fully clearing clean/remote/supervisor and dropping okteto from
10 to 2 HIGH. kubectl drops 13 -> 8 HIGH and syncthing 10 -> 9 HIGH.

Resolves 0 CRITICAL and 38 HIGH severity vulnerabilities.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Signed-off-by: Javier Lopez <javier@okteto.com>

* fix: bump CI image okteto/golang-ci 2.10.1 -> 2.10.2 (Go 1.26.6)

Keeps the CI toolchain aligned with the Go 1.26.6 bump used to build the
release binaries.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Signed-off-by: Javier Lopez <javier@okteto.com>

* fix: gofmt map alignment in up_test.go for golangci-lint 2.13.1

The CI golang-ci image (golangci-lint 2.13.1) flags the map literal
alignment that the previous linter version accepted.

**File**: `.circleci/config.yml` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ orbs:
 executors:
   golang-ci:
     docker:
-      - image: okteto/golang-ci:2.10.1@sha256:3279c526fdce2272b60979dff352e1e672bf2f8d3035797d96365c619f9c87ab
+      - image: okteto/golang-ci:2.10.2@sha256:70110959a4abc29e805470a1f67840bb0f5edbc4dd50e7dc80a970049d7c8c8a
     environment:
       OKTETO_CONTEXT: https://okteto.integration.dev.okteto.net
       OKTETO_APPS_SUBDOMAIN: integration.dev.okteto.net
```

**File**: `Dockerfile` (modified, +5/-5)
```diff
@@ -1,15 +1,15 @@
 # Base image versions - Centralized version control for easier updates
 # Kubernetes tools (kubectl, Helm 3, Helm 4, kustomize)
-ARG KUBECTL_VERSION=1.35.7
+ARG KUBECTL_VERSION=1.35.8
 ARG HELM3_VERSION=3.21.4
 ARG HELM4_VERSION=4.2.4
 ARG KUSTOMIZE_VERSION=5.8.1
 # Okteto components
-ARG SYNCTHING_VERSION=2.1.2
-ARG SYNCTHING_SHA=sha256:4464f4161dd0251e20d46bb3aec83363db75d80cef1abdd5d5fd4054b04a004d
+ARG SYNCTHING_VERSION=2.1.3
+ARG SYNCTHING_SHA=sha256:8c8ff37ab6aa8be23b700648a90fa9412e214852e9fd6ea8477c8334792daec0
 # Base images
-ARG GOLANG_VERSION=1.26.5
-ARG GOLANG_SHA=sha256:1ecb7edf62a0408027bd5729dfd6b1b8766e578e8df93995b225dfd0944eb651
+ARG GOLANG_VERSION=1.26.6
+ARG GOLANG_SHA=sha256:116d58cbd88c1297624acc6e967a060012422bacf9930927e23fb719189c6f36
 ARG ALPINE_VERSION=3.20
 ARG ALPINE_SHA=sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc
 ARG BUSYBOX_VERSION=1.36.1
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module github.com/okteto/okteto
 
-go 1.26.5
+go 1.26.6
 
 require (
 	al.essio.dev/pkg/shellescape v1.6.0
```

**File**: `okteto.yml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ dev:
     autocreate: true
 test:
   unit:
-    image: okteto/golang-ci:2.10.1@sha256:3279c526fdce2272b60979dff352e1e672bf2f8d3035797d96365c619f9c87ab
+    image: okteto/golang-ci:2.10.2@sha256:70110959a4abc29e805470a1f67840bb0f5edbc4dd50e7dc80a970049d7c8c8a
     artifacts:
       - coverage.txt
       - coverage.html
```

**File**: `pkg/analytics/up_test.go` (modified, +3/-3)
```diff
@@ -373,9 +373,9 @@ func Test_UpMetricsMetadata_ToPostHogProps(t *testing.T) {
 				devContainerCreationDuration: 5 * time.Second,
 			},
 			expected: baseProps(map[string]any{
-				"result":                                  true,
-				"duration_seconds":                        60,
-				"initial_sync_duration_seconds":           10,
+				"result":                        true,
+				"duration_seconds":              60,
+				"initial_sync_duration_seconds": 10,
 				"dev_container_creation_duration_seconds": 5,
 			}),
 		},
```

---

### Incident Patch 10: `c022ec86` (2026-08-18)
**Commit Message**: fix: dial SSH tunnel with explicit host instead of :port (#5115)

Empty-host dials (net.Dial("tcp", ":port")) target 0.0.0.0 and break the
SSH handshake on macOS when a VPN owns the default route. Build the
address with net.JoinHostPort, matching pkg/ssh/exec.go and other dial sites.

Fixes #5114

Signed-off-by: Andrey Lebedev <5165852+dev-andrey@users.noreply.github.com>

**File**: `cmd/up/forwards.go` (modified, +5/-1)
```diff
@@ -17,6 +17,7 @@ import (
 	"context"
 	"errors"
 	"fmt"
+	"net"
 	"time"
 
 	oktetoErrors "github.com/okteto/okteto/pkg/errors"
@@ -101,7 +102,10 @@ func (up *upContext) sshForwards(ctx context.Context) error {
 		return err
 	}
 
-	up.Forwarder = ssh.NewForwardManager(ctx, fmt.Sprintf(":%d", up.Dev.RemotePort), up.Dev.Interface, "0.0.0.0", f, up.Namespace)
+	// Use an explicit host. Dialing ":port" targets 0.0.0.0 and breaks SSH
+	// handshakes on some platforms (e.g. macOS with a VPN default route).
+	sshAddr := net.JoinHostPort(up.Dev.Interface, fmt.Sprintf("%d", up.Dev.RemotePort))
+	up.Forwarder = ssh.NewForwardManager(ctx, sshAddr, up.Dev.Interface, "0.0.0.0", f, up.Namespace)
 	if err := up.Forwarder.Add(forward.Forward{Local: up.Sy.RemotePort, Remote: syncthing.ClusterPort}); err != nil {
 		return err
 	}
```

#### Recent Merged Pull Requests:
- **PR #5173** (2026-09-30): build(deps): bump brace-expansion from 1.1.18 to 1.1.21 in /samples/node.js (@dependabot[bot])
- **PR #5169** (2026-09-30): build(deps): bump renovatebot/github-action from 46.3.3 to 46.3.4 (@dependabot[bot])
- **PR #5168** (2026-09-28): fix(k8s): use "okteto" as field manager for all CLI writes (DEV-1477) (@ifbyol)
- **PR #5167** (2026-09-30): feat(build): support OKTETO_BUILD_COMPRESSION* env vars (DEV-1469) (@jLopezbarb)
- **PR #5162** (2026-09-28): build(deps): bump github.com/containerd/containerd/v2 from 2.2.8 to 2.2.9 (@dependabot[bot])
- **PR #5161** (2026-09-25): chore(deps): Update github.com/tonistiigi/fsutil digest to 83cac42 (@oktetobot)
- **PR #5160** (2026-09-25): build(deps): bump renovatebot/github-action from 46.3.1 to 46.3.3 (@dependabot[bot])
- **PR #5159** (2026-09-24): chore(deps): Update cli-and-logging (@oktetobot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

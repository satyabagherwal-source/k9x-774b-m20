# Forensic Learning Record (Deep Inspection): easegress-io/easegress

> **Canonical Artifact**: `07_PROJECT_LEARNING/easegress-io-easegress-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/easegress-io/easegress](https://github.com/easegress-io/easegress))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:29:52.176Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `easegress-io/easegress`
- **Description**: A Cloud Native traffic orchestration system. (CNCF Project)
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5871 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/client/command/alias.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Package command provides the commands.
package command

import "github.com/megaease/easegress/v2/cmd/client/general"

var makePath = general.MakePath

const (
	apiURL = general.APIURL

	membersURL = general.MembersURL
	memberURL  = general.MemberItemURL

	objectKindsURL = general.ObjectKindsURL
	objectsURL     = general.ObjectsURL
	objectURL      = general.ObjectItemURL

	statusObjectURL  = general.StatusObjectItemURL
	statusObjectsURL = general.StatusObjectsURL

	customDataKindURL     = general.CustomDataKindURL
	customDataKindItemURL = general.CustomDataKindItemURL
	customDataURL         = general.CustomDataURL
	customDataItemURL     = general.CustomDataItemURL
)

```

### Core Architecture Module: `cmd/client/command/api.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Package command provides the commands.
package command

import (
	"net/http"

	"github.com/spf13/cobra"
)

// APICmd defines API command.
func APICmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "api",
		Short: "(Deprecated) View Easegress APIs",
	}

	cmd.AddCommand(listAPICmd())
	return cmd
}

func listAPICmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List Easegress APIs",
		Run: func(cmd *cobra.Command, args []string) {
			handleRequest(http.MethodGet, makePath(apiURL), nil, cmd)
		},
	}

	return cmd
}

```

### Core Architecture Module: `cmd/client/command/customdata.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Package command provides the commands.
package command

import (
	"errors"
	"net/http"

	"github.com/spf13/cobra"
)

// CustomDataKindCmd defines custom data kind command.
func CustomDataKindCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "custom-data-kind",
		Short: "(Deprecated) View and change custom data kind",
	}

	cmd.AddCommand(listCustomDataKindCmd())
	cmd.AddCommand(getCustomDataKindCmd())
	cmd.AddCommand(createCustomDataKindCmd())
	cmd.AddCommand(updateCustomDataKindCmd())
	cmd.AddCommand(deleteCustomDataKindCmd())

	return cmd
}

func listCustomDataKindCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List all custom data kinds",
		Example: "egctl custom-data-kind list",

		Run: func(cmd *cobra.Command, args []string) {
			handleRequest(http.MethodGet, makePath(customDataKindURL), nil, cmd)
		},
	}

	return cmd
}

func getCustomDataKindCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "get",
		Short:   "Get a custom data kind",
		Example: "egctl custom-data-kind get <kind>",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) != 1 {
				return errors.New("requires custom data kind to be retrieved")
			}
			return nil
		},

		Run: func(cmd *cobra.Command, args []string) {
			handleRequest(http.MethodGet, makePath(customDataKindItemURL, args[0]), nil, cmd)
		},
	}

	return cmd
}

func createCustomDataKindCmd() *cobra.Command {
	var specFile string
	cmd := &cobra.Command{
		Use:     "create",
		Short:   "Create a custom data kind from a yaml file or stdin",
		Example: "egctl custom-data-kind create -f <kind file>",
		Run: func(cmd *cobra.Command, args []string) {
			visitor := buildYAMLVisitor(specFile, cmd)
			visitor.Visit(func(yamlDoc []byte) error {
				handleRequest(http.MethodPost, makePath(customDataKindURL), yamlDoc, cmd)
				return nil
			})
			visitor.Close()
		},
	}

	cmd.Flags().StringVarP(&specFile, "file", "f", "", "A yaml file specifying the change request.")

	return cmd
}

func updateCustomDataKindCmd() *cobra.Command {
	var specFile string
	cmd := &cobra.Command{
		Use:     "update",
		Short:   "Update a custom data from a yaml file or stdin",
		Example: "egctl custom-data-kind update -f <kind file>",
		Run: func(cmd *cobra.Command, args []string) {
			visitor := buildYAMLVisitor(specFile, cmd)
			visitor.Visit(func(yamlDoc []byte) error {
				handleRequest(http.MethodPut, makePath(customDataKindURL), yamlDoc, cmd)
				return nil
			})
			visitor.Close()
		},
	}

	cmd.Flags().StringVarP(&specFile, "file", "f", "", "A yaml file specifying the change request.")

	return cmd
}

func deleteCustomDataKindCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "delete",
		Short:   "Delete a custom data kind",
		Example: "egctl custom-data-kind delete <kind>",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) != 1 {
				return errors.New("requires custom data kind to be retrieved")
			}
			return nil
		},

		Run: func(cmd *cobra.Command, args []string) {
			handleRequest(http.MethodDelete, makePath(customDataKindItemURL, args[0]), nil, cmd)
		},
	}

	return cmd
}

// CustomDataCmd defines custom data command.
func CustomDataCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "custom-data",
		Short: "(Deprecated) View and change custom data",
	}

	cmd.AddCommand(listCustomDataCmd())
	cmd.AddCommand(getCustomDataCmd())
	cmd.AddCommand(createCustomDataCmd())
	cmd.AddCommand(updateCustomDataCmd())
	cmd.AddCommand(batchUpdateCustomDataCmd())
	cmd.AddCommand(deleteCustomDataCmd())

	return cmd
}

func getCustomDataCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "get",
		Short:   "Get a custom data",
		Example: "egctl custom-data get <kind> <id>",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) != 2 {
				return errors.New("requires custom data kind and id to be retrieved")
			}
			return nil
		},

		Run: func(cmd *cobra.Command, args []string) {
			handleRequest(http.MethodGet, makePath(customDataItemURL, args[0], args[1]), nil, cmd)
		},
	}

	return cmd
}

func listCustomDataCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List all custom data of a kind",
		Example: "egctl custom-data list <kind>",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) != 1 {
				return errors.New("requires custom data kind to be retrieved")
			}
			return nil
		},
		Run: func(cmd *cobra.Command, args []string) {
			handleRequest(http.MethodGet, makePath(customDataURL, args[0]), nil, cmd)
		},
	}

	return cmd
}

func createCustomDataCmd() *cobra.Command {
	var specFile string
	cmd := &cobra.Command{
		Use:     "create",
		Short:   "Create a custom data from a yaml file or stdin",
		Example: "egctl custom-data create <kind> -f <data item file>",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) != 1 {
				return errors.New("requires custom data kind to be retrieved")
			}
			return nil
		},
		Run: func(cmd *cobra.Command, args []string) {
			visitor := buildYAMLVisitor(specFile, cmd)
			visitor.Visit(func(yamlDoc []byte) error {
				handleRequest(http.MethodPost, makePath(customDataURL, args[0]), yamlDoc, cmd)
				return nil
			})
			visitor.Close()
		},
	}

	cmd.Flags().StringVarP(&specFile, "file", "f", "", "A yaml file specifying the change request.")

	return cmd
}

func updateCustomDataCmd() *cobra.Command {
	var specFile string
	cmd := &cobra.Command{
		Use:     "update",
		Short:   "Update a custom data from a yaml file or stdin",
		Example: "egctl custom-data update <kind> -f <data item file>",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) != 1 {
				return errors.New("requires custom data kind to be retrieved")
			}
			return nil
		},
		Run: func(cmd *cobra.Command, args []string) {
			visitor := buildYAMLVisitor(specFile, cmd)
			visitor.Visit(func(yamlDoc []byte) error {
				handleRequest(http.MethodPut, makePath(customDataURL, args[0]), yamlDoc, cmd)
				return nil
			})
			visitor.Close()
		},
	}

	cmd.Flags().StringVarP(&specFile, "file", "f", "", "A yaml file specifying the change request.")

	return cmd
}

func batchUpdateCustomDataCmd() *cobra.Command {
	var specFile string
	cmd := &cobra.Command{
		Use:     "batch-update",
		Short:   "Batch update custom data from a yaml file or stdin",
		Example: "egctl custom-data batch-update <kind> -f <change request file>",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) != 1 {
				return errors.New("requires custom data kind to be retrieved")
			}
			return nil
		},
		Run: func(cmd *cobra.Command, args []string) {
			visitor := buildYAMLVisitor(specFile, cmd)
			visitor.Visit(func(yamlDoc []byte) error {
				handleRequest(http.MethodPost, makePath(customDataItemURL, args[0], "items"), yamlDoc, cmd)
				return nil
			})
			visitor.Close()
		},
	}

	cmd.Flags().StringVarP(&specFile, "file", "f", "", "A yaml file specifying the change request.")

	return cmd
}

func deleteCustomDataCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "delete",
		Short:   "Delete a custom data item",
		Example: "egctl custom-data delete <kind> <id>",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) != 2 {
				return errors.New("requires custom data kind and id to be retrieved")
			}
			return nil
		},
		Run: func(cmd *cobra
```

### Core Architecture Module: `cmd/client/command/member.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Package command provides the commands.
package command

import (
	"errors"
	"net/http"

	"github.com/spf13/cobra"
)

// MemberCmd defines member command.
func MemberCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "member",
		Short: "(Deprecated) View Easegress members",
	}

	cmd.AddCommand(listMemberCmd())
	cmd.AddCommand(purgeMemberCmd())
	return cmd
}

func listMemberCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List Easegress members",
		Run: func(cmd *cobra.Command, args []string) {
			handleRequest(http.MethodGet, makePath(membersURL), nil, cmd)
		},
	}

	return cmd
}

func purgeMemberCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "purge <member name>",
		Short:   "Purge a Easegress member",
		Long:    "Purge a Easegress member. This command should be run after the easegress node uninstalled",
		Example: "egctl member purge <member name>",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) != 1 {
				return errors.New("requires one member name to be deleted")
			}
			return nil
		},
		Run: func(cmd *cobra.Command, args []string) {
			handleRequest(http.MethodDelete, makePath(memberURL, args[0]), nil, cmd)
		},
	}

	return cmd
}

```

### Core Architecture Module: `cmd/client/command/object.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Package command provides the commands.
package command

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/spf13/cobra"
)

// ObjectCmd defines object command.
func ObjectCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "object",
		Aliases: []string{"o", "obj"},
		Short:   "(Deprecated) View and change objects",
	}

	cmd.AddCommand(objectKindsCmd())
	cmd.AddCommand(listObjectsCmd())
	cmd.AddCommand(getObjectCmd())
	cmd.AddCommand(createObjectCmd())
	cmd.AddCommand(updateObjectCmd())
	cmd.AddCommand(deleteObjectCmd())
	cmd.AddCommand(statusObjectCmd())

	return cmd
}

func objectKindsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "kinds",
		Short: "List available object kinds.",
		Run: func(cmd *cobra.Command, args []string) {
			handleRequest(http.MethodGet, makePath(objectKindsURL), nil, cmd)
		},
	}

	return cmd
}

func createObjectCmd() *cobra.Command {
	var specFile string
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create an object from a yaml file or stdin",
		Run: func(cmd *cobra.Command, args []string) {
			visitor := buildSpecVisitor(specFile, cmd)
			visitor.Visit(func(s *spec) error {
				handleRequest(http.MethodPost, makePath(objectsURL), []byte(s.doc), cmd)
				return nil
			})
			visitor.Close()
		},
	}

	cmd.Flags().StringVarP(&specFile, "file", "f", "", "A yaml file specifying the object.")

	return cmd
}

func updateObjectCmd() *cobra.Command {
	var specFile string
	cmd := &cobra.Command{
		Use:   "update",
		Short: "Update an object from a yaml file or stdin",
		Run: func(cmd *cobra.Command, args []string) {
			visitor := buildSpecVisitor(specFile, cmd)
			visitor.Visit(func(s *spec) error {
				handleRequest(http.MethodPut, makePath(objectURL, s.Name), []byte(s.doc), cmd)
				return nil
			})
			visitor.Close()
		},
	}

	cmd.Flags().StringVarP(&specFile, "file", "f", "", "A yaml file specifying the object.")

	return cmd
}

func deleteObjectCmd() *cobra.Command {
	var specFile string
	var allFlag bool
	cmd := &cobra.Command{
		Use:   "delete",
		Short: "Delete an object from a yaml file or name",
		Args: func(cmd *cobra.Command, args []string) error {
			if allFlag {
				if len(specFile) != 0 {
					return errors.New("--all and --file cannot be used together")
				}
				if len(args) != 0 {
					return errors.New("--all and <object_name> cannot be used together")
				}
			}

			if len(args) != 0 && len(specFile) != 0 {
				return errors.New("--file and <object_name> cannot be used together")
			}

			return nil
		},
		Run: func(cmd *cobra.Command, args []string) {
			if allFlag {
				handleRequest(http.MethodDelete, makePath(objectsURL+fmt.Sprintf("?all=%v", true)), nil, cmd)
				return
			}

			if len(specFile) != 0 {
				visitor := buildSpecVisitor(specFile, cmd)
				visitor.Visit(func(s *spec) error {
					handleRequest(http.MethodDelete, makePath(objectURL, s.Name), nil, cmd)
					return nil
				})
				visitor.Close()
				return
			}

			handleRequest(http.MethodDelete, makePath(objectURL, args[0]), nil, cmd)
		},
	}
	cmd.Flags().StringVarP(&specFile, "file", "f", "", "A yaml file specifying the object.")
	cmd.Flags().BoolVarP(&allFlag, "all", "", false, "Delete all object.")
	return cmd
}

func getObjectCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "get",
		Short:   "Get an object",
		Example: "egctl object get <object_name>",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) != 1 {
				return errors.New("requires one object name to be retrieved")
			}

			return nil
		},

		Run: func(cmd *cobra.Command, args []string) {
			handleRequest(http.MethodGet, makePath(objectURL, args[0]), nil, cmd)
		},
	}

	return cmd
}

func listObjectsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List all objects",
		Example: "egctl object list",
		Run: func(cmd *cobra.Command, args []string) {
			handleRequest(http.MethodGet, makePath(objectsURL), nil, cmd)
		},
	}

	return cmd
}

func statusObjectCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "status",
		Aliases: []string{"stat"},
		Short:   "View status of object",
	}

	cmd.AddCommand(getStatusObjectCmd())
	cmd.AddCommand(listStatusObjectsCmd())

	return cmd
}

func getStatusObjectCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "get",
		Short:   "Get status of an object",
		Example: "egctl object status get <object_name>",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) != 1 {
				return errors.New("requires one object name to be retrieved")
			}

			return nil
		},

		Run: func(cmd *cobra.Command, args []string) {
			handleRequest(http.MethodGet, makePath(statusObjectURL, args[0]), nil, cmd)
		},
	}

	return cmd
}

func listStatusObjectsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List all status of objects",
		Example: "egctl object status list",
		Run: func(cmd *cobra.Command, args []string) {
			handleRequest(http.MethodGet, makePath(statusObjectsURL), nil, cmd)
		},
	}

	return cmd
}

```

### Core Architecture Module: `cmd/client/command/utils.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Package command provides the commands.
package command

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/megaease/easegress/v2/cmd/client/general"
	"github.com/megaease/easegress/v2/pkg/util/codectool"
	"github.com/spf13/cobra"
)

func handleRequest(httpMethod string, path string, yamlBody []byte, cmd *cobra.Command) {
	body, err := handleRequestV1(httpMethod, path, yamlBody, cmd)
	if err != nil {
		general.ExitWithError(err)
	}

	if len(body) != 0 {
		general.PrintBody(body)
	}
}

func handleRequestV1(httpMethod string, path string, yamlBody []byte, cmd *cobra.Command) (body []byte, err error) {
	var jsonBody []byte
	if yamlBody != nil {
		var err error
		jsonBody, err = codectool.YAMLToJSON(yamlBody)
		if err != nil {
			return nil, fmt.Errorf("yaml %s to json failed: %v", yamlBody, err)
		}
	}

	url, err := general.MakeURL(path)
	if err != nil {
		return nil, err
	}
	client, err := general.GetHTTPClient()
	if err != nil {
		return nil, err
	}
	resp, body := doRequestV1(httpMethod, url, jsonBody, client, cmd)

	msg := string(body)
	if strings.HasPrefix(url, general.HTTPProtocol) && resp.StatusCode == http.StatusBadRequest && strings.Contains(strings.ToUpper(msg), "HTTPS") {
		resp, body = doRequestV1(httpMethod, general.HTTPSProtocol+strings.TrimPrefix(url, general.HTTPProtocol), jsonBody, client, cmd)
	}

	if !general.SuccessfulStatusCode(resp.StatusCode) {
		apiErr := &general.APIErr{}
		err := codectool.Unmarshal(body, apiErr)
		if err == nil {
			msg = apiErr.Message
		}
		return nil, fmt.Errorf("%d: %s", apiErr.Code, msg)
	}
	return body, nil
}

func doRequestV1(httpMethod string, url string, jsonBody []byte, client *http.Client, cmd *cobra.Command) (*http.Response, []byte) {
	req, err := http.NewRequest(httpMethod, url, bytes.NewReader(jsonBody))
	if err != nil {
		general.ExitWithError(err)
	}
	resp, err := client.Do(req)
	if err != nil {
		general.ExitWithErrorf("%s failed: %v", cmd.Short, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		general.ExitWithErrorf("%s failed: %v", cmd.Short, err)
	}
	return resp, body
}

```

### Core Architecture Module: `cmd/client/command/visitor.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Package command provides the commands.
package command

import (
	"bufio"
	"fmt"
	"io"
	"os"

	"github.com/megaease/easegress/v2/cmd/client/general"
	"github.com/spf13/cobra"
	"k8s.io/apimachinery/pkg/util/yaml"
)

// YAMLVisitor walk through multiple YAML documents
type YAMLVisitor interface {
	Visit(func(yamlDoc []byte) error) error
	Close()
}

type yamlVisitor struct {
	reader io.Reader
}

// Visit implements YAMLVisitor
func (v *yamlVisitor) Visit(fn func(yamlDoc []byte) error) error {
	r := yaml.NewYAMLReader(bufio.NewReader(v.reader))

	for {
		data, err := r.Read()
		if len(data) == 0 {
			if err == io.EOF {
				return nil
			}
			if err != nil {
				return err
			}
			continue
		}
		if err = fn(data); err != nil {
			return err
		}
	}
}

// Close closes the yamlVisitor
func (v *yamlVisitor) Close() {
	if closer, ok := v.reader.(io.Closer); ok {
		closer.Close()
	}
}

type spec struct {
	Kind string
	Name string
	doc  string
}

// SpecVisitor walk through multiple specs
type SpecVisitor interface {
	Visit(func(*spec) error) error
	Close()
}

type specVisitor struct {
	v YAMLVisitor
}

// Visit implements SpecVisitor
func (v *specVisitor) Visit(fn func(*spec) error) error {
	var specs []spec

	err := v.v.Visit(func(yamlDoc []byte) error {
		s := spec{}
		doc := string(yamlDoc)

		err := yaml.Unmarshal(yamlDoc, &s)
		if err != nil {
			return fmt.Errorf("error parsing %s: %v", doc, err)
		}

		if s.Name == "" {
			return fmt.Errorf("name is empty: %s", doc)
		}

		if s.Kind == "" {
			return fmt.Errorf("kind is empty: %s", doc)
		}

		s.doc = doc
		specs = append(specs, s)
		return nil
	})

	if err != nil {
		general.ExitWithError(err)
	}

	for _, s := range specs {
		fn(&s)
	}

	return nil
}

// Close closes the specVisitor
func (v *specVisitor) Close() {
	v.v.Close()
}

func buildYAMLVisitor(yamlFile string, cmd *cobra.Command) YAMLVisitor {
	var r io.ReadCloser
	if yamlFile == "" {
		r = io.NopCloser(os.Stdin)
	} else if f, err := os.Open(yamlFile); err != nil {
		general.ExitWithErrorf("%s failed: %v", cmd.Short, err)
	} else {
		r = f
	}
	return &yamlVisitor{reader: r}
}

func buildSpecVisitor(yamlFile string, cmd *cobra.Command) SpecVisitor {
	v := buildYAMLVisitor(yamlFile, cmd)
	return &specVisitor{v: v}
}

```

### Core Architecture Module: `cmd/client/commandv2/ai.go`
```
/*
 * Copyright (c) 2017, The Easegress Authors
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Package commandv2 provides the new version of commands.
package commandv2

import (
	"fmt"
	"net/http"

	"github.com/megaease/easegress/v2/cmd/client/general"
	"github.com/megaease/easegress/v2/cmd/client/resources"
	"github.com/megaease/easegress/v2/pkg/object/aigatewaycontroller"
	"github.com/megaease/easegress/v2/pkg/object/aigatewaycontroller/metricshub"
	"github.com/megaease/easegress/v2/pkg/util/codectool"
	"github.com/spf13/cobra"
)

// AICmd returns AI command.
func AICmd() *cobra.Command {
	examples := []general.Example{
		{Desc: "Enable AI (Create the AIGatewayController)", Command: "egctl enable"},
		{Desc: "Disable AI (Delete the AIGatewayController)", Command: "egctl disable"},
		{Desc: "Get AI statistics", Command: "egctl ai stat"},
		{Desc: "Check AI health of providers", Command: "egctl ai check"},
	}

	cmd := &cobra.Command{
		Use:     "ai",
		Short:   "Commands to manage AI Gateway",
		Args:    cobra.NoArgs,
		Example: createMultiExample(examples),
		Run:     aiCmdRun,
	}

	cmd.AddCommand(
		enableCmd(),
		disableCmd(),
		statCmd(),
		checkCmd(),
		editCmd(),
	)

	return cmd
}

func aiCmdRun(cmd *cobra.Command, args []string) {
	cmd.Help()
}

func enableCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "enable",
		Short: "Enable AI Gateway (create AIGatewayController)",
		Run: func(cmd *cobra.Command, args []string) {
			var err error
			defer func() {
				if err != nil {
					general.ExitWithError(err)
				}

				fmt.Println("AI Gateway enabled successfully.")
				fmt.Println("You can use `egctl ai edit` to add providers and middlewares.")
			}()

			s, err := general.GetSpecFromYaml(`kind: AIGatewayController
name: AIGatewayController
`)
			if err != nil {
				return
			}

			err = resources.CreateObject(cmd, s)
		},
	}
}

func disableCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "disable",
		Short: "Disable AI Gateway (delete AIGatewayController)",
		Run: func(cmd *cobra.Command, args []string) {
			var err error
			defer func() {
				if err != nil {
					general.ExitWithError(err)
				}
				fmt.Println("AI Gateway disabled successfully.")
			}()

			err = resources.DeleteObject(cmd, "AIGatewayController", []string{"AIGatewayController"}, false)
		},
	}
}

func statCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "stat",
		Short:   "Get AI Gateway statistics",
		Example: createExample("Get AI Gateway statistics.", "egctl ai stat"),
		Args:    cobra.NoArgs,
		Run: func(cmd *cobra.Command, args []string) {
			body, err := general.HandleRequest(http.MethodGet, general.AIStatURL, nil)
			if err != nil {
				general.ExitWithError(err)
			}

			if !general.CmdGlobalFlags.DefaultFormat() {
				general.PrintBody(body)
				return
			}

			type AIStatResponse struct {
				Stats []metricshub.MetricStats `json:"stats"`
			}

			var statResp AIStatResponse
			err = codectool.UnmarshalJSON(body, &statResp)
			if err != nil {
				general.ExitWithError(err)
			}

			// Output table:
			// PROVIDER (TYPE), MODEL @ BASEURL, RESP_TYPE,
			// TOTAL_REQUESTS, SUCCESS/FAILED, AVG_DURATION(ms),
			// TOKENS (INPUT/OUTPUT)

			table := [][]string{
				{
					"PROVIDER(TYPE)",
					"MODEL@BASEURL",
					"RESP-TYPE",
					"TOTAL-REQ",
					"SUCCESS/FAILED",
					"AVG-DUR(ms)",
					"TOKENS(INPUT/OUTPUT)",
				},
			}
			for _, stat := range statResp.Stats {
				table = append(table, []string{
					fmt.Sprintf("%s(%s)", stat.Provider, stat.ProviderType),
					fmt.Sprintf("%s@%s", stat.Model, stat.BaseURL),
					stat.RespType,
					fmt.Sprintf("%d", stat.TotalRequests),
					fmt.Sprintf("%d/%d", stat.SuccessRequests, stat.FailedRequests),
					fmt.Sprintf("%d", stat.RequestAverageDuration),
					fmt.Sprintf("%d/%d", stat.PromptTokens, stat.CompletionTokens),
				})
			}
			general.PrintTable(table)
		},
	}
}

func checkCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "check",
		Short: "Check AI Gateway health of providers",
		Args:  cobra.NoArgs,
		Run: func(cmd *cobra.Command, args []string) {
			body, err := general.HandleRequest(http.MethodGet, general.AISProviderstatusURL, nil)
			if err != nil {
				general.ExitWithError(err)
			}
			if !general.CmdGlobalFlags.DefaultFormat() {
				general.PrintBody(body)
				return
			}

			var statusResp aigatewaycontroller.HealthCheckResponse
			err = codectool.UnmarshalJSON(body, &statusResp)
			if err != nil {
				general.ExitWithError(err)
			}

			table := [][]string{
				{"NAME", "PROVIDER-TYPE", "HEALTHY"},
			}
			for _, result := range statusResp.Results {
				var healthy string
				if result.Healthy {
					healthy = "YES"
				} else {
					healthy = fmt.Sprintf("NO(%s)", result.Error)
				}

				table = append(table, []string{
					result.Name,
					result.ProviderType,
					healthy,
				})
			}
			general.PrintTable(table)
		},
	}
}

func editCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "edit",
		Short: "Edit AI Gateway providers",
		Run: func(cmd *cobra.Command, args []string) {
			args = []string{"AIGatewayController", "AIGatewayController"}
			editCmdRun(cmd, args)
		},
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1170** (2024-01-28): **[Bug]: easegress-server --signal-upgrade=true panic**
  *Symptoms*:  - Easegress v2.6.4 - 22.04.1-Ubuntu x86_64  ---  When I reload the easegress-server with command `easegress-server --signal-upgrade=true`. It will panic.  ``` panic: close of closed channel  goroutine 1 [running]: github.com/megaease/easegress/v2/pkg/api.(*dynamicMux).close(...)         github.com/megaease/easegress/v2/pkg/api/dynamicmux.go:139 github.com/megaease/easegress/v2/pkg/api.(*Server).Close(0xc000401900, 0x0?)         github.com/megaease/easegress/v2/pkg/api/server.go:131 +0x111 github.com/megaease/easegress/v2/cmd.RunServer()         github.com/megaease/easegress/v2/cmd/server.go:142 +0x78a main.main()         github.com/megaease/easegress/v2/cmd/server/main.go:27 +0x17 ```
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for you report, we will check what happens here...
  > Fixed

- **Issue #1108** (2023-12-15): **[Bug]: Easegress obejct status api prefix issue**
  *Symptoms*: Since Easegress support multi node. When call `/status/objects/{name}` api, Easegress use prefix to fetch status from all node.   For example, when call `/status/objects/httpserver-demo` it will return `/status/objects/httpserver-demo/node1` and `/status/objects/httpserver-demo/node2`.   But if there is a object called `/status/objects/httpserver-demo-123`, when call  `/status/objects/httpserver-demo`, it will return `/status/objects/httpserver-demo/node1`, `/status/objects/httpserver-demo/node2`, `/status/objects/httpserver-demo-123/node1`, `/status/objects/httpserver-demo-123/node2`.   To solve this problem, we should use `/status/objects/httpserver-demo/` as prefix not `/status/objects/httpserver-demo`. Add `/` to the end.

- **Issue #1019** (2023-06-21): **[Bug]: wrong version of slim-sprig**
  *Symptoms*: **Describe the bug** I think easegress used the wrong version of [slim-sprig](https://github.com/go-task/slim-sprig). v2.20.0 is an old version, in which the "get" API was not even available for dict. Therefore, this will affect obtaining the `data` in the pipeline.  **To Reproduce** Just try using `get $.data.PIPELINE` in v2.4.1 or later  
  **Post-Mortem & Fix Analysis**:
  > hi @hexinzhe , I checked `go.mod` and think we are using the correct version of `slim-sprig`.  could you please provide the full yaml configuration of your pipeline and the detailed error message?
  > Just check https://github.com/go-task/slim-sprig/blob/v2.20.0/dict.go and https://github.com/go-task/slim-sprig/blob/master/dict.go, the `get` function in version v2.20.0 does not exist. 
  > @localvar   ```yaml name: fallback kind: Pipeline flow:   - filter: proxy     jumpIf:       serverError: errResponse       "": END   - filter: errResponse filters:   - name: proxy     kind: Proxy     pools:       - servers:           - url: {PROXY_SERVER}    - name: errResponse     kind: ResponseBuilder     template: |       {{ $url := "null" }}       {{- range $k, $v := .requests.DEFAULT.Header -}}       {{$value := index $v 0}}       {{- if (regexMatch "^[0-9a-zA-Z].*"  $value) }}       {{- if (eq "server-name" (lower $k)) }}       {{ $u := get $.data.PIPELINE $value }}       {{ $url = $u.redirect }}       {{- end -}}       {{- end -}}       {{- end -}}       {{log "info" (printf "fallback to %s%s?%s" $url .requests.DEFAULT.URL.Path .requests.DEFAULT.URL.RawQuery)}}              statusCode: 302       headers:         Location: ["{{$url}}{{.requests.DEFAULT.URL.Path}}?{{.requests.DEFAULT.URL.RawQuery}}"]   - name: defaultResponse     kind: Response

- **Issue #981** (2023-05-04): **[Bug]: The WebSocketProxy Filter does not work**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  Using `curl` to send a request will get a successful response by following the [WebSocket Cookbook](https://github.com/megaease/easegress/blob/main/doc/cookbook/websocket.md)   But after a real WebSocket server and client are deployed, the connection is not established.  The error in easegress's log:  > ERROR   httpproxy/wspool.go:183 websocketproxy#wsproxy#main: dial to ws://127.0.0.1:8765 failed: websocket.Dial ws://127.0.0.1:8765/ws: unsupported extensions    **To Reproduce** Steps to reproduce the behavior:  1. WebSocket server: ```python import asyncio import websockets  async def hello(websocket, path):     name = await websocket.recv()     print(f"Greetings {name}!")      greeting = f"Hello {name}!"     await websocket.send(greeting)  start_server = websockets.serve(hello, "localhost", 8765)  asyncio.get_event_loop().run_until_complete(start_server) asyncio.get_event_loop().run_forever() ``` 2. Websocket Client:  ```python import asyncio import websockets  async def hello():     async with websockets.connect("ws://localhost:8765/ws") as websocket:         name = "John"         await websocket.send(name)         greeting = await websocket.recv()         print(f"{greeting}")  asyncio.get_event_loop().run_until_complete(hello()) ```  the client was verified by sending to the server directly and through an Nginx reverse proxy.  4. config a Easegress ht

- **Issue #938** (2023-03-03): **[Bug]: wasm apply data command not worked**
  *Symptoms*: **Describe the bug** Hi guys, I found two kind of issues when walking through our [Flash Sale](https://github.com/megaease/easegress/blob/main/doc/cookbook/flash-sale.md) demo.  **Issue 1:** Parameters' type error in section 6.1 example spec  According to WasmHost filter's spec declaration, [parameters](https://github.com/megaease/easegress/blob/main/pkg/filters/wasmhost/wasmhost.go#L94)' value type should be `string`:  ```go type Spec struct {      Parameters     map[string]string `json:"parameters" jsonschema:"omitempty"`  } ```  But the example in section [6.1 Parameters](https://github.com/megaease/easegress/blob/main/doc/cookbook/flash-sale.md#61-parameters) used a number value: ```yaml filters:   - name: wasm     kind: WasmHost     parameters:                                        # +       startTime: "2021-08-08T00:00:00+00:00"           # +       blockRatio: 0.4                                  # +       maxPermission: 3                                 # + ``` So `egctl` client returned error: ```shell Error: 400: {"generalErrs":["*pipeline.Spec: filters: json: cannot unmarshal number into Go struct field Spec.parameters of type string"]} ``` ---  **Issue 2:** Wasm `apply-data` command not worked  When executing the command below, I got this error: ```shell $ echo ' id/user4: "true" id/user5: "true"' | egctl wasm apply-data flash-sale-pipeline wasm Error: name is empty: id/user4: "true" id/user5: "true" ```  I found that we 

- **Issue #908** (2023-01-28): **[Bug]: API Aggregation cookbook examples not work for me.**
  *Symptoms*: **Describe the bug** Hi there, I have some trouble when walking through our API Aggregation cookbook. Need HELP! 🆘   There's two kind of problems:  **Problem 1** In scenario 1 and 2, when using example specs, I got this error: ``` 2023-01-28T13:37:57.542+08:00   WARN    builder/responsebuilder.go:131  ResponseBuilder(buildResponse): failed to build response info: yaml: line 1: did not find expected key 2023-01-28T13:37:57.542+08:00   ERROR   httpserver/mux.go:225   server-demo: response is nil ``` And I found that, in line `pkg/filters/builder/builder.go:65`, the result which should be unmarshaled was an invalid YAML data: ``` statusCode: 200 body: "[{"mega":"ease"}, {"hello":"world"}, {"hello":"new world"}]" ----------^ ```` After changing the ResponseBuilder template like this: ```diff diff --git a/doc/cookbook/api-aggregation.md b/doc/cookbook/api-aggregation.md index 4107e7c0..e980c73a 100644 --- a/doc/cookbook/api-aggregation.md +++ b/doc/cookbook/api-aggregation.md @@ -68,7 +68,8 @@ filters:    kind: ResponseBuilder    template: |      statusCode: 200 -    body: "[{{.responses.demo1.Body}}, {{.responses.demo2.Body}}, {{.responses.demo3.Body}}]" +    body: | +      [{{.responses.demo1.Body}}, {{.responses.demo2.Body}}, {{.responses.demo3.Body}}]  @@ -147,7 +148,8 @@ filters:    kind: ResponseBuilder    template: |      statusCode: 200 -    body: "{{mergeObject .responses.demo1.JSONBody .responses.demo2.JSONBody .responses.demo3.JSONBod
  **Post-Mortem & Fix Analysis**:
  > Thanks @grootpiano for pointing these issues out, and much appreciate if you could submit a PR to fix them.
  > > Thanks @grootpiano for pointing these issues out, and much appreciate if you could submit a PR to fix them.  That's so sure. It's my pleasure! Waiting, the PR is on the way. 🏃 

- **Issue #850** (2022-11-08): **[Bug]: codectool duplicate Unmarshal json**
  *Symptoms*: **Describe the bug**  I found duplicate Unmarshal in the course of reading the code  branch: master commit: b7ba81d9 path : `github.com/megaease/easegress/pkg/util/codectool`  ``` go // Unmarshal wraps json.Unmarshal. // It will convert yaml to json before unmarshal. // Since json is a subset of yaml, passing json through this method should be a no-op. func Unmarshal(data []byte, v interface{}) error { 	data, err := yamljsontool.YAMLToJSON(data) 	if err != nil { 		return fmt.Errorf("%s: convert yaml to json failed: %v", data, err) 	} 	json.Unmarshal(data, v)  	return json.Unmarshal(data, v) } ```  

- **Issue #800** (2022-09-22): **[Bug]: EaseMonitorMetrics Status error**
  *Symptoms*: **Describe the bug** I need to send the monitoring data to Kafka, but I find that it is not sent successfully  ```  - kafka:     brokers:         - 127.0.0.1:9092     topic: metrics   kind: EaseMonitorMetrics   name: easemonitor-metrics-example   version: easegress.megaease.com/v2  ```  When I change the following code (statussynccontroller.go)   ``` 					su := newStatusUnit(namespace, trafficObject.Name, 						unixTimestamp, trafficObject.TrafficObjectStatus)  ``` into  ``` 					su := newStatusUnit(namespace, trafficObject.Name, 						unixTimestamp, trafficObject.TrafficObjectStatus.Status) // change ```  The problem is solved  Hopefully it will be validated and submitted to new code    --- Thanks for contributing 🎉! 
  **Post-Mortem & Fix Analysis**:
  > Thanks a lot for your issue.  It seems `EaseMonitorMetrics` only send status that implement `easemonitor.Metricer` interface to kafka backend. So for `trafficObject.TrafficObjectStatus` not implement this interface, but  `trafficObject.TrafficObjectStatus.Status` implements this interface.   Compare to change  ``` su := newStatusUnit(namespace, trafficObject.Name, 						unixTimestamp, trafficObject.TrafficObjectStatus.Status) ``` I prefer to implement `easemonitor.Metricer` to `trafficObject.TrafficObjectStatus`, so it will not influence previous code and solve this problem.  ``` func (s *TrafficObjectStatus) ToMetrics(service string) []*easemonitor.Metrics { 	metricer, ok := s.Status.(easemonitor.Metricer) 	if !ok { 		return nil 	} 	return metricer.ToMetrics(service) } ``` Any idea here?
  > good，Thanks 

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

### Incident Patch 1: `3fd0fa89` (2026-06-04)
**Commit Message**: fix: build/package/Dockerfile.builder to reduce vulnerabilities (#1519)

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-ALPINE323-OPENSSL-15993266
- https://snyk.io/vuln/SNYK-ALPINE323-OPENSSL-15993266
- https://snyk.io/vuln/SNYK-ALPINE323-OPENSSL-15993253
- https://snyk.io/vuln/SNYK-ALPINE323-OPENSSL-15993258
- https://snyk.io/vuln/SNYK-ALPINE323-OPENSSL-15993259

Co-authored-by: snyk-bot <snyk-bot@snyk.io>

**File**: `build/package/Dockerfile.builder` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-FROM golang:1.26.1-alpine
+FROM golang:1.26.4-alpine
 RUN apk --no-cache add make git
```

---

### Incident Patch 2: `b6be769f` (2026-05-29)
**Commit Message**: fix(grpcproxy): do not degrade pool on gRPC application-level errors (fixes #1517) (#1518)

* fix(grpcproxy): do not degrade pool on gRPC application-level errors

When a backend service returns a well-formed gRPC status error (e.g.
NOT_FOUND / codes.Code 5, INVALID_ARGUMENT, etc.) biTransportProxy()
was calling svr.close(resultServerError), which marked the connection
as broken and removed it from the pool.  The next call then blocked
indefinitely on pool.borrow() until the outer context deadline fired.

Root cause:
  biTransport() compared s2cErr != io.EOF and returned resultServerError
  for every non-EOF, including valid gRPC status errors.  A gRPC status
  error indicates the backend communicated an application result over a
  healthy connection; it is not a transport failure.

Fix:
  Use status.FromError() to distinguish the two cases:
  - ok == true  → valid gRPC status, connection healthy → return nil
  - ok == false → transport failure (broken pipe, TLS reset, etc.)
                 → return resultServerError as before

Example failure sequence this fixes:
  1. Call A → backend returns NOT_FOUND → biTransport marks pool entry
     resultServerError → pool.borrow() has noth

**File**: `pkg/filters/proxies/grpcproxy/pool.go` (modified, +14/-0)
```diff
@@ -366,6 +366,20 @@ func (sp *ServerPool) biTransport(ctx *serverPoolContext, proxyAsClientStream gr
 			ctx.resp.SetTrailer(grpcprot.NewTrailer(proxyAsClientStream.Trailer()))
 			// c2sErr will contain RPC error from client code. If not io.EOF return the RPC error as server stream error.
 			if s2cErr != io.EOF {
+				// A well-formed gRPC status error means the backend communicated an
+				// application-level result (e.g. NOT_FOUND, INVALID_ARGUMENT) over a
+				// healthy connection. Marking the pool entry as resultServerError in
+				// that case degrades a perfectly usable backend connection and causes
+				// subsequent calls to stall waiting on pool.borrow(). Only return
+				// resultServerError for transport-level failures (non-gRPC errors)
+				// where the connection itself is broken.
+				if st, isGRPCStatus := status.FromError(s2cErr); isGRPCStatus {
+					// Preserve the backend's gRPC status so the caller receives the
+					// correct code (e.g. NOT_FOUND, INVALID_ARGUMENT). The connection
+					// itself is healthy so we still return nil to avoid pool degradation.
+					ctx.resp.SetStatus(st)
+					return nil
+				}
 				return serverPoolError{status.Convert(s2cErr), resultServerError}
 			}
 			return nil
```

**File**: `pkg/filters/proxies/grpcproxy/pool_test.go` (modified, +117/-0)
```diff
@@ -19,6 +19,7 @@ package grpcproxy
 
 import (
 	"context"
+	"io"
 	"math/rand"
 	"sync"
 	"testing"
@@ -28,7 +29,9 @@ import (
 	"github.com/megaease/easegress/v2/pkg/filters/proxies"
 	"github.com/megaease/easegress/v2/pkg/util/objectpool"
 	"github.com/stretchr/testify/assert"
+	"google.golang.org/grpc"
 	"google.golang.org/grpc/codes"
+	"google.golang.org/grpc/metadata"
 	"google.golang.org/grpc/status"
 )
 
@@ -241,3 +244,117 @@ name: grpcforwardproxy
 	request.Header().Set("targetAddress", "192.168.1.1")
 	at.Equal("", proxy.mainPool.getTarget(proxy.mainPool.LoadBalancer().ChooseServer(request).URL))
 }
+
+// biTransportClientStream is a minimal grpc.ClientStream that returns a
+// predetermined error from RecvMsg and blocks the caller until the provided
+// done channel is closed.
+type biTransportClientStream struct {
+	grpc.ClientStream
+	recvErr error
+}
+
+func (m *biTransportClientStream) Header() (metadata.MD, error)  { return metadata.New(nil), nil }
+func (m *biTransportClientStream) Trailer() metadata.MD          { return metadata.New(nil) }
+func (m *biTransportClientStream) CloseSend() error              { return nil }
+func (m *biTransportClientStream) Context() context.Context      { return context.Background() }
+func (m *biTransportClientStream) SendMsg(msg interface{}) error { return nil }
+func (m *biTransportClientStream) RecvMsg(msg interface{}) error { return m.recvErr }
+
+// biTransportServerStream is a minimal grpc.ServerStream whose RecvMsg blocks
+// until the done channel is closed, simulating a client that has not finished
+// sending. This prevents the c2sErrChan from racing with s2cErrChan in tests.
+type biTransportServerStream struct {
+	grpc.ServerStream
+	done <-chan struct{}
+}
+
+func (m *biTransportServerStream) Context() context.Context        { return context.Background() }
+func (m *biTransportServerStream) SetHeader(md metadata.MD) error  { return nil }
+func (m *biTransportServerStream) SendHeader(md metadata.MD) error { return nil }
+func (m *biTransportServerStream) SetTrailer(md metadata.MD)       {}
+func (m *biTransportServerStream) SendMsg(msg interface{}) error   { return nil }
+func (m *biTransportServerStream) RecvMsg(msg interface{}) error {
+	<-m.done
+	return io.EOF
+}
+
+// TestBiTransportDoesNotDegradePoolOnGRPCAppError verifies that biTransport
+// returns nil (no pool degradation) when the backend responds with a valid
+// gRPC application-level status (e.g. NOT_FOUND, codes.Code 5). Previously,
+// any non-EOF error from the backend would call svr.close(resultServerError),
+// degrading the pool and causing subsequent calls to stall on pool.borrow().
+func TestBiTransportDoesNotDegradePoolOnGRPCAppError(t *testing.T) {
+	sp := &ServerPool{}
+
+	cases := []struct {
+		name     string
+		err      error
+		wantNil  bool
+		wantCode codes.Code // non-OK: assert spCtx.resp carries this status; OK means skip (e.g. io.EOF)
+	}{
+		{
+			name:     "NOT_FOUND is an application error — pool must not degrade",
+			err:      status.Error(codes.NotFound, "resource not found"),
+			wantNil:  true,
+			wantCode: codes.NotFound,
+		},
+		{
+			name:     "INVALID_ARGUMENT is an application error — pool must not degrade",
+			err:      status.Error(codes.InvalidArgument, "bad request"),
+			wantNil:  true,
+			wantCode: codes.InvalidArgument,
+		},
+		{
+			name:     "INTERNAL is a server-side gRPC error — pool must not degrade",
+			err:      status.Error(codes.Internal, "internal error"),
+			wantNil:  true,
+			wantCode: codes.Internal,
+		},
+		{
+			name:    "io.EOF is the happy-path completion — pool must not degrade",
+			err:     io.EOF,
+			wantNil: true,
+			// wantCode left as codes.OK — no status assertion for the normal success path
+		},
+		{
+			name:    "plain transport error — pool should degrade",
+			err:     io.ErrUnexpectedEOF,
+			wantNil: false,
+		},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			done := make(chan struct{})
+
```

---

### Incident Patch 3: `beb02b19` (2026-03-10)
**Commit Message**: fix: build/package/Dockerfile.builder to reduce vulnerabilities (#1504)

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-ALPINE323-ZLIB-15435528
- https://snyk.io/vuln/SNYK-ALPINE323-ZLIB-15435529

Co-authored-by: snyk-bot <snyk-bot@snyk.io>

**File**: `build/package/Dockerfile.builder` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-FROM golang:1.24-alpine
+FROM golang:1.25.4-alpine
 RUN apk --no-cache add make git
```

---

### Incident Patch 4: `a2577c8f` (2025-09-18)
**Commit Message**: fix build 32-bit machine constant overflow (#1500)

* fix build 32-bit machine constant overflow

* update goreleaser

**File**: `.goreleaser.yml` (modified, +9/-0)
```diff
@@ -21,6 +21,9 @@ builds:
     goos:
       - linux
       - darwin
+    goarch:
+      - amd64
+      - arm64
     ldflags:
       - -s -w
       - -X github.com/easegress-io/easegress/v2/pkg/version.RELEASE={{ .Tag }}
@@ -35,6 +38,9 @@ builds:
     goos:
       - linux
       - darwin
+    goarch:
+      - amd64
+      - arm64
     ldflags:
       - -s -w
       - -X github.com/easegress-io/easegress/v2/pkg/version.RELEASE={{ .Tag }}
@@ -49,6 +55,9 @@ builds:
     goos:
       - linux
       - darwin
+    goarch:
+      - amd64
+      - arm64
     ldflags:
       - -s -w
       - -X github.com/easegress-io/easegress/v2/pkg/version.RELEASE={{ .Tag }}
```

---

### Incident Patch 5: `ce7c3683` (2025-08-25)
**Commit Message**: bump go version to 1.24 and fix 1.24 go vet (#1481)

**File**: `.github/workflows/code.analysis.yml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ on:
       - ".github/workflows/code.analysis.yml"
 
 env:
-  GO_VERSION: "1.23"
+  GO_VERSION: "1.24"
 
 jobs:
   analysis:
```

**File**: `.github/workflows/golangci.lint.yml` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ on:
       - ".github/workflows/golangci.lint.yml"
 
 env:
-  GO_VERSION: "1.23"
+  GO_VERSION: "1.24"
 
 jobs:
   analysis:
```

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ on:
       - "v*"
 
 env:
-  GO_VERSION: "1.23"
+  GO_VERSION: "1.24"
 
 permissions:
   contents: write
```

**File**: `.github/workflows/test.yml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ on:
       - ".github/workflows/test.yml"
 
 env:
-  GO_VERSION: "1.23"
+  GO_VERSION: "1.24"
 
 jobs:
   test-ubuntu:
```

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ INTEGRATION_TEST_PATH := build/test
 
 # Image Name
 IMAGE_NAME?=megaease/easegress
-BUILDER_IMAGE_NAME?=megaease/golang:1.23-alpine
+BUILDER_IMAGE_NAME?=megaease/golang:1.24-alpine
 
 # Version
 RELEASE?=v2.9.0
```

---

### Incident Patch 6: `c75b13a6` (2025-07-31)
**Commit Message**: Docs: Fix some format and problems (#1467)

* Docs: Fix markdown format problems

* Docs: Fix markdown table

**File**: `docs/02.Tutorials/2.9.AI-Gateway.md` (modified, +13/-8)
```diff
@@ -122,39 +122,44 @@ openai-provider(openai)  gpt-4o@https://api.openai.com  /v1/chat/completions 2
 deepseek-provider(deepseek) deepseek-chat@https://api.deepseek.com /v1/chat/completions 2  2/0  107  18/177
 ```
 
-
 ## Benchmark
 
 In this benchmark, we compare popular open-source solutions providing AI gateway capabilities, including our own `Easegress`, as well as `Kong` and `APISIX`. Our goal is to provide clear, reproducible data to help users choose the right gateway for their scenarios.
 
 ### Test Environment
+
 #### Machine
+
 Benchmark machine: dual Intel Xeon Gold 5220R CPUs (96 cores, 192 threads), 251 GiB RAM.
 
 #### Configs
-See scripts for benchmark in [here](../../scripts/benchmark/aigateway).
+
+See the benchmark scripts in [the benchmark scripts directory](../../scripts/benchmark/aigateway).
 
 #### Mock LLM Server
-To ensure fair comparison and reproducibility, we used a mock LLM server to simulate inference requests and responses. This allows us to focus on the gateway performance itself. 
 
-See mock server implementation [here](../../scripts/benchmark/aigateway/llm/).
+To ensure fair comparison and reproducibility, we used a mock LLM server to simulate inference requests and responses. This allows us to focus on the gateway performance itself.
+
+See the [mock server implementation](../../scripts/benchmark/aigateway/llm/).
 
 ### Benchmark Results
+
 1000 requests with 50 concurrency:
-| Name | QPS (Request/sec) | Latency (ms) | 
+
+| Name | QPS (Request/sec) | Latency (ms) |
 | ---- | ----------------- | ------------ |
 | Easegress | 11075 | 3.9 |
 | APISIX | 10979 | 4.2 |
 | Kong | 7528 | 6.2 |
 
-
 10000 requests with 1000 concurrency:
-| Name | QPS (Request/sec) | Latency (ms) | 
+
+| Name | QPS (Request/sec) | Latency (ms) |
 | ---- | ----------------- | ------------ |
 | Easegress | 13496 | 7.1 |
 | APISIX | 15055 | 6.4 |
 | Kong | 9061 | 10.7 |
 
 The results demonstrate that `Easegress` delivers high throughput and low latency, outperforming `Kong` and matching or slightly trailing `APISIX` in certain high-concurrency scenarios.
 
-See more details of result [here](../../scripts/benchmark/aigateway/result/).
+See more details of the benchmark results in [the benchmark results directory](../../scripts/benchmark/aigateway/result/).
```

**File**: `docs/07.Reference/7.01.Controllers.md` (modified, +10/-0)
```diff
@@ -47,6 +47,14 @@
   - [resilience.Policy](#resiliencepolicy)
     - [Retry Policy](#retry-policy)
     - [CircuitBreaker Policy](#circuitbreaker-policy)
+  - [aigatewaycontroller.ProviderSpec](#aigatewaycontrollerproviderspec)
+    - [Supported Providers](#supported-providers)
+  - [aigatewaycontroller.MiddlewareSpec](#aigatewaycontrollermiddlewarespec)
+  - [aigatewaycontroller.SemanticCacheSpec](#aigatewaycontrollersemanticcachespec)
+  - [aigatewaycontroller.EmbeddingSpec](#aigatewaycontrollerembeddingspec)
+  - [aigatewaycontroller.VectorDBSpec](#aigatewaycontrollervectordbspec)
+  - [aigatewaycontroller.RedisSpec](#aigatewaycontrollerredisspec)
+  - [aigatewaycontroller.PostgresSpec](#aigatewaycontrollerpostgresspec)
 
 As the [architecture diagram](../imgs/architecture.png) shows, the controller is the core entity to control kinds of working. There are two kinds of controllers overall:
 
@@ -931,6 +939,8 @@ See more details about `Retry`, `CircuitBreaker`, or other resilience policies i
 | deploymentID | string            | Deployment ID (used for Azure OpenAI)                         | No       |
 | apiVersion   | string            | API version (used for Azure OpenAI)                           | No       |
 
+#### Supported Providers
+
 The providerType can be one of the following:
 
 - anthropic
```

---

### Incident Patch 7: `2d3791ae` (2025-07-25)
**Commit Message**: fix release yaml (#1464)

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ jobs:
           go mod download
           go test -v ./pkg/...
   integration-test-ubuntu:
-    needs: [test, test-win]
+    needs: [test-ubuntu, test-macos, test-win]
     runs-on: ubuntu-latest
     strategy:
       fail-fast: false
```

---

### Incident Patch 8: `910619af` (2025-07-25)
**Commit Message**: fix release fail (#1463)

**File**: `.github/workflows/release.yml` (modified, +25/-2)
```diff
@@ -12,12 +12,12 @@ permissions:
   contents: write
 
 jobs:
-  test:
+  test-ubuntu:
     runs-on: ${{ matrix.os }}
     strategy:
       fail-fast: false
       matrix:
-        os: [ubuntu-latest, macos-latest]
+        os: [ubuntu-latest]
     steps:
       - name: Set up Go 1.x.y
         uses: actions/setup-go@v4
@@ -31,6 +31,27 @@ jobs:
         shell: bash
         run: |
           make test TEST_FLAGS="-race -covermode=atomic"
+  test-macos:
+    runs-on: ${{ matrix.os }}
+    strategy:
+      fail-fast: false
+      matrix:
+        os: [macos-latest]
+    steps:
+      - name: Set up Go 1.x.y
+        uses: actions/setup-go@v4
+        with:
+          go-version: ${{ env.GO_VERSION }}
+
+      - name: Checkout codebase
+        uses: actions/checkout@v3
+
+      - name: Test
+        shell: bash
+        env:
+          EASEGRESS_TEST_SKIP_DOCKER: "true"
+        run: |
+          make test TEST_FLAGS="-race -coverprofile=coverage.txt -covermode=atomic"
   test-win:
     runs-on: windows-latest
     strategy:
@@ -45,6 +66,8 @@ jobs:
         uses: actions/checkout@v3
 
       - name: Test
+        env:
+          EASEGRESS_TEST_SKIP_DOCKER: "true"
         run: |
           go mod verify
           go mod download
```

---

### Incident Patch 9: `54c1e6d9` (2025-06-26)
**Commit Message**: Fix the match of register and unregister of APIs (#1448)

**File**: `pkg/api/api.go` (modified, +10/-2)
```diff
@@ -74,7 +74,11 @@ func RegisterAPIs(apiGroup *Group) {
 	apis[apiGroup.Group] = apiGroup
 
 	logger.Infof("register api group %s", apiGroup.Group)
-	apisChangeChan <- struct{}{}
+
+	select {
+	case apisChangeChan <- struct{}{}:
+	default:
+	}
 }
 
 // UnregisterAPIs unregisters the API group.
@@ -91,7 +95,11 @@ func UnregisterAPIs(group string) {
 	delete(apis, group)
 
 	logger.Infof("unregister api group %s", group)
-	apisChangeChan <- struct{}{}
+
+	select {
+	case apisChangeChan <- struct{}{}:
+	default:
+	}
 }
 
 func (s *Server) registerAPIs() {
```

**File**: `pkg/object/function/worker/api.go` (modified, +4/-5)
```diff
@@ -42,11 +42,11 @@ func (worker *Worker) faasAPIPrefix() string {
 	return fmt.Sprintf("/faas/%s", worker.name)
 }
 
-const apiGroupName = "faas_admin"
+const APIGroupName = "faas_admin"
 
 func (worker *Worker) registerAPIs() {
 	group := &api.Group{
-		Group: apiGroupName,
+		Group: APIGroupName,
 		Entries: []*api.Entry{
 			{Path: worker.faasAPIPrefix(), Method: "POST", Handler: worker.Create},
 			{Path: worker.faasAPIPrefix(), Method: "GET", Handler: worker.List},
@@ -61,9 +61,8 @@ func (worker *Worker) registerAPIs() {
 	api.RegisterAPIs(group)
 }
 
-// UnregisterAPIs unregister APIs
-func (worker *Worker) UnregisterAPIs() {
-	api.UnregisterAPIs(apiGroupName)
+func (worker *Worker) unregisterAPIs() {
+	api.UnregisterAPIs(APIGroupName)
 }
 
 func (worker *Worker) readFunctionName(w http.ResponseWriter, r *http.Request) (string, error) {
```

**File**: `pkg/object/function/worker/worker.go` (modified, +2/-0)
```diff
@@ -188,6 +188,8 @@ func (worker *Worker) Close() {
 	worker.mutex.Lock()
 	defer worker.mutex.Unlock()
 
+	worker.unregisterAPIs()
+
 	close(worker.done)
 	worker.ingress.Close()
 }
```

**File**: `pkg/object/meshcontroller/api/api.go` (modified, +3/-3)
```diff
@@ -127,7 +127,7 @@ type (
 	}
 )
 
-const apiGroupName = "mesh_admin"
+const APIGroupName = "mesh_admin"
 
 // New creates a API
 func New(superSpec *supervisor.Spec) *API {
@@ -148,12 +148,12 @@ func New(superSpec *supervisor.Spec) *API {
 
 // Close unregisters a API
 func (a *API) Close() {
-	api.UnregisterAPIs(apiGroupName)
+	api.UnregisterAPIs(APIGroupName)
 }
 
 func (a *API) registerAPIs() {
 	group := &api.Group{
-		Group: apiGroupName,
+		Group: APIGroupName,
 		Entries: []*api.Entry{
 			{Path: MeshTenantPrefix, Method: "GET", Handler: a.listTenants},
 			{Path: MeshTenantPrefix, Method: "POST", Handler: a.createTenant},
```

**File**: `pkg/object/mqttproxy/broker.go` (modified, +9/-3)
```diff
@@ -149,6 +149,9 @@ func newBroker(spec *Spec, store storage, muxMapper context.MuxMapper, memberURL
 		broker.sessionCacheMgr = newSessionCacheManager(spec, broker.topicMgr)
 	}
 	broker.connectWatcher()
+
+	broker.registerAPIs()
+
 	return broker
 }
 
@@ -326,7 +329,6 @@ func (b *Broker) handleNewSessionInCluster(clientID string, v *string, sessionIn
 		c.ClientID(), info.EGName)
 	c.kickOut()
 	b.removeClient(clientID)
-
 }
 
 func (b *Broker) deleteSession(clientID string) {
@@ -470,7 +472,6 @@ func (b *Broker) handleConn(conn net.Conn) {
 		b.clients[client.info.cid] = client
 		return nil, nil
 	}(client.info.cid)
-
 	if err != nil {
 		// Concurrent connection exceed maxium quotas, returned
 		return
@@ -639,7 +640,6 @@ func (b *Broker) requestTransferToCertainInstances(span *model.SpanContext, publ
 			resp.Body.Close()
 		}
 	}
-
 }
 
 func (b *Broker) processBrokerModePublish(clientID string, publish *packets.PublishPacket) {
@@ -859,6 +859,10 @@ func (b *Broker) registerAPIs() {
 	api.RegisterAPIs(group)
 }
 
+func (b *Broker) unregisterAPIs() {
+	api.UnregisterAPIs(b.name)
+}
+
 func (b *Broker) setClose() {
 	atomic.StoreInt32(&b.closeFlag, 1)
 }
@@ -869,6 +873,8 @@ func (b *Broker) closed() bool {
 }
 
 func (b *Broker) close() {
+	b.unregisterAPIs()
+
 	b.setClose()
 	close(b.done)
 	b.listener.Close()
```

---

### Incident Patch 10: `221cb89f` (2025-04-03)
**Commit Message**: fix: build/package/Dockerfile.builder to reduce vulnerabilities (#1413)

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-ALPINE320-MUSL-8720638
- https://snyk.io/vuln/SNYK-ALPINE320-MUSL-8720638
- https://snyk.io/vuln/SNYK-ALPINE320-OPENSSL-8235201
- https://snyk.io/vuln/SNYK-ALPINE320-OPENSSL-8690013
- https://snyk.io/vuln/SNYK-ALPINE320-OPENSSL-8710359

Co-authored-by: snyk-bot <snyk-bot@snyk.io>

**File**: `build/package/Dockerfile.builder` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-FROM golang:1.22.7-alpine
+FROM golang:1.24.2-alpine
 RUN apk --no-cache add make git
```

#### Recent Merged Pull Requests:
- **PR #1524** (2026-07-01): Harden Helm admin API defaults (@xxx7xxxx)
- **PR #1523** (closed): [codex] Harden Helm admin API defaults (@xxx7xxxx)
- **PR #1521** (2026-06-26): Update contact info (@xxx7xxxx)
- **PR #1519** (2026-06-04): [Snyk] Security upgrade golang from 1.26.1-alpine to 1.26.4-alpine (@caniszczyk)
- **PR #1518** (2026-05-29): fix(grpcproxy): do not degrade pool on gRPC application-level errors (fixes #1517) (@akpradheeph)
- **PR #1516** (closed): [Snyk] Security upgrade golang from 1.26.1-alpine to 1.26.3-alpine (@xxx7xxxx)
- **PR #1515** (closed): [Snyk] Security upgrade golang from 1.26.1-alpine to 1.26.2-alpine (@xxx7xxxx)
- **PR #1514** (2026-04-01): 📖 Add KubeStellar Console guided install reference (@clubanderson)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

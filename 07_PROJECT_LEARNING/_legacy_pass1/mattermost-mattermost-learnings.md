# Forensic Learning Record (Deep Inspection): mattermost/mattermost

> **Canonical Artifact**: `07_PROJECT_LEARNING/mattermost-mattermost-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mattermost/mattermost](https://github.com/mattermost/mattermost))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T13:57:26.416Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mattermost/mattermost`
- **Description**: Mattermost is an open source platform for secure collaboration across the entire software development lifecycle..
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 39225 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/playbooks/extract.js`
```
'use strict';
const YAML = require('yaml');
const fs = require('fs');
const fetch = require('sync-fetch');

class Extractor {
    constructor() {}

    /**
     * Write YAML data to the specified file, optionally indenting all lines by a specified amount
     * @param filename {String} The file to write the data to
     * @param data {Record<String, any>} An object that contains the data to be written to the file
     * @param indent {Number} Number of spaces to left-pad each line with
     */
    writeFile(filename, data, indent = 0) {
        let stringified = YAML.stringify(data, { lineWidth: 0 });
        if (indent > 0) {
            stringified = stringified.replace(/^(.*)$/mg, '$1'.padStart(2 + indent)) + "\n";
        }
        fs.writeFileSync(filename, stringified);
        console.log("wrote file " + filename);
    }

    /**
     * Extract various parts of an OpenAPI spec into separate files
     * @param args {Array<String>} Program arguments
     */
    run(args) {
        // Fetch the OpenAPI spec
        const rawSpec = fetch('https://raw.githubusercontent.com/mattermost/mattermost-plugin-playbooks/master/server/api/api.yaml').text();
        console.log("fetched Playbooks OpenAPI spec");
        // Parse the OpenAPI spec
        const parsed = YAML.parse(rawSpec);
        // Extract paths
        if ("paths" in parsed) {
            this.writeFile("paths.yaml", parsed["paths"], 2);
        }
        // Extract components.schemas, components.responses, and components.securitySchemes
        if ("components" in parsed) {
            /** @type {Record<String,any>} */
            const components = parsed["components"];
            if ("schemas" in components) {
                this.writeFile("schemas.yaml", components["schemas"]);
            }
            if ("responses" in components) {
                this.writeFile("responses.yaml", components["responses"]);
            }
            if ("securitySchemes" in components) {
                this.writeFile("securitySchemes.yaml", components["securitySchemes"]);
            }
        }
    }
}

new Extractor().run(process.argv);

```

### Core Architecture Module: `api/playbooks/merge-definitions.js`
```
'use strict';
const YAML = require('yaml');
const fs = require('fs');

class MergeDefinitions {
    constructor() {}

    /**
     * Write YAML data to the specified file
     * @param filename {String}
     * @param data {Record<String, any>}
     */
    writeFile(filename, data) {
        fs.writeFileSync(filename, YAML.stringify(data, { lineWidth: 0 }).trimEnd());
        console.log("wrote file " + filename);
    }

    /**
     * Read a YAML file, parse it, and return the resulting object
     * @param filename {String} The YAML file to read
     * @returns {Record<String,any>} The parsed object
     */
    readFile(filename) {
        const rawYaml = fs.readFileSync(filename);
        console.log("read file " + filename);
        return YAML.parse(rawYaml.toString());
    }

    /**
     * Merge OpenAPI schema definitions
     * @param args {Array<String>} Program arguments
     */
    run(args) {
        if (args.length < 3) {
            console.error("please specify an input file");
            return;
        }
        if (args[2] === "") {
            console.error("input file not specified");
            return;
        }
        // read definitions.yaml
        const parsed = this.readFile(args[2]);
        // read schemas.yaml
        const schemas = this.readFile("schemas.yaml");
        // read responses.yaml
        const responses = this.readFile("responses.yaml");
        // read securitySchemes.yaml
        const securitySchemes = this.readFile("securitySchemes.yaml");
        // merge schemas with definitions.yaml
        parsed["components"]["schemas"] = Object.assign(parsed["components"]["schemas"], schemas);
        // merge responses with definitions.yaml
        parsed["components"]["responses"] = Object.assign(parsed["components"]["responses"], responses);
        // merge securitySchemes with definitions.yaml
        parsed["components"]["securitySchemes"] = Object.assign(parsed["components"]["securitySchemes"], securitySchemes);
        // write merged definitions to a new file
        this.writeFile("merged-definitions.yaml", parsed);
    }
}

new MergeDefinitions().run(process.argv);

```

### Core Architecture Module: `api/playbooks/merge-tags.js`
```
'use strict';
const YAML = require('yaml');
const fs = require('fs');

class MergeTags {
    constructor() {}

    /**
     * Read a YAML file, parse it, and return the resulting object
     * @param filename {String} The YAML file to read
     * @returns {Record<String,any>} The parsed object
     */
    readFile(filename) {
        const rawYaml = fs.readFileSync(filename);
        console.log("read file " + filename);
        return YAML.parse(rawYaml.toString());
    }

    /**
     * Merge OpenAPI tags
     * @param args {Array<String>} Program arguments
     */
    run(args) {
        if (args.length < 3) {
            console.error("please specify an input file");
            return;
        }
        if (args[2] === "") {
            console.error("input file not specified");
            return;
        }
        // read introduction.yaml
        const parsed = this.readFile(args[2]);
        // read tags.yaml
        const tags = this.readFile("tags.yaml");
        if ("tags" in parsed) {
            parsed["tags"].push(...tags["tags"]);
        }
        if ("x-tagGroups" in parsed) {
            parsed["x-tagGroups"].push(...tags["x-tagGroups"]);
        }
        // Convert the modified object back to YAML and remove the trailing "null" as we want the
        // "paths" field to have no value at this stage of building.
        const yamlString =
            YAML.stringify(parsed, { lineWidth: 0 }).
                replace(/^paths:.*null.*$/mg, "paths: ");
        // write out to merged-tags.yaml
        fs.writeFileSync("merged-tags.yaml", yamlString);
        console.log("wrote file merged-tags.yaml");
    }
}

new MergeTags().run(process.argv);

```

### Core Architecture Module: `api/server/main.go`
```
package main

import (
	"bytes"
	"log"
	"os"
	"text/template"

	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"

	"github.com/pb33f/libopenapi"
	v3high "github.com/pb33f/libopenapi/datamodel/high/v3"
	"github.com/pb33f/libopenapi/orderedmap"
	"go.yaml.in/yaml/v4"
	"golang.org/x/tools/imports"
)

// exampleText defines the template in which the corresponding ExampleClient4_* body is wrapped.
const exampleText = `
package main

import (
{{- range .Imports -}}
{{- if .}}
{{"\t"}}{{.}}
{{- else}}
{{"\t"}}{{end -}}
{{- end}}
)

func main() {
{{.Body -}}
}`

func main() {
	var exampleTmpl = template.Must(template.New("example").Parse(exampleText))

	if len(os.Args) <= 1 {
		log.Fatal("Expected filename to APIv4 spec as argument")
	}

	filename := os.Args[1]
	data, err := os.ReadFile(filename)
	if err != nil {
		log.Fatalf("failed to read %s: %s", filename, err)
	}

	// Parse the Open APIv4 Spec
	document, err := libopenapi.NewDocument(data)
	if err != nil {
		log.Fatalf("Failed to parse OpenAPI spec: %s", err)
	}

	v3Model, err := document.BuildV3Model()
	if err != nil {
		log.Fatalf("cannot create v3 model from document: %s", err)
	}

	applyExamples(v3Model, exampleTmpl)

	// Re-render the file with the injected examples.
	newDocument, _, _, err := document.RenderAndReload()
	if err != nil {
		log.Fatalf("cannot render document: %s", err)
	}

	err = os.WriteFile(filename, newDocument, 0644)
	if err != nil {
		log.Fatal(err)
	}
}

func applyExamples(v3Model *libopenapi.DocumentModel[v3high.Document], tmpl *template.Template) {
	fileSet, modelFuncs, err := getModelFuncs()
	if err != nil {
		log.Fatalf("Failed to parse example funcs: %s", err)
	}

	for path := range v3Model.Model.Paths.PathItems.ValuesFromOldest() {
		applyExample(tmpl, fileSet, modelFuncs, path.Get)
		applyExample(tmpl, fileSet, modelFuncs, path.Post)
		applyExample(tmpl, fileSet, modelFuncs, path.Delete)
		applyExample(tmpl, fileSet, modelFuncs, path.Options)
		applyExample(tmpl, fileSet, modelFuncs, path.Head)
		applyExample(tmpl, fileSet, modelFuncs, path.Patch)
		applyExample(tmpl, fileSet, modelFuncs, path.Trace)
	}
}

// applyExample looks through the functions in model_test to find an ExampleClient4_* matching the
// operation's unique identifier.
func applyExample(tmpl *template.Template, fileSet *token.FileSet, exampleFuncs []modelFunc, operation *v3high.Operation) {
	// Not all of GET, POST, OPTIONS, etc. are defined for each operation.
	if operation == nil {
		return
	}

	var exampleFunction modelFunc
	var found = false
	for _, e := range exampleFuncs {
		if e.FuncDecl.Name.Name == "ExampleClient4_"+operation.OperationId {
			exampleFunction = e
			found = true
			break
		}
	}
	if !found {
		return
	}

	// Find all the imports used by the function so we can re-create a minimal example.
	var fileImports []string
	for _, i := range exampleFunction.File.Imports {
		fileImports = append(fileImports, i.Path.Value)
	}

	// Render the example body using the template.
	var body bytes.Buffer
	err := printer.Fprint(&body, fileSet, exampleFunction.FuncDecl.Body.List)
	if err != nil {
		log.Fatal(err)
	}

	data := struct {
		Imports []string
		Body    string
	}{
		fileImports,
		body.String(),
	}

	// Process the resulting Go file to get the right indention, minimal set of imports, etc.
	var unformattedExample bytes.Buffer
	if err := tmpl.Execute(&unformattedExample, data); err != nil {
		log.Fatalf("failed to render template: %v", err)
	}

	ignoredFilePath := "path"
	example, err := imports.Process(ignoredFilePath, unformattedExample.Bytes(), nil)
	if err != nil {
		log.Fatal(err)
	}

	// Inject the resulting code sample
	type codeSample struct {
		Lang   string `yaml:"lang"`
		Source string `yaml:"source"`
	}
	yamlBytes, err := yaml.Marshal([]codeSample{{Lang: "Go", Source: string(example)}})
	if err != nil {
		log.Fatalf("failed to marshal x-codeSamples: %v", err)
	}
	var samplesNode yaml.Node
	if err := yaml.Unmarshal(yamlBytes, &samplesNode); err != nil {
		log.Fatalf("failed to create yaml node for x-codeSamples: %v", err)
	}
	if operation.Extensions == nil {
		operation.Extensions = orderedmap.New[string, *yaml.Node]()
	}
	operation.Extensions.Set("x-codeSamples", samplesNode.Content[0])
}

type modelFunc struct {
	File     *ast.File
	FuncDecl *ast.FuncDecl
}

// getModelFuncs builds a fileset and function declaration set for the model/model_test packages.
func getModelFuncs() (*token.FileSet, []modelFunc, error) {
	fileSet := token.NewFileSet()
	packs, err := parser.ParseDir(fileSet, "../../server/public/model", nil, 0)
	if err != nil {
		return nil, nil, err
	}

	var examples []modelFunc
	for _, pack := range packs {
		for _, f := range pack.Files {
			for _, d := range f.Decls {
				if fn, isFn := d.(*ast.FuncDecl); isFn {
					examples = append(examples, modelFunc{f, fn})
				}
			}
		}
	}

	return fileSet, examples, nil
}

```

### Core Architecture Module: `server/channels/api4/access_control.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

// shouldRedactExpressions reports whether raw CEL expressions should be masked for this caller.
// Masking is attribute-based, not permission-based: system admins who do not hold all values
// in a policy must also receive redacted raw expressions.
func shouldRedactExpressions(c *Context) bool {
	return c.App.Config().FeatureFlags.AttributeValueMasking
}

// preserveSystemManagedFields pins parent imports and team-scope metadata to the stored values:
// attaching/detaching parents belongs to the assign/unassign endpoints, so a channel/team admin
// editing rules here can't change them. No stored policy (first-time create) means they start empty.
func preserveSystemManagedFields(c *Context, policy *model.AccessControlPolicy) *model.AppError {
	stored, appErr := c.App.GetAccessControlPolicy(c.AppContext, policy.ID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			policy.Imports = nil
			policy.Scope = ""
			policy.ScopeID = ""
			return nil
		}
		return appErr
	}

	// Clone so a later mutation of policy.Imports can't reach back into the stored object.
	policy.Imports = slices.Clone(stored.Imports)
	policy.Scope = stored.Scope
	policy.ScopeID = stored.ScopeID
	return nil
}

func (api *API) InitAccessControlPolicy() {
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APISessionRequired(createAccessControlPolicy)).Methods(http.MethodPut)
	api.BaseRoutes.AccessControlPolicies.Handle("/search", api.APISessionRequired(searchAccessControlPolicies)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/activate", api.APISessionRequired(setActiveStatus)).Methods(http.MethodPut)

	api.BaseRoutes.AccessControlPolicies.Handle("/cel/check", api.APISessionRequired(checkExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/test", api.APISessionRequired(testExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/simulate_users", api.APISessionRequired(simulatePolicyForUsers)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/validate_requester", api.APISessionRequired(validateExpressionAgainstRequester)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/autocomplete/fields", api.APISessionRequired(getFieldsAutocomplete)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/visual_ast", api.APISessionRequired(convertToVisualAST)).Methods(http.MethodPost)

	api.BaseRoutes.AccessControlPolicy.Handle("", api.APISessionRequired(getAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("", api.APISessionRequired(deleteAccessControlPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicy.Handle("/activate", api.APISessionRequired(updateActiveStatus)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/assign", api.APISessionRequired(assignAccessPolicy)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("/unassign", api.APISessionRequired(unassignAccessPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels", api.APISessionRequired(getChannelsForAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels/search", api.APISessionRequired(searchChannelsForAccessControlPolicy)).Methods(http.MethodPost)

	api.BaseRoutes.AccessControlDecisions.Handle("/actions/search", api.APISessionRequired(searchAccessControlDecisionActions)).Methods(http.MethodPost)
}

// searchAccessControlDecisionActions returns non-authoritative, render-time ABAC
// decisions for the current session user on a single resource. If Subject is
// provided in the request it must match the authenticated session user ID — any
// other value is rejected with 403. Results are for rendering only; protected
// endpoints always re-evaluate the PDP live.
func searchAccessControlDecisionActions(c *Context, w http.ResponseWriter, r *http.Request) {
	var req model.ActionSearchRequest
	if jsonErr := json.NewDecoder(r.Body).Decode(&req); jsonErr != nil {
		c.SetInvalidParamWithErr("action_search", jsonErr)
		return
	}
	if appErr := req.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}
	// Fail closed on resource types we can't authorize: only channel decisions are exposed
	// today, so anything else is rejected rather than silently skipping the access check.
	switch req.Resource.Type {
	case model.AccessControlPolicyTypeChannel:
		if hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), req.Resource.ID, model.PermissionReadChannel); !hasPermission {
			c.SetPermissionError(model.PermissionReadChannel)
			return
		}
	default:
		c.Err = model.NewAppError("searchAccessControlDecisionActions", "api.access_control.decision.unsupported_resource_type.app_error", map[string]any{"Type": req.Resource.Type}, "", http.StatusBadRequest)
		return
	}

	resp, appErr := c.App.SearchAllowedActionsForCurrentUser(c.AppContext, req)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(resp)
	if err != nil {
		c.Err = model.NewAppError("searchAccessControlDecisionActions", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createAccessControlPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	var policy model.AccessControlPolicy
	if jsonErr := json.NewDecoder(r.Body).Decode(&policy); jsonErr != nil {
		c.SetInvalidParamWithErr("policy", jsonErr)
		return
	}

	if policy.Type == model.AccessControlPolicyTypePermission && !c.App.Config().FeatureFlags.PermissionPolicies {
		c.Err = model.NewAppError("createAccessControlPolicy", "api.access_control_policy.permission_policies.feature_disabled", nil, "", http.StatusNotImplemented)
		return
	}

	// Channel-scope policies are always available, but a channel policy
	// that carries a permission-rule action (upload_file_attachment,
	// download_file_attachment) is gated behind the channel-level
	// sub-flag — that's the toggle that exposes the Channel Settings →
	// Permissions Policy tab on the frontend. Membership-only channel
	// policies stay unaffected. Helper enforces the PermissionPolicies
	// umbrella too, so a request slipping in with the sub-flag on but
	// the umbrella off is also rejected here.
	if policy.Type == model.AccessControlPolicyTypeChannel && policy.HasPermissionRuleAction() && !c.App.Config().FeatureFlags.IsChannelPermissionPoliciesEnabled() {
		c.Err = model.NewAppError("createAccessControlPolicy", "api.access_control_policy.channel_permission_policies.feature_disabled", nil, "", http.StatusNotImplemented)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateAccessControlPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "requested", &policy)

	// Sysadmin is allowed in every case; each case layers its own non-sysadmin fallback.
	hasManageSystem := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)

	switch policy.Type {
	case model.AccessControlPolicyTypeParent:
		teamID := r.URL.Query().Get("team_id")
		if !hasManageSystem {
			if teamID == "" || !model.IsValidId(teamID) {
				c.SetPermissionError(model.PermissionManageSystem)
				return
			}
			if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageTeamAccessRules) {
				c.SetPermissionError(model.PermissionManageTeamAccessRules)
				re
```

### Core Architecture Module: `server/channels/api4/access_control_local.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitAccessControlPolicyLocal() {
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APILocal(createAccessControlPolicy)).Methods(http.MethodPut)
	api.BaseRoutes.AccessControlPolicies.Handle("/search", api.APILocal(searchAccessControlPolicies)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/activate", api.APILocal(setActiveStatus)).Methods(http.MethodPut)

	api.BaseRoutes.AccessControlPolicies.Handle("/cel/check", api.APILocal(checkExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/test", api.APILocal(testExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/validate_requester", api.APILocal(validateExpressionAgainstRequester)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/autocomplete/fields", api.APILocal(getFieldsAutocomplete)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/visual_ast", api.APILocal(convertToVisualAST)).Methods(http.MethodPost)

	api.BaseRoutes.AccessControlPolicy.Handle("", api.APILocal(getAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("", api.APILocal(deleteAccessControlPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicy.Handle("/assign", api.APILocal(assignAccessPolicy)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("/unassign", api.APILocal(unassignAccessPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels", api.APILocal(getChannelsForAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels/search", api.APILocal(searchChannelsForAccessControlPolicy)).Methods(http.MethodPost)
}

```

### Core Architecture Module: `server/channels/api4/agents.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitAgents() {
	// GET /api/v4/agents
	api.BaseRoutes.Agents.Handle("", api.APISessionRequired(getAgents)).Methods(http.MethodGet)
	// GET /api/v4/agents/status
	api.BaseRoutes.Agents.Handle("/status", api.APISessionRequired(getAgentsStatus)).Methods(http.MethodGet)
	// GET /api/v4/llmservices
	api.BaseRoutes.LLMServices.Handle("", api.APISessionRequired(getLLMServices)).Methods(http.MethodGet)
}

func getAgentsStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	available, reason := c.App.GetAIPluginBridgeStatus(c.AppContext)

	resp := &model.AgentsIntegrityResponse{
		Available: available,
		Reason:    reason,
	}

	jsonData, err := json.Marshal(resp)
	if err != nil {
		c.Err = model.NewAppError("Api4.getAgentsStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(jsonData); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getAgents(c *Context, w http.ResponseWriter, r *http.Request) {
	agents, appErr := c.App.GetAgents(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getAgents", "app.agents.get_agents.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	jsonData, err := json.Marshal(agents)
	if err != nil {
		c.Err = model.NewAppError("Api4.getAgents", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(jsonData); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getLLMServices(c *Context, w http.ResponseWriter, r *http.Request) {
	services, appErr := c.App.GetLLMServices(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getLLMServices", "app.agents.get_services.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	jsonData, err := json.Marshal(services)
	if err != nil {
		c.Err = model.NewAppError("Api4.getLLMServices", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(jsonData); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

```

### Core Architecture Module: `server/channels/api4/api.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/gorilla/mux"
	_ "github.com/mattermost/go-i18n/i18n"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/manualtesting"
	"github.com/mattermost/mattermost/server/v8/channels/web"
)

type Routes struct {
	Root     *mux.Router // ''
	APIRoot  *mux.Router // 'api/v4'
	APIRoot5 *mux.Router // 'api/v5'

	Users          *mux.Router // 'api/v4/users'
	User           *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}'
	UserByUsername *mux.Router // 'api/v4/users/username/{username:[A-Za-z0-9\\_\\-\\.]+}'
	UserByEmail    *mux.Router // 'api/v4/users/email/{email:.+}'

	Bots *mux.Router // 'api/v4/bots'
	Bot  *mux.Router // 'api/v4/bots/{bot_user_id:[A-Za-z0-9]+}'

	Teams              *mux.Router // 'api/v4/teams'
	TeamsForUser       *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams'
	Team               *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}'
	TeamForUser        *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/{team_id:[A-Za-z0-9]+}'
	UserThreads        *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/{team_id:[A-Za-z0-9]+}/threads'
	UserThread         *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/{team_id:[A-Za-z0-9]+}/threads/{thread_id:[A-Za-z0-9]+}'
	TeamByName         *mux.Router // 'api/v4/teams/name/{team_name:[A-Za-z0-9_-]+}'
	TeamMembers        *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/members'
	TeamMember         *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/members/{user_id:[A-Za-z0-9]+}'
	TeamMembersForUser *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/members'

	Channels                 *mux.Router // 'api/v4/channels'
	Channel                  *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}'
	ChannelForUser           *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/channels/{channel_id:[A-Za-z0-9]+}'
	ChannelByName            *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/channels/name/{channel_name:[A-Za-z0-9_-]+}'
	ChannelByNameForTeamName *mux.Router // 'api/v4/teams/name/{team_name:[A-Za-z0-9_-]+}/channels/name/{channel_name:[A-Za-z0-9_-]+}'
	ChannelsForTeam          *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/channels'
	ChannelMembers           *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/members'
	ChannelMember            *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/members/{user_id:[A-Za-z0-9]+}'
	ChannelMembersForUser    *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/{team_id:[A-Za-z0-9]+}/channels/members'
	ChannelModerations       *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/moderations'
	ChannelCategories        *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/{team_id:[A-Za-z0-9]+}/channels/categories'
	ChannelBookmarks         *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/bookmarks'
	ChannelBookmark          *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/bookmarks/{bookmark_id:[A-Za-z0-9]+}'
	ChannelViews             *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/views'
	ChannelView              *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/views/{view_id:[A-Za-z0-9]+}'
	ChannelViewPosts         *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/views/{view_id:[A-Za-z0-9]+}/posts'

	Posts           *mux.Router // 'api/v4/posts'
	Post            *mux.Router // 'api/v4/posts/{post_id:[A-Za-z0-9]+}'
	PostsForChannel *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/posts'
	PostsForUser    *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/posts'
	PostForUser     *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/posts/{post_id:[A-Za-z0-9]+}'

	Files *mux.Router // 'api/v4/files'
	File  *mux.Router // 'api/v4/files/{file_id:[A-Za-z0-9]+}'

	Uploads *mux.Router // 'api/v4/uploads'
	Upload  *mux.Router // 'api/v4/uploads/{upload_id:[A-Za-z0-9]+}'

	Plugins *mux.Router // 'api/v4/plugins'
	Plugin  *mux.Router // 'api/v4/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}'

	PublicFile *mux.Router // '/files/{file_id:[A-Za-z0-9]+}/public'

	Commands *mux.Router // 'api/v4/commands'
	Command  *mux.Router // 'api/v4/commands/{command_id:[A-Za-z0-9]+}'

	Hooks         *mux.Router // 'api/v4/hooks'
	IncomingHooks *mux.Router // 'api/v4/hooks/incoming'
	IncomingHook  *mux.Router // 'api/v4/hooks/incoming/{hook_id:[A-Za-z0-9]+}'
	OutgoingHooks *mux.Router // 'api/v4/hooks/outgoing'
	OutgoingHook  *mux.Router // 'api/v4/hooks/outgoing/{hook_id:[A-Za-z0-9]+}'

	OAuth     *mux.Router // 'api/v4/oauth'
	OAuthApps *mux.Router // 'api/v4/oauth/apps'
	OAuthApp  *mux.Router // 'api/v4/oauth/apps/{app_id:[A-Za-z0-9]+}'

	SAML       *mux.Router // 'api/v4/saml'
	Compliance *mux.Router // 'api/v4/compliance'
	Cluster    *mux.Router // 'api/v4/cluster'

	Image *mux.Router // 'api/v4/image'

	LDAP *mux.Router // 'api/v4/ldap'

	Elasticsearch *mux.Router // 'api/v4/elasticsearch'

	DataRetention *mux.Router // 'api/v4/data_retention'

	EphemeralMode *mux.Router // 'api/v4/ephemeral_mode'

	Brand *mux.Router // 'api/v4/brand'

	System *mux.Router // 'api/v4/system'

	Jobs *mux.Router // 'api/v4/jobs'

	Recaps *mux.Router // 'api/v4/recaps'

	ScheduledRecaps *mux.Router // 'api/v4/scheduled_recaps'
	ScheduledRecap  *mux.Router // 'api/v4/scheduled_recaps/{scheduled_recap_id:[A-Za-z0-9]+}'

	Preferences *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/preferences'

	License *mux.Router // 'api/v4/license'

	Public *mux.Router // 'api/v4/public'

	Reactions *mux.Router // 'api/v4/reactions'

	Roles   *mux.Router // 'api/v4/roles'
	Schemes *mux.Router // 'api/v4/schemes'

	Emojis      *mux.Router // 'api/v4/emoji'
	Emoji       *mux.Router // 'api/v4/emoji/{emoji_id:[A-Za-z0-9]+}'
	EmojiByName *mux.Router // 'api/v4/emoji/name/{emoji_name:[A-Za-z0-9\\_\\-\\+]+}'

	ReactionByNameForPostForUser *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/posts/{post_id:[A-Za-z0-9]+}/reactions/{emoji_name:[A-Za-z0-9\\_\\-\\+]+}'

	TermsOfService *mux.Router // 'api/v4/terms_of_service'
	Groups         *mux.Router // 'api/v4/groups'

	Cloud *mux.Router // 'api/v4/cloud'

	Imports *mux.Router // 'api/v4/imports'
	Import  *mux.Router // 'api/v4/imports/{import_name:.+\\.zip}'

	Exports *mux.Router // 'api/v4/exports'
	Export  *mux.Router // 'api/v4/exports/{export_name:.+\\.zip}'

	RemoteCluster        *mux.Router // 'api/v4/remotecluster'
	SharedChannels       *mux.Router // 'api/v4/sharedchannels'
	ChannelForRemote     *mux.Router // 'api/v4/remotecluster/{remote_id:[A-Za-z0-9]+}/channels/{channel_id:[A-Za-z0-9]+}'
	SharedChannelRemotes *mux.Router // 'api/v4/remotecluster/{remote_id:[A-Za-z0-9]+}/sharedchannelremotes'

	Permissions *mux.Router // 'api/v4/permissions'

	Usage *mux.Router // 'api/v4/usage'

	HostedCustomer *mux.Router // 'api/v4/hosted_customer'

	Drafts *mux.Router // 'api/v4/drafts'

	IPFiltering *mux.Router // 'api/v4/ip_filtering'

	Reports *mux.Router // 'api/v4/reports'

	Limits *mux.Router // 'api/v4/limits'

	OutgoingOAuthConnections *mux.Router // 'api/v4/oauth/outgoing_connections'
	OutgoingOAuthConnection  *mux.Router // 'api/v4/oauth/outgoing_connections/{outgoing_oauth_connection_id:[A-Za-z0-9]+}'

	CustomProfileAttributes       *mux.Router // 'api/v4/custom_profile_attributes'
	CustomProfileAttributesFields *mux.Router // 'api/v4/custom_profile_attributes/fields'
	CustomProfileAttributesField  *mux.Router // 'api/v4/custom_profile_attributes/fields/{field_id:[A-Za-z0-9]+}'
	CustomProfileAttributesValues *mux.Router // 'api/v4/custom_profile_attributes/values'

	AuditLogs *mux.Router // 'api/v4/audit_logs'

	AccessControlPolicies  *mux.Router // 'api/v4/access_control_policies'
	AccessControlPolicy    *mux.Router // 'api/v4/access_control_policies/{policy_id
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #30689** (2025-04-28): **[MM-61105] Fix errcheck linter errors in config_test.go**
  *Symptoms*: #### Summary - Fixed multiple instances of unchecked error returns in `channels/app/config_test.go` - Removed the errcheck linter exclusion for this file in `.golangci.yml` - Fixed variable shadowing issues for error variables  This PR addresses an existing help-wanted issue to fix error handling in the config_test.go file by properly checking error return values that were previously ignored.  #### Ticket Link Fixes https://github.com/mattermost/mattermost/issues/28811  #### Release Note ```release-note NONE ```
  **Post-Mortem & Fix Analysis**:
  > @hanzei: Adding the "do-not-merge/release-note-label-needed" label because no release-note block was detected, please follow our [release note process](https://github.com/mattermost/chewbacca#release-notes-process) to remove it.  <details>  I understand the commands that are listed [here](https://chewbacca.core.cloud.mattermost.com/command-help.html) </details>
  > @hanzei: Adding the "do-not-merge/release-note-label-needed" label because no release-note block was detected, please follow our [release note process](https://github.com/mattermost/chewbacca#release-notes-process) to remove it.  <details>  I understand the commands that are listed [here](https://chewbacca.core.cloud.mattermost.com/command-help.html) </details>

- **Issue #30609** (2025-04-11): **[MM-61463] Fix errcheck issues in post_helpers_test.go**
  *Symptoms*: #### Summary Fixed errcheck issues in post_helpers_test.go by properly handling errors from th.App.Srv().Store().System().Save() calls and removed post_helpers_test.go from errcheck ignore list in .golangci.yml.  This change improves code quality by ensuring all errors are properly checked rather than being ignored.  #### Ticket Link Fixes https://github.com/mattermost/mattermost/issues/29078 Jira https://mattermost.atlassian.net/browse/MM-61463  #### Screenshots <!-- N/A - No UI changes -->  #### Release Note ```release-note NONE ```  🤖 Generated with [Claude Code](https://claude.ai/code)

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

### Incident Patch 1: `7206a384` (2026-09-30)
**Commit Message**: Mm 70889 channel attributes fix (#38747)

* Polish channel attributes admin and channel settings UX.

Hide Channel Info display as UI-only, add attributes to the Info tab, and improve empty banner preview messaging.

Co-authored-by: Cursor <cursoragent@cursor.com>

* Edit channel attributes from channel settings and allow emptying the banner

* Fix multiselect display to render individual chips for each value

* Fix alignment of elements in attribute details and classification attribute styles

* Fix channel attribute banner settings and rendering

Persist banner opt-outs, validate required text, preserve template punctuation, avoid double rendering, and prevent duplicate chip removal. Update regression tests and E2E selectors.

* Enhance banner token controls with unset value indicators

* Refactor channel attributes and banner handling

* Preserve authored classification banners when legacy banner info reports disabled

* Refactor tests for channel attributes and banner handling

* Fix styling and scrolling behavior in channel attributes and settings modal

* Fix banner fallback behavior for empty authored text in channel classification

* fix unit test

* update snapshot, adjust

**File**: `e2e-tests/playwright/lib/src/ui/components/channels/channel_attributes.ts` (modified, +33/-11)
```diff
@@ -76,16 +76,24 @@ export class ChannelInfoAttributes {
         return this.container.getByTestId(`channelInfoAttributeRow-${name}`);
     }
 
+    /**
+     * The displayed value. An editable text value renders as plain text inside its
+     * edit button; every other value, and a read-only text one, renders as a chip.
+     */
     chip(name: string) {
-        return this.row(name).getByTestId('attributeChip');
+        return this.row(name)
+            .getByTestId('attributeChip')
+            .or(this.row(name).getByTestId(`channelInfoAttributeTextValue-${name}`));
     }
 
     editButton(name: string) {
         return this.row(name).getByTestId(`channelInfoAttributeEdit-${name}`);
     }
 
+    // Page-wide: a select's options render in a menu portalled to the body, outside
+    // the row. The test id is unique either way.
     editor(name: string) {
-        return this.row(name).getByTestId(`channelAttributeEdit-${name}`);
+        return this.container.page().getByTestId(`channelAttributeEdit-${name}`);
     }
 
     error(name: string) {
@@ -141,30 +149,44 @@ export class ChannelInfoAttributes {
         }
     }
 
+    /**
+     * editor(name) on a select field is the first menu option, not a combobox, so
+     * clicking it would pick that option. Options are picked by name instead.
+     */
     async select(name: string, option: string) {
         await this.startEditing(name);
-        await this.editor(name).click();
-        await this.container.page().getByText(option, {exact: true}).click();
+        await this.pickOption(option);
+    }
+
+    async pickOption(option: string) {
+        await this.container.page().getByRole('menuitem', {name: option, exact: true}).click();
     }
 
     /**
-     * Reopens the editor first: each pick commits and closes it.
+     * The trigger's own chip carries the remove control -- no need to reopen
+     * the menu first, and removing does not open it either.
      */
     async deselect(name: string, option: string) {
-        await this.startEditing(name);
-
-        const chip = this.editor(name).locator('.DropDown__multi-value', {hasText: option});
-        await chip.locator('.DropDown__multi-value__remove').click();
+        await this.row(name)
+            .getByRole('button', {name: `Remove ${option}`, exact: true})
+            .click();
     }
 
+    /**
+     * A text attribute opens its input as soon as it is added; a select one lands as
+     * a closed "Not set" row, so its menu is opened here.
+     */
     async add(name: string, option?: string) {
         await this.addButton.click();
         await this.addMenuItem(name).click();
+        await expect(this.editor(name).or(this.unset(name))).toBeVisible();
+        if (!(await this.editor(name).isVisible())) {
+            await this.editButton(name).click();
+        }
         await expect(this.editor(name)).toBeVisible();
 
         if (option !== undefined) {
-            await this.editor(name).click();
-            await this.container.page().getByText(option, {exact: true}).click();
+            await this.pickOption(option);
         }
     }
 }
```

**File**: `e2e-tests/playwright/lib/src/ui/components/channels/channel_settings/info_settings.ts` (modified, +21/-0)
```diff
@@ -4,6 +4,8 @@
 import type {Locator} from '@playwright/test';
 import {expect} from '@playwright/test';
 
+import {ChannelInfoAttributes} from '../channel_attributes';
+
 export default class InfoSettings {
     readonly container: Locator;
     readonly nameInput: Locator;
@@ -13,6 +15,9 @@ export default class InfoSettings {
     readonly urlEditButton: Locator;
     readonly urlInput: Locator;
     readonly saveChangesPanel: Locator;
+    readonly saveButton: Locator;
+    readonly resetButton: Locator;
+    readonly attributes: ChannelInfoAttributes;
 
     constructor(container: Locator) {
         this.container = container;
@@ -23,6 +28,12 @@ export default class InfoSettings {
         this.urlEditButton = container.getByRole('button', {name: 'Edit'});
         this.urlInput = container.getByTestId('channelURLInput');
         this.saveChangesPanel = container.locator('.SaveChangesPanel');
+        this.saveButton = container.getByTestId('SaveChangesPanel__save-btn');
+        this.resetButton = container.getByTestId('SaveChangesPanel__cancel-btn');
+
+        // Same component as the Channel Info RHS, but staged here: edits only
+        // reach the server on this tab's own Save (see saveChangesPanel).
+        this.attributes = new ChannelInfoAttributes(container.getByTestId('channelInfoAttributes'));
     }
 
     async toBeVisible() {
@@ -52,4 +63,14 @@ export default class InfoSettings {
         await expect(this.purposeInput).toBeVisible();
         await this.purposeInput.fill(purpose);
     }
+
+    async save() {
+        await expect(this.saveButton).toBeVisible();
+        await this.saveButton.click();
+    }
+
+    async resetChanges() {
+        await expect(this.resetButton).toBeVisible();
+        await this.resetButton.click();
+    }
 }
```

**File**: `e2e-tests/playwright/lib/src/ui/components/channels/header.ts` (modified, +5/-5)
```diff
@@ -13,10 +13,8 @@ export default class ChannelsHeader {
     readonly channelMenuDropdown;
     readonly callButton: Locator;
     readonly pinnedMessagesButton: Locator;
-    // Two chip slots, two accessors: 'attributes' is the row under the channel
-    // name, 'infoAttributes' the inline strip beside the member count.
+    // The attribute chip strip. Header and info designations share it.
     readonly attributes: ChannelAttributeLabels;
-    readonly infoAttributes: ChannelAttributeLabels;
     readonly addChannelHeaderButton: Locator;
 
     constructor(container: Locator) {
@@ -26,8 +24,10 @@ export default class ChannelsHeader {
         this.channelMenuDropdown = container.locator('#channelHeaderDropdownButton');
         this.callButton = container.getByRole('button', {name: /call/i}).first();
         this.pinnedMessagesButton = container.locator('#channelHeaderPinButton');
-        this.attributes = new ChannelAttributeLabels(container.getByTestId('channelAttributeLabels-header'), 'header');
-        this.infoAttributes = new ChannelAttributeLabels(container.getByTestId('channelAttributeLabels-info'), 'info');
+        this.attributes = new ChannelAttributeLabels(
+            container.getByTestId('channelAttributeLabels-info-header'),
+            'info-header',
+        );
         this.addChannelHeaderButton = container.getByRole('button', {name: 'Add a channel header'});
     }
 
```

**File**: `e2e-tests/playwright/lib/src/ui/components/system_console/sections/system_attributes/global_attributes.ts` (modified, +10/-3)
```diff
@@ -8,12 +8,19 @@ export const GLOBAL_ATTRIBUTES_PATH = '/admin_console/system_attributes/manage_a
 export const ATTRIBUTE_DETAILS_PATH = `${GLOBAL_ATTRIBUTES_PATH}/attribute_details`;
 export const CLASSIFICATION_ATTRIBUTE_PATH = `${GLOBAL_ATTRIBUTES_PATH}/classification`;
 
-export type ChannelDisplayLocation = 'display_label_header' | 'display_label_info' | 'display_banner_top';
+export type ChannelDisplayLocation = 'display_label_header' | 'display_banner_top';
 
+// The switch is a visually hidden checkbox under its <label>, which takes the
+// pointer, so the click goes to the label.
 async function setToggle(toggle: Locator, on: boolean) {
-    if (((await toggle.getAttribute('aria-pressed')) === 'true') !== on) {
-        await toggle.click();
+    if ((await toggle.isChecked()) !== on) {
+        const id = await toggle.getAttribute('id');
+        if (!id) {
+            throw new Error('setToggle: the switch has no id, so its label cannot be found');
+        }
+        await toggle.page().locator(`label[for="${id}"]`).click();
     }
+    await expect(toggle).toBeChecked({checked: on});
 }
 
 /**
```

**File**: `e2e-tests/playwright/specs/functional/channels/channel_attributes/channel_attribute_banner.spec.ts` (modified, +12/-67)
```diff
@@ -5,12 +5,6 @@ import type {PropertyField} from '@mattermost/types/properties';
 
 import {expect, test} from '@mattermost/playwright-lib';
 
-import {
-    TEST_LEVELS,
-    deleteClassificationFieldsIfExist,
-    setupClassificationWithChannelField,
-} from '../channel_classification/helpers';
-
 import {
     DISPLAY_BANNER_TOP,
     DISPLAY_LABEL_INFO,
@@ -80,9 +74,9 @@ test.describe('Channel attribute banner composition', {tag: ['@channel_attribute
 
     /**
      * @objective Verify every banner-designated attribute shares one banner, and that
-     * Channel Settings shows them as chips the channel cannot remove.
+     * Channel Settings seeds them as removable defaults rather than locked chips.
      */
-    test('composes one banner from every designated attribute and locks their chips', async ({pw}) => {
+    test('composes one banner from every designated attribute and offers to remove them', async ({pw}) => {
         await pw.skipIfNoLicense();
         await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);
 
@@ -125,9 +119,9 @@ test.describe('Channel attribute banner composition', {tag: ['@channel_attribute
             await expect(configuration.bannerTokenChip(marking.name)).toBeVisible();
             await expect(configuration.bannerTokenChip(programme.name)).toBeVisible();
 
-            // * Designated attributes cannot be taken out of the banner
-            await expect(configuration.bannerTokenChipRemove(marking.name)).toHaveCount(0);
-            await expect(configuration.bannerTokenChipRemove(programme.name)).toHaveCount(0);
+            // * Designation is a default: either chip can be taken out of the banner
+            await expect(configuration.bannerTokenChipRemove(marking.name)).toBeVisible();
+            await expect(configuration.bannerTokenChipRemove(programme.name)).toBeVisible();
 
             // * Seeding those chips is not an edit, so the tab opens clean
             await expect(configuration.container.getByTestId('SaveChangesPanel__save-btn')).toHaveCount(0);
@@ -329,10 +323,15 @@ test.describe('Channel attribute banner composition', {tag: ['@channel_attribute
             const settings = await channelsPage.openChannelSettings();
             const configuration = await settings.openConfigurationTab();
             await configuration.enableChannelBanner();
+
+            // The designated attribute is seeded already; start from a known template.
+            await configuration.clearBannerText();
             await configuration.insertBannerToken(marking.name);
 
-            // * The preview names the empty result instead of rendering nothing
-            await expect(configuration.bannerTokenPreview).toContainText('no values are set');
+            // * The preview says the banner will not show instead of rendering nothing
+            const emptyNotice = configuration.container.getByTestId('bannerPreviewEmptyNotice');
+            await expect(emptyNotice).toContainText('The banner will not be displayed');
+            await expect(configuration.bannerTokenPreview).toHaveCount(0);
 
             await settings.close();
 
@@ -495,60 +494,6 @@ test.describe('Channel attribute banner composition', {tag: ['@channel_attribute
         }
     });
 
-    /**
-     * @objective Verify that when classification is banner-designated, Channel Settings
-     * locks the color picker to the selected level's color and the user cannot override it.
-     */
-    test('color picker is locked to the classification level color when classification is banner-designated', async ({
-        pw,
-    }) => {
-        await pw.skipIfNoLicense();
-        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);
-
-        const {adminClient, adminUser, team} = await pw.initSetup();
-        const suffix = pw.random.id();
-
-        // Provision the classification template + channel-linked field ourselves:
-        // this test must not depend on state left behind by other spec files.
-       
```

---

### Incident Patch 2: `ef6957a5` (2026-09-30)
**Commit Message**: Fix flaky post-list scroll and Global Attributes menu-height Playwright specs (#38871)

**File**: `e2e-tests/playwright/specs/functional/channels/post_list/initial_scroll_read.spec.ts` (modified, +18/-0)
```diff
@@ -147,6 +147,10 @@ test.describe('Post list initial scroll in read channel', () => {
                 // # Open the web app directly to that channel
                 await channelsPage.goto(team.name, channel.name);
 
+                if (testCase.name === 'with multiple pages of post previews') {
+                    await settleAfterPermalinkPreviewsLoad(watcher);
+                }
+
                 // * Verify that the post list didn't scroll or change height
                 expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
             });
@@ -161,6 +165,10 @@ test.describe('Post list initial scroll in read channel', () => {
                 // # Switch to the channel
                 await channelsPage.sidebarLeft.goToItem(channel.name);
 
+                if (testCase.name === 'with multiple pages of post previews') {
+                    await settleAfterPermalinkPreviewsLoad(watcher);
+                }
+
                 // * Verify that the post list didn't scroll or change height
                 expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
             });
@@ -180,4 +188,14 @@ test.describe('Post list initial scroll in read channel', () => {
         // # Wait until the post list hasn't scrolled for 500ms before returning results
         return watcher.waitForObservations(500);
     }
+
+    // Permalink previews resolve their linked post asynchronously, so the post list
+    // legitimately grows once they render in, producing one expected scroll observation
+    // before things truly settle. Wait for that to happen and reset the watcher so it
+    // only reports genuinely unexpected scroll changes afterward.
+    async function settleAfterPermalinkPreviewsLoad(watcher: PostListScrollWatcher) {
+        const lastPost = await channelsPage.centerView.getLastPost();
+        await lastPost.postPreview.waitFor();
+        await watcher.reset();
+    }
 });
```

**File**: `e2e-tests/playwright/specs/functional/channels/post_list/initial_scroll_unread.spec.ts` (modified, +18/-0)
```diff
@@ -184,6 +184,10 @@ test.describe('Post list initial scroll in unread channel', () => {
                 // * Verify that the New Messages line is actually visible
                 await expect(channelsPage.centerView.notificationSeparator).toBeVisible();
 
+                if (testCase.name === 'with multiple pages of post previews') {
+                    await settleAfterPermalinkPreviewsLoad(watcher);
+                }
+
                 expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
             });
 
@@ -203,6 +207,10 @@ test.describe('Post list initial scroll in unread channel', () => {
                 // * Verify that the New Messages line is still visible
                 await expect(channelsPage.centerView.notificationSeparator).toBeVisible();
 
+                if (testCase.name === 'with multiple pages of post previews') {
+                    await settleAfterPermalinkPreviewsLoad(watcher);
+                }
+
                 // * Verify that the post list didn't scroll or change height
                 expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
             });
@@ -222,4 +230,14 @@ test.describe('Post list initial scroll in unread channel', () => {
         // # Wait until the post list hasn't scrolled for 500ms before returning results
         return watcher.waitForObservations(500);
     }
+
+    // Permalink previews resolve their linked post asynchronously, so the post list
+    // legitimately grows once they render in, producing one expected scroll observation
+    // before things truly settle. Wait for that to happen and reset the watcher so it
+    // only reports genuinely unexpected scroll changes afterward.
+    async function settleAfterPermalinkPreviewsLoad(watcher: PostListScrollWatcher) {
+        const lastPost = await channelsPage.centerView.getLastPost();
+        await lastPost.postPreview.waitFor();
+        await watcher.reset();
+    }
 });
```

**File**: `e2e-tests/playwright/specs/functional/system_console/global_attributes/global_attributes_form.spec.ts` (modified, +32/-4)
```diff
@@ -8,7 +8,7 @@
  * Local runs: upload or use a license with SkuShortName `enterprise`, `entry`, or `advanced`.
  */
 
-import type {Page} from '@playwright/test';
+import type {Locator, Page} from '@playwright/test';
 import type {PropertyField} from '@mattermost/types/properties';
 
 import {expect, test} from '@mattermost/playwright-lib';
@@ -1289,8 +1289,12 @@ test.describe('System Console - Global Attributes form', {tag: '@system_console'
                 // Measure the pane, not role=menu. Nested MUI Modal aria-hides the
                 // parent menu paper; its getBoundingClientRect can shift ~16px even
                 // when the suggestion list is portaled.
+                //
+                // The menu itself mounts with a grow transition, so read the height only
+                // once that has settled — otherwise this baseline lands mid-animation
+                // and every later reading looks like unrelated growth.
                 const pane = page.locator('.attribute-graph-parents-pane');
-                const heightBeforeSearch = await pane.evaluate((el) => el.getBoundingClientRect().height);
+                const heightBeforeSearch = await waitForStableRectHeight(pane);
                 await page.getByTestId('attributeGraphParentsPane__search').click();
 
                 const suggestions = page.getByTestId('attributeGraphParentsPane__suggestions');
@@ -1327,8 +1331,10 @@ test.describe('System Console - Global Attributes form', {tag: '@system_console'
                 const mountedValueMenu = page.getByRole('menu', {name: 'Edit Air', includeHidden: true});
 
                 // * Pane does not grow by a suggestion row (~36px). Focus and the
-                // nested modal can still shift getBoundingClientRect by ~6–16px.
-                const heightAfterSearch = await pane.evaluate((el) => el.getBoundingClientRect().height);
+                // nested modal can still shift getBoundingClientRect by ~6–16px. Read the
+                // height only once the focus/modal transition has stopped moving it —
+                // sampling mid-transition is what made this assertion flaky.
+                const heightAfterSearch = await waitForStableRectHeight(pane);
                 expect(Math.abs(heightAfterSearch - heightBeforeSearch)).toBeLessThan(24);
                 await expect(mountedValueMenu).toBeAttached();
 
@@ -2480,3 +2486,25 @@ async function openGraphRowDelete(page: Page, optionName: string, parentName = '
     await row.hover();
     await row.getByTestId('attributeOptionsGraphRow__delete').click();
 }
+
+// Polls getBoundingClientRect().height until two consecutive reads agree, so callers
+// don't sample a value mid CSS-transition (e.g. a focus ring or nested modal mount).
+// expect.poll runs the first probe immediately, so that reading is only a baseline;
+// compare only after a later probe that has waited for the poll interval.
+async function waitForStableRectHeight(locator: Locator): Promise<number> {
+    let lastHeight: number | undefined;
+
+    await expect
+        .poll(
+            async () => {
+                const height = await locator.evaluate((el) => el.getBoundingClientRect().height);
+                const isStable = lastHeight !== undefined && height === lastHeight;
+                lastHeight = height;
+                return isStable;
+            },
+            {timeout: 2000, intervals: [50, 100, 150, 300]},
+        )
+        .toBe(true);
+
+    return lastHeight!;
+}
```

---

### Incident Patch 3: `cc0611f2` (2026-09-29)
**Commit Message**: Fix flaky TestSearchAllChannels (#38859)

Automatic Merge

**File**: `server/channels/api4/channel_test.go` (modified, +3/-1)
```diff
@@ -3795,7 +3795,9 @@ func TestSearchAllChannels(t *testing.T) {
 		},
 		{
 			"Name search",
-			&model.ChannelSearch{Term: "what"},
+			// Prefix of Name "whatever". Term "what" also matches InitBasic DisplayNames
+			// ("dn_"+NewId()); z-base32 includes w/h/a/t but not v.
+			&model.ChannelSearch{Term: "whatev"},
 			[]string{openChannel.Id},
 		},
 		{
```

---

### Incident Patch 4: `905bf730` (2026-09-28)
**Commit Message**: Fix errors in AD/LDAP documentation (#38426)

* Fix errors in AD/LDAP documentation

Remove a claim that mmctl ldap sync supports a nonexistent
--include-removed-members flag, and update the group-sync FAQ that
said removed LDAP group members are never re-added, which contradicted
the Re-add Removed Members on Sync setting added in v10.9.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

* Fix wording in LDAP group sync FAQ

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

---------

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
Co-authored-by: Mattermost Build <build@mattermost.com>

**File**: `docs/main/administration-guide/onboard/ad-ldap-groups-synchronization.mdx` (modified, +4/-2)
```diff
@@ -346,9 +346,11 @@ Only users that are members of groups synchronized to team are able to discover
 
 ### Why don't users get readded to teams or channels once they have been removed from and then later re-added to the LDAP group?
 
-The implementation of group removals does not currently differentiate between users who have removed themselves or have been removed by the LDAP synchronization process. Our design optimizes for users who have removed themselves from a team or channel. In the future, we may add the ability for Admins to re-add users who have been removed and even prevent users from leaving a team or channel.
+By default, the implementation of group removals does not differentiate between users who have removed themselves or have been removed by the LDAP synchronization process. Our design optimizes for users who have removed themselves from a team or channel.
 
-Additionally, LDAP users who are not accessible to Mattermost based on filters will be removed from the groups and from group synced teams and channels. If they were removed from teams and channels then they would not be re-added to those teams and channels upon becoming subsequently reaccessible to Mattermost.
+From Mattermost v10.9, you can enable [Re-add Removed Members on Sync](/administration-guide/configure/authentication-configuration-settings#re-add-removed-members-on-sync) to have members who were previously removed by LDAP synchronization automatically re-added to group-synchronized teams or channels during a subsequent sync. This setting is disabled by default.
+
+Additionally, LDAP users who are inaccessible to Mattermost based on filters will be removed from the groups and from group-synced teams and channels. If they were removed from teams and channels then they would not be re-added to those teams and channels upon becoming subsequently reaccessible to Mattermost, unless Re-add Removed Members on Sync is enabled.
 
 ### How can I use LDAP attributes or Groups with OpenID?
 
```

**File**: `docs/main/administration-guide/onboard/ad-ldap.mdx` (modified, +0/-12)
```diff
@@ -127,18 +127,6 @@ To configure AD/LDAP synchronization with AD/LDAP sign-in:
 
 3.  From Mattermost v10.9, you can configure Mattermost to automatically [re-add members of an LDAP group to group-synchronized teams or channels](/administration-guide/configure/authentication-configuration-settings#re-add-removed-members-on-sync) during LDAP synchronization, even if those members were previously removed. This option enables you to maintain uninterrupted collaboration and address specific organizational needs, ensuring users who were unintentionally removed due to changes in LDAP group membership, synchronization errors, or exceptions to the standard group sync rules can be seamlessly restored.
 
-> <div class="note">
->
-> <div class="title">
->
-> Note
->
-> </div>
->
-> The [mmctl ldap sync](/administration-guide/manage/mmctl-command-line-tool#mmctl-ldap-sync) command takes precedence over this server configuration setting. If you have this setting disabled, and run the mmctl command with the `--include-removed-members` flag, removed members will be re-added during LDAP synchronization.
->
-> </div>
-
 ## Configure AD/LDAP sign-in using filters
 
 Using filters assigns roles to specified users on login. To access AD/LDAP filter settings, navigate to **System Console \> Authentication \> AD/LDAP** to open the AD/LDAP wizard and go to the **User Filters** section.
```

---

### Incident Patch 5: `20f5e648` (2026-09-28)
**Commit Message**: Fix MM-T1773 for FIPS builds' longer min password requirement (#38807)

**File**: `e2e-tests/playwright/specs/functional/auth/password_length.spec.ts` (modified, +18/-6)
```diff
@@ -75,14 +75,18 @@ test('MM-T1772 applies a new minimum password length on signup', {tag: '@authent
 });
 
 /**
- * @objective Verify clearing Minimum password length resets it to the server default.
+ * @objective Verify clearing Minimum password length resets it to the server default on regular
+ * builds, and is rejected as below the FIPS-enforced minimum (14) on FIPS builds.
  */
 test(
     'MM-T1773 resets Minimum password length to the default after clearing it',
     {tag: '@authentication'},
     async ({pw}) => {
         const {adminUser, adminClient} = await pw.initSetup();
         const originalMinimumLength = (await adminClient.getConfig()).PasswordSettings.MinimumLength;
+
+        // # The field always falls back to 5 when cleared; that is below the FIPS minimum (14)
+        const isFips = (await adminClient.getClientConfig()).IsFipsEnabled === 'true';
         const customLength = originalMinimumLength === 20 ? 21 : 20;
         const {systemConsolePage} = await pw.testBrowser.login(adminUser);
 
@@ -98,12 +102,20 @@ test(
             // # Clear the field and save
             await systemConsolePage.passwordSettings.minimumLength.clear();
             await systemConsolePage.passwordSettings.save();
-            await systemConsolePage.passwordSettings.reload();
 
-            // * Verify the saved value resets to the compiled default, not the on-prem override
-            const resetLength = (await adminClient.getConfig()).PasswordSettings.MinimumLength;
-            expect(resetLength).toBe(5);
-            await expect(systemConsolePage.passwordSettings.minimumLength).toHaveValue(String(resetLength));
+            if (isFips) {
+                // * Verify the fallback value (5) is rejected as below the FIPS minimum (14)
+                await expect(systemConsolePage.passwordSettings.lengthError).toBeVisible();
+                const unchangedLength = (await adminClient.getConfig()).PasswordSettings.MinimumLength;
+                expect(unchangedLength).toBe(customLength);
+            } else {
+                await systemConsolePage.passwordSettings.reload();
+
+                // * Verify the saved value resets to the compiled default, not the on-prem override
+                const resetLength = (await adminClient.getConfig()).PasswordSettings.MinimumLength;
+                expect(resetLength).toBe(5);
+                await expect(systemConsolePage.passwordSettings.minimumLength).toHaveValue(String(resetLength));
+            }
         } finally {
             await adminClient.patchConfig({PasswordSettings: {MinimumLength: originalMinimumLength}});
         }
```

---

### Incident Patch 6: `3b20966b` (2026-09-25)
**Commit Message**: MM-69996: Fix session cache invalidation not fully propagating to websocket connections (#37716)

* MM-69996: Fix session cache invalidation not fully propagating to websocket connections

See MM-69996 for more details.

* Move InvalidateAllCaches webconn test to app package

The platform test suite stubs GetSession, so it cannot exercise
re-validation against the session store. Test through DeleteOAuthApp
with the real app instead.

Co-authored-by: Cursor <cursoragent@cursor.com>

* Trim webconn cache invalidation comments

Co-authored-by: Cursor <cursoragent@cursor.com>

* Keep channel index on soft webconn cache invalidation

Co-authored-by: Cursor <cursoragent@cursor.com>

---------

Co-authored-by: David Krauser <david@krauser.org>
Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `server/channels/app/oauth_test.go` (modified, +87/-0)
```diff
@@ -13,12 +13,16 @@ import (
 	"net/http/httptest"
 	"net/url"
 	"testing"
+	"time"
 
+	"github.com/gorilla/websocket"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 
 	"github.com/mattermost/mattermost/server/public/model"
 	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
+	"github.com/mattermost/mattermost/server/public/shared/i18n"
+	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
 	"github.com/mattermost/mattermost/server/v8/channels/store"
 	"github.com/mattermost/mattermost/server/v8/einterfaces"
 	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
@@ -297,6 +301,89 @@ func TestOAuthDeleteApp(t *testing.T) {
 	require.NotNil(t, appErr, "should not get session from cache or db")
 }
 
+func TestOAuthDeleteAppInvalidatesWebConnSessions(t *testing.T) {
+	mainHelper.Parallel(t)
+	th := Setup(t).InitBasic(t)
+
+	*th.App.Config().ServiceSettings.EnableOAuthServiceProvider = true
+
+	oauthApp, appErr := th.App.CreateOAuthApp(&model.OAuthApp{
+		CreatorId:    th.SystemAdminUser.Id,
+		Name:         "TestApp" + model.NewId(),
+		CallbackUrls: []string{"https://nowhere.com"},
+		Homepage:     "https://nowhere.com",
+	})
+	require.Nil(t, appErr)
+
+	oauthSession, appErr := th.App.CreateSession(th.Context, &model.Session{
+		UserId:  th.BasicUser.Id,
+		Roles:   model.SystemUserRoleId,
+		IsOAuth: true,
+	})
+	require.Nil(t, appErr)
+	_, err := th.App.Srv().Store().OAuth().SaveAccessData(&model.AccessData{
+		ClientId:     oauthApp.Id,
+		UserId:       th.BasicUser.Id,
+		Token:        oauthSession.Token,
+		RefreshToken: model.NewId(),
+		RedirectUri:  "https://nowhere.com",
+	})
+	require.NoError(t, err)
+
+	otherSession, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser2.Id})
+	require.Nil(t, appErr)
+
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		c, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
+		if err != nil {
+			return
+		}
+		defer c.Close()
+		for {
+			if _, _, err := c.NextReader(); err != nil {
+				return
+			}
+		}
+	}))
+	defer server.Close()
+
+	ps := th.App.Srv().Platform()
+	connect := func(session *model.Session) *platform.WebConn {
+		ws, _, err := (&websocket.Dialer{}).Dial("ws://"+server.Listener.Addr().String(), nil)
+		require.NoError(t, err)
+		s := *session
+		// Pin a future expiry so the WebConn trusts its cached session
+		// until something resets it.
+		s.ExpiresAt = model.GetMillis() + time.Hour.Milliseconds()
+		wc := ps.NewWebConn(&platform.WebConnConfig{
+			WebSocket:    ws,
+			Session:      s,
+			TFunc:        i18n.IdentityTfunc(),
+			Locale:       "en",
+			ConnectionID: model.NewId(),
+		}, th.App, th.App.Channels())
+		require.NoError(t, ps.HubRegister(wc))
+		go wc.Pump()
+		t.Cleanup(wc.Close)
+		require.Eventually(t, func() bool { return ps.SessionIsRegistered(s) }, 2*time.Second, 10*time.Millisecond)
+		return wc
+	}
+
+	oauthWC := connect(oauthSession)
+	otherWC := connect(otherSession)
+
+	appErr = th.App.DeleteOAuthApp(th.Context, oauthApp.Id)
+	require.Nil(t, appErr)
+
+	// Hub messages are processed in order, so these round-trips guarantee
+	// each hub has finished the invalidation.
+	ps.SessionIsRegistered(model.Session{UserId: th.BasicUser.Id})
+	ps.SessionIsRegistered(model.Session{UserId: th.BasicUser2.Id})
+
+	require.False(t, oauthWC.IsBasicAuthenticated(), "webconn session for the deleted app should be invalidated")
+	require.True(t, otherWC.IsBasicAuthenticated(), "webconn session for another user should remain valid")
+}
+
 func TestAuthorizeOAuthUser(t *testing.T) {
 	mainHelper.Parallel(t)
 	setup := func(t *testing.T, enable, tokenEndpoint, userEndpoint bool, serverURL string) *TestHelper {
```

**File**: `server/channels/app/platform/cluster_handlers.go` (modified, +12/-0)
```diff
@@ -134,11 +134,23 @@ func (ps *PlatformService) invalidateWebConnSessionCacheForAllUsersSkipClusterSe
 	}
 }
 
+// softInvalidateWebConnSessionCacheForAllUsersSkipClusterSend is like
+// invalidateWebConnSessionCacheForAllUsersSkipClusterSend but keeps session
+// tokens, so each WebConn reloads its session on next use.
+func (ps *PlatformService) softInvalidateWebConnSessionCacheForAllUsersSkipClusterSend() {
+	for _, hub := range ps.hubs {
+		if hub != nil {
+			hub.InvalidateAllCache()
+		}
+	}
+}
+
 func (ps *PlatformService) InvalidateAllCachesSkipSend() *model.AppError {
 	ps.logger.Info("Purging all caches")
 	if err := ps.ClearAllUsersSessionCacheLocal(); err != nil {
 		ps.logger.Error("Failed to purge session cache", mlog.Err(err))
 	}
+	ps.softInvalidateWebConnSessionCacheForAllUsersSkipClusterSend()
 	if err := ps.statusCache.Purge(); err != nil {
 		ps.logger.Warn("Failed to clear the status cache", mlog.Err(err))
 	}
```

**File**: `server/channels/app/platform/web_hub.go` (modified, +46/-31)
```diff
@@ -78,23 +78,24 @@ var hubSemaphoreCount = runtime.NumCPU() * 4
 type Hub struct {
 	// connectionCount should be kept first.
 	// See https://github.com/mattermost/mattermost-server/pull/7281
-	connectionCount int64
-	platform        *PlatformService
-	connectionIndex int
-	register        chan *webConnRegisterMessage
-	unregister      chan *WebConn
-	broadcast       chan *model.WebSocketEvent
-	stop            chan struct{}
-	didStop         chan struct{}
-	invalidateUser  chan string
-	invalidateAll   chan struct{}
-	activity        chan *webConnActivityMessage
-	directMsg       chan *webConnDirectMessage
-	explicitStop    bool
-	checkRegistered chan *webConnSessionMessage
-	checkConn       chan *webConnCheckMessage
-	connCount       chan *webConnCountMessage
-	broadcastHooks  map[string]BroadcastHook
+	connectionCount    int64
+	platform           *PlatformService
+	connectionIndex    int
+	register           chan *webConnRegisterMessage
+	unregister         chan *WebConn
+	broadcast          chan *model.WebSocketEvent
+	stop               chan struct{}
+	didStop            chan struct{}
+	invalidateUser     chan string
+	invalidateAll      chan struct{}
+	invalidateAllCache chan struct{}
+	activity           chan *webConnActivityMessage
+	directMsg          chan *webConnDirectMessage
+	explicitStop       bool
+	checkRegistered    chan *webConnSessionMessage
+	checkConn          chan *webConnCheckMessage
+	connCount          chan *webConnCountMessage
+	broadcastHooks     map[string]BroadcastHook
 
 	// Hub-specific semaphore for limiting concurrent goroutines
 	hubSemaphore chan struct{}
@@ -103,20 +104,21 @@ type Hub struct {
 // newWebHub creates a new Hub.
 func newWebHub(ps *PlatformService) *Hub {
 	return &Hub{
-		platform:        ps,
-		register:        make(chan *webConnRegisterMessage),
-		unregister:      make(chan *WebConn),
-		broadcast:       make(chan *model.WebSocketEvent, broadcastQueueSize),
-		stop:            make(chan struct{}),
-		didStop:         make(chan struct{}),
-		invalidateUser:  make(chan string),
-		invalidateAll:   make(chan struct{}),
-		activity:        make(chan *webConnActivityMessage),
-		directMsg:       make(chan *webConnDirectMessage),
-		checkRegistered: make(chan *webConnSessionMessage),
-		checkConn:       make(chan *webConnCheckMessage),
-		connCount:       make(chan *webConnCountMessage),
-		hubSemaphore:    make(chan struct{}, hubSemaphoreCount),
+		platform:           ps,
+		register:           make(chan *webConnRegisterMessage),
+		unregister:         make(chan *WebConn),
+		broadcast:          make(chan *model.WebSocketEvent, broadcastQueueSize),
+		stop:               make(chan struct{}),
+		didStop:            make(chan struct{}),
+		invalidateUser:     make(chan string),
+		invalidateAll:      make(chan struct{}),
+		invalidateAllCache: make(chan struct{}),
+		activity:           make(chan *webConnActivityMessage),
+		directMsg:          make(chan *webConnDirectMessage),
+		checkRegistered:    make(chan *webConnSessionMessage),
+		checkConn:          make(chan *webConnCheckMessage),
+		connCount:          make(chan *webConnCountMessage),
+		hubSemaphore:       make(chan struct{}, hubSemaphoreCount),
 	}
 }
 
@@ -475,6 +477,15 @@ func (h *Hub) InvalidateAll() {
 	}
 }
 
+// InvalidateAllCache is like InvalidateAll but keeps session tokens, so
+// each WebConn reloads its session on next use.
+func (h *Hub) InvalidateAllCache() {
+	select {
+	case h.invalidateAllCache <- struct{}{}:
+	case <-h.stop:
+	}
+}
+
 // UpdateActivity sets the LastUserActivityAt field for the connection
 // of the user.
 func (h *Hub) UpdateActivity(userID, sessionToken string, activityAt int64) {
@@ -719,6 +730,10 @@ func (h *Hub) Start() {
 				if *h.platform.Config().ServiceSettings.EnableWebHubChannelIteration {
 					connIndex.clearChannels()
 				}
+			case <-h.invalidateAllCache:
+				for webConn := range connIndex.All() {
+					webConn.InvalidateCache()
+				}
 			case activity := <-h.acti
```

---

### Incident Patch 7: `1cfdf883` (2026-09-24)
**Commit Message**: [MM-70788] Fix flaky interplugin context test (#38682)

**File**: `server/channels/app/plugin_api_test.go` (modified, +7/-3)
```diff
@@ -2166,7 +2166,6 @@ func TestInterpluginPluginHTTP(t *testing.T) {
 }
 
 func TestInterpluginPluginHTTPContext(t *testing.T) {
-	t.Skip("Skipped due to flakiness — tracked in https://mattermost.atlassian.net/browse/MM-70788")
 	mainHelper.Parallel(t)
 	th := Setup(t)
 	const testTimeout = 10 * time.Second
@@ -2418,8 +2417,13 @@ func TestInterpluginPluginHTTPContext(t *testing.T) {
 			}
 			readErrCh = make(chan error, 1)
 			go func() {
-				_, readErr := resp.Body.Read(make([]byte, 1))
-				readErrCh <- readErr
+				for {
+					_, readErr := resp.Body.Read(make([]byte, 1))
+					if readErr != nil {
+						readErrCh <- readErr
+						return
+					}
+				}
 			}()
 			select {
 			case err = <-readErrCh:
```

---

### Incident Patch 8: `6d5b018c` (2026-09-24)
**Commit Message**: fix: align sharedchannel-test deps with the server module (#38760)

Co-authored-by: Cursor <cursoragent@cursor.com>

#38705 bumped x/crypto and grpc in the server modules only, so a local run rewrote tools/sharedchannel-test/go.mod.

**File**: `tools/sharedchannel-test/go.mod` (modified, +6/-8)
```diff
@@ -6,7 +6,6 @@ require github.com/mattermost/mattermost/server/public v0.4.0
 
 require (
 	github.com/Masterminds/semver/v3 v3.5.0 // indirect
-	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
 	github.com/dyatlov/go-opengraph/opengraph v0.0.0-20220524092352-606d7b1e5f8a // indirect
 	github.com/fatih/color v1.19.0 // indirect
 	github.com/francoispqt/gojay v1.2.13 // indirect
@@ -30,24 +29,23 @@ require (
 	github.com/pelletier/go-toml v1.9.5 // indirect
 	github.com/philhofer/fwd v1.2.0 // indirect
 	github.com/pkg/errors v0.9.1 // indirect
-	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
 	github.com/stretchr/testify v1.12.1 // indirect
 	github.com/tinylib/msgp v1.6.4 // indirect
 	github.com/vmihailenco/msgpack/v5 v5.4.1 // indirect
 	github.com/vmihailenco/tagparser/v2 v2.0.0 // indirect
 	github.com/wiggin77/merror v1.0.5 // indirect
 	github.com/wiggin77/srslog v1.0.1 // indirect
-	golang.org/x/crypto v0.55.0 // indirect
-	golang.org/x/mod v0.40.0 // indirect
+	go.yaml.in/yaml/v3 v3.0.5 // indirect
+	golang.org/x/crypto v0.57.0 // indirect
+	golang.org/x/mod v0.41.0 // indirect
 	golang.org/x/net v0.58.0 // indirect
-	golang.org/x/sys v0.47.0 // indirect
-	golang.org/x/text v0.41.0 // indirect
+	golang.org/x/sys v0.48.0 // indirect
+	golang.org/x/text v0.42.0 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260819154853-08b0e4226688 // indirect
-	google.golang.org/grpc v1.83.1 // indirect
+	google.golang.org/grpc v1.84.0 // indirect
 	google.golang.org/protobuf v1.36.12 // indirect
 	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
 	gopkg.in/yaml.v2 v2.4.0 // indirect
-	gopkg.in/yaml.v3 v3.0.1 // indirect
 )
 
 replace github.com/mattermost/mattermost/server/public => ../../server/public
```

**File**: `tools/sharedchannel-test/go.sum` (modified, +19/-52)
```diff
@@ -16,14 +16,10 @@ github.com/bradfitz/go-smtpd v0.0.0-20170404230938-deb6d6237625/go.mod h1:HYsPBT
 github.com/bufbuild/protocompile v0.14.1 h1:iA73zAf/fyljNjQKwYzUHD6AD4R8KMasmwa/FBatYVw=
 github.com/bufbuild/protocompile v0.14.1/go.mod h1:ppVdAIhbr2H8asPk6k4pY7t9zB1OU5DoEw9xY/FUi1c=
 github.com/buger/jsonparser v0.0.0-20181115193947-bf1c66bbce23/go.mod h1:bbYlZJ7hK1yFx9hf58LP0zeX7UjIGs20ufpu3evjr+s=
-github.com/cespare/xxhash/v2 v2.3.0 h1:UL815xU9SqsFlibzuggzjXhog7bL6oX9BbNZnL2UFvs=
-github.com/cespare/xxhash/v2 v2.3.0/go.mod h1:VGX0DQ3Q6kWi7AoAeZDth3/j3BFtOZR5XLFGgcrjCOs=
 github.com/client9/misspell v0.3.4/go.mod h1:qj6jICC3Q7zFZvVWo7KLAzC3yx5G7kyvSDkc90ppPyw=
 github.com/coreos/go-systemd v0.0.0-20181012123002-c6f51f82210d/go.mod h1:F5haX7vjVVG0kc13fIWeqUViNPyEJxv/OmvnBo0Yme4=
 github.com/davecgh/go-spew v1.1.0/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/davecgh/go-spew v1.1.1/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
-github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc h1:U9qPSI2PIWSS1VwoXQT9A3Wy9MM3WgvqSxFWenqJduM=
-github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/dustin/go-humanize v1.0.0/go.mod h1:HtrtbFcZ19U5GC7JDqmcUSB87Iq5E25KnS6fMYU6eOk=
 github.com/dyatlov/go-opengraph/opengraph v0.0.0-20220524092352-606d7b1e5f8a h1:etIrTD8BQqzColk9nKRusM9um5+1q0iOEJLqfBMIK64=
 github.com/dyatlov/go-opengraph/opengraph v0.0.0-20220524092352-606d7b1e5f8a/go.mod h1:emQhSYTXqB0xxjLITTw4EaWZ+8IIQYw+kx9GqNUKdLg=
@@ -36,14 +32,9 @@ github.com/francoispqt/gojay v1.2.13/go.mod h1:ehT5mTG4ua4581f1++1WLG0vPdaA9HaiD
 github.com/fsnotify/fsnotify v1.4.7/go.mod h1:jwhsz4b93w/PPRr/qN1Yymfu8t87LnFCMoQvtojpjFo=
 github.com/ghodss/yaml v1.0.0/go.mod h1:4dBDuWmgqj2HViK6kFavaiC9ZROes6MMH2rRYeMEF04=
 github.com/gliderlabs/ssh v0.1.1/go.mod h1:U7qILu1NlMHj9FlMhZLlkCdDnU1DBEAqr0aevW3Awn0=
-github.com/go-asn1-ber/asn1-ber v1.5.7 h1:DTX+lbVTWaTw1hQ+PbZPlnDZPEIs0SS/GCZAl535dDk=
-github.com/go-asn1-ber/asn1-ber v1.5.7/go.mod h1:hEBeB/ic+5LoWskz+yKT7vGhhPYkProFKoKdwZRWMe0=
+github.com/go-asn1-ber/asn1-ber v1.5.8 h1:H9AZkK22UOmfX8J84ubyaZxKJZ3FMHVwn8swoMML7iQ=
 github.com/go-asn1-ber/asn1-ber v1.5.8/go.mod h1:hEBeB/ic+5LoWskz+yKT7vGhhPYkProFKoKdwZRWMe0=
 github.com/go-errors/errors v1.0.1/go.mod h1:f4zRHt4oKfwPJE5k8C9vpYG+aDHdBFUsgrm6/TyX73Q=
-github.com/go-logr/logr v1.4.3 h1:CjnDlHq8ikf6E492q6eKboGOC0T8CDaOvkHCIg8idEI=
-github.com/go-logr/logr v1.4.3/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
-github.com/go-logr/stdr v1.2.2 h1:hSWxHoqTgW2S2qGc0LTAI563KZ5YKYRhT3MFKZMbjag=
-github.com/go-logr/stdr v1.2.2/go.mod h1:mMo/vtBO5dYbehREoey6XUKy/eSumjCCveDpRre4VKE=
 github.com/goccy/go-yaml v1.19.2 h1:PmFC1S6h8ljIz6gMRBopkjP1TVT7xuwrButHID66PoM=
 github.com/goccy/go-yaml v1.19.2/go.mod h1:XBurs7gK8ATbW4ZPGKgcbrY1Br56PdM69F7LkFRi1kA=
 github.com/gogo/protobuf v1.1.1/go.mod h1:r8qH/GZQm5c6nD/R0oafs1akxWv10x8SbQlK7atdtwQ=
@@ -104,13 +95,11 @@ github.com/mattermost/logr/v2 v2.0.22 h1:npFkXlkAWR9J8payh8ftPcCZvLbHSI125mAM5/r
 github.com/mattermost/logr/v2 v2.0.22/go.mod h1:0sUKpO+XNMZApeumaid7PYaUZPBIydfuWZ0dqixXo+s=
 github.com/mattn/go-colorable v0.1.9/go.mod h1:u6P/XSegPjTcexA+o6vUJrdnUu04hMope9wVRipJSqc=
 github.com/mattn/go-colorable v0.1.12/go.mod h1:u5H1YNBxpqRaxsYJYSkiCWKzEfiAb1Gb520KVy5xxl4=
-github.com/mattn/go-colorable v0.1.14 h1:9A9LHSqF/7dyVVX6g0U9cwm9pG3kP9gSzcuIPHPsaIE=
-github.com/mattn/go-colorable v0.1.14/go.mod h1:6LmQG8QLFO4G5z1gPvYEzlUgJ2wF+stgPZH1UqBm1s8=
+github.com/mattn/go-colorable v0.1.15 h1:+u9SLTRGnXv73cEsnsmoZBom+dMU88B2M0aDcWy0/jY=
 github.com/mattn/go-colorable v0.1.15/go.mod h1:6LmQG8QLFO4G5z1gPvYEzlUgJ2wF+stgPZH1UqBm1s8=
 github.com/mattn/go-isatty v0.0.12/go.mod h1:cbi8OIDigv2wuxKPP5vlRcQ1OAZbq2CE4Kysco4FUpU=
 github.com/mattn/go-isatty v0.0.14/go.mod h1:7GGIvUiUoEMVVmxf/4nioHXj79iQHKdU27kJ6hsGG94=
-github.com/mattn/go-isatty v0.0.22 h1:j8l17JJ9i6VGPUFUYoTUKPSgKe/83EYU2zBC7YNKMw4=
-github.com/
```

---

### Incident Patch 9: `8ddcd797` (2026-09-23)
**Commit Message**: Fix K8s HA upgrade doc FAQ claiming manual DB schema migration (#38678)

* Fix K8s HA upgrade doc FAQ claiming manual DB schema migration

The FAQ said Mattermost does not migrate the schema automatically in
Kubernetes and required manual steps. Both the Operator's pre-flight
db migrate job and the server binary's startup migration apply
pending migrations automatically, same as any other deployment.

State only that a failed migration blocks the rollout, not that no
changes are applied: morph applies migrations one at a time and does
not roll back ones already applied earlier in the same run, and
individual migrations can opt out of transaction wrapping.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

* Address CodeRabbit review: transaction-wrapping caveat, startup migration overclaim

State that an individual migration can opt out of transaction
wrapping (drivers/postgres/postgres.go:211-219), not just that earlier
migrations in a failed run aren't rolled back.

Replace "so the schema stays current" with what actually happens on a
startup migration failure: server startup aborts (mlog.Fatal in
migrations.go on app migration failure; sqlstore.New returns an error
on sch

**File**: `docs/main/administration-guide/upgrade/upgrade-mattermost-kubernetes-ha.mdx` (modified, +1/-1)
```diff
@@ -224,7 +224,7 @@ Upgrade the Operator first. Validate it’s stable before upgrading the Mattermo
 
 ### Do I need to upgrade the database separately?
 
-Mattermost does not upgrade the database schema by default. You must manually apply database schema updates if required by a newer Mattermost version. Review the [Mattermost Server changelog](/product-overview/mattermost-v10-changelog) for any migration steps.
+No manual action is required. The Mattermost Operator runs a pre-flight job with the new image to apply any pending database schema migrations before rolling out the upgrade. If the migration fails, the rollout is blocked; migrations already applied earlier in that run aren't automatically rolled back, and an individual migration can also opt out of transaction wrapping, so restore from backup before retrying (see [Rollback strategy](#rollback-strategy)). The Mattermost server binary also attempts any pending migrations on startup, even if the pre-flight job is disabled (`spec.updateJob.disabled: true`); if a migration fails there, server startup aborts and the pod does not become ready.
 
 ### What if my pods don’t become ready after the upgrade?
 
```

---

### Incident Patch 10: `bc7bb75c` (2026-09-23)
**Commit Message**: Fix MySQL 8.4+ authentication docs for PostgreSQL migration and server requirements (#38679)

* Fix MySQL 8.4+ authentication docs for PostgreSQL migration and server requirements

default-authentication-plugin was removed in MySQL 8.4; the replacement
is authentication_policy. Document the 8.4+ path in the pgloader
migration troubleshooting section, and cross-link it from the
migration-assist tool page's caching_sha2_password warning.

Also scope the software/hardware requirements page's
mysql_native_password instruction to the pgloader migration path only:
the Go MySQL driver supports caching_sha2_password natively, so no
server-side config change is needed to run Mattermost itself.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

* Apply CodeRabbit fix for MySQL 8.4 authentication_policy and restore qmynd alternative

Scope the mysql_native_password workaround to MySQL 8.4 only (not 9.0+,
where the plugin is removed), add mysql_native_password=ON under
[mysqld] with a restart before SET PERSIST/ALTER USER, per CodeRabbit
review on the prior commit.

Also restore the qitab/qmynd custom-image alternative in
postgres-migration-assist-tool.mdx, which the prior commit had dr

**File**: `docs/main/administration-guide/manage/admin/postgres-migration-assist-tool.mdx` (modified, +2/-2)
```diff
@@ -13,7 +13,7 @@ Download the Mattermost `migration-assist` tool from the GitHub repository [rele
 
 While you can run the `migration-assist` tool on the same server as your Mattermost deployment, we recommend running the tool in a virtual machine on the same network as your Mattermost server instead. The tool itself is lightweight and does not require a large server. A server with 2 CPU cores and 16 GB of RAM should be sufficient. If preferred, you can download and [compile](#compile-the-migration-assist-tool) the `migration-assist` tool yourself.
 
-You'll also need to install the `pgloader` tool to migrate your data from MySQL to PostgreSQL. We recommend running `pgloader` in a virtual machine on the same network as your Mattermost server. You can use our official Mattermost Docker image for pgloader (`mattermost/pgloader:latest`); please note that it does **not** currently support MySQL’s `caching_sha2_password` authentication plugin. If you require `caching_sha2_password` support, you’ll need to build your own image and include the [qitab/qmynd](https://github.com/qitab/qmynd) library. See the [pgloader](/administration-guide/manage/admin/manual-postgres-migration#install-pgloader) installation documentation for details.
+You'll also need to install the `pgloader` tool to migrate your data from MySQL to PostgreSQL. We recommend running `pgloader` in a virtual machine on the same network as your Mattermost server. Our official Mattermost Docker image for pgloader (`mattermost/mattermost-pgloader:latest`) does **not** currently support MySQL’s `caching_sha2_password` authentication plugin; for a reliable migration, switch MySQL to `mysql_native_password` beforehand, see [Unsupported authentication for MySQL](/administration-guide/manage/admin/postgres-migration#unsupported-authentication-for-mysql) for the steps. Alternatively, if you require `caching_sha2_password` support, you’ll need to build your own image and include the [qitab/qmynd](https://github.com/qitab/qmynd) library. See the [pgloader](/administration-guide/manage/admin/manual-postgres-migration#install-pgloader) installation documentation for details.
 
 ## Usage
 
@@ -100,7 +100,7 @@ migration-assist pgloader \
 pgloader migration.load > migration.log
 ```
 
-Carefully review <code>migration.log</code> for errors (e.g., duplicate-key or missing-table warnings). Use the `mattermost/pgloader:latest` Docker image to avoid build/auth issues.
+Carefully review <code>migration.log</code> for errors (e.g., duplicate-key or missing-table warnings). Use the `mattermost/mattermost-pgloader:latest` Docker image to avoid build/auth issues.
 
 ### Step 5 - Restore full-text indexes & create all indexes
 
```

**File**: `docs/main/administration-guide/manage/admin/postgres-migration.mdx` (modified, +18/-1)
```diff
@@ -54,12 +54,29 @@ Because of these reasons we also don't support migrations directly from MariaDB
 
 ### Unsupported authentication for MySQL
 
-If you are facing an error due to authentication with MySQL v8, it may be related to a [known issue](https://github.com/dimitri/pgloader/issues/782) with pgloader. The fix is to set the default authentication method to `mysql_native_password` in your MySQL configuration. To do so, add the `default-authentication-plugin=mysql_native_password` value to your `mysql.cnf` file. Also, do not forget to update your user to use this authentication method.
+If you are facing an error due to authentication with MySQL v8, it may be related to a [known issue](https://github.com/dimitri/pgloader/issues/782) with pgloader. The fix is to set the default authentication method to `mysql_native_password` in your MySQL configuration.
+
+- **MySQL 8.0 - 8.3**: add the `default-authentication-plugin=mysql_native_password` value to your `mysql.cnf` file.
+- **MySQL 8.4**: `default-authentication-plugin` was removed, and the `mysql_native_password` plugin is disabled by default. Add `mysql_native_password=ON` under `[mysqld]` in your MySQL configuration and restart MySQL, then set `authentication_policy`:
+
+``` sql
+SET PERSIST authentication_policy='mysql_native_password,,';
+```
+
+This does not apply to MySQL 9.0+, which removes the `mysql_native_password` plugin entirely.
+
+Also, do not forget to update your user to use this authentication method.
 
 ``` sql
 ALTER USER '<mysql_user>'@'%' IDENTIFIED WITH mysql_native_password BY '<mysql_password>';
 ```
 
+<Note>
+
+`mysql_native_password` is disabled by default starting with MySQL 8.4 and removed entirely in MySQL 9.x. This workaround is only needed for the migration itself; once you're running on PostgreSQL, you can revert MySQL back to its original authentication method.
+
+</Note>
+
 ### Errors during the pgloader command execution
 
 If you encounter errors during the execution of the `pgloader` command, ensure that both of the databases are accessible and that the users have the necessary permissions to access the database. Do not continue with the migration if there are errors during the execution of the `pgloader` command.
```

**File**: `docs/main/deployment-guide/software-hardware-requirements.mdx` (modified, +4/-5)
```diff
@@ -269,12 +269,11 @@ MySQL 8.0.22 contains an [issue with JSON column types](https://bugs.mysql.com/b
 
 </Important>
 
-In MySQL 8.0.4, the default authentication plugin was changed from `mysql_native_password` to `caching_sha2_password`. Therefore, you will need to enable `mysql_native_password` by adding the following entry in your MySQL configuration file:
+<Note>
+
+In MySQL 8.0.4, the default authentication plugin was changed from `mysql_native_password` to `caching_sha2_password`. If you're migrating from MySQL 8.0-8.4 to PostgreSQL using `pgloader`, you'll need to switch the default authentication method back to `mysql_native_password`. See [Unsupported authentication for MySQL](/administration-guide/manage/admin/postgres-migration#unsupported-authentication-for-mysql) for the version-specific steps.
 
-> ``` text
-> [mysqld]
-> default-authentication-plugin=mysql_native_password
-> ```
+</Note>
 
 In MySQL 8, the default collation changed to `utf8mb4_0900_ai_ci` ([https://dev.mysql.com/doc/mysqld-version-reference/en/optvar-changes-8-0.html](https://dev.mysql.com/doc/mysqld-version-reference/en/optvar-changes-8-0.html)). Therefore, if you update your MySQL installation to version 8, you'll need to convert your database tables to use the new default collation:
 
```

#### Recent Merged Pull Requests:
- **PR #38890** (2026-09-30): Automated cherry pick of #38821 (@mattermost-build)
- **PR #38889** (2026-09-30): Automated cherry pick of #38412 (@mattermost-build)
- **PR #38886** (2026-09-30): Cherry pick #38747 to release-12.0 (@mattermost-code)
- **PR #38880** (2026-09-30): Automated cherry pick of #38009 (@mattermost-code)
- **PR #38878** (2026-09-30): Automated cherry pick of #38851 (@mattermost-build)
- **PR #38876** (2026-09-30): Automated cherry pick of #38853 (@mattermost-build)
- **PR #38872** (2026-09-30): Cherry pick #38509 to release-11.7 (@saturninoabril)
- **PR #38871** (2026-09-30): Fix flaky post-list scroll and Global Attributes menu-height Playwright specs (@saturninoabril)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

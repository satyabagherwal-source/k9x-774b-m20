# Forensic Learning Record (Deep Inspection): dolthub/dolt

> **Canonical Artifact**: `07_PROJECT_LEARNING/dolthub-dolt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dolthub/dolt](https://github.com/dolthub/dolt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:34:56.830Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dolthub/dolt`
- **Description**: Dolt – Git for Data
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 24544 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `go/cmd/dolt/cli/arg_helpers.go`
```
// Copyright 2019 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cli

import (
	"errors"
	"os"

	"github.com/dolthub/dolt/go/libraries/utils/argparser"
)

var ErrEmptyDefTuple = errors.New("empty definition tuple")

type UsagePrinter func()

// ParseArgs is used for Dolt SQL functions that are run on the server and should not exit
func ParseArgs(ap *argparser.ArgParser, args []string, usagePrinter UsagePrinter) (*argparser.ArgParseResults, error) {
	apr, err := ap.Parse(args)

	if err != nil {
		// --help param
		if usagePrinter != nil {
			usagePrinter()
		}

		return nil, err
	}

	return apr, nil
}

// ParseArgsOrDie is used for CLI command that should exit after erroring.
func ParseArgsOrDie(ap *argparser.ArgParser, args []string, usagePrinter UsagePrinter) *argparser.ArgParseResults {
	apr, err := ap.Parse(args)

	if err != nil {
		if err != argparser.ErrHelp {
			PrintErrln(err.Error())

			if usagePrinter != nil {
				usagePrinter()
			}

			os.Exit(1)
		}

		// --help param
		if usagePrinter != nil {
			usagePrinter()
		}
		os.Exit(0)
	}

	return apr
}

func HelpAndUsagePrinters(cmdDoc *CommandDocumentation) (UsagePrinter, UsagePrinter) {
	// TODO handle error states
	longDesc, _ := cmdDoc.GetLongDesc(CliFormat)
	synopsis, _ := cmdDoc.GetSynopsis(CliFormat)

	return func() {
			PrintHelpText(cmdDoc.CommandStr, cmdDoc.GetShortDesc(), longDesc, synopsis, cmdDoc.ArgParser)
		}, func() {
			PrintUsage(cmdDoc.CommandStr, synopsis, cmdDoc.ArgParser)
		}
}

```

### Core Architecture Module: `go/cmd/dolt/cli/arg_parser_helpers.go`
```
// Copyright 2020 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cli

import (
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/dolthub/dolt/go/libraries/doltcore/dbfactory"
	"github.com/dolthub/dolt/go/libraries/doltcore/dconfig"
	"github.com/dolthub/dolt/go/libraries/utils/argparser"
)

const VerboseFlag = "verbose"

// Parses the author flag for the commit method.
func ParseAuthor(authorStr string) (string, string, error) {
	if len(authorStr) == 0 {
		return "", "", errors.New("Option 'author' requires a value")
	}

	reg := regexp.MustCompile("(?m)([^)]+) \\<([^)]+)") // Regex matches Name <email
	matches := reg.FindStringSubmatch(authorStr)        // This function places the original string at the beginning of matches

	// If name and email are provided
	if len(matches) != 3 {
		return "", "", errors.New("Author not formatted correctly. Use 'Name <author@example.com>' format")
	}

	name := matches[1]
	email := strings.ReplaceAll(matches[2], ">", "")

	return name, email, nil
}

var branchForceFlagDesc = "Reset {{.LessThan}}branchname{{.GreaterThan}} to {{.LessThan}}startpoint{{.GreaterThan}}, even if {{.LessThan}}branchname{{.GreaterThan}} exists already. Without {{.EmphasisLeft}}-f{{.EmphasisRight}}, {{.EmphasisLeft}}dolt branch{{.EmphasisRight}} refuses to change an existing branch. In combination with {{.EmphasisLeft}}-d{{.EmphasisRight}} (or {{.EmphasisLeft}}--delete{{.EmphasisRight}}), allow deleting the branch irrespective of its merged status. In combination with -m (or {{.EmphasisLeft}}--move{{.EmphasisRight}}), allow renaming the branch even if the new branch name already exists, the same applies for {{.EmphasisLeft}}-c{{.EmphasisRight}} (or {{.EmphasisLeft}}--copy{{.EmphasisRight}})."

// CreateCommitArgParser creates the argparser shared dolt commit cli and DOLT_COMMIT.
func CreateCommitArgParser(supportsBranchFlag bool) *argparser.ArgParser {
	ap := argparser.NewArgParserWithMaxArgs("commit", 0)
	ap.SupportsString(MessageArg, "m", "msg", "Use the given {{.LessThan}}msg{{.GreaterThan}} as the commit message.")
	ap.SupportsFlag(AllowEmptyFlag, "", "Allow recording a commit that has the exact same data as its sole parent. This is usually a mistake, so it is disabled by default. This option bypasses that safety. Cannot be used with --skip-empty.")
	ap.SupportsFlag(SkipEmptyFlag, "", "Only create a commit if there are staged changes. If no changes are staged, the call to commit is a no-op. Cannot be used with --allow-empty.")
	ap.SupportsString(DateParam, "", "date", "Specify the date used in the commit. If not specified the current system time is used.")
	ap.SupportsFlag(ForceFlag, "f", "Ignores any foreign key warnings and proceeds with the commit.")
	ap.SupportsString(AuthorParam, "", "author", "Specify an explicit author using the standard A U Thor {{.LessThan}}author@example.com{{.GreaterThan}} format.")
	ap.SupportsFlag(AllFlag, "a", "Adds all existing, changed tables (but not new tables) in the working set to the staged set.")
	ap.SupportsFlag(UpperCaseAllFlag, "A", "Adds all tables and databases (including new tables) in the working set to the staged set.")
	ap.SupportsFlag(AmendFlag, "", "Amend previous commit")
	ap.SupportsOptionalString(SignFlag, "S", "key-id", "Sign the commit using GPG. If no key-id is provided the key-id is taken from 'user.signingkey' the in the configuration")
	ap.SupportsFlag(SkipVerificationFlag, "", "Skip commit verification")
	if supportsBranchFlag {
		ap.SupportsString(BranchParam, "", "branch", "Commit to the specified branch instead of the current branch.")
	}
	return ap
}

func CreateConflictsResolveArgParser() *argparser.ArgParser {
	ap := argparser.NewArgParserWithVariableArgs("conflicts resolve")
	ap.SupportsFlag(OursFlag, "", "For all conflicts, take the version from our branch and resolve the conflict")
	ap.SupportsFlag(TheirsFlag, "", "For all conflicts, take the version from their branch and resolve the conflict")
	return ap
}

func CreateUpdateTagArgParser() *argparser.ArgParser {
	ap := argparser.NewArgParserWithMaxArgs("update-tag", 3)
	ap.ArgListHelp = append(ap.ArgListHelp, [2]string{"table", "The name of the table"})
	ap.ArgListHelp = append(ap.ArgListHelp, [2]string{"column", "The name of the column"})
	ap.ArgListHelp = append(ap.ArgListHelp, [2]string{"tag", "The new tag value"})
	return ap
}

func CreateMergeArgParser() *argparser.ArgParser {
	ap := argparser.NewArgParserWithMaxArgs("merge", 1)
	ap.TooManyArgsErrorFunc = func(receivedArgs []string) error {
		return errors.New("Error: Dolt does not support merging from multiple commits. You probably meant to checkout one and then merge from the other.")
	}
	ap.SupportsFlag(NoFFParam, "", "Create a merge commit even when the merge resolves as a fast-forward.")
	ap.SupportsFlag(FFOnlyParam, "", "Refuse to merge unless the current HEAD is already up to date or the merge can be resolved as a fast-forward.")
	ap.SupportsFlag(SquashParam, "", "Merge changes to the working set without updating the commit history")
	ap.SupportsString(MessageArg, "m", "msg", "Use the given {{.LessThan}}msg{{.GreaterThan}} as the commit message.")
	ap.SupportsFlag(AbortParam, "", "Abort the in-progress merge and return the working set to the state before the merge started.")
	ap.SupportsFlag(CommitFlag, "", "Perform the merge and commit the result. This is the default option, but can be overridden with the --no-commit flag. Note that this option does not affect fast-forward merges, which don't create a new merge commit, and if any merge conflicts or constraint violations are detected, no commit will be attempted.")
	ap.SupportsFlag(NoCommitFlag, "", "Perform the merge and stop just before creating a merge commit. Note this will not prevent a fast-forward merge; use the --no-ff arg together with the --no-commit arg to prevent both fast-forwards and merge commits.")
	ap.SupportsFlag(NoEditFlag, "", "Use an auto-generated commit message when creating a merge commit. The default for interactive CLI sessions is to open an editor.")
	ap.SupportsString(AuthorParam, "", "author", "Specify an explicit author using the standard A U Thor {{.LessThan}}author@example.com{{.GreaterThan}} format.")
	ap.SupportsFlag(SkipVerificationFlag, "", "Skip commit verification before merge")

	return ap
}

func CreateStashArgParser() *argparser.ArgParser {
	ap := argparser.NewArgParserWithMaxArgs("stash", 3)
	ap.SupportsFlag(IncludeUntrackedFlag, "u", "Untracked tables are also stashed.")
	ap.SupportsFlag(AllFlag, "a", "All tables are stashed, including untracked and ignored tables.")
	return ap
}

func CreateRebaseArgParser() *argparser.ArgParser {
	ap := argparser.NewArgParserWithMaxArgs("rebase", 1)
	ap.TooManyArgsErrorFunc = func(receivedArgs []string) error {
		return errors.New("rebase takes at most one positional argument.")
	}
	ap.SupportsString(EmptyParam, "", "empty", "How to handle commits that are not empty to start, but which become empty after rebasing. Valid values are: drop (default) or keep")
	ap.SupportsFlag(AbortParam, "", "Abort an interactive rebase and return the working set to the pre-rebase state")
	ap.SupportsFlag(ContinueFlag, "", "Continue an interactive rebase after adjusting the rebase plan")
	ap.SupportsFlag(InteractiveFlag, "i", "Start an interactive rebase")
	ap.SupportsFlag(SkipVerificationFlag, "", "Skip commit verification before rebase")
	return ap
}

func CreatePushArgParser() *argparser.ArgParser {
	ap := a
```

### Core Architecture Module: `go/cmd/dolt/cli/cli_context.go`
```
// Copyright 2023 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cli

import (
	"context"
	"errors"

	"github.com/dolthub/go-mysql-server/sql"

	"github.com/dolthub/dolt/go/cmd/dolt/errhand"
	"github.com/dolthub/dolt/go/libraries/doltcore/env"
	"github.com/dolthub/dolt/go/libraries/utils/argparser"
	"github.com/dolthub/dolt/go/libraries/utils/filesys"
)

type LateBindQueryistResult struct {
	Queryist Queryist
	Context  *sql.Context
	IsRemote bool
	Closer   func()
}

type LateBindQueryistConfig struct {
	EnableAutoGC bool
}

type LateBindQueryistOption func(*LateBindQueryistConfig)

// LateBindQueryist is a function that will be called the first time Queryist is needed for use. Input is a context which
// is appropriate for the call to commence. Output is a LateBindQueryistResult, which includes a Queryist, a sql.Context, and
// a closer function. It can also result in an error.
//
// The Closer function should be called when the Queryist is no longer needed. If the result is cached and returned to
// multiple callers, it should be called after the cached result itself is no longer needed.
//
// A LateBindqueryistResult includes enough information for a caller to know if it is connecting to a remote Dolt instance
// or if it running the SqlEngine locally in-process. The CliContext uses this, in addition to its own local state, to
// let a caller know if they are connected to a remote and if this is the first QueryEngine fetch of the process lifecycle.
// This is reflected in |IsRemote| and, in the case of QueryEngineResult, |IsFirstUse|.
//
// This state is useful for determining whether a command making use of the CliContext is being run within the context of
// another command. This is particularly interesting when running a \checkout in a dolt sql session. It makes sense to do
// so in the context of `dolt sql`, but not in the context of `dolt checkout` when connected to a remote server.
type LateBindQueryist func(ctx context.Context, opts ...LateBindQueryistOption) (LateBindQueryistResult, error)

// CliContexct is used to pass top level command information down to subcommands.
type CliContext interface {
	// GlobalArgs returns the arguments passed before the subcommand.
	GlobalArgs() *argparser.ArgParseResults
	WorkingDir() filesys.Filesys
	Config() *env.DoltCliConfig
	QueryEngine(ctx context.Context, opts ...LateBindQueryistOption) (QueryEngineResult, error)
	// Release resources associated with the CliContext, including
	// any QueryEngines which were provisioned over the lifetime
	// of the CliContext.
	Close()
}

// NewCliContext creates a new CliContext instance. Arguments must not be nil.
func NewCliContext(args *argparser.ArgParseResults, config *env.DoltCliConfig, cwd filesys.Filesys, latebind LateBindQueryist) (CliContext, errhand.VerboseError) {
	if args == nil || config == nil || cwd == nil || latebind == nil {
		return nil, errhand.VerboseErrorFromError(errors.New("Invariant violated. args, config, cwd, and latebind must be non nil."))
	}

	return LateBindCliContext{
		globalArgs:    args,
		config:        config,
		cwd:           cwd,
		activeContext: &QueryistContext{},
		bind:          latebind,
	}, nil
}

type QueryistContext struct {
	sqlCtx   *sql.Context
	qryist   *Queryist
	isRemote bool
	close    func()
}

// LateBindCliContext is a struct that implements CliContext. Its primary purpose is to wrap the global arguments and
// provide an implementation of the QueryEngine function. This instance is stateful to ensure that the Queryist is only
// created once.
type LateBindCliContext struct {
	globalArgs    *argparser.ArgParseResults
	cwd           filesys.Filesys
	config        *env.DoltCliConfig
	activeContext *QueryistContext

	bind LateBindQueryist
}

type QueryEngineResult struct {
	Queryist Queryist
	Context  *sql.Context
	// |true| if this is the first time the CliContext is returning a QueryEngineResult.
	// Otherwise it will be |false|, which means this CliContext has already been used
	// to retrieve a Queryist, and the Queryist coming back is the cached result.
	IsFirstResult bool
	IsRemote      bool
}

// GlobalArgs returns the arguments passed before the subcommand.
func (lbc LateBindCliContext) GlobalArgs() *argparser.ArgParseResults {
	return lbc.globalArgs
}

// QueryEngine returns a Queryist, a sql.Context, a closer function, and an error. It ensures that only one call to the
// LateBindQueryist is made, and caches the result. Note that if this is called twice, the closer function returns will
// be nil, callers should check if is nil.
func (lbc LateBindCliContext) QueryEngine(ctx context.Context, opts ...LateBindQueryistOption) (res QueryEngineResult, err error) {
	if lbc.activeContext != nil && lbc.activeContext.qryist != nil && lbc.activeContext.sqlCtx != nil {
		res.Queryist = *lbc.activeContext.qryist
		res.Context = lbc.activeContext.sqlCtx
		res.IsRemote = lbc.activeContext.isRemote
		// Returning a cached result.
		res.IsFirstResult = false
		return res, nil
	}

	bindRes, err := lbc.bind(ctx, opts...)
	if err != nil {
		return res, err
	}

	lbc.activeContext.qryist = &bindRes.Queryist
	lbc.activeContext.sqlCtx = bindRes.Context
	lbc.activeContext.close = bindRes.Closer
	lbc.activeContext.isRemote = bindRes.IsRemote

	res.Queryist = bindRes.Queryist
	res.Context = bindRes.Context
	res.IsRemote = bindRes.IsRemote
	res.IsFirstResult = true
	return res, nil
}

func (lbc LateBindCliContext) Close() {
	if lbc.activeContext != nil && lbc.activeContext.close != nil {
		lbc.activeContext.close()
	}
}

func (lbc LateBindCliContext) WorkingDir() filesys.Filesys {
	return lbc.cwd
}

// Config returns the dolt config stored in CliContext
func (lbc LateBindCliContext) Config() *env.DoltCliConfig {
	return lbc.config
}

var _ CliContext = LateBindCliContext{}

```

### Core Architecture Module: `go/cmd/dolt/cli/command.go`
```
// Copyright 2019 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cli

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/vitess/go/vt/sqlparser"
	"github.com/fatih/color"

	"github.com/dolthub/dolt/go/libraries/doltcore/env"
	"github.com/dolthub/dolt/go/libraries/events"
	"github.com/dolthub/dolt/go/libraries/utils/argparser"
	config "github.com/dolthub/dolt/go/libraries/utils/config"
	"github.com/dolthub/dolt/go/store/nbs"
	eventsapi "github.com/dolthub/eventsapi_schema/dolt/services/eventsapi/v1alpha1"
)

func IsHelp(str string) bool {
	str = strings.TrimSpace(str)

	if len(str) == 0 {
		return false
	}

	if str[0] != '-' {
		return false
	}

	str = strings.ToLower(strings.TrimLeft(str, "- "))

	return str == "h" || str == "help"
}

func hasHelpFlag(args []string) bool {
	for _, arg := range args {
		if IsHelp(arg) {
			return true
		}
	}
	return false
}

// globalArgsSpecifyDB checks if the global arguments contain --use-db or --host flags,
// which indicate that the user is manually specifying a database connection
// rather than relying on the current directory being a dolt repository.
func globalArgsSpecifyDB(cliCtx CliContext) bool {
	if cliCtx == nil {
		return false
	}
	globalArgs := cliCtx.GlobalArgs()
	if globalArgs == nil {
		return false
	}
	_, hasUseDb := globalArgs.GetValue("use-db")
	_, hasHost := globalArgs.GetValue(HostFlag)
	return hasUseDb || hasHost
}

// Command is the interface which defines a Dolt cli command
type Command interface {
	// Name returns the name of the Dolt cli command. This is what is used on the command line to invoke the command
	Name() string
	// Description returns a description of the command
	Description() string
	// Exec executes the command
	Exec(ctx context.Context, commandStr string, args []string, dEnv *env.DoltEnv, cliCtx CliContext) int
	// Docs returns the documentation for this command, or nil if it's undocumented
	Docs() *CommandDocumentation
	// ArgParser returns the arg parser for this command
	ArgParser() *argparser.ArgParser
}

// SignalCommand is an extension of Command that allows commands to install their own signal handlers, rather than use
// the global one (which cancels the global context).
type SignalCommand interface {
	Command

	// InstallsSignalHandlers returns whether this command manages its own signal handlers for interruption / termination.
	InstallsSignalHandlers() bool
}

// Queryist is generic interface for executing queries. Commands will be provided a Queryist to perform any work using
// SQL. The Queryist can be obtained from the CliContext passed into the Exec method by calling the QueryEngine method.
type Queryist interface {
	Query(ctx *sql.Context, query string) (sql.Schema, sql.RowIter, *sql.QueryFlags, error)
	QueryWithBindings(ctx *sql.Context, query string, parsed sqlparser.Statement, bindings map[string]sqlparser.Expr, qFlags *sql.QueryFlags) (sql.Schema, sql.RowIter, *sql.QueryFlags, error)
}

// ShellServerQueryist is used to gather warnings in the sql-shell context when a server is running.
// We call an extra "show warnings" query, but want to avoid this in other cases, (i.e. dolt sql -q)
type ShellServerQueryist interface {
	EnableGatherWarnings()
}

// This type is to store the content of a documented command, elsewhere we can transform this struct into
// other structs that are used to generate documentation at the command line and in markdown files.
type CommandDocumentationContent struct {
	ShortDesc string
	LongDesc  string
	Synopsis  []string
}

// type CommandDocumentation

// RepoNotRequiredCommand is an optional interface that commands can implement if the command can be run without
// the current directory being a valid Dolt data repository.  Any commands not implementing this interface are
// assumed to require that they be run from a directory containing a Dolt data repository.
type RepoNotRequiredCommand interface {
	// RequiresRepo should return false if this interface is implemented, and the command does not have the requirement
	// that it be run from within a data repository directory
	RequiresRepo() bool
}

// EventMonitoredCommand is an optional interface that can be overridden in order to generate an event which is sent
// to the metrics system when the command is run
type EventMonitoredCommand interface {
	// EventType returns the type of the event to log
	EventType() eventsapi.ClientEventType
}

// HiddenCommand is an optional interface that can be overridden so that a command is hidden from the help text
type HiddenCommand interface {
	// Hidden should return true if this command should be hidden from the help text
	Hidden() bool
}

// SubCommandHandler is a command implementation which holds subcommands which can be called
type SubCommandHandler struct {
	name        string
	description string
	// Unspecified ONLY applies when no other command has been given. This is different from how a default command would
	// function, as a command that doesn't exist for this sub handler will result in an error.
	Unspecified Command
	Subcommands []Command
	hidden      bool
}

// NewSubCommandHandler returns a new SubCommandHandler instance
func NewSubCommandHandler(name, description string, subcommands []Command) SubCommandHandler {
	return SubCommandHandler{name, description, nil, subcommands, false}
}

// NewHiddenSubCommandHandler returns a new SubCommandHandler instance that is hidden from display
func NewHiddenSubCommandHandler(name, description string, subcommands []Command) SubCommandHandler {
	return SubCommandHandler{name, description, nil, subcommands, true}
}

// NewSubCommandHandlerWithUnspecified returns a new SubCommandHandler that will invoke the unspecified command ONLY if
// no direct command is given.
func NewSubCommandHandlerWithUnspecified(name, description string, hidden bool, unspecified Command, subcommands []Command) SubCommandHandler {
	return SubCommandHandler{name, description, unspecified, subcommands, hidden}
}

func (hc SubCommandHandler) Name() string {
	return hc.name
}

func (hc SubCommandHandler) Description() string {
	return hc.description
}

func (hc SubCommandHandler) RequiresRepo() bool {
	return false
}

func (hc SubCommandHandler) Docs() *CommandDocumentation {
	return nil
}

func (hc SubCommandHandler) ArgParser() *argparser.ArgParser {
	return nil
}

func (hc SubCommandHandler) Hidden() bool {
	return hc.hidden
}

func (hc SubCommandHandler) Exec(ctx context.Context, commandStr string, args []string, dEnv *env.DoltEnv, cliCtx CliContext) int {
	if len(args) < 1 && hc.Unspecified == nil {
		hc.PrintUsage(commandStr)
		return 1
	}

	var subCommandStr string
	if len(args) > 0 {
		subCommandStr = strings.ToLower(strings.TrimSpace(args[0]))
	}

	for _, cmd := range hc.Subcommands {
		if strings.EqualFold(cmd.Name(), subCommandStr) {
			return hc.handleCommand(ctx, commandStr+" "+subCommandStr, cmd, args[1:], dEnv, cliCtx)
		}
	}
	if hc.Unspecified != nil {
		return hc.handleCommand(ctx, commandStr, hc.Unspecified, args, dEnv, cliCtx)
	}

	if !IsHelp(subCommandStr) {
		PrintErrln(color.RedString("Unknown Command " + subCommandStr))
		return 1
	}

	hc.PrintUsage(commandStr)
	return 0
}

func (hc SubCommandHandler) handleCommand(ctx context.Context, commandStr string, cmd Command, args []string, dEnv *env.DoltEnv, cliCtx CliContext) int {
	cmdRequiresRepo := true
	if rnrCmd, ok := cmd.(RepoNotRequiredCommand
```

### Core Architecture Module: `go/cmd/dolt/cli/credentials.go`
```
// Copyright 2023 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cli

import (
	"errors"
	"os"

	"golang.org/x/crypto/ssh/terminal"

	"github.com/dolthub/dolt/go/libraries/doltcore/dconfig"
	"github.com/dolthub/dolt/go/libraries/utils/argparser"
)

type UserPassword struct {
	Username  string
	Password  string
	Specified bool // If true, the user and password were provided by the user.
}

// BuildUserPasswordPrompt builds a UserPassword struct from the parsed args. The user is prompted for a password if one
// is not provided. If a username is not provided, the default is "root" (which will not be allowed is a password is
// provided). A new instances of ArgParseResults is returned which does not contain the user or password flags.
func BuildUserPasswordPrompt(parsedArgs *argparser.ArgParseResults) (newParsedArgs *argparser.ArgParseResults, credentials *UserPassword, err error) {
	userId, hasUserId := parsedArgs.GetValue(UserFlag)
	if !hasUserId {
		envUser, hasEnvUser := os.LookupEnv(dconfig.EnvUser)
		if hasEnvUser {
			userId = envUser
			hasUserId = true
		}
	}

	password, hasPassword := parsedArgs.GetValue(PasswordFlag)
	if !hasPassword {
		envPassword, hasEnvPassword := os.LookupEnv(dconfig.EnvPassword)
		if hasEnvPassword {
			password = envPassword
			hasPassword = true
		}
	}

	newParsedArgs = parsedArgs.DropValue(UserFlag)
	newParsedArgs = newParsedArgs.DropValue(PasswordFlag)

	if !hasUserId && !hasPassword {
		// Common "out of box" behavior.
		return newParsedArgs, &UserPassword{Username: "root", Password: "", Specified: false}, nil
	}

	if hasUserId && hasPassword {
		return newParsedArgs, &UserPassword{Username: userId, Password: password, Specified: true}, nil
	}

	if hasUserId && !hasPassword {
		password = ""
		val, hasVal := os.LookupEnv(dconfig.EnvPassword)
		if hasVal {
			password = val
		} else {
			Printf("Enter password: ")
			passwordBytes, err := terminal.ReadPassword(int(os.Stdin.Fd()))
			if err != nil {
				return nil, nil, err
			}
			password = string(passwordBytes) // Assuming UTF-8 for time being. This may not work forever.
		}
		return newParsedArgs, &UserPassword{Username: userId, Password: password, Specified: true}, nil
	}

	testOverride, hasTestOverride := os.LookupEnv(dconfig.EnvSilenceUserReqForTesting)
	if hasTestOverride && testOverride == "Y" {
		// Used for BATS testing only. Typical usage will not hit this path, but we have many legacy tests which
		// do not provide a user, and the DOLT_ENV_PWD is set to avoid the prompt.
		return newParsedArgs, &UserPassword{Specified: false}, nil
	}

	return nil, nil, errors.New("When a password is provided, a user must also be provided. Use the --user flag to provide a username")
}

```

### Core Architecture Module: `go/cmd/dolt/cli/doc.go`
```
// Copyright 2019 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package cli provides utilities for the dolt command line.
//
// cli provides:
//
//   - the interface for creating and managing hierarchical dolt commands. These typically have command lines that look like:
//     app command [<options>]
//     app command subcommand [<options>]
//     app command subcommand1 subcommand2 [<options>]
//     etc.
//
//   - Command help and usage printing
//
//   - The interface for writing output to the user
//
//   - Argument parsing utility methods
package cli

```

### Core Architecture Module: `go/cmd/dolt/cli/documentation_helper.go`
```
// Copyright 2020 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cli

import (
	"bytes"
	"fmt"
	"strings"
	"text/template"

	"github.com/dolthub/dolt/go/libraries/utils/argparser"
)

type commandDocumentForMarkdown struct {
	Command     string
	ShortDesc   string
	Synopsis    string
	Description string
	Options     string
}

var cmdMdDocTempl = "## `{{.Command}}`\n\n" +
	"{{.ShortDesc}}\n\n" +
	"**Synopsis**\n\n" +
	"{{.Synopsis}}\n\n" +
	"**Description**\n\n" +
	"{{.Description}}\n\n" +
	"**Arguments and options**\n\n" +
	"{{.Options}}\n\n"

func (cmdDoc CommandDocumentation) CmdDocToMd() (string, error) {
	return cmdDoc.executeTemplate(cmdMdDocTempl, false)
}

var globalCmdMdDocTempl = "## Global Arguments\n" +
	"{{.ShortDesc}}\n" +
	"{{.Synopsis}}\n\n" +
	"Specific dolt options:\n\n" +
	"{{.Options}}\n"

func (cmdDoc CommandDocumentation) GlobalCmdDocToMd() (string, error) {
	return cmdDoc.executeTemplate(globalCmdMdDocTempl, true)
}

func (cmdDoc CommandDocumentation) executeTemplate(cmdTempl string, includeValDesc bool) (string, error) {
	// Accumulate the options and args in a string
	options := ""
	if len(cmdDoc.ArgParser.Supported) > 0 || len(cmdDoc.ArgParser.ArgListHelp) > 0 {
		// Iterate across arguments and template them
		for _, kvTuple := range cmdDoc.ArgParser.ArgListHelp {
			arg, desc := kvTuple[0], kvTuple[1]
			templatedDesc, err := templateDocStringHelper(desc, MarkdownFormat)
			if err != nil {
				return "", err
			}
			argStruct := argument{arg, templatedDesc}
			outputStr, err := templateArgument(argStruct)
			if err != nil {
				return "", err
			}
			options += outputStr
		}

		// Iterate across supported options, templating each one of them
		for _, supOpt := range cmdDoc.ArgParser.Supported {
			templatedDesc, err := templateDocStringHelper(supOpt.Desc, MarkdownFormat)
			if err != nil {
				return "", err
			}
			argStruct := supported{supOpt.Abbrev, supOpt.Name, "", templatedDesc}
			if includeValDesc {
				argStruct.ValDesc = supOpt.ValDesc
			}
			outputStr, err := templateSupported(argStruct)
			if err != nil {
				return "", err
			}
			options += outputStr
		}
	} else {
		options = `No options for this command.`
	}

	cmdMdDoc, cmdMdDocErr := cmdDoc.cmdDocToCmdDocMd(options)
	if cmdMdDocErr != nil {
		return "", cmdMdDocErr
	}
	templ, templErr := template.New("shortDesc").Parse(cmdTempl)
	if templErr != nil {
		return "", templErr
	}
	var templBuffer bytes.Buffer
	if err := templ.Execute(&templBuffer, cmdMdDoc); err != nil {
		return "", err
	}
	ret := strings.Replace(templBuffer.String(), "HEAD~", "HEAD\\~", -1)
	return ret, nil
}

// A struct that represents all the data structures required to create the documentation for a command.
type CommandDocumentation struct {
	// The command/sub-command string passed to a command by the caller
	CommandStr string
	// The short description of the command
	ShortDesc string
	// The long description of the command
	LongDesc string
	// The synopsis, an array of strings showing how to use the command
	Synopsis []string
	// A structure that
	ArgParser *argparser.ArgParser
}

func (cmdDoc CommandDocumentation) cmdDocToCmdDocMd(options string) (commandDocumentForMarkdown, error) {
	longDesc, longDescErr := cmdDoc.GetLongDesc(MarkdownFormat)
	if longDescErr != nil {
		return commandDocumentForMarkdown{}, longDescErr
	}
	synopsis, synopsisErr := cmdDoc.GetSynopsis(SynopsisMarkdownFormat)
	if synopsisErr != nil {
		return commandDocumentForMarkdown{}, synopsisErr
	}

	return commandDocumentForMarkdown{
		Command:     cmdDoc.CommandStr,
		ShortDesc:   cmdDoc.GetShortDesc(),
		Synopsis:    transformSynopsisToMarkdown(cmdDoc.CommandStr, synopsis),
		Description: longDesc,
		Options:     options,
	}, nil
}

// NewCommandDocumentation returns a |CommandDocumentation| for the content and arg parser given.
// Does not include a command string, which must be filled in separately.
func NewCommandDocumentation(cmdDoc CommandDocumentationContent, argParser *argparser.ArgParser) *CommandDocumentation {
	return &CommandDocumentation{
		ShortDesc: cmdDoc.ShortDesc,
		LongDesc:  cmdDoc.LongDesc,
		Synopsis:  cmdDoc.Synopsis,
		ArgParser: argParser,
	}
}

// CommandDocsForCommandString returns a |CommandDocumentation| for the command string, doc contents, and arg
// parser given.
func CommandDocsForCommandString(command string, cmdDoc CommandDocumentationContent, argParser *argparser.ArgParser) *CommandDocumentation {
	return &CommandDocumentation{
		CommandStr: command,
		ShortDesc:  cmdDoc.ShortDesc,
		LongDesc:   cmdDoc.LongDesc,
		Synopsis:   cmdDoc.Synopsis,
		ArgParser:  argParser,
	}
}

// Returns the ShortDesc field of the receiver CommandDocumentation with the passed DocFormat injected into the template
func (cmdDoc CommandDocumentation) GetShortDesc() string {
	return cmdDoc.ShortDesc
}

// Returns the LongDesc field of the receiver CommandDocumentation with the passed DocFormat injected into the template
func (cmdDoc CommandDocumentation) GetLongDesc(format docFormat) (string, error) {
	return templateDocStringHelper(cmdDoc.LongDesc, format)
}

func templateDocStringHelper(docString string, docFormat docFormat) (string, error) {
	templ, err := template.New("description").Parse(docString)
	if err != nil {
		return "", err
	}
	var templBuffer bytes.Buffer
	if err := templ.Execute(&templBuffer, docFormat); err != nil {
		return "", err
	}
	return templBuffer.String(), nil
}

// Returns the synopsis iterating over each element and injecting the supplied DocFormat
func (cmdDoc CommandDocumentation) GetSynopsis(format docFormat) ([]string, error) {
	lines := cmdDoc.Synopsis
	for i, line := range lines {
		formatted, err := templateDocStringHelper(line, format)
		if err != nil {
			return []string{}, err
		}
		lines[i] = formatted
	}

	return lines, nil
}

type docFormat struct {
	LessThan      string
	GreaterThan   string
	EmphasisLeft  string
	EmphasisRight string
}

// mdx format
var MarkdownFormat = docFormat{"`<", ">`", "`", "`"}

// Shell help output format
var CliFormat = docFormat{"<", ">", "<b>", "</b>"}

// Synopsis is an mdx format, but already inside a code block
var SynopsisMarkdownFormat = docFormat{"<", ">", "`", "`"}

// Format that deletes all template options
var EmptyFormat = docFormat{"", "", "", ""}

func transformSynopsisToMarkdown(commandStr string, synopsis []string) string {
	if len(synopsis) == 0 {
		return ""
	}
	synopsisStr := fmt.Sprintf("%s %s\n", commandStr, synopsis[0])
	if len(synopsis) > 1 {
		temp := make([]string, len(synopsis)-1)
		for i, el := range synopsis[1:] {
			temp[i] = fmt.Sprintf("%s %s\n", commandStr, el)
		}
		synopsisStr += strings.Join(temp, "")
	}

	markdown := "```bash\n%s```"
	return fmt.Sprintf(markdown, synopsisStr)
}

type argument struct {
	Name        string
	Description string
}

func templateArgument(supportedArg argument) (string, error) {
	var formatString string
	if supportedArg.Description == "" {
		formatString = "`<{{.Name}}>`\n\n"
	} else {
		formatString = "`<{{.Name}}>`: {{.Description}}\n\n"
	}

	templ, err := template.New("argString").Parse(formatString)
	if err != nil {
		return "", err
	}
	var templBuffer bytes.Buffer
	if err := templ.Execute(&templBuffer, supportedArg); err != nil {
		return "", err
	}
	ret := templBuffer.String()
	return ret, nil
}

type supported struct {
	Abbreviation string
	Name         string
	ValDesc      string
	Description  string
}

func templateSupported(supported support
```

### Core Architecture Module: `go/cmd/dolt/cli/flags.go`
```
// Copyright 2023 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cli

// Constants for command line flags names. These tend to be used in multiple places, so defining
// them low in the package dependency tree makes sense.
const (
	AbortParam             = "abort"
	AllFlag                = "all"
	AllowEmptyFlag         = "allow-empty"
	AmendFlag              = "amend"
	AuthorParam            = "author"
	ArchiveLevelParam      = "archive-level"
	BranchParam            = "branch"
	CachedFlag             = "cached"
	CheckoutCreateBranch   = "b"
	CreateResetBranch      = "B"
	CommitFlag             = "commit"
	ContinueFlag           = "continue"
	CopyFlag               = "copy"
	DateParam              = "date"
	DecorateFlag           = "decorate"
	DeleteFlag             = "delete"
	DeleteForceFlag        = "D"
	DepthFlag              = "depth"
	DryRunFlag             = "dry-run"
	EmptyParam             = "empty"
	ExcludeIgnoreRulesFlag = "x"
	FirstParam             = "first"
	ForceFlag              = "force"
	FullFlag               = "full"
	GraphFlag              = "graph"
	HardResetParam         = "hard"
	HostFlag               = "host"
	IncludeUntrackedFlag   = "include-untracked"
	IncrementalGCFileSize  = "incremental-file-size"
	InteractiveFlag        = "interactive"
	JobFlag                = "job"
	ListFlag               = "list"
	MergesFlag             = "merges"
	MessageArg             = "message"
	MinParentsFlag         = "min-parents"
	MoveFlag               = "move"
	NoCommitFlag           = "no-commit"
	NoEditFlag             = "no-edit"
	NoFFParam              = "no-ff"
	NoOverwriteIgnoreFlag  = "no-overwrite-ignore"
	FFOnlyParam            = "ff-only"
	NoPrettyFlag           = "no-pretty"
	NoTLSFlag              = "no-tls"
	NoJsonMergeFlag        = "dont-merge-json"
	NotFlag                = "not"
	NumberFlag             = "number"
	OneLineFlag            = "oneline"
	OursFlag               = "ours"
	OutputOnlyFlag         = "output-only"
	OverwriteIgnoreFlag    = "overwrite-ignore"
	ParentsFlag            = "parents"
	PatchFlag              = "patch"
	PasswordFlag           = "password"
	PortFlag               = "port"
	PruneFlag              = "prune"
	PruneWithGracePeriod   = "prune-with-grace-period"
	QuietFlag              = "quiet"
	RebaseParam            = "rebase"
	RemoteParam            = "remote"
	SetUpstreamFlag        = "set-upstream"
	SetUpstreamToFlag      = "set-upstream-to"
	ShallowFlag            = "shallow"
	ShowIgnoredFlag        = "ignored"
	ShowSignatureFlag      = "show-signature"
	SignFlag               = "gpg-sign"
	SilentFlag             = "silent"
	SingleBranchFlag       = "single-branch"
	SkipEmptyFlag          = "skip-empty"
	SkipVerificationFlag   = "skip-verification"
	SoftResetParam         = "soft"
	SquashParam            = "squash"
	StagedFlag             = "staged"
	StatFlag               = "stat"
	SystemFlag             = "system"
	TablesFlag             = "tables"
	TheirsFlag             = "theirs"
	TrackFlag              = "track"
	UpperCaseAllFlag       = "ALL"
	UserFlag               = "user"
)

// Flags used by `dolt diff` command and `dolt_diff()` table function.
const (
	SkinnyFlag   = "skinny"
	IncludeCols  = "include-cols"
	DataFlag     = "data"
	SchemaFlag   = "schema"
	NameOnlyFlag = "name-only"
	SummaryFlag  = "summary"
	WhereParam   = "where"
	LimitParam   = "limit"
	FilterParam  = "filter"
	MergeBase    = "merge-base"
	DiffMode     = "diff-mode"
	ReverseFlag  = "reverse"
	FormatFlag   = "result-format"
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11942** (2026-09-28): **Dolt panics on a `NULL` DECIMAL in a `VALUES`-derived table**
  *Symptoms*: # Dolt panics on a `NULL` DECIMAL in a `VALUES`-derived table  ## What happened  A typed `NULL` in a DECIMAL column of a `VALUES`-derived table terminates the Dolt CLI.  ## Environment  Dolt `main` commit `4a2e8ce2f155f621cd904944c200ad356c758519`, `dolt version 2.3.5`, go-mysql-server `13a83f1e6133`; MySQL Server 9.6.0 for reference.  ## How to reproduce  Run this SQL in a fresh Dolt repository.  ```sql SELECT * FROM (VALUES ROW(CAST(NULL AS DECIMAL(20,6)))) AS t(x); ```  ## Expected result  A fresh MySQL 9.6.0 server accepts the same statement and returns one typed DECIMAL `NULL`:  ```text x NULL ```  ## Actual result  Dolt produces no rows and exits with the following panic:  ```text panic: interface conversion: interface {} is nil, not *apd.Decimal github.com/dolthub/go-mysql-server/sql/rowexec.(*BaseBuilder).buildValueDerivedTable ```  ## Controls  - `SELECT CAST(NULL AS DECIMAL(20,6))` succeeds and returns `NULL`. - The same `VALUES ROW`-derived table with `CAST(1 AS DECIMAL(20,6))` succeeds and returns `1.000000`. - Adding `ROW_NUMBER() OVER ()` does not change the panic. 

- **Issue #11941** (2026-09-25): **Dolt panics when CTAS materializes an untyped `NULL`**
  *Symptoms*: ## What happened  Dolt terminates with a panic when `CREATE TABLE ... AS SELECT` materializes `FIRST_VALUE(NULL)`. The same window expression succeeds in a direct `SELECT` and returns `NULL`.  ## Environment  Dolt `main` commit `4a2e8ce2f155f621cd904944c200ad356c758519`, `dolt version 2.3.5`; MySQL Server 9.6.0 for reference.   ## How to reproduce  Run this SQL in a fresh Dolt repository.  ```sql CREATE TABLE t(id INT PRIMARY KEY, g INT); INSERT INTO t VALUES (1,1),(2,2);  CREATE TABLE out_t AS SELECT id,        FIRST_VALUE(NULL) OVER (          PARTITION BY g          RANGE BETWEEN CURRENT ROW AND CURRENT ROW        ) AS wf FROM t; ```  ## Expected result  MySQL 9.6.0 creates `out_t`, with `wf` as nullable `varbinary(0)`, and returns:  ```text id  wf 1   NULL 2   NULL ```  A direct `SELECT` of the same window expression also returns these two rows on Dolt.  ## Actual result  Dolt creates no `out_t` table and exits with:  ```text panic: unknown type info does not have a relevant SQL type github.com/dolthub/dolt/go/libraries/doltcore/schema/typeinfo.(*unknownType).ToSqlType ```  ## Reduced control  The window function is not required to reach the same panic:  ```sql CREATE TABLE out_null AS SELECT NULL AS wf; ```

- **Issue #11918** (2026-09-24): **Server panic in decimal conversion on aggregate query with WHERE ROUND(HEX(int_col))**
  *Symptoms*:  ## Environment  - dolt sql-server: `dolthub/dolt-sql-server:2.3.5` (docker) - go-mysql-server: pseudo-version `v0.20.1-0.20260915233322-a939809e084d` (dolthub/go-mysql-server commit [`a939809e084d`](https://github.com/dolthub/go-mysql-server/commit/a939809e084d), 2026-09-15)  ## Repro case  Single statement, no tables needed, 100% reproducible:  ```sql SELECT COUNT( * ) FROM (SELECT 25 AS age UNION ALL SELECT 30) t WHERE ROUND( HEX( age ) ); ```  ## Result  The query handler panics; the server returns error 1105 whose message contains the panic and goroutine dump, and the connection survives:  ``` panic recovered: runtime error: invalid memory address or nil pointer dereference   sql/types/decimal.go:272 (DecimalType_.ConvertToDecimal)   sql/types/decimal.go:257 (DecimalType_.ConvertToDecimal, recursive call)   sql/types/decimal.go:181 (DecimalType_.Convert)   sql/types/conversion.go  (TypeAwareConversion)   sql/expression/function/ceil_round_floor.go:282 (Round.Eval)   sql/plan/filter.go (FilterIter.Next) -> sql/rowexec/agg.go:79 (groupByIter.Next) ``` 
  **Post-Mortem & Fix Analysis**:
  > Hi @awusan125, thanks for the report will have a fix done for this today!
  > Fix is up in dolthub/go-mysql-server#3920.

- **Issue #11917** (2026-09-25): **Server panic kills the connection on SELECT UNIX_TIMESTAMP(IFNULL(SIN(WEEKDAY(UUID())), (SELECT 1)))**
  *Symptoms*:   dolt sql-server 2.3.5, single statement, no tables needed, 100% reproducible (3/3 just re-verified):  ```sql SELECT UNIX_TIMESTAMP( IFNULL( SIN( WEEKDAY( UUID() ) ), ( SELECT 1 ) ) ); ```  ## Result  The query handler panics and the current connection is dropped (client gets error 2013 "Lost connection to MySQL server during query"). The server process itself survives and keeps accepting new connections (container Up 22h, RestartCount=0, new connections healthy after every drop).  Server log:  ``` mysql_server caught panic: runtime error: invalid memory address or nil pointer dereference   doltcore/sqle/database.go:1801   doltcore/sqle/tables.go:386 ``` go-mysql-server: pseudo-version v0.20.1-0.20260915233322-a939809e084d (dolthub/go-mysql-server commit a939809e084d, 2026-09-15) 
  **Post-Mortem & Fix Analysis**:
  > Hi @awusan125, thank you for the report, we have a fix for this in the work and it'll be up today!
  > Fix is up in dolthub/go-mysql-server#3921 

- **Issue #11912** (2026-09-23): **`ANY_VALUE` nested inside another aggregate fails: misleading `table not found: <alias>` (1146) and internal `unable to find field with index N in row of M columns. This is a bug.` (1105)**
  *Symptoms*:  Hi! While running a generated SQL corpus against Dolt, we noticed that whenever `ANY_VALUE` appears inside another aggregate's expression, the query fails — while the same queries without `ANY_VALUE`, or with a single `ANY_VALUE`, work fine. Filing here as requested by the internal error message itself. All queries below were actually executed.  ### Environment - Dolt `2.3.5` (docker image `dolthub/dolt-sql-server:2.3.5`) - sql_mode-independent: reproduces with `ONLY_FULL_GROUP_BY` disabled - Reproduced via the `dolt sql` CLI  ### Setup  ```sql CREATE TABLE t1 (id INT PRIMARY KEY, active BOOL, is_active BOOL, status INT, year YEAR); INSERT INTO t1 VALUES (1, TRUE, TRUE, 10, 2023),(2, FALSE, FALSE, 20, 2022),(3, TRUE, TRUE, 30, 2023); ```  ### Repro 1 — `ANY_VALUE` as a direct child of an aggregate  ```sql SELECT MAX(ANY_VALUE(tom1.is_active)) AS v FROM t1 AS tom1; ```  Actual result: ``` Error 1146 (HY000): table not found: tom1 ``` The alias `tom1` is the one used by the query — no table is missing.  ### Repro 2 — `ANY_VALUE` nested deeper inside the aggregate's expression  ```sql SELECT MAX((ANY_VALUE(tom1.is_active)) NOT LIKE ('_')) AS v FROM t1 AS tom1; ```  Actual result: ``` Error 1105 (HY000): unable to find field with index 6 in row of 1 columns.  This is a bug. Please file an issue here: https://github.com/dolthub/dolt/issues ```  The index number varies with the shape of the query — our real generated query (a two-branch EXCEPT with `ANY_VALUE` nested inside `LEAST
  **Post-Mortem & Fix Analysis**:
  > Hi @awusan125, a fix is up for this in dolthub/go-mysql-server#3908.
  > Thanks for the quick confirmation and for putting together a fix — really appreciate it!  > Hi [@awusan125](https://github.com/awusan125), a fix is up for this in [dolthub/go-mysql-server#3908](https://github.com/dolthub/go-mysql-server/pull/3908).  

- **Issue #11886** (2026-09-18): **Lookup join drops an AND conjunct when the ON clause also has an OR over indexed columns (wrong results)**
  *Symptoms*: A lookup join returns rows that fail its `ON` condition. If the condition is `<indexed col> = <const> AND (<indexed col> = r.x OR <col> = r.y)`, the planner builds a `Concat` of two index lookups: one for the constant conjunct, one for the first OR branch. The residual filter keeps only the OR, so the constant conjunct is never applied.  ### Reproduction  ```sql create table deps (id int primary key, type varchar(16), col_a varchar(32), col_b varchar(32), key k_type (type), key k_a (col_a)); insert into deps values (1, 'keep', 'X', null), (2, 'drop', 'X', null); create table r (id varchar(32) primary key); insert into r values ('X');  select d.id, d.type from r join deps d on d.type = 'keep' and (d.col_a = r.id or d.col_b = r.id) order by d.id; ```  **Expected:** one row, `1, keep`.  **Actual:**  ``` id,type 1,keep 2,drop ```  Row 2 has `type = 'drop'`, so it fails `d.type = 'keep'`.  ### Plan  `explain plan` output for the query above; the `columns:` lines under the two index accesses are omitted.  ``` Project  ├─ columns: [d.id]  └─ LookupJoin      ├─ ((d.col_a = r.id) OR (d.col_b = r.id))      ├─ Table      │   ├─ name: r      │   └─ columns: [id]      └─ TableAlias(d)          └─ Concat              ├─ TableAlias(d)              │   └─ IndexedTableAccess(deps)              │       ├─ index: [deps.type]              │       └─ keys: 'keep'              └─ TableAlias(d)                  └─ IndexedTableAccess(deps)                      ├─ index: [deps.col_a]                 
  **Post-Mortem & Fix Analysis**:
  > Hi @brett, fix is up in dolthub/go-mysql-server#3899. After review and merge, this issue will be closed.

- **Issue #11776** (2026-09-11): **SET PERSIST sql_mode does not survive a sql-server restart ("value N was not found in the set")**
  *Symptoms*: Thanks for all the SQL_MODE work in 2.3.3. We tried to use `SET PERSIST sql_mode` to keep our previous mode across the upgrade and found that a persisted `sql_mode` does not survive a `dolt sql-server` restart. After the restart, reading `@@sql_mode` fails, and even when it can be read, the persisted mode is not in effect.  ### Repro (dolt 2.3.3, Linux x86_64, fresh `HOME` and data dir)  ```sh mkdir -p data/db1 && (cd data/db1 && dolt init --name t --email t@t) dolt sql-server --host 127.0.0.1 --port 3307 --data-dir data ```  ```sql SELECT @@GLOBAL.sql_mode; -- ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION SET PERSIST sql_mode = 'NO_ENGINE_SUBSTITUTION,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES'; SELECT @@GLOBAL.sql_mode; -- ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION        (correct) ```  `$HOME/.dolt/config_global.json` now holds a number instead of the mode string:  ``` "sqlserver.global.sql_mode":"1075839008" ```  (1075839008 = 32 + 2097152 + 1073741824, which looks like MySQL's internal bitmask for those three modes.) Stop the server and start it again:  ``` mysql> SELECT @@GLOBAL.sql_mode; ERROR 1105 (HY000): value 1075839008 was not found in the set mysql> SELECT @@SESSION.sql_mode; ERROR 1105 (HY000): value 1075839008 was not found in the set mysql> SHOW VARIABLES LIKE 'sql_mode'; sql_mode    1075839008 ```  The server log shows the same message as a warning (`error running query ...
  **Post-Mortem & Fix Analysis**:
  > Hi @quad341, have a fix going for this at #11788.

- **Issue #11774** (2026-09-16): **bug/compatibility-mysql: "information_schema.columns.EXTRA" omits "on update CURRENT_TIMESTAMP"**
  *Symptoms*: # `information_schema.columns.EXTRA` omits `on update CURRENT_TIMESTAMP`  ## Summary  I have a `TIMESTAMP ... ON UPDATE CURRENT_TIMESTAMP` column. Dolt stores the clause and applies it correctly at runtime, and `SHOW CREATE TABLE` reports it. But `information_schema.columns.EXTRA` returns only `DEFAULT_GENERATED`, where MySQL returns `DEFAULT_GENERATED on update CURRENT_TIMESTAMP`.  Tools (like Drizzle ORM) that introspect schemas through `information_schema` therefore can't see the clause.  ## Reproduction  ```sql CREATE TABLE t (   id INT PRIMARY KEY,   n INT,   touched TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP ); INSERT INTO t (id, n) VALUES (1, 1);  SELECT extra FROM information_schema.columns WHERE table_name = 't' AND column_name = 'touched'; ```  Actual (Dolt 2.3.3):  ``` EXTRA DEFAULT_GENERATED ```  Expected (MySQL 8.4.8, same statements):  ``` EXTRA DEFAULT_GENERATED on update CURRENT_TIMESTAMP ```  ## Dolt knows about the clause internally  `SHOW CREATE TABLE t` is correct:  ``` `touched` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, ```  And the runtime behaviour is correct — the column updates on write:  ```sql SELECT touched FROM t;            -- 2026-09-10 13:24:36 -- wait 2s UPDATE t SET n = 2 WHERE id = 1; SELECT touched FROM t;            -- 2026-09-10 13:24:38   (updated, as expected) ```  So this is only the `information_schema` projection, not storage or execution.  ## Why it matters  I hit this with `drizzle-kit pu
  **Post-Mortem & Fix Analysis**:
  > Hi @drago1520, we've verified your regression and working actively on getting it resolved by today.
  > @drago1520 , thank you for using Dolt and filing an issue. We'd love to hear about your use case. Feel free to [email me](mailto:brianf@dolthub.com) or swing by our [Discord](https://discord.gg/gqr7K4VNKe) if you'd like to share. 
  > > [@drago1520](https://github.com/drago1520) , thank you for using Dolt and filing an issue. We'd love to hear about your use case. Feel free to [email me](mailto:brianf@dolthub.com) or swing by our [Discord](https://discord.gg/gqr7K4VNKe) if you'd like to share.  I did. Thank you for the dedication.

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

### Incident Patch 1: `4b3eb1f8` (2026-09-30)
**Commit Message**: Merge pull request #11956 from dolthub/zachmu/insert-security

Fix upsert authorization and add protocol regression coverage

**File**: `go/go.mod` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ require (
 	github.com/dolthub/eventsapi_schema v0.0.0-20260715220557-d9b4a1c6b4d4
 	github.com/dolthub/file-locks v0.1.1
 	github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2
-	github.com/dolthub/go-mysql-server v0.20.1-0.20260929213643-0c0ebff14743
+	github.com/dolthub/go-mysql-server v0.20.1-0.20260929233927-f35678aaf3b7
 	github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63
 	github.com/edsrzf/mmap-go v1.2.0
 	github.com/esote/minmaxheap v1.0.0
```

**File**: `go/go.sum` (modified, +2/-2)
```diff
@@ -215,8 +215,8 @@ github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2 h1:u3PMzfF8RkKd3lB9pZ2bfn0qEG+1G
 github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2/go.mod h1:mIEZOHnFx4ZMQeawhw9rhsj+0zwQj7adVsnBX7t+eKY=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83 h1:FEMjCGEroDnY/BXyAffVZxUpXhP2GpoUJyyq5KaLn8c=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83/go.mod h1:F3cnm+vMRK1HaU6+rNqQrOCyR03HHhR1GWG2gnPOqaE=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929213643-0c0ebff14743 h1:4iyHwLCKpommapKwAEhr59r/JeoC6TBIGxNI8c9rr78=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929213643-0c0ebff14743/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929233927-f35678aaf3b7 h1:GPrHwFCInKGJ8VL/yylVpbxDF7E1m8QgXJESuIseXqE=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929233927-f35678aaf3b7/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63 h1:OAsXLAPL4du6tfbBgK0xXHZkOlos63RdKYS3Sgw/dfI=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63/go.mod h1:lV7lUeuDhH5thVGDCKXbatwKy2KW80L4rMT46n+Y2/Q=
 github.com/dolthub/ishell v0.0.0-20260414231531-5f031e3e9037 h1:oIW9HwuWrhxv+4HZxA+QQSKHLqWFyXZ2FmNjUYwkdiM=
```

**File**: `integration-tests/mysql-client-tests/Dockerfile` (modified, +1/-0)
```diff
@@ -76,6 +76,7 @@ RUN pip install --no-cache-dir mysql-connector-python==8.0.33 PyMySQL==1.0.2 sql
 COPY dolt/integration-tests/mysql-client-tests/python/ /build/python/
 WORKDIR /build/python/
 RUN pyinstaller --onefile pymysql-test.py
+RUN pyinstaller --onefile insert-security-test.py
 RUN pyinstaller --onefile --collect-all mysql.connector sqlalchemy-test.py
 RUN pyinstaller --onefile --collect-all mysql.connector mysql-connector-test.py
 RUN pyinstaller --onefile mariadb-connector-test.py
```

**File**: `integration-tests/mysql-client-tests/mysql-client-tests.bats` (modified, +4/-0)
```diff
@@ -89,6 +89,10 @@ assert_mariadb_version_auth_and_db_selection() {
     /build/bin/python/pymysql-test $USER $PORT $REPO_NAME
 }
 
+@test "python upsert privileges" {
+    /build/bin/python/insert-security-test $USER $PORT $REPO_NAME
+}
+
 @test "python sqlachemy client" {
     /build/bin/python/sqlalchemy-test $USER $PORT $REPO_NAME
 }
```

**File**: `integration-tests/mysql-client-tests/python/insert-security-test.py` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+"""Upsert privilege regressions, runnable against Dolt or MySQL.
+
+Usage: python insert-security-test.py ROOT_USER PORT DATABASE
+The database must already exist. The test creates and removes its own tables/users.
+"""
+
+import sys
+
+import pymysql
+
+
+def connect(user, port, database, password=""):
+    return pymysql.connect(host="127.0.0.1", port=port, user=user,
+                           password=password, database=database, autocommit=True)
+
+
+def denied(cursor, query, code, message):
+    try:
+        cursor.execute(query)
+    except pymysql.MySQLError as error:
+        assert error.args[0] == code, (query, error)
+        assert message in error.args[1], (query, error)
+    else:
+        raise AssertionError("Unexpectedly accepted: " + query)
+
+
+def rows(cursor, query, expected):
+    cursor.execute(query)
+    actual = cursor.fetchall()
+    assert actual == expected, (query, expected, actual)
+
+
+def main():
+    user, port, database = sys.argv[1], int(sys.argv[2]), sys.argv[3]
+    db_identifier = "`" + database.replace("`", "``") + "`"
+    with connect(user, port, database) as root, root.cursor() as admin:
+        try:
+            admin.execute("CREATE TABLE insert_security_h (id INT PRIMARY KEY, body VARCHAR(32), writer VARCHAR(64))")
+            admin.execute("INSERT INTO insert_security_h (id, body) VALUES (1, 'original'), (2, 'original2')")
+            admin.execute("SELECT * FROM insert_security_h ORDER BY id")
+            original = admin.fetchall()
+            for name, privileges in (("insert_security_attacker", "SELECT, INSERT"),
+                                     ("insert_security_updater", "SELECT, INSERT, UPDATE")):
+                admin.execute(f"CREATE USER '{name}'@'%' IDENTIFIED BY 'test-password'")
+                admin.execute(f"GRANT {privileges} ON {db_identifier}.insert_security_h TO '{name}'@'%'")
+
+            with connect("insert_security_attacker", port, database, "test-password") as conn, conn.cursor() as cur:
+                denied(cur, "UPDATE insert_security_h SET body = 'x' WHERE id = 1", 1142, "command denied")
+                denied(cur, "REPLACE INTO insert_security_h (id, body) VALUES (1, 'x')", 1142, "command denied")
+                # Privileges are checked even if no duplicate would be found.
+                for row_id in (1, 99):
+                    denied(cur, f"INSERT INTO insert_security_h (id, body) VALUES ({row_id}, 'ignored') "
+                           "ON DUPLICATE KEY UPDATE body = 'REWRITTEN', writer = 'victim@%'", 1142, "command denied")
+                rows(cur, "SELECT * FROM insert_security_h ORDER BY id", original)
+                cur.execute("INSERT INTO insert_security_h (id, body) VALUES (3, 'allowed')")
+                rows(cur, "SELECT body FROM insert_security_h WHERE id = 3", (("allowed",),))
+
+            with connect("insert_security_updater", port, database, "test-password") as conn, conn.cursor() as cur:
+                cur.execute("INSERT INTO insert_security_h (id, body) VALUES (2, 'ignored') "
+                            "ON DUPLICATE KEY UPDATE body = 'updated'")
+                rows(cur, "SELECT body FROM insert_security_h WHERE id = 2", (("updated",),))
+                cur.execute("INSERT INTO insert_security_h (id, body) VALUES (5, 'new') "
+                            "ON DUPLICATE KEY UPDATE body = 'updated'")
+                rows(cur, "SELECT body FROM insert_security_h WHERE id = 5", (("new",),))
+
+            admin.execute("SELECT VERSION()")
+            print("Upsert privilege checks passed:", admin.fetchone()[0])
+        finally:
+            admin.execute("DROP TABLE IF EXISTS insert_security_h")
+            admin.execute("DROP USER IF EXISTS 'insert_security_attacker'@'%', 'insert_security_updater'@'%'")
+
+
+if __name__ == "__main__":
+    main()
```

---

### Incident Patch 2: `cccdaaa6` (2026-09-29)
**Commit Message**: Update GMS from main and revert README changes

**File**: `go/go.mod` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ require (
 	github.com/dolthub/dolt-mcp v0.3.4
 	github.com/dolthub/eventsapi_schema v0.0.0-20260715220557-d9b4a1c6b4d4
 	github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2
-	github.com/dolthub/go-mysql-server v0.20.1-0.20260929192110-88be445c7e14
+	github.com/dolthub/go-mysql-server v0.20.1-0.20260929233927-f35678aaf3b7
 	github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63
 	github.com/edsrzf/mmap-go v1.2.0
 	github.com/esote/minmaxheap v1.0.0
```

**File**: `go/go.sum` (modified, +2/-2)
```diff
@@ -215,8 +215,8 @@ github.com/dolthub/fslock v0.0.5 h1:QoXhBhgY1oumHE26qyE7tgmXUT8qjJwxsIzo54O/B/k=
 github.com/dolthub/fslock v0.0.5/go.mod h1:sdofYYqE0D79zNZyB4/kmlnsQOVap1C2yByjGKSirEM=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83 h1:FEMjCGEroDnY/BXyAffVZxUpXhP2GpoUJyyq5KaLn8c=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83/go.mod h1:F3cnm+vMRK1HaU6+rNqQrOCyR03HHhR1GWG2gnPOqaE=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929192110-88be445c7e14 h1:UaHMIgaOGUd1ajnpZDMRmnh2LaWi2UWARj6YSgu0yeQ=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929192110-88be445c7e14/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929233927-f35678aaf3b7 h1:GPrHwFCInKGJ8VL/yylVpbxDF7E1m8QgXJESuIseXqE=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929233927-f35678aaf3b7/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63 h1:OAsXLAPL4du6tfbBgK0xXHZkOlos63RdKYS3Sgw/dfI=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63/go.mod h1:lV7lUeuDhH5thVGDCKXbatwKy2KW80L4rMT46n+Y2/Q=
 github.com/dolthub/ishell v0.0.0-20260414231531-5f031e3e9037 h1:oIW9HwuWrhxv+4HZxA+QQSKHLqWFyXZ2FmNjUYwkdiM=
```

**File**: `integration-tests/mysql-client-tests/README.md` (modified, +0/-17)
```diff
@@ -60,20 +60,3 @@ $ docker run --rm -it --entrypoint /bin/bash mysql-client-tests:mariadb-clients
 # /usr/local/mariadb-11.8/bin/mariadb --version
 # ldd /usr/local/mariadb-11.8/bin/mariadb
 ```
-
-## Compare Upsert Security Behavior With MySQL
-
-`python/insert-security-test.py` runs the same privilege assertions over
-PyMySQL against either Dolt or MySQL. Start a server, create a dedicated test database,
-and use an administrator account with an empty password:
-
-```bash
-python3 -m venv /tmp/mysql-client-venv
-/tmp/mysql-client-venv/bin/pip install PyMySQL cryptography
-/tmp/mysql-client-venv/bin/python python/insert-security-test.py root 3306 test_db
-```
-
-The test creates and removes its own tables and restricted users. It covers
-rejected upserts without UPDATE privilege and successful inserts and upserts with
-the required privileges.
-Authorization denials must return MySQL error 1142 with a `command denied` message.
```

---

### Incident Patch 3: `50b040c1` (2026-09-29)
**Commit Message**: Keep upsert security regression focused on authorization

**File**: `go/go.mod` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ require (
 	github.com/dolthub/dolt-mcp v0.3.4
 	github.com/dolthub/eventsapi_schema v0.0.0-20260715220557-d9b4a1c6b4d4
 	github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2
-	github.com/dolthub/go-mysql-server v0.20.1-0.20260929043808-f899397f9d3b
+	github.com/dolthub/go-mysql-server v0.20.1-0.20260929192110-88be445c7e14
 	github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63
 	github.com/edsrzf/mmap-go v1.2.0
 	github.com/esote/minmaxheap v1.0.0
```

**File**: `go/go.sum` (modified, +2/-2)
```diff
@@ -215,8 +215,8 @@ github.com/dolthub/fslock v0.0.5 h1:QoXhBhgY1oumHE26qyE7tgmXUT8qjJwxsIzo54O/B/k=
 github.com/dolthub/fslock v0.0.5/go.mod h1:sdofYYqE0D79zNZyB4/kmlnsQOVap1C2yByjGKSirEM=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83 h1:FEMjCGEroDnY/BXyAffVZxUpXhP2GpoUJyyq5KaLn8c=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83/go.mod h1:F3cnm+vMRK1HaU6+rNqQrOCyR03HHhR1GWG2gnPOqaE=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929043808-f899397f9d3b h1:EEC7shNWpRcVzFlqcPJfkoOWZKQ1FeUqnfBYzgyvRs4=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929043808-f899397f9d3b/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929192110-88be445c7e14 h1:UaHMIgaOGUd1ajnpZDMRmnh2LaWi2UWARj6YSgu0yeQ=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929192110-88be445c7e14/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63 h1:OAsXLAPL4du6tfbBgK0xXHZkOlos63RdKYS3Sgw/dfI=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63/go.mod h1:lV7lUeuDhH5thVGDCKXbatwKy2KW80L4rMT46n+Y2/Q=
 github.com/dolthub/ishell v0.0.0-20260414231531-5f031e3e9037 h1:oIW9HwuWrhxv+4HZxA+QQSKHLqWFyXZ2FmNjUYwkdiM=
```

**File**: `integration-tests/mysql-client-tests/README.md` (modified, +4/-4)
```diff
@@ -63,7 +63,7 @@ $ docker run --rm -it --entrypoint /bin/bash mysql-client-tests:mariadb-clients
 
 ## Compare Upsert Security Behavior With MySQL
 
-`python/insert-security-test.py` runs the same privilege and trigger assertions over
+`python/insert-security-test.py` runs the same privilege assertions over
 PyMySQL against either Dolt or MySQL. Start a server, create a dedicated test database,
 and use an administrator account with an empty password:
 
@@ -73,7 +73,7 @@ python3 -m venv /tmp/mysql-client-venv
 /tmp/mysql-client-venv/bin/python python/insert-security-test.py root 3306 test_db
 ```
 
-The test creates and removes its own tables, triggers, and restricted users. It covers
-rejected upserts without UPDATE privilege, update-trigger rejection and statement
-rollback, successful inserts, and trigger ordering and row images for mixed upserts.
+The test creates and removes its own tables and restricted users. It covers
+rejected upserts without UPDATE privilege and successful inserts and upserts with
+the required privileges.
 Authorization denials must return MySQL error 1142 with a `command denied` message.
```

**File**: `integration-tests/mysql-client-tests/mysql-client-tests.bats` (modified, +1/-1)
```diff
@@ -89,7 +89,7 @@ assert_mariadb_version_auth_and_db_selection() {
     /build/bin/python/pymysql-test $USER $PORT $REPO_NAME
 }
 
-@test "python upsert privileges and triggers" {
+@test "python upsert privileges" {
     /build/bin/python/insert-security-test $USER $PORT $REPO_NAME
 }
 
```

**File**: `integration-tests/mysql-client-tests/python/insert-security-test.py` (modified, +7/-31)
```diff
@@ -1,4 +1,4 @@
-"""Upsert privilege and trigger regressions, runnable against Dolt or MySQL.
+"""Upsert privilege regressions, runnable against Dolt or MySQL.
 
 Usage: python insert-security-test.py ROOT_USER PORT DATABASE
 The database must already exist. The test creates and removes its own tables/users.
@@ -36,10 +36,6 @@ def main():
     with connect(user, port, database) as root, root.cursor() as admin:
         try:
             admin.execute("CREATE TABLE insert_security_h (id INT PRIMARY KEY, body VARCHAR(32), writer VARCHAR(64))")
-            admin.execute("CREATE TRIGGER insert_security_bi BEFORE INSERT ON insert_security_h "
-                          "FOR EACH ROW SET NEW.writer = USER()")
-            admin.execute("CREATE TRIGGER insert_security_bu BEFORE UPDATE ON insert_security_h "
-                          "FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'append-only'; END")
             admin.execute("INSERT INTO insert_security_h (id, body) VALUES (1, 'original'), (2, 'original2')")
             admin.execute("SELECT * FROM insert_security_h ORDER BY id")
             original = admin.fetchall()
@@ -57,40 +53,20 @@ def main():
                            "ON DUPLICATE KEY UPDATE body = 'REWRITTEN', writer = 'victim@%'", 1142, "command denied")
                 rows(cur, "SELECT * FROM insert_security_h ORDER BY id", original)
                 cur.execute("INSERT INTO insert_security_h (id, body) VALUES (3, 'allowed')")
-                rows(cur, "SELECT body, writer = USER() FROM insert_security_h WHERE id = 3", (("allowed", 1),))
+                rows(cur, "SELECT body FROM insert_security_h WHERE id = 3", (("allowed",),))
 
             with connect("insert_security_updater", port, database, "test-password") as conn, conn.cursor() as cur:
-                denied(cur, "UPDATE insert_security_h SET body = 'y' WHERE id = 2", 1644, "append-only")
-                denied(cur, "INSERT INTO insert_security_h (id, body) VALUES (2, 'ignored') "
-                       "ON DUPLICATE KEY UPDATE body = 'REWRITTEN2'", 1644, "append-only")
-                # Failure on the second row must roll back the first insert too.
-                denied(cur, "INSERT INTO insert_security_h (id, body) VALUES (4, 'new'), (2, 'ignored') "
-                       "ON DUPLICATE KEY UPDATE body = 'REWRITTEN2'", 1644, "append-only")
-                rows(cur, "SELECT * FROM insert_security_h WHERE id <= 2 ORDER BY id", original)
-                rows(cur, "SELECT id FROM insert_security_h WHERE id IN (4, 99)", ())
+                cur.execute("INSERT INTO insert_security_h (id, body) VALUES (2, 'ignored') "
+                            "ON DUPLICATE KEY UPDATE body = 'updated'")
+                rows(cur, "SELECT body FROM insert_security_h WHERE id = 2", (("updated",),))
                 cur.execute("INSERT INTO insert_security_h (id, body) VALUES (5, 'new') "
                             "ON DUPLICATE KEY UPDATE body = 'updated'")
                 rows(cur, "SELECT body FROM insert_security_h WHERE id = 5", (("new",),))
 
-            # Verify all four trigger types, row images, order, and a mixed batch.
-            admin.execute("CREATE TABLE insert_security_rows (id INT PRIMARY KEY, v INT)")
-            admin.execute("CREATE TABLE insert_security_audit (seq INT AUTO_INCREMENT PRIMARY KEY, event VARCHAR(2), old_v INT, new_v INT)")
-            admin.execute("INSERT INTO insert_security_rows VALUES (1, 10)")
-            for name, timing, event, body in (
-                ("bi", "BEFORE", "INSERT", "BEGIN SET NEW.v = NEW.v + 1; INSERT INTO insert_security_audit(event, old_v, new_v) VALUES ('bi', NULL, NEW.v); END"),
-                ("ai", "AFTER", "INSERT", "INSERT INTO insert_security_audit(event, old_v, new_v) VALUES ('ai', NULL, NEW.v)"),
-                ("bu", "BEFORE", "UPDATE", "BEGIN SET NEW.v = NEW.v + OLD.v; INSERT INTO insert_security_audit(event, old_v, new_v) VALUES ('bu', OLD.v, NEW.v); END"),
-     
```

---

### Incident Patch 4: `f210bc5f` (2026-09-29)
**Commit Message**: Fix upsert authorization and trigger bypasses with protocol regression tests

**File**: `go/go.mod` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ require (
 	github.com/dolthub/dolt-mcp v0.3.4
 	github.com/dolthub/eventsapi_schema v0.0.0-20260715220557-d9b4a1c6b4d4
 	github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2
-	github.com/dolthub/go-mysql-server v0.20.1-0.20260925205857-cd69bf0b55e9
+	github.com/dolthub/go-mysql-server v0.20.1-0.20260929040229-566852420254
 	github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63
 	github.com/edsrzf/mmap-go v1.2.0
 	github.com/esote/minmaxheap v1.0.0
```

**File**: `go/go.sum` (modified, +2/-2)
```diff
@@ -215,8 +215,8 @@ github.com/dolthub/fslock v0.0.5 h1:QoXhBhgY1oumHE26qyE7tgmXUT8qjJwxsIzo54O/B/k=
 github.com/dolthub/fslock v0.0.5/go.mod h1:sdofYYqE0D79zNZyB4/kmlnsQOVap1C2yByjGKSirEM=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83 h1:FEMjCGEroDnY/BXyAffVZxUpXhP2GpoUJyyq5KaLn8c=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83/go.mod h1:F3cnm+vMRK1HaU6+rNqQrOCyR03HHhR1GWG2gnPOqaE=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260925205857-cd69bf0b55e9 h1:pjzY1rxlJL4hnyuBdoJyeWoNVoAJaGlsUOgCfjQ5yUE=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260925205857-cd69bf0b55e9/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929040229-566852420254 h1:W4h0DpkO/372iSJG353NKPhWz1asoJuzYivACxnyDsE=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929040229-566852420254/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63 h1:OAsXLAPL4du6tfbBgK0xXHZkOlos63RdKYS3Sgw/dfI=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63/go.mod h1:lV7lUeuDhH5thVGDCKXbatwKy2KW80L4rMT46n+Y2/Q=
 github.com/dolthub/ishell v0.0.0-20260414231531-5f031e3e9037 h1:oIW9HwuWrhxv+4HZxA+QQSKHLqWFyXZ2FmNjUYwkdiM=
```

**File**: `integration-tests/mysql-client-tests/Dockerfile` (modified, +1/-0)
```diff
@@ -76,6 +76,7 @@ RUN pip install --no-cache-dir mysql-connector-python==8.0.33 PyMySQL==1.0.2 sql
 COPY dolt/integration-tests/mysql-client-tests/python/ /build/python/
 WORKDIR /build/python/
 RUN pyinstaller --onefile pymysql-test.py
+RUN pyinstaller --onefile insert-security-test.py
 RUN pyinstaller --onefile --collect-all mysql.connector sqlalchemy-test.py
 RUN pyinstaller --onefile --collect-all mysql.connector mysql-connector-test.py
 RUN pyinstaller --onefile mariadb-connector-test.py
```

**File**: `integration-tests/mysql-client-tests/README.md` (modified, +18/-0)
```diff
@@ -60,3 +60,21 @@ $ docker run --rm -it --entrypoint /bin/bash mysql-client-tests:mariadb-clients
 # /usr/local/mariadb-11.8/bin/mariadb --version
 # ldd /usr/local/mariadb-11.8/bin/mariadb
 ```
+
+## Compare Upsert Security Behavior With MySQL
+
+`python/insert-security-test.py` runs the same privilege and trigger assertions over
+PyMySQL against either Dolt or MySQL. Start a server, create a dedicated test database,
+and use an administrator account with an empty password:
+
+```bash
+python3 -m venv /tmp/mysql-client-venv
+/tmp/mysql-client-venv/bin/pip install PyMySQL cryptography
+/tmp/mysql-client-venv/bin/python python/insert-security-test.py root 3306 test_db
+```
+
+The test creates and removes its own tables, triggers, and restricted users. It covers
+rejected upserts without UPDATE privilege, update-trigger rejection and statement
+rollback, successful inserts, and trigger ordering and row images for mixed upserts.
+Dolt currently returns authorization error 1105 where MySQL returns 1142; the test
+accepts either code only with a `command denied` message.
```

**File**: `integration-tests/mysql-client-tests/mysql-client-tests.bats` (modified, +4/-0)
```diff
@@ -89,6 +89,10 @@ assert_mariadb_version_auth_and_db_selection() {
     /build/bin/python/pymysql-test $USER $PORT $REPO_NAME
 }
 
+@test "python upsert privileges and triggers" {
+    /build/bin/python/insert-security-test $USER $PORT $REPO_NAME
+}
+
 @test "python sqlachemy client" {
     /build/bin/python/sqlalchemy-test $USER $PORT $REPO_NAME
 }
```

---

### Incident Patch 5: `d0b9d642` (2026-09-17)
**Commit Message**: Revert notification test and README changes.

**File**: `.github/actions/check-deferred-ci/README.md` (modified, +4/-7)
```diff
@@ -69,12 +69,9 @@ Sources: [GitHub CLI creation and metadata calls](https://github.com/cli/cli/blo
   or tests. Deferred workflows are canceled, freeing those runners until release.
   Matrix members can each briefly allocate a runner; there is no separate
   admission job or admission check.
-- Bot comments record deferral or release only when `defer-ci-after-hours`,
-  `defer-ci-review`, or `force-draft-ci` is added or removed, or the PR
-  transitions between draft and ready. Deferral comments include conditions and
-  overrides. Pushes, polling, and reviews reconcile CI silently. Existing comments are never edited, and
-  repeated notifications for the same event, label state, and draft state are deduplicated
-  across commits.
+- A new bot comment records each deferral, including its conditions and overrides,
+  and another records release. Existing comments are never edited. Repeated
+  notifications for the same event and revision do not add duplicate comments.
   The separate `ci-deferred` label tracks postponed work until release.
   The scheduler manages this queue label; users choose the two `defer-ci-*` labels.
 - Label additions/removals and draft-ready transitions trigger reconciliation.
@@ -200,7 +197,7 @@ are not automatically retried; use their original workflow controls.
   decisions, time, run state, and attempt. It does not release obsolete commits.
 - A per-PR concurrency group serializes event and timer reconciliation. Polling
   recovers invocations replaced in GitHub's single pending concurrency slot.
-- Event comments contain only hidden label/draft state and an event identifier for
+- Event comments contain only a hidden revision and event identifier for
   deduplication. No workflow results are cached in comments. Successful test
   completions do not trigger reconciliation; unsuccessful attempts are inspected
   only to identify deferrals or admission errors. The scheduler never reports
```

**File**: `.github/actions/check-deferred-ci/index.test.js` (modified, +4/-55)
```diff
@@ -62,7 +62,7 @@ function fixture(options = {}) {
     },
   }, paginate: async (endpoint, args) => (await endpoint(args)).data };
   return { state, github, calls: name => state.calls.filter(c => c[0] === name),
-    reconcile: (now, eventContext = context) => reconcile({ github, context: eventContext, pullNumber: 12, now: now || day }) };
+    reconcile: now => reconcile({ github, context, pullNumber: 12, now: now || day }) };
 }
 
 test('admission composes draft, after-hours and review conditions using live PR state', async () => {
@@ -100,20 +100,14 @@ test('new and renamed workflows are discovered from the PR; unrelated runs are i
   assert.equal(f.state.statuses[0].state, 'success');
 });
 
-test('relevant label changes append deferral and release comments once across commits', async () => {
+test('deferral and release append brief events once, without completion monitoring', async () => {
   const f = fixture();
-  const labeled = { ...context, eventName: 'pull_request_target',
-    payload: { action: 'labeled', label: { name: AFTER_HOURS_LABEL } } };
-  await f.reconcile(day, labeled);
-  f.state.pr.head.sha = f.state.runs[0].head_sha = 'new-head';
-  await f.reconcile(day, labeled);
+  await f.reconcile(); await f.reconcile();
   const original = f.state.comments[0].body;
   assert.match(original, /9pm–5am/);
   assert.match(original, /remove `defer-ci-after-hours`/);
   assert.equal(f.state.statuses[0].state, 'pending');
-  f.state.pr.labels = [{ name: LABEL }];
-  const unlabeled = { ...labeled, payload: { ...labeled.payload, action: 'unlabeled' } };
-  await f.reconcile(day, unlabeled); await f.reconcile(day, unlabeled);
+  await f.reconcile(night); await f.reconcile(night);
   assert.equal(f.calls('runs.rerun').length, 1);
   assert.equal(f.state.statuses[0].state, 'success');
   assert.equal(f.state.runs[0].status, 'queued');
@@ -165,48 +159,3 @@ test('review notifications and polling wake reconciliation; successful CI does n
   assert.deepEqual(await candidates({ github: f.github, context: { ...context, eventName: 'schedule' }, now: night }), [12]);
   assert.deepEqual(await candidates({ github: f.github, context: { ...context, eventName: 'schedule' }, now: day }), []);
 });
-
-test('pushes and other events without label or draft changes reconcile without reading or adding comments', async () => {
-  const contexts = [
-    ...['opened', 'synchronize', 'reopened'].map(action =>
-      ({ ...context, eventName: 'pull_request_target', payload: { action } })),
-    ...[LABEL, 'unrelated'].map(name => ({ ...context, eventName: 'pull_request_target',
-      payload: { action: 'labeled', label: { name } } })),
-    ...['schedule', 'workflow_dispatch', 'workflow_run'].map(eventName => ({ ...context, eventName })),
-  ];
-  for (const eventContext of contexts) {
-    const f = fixture({ pr: { ...structuredClone(pr), draft: true } });
-    await f.reconcile(day, eventContext);
-    f.state.pr.head.sha = f.state.runs[0].head_sha = 'new-head';
-    await f.reconcile(day, eventContext);
-    assert.equal(f.state.statuses[0].state, 'pending');
-    f.state.pr.draft = false;
-    await f.reconcile(night, eventContext);
-    assert.equal(f.calls('runs.rerun').length, 1);
-    assert.equal(f.calls('comments.list').length, 0);
-    assert.equal(f.state.comments.length, 0);
-  }
-  for (const name of [REVIEW_LABEL, FORCE_DRAFT_LABEL]) {
-    const f = fixture({ pr: { ...structuredClone(pr), draft: true, labels: [{ name: REVIEW_LABEL }] } });
-    await f.reconcile(day, { ...context, eventName: 'pull_request_target',
-      payload: { action: 'labeled', label: { name } } });
-    assert.equal(f.state.comments.length, 1);
-  }
-});
-
-test('draft-ready transitions comment while commits on a draft remain silent', async () => {
-  const f = fixture({ pr: { ...structuredClone(pr), draft: true, labels: [] } });
-  const event = action => ({ ...context, eventName: 'pull_request_target', payload: { action } });
-  await f.reconcile(day,
```

---

### Incident Patch 6: `f8746168` (2026-09-17)
**Commit Message**: go/store/nbs: Fix inverted nil check in GenerationalNBS.PersistGhostHashes.

It called through to ghostGen exactly when ghostGen was nil, and returned the "ghostGen is nil" error otherwise.

**File**: `go/store/nbs/generational_chunk_store.go` (modified, +2/-2)
```diff
@@ -48,9 +48,9 @@ var ErrGhostChunkRequested = errors.New("requested chunk which is expected to be
 
 func (gcs *GenerationalNBS) PersistGhostHashes(ctx context.Context, refs hash.HashSet) error {
 	if gcs.ghostGen == nil {
-		return gcs.ghostGen.PersistGhostHashes(ctx, refs)
+		return fmt.Errorf("runtime error. ghostGen is nil but an attempt to persist ghost hashes was made")
 	}
-	return fmt.Errorf("runtime error. ghostGen is nil but an attempt to persist ghost hashes was made")
+	return gcs.ghostGen.PersistGhostHashes(ctx, refs)
 }
 
 func (gcs *GenerationalNBS) GhostGen() chunks.GhostChunkStore {
```

---

### Incident Patch 7: `c5dab4af` (2026-09-17)
**Commit Message**: go/store/nbs: Fix generation ordering on reads to avoid missing a chunk which is being moved from new to old gen.

When GC moves chunks from new to old gen, it publishes them into old
gen and then, eventually, drops them from new gen. If the Reads check
old gen first, and then fall back to new gen, they can miss a chunk
which is actually retained --- the entire GC can run in between the
return from the old gen Read and before the new gen Read.

Reading new gen first is the fix. If the chunk isn't in new gen and it
does exist, it has guaranteed already been published to old gen by the
time we ask for it.

**File**: `go/store/nbs/generational_chunk_store.go` (modified, +23/-12)
```diff
@@ -86,15 +86,21 @@ func (gcs *GenerationalNBS) OldGen() chunks.ChunkStoreGarbageCollector {
 }
 
 // Get the Chunk for the value of the hash in the store. If the hash is absent from the store EmptyChunk is returned.
+//
+// We read new gen and then old gen. A GC publishes promoted chunks
+// into the old gen before it drops them from the new gen. Reading new
+// gen first guarantees that if we miss the chunk in new gen, it has
+// definitely already been published to old gen by the time we check
+// it.
 func (gcs *GenerationalNBS) Get(ctx context.Context, h hash.Hash) (chunks.Chunk, error) {
-	c, err := gcs.oldGen.Get(ctx, h)
+	c, err := gcs.newGen.Get(ctx, h)
 
 	if err != nil {
 		return chunks.EmptyChunk, err
 	}
 
 	if c.IsEmpty() {
-		c, err = gcs.newGen.Get(ctx, h)
+		c, err = gcs.oldGen.Get(ctx, h)
 	}
 	if err != nil {
 		return chunks.EmptyChunk, err
@@ -112,10 +118,12 @@ func (gcs *GenerationalNBS) Get(ctx context.Context, h hash.Hash) (chunks.Chunk,
 
 // GetMany gets the Chunks with |hashes| from the store. On return, |foundChunks| will have been fully sent all chunks
 // which have been found. Any non-present chunks will silently be ignored.
+//
+// The generations are read new-then-old; see |Get| for why the order matters.
 func (gcs *GenerationalNBS) GetMany(ctx context.Context, hashes hash.HashSet, found func(context.Context, *chunks.Chunk)) error {
 	mu := &sync.Mutex{}
 	notFound := hashes.Copy()
-	err := gcs.oldGen.GetMany(ctx, hashes, func(ctx context.Context, chunk *chunks.Chunk) {
+	err := gcs.newGen.GetMany(ctx, hashes, func(ctx context.Context, chunk *chunks.Chunk) {
 		func() {
 			mu.Lock()
 			defer mu.Unlock()
@@ -133,7 +141,7 @@ func (gcs *GenerationalNBS) GetMany(ctx context.Context, hashes hash.HashSet, fo
 
 	hashes = notFound
 	notFound = hashes.Copy()
-	err = gcs.newGen.GetMany(ctx, hashes, func(ctx context.Context, chunk *chunks.Chunk) {
+	err = gcs.oldGen.GetMany(ctx, hashes, func(ctx context.Context, chunk *chunks.Chunk) {
 		func() {
 			mu.Lock()
 			defer mu.Unlock()
@@ -163,22 +171,23 @@ func (gcs *GenerationalNBS) GetManyCompressed(ctx context.Context, hashes hash.H
 
 func (gcs *GenerationalNBS) getManyCompressed(ctx context.Context, hashes hash.HashSet, found func(context.Context, ToChunker), gcDepMode gcDependencyMode) error {
 	var mu sync.Mutex
-	notInOldGen := hashes.Copy()
-	err := gcs.oldGen.getManyCompressed(ctx, hashes, func(ctx context.Context, chunk ToChunker) {
+	// The generations are read new-then-old; see |Get| for why the order matters.
+	notInNewGen := hashes.Copy()
+	err := gcs.newGen.getManyCompressed(ctx, hashes, func(ctx context.Context, chunk ToChunker) {
 		mu.Lock()
-		delete(notInOldGen, chunk.Hash())
+		delete(notInNewGen, chunk.Hash())
 		mu.Unlock()
 		found(ctx, chunk)
 	}, gcDepMode)
 	if err != nil {
 		return err
 	}
-	if len(notInOldGen) == 0 {
+	if len(notInNewGen) == 0 {
 		return nil
 	}
 
-	notFound := notInOldGen.Copy()
-	err = gcs.newGen.getManyCompressed(ctx, notInOldGen, func(ctx context.Context, chunk ToChunker) {
+	notFound := notInNewGen.Copy()
+	err = gcs.oldGen.getManyCompressed(ctx, notInNewGen, func(ctx context.Context, chunk ToChunker) {
 		mu.Lock()
 		delete(notFound, chunk.Hash())
 		mu.Unlock()
@@ -199,13 +208,15 @@ func (gcs *GenerationalNBS) getManyCompressed(ctx context.Context, hashes hash.H
 }
 
 // Has returns true iff the value at the address |h| is contained in the store
+//
+// The generations are read new-then-old; see |Get| for why the order matters.
 func (gcs *GenerationalNBS) Has(ctx context.Context, h hash.Hash) (bool, error) {
-	has, err := gcs.oldGen.Has(ctx, h)
+	has, err := gcs.newGen.Has(ctx, h)
 	if err != nil || has {
 		return has, err
 	}
 
-	has, err = gcs.newGen.Has(ctx, h)
+	has, err = gcs.oldGen.Has(ctx, h)
 	if err != nil || has {
 		return has, err
 	}
```

---

### Incident Patch 8: `56bafb93` (2026-09-17)
**Commit Message**: go/store/nbs: Fix a lost cancellation wakeup in |waitForGC|.

|waitForGC| got its cancellation wakeup from a goroutine which broadcast
|nbs.gcCond| without holding |nbs.mu|, so a broadcast landing between the
waiter's |ctx.Err()| check and its call to Wait found nobody parked, woke
nobody, and left the waiter asleep until the GC cycle ended. Taking
|nbs.mu| in the broadcast closes that window. The idiom moves into
|broadcastOnCancel|, which uses context.AfterFunc instead of a goroutine
per wait and returns its |stop|, which never waits for a broadcast
already in progress and so is safe to call with |nbs.mu| held. The new
test covers the cancellation half of |waitForGC|'s contract, which was
untested; it does not reproduce the lost wakeup itself.

**File**: `go/store/nbs/gc_waitforgc_test.go` (modified, +54/-0)
```diff
@@ -128,3 +128,57 @@ func TestWaitForGCNotTrappedAcrossCycles(t *testing.T) {
 			"waitForGC does not distinguish between GC generations")
 	}
 }
+
+// TestWaitForGCWakesOnContextCancel covers the cancellation half of
+// waitForGC's contract. A sync.Cond wait cannot select on a context, so
+// without broadcastOnCancel a Put blocked behind a GC keeper sleeps
+// until the GC cycle ends, no matter what its context says.
+func TestWaitForGCWakesOnContextCancel(t *testing.T) {
+	ctx := context.Background()
+
+	_, _, _, st := makeStoreWithFakes(t)
+	defer st.Close()
+
+	c := chunks.NewChunk([]byte("wakes-on-context-cancel"))
+	err := st.Put(ctx, c, noopGetAddrs)
+	require.NoError(t, err)
+	ok, err := st.Commit(ctx, c.Hash(), hash.Hash{})
+	require.NoError(t, err)
+	require.True(t, ok)
+
+	// Always blocks, so the Put below parks in waitForGC.
+	keeperCalled := make(chan struct{}, 1)
+	keeper := func(h hash.Hash) bool {
+		select {
+		case keeperCalled <- struct{}{}:
+		default:
+		}
+		return true
+	}
+	require.NoError(t, st.BeginGC(t.Context(), keeper, chunks.GCMode_Full))
+	defer st.EndGC(chunks.GCMode_Full)
+
+	putCtx, cancelPut := context.WithCancel(ctx)
+	defer cancelPut()
+	putDone := make(chan error, 1)
+	go func() {
+		putDone <- st.Put(putCtx, c, noopGetAddrs)
+	}()
+
+	// addChunk holds nbs.mu until it parks in gcCond.Wait(), so
+	// acquiring nbs.mu means the Put is parked.
+	<-keeperCalled
+	st.mu.Lock()
+	st.mu.Unlock()
+
+	// The GC is still in progress and its cycle has not changed, so
+	// cancellation is the only thing which can release the Put.
+	cancelPut()
+
+	select {
+	case err := <-putDone:
+		require.ErrorIs(t, err, context.Canceled)
+	case <-time.After(3 * time.Second):
+		t.Fatal("Put stayed parked in waitForGC after its context was canceled")
+	}
+}
```

**File**: `go/store/nbs/store.go` (modified, +20/-9)
```diff
@@ -962,21 +962,32 @@ func (nbs *NomsBlockStore) SetFatalBehavior(behavior dherrors.FatalBehavior) {
 // immediately, allowing the caller to re-evaluate the new cycle's
 // keeper.
 func (nbs *NomsBlockStore) waitForGC(ctx context.Context, cycle uint64) error {
-	stop := make(chan struct{})
-	defer close(stop)
-	go func() {
-		select {
-		case <-ctx.Done():
-			nbs.gcCond.Broadcast()
-		case <-stop:
-		}
-	}()
+	defer nbs.broadcastOnCancel(ctx)()
 	for nbs.gcInProgress && nbs.gcCycleCounter == cycle && ctx.Err() == nil {
 		nbs.gcCond.Wait()
 	}
 	return ctx.Err()
 }
 
+// broadcastOnCancel broadcasts |nbs.gcCond| when |ctx| is cancelled. A
+// sync.Cond wait cannot select on a context, so without this a wait
+// whose predicate includes |ctx.Err()| sleeps until something else
+// broadcasts.
+//
+// The broadcast takes |nbs.mu| so that it cannot land between a waiter
+// checking its predicate and its call to Wait, where it would find
+// nobody parked and be lost.
+//
+// The returned func ends the watch. It does not wait for a broadcast
+// already in progress, so it is safe to call with |nbs.mu| held.
+func (nbs *NomsBlockStore) broadcastOnCancel(ctx context.Context) func() bool {
+	return context.AfterFunc(ctx, func() {
+		nbs.mu.Lock()
+		defer nbs.mu.Unlock()
+		nbs.gcCond.Broadcast()
+	})
+}
+
 func (nbs *NomsBlockStore) Put(ctx context.Context, c chunks.Chunk, getAddrs chunks.InsertAddrsCurry) error {
 	if err := nbs.ensureLoad(ctx); err != nil {
 		return err
```

---

### Incident Patch 9: `85c76235` (2026-09-16)
**Commit Message**: Merge pull request #11838 from dolthub/zachmu/issue-8785-regression-test

[no-release-notes] Test MD5 of binary file contents

**File**: `go/libraries/doltcore/sqle/enginetest/dolt_engine_test.go` (modified, +32/-0)
```diff
@@ -18,6 +18,7 @@ import (
 	gosql "database/sql"
 	"fmt"
 	"os"
+	"path/filepath"
 	"runtime"
 	"sync"
 	"testing"
@@ -794,6 +795,37 @@ func TestBlobs(t *testing.T) {
 	h := newDoltHarness(t)
 	defer h.Close()
 	enginetest.TestBlobs(t, h)
+
+	t.Run("MD5 of binary LOAD_FILE", func(t *testing.T) {
+		dir := t.TempDir()
+		path := filepath.Join(dir, "md5_binary")
+		require.NoError(t, os.WriteFile(path, []byte{0xff, 0x00, 0x80, 'a', 'b', 'c'}, 0600))
+		_, oldSecureFilePriv, ok := sql.SystemVariables.GetGlobal("secure_file_priv")
+		require.True(t, ok)
+		require.NoError(t, sql.SystemVariables.AssignValues(map[string]interface{}{"secure_file_priv": dir}))
+		t.Cleanup(func() {
+			require.NoError(t, sql.SystemVariables.AssignValues(map[string]interface{}{"secure_file_priv": oldSecureFilePriv}))
+		})
+		script := queries.ScriptTest{
+			Name: "MD5 of binary file contents",
+			Assertions: []queries.ScriptTestAssertion{{
+				Query:    fmt.Sprintf("SELECT MD5(BINARY LOAD_FILE(%q))", filepath.ToSlash(path)),
+				Expected: []sql.Row{{"c54f88b4c45ee5d3aaf21a0da5003612"}},
+			}},
+		}
+		for _, prepared := range []bool{false, true} {
+			t.Run(fmt.Sprintf("prepared=%t", prepared), func(t *testing.T) {
+				h := newDoltHarness(t)
+				defer h.Close()
+				if prepared {
+					enginetest.TestScriptPrepared(t, h, script)
+				} else {
+					enginetest.TestScript(t, h, script)
+				}
+			})
+		}
+
+	})
 }
 
 func TestIndexes(t *testing.T) {
```

---

### Incident Patch 10: `f9cb3123` (2026-09-16)
**Commit Message**: Merge main into binary file regression branch

**File**: `.github/actions/check-deferred-ci/.gitignore` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+node_modules/
```

**File**: `.github/actions/check-deferred-ci/README.md` (added, +239/-0)
```diff
@@ -0,0 +1,239 @@
+# PR CI deferral
+
+Apply either or both of these labels to control when automatic PR CI may start:
+
+| Label | Condition for starting CI |
+| --- | --- |
+| `defer-ci-after-hours` | Wait during **5am–9pm**; release during **9pm–5am**. |
+| `defer-ci-review` | Wait until the PR has at least one active approving review. |
+| Both labels | Wait until **both** the after-hours window and an approval are present. |
+
+All times use **America/Los_Angeles** by default. Set the repository Actions
+variable `CI_TIMEZONE` to another IANA timezone name if needed. The release window
+includes 9pm and ends at 5am, every day including weekends, with daylight-saving
+time handled automatically.
+
+For example, a PR with both labels that receives approval at 2pm waits until the
+9pm release window. If it is still unapproved at 9pm, it continues waiting for an
+approval. A PR with only `defer-ci-review` can start CI on approval at any time.
+
+An active approval means a reviewer's latest submitted decision is `APPROVED`.
+A later comment-only review does not revoke it; a dismissal or later request for
+changes from that reviewer does. One reviewer's active approval is sufficient,
+even if another reviewer requested changes. This is a CI scheduling condition;
+it does not replace branch protection's review requirements. GitHub controls
+whether new commits dismiss existing approvals. An approval that GitHub has not
+dismissed continues to qualify, even if it was submitted on an earlier commit.
+
+For a draft PR, add **`force-draft-ci`** to bypass the draft hold without marking
+it ready. This label bypasses only the draft hold: `defer-ci-after-hours` and
+`defer-ci-review` still apply, including when combined.
+
+## Submitting a PR without starting CI before labels are applied
+
+**Automatic PR CI is also held while a PR is a draft without `force-draft-ci`.**
+Agents should create the PR as a draft, apply all desired labels, and then mark it
+ready for review.
+Marking it ready releases CI only when all label conditions are satisfied.
+Unlabeled drafts also wait until they are marked ready or given `force-draft-ci`.
+
+`gh pr create --label` is **not atomic**: the CLI creates the PR, then applies
+labels in a separate API call. A quick label update alone cannot guarantee that
+CI will not start first. GitHub's create-PR API does support creating a draft in
+the initial request, which makes this sequence safe for automatic PR CI:
+
+```sh
+pr_url=$(gh pr create --draft \
+  --label defer-ci-after-hours \
+  --label defer-ci-review \
+  --title 'PR title' --body-file pr-body.txt) &&
+  gh pr ready "$pr_url"
+```
+
+To keep the PR in draft, replace the final `gh pr ready "$pr_url"` command with
+`gh pr edit "$pr_url" --add-label force-draft-ci`. Apply the deferral labels
+successfully **before** adding this override, so the draft hold protects the
+label-assignment interval.
+
+Use either deferral label or both as needed. The `&&` ensures the PR is not marked
+ready if creation or label assignment fails; the draft continues to hold CI. The
+repository labels must exist before running these commands. The gate reads the
+live draft state and labels, including when an original draft run is rerun.
+
+Sources: [GitHub CLI creation and metadata calls](https://github.com/cli/cli/blob/trunk/api/queries_pr.go#L459-L520),
+[GitHub create-PR inputs](https://docs.github.com/en/graphql/reference/pulls#createpullrequestinput).
+
+## Release and override
+
+- Each job briefly allocates its normal runner to check admission before setup
+  or tests. Deferred workflows are canceled, freeing those runners until release.
+  Matrix members can each briefly allocate a runner; there is no separate
+  admission job or admission check.
+- A new bot comment records each deferral, including its conditions and overrides,
+  and another records release. Existing comments are never edited. Repeated
+  notifications for the same event and revision do not add
```

**File**: `.github/actions/check-deferred-ci/action.yml` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+name: Check deferred CI
+description: Check PR deferral policy and cancel postponed workflows before setup or tests.
+inputs:
+  timezone:
+    description: IANA timezone for the after-hours window.
+    default: America/Los_Angeles
+outputs:
+  run:
+    description: Whether subsequent work is admitted (also true for non-PR events).
+    value: ${{ steps.admission.outputs.run }}
+# The action runs before checkout. Load its bundled code from github.action_path,
+# the absolute action directory, rather than depending on the caller’s workspace.
+runs:
+  using: composite
+  steps:
+    - id: admission
+      uses: actions/github-script@v7
+      env:
+        CI_ACTION_PATH: ${{ github.action_path }}
+        CI_TIMEZONE: ${{ inputs.timezone }}
+      with:
+        script: |
+          const { checkDeferredCI } = require(process.env.CI_ACTION_PATH + '/cancellation');
+          await checkDeferredCI({ github, context, core, timezone: process.env.CI_TIMEZONE,
+            attempt: Number(process.env.GITHUB_RUN_ATTEMPT) });
+    - if: steps.admission.outputs.marker-name != ''
+      uses: actions/upload-artifact@v4
+      with:
+        name: ${{ steps.admission.outputs.marker-name }}
+        path: ${{ steps.admission.outputs.marker-path }}
+        retention-days: 30
+        if-no-files-found: error
+    - if: steps.admission.outputs.run == 'false'
+      uses: actions/github-script@v7
+      env:
+        CI_ACTION_PATH: ${{ github.action_path }}
+      with:
+        script: |
+          const { cancelFromJob } = require(process.env.CI_ACTION_PATH + '/cancellation');
+          await cancelFromJob({ github, context, core });
```

**File**: `.github/actions/check-deferred-ci/cancellation.js` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+// Copyright 2026 Dolthub, Inc.
+// Licensed under the Apache License, Version 2.0.
+'use strict';
+
+const ADMISSION_STEP = 'Check deferred CI';
+const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
+const marker = (run, attempt) => `dolt-ci-deferred-${run}-${attempt}-`;
+
+async function recordDeferral(run, attempt) {
+  const { mkdtemp, writeFile } = require('node:fs/promises');
+  const { join } = require('node:path');
+  const { tmpdir } = require('node:os');
+  const { randomUUID } = require('node:crypto');
+  const path = join(await mkdtemp(join(tmpdir(), 'dolt-ci-')), 'deferred.json');
+  await writeFile(path, JSON.stringify({ run, attempt }));
+  return { path, name: marker(run, attempt) + randomUUID() };
+}
+
+async function checkDeferredCI({ github, context, core, timezone, attempt, record = recordDeferral }) {
+  const { admission } = require('./index');
+  const decision = await admission({ github, context, timezone });
+  core.setOutput('run', String(decision.run));
+  if (decision.reason === 'deferred') {
+    // The action uploads this tiny marker before waiting for cancellation.
+    // Unlike check annotations it is visible while the action is still running.
+    const artifact = await record(context.runId, attempt);
+    core.setOutput('marker-path', artifact.path);
+    core.setOutput('marker-name', artifact.name);
+    await core.summary.addRaw('CI postponed. See the PR comment for conditions and overrides.').write();
+  }
+}
+
+function jobDecision(jobs) {
+  const started = jobs.filter(job => job.conclusion !== 'skipped');
+  if (started.some(job => !job.steps?.some(step =>
+    step.name === ADMISSION_STEP && step.conclusion === 'success'))) return 'failed';
+  return jobs.length ? 'admitted' : 'failed';
+}
+
+async function readDecision({ github, repo, run, jobs }) {
+  // Discover participation from GitHub's job metadata, not a workflow registry.
+  if (!jobs.some(job => job.steps?.some(step => step.name === ADMISSION_STEP))) return 'unmanaged';
+  const decision = jobDecision(jobs);
+  if (decision === 'admitted' || !jobs.some(job => job.steps?.some(step =>
+    step.name === ADMISSION_STEP && step.conclusion !== 'skipped'))) return decision;
+  const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts,
+    { ...repo, run_id: run.id, per_page: 100 });
+  if (artifacts.some(artifact => !artifact.expired && artifact.name.startsWith(marker(run.id, run.run_attempt)))) {
+    return 'deferred';
+  }
+  return decision;
+}
+
+async function cancelFromJob({ github, context, core, wait = sleep }) {
+  try {
+    await github.rest.actions.cancelWorkflowRun({ ...context.repo, run_id: context.runId });
+  } catch (error) {
+    // Fork PRs and restricted jobs have read-only tokens. The trusted
+    // workflow_run controller performs their cancellation instead.
+    if (![403, 409].includes(error.status)) throw error;
+    core.info('Waiting for the trusted CI scheduler to cancel this deferred run.');
+  }
+  // Never return successfully while cancellation is asynchronous. Ordinary
+  // steps require success; failure/always handlers retain an admission guard.
+  // Bound runner time
+  // if GitHub delays the cancellation controller; its completion event can still
+  // record this marked run for later release.
+  await wait(90000);
+  core.setFailed('CI was deferred but cancellation did not arrive within 90 seconds; no tests ran.');
+}
+
+async function cancelDeferredRun({ github, context, wait = sleep, attempts = 20 }) {
+  const runId = context.payload.workflow_run.id;
+  const repo = context.repo;
+  for (let attempt = 0; attempt < attempts; attempt++) {
+    const { data: run } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: runId });
+    if (run.event !== 'pull_request' || run.status === 'completed') return;
+    if (run.run_attempt !== context.payload.workflow_run.run_attempt) return;
+    // Only trust GitHub's metadata, neve
```

**File**: `.github/actions/check-deferred-ci/cancellation.test.js` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+// Copyright 2026 Dolthub, Inc.
+// Licensed under the Apache License, Version 2.0.
+'use strict';
+
+const { test } = require('node:test');
+const assert = require('node:assert/strict');
+const { ADMISSION_STEP, marker, readDecision, cancelFromJob, cancelDeferredRun } = require('./cancellation');
+const deferred = { conclusion: 'cancelled', steps: [{ name: ADMISSION_STEP, conclusion: 'cancelled' }] };
+const admitted = { conclusion: 'success', steps: [{ name: ADMISSION_STEP, conclusion: 'success' }] };
+
+test('inline cancellation never falls through to tests, including read-only fork tokens', async () => {
+  for (const status of [null, 403, 409]) {
+    const calls = [];
+    await cancelFromJob({
+      github: { rest: { actions: { cancelWorkflowRun: async args => {
+        calls.push(args); if (status) throw Object.assign(new Error('permission or race'), { status });
+      } } } },
+      context: { repo: { owner: 'base', repo: 'repo' }, runId: 7 },
+      core: { info: () => {}, setFailed: message => calls.push(message) },
+      wait: async ms => assert.equal(ms, 90000),
+    });
+    assert.deepEqual(calls[0], { owner: 'base', repo: 'repo', run_id: 7 });
+    assert.match(calls[1], /no tests ran/);
+  }
+});
+
+function fixture() {
+  const run = { id: 7, event: 'pull_request', path: 'new-workflow.yml', status: 'in_progress', run_attempt: 1,
+    head_sha: 'head', head_branch: 'branch', head_repository: { full_name: 'fork/repo' } };
+  const pr = { head: { sha: 'head', ref: 'branch', repo: { full_name: 'fork/repo' } } };
+  const state = { run, pr, jobs: [deferred], canceled: [], waits: 0 };
+  const github = { rest: {
+    actions: {
+      getWorkflowRun: async () => ({ data: state.run }),
+      listJobsForWorkflowRunAttempt: 'jobs',
+      listWorkflowRunArtifacts: 'artifacts',
+      cancelWorkflowRun: async args => state.canceled.push(args.run_id),
+    }, pulls: { list: 'prs' },
+  }, paginate: async (method, args) => {
+    if (method === 'jobs') { assert.equal(args.attempt_number, 1); return state.jobs; }
+    if (method === 'artifacts') return state.artifacts || [{ name: marker(7, 1) + 'test' }];
+    return [state.pr];
+  } };
+  const context = { repo: { owner: 'base', repo: 'repo' }, payload: { workflow_run: { id: 7, run_attempt: 1 } } };
+  return { state, github, context, wait: async () => { state.waits++; }, attempts: 2 };
+}
+
+test('trusted controller cancels marked fork runs and leaves admitted work running', async () => {
+  const f = fixture(); await cancelDeferredRun(f); assert.deepEqual(f.state.canceled, [7]);
+  const g = fixture(); g.state.jobs = [admitted]; await cancelDeferredRun(g);
+  assert.deepEqual(g.state.canceled, []); assert.equal(g.state.waits, 0);
+});
+
+test('discovery requires a current deferral marker and matching PR head, repository and attempt', async () => {
+  for (const patch of [{ head_sha: 'old' }, { run_attempt: 2 },
+    { head_repository: { full_name: 'other/repo' } }, { event: 'push' }]) {
+    const f = fixture(); Object.assign(f.state.run, patch); await cancelDeferredRun(f);
+    assert.deepEqual(f.state.canceled, []);
+  }
+  const f = fixture();
+  const args = { github: f.github, repo: f.context.repo, run: f.state.run, jobs: f.state.jobs };
+  for (const artifact of [{ name: marker(7, 2) }, { name: marker(8, 1) },
+    { name: marker(7, 1), expired: true }]) {
+    f.state.artifacts = [artifact]; assert.equal(await readDecision(args), 'failed');
+  }
+  f.state.jobs = [{ steps: [{ name: 'Unrelated job' }] }];
+  await cancelDeferredRun(f);
+  assert.deepEqual(f.state.canceled, []);
+  assert.equal(f.state.waits, 0);
+});
+
+test('both action imports work from an isolated action directory without a checkout', async () => {
+  const fs = require('node:fs');
+  const path = require('node:path');
+  const root = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ci-action-'));
+  try {
+    const action = path.join(root, 'action');
+    fs.cpS
```

#### Recent Merged Pull Requests:
- **PR #11971** (closed): [auto-bump] [no-release-notes] dependency by zachmu (@coffeegoddd)
- **PR #11970** (closed): [auto-bump] [no-release-notes] dependency by zachmu (@coffeegoddd)
- **PR #11969** (2026-09-30): [auto-bump] [no-release-notes] dependency by Hydrocharged (@coffeegoddd)
- **PR #11967** (closed): test numeric time bump (@jycor)
- **PR #11965** (closed): [auto-bump] [no-release-notes] dependency by zachmu (@coffeegoddd)
- **PR #11964** (closed): [auto-bump] [no-release-notes] dependency by angelamayxie (@coffeegoddd)
- **PR #11963** (closed): [auto-bump] [no-release-notes] dependency by jycor (@coffeegoddd)
- **PR #11961** (2026-09-29): [auto-bump] [no-release-notes] dependency by angelamayxie (@coffeegoddd)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
